<?php

namespace Tests\Feature;

use App\Models\Account;
use App\Models\Sample;
use App\Models\Site;
use App\Models\SiteSummary;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * GH-430 — POST /api/samples/sync must never delete a sample merely because the
 * push did not mention it.
 *
 * It used to: the endpoint ended each sample type with
 * reconcileMissingSnapshotSamples(), which soft-deleted every row of that
 * (site, sample_type) outside the keep-list the push had just built. The push is
 * not a complete picture and cannot be treated as one -- samples restored from
 * the server reach the browser store shaped as `values`, and sync() reads only
 * `rawData`, so a tab that has just captured one sample sends a keep-list of
 * exactly one. Live on the dev stack, before the fix: a site holding six
 * samples, one Capture, `synced: 1, deleted: 6`.
 *
 * These three tests are the shapes that mattered, and all three were red before
 * the method was removed.
 *
 * Deletion is inert until per-record writes land: removing a sample in the hub
 * reached the database only through this same mechanism, so a deleted sample now
 * returns on reload. That is the accepted trade -- better not-deleted than
 * over-deleted.
 */
class Gh430SamplesNoSnapshotDeleteTest extends TestCase
{
    use RefreshDatabase;

    public function test_one_local_sample_must_not_delete_server_samples(): void
    {
        $user = User::factory()->create();
        $site = $this->createSiteForUser($user, ['name' => 'Keep Site', 'slug' => 'keep-site']);

        // Seeded through POST /api/samples, not through sync: these stand for
        // samples the browser restored from the server, which sync() skips
        // because they carry no `rawData` -- so they could never have seeded
        // themselves from a sync body.
        for ($i = 1; $i <= 13; $i++) {
            $this->actingAs($user)
                ->withSession(['_token' => 'test-token'])
                ->postJson('/api/samples', [
                    '_token' => 'test-token',
                    'site_id' => $site->id,
                    'sample_type' => 'soil',
                    'client_uid' => 'server_'.$i,
                    'sample_date' => '2026-04-'.str_pad((string) $i, 2, '0', STR_PAD_LEFT),
                    'lab_date' => '2026-04-'.str_pad((string) $i, 2, '0', STR_PAD_LEFT),
                    'payload' => ['_label' => 'Server '.$i, 'K' => 40 + $i],
                ])
                ->assertCreated();
        }

        $this->assertSame(13, Sample::query()->where('site_id', $site->id)->count());

        // What the tab actually pushes after one Capture: thirteen restored
        // samples carrying `values`, plus the one local sample with `rawData`.
        $soil = [];
        for ($i = 1; $i <= 13; $i++) {
            $soil['server_'.$i] = [
                'id' => 'server_'.$i,
                'date' => '2026-04-'.str_pad((string) $i, 2, '0', STR_PAD_LEFT),
                'values' => ['K' => 40 + $i],
            ];
        }
        $soil['local_capture'] = [
            'id' => 'local_capture',
            'date' => '2026-05-05',
            'rawData' => ['label' => 'Local Capture', 'K' => 61],
        ];

        $this->actingAs($user)
            ->withSession(['_token' => 'test-token'])
            ->postJson('/api/samples/sync', [
                '_token' => 'test-token',
                'allSites' => [
                    $site->id => ['soil' => $soil, 'water' => [], 'tissue' => [], 'loi' => []],
                ],
            ])
            ->assertOk()
            ->assertJsonPath('data.synced', 1)
            ->assertJsonPath('data.deleted', 0);

        $this->assertSame(14, Sample::query()->where('site_id', $site->id)->count());
        $this->assertSame(0, Sample::query()->onlyTrashed()->where('site_id', $site->id)->count());
    }

    public function test_stale_snapshot_must_not_delete_a_sample_it_never_saw(): void
    {
        $user = User::factory()->create();
        $site = $this->createSiteForUser($user, ['name' => 'Stale Site', 'slug' => 'stale-site']);

        $this->pushSoil($user, $site, ['a1', 'a2', 'a3']);

        // A fourth sample arrives from somewhere the first tab never learns
        // about -- the Data page, a second device, a colleague.
        $this->actingAs($user)
            ->withSession(['_token' => 'test-token'])
            ->postJson('/api/samples', [
                '_token' => 'test-token',
                'site_id' => $site->id,
                'sample_type' => 'soil',
                'client_uid' => 'a4',
                'sample_date' => '2026-06-01',
                'lab_date' => '2026-06-01',
                'payload' => ['_label' => 'A4', 'K' => 50],
            ])
            ->assertCreated();

        // The first tab pushes again, still knowing only a1-a3.
        $this->pushSoil($user, $site, ['a1', 'a2', 'a3'], 2)
            ->assertJsonPath('data.deleted', 0);

        $this->assertDatabaseHas('samples', ['site_id' => $site->id, 'client_uid' => 'a4', 'deleted_at' => null]);
        $this->assertSame(4, Sample::query()->where('site_id', $site->id)->count());
    }

    public function test_summaries_of_untouched_samples_survive_a_partial_sync(): void
    {
        $user = User::factory()->create();
        $site = $this->createSiteForUser($user, ['name' => 'Summary Site', 'slug' => 'summary-site-429']);

        $this->pushSoil($user, $site, ['b1', 'b2']);

        $b2 = Sample::query()->where('site_id', $site->id)->where('client_uid', 'b2')->firstOrFail();
        $this->assertDatabaseHas('site_summaries', ['source_sample_id' => $b2->id, 'deleted_at' => null]);

        $this->pushSoil($user, $site, ['b1'], 2)->assertJsonPath('data.deleted', 0);

        $this->assertDatabaseHas('samples', ['id' => $b2->id, 'deleted_at' => null]);
        $this->assertSame(0, SiteSummary::query()->onlyTrashed()->where('source_sample_id', $b2->id)->count());
    }

    public function test_clear_site_data_still_deletes_on_request(): void
    {
        // The one deletion the endpoint is still allowed: an explicit
        // clearSiteData, which is what a Settings import asks for.
        $user = User::factory()->create();
        $site = $this->createSiteForUser($user, ['name' => 'Clear Site', 'slug' => 'clear-site-429']);

        $this->pushSoil($user, $site, ['c1', 'c2']);

        $this->actingAs($user)
            ->withSession(['_token' => 'test-token'])
            ->postJson('/api/samples/sync', [
                '_token' => 'test-token',
                'clearSiteData' => true,
                'allSites' => [
                    $site->id => [
                        'soil' => [
                            'c3' => ['id' => 'c3', 'date' => '2026-07-01', 'rawData' => ['label' => 'C3', 'K' => 44]],
                        ],
                        'water' => [], 'tissue' => [], 'loi' => [],
                    ],
                ],
            ])
            ->assertOk()
            ->assertJsonPath('data.synced', 1)
            ->assertJsonPath('data.deleted', 2);

        $this->assertSame(2, Sample::query()->onlyTrashed()->where('site_id', $site->id)->count());
        $this->assertDatabaseHas('samples', ['site_id' => $site->id, 'client_uid' => 'c3', 'deleted_at' => null]);
    }

    /**
     * $round bumps the date each re-push. SQLite's dynamic typing does not
     * truncate a datetime written into a DATE-affinity column the way MySQL
     * does, so re-sending an identical lab_date across two syncs makes
     * site_summaries' firstOrNew() lookup miss the row it inserted itself and
     * attempt a duplicate insert -- a SQLite-only test artifact, documented on
     * the same shape in SiteApiTest, not a production bug.
     */
    private function pushSoil(User $user, Site $site, array $uids, int $round = 1)
    {
        $soil = [];
        foreach ($uids as $index => $uid) {
            $soil[$uid] = [
                'id' => $uid,
                'date' => '2026-05-'.str_pad((string) ($round * 10 + $index + 1), 2, '0', STR_PAD_LEFT),
                'rawData' => ['label' => strtoupper($uid), 'K' => 40 + $index],
            ];
        }

        return $this->actingAs($user)
            ->withSession(['_token' => 'test-token'])
            ->postJson('/api/samples/sync', [
                '_token' => 'test-token',
                'allSites' => [
                    $site->id => ['soil' => $soil, 'water' => [], 'tissue' => [], 'loi' => []],
                ],
            ])
            ->assertOk();
    }

    private function createSiteForUser(User $user, array $overrides = []): Site
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
            'name' => 'Site '.substr((string) $user->id, -4),
            'slug' => 'site-'.substr((string) $user->id, -4),
            'site_type' => 'precinct',
            'created_by_user_id' => $user->id,
            'modified_by_user_id' => $user->id,
        ], $overrides));

        $site->users()->attach($user->id, ['role' => 'manager']);

        return $site;
    }
}
