<?php

namespace App\Support;

/**
 * GH-799 (queue item "Zones", stage C0) — THE ONE READER OF THE ZONE-TYPE DICTIONARY.
 *
 * The values live in `assets/zone-types.json` and the reasons for keeping them in a file rather than in
 * a table are written there, including why the water-source vocabulary this class first also read is
 * not declared any more: the owner's decision of 01.10.2026 is that a water sample keeps only its name.
 *
 * This class is the only thing that reads the file: pages receive what the server answers, exactly as
 * they do for `aa-ranges.json` and the inputs list, and a second reader in `assets` reddens
 * `Gh799TheZoneTypesHaveOneFileTest`.
 *
 * WHAT IT IS FOR IN THIS STAGE. A zone's type is stored as a KEY of that file, so something has to say
 * whether a key exists before it is written — the owner's decision of 22.09.2026 that the type is a
 * reference to a declared value and not free text. Nothing in stage C0 reads a type back out to compute
 * with; that is stage C3, and the rule is that nothing starts reading a field before something writes
 * it.
 *
 * A MISSING FILE IS NOT AN EMPTY DICTIONARY. An empty one would make every key invalid, which is the
 * opposite of what an unreadable file means, so it throws — the same choice `CalculationInputs` makes.
 */
class ZoneTypes
{
    private const PATH = '../assets/zone-types.json';

    /** @var array<string,mixed>|null */
    private static ?array $cache = null;

    /** @return array<string,mixed> */
    public static function all(): array
    {
        if (self::$cache === null) {
            $raw = @file_get_contents(base_path(self::PATH));
            $decoded = $raw === false ? null : json_decode($raw, true);
            if (! is_array($decoded) || ! isset($decoded['zoneTypes']) || ! is_array($decoded['zoneTypes'])) {
                throw new \RuntimeException('zone-types.json is missing or unreadable');
            }
            self::$cache = $decoded;
        }

        return self::$cache;
    }

    /** @return array<int,string> the zone-type keys, in declaration order */
    public static function zoneTypeKeys(): array
    {
        return array_keys(self::all()['zoneTypes']);
    }

    /**
     * Is this a zone type the dictionary declares?
     *
     * `null` is not a type and answers false; whether an absent type is ALLOWED is a different question,
     * answered by the column (nullable) and, from stage C2, by the Settings form.
     */
    public static function isZoneType(?string $key): bool
    {
        return $key !== null && array_key_exists($key, self::all()['zoneTypes']);
    }

    /**
     * The words for a zone type, or null for a key the dictionary does not carry — never a word made up
     * for it. A page that is handed null prints nothing in its place.
     *
     * @return array<string,mixed>|null
     */
    public static function zoneType(?string $key): ?array
    {
        if (! self::isZoneType($key)) {
            return null;
        }
        $entry = self::all()['zoneTypes'][$key];

        return is_array($entry) ? $entry : null;
    }

    /** The label of a zone type, or null. */
    public static function zoneTypeLabel(?string $key): ?string
    {
        $label = self::zoneType($key)['label'] ?? null;

        return is_string($label) && $label !== '' ? $label : null;
    }

    /** The area hint of a zone type, or null — the numbers a form shows beside an area field. */
    public static function areaGuidance(?string $key): ?array
    {
        $guidance = self::zoneType($key)['areaGuidance'] ?? null;

        return is_array($guidance) ? $guidance : null;
    }

    /**
     * GH-804 (part 1): `typeField`, `typeFieldLabel`, `typeIsRequiredIn` and `typeIsJudgedOnTheResult`
     * stood here. The obligation on a zone's type is declared in the inputs list now
     * (`calculation-inputs.schema.json`, the input `zones.zoneType`) and read through
     * `CalculationInputs` — one file for what the product requires, instead of two. This class is back
     * to the one thing it was made for: the twelve types.
     *
     * AND THE SUBSTITUTED LABEL WENT WITH IT. `typeFieldLabel` answered `'the zone type'` when the
     * declaration carried no label, which is a word standing where a declaration is missing.
     * `CalculationInputs::zoneTypeLabel` throws instead: a record with no label is a defect in the
     * record.
     */

    /**
     * GH-806 (queue item "Zones", stage SZh1) — THE TYPE A JOURNAL WORD MEANS, OR NOTHING, OR AN
     * EXCEPTION. Three answers, and they are three different facts:
     *
     *   - a declared word answers its type (`greens` is `green`);
     *   - a word declared as having NO type answers null (`surrounds`: this dictionary has no key for
     *     it, and the nearest one would be a guess);
     *   - a word nobody declared THROWS, because a journal entry carrying a word this product does not
     *     know is not something to shrug at: the transfer stops on it rather than leaving a row behind.
     *
     * Compared without case: the server stores the word as it was sent, and the two lists the product
     * offers are spelled differently (`Greens` on the Data page, `greens` in the journal's own UI).
     */
    public static function zoneTypeOfJournalWord(?string $word): ?string
    {
        $key = mb_strtolower(trim((string) $word));
        $table = self::all()['journalZoneWords'] ?? [];
        $ofWord = [];
        foreach ((array) ($table['ofWord'] ?? []) as $declared => $type) {
            $ofWord[mb_strtolower((string) $declared)] = $type;
        }
        if (array_key_exists($key, $ofWord)) {
            return $ofWord[$key];
        }
        $noType = array_map(fn ($w) => mb_strtolower((string) $w), (array) ($table['noType'] ?? []));
        if (in_array($key, $noType, true)) {
            return null;
        }

        throw new \RuntimeException('zone-types.json declares no answer for the journal word "'.$word.'"');
    }

    /** Is this a word the table has an answer for at all — a type or an explicit "no type"? */
    public static function isJournalWord(?string $word): bool
    {
        try {
            self::zoneTypeOfJournalWord($word);

            return true;
        } catch (\RuntimeException $e) {
            return false;
        }
    }

    /** @return array<string,?string> every declared word and its answer, for a report to print */
    public static function journalWords(): array
    {
        $table = self::all()['journalZoneWords'] ?? [];
        $out = [];
        foreach ((array) ($table['ofWord'] ?? []) as $word => $type) {
            $out[(string) $word] = $type;
        }
        foreach ((array) ($table['noType'] ?? []) as $word) {
            $out[(string) $word] = null;
        }

        return $out;
    }

    /**
     * GH-816 (queue item "Zones", ZhT) — WHICH APPLICATIONS OF THE JOURNAL THE ANALYSIS COUNTS ON THIS SITE.
     *
     * The rule is declared once, in `analysisZoneTypes` of the zone types file, by the site's turf type;
     * the turf type is read from the site's own configuration (`turf.turfType`, its one owner). Answers
     * `['turfType' => …, 'any' => true, 'types' => []]` where an application to a zone of any type counts,
     * `['turfType' => …, 'any' => false, 'types' => [...]]` where only the listed types do, and `null`
     * when the site has no turf type, or one the rule does not declare: nothing is substituted for it.
     *
     * @return array{turfType: string, any: bool, types: array<int,string>}|null
     */
    public static function analysisZoneTypesFor(\App\Models\Site $site): ?array
    {
        $record = $site->configs()->where('namespace', 'gaip')->first();
        $config = is_array($record?->config) ? $record->config : [];
        $turfType = $config['turf']['turfType'] ?? null;
        if (! is_string($turfType) || $turfType === '') {
            return null;
        }
        $rule = self::all()['analysisZoneTypes'] ?? [];
        $byTurfType = (array) ($rule['byTurfType'] ?? []);
        if (! array_key_exists($turfType, $byTurfType)) {
            return null;
        }
        $answer = $byTurfType[$turfType];
        if ($answer === ($rule['anyType'] ?? null)) {
            return ['turfType' => $turfType, 'any' => true, 'types' => []];
        }

        return ['turfType' => $turfType, 'any' => false,
            'types' => array_values(array_filter((array) $answer, fn ($t) => self::isZoneType($t)))];
    }

    /**
     * The dictionary as a page receives it: key, label and area hint, in declaration order.
     *
     * @return array{zoneTypes: array<int,array<string,mixed>>}
     */
    public static function forThePage(): array
    {
        $zones = [];
        foreach (self::all()['zoneTypes'] as $key => $entry) {
            $zones[] = [
                'id' => (string) $key,
                'label' => $entry['label'] ?? $key,
                'areaGuidance' => $entry['areaGuidance'] ?? null,
            ];
        }

        return ['zoneTypes' => $zones];
    }

}
