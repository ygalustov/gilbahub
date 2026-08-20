<?php

namespace App\Http\Controllers;

use App\Models\Sample;
use App\Models\SiteConfig;
use App\Services\HillLabsSampleTypesService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class SampleAnalysisController extends Controller
{
    private const MLSN_DEFAULTS = [
        'K'  => 37,   'P'  => 21,  'Ca' => 331, 'Mg' => 47,
        'S'  => 7,    'Fe' => 49,  'Mn' => 5,   'Zn' => 2.2,
        'Cu' => 0.9,  'B'  => 0.5,
    ];

    // GH-268 (D07 item 4): texture-only fallback for AA — used when
    // HillLabsSampleTypesService::deriveCode() can't resolve a certificate-
    // backed sample-type code (species not covered, or texture not sand-ish
    // for the two sand-only codes). Same numbers this constant already had;
    // this class no longer treats them as the primary source, only the
    // graceful-degradation floor, matching mlsnEngine()'s AA branch (GH-260).
    private const AA_RANGES = [
        'P'  => ['sands' => [12, 28],   'others' => [12, 28]],
        'K'  => ['sands' => [75, 175],  'others' => [100, 235]],
        'Ca' => ['sands' => [500, 750], 'others' => [500, 750]],
        'Mg' => ['sands' => [100, 200], 'others' => [140, 250]],
        'S'  => ['sands' => [30, 60],   'others' => [30, 60]],
    ];

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
        $config              = SiteConfig::where('site_id', $sample->site_id)->where('namespace', 'gaip')->first();
        $analysisCacheConfig = SiteConfig::where('site_id', $sample->site_id)->where('namespace', 'analysis_cache')->first();
        $cachedSn            = data_get($analysisCacheConfig?->config ?? [], 'computed.soilNutrition', []);

        $site = $sample->site;
        $lat  = $site->latitude  !== null ? (float) $site->latitude  : null;
        $lon  = $site->longitude !== null ? (float) $site->longitude : null;
        if ($lat === null) $lat = isset($config?->config['location']['lat']) ? (float) $config->config['location']['lat'] : null;
        if ($lon === null) $lon = isset($config?->config['location']['lon']) ? (float) $config->config['location']['lon'] : null;

        // Determine methodology before computing nutrients so AA classification applies
        $methodology = self::effectiveMethodology($cachedSn['methodology'] ?? null, $lat, $lon);
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

        $thresholds = $this->buildThresholdMap($cachedSn);
        $nutrients  = $this->computeNutrients($payload, $thresholds, $cachedSn, $methodology, $soilTexture, $species);

        $statuses = array_column($nutrients, 'statusClass');
        $verdict  = in_array('deficient', $statuses)
            ? 'HIGH_RISK'
            : (in_array('borderline', $statuses) ? 'MONITOR' : (count($nutrients) ? 'ACCEPTABLE' : 'NO_DATA'));

        $validation = $this->validatePayload($payload);

        $sn = array_merge($cachedSn, [
            'nutrients'   => $nutrients,
            'verdict'     => $verdict,
            'ratios'      => null,
            'sampleDate'  => $sample->lab_date?->toDateString() ?? $sample->sample_date?->toDateString(),
            'sampleLabel' => $sample->client_uid,
            'pH'          => $payload['pH_Water'] ?? $payload['pH'] ?? $payload['ph'] ?? ($cachedSn['pH'] ?? null),
            'ECe'         => $payload['ECe'] ?? $payload['EC_paste'] ?? $this->computeEce($payload) ?? ($cachedSn['ECe'] ?? null),
            'soilNa'      => (($v = (float)($payload['Na'] ?? $payload['Na_ppm'] ?? 0)) > 0 ? $v : null) ?? ($cachedSn['soilNa'] ?? null),
            'CEC'         => $payload['CEC'] ?? $payload['cec'] ?? ($cachedSn['CEC'] ?? null),
            'validation'  => ($validation['errors'] || $validation['warnings']) ? $validation : null,
            'methodology' => $methodology,
        ]);

        return response()->json(['data' => $sn]);
    }

    private function buildThresholdMap(array $cachedSn): array
    {
        $thresholds = self::MLSN_DEFAULTS;

        foreach (data_get($cachedSn, 'nutrients', []) as $n) {
            $nut  = $n['nutrient'] ?? null;
            $mlsn = isset($n['mlsn']) ? floatval($n['mlsn']) : null;
            if ($nut && $mlsn > 0) {
                $thresholds[$nut] = $mlsn;
            }
        }

        return $thresholds;
    }

    private function computeNutrients(
        array $payload, array $thresholds, array $cachedSn,
        string $methodology = 'mlsn', string $soilTexture = 'sands', ?string $species = null
    ): array {
        $isAA    = strtolower($methodology) === 'ammonium_acetate';
        $texKey  = (stripos($soilTexture, 'sand') !== false) ? 'sands' : 'others';

        // GH-268 (D07 item 4): resolve a certificate-backed sample-type code
        // the same way mlsnEngine() does (GH-260/258) — deriveCode() handles
        // both canonical species keys and common raw labels internally. When
        // it resolves, per-nutrient certificate ranges (getRangesPpm) overlay
        // the AA_RANGES texture-only fallback below; when it doesn't (species
        // not covered, or not sand-ish for the two sand-only codes), AA_RANGES
        // stays exactly as before — this endpoint no longer disagrees with
        // mlsnEngine()'s output for the same sample, closing the dual-path
        // gap GH-262 traced back to this controller.
        $sampleTypeCode = $isAA ? HillLabsSampleTypesService::deriveCode($species, $soilTexture) : null;
        $cec = isset($payload['CEC']) ? floatval($payload['CEC'])
            : (isset($payload['cec']) ? floatval($payload['cec']) : null);

        $cachedNutrients = data_get($cachedSn, 'nutrients', []);

        if (empty($cachedNutrients)) {
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
            $canonicalOrder = ['P', 'K', 'Ca', 'Mg', 'S', 'Fe', 'Mn', 'Zn', 'Cu', 'B'];
            $cachedNutrients = array_map(
                fn ($nut) => ['nutrient' => $nut, 'mlsn' => self::MLSN_DEFAULTS[$nut]],
                $canonicalOrder
            );
        }

        return array_values(array_map(
            function (array $n) use ($payload, $thresholds, $isAA, $texKey, $sampleTypeCode, $cec) {
                $nut    = $n['nutrient'];
                $raw    = $payload[$nut] ?? null;
                $actual = $raw !== null ? floatval($raw) : null;

                if ($actual === null) {
                    return array_merge($n, ['actual' => null, 'status' => 'No data', 'statusClass' => 'no-data']);
                }

                // AA methodology: use Hill Labs sufficiency ranges
                if ($isAA && isset(self::AA_RANGES[$nut])) {
                    [$lowCeil, $medCeil] = self::AA_RANGES[$nut][$texKey];
                    $rangeLabel = $lowCeil.'-'.$medCeil; // "12-28" format, matches old hub

                    if ($sampleTypeCode) {
                        $certRange = HillLabsSampleTypesService::getRangesPpm($sampleTypeCode, $nut, $cec);
                        if ($certRange) {
                            $lowCeil = $certRange['min'];
                            $medCeil = $certRange['max'];
                            // Match mlsnEngine()'s rangeStr format (1 decimal) for
                            // certificate-backed ranges; the texture-only fallback
                            // above keeps its existing whole-number format unchanged.
                            $rangeLabel = number_format($lowCeil, 1).'-'.number_format($medCeil, 1);
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
                    ]);
                }

                // MLSN / SLAN: single-threshold classification
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
            $cachedNutrients
        ));
    }

    private function computeEce(array $payload): ?float
    {
        // All EC 1:5 key variants seen across import paths and SampleManager normalisation
        $ec15 = (float)(
            $payload['EC']      ?? $payload['ec']     ??
            $payload['EC1_5']   ?? $payload['EC_1_5'] ??
            $payload['EC1:5']   ?? $payload['EC_1:5'] ??
            $payload['EC_dSm']  ?? 0
        );
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

        foreach (self::UNUSUAL_RANGES as $nut => [$min, $max]) {
            $val = isset($payload[$nut]) ? floatval($payload[$nut]) : null;
            if ($val !== null && ($val < $min || $val > $max)) {
                $warnings[] = "{$nut} value {$val} ppm is outside the typical range ({$min}–{$max} ppm) — verify data entry.";
            }
        }

        return ['errors' => [], 'warnings' => $warnings];
    }
}
