<?php

namespace Tests\Feature;

use App\Models\Account;
use App\Models\Site;
use App\Models\SiteConfig;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ExampleTest extends TestCase
{
    use RefreshDatabase;

    public function test_root_redirects_to_dashboard(): void
    {
        // GH-359: routes/web.php redirects '/' to '/dashboard', not '/hub' --
        // the new db-shell hub is the site's home page now (legacy /hub
        // still exists and still works, see the tests below, it's just no
        // longer where '/' sends visitors). This assertion predates that
        // and was never updated.
        $this->get('/')->assertRedirect('/dashboard');
    }

    public function test_authenticated_user_can_open_hub_page(): void
    {
        $user = User::factory()->create();

        $this->actingAs($user)
            ->get('/hub')
            ->assertOk()
            ->assertSee('id="gaip-hub"', false)
            ->assertSee('/legacy-assets/hub.css', false)
            ->assertSee('/legacy-assets/hub-tissue-v3.js', false);
    }

    public function test_hub_page_bootstraps_wizard_config_from_active_site(): void
    {
        $user = User::factory()->create();
        $account = Account::query()->create([
            'owner_user_id' => $user->id,
            'display_name' => $user->name,
            'created_by_user_id' => $user->id,
            'modified_by_user_id' => $user->id,
        ]);
        $site = Site::query()->create([
            'account_id' => $account->id,
            'name' => 'Federal Golf Club',
            'slug' => 'federal-golf-club',
            'site_type' => 'precinct',
            'location_name' => 'Canberra, ACT',
            'latitude' => -35.3075,
            'longitude' => 149.1244,
            'timezone' => 'Australia/Sydney',
            'created_by_user_id' => $user->id,
            'modified_by_user_id' => $user->id,
        ]);
        $site->users()->attach($user->id, ['role' => 'owner']);
        SiteConfig::query()->create([
            'site_id' => $site->id,
            'namespace' => 'gaip',
            'config' => [
                'wizard' => [
                    'complete' => true,
                    'completedAt' => '2026-04-30T09:00:00Z',
                    'version' => '1.0.0',
                ],
            ],
            'synced_at' => now(),
        ]);
        $user->forceFill(['last_active_site_id' => $site->id])->save();

        $this->actingAs($user)
            ->get('/hub')
            ->assertOk()
            ->assertSee('window.GAIP_WIZARD_CONFIG', false)
            ->assertSee('wizardComplete: true', false)
            ->assertSee('"name":"Canberra, ACT"', false);
    }

    public function test_authenticated_user_can_open_field_log_page(): void
    {
        $user = User::factory()->create();

        $this->actingAs($user)
            ->get('/field-log')
            ->assertOk()
            ->assertSee('id="gaip-field-log"', false)
            ->assertSee('/legacy-assets/gaip-field-log.css', false)
            ->assertSee('/legacy-assets/gaip-field-log.js', false);
    }

    public function test_authenticated_user_can_open_morning_briefing_page(): void
    {
        $user = User::factory()->create();

        $this->actingAs($user)
            ->get('/morning-briefing')
            ->assertOk()
            ->assertSee('id="gaip-morning-briefing"', false)
            ->assertSee('/legacy-assets/gaip-morning-briefing.js', false)
            ->assertSee('/legacy-assets/gilba-storage-ns.js', false);
    }

    public function test_authenticated_user_can_open_stadium_page(): void
    {
        $user = User::factory()->create();

        $this->actingAs($user)
            ->get('/stadium')
            ->assertOk()
            ->assertSee('id="gssh-hub"', false)
            ->assertSee('/legacy-assets/stadium/unified-venue-selector.js', false)
            ->assertSee('/legacy-assets/stadium-tab-ui.js', false);
    }

    public function test_authenticated_user_can_load_legacy_field_log_asset(): void
    {
        $user = User::factory()->create();

        $this->actingAs($user)
            ->get('/legacy-assets/gaip-field-log.css')
            ->assertOk();
    }
}
