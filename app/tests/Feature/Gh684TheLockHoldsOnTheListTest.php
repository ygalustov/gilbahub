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
 * GH-684 — THE LOCK HOLDS ON THE INPUTS LIST, ONE CASE PER INPUT.
 *
 * The owner's decision: methodology is required everywhere, and the obligation is held by a
 * wizard nobody can leave. The lock is on the server because a client-side wizard cannot hold
 * it — a reload or a typed address walks around one.
 *
 * THE CASES COME FROM THE LIST, NOT FROM A LIST WRITTEN HERE. For every input the list calls
 * required, a site is built with every OTHER answer present and that one missing, and the lock
 * must name it. A written set of seven would pass on the day the list changes and say nothing,
 * which is the shape this repository keeps removing.
 */
class Gh684TheLockHoldsOnTheListTest extends TestCase
{
    use RefreshDatabase;

    /** Every required input answered, so a case can remove exactly one. */
    private const COMPLETE = [
        'location' => ['lat' => -43.53, 'lon' => 172.63],
        'turf' => [
            'turfType' => 'sports',
            'species' => 'perennialRyegrass',
            'variety' => 'Barenbrug Bar Extreme',
            'construction' => 'usga',
            'methodology' => 'mlsn',
            'rootDepth' => 150,
        ],
        // Required for a SPORTS site by the list (`byTurfType`), and the wizard does not ask for
        // it — see the case at the foot of this file.
        'traffic' => ['schedule' => ['matchesPerWeek' => 2]],
    ];

    private function siteWith(array $config): Site
    {
        $user = User::factory()->create(['is_admin' => false]);
        $account = Account::firstOrCreate(['name' => 'gh684'], ['owner_user_id' => $user->id]);
        $site = new Site();
        $site->forceFill([
            'id' => 'gh684-'.bin2hex(random_bytes(4)),
            'account_id' => $account->id,
            'name' => 'GH-684 site',
            'slug' => 'gh684-site',
            'site_type' => 'precinct',
            'created_by_user_id' => $user->id,
            'modified_by_user_id' => $user->id,
        ])->save();
        $site->users()->attach($user->id, ['role' => 'manager']);
        SiteConfig::create(['site_id' => $site->id, 'namespace' => 'gaip', 'config' => $config]);

        return $site->fresh();
    }

    private function without(string $key): array
    {
        $config = self::COMPLETE;
        [$section, $field] = explode('.', $key, 2);
        unset($config[$section][$field]);

        return $config;
    }

    public function test_a_site_that_answers_everything_is_not_locked(): void
    {
        // The positive control. Without it a lock that reddens on everything would pass every
        // case below and mean nothing.
        $site = $this->siteWith(self::COMPLETE);
        $missing = EnsureSiteIsSetUp::missingInputs($site);
        fwrite(STDOUT, PHP_EOL.'[gh684] a complete site is missing: '.json_encode($missing).PHP_EOL);

        $this->assertSame([], $missing, 'a site with every required answer must not be locked');
    }

    /**
     * CHANGED WITH THE DECISION, AND THE DECISION IS THE COORDINATOR'S, 24.09.2026: the gate holds
     * an input only if it is REQUIRED AND THE WIZARD ASKS FOR IT. This case used to demand that
     * every required input hold it, and that reading had a trap in it — an input the wizard cannot
     * collect would hold a person on a question nobody asks, with no way out.
     *
     * Her reason, kept because it is the part worth re-reading: the gate is derived from the list by
     * that one rule, so a wizard that starts asking for the schedule tomorrow gets it automatically,
     * from the same list, with nothing edited here.
     *
     * ONE CASE PER INPUT, and the inputs come FROM THE LIST rather than from a list written here.
     */
    public function test_each_input_the_wizard_asks_for_holds_the_lock_on_its_own(): void
    {
        $required = CalculationInputs::requiredFor('sports');
        $byStep = CalculationInputs::wizardStepsFor('sports')['byStep'];
        $asked = $byStep === [] ? [] : array_merge(...array_values($byStep));
        $holdsTheLock = array_values(array_intersect($required, $asked));
        $requiredButNotAsked = array_values(array_diff($required, $asked));

        fwrite(STDOUT, '[gh684] required for a sports site ('.count($required).'): '.json_encode($required).PHP_EOL
            .'[gh684] of those, asked by the wizard and therefore holding the lock ('
            .count($holdsTheLock).'): '.json_encode($holdsTheLock).PHP_EOL
            .'[gh684] required, NOT asked by the wizard, so the lock lets them pass: '
            .json_encode($requiredButNotAsked).PHP_EOL);

        // The universe is real: a set that shrank to nothing would make every case below vacuous.
        $this->assertGreaterThan(4, count($holdsTheLock));

        foreach ($holdsTheLock as $key) {
            $site = $this->siteWith($this->without($key));
            $missing = EnsureSiteIsSetUp::missingInputs($site);
            fwrite(STDOUT, '[gh684]    without '.str_pad($key, 20).' -> the lock names: '
                .json_encode($missing).PHP_EOL);

            $this->assertContains($key, $missing, $key.' is asked by the wizard and the lock does not hold on it');
        }

        // THE OTHER DIRECTION, which is the whole point of the rule: an input the wizard cannot
        // collect does NOT hold the gate, however required it is. Emptying it changes nothing.
        foreach ($requiredButNotAsked as $key) {
            $site = $this->siteWith($this->without($key));
            $missing = EnsureSiteIsSetUp::missingInputs($site);
            fwrite(STDOUT, '[gh684]    without '.str_pad($key, 20).' -> the lock names: '
                .json_encode($missing).' (it must not be named)'.PHP_EOL);

            $this->assertNotContains($key, $missing,
                $key.' is not asked by the wizard, so holding the gate on it traps a person on a question nobody puts');
        }

        // And the rule itself, as an equality rather than as a pair of spot checks.
        $site = $this->siteWith(['turf' => ['turfType' => 'sports']]);
        $named = EnsureSiteIsSetUp::missingInputs($site);
        $this->assertSame(
            array_values(array_diff($holdsTheLock, ['turf.turfType'])),
            array_values(array_diff($named, ['turf.turfType'])),
            'the gate is not exactly "required and asked by the wizard"'
        );
    }

    public function test_generic_counts_as_an_answer_because_the_owner_decided_so(): void
    {
        /**
         * Her decision, 24.09.2026 17:32 (GH-684): `generic` COUNTS AS FILLED, and the wizard is
         * where they say which cultivar it was -- knowingly from the list, or `generic` left
         * standing. Quoted verbatim in PLAN-remaining-defects-RU.md under GH-684. A lock that
         * treated `generic` as empty
         * would send six live sites back into the wizard for a value they already carry.
         */
        $config = self::COMPLETE;
        $config['turf']['variety'] = 'generic';
        $missing = EnsureSiteIsSetUp::missingInputs($this->siteWith($config));
        fwrite(STDOUT, '[gh684] with variety `generic` the lock names: '.json_encode($missing).PHP_EOL);

        $this->assertSame([], $missing, '`generic` is a deliberate choice and counts as filled');
    }

    public function test_an_empty_string_is_not_an_answer(): void
    {
        $config = self::COMPLETE;
        $config['turf']['methodology'] = '   ';
        $this->assertContains('turf.methodology',
            EnsureSiteIsSetUp::missingInputs($this->siteWith($config)));
    }

    public function test_the_list_requires_EIGHT_for_sports_and_the_wizard_asks_SEVEN_of_them(): void
    {
        /**
         * THE PENDING DATA CHANGES, WRITTEN DOWN SO THEY CANNOT LAND SILENTLY — and measuring
         * found one more than anybody had named.
         *
         * The owner named SEVEN inputs holding the wizard lock: the place (two), turf type,
         * species, cultivar, construction, methodology. Measuring found NINE required for a sports
         * site, one more than anybody had named. ONE OF THE TWO IS NOW SETTLED AND THE COUNT IS
         * EIGHT:
         *   - `turf.rootDepth` — SETTLED, and it is the OWNER's decision that settled it, 24.09.2026
         *     17:13: the wizard does not ask for root depth and the field stays as it is. The list
         *     now carries `required: false`, and the row says in its own text what the flag also
         *     silences: the calculation and the incomplete-run panel read the same row, so nothing
         *     now tells a person the depth is missing. That part is carried as an open question.
         *   - `traffic.schedule` — SETTLED TOO, by the COORDINATOR on 24.09.2026, and not as an
         *     exception for one input: the gate holds what is required AND asked by the wizard. The
         *     schedule is required for a real reason (wear and traffic need it) and the wizard asks
         *     for it on no step, so it stays required for the calculation and for the panel that
         *     names an incomplete run, and it does not hold the gate. The case above asserts that
         *     rule in both directions; this one watches the two SETS, so the day the wizard starts
         *     asking for the schedule, or the list stops requiring it, this reddens and the change
         *     gets recorded here.
         *
         * This case asserts TODAY'S state and goes red the day the second one lands. Its red is
         * the reminder to record the decision here, and to say WHOSE it was — a quieter
         * arrangement would let the lock's subject change with nothing said. It has already done
         * that once: it reddened the moment `required: false` was written.
         */
        $required = CalculationInputs::requiredFor('sports');
        $ownersSeven = ['location.lat', 'location.lon', 'turf.turfType', 'turf.species',
            'turf.variety', 'turf.construction', 'turf.methodology'];
        $beyond = array_values(array_diff($required, $ownersSeven));
        fwrite(STDOUT, '[gh684] the list requires '.count($required).' for sports; beyond the'
            .' owner\'s seven: '.json_encode($beyond).PHP_EOL);

        $this->assertSame(['traffic.schedule'], $beyond,
            'the set holding the lock has moved: record the decision here, and whose it was, before updating this');
        // And the one that was settled is settled in the direction she settled it.
        $this->assertNotContains('turf.rootDepth', $required,
            'root depth is required again, and the owner decided on 24.09.2026 that the wizard does not ask for it');
    }
}
