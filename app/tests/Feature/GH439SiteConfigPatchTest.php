<?php

namespace Tests\Feature;

use App\Models\Account;
use App\Models\Site;
use App\Models\SiteConfig;
use App\Models\User;
use Illuminate\Foundation\Http\Middleware\ConvertEmptyStringsToNull;
use Illuminate\Foundation\Http\Middleware\TrimStrings;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Log;
use Tests\TestCase;

/**
 * GH-439 (2.1) — PATCH /api/sites/{site}/config/gaip.
 *
 * The route a page uses to say what changed. Everything it does not mention
 * stays as the database has it: that is the whole point, and it is what the
 * whole-object PUT could not do -- a page that pushed a config assembled
 * before the server's own had arrived deleted the wizard section, the
 * traffic schedule and whatever else it had never been told about.
 *
 * The rules under test are the contract's, in its order: a white list of
 * top-level keys, one-level merge for object sections, absent means
 * untouched, null refused in favour of `clear`, identity fields that cannot
 * be emptied at all, and GH-371's rules for the cached programme carried
 * over unchanged from the PUT path.
 */
class GH439SiteConfigPatchTest extends TestCase
{
    use RefreshDatabase;

    public function test_an_object_section_merges_field_by_field(): void
    {
        $user = User::factory()->create();
        $site = $this->siteWithConfig($user, [
            'turf' => ['species' => 'Perennial Ryegrass', 'methodology' => 'mlsn', 'hoc' => 25],
        ]);

        $this->patchConfig($user, $site, ['patch' => ['turf' => ['hoc' => 12]]])
            ->assertOk()
            ->assertJsonPath('data.config.turf.hoc', 12)
            ->assertJsonPath('data.config.turf.species', 'Perennial Ryegrass')
            ->assertJsonPath('data.config.turf.methodology', 'mlsn');
    }

    public function test_a_key_the_patch_does_not_mention_is_untouched(): void
    {
        $user = User::factory()->create();
        $site = $this->siteWithConfig($user, [
            'turf' => ['species' => 'Couch', 'methodology' => 'mlsn'],
            'wizard' => ['complete' => true, 'version' => '1.0'],
            'traffic' => ['schedule' => ['mon' => 4]],
            'maxNPerMonth' => 30,
        ]);

        $this->patchConfig($user, $site, ['patch' => ['turf' => ['methodology' => 'ammonium_acetate']]])
            ->assertOk()
            ->assertJsonPath('data.config.wizard.complete', true)
            ->assertJsonPath('data.config.traffic.schedule.mon', 4)
            ->assertJsonPath('data.config.maxNPerMonth', 30)
            ->assertJsonPath('data.config.turf.methodology', 'ammonium_acetate');
    }

    public function test_a_scalar_and_an_array_are_replaced_whole(): void
    {
        $user = User::factory()->create();
        $site = $this->siteWithConfig($user, [
            'alertContacts' => ['a@example.com', 'b@example.com'],
            'multiSiteTurf' => true,
        ]);

        $this->patchConfig($user, $site, ['patch' => [
            'alertContacts' => ['c@example.com'],
            'multiSiteTurf' => false,
        ]])
            ->assertOk()
            ->assertJsonPath('data.config.alertContacts', ['c@example.com'])
            ->assertJsonPath('data.config.multiSiteTurf', false);
    }

    public function test_an_unknown_key_is_refused_and_named(): void
    {
        $user = User::factory()->create();
        $site = $this->siteWithConfig($user, ['turf' => ['species' => 'Couch']]);

        $response = $this->patchConfig($user, $site, ['patch' => [
            'turf' => ['species' => 'Kikuyu'],
            'somethingTheClientInvented' => 1,
        ]])->assertStatus(422);

        $this->assertSame(['somethingTheClientInvented'], $response->json('invalid_keys'));
        $this->assertStringContainsString('somethingTheClientInvented', $response->json('message'));
        // And nothing was written.
        $this->assertSame('Couch', $this->config($site)['turf']['species']);
    }

    public function test_saved_at_is_stamped_by_the_server_and_refused_from_the_client(): void
    {
        $user = User::factory()->create();
        $site = $this->siteWithConfig($user, ['turf' => ['species' => 'Couch']]);

        $this->patchConfig($user, $site, ['patch' => [
            'turf' => ['species' => 'Kikuyu'],
            'savedAt' => '2020-01-01T00:00:00.000Z',
        ]])->assertStatus(422);

        $response = $this->patchConfig($user, $site, ['patch' => ['turf' => ['species' => 'Kikuyu']]])
            ->assertOk();

        $this->assertNotSame('2020-01-01T00:00:00.000Z', $response->json('data.config.savedAt'));
        $this->assertNotEmpty($response->json('data.config.savedAt'));
    }

    public function test_null_is_refused_at_the_top_level_and_inside_a_section(): void
    {
        $user = User::factory()->create();
        $site = $this->siteWithConfig($user, [
            'pgr' => ['enabled' => true, 'gddThreshold' => 250],
            'turf' => ['species' => 'Couch', 'companionSpecies' => 'Ryegrass'],
        ]);

        $this->patchConfig($user, $site, ['patch' => ['pgr' => null]])
            ->assertStatus(422)
            ->assertJsonPath('invalid_keys', ['pgr']);

        $this->patchConfig($user, $site, ['patch' => ['turf' => ['companionSpecies' => null]]])
            ->assertStatus(422)
            ->assertJsonPath('invalid_keys', ['turf.companionSpecies']);

        $this->assertSame('Ryegrass', $this->config($site)['turf']['companionSpecies']);
        $this->assertTrue($this->config($site)['pgr']['enabled']);
    }

    public function test_an_identity_field_cannot_be_emptied(): void
    {
        // This test disables two framework middleware, and the reason is the
        // whole point of it. Over HTTP an empty string arrives as null
        // (TrimStrings, then ConvertEmptyStringsToNull -- pinned by
        // test_an_empty_string_never_reaches_this_route_... below), and the
        // null rule refuses the request before the identity rule is ever
        // consulted. Both rules answer 422 naming the same key, so a test
        // that only reads the status and invalid_keys passes whether the
        // identity rule exists or not -- verified by deleting the rule and
        // watching the earlier version of this test stay green.
        //
        // Without the conversion the request carries the empty string the
        // contract describes, and the identity rule is the only thing that
        // can refuse it. The message is asserted for the same reason: it is
        // what tells the two rules apart.
        $this->withoutMiddleware([TrimStrings::class, ConvertEmptyStringsToNull::class]);

        $user = User::factory()->create();
        $site = $this->siteWithConfig($user, [
            'turf' => ['species' => 'Perennial Ryegrass', 'methodology' => 'mlsn', 'turfType' => 'sports'],
            'location' => ['name' => 'Auckland, New Zealand', 'lat' => -36.8508827, 'lon' => 174.7644881],
        ]);

        foreach ([['species', 'Perennial Ryegrass'], ['methodology', 'mlsn'], ['turfType', 'sports']] as [$field, $stored]) {
            $response = $this->patchConfig($user, $site, ['patch' => ['turf' => [$field => '']]])
                ->assertStatus(422)
                ->assertJsonPath('invalid_keys', ['turf.'.$field]);

            $this->assertStringContainsString('cannot be emptied', $response->json('message'), 'turf.'.$field);
            $this->assertSame($stored, $this->config($site)['turf'][$field]);
        }

        $response = $this->patchConfig($user, $site, ['patch' => ['location' => ['lat' => '']]])
            ->assertStatus(422)
            ->assertJsonPath('invalid_keys', ['location.lat']);
        $this->assertStringContainsString('cannot be emptied', $response->json('message'));
        $this->assertSame(-36.8508827, $this->config($site)['location']['lat']);
    }

    public function test_the_null_rule_and_the_identity_rule_give_different_answers(): void
    {
        // The two rules refuse different things and must stay distinguishable:
        // null anywhere means "use clear instead", an empty identity field
        // means "this one cannot be emptied at all, by any route". Without
        // this pin the rules can collapse into one another unnoticed, because
        // both produce a 422 carrying the same key.
        $this->withoutMiddleware([TrimStrings::class, ConvertEmptyStringsToNull::class]);

        $user = User::factory()->create();
        $site = $this->siteWithConfig($user, [
            'turf' => ['species' => 'Perennial Ryegrass', 'variety' => 'generic'],
        ]);

        $nullAnswer = $this->patchConfig($user, $site, ['patch' => ['turf' => ['variety' => null]]])
            ->assertStatus(422)
            ->json('message');
        $identityAnswer = $this->patchConfig($user, $site, ['patch' => ['turf' => ['species' => '']]])
            ->assertStatus(422)
            ->json('message');

        $this->assertStringContainsString('clear', $nullAnswer);
        $this->assertStringNotContainsString('cannot be emptied', $nullAnswer);
        $this->assertStringContainsString('cannot be emptied', $identityAnswer);
    }

    public function test_an_empty_string_never_reaches_this_route_and_text_is_emptied_with_clear(): void
    {
        // The contract calls an empty string "erase this text", distinct from
        // null. Over HTTP that distinction does not survive the request:
        // Laravel's own TrimStrings and ConvertEmptyStringsToNull middleware
        // turn "" into null before any controller sees it, so a patch that
        // tries to blank a field is refused exactly like one sending null.
        // Emptying a field is `clear`, which is what decision 6 asked for
        // anyway; this test pins that reality so the client stage does not
        // ship a form that silently 422s.
        $user = User::factory()->create();
        $site = $this->siteWithConfig($user, [
            'turf' => ['species' => 'Couch', 'variety' => 'Wintergreen'],
        ]);

        $this->patchConfig($user, $site, ['patch' => ['turf' => ['variety' => '']]])
            ->assertStatus(422)
            ->assertJsonPath('invalid_keys', ['turf.variety']);

        $this->patchConfig($user, $site, ['clear' => ['turf.variety']])
            ->assertOk();

        $config = $this->config($site);
        $this->assertArrayNotHasKey('variety', $config['turf']);
        $this->assertSame('Couch', $config['turf']['species']);
    }

    public function test_clear_removes_a_section_and_a_field(): void
    {
        $user = User::factory()->create();
        $site = $this->siteWithConfig($user, [
            'pgr' => ['enabled' => true, 'gddThreshold' => 250],
            'turf' => ['species' => 'Couch', 'companionSpecies' => 'Ryegrass'],
        ]);

        $this->patchConfig($user, $site, ['clear' => ['pgr', 'turf.companionSpecies']])
            ->assertOk();

        $config = $this->config($site);
        $this->assertArrayNotHasKey('pgr', $config);
        $this->assertArrayNotHasKey('companionSpecies', $config['turf']);
        $this->assertSame('Couch', $config['turf']['species']);
    }

    public function test_clear_refuses_the_sections_and_fields_a_site_cannot_work_without(): void
    {
        $user = User::factory()->create();
        $site = $this->siteWithConfig($user, [
            'turf' => ['species' => 'Couch', 'methodology' => 'mlsn'],
            'location' => ['name' => 'Sydney', 'lat' => -33.8688, 'lon' => 151.2093],
            'wizard' => ['complete' => true],
        ]);

        foreach ([['turf'], ['location'], ['wizard'], ['turf.species'], ['turf.methodology'], ['location.lat'], ['location.lon'], ['notAKey']] as $clear) {
            $this->patchConfig($user, $site, ['clear' => $clear])
                ->assertStatus(422)
                ->assertJsonPath('invalid_keys', $clear);
        }

        $config = $this->config($site);
        $this->assertSame('Couch', $config['turf']['species']);
        $this->assertSame(-33.8688, $config['location']['lat']);
        $this->assertTrue($config['wizard']['complete']);
    }

    public function test_an_unstamped_programme_is_discarded_and_the_stored_one_kept(): void
    {
        $user = User::factory()->create();
        $site = $this->siteWithConfig($user, [
            'location' => ['name' => 'Sydney', 'lat' => -33.8688, 'lon' => 151.2093],
            'nutritionCalendarProgram' => ['months' => ['jan' => 10]],
            'nutritionProgramCoords' => ['lat' => -33.8688, 'lon' => 151.2093],
        ], ['latitude' => -33.8688, 'longitude' => 151.2093]);

        $this->patchConfig($user, $site, ['patch' => [
            'nutritionCalendarProgram' => ['months' => ['jan' => 999]],
        ]])->assertOk();

        $this->assertSame(10, $this->config($site)['nutritionCalendarProgram']['months']['jan']);
    }

    public function test_a_freshly_stamped_programme_is_accepted(): void
    {
        $user = User::factory()->create();
        $site = $this->siteWithConfig($user, [
            'location' => ['name' => 'Sydney', 'lat' => -33.8688, 'lon' => 151.2093],
        ], ['latitude' => -33.8688, 'longitude' => 151.2093]);

        $this->patchConfig($user, $site, ['patch' => [
            'nutritionCalendarProgram' => ['months' => ['jan' => 12]],
            'nutritionProgramCoords' => ['lat' => -33.8688, 'lon' => 151.2093],
            'maxNPerMonth' => 30,
        ]])->assertOk();

        $config = $this->config($site);
        $this->assertSame(12, $config['nutritionCalendarProgram']['months']['jan']);
        $this->assertSame(30, $config['maxNPerMonth']);
    }

    public function test_moving_the_site_syncs_the_site_row_and_drops_the_cached_programme(): void
    {
        $user = User::factory()->create();
        $site = $this->siteWithConfig($user, [
            'location' => ['name' => 'Sydney', 'lat' => -33.8688, 'lon' => 151.2093],
            'nutritionProgram' => ['products' => ['urea']],
            'nutritionCalendarProgram' => ['months' => ['jan' => 10]],
            'nutritionProgramCoords' => ['lat' => -33.8688, 'lon' => 151.2093],
        ], ['latitude' => -33.8688, 'longitude' => 151.2093]);

        $this->patchConfig($user, $site, ['patch' => [
            'location' => ['name' => 'Auckland, New Zealand', 'lat' => -36.8508827, 'lon' => 174.7644881],
        ]])->assertOk();

        $config = $this->config($site);
        $this->assertArrayNotHasKey('nutritionProgram', $config);
        $this->assertArrayNotHasKey('nutritionCalendarProgram', $config);
        $this->assertArrayNotHasKey('nutritionProgramCoords', $config);

        $site->refresh();
        $this->assertSame(-36.8508827, (float) $site->latitude);
        $this->assertSame(174.7644881, (float) $site->longitude);
        $this->assertSame('Auckland, New Zealand', $site->location_name);
    }

    public function test_moving_the_site_with_a_trusted_programme_drops_the_keys_that_patch_does_not_carry(): void
    {
        // GH-440 (GH-439 review): the patch brings a calendar programme
        // stamped for the new location, which is trusted -- but the stored
        // nutritionProgram was computed for the old one and the patch says
        // nothing about it. On the whole-object PUT an omitted key was a
        // deleted key, so this could not survive; on a PATCH it can, and must
        // not.
        $user = User::factory()->create();
        $site = $this->siteWithConfig($user, [
            'location' => ['name' => 'Sydney', 'lat' => -33.8688, 'lon' => 151.2093],
            'nutritionProgram' => ['products' => ['urea']],
            'nutritionCalendarProgram' => ['months' => ['jan' => 10]],
            'nutritionProgramCoords' => ['lat' => -33.8688, 'lon' => 151.2093],
        ], ['latitude' => -33.8688, 'longitude' => 151.2093]);

        $this->patchConfig($user, $site, ['patch' => [
            'location' => ['name' => 'Auckland, New Zealand', 'lat' => -36.8508827, 'lon' => 174.7644881],
            'nutritionCalendarProgram' => ['months' => ['jan' => 12]],
            'nutritionProgramCoords' => ['lat' => -36.8508827, 'lon' => 174.7644881],
        ]])->assertOk();

        $config = $this->config($site);
        $this->assertSame(12, $config['nutritionCalendarProgram']['months']['jan']);
        $this->assertSame(-36.8508827, $config['nutritionProgramCoords']['lat']);
        $this->assertArrayNotHasKey('nutritionProgram', $config);
    }

    public function test_a_no_op_location_resave_keeps_the_cached_programme(): void
    {
        $user = User::factory()->create();
        $site = $this->siteWithConfig($user, [
            'location' => ['name' => 'Sydney', 'lat' => -33.8688, 'lon' => 151.2093],
            'nutritionCalendarProgram' => ['months' => ['jan' => 10]],
            'nutritionProgramCoords' => ['lat' => -33.8688, 'lon' => 151.2093],
        ], ['latitude' => -33.8688, 'longitude' => 151.2093]);

        $this->patchConfig($user, $site, ['patch' => [
            'location' => ['name' => 'Sydney', 'lat' => -33.8688, 'lon' => 151.2093],
        ]])->assertOk();

        $this->assertSame(10, $this->config($site)['nutritionCalendarProgram']['months']['jan']);
    }

    public function test_a_stale_tabs_two_writes_cannot_leave_a_programme_from_another_location(): void
    {
        // GH-440 (review): the whole path, as a stale tab actually walks it.
        //
        // The tab computed both objects against the site's OLD coordinates.
        // Its first write -- the calendar, stamped where it was computed --
        // is refused, because that stamp is not where the site is. Its second
        // write is the product programme built from that same refused
        // calendar. Both must fail to land: a programme for one location
        // sitting beside a calendar for another is invisible on every read
        // path, because the staleness checks all examine the calendar.
        $user = User::factory()->create();
        $site = $this->siteWithConfig($user, [
            'location' => ['name' => 'Auckland, New Zealand', 'lat' => -36.8508827, 'lon' => 174.7644881],
            'nutritionCalendarProgram' => ['months' => ['jan' => 'current'], 'meta' => ['lat' => -36.8508827, 'lon' => 174.7644881]],
            'nutritionProgram' => ['products' => ['current']],
            'nutritionProgramCoords' => ['lat' => -36.8508827, 'lon' => 174.7644881],
        ], ['latitude' => -36.8508827, 'longitude' => 174.7644881]);

        $oldLocation = ['lat' => -33.8688, 'lon' => 151.2093];

        // Write 1: the stale calendar, stamped where the tab computed it.
        $this->patchConfig($user, $site, ['patch' => [
            'nutritionCalendarProgram' => ['months' => ['jan' => 'stale'], 'meta' => $oldLocation],
            'nutritionProgramCoords' => $oldLocation,
        ]])->assertOk();

        $this->assertSame('current', $this->config($site)['nutritionCalendarProgram']['months']['jan']);

        // Write 2: the product programme built from that calendar, arriving
        // as its own event. Unstamped is how it used to arrive, and the
        // server must not supply a stamp on its behalf; stamped with where it
        // was really computed, it is refused for the same reason write 1 was.
        $this->patchConfig($user, $site, ['patch' => [
            'nutritionProgram' => ['products' => ['stale-unstamped']],
        ]])->assertOk();

        $this->assertSame(['current'], $this->config($site)['nutritionProgram']['products'],
            'an unstamped programme must not be accepted on the strength of a stamp already in the database');

        $this->patchConfig($user, $site, ['patch' => [
            'nutritionProgram' => ['products' => ['stale-stamped']],
            'nutritionProgramCoords' => $oldLocation,
        ]])->assertOk();

        $this->assertSame(['current'], $this->config($site)['nutritionProgram']['products'],
            'a programme stamped for another location must not be accepted');

        $config = $this->config($site);
        $this->assertSame(-36.8508827, $config['nutritionProgramCoords']['lat']);
        $this->assertSame('current', $config['nutritionCalendarProgram']['months']['jan']);
    }

    public function test_the_second_event_of_a_generated_programme_is_accepted_when_it_states_its_origin(): void
    {
        // The other side of the test above: the same two-write shape from a
        // page that is not stale. The product programme carries the stamp of
        // the calendar it was built from -- which is where the site is -- and
        // both writes land.
        $user = User::factory()->create();
        $site = $this->siteWithConfig($user, [
            'location' => ['name' => 'Auckland, New Zealand', 'lat' => -36.8508827, 'lon' => 174.7644881],
        ], ['latitude' => -36.8508827, 'longitude' => 174.7644881]);

        $here = ['lat' => -36.8508827, 'lon' => 174.7644881];

        $this->patchConfig($user, $site, ['patch' => [
            'nutritionCalendarProgram' => ['months' => ['jan' => 12], 'meta' => $here],
            'nutritionProgramCoords' => $here,
            'maxNPerMonth' => 30,
        ]])->assertOk();

        $this->patchConfig($user, $site, ['patch' => [
            'nutritionProgram' => ['products' => ['urea']],
            'nutritionProgramCoords' => $here,
        ]])->assertOk();

        $config = $this->config($site);
        $this->assertSame(12, $config['nutritionCalendarProgram']['months']['jan']);
        $this->assertSame(['urea'], $config['nutritionProgram']['products']);
        $this->assertSame(30, $config['maxNPerMonth']);
    }

    public function test_a_sites_first_ever_programme_is_accepted_when_its_coordinates_start_null(): void
    {
        // GH-442 (review): this regression has happened once already. A site
        // row starts with latitude/longitude NULL, so the first write that
        // brings coordinates always reports "changed" -- and an earlier
        // version of this rule refused the site's very first programme
        // because of it. The rule that prevents it lives on the PATCH route
        // now and had no test there.
        $user = User::factory()->create();
        $site = $this->siteWithConfig($user, [
            'turf' => ['species' => 'Perennial Ryegrass'],
        ], ['latitude' => null, 'longitude' => null]);

        $here = ['lat' => -36.8508827, 'lon' => 174.7644881];

        $this->patchConfig($user, $site, ['patch' => [
            'location' => ['name' => 'Auckland, New Zealand', 'lat' => $here['lat'], 'lon' => $here['lon']],
            'nutritionCalendarProgram' => ['months' => ['jan' => 12], 'meta' => $here],
            'nutritionProgramCoords' => $here,
        ]])->assertOk();

        $config = $this->config($site);
        $this->assertSame(12, $config['nutritionCalendarProgram']['months']['jan'],
            "a site's first programme must survive its first coordinates");
        $this->assertSame($here['lat'], $config['nutritionProgramCoords']['lat']);

        $site->refresh();
        $this->assertSame($here['lat'], (float) $site->latitude);
    }

    public function test_a_malformed_coordinate_stamp_is_refused_rather_than_crashing(): void
    {
        // GH-442 (review): the stamp arrives from a client and can be any
        // shape. It is refused as untrustworthy -- not trusted, and not a 500.
        $user = User::factory()->create();
        $site = $this->siteWithConfig($user, [
            'location' => ['name' => 'Auckland, New Zealand', 'lat' => -36.8508827, 'lon' => 174.7644881],
            'nutritionCalendarProgram' => ['months' => ['jan' => 'stored'], 'meta' => ['lat' => -36.8508827, 'lon' => 174.7644881]],
        ], ['latitude' => -36.8508827, 'longitude' => 174.7644881]);

        foreach ([
            'a string' => 'not-a-stamp',
            'a number' => 42,
            'an array of numbers' => [1, 2],
            'the wrong fields' => ['latitude' => -36.85, 'longitude' => 174.76],
            'non-numeric fields' => ['lat' => 'north', 'lon' => 'east'],
        ] as $label => $stamp) {
            $this->patchConfig($user, $site, ['patch' => [
                'nutritionCalendarProgram' => ['months' => ['jan' => 'from '.$label]],
                'nutritionProgramCoords' => $stamp,
            ]])->assertOk();

            $this->assertSame('stored', $this->config($site)['nutritionCalendarProgram']['months']['jan'],
                'a programme stamped with '.$label.' must not be accepted');
        }
    }

    public function test_the_response_carries_the_merged_config(): void
    {
        $user = User::factory()->create();
        $site = $this->siteWithConfig($user, [
            'turf' => ['species' => 'Couch', 'methodology' => 'mlsn'],
            'wizard' => ['complete' => true],
        ]);

        $response = $this->patchConfig($user, $site, ['patch' => ['pgr' => ['enabled' => true]]])
            ->assertOk()
            ->assertJsonPath('data.site_id', $site->id)
            ->assertJsonPath('data.namespace', 'gaip');

        $config = $response->json('data.config');
        $this->assertSame('Couch', $config['turf']['species']);
        $this->assertTrue($config['wizard']['complete']);
        $this->assertTrue($config['pgr']['enabled']);
        $this->assertNotEmpty($response->json('data.synced_at'));
    }

    public function test_every_patch_is_logged(): void
    {
        Log::spy();

        $user = User::factory()->create();
        $site = $this->siteWithConfig($user, ['turf' => ['species' => 'Couch']]);

        $this->patchConfig($user, $site, [
            'patch' => ['turf' => ['methodology' => 'ammonium_acetate']],
            'clear' => ['pgr'],
        ])->assertOk();

        Log::shouldHaveReceived('info')
            ->once()
            ->withArgs(function ($message, $context) use ($site, $user) {
                return $message === 'site-config.patch'
                    && $context['site_id'] === $site->id
                    && $context['user_id'] === $user->id
                    && $context['keys'] === ['turf']
                    && $context['clear'] === ['pgr'];
            });
    }

    public function test_a_viewer_cannot_patch_the_config(): void
    {
        $owner = User::factory()->create();
        $viewer = User::factory()->create();
        $site = $this->siteWithConfig($owner, ['turf' => ['species' => 'Couch']]);
        $site->users()->attach($viewer->id, ['role' => 'viewer']);

        $this->patchConfig($viewer, $site, ['patch' => ['turf' => ['species' => 'Kikuyu']]])
            ->assertStatus(403);

        $this->assertSame('Couch', $this->config($site)['turf']['species']);
    }

    public function test_a_request_with_neither_patch_nor_clear_is_refused(): void
    {
        $user = User::factory()->create();
        $site = $this->siteWithConfig($user, ['turf' => ['species' => 'Couch']]);

        $this->patchConfig($user, $site, [])->assertStatus(422);
    }

    private function patchConfig(User $user, Site $site, array $body)
    {
        return $this->actingAs($user)
            ->withSession(['_token' => 'test-token'])
            ->patchJson('/api/sites/'.$site->id.'/config/gaip', array_merge(['_token' => 'test-token'], $body));
    }

    private function config(Site $site): array
    {
        return SiteConfig::query()
            ->where('site_id', $site->id)
            ->where('namespace', 'gaip')
            ->first()
            ->config;
    }

    private function siteWithConfig(User $user, array $config, array $siteOverrides = []): Site
    {
        $account = Account::query()->firstOrCreate(
            ['owner_user_id' => $user->id],
            [
                'display_name' => $user->name,
                'created_by_user_id' => $user->id,
                'modified_by_user_id' => $user->id,
            ]
        );

        $site = Site::query()->create(array_merge([
            'account_id' => $account->id,
            'name' => 'Config site',
            'slug' => 'config-site-'.substr((string) $user->id, -4),
            'site_type' => 'sports',
            'created_by_user_id' => $user->id,
            'modified_by_user_id' => $user->id,
        ], $siteOverrides));

        $site->users()->attach($user->id, ['role' => 'manager']);

        SiteConfig::query()->create([
            'site_id' => $site->id,
            'namespace' => 'gaip',
            'config' => $config,
            'synced_at' => now(),
        ]);

        return $site;
    }
}
