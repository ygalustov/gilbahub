<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * GH-526 (PLAN-samples-sync-FINAL stage 1, item 4) — who deleted a sample, and
 * from where.
 *
 * A sample is soft-deleted today and the row says only that it happened. The
 * plan's stage 1 gives deletion one route and one controller method, and the
 * same change records the two facts nobody could answer afterwards: which user,
 * and through which surface -- the hub, the Data page, or an import that
 * cleared the site. 87 of the 147 rows on the dev stack already carry
 * `deleted_at`, 66 of them written within one second, and there is no way to
 * tell now what did that.
 *
 * Nullable both: every existing row predates the attribution, and a row deleted
 * by a path that does not set it is honestly blank rather than wrongly
 * attributed.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('samples', function (Blueprint $table) {
            $table->unsignedBigInteger('deleted_by_user_id')->nullable()->after('deleted_at');
            $table->string('delete_source', 32)->nullable()->after('deleted_by_user_id');
        });
    }

    public function down(): void
    {
        Schema::table('samples', function (Blueprint $table) {
            $table->dropColumn(['deleted_by_user_id', 'delete_source']);
        });
    }
};
