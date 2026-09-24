<?php

namespace App\Support;

/**
 * GH-642 (queue item 6, stage 0b) — THE ONE READER OF THE ONE LIST OF INPUTS.
 *
 * The owner's decision, 23.09.2026: one list that the site wizard, Settings, the
 * run and the incomplete-run panel all consult, so that the same check is not
 * written in four places. Her correction the same day settled the shape of it:
 * ONE FILE, ONE READER — the others get it parsed from here, exactly as
 * `analysis-result.schema.json` is read by the server and never copied into the
 * browser. "Two readers with a guard" is duplication wearing a seatbelt.
 *
 * What the file says and what it deliberately does not is written in the file
 * itself; this class only reads it.
 */
class CalculationInputs
{
    private const PATH = '../assets/calculation-inputs.schema.json';

    /** @var array<string,mixed>|null */
    private static ?array $cache = null;

    /** @return array<string,mixed> */
    public static function all(): array
    {
        if (self::$cache === null) {
            $raw = @file_get_contents(base_path(self::PATH));
            $decoded = $raw === false ? null : json_decode($raw, true);
            // A missing or unreadable list is not silently an empty one: an empty
            // list would make every site complete and every warning silent, which
            // is the defect this file exists to close wearing a different hat.
            if (! is_array($decoded) || ! isset($decoded['inputs']) || ! is_array($decoded['inputs'])) {
                throw new \RuntimeException('calculation-inputs.schema.json is missing or unreadable');
            }
            self::$cache = $decoded;
        }

        return self::$cache;
    }

    /** @return array<int,string> every declared input, in declaration order */
    public static function keys(): array
    {
        return array_keys(self::all()['inputs']);
    }

    /** @return array<string,mixed>|null one input's declaration */
    public static function entry(string $key): ?array
    {
        $entry = self::all()['inputs'][$key] ?? null;

        return is_array($entry) ? $entry : null;
    }

    /**
     * Is this input required — for a site of this turf type?
     *
     * `true` / `false` / `null`, and `null` is the honest third answer: the owner
     * has not decided. A caller that turns `null` into `false` is deciding for
     * her, so this returns it as it stands and `openDecisions()` names them.
     */
    public static function isRequired(string $key, ?string $turfType = null): ?bool
    {
        $entry = self::entry($key);
        if ($entry === null) {
            return null;
        }

        // The conditional branch wins over the flat answer, which is what
        // "required for some sites" means — the wizard asks a golf site for its
        // surface and does not ask a lawn.
        if ($turfType !== null && isset($entry['byTurfType'][$turfType]) && is_array($entry['byTurfType'][$turfType])) {
            $branch = $entry['byTurfType'][$turfType];
            if (array_key_exists('required', $branch)) {
                return $branch['required'];
            }
        }

        // `requiredFor` is the other spelling of the same condition: required,
        // but only for the turf types named.
        if (isset($entry['requiredFor']) && is_array($entry['requiredFor'])) {
            if ($turfType === null) {
                return null;
            }

            return in_array($turfType, $entry['requiredFor'], true) ? true : false;
        }

        return array_key_exists('required', $entry) ? $entry['required'] : null;
    }

    /**
     * The inputs a site of this type must have, by the list alone.
     *
     * @return array<int,string>
     */
    public static function requiredFor(string $turfType): array
    {
        $out = [];
        foreach (self::keys() as $key) {
            if (self::isRequired($key, $turfType) === true) {
                $out[] = $key;
            }
        }

        return $out;
    }

    /**
     * Inputs whose obligation the owner has not settled, with what waits on her.
     *
     * A warning built from this list says nothing about these until she answers —
     * silence here is the decision not having been made, not the input being
     * optional.
     *
     * @return array<string,string>
     */
    public static function openDecisions(): array
    {
        $out = [];
        foreach (self::all()['inputs'] as $key => $entry) {
            if (! is_array($entry)) {
                continue;
            }
            if (array_key_exists('required', $entry) && $entry['required'] === null) {
                $out[$key] = (string) ($entry['decision'] ?? '');
            }
            foreach (($entry['byTurfType'] ?? []) as $type => $branch) {
                if (is_array($branch) && array_key_exists('required', $branch) && $branch['required'] === null) {
                    $out[$key.'@'.$type] = (string) ($branch['decision'] ?? '');
                }
            }
        }

        return $out;
    }

    /**
     * What is worked out rather than asked for, by name and with its source.
     *
     * The equality test excludes these BY NAME: a rule that excluded "anything
     * derivable" would also excuse a real omission.
     *
     * @return array<string,string>
     */
    public static function derived(): array
    {
        $out = [];
        foreach (self::all()['derived'] ?? [] as $key => $from) {
            if ($key !== '$comment' && is_string($from)) {
                $out[$key] = $from;
            }
        }

        return $out;
    }

    /** Which sample kind's lab-name map an entry points at, if any. */
    public static function readingsMap(string $key): ?string
    {
        $entry = self::entry($key);
        $readings = $entry['readings'] ?? null;

        return is_string($readings) ? $readings : null;
    }
}
