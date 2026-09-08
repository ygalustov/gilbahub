<?php

namespace Tests\Feature;

use App\Models\Account;
use App\Models\Site;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * GH-294 — the Plan page's GAIP_STATE bridge now carries the site's real
 * soil texture, so the K Reconciliation preview's AA certificate lookup
 * (deriveCode(), GH-291) has real data to work with instead of always
 * seeing an empty string.
 *
 * Background: confirmed live (Test5-NZ, Perennial Ryegrass/AA/Sand — a site
 * that resolves to the S277 certificate correctly on the Soil page) that
 * the Plan page's K Reconciliation preview showed the generic "others"
 * fallback floor (100ppm) instead of S277's real 78.2ppm floor. Root cause:
 * `soil_texture_override` lives on the Site model, not inside the gaip
 * JSON config blob (`SiteConfig` with namespace 'gaip') that
 * PageController::topbarData() and plan.blade.php's GAIP_STATE bridge read
 * soil data from -- so the bridge's `si.soil` object never carried a
 * `soilTexture` field at all, regardless of what the site's real setting
 * was. deriveCode(species, '') reads an empty texture as "not sand" and
 * silently falls back to the generic sands/others range.
 *
 * Fix: PageController::topbarData() now resolves `$soilTexture` from
 * `$activeSite->soil_texture_override` (falling back to
 * `$activeSite->account->soil_texture`, same chain already established at
 * SampleController.php:374 / HillLabsSampleTypes.resolveSoilTexture()) and
 * passes it to the view; plan.blade.php's bridge threads it into
 * `state.inputs.soil.soilTexture`.
 */
class PlanPageSoilTextureTest extends TestCase
{
    use RefreshDatabase;

    private function createAccountForUser(User $user, array $overrides = []): Account
    {
        return Account::query()->create(array_merge([
            'owner_user_id' => $user->id,
            'display_name' => $user->name,
            'created_by_user_id' => $user->id,
            'modified_by_user_id' => $user->id,
        ], $overrides));
    }

    private function createSiteForUser(User $user, array $overrides = []): Site
    {
        // Only pass soil_texture through when an override is actually given --
        // accounts.soil_texture is NOT NULL with a schema default ('loam');
        // that default only applies when the column is omitted from the
        // insert, not when explicitly set to null.
        $account = $this->createAccountForUser(
            $user,
            array_key_exists('_account_soil_texture', $overrides)
                ? ['soil_texture' => $overrides['_account_soil_texture']]
                : []
        );
        unset($overrides['_account_soil_texture']);

        $site = Site::query()->create(array_merge([
            'account_id' => $account->id,
            'name' => 'Site '.substr((string) $user->id, -4),
            'slug' => 'site-'.substr((string) $user->id, -4),
            'site_type' => 'precinct',
            'created_by_user_id' => $user->id,
            'modified_by_user_id' => $user->id,
        ], $overrides));

        // GH-365: 'owner' was retired as a site_user.role value by the RBAC
        // migration (see GH-359); User::canEditSite()/canManageSite() do not
        // recognise it, so a helper attaching it makes any permission-gated
        // route in this test 403 for the site's own user.
        $site->users()->attach($user->id, ['role' => 'manager']);

        return $site;
    }

    public function test_plan_view_receives_soil_texture_from_site_override(): void
    {
        $user = User::factory()->create();
        $site = $this->createSiteForUser($user, ['soil_texture_override' => 'sand']);
        $user->forceFill(['last_active_site_id' => $site->id])->save();

        $this->actingAs($user)
            ->get('/plan')
            ->assertOk()
            ->assertViewHas('soilTexture', 'sand');
    }

    public function test_plan_view_falls_back_to_account_soil_texture_when_site_override_is_null(): void
    {
        $user = User::factory()->create();
        $site = $this->createSiteForUser($user, [
            'soil_texture_override' => null,
            '_account_soil_texture' => 'loam',
        ]);
        $user->forceFill(['last_active_site_id' => $site->id])->save();

        $this->actingAs($user)
            ->get('/plan')
            ->assertOk()
            ->assertViewHas('soilTexture', 'loam');
    }

    public function test_plan_view_soil_texture_is_null_when_neither_site_nor_account_has_it(): void
    {
        $user = User::factory()->create();
        // accounts.soil_texture is NOT NULL with a schema default of 'loam' --
        // there's no way for the account side to be a real null, so this
        // mirrors "no real texture set" the same way the schema allows: an
        // empty string, which the controller's `?:` chain treats as falsy
        // just like null.
        $site = $this->createSiteForUser($user, [
            'soil_texture_override' => null,
            '_account_soil_texture' => '',
        ]);
        $user->forceFill(['last_active_site_id' => $site->id])->save();

        $this->actingAs($user)
            ->get('/plan')
            ->assertOk()
            ->assertViewHas('soilTexture', null);
    }

    public function test_plan_blade_bridge_threads_soilTexture_into_state_inputs_soil(): void
    {
        $user = User::factory()->create();
        $site = $this->createSiteForUser($user, ['soil_texture_override' => 'sand']);
        $user->forceFill(['last_active_site_id' => $site->id])->save();

        $response = $this->actingAs($user)->get('/plan');
        $response->assertOk();
        $response->assertSee('soilTexture:     ' . json_encode('sand') . ',', false);
        $response->assertSee("soilTexture:  hub.soilTexture || undefined,", false);
    }
}
