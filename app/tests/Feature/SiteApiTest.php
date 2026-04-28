<?php

namespace Tests\Feature;

use App\Models\Site;
use App\Models\SiteConfig;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
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
}
