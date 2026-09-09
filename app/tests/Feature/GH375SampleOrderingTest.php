<?php

namespace Tests\Feature;

use App\Models\Account;
use App\Models\Sample;
use App\Models\Site;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * GH-375 (review fix 1) -- SampleController::index() sorted its response by
 * the raw, non-coalesced `lab_date` column (`orderByDesc('lab_date')
 * ->orderByDesc('id')`), while PageController::topbarData()'s own tissue-
 * sample choice (see PlanPageTissuePercentTest::test_the_most_recent_
 * tissue_sample_wins()) resolves `orderByRaw('COALESCE(lab_date,
 * sample_date) DESC')->orderByDesc('id')`. MySQL sorts NULLs last on DESC,
 * so a sample with only a `sample_date` (no `lab_date`) landed behind every
 * sample carrying any `lab_date` on the raw sort, regardless of true
 * chronological order.
 *
 * Concrete divergence this pins: two samples with the SAME effective date --
 * one via `lab_date`, the other via `sample_date` only (`lab_date` NULL) --
 * is a genuine tie. `topbarData()` breaks it on `id DESC`. Pre-fix,
 * `index()`'s raw-column sort put the null-`lab_date` sample last
 * regardless of id, disagreeing with `topbarData()` and with
 * `site-selector-ui.js`'s GH-372 client-side fallback (which trusts this
 * endpoint's array order on an exact-date tie). Fixed by sorting `index()`
 * on the same `COALESCE(lab_date, sample_date) DESC` expression
 * `topbarData()` uses, so the array order this endpoint returns,
 * `topbarData()`'s own choice, and the client-side comparison all follow
 * one rule.
 */
class GH375SampleOrderingTest extends TestCase
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
            'name' => 'GH-375 Ordering Site',
            'slug' => 'gh375-ordering-site-'.$user->id,
            'site_type' => 'precinct',
            'created_by_user_id' => $user->id,
            'modified_by_user_id' => $user->id,
        ]);

        $site->users()->attach($user->id, ['role' => 'manager']);
        $user->forceFill(['last_active_site_id' => $site->id])->save();

        return $site;
    }

    private function createSample(Site $site, User $user, string $type, ?string $labDate, ?string $sampleDate, array $payload = []): Sample
    {
        return Sample::query()->create([
            'account_id' => $site->account_id,
            'site_id' => $site->id,
            'sample_type' => $type,
            'lab_name' => 'Hill Labs',
            'lab_ref' => '',
            'sample_date' => $sampleDate,
            'lab_date' => $labDate,
            'payload' => $payload,
            'created_by_user_id' => $user->id,
            'modified_by_user_id' => $user->id,
        ]);
    }

    public function test_index_sorts_by_coalesced_date_not_raw_lab_date(): void
    {
        $user = User::factory()->create();
        $site = $this->createSiteForUser($user);

        // Only a sample_date (no lab_date), but chronologically the MOST
        // recent -- pre-fix, the raw orderByDesc('lab_date') sort would have
        // sunk this one behind every sample carrying a real lab_date, no
        // matter how old, because MySQL sorts NULLs last on DESC.
        $newestBySampleDateOnly = $this->createSample($site, $user, 'soil', null, '2026-06-01');
        $older = $this->createSample($site, $user, 'soil', '2025-01-01', '2025-01-01');

        $response = $this->actingAs($user)
            ->getJson('/api/samples?site_id='.$site->id.'&sample_type=soil')
            ->assertOk();

        $ids = collect($response->json('data'))->pluck('id')->all();
        $this->assertSame([$newestBySampleDateOnly->id, $older->id], $ids);
    }

    /**
     * The exact scenario from the review: Sample X has a real lab_date,
     * Sample Y has the SAME effective date but only via sample_date
     * (lab_date NULL) -- a genuine tie once coalesced. X is created first
     * (lower id), Y second (higher id), so the DB's own auto-increment
     * naturally reproduces "same effective date, different ids" without
     * hardcoding id values.
     */
    public function test_null_lab_date_exact_tie_breaks_on_id_desc_same_as_topbar_data(): void
    {
        $user = User::factory()->create();
        $site = $this->createSiteForUser($user);

        $sampleX = $this->createSample($site, $user, 'tissue', '2026-01-15', '2026-01-15', ['N' => '3.00', 'P' => '0.30', 'K' => '2.00']);
        $sampleY = $this->createSample($site, $user, 'tissue', null, '2026-01-15', ['N' => '4.57', 'P' => '0.62', 'K' => '1.05']);
        $this->assertGreaterThan($sampleX->id, $sampleY->id, 'Y must be the higher-id sample for this tie to be meaningful.');

        // index()'s own tie-break: Y (higher id) must sort first.
        $listResponse = $this->actingAs($user)
            ->getJson('/api/samples?site_id='.$site->id.'&sample_type=tissue')
            ->assertOk();
        $ids = collect($listResponse->json('data'))->pluck('id')->all();
        $this->assertSame([$sampleY->id, $sampleX->id], $ids, 'index() must resolve the tie the same way topbarData() does: id DESC.');

        // topbarData()'s own choice (via /plan's tissuePercent), on the exact
        // same tie, must agree with the one above -- both id DESC.
        $tissue = $this->actingAs($user)->get('/plan')->viewData('tissuePercent');
        $this->assertSame($sampleY->id, $tissue['sampleId'], 'topbarData() must pick the same sample index() now lists first.');
    }

    public function test_a_real_lab_date_still_outranks_a_more_recent_sample_date_only_entry_when_it_is_actually_later(): void
    {
        $user = User::factory()->create();
        $site = $this->createSiteForUser($user);

        $later = $this->createSample($site, $user, 'soil', '2026-08-01', '2026-07-20');
        $sampleDateOnly = $this->createSample($site, $user, 'soil', null, '2026-06-01');

        $response = $this->actingAs($user)
            ->getJson('/api/samples?site_id='.$site->id.'&sample_type=soil')
            ->assertOk();

        $ids = collect($response->json('data'))->pluck('id')->all();
        $this->assertSame([$later->id, $sampleDateOnly->id], $ids);
    }
}
