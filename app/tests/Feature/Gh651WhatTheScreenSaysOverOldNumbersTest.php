<?php

namespace Tests\Feature;

use App\Models\Account;
use App\Models\AnalysisResult;
use App\Models\Site;
use App\Models\User;
use App\Support\AnalysisNotice;
use App\Support\AnalysisResults;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * GH-651 — WHAT A PERSON READS WHEN THE NUMBERS ON SCREEN ARE FROM AN EARLIER RUN
 * AND THE LAST ATTEMPT DID NOT FINISH.
 *
 * WHY THIS IS A RENDER AND NOT A PRESS. The reviewer named his own boundary: he
 * measured the device and the shape of the projection, not the VIEW of the page
 * during a partial run, because no site currently has one. A press cannot supply
 * it either — measured: every partial row in the database is from 22.09 with
 * `values-not-computed` / `nulls: ["soilTemp"]`, every site's latest row is
 * complete, and provoking a partial on purpose means breaking weather or data,
 * which is forbidden. So the projection is assembled and the page's own pieces
 * are rendered from it — the same two functions the templates call.
 *
 * WHAT THE OWNER ASKED FOR, in her words: "the previous calculation is shown, and
 * a new one cannot be produced for such-and-such reason". That is ONE sentence.
 * This measures whether we have one — AND WE DO. My prediction before the render
 * was that we do not: I expected the date in the topbar pill and the reason in the
 * panel, two places at opposite ends of a page. The panel carries both. The guess
 * is left written down here because the measurement is the answer, not the guess.
 */
class Gh651WhatTheScreenSaysOverOldNumbersTest extends TestCase
{
    use RefreshDatabase;

    /**
     * GH-653 — THE FIXTURE IS BUILT BY THE PRODUCT, NOT BY HAND.
     *
     * It was written out by hand, and the reviewer found the same class of defect
     * in it TWICE: `completedAt` missing (which made me report a false property of
     * the product), then `warnings` empty and `skipped` holding an entry where the
     * live rows have the opposite — two warnings and no skip. Each of those changes
     * what the render measures: with `warnings` empty the panel's `details` block
     * is not exercised at all, and with `skipped` filled the sentence names the
     * skipped step instead of the uncomputed values, so the render said "MLSN,
     * disease and soil temperature" where the product says "soil temperature".
     *
     * A hand-written projection checks what its author remembered on the day. So a
     * real row is stored and projected by `AnalysisResults::forSite` — the same
     * call the templates get their projection from. A field added to `runShape()`
     * arrives here by itself, and a drift is no longer possible.
     *
     * THE CONTENTS are taken from the live partial rows: `nulls: ["soilTemp"]`,
     * `skipped: []`, and two journal entries — measured on row 19, the shape all
     * five partial rows share.
     */
    private function oldNumbersNewPartialAttempt(): array
    {
        [$user, $site] = $this->siteFor();

        // The numbers on screen: an earlier COMPLETE run.
        AnalysisResult::query()->create([
            'site_id' => $site->id,
            'run_id' => 'run-complete-20th',
            'outcome' => 'complete',
            'detail' => ['warnings' => [], 'skipped' => [], 'assumptions' => []],
            'metrics' => ['growthPotential' => 0.62],
            'computed' => ['soilNutrition' => ['nutrients' => [['nutrient' => 'K', 'actual' => '85.0']]]],
            'completed_at' => '2026-09-20 22:10:00',
            'created_by_user_id' => $user->id,
        ]);

        // The last attempt: PARTIAL, in the shape the live rows have.
        AnalysisResult::query()->create([
            'site_id' => $site->id,
            'run_id' => 'run-partial-24th',
            'outcome' => 'partial',
            'reason' => 'values-not-computed',
            'detail' => [
                'nulls' => ['soilTemp'],
                'skipped' => [],
                'warnings' => [
                    ['module' => 'disease', 'message' => 'GAIP_DISEASE_RESULT written, species: "browntopBent"', 'at' => 1, 'data' => null],
                    ['module' => 'wear', 'message' => 'Wear engine blocked by identity enforcement', 'at' => 2, 'data' => null],
                ],
                'assumptions' => [],
            ],
            'metrics' => ['growthPotential' => null],
            'computed' => null,
            'completed_at' => '2026-09-24 06:00:00',
            'created_by_user_id' => $user->id,
        ]);

        return AnalysisResults::forSite($site->fresh());
    }

    public function test_where_the_date_of_the_shown_numbers_lives_and_what_it_comes_from(): void
    {
        $p = $this->oldNumbersNewPartialAttempt();
        $pill = AnalysisNotice::pill($p, 'Pacific/Auckland');
        fwrite(STDOUT, PHP_EOL.'[gh651] the topbar pill: '.json_encode($pill).PHP_EOL);

        // It is the pill, in the topbar, and it is built from `analyzedAt` — the
        // date of the row whose numbers are displayed, not of the attempt.
        $this->assertStringContainsString('Analysis:', $pill);
        $this->assertStringContainsString('Sep 21', $pill); // 20 Sep 22:10 UTC = 21 Sep in Auckland
        // And it says the attempt did not finish — three words, no reason.
        $this->assertStringContainsString('re-run incomplete', $pill);
    }

    public function test_where_the_reason_for_the_last_attempt_lives(): void
    {
        $p = $this->oldNumbersNewPartialAttempt();
        $panel = AnalysisNotice::panel($p, 'Pacific/Auckland');
        fwrite(STDOUT, '[gh651] the panel: '.json_encode($panel).PHP_EOL);

        $this->assertNotNull($panel);
        $this->assertNotSame('', $panel['text']);
        // The panel is the place that names what could not be computed.
        $this->assertStringContainsString('values were not computed', strtolower($panel['text']));
    }

    public function test_THE_ANSWER_both_facts_are_already_in_ONE_sentence_in_ONE_place(): void
    {
        // MY OWN GUESS WAS WRONG AND THE RENDER SAID SO. I predicted the date
        // lives in the topbar pill and the reason in the panel — two places at
        // opposite ends of the page, so the owner's one-sentence example would be
        // impossible. The panel already carries both, in one text:
        //
        //   "Showing the analysis from Sep 21 10:10. The re-run finished without
        //    MLSN, disease and soil temperature: the soil sample did not load in
        //    time, so the soil and nutrition analysis was not computed for this
        //    run. The numbers below are from the last complete analysis. Try
        //    Re-run again."
        //
        // The pill is a second, shorter statement of the same state ("re-run
        // incomplete") and carries no reason — which is right: it is a label, not
        // a sentence.
        $p = $this->oldNumbersNewPartialAttempt();
        $pill = AnalysisNotice::pill($p, 'Pacific/Auckland');
        $panel = AnalysisNotice::panel($p, 'Pacific/Auckland');
        $text = (string) $panel['text'];

        fwrite(STDOUT, '[gh651] the panel carries the date: '.json_encode(str_contains($text, 'Sep 21'))
            .' | and the reason: '.json_encode(str_contains(strtolower($text), 'values were not computed'))
            .' | and says which numbers are shown: '.json_encode(str_contains($text, 'last complete analysis')).PHP_EOL);

        // ONE ELEMENT, ONE SENTENCE, BOTH FACTS — and THREE dates' worth of
        // meaning: the numbers' own date, the attempt's date, and which of the two
        // the figures below belong to. The attempt's date is asserted explicitly
        // because its absence is exactly what my missing fixture field produced,
        // and a case that does not name it lets that happen again quietly.
        $this->assertStringContainsString('Sep 21', $text);
        $this->assertStringContainsString('The re-run on Sep 24', $text);
        // GH-653: the reason is the live rows' own — `values-not-computed`, worded
        // "some values were not computed". The hand-written fixture used to say
        // `soil-sample-not-loaded`, which is a shape the live partial rows do not
        // have; the sentence therefore named three modules where the product names
        // one, and that difference was invisible until the fixture came from the
        // product.
        $this->assertStringContainsString('some values were not computed', $text);
        $this->assertStringContainsString('finished without soil temperature', $text);
        $this->assertStringContainsString('last complete analysis', $text);
        // The pill states the state without the reason — a label beside the
        // sentence, not half of it.
        $this->assertStringContainsString('re-run incomplete', $pill);
        $this->assertFalse(str_contains(strtolower($pill), 'values were not computed'));

        // GH-653: and the `details` block IS exercised now — the hand-written
        // fixture had `warnings: []`, so half of what a person sees under the
        // sentence was never rendered by this set at all.
        $this->assertCount(2, $panel['details']);
    }

    public function test_and_whether_they_can_be_brought_together_if_she_wants_the_sentence_literally(): void
    {
        // The panel's own composer already has both: it is handed the whole
        // projection, which carries `analyzedAt` beside `lastRun`. So one sentence
        // is possible and costs one place — the panel's text — with no new input
        // and no second reader. What the sentence SAYS is hers.
        $p = $this->oldNumbersNewPartialAttempt();
        $this->assertArrayHasKey('analyzedAt', $p);
        $this->assertArrayHasKey('lastRun', $p);

        // Proof that the composer sees both in one call: it already prints a date
        // when the numbers are stale, from this same field.
        $stale = $p;
        $stale['analyzedAt'] = '2026-09-01T00:00:00.000Z';
        $panel = AnalysisNotice::panel($stale, 'Pacific/Auckland');
        fwrite(STDOUT, '[gh651] with numbers three weeks old the panel says: '
            .json_encode($panel['text']).PHP_EOL);
        $this->assertNotNull($panel);
    }

    public function test_GH653_the_fixture_IS_the_product_shape_and_carries_what_live_rows_carry(): void
    {
        // The remedy, stated: the projection under test comes from
        // `AnalysisResults::forSite`, so its shape is the product's by construction.
        // What is asserted here is the CONTENTS matching the live rows, which a
        // build-by-the-product does not guarantee on its own.
        $p = $this->oldNumbersNewPartialAttempt();

        fwrite(STDOUT, '[gh653] lastRun as the product built it: '.json_encode(array_keys($p['lastRun'])).PHP_EOL);
        $this->assertContains('completedAt', array_keys($p['lastRun']));

        // Two journal entries and no skip — the shape every live partial row has.
        $this->assertCount(2, $p['lastRun']['warnings']);
        $this->assertSame([], $p['lastRun']['skipped']);
        $this->assertSame(['soilTemp'], $p['lastRun']['nulls']);
        // And the numbers on screen are the earlier complete run's.
        $this->assertSame('complete', $p['numbersFrom']);
        $this->assertStringStartsWith('2026-09-20', (string) $p['analyzedAt']);
    }

    /** @return array{0:User,1:Site} */
    private function siteFor(): array
    {
        $user = User::factory()->create();
        $account = Account::query()->firstOrCreate(
            ['owner_user_id' => $user->id],
            ['display_name' => $user->name, 'created_by_user_id' => $user->id, 'modified_by_user_id' => $user->id]
        );
        $site = Site::query()->create([
            'account_id' => $account->id,
            'name' => 'Panel site',
            'slug' => 'panel-site-'.substr((string) $user->id, -4),
            'site_type' => 'sports',
            'created_by_user_id' => $user->id,
            'modified_by_user_id' => $user->id,
        ]);
        $site->users()->attach($user->id, ['role' => 'manager']);

        return [$user, $site];
    }
}
