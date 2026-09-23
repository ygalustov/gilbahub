<?php

namespace Tests\Feature;

use App\Models\Account;
use App\Models\AnalysisResult;
use App\Models\Site;
use App\Models\User;
use App\Support\AnalysisResults;
use App\Support\AnalysisResultSchema;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\Feature\Concerns\BuildsAnalysisResults;
use Tests\TestCase;

/**
 * GH-558 (reviewer's finding on GH-557) — the rule applied to the rows that
 * predate it, and the piece of the rule that would have made that pointless.
 *
 * THE FINDING. GH-557 derives a run's outcome at write time and the projection
 * reads the stored column, so rows written earlier keep the word they were
 * given. Federal Golf's live re-run — six of thirteen keys — still says
 * `complete`, so the panel returns null and the pill reads as an ordinary fresh
 * analysis: the exact state the third outcome exists to end, surviving on the
 * one site where it occurs.
 *
 * THE PIECE THAT WOULD HAVE MADE A RECOMPUTE POINTLESS. `nullsIn()` counts keys
 * that are PRESENT and null — right for a body arriving over the route, where
 * a missing key is a 422 and null is the only way to say "not computed", and
 * wrong for an old row, which carries five or six keys and no more. Run over
 * those rows it reports nothing uncomputed and calls them complete a second
 * time. `uncomputedIn()` is the question about a RESULT: absent and null are the
 * same fact about the analysis.
 */
class Gh558RecomputeOutcomesTest extends TestCase
{
    use RefreshDatabase;
    use BuildsAnalysisResults;

    // ── The piece of the rule ──────────────────────────────────────────────

    public function test_an_absent_required_value_counts_as_not_computed(): void
    {
        // The shape of a row written before GH-553: a handful of keys, the rest
        // simply not there.
        $old = ['timestamp' => 'x', 'growthPotential' => 0.5, 'soilTemp' => null];

        // The old question answers "one", which is how these rows stayed
        // invisible…
        $this->assertSame(['soilTemp'], AnalysisResultSchema::nullsIn($old));
        // …and the question about a result answers with all of them.
        $uncomputed = AnalysisResultSchema::uncomputedIn($old);
        $this->assertCount(11, $uncomputed);
        $this->assertContains('diseaseRisk', $uncomputed);
        $this->assertContains('soilTemp', $uncomputed);
        $this->assertNotContains('timestamp', $uncomputed);
        $this->assertNotContains('growthPotential', $uncomputed);
    }

    public function test_the_two_questions_agree_on_a_body_that_came_through_the_route(): void
    {
        // The control: for everything written since GH-553 the distinction does
        // not exist, which is why it went unnoticed.
        $body = $this->partialMetrics($this->federalGolfNulls());
        $this->assertSame(
            AnalysisResultSchema::nullsIn($body),
            AnalysisResultSchema::uncomputedIn($body)
        );
    }

    // ── The recompute ──────────────────────────────────────────────────────

    public function test_the_dry_run_reports_and_writes_nothing(): void
    {
        [$user, $site] = $this->siteFor();
        $this->legacyRow($site, ['timestamp' => 'x', 'growthPotential' => 0.5], 'migrated-8');

        $this->artisan('analysis:recompute-outcomes --dry-run')
            ->expectsOutputToContain('DRY RUN')
            ->expectsOutputToContain('complete → partial : 1')
            ->assertSuccessful();

        $this->assertSame('complete', AnalysisResult::query()->firstOrFail()->outcome);
    }

    public function test_a_row_with_uncomputed_values_is_restated_and_says_which(): void
    {
        [$user, $site] = $this->siteFor();
        $row = $this->legacyRow($site, ['timestamp' => 'x', 'growthPotential' => 0.5], 'migrated-8');
        $numbersBefore = md5(json_encode([$row->metrics, $row->computed, $row->completed_at, $row->run_id]));

        $this->artisan('analysis:recompute-outcomes')->assertSuccessful();

        $after = AnalysisResult::query()->findOrFail($row->id);
        $this->assertSame('partial', $after->outcome);
        $this->assertSame('values-not-computed', $after->reason);
        $this->assertContains('diseaseRisk', $after->detail['nulls']);
        $this->assertNotEmpty($after->detail['outcomeRecomputedAt']);

        // Nothing about the run itself is re-judged — the numbers are read, not
        // rewritten, and neither is when it ran or which run it was.
        $this->assertSame($numbersBefore,
            md5(json_encode([$after->metrics, $after->computed, $after->completed_at, $after->run_id])));
    }

    public function test_a_row_that_computed_everything_is_left_alone(): void
    {
        // The control. Without it, "it restated the rows" would be satisfied by
        // a command that restates every row.
        [$user, $site] = $this->siteFor();
        AnalysisResults::record($user, $site, [
            'metrics' => $this->completeMetrics(), 'analyzedAt' => '2026-09-22T00:00:00Z', 'runId' => 'r-full',
        ]);

        $this->artisan('analysis:recompute-outcomes')
            ->expectsOutputToContain('complete → partial : 0')
            ->assertSuccessful();

        $this->assertSame('complete', AnalysisResult::query()->firstOrFail()->outcome);
    }

    public function test_failed_and_partial_rows_are_not_touched(): void
    {
        [$user, $site] = $this->siteFor();
        AnalysisResults::recordFailure($user, $site, ['runId' => 'r-bad', 'reason' => 'calculation-error']);
        AnalysisResults::record($user, $site, [
            'metrics' => $this->partialMetrics(['diseaseRisk']),
            'analyzedAt' => '2026-09-22T00:00:00Z', 'runId' => 'r-part',
        ]);

        $this->artisan('analysis:recompute-outcomes')
            ->expectsOutputToContain('left as failed     : 1')
            // GH-573: the report names both directions now, so the label for a
            // row left alone changed with it.
            ->expectsOutputToContain('unchanged partial  : 1')
            ->assertSuccessful();

        $this->assertSame('failed', AnalysisResult::query()->where('run_id', 'r-bad')->firstOrFail()->outcome);
        $this->assertSame('partial', AnalysisResult::query()->where('run_id', 'r-part')->firstOrFail()->outcome);
    }

    public function test_running_it_twice_changes_nothing_the_second_time(): void
    {
        [$user, $site] = $this->siteFor();
        $this->legacyRow($site, ['timestamp' => 'x'], 'migrated-8');

        $this->artisan('analysis:recompute-outcomes')->assertSuccessful();
        $stamp = AnalysisResult::query()->firstOrFail()->detail['outcomeRecomputedAt'];

        $this->artisan('analysis:recompute-outcomes')
            ->expectsOutputToContain('complete → partial : 0')
            ->assertSuccessful();

        $this->assertSame($stamp, AnalysisResult::query()->firstOrFail()->detail['outcomeRecomputedAt'],
            'the second run restamped a row it had already restated');
    }

    // ── What it does for the reader ────────────────────────────────────────

    public function test_after_the_recompute_the_screen_stops_calling_it_a_fresh_analysis(): void
    {
        // The finding, end to end: the specimen's shape goes in silent and comes
        // out named.
        [$user, $site] = $this->siteFor();
        $this->legacyRow($site, ['timestamp' => 'x', 'growthPotential' => 0.5, 'soilTemp' => null], 'run-specimen');
        $user->forceFill(['last_active_site_id' => $site->id])->save();

        $before = $this->actingAs($user->fresh())->get('/dashboard')->assertOk()->getContent();
        // Not the bare word: the page carries the reason dictionary
        // (`GAIP_ANALYSIS_TEXTS`), which contains "incomplete" on every page
        // whatever the row says. What must be absent is what the PILL and the
        // PANEL say.
        $this->assertStringNotContainsString('re-run incomplete', $before, 'the pill was already marked');
        $this->assertStringNotContainsString('This analysis is incomplete', $before, 'the panel was already speaking');

        $this->artisan('analysis:recompute-outcomes')->assertSuccessful();

        $after = $this->actingAs($user->fresh())->get('/dashboard')->assertOk()->getContent();
        $this->assertStringContainsString('re-run incomplete', $after, 'the pill still reads as a fresh analysis');
        $this->assertStringContainsString('This analysis is incomplete', $after, 'the panel is still silent');
        $this->assertStringContainsString('disease', $after, 'it does not say what is missing');
    }

    private function legacyRow(Site $site, array $metrics, string $runId): AnalysisResult
    {
        // Written straight to the table on purpose: the route would refuse this
        // body with a 422, which is exactly why rows of this shape can only
        // predate the rule.
        DB::table('analysis_results')->insert([
            'site_id' => $site->id, 'run_id' => $runId, 'outcome' => 'complete',
            'reason' => null, 'started_at' => null, 'completed_at' => '2026-09-22 04:08:00',
            'inputs' => null, 'metrics' => json_encode($metrics), 'computed' => null, 'detail' => null,
            'created_at' => '2026-09-22 04:08:00', 'updated_at' => '2026-09-22 04:08:00',
        ]);

        return AnalysisResult::query()->where('run_id', $runId)->firstOrFail();
    }

    private function siteFor(): array
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
        $site->users()->attach($user->id, ['role' => 'manager']);

        return [$user, $site];
    }
}
