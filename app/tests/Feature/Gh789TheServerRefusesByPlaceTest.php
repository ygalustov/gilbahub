<?php

namespace Tests\Feature;

use App\Models\Account;
use App\Models\Site;
use App\Models\SiteConfig;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * GH-789 (queue item 7) — A REQUIRED FIELD IS NOT SAVED EMPTY, AND THE TAB THAT DID NOT COLLECT IT IS NOT
 * REFUSED BECAUSE OF IT.
 *
 * WHAT WAS WRONG, measured on the tree before this (the analyst's census, 30.09.2026): four required inputs
 * of Settings were saved empty in silence -- the cultivar, the construction, the golf surface and the sports
 * schedule -- and three more reported "Saved." while the server kept the old value, because the browser held
 * a list of five fields it would not send empty. Four hand-written answers to "which inputs are required"
 * (the template's `required` attribute, the browser's list, this controller's list, the form's own checks),
 * and not one of them the list.
 *
 * THE OWNER'S DECISION, 29.09.2026: a required field is not saved empty and is marked red.
 *
 * AND BY PLACE, which is her "as usual in settings": each tab answers for its own fields. Saving Site
 * settings is not refused because the cultivar on the Turf tab is empty -- that is the case below that would
 * pass on a server judging the whole config, and it is the one the reviewer's mutation is aimed at.
 */
class Gh789TheServerRefusesByPlaceTest extends TestCase
{
    use RefreshDatabase;

    public function test_the_turf_tab_is_refused_for_its_own_empty_field_and_nothing_is_written(): void
    {
        [$user, $site] = $this->siteOf('sports');
        $before = $this->config($site);

        $answer = $this->actingAs($user)->patchJson('/api/sites/'.$site->id.'/config/gaip', [
            'place' => 'settings.turf',
            'patch' => ['turf' => ['species' => 'Perennial Ryegrass']],
            'clear' => ['turf.variety'],
        ])->assertStatus(422);
        fwrite(STDOUT, PHP_EOL.'[gh789] the Turf tab with an empty cultivar -> '.$answer->json('message').PHP_EOL);

        $answer->assertJsonPath('missing', [['input' => 'turf.variety', 'label' => 'the cultivar or variety']]);
        // NOT ONE FIELD of the form was written, which is what "not saved" has to mean.
        $this->assertSame($before, $this->config($site));
    }

    /** THE CONTROL: the same tab, with the field answered, saves. */
    public function test_the_same_save_goes_through_when_the_field_is_answered(): void
    {
        [$user, $site] = $this->siteOf('sports');

        $this->actingAs($user)->patchJson('/api/sites/'.$site->id.'/config/gaip', [
            'place' => 'settings.turf',
            'patch' => ['turf' => ['species' => 'Perennial Ryegrass', 'variety' => 'Colosseum']],
        ])->assertOk();

        $this->assertSame('Colosseum', $this->config($site)['turf']['variety']);
    }

    /**
     * BY PLACE, AND THIS IS THE CASE THE WHOLE DESIGN RESTS ON: the Site tab saves while the cultivar on
     * the Turf tab is empty. A server judging the whole config would refuse it, and a person would be
     * unable to save their coordinates until they had answered a field on another tab.
     */
    public function test_the_site_tab_saves_while_another_tabs_field_is_empty(): void
    {
        [$user, $site] = $this->siteOf('sports');
        // The cultivar is emptied first, from its own tab, which is refused -- so it is emptied in the
        // database directly to build the state this case is about: a site that HAS an empty required field.
        $config = $this->config($site);
        unset($config['turf']['variety']);
        SiteConfig::query()->where('site_id', $site->id)->where('namespace', 'gaip')
            ->update(['config' => $config]);

        $answer = $this->actingAs($user)->patchJson('/api/sites/'.$site->id.'/config/gaip', [
            'place' => 'settings.site',
            'patch' => ['location' => ['lat' => -35.0, 'lon' => 149.0]],
        ]);
        fwrite(STDOUT, '[gh789] the Site tab, with the cultivar empty on another tab -> HTTP '
            .$answer->status().PHP_EOL);

        $answer->assertOk();
        $this->assertEquals(-35.0, $this->config($site)['location']['lat']);
    }

    /** The Site tab IS refused for its own: the coordinates the whole climate rests on. */
    public function test_the_site_tab_is_refused_without_coordinates(): void
    {
        [$user, $site] = $this->siteOf('sports');

        $answer = $this->actingAs($user)->patchJson('/api/sites/'.$site->id.'/config/gaip', [
            'place' => 'settings.site',
            'clear' => ['location.lat', 'location.lon'],
        ])->assertStatus(422);
        fwrite(STDOUT, '[gh789] the Site tab with no coordinates -> '.$answer->json('message').PHP_EOL);

        $this->assertSame(['location.lat', 'location.lon'], array_column($answer->json('missing'), 'input'));
    }

    /** A GOLF SURFACE IS ITS OWN TYPE'S OBLIGATION: refused for golf, accepted for the other two. */
    public function test_the_surface_is_required_of_golf_and_of_nobody_else(): void
    {
        $answers = [];
        foreach (['golf', 'sports', 'lawns'] as $turfType) {
            [$user, $site] = $this->siteOf($turfType);
            $answer = $this->actingAs($user)->patchJson('/api/sites/'.$site->id.'/config/gaip', [
                'place' => 'settings.turf',
                'clear' => ['turf.subCategory'],
            ]);
            $answers[$turfType] = [$answer->status(), array_column((array) $answer->json('missing'), 'input')];
            fwrite(STDOUT, '[gh789] '.str_pad($turfType, 7).' clearing its surface -> HTTP '
                .$answer->status().' '.json_encode($answers[$turfType][1]).PHP_EOL);
        }

        $this->assertSame([422, ['turf.subCategory']], $answers['golf']);
        $this->assertSame([200, []], $answers['sports']);
        $this->assertSame([200, []], $answers['lawns']);
    }

    /** AND THE SCHEDULE IS SPORTS' OWN, on the tab that collects it. */
    public function test_the_schedule_is_required_of_sports_on_its_own_tab(): void
    {
        $answers = [];
        foreach (['sports', 'golf'] as $turfType) {
            [$user, $site] = $this->siteOf($turfType);
            $answer = $this->actingAs($user)->patchJson('/api/sites/'.$site->id.'/config/gaip', [
                'place' => 'settings.trafficAndWear',
                'patch' => ['traffic' => ['schedule' => ['matchesPerWeek' => null]]],
                'clear' => ['traffic.schedule'],
            ]);
            $answers[$turfType] = [$answer->status(), array_column((array) $answer->json('missing'), 'input')];
            fwrite(STDOUT, '[gh789] '.str_pad($turfType, 7).' clearing its schedule -> HTTP '
                .$answer->status().' '.json_encode($answers[$turfType][1]).PHP_EOL);
        }

        $this->assertSame([422, ['traffic.schedule']], $answers['sports']);
        $this->assertSame([200, []], $answers['golf']);
    }

    /**
     * AN INPUT WHOSE OBLIGATION THE OWNER HAS NOT SETTLED IS NOT REQUIRED BY ANYBODY. `turf.nProgram`
     * carries `required: null`, which is the honest third answer, and a save is not refused over it.
     */
    public function test_an_undecided_input_does_not_refuse_a_save(): void
    {
        [$user, $site] = $this->siteOf('sports');

        $answer = $this->actingAs($user)->patchJson('/api/sites/'.$site->id.'/config/gaip', [
            'place' => 'settings.turf',
            'clear' => ['turf.nProgram'],
        ]);
        fwrite(STDOUT, '[gh789] clearing the annual nitrogen figure -> HTTP '.$answer->status().PHP_EOL);

        $answer->assertOk();
    }

    /**
     * A WRITE WITH NO PLACE AT ALL still cannot empty a required input it touches -- which is what replaced
     * `GAIP_IDENTITY_FIELDS`, and it reaches further than that list did: five names against nine inputs, and
     * the list knows that a golf surface belongs to golf.
     */
    public function test_a_write_with_no_place_may_not_empty_a_required_input_it_touches(): void
    {
        [$user, $site] = $this->siteOf('sports');

        $this->actingAs($user)->patchJson('/api/sites/'.$site->id.'/config/gaip', [
            'clear' => ['turf.species'],
        ])->assertStatus(422)->assertJsonPath('missing.0.input', 'turf.species');

        // And it may still write a field nothing requires, so the refusal is about the obligation.
        $this->actingAs($user)->patchJson('/api/sites/'.$site->id.'/config/gaip', [
            'patch' => ['turf' => ['hoc' => 12]],
        ])->assertOk();
    }

    /** @return array<string,mixed> */
    private function config(Site $site): array
    {
        $row = SiteConfig::query()->where('site_id', $site->id)->where('namespace', 'gaip')->first();
        $config = is_array($row?->config) ? $row->config : [];
        // The server stamps this on every write; comparing it would make every case about the clock.
        unset($config['savedAt']);

        return $config;
    }

    /** @return array{0:User,1:Site} */
    private function siteOf(string $turfType): array
    {
        $user = User::factory()->create();
        $account = Account::query()->firstOrCreate(
            ['owner_user_id' => $user->id],
            ['display_name' => $user->name, 'created_by_user_id' => $user->id, 'modified_by_user_id' => $user->id]
        );
        $site = Site::query()->create([
            'account_id' => $account->id, 'name' => 'GH-789 place '.$turfType,
            'slug' => 'gh789-place-'.$turfType.'-'.substr(bin2hex(random_bytes(6)), 0, 8),
            'site_type' => 'sports', 'timezone' => 'UTC', 'latitude' => -35.28, 'longitude' => 149.13,
            'created_by_user_id' => $user->id, 'modified_by_user_id' => $user->id,
        ]);
        $site->users()->attach($user->id, ['role' => 'manager']);
        $config = $this->configThePageLockAccepts(['turf' => ['turfType' => $turfType]]);
        $config['turf']['nProgram'] = 250;
        SiteConfig::query()->create([
            'site_id' => $site->id, 'namespace' => 'gaip', 'config' => $config, 'synced_at' => now(),
        ]);

        return [$user, $site->fresh()];
    }
}
