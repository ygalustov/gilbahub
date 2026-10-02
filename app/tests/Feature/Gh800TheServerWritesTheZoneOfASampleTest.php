<?php

namespace Tests\Feature;

use App\Models\Account;
use App\Models\Sample;
use App\Models\Site;
use App\Models\Zone;
use App\Models\User;
use App\Services\ZoneService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

/**
 * GH-800 (queue item "Zones", stage C1) — A SAMPLE SAVED BY THE SERVER POINTS AT ITS ZONE.
 *
 * Stage C0 made the table and filled it from the names the sites already had. This stage is the
 * writing: a sample arriving by any of the server's roads resolves its zone, and a name the site has
 * never seen brings a zone into being with no type.
 *
 * WHAT IS ASSERTED, and it is the state of the row rather than the shape of the code: what the database
 * holds after a save. And the other half of the same claim — that the OLD writes continue — because the
 * rule the whole item is held to is that nothing stops being written before its readers have moved, and
 * in this stage not one reader has moved.
 *
 * WHAT NOBODY READS YET: `zone_id`. No page, no calculation and no document consults it; stage C3 is
 * where that starts. So there is nothing on a screen to look at in this stage, which is what the plan
 * says a person sees after it: nothing.
 */
class Gh800TheServerWritesTheZoneOfASampleTest extends TestCase
{
    use RefreshDatabase;

    public function test_a_sample_saved_through_the_api_points_at_a_zone_made_for_its_name(): void
    {
        [$user, $site] = $this->aSite();

        $answer = $this->postSample($user, $site, 'soil', ['_label' => 'Green 7', 'K' => 120]);
        $answer->assertStatus(201);

        $sample = Sample::query()->where('site_id', $site->id)->firstOrFail();
        $zone = Zone::query()->where('site_id', $site->id)->firstOrFail();

        fwrite(STDOUT, '[gh800] the zone the save made: '
            .json_encode(['name' => $zone->name, 'zoneType' => $zone->zone_type])
            .PHP_EOL.'[gh800] the sample points at: '.json_encode($sample->zone_id === $zone->id)
            .PHP_EOL.'[gh800] and the old writes continue: the site\'s list is '
            .json_encode($site->fresh()->attributes_json['zones'] ?? null)
            .', the sample\'s own label is '.json_encode($sample->payload['_label'] ?? null).PHP_EOL);

        // The zone exists, under the name as typed, with NO type -- the owner's decision.
        $this->assertSame('Green 7', $zone->name);
        $this->assertNull($zone->zone_type);
        // And the sample points at it.
        $this->assertSame($zone->id, $sample->zone_id);

        /**
         * THE OTHER HALF: the writes every reader still uses are untouched. Without this the case would
         * pass on a stage that had quietly replaced them, which is the one thing this stage must not do.
         */
        $this->assertSame(['Green 7'], $site->fresh()->attributes_json['zones'] ?? null);
        $this->assertSame('Green 7', $sample->payload['_label'] ?? null);
    }

    public function test_the_same_zone_in_another_case_is_the_same_row(): void
    {
        [$user, $site] = $this->aSite();

        $this->postSample($user, $site, 'soil', ['_label' => 'Green 7', 'K' => 120])->assertStatus(201);
        $this->postSample($user, $site, 'tissue', ['_label' => 'green 7', 'N' => 3.1])->assertStatus(201);

        $zones = Zone::query()->where('site_id', $site->id)->get();
        $samples = Sample::query()->where('site_id', $site->id)->orderBy('id')->get();

        fwrite(STDOUT, '[gh800] zones after two saves of one name in two cases: '
            .json_encode($zones->pluck('name')->all())
            .PHP_EOL.'[gh800] the two samples point at the same zone: '
            .json_encode($samples->pluck('zone_id')->unique()->count() === 1).PHP_EOL);

        // One place, named as it was first typed. The second save does not rename it.
        $this->assertSame(['Green 7'], $zones->pluck('name')->all());
        $this->assertSame(1, $samples->pluck('zone_id')->unique()->count());
        $this->assertNotNull($samples->first()->zone_id);
    }

    public function test_a_water_sample_gets_no_zone(): void
    {
        [$user, $site] = $this->aSite();

        $this->postSample($user, $site, 'water', ['_label' => 'Bore 1', '_zone' => 'bore', 'EC' => 0.4])
            ->assertStatus(201);

        $sample = Sample::query()->where('site_id', $site->id)->firstOrFail();
        fwrite(STDOUT, '[gh800] the water sample: zone '.json_encode($sample->zone_id)
            .', zones made '.Zone::query()->count()
            .', its own word still '.json_encode($sample->payload['_zone'] ?? null).PHP_EOL);

        // No zone, and no zone made for it -- the owner's decision of 22.09.2026 that water samples are
        // not zones. And its own hidden word is untouched: water keeps what it has (01.10.2026).
        $this->assertNull($sample->zone_id);
        $this->assertSame(0, Zone::query()->count());
        $this->assertSame('bore', $sample->payload['_zone'] ?? null);
    }

    public function test_renaming_a_sample_moves_it_to_the_zone_of_the_new_name(): void
    {
        [$user, $site] = $this->aSite();
        /**
         * The sample is built directly rather than posted, and the reason is named so it is not read as
         * convenience: a POST writes a `site_summaries` row for (site, type, lab_date), and under the
         * SQLite this suite runs on the later PATCH's `firstOrNew` does not match it — the stored value
         * is `2026-10-01 00:00:00` and the lookup asks for `2026-10-01`. On the stand that column is a
         * DATE and the lookup matches, so this is the test environment and not the product; it is in
         * the delivery's boundaries as a finding rather than repaired here, which would be another
         * item's scope.
         */
        $sample = Sample::query()->create([
            'account_id' => $site->account_id, 'site_id' => $site->id, 'sample_type' => 'soil',
            'lab_name' => 'lab', 'lab_ref' => '', 'soil_texture_snapshot' => '',
            'payload' => ['_label' => 'Green 7', 'K' => 120],
            'zone_id' => app(ZoneService::class)->resolveOrCreate($site, 'Green 7', $user->id)?->id,
            'created_by_user_id' => $user->id, 'modified_by_user_id' => $user->id,
        ]);
        $site->forceFill(['attributes_json' => ['zones' => ['Green 7']]])->save();
        $firstZone = $sample->zone_id;
        $this->assertNotNull($firstZone);

        $this->actingAs($user)
            ->withSession(['_token' => 't'])
            ->patchJson('/api/samples/'.$sample->id, ['_token' => 't', 'payload' => ['_label' => 'Green 8', 'K' => 120]])
            ->assertOk();

        $after = $sample->fresh();
        $zones = Zone::query()->where('site_id', $site->id)->orderBy('name')->get();

        fwrite(STDOUT, '[gh800] after the rename: zones '.json_encode($zones->pluck('name')->all())
            .', the sample points at '
            .json_encode(Zone::query()->where('id', $after->zone_id)->value('name'))
            .PHP_EOL.'[gh800] the site\'s own list now: '
            .json_encode($site->fresh()->attributes_json['zones'] ?? null).PHP_EOL);

        // The new name is a zone of its own, and the sample is of it now.
        $this->assertSame(['Green 7', 'Green 8'], $zones->pluck('name')->all());
        $this->assertNotSame($firstZone, $after->zone_id);
        $this->assertSame('Green 8', Zone::query()->where('id', $after->zone_id)->value('name'));
        // The old zone is NOT removed: a zone is a place, and a sample moving away does not abolish it.
        // Nor is the site's list of names reduced -- that write continues exactly as it was.
        $this->assertSame(['Green 7', 'Green 8'], $site->fresh()->attributes_json['zones'] ?? null);
    }

    public function test_the_push_route_resolves_a_zone_for_every_sample_it_stores(): void
    {
        [$user, $site] = $this->aSite();

        $this->actingAs($user)->withSession(['_token' => 't'])->postJson('/api/samples/sync', [
            '_token' => 't',
            'allSites' => [
                $site->id => [
                    'soil' => [
                        'a' => ['label' => 'Green 7', 'rawData' => ['K' => 120], 'date' => '2026-08-08'],
                        'b' => ['label' => 'Putter Green', 'rawData' => ['K' => 90], 'date' => '2026-09-20'],
                    ],
                ],
            ],
        ])->assertOk();

        $zones = Zone::query()->where('site_id', $site->id)->orderBy('name')->pluck('name')->all();
        $linked = Sample::query()->where('site_id', $site->id)->whereNotNull('zone_id')->count();
        $all = Sample::query()->where('site_id', $site->id)->count();

        fwrite(STDOUT, '[gh800] the push made the zones '.json_encode($zones)
            .' and linked '.$linked.' of '.$all.' samples'.PHP_EOL);

        $this->assertSame(['Green 7', 'Putter Green'], $zones);
        $this->assertSame($all, $linked);
        $this->assertGreaterThan(0, $all);
    }

    public function test_a_sample_with_no_name_gets_no_zone_and_makes_none(): void
    {
        [$user, $site] = $this->aSite();

        $this->postSample($user, $site, 'soil', ['K' => 120])->assertStatus(201);

        $sample = Sample::query()->where('site_id', $site->id)->firstOrFail();
        fwrite(STDOUT, '[gh800] a sample nobody named: zone '.json_encode($sample->zone_id)
            .', zones made '.Zone::query()->count().PHP_EOL);

        // No name is no zone -- not a zone called "". GH-549's rule, at the moment of writing.
        $this->assertNull($sample->zone_id);
        $this->assertSame(0, Zone::query()->count());
    }

    public function test_the_site_payload_carries_its_zones_beside_the_list_it_always_carried(): void
    {
        [$user, $site] = $this->aSite();
        $this->postSample($user, $site, 'soil', ['_label' => 'Green 7', 'K' => 120])->assertStatus(201);

        $answer = $this->actingAs($user)->getJson('/api/sites/'.$site->id);
        $answer->assertOk();
        $data = $answer->json('data');

        fwrite(STDOUT, '[gh800] the payload carries zones: '.json_encode($data['zones'] ?? null)
            .PHP_EOL.'[gh800] and the list it always carried: '
            .json_encode($data['attributes_json']['zones'] ?? ($site->fresh()->attributes_json['zones'] ?? null)).PHP_EOL);

        // The rows, with the key of the type and the words for it -- null for a zone nobody has typed.
        $this->assertSame([[
            'id' => Zone::query()->where('site_id', $site->id)->value('id'),
            'name' => 'Green 7',
            'zoneType' => null,
            'zoneTypeLabel' => null,
            // GH-817: the zone's live samples and the sentence the Zones tab prints if someone tries to remove it.
            'samples' => 1,
            'removeRefusal' => 'Green 7 has 1 sample. Move or delete them first.',
        ]], $data['zones']);
        // And the old list is still on the site itself, which is what every reader still reads.
        $this->assertSame(['Green 7'], $site->fresh()->attributes_json['zones'] ?? null);
    }

    public function test_the_service_answers_the_same_row_twice_and_refuses_an_empty_name(): void
    {
        [$user, $site] = $this->aSite();
        $service = app(ZoneService::class);

        $first = $service->resolveOrCreate($site, 'Green 7', $user->id);
        $second = $service->resolveOrCreate($site, '  GREEN 7 ', $user->id);
        $empty = $service->resolveOrCreate($site, '   ', $user->id);
        $nothing = $service->resolveOrCreate($site, null, $user->id);

        fwrite(STDOUT, '[gh800] the service: first '.json_encode($first->name)
            .', the same name in another case gives the same row '.json_encode($first->id === $second->id)
            .', an empty name gives '.json_encode($empty)
            .', no name gives '.json_encode($nothing)
            .', rows now '.Zone::query()->count().PHP_EOL);

        $this->assertSame($first->id, $second->id);
        $this->assertNull($empty);
        $this->assertNull($nothing);
        $this->assertSame(1, Zone::query()->count());
    }

    // ── fixtures ─────────────────────────────────────────────────────────────────────────────────

    /** @return array{0:User,1:Site} */
    private function aSite(): array
    {
        $user = User::factory()->create();
        $account = Account::query()->firstOrCreate(
            ['owner_user_id' => $user->id],
            ['display_name' => $user->name, 'created_by_user_id' => $user->id, 'modified_by_user_id' => $user->id]
        );
        $site = Site::query()->create([
            'account_id' => $account->id,
            'name' => 'GH-800 zones',
            'slug' => 'gh800-'.bin2hex(random_bytes(4)),
            'site_type' => 'golf',
            'created_by_user_id' => $user->id,
            'modified_by_user_id' => $user->id,
        ]);
        $site->users()->attach($user->id, ['role' => 'manager']);

        return [$user->fresh(), $site];
    }

    private function postSample(User $user, Site $site, string $type, array $payload)
    {
        return $this->actingAs($user)->withSession(['_token' => 't'])->postJson('/api/samples', [
            '_token' => 't',
            'site_id' => $site->id,
            'sample_type' => $type,
            'payload' => $payload,
        ]);
    }
}
