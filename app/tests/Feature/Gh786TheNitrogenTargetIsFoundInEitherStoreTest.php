<?php

namespace Tests\Feature;

use App\Models\Account;
use App\Models\Site;
use App\Models\SiteConfig;
use App\Models\User;
use App\Support\CalculationInputs;
use App\Support\RunStart;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * GH-786 (queue item 3gg) — THE ANNUAL NITROGEN TARGET IS FOUND IN EITHER OF ITS TWO STORES.
 *
 * The owner's decision, 30.09.2026: the figure comes from the saved nutrition programme
 * (`nutritionCalendarProgram.meta.annualNBase`), then from the Settings field (`turf.nProgram`). Both are
 * places a person's own number ends up, so the inputs list declares both under `storedAs` and the server's
 * recorder must count the input as entered when EITHER carries it.
 *
 * WHY THIS IS MEASURED ON THE SERVER AND NOT ONLY IN THE LIST. The recorder writes down what a site had when a
 * run started, and that record is what decides whether a client is told "you have not entered this". Before
 * `storedAs` was declared here the recorder walked the input's key alone, so a site whose figure lives only in
 * its generated programme — and 11 of the 21 sites on the stand hold one — would be told it had entered
 * nothing. Blame pointed at the client is the worst direction for an error to point, which is the reason
 * `storedAs` exists at all (GH-777).
 *
 * The third case is the one that keeps the other two honest: with neither store the input is absent, and the
 * recorder says so rather than finding the figure the calculation now derives from the grass species. A
 * derived figure is not an entered one.
 */
class Gh786TheNitrogenTargetIsFoundInEitherStoreTest extends TestCase
{
    use RefreshDatabase;

    public function test_the_list_declares_both_stores_in_the_order_the_product_walks_them(): void
    {
        $paths = CalculationInputs::storedAs('turf.nProgram');
        fwrite(STDOUT, '[gh786] turf.nProgram is stored at: '.json_encode($paths).PHP_EOL);

        $this->assertSame([
            'nutritionCalendarProgram.meta.annualNBase', 'turf.nProgram',
        ], $paths);
        // It stays an open decision of the owner's: not required, and the list must not answer for her.
        $this->assertNull(CalculationInputs::isRequired('turf.nProgram', 'sports'));
    }

    public function test_the_recorder_finds_the_figure_in_whichever_store_holds_it(): void
    {
        $answers = [];

        // 1. Only the saved programme — the shape 11 of the 21 sites on the stand are in.
        $answers['programme only'] = $this->recordedFor([
            'nutritionCalendarProgram' => ['meta' => ['annualNBase' => 120]],
        ]);
        // 2. Only Settings — the shape of a site that has never generated a programme, and the only place
        //    a person can type this number.
        $answers['settings only'] = $this->recordedFor(['turf' => ['nProgram' => 150]]);
        // 3. Both, disagreeing: still entered, and this record says nothing about WHICH one wins.
        $answers['both, disagreeing'] = $this->recordedFor([
            'turf' => ['nProgram' => 150],
            'nutritionCalendarProgram' => ['meta' => ['annualNBase' => 120]],
        ]);
        // 4. Neither. The calculation derives a figure from the species; the record must not call that entered.
        $answers['neither'] = $this->recordedFor([]);

        fwrite(STDOUT, '[gh786] the recorder on turf.nProgram: '.json_encode($answers).PHP_EOL);

        $this->assertSame([true, true, true, false], array_values($answers));
    }

    public function test_a_programme_that_carries_only_the_pre_gh383_target_is_still_a_figure_entered(): void
    {
        // Programmes generated before GH-383 stored only the traffic-adjusted target. The figure is in there,
        // so the input is entered — the modifier is divided back out where the number is USED, not here.
        $recorded = $this->recordedFor([
            'nutritionCalendarProgram' => ['adjustments' => ['target_n' => 288, 'traffic_modifier' => 1.15]],
        ]);
        fwrite(STDOUT, '[gh786] a pre-GH-383 programme, as the recorder sees it: '.json_encode($recorded).PHP_EOL);

        // BOUNDARY, named rather than asserted away: the declared paths are the two the product reads, and
        // `adjustments.target_n` is not one of them, so such a site records as not entered. No site on the
        // stand is in this shape — all 11 programmes carry `meta.annualNBase` — and the figure still reaches
        // every calculation through `annualNBaseOf`. What it would cost is one sentence to one client.
        $this->assertFalse($recorded);
    }

    /** @param  array<string,mixed>  $config */
    private function recordedFor(array $config): bool
    {
        $user = User::factory()->create(['is_admin' => false]);
        $account = Account::query()->create([
            'owner_user_id' => $user->id, 'display_name' => 'A',
            'created_by_user_id' => $user->id, 'modified_by_user_id' => $user->id,
        ]);
        $site = Site::query()->create([
            'account_id' => $account->id, 'name' => 'Site', 'slug' => 'site-'.$user->id,
            'site_type' => 'sports',
            'created_by_user_id' => $user->id, 'modified_by_user_id' => $user->id,
        ]);
        $site->users()->attach($user->id, ['role' => 'manager']);
        SiteConfig::query()->create([
            'site_id' => $site->id, 'namespace' => 'gaip',
            'config' => $this->configThePageLockAccepts($config),
        ]);

        $set = RunStart::observe($site->fresh());

        return $set['settings']['turf.nProgram'] ?? false;
    }
}
