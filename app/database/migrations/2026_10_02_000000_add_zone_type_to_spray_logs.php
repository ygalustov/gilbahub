<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * GH-806 (queue item "Zones", stage SZh1) — AN ENTRY OF THE SPRAY JOURNAL SAYS WHICH KIND OF ZONE IT IS,
 * BY THE IDENTIFIER OF THAT KIND.
 *
 * THE OWNER'S DECISION of 01.10.2026, in her words: "let us do this, within these zone works, so that
 * when we add a spray, the zone TYPE is chosen — that identifier."
 *
 * WHAT THE JOURNAL HOLDS TODAY: a WORD per entry, in `zone` (`varchar(80) NOT NULL`), chosen from a list
 * of its own — `greens`, `tees`, `fairways`, `surrounds`, `sportsground`, `other` — which is neither a
 * zone of a site nor a key of `assets/zone-types.json`. Measured on the stand, 02.10.2026: five entries,
 * four carrying `greens` and one `other`.
 *
 * WHAT THIS MIGRATION DOES, and nothing else: one nullable column, `zone_type`, holding a KEY of
 * `assets/zone-types.json`. NULL means "no type", which is a real answer for a word the dictionary
 * declares no type for (`surrounds`, `sportsground`), and the state of every row until the transfer of
 * stage SZh1 runs.
 *
 * NOTHING IS TAKEN AWAY. `zone` keeps its word, keeps being written and keeps being read: the reader
 * that decides which applications count towards a calculation still reads the word, and moving it is
 * stage SZh2, after the owner's answer about which types count for which kind of site. So this is the
 * same shape stage C0 had — the new field is written before anything reads it — and `down` drops only
 * the column it added.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('spray_logs', function (Blueprint $table) {
            // A key of `assets/zone-types.json`, or NULL for "the word has no type". 32 is the width
            // `zones.zone_type` uses for the same kind of value.
            $table->string('zone_type', 32)->nullable()->after('zone');
            $table->index(['zone_type']);
        });
    }

    public function down(): void
    {
        Schema::table('spray_logs', function (Blueprint $table) {
            $table->dropIndex(['zone_type']);
            $table->dropColumn(['zone_type']);
        });
    }
};
