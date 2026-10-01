<?php

namespace Tests\Feature;

use App\Models\Account;
use App\Models\Site;
use App\Models\User;
use App\Support\AnalysisNotice;
use App\Support\AnalysisResults;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * GH-570 — WHAT THE SCREEN SAYS, MEASURED, on the owner's own run.
 *
 * GH-569 made the outcome right: a run whose journal reports a blocked engine is
 * `partial` and names the engine in `skipped`. That is the row. This file asks
 * the next question, which is the one the owner actually asked — "nowhere does
 * it say that it did not compute" — by taking the live row through
 * `record()` → `forSite()` → `panel()` and looking at the words that come out.
 *
 * NOTHING IS FIXED HERE. Every assertion below states what the panel prints
 * today, including three things that are wrong. They are stated as assertions
 * rather than described in a report so that a later fix has to come through this
 * file and say what it changed.
 */
class Gh570WhatThePanelSaysOnTheLiveRowsTest extends TestCase
{
    use RefreshDatabase;

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
     * Record a live row the way the route would, and read back what the screen
     * is given.
     *
     * GH-573: the specimen is recorded WITH a declared gap and WITHOUT the
     * result for it, because that is now the only way a run is partial. The
     * row's own journal still travels, unedited — these tests are about the
     * words the panel builds, and the words are built from the declaration.
     */
    private function panelFor(string $which, array $skipped = []): ?array
    {
        $live = self::liveRow($which);
        [$user, $site] = $this->siteFor();

        AnalysisResults::record($user, $site, [
            'metrics'    => $live['metrics'],
            'computed'   => ['soilNutrition' => $live['computedSoilNutrition'] ?? null],
            'analyzedAt' => $live['completedAt'],
            'runId'      => $live['runId'],
            'detail'     => [
                'skipped'  => $skipped ?: $live['detail']['skipped'],
                'warnings' => $live['detail']['warnings'],
            ],
        ]);

        /**
         * GH-791 (queue item 3gp): the clock stands where this row finished. The stamps come from the live
         * rows of the stand (22.09.2026), and every case of this file asks what the panel says about THAT
         * run -- read on a later day the panel is right to call it stale, and each case read that as its own
         * subject failing. The fixture's dates are not touched: a newer date reddens again two days later.
         */
        $this->clockAtRowAge((string) $live['completedAt']);

        return AnalysisNotice::panel(AnalysisResults::forSite($site->fresh()), 'Pacific/Auckland');
    }

    /** The wear module declared as having produced nothing, and no wear result. */
    private const WEAR_GAP = [[
        'step' => 'wear', 'module' => 'wear',
        'reason' => 'engine-produced-nothing', 'resultKey' => 'wear',
    ]];

    public function test_the_blocked_engine_now_reaches_the_screen_at_all(): void
    {
        // The half GH-569 delivered, stated as a measurement rather than
        // assumed: before it, this panel was null — a complete run says
        // nothing — and the owner saw a page with no notice on it.
        $panel = $this->panelFor('specimen', self::WEAR_GAP);

        $this->assertNotNull($panel, 'the run that could not produce its wear analysis says nothing at all');
        $this->assertSame('warning', $panel['level']);
        $this->assertStringContainsString('wear', $panel['text'],
            'the engine the run reported as blocked is not named in the sentence the reader sees');

        fwrite(STDERR, "\n[q31] panel text on id 31: ".$panel['text']."\n");
        fwrite(STDERR, '[q31] panel details on id 31: '.json_encode($panel['details'] ?? [], JSON_UNESCAPED_SLASHES)."\n");
    }

    /**
     * GH-572, was FINDING 1 — the reason code has a sentence now.
     *
     * `skippedFrom()` stamps `reason = 'engine-did-not-produce'`. The code was
     * not in `AnalysisNotice::REASONS`, so the reader was shown the identifier
     * itself through the unknown-reason frame.
     */
    public function test_the_reason_is_a_sentence_and_not_a_code(): void
    {
        $panel = $this->panelFor('specimen', self::WEAR_GAP);

        $this->assertStringContainsString('that part of the analysis produced no result', $panel['text']);
        // The bite: no identifier of any kind survives into the sentence.
        $this->assertStringNotContainsString('engine-did-not-produce', $panel['text']);
        $this->assertDoesNotMatchRegularExpression('/\b[a-z]+-[a-z]+-[a-z]+\b/', $panel['text'],
            'a raw kebab-case identifier is being printed to the reader');
    }

    /**
     * GH-572, was FINDING 2 — the module name and the number agreement.
     *
     * `unComputed()` took `step` from `skipped` verbatim, so the panel printed
     * "wear were not computed": an identifier, in a sentence, in the wrong
     * number. The name now comes from `STEP_NAMES`, whose values are checked
     * against `assets/dependency-graph.js` in `gh572-step-names-come-from-the-graph.test.js`.
     *
     * WHAT THIS DOES NOT SETTLE: whether the sentence is TRUE of this run.
     * `Gh571SkippedIsInferredFromAWordTest` measures that the wear engine did
     * produce its result, so for this specimen the sentence is well-formed and
     * wrong. That is a separate question and it is open.
     */
    public function test_the_sentence_names_the_module_in_words_and_agrees_in_number(): void
    {
        $panel = $this->panelFor('specimen', self::WEAR_GAP);

        $this->assertStringContainsString('wear and recovery was not computed', $panel['text']);
        $this->assertStringNotContainsString('wear were not computed', $panel['text']);
    }

    public function test_two_missing_parts_take_the_plural(): void
    {
        // The other half of the agreement, so that "was" is not simply hard
        // coded where "were" used to be.
        $live = self::liveRow('specimen');
        [$user, $site] = $this->siteFor();

        AnalysisResults::record($user, $site, [
            'metrics'    => $live['metrics'],
            'analyzedAt' => $live['completedAt'],
            'runId'      => $live['runId'],
            'computed'   => [],
            'detail'     => ['skipped' => [
                ['step' => 'wear', 'module' => 'wear', 'reason' => 'engine-produced-nothing', 'resultKey' => 'wear'],
                ['step' => 'shade', 'module' => 'shade', 'reason' => 'engine-produced-nothing', 'resultKey' => 'shade'],
            ], 'warnings' => [
                ['module' => 'wear', 'level' => 'problem', 'message' => 'blocked'],
                ['module' => 'shade', 'level' => 'problem', 'message' => 'Shade engine error'],
            ]],
        ]);

        $panel = AnalysisNotice::panel(AnalysisResults::forSite($site->fresh()), 'Pacific/Auckland');
        $this->assertStringContainsString('wear and recovery and shade were not computed', $panel['text']);
    }

    /**
     * GH-573, was FINDING 3 — the details list and the records that predate the
     * level field.
     *
     * The specimen's journal, as the row on the stand holds it, carries no
     * `level` on either record: it was written before the field existed. Those
     * are still printed whole, because nothing here knows better about them —
     * and that is deliberate, not an oversight. The filtering that keeps a
     * receipt out of a list about missing work applies to records that CARRY a
     * level, and is measured in `Gh570TheRuleReadsTheLevelTest`.
     *
     * This case holds the legacy half so that a later change cannot quietly
     * start hiding the account of every run already recorded.
     */
    public function test_records_from_before_the_level_field_are_printed_whole(): void
    {
        $panel = $this->panelFor('specimen', self::WEAR_GAP);
        $details = $panel['details'] ?? [];

        foreach ($details as $line) {
            $this->assertStringNotContainsString('level', $line);
        }
        $this->assertCount(2, $details, 'a record from before the field is being dropped');
        $this->assertStringContainsString('blocked by identity enforcement', implode(' | ', $details));
        $this->assertStringContainsString('GAIP_DISEASE_RESULT written', implode(' | ', $details));
    }

    /**
     * GH-573, was FINDING 4 — the recompute restates in both directions, from
     * the result.
     *
     * `restateOutcomes()` could only ever turn a row partial, and it decided
     * from `uncomputedIn($metrics)` alone. Two things are wrong with that now.
     * A row made partial by the withdrawn journal rule has to be able to come
     * back — on the stand that is id 34, Test5 - NZ, `wear` named as not
     * produced with a fourteen-key `computed.wear` in the same row. And the
     * verdict has to be the same rule a recording uses, or the two drift.
     */
    public function test_a_row_made_partial_by_the_withdrawn_rule_is_restated_to_complete(): void
    {
        $live = self::liveRow('wearRanAnyway');
        [$user, $site] = $this->siteFor();

        // The row as id 34 stands: partial, all thirteen values, `wear` named as
        // having produced nothing, and the wear result right there beside it.
        $row = AnalysisResults::record($user, $site, [
            'metrics'    => $live['metrics'],
            'computed'   => ['wear' => $live['computedWear']],
            'analyzedAt' => $live['completedAt'],
            'runId'      => 'run-like-34',
            'detail'     => ['skipped' => [], 'warnings' => $live['detail']['warnings']],
        ]);
        \App\Models\AnalysisResult::query()->whereKey($row->id)->update([
            'outcome' => 'partial',
            'reason'  => 'engine-did-not-produce',
            'detail'  => json_encode([
                'nulls'    => [],
                'skipped'  => [['step' => 'wear', 'module' => 'wear', 'reason' => 'engine-did-not-produce']],
                'warnings' => $live['detail']['warnings'],
            ]),
        ]);

        $listed = collect(AnalysisResults::outcomesToRestate())->firstWhere('id', $row->id);
        $this->assertNotNull($listed, 'the recompute does not even see a row the withdrawn rule marked');
        $this->assertSame('partial', $listed['was']);
        $this->assertSame('complete', $listed['becomes']);

        $this->assertSame(1, AnalysisResults::restateOutcomes([$row->id]));

        $fresh = $row->fresh();
        $this->assertSame('complete', $fresh->outcome);
        $this->assertNull($fresh->reason);
        $this->assertSame([], $fresh->detail['skipped'],
            'the invented skip is still on the row, so the panel would keep naming it');
        $this->assertNotEmpty($fresh->detail['warnings'], 'the journal was thrown away with the verdict');
        // GH-791 (queue item 3gp): the clock stands where this row finished, as in `panelFor()` above.
        $this->clockAtRowAge((string) $live['completedAt']);
        $this->assertNull(AnalysisNotice::panel(AnalysisResults::forSite($site->fresh()), 'Pacific/Auckland'),
            'a run where every engine produced is still reported as a problem');
    }

    public function test_a_row_with_a_real_gap_is_not_restated_away(): void
    {
        // The control for the direction above: restating must not become a
        // machine for turning everything complete.
        [$user, $site] = $this->siteFor();

        $row = AnalysisResults::record($user, $site, [
            'metrics'    => self::liveRow('specimen')['metrics'],
            'computed'   => [],
            'analyzedAt' => '2026-09-22T00:00:00Z',
            'runId'      => 'run-real-gap',
            'detail'     => ['skipped' => self::WEAR_GAP, 'warnings' => []],
        ]);

        $this->assertSame('partial', $row->outcome);
        $this->assertSame(0, AnalysisResults::restateOutcomes([$row->id]));
        $this->assertSame('partial', $row->fresh()->outcome);
    }

    public function test_one_thing_is_never_named_twice_in_the_same_sentence(): void
    {
        // GH-572, and it is here because the repair introduced it before a test
        // caught it. `unComputed()` merges two vocabularies — the step names
        // from `skipped` and the metric families from `nulls` — and the first
        // draft called the forecast "disease forecast" in one and "forecast" in
        // the other, so the sentence read "disease, disease forecast, forecast
        // and stress". A run that skipped the forecast step AND has no forecast
        // values must name it once.
        [$user, $site] = $this->siteFor();

        AnalysisResults::record($user, $site, [
            'metrics'    => [
                'timestamp' => '2026-09-22T00:00:00Z', 'growthPotential' => 1, 'soilTemp' => 1,
                'weatherSource' => 'live', 'diseaseRisk' => 1, 'topDisease' => 'x',
                'forecastPeak' => null, 'peakDay' => null, 'forecastDisease' => null,
                'stressIndex' => 1, 'trendDirection' => 'x', 'irrigationNeed' => 1,
                'irrigationDeficit' => 1,
            ],
            'analyzedAt' => '2026-09-22T00:00:00Z',
            'runId'      => 'run-forecast-twice',
            'detail'     => [
                'skipped'  => [['step' => 'forecast', 'module' => 'forecast', 'reason' => 'disease-not-computed']],
                'warnings' => [],
            ],
        ]);

        $panel = AnalysisNotice::panel(AnalysisResults::forSite($site->fresh()), 'Pacific/Auckland');

        $this->assertStringContainsString('forecast was not computed', $panel['text']);
        $this->assertSame(1, substr_count($panel['text'], 'forecast'),
            'the forecast is named more than once — the two name maps have drifted into two vocabularies');
    }

    public function test_a_module_nobody_has_named_is_printed_as_it_is(): void
    {
        // GH-572, the other half of the map: an unnamed module is a gap in
        // `STEP_NAMES`, and the reader is better served by the identifier than
        // by a blank or by something plausible put in its place. Stated as a
        // test because "we will add it to the map" is not a mechanism.
        [$user, $site] = $this->siteFor();

        AnalysisResults::record($user, $site, [
            'metrics'    => self::liveRow('specimen')['metrics'],
            'analyzedAt' => '2026-09-22T00:00:00Z',
            'runId'      => 'run-unnamed-module',
            'computed'   => [],
            'detail'     => ['skipped' => [
                ['step' => 'brand-new-engine', 'module' => 'brand-new-engine',
                 'reason' => 'engine-produced-nothing', 'resultKey' => 'brandNew'],
            ], 'warnings' => [
                ['module' => 'brand-new-engine', 'level' => 'problem', 'message' => 'something went wrong'],
            ]],
        ]);

        $panel = AnalysisNotice::panel(AnalysisResults::forSite($site->fresh()), 'Pacific/Auckland');

        $this->assertStringContainsString('brand-new-engine was not computed', $panel['text']);
    }

    public function test_the_full_run_says_nothing_and_that_is_correct(): void
    {
        // The control. A run where every engine produced its result must not
        // put a warning on the screen — otherwise every measurement above is
        // about a panel that always fires.
        $panel = $this->panelFor('fullRun');

        $this->assertNull($panel, 'a run that went well is being reported as a problem');
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
            'site_type' => 'precinct', 'timezone' => 'Pacific/Auckland',
            'created_by_user_id' => $user->id, 'modified_by_user_id' => $user->id,
        ]);
        $site->users()->attach($user->id, ['role' => 'manager']);

        return [$user, $site];
    }
}
