<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * GH-550 (stage 4) — the analysis result gets its own table.
 *
 * ACCEPTED BY THE OWNER, 22.09.2026: "I think a separate table is better."
 *
 * WHAT IT REPLACES. The result lived in `site_configs` under the namespace
 * `analysis_cache` — the SETTINGS table, one row per site, overwritten in place.
 * Three things followed from that and none of them was a decision:
 *
 *   1. A settings row carried a computed object. On the stand the twelve
 *      `analysis_cache` rows average 139 KB and reach 176 KB, against 16 KB for
 *      the `gaip` settings beside them.
 *   2. `synced_at` meant two different things depending on the namespace —
 *      "stored by the server" for settings, "when the numbers were produced" for
 *      this one — so `SiteConfigWriter::mutate` grew a parameter to override it
 *      and then a second one to hold it still.
 *   3. A run had nowhere to be. The result's own facts — which run produced it,
 *      when it started, whether the last attempt finished — had to be folded
 *      into the config blob as `last_run`, and the failure write became the one
 *      read-modify-write in a class whose rule is "whole or nothing".
 *
 * THE SHAPE, and why a row per run rather than a row per site. A completed run
 * and a failed attempt are two different facts about the same site, and the
 * screen shows both at once: these numbers, from then, and the re-run that did
 * not replace them. As one row that needed a nested object and a mutator that
 * read the current value; as rows it is two `SELECT`s and no read-modify-write
 * anywhere.
 *
 * `started_at` and `inputs` are declared and not yet written — the producer does
 * not send them (plan section 3, point 4). Nullable and named, rather than added
 * later to a table with rows in it.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('analysis_results', function (Blueprint $table) {
            $table->id();
            $table->uuid('site_id');

            // The run that produced this row. Required since GH-548: an
            // unsigned result cannot be tied to the attempt it came from.
            $table->string('run_id');

            // 'complete' — the numbers are here. 'failed' — they are not, and
            // `reason` says why. No other value is written.
            $table->string('outcome', 16);
            $table->string('reason', 64)->nullable();

            $table->timestamp('started_at')->nullable();
            $table->timestamp('completed_at')->nullable();

            // What went in, what came out. `inputs` is declared for the
            // producer that will send it; `metrics`/`computed` are null on a
            // failed run, because a failed run has no numbers.
            $table->json('inputs')->nullable();
            $table->json('metrics')->nullable();
            $table->json('computed')->nullable();

            // Whatever the failure carried beyond its code.
            $table->json('detail')->nullable();

            $table->timestamps();

            $table->foreign('site_id')->references('id')->on('sites')->cascadeOnDelete();

            // The two reads this table exists for: the latest row for a site,
            // and the latest COMPLETED row for a site.
            $table->index(['site_id', 'id']);
            $table->index(['site_id', 'outcome', 'id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('analysis_results');
    }
};
