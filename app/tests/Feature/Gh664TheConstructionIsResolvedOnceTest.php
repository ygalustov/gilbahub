<?php

namespace Tests\Feature;

use App\Support\CalculationInputs;
use Tests\TestCase;

/**
 * GH-664 (queue item 3ch, the analyst's 26.1 point 1) — THE CONSTRUCTION IS
 * RESOLVED ON THE SERVER, FROM THE ONE DECLARED DICTIONARY.
 *
 * The dictionary has existed since GH-656 and had no reader, so every consumer
 * kept its own table — twelve of them across ten readers (26.2). This is the
 * reader. What it returns has to tell three states apart, because the engine that
 * used to guess turned all three into clay: a site with no construction, a value
 * the dictionary does not carry, and a value whose cell for a given consumer is
 * one of the owner's ten open questions.
 *
 * THE EXPECTATIONS COME FROM THE DICTIONARY, not from a list written here: the
 * cases read `calculation-inputs.schema.json` for what a value should resolve to,
 * so a spelling changed there moves this file with it rather than leaving it
 * agreeing with a copy of itself.
 */
class Gh664TheConstructionIsResolvedOnceTest extends TestCase
{
    private function dictionary(): array
    {
        $file = base_path('../assets/calculation-inputs.schema.json');
        $this->assertFileExists($file);
        $decoded = json_decode((string) file_get_contents($file), true);

        return $decoded['inputs']['turf.construction']['values'] ?? [];
    }

    public function test_every_declared_value_resolves_to_what_the_dictionary_says(): void
    {
        $values = $this->dictionary();
        // POSITIVE CONTROL: the dictionary was read and is not empty, or every
        // claim below would be made about nothing.
        $this->assertGreaterThan(5, count($values));

        foreach ($values as $value => $entry) {
            $resolved = CalculationInputs::resolveConstruction(['turf' => ['construction' => $value]]);
            $this->assertIsArray($resolved, $value);
            $this->assertTrue($resolved['known'], $value.' is declared but came back unknown');
            $this->assertSame($value, $resolved['value'], $value);

            foreach (($entry['resolves'] ?? []) as $consumer => $answer) {
                if ($answer === null) {
                    // An open cell is ABSENT from the resolved object rather than
                    // present as null: a reader must not be handed something that
                    // looks like an answer (26.2).
                    $this->assertArrayNotHasKey($consumer, $resolved['resolves'],
                        $value.'/'.$consumer.' is an open question and was handed over anyway');
                    continue;
                }
                $this->assertSame($answer, $resolved['resolves'][$consumer], $value.'/'.$consumer);
            }
        }
    }

    public function test_no_construction_resolves_to_nothing_rather_than_to_a_default(): void
    {
        $this->assertNull(CalculationInputs::resolveConstruction(null));
        $this->assertNull(CalculationInputs::resolveConstruction([]));
        $this->assertNull(CalculationInputs::resolveConstruction(['turf' => []]));
        $this->assertNull(CalculationInputs::resolveConstruction(['turf' => ['construction' => '']]));
        $this->assertNull(CalculationInputs::resolveConstruction(['turf' => ['construction' => '   ']]));
    }

    public function test_a_value_nobody_declared_comes_back_as_unknown_and_not_as_absent(): void
    {
        // The two are different answers and the old engine could not tell them
        // apart: one is a site nobody configured, the other a value somebody chose
        // that we cannot interpret. A consumer may word them differently.
        $resolved = CalculationInputs::resolveConstruction(
            ['turf' => ['construction' => 'a_construction_nobody_declared']]);

        $this->assertIsArray($resolved);
        $this->assertFalse($resolved['known']);
        $this->assertSame('a_construction_nobody_declared', $resolved['value']);
        $this->assertSame([], $resolved['resolves']);
    }

    public function test_the_open_cells_are_the_ten_the_analyst_counted(): void
    {
        // Her number, reproduced by the rule that produced it rather than copied:
        // eleven values by six consumers is sixty-six cells, and the empty ones are
        // the owner's open question, narrowed to a list of cells. The number of
        // that question belongs in the defects document and not here: a reference
        // to it in code breaks silently when the numbering is regrouped (GH-601).
        $values = $this->dictionary();
        $open = [];
        foreach ($values as $value => $entry) {
            foreach (($entry['resolves'] ?? []) as $consumer => $answer) {
                if ($answer === null) {
                    $open[] = $value.'/'.$consumer;
                }
            }
        }
        sort($open);
        fwrite(STDOUT, PHP_EOL.'[gh664] open cells ('.count($open).'): '.implode(' ', $open).PHP_EOL);

        // Not asserted as a fixed ten: the number moves when the owner answers, and
        // a case that fixes it would go red on her answer rather than on a defect.
        // What is asserted is that every open cell is open for a DECLARED value and
        // a DECLARED consumer, so a typo cannot masquerade as an open question.
        $consumers = ['surfaceKey', 'thermalProfile', 'irrigationSoilType',
            'structurePathway', 'wearSandBased', 'preEmergentTexture'];
        foreach ($open as $cell) {
            [$value, $consumer] = explode('/', $cell, 2);
            $this->assertArrayHasKey($value, $values, $cell);
            $this->assertContains($consumer, $consumers, $cell);
        }
        // And `structurePathway` — the consumer this ticket connects — has no open
        // cell at all, which is why the engine can be switched over now.
        $this->assertSame([], array_values(array_filter($open,
            fn (string $c) => str_ends_with($c, '/structurePathway'))));
    }
}
