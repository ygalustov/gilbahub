<?php

namespace Tests\Feature;

use App\Models\Account;
use App\Models\Site;
use App\Models\SiteConfig;
use App\Models\User;
use App\Support\CalculationInputs;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * GH-769 (queue item 3vs) - THE CONSTRUCTIONS A PERSON IS OFFERED, AND THE ONE A SITE ALREADY HOLDS.
 *
 * TWO SUBJECTS, ONE FILE, AND THEY FAIL SEPARATELY.
 *
 * 1. WHAT IS OFFERED IS ONE LIST. The setup wizard offered all eleven declared constructions while
 *    the Settings form offered five of its own, so a person could choose in the wizard what Settings
 *    could not show. The five are now the `offered` mark on the declared values, read by
 *    `CalculationInputs::constructionChoices()` alone; both surfaces take it. The identifiers of both
 *    are compared with EACH OTHER and with the owner's five written out below, because two surfaces
 *    that drift together agree with each other and with nothing else.
 *
 * 2. A STORED VALUE IS SHOWN. A site may hold one of the six that are not offered -- the wizard
 *    offered them until this work -- and Settings rendered such a site's field EMPTY, with
 *    "- select -", while the database held `push_up`. That is what the report "the construction did
 *    not save" was read from: the value was saved and the form could not show it. Nothing is
 *    substituted; the stored value is printed with the label the list declares, and it is not offered
 *    for a new choice.
 *
 * WHY THIS IS A FEATURE TEST AND NOT ONLY THE LIVE ONE. The repair was guarded by a browser test
 * behind two environment flags, so removing it left the ordinary suite green -- measured: four suites
 * that render `/settings` passed at 18 tests and 90 assertions with the repair taken out, and no PHP
 * test named GH-769 at all. A defence that only a live run can see is a defence that tomorrow's edit
 * walks past.
 */
class Gh769ConstructionChoicesTest extends TestCase
{
    use RefreshDatabase;

    /**
     * The owner's decision of 25.09.2026, written out rather than read from the list: the five the
     * Settings form already offered, and no others. An external anchor, as `gh744` keeps one.
     */
    private const OFFERED = ['sand_carpet', 'sand_profile', 'pipe_drained', 'soil', 'hybrid'];

    public function test_the_single_reader_offers_exactly_the_five_the_owner_named(): void
    {
        $choices = CalculationInputs::constructionChoices();
        fwrite(STDOUT, PHP_EOL.'[gh769] constructionChoices(): '.json_encode($choices).PHP_EOL);

        // The list of identifiers, not how many: five of the wrong five would count the same.
        $this->assertSame(self::OFFERED, array_keys($choices));
        foreach ($choices as $id => $label) {
            $this->assertNotSame('', (string) $label, $id.' is offered without a label');
        }
    }

    public function test_settings_and_the_wizard_offer_the_same_list_and_it_is_that_one(): void
    {
        [$user] = $this->siteWith('sand_profile');
        $html = $this->actingAs($user)->get('/settings')->assertOk()->getContent();
        [$onSettings, $alsoOnSettings] = $this->constructionOptions($html);
        $setup = $this->actingAs($user)->get('/dashboard')->assertOk()->viewData('setup');
        $inWizard = array_column($setup['constructionValues'] ?? [], 'id');

        fwrite(STDOUT, '[gh769] Settings offers: '.json_encode($onSettings).PHP_EOL
            .'[gh769] the wizard is handed: '.json_encode($inWizard).PHP_EOL);

        $this->assertSame(self::OFFERED, $onSettings, 'Settings offers something else');
        // And nothing beyond them, since this site's stored value is one of the five.
        $this->assertSame([], $alsoOnSettings, 'Settings offers a value the owner did not name');
        $this->assertSame(self::OFFERED, $inWizard, 'the wizard is handed something else');
    }

    public function test_a_site_holding_a_construction_that_is_not_offered_still_sees_it(): void
    {
        [$user] = $this->siteWith('push_up');
        $html = $this->actingAs($user)->get('/settings')->assertOk()->getContent();
        $selected = $this->selectedConstruction($html);
        [$offered, $alsoShown] = $this->constructionOptions($html);

        fwrite(STDOUT, '[gh769] a site holding `push_up`: the field shows '.json_encode($selected)
            .', and the choices offered are '.json_encode($offered).PHP_EOL);

        $this->assertSame(['push_up', 'Push-up native'], $selected);
        // It is shown, not offered: the five a person may choose do not change, and the only value
        // beyond them is the one this site holds.
        $this->assertSame(self::OFFERED, $offered);
        $this->assertSame(['push_up'], $alsoShown);
    }

    /**
     * The values a person may CHOOSE, in order, without the placeholder.
     *
     * A site's stored value is rendered as an extra option when the list does not offer it, so it has
     * to be told apart from the choices. `selected` cannot do it -- a stored value that IS offered is
     * marked selected too, and the first draft of this helper dropped `sand_profile` for that reason.
     * The owner's five, written out above, are the discriminator, and anything else the page offers is
     * returned separately rather than filtered into silence.
     *
     * @return array{0:array<int,string>,1:array<int,string>} the offered ones, and everything else
     */
    private function constructionOptions(string $html): array
    {
        preg_match('#<select id="stg-turf-construction"[^>]*>(.*?)</select>#s', $html, $m);
        $this->assertNotEmpty($m, 'the construction chooser is not on the page');
        preg_match_all('#<option value="([^"]*)"#s', $m[1], $o);
        $offered = [];
        $other = [];
        foreach ($o[1] as $value) {
            if ($value === '') {
                continue;
            }
            if (in_array($value, self::OFFERED, true)) {
                $offered[] = $value;
            } else {
                $other[] = $value;
            }
        }

        return [$offered, $other];
    }

    /** @return array{0:string,1:string}|null the value and label the field shows as chosen */
    private function selectedConstruction(string $html): ?array
    {
        preg_match('#<select id="stg-turf-construction"[^>]*>(.*?)</select>#s', $html, $m);
        $this->assertNotEmpty($m, 'the construction chooser is not on the page');
        if (! preg_match('#<option value="([^"]*)"[^>]*selected[^>]*>(.*?)</option>#s', $m[1], $s)) {
            return null;
        }

        return [$s[1], html_entity_decode(trim($s[2]), ENT_QUOTES)];
    }

    /** @return array{0:User,1:Site} */
    private function siteWith(string $construction): array
    {
        $user = User::factory()->create();
        $account = Account::query()->create([
            'owner_user_id' => $user->id, 'display_name' => $user->name,
            'created_by_user_id' => $user->id, 'modified_by_user_id' => $user->id,
        ]);
        $site = Site::query()->create([
            'account_id' => $account->id, 'name' => 'Construction Site',
            'slug' => 'construction-site-'.$user->id, 'site_type' => 'precinct', 'timezone' => 'UTC',
            'created_by_user_id' => $user->id, 'modified_by_user_id' => $user->id,
        ]);
        $site->users()->attach($user->id, ['role' => 'manager']);
        $user->forceFill(['last_active_site_id' => $site->id])->save();
        SiteConfig::query()->create([
            'site_id' => $site->id, 'namespace' => 'gaip', 'synced_at' => now(),
            'config' => ['turf' => ['methodology' => 'mlsn', 'construction' => $construction]],
        ]);
        $this->giveTheSiteWhatTheLockNeeds($site);

        return [$user, $site];
    }
}
