<?php

namespace Tests\Feature;

use App\Support\AnalysisNotice;
use Tests\TestCase;

/**
 * GH-639 (link 11, plan 4.13 point 3 / 4.13b) — ONE SENTENCE PER EMPTY SECTION,
 * BUILT ON THE SERVER FROM THE ROW WHOSE NUMBERS ARE ON SCREEN.
 *
 * WHAT IS ASSERTED, and it is the plan's own instruction for this stage: the
 * CLASS of the cause and the PLACE it came from, never an English phrase. The
 * words belong to the owner and are still open, so a test comparing them would
 * have to be rewritten the day she answers — and would fail for a reason that
 * has nothing to do with the device.
 *
 * THE STEP MAP IS READ FROM THE GRAPH, not restated here. The companion set
 * `gh639-the-step-comes-from-the-graph.test.js` parses the same file in
 * JavaScript and compares the two enumerations in both directions.
 */
class Gh639SectionSentenceTest extends TestCase
{
    /** A projection shaped as `AnalysisResults::project()` builds it. */
    private function projection(array $computed, array $numbersRun = [], ?array $lastRun = null): array
    {
        return [
            'metrics' => [],
            'computed' => $computed,
            'analyzedAt' => '2026-09-24T00:00:00.000Z',
            'lastRun' => $lastRun,
            'status' => 'complete',
            'numbersFrom' => 'complete',
            'numbersRun' => array_merge(
                ['outcome' => 'complete', 'skipped' => [], 'notApplicable' => [], 'notes' => [], 'assumptions' => []],
                $numbersRun
            ),
        ];
    }

    public function test_a_section_that_has_numbers_gets_no_sentence_at_all(): void
    {
        $p = $this->projection(['pgr' => ['gdd' => 120, 'success' => true]]);
        $this->assertNull(AnalysisNotice::section('pgr', $p));
    }

    public function test_the_server_predicate_decides_emptiness_and_not_the_page(): void
    {
        // `/plan` calls `computed.pgr` without `gdd` empty; the server calls it
        // produced. One answer now, and it is the server's — the difference is
        // the whole of plan 4.13b point 2.
        $p = $this->projection(['pgr' => ['success' => false]]);
        $this->assertNull(AnalysisNotice::section('pgr', $p),
            'the page-style condition came back — two readers of one question');

        // and the shapes the server does call empty
        foreach ([null, [], ['status' => 'Error'], ['status' => 'Not available']] as $shape) {
            $this->assertNotNull(AnalysisNotice::section('pgr', $this->projection(['pgr' => $shape])));
        }
    }

    public function test_a_skipped_step_gives_the_class_of_its_code_and_the_module_name_from_the_one_vocabulary(): void
    {
        // `no-soil-sample` is `input-absent`: a second press cannot help, and the
        // sentence must not offer one.
        $p = $this->projection(
            ['pgr' => null],
            ['skipped' => [['step' => 'pgr', 'reason' => 'no-soil-sample']]]
        );
        $out = AnalysisNotice::section('pgr', $p);
        fwrite(STDOUT, PHP_EOL.'[gh639] skipped -> '.json_encode($out).PHP_EOL);

        $this->assertSame('no-soil-sample', $out['cause']);
        $this->assertSame('input-absent', $out['class']);
        $this->assertFalse($out['retry']);
        // The module's word comes from `STEP_NAMES`, the same vocabulary the
        // panel speaks; no second dictionary.
        $this->assertSame('PGR', $out['module']);
        $this->assertNotNull($out['text']);
    }

    public function test_a_run_incomplete_code_offers_the_press_and_says_so_through_its_class(): void
    {
        $p = $this->projection(
            ['pgr' => null],
            ['skipped' => [['step' => 'pgr', 'reason' => 'soil-sample-not-loaded']]]
        );
        $out = AnalysisNotice::section('pgr', $p);

        $this->assertSame('run-incomplete', $out['class']);
        $this->assertTrue($out['retry']);
    }

    public function test_a_journal_note_reaches_the_sentence_although_the_panel_never_prints_it(): void
    {
        // GH-573's `continue` keeps `info` out of the panel. This is the door
        // those entries reach a sentence by, and it is why that `continue` does
        // not have to be removed.
        $p = $this->projection(
            ['pgr' => null],
            ['notes' => [['level' => 'info', 'step' => 'pgr', 'data' => ['reason' => 'engine-produced-nothing']]]]
        );
        $out = AnalysisNotice::section('pgr', $p);
        fwrite(STDOUT, '[gh639] note -> '.json_encode($out).PHP_EOL);

        $this->assertSame('engine-produced-nothing', $out['cause']);
        $this->assertNotNull($out['text']);
    }

    public function test_the_sentence_is_about_the_numbers_on_screen_and_not_about_the_last_attempt(): void
    {
        // The case the analyst's finding is about: numbers from a complete run
        // with a recorded cause, and a later attempt that failed for another
        // reason entirely. Reading `lastRun` here would describe the attempt
        // while standing under the figures of the other row.
        $p = $this->projection(
            ['pgr' => null],
            ['skipped' => [['step' => 'pgr', 'reason' => 'no-soil-sample']]],
            ['outcome' => 'failed', 'reason' => 'weather-unavailable']
        );
        $out = AnalysisNotice::section('pgr', $p);

        $this->assertSame('no-soil-sample', $out['cause'], 'the sentence took the attempt’s reason');
        $this->assertNotSame('weather-unavailable', $out['cause']);
    }

    public function test_an_empty_section_with_nothing_recorded_is_not_recorded_and_carries_no_invented_phrase(): void
    {
        // The honest fifth class. The words for it are the owner's; this returns
        // the fact and no sentence of mine.
        $p = $this->projection(['pgr' => null]);
        $out = AnalysisNotice::section('pgr', $p);
        fwrite(STDOUT, '[gh639] nothing recorded -> '.json_encode($out).PHP_EOL);

        $this->assertNull($out['cause']);
        $this->assertSame('not-recorded', $out['class']);
        $this->assertNull($out['text']);
        $this->assertFalse($out['retry']);
    }

    public function test_which_consumer_keys_the_graph_resolves_and_which_it_does_not_is_printed_rather_than_assumed(): void
    {
        // THE BOUNDARY, MEASURED AND NAMED. Of the consumer keys the schema
        // declares, the graph resolves those written by a graph node; the rest
        // are assembled by the row's producer and have no step, so their section
        // answers `not-recorded`. That is a gap to be closed deliberately, not
        // filled with a guess here, and it is printed so it cannot be forgotten.
        $schema = json_decode((string) file_get_contents(base_path('../assets/analysis-result.schema.json')), true);
        $consumers = $schema['computed']['readByConsumers'] ?? [];
        $this->assertGreaterThan(10, count($consumers));

        $withStep = [];
        $withoutStep = [];
        foreach ($consumers as $key) {
            $out = AnalysisNotice::section($key, $this->projection([$key => null]));
            if ($out['step'] === null) {
                $withoutStep[] = $key;
            } else {
                $withStep[] = $key;
            }
        }
        fwrite(STDOUT, '[gh639] consumer keys with a step from the graph ('.count($withStep).'): '
            .implode(' ', $withStep).PHP_EOL);
        fwrite(STDOUT, '[gh639] consumer keys with NO step, answering not-recorded ('.count($withoutStep).'): '
            .implode(' ', $withoutStep).PHP_EOL);

        // The subject is real: the map resolved something.
        $this->assertContains('pgr', $withStep);
        $this->assertContains('wear', $withStep);
        // and the gap is what it was measured to be
        // GH-641 closed most of what this used to list. What remains, and why
        // each one is honest rather than unfinished:
        //  - `applicationWindow` and `soilTempPhysics` are declared
        //    `assembledFrom: []` — no step stands behind them, measured: the
        //    first appears in none of the 66 stored rows, the second is computed
        //    while a panel is drawn. `not-recorded` is the truth about them.
        //  - `tissue`: its engine is `tissue-engine` and the run warns under
        //    `tissue-corrective`, a spelling neither declared source derives from
        //    the other. Named here rather than papered over.
        $this->assertSame(['applicationWindow', 'soilTempPhysics', 'tissue'], $withoutStep);
        // and the key link 11 exists for is resolved now
        $this->assertContains('soilNutrition', $withStep);
    }



    public function test_THE_CONTROL_CASE_the_soil_section_names_the_absent_sample_instead_of_saying_nothing_was_recorded(): void
    {
        // The analyst's own control for closing the gap (4.13v): a row with no
        // `soilNutrition` and `no-soil-sample` recorded against the `mlsn` step.
        // Before GH-641 this answered `not-recorded` — "the cause was not
        // recorded" printed over a row that records it, which is the untruth this
        // work exists to remove.
        $p = $this->projection(
            ['climate' => ['ok' => true]],
            ['skipped' => [['step' => 'mlsn', 'reason' => 'no-soil-sample']]]
        );
        $out = AnalysisNotice::section('soilNutrition', $p);
        fwrite(STDOUT, '[gh641] soilNutrition -> '.json_encode($out).PHP_EOL);

        $this->assertSame('no-soil-sample', $out['cause']);
        $this->assertSame('input-absent', $out['class']);
        $this->assertFalse($out['retry']);
        $this->assertSame('MLSN', $out['module']);
        // No new words were needed: the sentence was already in the reasons table.
        $this->assertStringContainsString('no soil sample', $out['text']);
    }

    public function test_every_declared_consumer_key_resolves_by_one_declared_path_or_is_declared_to_have_none(): void
    {
        // Equality in both directions, over the declarations themselves:
        //  - a key that resolves to no step and is not declared `assembledFrom`
        //    is a hole in the declarations, and this names it;
        //  - a step named in `assembledFrom` that the run's vocabulary does not
        //    know is a name nobody warns under, and this names that too.
        $assembled = \App\Support\AnalysisResultSchema::assembledKeys();
        $names = new \ReflectionClass(AnalysisNotice::class);
        $stepNames = $names->getConstant('STEP_NAMES');

        $undeclared = [];
        foreach (\App\Support\AnalysisResultSchema::consumerKeys() as $key) {
            $out = AnalysisNotice::section($key, $this->projection([$key => null]));
            if ($out['step'] === null && ! array_key_exists($key, $assembled)) {
                $undeclared[] = $key;
            }
        }

        $unknownSteps = [];
        foreach ($assembled as $key => $steps) {
            foreach ($steps as $step) {
                if (! isset($stepNames[$step])) {
                    $unknownSteps[] = $key.' -> '.$step;
                }
            }
        }

        fwrite(STDOUT, '[gh641] keys with no step and no declaration: '.json_encode($undeclared).PHP_EOL);
        fwrite(STDOUT, '[gh641] assembling steps the run does not warn under: '.json_encode($unknownSteps).PHP_EOL);

        // `tissue` is the one hole, and it is a spelling rather than a missing
        // declaration — the boundary named in the case above.
        $this->assertSame(['tissue'], $undeclared);
        $this->assertSame([], $unknownSteps);
    }


    public function test_the_engine_rule_is_exercised_directly__and_its_boundary_is_named(): void
    {
        // FOUND BY MY OWN MUTATION, AND SAID OUT LOUD RATHER THAN LEFT GREEN.
        // Reading the step from the ENGINE (analyst 4.13v point 1) is one of the
        // two paths, and removing it reddens NOTHING today: every declared
        // consumer key is also resolved either by its own spelling or by
        // `assembledFrom`. So the rule has no case of its own in this tree yet —
        // it was asked for because the graph may name an engine whose key differs,
        // and that has not happened. The rule is therefore exercised HERE,
        // directly, so it is at least held to what it claims.
        $candidates = new \ReflectionMethod(AnalysisNotice::class, 'stepCandidates');
        $candidates->setAccessible(true);

        // `pgr-module` -> `pgr`; the engine's own spelling comes first, then the
        // suffix dropped, then the key.
        $this->assertSame(['pgr-module', 'pgr'], $candidates->invoke(null, 'pgr', 'pgr-module'));
        $this->assertSame(
            ['stress-trajectory-engine', 'stress-trajectory', 'stress', 'stressTrajectory'],
            $candidates->invoke(null, 'stressTrajectory', 'stress-trajectory-engine')
        );

        // The boundary, measured: today no declared key NEEDS this path. If one
        // ever does, the equality case above is what will say so.
        fwrite(STDOUT, '[gh641] the engine rule has no exclusive case in this tree today'.PHP_EOL);
    }


    public function test_PAIRING_the_class_is_derived_from_the_row_and_the_sentence_from_the_code_it_carries(): void
    {
        // The analyst's check 1 ("pairing"), which did not reach the code with the
        // rest of link 11. For each shape a row can record, the class is worked
        // out FROM THE ROW and the sentence is the one the reasons table holds for
        // the code the row carries. No English phrase is written in this case: the
        // expected text is read back from the table, so a rewording travels here
        // instead of breaking here.
        $reasons = (new \ReflectionClass(AnalysisNotice::class))->getConstant('REASONS');

        $rows = [
            // recorded as skipped, a fact about the site
            ['skipped' => [['step' => 'pgr', 'reason' => 'no-soil-sample']], 'expect' => 'no-soil-sample'],
            // recorded as skipped, a fact about this attempt
            ['skipped' => [['step' => 'pgr', 'reason' => 'soil-sample-not-loaded']], 'expect' => 'soil-sample-not-loaded'],
            // recorded as a journal note the panel never prints
            ['notes' => [['level' => 'info', 'step' => 'pgr', 'data' => ['reason' => 'engine-produced-nothing']]],
                'expect' => 'engine-produced-nothing'],
            // recorded as not applicable to this site at all
            ['notApplicable' => [['step' => 'pgr', 'reason' => 'no-soil-sample']], 'expect' => 'no-soil-sample'],
        ];

        foreach ($rows as $i => $row) {
            $expectCode = $row['expect'];
            unset($row['expect']);
            $out = AnalysisNotice::section('pgr', $this->projection(['pgr' => null], $row));

            $this->assertSame($expectCode, $out['cause'], 'row '.$i);
            $this->assertSame($reasons[$expectCode]['class'], $out['class'], 'row '.$i.': class not taken from the row');
            $this->assertSame($reasons[$expectCode]['text'], $out['text'], 'row '.$i.': sentence not taken from the table');
            // and the offer follows the class, not the code
            $this->assertSame(
                ! in_array($reasons[$expectCode]['class'], ['input-absent', 'setting-missing', 'answer'], true),
                $out['retry'],
                'row '.$i.': the offer to press again does not follow the class'
            );
        }
        fwrite(STDOUT, '[gh643] pairing checked over '.count($rows).' recorded shapes'.PHP_EOL);
    }

    public function test_BURNS_SHAPED_PGR_a_note_recorded_by_a_COMPLETE_run_reaches_the_section(): void
    {
        // The analyst's check 3. `Burns` carries a PGR application older than its
        // window; the run stays COMPLETE and records a note, and a complete row is
        // exactly the shape whose account the projection used to discard. The code
        // for an exhausted window arrives with its own item, so the shape is
        // exercised with a code that exists today — what is asserted is that a
        // note on a complete row reaches the sentence at all.
        $p = $this->projection(
            ['pgr' => null],
            ['outcome' => 'complete',
                'notes' => [['level' => 'info', 'step' => 'pgr', 'message' => 'window exhausted',
                    'data' => ['reason' => 'engine-produced-nothing']]]]
        );
        $out = AnalysisNotice::section('pgr', $p);
        fwrite(STDOUT, '[gh643] Burns-shaped complete row -> '.json_encode($out).PHP_EOL);

        $this->assertSame('engine-produced-nothing', $out['cause']);
        $this->assertSame('PGR', $out['module']);
        $this->assertNotNull($out['text']);
    }


    public function test_GH649_a_recorded_cause_whose_WORDS_are_not_written_gives_the_page_no_sentence(): void
    {
        // THE ANALYST'S NEW RELEASE CONDITION FOR 3zh, stated as a case. Once the
        // PGR note survives the pass, this section HAS a recorded cause — and its
        // words are the owner's open item. If the composer answered with the code,
        // `Burns` would read `the run reported "pgr-window-exhausted"` where it
        // reads a sentence today. So: the class travels, the sentence does not,
        // and the page keeps the one it has.
        $p = $this->projection(
            ['pgr' => null],
            ['notes' => [['level' => 'info', 'step' => 'pgr',
                'message' => 'plant-growth-regulator applied 99 days ago, beyond the 90-day history window',
                // The shape the runner really records: `data` summarised to JSON.
                'data' => '{"reason":"pgr-window-exhausted","daysSinceApplication":99,"windowDays":90}']]]
        );
        $out = AnalysisNotice::section('pgr', $p);
        fwrite(STDOUT, '[gh649] a cause with no words -> '.json_encode($out).PHP_EOL);

        $this->assertSame('pgr-window-exhausted', $out['cause']);
        $this->assertSame('answer', $out['class']);
        // An answer is not something a second press can change.
        $this->assertFalse($out['retry']);
        // AND NO SENTENCE: not the code, not a phrase of ours.
        $this->assertNull($out['text']);
    }

    public function test_the_composers_reading_of_the_graph_matches_an_independent_count_of_the_same_file(): void
    {
        // THE COMPOSER READS SOMEBODY ELSE'S FILE WITH A PATTERN, and a pattern
        // over a file you do not own goes quietly wrong when that file is
        // reformatted — it finds fewer engines and every section it can no longer
        // place answers `not-recorded` for a reason that has nothing to do with
        // the run. So the reading is compared with a SECOND, independent count:
        // every `'computed.X'` written anywhere in the graph. The two need not be
        // equal — a key may be mentioned as an input as well — but every key the
        // composer claims must be in the independent count, and the count of what
        // it finds must not collapse.
        $graph = (string) file_get_contents(base_path('../assets/dependency-graph.js'));
        preg_match_all("/'computed\\.([A-Za-z]+)'/", $graph, $all);
        $mentioned = array_values(array_unique($all[1]));

        $reading = new \ReflectionMethod(AnalysisNotice::class, 'stepsFromGraph');
        $reading->setAccessible(true);
        $found = $reading->invoke(null);

        fwrite(STDOUT, '[gh639] the composer places '.count($found).' keys; the file mentions '
            .count($mentioned).PHP_EOL);

        // Positive control: neither side collapsed.
        $this->assertGreaterThan(15, count($found));
        $this->assertGreaterThan(15, count($mentioned));

        foreach (array_keys($found) as $key) {
            $this->assertContains($key, $mentioned, $key.' is placed by the composer but written nowhere in the graph');
        }
        // And the reading did not lose most of the file: a reformat that hides
        // engines shows up as a collapse here.
        $this->assertGreaterThanOrEqual(count($mentioned) - 4, count($found),
            'the composer now places far fewer keys than the graph mentions');
    }


    public function test_break_the_graph_and_the_map_moves_with_it__a_map_that_survives_is_a_copy(): void
    {
        // THE REVIEWER'S OWN CHECK, and his words for why it matters: "if the map
        // survives the graph being broken, it is a copy, whatever it is called".
        // So the graph is handed to the composer's reader in three states, and the
        // answer has to follow each one. Nothing in the tree is touched: the
        // broken versions are written to temporary files.
        $reading = new \ReflectionMethod(AnalysisNotice::class, 'stepsFromGraph');
        $reading->setAccessible(true);

        $real = base_path('../assets/dependency-graph.js');
        $src = (string) file_get_contents($real);

        // 1. The real thing, for the control.
        $whole = $reading->invoke(null, $real);
        $this->assertGreaterThan(15, count($whole));
        $this->assertArrayHasKey('pgr', $whole);

        // 2. One engine's output removed — that key must disappear from the map.
        $withoutPgr = str_replace("outputs: ['computed.pgr'],", 'outputs: [],', $src);
        $this->assertNotSame($src, $withoutPgr, 'the anchor this mutation needs is gone from the graph');
        $trimmed = $this->intoTempFile($withoutPgr);
        $afterRemoval = $reading->invoke(null, $trimmed);
        fwrite(STDOUT, '[gh639] with `computed.pgr` removed from the graph, the map holds pgr: '
            .json_encode(isset($afterRemoval['pgr'])).PHP_EOL);
        $this->assertArrayNotHasKey('pgr', $afterRemoval,
            'the map kept a key the graph no longer declares — it is a copy, not a reading');

        // 3. The graph emptied altogether — the reader must say so, loudly, rather
        // than answer with an empty map that would turn every section into
        // "cause not recorded".
        $empty = $this->intoTempFile("// nothing here\n");
        try {
            $reading->invoke(null, $empty);
            $this->fail('an empty graph was read as an empty map instead of being reported');
        } catch (\RuntimeException $e) {
            fwrite(STDOUT, '[gh639] empty graph -> '.$e->getMessage().PHP_EOL);
            $this->assertStringContainsString('dependency graph', $e->getMessage());
        }

        @unlink($trimmed);
        @unlink($empty);
    }

    private function intoTempFile(string $contents): string
    {
        $path = tempnam(sys_get_temp_dir(), 'graph').'.js';
        file_put_contents($path, $contents);

        return $path;
    }

    public function test_every_consumer_key_gets_an_answer_and_none_is_met_with_silence(): void
    {
        // Plan 4.13a point 1: `section()` must answer for EVERY declared
        // consumer key, at least with a class. Silence is what link 11 removes.
        $schema = json_decode((string) file_get_contents(base_path('../assets/analysis-result.schema.json')), true);
        foreach (($schema['computed']['readByConsumers'] ?? []) as $key) {
            $out = AnalysisNotice::section($key, $this->projection([$key => null]));
            $this->assertIsArray($out, $key.' was met with silence');
            $this->assertNotSame('', $out['class'], $key);
        }
    }
}
