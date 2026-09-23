<?php

namespace App\Http\Controllers;

use App\Models\Site;
use App\Support\AnalysisResults;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class AnalysisCacheController extends Controller
{
    /**
     * Store or replace the analysis result for a site.
     *
     * GH-546 (stage 1): the controller no longer owns this. It resolves the
     * site, hands the actor and the body to `AnalysisResults`, and answers. Two
     * things move with that:
     *
     *   PERMISSION. This route took `site_id` from the request body and wrote it
     *   without asking whether the caller may touch that site — no `canEditSite`,
     *   no `canViewSite`, nothing. It now refuses with 403, and the refusal lives
     *   at the service entrance rather than here, so both this route and the
     *   failure-report route stage 2 adds go through the same check instead of
     *   two copies of it.
     *
     *   AN UNKNOWN SITE. `site_id` was `required|string` and went straight to
     *   `SiteConfigWriter::mutate`, which would happily create a configuration
     *   row for a site that does not exist — `snap.siteId` falls back to the
     *   string `'default'` when the page has no active site. That is now a 404
     *   and no orphan row.
     *
     * COMPLETENESS, GH-553, and it is NOT here. The body used to be validated
     * for shape alone — "is `metrics` an array" — and that is how Federal Golf's
     * row came to hold six of the thirteen keys
     * `assets/analysis-result.schema.json` declares required, stored as a
     * completed run. The check lives at the service entrance beside the
     * permission check, for a reason found by putting it here first: a
     * completeness test in front of the service answers 422 to a VIEWER, telling
     * someone who may not write the site what the form of its result is, and
     * hiding the 403 they should have got. Order is part of a check.
     */
    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'site_id'     => 'required|string',
            // GH-548 (stage 3): the run that produced the numbers names
            // itself. Since stage 2 the runner exists only when it was opened
            // with `?rerun=<runId>`, so every real write already has one; the
            // row can now say WHICH run its figures came from, and a `failed`
            // mark from an earlier attempt is replaced by a signed result
            // rather than lingering next to new numbers.
            'run_id'      => 'required|string',
            'analyzed_at' => 'required|date',
            'metrics'     => 'required|array',
            'computed'    => 'nullable|array',
            // GH-557: the run's own account of itself — what it skipped and
            // what it said. Shape only; the server recomputes the outcome from
            // the numbers rather than trusting any of it.
            'detail'             => 'nullable|array',
            'detail.nulls'       => 'nullable|array',
            'detail.skipped'     => 'nullable|array',
            'detail.warnings'    => 'nullable|array',
            // GH-581 (stage 2): what the run put in place of something it
            // was not given, and what it was given. Shape only, like the rest of
            // the account — the server does not trust any of it to decide an
            // outcome; it stores it so the reader can be told.
            'detail.assumptions' => 'nullable|array',
            'inputs'             => 'nullable|array',
        ]);

        $site = Site::query()->find($validated['site_id']);
        abort_unless($site, 404, 'site-not-found');

        $row = AnalysisResults::record($request->user(), $site, [
            'metrics'    => $validated['metrics'],
            'computed'   => $validated['computed'] ?? null,
            'analyzedAt' => $validated['analyzed_at'],
            'runId'      => $validated['run_id'],
            'detail'     => $validated['detail'] ?? null,
            'inputs'     => $validated['inputs'] ?? null,
        ]);

        // GH-557: the outcome goes back, because the producer cannot work it out
        // — the server decides it from the body, and the opener needs to know
        // whether to show the page as refreshed or to say the run came back
        // incomplete.
        return response()->json(['ok' => true, 'outcome' => $row->outcome]);
    }

    /**
     * Record a run that did not produce a result.
     *
     * GH-548 (stage 3) — the second intention the plan's section 8.3 asks
     * for, and the thing that makes a reason VISIBLE rather than merely known.
     * Until now a failed re-run reached a `console.warn` and `window.
     * GilbaRerunOutcome` in the tab that started it: gone on reload, invisible
     * on a second device, invisible to the person who opens the dashboard
     * tomorrow and reads week-old figures as today's.
     *
     * The numbers are NOT touched here and neither is their date — see
     * `AnalysisResults::recordFailure()`. The route exists so the SCREEN can be
     * told; it is not a way to edit a result.
     */
    public function storeRun(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'site_id' => 'required|string',
            'run_id'  => 'required|string',
            'outcome' => 'required|string|in:failed',
            'reason'  => 'required|string|max:64',
            'detail'  => 'nullable|array',
        ]);

        $site = Site::query()->find($validated['site_id']);
        abort_unless($site, 404, 'site-not-found');

        AnalysisResults::recordFailure($request->user(), $site, [
            'runId'  => $validated['run_id'],
            'reason' => $validated['reason'],
            'detail' => $validated['detail'] ?? null,
        ]);

        return response()->json(['ok' => true]);
    }
}
