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
 * GH-817 (queue item "Zones") — ZONES BY NAME, SAMPLES OF A DATE BY NAME, AND THE WORDS ABOUT A ZONE THAT STILL
 * HAS SAMPLES.
 *
 * The owner's requests, in order: zones sorted by name with numbers by value ("Green 1, Green 2, Green 3"); on
 * the Data page newest date first as before, and within one date by name; and, for a zone that still has
 * samples, the remove button refuses and says how many (her variant (a), decided 01.10.2026).
 *
 * Every expected sentence below is written out by hand. Each surface -- the zone list the Zones tab is given,
 * and the save's refusal -- is compared with it on its own, never with the other surface: two surfaces that
 * moved together would agree with each other.
 */
class Gh817ZoneOrderAndTheCrossTest extends TestCase
{
    use RefreshDatabase;

    public function test_the_zones_come_by_name_with_their_live_samples_and_the_sentence_about_them(): void
    {
        [$user, $site, $zones] = $this->aSiteWithZones(['Green 10', 'Green 2', 'green 1', 'Tee 1']);
        $this->aSampleIn($site, $zones['green 1'], '2026-09-01');
        $this->aSampleIn($site, $zones['Green 2'], '2026-09-01');
        $this->aSampleIn($site, $zones['Green 2'], '2026-09-02');
        // A sample in the bin is not a live sample, and the count is of live ones.
        $this->aSampleIn($site, $zones['Green 10'], '2026-09-01')->delete();

        $page = app(ZoneService::class)->forThePage($site);
        $seen = array_map(fn ($z) => [$z['name'], $z['samples'], $z['removeRefusal']], $page);
        fwrite(STDOUT, '[gh817] zones examined: '.count($page).PHP_EOL
            .'[gh817] zones as the tab is given them: '.json_encode($seen).PHP_EOL);

        $this->assertSame([
            ['green 1', 1, 'green 1 has 1 sample. Move or delete them first.'],
            ['Green 2', 2, 'Green 2 has 2 samples. Move or delete them first.'],
            ['Green 10', 0, null],
            ['Tee 1', 0, null],
        ], $seen);
    }

    public function test_the_save_refuses_a_zone_with_samples_in_the_same_words_one_tail_for_two_zones(): void
    {
        [$user, $site, $zones] = $this->aSiteWithZones(['green 1', 'Green 2', 'Tee 1']);
        $this->aSampleIn($site, $zones['green 1'], '2026-09-01');
        $this->aSampleIn($site, $zones['Green 2'], '2026-09-01');
        $this->aSampleIn($site, $zones['Green 2'], '2026-09-02');

        $one = $this->saveZones($user, $site, ['deleted' => [$zones['green 1']->id]]);
        $two = $this->saveZones($user, $site, ['deleted' => [$zones['green 1']->id, $zones['Green 2']->id]]);
        fwrite(STDOUT, '[gh817] refusal, one zone: '.$one->status().' '.json_encode($one->json('message')).PHP_EOL
            .'[gh817] refusal, two zones: '.$two->status().' '.json_encode($two->json('message')).PHP_EOL);

        $one->assertStatus(422);
        $this->assertSame('Not saved: green 1 has 1 sample. Move or delete them first.', $one->json('message'));
        $two->assertStatus(422);
        $this->assertSame('Not saved: green 1 has 1 sample and Green 2 has 2 samples. Move or delete them first.',
            $two->json('message'));
    }

    public function test_removing_a_zone_with_no_samples_and_typing_another_in_one_save_is_accepted(): void
    {
        [$user, $site, $zones] = $this->aSiteWithZones(['green 1', 'Tee 1']);
        $type = ZoneTypes::zoneTypeKeys()[0];
        $answer = $this->saveZones($user, $site, [
            'typed' => [['id' => $zones['green 1']->id, 'zoneType' => $type]],
            'deleted' => [$zones['Tee 1']->id],
        ]);
        $after = Zone::query()->where('site_id', $site->id)->orderBy('name')->get(['name', 'zone_type'])->toArray();
        fwrite(STDOUT, '[gh817] accepted save: '.$answer->status().'; zones after: '.json_encode($after).PHP_EOL);

        $answer->assertStatus(200);
        $this->assertSame([['name' => 'green 1', 'zone_type' => $type]], $after);
    }

    public function test_the_data_page_lists_newest_date_first_and_a_date_by_name(): void
    {
        [$user, $site, $zones] = $this->aSiteWithZones(['Green 1']);
        // Created in an order the previous rule (`id` descending within a date) does not turn into the
        // name order: a first attempt created them in reverse and passed before the change by coincidence.
        foreach ([['green 1', '2026-09-02'], ['Green 10', '2026-09-02'], ['Green 2', '2026-09-02'],
            ['Green 1', '2026-08-01'], ['Green 1 (2026-02-13)', '2026-08-01']] as [$label, $date]) {
            Sample::query()->create([
                'account_id' => $site->account_id, 'site_id' => $site->id, 'sample_type' => 'soil',
                'lab_date' => $date, 'payload' => ['_label' => $label, 'K' => 100],
                'created_by_user_id' => $user->id, 'modified_by_user_id' => $user->id,
            ]);
        }

        $response = $this->actingAs($user)->get('/data/soil');
        $response->assertOk();
        $rows = $response->viewData('rows');
        $listed = $rows->map(fn ($r) => $r->lab_date->toDateString().' '.$r->payload['_label'])->values()->all();
        fwrite(STDOUT, '[gh817] samples examined on the page: '.count($listed).PHP_EOL
            .'[gh817] in the order the page lists them: '.json_encode($listed).PHP_EOL);

        $this->assertSame([
            '2026-09-02 green 1', '2026-09-02 Green 2', '2026-09-02 Green 10',
            '2026-08-01 Green 1', '2026-08-01 Green 1 (2026-02-13)',
        ], $listed);
    }

    private function saveZones(User $user, Site $site, array $changes)
    {
        return $this->actingAs($user)->withSession(['_token' => 't'])
            ->patchJson('/api/sites/'.$site->id.'/zones', array_merge(['_token' => 't'], $changes));
    }

    private function aSampleIn(Site $site, Zone $zone, string $labDate): Sample
    {
        return Sample::query()->create([
            'account_id' => $site->account_id, 'site_id' => $site->id, 'zone_id' => $zone->id,
            'sample_type' => 'soil', 'lab_date' => $labDate, 'payload' => ['_label' => $zone->name, 'K' => 100],
            'created_by_user_id' => $site->created_by_user_id, 'modified_by_user_id' => $site->created_by_user_id,
        ]);
    }

    /** @return array{0: User, 1: Site, 2: array<string,Zone>} */
    private function aSiteWithZones(array $names): array
    {
        $user = User::factory()->create();
        $account = Account::query()->firstOrCreate(
            ['owner_user_id' => $user->id],
            ['display_name' => $user->name, 'created_by_user_id' => $user->id, 'modified_by_user_id' => $user->id]
        );
        $site = Site::query()->create([
            'account_id' => $account->id, 'name' => 'GH-817', 'slug' => 'gh817-'.bin2hex(random_bytes(4)),
            'site_type' => 'golf', 'created_by_user_id' => $user->id, 'modified_by_user_id' => $user->id,
        ]);
        $site->users()->attach($user->id, ['role' => 'manager']);
        $user->forceFill(['last_active_site_id' => $site->id])->save();
        $this->giveTheSiteWhatTheLockNeeds($site);
        $zones = [];
        foreach ($names as $name) {
            $zones[$name] = app(ZoneService::class)->resolveOrCreate($site, $name, $user->id);
        }

        return [$user->fresh(), $site, $zones];
    }
}
