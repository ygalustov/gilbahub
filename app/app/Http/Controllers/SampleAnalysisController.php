<?php

namespace App\Http\Controllers;

use App\Support\LabReadingNames;
use App\Support\CalculationInputs;
use App\Support\ClassificationConstants;
use App\Support\AaRanges;
use App\Support\SlanRanges;
use App\Models\Sample;
use App\Models\SiteConfig;
use App\Services\HillLabsSampleTypesService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class SampleAnalysisController extends Controller
{
    /**
     * GH-546: the thresholds come from the canonical source
     * now. The table that stood here agreed with the product on the four
     * macronutrients and disagreed on all five micronutrients — Fe 49 against 2,
     * Mn 5 against 1, Zn 2.2 against 1, Cu 0.9 against 0.3, B 0.5 against 0.3 —
     * and that never showed, because the controller preferred thresholds lifted
     * out of the analysis cache, which carried the canonical numbers. The wrong
     * table applied only to a site with no cached run: the same sample
     * classified one way before a Re-run and another way after.
     */
    private const MLSN_DEFAULTS = ClassificationConstants::MLSN_THRESHOLDS;

    // GH-768 (queue item 3vm): the AA table that used to stand here carried five nutrients of ten,
    // so Fe, Mn, Zn, Cu and B on an AA site fell through to MLSN's thresholds below -- a different
    // methodology, and nothing said so. All ten now come from `assets/aa-ranges.json` through
    // App\Support\AaRanges, the same shape SlanRanges established in GH-752. The numbers are the
    // engine's own; tests/gh768-the-aa-ranges-have-one-file.test.js holds the file equal to them.

    private const UNUSUAL_RANGES = [
        'K'  => [5,   800],  'P'  => [1,   200],  'Ca' => [50,  4000],
        'Mg' => [10,  800],  'S'  => [1,   300],  'Fe' => [5,   600],
        'Mn' => [1,   500],  'Zn' => [0.5, 50],   'Cu' => [0.1, 30],
        'B'  => [0.1, 10],
    ];

    public function run(Request $request, Sample $sample): JsonResponse
    {
        abort_unless($request->user()->canViewSite($sample->site), 403);

        $payload = $sample->payload ?? [];

        // GH-271: `computed.soilNutrition` (the cached result of the last
        // Re-run -- mlsnEngine()'s canonical 10-nutrient P/K/Ca/Mg/S/Fe/Mn/
        // Zn/Cu/B list, persisted by AnalysisCacheController::store()) lives
        // under the 'analysis_cache' SiteConfig namespace, NOT 'gaip' ('gaip'
        // holds turf/location/methodology *settings* -- species, texture,
        // etc. -- see every other controller's identical `$gaipConfig['turf']
        // [...]` reads). This was reading the wrong namespace since this
        // controller was written, so $cachedSn was always empty here,
        // silently forcing computeNutrients()'s "no cache" fallback branch on
        // every single request -- which rebuilds the nutrient list from
        // array_intersect_key($payload, MLSN_DEFAULTS), preserving the raw
        // sample payload's own JSON key order (whatever order fields were
        // entered/imported in) and only including nutrients present in that
        // one sample's payload. Confirmed live: switching samples visibly
        // reordered the nutrient cards and dropped from 10 to 4 (only K/P/Ca/
        // Mg, in payload order) versus the initial mlsnEngine() load's
        // canonical, complete P/K/Ca/Mg/S/Fe/Mn/Zn/Cu/B order (which shows
        // "NOT MEASURED" placeholders for untested nutrients instead of
        // omitting them). Also silently meant buildThresholdMap() never
        // picked up any site-specific MLSN thresholds from the real cache.
        // GH-546: this controller no longer reads the
        // analysis cache. It used to begin its answer with the whole
        // `computed.soilNutrition` object of the site's last browser run and
        // then overwrite eight of its nineteen keys — so `zones`, `annualDemand`,
        // `monthlyN`, `tissue`, `depthCm`, `bulkDensity`, `turfType`, `species`
        // and `fromSample` reached the page from WHICHEVER SAMPLE was active
        // during that run, under the requested sample's label. One object's data
        // beside another object's name, inside a single response.
        //
        // It has nothing to take from there. The MLSN thresholds are constants
        // (above), the AA ranges the server already derives itself
        // (HillLabsSampleTypesService, GH-268), the nutrient order is a constant
        // (GH-271), and pH/ECe/soilNa/CEC are properties of the sample being
        // asked about. The run's own keys stay with the run and reach the page
        // from the result projection, where they are honest.
        $config = SiteConfig::where('site_id', $sample->site_id)->where('namespace', 'gaip')->first();

        $site = $sample->site;
        $lat  = $site->latitude  !== null ? (float) $site->latitude  : null;
        $lon  = $site->longitude !== null ? (float) $site->longitude : null;
        if ($lat === null) $lat = isset($config?->config['location']['lat']) ? (float) $config->config['location']['lat'] : null;
        if ($lon === null) $lon = isset($config?->config['location']['lon']) ? (float) $config->config['location']['lon'] : null;

        // GH-520: the methodology comes from the site's configuration — the one
        // owner — and not from the analysis cache. The cache is written by
        // client runs; reading it here made the server's answer depend on
        // whatever a browser last persisted, and it carried the NZ override
        // with it. Null means not set, and the nutrient classification that
        // needs a methodology does not run.
        $methodology = self::effectiveMethodology(
            $config?->config['turf']['methodology'] ?? null
        );
        // GH-269 (D07): prefer the LIVE site texture over the sample's
        // soil_texture_snapshot. The snapshot is frozen at sample-creation
        // time (SampleController.php's store()), so a site whose Settings
        // "Soil texture" changed AFTER a sample was saved keeps showing the
        // stale, pre-change value forever via the snapshot — confirmed live:
        // three real Russley samples (a Sand-rootzone certificate site,
        // Hill Labs 2606324) all had soil_texture_snapshot === 'loam',
        // silently defeating GH-268's certificate resolution. Unlike
        // methodology (GH-265, where the live signal only exists client-side
        // via region auto-select), this controller already has $sample->site
        // in scope, so the live value is a direct, no-extra-query read — no
        // reason to prefer a snapshot that can go stale over it. Falls back
        // to the snapshot, then the historical 'sands' default, only if the
        // site/account genuinely never had a texture set at all.
        $soilTexture = HillLabsSampleTypesService::resolveSoilTexture(
            $site->soil_texture_override,
            $site->account?->soil_texture
        ) ?? $sample->soil_texture_snapshot ?? 'sands';
        $species     = $config?->config['turf']['species'] ?? $config?->config['turf']['grassSpecies'] ?? null;

        // GH-752: the soil type the SLAN ranges are chosen by is a property of the site's construction,
        // resolved by the one dictionary. No construction, no soil type -- and no guessed one.
        $slanSoilType = CalculationInputs::resolveConstruction($config?->config ?? [])['resolves']['slanSoilType'] ?? null;

        $nutrients = $this->computeNutrients($payload, $methodology, $soilTexture, $species, $slanSoilType);

        $statuses = array_column($nutrients, 'statusClass');
        $verdict  = in_array('deficient', $statuses)
            ? 'HIGH_RISK'
            : (in_array('borderline', $statuses) ? 'MONITOR' : (count($nutrients) ? 'ACCEPTABLE' : 'NO_DATA'));

        $validation = $this->validatePayload($payload);

        $sn = ([
            'nutrients'   => $nutrients,
            'verdict'     => $verdict,
            'ratios'      => null,
            'sampleDate'  => $sample->lab_date?->toDateString() ?? $sample->sample_date?->toDateString(),
            'sampleLabel' => $sample->client_uid,
            // A field the sample does not carry is null. It is not filled from
            // somebody else's run (owner's rule on defaults).
            'pH'          => $payload['pH_Water'] ?? $payload['pH'] ?? $payload['ph'] ?? null,
            'ECe'         => $payload['ECe'] ?? $payload['EC_paste'] ?? $this->computeEce($payload) ?? null,
            // GH-722: Na through the lab reading names map, as the calculation reads it.
            'soilNa'      => (($v = (float)((LabReadingNames::readingsOf('soil', $payload) ?? [])['Na'] ?? 0)) > 0 ? $v : null),
            'CEC'         => $payload['CEC'] ?? $payload['cec'] ?? null,
            'validation'  => ($validation['errors'] || $validation['warnings']) ? $validation : null,
            'methodology' => $methodology,
        ]);

        return response()->json(['data' => $sn]);
    }

    /**
     * GH-533: $methodology is nullable, and the null case is the one the
     * paragraph in run() above already describes — "Null means not set, and
     * the nutrient classification that needs a methodology does not run."
     *
     * It said so and did not do it. GH-520 made the value nullable at its one
     * owner, and this parameter stayed `string`, so a site that has chosen no
     * methodology answered **HTTP 500** on GET /api/samples/{id}/analyse:
     * `Argument #4 ($methodology) must be of type string, null given`. The same
     * shape as GH-527, one route further along — that one was the write of the
     * stamp, this is the read of the setting. Found by writing the stage 2
     * test for an unrelated question, on a site created without a config.
     *
     * Falling through to the MLSN branch would have been the smaller edit and
     * is exactly what the owner's rule forbids: MLSN is a methodology, and
     * classifying against it is a choice nobody made. So a nutrient keeps its
     * measured value and says the classification did not run. Nothing is
     * invented and no threshold is applied.
     */
    private function computeNutrients(
        array $payload,
        ?string $methodology = null, string $soilTexture = 'sands', ?string $species = null,
        ?string $slanSoilType = null
    ): array {
        $isAA    = $methodology !== null && strtolower($methodology) === 'ammonium_acetate';
        $isSLAN  = $methodology !== null && strtolower($methodology) === 'slan';
        $texKey  = (stripos($soilTexture, 'sand') !== false) ? 'sands' : 'others';

        // GH-268 (D07 item 4): resolve a certificate-backed sample-type code
        // the same way mlsnEngine() does (GH-260/258) — deriveCode() handles
        // both canonical species keys and common raw labels internally. When
        // it resolves, per-nutrient certificate ranges (getRangesPpm) overlay
        // the texture-only ranges below -- for the five nutrients the engine
        // lets a certificate override (GH-768); when it doesn't (species not
        // covered, or not sand-ish for the two sand-only codes), those ranges
        // stay exactly as before — this endpoint no longer disagrees with
        // mlsnEngine()'s output for the same sample, closing the dual-path
        // gap GH-262 traced back to this controller.
        $sampleTypeCode = $isAA ? HillLabsSampleTypesService::deriveCode($species, $soilTexture) : null;
        $cec = isset($payload['CEC']) ? floatval($payload['CEC'])
            : (isset($payload['cec']) ? floatval($payload['cec']) : null);

        // GH-546: the canonical order is the only path now. It used to be the
        // branch taken when the cache had no nutrient list; with the cache gone
        // there is one order and it is the product's.
            // GH-271: canonical order, matching mlsnEngine()'s own nutrient
            // loop (assets/hub-tissue-v3.js) exactly -- not
            // array_keys(array_intersect_key($payload, MLSN_DEFAULTS)),
            // which preserved the sample's raw JSON payload key order (data-
            // entry/import order, not a stable display order) and silently
            // omitted any nutrient the sample didn't have a value for. Now
            // includes all 10 always; the per-nutrient map below already
            // returns 'No data'/'no-data' for a null $actual, so an untested
            // nutrient shows a "no data" card instead of not appearing at
            // all -- same behaviour as mlsnEngine()'s "NOT MEASURED" rows.
            // Only reached when a site has never had a Re-run at all (the
            // 'analysis_cache'-namespace fix above means this is no longer
            // the common case it silently was before).
        $canonicalOrder = array_keys(self::MLSN_DEFAULTS);
        $nutrientList = array_map(
            fn ($nut) => ['nutrient' => $nut, 'mlsn' => self::MLSN_DEFAULTS[$nut]],
            $canonicalOrder
        );

        // GH-722: each nutrient through the lab reading names map, as the calculation reads it,
        // rather than by its bare key — a sample spelled `K_ppm` was "No data" here.
        $readings = LabReadingNames::readingsOf('soil', $payload) ?? [];

        return array_values(array_map(
            function (array $n) use ($readings, $isAA, $isSLAN, $slanSoilType, $texKey, $sampleTypeCode, $cec, $methodology) {
                $thresholds = self::MLSN_DEFAULTS;
                $nut    = $n['nutrient'];
                $actual = $readings[$nut] ?? null;

                if ($actual === null) {
                    return array_merge($n, ['actual' => null, 'status' => 'No data', 'statusClass' => 'no-data']);
                }

                // GH-533: see the docblock. The reading is reported; the
                // classification is not, because there is nothing to classify
                // against. Distinct from 'No data', which is the opposite case
                // -- a methodology and no reading.
                if ($methodology === null) {
                    return array_merge($n, [
                        'actual'      => (string) $actual,
                        'status'      => 'No methodology set',
                        'statusClass' => 'no-data',
                    ]);
                }

                // GH-752: SLAN is graded as the run grades it -- the SLAN ranges of the site's soil type,
                // Low / Sufficient / High on lo and hi, Fe and Mn adjusted by the sample's pH -- and not
                // by MLSN's thresholds, which the branch below used to apply to every site that was not AA.
                if ($isSLAN) {
                    return array_merge($n, self::gradeSlan($nut, (float) $actual, $slanSoilType, $readings['pH'] ?? null));
                }

                // AA methodology: use Hill Labs sufficiency ranges
                $aaRanges = $isAA ? AaRanges::forSoilType($texKey) : null;
                if ($isAA && isset($aaRanges[$nut])) {
                    $lowCeil = $aaRanges[$nut]['lo'];
                    $medCeil = $aaRanges[$nut]['hi'];
                    $rangeLabel = $lowCeil.'-'.$medCeil; // "12-28" format, matches old hub
                    // GH-304 (D07 item 7): mirrors hub-tissue-v3.js's aaRangeSource
                    // tagging (GH-260) -- defaults to the texture-only fallback,
                    // flips to 'certificate' only when getRangesPpm() actually
                    // resolves a range for this specific nutrient on the matched
                    // code (e.g. S277 has no printed Sulphur range, so S stays
                    // 'texture-fallback' even when $sampleTypeCode resolves).
                    $rangeSource = 'texture-fallback';

                    // GH-768: the certificate overrides the five the engine lets it override, by the
                    // list the file carries, and not everything `getRangesPpm` happens to answer for.
                    // Today the certificate data holds no micronutrient range, so this changes
                    // nothing; it means the two sides cannot part the day one appears.
                    if ($sampleTypeCode && in_array($nut, AaRanges::certificateOverridable(), true)) {
                        $certRange = HillLabsSampleTypesService::getRangesPpm($sampleTypeCode, $nut, $cec);
                        if ($certRange) {
                            $lowCeil = $certRange['min'];
                            $medCeil = $certRange['max'];
                            // Match mlsnEngine()'s rangeStr format (1 decimal) for
                            // certificate-backed ranges; the texture-only fallback
                            // above keeps its existing whole-number format unchanged.
                            $rangeLabel = number_format($lowCeil, 1).'-'.number_format($medCeil, 1);
                            $rangeSource = 'certificate';
                        }
                    }

                    // GH-276: upper-bound comparison must be <=, matching
                    // mlsnEngine()'s AA branch (hub-tissue-v3.js) exactly --
                    // this was `<`, so a value landing exactly on the
                    // certificate's upper bound classified as High here but
                    // Sufficient on the JS path, reopening a narrower version
                    // of the exact dual-path disagreement GH-268-275 closed.
                    if ($actual < $lowCeil)      { $status = 'Low';        $sc = 'deficient'; }
                    elseif ($actual <= $medCeil) { $status = 'Sufficient'; $sc = 'adequate'; }
                    else                         { $status = 'High';       $sc = 'high'; }
                    return array_merge($n, [
                        'actual'      => (string) $actual,
                        'status'      => $status,
                        'statusClass' => $sc,
                        'mlsn'        => $rangeLabel,
                        'rangeMin'    => $lowCeil,
                        'rangeMax'    => $medCeil,
                        'rangeSource' => $rangeSource,
                    ]);
                }

                // MLSN: single-threshold classification
                $mlsn = $thresholds[$nut] ?? floatval($n['mlsn'] ?? 0);
                if ($mlsn > 0) {
                    if ($actual < $mlsn)           { $status = 'Deficient';  $sc = 'deficient'; }
                    elseif ($actual < $mlsn * 1.2) { $status = 'Borderline'; $sc = 'borderline'; }
                    else                           { $status = 'Adequate';   $sc = 'adequate'; }
                } else {
                    $status = 'Adequate'; $sc = 'adequate';
                }

                return array_merge($n, [
                    'actual'      => (string) $actual,
                    'status'      => $status,
                    'statusClass' => $sc,
                    'mlsn'        => (string) $mlsn,
                ]);
            },
            $nutrientList
        ));
    }

    /**
     * GH-752 (queue item 3bl, part C) - one SLAN reading, graded as `mlsnEngine` grades it.
     *
     * The ranges come from `assets/slan-ranges.json` through its one reader. What is not known is said:
     * a site whose construction resolves no soil type is not graded by a guessed one, and Fe and Mn
     * without a pH on the sample are not graded -- the run puts 7 there, which is an open owner
     * question and is not copied here.
     *
     * @return array<string,mixed>
     */
    private static function gradeSlan(string $nut, float $actual, ?string $soilType, ?float $pH): array
    {
        $ranges = SlanRanges::forSoilType($soilType);
        if ($ranges === null) {
            return ['actual' => (string) $actual, 'status' => 'No construction set', 'statusClass' => 'no-data'];
        }
        $adj = SlanRanges::forClient()['phAdjusted'];
        if (isset($adj['nutrients'][$nut])) {
            if ($pH === null) {
                return ['actual' => (string) $actual, 'status' => 'No pH on the sample', 'statusClass' => 'no-data'];
            }
            $f = (max($adj['phFrom'], min($adj['phTo'], $pH)) - $adj['phFrom']) / ($adj['phTo'] - $adj['phFrom']);
            $x = $adj['nutrients'][$nut];
            $range = ['lo' => $x['base'] + $x['span'] * $f * $adj['loFactor'], 'hi' => $x['base'] + $x['span'] * $f * $adj['hiFactor']];
        } else {
            $range = $ranges[$nut] ?? null;
        }
        if ($range === null) {
            return ['actual' => (string) $actual, 'status' => 'No data', 'statusClass' => 'no-data'];
        }
        if ($actual < $range['lo'])       { $status = 'Low';        $sc = 'deficient'; }
        elseif ($actual <= $range['hi'])  { $status = 'Sufficient'; $sc = 'adequate'; }
        else                              { $status = 'High';       $sc = 'high'; }

        return [
            'actual'      => (string) $actual,
            'status'      => $status,
            'statusClass' => $sc,
            'mlsn'        => number_format($range['lo'], 1).'-'.number_format($range['hi'], 1),
            'rangeMin'    => $range['lo'],
            'rangeMax'    => $range['hi'],
        ];
    }

    private function computeEce(array $payload): ?float
    {
        // All EC 1:5 key variants seen across import paths and SampleManager normalisation
        // GH-722: EC 1:5 through the lab reading names map; the chain that stood here spelled it
        // seven ways in its own order.
        $ec15 = (float) ((LabReadingNames::readingsOf('soil', $payload) ?? [])['EC'] ?? 0);
        if ($ec15 <= 0) return null;
        $multipliers = [
            'sand' => 5, 'loamy_sand' => 5.5, 'sandy_loam' => 6,
            'loam' => 7, 'clay_loam' => 8, 'clay' => 10,
        ];
        $tex = strtolower((string)($payload['Texture'] ?? $payload['texture'] ?? 'loam'));
        return round($ec15 * ($multipliers[$tex] ?? 7), 3);
    }

    private function validatePayload(array $payload): array
    {
        $warnings = [];

        // GH-722: the same readings the cards above are built from.
        $readings = LabReadingNames::readingsOf('soil', $payload) ?? [];
        foreach (self::UNUSUAL_RANGES as $nut => [$min, $max]) {
            $val = $readings[$nut] ?? null;
            if ($val !== null && ($val < $min || $val > $max)) {
                $warnings[] = "{$nut} value {$val} ppm is outside the typical range ({$min}–{$max} ppm) — verify data entry.";
            }
        }

        return ['errors' => [], 'warnings' => $warnings];
    }
}
