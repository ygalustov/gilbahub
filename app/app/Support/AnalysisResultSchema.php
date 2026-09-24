<?php

namespace App\Support;

/**
 * GH-553 — THE DECLARED FORM, READ RATHER THAN DESCRIBED.
 *
 * `assets/analysis-result.schema.json` has said since GH-546 what a complete
 * analysis result is. Nothing read it. The producer assembled a body out of
 * whatever its engines had answered and the server checked that `metrics` was an
 * array, so the schema was a comment with a test attached — and on 22.09.2026 a
 * real Re-run on Federal Golf wrote six of the thirteen required keys with
 * `outcome = 'complete'`, which the plan says is inexpressible.
 *
 * ONE SOURCE, BOTH ENDS. This class is what makes that true. The file is read
 * here, handed to the page in `layouts/app.blade.php` so the producer can build
 * its body from it, and used here again to refuse an incomplete one. A copy of
 * the key list in JavaScript would be a second source, and two lists of thirteen
 * names drift the way two thresholds did before `ClassificationConstants`.
 *
 * WHAT IS REQUIRED AND WHAT IS NOT, taken from the file rather than decided
 * here: `metrics.required` must all be present, with `null` where the run could
 * not produce a value. `metrics.conditional` (`companionDisease`, `vwc`) is
 * absent when its condition does not hold — a companion surface, a sensor — and
 * `metrics.branchDependent` (`gdd`, `et`) depends on which climate branch fired.
 * Neither is made required by this class, because neither is declared required
 * by the file.
 */
class AnalysisResultSchema
{
    private const PATH = '../assets/analysis-result.schema.json';

    /** @var array<string,mixed>|null */
    private static ?array $cache = null;

    /** @return array<string,mixed> */
    public static function all(): array
    {
        if (self::$cache === null) {
            $raw = @file_get_contents(base_path(self::PATH));
            $decoded = $raw === false ? null : json_decode($raw, true);
            // A missing or unreadable schema is not silently an empty one: an
            // empty required list would make every body complete, which is the
            // defect this class exists to close, wearing a different hat.
            if (! is_array($decoded) || ! isset($decoded['metrics']['required'])) {
                throw new \RuntimeException('analysis-result.schema.json is missing or unreadable');
            }
            self::$cache = $decoded;
        }

        return self::$cache;
    }

    /**
     * GH-640 (link 11, plan 4.13a point 1) — the consumer keys the schema
     * declares, which is the universe the composer must answer for.
     *
     * Declared in one place and read from it; a second list of "sections a page
     * can be empty in" is the drift this whole question is removing. The
     * schema's own comment calls it "declared as observed", and that boundary
     * stands: a key nobody declared consumed is invisible to the composer too.
     *
     * @return array<int,string>
     */
    public static function consumerKeys(): array
    {
        $keys = self::all()['computed']['readByConsumers'] ?? null;
        if (! is_array($keys) || $keys === []) {
            throw new \RuntimeException('analysis-result.schema.json declares no consumer keys');
        }

        return array_values($keys);
    }

    /**
     * GH-641 (link 11, analyst section 4.13v) — the steps a consumer key is
     * assembled from, for the keys the row's producer builds.
     *
     * `null` means the key is not declared as assembled — either an engine writes
     * it, and the graph says which, or nothing declares it at all and that shows
     * up in the equality test. An empty ARRAY is a declaration: no step stands
     * behind this key, so "the cause was not recorded" is the truth about it.
     *
     * @return array<int,string>|null
     */
    public static function stepsAssembling(string $key): ?array
    {
        $map = self::all()['computed']['assembledFrom'] ?? null;
        if (! is_array($map) || ! array_key_exists($key, $map)) {
            return null;
        }

        return is_array($map[$key]) ? array_values($map[$key]) : [];
    }

    /** @return array<string,array<int,string>> every assembled key, as declared */
    public static function assembledKeys(): array
    {
        $map = self::all()['computed']['assembledFrom'] ?? [];

        return is_array($map) ? $map : [];
    }

    /** @return array<int,string> the keys a completed run must carry */
    public static function requiredMetrics(): array
    {
        return array_values(self::all()['metrics']['required']);
    }

    /**
     * What the page is given, and nothing more.
     *
     * The schema file carries long `$comment` blocks explaining where its
     * numbers came from; the browser needs the names. Sent as a small object so
     * the producer can say which version of the form it built against.
     *
     * @return array<string,mixed>
     */
    public static function forClient(): array
    {
        $schema = self::all();

        return [
            'version' => $schema['version'] ?? null,
            'metrics' => [
                'required'        => self::requiredMetrics(),
                'conditional'     => array_values(array_diff(
                    array_keys($schema['metrics']['conditional'] ?? []), ['$comment']
                )),
                'branchDependent' => array_values(array_diff(
                    array_keys($schema['metrics']['branchDependent'] ?? []), ['$comment']
                )),
            ],
        ];
    }

    /**
     * The outcomes a stored run may have, from the file rather than from three
     * scattered string literals.
     *
     * @return array<int,string>
     */
    public static function outcomes(): array
    {
        return array_values(self::all()['envelope']['outcome'] ?? ['complete', 'failed']);
    }

    /**
     * Which required keys a body does not carry.
     *
     * ABSENT, not falsy: `null` is the correct value for a key whose engine did
     * not answer, and is exactly what a complete body is supposed to carry. A
     * check written with `empty()` would refuse the very shape the fix asks for.
     *
     * @param  array<string,mixed> $metrics
     * @return array<int,string>
     */
    public static function missingFrom(array $metrics): array
    {
        return array_values(array_filter(
            self::requiredMetrics(),
            fn (string $key) => ! array_key_exists($key, $metrics),
        ));
    }

    /**
     * Which required keys are present and have no value.
     *
     * GH-557: the distinction this whole section turns on. A key that is ABSENT
     * is a malformed body and is refused (`missingFrom`). A key that is present
     * and `null` is a correctly formed body saying "this was not computed" — the
     * result is real, and it is not complete.
     *
     * @param  array<string,mixed> $metrics
     * @return array<int,string>
     */
    public static function nullsIn(array $metrics): array
    {
        return array_values(array_filter(
            self::requiredMetrics(),
            fn (string $key) => array_key_exists($key, $metrics) && $metrics[$key] === null,
        ));
    }

    /**
     * Which required values a result does not have — ABSENT ones included.
     *
     * GH-558 (reviewer's finding on GH-557). `nullsIn()` counts only keys that
     * are present and null, which is exactly right for a body arriving over the
     * route: since GH-553 a missing key is a 422, so everything that gets in has
     * all thirteen and "null" is the only way to say "not computed".
     *
     * It is exactly WRONG for a row written before that rule. Those rows carry
     * five or six keys and no more, so `nullsIn()` reports nothing uncomputed
     * and the rule, applied to them, calls them complete a second time — which
     * is how the one row on the stand that shows the defect stayed invisible.
     *
     * A required value that is absent and a required value that is null are the
     * same fact about the analysis — nobody computed it — and differ only in how
     * carefully the producer said so. This is the function for asking about a
     * RESULT; `missingFrom()` remains the function for judging a BODY, where the
     * difference is the difference between well formed and malformed.
     *
     * @param  array<string,mixed> $metrics
     * @return array<int,string>
     */
    public static function uncomputedIn(array $metrics): array
    {
        return array_values(array_filter(
            self::requiredMetrics(),
            fn (string $key) => ! array_key_exists($key, $metrics) || $metrics[$key] === null,
        ));
    }
}
