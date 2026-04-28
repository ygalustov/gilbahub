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

        $this->actingAs($user)
            ->getJson('/api/sites')
            ->assertOk()
            ->assertJsonPath('data.0.name', 'Default Site')
            ->assertJsonPath('data.0.configs.gaip.config.status', 'ready_for_wp_liftout');
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
