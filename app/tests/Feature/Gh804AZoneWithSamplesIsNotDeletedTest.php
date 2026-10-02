<?php

namespace Tests\Feature;

use App\Models\Account;
use App\Models\Sample;
use App\Models\Site;
use App\Models\User;
use App\Models\Zone;
use App\Services\ZoneService;
use App\Support\ZoneTypes;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * GH-804 (queue item "Zones", part 1) — A ZONE WITH SAMPLES IS NOT DELETED, AND THE REFUSAL SAYS HOW MANY.
 *
 * THE OWNER'S DECISION of 01.10.2026, in her words: "a) Forbid it: the button refuses and says how many
 * samples are linked to the zone. The samples are moved or deleted first."
 *
 * WHY, measured: the column is `nullOnDelete`, so a delete silently unlinked the zone's samples — and
 * since stage C3 that link is what a trend series, a report section and the tissue-to-soil pair are built
 * from. On the stand 38 of 73 zones carry samples, 59 in all, so one press could have unlinked any of
 * them with nothing on screen to say so.
 *
 * THE FIXTURE HAS MORE SAMPLES ON THE SITE THAN ON THE ZONE, and that is the reviewer's requirement
 * rather than an accident of writing: with one zone holding all of a site's samples, "a refusal with no
 * number" and "a refusal with somebody else's number" are the same sentence, and neither mutation would
 * be told from the other. Zone A has 2 samples and zone B has 3, so the number the refusal must print is
 * 2 and the number it must not print is 5.
 *
 * WHAT IS NOT IN THIS HAND-IN, and it matters here more than anywhere: the way OUT of this refusal is to
 * move a sample to another zone, and the Edit window on Data still replaces a sample's whole payload when
 * it saves. See the delivery note for the numbers — part 2 of this work is what makes that path safe.
 */
class Gh804AZoneWithSamplesIsNotDeletedTest extends TestCase
{
    use RefreshDatabase;

    public function test_deleting_a_zone_with_samples_is_refused_with_its_own_count_and_nothing_is_written(): void
    {
        [$user, $site, $zones] = $this->aSiteWithTwoZones();
        $before = $this->stateOf($site);

        $answer = $this->saveZones($user, $site, ['deleted' => [$zones['A']->id]]);
        $after = $this->stateOf($site);

        fwrite(STDOUT, '[gh804] the refusal: '.$answer->status().' '.json_encode($answer->json('message'))
            .PHP_EOL.'[gh804] what it names: '.json_encode($answer->json('inUse'))
            .PHP_EOL.'[gh804] the site before: '.json_encode($before)
            .PHP_EOL.'[gh804] and after: '.json_encode($after).PHP_EOL);

        $answer->assertStatus(422);
        // E1: it refuses at all. E2: it carries a number. E3: the number is THE ZONE's, not the site's.
        $this->assertSame('Not saved: Green A has 2 samples. Move or delete them first.',
            $answer->json('message'));
        $this->assertStringNotContainsString('5 samples', (string) $answer->json('message'));
        $this->assertSame([['zone' => 'Green A', 'samples' => 2]], $answer->json('inUse'));
        // Nothing was written: the zones, and the zone every sample points at.
        $this->assertSame($before, $after);
    }

    public function test_a_zone_with_no_samples_is_deleted_as_before(): void
    {
        [$user, $site, $zones] = $this->aSiteWithTwoZones();
        $empty = app(ZoneService::class)->resolveOrCreate($site, 'Practice', $user->id);
        $this->typeEveryZone($user, $site);

        $answer = $this->saveZones($user, $site, ['deleted' => [$empty->id]]);

        fwrite(STDOUT, '[gh804] deleting an empty zone: '.$answer->status()
            .PHP_EOL.'[gh804] the zones left: '.json_encode(array_keys($this->stateOf($site)['zones'])).PHP_EOL);

        $answer->assertStatus(200);
        $this->assertSame(['Green A', 'Green B'], array_keys($this->stateOf($site)['zones']));
    }

    public function test_a_save_that_deletes_an_empty_zone_and_a_used_one_is_refused_whole(): void
    {
        [$user, $site, $zones] = $this->aSiteWithTwoZones();
        $empty = app(ZoneService::class)->resolveOrCreate($site, 'Practice', $user->id);
        $this->typeEveryZone($user, $site);
        $before = $this->stateOf($site);

        $answer = $this->saveZones($user, $site, ['deleted' => [$empty->id, $zones['B']->id]]);
        $after = $this->stateOf($site);

        fwrite(STDOUT, '[gh804] a mixed save: '.$answer->status().' '.json_encode($answer->json('message'))
            .PHP_EOL.'[gh804] the zones after it: '.json_encode(array_keys($after['zones'])).PHP_EOL);

        $answer->assertStatus(422);
        $this->assertSame('Not saved: Green B has 3 samples. Move or delete them first.',
            $answer->json('message'));
        // All of a save or none of it: the empty zone is still there too.
        $this->assertSame($before, $after);
        $this->assertContains('Practice', array_keys($after['zones']));
    }

    public function test_a_zone_of_the_same_name_on_another_site_does_not_count(): void
    {
        [$user, $site, $zones] = $this->aSiteWithTwoZones();
        // Another site of the same account, with a zone of the same name and samples of its own.
        [$otherUser, $other] = $this->aSite($user);
        $theirs = app(ZoneService::class)->resolveOrCreate($other, 'Green A', $otherUser->id);
        $this->aSampleIn($other, $theirs, '2026-03-01');
        $this->typeEveryZone($otherUser, $other);

        $empty = app(ZoneService::class)->resolveOrCreate($site, 'Spare', $user->id);
        $this->typeEveryZone($user, $site);
        $answer = $this->saveZones($user, $site, ['deleted' => [$empty->id]]);

        fwrite(STDOUT, '[gh804] another site has a zone of the same name with '
            .Sample::query()->where('zone_id', $theirs->id)->count().' samples'
            .PHP_EOL.'[gh804] deleting an empty zone here: '.$answer->status().PHP_EOL);

        // The count is per ZONE ROW, so another site's "Green A" is nothing to do with this one.
        $answer->assertStatus(200);
        $this->assertSame(['Green A', 'Green B'], array_keys($this->stateOf($site)['zones']));
        $this->assertSame(1, Sample::query()->where('zone_id', $theirs->id)->count());
    }

    public function test_a_zone_whose_samples_are_in_the_bin_can_go(): void
    {
        [$user, $site, $zones] = $this->aSiteWithTwoZones();
        Sample::query()->where('zone_id', $zones['A']->id)->delete();   // soft, as the product deletes
        $this->typeEveryZone($user, $site);

        $answer = $this->saveZones($user, $site, ['deleted' => [$zones['A']->id]]);

        fwrite(STDOUT, '[gh804] its samples are deleted, live count '
            .Sample::query()->where('zone_id', $zones['A']->id)->count()
            .', deleting the zone: '.$answer->status()
            .PHP_EOL.'[gh804] the zones left: '.json_encode(array_keys($this->stateOf($site)['zones'])).PHP_EOL);

        // A sample in the bin is not a sample a person has to move, so the zone is free to go.
        $answer->assertStatus(200);
        $this->assertSame(['Green B'], array_keys($this->stateOf($site)['zones']));
    }

    /**
     * GH-804 — THE OBLIGATION MOVED HOUSE, AND NOTHING ELSE MOVED WITH IT.
     *
     * It was a block of its own in `assets/zone-types.json`; it is the input `zones.zoneType` of
     * `calculation-inputs.schema.json` now, read through `CalculationInputs`. One file for what the
     * product requires instead of two.
     */
    public function test_the_obligation_is_declared_in_the_inputs_list_and_read_from_there(): void
    {
        $field = \App\Support\CalculationInputs::zoneTypeFieldForThePage('settings.zones');

        fwrite(STDOUT, '[gh804] the obligation, from the inputs list: '.json_encode($field)
            .PHP_EOL.'[gh804] required on the Data road: '
            .json_encode(\App\Support\CalculationInputs::zoneTypeIsRequiredIn('data.addSample'))
            .PHP_EOL.'[gh804] judged on the result: '
            .json_encode(\App\Support\CalculationInputs::zoneTypeIsJudgedOnTheResult())
            .PHP_EOL.'[gh804] and the dictionary file no longer declares it: '
            .json_encode(array_values(array_diff(array_keys(ZoneTypes::all()), ['$comment', 'version'])))
            .PHP_EOL);

        $this->assertSame(['label' => 'the zone type', 'required' => true,
            'place' => 'Settings -> Zones'], $field);
        // The owner's decision about the add road, still answered by the declaration and not by a screen.
        $this->assertFalse(\App\Support\CalculationInputs::zoneTypeIsRequiredIn('data.addSample'));
        $this->assertTrue(\App\Support\CalculationInputs::zoneTypeIsJudgedOnTheResult());
        /**
         * And the dictionary carries no obligation of its own any more. `journalZoneWords` arrived with
         * stage SZh1 (GH-806) and is not one: it answers which type a WORD of the spray journal means.
         * `analysisZoneTypes` arrived with GH-816 and is not one either: it answers which zone types the
         * analysis counts in the spray journal, by the site's turf type.
         */
        $this->assertSame(['zoneTypes', 'journalZoneWords', 'analysisZoneTypes'], array_values(array_diff(
            array_keys(ZoneTypes::all()), ['$comment', 'version'])));
    }

    /**
     * A RECORD WITH NO LABEL IS AN EXCEPTION, not a word made up for it.
     *
     * `ZoneTypes::typeFieldLabel` answered `'the zone type'` when the declaration carried none — a word
     * standing where a declaration is missing, which is the shape this queue item removes. The reader
     * throws instead, and the refusal of the tab would stop rather than print an invented field name.
     */
    public function test_a_declaration_with_no_label_is_an_exception_and_not_a_substituted_word(): void
    {
        $declared = \App\Support\CalculationInputs::entry('zones.zoneType');
        fwrite(STDOUT, '[gh804] the label the list declares: '
            .json_encode($declared['label'] ?? null).PHP_EOL);

        // The record carries one, so the reader answers it...
        $this->assertSame('the zone type', \App\Support\CalculationInputs::zoneTypeLabel());
        // ...and an input with no words at all is an EXCEPTION, which is what a substituted label would
        // have hidden. Asked of the same reader the zone type goes through.
        $this->assertNull(\App\Support\CalculationInputs::label('zones.zoneTypeThatDoesNotExist'));
        $threw = null;
        try {
            \App\Support\CalculationInputs::labelOrFail('zones.zoneTypeThatDoesNotExist');
        } catch (\RuntimeException $e) {
            $threw = $e->getMessage();
        }
        fwrite(STDOUT, '[gh804] a declaration with no words: '.json_encode($threw).PHP_EOL);
        $this->assertNotNull($threw, 'an input with no label was answered with a word instead of an exception');
        $this->assertStringContainsString('has no label', (string) $threw);
    }

    /**
     * THE POSITIVE CONTROL THE REVIEWER ASKED FOR, and the plan's own words: "with `typed = 0` on 73
     * zones a site with not one type still opens the dashboard and still saves Settings".
     *
     * WHY IT IS NOT A FORMALITY. The inputs list is read by the setup lock and by the `Required` marks
     * of every Settings tab, and they ask "does THIS SITE hold it". An input of a zone answered there
     * would have read as missing on every site — 24 live ones on the stand, 73 zones, not one typed —
     * and the lock would have closed all of them over a question no wizard step asks. `scope: zone` is
     * what keeps it out of that answer, and this case is what measures it.
     */
    public function test_a_site_whose_zones_have_no_type_still_opens_its_pages_and_saves_settings(): void
    {
        [$user, $site, $zones] = $this->aSiteWithTwoZones();
        // Back to the state of the stand: zones, and not one of them typed.
        Zone::query()->where('site_id', $site->id)->update(['zone_type' => null]);
        $user->forceFill(['last_active_site_id' => $site->id])->save();
        $this->giveTheSiteWhatTheLockNeeds($site);

        $dashboard = $this->actingAs($user)->get('/dashboard');
        $settings = $this->actingAs($user)->get('/settings');
        // And a save of another tab goes through: the obligation belongs to the Zones tab alone.
        $saved = $this->actingAs($user)->withSession(['_token' => 't'])
            ->patchJson('/api/sites/'.$site->id, ['_token' => 't', 'location_name' => 'Somewhere']);

        fwrite(STDOUT, '[gh804] untyped zones on the site: '
            .Zone::query()->where('site_id', $site->id)->whereNull('zone_type')->count()
            .PHP_EOL.'[gh804] the dashboard: '.$dashboard->status()
            .', Settings: '.$settings->status().', a save of the site row: '.$saved->status()
            .PHP_EOL.'[gh804] and the required inputs of the list carry no zone input: '
            .json_encode(array_values(array_intersect(
                \App\Support\CalculationInputs::requiredFor('golf'),
                \App\Support\CalculationInputs::keysOfScope('zone'))))
            .PHP_EOL);

        $this->assertSame(2, Zone::query()->where('site_id', $site->id)->whereNull('zone_type')->count());
        $dashboard->assertStatus(200);
        $settings->assertStatus(200);
        $saved->assertStatus(200);
        // The reason, stated as the list's own answer: no input of a zone is in what a SITE must hold.
        $this->assertSame([], array_values(array_intersect(
            \App\Support\CalculationInputs::requiredFor('golf'),
            \App\Support\CalculationInputs::keysOfScope('zone'))));
        $this->assertSame(['zones.zoneType'], \App\Support\CalculationInputs::keysOfScope('zone'));
    }

    /** @return array{zones: array<string,?string>, links: array<string,?string>} */
    private function stateOf(Site $site): array
    {
        $zones = [];
        foreach (Zone::query()->where('site_id', $site->id)->orderBy('name')->get() as $zone) {
            $zones[$zone->name] = $zone->zone_type;
        }
        $links = [];
        foreach (Sample::query()->where('site_id', $site->id)->orderBy('id')->get() as $sample) {
            $links[(string) $sample->id] = $sample->zone_id;
        }

        return ['zones' => $zones, 'links' => $links];
    }

    private function saveZones(User $user, Site $site, array $changes)
    {
        return $this->actingAs($user)->withSession(['_token' => 't'])
            ->patchJson('/api/sites/'.$site->id.'/zones', array_merge(['_token' => 't'], $changes));
    }

    /** Every zone of the site gets a type, so the obligation is not what a case about deleting trips on. */
    private function typeEveryZone(User $user, Site $site): void
    {
        $typed = Zone::query()->where('site_id', $site->id)->whereNull('zone_type')->get()
            ->map(fn (Zone $z) => ['id' => $z->id, 'zoneType' => ZoneTypes::zoneTypeKeys()[0]])->all();
        if ($typed !== []) {
            $this->saveZones($user, $site, ['typed' => $typed])->assertStatus(200);
        }
    }

    /**
     * A site whose samples are NOT all in one zone: A has two and B has three, so the site has five.
     * That is what tells "no number" from "the wrong number" apart.
     */
    private function aSiteWithTwoZones(): array
    {
        [$user, $site] = $this->aSite();
        $service = app(ZoneService::class);
        $zones = [
            'A' => $service->resolveOrCreate($site, 'Green A', $user->id),
            'B' => $service->resolveOrCreate($site, 'Green B', $user->id),
        ];
        $day = 1;
        foreach (['A' => 2, 'B' => 3] as $which => $howMany) {
            for ($i = 0; $i < $howMany; $i++) {
                $this->aSampleIn($site, $zones[$which], '2026-0'.$day.'-01');
                $day++;
            }
        }
        $this->typeEveryZone($user, $site);

        return [$user->fresh(), $site->fresh(), $zones];
    }

    /**
     * A sample built through the model rather than posted: the subject here is the refusal, and a
     * distinct `lab_date` per sample is needed only because `site_summaries` is unique on (site, type,
     * date) and SQLite stores the cast differently from the stand's DATE column.
     */
    private function aSampleIn(Site $site, Zone $zone, string $labDate): Sample
    {
        return Sample::query()->create([
            'account_id' => $site->account_id,
            'site_id' => $site->id,
            'zone_id' => $zone->id,
            'sample_type' => 'soil',
            'lab_date' => $labDate,
            'payload' => ['_label' => $zone->name, 'K' => 100],
            'created_by_user_id' => $site->created_by_user_id,
            'modified_by_user_id' => $site->created_by_user_id,
        ]);
    }

    private function aSite(?User $existing = null): array
    {
        $user = $existing ?: User::factory()->create();
        $account = Account::query()->firstOrCreate(
            ['owner_user_id' => $user->id],
            ['display_name' => $user->name, 'created_by_user_id' => $user->id, 'modified_by_user_id' => $user->id]
        );
        $site = Site::query()->create([
            'account_id' => $account->id,
            'name' => 'GH-804 zones '.bin2hex(random_bytes(2)),
            'slug' => 'gh804-'.bin2hex(random_bytes(4)),
            'site_type' => 'golf',
            'created_by_user_id' => $user->id,
            'modified_by_user_id' => $user->id,
        ]);
        $site->users()->attach($user->id, ['role' => 'manager']);

        return [$user->fresh(), $site];
    }
}
