<?php

namespace Tests\Feature;

use App\Http\Middleware\EnsureSiteIsSetUp;
use App\Models\Account;
use App\Models\Site;
use App\Models\SiteConfig;
use App\Models\User;
use App\Support\CalculationInputs;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * GH-789 (queue item 7) — NOUGHT, AN ABSENT KEY AND AN EMPTY STRING ARE THREE THINGS.
 *
 * WHY THIS EXISTS. The owner entered nought matches and nought sessions on six sports sites of the
 * stand on 30.09.2026, by the product's own route, because the list requires a schedule of a sports
 * surface and the setup wizard now asks for one. A week with no load is an answer. Every rule that
 * read it as absence would have shut those six sites out of every page the lock holds -- Settings,
 * Data, `/plan`, the reports, and the run frame, which means neither a Re-run nor an export.
 *
 * The three cases below are the three inputs the coordinator named, each with its OWN outcome, and
 * they are different outcomes rather than two verdicts and a repetition:
 *
 *   `0`            -> filled. It is stored as nought and the page group opens.
 *   no key at all  -> not filled, and a WRITE that does not mention it keeps what is stored. This is
 *                     the GH-439 class: "a key the payload omitted was a key deleted", which the
 *                     PATCH route was built to avoid and which was still true one level down, inside
 *                     `traffic.schedule`.
 *   `''`           -> not filled. Laravel turns an empty string into `null` before the controller
 *                     sees it, so this is what a form sends when a person clears the field, and the
 *                     lock holds the site until it is answered.
 *
 * WHAT IT WOULD MEAN IF THIS FILE WENT QUIET: the printed report below names the stored value and the
 * verdict for each of the three, so a case that never reached the route is told from one that did.
 */
class Gh789NoughtIsAValueAndAnAbsentKeyIsNotTest extends TestCase
{
    use RefreshDatabase;

    /** THE RULE ITSELF, asked directly — one rule, read by the lock, by the run record and by Settings. */
    public function test_the_one_rule_of_filled_answers_the_three_of_them_differently(): void
    {
        $verdicts = [
            'nought matches' => CalculationInputs::isFilled('traffic.schedule', ['matchesPerWeek' => 0]),
            'nought sessions' => CalculationInputs::isFilled('traffic.schedule', ['sessionsPerWeek' => 0]),
            'no key of either' => CalculationInputs::isFilled('traffic.schedule', ['sport' => 'afl']),
            'an empty object' => CalculationInputs::isFilled('traffic.schedule', []),
            'both null' => CalculationInputs::isFilled('traffic.schedule',
                ['matchesPerWeek' => null, 'sessionsPerWeek' => null]),
            'an empty string' => CalculationInputs::isFilled('traffic.schedule', ['matchesPerWeek' => '']),
            'a string of spaces' => CalculationInputs::isFilled('traffic.schedule', ['matchesPerWeek' => '  ']),
            'a real number' => CalculationInputs::isFilled('traffic.schedule', ['matchesPerWeek' => 2]),
        ];
        fwrite(STDOUT, PHP_EOL.'[gh789] one rule of "filled", asked eight ways:'.PHP_EOL);
        foreach ($verdicts as $what => $verdict) {
            fwrite(STDOUT, '[gh789]   '.str_pad($what, 20).' -> '.($verdict ? 'FILLED' : 'not filled').PHP_EOL);
        }

        $this->assertTrue($verdicts['nought matches'], 'nought matches a week is an answer');
        $this->assertTrue($verdicts['nought sessions']);
        $this->assertTrue($verdicts['a real number']);
        $this->assertFalse($verdicts['no key of either']);
        $this->assertFalse($verdicts['an empty object']);
        $this->assertFalse($verdicts['both null']);
        $this->assertFalse($verdicts['an empty string']);
        $this->assertFalse($verdicts['a string of spaces']);

        /**
         * AND THE FIELDS THAT DECIDE IT ARE DECLARED, not written in the rule. A rule holding its own
         * two field names would be a second declaration of the same fact, and this whole queue item is
         * about there being one.
         */
        $this->assertSame(['matchesPerWeek', 'sessionsPerWeek'],
            CalculationInputs::filledWhenAnyOf('traffic.schedule'));
    }

    /** THE LOCK, on the same three, because the rule is only worth anything where it is read. */
    public function test_the_lock_opens_on_nought_and_holds_on_the_other_two(): void
    {
        $cases = [
            'nought and nought' => ['matchesPerWeek' => 0, 'sessionsPerWeek' => 0],
            'no schedule at all' => null,
            'a schedule of other fields' => ['sport' => 'afl', 'ageGroup' => 'adult'],
            'an emptied field' => ['matchesPerWeek' => null, 'sessionsPerWeek' => null],
        ];
        $held = [];
        foreach ($cases as $what => $schedule) {
            [, $site] = $this->sportsSiteWith($schedule);
            $missing = EnsureSiteIsSetUp::missingInputs($site);
            $held[$what] = $missing;
            fwrite(STDOUT, '[gh789] the lock, with '.str_pad($what, 28).' -> '
                .($missing === [] ? 'opens' : 'holds: '.implode(', ', $missing)).PHP_EOL);
        }

        // The control first: the gate DOES open, or "holds" below would be the answer of a gate that
        // never opens for anything.
        $this->assertSame([], $held['nought and nought']);
        $this->assertSame(['traffic.schedule'], $held['no schedule at all']);
        $this->assertSame(['traffic.schedule'], $held['a schedule of other fields']);
        $this->assertSame(['traffic.schedule'], $held['an emptied field']);
    }

    /** A GOLF SITE AND A LAWN ARE NOT ASKED, which is what makes the case above about sports. */
    public function test_a_golf_site_and_a_lawn_are_not_held_for_a_schedule(): void
    {
        $report = [];
        foreach (['golf' => 'greens', 'lawns' => null] as $turfType => $subCategory) {
            [, $site] = $this->siteWithTurf($turfType, $subCategory, null);
            $report[$turfType] = EnsureSiteIsSetUp::missingInputs($site);
            fwrite(STDOUT, '[gh789] a '.$turfType.' site with no schedule -> '
                .($report[$turfType] === [] ? 'opens' : 'holds: '.implode(', ', $report[$turfType])).PHP_EOL);
        }

        $this->assertSame([], $report['golf']);
        $this->assertSame([], $report['lawns']);

        /**
         * GH-789 — AND THE GOLF SURFACE IS NOW HELD BY THE SAME DERIVATION, which is the other half of
         * this item: the wizard used to hold it with a line of its own and the lock did not ask for it
         * at all, so a golf site created past the wizard walked straight through.
         */
        [, $noSurface] = $this->siteWithTurf('golf', null, null);
        $heldForSurface = EnsureSiteIsSetUp::missingInputs($noSurface);
        fwrite(STDOUT, '[gh789] a golf site with no surface -> '
            .($heldForSurface === [] ? 'opens' : 'holds: '.implode(', ', $heldForSurface)).PHP_EOL);
        $this->assertSame(['turf.subCategory'], $heldForSurface);
    }

    /**
     * THE WRITE, and the third outcome is here: a key the request does not mention is KEPT.
     *
     * `buildGaipPatchResult` merged a section one level and stopped, so a patch carrying
     * `traffic.schedule` replaced the stored schedule whole. The wizard sends two numbers and nothing
     * else, on purpose -- the rest of a schedule is Settings' business and a default here would be a
     * choice nobody made -- so without this the two numbers would have taken seventeen other fields
     * with them, five of which are the declared storage of three other inputs of the list.
     */
    public function test_a_patch_of_two_numbers_keeps_the_rest_of_the_schedule(): void
    {
        [$user, $site] = $this->sportsSiteWith([
            'sport' => 'afl', 'ageGroup' => 'adult', 'moisture' => 'optimal',
            'rootDepth' => 90, 'cleggMean' => 72, 'matchesPerWeek' => null,
        ]);

        $answer = $this->actingAs($user)->patchJson('/api/sites/'.$site->id.'/config/gaip', [
            'patch' => ['traffic' => ['schedule' => ['matchesPerWeek' => 0, 'sessionsPerWeek' => 0]]],
        ]);
        $answer->assertSuccessful();

        $stored = SiteConfig::query()->where('site_id', $site->id)->where('namespace', 'gaip')
            ->first()->config['traffic']['schedule'] ?? [];
        ksort($stored);
        fwrite(STDOUT, '[gh789] after a patch of two numbers, the schedule holds: '
            .json_encode($stored).PHP_EOL);

        // The two that were sent.
        $this->assertSame(0, $stored['matchesPerWeek']);
        $this->assertSame(0, $stored['sessionsPerWeek']);
        // AND THE FIVE THAT WERE NOT. Each named, because a count would pass on five wrong ones.
        $this->assertSame('afl', $stored['sport'] ?? null);
        $this->assertSame('adult', $stored['ageGroup'] ?? null);
        $this->assertSame('optimal', $stored['moisture'] ?? null, 'this is the storage of soil.moisture');
        $this->assertSame(90, $stored['rootDepth'] ?? null, 'this is the storage of the root depth input');
        $this->assertSame(72, $stored['cleggMean'] ?? null, 'this is the storage of soil.compaction');
        // And the site is set up now, which is what the write was for.
        $this->assertSame([], EnsureSiteIsSetUp::missingInputs($site->fresh()));
    }

    /**
     * THE OTHER DIRECTION, and it is what makes the case above mean something: a field the request DOES
     * mention is overwritten. Without this, "the schedule survives a patch" could be true because the
     * route had stopped writing schedules at all.
     */
    public function test_a_field_the_patch_does_mention_is_overwritten(): void
    {
        [$user, $site] = $this->sportsSiteWith(['sport' => 'afl', 'matchesPerWeek' => 4]);

        $this->actingAs($user)->patchJson('/api/sites/'.$site->id.'/config/gaip', [
            'patch' => ['traffic' => ['schedule' => ['matchesPerWeek' => 0, 'sport' => 'soccer']]],
        ])->assertSuccessful();

        $stored = SiteConfig::query()->where('site_id', $site->id)->where('namespace', 'gaip')
            ->first()->config['traffic']['schedule'] ?? [];
        fwrite(STDOUT, '[gh789] a patch that names two fields leaves: '.json_encode($stored).PHP_EOL);

        $this->assertSame(0, $stored['matchesPerWeek']);
        $this->assertSame('soccer', $stored['sport']);
    }

    /** A sports site whose config the lock accepts in every other respect. */
    private function sportsSiteWith(?array $schedule): array
    {
        return $this->siteWithTurf('sports', null, $schedule);
    }

    /** @return array{0:User,1:Site} */
    private function siteWithTurf(string $turfType, ?string $subCategory, ?array $schedule): array
    {
        $user = User::factory()->create();
        $account = Account::query()->firstOrCreate(
            ['owner_user_id' => $user->id],
            ['display_name' => $user->name, 'created_by_user_id' => $user->id, 'modified_by_user_id' => $user->id]
        );
        $site = Site::query()->create([
            'account_id' => $account->id, 'name' => 'GH-789 site',
            'slug' => 'gh789-'.$turfType.'-'.substr(bin2hex(random_bytes(6)), 0, 8),
            'site_type' => 'sports', 'timezone' => 'UTC', 'latitude' => -35.28, 'longitude' => 149.13,
            'created_by_user_id' => $user->id, 'modified_by_user_id' => $user->id,
        ]);
        $site->users()->attach($user->id, ['role' => 'manager']);

        // The shared fixture answers everything the list requires, so the only thing in question below
        // is the schedule (or, for golf, the surface).
        $config = $this->configThePageLockAccepts(['turf' => ['turfType' => $turfType]]);
        $config['turf']['turfType'] = $turfType;
        if ($subCategory === null) {
            unset($config['turf']['subCategory']);
        } else {
            $config['turf']['subCategory'] = $subCategory;
        }
        if ($schedule === null) {
            unset($config['traffic']);
        } else {
            $config['traffic'] = ['schedule' => $schedule];
        }
        SiteConfig::query()->create([
            'site_id' => $site->id, 'namespace' => 'gaip', 'config' => $config, 'synced_at' => now(),
        ]);

        return [$user, $site->fresh()];
    }
}
