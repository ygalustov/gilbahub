<?php

namespace Tests\Feature;

use App\Models\Account;
use App\Models\Sample;
use App\Models\Site;
use App\Models\User;
use App\Models\Zone;
use App\Support\ZoneTypes;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * GH-805 (queue item "Zones", part 2) — AN EDIT CHANGES WHAT IT MENTIONS AND LEAVES THE REST ALONE.
 *
 * WHAT WAS WRONG. `SampleController::update` ASSIGNED the payload it was sent, and the one sender is the
 * Edit window of the Data page, which collects the fields of a form. Everything the form has no field
 * for was erased by any edit at all — including the edit of a name a person makes to move a sample out
 * of a zone they want to delete, which is the road part 1 of this work sends them down.
 *
 * MEASURED ON THE STAND, 01.10.2026 and again 02.10 by this developer: `pH_Water` 39 samples,
 * `CEC_meq100g` 39, `EC1_5` 30, `OM_Percent` 19, and `PO4` on 6 of the 10 live water samples that have
 * no `P` at all — so the phosphate goes entirely. A figure changes or disappears on 26 samples: soil on
 * `Burns` 17, soil on `New test - location` 3, water 6. Tissue loses nothing.
 *
 * WHY THE FIXTURE CARRIES ALL FIVE SOIL KEYS AT ONCE, and that is the reviewer's requirement: with one
 * key in the fixture, "the lists differ by exactly the key that was edited" is proved by an example, and
 * a merge that kept one key and dropped the others would pass it. Water gets a case of its own for the
 * same reason — its loss has a different shape (`PO4` with no `P`), and a soil case does not close it.
 */
class Gh805AnEditMergesAndDoesNotReplaceTest extends TestCase
{
    use RefreshDatabase;

    /** The five soil keys the Edit window has no field for, as the stand spells them. */
    private const THE_FIVE = [
        'pH_Water' => 6.2,
        'CEC_meq100g' => 12.4,
        'EC1_5' => 0.18,
        'OM_Percent' => 3.1,
        'pH_CaCl2' => 5.8,
    ];

    public function test_editing_only_the_name_leaves_every_other_key_and_value_untouched(): void
    {
        [$user, $site, $sample] = $this->aSoilSampleWithEverything();
        $before = $sample->payload;

        // What the Edit window now sends for "I changed the Zone name and nothing else".
        $answer = $this->editing($user, $sample, ['_label' => 'Green 2']);
        $after = $sample->fresh()->payload;

        fwrite(STDOUT, '[gh805] the keys before: '.json_encode(array_keys($before))
            .PHP_EOL.'[gh805] the keys after:  '.json_encode(array_keys($after))
            .PHP_EOL.'[gh805] what differs: '.json_encode($this->differences($before, $after)).PHP_EOL);

        $answer->assertStatus(200);
        /**
         * THE LIST, NOT ITS LENGTH, and in both directions: no key was lost and none appeared. The
         * stored `_zone`/`zone` pair is written by the server on every save of a named sample, as it
         * always was, so it is in both lists.
         */
        $this->assertSame(array_keys($before), array_keys($after));
        // And the only thing that differs is what the person edited.
        $this->assertSame(['_label' => ['Green 1', 'Green 2']], $this->differences($before, $after));
        // Each of the five, by name and by value, because "nothing was lost" is the whole claim.
        foreach (self::THE_FIVE as $key => $value) {
            $this->assertSame($value, $after[$key], $key.' was lost or changed by an edit of the name');
        }
    }

    public function test_the_edit_moves_the_sample_to_the_zone_of_its_new_name(): void
    {
        [$user, $site, $sample] = $this->aSoilSampleWithEverything();
        $wasZone = $sample->zone_id;

        $this->editing($user, $sample, ['_label' => 'Green 2'])->assertStatus(200);
        $after = $sample->fresh();

        fwrite(STDOUT, '[gh805] the zone before and after: '
            .json_encode([Zone::query()->whereKey($wasZone)->value('name'),
                Zone::query()->whereKey($after->zone_id)->value('name')]).PHP_EOL);

        // The merge did not take the zone with it: the one writer still decides, and the new name is a
        // new zone (the owner's decision of 01.10 that names are loaded as they are).
        $this->assertNotSame($wasZone, $after->zone_id);
        $this->assertSame('Green 2', Zone::query()->whereKey($after->zone_id)->value('name'));
        // And the old zone is still there -- a sample leaving does not abolish a place.
        $this->assertSame('Green 1', Zone::query()->whereKey($wasZone)->value('name'));
    }

    public function test_a_water_sample_keeps_its_phosphate_which_has_no_field_and_no_P_beside_it(): void
    {
        [$user, $site] = $this->aSite();
        $sample = $this->aSample($site, 'water', [
            '_label' => 'Bore 1', '_zone' => 'bore', 'EC' => 0.42, 'PO4' => 0.07, 'pH' => 7.1,
        ]);
        $before = $sample->payload;

        $answer = $this->editing($user, $sample, ['EC' => 0.5]);
        $after = $sample->fresh()->payload;

        fwrite(STDOUT, '[gh805] the water sample before: '.json_encode($before)
            .PHP_EOL.'[gh805] and after an edit of its EC: '.json_encode($after).PHP_EOL);

        $answer->assertStatus(200);
        // `PO4` has no field in the window and no `P` beside it, so a replacing save took it away
        // entirely -- 6 of the stand's 10 live water samples are in exactly this shape.
        $this->assertSame(0.07, $after['PO4']);
        $this->assertSame(['EC' => [0.42, 0.5]], $this->differences($before, $after));
        // And the word beside a water sample is untouched: water keeps only its name (the owner, 01.10).
        $this->assertSame('bore', $after['_zone']);
    }

    public function test_a_field_the_person_emptied_is_removed_and_not_quietly_kept(): void
    {
        [$user, $site, $sample] = $this->aSoilSampleWithEverything();

        // How the window says "I cleared this": the key travels with an explicit null.
        $answer = $this->editing($user, $sample, ['K' => null]);
        $after = $sample->fresh()->payload;

        fwrite(STDOUT, '[gh805] after clearing K: '.json_encode(array_keys($after))
            // array_key_exists, not `??`: a key present and null would otherwise print as absent,
            // and telling those two apart is exactly what this case is about.
            .PHP_EOL.'[gh805] K is '.(array_key_exists('K', $after) ? json_encode($after['K']) : '(gone)').PHP_EOL);

        $answer->assertStatus(200);
        // Gone, not kept: without this the merge would make a cleared reading immortal.
        $this->assertArrayNotHasKey('K', $after);
        // And nothing else went with it.
        $this->assertSame(6.2, $after['pH_Water']);
        $this->assertSame(40, $after['P']);
    }

    public function test_an_edit_of_one_reading_leaves_the_name_alone(): void
    {
        [$user, $site, $sample] = $this->aSoilSampleWithEverything();

        $this->editing($user, $sample, ['P' => 44])->assertStatus(200);
        $after = $sample->fresh();

        fwrite(STDOUT, '[gh805] after editing P: label '.json_encode($after->payload['_label'] ?? null)
            .', zone '.json_encode(Zone::query()->whereKey($after->zone_id)->value('name')).PHP_EOL);

        // The name is a field of the sample, not a thing an edit of a reading rewrites.
        $this->assertSame('Green 1', $after->payload['_label']);
        $this->assertSame(44, $after->payload['P']);
        $this->assertSame('Green 1', Zone::query()->whereKey($after->zone_id)->value('name'));
    }

    /** @return array<string,array{mixed,mixed}> key => [before, after], for every key that differs */
    private function differences(array $before, array $after): array
    {
        $out = [];
        foreach (array_unique(array_merge(array_keys($before), array_keys($after))) as $key) {
            $was = $before[$key] ?? null;
            $now = $after[$key] ?? null;
            if ($was !== $now) {
                $out[$key] = [$was, $now];
            }
        }

        return $out;
    }

    private function editing(User $user, Sample $sample, array $payload)
    {
        return $this->actingAs($user)->withSession(['_token' => 't'])
            ->patchJson('/api/samples/'.$sample->id, ['_token' => 't', 'payload' => $payload]);
    }

    /**
     * A soil sample as the stand holds them: the form's own readings, the five the form cannot see, and
     * the two words the server writes beside a name (`_zone`, `zone`).
     *
     * BUILT BY MODEL, AND THE REASON IS A BOUNDARY OF THE FIXTURE RATHER THAN OF THE PRODUCT: a second
     * save of one sample on the same day collides on `site_summaries` under SQLite, because the unique
     * key is (site, type, lab date) and the cast stores a datetime where the stand's column is a DATE —
     * so `firstOrNew` finds nothing and inserts again. Each case therefore makes exactly ONE request,
     * and the state a previous save would have left is built here instead.
     */
    private function aSoilSampleWithEverything(): array
    {
        [$user, $site] = $this->aSite();
        $zone = app(\App\Services\ZoneService::class)->resolveOrCreate($site, 'Green 1', $user->id);
        $sample = $this->aSample($site, 'soil', array_merge([
            '_label' => 'Green 1', 'P' => 40, 'K' => 120, 'Ca' => 900, 'Mg' => 130, 'S' => 11,
            '_zone' => 'green', 'zone' => 'Greens',
        ], self::THE_FIVE));
        $sample->forceFill(['zone_id' => $zone->id])->save();

        return [$user, $site, $sample->fresh()];
    }

    private function aSample(Site $site, string $type, array $payload): Sample
    {
        return Sample::query()->create([
            'account_id' => $site->account_id,
            'site_id' => $site->id,
            'sample_type' => $type,
            'lab_date' => '2026-05-01',
            'payload' => $payload,
            'created_by_user_id' => $site->created_by_user_id,
            'modified_by_user_id' => $site->created_by_user_id,
        ]);
    }

    private function aSite(): array
    {
        $user = User::factory()->create();
        $account = Account::query()->firstOrCreate(
            ['owner_user_id' => $user->id],
            ['display_name' => $user->name, 'created_by_user_id' => $user->id, 'modified_by_user_id' => $user->id]
        );
        $site = Site::query()->create([
            'account_id' => $account->id,
            'name' => 'GH-805 edit',
            'slug' => 'gh805-'.bin2hex(random_bytes(4)),
            'site_type' => 'golf',
            'created_by_user_id' => $user->id,
            'modified_by_user_id' => $user->id,
        ]);
        $site->users()->attach($user->id, ['role' => 'manager']);

        return [$user->fresh(), $site];
    }
}
