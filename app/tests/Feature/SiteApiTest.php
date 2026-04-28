<?php

namespace Tests\Feature;

use App\Models\Site;
use App\Models\SiteConfig;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class SiteApiTest extends TestCase
{
    use RefreshDatabase;

    public function test_authenticated_user_can_list_their_sites(): void
    {
        $user = User::factory()->create();
        $site = Site::query()->create([
            'owner_user_id' => $user->id,
            'name' => 'Default Site',
            'slug' => 'default-site',
            'timezone' => 'Australia/Sydney',
        ]);
        $site->users()->attach($user->id, ['role' => 'owner']);
        SiteConfig::query()->create([
            'site_id' => $site->id,
            'namespace' => 'gaip',
            'config' => ['status' => 'ready_for_wp_liftout'],
            'synced_at' => now(),
        ]);

        $user->forceFill(['last_active_site_id' => $site->id])->save();

        $this->actingAs($user)
            ->getJson('/api/sites')
            ->assertOk()
            ->assertJsonPath('active_site_id', $site->id)
            ->assertJsonPath('data.0.name', 'Default Site')
            ->assertJsonPath('data.0.configs.gaip.config.status', 'ready_for_wp_liftout');
    }

    public function test_authenticated_user_can_create_site(): void
    {
        $user = User::factory()->create();

        $this->actingAs($user)
            ->withSession(['_token' => 'test-token'])
            ->postJson('/api/sites', [
                '_token' => 'test-token',
                'name' => 'Training Ground',
                'location_name' => 'Sydney, NSW',
                'timezone' => 'Australia/Sydney',
                'latitude' => -33.8688,
                'longitude' => 151.2093,
            ])
            ->assertCreated()
            ->assertJsonPath('data.name', 'Training Ground')
            ->assertJsonPath('data.configs.gaip.config', []);

        $this->assertSame(
            Site::query()->where('name', 'Training Ground')->value('id'),
            $user->refresh()->last_active_site_id
        );

        $this->assertDatabaseHas('sites', [
            'owner_user_id' => $user->id,
            'name' => 'Training Ground',
            'slug' => 'training-ground',
        ]);

        $this->assertDatabaseHas('site_user', [
            'user_id' => $user->id,
            'role' => 'owner',
        ]);
    }

    public function test_authenticated_user_can_update_site(): void
    {
        $user = User::factory()->create();
        $site = Site::query()->create([
            'owner_user_id' => $user->id,
            'name' => 'Default Site',
            'slug' => 'default-site',
        ]);
        $site->users()->attach($user->id, ['role' => 'owner']);

        $this->actingAs($user)
            ->withSession(['_token' => 'test-token'])
            ->patchJson('/api/sites/'.$site->id, [
                '_token' => 'test-token',
                'name' => 'Updated Site',
                'location_name' => 'Melbourne, VIC',
                'timezone' => 'Australia/Melbourne',
            ])
            ->assertOk()
            ->assertJsonPath('data.name', 'Updated Site')
            ->assertJsonPath('data.location_name', 'Melbourne, VIC');

        $this->assertDatabaseHas('sites', [
            'id' => $site->id,
            'name' => 'Updated Site',
            'slug' => 'updated-site',
        ]);
    }

    public function test_authenticated_user_can_set_active_site(): void
    {
        $user = User::factory()->create();
        $siteA = Site::query()->create([
            'owner_user_id' => $user->id,
            'name' => 'Site A',
            'slug' => 'site-a',
        ]);
        $siteB = Site::query()->create([
            'owner_user_id' => $user->id,
            'name' => 'Site B',
            'slug' => 'site-b',
        ]);
        $siteA->users()->attach($user->id, ['role' => 'owner']);
        $siteB->users()->attach($user->id, ['role' => 'owner']);

        $this->actingAs($user)
            ->withSession(['_token' => 'test-token'])
            ->patchJson('/api/active-site', [
                '_token' => 'test-token',
                'site_id' => $siteB->id,
            ])
            ->assertOk()
            ->assertJsonPath('active_site_id', $siteB->id)
            ->assertJsonPath('data.name', 'Site B');

        $this->assertSame($siteB->id, $user->refresh()->last_active_site_id);
    }

    public function test_authenticated_user_can_update_site_config(): void
    {
        $user = User::factory()->create();
        $site = Site::query()->create([
            'owner_user_id' => $user->id,
            'name' => 'Default Site',
            'slug' => 'default-site',
        ]);
        $site->users()->attach($user->id, ['role' => 'owner']);

        $this->actingAs($user)
            ->withSession(['_token' => 'test-token'])
            ->putJson('/api/sites/'.$site->id.'/config/gaip', [
                '_token' => 'test-token',
                'config' => [
                    'turf' => ['species' => 'couch'],
                ],
            ])
            ->assertOk()
            ->assertJsonPath('data.config.turf.species', 'couch');

        $this->assertDatabaseHas('site_configs', [
            'site_id' => $site->id,
            'namespace' => 'gaip',
        ]);
    }

    public function test_authenticated_user_can_create_spray_log_entry(): void
    {
        $user = User::factory()->create();
        $site = Site::query()->create([
            'owner_user_id' => $user->id,
            'name' => 'Default Site',
            'slug' => 'default-site',
        ]);
        $site->users()->attach($user->id, ['role' => 'owner']);

        $this->actingAs($user)
            ->withSession(['_token' => 'test-token'])
            ->postJson('/api/spray-log', [
                '_token' => 'test-token',
                'site_id' => $site->id,
                'zone' => 'greens',
                'application_date' => '2026-04-28',
                'product_name' => 'Banner Maxx',
                'product_category' => 'fungicide',
                'rate' => 2.5,
                'rate_unit' => 'L/ha',
                'target' => 'Dollar Spot',
                'notes' => 'Evening application.',
                'source' => 'manual',
            ])
            ->assertCreated()
            ->assertJsonPath('data.site_id', $site->id)
            ->assertJsonPath('data.product_name', 'Banner Maxx')
            ->assertJsonPath('data.target', 'Dollar Spot');

        $this->assertSame(1, DB::table('spray_logs')->count());

        $this->assertDatabaseHas('spray_logs', [
            'site_id' => $site->id,
            'user_id' => $user->id,
            'product_name' => 'Banner Maxx',
            'product_category' => 'fungicide',
            'zone' => 'greens',
        ]);
    }

    public function test_authenticated_user_can_upload_media(): void
    {
        Storage::fake('local');
        $user = User::factory()->create();

        $this->actingAs($user)
            ->withSession(['_token' => 'test-token'])
            ->post('/api/media', [
                '_token' => 'test-token',
                'title' => 'Disease Note',
                'file' => UploadedFile::fake()->image('disease-note.jpg'),
            ])
            ->assertCreated()
            ->assertJsonPath('title.rendered', 'Disease Note');

        $this->assertSame(1, DB::table('media_uploads')->count());

        $path = DB::table('media_uploads')->value('path');

        Storage::disk('local')->assertExists($path);
    }

    public function test_legacy_site_list_endpoints_use_wordpress_style_response_shape(): void
    {
        $user = User::factory()->create();

        $this->actingAs($user)
            ->withSession(['_token' => 'test-token'])
            ->postJson('/api/legacy/gilba-sites-save', [
                '_token' => 'test-token',
                'sites' => [
                    'training-ground' => ['label' => 'Training Ground'],
                ],
            ])
            ->assertOk()
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.saved', 1);

        $site = Site::query()->where('slug', 'training-ground')->firstOrFail();

        $this->assertSame($site->id, $user->refresh()->last_active_site_id);
        $this->assertDatabaseHas('site_user', [
            'site_id' => $site->id,
            'user_id' => $user->id,
            'role' => 'owner',
        ]);

        $this->actingAs($user)
            ->withSession(['_token' => 'test-token'])
            ->postJson('/api/legacy/gilba-sites-load', ['_token' => 'test-token'])
            ->assertOk()
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.count', 1)
            ->assertJsonPath('data.sites.'.$site->id.'.label', 'Training Ground');
    }

    public function test_legacy_site_config_endpoints_store_gaip_config_by_site(): void
    {
        $user = User::factory()->create();
        $site = Site::query()->create([
            'owner_user_id' => $user->id,
            'name' => 'Default Site',
            'slug' => 'default-site',
        ]);
        $site->users()->attach($user->id, ['role' => 'owner']);

        $this->actingAs($user)
            ->withSession(['_token' => 'test-token'])
            ->postJson('/api/legacy/gilba-site-configs-save', [
                '_token' => 'test-token',
                'configs' => [
                    (string) $site->id => [
                        'turf' => ['species' => 'couch'],
                        'location' => [
                            'name' => 'Sydney, NSW',
                            'lat' => -33.8688,
                            'lon' => 151.2093,
                            'timezone' => 'Australia/Sydney',
                        ],
                        'pgr' => ['enabled' => true],
                    ],
                ],
            ])
            ->assertOk()
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.saved', 1);

        $this->assertDatabaseHas('sites', [
            'id' => $site->id,
            'location_name' => 'Sydney, NSW',
            'timezone' => 'Australia/Sydney',
        ]);

        $this->actingAs($user)
            ->withSession(['_token' => 'test-token'])
            ->postJson('/api/legacy/gilba-site-configs-load', ['_token' => 'test-token'])
            ->assertOk()
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.count', 1)
            ->assertJsonPath('data.configs.'.$site->id.'.turf.species', 'couch')
            ->assertJsonPath('data.configs.'.$site->id.'.location.name', 'Sydney, NSW');
    }
}
