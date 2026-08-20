<?php

namespace Tests\Unit;

use App\Services\HillLabsSampleTypesService;
use Tests\TestCase;

/**
 * Test GH-258 — PHP half of the Hill Labs sample-type SSOT (D07 item 1).
 *
 * Mirrors tests/gh258-hill-labs-sample-types.test.js's JS-side assertions
 * against the same certificate values. Kept as parallel, independently
 * written test cases (not a shared fixture) deliberately: the whole point
 * of GH-258 is that this class and the JS module must agree despite being
 * two separate files with no build step joining them — pinning the same
 * expected numbers from both sides is what would catch future drift.
 *
 * Extends the Laravel-bootstrapping TestCase (not bare PHPUnit\TestCase)
 * because HillLabsSampleTypesService::sampleTypes() reads the JSON file via
 * resource_path(), a Laravel helper that needs the framework booted.
 */
class HillLabsSampleTypesServiceTest extends TestCase
{
    // -------------------------------------------------------------------------
    // deriveCode() — parity with hill-labs-sample-types.js's deriveCode()
    // -------------------------------------------------------------------------

    public function test_perennial_ryegrass_sand_ish_texture_resolves_s277(): void
    {
        $this->assertSame('S277', HillLabsSampleTypesService::deriveCode('perennialRyegrass', 'sand'));
        $this->assertSame('S277', HillLabsSampleTypesService::deriveCode('perennialRyegrass', 'sandy_loam'));
        $this->assertSame('S277', HillLabsSampleTypesService::deriveCode('perennialRyegrass', 'loamy_sand'));
    }

    public function test_perennial_ryegrass_non_sand_texture_resolves_null(): void
    {
        $this->assertNull(HillLabsSampleTypesService::deriveCode('perennialRyegrass', 'loam'));
        $this->assertNull(HillLabsSampleTypesService::deriveCode('perennialRyegrass', 'clay_loam'));
        $this->assertNull(HillLabsSampleTypesService::deriveCode('perennialRyegrass', 'clay'));
    }

    public function test_browntop_bent_sand_ish_texture_resolves_s279(): void
    {
        $this->assertSame('S279', HillLabsSampleTypesService::deriveCode('browntopBent', 'sand'));
        $this->assertSame('S279', HillLabsSampleTypesService::deriveCode('browntopBent', 'sandy_loam'));
    }

    public function test_browntop_bent_non_sand_texture_resolves_null(): void
    {
        $this->assertNull(HillLabsSampleTypesService::deriveCode('browntopBent', 'loam'));
    }

    public function test_fescue_resolves_s81_regardless_of_texture(): void
    {
        $this->assertSame('S81', HillLabsSampleTypesService::deriveCode('fineFescue', 'sand'));
        $this->assertSame('S81', HillLabsSampleTypesService::deriveCode('fineFescue', 'loam'));
        $this->assertSame('S81', HillLabsSampleTypesService::deriveCode('tallFescue', 'clay'));
    }

    public function test_cotula_resolves_s78_always_texture_does_not_gate_it(): void
    {
        $this->assertSame('S78', HillLabsSampleTypesService::deriveCode('cotula', 'sand'));
        $this->assertSame('S78', HillLabsSampleTypesService::deriveCode('cotula', 'loam'));
        $this->assertSame('S78', HillLabsSampleTypesService::deriveCode('cotula', null));
    }

    public function test_uncovered_species_resolve_null(): void
    {
        foreach (['kikuyu', 'couch', 'zoysia', 'buffalo', 'seashore_paspalum', 'bentgrass', 'kentuckyBluegrass', 'poaAnnua'] as $species) {
            $this->assertNull(HillLabsSampleTypesService::deriveCode($species, 'sand'), "expected null for {$species}");
        }
    }

    public function test_no_species_resolves_null_without_throwing(): void
    {
        $this->assertNull(HillLabsSampleTypesService::deriveCode(null, 'sand'));
        $this->assertNull(HillLabsSampleTypesService::deriveCode('', 'sand'));
    }

    // -------------------------------------------------------------------------
    // resolveSoilTexture() — parity with the JS resolver (GH-259)
    // -------------------------------------------------------------------------

    public function test_resolve_soil_texture_site_override_wins(): void
    {
        $this->assertSame('sand', HillLabsSampleTypesService::resolveSoilTexture('sand', 'loam'));
    }

    public function test_resolve_soil_texture_falls_back_to_account(): void
    {
        $this->assertSame('loam', HillLabsSampleTypesService::resolveSoilTexture(null, 'loam'));
        $this->assertSame('loam', HillLabsSampleTypesService::resolveSoilTexture('', 'loam'));
    }

    public function test_resolve_soil_texture_null_when_neither_set(): void
    {
        $this->assertNull(HillLabsSampleTypesService::resolveSoilTexture(null, null));
    }

    // -------------------------------------------------------------------------
    // getRangesPpm() — parity with the JS conversion math, same certificate
    // values pinned in tests/gh258-hill-labs-sample-types.test.js
    // -------------------------------------------------------------------------

    public function test_meq100g_to_ppm_matches_the_hagley_oval_worked_example(): void
    {
        // word-export.js b35fix441: K=0.15 me/100g -> 58.7ppm (rounded)
        $r = HillLabsSampleTypesService::getRangesPpm('S277', 'K');
        $this->assertEqualsWithDelta(78.2, $r['min'], 0.01);
        $this->assertEqualsWithDelta(195.5, $r['max'], 0.01);
    }

    public function test_s279_k_range_matches_s277(): void
    {
        $s277 = HillLabsSampleTypesService::getRangesPpm('S277', 'K');
        $s279 = HillLabsSampleTypesService::getRangesPpm('S279', 'K');
        $this->assertEquals($s277, $s279);
    }

    public function test_olsen_p_passes_through_unconverted(): void
    {
        $this->assertEquals(['min' => 20.0, 'max' => 30.0], HillLabsSampleTypesService::getRangesPpm('S277', 'P'));
    }

    public function test_pct_bs_axis_requires_cec_and_converts_through_it(): void
    {
        $this->assertNull(HillLabsSampleTypesService::getRangesPpm('S81', 'K'));
        $this->assertNull(HillLabsSampleTypesService::getRangesPpm('S81', 'K', null));

        $r = HillLabsSampleTypesService::getRangesPpm('S81', 'K', 18.0);
        // 2.0%BS of CEC18 = 0.36 me/100g * 391 = 140.76; 6.0%BS = 1.08 * 391 = 422.28
        $this->assertEqualsWithDelta(140.76, $r['min'], 0.01);
        $this->assertEqualsWithDelta(422.28, $r['max'], 0.01);
    }

    public function test_s78_cotula_always_returns_null_never_invents_a_range(): void
    {
        $this->assertNull(HillLabsSampleTypesService::getRangesPpm('S78', 'K'));
        $this->assertNull(HillLabsSampleTypesService::getRangesPpm('S78', 'P'));
    }

    public function test_physical_axes_are_not_nutrient_ranges(): void
    {
        $this->assertNull(HillLabsSampleTypesService::getRangesPpm('S277', 'CEC'));
        $this->assertNull(HillLabsSampleTypesService::getRangesPpm('S277', 'KMgRatio'));
        $this->assertNull(HillLabsSampleTypesService::getRangesPpm('S277', 'pH'));
    }

    public function test_unknown_code_or_nutrient_returns_null_without_throwing(): void
    {
        $this->assertNull(HillLabsSampleTypesService::getRangesPpm('S999', 'K'));
        $this->assertNull(HillLabsSampleTypesService::getRangesPpm('S277', 'Zz'));
    }

    // -------------------------------------------------------------------------
    // Cross-runtime parity — same JSON-backed data the JS SSOT is expected to
    // agree with byte-for-byte (JS test pins the identical S279 == S277
    // K/Ca/Mg/Na assertion against the JS literal directly).
    // -------------------------------------------------------------------------

    public function test_json_file_has_all_four_codes(): void
    {
        $path = resource_path('data/hill-labs-sample-types.json');
        $this->assertFileExists($path);
        $decoded = json_decode(file_get_contents($path), true);
        $this->assertEqualsCanonicalizing(['S277', 'S279', 'S81', 'S78'], array_keys($decoded['sampleTypes']));
    }
}
