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

    /**
     * GH-686 — REBUILT AFTER THE REVIEWER'S M4 LEFT IT GREEN.
     *
     * The claim is that a condition on a field a column owns is answered by THE COLUMN, not by the
     * derived copy in the config. The case asserted it with a fixture in which the column and the
     * copy both held -43.5 -- so reading the wrong source gave the right answer, and the reviewer
     * replaced the column read with a copy read and the case stayed green. It measured nothing.
     *
     * WHAT MAKES IT MEASURE: the two sources DISAGREE in the fixture, and the disagreement is built
     * DIRECTLY -- the copy through the config row, the column through a query against the row --
     * never through `PATCH /sites/{id}`, which exists to keep the two in step. It is not an
     * invented state either: `deriveOwnedCopies` names pre-existing divergences in the tree
     * (`GH-474`), left for the repair team.
     *
     * AND IT ASKS IN BOTH DIRECTIONS, because one direction cannot tell the sources apart:
     *   - the STALE condition carries the COPY's value and must be refused;
     *   - the RIGHT condition carries the COLUMN's value and must go through.
     * Swap the source and each direction reddens its own assertion. Both are compared against the
     * fixture rather than against each other.
     *
     * THE TWO DIRECTIONS ARE TWO CASES, and that is not tidiness. PHPUnit abandons a method at its
     * first failed assertion, so as one method the second direction would never run under the very
     * mutation it exists to catch, and a reviewer would see one red where two were required.
     */
    public function test_a_condition_carrying_the_copys_value_is_refused_because_the_column_is_asked(): void
    {
        // The copy says one thing...
        [$user, $site] = $this->siteWith(['location' => ['lat' => -41.29, 'lon' => 172.6]]);
        // ...and the column another. Written straight at the row: the route would reconcile them.
        Site::query()->whereKey($site->id)->update(['latitude' => -43.5, 'longitude' => 172.6]);

        $this->assertDivergence($site, -43.5, -41.29, 'before the request');

        $stale = $this->patchConfig($user, $site, [
            'patch' => ['location' => ['elevation' => 12]],
            'expected' => ['location.lat' => -41.29],
        ]);
        fwrite(STDOUT, '[gh634] condition = the COPY: '.$stale->getContent().PHP_EOL);
        $stale->assertStatus(409);
        $this->assertSame(-43.5, (float) $stale->json('conflicts')['location.lat']['current'],
            'the conflict reports a value that is not the column\'s');

        // The refusal wrote nothing, and the divergence is still there. Asserted rather than
        // assumed, because "nothing was written" is half of what a 409 promises.
        $this->assertDivergence($site, -43.5, -41.29, 'after the refusal');
    }

    public function test_a_condition_carrying_the_columns_own_value_goes_through(): void
    {
        // The other direction of the same claim, on the same divergent fixture. Alone it would be
        // satisfied by a route that refuses nothing; alone the case above would be satisfied by a
        // route that refuses everything.
        [$user, $site] = $this->siteWith(['location' => ['lat' => -41.29, 'lon' => 172.6]]);
        Site::query()->whereKey($site->id)->update(['latitude' => -43.5, 'longitude' => 172.6]);

        $this->assertDivergence($site, -43.5, -41.29, 'before the request');

        $ok = $this->patchConfig($user, $site, [
            'patch' => ['location' => ['elevation' => 15]],
            'expected' => ['location.lat' => -43.5],
        ]);
        fwrite(STDOUT, '[gh634] condition = the COLUMN: '.$ok->status().' '.$ok->getContent().PHP_EOL);
        $ok->assertOk();
        $this->assertSame(15, $this->config($site)['location']['elevation'], 'the accepted write did not land');
    }

    /**
     * GH-686 — THE GAP THE RE-READ CLOSES, ON THE CONFIG ROUTE (the reviewer's M3).
     *
     * `$site->refresh()` inside `conflictingExpectations` looks like belt and braces next to the
     * refresh under the lock, and it is not: the model being compared was loaded at the START of
     * request A, by `resolveAccessibleSite`, outside any transaction. Between that load and the
     * comparison, another writer can commit. A has not taken the lock yet, so nothing makes B wait.
     *
     * HOW THE GAP IS PRODUCED: a hook on the FIRST retrieval of this site in request A -- which is
     * that load -- writes the column from underneath, by a query against the row. That is B,
     * committed before A compares anything.
     *
     * THE CONTROL IS THE POINT, and it is the reviewer's warning: `Site::retrieved` fires on every
     * retrieval, including the refresh inside the lock and the slug lookups. A hook without the
     * "once, and this site" guard fires again INSIDE the lock, and then the case measures the
     * subject of the case above instead of this one. So the transaction level at the moment it
     * fired is printed and asserted. If it is deeper, the case is INVALID -- not the code innocent.
     *
     * AND THE LEVEL IS COMPARED WITH THE BASELINE, NOT WITH ZERO. It was written as `=== 0` first,
     * from the plan, and both cases went red on their own control: `RefreshDatabase` runs every
     * test inside a transaction, so nothing in this suite is ever at level 0 and a literal zero can
     * only ever fail. Measured against the level taken before the request, the claim is the one
     * meant -- the hook ran outside any transaction THE REQUEST opened.
     *
     * THE BOUNDARY: this is not a measurement of two clients. B's write goes down the same
     * connection, so nothing here says anything about locking or commit visibility. What it does
     * say -- and all it claims -- is that the comparison reads the row again instead of trusting
     * the model loaded at the start of the request. One connection is enough to show that, because
     * the stale model is in memory either way.
     */
    public function test_the_config_route_re_reads_the_row_before_comparing_and_not_at_the_start(): void
    {
        [$user, $site] = $this->siteWith(['location' => ['lat' => -43.5, 'lon' => 172.6]]);
        Site::query()->whereKey($site->id)->update(['latitude' => -43.5, 'longitude' => 172.6]);

        // The level before the request opens anything of its own. Not zero: see the note above.
        $baseline = DB::transactionLevel();
        $fired = false;
        $levelWhenFired = null;
        Site::retrieved(function (Site $model) use (&$fired, &$levelWhenFired, $site) {
            if ($fired || $model->id !== $site->id) {
                return;
            }
            $fired = true;
            $levelWhenFired = DB::transactionLevel();
            // B commits, and it does so through the row so that nothing reconciles the copy.
            Site::query()->whereKey($site->id)->update(['latitude' => -41.29]);
        });

        // A states what it saw when its page opened.
        $response = $this->patchConfig($user, $site, [
            'patch' => ['location' => ['elevation' => 12]],
            'expected' => ['location.lat' => -43.5],
        ]);
        fwrite(STDOUT, '[gh634] B fired: '.json_encode($fired).' at transaction level '
            .json_encode($levelWhenFired).' (baseline '.json_encode($baseline).'); A got '
            .$response->status().': '.$response->getContent().PHP_EOL);

        // THE CASE IS VALID, asserted before its verdict is read.
        $this->assertTrue($fired, 'B never ran — there is no gap in this run to close');
        $this->assertSame($baseline, $levelWhenFired,
            'B ran inside a transaction the REQUEST opened, so this case measured the lock instead of the gap and is invalid');
        $this->assertSame(-41.29, (float) Site::query()->find($site->id)->latitude, "B's write did not land");

        // THE CLAIM: A compares against the row as it is NOW, not as it was when A loaded it.
        $response->assertStatus(409);
        $this->assertSame(-41.29, (float) $response->json('conflicts')['location.lat']['current'],
            'the conflict reports the value A loaded with, so the comparison used the stale model');
    }

    /**
     * GH-686 — THE SAME GAP ON THE OTHER ROUTE, and it is a second re-read, not the same one.
     *
     * `update()` compares inside its own transaction, and what it compares is the model refreshed
     * on the line after the lock is taken. The gap is identical -- between `resolveAccessibleSite`
     * and the comparison under the lock -- and it is closed by a different `refresh()`. Only both
     * cases together say the gap is closed on both roads; the config case above would stay green
     * with this route wide open.
     *
     * The third `refresh()` in this controller, the one in `ownedColumnValues`, belongs to the
     * read that feeds the derived copies and is the subject of `Gh633ConfigPatchRaceMeasureTest`.
     */
    public function test_the_site_route_re_reads_the_row_before_comparing_and_not_at_the_start(): void
    {
        [$user, $site] = $this->siteWith(['location' => ['lat' => -43.5, 'lon' => 172.6]]);
        Site::query()->whereKey($site->id)->update(['latitude' => -43.5, 'longitude' => 172.6]);

        // The level before the request opens anything of its own. Not zero: see the note above.
        $baseline = DB::transactionLevel();
        $fired = false;
        $levelWhenFired = null;
        Site::retrieved(function (Site $model) use (&$fired, &$levelWhenFired, $site) {
            if ($fired || $model->id !== $site->id) {
                return;
            }
            $fired = true;
            $levelWhenFired = DB::transactionLevel();
            Site::query()->whereKey($site->id)->update(['latitude' => -41.29]);
        });

        // A sends a coordinate of its own, so the value it writes cannot be mistaken for B's.
        $response = $this->patchSite($user, $site, [
            'latitude' => -38.0,
            'expected' => ['location.lat' => -43.5],
        ]);
        fwrite(STDOUT, '[gh634] B fired: '.json_encode($fired).' at transaction level '
            .json_encode($levelWhenFired).' (baseline '.json_encode($baseline).'); A got '
            .$response->status().': '.$response->getContent().PHP_EOL);

        $this->assertTrue($fired, 'B never ran — there is no gap in this run to close');
        $this->assertSame($baseline, $levelWhenFired,
            'B ran inside a transaction the REQUEST opened, so this case measured the lock instead of the gap and is invalid');

        $response->assertStatus(409);
        $this->assertSame(-41.29, (float) $response->json('conflicts')['location.lat']['current'],
            'the conflict reports the value A loaded with, so the comparison used the stale model');
        // And nothing of A's landed.
        $this->assertSame(-41.29, (float) Site::query()->find($site->id)->latitude,
            'A wrote its coordinate although its condition no longer held');
    }

    /**
     * The column and the copy hold different values, printed and asserted. Without this the two
     * cases above could not tell "the right source was read" from "both sources agreed".
     */
    private function assertDivergence(Site $site, float $column, float $copy, string $when): void
    {
        $actualColumn = (float) Site::query()->find($site->id)->latitude;
        $actualCopy = (float) ($this->config($site)['location']['lat'] ?? 0);
        fwrite(STDOUT, '[gh634] '.$when.': sites.latitude='.json_encode($actualColumn)
            .'  config.location.lat='.json_encode($actualCopy).PHP_EOL);
        $this->assertSame($column, $actualColumn, 'the column does not hold what this case needs '.$when);
        $this->assertSame($copy, $actualCopy, 'the copy does not hold what this case needs '.$when);
        $this->assertNotSame($actualColumn, $actualCopy, 'the two sources agree, so reading the wrong one is invisible');
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

        /**
         * GH-684 — THE STARTING CONFIG CARRIES A METHODOLOGY.
         *
         * The server refuses any write whose RESULT leaves a site without one, by the owner's
         * decision that methodology is required everywhere. These cases are about another subject
         * entirely and merely happened to start from a site that had none, so they were refused
         * before reaching it. A case that needs the absence BY SUBSTANCE passes its own `turf` and
         * expects the refusal; none of the cases in this file does.
         */
        if (! array_key_exists('turf', $config) || ! is_array($config['turf'])) {
            $config['turf'] = [];
        }
        if (! array_key_exists('methodology', $config['turf'])) {
            $config['turf']['methodology'] = 'mlsn';
        }

        SiteConfig::query()->create([
            'site_id' => $site->id,
            'namespace' => 'gaip',
            'config' => $config,
            'synced_at' => now(),
        ]);

        return [$user, $site];
    }
}
