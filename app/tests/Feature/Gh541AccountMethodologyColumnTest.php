<?php

namespace Tests\Feature;

use App\Http\Controllers\AccountController;
use App\Models\Account;
use App\Models\Site;
use App\Models\SiteConfig;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * GH-541 — the Account site list shows each site's OWN methodology.
 *
 * WHY THIS SCREEN GETS A TEST AND NOT JUST A COLUMN. The owner asked for it as
 * a checking place — "where I look to see what is set where". A column that is
 * merely decorative can be wrong and cost nothing; a column people come to in
 * order to find out what is set cannot.
 *
 * THE FAILURE IT IS BUILT AGAINST. `AccountController::show()` already resolves
 * `$turfMethodology`, for the ACTIVE site. `buildSitesTableData()` builds one
 * row per site. Reaching for the first from the second would print the active
 * site's setting under every other site's name — GH-459's shape exactly, one
 * object's data beside another object's label. So the test uses TWO sites with
 * DIFFERENT methodologies and asserts each row carries its own: one site cannot
 * tell the two readings apart, because with one site they agree.
 *
 * `sites.methodology_override` is deliberately not touched. It is empty on
 * every live site and on its way out; CLAUDE.md records that an empty override
 * column is the expected state and not a defect.
 */
class Gh541AccountMethodologyColumnTest extends TestCase
{
    use RefreshDatabase;

    public function test_each_row_carries_its_own_sites_methodology(): void
    {
        $user = User::factory()->create();
        $account = $this->accountFor($user);

        $mlsn = $this->siteWith($user, $account, 'Site MLSN', 'site-mlsn', ['methodology' => 'mlsn', 'species' => 'bentgrass']);
        $aa   = $this->siteWith($user, $account, 'Site AA', 'site-aa', ['methodology' => 'ammonium_acetate', 'species' => 'browntop']);
        $none = $this->siteWith($user, $account, 'Site none', 'site-none', ['species' => 'kikuyu']);

        // The ACTIVE site is the MLSN one on purpose: if the builder reached for
        // the active site's resolved value, every row below would read MLSN and
        // the two assertions after the first would fail.
        $user->forceFill(['last_active_site_id' => $mlsn->id])->save();

        $rows = collect($this->actingAs($user)->get('/account')->assertOk()->viewData('sitesTableData'));

        $by = $rows->keyBy('name');
        $this->assertCount(3, $by, 'the three sites did not all reach the table');

        $this->assertSame('MLSN', $by['Site MLSN']['methodology']);
        $this->assertSame('Ammonium Acetate', $by['Site AA']['methodology']);
        // Null stays null: the row prints "methodology not set" and nothing is
        // substituted. `mlsn` here would be the defect, not a default.
        $this->assertNull($by['Site none']['methodology']);
    }

    public function test_the_labels_come_from_the_settings_form_and_cover_every_key_it_offers(): void
    {
        // The words are the Settings select's own, shortened for a table cell.
        // This reads that select's list out of the blade and asserts the column
        // has a label for every key it offers — so a fourth methodology added
        // there and forgotten here goes red instead of printing its raw key.
        $blade = file_get_contents(resource_path('views/settings.blade.php'));
        $this->assertMatchesRegularExpression('/\$methOptions\s*=\s*\[/', $blade, 'the Settings option list has moved');

        preg_match('/\$methOptions\s*=\s*\[(.*?)\];/s', $blade, $m);
        preg_match_all("/'([a-z_]+)'\s*=>/", $m[1] ?? '', $keys);

        $offered = $keys[1] ?? [];
        $this->assertNotEmpty($offered, 'no methodology keys were read out of the Settings form');
        $this->assertContains('mlsn', $offered);
        $this->assertContains('ammonium_acetate', $offered);

        foreach ($offered as $key) {
            $label = AccountController::methodologyLabel($key);
            $this->assertNotNull($label, $key.' has no column label');
            $this->assertNotSame($key, $label,
                $key.' falls through to its raw storage key. The column would print '
                .'"'.$key.'" where the Settings form says something a person can read.');
        }
    }

    public function test_an_empty_or_missing_value_is_never_substituted(): void
    {
        $this->assertNull(AccountController::methodologyLabel(null));
        $this->assertNull(AccountController::methodologyLabel(''));
        // An unknown key is shown as it is rather than hidden or defaulted.
        $this->assertSame('something_else', AccountController::methodologyLabel('something_else'));
    }

    private function accountFor(User $user): Account
    {
        return Account::query()->firstOrCreate(
            ['owner_user_id' => $user->id],
            ['display_name' => $user->name, 'created_by_user_id' => $user->id, 'modified_by_user_id' => $user->id]
        );
    }

    private function siteWith(User $user, Account $account, string $name, string $slug, array $turf): Site
    {
        $site = Site::query()->create([
            'account_id' => $account->id, 'name' => $name, 'slug' => $slug, 'site_type' => 'precinct',
            'created_by_user_id' => $user->id, 'modified_by_user_id' => $user->id,
        ]);
        $site->users()->attach($user->id, ['role' => 'manager']);

        SiteConfig::query()->create([
            'site_id' => $site->id, 'namespace' => 'gaip', 'config' => ['turf' => $turf],
        ]);

        return $site;
    }
}
