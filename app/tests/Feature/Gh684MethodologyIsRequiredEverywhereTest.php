<?php

namespace Tests\Feature;

use App\Models\Account;
use App\Models\Site;
use App\Models\SiteConfig;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * GH-684 — A WRITE WHOSE RESULT HAS NO METHODOLOGY IS REFUSED, WHATEVER
 * IT TOUCHED.
 *
 * The owner's decision is that methodology is required everywhere, for old sites and new. The
 * analyst chose the WIDE reading of it and gave her reasons rather than a preference: the owner's
 * words were "the server refuses to save a config without a methodology", and a narrow reading --
 * refuse only when the patch touches `turf` -- would accept a write to `location` and SAVE exactly
 * such a config.
 *
 * NOBODY LOSES ANYTHING BY THE WIDE READING. A site without a methodology has only one screen
 * open to it, the wizard, and the wizard sends the place and the turf in ONE write with the
 * methodology among them. Her boundary, kept: a write to the coordinates SEPARATELY from the turf
 * is possible only by calling the API directly, and a refusal there is the right answer.
 *
 * THE PAIR IS THE POINT. "It refuses" on its own does not say the refusal is about the
 * methodology: the same 422 could come from the route, the token or the shape of the patch. The
 * second case sends THE SAME PATCH to a site that differs in one thing and gets 200.
 */
class Gh684MethodologyIsRequiredEverywhereTest extends TestCase
{
    use RefreshDatabase;

    /** @return array{0:User,1:Site} */
    private function site(array $config): array
    {
        $user = User::factory()->create(['is_admin' => false]);
        $account = Account::query()->firstOrCreate(
            ['owner_user_id' => $user->id],
            ['display_name' => $user->name, 'created_by_user_id' => $user->id, 'modified_by_user_id' => $user->id]
        );
        $site = Site::query()->create([
            'account_id' => $account->id,
            'name' => 'GH-684 site',
            'slug' => 'gh684-'.substr((string) $user->id, -6),
            'site_type' => 'sports',
            'created_by_user_id' => $user->id,
            'modified_by_user_id' => $user->id,
        ]);
        $site->users()->attach($user->id, ['role' => 'manager']);
        SiteConfig::query()->create([
            'site_id' => $site->id, 'namespace' => 'gaip', 'config' => $config, 'synced_at' => now(),
        ]);

        return [$user, $site];
    }

    private function patchLocation(User $user, Site $site)
    {
        return $this->actingAs($user)
            ->withSession(['_token' => 'gh684-token'])
            ->patchJson("/api/sites/{$site->id}/config/gaip", [
                '_token' => 'gh684-token',
                'patch' => ['location' => ['lat' => -43.53, 'lon' => 172.63]],
            ]);
    }

    public function test_a_location_only_write_is_refused_when_the_site_has_no_methodology(): void
    {
        [$user, $site] = $this->site(['turf' => ['species' => 'perennialRyegrass']]);

        $response = $this->patchLocation($user, $site)->assertStatus(422);

        // Named, not merely a status: a 422 says nothing about WHICH rule spoke.
        $this->assertSame(['turf.methodology'], $response->json('invalid_keys'));
        $this->assertStringContainsString('methodology', (string) $response->json('message'));

        // And the write did not land.
        $config = SiteConfig::query()->where('site_id', $site->id)->where('namespace', 'gaip')->first();
        $this->assertArrayNotHasKey('location', is_array($config?->config) ? $config->config : []);
    }

    public function test_the_same_write_goes_through_when_it_has_one(): void
    {
        // One thing differs. Without this case the refusal above could be the route, the token or
        // the shape of the patch, and the test would read as proof of something it never measured.
        [$user, $site] = $this->site([
            'turf' => ['species' => 'perennialRyegrass', 'methodology' => 'mlsn'],
        ]);

        $this->patchLocation($user, $site)
            ->assertOk()
            ->assertJsonPath('data.config.location.lat', -43.53);
    }

    public function test_a_write_that_supplies_the_methodology_itself_is_accepted(): void
    {
        // The wizard's own road: place and turf in one write, methodology among them. If this were
        // refused, the lock would have no door.
        [$user, $site] = $this->site([]);

        $this->actingAs($user)
            ->withSession(['_token' => 'gh684-token'])
            ->patchJson("/api/sites/{$site->id}/config/gaip", [
                '_token' => 'gh684-token',
                'patch' => [
                    'location' => ['lat' => -43.53, 'lon' => 172.63],
                    'turf' => ['species' => 'perennialRyegrass', 'methodology' => 'mlsn'],
                ],
            ])
            ->assertOk()
            ->assertJsonPath('data.config.turf.methodology', 'mlsn');
    }
}
