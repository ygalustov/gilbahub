/**
 * =============================================================================
 * GILBA HUB — ZONE KEY DERIVATION (b35fix311_1)
 * =============================================================================
 *
 * Single source of truth for deriving a stable zone identity from a sample.
 * A "zone" is the physical location (Green 1, Fairway 7, Pitch 3) that a
 * sample represents. Multiple samples for the same zone across time all
 * resolve to the same zone key, enabling:
 *
 *   - Trend analysis (nutrient-trend.js): aggregate samples over time per zone
 *   - Combined export collapse (word-export-combined.js): one recommendation
 *     section per zone, using the latest sample as source
 *   - Future: council-scale aggregation, region rollups
 *
 * Stripping strategy: remove temporal qualifiers (dates, quarters, months,
 * years, seasons) from the sample label so samples named
 *   "Green 10 (June 2025)", "Green 10 Q1 2024", "Green 10 spring"
 * all collapse to the zone key "green 10".
 *
 * History: this logic was duplicated across word-export-combined.js
 * (deriveZoneKeyLocal) and nutrient-trend.js (deriveZoneKey) with a
 * "keep in sync" comment — a latent bug source if one file was updated
 * and the other forgotten. b35fix311_1 extracts to this module; both
 * consumers now call GaipZoneKey.derive(sample).
 *
 * @author Gilba Solutions
 * @version 1.0.0 (b35fix311_1)
 * =============================================================================
 */

(function(global) {
    'use strict';

    /**
     * Derive a stable zone key from a sample record.
     * Accepts anything with a `label` or `id` (or a bare string, for edge cases).
     * Returns a lowercase, trimmed string with temporal qualifiers stripped.
     *
     * @param {object|string} sample - sample record or raw label string
     * @returns {string} zone key (lowercase, trimmed, temporally normalised)
     */
    function derive(sample) {
        // Accept both sample objects and raw strings
        var key;
        if (typeof sample === 'string') {
            key = sample;
        } else if (sample && typeof sample === 'object') {
            key = sample.label || sample.id || '';
        } else {
            return '';
        }

        var original = key;

        // Strip auto-dedup parenthetical suffixes e.g. "(2026-02-13)" or "(2026-02-13 14:30)"
        key = key.replace(/\s*\(\d{4}-\d{2}-\d{2}(?:\s+\d{2}:\d{2})?\)\s*$/, '');

        // b35fix311_1: strip full date patterns BEFORE stripping lone year
        // numbers. Previously the year regex fired first, leaving fragments
        // like "/02/13" behind when the input contained "2026/02/13". Tests
        // in zone-key.test.js lock this ordering in.
        key = key.replace(/\b\d{4}[\/-]\d{1,2}[\/-]\d{1,2}\b/g, '');
        key = key.replace(/\b\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4}\b/g, '');

        // Strip quarter/half references
        key = key.replace(/\b[Qq][1-4]\b/g, '');
        key = key.replace(/\b[Hh][12]\b/g, '');

        // Strip month names (English)
        key = key.replace(/\b(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\b/gi, '');

        // Strip 4-digit years (2000-2099) — lone years only; full dates
        // were already handled above.
        key = key.replace(/\b20\d{2}\b/g, '');

        // Strip seasonal words
        key = key.replace(/\b(spring|summer|autumn|fall|winter)\b/gi, '');
        key = key.replace(/\b(pre|post|mid)\s*-?\s*(season|summer|winter|spring|autumn)\b/gi, '');

        // Strip standalone "test" or "sample" with optional number
        key = key.replace(/\b(test|sample|report)\s*#?\d*\b/gi, '');

        // b35fix310a Fix C: strip empty parens left by prior replacements
        // (e.g. "Green 10 (June 2025)" → "Green 10 (  )" → "Green 10")
        key = key.replace(/\(\s*\)/g, '');

        // Normalize whitespace, underscores, hyphens → single space, then trim
        key = key.replace(/[\s_-]+/g, ' ').trim().toLowerCase();

        // Fallback: if stripping removed everything, use the original label/id
        return key || String(original).toLowerCase().trim();
    }

    /**
     * GH-549 — WHAT A ZONE WITH NO NAME IS CALLED, in one place.
     *
     * The owner's decision of 22.09.2026, twice: "do not substitute — on screen
     * 'a zone with no name', and group by identifier internally without showing
     * it", and then, for the report: "it must be the same as in the interface.
     * If there is no name, there is none in the interface either, but the sample
     * itself is displayed. And it must be the same in the report."
     *
     * So three rules, and the third is the one that costs something:
     *   - nothing is substituted: not the identifier, not a position number;
     *   - the sample is still shown, with its own figures;
     *   - the screen and the document say the SAME thing, which is why this
     *     constant lives in the module both of them already load rather than
     *     once in each.
     *
     * WHAT IS PRINTED, and why it is nothing rather than a word. The owner
     * offered two forms — "the name's place is empty, or carries an explicit
     * mark that there is no name" — and left the choice here. It is the empty
     * one, for a reason worth writing down: a mark is a non-empty string
     * standing where a name is missing, which is the exact shape
     * `gh477-substitution-for-emptiness.test.js` exists to catch, and that
     * ratchet may shrink and may not grow. Printing "Unnamed" was measured and
     * adds two entries to it. The empty form removes a substitution instead of
     * exchanging one for another, and it is the owner's own first alternative.
     *
     * What it costs, said out loud rather than discovered: two unnamed zones on
     * the same chart read alike and cannot be told apart. Numbering them was
     * ruled out by name — a position number is a name nobody gave the zone, and
     * it changes when the sort order changes. Grouping is unaffected: that is
     * `derive()` above, which keeps them apart by identity. The sample itself is
     * still drawn, with its own figures, which is the requirement.
     */
    var UNNAMED = '';

    /**
     * What `sample-manager.js`'s `generateSampleId()` produces: `Type_N_hash`,
     * where the hash is base-36 from `Date.now()`. A slugged label cannot take
     * this shape, which is what makes it a signature rather than a guess.
     */
    var GENERATED_ID = /^[A-Za-z][A-Za-z0-9]*_\d+_[0-9a-z]{4,}$/;

    /**
     * The name to print for a zone or a sample.
     *
     * Accepts either shape — a zone entry `{label}` from the analysis result or
     * a sample record — because the screen holds one and the document holds the
     * other, and one answer is the point.
     */
    function displayName(subject) {
        var label = subject && typeof subject === 'object'
            ? subject.label
            : subject;
        label = typeof label === 'string' ? label.trim() : '';

        // GH-563 — A LABEL THAT IS A GENERATED IDENTIFIER IS NOT A NAME.
        //
        // The substitution used to happen when a sample was SAVED, not when it
        // was printed: `sample-manager.js` stored `label: sampleData.label ||
        // sampleId`, so a sample nobody named was written down as
        // `Soil_1_3cbn`. That is fixed at the source, and it fixes nothing for
        // the samples already in the store — their label IS the identifier.
        //
        // WHY "GENERATED" AND NOT SIMPLY "EQUAL TO THE ID". The first draft of
        // this rule was `label === id`, and it ate real names: an id is derived
        // from the label by slugging it, so a sample genuinely called `green_1`
        // gets the id `green_1` and would have lost its name. Caught by
        // `gh372-tissue-sample-selection-consistency`, whose zones are named
        // exactly as their ids.
        //
        // `generateSampleId()` produces `Type_N_hash` — `Soil_1_3cbn` — and a
        // slug never does, because slugging lowercases and cannot invent a
        // four-character base-36 suffix. So the shape is the signature, and a
        // label matching it while ALSO being the id is the store's own
        // invention, not anybody's name.
        if (label && subject && typeof subject === 'object' && subject.id != null
            && label === String(subject.id).trim() && GENERATED_ID.test(label)) {
            return UNNAMED;
        }

        return label || UNNAMED;
    }

    global.GaipZoneKey = { derive: derive, displayName: displayName, UNNAMED: UNNAMED };
})(typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : this));
