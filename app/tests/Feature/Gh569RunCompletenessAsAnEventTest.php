<?php

namespace Tests\Feature;

use App\Models\Account;
use App\Models\Site;
use App\Models\User;
use App\Support\AnalysisResults;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Feature\Concerns\BuildsAnalysisResults;
use Tests\TestCase;

/**
 * GH-569 — IS THE RUN COMPLETE, not "are the thirteen values there".
 *
 * THE QUESTION IS STILL THE RIGHT ONE. Every test written before it asked about
 * VALUES: thirteen required metrics, present and not null. None asked whether
 * the run finished — whether every engine it took on produced something. A run
 * can answer the first perfectly and fail the second.
 *
 * THE FIRST ANSWER WAS WRONG AND IS GONE (GH-573). It read the run's journal for
 * the words "blocked", "failed", "error" and inferred a module that had not
 * produced. On the stand that was false: `analysis_results` id 29 says "Wear
 * engine blocked by identity enforcement" and carries a complete fourteen-key
 * `computed.wear` written in the same millisecond. The live case and the rule
 * that replaced it are `Gh571TheVerdictComesFromTheResultTest`.
 *
 * WHAT THIS FILE KEEPS: the completeness question itself, asked of a run that
 * DECLARES what it did not produce. The declaration comes from the pass; whether
 * it is believed is decided against the result, and that is the other file's
 * subject. Here: a declared, real gap makes a run partial, and an ordinary run
 * is not made partial by anything the pass merely said.
 */
class Gh569RunCompletenessAsAnEventTest extends TestCase
{
    use RefreshDatabase;
    use BuildsAnalysisResults;

    /** @var array<string,mixed>|null */
    private static ?array $live = null;

    /** @return array<string,mixed> */
    private static function liveRow(string $which): array
    {
        if (self::$live === null) {
            $raw  = @file_get_contents(base_path('tests/fixtures/q31-analysis-results-live-rows.json'));
            $data = $raw === false ? null : json_decode($raw, true);
            if (! is_array($data) || ! isset($data['specimen']['metrics'])) {
                throw new \RuntimeException('q31-analysis-results-live-rows.json is missing or unreadable');
            }
            self::$live = $data;
        }

        return self::$live[$which];
    }

    /** The receipt for work that succeeded — `note`, level `info`. */
    private static function successReceipt(): array
    {
        return self::liveRow('fullRun')['detail']['warnings'][0];
    }

    public function test_a_run_that_declares_a_gap_is_not_complete(): void
    {
        // Every required value present, and a module the pass took on and did
        // not produce. Completeness counted in values alone would call this
        // complete, which is the whole reason the question exists.
        [$user, $site] = $this->siteFor();

        $row = AnalysisResults::record($user, $site, [
            'metrics'    => $this->completeMetrics(),
            'computed'   => ['disease' => ['diseases' => [1, 2, 3]]],
            'analyzedAt' => '2026-09-22T08:23:29Z',
            'runId'      => 'run-declared-gap',
            'detail'     => ['skipped' => [
                ['step' => 'shade', 'module' => 'shade', 'reason' => 'engine-produced-nothing', 'resultKey' => 'shade'],
            ], 'warnings' => []],
        ]);

        $this->assertSame('partial', $row->outcome,
            'a run with thirteen values and a module that produced nothing is being called complete');
        $this->assertContains('shade', array_column($row->detail['skipped'], 'module'));
    }

    public function test_the_live_full_run_is_complete(): void
    {
        // `analysis_results` id 30, Canberra, 22.09 08:22:59 — thirteen values
        // and a journal holding one receipt for a disease result that WAS
        // computed. Nothing here may make it partial.
        $live = self::liveRow('fullRun');
        [$user, $site] = $this->siteFor();

        $row = AnalysisResults::record($user, $site, [
            'metrics'    => $live['metrics'],
            'analyzedAt' => $live['completedAt'],
            'runId'      => $live['runId'],
            'detail'     => [
                'skipped'  => $live['detail']['skipped'],
                'warnings' => $live['detail']['warnings'],
            ],
        ]);

        $this->assertSame('complete', $row->outcome);
        $this->assertSame($live['storedOutcome'], $row->outcome,
            'the rule disagrees with what the stand recorded for this run');
    }

    public function test_a_journal_of_receipts_alone_never_makes_a_run_partial(): void
    {
        // The control this file needs most: a rule that treated any journal
        // entry as trouble would mark every ordinary run partial, and the
        // reader would be told something was wrong on every run that went well.
        [$user, $site] = $this->siteFor();

        $row = AnalysisResults::record($user, $site, [
            'metrics'    => $this->completeMetrics(),
            'analyzedAt' => '2026-09-22T08:23:29Z',
            'runId'      => 'run-all-good',
            'detail'     => ['skipped' => [], 'warnings' => [self::successReceipt()]],
        ]);

        $this->assertSame('complete', $row->outcome);
    }

    public function test_a_run_with_no_journal_at_all_is_still_judged_on_its_values(): void
    {
        // The older shape, so the declaration rule does not quietly become the
        // only one. An uncomputed value is still an uncomputed value.
        [$user, $site] = $this->siteFor();

        $complete = AnalysisResults::record($user, $site, [
            'metrics' => $this->completeMetrics(), 'analyzedAt' => '2026-09-22T00:00:00Z', 'runId' => 'r-1',
        ]);
        $this->assertSame('complete', $complete->outcome);

        $partial = AnalysisResults::record($user, $site, [
            'metrics' => $this->partialMetrics(['diseaseRisk']),
            'analyzedAt' => '2026-09-22T01:00:00Z', 'runId' => 'r-2',
        ]);
        $this->assertSame('partial', $partial->outcome);
    }

    public function test_a_module_is_named_once_however_many_times_it_is_declared(): void
    {
        // The three steps GH-557 taught to record a skip also warn about it, and
        // the end-of-pass sweep can reach the same module again. The result must
        // name it once.
        [$user, $site] = $this->siteFor();

        $row = AnalysisResults::record($user, $site, [
            'metrics'    => $this->partialMetrics(['diseaseRisk', 'topDisease']),
            'analyzedAt' => '2026-09-22T00:00:00Z',
            'runId'      => 'run-both',
            'detail'     => [
                'skipped'  => [
                    ['step' => 'disease', 'module' => 'disease', 'reason' => 'climate-late', 'resultKey' => 'disease'],
                    ['step' => 'disease', 'module' => 'disease', 'reason' => 'engine-produced-nothing', 'resultKey' => 'disease'],
                ],
                'warnings' => [],
            ],
        ]);

        $this->assertSame('partial', $row->outcome);
        $this->assertCount(1, array_filter($row->detail['skipped'], fn ($s) => ($s['module'] ?? null) === 'disease'));
    }

    /** @return array{0:User,1:Site} */
    private function siteFor(string $slug = 'owner-site'): array
    {
        $user = User::factory()->create();
        $account = Account::query()->firstOrCreate(
            ['owner_user_id' => $user->id],
            ['display_name' => $user->name, 'created_by_user_id' => $user->id, 'modified_by_user_id' => $user->id]
        );
        $site = Site::query()->create([
            'account_id' => $account->id, 'name' => 'Site '.$slug, 'slug' => $slug,
            'site_type' => 'precinct', 'timezone' => 'UTC',
            'created_by_user_id' => $user->id, 'modified_by_user_id' => $user->id,
        ]);
        $site->users()->attach($user->id, ['role' => 'manager']);

        return [$user, $site];
    }
}
