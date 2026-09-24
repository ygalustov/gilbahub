<?php

namespace Tests\Feature;

use App\Support\AnalysisNotice;
use App\Support\AnalysisResults;
use App\Support\AnalysisResultSchema;
use Tests\TestCase;

/**
 * GH-667 (queue item 3ag) — THE SOIL SECTION IS EMPTY WHEN ITS OWN VERDICT SAYS
 * SO, AND THE OBJECT BEING NON-EMPTY NO LONGER DECIDES.
 *
 * WHAT WAS WRONG, measured on the stand and not inferred: row 70 of `Test6 - UK`,
 * a site with no soil sample at all, carries a `soilNutrition` of SEVENTEEN keys,
 * `verdict: "NO DATA"`, every `actual` a dash, `pH`/`CEC`/`ECe`/`soilNa` null —
 * and `producedSomething` answered "produced", so `section('soilNutrition')`
 * returned null while the screen showed NO DATA. Translating the soil page today
 * would have made it draw numbers that are not there.
 *
 * WHY THE CASES PRINT THE LIST OF `actual` AND NOT ITS LENGTH — the reviewer's
 * condition, and my own measurement is the reason it was corrected: `nutrients`
 * has TEN entries in the empty row and TEN in the filled one. Counting the cards
 * distinguishes nothing, and a fix keyed on `nutrients: []` would have passed every
 * mutation while being wrong on all 35 live rows. `["-","-",…]` against
 * `[45,12,…]` distinguishes.
 *
 * THE DEVICE IS THE ANALYST'S (her 4.13e/4.13zh): the marker is declared in the
 * result form, one shape for any section, and the server reads it. No rule about
 * soil lives in the composer, and no count of readings lives anywhere.
 *
 * THE FORMS ARE BUILT HERE, never taken from a live site: the state that makes
 * this visible exists today but it is a coincidence, and the next press changes it.
 */
class Gh667TheSoilSectionIsEmptyWhenItsVerdictSaysSoTest extends TestCase
{
    /**
     * The shape the producer writes, with the seventeen keys of the live row.
     * `$measured` decides only what is INSIDE the cards and the scalars — the shape
     * is identical either way, which is the whole point.
     */
    private function soilNutrition(bool $measured): array
    {
        $nutrients = [];
        foreach (['P', 'K', 'Ca', 'Mg', 'S', 'Fe', 'Mn', 'Zn', 'Cu', 'B'] as $i => $n) {
            $nutrients[] = $measured
                ? ['nutrient' => $n, 'actual' => (string) (40 + $i), 'status' => 'HIGH',
                    'statusClass' => 'high', 'mlsn' => '12.0-28.0', 'targetPpm' => 12,
                    'uptakePpm' => '0.0', 'recommendation' => 'Reduce/omit applications']
                : ['nutrient' => $n, 'actual' => '-', 'status' => 'NOT MEASURED',
                    'statusClass' => 'no-data', 'mlsn' => 12, 'targetPpm' => 0,
                    'uptakePpm' => 0, 'recommendation' => 'Not tested in this sample'];
        }

        return [
            'pH' => $measured ? 6.0 : null,
            'CEC' => $measured ? 11.2 : null,
            'ECe' => $measured ? 0.4 : null,
            'soilNa' => $measured ? 30 : null,
            'ratios' => [],
            'depthCm' => 10,
            'mulders' => [],
            'species' => 'browntopBent',
            'verdict' => $measured ? 'HIGH_RISK' : 'NO DATA',
            'turfType' => 'golf',
            'nutrients' => $nutrients,
            'sampleDate' => $measured ? '2025-07-31' : null,
            'validation' => [],
            'bulkDensity' => 1.4,
            'methodology' => 'mlsn',
            'sampleLabel' => $measured ? 'Green 1' : null,
            'annualDemand' => [],
        ];
    }

    private function projection(bool $measured): array
    {
        return [
            'computed' => ['soilNutrition' => $this->soilNutrition($measured)],
            'numbersRun' => ['outcome' => 'complete', 'skipped' => [], 'notApplicable' => [],
                'notes' => [], 'assumptions' => []],
        ];
    }

    /** What the reviewer asked to see printed: the readings, one by one. */
    private function say(string $label, array $block): void
    {
        $actuals = array_map(fn (array $c) => $c['actual'], $block['nutrients']);
        fwrite(STDOUT, PHP_EOL.'[gh667] '.$label.PHP_EOL
            .'[gh667]    verdict: '.json_encode($block['verdict'])
            .' | scalars: pH='.json_encode($block['pH']).' CEC='.json_encode($block['CEC'])
            .' ECe='.json_encode($block['ECe']).' soilNa='.json_encode($block['soilNa']).PHP_EOL
            .'[gh667]    actual per card: '.json_encode($actuals).PHP_EOL
            .'[gh667]    (both rows carry '.count($block['nutrients']).' cards — the count '
            .'distinguishes nothing)'.PHP_EOL);
    }

    public function test_the_two_forms_differ_in_their_readings_and_not_in_their_shape(): void
    {
        // POSITIVE CONTROL ON THE FIXTURES THEMSELVES, before any claim: if the two
        // differed in shape, every case below would be about the wrong difference.
        $empty = $this->soilNutrition(false);
        $filled = $this->soilNutrition(true);
        $this->say('the EMPTY form, as the producer writes it for a site with no sample', $empty);
        $this->say('the FILLED form, same site, a run with a sample', $filled);

        $this->assertSame(array_keys($empty), array_keys($filled));
        $this->assertCount(17, $empty);
        $this->assertCount(10, $empty['nutrients']);
        $this->assertCount(10, $filled['nutrients']);
        // and the difference is the readings
        $this->assertSame(['-'], array_values(array_unique(
            array_map(fn (array $c) => $c['actual'], $empty['nutrients']))));
        $this->assertNotContains('-', array_map(fn (array $c) => $c['actual'], $filled['nutrients']));
    }

    public function test_P1_the_PREDICATE_calls_the_NO_DATA_form_empty(): void
    {
        // ASKED OF THE PREDICATE, not of the composer, and that is deliberate: it is
        // what tells this case apart from M5. A mutation of the predicate reddens
        // both (M5 is the whole road and the road runs through here); a mutation of
        // the COMPOSER reddens M5 alone. Two layers, two subjects, and the
        // difference is visible in which of them goes red.
        $verdict = AnalysisResults::producedSomething($this->soilNutrition(false), 'soilNutrition');
        fwrite(STDOUT, '[gh667] P-1 the predicate on the empty form says produced='
            .json_encode($verdict).PHP_EOL);

        $this->assertFalse($verdict, 'the form with NO DATA was reported as produced');
    }

    public function test_P3_the_PREDICATE_calls_the_filled_form_produced(): void
    {
        // The control for P-1, differing from it in the verdict alone — so a repair
        // that answers "always empty" passes P-1 and fails here.
        $verdict = AnalysisResults::producedSomething($this->soilNutrition(true), 'soilNutrition');
        fwrite(STDOUT, '[gh667] P-3 the predicate on the filled form says produced='
            .json_encode($verdict).PHP_EOL);

        $this->assertTrue($verdict, 'a form with measured readings was reported as empty');
    }

    public function test_the_marker_is_declared_in_the_result_form_and_read_from_there(): void
    {
        // P-2: no condition about soil in the composer; the form declares it and the
        // server reads it. Asked of the declaration rather than of a copy.
        $this->assertSame(['verdict' => 'NO DATA'], AnalysisResultSchema::emptyWhen('soilNutrition'));
        // A section that declares no marker is untouched, so the marker cannot
        // quietly become a rule for everything.
        $this->assertNull(AnalysisResultSchema::emptyWhen('waterBalance'));
    }

    /**
     * GH-667 — A COMBINED CASE OVER ALL FIVE BRANCHES STOOD HERE AND IS REMOVED.
     *
     * It asserted the five branches in one test, so EVERY branch mutation reddened
     * two cases — the combined one and the branch's own — and the reviewer's form
     * is that each mutation must redden exactly one, or the red cannot be
     * attributed. Measured: with it, all five mutations reddened 2; without it,
     * each reddens 1. The five branches keep their own cases below.
     */

    public function test_M3_null_is_absent(): void
    {
        $this->assertFalse(AnalysisResults::producedSomething(null, 'soilNutrition'));
    }

    public function test_M3_an_engine_error_is_absent(): void
    {
        $this->assertFalse(AnalysisResults::producedSomething(['status' => 'Error'], 'soilNutrition'));
    }

    public function test_M3_not_available_is_absent(): void
    {
        $this->assertFalse(AnalysisResults::producedSomething(['status' => 'Not available'], 'soilNutrition'));
    }

    public function test_M3_an_empty_array_is_absent(): void
    {
        $this->assertFalse(AnalysisResults::producedSomething([], 'soilNutrition'));
    }

    public function test_M3_a_scalar_that_is_not_null_is_present(): void
    {
        $this->assertTrue(AnalysisResults::producedSomething(0.4, 'soilNutrition'));
        // and a zero is a reading, not an absence
        $this->assertTrue(AnalysisResults::producedSomething(0, 'soilNutrition'));
    }

    public function test_M5_the_whole_road_the_section_phrase_says_it_was_not_computed(): void
    {
        // "Produced" against "drawn". Without this the hand-in would prove only that
        // a function changed its answer: the subject of the item is what the page is
        // told, and the page is told by `clientTexts`/`sections`.
        $sections = AnalysisNotice::sections($this->projection(false));
        fwrite(STDOUT, '[gh667] M5 sections for the empty form: '
            .json_encode($sections['soilNutrition'] ?? null).PHP_EOL);

        $this->assertArrayHasKey('soilNutrition', $sections);
        $this->assertNotNull($sections['soilNutrition']);

        // And for the filled one the page is told nothing about this section, or the
        // phrase would appear over numbers that are there.
        $filled = AnalysisNotice::sections($this->projection(true));
        fwrite(STDOUT, '[gh667] M5 sections for the filled form: '
            .json_encode($filled['soilNutrition'] ?? null).PHP_EOL);
        $this->assertNull($filled['soilNutrition'] ?? null);
    }
}
