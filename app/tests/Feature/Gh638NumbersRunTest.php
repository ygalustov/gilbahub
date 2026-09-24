<?php

namespace Tests\Feature;

use App\Models\Account;
use App\Models\AnalysisResult;
use App\Models\Site;
use App\Models\User;
use App\Support\AnalysisResults;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * GH-638 (link 11, plan section 4.13 point 2) — THE ACCOUNT TRAVELS WITH THE
 * NUMBERS ON SCREEN, NOT WITH THE LAST ATTEMPT.
 *
 * THE CORE FINDING THIS ANSWERS, the analyst's: the composer of a section's
 * sentence had no input about the numbers a person is looking at. `lastRun`
 * describes the last ATTEMPT, and its skipped steps and journal entries were
 * carried only when that attempt was partial. So a complete row — 45 of them in
 * the database this night, holding 59 journal entries between them — arrived at
 * the screen with no account at all, and a sentence built from `lastRun` would
 * describe one run while standing under another's figures. That is GH-459's
 * shape inside a single screen.
 *
 * WHAT IS ASSERTED HERE is the input, not the sentence: the projection carries
 * the account of the row whose numbers are shown, on every outcome. The words
 * are the owner's and are not compared anywhere.
 */
class Gh638NumbersRunTest extends TestCase
{
    use RefreshDatabase;

    public function test_a_complete_row_carries_its_own_account_including_notes_the_panel_never_prints(): void
    {
        [$user, $site] = $this->siteFor();

        // A complete run that still has something to say: a note the panel does
        // not print (GH-573 keeps `info` out of it) and an assumption.
        $this->store($user, $site, 'complete', [
            'warnings' => [
                ['level' => 'info', 'step' => 'pgr', 'message' => 'window exhausted',
                    'data' => ['reason' => 'pgr-window-exhausted']],
                ['level' => 'info', 'step' => 'pgr', 'message' => 'prose for a log, no code'],
                ['level' => 'warn', 'step' => 'wear', 'message' => 'the panel prints this one'],
            ],
            'assumptions' => [['field' => 'rootzone', 'used' => 'sand_profile']],
            'skipped' => [],
        ]);

        $p = AnalysisResults::forSite($site->fresh());
        fwrite(STDOUT, PHP_EOL.'[gh638] numbersRun on a complete row: '.json_encode($p['numbersRun']).PHP_EOL);

        $this->assertSame('complete', $p['numbersRun']['outcome']);
        // The note with a reason code reaches the composer; the one without a
        // code does not, because prose is not a cause a sentence can be built
        // from; and a `warn` belongs to the panel, not here.
        $this->assertCount(1, $p['numbersRun']['notes']);
        $this->assertSame('pgr-window-exhausted', $p['numbersRun']['notes'][0]['data']['reason']);
        $this->assertCount(1, $p['numbersRun']['assumptions']);
    }

    public function test_the_account_belongs_to_the_row_whose_numbers_are_shown_and_not_to_the_failed_attempt(): void
    {
        // The case that made this necessary: numbers from a complete run, and a
        // later attempt that failed. The panel speaks about the attempt; a
        // section's sentence must not.
        [$user, $site] = $this->siteFor();

        $this->store($user, $site, 'complete', [
            'skipped' => [['step' => 'mlsn', 'reason' => 'no-soil-sample']],
            'warnings' => [], 'assumptions' => [],
        ]);
        $this->store($user, $site, 'failed', ['nothing' => true], 'weather-unavailable');

        $p = AnalysisResults::forSite($site->fresh());
        fwrite(STDOUT, '[gh638] lastRun outcome: '.json_encode($p['lastRun']['outcome'])
            .' | numbersRun outcome: '.json_encode($p['numbersRun']['outcome'])
            .' | numbersRun skipped: '.json_encode($p['numbersRun']['skipped']).PHP_EOL);

        // Two different rows, and the projection says so.
        $this->assertSame('failed', $p['lastRun']['outcome']);
        $this->assertSame('weather-unavailable', $p['lastRun']['reason']);
        $this->assertSame('complete', $p['numbersRun']['outcome']);
        $this->assertSame('no-soil-sample', $p['numbersRun']['skipped'][0]['reason']);
    }

    public function test_a_site_with_no_result_at_all_projects_no_account_rather_than_an_empty_one(): void
    {
        // "Nothing has run" and "a run recorded nothing" are different facts, and
        // the projection keeps them apart: `null`, not `[]`.
        [, $site] = $this->siteFor();
        $this->assertNull(AnalysisResults::forSite($site->fresh()));
    }

    public function test_the_predicate_for_emptiness_is_public_and_is_the_one_the_server_already_used(): void
    {
        // Plan 4.13b point 2: one answer to "is this section empty", on the
        // server. Four pages had four conditions and they disagreed.
        $this->assertFalse(AnalysisResults::producedSomething(null));
        $this->assertFalse(AnalysisResults::producedSomething([]));
        $this->assertFalse(AnalysisResults::producedSomething(['status' => 'Error']));
        $this->assertFalse(AnalysisResults::producedSomething(['status' => 'Not available']));
        $this->assertTrue(AnalysisResults::producedSomething(['gdd' => null]));
        $this->assertTrue(AnalysisResults::producedSomething(0.0));
    }

    private function store(User $user, Site $site, string $outcome, array $detail, ?string $reason = null): void
    {
        AnalysisResult::query()->create([
            'site_id' => $site->id,
            'run_id' => 'run-'.$outcome.'-'.uniqid(),
            'outcome' => $outcome,
            'reason' => $reason,
            'detail' => $detail,
            'metrics' => $outcome === 'failed' ? null : ['growthPotential' => 0.8],
            'computed' => $outcome === 'failed' ? null : ['soilNutrition' => ['nutrients' => [1]]],
            'completed_at' => now(),
            'created_by_user_id' => $user->id,
        ]);
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
            'name' => 'Link 11 site',
            'slug' => 'link11-'.substr((string) $user->id, -4),
            'site_type' => 'sports',
            'created_by_user_id' => $user->id,
            'modified_by_user_id' => $user->id,
        ]);
        $site->users()->attach($user->id, ['role' => 'manager']);

        return [$user, $site];
    }
}
