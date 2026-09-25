<?php

namespace Tests\Feature;

use App\Support\LabReadingNames;
use Tests\TestCase;

/**
 * GH-722 — THE SERVER'S READER OF THE LAB READING NAMES, AND WHAT THE PAGE IS HANDED.
 *
 * `assets/lab-reading-names.json` is read here and nowhere else on the server; the page gets
 * `forClient()` in both layouts, and the sample manager builds its spelling tables from that. The
 * cases hold that the reader answers from the file as it stands and hands the page the file itself,
 * not a subset — a page handed less would read fewer spellings than the map declares, silently.
 */
class Gh722LabReadingNamesTest extends TestCase
{
    public function test_the_reader_answers_from_the_file_as_it_stands(): void
    {
        $this->assertSame(['soil', 'water', 'tissue', 'loi'], LabReadingNames::kinds());

        $soil = LabReadingNames::readings('soil');
        $this->assertIsArray($soil);
        $this->assertSame(['pH_Water', 'pH', 'ph'], $soil['pH']);
        $this->assertContains('CEC_meq100g', $soil['CEC']);
    }

    public function test_a_kind_the_map_does_not_declare_is_null_not_empty(): void
    {
        $this->assertNull(LabReadingNames::readings('sediment'));
        $this->assertNotSame([], LabReadingNames::readings('water'));
    }

    /**
     * The server's resolution against the contract the runner is also held to
     * (`tests/gh722-lab-reading-recognition-contract.test.js`): the same row, the same readings,
     * the same values. The contract carries no row with a reading the runner does not bind, so the
     * two answers are comparable key for key.
     */
    public function test_the_server_recognises_every_contract_row_as_the_runner_reads_it(): void
    {
        $contract = json_decode((string) file_get_contents(base_path('tests/fixtures/gh722-recognition-contract.json')), true);
        $this->assertGreaterThan(300, count($contract['cases']));

        $differ = [];
        foreach ($contract['cases'] as $case) {
            $found = LabReadingNames::recognise($case['kind'], $case['row']) ?? [];
            $read = [];
            foreach ($found as $key => $col) {
                $read[$key] = (float) $case['row'][$col];
            }
            $expected = array_map('floatval', (array) $case['readings']);
            ksort($read);
            ksort($expected);
            if ($read !== $expected) {
                $differ[] = $case['name'].' runner '.json_encode($expected).' server '.json_encode($read);
            }
        }

        fwrite(STDOUT, '[gh722] contract rows checked on the server: '.count($contract['cases']).'; differ '.count($differ)."\n");
        $this->assertSame([], $differ);
    }

    public function test_the_page_is_handed_the_file_itself(): void
    {
        $file = json_decode((string) file_get_contents(base_path('../assets/lab-reading-names.json')), true);

        $this->assertIsArray($file);
        $this->assertSame($file, LabReadingNames::forClient());
    }
}
