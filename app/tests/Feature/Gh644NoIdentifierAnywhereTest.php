<?php

namespace Tests\Feature;

use App\Support\AnalysisNotice;
use Tests\TestCase;

/**
 * GH-644 — A CLIENT READS NO TECHNICAL IDENTIFIER ANYWHERE: NOT ON A PAGE, NOT IN
 * THE PANEL.
 *
 * GH-643 took the identifier off the Plan page. The coordinator extended the rule
 * to the panel, and the reason is the one that matters: the difference between a
 * page and a panel is where they sit, not what they are for. A rule that stopped
 * at the edge of a page would protect the layout rather than the person.
 *
 * WHERE THE PANEL CAN STILL PRINT ONE. `UNKNOWN_REASON` — "the run reported
 * {code}" — is what the panel says for a code with no sentence. It is not reached
 * for any code the runner sends TODAY, and that is luck rather than construction:
 * the next code someone adds to the runner without a sentence here puts its
 * identifier in front of a client.
 *
 * SO THE PROPERTY IS ASSERTED INSTEAD OF THE LUCK: every code the runner can send
 * has a sentence. The universe is the runner's own source, not a list written
 * here — a code added there without a sentence reddens this, and the fix is a
 * sentence rather than a guard.
 */
class Gh644NoIdentifierAnywhereTest extends TestCase
{
    /** Every reason code the runner can send, read out of the assets that send them. */
    private function codesTheRunnerSends(): array
    {
        $dir = base_path('../assets');
        $codes = [];
        foreach (['hub-persistence.js', 'hub-orchestrator.js', 'cascade-orchestrator.js', 'hub-tissue-v3.js'] as $file) {
            $src = @file_get_contents($dir.'/'.$file);
            if ($src === false) {
                continue;
            }
            // MEASURED, and the first pattern was wrong: the runner does not
            // mostly write `reason: 'x'`. It calls `noteSkipped(step, module,
            // code, …)` and `noteFailure(code, …)`, and the code is the third or
            // the first argument. Both call shapes are read, plus the literal
            // `reason:` form for the few places that use it.
            preg_match_all('/noteSkipped\(\s*[\'"][^\'"]+[\'"]\s*,\s*[\'"][^\'"]+[\'"]\s*,\s*[\'"]([a-z][a-z0-9-]{4,})[\'"]/', $src, $skipped);
            preg_match_all('/note(?:Failure|Failed|Error)\(\s*[\'"]([a-z][a-z0-9-]{4,})[\'"]/', $src, $failed);
            preg_match_all('/reason\s*[:=]\s*[\'"]([a-z][a-z0-9-]{4,})[\'"]/', $src, $literal);
            foreach (array_merge($skipped[1], $failed[1], $literal[1]) as $code) {
                $codes[$code] = true;
            }
        }

        return array_keys($codes);
    }

    public function test_the_runners_codes_are_found_at_all(): void
    {
        // Positive control: an empty universe agrees with any reasons table.
        $codes = $this->codesTheRunnerSends();
        fwrite(STDOUT, PHP_EOL.'[gh644] codes the runner can send ('.count($codes).'): '.implode(' ', $codes).PHP_EOL);

        $this->assertGreaterThan(4, count($codes));
    }

    public function test_every_code_the_runner_can_send_has_a_sentence_so_the_panel_never_prints_an_identifier(): void
    {
        $reasons = (new \ReflectionClass(AnalysisNotice::class))->getConstant('REASONS');
        $unworded = [];
        $answersNotReachingThePanel = [];
        foreach ($this->codesTheRunnerSends() as $code) {
            // GH-649 SHARPENED THIS SIGN, and a real case forced it: the runner
            // now also writes `reason: 'pgr-window-exhausted'` INSIDE a journal
            // note's data, and my pattern could not tell that from a run's
            // failure reason. It is not one: its class is `answer`, so the run
            // completes and the entry is an `info` note, which the panel does not
            // print (GH-573). A code that cannot reach the panel needs no
            // sentence for the panel's sake — and the exemption is read off the
            // CLASS, not off a list of codes kept here.
            if (($reasons[$code]['class'] ?? null) === 'answer') {
                $answersNotReachingThePanel[] = $code;
                continue;
            }
            if (! isset($reasons[$code]['text'])) {
                $unworded[] = $code;
            }
        }
        fwrite(STDOUT, '[gh644] codes that are answers and so never a panel reason: '
            .json_encode($answersNotReachingThePanel).PHP_EOL);
        fwrite(STDOUT, '[gh644] codes with no sentence: '.json_encode($unworded).PHP_EOL);

        $this->assertSame([], $unworded,
            'a code the runner sends has no sentence, so the panel would print the code itself');
    }

    public function test_the_frame_for_an_unworded_code_still_exists_and_is_the_only_place_a_code_could_appear(): void
    {
        // Kept rather than removed: a code nobody phrased is still more use to a
        // reader than a blank, and it is the honest last resort. What this set
        // asserts is that the resort is not REACHED — the difference between a
        // fallback and a defect is whether anything arrives at it.
        $unknown = (new \ReflectionClass(AnalysisNotice::class))->getConstant('UNKNOWN_REASON');
        $this->assertStringContainsString('{code}', $unknown);

        /**
         * And no SENTENCE in the composer's output carries a raw code shape.
         *
         * GH-734 NARROWED THE UNIVERSE, and the narrowing is a correction of this case rather than
         * room made for a change. It flattened the whole payload, and the payload legitimately
         * carries identifiers beside the sentences: every section travels with its `step`, `class`
         * and `cause`, which are the server's words for the server and are never printed — the page
         * prints `text`. The shape `a-b-c` therefore matched the first step identifier of three
         * words to reach a section, `soil-temp-physics`, and called a working payload a defect. What
         * a reader is shown is the reasons, the frame, the last resort and each section's `text`, so
         * that is what is inspected; the fields are named here rather than filtered by shape,
         * because a field added to a section must be classified by a person, not skipped by a regex.
         */
        $payload  = AnalysisNotice::clientTexts();
        $sentences = array_values((array) $payload['reasons']);
        $sentences[] = $payload['frame'];
        $sentences[] = $payload['unknown'];
        foreach ((array) $payload['sections'] as $key => $section) {
            if (is_array($section) && isset($section['text'])) {
                $sentences[] = $section['text'];
            }
        }
        $flat = array_values(array_filter($sentences, 'is_string'));
        fwrite(STDOUT, '[gh644] sentences that travel to the browser: '.count($flat).PHP_EOL);
        $this->assertGreaterThan(5, count($flat), 'nothing was inspected, and an empty set agrees with anything');

        $withCodeShape = array_values(array_filter($flat, fn ($t) => $t !== $unknown && preg_match('/^[a-z]+(-[a-z]+){2,}$/', trim($t))));
        $this->assertSame([], $withCodeShape, 'a sentence that is really an identifier travels to the browser');
    }
}
