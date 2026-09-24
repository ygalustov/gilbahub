<?php

namespace App\Http\Controllers;

use App\Models\Sample;
use App\Models\Site;
use App\Support\AnalysisNotice;
use App\Support\RunStart;
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
            // GH-675 (item 4, slice 1): the run's own account of what it did not
            // have. Declared here or it never reaches `$validated` — Laravel hands
            // back only the keys the rules name, so an undeclared key is dropped in
            // silence, which is how the first run of this set filed an empty
            // judgement while the body carried a full one.
            'detail.notApplicable' => 'nullable|array',
            'inputs'             => 'nullable|array',
        ]);

        $site = Site::query()->find($validated['site_id']);
        abort_unless($site, 404, 'site-not-found');

        // GH-663 (item 3ak, analyst 29.3 layer 3) — THE ROW IS REFUSED IF ITS
        // NUMBERS WERE COMPUTED FOR ANOTHER SITE.
        //
        // Layers 1 and 2 live in the browser: the frame is rendered for `?site=`
        // and the runner refuses to file when the document disagrees. This is the
        // same class caught where the truth is kept, so it holds even if some
        // third road to the site appears later. Measured before the repair
        // (GH-661): a held body carried `site_id` of one site with the samples,
        // soil temperature and disease of another.
        $check = $this->siteCheck($site, $validated['inputs'] ?? null);
        $mismatch = $check['mismatch'];
        if ($mismatch !== null) {
            return response()->json([
                'error' => 'site-mismatch',
                'message' => AnalysisNotice::reasonText('site-mismatch'),
                'detail' => $mismatch,
            ], 422);
        }

        // GH-675 (queue item 4, slice 1, analyst 22.7) — WHAT THE RUN SAID IT DID NOT
        // HAVE, JUDGED AGAINST WHAT EXISTED WHEN IT STARTED.
        //
        // The run names its own gaps in `detail.notApplicable`; the server decides
        // what each one MEANS, because only the server knows the start. The database
        // is NOT consulted now: a sample created between the start and this moment is
        // absent to the run and present here, and judging by "now" would call it "did
        // not arrive" -- a true statement on a false premise, the GH-459 class
        // stretched over minutes.
        $startSet = RunStart::recorded((string) $validated['run_id']);
        $judged = $this->judgeAgainstStart($validated['detail'] ?? null, $startSet);

        $row = AnalysisResults::record($request->user(), $site, [
            'metrics'    => $validated['metrics'],
            'computed'   => $validated['computed'] ?? null,
            'analyzedAt' => $validated['analyzed_at'],
            'runId'      => $validated['run_id'],
            'detail'     => $validated['detail'] ?? null,
            'inputs'     => $validated['inputs'] ?? null,
            // GH-670: what the site check looked at, filed WITH THE ROW. Not in the
            // response, which lives a second, and not in `inputs`, which means what
            // the run read — this is the server's own finding and it is kept where
            // it can be read in a month.
            'siteCheck'  => $check['account'],
            // GH-675: the run's own gaps with a class each, and the set they were
            // judged against, copied into the row so the judgement can be read back
            // in a month rather than recomputed against a database that has moved.
            'notApplicable' => $judged,
            'runStart' => $startSet,
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
    /**
     * GH-663 — what disagrees about the site, or null when nothing does.
     *
     * TWO THINGS ARE COMPARED, because they fail differently:
     *   - `inputs.site`, the site the DOCUMENT was built for, declared by the
     *     runner. A declaration naming another site is the defect itself;
     *   - every sample id in `inputs.samples`, which must belong to this site. A
     *     sample is a fact in the database, so this catches the case even if the
     *     declaration is missing or has been made to agree.
     *
     * AN ABSENT DECLARATION IS NOT A DISAGREEMENT. A body from a bundle that
     * predates this field says nothing about its site, and refusing it would turn
     * a deployment into a data outage. Silence and a foreign name are different
     * answers — the distinction the predictions measurement turned on (GH-662),
     * where an empty key was silently dropped and looked exactly like no write.
     */
    private function siteMismatch(Site $site, ?array $inputs): ?array
    {
        return $this->siteCheck($site, $inputs)['mismatch'];
    }

    /**
     * GH-670 (queue item 3ao) — WHAT THE CHECK LOOKED AT, SO THAT SILENCE STOPS
     * MEANING TWO DIFFERENT THINGS.
     *
     * Three states used to come out of here as one — nothing:
     *   - the body DECLARED no site. Accepted, and the row said nothing about it,
     *     so a row written by a bundle that predates the declaration is
     *     indistinguishable from one whose declaration was checked and agreed;
     *   - a sample key RESOLVED TO NOTHING. `continue` dropped it, so a key that
     *     names no row anywhere left the check as quietly as one that names this
     *     site's own sample;
     *   - a NUMERIC key. `is_string(118)` is false, so a JSON number never even
     *     reached the loop — filtered out before the check, and from outside that
     *     looks exactly like a key that passed it.
     *
     * MARKING AND NAMING ARE TWO DIFFERENT ACTIONS AND THEY STAY APART. The
     * declaration's absence is marked (`declaration: 'absent'`); a key that
     * resolved to nothing is named (`samples.unresolved`); and every key the check
     * did look at is named too (`samples.checked`), because "checked nothing" and
     * "checked and agreed" are the two states this whole item is about. They are
     * separate fields on purpose: one message about two different situations would
     * be a new defect, not a repair.
     *
     * @return array{mismatch:?array,account:array<string,mixed>}
     */
    private function siteCheck(Site $site, ?array $inputs): array
    {
        $account = ['declaration' => 'absent', 'samples' => ['checked' => [], 'unresolved' => []]];
        if (! is_array($inputs)) {
            return ['mismatch' => null, 'account' => $account];
        }

        $declared = $inputs['site'] ?? null;
        if (is_string($declared) && $declared !== '') {
            if ($declared !== $site->id) {
                $account['declaration'] = 'foreign';

                return ['mismatch' => ['computedFor' => $declared, 'filedUnder' => $site->id,
                    'by' => 'declaration'], 'account' => $account];
            }
            $account['declaration'] = 'matched';
        }

        $samples = is_array($inputs['samples'] ?? null) ? $inputs['samples'] : [];
        $ids = [];
        foreach ($samples as $type => $id) {
            // GH-670 (O-3b) — A NUMBER IS A KEY TOO. `is_string` let `"118"` in and
            // dropped `118`, and the sample id IS a number: the day the row carries
            // `samples.id` instead of the browser's word (the open work on the
            // sample list), every key would have been filtered out here and the
            // check would have passed over all of them in silence. Anything that is
            // a string or a number counts, and nothing else does — `true`, an array
            // or an object is not an identifier.
            if (is_string($id) && $id !== '') {
                $ids[$id] = $type;
            } elseif (is_int($id) || is_float($id)) {
                $ids[(string) $id] = $type;
            }
        }
        if (! $ids) {
            return ['mismatch' => null, 'account' => $account];
        }

        // The sample travels as its own id or as the key the browser built for it
        // (`client_uid`), and the key is not unique between sites — measured in
        // 23.1, where one key belonged to two sites. So a key that resolves to
        // several rows is only a disagreement when NONE of them is this site's.
        $foreign = [];
        foreach ($ids as $id => $type) {
            $bare = preg_replace('/^sample_/', '', (string) $id);
            // GH-663 — THE NUMERIC COLUMN IS ONLY ASKED A NUMERIC QUESTION, AND
            // THIS GUARD HAS NO CASE. Both halves are said on purpose.
            //
            // The hazard, measured in both engines rather than reasoned about:
            // `SELECT … WHERE id = '26_zz9y'` matches one row in MySQL and none in
            // SQLite, because MySQL coerces the string to 26. The sample keys this
            // product builds today begin with a letter — `Soil_26_zo0t` coerces to
            // 0 and matches nothing — so nothing is wrong today; a key beginning
            // with digits would let another site's row answer for this one, and
            // clear a foreign sample rather than refuse it.
            //
            // THE BOUNDARY: the test bench is SQLite, which does not coerce, so no
            // case here can show this red. The guard is hygiene with its reason
            // written down, not a repair with a witness — and saying so is the
            // difference between a boundary and a silence. Three attempts at a case
            // went green with the guard removed before the engines were measured.
            $owners = Sample::withTrashed()
                ->where(function ($q) use ($id, $bare) {
                    if (ctype_digit($bare)) {
                        $q->orWhere('id', (int) $bare);
                    }
                    $q->orWhere('client_uid', (string) $id);
                    if ($bare !== (string) $id) {
                        $q->orWhere('client_uid', $bare);
                    }
                })
                ->pluck('site_id')
                ->all();
            if ($owners === []) {
                // GH-670: NAMED, not skipped. A key that resolves to no row at all
                // is not a disagreement — there is nothing to disagree with — but it
                // is not nothing either, and it used to leave here as quietly as a
                // key that matched.
                $account['samples']['unresolved'][] = ['type' => $type, 'sample' => (string) $id];

                continue;
            }
            $account['samples']['checked'][] = ['type' => $type, 'sample' => (string) $id];
            if (! in_array($site->id, $owners, true)) {
                $foreign[] = ['type' => $type, 'sample' => (string) $id, 'belongsTo' => array_values(array_unique($owners))];
            }
        }

        return [
            'mismatch' => $foreign === [] ? null
                : ['filedUnder' => $site->id, 'foreignSamples' => $foreign, 'by' => 'samples'],
            'account' => $account,
        ];
    }

    /**
     * GH-675 — each gap the run named, with the class the start set gives it.
     *
     * THREE ANSWERS, AND THE THIRD IS THE ONE THAT KEEPS US HONEST:
     *   - the input was NOT there when the run started -> `input-not-entered`, the
     *     client's own data, and the sentence names what to enter and where (its
     *     words are the owner's, and the input list's `label` is her draft);
     *   - it WAS there and the run did not get it -> `input-did-not-arrive`, our
     *     defect, and the client is told so;
     *   - there is NO record of the start -> `run-start-not-recorded`. The server
     *     does not guess. A frame opened without `rerun`, or a record past its day,
     *     is our side too, because the client cannot be blamed for a fact nobody
     *     wrote down.
     *
     * @param  array<string,mixed>|null  $detail
     * @param  array<string,mixed>|null  $startSet
     * @return array<int,array<string,mixed>>
     */
    private function judgeAgainstStart(?array $detail, ?array $startSet): array
    {
        $claimed = is_array($detail['notApplicable'] ?? null) ? $detail['notApplicable'] : [];
        $out = [];
        foreach ($claimed as $entry) {
            if (! is_array($entry)) {
                continue;
            }
            $module = (string) ($entry['module'] ?? '');
            $missing = is_array($entry['missing'] ?? null) ? $entry['missing'] : [];
            $reasons = [];
            foreach ($missing as $input) {
                if (! is_string($input) || $input === '') {
                    continue;
                }
                $had = RunStart::had($startSet, $input);
                $reasons[] = [
                    'input' => $input,
                    'cause' => $had === null ? 'run-start-not-recorded'
                        : ($had ? 'input-did-not-arrive' : 'input-not-entered'),
                ];
            }
            $out[] = ['module' => $module, 'missing' => $reasons];
        }

        return $out;
    }

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
