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
    private function computeNutrients(array $payload): array
    {
        $controller = new SampleAnalysisController();
        $method = new ReflectionMethod(SampleAnalysisController::class, 'computeNutrients');
        $method->setAccessible(true);

        // GH-546: `$thresholds` and `$cachedSn` no longer
        // reach the controller — it classifies against the canonical MLSN table
        // and reads no analysis cache at all. The helper used to keep an unused
        // `$cachedSn` parameter, which made this file read as though a cache
        // were still being handed over somewhere.
        return $method->invoke($controller, $payload, 'mlsn', 'sands', null);
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

    /**
     * GH-546 — this test's subject is gone, and it is
     * replaced rather than deleted, because the replacement says the thing the
     * change is FOR.
     *
     * It used to assert that a cached nutrient list "wins over the fallback":
     * when the site's last browser run had produced a list, the server answered
     * with that list rather than with the canonical one. That is the dependency
     * GH-546 removes — the server building its answer out of whatever a
     * browser last posted — so there is no longer a path for a cache to win.
     *
     * What is asserted instead is the consequence: a cached list cannot change
     * the answer, because the controller no longer takes one. The old inputs are
     * handed over unchanged and the result is the canonical ten in canonical
     * order, not the one nutrient the cache named.
     */
    public function test_a_cached_nutrient_list_can_no_longer_be_handed_to_the_method(): void
    {
        // GH-546 review, and the correction is mine: the first version of this
        // test called computeNutrients(['K' => 199]) with no cache at all and
        // then said in a comment that "the cache said one nutrient, K". Nothing
        // handed a cache to anything. It measured what
        // test_empty_cache_fallback_includes_all_ten_nutrients... already
        // measures, and the claim in its name rested on the comment.
        //
        // What makes "a cached list can no longer change the answer" true is the
        // SIGNATURE: there is no longer a parameter to put one in. That is what
        // is asserted here, by asking the method itself.
        $method = new ReflectionMethod(SampleAnalysisController::class, 'computeNutrients');
        $names  = array_map(fn ($p) => $p->getName(), $method->getParameters());

        $this->assertNotContains('cachedSn', $names,
            'computeNutrients still accepts a cached result; the server can be handed '
            .'what a browser last computed, which is the dependency GH-546 removes.');
        $this->assertNotContains('thresholds', $names,
            'computeNutrients still accepts a threshold override; the canonical MLSN '
            .'table is meant to be the only one it classifies against.');

        // And the parameters it does take are the sample's own facts and its site's settings.
        // GH-752: `slanSoilType` is the site's soil type, resolved from its construction by the
        // construction dictionary -- a setting, not a threshold handed in.
        $this->assertSame(['payload', 'methodology', 'soilTexture', 'species', 'slanSoilType'], $names);
    }
}
