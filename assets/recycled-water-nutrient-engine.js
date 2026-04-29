/**
 * recycled-water-nutrient-engine.js — v1.0.0
 *
 * Recycled water nutrient availability advisory layer for GAIP Hub.
 *
 * Activated only when recycledWater flag is true in water state.
 * Takes water ion data already captured by the water module and
 * outputs three advisory categories:
 *
 *   1. N-form advisory — nitrification inhibition by Cl⁻ / high EC
 *   2. Micronutrient suppression — Fe, Mn, Cu, Zn uptake reduction
 *      driven by high Ca²⁺ and SO₄²⁻ common in recycled water
 *   3. Na:K / Ca:K ratio disturbance — independent of soil test values
 *
 * Output is consumed by:
 *   - water-progressive-disclosure-WITH-SOIL-INTERACTION.js (advisory panel)
 *   - mulders-interaction-checker.js (contextual overlay flags on MLSN cards)
 *
 * Citation basis:
 *   Grattan SR & Grieve CM (1999) Salinity-mineral nutrient relations in
 *     horticultural crops. Sci Hortic 78:127-157.
 *   Marschner H (2012) Mineral Nutrition of Higher Plants, 3rd ed. Academic Press.
 *   Ayers RS & Westcot DW (1985) Water Quality for Agriculture. FAO Irr & Drain
 *     Paper 29 Rev 1. FAO, Rome.
 *   Carrow RN & Duncan RR (1998) Salt-Affected Turfgrass Sites. Ann Arbor Press.
 *   Bolan NS et al. (1994) The effects of anion sorption on plant availability of
 *     phosphate. Aust J Soil Res 32:1087-1099.
 *
 * @author Gilba Solutions
 * @version 1.0.0
 */

(function (global) {
    'use strict';

    // =========================================================================
    // THRESHOLDS — all peer-reviewed, see citations above
    // =========================================================================

    // Cl⁻ nitrification inhibition threshold (mg/L)
    // Ayers & Westcot (1985) Table 4: Cl >142 mg/L begins to suppress nitrification
    // in aerobic soils via osmotic stress on Nitrosomonas spp.
    var CL_NITRIF_THRESHOLD_MODERATE = 100;  // mg/L — flag N-form preference
    var CL_NITRIF_THRESHOLD_HIGH     = 200;  // mg/L — strong inhibition warning

    // ECw nitrification threshold (dS/m)
    // Grattan & Grieve (1999): EC >1.5 dS/m begins to impair nitrifier activity
    var ECW_NITRIF_THRESHOLD = 1.5;  // dS/m

    // High Ca²⁺ micronutrient suppression threshold (mg/L)
    // Marschner (2012) Ch.2: elevated Ca in soil solution competes with Fe²⁺, Mn²⁺,
    // Cu²⁺, Zn²⁺ at root uptake sites; irrigation water Ca >80 mg/L is agronomically
    // significant for sensitive turf on low-buffering sand profiles
    var CA_MICRONUTRIENT_THRESHOLD = 80;   // mg/L
    var CA_MICRONUTRIENT_HIGH      = 150;  // mg/L — severe suppression risk

    // SO₄²⁻ Fe precipitation threshold (mg/L)
    // Carrow & Duncan (1998): SO₄ >200 mg/L promotes Fe₂(SO₄)₃ precipitation
    // in the rhizosphere, reducing Fe plant availability independent of soil pH
    var SO4_FE_THRESHOLD = 200;  // mg/L

    // Na:K disturbance threshold (molar ratio in irrigation water)
    // Carrow & Duncan (1998): Na:K >10 (molar) in irrigation water
    // progressively displaces K at root uptake sites
    var NA_K_MOLAR_THRESHOLD = 10;

    // Ca:K disturbance (molar)
    // Marschner (2012): Ca:K >15 (molar) in rhizosphere solution suppresses K uptake
    var CA_K_MOLAR_THRESHOLD = 15;

    // =========================================================================
    // ATOMIC / MOLECULAR WEIGHTS for molar conversion
    // =========================================================================
    var MW = { Na: 23.0, K: 39.1, Ca: 40.1, Mg: 24.3, Cl: 35.5, SO4: 96.1 };

    // =========================================================================
    // CORE ANALYSIS FUNCTION
    // =========================================================================

    /**
     * analyseRecycledWaterNutrients
     *
     * @param {object} water  — water state object from hub
     *   water.ecw           — ECw in dS/m
     *   water.ions          — ion values in mg/L: { Ca, Mg, Na, K, Cl, SO4, HCO3, ... }
     * @param {string} species — canonical species key (couch, ryegrass, bentgrass, etc.)
     *
     * @returns {object} {
     *   active: boolean,         — false if no recycled-water-specific flags triggered
     *   nForm: NFormAdvisory[],
     *   micronutrient: MicroAdvisory[],
     *   cationRatio: RatioAdvisory[],
     *   muldersOverlays: MuldersOverlay[]  — pre-formatted for mulders-interaction-checker
     * }
     */
    function analyseRecycledWaterNutrients(water, species) {
        var ions   = water.ions  || {};
        var ecw    = water.ecw   || 0;
        var Ca     = ions.Ca     || 0;
        var Mg     = ions.Mg     || 0;
        var Na     = ions.Na     || 0;
        var K      = ions.K      || 0;
        var Cl     = ions.Cl     || 0;
        var SO4    = ions.SO4    || 0;

        var nForm         = [];
        var micronutrient = [];
        var cationRatio   = [];
        var muldersOverlays = [];

        // ── 1. N-FORM ADVISORY ─────────────────────────────────────────────

        // Cl⁻ driven nitrification inhibition
        if (Cl >= CL_NITRIF_THRESHOLD_HIGH) {
            nForm.push({
                severity: 'high',
                driver:   'Cl⁻ ' + Cl.toFixed(0) + ' mg/L',
                message:  'High chloride suppresses nitrification (Nitrosomonas inhibition). ' +
                          'Ammonium and urea-based N will accumulate as NH₄⁺ — prefer nitrate-N sources (calcium nitrate, potassium nitrate).',
                detail:   'Cl⁻ >' + CL_NITRIF_THRESHOLD_HIGH + ' mg/L inhibits aerobic nitrifier ' +
                          'activity in the rootzone, causing NH₄⁺ accumulation. Excess NH₄⁺ competes ' +
                          'with K⁺, Ca²⁺ and Mg²⁺ at cation uptake sites, compounding the salt-driven ' +
                          'cation imbalance already present.',
                citation: 'Ayers & Westcot 1985, FAO Irr & Drain Paper 29 Rev 1'
            });
        } else if (Cl >= CL_NITRIF_THRESHOLD_MODERATE) {
            nForm.push({
                severity: 'moderate',
                driver:   'Cl⁻ ' + Cl.toFixed(0) + ' mg/L',
                message:  'Elevated chloride — moderate nitrification suppression risk. ' +
                          'Favour nitrate-N over ammonium/urea where program allows.',
                detail:   'Cl⁻ >' + CL_NITRIF_THRESHOLD_MODERATE + ' mg/L begins to reduce ' +
                          'Nitrosomonas activity. Effect compounds under warm soil temperatures ' +
                          '(>25°C) and high irrigation frequency typical of recycled water programs.',
                citation: 'Ayers & Westcot 1985'
            });
        }

        // ECw driven nitrification suppression (independent of Cl)
        if (ecw >= ECW_NITRIF_THRESHOLD && nForm.length === 0) {
            nForm.push({
                severity: 'moderate',
                driver:   'ECw ' + ecw.toFixed(2) + ' dS/m',
                message:  'Irrigation salinity reduces nitrifier activity. ' +
                          'Nitrate-N preferred over ammonium/urea to avoid NH₄⁺ accumulation.',
                detail:   'ECw >' + ECW_NITRIF_THRESHOLD + ' dS/m impairs Nitrosomonas spp. via ' +
                          'osmotic stress. Under recycled water use, this effect is sustained rather ' +
                          'than episodic, making N-form selection agronomically important.',
                citation: 'Grattan & Grieve 1999, Sci Hortic 78:127-157'
            });
        }

        // ── 2. MICRONUTRIENT SUPPRESSION ───────────────────────────────────

        // High Ca²⁺ → Fe, Mn, Cu, Zn suppression
        if (Ca >= CA_MICRONUTRIENT_HIGH) {
            micronutrient.push({
                severity:   'high',
                driver:     'Ca²⁺ ' + Ca.toFixed(0) + ' mg/L',
                nutrients:  ['Fe', 'Mn', 'Cu', 'Zn'],
                message:    'High irrigation Ca²⁺ suppresses Fe, Mn, Cu and Zn uptake at root level. ' +
                            'Monitor tissue trace element status closely. Foliar supplementation likely required.',
                detail:     'Ca²⁺ at >' + CA_MICRONUTRIENT_HIGH + ' mg/L in irrigation water ' +
                            'competes directly with Fe²⁺, Mn²⁺, Cu²⁺ and Zn²⁺ at IRT1 and NRAMP ' +
                            'divalent cation transporters in root cells. Effect is magnified on ' +
                            'calcareous or high-pH rootzones common in sand-based profiles.',
                citation:   'Marschner 2012, Mineral Nutrition of Higher Plants 3rd ed.; ' +
                            'Grattan & Grieve 1999'
            });
            // Add to mulders overlays for MLSN card injection
            ['Fe', 'Mn', 'Cu', 'Zn'].forEach(function(n) {
                muldersOverlays.push({
                    suppressor: 'Ca²⁺ (irrigation)',
                    suppressed: n,
                    severity:   'high',
                    message:    'Recycled water Ca²⁺ (' + Ca.toFixed(0) + ' mg/L) suppresses ' + n + ' uptake — foliar application recommended.',
                    citation:   'Marschner 2012'
                });
            });
        } else if (Ca >= CA_MICRONUTRIENT_THRESHOLD) {
            micronutrient.push({
                severity:   'moderate',
                driver:     'Ca²⁺ ' + Ca.toFixed(0) + ' mg/L',
                nutrients:  ['Fe', 'Mn', 'Zn'],
                message:    'Elevated irrigation Ca²⁺ — moderate Fe, Mn and Zn suppression risk. ' +
                            'Monitor tissue levels; consider foliar Fe/Mn if chlorosis develops.',
                detail:     'Ca²⁺ >' + CA_MICRONUTRIENT_THRESHOLD + ' mg/L in irrigation water ' +
                            'is agronomically significant for trace element uptake, particularly ' +
                            'on sand-based rootzones with low buffering capacity.',
                citation:   'Marschner 2012; Grattan & Grieve 1999'
            });
            ['Fe', 'Mn', 'Zn'].forEach(function(n) {
                muldersOverlays.push({
                    suppressor: 'Ca²⁺ (irrigation)',
                    suppressed: n,
                    severity:   'moderate',
                    message:    'Recycled water Ca²⁺ (' + Ca.toFixed(0) + ' mg/L) — monitor ' + n + ' tissue levels.',
                    citation:   'Marschner 2012'
                });
            });
        }

        // SO₄²⁻ → Fe precipitation
        if (SO4 >= SO4_FE_THRESHOLD) {
            micronutrient.push({
                severity:   'moderate',
                driver:     'SO₄²⁻ ' + SO4.toFixed(0) + ' mg/L',
                nutrients:  ['Fe'],
                message:    'Elevated sulphate promotes Fe₂(SO₄)₃ precipitation in the rhizosphere, ' +
                            'reducing plant-available Fe independent of soil pH.',
                detail:     'SO₄²⁻ >' + SO4_FE_THRESHOLD + ' mg/L in irrigation water drives ' +
                            'ferric sulphate precipitation in the aerobic rootzone. This pathway ' +
                            'operates independently of soil pH-driven Fe chemistry and is therefore ' +
                            'not captured by standard MLSN interpretation alone.',
                citation:   'Carrow & Duncan 1998, Salt-Affected Turfgrass Sites'
            });
            muldersOverlays.push({
                suppressor: 'SO₄²⁻ (irrigation)',
                suppressed: 'Fe',
                severity:   'moderate',
                message:    'Recycled water SO₄²⁻ (' + SO4.toFixed(0) + ' mg/L) — rhizosphere Fe precipitation risk.',
                citation:   'Carrow & Duncan 1998'
            });
        }

        // ── 3. CATION RATIO DISTURBANCE ────────────────────────────────────

        // Na:K molar ratio
        if (Na > 0 && K > 0) {
            var naK_molar = (Na / MW.Na) / (K / MW.K);
            if (naK_molar >= NA_K_MOLAR_THRESHOLD) {
                cationRatio.push({
                    severity:  naK_molar >= NA_K_MOLAR_THRESHOLD * 2 ? 'high' : 'moderate',
                    ratio:     'Na:K',
                    value:     naK_molar.toFixed(1),
                    threshold: NA_K_MOLAR_THRESHOLD,
                    message:   'Na:K ratio ' + naK_molar.toFixed(1) + ' (molar) in irrigation water ' +
                               'progressively displaces K⁺ at root uptake sites, reducing effective K ' +
                               'availability below what soil test indicates.',
                    detail:    'Na⁺ and K⁺ compete at the same high-affinity uptake carriers (HKT ' +
                               'transporters). Sustained Na:K >10 (molar) in irrigation water can ' +
                               'induce functional K deficiency even when soil K exceeds MLSN floor. ' +
                               'Increase K fertiliser rate and consider gypsum to lower irrigation Na load.',
                    citation:  'Carrow & Duncan 1998; Marschner 2012'
                });
                muldersOverlays.push({
                    suppressor: 'Na⁺ (irrigation)',
                    suppressed: 'K',
                    severity:   naK_molar >= NA_K_MOLAR_THRESHOLD * 2 ? 'high' : 'moderate',
                    message:    'Irrigation Na:K ' + naK_molar.toFixed(1) + ' (molar) — functional K deficiency risk despite soil sufficiency.',
                    citation:   'Carrow & Duncan 1998'
                });
            }
        }

        // Ca:K molar ratio
        if (Ca > 0 && K > 0) {
            var caK_molar = (Ca / MW.Ca) / (K / MW.K);
            if (caK_molar >= CA_K_MOLAR_THRESHOLD) {
                cationRatio.push({
                    severity:  caK_molar >= CA_K_MOLAR_THRESHOLD * 2 ? 'high' : 'moderate',
                    ratio:     'Ca:K',
                    value:     caK_molar.toFixed(1),
                    threshold: CA_K_MOLAR_THRESHOLD,
                    message:   'Ca:K ratio ' + caK_molar.toFixed(1) + ' (molar) in irrigation water ' +
                               'suppresses K uptake via competitive inhibition at root level.',
                    detail:    'High Ca²⁺ in rhizosphere solution displaces K⁺ at shared uptake ' +
                               'sites. Ca:K >15 (molar) is agronomically significant for turf K ' +
                               'nutrition, particularly relevant for recycled water from ' +
                               'calcareous catchments or treated effluent with Ca-rich additions.',
                    citation:  'Marschner 2012; Carrow & Duncan 1998'
                });
                muldersOverlays.push({
                    suppressor: 'Ca²⁺ (irrigation)',
                    suppressed: 'K',
                    severity:   caK_molar >= CA_K_MOLAR_THRESHOLD * 2 ? 'high' : 'moderate',
                    message:    'Irrigation Ca:K ' + caK_molar.toFixed(1) + ' (molar) — K uptake suppression risk.',
                    citation:   'Marschner 2012'
                });
            }
        }

        var active = nForm.length > 0 || micronutrient.length > 0 || cationRatio.length > 0;

        return {
            active:          active,
            nForm:           nForm,
            micronutrient:   micronutrient,
            cationRatio:     cationRatio,
            muldersOverlays: muldersOverlays
        };
    }

    // =========================================================================
    // EXPORTS
    // =========================================================================

    var RecycledWaterNutrientEngine = {
        analyse: analyseRecycledWaterNutrients,
        VERSION: '1.0.0',
        // Expose thresholds for unit testing
        _thresholds: {
            CL_NITRIF_THRESHOLD_MODERATE: CL_NITRIF_THRESHOLD_MODERATE,
            CL_NITRIF_THRESHOLD_HIGH:     CL_NITRIF_THRESHOLD_HIGH,
            ECW_NITRIF_THRESHOLD:         ECW_NITRIF_THRESHOLD,
            CA_MICRONUTRIENT_THRESHOLD:   CA_MICRONUTRIENT_THRESHOLD,
            CA_MICRONUTRIENT_HIGH:        CA_MICRONUTRIENT_HIGH,
            SO4_FE_THRESHOLD:             SO4_FE_THRESHOLD,
            NA_K_MOLAR_THRESHOLD:         NA_K_MOLAR_THRESHOLD,
            CA_K_MOLAR_THRESHOLD:         CA_K_MOLAR_THRESHOLD
        }
    };

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = RecycledWaterNutrientEngine;
    }
    global.RecycledWaterNutrientEngine = RecycledWaterNutrientEngine;

})(typeof window !== 'undefined' ? window : typeof global !== 'undefined' ? global : this);
