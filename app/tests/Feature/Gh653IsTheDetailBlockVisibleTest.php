<?php

namespace Tests\Feature;

use Tests\TestCase;

/**
 * GH-653 — IS THE PANEL'S `details` BLOCK SOMETHING A CLIENT READS?
 *
 * The coordinator's question, and it is asked because of what the reviewer's live
 * render printed inside it: `[disease] [b35fix365 writer1-mainBlock]
 * GAIP_DISEASE_RESULT written…` and `[wear] … BLOCKED - recovery windows require
 * defined intent`. If a client reads that, we are printing ticket numbers, global
 * variable names and an engine's internal state to a person — the thing the rule
 * settled tonight forbids anywhere, page or panel.
 *
 * MEASURED BY RENDERING THE PARTIAL, not by reading it: the template is compiled
 * with a projection that carries warnings, and the resulting HTML is inspected for
 * where those lines land.
 */
class Gh653IsTheDetailBlockVisibleTest extends TestCase
{
    private function projectionWithWarnings(): array
    {
        return [
            'metrics' => ['growthPotential' => 0.5],
            'computed' => ['soilNutrition' => []],
            'analyzedAt' => '2026-09-20T22:10:00.000Z',
            'status' => 'partial',
            'numbersFrom' => 'complete',
            'lastRun' => [
                'runId' => 'r', 'outcome' => 'partial', 'completedAt' => '2026-09-24T06:00:00.000Z',
                'reason' => 'values-not-computed',
                'nulls' => ['soilTemp'], 'skipped' => [], 'assumptions' => [],
                'warnings' => [
                    ['level' => 'problem', 'module' => 'disease',
                        'message' => '[b35fix365 writer1-mainBlock] GAIP_DISEASE_RESULT written, species: "browntopBent" diseases: 8 topRisk: 79'],
                    ['level' => 'problem', 'module' => 'wear',
                        'message' => 'Wear engine blocked by identity enforcement: — BLOCKED - recovery windows require defined intent'],
                ],
            ],
            'numbersRun' => ['outcome' => 'complete', 'skipped' => [], 'notApplicable' => [],
                'notes' => [], 'assumptions' => []],
        ];
    }

    public function test_the_partial_renders_and_the_detail_block_is_in_the_html_a_browser_receives(): void
    {
        $html = view('partials.analysis-notice', ['analysisCache' => $this->projectionWithWarnings()])->render();

        fwrite(STDOUT, PHP_EOL.'[gh653] rendered HTML length: '.strlen($html).PHP_EOL);
        $hasDetails = str_contains($html, '<details');
        $hasSummary = str_contains($html, 'Details (');
        fwrite(STDOUT, '[gh653] <details> element present: '.json_encode($hasDetails)
            .' | summary "Details (n)": '.json_encode($hasSummary).PHP_EOL);

        // Positive control: the panel rendered something at all.
        $this->assertStringContainsString('db-analysis-notice', $html);
        $this->assertTrue($hasDetails, 'the detail block is not rendered at all');
    }

    public function test_WHAT_A_CLIENT_WOULD_READ_inside_it(): void
    {
        $html = view('partials.analysis-notice', ['analysisCache' => $this->projectionWithWarnings()])->render();
        preg_match('#<details.*?</details>#s', $html, $m);
        $block = $m[0] ?? '';
        fwrite(STDOUT, '[gh653] the detail block, as a browser gets it:'.PHP_EOL.$block.PHP_EOL);

        // The identifiers the coordinator named, looked for in the rendered HTML.
        $identifiers = [];
        foreach (['b35fix365', 'writer1-mainBlock', 'GAIP_DISEASE_RESULT', 'BLOCKED', 'browntopBent'] as $needle) {
            if (str_contains($block, $needle)) {
                $identifiers[] = $needle;
            }
        }
        fwrite(STDOUT, '[gh653] technical identifiers inside it: '.json_encode($identifiers).PHP_EOL);

        // Stated as the measurement: this is what is in the markup today.
        $this->assertNotSame([], $identifiers,
            'no identifier reached the markup — then the finding is about something else');
        // And whether it is hidden: `display:none` on the panel, or the element
        // being closed by default, are two different things and only one of them
        // hides the text from a reader who opens it.
        $panelHidden = (bool) preg_match('#id="db-analysis-notice"[^>]*display:none#', $html);
        $detailsOpen = str_contains($block, '<details open');
        fwrite(STDOUT, '[gh653] the panel itself hidden: '.json_encode($panelHidden)
            .' | the block open by default: '.json_encode($detailsOpen).PHP_EOL);
        $this->assertFalse($panelHidden, 'the panel is hidden, so nothing of this is on screen');
    }
}
