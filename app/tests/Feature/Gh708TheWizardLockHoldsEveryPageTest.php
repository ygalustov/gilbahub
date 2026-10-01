<?php

namespace Tests\Feature;

use App\Models\Account;
use App\Models\Site;
use App\Models\SiteConfig;
use App\Models\User;
use App\Support\CalculationInputs;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * GH-708 (item 3bk, part 3) — THE LOCK: A SITE IS NOT LOOKED AT OR CALCULATED UNTIL THE PERSON HAS
 * ANSWERED WHAT THE CALCULATION NEEDS.
 *
 * The owner's decisions of 24.09.2026 are what this holds: the wizard cannot be left until the
 * required answers are in (16:51), refreshing the page brings it back (16:51), there is no
 * calculation until it has been completed (17:07), and `/hub` is under the lock too (19:50) — what
 * she excluded from this work was the old hub's interface, not its route.
 *
 * WHAT THE CASES COME FROM. The set the lock holds is not written here: it is `required AND asked by
 * the wizard`, derived from the inputs list, so an input added to the list with a wizard step brings
 * its own case with it. And `traffic.schedule` has its own case for the opposite reason — required
 * for a sports site, asked by no wizard step — because a lock holding it would keep a person on a
 * question nobody can put to them.
 */
class Gh708TheWizardLockHoldsEveryPageTest extends TestCase
{
    use RefreshDatabase;

    /** The inputs the lock holds, derived: required for this turf type AND collected by the wizard. */
    private function locked(string $turfType = 'sports'): array
    {
        $byStep = CalculationInputs::wizardStepsFor($turfType)['byStep'];
        $asked = $byStep === [] ? [] : array_merge(...array_values($byStep));

        return array_values(array_intersect(CalculationInputs::requiredFor($turfType), $asked));
    }

    public function test_a_site_that_answered_everything_is_drawn__the_positive_control(): void
    {
        // FIRST, because every redirect below would otherwise be a redirect about a page that never
        // renders for anyone.
        [$user, $site] = $this->site();
        $this->giveTheSiteWhatTheLockNeeds($site);

        $this->actingAs($user->fresh())->get('/plan')->assertOk();
        $this->actingAs($user->fresh())->get('/hub')->assertOk();
    }

    public function test_each_input_the_lock_holds_sends_the_page_back_to_the_wizard(): void
    {
        $held = $this->locked();
        fwrite(STDOUT, PHP_EOL.'[gh708] the lock holds ('.count($held).'): '.json_encode($held).PHP_EOL);
        $this->assertGreaterThan(4, count($held), 'the set is empty or tiny, and every case below is vacuous');

        foreach ($held as $key) {
            [$user, $site] = $this->site();
            $this->giveTheSiteWhatTheLockNeeds($site);
            $this->blank($site, $key);

            $response = $this->actingAs($user->fresh())->get('/plan');
            fwrite(STDOUT, '[gh708]   without '.str_pad($key, 20).' -> '.$response->status()
                .' '.($response->headers->get('Location') ?? '').PHP_EOL);

            $response->assertRedirect(route('dashboard', ['setup' => '1']));
        }
    }

    public function test_the_lock_holds_exactly_what_the_wizard_can_ask_for(): void
    {
        /**
         * GH-789 (queue item 7) — THE INVARIANT IS UNCHANGED; WHAT THE WIZARD ASKS HAS CHANGED.
         *
         * This case read "`traffic.schedule` is required for a sports site and NO wizard step collects it, so a
         * lock holding it would send a person to a wizard that cannot answer it". The owner decided on
         * 30.09.2026 that the wizard asks a sports surface for its matches and sessions per week, so the list
         * declares the step and the lock holds the input — the invariant working rather than breaking: the lock
         * holds exactly what the wizard can ask for, no more and no less.
         *
         * Asserted in BOTH directions and printed, because "held and askable" and "never required" read the
         * same from a green test otherwise.
         */
        [$user, $site] = $this->site();
        $this->giveTheSiteWhatTheLockNeeds($site);

        $required = CalculationInputs::requiredFor('sports');
        $askable = [];
        // `wizardStepsFor` answers {byStep: {n: [keys]}, unparsed: []} — the steps are under `byStep`.
        foreach (CalculationInputs::wizardStepsFor('sports')['byStep'] as $keys) {
            foreach ($keys as $key) {
                $askable[] = $key;
            }
        }
        $askable = array_values(array_unique($askable));
        $held = $this->locked();
        fwrite(STDOUT, '[gh708] required for sports: '.json_encode($required).PHP_EOL
            .'[gh708] the wizard can ask for: '.json_encode($askable).PHP_EOL
            .'[gh708] the lock holds: '.json_encode($held).PHP_EOL);

        $this->assertContains('traffic.schedule', $required);
        $this->assertContains('traffic.schedule', $askable);
        $this->assertSame([], array_values(array_diff($held, $askable)), 'the lock holds what the wizard cannot ask');
        $this->assertSame([], array_values(array_diff($askable, $held)), 'the wizard asks what the lock ignores');
    }

    public function test_the_run_frame_is_judged_by_the_site_it_was_opened_for_and_not_by_the_pointer(): void
    {
        /**
         * The frame is opened as `/hub?rerun=…&site=<id>` and is about THAT site. A lock reading the
         * pointer would wave a calculation through for an incomplete site whenever the pointer stood
         * on a complete one — one object judged by the state of another, which is the GH-459 class.
         */
        [$user, $complete] = $this->site('Complete');
        $this->giveTheSiteWhatTheLockNeeds($complete);
        $incomplete = $this->anotherSiteOf($user, 'Incomplete');
        $this->giveTheSiteWhatTheLockNeeds($incomplete);
        $this->blank($incomplete, 'turf.construction');
        $user->forceFill(['last_active_site_id' => $complete->id])->save();

        $frame = $this->actingAs($user->fresh())->get('/hub?rerun=r-1&site='.$incomplete->id);
        fwrite(STDOUT, '[gh708] the frame of an INCOMPLETE site, pointer on a complete one -> '
            .$frame->status().' '.($frame->headers->get('Location') ?? '').PHP_EOL);
        $frame->assertRedirect(route('dashboard', ['setup' => '1']));

        // And the pointer's own site is still drawn, so the redirect above is about the parameter.
        $this->actingAs($user->fresh())->get('/hub')->assertOk();
    }

    public function test_a_frame_parameter_on_ANOTHER_page_is_honoured_too__and_this_tells_two_faults_apart(): void
    {
        /**
         * TWO MUTATIONS REDDENED ONE CASE, WHICH IS A GAP IN THE MEASUREMENT RATHER THAN IN THE CODE.
         * Reading the pointer instead of the page's site, and taking `/hub` out from under the lock,
         * both showed up on the same line with the same output — so the suite could not say which
         * fault it had found.
         *
         * `PageSite::forRequest` honours `rerun` + `site` on ANY route, not only on `/hub`. So this
         * case asks for an incomplete site by parameter on `/plan`, with the pointer standing on a
         * complete one: it reddens when the lock reads the pointer, and stays green when `/hub` alone
         * is excused. Its pair below does the opposite.
         */
        [$user, $complete] = $this->site('Complete');
        $this->giveTheSiteWhatTheLockNeeds($complete);
        $incomplete = $this->anotherSiteOf($user, 'Incomplete');
        $this->giveTheSiteWhatTheLockNeeds($incomplete);
        $this->blank($incomplete, 'turf.variety');
        $user->forceFill(['last_active_site_id' => $complete->id])->save();

        $asked = $this->actingAs($user->fresh())->get('/plan?rerun=r-2&site='.$incomplete->id);
        fwrite(STDOUT, '[gh708] /plan asked for an INCOMPLETE site, pointer on a complete one -> '
            .$asked->status().' '.($asked->headers->get('Location') ?? '').PHP_EOL);

        $asked->assertRedirect(route('dashboard', ['setup' => '1']));
    }

    public function test_the_old_hub_of_an_incomplete_site_is_locked_by_the_pointer_alone(): void
    {
        /**
         * The other half of the pair. No parameter at all: the pointer stands on the incomplete site,
         * so reading the pointer and reading the page's site give the SAME answer, and only taking
         * `/hub` out from under the lock can make this pass. That is what makes the two faults
         * distinguishable — this reddens for one of them and the case above for the other.
         *
         * And it is the owner's decision of 19:50 held where it lands: `/hub` is a route under the
         * lock, and there is no calculation until the wizard has been completed.
         */
        [$user, $site] = $this->site('Incomplete');
        $this->giveTheSiteWhatTheLockNeeds($site);
        $this->blank($site, 'turf.construction');

        $hub = $this->actingAs($user->fresh())->get('/hub');
        fwrite(STDOUT, '[gh708] /hub of an incomplete site, by the pointer -> '
            .$hub->status().' '.($hub->headers->get('Location') ?? '').PHP_EOL);

        $hub->assertRedirect(route('dashboard', ['setup' => '1']));
    }

    public function test_setup_0_does_not_bypass_the_lock(): void
    {
        // The state decides. A parameter that turned the lock off would be a way round the owner's
        // rule that is one query string wide.
        [$user, $site] = $this->site();
        $this->giveTheSiteWhatTheLockNeeds($site);
        $this->blank($site, 'turf.species');

        $this->actingAs($user->fresh())->get('/plan?setup=0')
            ->assertRedirect(route('dashboard', ['setup' => '1']));
    }

    public function test_the_doors_out_are_not_locked(): void
    {
        /**
         * The other half of a lock, and the boundary the analyst named three times: a person must be
         * able to reach the wizard, switch site and leave. Locking those would trap them on one
         * incomplete site — a lock with no door is a broken product, not a strict one.
         */
        [$user, $site] = $this->site();
        $this->giveTheSiteWhatTheLockNeeds($site);
        $this->blank($site, 'turf.methodology');

        $this->actingAs($user->fresh())->get('/dashboard')->assertOk();
        $this->actingAs($user->fresh())->get('/account')->assertOk();
        // The wizard saves through the API, so the API must answer rather than redirect.
        $this->actingAs($user->fresh())->getJson('/api/sites')->assertOk();
    }

    /**
     * Take one answer away, by the list's own key — FROM WHEREVER THE LIST SAYS IT IS KEPT.
     *
     * GH-797 (queue item 3ashch): emptying a `sites.*` key out of the config emptied nothing, so the page
     * rendered and the case read as "the lock does not hold on the soil texture" while the texture was
     * sitting in its column untouched. Printed proof of that run, before this: `without
     * sites.soil_texture_override -> 200`.
     */
    private function blank(Site $site, string $key): void
    {
        $column = CalculationInputs::siteColumnOf($key);
        if ($column !== null) {
            $site->forceFill([$column => null])->save();

            return;
        }

        $row = SiteConfig::query()->where('site_id', $site->id)->where('namespace', 'gaip')->firstOrFail();
        $config = $row->config;
        [$section, $field] = explode('.', $key, 2);
        unset($config[$section][$field]);
        $row->forceFill(['config' => $config])->save();
    }

    /** @return array{0:User,1:Site} */
    private function site(string $name = 'Locked'): array
    {
        $user = User::factory()->create(['is_admin' => false]);
        $account = Account::query()->firstOrCreate(
            ['owner_user_id' => $user->id],
            ['display_name' => $user->name, 'created_by_user_id' => $user->id, 'modified_by_user_id' => $user->id]
        );
        $site = Site::query()->create([
            'account_id' => $account->id, 'name' => $name,
            'slug' => strtolower($name).'-'.substr((string) $user->id, -6),
            'site_type' => 'sports', 'timezone' => 'UTC',
            'created_by_user_id' => $user->id, 'modified_by_user_id' => $user->id,
        ]);
        $site->users()->attach($user->id, ['role' => 'manager']);
        $user->forceFill(['last_active_site_id' => $site->id])->save();

        return [$user->fresh(), $site];
    }

    private function anotherSiteOf(User $user, string $name): Site
    {
        $site = Site::query()->create([
            'account_id' => $user->activeSite->account_id, 'name' => $name,
            'slug' => strtolower($name).'-'.substr((string) $user->id, -6),
            'site_type' => 'sports', 'timezone' => 'UTC',
            'created_by_user_id' => $user->id, 'modified_by_user_id' => $user->id,
        ]);
        $site->users()->attach($user->id, ['role' => 'manager']);

        return $site;
    }
}
