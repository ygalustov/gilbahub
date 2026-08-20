/**
 * Hill Labs Sample Types SSOT v1.0.0
 *
 * Source of truth for Hill Labs (NZ) per-sample-type sufficiency reference sets.
 *
 * Authority: Hill Laboratories Ltd (Hamilton NZ) prints the Medium / Optimum
 * reference range on every certificate, embedded in the histogram beside each
 * measured value. The reference set is sample-type-conditional, keyed on the
 * Hill Labs sample type code (S277, S81, S78, ...). This module reproduces
 * those printed ranges as the authoritative interpretation set for any GAIP
 * Hub artefact (docx export, MLSN card, amendment math) generated from a
 * Hill Labs report.
 *
 * Why a separate SSOT?
 * The existing `assets/ammonium-acetate-methodology.js` module covers the
 * BROADER extractant chemistry (Olsen + NH4OAc) and ships generic
 * "agricultural / horticultural / glasshouse" ranges that do NOT match what
 * Hill Labs prints on turf certificates. The lab uses NARROWER, sample-type-
 * specific reference sets calibrated for the species + rootzone class encoded
 * by the sample type code. Examples:
 *   S277 (TURF Ryegrass, Sand): Mg medium 0.30-0.70 me/100g
 *   KB3196 v7 page 3 Hort:      Mg medium 1.0-3.0  me/100g
 * Same lab, same extractant, different reference because S277 is calibrated
 * for sand-rootzone sportsturf.
 *
 * Threshold schema:
 *   { min, max, unit, axis, label }
 * - unit: 'me/100g' | '%BS' | 'mg/L' | 'mg/kg' | 'g/mL' | '%' | 'pH'
 * - axis: 'absolute' | 'proportion' | 'mass-ratio' | 'physical' | 'pH'
 *   - 'absolute': me/100g, mg/L, mg/kg (existing kg/ha math applies directly)
 *   - 'proportion': %BS (requires CEC plumbing to convert to me/100g, then ppm)
 *   - 'mass-ratio': K/Mg ratios etc, no amendment math
 *   - 'physical': VW, OM, TBS, CEC (diagnostic, not amendment-driving)
 *   - 'pH': pH only
 *
 * v1 coverage: S277 + S279 + S81 + S78. Add new codes when client certificates
 * surface them. Each new code REQUIRES a certificate in hand to read the
 * printed Medium ranges; do NOT infer from KB3196 page 3 or other secondary
 * sources.
 *
 * GH-258: this file is the JS half of a two-runtime SSOT. The identical
 * sample-type range data also lives in `resources/data/hill-labs-sample-
 * types.json`, read directly by the PHP side (`app/app/Support/
 * HillLabsSampleTypes.php`, used by `SampleAnalysisController`). There is no
 * asset build step in this repo, so the two copies can't be mechanically
 * unified — when a range changes here, update the JSON file too (and vice
 * versa). This was the actual bug class GH-258 fixes (AA thresholds had
 * drifted into 9 independent copies before this file existed as the SSOT);
 * keeping the count at exactly two (one per runtime, both reproduced from the
 * same certificates), each documented at the other's location, is the
 * deliberate stopping point given the tooling available.
 *
 * @author Gilba Solutions
 * @version 1.1.0 (GH-258, adds S279 + deriveCode()/getRangesPpm())
 */

(function(global) {
    'use strict';

    // ═══════════════════════════════════════════════════════════════════════
    // SAMPLE TYPE REFERENCE SETS
    // Each entry's ranges are reproduced VERBATIM from a Hill Labs certificate
    // histogram. Source certificate(s) cited per code. Do NOT modify ranges
    // without a fresh certificate confirming the lab has updated the printed
    // reference.
    // ═══════════════════════════════════════════════════════════════════════

    var HILL_LABS_TURF_SAMPLE_TYPES = {

        // ───────────────────────────────────────────────────────────────────
        // S277 — TURF Ryegrass, Sand
        // Source: Hagley Oval certificate, lab 4169173, Hill Labs, 14-Apr-2026
        // (Prebble Seeds Ltd, two samples Oval + Run Ups, both S277)
        // ───────────────────────────────────────────────────────────────────
        S277: {
            code: 'S277',
            label: 'TURF Ryegrass, Sand (S277)',
            description: 'Perennial ryegrass on sand-rootzone construction. Calibrated for low-CEC sand profiles (CEC medium 3-6 me/100g).',
            sourceCitation: 'Hill Labs certificate 4169173, Hagley Oval, 14-Apr-2026',
            thresholds: {
                pH:         { min: 5.5,  max: 6.5,  unit: 'pH',     axis: 'pH',         label: '5.5-6.5' },
                P:          { min: 20,   max: 30,   unit: 'mg/L',   axis: 'absolute',   label: '20-30 mg/L', extractant: 'Olsen' },
                K:          { min: 0.20, max: 0.50, unit: 'me/100g', axis: 'absolute',  label: '0.20-0.50 me/100g' },
                Ca:         { min: 2.0,  max: 4.0,  unit: 'me/100g', axis: 'absolute',  label: '2.0-4.0 me/100g' },
                Mg:         { min: 0.30, max: 0.70, unit: 'me/100g', axis: 'absolute',  label: '0.30-0.70 me/100g' },
                Na:         { min: 0.00, max: 0.20, unit: 'me/100g', axis: 'absolute',  label: '0.00-0.20 me/100g' },
                CEC:        { min: 3,    max: 6,    unit: 'me/100g', axis: 'physical',  label: '3-6 me/100g' },
                TBS:        { min: 35,   max: 80,   unit: '%',       axis: 'physical',  label: '35-80%' },
                VW:         { min: 0.60, max: 1.20, unit: 'g/mL',    axis: 'physical',  label: '0.60-1.20 g/mL' },
                OM:         { min: 2.0,  max: 4.0,  unit: '%',       axis: 'physical',  label: '2.0-4.0%' },
                KMgRatio:   { min: 0.3,  max: 1.0,  unit: 'ratio',   axis: 'mass-ratio', label: '0.3-1.0' }
            }
        },

        // ───────────────────────────────────────────────────────────────────
        // S279 — TURF Browntop, Sand
        // Source: Russley Golf Club certificate, lab 2606324, Hill Labs,
        // 13-May-2021 (3 samples: Green 1, Green 13, Green 18, all S279)
        // ───────────────────────────────────────────────────────────────────
        S279: {
            code: 'S279',
            label: 'TURF Browntop, Sand (S279)',
            description: 'Browntop bent on sand-rootzone construction. Same cation/CEC calibration as S277 (low-CEC sand profiles); pH, Olsen P and TBS differ by species/crop guide.',
            sourceCitation: 'Hill Labs certificate 2606324, Russley Golf Club, 13-May-2021',
            thresholds: {
                pH:         { min: 5.0,  max: 5.7,  unit: 'pH',     axis: 'pH',         label: '5.0-5.7' },
                P:          { min: 5,    max: 15,   unit: 'mg/L',   axis: 'absolute',   label: '5-15 mg/L', extractant: 'Olsen' },
                K:          { min: 0.20, max: 0.50, unit: 'me/100g', axis: 'absolute',  label: '0.20-0.50 me/100g' },
                Ca:         { min: 2.0,  max: 4.0,  unit: 'me/100g', axis: 'absolute',  label: '2.0-4.0 me/100g' },
                Mg:         { min: 0.30, max: 0.70, unit: 'me/100g', axis: 'absolute',  label: '0.30-0.70 me/100g' },
                Na:         { min: 0.00, max: 0.20, unit: 'me/100g', axis: 'absolute',  label: '0.00-0.20 me/100g' },
                CEC:        { min: 3,    max: 6,    unit: 'me/100g', axis: 'physical',  label: '3-6 me/100g' },
                TBS:        { min: 25,   max: 60,   unit: '%',       axis: 'physical',  label: '25-60%' },
                VW:         { min: 0.60, max: 1.20, unit: 'g/mL',    axis: 'physical',  label: '0.60-1.20 g/mL' },
                KMgRatio:   { min: 0.3,  max: 1.0,  unit: 'ratio',   axis: 'mass-ratio', label: '0.3-1.0' }
            }
        },

        // ───────────────────────────────────────────────────────────────────
        // S81 — TURF Fescue
        // Source: Luke Greenlees certificate, lab 3793159, Hill Labs, 05-Mar-2025
        // (Prebble Seeds Ltd, single sample "Fescue Turf", S81)
        // NOTE: S81 reports cations in %BS (proportion-of-CEC axis), NOT me/100g.
        // Amendment math must route via CEC for %BS → me/100g conversion.
        // ───────────────────────────────────────────────────────────────────
        S81: {
            code: 'S81',
            label: 'TURF Fescue (S81)',
            description: 'Fescue turf, native or amended soil. Calibrated for medium-CEC profiles (CEC medium 12-25 me/100g). Cations reported on %BS axis.',
            sourceCitation: 'Hill Labs certificate 3793159, Luke Greenlees / Mr B Lowe, 05-Mar-2025',
            thresholds: {
                pH:         { min: 5.0,  max: 7.2,  unit: 'pH',      axis: 'pH',         label: '5.0-7.2' },
                P:          { min: 8,    max: 20,   unit: 'mg/L',    axis: 'absolute',   label: '8-20 mg/L', extractant: 'Olsen' },
                K:          { min: 2.0,  max: 6.0,  unit: '%BS',     axis: 'proportion', label: '2.0-6.0 %BS' },
                Ca:         { min: 20,   max: 75,   unit: '%BS',     axis: 'proportion', label: '20-75 %BS' },
                Mg:         { min: 4.0,  max: 15.0, unit: '%BS',     axis: 'proportion', label: '4.0-15.0 %BS' },
                Na:         { min: 0.0,  max: 5.0,  unit: '%BS',     axis: 'proportion', label: '0.0-5.0 %BS' },
                CEC:        { min: 12,   max: 25,   unit: 'me/100g', axis: 'physical',   label: '12-25 me/100g' },
                TBS:        { min: 25,   max: 95,   unit: '%',       axis: 'physical',   label: '25-95%' },
                VW:         { min: 0.60, max: 1.00, unit: 'g/mL',    axis: 'physical',   label: '0.60-1.00 g/mL' },
                S:          { min: 20,   max: 50,   unit: 'mg/kg',   axis: 'absolute',   label: '20-50 mg/kg', extractant: 'Sulphate' },
                OrgS:       { min: 12,   max: 20,   unit: 'mg/kg',   axis: 'absolute',   label: '12-20 mg/kg' },
                KMgRatio:   { min: 0.3,  max: 1.0,  unit: 'ratio',   axis: 'mass-ratio', label: '0.3-1.0' }
            }
        },

        // ───────────────────────────────────────────────────────────────────
        // S78 — TURF Cotula (Bowls)
        // Pre-existing coverage in assets/cotula-bowling-green.js. This entry
        // is a thin reference pointer; the live ranges and interpretation
        // logic remain in the cotula module for v1. SSOT consolidation is
        // OQ22 candidate for SaaS port.
        // ───────────────────────────────────────────────────────────────────
        S78: {
            code: 'S78',
            label: 'TURF Cotula (S78)',
            description: 'Cotula bowling green. Live ranges in assets/cotula-bowling-green.js. SSOT consolidation pending OQ22.',
            sourceCitation: 'See assets/cotula-bowling-green.js (cotula module owns S78 thresholds for v1)',
            thresholds: null,  // delegated to cotula module
            delegatedTo: 'cotula-bowling-green.js'
        }
    };

    // ═══════════════════════════════════════════════════════════════════════
    // PUBLIC API
    // ═══════════════════════════════════════════════════════════════════════

    /**
     * Get the full reference set for a sample type code.
     * @param {string} code - Hill Labs sample type code (e.g. "S277", "S81")
     * @returns {object|null} Reference set object, or null if unknown code.
     */
    function getRanges(code) {
        if (!code) return null;
        var key = String(code).toUpperCase().trim();
        return HILL_LABS_TURF_SAMPLE_TYPES[key] || null;
    }

    /**
     * Get a single nutrient threshold within a sample type's reference set.
     * @param {string} code - Sample type code
     * @param {string} nutrient - Nutrient key (P, K, Ca, Mg, S, Na, CEC, etc.)
     * @returns {object|null} Threshold object {min, max, unit, axis, label}, or null.
     */
    function getThreshold(code, nutrient) {
        var ranges = getRanges(code);
        if (!ranges || !ranges.thresholds) return null;
        return ranges.thresholds[nutrient] || null;
    }

    /**
     * List all known sample type codes.
     * @returns {string[]} Array of code strings.
     */
    function listCodes() {
        return Object.keys(HILL_LABS_TURF_SAMPLE_TYPES);
    }

    /**
     * Convert a %BS value to ppm via CEC, for proportion-axis amendment math.
     * @param {number} pctBS - Cation as %BS (e.g. 4.0 for Mg %BS 4.0)
     * @param {number} cec - CEC in me/100g
     * @param {string} cation - 'K' | 'Ca' | 'Mg' | 'Na'
     * @returns {number|null} ppm, or null on bad input.
     */
    function pctBSToPpm(pctBS, cec, cation) {
        if (pctBS == null || cec == null || isNaN(pctBS) || isNaN(cec) || cec <= 0) return null;
        var conversionFactors = { K: 391, Ca: 200, Mg: 122, Na: 230 };
        var factor = conversionFactors[cation];
        if (!factor) return null;
        // %BS → me/100g: (pctBS / 100) × CEC
        // me/100g → ppm: × factor (Hill Labs KB3196 v7 page 3, VW-independent simplification)
        var meq100g = (pctBS / 100) * cec;
        return meq100g * factor;
    }

    /**
     * Convert a me/100g value to ppm for absolute-axis amendment math.
     * @param {number} meq100g - me/100g
     * @param {string} cation - 'K' | 'Ca' | 'Mg' | 'Na'
     * @returns {number|null} ppm, or null on bad input.
     */
    function meq100gToPpm(meq100g, cation) {
        if (meq100g == null || isNaN(meq100g)) return null;
        var conversionFactors = { K: 391, Ca: 200, Mg: 122, Na: 230 };
        var factor = conversionFactors[cation];
        if (!factor) return null;
        return meq100g * factor;
    }

    // ═══════════════════════════════════════════════════════════════════════
    // SPECIES + TEXTURE → SAMPLE-TYPE CODE (GH-258)
    // Single resolver every AA consumer should call instead of keeping its own
    // species/texture → code mapping. See file header for the "why a new
    // resolver" rationale (GH-258 — 9 independent AA range implementations
    // found, this + the PHP equivalent are meant to be the only two left).
    // ═══════════════════════════════════════════════════════════════════════

    /**
     * Map a canonical species (see SpeciesController.getSpecies()) + a general
     * soil-texture value (see sites.soil_texture_override /
     * accounts.soil_texture — six values: sand, loamy_sand, sandy_loam, loam,
     * clay_loam, clay) to a Hill Labs sample-type code.
     *
     * "Sand-ish" bucketing matches the rule already live in
     * SampleAnalysisController.php (stripos($soilTexture, 'sand')): any
     * texture value containing "sand" (sand, sandy_loam, loamy_sand) counts as
     * sand-rootzone; everything else (loam, clay_loam, clay) is native/soil.
     *
     * @param {string} species - Canonical species key (e.g. 'perennialRyegrass').
     *   Accepts raw/aliased species strings too via SpeciesController's own
     *   normalisation if available; falls back to case-sensitive canonical match.
     * @param {string} soilTexture - Value of soil_texture_override / soil_texture.
     * @returns {string|null} Sample-type code (S277/S279/S81/S78), or null if
     *   there's no certificate-backed match for this species/texture pair.
     */
    function deriveCode(species, soilTexture) {
        if (!species) return null;

        var canonical = species;
        if (typeof global !== 'undefined' && global.SpeciesController &&
            typeof global.SpeciesController.normalize === 'function') {
            canonical = global.SpeciesController.normalize(species) || species;
        }

        var texture = String(soilTexture || '').toLowerCase();
        var isSandy = texture.indexOf('sand') !== -1;

        if (canonical === 'cotula') return 'S78';
        if (canonical === 'fineFescue' || canonical === 'tallFescue') return 'S81';
        if (canonical === 'perennialRyegrass') return isSandy ? 'S277' : null;
        if (canonical === 'browntopBent') return isSandy ? 'S279' : null;

        // Uncovered: Bentgrass, Kentucky Bluegrass, Poa Annua, all C4 species
        // (couch, kikuyu, zoysia, buffalo, seashore_paspalum), and Ryegrass/
        // Browntop on non-sand rootzones — no certificate on file yet.
        return null;
    }

    /**
     * Resolve the general soil-texture value to pass into deriveCode(),
     * applying the same site-override-then-account-fallback chain already
     * established at SampleController.php:374
     * (`$site->soil_texture_override ?: $site->account->soil_texture`).
     * GH-258 item 2: the AA-specific rootzone field (`.gaip-aa-soil-texture`)
     * never persisted in the new hub, so every AA consumer should resolve
     * texture through this instead — one fallback chain, not one per caller.
     *
     * @param {string|null} siteOverride - sites.soil_texture_override.
     * @param {string|null} accountTexture - accounts.soil_texture.
     * @returns {string|null}
     */
    function resolveSoilTexture(siteOverride, accountTexture) {
        return siteOverride || accountTexture || null;
    }

    /**
     * Get a nutrient's sufficiency range in ppm for a resolved sample-type
     * code, converting from the certificate-native unit (me/100g or %BS) via
     * the existing conversion helpers. Callers needing amendment/requirement
     * math should use this instead of reading `getThreshold()`'s raw object.
     *
     * @param {string} code - Sample type code (e.g. "S277").
     * @param {string} nutrient - Nutrient key (P, K, Ca, Mg, S, Na, ...).
     * @param {number} [cec] - CEC in me/100g, required only when the matched
     *   threshold is on the proportion (%BS) axis (S81's cations).
     * @returns {{min:number, max:number}|null} ppm bounds, or null if the code
     *   is unknown, the nutrient has no threshold, the code delegates
     *   elsewhere (S78 → cotula-bowling-green.js), or a %BS threshold needs a
     *   CEC that wasn't supplied.
     */
    function getRangesPpm(code, nutrient, cec) {
        var thresh = getThreshold(code, nutrient);
        if (!thresh) return null;

        if (thresh.axis === 'absolute' && (thresh.unit === 'me/100g')) {
            var min = meq100gToPpm(thresh.min, nutrient);
            var max = meq100gToPpm(thresh.max, nutrient);
            if (min == null || max == null) return null;
            return { min: min, max: max };
        }
        if (thresh.axis === 'absolute') {
            // mg/L (Olsen P) / mg/kg (sulphate) are already numerically ppm.
            return { min: thresh.min, max: thresh.max };
        }
        if (thresh.axis === 'proportion' && thresh.unit === '%BS') {
            if (cec == null) return null;
            var pMin = pctBSToPpm(thresh.min, cec, nutrient);
            var pMax = pctBSToPpm(thresh.max, cec, nutrient);
            if (pMin == null || pMax == null) return null;
            return { min: pMin, max: pMax };
        }
        // physical / mass-ratio / pH axes aren't nutrient sufficiency ranges.
        return null;
    }

    // ═══════════════════════════════════════════════════════════════════════
    // EXPORT
    // ═══════════════════════════════════════════════════════════════════════

    var HillLabsSampleTypes = {
        version: '1.1.0',
        SAMPLE_TYPES: HILL_LABS_TURF_SAMPLE_TYPES,
        getRanges: getRanges,
        getThreshold: getThreshold,
        listCodes: listCodes,
        pctBSToPpm: pctBSToPpm,
        meq100gToPpm: meq100gToPpm,
        deriveCode: deriveCode,
        resolveSoilTexture: resolveSoilTexture,
        getRangesPpm: getRangesPpm
    };

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = HillLabsSampleTypes;
    }
    if (typeof global !== 'undefined') {
        global.HillLabsSampleTypes = HillLabsSampleTypes;
    }

    if (typeof console !== 'undefined' && console.log) {
        console.log('Hill Labs Sample Types SSOT v1.1.0 loaded,',
            Object.keys(HILL_LABS_TURF_SAMPLE_TYPES).length, 'codes:',
            Object.keys(HILL_LABS_TURF_SAMPLE_TYPES).join(', '));
    }

})(typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : this));
