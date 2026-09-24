<?php

namespace Tests\Feature;

use App\Support\CalculationInputs;
use Tests\TestCase;

/**
 * GH-642 (queue item 6, stage 0b) — THE LIST OF CALCULATION INPUTS HAS A SHAPE,
 * AND ONE READER.
 *
 * The owner settled both: one list that the wizard, Settings, the run and the
 * incomplete-run panel consult, so the same check is not written four times; and
 * one file with ONE reader, the others getting it parsed — "two readers with a
 * guard" is duplication wearing a seatbelt.
 *
 * WHAT THIS SET ASSERTS: the shape of the declarations, and that the reader
 * answers from them. The equality test in both directions — an input the code
 * reads that the list does not carry, and an entry nobody reads — is the second
 * part of this stage and needs a universe that includes the bodies of the cascade
 * engines (analyst 14a, case 4, where a clay fraction read with a stand-in of 20
 * escaped her own census).
 *
 * NOT ASSERTED: what breaks without an input. That is the dependency graph's
 * answer, and restating it here would be a second one.
 */
class Gh642TheOneListOfInputsTest extends TestCase
{
    public function test_the_list_is_real_and_says_what_it_is(): void
    {
        // Positive control: an empty list would make every claim below vacuous,
        // and would make every site complete in the warning that reads it.
        $keys = CalculationInputs::keys();
        fwrite(STDOUT, PHP_EOL.'[gh642] inputs declared: '.count($keys).PHP_EOL);

        $this->assertGreaterThan(25, count($keys));
        $this->assertContains('turf.species', $keys);
        $this->assertContains('samples.soil', $keys);
    }

    public function test_every_entry_answers_the_four_questions_the_list_exists_for(): void
    {
        // "Required, for whom, and where it is filled in" — the owner's own three,
        // plus the honest third answer to the first. What breaks without it is the
        // graph's, deliberately absent.
        $bad = [];
        foreach (CalculationInputs::keys() as $key) {
            $entry = CalculationInputs::entry($key);
            if (! array_key_exists('required', $entry)) {
                $bad[] = $key.': no `required`';
                continue;
            }
            if (! in_array($entry['required'], [true, false, null], true)) {
                $bad[] = $key.': `required` is not true, false or null';
            }
            if (! isset($entry['filledIn']) || ! is_array($entry['filledIn'])) {
                $bad[] = $key.': no `filledIn`';
            }
            // The list must not answer "what breaks without it".
            foreach (['affects', 'breaks', 'consumers'] as $forbidden) {
                if (array_key_exists($forbidden, $entry)) {
                    $bad[] = $key.": carries `$forbidden`, which is the graph's answer";
                }
            }
        }
        $this->assertSame([], $bad);
    }

    public function test_an_undecided_obligation_says_so_and_names_what_waits_on_the_owner(): void
    {
        // `required: null` is not a guess and not a default. A warning built from
        // this list stays silent about these until she answers, and silence has to
        // be traceable to a decision rather than to a blank.
        $open = CalculationInputs::openDecisions();
        fwrite(STDOUT, '[gh642] undecided: '.json_encode($open).PHP_EOL);

        $this->assertNotSame([], $open, 'the list claims every obligation is settled');
        foreach ($open as $key => $why) {
            $this->assertNotSame('', $why, $key.' is undecided with nothing said about what waits');
            $this->assertStringContainsString('owner', $why, $key);
        }
        // The two the analyst measured this night: a bulk density of 1.4 in all 62
        // rows that carry it, with no measured value anywhere, and its sampling
        // depth beside it.
        $this->assertArrayHasKey('soil.bulkDensity', $open);
        $this->assertArrayHasKey('soil.samplingDepth', $open);
    }

    public function test_a_conditional_obligation_is_answered_per_turf_type_and_not_flattened(): void
    {
        // The surface of a golf site is asked for; a lawn is not asked; a sports
        // site is the owner's open question. One entry, three answers — flattening
        // it to "optional" would settle her question by the back door.
        $this->assertTrue(CalculationInputs::isRequired('turf.subCategory', 'golf'));
        $this->assertFalse(CalculationInputs::isRequired('turf.subCategory', 'lawns'));
        $this->assertNull(CalculationInputs::isRequired('turf.subCategory', 'sports'));

        $open = CalculationInputs::openDecisions();
        $this->assertArrayHasKey('turf.subCategory@sports', $open);
    }

    public function test_required_for_names_the_turf_types_an_input_is_required_of(): void
    {
        // The traffic schedule matters to a sports site and to nothing else.
        $this->assertTrue(CalculationInputs::isRequired('traffic.schedule', 'sports'));
        $this->assertFalse(CalculationInputs::isRequired('traffic.schedule', 'golf'));
    }

    public function test_the_required_set_differs_by_turf_type_and_each_set_is_answerable(): void
    {
        $seen = [];
        foreach (CalculationInputs::all()['turfTypes'] as $type) {
            $required = CalculationInputs::requiredFor($type);
            $seen[$type] = count($required);
            // Every required input must say where a person fills it in, or the
            // requirement cannot be met by anybody.
            foreach ($required as $key) {
                $this->assertNotSame([], CalculationInputs::entry($key)['filledIn'],
                    $key.' is required of '.$type.' and has nowhere to be entered');
            }
        }
        fwrite(STDOUT, '[gh642] required per turf type: '.json_encode($seen).PHP_EOL);

        $this->assertGreaterThan($seen['lawns'], $seen['golf'],
            'the branches collapsed — a golf site requires no more than a lawn');
    }

    public function test_the_readings_of_a_sample_are_pointed_at_their_one_declaration_and_not_copied(): void
    {
        // Their names are declared once, by the lab-name map. An entry points at
        // it; a list of readings here would be the second place those names live.
        foreach (['samples.soil' => 'soil', 'samples.water' => 'water', 'samples.tissue' => 'tissue'] as $key => $kind) {
            $this->assertSame('readingKeysFor:'.$kind, CalculationInputs::readingsMap($key), $key);
            $this->assertArrayNotHasKey('readingList', CalculationInputs::entry($key), $key);
        }
    }

    public function test_what_is_worked_out_rather_than_asked_is_named_one_by_one_with_its_source(): void
    {
        // A rule that excluded "anything derivable" would also excuse a real
        // omission, so these are named. And none of them may also be an input:
        // asking a person for something the run works out is what section 3 of the
        // analyst's paper forbids.
        $derived = CalculationInputs::derived();
        fwrite(STDOUT, '[gh642] derived, not asked: '.implode(' ', array_keys($derived)).PHP_EOL);

        $this->assertGreaterThan(5, count($derived));
        foreach ($derived as $key => $from) {
            $this->assertStringContainsString('from', $from, $key.' is derived from nothing stated');
            $this->assertNull(CalculationInputs::entry($key), $key.' is declared both derived and asked for');
        }
    }

    public function test_the_clay_fraction_the_analyst_found_missing_is_in_the_list(): void
    {
        // Her own case 4: an engine reads `soil.clay` with a stand-in of 20, and
        // nothing can fill it — no column in the lab-name map, no sample carrying
        // it, so 20 stands always. The draft of her table did not have it; the
        // list does.
        $clay = CalculationInputs::entry('soil.clay');
        $this->assertNotNull($clay, 'the clay fraction is missing from the list again');
        $this->assertFalse($clay['required']);
        $this->assertSame(['data.soil'], $clay['filledIn']);
    }
}
