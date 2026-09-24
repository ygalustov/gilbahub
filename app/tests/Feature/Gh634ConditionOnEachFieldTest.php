<?php

namespace Tests\Feature;

use App\Models\Account;
use App\Models\Site;
use App\Models\SiteConfig;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

/**
 * GH-634 — STAGE 2 OF `PLAN-config-patch-race-RU.md`: THE SERVER SIDE OF THE
 * CONDITION ON EACH FIELD, AND ONE DOOR FOR THE SITE ROW AND ITS COPIES.
 *
 * WHAT STAGE 1 MEASURED (`Gh633ConfigPatchRaceMeasureTest`), and what this is
 * built against: a tab saving its whole section put back a field another tab
 * had changed, both requests answering 200; and a second writer landing between
 * the read of the owning column and the write of its config copy left
 * `sites.latitude` at -36.85 with `config.location.lat` at -41.29.
 *
 * WHAT IS BUILT HERE. A writer may state the value it SAW, per field:
 * `expected: {"turf.construction": "sand_profile"}`. The comparison happens
 * inside the same row lock that does the writing; on a disagreement nothing is
 * written and the answer is 409 naming the fields and their current values.
 * Fields whose owner is a column are compared against the COLUMN. The site row
 * is written in one transaction with its copies, locked FIRST — the single lock
 * order shared by both routes.
 *
 * WHAT IS NOT BUILT, AND IT IS A BOUNDARY RATHER THAN AN OMISSION.
 *  - The plan's point 2.6, "a change without a condition is 422", is NOT
 *    switched on. Every writer in the tree sends no `expected` today, so
 *    turning it on before stage 3 would stop every save in the product. It
 *    belongs at the END of stage 3, when the writers have been moved over, and
 *    a case below states today's behaviour so the day it changes is visible.
 *  - No new text reaches the person. 409 and 422 are codes; what a screen says
 *    about them is the owner's, and stage 6 of the plan.
 */
class Gh634ConditionOnEachFieldTest extends TestCase
{
    use RefreshDatabase;

    // ── half one: the config route ──────────────────────────────────────────

    public function test_a_condition_that_still_holds_lets_the_write_through(): void
    {
        [$user, $site] = $this->siteWith(['turf' => ['species' => 'Ryegrass', 'construction' => 'sand_profile']]);

        $this->patchConfig($user, $site, [
            'patch' => ['turf' => ['hoc' => 12]],
            'expected' => ['turf.construction' => 'sand_profile'],
        ])->assertOk();

        $this->assertSame(12, $this->config($site)['turf']['hoc']);
    }

    public function test_a_field_changed_after_the_page_opened_is_a_conflict_and_nothing_is_written(): void
    {
        [$user, $site] = $this->siteWith(['turf' => ['species' => 'Ryegrass', 'construction' => 'sand_profile', 'hoc' => 25]]);

        // B changes the field after A's page loaded.
        $this->patchConfig($user, $site, ['patch' => ['turf' => ['construction' => 'native_soil']]])->assertOk();

        $response = $this->patchConfig($user, $site, [
            'patch' => ['turf' => ['hoc' => 12, 'construction' => 'sand_profile']],
            'expected' => ['turf.construction' => 'sand_profile'],
        ]);
        fwrite(STDOUT, PHP_EOL.'[gh634] conflict body: '.$response->getContent().PHP_EOL);

        $response->assertStatus(409);
        $conflicts = $response->json('conflicts');
        $this->assertSame(['turf.construction'], array_keys($conflicts));
        $this->assertSame('sand_profile', $conflicts['turf.construction']['expected']);
        $this->assertSame('native_soil', $conflicts['turf.construction']['current']);

        // NOTHING was written: B's change stands and A's own edit did not land
        // either. All or nothing — writing the non-conflicting half would leave
        // a state nobody chose, and which half to write is the owner's decision,
        // recorded in the plan as its own stage.
        $after = $this->config($site)['turf'];
        $this->assertSame('native_soil', $after['construction']);
        $this->assertSame(25, $after['hoc']);
    }

    public function test_the_loss_stage_1_measured_does_not_happen_when_the_writer_states_what_it_saw(): void
    {
        // The same sequence as `Gh633ConfigPatchRaceMeasureTest` case 1, with
        // the condition added. That test stays as the record of today's
        // behaviour for a writer that sends none.
        [$user, $site] = $this->siteWith(['turf' => [
            'species' => 'Ryegrass', 'methodology' => 'slan', 'turfType' => 'sports',
            'construction' => 'sand_profile', 'hoc' => 25,
        ]]);

        $seenByA = $this->config($site)['turf'];
        $this->patchConfig($user, $site, ['patch' => ['turf' => ['construction' => 'native_soil']]])->assertOk();

        $sentByA = $seenByA;
        $sentByA['hoc'] = 12;
        $expected = [];
        foreach ($seenByA as $field => $value) {
            $expected['turf.'.$field] = $value;
        }
        $this->patchConfig($user, $site, ['patch' => ['turf' => $sentByA], 'expected' => $expected])
            ->assertStatus(409);

        $this->assertSame('native_soil', $this->config($site)['turf']['construction'], "B's change was undone anyway");
    }

    public function test_a_condition_on_a_field_a_column_owns_is_compared_against_the_column(): void
    {
        // The copy in the config is derived; asking it whether the owner moved
        // would be asking the copy about the owner.
        [$user, $site] = $this->siteWith(['location' => ['lat' => -43.5, 'lon' => 172.6]]);
        $this->patchSite($user, $site, ['latitude' => -43.5, 'longitude' => 172.6])->assertOk();

        $ok = $this->patchConfig($user, $site, [
            'patch' => ['location' => ['elevation' => 12]],
            'expected' => ['location.lat' => -43.5],
        ]);
        $ok->assertOk();

        $stale = $this->patchConfig($user, $site, [
            'patch' => ['location' => ['elevation' => 15]],
            'expected' => ['location.lat' => -36.85],
        ]);
        fwrite(STDOUT, '[gh634] owned-field conflict: '.$stale->getContent().PHP_EOL);
        $stale->assertStatus(409);
        $this->assertSame(-43.5, (float) $stale->json('conflicts')['location.lat']['current']);
    }

    public function test_TODAY_a_patch_with_no_condition_is_still_accepted__this_case_marks_the_boundary(): void
    {
        // Plan point 2.6 says a change without a condition must be 422. It is
        // deliberately NOT switched on: every writer in the tree sends none, so
        // it would stop every save in the product before stage 3 moves them
        // over. THIS CASE MUST GO RED the day it is switched on, which is how
        // the boundary stays visible instead of being remembered.
        [$user, $site] = $this->siteWith(['turf' => ['species' => 'Ryegrass']]);

        $this->patchConfig($user, $site, ['patch' => ['turf' => ['hoc' => 9]]])->assertOk();
        $this->assertSame(9, $this->config($site)['turf']['hoc']);
    }

    // ── half two: the site row ──────────────────────────────────────────────

    public function test_a_stale_condition_on_an_owned_column_is_a_conflict_and_the_row_is_untouched(): void
    {
        [$user, $site] = $this->siteWith(['location' => []]);
        $this->patchSite($user, $site, ['latitude' => -43.5, 'longitude' => 172.6])->assertOk();

        $response = $this->patchSite($user, $site, [
            'latitude' => -41.29,
            'expected' => ['location.lat' => -36.85],
        ]);
        fwrite(STDOUT, '[gh634] site-row conflict: '.$response->getContent().PHP_EOL);

        $response->assertStatus(409);
        $this->assertSame(-43.5, (float) $response->json('conflicts')['location.lat']['current']);
        $this->assertSame(-43.5, (float) Site::query()->find($site->id)->latitude, 'the row was written anyway');
    }

    public function test_the_site_row_and_its_copies_are_written_in_one_transaction_with_the_row_read_first(): void
    {
        // WHAT THIS CAN AND CANNOT SEE, said rather than assumed: PHPUnit runs
        // on SQLite here, which has no `SELECT ... FOR UPDATE`, so the lock
        // itself leaves no trace in the SQL. What the query log DOES show is
        // the ORDER and the transaction depth, and those are the two things
        // stage 1 measured wrong: the read that fed the copies happened before
        // the config row was taken, and the write of the row was in no
        // transaction at all. The `lockForUpdate()` calls themselves are
        // asserted structurally in the case below.
        [$user, $site] = $this->siteWith(['location' => []]);

        $seen = [];
        DB::listen(function ($query) use (&$seen) {
            $seen[] = ['sql' => $query->sql, 'depth' => DB::transactionLevel()];
        });

        $this->patchSite($user, $site, ['latitude' => -41.29, 'longitude' => 174.78])->assertOk();

        $writeRow = $this->firstMatch($seen, fn ($q) => str_starts_with($q, 'update "sites"'));
        $readConfig = $this->firstMatch($seen, fn ($q) => str_contains($q, 'from "site_configs"'), $writeRow);
        $readRowForCopies = $this->firstMatch($seen, fn ($q) => str_contains($q, 'from "sites"'), $readConfig);
        $writeConfig = $this->firstMatch($seen, fn ($q) => str_starts_with($q, 'update "site_configs"')
            || str_starts_with($q, 'insert into "site_configs"'));

        fwrite(STDOUT, '[gh634] update sites @'.$writeRow.'  read config @'.$readConfig
            .'  read of the row for the copies @'.$readRowForCopies.'  write config @'.$writeConfig.PHP_EOL);

        // Positive control: all four happened, or the order below is an order
        // between things that did not occur.
        $this->assertGreaterThan(-1, $writeRow, 'the row was never written');
        $this->assertGreaterThan(-1, $readConfig, 'the config row was never taken');
        $this->assertGreaterThan(-1, $readRowForCopies, 'the copies were derived from no read at all');
        $this->assertGreaterThan(-1, $writeConfig, 'no copy was written');

        // The values for the copies are read INSIDE the config row's own
        // read-modify-write, not before it. The gap stage 1 measured was
        // exactly between that read and this write.
        $this->assertGreaterThan($readConfig, $readRowForCopies, 'the copies were derived from a read taken before the config row');
        $this->assertGreaterThan($readRowForCopies, $writeConfig);

        // And the row and its copies are in ONE transaction: both writes are at
        // a depth greater than zero.
        $this->assertGreaterThan(0, $seen[$writeRow]['depth'], 'the site row was written outside a transaction');
        $this->assertGreaterThan(0, $seen[$writeConfig]['depth'], 'the config was written outside a transaction');
    }

    public function test_both_routes_take_the_site_row_under_a_lock_before_the_config_row(): void
    {
        // The structural half of the claim above, because SQLite cannot show a
        // lock. Anchored on the two places that take it, with the window
        // asserted to hold its subject first.
        $src = file_get_contents(app_path('Http/Controllers/SiteController.php'));

        $update = substr($src, strpos($src, 'ONE DOOR FOR THE ROW AND ITS COPIES'), 1600);
        $this->assertStringContainsString('$site->update($data);', $update, 'the window lost its subject');
        $this->assertStringContainsString('lockForUpdate()', $update);
        $this->assertStringContainsString('DB::transaction(', $update);

        $config = substr($src, strpos($src, 'ONE LOCK ORDER ON EVERY PATH'), 700);
        $this->assertStringContainsString('touchesOwnedColumn(', $config, 'the window lost its subject');
        $this->assertStringContainsString('lockForUpdate()', $config);
    }

    public function test_the_config_route_takes_the_site_row_first_when_the_patch_touches_an_owned_field(): void
    {
        [$user, $site] = $this->siteWith(['location' => []]);

        $seen = [];
        DB::listen(function ($query) use (&$seen) {
            $seen[] = ['sql' => $query->sql, 'depth' => DB::transactionLevel()];
        });

        $this->patchConfig($user, $site, ['patch' => ['location' => ['lat' => -41.29, 'name' => 'Wellington']]])->assertOk();

        $writeConfig = $this->firstMatch($seen, fn ($q) => str_starts_with($q, 'update "site_configs"')
            || str_starts_with($q, 'insert into "site_configs"'));
        // NOT just "a read of sites": every request begins with
        // `resolveAccessibleSite`, whose read is `("id" = ? or "slug" = ?) and
        // exists (...)`, and it comes first whatever this route does. Counting
        // it as the lock made this case pass with the lock removed — the very
        // blindness the reviewer found in the Settings guard an hour ago. The
        // subject is the bare read of the row by id.
        // Three reads of `sites` precede anything this route does, and none of
        // them is the lock: the access check (`("id" = ? or "slug" = ?) and
        // exists (...)`), the pivot load (`site_user`), and only then the bare
        // read by id. Counting either of the first two made this case pass with
        // the lock removed — the blindness the reviewer found in the Settings
        // guard, in my own test an hour later.
        $isBareRowRead = fn ($q) => str_contains($q, 'from "sites"')
            && ! str_contains($q, '"slug"') && ! str_contains($q, 'exists')
            && ! str_contains($q, 'site_user');
        $takeRow = $this->firstMatch($seen, $isBareRowRead);
        $takeConfig = $this->firstMatch($seen, fn ($q) => str_contains($q, 'from "site_configs"'));

        fwrite(STDOUT, '[gh634] config route: row @'.$takeRow.'  config @'.$takeConfig.'  write @'.$writeConfig.PHP_EOL);

        $this->assertGreaterThan(-1, $takeRow, 'this route never takes the site row, which is the deadlock order');
        $this->assertGreaterThan(-1, $takeConfig);
        $this->assertLessThan($takeConfig, $takeRow, 'the config row was taken before the site row');
        $this->assertGreaterThan(0, $seen[$writeConfig]['depth']);
    }

    public function test_what_decides_whether_the_site_row_is_taken_is_the_owners_table(): void
    {
        // The other side of the claim above: the extra lock is taken because
        // the write reaches a column, not on every config patch. The decision
        // itself is executed — SQLite shows no lock in the SQL, so asserting it
        // through the query log would be asserting something the log cannot
        // say. `FieldOwners::OWNERS` is what answers, and no second list of
        // "which fields are columns" exists to drift from it.
        $decide = new \ReflectionMethod(\App\Http\Controllers\SiteController::class, 'touchesOwnedColumn');
        $decide->setAccessible(true);
        $controller = new \App\Http\Controllers\SiteController;

        $this->assertTrue($decide->invoke($controller, ['location' => ['lat' => -41.29]], []),
            'a patch that moves the site does not take the row');
        $this->assertTrue($decide->invoke($controller, ['location' => ['name' => 'Wellington']], []));
        $this->assertTrue($decide->invoke($controller, [], ['location.name']),
            'emptying an owned field reaches the column too, so the row is taken');

        $this->assertFalse($decide->invoke($controller, ['turf' => ['hoc' => 11]], []),
            'a turf-only patch takes a lock it does not need');
        $this->assertFalse($decide->invoke($controller, ['location' => ['elevation' => 12]], []),
            'elevation has no column — the config owns it');
        $this->assertFalse($decide->invoke($controller, [], ['turf.variety']));
    }

    /** @param array<int, array{sql: string, depth: int}> $seen */
    private function firstMatch(array $seen, callable $predicate, int $after = -1): int
    {
        foreach ($seen as $i => $query) {
            if ($i <= $after) {
                continue;
            }
            if ($predicate($query['sql'])) {
                return $i;
            }
        }

        return -1;
    }

    private function patchSite(User $user, Site $site, array $body)
    {
        return $this->actingAs($user)
            ->withSession(['_token' => 'test-token'])
            ->patchJson('/api/sites/'.$site->id, array_merge(['_token' => 'test-token'], $body));
    }

    private function patchConfig(User $user, Site $site, array $body)
    {
        return $this->actingAs($user)
            ->withSession(['_token' => 'test-token'])
            ->patchJson('/api/sites/'.$site->id.'/config/gaip', array_merge(['_token' => 'test-token'], $body));
    }

    private function config(Site $site): array
    {
        return SiteConfig::query()->where('site_id', $site->id)->where('namespace', 'gaip')->first()->config;
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
            'account_id' => $account->id,
            'name' => 'Condition site',
            'slug' => 'condition-site-'.substr((string) $user->id, -4),
            'site_type' => 'sports',
            'created_by_user_id' => $user->id,
            'modified_by_user_id' => $user->id,
        ]);
        $site->users()->attach($user->id, ['role' => 'manager']);

        SiteConfig::query()->create([
            'site_id' => $site->id,
            'namespace' => 'gaip',
            'config' => $config,
            'synced_at' => now(),
        ]);

        return [$user, $site];
    }
}
