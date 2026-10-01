<?php

namespace Tests\Feature;

use App\Support\AnalysisNotice;
use Illuminate\Support\Carbon;
use Tests\TestCase;

/**
 * GH-791 (queue item 3gp) — THE FIVE CASES ARE GREEN ON ANY DAY, AND THE RULE THEY RESTED ON STILL WORKS.
 *
 * WHY THIS EXISTS. Five cases in four files asserted that the analysis panel says nothing about a run that
 * went well, each with a date written into its fixture. The panel warns above two days old
 * (`AnalysisNotice::STALE_AFTER_DAYS`, the age taken from `Carbon::now()`), so from the third day after
 * those dates all five went red with "Analysis data is N days old" and the N grew with the wall clock.
 * Opened by running them: each failed on that sentence and on nothing else. The panel's gates run in the
 * order no-data, failure, partial, age, so reaching the age branch proves the row was complete -- the
 * product was right and the harness had a free clock.
 *
 * WHAT THIS FILE HOLDS, and it is the condition the analyst set rather than the count of green tests: each of
 * the five stamps is silent AT THREE POINTS OF THE WALL CLOCK. The wall clock is moved inside the process,
 * the helper is called after it, and the panel is asked -- so "it passes today" and "it passes on any day"
 * stop being the same green.
 *
 * AND THE POSITIVE CONTROLS, without which the above would also be the answer of a panel that never speaks:
 * with the clock left alone on a distant day the panel DOES warn, and a row the case itself declares three
 * days old warns too, naming the age. The age is part of what a case says now, not a property of the day.
 */
class Gh791TheFiveCasesDoNotDependOnTheWallClockTest extends TestCase
{
    /** The stamps the five cases carry, by the case each belongs to. */
    private const STAMPS = [
        'Gh548 :: a run that works replaces the failure' => '2026-09-22T09:00:00Z',
        'Gh570 :: a row restated to complete' => '2026-09-22 08:21:30',
        'Gh570 :: the full run says nothing' => '2026-09-22 08:22:59',
        'Gh581 :: an assumption is not something not computed' => '2026-09-22T00:00:00Z',
        'Gh588 :: state 2, a run that had its sample' => '2026-09-23T10:00:00Z',
    ];

    /** Three points of the wall clock: the day this runs, a week on, a month on. */
    private const WALL_CLOCKS = ['today' => 0, 'a week later' => 7, 'a month later' => 30];

    /** A complete projection, the shape `AnalysisResults::forSite` hands the panel. */
    private function completeProjection(string $analyzedAt): array
    {
        return [
            'status' => 'complete',
            'analyzedAt' => Carbon::parse($analyzedAt)->toIso8601ZuluString('microsecond'),
            'numbersFrom' => 'complete',
            'lastRun' => ['runId' => 'run-gh791', 'outcome' => 'complete', 'reason' => null],
            'detail' => ['skipped' => [], 'nulls' => [], 'warnings' => [], 'notApplicable' => [],
                'assumptions' => []],
            'metrics' => ['gp' => 55],
        ];
    }

    public function test_every_one_of_the_five_stamps_is_silent_at_three_points_of_the_wall_clock(): void
    {
        $report = [];
        foreach (self::STAMPS as $case => $stamp) {
            foreach (self::WALL_CLOCKS as $when => $shiftDays) {
                // The wall clock, moved first -- this is what "running on a later day" is.
                Carbon::setTestNow(Carbon::now()->addDays($shiftDays));
                // Then the case states the row's age, which is what the repair does.
                $this->clockAtRowAge($stamp);
                $panel = AnalysisNotice::panel($this->completeProjection($stamp), 'UTC');
                $report[] = ['case' => $case, 'wallClock' => $when,
                    'panel' => $panel === null ? 'silent' : ($panel['text'] ?? '?')];
                Carbon::setTestNow();
            }
        }
        fwrite(STDOUT, PHP_EOL.'[gh791] the five stamps, at three points of the wall clock:'.PHP_EOL);
        foreach ($report as $row) {
            fwrite(STDOUT, '[gh791]   '.str_pad($row['case'], 52).str_pad($row['wallClock'], 14)
                .' -> '.$row['panel'].PHP_EOL);
        }

        $this->assertCount(15, $report, 'five stamps at three clocks is fifteen readings');
        $this->assertSame([], array_values(array_filter($report, fn ($r) => $r['panel'] !== 'silent')));
    }

    /**
     * THE POSITIVE CONTROL. Without the pin the panel speaks on those same stamps, and the further the wall
     * clock is the louder -- which is what was happening to the five every day.
     */
    public function test_without_the_pin_the_panel_speaks_and_the_number_grows_with_the_clock(): void
    {
        $said = [];
        foreach (['today' => 0, 'a week later' => 7] as $when => $shiftDays) {
            Carbon::setTestNow(Carbon::now()->addDays($shiftDays));
            $panel = AnalysisNotice::panel($this->completeProjection('2026-09-22T09:00:00Z'), 'UTC');
            $said[$when] = $panel['text'] ?? null;
            Carbon::setTestNow();
        }
        fwrite(STDOUT, '[gh791] with no pin: '.json_encode($said).PHP_EOL);

        foreach ($said as $when => $text) {
            $this->assertNotNull($text, 'the panel said nothing at '.$when.', so the rule is not being exercised');
            $this->assertStringContainsString('days old', $text);
        }
        // The two sentences differ, which is the wall clock being read -- the very dependency being removed.
        $this->assertNotSame($said['today'], $said['a week later']);
    }

    /**
     * AND THE AGE IS A CASE'S OWN STATEMENT, both ways: a row the case calls three days old is warned about,
     * with the age in the sentence, whatever day the suite runs on.
     */
    public function test_a_case_may_declare_a_row_old_and_the_panel_says_so(): void
    {
        $stamp = '2026-09-22T09:00:00Z';
        $this->clockAtRowAge($stamp, 3);
        $panel = AnalysisNotice::panel($this->completeProjection($stamp), 'UTC');
        fwrite(STDOUT, '[gh791] a row declared three days old: '.json_encode($panel['text'] ?? null).PHP_EOL);

        $this->assertNotNull($panel);
        $this->assertStringContainsString('3 days old', $panel['text']);

        // And at nought days it is silent, or the line above would be about the panel rather than the age.
        $this->clockAtRowAge($stamp);
        $this->assertNull(AnalysisNotice::panel($this->completeProjection($stamp), 'UTC'));
    }

    /** The helper refuses a case that pins the clock to nothing, rather than pinning it to today. */
    public function test_the_helper_refuses_an_empty_stamp_and_a_negative_age(): void
    {
        $refusals = [];
        try { $this->clockAtRowAge('   '); } catch (\RuntimeException $e) { $refusals['empty'] = $e->getMessage(); }
        try { $this->clockAtRowAge('2026-09-22T09:00:00Z', -1); } catch (\RuntimeException $e) {
            $refusals['negative'] = $e->getMessage();
        }
        fwrite(STDOUT, '[gh791] the helper refused: '.json_encode(array_keys($refusals)).PHP_EOL);

        $this->assertArrayHasKey('empty', $refusals);
        $this->assertArrayHasKey('negative', $refusals);
    }
}
