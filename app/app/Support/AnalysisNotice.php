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
    private const REASONS = [
        'site-settings-unavailable' => 'the site settings did not load, so the run was cancelled instead of computing on the form defaults',
        'weather-unavailable'       => 'no weather data was available — the live service did not answer, and there was no cached or manually entered weather to use',
        'calculation-error'         => 'the calculation stopped with an error',
        'normals-timeout'           => 'the climate normals did not arrive in time',
        'incomplete-result'         => 'the server refused the result as incomplete',
        'rejected'                  => 'the server refused the result',
        'site-mismatch'             => 'the result did not belong to the site the run was started for',
        'run-not-completed'         => 'the run did not finish inside its time budget',
        'no-report'                 => 'the run never reported back',
        // GH-557 (section 15): the shape that produced Federal Golf's row.
        'climate-late'              => 'the climate data arrived after the steps that needed it had already run',
        'disease-not-computed'      => 'the disease analysis it depends on was not computed',
        'engine-error'              => 'the engine stopped with an error',
        'pass-start-unknown'        => 'the run could not tell whether it finished before or after the weather arrived',
        'values-not-computed'       => 'some values were not computed',
        'schema-unavailable'        => 'the page was not given the declared form of a result',
        // GH-588 (link 4) — THE TWO SOIL STATES, AND THEY MUST NOT READ
        // ALIKE. The first is a fact about the site and has one action: add a
        // sample. The third is a fact about this attempt and has a different
        // one: press again. A reader who cannot tell them apart will do the
        // wrong one, or neither.
        'no-soil-sample'            => 'there is no soil sample for this site, so the soil and nutrition analysis was not computed. Add a soil test on the Data page',
        'soil-sample-not-delivered' => 'the soil sample data did not arrive in time',
        // GH-586 (D6): the run was asked for a particular water sample and
        // could not use it. Two reasons, kept apart because they are different
        // facts: the sample is not on this site, or its list had not arrived.
        'water-sample-not-found'    => 'the water sample this run was asked for is not on this site',
        'water-samples-not-loaded'  => 'the site\'s water samples had not loaded when the run needed them',
        // GH-578: the pass waited the run's budget for the site's soil sample and
        // started without it. Not a refusal — the rest of the run is real.
        'soil-sample-not-loaded'    => 'the soil sample did not load in time, so the soil and nutrition analysis was not computed for this run',
        // GH-573: written by the end-of-pass sweep in `hub-orchestrator.js` and
        // by the cascade adapter's own sweep — the run took this module on and
        // its result is not there.
        'engine-produced-nothing'   => 'that part of the analysis produced no result',
        // GH-572: the code the withdrawn journal rule wrote. Kept because rows
        // recorded under it are still in the table; nothing writes it now.
        'engine-did-not-produce'    => 'the run reported a problem in that part of the analysis',
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
    private const NOTHING_A_RETRY_CAN_FIX = ['no-soil-sample'];

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
    public static function clientTexts(): array
    {
        return [
            'reasons' => self::REASONS,
            'frame'   => self::FAILURE_FRAME,
            'unknown' => self::UNKNOWN_REASON,
        ];
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
        $text = self::REASONS[$code] ?? str_replace('{code}', $code, self::UNKNOWN_REASON);

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
        $retryChanges = ! in_array($run['reason'] ?? null, self::NOTHING_A_RETRY_CAN_FIX, true);

        // The numbers on screen are this very run's — nothing older exists.
        if (($projection['numbersFrom'] ?? null) === 'partial') {
            return 'This analysis is incomplete: '.$what.' '.$wasWere.' not computed ('.$reason.').'
                .($retryChanges ? ' Re-run to complete it.' : '');
        }

        return 'The re-run'.($when ? ' on '.$when : '').' finished without '.$what.': '
            .$reason.'. The numbers below are from the last complete analysis.'
            .($retryChanges ? ' Try Re-run again.' : '');
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
