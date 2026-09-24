<?php

namespace App\Support;

use Carbon\Carbon;

/**
 * GH-548 (stage 3) — WHAT THE SCREEN SAYS ABOUT THE NUMBERS IT IS SHOWING.
 *
 * The owner's decision of 22.09.2026: a re-run that does not complete leaves the
 * previous result on the screen with its own date, and the numbers do not stand
 * there silently — "it needs to be written somewhere that this is an old
 * calculation and that the calculation did not happen for such-and-such a
 * reason, and that it should be tried again".
 *
 * WHY THE TEXT IS BUILT HERE AND NOT IN THE BROWSER. The plan (section 8.3 p. 3)
 * put the reason-to-sentence map in `dashboard-ui.js` and the pill on the server.
 * That is two copies of the same map in two languages, and the failure this whole
 * question is about is one thing described in two places drifting apart. There is
 * one map, and it is this one: the server renders both the pill and the panel,
 * the browser displays what it is given and composes nothing. Named as a
 * divergence from the plan rather than taken silently.
 *
 * EVERYTHING HERE IS A FUNCTION OF THE PROJECTION — `AnalysisResults::forSite()`
 * — and of the site's own timezone. Nothing is read from the page, from a global
 * or from a browser copy: that is the rule this stage exists to satisfy, and a
 * notice assembled from the page would be describing whatever was open a moment
 * ago rather than the object it names (GH-459).
 */
final class AnalysisNotice
{
    /**
     * Failure codes the runner reports, and what each one says to a person.
     *
     * The codes are the contract between `hub-persistence.js` and this file; the
     * sentences are only ever read here. A code with no entry still reaches the
     * screen — see `reasonText()` — because a reason we forgot to phrase is
     * still more use to the reader than a blank.
     */
    /**
     * GH-638 (link 11) — EACH CODE ALSO CARRIES ITS CLASS, and the class is what
     * decides whether pressing again can help.
     *
     * The classes are the plan's (`PLAN-calculation-inputs-RU.md`, 4.13 point 3):
     *
     *   `input-absent`    something the site does not have. Re-run cannot help.
     *   `setting-missing` something nobody entered. Re-run cannot help.
     *   `run-incomplete`  this attempt did not manage it. Re-run may.
     *   `answer`          the run computed an answer and the answer is "none".
     *   `not-recorded`    no cause was recorded at all (no code, so no entry).
     *
     * `NOTHING_A_RETRY_CAN_FIX` used to be a second list beside this one, with
     * `no-soil-sample` written into it by hand. It is derived from the class now,
     * so the panel's offer and a section's sentence cannot disagree about
     * whether to press again — they read the same field.
     *
     * The texts are unchanged and the codes are unchanged; `clientTexts()` still
     * hands the browser a flat code-to-sentence map, built from here, so the
     * browser has one source and no second copy.
     */
    private const REASONS = [
        'site-settings-unavailable' => ['class' => 'run-incomplete', 'text' => 'the site settings did not load, so the run was cancelled instead of computing on the form defaults'],
        'weather-unavailable' => ['class' => 'run-incomplete', 'text' => 'no weather data was available — the live service did not answer, and there was no cached or manually entered weather to use'],
        'calculation-error' => ['class' => 'run-incomplete', 'text' => 'the calculation stopped with an error'],
        'normals-timeout' => ['class' => 'run-incomplete', 'text' => 'the climate normals did not arrive in time'],
        'incomplete-result' => ['class' => 'run-incomplete', 'text' => 'the server refused the result as incomplete'],
        'rejected' => ['class' => 'run-incomplete', 'text' => 'the server refused the result'],
        'site-mismatch' => ['class' => 'run-incomplete', 'text' => 'the result did not belong to the site the run was started for'],
        'run-not-completed' => ['class' => 'run-incomplete', 'text' => 'the run did not finish inside its time budget'],
        'no-report' => ['class' => 'run-incomplete', 'text' => 'the run never reported back'],
        // GH-557 (section 15): the shape that produced Federal Golf's row.
        'climate-late' => ['class' => 'run-incomplete', 'text' => 'the climate data arrived after the steps that needed it had already run'],
        'disease-not-computed' => ['class' => 'run-incomplete', 'text' => 'the disease analysis it depends on was not computed'],
        'engine-error' => ['class' => 'run-incomplete', 'text' => 'the engine stopped with an error'],
        'pass-start-unknown' => ['class' => 'run-incomplete', 'text' => 'the run could not tell whether it finished before or after the weather arrived'],
        'values-not-computed' => ['class' => 'run-incomplete', 'text' => 'some values were not computed'],
        'schema-unavailable' => ['class' => 'run-incomplete', 'text' => 'the page was not given the declared form of a result'],
        // GH-588 (link 4) — THE TWO SOIL STATES, AND THEY MUST NOT READ
        // ALIKE. The first is a fact about the site and has one action: add a
        // sample. The third is a fact about this attempt and has a different
        // one: press again. A reader who cannot tell them apart will do the
        // wrong one, or neither.
        // GH-649 (analyst 4.12a / 4.12): the exhausted PGR window is an ANSWER —
        // the run computed one and the answer is "the window has run out". A
        // second press cannot change it, which is what the class says.
        //
        // `text` IS NULL ON PURPOSE, and this is the one entry where that is a
        // decision rather than an omission: the words are the owner's open item,
        // and until she answers, a section carrying this cause gives the page no
        // sentence and the page keeps the one it has. Writing a phrase here
        // myself is the thing the boundary forbids.
        'pgr-window-exhausted' => ['class' => 'answer', 'text' => null],
        'no-soil-sample' => ['class' => 'input-absent', 'text' => 'there is no soil sample for this site, so the soil and nutrition analysis was not computed. Add a soil test on the Data page'],
        'soil-sample-not-delivered' => ['class' => 'run-incomplete', 'text' => 'the soil sample data did not arrive in time'],
        // GH-586 (D6): the run was asked for a particular water sample and
        // could not use it. Two reasons, kept apart because they are different
        // facts: the sample is not on this site, or its list had not arrived.
        'water-sample-not-found' => ['class' => 'run-incomplete', 'text' => 'the water sample this run was asked for is not on this site'],
        'water-samples-not-loaded' => ['class' => 'run-incomplete', 'text' => 'the site\'s water samples had not loaded when the run needed them'],
        // GH-578: the pass waited the run's budget for the site's soil sample and
        // started without it. Not a refusal — the rest of the run is real.
        'soil-sample-not-loaded' => ['class' => 'run-incomplete', 'text' => 'the soil sample did not load in time, so the soil and nutrition analysis was not computed for this run'],
        // GH-573: written by the end-of-pass sweep in `hub-orchestrator.js` and
        // by the cascade adapter's own sweep — the run took this module on and
        // its result is not there.
        'engine-produced-nothing' => ['class' => 'run-incomplete', 'text' => 'that part of the analysis produced no result'],
        // GH-572: the code the withdrawn journal rule wrote. Kept because rows
        // recorded under it are still in the table; nothing writes it now.
        'engine-did-not-produce' => ['class' => 'run-incomplete', 'text' => 'the run reported a problem in that part of the analysis'],
    ];

    /**
     * What each family of numbers is called on screen.
     *
     * The reader is told "disease, forecast and stress were not computed", not
     * "diseaseRisk, topDisease, forecastPeak, peakDay, forecastDisease,
     * stressIndex, trendDirection were null" — seven storage keys naming three
     * things a person recognises.
     */
    private const METRIC_FAMILIES = [
        'diseaseRisk'       => 'disease',
        'topDisease'        => 'disease',
        'forecastPeak'      => 'forecast',
        'peakDay'           => 'forecast',
        'forecastDisease'   => 'forecast',
        'stressIndex'       => 'stress',
        'trendDirection'    => 'stress',
        'growthPotential'   => 'growth potential',
        'soilTemp'          => 'soil temperature',
        'weatherSource'     => 'weather',
        'irrigationNeed'    => 'irrigation',
        'irrigationDeficit' => 'irrigation',
        'timestamp'         => 'the run’s own timestamp',
    ];

    /**
     * GH-572 — WHAT A MODULE IS CALLED IN A SENTENCE A PERSON READS.
     *
     * `unComputed()` took the `step` out of `skipped` verbatim. For the three
     * steps GH-557 touched that word was already a person's word — disease,
     * forecast, stress — so nothing showed. For a module recognised out of the
     * journal it is whatever the module calls itself in its own `warn`, and the
     * panel printed "wear were not computed": an identifier, in a sentence, in
     * the wrong number.
     *
     * THE NAMES ARE NOT INVENTED HERE. `assets/dependency-graph.js` already
     * carries a `label` for every engine and the `computed.*` key it writes;
     * each value below is taken from the label of the engine that writes that
     * key, trimmed to the part that reads as a noun phrase.
     * `gh572-step-names-come-from-the-graph.test.js` checks every one of them against that
     * file, so the two cannot drift.
     *
     * The seven at the bottom have no engine of their own — they are the
     * orchestrator talking about itself, or about a step that is not a graph
     * node — and the test knows they have none, so a new module cannot quietly
     * acquire a made-up name here.
     *
     * A module that is in neither list is printed AS IT IS. Not blank, and not
     * replaced with something plausible: an unnamed module is a gap in this map
     * and the reader is better served by the identifier than by silence.
     */
    private const STEP_NAMES = [
        'wear'              => 'wear and recovery',
        'disease'           => 'disease',
        // 'forecast', not 'disease forecast', although the graph's label is
        // "Disease Forecast": `unComputed()` merges the names from `skipped`
        // with the families from `nulls`, and `METRIC_FAMILIES` calls the same
        // thing 'forecast'. Two spellings of one thing are two entries in the
        // list, and the sentence then reads "disease, disease forecast,
        // forecast and stress". The names in the two maps are one vocabulary.
        'forecast'          => 'forecast',
        'stress'            => 'stress',
        'stress-trajectory' => 'stress trajectory',
        'climate'           => 'climate',
        'dew'               => 'dew prediction',
        'shade'             => 'shade',
        'salinity'          => 'salinity penalty',
        'irrigation'        => 'irrigation',
        'pgr'               => 'PGR',
        'pre-emergent'      => 'pre-emergent timing',
        'tissue-corrective' => 'tissue',
        'mlsn'              => 'MLSN',
        'water'             => 'water quality',
        // No engine of their own.
        'cascade'           => 'the downstream engines',
        'canonical'         => 'site identity',
        'confidence'        => 'analysis confidence',
        'dmi'               => 'DMI risk',
        'engine'            => 'the analysis run',
        'isolated'          => 'the analysis run',
        'selective'         => 'the analysis run',
        'orchestrator'      => 'the analysis run',
    ];

    /**
     * GH-588: reasons a second press cannot change.
     *
     * A partial run normally ends by offering a re-run, and that offer is a
     * claim: press this and it may come out differently. For a site with no soil
     * sample it will not — the same absence produces the same result — and
     * sending someone round that loop is worse than saying nothing. What that
     * site needs is a soil test, and the reason says so.
     */
    private const CLASSES_A_RETRY_CANNOT_FIX = ['input-absent', 'setting-missing', 'answer'];

    /** The class of a code, or `not-recorded` when there is no code at all. */
    public static function classOf(?string $code): string
    {
        if ($code === null || $code === '') {
            return 'not-recorded';
        }

        return self::REASONS[$code]['class'] ?? 'run-incomplete';
    }

    /** Whether pressing again can change this outcome — derived, never listed. */
    public static function retryCanHelp(?string $code): bool
    {
        return ! in_array(self::classOf($code), self::CLASSES_A_RETRY_CANNOT_FIX, true);
    }

    /** How old a result may be before the panel mentions its age. */
    private const STALE_AFTER_DAYS = 2;

    /**
     * The sentence a failure is told in. `{when}` is " on Sep 22 14:03" or
     * empty, `{reason}` is one of the entries above.
     */
    private const FAILURE_FRAME = 'The re-run{when} did not complete: {reason}. Try Re-run again.';

    /** A code we have not phrased yet, still said out loud. */
    private const UNKNOWN_REASON = 'the run reported "{code}"';

    /**
     * GH-639 (link 11, plan 4.13 point 3 and 4.13b) — ONE SENTENCE ABOUT ONE
     * EMPTY SECTION, OR NOTHING IF THE SECTION IS NOT EMPTY.
     *
     * Three things decide it, and none of them is a page:
     *  - whether the section is empty: `AnalysisResults::producedSomething`, the
     *    server's own predicate, the same one it already uses. Four pages have
     *    four conditions today and they disagree — `computed.pgr` without `gdd`
     *    is produced here and empty on `/plan`; the page stops deciding.
     *  - which run to ask: `numbersRun`, the account of the row whose numbers
     *    are on screen (GH-638), never `lastRun`. A sentence built from the last
     *    ATTEMPT describes one run while standing under another's figures.
     *  - what happened: the cause recorded against the step that writes this
     *    key — not applicable, skipped, or a journal note carrying a code.
     *
     * WHAT IT DOES NOT DO: invent words. `text` is the sentence the one reasons
     * table already holds; where a code has no sentence yet, `UNWORDED` decides
     * what stands in, and where NO cause was recorded at all the answer is
     * `class: 'not-recorded'` with `text: null` — the words for that case are the
     * owner's, and this returns the fact rather than a phrase of mine.
     *
     * @return array{cause:?string,class:string,step:?string,module:?string,retry:bool,text:?string}|null
     */
    public static function section(string $key, ?array $projection): ?array
    {
        $computed = $projection['computed'] ?? null;
        $value = is_array($computed) ? ($computed[$key] ?? null) : null;
        if (AnalysisResults::producedSomething($value)) {
            return null;
        }

        $step = self::stepWriting($key);
        $code = self::causeRecordedFor($step, $projection['numbersRun'] ?? null);

        return [
            'cause'  => $code,
            'class'  => self::classOf($code),
            'step'   => $step,
            'module' => $step === null ? null : (self::STEP_NAMES[$step] ?? $step),
            'retry'  => $code === null ? false : self::retryCanHelp($code),
            'text'   => self::sectionText($code),
        ];
    }

    /**
     * GH-639 — WHICH STEP WRITES A SECTION, TAKEN FROM THE GRAPH.
     *
     * `assets/dependency-graph.js` already declares, for every engine, the
     * `computed.*` key it writes. That declaration is the source; nothing here
     * re-states it, because a hand-written copy goes stale on the day the graph
     * changes and says nothing about it. `gh639-the-step-comes-from-the-graph`
     * parses the same file in JavaScript and compares the two enumerations, so a
     * drift between this reading and the graph is red rather than silent.
     *
     * MEASURED BEFORE AND AFTER, and the gap this closes was found by asking:
     * reading the step from the KEY resolved 10 of the 17 declared consumer keys.
     * Reading it from the ENGINE the graph names, and from the declared
     * `assembledFrom` for the keys the producer builds, resolves 16. The one that
     * remains is `tissue`, whose engine is `tissue-engine` while the run warns
     * under `tissue-corrective` — a spelling neither declared source derives from
     * the other, named in the equality test rather than papered over.
     */
    private static function stepWriting(string $key): ?string
    {
        static $graphKeys = null;
        if ($graphKeys === null) {
            $graphKeys = self::stepsFromGraph();
        }

        // MEASURED, AND IT IS WHY THIS IS NOT A LOOKUP TABLE. The graph names
        // ENGINES (`pgr-module`), the run warns under STEP NAMES (`pgr`), and
        // `STEP_NAMES` is the vocabulary of the second.
        //
        // GH-641 (analyst 4.13v) — TWO WAYS, IN THIS ORDER, and neither is a list
        // kept here:
        //  1. the graph names an engine that writes `computed.<key>` — the step
        //     comes from THE ENGINE, by dropping its suffix, not from the
        //     spelling of the key. That is what closed `confidence` and
        //     `forecast`, whose keys the graph does not carry but whose steps the
        //     run warns under.
        //  2. the key is assembled by the row's producer, and the declared form
        //     of a result says out of which steps (`assembledFrom` in
        //     `analysis-result.schema.json`). Declaring those as a graph node's
        //     output would be a lie about the pass — the pass does not write
        //     them.
        //
        // A key neither path resolves gets NO step, and the equality test names
        // it. Nothing is restated in this file.
        $engine = $graphKeys[$key] ?? null;
        if ($engine !== null) {
            foreach (self::stepCandidates($key, $engine) as $candidate) {
                if (isset(self::STEP_NAMES[$candidate])) {
                    return $candidate;
                }
            }
        }

        $assembled = AnalysisResultSchema::stepsAssembling($key);
        if (is_array($assembled)) {
            // The first assembling step that `STEP_NAMES` knows. Several steps
            // with causes of their own show one — which one is a question of
            // words, and the analyst sends it to the owner at the first case.
            foreach ($assembled as $step) {
                if (isset(self::STEP_NAMES[$step])) {
                    return (string) $step;
                }
            }

            return null; // declared as assembled from nothing: honestly no step
        }

        foreach ([$key, self::kebab($key)] as $candidate) {
            if (isset(self::STEP_NAMES[$candidate])) {
                return $candidate;
            }
        }

        return null;
    }

    /**
     * The spellings a step may be known by, given the key and the engine the
     * graph names for it. Derived, in order of how directly it is declared.
     *
     * @return array<int,string>
     */
    private static function stepCandidates(string $key, string $engine): array
    {
        $parts = explode('-', $engine);
        $out = [$engine];
        if (count($parts) > 1) {
            $out[] = implode('-', array_slice($parts, 0, -1)); // `stress-trajectory-engine` -> `stress-trajectory`
            $out[] = $parts[0];                                 // `pgr-module` -> `pgr`
        }
        $out[] = $key;
        $out[] = self::kebab($key);

        return array_values(array_unique($out));
    }

    /** `stressTrajectory` -> `stress-trajectory`, the tree's other spelling. */
    private static function kebab(string $key): string
    {
        return strtolower((string) preg_replace('/(?<!^)[A-Z]/', '-$0', $key));
    }

    /**
     * The graph's own declaration, read once per process.
     *
     * @return array<string,string> `computed` key => the engine that writes it
     */
    private static function stepsFromGraph(?string $file = null): array
    {
        // The path is a parameter so the reading can be exercised against a
        // BROKEN graph: the reviewer's check for whether this is a reading or a
        // copy is to break the source and see whether the answer follows. A map
        // that survives its source being broken is a copy, whatever it is called.
        $file ??= base_path('../assets/dependency-graph.js');
        if (! is_file($file)) {
            // Said out loud rather than answered with an empty map: an empty map
            // would make every section `not-recorded` for a reason that has
            // nothing to do with the run.
            throw new \RuntimeException('the dependency graph is not where the composer expects it: '.$file);
        }

        $src = (string) file_get_contents($file);
        $out = [];
        // Each engine declares `id: '…'` and `outputs: [ … ]`. The step name is
        // the engine's key in the graph with the `-engine`/`-calculator` style
        // suffix dropped, which is what the orchestrator warns under.
        preg_match_all("/'([a-z0-9\-]+)':\s*\{[^}]*?outputs:\s*\[([^\]]*)\]/s", $src, $matches, PREG_SET_ORDER);
        foreach ($matches as $m) {
            $engine = $m[1];
            preg_match_all("/'computed\.([A-Za-z]+)'/", $m[2], $keys);
            foreach ($keys[1] as $key) {
                if (! isset($out[$key])) {
                    $out[$key] = $engine;
                }
            }
        }

        if (count($out) < 15) {
            throw new \RuntimeException('the composer read only '.count($out).' outputs from the dependency graph');
        }

        return $out;
    }

    /**
     * GH-639 — the cause recorded against a step, in the row whose numbers are
     * shown. Three places, in the order the plan gives them.
     */
    private static function causeRecordedFor(?string $step, ?array $numbersRun): ?string
    {
        if ($step === null || ! is_array($numbersRun)) {
            return null;
        }

        foreach (['notApplicable', 'skipped'] as $where) {
            foreach (($numbersRun[$where] ?? []) as $entry) {
                if (is_array($entry) && self::entryStep($entry) === $step && ($entry['reason'] ?? null)) {
                    return (string) $entry['reason'];
                }
            }
        }

        // A journal note the panel does not print (GH-573's `continue` stays):
        // this is the door those entries reach a sentence by.
        foreach (($numbersRun['notes'] ?? []) as $note) {
            if (! is_array($note) || self::entryStep($note) !== $step) {
                continue;
            }
            // GH-649: `data` may be an object or the JSON string the runner's
            // summariser produced. Measured on the bench, where the real pass
            // records the second shape.
            $code = self::reasonOfEntry($note);
            if ($code !== null) {
                return $code;
            }
        }

        return null;
    }

    /** The reason code of a journal entry, whichever shape its `data` has. */
    private static function reasonOfEntry(array $entry): ?string
    {
        $data = $entry['data'] ?? null;
        if (is_string($data) && $data !== '') {
            $decoded = json_decode($data, true);
            $data = is_array($decoded) ? $decoded : null;
        }
        $code = is_array($data) ? ($data['reason'] ?? null) : null;

        return is_string($code) && $code !== '' ? $code : null;
    }

    /** The step an account entry is about, however that entry spells it. */
    private static function entryStep(array $entry): ?string
    {
        $step = $entry['step'] ?? $entry['module'] ?? null;

        return $step === null ? null : (string) $step;
    }

    /**
     * GH-639 (plan 4.13b point 3) — WHAT IS PRINTED WHILE THE WORDS ARE NOT
     * WRITTEN, decided by ONE constant rather than by each page.
     *
     * `UNWORDED` has three possible values, the three the open item names:
     * `code` — say the code out loud, which is what `UNKNOWN_REASON` already
     * does; `interim` — a temporary sentence held in the reasons table and
     * marked as temporary; `legacy` — the page's old sentence, moved into the
     * table. The owner's answer changes this constant, not the pages. The tree
     * is effectively `code` today, so that is what stands here.
     *
     * A cause that was never recorded has no code to say, so this returns null
     * and the section carries its class. What a person reads in that case is a
     * sentence nobody has written yet, and writing one is not mine to do.
     */
    /**
     * GH-649 (analyst 4.12a, and it comes FIRST in her order for a reason) — a
     * code with no words yet gives the page NOTHING, and the page keeps printing
     * what it printed.
     *
     * `code` was the third value here, and it meant "say the code out loud". The
     * moment a recorded cause reaches a section — which is what the PGR note is
     * about to do — that value puts `the run reported "pgr-window-exhausted"` in
     * front of a client. The coordinator's rule has no edge: no technical
     * identifier anywhere. So `code` is REMOVED from the allowed values, not
     * merely unselected, and `null` is what a wordless cause answers with. The
     * page then falls back to the sentence it already had (`plan-ui.js`,
     * `WAS_PRINTED_BEFORE`), so nothing a person reads changes.
     *
     * The two values that remain are the two that involve words somebody wrote:
     * `interim`, a temporary sentence held in the table and marked as temporary,
     * and `legacy`, the page's old sentence moved into the table. Choosing between
     * them is the owner's; until then, `none`.
     */
    private const UNWORDED = 'none';

    private const UNWORDED_ALLOWED = ['none', 'interim', 'legacy'];

    private static function sectionText(?string $code): ?string
    {
        if ($code === null) {
            return null;
        }

        $text = self::REASONS[$code]['text'] ?? null;
        if ($text !== null) {
            return $text;
        }

        // No words yet: the section carries its class and the page keeps its own
        // sentence. Saying the code here is what the rule forbids.
        return null;
    }

    /**
     * The same map and the same sentence, handed to the browser.
     *
     * The opener needs to name a failure THE MOMENT it happens — the page does
     * not reload on a failed run (GH-547), so waiting for the server-rendered
     * panel would mean the person who pressed the button is the one who does not
     * see why it did nothing. It gets the words from here rather than keeping a
     * second copy of them in JavaScript: a map in two languages is two maps, and
     * one of them drifts.
     *
     * @return array<string,mixed>
     */
    public static function clientTexts(?array $projection = null): array
    {
        // GH-638: the browser gets the sentences, flat, exactly as it always
        // did — the classes are the server's business and travelling would make
        // them a second reader of the same decision.
        return [
            // GH-649: only codes that HAVE words travel. A code whose sentence is
            // still the owner's would arrive as `null`, the opener would find
            // nothing for it and fall back to its frame around the raw code — an
            // identifier on screen by the back door. Such a code cannot be a run's
            // failure reason anyway: its class is `answer`, so the run completed
            // and the cause lives in the journal rather than in `reason`.
            'reasons' => array_map(
                fn (array $reason) => $reason['text'],
                array_filter(self::REASONS, fn (array $reason) => $reason['text'] !== null)
            ),
            'frame'   => self::FAILURE_FRAME,
            'unknown' => self::UNKNOWN_REASON,
            // GH-640 (link 11, plan 4.13 point 4) — THE SENTENCES FOR EMPTY
            // SECTIONS, COMPOSED ON THE SERVER AND SENT WITH THE NUMBERS.
            //
            // One door, and it is this one: the texts ride in the same HTML
            // response as the figures, so "the numbers arrived and the words did
            // not" cannot happen. A page that draws a section without this
            // partial is a defect, and a test says which templates must include
            // it.
            //
            // The universe is the schema's declared consumer keys — not a list
            // of "sections that can be empty" written here — so a section the
            // composer cannot place still gets an answer rather than silence.
            'sections' => self::sections($projection),
        ];
    }

    /**
     * GH-640 — every declared consumer key, answered.
     *
     * `null` for a section that has numbers; an answer for one that does not.
     * The page prints what it is given and no longer decides emptiness itself
     * (plan 4.13b point 2).
     *
     * @return array<string,?array<string,mixed>>
     */
    public static function sections(?array $projection): array
    {
        $out = [];
        foreach (AnalysisResultSchema::consumerKeys() as $key) {
            $out[$key] = self::section($key, $projection);
        }

        return $out;
    }

    /**
     * The topbar pill, ready to print.
     *
     * It used to be written twice: once here by the composer and again by two
     * separate pieces of JavaScript that re-derived it from `analyzedAt` after
     * the page had loaded. The JavaScript could only ever say the date, so on a
     * failed run it quietly overwrote the mark the server had put there.
     */
    public static function pill(?array $projection, ?string $timezone = null): string
    {
        $stamp = self::stamp($projection['analyzedAt'] ?? null, $timezone);
        $label = 'Analysis: '.($stamp ?? '—');

        if (self::failed($projection)) {
            $label .= ' · re-run failed';
        } elseif (self::partial($projection)) {
            // GH-557: a third state needs a third word. "failed" would be wrong
            // — the run finished and produced numbers — and saying nothing is
            // what let a partial run pass for a complete one.
            $label .= ' · re-run incomplete';
        }

        return $label;
    }

    /**
     * The panel, or null when there is nothing to say.
     *
     * @return array{level:string,text:string}|null
     */
    public static function panel(?array $projection, ?string $timezone = null): ?array
    {
        $stamp   = self::stamp($projection['analyzedAt'] ?? null, $timezone);
        $hasData = $projection !== null && ! empty($projection['metrics']);
        $failure = self::failed($projection) ? self::failureSentence($projection, $timezone) : null;

        // Never analysed. The outcome is stated rather than filled in with
        // anything: an empty screen and an old screen must not look alike.
        if (! $hasData) {
            $text = 'No analysis has been run for this site yet.';
            $text .= $failure ? ' '.$failure : ' Press Re-run to produce one.';

            return ['level' => 'warning', 'text' => $text];
        }

        // Numbers are on the screen and the last attempt to replace them failed.
        if ($failure) {
            return [
                'level' => 'warning',
                'text'  => 'Showing the analysis from '.$stamp.'. '.$failure,
                'details' => self::warningLines($projection),
            ];
        }

        // GH-557: or it finished and could not compute part of the result.
        if (self::partial($projection)) {
            $showingOwn = ($projection['numbersFrom'] ?? null) === 'partial';

            return [
                'level'   => 'warning',
                'text'    => ($showingOwn ? '' : 'Showing the analysis from '.$stamp.'. ')
                             .self::partialSentence($projection, $timezone),
                'details' => self::warningLines($projection),
            ];
        }

        $age = self::ageInDays($projection['analyzedAt'] ?? null);
        if ($age !== null && $age > self::STALE_AFTER_DAYS) {
            return [
                'level' => 'warning',
                'text'  => 'Analysis data is '.$age.' days old — re-run for the latest conditions.',
            ];
        }

        return null;
    }

    /**
     * GH-581 (stage 2) — WHAT THE RUN WENT AHEAD ON, in words.
     *
     * A tier-1 identity key that was not supplied is filled with an "unknown"
     * value and the run continues. That is the right behaviour and it was
     * invisible: the assumption reached `console.warn` and the forensic report,
     * and the stored result said nothing, so numbers computed on a real rootzone
     * and numbers computed on "unknownProfile" looked identical on screen.
     *
     * IT IS NOT NEGATIVE SPACE. An assumption is not a `null`, not a skipped
     * step and not a failure — the run produced everything it was asked for,
     * standing on a stand-in for one of its inputs. So it is returned
     * separately, printed separately, and never counted into "what was not
     * computed": folding it in would tell a reader that something is missing
     * when nothing is.
     *
     * AND IT IS SHOWN ON A COMPLETE RUN TOO — that is the case it exists for.
     * A partial run already says something; a complete run standing on a
     * stand-in says nothing else at all.
     *
     * Where there is a field to change, the sentence says where. Where the key
     * is derived — climate regime from latitude, intent from turf type — there
     * is no field and the sentence does not invent one; sending somebody to a
     * screen with no such control is worse than saying nothing.
     *
     * @return array<int,string>
     */
    public static function assumptions(?array $projection): array
    {
        $out = [];

        foreach ((array) ($projection['lastRun']['assumptions'] ?? []) as $a) {
            if (! is_array($a) || empty($a['displayName'])) {
                continue;
            }
            $line = $a['displayName'].' is not set';
            if (! empty($a['assumedValue'])) {
                $line .= ' — the analysis ran on "'.$a['assumedValue'].'"';
            }
            if (! empty($a['settingsLabel'])) {
                $line .= '. Set it in '.$a['settingsLabel'].'.';
            }
            $out[] = $line;
        }

        return $out;
    }

    /**
     * Everything the pass said, for the panel's "details".
     *
     * GH-557: seven explanations were produced per run and reached a console
     * nobody had open. They belong where somebody would look for them — under
     * the sentence that says something is missing — and as they were written,
     * not summarised, because the summary is the sentence above them.
     *
     * @return array<int,string>
     */
    private static function warningLines(?array $projection): array
    {
        $out = [];
        foreach ((array) ($projection['lastRun']['warnings'] ?? []) as $w) {
            if (! is_array($w) || empty($w['message'])) {
                continue;
            }
            // GH-573: a receipt for work that SUCCEEDED does not belong under a
            // heading that says something is missing. The specimen's journal
            // held two records — one reporting an obstruction, one saying a
            // disease result had been written with ten diseases and a top risk
            // of 69 — and the reader was shown both as though both were the
            // trouble. They are told apart by the `level` the producer stamps
            // (GH-570), which is a field, not a phrase: `warn` writes `problem`,
            // `note` writes `info`. A record from before the field has no level
            // and is still printed, because nothing here knows better about it.
            if (($w['level'] ?? null) === 'info') {
                continue;
            }
            $module = ! empty($w['module']) ? '['.$w['module'].'] ' : '';
            $data   = ! empty($w['data']) && is_scalar($w['data']) ? ' — '.$w['data'] : '';
            $out[]  = $module.$w['message'].$data;
        }

        return $out;
    }

    /** The reason in words, for a code the runner sent. */
    public static function reasonText(?string $code, $detail = null): string
    {
        $code = $code ?: 'run-not-completed';
        // An unknown code is printed as it is. A sentence we have not written
        // yet is a gap in this file, not a reason to show nothing.
        $text = self::REASONS[$code]['text'] ?? str_replace('{code}', $code, self::UNKNOWN_REASON);

        $extra = self::detailText($code, $detail);

        return $extra ? $text.' ('.$extra.')' : $text;
    }

    private static function failed(?array $projection): bool
    {
        return ($projection['lastRun']['outcome'] ?? null) === 'failed';
    }

    private static function partial(?array $projection): bool
    {
        return ($projection['lastRun']['outcome'] ?? null) === 'partial';
    }

    /**
     * The families a partial run could not compute, in the order the schema
     * lists their keys, each named once.
     *
     * @return array<int,string>
     */
    private static function unComputed(?array $projection): array
    {
        $run   = $projection['lastRun'] ?? [];
        $names = [];

        foreach ((array) ($run['skipped'] ?? []) as $step) {
            $key = is_array($step) ? ($step['step'] ?? null) : null;
            if (! $key) {
                continue;
            }
            // GH-572: the module's word for itself is not the reader's word for
            // it. An identifier with no entry is printed as it is.
            $name = self::STEP_NAMES[$key] ?? (string) $key;
            if (! in_array($name, $names, true)) {
                $names[] = $name;
            }
        }
        foreach ((array) ($run['nulls'] ?? []) as $key) {
            $name = self::METRIC_FAMILIES[$key] ?? (is_string($key) ? $key : null);
            if ($name && ! in_array($name, $names, true)) {
                $names[] = $name;
            }
        }

        return $names;
    }

    /** "disease, forecast and stress" — a list a person reads, not an array. */
    private static function listOut(array $names): string
    {
        if (! $names) {
            return 'some values';
        }
        if (count($names) === 1) {
            return $names[0];
        }
        $last = array_pop($names);

        return implode(', ', $names).' and '.$last;
    }

    /**
     * What a partial run says, and it depends on whether there is anything else
     * to show.
     */
    private static function partialSentence(?array $projection, ?string $timezone): string
    {
        $run    = $projection['lastRun'] ?? [];
        $when   = self::stamp($run['completedAt'] ?? $run['failedAt'] ?? null, $timezone);
        $what   = self::listOut(self::unComputed($projection));
        $reason = self::reasonText($run['reason'] ?? null, null);

        // GH-572: and it agrees in number. "wear and recovery were not
        // computed" is the same defect as the identifier was — a sentence
        // assembled for a machine — one layer further in.
        $wasWere = count(self::unComputed($projection)) === 1 ? 'was' : 'were';

        // GH-588 — AND WHETHER PRESSING AGAIN IS WORTH ANYTHING.
        //
        // Every partial sentence ended by suggesting a re-run, which is true of
        // a delivery that failed and false of a site that has no soil sample:
        // there, pressing again produces the identical result, and the person is
        // sent round a loop by their own product. The reason says which kind it
        // is, and the sentence ends accordingly — that difference is the point
        // of this ticket, and if the two ever read alike again the work is
        // undone.
        $retryChanges = self::retryCanHelp($run['reason'] ?? null);
        $isPartial = ($projection['numbersFrom'] ?? null) === 'partial';

        // The numbers on screen are this very run's — nothing older exists.
        if ($isPartial) {
            return 'This analysis is incomplete: '.$what.' '.$wasWere.' not computed ('.$reason.').'
                .self::retryOffer($retryChanges, true);
        }

        return 'The re-run'.($when ? ' on '.$when : '').' finished without '.$what.': '
            .$reason.'. The numbers below are from the last complete analysis.'
            .self::retryOffer($retryChanges, false);
    }

    /**
     * GH-594 — THE OFFER TO PRESS AGAIN, DECIDED AND WORDED IN ONE PLACE.
     *
     * It used to be two ternaries with two literals inline, and that shape cost
     * a test its meaning twice over. The first version of the case checked for
     * the word "again", which only ONE of the two wordings carries. The second
     * took its vocabulary from the source text of those ternaries — better, but
     * it could only see offers written in that exact shape, and the reviewer's
     * mutation appended a third one plainly (`$s .= ' Press Re-run.';`) and went
     * unseen again.
     *
     * So the offer is a DECISION with a return value. A test asks this function
     * what it says when the answer is yes and when it is no, instead of reading
     * how the sentence is spelled — and because both wordings come from here,
     * the caller's sentence must END with what this returns, which is what makes
     * anything appended afterwards visible.
     *
     * Nothing is offered when pressing again changes nothing: an empty string,
     * for both shapes, and that is asserted rather than assumed.
     */
    private static function retryOffer(bool $retryChanges, bool $isPartial): string
    {
        if (! $retryChanges) {
            return '';
        }

        return $isPartial ? ' Re-run to complete it.' : ' Try Re-run again.';
    }

    private static function failureSentence(?array $projection, ?string $timezone): string
    {
        $run  = $projection['lastRun'] ?? [];
        $when = self::stamp($run['failedAt'] ?? null, $timezone);

        return str_replace(
            ['{when}', '{reason}'],
            [$when ? ' on '.$when : '', self::reasonText($run['reason'] ?? null, $run['detail'] ?? null)],
            self::FAILURE_FRAME,
        );
    }

    /** @param mixed $detail */
    private static function detailText(string $code, $detail): ?string
    {
        if (! is_array($detail)) {
            return null;
        }

        if ($code === 'calculation-error' && ! empty($detail['message'])) {
            return (string) $detail['message'];
        }

        // GH-554 (reviewer's finding on GH-553): the names, not just the code.
        //
        // The server collects the missing keys and answers with them, the runner
        // puts them in `detail.keys`, and the screen printed "HTTP 422" — the
        // list travelled the whole way and stopped at the last step. A message
        // that says something is wrong without saying what is a message nobody
        // can act on, and the list is the only reason the server assembles one.
        if ($code === 'incomplete-result') {
            $keys = array_values(array_filter(
                (array) ($detail['keys'] ?? []),
                fn ($k) => is_string($k) && $k !== '',
            ));
            $status = ! empty($detail['status']) ? 'HTTP '.$detail['status'] : null;

            if ($keys) {
                return trim(($status ? $status.', ' : '').'missing: '.implode(', ', $keys));
            }

            // No list. This is a real and distinguishable state rather than a
            // tidier way of saying the same thing: a browser running the bundle
            // from before GH-553 sends a short body, is refused, and reports the
            // refusal WITHOUT the names. Printing "HTTP 422" for both would make
            // the old client and the new one read identically on screen, which
            // is exactly the case somebody would be trying to tell apart.
            return trim(($status ? $status.', ' : '').'the server did not name the missing values');
        }

        if ($code === 'rejected' && ! empty($detail['status'])) {
            return 'HTTP '.$detail['status'];
        }

        if ($code === 'site-settings-unavailable' && ! empty($detail['reason'])) {
            return (string) $detail['reason'];
        }

        return null;
    }

    private static function stamp(?string $iso, ?string $timezone): ?string
    {
        if (! $iso) {
            return null;
        }

        try {
            return Carbon::parse($iso)->setTimezone($timezone ?: 'UTC')->format('M j H:i');
        } catch (\Throwable $e) {
            return null;
        }
    }

    private static function ageInDays(?string $iso): ?int
    {
        if (! $iso) {
            return null;
        }

        try {
            return (int) floor(Carbon::parse($iso)->diffInRealSeconds(Carbon::now(), false) / 86400);
        } catch (\Throwable $e) {
            return null;
        }
    }
}
