<?php

namespace Tests\Feature;

use App\Models\Account;
use App\Models\Sample;
use App\Models\Site;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * GH-722 (delivery 4, part 2) — THE SERVER'S READERS OF A SAMPLE READ IT THROUGH THE MAP.
 *
 * Three places read a sample's columns by their bare keys: the topbar's tissue N/P/K, the analysis
 * card's nutrients, Na and the EC behind ECe, and the page that gets samples from the API. Each now
 * takes its readings from `LabReadingNames::readingsOf`. The cases are the ones the move changes on
 * purpose — a sample spelled the way a lab spells it (`N_Percent`, `K_ppm`, `EC1_5`) reads here as it
 * reads in the calculation — with the plainly spelled sample beside each as the neighbour that must
 * stay as it was. That no stored sample moves is shown against the stand's own values by
 * `tests/gh722-the-readers-moved-onto-the-map-read-the-same.test.js`.
 */
class Gh722ReadersOnTheMapTest extends TestCase
{
    use RefreshDatabase;

    public function test_the_topbar_reads_tissue_spelled_the_labs_way(): void
    {
        [$user, $site] = $this->site();
        $this->sample($site, $user, 'tissue', ['N_Percent' => '4.57', 'P_Percent' => '0.62', 'K' => '1.05'], '2026-08-08');

        $tissue = $this->actingAs($user)->get('/plan')->assertOk()->viewData('tissuePercent');

        $this->assertSame([4.57, 0.62, 1.05], [$tissue['N'], $tissue['P'], $tissue['K']]);
    }

    public function test_the_analysis_card_reads_nutrients_na_and_ec_spelled_the_labs_way(): void
    {
        [$user, $site] = $this->site();
        $labs = $this->sample($site, $user, 'soil', ['K_ppm' => 120, 'P' => 30, 'Na_ppm' => 40, 'EC1_5' => 0.2], '2026-08-01');
        $plain = $this->sample($site, $user, 'soil', ['K' => 120, 'P' => 30, 'Na' => 40, 'EC' => 0.2], '2026-08-02');

        $a = $this->actingAs($user)->getJson('/api/samples/'.$labs->id.'/analyse')->assertOk()->json('data');
        $b = $this->actingAs($user)->getJson('/api/samples/'.$plain->id.'/analyse')->assertOk()->json('data');

        $k = fn ($d) => collect($d['nutrients'])->firstWhere('nutrient', 'K')['actual'];
        $this->assertSame('120', $k($a));
        $this->assertSame($k($b), $k($a));
        $this->assertSame([$b['soilNa'], $b['ECe']], [$a['soilNa'], $a['ECe']]);
        $this->assertEquals(40, $a['soilNa']);
        $this->assertNotNull($a['ECe']);
    }

    public function test_the_samples_api_hands_the_page_the_readings(): void
    {
        [$user, $site] = $this->site();
        $this->sample($site, $user, 'soil', ['K_ppm' => 120, 'CEC_meq100g' => 6.1, '_label' => 'Green 1'], '2026-08-01');

        $row = $this->actingAs($user)->getJson('/api/samples?site_id='.$site->id.'&sample_type=soil')->assertOk()->json('data.0');

        $this->assertEquals(['K' => 120, 'CEC' => 6.1], $row['readings']);
        $this->assertSame(['K_ppm' => 120, 'CEC_meq100g' => 6.1, '_label' => 'Green 1'], $row['payload']);
    }

    /** @return array{0:User,1:Site} */
    private function site(): array
    {
        $user = User::factory()->create();
        $account = Account::query()->create([
            'owner_user_id' => $user->id, 'display_name' => $user->name,
            'created_by_user_id' => $user->id, 'modified_by_user_id' => $user->id,
        ]);
        $site = Site::query()->create([
            'account_id' => $account->id, 'name' => 'Readers Site', 'slug' => 'readers-site-'.$user->id,
            'site_type' => 'precinct', 'created_by_user_id' => $user->id, 'modified_by_user_id' => $user->id,
        ]);
        $site->users()->attach($user->id, ['role' => 'manager']);
        $user->forceFill(['last_active_site_id' => $site->id])->save();
        $this->giveTheSiteWhatTheLockNeeds($site);

        return [$user, $site];
    }

    /** @param array<string,mixed> $payload */
    private function sample(Site $site, User $user, string $type, array $payload, string $date): Sample
    {
        return Sample::query()->create([
            'account_id' => $site->account_id, 'site_id' => $site->id, 'sample_type' => $type,
            'lab_name' => 'Hill Labs', 'lab_ref' => '', 'sample_date' => $date, 'lab_date' => $date,
            'payload' => $payload, 'created_by_user_id' => $user->id, 'modified_by_user_id' => $user->id,
        ]);
    }
}
