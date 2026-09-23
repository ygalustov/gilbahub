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
 * GH-573 — THE OUTCOME IS DECIDED BY THE RESULT, NOT BY WHAT WAS SAID.
 *
 * THE LIVE CASE THIS FILE IS BUILT ON, and every assertion here has to reach it.
 * `analysis_results` id 29, Russley, 22.09.2026 08:21:30 — thirteen required
 * values, all present; a journal saying "Wear engine blocked by identity
 * enforcement"; and `computed.wear` holding fourteen keys of real result:
 * effective load with its breakdown, recovery window 19, wear resistance 3.6,
 * `_meta.applicable` true, `_meta.timestamp` 1790065290910 — the same
 * millisecond as the warning's own `at`. `wear-recovery-engine-pure.js` does not
 * contain the string `turfIntent`. The block is announced and never enforced.
 * The engine ran.
 *
 * GH-569 read that sentence and believed it, so the run went partial and the
 * screen told the owner a part of her analysis had not been computed when it
 * had. Two rows on the stand with IDENTICAL journals came out with different
 * outcomes — 24, 29 and 31 `complete`, 34 `partial` — which is the defect
 * stated as a fact about data rather than as an argument.
 *
 * WHAT DECIDES NOW: the run declares what it took on and did not produce
 * (`attempting()` plus the end-of-pass sweep in `hub-orchestrator.js`), and the
 * server checks each declaration against `computed` before believing it.
 *
 * HOW THIS FILE BITES. Make the rule read the journal again — believe a
 * declaration without checking the result, or infer one from a word — and
 * `test_the_live_row_whose_engine_ran_is_complete` goes red on Russley's own
 * row, and `test_the_four_live_rows_now_agree` goes red naming which of the four
 * disagrees. A test that stays green on id 29 is not about this defect.
 */
class Gh571TheVerdictComesFromTheResultTest extends TestCase
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
            if (! is_array($data) || ! isset($data['wearRanAnyway']['computedWear'])) {
                throw new \RuntimeException('q31-analysis-results-live-rows.json is missing or unreadable');
            }
            self::$live = $data;
        }

        return self::$live[$which];
    }

    public function test_the_premise_the_engine_produced_a_result(): void
    {
        // The row before the rule is applied to it. If `computed.wear` were
        // empty, every assertion below would be about a different situation.
        $live = self::liveRow('wearRanAnyway');
        $wear = $live['computedWear'];
        $warn = collect($live['detail']['warnings'])->firstWhere('module', 'wear');

        $this->assertCount(14, $wear);
        $this->assertTrue($wear['_meta']['applicable']);
        $this->assertSame(19, $wear['recoveryWindow']);
        $this->assertSame(3.6, $wear['wearResistance']);
        $this->assertNotEmpty($wear['effectiveLoad']['breakdown']);
        $this->assertStringContainsString('blocked', $warn['message']);
        $this->assertSame($warn['at'], $wear['_meta']['timestamp'],
            'the result and the warning no longer share a timestamp — re-take this measurement');
    }

    public function test_the_live_row_whose_engine_ran_is_complete(): void
    {
        // RUSSLEY id 29, through the rule with its own values, its own journal
        // and its own result. The journal says blocked; the result is there.
        $live = self::liveRow('wearRanAnyway');
        [$user, $site] = $this->siteFor('russley');

        $row = AnalysisResults::record($user, $site, [
            'metrics'    => $live['metrics'],
            'computed'   => ['wear' => $live['computedWear']],
            'analyzedAt' => $live['completedAt'],
            'runId'      => $live['runId'],
            'detail'     => [
                // The declaration the withdrawn rule would have manufactured,
                // written in explicitly: even handed it, the server must not
                // believe it, because the result contradicts it.
                'skipped'  => [['step' => 'wear', 'module' => 'wear', 'reason' => 'engine-did-not-produce', 'resultKey' => 'wear']],
                'warnings' => $live['detail']['warnings'],
            ],
        ]);

        $this->assertSame('complete', $row->outcome,
            'a run whose wear engine produced a fourteen-key result is still stored as incomplete');
        $this->assertSame([], $row->detail['skipped'] ?? [],
            'the module is still named as not having produced, with its result in the same body');
        $this->assertNull($row->reason);
    }

    public function test_a_declaration_is_believed_when_the_result_is_really_absent(): void
    {
        // The other half, and without it the rule above could simply be
        // "believe nothing".
        $live = self::liveRow('wearRanAnyway');
        [$user, $site] = $this->siteFor('really-missing');

        $row = AnalysisResults::record($user, $site, [
            'metrics'    => $live['metrics'],
            'computed'   => ['disease' => ['diseases' => [1, 2]]],
            'analyzedAt' => $live['completedAt'],
            'runId'      => 'run-really-missing',
            'detail'     => [
                'skipped'  => [['step' => 'wear', 'module' => 'wear', 'reason' => 'engine-produced-nothing', 'resultKey' => 'wear']],
                'warnings' => $live['detail']['warnings'],
            ],
        ]);

        $this->assertSame('partial', $row->outcome);
        $this->assertContains('wear', array_column($row->detail['skipped'], 'module'));
    }

    public function test_the_four_live_rows_now_agree(): void
    {
        // THE DEFECT AS THE STAND SHOWS IT: id 24, 29 and 31 are `complete` and
        // id 34 is `partial`, with the same journal in all four. Replayed
        // through the rule they must come out the same, and they must come out
        // complete, because in all four the wear engine produced.
        $live = self::liveRow('wearRanAnyway');
        $outcomes = [];

        foreach (['24', '29', '31', '34'] as $i => $label) {
            [$user, $site] = $this->siteFor('row-'.$label);
            $outcomes[$label] = AnalysisResults::record($user, $site, [
                'metrics'    => $live['metrics'],
                'computed'   => ['wear' => $live['computedWear']],
                'analyzedAt' => $live['completedAt'],
                'runId'      => 'run-row-'.$label,
                'detail'     => [
                    // id 34 is the one the withdrawn rule had already marked.
                    'skipped'  => $label === '34'
                        ? [['step' => 'wear', 'module' => 'wear', 'reason' => 'engine-did-not-produce', 'resultKey' => 'wear']]
                        : [],
                    'warnings' => $live['detail']['warnings'],
                ],
            ])->outcome;
        }

        $this->assertSame(
            ['24' => 'complete', '29' => 'complete', '31' => 'complete', '34' => 'complete'],
            $outcomes,
            'the four rows with one journal still disagree about their outcome'
        );
    }

    public function test_no_word_in_a_message_changes_an_outcome(): void
    {
        // Every word the withdrawn rule looked for, in a run that produced
        // everything. None of them may do anything now.
        foreach (['blocked', 'failed', 'error', 'unavailable', 'could not', 'skipping'] as $i => $word) {
            [$user, $site] = $this->siteFor('word-'.$i);
            $row = AnalysisResults::record($user, $site, [
                'metrics'    => $this->completeMetrics(),
                'computed'   => ['pgr' => ['dose' => 0.4, 'gdd' => 210]],
                'analyzedAt' => '2026-09-22T00:00:00Z',
                'runId'      => 'run-word-'.$i,
                'detail'     => ['skipped' => [], 'warnings' => [
                    ['module' => 'pgr', 'level' => 'problem', 'message' => 'Spray log sync: '.$word.' (non-fatal)'],
                ]],
            ]);

            $this->assertSame('complete', $row->outcome, 'still turned partial by the word: '.$word);
        }
    }

    public function test_an_engine_that_answered_with_an_error_object_counts_as_not_produced(): void
    {
        // The cascade's engines report failure by RETURNING `{status:'Error'}`
        // rather than by throwing, so "the key is present" is not the question
        // the server asks. Three shapes, all of them a result that is not one.
        $shapes = [
            'absent'        => [],
            'empty object'  => ['mlsn' => []],
            'status Error'  => ['mlsn' => ['status' => 'Error', 'recommendations' => []]],
            'not available' => ['mlsn' => ['status' => 'Not available']],
        ];

        foreach ($shapes as $label => $computed) {
            [$user, $site] = $this->siteFor('shape-'.md5($label));
            $row = AnalysisResults::record($user, $site, [
                'metrics'    => $this->completeMetrics(),
                'computed'   => $computed,
                'analyzedAt' => '2026-09-22T00:00:00Z',
                'runId'      => 'run-'.md5($label),
                'detail'     => ['skipped' => [
                    ['step' => 'mlsn', 'module' => 'mlsn', 'reason' => 'engine-produced-nothing', 'resultKey' => 'mlsn'],
                ], 'warnings' => []],
            ]);

            $this->assertSame('partial', $row->outcome, 'counted as produced: '.$label);
        }

        // and the control: a real result silences the declaration
        [$user, $site] = $this->siteFor('shape-real');
        $row = AnalysisResults::record($user, $site, [
            'metrics'    => $this->completeMetrics(),
            'computed'   => ['mlsn' => ['status' => 'OK', 'recommendations' => [['K' => 1]]]],
            'analyzedAt' => '2026-09-22T00:00:00Z',
            'runId'      => 'run-shape-real',
            'detail'     => ['skipped' => [
                ['step' => 'mlsn', 'module' => 'mlsn', 'reason' => 'engine-produced-nothing', 'resultKey' => 'mlsn'],
            ], 'warnings' => []],
        ]);
        $this->assertSame('complete', $row->outcome);
    }

    public function test_the_result_key_travels_with_the_declaration(): void
    {
        // Three modules spell their result differently from their own name.
        // The spelling comes from the producer, so the server does not keep a
        // second copy of it — and a declaration that names the key correctly is
        // checked against the right result.
        [$user, $site] = $this->siteFor('alias');

        $row = AnalysisResults::record($user, $site, [
            'metrics'    => $this->completeMetrics(),
            'computed'   => ['preEmergent' => ['aggregateStatus' => 'watch']],
            'analyzedAt' => '2026-09-22T00:00:00Z',
            'runId'      => 'run-alias',
            'detail'     => ['skipped' => [[
                'step' => 'pre-emergent', 'module' => 'pre-emergent',
                'reason' => 'engine-produced-nothing', 'resultKey' => 'preEmergent',
            ]], 'warnings' => []],
        ]);

        $this->assertSame('complete', $row->outcome,
            'the declaration was not checked against the key the producer named');
    }

    /** @return array{0:User,1:Site} */
    private function siteFor(string $slug): array
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
