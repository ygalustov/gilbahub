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
     * GH-773 — A ROW LAID OUT UNDER THE NAMES THE MAP DECLARES.
     *
     * The owner's direction: "the data must be written under, for example, CEC. It is CEC. It does not
     * matter which laboratory we loaded it from -- there must be recognition, not taking whatever name
     * came from that lab." Recognition was already here; it only decided whether to accept a sample,
     * and the column names a page had sent were stored as they came. So one reading sat in the
     * database under five spellings -- `pH_Water`, `OM_Percent`, `CEC_meq100g`, `EC1_5` and the
     * canonical ones -- and every reader had to know all of them.
     *
     * WHAT IS RENAMED IS ONLY WHAT IS UNAMBIGUOUS. Three kinds of column keep the name they arrived
     * with, and each has a reason that is not tidiness:
     *
     *   1. A column recognised ONLY after a method suffix was peeled (`pH_CaCl2` answering for `pH`).
     *      That is a different measurement of the same quantity, and which of the two a calculation
     *      should take is an open question of the owner's. Renaming it would answer it.
     *   2. ANSWERED BY THE OWNER ON 29.09.2026 AND NO LONGER AN EXCEPTION -- see the ordering rule
     *      below. Two columns answering for one reading used to be left under their own names while
     *      nobody had said which to believe.
     *   3. The phosphorus of a water sample. The map holds `P` and `P_mgL` as spellings of `PO4`, but
     *      phosphorus and phosphate are not the same quantity and the factor between them is not in
     *      the code. A rename here would silently declare them equal.
     *
     * Each of those is read through this map by the calculation already, so no number on a screen
     * changes by leaving them alone.
     *
     * WHAT IS NOT STORED: a numeric column the map does not know as a reading of this kind, by the
     * owner's decision of 24.09 that only what is recognised is saved. Measured before the change, so
     * that this drops nothing that exists: every numeric key of all 64 samples on the stand is
     * declared for its own kind. Columns that are not numbers, the service keys (`_label`, `_source`,
     * `_zone`, `zone`) and the attributes the map declares separately are left exactly as they are --
     * they are not readings and this function does not judge them.
     *
     * WHOSE KNOWLEDGE IS WHOSE. This class knows the names of readings and nothing else. Which keys of
     * a payload hold WORDS is the caller's own fact -- its `notes`, `label`, `lab_ref` and the rest --
     * and it passes them in. The first draft of this function did not ask, and dropped a `notes` of
     * "7": the number test reads a leading numeric prefix as a number, which is right for a reading
     * and wrong for a sentence that begins with a figure. The guard that had been standing since
     * GH-574 caught it.
     *
     * @param  array<string,mixed>  $row
     * @param  array<int,string>  $leaveAlone  keys the caller stores words in, lower-cased
     * @return array<string,mixed>  the row under canonical names; untouched for a kind the map does
     *                              not declare, because then nothing here knows better
     */
    public static function canonicaliseRow(string $kind, array $row, array $leaveAlone = []): array
    {
        $spared = [];
        foreach ($leaveAlone as $key) {
            $spared[mb_strtolower((string) $key)] = true;
        }

        $readings = self::readings($kind);
        if ($readings === null || $readings === []) {
            return $row;
        }

        $attributes = [];
        $type = self::all()['types'][$kind] ?? [];
        foreach ((array) ($type['attributes'] ?? []) as $spellings) {
            foreach ((array) $spellings as $spelling) {
                $attributes[mb_strtolower((string) $spelling)] = true;
            }
        }

        // Every column that answers for each reading, and whether it answered without the suffix
        // being peeled. `recognise` stops at the first spelling, which cannot see a second column.
        $answers = [];
        foreach ($readings as $key => $spellings) {
            foreach ($row as $col => $value) {
                $col = (string) $col;
                if ($col === '' || str_starts_with($col, '_') || isset($spared[mb_strtolower($col)])
                    || ! self::isNumber($value)) {
                    continue;
                }
                $whole = null;
                $rank = null;
                foreach (array_values((array) $spellings) as $i => $spelling) {
                    $spelling = (string) $spelling;
                    if ($col === $spelling || mb_strtolower($col) === mb_strtolower($spelling)) {
                        $whole = true;
                        $rank = $i;
                        break;
                    }
                    if (self::strip($col) !== '' && self::strip($col) === self::strip($spelling)) {
                        $whole = false;
                        $rank = $rank ?? $i;
                    }
                }
                if ($whole !== null) {
                    $answers[$key][] = ['column' => $col, 'whole' => $whole, 'value' => $value, 'rank' => $rank];
                }
            }
        }

        /**
         * GH-775 — TWO SPELLINGS OF ONE READING: THE DECLARED ORDER DECIDES, AND THE OTHER IS DROPPED.
         *
         * The owner's decision of 29.09.2026, and it is the old hub's rule rather than a new one:
         * `normalizeValues` in `sample-manager.js` fills each reading from the first column that
         * answers and skips the rest -- its own comment says "prefer specific column names like K_ppm
         * over K" -- so `pH_Water`, declared before `pH`, is what a run has always computed from. The
         * stand has one row where the two disagree, `Burns` soil 51: `pH_Water` 5.5 beside `pH` 6.6,
         * and 5.5 is the figure the calculation uses. It stays 5.5.
         *
         * The loser is not stored and nothing is said about it in the upload's answer: her words, "we
         * will not write that something was not saved". A sample carries what the laboratory reported
         * for the reading, by the spelling the product has always preferred.
         */
        $renameTo = [];
        $dropped = [];
        foreach ($answers as $key => $candidates) {
            $whole = array_values(array_filter($candidates, static fn (array $c): bool => $c['whole']));
            if ($whole === []) {
                continue;                           // only a suffix answered: reason 1, left as it is
            }
            usort($whole, static fn (array $a, array $b) => $a['rank'] <=> $b['rank']);
            $winner = $whole[0];
            if ($kind === 'water' && $key === 'PO4' && $winner['column'] !== 'PO4') {
                continue;                           // reason 3
            }
            $renameTo[$winner['column']] = $key;
            foreach (array_slice($whole, 1) as $loser) {
                if ($loser['column'] !== $winner['column']) {
                    $dropped[$loser['column']] = true;
                }
            }
        }

        $recognised = [];
        foreach ($answers as $candidates) {
            foreach ($candidates as $candidate) {
                $recognised[$candidate['column']] = true;
            }
        }

        $out = [];
        foreach ($row as $col => $value) {
            $col = (string) $col;
            if (isset($dropped[$col]) && ! isset($renameTo[$col])) {
                continue;                           // GH-775: a second spelling of a reading already taken
            }
            if (isset($renameTo[$col])) {
                $out[$renameTo[$col]] = $value;
                continue;
            }
            if (isset($recognised[$col]) || str_starts_with($col, '_') || ! self::isNumber($value)
                || isset($spared[mb_strtolower($col)]) || isset($attributes[mb_strtolower($col)])) {
                $out[$col] = $value;
                continue;
            }
            // Recognised by nothing and holding a number: not stored (the owner's 24.09 decision).
        }

        return $out;
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
