<?php

namespace Tests\Feature;

use App\Models\Account;
use App\Models\Site;
use App\Models\SiteConfig;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * GH-442 (GH-439 stage 3) — the whole-object write is refused.
 *
 * This file used to hold the guard's own tests: through stages 0-2 the hub
 * pages still sent a whole config in the background, so the route carried
 * omitted keys forward and put back identity fields the payload had blanked.
 * Nothing sends one any more, and a route that accepts a page's copy of a site
 * as the truth about that site is the thing GH-439 exists to remove. It
 * answers 410 for `gaip`.
 *
 * The stadium namespace keeps the endpoint: `gssh` has its own plan and its own
 * client, and is out of scope by decision 7.
 */
class GH439PutGuardTest extends TestCase
{
    use RefreshDatabase;

    public function test_a_whole_object_write_to_gaip_is_refused(): void
    {
        $user = User::factory()->create();
        $site = $this->siteWithConfig($user, [
            'turf' => ['species' => 'Perennial Ryegrass', 'methodology' => 'ammonium_acetate'],
            'wizard' => ['complete' => true],
        ]);

        $response = $this->actingAs($user)
            ->withSession(['_token' => 'test-token'])
            ->putJson('/api/sites/'.$site->id.'/config/gaip', [
                '_token' => 'test-token',
                'config' => ['turf' => ['species' => 'Kikuyu']],
            ])
            ->assertStatus(410);

        $this->assertStringContainsString('PATCH', $response->json('message'));

        // And the site is untouched: not merged, not replaced, not emptied.
        $config = SiteConfig::query()
            ->where('site_id', $site->id)->where('namespace', 'gaip')->first()->config;
        $this->assertSame('Perennial Ryegrass', $config['turf']['species']);
        $this->assertTrue($config['wizard']['complete']);
    }

    public function test_the_stadium_namespace_still_accepts_its_own_writes(): void
    {
        $user = User::factory()->create();
        $site = $this->siteWithConfig($user, ['turf' => ['species' => 'Couch']]);

        SiteConfig::query()->create([
            'site_id' => $site->id,
            'namespace' => 'gssh',
            'config' => ['venue' => ['name' => 'Stadium']],
            'synced_at' => now(),
        ]);

        $this->actingAs($user)
            ->withSession(['_token' => 'test-token'])
            ->putJson('/api/sites/'.$site->id.'/config/gssh', [
                '_token' => 'test-token',
                'config' => ['venue' => ['name' => 'Stadium renamed']],
            ])
            ->assertOk()
            ->assertJsonPath('data.config.venue.name', 'Stadium renamed');
    }

    public function test_the_registry_sync_route_is_gone(): void
    {
        // The plan expected a 404 here; the measured answer is 405, and the
        // reason is worth recording rather than asserting around: with the
        // POST route withdrawn, the path still matches GET /api/sites/{site}
        // (with "sync" as the identifier), so Laravel refuses the method
        // rather than the path. Either way nothing accepts this payload, which
        // is the property under test.
        $user = User::factory()->create();

        $this->actingAs($user)
            ->withSession(['_token' => 'test-token'])
            ->postJson('/api/sites/sync', [
                '_token' => 'test-token',
                'sites' => ['some-id' => ['label' => 'Anything']],
            ])
            ->assertStatus(405);

        // And no site was created by it, which is what the old route did with
        // an ID it did not recognise.
        $this->assertDatabaseMissing('sites', ['id' => 'some-id']);
    }

    private function siteWithConfig(User $user, array $config): Site
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
            'name' => 'Stage 3 site',
            'slug' => 'stage-3-site-'.substr((string) $user->id, -4),
            'site_type' => 'sports',
            'created_by_user_id' => $user->id,
            'modified_by_user_id' => $user->id,
        ]);

        $site->users()->attach($user->id, ['role' => 'manager']);

        SiteConfig::query()->create([
            'site_id' => $site->id,
            'namespace' => 'gaip',
            'config' => $config,
            'synced_at' => now(),
        ]);

        return $site;
    }
}
