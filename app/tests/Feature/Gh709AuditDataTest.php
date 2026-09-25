<?php

namespace Tests\Feature;

use App\Models\Account;
use App\Models\Sample;
use App\Models\Site;
use App\Models\SiteConfig;
use App\Models\User;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

/**
 * GH-709 — THE DATA AUDIT, ON A DATABASE THIS TEST BUILDS.
 *
 * Layer 1 of the device: the tool itself, on the in-memory test database, where planting is
 * allowed. Layer 2 is its first run on the stand, read only, which had to name the two traces
 * already lying in the data (`Test5 - NZ` stamped with `Burns`, `Test1 - Sports` stamped with
 * `Russley`) by the form of the value, not by the name of the field.
 *
 * THE POSITIVE CONTROL IS PLANTED IN A NEW PLACE: a table and a column that exist nowhere in
 * the schema until this test creates them. A plant in a column the tool already knows would
 * prove only that it re-reads what it knows.
 */
class Gh709AuditDataTest extends TestCase
{
    use RefreshDatabase;

    private string $known;

    protected function setUp(): void
    {
        parent::setUp();
        $this->known = tempnam(sys_get_temp_dir(), 'gh709-known-').'.json';
    }

    protected function tearDown(): void
    {
        @unlink($this->known);
        parent::tearDown();
    }

    private function site(string $name): Site
    {
        $user = User::factory()->create(['is_admin' => false]);
        $account = Account::query()->create([
            'owner_user_id' => $user->id, 'display_name' => $name,
            'created_by_user_id' => $user->id, 'modified_by_user_id' => $user->id,
        ]);

        return Site::query()->create([
            'account_id' => $account->id, 'name' => $name, 'slug' => 'gh709-'.$user->id,
            'site_type' => 'sports',
            'created_by_user_id' => $user->id, 'modified_by_user_id' => $user->id,
        ]);
    }

    /** Runs the command against a recorded list and returns [exit code, output]. */
    private function audit(array $entries = [], array $allowedColumns = []): array
    {
        file_put_contents($this->known, json_encode([
            'allowedColumns' => (object) $allowedColumns, 'entries' => $entries,
        ]));
        $code = Artisan::call('gilba:audit-data', ['--known' => $this->known]);

        return [$code, Artisan::output()];
    }

    /** Two sites, and the first carries a stamp naming the second — the shape found on the stand. */
    private function foreignStamp(): array
    {
        $a = $this->site('A');
        $b = $this->site('B');
        $config = SiteConfig::query()->create([
            'site_id' => $a->id, 'namespace' => 'gaip',
            'config' => ['pgr' => ['_savedForSite' => (string) $b->id]],
        ]);

        return [$a, $b, $config];
    }

    public function test_a_foreign_site_id_nobody_recorded_is_new_and_red(): void
    {
        [, $b, $config] = $this->foreignStamp();
        [$code, $out] = $this->audit();

        $this->assertStringContainsString('inspected site_configs.config', $out);
        $this->assertStringContainsString('site_configs#'.$config->id.'.config:pgr._savedForSite='.$b->id, $out);
        $this->assertMatchesRegularExpression('/NEW \(1\)/', $out);
        $this->assertStringContainsString('VERDICT: RED', $out);
        $this->assertNotSame(0, $code);
    }

    public function test_a_recorded_trace_still_in_place_is_known_and_green(): void
    {
        [, $b, $config] = $this->foreignStamp();
        [$code, $out] = $this->audit([[
            'table' => 'site_configs', 'id' => (string) $config->id, 'column' => 'config',
            'path' => 'pgr._savedForSite', 'value' => (string) $b->id, 'decision' => 'GH-709 - fixture',
        ]]);

        $this->assertMatchesRegularExpression('/KNOWN \(1\)/', $out);
        $this->assertStringContainsString('VERDICT: GREEN', $out);
        $this->assertSame(0, $code);
    }

    public function test_positive_control_a_new_table_and_column_are_found_by_the_form_of_the_value(): void
    {
        $a = $this->site('A');
        $b = $this->site('B');
        Schema::create('gh709_probe', function (Blueprint $t) {
            $t->id();
            $t->string('site_id');
            $t->json('anything_at_all');
        });
        DB::table('gh709_probe')->insert([
            'site_id' => (string) $a->id,
            'anything_at_all' => json_encode(['deep' => ['ref' => (string) $b->id]]),
        ]);

        [$code, $out] = $this->audit();

        $this->assertStringContainsString('gh709_probe#1.anything_at_all:deep.ref='.$b->id, $out);
        $this->assertNotSame(0, $code);
    }

    public function test_a_site_referring_to_itself_is_not_a_finding(): void
    {
        $a = $this->site('A');
        SiteConfig::query()->create([
            'site_id' => $a->id, 'namespace' => 'gaip',
            'config' => ['pgr' => ['_savedForSite' => (string) $a->id]],
        ]);
        [$code, $out] = $this->audit();

        $this->assertMatchesRegularExpression('/NEW \(0\)/', $out);
        $this->assertSame(0, $code);
    }

    public function test_blind_a_recorded_trace_read_directly_but_not_named_by_the_sign(): void
    {
        // A row with no owning site is read for the universe and not judged, so the sign cannot
        // name a foreign id in it. The recorded list points at it; reading that address directly,
        // past the sign, finds the value — the tool is blind there, and says so.
        $b = $this->site('B');
        Schema::create('gh709_ownerless', function (Blueprint $t) {
            $t->id();
            $t->json('blob');
        });
        DB::table('gh709_ownerless')->insert(['blob' => json_encode(['who' => (string) $b->id])]);

        [$code, $out] = $this->audit([[
            'table' => 'gh709_ownerless', 'id' => '1', 'column' => 'blob',
            'path' => 'who', 'value' => (string) $b->id, 'decision' => 'GH-709 - fixture',
        ]]);

        $this->assertMatchesRegularExpression('/BLIND \(1\)/', $out);
        $this->assertStringContainsString('gh709_ownerless#1.blob:who='.$b->id, $out);
        $this->assertNotSame(0, $code);
    }

    public function test_removed_a_recorded_trace_that_is_gone_is_red_until_the_list_is_edited(): void
    {
        $a = $this->site('A');
        $b = $this->site('B');
        $config = SiteConfig::query()->create([
            'site_id' => $a->id, 'namespace' => 'gaip', 'config' => ['pgr' => []],
        ]);
        [$code, $out] = $this->audit([[
            'table' => 'site_configs', 'id' => (string) $config->id, 'column' => 'config',
            'path' => 'pgr._savedForSite', 'value' => (string) $b->id, 'decision' => 'GH-709 - fixture',
        ]]);

        $this->assertMatchesRegularExpression('/REMOVED \(1\)/', $out);
        $this->assertNotSame(0, $code);
    }

    public function test_a_legitimate_column_is_allowed_by_name_with_a_reason(): void
    {
        [, $b, $config] = $this->foreignStamp();
        [$code, $out] = $this->audit([], ['site_configs.config' => 'fixture reason']);

        $this->assertMatchesRegularExpression('/ALLOWED \(1\)/', $out);
        $this->assertSame(0, $code);
    }

    public function test_a_recorded_entry_without_a_gh_decision_is_refused(): void
    {
        [, $b, $config] = $this->foreignStamp();
        [$code, $out] = $this->audit([[
            'table' => 'site_configs', 'id' => (string) $config->id, 'column' => 'config',
            'path' => 'pgr._savedForSite', 'value' => (string) $b->id, 'decision' => 'left as it is',
        ]]);

        $this->assertStringContainsString('needs a decision starting with GH-NNN', $out);
        $this->assertNotSame(0, $code);
    }

    public function test_it_writes_nothing(): void
    {
        $this->foreignStamp();
        $writes = [];
        DB::listen(function ($q) use (&$writes) {
            if (preg_match('/^\s*(insert|update|delete|replace|alter|create|drop)\b/i', $q->sql)) {
                $writes[] = $q->sql;
            }
        });
        $this->audit();

        $this->assertSame([], $writes);
    }

    // ── Part 2: two relations declared by code. The stand has no violation of either today
    // (14 configs, 31 analysis rows with samples), so their red is shown here, on this database.

    private function located(Site $site, float $lat): void
    {
        DB::table('sites')->where('id', $site->id)->update(['latitude' => $lat]);
    }

    public function test_a_copied_field_that_differs_from_its_owning_column_is_new_and_red(): void
    {
        $a = $this->site('A');
        $this->located($a, -35.1);
        $config = SiteConfig::query()->create([
            'site_id' => $a->id, 'namespace' => 'gaip', 'config' => ['location' => ['lat' => -35.9]],
        ]);
        [$code, $out] = $this->audit();

        $this->assertStringContainsString('copy-differs-from-owner site_configs#'.$config->id.'.config:location.lat=-35.9', $out);
        $this->assertStringContainsString('sites.latitude = -35.1', $out);
        $this->assertNotSame(0, $code);
    }

    public function test_a_copy_equal_to_its_owner_is_not_a_finding_whatever_type_the_driver_returns(): void
    {
        $a = $this->site('A');
        $this->located($a, -35.1);
        SiteConfig::query()->create([
            'site_id' => $a->id, 'namespace' => 'gaip', 'config' => ['location' => ['lat' => -35.1]],
        ]);
        [$code, $out] = $this->audit();

        $this->assertStringNotContainsString('copy-differs-from-owner', preg_replace('/^.*copy-differs-from-owner: configs checked.*$/m', '', $out));
        $this->assertSame(0, $code);
    }

    public function test_a_recorded_copy_violation_that_was_repaired_is_removed_and_red(): void
    {
        $a = $this->site('A');
        $this->located($a, -35.1);
        $config = SiteConfig::query()->create([
            'site_id' => $a->id, 'namespace' => 'gaip', 'config' => ['location' => ['lat' => -35.1]],
        ]);
        [$code, $out] = $this->audit([[
            'relation' => 'copy-differs-from-owner', 'table' => 'site_configs', 'id' => (string) $config->id,
            'column' => 'config', 'path' => 'location.lat', 'value' => '-35.9', 'decision' => 'GH-709 - fixture',
        ]]);

        $this->assertMatchesRegularExpression('/REMOVED \\(1\\)/', $out);
        $this->assertNotSame(0, $code);
    }

    private function sampleOf(Site $site): Sample
    {
        $user = User::factory()->create(['is_admin' => false]);

        return Sample::query()->create([
            'account_id' => $site->account_id, 'site_id' => $site->id, 'sample_type' => 'soil',
            'lab_name' => 'lab', 'lab_ref' => '', 'soil_texture_snapshot' => '',
            'payload' => ['pH' => 6.5],
            'created_by_user_id' => $user->id, 'modified_by_user_id' => $user->id,
        ]);
    }

    private function analysisRow(Site $site, array $samples): int
    {
        return (int) DB::table('analysis_results')->insertGetId([
            'site_id' => $site->id, 'run_id' => 'gh709-run', 'outcome' => 'complete',
            'inputs' => json_encode(['samples' => $samples]),
            'created_at' => now(), 'updated_at' => now(),
        ]);
    }

    public function test_an_analysis_row_recording_another_sites_sample_is_new_and_red(): void
    {
        $a = $this->site('A');
        $b = $this->site('B');
        $foreign = $this->sampleOf($b);
        $row = $this->analysisRow($a, ['soil' => 'sample_'.$foreign->id]);
        [$code, $out] = $this->audit();

        $this->assertStringContainsString('sample-of-another-site analysis_results#'.$row.'.inputs:samples.soil=sample_'.$foreign->id, $out);
        $this->assertStringContainsString('belongs to ["'.$b->id.'"]', $out);
        $this->assertNotSame(0, $code);
    }

    public function test_an_analysis_row_recording_its_own_sample_is_not_a_finding(): void
    {
        $a = $this->site('A');
        $own = $this->sampleOf($a);
        $this->analysisRow($a, ['soil' => 'sample_'.$own->id, 'water' => null]);
        [$code, $out] = $this->audit();

        $this->assertStringContainsString('analysis rows with inputs.samples 1', $out);
        $this->assertMatchesRegularExpression('/NEW \\(0\\)/', $out);
        $this->assertSame(0, $code);
    }
}
