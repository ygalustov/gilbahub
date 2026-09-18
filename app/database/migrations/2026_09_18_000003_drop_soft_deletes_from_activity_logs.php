<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * GH-534 — the journals lose their `deleted_at` column. Owner's reversal of
 * D-3, 18.09.2026: "hard for the journal only; leave the samples as they were".
 *
 * WHY THE COLUMN GOES RATHER THAN JUST THE WRITES. A soft-delete mechanism
 * nobody uses reads as one that is in force. Leaving the column would mean a
 * future query on either table has a `deleted_at` to be unsure about, and the
 * next person to read `SprayLogController` has to determine by inspection
 * whether rows can be hidden. They cannot. The column says so.
 *
 * WHAT IS NOT TOUCHED, and the distinction is the owner's: `samples` and
 * `site_summaries` keep their soft delete, which has stood since April.
 * Measured on the dev stack before this ran -- 88 of 148 sample rows are
 * soft-deleted and exist only because of it. A lab result cannot be taken
 * again; a spray log or a field note is a record of something the user did and
 * can be entered again.
 *
 * SAFE TO RUN, measured rather than assumed. Immediately before this migration
 * was written: `spray_logs` 3 rows, 0 with `deleted_at` set;
 * `field_log_entries` 0 rows. Nothing is being dropped along with the column.
 * A deployment where that is NOT true loses those rows' hidden state, which is
 * the point of the reversal rather than a side effect of it.
 *
 * The migration that added the column (2026_09_18_000001) is kept rather than
 * deleted: it ran on a real database, and removing the file would leave that
 * database's `migrations` row pointing at a class that does not exist. Its
 * docblock names this migration so a reader meeting the addition first is not
 * left thinking the mechanism is live.
 */
return new class extends Migration
{
    public function up(): void
    {
        foreach (['spray_logs', 'field_log_entries'] as $table) {
            // Guarded: on a database built after the addition was withdrawn
            // there is no column to drop, and a migration that throws there
            // would make a fresh install impossible.
            if (Schema::hasColumn($table, 'deleted_at')) {
                Schema::table($table, function (Blueprint $t) {
                    $t->dropColumn('deleted_at');
                });
            }
        }
    }

    public function down(): void
    {
        foreach (['spray_logs', 'field_log_entries'] as $table) {
            if (! Schema::hasColumn($table, 'deleted_at')) {
                Schema::table($table, function (Blueprint $t) {
                    $t->timestamp('deleted_at')->nullable()->after('updated_at');
                });
            }
        }
    }
};
