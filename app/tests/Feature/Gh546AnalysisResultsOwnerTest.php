<?php

namespace Tests\Feature;

use App\Models\Account;
use App\Models\Site;
use App\Models\AnalysisResult;
use App\Models\SiteConfig;
use App\Models\User;
use App\Support\AnalysisResults;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * GH-546 (stage 1) — the owner of the analysis result, and the check that
 * now stands at its door.
 *
 * WHAT WAS OPEN. `POST /api/analysis-cache` took `site_id` out of the request
 * body and wrote it through `SiteConfigWriter::mutate` without asking whether
 * the caller had any business with that site — no `canEditSite`, no
 * `canViewSite`, no `authorize`, no `abort`. Forty-two lines, one method, and
 * the route sat in the ordinary `auth` group, so any signed-in person could
 * replace any site's analysis result by naming its id. `SampleController` has
 * had `canEditSite` in six places all along; this route had it in none.
 *
 * WHERE THE CHECK LIVES AND WHY NOT IN THE CONTROLLER. At the service entrance.
 * Stage 2 adds a second route — the run reporting that it FAILED — and a check
 * copied into two controllers is a check that will be in one of them. Six copies
 * in `SampleController` is the shape being avoided, not followed.
 *
 * AND AN UNKNOWN SITE IS A 404. `site_id` went straight to `mutate`, which
 * creates the row it cannot find; the producer falls back to the literal string
 * `'default'` when the page has no active site, so an orphan configuration row
 * for a site that does not exist was one missing pointer away.
 */
class Gh546AnalysisResultsOwnerTest extends TestCase
{
    use RefreshDatabase;
    use \Tests\Feature\Concerns\BuildsAnalysisResults;

    /**
     * A result in the declared form.
     *
     * GH-553: two keys is not a result any more — the server refuses a body
     * missing any of the thirteen the schema requires, so the fixture carries
     * all of them and names the two it cares about. It is a method rather than a
     * constant because the key list is read from the schema, not copied here.
     *
     * @return array<string,mixed>
     */
    private function aResult(array $over = []): array
    {
        return array_merge([
            'metrics'    => $this->completeMetrics(['timestamp' => '2026-09-22T00:00:00Z', 'growthPotential' => 0.8]),
            'computed'   => ['climate' => ['ok' => true]],
            'analyzedAt' => '2026-09-22T00:00:00Z',
            // GH-550: the run signature is a NOT NULL column, so every fixture
            // carries one — the same thing the route has required since GH-548.
            'runId'      => 'run-fixture',
        ], $over);
    }

    public function test_a_manager_may_record_a_result_for_their_own_site(): void
    {
        [$user, $site] = $this->siteFor('manager');

        AnalysisResults::record($user, $site, $this->aResult());

        // GH-550 (stage 4): the storage is `analysis_results`, one row per run.
        // The assertion is unchanged in meaning — the numbers landed where the
        // owner puts them — and it names the new place rather than the old one,
        // so a move that half-happened cannot pass by reading the wrong table.
        $row = AnalysisResult::query()->where('site_id', $site->id)->first();
        $this->assertNotNull($row);
        $this->assertSame('complete', $row->outcome);
        $this->assertSame(0.8, $row->metrics['growthPotential']);
        // and the settings table is not carrying it any more
        $this->assertSame(0, SiteConfig::query()->where('site_id', $site->id)
            ->where('namespace', 'analysis_cache')->count());
    }

    public function test_a_viewer_is_refused_and_the_row_is_not_touched(): void
    {
        [$owner, $site] = $this->siteFor('manager');
        AnalysisResults::record($owner, $site, $this->aResult());
        $beforeHash = md5(json_encode(AnalysisResult::query()
            ->where('site_id', $site->id)->orderBy('id')->get()->toArray()));

        $viewer = User::factory()->create();
        $site->users()->attach($viewer->id, ['role' => 'viewer']);

        // Looking at the numbers is not replacing them. The owner's decision of
        // 22.09: "if someone only has view rights, Re-run is not available".
        $this->expectException(\Symfony\Component\HttpKernel\Exception\HttpException::class);
        try {
            AnalysisResults::record($viewer, $site, [
                'metrics' => $this->completeMetrics(['timestamp' => 'x', 'growthPotential' => 0.1]),
                'computed' => null, 'runId' => 'run-viewer',
            ]);
        } finally {
            // The refusal is not the point on its own — the rows surviving are.
            // GH-550: the hash now covers EVERY row for the site, not one row's
            // config, because a refused write that appended a row instead of
            // replacing one would otherwise leave the first row intact and pass.
            $this->assertSame($beforeHash, md5(json_encode(AnalysisResult::query()
                ->where('site_id', $site->id)->orderBy('id')->get()->toArray())));
        }
    }

    public function test_a_stranger_cannot_record_against_someone_elses_site(): void
    {
        [, $site] = $this->siteFor('manager');
        $stranger = User::factory()->create();

        $this->expectException(\Symfony\Component\HttpKernel\Exception\HttpException::class);
        AnalysisResults::record($stranger, $site, $this->aResult());
    }

    public function test_the_route_refuses_an_unknown_site_with_404_and_creates_no_row(): void
    {
        [$user] = $this->siteFor('manager');

        // `'default'` is the literal the producer falls back to when the page
        // has no active site. Before this stage it would have created a
        // configuration row for a site that does not exist.
        $this->actingAs($user)
            ->postJson('/api/analysis-cache', [
                'site_id'     => 'default',
                'run_id'      => 'run-404',
                'analyzed_at' => '2026-09-22T00:00:00Z',
                'metrics'     => $this->completeMetrics(['timestamp' => 'x']),
            ])
            ->assertStatus(404);

        $this->assertSame(0, SiteConfig::query()->where('site_id', 'default')->count());
        $this->assertSame(0, AnalysisResult::query()->where('site_id', 'default')->count());
    }

    public function test_the_route_refuses_a_viewer_with_403(): void
    {
        [, $site] = $this->siteFor('manager');
        $viewer = User::factory()->create();
        $site->users()->attach($viewer->id, ['role' => 'viewer']);

        $this->actingAs($viewer)
            ->postJson('/api/analysis-cache', [
                'site_id'     => $site->id,
                'run_id'      => 'run-403',
                'analyzed_at' => '2026-09-22T00:00:00Z',
                'metrics'     => $this->completeMetrics(['timestamp' => 'x']),
            ])
            ->assertStatus(403);

        $this->assertSame(0, AnalysisResult::query()->where('site_id', $site->id)->count());
    }

    /**
     * GH-549 (reviewer's finding on GH-548): `run_id` is required in the code
     * and nothing held it there.
     *
     * Turning `required` into `nullable` on both ends left the whole suite
     * green, because every case in this file supplies one. That is not a
     * formality: the run signature exists so that a failure mark and a set of
     * numbers are about the SAME attempt. Loosen the rule and the server accepts
     * an unsigned result, the link is lost, and nothing says so.
     */
    public function test_a_result_without_its_run_is_refused(): void
    {
        [$user, $site] = $this->siteFor('manager');

        $this->actingAs($user)
            ->postJson('/api/analysis-cache', [
                'site_id'     => $site->id,
                'analyzed_at' => '2026-09-22T00:00:00Z',
                'metrics'     => $this->completeMetrics(['timestamp' => 'x']),
            ])
            ->assertStatus(422)
            ->assertJsonValidationErrors('run_id');

        $this->assertSame(0, AnalysisResult::query()->where('site_id', $site->id)->count());
    }

    public function test_a_failure_report_without_its_run_is_refused(): void
    {
        [$user, $site] = $this->siteFor('manager');

        $this->actingAs($user)
            ->postJson('/api/analysis-cache/runs', [
                'site_id' => $site->id,
                'outcome' => 'failed',
                'reason'  => 'calculation-error',
            ])
            ->assertStatus(422)
            ->assertJsonValidationErrors('run_id');
    }

    public function test_the_projection_is_one_shape_for_every_reader(): void
    {
        [$user, $site] = $this->siteFor('manager');
        AnalysisResults::record($user, $site, $this->aResult());

        $p = AnalysisResults::forSite($site->fresh());

        // The shape eight controllers used to build by hand, plus the two fields
        // the run fills. GH-548: they are no longer empty — every write, the
        // successful one and the failed one, leaves a `last_run` behind, and a
        // completed run's result is signed with the run that produced it.
        // GH-557 added `numbersFrom`: which run the numbers on screen came from.
        // Without it a reader cannot tell the ordinary case from the one where a
        // site's only run was partial and its figures are being shown anyway.
        $this->assertSame(
            ['metrics', 'computed', 'analyzedAt', 'lastRun', 'status', 'numbersFrom'],
            array_keys($p)
        );
        $this->assertSame(0.8, $p['metrics']['growthPotential']);
        $this->assertNotNull($p['analyzedAt']);
        $this->assertSame('complete', $p['status']);
        $this->assertSame('complete', $p['lastRun']['outcome']);
    }

    public function test_a_site_that_was_never_analysed_projects_to_null_not_to_empty_numbers(): void
    {
        [, $site] = $this->siteFor('manager');

        // Not `['metrics' => null, ...]`: the screens distinguish "no result" from
        // "a result with nothing in it", and so must the projection.
        $this->assertNull(AnalysisResults::forSite($site));
        $this->assertNull(AnalysisResults::forSite(null));
    }

    public function test_many_sites_come_back_keyed_and_in_one_pass(): void
    {
        [$user, $a] = $this->siteFor('manager');
        $b = $this->extraSite($user, 'Second', 'second-site');
        AnalysisResults::record($user, $a, $this->aResult());

        $all = AnalysisResults::forSites([$a->id, $b->id]);

        $this->assertSame([$a->id, $b->id], array_keys($all));
        $this->assertNotNull($all[$a->id]);
        // A site with no result is present with null rather than absent — the
        // topbar needs an entry per site to draw its dot.
        $this->assertNull($all[$b->id]);
    }

    public function test_the_status_map_uses_the_canonical_growth_potential_thresholds(): void
    {
        [$user, $site] = $this->siteFor('manager');

        foreach ([[0.85, 'green'], [0.5, 'amber'], [0.1, 'red']] as $i => [$gp, $expected]) {
            AnalysisResults::record($user, $site, [
                'metrics'  => $this->completeMetrics(['timestamp' => 'x', 'growthPotential' => $gp]),
                'computed' => null, 'analyzedAt' => '2026-09-22T00:00:00Z',
                'runId'    => 'run-gp-'.$i,
            ]);
            $map = AnalysisResults::statusMap([$site->id]);
            $this->assertSame($expected, $map[$site->id], 'gp '.$gp);
        }
    }

    /** @return array{0: User, 1: Site} */
    private function siteFor(string $role): array
    {
        $user = User::factory()->create();
        $account = Account::query()->firstOrCreate(
            ['owner_user_id' => $user->id],
            ['display_name' => $user->name, 'created_by_user_id' => $user->id, 'modified_by_user_id' => $user->id]
        );
        $site = Site::query()->create([
            'account_id' => $account->id, 'name' => 'Owner Site', 'slug' => 'owner-site',
            'site_type' => 'precinct',
            'created_by_user_id' => $user->id, 'modified_by_user_id' => $user->id,
        ]);
        $site->users()->attach($user->id, ['role' => $role]);

        return [$user, $site];
    }

    private function extraSite(User $user, string $name, string $slug): Site
    {
        $account = Account::query()->where('owner_user_id', $user->id)->firstOrFail();
        $site = Site::query()->create([
            'account_id' => $account->id, 'name' => $name, 'slug' => $slug, 'site_type' => 'precinct',
            'created_by_user_id' => $user->id, 'modified_by_user_id' => $user->id,
        ]);
        $site->users()->attach($user->id, ['role' => 'manager']);

        return $site;
    }
}
