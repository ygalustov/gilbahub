<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * WITHDRAWN BY GH-534 (18.09.2026), SEE 2026_09_18_000003. The owner reversed
 * D-3 the same day: the journals are cleared outright again, and the column
 * this migration adds is dropped by the later one. Nothing in the tree reads
 * or writes it. This file is kept only because it ran on a real database and
 * deleting it would leave that database's `migrations` row without a class.
 * Read the paragraph below as history, not as a description of the product.
 *
 * GH-526 (PLAN-samples-sync-FINAL stage 1, item 8 / decision D-3) — a Settings
 * import that clears a site stops destroying its logs outright.
 *
 * `clearSiteData` hard-deletes the site's `spray_logs` and `field_log_entries`
 * (SampleController::sync()). The owner accepted making that reversible. The
 * plan is explicit that the way written in the original -- "SoftDeletes on both
 * models" -- is not available: there are no Eloquent models for these two
 * tables at all (app/app/Models holds Account, Site, Sample, SiteSummary,
 * PrecinctGroup and the auth models), and all sixteen call sites are raw
 * `DB::table()` queries. So the column is added here and every one of those
 * queries is taught to skip deleted rows by hand.
 *
 * `field_log_entries` additionally carries unique(user_id, client_uid): a
 * soft-deleted row would block re-inserting the same client_uid, so
 * FieldLogEntryController::store() clears `deleted_at` when it finds one.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('spray_logs', function (Blueprint $table) {
            $table->timestamp('deleted_at')->nullable()->after('updated_at');
        });
        Schema::table('field_log_entries', function (Blueprint $table) {
            $table->timestamp('deleted_at')->nullable()->after('updated_at');
        });
    }

    public function down(): void
    {
        Schema::table('spray_logs', function (Blueprint $table) {
            $table->dropColumn('deleted_at');
        });
        Schema::table('field_log_entries', function (Blueprint $table) {
            $table->dropColumn('deleted_at');
        });
    }
};
