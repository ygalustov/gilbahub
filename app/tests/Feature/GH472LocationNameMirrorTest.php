<?php

namespace Tests\Feature;

use App\Models\Account;
use App\Models\Site;
use App\Models\SiteConfig;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * GH-472 — `sites.location_name` and `config.location.name` are one fact.
 *
 * The column is a mirror the server keeps for the pages that read a site
 * without loading its config. A mirror that can hold a different answer from
 * the thing it mirrors is worse than no mirror: every page that reads it shows
 * a name the export does not print, and nothing anywhere says the two differ.
 *
 * Found on Russley, on dev: `$.location.name` was null in the config while the
 * column held the name, with coordinates intact on both sides. When that
 * happened cannot be established — configs keep no history — so what is fixed
 * here is the PATH by which such a difference can exist, not one row.
 *
 * The path, read out of the code: `resolveGaipWriteContext()` copied the name
 * into the column behind `isset()`, which answers false for a null and for an
 * absent key alike. That is right for "this write does not mention the name"
 * and wrong for "this write removes it" — and a PATCH removes a field through
 * `clear`, which never reached the column at all. So the config could be
 * emptied while the column kept its value.
 *
 * WHICH OF THE TWO IS CORRECT, and why this file asserts the first:
 *
 *   - Both empty. The owner settled (question 10.8(10)) that a site with no
 *     name for its place prints an empty Location line — so an empty name is a
 *     legal state of a site, and the two places have to agree on it.
 *   - Refusing the write. That would make the name unremovable once set, which
 *     contradicts the decision above and would be a rule about what a site
 *     must have, not about keeping two copies in step.
 *
 * So: emptying the name in the config empties the column in the same write.
 */
class GH472LocationNameMirrorTest extends TestCase
{
    use RefreshDatabase;

    public function test_clearing_the_name_in_the_config_clears_the_column(): void
    {
        $user = User::factory()->create();
        $site = $this->siteWithName($user, 'Christchurch, New Zealand');

        $this->patch("/api/sites/{$site->id}/config/gaip", [
            'clear' => ['location.name'],
        ])->assertOk();

        $config = $this->config($site);
        $site->refresh();

        // GH-474: ownership is per field now, and the column owns the name.
        // So the emptying goes to the column, and the copy in the config is
        // derived back from it — the key is present and equal to the owner,
        // which is what "derived" means. Before, the config was emptied and
        // the column was told about it; the direction is the other way round
        // and there is one writer.
        $this->assertNull($config['location']['name'] ?? null,
            'the copy is derived from the column, so it is empty because the column is');
        $this->assertNull($site->location_name,
            'the column owns the name, and it was emptied');
    }

    public function test_the_coordinates_are_untouched_by_clearing_the_name(): void
    {
        // The name and the coordinates are different facts. A site keeps
        // working without a name; without coordinates it computes nothing.
        $user = User::factory()->create();
        $site = $this->siteWithName($user, 'Christchurch, New Zealand');

        $this->patch("/api/sites/{$site->id}/config/gaip", [
            'clear' => ['location.name'],
        ])->assertOk();

        $config = $this->config($site);
        $site->refresh();

        $this->assertSame(-43.5321, (float) $config['location']['lat']);
        $this->assertSame(172.6362, (float) $config['location']['lon']);
        $this->assertSame(-43.5321, (float) $site->latitude);
        $this->assertSame(172.6362, (float) $site->longitude);
    }

    public function test_a_write_that_does_not_mention_the_name_leaves_both_places_alone(): void
    {
        // The other half of the same rule, and the reason `isset()` was there:
        // a patch about something else is not an instruction to empty the name.
        $user = User::factory()->create();
        $site = $this->siteWithName($user, 'Christchurch, New Zealand');

        $this->patch("/api/sites/{$site->id}/config/gaip", [
            'patch' => ['turf' => ['hoc' => 12]],
        ])->assertOk();

        $config = $this->config($site);
        $site->refresh();

        $this->assertSame('Christchurch, New Zealand', $config['location']['name']);
        $this->assertSame('Christchurch, New Zealand', $site->location_name);
    }

    public function test_setting_a_new_name_reaches_both_places(): void
    {
        $user = User::factory()->create();
        $site = $this->siteWithName($user, 'Christchurch, New Zealand');

        $this->patch("/api/sites/{$site->id}/config/gaip", [
            'patch' => ['location' => ['name' => 'Auckland, New Zealand']],
        ])->assertOk();

        $config = $this->config($site);
        $site->refresh();

        $this->assertSame('Auckland, New Zealand', $config['location']['name']);
        $this->assertSame('Auckland, New Zealand', $site->location_name);
    }

    public function test_a_null_name_is_still_refused_in_favour_of_clear(): void
    {
        // Unchanged, and worth pinning beside the rest: the contract's answer
        // to "empty this" is `clear`, so a null in the patch is not a second
        // way to do it. The mirror rule above is about `clear`, not about
        // admitting nulls.
        $user = User::factory()->create();
        $site = $this->siteWithName($user, 'Christchurch, New Zealand');

        $this->patch("/api/sites/{$site->id}/config/gaip", [
            'patch' => ['location' => ['name' => null]],
        ])->assertStatus(422);

        $site->refresh();
        $this->assertSame('Christchurch, New Zealand', $site->location_name);
        $this->assertSame('Christchurch, New Zealand', $this->config($site)['location']['name']);
    }

    private function siteWithName(User $user, string $name): Site
    {
        $account = Account::query()->firstOrCreate(
            ['owner_user_id' => $user->id],
            [
                'display_name' => $user->name,
                'created_by_user_id' => $user->id,
                'modified_by_user_id' => $user->id,
            ]
        );

        $site = Site::query()->create([
            'account_id' => $account->id,
            'name' => 'Russley',
            'slug' => 'russley-'.substr((string) $user->id, -4),
            'site_type' => 'golf',
            'location_name' => $name,
            'latitude' => -43.5321,
            'longitude' => 172.6362,
            'created_by_user_id' => $user->id,
            'modified_by_user_id' => $user->id,
        ]);
        $site->users()->attach($user->id, ['role' => 'manager']);
        SiteConfig::query()->create([
            'site_id' => $site->id,
            'namespace' => 'gaip',
            'config' => [
                'turf' => ['species' => 'Browntop Bent (Greens)', 'methodology' => 'mlsn', 'turfType' => 'golf'],
                'location' => ['name' => $name, 'lat' => -43.5321, 'lon' => 172.6362],
            ],
        ]);
        $this->actingAs($user);

        return $site;
    }

    private function config(Site $site): array
    {
        return SiteConfig::query()->where('site_id', $site->id)->where('namespace', 'gaip')->first()->config;
    }

    /**
     * GH-473 — the write path leads to the owner of the fact.
     *
     * `sites.location_name` is reached by all three paths a name can be
     * written through; `config.location.name` by one of them. So the column is
     * the owner and the resolver reads it — and these three assertions are
     * what say the column really is reached by all three.
     */
    public function test_creating_a_site_with_a_place_puts_it_where_the_export_reads_it(): void
    {
        $user = User::factory()->create();
        $this->actingAs($user);

        $response = $this->postJson('/api/sites', [
            'name' => 'New course',
            'location_name' => 'Dunedin, New Zealand',
            'latitude' => -45.8788,
            'longitude' => 170.5028,
        ])->assertCreated();

        $siteId = $response->json('data.id');
        $this->assertSame('Dunedin, New Zealand', $response->json('data.location_name'));

        // GH-474: and the copy is derived at creation, so the config agrees
        // with the column from the first moment. This assertion used to say
        // the opposite — the config was empty here, which is the state Russley
        // was found in and the reason reading the copy put the export one
        // write path behind on every new site.
        $config = SiteConfig::query()->where('site_id', $siteId)->where('namespace', 'gaip')->first();
        $this->assertSame('Dunedin, New Zealand', $config?->config['location']['name'] ?? null);
        $this->assertSame(-45.8788, $config?->config['location']['lat'] ?? null);
    }

    public function test_renaming_the_place_through_the_site_route_reaches_the_owner(): void
    {
        $user = User::factory()->create();
        $site = $this->siteWithName($user, 'Christchurch, New Zealand');

        $this->patchJson("/api/sites/{$site->id}", ['location_name' => 'Queenstown, New Zealand'])
            ->assertOk()
            ->assertJsonPath('data.location_name', 'Queenstown, New Zealand');

        $site->refresh();
        $this->assertSame('Queenstown, New Zealand', $site->location_name);
    }

    public function test_a_config_patch_mirrors_into_the_owner_too(): void
    {
        $user = User::factory()->create();
        $site = $this->siteWithName($user, 'Christchurch, New Zealand');

        $this->patch("/api/sites/{$site->id}/config/gaip", [
            'patch' => ['location' => ['name' => 'Wanaka, New Zealand']],
        ])->assertOk();

        $site->refresh();
        $this->assertSame('Wanaka, New Zealand', $site->location_name);
    }

    public function test_the_site_payload_carries_what_the_export_will_read(): void
    {
        // The export reads the row through GET /api/sites, so whatever any of
        // the three paths wrote has to appear here — this is the one place the
        // resolver looks.
        $user = User::factory()->create();
        $site = $this->siteWithName($user, 'Christchurch, New Zealand');

        $this->patchJson("/api/sites/{$site->id}", ['location_name' => 'Te Anau, New Zealand'])->assertOk();

        $row = collect($this->getJson('/api/sites')->assertOk()->json('data'))
            ->firstWhere('id', $site->id);
        $this->assertSame('Te Anau, New Zealand', $row['location_name']);
        $this->assertSame('Russley', $row['name']);
        $this->assertArrayHasKey('timezone', $row);
    }

    /**
     * GH-474 — moving a site through the site route carries the derived copy
     * with it.
     *
     * This is the one the regional catalogue hangs on: three integrations read
     * `config.location.lat/lon` to decide which country's recommender and
     * product list a client is given, and this route used to write the columns
     * and leave the copy alone. A site that moved between countries kept its
     * old catalogue until somebody happened to save a config.
     */
    public function test_moving_the_site_carries_the_derived_copy_with_it(): void
    {
        $user = User::factory()->create();
        $site = $this->siteWithName($user, 'Christchurch, New Zealand');

        // From New Zealand to Australia, through the route that owns the
        // coordinates.
        $this->patchJson("/api/sites/{$site->id}", [
            'latitude' => -33.8688,
            'longitude' => 151.2093,
            'location_name' => 'Sydney, NSW',
        ])->assertOk();

        $config = $this->config($site);
        $site->refresh();

        $this->assertSame(-33.8688, (float) $site->latitude);
        $this->assertSame(-33.8688, $config['location']['lat'],
            'the copy the regional integrations read follows the column that owns it');
        $this->assertSame(151.2093, $config['location']['lon']);
        $this->assertSame('Sydney, NSW', $config['location']['name']);
    }

    public function test_the_derived_copy_carries_numbers_not_strings(): void
    {
        // The coordinate columns are DECIMAL and come back from the driver as
        // strings. The readers of the copy compare them against country
        // bounding boxes, so the copy carries the type they expect.
        $user = User::factory()->create();
        $site = $this->siteWithName($user, 'Christchurch, New Zealand');

        $this->patchJson("/api/sites/{$site->id}", ['latitude' => -33.8688, 'longitude' => 151.2093])
            ->assertOk();

        $config = $this->config($site);
        $this->assertIsFloat($config['location']['lat']);
        $this->assertIsFloat($config['location']['lon']);
    }
}