<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Add a stored generated column so we can index on DATE(predicted_at).
        DB::statement('
            ALTER TABLE predictions
            ADD COLUMN predicted_date DATE
                GENERATED ALWAYS AS (DATE(predicted_at)) STORED
        ');

        // Remove duplicates — keep only the latest id per (user, site, module, sub_key, date).
        //
        // Portability note: MySQL's multi-table `DELETE p1 FROM ... INNER
        // JOIN` syntax isn't valid SQL on SQLite (`phpunit.xml` forces
        // sqlite :memory: for the whole PHPUnit suite), which aborted this
        // migration and, with it, every Feature test using RefreshDatabase
        // -- confirmed live, unrelated to whatever change was actually being
        // tested. The MySQL branch is byte-for-byte the original statement;
        // only a portable SQLite equivalent (same semantics: keep the
        // highest id per group) was added alongside it.
        if (DB::connection()->getDriverName() === 'sqlite') {
            DB::statement('
                DELETE FROM predictions
                WHERE id NOT IN (
                    SELECT MAX(id) FROM predictions
                    GROUP BY user_id, site_identifier, module, sub_key, predicted_date
                )
            ');
        } else {
            DB::statement('
                DELETE p1 FROM predictions p1
                INNER JOIN predictions p2
                    ON  p2.user_id            = p1.user_id
                    AND p2.site_identifier    = p1.site_identifier
                    AND p2.module             = p1.module
                    AND p2.sub_key            = p1.sub_key
                    AND p2.predicted_date     = p1.predicted_date
                    AND p2.id > p1.id
            ');
        }

        Schema::table('predictions', function (Blueprint $table) {
            $table->unique(
                ['user_id', 'site_identifier', 'module', 'sub_key', 'predicted_date'],
                'predictions_unique_per_day'
            );
        });
    }

    public function down(): void
    {
        Schema::table('predictions', function (Blueprint $table) {
            $table->dropUnique('predictions_unique_per_day');
            $table->dropColumn('predicted_date');
        });
    }
};
