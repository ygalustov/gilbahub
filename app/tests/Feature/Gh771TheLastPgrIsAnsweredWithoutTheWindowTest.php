<?php

namespace Tests\Feature;

use App\Models\Account;
use App\Models\Site;
use App\Models\SiteConfig;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

/**
 * GH-771 (queue item 3azh) - THE LAST PGR IS ANSWERED WHATEVER ITS AGE, AND THE WINDOW IS THE
 * ENGINE'S ALONE.
 *
 * `GET /api/spray-log/context` used to pick the last PGR out of the entries it had already cut twice:
 * to the last `days` (90 by default) and to 200 rows. So an application older than the window came
 * back as `lastPGR: null`, which is the same answer as a site that never had one -- measured on the
 * stand before the repair: `Test5 - NZ` had applied a PGR 103 days earlier and this endpoint said
 * `null`, byte for byte what `Federal Golf` got, whose log holds no PGR at all. The engine could then
 * never reach its own "the effect is spent" state, and the page's "No PGR application recorded" was
 * untrue for a site whose log held one.
 *
 * The 90-day window lives in the engine as `GAIP_PGR_HISTORY_WINDOW_DAYS` and is applied there, once.
 *
 * WHY THIS IS A FEATURE TEST. The live measurement reads the running stand, and a guard only a
 * browser run can see is a guard tomorrow's edit walks past -- that was GH-769's return, and this is
 * the same class of defence in the ordinary suite.
 */
class Gh771TheLastPgrIsAnsweredWithoutTheWindowTest extends TestCase
{
    use RefreshDatabase;

    public function test_an_application_older_than_the_window_is_still_named(): void
    {
        [$user, $site] = $this->siteWithLog([
            ['pgr', 104, 'Primo 250EC'],
            ['fungicide', 3, 'Azoxy 250 SC'],
        ]);

        $body = $this->actingAs($user)
            ->getJson('/api/spray-log/context?site_id='.$site->id)->assertOk()->json();
        fwrite(STDOUT, PHP_EOL.'[gh771] an application 104 days old -> lastPGR '
            .json_encode($body['lastPGR'] ?? null).PHP_EOL);

        $this->assertNotNull($body['lastPGR'], 'an application the log holds was answered as none');
        $this->assertSame('Primo 250EC', $body['lastPGR']['product_name']);
        // The window of the rest of the context is untouched: the fungicide inside it is still there.
        $this->assertNotNull($body['lastFungicide'] ?? null);
    }

    public function test_the_newest_application_is_the_one_named_and_each_one_restarts_the_count(): void
    {
        [$user, $site] = $this->siteWithLog([
            ['pgr', 104, 'Primo 250EC'],
            ['pgr', 12, 'Amigo 175'],
        ]);

        $body = $this->actingAs($user)
            ->getJson('/api/spray-log/context?site_id='.$site->id)->assertOk()->json();
        fwrite(STDOUT, '[gh771] two applications, 104 and 12 days old -> lastPGR '
            .json_encode($body['lastPGR']['product_name'] ?? null).PHP_EOL);

        $this->assertSame('Amigo 175', $body['lastPGR']['product_name']);
    }

    public function test_a_site_whose_log_holds_no_pgr_is_given_none(): void
    {
        [$user, $site] = $this->siteWithLog([['fungicide', 5, 'Azoxy 250 SC']]);

        $body = $this->actingAs($user)
            ->getJson('/api/spray-log/context?site_id='.$site->id)->assertOk()->json();
        fwrite(STDOUT, '[gh771] a log with no PGR -> lastPGR '.json_encode($body['lastPGR'] ?? null).PHP_EOL);

        $this->assertNull($body['lastPGR']);
    }

    /**
     * @param  array<int,array{0:string,1:int,2:string}>  $entries  category, days ago, product
     * @return array{0:User,1:Site}
     */
    private function siteWithLog(array $entries): array
    {
        $user = User::factory()->create();
        $account = Account::query()->create([
            'owner_user_id' => $user->id, 'display_name' => $user->name,
            'created_by_user_id' => $user->id, 'modified_by_user_id' => $user->id,
        ]);
        $site = Site::query()->create([
            'account_id' => $account->id, 'name' => 'PGR Site', 'slug' => 'pgr-site-'.$user->id,
            'site_type' => 'precinct', 'timezone' => 'UTC',
            'created_by_user_id' => $user->id, 'modified_by_user_id' => $user->id,
        ]);
        $site->users()->attach($user->id, ['role' => 'manager']);
        $user->forceFill(['last_active_site_id' => $site->id])->save();
        SiteConfig::query()->create([
            'site_id' => $site->id, 'namespace' => 'gaip', 'synced_at' => now(),
            'config' => ['turf' => ['methodology' => 'mlsn']],
        ]);
        $this->giveTheSiteWhatTheLockNeeds($site);

        foreach ($entries as [$category, $daysAgo, $product]) {
            DB::table('spray_logs')->insert([
                'account_id' => $account->id, 'site_id' => $site->id, 'user_id' => $user->id,
                'event_date' => now()->subDays($daysAgo)->toDateString(),
                'zone' => 'greens', 'product_name' => $product, 'product_type' => $category,
                'active_ingredient' => 'Trinexapac-ethyl', 'rate_value' => 0.5, 'rate_unit' => 'L/ha',
                'source' => 'manual', 'created_at' => now(), 'updated_at' => now(),
            ]);
        }

        return [$user, $site];
    }
}
