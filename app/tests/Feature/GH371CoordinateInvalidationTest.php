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

    public function test_a_stale_updateconfig_put_after_a_real_coordinate_patch_does_not_resurrect_the_cleared_cache(): void
    {
        // Reproduces the actual GH-371 gap: settings-init.js fires
        // Promise.all([PATCH /sites/{id}, PUT .../config/gaip]) together on
        // every Settings save. The PUT's body is a clone of the page's
        // config taken before the save, so on a coordinate-changing save it
        // still carries the OLD cache fields. If the PATCH's own clear
        // (SiteController::update()) lands first and the stale PUT lands
        // after, the just-cleared fields must not come back.
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
                'irrigation' => ['method' => 'sprinkler'],
            ],
            'synced_at' => now(),
        ]);

        // 1) The PATCH lands first: a real coordinate change, clears the
        //    cache server-side (SiteController::update(), pre-existing
        //    GH-371 behaviour).
        $this->actingAs($user)
            ->withSession(['_token' => 'test-token'])
            ->patchJson('/api/sites/'.$site->id, [
                '_token' => 'test-token',
                'name' => 'Hoxton Soccer',
                'latitude' => -36.8508827,
                'longitude' => 174.7644881,
            ])
            ->assertOk();

        $midway = SiteConfig::query()->where('site_id', $site->id)->where('namespace', 'gaip')->first();
        $this->assertArrayNotHasKey('nutritionCalendarProgram', $midway->config);

        // 2) The sibling PUT lands second, exactly as settings-init.js
        //    builds it (pre-fix shape, to prove the SERVER side alone closes
        //    the race even without the client-side strip): cfg is a clone
        //    of D.gaipConfig taken BEFORE the save, so location.lat/lon
        //    reflect the NEW, just-typed coordinates (settings-init.js
        //    updates cfg.location itself before sending) but the cache
        //    fields are untouched by that clone and still carry the OLD,
        //    pre-save values.
        $this->actingAs($user)
            ->withSession(['_token' => 'test-token'])
            ->putJson('/api/sites/'.$site->id.'/config/gaip', [
                '_token' => 'test-token',
                'config' => [
                    'location' => ['lat' => -36.8508827, 'lon' => 174.7644881, 'name' => 'Auckland'],
                    'nutritionProgram' => ['monthly' => [['N' => 16.7]]],
                    'nutritionCalendarProgram' => ['meta' => ['lat' => -33.8688, 'lon' => 151.2093], 'annual_totals' => ['N' => 200]],
                    'nutritionProgramCoords' => ['lat' => -33.8688, 'lon' => 151.2093],
                    'appliedMonthlyN' => 16.7,
                    'irrigation' => ['method' => 'sprinkler'],
                ],
            ])
            ->assertOk();

        $final = SiteConfig::query()->where('site_id', $site->id)->where('namespace', 'gaip')->first();
        $this->assertArrayNotHasKey('nutritionProgram', $final->config);
        $this->assertArrayNotHasKey('nutritionCalendarProgram', $final->config);
        $this->assertArrayNotHasKey('nutritionProgramCoords', $final->config);
        // Unrelated fields from the PUT still land -- this isn't a
        // wholesale no-op, just the three cache keys are protected.
        $this->assertSame('sprinkler', $final->config['irrigation']['method']);
        $this->assertSame('Auckland', $final->config['location']['name']);
    }

    public function test_a_stale_updateconfig_put_before_the_coordinate_patch_still_ends_up_cleared(): void
    {
        // The other possible landing order for the same Promise.all pair --
        // included to confirm the fix is not order-dependent.
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
                'nutritionCalendarProgram' => ['meta' => ['lat' => -33.8688, 'lon' => 151.2093], 'annual_totals' => ['N' => 200]],
                'nutritionProgramCoords' => ['lat' => -33.8688, 'lon' => 151.2093],
            ],
            'synced_at' => now(),
        ]);

        $this->actingAs($user)
            ->withSession(['_token' => 'test-token'])
            ->putJson('/api/sites/'.$site->id.'/config/gaip', [
                '_token' => 'test-token',
                'config' => [
                    'location' => ['lat' => -36.8508827, 'lon' => 174.7644881, 'name' => 'Auckland'],
                    'nutritionCalendarProgram' => ['meta' => ['lat' => -33.8688, 'lon' => 151.2093], 'annual_totals' => ['N' => 200]],
                    'nutritionProgramCoords' => ['lat' => -33.8688, 'lon' => 151.2093],
                ],
            ])
            ->assertOk();

        $this->actingAs($user)
            ->withSession(['_token' => 'test-token'])
            ->patchJson('/api/sites/'.$site->id, [
                '_token' => 'test-token',
                'name' => 'Hoxton Soccer',
                'latitude' => -36.8508827,
                'longitude' => 174.7644881,
            ])
            ->assertOk();

        $final = SiteConfig::query()->where('site_id', $site->id)->where('namespace', 'gaip')->first();
        $this->assertArrayNotHasKey('nutritionCalendarProgram', $final->config);
        $this->assertArrayNotHasKey('nutritionProgramCoords', $final->config);
    }

    public function test_updateconfig_endpoint_clears_cache_on_its_own_real_coordinate_change(): void
    {
        // updateConfig() also syncs config.location.lat/lon onto the site
        // row independently of update() (see the site-column sync in
        // resolveGaipConfigWrite()) -- it must apply the identical
        // real-change detection and clear on its own, not only when paired
        // with a PATCH.
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
                'nutritionCalendarProgram' => ['meta' => ['lat' => -33.8688, 'lon' => 151.2093], 'annual_totals' => ['N' => 200]],
                'nutritionProgramCoords' => ['lat' => -33.8688, 'lon' => 151.2093],
                'appliedMonthlyN' => 16.7,
            ],
            'synced_at' => now(),
        ]);

        $this->actingAs($user)
            ->withSession(['_token' => 'test-token'])
            ->putJson('/api/sites/'.$site->id.'/config/gaip', [
                '_token' => 'test-token',
                'config' => [
                    'location' => ['lat' => -36.8508827, 'lon' => 174.7644881, 'name' => 'Auckland'],
                    'nutritionCalendarProgram' => ['meta' => ['lat' => -33.8688, 'lon' => 151.2093], 'annual_totals' => ['N' => 200]],
                    'nutritionProgramCoords' => ['lat' => -33.8688, 'lon' => 151.2093],
                    'appliedMonthlyN' => 16.7,
                ],
            ])
            ->assertOk();

        $config = SiteConfig::query()->where('site_id', $site->id)->where('namespace', 'gaip')->first();
        $this->assertArrayNotHasKey('nutritionCalendarProgram', $config->config);
        $this->assertArrayNotHasKey('nutritionProgramCoords', $config->config);
        $this->assertSame(16.7, $config->config['appliedMonthlyN']);

        $site->refresh();
        $this->assertEqualsWithDelta(-36.8508827, (float) $site->latitude, 0.0001);
    }

    public function test_updateconfig_endpoint_does_not_clear_cache_on_a_no_op_resubmit(): void
    {
        // Mirrors coordinateChanged()'s semantics as already tested on
        // update() above: the same coordinates resubmitted (e.g. Settings
        // saving an unrelated field, post client-side fix so the payload
        // doesn't even mention the cache keys) must not clear a still-valid
        // cached programme.
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
                'location' => ['lat' => -36.8508827, 'lon' => 174.7644881, 'name' => 'Auckland'],
                'nutritionCalendarProgram' => ['meta' => ['lat' => -36.8508827, 'lon' => 174.7644881], 'annual_totals' => ['N' => 200]],
                'nutritionProgramCoords' => ['lat' => -36.8508827, 'lon' => 174.7644881],
            ],
            'synced_at' => now(),
        ]);

        $this->actingAs($user)
            ->withSession(['_token' => 'test-token'])
            ->putJson('/api/sites/'.$site->id.'/config/gaip', [
                '_token' => 'test-token',
                'config' => [
                    'location' => ['lat' => -36.8508827, 'lon' => 174.7644881, 'name' => 'Auckland'],
                    'irrigation' => ['method' => 'drip'],
                ],
            ])
            ->assertOk();

        $config = SiteConfig::query()->where('site_id', $site->id)->where('namespace', 'gaip')->first();
        $this->assertArrayHasKey('nutritionCalendarProgram', $config->config);
        $this->assertArrayHasKey('nutritionProgramCoords', $config->config);
        $this->assertSame('drip', $config->config['irrigation']['method']);
    }

    public function test_updateconfig_endpoint_accepts_a_freshly_stamped_programme_matching_current_coordinates(): void
    {
        // Guards against the fix over-triggering: a genuinely fresh
        // programme -- Plan's own direct-PUT fallback right after Generate
        // (nutrition-calendar.js's persistSiteConfigPatch()), stamped with
        // the site's own current coordinates -- must still persist, not be
        // stripped like a stale one.
        $user = User::factory()->create();
        $site = $this->createSiteForUser($user, [
            'name' => 'Hoxton Soccer',
            'slug' => 'hoxton-soccer',
            'latitude' => -36.8508827,
            'longitude' => 174.7644881,
        ]);

        $this->actingAs($user)
            ->withSession(['_token' => 'test-token'])
            ->putJson('/api/sites/'.$site->id.'/config/gaip', [
                '_token' => 'test-token',
                'config' => [
                    'location' => ['lat' => -36.8508827, 'lon' => 174.7644881, 'name' => 'Auckland'],
                    'nutritionCalendarProgram' => ['meta' => ['lat' => -36.8508827, 'lon' => 174.7644881], 'annual_totals' => ['N' => 210]],
                    'nutritionProgram' => ['monthly' => [['N' => 17.5]]],
                    'nutritionProgramCoords' => ['lat' => -36.8508827, 'lon' => 174.7644881],
                ],
            ])
            ->assertOk();

        $config = SiteConfig::query()->where('site_id', $site->id)->where('namespace', 'gaip')->first();
        $this->assertSame(210, $config->config['nutritionCalendarProgram']['annual_totals']['N']);
        $this->assertSame(17.5, $config->config['nutritionProgram']['monthly'][0]['N']);
    }

    public function test_updateconfig_endpoint_accepts_a_sites_first_ever_programme_when_latitude_starts_null(): void
    {
        // GH-371 follow-up (independent review, second pass): a genuine bug
        // in the first cut of resolveGaipConfigWrite() -- TRUST additionally
        // required "!coordinatesChanging", but a brand-new site's very
        // first coordinate assignment always reports "changed"
        // (coordinateChanged(null, $newLat, true) is unconditionally true),
        // so a site's first-ever, correctly-stamped programme was silently
        // dropped. Reproduces the real path: SiteController::syncRegistry()
        // creates the site row via forceFill() with no latitude/longitude
        // at all (see its own test below for that half), and the very next
        // request -- site-config-persistence.js's pushConfigsToServer(),
        // carrying the freshly-generated programme -- must not lose it.
        $user = User::factory()->create();
        $site = $this->createSiteForUser($user, [
            'name' => 'Brand New Site',
            'slug' => 'brand-new-site-null-lat',
            'latitude' => null,
            'longitude' => null,
        ]);

        $this->actingAs($user)
            ->withSession(['_token' => 'test-token'])
            ->putJson('/api/sites/'.$site->id.'/config/gaip', [
                '_token' => 'test-token',
                'config' => [
                    'location' => ['lat' => -36.8508827, 'lon' => 174.7644881, 'name' => 'Auckland'],
                    'nutritionCalendarProgram' => ['meta' => ['lat' => -36.8508827, 'lon' => 174.7644881], 'annual_totals' => ['N' => 200]],
                    'nutritionProgram' => ['monthly' => [['N' => 16.7]]],
                    'nutritionProgramCoords' => ['lat' => -36.8508827, 'lon' => 174.7644881],
                ],
            ])
            ->assertOk();

        $config = SiteConfig::query()->where('site_id', $site->id)->where('namespace', 'gaip')->first();
        $this->assertArrayHasKey('nutritionCalendarProgram', $config->config);
        $this->assertSame(200, $config->config['nutritionCalendarProgram']['annual_totals']['N']);
        $this->assertArrayHasKey('nutritionProgram', $config->config);
        $this->assertArrayHasKey('nutritionProgramCoords', $config->config);
    }

    public function test_updateconfig_endpoint_does_not_wipe_an_existing_programme_when_the_payload_carries_only_a_bare_stamp(): void
    {
        // GH-371 follow-up (independent review, second pass): a second real
        // bug from the same first cut -- TRUST's "has cache fields" check
        // counted a bare nutritionProgramCoords with no actual programme as
        // enough to trust, and TRUST returns the payload verbatim, so a
        // stamp-only payload wholesale-replaced away a real, still-valid
        // programme under the two keys it never mentioned. No real current
        // caller sends this shape, but the endpoint itself must not have a
        // payload shape that silently destroys good data.
        $user = User::factory()->create();
        $site = $this->createSiteForUser($user, [
            'name' => 'Hoxton Soccer',
            'slug' => 'hoxton-soccer-stamp-only',
            'latitude' => -36.8508827,
            'longitude' => 174.7644881,
        ]);

        SiteConfig::query()->create([
            'site_id' => $site->id,
            'namespace' => 'gaip',
            'config' => [
                'location' => ['lat' => -36.8508827, 'lon' => 174.7644881, 'name' => 'Auckland'],
                'nutritionCalendarProgram' => ['meta' => ['lat' => -36.8508827, 'lon' => 174.7644881], 'annual_totals' => ['N' => 200]],
                'nutritionProgram' => ['monthly' => [['N' => 16.7]]],
                'nutritionProgramCoords' => ['lat' => -36.8508827, 'lon' => 174.7644881],
            ],
            'synced_at' => now(),
        ]);

        $this->actingAs($user)
            ->withSession(['_token' => 'test-token'])
            ->putJson('/api/sites/'.$site->id.'/config/gaip', [
                '_token' => 'test-token',
                'config' => [
                    'location' => ['lat' => -36.8508827, 'lon' => 174.7644881, 'name' => 'Auckland'],
                    // A bare, freshly-matching stamp with no programme
                    // alongside it -- must not be treated as "a fresh
                    // write", and must not blow away the real programme
                    // already in the DB under the other two keys.
                    'nutritionProgramCoords' => ['lat' => -36.8508827, 'lon' => 174.7644881],
                ],
            ])
            ->assertOk();

        $config = SiteConfig::query()->where('site_id', $site->id)->where('namespace', 'gaip')->first();
        $this->assertArrayHasKey('nutritionCalendarProgram', $config->config);
        $this->assertSame(200, $config->config['nutritionCalendarProgram']['annual_totals']['N']);
        $this->assertArrayHasKey('nutritionProgram', $config->config);
        $this->assertArrayHasKey('nutritionProgramCoords', $config->config);
    }

    public function test_updateconfig_endpoint_does_not_wipe_an_existing_programme_when_the_payload_carries_an_explicit_null(): void
    {
        // GH-375 (review pass over the GH-371 follow-up): array_key_exists()
        // alone only tested that the KEY was present, not that it carried a
        // real value -- an explicit "nutritionProgram": null alongside a
        // matching stamp satisfied the old TRUST check and, since TRUST
        // returns the payload verbatim into a wholesale replace, would have
        // nulled out the real programme sitting under
        // nutritionCalendarProgram. Same latent-not-live class as the
        // bare-stamp case above (no current caller emits an explicit null),
        // pinned the same way.
        $user = User::factory()->create();
        $site = $this->createSiteForUser($user, [
            'name' => 'Hoxton Soccer',
            'slug' => 'hoxton-soccer-explicit-null',
            'latitude' => -36.8508827,
            'longitude' => 174.7644881,
        ]);

        SiteConfig::query()->create([
            'site_id' => $site->id,
            'namespace' => 'gaip',
            'config' => [
                'location' => ['lat' => -36.8508827, 'lon' => 174.7644881, 'name' => 'Auckland'],
                'nutritionCalendarProgram' => ['meta' => ['lat' => -36.8508827, 'lon' => 174.7644881], 'annual_totals' => ['N' => 200]],
                'nutritionProgram' => ['monthly' => [['N' => 16.7]]],
                'nutritionProgramCoords' => ['lat' => -36.8508827, 'lon' => 174.7644881],
            ],
            'synced_at' => now(),
        ]);

        $this->actingAs($user)
            ->withSession(['_token' => 'test-token'])
            ->putJson('/api/sites/'.$site->id.'/config/gaip', [
                '_token' => 'test-token',
                'config' => [
                    'location' => ['lat' => -36.8508827, 'lon' => 174.7644881, 'name' => 'Auckland'],
                    // The key IS present, but explicitly null -- must be
                    // treated the same as absent, not as "a fresh write".
                    'nutritionProgram' => null,
                    'nutritionProgramCoords' => ['lat' => -36.8508827, 'lon' => 174.7644881],
                ],
            ])
            ->assertOk();

        $config = SiteConfig::query()->where('site_id', $site->id)->where('namespace', 'gaip')->first();
        $this->assertArrayHasKey('nutritionCalendarProgram', $config->config);
        $this->assertSame(200, $config->config['nutritionCalendarProgram']['annual_totals']['N']);
        $this->assertArrayHasKey('nutritionProgram', $config->config);
        $this->assertSame(['monthly' => [['N' => 16.7]]], $config->config['nutritionProgram']);
    }

    public function test_updateconfig_endpoint_handles_a_malformed_nutritionprogramcoords_without_erroring(): void
    {
        // Defensive coverage: a non-array (or partially-shaped)
        // nutritionProgramCoords must degrade to "not a fresh stamp" rather
        // than throwing, and the request should still succeed.
        $user = User::factory()->create();
        $site = $this->createSiteForUser($user, [
            'name' => 'Hoxton Soccer',
            'slug' => 'hoxton-soccer-malformed-stamp',
            'latitude' => -36.8508827,
            'longitude' => 174.7644881,
        ]);

        $this->actingAs($user)
            ->withSession(['_token' => 'test-token'])
            ->putJson('/api/sites/'.$site->id.'/config/gaip', [
                '_token' => 'test-token',
                'config' => [
                    'location' => ['lat' => -36.8508827, 'lon' => 174.7644881, 'name' => 'Auckland'],
                    'nutritionCalendarProgram' => ['meta' => ['lat' => -36.8508827, 'lon' => 174.7644881], 'annual_totals' => ['N' => 200]],
                    'nutritionProgramCoords' => 'not-an-array',
                ],
            ])
            ->assertOk();

        $config = SiteConfig::query()->where('site_id', $site->id)->where('namespace', 'gaip')->first();
        // Not trusted (malformed stamp can't be "fresh"); nothing existed in
        // the DB before this request either, so there's nothing to carry
        // forward -- ends up absent, not erroring and not corrupting data.
        $this->assertArrayNotHasKey('nutritionCalendarProgram', $config->config);
    }

    public function test_updateconfig_endpoint_discards_an_unstamped_programme_and_carries_the_db_value_forward(): void
    {
        // Pins the DISCARD half of resolveGaipConfigWrite()'s trust rule,
        // which nothing covered until now.
        //
        // A payload can carry a real, fully-shaped programme and still fail
        // the trust test simply by having no nutritionProgramCoords stamp at
        // all -- the shape every programme generated before GH-371 has. When
        // that happens the incoming value is dropped and whatever the DB
        // already holds is carried forward instead.
        //
        // An investigation established this is currently harmless: the only
        // way to produce a fresh unstamped programme is a site with no
        // coordinates, and in that state the climate gate returns before a
        // programme is ever persisted, so there is nothing to discard;
        // historical unstamped programmes are never read back server-side and
        // self-heal on the next regeneration. But "harmless" here rests on the
        // ordering of conditions inside this one method -- a method that has
        // already needed three separate rounds of bug fixes (the
        // !$coordinatesChanging condition that killed a new site's first-ever
        // write, the bare-stamp acceptance, and the key-presence-vs-value
        // check). Reordering or loosening the trust conditions could silently
        // flip this branch to "accept the unstamped payload verbatim", which
        // WOULD let a stale programme wholesale-replace a good one. This test
        // makes the current behaviour deliberate rather than incidental.
        $user = User::factory()->create();
        $site = $this->createSiteForUser($user, [
            'name' => 'Hoxton Soccer',
            'slug' => 'hoxton-soccer-unstamped-discard',
            'latitude' => -36.8508827,
            'longitude' => 174.7644881,
        ]);

        SiteConfig::query()->create([
            'site_id' => $site->id,
            'namespace' => 'gaip',
            'config' => [
                'location' => ['lat' => -36.8508827, 'lon' => 174.7644881, 'name' => 'Auckland'],
                'nutritionCalendarProgram' => ['meta' => ['lat' => -36.8508827, 'lon' => 174.7644881], 'annual_totals' => ['N' => 200]],
                'nutritionProgramCoords' => ['lat' => -36.8508827, 'lon' => 174.7644881],
            ],
            'synced_at' => now(),
        ]);

        $this->actingAs($user)
            ->withSession(['_token' => 'test-token'])
            ->putJson('/api/sites/'.$site->id.'/config/gaip', [
                '_token' => 'test-token',
                'config' => [
                    'location' => ['lat' => -36.8508827, 'lon' => 174.7644881, 'name' => 'Auckland'],
                    // A real programme, correctly shaped, different figures --
                    // but with no stamp of its own, the pre-GH-371 shape.
                    'nutritionCalendarProgram' => ['meta' => ['species' => 'bentgrass'], 'annual_totals' => ['N' => 999]],
                ],
            ])
            ->assertOk();

        $config = SiteConfig::query()->where('site_id', $site->id)->where('namespace', 'gaip')->first();
        // The unstamped incoming programme is discarded; the stamped DB value
        // survives untouched, stamp included.
        $this->assertSame(200, $config->config['nutritionCalendarProgram']['annual_totals']['N']);
        $this->assertSame(-36.8508827, $config->config['nutritionProgramCoords']['lat']);
    }

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
