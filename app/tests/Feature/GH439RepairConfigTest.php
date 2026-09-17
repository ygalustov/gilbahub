<?php

namespace Tests\Feature;

use App\Models\Account;
use App\Models\Site;
use App\Models\SiteConfig;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Artisan;
use Tests\TestCase;

/**
 * GH-446 (GH-439 stage 4a) — `php artisan sites:repair-config`.
 *
 * The command writes two fields and only where the damage has a signature:
 * a wizard record removed by a page, and a time zone that no person chose.
 * Everything else is reported and left alone. These cases are the rules of
 * section 6 of the plan, one test each, plus the two properties the stage is
 * judged on: a dry run changes nothing, and a second run has nothing to do.
 */
class GH439RepairConfigTest extends TestCase
{
    use RefreshDatabase;

    public function test_it_restores_a_wizard_record_a_page_removed(): void
    {
        $site = $this->site(['name' => 'Burns', 'latitude' => -35.2285452, 'longitude' => 149.0022925], [
            'turf' => ['species' => 'Creeping Bentgrass (Greens)', 'methodology' => 'mlsn'],
        ]);

        $this->artisan('sites:repair-config')->assertSuccessful();

        $wizard = $this->config($site)['wizard'];
        $this->assertTrue($wizard['complete']);
        $this->assertSame('GH-439e', $wizard['repaired']);
        $this->assertNotEmpty($wizard['repairedAt']);
        // GH-448: the completion date is not invented. It is not recoverable
        // -- the record was deleted and nothing logged it -- and stamping the
        // repair's own date would read later as a fact about the site.
        $this->assertNull($wizard['completedAt']);

        // And the site row carries the same trace the time-zone repair leaves,
        // so a database can be asked what the repair touched.
        $trace = $site->refresh()->attributes_json['gh439_repair']['wizard'];
        $this->assertSame(['from' => 'missing', 'to' => 'complete'], [
            'from' => $trace['from'], 'to' => $trace['to'],
        ]);
        $this->assertNotEmpty($trace['at']);
    }

    public function test_it_leaves_an_existing_wizard_record_alone_including_a_skipped_one(): void
    {
        $site = $this->site(['name' => 'Skipped', 'latitude' => -35.2, 'longitude' => 149.0], [
            'turf' => ['species' => 'Couch'],
            'wizard' => ['skipped' => true],
        ]);

        $this->artisan('sites:repair-config')->assertSuccessful();

        $this->assertSame(['skipped' => true], $this->config($site)['wizard']);
    }

    public function test_it_writes_no_wizard_record_without_a_species_or_without_coordinates(): void
    {
        $noSpecies = $this->site(['name' => 'No species', 'latitude' => -35.2, 'longitude' => 149.0], [
            'turf' => ['hoc' => 12],
        ]);
        $noCoordinates = $this->site(['name' => 'No coordinates', 'latitude' => null, 'longitude' => null], [
            'turf' => ['species' => 'Couch'],
        ]);

        $this->artisan('sites:repair-config')
            ->expectsOutputToContain('Without a wizard record after this run: 2')
            ->assertSuccessful();

        $this->assertArrayNotHasKey('wizard', $this->config($noSpecies));
        $this->assertArrayNotHasKey('wizard', $this->config($noCoordinates));
    }

    public function test_it_fills_a_null_time_zone_from_the_coordinates(): void
    {
        $site = $this->site([
            'name' => 'New test - location', 'timezone' => null,
            'latitude' => -34.4370, 'longitude' => 150.8994,
        ], ['turf' => ['species' => 'Creeping Bentgrass (Greens)']]);

        $this->artisan('sites:repair-config')->assertSuccessful();

        $this->assertSame('Australia/Sydney', $site->refresh()->timezone);
        $this->assertSame('Australia/Sydney', $site->attributes_json['gh439_repair']['timezone']['to']);
        $this->assertNull($site->attributes_json['gh439_repair']['timezone']['from']);
    }

    public function test_it_replaces_the_default_zone_where_the_clock_is_actually_different(): void
    {
        $auckland = $this->site([
            'name' => 'Russley', 'timezone' => 'Australia/Sydney',
            'latitude' => -43.4953880, 'longitude' => 172.5560607,
        ], ['turf' => ['species' => 'Browntop Bent (Greens)']]);

        $california = $this->site([
            'name' => 'test4 - USA', 'timezone' => 'Australia/Sydney',
            'latitude' => 37.6191145, 'longitude' => -122.3816274,
        ], ['turf' => ['species' => 'Creeping Bentgrass (Greens)']]);

        $this->artisan('sites:repair-config')->assertSuccessful();

        $this->assertSame('Pacific/Auckland', $auckland->refresh()->timezone);
        $this->assertSame('America/Los_Angeles', $california->refresh()->timezone);
        $this->assertSame('Australia/Sydney', $auckland->attributes_json['gh439_repair']['timezone']['from']);
    }

    public function test_it_keeps_the_default_zone_where_it_keeps_the_same_time(): void
    {
        // Melbourne and Canberra run Sydney's clock. The label may be
        // imprecise; the time is right, and rewriting it would be a change
        // with nothing behind it.
        $melbourne = $this->site([
            'name' => 'Melbourne site', 'timezone' => 'Australia/Sydney',
            'latitude' => -37.8136, 'longitude' => 144.9631,
        ], ['turf' => ['species' => 'Couch']]);

        $this->artisan('sites:repair-config')->assertSuccessful();

        $this->assertSame('Australia/Sydney', $melbourne->refresh()->timezone);
        // The wizard repair leaves its own trace on this row; what must not be
        // there is a time-zone one.
        $this->assertArrayNotHasKey('timezone', $melbourne->attributes_json['gh439_repair'] ?? []);
    }

    public function test_it_never_touches_a_zone_a_person_chose(): void
    {
        // A consultant in London running a New Zealand site on London time is
        // a legitimate choice, and no automatic writer could have produced it.
        $site = $this->site([
            'name' => 'Auckland on London time', 'timezone' => 'Europe/London',
            'latitude' => -36.8508827, 'longitude' => 174.7644881,
        ], ['turf' => ['species' => 'Perennial Ryegrass']]);

        $this->artisan('sites:repair-config')
            ->expectsOutputToContain('chosen by hand')
            ->assertSuccessful();

        $this->assertSame('Europe/London', $site->refresh()->timezone);
    }

    public function test_a_matching_zone_is_not_rewritten(): void
    {
        // The stage's own failure condition: Test5 - NZ must come out of this
        // untouched.
        $site = $this->site([
            'name' => 'Test5 - NZ', 'timezone' => 'Pacific/Auckland',
            'latitude' => -36.8508827, 'longitude' => 174.7644881,
        ], ['turf' => ['species' => 'Perennial Ryegrass'], 'wizard' => ['complete' => true]]);

        $before = $site->updated_at;
        $this->artisan('sites:repair-config')->assertSuccessful();

        $site->refresh();
        $this->assertSame('Pacific/Auckland', $site->timezone);
        $this->assertEquals($before, $site->updated_at);
    }

    public function test_a_dry_run_changes_nothing(): void
    {
        $site = $this->site([
            'name' => 'Russley', 'timezone' => 'Australia/Sydney',
            'latitude' => -43.4953880, 'longitude' => 172.5560607,
        ], ['turf' => ['species' => 'Browntop Bent (Greens)']]);

        $this->artisan('sites:repair-config --dry-run')
            ->expectsOutputToContain('DRY RUN')
            ->expectsOutputToContain('WOULD CHANGE')
            ->assertSuccessful();

        $this->assertSame('Australia/Sydney', $site->refresh()->timezone);
        $this->assertArrayNotHasKey('wizard', $this->config($site));
    }

    public function test_a_dry_run_reports_exactly_what_the_write_then_does(): void
    {
        // GH-448: the second half of the old test's name was never checked --
        // the dry run's report was compared with nothing. That property is the
        // one the decision to run this on production rests on: what the
        // preview lists is what the write does. Here the two reports are run
        // against the same data and their transition lines compared.
        $this->site([
            'name' => 'Russley', 'timezone' => 'Australia/Sydney',
            'latitude' => -43.4953880, 'longitude' => 172.5560607,
        ], ['turf' => ['species' => 'Browntop Bent (Greens)']]);
        $this->site([
            'name' => 'New test - location', 'timezone' => null,
            'latitude' => -34.4370, 'longitude' => 150.8994,
        ], ['turf' => ['species' => 'Creeping Bentgrass (Greens)']]);
        $this->site([
            'name' => 'Melbourne', 'timezone' => 'Australia/Sydney',
            'latitude' => -37.8136, 'longitude' => 144.9631,
        ], ['turf' => ['species' => 'Couch'], 'wizard' => ['complete' => true]]);
        $this->site([
            'name' => 'No species', 'timezone' => 'Pacific/Auckland',
            'latitude' => -36.8508827, 'longitude' => 174.7644881,
        ], ['turf' => ['hoc' => 10]]);

        // Artisan::call (not $this->artisan) because the report has to be read
        // back as text, and only call() leaves it in the output buffer.
        Artisan::call('sites:repair-config', ['--dry-run' => true]);
        $preview = $this->transitionsFrom(Artisan::output());

        Artisan::call('sites:repair-config');
        $performed = $this->transitionsFrom(Artisan::output());

        $this->assertNotEmpty($preview, 'the preview listed nothing, so it cannot be compared');
        $this->assertSame($preview, $performed);
    }

    /**
     * The `site_id | field | was | became` lines of a report, as a sorted list.
     * Anything outside the changed-rows table is ignored: the point of
     * comparison is what the run says it will do against what it did.
     *
     * @return array<int, string>
     */
    private function transitionsFrom(string $output): array
    {
        $lines = [];
        foreach (explode("\n", $output) as $line) {
            if (! str_starts_with(trim($line), '|')) continue;
            $cells = array_map('trim', array_filter(explode('|', $line), fn ($c) => trim($c) !== ''));
            $cells = array_values($cells);
            // Header rows and the "left as is" table have different shapes.
            if (count($cells) !== 6 || $cells[0] === 'site_id') continue;
            if (! in_array($cells[2], ['config.wizard', 'sites.timezone'], true)) continue;
            $lines[] = implode(' | ', [$cells[0], $cells[2], $cells[3], $cells[4]]);
        }
        sort($lines);

        return $lines;
    }

    public function test_a_second_run_changes_nothing_and_says_so(): void
    {
        $this->site([
            'name' => 'Russley', 'timezone' => 'Australia/Sydney',
            'latitude' => -43.4953880, 'longitude' => 172.5560607,
        ], ['turf' => ['species' => 'Browntop Bent (Greens)']]);

        $this->artisan('sites:repair-config')->assertSuccessful();

        $this->artisan('sites:repair-config')
            ->expectsOutputToContain('Nothing to repair')
            ->assertSuccessful();
    }

    public function test_the_three_report_only_lists_are_printed_and_nothing_is_deleted(): void
    {
        $nameIsId = $this->site(['name' => '__PLACEHOLDER__', 'latitude' => null, 'longitude' => null], []);
        $nameIsId->forceFill(['name' => $nameIsId->id])->save();

        // GH-448: the headings printed on their own proved nothing -- they
        // print whether the lists have rows or not. The counts are what say
        // the site was actually classified, and this site belongs in all three.
        $this->artisan('sites:repair-config')
            ->expectsOutputToContain('REPORT ONLY — name equals the site id (nothing to restore it from; fix in Settings or Account): 1')
            ->expectsOutputToContain('REPORT ONLY — no coordinates (no zone can be derived; the setup wizard will ask for a location): 1')
            ->expectsOutputToContain('REPORT ONLY — empty config and no samples (deleting is irreversible: DELETE /api/sites/{id}): 1')
            ->expectsOutputToContain($nameIsId->id)
            ->assertSuccessful();

        $this->assertDatabaseHas('sites', ['id' => $nameIsId->id]);
        // And nothing was written to a row that only belongs in a report.
        $this->assertArrayNotHasKey('wizard', $this->config($nameIsId));
    }

    /**
     * GH-474 — the derived copy is repaired from the column that owns it.
     *
     * This replaces the GH-472 report-only line. That one listed sites where
     * `sites.location_name` was filled and `config.location.name` empty, and
     * refused to touch them because the column was taken for a copy that had
     * stopped being updated. Ownership is declared per field now: the column
     * OWNS the name and the config's entry is derived from it, so the case has
     * an answer and printing it as an open difference would be printing a
     * question that is already settled.
     */
    public function test_a_drifted_copy_is_rewritten_from_the_column_that_owns_it(): void
    {
        $diverged = $this->site(
            ['name' => 'Russley', 'location_name' => 'Christchurch, New Zealand',
                'latitude' => -43.5321, 'longitude' => 172.6362],
            ['turf' => ['species' => 'Browntop Bent (Greens)'],
                'location' => ['lat' => -43.5321, 'lon' => 172.6362]]
        );

        $this->artisan('sites:repair-config')
            ->expectsOutputToContain('config.location (derived copy)')
            ->expectsOutputToContain($diverged->id)
            ->assertSuccessful();

        $diverged->refresh();
        $this->assertSame('Christchurch, New Zealand', $diverged->location_name,
            'the owner is not touched by a repair of its copy');
        $this->assertSame('Christchurch, New Zealand', $this->config($diverged)['location']['name']);
    }

    public function test_a_copy_that_already_agrees_is_not_rewritten(): void
    {
        $agreeing = $this->site(
            ['name' => 'Test5', 'location_name' => 'Auckland, New Zealand',
                'latitude' => -36.8508827, 'longitude' => 174.7644881],
            ['turf' => ['species' => 'Perennial Ryegrass'],
                'location' => ['name' => 'Auckland, New Zealand', 'lat' => -36.8508827, 'lon' => 174.7644881]]
        );

        $this->artisan('sites:repair-config', ['--dry-run' => true])
            ->doesntExpectOutputToContain($agreeing->id.' | Test5                                   | config.location (derived copy)')
            ->assertSuccessful();
    }

    private function site(array $siteAttributes, array $config): Site
    {
        $user = User::factory()->create();
        $account = Account::query()->firstOrCreate(
            ['owner_user_id' => $user->id],
            [
                'display_name' => $user->name,
                'created_by_user_id' => $user->id,
                'modified_by_user_id' => $user->id,
            ]
        );

        $site = Site::query()->create(array_merge([
            'account_id' => $account->id,
            'name' => 'Site',
            'slug' => 'site-'.uniqid(),
            'site_type' => 'golf',
            'created_by_user_id' => $user->id,
            'modified_by_user_id' => $user->id,
        ], $siteAttributes));

        SiteConfig::query()->create([
            'site_id' => $site->id,
            'namespace' => 'gaip',
            'config' => $config,
            'synced_at' => now(),
        ]);

        return $site;
    }

    private function config(Site $site): array
    {
        return SiteConfig::query()
            ->where('site_id', $site->id)->where('namespace', 'gaip')->first()->config;
    }
}
