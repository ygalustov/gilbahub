<?php

namespace Tests\Feature\Concerns;

use App\Support\AnalysisResultSchema;

/**
 * GH-553 — a body in the declared form, for tests that write one.
 *
 * Since the server refuses an incomplete result, a fixture carrying two keys is
 * no longer a result at all. Rather than thirteen names copied into four test
 * files — which is the second-source problem this whole question is about,
 * wearing test clothes — the keys come from the schema and the values from the
 * caller.
 *
 * `null` is a legitimate value here, and deliberately so: it is what a run sends
 * for an engine that did not answer, and a fixture that could not express it
 * would leave the interesting case untested.
 */
trait BuildsAnalysisResults
{
    /**
     * Every required key WITH A VALUE, unless the caller names one.
     *
     * GH-557 changed what this has to mean. It used to fill the keys with
     * `null`, which was a complete body then and is a PARTIAL run now: `null` is
     * "this was not computed", and a run that computed nothing is not complete.
     * A fixture that still filled nulls would have made every test in four files
     * quietly assert the partial path.
     *
     * The filler is `1` because the server does not read the values, only
     * whether there are any — except `timestamp`, which is a date everywhere it
     * is read.
     *
     * @param  array<string,mixed> $values
     * @return array<string,mixed>
     */
    protected function completeMetrics(array $values = []): array
    {
        $out = [];
        foreach (AnalysisResultSchema::requiredMetrics() as $key) {
            $out[$key] = array_key_exists($key, $values)
                ? $values[$key]
                : ($key === 'timestamp' ? '2026-09-22T00:00:00Z' : 1);
        }

        return array_merge($out, $values);
    }

    /**
     * A run that finished and could not compute part of itself.
     *
     * `$uncomputed` are sent as `null` — present, correctly formed, and saying
     * "no number". That is the shape Federal Golf's re-run produced and the one
     * the third outcome exists for.
     *
     * @param  array<int,string>   $uncomputed
     * @param  array<string,mixed> $values
     * @return array<string,mixed>
     */
    protected function partialMetrics(array $uncomputed, array $values = []): array
    {
        $out = $this->completeMetrics($values);
        foreach ($uncomputed as $key) {
            $out[$key] = null;
        }

        return $out;
    }

    /** The seven Federal Golf's re-run could not compute, in schema order. */
    protected function federalGolfNulls(): array
    {
        return ['diseaseRisk', 'topDisease', 'forecastPeak', 'peakDay',
                'forecastDisease', 'stressIndex', 'trendDirection'];
    }
}
