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
        /**
         * GH-712, THE REVIEWER'S RETURN APPLIED HERE TOO: AN ADDRESS, NOT A WORD.
         *
         * This asked that the reason contain the word `from`, which a guess containing the word
         * also satisfies -- the same hole he found in the `notInputs` check, in a second place. It
         * surfaced when a reason stopped containing the word because the measurement said the
         * entry is NOT derived at all: `purpose` is produced nowhere, read nowhere, and what
         * exists is an open question about whether the wizard should ask for it. Rewording that to
         * contain `from` would have been writing prose to satisfy a word check.
         *
         * So the rule is the one `gh644` now applies: the reason names a `path` / `anchor` pair,
         * the file exists, and the anchor is in it.
         */
        foreach ($derived as $key => $from) {
            $pairs = [];
            preg_match_all('/`([\w.\/-]+\.(?:js|php|json))`\s*\/\s*`([^`]+)`/', (string) $from, $pairs,
                PREG_SET_ORDER);
            $this->assertNotEmpty($pairs, $key.' names no `path` / `anchor` pair');
            foreach ($pairs as $pair) {
                // The path is written as the repository sees it. Inside the container the
                // repository root is the parent of `base_path()`, and the Laravel application is
                // mounted there as `html` rather than as `app`, so a path that begins `app/` is
                // translated instead of being looked for under a directory that does not exist.
                $rel = $pair[1];
                $full = str_starts_with($rel, 'app/')
                    ? base_path(substr($rel, strlen('app/')))
                    : base_path('../'.$rel);
                $this->assertFileExists($full, $key.' names '.$pair[1].', which is not there');
                $this->assertStringContainsString($pair[2], file_get_contents($full),
                    $key.': '.$pair[1].' does not contain '.$pair[2]);
            }
            $this->assertNull(CalculationInputs::entry($key), $key.' is declared both derived and asked for');
        }
    }

    public function test_the_clay_fraction_the_analyst_found_missing_is_in_the_list(): void
    {
        // Her own case 4: an engine reads `soil.clay` with a stand-in of 20, and
        // nothing can fill it — no column in the lab-name map, no sample carrying
        // it, so 20 stands always. The draft of her table did not have it; the
        // list does.
        //
        // GH-757: and `filledIn` no longer names a place that does not take it. The comment above
        // already said nothing can fill it, while the entry went on promising `data.soil` —
        // measured, `clay` appears 0 times in data.blade.php and the value is absent on all 14
        // stand sites. The entry stays, because a read with no entry is the defect this list
        // exists against; the PROMISE of a writer is what goes.
        $clay = CalculationInputs::entry('soil.clay');
        $this->assertNotNull($clay, 'the clay fraction is missing from the list again');
        $this->assertFalse($clay['required']);
        $this->assertSame([], $clay['filledIn'], 'the list promises a writer for the clay fraction again');
    }

    /**
     * GH-757 (the reviewer's return) — AN EMPTY `filledIn` IS GUARDED FOR ALL THREE, AND BOTH WAYS.
     *
     * Three inputs are read by the run and written by nobody. The list used to promise a writer for
     * each — `settings.turf` for two of them, `data.soil` for the third — and measured, none of
     * those surfaces carries the field: the name appears zero times in the Settings form, in its
     * script, and in the Data page. Only the clay one was guarded, so returning the promise on the
     * other two passed green.
     *
     * BOTH WAYS on purpose. If the promise comes back while no surface writes the field, this
     * reddens — the list would be lying again. If a surface STARTS writing it, this reddens too,
     * and that is the right moment to put `filledIn` back rather than leave the list behind the
     * code. The surfaces are read from disk, so neither half is a sentence about the past.
     */
    public function test_an_input_nobody_fills_promises_no_writer_and_the_promise_is_watched_both_ways(): void
    {
        $surfaces = [
            'settings.turf' => [
                'resources/views/settings.blade.php' => base_path('resources/views/settings.blade.php'),
                'assets/settings-init.js' => base_path('../assets/settings-init.js'),
            ],
            'data.soil' => [
                'resources/views/data.blade.php' => base_path('resources/views/data.blade.php'),
            ],
        ];
        $cases = [
            'turf.percentC3Cover' => ['field' => 'percentC3Cover', 'was' => 'settings.turf'],
            'turf.warmBase' => ['field' => 'warmBase', 'was' => 'settings.turf'],
            'soil.clay' => ['field' => 'clay', 'was' => 'data.soil'],
        ];
        $promised = [];
        $written = [];
        foreach ($cases as $key => $case) {
            $entry = CalculationInputs::entry($key);
            $this->assertNotNull($entry, $key.' left the list');
            if (($entry['filledIn'] ?? null) !== []) {
                $promised[] = $key.' promises '.json_encode($entry['filledIn'] ?? null);
            }
            foreach ($surfaces[$case['was']] as $label => $file) {
                $hits = substr_count(file_get_contents($file), $case['field']);
                if ($hits > 0) {
                    $written[] = $key.' <- '.$label.' ('.$hits.' occurrence(s))';
                }
            }
        }
        fwrite(STDOUT, PHP_EOL.'[gh757] inputs nobody fills: promises found '.json_encode($promised)
            .' | surfaces that now carry the field: '.json_encode($written).PHP_EOL);

        // Positive control: the three are really in the list, or both claims below pass over nothing.
        // Stated as the LIST rather than as its length — a count of three would be satisfied by
        // three other keys, and the census of GH-747 would have to carry this line as one more site.
        $this->assertSame(
            ['turf.percentC3Cover', 'turf.warmBase', 'soil.clay'],
            array_values(array_filter(array_keys($cases), fn ($k) => CalculationInputs::entry($k) !== null)),
            'one of the three inputs left the list'
        );
        $this->assertSame([], $promised, 'the list promises a writer for an input nobody fills');
        $this->assertSame([], $written, 'a surface now writes this field, so the list must say so again');
    }
}
