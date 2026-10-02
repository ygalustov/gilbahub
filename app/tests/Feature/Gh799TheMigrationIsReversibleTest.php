<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

/**
 * GH-799 (queue item "Zones", stage C0) — THE MIGRATION GOES BACK, AND THIS IS WHERE THAT IS MEASURED.
 *
 * WHY IT EXISTS. The plan states that the migration is reversible and that stages C0 to C4 delete
 * nothing, and that sentence travels to the owner before the transfer is run on the stand — her
 * decision to run it rests on it. A statement about behaviour needs a measurement of behaviour, so
 * here it is: `up`, then `down`, then the schema compared with what it was, column by column, and then
 * `up` again so the rest of the suite runs on the schema it expects.
 *
 * WHAT IT WOULD CATCH. A `down()` that does nothing — the table is still there afterwards. A `down()`
 * that drops a column `samples` carried BEFORE this stage — the comparison of the other columns is
 * what sees that, which is why the whole column list is compared and not just the two added ones.
 */
class Gh799TheMigrationIsReversibleTest extends TestCase
{
    use RefreshDatabase;

    private const MIGRATION = __DIR__.'/../../database/migrations/2026_10_01_000000_create_zones_table.php';

    public function test_up_then_down_leaves_the_schema_as_it_was(): void
    {
        $migration = require self::MIGRATION;

        /**
         * GH-799 (the reviewer's condition) — THE EXACT COLUMNS, WRITTEN OUT, not the current ones with
         * this stage's own subtracted from them.
         *
         * The first draft derived the "before" list by removing what the stage adds from what the
         * schema now has. That cannot see a column the stage should NOT have added: a third column
         * appearing in `up()` would be subtracted from the expectation as well, and the comparison
         * would agree with itself. So both lists are stated here, and a column arriving or leaving on
         * either side of the reversal is red.
         */
        $samplesBeforeThisStage = [
            'account_id', 'client_uid', 'created_at', 'created_by_user_id', 'delete_source',
            'deleted_at', 'deleted_by_user_id', 'depth_mm', 'id', 'lab_date', 'lab_name', 'lab_ref',
            'methodology_snapshot', 'modified_by_user_id', 'notes', 'payload', 'sample_date',
            'sample_type', 'site_id', 'soil_texture_snapshot', 'updated_at',
        ];
        // What this stage adds, and all it adds: ONE column. The water-source column the first draft
        // also added is gone with the owner's decision of 01.10.2026 that water keeps only its name.
        $samplesWithThisStage = $samplesBeforeThisStage;
        $samplesWithThisStage[] = 'zone_id';
        sort($samplesWithThisStage);

        // The state the suite's own migrations left: this stage applied.
        $withIt = $this->schemaNow();
        $this->assertSame(
            ['zonesTable' => true, 'samples' => $samplesWithThisStage],
            $withIt,
            'the schema this stage produces is not the one it declares'
        );

        $before = ['zonesTable' => false, 'samples' => $samplesBeforeThisStage];

        $migration->down();
        $reversed = $this->schemaNow();

        $migration->up();
        $reapplied = $this->schemaNow();

        fwrite(STDOUT, '[gh799] `samples` columns before this stage ('.count($before['samples']).'): '
            .json_encode($before['samples'])
            .PHP_EOL.'[gh799] after `down()`: zones table '.json_encode($reversed['zonesTable'])
            .', `samples` ('.count($reversed['samples']).') '.json_encode($reversed['samples'])
            .PHP_EOL.'[gh799] after `up()` again: zones table '.json_encode($reapplied['zonesTable'])
            // The one column this stage adds, and the one it must NOT add: the water-source column of
            // the first draft, which the owner's decision of 01.10.2026 removed. The second of the two
            // is false on purpose, and the exact-list comparison below is what holds it false.
            .', `zone_id` back '.json_encode(in_array('zone_id', $reapplied['samples'], true))
            .', `water_source_type` absent as it must be '
            .json_encode(! in_array('water_source_type', $reapplied['samples'], true)).PHP_EOL);

        // Reversed: the table is gone, and `samples` is exactly what it was — no column of its own
        // taken with it, none left behind.
        $this->assertSame($before, $reversed);
        // And applying it again gives the state the stage is meant to produce, so the reversal is a
        // round trip rather than a one-way loss.
        $this->assertSame($withIt, $reapplied);
    }

    public function test_nothing_this_stage_added_destroys_what_a_sample_already_held(): void
    {
        $migration = require self::MIGRATION;

        // A sample with its ordinary fields, written before the reversal.
        $user = \App\Models\User::factory()->create();
        $account = \App\Models\Account::query()->firstOrCreate(
            ['owner_user_id' => $user->id],
            ['display_name' => $user->name, 'created_by_user_id' => $user->id, 'modified_by_user_id' => $user->id]
        );
        $site = \App\Models\Site::query()->create([
            'account_id' => $account->id, 'name' => 'GH-799 reversible',
            'slug' => 'gh799-rev-'.bin2hex(random_bytes(4)), 'site_type' => 'golf',
            'created_by_user_id' => $user->id, 'modified_by_user_id' => $user->id,
            'attributes_json' => ['zones' => ['Green 1']],
        ]);
        \App\Models\Sample::query()->create([
            'account_id' => $account->id, 'site_id' => $site->id, 'sample_type' => 'soil',
            'lab_name' => 'lab', 'lab_ref' => 'ref-1', 'soil_texture_snapshot' => 'sand',
            // All three old fields the plan promises `down()` does not touch: the label, and BOTH
            // spellings of the zone word the product has written over the years.
            'payload' => ['_label' => 'Green 1', '_zone' => 'green', 'zone' => 'greens', 'K' => 120],
            'created_by_user_id' => $user->id, 'modified_by_user_id' => $user->id,
        ]);
        $this->artisan('zones:transfer', ['--apply' => true])->assertExitCode(0);

        $beforeDown = DB::table('samples')->orderBy('id')->get(['id', 'lab_ref', 'payload'])
            ->map(fn ($r) => ['lab_ref' => $r->lab_ref, 'payload' => $r->payload])->all();
        $siteBefore = DB::table('sites')->where('id', $site->id)->value('attributes_json');

        $migration->down();
        $afterDown = DB::table('samples')->orderBy('id')->get(['id', 'lab_ref', 'payload'])
            ->map(fn ($r) => ['lab_ref' => $r->lab_ref, 'payload' => $r->payload])->all();
        $siteAfter = DB::table('sites')->where('id', $site->id)->value('attributes_json');
        $migration->up();

        fwrite(STDOUT, '[gh799] the sample after the reversal: '.json_encode($afterDown)
            .PHP_EOL.'[gh799] the site\'s zone list after the reversal: '.$siteAfter.PHP_EOL);

        /**
         * The old fields are what every reader still uses, and the reversal does not touch them. Named
         * one by one rather than by comparing two blobs, because the plan's promise is about THESE
         * three — `attributes_json.zones`, `payload._zone` and `payload.zone` — and a blob comparison
         * would also pass if all three had gone together with something else arriving in their place.
         */
        $this->assertSame($beforeDown, $afterDown);
        $this->assertSame($siteBefore, $siteAfter);

        $payload = json_decode($afterDown[0]['payload'], true);
        $this->assertSame('Green 1', $payload['_label'] ?? null);
        $this->assertSame('green', $payload['_zone'] ?? null);
        $this->assertSame('greens', $payload['zone'] ?? null);
        $this->assertSame(['Green 1'], json_decode((string) $siteAfter, true)['zones'] ?? null);
    }

    /** @return array{zonesTable: bool, samples: array<int,string>} */
    private function schemaNow(): array
    {
        $columns = Schema::getColumnListing('samples');
        sort($columns);

        return ['zonesTable' => Schema::hasTable('zones'), 'samples' => $columns];
    }
}
