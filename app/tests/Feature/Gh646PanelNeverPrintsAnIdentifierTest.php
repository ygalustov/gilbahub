<?php

namespace Tests\Feature;

use App\Support\AnalysisNotice;
use Tests\TestCase;

/**
 * GH-646 — WHAT THE PANEL ACTUALLY PRINTS, MEASURED, FOR EVERY SHAPE A ROW CAN
 * HAVE.
 *
 * The rule is the owner's and it has no edge: a client reads no technical
 * identifier anywhere. GH-644 asserted the PROPERTY that makes it so — every code
 * the runner can send has a sentence, so the "the run reported {code}" frame is
 * never reached. This is the other half of the same question, and it is a
 * measurement rather than an argument: the panel is built for each shape a stored
 * row can take, and its text is inspected for anything that looks like an
 * identifier.
 *
 * THE UNIVERSE: every code `REASONS` declares, read from the table. Not a list
 * typed here — that was the first version of this set, and it would have missed
 * any code added after the day it was written.
 *
 * WHAT COUNTS AS AN IDENTIFIER, and it is decided by shape rather than by a list:
 * a lower-case word with at least two hyphens and no spaces around it —
 * `no-soil-sample`, `soil-sample-not-loaded`, `run-incomplete`. A person's
 * sentence does not contain one; a code is one.
 */
class Gh646PanelNeverPrintsAnIdentifierTest extends TestCase
{
    /** Every shape a row can reach the panel in, with the codes the runner sends. */
    private function shapes(): array
    {
        $base = ['metrics' => ['growthPotential' => 0.8], 'computed' => [], 'analyzedAt' => '2026-09-24T02:00:00.000Z',
            'numbersFrom' => 'complete',
            'numbersRun' => ['outcome' => 'complete', 'skipped' => [], 'notApplicable' => [], 'notes' => [], 'assumptions' => []]];

        // GH-648 — THE UNIVERSE IS THE REASONS TABLE, NOT A LIST WRITTEN HERE.
        //
        // It WAS a list of eight codes typed into this file, and that is the
        // defect this team spent the night removing in other people's work: a
        // universe transcribed instead of derived guards what its author
        // remembered on the day. A code added to `REASONS` with an identifier in
        // its sentence would not have joined this check, and the green would have
        // had two causes — nothing reaches the frame, and the list does not know
        // about the new code. Two causes for one green is an unaccepted result.
        //
        // Now: every code the table declares, each as a failed and as a partial
        // run. A new code is measured without anybody remembering.
        $shapes = [];
        // GH-649: the universe is still the table, narrowed by a property OF THE
        // TABLE rather than by a list — a cause of class `answer` cannot be a
        // run's `reason`. Its class says the run computed an answer, so the run is
        // complete and the cause travels as a journal note, which the panel does
        // not print (GH-573). Feeding it here would measure a shape that cannot
        // occur, and the red would be about the fixture rather than the product.
        $table = (new \ReflectionClass(AnalysisNotice::class))->getConstant('REASONS');
        $declared = array_keys(array_filter($table, fn (array $e) => $e['class'] !== 'answer'));
        foreach ($declared as $code) {
            $shapes['failed:'.$code] = array_merge($base, [
                'status' => 'failed',
                'lastRun' => ['runId' => 'r', 'outcome' => 'failed', 'reason' => $code, 'detail' => [],
                    'failedAt' => '2026-09-24T02:00:00.000Z', 'assumptions' => []],
            ]);
            $shapes['partial:'.$code] = array_merge($base, [
                'status' => 'partial',
                'lastRun' => ['runId' => 'r', 'outcome' => 'partial', 'reason' => $code,
                    'nulls' => ['diseaseRisk'], 'skipped' => [['step' => 'mlsn', 'reason' => $code]],
                    'warnings' => [], 'assumptions' => []],
            ]);
        }
        $shapes['complete'] = array_merge($base, [
            'status' => 'complete',
            'lastRun' => ['runId' => 'r', 'outcome' => 'complete', 'completedAt' => '2026-09-24T02:00:00.000Z',
                'assumptions' => []],
        ]);

        return $shapes;
    }

    public function test_the_panel_is_built_for_every_shape_and_says_something(): void
    {
        // Positive control: a panel that came back empty for every shape would
        // pass the claim below while saying nothing at all.
        $said = 0;
        foreach ($this->shapes() as $name => $projection) {
            $panel = AnalysisNotice::panel($projection, 'Pacific/Auckland');
            if ($panel !== null && trim((string) ($panel['text'] ?? '')) !== '') {
                $said++;
            }
        }
        fwrite(STDOUT, PHP_EOL.'[gh646] shapes measured: '.count($this->shapes()).' | panels with text: '.$said.PHP_EOL);

        // The universe is derived, so its size is the table's size — asserted so
        // that a table shrinking to a handful, or a reading that returns nothing,
        // is red rather than quietly narrow.
        $this->assertGreaterThan(20, count($this->shapes()));
        $this->assertGreaterThan(20, $said);
        // And the narrowing is visible rather than silent: the codes left out are
        // named, so "fewer shapes" cannot happen quietly.
        $table = (new \ReflectionClass(AnalysisNotice::class))->getConstant('REASONS');
        $answers = array_keys(array_filter($table, fn (array $e) => $e['class'] === 'answer'));
        fwrite(STDOUT, '[gh646] left out, class `answer` and so never a run reason: '
            .json_encode($answers).PHP_EOL);
    }

    public function test_NOT_ONE_of_those_panels_contains_a_technical_identifier(): void
    {
        $offenders = [];
        foreach ($this->shapes() as $name => $projection) {
            $panel = AnalysisNotice::panel($projection, 'Pacific/Auckland');
            $text = (string) ($panel['text'] ?? '');
            if ($text === '') {
                continue;
            }
            // Strip the code-shaped words that are legitimately part of a
            // sentence: there are none, which is the point — any match is a code.
            if (preg_match_all('/\b[a-z]+(?:-[a-z]+){2,}\b/', $text, $m)) {
                $offenders[$name] = $m[0];
            }
        }
        fwrite(STDOUT, '[gh646] panels printing an identifier: '.json_encode($offenders).PHP_EOL);

        $this->assertSame([], $offenders,
            'the panel printed a technical identifier to a client');
    }

    public function test_and_the_assumption_line_beneath_it_carries_none_either(): void
    {
        // The line under the panel is a second text on the same screen, so the
        // same rule reaches it. Assumptions name a FIELD and a value, and a field
        // name is an identifier too if it travels raw.
        $projection = array_merge($this->shapes()['complete'], [
            'lastRun' => ['runId' => 'r', 'outcome' => 'complete', 'completedAt' => '2026-09-24T02:00:00.000Z',
                // The shape the run actually writes, read from the composer rather
                // than guessed: a display name, a value and a settings label. My
                // first attempt used `field`/`used` and the composer skipped it
                // entirely, so the case asserted nothing and PHPUnit called it
                // risky — a green that measured nothing.
                'assumptions' => [[
                    'displayName' => 'Root depth', 'assumedValue' => '150 mm',
                    'settingsLabel' => 'Settings -> Traffic & Wear',
                ]]],
        ]);
        $lines = AnalysisNotice::assumptions($projection);
        fwrite(STDOUT, '[gh646] assumption lines: '.json_encode($lines).PHP_EOL);

        // Positive control: the line was built at all. An empty list would pass
        // the claim below and measure nothing — which is exactly what happened on
        // the first attempt.
        $this->assertCount(1, $lines);

        foreach ($lines as $line) {
            $this->assertDoesNotMatchRegularExpression('/\b[a-z]+(?:-[a-z]+){2,}\b/', (string) $line,
                'an assumption line printed an identifier');
        }
    }
}
