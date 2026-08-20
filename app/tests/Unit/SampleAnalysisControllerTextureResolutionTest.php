<?php

namespace Tests\Unit;

use App\Models\Account;
use App\Models\Site;
use App\Services\HillLabsSampleTypesService;
use Tests\TestCase;

/**
 * Test GH-269 — SampleAnalysisController prefers the LIVE site texture over
 * a sample's (potentially stale) soil_texture_snapshot, the same class of
 * bug GH-265 fixed for methodology.
 *
 * BUG: `soil_texture_snapshot` is frozen at sample-creation time
 * (SampleController.php's store(), `site.soil_texture_override ?:
 * account.soil_texture`). If a site's Settings "Soil texture" changes AFTER
 * a sample was saved, that sample's snapshot keeps the pre-change value
 * forever -- confirmed live: three real Russley samples (a certificate
 * Sand-rootzone site, Hill Labs 2606324, S279 Browntop) all had
 * `soil_texture_snapshot === 'loam'`, silently defeating GH-268's
 * certificate resolution (deriveCode() needs a sand-ish texture for S279).
 *
 * Unlike methodology (GH-265, where the only live signal exists client-side
 * via region auto-select — no live source was available server-side either),
 * SampleAnalysisController already has `$sample->site` in scope, so reading
 * the live `site.soil_texture_override`/`account.soil_texture` is a direct,
 * no-extra-query fix — no reason to ever prefer the frozen snapshot when the
 * live value is available.
 *
 * These tests exercise the exact resolution expression via in-memory Site/
 * Account model instances (properties + a manually-attached `account`
 * relation, no DB query) rather than the full run() HTTP flow, since this
 * repo's RefreshDatabase-based Feature tests currently fail on an unrelated,
 * pre-existing SQLite migration issue (GH-261) -- the resolution logic
 * itself doesn't need a real database to verify.
 */
class SampleAnalysisControllerTextureResolutionTest extends TestCase
{
    private function resolve(?string $siteOverride, ?string $accountTexture, ?string $snapshotFallback): string
    {
        $account = new Account(['soil_texture' => $accountTexture]);
        $site = new Site(['soil_texture_override' => $siteOverride]);
        $site->setRelation('account', $account);

        // Same expression as SampleAnalysisController::run() (GH-269).
        return HillLabsSampleTypesService::resolveSoilTexture(
            $site->soil_texture_override,
            $site->account?->soil_texture
        ) ?? $snapshotFallback ?? 'sands';
    }

    public function test_live_site_override_wins_over_a_stale_snapshot(): void
    {
        // The real Russley scenario: site is genuinely set to Sand now, but
        // the sample's frozen snapshot still says 'loam' from before the change.
        $this->assertSame('sand', $this->resolve('sand', 'loam', 'loam'));
    }

    public function test_falls_back_to_account_texture_when_site_override_is_unset(): void
    {
        $this->assertSame('loam', $this->resolve(null, 'loam', 'sand'));
    }

    public function test_falls_back_to_the_snapshot_only_when_neither_live_value_is_set(): void
    {
        $this->assertSame('sand', $this->resolve(null, null, 'sand'));
    }

    public function test_falls_back_to_the_sands_default_when_nothing_is_set_at_all(): void
    {
        $this->assertSame('sands', $this->resolve(null, null, null));
    }
}
