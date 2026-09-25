<?php

namespace Tests\Feature;

use App\Models\Account;
use App\Models\AnalysisResult;
use App\Models\Site;
use App\Models\SiteConfig;
use App\Models\User;
use App\Support\AnalysisResults;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

/**
 * GH-550 (stage 4) — the analysis result moves into its own table, and the
 * readers do not notice.
 *
 * ACCEPTED BY THE OWNER, 22.09.2026: "I think a separate table is better."
 *
 * THE PROMISE THE STAGE ORDER RESTS ON. Stage 4 comes after 1-3 rather than
 * instead of them because the service makes the storage swap invisible: nine
 * readers take one projection, so moving what is behind it changes nothing for
 * them. That is a claim about behaviour, so it is measured here rather than
 * asserted — the last group renders the pages and compares what they print with
 * what they printed out of the old storage.
 *
 * WHAT THE MIGRATION HAS TO GET RIGHT, and each is its own case below: the
 * numbers arrive unchanged, their date arrives unchanged, a failure recorded
 * against them travels as its own row, the settings table stops carrying any of
 * it, and `down()` puts it back.
 */
class Gh550AnalysisResultsTableTest extends TestCase
{
    use RefreshDatabase;
    use \Tests\Feature\Concerns\BuildsAnalysisResults;

    /** GH-553: a result in the declared form — see the trait. */
    private function aResult(array $over = []): array
    {
        return array_merge([
            'metrics'    => $this->completeMetrics(['timestamp' => '2026-09-18T11:26:00Z', 'growthPotential' => 0.8]),
            'computed'   => ['climate' => ['ok' => true], 'soilNutrition' => ['nutrients' => []]],
            'analyzedAt' => '2026-09-18T11:26:00Z',
            'runId'      => 'run-1',
        ], $over);
    }

    // ── The table and what it is for ───────────────────────────────────────

    public function test_the_table_exists_and_carries_the_facts_of_a_run(): void
    {
        $this->assertTrue(Schema::hasTable('analysis_results'));
        foreach (['site_id', 'run_id', 'outcome', 'reason', 'started_at', 'completed_at',
                  'inputs', 'metrics', 'computed', 'detail'] as $column) {
            $this->assertTrue(Schema::hasColumn('analysis_results', $column), $column.' is missing');
        }
    }

    public function test_a_run_is_a_row_and_a_second_run_does_not_overwrite_the_first(): void
    {
        [$user, $site] = $this->siteFor('manager');

        AnalysisResults::record($user, $site, $this->aResult());
        AnalysisResults::record($user, $site, array_merge($this->aResult(), [
            'runId' => 'run-2', 'analyzedAt' => '2026-09-22T09:00:00Z',
            'metrics' => $this->completeMetrics(['timestamp' => 'x', 'growthPotential' => 0.4]),
        ]));

        // The old storage had one row per site and the first result was gone.
        $this->assertSame(2, AnalysisResult::query()->where('site_id', $site->id)->count());

        // The screen reads the latest.
        $p = AnalysisResults::forSite($site->fresh());
        $this->assertSame(0.4, $p['metrics']['growthPotential']);
        $this->assertSame('run-2', $p['lastRun']['runId']);
    }

    public function test_a_failure_is_its_own_row_and_the_numbers_keep_their_own_date(): void
    {
        [$user, $site] = $this->siteFor('manager');
        AnalysisResults::record($user, $site, $this->aResult());

        AnalysisResults::recordFailure($user, $site, [
            'runId' => 'run-2', 'reason' => 'weather-unavailable', 'detail' => ['lastError' => 'timeout'],
        ]);

        // Two rows, one of each kind — and the read-modify-write that used to be
        // needed to keep them in one row is gone with it.
        $this->assertSame(1, AnalysisResult::query()->where('site_id', $site->id)->where('outcome', 'complete')->count());
        $this->assertSame(1, AnalysisResult::query()->where('site_id', $site->id)->where('outcome', 'failed')->count());

        $p = AnalysisResults::forSite($site->fresh());
        $this->assertSame('2026-09-18T11:26:00.000000Z', $p['analyzedAt']);
        $this->assertSame(0.8, $p['metrics']['growthPotential']);
        $this->assertSame('failed', $p['status']);
        $this->assertSame('weather-unavailable', $p['lastRun']['reason']);
        // A failed run has no numbers, and the row says so rather than repeating
        // somebody else's.
        $failed = AnalysisResult::query()->where('site_id', $site->id)->where('outcome', 'failed')->first();
        $this->assertNull($failed->metrics);
        $this->assertNull($failed->computed);
    }

    public function test_the_settings_table_never_carries_a_result_again(): void
    {
        [$user, $site] = $this->siteFor('manager');
        AnalysisResults::record($user, $site, $this->aResult());
        AnalysisResults::recordFailure($user, $site, ['runId' => 'r2', 'reason' => 'calculation-error']);

        $this->assertSame(0, SiteConfig::query()->where('namespace', 'analysis_cache')->count());
    }

    // ── The migration ──────────────────────────────────────────────────────

    /**
     * The move, driven on a row shaped exactly like the twelve on the stand: a
     * `site_configs` row under `analysis_cache` with `metrics`, `computed` and a
     * `synced_at`.
     *
     * The migration has already run by the time a test starts, so the row is put
     * back the way it stood and the migration's own `up()` is invoked again —
     * which is also the only honest way to test it, since re-running it must be
     * the same as running it once.
     */
    public function test_an_old_row_moves_across_with_its_numbers_and_its_date(): void
    {
        [, $site] = $this->siteFor('manager');
        $this->seedLegacyRow($site, [
            'metrics'  => ['timestamp' => '2026-09-01T06:00:00Z', 'growthPotential' => 0.62],
            'computed' => ['climate' => ['gdd' => 11]],
        ], '2026-09-01 06:00:00');

        $this->runMove();

        $row = AnalysisResult::query()->where('site_id', $site->id)->firstOrFail();
        $this->assertSame('complete', $row->outcome);
        $this->assertSame(0.62, $row->metrics['growthPotential']);
        $this->assertSame(11, $row->computed['climate']['gdd']);
        $this->assertSame('2026-09-01 06:00:00', $row->completed_at->format('Y-m-d H:i:s'));
        // The run these rows cannot name is named as what it is, not guessed at.
        $this->assertStringStartsWith('migrated-', $row->run_id);

        // and the settings row is gone
        $this->assertSame(0, SiteConfig::query()->where('namespace', 'analysis_cache')->count());

        // What the screen reads is what it read before the move.
        $p = AnalysisResults::forSite($site->fresh());
        $this->assertSame(0.62, $p['metrics']['growthPotential']);
        $this->assertSame('2026-09-01T06:00:00.000000Z', $p['analyzedAt']);
    }

    public function test_a_failure_recorded_in_the_old_shape_arrives_as_its_own_row(): void
    {
        [, $site] = $this->siteFor('manager');
        $this->seedLegacyRow($site, [
            'metrics'  => ['growthPotential' => 0.5],
            'computed' => null,
            'last_run' => [
                'runId' => 'run-bad', 'outcome' => 'failed', 'reason' => 'calculation-error',
                'detail' => ['message' => 'boom'], 'failedAt' => '2026-09-20T10:00:00Z',
            ],
        ], '2026-09-01 06:00:00');

        $this->runMove();

        $this->assertSame(2, AnalysisResult::query()->where('site_id', $site->id)->count());
        $p = AnalysisResults::forSite($site->fresh());
        // The screen says exactly what it said before the move: these numbers,
        // from then, and a re-run that failed for this reason.
        $this->assertSame(0.5, $p['metrics']['growthPotential']);
        $this->assertSame('failed', $p['status']);
        $this->assertSame('calculation-error', $p['lastRun']['reason']);
        $this->assertSame('boom', $p['lastRun']['detail']['message']);
        $this->assertSame('run-bad', $p['lastRun']['runId']);
    }

    /**
     * GH-551 — the same defect the other way round, found by the round trip the
     * reviewer's finding made me write.
     *
     * `up()` wrote one `complete` row for every `analysis_cache` row it saw. A
     * row that GH-548 left with no numbers and only a failed `last_run` — the
     * "the first run failed" state — would have arrived as a COMPLETED run with
     * `metrics` null: the screen would then say the analysis is current and show
     * nothing. Where `down()` deleted that state, `up()` invented a result out
     * of it.
     *
     * Not reachable on the stand: all twelve rows carry `metrics` and none
     * carries `last_run` (measured 22.09.2026). Reachable the moment a re-run
     * fails on a site that has never completed one.
     */
    public function test_an_old_row_with_no_numbers_does_not_become_a_completed_run(): void
    {
        [, $site] = $this->siteFor('manager');
        $this->seedLegacyRow($site, [
            'metrics'  => null,
            'computed' => null,
            'last_run' => [
                'runId' => 'run-bad', 'outcome' => 'failed', 'reason' => 'weather-unavailable',
                'detail' => null, 'failedAt' => '2026-09-20T10:00:00Z',
            ],
        ], '2026-09-01 06:00:00');

        $this->runMove();

        $this->assertSame(0, AnalysisResult::query()->where('outcome', 'complete')->count(),
            'a row with no numbers was written as a completed run');
        $this->assertSame(1, AnalysisResult::query()->where('outcome', 'failed')->count());

        $p = AnalysisResults::forSite($site->fresh());
        $this->assertNull($p['metrics']);
        $this->assertNull($p['analyzedAt'], 'a run that produced nothing dated the nothing');
        $this->assertSame('failed', $p['status']);
        $this->assertSame('weather-unavailable', $p['lastRun']['reason']);
    }

    /**
     * And the completed row is signed by the run that produced the NUMBERS, not
     * by the attempt that failed to replace them.
     */
    public function test_a_migrated_result_is_not_stamped_with_the_failed_runs_signature(): void
    {
        [, $site] = $this->siteFor('manager');
        $this->seedLegacyRow($site, [
            'metrics'  => ['growthPotential' => 0.7],
            'computed' => null,
            'last_run' => ['runId' => 'run-bad', 'outcome' => 'failed', 'reason' => 'calculation-error'],
        ], '2026-09-01 06:00:00');

        $this->runMove();

        $done = AnalysisResult::query()->where('outcome', 'complete')->firstOrFail();
        $this->assertNotSame('run-bad', $done->run_id);
        $this->assertStringStartsWith('migrated-', $done->run_id);
        $this->assertSame('run-bad', AnalysisResult::query()->where('outcome', 'failed')->firstOrFail()->run_id);
    }

    public function test_the_move_is_reversible(): void
    {
        [$user, $site] = $this->siteFor('manager');
        AnalysisResults::record($user, $site, $this->aResult());
        AnalysisResults::recordFailure($user, $site, [
            'runId' => 'run-2', 'reason' => 'weather-unavailable', 'detail' => ['lastError' => 'timeout'],
        ]);

        $this->migration()->down();

        $row = SiteConfig::query()->where('site_id', $site->id)
            ->where('namespace', 'analysis_cache')->firstOrFail();
        $this->assertSame(0.8, $row->config['metrics']['growthPotential']);
        $this->assertSame('failed', $row->config['last_run']['outcome']);
        $this->assertSame('weather-unavailable', $row->config['last_run']['reason']);
        $this->assertSame('2026-09-18 11:26:00', $row->synced_at->format('Y-m-d H:i:s'));
        $this->assertSame(0, AnalysisResult::query()->count());
    }

    /**
     * GH-551 (reviewer's required finding on GH-550): the rollback used to
     * delete a site whose only run had failed.
     *
     * `down()` walked the COMPLETED rows, so a site that had never completed one
     * got no `site_configs` row — and the table was then emptied, taking its
     * only record with it. The reviewer's measurement: drop `record()` from the
     * reversibility test above, leaving only `recordFailure()`, and the restored
     * row is not missing a field, it is missing.
     *
     * And it is not a state the old shape could not hold. It is the state
     * GH-548 taught the screen to print — "no analysis has been run for this
     * site yet", plus the reason — and `Gh548AnalysisNoticeTest` pins it.
     */
    public function test_a_site_whose_only_run_failed_survives_the_rollback(): void
    {
        [$user, $site] = $this->siteFor('manager');
        AnalysisResults::recordFailure($user, $site, [
            'runId' => 'run-only', 'reason' => 'site-settings-unavailable', 'detail' => ['reason' => 'sites-fetch'],
        ]);

        $before = AnalysisResults::forSite($site->fresh());

        $this->migration()->down();

        $row = SiteConfig::query()->where('site_id', $site->id)
            ->where('namespace', 'analysis_cache')->first();
        $this->assertNotNull($row, 'the rollback deleted the site’s only record');
        $this->assertNull($row->config['metrics'], 'numbers appeared where a failed run produced none');
        $this->assertNull($row->config['computed']);
        // A run that produced nothing does not date the nothing.
        $this->assertNull($row->synced_at);
        $this->assertSame('failed', $row->config['last_run']['outcome']);
        $this->assertSame('site-settings-unavailable', $row->config['last_run']['reason']);
        $this->assertSame('sites-fetch', $row->config['last_run']['detail']['reason']);
        $this->assertSame('run-only', $row->config['last_run']['runId']);

        // The round trip, which is the property rather than the field list: move
        // it forward again and the screen reads what it read before.
        $this->runMove();
        $after = AnalysisResults::forSite($site->fresh());
        $this->assertSame($before['status'], $after['status']);
        $this->assertNull($after['metrics']);
        $this->assertNull($after['analyzedAt']);
        $this->assertSame($before['lastRun']['reason'], $after['lastRun']['reason']);
        $this->assertSame($before['lastRun']['runId'], $after['lastRun']['runId']);
    }

    /**
     * What the rollback does NOT bring back, asserted so the docblock's list is
     * a measurement rather than a claim.
     *
     * The old shape holds one row per site and this table holds one per run, so
     * collapsing them loses every run but the latest of each kind — including
     * runs recorded after the move, which on a stand is nothing and after a week
     * of real use is that week. Named in the migration's docblock; here it is
     * shown, because a limitation nobody has run into is a limitation nobody
     * believes.
     */
    public function test_the_rollback_keeps_the_latest_run_of_each_kind_and_no_more(): void
    {
        [$user, $site] = $this->siteFor('manager');
        AnalysisResults::record($user, $site, $this->aResult());
        AnalysisResults::record($user, $site, array_merge($this->aResult(), [
            'runId' => 'run-2', 'analyzedAt' => '2026-09-20T09:00:00Z',
            'metrics' => $this->completeMetrics(['growthPotential' => 0.55]),
        ]));
        AnalysisResults::recordFailure($user, $site, ['runId' => 'run-3', 'reason' => 'calculation-error']);
        $this->assertSame(3, AnalysisResult::query()->where('site_id', $site->id)->count());

        $this->migration()->down();

        $row = SiteConfig::query()->where('site_id', $site->id)
            ->where('namespace', 'analysis_cache')->firstOrFail();
        // The latest completed run's numbers, and the latest attempt's outcome.
        $this->assertSame(0.55, $row->config['metrics']['growthPotential']);
        $this->assertSame('run-3', $row->config['last_run']['runId']);
        // The first completed run is gone, and there is nowhere it could have
        // been kept: one row per site is the old shape.
        $this->assertStringNotContainsString('run-1', json_encode($row->config));
        $this->assertSame(0, AnalysisResult::query()->count());
    }

    public function test_a_site_with_no_result_is_left_alone_by_the_move(): void
    {
        [, $site] = $this->siteFor('manager');
        // Positive control for the cases above: the move is not a thing that
        // writes a row for every site it sees.
        $this->runMove();
        $this->assertSame(0, AnalysisResult::query()->where('site_id', $site->id)->count());
        $this->assertNull(AnalysisResults::forSite($site->fresh()));
    }

    // ── The readers did not notice ─────────────────────────────────────────

    /**
     * The claim the stage order is built on, measured on the screens rather than
     * argued from the code: the four pages that print analysis numbers print the
     * same thing out of the new storage as they did out of the old.
     */
    public function test_the_screens_read_the_new_storage_without_being_told(): void
    {
        [$user, $site] = $this->siteFor('manager');
        AnalysisResults::record($user, $site, $this->aResult());
        AnalysisResults::recordFailure($user, $site, [
            'runId' => 'run-2', 'reason' => 'calculation-error', 'detail' => ['message' => 'cascade exploded'],
        ]);
        $user->forceFill(['last_active_site_id' => $site->id])->save();
        // GH-708: the wizard lock redirects a page whose site has not answered what the
        // calculation needs. This fixture's subject is the page, not the answers.
        $this->giveTheSiteWhatTheLockNeeds($site);

        foreach (['/dashboard', '/plan', '/reports/accuracy', '/analysis'] as $url) {
            $html = $this->actingAs($user->fresh())->get($url)->assertOk()->getContent();
            $this->assertStringContainsString('Sep 18 11:26', $html, $url.' lost the date of the numbers');
            $this->assertStringContainsString('re-run failed', $html, $url.' lost the failure mark');
            $this->assertStringContainsString('cascade exploded', $html, $url.' lost the reason');
        }
    }

    public function test_the_status_dot_still_comes_from_the_result(): void
    {
        [$user, $site] = $this->siteFor('manager');
        AnalysisResults::record($user, $site, $this->aResult());

        $this->assertSame(['green'], array_values(AnalysisResults::statusMap([$site->id])));
    }

    public function test_many_sites_come_back_keyed_and_the_query_count_does_not_grow_with_them(): void
    {
        [$user, $site] = $this->siteFor('manager');
        $b = $this->extraSite($user, 'Second', 'second');
        $c = $this->extraSite($user, 'Third', 'third');
        AnalysisResults::record($user, $site, $this->aResult());
        AnalysisResults::record($user, $c, array_merge($this->aResult(), ['runId' => 'run-c']));

        DB::flushQueryLog();
        DB::enableQueryLog();
        $all = AnalysisResults::forSites([$site->id, $b->id, $c->id]);
        $queries = count(DB::getQueryLog());
        DB::disableQueryLog();

        $this->assertNotNull($all[$site->id]);
        $this->assertNull($all[$b->id], 'a site that was never analysed came back as something');
        $this->assertNotNull($all[$c->id]);
        // Six at most: the latest run of each outcome that matters per site —
        // complete, any, and partial — each a sub-select plus its fetch. GH-557
        // added the third pair. Still a constant, which is the property: not one
        // per site, because the topbar composer runs on every page with a
        // switcher.
        $this->assertLessThanOrEqual(6, $queries, 'forSites went per-site: '.$queries.' queries for 3 sites');
    }

    // ── helpers ────────────────────────────────────────────────────────────

    private function migration(): object
    {
        return require base_path('database/migrations/2026_09_22_000001_move_analysis_cache_into_analysis_results.php');
    }

    private function runMove(): void
    {
        $this->migration()->up();
    }

    private function seedLegacyRow(Site $site, array $config, string $syncedAt): void
    {
        DB::table('site_configs')->insert([
            'site_id'    => $site->id,
            'namespace'  => 'analysis_cache',
            'config'     => json_encode($config),
            'synced_at'  => $syncedAt,
            'created_at' => $syncedAt,
            'updated_at' => $syncedAt,
        ]);
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

    private function extraSite(User $user, string $name, string $slug): Site
    {
        $site = Site::query()->create([
            'account_id' => $user->activeSite?->account_id ?? Account::query()->first()->id,
            'name' => $name, 'slug' => $slug, 'site_type' => 'precinct', 'timezone' => 'UTC',
            'created_by_user_id' => $user->id, 'modified_by_user_id' => $user->id,
        ]);
        $site->users()->attach($user->id, ['role' => 'manager']);

        return $site;
    }
}
