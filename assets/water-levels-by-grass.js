/**
 * =============================================================================
 * GAIP WATER LEVELS BY GRASS (shared, GH-824)
 * =============================================================================
 *
 * The irrigation water's level by the site's grass -- threshold set 2, the one that depends on the grass -- and the
 * one rule for gypsum by SAR, in one file. The owner decided on 01.10 that gypsum by water follows set 2; the report
 * judged by it while the Analysis page and the water engine judged every grass by 3 / 6 / 9 (sometimes 18). The
 * report, the water engine and the page read this file instead of keeping their own thresholds.
 *
 * The grass type is the resolver's (`resolveExportInputs().turf.isC4`). When the resolver did not answer (no species,
 * or the species tables are not loaded on the page), there is no basis and no level: the water is not judged by a
 * grass nobody named. The values are moved from word-export.js unchanged.
 *
 * This file must load before word-export.js, the water engine and water-balance-analysis.js in every view that loads
 * them.
 */
(function (global) {
    'use strict';

    /** Set 2 by basis. Its numbers carry no origin in the code ("C3 more sensitive"); declaring it is item 3ge's work. */
    var WATER_SET_2 = {
        C3: { EC: { warning: 1.5, critical: 2.0 }, SAR: { warning: 4, critical: 6 } },
        C4: { EC: { warning: 2.5, critical: 4.0 }, SAR: { warning: 6, critical: 9 } }
    };

    /** 'C4' or 'C3' by the resolver's answer; null when it gave none. */
    function speciesBasis(turf) {
        if (!turf || typeof turf.isC4 !== 'boolean') return null;
        return turf.isC4 ? 'C4' : 'C3';
    }

    /** One scale per indicator; the boundaries above "marginal"/"moderate" are set 2's, strict `>`. Null without a basis. */
    function waterLevel(indicator, value, basis) {
        var set = WATER_SET_2[basis];
        if (!set || typeof value !== 'number' || !isFinite(value)) return null;
        if (indicator === 'EC') {
            if (value > set.EC.critical) return 'critical';
            if (value > set.EC.warning) return 'warning';
            if (value > 0.75) return 'marginal';
            if (value >= 0.5) return 'safe';
            return 'very_low';
        }
        if (value > set.SAR.critical) return 'critical';
        if (value > set.SAR.warning) return 'warning';
        if (value >= 3) return 'moderate';
        return 'excellent';
    }

    /** Gypsum is called for by SAR at `warning` and above. */
    function gypsumBySar(level) {
        return level === 'warning' || level === 'critical';
    }

    global.GAIP_WaterLevels = {
        WATER_SET_2: WATER_SET_2,
        speciesBasis: speciesBasis,
        waterLevel: waterLevel,
        gypsumBySar: gypsumBySar
    };
})(typeof window !== 'undefined' ? window : this);
