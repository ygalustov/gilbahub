<?php

namespace Tests\Feature;

use App\Models\Account;
use App\Models\Site;
use App\Models\User;
use App\Support\SlanRanges;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * GH-752 (queue item 3bl, part B) - THE SERVER READS THE SLAN RANGES FROM THEIR FILE, AND A PAGE OF
 * THE db-shell LAYOUT CARRIES THEM.
 *
 * Compared with the file itself rather than with numbers written here, and rendered rather than read:
 * the ranges are taken out of the page's HTML.
 */
class Gh752TheServerReadsTheSlanRangesTest extends TestCase
{
    use RefreshDatabase;

    public function test_the_reader_answers_what_the_file_says_and_nothing_for_an_unknown_type(): void
    {
        $file = json_decode((string) file_get_contents(base_path('../assets/slan-ranges.json')), true);
        fwrite(STDOUT, PHP_EOL.'[gh752b] soil types in the file: '.json_encode(array_keys($file['bySoilType'])).PHP_EOL);

        $this->assertSame($file['bySoilType'], SlanRanges::forClient()['bySoilType']);
        $this->assertSame($file['phAdjusted'], SlanRanges::forClient()['phAdjusted']);
        $this->assertSame($file['bySoilType']['sands'], SlanRanges::forSoilType('sands'));
        $this->assertNull(SlanRanges::forSoilType('sand_profile'));
        $this->assertNull(SlanRanges::forSoilType(null));
    }

    public function test_a_db_shell_page_carries_the_ranges(): void
    {
        $user = User::factory()->create();
        $account = Account::query()->create([
            'owner_user_id' => $user->id, 'display_name' => $user->name,
            'created_by_user_id' => $user->id, 'modified_by_user_id' => $user->id,
        ]);
        $site = Site::query()->create([
            'account_id' => $account->id, 'name' => 'Ranges Site', 'slug' => 'ranges-site-'.$user->id,
            'site_type' => 'precinct', 'timezone' => 'UTC',
            'created_by_user_id' => $user->id, 'modified_by_user_id' => $user->id,
        ]);
        $site->users()->attach($user->id, ['role' => 'manager']);
        $user->forceFill(['last_active_site_id' => $site->id])->save();
        $this->giveTheSiteWhatTheLockNeeds($site);

        $html = $this->actingAs($user)->get('/settings')->assertOk()->getContent();
        preg_match('#window\.GAIP_SLAN_RANGES\s*=\s*(\{.*?\});\s*\n#', $html, $m);
        fwrite(STDOUT, '[gh752b] db-shell page ranges: '.(isset($m[1]) ? substr($m[1], 0, 120).'...' : 'NOT ON THE PAGE').PHP_EOL);

        $this->assertNotEmpty($m, 'the db-shell page carries no SLAN ranges');
        $this->assertSame(SlanRanges::forClient(), json_decode($m[1], true));
    }
}
