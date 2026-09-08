<?php

namespace Tests\Feature;

use App\Models\Account;
use App\Models\Sample;
use App\Models\Site;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * GH-366 — the Plan page now carries the site's latest tissue analysis, so
 * computeProgram()'s GH-361 tissue gate can fire there too.
 *
 * Background: GH-361 (Hoxton audit D07a) made the P/K removal ratio come from a
 * real tissue sample instead of CONFIG.nutrientRatiosToN's generic textbook
 * constants. It reads that sample from GAIP_STATE, which the Word export
 * populates per sample -- but the Plan page's bridge only ever set
 * turf/climate/location/inputs.soil, and GAIP_SampleManager isn't loaded there,
 * so GAIP_STATE had no tissue at all and the gate silently fell back to the
 * generic ratio. Confirmed live before this fix: the export applied
 * P/N 0.136, the on-screen programme applied 0.10, on the same site and the
 * same sample -- exactly the UI-vs-export divergence the audit raises at D31.
 *
 * Fix: same server-side pass-through shape GH-294/GH-357 used for soil texture.
 * PageController::topbarData() resolves the site's most recent tissue sample
 * and plan.blade.php threads it into GAIP_HUB_CONFIG and state.inputs.tissue.
 */
class PlanPageTissuePercentTest extends TestCase
{
    use RefreshDatabase;

    private function createSiteForUser(User $user): Site
    {
        $account = Account::query()->create([
            'owner_user_id' => $user->id,
            'display_name' => $user->name,
            'created_by_user_id' => $user->id,
            'modified_by_user_id' => $user->id,
        ]);

        $site = Site::query()->create([
            'account_id' => $account->id,
            'name' => 'Tissue Site',
            'slug' => 'tissue-site-'.$user->id,
            'site_type' => 'precinct',
            'created_by_user_id' => $user->id,
            'modified_by_user_id' => $user->id,
        ]);

        // GH-365: 'owner' is a retired site_user.role value (see GH-359).
        $site->users()->attach($user->id, ['role' => 'manager']);
        $user->forceFill(['last_active_site_id' => $site->id])->save();

        return $site;
    }

    private function addTissueSample(Site $site, User $user, array $payload, string $labDate): Sample
    {
        return Sample::query()->create([
            'account_id' => $site->account_id,
            'site_id' => $site->id,
            'sample_type' => 'tissue',
            'lab_name' => 'Hill Labs',
            'lab_ref' => '',
            'sample_date' => $labDate,
            'lab_date' => $labDate,
            'payload' => $payload,
            'created_by_user_id' => $user->id,
            'modified_by_user_id' => $user->id,
        ]);
    }

    public function test_plan_view_receives_tissue_percentages_from_the_sites_tissue_sample(): void
    {
        $user = User::factory()->create();
        $site = $this->createSiteForUser($user);
        // Real values from this repo's own Test5-NZ / Soccer tissue sample.
        $sample = $this->addTissueSample($site, $user, ['N' => '4.57', 'P' => '0.62', 'K' => '1.05'], '2026-08-08');

        $response = $this->actingAs($user)->get('/plan');
        $response->assertOk();

        $tissue = $response->viewData('tissuePercent');
        $this->assertSame(4.57, $tissue['N']);
        $this->assertSame(0.62, $tissue['P']);
        $this->assertSame(1.05, $tissue['K']);
        $this->assertSame($sample->id, $tissue['sampleId']);
        $this->assertSame('2026-08-08', $tissue['sampleDate']);
    }

    public function test_plan_view_tissue_is_null_when_the_site_has_no_tissue_sample(): void
    {
        $user = User::factory()->create();
        $this->createSiteForUser($user);

        $this->actingAs($user)
            ->get('/plan')
            ->assertOk()
            ->assertViewHas('tissuePercent', null);
    }

    public function test_a_soil_sample_alone_does_not_produce_tissue_percentages(): void
    {
        $user = User::factory()->create();
        $site = $this->createSiteForUser($user);
        Sample::query()->create([
            'account_id' => $site->account_id,
            'site_id' => $site->id,
            'sample_type' => 'soil',
            'lab_name' => 'Hill Labs',
            'lab_ref' => '',
            'sample_date' => '2026-08-08',
            'lab_date' => '2026-08-08',
            'payload' => ['N' => '4.57', 'P' => '40', 'K' => '276'],
            'created_by_user_id' => $user->id,
            'modified_by_user_id' => $user->id,
        ]);

        $this->actingAs($user)
            ->get('/plan')
            ->assertOk()
            ->assertViewHas('tissuePercent', null);
    }

    public function test_the_most_recent_tissue_sample_wins(): void
    {
        $user = User::factory()->create();
        $site = $this->createSiteForUser($user);
        $this->addTissueSample($site, $user, ['N' => '3.00', 'P' => '0.30', 'K' => '2.00'], '2025-01-01');
        $newer = $this->addTissueSample($site, $user, ['N' => '4.57', 'P' => '0.62', 'K' => '1.05'], '2026-08-08');

        $tissue = $this->actingAs($user)->get('/plan')->viewData('tissuePercent');
        $this->assertSame($newer->id, $tissue['sampleId']);
        $this->assertSame(4.57, $tissue['N']);
    }

    public function test_a_missing_or_non_numeric_reading_stays_null_rather_than_becoming_zero(): void
    {
        $user = User::factory()->create();
        $site = $this->createSiteForUser($user);
        // A real zero would be a measurement; '' and a missing key are not, and
        // computeProgram()'s gate must be able to tell the difference — a 0
        // would otherwise be read as a real ratio numerator/denominator.
        $this->addTissueSample($site, $user, ['N' => '4.57', 'P' => ''], '2026-08-08');

        $tissue = $this->actingAs($user)->get('/plan')->viewData('tissuePercent');
        $this->assertSame(4.57, $tissue['N']);
        $this->assertNull($tissue['P']);
        $this->assertNull($tissue['K']);
    }

    public function test_plan_blade_threads_tissue_into_hub_config_and_state_inputs(): void
    {
        $user = User::factory()->create();
        $site = $this->createSiteForUser($user);
        $this->addTissueSample($site, $user, ['N' => '4.57', 'P' => '0.62', 'K' => '1.05'], '2026-08-08');

        $response = $this->actingAs($user)->get('/plan');
        $response->assertOk();
        // @json() inside a <script> block emits raw JSON, not HTML-escaped —
        // same shape PlanPageSoilTextureTest asserts for soilTexture.
        $response->assertSee('tissuePercent:   {"N":4.57,"P":0.62,"K":1.05', false);
        $response->assertSee('var tis = hub.tissuePercent || null;', false);
        $response->assertSee('si.tissue = Object.assign({}, si.tissue || {}, {', false);
    }

    public function test_plan_blade_does_not_emit_a_tissue_object_when_there_is_no_sample(): void
    {
        $user = User::factory()->create();
        $this->createSiteForUser($user);

        $response = $this->actingAs($user)->get('/plan');
        $response->assertOk();
        // The guard is what keeps a site with no tissue sample from arriving as
        // an all-null object the gate would still have to reject.
        $response->assertSee('tissuePercent:   null,', false);
    }
}
