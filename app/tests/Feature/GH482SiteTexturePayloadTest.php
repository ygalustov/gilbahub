<?php

namespace Tests\Feature;

use App\Models\Account;
use App\Models\Site;
use App\Models\SiteConfig;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * GH-482 — the two settings a site row owns are returned by the API, so a
 * client can read them by id.
 *
 * `sites.soil_texture_override` and `sites.methodology_override` have existed
 * since the initial schema and the PATCH endpoint has always accepted them,
 * but `/api/sites` returned neither. A client that needed a site's soil
 * texture therefore had nowhere to read it by id and took the page's own copy
 * — the texture of whatever site the page was rendered for — which is what the
 * export did for every site in a combined document.
 *
 * `account_soil_texture` is the second link of the same setting, the one the
 * server falls back to itself (`$site->soil_texture_override ?:
 * $site->account->soil_texture`), returned so the client applies that rule
 * rather than a different one.
 */
class GH482SiteTexturePayloadTest extends TestCase
{
    use RefreshDatabase;

    private function siteFor(User $user, array $overrides = [], ?string $accountTexture = 'loam'): Site
    {
        $account = Account::query()->firstOrCreate(
            ['owner_user_id' => $user->id],
            [
                'display_name' => $user->name,
                'created_by_user_id' => $user->id,
                'modified_by_user_id' => $user->id,
            ]
        );
        $account->soil_texture = $accountTexture;
        $account->save();

        $site = Site::query()->create(array_merge([
            'account_id' => $account->id,
            'name' => 'Texture site',
            'slug' => 'texture-site-'.substr((string) $user->id, -4),
            'site_type' => 'precinct',
            'created_by_user_id' => $user->id,
            'modified_by_user_id' => $user->id,
        ], $overrides));
        $site->users()->attach($user->id, ['role' => 'manager']);
        SiteConfig::query()->create([
            'site_id' => $site->id,
            'namespace' => 'gaip',
            'config' => [],
            'synced_at' => now(),
        ]);

        return $site;
    }

    private function rowFor(User $user, Site $site): array
    {
        return collect($this->actingAs($user)->getJson('/api/sites')->assertOk()->json('data'))
            ->firstWhere('id', $site->id);
    }

    public function test_the_listing_returns_both_columns_and_the_account_fallback(): void
    {
        $user = User::factory()->create();
        $site = $this->siteFor($user, [
            'soil_texture_override' => 'sand',
            'methodology_override' => 'ammonium_acetate',
        ]);

        $row = $this->rowFor($user, $site);

        $this->assertSame('sand', $row['soil_texture_override']);
        $this->assertSame('ammonium_acetate', $row['methodology_override']);
        $this->assertSame('loam', $row['account_soil_texture']);
    }

    public function test_a_site_with_no_setting_of_its_own_returns_null_and_the_account_link(): void
    {
        $user = User::factory()->create();
        $site = $this->siteFor($user, [
            'soil_texture_override' => null,
            'methodology_override' => null,
        ]);

        $row = $this->rowFor($user, $site);

        // Null, not the account's value: the two links stay two, and which one
        // answered is a thing the client can see.
        $this->assertNull($row['soil_texture_override']);
        $this->assertNull($row['methodology_override']);
        $this->assertSame('loam', $row['account_soil_texture']);
    }

    public function test_a_patched_texture_comes_back_in_the_next_read(): void
    {
        $user = User::factory()->create();
        $site = $this->siteFor($user, ['soil_texture_override' => null]);

        $this->actingAs($user)
            ->withSession(['_token' => 'test-token'])
            ->patchJson('/api/sites/'.$site->id, ['_token' => 'test-token', 'soil_texture_override' => 'clay_loam'])
            ->assertOk();

        $this->assertSame('clay_loam', $this->rowFor($user, $site)['soil_texture_override']);
    }
}
