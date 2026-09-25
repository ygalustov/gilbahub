<?php

namespace Tests\Feature;

use Tests\TestCase;

/**
 * GH-752 (queue item 3bl, part A, delivery 3) — THE SOIL INTERPRETATION IS WRITTEN FOR THE SITE'S
 * METHODOLOGY, OR NOT AT ALL.
 *
 * The page now sends the site's methodology, or nothing when the site has none. The server then put
 * MLSN in its place three ways: `?? 'mlsn'` where the value was read, a fallback to the MLSN config,
 * and `normalise_methodology` answering MLSN for anything it did not recognise, the empty string
 * included. So the substitution the client stopped making had moved to the server — the same defect
 * at a new address. The text reaches the client through the Word export.
 *
 * An absent or unknown methodology is a refusal with its reason now; a known one is interpreted as
 * itself. The refusal comes before the service check so that it does not depend on a key being set.
 */
class Gh752TheSoilInterpretationIsWrittenForTheSitesMethodologyTest extends TestCase
{
    private function interpreter(): \Gilba_Soil_Interpretation
    {
        \App\Support\GilbaRuntimeBootstrap::loadInterpretationClasses();

        return new \Gilba_Soil_Interpretation();
    }

    private function invokePrivate(object $o, string $method, ...$args)
    {
        $m = new \ReflectionMethod($o, $method);
        $m->setAccessible(true);

        return $m->invoke($o, ...$args);
    }

    public function test_no_methodology_and_an_unknown_one_are_refused_with_the_reason(): void
    {
        $i = $this->interpreter();
        $got = [];
        foreach (['absent' => [], 'empty' => ['methodology' => ''], 'unknown' => ['methodology' => 'something_nobody_declared']] as $case => $extra) {
            $r = $i->interpret(array_merge(['ppm' => ['K' => 40], 'surfaceType' => 'sports'], $extra));
            $got[$case] = [$r['success'] ?? null, $r['error'] ?? null];
        }
        fwrite(STDOUT, PHP_EOL.'[gh752] soil interpretation without a known methodology: '.json_encode($got).PHP_EOL);

        foreach ($got as $case => [$ok, $error]) {
            $this->assertFalse($ok, $case);
            $this->assertStringContainsString('methodology', strtolower((string) $error), $case.' is refused for another reason');
        }
    }

    public function test_a_known_methodology_is_interpreted_as_itself(): void
    {
        $i = $this->interpreter();
        $got = [];
        foreach (['slan', 'mlsn', 'ammonium_acetate'] as $m) {
            $got[$m] = $this->invokePrivate($i, 'normalise_methodology', $m);
        }
        $prompt = $this->invokePrivate($i, 'build_soil_prompt', ['methodology' => 'slan', 'ppm' => ['K' => 40]]);
        fwrite(STDOUT, '[gh752] normalised: '.json_encode($got).' | slan prompt names SLAN: '.json_encode(str_contains($prompt, 'SLAN')).PHP_EOL);

        $this->assertSame(['slan' => 'SLAN', 'mlsn' => 'MLSN', 'ammonium_acetate' => 'AMMONIUM_ACETATE'], $got);
        $this->assertNull($this->invokePrivate($i, 'normalise_methodology', ''));
        $this->assertStringContainsString('SLAN', $prompt);
        $this->assertStringNotContainsString('Minimum Levels for Sustainable Nutrition', $prompt);
    }
}
