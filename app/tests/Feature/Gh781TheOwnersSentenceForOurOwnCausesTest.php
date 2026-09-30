<?php

namespace Tests\Feature;

use App\Support\AnalysisNotice;
use Tests\TestCase;

/**
 * GH-781 (deliveries 6 and 7) — THE OWNER'S SENTENCE FOR THE TWO CAUSES THAT ARE OURS.
 *
 * Her words, 30.09.2026, for both `cascade-pass-not-run` and `pass-not-finished-at-write`:
 * "{Module} was not calculated in this analysis. If this continues, contact us." — the phrase she approved on
 * 24.09 for a run whose data was there and did not arrive.
 *
 * WHY IT IS COMPOSED AND NOT A STRING IN THE TABLE: `{Module}` is the module of the SECTION a person is looking
 * at, which `section()` takes from the dependency graph. A fixed string could not carry it, and naming the
 * PRODUCER instead — "cascade", "orchestrator" — would print a word of ours to a client, which is what
 * `Gh644NoIdentifierAnywhereTest` exists against. Measured here rather than trusted to a flag.
 */
class Gh781TheOwnersSentenceForOurOwnCausesTest extends TestCase
{
    /** A projection whose tissue section was not computed, with the cause under test recorded for it. */
    private function projectionWithCause(string $code): array
    {
        return [
            'computed' => ['tissue' => null],
            'numbersRun' => [
                'skipped' => [
                    ['step' => 'tissue', 'module' => 'tissue', 'reason' => $code, 'resultKey' => 'tissue'],
                ],
                'warnings' => [],
                'notApplicable' => [],
            ],
        ];
    }

    public function test_both_of_our_causes_print_her_sentence_with_the_sections_own_module(): void
    {
        foreach (['cascade-pass-not-run', 'pass-not-finished-at-write'] as $code) {
            $section = AnalysisNotice::section('tissue', $this->projectionWithCause($code));

            $this->assertIsArray($section, $code.' produced no section answer at all');
            $this->assertSame($code, $section['cause']);
            $this->assertSame('run-incomplete', $section['class']);
            // HER SENTENCE, word for word, with the module of the section rather than of the producer.
            $this->assertSame('Tissue was not calculated in this analysis. If this continues, contact us.',
                $section['text'], $code.' does not print her sentence');
            /**
             * And the module the page puts above it is the section's own word, as the graph spells it - the
             * capital is the sentence's, not the field's. Measured, not assumed: this assertion first expected
             * 'Tissue' and the reader answers 'tissue'.
             */
            $this->assertSame('tissue', $section['module']);
            fwrite(STDOUT, PHP_EOL.'[gh781] '.$code.' -> "'.$section['text'].'"');
        }
        fwrite(STDOUT, PHP_EOL);
    }

    public function test_no_producer_name_reaches_the_sentence(): void
    {
        /**
         * The boundary that made this composed rather than fixed: `cascade-pass-not-run` is written by the
         * runner with `module: cascade`, and a sentence built from the CAUSE's module would print that word.
         * The sentence is built from the SECTION's module, so no producer's name can appear in it.
         */
        foreach (['cascade-pass-not-run', 'pass-not-finished-at-write'] as $code) {
            $section = AnalysisNotice::section('tissue', $this->projectionWithCause($code));
            foreach (['cascade', 'orchestrator', 'runner', 'pass'] as $word) {
                $this->assertStringNotContainsStringIgnoringCase($word, (string) $section['text'],
                    $code.' printed one of our own words to a client');
            }
        }
    }

    public function test_a_section_with_no_module_of_its_own_gets_silence_rather_than_an_identifier(): void
    {
        /**
         * The rule of 49.1, kept: when there is no word for the module, nothing is composed and the page keeps
         * the sentence it printed before. A key no engine declares has no step, so there is nothing to name.
         */
        $section = AnalysisNotice::section('notAKeyAnyEngineWrites', [
            'computed' => ['notAKeyAnyEngineWrites' => null],
            'numbersRun' => ['skipped' => [['step' => 'tissue', 'module' => 'tissue',
                'reason' => 'cascade-pass-not-run', 'resultKey' => 'tissue']], 'warnings' => [],
                'notApplicable' => []],
        ]);
        fwrite(STDOUT, '[gh781] a section with no module of its own -> '
            .json_encode($section === null ? null : $section['text']).PHP_EOL);

        $this->assertTrue($section === null || $section['text'] === null,
            'a section with no module of its own composed a sentence anyway');
    }
}
