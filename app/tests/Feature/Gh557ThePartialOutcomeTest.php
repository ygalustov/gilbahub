<?php

namespace Tests\Feature;

use App\Models\Account;
use App\Models\AnalysisResult;
use App\Models\Site;
use App\Models\User;
use App\Support\AnalysisNotice;
use App\Support\AnalysisResults;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Feature\Concerns\BuildsAnalysisResults;
use Tests\TestCase;

/**
 * GH-557 (section 15) — THE THIRD OUTCOME.
 *
 * WHAT IT IS FOR. `complete` meant "the POST was accepted". Since GH-553 the
 * producer sends every required key, `null` where its engine could not answer,
 * and `null` is a correctly formed value — so a run that computed six of
 * thirteen numbers was stored as a completed analysis and REPLACED the numbers
 * of a run that had computed all thirteen. That is the specimen row on the
 * stand: `analysis_results` id 13, Federal Golf, `run-1790050104727-k7vbb7`.
 *
 * `complete` now means every required value was computed. `partial` means the
 * run finished, its body was well formed, and part of the result is not there.
 *
 * FOUR PROPERTIES, and each is a different way this could read as done and not
 * be: the server decides the outcome rather than being told it; a partial run
 * does not replace numbers somebody computed properly; a site whose ONLY run is
 * partial still sees its figures rather than an empty screen; and the reasons
 * reach the reader instead of a console.
 */
class Gh557ThePartialOutcomeTest extends TestCase
{
    use RefreshDatabase;
    use BuildsAnalysisResults;

    // ── The server decides ─────────────────────────────────────────────────

    public function test_a_run_with_uncomputed_values_is_partial_however_it_describes_itself(): void
    {
        [$user, $site] = $this->siteFor('manager');

        // The producer has no say: this body reports nothing about itself, and
        // it is partial because of what it contains.
        $row = AnalysisResults::record($user, $site, [
            'metrics'    => $this->partialMetrics($this->federalGolfNulls()),
            'analyzedAt' => '2026-09-22T04:08:27Z',
            'runId'      => 'run-quiet',
        ]);

        $this->assertSame('partial', $row->outcome);
        $this->assertSame($this->federalGolfNulls(), $row->detail['nulls']);
    }

    public function test_a_run_that_computed_everything_but_skipped_a_step_is_also_partial(): void
    {
        // The other half of the rule, and the one a check on nulls alone would
        // miss: a step can be skipped without any required key being null —
        // `preEmergent` and `confidence` are in `computed`, not in `metrics`.
        [$user, $site] = $this->siteFor('manager');

        $row = AnalysisResults::record($user, $site, [
            'metrics'    => $this->completeMetrics(),
            'analyzedAt' => '2026-09-22T04:08:27Z',
            'runId'      => 'run-skipped',
            'detail'     => ['skipped' => [['step' => 'preEmergent', 'module' => 'preEmergent', 'reason' => 'engine-error']]],
        ]);

        $this->assertSame('partial', $row->outcome);
        $this->assertSame('engine-error', $row->reason);
    }

    public function test_a_run_with_every_value_and_no_skips_is_complete(): void
    {
        // The control. Without it, "partial" would be satisfied by a server that
        // calls everything partial.
        [$user, $site] = $this->siteFor('manager');

        $row = AnalysisResults::record($user, $site, [
            'metrics'    => $this->completeMetrics(),
            'analyzedAt' => '2026-09-22T04:08:27Z',
            'runId'      => 'run-full',
        ]);

        $this->assertSame('complete', $row->outcome);
        $this->assertNull($row->reason);
    }

    // ── A partial run does not replace the numbers ─────────────────────────

    public function test_a_partial_run_does_not_replace_the_numbers_of_a_complete_one(): void
    {
        [$user, $site] = $this->siteFor('manager');

        AnalysisResults::record($user, $site, [
            'metrics'    => $this->completeMetrics(['growthPotential' => 0.8]),
            'computed'   => ['climate' => ['ok' => true]],
            'analyzedAt' => '2026-09-18T11:26:00Z',
            'runId'      => 'run-good',
        ]);
        $before = md5(json_encode(AnalysisResults::forSite($site->fresh())['metrics']));

        AnalysisResults::record($user, $site, [
            'metrics'    => $this->partialMetrics($this->federalGolfNulls(), ['growthPotential' => 0.33]),
            'analyzedAt' => '2026-09-22T04:08:27Z',
            'runId'      => 'run-partial',
            'detail'     => ['skipped' => [['step' => 'disease', 'module' => 'disease', 'reason' => 'climate-late']]],
        ]);

        $p = AnalysisResults::forSite($site->fresh());

        // The numbers are byte for byte the ones somebody computed properly.
        // Asserted by hash, because "0.8 is still there" would pass while six
        // other values had been replaced by blanks.
        $this->assertSame($before, md5(json_encode($p['metrics'])),
            'a partial run replaced numbers a complete run had produced');
        $this->assertSame('2026-09-18T11:26:00.000000Z', $p['analyzedAt']);
        $this->assertSame('complete', $p['numbersFrom']);
        // …and the page still knows the last attempt did not go well.
        $this->assertSame('partial', $p['status']);
        $this->assertSame('climate-late', $p['lastRun']['reason']);
    }

    public function test_the_site_switcher_dot_is_not_painted_from_a_partial_run(): void
    {
        [$user, $site] = $this->siteFor('manager');

        AnalysisResults::record($user, $site, [
            'metrics'    => $this->partialMetrics($this->federalGolfNulls(), ['growthPotential' => 0.9]),
            'analyzedAt' => '2026-09-22T04:08:27Z',
            'runId'      => 'run-partial',
        ]);

        // 0.9 would be a green dot. The dot says "this site's analysis says X",
        // and a run that could not compute half of it does not say X.
        $this->assertSame([null], array_values(AnalysisResults::statusMap([$site->id])));
    }

    // ── Unless there is nothing else ───────────────────────────────────────

    public function test_a_site_whose_only_run_is_partial_still_sees_what_it_computed(): void
    {
        [$user, $site] = $this->siteFor('manager');

        AnalysisResults::record($user, $site, [
            'metrics'    => $this->partialMetrics($this->federalGolfNulls(), ['growthPotential' => 0.62]),
            'analyzedAt' => '2026-09-22T04:08:27Z',
            'runId'      => 'run-only',
            'detail'     => ['skipped' => [['step' => 'disease', 'module' => 'disease', 'reason' => 'climate-late']]],
        ]);

        $p = AnalysisResults::forSite($site->fresh());

        // Hiding these would hide numbers that were really computed; showing
        // them without saying so would be the defect this whole section is
        // about. Both halves asserted.
        $this->assertSame(0.62, $p['metrics']['growthPotential']);
        $this->assertNull($p['metrics']['diseaseRisk']);
        $this->assertSame('partial', $p['numbersFrom']);
        $this->assertSame('partial', $p['status']);
    }

    // ── The reasons reach the reader ───────────────────────────────────────

    public function test_the_panel_names_what_was_not_computed_and_why(): void
    {
        $projection = [
            'analyzedAt'  => '2026-09-18T11:26:00Z',
            'metrics'     => ['growthPotential' => 0.8],
            'computed'    => null,
            'numbersFrom' => 'complete',
            'status'      => 'partial',
            'lastRun'     => [
                'runId' => 'run-partial', 'outcome' => 'partial', 'reason' => 'climate-late',
                'completedAt' => '2026-09-22T14:08:00Z',
                'nulls'   => $this->federalGolfNulls(),
                'skipped' => [
                    ['step' => 'disease', 'module' => 'disease', 'reason' => 'climate-late'],
                    ['step' => 'forecast', 'module' => 'forecast', 'reason' => 'disease-not-computed'],
                ],
                'warnings' => [],
            ],
        ];

        $this->assertSame(
            'Showing the analysis from Sep 18 11:26. '
            .'The re-run on Sep 22 14:08 finished without disease, forecast and stress: '
            .'the climate data arrived after the steps that needed it had already run. '
            .'The numbers below are from the last complete analysis. Try Re-run again.',
            AnalysisNotice::panel($projection, 'UTC')['text']
        );
        // Seven storage keys, three names a person recognises.
        $this->assertStringNotContainsString('diseaseRisk', AnalysisNotice::panel($projection, 'UTC')['text']);
    }

    public function test_a_site_with_only_a_partial_run_is_told_the_numbers_are_its_own(): void
    {
        $projection = [
            'analyzedAt'  => '2026-09-22T14:08:00Z',
            'metrics'     => ['growthPotential' => 0.62],
            'computed'    => null,
            'numbersFrom' => 'partial',
            'status'      => 'partial',
            'lastRun'     => [
                'runId' => 'r', 'outcome' => 'partial', 'reason' => 'climate-late',
                'completedAt' => '2026-09-22T14:08:00Z',
                'nulls' => $this->federalGolfNulls(), 'skipped' => [], 'warnings' => [],
            ],
        ];

        $this->assertSame(
            'This analysis is incomplete: disease, forecast and stress were not computed '
            .'(the climate data arrived after the steps that needed it had already run). '
            .'Re-run to complete it.',
            AnalysisNotice::panel($projection, 'UTC')['text']
        );
    }

    public function test_the_pill_says_incomplete_rather_than_failed_or_nothing(): void
    {
        $p = [
            'analyzedAt' => '2026-09-18T11:26:00Z', 'metrics' => ['x' => 1], 'numbersFrom' => 'complete',
            'lastRun' => ['outcome' => 'partial', 'reason' => 'climate-late'], 'status' => 'partial',
        ];
        $this->assertSame('Analysis: Sep 18 11:26 · re-run incomplete', AnalysisNotice::pill($p, 'UTC'));
    }

    public function test_everything_the_pass_said_reaches_the_panel(): void
    {
        $projection = [
            'analyzedAt'  => '2026-09-18T11:26:00Z',
            'metrics'     => ['growthPotential' => 0.8],
            'numbersFrom' => 'complete',
            'status'      => 'partial',
            'lastRun'     => [
                'runId' => 'r', 'outcome' => 'partial', 'reason' => 'climate-late',
                'completedAt' => '2026-09-22T14:08:00Z', 'nulls' => [], 'skipped' => [],
                'warnings' => [
                    ['module' => 'disease', 'message' => 'Skipping disease computeAll pass', 'at' => 1, 'data' => null],
                    ['module' => 'stress', 'message' => 'Stress aggregation error', 'at' => 2, 'data' => 'x is not a function'],
                ],
            ],
        ];

        $panel = AnalysisNotice::panel($projection, 'UTC');
        // Seven explanations a run produces used to reach a console nobody had
        // open. They are under the sentence that says something is missing.
        $this->assertSame([
            '[disease] Skipping disease computeAll pass',
            '[stress] Stress aggregation error — x is not a function',
        ], $panel['details']);
    }

    public function test_the_whole_way_from_a_recorded_run_to_the_rendered_page(): void
    {
        [$user, $site] = $this->siteFor('manager');
        AnalysisResults::record($user, $site, [
            'metrics'    => $this->completeMetrics(['growthPotential' => 0.8]),
            'analyzedAt' => '2026-09-18T11:26:00Z',
            'runId'      => 'run-good',
        ]);
        AnalysisResults::record($user, $site, [
            'metrics'    => $this->partialMetrics($this->federalGolfNulls()),
            'analyzedAt' => '2026-09-22T04:08:27Z',
            'runId'      => 'run-partial',
            'detail'     => [
                'skipped'  => [['step' => 'disease', 'module' => 'disease', 'reason' => 'climate-late']],
                'warnings' => [['module' => 'disease', 'message' => 'Skipping disease computeAll pass', 'at' => 1]],
            ],
        ]);
        $user->forceFill(['last_active_site_id' => $site->id])->save();

        $html = $this->actingAs($user->fresh())->get('/dashboard')->assertOk()->getContent();

        $this->assertStringContainsString('re-run incomplete', $html, 'the pill does not say so');
        $this->assertStringContainsString('finished without disease', $html, 'the panel does not say what is missing');
        $this->assertStringContainsString('Skipping disease computeAll pass', $html, 'the account did not reach the page');
        // and the numbers are still the complete run's
        $this->assertStringContainsString('Sep 18 11:26', $html);
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
