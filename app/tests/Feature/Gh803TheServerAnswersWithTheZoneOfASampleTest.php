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
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

/**
 * GH-803 (queue item "Zones", stage C3) — THE SERVER ANSWERS WITH THE ZONE OF A SAMPLE, AND IT IS THE
 * FIRST THING IN THE PRODUCT THAT READS `zone_id`.
 *
 * THE ORDER INSIDE THE STAGE, and it is the rule the whole queue item is held to: the server starts
 * answering with the zone first, the browser's readers come after it. So this is the case for the first
 * read, and the guard next door (`Gh801NobodyReadsTheZoneOfASampleYetTest`) is where it is declared —
 * by file AND function, because a declaration as coarse as a file would let a second read appear in the
 * same file in silence.
 *
 * WHY THE NAME TRAVELS BESIDE THE ID. One place prints a zone's name: the caption of a trend series, on
 * the screen and above the sparklines in Word. A series is about several visits to one place and has no
 * sample of its own to take a caption from, and printing the id there is the class `GH-798` removed.
 * Everything else that prints keeps printing the SAMPLE's own name — `payload._label`, the name of a
 * visit — which a rename of the zone does not touch (stage C1).
 *
 * PRECONDITION, MEASURED BEFORE THIS STAGE WAS STARTED (the plan's P5, on the stand, 01.10.2026): live
 * soil and tissue samples on live sites with no `zone_id` — 0 of 59. Water: 10 of 10 with none, which is
 * the owner's decision and the reason "a sample with no zone" is a case here rather than an accident.
 */
class Gh803TheServerAnswersWithTheZoneOfASampleTest extends TestCase
{
    use RefreshDatabase;

    public function test_a_soil_sample_is_answered_with_its_zone_id_and_the_zones_name(): void
    {
        [$user, $site] = $this->aSite();
        $this->postSample($user, $site, 'soil', ['_label' => 'Green 1 (June 2025)', 'K' => 120])
            ->assertStatus(201);
        $zone = Zone::query()->where('site_id', $site->id)->firstOrFail();

        $answer = $this->actingAs($user)->getJson('/api/samples?site_id='.$site->id);
        $row = $answer->json('data.0');

        fwrite(STDOUT, '[gh803] what the server answers about the sample: '
            .json_encode(['zone_id' => $row['zone_id'], 'zone_name' => $row['zone_name'],
                '_label' => $row['payload']['_label'] ?? null]).PHP_EOL);

        $answer->assertStatus(200);
        // The zone, by identity, and its name beside it.
        $this->assertSame($zone->id, $row['zone_id']);
        $this->assertSame('Green 1 (June 2025)', $row['zone_name']);
        // AND THE SAMPLE'S OWN NAME IS UNTOUCHED: two names, each about its own thing.
        $this->assertSame('Green 1 (June 2025)', $row['payload']['_label'] ?? null);
    }

    /**
     * THE RENAME, which is the whole reason a zone has an identity: the answer's `zone_name` follows the
     * row, and the sample's own label does not move. Both halves in one case — either alone would pass
     * on a stage that had got the other wrong (the class of GH-459).
     */
    public function test_a_rename_moves_the_zones_name_in_the_answer_and_leaves_the_samples_own(): void
    {
        [$user, $site] = $this->aSite();
        $this->postSample($user, $site, 'soil', ['_label' => 'Green 1', 'K' => 120])->assertStatus(201);
        $zone = Zone::query()->where('site_id', $site->id)->firstOrFail();

        // Through the product's own road: the Zones tab of stage C2, which also requires a type.
        $this->actingAs($user)->withSession(['_token' => 't'])
            ->patchJson('/api/sites/'.$site->id.'/zones', ['_token' => 't',
                'renamed' => [['id' => $zone->id, 'name' => 'Putter Green']],
                'typed' => [['id' => $zone->id, 'zoneType' => ZoneTypes::zoneTypeKeys()[0]]],
            ])->assertStatus(200);

        $row = $this->actingAs($user)->getJson('/api/samples?site_id='.$site->id)->json('data.0');

        fwrite(STDOUT, '[gh803] after the rename the server answers: '
            .json_encode(['zone_id' => $row['zone_id'], 'zone_name' => $row['zone_name'],
                '_label' => $row['payload']['_label'] ?? null]).PHP_EOL);

        // Same row, new name.
        $this->assertSame($zone->id, $row['zone_id']);
        $this->assertSame('Putter Green', $row['zone_name']);
        // The sample still carries the name of its visit.
        $this->assertSame('Green 1', $row['payload']['_label'] ?? null);
    }

    /**
     * A SAMPLE WITH NO ZONE IS ANSWERED AS HAVING NONE — null, not a word and not a name borrowed from
     * somewhere. Water is the permanent case of it (the owner's decision: a water sample is not a zone),
     * and the second case is a sample whose zone was deleted.
     */
    public function test_a_water_sample_and_a_sample_whose_zone_was_deleted_are_answered_as_having_none(): void
    {
        [$user, $site] = $this->aSite();
        $this->postSample($user, $site, 'water', ['_label' => 'Bore 1', '_zone' => 'bore', 'EC' => 0.4])
            ->assertStatus(201);
        $this->postSample($user, $site, 'soil', ['_label' => 'Green 1', 'K' => 120])->assertStatus(201);
        $zone = Zone::query()->where('site_id', $site->id)->firstOrFail();
        // The one road to a soil sample with no zone: its zone is gone. `nullOnDelete` on the column.
        Zone::query()->whereKey($zone->id)->delete();

        $rows = collect($this->actingAs($user)->getJson('/api/samples?site_id='.$site->id)->json('data'))
            ->keyBy('sample_type');

        fwrite(STDOUT, '[gh803] the water sample: '
            .json_encode(['zone_id' => $rows['water']['zone_id'], 'zone_name' => $rows['water']['zone_name'],
                'its own word' => $rows['water']['payload']['_zone'] ?? null])
            .PHP_EOL.'[gh803] the soil sample whose zone was deleted: '
            .json_encode(['zone_id' => $rows['soil']['zone_id'], 'zone_name' => $rows['soil']['zone_name'],
                '_label' => $rows['soil']['payload']['_label'] ?? null]).PHP_EOL);

        $this->assertNull($rows['water']['zone_id']);
        $this->assertNull($rows['water']['zone_name']);
        // And the word a water sample carries about its source is untouched: water keeps only its name.
        $this->assertSame('bore', $rows['water']['payload']['_zone'] ?? null);
        $this->assertNull($rows['soil']['zone_id']);
        $this->assertNull($rows['soil']['zone_name']);
        // Its own name is still there, which is what the reader of "no zone" has to print.
        $this->assertSame('Green 1', $rows['soil']['payload']['_label'] ?? null);
    }

    /**
     * THE NAME DOES NOT COST A QUERY PER SAMPLE. The answer joins the zone once for the whole list, so
     * the list of a site with many zones is not N+1 reads of a table that was added this week. Asserted
     * as a consequence — the number of queries over two sizes of the same list — rather than by naming
     * the eager load, which a rewrite would rename.
     */
    public function test_the_list_asks_for_the_zones_once_and_not_once_per_sample(): void
    {
        [$user, $site] = $this->aSite();
        /**
         * A DATE PER SAMPLE, and the reason is a boundary of the fixture rather than of the product:
         * `site_summaries` is unique on (site, type, lab date), and on SQLite the cast stores a
         * datetime where the stand's column is a DATE, so two soil samples saved on the same day
         * collide here and do not collide on the stand. The subject of this case is the query count,
         * so the dates are simply made distinct.
         */
        foreach (['Green 1', 'Green 2', 'Green 3'] as $i => $name) {
            $this->postSample($user, $site, 'soil', ['_label' => $name, 'K' => 120],
                '2026-0'.($i + 1).'-05')->assertStatus(201);
        }
        DB::enableQueryLog();
        $three = $this->actingAs($user)->getJson('/api/samples?site_id='.$site->id);
        $forThree = count(DB::getQueryLog());

        foreach (['Green 4', 'Green 5', 'Green 6'] as $i => $name) {
            $this->postSample($user, $site, 'soil', ['_label' => $name, 'K' => 120],
                '2026-0'.($i + 4).'-05')->assertStatus(201);
        }
        DB::flushQueryLog();
        $six = $this->actingAs($user)->getJson('/api/samples?site_id='.$site->id);
        $forSix = count(DB::getQueryLog());
        DB::disableQueryLog();

        fwrite(STDOUT, '[gh803] queries for a list of three samples: '.$forThree
            .', for six: '.$forSix
            .PHP_EOL.'[gh803] and every one of the six is answered with a zone: '
            .json_encode(collect($six->json('data'))->map(fn ($r) => $r['zone_name'])->all()).PHP_EOL);

        // The same number of queries for twice the samples.
        $this->assertSame($forThree, $forSix);
        /**
         * And the perechen rather than its length (the project's rule, and `gh746` holds it): every one
         * of the six samples is answered with its own zone's name, so the query count above is over six
         * real answers and not over six empty ones.
         */
        $names = collect($six->json('data'))->pluck('zone_name')->sort()->values()->all();
        $this->assertSame(['Green 1', 'Green 2', 'Green 3', 'Green 4', 'Green 5', 'Green 6'], $names);
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
            'name' => 'GH-803 zones',
            'slug' => 'gh803-'.bin2hex(random_bytes(4)),
            'site_type' => 'golf',
            'created_by_user_id' => $user->id,
            'modified_by_user_id' => $user->id,
        ]);
        $site->users()->attach($user->id, ['role' => 'manager']);

        return [$user->fresh(), $site];
    }

    private function postSample(User $user, Site $site, string $type, array $payload, ?string $labDate = null)
    {
        return $this->actingAs($user)->withSession(['_token' => 't'])->postJson('/api/samples', array_filter([
            '_token' => 't',
            'site_id' => $site->id,
            'sample_type' => $type,
            'lab_date' => $labDate,
            'payload' => $payload,
        ], fn ($v) => $v !== null));
    }
}
