<?php

namespace Tests\Feature;

use App\Models\Account;
use App\Models\Site;
use App\Models\User;
use App\Support\AnalysisNotice;
use App\Support\AnalysisResults;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Feature\Concerns\BuildsAnalysisResults;
use Tests\TestCase;

/**
 * GH-588 (link 4) — THREE SOIL STATES, AND THE FIRST AND THE THIRD DO NOT
 * READ ALIKE.
 *
 * Owner, 23.09.2026: "we have to wait, because if we have no sample then all the
 * data will be computed wrongly" — a run on a sample that has not arrived
 * produces WRONG NUMBERS, not empty ones. That is what ten cards reading
 * "NOT MEASURED" over a sample holding K 40 and Ca 803 were.
 *
 *   1. THERE IS NO SAMPLE. Nothing to wait for. The run COMPLETES, its numbers
 *      are stored, the soil part is named as not computed, and nothing suggests
 *      pressing again — because pressing again would produce the same result.
 *      What the site needs is a soil test.
 *   2. THERE IS ONE AND IT ARRIVES. Computed in full.
 *   3. THERE IS ONE AND IT DOES NOT ARRIVE. A DELIVERY failure: the run does not
 *      complete, nothing is written, the previous numbers stay, and pressing
 *      again is worth doing.
 *
 * THE DIFFERENCE BETWEEN 1 AND 3 IS THE WHOLE POINT. If they look the same on
 * screen the work is not done, and these cases are where that is checked.
 */
class Gh588TheThreeSoilStatesTest extends TestCase
{
    use RefreshDatabase;
    use BuildsAnalysisResults;

    public function test_state_1_no_sample_the_run_completes_and_says_what_to_do(): void
    {
        [$user, $site] = $this->siteFor();

        AnalysisResults::record($user, $site, [
            'metrics'    => $this->completeMetrics(),
            'computed'   => [],
            'analyzedAt' => '2026-09-23T10:00:00Z',
            'runId'      => 'run-no-sample',
            'detail'     => ['skipped' => [
                ['step' => 'mlsn', 'module' => 'mlsn', 'reason' => 'no-soil-sample', 'resultKey' => 'mlsn'],
            ], 'warnings' => []],
        ]);

        $panel = AnalysisNotice::panel(AnalysisResults::forSite($site->fresh()), 'UTC');

        $this->assertStringContainsString('there is no soil sample for this site', $panel['text']);
        $this->assertStringContainsString('Add a soil test on the Data page', $panel['text']);
    }

    public function test_state_1_does_not_offer_a_re_run(): void
    {
        // The trap this ticket is about: every partial sentence used to end by
        // suggesting a re-run, and for a site with no sample that offer is
        // false — the same absence gives the same result, and the person is sent
        // round a loop by their own product.
        [$user, $site] = $this->siteFor();

        AnalysisResults::record($user, $site, [
            'metrics'    => $this->completeMetrics(),
            'computed'   => [],
            'analyzedAt' => '2026-09-23T10:00:00Z',
            'runId'      => 'run-no-sample-2',
            'detail'     => ['skipped' => [
                ['step' => 'mlsn', 'module' => 'mlsn', 'reason' => 'no-soil-sample', 'resultKey' => 'mlsn'],
            ], 'warnings' => []],
        ]);

        $panel = AnalysisNotice::panel(AnalysisResults::forSite($site->fresh()), 'UTC');

        $this->assertStringNotContainsString('Re-run', $panel['text']);
        $this->assertStringNotContainsString('again', $panel['text']);
    }

    public function test_state_3_delivery_failed_and_pressing_again_is_offered(): void
    {
        [$user, $site] = $this->siteFor();

        // A complete result exists; the next attempt fails on delivery.
        AnalysisResults::record($user, $site, [
            'metrics' => $this->completeMetrics(), 'analyzedAt' => '2026-09-23T09:00:00Z', 'runId' => 'r-ok',
        ]);
        AnalysisResults::recordFailure($user, $site, [
            'runId'  => 'run-not-delivered',
            'reason' => 'soil-sample-not-delivered',
            'detail' => ['soilSampleId' => 'sample_141'],
        ]);

        $panel = AnalysisNotice::panel(AnalysisResults::forSite($site->fresh()), 'UTC');

        $this->assertStringContainsString('did not arrive in time', $panel['text']);
        $this->assertStringContainsString('Try Re-run again.', $panel['text']);
    }

    public function test_the_point_the_two_sentences_are_not_the_same(): void
    {
        // Stated as one assertion so it cannot be lost among the others: a
        // reader must be able to tell "this site has no soil test" from "this
        // attempt did not get the data", because the actions differ.
        [$u1, $s1] = $this->siteFor('no-sample');
        AnalysisResults::record($u1, $s1, [
            'metrics' => $this->completeMetrics(), 'computed' => [],
            'analyzedAt' => '2026-09-23T10:00:00Z', 'runId' => 'a',
            'detail' => ['skipped' => [
                ['step' => 'mlsn', 'module' => 'mlsn', 'reason' => 'no-soil-sample', 'resultKey' => 'mlsn'],
            ]],
        ]);

        [$u2, $s2] = $this->siteFor('not-delivered');
        AnalysisResults::record($u2, $s2, [
            'metrics' => $this->completeMetrics(), 'analyzedAt' => '2026-09-23T09:00:00Z', 'runId' => 'b',
        ]);
        AnalysisResults::recordFailure($u2, $s2, [
            'runId' => 'c', 'reason' => 'soil-sample-not-delivered', 'detail' => [],
        ]);

        $first = AnalysisNotice::panel(AnalysisResults::forSite($s1->fresh()), 'UTC')['text'];
        $third = AnalysisNotice::panel(AnalysisResults::forSite($s2->fresh()), 'UTC')['text'];

        $this->assertNotSame($first, $third);

        // GH-594 — AND THEY DIFFER IN THE DECISION, NOT IN A SET OF WORDS.
        //
        // This case is named for the point of the ticket and has now meant
        // something smaller than its name TWICE. First it was
        // `assertStringNotContainsString('again', ...)`, and the class offers a
        // re-run in two wordings of which only one carries that word (GH-592).
        // Then it took its vocabulary from the SOURCE TEXT of the two ternaries
        // that emitted them — and the reviewer appended a third offer plainly,
        // outside that shape, which the extraction could not see and this case
        // stayed green again. Both times the grubby neighbour at
        // `test_state_1_does_not_offer_a_re_run` was what caught it, by looking
        // for the words "Re-run" and "again" literally.
        //
        // So the offer is asked of the DECISION, not read off the writing:
        // `AnalysisNotice::retryOffer()` is the one place that decides whether
        // to offer and words it, and this asks it what it says for yes and for
        // no. There is no variable name to track, no literal to match, and no
        // spelling to keep up with.
        $offerWhenPartial  = self::askTheDecision(true, true);
        $offerWhenComplete = self::askTheDecision(true, false);

        // The silence is part of the contract and is asserted, not assumed: with
        // nothing to gain from pressing, nothing is said, in either shape.
        $this->assertSame('', self::askTheDecision(false, true));
        $this->assertSame('', self::askTheDecision(false, false));

        // And the vocabulary was really found — two distinct offers. Without
        // this, every claim below would hold on a decision that says nothing.
        $this->assertNotSame('', $offerWhenPartial);
        $this->assertNotSame('', $offerWhenComplete);
        $this->assertNotSame($offerWhenPartial, $offerWhenComplete);

        // THE NAME OF THE CONTROL, taken from the offers rather than written
        // here: whatever both wordings say, they both have to say. You cannot
        // invite a person to press the button without naming it — so a THIRD
        // wording, in any shape, is caught by this and not by a list.
        $namesTheControl = array_values(array_intersect(
            preg_split('/\s+/', trim($offerWhenPartial)),
            preg_split('/\s+/', trim($offerWhenComplete))
        ));
        $this->assertNotEmpty($namesTheControl, 'the two offers name nothing in common');

        foreach ($namesTheControl as $word) {
            $this->assertStringNotContainsString($word, $first,
                'a site with no soil sample was invited to press: '.$word);
        }

        // And the one that IS offered ENDS with the offer. Anything appended
        // after it — the exact mutation that got past the previous version — is
        // visible here, because the sentence would no longer end where the
        // decision says it ends.
        $endings = array_filter(
            [$offerWhenPartial, $offerWhenComplete],
            static fn (string $o): bool => str_ends_with($third, $o)
        );
        $this->assertCount(1, $endings,
            'the sentence that offers a re-run must END with the offer the decision worded');
    }

    /**
     * What `AnalysisNotice` decides to say about pressing again.
     *
     * The decision is private — it is not a surface anything else may use — so
     * it is reached the way the rest of this suite reaches internals. Asking it
     * is the whole point: a test that reads how the sentence is SPELLED goes
     * blind the moment somebody spells it differently, and this file has been
     * blind that way twice.
     */
    private static function askTheDecision(bool $retryChanges, bool $isPartial): string
    {
        $m = new \ReflectionMethod(AnalysisNotice::class, 'retryOffer');
        $m->setAccessible(true);

        return (string) $m->invoke(null, $retryChanges, $isPartial);
    }

    public function test_state_2_a_run_that_had_its_sample_says_nothing(): void
    {
        // The control. Without it every case above would pass on a panel that
        // always fires.
        [$user, $site] = $this->siteFor();
        AnalysisResults::record($user, $site, [
            'metrics' => $this->completeMetrics(), 'analyzedAt' => '2026-09-23T10:00:00Z', 'runId' => 'r-full',
        ]);

        // GH-791 (queue item 3gp): the row is this run's own, so the clock stands where it finished.
        $this->clockAtRowAge('2026-09-23T10:00:00Z');
        $this->assertNull(AnalysisNotice::panel(AnalysisResults::forSite($site->fresh()), 'UTC'));
    }

    /** @return array{0:User,1:Site} */
    private function siteFor(string $slug = 'site'): array
    {
        $user = User::factory()->create();
        $account = Account::query()->firstOrCreate(
            ['owner_user_id' => $user->id],
            ['display_name' => $user->name, 'created_by_user_id' => $user->id, 'modified_by_user_id' => $user->id]
        );
        $site = Site::query()->create([
            'account_id' => $account->id, 'name' => 'Site', 'slug' => $slug.'-'.uniqid(),
            'site_type' => 'precinct', 'timezone' => 'UTC',
            'created_by_user_id' => $user->id, 'modified_by_user_id' => $user->id,
        ]);
        $site->users()->attach($user->id, ['role' => 'manager']);

        return [$user, $site];
    }
}
