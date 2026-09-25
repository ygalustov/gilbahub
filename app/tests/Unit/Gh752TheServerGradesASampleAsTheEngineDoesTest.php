<?php

namespace Tests\Unit;

use App\Http\Controllers\SampleAnalysisController;
use App\Support\CalculationInputs;
use Tests\TestCase;

/**
 * GH-752 (queue item 3bl, part C) - THE SERVER GRADES A SAMPLE AS THE ENGINE DOES: THE SERVER SIDE.
 *
 * The grid in `tests/fixtures/gh752-grade-grid.json` was recorded from `mlsnEngine`, and the engine
 * is held equal to it on the JavaScript side. Here the server's analysis of the same sample is held
 * equal to it, cell by cell and nutrient by nutrient, with the grade and the threshold asserted
 * apart. The soil type is not given to the server: it resolves it from the cell's construction
 * through the construction dictionary, and prints it.
 *
 * MLSN IS PRINTED, NOT ASSERTED. The engine grades MLSN against a target that depends on the run's
 * annual uptake (the N programme), which a single sample does not carry; the server grades it by
 * the threshold alone. Whether the server should do something else is not decided here.
 */
class Gh752TheServerGradesASampleAsTheEngineDoesTest extends TestCase
{
    private function grid(): array
    {
        return json_decode((string) file_get_contents(base_path('tests/fixtures/gh752-grade-grid.json')), true);
    }

    private function serverRows(array $input, array $cell): array
    {
        $payload = array_merge($input['ppm'], ['pH' => $input['pH'], 'CEC' => $input['CEC']]);
        $construction = CalculationInputs::resolveConstruction(['turf' => ['construction' => $cell['construction']]]);
        $soilType = $construction['resolves']['slanSoilType'] ?? null;
        $m = new \ReflectionMethod(SampleAnalysisController::class, 'computeNutrients');
        $m->setAccessible(true);
        $rows = $m->invoke(new SampleAnalysisController(), $payload, $cell['methodology'], $input['soilTexture'],
            $input['species'], $soilType);
        $out = [];
        foreach ($rows as $r) {
            // The engine shows a SLAN range only as its label, to one decimal, so both sides are
            // compared at that precision.
            $threshold = isset($r['rangeMin'], $r['rangeMax'])
                ? ['lo' => round($r['rangeMin'], 1) + 0, 'hi' => round($r['rangeMax'], 1) + 0]
                : ['single' => (float) $r['mlsn']];
            $out[$r['nutrient']] = ['grade' => $r['statusClass'], 'threshold' => $threshold];
        }

        return [$soilType, $out];
    }

    public function test_slan_and_aa_samples_are_graded_as_the_engine_grades_them(): void
    {
        $grid = $this->grid();
        $grades = [];
        $thresholds = [];
        foreach ($grid['cells'] as $cell) {
            [$soilType, $server] = $this->serverRows($grid['input'], $cell);
            $at = $cell['construction'].' / '.$cell['methodology'];
            fwrite(STDOUT, PHP_EOL.'[gh752c] server '.$at.' (soil type resolved: '.json_encode($soilType).'): K '
                .json_encode($server['K']['threshold'] ?? null));
            foreach ($cell['rows'] as $nut => $engine) {
                $s = $server[$nut] ?? ['grade' => null, 'threshold' => null];
                if ($cell['methodology'] === 'mlsn') {
                    if ($s != $engine) {
                        fwrite(STDOUT, PHP_EOL.'[gh752c]   MLSN, not asserted: '.$nut.' engine '.json_encode($engine).' server '.json_encode($s));
                    }
                    continue;
                }
                if ($s['grade'] !== $engine['grade']) {
                    $grades[] = $at.' '.$nut.': engine '.$engine['grade'].', server '.json_encode($s['grade']);
                }
                $e = isset($engine['threshold']['lo'])
                    ? ['lo' => round($engine['threshold']['lo'], 1) + 0, 'hi' => round($engine['threshold']['hi'], 1) + 0]
                    : $engine['threshold'];
                if ($s['threshold'] != $e) {
                    $line = $at.' '.$nut.': engine '.json_encode($e).', server '.json_encode($s['threshold']);
                    // AA micronutrients: the server's AA table carries P, K, Ca, Mg and S only, so Fe, Mn,
                    // Zn, Cu and B fall through to MLSN's thresholds. A finding of this work, put to the
                    // coordinator with its size; printed, not asserted, until it is decided.
                    if ($cell['methodology'] === 'ammonium_acetate' && isset($s['threshold']['single'])) {
                        fwrite(STDOUT, PHP_EOL.'[gh752c]   AA judged by an MLSN threshold on the server, not asserted: '.$line);
                    } else {
                        $thresholds[] = $line;
                    }
                }
            }
        }
        fwrite(STDOUT, PHP_EOL);

        $this->assertSame([], $grades, 'grades differ');
        $this->assertSame([], $thresholds, 'thresholds differ');
    }

    /**
     * GH-752, on the reviewer's return - A SAMPLE WITH NO pH. The run puts pH 7 where the sample has
     * none, which is an open owner question; the server does not repeat it. Fe and Mn are the
     * readings SLAN adjusts by pH, so they say the pH is missing; the rest are graded as usual. The
     * sample printed first shows that it carries no pH at all.
     */
    public function test_a_slan_sample_with_no_ph_names_the_absence_for_fe_and_mn(): void
    {
        $grid = $this->grid();
        $payload = $grid['input']['ppm'];
        $m = new \ReflectionMethod(SampleAnalysisController::class, 'computeNutrients');
        $m->setAccessible(true);
        $rows = $m->invoke(new SampleAnalysisController(), $payload, 'slan', 'loam', null, 'sands');
        $by = [];
        foreach ($rows as $r) {
            $by[$r['nutrient']] = $r['status'];
        }
        fwrite(STDOUT, PHP_EOL.'[gh752c] sample carries pH: '.json_encode(array_key_exists('pH', $payload))
            .' | statuses: '.json_encode($by).PHP_EOL);

        $this->assertArrayNotHasKey('pH', $payload);
        $this->assertSame('No pH on the sample', $by['Fe']);
        $this->assertSame('No pH on the sample', $by['Mn']);
        foreach (['P', 'K', 'Ca', 'Mg', 'S', 'Zn', 'Cu', 'B'] as $nut) {
            $this->assertNotSame('No pH on the sample', $by[$nut], $nut.' does not depend on pH');
        }
    }

    public function test_a_slan_site_without_a_construction_is_not_graded_by_a_guessed_soil_type(): void
    {
        $grid = $this->grid();
        $m = new \ReflectionMethod(SampleAnalysisController::class, 'computeNutrients');
        $m->setAccessible(true);
        $rows = $m->invoke(new SampleAnalysisController(), array_merge($grid['input']['ppm'], ['pH' => 7.4]),
            'slan', 'loam', null, null);
        $statuses = array_values(array_unique(array_column($rows, 'status')));
        fwrite(STDOUT, PHP_EOL.'[gh752c] SLAN with no soil type: '.json_encode($statuses).PHP_EOL);

        $this->assertSame(['No construction set'], $statuses);
    }
}
