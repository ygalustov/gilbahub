<?php

namespace App\Support;

use App\Models\AnalysisResult;
use App\Models\Site;
use App\Models\User;
use App\Support\AnalysisResultSchema;
use Illuminate\Http\Exceptions\HttpResponseException;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Collection;

/**
 * GH-546 (stage 1) — THE OWNER OF A SITE'S ANALYSIS RESULT.
 *
 * WHAT THIS REPLACES, and it is not a refactor. The analysis result had no
 * owner. It was a by-product of a page: any embedding of `hub-persistence.js`
 * could write it, nine places read it each by its own lights, and its form was
 * whatever came out. The server kept an opaque object in the SETTINGS table
 * without knowing it was a run. Everything else followed from that — a five-key
 * row replacing a hundred-and-seventy-kilobyte one and nobody able to say which
 * was right.
 *
 * So the object gets an owner. This class is the only code that may read or
 * write the analysis result; a static guard asserts it
 * (`gh546-analysis-results-single-owner.test.js`), because an owner nothing
 * enforces is an owner in the comments.
 *
 * GH-550 (stage 4) — THE STORAGE MOVED AND THE READERS DID NOT CHANGE.
 *
 * The result lived in `site_configs` under namespace `analysis_cache`: the
 * settings table, one row per site, overwritten in place. It now lives in
 * `analysis_results`, one row per RUN, accepted by the owner on 22.09.2026 —
 * "I think a separate table is better".
 *
 * The promise the stage order rests on is that the nine readers do not notice,
 * because they take `forSite()` / `forSites()` / `statusMap()` and those return
 * the same shape as before. That promise is kept: not one reader changed in this
 * stage. What DID change, and is named rather than left to be discovered:
 *
 *   - `record()` and `recordFailure()` return an `AnalysisResult` instead of a
 *     `SiteConfig`. Neither caller used the value; the tests that did were
 *     rewritten. This is the writer's return type, not a reader's shape.
 *   - `NAMESPACE` is gone and `TABLE` stands in its place. Nothing outside this
 *     class named either.
 *   - There is no read-modify-write left anywhere. A failed run used to merge
 *     `last_run` into the stored config, which was the single exception to
 *     "a result is whole or it is nothing" (GH-447). A failure is now its own
 *     row and the exception is gone with it.
 *
 * WHAT IT STILL DOES NOT DO: validate against
 * `assets/analysis-result.schema.json`. The producer assembles a body by
 * presence, so rejecting incomplete bodies here would reject every real run.
 *
 * THE PERMISSION CHECK IS ON WRITES. `record()` and `recordFailure()` check.
 * `forSite()`, `forSites()` and `statusMap()` do NOT, and the qualification
 * belongs here rather than in somebody's memory: an unqualified "the permission
 * check" reads as though reading were guarded too. It is safe as the callers
 * stand — every call site passes either the user's own active site or
 * `AccountController`'s list of the account's own sites, and no request supplies
 * a site identifier to any of them — but that is a property of the callers, not
 * of this class.
 */
class AnalysisResults
{
    /**
     * Where the result lives. GH-550 replaced the namespace constant that stood
     * here; the guard test watches both names so a reader written against the
     * old one cannot come back quietly.
     */
    public const TABLE = 'analysis_results';

    /**
     * Record a completed run.
     *
     * The actor is passed in rather than read from `auth()` so that the check is
     * a property of the call and shows up in a test without a session.
     *
     * @param array<string,mixed> $result  metrics/computed/analyzedAt/runId, as the producer sends them
     */
    public static function record(User $actor, Site $site, array $result): AnalysisResult
    {
        // GH-546 (section 11; owner's decision 22.09): writing a result is
        // editing the site. A viewer may look at the numbers and may not
        // replace them. 403 here rather than a hidden button: the button is a
        // convenience, this is the rule.
        abort_unless($actor->canEditSite($site), 403, 'site-not-editable');
        // GH-550: the run signature is a column now, and a NOT NULL one. The
        // route has required it since GH-548; this is the same rule at the
        // service door, so a direct call answers the way the route does instead
        // of reaching the database and failing there.
        abort_unless(! empty($result['runId']), 422, 'run-id-required');

        // GH-553 — COMPLETENESS, against the one file that declares the form.
        //
        // Until now the only thing asked of `metrics` was that it be an array, so
        // a body with six of thirteen keys was stored as a completed run — which
        // is what a real Re-run on Federal Golf did on 22.09.2026. The refusal
        // NAMES the keys, because "the result was incomplete" without saying what
        // is missing is a message nobody can act on.
        //
        // It stands AFTER the permission check and inside the owner, not in the
        // controller. Both positions were tried: in front of the service it
        // answered 422 to a viewer, telling someone who may not write the site
        // what the shape of its result is and swallowing the 403 they should have
        // had. Order is part of a check.
        //
        // `null` is a complete value. A key whose engine could not answer travels
        // as null and is accepted; that is the whole point of the producer's half
        // of this fix, and a test written with `empty()` would refuse it.
        $missing = AnalysisResultSchema::missingFrom($result['metrics'] ?? []);
        if ($missing) {
            throw new HttpResponseException(response()->json([
                'message' => 'incomplete-result',
                'missing' => $missing,
            ], 422));
        }

        // GH-557 (section 15) — THE OUTCOME IS DERIVED, NOT REPORTED.
        //
        // `complete` used to mean "the POST was accepted". Since GH-553 the
        // producer sends every required key with `null` where its engine could
        // not answer, and `null` is a correctly formed value — so a run that
        // computed six of thirteen numbers was stored as a completed analysis
        // and replaced the numbers of one that had computed all thirteen. That
        // is Federal Golf's row.
        //
        // `complete` now means every required value was computed. A run that
        // finished, sent a well-formed body, and could not compute some of it is
        // `partial`. The server works that out from the body; the client's word
        // is not the outcome, because a producer that believes it succeeded is
        // exactly the producer this is about.
        $metrics = $result['metrics'] ?? [];
        $detail  = is_array($result['detail'] ?? null) ? $result['detail'] : [];

        // GH-558: uncomputed, not merely null. A body that reached here has all
        // thirteen keys (`missingFrom` refused it otherwise), so for this path
        // the two agree — and using the wider one means the rule that decides an
        // outcome is ONE rule, whether it is applied to a body arriving now or
        // to a row written before the rule existed.
        $nulls    = AnalysisResultSchema::uncomputedIn($metrics);
        $skipped  = self::skippedFrom(
            array_values(array_filter((array) ($detail['skipped'] ?? []), 'is_array')),
            is_array($result['computed'] ?? null) ? $result['computed'] : [],
        );
        $outcome  = ($nulls || $skipped) ? 'partial' : 'complete';

        return AnalysisResult::query()->create([
            'site_id'      => $site->id,
            'run_id'       => $result['runId'],
            'outcome'      => $outcome,
            'reason'       => $outcome === 'partial' ? self::partialReason($skipped) : null,
            'started_at'   => $result['startedAt'] ?? null,
            'completed_at' => $result['analyzedAt'] ?? now(),
            'inputs'       => $result['inputs'] ?? null,
            'metrics'      => $metrics,
            'computed'     => $result['computed'] ?? null,
            // The account of the pass. Written whenever there is anything to
            // account for — which includes a partial run whose producer sent no
            // detail at all: `nulls` is the server's own finding, and without it
            // the row would say "partial" and not say of what.
            'detail'       => self::accountOf($nulls, $skipped, $detail),
        ]);
    }

    /**
     * GH-573 — THE VERDICT COMES FROM THE RESULT.
     *
     * WHAT THIS REPLACES, and it was wrong on real data rather than merely
     * inelegant. GH-569 read the journal for a module that had not produced, and
     * it read it BY THE WORDS — "blocked", "failed", "error". On the stand,
     * `analysis_results` id 29 carries "Wear engine blocked by identity
     * enforcement" AND a complete fourteen-key `computed.wear` stamped in the
     * same millisecond; `wear-recovery-engine-pure.js` does not read
     * `turfIntent` at all, so the block is announced and never enforced. The
     * sentence was false, the rule believed it, and whole runs went partial for
     * it. Measured in `Gh571SkippedIsInferredFromAWordTest`, which also shows
     * the rule gave the same verdict whether the result was in the body or not.
     *
     * NOW: the run DECLARES what it took on and did not produce
     * (`hub-orchestrator.js`, `attempting()` plus the sweep at the end of the
     * pass; `cascade-orchestrator.js`, one sweep over its own results), and this
     * class checks each declaration AGAINST THE RESULT before believing it. A
     * module named as having produced nothing, whose result is in `computed`,
     * is not counted — because the result is the thing that settles it, and a
     * producer that is wrong about itself is exactly the producer this question
     * is about.
     *
     * NOTHING HERE READS A MESSAGE. The journal still travels, still carries its
     * `level` (GH-570), and the panel still prints it — but no outcome depends
     * on what any sentence says.
     *
     * @param  array<int,array<string,mixed>> $skipped   what the run declared
     * @param  array<string,mixed>            $computed  what the run produced
     * @return array<int,array<string,mixed>>
     */
    private static function skippedFrom(array $skipped, array $computed): array
    {
        $seen = [];
        $out  = [];

        foreach ($skipped as $entry) {
            $module = $entry['module'] ?? ($entry['step'] ?? null);
            if (! $module || in_array($module, $seen, true)) {
                continue;
            }
            // The producer says where its result lives; three modules spell it
            // differently from their own name. Taking the spelling from the
            // declaration keeps that knowledge in one place.
            $key = $entry['resultKey'] ?? $module;
            if (self::producedSomething($computed[$key] ?? null)) {
                continue;
            }
            $seen[] = $module;
            $out[]  = $entry;
        }

        return $out;
    }

    /**
     * Did an engine produce a result here?
     *
     * The same three answers the producer works with, because they are three
     * answers the ENGINES give: nothing at all; an empty object, which is what
     * the climate step writes when it falls back; and `{status: 'Error'}` or
     * `{status: 'Not available'}`, which is how every engine behind the cascade
     * adapter reports failure instead of throwing.
     *
     * @param mixed $value
     */
    private static function producedSomething($value): bool
    {
        if ($value === null) {
            return false;
        }
        if (is_array($value)) {
            $status = (string) ($value['status'] ?? '');
            if ($status === 'Error' || $status === 'Not available') {
                return false;
            }

            return $value !== [];
        }

        return true;
    }

    /**
     * What the row keeps about the pass, or null when there is nothing.
     *
     * @param  array<int,string>              $nulls
     * @param  array<int,array<string,mixed>> $skipped
     * @param  array<string,mixed>            $detail
     * @return array<string,mixed>|null
     */
    private static function accountOf(array $nulls, array $skipped, array $detail): ?array
    {
        $warnings = array_values(array_filter((array) ($detail['warnings'] ?? []), 'is_array'));

        $assumptions = array_values(array_filter((array) ($detail['assumptions'] ?? []), 'is_array'));
        if (! $nulls && ! $skipped && ! $warnings && ! $assumptions) {
            return null;
        }

        return [
            'nulls'    => $nulls,
            'skipped'  => $skipped,
            'warnings' => $warnings,
            // GH-581: what the run went ahead on in place of something it was
            // not given. Stored as the producer sent it — the server does not
            // re-derive an assumption it did not make.
            'assumptions' => array_values(array_filter(
                (array) ($detail['assumptions'] ?? []), 'is_array'
            )),
        ];
    }

    /**
     * Why a run came out partial, in one code.
     *
     * The steps a run skipped usually share a cause — the climate arriving after
     * the disease step takes the forecast with it — so the reason is the first
     * cause reported rather than a list. The list itself is in `detail.skipped`
     * and the panel reads that; this is for the row to be greppable.
     *
     * @param  array<int,array<string,mixed>> $skipped
     */
    private static function partialReason(array $skipped): string
    {
        foreach ($skipped as $step) {
            if (! empty($step['reason'])) {
                return (string) $step['reason'];
            }
        }

        return 'values-not-computed';
    }

    /**
     * Record a run that did NOT produce a result.
     *
     * The owner's decision of 22.09.2026: the previous numbers stay on the
     * screen with their own date, and they say why the re-run did not replace
     * them. Writing a row here cannot disturb them — the completed run is a
     * different row and is not touched, which is what the old shape needed a
     * read-modify-write and a "hold the timestamp still" flag to achieve.
     *
     * @param array<string,mixed> $report  runId/reason/detail/failedAt from the runner
     */
    public static function recordFailure(User $actor, Site $site, array $report): AnalysisResult
    {
        // Same check as a successful write, at the same door. Reporting a
        // failure against somebody else's site puts a warning on their screen.
        abort_unless($actor->canEditSite($site), 403, 'site-not-editable');
        abort_unless(! empty($report['runId']), 422, 'run-id-required');

        return AnalysisResult::query()->create([
            'site_id'      => $site->id,
            'run_id'       => $report['runId'],
            'outcome'      => 'failed',
            'reason'       => $report['reason'] ?? 'run-not-completed',
            'started_at'   => $report['startedAt'] ?? null,
            'completed_at' => $report['failedAt'] ?? now(),
            'inputs'       => null,
            'metrics'      => null,
            'computed'     => null,
            'detail'       => $report['detail'] ?? null,
        ]);
    }

    /**
     * The one projection every reader takes.
     *
     * Eight controllers assembled this array by hand with the same three keys.
     * A ninth field (`lastRun`) would have been eight edits and would have
     * reached some screens and not others — which is the failure the owner
     * described on the Account page.
     *
     * @return array<string,mixed>|null  null when the site has never been analysed
     */
    public static function forSite(?Site $site): ?array
    {
        if (! $site) {
            return null;
        }

        return self::forSites([$site->id])[$site->id] ?? null;
    }

    /**
     * The same projection for many sites at once, keyed by site id.
     *
     * The topbar composer runs on every page with a topbar — eleven db-shell
     * views — and needs one row per site the user can see.
     *
     * Two queries, not N, and not one with a window function: the latest
     * completed run per site, and the latest run of any kind per site. `MAX(id)`
     * is the latest because the column is an auto-increment, and the sub-select
     * form works on both engines this project runs on.
     *
     * @param  Collection<int,string>|array<int,string> $siteIds
     * @return array<string,array<string,mixed>|null>
     */
    public static function forSites($siteIds): array
    {
        $ids = $siteIds instanceof Collection ? $siteIds->all() : (array) $siteIds;
        if (! $ids) {
            return [];
        }

        $completed = self::latestPerSite($ids, 'complete');
        $attempts  = self::latestPerSite($ids, null);
        // GH-557: a partial run stands in for the numbers ONLY where there is no
        // complete one — see project().
        $partials  = self::latestPerSite($ids, 'partial');

        $out = [];
        foreach ($ids as $id) {
            $out[$id] = self::project($completed->get($id), $attempts->get($id), $partials->get($id));
        }

        return $out;
    }

    /**
     * Growth-potential status per site, for the site switcher's dot.
     *
     * Kept here rather than in the composer because it reads the result: the
     * thresholds are the canonical GP ones (70 / 40), the same numbers
     * `gp-status.js` uses, and a second copy of them belongs to nobody.
     *
     * @return array<string,string|null>
     */
    public static function statusMap($siteIds): array
    {
        $out = [];
        foreach (self::forSites($siteIds) as $id => $projection) {
            // GH-557: the dot says "this site's analysis says X", and a partial
            // run does not say it. A site whose only run is partial gets no dot
            // rather than a green one computed from the one number that did
            // arrive.
            $raw = ($projection['numbersFrom'] ?? null) === 'complete'
                ? ($projection['metrics']['growthPotential'] ?? null)
                : null;
            if ($raw === null) {
                $out[$id] = null;
                continue;
            }
            $gp = (float) $raw >= 1 ? (float) $raw : (float) $raw * 100;
            $out[$id] = $gp >= 70 ? 'green' : ($gp >= 40 ? 'amber' : 'red');
        }

        return $out;
    }

    /**
     * Rows whose stored outcome disagrees with what the rule would say today.
     *
     * GH-558 (reviewer's finding on GH-557). The outcome is derived at write
     * time and the projection reads the column, so rows written before the rule
     * keep the word they were given — including the one on the stand that shows
     * the defect best. This is the question "which ones", and it lives here
     * because asking it means reading the result, which is this class's job and
     * nobody else's. The command that reports and restates them never names the
     * storage; it gets plain rows from here and hands ids back.
     *
     * Only `complete` is examined. A `failed` run produced nothing and is not
     * partial; a `partial` one already says so; and nothing is ever moved TO
     * `complete`, because that would mean inventing values.
     *
     * @return array<int,array<string,mixed>>
     */
    public static function outcomesToRestate(): array
    {
        $out = [];

        AnalysisResult::query()
            ->whereIn('outcome', ['complete', 'partial'])
            ->with('site')
            ->orderBy('id')
            ->each(function (AnalysisResult $row) use (&$out) {
                $verdict = self::verdictFor($row);
                if ($verdict['outcome'] === $row->outcome) {
                    return;
                }
                $out[] = [
                    'id'          => $row->id,
                    'site'        => $row->site?->name ?? $row->site_id,
                    'runId'       => $row->run_id,
                    'completedAt' => $row->completed_at?->format('Y-m-d H:i'),
                    'was'         => $row->outcome,
                    'becomes'     => $verdict['outcome'],
                    'uncomputed'  => $verdict['nulls'],
                    'notProduced' => array_values(array_filter(array_column($verdict['skipped'], 'module'))),
                ];
            });

        return $out;
    }

    /**
     * GH-573 — what a STORED row's outcome is under today's rule.
     *
     * The same two questions `record()` asks, asked of a row instead of a body:
     * which required values were not computed, and which declared skips survive
     * a look at the result. It is the one place the rule is written, so a
     * restatement cannot drift from a recording.
     *
     * IT RESTATES IN BOTH DIRECTIONS, and that is new. GH-569 could only turn a
     * row partial. The rule it introduced was withdrawn — it inferred a skip
     * from a word — so rows it made partial have to be able to come back, or the
     * stand keeps a verdict from a rule we no longer believe. On the stand that
     * is id 34, Test5 - NZ: `wear` named as not produced, `computed.wear`
     * fourteen keys.
     *
     * @return array{outcome:string,nulls:array<int,string>,skipped:array<int,array<string,mixed>>}
     */
    private static function verdictFor(AnalysisResult $row): array
    {
        $detail  = is_array($row->detail) ? $row->detail : [];
        $nulls   = AnalysisResultSchema::uncomputedIn(is_array($row->metrics) ? $row->metrics : []);
        $skipped = self::skippedFrom(
            array_values(array_filter((array) ($detail['skipped'] ?? []), 'is_array')),
            is_array($row->computed) ? $row->computed : [],
        );

        return [
            'outcome' => ($nulls || $skipped) ? 'partial' : 'complete',
            'nulls'   => $nulls,
            'skipped' => $skipped,
        ];
    }

    /** How many rows carry each outcome, for a report that says what it looked at. */
    public static function outcomeCensus(): array
    {
        return AnalysisResult::query()
            ->selectRaw('outcome, COUNT(*) as n')
            ->groupBy('outcome')
            ->pluck('n', 'outcome')
            ->all();
    }

    /**
     * Restate the outcome of rows the rule now calls partial.
     *
     * Reads the numbers; never rewrites them. `metrics`, `computed`,
     * `completed_at` and `run_id` are what the run produced and when, and no
     * amount of restating changes that.
     *
     * @param  array<int,int> $ids
     * @return int  how many rows were changed
     */
    public static function restateOutcomes(array $ids): int
    {
        if (! $ids) {
            return 0;
        }

        $changed = 0;

        DB::transaction(function () use ($ids, &$changed) {
            AnalysisResult::query()->whereIn('id', $ids)->whereIn('outcome', ['complete', 'partial'])
                ->each(function (AnalysisResult $row) use (&$changed) {
                    $verdict = self::verdictFor($row);
                    if ($verdict['outcome'] === $row->outcome) {
                        return;
                    }
                    $detail = is_array($row->detail) ? $row->detail : [];

                    $row->forceFill([
                        'outcome' => $verdict['outcome'],
                        'reason'  => $verdict['outcome'] === 'partial'
                            ? ($verdict['skipped'][0]['reason'] ?? 'values-not-computed')
                            : null,
                        'detail'  => array_merge($detail, [
                            'nulls'    => $verdict['nulls'],
                            // What survives a look at the result. A skip the
                            // withdrawn rule invented for a module that DID
                            // produce is dropped here, and dropped from the row
                            // rather than only from the verdict — otherwise the
                            // panel keeps naming it.
                            'skipped'  => $verdict['skipped'],
                            'warnings' => $detail['warnings'] ?? [],
                            // So a judgement made from the stored row stays
                            // distinguishable from one the run made about itself.
                            'outcomeRecomputedAt' => now()->toISOString(),
                        ]),
                    ])->save();
                    $changed++;
                });
        });

        return $changed;
    }

    /**
     * The latest row per site, optionally of one outcome.
     *
     * @param  array<int,string> $ids
     * @return Collection<string,AnalysisResult>
     */
    private static function latestPerSite(array $ids, ?string $outcome): Collection
    {
        $latestIds = AnalysisResult::query()
            ->selectRaw('MAX(id) as id')
            ->whereIn('site_id', $ids)
            ->when($outcome, fn ($q) => $q->where('outcome', $outcome))
            ->groupBy('site_id')
            ->pluck('id');

        if ($latestIds->isEmpty()) {
            return collect();
        }

        return AnalysisResult::query()->whereIn('id', $latestIds)->get()->keyBy('site_id');
    }

    /**
     * The shape, in one place.
     *
     * `$completed` carries the numbers and their date; `$attempt` carries what
     * happened last. They are usually the same row, and the case where they are
     * not is the whole point: numbers from Tuesday under a re-run that failed on
     * Friday.
     *
     * @return array<string,mixed>|null
     */
    private static function project(?AnalysisResult $completed, ?AnalysisResult $attempt, ?AnalysisResult $partial = null): ?array
    {
        if (! $completed && ! $attempt) {
            return null;
        }

        // GH-557 (section 15) — A PARTIAL RUN DOES NOT REPLACE THE NUMBERS.
        //
        // If it did, one date would stand over the figures of two runs: today's
        // growth potential beside yesterday's disease risk, or a dash where
        // yesterday's number is still perfectly good. That is GH-459's shape
        // inside a single row, and it is why the numbers stay with the last run
        // that computed all of them.
        //
        // One exception, and it is about emptiness rather than about staleness:
        // a site whose ONLY run is partial has nothing else to show, and showing
        // nothing would hide figures that were really computed. It gets them,
        // with `status = 'partial'`, and every uncomputed value prints as "not
        // computed" rather than as a zero or as somebody else's number.
        $numbers = $completed ?: (! $completed && $partial ? $partial : null);

        return [
            'metrics'    => $numbers?->metrics,
            'computed'   => $numbers?->computed,
            'analyzedAt' => $numbers?->completed_at?->toISOString(),
            'lastRun'    => $attempt ? self::runShape($attempt) : null,
            'status'     => $attempt?->outcome,
            // Which run the numbers on screen came from. Without it a reader
            // cannot tell the exception above from the ordinary case, and the
            // panel has to say different things about them.
            'numbersFrom' => $numbers?->outcome,
        ];
    }

    /**
     * `last_run` as the screen has read it since GH-548.
     *
     * The keys are kept exactly as they were when this was a nested object in
     * the config blob: the readers were written against them, and the promise of
     * this stage is that the readers do not change.
     *
     * @return array<string,mixed>
     */
    private static function runShape(AnalysisResult $run): array
    {
        $shape = [
            'runId'   => $run->run_id,
            'outcome' => $run->outcome,
        ];

        if ($run->outcome === 'failed') {
            $shape['reason']   = $run->reason;
            $shape['detail']   = $run->detail;
            $shape['failedAt'] = $run->completed_at?->toISOString();
        } else {
            $shape['completedAt'] = $run->completed_at?->toISOString();
        }

        // GH-557: a partial run carries the account of what it could not do —
        // the steps it skipped, the values it has no number for, and everything
        // the pass said while running. The panel reads all three.
        if ($run->outcome === 'partial') {
            $detail = is_array($run->detail) ? $run->detail : [];
            $shape['reason']   = $run->reason;
            $shape['nulls']    = $detail['nulls'] ?? [];
            $shape['skipped']  = $detail['skipped'] ?? [];
            $shape['warnings'] = $detail['warnings'] ?? [];
        }

        // GH-581: assumptions travel on EVERY outcome, not only a partial one.
        // A run that computed all thirteen values on a rootzone profile nobody
        // entered is complete and is standing on a stand-in, and that is
        // precisely the run whose reader has no other way of knowing.
        $detail = is_array($run->detail) ? $run->detail : [];
        $shape['assumptions'] = $detail['assumptions'] ?? [];

        return $shape;
    }
}
