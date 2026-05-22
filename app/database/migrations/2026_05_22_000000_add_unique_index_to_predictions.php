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
