<?php

namespace Tests\Feature;

use App\Models\Account;
use App\Models\Site;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * GH-536 (PLAN-samples-sync-FINAL, stage 3) — the client now DEPENDS on `meta`,
 * so `meta` gets a guard.
 *
 * WHY THIS TEST EXISTS AND WHY IT IS SERVER-SIDE FOR A CLIENT-SIDE STAGE.
 *
 * GH-526 (stage 1) added `meta: {total, returned}` to GET /api/samples. Nothing
 * read it. Measured before this delivery: zero occurrences of `meta.total` or
 * `meta.returned` anywhere in assets/sample-persistence.js.
 *
 * Until this stage that was harmless. The browser kept its own copy of the
 * samples, so a request that returned 200 of 201 rows meant an incomplete
 * cache over a complete local store. Stage 3 removes the copy, and the same
 * short read becomes the only thing the client will ever see: one sample it
 * cannot display and does not know is missing.
 *
 * So the client now reads `returned < total` and refuses to work quietly on the
 * subset. That makes these two fields part of the contract rather than debug
 * ornament, and a contract with nothing holding it is a contract that changes
 * by accident. If `meta` is ever dropped, renamed, or computed AFTER the limit
 * is applied, the client's short-read detection goes blind and fails open —
 * back to exactly the behaviour this stage removed, with no symptom.
 *
 * `total` counted BEFORE the limit is the whole point, and it is the one thing
 * about this that is easy to break while the response still looks right:
 * `total === returned` always, and the check can never fire.
 */
class Gh536SamplesListMetaTest extends TestCase
{
    use RefreshDatabase;

    private const LAB = ['pH_Water' => 6.2, 'K' => 41, 'P' => 38];

    public function test_meta_reports_the_full_count_and_the_returned_count(): void
    {
        $user = User::factory()->create();
        $site = $this->createSiteForUser($user);

        // Five samples, each on its own lab_date: two sharing one collide on
        // site_summaries' unique index under SQLite, a harness artifact
        // SiteApiTest documents at length and not a product bug.
        for ($i = 1; $i <= 5; $i++) {
            $this->createSample($user, $site, 'uid_'.$i, sprintf('2026-05-%02d', $i));
        }

        $all = $this->actingAs($user)->getJson('/api/samples?limit=50')->assertOk();
        $this->assertSame(5, $all->json('meta.total'));
        $this->assertSame(5, $all->json('meta.returned'));
        $this->assertCount(5, $all->json('data'));

        // The short read. This is the shape the client turns into
        // "Loaded 2 of 5 samples."
        $short = $this->actingAs($user)->getJson('/api/samples?limit=2')->assertOk();
        $this->assertCount(2, $short->json('data'), 'the limit was not applied');
        $this->assertSame(2, $short->json('meta.returned'));
        $this->assertSame(
            5,
            $short->json('meta.total'),
            'total came back equal to returned, which means it was counted AFTER the limit. '
            .'The client compares the two to detect a short read; counted this way they can '
            .'never differ and the check is dead while still looking present.'
        );
    }

    public function test_an_account_with_no_samples_answers_with_a_total_of_zero(): void
    {
        // The other half of the distinction stage 3 is built on: this is what
        // "empty" looks like on the wire, and it must be an ordinary 200 with a
        // real total rather than anything the client could mistake for a
        // failure. An empty account keeps its store unlocked.
        $user = User::factory()->create();
        $this->createSiteForUser($user);

        $response = $this->actingAs($user)->getJson('/api/samples?limit=200')->assertOk();

        $this->assertSame([], $response->json('data'));
        $this->assertSame(0, $response->json('meta.total'));
        $this->assertSame(0, $response->json('meta.returned'));
    }

    public function test_the_limit_the_client_asks_for_is_accepted(): void
    {
        // sample-persistence.js sends CONFIG.restoreLimit, which is 200. The
        // route validates `max:2000`. A limit the route rejected would come back
        // 422 and the client would read it as "could not load" — correct, but
        // for the wrong reason, and on every page load.
        $user = User::factory()->create();
        $this->createSiteForUser($user);

        $this->actingAs($user)->getJson('/api/samples?limit=200')->assertOk();
        $this->actingAs($user)->getJson('/api/samples?limit=2000')->assertOk();
        $this->actingAs($user)->getJson('/api/samples?limit=2001')->assertStatus(422);
    }

    private function createSample(User $user, Site $site, string $uid, string $date): string
    {
        return $this->actingAs($user)
            ->withSession(['_token' => 'test-token'])
            ->postJson('/api/samples', [
                '_token'      => 'test-token',
                'site_id'     => $site->id,
                'sample_type' => 'soil',
                'client_uid'  => $uid,
                'sample_date' => $date,
                'lab_date'    => $date,
                'payload'     => self::LAB,
            ])
            ->assertCreated()
            ->json('data.id');
    }

    private function createSiteForUser(User $user): Site
    {
        $account = Account::query()->firstOrCreate(
            ['owner_user_id' => $user->id],
            [
                'display_name'        => $user->name,
                'created_by_user_id'  => $user->id,
                'modified_by_user_id' => $user->id,
            ]
        );

        $site = Site::query()->create([
            'account_id'          => $account->id,
            'name'                => 'Meta Site',
            'slug'                => 'meta-site',
            'site_type'           => 'precinct',
            'created_by_user_id'  => $user->id,
            'modified_by_user_id' => $user->id,
        ]);

        $site->users()->attach($user->id, ['role' => 'manager']);

        return $site;
    }
}
