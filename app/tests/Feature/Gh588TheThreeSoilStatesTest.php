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
        // and they differ in the thing that matters — whether to press again
        $this->assertStringNotContainsString('again', $first);
        $this->assertStringContainsString('again', $third);
    }

    public function test_state_2_a_run_that_had_its_sample_says_nothing(): void
    {
        // The control. Without it every case above would pass on a panel that
        // always fires.
        [$user, $site] = $this->siteFor();
        AnalysisResults::record($user, $site, [
            'metrics' => $this->completeMetrics(), 'analyzedAt' => '2026-09-23T10:00:00Z', 'runId' => 'r-full',
        ]);

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
