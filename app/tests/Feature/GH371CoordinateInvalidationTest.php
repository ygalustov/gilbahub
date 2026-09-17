<?php

namespace Tests\Feature;

use App\Models\Account;
use App\Models\Site;
use App\Models\SiteConfig;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * GH-371 (Hoxton audit D01) — server-side half of the coordinate-
 * invalidation fix (Option 3, belt-and-braces alongside the client-side
 * check in nutrition-calendar.js / site-config-persistence.js). A real
 * coordinate change via SiteController::update() must clear any cached
 * nutrition programme on that site's `gaip` SiteConfig row, so a client
 * that reads the persisted config directly from the server never receives
 * a stale blob computed against the old location. A no-op resave (Settings
 * always resends latitude/longitude on every save — see settings-init.js)
 * must NOT clear it.
 *
 * GH-371 follow-up (independent review): SiteController::updateConfig()
 * (PUT /sites/{id}/config/gaip) is a SECOND, independent way these
 * coordinates -- and this same cached programme -- can change, and it was
 * untouched by the fix above. Settings' Save button fires
 * Promise.all([PATCH /sites/{id}, PUT .../config/gaip]) concurrently on
 * every save; the PUT body is a clone of the page's pre-save config, so on
 * a coordinate-changing save it still carries the OLD cache fields. If the
 * PATCH's clear (tested above) lands first and this stale PUT lands after,
 * the wholesale-replacing updateConfig() wrote the just-cleared fields
 * straight back in -- GH-371's own bug, reopened through its sibling
 * endpoint. The tests below cover: the actual PATCH-then-PUT (and
 * PUT-then-PATCH) race shape end-to-end, updateConfig() detecting a real
 * coordinate change on its own (it also syncs config.location.lat/lon onto
 * the site row independently of update()), the no-op-resubmit/omitted-
 * payload cases that must NOT clear a still-valid cache, and confirmation
 * that a genuinely fresh, correctly-stamped programme (Plan's own
 * direct-PUT fallback right after Generate) is still accepted, not
 * blocked.
 */
class GH371CoordinateInvalidationTest extends TestCase
{
    use RefreshDatabase;

    public function test_real_coordinate_change_clears_cached_nutrition_programme(): void
    {
        $user = User::factory()->create();
        $site = $this->createSiteForUser($user, [
            'name' => 'Hoxton Soccer',
            'slug' => 'hoxton-soccer',
            'latitude' => -33.8688,
            'longitude' => 151.2093,
        ]);

        SiteConfig::query()->create([
            'site_id' => $site->id,
            'namespace' => 'gaip',
            'config' => [
                'location' => ['lat' => -33.8688, 'lon' => 151.2093, 'name' => 'Sydney, NSW'],
                'nutritionProgram' => ['monthly' => [['N' => 16.7]]],
                'nutritionCalendarProgram' => ['meta' => ['lat' => -33.8688, 'lon' => 151.2093], 'annual_totals' => ['N' => 200]],
                'nutritionProgramCoords' => ['lat' => -33.8688, 'lon' => 151.2093],
                'appliedMonthlyN' => 16.7,
            ],
            'synced_at' => now(),
        ]);

        $this->actingAs($user)
            ->withSession(['_token' => 'test-token'])
            ->patchJson('/api/sites/'.$site->id, [
                '_token' => 'test-token',
                'name' => 'Hoxton Soccer',
                'latitude' => -36.8508827,
                'longitude' => 174.7644881,
            ])
            ->assertOk();

        $config = SiteConfig::query()->where('site_id', $site->id)->where('namespace', 'gaip')->first();
        $this->assertArrayNotHasKey('nutritionProgram', $config->config);
        $this->assertArrayNotHasKey('nutritionCalendarProgram', $config->config);
        $this->assertArrayNotHasKey('nutritionProgramCoords', $config->config);
        // Unrelated fields survive the clear -- this isn't a wholesale reset.
        $this->assertSame(16.7, $config->config['appliedMonthlyN']);
        $this->assertSame('Sydney, NSW', $config->config['location']['name']);
    }

    public function test_a_no_op_resave_of_the_same_coordinates_does_not_clear_the_cached_programme(): void
    {
        $user = User::factory()->create();
        $site = $this->createSiteForUser($user, [
            'name' => 'Hoxton Soccer',
            'slug' => 'hoxton-soccer',
            'latitude' => -36.8508827,
            'longitude' => 174.7644881,
        ]);

        SiteConfig::query()->create([
            'site_id' => $site->id,
            'namespace' => 'gaip',
            'config' => [
                'nutritionCalendarProgram' => ['meta' => ['lat' => -36.8508827, 'lon' => 174.7644881], 'annual_totals' => ['N' => 200]],
                'nutritionProgramCoords' => ['lat' => -36.8508827, 'lon' => 174.7644881],
            ],
            'synced_at' => now(),
        ]);

        // Settings always resends the form's current lat/lon on every save
        // (settings-init.js), unchanged here -- a real user editing an
        // unrelated field (e.g. timezone) must not wipe the cache.
        $this->actingAs($user)
            ->withSession(['_token' => 'test-token'])
            ->patchJson('/api/sites/'.$site->id, [
                '_token' => 'test-token',
                'name' => 'Hoxton Soccer',
                'timezone' => 'Pacific/Auckland',
                'latitude' => -36.8508827,
                'longitude' => 174.7644881,
            ])
            ->assertOk();

        $config = SiteConfig::query()->where('site_id', $site->id)->where('namespace', 'gaip')->first();
        $this->assertArrayHasKey('nutritionCalendarProgram', $config->config);
        $this->assertArrayHasKey('nutritionProgramCoords', $config->config);
    }

    public function test_a_sub_tolerance_coordinate_drift_does_not_clear_the_cached_programme(): void
    {
        $user = User::factory()->create();
        $site = $this->createSiteForUser($user, [
            'name' => 'Hoxton Soccer',
            'slug' => 'hoxton-soccer',
            'latitude' => -36.8508827,
            'longitude' => 174.7644881,
        ]);

        SiteConfig::query()->create([
            'site_id' => $site->id,
            'namespace' => 'gaip',
            'config' => [
                'nutritionCalendarProgram' => ['meta' => ['lat' => -36.8508827, 'lon' => 174.7644881], 'annual_totals' => ['N' => 200]],
                'nutritionProgramCoords' => ['lat' => -36.8508827, 'lon' => 174.7644881],
            ],
            'synced_at' => now(),
        ]);

        // ~0.0001 degree drift -- floating-point/display rounding, not a
        // real relocation.
        $this->actingAs($user)
            ->withSession(['_token' => 'test-token'])
            ->patchJson('/api/sites/'.$site->id, [
                '_token' => 'test-token',
                'name' => 'Hoxton Soccer',
                'latitude' => -36.8509,
                'longitude' => 174.7645,
            ])
            ->assertOk();

        $config = SiteConfig::query()->where('site_id', $site->id)->where('namespace', 'gaip')->first();
        $this->assertArrayHasKey('nutritionCalendarProgram', $config->config);
    }

    public function test_a_request_that_omits_latitude_and_longitude_entirely_does_not_clear_the_cached_programme(): void
    {
        $user = User::factory()->create();
        $site = $this->createSiteForUser($user, [
            'name' => 'Hoxton Soccer',
            'slug' => 'hoxton-soccer',
            'latitude' => -36.8508827,
            'longitude' => 174.7644881,
        ]);

        SiteConfig::query()->create([
            'site_id' => $site->id,
            'namespace' => 'gaip',
            'config' => [
                'nutritionCalendarProgram' => ['meta' => ['lat' => -36.8508827, 'lon' => 174.7644881], 'annual_totals' => ['N' => 200]],
                'nutritionProgramCoords' => ['lat' => -36.8508827, 'lon' => 174.7644881],
            ],
            'synced_at' => now(),
        ]);

        // e.g. the zone-editor PATCH (attributes_json only) -- see
        // settings-init.js line ~862 -- never touches latitude/longitude at all.
        $this->actingAs($user)
            ->withSession(['_token' => 'test-token'])
            ->patchJson('/api/sites/'.$site->id, [
                '_token' => 'test-token',
                'attributes_json' => ['zones' => ['Green 1']],
            ])
            ->assertOk();

        $config = SiteConfig::query()->where('site_id', $site->id)->where('namespace', 'gaip')->first();
        $this->assertArrayHasKey('nutritionCalendarProgram', $config->config);
    }

    public function test_coordinate_change_on_a_site_with_no_gaip_config_row_does_not_error(): void
    {
        $user = User::factory()->create();
        $site = $this->createSiteForUser($user, [
            'name' => 'Brand New Site',
            'slug' => 'brand-new-site',
            'latitude' => -33.8688,
            'longitude' => 151.2093,
        ]);

        $this->actingAs($user)
            ->withSession(['_token' => 'test-token'])
            ->patchJson('/api/sites/'.$site->id, [
                '_token' => 'test-token',
                'name' => 'Brand New Site',
                'latitude' => -36.8508827,
                'longitude' => 174.7644881,
            ])
            ->assertOk()
            ->assertJsonPath('data.latitude', fn ($lat) => (float) $lat === -36.8508827);
    }

    /*
     * GH-442 (GH-439 stage 3): ten cases about PUT .../config/gaip stood here
     * and went with the route -- it answers 410 now
     * (GH439PutGuardTest::test_a_whole_object_write_to_gaip_is_refused). They
     * described what happened when a whole-object write raced this PATCH: a
     * stale clone resurrecting a just-cleared programme, a bare stamp, an
     * explicit null, a malformed stamp. Every rule they covered is live and
     * tested on the route that replaced them, in GH439SiteConfigPatchTest --
     * including the stale-tab path end to end, which no PUT test could express,
     * because a PUT carried the whole config and could not be stale in pieces.
     *
     * The five cases above, on PATCH /api/sites/{id}, are untouched.
     */

    private function createAccountForUser(User $user): Account
    {
        return Account::query()->firstOrCreate(
            ['owner_user_id' => $user->id],
            [
                'display_name' => $user->name,
                'created_by_user_id' => $user->id,
                'modified_by_user_id' => $user->id,
            ]
        );
    }

    private function createSiteForUser(User $user, array $overrides = []): Site
    {
        $account = $this->createAccountForUser($user);

        $site = Site::query()->create(array_merge([
            'account_id' => $account->id,
            'name' => 'Site '.substr((string) $user->id, -4),
            'slug' => 'site-'.substr((string) $user->id, -4),
            'site_type' => 'precinct',
            'created_by_user_id' => $user->id,
            'modified_by_user_id' => $user->id,
        ], $overrides));

        $site->users()->attach($user->id, ['role' => 'manager']);

        return $site;
    }
}
