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
 * GH-684 (item 3bk, part 1) — WHEN THE WIZARD OPENS IS THE SERVER'S ANSWER, AND IT IS THE ONE THE
 * LOCK WILL HOLD ON.
 *
 * Three places used to decide separately whether a site was set up, and each had its own idea:
 * the wizard tested four fields in JavaScript, the Getting Started checklist tested the same four
 * again in another file, and the inputs list called seven required. So a site with no cultivar and
 * no construction was "set up" to all three while the calculation was short of two answers.
 *
 * Now the page is TOLD -- what is missing, by the list's own names, which wizard step collects each
 * one, and what the site already answers -- and the lock (part 3) will hold on the same function.
 * Three readers of one answer instead of three answers.
 *
 * WHAT IS ASSERTED IS WHAT REACHES THE PAGE, not what a helper returns in isolation: the rendered
 * dashboard is read back, because the delivery is the part that was missing.
 */
class Gh684TheServerDecidesWhenTheWizardOpensTest extends TestCase
{
    use RefreshDatabase;

    public function test_the_page_is_told_what_is_missing_by_the_lists_own_names(): void
    {
        // Everything but the cultivar and the construction — the two the old four-field test could
        // not see, which is why this is the fixture and not a site missing a coordinate.
        [$user] = $this->siteWith([
            'location' => ['lat' => -37.8, 'lon' => 144.9, 'name' => 'Melbourne'],
            'turf' => ['turfType' => 'sports', 'species' => 'Perennial Ryegrass', 'methodology' => 'slan'],
        ]);

        $setup = $this->setupFromThePage($user);
        fwrite(STDOUT, PHP_EOL.'[gh684] the page was told: '.json_encode($setup).PHP_EOL);

        // The subject exists: the payload arrived at all.
        $this->assertIsArray($setup, 'the page carries no setup state, so nothing below is about the product');

        $this->assertContains('turf.variety', $setup['missing']);
        $this->assertContains('turf.construction', $setup['missing']);
        // And not one of the answered ones, or "missing" would mean nothing.
        $this->assertNotContains('turf.species', $setup['missing']);
        $this->assertNotContains('location.lat', $setup['missing']);

        // What is already known travels too, so the wizard does not ask twice.
        $this->assertSame('Perennial Ryegrass', $setup['answers']['turf.species']);
        $this->assertSame('sports', $setup['answers']['turf.turfType']);

        // The step that collects the two missing ones is named, so the wizard can open there.
        $this->assertContains('turf.variety', $setup['byStep']['3']);
        $this->assertContains('turf.construction', $setup['byStep']['3']);
    }

    public function test_a_site_that_answers_everything_is_told_nothing_is_missing(): void
    {
        // The control. Without it, "missing is not empty" would also be the answer of a payload
        // that reports everything as missing always.
        [$user] = $this->siteWith([
            'location' => ['lat' => -37.8, 'lon' => 144.9, 'name' => 'Melbourne'],
            'turf' => [
                'turfType' => 'sports', 'species' => 'Perennial Ryegrass', 'methodology' => 'slan',
                'variety' => 'generic', 'construction' => 'sand_profile',
            ],
        ]);

        $setup = $this->setupFromThePage($user);
        fwrite(STDOUT, '[gh684] a complete site is told: '.json_encode($setup['missing']).PHP_EOL);

        $this->assertSame([], $setup['missing']);
    }

    public function test_the_step_map_is_derived_from_the_list_and_not_written_anywhere(): void
    {
        /**
         * Both directions, against the file itself. A step map typed into the code would answer
         * correctly today and go stale the first time an input's `filledIn` changes — which is the
         * exact failure the hand-written `switch` in the wizard was.
         *
         * `traffic.schedule` is the case that makes this worth asserting: it is required for a
         * sports site and no wizard step collects it, so it must NOT appear here. That is also why
         * the lock does not hold on it (the coordinator's rule: required AND asked by the wizard).
         */
        $schema = json_decode(file_get_contents(base_path('../assets/calculation-inputs.schema.json')), true);
        $fromTheFile = [];
        foreach ($schema['inputs'] as $key => $entry) {
            if (($entry['required'] ?? null) !== true) {
                continue;
            }
            foreach ((array) ($entry['filledIn'] ?? []) as $place) {
                if (preg_match('/^wizard\.step(\d+)$/', (string) $place, $m) === 1) {
                    $fromTheFile[(int) $m[1]][] = $key;
                }
            }
        }
        ksort($fromTheFile);

        $derived = CalculationInputs::wizardStepsFor('sports');
        fwrite(STDOUT, '[gh684] derived: '.json_encode($derived['byStep'])
            .' | from the file: '.json_encode($fromTheFile).PHP_EOL);

        $this->assertSame($fromTheFile, $derived['byStep']);
        // A step name the rule cannot read is reported rather than dropped.
        $this->assertSame([], $derived['unparsed']);

        // Required for sports, collected by no wizard step: it stays out.
        $this->assertContains('traffic.schedule', CalculationInputs::requiredFor('sports'));
        $flat = array_merge(...array_values($derived['byStep']));
        $this->assertNotContains('traffic.schedule', $flat,
            'the wizard does not ask for the schedule, so no step may claim to collect it');
    }

    /** The `setup` object as the rendered dashboard carries it. */
    private function setupFromThePage(User $user): ?array
    {
        $html = $this->actingAs($user->fresh())->get('/dashboard')->assertOk()->getContent();
        if (preg_match('/setup:\s*(\{.*?\}),\n/s', $html, $m) !== 1) {
            return null;
        }

        return json_decode($m[1], true);
    }

    /** @return array{0:User,1:Site} */
    private function siteWith(array $config): array
    {
        $user = User::factory()->create();
        $account = Account::query()->firstOrCreate(
            ['owner_user_id' => $user->id],
            ['display_name' => $user->name, 'created_by_user_id' => $user->id, 'modified_by_user_id' => $user->id]
        );
        $site = Site::query()->create([
            'account_id' => $account->id, 'name' => 'Setup site',
            'slug' => 'setup-site-'.substr((string) $user->id, -6),
            'site_type' => 'sports', 'timezone' => 'UTC',
            'latitude' => $config['location']['lat'] ?? null,
            'longitude' => $config['location']['lon'] ?? null,
            'created_by_user_id' => $user->id, 'modified_by_user_id' => $user->id,
        ]);
        $site->users()->attach($user->id, ['role' => 'manager']);
        SiteConfig::query()->create([
            'site_id' => $site->id, 'namespace' => 'gaip', 'config' => $config, 'synced_at' => now(),
        ]);
        $user->forceFill(['last_active_site_id' => $site->id])->save();

        return [$user, $site];
    }
}
