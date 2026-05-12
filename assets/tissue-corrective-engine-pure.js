/**
 * TISSUE CORRECTIVE ENGINE - PURE EXTRACTED v2.0.0
 * 
 * Pure-function tissue corrective diagnosis engine.
 * f(tissueData, soilData, waterData, calendarProgram, options) → corrections + overlay
 * 
 * Extracted from tissue-corrective-engine.js v1.0.0.
 * All DOM reads and window globals REMOVED.
 * Rendering functions REMOVED (integration layer responsibility).
 * 
 * Required inputs (all via function parameters):
 *   tissueData:     { values: { N, P, K, ... }, engineResult: tissueEngine.compute() output }
 *   soilData:       { ppm: { P, K, ... }, pH, methodology }
 *   waterData:      { pH, ecw, HCO3, Na, Ca, Mg }
 *   calendarProgram: { program: { monthly: [...] }, annual_totals: {...} }
 *   options:        { sampleDate, productDelivery, correctiveWindowMonths }
 * 
 * Outputs:
 *   { corrections, overlay, correctiveMonths, sampleDate, version }
 * 
 * References:
 *   - Carrow, Waddington & Rieke (2001) Turfgrass Soil Fertility & Chemical Problems
 *   - Christians, Patton & Law (2017) Fundamentals of Turfgrass Management (5th ed.)
 *   - Turner & Hummel (1992) Nutritional Requirements and Fertilization, ASA Monograph 32
 *   - Marschner (2012) Mineral Nutrition of Higher Plants (3rd ed.)
 *   - Havlin, Tisdale, Nelson & Beaton (2014) Soil Fertility and Fertilizers (8th ed.)
 * 
 * @provides TissueCorrectiveEngine_Pure.diagnose(tissueData, soilData, waterData, calendarProgram, options)
 */

(function() {
    'use strict';

    // ========================================================================
    // CONFIGURATION
    // ========================================================================

    const CONFIG = {
        version: '2.0.0',
        debug: false,

        // Corrective window: months from sample date to inject supplementation
        correctiveWindowMonths: 3,

        // Resample prompt after this many months
        resamplePromptMonths: 3,

        // Minimum severity to trigger corrective action
        // 'Deficient' always triggers; 'Marginal' triggers for macros only
        marginalTriggerMacros: true,
        marginalTriggerMicros: false
    };

    // ========================================================================
    // FOLIAR RATE DATABASE
    // ========================================================================
    // Rates in kg/ha (solids) or L/ha (liquids) per application
    // Based on: Christians, Patton & Law (2017); Carrow et al. (2001);
    // Marschner (2012); industry standard practice
    //
    // Each entry provides:
    //   chemistry:    Active compound name
    //   formula:      Chemical formula
    //   rate:         Application rate per event (kg/ha or L/ha)
    //   unit:         'kg/ha' or 'L/ha'
    //   concentration: Nutrient content of the product (fraction)
    //   frequency:    Days between applications
    //   responseWindow: Expected days to tissue response
    //   maxApps:      Maximum applications in corrective window
    //   notes:        Application notes
    //   uptakeRoute:  Primary for this nutrient — always 'foliar' in this table
    // ========================================================================

    const FOLIAR_RATES = {
        // ── MACRONUTRIENTS ──────────────────────────────────────────────────

        N: {
            deficient: {
                chemistry: 'Urea',
                formula: 'CO(NH₂)₂',
                rate: 5.0,
                unit: 'kg/ha',
                concentration: 0.46,
                nutrientDelivered: 2.3,    // kg N/ha per app
                nutrientUnit: 'kg N/ha',
                frequency: 14,
                responseWindow: 7,
                maxApps: 6,
                notes: 'Apply in 200-400 L water/ha. Avoid >30°C. Evening application preferred.',
                phSensitivity: null
            },
            marginal: {
                chemistry: 'Urea',
                formula: 'CO(NH₂)₂',
                rate: 3.0,
                unit: 'kg/ha',
                concentration: 0.46,
                nutrientDelivered: 1.4,
                nutrientUnit: 'kg N/ha',
                frequency: 21,
                responseWindow: 7,
                maxApps: 4,
                notes: 'Light supplementation to complement soil program.',
                phSensitivity: null
            }
        },

        P: {
            deficient: {
                chemistry: 'Mono-potassium phosphate',
                formula: 'KH₂PO₄',
                rate: 5.0,
                unit: 'kg/ha',
                concentration: 0.228,       // 22.8% P (52% P₂O₅)
                nutrientDelivered: 1.14,
                nutrientUnit: 'kg P/ha',
                frequency: 14,
                responseWindow: 14,
                maxApps: 6,
                notes: 'Also delivers 28% K. Highly soluble; tank-mix compatible. Apply in 300-500 L water/ha.',
                phSensitivity: null
            },
            marginal: {
                chemistry: 'Mono-potassium phosphate',
                formula: 'KH₂PO₄',
                rate: 3.0,
                unit: 'kg/ha',
                concentration: 0.228,
                nutrientDelivered: 0.68,
                nutrientUnit: 'kg P/ha',
                frequency: 21,
                responseWindow: 14,
                maxApps: 4,
                notes: 'Monitor tissue response at 21 days before continuing.',
                phSensitivity: null
            }
        },

        K: {
            deficient: {
                chemistry: 'Potassium sulphate',
                formula: 'K₂SO₄',
                rate: 8.0,
                unit: 'kg/ha',
                concentration: 0.415,       // 41.5% K (50% K₂O)
                nutrientDelivered: 3.32,
                nutrientUnit: 'kg K/ha',
                frequency: 14,
                responseWindow: 14,
                maxApps: 6,
                notes: 'Also delivers 18% S. Dissolve fully before spraying. Apply in 400-600 L water/ha.',
                phSensitivity: null
            },
            marginal: {
                chemistry: 'Potassium sulphate',
                formula: 'K₂SO₄',
                rate: 5.0,
                unit: 'kg/ha',
                concentration: 0.415,
                nutrientDelivered: 2.08,
                nutrientUnit: 'kg K/ha',
                frequency: 21,
                responseWindow: 14,
                maxApps: 4,
                notes: 'Supplement to soil K program.',
                phSensitivity: null
            }
        },

        Ca: {
            deficient: {
                chemistry: 'Calcium chloride',
                formula: 'CaCl₂',
                rate: 5.0,
                unit: 'kg/ha',
                concentration: 0.272,       // 27.2% Ca
                nutrientDelivered: 1.36,
                nutrientUnit: 'kg Ca/ha',
                frequency: 14,
                responseWindow: 14,
                maxApps: 6,
                notes: 'Highly soluble. Apply in 300-500 L water/ha. Avoid mixing with phosphate fertilisers.',
                phSensitivity: null
            },
            marginal: {
                chemistry: 'Calcium chloride',
                formula: 'CaCl₂',
                rate: 3.0,
                unit: 'kg/ha',
                concentration: 0.272,
                nutrientDelivered: 0.82,
                nutrientUnit: 'kg Ca/ha',
                frequency: 21,
                responseWindow: 14,
                maxApps: 4,
                notes: 'Check K:Ca tissue ratio, if K is also high, Ca uptake may be suppressed.',
                phSensitivity: null
            }
        },

        Mg: {
            deficient: {
                chemistry: 'Magnesium sulphate heptahydrate',
                formula: 'MgSO₄·7H₂O',
                rate: 10.0,
                unit: 'kg/ha',
                concentration: 0.098,       // 9.8% Mg
                nutrientDelivered: 0.98,
                nutrientUnit: 'kg Mg/ha',
                frequency: 14,
                responseWindow: 14,
                maxApps: 6,
                notes: 'Epsom salt. Also delivers 13% S. Very soluble; safe on foliage. Apply in 300-500 L water/ha.',
                phSensitivity: null
            },
            marginal: {
                chemistry: 'Magnesium sulphate heptahydrate',
                formula: 'MgSO₄·7H₂O',
                rate: 5.0,
                unit: 'kg/ha',
                concentration: 0.098,
                nutrientDelivered: 0.49,
                nutrientUnit: 'kg Mg/ha',
                frequency: 21,
                responseWindow: 14,
                maxApps: 4,
                notes: 'If K:Mg tissue ratio >8:1, address K excess concurrently.',
                phSensitivity: null
            }
        },

        S: {
            deficient: {
                chemistry: 'Magnesium sulphate heptahydrate',
                formula: 'MgSO₄·7H₂O',
                rate: 10.0,
                unit: 'kg/ha',
                concentration: 0.13,        // 13% S
                nutrientDelivered: 1.3,
                nutrientUnit: 'kg S/ha',
                frequency: 14,
                responseWindow: 14,
                maxApps: 6,
                notes: 'Dual Mg+S correction. If Mg is adequate, use potassium sulphate instead.',
                phSensitivity: null
            },
            marginal: {
                chemistry: 'Potassium sulphate',
                formula: 'K₂SO₄',
                rate: 5.0,
                unit: 'kg/ha',
                concentration: 0.18,        // 18% S
                nutrientDelivered: 0.9,
                nutrientUnit: 'kg S/ha',
                frequency: 21,
                responseWindow: 14,
                maxApps: 4,
                notes: 'Also delivers K. Use if both S and K are marginal.',
                phSensitivity: null
            }
        },

        // ── MICRONUTRIENTS ──────────────────────────────────────────────────

        Fe: {
            deficient: {
                chemistry: 'Iron DTPA chelate',
                formula: 'Fe-DTPA (11% Fe)',
                rate: 3.0,
                unit: 'L/ha',
                concentration: 0.11,
                nutrientDelivered: 0.33,
                nutrientUnit: 'kg Fe/ha',
                frequency: 14,
                responseWindow: 7,
                maxApps: 8,
                notes: 'Stable at pH 3-7. If soil pH >7.5, use Fe-EDDHA for soil and Fe-DTPA for foliar. Apply in 300-500 L water/ha.',
                phSensitivity: 'high'
            }
        },

        Mn: {
            deficient: {
                chemistry: 'Manganese sulphate',
                formula: 'MnSO₄·H₂O',
                rate: 3.0,
                unit: 'kg/ha',
                concentration: 0.325,       // 32.5% Mn
                nutrientDelivered: 0.975,
                nutrientUnit: 'kg Mn/ha',
                frequency: 14,
                responseWindow: 10,
                maxApps: 6,
                notes: 'Foliar is primary correction route, soil Mn availability highly pH-dependent. Most effective at pH <6.5.',
                phSensitivity: 'high'
            }
        },

        Zn: {
            deficient: {
                chemistry: 'Zinc sulphate heptahydrate',
                formula: 'ZnSO₄·7H₂O',
                rate: 2.0,
                unit: 'kg/ha',
                concentration: 0.227,       // 22.7% Zn
                nutrientDelivered: 0.454,
                nutrientUnit: 'kg Zn/ha',
                frequency: 14,
                responseWindow: 14,
                maxApps: 6,
                notes: 'Check P:Zn interaction, high soil P suppresses Zn uptake. If soil P >80 ppm (MLSN), foliar Zn is preferred route.',
                phSensitivity: 'moderate'
            }
        },

        Cu: {
            deficient: {
                chemistry: 'Copper sulphate pentahydrate',
                formula: 'CuSO₄·5H₂O',
                rate: 1.0,
                unit: 'kg/ha',
                concentration: 0.254,       // 25.4% Cu
                nutrientDelivered: 0.254,
                nutrientUnit: 'kg Cu/ha',
                frequency: 21,
                responseWindow: 21,
                maxApps: 4,
                notes: 'CAUTION: Cu is phytotoxic at low threshold. Do not exceed 1.5 kg/ha per application. Avoid in hot conditions.',
                phSensitivity: 'moderate'
            }
        },

        B: {
            deficient: {
                chemistry: 'Solubor (sodium octaborate)',
                formula: 'Na₂B₈O₁₃·4H₂O',
                rate: 1.5,
                unit: 'kg/ha',
                concentration: 0.205,       // 20.5% B
                nutrientDelivered: 0.308,
                nutrientUnit: 'kg B/ha',
                frequency: 21,
                responseWindow: 14,
                maxApps: 4,
                notes: 'CAUTION: Very narrow margin between deficiency and toxicity. Do not exceed 2.0 kg/ha. Sandy soils leach B rapidly.',
                phSensitivity: null
            }
        }
    };

    // ========================================================================
    // ANTAGONISM MATRIX
    // ========================================================================
    // Defines cation/anion interactions that explain uptake constraints
    // References: Marschner (2012); Havlin et al. (2014)

    const ANTAGONISMS = {
        'K→Mg': {
            aggressor: 'K',
            victim: 'Mg',
            tissueThreshold: { K: 3.5, Mg: 0.20 },  // K tissue above this + Mg below this
            mechanism: 'Competitive cation uptake, excess K displaces Mg at root exchange sites',
            correction: 'Reduce K applications; apply foliar Mg to bypass root competition',
            reference: 'Marschner (2012) Ch. 2.5'
        },
        'K→Ca': {
            aggressor: 'K',
            victim: 'Ca',
            tissueThreshold: { K: 3.5, Ca: 0.30 },
            mechanism: 'Competitive cation uptake, excess K displaces Ca at root exchange sites',
            correction: 'Reduce K applications; apply foliar Ca or gypsum',
            reference: 'Marschner (2012) Ch. 2.5'
        },
        'Ca→Mg': {
            aggressor: 'Ca',
            victim: 'Mg',
            tissueThreshold: { Ca: 0.80, Mg: 0.20 },
            mechanism: 'Competitive cation uptake, high Ca limits Mg absorption',
            correction: 'Apply foliar Mg; check lime application history',
            reference: 'Havlin et al. (2014) Ch. 7'
        },
        'P→Zn': {
            aggressor: 'P',
            victim: 'Zn',
            tissueThreshold: { P: 0.55, Zn: 20 },  // Zn in mg/kg
            mechanism: 'High P reduces Zn translocation from root to shoot',
            correction: 'Apply foliar Zn; reduce P applications if soil P is excessive',
            reference: 'Marschner (2012) Ch. 9'
        },
        'pH→Fe': {
            aggressor: 'pH',
            victim: 'Fe',
            soilPHThreshold: 7.2,
            mechanism: 'Alkaline pH converts soluble Fe²⁺ to insoluble Fe³⁺ oxides',
            correction: 'Foliar Fe-DTPA bypasses soil lock-up; acidify irrigation if feasible',
            reference: 'Havlin et al. (2014) Ch. 10'
        },
        'pH→Mn': {
            aggressor: 'pH',
            victim: 'Mn',
            soilPHThreshold: 7.0,
            mechanism: 'Alkaline pH reduces Mn²⁺ availability through oxidation to MnO₂',
            correction: 'Foliar Mn sulphate is primary correction; soil Mn amendments ineffective above pH 7',
            reference: 'Havlin et al. (2014) Ch. 10'
        },
        'HCO3→Fe': {
            aggressor: 'HCO3',
            victim: 'Fe',
            waterHCO3Threshold: 150,  // mg/L
            mechanism: 'High bicarbonate raises rhizosphere pH and inhibits Fe reductase in roots',
            correction: 'Foliar Fe essential; acidify irrigation water to reduce bicarbonate',
            reference: 'Marschner (2012) Ch. 9'
        },
        'HCO3→Mn': {
            aggressor: 'HCO3',
            victim: 'Mn',
            waterHCO3Threshold: 200,
            mechanism: 'Bicarbonate-induced alkalinity at root surface limits Mn²⁺ uptake',
            correction: 'Foliar Mn; water acidification recommended',
            reference: 'Marschner (2012) Ch. 9'
        },

        // ── Soil ratio antagonisms (predictive — fire from soil data alone) ──
        // These are evaluated by diagnoseSoilRatios(), not the tissue loop.
        // Defined here for reference consistency and export.

        'K→Mg_soil': {
            type: 'soil_ratio',
            aggressor: 'K',
            victim: 'Mg',
            ratioKey: 'K:Mg',
            riskThreshold: 3.0,    // K:Mg >3:1 by weight — imbalance risk
            severeThreshold: 5.0,  // >5:1 — likely induced Mg deficiency
            mechanism: 'Disproportionately high soil K:Mg ratio suppresses Mg uptake through competitive cation exclusion at root exchange sites. Soil values may individually clear MLSN minimums yet still induce Mg deficiency under sustained K loading.',
            correction: 'Reduce K inputs; priority foliar Mg (MgSO₄·7H₂O) to bypass root competition; reassess soil Mg program if ratio persists beyond one season',
            reference: 'Marschner (2012) Ch. 2.5; Havlin et al. (2014) Ch. 7'
        },

        'Mg→K_soil': {
            type: 'soil_ratio',
            aggressor: 'Mg',
            victim: 'K',
            ratioKey: 'Mg:K',
            riskThreshold: 10.0,   // Mg:K >10:1 by weight — risk
            severeThreshold: 15.0, // >15:1 — likely induced K deficiency
            mechanism: 'Excess soil Mg saturates cation exchange sites and displaces K uptake. Common on sites with heavy dolomite amendment history or high-Mg parent material.',
            correction: 'Cease Mg inputs; apply K₂SO₄ to soil; foliar K sulphate to bypass root competition',
            reference: 'Marschner (2012) Ch. 2.5'
        }
    };

    // ========================================================================
    // MLSN THRESHOLDS (for soil adequacy comparison)
    // b35fix301a: Local threshold tables and local getSoilThresholds() resolver
    //             moved to gaip-classification-constants.js. This file now
    //             reads from the shared constants module and retains its own
    //             thin wrappers that delegate to the shared resolver.
    // ========================================================================

    function _gcc() {
        return (typeof window !== 'undefined' && window.GilbaClassificationConstants) ||
               (typeof globalThis !== 'undefined' && globalThis.GilbaClassificationConstants) ||
               null;
    }

    const MLSN_THRESHOLDS = _gcc() ? _gcc().MLSN_THRESHOLDS : {
        // Fallback literal for Node-test contexts without the constants module loaded.
        // Production runs always have the constants module enqueued ahead of this file.
        P: 21, K: 37, Ca: 331, Mg: 47, S: 7,
        Fe: 2, Mn: 1, Zn: 1, Cu: 0.3, B: 0.3
    };

    const SLAN_THRESHOLDS = _gcc() ? _gcc().SLAN_THRESHOLDS : {
        P: 40, K: 117, Ca: 750, Mg: 120, S: 12,
        Fe: 2, Mn: 1, Zn: 1, Cu: 0.3, B: 0.3
    };

    const AA_THRESHOLDS = _gcc() ? _gcc().AA_THRESHOLDS : {
        sands:  { P: 12, K: 75,  Ca: 500, Mg: 100, S: 30, Fe: 40, Mn: 5, Zn: 1, Cu: 0.5, B: 0.3 },
        others: { P: 12, K: 100, Ca: 500, Mg: 140, S: 30, Fe: 40, Mn: 5, Zn: 1, Cu: 0.5, B: 0.3 }
    };

    /**
     * Get soil adequacy thresholds for current methodology.
     * v2.0.0 pure: texture passed as parameter, no DOM read.
     * b35fix301a: delegates to GilbaClassificationConstants.getSoilThresholds
     *             when available; falls back to local resolution otherwise.
     */
    function getSoilThresholds(methodology, soilTexture) {
        const gcc = _gcc();
        if (gcc && typeof gcc.getSoilThresholds === 'function') {
            return gcc.getSoilThresholds(methodology, soilTexture);
        }
        const m = (methodology || 'mlsn').toLowerCase();
        if (m === 'slan') return SLAN_THRESHOLDS;
        if (m === 'ammonium_acetate' || m === 'ammoniumacetate' || m === 'aa') {
            const texture = (soilTexture || 'sands').toLowerCase();
            return AA_THRESHOLDS[texture === 'others' ? 'others' : 'sands'];
        }
        return MLSN_THRESHOLDS;
    }

    // ========================================================================
    // STATE
    // ========================================================================

    // v2.0.0 pure: no mutable state — all data flows through function parameters

    // ========================================================================
    // LOGGING
    // ========================================================================

    function log(msg, data) {
        if (!CONFIG.debug) return;
        if (data !== undefined) {
        } else {
        }
    }

    function warn(msg, data) {
        if (data !== undefined) {
            console.warn('[TissueCorrectiveEngine] ' + msg, data);
        } else {
            console.warn('[TissueCorrectiveEngine] ' + msg);
        }
    }

    // ========================================================================
    // DATA COLLECTION
    // ========================================================================

    // v2.0.0 pure: collectTissueData REMOVED — caller provides tissueData directly

    // v2.0.0 pure: collectSoilData REMOVED — caller provides soilData directly

    // v2.0.0 pure: collectWaterData REMOVED — caller provides waterData directly

    // v2.0.0 pure: getSampleDate REMOVED — caller provides options.sampleDate

    // ========================================================================
    // DIAGNOSTIC ENGINE
    // ========================================================================

    /**
     * Diagnose deficiencies and determine if foliar correction is warranted
     * given what the base nutrition calendar already delivers.
     *
     * Foliar is recommended ONLY when:
     *   1. UPTAKE_CONSTRAINT — soil adequate but tissue low → foliar bypasses
     *      the root zone problem (pH lock-up, antagonism, compaction)
     *   2. URGENT_BRIDGE — soil also deficient AND tissue critically low
     *      (Deficient band) → foliar provides immediate response while the
     *      soil program corrects over 2-3 years
     *
     * Foliar is NOT recommended when:
     *   - Tissue is only Marginal and the soil program is already correcting
     *   - Both soil and tissue show the same deficiency but tissue is not
     *     critical — the calendar's soil-applied correction is sufficient
     */
    function diagnoseDeficiencies(tissueData, soilData, waterData, calendarProgram) {
        const corrections = [];
        const tissueResult = tissueData.engineResult;
        if (!tissueResult || !tissueResult.status) return corrections;

        const status = tissueResult.status;
        const tissueValues = tissueResult.normalized || tissueData.values;
        const antagonisms = tissueResult.antagonisms || [];

        const macros = ['N', 'P', 'K', 'Ca', 'Mg', 'S'];
        const micros = ['Fe', 'Mn', 'Zn', 'Cu', 'B'];
        const allNutrients = [...macros, ...micros];

        // Get what the base calendar already delivers per month
        const calendarMonthly = calendarProgram?.program?.monthly || [];
        const calendarAnnual = calendarProgram?.annual_totals || {};

        allNutrients.forEach(nutrient => {
            const st = status[nutrient];
            if (!st) return;

            const band = st.band;
            const type = macros.includes(nutrient) ? 'macro' : 'micro';

            // Only Deficient and Marginal are candidates
            if (band !== 'Deficient' && band !== 'Marginal') return;

            // Diagnose the cause
            const diagnosis = diagnoseCause(nutrient, band, type, tissueValues, soilData, waterData, antagonisms);

            // ── DECISION: Is foliar correction warranted? ───────────────

            let foliarWarranted = false;
            let reason = '';

            if (diagnosis.category === 'UPTAKE_CONSTRAINT') {
                // Soil has it, plant can't access it → foliar bypass is the correct route
                foliarWarranted = true;
                reason = 'Foliar bypasses root zone constraint';

            } else if (diagnosis.category === 'SUPPLY_DEFICIT') {
                // Soil is also low — calendar should already be correcting via soil program

                if (band === 'Deficient') {
                    // Critically low tissue — calendar addresses soil over 2-3 years
                    // but plant needs nutrients NOW. Foliar bridge for immediate response.
                    foliarWarranted = true;
                    reason = 'Urgent foliar bridge, tissue critically low while soil program builds reserves';
                } else {
                    // Marginal tissue + soil deficit = calendar is handling it
                    // The soil-applied correction will lift tissue over coming months
                    const calendarDelivery = calendarAnnual[nutrient] || 0;
                    foliarWarranted = false;
                    reason = `Base program already delivers ${calendarDelivery} kg/ha annually to correct soil deficit. Allow 2-3 months for tissue response.`;
                    
                    // Still record as an info item (no foliar, but note for user)
                    corrections.push({
                        nutrient: nutrient,
                        type: type,
                        band: band,
                        tissueValue: tissueValues[nutrient],
                        diagnosis: diagnosis,
                        rate: null,
                        priority: 3,  // Info only
                        foliarWarranted: false,
                        reason: reason
                    });
                    return;
                }

            } else if (diagnosis.category === 'DEMAND_EXCESS') {
                // No soil data — can't determine supply vs uptake
                if (band === 'Deficient') {
                    foliarWarranted = true;
                    reason = 'No soil data to assess supply, foliar recommended for critical deficiency';
                } else {
                    foliarWarranted = false;
                    reason = 'Marginal without soil data, submit soil test to refine diagnosis';
                    corrections.push({
                        nutrient: nutrient,
                        type: type,
                        band: band,
                        tissueValue: tissueValues[nutrient],
                        diagnosis: diagnosis,
                        rate: null,
                        priority: 3,
                        foliarWarranted: false,
                        reason: reason
                    });
                    return;
                }
            }

            if (!foliarWarranted) return;

            // Get foliar rate
            const rateEntry = FOLIAR_RATES[nutrient];
            if (!rateEntry) {
                log(`No foliar rate defined for ${nutrient}, skipping`);
                return;
            }

            const severity = band === 'Deficient' ? 'deficient' : 'marginal';
            const rate = rateEntry[severity] || rateEntry.deficient;
            if (!rate) return;

            corrections.push({
                nutrient: nutrient,
                type: type,
                band: band,
                tissueValue: tissueValues[nutrient],
                diagnosis: diagnosis,
                rate: rate,
                priority: band === 'Deficient' ? 1 : 2,
                foliarWarranted: true,
                reason: reason
            });
        });

        // Sort: foliar-warranted first, then by priority, then by nutrient importance
        const nutrientOrder = ['N', 'K', 'P', 'Ca', 'Mg', 'S', 'Fe', 'Mn', 'Zn', 'Cu', 'B'];
        corrections.sort((a, b) => {
            // Foliar-warranted items first
            if (a.foliarWarranted !== b.foliarWarranted) return a.foliarWarranted ? -1 : 1;
            if (a.priority !== b.priority) return a.priority - b.priority;
            return nutrientOrder.indexOf(a.nutrient) - nutrientOrder.indexOf(b.nutrient);
        });

        return corrections;
    }

    /**
     * Diagnose the root cause of a specific nutrient deficiency
     */
    function diagnoseCause(nutrient, band, type, tissueValues, soilData, waterData, antagonisms) {
        const result = {
            category: 'UNKNOWN',
            cause: '',
            constraints: [],
            antagonism: null
        };

        const soilPpm = soilData.ppm?.[nutrient];
        const thresholds = getSoilThresholds(soilData.methodology, soilData.texture);
        const threshold = thresholds[nutrient];
        const soilAdequate = (soilPpm !== undefined && threshold !== undefined) ? soilPpm >= threshold : null;

        // ── Check for antagonism first ──────────────────────────────────────

        for (const [key, ant] of Object.entries(ANTAGONISMS)) {
            if (ant.victim !== nutrient) continue;

            // pH-based antagonism
            if (ant.aggressor === 'pH' && soilData.pH) {
                if (soilData.pH >= ant.soilPHThreshold) {
                    result.constraints.push({
                        type: 'pH_LOCK',
                        message: ant.mechanism,
                        correction: ant.correction,
                        reference: ant.reference
                    });
                }
                continue;
            }

            // HCO3-based antagonism (water quality)
            if (ant.aggressor === 'HCO3' && waterData.HCO3) {
                if (waterData.HCO3 >= ant.waterHCO3Threshold) {
                    result.constraints.push({
                        type: 'WATER_QUALITY',
                        message: ant.mechanism,
                        correction: ant.correction,
                        reference: ant.reference
                    });
                }
                continue;
            }

            // Cation antagonism (tissue-based)
            if (ant.tissueThreshold) {
                const aggressorVal = tissueValues[ant.aggressor];
                const victimVal = tissueValues[ant.victim];
                const aggressorThresh = ant.tissueThreshold[ant.aggressor];
                const victimThresh = ant.tissueThreshold[ant.victim];

                if (aggressorVal !== undefined && victimVal !== undefined) {
                    if (aggressorVal > aggressorThresh && victimVal < victimThresh) {
                        result.antagonism = {
                            key: key,
                            aggressor: ant.aggressor,
                            aggressorValue: aggressorVal,
                            mechanism: ant.mechanism,
                            correction: ant.correction,
                            reference: ant.reference
                        };
                    }
                }
            }
        }

        // ── Determine primary category ──────────────────────────────────────

        if (soilAdequate === false) {
            // Soil is also deficient — supply problem
            result.category = 'SUPPLY_DEFICIT';
            result.cause = `Soil ${nutrient} below threshold (${soilPpm?.toFixed(1) || '?'} ppm vs ${threshold} ppm). Both soil amendment and foliar bridge recommended.`;
        } else if (soilAdequate === true && (result.constraints.length > 0 || result.antagonism)) {
            // Soil adequate but tissue low with identified constraint
            result.category = 'UPTAKE_CONSTRAINT';
            if (result.antagonism) {
                result.cause = `Soil ${nutrient} adequate (${soilPpm.toFixed(1)} ppm) but uptake suppressed by ${result.antagonism.aggressor} antagonism. ${result.antagonism.mechanism}`;
            } else {
                result.cause = `Soil ${nutrient} adequate (${soilPpm.toFixed(1)} ppm) but uptake constrained. ${result.constraints[0].message}`;
            }
        } else if (soilAdequate === true) {
            // Soil adequate, no identified constraint — likely demand or root issue
            result.category = 'UPTAKE_CONSTRAINT';
            result.cause = `Soil ${nutrient} adequate (${soilPpm.toFixed(1)} ppm) but tissue low → possible root zone limitation (compaction, waterlogging, or root damage). Foliar bypass recommended.`;
        } else {
            // No soil data — can't determine supply vs uptake
            result.category = 'DEMAND_EXCESS';
            result.cause = `Tissue ${nutrient} ${band.toLowerCase()}. Foliar supplementation recommended. Submit soil test to refine diagnosis.`;
        }

        return result;
    }

    // v2.0.0 pure: collectProductDelivery REMOVED — caller provides options.productDelivery

    // v2.0.0 pure: getCorrectiveMonths inlined in diagnose()

    /**
     * Calculate total corrective nutrient delivery per month
     * GAP-AWARE: Compares tissue need against what the product program
     * (Prebble/AU granular+liquid) already delivers vs calendar requirement.
     * Only recommends foliar for the unmet portion.
     *
     * For UPTAKE_CONSTRAINT diagnoses, foliar is always recommended at full rate
     * regardless of product coverage — the problem is the plant can't access
     * soil-applied nutrients, so foliar bypass is the correct route.
     */
    function calculateMonthlyOverlay(corrections, correctiveMonths, calendarProgram, productDelivery) {
        const overlay = {};
        const calendarMonthly = calendarProgram?.program?.monthly || [];

        correctiveMonths.forEach(monthIdx => {
            overlay[monthIdx] = {
                nutrients: {},
                applications: []
            };
        });

        // Only include corrections where foliar is actually warranted
        const foliarCorrections = corrections.filter(c => c.foliarWarranted && c.rate);

        // ── Pre-calculate: which macros have ANY product delivery across the window? ──
        // If a product program is delivering a macro nutrient at all, it's managing that nutrient.
        // Foliar on top of granular for the same macro = double-handling.
        // Exception: uptake constraints (plant can't access soil-applied nutrients).
        const macrosCoveredByProducts = new Set();
        if (productDelivery) {
            const macros = ['N', 'P', 'K', 'Ca', 'Mg', 'S'];
            macros.forEach(nutrient => {
                const totalDelivered = correctiveMonths.reduce((sum, mIdx) => {
                    return sum + (productDelivery[mIdx]?.[nutrient] || 0);
                }, 0);
                if (totalDelivered > 0) {
                    macrosCoveredByProducts.add(nutrient);
                }
            });
            if (macrosCoveredByProducts.size > 0) {
                log('Macros covered by product program:', [...macrosCoveredByProducts].join(', '));
            }
        }

        foliarCorrections.forEach(correction => {
            const rate = correction.rate;
            const nutrient = correction.nutrient;
            const isUptakeConstraint = correction.diagnosis.category === 'UPTAKE_CONSTRAINT';
            const isMicro = correction.type === 'micro';

            // ── MACRO + PRODUCT PROGRAM = SKIP (unless uptake constraint) ──
            // The product program (Prebble/AU) is designed to meet calendar requirements.
            // Adding foliar for the same macro nutrient is double-handling.
            if (!isMicro && !isUptakeConstraint && macrosCoveredByProducts.has(nutrient)) {
                log(`${nutrient}: product program delivers this macro, skipping foliar (not an uptake constraint)`);
                return;
            }

            // Calculate full applications per month based on frequency
            const appsPerMonth = Math.floor(30 / rate.frequency);
            const fullMonthDelivery = rate.nutrientDelivered * appsPerMonth;

            correctiveMonths.forEach(monthIdx => {
                let nutrientPerMonth = fullMonthDelivery;

                // ── GAP-AWARE: Scale foliar if product program already covers part of the need ──
                // Exceptions (always full foliar):
                //   - Uptake constraints: soil-applied isn't reaching the plant
                //   - Micronutrients: not tracked in base calendar or granular programs
                if (!isUptakeConstraint && !isMicro && productDelivery && calendarMonthly[monthIdx]) {
                    const required = calendarMonthly[monthIdx][nutrient] || 0;
                    const delivered = productDelivery[monthIdx]?.[nutrient] || 0;
                    const gap = Math.max(0, required - delivered);

                    if (gap <= 0) {
                        // Product program meets or exceeds calendar requirement for this nutrient
                        // No foliar needed — the supply side is covered
                        log(`${nutrient} @ month ${monthIdx}: product delivers ${delivered.toFixed(1)} vs ${required.toFixed(1)} required, fully covered, skipping foliar`);
                        return;
                    }

                    // Scale foliar to just cover the gap, not the full rate
                    if (gap < nutrientPerMonth) {
                        nutrientPerMonth = Math.round(gap * 100) / 100;
                        log(`${nutrient} @ month ${monthIdx}: gap ${gap.toFixed(1)} kg/ha, scaled foliar from ${fullMonthDelivery.toFixed(1)} to ${nutrientPerMonth.toFixed(1)}`);
                    }
                }

                if (nutrientPerMonth <= 0) return;

                if (!overlay[monthIdx].nutrients[nutrient]) {
                    overlay[monthIdx].nutrients[nutrient] = 0;
                }
                overlay[monthIdx].nutrients[nutrient] += nutrientPerMonth;

                // Calculate adjusted application count if scaled down
                const adjustedApps = nutrientPerMonth < fullMonthDelivery
                    ? Math.max(1, Math.ceil(nutrientPerMonth / rate.nutrientDelivered))
                    : appsPerMonth;

                overlay[monthIdx].applications.push({
                    nutrient: nutrient,
                    chemistry: rate.chemistry,
                    formula: rate.formula,
                    rate: rate.rate,
                    unit: rate.unit,
                    frequency: nutrientPerMonth < fullMonthDelivery
                        ? Math.round(30 / adjustedApps)
                        : rate.frequency,
                    appsPerMonth: adjustedApps,
                    nutrientDelivered: nutrientPerMonth,
                    nutrientUnit: rate.nutrientUnit,
                    notes: rate.notes + (nutrientPerMonth < fullMonthDelivery ? ' (rate adjusted to fill product program gap)' : ''),
                    diagnosis: correction.diagnosis.category,
                    band: correction.band,
                    gapAdjusted: nutrientPerMonth < fullMonthDelivery,
                    isUptakeBypass: isUptakeConstraint
                });
            });
        });

        return overlay;
    }

    // ========================================================================
    // SOIL RATIO ANTAGONISM CHECK (predictive — no tissue data required)
    // ========================================================================

    /**
     * Check soil cation ratios for antagonism risk independent of tissue status.
     * Fires even when tissue data is absent — this is the predictive layer.
     *
     * @param {object} soilData - { ppm: { K, Mg, ... } }
     * @returns {Array} warnings — empty if no issues or no soil data
     */
    function diagnoseSoilRatios(soilData) {
        const warnings = [];
        if (!soilData || !soilData.ppm) return warnings;

        const K  = soilData.ppm.K;
        const Mg = soilData.ppm.Mg;

        // K:Mg — most agronomically common on turf programs
        if (K !== undefined && Mg !== undefined && Mg > 0) {
            const ratio = K / Mg;
            const ant   = ANTAGONISMS['K→Mg_soil'];
            if (ratio >= ant.riskThreshold) {
                warnings.push({
                    type:       'CATION_RATIO_RISK',
                    key:        'K→Mg_soil',
                    severity:   ratio >= ant.severeThreshold ? 'HIGH' : 'MODERATE',
                    ratio:      parseFloat(ratio.toFixed(2)),
                    ratioLabel: 'K:Mg',
                    soilK:      K,
                    soilMg:     Mg,
                    aggressor:  'K',
                    victim:     'Mg',
                    mechanism:  ant.mechanism,
                    correction: ant.correction,
                    reference:  ant.reference
                });
            }
        }

        // Mg:K — less common; dolomite amendment or high-Mg parent material sites
        if (K !== undefined && Mg !== undefined && K > 0) {
            const ratio = Mg / K;
            const ant   = ANTAGONISMS['Mg→K_soil'];
            if (ratio >= ant.riskThreshold) {
                warnings.push({
                    type:       'CATION_RATIO_RISK',
                    key:        'Mg→K_soil',
                    severity:   ratio >= ant.severeThreshold ? 'HIGH' : 'MODERATE',
                    ratio:      parseFloat(ratio.toFixed(2)),
                    ratioLabel: 'Mg:K',
                    soilK:      K,
                    soilMg:     Mg,
                    aggressor:  'Mg',
                    victim:     'K',
                    mechanism:  ant.mechanism,
                    correction: ant.correction,
                    reference:  ant.reference
                });
            }
        }

        return warnings;
    }

    // ========================================================================
    // PURE API - MAIN ENTRY POINT
    // ========================================================================

    /**
     * Diagnose tissue deficiencies and calculate corrective overlay.
     * Pure function: no DOM reads, no event dispatching.
     *
     * @param {object} tissueData - { values: { N, P, K, ... }, engineResult: tissueEngine.compute() output }
     * @param {object} soilData - { ppm: { P, K, ... }, pH, methodology, texture, hasData }
     * @param {object} waterData - { pH, ecw, HCO3, Na, Ca, Mg, hasData }
     * @param {object} calendarProgram - { program: { monthly: [...] }, annual_totals: {...} }
     * @param {object} options - { sampleDate (Date), productDelivery, correctiveWindowMonths }
     * @returns {object|null} { corrections, overlay, correctiveMonths, soilRatioWarnings, sampleDate, version }
     */
    function diagnose(tissueData, soilData, waterData, calendarProgram, options) {
        options = options || {};

        if (!tissueData || !tissueData.values || Object.keys(tissueData.values).length < 3) {
            return null;
        }
        if (!tissueData.engineResult) {
            return null;
        }

        const sampleDate = options.sampleDate instanceof Date 
            ? options.sampleDate 
            : options.sampleDate ? new Date(options.sampleDate) : null;
        if (!sampleDate || isNaN(sampleDate.getTime())) {
            throw new Error('tissue-corrective-engine-pure: options.sampleDate is required');
        }

        soilData = soilData || { ppm: {}, hasData: false };
        waterData = waterData || { hasData: false };

        // Soil ratio check runs regardless of tissue data completeness
        const soilRatioWarnings = diagnoseSoilRatios(soilData);

        // Diagnose
        const corrections = diagnoseDeficiencies(tissueData, soilData, waterData, calendarProgram);

        if (corrections.length === 0) {
            return { corrections: [], overlay: {}, correctiveMonths: [], soilRatioWarnings, sampleDate, version: CONFIG.version };
        }

        // Calculate overlay
        const windowMonths = options.correctiveWindowMonths || CONFIG.correctiveWindowMonths;
        const correctiveMonths = [];
        const sm = sampleDate.getMonth();
        for (let i = 0; i < windowMonths; i++) {
            correctiveMonths.push((sm + i) % 12);
        }

        const productDelivery = options.productDelivery || null;
        const overlay = calculateMonthlyOverlay(corrections, correctiveMonths, calendarProgram, productDelivery);

        return {
            corrections,
            overlay,
            correctiveMonths,
            soilRatioWarnings,
            sampleDate,
            version: CONFIG.version
        };
    }

    // ========================================================================
    // EXPORTS
    // ========================================================================

    const TissueCorrectiveEngine_Pure = {
        version: CONFIG.version,
        diagnose: diagnose,

        // Sub-functions for testing
        _diagnoseDeficiencies: diagnoseDeficiencies,
        _diagnoseCause: diagnoseCause,
        _diagnoseSoilRatios: diagnoseSoilRatios,
        _calculateMonthlyOverlay: calculateMonthlyOverlay,
        _getSoilThresholds: getSoilThresholds,

        // Constants (exposed for test verification)
        FOLIAR_RATES: FOLIAR_RATES,
        ANTAGONISMS: ANTAGONISMS,
        MLSN_THRESHOLDS: MLSN_THRESHOLDS,
        SLAN_THRESHOLDS: SLAN_THRESHOLDS,
        AA_THRESHOLDS: AA_THRESHOLDS,
        CONFIG: CONFIG
    };

    if (typeof window !== 'undefined') {
        window.TissueCorrectiveEngine_Pure = TissueCorrectiveEngine_Pure;
    }
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = TissueCorrectiveEngine_Pure;
    }

})();
