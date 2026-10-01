<?php

namespace Tests\Feature;

use App\Support\AnalysisNotice;
use App\Support\CalculationInputs;
use Tests\TestCase;

/**
 * GH-777 (queue item 4, promise O-9) — THE SECTION SAYS WHY IT IS EMPTY, IN THE OWNER'S WORDS AND FROM
 * THE RUN'S OWN DATA.
 *
 * WHAT WAS BROKEN, measured before this: the pass records what does not apply to a site and the server
 * judges each named input (GH-675, GH-777) — and the composer read only entries carrying a `reason`, so
 * every judgement reached the row and stopped there. Of the 17 declared consumer keys, 0 resolved a cause
 * from a judged entry and 0 got a sentence; the page kept printing the phrase it always printed, and the
 * client learned nothing about which of their inputs was missing.
 *
 * THE SENTENCE IS THE OWNER'S, approved 24.09.2026: "{Module} was not calculated because {label} has not
 * been entered. Add it in {place}." Nothing in it is a literal in the code: the module's words come from
 * the graph's label through `STEP_NAMES` (GH-572), the input's name and the place from the inputs list,
 * where they are the analyst's draft (her sections 49, 49.3, 49.4) and the owner's to change. This file
 * asserts the COMPOSITION against those declarations rather than a transcribed sentence, so that changing
 * a word in the list changes the sentence and reddens nothing.
 *
 * AND THE SILENCES ARE ASSERTED TOO, because each of them is a decision: an input with no name written
 * yet, an input with nowhere to be entered, an input whose address would send a person to a tab their
 * site does not have, and one the owner decided a client is not told about at all.
 */
class Gh777TheSentenceForAnEmptySectionTest extends TestCase
{
    /** A projection carrying one judged entry, in the shape the server writes it. */
    private function projection(string $step, string $input, string $cause = 'input-not-entered',
        ?string $turfType = null): array
    {
        $run = [
            'outcome' => 'complete', 'skipped' => [], 'notes' => [],
            'notApplicable' => [[
                'module' => $step,
                'missing' => [[
                    'input' => $input,
                    'declaredAs' => CalculationInputs::inputFor($input),
                    'cause' => $cause,
                ]],
            ]],
        ];
        /**
         * GH-792 (queue item 79): the projection carries the run's stamp, because every case here is about a
         * run that HAPPENED and recorded something. A section now answers "No analysis has been run for this
         * site yet." when there is no stamp, so a fixture without one would be answered about a site that was
         * never analysed -- a different subject from the one each case below states.
         */
        $projection = ['computed' => [], 'numbersRun' => $run, 'analyzedAt' => '2026-09-24T00:00:00.000Z'];
        if ($turfType !== null) {
            // THE KIND OF SITE TRAVELS WHERE THE METHODOLOGY TRAVELS (GH-742, GH-777): on the projection
            // itself, read from `config.turf.turfType` by its one owner, `AnalysisResults::forSites`. No
            // run records it -- 0 of the 95 stored rows carry it anywhere -- so a case that put it inside
            // `numbersRun` would be asserting a shape nothing writes.
            $projection['turfType'] = $turfType;
        }

        return $projection;
    }

    public function test_the_judged_entry_reaches_the_section_and_the_sentence_is_composed_from_the_list(): void
    {
        $section = AnalysisNotice::section('waterBalance', $this->projection('water', 'water.ecw'));
        fwrite(STDOUT, PHP_EOL.'[gh777] the section says: '.json_encode($section, JSON_UNESCAPED_SLASHES).PHP_EOL);

        // The cause travels, which is what the reader was missing.
        $this->assertSame('input-not-entered', $section['cause']);
        $this->assertSame('input-absent', $section['class']);
        $this->assertFalse($section['retry'], 'a re-run was offered for a value nobody entered');

        // And the sentence is the owner's form filled from the declarations — asserted as a composition,
        // so that her changing a word changes the sentence and breaks nothing.
        $label = CalculationInputs::label('samples.water');
        $place = CalculationInputs::placeFor('samples.water');
        $this->assertNotNull($label);
        $this->assertNotNull($place);
        $this->assertSame(
            'Water quality was not calculated because '.$label.' has not been entered. Add it in '.$place.'.',
            $section['text']
        );
    }

    public function test_a_missing_water_test_reaches_the_same_sentence_as_a_missing_reading(): void
    {
        /**
         * GH-794 (queue item 3gh) — THE WATER NODE NOW DECLARES `samples.water`, and the section speaks for
         * that input through the same composition as for `water.ecw` above.
         *
         * Before it, `water-blender` required nothing: 51 stored rows across 6 sites carried a water quality
         * letter although no water test was in effect when the run happened, and all 51 carried the SAME
         * letter -- "Low salinity risk" computed on `safeNum(..., 0)` zeros. The panel said nothing about it,
         * because a run that answers cannot be told from a run that had something to answer from.
         */
        $section = AnalysisNotice::section('waterBalance', $this->projection('water', 'samples.water'));
        fwrite(STDOUT, PHP_EOL.'[gh794] the section says: '.json_encode($section, JSON_UNESCAPED_SLASHES).PHP_EOL);

        $this->assertSame('input-not-entered', $section['cause']);
        $this->assertSame('input-absent', $section['class']);
        $this->assertFalse($section['retry'], 'a re-run was offered for a test nobody entered');

        // Composed from the declarations, not written here: the owner's wording is hers to change.
        $label = CalculationInputs::label('samples.water');
        $place = CalculationInputs::placeFor('samples.water');
        $this->assertNotNull($label);
        $this->assertNotNull($place);
        $this->assertSame(
            'Water quality was not calculated because '.$label.' has not been entered. Add it in '.$place.'.',
            $section['text']
        );
    }

    public function test_the_module_words_come_from_the_graphs_label_and_not_from_this_file(): void
    {
        // Two sections, two different words, one composition. If the words were written here, a module
        // renamed in the graph would keep the old name on the screen — which is the class GH-572 closed.
        $water = AnalysisNotice::section('waterBalance', $this->projection('water', 'water.ecw'));
        $soil = AnalysisNotice::section('soilNutrition', $this->projection('mlsn', 'samples.soil'));
        fwrite(STDOUT, '[gh777] two sections: '.json_encode([
            $water['module'].' -> '.$water['text'], $soil['module'].' -> '.$soil['text'],
        ], JSON_UNESCAPED_SLASHES).PHP_EOL);

        $this->assertStringStartsWith(ucfirst((string) $water['module']), (string) $water['text']);
        $this->assertStringStartsWith(ucfirst((string) $soil['module']), (string) $soil['text']);
        $this->assertStringContainsString((string) CalculationInputs::label('samples.soil'), (string) $soil['text']);
    }

    public function test_an_input_with_no_name_written_yet_gets_no_sentence(): void
    {
        // `pgr.enabled` has nowhere a client can enter it, so the analyst wrote no name for it (49.4).
        // The cause still travels — an administrator reads it in Details — and the page keeps its phrase.
        $this->assertNull(CalculationInputs::label('pgr.enabled'));
        $section = AnalysisNotice::section('pgr', $this->projection('pgr', 'pgr.enabled'));
        fwrite(STDOUT, '[gh777] an input with no name: '.json_encode($section, JSON_UNESCAPED_SLASHES).PHP_EOL);

        $this->assertSame('input-not-entered', $section['cause']);
        /**
         * GH-792 (queue item 79) — THE CAUSE STILL ADDS NOTHING, which is what this case is about; the words
         * of the empty section itself are the owner's and now come from the composer's declared table.
         *
         * So the claim is made without a copy of any sentence: the answer for this place is the SAME whether
         * the unworded cause is recorded or not. A copy of the words here would be this file agreeing with the
         * composer rather than checking it -- the GH-409 class.
         */
        $this->assertSame(
            AnalysisNotice::section('pgr', ['computed' => [], 'numbersRun' => null,
                'analyzedAt' => '2026-09-24T00:00:00.000Z'])['text'],
            $section['text'],
            'the unworded cause put a sentence of its own in front of a client'
        );
    }

    public function test_an_input_with_nowhere_to_be_entered_gets_no_sentence(): void
    {
        // `soil.clay` is named and has no place: measured under GH-757, the Data page does not take it.
        // "Add it in —" is not a sentence, so there is none.
        $this->assertNotNull(CalculationInputs::label('soil.clay'));
        $this->assertNull(CalculationInputs::placeFor('soil.clay'));
        $section = AnalysisNotice::section('soilNutrition', $this->projection('mlsn', 'soil.clay'));
        fwrite(STDOUT, '[gh777] an input with no place: '.json_encode($section, JSON_UNESCAPED_SLASHES).PHP_EOL);

        /**
         * GH-792 (queue item 79) — THE CAUSE STILL ADDS NOTHING, which is what this case is about; the words
         * of the empty section itself are the owner's and now come from the composer's declared table.
         *
         * So the claim is made without a copy of any sentence: the answer for this place is the SAME whether
         * the unworded cause is recorded or not. A copy of the words here would be this file agreeing with the
         * composer rather than checking it -- the GH-409 class.
         */
        $this->assertSame(
            AnalysisNotice::section('soilNutrition', ['computed' => [], 'numbersRun' => null,
                'analyzedAt' => '2026-09-24T00:00:00.000Z'])['text'],
            $section['text'],
            'the unworded cause put a sentence of its own in front of a client'
        );
    }

    public function test_an_input_the_owner_decided_not_to_explain_is_not_even_a_cause(): void
    {
        // The switch of 24.09.2026, 17:24, in her words "it turns the message to the client off
        // entirely". `schedule.efficiency` carries it because its declared address is wrong — the field
        // is in Site settings while the entry promises Turf profile — and a wrong address is worse than
        // none (the analyst's 49.1).
        $this->assertFalse(CalculationInputs::explainToClient('schedule.efficiency'));
        $section = AnalysisNotice::section('irrigation', $this->projection('irrigation', 'schedule.efficiency'));
        fwrite(STDOUT, '[gh777] an input switched off: '.json_encode($section, JSON_UNESCAPED_SLASHES).PHP_EOL);

        $this->assertNull($section['cause'], 'a client is told about an input the owner switched off');
        /**
         * GH-792 (queue item 79) — THE CAUSE STILL ADDS NOTHING, which is what this case is about; the words
         * of the empty section itself are the owner's and now come from the composer's declared table.
         *
         * So the claim is made without a copy of any sentence: the answer for this place is the SAME whether
         * the unworded cause is recorded or not. A copy of the words here would be this file agreeing with the
         * composer rather than checking it -- the GH-409 class.
         */
        $this->assertSame(
            AnalysisNotice::section('irrigation', ['computed' => [], 'numbersRun' => null,
                'analyzedAt' => '2026-09-24T00:00:00.000Z'])['text'],
            $section['text'],
            'the unworded cause put a sentence of its own in front of a client'
        );
    }

    public function test_a_place_only_a_sports_site_can_reach_is_a_place_only_for_a_sports_site(): void
    {
        // `settings.blade.php` shows the Traffic & Wear tab to a sports site alone, so for golf and lawns
        // naming it would send someone to a tab that is not there. The soil moisture lives there.
        //
        // AND THE THIRD SITE IS THE LIVE ONE. A run that never named the kind of site is not a site whose
        // tab is present: measured over the stand, 0 of 95 stored runs carry a turf type at all, so the
        // branch that used to answer "no place is ruled out" answered for every real site there is. An
        // unknown kind of site is an outcome, not a licence to name the neighbouring tab.
        $sports = AnalysisNotice::section('soilTempPhysics',
            $this->projection('soil-temp-physics', 'soil.moisture', 'input-not-entered', 'sports'));
        $golf = AnalysisNotice::section('soilTempPhysics',
            $this->projection('soil-temp-physics', 'soil.moisture', 'input-not-entered', 'golf'));
        $unnamed = AnalysisNotice::section('soilTempPhysics',
            $this->projection('soil-temp-physics', 'soil.moisture'));
        fwrite(STDOUT, '[gh777] the same input, three kinds of site: '
            .json_encode(['sports' => $sports['text'], 'golf' => $golf['text'],
                'kind not named' => $unnamed['text']], JSON_UNESCAPED_SLASHES).PHP_EOL);

        $this->assertNotNull($sports['text']);
        $this->assertStringContainsString((string) CalculationInputs::placeFor('soil.moisture', 'sports'),
            (string) $sports['text']);
        /**
         * GH-792 (queue item 79): these two claims are about the CAUSE's sentence -- whether a person is sent
         * to a tab their site does not have -- and the words of the empty section itself now come from the
         * composer's declared table for every site. So the claim is made on what the cause contributed: the
         * answer for a site whose kind cannot be named is the same as for a run with no cause recorded at all.
         */
        $withoutACause = AnalysisNotice::section('soilTempPhysics',
            ['computed' => [], 'numbersRun' => null, 'analyzedAt' => '2026-09-24T00:00:00.000Z'])['text'];
        $this->assertSame($withoutACause, $golf['text'], 'a golf site was sent to a tab it does not have');
        $this->assertNull(CalculationInputs::placeFor('soil.moisture'),
            'a tab only a sports site is shown was named for a site whose kind nobody named');
        $this->assertSame($withoutACause, $unnamed['text'],
            'a site of unknown kind was sent to a tab that may not be there');
    }

    public function test_the_kind_of_site_is_read_from_the_projection_and_not_from_the_runs_own_account(): void
    {
        // ONE OWNER, MEASURED RATHER THAN ASSUMED: the kind of site is a fact about the site, and the row a
        // run filed is not where a fact about the site lives. If the composer also accepted it from inside
        // `numbersRun`, a run could contradict the settings -- the class of GH-459 -- and the reader would
        // be sent to a tab on the strength of whatever the browser happened to post.
        $projection = $this->projection('soil-temp-physics', 'soil.moisture');
        $projection['numbersRun']['turfType'] = 'sports';
        $section = AnalysisNotice::section('soilTempPhysics', $projection);
        fwrite(STDOUT, '[gh777] the kind of site claimed by the run itself: '
            .json_encode($section, JSON_UNESCAPED_SLASHES).PHP_EOL);

        $this->assertSame('input-not-entered', $section['cause']);
        /**
         * GH-792 (queue item 79): the claim is that the RUN's own account of the kind of site contributed
         * nothing, and the section's own words now come from the composer's table for every site. So the
         * answer with the run claiming `sports` equals the answer for a run that recorded no cause at all --
         * if the claim had been taken for the settings, a sentence naming the sports tab would appear here.
         */
        $withoutACause = AnalysisNotice::section('soilTempPhysics',
            ['computed' => [], 'numbersRun' => null, 'analyzedAt' => '2026-09-24T00:00:00.000Z'])['text'];
        $this->assertSame($withoutACause, $section['text'],
            'the run\'s own account of the kind of site was taken for the settings of the site');
    }

    public function test_every_place_reads_as_an_address_on_the_screen_and_not_as_a_key(): void
    {
        // THE WORDS OF A PLACE ARE CHECKED BY THEIR FORM, exactly as the names of inputs are. Without this
        // the map could hold its own keys and every test stayed green: `Add it in settings.trafficAndWear.`
        // reaches a client as a sentence, and a technical identifier in front of a client is forbidden in
        // this repository without exception. What is asserted is the SHAPE of an address a person reads --
        // a page and its tab, in words -- so the owner may rewrite any of them without a line of code.
        $places = CalculationInputs::places();
        $notAnAddress = [];
        foreach ($places as $key => $words) {
            $fault = null;
            if (! is_string($words) || trim($words) === '') {
                $fault = 'has no words';
            } elseif (str_contains($words, $key)) {
                $fault = 'prints its own key';
            } elseif (! str_contains($words, ' -> ')) {
                $fault = 'does not name a page and a tab';
            } else {
                foreach (explode(' -> ', $words) as $part) {
                    $part = trim($part);
                    if ($part === '' || str_contains($part, '.')) {
                        $fault = 'reads as an identifier, not as words: '.$part;
                        break;
                    }
                    if (preg_match('/^[a-z]+([A-Z][a-z]+)+$/', $part) === 1) {
                        $fault = 'reads as an identifier, not as words: '.$part;
                        break;
                    }
                    if (preg_match('/^[A-Z]/', $part) !== 1) {
                        $fault = 'does not start as a name on the screen does: '.$part;
                        break;
                    }
                }
            }
            if ($fault !== null) {
                $notAnAddress[] = $key.': '.$fault;
            }
        }
        fwrite(STDOUT, '[gh777] places and their words ('.count($places).'): '
            .json_encode($places, JSON_UNESCAPED_SLASHES).PHP_EOL);

        $this->assertNotSame([], $places, 'the list declares no place at all');
        $this->assertSame([], $notAnAddress);
    }

    public function test_every_declared_label_is_a_name_and_every_place_has_words(): void
    {
        // The universe, so a label added without words for its place — or the other way round — is red
        // the day it is written rather than a sentence with a hole in it a month later.
        $withoutWords = [];
        $labelled = [];
        foreach (CalculationInputs::keys() as $key) {
            $label = CalculationInputs::label($key);
            if ($label === null) {
                continue;
            }
            $labelled[] = $key;
            if (! str_starts_with($label, 'the ') && ! str_starts_with($label, 'a ')
                && ! str_starts_with($label, 'whether ')) {
                $withoutWords[] = $key.': '.$label.' does not read inside the sentence';
            }
        }
        fwrite(STDOUT, '[gh777] inputs with a name ('.count($labelled).'): '.implode(', ', $labelled).PHP_EOL
            .'[gh777] inputs with no name on purpose: '.implode(', ', array_values(array_diff(
                CalculationInputs::keys(), $labelled))).PHP_EOL);

        $this->assertGreaterThan(30, count($labelled));
        $this->assertSame([], $withoutWords);
    }
}
