<?php

namespace Tests\Feature;

use App\Models\Account;
use App\Models\Sample;
use App\Models\Site;
use App\Models\SiteSummary;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

/**
 * GH-526 (PLAN-samples-sync-FINAL, stage 1) — the server routes.
 *
 * Stage 1 gives the samples table one deletion route and makes four other
 * server-side changes the plan asks for before the hub is rewritten. What is
 * proved here:
 *
 *   destroy()  — rights are checked against the SAMPLE's site, not the user's
 *                active one; a summary built from the deleted sample is
 *                re-pointed at a live sibling of the same day, or retired with
 *                it; who deleted it and from where is recorded.
 *   index()    — `meta.total` against `meta.returned`, so a client served a
 *                subset can tell.
 *   sync()     — a clearing import may name one site; two is a 422.
 *   update()   — a renamed sample registers its name on the site.
 *   D-3        — an import that clears a site hides its logs instead of
 *                destroying them, and the same field-log entry can be written
 *                again afterwards despite unique(user_id, client_uid).
 */
class Gh526SampleDeleteRouteTest extends TestCase
{
    use RefreshDatabase;

    public function test_destroy_soft_deletes_the_sample_and_records_who_and_whence(): void
    {
        $user = User::factory()->create();
        $site = $this->siteFor($user, 'delete-attribution');
        $sample = $this->sampleFor($site, $user, 'a1', '2026-03-01');

        $this->actingAs($user)
            ->withSession(['_token' => 't'])
            ->deleteJson('/api/samples/'.$sample->id, ['_token' => 't', 'source' => 'hub'])
            ->assertOk()
            ->assertJsonPath('data.id', $sample->id)
            ->assertJsonPath('data.delete_source', 'hub');

        $this->assertSoftDeleted('samples', ['id' => $sample->id]);
        $this->assertDatabaseHas('samples', [
            'id' => $sample->id,
            'delete_source' => 'hub',
            'deleted_by_user_id' => $user->id,
        ]);
    }

    public function test_destroy_refuses_a_viewer(): void
    {
        $owner = User::factory()->create();
        $site = $this->siteFor($owner, 'viewer-refused');
        $sample = $this->sampleFor($site, $owner, 'v1', '2026-03-02');

        $viewer = User::factory()->create();
        $site->users()->attach($viewer->id, ['role' => 'viewer']);

        $this->actingAs($viewer)
            ->withSession(['_token' => 't'])
            ->deleteJson('/api/samples/'.$sample->id, ['_token' => 't'])
            ->assertForbidden();

        $this->assertDatabaseHas('samples', ['id' => $sample->id, 'deleted_at' => null]);
    }

    public function test_destroy_is_bound_to_the_samples_own_site_not_the_active_one(): void
    {
        // The defect in the route this replaces: DataController::destroy()
        // resolved the row by (id, user's ACTIVE site), so the same request
        // succeeded or 404'd depending on which site the user was looking at.
        $user = User::factory()->create();
        $siteA = $this->siteFor($user, 'own-site-a');
        $siteB = $this->siteFor($user, 'own-site-b');
        $sample = $this->sampleFor($siteA, $user, 's1', '2026-03-03');

        $user->forceFill(['last_active_site_id' => $siteB->id])->save();

        $this->actingAs($user)
            ->withSession(['_token' => 't'])
            ->deleteJson('/api/samples/'.$sample->id, ['_token' => 't'])
            ->assertOk();

        $this->assertSoftDeleted('samples', ['id' => $sample->id]);
    }

    public function test_destroy_checks_rights_on_the_samples_site_not_on_the_active_one(): void
    {
        // GH-528 — RESOLUTION AND PERMISSION ARE TWO CLAIMS, and the suite only
        // made the first.
        //
        // The test above proves the ROW is found by its own site rather than by
        // the user's active one. It cannot prove anything about RIGHTS, because
        // it gives both sites to the same user: `canEditSite()` answers true
        // whichever site it is handed, so replacing the guard's argument with the
        // active site leaves it green. Measured: with
        // `canEditSite($request->user()->activeSite ?? $sample->site)` on
        // SampleController.php:490, the whole server suite was 191 of 191.
        //
        // The case that was missing is the one where the two answers differ: a
        // user who may edit the site they are STANDING on and may not edit the
        // site the sample BELONGS to. Reading rights off the active site lets
        // them delete another account's sample.
        $owner = User::factory()->create();
        $theirSite = $this->siteFor($owner, 'permission-theirs');
        $theirSample = $this->sampleFor($theirSite, $owner, 'not-yours', '2026-08-01');

        $intruder = User::factory()->create();
        $ownSite = $this->siteFor($intruder, 'permission-mine');
        // Manager of their own site, attached to nothing else.
        $intruder->forceFill(['last_active_site_id' => $ownSite->id])->save();

        $this->assertTrue($intruder->fresh()->canEditSite($ownSite), 'the active site is editable');
        $this->assertFalse($intruder->fresh()->canEditSite($theirSite), "the sample's site is not");

        $response = $this->actingAs($intruder->fresh())
            ->withSession(['_token' => 't'])
            ->deleteJson('/api/samples/'.$theirSample->id, ['_token' => 't', 'source' => 'hub']);

        // WHICH CODE, printed, because the code IS the subject.
        //
        // 403 means the request was understood and refused on rights. 404 would
        // mean the row was not found -- which is the OTHER defect, the one the
        // test above this covers, and a test that goes red with 404 under a
        // permission mutation is guarding resolution again under a new name.
        // 500 would mean neither claim was reached.
        fwrite(STDERR, "\n[gh528] DELETE another account's sample -> HTTP "
            .$response->getStatusCode()."\n");

        $response->assertForbidden();
        $this->assertSame(403, $response->getStatusCode());

        $this->assertDatabaseHas('samples', ['id' => $theirSample->id, 'deleted_at' => null]);
    }

    public function test_destroy_repoints_a_summary_at_a_live_sibling_of_the_same_day(): void
    {
        $user = User::factory()->create();
        $site = $this->siteFor($user, 'summary-repoint');
        $kept = $this->sampleFor($site, $user, 'keep', '2026-04-01');
        $doomed = $this->sampleFor($site, $user, 'doomed', '2026-04-01');

        $summary = SiteSummary::query()->create([
            'account_id' => $site->account_id,
            'site_id' => $site->id,
            'sample_type' => 'soil',
            'lab_date' => '2026-04-01',
            'summary' => ['k' => 1],
            'source_sample_id' => $doomed->id,
            'created_by_user_id' => $user->id,
            'modified_by_user_id' => $user->id,
        ]);

        $this->actingAs($user)
            ->withSession(['_token' => 't'])
            ->deleteJson('/api/samples/'.$doomed->id, ['_token' => 't'])
            ->assertOk();

        $summary->refresh();
        $this->assertNull($summary->deleted_at, 'the summary still has a sample behind it');
        $this->assertSame($kept->id, $summary->source_sample_id);
    }

    public function test_destroy_retires_a_summary_with_no_sibling_left(): void
    {
        $user = User::factory()->create();
        $site = $this->siteFor($user, 'summary-retire');
        $only = $this->sampleFor($site, $user, 'only', '2026-05-01');

        $summary = SiteSummary::query()->create([
            'account_id' => $site->account_id,
            'site_id' => $site->id,
            'sample_type' => 'soil',
            'lab_date' => '2026-05-01',
            'summary' => ['k' => 1],
            'source_sample_id' => $only->id,
            'created_by_user_id' => $user->id,
            'modified_by_user_id' => $user->id,
        ]);

        $this->actingAs($user)
            ->withSession(['_token' => 't'])
            ->deleteJson('/api/samples/'.$only->id, ['_token' => 't'])
            ->assertOk();

        $this->assertSoftDeleted('site_summaries', ['id' => $summary->id]);
    }

    public function test_destroy_rejects_an_unknown_delete_source(): void
    {
        $user = User::factory()->create();
        $site = $this->siteFor($user, 'source-closed');
        $sample = $this->sampleFor($site, $user, 'src', '2026-03-04');

        $this->actingAs($user)
            ->withSession(['_token' => 't'])
            ->deleteJson('/api/samples/'.$sample->id, ['_token' => 't', 'source' => 'somewhere-else'])
            ->assertStatus(422);

        $this->assertDatabaseHas('samples', ['id' => $sample->id, 'deleted_at' => null]);
    }

    public function test_index_says_how_many_it_is_holding_back(): void
    {
        $user = User::factory()->create();
        $site = $this->siteFor($user, 'index-meta');
        for ($i = 0; $i < 7; $i++) {
            $this->sampleFor($site, $user, 'm'.$i, '2026-06-0'.($i + 1));
        }

        $this->actingAs($user)
            ->getJson('/api/samples?limit=3')
            ->assertOk()
            ->assertJsonPath('meta.total', 7)
            ->assertJsonPath('meta.returned', 3)
            ->assertJsonCount(3, 'data');
    }

    public function test_a_clearing_import_may_name_one_site_only(): void
    {
        $user = User::factory()->create();
        $siteA = $this->siteFor($user, 'clear-a');
        $siteB = $this->siteFor($user, 'clear-b');

        $this->actingAs($user)
            ->withSession(['_token' => 't'])
            ->postJson('/api/samples/sync', [
                '_token' => 't',
                'clearSiteData' => true,
                'allSites' => [
                    $siteA->id => ['soil' => []],
                    $siteB->id => ['soil' => []],
                ],
            ])
            ->assertStatus(422);
    }

    public function test_a_clearing_import_of_one_site_is_accepted(): void
    {
        // The other side of the rule, so the refusal above cannot be passed by a
        // route that refuses every clear.
        $user = User::factory()->create();
        $site = $this->siteFor($user, 'clear-one');

        $this->actingAs($user)
            ->withSession(['_token' => 't'])
            ->postJson('/api/samples/sync', [
                '_token' => 't',
                'clearSiteData' => true,
                'allSites' => [$site->id => ['soil' => []]],
            ])
            ->assertOk();
    }

    /**
     * GH-534: this test asserted the opposite until the owner reversed D-3 on
     * 18.09.2026 — "hard for the journal only; leave the samples as they were".
     * Its name said "hides", and it checked `deleted_at` on a column that no
     * longer exists. The subject is unchanged and is still worth a test: what
     * a clearing import does to the site's logs. Only the answer moved.
     *
     * The samples half of this file is untouched and still soft — the two
     * kinds of data were separated by the owner, not by us. A lab reading
     * cannot be taken again; a spray log is a record of something the user did.
     */
    public function test_a_clearing_import_destroys_the_sites_logs(): void
    {
        $user = User::factory()->create();
        $site = $this->siteFor($user, 'd3-logs');

        $sprayId = DB::table('spray_logs')->insertGetId([
            'account_id' => $site->account_id, 'site_id' => $site->id, 'user_id' => $user->id,
            'event_date' => '2026-07-01', 'product_name' => 'Thing', 'zone' => 'Greens',
            'created_at' => now(), 'updated_at' => now(),
        ]);
        DB::table('field_log_entries')->insert([
            'account_id' => $site->account_id, 'site_id' => $site->id, 'user_id' => $user->id,
            'client_uid' => 'fl-1', 'entry_type' => 'note', 'observed_at' => now(),
            'payload' => json_encode(['text' => 'before']),
            'created_at' => now(), 'updated_at' => now(),
        ]);

        $this->actingAs($user)
            ->withSession(['_token' => 't'])
            ->postJson('/api/samples/sync', [
                '_token' => 't',
                'clearSiteData' => true,
                'allSites' => [$site->id => ['soil' => []]],
            ])
            ->assertOk();

        // Gone, not hidden. Asserted as an absence of ROWS rather than as a
        // value in a column, which is the whole difference this reversal makes.
        $this->assertSame(0, DB::table('spray_logs')->where('id', $sprayId)->count());
        $this->assertSame(0, DB::table('spray_logs')->where('site_id', $site->id)->count());
        $this->assertSame(0, DB::table('field_log_entries')->where('site_id', $site->id)->count());

        // And absent where a user would look.
        $user->forceFill(['last_active_site_id' => $site->id])->save();
        // GH-534: this was `assertDontSee('Thing')`, which searches the whole
        // response body for a substring. It passes today and would keep
        // passing for the wrong reason the moment the word turned up in some
        // other field, and it would also pass on a response that failed to
        // list anything at all. Asserted against the endpoint's own shape
        // instead: no entry, and none named. `entries` is the key this route
        // wraps its rows in (SprayLogController::index()).
        $this->actingAs($user)->getJson('/api/spray-log?site_id='.$site->id)
            ->assertOk()
            ->assertJsonCount(0, 'entries')
            ->assertJsonMissing(['product_name' => 'Thing']);
        $this->actingAs($user)->getJson('/api/field-log/entries?site_id='.$site->id)->assertOk()
            ->assertJsonCount(0, 'data');
    }

    /**
     * GH-534: kept, with its reason replaced rather than the test deleted.
     *
     * It existed because a soft-deleted row still occupied unique(user_id,
     * client_uid), so re-logging the same entry needed `deleted_at` cleared.
     * There is no hidden row now, so the key is simply free — a different
     * mechanism reaching the same place. The behaviour a user sees is what was
     * worth pinning either way: the same entry, written again after a clear,
     * works and leaves one row.
     */
    public function test_the_same_field_log_entry_can_be_written_again_after_a_clear(): void
    {
        $user = User::factory()->create();
        $site = $this->siteFor($user, 'd3-reinsert');

        DB::table('field_log_entries')->insert([
            'account_id' => $site->account_id, 'site_id' => $site->id, 'user_id' => $user->id,
            'client_uid' => 'fl-again', 'entry_type' => 'note', 'observed_at' => now(),
            'payload' => json_encode(['text' => 'first']),
            'created_at' => now(), 'updated_at' => now(),
        ]);

        $this->actingAs($user)
            ->withSession(['_token' => 't'])
            ->postJson('/api/samples/sync', [
                '_token' => 't',
                'clearSiteData' => true,
                'allSites' => [$site->id => ['soil' => []]],
            ])
            ->assertOk();

        $this->actingAs($user)
            ->withSession(['_token' => 't'])
            ->postJson('/api/field-log/entries', [
                '_token' => 't',
                'site_id' => $site->id,
                'client_uid' => 'fl-again',
                'type' => 'note',
                'observed_at' => now()->toIso8601String(),
                'data' => ['text' => 'second'],
            ])
            ->assertSuccessful();

        $rows = DB::table('field_log_entries')->where('client_uid', 'fl-again')->get();
        $this->assertCount(1, $rows, 'one row, not a duplicate and not a failed insert');
        // The row carries the SECOND write, so it was replaced rather than
        // left as the pre-clear one under a reused key. The envelope is
        // {data: {...}, photo: ...} -- the first draft of this line read
        // ['text'] at the top level and went red on the shape.
        $this->assertSame('second', json_decode($rows->first()->payload, true)['data']['text']);
    }

    private function siteFor(User $user, string $slug): Site
    {
        $account = Account::query()->firstOrCreate(
            ['owner_user_id' => $user->id],
            [
                'display_name' => $user->name,
                'created_by_user_id' => $user->id,
                'modified_by_user_id' => $user->id,
            ]
        );

        $site = Site::query()->create([
            'account_id' => $account->id,
            'name' => $slug,
            'slug' => $slug.'-'.substr((string) $user->id, -4),
            'site_type' => 'precinct',
            'created_by_user_id' => $user->id,
            'modified_by_user_id' => $user->id,
        ]);

        $site->users()->attach($user->id, ['role' => 'manager']);

        return $site;
    }

    private function sampleFor(Site $site, User $user, string $uid, string $labDate): Sample
    {
        return Sample::query()->create([
            'account_id' => $site->account_id,
            'site_id' => $site->id,
            'sample_type' => 'soil',
            'client_uid' => $uid,
            'lab_date' => $labDate,
            'payload' => ['K' => 100],
            'created_by_user_id' => $user->id,
            'modified_by_user_id' => $user->id,
        ]);
    }
}
