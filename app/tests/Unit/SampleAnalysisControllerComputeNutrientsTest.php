<?php

namespace Tests\Unit;

use App\Http\Controllers\SampleAnalysisController;
use ReflectionMethod;
use Tests\TestCase;

/**
 * Test GH-268 — SampleAnalysisController's AA branch now sources ranges from
 * the Hill Labs SSOT (D07 item 4), closing the dual-path gap GH-262 traced
 * back to this controller: mlsnEngine() (the Soil page's initial-load path)
 * and this endpoint (the sample-switcher path) previously disagreed for the
 * same sample because this controller had its own hardcoded AA_RANGES
 * constant and never resolved a certificate-backed sample-type code.
 *
 * Uses PHP reflection to call the private computeNutrients() directly,
 * deliberately avoiding Feature/HTTP-level testing here: this repo's
 * Feature tests (RefreshDatabase) currently fail on an unrelated,
 * pre-existing SQLite-incompatible migration (documented in GH-261) —
 * computeNutrients() itself touches no database, so reflection sidesteps
 * that gap entirely rather than waiting on it.
 */
class SampleAnalysisControllerComputeNutrientsTest extends TestCase
{
    private function computeNutrients(
        array $payload,
        array $thresholds,
        array $cachedSn,
        string $methodology,
        string $soilTexture,
        ?string $species
    ): array {
        $controller = new SampleAnalysisController();
        $method = new ReflectionMethod(SampleAnalysisController::class, 'computeNutrients');
        $method->setAccessible(true);

        return $method->invoke($controller, $payload, $thresholds, $cachedSn, $methodology, $soilTexture, $species);
    }

    private function findNutrient(array $nutrients, string $nut): ?array
    {
        foreach ($nutrients as $n) {
            if (($n['nutrient'] ?? null) === $nut) {
                return $n;
            }
        }
        return null;
    }

    // -------------------------------------------------------------------------
    // Certificate-backed overlay
    // -------------------------------------------------------------------------

    public function test_certificate_backed_species_overlays_the_texture_only_range(): void
    {
        $nutrients = $this->computeNutrients(
            ['K' => 199, 'CEC' => 5],
            [],
            [],
            'ammonium_acetate',
            'sand',
            'perennialRyegrass'
        );

        $k = $this->findNutrient($nutrients, 'K');
        $this->assertNotNull($k);
        // Certificate S277 range (78.2-195.5), not the texture-only "sands" fallback (75-175).
        $this->assertSame('78.2-195.5', $k['mlsn']);
        $this->assertEqualsWithDelta(78.2, $k['rangeMin'], 0.01);
        $this->assertEqualsWithDelta(195.5, $k['rangeMax'], 0.01);
        $this->assertSame('High', $k['status']);
        $this->assertSame('high', $k['statusClass']);
    }

    public function test_raw_species_label_resolves_the_same_certificate_as_the_canonical_key(): void
    {
        // Controller reads turf.species straight from site_configs.config,
        // which stores raw labels ("Perennial Ryegrass"), not canonical keys.
        $nutrients = $this->computeNutrients(
            ['K' => 199, 'CEC' => 5],
            [],
            [],
            'ammonium_acetate',
            'sand',
            'Perennial Ryegrass'
        );

        $k = $this->findNutrient($nutrients, 'K');
        $this->assertSame('78.2-195.5', $k['mlsn']);
        $this->assertSame('High', $k['status']);
    }

    public function test_pct_bs_axis_certificate_range_uses_cec(): void
    {
        // S81 (Fescue) reports K on the %BS axis -- needs CEC to convert.
        $nutrients = $this->computeNutrients(
            ['K' => 300, 'CEC' => 18],
            [],
            [],
            'ammonium_acetate',
            'loam',
            'tallFescue'
        );

        $k = $this->findNutrient($nutrients, 'K');
        // 2.0%BS of CEC18 = 0.36 me/100g * 391 = 140.76; 6.0%BS = 1.08 * 391 = 422.28
        $this->assertEqualsWithDelta(140.76, $k['rangeMin'], 0.5);
        $this->assertEqualsWithDelta(422.28, $k['rangeMax'], 0.5);
        $this->assertSame('Sufficient', $k['status']);
    }

    public function test_pct_bs_axis_without_cec_falls_back_to_texture_only_range(): void
    {
        $nutrients = $this->computeNutrients(
            ['K' => 199], // no CEC in payload
            [],
            [],
            'ammonium_acetate',
            'loam',
            'tallFescue'
        );

        $k = $this->findNutrient($nutrients, 'K');
        // getRangesPpm('S81','K') without CEC returns null -> AA_RANGES 'others' fallback.
        $this->assertSame('100-235', $k['mlsn']);
        $this->assertEqualsWithDelta(100, $k['rangeMin'], 0.01);
        $this->assertEqualsWithDelta(235, $k['rangeMax'], 0.01);
    }

    // -------------------------------------------------------------------------
    // Graceful degradation — uncovered species, unchanged from pre-GH-268
    // -------------------------------------------------------------------------

    public function test_uncovered_species_keeps_the_texture_only_fallback_unchanged(): void
    {
        $nutrients = $this->computeNutrients(
            ['K' => 150],
            [],
            [],
            'ammonium_acetate',
            'sand',
            'kikuyu'
        );

        $k = $this->findNutrient($nutrients, 'K');
        // AA_RANGES 'sands' fallback (75-175), whole-number format, unchanged from before this fix.
        // K=150 sits within that range -> Sufficient (this is a "code unchanged" pin, not a status check).
        $this->assertSame('75-175', $k['mlsn']);
        $this->assertSame(75, $k['rangeMin']);
        $this->assertSame(175, $k['rangeMax']);
        $this->assertSame('Sufficient', $k['status']);
    }

    public function test_no_species_at_all_keeps_the_texture_only_fallback(): void
    {
        $nutrients = $this->computeNutrients(
            ['K' => 150],
            [],
            [],
            'ammonium_acetate',
            'sand',
            null
        );

        $k = $this->findNutrient($nutrients, 'K');
        $this->assertSame('75-175', $k['mlsn']);
    }

    // -------------------------------------------------------------------------
    // Regression — MLSN/SLAN branch untouched by any of this
    // -------------------------------------------------------------------------

    public function test_mlsn_branch_is_byte_identical_regardless_of_species_argument(): void
    {
        $withSpecies = $this->computeNutrients(
            ['K' => 45],
            ['K' => 37],
            [],
            'mlsn',
            'sand',
            'perennialRyegrass'
        );
        $withoutSpecies = $this->computeNutrients(
            ['K' => 45],
            ['K' => 37],
            [],
            'mlsn',
            'sand',
            null
        );

        $this->assertSame($withSpecies, $withoutSpecies);
        $k = $this->findNutrient($withSpecies, 'K');
        $this->assertSame('37', $k['mlsn']);
        $this->assertArrayNotHasKey('rangeMin', $k);
        $this->assertArrayNotHasKey('rangeMax', $k);
    }
}
