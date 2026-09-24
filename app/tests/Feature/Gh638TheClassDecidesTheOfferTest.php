<?php

namespace Tests\Feature;

use App\Support\AnalysisNotice;
use Tests\TestCase;

/**
 * GH-638 (link 11, plan section 4.13 point 3) — A REASON CARRIES ITS CLASS, AND
 * THE CLASS DECIDES WHETHER PRESSING AGAIN IS OFFERED.
 *
 * WHY THIS IS NOT COSMETIC. "Press Re-run" is a claim: press this and it may
 * come out differently. For a site with no soil sample it will not, and that
 * case was kept right by a SECOND list written beside the reasons
 * (`NOTHING_A_RETRY_CAN_FIX = ['no-soil-sample']`). A second list is a second
 * place to remember, and the composer of a section's sentence would have had to
 * remember it too — so the panel and the section could have disagreed about
 * whether to press again. The class is derived from the one table now.
 *
 * THE CLASSES ARE THE PLAN'S, not invented here: `input-absent`,
 * `setting-missing`, `run-incomplete`, `answer`, `not-recorded`.
 *
 * WHAT THIS TEST DOES NOT DO: compare an English sentence. The texts belong to
 * the owner and are still being decided; every claim here is about the class and
 * about the offer, which is what the plan asks of a test at this stage.
 */
class Gh638TheClassDecidesTheOfferTest extends TestCase
{
    public function test_a_reason_the_site_cannot_change_by_pressing_again_says_so_through_its_class(): void
    {
        // The case the hand-written list existed for.
        $this->assertSame('input-absent', AnalysisNotice::classOf('no-soil-sample'));
        $this->assertFalse(AnalysisNotice::retryCanHelp('no-soil-sample'));
    }

    public function test_a_reason_about_this_attempt_still_offers_the_press(): void
    {
        foreach (['soil-sample-not-loaded', 'soil-sample-not-delivered', 'weather-unavailable',
            'run-not-completed', 'calculation-error'] as $code) {
            $this->assertSame('run-incomplete', AnalysisNotice::classOf($code), $code);
            $this->assertTrue(AnalysisNotice::retryCanHelp($code), $code);
        }
    }

    public function test_no_code_at_all_is_the_fifth_class_and_not_a_guess(): void
    {
        // A section that is empty with nothing recorded about why: the composer
        // says the cause was not recorded rather than inventing one from the
        // page (the rule GH-459 settled).
        $this->assertSame('not-recorded', AnalysisNotice::classOf(null));
        $this->assertSame('not-recorded', AnalysisNotice::classOf(''));
    }

    public function test_a_code_nobody_has_classified_is_treated_as_this_attempt_and_not_silently_final(): void
    {
        // The safe side of the two: telling someone a retry may help when it
        // cannot wastes a press; telling them nothing can help when it can
        // leaves them stuck.
        $this->assertSame('run-incomplete', AnalysisNotice::classOf('a-code-that-does-not-exist'));
        $this->assertTrue(AnalysisNotice::retryCanHelp('a-code-that-does-not-exist'));
    }

    public function test_every_reason_in_the_table_has_a_class_and_a_text_and_the_classes_are_the_declared_five(): void
    {
        // Completeness in both directions, over the table itself rather than
        // over a list written here: a code added without a class, or with a
        // class nobody declared, reddens this.
        $reasons = new \ReflectionClass(AnalysisNotice::class);
        $table = $reasons->getConstant('REASONS');
        $this->assertGreaterThan(15, count($table));

        $declared = ['input-absent', 'setting-missing', 'run-incomplete', 'answer', 'not-recorded'];
        $seen = [];
        foreach ($table as $code => $entry) {
            $this->assertIsArray($entry, $code.' is not an entry with a class');
            $this->assertArrayHasKey('class', $entry, $code);
            $this->assertArrayHasKey('text', $entry, $code);
            $this->assertContains($entry['class'], $declared, $code.' carries an undeclared class');
            $seen[$entry['class']] = true;
            // GH-649: `text` may be NULL, and for exactly one shape — a cause the
            // run ANSWERS with, whose words are the owner's open item. Anything
            // else without a sentence is an omission, so the exemption is tied to
            // the CLASS rather than to a list of codes here.
            if ($entry['text'] === null) {
                $this->assertSame('answer', $entry['class'],
                    $code.' has no sentence and is not an answer — an omission, not a decision');
                continue;
            }
            $this->assertIsString($entry['text'], $code);
            $this->assertGreaterThan(20, strlen($entry['text']), $code.' has no sentence');
        }
        fwrite(STDOUT, PHP_EOL.'[gh638] reasons: '.count($table).' | classes in use: '
            .json_encode(array_keys($seen)).PHP_EOL);
    }

    public function test_the_browser_still_gets_a_flat_code_to_sentence_map_and_no_classes(): void
    {
        // The opener reads `texts.reasons[code]` as a string. The classes are the
        // server's decision; sending them would make the browser a second reader
        // of it.
        $texts = AnalysisNotice::clientTexts();
        $this->assertIsString($texts['reasons']['no-soil-sample']);
        $this->assertStringContainsString('no soil sample', $texts['reasons']['no-soil-sample']);
        foreach ($texts['reasons'] as $code => $text) {
            $this->assertIsString($text, $code.' reaches the browser as something other than a sentence');
        }
    }
}
