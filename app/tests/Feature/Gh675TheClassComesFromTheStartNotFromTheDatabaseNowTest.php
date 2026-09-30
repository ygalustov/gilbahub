<?php

namespace Tests\Feature;

use App\Models\Account;
use App\Models\AnalysisResult;
use App\Models\Sample;
use App\Models\Site;
use App\Models\SiteConfig;
use App\Models\User;
use App\Support\AnalysisNotice;
use App\Support\AnalysisResults;
use App\Support\RunStart;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

/**
 * GH-675 (queue item 4, slice 1, the analyst's 22.7) — A MISSING INPUT IS JUDGED
 * AGAINST WHAT EXISTED WHEN THE RUN STARTED, NOT AGAINST THE DATABASE AT THE MOMENT
 * OF WRITING.
 *
 * THE TWO CASES ARE THE OWNER'S and they get different sentences: "the data was
 * there but did not get into the calculation — that is our problem" against "there
 * was no data, so that part was not calculated". Telling them apart needs to know
 * what existed WHEN THE RUN BEGAN.
 *
 * WHY THE DATABASE AT WRITE TIME WILL NOT DO, and this is the reviewer's condition
 * carried into the device rather than answered with a caveat: a sample created
 * between the start and the write is absent to the run and present to the server, so
 * judging by "now" writes "it did not arrive" — a true statement on a false premise.
 * That is the GH-459 class stretched over minutes, and it flips with no defect in
 * the code at all. The case below is exactly that sample.
 *
 * THE THIRD ANSWER IS PART OF THE DEVICE: with no record of the start the server
 * does not guess. It says the start was not recorded, and that is OUR side — a
 * client cannot be blamed for a fact nobody wrote down.
 */
class Gh675TheClassComesFromTheStartNotFromTheDatabaseNowTest extends TestCase
{
    use RefreshDatabase;

    private function metrics(): array
    {
        $out = [];
        foreach (\App\Support\AnalysisResultSchema::requiredMetrics() as $key) {
            $out[$key] = null;
        }
        $out['timestamp'] = now()->toIso8601String();
        $out['growthPotential'] = 34;

        return $out;
    }

    /** @return array{0:User,1:Site} */
    private function site(array $config = []): array
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
            // GH-708: the lock needs the site to have answered; this fixture's own values are kept.
            'site_id' => $site->id, 'namespace' => 'gaip', 'config' => $this->configThePageLockAccepts($config),
        ]);

        return [$user->fresh(), $site];
    }

    private function addSample(Site $site, User $user, string $type = 'water'): Sample
    {
        return Sample::query()->create([
            'account_id' => $site->account_id, 'site_id' => $site->id, 'sample_type' => $type,
            'lab_name' => 'lab', 'lab_ref' => '', 'soil_texture_snapshot' => '',
            'payload' => ['EC' => 0.5],
            'created_by_user_id' => $user->id, 'modified_by_user_id' => $user->id,
        ]);
    }

    /** The run frame, rendered — which is where the start is recorded. */
    private function openFrame(User $user, Site $site, string $runId): void
    {
        $this->actingAs($user)->get('/hub?rerun='.$runId.'&site='.$site->id)->assertOk();
    }

    /**
     * The run's own account of what it did not have — built here and PRINTED.
     *
     * GH-777: the reviewer's condition for the two repairs is that a case builds the body itself and
     * says what it sent. A judgement read without the claim it judged is a number with no question.
     */
    private function fileRow(User $user, Site $site, string $runId, array $missing,
        string $module = 'irrigation'): \Illuminate\Testing\TestResponse
    {
        $body = [
            'site_id' => $site->id,
            'run_id' => $runId,
            'analyzed_at' => now()->toIso8601String(),
            'metrics' => $this->metrics(),
            'computed' => [],
            'detail' => ['notApplicable' => [['module' => $module, 'missing' => $missing]]],
            'inputs' => ['site' => $site->id, 'samples' => []],
        ];
        fwrite(STDOUT, '[gh675]    the run sent: '.json_encode($body['detail']).PHP_EOL);

        return $this->actingAs($user)->postJson('/api/analysis-cache', $body);
    }

    /** @return array<int,array<string,mixed>> */
    private function judgementInTheRow(): array
    {
        $row = AnalysisResult::query()->latest('id')->first();
        $this->assertNotNull($row, 'no row was filed');
        $detail = is_array($row->detail) ? $row->detail : [];
        fwrite(STDOUT, '[gh675]    the row says: '.json_encode($detail['notApplicable'] ?? null)
            .' | start set recorded in the row: '
            .json_encode(isset($detail['runStart']) && $detail['runStart'] !== null).PHP_EOL);

        return $detail['notApplicable'] ?? [];
    }

    public function test_the_start_is_recorded_when_the_frame_is_rendered(): void
    {
        [$user, $site] = $this->site();
        $this->addSample($site, $user, 'water');
        $this->openFrame($user, $site, 'run-a');

        $set = RunStart::recorded('run-a');
        fwrite(STDOUT, PHP_EOL.'[gh675] the recorded start: '.json_encode($set).PHP_EOL);

        // POSITIVE CONTROL: there is a record at all, or every claim below is about
        // the third branch by accident.
        $this->assertNotNull($set, 'the frame was rendered and no start was recorded');
        $this->assertCount(1, $set['samples']['water']);
        $this->assertSame([], $set['samples']['soil']);
    }

    public function test_a_second_render_of_the_same_frame_does_not_overwrite_the_start(): void
    {
        // `Cache::add`: the first write wins. Otherwise a page reopened later would
        // move the "start" forward and the judgement with it.
        [$user, $site] = $this->site();
        $this->openFrame($user, $site, 'run-b');
        $first = RunStart::recorded('run-b');

        $this->addSample($site, $user, 'water');
        $this->openFrame($user, $site, 'run-b');
        $second = RunStart::recorded('run-b');

        fwrite(STDOUT, '[gh675] first render saw water samples: '
            .count($first['samples']['water']).', after a sample was added and the frame reopened: '
            .count($second['samples']['water']).PHP_EOL);

        $this->assertSame([], $second['samples']['water'], 'the start was overwritten by a later render');
    }

    public function test_O12_it_was_there_at_the_start_and_the_run_did_not_get_it(): void
    {
        [$user, $site] = $this->site();
        $this->addSample($site, $user, 'water');
        $this->openFrame($user, $site, 'run-c');

        fwrite(STDOUT, '[gh675] O-12: a water sample existed at the start, the run names it missing'.PHP_EOL);
        $this->fileRow($user, $site, 'run-c', ['samples.water'])->assertStatus(200);

        $judged = $this->judgementInTheRow();
        $this->assertSame('input-did-not-arrive', $judged[0]['missing'][0]['cause']);
    }

    public function test_O14_a_sample_created_AFTER_the_start_is_not_called_a_delivery_failure(): void
    {
        // THE CASE THE WHOLE DEVICE IS FOR. The sample did not exist when the run
        // began; it exists now. Judged against "now" this reads as "it did not
        // arrive" — true, and about a premise that is false.
        [$user, $site] = $this->site();
        $this->openFrame($user, $site, 'run-d');
        $this->addSample($site, $user, 'water');   // created between the start and the write

        fwrite(STDOUT, '[gh675] O-14: no water sample at the start, one created before the write'.PHP_EOL);
        $this->fileRow($user, $site, 'run-d', ['samples.water'])->assertStatus(200);

        $judged = $this->judgementInTheRow();
        $this->assertSame('input-not-entered', $judged[0]['missing'][0]['cause']);
    }

    public function test_with_no_record_of_the_start_the_server_says_so_instead_of_guessing(): void
    {
        [$user, $site] = $this->site();
        // No frame was rendered for this run at all.
        fwrite(STDOUT, '[gh675] no start record: the frame was never rendered for this run'.PHP_EOL);
        $this->fileRow($user, $site, 'run-e', ['samples.water'])->assertStatus(200);

        $judged = $this->judgementInTheRow();
        $this->assertSame('run-start-not-recorded', $judged[0]['missing'][0]['cause']);
    }

    public function test_a_setting_absent_from_the_config_at_the_start_is_the_clients_own_data(): void
    {
        // The other kind of input: not a sample but a field of the config. One
        // record, one rule — the inputs list says what the keys are.
        [$user, $site] = $this->site([]);
        $this->openFrame($user, $site, 'run-f');

        /**
         * GH-789 (queue item 7): the input this case uses as "a field the client never filled" is
         * `turf.hoc`, not `traffic.schedule`. The wizard now asks a sports site for its match and training
         * schedule (the owner's decision of 30.09.2026), so the shared fixture gives every site one —
         * otherwise the lock would hold the page — and the schedule is no longer an unfilled field. The
         * height of cut is a key of the list that the fixture does not answer, which is what this case needs.
         */
        fwrite(STDOUT, '[gh675] a config field never filled'.PHP_EOL);
        $this->fileRow($user, $site, 'run-f', ['turf.hoc'])->assertStatus(200);

        $judged = $this->judgementInTheRow();
        $this->assertSame('input-not-entered', $judged[0]['missing'][0]['cause']);
    }

    public function test_a_setting_that_WAS_filled_at_the_start_is_our_side(): void
    {
        [$user, $site] = $this->site(['traffic' => ['schedule' => ['matchesPerWeek' => 2]]]);
        $this->openFrame($user, $site, 'run-g');

        fwrite(STDOUT, '[gh675] a config field that was filled at the start'.PHP_EOL);
        $this->fileRow($user, $site, 'run-g', ['traffic.schedule'])->assertStatus(200);

        $judged = $this->judgementInTheRow();
        $this->assertSame('input-did-not-arrive', $judged[0]['missing'][0]['cause']);
    }

    public function test_the_two_causes_carry_the_classes_they_should(): void
    {
        // The sentence a person reads follows the class, so the classes are asserted
        // where they are declared rather than assumed from the name.
        $this->assertSame('run-incomplete', \App\Support\AnalysisNotice::classOf('input-did-not-arrive'));
        $this->assertSame('run-incomplete', \App\Support\AnalysisNotice::classOf('run-start-not-recorded'));
        // And the first has the owner's sentence; the second the same, because both
        // are our side.
        $this->assertStringContainsString('did not reach this analysis',
            \App\Support\AnalysisNotice::reasonText('input-did-not-arrive'));
    }

    /**
     * GH-777 (queue item 4, the analyst's finding A) — AN INPUT THE LIST DOES NOT DECLARE IS NOT A
     * MISSING START RECORD.
     *
     * `had()` answered `null` for two different facts: there is no record of the start, and this input
     * is not in the record because nothing declares it. The judge wrote `run-start-not-recorded` for
     * both — a sentence that states the start was not recorded while it WAS. The broken link is
     * between the run's vocabulary and the inputs list, and it is ours either way, but they are
     * different repairs and a client's administrator reads the code.
     */
    public function test_A_an_input_the_list_does_not_declare_is_not_reported_as_a_missing_start(): void
    {
        [$user, $site] = $this->site();
        $this->openFrame($user, $site, 'run-h');

        // POSITIVE CONTROL: the start IS recorded for this run, so the old code's answer cannot be
        // excused by an absent record.
        $this->assertNotNull(RunStart::recorded('run-h'), 'the frame was rendered and no start was recorded');

        fwrite(STDOUT, '[gh675] A: the start is recorded and the run names an input nothing declares'.PHP_EOL);
        $this->fileRow($user, $site, 'run-h', ['made.up.key'])->assertStatus(200);

        $judged = $this->judgementInTheRow();
        $this->assertSame('input-not-in-list', $judged[0]['missing'][0]['cause']);
        $this->assertSame('run-incomplete', AnalysisNotice::classOf('input-not-in-list'));
    }

    public function test_A_a_sample_type_outside_the_three_is_the_same_case(): void
    {
        [$user, $site] = $this->site();
        $this->openFrame($user, $site, 'run-i');

        fwrite(STDOUT, '[gh675] A: a sample type the record does not carry'.PHP_EOL);
        $this->fileRow($user, $site, 'run-i', ['samples.loi'])->assertStatus(200);

        $judged = $this->judgementInTheRow();
        $this->assertSame('input-not-in-list', $judged[0]['missing'][0]['cause']);
    }

    /**
     * GH-777 (the analyst's finding B) — A VALUE THAT LIVES IN A COLUMN OF `sites` IS A VALUE THE
     * CLIENT ENTERED.
     *
     * `filled()` read the site's config for every input of the list, and this one is a column. It came
     * out "not filled", and the client would be told to enter what it had entered — blame pointed at
     * the client, the worst direction for an error. Measured on the stand before the repair: 5 of 21
     * sites carry this column.
     */
    public function test_B_a_value_in_a_column_of_sites_is_not_called_not_entered(): void
    {
        [$user, $site] = $this->site();
        $site->forceFill(['soil_texture_override' => 'sand'])->save();
        $this->openFrame($user, $site->fresh(), 'run-j');

        $set = RunStart::recorded('run-j');
        fwrite(STDOUT, '[gh675] B: the site column holds "sand"; the start set says '
            .json_encode($set['settings']['sites.soil_texture_override'] ?? '(absent)').PHP_EOL);

        $this->fileRow($user, $site, 'run-j', ['sites.soil_texture_override'])->assertStatus(200);

        $judged = $this->judgementInTheRow();
        $this->assertSame('input-did-not-arrive', $judged[0]['missing'][0]['cause']);
    }

    /**
     * GH-777 (finding B) — AND ONE A PERSON MAY ENTER IN THE SPRAY LOG INSTEAD OF IN SETTINGS.
     *
     * Two storages on one input, and the list says so. Measured on the stand: 2 sites carry their PGR
     * application only in the log, with nothing in the config.
     */
    public function test_B_a_pgr_application_only_in_the_spray_log_is_not_called_not_entered(): void
    {
        [$user, $site] = $this->site();
        DB::table('spray_logs')->insert([
            'account_id' => $site->account_id, 'site_id' => $site->id, 'user_id' => $user->id,
            'event_date' => now()->subDays(10)->toDateString(), 'zone' => 'Main',
            'product_name' => 'Primo Maxx', 'product_type' => 'pgr', 'active_ingredient' => 'trinexapac',
            'operator' => 'op', 'created_at' => now(), 'updated_at' => now(),
        ]);
        $this->openFrame($user, $site, 'run-k');

        $set = RunStart::recorded('run-k');
        fwrite(STDOUT, '[gh675] B: nothing in the config, one PGR entry in the log; the start set says '
            .json_encode($set['settings']['pgr.productType'] ?? '(absent)').PHP_EOL);

        $this->fileRow($user, $site, 'run-k', ['pgr.productType'])->assertStatus(200);

        $judged = $this->judgementInTheRow();
        $this->assertSame('input-did-not-arrive', $judged[0]['missing'][0]['cause']);
    }

    /**
     * GH-777 (finding B) — WHAT THE SERVER CANNOT READ IS NEVER THE CLIENT'S FAULT.
     *
     * The third answer of the record, and the case builds the record itself: a storage with no reader
     * answers `unknown`, and `unknown` must not become "you have not entered it". The start is present
     * and the input is declared, so neither of the other two causes can claim this.
     *
     * WHAT THIS CASE COVERS AND WHAT IT DOES NOT, measured with a mutation rather than assumed: it
     * holds the JUDGE's side — `unknown` in the set becomes `input-not-judged` — because it puts the
     * set in by hand. It does NOT hold the recorder's side, and it cannot: `RunStart` only answers
     * `unknown` for a storage with no reader, and `Gh777…` makes that state impossible while it is
     * green. That guard is the recorder's case.
     */
    public function test_B_a_storage_the_server_cannot_read_is_not_blamed_on_the_client(): void
    {
        [$user, $site] = $this->site();
        $set = RunStart::observe($site);
        $set['settings']['traffic.schedule'] = RunStart::UNKNOWN;
        Cache::put(RunStart::keyFor('run-l'), $set, 600);
        fwrite(STDOUT, '[gh675] B: the start set carries '
            .json_encode($set['settings']['traffic.schedule']).' for traffic.schedule'.PHP_EOL);

        $this->fileRow($user, $site, 'run-l', ['traffic.schedule'])->assertStatus(200);

        $judged = $this->judgementInTheRow();
        $this->assertSame('input-not-judged', $judged[0]['missing'][0]['cause']);
        $this->assertSame('run-incomplete', AnalysisNotice::classOf('input-not-judged'));
    }

    /**
     * GH-777 (the reviewer's return) — A VALUE THE FORM SAVED ELSEWHERE IN THE CONFIG IS STILL A VALUE
     * THE CLIENT ENTERED.
     *
     * `storedIn: config` was read as "the key is the path", and the Settings forms save six inputs
     * somewhere else. Measured on the stand before the repair: `irrigation.efficiency` is 75 on
     * `Canberra`, `Westview` and `Hoxton Soccer - Kate's test`, and `traffic.schedule.moisture` is
     * "optimal" on `Test5 - NZ` and `Hoxton` — four sites in all, each of which would be told by its
     * own server that it had entered nothing. The two live shapes are the fixture here.
     */
    public function test_B_a_value_the_form_saved_at_another_path_is_not_called_not_entered(): void
    {
        [$user, $site] = $this->site(['irrigation' => ['efficiency' => 75]]);
        $this->openFrame($user, $site, 'run-p');

        $set = RunStart::recorded('run-p');
        fwrite(STDOUT, '[gh675] B: the site carries irrigation.efficiency = 75; the start set says '
            .json_encode($set['settings']['schedule.efficiency'] ?? '(absent)')
            .' for schedule.efficiency'.PHP_EOL);

        $this->fileRow($user, $site, 'run-p', ['schedule.efficiency'])->assertStatus(200);
        $this->assertSame('input-did-not-arrive', $this->judgementInTheRow()[0]['missing'][0]['cause']);
    }

    public function test_B_and_the_soil_moisture_the_traffic_form_saves_under_its_schedule(): void
    {
        /**
         * GH-789: the two numbers travel with the moisture, because a schedule without either of them is not
         * filled since this item — and the lock would hold every page of this site. The subject here is
         * unchanged: the soil moisture is stored under the schedule and the start record reads it there.
         */
        [$user, $site] = $this->site(['traffic' => ['schedule' => [
            'moisture' => 'optimal', 'matchesPerWeek' => 0, 'sessionsPerWeek' => 0,
        ]]]);
        $this->openFrame($user, $site, 'run-q');

        $set = RunStart::recorded('run-q');
        fwrite(STDOUT, '[gh675] B: the site carries traffic.schedule.moisture = "optimal"; the start set says '
            .json_encode($set['settings']['soil.moisture'] ?? '(absent)').' for soil.moisture'.PHP_EOL);

        $this->fileRow($user, $site, 'run-q', ['soil.moisture'])->assertStatus(200);
        $this->assertSame('input-did-not-arrive', $this->judgementInTheRow()[0]['missing'][0]['cause']);
    }

    /**
     * GH-777 (queue item 4, slice 2, the analyst's answer of 29.09.2026) — THE NAME THE PASS USES IS
     * TRANSLATED INTO THE INPUT A PERSON FILLS IN, SO A SITE WITH NO WATER TEST IS TOLD THE TRUTH.
     *
     * The walk of slice 2 names what its gate checked — `water.ecw`, the run state's own spelling — and
     * this list is keyed by `samples.water`. The server looked among the keys alone, so the first output
     * of that walk came back as "the run named an input the list does not declare": OUR side, class
     * `run-incomplete`, and a re-run offered that cannot help. Measured by the analyst: 9 of the 13
     * sites with a run have no water sample at all and would have received exactly that.
     *
     * The list already declared the link (`readAs`), and it is the only place that does; the server
     * reads it now. What a person gets instead: "there is no water test for this site", class
     * `input-absent`, and no re-run offered.
     */
    public function test_a_state_name_the_pass_gates_on_is_judged_as_the_input_a_person_fills_in(): void
    {
        [$user, $site] = $this->site();
        $this->openFrame($user, $site, 'run-t');

        // No water sample on this site at all — the state of 9 of the 13 sites with a run.
        fwrite(STDOUT, '[gh675] the pass gates on `water.ecw`; the list knows it as '
            .json_encode(\App\Support\CalculationInputs::inputFor('water.ecw')).PHP_EOL);
        $this->fileRow($user, $site, 'run-t', ['water.ecw'])->assertStatus(200);

        $judged = $this->judgementInTheRow();
        $this->assertSame('input-not-entered', $judged[0]['missing'][0]['cause']);
        // The class is the one a re-run cannot fix, which is what makes the sentence honest.
        $this->assertSame('input-absent', AnalysisNotice::classOf('input-not-entered'));
        $this->assertFalse(AnalysisNotice::retryCanHelp('input-not-entered'));
        // Both sides of the link are in the row, for whoever reads it in a month.
        $this->assertSame('water.ecw', $judged[0]['missing'][0]['input']);
        $this->assertSame('samples.water', $judged[0]['missing'][0]['declaredAs']);
    }

    public function test_and_the_same_name_with_a_water_sample_is_our_side(): void
    {
        // The neighbour that must stay green: the reading was there at the start and the run did not get
        // it, which IS our defect — and the translation must not turn that into the client's fault.
        [$user, $site] = $this->site();
        $this->addSample($site, $user, 'water');
        $this->openFrame($user, $site, 'run-u');

        $this->fileRow($user, $site, 'run-u', ['water.ecw'])->assertStatus(200);
        $this->assertSame('input-did-not-arrive', $this->judgementInTheRow()[0]['missing'][0]['cause']);
    }

    /**
     * GH-777 (queue item 4, slice 2, the analyst's 76.2 C) — THE SHAPE THE PRODUCER ACTUALLY SENDS,
     * JUDGED.
     *
     * Every case above builds the body itself, and the reviewer's condition on slice 1 was that the
     * agreement between producer and server must be held against the PRODUCER's shape, not against the
     * test's idea of it. Slice 2 gave the producer to this account: the body below is the one the runner
     * built in `tests/gh777-what-does-not-apply-is-recorded.test.js`, copied with its two shapes — a
     * module made inapplicable by a missing input, and a module whose engine answered "not here" with
     * nothing missing at all.
     */
    public function test_the_producers_own_shape_is_judged_entry_by_entry(): void
    {
        [$user, $site] = $this->site();
        $this->openFrame($user, $site, 'run-r');

        // The producer's body, as the runner posted it.
        $detail = ['notApplicable' => [
            ['module' => 'salinity', 'missing' => ['samples.water']],
            ['module' => 'dew', 'missing' => []],
        ]];
        fwrite(STDOUT, '[gh675] the producer sent: '.json_encode($detail).PHP_EOL);

        $this->actingAs($user)->postJson('/api/analysis-cache', [
            'site_id' => $site->id, 'run_id' => 'run-r',
            'analyzed_at' => now()->toIso8601String(), 'metrics' => $this->metrics(),
            'computed' => [], 'detail' => $detail,
            'inputs' => ['site' => $site->id, 'samples' => []],
        ])->assertStatus(200);

        $judged = $this->judgementInTheRow();
        $this->assertSame(['salinity', 'dew'], array_column($judged, 'module'));
        // The input that is named is judged against the start...
        $this->assertSame('input-not-entered', $judged[0]['missing'][0]['cause']);
        // ...and the one with nothing missing blames no input, which is the whole point of the empty
        // list: an engine that answered is not a client who entered nothing.
        $this->assertSame([], $judged[1]['missing']);

        // And the third account does not MAKE a run partial: a site that is not a case for a module is
        // not an incomplete analysis (the owner, 23.09.2026: "if there is no input data and it was not
        // calculated, that is not a problem"). Measured as a comparison rather than as an absolute,
        // because this fixture's metrics are null and the outcome is `partial` for that reason alone —
        // asserting `complete` here would have been a claim about the fixture.
        $withIt = AnalysisResult::query()->latest('id')->first()->outcome;

        [$user2, $site2] = $this->site();
        $this->openFrame($user2, $site2, 'run-s');
        $this->actingAs($user2)->postJson('/api/analysis-cache', [
            'site_id' => $site2->id, 'run_id' => 'run-s',
            'analyzed_at' => now()->toIso8601String(), 'metrics' => $this->metrics(),
            'computed' => [], 'detail' => ['notApplicable' => []],
            'inputs' => ['site' => $site2->id, 'samples' => []],
        ])->assertStatus(200);
        $withoutIt = AnalysisResult::query()->latest('id')->first()->outcome;

        fwrite(STDOUT, '[gh675]    the run came out: '.$withIt.' with the account, '
            .$withoutIt.' without it'.PHP_EOL);
        $this->assertSame($withoutIt, $withIt);
    }

    /**
     * GH-777 (queue item 4, slice 2, the reviewer's return) — A NAME THE LIST KNOWS AND THE RECORD DOES
     * NOT CARRY IS OURS, NOT THE CLIENT'S.
     *
     * The translation of a state name into an input of the list opened a branch nothing was watching: the
     * name resolves, so it is not `undeclared`, and the start record has no entry for it — which happens
     * to a record written before that input was declared, or when the list gains an input while a run is
     * in flight. The reviewer broke the branch and ran the whole server suite: 621 tests, nothing moved.
     *
     * The answer must be `input-not-judged`, class `run-incomplete`: the server could not look the value
     * up, and a client is never told it entered nothing on the strength of a record that never held the
     * answer. The case builds the record itself, with one declared key removed.
     */
    public function test_a_declared_input_missing_from_the_start_record_is_not_blamed_on_the_client(): void
    {
        [$user, $site] = $this->site();
        $set = RunStart::observe($site);

        // The record as an older frame would have written it: the key the list declares is simply not
        // there. `traffic.schedule` is a key of the list, so the name resolves and `undeclared` cannot
        // be the answer -- which is what makes this branch its own case.
        $this->assertArrayHasKey('traffic.schedule', $set['settings']);
        unset($set['settings']['traffic.schedule']);
        Cache::put(RunStart::keyFor('run-v'), $set, 600);
        fwrite(STDOUT, '[gh675] the record carries '.count($set['settings'])
            .' inputs and not `traffic.schedule`; the list resolves that name to '
            .json_encode(\App\Support\CalculationInputs::inputFor('traffic.schedule')).PHP_EOL);

        $this->assertSame(RunStart::UNKNOWN, RunStart::had($set, 'traffic.schedule'));
        $this->fileRow($user, $site, 'run-v', ['traffic.schedule'])->assertStatus(200);

        $judged = $this->judgementInTheRow();
        $this->assertSame('input-not-judged', $judged[0]['missing'][0]['cause']);
        $this->assertSame('run-incomplete', AnalysisNotice::classOf('input-not-judged'));
        /**
         * GH-789: and the same name in a record that DOES carry it — asked of `turf.hoc`, which the shared
         * fixture does not answer. The schedule now comes with every site (the wizard asks for it), so asking
         * `had()` about it would be asking about a field that is always there.
         */
        $this->assertFalse(RunStart::had(RunStart::observe($site), 'turf.hoc'));
    }

    /**
     * GH-777 (unguarded promise No 10 of the analyst's 76.1) — THE SET IS IN THE ROW, AND IT IS THE
     * SET THAT WAS RECORDED.
     *
     * The row carried it and the test only PRINTED whether it was there, so `'runStart' => null` in
     * the controller would have stayed green — and with it the ability to read a judgement back in a
     * month, which is the whole reason the set is copied into the row.
     */
    public function test_10_the_row_carries_the_very_set_the_start_recorded(): void
    {
        [$user, $site] = $this->site();
        $this->addSample($site, $user, 'water');
        $this->openFrame($user, $site, 'run-m');
        $recorded = RunStart::recorded('run-m');

        $this->fileRow($user, $site, 'run-m', ['samples.water'])->assertStatus(200);

        $row = \App\Models\AnalysisResult::query()->latest('id')->first();
        $detail = is_array($row->detail) ? $row->detail : [];
        fwrite(STDOUT, '[gh675] No 10: the row\'s runStart is '
            .json_encode($detail['runStart']['observedAt'] ?? null).PHP_EOL);

        $this->assertNotNull($detail['runStart'] ?? null, 'the set was not copied into the row');
        $this->assertSame($recorded, $detail['runStart']);
    }

    /**
     * GH-777 (unguarded promise No 11) — A ROW WRITTEN BEFORE THIS DEVICE IS NOT JUDGED AFTERWARDS.
     *
     * The judgement happens once, at write time. A composer that judged an old row would be comparing
     * it against the database of today — the two-readings-at-two-moments class this device removes,
     * stretched over weeks. So an old row gets no cause at all, and the page keeps the sentence it
     * already prints.
     */
    public function test_11_a_row_from_before_the_device_gets_no_cause_invented_for_it(): void
    {
        [$user, $site] = $this->site();
        $row = \App\Models\AnalysisResult::query()->create([
            'site_id' => $site->id, 'run_id' => 'run-old', 'outcome' => 'complete',
            'started_at' => now()->subDay(), 'completed_at' => now()->subDay(),
            'metrics' => $this->metrics(), 'computed' => [],
            // As rows 1-76 on the stand are: a journal, and neither a judgement nor a start set.
            'detail' => ['nulls' => [], 'skipped' => [], 'warnings' => [], 'assumptions' => []],
            'inputs' => ['site' => $site->id],
        ]);
        $projection = AnalysisResults::forSite($site->fresh());
        // `irrigation`, because its step resolves through the graph to `irrigation`: a section key
        // whose step comes out null answers `cause: null` whatever the row says, and the claim below
        // would then be about the graph rather than about the row. Measured over the declared consumer
        // keys, 15 of 17 resolve a step.
        $section = AnalysisNotice::section('irrigation', $projection);
        fwrite(STDOUT, '[gh675] No 11: an old row, and the composer answers '
            .json_encode($section).PHP_EOL);

        $this->assertNull($section['cause'], 'a cause was invented for a row that carries none');
        $this->assertNull($section['text'], 'a sentence was printed for a cause nobody recorded');
        $this->assertFalse($section['retry']);
        // and the row itself was left alone
        $this->assertNull($row->fresh()->detail['runStart'] ?? null);
    }

    /**
     * GH-777 (O-10's reader, the reviewer's condition) — THE ROW'S OWN `notApplicable` REACHES THE
     * PROJECTION.
     *
     * The reader was written in GH-638 and nothing ran it, so a projection that stopped carrying the
     * run's own gaps would have been silent. This is the half that exists today: the row carries it,
     * the projection hands it on.
     */
    public function test_O10_what_the_row_says_did_not_apply_reaches_the_projection(): void
    {
         /**
          * GH-789 (queue item 7): the site is built WITHOUT a schedule on purpose — an empty object, which the
          * shared fixture leaves alone because a test that names a value keeps it. Since this item a schedule
          * with neither `matchesPerWeek` nor `sessionsPerWeek` is not filled, which is exactly the state this
          * case is about: an input the client never entered, whose address is the Traffic & Wear form.
          */
        /**
         * GH-789 (queue item 7): a GOLF site with no schedule. Since this item the wizard asks a sports surface
         * for its matches and sessions, so the lock holds every page of a sports site that has none — including
         * the run frame this case opens. The schedule is required for sports ONLY, so a golf site can carry the
         * state this case is about: an input of the list the client never entered, whose address is the
         * Traffic & Wear form. That address does not depend on the turf type.
         */
        [$user, $site] = $this->site(['turf' => ['turfType' => 'golf', 'subCategory' => 'greens'],
            'traffic' => ['schedule' => []]]);
        $this->openFrame($user, $site, 'run-n');
        $this->fileRow($user, $site, 'run-n', ['traffic.schedule'])->assertStatus(200);

        $projection = AnalysisResults::forSite($site->fresh());
        $carried = $projection['numbersRun']['notApplicable'] ?? null;
        fwrite(STDOUT, '[gh675] O-10: the projection carries '.json_encode($carried).PHP_EOL);

        $this->assertIsArray($carried);
        $this->assertSame('irrigation', $carried[0]['module']);
        $this->assertSame('traffic.schedule', $carried[0]['missing'][0]['input']);
        $this->assertSame('input-not-entered', $carried[0]['missing'][0]['cause']);
    }

    /**
     * GH-777 (the reviewer's return on O-9) — A SPORTS SITE IS TOLD ABOUT THE TAB A SPORTS SITE HAS.
     *
     * The address of an input is only right where the tab is there, and the Traffic & Wear tab is shown to
     * a sports site alone. So the sentence needs the KIND of site, and it has to come from the site: it is
     * read from `config.turf.turfType` by the projection's one owner, beside the methodology it already
     * carries (GH-742). Measured before this: 0 of the 95 stored runs carry a turf type anywhere, so the
     * three inputs of that tab carried a name, a place and a switch and gave a sentence to nobody -- a text
     * with no producer, which is the shape queue item 4 exists to clear out.
     */
    public function test_a_sports_site_is_sent_to_the_tab_a_sports_site_has(): void
    {
        [$user, $site] = $this->site();
        $this->openFrame($user, $site, 'run-p');
        $this->fileRow($user, $site, 'run-p', ['soil.moisture'], 'soil-temp-physics')->assertStatus(200);

        $projection = AnalysisResults::forSite($site->fresh());
        $section = AnalysisNotice::section('soilTempPhysics', $projection);
        fwrite(STDOUT, '[gh675] the site is a '.json_encode($projection['turfType'] ?? null)
            .' site and the section says: '.json_encode($section, JSON_UNESCAPED_SLASHES).PHP_EOL);

        // The kind of site reaches the reader from the settings, not from the row.
        $this->assertSame('sports', $projection['turfType'] ?? null);
        // And the sentence names the tab this site actually has.
        $this->assertSame('input-not-entered', $section['cause']);
        $this->assertStringContainsString(
            (string) \App\Support\CalculationInputs::label('soil.moisture'), (string) $section['text']);
        $this->assertStringContainsString(
            (string) \App\Support\CalculationInputs::placeFor('soil.moisture', 'sports'),
            (string) $section['text']);
    }

    /**
     * GH-777 (found inside this work) — THE CLIENT'S OWN ABSENT INPUT IS CLASSED AS ABSENT.
     *
     * `input-not-entered` was not in the reasons table at all, though the judge has been filing it
     * since GH-675. Measured before the repair: `classOf` answered `run-incomplete` — our side, a
     * re-run may fix it — for a value the client has not entered, which a re-run cannot fix; and
     * `reasonText` answered `the run reported "input-not-entered"`, a technical identifier in front of
     * a client, which the coordinator's rule forbids without exception.
     */
    public function test_an_absent_input_is_classed_as_absent_and_a_retry_is_not_offered(): void
    {
        fwrite(STDOUT, '[gh675] the class of input-not-entered: '
            .AnalysisNotice::classOf('input-not-entered').PHP_EOL);
        $this->assertSame('input-absent', AnalysisNotice::classOf('input-not-entered'));

        /**
         * GH-789 (queue item 7): a SPORTS site, and the unfilled input is the SOIL MOISTURE — the other input
         * of the same Traffic & Wear tab, which the shared fixture does not answer.
         *
         * The sentence under test is only shown to a sports site, because only a sports site has that tab, so
         * the fixture cannot become a golf one. And since this item the schedule cannot be the unfilled input
         * here: the wizard asks a sports surface for it, so the lock would hold the run frame this case opens.
         * The address is the same tab either way.
         */
        [$user, $site] = $this->site();
        $this->openFrame($user, $site, 'run-o');
        $this->fileRow($user, $site, 'run-o', ['soil.moisture'])->assertStatus(200);

        $this->assertFalse(AnalysisNotice::retryCanHelp('input-not-entered'),
            'a re-run is offered for a value nobody entered');
        // Still wordless: her sentence for this case needs the input's name, and that is her draft.
        $this->assertNull(AnalysisNotice::clientTexts()['reasons']['input-not-entered'] ?? null);

        // AND WHERE IT REACHED, which is no longer a boundary: this case used to print that the composer
        // looked for a `reason` on a `notApplicable` entry while the judged entry's shape is
        // `{module, missing: [{input, cause}]}`, so the section carried no cause and the page kept its own
        // sentence. That was promise O-9 of the analyst's 22.1 and it is done (GH-777): the section now
        // says why it is empty, in the owner's form, with the input's name and place from the inputs list.
        $section = AnalysisNotice::section('irrigation', AnalysisResults::forSite($site->fresh()));
        fwrite(STDOUT, '[gh675]    the section says: '.json_encode($section).PHP_EOL);
        $this->assertSame('input-not-entered', $section['cause']);

        // AND THE ADDRESS IS THIS SITE'S. The match and training schedule is entered in the Traffic & Wear
        // tab, which only a sports site is shown; this fixture is a sports site, so the tab is there and
        // the sentence names it. A site of another kind, or one whose kind nobody entered, gets no sentence
        // instead of a wrong address -- that pair is held in the sentence's own suite (GH-777).
        $this->assertStringContainsString(
            (string) \App\Support\CalculationInputs::label('soil.moisture'), (string) $section['text']);
        $this->assertStringContainsString(
            (string) \App\Support\CalculationInputs::placeFor('soil.moisture', 'sports'),
            (string) $section['text']);

        // The composition itself, on an input whose place every site can reach.
        $this->openFrame($user, $site, 'run-o2');
        $this->fileRow($user, $site, 'run-o2', ['samples.water'])->assertStatus(200);
        $withAPlace = AnalysisNotice::section('irrigation', AnalysisResults::forSite($site->fresh()));
        fwrite(STDOUT, '[gh675]    an input with a place says: '.json_encode($withAPlace).PHP_EOL);
        $this->assertSame('input-not-entered', $withAPlace['cause']);
        $this->assertStringContainsString(
            (string) \App\Support\CalculationInputs::label('samples.water'), (string) $withAPlace['text']);
        $this->assertStringContainsString(
            (string) \App\Support\CalculationInputs::placeFor('samples.water'), (string) $withAPlace['text']);
        $this->assertStringContainsString('has not been entered', (string) $withAPlace['text']);
    }
}
