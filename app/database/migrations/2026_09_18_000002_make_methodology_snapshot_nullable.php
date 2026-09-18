<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * GH-527 — `samples.methodology_snapshot` can hold "not set".
 *
 * GH-520 gave the methodology one owner and no default: a site that has chosen
 * none resolves to null, and `siteConfigMethodology()` returns null rather than
 * inventing 'mlsn'. The column it is written into was declared
 * `string(32) NOT NULL default('')`, so saving a sample for such a site raises
 * an integrity violation -- an HTTP 500 on the write path.
 *
 * Latent on the dev stack, where all twelve sites carry a methodology, and
 * reachable by a user the moment one does not: create a site, import samples
 * before filling in Settings. It took thirteen red PHPUnit tests to surface,
 * and those were not run after GH-520 shipped.
 *
 * WHY NULLABLE RATHER THAN WRITING SOMETHING. The other way to stop the error
 * is to put a value there when the site has none, and the owner's rule of
 * 18.09.2026 forbids exactly that: an unset methodology stays unset, and a
 * default is the sign of data that was never entered. So the column changes,
 * not the value.
 *
 * TWO COLUMNS, ONE VALUE. `site_summaries.methodology_snapshot` is the same
 * figure copied onto the summary built from the sample
 * (`'methodology_snapshot' => $sample->methodology_snapshot`), and it was NOT
 * NULL for the same reason, so fixing only the samples table moved the same 500
 * one table along -- measured: `NOT NULL constraint failed:
 * site_summaries.methodology_snapshot`. The boundary given for this fix was
 * drawn by OWNER, not by table: the methodology belongs to the site's config,
 * and both columns hold it.
 *
 * `soil_texture_snapshot` is deliberately left alone. It exists on `samples`
 * only -- `site_summaries` has no texture column at all, measured against
 * information_schema, so the first draft of this paragraph saying "in both
 * tables" was wrong about half of what it claimed. On `samples` it stays NOT
 * NULL: it is owned by the site's own texture column, which nothing in this work
 * sets to null. The decision is unchanged; the reason for it is now what was
 * measured rather than what was assumed by symmetry with the column above.
 *
 * The `default('')` is kept as it was. It means an INSERT that omits the column
 * still gets an empty string rather than null, so the table can express absence
 * two ways. Named rather than changed: narrowing that is a separate decision
 * about existing rows, and this migration is about making the write possible.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('samples', function (Blueprint $table) {
            $table->string('methodology_snapshot', 32)->nullable()->default('')->change();
        });
        Schema::table('site_summaries', function (Blueprint $table) {
            $table->string('methodology_snapshot', 32)->nullable()->default('')->change();
        });
    }

    public function down(): void
    {
        Schema::table('samples', function (Blueprint $table) {
            $table->string('methodology_snapshot', 32)->nullable(false)->default('')->change();
        });
        Schema::table('site_summaries', function (Blueprint $table) {
            $table->string('methodology_snapshot', 32)->nullable(false)->default('')->change();
        });
    }
};
