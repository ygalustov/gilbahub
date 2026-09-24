<?php

namespace Tests\Feature;

use App\Models\Account;
use App\Models\AnalysisResult;
use App\Models\Sample;
use App\Models\Site;
use App\Models\SiteConfig;
use App\Models\User;
use App\Support\RunStart;
use Illuminate\Foundation\Testing\RefreshDatabase;
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
            'site_id' => $site->id, 'namespace' => 'gaip', 'config' => $config,
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

    /** The run's own account of what it did not have. */
    private function fileRow(User $user, Site $site, string $runId, array $missing): \Illuminate\Testing\TestResponse
    {
        return $this->actingAs($user)->postJson('/api/analysis-cache', [
            'site_id' => $site->id,
            'run_id' => $runId,
            'analyzed_at' => now()->toIso8601String(),
            'metrics' => $this->metrics(),
            'computed' => [],
            'detail' => ['notApplicable' => [['module' => 'irrigation', 'missing' => $missing]]],
            'inputs' => ['site' => $site->id, 'samples' => []],
        ]);
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

        fwrite(STDOUT, '[gh675] a config field never filled'.PHP_EOL);
        $this->fileRow($user, $site, 'run-f', ['traffic.schedule'])->assertStatus(200);

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
}
