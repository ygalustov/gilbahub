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

    /**
     * GH-797: the third answer of `heldForInput` — a storage this class cannot read. `RunStart::UNKNOWN`
     * is this constant, so the word a caller compares against has one declaration.
     */
    public const UNKNOWN = 'unknown';

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

    /**
     * GH-789 (queue item 7): the turf types the list itself declares, so a reader that answers per
     * type does not carry its own copy of the three names.
     *
     * @return array<int,string>
     */
    public static function turfTypes(): array
    {
        $types = self::all()['turfTypes'] ?? [];

        return is_array($types) ? array_values(array_filter($types, 'is_string')) : [];
    }

    /**
     * GH-777 (queue item 4, O-9) — EVERY PLACE THE LIST DECLARES, key to the words a person reads.
     *
     * The words belong to the owner and change without code changing, so what is checked of them is their
     * SHAPE: a page and its tab, spelled the way the screen spells them. The `$comment` of the `places` map
     * says the same from the other side.
     *
     * @return array<string,string>
     */
    public static function places(): array
    {
        $places = self::all()['places'] ?? [];
        $words = [];
        foreach ($places as $key => $value) {
            if ($key === '$comment') {
                continue;
            }
            $words[$key] = is_string($value) ? $value : '';
        }

        return $words;
    }

    /** @return array<string,mixed>|null one input's declaration */
    public static function entry(string $key): ?array
    {
        $entry = self::all()['inputs'][$key] ?? null;

        return is_array($entry) ? $entry : null;
    }

    /**
     * GH-777 (queue item 4, O-9) — THE HUMAN NAME OF AN INPUT, and it is data rather than code.
     *
     * The sentence a client reads about an empty section is the owner's, approved 24.09.2026:
     * "{Module} was not calculated because {label} has not been entered. Add it in {place}." The words
     * are the analyst's draft (her sections 49 and 49.4) and the owner may change any of them without a
     * line of this code changing -- which is the point of keeping them in the list.
     *
     * `null` means no name has been written for that input, and then no sentence is composed at all:
     * three inputs are deliberately without one (`pgr.enabled`, which has nowhere to be entered, and the
     * two irrigation numbers the owner decided on 29.09.2026 are not asked for).
     */
    public static function label(string $key): ?string
    {
        $label = self::entry($key)['label'] ?? null;

        return is_string($label) && trim($label) !== '' ? $label : null;
    }

    /**
     * GH-777 (queue item 4, O-9) — MAY A CLIENT BE TOLD ABOUT THIS INPUT AT ALL?
     *
     * The switch the owner decided on 24.09.2026 at 17:24, in her words "it turns the message to the
     * client off entirely". It is `false` for an input whose ADDRESS would be wrong or unreachable -- the
     * root depth lives in a tab only a sports site is shown, one Settings field answers for two keys --
     * and for the two irrigation numbers she decided are not asked for. A sentence with a wrong address
     * is worse than none (the analyst's 49.1), and each `false` carries its reason beside it.
     */
    public static function explainToClient(string $key): bool
    {
        return (self::entry($key)['explainToClient'] ?? true) !== false;
    }

    /**
     * GH-777 (queue item 4, O-9) — WHERE A PERSON GOES TO ENTER IT, in the words the list declares.
     *
     * `filledIn` carries the KEYS of the places; `places` carries their words, one per place rather than
     * one per input. A step of the wizard is never the answer: a person does not go back to it (the
     * analyst's 49.3).
     *
     * THE TRAFFIC & WEAR TAB IS SHOWN TO A SPORTS SITE ONLY (`settings.blade.php`), so it is a place for a
     * sports site and for no other -- naming it elsewhere would send someone to a tab that is not there.
     * Where an input has several places, the first that this site can actually reach is the answer.
     *
     * AND A SITE WHOSE KIND NOBODY NAMED IS NOT A SPORTS SITE EITHER. This read "no place is ruled out
     * when the type is absent", which is a default in the shape of a caution: measured over the stand, 0 of
     * 95 stored runs carry a turf type, so that branch answered for every live site there is and sent all
     * of them to a tab 10 of 21 sites are not shown. An unknown kind of site is an outcome -- no place, and
     * therefore no sentence -- exactly as an input with no place is (GH-777).
     *
     * `null` means there is nowhere to send a person, and then the sentence is not composed.
     */
    public static function placeFor(string $key, ?string $turfType = null): ?string
    {
        $places = self::all()['places'] ?? [];
        foreach ((array) (self::entry($key)['filledIn'] ?? []) as $where) {
            if (! is_string($where) || str_starts_with($where, 'wizard.')) {
                continue;
            }
            if ($where === 'settings.trafficAndWear' && $turfType !== 'sports') {
                continue;
            }
            $words = $places[$where] ?? null;
            if (is_string($words) && $words !== '') {
                return $words;
            }
        }

        return null;
    }

    /**
     * GH-777 (queue item 4, slice 2, the analyst's answer of 29.09.2026) — WHICH INPUT OF THIS LIST A
     * NAME FROM THE RUN'S OWN STATE BELONGS TO.
     *
     * TWO VOCABULARIES, ONE DECLARATION. The dependency graph names an input the way the run's state
     * holds it -- `water.ecw`, `soil.CEC`, `turf.hoc` -- because that is what a gate in the pass can
     * check. This list is keyed by the INPUT a person fills in (`samples.water`), and it already
     * declares the state's spellings for each: `readAs`. Measured by the analyst over the graph's 66
     * distinct names: 16 are keys of this list, 50 are `readAs` aliases, 0 are unknown, and no alias
     * belongs to two entries.
     *
     * WHAT WENT WRONG WITHOUT IT. The walk of slice 2 records `missing: ['water.ecw']` for a site with
     * no water, and the server looked for that name among the keys alone -- so it answered "the run
     * named an input the list does not declare", which is OUR side and offers a re-run that cannot
     * help. Nine of the thirteen sites with a run have no water sample and would have got that on their
     * next pass, instead of "there is no water test for this site".
     *
     * `requires` IS NOT REWRITTEN, and that is the analyst's decision with its reason: `samples.water`
     * covers eleven state names, so a gate on the sample would be coarser than a gate on the reading --
     * a water test with no ECw would pass it and salinity would report a failure instead of an honest
     * inapplicability. The browser reads no `readAs` either; the translation lives here, once.
     *
     * @return string|null the key of this list, or null when the list truly does not know the name
     */
    public static function inputFor(string $name): ?string
    {
        static $aliases = null;
        if ($aliases === null) {
            $aliases = [];
            foreach (self::all()['inputs'] as $key => $entry) {
                if (! is_array($entry)) {
                    continue;
                }
                foreach ((array) ($entry['readAs'] ?? []) as $alias) {
                    if (is_string($alias) && $alias !== '' && ! isset($aliases[$alias])) {
                        $aliases[$alias] = $key;
                    }
                }
            }
        }
        if (self::entry($name) !== null) {
            return $name;
        }

        return $aliases[$name] ?? null;
    }

    /**
     * GH-777 (queue item 4, the analyst's 76.4 B) — WHERE THIS INPUT'S VALUE LIVES.
     *
     * A different question from `filledIn`, which says where a PERSON enters it, and the two differ
     * for three inputs of the list today: the soil texture override is a column of `sites`, and the
     * two `pgr.*` inputs may be entered in the spray log. `RunStart` was reading the config for every
     * input, so those came out "not filled" and the client was told it had not entered a value it had
     * entered.
     *
     * `null` means the input is not declared at all — the caller must not read that as "nothing
     * stores it", which is what an empty list says.
     *
     * @return array<int,string>|null
     */
    public static function storedIn(string $key): ?array
    {
        $entry = self::entry($key);
        $stored = $entry['storedIn'] ?? null;

        return is_array($stored) ? array_values(array_filter($stored, 'is_string')) : null;
    }

    /**
     * GH-777 (the reviewer's return) — THE CONFIG PATHS THIS INPUT'S VALUE IS ACTUALLY WRITTEN AT.
     *
     * `storedIn` says the kind of storage; this says where inside the config, for the inputs whose key
     * is not the path. Six are: the irrigation efficiency is saved as `irrigation.efficiency`, the soil
     * moisture, the root depth and the three Clegg readings under `traffic.schedule.*`, the two LED
     * fields under `turf.led.*`. A reader that walked the key instead found nothing and the server told
     * the client it had entered nothing — measured on the stand, 3 sites for the first and 2 for the
     * second.
     *
     * Empty list means the key is the path, which is the ordinary case.
     *
     * @return array<int,string>
     */
    public static function storedAs(string $key): array
    {
        $entry = self::entry($key);
        $paths = $entry['storedAs'] ?? null;

        return is_array($paths) ? array_values(array_filter($paths, 'is_string')) : [];
    }

    /**
     * GH-789 (queue item 7) — THE ONE RULE OF "FILLED", and there is no second one.
     *
     * Two lived in the tree: `RunStart::filled`, which decides what a client is told it has or has not
     * entered, and `EnsureSiteIsSetUp::isBlank`, which decides whether the setup wizard still holds a site.
     * They disagreed about an OBJECT: both called a non-empty array filled, so a schedule of nothing but
     * `null`s counted as entered — and the Settings form sends every key it has on every save, so that was
     * every save. One rule, and it lives beside the list because it READS the list.
     *
     * WHAT COUNTS:
     *   - `null` — not filled;
     *   - a string — filled when it is not whitespace;
     *   - an array with `filledWhenAnyOf` declared — filled when any of THOSE fields carries a value;
     *   - any other array — filled when it is not empty, which is what both rules said before;
     *   - anything else, a number or a boolean — filled. **0 IS FILLED**: nought matches a week is a week
     *     with no load, which is an answer. The owner entered exactly that on six sites on 30.09.2026, by
     *     the product's own route, and a rule that read it as absence would have shut those sites out of
     *     every page the lock holds.
     *
     * @param  string  $key    the input's key in the list
     * @param  mixed   $value  what the site holds at that key
     */
    public static function isFilled(string $key, $value): bool
    {
        if ($value === null) {
            return false;
        }
        if (is_string($value)) {
            return trim($value) !== '';
        }
        if (is_array($value)) {
            $anyOf = self::filledWhenAnyOf($key);
            if ($anyOf !== []) {
                foreach ($anyOf as $field) {
                    if (array_key_exists($field, $value) && self::isFilled($key . '.' . $field, $value[$field])) {
                        return true;
                    }
                }

                return false;
            }

            return $value !== [];
        }

        return true;
    }

    /**
     * The fields of an object input that make it filled, as the list declares them — or an empty list, which
     * means the input is not an object with such a declaration and the ordinary rule applies.
     *
     * @return array<int,string>
     */
    public static function filledWhenAnyOf(string $key): array
    {
        $entry = self::entry($key);
        $fields = $entry['filledWhenAnyOf'] ?? null;

        return is_array($fields) ? array_values(array_filter($fields, 'is_string')) : [];
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
            /**
             * GH-789 (queue item 7) — AND THE STEP A TURF TYPE'S OWN BRANCH NAMES.
             *
             * `turf.subCategory` declared `byTurfType.golf.wizard.step: 2` and nothing read it, so
             * the wizard kept its own line for it (`turfType === 'golf' && !subCategory` in
             * `_canProceed`) and the lock did not ask for a golf surface at all: a golf site created
             * past the wizard walked through. The branch is where a conditional obligation is
             * declared, so it is also where that obligation's step is read from.
             */
            $branchStep = $entry['byTurfType'][$turfType]['wizard']['step'] ?? null;
            if (is_int($branchStep)) {
                $byStep[$branchStep][] = $key;
            }
        }
        foreach ($byStep as $step => $keys) {
            $byStep[$step] = array_values(array_unique($keys));
        }
        ksort($byStep);

        return ['byStep' => $byStep, 'unparsed' => array_values(array_unique($unparsed))];
    }

    /**
     * GH-789 (queue item 7) — THE SAME ANSWER FOR EVERY TURF TYPE, BECAUSE THE TYPE IS CHOSEN INSIDE
     * THE WIZARD.
     *
     * A page receives this once, at load, when a new site has no turf type at all; the person then
     * picks one on step 2, and from that click on it is the branch of the CHOSEN type that says what
     * the step must collect. Sending only the stored type's branch is what left the wizard with its
     * own hand-written condition for golf, and what would let a brand-new sports site past step 2
     * with no schedule.
     *
     * The empty key is a site that has not answered its type yet.
     *
     * @return array<string, array<int, list<string>>>
     */
    public static function wizardStepsByTurfType(): array
    {
        $out = ['' => self::wizardStepsFor('')['byStep']];
        foreach (self::turfTypes() as $type) {
            $out[$type] = self::wizardStepsFor($type)['byStep'];
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
    /**
     * GH-789 (queue item 7) — THE REQUIRED INPUTS A PLACE COLLECTS, for a site of this turf type.
     *
     * The server judges a save by its PLACE: a Settings tab answers for the fields it collects and for no
     * others, which is the owner's "as usual in settings" -- saving Site settings is not refused because
     * the cultivar on the Turf tab is empty. The place keys are the ones the list already declares in
     * `places` and each input names in its own `filledIn`, so nothing here is a second list.
     *
     * @return array<int,string>
     */
    public static function requiredAtPlace(string $place, string $turfType): array
    {
        if ($place === '') {
            return [];
        }
        $out = [];
        foreach (self::requiredFor($turfType) as $key) {
            $entry = self::entry($key);
            if (in_array($place, (array) ($entry['filledIn'] ?? []), true)) {
                $out[] = $key;
            }
        }

        return $out;
    }

    /**
     * GH-789 (queue item 7): the inputs whose obligation is not tied to a place — judged on every write to
     * a site's config, whatever the write was about. Declared, with its reason, in the entry itself.
     *
     * @return array<int,string>
     */
    public static function requiredOnEveryWrite(): array
    {
        $out = [];
        foreach (self::all()['inputs'] as $key => $entry) {
            if (is_array($entry) && ($entry['requiredOnEveryWrite'] ?? null) === true) {
                $out[] = (string) $key;
            }
        }

        return $out;
    }

    /**
     * GH-789 (queue item 7): the value a config holds for an input, by the list's own dotted key.
     *
     * One reader, because the lock, the run record and the server's refusal must not spell a path three
     * ways: one of them answering "missing" while another answers "here is your value" about the same
     * field is the shape of the defect this queue item closes.
     *
     * @param  array<string,mixed>  $config
     * @return mixed
     */
    public static function valueIn(array $config, string $key)
    {
        $at = $config;
        foreach (explode('.', $key) as $step) {
            if (! is_array($at) || ! array_key_exists($step, $at)) {
                return null;
            }
            $at = $at[$step];
        }

        return $at;
    }

    /**
     * GH-797 (queue item 3ashch) — WHAT A SITE HOLDS FOR AN INPUT, ASKED IN ONE PLACE BY EVERY READER.
     *
     * Three readers of this fact lived in the tree and only one of them knew that an input may be stored
     * outside the config. `RunStart` reads `storedIn` and has a reader per storage; the setup lock and the
     * server's refusal walked the config alone (`valueIn`). The soil texture is the first input the owner
     * makes required that is NOT kept in the config -- it is a column of `sites` -- so for those two the
     * answer would have been "not filled" on every site, including the ones that carry a texture, and the
     * lock would have closed all of them. The reader that knew better was shut inside the run record; it is
     * here now, and the lock, the wizard's answers, the refusal and `RunStart` all ask it.
     *
     * TWO FACTS IN ONE ANSWER, because the callers want both and must not disagree about them: `held` is
     * whether a value is there (`isFilled`, the one rule), and `value` is the value that made it so -- what
     * the wizard reopens with. A second reader for the value would be free to find it at another path.
     *
     * `held` is `true` / `false` / `UNKNOWN`, and UNKNOWN is the honest answer when the input declares no
     * storage at all or declares one this class cannot read. A storage a CALLER can read it passes in
     * `$otherStorages` as `storage => fn (string $key): bool|string` -- returning UNKNOWN is its third
     * answer too, and it travels. The spray log is such a storage: it is a
     * table with its own column map, declared where its only consumer already declares it, and bringing
     * that query in here would put the database behind every reader of the list.
     *
     * @param  array<string,mixed>  $config  the site's gaip config
     * @param  \App\Models\Site|null  $site  the row, for an input stored in a column of `sites`
     * @param  array<string,callable>  $otherStorages
     * @return array{held: bool|string, value: mixed}
     */
    public static function heldForInput(string $key, array $config, $site = null, array $otherStorages = []): array
    {
        $stored = self::storedIn($key);
        if ($stored === null) {
            return ['held' => self::UNKNOWN, 'value' => null];
        }

        $held = false;
        $value = null;
        foreach ($stored as $storage) {
            $answer = match ($storage) {
                'config' => self::heldInConfig($config, $key),
                'siteColumn' => self::heldInSiteColumn($site, $key),
                default => isset($otherStorages[$storage]) && is_callable($otherStorages[$storage])
                    ? ['held' => $otherStorages[$storage]($key), 'value' => null]
                    : ['held' => self::UNKNOWN, 'value' => null],
            };
            if ($answer['held'] === self::UNKNOWN) {
                return ['held' => self::UNKNOWN, 'value' => null];
            }
            if ($answer['held'] && ! $held) {
                $value = $answer['value'];
            }
            $held = $held || $answer['held'];
        }

        return ['held' => $held, 'value' => $value];
    }

    /**
     * GH-797: the column of `sites` an input is kept in, named by the input's own key.
     *
     * One declaration of that rule, because two readers need it: this class, to answer what the site
     * holds, and the site route, to see whether a request empties it.
     */
    public static function siteColumnOf(string $key): ?string
    {
        if (! in_array('siteColumn', self::storedIn($key) ?? [], true)) {
            return null;
        }
        if (! str_starts_with($key, 'sites.')) {
            return null;
        }
        $column = substr($key, strlen('sites.'));

        return $column === '' ? null : $column;
    }

    /**
     * GH-797: the config, AT THE PATHS THE WRITER WRITES (`storedAs`), which is what `RunStart` has read
     * since GH-777 and what moved here with it.
     *
     * GH-777's reason, kept because the measurement is the reason: a reader that walked the input's own
     * key found nothing for the six inputs whose writer puts the value elsewhere, and the client was told
     * it had entered nothing — `irrigation.efficiency` on 3 stand sites, `traffic.schedule.moisture` on 2.
     * An input with several paths (the three Clegg readings are one input) is held when ANY of them
     * carries a value: the input is the reading, and a person who entered one entered it.
     *
     * Measured before this moved, 01.10.2026: of the nine inputs the list requires today not one declares
     * `storedAs`, so the lock and the refusal — which walked the key alone — are answered exactly as
     * before. The seven that declare it are required of no turf type.
     *
     * @param  array<string,mixed>  $config
     * @return array{held: bool, value: mixed}
     */
    private static function heldInConfig(array $config, string $key): array
    {
        $paths = self::storedAs($key);
        foreach ($paths === [] ? [$key] : $paths as $path) {
            $value = self::valueIn($config, $path);
            if (self::isFilled($key, $value)) {
                return ['held' => true, 'value' => $value];
            }
        }

        return ['held' => false, 'value' => null];
    }

    /**
     * GH-797: a column of `sites`, and ONLY that column.
     *
     * The account's own `soil_texture` is NOT in this chain, and that is the whole point of the reader
     * rather than a detail of it: the pages resolve a texture as `soil_texture_override ?: account->
     * soil_texture` and the account column carries the schema's default, so a chain ending there answers
     * "filled" for every site that ever existed and an obligation built on it would require nothing.
     *
     * A column the model does not carry is UNKNOWN rather than empty: the alternative is telling a client
     * it entered nothing because we looked in the wrong table.
     *
     * @return array{held: bool|string, value: mixed}
     */
    private static function heldInSiteColumn($site, string $key): array
    {
        $column = self::siteColumnOf($key);
        if ($column === null || $site === null) {
            return ['held' => self::UNKNOWN, 'value' => null];
        }
        $attributes = is_object($site) && method_exists($site, 'getAttributes') ? $site->getAttributes() : [];
        if (! array_key_exists($column, $attributes)) {
            return ['held' => self::UNKNOWN, 'value' => null];
        }
        $value = $attributes[$column];

        return ['held' => self::isFilled($key, $value), 'value' => $value];
    }

    /**
     * GH-789 (queue item 7): the words for every input the setup wizard can name, key to label.
     *
     * The wizard refuses a step by naming the field, and the words a person reads belong to the list.
     * A page that wrote its own would be a second declaration of the same thing; the server's own
     * refusal (422 `missing: [{input, label}]`) reads them from here too, so both say one sentence
     * about one field.
     *
     * @return array<string,string>
     */
    public static function labelsForWizard(): array
    {
        $keys = [];
        foreach (self::wizardStepsByTurfType() as $byStep) {
            foreach ($byStep as $inputs) {
                foreach ($inputs as $key) {
                    $keys[$key] = true;
                }
            }
        }

        $out = [];
        foreach (array_keys($keys) as $key) {
            $label = self::label($key);
            if (is_string($label) && $label !== '') {
                $out[$key] = $label;
            }
        }

        return $out;
    }

    public static function methodologyValuesForWizard(): array
    {
        $out = [];
        foreach (self::all()['inputs']['turf.methodology']['values'] ?? [] as $id => $v) {
            $out[] = ['id' => $id, 'label' => $v['label'] ?? null, 'description' => $v['description'] ?? null];
        }

        return $out;
    }

    /**
     * GH-769 (queue item 3vs, position 2) - THE CONSTRUCTIONS A PERSON IS OFFERED, WHICH IS A
     * PROPERTY OF THE DECLARED VALUE AND NOT A LIST OF ITS OWN.
     *
     * The setup wizard offered all eleven declared constructions and the Settings form offered five
     * of its own, so a person could choose in the wizard what Settings could not show. A separate
     * list of the five would repeat the identifiers and could drift from, or reach past, the declared
     * values; the mark lives on the value instead, and this is the only reader of it. Both surfaces
     * take the result, as both take the methodology through `methodologyChoices()`.
     *
     * All eleven stay declared: their `resolves` answer for configs already saved.
     *
     * @return array<string,string> value => label, in the order the list declares them
     */
    public static function constructionChoices(): array
    {
        $out = [];
        foreach (self::all()['inputs']['turf.construction']['values'] ?? [] as $id => $v) {
            if (($v['offered'] ?? false) === true) {
                $out[$id] = $v['label'] ?? $id;
            }
        }

        return $out;
    }

    /**
     * GH-797 (queue item 3ashch) — THE SOIL TEXTURES A PERSON IS OFFERED, read where they are declared.
     *
     * Settings wrote the six out by hand, and the setup wizard now asks for the same field: a second
     * hand-written copy is what `turf.construction` had before GH-769, where the wizard read one list and
     * Settings another. Both surfaces take this, as both take the methodology through `methodologyChoices`.
     *
     * @return array<string,string> value => label, in the order the list declares them
     */
    public static function soilTextureChoices(): array
    {
        $out = [];
        foreach (self::all()['inputs']['sites.soil_texture_override']['values'] ?? [] as $id => $v) {
            $out[$id] = is_array($v) ? ($v['label'] ?? $id) : $id;
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
