<?php

namespace Tests\Unit;

use App\Http\Controllers\SampleAnalysisController;
use ReflectionMethod;
use Tests\TestCase;

/**
 * GH-304 (D07 item 7, "label, don't remove" decision, 2026-08-24) —
 * computeNutrients()'s AA branch now tags each nutrient result with
 * rangeSource ('certificate' | 'texture-fallback'), mirroring
 * hub-tissue-v3.js's aaRangeSource tagging (also GH-304). This is the server
 * side of the same tag: SampleAnalysisController.php is a second, independent
 * live path for the Soil page (reached via the sample-switcher dropdown,
 * GH-262/268) and must agree with mlsnEngine() on which nutrients are
 * certificate-backed vs generic, not just on the numbers themselves.
 *
 * Uses the same reflection approach as SampleAnalysisControllerComputeNutrientsTest
 * (computeNutrients() touches no database; RefreshDatabase Feature tests are
 * blocked by the pre-existing SQLite gap documented in GH-261).
 */
class SampleAnalysisControllerRangeSourceTest extends TestCase
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

    public function test_certificate_matched_nutrient_is_tagged_certificate(): void
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
        $this->assertSame('certificate', $k['rangeSource']);
    }

    public function test_certificate_matched_site_with_unprinted_nutrient_is_tagged_texture_fallback(): void
    {
        // S277 (Ryegrass/Sand) resolves fine, but its certificate prints no
        // Sulphur range at all -- the exact live case (Hagley Oval, S: 75ppm)
        // that surfaced this gap. S must stay 'texture-fallback' even though
        // K/Ca/Mg/P on the SAME site resolve to 'certificate'.
        $nutrients = $this->computeNutrients(
            ['K' => 199, 'S' => 75, 'CEC' => 5],
            [],
            [],
            'ammonium_acetate',
            'sand',
            'perennialRyegrass'
        );

        $k = $this->findNutrient($nutrients, 'K');
        $s = $this->findNutrient($nutrients, 'S');
        $this->assertSame('certificate', $k['rangeSource']);
        $this->assertSame('texture-fallback', $s['rangeSource']);
        // S277 has no Sulphur threshold at all -- confirms the fallback
        // range shown really is the generic one, not a certificate value.
        $this->assertSame('30-60', $s['mlsn']);
    }

    public function test_uncovered_species_is_tagged_texture_fallback(): void
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
        $this->assertSame('texture-fallback', $k['rangeSource']);
    }

    public function test_pct_bs_axis_without_cec_falls_back_and_is_tagged_texture_fallback(): void
    {
        // getRangesPpm('S81','K') without CEC returns null -> even though a
        // code resolved, the overlay never fires for this nutrient.
        $nutrients = $this->computeNutrients(
            ['K' => 199], // no CEC in payload
            [],
            [],
            'ammonium_acetate',
            'loam',
            'tallFescue'
        );

        $k = $this->findNutrient($nutrients, 'K');
        $this->assertSame('texture-fallback', $k['rangeSource']);
    }

    public function test_mlsn_branch_never_gets_a_range_source_key(): void
    {
        $nutrients = $this->computeNutrients(
            ['K' => 45],
            ['K' => 37],
            [],
            'mlsn',
            'sand',
            'perennialRyegrass'
        );

        $k = $this->findNutrient($nutrients, 'K');
        $this->assertArrayNotHasKey('rangeSource', $k);
    }
}
