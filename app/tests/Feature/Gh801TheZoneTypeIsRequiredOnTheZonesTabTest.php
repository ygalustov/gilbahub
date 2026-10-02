<?php

namespace Tests\Feature;

use App\Models\Account;
use App\Models\Sample;
use App\Models\Site;
use App\Models\User;
use App\Models\Zone;
use App\Services\ZoneService;
use App\Support\CalculationInputs;
use App\Support\ZoneTypes;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * GH-801 (queue item "Zones", stage C2) — THE ZONES TAB ASKS FOR A TYPE, AND SAVES NOTHING UNTIL IT HAS
 * ONE FOR EVERY ZONE.
 *
 * GH-804 (part 1): WHERE THE OBLIGATION IS DECLARED CHANGED, AND NOTHING ELSE DID. It was a block of its
 * own in `assets/zone-types.json`; it is the input `zones.zoneType` of the inputs list now, read through
 * `CalculationInputs`. These cases ask the new reader and expect exactly what they expected before —
 * which is the point of the move, and what the positive control beside it measures on 24 live sites.
 *
 * THE OWNER'S DECISION OF 01.10.2026, in her words, is the variant (b) she picked after being shown its
 * price: "the tab saves nothing while the site has even one zone with no type". The price was named to
 * her in numbers — 73 zones on 13 sites of the stand to fill in by hand, and the tab closed on every one
 * of them until she does — and her answer was "a type is required of all of them, as we agreed. Doing it
 * by hand is fine, this is not a problem."
 *
 * WHAT MUST NOT HAPPEN, and it is the first case below: a door that refuses every change while any zone
 * is untyped would refuse THE SAVE THAT FILLS THE TYPES IN, and the obligation would have no way out.
 * The way out is that a save is judged by the set of zones the site is LEFT with, so one save that gives
 * every zone a type is accepted however many were untyped before it.
 *
 * AND THE ADD WINDOW IS NOT TOUCHED — her words, "we do not change the add interface". A sample saved
 * from the Data page or arriving from an import still brings its zone into being with no type and is
 * refused nothing; the tab then names that zone, which is why the refusal has to list the zones and not
 * only the field: they may be zones the person never touched.
 *
 * WHERE THE EXPECTATIONS COME FROM. The twelve types and the words of the obligation are read from the
 * declaration (`assets/zone-types.json` through `ZoneTypes`), and the zone names a refusal lists are read
 * from the fixture's own zones. Nothing here is a list typed out beside the test: a dictionary written
 * out by hand would agree with itself while disagreeing with the product, and a name typed out by hand
 * would make a case about the refusal pass because of a word in two places.
 *
 * WHAT IS NOT HERE, said rather than left to be noticed: the ROWS of the tab are drawn by the browser
 * from what the server hands the page, so what this file can assert about the screen is that the zones,
 * the dictionary and the obligation travel to it. That each row carries its `Required` note, and that the
 * refusal's sentence reaches a person's eyes, is a live case (`GH-801` delivery, the stand run).
 */
class Gh801TheZoneTypeIsRequiredOnTheZonesTabTest extends TestCase
{
    use RefreshDatabase;

    /** The site of the live case: sixteen zones, none of them typed. */
    private const SIXTEEN = [
        'Green 1', 'Green 2', 'Green 3', 'Green 4', 'Green 5', 'Green 6', 'Green 7', 'Green 8',
        'Fairway 1', 'Fairway 2', 'Tee 1', 'Tee 2', 'Rough west', 'Approach 9', 'Practice', 'test',
    ];

    public function test_a_save_is_refused_while_one_zone_has_no_type_and_nothing_is_written(): void
    {
        [$user, $site] = $this->aSiteWithZones(self::SIXTEEN);
        $before = $this->zonesOf($site);

        // The change a person tries to make: a new zone, properly typed. It is not what is wrong.
        $answer = $this->saveZones($user, $site, [
            'created' => [['name' => 'Green 99', 'zoneType' => ZoneTypes::zoneTypeKeys()[0]]],
        ]);

        $after = $this->zonesOf($site);
        fwrite(STDOUT, '[gh801] the refusal: '.$answer->status().' '.json_encode($answer->json('message'))
            .PHP_EOL.'[gh801] the zones it names: '.json_encode(array_column($answer->json('missing') ?? [], 'zone'))
            .PHP_EOL.'[gh801] the zones of the site before: '.json_encode($before)
            .PHP_EOL.'[gh801] and after: '.json_encode($after)
            .PHP_EOL.'[gh801] the site\'s own list of names after: '
            .json_encode($site->fresh()->attributes_json['zones'] ?? null).PHP_EOL);

        $answer->assertStatus(422);
        /**
         * Every untyped zone is named, in the order the tab shows them. The expectation is the order the
         * DATABASE gives, read above, rather than the order of the constant: renaming a zone in this
         * fixture must leave the case green, because a case that reddened on it would be one comparing a
         * list of names with another list of names typed out beside it.
         */
        $names = array_keys($before);
        $this->assertSame($names, array_column($answer->json('missing'), 'zone'));
        $this->assertSame(
            'Not saved: fill in '.CalculationInputs::zoneTypeLabel().' for '
                .implode(', ', array_slice($names, 0, -1)).' and '.end($names).'.',
            $answer->json('message')
        );
        // NOTHING WAS WRITTEN: the perechen of zones and their types, not its length, and the site's own
        // list of names with it.
        $this->assertSame($before, $after);
        $this->assertSame(self::SIXTEEN, $site->fresh()->attributes_json['zones'] ?? null);
        // The universe is real: sixteen zones, every one of them untyped before the save.
        $this->assertSame(16, count($before));
        $this->assertSame([null], array_values(array_unique($before)));
    }

    /**
     * THE DEAD END THE PLAN NAMES, as a case: the save that gives every zone a type is accepted, however
     * many zones were untyped before it. An implementation that judged each change on its own — "refuse
     * while anything is untyped" — fails here, and that is the point of the case.
     */
    public function test_one_save_that_types_every_zone_is_accepted_and_the_next_change_goes_through(): void
    {
        [$user, $site] = $this->aSiteWithZones(self::SIXTEEN);
        $type = ZoneTypes::zoneTypeKeys()[0];

        // Her own path out, in one save: a type for every zone, the spare one deleted, a new one added.
        // A row the tab has deleted is not in the list it shows, so no type travels for it.
        $spare = Zone::query()->where('site_id', $site->id)->where('name', 'test')->firstOrFail();
        $typed = Zone::query()->where('site_id', $site->id)->whereKeyNot($spare->id)
            ->orderBy('created_at')->orderBy('name')
            ->get()->map(fn (Zone $zone) => ['id' => $zone->id, 'zoneType' => $type])->all();
        $answer = $this->saveZones($user, $site, [
            'typed' => $typed,
            'deleted' => [$spare->id],
            'created' => [['name' => 'Green 99', 'zoneType' => $type]],
        ]);

        $afterTheWayOut = $this->zonesOf($site);
        $second = $this->saveZones($user, $site, [
            'created' => [['name' => 'Green 100', 'zoneType' => $type]],
        ]);

        fwrite(STDOUT, '[gh801] the save that fills the types in: '.$answer->status()
            .PHP_EOL.'[gh801] the zones it left: '.json_encode($afterTheWayOut)
            .PHP_EOL.'[gh801] the change after it: '.$second->status()
            .' '.json_encode($second->json('message'))
            .PHP_EOL.'[gh801] untyped zones left: '
            .json_encode(Zone::query()->where('site_id', $site->id)->whereNull('zone_type')->pluck('name')->all()).PHP_EOL);

        $answer->assertStatus(200);
        $second->assertStatus(200);
        /**
         * The perechen: the fifteen that were kept plus the new one, and the type of every one of them.
         * Compared as a sorted list of names rather than in the order the rows come back, because the
         * order is the tab's business and not what this case is about.
         */
        $expected = array_values(array_diff(self::SIXTEEN, ['test']));
        $expected[] = 'Green 99';
        sort($expected);
        $actual = array_keys($afterTheWayOut);
        sort($actual);
        $this->assertSame($expected, $actual);
        $this->assertSame([$type], array_values(array_unique($afterTheWayOut)));
        $this->assertSame([], Zone::query()->where('site_id', $site->id)->whereNull('zone_type')->pluck('name')->all());
    }

    /**
     * HER DECISION ABOUT THE ADD WINDOW, as a case: the Data page is not judged by this obligation, and
     * the tab then names the zone it made. Both halves in one case, because either alone would pass on a
     * stage that had got the other wrong.
     */
    public function test_the_data_page_still_makes_a_zone_with_no_type_and_the_tab_then_names_it(): void
    {
        [$user, $site] = $this->aSiteWithZones(['Green 1']);
        $type = ZoneTypes::zoneTypeKeys()[0];
        $this->saveZones($user, $site, [
            'typed' => [['id' => Zone::query()->where('site_id', $site->id)->value('id'), 'zoneType' => $type]],
        ])->assertStatus(200);

        // The add window: a sample for a zone the site does not have yet.
        $saved = $this->actingAs($user)->withSession(['_token' => 't'])->postJson('/api/samples', [
            '_token' => 't',
            'site_id' => $site->id,
            'sample_type' => 'soil',
            'payload' => ['_label' => 'Green 100', 'K' => 120],
        ]);

        $made = Zone::query()->where('site_id', $site->id)->where('name', 'Green 100')->first();
        $then = $this->saveZones($user, $site, [
            'created' => [['name' => 'Green 101', 'zoneType' => $type]],
        ]);

        fwrite(STDOUT, '[gh801] the sample the Data page saved: '.$saved->status()
            .PHP_EOL.'[gh801] the zone it made: '.json_encode($made ? [$made->name, $made->zone_type] : null)
            .PHP_EOL.'[gh801] the tab afterwards: '.$then->status().' '.json_encode($then->json('message')).PHP_EOL);

        // Not refused, and the zone exists with no type: `ZoneTypes::typeIsRequiredIn` answers false for
        // the place the add window saves through, which is the declaration carrying her decision.
        $saved->assertStatus(201);
        $this->assertNotNull($made);
        $this->assertNull($made->zone_type);
        $this->assertFalse(CalculationInputs::zoneTypeIsRequiredIn('data.addSample'));
        // And the tab is now closed over a zone the person never touched, named in the refusal.
        $then->assertStatus(422);
        $this->assertSame(['Green 100'], array_column($then->json('missing'), 'zone'));
    }

    public function test_a_site_with_no_zones_takes_a_typed_zone_and_refuses_an_untyped_one(): void
    {
        [$user, $site] = $this->aSiteWithZones([]);

        $untyped = $this->saveZones($user, $site, ['created' => [['name' => 'Green 1', 'zoneType' => '']]]);
        $afterTheRefusal = $this->zonesOf($site);
        $typed = $this->saveZones($user, $site, [
            'created' => [['name' => 'Green 1', 'zoneType' => ZoneTypes::zoneTypeKeys()[0]]],
        ]);

        fwrite(STDOUT, '[gh801] a first zone with no type: '.$untyped->status()
            .' '.json_encode($untyped->json('message'))
            .PHP_EOL.'[gh801] zones after the refusal: '.json_encode($afterTheRefusal)
            .PHP_EOL.'[gh801] the same zone with a type: '.$typed->status()
            .PHP_EOL.'[gh801] zones after it: '.json_encode($this->zonesOf($site)).PHP_EOL);

        $untyped->assertStatus(422);
        // The zone it refused is named although it does not exist yet -- it is named by the name the
        // person typed, which is all a person has to recognise it by.
        $this->assertSame(['Green 1'], array_column($untyped->json('missing'), 'zone'));
        $this->assertSame([], $afterTheRefusal);
        $typed->assertStatus(200);
        $this->assertSame(['Green 1' => ZoneTypes::zoneTypeKeys()[0]], $this->zonesOf($site));
    }

    public function test_a_type_the_dictionary_does_not_declare_never_reaches_the_column(): void
    {
        [$user, $site] = $this->aSiteWithZones([]);

        // `greens` is the old plural the spray log and `payload._zone` use. It is not a zone type.
        $answer = $this->saveZones($user, $site, ['created' => [['name' => 'Green 1', 'zoneType' => 'greens']]]);

        fwrite(STDOUT, '[gh801] an undeclared key: '.$answer->status()
            .' '.json_encode($answer->json('errors.created.0.zoneType'))
            .PHP_EOL.'[gh801] zones after it: '.json_encode($this->zonesOf($site))
            .PHP_EOL.'[gh801] what the dictionary declares: '.json_encode(ZoneTypes::zoneTypeKeys()).PHP_EOL);

        $answer->assertStatus(422);
        $this->assertSame([], $this->zonesOf($site));
        // The rule is the dictionary's: the route offers exactly the keys the file declares.
        $this->assertFalse(ZoneTypes::isZoneType('greens'));
    }

    public function test_renaming_a_zone_keeps_the_same_row_and_its_samples_and_the_list_of_names_follows(): void
    {
        [$user, $site] = $this->aSiteWithZones(['Green 1']);
        $type = ZoneTypes::zoneTypeKeys()[0];
        $zone = Zone::query()->where('site_id', $site->id)->firstOrFail();

        $this->actingAs($user)->withSession(['_token' => 't'])->postJson('/api/samples', [
            '_token' => 't', 'site_id' => $site->id, 'sample_type' => 'soil',
            'payload' => ['_label' => 'Green 1', 'K' => 120],
        ])->assertStatus(201);
        $sample = Sample::query()->where('site_id', $site->id)->firstOrFail();

        $answer = $this->saveZones($user, $site, [
            'renamed' => [['id' => $zone->id, 'name' => 'Putter Green']],
            'typed' => [['id' => $zone->id, 'zoneType' => $type]],
        ]);

        $after = Zone::query()->where('site_id', $site->id)->get();
        fwrite(STDOUT, '[gh801] the rename: '.$answer->status()
            .PHP_EOL.'[gh801] the rows after it: '.json_encode($after->map(fn ($z) => [$z->id === $zone->id ? 'same row' : 'another row', $z->name, $z->zone_type])->all())
            .PHP_EOL.'[gh801] the sample still points at it: '
            .json_encode($sample->fresh()->zone_id === $zone->id)
            .PHP_EOL.'[gh801] the site\'s own list of names: '
            .json_encode($site->fresh()->attributes_json['zones'] ?? null)
            .', and the sample\'s own label: '.json_encode($sample->fresh()->payload['_label'] ?? null).PHP_EOL);

        $answer->assertStatus(200);
        // ONE row, the same row, under the new name: a rename rather than a new zone beside the old.
        $this->assertSame(['Putter Green' => $type], $this->zonesOf($site));
        $this->assertSame([$zone->id], $after->pluck('id')->all());
        // The link the sample already had is untouched -- which is what a zone having an identity is for.
        $this->assertSame($zone->id, $sample->fresh()->zone_id);
        // THE OLD WRITE CONTINUES, and it follows the rows: the Data page's zone names come from this
        // list until stage C5, so a rename that did not reach it would leave a name no row carries.
        $this->assertSame(['Putter Green'], $site->fresh()->attributes_json['zones'] ?? null);
        // And the sample's own label is NOT rewritten: it is the name of a visit, not of the zone.
        $this->assertSame('Green 1', $sample->fresh()->payload['_label'] ?? null);
    }

    public function test_two_zones_whose_names_differ_only_in_case_are_refused_as_one(): void
    {
        [$user, $site] = $this->aSiteWithZones(['Green 1']);
        $type = ZoneTypes::zoneTypeKeys()[0];

        $answer = $this->saveZones($user, $site, [
            'typed' => [['id' => Zone::query()->where('site_id', $site->id)->value('id'), 'zoneType' => $type]],
            'created' => [['name' => 'green 1', 'zoneType' => $type]],
        ]);

        fwrite(STDOUT, '[gh801] the same name in another case: '.$answer->status()
            .' '.json_encode($answer->json('message'))
            .PHP_EOL.'[gh801] zones after it: '.json_encode($this->zonesOf($site)).PHP_EOL);

        $answer->assertStatus(422);
        // And the type the same save was setting is NOT written: all of a save or none of it.
        $this->assertSame(['Green 1' => null], $this->zonesOf($site));
    }

    public function test_a_viewer_cannot_change_the_zones(): void
    {
        [, $site] = $this->aSiteWithZones(['Green 1']);
        $viewer = User::factory()->create();
        $site->users()->attach($viewer->id, ['role' => 'viewer']);

        $answer = $this->saveZones($viewer->fresh(), $site, [
            'created' => [['name' => 'Green 2', 'zoneType' => ZoneTypes::zoneTypeKeys()[0]]],
        ]);

        fwrite(STDOUT, '[gh801] a viewer saving zones: '.$answer->status()
            .PHP_EOL.'[gh801] zones after it: '.json_encode($this->zonesOf($site)).PHP_EOL);

        $answer->assertStatus(403);
        $this->assertSame(['Green 1' => null], $this->zonesOf($site));
    }

    /**
     * WHAT REACHES THE PAGE: the zones as rows, the dictionary the select offers, and the obligation.
     * The expectations are the declaration's own, so the case cannot pass on a page that offers a list of
     * types written out somewhere by hand.
     */
    public function test_the_tab_is_handed_the_zones_the_dictionary_and_the_obligation(): void
    {
        [$user, $site] = $this->aSiteWithZones(['Green 1']);
        $user->forceFill(['last_active_site_id' => $site->id])->save();
        $this->giveTheSiteWhatTheLockNeeds($site);

        $page = $this->actingAs($user)->get('/settings');
        $page->assertOk();
        $zones = $page->viewData('siteZones');
        $types = $page->viewData('zoneTypes');
        $field = $page->viewData('zoneTypeField');
        $html = $page->getContent();
        preg_match('/id="stg-zones-form".*?stg-card-desc">(.*?)<\/div>/s', $html, $desc);
        preg_match('/id="stg-zone-type-input".*?<\/select>/s', $html, $select);
        preg_match_all('/value="([^"]*)"/', $select[0] ?? '', $options);

        fwrite(STDOUT, '[gh801] the zones the page is handed: '.json_encode($zones)
            .PHP_EOL.'[gh801] the obligation it is handed: '.json_encode($field)
            .PHP_EOL.'[gh801] the types the add select offers: '.json_encode($options[1] ?? [])
            .PHP_EOL.'[gh801] the tab\'s description: '.json_encode(trim($desc[1] ?? '')).PHP_EOL);

        // The rows, with the type as a key and no word standing in for an absent one. GH-817: and with the
        // zone's live samples and the server's sentence about them -- none here, so 0 and no sentence.
        $this->assertSame([['id' => Zone::query()->where('site_id', $site->id)->value('id'),
            'name' => 'Green 1', 'zoneType' => null, 'zoneTypeLabel' => null,
            'samples' => 0, 'removeRefusal' => null]], $zones);
        // The dictionary, from its one reader, in its declared order -- and the select offers exactly it.
        $this->assertSame(ZoneTypes::zoneTypeKeys(), array_column($types, 'id'));
        $this->assertSame(array_merge([''], ZoneTypes::zoneTypeKeys()), $options[1] ?? []);
        // The obligation as the file declares it for THIS place, words and all.
        $this->assertSame(['label' => CalculationInputs::zoneTypeLabel(), 'required' => true,
            'place' => 'Settings -> Zones'], $field);
        $this->assertTrue(CalculationInputs::zoneTypeIsJudgedOnTheResult());
        /**
         * AND THE WORD "spray" IS GONE FROM THE DESCRIPTION. The tab promised that these names are used
         * "when logging soil, tissue, and spray data", and the spray log does not read them at all: it
         * keeps its own zones per entry. A coordinator's decision of 01.10.2026, not the owner's word,
         * and it is her call to put it back.
         */
        $this->assertStringNotContainsStringIgnoringCase('spray', $desc[1] ?? 'spray');
    }

    /*
     * GH-818: the case that stood here asserted the old road -- the Data page's "Add zone" sending the site's
     * whole list of names, and a row made for each. That road brought a deleted zone back, so it is closed: the
     * button sends one name (`add_zone`), and a body carrying the list is refused and writes nothing. The four
     * assertions of this case moved, unchanged, onto the new road in `Gh818TheDataPageAddsOneZoneTest`
     * (`test_one_name_added_from_the_data_page_is_a_row_the_tab_names_and_the_list_carries`); the old road has
     * its own case there.
     */

    /** @return array<string,?string> the site's zones as name => type, in the order the tab shows them */
    private function zonesOf(Site $site): array
    {
        $out = [];
        foreach (Zone::query()->where('site_id', $site->id)->orderBy('created_at')->orderBy('name')->get() as $zone) {
            $out[$zone->name] = $zone->zone_type;
        }

        return $out;
    }

    private function saveZones(User $user, Site $site, array $changes)
    {
        return $this->actingAs($user)->withSession(['_token' => 't'])
            ->patchJson('/api/sites/'.$site->id.'/zones', array_merge(['_token' => 't'], $changes));
    }

    /** A site whose zones were made the way the product makes them: through the one writer. */
    private function aSiteWithZones(array $names): array
    {
        $user = User::factory()->create();
        $account = Account::query()->firstOrCreate(
            ['owner_user_id' => $user->id],
            ['display_name' => $user->name, 'created_by_user_id' => $user->id, 'modified_by_user_id' => $user->id]
        );
        $site = Site::query()->create([
            'account_id' => $account->id,
            'name' => 'GH-801 zones',
            'slug' => 'gh801-'.bin2hex(random_bytes(4)),
            'site_type' => 'golf',
            'created_by_user_id' => $user->id,
            'modified_by_user_id' => $user->id,
        ]);
        $site->users()->attach($user->id, ['role' => 'manager']);

        $service = app(ZoneService::class);
        foreach ($names as $name) {
            $service->resolveOrCreate($site, $name, $user->id);
        }
        // The site's own list of names as the transfer and the sample writes leave it, so the cases that
        // assert it follows the rows start from the state a real site is in.
        if ($names !== []) {
            $attrs = $site->attributes_json ?? [];
            $attrs['zones'] = $names;
            $site->forceFill(['attributes_json' => $attrs])->save();
        }

        return [$user->fresh(), $site->fresh()];
    }
}
