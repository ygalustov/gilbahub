<?php

namespace Tests\Feature;

use App\Models\Account;
use App\Models\Site;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

/**
 * GH-565 — a rank for a role nobody can hold.
 *
 * `UsersController` ranked site roles twice, and both copies read
 * `['viewer' => 1, 'editor' => 2, 'manager' => 3, 'owner' => 4]`. The `owner`
 * role has not existed since `2026_06_04_000000_add_rbac_and_auth_tables`
 * rewrote every such row to `manager`, and neither path that assigns a role can
 * produce another — `Rule::in(['manager', 'editor', 'viewer'])` here and in
 * `InvitationController`.
 *
 * WHY IT MATTERED RATHER THAN BEING TIDY. A leftover row saying `owner` scored
 * 4, which is above every rank anybody can actually hold, so that member could
 * be removed by nobody: a manager looking at the list saw a person they were
 * responsible for and no way to act, with nothing on the screen to say why.
 * There is such a row on the stand today.
 *
 * AND THERE WAS NO TEST ON THIS CONTROLLER AT ALL, which is the other half of
 * why a rank could sit there for months meaning something nobody intended.
 */
class Gh565RoleLevelsTest extends TestCase
{
    use RefreshDatabase;

    public function test_a_member_whose_role_is_not_a_known_one_ranks_at_zero(): void
    {
        // The case the brief asks for, and the one the stand needs: a row left
        // over from before the role was withdrawn. It is written straight to the
        // pivot, because no route can produce it — which is exactly why it can
        // only be a leftover.
        [$manager, $site] = $this->siteWithManager();
        $legacy = $this->member($site, 'owner');

        $rows = $this->actingAs($manager)->getJson('/api/users')->assertOk()->json();
        $row  = $this->rowFor($rows, $legacy->id);

        $this->assertSame('owner', $row['role'], 'the row is still what it was — nothing rewrote it');
        $this->assertTrue($row['can_remove'],
            'a withdrawn role still outranks the manager responsible for the site');
    }

    public function test_the_known_roles_still_rank_as_they_did(): void
    {
        // The control. Without it, "the unknown role ranks 0" is satisfied by a
        // table where everything ranks 0 and a manager can remove anybody.
        [$manager, $site] = $this->siteWithManager();
        $viewer = $this->member($site, 'viewer');
        $editor = $this->member($site, 'editor');
        $peer   = $this->member($site, 'manager');

        $rows = $this->actingAs($manager)->getJson('/api/users')->assertOk()->json();

        $this->assertTrue($this->rowFor($rows, $viewer->id)['can_remove']);
        $this->assertTrue($this->rowFor($rows, $editor->id)['can_remove']);
        // Equal rank is not higher rank: a manager may not remove a manager.
        $this->assertFalse($this->rowFor($rows, $peer->id)['can_remove']);
    }

    public function test_the_role_cannot_be_assigned_by_either_path(): void
    {
        // The half that makes the rank's removal safe rather than merely tidy:
        // nothing can create a new row with it.
        [$manager, $site] = $this->siteWithManager();
        $viewer = $this->member($site, 'viewer');

        $this->actingAs($manager)
            ->patchJson('/api/users/'.$viewer->id.'/role', ['site_id' => $site->id, 'role' => 'owner'])
            ->assertStatus(422);

        $this->assertSame('viewer', DB::table('site_user')
            ->where('user_id', $viewer->id)->where('site_id', $site->id)->value('role'));
    }

    public function test_removing_a_member_with_a_withdrawn_role_is_allowed_and_removing_a_peer_is_not(): void
    {
        // The second copy of the table, in `removeSite`, reached through the
        // route rather than read — the two copies could disagree and only one
        // of them decides whether the delete goes through.
        [$manager, $site] = $this->siteWithManager();
        $legacy = $this->member($site, 'owner');
        $peer   = $this->member($site, 'manager');

        $this->actingAs($manager)
            ->deleteJson('/api/users/'.$legacy->id.'/site/'.$site->id)
            ->assertOk();
        $this->assertNull(DB::table('site_user')
            ->where('user_id', $legacy->id)->where('site_id', $site->id)->value('role'));

        $this->actingAs($manager)
            ->deleteJson('/api/users/'.$peer->id.'/site/'.$site->id)
            ->assertStatus(403);
        $this->assertSame('manager', DB::table('site_user')
            ->where('user_id', $peer->id)->where('site_id', $site->id)->value('role'));
    }

    /**
     * GH-567 (reviewer's finding on GH-565) — THE OTHER SIDE OF THE SAME
     * COMPARISON.
     *
     * The cases above pin the TARGET's level when a role is not in the table.
     * The ACTOR's level is read by the same `?? 0` in three places and was
     * pinned nowhere, so the two halves of one comparison had one test between
     * them.
     *
     * What an actor with a withdrawn role may do: nothing. Asserted on all
     * three routes, because "cannot remove anybody" is a statement about the
     * controller and not about one handler.
     *
     * WHAT THE RECOMMENDED MUTATION DOES, measured rather than assumed: `?? 4`
     * on the actor's level — at either reader — leaves this case GREEN, and that
     * is a fact about the controller rather than a hole in the test. The branch
     * is not reached: the list filters the actor's sites to `manager`, and the
     * removal and the grant both refuse on `canManageSite` before any ranking
     * happens. A test cannot kill a mutation in a branch nothing enters without
     * faking the state that would enter it, and a faked state proves nothing
     * about the product.
     *
     * WHAT IT DOES GUARD, also measured, by taking the barriers away one at a
     * time:
     *   - widen the list's filter to admit the withdrawn role  -> this case RED;
     *   - drop `canManageSite` from the removal                -> still green,
     *     because the ranking then refuses on its own: an unknown role is 0 and
     *     0 is not above a viewer's 1. The two protections are independent, and
     *     that is worth knowing;
     *   - drop it AND give the withdrawn role its rank back    -> this case RED,
     *     together with three others. That is the pair that actually lets an
     *     `owner` row act, and it is the pair this case exists for.
     */
    public function test_an_actor_whose_role_is_not_a_known_one_can_remove_nobody(): void
    {
        [$manager, $site] = $this->siteWithManager();
        $legacyActor = $this->member($site, 'owner');
        $viewer      = $this->member($site, 'viewer');

        // The list: refused outright, so there is no row to act from.
        $this->actingAs($legacyActor)->getJson('/api/users')->assertStatus(403);

        // The removal, and the grant, each refused on their own.
        $this->actingAs($legacyActor)
            ->deleteJson('/api/users/'.$viewer->id.'/site/'.$site->id)
            ->assertStatus(403);
        $this->actingAs($legacyActor)
            ->patchJson('/api/users/'.$viewer->id.'/role', ['site_id' => $site->id, 'role' => 'viewer'])
            ->assertStatus(403);

        // And nothing moved.
        $this->assertSame('viewer', DB::table('site_user')
            ->where('user_id', $viewer->id)->where('site_id', $site->id)->value('role'));

        // The control, in the same case so the two cannot drift: a manager on
        // the same site does all three. Without it, three 403s are satisfied by
        // a controller that refuses everybody.
        $this->actingAs($manager)->getJson('/api/users')->assertOk();
        $this->actingAs($manager)
            ->patchJson('/api/users/'.$viewer->id.'/role', ['site_id' => $site->id, 'role' => 'editor'])
            ->assertOk();
        $this->actingAs($manager)
            ->deleteJson('/api/users/'.$viewer->id.'/site/'.$site->id)
            ->assertOk();
    }

    public function test_the_rank_table_is_written_once(): void
    {
        // It was written out twice and the copies drifted apart by one entry.
        // A second literal is how that happens again.
        $src = file_get_contents(app_path('Http/Controllers/UsersController.php'));
        $code = preg_replace(['#/\*[\s\S]*?\*/#', '#^\s*//.*$#m'], '', $src);

        $this->assertStringNotContainsString("'owner' => 4", $code);
        $this->assertSame(1, substr_count($code, "'viewer' => 1, 'editor' => 2, 'manager' => 3"),
            'the rank table appears more than once');
        // Three readers, one table. The third — `assertCanGrantRole` — is how
        // the drift is visible at all: it had already lost `owner` while the
        // other two still carried it, so the same question had two answers
        // depending on which method asked it.
        $this->assertSame(3, substr_count($code, 'self::ROLE_LEVELS'));
    }

    /** @return array{0: User, 1: Site} */
    private function siteWithManager(): array
    {
        $user = User::factory()->create(['status' => 'active']);
        $account = Account::query()->firstOrCreate(
            ['owner_user_id' => $user->id],
            ['display_name' => $user->name, 'created_by_user_id' => $user->id, 'modified_by_user_id' => $user->id]
        );
        $site = Site::query()->create([
            'account_id' => $account->id, 'name' => 'Owner Site', 'slug' => 'owner-site',
            'site_type' => 'precinct', 'timezone' => 'UTC',
            'created_by_user_id' => $user->id, 'modified_by_user_id' => $user->id,
        ]);
        $site->users()->attach($user->id, ['role' => 'manager']);

        return [$user, $site];
    }

    private function member(Site $site, string $role): User
    {
        $u = User::factory()->create(['status' => 'active']);
        $site->users()->attach($u->id, ['role' => $role]);

        return $u;
    }

    /** @param array<string,mixed> $payload */
    private function rowFor(array $payload, int $userId): array
    {
        $members = $payload['members'] ?? $payload['data']['members'] ?? $payload;
        foreach ($members as $m) {
            if ((int) ($m['id'] ?? 0) === $userId) {
                return $m;
            }
        }
        $this->fail('user '.$userId.' is not in the list: '.json_encode($payload));
    }
}
