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
 * GH-581 (stage 2) — WHAT THE RUN WAS GIVEN AND WHAT IT ASSUMED.
 *
 * The row said what the run could not do (`nulls`, `skipped`) and what it said
 * (`warnings`). It said nothing about what it was HANDED, and nothing about
 * what it put in place of what it was not handed. So two runs — one on live
 * weather and one on a week-old cache; one on a site with a rootzone profile and
 * one where the profile was filled in with "unknownProfile" — were
 * indistinguishable in the stored result and on the screen. The numbers differ.
 * The account of them did not.
 *
 * WHY THIS COMES BEFORE THE STAGES THAT TIGHTEN THE INPUTS: every tightening and
 * every removed default is meant to be VISIBLE in the result. Done afterwards,
 * they would pass without a trace.
 *
 * AN ASSUMPTION IS NOT A GAP. The run produced everything asked of it, standing
 * on a stand-in for one input. It is carried separately from `nulls` and
 * `skipped`, printed in its own line, and — this is the case it exists for —
 * shown on a COMPLETE run, where nothing else on the screen says anything.
 *
 * HOW IT BITES: stop sending `inputs`, stop carrying `assumptions` through the
 * projection, or fold assumptions into the "not computed" list, and the case
 * for each goes red.
 */
class Gh581InputsAndAssumptionsReachTheResultTest extends TestCase
{
    use RefreshDatabase;
    use BuildsAnalysisResults;

    /** What the identity enforcer produces for a site with no construction type. */
    private const ASSUMED_PROFILE = [
        'key'               => 'surfaceKey',
        'displayName'       => 'Rootzone Profile',
        'providedValue'     => null,
        'assumedValue'      => 'unknownProfile',
        'impact'            => 'medium',
        'confidencePenalty' => 15,
        'affectedEngines'   => ['wear-recovery', 'irrigation-scheduler', 'soil-structure'],
        'settingsField'     => 'turf.construction',
        'settingsLabel'     => 'Construction type, Settings → Turf',
        'reason'            => 'No rootzone profile specified',
    ];

    /** And one with nowhere to send anybody: derived from latitude. */
    private const ASSUMED_REGIME = [
        'key'           => 'climateRegimeKey',
        'displayName'   => 'Climate Regime',
        'assumedValue'  => 'unknownRegime',
        'impact'        => 'medium',
        'settingsField' => null,
        'settingsLabel' => null,
    ];

    public function test_what_the_run_was_given_is_stored(): void
    {
        [$user, $site] = $this->siteFor();

        $inputs = [
            'weather' => ['status' => 'live', 'source' => 'api', 'readyAt' => 1790074338038],
            'normals' => ['present' => true, 'source' => 'nasa-power'],
            'samples' => ['soil' => 'sample_141', 'water' => null, 'tissue' => 'sample_144'],
            'sensors' => ['vwc' => null, 'soilTemp' => 'physics'],
        ];

        $row = AnalysisResults::record($user, $site, [
            'metrics'    => $this->completeMetrics(),
            'analyzedAt' => '2026-09-22T00:00:00Z',
            'runId'      => 'run-with-inputs',
            'inputs'     => $inputs,
        ]);

        // The column has existed since GH-550 and was written null on every row.
        $this->assertSame($inputs, $row->fresh()->inputs);
    }

    public function test_the_route_accepts_them_and_the_row_keeps_them(): void
    {
        // Through the door the runner really uses, not only the service.
        [$user, $site] = $this->siteFor();

        $this->actingAs($user)->postJson('/api/analysis-cache', [
            'site_id'     => $site->id,
            'run_id'      => 'run-through-the-route',
            'analyzed_at' => '2026-09-22T00:00:00Z',
            'metrics'     => $this->completeMetrics(),
            'inputs'      => ['weather' => ['status' => 'cached', 'source' => null, 'readyAt' => null]],
            'detail'      => ['nulls' => [], 'skipped' => [], 'warnings' => [],
                              'assumptions' => [self::ASSUMED_PROFILE]],
        ])->assertSuccessful();

        $row = \App\Models\AnalysisResult::query()->firstOrFail();
        $this->assertSame('cached', $row->inputs['weather']['status']);
        $this->assertSame('surfaceKey', $row->detail['assumptions'][0]['key']);
    }

    public function test_an_assumption_travels_on_a_run_that_completed(): void
    {
        // The case this exists for. A partial run already says something; a
        // complete run standing on a stand-in says nothing else at all.
        [$user, $site] = $this->siteFor();

        $row = AnalysisResults::record($user, $site, [
            'metrics'    => $this->completeMetrics(),
            'analyzedAt' => '2026-09-22T00:00:00Z',
            'runId'      => 'run-complete-but-assumed',
            'detail'     => ['assumptions' => [self::ASSUMED_PROFILE]],
        ]);

        $this->assertSame('complete', $row->outcome, 'an assumption must not make a run partial');
        $projection = AnalysisResults::forSite($site->fresh());
        $this->assertCount(1, $projection['lastRun']['assumptions']);
        $this->assertSame('Rootzone Profile', $projection['lastRun']['assumptions'][0]['displayName']);
    }

    public function test_an_assumption_is_never_counted_as_something_not_computed(): void
    {
        // Folding it in would tell a reader that part of the analysis is missing
        // when none of it is.
        [$user, $site] = $this->siteFor();

        $row = AnalysisResults::record($user, $site, [
            'metrics'    => $this->completeMetrics(),
            'analyzedAt' => '2026-09-22T00:00:00Z',
            'runId'      => 'run-assumed-only',
            'detail'     => ['assumptions' => [self::ASSUMED_PROFILE, self::ASSUMED_REGIME]],
        ]);

        $this->assertSame([], $row->detail['nulls']);
        $this->assertSame([], $row->detail['skipped']);
        $this->assertNull(AnalysisNotice::panel(AnalysisResults::forSite($site->fresh()), 'UTC'),
            'the warning panel fired on a run where nothing is missing');
    }

    public function test_the_sentence_says_where_to_set_it_when_there_is_somewhere(): void
    {
        [$user, $site] = $this->siteFor();
        AnalysisResults::record($user, $site, [
            'metrics' => $this->completeMetrics(), 'analyzedAt' => '2026-09-22T00:00:00Z',
            'runId' => 'r', 'detail' => ['assumptions' => [self::ASSUMED_PROFILE]],
        ]);

        $lines = AnalysisNotice::assumptions(AnalysisResults::forSite($site->fresh()));

        $this->assertCount(1, $lines);
        $this->assertStringContainsString('Rootzone Profile is not set', $lines[0]);
        $this->assertStringContainsString('ran on "unknownProfile"', $lines[0]);
        $this->assertStringContainsString('Set it in Construction type, Settings → Turf.', $lines[0]);
    }

    public function test_and_invents_nowhere_to_go_when_there_is_nowhere(): void
    {
        // The climate regime is derived from latitude and has no field. Sending
        // somebody to a screen with no such control is worse than saying
        // nothing about where.
        [$user, $site] = $this->siteFor();
        AnalysisResults::record($user, $site, [
            'metrics' => $this->completeMetrics(), 'analyzedAt' => '2026-09-22T00:00:00Z',
            'runId' => 'r', 'detail' => ['assumptions' => [self::ASSUMED_REGIME]],
        ]);

        $lines = AnalysisNotice::assumptions(AnalysisResults::forSite($site->fresh()));

        $this->assertCount(1, $lines);
        $this->assertStringContainsString('Climate Regime is not set', $lines[0]);
        $this->assertStringNotContainsString('Set it in', $lines[0]);
    }

    public function test_a_run_with_nothing_to_account_for_still_stores_nothing(): void
    {
        // The `detail` column stays null when there is genuinely nothing — an
        // empty account is not the same as an account of emptiness.
        [$user, $site] = $this->siteFor();
        $row = AnalysisResults::record($user, $site, [
            'metrics' => $this->completeMetrics(), 'analyzedAt' => '2026-09-22T00:00:00Z', 'runId' => 'r',
        ]);

        $this->assertNull($row->detail);
        $this->assertSame([], AnalysisNotice::assumptions(AnalysisResults::forSite($site->fresh())));
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
            'account_id' => $account->id, 'name' => 'Site', 'slug' => 'site-'.uniqid(),
            'site_type' => 'precinct', 'timezone' => 'UTC',
            'created_by_user_id' => $user->id, 'modified_by_user_id' => $user->id,
        ]);
        $site->users()->attach($user->id, ['role' => 'manager']);

        return [$user, $site];
    }
}
