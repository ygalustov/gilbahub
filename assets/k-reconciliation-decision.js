/**
 * =============================================================================
 * GAIP K-RECONCILIATION DECISION (shared, GH-292)
 * =============================================================================
 *
 * Extracted from word-export.js so pages that need the Spot-K reconciliation
 * decision (e.g. the Plan page's Nutrient Delivery Summary preview,
 * nutrition-prebble-integration.js) don't have to load the entire ~14k-line
 * word-export.js just for this one calculation.
 *
 * word-export.js and word-export-combined.js consume this file's exports via
 * window.GAIP_KReconDecision instead of keeping their own copies — single
 * source, same class of fix as the rest of the D07 AA-methodology work this
 * session (one canonical implementation, not independently-duplicated copies
 * that can drift). This file must load BEFORE word-export.js in every blade
 * view that includes it.
 *
 * Exports:
 *   - synthesiseDecision(soilData, kRequired, kDelivered, opts) — the actual
 *     two-gate Spot-K decision (b35fix324/326b — see function doc below).
 *   - potassiumDisplayLabel(opts) — region-aware K product analysis label
 *     (b35fix400 — AU/NZ elemental vs UK/EU oxide convention).
 *   - detectKDisplayRegion(explicit) — region resolver potassiumDisplayLabel
 *     depends on.
 */

(function(global) {
    'use strict';

    // ========================================================================
    // b35fix400 — Region-aware K product display label
    // ========================================================================
    // Potassium product analysis labels follow regional fertiliser convention:
    //   - AU / NZ:        elemental K   →  "0-0-41.5"  (matches Prebbles
    //                                       SOL-SOP, AU SOL-K2SO4 catalogue
    //                                       entries, b35fix397).
    //   - UK / EU /
    //     Scandinavia:    K₂O (oxide)   →  "0-0-50 (as K₂O)"  (matches UK
    //                                       fertiliser catalogue convention,
    //                                       see uk-fertiliser-products.js
    //                                       npk_label fields).
    //
    // The chemistry is the same product (Potassium sulphate, K₂SO₄). 41.5% K
    // elemental = 50% K₂O × 0.8302 (stoichiometric conversion). The math in
    // synthesiseDecision and word-export.js's _computeAmendmentDecision is
    // invariant to display: rate is computed from the elemental percentage
    // (residual / 0.415) regardless of which leading NPK triple shows on the
    // label.
    //
    // The parenthesised analysis ALWAYS lists elemental percentages
    // ("(41.5% K, 18% S)") for two reasons:
    //   1. parseAnalysisLabel in word-export.js's _amendmentDecisionsToProducts
    //      reads ONLY the parenthesised pct list to build totalDelivered. If
    //      we wrote "(50% K2O, 18% S)" the regex would match K=50 and
    //      double-count K delivery (oxide-as-elemental error). Keeping
    //      elemental in the parens avoids any parser change and any rounding
    //      drift.
    //   2. Agronomically, the elemental percentage is the value used for
    //      tissue-K calculations, soil targets, and mass balance. Showing
    //      both lets a UK reader cross-check the bag label (oxide) against
    //      the agronomic chemistry (elemental).
    //
    // Pre-b35fix400 history: b35fix319 hardcoded "0-0-50 (41.5% K, 18% S)"
    // assuming AU/NZ/UK all used a single convention. They don't — UK uses
    // oxide while AU/NZ use elemental. NZ users running Prebbles saw an
    // oxide label on what should be an elemental-display product (Shirley
    // GC Christchurch reproduction). b35fix400 makes the label region-aware.
    // ========================================================================
    function _potassiumDisplayLabel(opts) {
        opts = opts || {};
        var includeS = (opts.includeS !== false); // default true (SOP delivers S)
        var region = _detectKDisplayRegion(opts.region);

        // Always include elemental percentage in parens for parser safety
        // and agronomic clarity. The leading NPK triple varies by region.
        var elementalPctText = includeS
            ? '(41.5% K, 18% S)'
            : '(41.5% K)';

        if (region === 'oxide') {
            // UK / EU / Scandinavia convention: leading triple is K₂O.
            // "(as K₂O)" annotation makes the convention explicit so the
            // reader doesn't confuse the leading 50 with elemental.
            return '0-0-50 (as K₂O) ' + elementalPctText;
        }
        // AU / NZ / default: elemental.
        return '0-0-41.5 ' + elementalPctText;
    }

    // Returns 'oxide' for UK / EU / Scandinavia, 'elemental' otherwise.
    // Region resolution order:
    //   1. explicit override passed to caller (opts.region)
    //   2. window.GAIP_STATE.location.region (canonical hub state path)
    //   3. window.GAIP_STATE.location.country (older field, sometimes present)
    //   4. fallback: 'elemental' (Gilba's primary AU/NZ territory)
    function _detectKDisplayRegion(explicit) {
        var raw = null;
        if (typeof explicit === 'string' && explicit) {
            raw = explicit;
        } else if (typeof global !== 'undefined' && global.GAIP_STATE
                && global.GAIP_STATE.location) {
            raw = global.GAIP_STATE.location.region
                  || global.GAIP_STATE.location.country
                  || null;
        }
        if (!raw) return 'elemental';
        var s = String(raw).toLowerCase();
        // Match common UK / EU / Scandinavia tokens. Inclusive on purpose —
        // any oxide-convention region falls through to oxide; everything
        // else gets elemental.
        if (s === 'uk' || s === 'gb' || s === 'united_kingdom' || s === 'britain'
                || s === 'eu' || s === 'europe'
                || s === 'scandinavia' || s === 'nordic'
                || s === 'ireland' || s === 'ie') {
            return 'oxide';
        }
        return 'elemental';
    }

    /**
     * b35fix324 — Synthesise a K-reconciliation amendment decision.
     *
     * Programme-shortfall-driven spot-K (distinct from b35fix322's soil-deficit K).
     * Fires when the per-sample N programme delivers materially less K than the
     * sample's annual K requirement, AND the soil itself is genuinely K-limited
     * (sanity gate against SLAN-midpoint inflation — Item 1a).
     *
     * Two gates — both must trip:
     *
     *   GATE 1 (programme balance):
     *     balance = kDelivered - kRequired
     *     fires when balance < BALANCE_THRESHOLD (default −20 kg K/ha).
     *     Strict <, not <=. Sites at exactly the threshold don't fire — the
     *     "20 kg K/ha" is the noise floor for in-season sampling variability;
     *     a balance of −20 is within measurement uncertainty.
     *
     *   GATE 2 (soil-K sanity):
     *     soilData.K < soilData.thresholds.K.min
     *     fires only when soil K is genuinely below the methodology floor.
     *     Defends against the SLAN single-midpoint formula (engine line 311)
     *     emitting K req values that exceed in-range soil's actual need.
     *     Without this gate, a site with soil K = 100 ppm (in 75–150 SLAN range)
     *     could trigger spot-K because the engine's midpoint-driven K req = 127
     *     exceeds programme delivery. With the gate, the site needs to be
     *     genuinely K-limited (< 75 ppm under SLAN, < 35 ppm under MLSN) before
     *     spot-K fires regardless of programme balance.
     *
     *   Both gates are intentionally independent. The balance gate addresses
     *   "did the N programme deliver enough K?" (programme integrity). The soil
     *   gate addresses "does this soil need more K?" (agronomic justification).
     *   Both questions must answer "yes" for spot-K to be the right intervention.
     *
     * Spot rate:
     *   abs(balance), capped at capKgKHa (default 60 kg K/ha). The cap defends
     *   against runaway recommendations on samples with engine-inflated K req
     *   (Item 1a-class issue) — a balance of −200 doesn't justify 200 kg K/ha
     *   spot K, that level of correction belongs in the soil-deficit pathway
     *   (b35fix322) over years, not a single-season spot programme.
     *
     * Returns: null when either gate fails or when inputs are invalid.
     *          Otherwise a decision object matching the K branch shape from
     *          word-export.js's _computeAmendmentDecision, with
     *          `_isKReconciliation: true`. word-export.js's downstream
     *          _amendmentDecisionsToProducts helper recognises the flag and
     *          emits split-month placement instead of single-autumn.
     *
     * Inputs:
     *   soilData       per-sample soil object with K (number) and thresholds.K.min
     *   kRequired      kg K/ha annual requirement (from r._anr.K.val)
     *   kDelivered     kg K/ha delivered by the N programme
     *   opts           { balanceThreshold: -20, capKgKHa: 60 } — both optional
     */
    function _synthesiseKReconDecision(soilData, kRequired, kDelivered, opts) {
        opts = opts || {};
        var BALANCE_THRESHOLD = (typeof opts.balanceThreshold === 'number')
                              ? opts.balanceThreshold : -20;
        var CAP_KG_K_HA       = (typeof opts.capKgKHa === 'number')
                              ? opts.capKgKHa : 60;
        // b35fix326b — near-floor buffer (default 5 ppm).
        // Soil-test measurement uncertainty on Mehlich-3 K is typically ±5 ppm.
        // A sample reading within `buffer` ppm of the methodology floor could
        // genuinely be at-or-above floor. Firing 50 kg/ha spot-K on a sample
        // that's 2 ppm "below" floor over-reacts to noise. Suppress within the
        // buffer band; fire when soilK < (floor - buffer).
        // Configurable: opts.nearFloorBuffer = 0 disables (b35fix324 behaviour).
        // Negative values clamped to 0 (defensive).
        var rawBuffer = (typeof opts.nearFloorBuffer === 'number')
                      ? opts.nearFloorBuffer : 5;
        var NEAR_FLOOR_BUFFER = Math.max(0, rawBuffer);

        // Defensive: invalid inputs.
        if (!soilData) return null;
        if (typeof kRequired !== 'number' || !isFinite(kRequired) || kRequired <= 0) return null;
        if (typeof kDelivered !== 'number' || !isFinite(kDelivered)) return null;

        // Gate 1: programme balance.
        var balance = kDelivered - kRequired;
        if (!(balance < BALANCE_THRESHOLD)) return null;  // strict <

        // Gate 2: soil-K sanity (Item 1a defence).
        // b35fix326b: extended with NEAR_FLOOR_BUFFER. Effective floor for the
        // gate is (floor - buffer); samples between (floor - buffer) and floor
        // inclusive of the lower bound get suppressed alongside truly in-range
        // samples. Defends against soil-test measurement uncertainty triggering
        // spot-K on borderline samples.
        var soilK = parseFloat(soilData.K);
        if (!isFinite(soilK)) return null;
        var floor = soilData.thresholds && soilData.thresholds.K && soilData.thresholds.K.min;
        if (typeof floor !== 'number' || !isFinite(floor)) return null;
        var effectiveFloor = floor - NEAR_FLOOR_BUFFER;
        if (!(soilK < effectiveFloor)) return null;  // strict <: at-buffer-edge inclusive in suppression

        // Both gates trip. Compute spot rate (capped).
        var rawSpotK = Math.abs(balance);
        var spotKgKHa = Math.min(rawSpotK, CAP_KG_K_HA);
        spotKgKHa = Math.round(spotKgKHa);  // round to nearest 1 kg K/ha
        if (spotKgKHa <= 0) return null;

        // SOP @ 41.5% K → product rate = spot K / 0.415.
        var kgProductHa = Math.round(spotKgKHa / 0.415);

        return {
            nutrient: 'K',
            status: 'apply',
            product: 'Potassium sulphate',
            // b35fix400: region-aware analysis label. AU/NZ shows elemental
            // (0-0-41.5), UK/EU shows oxide (0-0-50 (as K₂O)). Both include
            // "(41.5% K, 18% S)" parenthesised for parser stability and
            // agronomic clarity.
            analysis: _potassiumDisplayLabel({ region: opts.region }),
            rate: spotKgKHa.toFixed(0) + ' kg K/ha (' + kgProductHa +
                  ' kg product/ha), split across 3 peak K-uptake months. ' +
                  'Programme delivers ' + kDelivered.toFixed(0) +
                  ' kg K/ha against ' + kRequired.toFixed(0) +
                  ' kg K/ha annual requirement (balance ' +
                  (balance >= 0 ? '+' : '') + balance.toFixed(0) + ').',
            reason: 'Spot K supplement, N programme delivers ' +
                    kDelivered.toFixed(0) + ' kg K/ha against K requirement ' +
                    kRequired.toFixed(0) + ' kg K/ha (balance ' + balance.toFixed(0) +
                    '). Soil K (' + soilK.toFixed(0) + ' ppm) below floor (' +
                    floor + ' ppm) confirms agronomic justification.',
            _isKReconciliation: true
        };
    }

    global.GAIP_KReconDecision = {
        synthesiseDecision: _synthesiseKReconDecision,
        potassiumDisplayLabel: _potassiumDisplayLabel,
        detectKDisplayRegion: _detectKDisplayRegion
    };

})(typeof window !== 'undefined' ? window : this);
