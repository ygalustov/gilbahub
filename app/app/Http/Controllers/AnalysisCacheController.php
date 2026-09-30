<?php

namespace App\Http\Controllers;

use App\Models\Sample;
use App\Support\SampleOwners;
use App\Models\Site;
use App\Support\AnalysisNotice;
use App\Support\RunStart;
use App\Support\AnalysisResults;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Log;
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

        /**
         * GH-700 (item 3ar) — THE RIGHT TO WRITE IS ASKED BEFORE ANYTHING IS COMPARED.
         *
         * The comparison below stood first, so a caller with no right to this site received a `422`
         * describing what is wrong with their body instead of the `403` that is the answer to them.
         * The docblock above already says why order is part of a check, about completeness; this is
         * the same sentence about the same route, one check earlier.
         *
         * IT IS THE SAME PREDICATE, NOT A SECOND COPY OF THE RULE. `AnalysisResults::record` asks
         * `canEditSite` at the service door and still does; this asks the same question sooner so the
         * refusal that reaches the caller is the one about them.
         */
        abort_unless($request->user()->canEditSite($site), 403, 'site-not-editable');

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
            /**
             * GH-700 (item 3ar) — THE REFUSAL NAMES THE CALLER'S OWN KEYS AND NOTHING ELSE.
             *
             * It used to carry `belongsTo`: the ids of the sites that own the sample with the key
             * that was sent, other accounts' and deleted samples included. Moving the permission
             * check earlier closes only part of that, and the analyst said so before it was built —
             * a caller who MAY write their own site gets the same list by sending someone else's
             * key, and that caller passes every check there is.
             *
             * So the list does not leave. What the caller gets back is what they themselves sent:
             * the type and the key that disagreed, and the site it was filed under. The owners are
             * written where only an administrator sees them — the journal, with the `run_id`, so the
             * diagnosis is not lost.
             *
             * WHAT STILL LEAKS, and it is named rather than hidden: the refusal itself says a sample
             * with that key exists somewhere. It cannot go — guard 3ak rests on it — and it carries
             * no identifier and no name.
             */
            $forClient = $mismatch;
            if (isset($forClient['foreignSamples']) && is_array($forClient['foreignSamples'])) {
                $forClient['foreignSamples'] = array_map(static function ($row) {
                    unset($row['belongsTo']);

                    return $row;
                }, $forClient['foreignSamples']);
            }
            Log::warning('Gilba analysis result refused: the numbers were computed for another site', [
                'run_id' => $validated['run_id'] ?? null,
                'filed_under' => $site->id,
                'by' => $mismatch['by'] ?? null,
                'foreign_samples' => $mismatch['foreignSamples'] ?? ($mismatch['computedFor'] ?? null),
            ]);

            return response()->json([
                'error' => 'site-mismatch',
                'message' => AnalysisNotice::reasonText('site-mismatch'),
                'detail' => $forClient,
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
            /**
             * GH-724 (queue item 19) — `none` IS AN ANSWER, NOT AN IDENTIFIER.
             *
             * The row now records what the run was TOLD about each kind of sample, and for a site
             * with no sample of that kind the opener's answer is the word `none`. Left in the
             * identifiers it would be looked up as a key, resolve to no row, and sit in
             * `samples.unresolved` for ever -- a stated absence reported as a thing that could not
             * be found. It is not a disagreement either way, so nothing is refused; what changes
             * is that the check stops pretending it went looking.
             */
            if ($id === 'none') {
                continue;
            }
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
            // GH-709: the resolution moved to one place so the data audit asks the same
            // question the write path asks, rather than a copy of it.
            $owners = SampleOwners::sitesOf((string) $id);
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
     * GH-777 (queue item 4, the analyst's 76.4 A and B) — TWO MORE, BECAUSE THE THREE ABOVE WERE
     * ANSWERING FOR CASES THAT ARE NOT THEIRS:
     *   - the run named an input the inputs list does not declare, or a sample type outside the three
     *     -> `input-not-in-list`. This fell into `run-start-not-recorded`, which SAID THE START WAS
     *     NOT RECORDED WHEN IT WAS: a fact stated about a record that exists, and the broken link is
     *     between the run's vocabulary and the list, on our side;
     *   - the input's storage is one the server cannot read -> `input-not-judged`. It used to fall
     *     into `input-not-entered`, which tells the client it entered nothing. Measured on the stand:
     *     5 of 21 sites carry a soil texture override in the column and 2 carry their PGR application
     *     only in the spray log, so this was not hypothetical.
     *
     * Both are `run-incomplete`: ours, never the client's.
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
                    // GH-777 (slice 2): BOTH SIDES OF THE LINK, because an administrator reading this in
                    // a month needs to see which entry of the inputs list the run's own name was matched
                    // to. `water.ecw` is how the pass's gate names it; `samples.water` is where a person
                    // fills it in, and the list declares the second as a spelling of the first.
                    'declaredAs' => \App\Support\CalculationInputs::inputFor($input),
                    'cause' => match (true) {
                        $had === null => 'run-start-not-recorded',
                        $had === RunStart::UNDECLARED => 'input-not-in-list',
                        $had === RunStart::UNKNOWN => 'input-not-judged',
                        $had === true => 'input-did-not-arrive',
                        default => 'input-not-entered',
                    },
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
