<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * GH-550 (stage 4) — move the existing results across, then stop the
 * settings table from carrying them.
 *
 * WHAT MOVES, row for row. Every `site_configs` row with namespace
 * `analysis_cache` becomes one `analysis_results` row with
 * `outcome = 'complete'` and `completed_at = synced_at`, keeping its `metrics`
 * and `computed` exactly as they are. Twelve rows on the stand, measured
 * 22.09.2026; the count is not assumed here — whatever is there moves.
 *
 * `run_id` is the one field these rows cannot supply: they were written before
 * a result was signed by its run (GH-548). They get `migrated-<config id>` —
 * a value that is true about where the row came from rather than a guess at
 * which run produced it, and one no runner can ever generate, so a migrated row
 * is always distinguishable from a recorded one. A row written AFTER GH-548
 * carries its own `last_run`, and its signature is taken from there when that
 * `last_run` is about the numbers — that is, when it completed.
 *
 * A row with no `metrics` is not a completed run and is not written as one. It
 * is the state a site is in when its only attempt failed, and inventing a result
 * out of it is the mirror of the bug `down()` had, which deleted that state
 * instead.
 *
 * A row that already carries `last_run` from GH-548 brings its failure across
 * as a SECOND row, so the screen keeps saying what it said before the move. On
 * the stand there are none — no run has happened since GH-548 — but a migration
 * that only works on today's data is a migration that works once.
 *
 * WHAT IS DROPPED. The `analysis_cache` rows themselves. `synced_at` in
 * `site_configs` goes back to one meaning — "stored by the server" — because
 * the only namespace that used it for anything else is gone.
 *
 * REVERSIBLE, AND THE WORD IS QUALIFIED HERE RATHER THAN ASSUMED.
 *
 * `down()` walks every site that has a row in `analysis_results` — not only
 * those with a completed run — and writes it back under the old namespace.
 * A site whose only run FAILED gets a row with `metrics` and `computed` null
 * and `last_run` carrying the failure, which is exactly the state GH-548 taught
 * the screen to show ("no analysis has been run for this site yet" plus the
 * reason) and exactly the state the first version of this method dropped: it
 * iterated the completed rows, so such a site got no row at all and was then
 * deleted with the rest of the table.
 *
 * WHAT IT DOES NOT BRING BACK, in full, because a partial list reads as a
 * complete one. The old shape holds ONE row per site and this table holds one
 * per run, so collapsing them loses everything that made them different:
 *
 *   1. Every completed run but the latest. They are deleted, not merged.
 *   2. Every failed attempt but the latest.
 *   3. `started_at`, `inputs` and `detail` of the COMPLETED row. The old shape
 *      had nowhere to put them. `detail` survives on a failure, because
 *      `last_run` carried it.
 *   4. Runs recorded AFTER the move. This is the one worth saying plainly: on a
 *      stand it is nothing, but after a week of real use `down()` collapses that
 *      week into one row per site and deletes the rest. Rolling this migration
 *      back is not an undo of the move, it is a conversion back to a shape that
 *      cannot hold what has been written since.
 *   5. Exact timestamps of the restored settings row. `synced_at` is the
 *      completed run's `completed_at` and round-trips; `created_at` comes from
 *      the row the result was written as, which for a migrated row IS the
 *      original stamp and for a later one is when that run was recorded; and
 *      `updated_at` is now, because that is when this write happened.
 */
return new class extends Migration
{
    private const NS = 'analysis_cache';

    public function up(): void
    {
        DB::transaction(function () {
            $rows = DB::table('site_configs')->where('namespace', self::NS)->get();

            foreach ($rows as $row) {
                $config = json_decode($row->config ?? 'null', true);
                $config = is_array($config) ? $config : [];
                $lastRun = is_array($config['last_run'] ?? null) ? $config['last_run'] : null;

                $stamp = $row->synced_at ?: $row->updated_at;

                // A settings row with no numbers is not a completed run, and
                // writing it as one was the mirror of the bug the reviewer found
                // in `down()`: there it deleted the "only a failure" state, here
                // it would have invented a result out of it. On the stand all
                // twelve rows carry `metrics` and none carries `last_run`
                // (measured 22.09.2026), so this branch never fires there — it
                // fires on a row this migration meets after GH-548 has run, and
                // on the round trip a test drives.
                $hasNumbers = isset($config['metrics']) && $config['metrics'] !== null;

                if ($hasNumbers) {
                    DB::table('analysis_results')->insert([
                        'site_id'      => $row->site_id,
                        // The run these rows cannot name, named as what it is.
                        // `last_run` is used only when it is ABOUT these
                        // numbers: a failed `last_run` belongs to the attempt
                        // that did not produce them, and stamping the completed
                        // row with it would tie the figures to the run that
                        // failed to replace them.
                        'run_id'       => ($lastRun['outcome'] ?? null) === 'complete'
                            ? ($lastRun['runId'] ?? 'migrated-'.$row->id)
                            : 'migrated-'.$row->id,
                        'outcome'      => 'complete',
                        'reason'       => null,
                        'started_at'   => null,
                        'completed_at' => $stamp,
                        'inputs'       => null,
                        'metrics'      => json_encode($config['metrics']),
                        'computed'     => isset($config['computed']) ? json_encode($config['computed']) : null,
                        'detail'       => null,
                        'created_at'   => $stamp,
                        'updated_at'   => $stamp,
                    ]);
                }

                // A failed attempt recorded against those numbers is a fact of
                // its own and travels as its own row, after the complete one so
                // that it is the site's latest.
                if (($lastRun['outcome'] ?? null) === 'failed') {
                    DB::table('analysis_results')->insert([
                        'site_id'      => $row->site_id,
                        'run_id'       => $lastRun['runId'] ?? ('migrated-'.$row->id.'-failed'),
                        'outcome'      => 'failed',
                        'reason'       => $lastRun['reason'] ?? 'run-not-completed',
                        'started_at'   => null,
                        'completed_at' => $lastRun['failedAt'] ?? null,
                        'inputs'       => null,
                        'metrics'      => null,
                        'computed'     => null,
                        'detail'       => isset($lastRun['detail']) ? json_encode($lastRun['detail']) : null,
                        'created_at'   => $lastRun['failedAt'] ?? $stamp,
                        'updated_at'   => $lastRun['failedAt'] ?? $stamp,
                    ]);
                }
            }

            DB::table('site_configs')->where('namespace', self::NS)->delete();
        });
    }

    public function down(): void
    {
        DB::transaction(function () {
            // Ascending, so `keyBy` leaves the LATEST row of each kind per site.
            $rows      = DB::table('analysis_results')->orderBy('id')->get();
            $completed = $rows->where('outcome', 'complete')->keyBy('site_id');
            $latest    = $rows->keyBy('site_id');

            // Every site that has a run, not every site that has a RESULT. A
            // site whose only run failed is a state the old shape carries and
            // the screen prints, and it was being deleted here.
            foreach ($latest as $siteId => $last) {
                $row = $completed->get($siteId);

                $config = [
                    'metrics'  => $row ? json_decode($row->metrics ?? 'null', true) : null,
                    'computed' => $row ? json_decode($row->computed ?? 'null', true) : null,
                ];

                if ($last->outcome === 'failed') {
                    $config['last_run'] = [
                        'runId'    => $last->run_id,
                        'outcome'  => 'failed',
                        'reason'   => $last->reason,
                        'detail'   => json_decode($last->detail ?? 'null', true),
                        'failedAt' => $last->completed_at,
                    ];
                } else {
                    $config['last_run'] = [
                        'runId'       => $last->run_id,
                        'outcome'     => 'complete',
                        'completedAt' => $last->completed_at,
                    ];
                }

                DB::table('site_configs')->updateOrInsert(
                    ['site_id' => $siteId, 'namespace' => self::NS],
                    [
                        'config' => json_encode($config),
                        // The date OF THE NUMBERS, and null when there are none
                        // — the same rule the service kept before it had a
                        // column of its own (GH-548): a run that produced
                        // nothing does not date the nothing.
                        'synced_at'  => $row?->completed_at,
                        'created_at' => ($row ?? $last)->created_at,
                        'updated_at' => now(),
                    ]
                );
            }

            DB::table('analysis_results')->delete();
        });
    }
};
