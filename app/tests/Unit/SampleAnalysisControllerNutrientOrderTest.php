<?php

namespace Tests\Unit;

use App\Http\Controllers\SampleAnalysisController;
use ReflectionMethod;
use Tests\TestCase;

/**
 * Test GH-271 — nutrient card order/coverage no longer depends on a
 * sample's raw payload JSON key order or which nutrients that one sample
 * happened to have values for.
 *
 * BUG (two layers, found from a live report: "when i switch sample the
 * order of the cards is changing"):
 *  1. `run()` read `computed.soilNutrition` (the cached result of the last
 *     Re-run, with mlsnEngine()'s canonical P/K/Ca/Mg/S/Fe/Mn/Zn/Cu/B order
 *     and full 10-nutrient coverage) from the WRONG SiteConfig namespace
 *     ('gaip', which holds turf/location settings, not computed results --
 *     the real cache lives under 'analysis_cache', written by
 *     AnalysisCacheController::store()). $cachedSn was therefore always
 *     empty in this controller since it was written, silently forcing
 *     computeNutrients()'s "no cache" fallback on every single request.
 *     (Not unit-testable here without a real DB -- see the Feature-test
 *     caveat in this repo's other SampleAnalysisController test files,
 *     GH-261. This class covers the second, always-reachable layer below.)
 *  2. That fallback itself (still reachable for a genuinely brand-new site
 *     that has never had a Re-run) built its nutrient list from
 *     `array_keys(array_intersect_key($payload, MLSN_DEFAULTS))` --
 *     preserving the sample's raw JSON payload key order (whatever order
 *     fields were entered/imported in, not a stable display order) and
 *     silently omitting any nutrient the sample had no value for. A live
 *     sample whose payload happened to store K before P produced
 *     `["K","P","Ca","Mg"]` (4 nutrients, K-first) instead of the expected
 *     canonical `["P","K","Ca","Mg","S","Fe","Mn","Zn","Cu","B"]` (10
 *     nutrients, P-first) that mlsnEngine()'s initial-load path always
 *     produces.
 */
class SampleAnalysisControllerNutrientOrderTest extends TestCase
{
    private function computeNutrients(array $payload, array $cachedSn): array
    {
        $controller = new SampleAnalysisController();
        $method = new ReflectionMethod(SampleAnalysisController::class, 'computeNutrients');
        $method->setAccessible(true);

        return $method->invoke($controller, $payload, [], $cachedSn, 'mlsn', 'sands', null);
    }

    public function test_empty_cache_fallback_uses_the_canonical_order_not_payload_key_order(): void
    {
        // Payload's own JSON key order is deliberately K-before-P (matching
        // the live report), to prove the fix doesn't just coincidentally
        // agree with a payload that happens to already be canonically ordered.
        $nutrients = $this->computeNutrients(
            ['K' => 199, 'P' => 25, 'Ca' => 400, 'Mg' => 60],
            [] // empty cache -> fallback branch
        );

        $order = array_map(fn ($n) => $n['nutrient'], $nutrients);
        $this->assertSame(['P', 'K', 'Ca', 'Mg', 'S', 'Fe', 'Mn', 'Zn', 'Cu', 'B'], $order);
    }

    public function test_empty_cache_fallback_includes_all_ten_nutrients_not_only_ones_present_in_payload(): void
    {
        $nutrients = $this->computeNutrients(
            ['K' => 199, 'P' => 25, 'Ca' => 400, 'Mg' => 60], // only 4 of 10 tested
            []
        );

        $this->assertCount(10, $nutrients);
        $s = current(array_filter($nutrients, fn ($n) => $n['nutrient'] === 'S'));
        $this->assertNotFalse($s);
        // Same "not measured" shape mlsnEngine() produces for an untested nutrient.
        $this->assertNull($s['actual']);
        $this->assertSame('No data', $s['status']);
        $this->assertSame('no-data', $s['statusClass']);
    }

    public function test_present_cache_is_used_as_is_and_still_wins_over_the_fallback(): void
    {
        // When $cachedSn genuinely has a nutrients array (the correct-
        // namespace case, once the run()-level fix applies), that shape is
        // used verbatim -- this pins that the fallback branch's new
        // canonical-order logic doesn't leak into the "cache present" path.
        $nutrients = $this->computeNutrients(
            ['K' => 199],
            ['nutrients' => [['nutrient' => 'K', 'mlsn' => 37]]]
        );

        $this->assertCount(1, $nutrients);
        $this->assertSame('K', $nutrients[0]['nutrient']);
    }
}
