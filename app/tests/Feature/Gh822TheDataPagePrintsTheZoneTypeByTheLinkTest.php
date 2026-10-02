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
 * GH-822 (queue item "Zones", stage C4) — THE DATA PAGE PRINTS A SAMPLE'S ZONE TYPE BY THE LINK IN THE DATABASE.
 *
 * The page printed the word a sample happened to carry (`payload.zone`: "Greens", "Other") and coloured it by
 * its first letter. The owner's rule: where there is a link to a zone type, print that type, by its label from
 * the one dictionary; no plural, no list of words of its own, no guessing from a name. A zone with no type prints
 * "Type not set"; a sample with no zone prints "—".
 *
 * EVERY EXPECTATION COMES FROM THE DECLARED DICTIONARY (`zone-types.json`, read through `ZoneTypes`), not from a
 * list written here: a list written by hand would not redden on a type the page does not know.
 */
class Gh822TheDataPagePrintsTheZoneTypeByTheLinkTest extends TestCase
{
    use RefreshDatabase;

    private const NOT_SET = 'Type not set';

    public function test_each_row_prints_the_type_of_its_zone_not_the_word_it_carries_on_every_section(): void
    {
        [$user, $site] = $this->aSite();
        $typed = $this->aZone($site, 'Fairway 1', 'fairway');
        $untyped = $this->aZone($site, 'Green 9', null);
        $expected = [];
        $examined = [];
        foreach (['soil', 'tissue', 'loi'] as $section) {
            // The word the sample carries disagrees with its zone's type, so a page printing the word is told apart.
            $a = $this->aSample($site, $section, $typed, ['_label' => 'Green 3', 'zone' => 'Greens']);
            $b = $this->aSample($site, $section, $untyped, ['_label' => 'Green 9', 'zone' => 'Greens']);
            $c = $this->aSample($site, $section, null, ['_label' => 'Loose 1', 'zone' => 'Other']);
            $expected[$section] = [
                $a->id => $this->expectedFor('fairway'),
                $b->id => ['zone' => self::NOT_SET, 'zoneType' => null, 'zoneHint' => null],
                $c->id => ['zone' => '—', 'zoneType' => null, 'zoneHint' => null],
            ];
        }
        $got = [];
        foreach (['soil', 'tissue', 'loi'] as $section) {
            $got[$section] = $this->rowsPrinted($user, $section);
            $examined[] = $section.': '.count($got[$section]);
        }
        fwrite(STDOUT, '[gh822] rows examined: '.implode(', ', $examined).PHP_EOL
            .'[gh822] printed, by section and id: '.json_encode($got).PHP_EOL);

        foreach (['soil', 'tissue', 'loi'] as $section) {
            // The column and the row's data (what the sample panel reads) say the same, both from the link.
            $this->assertSame($expected[$section], $this->columnAndData($got[$section]), $section);
        }
        // What was examined, asserted: on each section one sample typed, one in a zone with no type, one with no zone.
        $census = [];
        foreach (['soil', 'tissue', 'loi'] as $section) {
            $labels = array_column($this->columnAndData($got[$section]), 'zone');
            $census[$section] = ['typed' => count(array_filter($labels, fn ($l) => is_string($l) && $l !== self::NOT_SET && $l !== '—')),
                'not set' => count(array_keys($labels, self::NOT_SET, true)), 'no zone' => count(array_keys($labels, '—', true))];
        }
        fwrite(STDOUT, '[gh822] examined: '.json_encode($census).PHP_EOL);
        $this->assertSame(array_fill_keys(['soil', 'tissue', 'loi'], ['typed' => 1, 'not set' => 1, 'no zone' => 1]), $census);
        // Water has no zone column, as before.
        $this->aSample($site, 'water', $typed, ['_label' => 'Dam', 'zone' => 'Greens']);
        $water = $this->actingAs($user)->get('/data/water');
        $this->assertSame(0, substr_count($water->getContent(), 'class="dat-zone-tag'));
    }

    public function test_every_type_of_the_dictionary_prints_its_own_label_and_area_hint_and_nothing_else_does(): void
    {
        [$user, $site] = $this->aSite();
        $expected = [];
        foreach (ZoneTypes::zoneTypeKeys() as $key) {
            $sample = $this->aSample($site, 'soil', $this->aZone($site, 'Zone '.$key, $key), ['_label' => 'Zone '.$key]);
            $expected[$sample->id] = $this->expectedFor($key);
        }
        $got = $this->columnAndData($this->rowsPrinted($user, 'soil'));
        $labels = array_values(array_unique(array_column($got, 'zone')));
        sort($labels);
        $dictionary = array_map(fn ($k) => ZoneTypes::zoneTypeLabel($k), ZoneTypes::zoneTypeKeys());
        sort($dictionary);
        fwrite(STDOUT, '[gh822] dictionary types: '.count(ZoneTypes::zoneTypeKeys()).' '.json_encode(ZoneTypes::zoneTypeKeys())
            .PHP_EOL.'[gh822] labels printed: '.json_encode($labels)
            .PHP_EOL.'[gh822] differing rows: '.json_encode(array_filter($got, fn ($v, $id) => ($expected[$id] ?? null) !== $v, ARRAY_FILTER_USE_BOTH)).PHP_EOL);

        // Both sides: no type of the dictionary is missing from the page, and the page prints no label outside it.
        $this->assertSame($dictionary, $labels);
        $this->assertSame($expected, $got);
    }

    public function test_a_type_changed_on_the_zones_tab_changes_the_label_of_every_sample_in_that_zone(): void
    {
        [$user, $site] = $this->aSite();
        $zone = $this->aZone($site, 'Green 5', 'green');
        $one = $this->aSample($site, 'soil', $zone, ['_label' => 'Green 5', 'zone' => 'Greens', '_zone' => 'green']);
        $two = $this->aSample($site, 'soil', $zone, ['_label' => 'Green 5', 'zone' => 'Greens', '_zone' => 'green']);
        $before = $this->columnAndData($this->rowsPrinted($user, 'soil'));
        $this->actingAs($user)->withSession(['_token' => 't'])
            ->patchJson('/api/sites/'.$site->id.'/zones', ['_token' => 't', 'typed' => [['id' => $zone->id, 'zoneType' => 'tee']]])
            ->assertStatus(200);
        $after = $this->columnAndData($this->rowsPrinted($user, 'soil'));
        fwrite(STDOUT, '[gh822] before the type change: '.json_encode($before).PHP_EOL.'[gh822] after: '.json_encode($after).PHP_EOL);

        $this->assertSame([$one->id => $this->expectedFor('tee'), $two->id => $this->expectedFor('tee')], $after);
    }

    public function test_a_sample_added_the_way_the_data_page_adds_it_makes_a_zone_with_no_type_and_prints_type_not_set(): void
    {
        [$user, $site] = $this->aSite();
        [$other, $otherSite] = $this->aSite();
        $this->aSample($otherSite, 'soil', $this->aZone($otherSite, 'Tee 1', 'tee'), ['_label' => 'Tee 1']);
        $otherBefore = $this->columnAndData($this->rowsPrinted($other, 'soil'));
        $this->assertNull(Zone::query()->where('site_id', $site->id)->where('name', 'Green 77')->first());

        // The body the Data page's add sends after this stage: the zone's name, no `zone` word.
        $added = $this->actingAs($user)->withSession(['_token' => 't'])->postJson('/api/samples', [
            '_token' => 't', 'site_id' => $site->id, 'sample_type' => 'soil',
            'payload' => ['_label' => 'Green 77', 'K' => 100],
        ]);
        $made = Zone::query()->where('site_id', $site->id)->where('name', 'Green 77')->first();
        $rows = $this->columnAndData($this->rowsPrinted($user, 'soil'));
        $otherAfter = $this->columnAndData($this->rowsPrinted($other, 'soil'));
        fwrite(STDOUT, '[gh822] zone made by the add: '.json_encode($made ? [$made->id, $made->name, $made->zone_type] : null)
            .'; rows printed: '.json_encode($rows)
            .'; other site: pairs before '.count($otherBefore).', after '.count($otherAfter).PHP_EOL);

        $added->assertStatus(201);
        $this->assertNotNull($made);
        $this->assertNull($made->zone_type);
        // The link, not only the label: the sample saved without a `zone` word points at the zone its name made.
        $this->assertSame($made->id, Sample::query()->findOrFail($added->json('data.id'))->zone_id);
        $this->assertSame([(int) $added->json('data.id') => ['zone' => self::NOT_SET, 'zoneType' => null, 'zoneHint' => null]], $rows);
        $this->assertSame($otherBefore, $otherAfter);
    }

    /** What the page must print for a sample in a zone of this type, from the dictionary. */
    private function expectedFor(string $key): array
    {
        return ['zone' => ZoneTypes::zoneTypeLabel($key), 'zoneType' => $key, 'zoneHint' => ZoneTypes::areaGuidance($key)['example'] ?? null];
    }

    /** @return array<int,array{column:string,data:array}> the rows the page printed, by id */
    private function rowsPrinted(User $user, string $section): array
    {
        $html = $this->actingAs($user)->get('/data/'.$section)->assertOk()->getContent();
        preg_match_all('/<tr class="dat-row" data-id="(\d+)" data-section="'.$section.'"\s+data-row="([^"]*)">(.*?)<\/tr>/s', $html, $m, PREG_SET_ORDER);
        $out = [];
        foreach ($m as $row) {
            preg_match('/<span class="dat-zone-tag[^"]*">([^<]*)<\/span>/', $row[3], $tag);
            $out[(int) $row[1]] = [
                'column' => isset($tag[1]) ? html_entity_decode(trim($tag[1]), ENT_QUOTES) : null,
                'data' => json_decode(html_entity_decode($row[2], ENT_QUOTES), true) ?? [],
            ];
        }
        ksort($out);

        return $out;
    }

    /**
     * The column and the row's data, side by side: when they agree, the label; when they do not, both -- so a page
     * whose column and panel part ways fails on the row, not silently.
     */
    private function columnAndData(array $rows): array
    {
        $out = [];
        foreach ($rows as $id => $r) {
            $d = $r['data'];
            $label = $r['column'] === ($d['zone'] ?? null) ? $r['column'] : ['column' => $r['column'], 'data' => $d['zone'] ?? null];
            $out[$id] = ['zone' => $label, 'zoneType' => $d['zoneType'] ?? null, 'zoneHint' => $d['zoneHint'] ?? null];
        }
        ksort($out);

        return $out;
    }

    private function aSample(Site $site, string $type, ?Zone $zone, array $payload): Sample
    {
        return Sample::query()->create([
            'account_id' => $site->account_id, 'site_id' => $site->id, 'zone_id' => $zone?->id, 'sample_type' => $type,
            'lab_date' => '2026-09-01', 'payload' => array_merge(['K' => 100], $payload),
            'created_by_user_id' => $site->created_by_user_id, 'modified_by_user_id' => $site->created_by_user_id,
        ]);
    }

    private function aZone(Site $site, string $name, ?string $type): Zone
    {
        $zone = app(ZoneService::class)->resolveOrCreate($site, $name, $site->created_by_user_id);
        $zone->forceFill(['zone_type' => $type])->save();

        return $zone->fresh();
    }

    private function aSite(): array
    {
        $user = User::factory()->create();
        $account = Account::query()->firstOrCreate(
            ['owner_user_id' => $user->id],
            ['display_name' => $user->name, 'created_by_user_id' => $user->id, 'modified_by_user_id' => $user->id]
        );
        $site = Site::query()->create([
            'account_id' => $account->id, 'name' => 'GH-822', 'slug' => 'gh822-'.bin2hex(random_bytes(4)),
            'site_type' => 'golf', 'created_by_user_id' => $user->id, 'modified_by_user_id' => $user->id,
        ]);
        $site->users()->attach($user->id, ['role' => 'manager']);
        $user->forceFill(['last_active_site_id' => $site->id])->save();
        $this->giveTheSiteWhatTheLockNeeds($site);

        return [$user->fresh(), $site];
    }
}
