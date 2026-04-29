/**
 * =============================================================================
 * GILBA GROWTH POTENTIAL ENGINE — Pure Function Extraction
 * =============================================================================
 *
 * Canonical growth-potential (GP) calculator for the GAIP Hub.
 * Replaces five in-tree GP implementations; see b35fix302 plan for details.
 *
 * Two models supported:
 *   'pace'    — PACE Turf Growth Potential Model (Gelernter & Stowell,
 *               2005, "Improved overseeding programs 1. The role of weather",
 *               Golf Course Management, May 2005). Gaussian bell curve.
 *               Used for N distribution, allocation weighting, monthly
 *               programme calculations. Default model.
 *               C3: t0 20°C, sigma 5.5. C4: t0 31°C, sigma 7.0.
 *               Equation: GP = exp(-0.5 * ((t - t0) / sigma)^2)
 *   'kreuser' — Asymmetric plateau (Kreuser & Soldat 2011). Used for
 *               dashboard GP display metric where the published plateau
 *               model matches GCSAA user expectations.
 *               C3: plateau 15.6–23.9°C, sigma 6.8. C4: plateau 31.1–35.0°C, sigma 9.0.
 *
 * Returns GP on 0–1 scale. Consumers that need 0–100 scale multiply at
 * their boundary.
 *
 * Pure: no DOM reads, no global reads, no side-effects. All inputs explicit.
 *
 * @version 1.0.0
 * @citation pace-gp
 * =============================================================================
 */

(function(global) {
    'use strict';

    const VERSION = '1.0.0';
    const CITATION = 'pace-gp';

    const MODELS = Object.freeze({
        pace: Object.freeze({
            c3: Object.freeze({ optimum: 20, sigma: 5.5 }),
            c4: Object.freeze({ optimum: 31, sigma: 7.0 })
        }),
        kreuser: Object.freeze({
            c3: Object.freeze({ optMin: 15.6, optMax: 23.9, varLow: 6.8, varHigh: 6.8 }),
            c4: Object.freeze({ optMin: 31.1, optMax: 35.0, varLow: 9.0, varHigh: 9.0 })
        })
    });

    function _isValidTemp(t) {
        return typeof t === 'number' && !isNaN(t) && isFinite(t);
    }

    function _paceGP(tempC, coefs) {
        const dist = tempC - coefs.optimum;
        return Math.exp(-0.5 * Math.pow(dist / coefs.sigma, 2));
    }

    // Kreuser plateau model — implemented in T-C. Returns null until then.
    function _kreuserGP(tempC, coefs) {
        if (tempC < coefs.optMin) {
            const dist = coefs.optMin - tempC;
            return Math.exp(-0.5 * Math.pow(dist / coefs.varLow, 2));
        }
        if (tempC > coefs.optMax) {
            const dist = tempC - coefs.optMax;
            return Math.exp(-0.5 * Math.pow(dist / coefs.varHigh, 2));
        }
        return 1.0;
    }

    function compute(tempC, options) {
        if (!_isValidTemp(tempC)) return null;

        const opts = options || {};
        const model = opts.model || 'pace';
        const species = opts.species || 'c3';

        const modelCoefs = MODELS[model];
        if (!modelCoefs) return null;

        // Blended species — linear interpolation between C3 and C4 GP.
        // Used by nutrition-requirement-engine for overseed scenarios where
        // monthly C3 fraction varies through the year.
        if (species === 'blend') {
            const rawFrac = (typeof opts.c3Fraction === 'number') ? opts.c3Fraction : 1.0;
            const clampedFrac = Math.max(0, Math.min(1, rawFrac));
            const c3Fn = model === 'pace' ? _paceGP : _kreuserGP;
            const c3GP = c3Fn(tempC, modelCoefs.c3);
            const c4GP = c3Fn(tempC, modelCoefs.c4);
            if (c3GP === null || c4GP === null) return null;
            return clampedFrac * c3GP + (1 - clampedFrac) * c4GP;
        }

        if (species !== 'c3' && species !== 'c4') return null;

        const coefs = modelCoefs[species];
        if (!coefs) return null;

        if (model === 'pace') return _paceGP(tempC, coefs);
        if (model === 'kreuser') return _kreuserGP(tempC, coefs);
        return null;
    }

    function getCoefficients(model, species) {
        const m = MODELS[model];
        if (!m) return null;
        return m[species] || null;
    }

    // Monthly GP helper. Takes a {1..12: tempC} object and returns {1..12: gp}.
    // Missing months fall back to 15°C (a neutral temperature — callers should
    // ensure all 12 months are provided for real use; fallback is defensive).
    function monthly(monthlyTemps, options) {
        if (!monthlyTemps || typeof monthlyTemps !== 'object') return null;
        const result = {};
        const fallbackTemp = 15;
        for (let m = 1; m <= 12; m++) {
            const t = (typeof monthlyTemps[m] === 'number') ? monthlyTemps[m] : fallbackTemp;
            result[m] = compute(t, options);
        }
        return result;
    }

    const Engine = {
        VERSION: VERSION,
        CITATION: CITATION,
        compute: compute,
        getCoefficients: getCoefficients,
        monthly: monthly
    };

    global.GilbaGrowthPotentialEngine = Engine;

    // One-time load confirmation (matches convention in other engines).
    // Silent in production if verbose logging is disabled.
    if (typeof console !== 'undefined' && console.log) {
        console.log('[GilbaGrowthPotentialEngine] v' + VERSION + ' loaded (model: pace+kreuser)');
    }

    // Node test harness exposure
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = Engine;
    }

})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this));
