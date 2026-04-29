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

    global.GaipZoneKey = { derive: derive };
})(typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : this));
