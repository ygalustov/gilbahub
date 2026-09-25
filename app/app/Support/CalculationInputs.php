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
     * GH-684 (item 3bk) — WHICH REQUIRED INPUTS EACH WIZARD STEP COLLECTS, DERIVED FROM THE LIST.
     *
     * The wizard used to decide what a step needs with a hand-written `switch`, and Settings, the
     * calculation and the panel each had their own idea of what is required. This returns the one
     * answer from the one place: for every input required for this turf type, the wizard step named
     * in its own `filledIn`.
     *
     * A step's NUMBER comes from the name, `wizard.step<N>`, because the wizard's steps are
     * numbered and nothing else connects the two. A name that does not parse is skipped and named
     * in the return under `unparsed`, rather than silently dropped: a step nobody can reach is the
     * kind of hole that reads as "no input needs it".
     *
     * @return array{byStep: array<int, list<string>>, unparsed: list<string>}
     */
    public static function wizardStepsFor(string $turfType): array
    {
        $byStep = [];
        $unparsed = [];
        foreach (self::requiredFor($turfType) as $key) {
            $entry = self::entry($key);
            foreach ((array) ($entry['filledIn'] ?? []) as $place) {
                if (! is_string($place) || ! str_starts_with($place, 'wizard.')) {
                    continue;
                }
                if (preg_match('/^wizard\\.step(\\d+)$/', $place, $m) !== 1) {
                    $unparsed[] = $place;
                    continue;
                }
                $byStep[(int) $m[1]][] = $key;
            }
        }
        ksort($byStep);

        return ['byStep' => $byStep, 'unparsed' => array_values(array_unique($unparsed))];
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
    /**
     * GH-664 (item 3ch, the analyst's 26.1 point 1) — WHAT A SITE'S CONSTRUCTION
     * MEANS TO EACH CONSUMER, RESOLVED ONCE, ON THE SERVER.
     *
     * The dictionary has been declared since GH-656 and had no reader: every
     * consumer kept its own table, twelve of them across ten readers, and the soil
     * structure engine read a field (`soil.rootzoneType`) that nothing in the tree
     * writes — so it fell to its own `'native'` default and called all 35 stored
     * rows clay, nine of them on sites whose construction is `sand_profile`.
     *
     * WHAT COMES BACK, and the shape is the point:
     *   - `null` — the config has no construction. Not a default: the consumer
     *     says "not computed" and names `turf.construction` (4.15 point 4);
     *   - `['value' => …, 'resolves' => [...], 'known' => true]` — the value is in
     *     the dictionary;
     *   - `['value' => …, 'resolves' => [], 'known' => false]` — a value the
     *     dictionary does not carry. Also not a default, and told apart from
     *     absence on purpose: one is a site nobody has configured, the other is a
     *     value somebody chose and we cannot interpret.
     *
     * AN EMPTY CELL INSIDE `resolves` IS NOT AN ERROR EITHER. Ten of the sixty-six
     * cells are open questions for the owner (26.2), two of them live. A consumer
     * whose cell is empty says "not computed"; it does not substitute.
     */
    /**
     * GH-742 (queue item 3ad) - THE NAME OF A METHODOLOGY, FROM THE ONE PLACE THAT OWNS IT.
     *
     * The panel named the soil part of the analysis by a fixed word, so every site was told `MLSN`
     * whatever its settings said. The name comes from the `values` of `turf.methodology` in the
     * inputs list now, beside the keys, the way a construction's name does (GH-656).
     *
     * A key the list does not carry returns `null` rather than itself: a word this project has not
     * declared is not a word to print at a client. An absent methodology - a site that has not
     * finished its wizard - is the same answer, and nothing is substituted for it.
     */
    public static function methodologyLabel(?string $value): ?string
    {
        if (! is_string($value) || trim($value) === '') {
            return null;
        }
        $values = self::all()['inputs']['turf.methodology']['values'] ?? [];
        $entry = $values[trim($value)] ?? null;
        $label = is_array($entry) ? ($entry['label'] ?? null) : null;

        return (is_string($label) && $label !== '') ? $label : null;
    }

    /**
     * GH-742 (reviewer's return) - THE WORD FOR THE SOIL PART OF THE ANALYSIS.
     *
     * The site's methodology names it. Where no DECLARED methodology names it - a site whose wizard
     * is not finished, or a stored value this list does not carry - the answer is the word the list
     * holds for that case, and it is not the name of a methodology: the step's own word was `MLSN`,
     * so an absence was read by a client as a choice, and nothing is ever filled with `mlsn`.
     *
     * Null only if the list carries no word at all, which `Gh742` asserts it does.
     */
    public static function methodologySoilStepLabel(?string $value): ?string
    {
        $label = self::methodologyLabel($value);
        if ($label !== null) {
            return $label;
        }
        $word = self::all()['inputs']['turf.methodology']['labelWhenUndeclared'] ?? null;

        return (is_string($word) && $word !== '') ? $word : null;
    }

    /**
     * GH-744 (queue item 3bu) - EVERY WORD A SURFACE PRINTS FOR A METHODOLOGY, FROM ONE PLACE.
     *
     * Four kinds of text, each saying something different, lived in four surfaces: the name
     * (`label`), the topbar's abbreviation (`short`), what the Settings chooser adds to the name -
     * the full name of MLSN and SLAN, the lab of ammonium acetate (`fullName` / `lab`) - and the
     * wizard's explaining sentence (`description`). They sit in the `values` of `turf.methodology`,
     * verbatim from the screen, so no screen changes. There is no `labelLong`: "Hill Labs NZ" is a
     * lab, not a longer spelling of a name, and the chooser builds its line from the field that says
     * which it is. A value the list does not carry answers null to every one of these.
     */
    public static function methodologyValue(?string $value): ?array
    {
        if (! is_string($value) || trim($value) === '') {
            return null;
        }
        $entry = (self::all()['inputs']['turf.methodology']['values'] ?? [])[trim($value)] ?? null;

        return is_array($entry) ? $entry : null;
    }

    /** The topbar's abbreviation, or null for a value the list does not carry. */
    public static function methodologyShort(?string $value): ?string
    {
        $short = self::methodologyValue($value)['short'] ?? null;

        return (is_string($short) && $short !== '') ? $short : null;
    }

    /** The Settings chooser's line: the name and its full name, or the name and its lab. */
    public static function methodologyChoiceText(string $value): ?string
    {
        $v = self::methodologyValue($value);
        if (! $v || empty($v['label'])) {
            return null;
        }
        if (! empty($v['fullName'])) {
            return $v['label'].' — '.$v['fullName'];
        }
        if (! empty($v['lab'])) {
            return $v['label'].' ('.$v['lab'].')';
        }

        return $v['label'];
    }

    /** Every methodology the list carries, in its order, for the Settings chooser. */
    public static function methodologyChoices(): array
    {
        $out = [];
        foreach (array_keys(self::all()['inputs']['turf.methodology']['values'] ?? []) as $value) {
            $text = self::methodologyChoiceText($value);
            if ($text !== null) {
                $out[$value] = $text;
            }
        }

        return $out;
    }

    /** What the wizard prints for each methodology: its name and its sentence. */
    public static function methodologyValuesForWizard(): array
    {
        $out = [];
        foreach (self::all()['inputs']['turf.methodology']['values'] ?? [] as $id => $v) {
            $out[] = ['id' => $id, 'label' => $v['label'] ?? null, 'description' => $v['description'] ?? null];
        }

        return $out;
    }

    public static function resolveConstruction(?array $config): ?array
    {
        $value = $config['turf']['construction'] ?? null;
        if (! is_string($value) || trim($value) === '') {
            return null;
        }
        $value = trim($value);

        $values = self::all()['inputs']['turf.construction']['values'] ?? [];
        $entry = $values[$value] ?? null;
        if (! is_array($entry)) {
            return ['value' => $value, 'label' => null, 'resolves' => [], 'known' => false];
        }

        // Only the cells that carry an answer. An empty cell is the owner's open
        // question, and handing it over as `null` inside a resolved object would
        // invite a reader to treat it as a value.
        $resolves = [];
        foreach (($entry['resolves'] ?? []) as $consumer => $answer) {
            if ($answer !== null) {
                $resolves[$consumer] = $answer;
            }
        }

        return [
            'value' => $value,
            'label' => $entry['label'] ?? null,
            'resolves' => $resolves,
            'known' => true,
        ];
    }

    public static function readingsMap(string $key): ?string
    {
        $entry = self::entry($key);
        $readings = $entry['readings'] ?? null;

        return is_string($readings) ? $readings : null;
    }
}
