<?php

namespace Tests\Feature;

use App\Models\Account;
use App\Models\Site;
use App\Models\User;
use App\Models\Zone;
use App\Services\ZoneService;
use App\Support\ZoneTypes;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * GH-818 (queue item "Zones", the road a deleted zone came back by) — THE DATA PAGE ADDS ONE ZONE, NOT ITS LIST.
 *
 * The Data page held the site's zone names from the moment it loaded, and its "Add zone" button sent that whole
 * list plus the new name; the server made a row for every name in it. A zone deleted on the Zones tab while the
 * Data page stood open came back, with no type, the next time a zone was added there -- measured (step T-a2).
 * The class is the product's rule: send the change, not the state. The button now sends one name (`add_zone`),
 * the server makes that one row, and a body carrying the list is refused and writes nothing.
 *
 * The consequences the old case of GH-801 guarded on the old road are asserted here on the new one, one
 * assertion each: the added zone is a row with no type, the Zones tab names it in its refusal, and the name is
 * in the site's own list. That the request was accepted is their precondition, not a consequence.
 *
 * HOW A FAILURE READS: PHPUnit stops a case at its first failed assertion, so a mutation breaking two
 * consequences would name only one. Each case therefore gathers its consequences into a map keyed by what
 * each one says, prints the ones that differ by name, and compares the whole map -- every broken consequence
 * is named in the output, separately.
 */
class Gh818TheDataPageAddsOneZoneTest extends TestCase
{
    use RefreshDatabase;

    public function test_one_name_added_from_the_data_page_is_a_row_the_tab_names_and_the_list_carries(): void
    {
        [$user, $site, $type] = $this->aSiteWithATypedZone();

        $added = $this->patchSite($user, $site, ['add_zone' => 'Green 2']);
        $rows = $this->rowsOf($site);
        $tab = $this->saveZones($user, $site, ['created' => [['name' => 'Green 3', 'zoneType' => $type]]]);
        $list = $site->fresh()->attributes_json['zones'] ?? null;
        fwrite(STDOUT, '[gh818] add_zone: '.$added->status().'; rows after: '.json_encode($rows)
            .'; the tab afterwards: '.$tab->status().' '.json_encode(array_column($tab->json('missing') ?? [], 'zone'))
            .'; list of names: '.json_encode($list).PHP_EOL);

        // precondition: the request was accepted
        $added->assertStatus(200);
        $this->assertConsequences([
            // 1. the zone from the button is a row, with no type -- the whole map, so no other row came with it
            '1 the added zone is a row with no type' => ['Green 1' => $type, 'Green 2' => null],
            // 2. the Zones tab names it in its refusal
            '2 the tab refuses and names it' => [422, ['Green 2']],
            // 3. the name is in the site's own list
            '3 the name is in the site list' => ['Green 1', 'Green 2'],
        ], [
            '1 the added zone is a row with no type' => $rows,
            '2 the tab refuses and names it' => [$tab->status(), array_column($tab->json('missing') ?? [], 'zone')],
            '3 the name is in the site list' => $list,
        ]);
    }

    public function test_a_name_that_differs_only_in_case_is_the_same_zone_and_the_list_takes_no_second_copy(): void
    {
        [$user, $site, $type] = $this->aSiteWithATypedZone();
        // The list spelling the name in another case than its row, as a list written by sample saves can:
        // the row and the list are one zone, so the comparison has to be without case on the list's side too.
        $site->forceFill(['attributes_json' => array_merge($site->attributes_json ?? [], ['zones' => ['green 1']])])->save();

        $added = $this->patchSite($user, $site, ['add_zone' => 'GREEN 1']);
        $rows = $this->rowsOf($site);
        $list = $site->fresh()->attributes_json['zones'] ?? null;
        fwrite(STDOUT, '[gh818] add_zone in another case: '.$added->status().'; rows after: '.json_encode($rows)
            .'; list of names: '.json_encode($list).PHP_EOL);

        $added->assertStatus(200);
        $this->assertConsequences([
            'the same row, spelt as it was' => ['Green 1' => $type],
            'the list without a second copy' => ['green 1'],
        ], [
            'the same row, spelt as it was' => $rows,
            'the list without a second copy' => $list,
        ]);
    }

    public function test_a_body_carrying_the_list_of_names_is_refused_and_writes_nothing(): void
    {
        [$user, $site] = $this->aSiteWithATypedZone();
        $site->forceFill(['attributes_json' => array_merge($site->attributes_json ?? [], ['kept' => 'as it was'])])->save();
        $rowsBefore = $this->rowsOf($site);
        $attrsBefore = $site->fresh()->attributes_json;

        // The old road, as a page loaded before this change still sends it: its snapshot plus a new name.
        $answer = $this->patchSite($user, $site, ['attributes_json' => ['zones' => ['Green 1', 'Green X', 'Green New']]]);
        $rowsAfter = $this->rowsOf($site);
        $attrsAfter = $site->fresh()->attributes_json;
        fwrite(STDOUT, '[gh818] old road: '.$answer->status().' '.json_encode($answer->json('errors'))
            .'; rows before '.json_encode($rowsBefore).' after '.json_encode($rowsAfter)
            .'; attributes before '.json_encode($attrsBefore).' after '.json_encode($attrsAfter).PHP_EOL);

        $this->assertConsequences([
            // refused, naming the key ...
            'refused, naming the key' => [422, true],
            // ... and nothing written: the rows, the list and every other key of the attributes are as they were
            'nothing written' => ['rows' => $rowsBefore, 'attributes' => $attrsBefore],
        ], [
            'refused, naming the key' => [$answer->status(), array_key_exists('attributes_json.zones', $answer->json('errors') ?? [])],
            'nothing written' => ['rows' => $rowsAfter, 'attributes' => $attrsAfter],
        ]);
    }

    public function test_a_zone_deleted_on_the_tab_does_not_come_back_when_the_data_page_adds_one(): void
    {
        [$user, $site, $type] = $this->aSiteWithATypedZone(['Green X']);
        $x = Zone::query()->where('site_id', $site->id)->where('name', 'Green X')->firstOrFail();

        $tab = $this->saveZones($user, $site, ['deleted' => [$x->id]]);
        $add = $this->patchSite($user, $site, ['add_zone' => 'Green New']);
        $rows = $this->rowsOf($site);
        fwrite(STDOUT, '[gh818] T-a2 on the new road: tab '.$tab->status().', add '.$add->status()
            .'; rows after: '.json_encode($rows).'; list: '.json_encode($site->fresh()->attributes_json['zones'] ?? null).PHP_EOL);

        $tab->assertStatus(200);
        $add->assertStatus(200);
        $this->assertSame(['Green 1' => $type, 'Green New' => null], $rows);
    }

    /** Compares the whole map, after printing by name each consequence that differs from what is expected. */
    private function assertConsequences(array $expected, array $got): void
    {
        $differing = array_keys(array_filter($expected, fn ($want, $name) => $want !== ($got[$name] ?? null), ARRAY_FILTER_USE_BOTH));
        fwrite(STDOUT, '[gh818] consequences differing: '.json_encode($differing).PHP_EOL);
        $this->assertSame($expected, $got);
    }

    private function patchSite(User $user, Site $site, array $body)
    {
        return $this->actingAs($user)->withSession(['_token' => 't'])
            ->patchJson('/api/sites/'.$site->id, array_merge(['_token' => 't'], $body));
    }

    private function saveZones(User $user, Site $site, array $changes)
    {
        return $this->actingAs($user)->withSession(['_token' => 't'])
            ->patchJson('/api/sites/'.$site->id.'/zones', array_merge(['_token' => 't'], $changes));
    }

    /** @return array<string,?string> name => type, by name */
    private function rowsOf(Site $site): array
    {
        $out = [];
        foreach (Zone::query()->where('site_id', $site->id)->orderBy('name')->get() as $zone) {
            $out[$zone->name] = $zone->zone_type;
        }

        return $out;
    }

    /** A site with `Green 1` typed (and any extra zones typed too), its list of names the same names. */
    private function aSiteWithATypedZone(array $more = []): array
    {
        $user = User::factory()->create();
        $account = Account::query()->firstOrCreate(
            ['owner_user_id' => $user->id],
            ['display_name' => $user->name, 'created_by_user_id' => $user->id, 'modified_by_user_id' => $user->id]
        );
        $site = Site::query()->create([
            'account_id' => $account->id, 'name' => 'GH-818', 'slug' => 'gh818-'.bin2hex(random_bytes(4)),
            'site_type' => 'golf', 'created_by_user_id' => $user->id, 'modified_by_user_id' => $user->id,
        ]);
        $site->users()->attach($user->id, ['role' => 'manager']);
        $this->giveTheSiteWhatTheLockNeeds($site);
        $type = ZoneTypes::zoneTypeKeys()[0];
        $names = array_merge(['Green 1'], $more);
        foreach ($names as $name) {
            app(ZoneService::class)->resolveOrCreate($site, $name, $user->id)->forceFill(['zone_type' => $type])->save();
        }
        // Typed and listed directly rather than by a save of the tab, so that the tab's own judgement is met
        // only where a case asks for it -- its refusal is consequence 2, and a mutation of it must reach that.
        $site->forceFill(['attributes_json' => array_merge($site->attributes_json ?? [], ['zones' => $names])])->save();

        return [$user->fresh(), $site->fresh(), $type];
    }
}
