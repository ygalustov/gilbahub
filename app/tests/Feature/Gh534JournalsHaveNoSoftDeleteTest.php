<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

/**
 * GH-534 — the journals have no soft deletion, and here is the run that shows
 * it rather than the sentence that says it.
 *
 * WHY THIS FILE EXISTS, AND WHY IT IS ONLY TWO TESTS. The coordinator decided
 * the rollback needs no guard of its own, on the reading that the missing
 * column IS the mechanism: a `whereNull('deleted_at')` on a table without the
 * column does not pass quietly, it fails, so soft deletion cannot come back
 * here unnoticed. She asked for that to be SHOWN rather than stated — one run,
 * with the error text. This file is that run, in the form the project asks
 * for: a test rather than a scratch script, so it is repeatable and travels
 * with the code.
 *
 * A census of the tree was written to go with it and WITHDRAWN on her
 * instruction; a copy is in the delivery notes rather than in the tree.
 *
 * WHAT THE RUN FOUND, and it does not say what it was expected to say. The
 * reading holds on MySQL and NOT on the engine this suite uses. The second
 * test carries both numbers and the consequence.
 *
 * Owner's decision of 18.09.2026: "hard for the journal only; leave the
 * samples as they were."
 */
class Gh534JournalsHaveNoSoftDeleteTest extends TestCase
{
    use RefreshDatabase;

    private const JOURNALS = ['spray_logs', 'field_log_entries'];

    /** Tables that KEEP their soft delete, so this guard is about two tables and not about the idea. */
    private const SOFT_ON_PURPOSE = ['samples', 'site_summaries'];

    public function test_neither_journal_table_has_a_deleted_at_column(): void
    {
        foreach (self::JOURNALS as $table) {
            $this->assertTrue(Schema::hasTable($table), $table.' is missing entirely');
            $this->assertFalse(
                Schema::hasColumn($table, 'deleted_at'),
                $table.' still carries `deleted_at`. GH-534 removed soft deletion from the journals; '
                .'a column left behind reads as a mechanism in force, and the next query written '
                .'against it will work.'
            );
        }
    }

    /**
     * The coordinator's argument, turned into a measurement — and the
     * measurement came out the other way.
     *
     * THE ARGUMENT: "you cannot write whereNull('deleted_at') on a column that
     * does not exist — the query will fail", so the absent column is itself
     * the guard and nothing further is needed.
     *
     * WHAT WAS MEASURED, on both engines, 18.09.2026:
     *
     *   MySQL (the stand, and production):
     *     select id from spray_logs where deleted_at is null limit 1
     *     -> ERROR 1054 (42S22) Unknown column 'deleted_at' in 'where clause'
     *     Same for field_log_entries. The same query against `samples`, where
     *     the column exists, returns a row — so it is the column that is
     *     missing and not the statement that is malformed.
     *
     *   SQLite (this suite, in memory; the schema is built by the same
     *   migrations and `Schema::hasColumn` answers false on both tables):
     *     select count(*) from "spray_logs" where "deleted_at" is null
     *     -> 0. No error. Taken from the connection's own query log, so the
     *     statement was sent and answered rather than never reaching the
     *     engine.
     *
     * The difference is SQLite's double-quoted-identifier rule: a quoted name
     * that resolves to no column is taken as a STRING LITERAL, and the string
     * 'deleted_at' is never null, so the condition matches nothing. Laravel's
     * query builder always quotes identifiers, so this is the form the product
     * would produce. The same query written bare does throw — measured — but
     * nothing in the product writes it bare.
     *
     * WHAT THAT DOES AND DOES NOT MEAN. An earlier version of this paragraph
     * said a soft-delete condition re-introduced on a journal "would come back
     * green from this suite". That was a conclusion drawn from the engine
     * difference, and nobody put a condition back to see. The reviewer did,
     * and it is false: the suite does not catch the QUERY, it catches the
     * EMPTY LIST the query produces, because the tests assert that rows are
     * there.
     *
     * Measured here, one read point at a time, condition restored and
     * SiteApiTest run:
     *
     *   SprayLogController::buildFilteredQuery()      -> 2 red
     *   SprayLogController, the batch fetch by ids    -> 1 red
     *   SprayLogController::resolveOwnedLog()         -> 1 red
     *   FieldLogEntryController::index()              -> 1 red
     *   SprayLogController::update(), the re-read     -> 0 red  <- SILENT
     *
     * So four of the five read points this rollback touched are covered by
     * assertions that already existed, and one is not: the re-read after an
     * update, whose result no test looks at. On MySQL that point would answer
     * 1054; here the update would save and the response would then be a 404
     * from `firstOrFail()` on an empty result — visible to a user, invisible
     * to this suite.
     *
     * THE BOUNDARY, and it is the reviewer's own: he did not walk every read
     * point in the application and does not claim to. The five above are the
     * ones GH-534 changed. What is established is the shape — an uncovered
     * read point stays silent — not a count of them.
     *
     * A census of the tree was written to close that gap and WITHDRAWN on the
     * coordinator's instruction; a copy is in the delivery notes rather than
     * in the tree. It is named here as a thing that does not exist, because a
     * docblock that points at a guard nobody can find is worse than one that
     * points at nothing.
     *
     * This test asserts the dangerous property rather than the safe one. If it
     * ever goes red — SQLite changing its rule, or this suite moving to MySQL —
     * that is good news: read this docblock then, do not delete it.
     */
    public function test_the_missing_column_is_silent_on_this_suites_engine(): void
    {
        $driver = DB::connection()->getDriverName();
        fwrite(STDOUT, "\n[gh534] test-suite driver: ".$driver."\n");

        $threw = false;
        $count = null;
        try {
            $count = DB::table('spray_logs')->whereNull('deleted_at')->count();
        } catch (\Throwable $e) {
            $threw = true;
            fwrite(STDOUT, '[gh534] it threw: '.$e->getMessage()."\n");
        }

        if ($driver === 'sqlite') {
            $this->assertFalse($threw,
                'SQLite now REFUSES a quoted unknown column. That is better than what was measured on '
                .'18.09.2026, and it means the missing column has become a real guard in this suite too. '
                .'Read this docblock: the uncovered-read-point gap it describes has closed.');
            $this->assertSame(0, $count,
                'the condition matched something, which means the column is back');
            fwrite(STDOUT, "[gh534] measured: no error, count = 0 — silent, as recorded\n");
        } else {
            $this->assertTrue($threw,
                'this engine answered an unknown column with an empty result rather than an error. '
                .'Four of the five journal read points are covered by SiteApiTest asserting their rows '
                .'are there; the re-read in SprayLogController::update() is not, and would go quiet. '
                .'There is no census in this file — it was written and withdrawn, and a copy is in the '
                .'GH-534 delivery notes.');
        }
    }
}
