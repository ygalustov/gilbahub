<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * GH-799 (queue item "Zones", stage C0) — A ZONE BECOMES A ROW, AND A SAMPLE POINTS AT IT.
 *
 * WHAT A ZONE IS TODAY AND WHY THAT IS THE DEFECT (the plan's section 1): a zone is a NAME in three
 * unrelated places — a string in `sites.attributes_json.zones`, a `_label` on a sample's payload, and a
 * word in `payload._zone` that is sometimes a type and sometimes a water source. Rename a zone and its
 * history splits in two; two samples of the same green in different spellings are two zones; a type
 * nobody entered is substituted as `other` in twenty places.
 *
 * WHAT THIS MIGRATION DOES, and nothing else: one table and two columns.
 *
 *   - `zones` — one row per zone of a site, carrying its name and its type. The type is a KEY of
 *     `assets/zone-types.json` and is NULL until somebody chooses one: the owner's decision of
 *     22.09.2026, "you can leave it empty, and I will fill them in by hand afterwards". No figure
 *     depends on it, so an empty type changes no number.
 *   - `samples.zone_id` — which zone a soil or tissue sample belongs to. NULL for a water sample, by
 *     the owner's decision of 22.09.2026 that water samples are not zones.
 *
 * AND A WATER SAMPLE KEEPS ONLY ITS NAME. The first draft of this stage added a second column for the
 * kind of source a water sample is drawn from (`bore`, `surface`), because `payload._zone` has been
 * carrying that meaning alongside its other one. The owner's decision of 01.10.2026, taken after she
 * was shown all three readers of that word — the sample list, the trend on the screen and the water
 * sparklines in the document, none of which changes a number on the stand today — is "only the name
 * remains" for water. So the column is not added, nothing is transferred into one, and `payload._zone`
 * is left exactly as it is: what becomes of it is a separate plan.
 *
 * NO DICTIONARY TABLES, and that is the analyst's decision of 01.10.2026 rather than an omission: the
 * twelve zone types and four water sources are owned by the code, nobody enters them on a screen, and
 * they live in one data file with one reader (`App\Support\ZoneTypes`). A table plus a seed would have
 * answered the same question and added two of each to this migration.
 *
 * NOTHING IS TAKEN AWAY. `attributes_json.zones`, `payload._zone` and `payload._label` all keep
 * working and keep being written; every reader of them is untouched. That is the rule this work is
 * held to — nothing starts reading a new field before something writes it, and nothing stops writing
 * an old one before its readers have moved — so stages C0 to C4 remove nothing and this migration is
 * reversible. The old fields go in stage C5.
 *
 * THE KEY OF `zones` IS A UUID, like `sites`: the id travels to the browser from stage C2, and a
 * guessable running number for a client's zone is a different kind of identifier than this product
 * hands out elsewhere.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('zones', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('site_id');

            // The name a person gave the zone: `Green 1`, `Putter Green`, `test`. Kept as entered --
            // the comparison that decides whether two names are the same zone is case-insensitive, and
            // that is the transfer's business, not this column's.
            $table->string('name', 191);

            /**
             * A key of `assets/zone-types.json`, or NULL for "nobody has said yet". NULL is the state
             * every row has after the transfer (the owner's decision above), and the column says so by
             * being nullable rather than by carrying a word that means "unknown" -- a word in a type
             * column is the substitution this whole item exists to remove.
             */
            $table->string('zone_type', 32)->nullable();

            $table->unsignedBigInteger('created_by_user_id')->default(0);
            $table->unsignedBigInteger('modified_by_user_id')->default(0);
            $table->timestamps();

            $table->foreign('site_id')->references('id')->on('sites')->cascadeOnDelete();

            /**
             * One zone per distinct name on a site. The uniqueness is on the name as stored, which
             * catches the ordinary repeat; the case-insensitive rule the transfer applies cannot be
             * expressed as an index on this MySQL without a generated column, so it lives in the one
             * writer (`ZoneService`, stage C1) and is held by its own case. Said here rather than left
             * to be discovered from the index.
             */
            $table->unique(['site_id', 'name']);
            $table->index(['site_id', 'zone_type']);
        });

        Schema::table('samples', function (Blueprint $table) {
            // Which zone this sample is of. NULL for a water sample, and NULL for any sample whose
            // name matched no zone -- the transfer prints that number rather than inventing a zone.
            $table->uuid('zone_id')->nullable()->after('site_id');

            $table->foreign('zone_id')->references('id')->on('zones')->nullOnDelete();
            $table->index(['zone_id']);
        });
    }

    public function down(): void
    {
        Schema::table('samples', function (Blueprint $table) {
            $table->dropForeign(['zone_id']);
            $table->dropIndex(['zone_id']);
            $table->dropColumn(['zone_id']);
        });
        Schema::dropIfExists('zones');
    }
};
