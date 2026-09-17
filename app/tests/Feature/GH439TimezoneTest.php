<?php

namespace Tests\Feature;

use App\Models\Account;
use App\Models\Site;
use App\Models\SiteConfig;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * GH-439 (2.5) — a site's time zone comes from its coordinates.
 *
 * Both setup wizards sent a hardcoded 'Australia/Sydney' on every site they
 * created, and syncRegistry() stamped the same value onto every site it
 * invented, so sites in New Zealand, Wales and Northern Ireland carried a
 * Sydney zone. Nothing on the server derived one. The server derives it
 * now -- from the coordinates the site already has -- and the Settings
 * select becomes a manual override for the places where deriving from the
 * nearest zone reference point is approximate (zone borders).
 *
 * The nine reference points below are the ones the plan names; this test is
 * what says whether the method actually returns them.
 */
class GH439TimezoneTest extends TestCase
{
    use RefreshDatabase;

    public function test_a_sites_coordinates_derive_its_time_zone(): void
    {
        $points = [
            'Auckland' => [-36.8508827, 174.7644881, 'Pacific/Auckland'],
            'Canberra' => [-35.2809, 149.1300, 'Australia/Sydney'],
            'Melbourne' => [-37.8136, 144.9631, 'Australia/Melbourne'],
            'Gold Coast' => [-28.0167, 153.4000, 'Australia/Brisbane'],
            'Adelaide' => [-34.9285, 138.6007, 'Australia/Adelaide'],
            'Perth' => [-31.9505, 115.8605, 'Australia/Perth'],
            'Cardiff' => [51.4816, -3.1791, 'Europe/London'],
            'Belfast' => [54.5973, -5.9301, 'Europe/Isle_of_Man'],
            'New York' => [40.7128, -74.0060, 'America/New_York'],
        ];

        $user = User::factory()->create();

        foreach ($points as $label => [$latitude, $longitude, $expected]) {
            $response = $this->actingAs($user)
                ->withSession(['_token' => 'test-token'])
                ->postJson('/api/sites', [
                    '_token' => 'test-token',
                    'name' => $label,
                    'latitude' => $latitude,
                    'longitude' => $longitude,
                ])
                ->assertCreated();

            $this->assertSame($expected, $response->json('data.timezone'), $label.' timezone');
            $this->assertSame($expected, $response->json('data.timezone_derived'), $label.' timezone_derived');
        }
    }

    public function test_a_site_created_without_coordinates_has_no_time_zone(): void
    {
        $user = User::factory()->create();

        $response = $this->actingAs($user)
            ->withSession(['_token' => 'test-token'])
            ->postJson('/api/sites', [
                '_token' => 'test-token',
                'name' => 'Account > Add site',
                'site_type' => 'precinct',
            ])
            ->assertCreated();

        $this->assertNull($response->json('data.timezone'));
        $this->assertNull($response->json('data.timezone_derived'));
    }

    public function test_a_time_zone_sent_on_create_is_ignored_in_favour_of_the_coordinates(): void
    {
        // What both setup wizards send today, on a New Zealand site.
        $user = User::factory()->create();

        $this->actingAs($user)
            ->withSession(['_token' => 'test-token'])
            ->postJson('/api/sites', [
                '_token' => 'test-token',
                'name' => 'Wizard-created NZ site',
                'latitude' => -36.8508827,
                'longitude' => 174.7644881,
                'timezone' => 'Australia/Sydney',
            ])
            ->assertCreated()
            ->assertJsonPath('data.timezone', 'Pacific/Auckland');
    }

    public function test_a_time_zone_chosen_in_settings_is_stored_as_sent(): void
    {
        $user = User::factory()->create();
        $site = $this->createSiteForUser($user, [
            'name' => 'Belfast',
            'slug' => 'belfast',
            'latitude' => 54.5973,
            'longitude' => -5.9301,
            'timezone' => 'Europe/Isle_of_Man',
        ]);

        $this->actingAs($user)
            ->withSession(['_token' => 'test-token'])
            ->patchJson('/api/sites/'.$site->id, [
                '_token' => 'test-token',
                'timezone' => 'Europe/London',
            ])
            ->assertOk()
            ->assertJsonPath('data.timezone', 'Europe/London')
            // The derived value is still reported, so Settings can label its
            // Auto option with it while the override stays selected.
            ->assertJsonPath('data.timezone_derived', 'Europe/Isle_of_Man');

        $this->assertSame('Europe/London', $site->refresh()->timezone);
    }

    public function test_an_empty_time_zone_is_the_auto_option_and_derives_from_the_coordinates(): void
    {
        $user = User::factory()->create();
        $site = $this->createSiteForUser($user, [
            'name' => 'Auckland',
            'slug' => 'auckland',
            'latitude' => -36.8508827,
            'longitude' => 174.7644881,
            'timezone' => 'Europe/London',
        ]);

        $this->actingAs($user)
            ->withSession(['_token' => 'test-token'])
            ->patchJson('/api/sites/'.$site->id, [
                '_token' => 'test-token',
                'timezone' => '',
            ])
            ->assertOk()
            ->assertJsonPath('data.timezone', 'Pacific/Auckland');

        $this->assertSame('Pacific/Auckland', $site->refresh()->timezone);
    }

    public function test_moving_a_site_re_derives_its_time_zone_when_none_was_chosen(): void
    {
        $user = User::factory()->create();
        $site = $this->createSiteForUser($user, [
            'name' => 'Moves to Perth',
            'slug' => 'moves-to-perth',
            'latitude' => -33.8688,
            'longitude' => 151.2093,
            'timezone' => null,
        ]);

        $this->actingAs($user)
            ->withSession(['_token' => 'test-token'])
            ->patchJson('/api/sites/'.$site->id, [
                '_token' => 'test-token',
                'latitude' => -31.9505,
                'longitude' => 115.8605,
            ])
            ->assertOk()
            ->assertJsonPath('data.timezone', 'Australia/Perth');
    }

    public function test_a_patch_that_says_nothing_about_the_time_zone_leaves_a_manual_override_alone(): void
    {
        // The Turf form sends soil_texture_override and nothing else; the
        // zones editor sends attributes_json. Neither is a reason to undo a
        // zone the user chose on the Site form.
        $user = User::factory()->create();
        $site = $this->createSiteForUser($user, [
            'name' => 'Gold Coast',
            'slug' => 'gold-coast',
            'latitude' => -28.0167,
            'longitude' => 153.4000,
            'timezone' => 'Australia/Sydney',
        ]);

        $this->actingAs($user)
            ->withSession(['_token' => 'test-token'])
            ->patchJson('/api/sites/'.$site->id, [
                '_token' => 'test-token',
                'soil_texture_override' => 'sand',
            ])
            ->assertOk()
            ->assertJsonPath('data.timezone', 'Australia/Sydney')
            ->assertJsonPath('data.timezone_derived', 'Australia/Brisbane');

        $this->assertSame('Australia/Sydney', $site->refresh()->timezone);
    }

    public function test_a_patch_that_says_nothing_fills_a_time_zone_that_is_still_empty(): void
    {
        $user = User::factory()->create();
        $site = $this->createSiteForUser($user, [
            'name' => 'No zone yet',
            'slug' => 'no-zone-yet',
            'latitude' => 51.4816,
            'longitude' => -3.1791,
            'timezone' => null,
        ]);

        $this->actingAs($user)
            ->withSession(['_token' => 'test-token'])
            ->patchJson('/api/sites/'.$site->id, [
                '_token' => 'test-token',
                'soil_texture_override' => 'loam',
            ])
            ->assertOk()
            ->assertJsonPath('data.timezone', 'Europe/London');
    }

    public function test_a_site_with_no_coordinates_keeps_a_null_time_zone(): void
    {
        $user = User::factory()->create();
        $site = $this->createSiteForUser($user, [
            'name' => 'Skipped the wizard',
            'slug' => 'skipped-the-wizard',
            'latitude' => null,
            'longitude' => null,
            'timezone' => null,
        ]);

        $this->actingAs($user)
            ->withSession(['_token' => 'test-token'])
            ->patchJson('/api/sites/'.$site->id, [
                '_token' => 'test-token',
                'timezone' => '',
            ])
            ->assertOk()
            ->assertJsonPath('data.timezone', null)
            ->assertJsonPath('data.timezone_derived', null);
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

        SiteConfig::query()->create([
            'site_id' => $site->id,
            'namespace' => 'gaip',
            'config' => [],
            'synced_at' => now(),
        ]);

        return $site;
    }
}
