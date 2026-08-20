<?php

namespace App\Services;

/**
 * PHP half of the Hill Labs sample-type SSOT (GH-258).
 *
 * Mirrors assets/hill-labs-sample-types.js's deriveCode()/getRangesPpm(). The
 * range data itself lives in resources/data/hill-labs-sample-types.json, read
 * by this class and also mirrored (not generated from) the JS literal in
 * hill-labs-sample-types.js -- there is no asset build step joining the two
 * files, so a range change must be applied in both places. See that file's
 * header comment for the full rationale (GH-258 found 9 independent AA range
 * copies across the codebase; this + the JS file are meant to be the only two
 * left, one per runtime).
 *
 * Used by SampleAnalysisController to replace its own hardcoded AA_RANGES
 * constant.
 */
class HillLabsSampleTypesService
{
    private const CONVERSION_FACTORS = ['K' => 391, 'Ca' => 200, 'Mg' => 122, 'Na' => 230];

    /** @var array<string, mixed>|null */
    private static ?array $sampleTypes = null;

    /**
     * Map a canonical species + general soil-texture value to a Hill Labs
     * sample-type code, or null if there's no certificate-backed match.
     *
     * "Sand-ish" bucketing: any texture value containing "sand" (sand,
     * sandy_loam, loamy_sand) counts as sand-rootzone; everything else
     * (loam, clay_loam, clay) is native/soil. Matches the rule this class
     * replaces in SampleAnalysisController.
     *
     * @param string|null $species Canonical species key (e.g. 'perennialRyegrass').
     * @param string|null $soilTexture Value of soil_texture_override / soil_texture.
     */
    public static function deriveCode(?string $species, ?string $soilTexture): ?string
    {
        if (!$species) {
            return null;
        }

        $isSandy = stripos((string) $soilTexture, 'sand') !== false;

        return match ($species) {
            'cotula' => 'S78',
            'fineFescue', 'tallFescue' => 'S81',
            'perennialRyegrass' => $isSandy ? 'S277' : null,
            'browntopBent' => $isSandy ? 'S279' : null,
            // Uncovered: Bentgrass, Kentucky Bluegrass, Poa Annua, all C4
            // species, and Ryegrass/Browntop on non-sand rootzones — no
            // certificate on file yet.
            default => null,
        };
    }

    /**
     * Get a nutrient's sufficiency range in ppm for a resolved sample-type
     * code, converting from the certificate-native unit (me/100g or %BS).
     *
     * @param string $code Sample type code (e.g. "S277").
     * @param string $nutrient Nutrient key (P, K, Ca, Mg, S, Na, ...).
     * @param float|null $cec CEC in me/100g, required only when the matched
     *   threshold is on the proportion (%BS) axis (S81's cations).
     * @return array{min: float, max: float}|null
     */
    public static function getRangesPpm(string $code, string $nutrient, ?float $cec = null): ?array
    {
        $thresholds = self::sampleTypes()[$code]['thresholds'] ?? null;
        $thresh = $thresholds[$nutrient] ?? null;
        if (!$thresh) {
            return null;
        }

        if ($thresh['axis'] === 'absolute' && $thresh['unit'] === 'me/100g') {
            $min = self::meq100gToPpm((float) $thresh['min'], $nutrient);
            $max = self::meq100gToPpm((float) $thresh['max'], $nutrient);
            return ($min === null || $max === null) ? null : ['min' => $min, 'max' => $max];
        }

        if ($thresh['axis'] === 'absolute') {
            // mg/L (Olsen P) / mg/kg (sulphate) are already numerically ppm.
            return ['min' => (float) $thresh['min'], 'max' => (float) $thresh['max']];
        }

        if ($thresh['axis'] === 'proportion' && $thresh['unit'] === '%BS') {
            if ($cec === null) {
                return null;
            }
            $min = self::pctBSToPpm((float) $thresh['min'], $cec, $nutrient);
            $max = self::pctBSToPpm((float) $thresh['max'], $cec, $nutrient);
            return ($min === null || $max === null) ? null : ['min' => $min, 'max' => $max];
        }

        // physical / mass-ratio / pH axes aren't nutrient sufficiency ranges.
        return null;
    }

    private static function meq100gToPpm(float $meq100g, string $cation): ?float
    {
        $factor = self::CONVERSION_FACTORS[$cation] ?? null;
        return $factor === null ? null : $meq100g * $factor;
    }

    private static function pctBSToPpm(float $pctBS, float $cec, string $cation): ?float
    {
        $factor = self::CONVERSION_FACTORS[$cation] ?? null;
        if ($factor === null || $cec <= 0) {
            return null;
        }
        $meq100g = ($pctBS / 100) * $cec;
        return $meq100g * $factor;
    }

    /** @return array<string, mixed> */
    private static function sampleTypes(): array
    {
        if (self::$sampleTypes === null) {
            $path = resource_path('data/hill-labs-sample-types.json');
            $decoded = json_decode(file_get_contents($path), true);
            self::$sampleTypes = $decoded['sampleTypes'] ?? [];
        }
        return self::$sampleTypes;
    }
}
