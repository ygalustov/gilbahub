<?php

namespace Tests\Feature;

use App\Models\Account;
use App\Models\Site;
use App\Models\SiteConfig;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * GH-752 (queue item 3bl, part A) — A PAGE OF THE db-shell LAYOUT CARRIES ITS SITE'S CONSTRUCTION.
 *
 * The run now takes the construction from `GAIP_HUB_CONFIG.construction` instead of a form field.
 * The app layout already put it there; the report pages, which run the engines in a hidden frame of
 * the db-shell layout, did not have it, so the run there would have had no construction at all.
 * Rendered, not read: the page's config is taken out of the HTML and its construction compared with
 * the site's.
 */
class Gh752TheShellCarriesTheSitesConstructionTest extends TestCase
{
    use RefreshDatabase;

    public function test_the_page_carries_the_construction_the_dictionary_resolved_for_its_site(): void
    {
        $user = User::factory()->create();
        $account = Account::query()->create([
            'owner_user_id' => $user->id, 'display_name' => $user->name,
            'created_by_user_id' => $user->id, 'modified_by_user_id' => $user->id,
        ]);
        $site = Site::query()->create([
            'account_id' => $account->id, 'name' => 'Shell Site', 'slug' => 'shell-site-'.$user->id,
            'site_type' => 'precinct', 'timezone' => 'UTC',
            'created_by_user_id' => $user->id, 'modified_by_user_id' => $user->id,
        ]);
        $site->users()->attach($user->id, ['role' => 'manager']);
        $user->forceFill(['last_active_site_id' => $site->id])->save();
        SiteConfig::query()->create([
            'site_id' => $site->id, 'namespace' => 'gaip', 'synced_at' => now(),
            'config' => ['turf' => ['construction' => 'sand_profile']],
        ]);
        $this->giveTheSiteWhatTheLockNeeds($site);

        $html = $this->actingAs($user)->get('/settings')->assertOk()->getContent();
        preg_match('#construction:\s*(\{.*?\}|null),?\s*\n#', $html, $m);
        fwrite(STDOUT, PHP_EOL.'[gh752] db-shell page config construction: '.($m[1] ?? 'NOT ON THE PAGE').PHP_EOL);

        $this->assertNotEmpty($m, 'the db-shell page carries no construction in its config');
        $got = json_decode($m[1], true);
        $this->assertSame('sand_profile', $got['value'] ?? null);
        $this->assertTrue($got['known'] ?? false);
    }

    /**
     * GH-752 (part D): the soil page labels its thresholds with the inputs list's word for the site's
     * methodology, which only the server can give it. A site with none gets null, not a word.
     */
    public function test_the_page_carries_the_lists_word_for_a_slan_site(): void
    {
        $this->assertSame('"SLAN"', $this->wordOnThePage('slan', ['methodology' => 'slan']));
    }

    /**
     * A site with NO methodology does not reach this page: the page lock sends it to the wizard, and
     * the lock helper fills the required fields to get past it. What does reach it is a stored value
     * the list does not declare, and for that the page carries null, not a word.
     */
    public function test_the_page_carries_null_for_a_methodology_the_list_does_not_declare(): void
    {
        $this->assertSame('null', $this->wordOnThePage('undeclared', ['methodology' => 'something_nobody_declared']));
    }

    private function wordOnThePage(string $case, array $turf): string
    {
        $got = [];
        {
            $user = User::factory()->create();
            $account = Account::query()->create([
                'owner_user_id' => $user->id, 'display_name' => $user->name,
                'created_by_user_id' => $user->id, 'modified_by_user_id' => $user->id,
            ]);
            $site = Site::query()->create([
                'account_id' => $account->id, 'name' => 'Word Site '.$case, 'slug' => 'word-site-'.$case.'-'.$user->id,
                'site_type' => 'precinct', 'timezone' => 'UTC',
                'created_by_user_id' => $user->id, 'modified_by_user_id' => $user->id,
            ]);
            $site->users()->attach($user->id, ['role' => 'manager']);
            $user->forceFill(['last_active_site_id' => $site->id])->save();
            SiteConfig::query()->create([
                'site_id' => $site->id, 'namespace' => 'gaip', 'synced_at' => now(),
                'config' => ['turf' => $turf + ['construction' => 'sand_profile']],
            ]);
            $this->giveTheSiteWhatTheLockNeeds($site);
            $html = $this->actingAs($user)->get('/settings')->assertOk()->getContent();
            preg_match('#methodologyShort:\s*(".*?"|null),?\s*\n#', $html, $m);
            $got[$case] = $m[1] ?? 'NOT ON THE PAGE';
        }
        fwrite(STDOUT, PHP_EOL.'[gh752d] db-shell methodologyShort, site '.$case.' (turf '.json_encode($turf).'): '.$got[$case].PHP_EOL);

        return $got[$case];
    }
}
