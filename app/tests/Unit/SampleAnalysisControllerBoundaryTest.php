<?php

namespace Tests\Unit;

use App\Http\Controllers\SampleAnalysisController;
use ReflectionMethod;
use Tests\TestCase;

/**
 * Test GH-276 — SampleAnalysisController's AA upper-bound comparison now
 * matches mlsnEngine()'s (hub-tissue-v3.js) exactly.
 *
 * Found while manually re-verifying GH-275's fix on a real site (Russley,
 * S279): the JS classification (`actualPPM <= range.hi` -> SUFFICIENT) and
 * this controller's (`$actual < $medCeil` -> Sufficient) disagreed at the
 * exact upper boundary -- a value landing precisely on the certificate's
 * ceiling classified as High via this endpoint (sample-switch path) but
 * Sufficient via mlsnEngine() (Re-run path). None of Russley's actual test
 * values happened to land exactly on a boundary, so this narrower
 * disagreement wasn't caught by GH-275's live verification -- only by
 * re-deriving the classification logic from both files' source directly.
 * Same class of bug as the whole GH-268-275 chain (two independent
 * implementations of what should be one comparison), just one boundary
 * condition instead of a whole missing data source.
 *
 * FIX: changed `$actual < $medCeil` to `$actual <= $medCeil`, so a value
 * exactly on the upper bound is Sufficient on both paths. Lower bound
 * (`$actual < $lowCeil` -> Low) already matched the JS side and is
 * untouched.
 */
class SampleAnalysisControllerBoundaryTest extends TestCase
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

    public function test_value_exactly_on_the_upper_bound_is_sufficient_not_high(): void
    {
        // S277 (perennialRyegrass+sand) K range is 78.2-195.5ppm (certificate
        // 0.20-0.50 me/100g x391). 195.5 sits exactly on the ceiling.
        $nutrients = $this->computeNutrients(
            ['K' => 195.5, 'CEC' => 5],
            [],
            [],
            'ammonium_acetate',
            'sand',
            'perennialRyegrass'
        );

        $k = $this->findNutrient($nutrients, 'K');
        $this->assertSame('Sufficient', $k['status']);
        $this->assertSame('adequate', $k['statusClass']);
    }

    public function test_value_just_above_the_upper_bound_is_still_high(): void
    {
        $nutrients = $this->computeNutrients(
            ['K' => 195.51, 'CEC' => 5],
            [],
            [],
            'ammonium_acetate',
            'sand',
            'perennialRyegrass'
        );

        $k = $this->findNutrient($nutrients, 'K');
        $this->assertSame('High', $k['status']);
    }

    public function test_value_exactly_on_the_lower_bound_is_sufficient_unchanged(): void
    {
        // Lower-bound comparison (< lowCeil -> Low) was never wrong -- this
        // pins it stayed that way after the upper-bound fix.
        $nutrients = $this->computeNutrients(
            ['K' => 78.2, 'CEC' => 5],
            [],
            [],
            'ammonium_acetate',
            'sand',
            'perennialRyegrass'
        );

        $k = $this->findNutrient($nutrients, 'K');
        $this->assertSame('Sufficient', $k['status']);
    }

    public function test_value_just_below_the_lower_bound_is_still_low(): void
    {
        $nutrients = $this->computeNutrients(
            ['K' => 78.19, 'CEC' => 5],
            [],
            [],
            'ammonium_acetate',
            'sand',
            'perennialRyegrass'
        );

        $k = $this->findNutrient($nutrients, 'K');
        $this->assertSame('Low', $k['status']);
    }
}
