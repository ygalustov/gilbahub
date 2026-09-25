<?php

namespace Tests\Feature;

use App\Support\AnalysisResults;
use Tests\TestCase;

/**
 * GH-704 (queue item 3as) — THE SERVER'S COPY OF THE PRODUCED PREDICATE, ASKED THE SAME TABLE.
 *
 * Three copies decide whether a pass produced a result: this one and two in the browser. The browser
 * pair is asked the same questions in `tests/gh704-three-copies-of-the-produced-predicate.test.js`,
 * from the same fixture file, so each copy is compared with a DECLARED INPUT rather than with another
 * copy of ours — two surfaces that drifted together agree, and that agreement says nothing.
 *
 * WHY THIS COMES BEFORE THE REPAIR: the three are said to agree, and if they do, repairing one moves
 * nothing any run can see. The answers are printed first and then held.
 *
 * AND THE SERVER'S COPY ASKS ONE MORE THING, which is why it is not simply the same function in
 * another language: it takes a KEY and consults the result form's own `emptyWhen` marker. That part
 * is about the REASON a section is empty, and the analyst's plan says this item does not consolidate
 * the reason — so the printed answers name where the three can differ by design, instead of leaving
 * it to be discovered by whoever repairs one of them.
 */
class Gh704TheServerCopyOfTheProducedPredicateTest extends TestCase
{
    /** @return array<string,mixed> */
    private function table(): array
    {
        $file = base_path('tests/fixtures/gh704-produced-predicate-inputs.json');
        $this->assertFileExists($file, 'the one input table is gone, and nothing below is a comparison');

        return json_decode((string) file_get_contents($file), true);
    }

    public function test_the_server_copy_answers_every_input_of_the_one_table(): void
    {
        $table = $this->table();
        $rows = [];
        foreach ($table['cases'] as $case) {
            $rows[] = [
                'name' => $case['name'],
                'answer' => AnalysisResults::producedSomething($case['value'], $case['key']),
            ];
        }
        fwrite(STDOUT, PHP_EOL.'[gh704] what the server copy answers:'.PHP_EOL);
        foreach ($rows as $r) {
            fwrite(STDOUT, '[gh704]   '.str_pad($r['name'], 44).' server='.json_encode($r['answer']).PHP_EOL);
        }

        // The universe is real: a table that shrank would make every answer below vacuous.
        $this->assertGreaterThan(10, count($rows));

        /**
         * AGAINST THE DECLARED ANSWER, not against the browser copies. Two surfaces compared with
         * each other agree all the way down; each compared with the table reddens on its own. The
         * one deliberate difference has its own field, so it is declared rather than excused.
         */
        $wrong = [];
        foreach ($table['cases'] as $case) {
            $answer = AnalysisResults::producedSomething($case['value'], $case['key']);
            $declared = array_key_exists('expectedFromTheServerWithTheKey', $case) && $case['key'] !== null
                ? $case['expectedFromTheServerWithTheKey']
                : $case['expected'];
            if ($answer !== $declared) {
                $wrong[] = $case['name'].': declared '.json_encode($declared).', got '.json_encode($answer);
            }
        }
        $this->assertSame([], $wrong);
    }

    public function test_where_the_server_copy_answers_MORE_than_the_browser_ones_by_design(): void
    {
        /**
         * The one input built to separate them: a shape whose own verdict says it is empty. The
         * browser copies have no notion of a verdict and answer `true`; the server consults the
         * result form's marker for that key and answers `false`.
         *
         * THAT IS NOT A DRIFT AND IT IS NOT CONSOLIDATED HERE. It is the REASON a section is empty,
         * which the plan for this item excludes in as many words. Recorded as a case so the next
         * person to "make the three agree" finds out from a test that one of the differences is
         * deliberate, instead of deleting it.
         */
        // The value is the one the FORM DECLARES, read from it rather than invented: the first
        // version of this case wrote `no-soil-data`, which matches no marker, so the key changed
        // nothing and the case failed on a value of mine rather than on the predicate.
        $declared = \App\Support\AnalysisResultSchema::emptyWhen('soilNutrition');
        $withVerdict = array_merge($declared ?? [], ['nutrients' => [1, 2, 3]]);

        $withoutKey = AnalysisResults::producedSomething($withVerdict, null);
        $withKey = AnalysisResults::producedSomething($withVerdict, 'soilNutrition');
        fwrite(STDOUT, '[gh704] the same shape, no key -> '.json_encode($withoutKey)
            .' | with the key -> '.json_encode($withKey).PHP_EOL);

        // Without a key it answers like the browser pair: the shape is not empty.
        $this->assertTrue($withoutKey);
        // The marker is what makes the difference, and the difference is only asked for with a key.
        $marker = \App\Support\AnalysisResultSchema::emptyWhen('soilNutrition');
        fwrite(STDOUT, '[gh704] the form declares the marker: '.json_encode($marker).PHP_EOL);
        if ($marker === null) {
            $this->assertTrue($withKey, 'no marker is declared for this key, so the key changes nothing');

            return;
        }
        $this->assertFalse($withKey, 'the form declares a marker for this key and the predicate ignored it');
    }
}
