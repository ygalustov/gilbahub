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
 * GH-570 — WHAT THE LEVEL ON A JOURNAL RECORD IS FOR, once the outcome stopped
 * depending on anything said.
 *
 * The field was introduced while the outcome still read the journal, and it was
 * meant to stop that reading being done by the words. GH-573 removed the reading
 * altogether: the verdict now comes from the result. So the level has ONE job
 * left, and it is a real one — the panel's detail list.
 *
 * The panel prints, under a sentence saying part of the analysis was not
 * computed, everything the pass said. The specimen's journal holds two records:
 * an obstruction and a receipt saying a disease result WAS written, ten
 * diseases, top risk 69. Both were shown to the reader as though both were the
 * trouble. They are told apart by `level` — `problem` from `warn`, `info` from
 * `note` — which is a field the producer fills by which function it calls, not a
 * phrase anybody parses.
 *
 * HOW IT BITES: file the receipt as a problem, or stop filtering, and
 * `test_a_receipt_is_not_printed_under_a_heading_about_what_is_missing` goes red
 * with the disease receipt in the list.
 */
class Gh570TheRuleReadsTheLevelTest extends TestCase
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

    /**
     * A partial run carrying the specimen's real journal, with the levels the
     * producer writes today: the wear record a `problem`, the disease receipt an
     * `info`.
     *
     * @return array<string,mixed>|null the panel
     */
    private function panelWithTheLiveJournal(): ?array
    {
        $live = self::liveRow('specimen');
        $journal = $live['detail']['warnings'];
        foreach ($journal as $i => $w) {
            $journal[$i]['level'] = ($w['module'] ?? '') === 'wear' ? 'problem' : 'info';
        }

        [$user, $site] = $this->siteFor('live-journal');
        AnalysisResults::record($user, $site, [
            'metrics'    => $live['metrics'],
            // No wear result this time, so the declaration stands and there is
            // a panel to look at at all.
            'computed'   => [],
            'analyzedAt' => $live['completedAt'],
            'runId'      => $live['runId'],
            'detail'     => [
                'skipped'  => [['step' => 'wear', 'module' => 'wear', 'reason' => 'engine-produced-nothing', 'resultKey' => 'wear']],
                'warnings' => $journal,
            ],
        ]);

        return AnalysisNotice::panel(AnalysisResults::forSite($site->fresh()), 'Pacific/Auckland');
    }

    public function test_a_receipt_is_not_printed_under_a_heading_about_what_is_missing(): void
    {
        $panel = $this->panelWithTheLiveJournal();
        $details = implode(' | ', $panel['details'] ?? []);

        // Positive control first: the obstruction IS there, so an empty list
        // cannot pass this.
        $this->assertStringContainsString('blocked by identity enforcement', $details);
        $this->assertStringNotContainsString('GAIP_DISEASE_RESULT written', $details,
            'a receipt for work that succeeded is printed under a sentence about work that did not happen');
        $this->assertCount(1, $panel['details']);
    }

    public function test_a_record_from_before_the_field_is_still_printed(): void
    {
        // Every row already in the table was written without a level. Hiding
        // those would lose the account of the runs we have, which is the
        // opposite of the point.
        [$user, $site] = $this->siteFor('legacy-journal');
        AnalysisResults::record($user, $site, [
            'metrics'    => $this->completeMetrics(),
            'computed'   => [],
            'analyzedAt' => '2026-09-22T00:00:00Z',
            'runId'      => 'run-legacy-journal',
            'detail'     => [
                'skipped'  => [['step' => 'shade', 'module' => 'shade', 'reason' => 'engine-produced-nothing', 'resultKey' => 'shade']],
                'warnings' => [['module' => 'shade', 'message' => 'Shade engine error']],
            ],
        ]);

        $panel = AnalysisNotice::panel(AnalysisResults::forSite($site->fresh()), 'Pacific/Auckland');

        $this->assertStringContainsString('Shade engine error', implode(' | ', $panel['details'] ?? []));
    }

    public function test_the_level_changes_what_is_printed_and_never_the_outcome(): void
    {
        // The boundary between this file and GH-573, as an assertion. The same
        // run recorded twice, differing only in the level on its journal: the
        // outcome must be identical both times.
        $outcomes = [];
        foreach (['info', 'problem'] as $level) {
            [$user, $site] = $this->siteFor('level-'.$level);
            $outcomes[$level] = AnalysisResults::record($user, $site, [
                'metrics'    => $this->completeMetrics(),
                'computed'   => ['wear' => ['recoveryWindow' => 19]],
                'analyzedAt' => '2026-09-22T00:00:00Z',
                'runId'      => 'run-level-'.$level,
                'detail'     => ['skipped' => [], 'warnings' => [
                    ['module' => 'wear', 'level' => $level, 'message' => 'Wear engine blocked by identity enforcement'],
                ]],
            ])->outcome;
        }

        $this->assertSame(['info' => 'complete', 'problem' => 'complete'], $outcomes,
            'the level is deciding an outcome again — the verdict belongs to the result');
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
            'site_type' => 'precinct', 'timezone' => 'Pacific/Auckland',
            'created_by_user_id' => $user->id, 'modified_by_user_id' => $user->id,
        ]);
        $site->users()->attach($user->id, ['role' => 'manager']);

        return [$user, $site];
    }
}
