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
        /**
         * GH-781 (delivery 6 and 7) - TWO CAUSES ON OUR SIDE, WITH THE OWNER'S OWN SENTENCE.
         *
         * Her words, given on 30.09.2026 for both: "{Module} was not calculated in this analysis. If this
         * continues, contact us." - the same phrase she approved on 24.09 for a run whose data was there and
         * did not arrive. The text is composed rather than fixed, because `{Module}` is the module of the
         * SECTION a person is looking at: `section()` takes it from the graph through `stepWriting`, so it is
         * never a producer's name and never this file's own word.
         *
         * `cascade-pass-not-run` means NO ACCEPTED PASS, not "no event": a cascade may have run three times and
         * produced nothing all three. `pass-not-finished-at-write` means a pass of some producer had not
         * finished when the row was assembled, so its half of the account may be short.
         */
        'cascade-pass-not-run' => ['class' => 'run-incomplete', 'text' => null, 'composed' => true,
            'sectionOnly' => true],
        'pass-not-finished-at-write' => ['class' => 'run-incomplete', 'text' => null, 'composed' => true,
            'sectionOnly' => true],
        /**
         * GH-795 (queue item 3vae) — TWO REASONS OF OURS ABOUT THE SAMPLE A RUN WAS GIVEN.
         *
         * `sample-not-named`: the run asked the server which sample to compute and the request failed, so
         * nothing was computed for that section. It is NOT "no test has been entered" -- the site may hold
         * one -- which is why it is a cause of ours and carries the owner's general sentence rather than the
         * input list's.
         *
         * `tissue-sample-not-loaded`: a tissue sample WAS named and did not reach the store, or reached it
         * carrying no reading the map recognises. The soil side of that has said so since GH-612, under
         * `soil-sample-not-loaded`, which keeps its own earlier wording; this one composes.
         */
        'sample-not-named' => ['class' => 'run-incomplete', 'text' => null, 'composed' => true,
            'sectionOnly' => true],
        'tissue-sample-not-loaded' => ['class' => 'run-incomplete', 'text' => null, 'composed' => true,
            'sectionOnly' => true],
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
        // GH-675 (queue item 4, slice 1) — THE TWO CASES THE OWNER NAMED, AND THE
        // THIRD THE DEVICE NEEDS.
        //
        // Her words: "the data was there but somehow did not get into the
        // calculation -- that is OUR problem", against "there was no data, so that
        // part was not calculated". They get different sentences because they are
        // different facts about the client's own work.
        //
        // `input-not-entered` carries NO TEXT yet on purpose: its sentence needs the
        // human name of the input, and the `label` field of the inputs list is the
        // owner's draft. A section with this cause keeps the phrase the page already
        // prints until she gives the words -- the same shape `pgr-window-exhausted`
        // has (GH-649). `text: null` is a decision here, not an omission, and the
        // case in `Gh638` asserts that only an `answer` may be wordless, so this one
        // is named there by its class.
        //
        // GH-777 (queue item 4) -- AND IT WAS NOT IN THIS TABLE AT ALL. The comment above described
        // an entry nobody had written: the judge has been filing `input-not-entered` since GH-675,
        // and measured, `classOf` answered `run-incomplete` for it -- our side, a re-run may fix it --
        // while the fact is that the client has not entered the value, which a re-run cannot fix.
        // `reasonText` answered `the run reported "input-not-entered"`, a technical identifier in
        // front of a client. It is declared now, in the class the owner's second sentence belongs to
        // (`input-absent`, the class `no-soil-sample` already carries) and still wordless.
        // GH-777 (queue item 4, the analyst's 76.4 A and B) — TWO CAUSES THAT WERE BORROWING OTHER
        // CAUSES' SENTENCES.
        //
        // `input-not-in-list`: the run named an input the inputs list does not declare. It used to be
        // filed as `run-start-not-recorded`, which states that the start was not recorded while it
        // was — the shape of a timer named as an event. The broken link is between the run's
        // vocabulary and the list, and that is ours.
        //
        // `input-not-judged`: the input's value lives in a storage the server cannot read. It used to
        // be filed as `input-not-entered`, which tells a client it entered nothing; measured on the
        // stand, 5 of 21 sites carry a soil texture override in the column of `sites` and 2 carry
        // their PGR application only in the spray log.
        //
        // BOTH CARRY NO TEXT, for the reason `input-not-entered` above carries none: the sentence a
        // client reads is the owner's, and for our-side causes her words are the general phrase of
        // 24.09.2026 — «{Module} was not calculated in this analysis. If this continues, contact us.»
        // The two sentences already in this table for our side say «the data was there but did not
        // reach this analysis», and neither of these two knows that. Writing a third phrase would be
        // my words in front of a client, so the class travels, the administrator sees the code in
        // `Details`, and the page keeps the sentence it already prints.
        'input-not-entered' => ['class' => 'input-absent', 'text' => null, 'wordsFrom' => 'owner'],
        'input-did-not-arrive' => ['class' => 'run-incomplete',
            'text' => 'the data was there but did not reach this analysis. If this continues, contact us'],
        'run-start-not-recorded' => ['class' => 'run-incomplete',
            'text' => 'the data was there but did not reach this analysis. If this continues, contact us'],
        'input-not-in-list' => ['class' => 'run-incomplete', 'text' => null, 'wordsFrom' => 'owner'],
        'input-not-judged' => ['class' => 'run-incomplete', 'text' => null, 'wordsFrom' => 'owner'],
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
        // GH-734: the run no longer computes the soil temperature on a construction nobody chose or
        // on a moisture nobody measured, and says which of the two it lacked. BOTH SENTENCES ARE
        // DRAFTS awaiting the owner's words, written by the analyst in the form of the texts above:
        // they name what is absent and where it is filled in, and suggest no value.
        'setting-missing' => ['class' => 'setting-missing', 'text' => 'no construction type is set for this site, so the soil temperature was not computed. Set it in Settings, Turf profile'],
        'soil-moisture-unavailable' => ['class' => 'run-incomplete', 'text' => 'the weather data for this run carried no soil moisture, so the soil temperature was not computed'],
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
        // GH-734: the run notes a skip under this module when no construction type is
        // set and when the weather carried no soil moisture, and `gh572` went red
        // naming it -- a module warned under with no word here is printed as its own
        // identifier. The word is the graph's label for `soil-temp-physics`, as every
        // other word in this map is the label of the engine that writes the key.
        'soil-temp-physics' => 'soil temperature',
        'dew'               => 'dew prediction',
        'shade'             => 'shade',
        'salinity'          => 'salinity penalty',
        'irrigation'        => 'irrigation',
        'pgr'               => 'PGR',
        'pre-emergent'      => 'pre-emergent timing',
        'tissue-corrective' => 'tissue',
        'mlsn'              => 'MLSN',
        'water'             => 'water quality',
        /**
         * GH-781 (delivery 2) — THE SIX ENGINES OF THE CASCADE THAT HAD NO WORD HERE.
         *
         * Until now the cascade's account of what it could not produce never reached a stored row: the next
         * pass of the orchestrator wiped the journal (`runComputePass`, GH-557). Delivery 3 makes those
         * records survive, and a module recorded with no word here is printed to a person as its own
         * identifier -- which is what `gh572` reddens on. The words come from each node's `label` in the
         * dependency graph, as every other entry of this map does, with the engine suffix dropped: the graph
         * names an ENGINE, this map names the thing a person reads about.
         */
        'soilStructure'     => 'soil structure',
        'phytotoxicity'     => 'phytotoxicity',
        'firmness'          => 'firmness',
        'nitrogen'          => 'nitrogen programme',
        'traffic'           => 'traffic',
        'turfManager'       => 'turf manager',
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
    /**
     * GH-777 (queue item 4) — A CAUSE OF A SECTION WHOSE SENTENCE IS THE OWNER'S, DECLARED.
     *
     * Until now the table had one shape for a wordless cause — class `answer` — and `Gh638` held that
     * rule: anything else without a sentence is an omission rather than a decision. That rule was
     * right and it is kept; what it did not have a name for is the shape slice 1 of this item created.
     * The judge writes three causes about an INPUT, and each sentence needs the input's human name,
     * which is the owner's draft (`label`, her words, section 49 of the analyst's plan). So they carry
     * no text on purpose, and the mark says so instead of leaving the gap to look like forgetfulness.
     *
     * WHAT THE MARK BUYS, and both are properties a guard can hold:
     *   - a marked cause MUST have no text, so the mark cannot hide a sentence somebody wrote;
     *   - a marked cause is a SECTION cause and never a run's `reason`. It therefore never reaches the
     *     panel or the opener, which is what keeps the raw code off a client's screen: `clientTexts`
     *     already drops a code with no sentence, and the opener would otherwise frame the identifier.
     *
     * The mark leaves with the words: when she gives the sentence, the text replaces the mark.
     */
    public const WORDS_FROM_THE_OWNER = 'owner';

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
    /** Is this cause one whose sentence is still the owner's, declared in the table? */
    public static function awaitsHerWords(?string $code): bool
    {
        return ($code !== null ? (self::REASONS[$code]['wordsFrom'] ?? null) : null) === self::WORDS_FROM_THE_OWNER;
    }

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
    /**
     * GH-742 - the word for a step, and for the soil step it is the site's methodology.
     *
     * Both readers of `STEP_NAMES` go through this, so the two cannot drift: the reviewer's
     * condition for this item was that it be checked on BOTH, not on one.
     */
    private static function stepName(string $step, ?array $projection): string
    {
        if ($step === 'mlsn') {
            /**
             * GH-742 (reviewer's return): the word is the site's methodology, and where no declared
             * methodology names the site it is the list's word for that case. It was this map's own
             * word, `MLSN`, which is the name of a methodology - so a site with none, and a site
             * carrying a value this project never declared, were both told a methodology they are
             * not set to. The entry below stays as the last resort and as the graph's own word for
             * the engine; while the list carries its word, nothing reaches it by this branch.
             */
            $label = CalculationInputs::methodologySoilStepLabel(
                is_array($projection) ? ($projection['methodology'] ?? null) : null
            );
            if ($label !== null) {
                return $label;
            }
        }

        return self::STEP_NAMES[$step] ?? $step;
    }

    public static function section(string $key, ?array $projection): ?array
    {
        $computed = $projection['computed'] ?? null;
        $value = is_array($computed) ? ($computed[$key] ?? null) : null;
        // GH-667: the key travels with the value, so the one predicate can read the
        // marker the result form declares for it. No condition about soil lives
        // here — the composer asks the same question for every section.
        if (AnalysisResults::producedSomething($value, $key)) {
            return null;
        }

        $step = self::stepWriting($key);
        $code = self::causeRecordedFor($step, $projection['numbersRun'] ?? null);

        return [
            'cause'  => $code,
            'class'  => self::classOf($code),
            'step'   => $step,
            /**
             * GH-742 (queue item 3ad) - THE SOIL STEP IS NAMED BY THE SITE'S METHODOLOGY.
             *
             * `STEP_NAMES['mlsn']` is keyed on the name of the STEP, so every site was told `MLSN`
             * whatever its settings said -- measured on the stand, eight of thirteen are set to
             * something else. The owner's decision, in her words: print the methodology that is in
             * the settings and that the calculation ran under.
             *
             * The name comes from the one place that owns it, and the KEY from the one place that
             * owns that: `config.turf.methodology`, carried here by the projection. A site with no
             * methodology keeps the step's own word, because a site that has not finished its wizard
             * has no methodology to name and nothing is invented for it.
             */
            'module' => $step === null ? null : self::stepName($step, $projection),
            'retry'  => $code === null ? false : self::retryCanHelp($code),
            /**
             * GH-792 (queue item 79): THE THIRD CASE OF AN EMPTY SECTION HAS WORDS NOW, AND THEY ARE HERE.
             *
             * Two of the three were already this composer's: a recorded cause gives the cause's sentence, and
             * a site that has never been analysed gives one sentence for every section. The third -- there was
             * an analysis and no cause was recorded -- was left to the pages, and each of the seven held its
             * own: twenty-five places in seven files, three of them sending a person to a "Hub" that is not
             * part of the product and eleven telling them to run an analysis that had already run. The words
             * below are the owner's, approved on 29.09.2026 by number; the pages print this answer.
             */
            'text'   => self::sectionText($code, $step, $projection['numbersRun'] ?? null, $projection)
                ?? self::wordsWithoutARecordedReason($key, $projection),
        ];
    }

    /**
     * GH-792 (queue item 79) — THE WORDS OF AN EMPTY SECTION WHEN NO CAUSE WAS RECORDED.
     *
     * One table, by place, and the pages hold none of it. Each entry is the owner's approved sentence for that
     * place (decision of 29.09.2026, by the numbers of her list). A place she decided not to change keeps its
     * old sentence, moved here word for word -- so that no page is left holding one.
     *
     * WHAT IS NOT HERE: the headings. "No Water Balance Data" and its like are correct and her edits were to
     * the advice under them, so the pages keep their headings and take the body from this table.
     *
     * @var array<string,string>
     */
    /**
     * GH-792: what a section says on a site that has never been analysed. The panel's own sentence adds
     * "Press Re-run to produce one." after it, which belongs to a panel rather than to a section of a page.
     */
    private const NEVER_ANALYSED_SECTION = 'No analysis has been run for this site yet.';

    private const WORDS_WITHOUT_A_REASON = [
        // Her numbers 1 and 2: the soil section as a whole, and its nutrient list.
        'soilNutrition' => 'No soil & nutrition results for this site yet. Add a soil test on the Data page.',
        'soilNutrition.nutrients' => 'No soil & nutrition results for this site yet. Add a soil test on the '
            .'Data page.',
        // Her number 3.
        'soilNutrition.annualRequirements' => 'Annual nutrient requirements were not calculated for the '
            .'latest analysis.',
        // Her number 4.
        'tissue' => 'Add a tissue test on the Data page to see tissue results.',
        // Her number 5.
        'waterBalance' => 'No water balance results for this site yet. Add a water test on the Data page.',
        // Her number 7.
        'stress' => 'No stress index for this site in the latest analysis.',
        // Her number 8.
        'disease' => 'No disease risk for this site in the latest analysis.',
        // Her number 11.
        'soilTempPhysics' => 'The soil temperature profile is not available for the latest analysis.',
        // Her number 12.
        'growthLight.recommendations' => 'No recommendations for the latest analysis.',
        // Her number 13.
        'preEmergent' => 'No pre-emergent timing for the latest analysis.',
        /**
         * HER NUMBERS 14 AND 16 ARE NOT HERE, and the reason is measured rather than chosen.
         *
         * Her decision is that those two sentences do not change, and both carry a LINK -- to Data → Spray Log
         * and to Settings → Traffic & Wear. The channel to a page is escaped (`esc(answer.text)` in
         * `plan-ui.js`), so a sentence carrying an anchor cannot travel through it unchanged: word for word it
         * would print the anchor as visible characters, and without the anchor it would not be her words. What
         * stood here for a while was a paraphrase of mine -- caught by the reviewer's mutation, because no
         * record of hers carries it. The two sentences stay on the page, named as a boundary, and the question
         * is hers to answer.
         */
        // Her number 17.
        'wear' => 'No wear forecast for the latest analysis.',
        // Her number 22.
        'dashboard.panel' => 'No data for this panel in the latest analysis.',
        /**
         * AND THE PLACES SHE DECIDED NOT TO CHANGE. Their words move here exactly as they stood, so that no
         * page is left holding a sentence of its own -- which is the property this item is for. A page with
         * one sentence left is a page that will grow a second.
         */
        /**
         * TWO PLACES ARE NOT HERE, AND THE REASON IS A MEASUREMENT: neither was ever printed.
         *
         * The verdict card of the soil section draws only when its entry carries a `decision`, and the water
         * one only when it carries an `observation`; the `NO_DATA` entry of each carries neither, so the
         * sentence under those headings never reached a screen. They were literals with no reader. Declaring
         * words for a place nobody asks about would be the same fault one level up -- words nobody prints --
         * and the reviewer's own check names a declared place that no page asks for.
         */
        'disease.waterUse' => 'No water use data',
        // Word for word as the page printed it, tail included: "Dew forecast unavailable" alone was a
        // shortening of mine, and her decision was that the sentence does not change.
        'disease.dew' => 'Dew forecast unavailable — run analysis with live weather to populate.',
        'growthLight.climate' => 'No climate data available.',
    ];

    /**
     * The sentence for a place whose section is empty and whose run recorded no cause — or, for a site with no
     * analysis at all, the one sentence that says so.
     *
     * A place this table does not know gets `null` rather than a sentence invented for it: an empty section
     * with no approved words is a question for the owner, and answering it here would be answering for her.
     */
    private static function wordsWithoutARecordedReason(string $key, ?array $projection): ?string
    {
        /**
         * A SITE WITH NO ANALYSIS AT ALL gets the one sentence that says so.
         *
         * The signal is the run's own stamp rather than the presence of `metrics`. The panel asks about
         * `metrics` because it speaks about the NUMBERS on the screen; a section speaks about whether a run
         * happened, and a run that produced nothing for this section still happened. Measured on the
         * fixtures of five suites: a projection with `analyzedAt` and `status: complete` carries
         * `metrics => []`, and reading emptiness there would have told a person no analysis had ever run.
         */
        if ($projection === null || ($projection['analyzedAt'] ?? null) === null) {
            return self::NEVER_ANALYSED_SECTION;
        }

        return self::WORDS_WITHOUT_A_REASON[$key] ?? null;
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
        /**
         * GH-777 (queue item 4, slice 2) — THE DECLARED NAME FIRST, AND THE OLD GUESS ONLY WHERE NOTHING
         * IS DECLARED YET.
         *
         * A node that declares `module` answers with it: one spelling for the pass, the sweep and this
         * composer, and no derivation to go wrong. Fourteen nodes declare it — the twelve of the pass
         * plus the two the row producer writes under (`mlsn`, `water`) — which is the set the analyst
         * measured from the calls.
         *
         * The ladder below is what the rest still stand on: the cascade's six, the tissue engine and the
         * page nodes have no `module` yet, and it arrives with their own gate in slice 3. Removing it now
         * would have answered `pgr-module` for the PGR section and `tissue-engine` for tissue -- names no
         * journal writes -- and those sections would have lost their sentence. Measured: with the ladder
         * gone, 19 server cases went red.
         */
        $named = $graphKeys[$key] ?? null;
        if (is_array($named) && $named['module'] !== null) {
            return $named['module'];
        }
        $engine = is_array($named) ? $named['id'] : null;
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
        /**
         * GH-678 (queue item 6, place 3) — READ FROM THE GRAPH'S DATA, NOT PARSED OUT OF
         * THE SCRIPT'S TEXT.
         *
         * This used to `preg_match_all` over `assets/dependency-graph.js`, matching the
         * engine literals that file carried. The facts moved into
         * `assets/dependency-graph.json` (GH-676) and the literals went with them
         * (GH-678) — and this composer went on reading the script, found nothing, threw,
         * and every page that prints a notice answered 500. It was found by the PHP
         * suite, forty-six failures deep, rather than by a client, and it is the plainest
         * case there is for why a fact must have ONE owner: a reader of the old copy
         * cannot tell "the copy is gone" from "there is nothing to read".
         *
         * The reviewer's check survives the move intact, and that mattered in choosing
         * this shape: the path is still a parameter, so breaking the SOURCE still breaks
         * the answer. A map that survives its source being broken is a copy.
         */
        $file ??= base_path('../assets/dependency-graph.json');
        if (! is_file($file)) {
            // Said out loud rather than answered with an empty map: an empty map
            // would make every section `not-recorded` for a reason that has
            // nothing to do with the run.
            throw new \RuntimeException('the dependency graph is not where the composer expects it: '.$file);
        }

        $graph = json_decode((string) file_get_contents($file), true);
        $nodes = is_array($graph) && isset($graph['nodes']) && is_array($graph['nodes'])
            ? $graph['nodes']
            : [];
        $out = [];
        foreach ($nodes as $id => $node) {
            foreach ((array) ($node['outputs'] ?? []) as $output) {
                if (! is_string($output) || ! str_starts_with($output, 'computed.')) {
                    continue;
                }
                // The ROOT of the output: the graph declares `computed.firmness.FI` and
                // the orchestrator warns under `firmness`. The first declarer of a root
                // keeps it, as before.
                $root = explode('.', substr($output, strlen('computed.')))[0];
                if ($root === '' || isset($out[$root])) {
                    continue;
                }
                /**
                 * GH-777 (queue item 4, slice 2) — THE MODULE'S NAME COMES FROM THE NODE, DECLARED.
                 *
                 * This kept the node's ID and the reader below worked the name out of it by dropping
                 * suffixes until `STEP_NAMES` recognised one. That rule is wrong for one node and wrong
                 * silently: `disease-forecast` gives `disease`, so the cause of an empty FORECAST was
                 * looked for under the disease step while the pass writes it under `forecast`. Measured
                 * on the stand: 11 of 12 pass nodes agreed, one did not, and the rows where it would
                 * show are 0 of 94 -- which is why nobody saw it.
                 *
                 * The node declares `module` now (the analyst's answer of 29.09.2026), the pass
                 * registers under that same field, and there is one spelling instead of two rules.
                 */
                $out[$root] = [
                    'module' => is_string($node['module'] ?? null) ? $node['module'] : null,
                    'id' => (string) $id,
                ];
            }
        }

        if (count($out) < 15) {
            throw new \RuntimeException('the composer read only '.count($out).' outputs from the dependency graph');
        }

        return $out;
    }

    /**
     * The spellings a step may be known by, given the key and the engine the graph names for it.
     *
     * GH-777 (queue item 4, slice 2): THIS IS THE FALLBACK NOW, not the rule. A node that declares
     * `module` is answered from that field; this ladder serves the nodes that do not yet -- the cascade's
     * six, the tissue engine, the page nodes -- and goes when slice 3 declares them. It is kept because
     * it is wrong only where it was always wrong, and removing it today would take the sentence off the
     * PGR and tissue sections.
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
                if (! is_array($entry) || self::entryStep($entry) !== $step) {
                    continue;
                }
                if ($entry['reason'] ?? null) {
                    return (string) $entry['reason'];
                }
                /**
                 * GH-777 (queue item 4, O-9) — THE JUDGED ENTRY, WHOSE SHAPE IS NOT `reason`.
                 *
                 * The pass records `{module, missing: [input, …]}` and the server judges each name into
                 * `{input, declaredAs, cause}` (GH-675, GH-777). This reader looked for `reason` only, so
                 * every judgement the slices of this item produced reached the row and stopped there: the
                 * section stayed silent and the page kept printing the sentence it always printed. That is
                 * promise O-9 of the analyst's 22.1, and the gap was named in `Gh675…` rather than hidden.
                 *
                 * The FIRST named input decides the cause. A module can lack several inputs; they share
                 * one cause almost always, and where they differ the first is the one the sentence names,
                 * which is the same rule the assembled-key path already uses for several steps.
                 *
                 * An input whose entry says the client is not to be told is skipped — the switch the owner
                 * decided on 24.09.2026 — and if that leaves nothing, the section has no cause, which is
                 * what "no sentence" means here.
                 */
                foreach ((array) ($entry['missing'] ?? []) as $missing) {
                    if (! is_array($missing) || ! is_string($missing['cause'] ?? null)) {
                        continue;
                    }
                    $input = is_string($missing['declaredAs'] ?? null) ? $missing['declaredAs']
                        : (is_string($missing['input'] ?? null) ? $missing['input'] : null);
                    if ($input !== null && ! CalculationInputs::explainToClient($input)) {
                        continue;
                    }

                    return (string) $missing['cause'];
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

    /**
     * GH-777 (queue item 4, O-9) — the owner's sentence, with its three parts taken from the run.
     *
     * The module's words come from the graph through `STEP_NAMES`, exactly as every other section's title
     * does; the input's name and its place come from the inputs list. The input is the one the judgement
     * named, so a section that lacks two inputs names the first -- and an input the owner decided not to
     * explain is skipped by the reader above, so it never reaches this.
     *
     * `null` -- no sentence -- whenever a part is not there: no name written for that input, or nowhere to
     * send a person. The turf type decides whether a place exists at all for the two inputs that live in
     * the Traffic & Wear tab, which only a sports site is shown.
     */
    private static function inputNotEnteredText(?string $step, ?array $numbersRun,
        ?array $projection = null): ?string
    {
        if ($step === null || ! is_array($numbersRun)) {
            return null;
        }
        $input = null;
        foreach ((array) ($numbersRun['notApplicable'] ?? []) as $entry) {
            if (! is_array($entry) || self::entryStep($entry) !== $step) {
                continue;
            }
            foreach ((array) ($entry['missing'] ?? []) as $missing) {
                if (! is_array($missing) || ($missing['cause'] ?? null) !== 'input-not-entered') {
                    continue;
                }
                $named = is_string($missing['declaredAs'] ?? null) ? $missing['declaredAs']
                    : (is_string($missing['input'] ?? null) ? $missing['input'] : null);
                if ($named !== null && CalculationInputs::explainToClient($named)) {
                    $input = $named;
                    break 2;
                }
            }
        }
        if ($input === null) {
            return null;
        }
        $label = CalculationInputs::label($input);
        $place = CalculationInputs::placeFor($input, self::turfTypeOf($projection));
        if ($label === null || $place === null) {
            return null;
        }

        /**
         * THE MODULE'S WORDS ARE THE SECTION'S OWN, not a second spelling. `stepName` is what the card's
         * title shows, and for the soil step it follows the site's methodology (GH-742: `MLSN`, `SLAN`,
         * or the step's own word where none is set). A sentence that said `MLSN` under a title that said
         * `soil nutrition` would be two names for one thing on one screen -- which is what the guard of
         * this case caught when the sentence used the table directly.
         */
        return ucfirst((string) self::stepName($step, $projection)).' was not calculated because '.$label
            .' has not been entered. Add it in '.$place.'.';
    }

    /**
     * The site's turf type, as the projection carries it from `config.turf.turfType` (GH-777).
     *
     * It decides one thing here: whether the Traffic & Wear tab is a place a person can reach. THE ROW IS
     * NOT ASKED. A fact about a site comes from the site's settings, and a run's own account of it could
     * disagree with them -- the class of GH-459 -- so a turf type inside `numbersRun` is ignored here and a
     * case holds that. Absent, the tab is not named: no place, therefore no sentence, which is a named
     * absence rather than a wrong address.
     */
    private static function turfTypeOf(?array $projection): ?string
    {
        $type = is_array($projection) ? ($projection['turfType'] ?? null) : null;

        return is_string($type) && $type !== '' ? $type : null;
    }

    /**
     * The sentence for an application whose effect has ended, approved by the owner on 28.09.2026.
     *
     * The product, the date and the number of days are read out of the journal entry the run wrote;
     * nothing here is a literal but the wording itself. Without the entry's own figures there is no
     * sentence, and the page keeps the one it had -- an absence is not filled in with a guess.
     */
    private static function pgrWindowExhaustedText(?string $step, ?array $numbersRun): ?string
    {
        if ($step === null || ! is_array($numbersRun)) {
            return null;
        }

        foreach (($numbersRun['notes'] ?? []) as $note) {
            if (! is_array($note) || self::entryStep($note) !== $step) {
                continue;
            }
            $data = $note['data'] ?? null;
            if (is_string($data) && $data !== '') {
                $decoded = json_decode($data, true);
                $data = is_array($decoded) ? $decoded : null;
            }
            if (! is_array($data) || ($data['reason'] ?? null) !== 'pgr-window-exhausted') {
                continue;
            }

            $product = $data['productType'] ?? null;
            $applied = $data['applicationDate'] ?? null;
            $windowDays = $data['windowDays'] ?? null;
            if (! is_string($product) || $product === '' || ! is_string($applied) || $applied === ''
                || ! is_numeric($windowDays)) {
                return null;
            }

            $when = strtotime($applied);
            if ($when === false) {
                return null;
            }

            return 'Last PGR application: '.$product.' on '.date('j M Y', $when)
                .', more than '.(int) $windowDays.' days ago. Its growth-regulation effect has ended'
                .' and is not included in this analysis.';
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

    private static function sectionText(?string $code, ?string $step = null, ?array $numbersRun = null,
        ?array $projection = null): ?string
    {
        if ($code === null) {
            return null;
        }

        $text = self::REASONS[$code]['text'] ?? null;
        if ($text !== null) {
            return $text;
        }

        /**
         * GH-772 - THE ONE CAUSE WHOSE SENTENCE IS COMPOSED PER RUN.
         *
         * Every other cause has a fixed sentence in the table above, because it says the same thing
         * whenever it happens. This one names the product, the date and the length of the window, and
         * all three are data: the first two come from the spray log through the server (GH-771) and
         * the third from the engine's own `GAIP_PGR_HISTORY_WINDOW_DAYS`, carried in the journal
         * entry. A fixed string could not hold them, and the owner's condition was that a window of
         * another length must change the sentence by itself.
         */
        if ($code === 'pgr-window-exhausted') {
            return self::pgrWindowExhaustedText($step, $numbersRun);
        }

        /**
         * GH-777 (queue item 4, O-9) — THE SENTENCE FOR AN INPUT NOBODY ENTERED, COMPOSED PER RUN.
         *
         * The owner's form, approved 24.09.2026: "{Module} was not calculated because {label} has not
         * been entered. Add it in {place}." Every part of it is data rather than a literal here -- the
         * module's own words from the graph's label (GH-572), the input's name and the place from the
         * inputs list, where they are the analyst's draft and the owner's to change.
         *
         * THE SENTENCE IS NOT COMPOSED AT ALL when any part is missing, and that is the analyst's rule
         * of 49.1 rather than a fallback: an input with no name, or one whose address would send a person
         * to a tab their site does not have, gets silence and the page keeps the phrase it printed
         * before. A wrong address is worse than none.
         */
        if ($code === 'input-not-entered') {
            return self::inputNotEnteredText($step, $numbersRun, $projection);
        }

        /**
         * GH-781 - THE OWNER'S GENERAL PHRASE, composed with the section's own module.
         *
         * Declared by `composed` in the table above rather than by a list of codes here, so a third cause of
         * ours joins it by its own declaration. `{Module}` is the module of the section being explained, which
         * is why this is composed at all: a fixed string could not carry it, and naming the producer instead
         * would print a word of ours to a client.
         */
        if (! empty(self::REASONS[$code]['composed'])) {
            $module = self::stepName($step, $projection);
            if ($module === null || $module === '') {
                return null;
            }

            return ucfirst((string) $module)
                .' was not calculated in this analysis. If this continues, contact us.';
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
        /**
         * GH-792 (queue item 79): AND THE PLACES THAT ARE NOT A RESULT KEY.
         *
         * Five of the empty sections a client sees do not correspond to a key of the result: three are parts
         * of the soil section (the section itself has a key, its nutrient list and its annual requirement do
         * not), and two belong to pages rather than to engines (the recommendations of Growth & Light, a
         * dashboard panel). They are declared here, so a page asks by a place key instead of holding a
         * sentence of its own -- which is the whole subject of this item.
         */
        foreach (array_keys(self::WORDS_WITHOUT_A_REASON) as $key) {
            if (! array_key_exists($key, $out)) {
                $out[$key] = self::section($key, $projection);
            }
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

    /**
     * GH-781 - DOES THIS CAUSE EVER EXPLAIN A WHOLE RUN, or only a section of one?
     *
     * The runner writes `cascade-pass-not-run` and `pass-not-finished-at-write` into `detail.skipped`, which
     * explains a SECTION; nothing puts either into a run's `reason`. The difference matters because the owner's
     * sentence for them names the module of the section, and a run-level panel has no section to name - asking
     * for their words there would print the code itself to a client, which is what `Gh646` forbids. Declared in
     * the table rather than listed in a test, so a third such cause is covered by its own declaration.
     */
    public static function explainsASectionOnly(?string $code): bool
    {
        return $code !== null && ! empty(self::REASONS[$code]['sectionOnly']);
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
            $name = self::stepName((string) $key, $projection);
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
