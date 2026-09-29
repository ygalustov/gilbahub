<?php

namespace Tests\Unit;

use App\Support\AnalysisNotice;
use Tests\TestCase;

/**
 * GH-772 - THE SENTENCE FOR AN APPLICATION WHOSE EFFECT HAS ENDED, AND ITS THREE FIGURES.
 *
 * Until now this cause had `'text' => null` in the reasons table -- the words were the owner's and she
 * had not given them, so the page kept its own sentence, "No PGR application recorded", for a site
 * whose log held an application older than the window. Measured on the stand: one site,
 * `Test5 - NZ`, applied a PGR 104 days ago, and it is the one that saw that untruth. (`Burns` is not
 * in that count: its log holds no PGR at all, so the old sentence is true of it since GH-771.)
 *
 * The owner approved the wording on 28.09.2026 and set one condition: the product, the date and the
 * length of the window are DATA, not a literal -- "if the window ever becomes something else, the
 * phrase must change by itself". So all three are read from the journal entry the run wrote, and each
 * of the three is guarded by its own case below.
 */
class Gh772ThePgrWindowExhaustedSentenceTest extends TestCase
{
    private function sectionFor(array|string $noteData, string $step = 'pgr'): ?array
    {
        $projection = [
            'computed' => ['pgr' => null],
            'numbersRun' => [
                'notes' => [[
                    'step' => $step,
                    'message' => 'plant-growth-regulator applied beyond the history window',
                    'data' => $noteData,
                ]],
            ],
        ];

        return AnalysisNotice::section('pgr', $projection);
    }

    private const NOTE = [
        'reason' => 'pgr-window-exhausted',
        'daysSinceApplication' => 104,
        'windowDays' => 90,
        'productType' => 'TE250',
        'applicationDate' => '2026-06-16',
    ];

    public function test_the_sentence_is_the_one_the_owner_approved(): void
    {
        $section = $this->sectionFor(self::NOTE);
        fwrite(STDOUT, PHP_EOL.'[gh772] the section reads: '.json_encode($section['text'] ?? null).PHP_EOL);

        $this->assertSame(
            'Last PGR application: TE250 on 16 Jun 2026, more than 90 days ago. '
            .'Its growth-regulation effect has ended and is not included in this analysis.',
            $section['text'] ?? null
        );
    }

    public function test_the_product_comes_from_the_note_and_not_from_the_sentence(): void
    {
        $section = $this->sectionFor(array_merge(self::NOTE, ['productType' => 'TE120']));
        fwrite(STDOUT, '[gh772] with another product: '.json_encode($section['text'] ?? null).PHP_EOL);

        $this->assertStringContainsString('Last PGR application: TE120 on', $section['text'] ?? '');
    }

    public function test_the_date_comes_from_the_note(): void
    {
        $section = $this->sectionFor(array_merge(self::NOTE, ['applicationDate' => '2026-01-03']));
        fwrite(STDOUT, '[gh772] with another date: '.json_encode($section['text'] ?? null).PHP_EOL);

        $this->assertStringContainsString('on 3 Jan 2026, more than', $section['text'] ?? '');
    }

    public function test_the_window_comes_from_the_runs_own_constant(): void
    {
        $section = $this->sectionFor(array_merge(self::NOTE, ['windowDays' => 120]));
        fwrite(STDOUT, '[gh772] with a window of 120 days: '.json_encode($section['text'] ?? null).PHP_EOL);

        $this->assertStringContainsString('more than 120 days ago', $section['text'] ?? '');
        $this->assertStringNotContainsString('90 days', $section['text'] ?? '');
    }

    public function test_without_the_figures_there_is_no_sentence_and_nothing_is_guessed(): void
    {
        foreach (['productType', 'applicationDate', 'windowDays'] as $missing) {
            $note = self::NOTE;
            unset($note[$missing]);
            $section = $this->sectionFor($note);
            fwrite(STDOUT, '[gh772] without '.$missing.': '.json_encode($section['text'] ?? null).PHP_EOL);

            $this->assertNull($section['text'] ?? null, 'a sentence was composed without its '.$missing);
        }
    }

    public function test_the_runners_own_shape_is_read_too_the_data_as_a_json_string(): void
    {
        $section = $this->sectionFor(json_encode(self::NOTE));
        fwrite(STDOUT, '[gh772] with the data as the runner records it: '
            .json_encode($section['text'] ?? null).PHP_EOL);

        $this->assertStringContainsString('TE250 on 16 Jun 2026', $section['text'] ?? '');
    }
}
