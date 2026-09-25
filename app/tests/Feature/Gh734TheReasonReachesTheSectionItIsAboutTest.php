<?php

namespace Tests\Feature;

use App\Support\AnalysisNotice;
use Tests\TestCase;

/**
 * GH-734 (queue item 3az) — THE REASON REACHES THE SECTION IT IS ABOUT.
 *
 * The run records why the soil temperature was not computed. A recorded cause is found by the STEP
 * it is filed under (`AnalysisNotice::causeRecordedFor` asks `entryStep`, which reads `step` and
 * falls back to `module`), and the section of a result key asks for the step the graph names for
 * that key. So the two have to be the same word, or the sentence lands on another subject.
 *
 * WHAT KIND OF CHECK THIS IS: the panel's own composer, given the shape the run leaves. What a
 * browser writes into that shape is checked in `tests/gh734-…` on the orchestrator's text; this is
 * the other half — that the shape, once written, is read by the section it was written for.
 */
class Gh734TheReasonReachesTheSectionItIsAboutTest extends TestCase
{
    /** The projection a partial run leaves when the soil temperature was skipped. */
    private function projection(string $step, string $module, string $reason): array
    {
        $run = ['outcome' => 'partial', 'at' => '2026-09-25T00:00:00Z',
            'skipped' => [['step' => $step, 'module' => $module,
                'reason' => $reason, 'resultKey' => 'soilTempPhysics']]];

        return [
            'computed'    => ['soilTempPhysics' => null, 'climate' => ['tmean' => 14.2]],
            'metrics'     => ['growthPotential' => 61],
            'analyzedAt'  => '2026-09-25T00:00:00Z',
            'numbersFrom' => 'partial',
            'lastRun'     => $run,
            'numbersRun'  => $run,
        ];
    }

    public function test_the_soil_temperature_section_carries_the_recorded_reason_and_names_itself(): void
    {
        $p = $this->projection('soil-temp-physics', 'soil-temp-physics', 'setting-missing');
        $section = AnalysisNotice::section('soilTempPhysics', $p);

        fwrite(STDOUT, '[gh734] the soil temperature section: '.json_encode($section).PHP_EOL);

        $this->assertIsArray($section, 'no section at all — the claims below would be vacuous');
        $this->assertSame('setting-missing', $section['cause']);
        $this->assertSame('soil-temp-physics', $section['step']);
        // The word a reader sees for this part, and it is not the identifier.
        $this->assertSame('soil temperature', $section['module']);
        $this->assertNotNull($section['text']);
    }

    public function test_the_climate_section_is_not_blamed_for_the_soil_temperature(): void
    {
        $p = $this->projection('soil-temp-physics', 'soil-temp-physics', 'soil-moisture-unavailable');
        $climate = AnalysisNotice::section('climate', $p);

        fwrite(STDOUT, '[gh734] the climate section beside it: '.json_encode($climate).PHP_EOL);

        // `climate` produced numbers here, so it has no sentence at all. The failure this guards is
        // the reason being filed under `climate`: the panel would then tell a reader that the
        // CLIMATE was not calculated, in the words of the soil temperature.
        $this->assertNull($climate, 'the climate section must not carry the soil temperature reason');
    }

    public function test_the_step_and_the_module_of_this_skip_are_one_word(): void
    {
        /**
         * The positive control for the two above, and the thing that made them necessary: filed
         * under a different step, the same recorded reason does not reach the section it is about.
         */
        $wrong = AnalysisNotice::section('soilTempPhysics',
            $this->projection('climate', 'soil-temp-physics', 'setting-missing'));

        fwrite(STDOUT, '[gh734] the same reason filed under `climate`, as the section reads it: '
            .json_encode($wrong).PHP_EOL);

        $this->assertNull($wrong['cause'], 'filed under another step, this is how the reason is lost');
        $this->assertSame('not-recorded', $wrong['class']);
    }

    public function test_misfiled_the_reason_does_not_vanish_but_speaks_of_the_wrong_part(): void
    {
        /**
         * The other half of the same misfiling, and the one a client would have read: where the
         * step it was filed under is ALSO empty, the section of that step takes the cause and
         * prints the soil temperature's words under the climate's name.
         */
        $p = $this->projection('climate', 'soil-temp-physics', 'setting-missing');
        $p['computed']['climate'] = null;
        $climate = AnalysisNotice::section('climate', $p);

        fwrite(STDOUT, '[gh734] misfiled, with the climate empty too: '.json_encode($climate).PHP_EOL);

        $this->assertIsArray($climate);
        $this->assertSame('setting-missing', $climate['cause']);
        $this->assertSame('climate', $climate['module']);
        $this->assertStringContainsString('soil temperature', (string) $climate['text']);
    }
}
