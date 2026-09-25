<?php

namespace Tests\Feature;

use App\Models\Account;
use App\Models\Site;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

/**
 * GH-729 (queue item 3al) — THE RUN ID A PREDICTION ARRIVES WITH REACHES THE COLUMN.
 *
 * The browser half is measured in `tests/gh729-…`: the logger stamps a prediction with the run's
 * own id rather than a UUID of its own, and sends it under the name this controller reads. That
 * left one link unguarded and it was named as a remainder — whether the server then STORES what
 * it was sent. The reviewer of the item closed it by reading the controller and the migration,
 * and reading is how the first fault survived: the logger sent `cascade_run_id` for as long as
 * anyone could remember while this reads `cascade_id`, and 1718 rows carried an empty column
 * without one line of code looking wrong.
 *
 * So the link is asserted by writing through the route and reading the column back.
 *
 * WHAT THIS DOES NOT COVER, said rather than left: it does not check that a run was in flight —
 * that is the browser's half — and it does not follow the id onward into the outcome tables.
 */
class Gh729PredictionKeepsItsRunTest extends TestCase
{
    use RefreshDatabase;

    public function test_the_run_id_a_prediction_arrives_with_is_the_one_in_the_column(): void
    {
        [$user, $site] = $this->site();

        $this->send($user, [$this->prediction($site->id, 'run-alpha-123')])->assertSuccessful();

        $rows = DB::table('predictions')->select('site_identifier', 'module', 'cascade_id')->get();
        fwrite(STDOUT, PHP_EOL.'[gh729] rows stored: '.$rows->count()
            .' | cascade_id values: '.json_encode($rows->pluck('cascade_id')->all()).PHP_EOL);

        // Positive control first: a prediction was stored at all. Without it, an assertion about
        // the column would pass over an empty table — which is exactly the state the browser half
        // left behind for 1718 rows.
        $this->assertSame(1, $rows->count(), 'nothing was stored, so nothing can be said about the column');
        $this->assertSame('run-alpha-123', $rows->first()->cascade_id);
    }

    public function test_a_prediction_with_no_run_keeps_an_empty_column_rather_than_a_stand_in(): void
    {
        // The other half of the browser's rule: outside a run frame the id is `null`, and the
        // server must keep it null rather than filling it with anything of its own.
        [$user, $site] = $this->site();

        $this->send($user, [$this->prediction($site->id, null)])->assertSuccessful();

        $stored = DB::table('predictions')->first();
        fwrite(STDOUT, '[gh729] with no run, the column holds: '.json_encode($stored->cascade_id).PHP_EOL);

        $this->assertNotNull($stored, 'nothing was stored');
        $this->assertNull($stored->cascade_id);
    }

    public function test_two_predictions_of_one_run_carry_the_same_id__which_is_what_ties_them(): void
    {
        /**
         * The point of the id is not that it exists but that it GROUPS: the rows a single run
         * produced can be told from the rows of the next run of the same site. A per-call id
         * satisfied "not empty" and failed this.
         */
        [$user, $site] = $this->site();

        $this->send($user, [
            $this->prediction($site->id, 'run-beta-9', 'soil'),
            $this->prediction($site->id, 'run-beta-9', 'disease'),
        ])->assertSuccessful();
        $this->send($user, [$this->prediction($site->id, 'run-gamma-1', 'water')])->assertSuccessful();

        $byRun = DB::table('predictions')->get()->groupBy('cascade_id')
            ->map(fn ($g) => $g->pluck('module')->sort()->values()->all())->all();
        fwrite(STDOUT, '[gh729] modules grouped by the run that produced them: '
            .json_encode($byRun).PHP_EOL);

        $this->assertSame(['disease', 'soil'], $byRun['run-beta-9'] ?? null);
        $this->assertSame(['water'], $byRun['run-gamma-1'] ?? null);
    }

    public function test_a_batch_carrying_TWO_runs_in_one_request_keeps_each_row_with_its_own(): void
    {
        /**
         * GH-729 (the reviewer's return, position 1) — TWO RUNS IN ONE REQUEST.
         *
         * The case above sends two runs as two requests, so every row of a request shared one id
         * and "the id of the first prediction, given to all" was a mutation nothing could see. The
         * route's loop accepts a batch of any shape, and the page is free to send one: a batch
         * holding two runs would file every row under the first run's id, and the site would then
         * say a run produced work it never did.
         */
        [$user, $site] = $this->site();

        $this->send($user, [
            $this->prediction($site->id, 'run-one', 'soil'),
            $this->prediction($site->id, 'run-two', 'disease'),
            $this->prediction($site->id, 'run-one', 'water'),
        ])->assertSuccessful();

        $byRun = DB::table('predictions')->get()->groupBy('cascade_id')
            ->map(fn ($g) => $g->pluck('module')->sort()->values()->all())->all();
        fwrite(STDOUT, '[gh729] one request, two runs — modules by run: '.json_encode($byRun).PHP_EOL);

        // Positive control: all three rows were written, or a batch that stored one row would
        // agree with any claim about how the ids were spread.
        $this->assertSame(3, DB::table('predictions')->count(), 'the batch did not store three rows');
        $this->assertSame(['soil', 'water'], $byRun['run-one'] ?? null);
        $this->assertSame(['disease'], $byRun['run-two'] ?? null);
    }

    public function test_a_SECOND_run_of_the_same_day_puts_ITS_OWN_id_on_the_row_it_updates(): void
    {
        /**
         * GH-729 (the reviewer's return, position 2) — THE RE-RUN, which is what the upsert exists
         * for: its own comment says it "prevents duplicates when the hidden hub re-runs analysis on
         * report pages". The unique key is the day (`user_id, site_identifier, module, sub_key,
         * predicted_date`), so a second run of the same day lands on the SAME ROW. If `cascade_id`
         * is not among the columns the upsert updates, that row keeps the FIRST run's id while its
         * numbers come from the second — a row naming a run that did not produce it.
         */
        [$user, $site] = $this->site();

        $first = $this->prediction($site->id, 'run-morning');
        $first['predicted_value'] = 10.0;
        $this->send($user, [$first])->assertSuccessful();

        $again = $this->prediction($site->id, 'run-afternoon');
        $again['predicted_value'] = 44.0;
        $this->send($user, [$again])->assertSuccessful();

        $rows = DB::table('predictions')->select('cascade_id', 'predicted_value')->get();
        fwrite(STDOUT, '[gh729] same day, second run — rows: '.json_encode($rows->all()).PHP_EOL);

        // Positive control: the second send REPLACED the row rather than adding one, which is the
        // state this case is about. Two rows would make the claim below true for a reason that has
        // nothing to do with the id being updated.
        $this->assertSame(1, $rows->count(), 'the re-run did not land on the same row');
        $this->assertSame('run-afternoon', $rows->first()->cascade_id,
            'the row kept the first run\'s id while taking the second run\'s numbers');
    }

    private function prediction(string $siteId, ?string $runId, string $module = 'soil'): array
    {
        return [
            'site_id' => $siteId,
            'module' => $module,
            'sub_key' => $module.'_rate',
            'cascade_id' => $runId,
            'prediction_type' => 'numeric',
            'predicted_value' => 12.5,
            'predicted_label' => 'Apply 12.5 kg N/ha',
            'predicted_at' => now()->toIso8601String(),
        ];
    }

    private function send(User $user, array $predictions)
    {
        return $this->actingAs($user->fresh())
            ->withSession(['_token' => 'gh729'])
            ->postJson('/api/predictions', ['_token' => 'gh729', 'predictions' => $predictions]);
    }

    /** @return array{0:User,1:Site} */
    private function site(): array
    {
        $user = User::factory()->create(['is_admin' => false]);
        $account = Account::query()->firstOrCreate(
            ['owner_user_id' => $user->id],
            ['display_name' => $user->name, 'created_by_user_id' => $user->id, 'modified_by_user_id' => $user->id]
        );
        $site = Site::query()->create([
            'account_id' => $account->id, 'name' => 'Predicted',
            'slug' => 'predicted-'.substr((string) $user->id, -6),
            'site_type' => 'sports', 'timezone' => 'UTC',
            'created_by_user_id' => $user->id, 'modified_by_user_id' => $user->id,
        ]);
        $site->users()->attach($user->id, ['role' => 'manager']);
        $user->forceFill(['last_active_site_id' => $site->id])->save();

        return [$user->fresh(), $site];
    }
}
