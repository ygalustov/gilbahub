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
 * GH-797 (queue item 3ashch, stage 1) — "FILLED" FOR AN INPUT KEPT IN A COLUMN OF `sites`.
 *
 * WHAT THIS IS ABOUT. The owner made the soil texture a required field (01.10.2026). It is the first
 * required input the list does NOT keep in the site's config: it lives in `sites.soil_texture_override`.
 * Three readers decide whether a site has answered a required input — the setup lock, the wizard's own
 * answers and the server's refusal — and before this all three walked the config alone. So the answer for
 * a texture would have been "not entered" on every site, including the six on the stand that carry one,
 * and the lock would have closed all of them the moment the flag went on.
 *
 * WHY THE CASES SET THE FLAG THEMSELVES. Stage 1 is delivered before the obligation is switched on, so
 * these cases turn it on for themselves, in the list, by the same two marks stage 3 writes into the file
 * (`required: true` and the wizard step). Once that stage lands the injection is a no-op and the cases
 * read the product's own list — which is why they are written this way rather than against a list of
 * their own invention.
 *
 * THE ACCOUNT'S COLUMN IS NOT IN THE CHAIN, and that is a case rather than a remark: the pages resolve a
 * texture as `soil_texture_override ?: account->soil_texture`, and `accounts.soil_texture` carries the
 * schema's default `loam` on every account that has ever existed. A reader that walked that chain would
 * answer "filled" for every site and the obligation would require nothing of anybody.
 */
class Gh797TheTextureIsHeldByTheSiteRowTest extends TestCase
{
    use RefreshDatabase;

    private const TEXTURE = 'sites.soil_texture_override';

    protected function tearDown(): void
    {
        $this->resetTheList();
        parent::tearDown();
    }

    public function test_the_reader_answers_from_the_column_and_not_from_the_account(): void
    {
        $this->requireTheTexture();
        $user = User::factory()->create();
        $withIt = $this->siteFor($user, ['soil_texture_override' => 'sand']);
        $withoutIt = $this->siteFor($user, ['soil_texture_override' => null]);

        $held = CalculationInputs::heldForInput(self::TEXTURE, [], $withIt);
        $empty = CalculationInputs::heldForInput(self::TEXTURE, [], $withoutIt);

        fwrite(STDOUT, '[gh797] the account\'s own texture: '
            .json_encode($withoutIt->account?->soil_texture)
            .' | site with a texture: '.json_encode($held)
            .' | site without one: '.json_encode($empty).PHP_EOL);

        // The account carries `loam` and the site carries nothing, and the answer is still "nothing".
        $this->assertSame('loam', $withoutIt->account?->soil_texture);
        $this->assertSame(['held' => true, 'value' => 'sand'], $held);
        $this->assertSame(['held' => false, 'value' => null], $empty);
    }

    public function test_the_lock_holds_a_site_whose_column_is_empty_and_lets_the_other_through(): void
    {
        $this->requireTheTexture();
        $user = User::factory()->create();
        $withIt = $this->siteFor($user, ['soil_texture_override' => 'sand']);
        $withoutIt = $this->siteFor($user, ['soil_texture_override' => null]);

        $missingWithIt = EnsureSiteIsSetUp::missingInputs($withIt);
        $missingWithoutIt = EnsureSiteIsSetUp::missingInputs($withoutIt);

        fwrite(STDOUT, '[gh797] the lock on a site WITH a texture: '.json_encode($missingWithIt)
            .' | WITHOUT one: '.json_encode($missingWithoutIt).PHP_EOL);

        $this->assertNotContains(self::TEXTURE, $missingWithIt);
        $this->assertContains(self::TEXTURE, $missingWithoutIt);
    }

    public function test_the_wizard_reopens_with_the_texture_the_site_already_carries(): void
    {
        $this->requireTheTexture();
        $user = User::factory()->create();
        $site = $this->siteFor($user, ['soil_texture_override' => 'clay_loam']);

        $answers = EnsureSiteIsSetUp::answersFor($site, CalculationInputs::requiredFor('sports'));

        fwrite(STDOUT, '[gh797] what the wizard is told the site holds: '.json_encode($answers).PHP_EOL);

        $this->assertSame('clay_loam', $answers[self::TEXTURE] ?? null);
    }

    public function test_the_config_route_is_not_refused_over_a_texture_it_does_not_store(): void
    {
        $this->requireTheTexture();
        $user = User::factory()->create();
        $site = $this->siteFor($user, ['soil_texture_override' => null]);

        $answer = $this->actingAs($user)
            ->withSession(['_token' => 'test-token'])
            ->patchJson('/api/sites/'.$site->id.'/config/gaip', [
                '_token' => 'test-token',
                'place' => 'settings.turf',
                'patch' => ['turf' => ['hoc' => 12]],
            ]);

        fwrite(STDOUT, '[gh797] the config route answered '.$answer->getStatusCode()
            .': '.$answer->getContent().PHP_EOL);

        $answer->assertOk();
    }

    public function test_the_site_route_refuses_to_empty_the_texture_and_names_the_field(): void
    {
        $this->requireTheTexture();
        $user = User::factory()->create();
        $site = $this->siteFor($user, ['soil_texture_override' => 'sand']);

        $answer = $this->actingAs($user)
            ->withSession(['_token' => 'test-token'])
            ->patchJson('/api/sites/'.$site->id, [
                '_token' => 'test-token',
                'soil_texture_override' => null,
            ]);

        fwrite(STDOUT, '[gh797] the site route answered '.$answer->getStatusCode()
            .': '.$answer->getContent().PHP_EOL);

        $answer->assertStatus(422)
            ->assertJsonPath('message', 'Not saved: fill in the soil texture.')
            ->assertJsonPath('missing.0.input', self::TEXTURE)
            ->assertJsonPath('missing.0.label', 'the soil texture');

        // Nothing written: the refusal stands before the transaction.
        $this->assertSame('sand', $site->fresh()->soil_texture_override);
    }

    public function test_a_write_that_says_nothing_about_the_texture_is_not_refused_over_it(): void
    {
        $this->requireTheTexture();
        $user = User::factory()->create();
        $site = $this->siteFor($user, ['soil_texture_override' => null]);

        $answer = $this->actingAs($user)
            ->withSession(['_token' => 'test-token'])
            ->patchJson('/api/sites/'.$site->id, [
                '_token' => 'test-token',
                'name' => 'Renamed',
            ]);

        fwrite(STDOUT, '[gh797] a rename on a site with no texture answered '
            .$answer->getStatusCode().PHP_EOL);

        $answer->assertOk();
        $this->assertSame('Renamed', $site->fresh()->name);
    }

    /**
     * GH-797 (the reviewer's return, point 1) — A STORAGE THIS CLASS CANNOT READ ANSWERS `unknown`, AND
     * NEITHER OF THE OTHER TWO ANSWERS.
     *
     * The third answer is declared by the reader itself and it is REACHABLE: of the inputs the list
     * declares, three keep their value in a `sampleSet` and two in a `sprayLog` as well as the config,
     * and nothing passes this class a reader for a sample set at all. `RunStart` passes one for the spray
     * log, so for the run record those two are answerable; the setup lock, the wizard's answers and the
     * server's refusal pass none, and for them the honest answer is "we did not look where it lives".
     *
     * WHAT IT COSTS IF THE THIRD ANSWER IS LOST, which is why this case exists at all: the reviewer's
     * mutation M6 switches off the line that makes UNKNOWN travel, and then `false || 'unknown'` is
     * truthy — so an input whose OTHER storage holds a value comes back as "entered" while nothing is
     * known about the storage that was not read. The run record would then tell a client it had entered
     * something on the strength of a place nobody looked in. On the full PHPUnit set that mutation
     * changed no number at all before this case: 673 passed, as the control.
     *
     * THE ORDER OF THE THREE ANSWERS IS THE SUBJECT, so all three are asserted together:
     *   - a storage with no reader and nothing else to go on  -> unknown, not false;
     *   - a storage with no reader beside a config that HOLDS a value -> unknown, not true. This is the
     *     one M6 turns into `true`;
     *   - the same input with a reader supplied -> a plain yes, so the case is not "it always says
     *     unknown", which would pass on a reader that answered nothing else.
     */
    public function test_a_storage_this_class_cannot_read_answers_unknown_and_not_the_other_two(): void
    {
        $user = User::factory()->create();
        $site = $this->siteFor($user, ['soil_texture_override' => 'sand']);

        // `samples.soil` is kept in a `sampleSet`, and no caller passes a reader for one.
        $noReaderAtAll = CalculationInputs::heldForInput('samples.soil', [], $site);

        // `pgr.productType` is kept in the config AND in the spray log. The config holds a value here,
        // and no spray-log reader is given.
        $config = ['pgr' => ['productType' => 'Primo Maxx']];
        $halfRead = CalculationInputs::heldForInput('pgr.productType', $config, $site);

        // The same input with the reader its only consumer passes.
        $readable = CalculationInputs::heldForInput('pgr.productType', $config, $site, [
            'sprayLog' => fn (string $key) => false,
        ]);

        fwrite(STDOUT, '[gh797] a storage with no reader at all: '.json_encode($noReaderAtAll)
            .PHP_EOL.'[gh797] a config that HOLDS a value beside a storage with no reader: '.json_encode($halfRead)
            .PHP_EOL.'[gh797] the same input once a reader is supplied: '.json_encode($readable)
            .PHP_EOL.'[gh797] the storages the list declares for them: '
            .json_encode([
                'samples.soil' => CalculationInputs::storedIn('samples.soil'),
                'pgr.productType' => CalculationInputs::storedIn('pgr.productType'),
            ]).PHP_EOL);

        $this->assertSame(CalculationInputs::UNKNOWN, $noReaderAtAll['held']);
        $this->assertSame(CalculationInputs::UNKNOWN, $halfRead['held']);
        // Not `true`, which is what losing the third answer turns this into.
        $this->assertNotTrue($halfRead['held']);
        $this->assertSame(true, $readable['held']);
    }

    /**
     * The run record answered this correctly before stage 1 and must answer the same after it: the reader
     * it used is the one every caller now shares, so this is the case that says the move changed nothing
     * where it was already right.
     */
    public function test_the_run_record_still_reports_the_texture_from_the_column(): void
    {
        $user = User::factory()->create();
        $withIt = $this->siteFor($user, ['soil_texture_override' => 'loamy_sand']);
        $withoutIt = $this->siteFor($user, ['soil_texture_override' => null]);

        $a = \App\Support\RunStart::observe($withIt)['settings'][self::TEXTURE] ?? 'ABSENT';
        $b = \App\Support\RunStart::observe($withoutIt)['settings'][self::TEXTURE] ?? 'ABSENT';

        fwrite(STDOUT, '[gh797] the run record: with a texture '.json_encode($a)
            .' | without one '.json_encode($b).PHP_EOL);

        $this->assertTrue($a);
        $this->assertFalse($b);
    }

    // ── fixtures ─────────────────────────────────────────────────────────────────────────────────

    private function siteFor(User $user, array $siteOverrides = []): Site
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
            'name' => 'Texture site',
            'slug' => 'texture-site-'.bin2hex(random_bytes(4)),
            'site_type' => 'sports',
            'created_by_user_id' => $user->id,
            'modified_by_user_id' => $user->id,
        ], $siteOverrides));

        $site->users()->attach($user->id, ['role' => 'manager']);

        SiteConfig::query()->create([
            'site_id' => $site->id,
            'namespace' => 'gaip',
            'config' => $this->configThePageLockAccepts(),
            'synced_at' => now(),
        ]);

        return $site->fresh();
    }

    /**
     * The product's own list with the owner's decision applied: `required: true` and the wizard step that
     * collects it. Stage 3 writes these two marks into the file, and then this does nothing.
     */
    private function requireTheTexture(): void
    {
        $list = CalculationInputs::all();
        $entry = $list['inputs'][self::TEXTURE] ?? [];
        $entry['required'] = true;
        $filledIn = (array) ($entry['filledIn'] ?? []);
        if (! in_array('wizard.step3', $filledIn, true)) {
            $filledIn[] = 'wizard.step3';
        }
        $entry['filledIn'] = $filledIn;
        $list['inputs'][self::TEXTURE] = $entry;

        $this->putTheList($list);
    }

    private function putTheList(?array $list): void
    {
        $cache = new \ReflectionProperty(CalculationInputs::class, 'cache');
        $cache->setValue(null, $list);
    }

    private function resetTheList(): void
    {
        $this->putTheList(null);
    }
}
