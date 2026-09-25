<?php

namespace App\Support;

/**
 * GH-722 — THE ONE READER OF HOW A LAB WRITES EACH READING OF A SAMPLE.
 *
 * `assets/lab-reading-names.json` declares, per kind of sample and per reading, the
 * spellings of the column a lab file may carry for it. This class reads it; the page is
 * handed what it read (`forClient`, both layouts), and the sample manager builds its
 * tables from that. The same knowledge used to live in four tables in the browser that
 * had drifted apart — the owner's rule is one file, one reader, the others get it
 * parsed from here, as `analysis-result.schema.json` and the dependency graph are.
 *
 * What the file says is written in the file itself; this class only reads it.
 */
class LabReadingNames
{
    private const PATH = '../assets/lab-reading-names.json';

    /** @var array<string,mixed>|null */
    private static ?array $cache = null;

    /** @return array<string,mixed> */
    public static function all(): array
    {
        if (self::$cache === null) {
            $raw = @file_get_contents(base_path(self::PATH));
            $decoded = $raw === false ? null : json_decode($raw, true);
            // A map that did not load is an outcome, not an empty map: an empty one would
            // make every column of every file unrecognised in silence.
            if (! is_array($decoded) || ! isset($decoded['types']) || ! is_array($decoded['types']) || $decoded['types'] === []) {
                throw new \RuntimeException('lab-reading-names.json is missing, unreadable or declares no kinds');
            }
            self::$cache = $decoded;
        }

        return self::$cache;
    }

    /** @return array<int,string> the kinds of sample the map declares, in declaration order */
    public static function kinds(): array
    {
        return array_keys(self::all()['types']);
    }

    /**
     * The readings a kind declares, each with its spellings in declared order.
     * Null for a kind the map does not declare, which is not the same as a kind with none.
     *
     * @return array<string,array<int,string>>|null
     */
    public static function readings(string $kind): ?array
    {
        $type = self::all()['types'][$kind] ?? null;

        return is_array($type) ? (array) ($type['readings'] ?? []) : null;
    }

    /**
     * GH-722 — which readings of its kind a sample row carries, and in which column.
     *
     * The same resolution the runner applies in `sample-manager.js` (b35fix377), so that what
     * the server accepts and what the calculation reads are decided by one rule: for each
     * reading in declared order, its spellings in declared order, each matched against the row's
     * columns exactly, then without case, then with a method suffix stripped from both; the first
     * spelling that finds a column holding a number wins. Zero is a number. A value is a number
     * the way the runner's `parseFloat` reads one: a leading numeric prefix.
     *
     * `tests/gh722-lab-reading-recognition-contract.test.js` and `Gh722LabReadingNamesTest` hold
     * the two implementations to one recorded contract.
     *
     * @param  array<string,mixed>  $row
     * @return array<string,string>|null  reading key => the column it was read from; null for a
     *                                    kind the map does not declare
     */
    public static function recognise(string $kind, array $row): ?array
    {
        $readings = self::readings($kind);
        if ($readings === null) {
            return null;
        }

        $columns = array_map('strval', array_keys($row));
        $lower = [];
        $stripped = [];
        foreach ($columns as $col) {
            $l = mb_strtolower($col);
            if (! array_key_exists($l, $lower)) {
                $lower[$l] = $col;
            }
            $s = self::strip($col);
            if ($s !== '' && ! array_key_exists($s, $stripped)) {
                $stripped[$s] = $col;
            }
        }

        $found = [];
        foreach ($readings as $key => $spellings) {
            foreach ((array) $spellings as $spelling) {
                $spelling = (string) $spelling;
                $col = in_array($spelling, $columns, true) ? $spelling
                    : ($lower[mb_strtolower($spelling)] ?? ($stripped[self::strip($spelling)] ?? null));
                if ($col === null || ! self::isNumber($row[$col] ?? null)) {
                    continue;
                }
                $found[$key] = $col;
                break;
            }
        }

        return $found;
    }

    /**
     * GH-722 — the readings of a row as numbers, through the same resolution as `recognise`: the
     * server's counterpart of the runner's `readingsOf`. A reader on the server takes a reading from
     * here instead of spelling the columns itself.
     *
     * @param  array<string,mixed>  $row
     * @return array<string,float>|null  null for a kind the map does not declare
     */
    public static function readingsOf(string $kind, array $row): ?array
    {
        $found = self::recognise($kind, $row);
        if ($found === null) {
            return null;
        }
        $out = [];
        foreach ($found as $key => $col) {
            $out[$key] = (float) $row[$col];
        }

        return $out;
    }

    private static function isNumber(mixed $value): bool
    {
        if (is_int($value) || is_float($value)) {
            return true;
        }

        return is_string($value) && preg_match('/^\s*[+-]?(\d+\.?\d*|\.\d+)/', $value) === 1;
    }

    /** A column name lowered, parenthesised parts removed, and one known method suffix peeled. */
    private static function strip(string $header): string
    {
        $s = trim((string) preg_replace('/\s*\([^)]*\)\s*/u', ' ', mb_strtolower($header)));
        foreach (self::suffixesLongestFirst() as $suffix) {
            $re = '/[\s_\-]'.preg_quote($suffix, '/').'$/u';
            if (preg_match($re, $s) === 1) {
                return trim((string) preg_replace($re, '', $s));
            }
        }

        return $s;
    }

    /** @return array<int,string> */
    private static function suffixesLongestFirst(): array
    {
        $suffixes = array_values((array) (self::all()['extractionMethodSuffixes'] ?? []));
        // Stable, as the runner's sort is: equal lengths keep declared order.
        usort($suffixes, static fn ($a, $b) => mb_strlen((string) $b) <=> mb_strlen((string) $a));

        return array_map('strval', $suffixes);
    }

    /**
     * What the page is given: the map as data, with nothing added.
     *
     * @return array<string,mixed>
     */
    public static function forClient(): array
    {
        return self::all();
    }
}
