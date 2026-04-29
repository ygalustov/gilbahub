/**
 * ============================================================================
 * SMITH-KERNS DOLLAR SPOT MODEL v2.0.0
 * ============================================================================
 *
 * b35fix335 (Tier 1 provenance audit): full rewrite. Pre-fix v1.0.0 claimed
 * to implement Smith-Kerns 2018 but actually computed a Gaussian temp curve
 * × favourable-hours score with arbitrary constants (RH≥65, temp 15–32°C
 * Gaussian, scale factor 150) — none of which appear in the paper.
 *
 * This module now implements the published equation from:
 *
 *   Smith, D.L., Kerns, J.P., Walker, N.R., Payne, A.R., Horvath, B.,
 *   Inguagiato, J.C., Kaminski, J.E., Tomaso-Peterson, M., & Koch, P.L. (2018).
 *   "Development and validation of a weather-based warning system to advise
 *   fungicide application to control dollar spot on turfgrass."
 *   PLOS ONE 13(3): e0194216.
 *   DOI: 10.1371/journal.pone.0194216
 *
 * MODEL:
 *   logit(mu) = -11.4041 + 0.0894*MEANRH + 0.1932*MEANAT
 *   mu        = 1 / (1 + exp(-logit(mu)))
 *
 * where:
 *   MEANRH = 5-day rolling mean relative humidity (%)
 *   MEANAT = 5-day rolling mean air temperature (°C)
 *   mu     = probability that dollar spot will occur on a given day
 *
 * ACTION THRESHOLD: 20% probability (Smith et al. 2018 standard).
 *   Hempfling et al. (2021) Crop Sci. 61(5):3149-3162 demonstrated that
 *   the 20% threshold over-predicts on low-susceptibility cultivars and
 *   recommends thresholds >20% on tolerant bentgrasses.
 *
 * SCOPE: validated on cool-season creeping bentgrass (Penncross initial
 * calibration; multiple bentgrass cultivars in validation locations across
 * Wisconsin, Oklahoma, Pennsylvania, Mississippi, Tennessee, Connecticut,
 * New Jersey). Use on warm-season turf is indicative only.
 *
 * NOTE: this standalone module is enqueued by gilba-agronomic-intelligence-hub.php
 * but its globals (window.SmithKernsModel, window.DollarSpotModelV2) are not
 * currently consumed by other modules. The production dollar-spot path lives
 * in disease-engine-pure.js, which also got a Smith-Kerns 2018 logistic
 * implementation in b35fix335. This file is kept in lockstep so any future
 * wiring picks up the correct model.
 *
 * ============================================================================
 */

const SmithKernsModel = (function() {
    'use strict';

    // =========================================================================
    // PUBLISHED MODEL COEFFICIENTS (Smith et al. 2018)
    // =========================================================================

    const COEFFICIENTS = Object.freeze({
        intercept: -11.4041,
        rh:          0.0894,   // MEANRH (% units)
        airTemp:     0.1932    // MEANAT (°C units)
    });

    const ACTION_THRESHOLD = 20;        // % probability — Smith et al. 2018
    const ROLLING_DAYS     = 5;

    // =========================================================================
    // CORE EQUATIONS
    // =========================================================================

    /**
     * Compute the Smith-Kerns 2018 logistic-regression probability of
     * dollar spot occurrence on a given day.
     *
     * @param {number} meanRH - 5-day mean relative humidity (%, 0-100)
     * @param {number} meanAT - 5-day mean air temperature (°C)
     * @returns {number|null} probability in [0, 100], or null on bad input
     */
    function probability(meanRH, meanAT) {
        if (typeof meanRH !== 'number' || typeof meanAT !== 'number'
            || isNaN(meanRH) || isNaN(meanAT)) {
            return null;
        }
        const logit = COEFFICIENTS.intercept
                    + COEFFICIENTS.rh      * meanRH
                    + COEFFICIENTS.airTemp * meanAT;
        const mu = 1 / (1 + Math.exp(-logit));
        return mu * 100;
    }

    /**
     * Helper: 5-day mean relative humidity from an array of hourly RH values.
     * Uses the most recent up to 120 hours.
     */
    function fiveDayMeanRH(hourlyRH) {
        if (!Array.isArray(hourlyRH) || hourlyRH.length === 0) return null;
        const start = Math.max(0, hourlyRH.length - ROLLING_DAYS * 24);
        let sum = 0, count = 0;
        for (let i = start; i < hourlyRH.length; i++) {
            const v = hourlyRH[i];
            if (typeof v === 'number' && !isNaN(v)) { sum += v; count++; }
        }
        return count > 0 ? sum / count : null;
    }

    /**
     * Helper: 5-day mean air temperature from an array of hourly °C values
     * or a daily-pattern array of { mean } objects.
     */
    function fiveDayMeanTemp(hourlyTemp, dailyPattern) {
        if (Array.isArray(dailyPattern) && dailyPattern.length > 0) {
            const slice = dailyPattern.slice(0, ROLLING_DAYS);
            let sum = 0, count = 0;
            for (let i = 0; i < slice.length; i++) {
                const v = slice[i] && slice[i].mean;
                if (typeof v === 'number' && !isNaN(v)) { sum += v; count++; }
            }
            if (count > 0) return sum / count;
        }
        if (Array.isArray(hourlyTemp) && hourlyTemp.length > 0) {
            const start = Math.max(0, hourlyTemp.length - ROLLING_DAYS * 24);
            let sum = 0, count = 0;
            for (let i = start; i < hourlyTemp.length; i++) {
                const v = hourlyTemp[i];
                if (typeof v === 'number' && !isNaN(v)) { sum += v; count++; }
            }
            return count > 0 ? sum / count : null;
        }
        return null;
    }

    /**
     * Classify a Smith-Kerns probability into a coarse risk band for UI use.
     * Bands are Gilba presentation choices, NOT from the paper. The only
     * threshold from Smith et al. 2018 is the 20% action threshold.
     */
    function classifyRisk(prob) {
        if (prob == null) return 'unknown';
        if (prob < 10)  return 'minimal';
        if (prob < 20)  return 'low';        // below action threshold
        if (prob < 40)  return 'moderate';   // above action threshold
        if (prob < 60)  return 'high';
        return 'severe';
    }

    // =========================================================================
    // HIGH-LEVEL CALCULATE (climate-object input compatible with hub)
    // =========================================================================

    function calculate(climate) {
        const meanRH = fiveDayMeanRH(climate && climate.hourlyData && climate.hourlyData.relative_humidity_2m)
                    || (climate && climate.moisture && climate.moisture.humidity && climate.moisture.humidity.mean)
                    || null;
        // b35fix335a: temp fallback chain matches disease-engine-pure.js. Order:
        //   (1) hourly array → (2) dailyPattern → (3) max/min average →
        //   (4) period-mean. Production showed dailyPattern rarely populated.
        // b35fix337: added 5th rung — temperature.current — to match the Shirley
        // GC Christchurch first-paint race fixed in disease-engine-pure.js. On
        // a single dispatch out of 72 in the production log, only `current` was
        // populated; chain returned null and SK collapsed to degraded despite
        // a real temperature being available. Lockstep with the production engine.
        let meanAT = fiveDayMeanTemp(
            climate && climate.hourlyData && climate.hourlyData.temperature_2m,
            climate && climate.temperature && climate.temperature.dailyPattern
        );
        if (meanAT == null
            && climate && climate.temperature
            && climate.temperature.max != null
            && climate.temperature.min != null) {
            meanAT = (climate.temperature.max + climate.temperature.min) / 2;
        }
        if (meanAT == null) {
            meanAT = (climate && climate.temperature && climate.temperature.mean) || null;
        }
        if (meanAT == null) {
            // b35fix337: 5th rung — current-hour reading. Single-hour value, not
            // a 5-day mean; degraded but better than refusing to compute when
            // a real temperature exists.
            meanAT = (climate && climate.temperature && climate.temperature.current) || null;
        }

        const prob = probability(meanRH, meanAT);
        if (prob == null) {
            return {
                model: 'Smith-Kerns 2018',
                citation: 'Smith et al. (2018) PLOS ONE 13(3):e0194216',
                meanRH: meanRH,
                meanAT: meanAT,
                probability: null,
                riskLevel: 'unknown',
                actionRequired: false,
                actionThreshold: ACTION_THRESHOLD,
                degraded: true,
                reason: 'Insufficient input data (missing 5-day mean RH or air temperature)'
            };
        }

        return {
            model: 'Smith-Kerns 2018',
            citation: 'Smith et al. (2018) PLOS ONE 13(3):e0194216',
            meanRH: Math.round(meanRH * 10) / 10,
            meanAT: Math.round(meanAT * 10) / 10,
            probability: Math.round(prob * 10) / 10,
            riskLevel: classifyRisk(prob),
            actionRequired: prob >= ACTION_THRESHOLD,
            actionThreshold: ACTION_THRESHOLD,
            actionThresholdNote: 'Hempfling et al. 2021 (Crop Sci 61:3149-3162) found the 20% threshold over-predicts on low-susceptibility cultivars; consider higher thresholds on tolerant bentgrasses.',
            degraded: false
        };
    }

    function getInterventions(riskLevel, options) {
        const cultural = ['Remove dew early morning (mow, roll, or drag)'];
        const opts = options || {};
        if (opts.nitrogen && (opts.nitrogen.status === 'deficient' || opts.nitrogen.status === 'low')) {
            cultural.unshift('PRIORITY: Apply nitrogen — low N dramatically increases dollar spot susceptibility (Davis & Dernoeden 2002)');
        }
        const preventive = [];
        if (riskLevel === 'high' || riskLevel === 'severe') {
            preventive.push('Consider preventive fungicide application (model probability above 20% action threshold)');
        }
        return { cultural: cultural, preventive: preventive, timing: null };
    }

    // =========================================================================
    // PUBLIC API
    // =========================================================================

    return {
        // Configuration
        COEFFICIENTS: COEFFICIENTS,
        ACTION_THRESHOLD: ACTION_THRESHOLD,
        ROLLING_DAYS: ROLLING_DAYS,

        // Core functions
        probability: probability,
        calculate: calculate,
        getInterventions: getInterventions,
        classifyRisk: classifyRisk,

        // Helpers (exposed for testing)
        fiveDayMeanRH: fiveDayMeanRH,
        fiveDayMeanTemp: fiveDayMeanTemp,

        // Metadata
        version: '2.0.0',
        name: 'Smith-Kerns Dollar Spot Model',
        citation: 'Smith, D.L., Kerns, J.P., Walker, N.R., Payne, A.R., Horvath, B., Inguagiato, J.C., Kaminski, J.E., Tomaso-Peterson, M., & Koch, P.L. (2018). PLOS ONE 13(3): e0194216. DOI 10.1371/journal.pone.0194216',
        scope: 'Validated on cool-season creeping bentgrass (US locations: WI, OK, PA, MS, TN, CT, NJ). Use on warm-season turf is indicative only.',
        previousVersion: '1.0.0 (b35fix335: rewritten — pre-fix file claimed Smith-Kerns but implemented a different model)'
    };

})();

// =========================================================================
// COMPATIBILITY WRAPPER (DollarSpotModelV2)
// =========================================================================

const DollarSpotModelV2 = {
    name: 'Dollar Spot (Smith-Kerns 2018)',
    pathogen: 'Clarireedia jacksonii',
    version: '2.0.0',

    calculate(climate, nitrogen, variety) {
        const skResult = SmithKernsModel.calculate(climate);
        const varietyMod = (variety && variety.disease && variety.disease.dollarSpot && variety.disease.dollarSpot.riskMultiplier) || 1;

        const adjusted = skResult.probability != null
            ? Math.min(100, skResult.probability * varietyMod)
            : null;

        return {
            disease: 'dollarSpot',
            displayName: 'Dollar Spot',
            riskScore: adjusted != null ? Math.round(adjusted) : null,
            adjustedRisk: adjusted != null ? Math.round(adjusted) : null,
            smithKernsProbability: skResult.probability,
            riskLevel: SmithKernsModel.classifyRisk(adjusted != null ? adjusted : skResult.probability),
            confidence: skResult.degraded ? 'low' : 'high',
            drivers: {
                meanRH: skResult.meanRH,
                meanAT: skResult.meanAT,
                model: 'Smith-Kerns 2018 logistic regression'
            },
            modifiers: { variety: varietyMod, nitrogen: (nitrogen && nitrogen.status) || 'adequate' },
            actionThreshold: SmithKernsModel.ACTION_THRESHOLD,
            actionRequired: skResult.actionRequired,
            citation: skResult.citation,
            degraded: skResult.degraded
        };
    },

    getInterventions(riskLevel, options) {
        return SmithKernsModel.getInterventions(riskLevel, options);
    }
};

// =========================================================================
// BROWSER/WORDPRESS EXPORT
// =========================================================================

if (typeof window !== 'undefined') {
    window.SmithKernsModel = SmithKernsModel;
    window.DollarSpotModelV2 = DollarSpotModelV2;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { SmithKernsModel: SmithKernsModel, DollarSpotModelV2: DollarSpotModelV2 };
}
