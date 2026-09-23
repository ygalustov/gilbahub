<?php

namespace Tests\Feature;

use App\Models\Account;
use App\Models\Site;
use App\Models\AnalysisResult;
use App\Models\SiteConfig;
use App\Models\User;
use App\Support\AnalysisNotice;
use App\Support\AnalysisResults;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * GH-548 (stage 3) — A RUN THAT DID NOT FINISH SAYS SO, ON EVERY SCREEN
 * THAT PRINTS ITS NUMBERS.
 *
 * The owner's decision of 22.09.2026: a failed re-run leaves the previous
 * result on the screen with its own date, and the numbers are signed — "it
 * needs to be written somewhere that this is an old calculation, and that the
 * calculation did not happen for such-and-such a reason, and that it should be
 * tried again".
 *
 * WHAT THIS FILE HAS TO ESTABLISH, and each of the four is a separate way the
 * promise could be kept in words and broken in fact:
 *
 *   1. A failure writes the REASON and nothing else. Not the numbers, not their
 *      date. Asserted by hash, because "it looks unchanged" and "it is
 *      unchanged" are different claims.
 *   2. The sign clears itself. A run that works replaces it; nobody has to
 *      dismiss anything.
 *   3. The words are a function of the stored result, not of the page. Same row,
 *      same sentence, on any screen and any device.
 *   4. The sentence actually reaches all six screens that print numbers. The
 *      plan named this as the failure mode by name: a ninth field added to eight
 *      hand-built arrays reaches some screens and not others, which is what the
 *      owner had already seen on the Account page. That is the last group of
 *      tests here, and it renders the pages rather than reading the templates.
 */
class Gh548AnalysisNoticeTest extends TestCase
{
    use RefreshDatabase;
    use \Tests\Feature\Concerns\BuildsAnalysisResults;

    /**
     * The screens that print numbers from the analysis result AND can be
     * reached.
     *
     * The plan's section 8.1 lists six, counting `/analysis/growth-light` and
     * `/analysis/disease`. Those two routes REDIRECT to `/analysis#…` — the
     * pages became tabs of the SPA — so their templates are not rendered by any
     * route today. Both were wired up all the same (they are still in the tree,
     * and a template that comes back unwired is the failure this stage is
     * about), and a test below states that, rather than leaving the count of six
     * to look met.
     */
    private const SCREENS = ['/dashboard', '/plan', '/reports/accuracy', '/analysis'];

    /** GH-553: a result in the declared form — see the trait. */
    private function aResult(array $over = []): array
    {
        return array_merge([
            'metrics'    => $this->completeMetrics(['timestamp' => '2026-09-18T11:26:00Z', 'growthPotential' => 0.8]),
            'computed'   => ['climate' => ['ok' => true]],
            'analyzedAt' => '2026-09-18T11:26:00Z',
            'runId'      => 'run-good',
        ], $over);
    }

    // ── 1. A failure writes the reason and nothing else ────────────────────

    public function test_a_failed_run_leaves_the_numbers_and_their_date_exactly_as_they_were(): void
    {
        [$user, $site] = $this->siteFor('manager');
        AnalysisResults::record($user, $site, $this->aResult());

        // GH-550 (stage 4): the numbers are a row of their own now, so "the
        // failure did not touch them" is asserted against THAT ROW rather than
        // against a config blob the failure used to be merged into. The claim is
        // the same and the hash still does the work: the completed run's record
        // is byte-identical afterwards, its `completed_at` included.
        $completed     = $this->completedRow($site);
        $completedHash = md5(json_encode($completed->toArray()));

        AnalysisResults::recordFailure($user, $site, [
            'runId'  => 'run-bad',
            'reason' => 'weather-unavailable',
            'detail' => ['lastError' => 'timeout'],
        ]);

        $this->assertSame(
            $completedHash,
            md5(json_encode($this->completedRow($site)->toArray())),
            'a failed run changed the completed run it was not about'
        );

        // And what the screen reads is unchanged in the half that matters and
        // changed in the half that should be.
        $p = AnalysisResults::forSite($site->fresh());
        $this->assertSame('2026-09-18T11:26:00.000000Z', $p['analyzedAt']);
        $this->assertSame(0.8, $p['metrics']['growthPotential']);
        $this->assertSame('failed', $p['lastRun']['outcome']);
        $this->assertSame('weather-unavailable', $p['lastRun']['reason']);
        $this->assertSame('timeout', $p['lastRun']['detail']['lastError']);
        $this->assertSame('run-bad', $p['lastRun']['runId']);
    }

    public function test_a_failure_on_a_site_with_no_result_does_not_invent_a_date_for_numbers_that_do_not_exist(): void
    {
        [$user, $site] = $this->siteFor('manager');

        AnalysisResults::recordFailure($user, $site, ['runId' => 'run-1', 'reason' => 'calculation-error']);

        $p = AnalysisResults::forSite($site->fresh());
        $this->assertNull($p['analyzedAt'], 'a run that produced nothing dated the nothing');
        $this->assertNull($p['metrics']);
        $this->assertSame('failed', $p['status']);
    }

    // ── 2. The sign clears itself ──────────────────────────────────────────

    public function test_a_run_that_works_replaces_the_failure_rather_than_standing_beside_it(): void
    {
        [$user, $site] = $this->siteFor('manager');
        AnalysisResults::record($user, $site, $this->aResult());
        AnalysisResults::recordFailure($user, $site, ['runId' => 'run-bad', 'reason' => 'calculation-error']);
        $this->assertSame('failed', AnalysisResults::forSite($site->fresh())['status']);

        AnalysisResults::record($user, $site, array_merge($this->aResult(), [
            'analyzedAt' => '2026-09-22T09:00:00Z',
            'runId'      => 'run-better',
        ]));

        $p = AnalysisResults::forSite($site->fresh());
        $this->assertSame('complete', $p['status']);
        $this->assertSame('run-better', $p['lastRun']['runId']);
        $this->assertNull(AnalysisNotice::panel($p, 'UTC'), 'the sign survived the run that should have cleared it');
    }

    // ── The permission is the same one, at the same door ───────────────────

    public function test_a_viewer_cannot_put_a_warning_on_someone_elses_screen(): void
    {
        [$owner, $site] = $this->siteFor('manager');
        AnalysisResults::record($owner, $site, $this->aResult());
        $before = md5(json_encode(AnalysisResult::query()
            ->where('site_id', $site->id)->orderBy('id')->get()->toArray()));

        $viewer = User::factory()->create();
        $site->users()->attach($viewer->id, ['role' => 'viewer']);

        $this->actingAs($viewer)
            ->postJson('/api/analysis-cache/runs', [
                'site_id' => $site->id, 'run_id' => 'r', 'outcome' => 'failed', 'reason' => 'calculation-error',
            ])
            ->assertStatus(403);

        $this->assertSame($before, md5(json_encode(AnalysisResult::query()
            ->where('site_id', $site->id)->orderBy('id')->get()->toArray())));
    }

    public function test_the_failure_route_refuses_an_unknown_site_and_creates_no_row(): void
    {
        [$user] = $this->siteFor('manager');

        $this->actingAs($user)
            ->postJson('/api/analysis-cache/runs', [
                'site_id' => 'default', 'run_id' => 'r', 'outcome' => 'failed', 'reason' => 'calculation-error',
            ])
            ->assertStatus(404);

        $this->assertSame(0, SiteConfig::query()->where('site_id', 'default')->count());
        $this->assertSame(0, AnalysisResult::query()->where('site_id', 'default')->count());
    }

    public function test_the_runner_can_file_its_own_failure(): void
    {
        [$user, $site] = $this->siteFor('manager');
        AnalysisResults::record($user, $site, $this->aResult());

        $this->actingAs($user)
            ->postJson('/api/analysis-cache/runs', [
                'site_id' => $site->id,
                'run_id'  => 'run-bad',
                'outcome' => 'failed',
                'reason'  => 'calculation-error',
                'detail'  => ['message' => 'cascade exploded'],
            ])
            ->assertOk();

        $p = AnalysisResults::forSite($site->fresh());
        $this->assertSame('failed', $p['status']);
        $this->assertSame('cascade exploded', $p['lastRun']['detail']['message']);
    }

    // ── 3. The words are a function of the row ─────────────────────────────

    public function test_the_pill_says_the_date_and_marks_a_failed_re_run(): void
    {
        $fresh = ['analyzedAt' => '2026-09-18T11:26:00Z', 'metrics' => ['x' => 1], 'computed' => null,
                  'lastRun' => ['outcome' => 'complete'], 'status' => 'complete'];
        $this->assertSame('Analysis: Sep 18 11:26', AnalysisNotice::pill($fresh, 'UTC'));

        $failed = array_merge($fresh, [
            'lastRun' => ['outcome' => 'failed', 'reason' => 'weather-unavailable', 'failedAt' => '2026-09-22T14:03:00Z'],
            'status'  => 'failed',
        ]);
        $this->assertSame('Analysis: Sep 18 11:26 · re-run failed', AnalysisNotice::pill($failed, 'UTC'));

        $this->assertSame('Analysis: —', AnalysisNotice::pill(null, 'UTC'));
    }

    public function test_the_pill_is_in_the_sites_own_timezone_not_the_servers(): void
    {
        $p = ['analyzedAt' => '2026-09-18T23:30:00Z', 'metrics' => ['x' => 1], 'lastRun' => null, 'status' => null];
        $this->assertSame('Analysis: Sep 18 23:30', AnalysisNotice::pill($p, 'UTC'));
        $this->assertSame('Analysis: Sep 19 09:30', AnalysisNotice::pill($p, 'Australia/Sydney'));
    }

    public function test_the_panel_names_the_date_the_reason_and_what_to_do(): void
    {
        $p = [
            'analyzedAt' => '2026-09-18T11:26:00Z',
            'metrics'    => ['x' => 1],
            'computed'   => null,
            'lastRun'    => [
                'outcome'  => 'failed',
                'reason'   => 'weather-unavailable',
                'failedAt' => '2026-09-22T14:03:00Z',
            ],
            'status' => 'failed',
        ];

        $panel = AnalysisNotice::panel($p, 'UTC');
        // The owner's three parts: which numbers these are, why they were not
        // replaced, and that it is worth trying again.
        $this->assertStringContainsString('Showing the analysis from Sep 18 11:26', $panel['text']);
        $this->assertStringContainsString('on Sep 22 14:03 did not complete', $panel['text']);
        $this->assertStringContainsString('no weather data was available', $panel['text']);
        $this->assertStringContainsString('Try Re-run again', $panel['text']);
    }

    public function test_the_panel_carries_the_detail_a_reason_cannot_say_on_its_own(): void
    {
        $p = ['analyzedAt' => '2026-09-18T11:26:00Z', 'metrics' => ['x' => 1],
              'lastRun' => ['outcome' => 'failed', 'reason' => 'calculation-error',
                            'detail' => ['message' => 'cascade exploded']], 'status' => 'failed'];
        $this->assertStringContainsString('cascade exploded', AnalysisNotice::panel($p, 'UTC')['text']);
    }

    public function test_a_reason_nobody_has_phrased_is_still_said_out_loud(): void
    {
        // A code the runner learns to send before this file learns the sentence
        // must not come out as a blank panel.
        $this->assertStringContainsString('"something-new"', AnalysisNotice::reasonText('something-new'));
    }

    public function test_never_analysed_is_an_outcome_and_not_an_empty_screen(): void
    {
        $panel = AnalysisNotice::panel(null, 'UTC');
        $this->assertStringContainsString('No analysis has been run for this site yet', $panel['text']);

        // …and a site whose FIRST run failed says both halves.
        $firstFailed = ['analyzedAt' => null, 'metrics' => null, 'computed' => null,
                        'lastRun' => ['outcome' => 'failed', 'reason' => 'site-settings-unavailable'],
                        'status' => 'failed'];
        $text = AnalysisNotice::panel($firstFailed, 'UTC')['text'];
        $this->assertStringContainsString('No analysis has been run', $text);
        $this->assertStringContainsString('the site settings did not load', $text);
    }

    public function test_an_ordinary_fresh_result_says_nothing(): void
    {
        $p = ['analyzedAt' => now()->toISOString(), 'metrics' => ['x' => 1], 'computed' => null,
              'lastRun' => ['outcome' => 'complete'], 'status' => 'complete'];
        $this->assertNull(AnalysisNotice::panel($p, 'UTC'), 'a panel on a page that has nothing to report is noise');
    }

    public function test_an_old_result_still_says_how_old_it_is(): void
    {
        $p = ['analyzedAt' => now()->subDays(9)->toISOString(), 'metrics' => ['x' => 1], 'computed' => null,
              'lastRun' => ['outcome' => 'complete'], 'status' => 'complete'];
        $this->assertStringContainsString('9 days old', AnalysisNotice::panel($p, 'UTC')['text']);
    }

    // ── 4. It reaches every screen that prints the numbers ─────────────────

    /**
     * The plan's own acceptance for this stage, and the reason it is a rendered
     * page rather than a `grep` of the templates: the failure being guarded
     * against is one screen not being wired up, which a template search cannot
     * tell from a screen that is.
     *
     * Remove the include from any one of these views and exactly one case here
     * goes red, naming it.
     */
    public function test_the_reason_reaches_every_screen_that_prints_the_numbers(): void
    {
        [$user, $site] = $this->siteFor('manager');
        AnalysisResults::record($user, $site, $this->aResult());
        AnalysisResults::recordFailure($user, $site, [
            'runId' => 'run-bad', 'reason' => 'calculation-error', 'detail' => ['message' => 'cascade exploded'],
        ]);
        $user->forceFill(['last_active_site_id' => $site->id])->save();

        foreach (self::SCREENS as $url) {
            $r = $this->actingAs($user->fresh())->get($url);
            $this->assertSame(200, $r->getStatusCode(), $url.' did not render (status '.$r->getStatusCode().')');
            $html = $r->getContent();
            $this->assertStringContainsString('db-analysis-notice', $html, $url.' has no panel at all');
            $this->assertStringContainsString('did not complete', $html, $url.' prints the numbers without saying the re-run failed');
            $this->assertStringContainsString('cascade exploded', $html, $url.' does not carry the reason');
        }
    }

    public function test_the_pill_carries_the_mark_on_every_screen(): void
    {
        [$user, $site] = $this->siteFor('manager');
        AnalysisResults::record($user, $site, $this->aResult());
        AnalysisResults::recordFailure($user, $site, ['runId' => 'run-bad', 'reason' => 'calculation-error']);
        $user->forceFill(['last_active_site_id' => $site->id])->save();

        foreach (self::SCREENS as $url) {
            $html = $this->actingAs($user->fresh())->get($url)->assertOk()->getContent();
            $this->assertStringContainsString('re-run failed', $html, $url.' pill is not marked');
        }
    }

    /**
     * The two templates the plan counts and the routes do not reach.
     *
     * `/analysis/growth-light` and `/analysis/disease` each carry their own copy
     * of the topbar — the exact place a mark added once fails to arrive — and
     * each is a `redirect()` today. Asserted rather than assumed on both sides:
     * the route really does redirect, and the template really is wired, so
     * reviving the route does not quietly revive a screen that says nothing.
     */
    public function test_the_two_templates_the_routes_no_longer_reach_are_wired_anyway(): void
    {
        [$user] = $this->siteFor('manager');

        foreach (['/analysis/disease', '/analysis/growth-light'] as $url) {
            $this->actingAs($user)->get($url)->assertRedirect();
        }

        foreach (['analysis/disease.blade.php', 'analysis/growth-light.blade.php'] as $tpl) {
            $src = file_get_contents(resource_path('views/'.$tpl));
            $this->assertStringContainsString("@include('partials.analysis-notice')", $src, $tpl.' has no panel');
            $this->assertStringContainsString("@include('partials.analysis-pill')", $src, $tpl.' has no pill');
        }
    }

    /** The site's completed run, as stored. */
    private function completedRow(Site $site): AnalysisResult
    {
        return AnalysisResult::query()->where('site_id', $site->id)
            ->where('outcome', 'complete')->orderByDesc('id')->firstOrFail();
    }

    private function siteFor(string $role): array
    {
        $user = User::factory()->create();
        $account = Account::query()->firstOrCreate(
            ['owner_user_id' => $user->id],
            ['display_name' => $user->name, 'created_by_user_id' => $user->id, 'modified_by_user_id' => $user->id]
        );
        $site = Site::query()->create([
            'account_id' => $account->id, 'name' => 'Owner Site', 'slug' => 'owner-site',
            'site_type' => 'precinct', 'timezone' => 'UTC',
            'created_by_user_id' => $user->id, 'modified_by_user_id' => $user->id,
        ]);
        $site->users()->attach($user->id, ['role' => $role]);

        return [$user, $site];
    }
}
