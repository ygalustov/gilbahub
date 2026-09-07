<?php

namespace Tests\Feature;

use App\Models\Account;
use App\Models\Site;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * GH-357 — the Export Centre (/reports/export) never had GH-294's
 * soil_texture pass-through at all, unlike the Plan page.
 *
 * Background: confirmed live (Test5-NZ, Perennial Ryegrass/AA/Sand, real DB
 * data cross-checked via direct docker exec query and a real Combined Word
 * export) that word-export.js's _aaRanges IIFE (GH-352/353/355) always saw
 * window.GAIP_HUB_CONFIG.soilTexture as undefined on this specific page --
 * that fallback has worked correctly on the Plan page since GH-294, but
 * ReportsController::pageData() never computed $soilTexture and
 * reports/export.blade.php never had a @section('head') augmenting
 * GAIP_HUB_CONFIG with it at all. Without a real texture,
 * HillLabsSampleTypes.deriveCode() always fell back to the generic
 * sands/others range instead of the site's real S277/S279/S81 certificate
 * range -- confirmed the derived code stayed null and the resolved ranges
 * were the generic ones, even though the exact same site correctly resolves
 * S277 on the Plan page.
 *
 * Fix: same site-override-then-account-fallback chain PageController
 * already exposes (GH-294), now also computed in ReportsController::pageData()
 * and threaded into GAIP_HUB_CONFIG.soilTexture by export.blade.php's own
 * head section, mirroring plan.blade.php's pattern exactly.
 */
class ReportsExportSoilTextureTest extends TestCase
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

        $site->users()->attach($user->id, ['role' => 'owner']);

        return $site;
    }

    public function test_export_view_receives_soil_texture_from_site_override(): void
    {
        $user = User::factory()->create();
        $site = $this->createSiteForUser($user, ['soil_texture_override' => 'sand']);
        $user->forceFill(['last_active_site_id' => $site->id])->save();

        $this->actingAs($user)
            ->get('/reports/export')
            ->assertOk()
            ->assertViewHas('soilTexture', 'sand');
    }

    public function test_export_view_falls_back_to_account_soil_texture_when_site_override_is_null(): void
    {
        $user = User::factory()->create();
        $site = $this->createSiteForUser($user, [
            'soil_texture_override' => null,
            '_account_soil_texture' => 'loam',
        ]);
        $user->forceFill(['last_active_site_id' => $site->id])->save();

        $this->actingAs($user)
            ->get('/reports/export')
            ->assertOk()
            ->assertViewHas('soilTexture', 'loam');
    }

    public function test_export_view_soil_texture_is_null_when_neither_site_nor_account_has_it(): void
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
            ->get('/reports/export')
            ->assertOk()
            ->assertViewHas('soilTexture', null);
    }

    public function test_export_blade_head_section_threads_soilTexture_into_GAIP_HUB_CONFIG(): void
    {
        $user = User::factory()->create();
        $site = $this->createSiteForUser($user, ['soil_texture_override' => 'sand']);
        $user->forceFill(['last_active_site_id' => $site->id])->save();

        $response = $this->actingAs($user)->get('/reports/export');
        $response->assertOk();
        $response->assertSee('soilTexture: ' . json_encode('sand') . ',', false);
    }
}
