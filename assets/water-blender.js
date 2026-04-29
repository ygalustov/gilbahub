/**
 * ============================================================================
 * GILBA WATER BLENDER v1.2.0
 * ============================================================================
 *
 * v1.2.0 (b35fix335): Tier 1 provenance audit — adj RNa via FAO Table 11
 *   - Pre-fix calcSuarezSARadj used an empirical power-law
 *     Cax = Ca × 1/(1 + 0.15 × (HCO3/Ca − 1)^1.5)
 *     which (a) does not appear in Suarez 1981, and (b) ignores ECw entirely.
 *     Suarez 1981 / FAO Irrigation & Drainage Paper 29 Rev. 1 (Ayers &
 *     Westcot 1985) Table 11 tabulates Cax against BOTH HCO3/Ca AND ECw —
 *     ECw shifts Cax by 1.5–2× across the practical 0.1–8 dS/m range.
 *   - Replaced with bilinear interpolation across the published Table 11
 *     grid (27 HCO3/Ca rows × 12 ECw columns). Reference test: FAO 29
 *     Example 6 (HCO3/Ca=1.76, ECw=1.15 dS/m) returns Cax≈1.43 me/l;
 *     adj RNa = 7.73 / √((1.43+1.44)/2) ≈ 6.46.
 *   - Output renamed to adj RNa (FAO terminology) with adjSAR retained as
 *     alias for backward compatibility with existing consumers.
 *   - Direction of the adjustment unchanged (HCO3/Ca > 1 → Ca down → SAR up).
 *   - Magnitudes shift modestly on freshwater, materially on saline-alkali.
 *
 * v1.1.0: Earlier Suarez SARadj implementation (replaced by v1.2.0).
 *
 * Multi-source irrigation water blending calculator with full Hub integration.
 * Calculates blended chemistry and feeds results to existing water quality,
 * salinity penalty, phytotoxicity, and irrigation scheduler modules.
 *
 * SCIENTIFIC BASIS:
 * - Volumetric linear blending for conservative ions
 * - SAR calculation: Na / √((Ca + Mg) / 2)
 * - adj RNa (Suarez 1981 via FAO 29 Table 11): Cax(HCO3/Ca, ECw) lookup,
 *   then RNa = Na / √((Cax + Mg) / 2)
 * - RSC (Residual Sodium Carbonate): (HCO₃ + CO₃) − (Ca + Mg)
 * - LSI (Langelier Saturation Index): pH − pHc
 * - pHc via Langelier approximation at 25°C
 * - Classifications per Ayers & Westcot (1985), Carrow & Duncan (1998)
 *
 * INTEGRATION POINTS:
 * - Water Progressive Disclosure: Feeds blended chemistry for analysis
 * - Salinity Penalty: Uses blended EC for growth impact
 * - Phytotoxicity Engine: Uses blended Na, Cl, B, HCO₃
 * - Irrigation Scheduler: Leaching requirement from blended salinity
 *
 * ============================================================================
 */

(function(global) {
    'use strict';

    var EPS = 1e-9;

    // ========================================================================
    // CONFIGURATION
    // ========================================================================

    var BLEND_CONFIG = {
        version: '1.2.0',
        
        // Ion equivalent weights for meq/L conversion (from mg/L)
        equivalentWeights: {
            Ca: 20.04,
            Mg: 12.15,
            Na: 23.0,
            K: 39.1,
            Cl: 35.45,
            SO4: 48.03,
            HCO3: 61.0,
            CO3: 30.0
        },
        
        // Classification thresholds (Ayers & Westcot 1985, PACE Turf)
        thresholds: {
            salinity: {
                low: 0.75,      // dS/m
                moderate: 1.5,
                high: 3.0
            },
            sodicity: {
                low: 3,         // SAR
                moderate: 6,
                high: 9,
                veryHigh: 18
            },
            bicarbonate: {
                low: 1.5,       // meq/L HCO₃
                moderate: 2.5,
                high: 4.0
            },
            RSC: {
                safe: 0,        // meq/L
                marginal: 1.25,
                hazard: 2.5
            },
            chloride: {
                safe: 142,      // mg/L (4 meq/L)
                moderate: 250,
                high: 355
            },
            boron: {
                safe: 0.5,      // mg/L
                moderate: 1.0,
                sensitive: 2.0
            }
        },
        
        // Infiltration hazard matrix (SAR × EC interaction)
        // Based on Ayers & Westcot Figure 1
        infiltrationMatrix: [
            // [minSAR, maxSAR, minEC for "no problem", EC for "increasing problem"]
            { sarMin: 0,  sarMax: 3,  ecSafe: 0.2,  ecProblem: 0.7 },
            { sarMin: 3,  sarMax: 6,  ecSafe: 0.3,  ecProblem: 1.2 },
            { sarMin: 6,  sarMax: 12, ecSafe: 0.5,  ecProblem: 1.9 },
            { sarMin: 12, sarMax: 20, ecSafe: 1.3,  ecProblem: 2.9 },
            { sarMin: 20, sarMax: 40, ecSafe: 2.9,  ecProblem: 5.0 }
        ]
    };

    // ========================================================================
    // UTILITY FUNCTIONS
    // ========================================================================

    function safeNum(v, fallback) {
        var n = parseFloat(v);
        return isFinite(n) ? n : (fallback !== undefined ? fallback : 0);
    }

    var clamp = GAIP_Utils.clamp;

    function toMeq(mgL, ion) {
        var eqWt = BLEND_CONFIG.equivalentWeights[ion];
        if (!eqWt) return 0;
        return safeNum(mgL) / eqWt;
    }

    function toMgL(meq, ion) {
        var eqWt = BLEND_CONFIG.equivalentWeights[ion];
        if (!eqWt) return 0;
        return safeNum(meq) * eqWt;
    }

    // ========================================================================
    // CORE CHEMISTRY CALCULATIONS
    // ========================================================================

    /**
     * Calculate SAR (Sodium Adsorption Ratio)
     * SAR = Na / √((Ca + Mg) / 2)
     * All inputs in meq/L
     */
    function calcSAR(Ca_meq, Mg_meq, Na_meq) {
        Ca_meq = safeNum(Ca_meq);
        Mg_meq = safeNum(Mg_meq);
        Na_meq = safeNum(Na_meq);
        
        var denom = Math.sqrt(Math.max((Ca_meq + Mg_meq) / 2, EPS));
        return Na_meq / denom;
    }

    /**
     * Calculate adjusted SAR (SARadj) using Suarez (1981) modification
     * 
     * Accounts for Ca precipitation as CaCO₃ when HCO₃ is elevated.
     * When HCO₃/Ca ratio > 1, calcium precipitates out of solution,
     * reducing effective Ca and increasing sodium hazard.
     * 
     * adj.SAR = Na / √((Cax + Mg) / 2)
     * 
     * Where Cax = effective Ca after accounting for HCO₃-induced precipitation
     * 
     * CITATION: Suarez DL (1981) Relation between pHc and Sodium Adsorption Ratio
     *           and an alternative method of estimating SAR of soil or drainage waters.
     *           Soil Sci. Soc. Am. J. 45:469-475
     * 
     * @param {number} Ca_meq - Calcium in meq/L
     * @param {number} Mg_meq - Magnesium in meq/L  
     * @param {number} Na_meq - Sodium in meq/L
     * @param {number} HCO3_meq - Bicarbonate in meq/L
     * @returns {Object} { adjSAR, basicSAR, Cax, HCO3_Ca_ratio, adjustment, method }
     */
    /**
     * FAO Irrigation & Drainage Paper 29 Rev. 1 (Ayers & Westcot 1985) Table 11
     * — Calcium concentration (Cax, me/l) expected to remain in near-surface
     * soil-water following irrigation, as a function of HCO3/Ca ratio (rows)
     * and applied-water ECw in dS/m (columns). Adapted from Suarez 1981.
     *
     * Assumptions (FAO 29 footnotes):
     *   - Soil source of Ca from lime (CaCO3) or silicates
     *   - No precipitation of magnesium
     *   - PCO2 near soil surface = 0.0007 atm
     *
     * Used by calcSuarezSARadj (b35fix335) — bilinear interpolation between
     * grid points; clamped to grid edges outside the published range.
     */
    var FAO29_TABLE11_HCO3_CA = [
        0.05, 0.10, 0.15, 0.20, 0.25, 0.30, 0.35, 0.40, 0.45, 0.50,
        0.75, 1.00, 1.25, 1.50, 1.75, 2.00, 2.25, 2.50,
        3.00, 3.50, 4.00, 4.50, 5.00, 7.00, 10.00, 20.00, 30.00
    ];
    var FAO29_TABLE11_ECW = [
        0.1, 0.2, 0.3, 0.5, 0.7, 1.0, 1.5, 2.0, 3.0, 4.0, 6.0, 8.0
    ];
    // Cax values in me/l. Row index = HCO3/Ca, column index = ECw.
    var FAO29_TABLE11_CAX = [
        [13.20, 13.61, 13.92, 14.40, 14.79, 15.26, 15.91, 16.43, 17.28, 17.97, 19.07, 19.94], // 0.05
        [ 8.31,  8.57,  8.77,  9.07,  9.31,  9.62, 10.02, 10.35, 10.89, 11.32, 12.01, 12.56], // 0.10
        [ 6.34,  6.54,  6.69,  6.92,  7.11,  7.34,  7.65,  7.90,  8.31,  8.64,  9.17,  9.58], // 0.15
        [ 5.24,  5.40,  5.52,  5.71,  5.87,  6.06,  6.31,  6.52,  6.86,  7.13,  7.57,  7.91], // 0.20
        [ 4.51,  4.65,  4.76,  4.92,  5.06,  5.22,  5.44,  5.62,  5.91,  6.15,  6.52,  6.82], // 0.25
        [ 4.00,  4.12,  4.21,  4.36,  4.48,  4.62,  4.82,  4.98,  5.24,  5.44,  5.77,  6.04], // 0.30
        [ 3.61,  3.72,  3.80,  3.94,  4.04,  4.17,  4.35,  4.49,  4.72,  4.91,  5.21,  5.45], // 0.35
        [ 3.30,  3.40,  3.48,  3.60,  3.70,  3.82,  3.98,  4.11,  4.32,  4.49,  4.77,  4.98], // 0.40
        [ 3.05,  3.14,  3.22,  3.33,  3.42,  3.53,  3.68,  3.80,  4.00,  4.15,  4.41,  4.61], // 0.45
        [ 2.84,  2.93,  3.00,  3.10,  3.19,  3.29,  3.43,  3.54,  3.72,  3.87,  4.11,  4.30], // 0.50
        [ 2.17,  2.24,  2.29,  2.37,  2.43,  2.51,  2.62,  2.70,  2.84,  2.95,  3.14,  3.28], // 0.75
        [ 1.79,  1.85,  1.89,  1.96,  2.01,  2.09,  2.16,  2.23,  2.35,  2.44,  2.59,  2.71], // 1.00
        [ 1.54,  1.59,  1.63,  1.68,  1.73,  1.78,  1.86,  1.92,  2.02,  2.10,  2.23,  2.33], // 1.25
        [ 1.37,  1.41,  1.44,  1.49,  1.53,  1.58,  1.65,  1.70,  1.79,  1.86,  1.97,  2.07], // 1.50
        [ 1.23,  1.27,  1.30,  1.35,  1.38,  1.43,  1.49,  1.54,  1.62,  1.68,  1.78,  1.86], // 1.75
        [ 1.13,  1.16,  1.19,  1.23,  1.26,  1.31,  1.36,  1.40,  1.48,  1.54,  1.63,  1.70], // 2.00
        [ 1.04,  1.08,  1.10,  1.14,  1.17,  1.21,  1.26,  1.30,  1.37,  1.42,  1.51,  1.58], // 2.25
        [ 0.97,  1.00,  1.02,  1.06,  1.09,  1.12,  1.17,  1.21,  1.27,  1.32,  1.40,  1.47], // 2.50
        [ 0.85,  0.89,  0.91,  0.94,  0.96,  1.00,  1.04,  1.07,  1.13,  1.17,  1.24,  1.30], // 3.00
        [ 0.78,  0.80,  0.82,  0.85,  0.87,  0.90,  0.94,  0.97,  1.02,  1.06,  1.12,  1.17], // 3.50
        [ 0.71,  0.73,  0.75,  0.78,  0.80,  0.82,  0.86,  0.88,  0.93,  0.97,  1.03,  1.07], // 4.00
        [ 0.66,  0.68,  0.69,  0.72,  0.74,  0.76,  0.79,  0.82,  0.86,  0.90,  0.95,  0.99], // 4.50
        [ 0.61,  0.63,  0.65,  0.67,  0.69,  0.71,  0.74,  0.76,  0.80,  0.83,  0.88,  0.93], // 5.00
        [ 0.49,  0.50,  0.52,  0.53,  0.55,  0.57,  0.59,  0.61,  0.64,  0.67,  0.71,  0.74], // 7.00
        [ 0.39,  0.40,  0.41,  0.42,  0.43,  0.45,  0.47,  0.48,  0.51,  0.53,  0.56,  0.58], // 10.00
        [ 0.24,  0.25,  0.26,  0.26,  0.27,  0.28,  0.29,  0.30,  0.32,  0.33,  0.35,  0.37], // 20.00
        [ 0.18,  0.19,  0.20,  0.20,  0.21,  0.21,  0.22,  0.23,  0.24,  0.25,  0.27,  0.28]  // 30.00
    ];

    /**
     * Bilinear interpolation lookup of Cax from FAO 29 Table 11.
     * Inputs outside the published grid are clamped to the nearest edge.
     *
     * @param {number} hco3CaRatio - HCO3/Ca in me/l basis
     * @param {number} ecw_dSm     - ECw of applied water in dS/m
     * @returns {number} Cax in me/l
     */
    function lookupCaxFAO29(hco3CaRatio, ecw_dSm) {
        var rows = FAO29_TABLE11_HCO3_CA;
        var cols = FAO29_TABLE11_ECW;
        var grid = FAO29_TABLE11_CAX;

        // Clamp inputs to grid bounds (reasonable agronomic clamping; the table
        // already covers ECw 0.1–8 dS/m and HCO3/Ca 0.05–30 which spans virtually
        // all natural irrigation waters)
        var r = Math.max(rows[0], Math.min(rows[rows.length - 1], hco3CaRatio));
        var c = Math.max(cols[0], Math.min(cols[cols.length - 1], ecw_dSm));

        // Find bracketing row indices
        var i0 = 0;
        for (var i = 0; i < rows.length - 1; i++) {
            if (r >= rows[i] && r <= rows[i + 1]) { i0 = i; break; }
            if (i === rows.length - 2) { i0 = i; }
        }
        var i1 = i0 + 1;

        // Find bracketing column indices
        var j0 = 0;
        for (var j = 0; j < cols.length - 1; j++) {
            if (c >= cols[j] && c <= cols[j + 1]) { j0 = j; break; }
            if (j === cols.length - 2) { j0 = j; }
        }
        var j1 = j0 + 1;

        // Bilinear weights
        var rSpan = rows[i1] - rows[i0];
        var cSpan = cols[j1] - cols[j0];
        var rT = rSpan > 0 ? (r - rows[i0]) / rSpan : 0;
        var cT = cSpan > 0 ? (c - cols[j0]) / cSpan : 0;

        var v00 = grid[i0][j0];
        var v01 = grid[i0][j1];
        var v10 = grid[i1][j0];
        var v11 = grid[i1][j1];

        var v0 = v00 * (1 - cT) + v01 * cT;
        var v1 = v10 * (1 - cT) + v11 * cT;
        return v0 * (1 - rT) + v1 * rT;
    }

    /**
     * Calculate adjusted SAR (adj RNa) using the Suarez (1981) procedure
     * as operationalised in FAO Irrigation & Drainage Paper 29 Rev. 1
     * (Ayers & Westcot 1985), Table 11.
     *
     * adj RNa = Na / √((Cax + Mg) / 2)
     *
     * where Cax is the calcium concentration expected to remain in the
     * near-surface soil-water at equilibrium, looked up from Table 11 by
     * (HCO3/Ca ratio, ECw). ECw is required: at fixed HCO3/Ca ratio, Cax
     * shifts by ~1.5–2× across the practical 0.1–8 dS/m ECw range.
     *
     * b35fix335: replaces the pre-fix empirical power-law formula
     *   Cax = Ca × 1/(1 + 0.15 × (HCO3/Ca − 1)^1.5)
     * which did not appear in Suarez 1981 and ignored ECw.
     *
     * CITATIONS:
     *   - Suarez DL (1981) Relation between pHc and sodium adsorption ratio
     *     (SAR) and an alternative method of estimating SAR of soil or
     *     drainage waters. Soil Sci. Soc. Am. J. 45:469–475.
     *     DOI 10.2136/sssaj1981.03615995004500030005x
     *   - Ayers RS & Westcot DW (1985) Water quality for agriculture.
     *     FAO Irrigation & Drainage Paper 29 Rev. 1, Table 11.
     *
     * @param {number} Ca_meq    - Calcium of applied water in me/l
     * @param {number} Mg_meq    - Magnesium of applied water in me/l
     * @param {number} Na_meq    - Sodium of applied water in me/l
     * @param {number} HCO3_meq  - Bicarbonate of applied water in me/l
     * @param {number} [ECw_dSm] - ECw of applied water in dS/m. If omitted
     *                              or zero, defaults to 0.5 dS/m (mid-range
     *                              freshwater) and result is flagged
     *                              ecwMissing=true.
     * @returns {Object} { adjSAR, basicSAR, Cax, HCO3_Ca_ratio, ECw,
     *                     adjustment, method, citation, ecwMissing }
     */
    function calcSuarezSARadj(Ca_meq, Mg_meq, Na_meq, HCO3_meq, ECw_dSm) {
        Ca_meq   = safeNum(Ca_meq);
        Mg_meq   = safeNum(Mg_meq);
        Na_meq   = safeNum(Na_meq);
        HCO3_meq = safeNum(HCO3_meq);
        var ecwProvided = (ECw_dSm != null && !isNaN(ECw_dSm) && ECw_dSm > 0);
        var ecw = ecwProvided ? Number(ECw_dSm) : 0.5;

        // Basic SAR for comparison
        var denomBasic = Math.sqrt(Math.max((Ca_meq + Mg_meq) / 2, EPS));
        var basicSAR = Na_meq / denomBasic;

        // If minimal HCO3 OR negligible Ca, adj RNa collapses to basic SAR.
        // FAO 29 notes Table 11 starts at HCO3/Ca = 0.05; below that the Ca
        // adjustment is immaterial.
        var hco3CaRatio = HCO3_meq / Math.max(Ca_meq, 0.01);
        if (HCO3_meq < 0.5 || hco3CaRatio < 0.05) {
            return {
                adjSAR: basicSAR,
                basicSAR: basicSAR,
                Cax: Ca_meq,
                HCO3_Ca_ratio: hco3CaRatio,
                ECw: ecw,
                adjustment: 1.0,
                method: 'Basic SAR (HCO3/Ca below FAO Table 11 lower bound)',
                citation: 'Standard SAR equation',
                ecwMissing: !ecwProvided
            };
        }

        var Cax = lookupCaxFAO29(hco3CaRatio, ecw);
        Cax = Math.max(Cax, 0.1); // numerical floor, well below any tabulated value

        var adjDenom = Math.sqrt(Math.max((Cax + Mg_meq) / 2, EPS));
        var adjSAR = Na_meq / adjDenom;
        var adjustment = adjSAR / Math.max(basicSAR, 0.01);

        return {
            adjSAR: adjSAR,            // alias retained for backward compatibility
            basicSAR: basicSAR,
            Cax: Cax,
            HCO3_Ca_ratio: hco3CaRatio,
            ECw: ecw,
            adjustment: adjustment,
            method: 'adj RNa via FAO 29 Table 11 (Suarez 1981)',
            citation: 'Suarez DL (1981) SSSAJ 45:469-475; Ayers & Westcot (1985) FAO 29 Rev. 1 Table 11',
            ecwMissing: !ecwProvided
        };
    }
    
    /**
     * Legacy wrapper for backward compatibility — returns just the adjusted
     * SAR scalar. b35fix335: now forwards EC_dSm into calcSuarezSARadj so the
     * FAO Table 11 lookup uses the correct ECw column. Pre-fix, EC_dSm was
     * accepted but discarded — the empirical formula did not use it.
     */
    function calcSARadj(SAR, EC_dSm, HCO3_meq, Ca_meq, Mg_meq, Na_meq) {
        // If we have the full ion data, use proper FAO Table 11 / Suarez 1981 lookup
        if (Ca_meq !== undefined && Mg_meq !== undefined && Na_meq !== undefined) {
            var result = calcSuarezSARadj(Ca_meq, Mg_meq, Na_meq, HCO3_meq, EC_dSm);
            return result.adjSAR;
        }
        // Fallback to basic SAR if insufficient data
        return safeNum(SAR);
    }

    /**
     * Calculate RSC (Residual Sodium Carbonate)
     * RSC = (HCO₃ + CO₃) − (Ca + Mg)
     * Positive RSC → Ca/Mg precipitate out, leaving Na-dominant water
     */
    function calcRSC(HCO3_meq, CO3_meq, Ca_meq, Mg_meq) {
        return (safeNum(HCO3_meq) + safeNum(CO3_meq)) - (safeNum(Ca_meq) + safeNum(Mg_meq));
    }

    /**
     * Estimate pHc (saturation pH) via Langelier approach
     * pHc = (9.3 + A + B) − (C + D)
     * Where A, B, C, D are functions of TDS, temp, hardness, alkalinity
     */
    function calcPHc(EC_dSm, Ca_meq, Mg_meq, alkalinity_meq, tempC) {
        EC_dSm = safeNum(EC_dSm);
        Ca_meq = safeNum(Ca_meq);
        Mg_meq = safeNum(Mg_meq);
        alkalinity_meq = safeNum(alkalinity_meq);
        tempC = safeNum(tempC, 25);
        
        // Approximate TDS from EC: TDS (mg/L) ≈ EC (dS/m) × 640
        var TDS = EC_dSm * 640;
        
        // Hardness as CaCO₃ equivalent (mg/L)
        var Ca_hard = Ca_meq * 50;   // 1 meq Ca = 50 mg/L as CaCO₃
        var Mg_hard = Mg_meq * 50;   // 1 meq Mg = 50 mg/L as CaCO₃
        var hardness = Math.max(Ca_hard + Mg_hard, EPS);
        
        // Alkalinity as CaCO₃ (mg/L)
        var Alk_mgL = Math.max(alkalinity_meq * 50, EPS);
        
        // Langelier factors
        var A = (Math.log10(Math.max(TDS, 1)) - 1) / 10;
        var B = -13.12 * Math.log10(tempC + 273) + 34.55;
        var C = Math.log10(Math.max(hardness, 1));
        var D = Math.log10(Math.max(Alk_mgL, 1));
        
        return (9.3 + A + B) - (C + D);
    }

    /**
     * Calculate LSI (Langelier Saturation Index)
     * LSI = pH − pHc
     * LSI > 0 → scale-forming (CaCO₃ precipitates)
     * LSI < 0 → corrosive (dissolves CaCO₃)
     */
    function calcLSI(actualPH, pHc) {
        return safeNum(actualPH) - safeNum(pHc);
    }

    // ========================================================================
    // CLASSIFICATION FUNCTIONS
    // ========================================================================

    function classifySalinity(EC_dSm) {
        EC_dSm = safeNum(EC_dSm);
        var t = BLEND_CONFIG.thresholds.salinity;
        
        if (EC_dSm < t.low) {
            return {
                code: 'Low',
                class: 'status-adequate',
                desc: 'Low salinity risk. Suitable for most turf species without special management.'
            };
        }
        if (EC_dSm < t.moderate) {
            return {
                code: 'Low-Moderate',
                class: 'status-adequate',
                desc: 'Acceptable for salt-tolerant species. Monitor soil EC in tight soils.'
            };
        }
        if (EC_dSm < t.high) {
            return {
                code: 'Moderate',
                class: 'status-borderline',
                desc: 'Moderate salinity. Leaching fraction required, species selection important.'
            };
        }
        return {
            code: 'High',
            class: 'status-deficient',
            desc: 'High salinity hazard. Salt-tolerant species only, aggressive leaching, monitor soil EC.'
        };
    }

    function classifySodicity(SAR) {
        SAR = safeNum(SAR);
        var t = BLEND_CONFIG.thresholds.sodicity;
        
        if (SAR < t.low) {
            return {
                code: 'Low',
                class: 'status-adequate',
                desc: 'Low sodicity risk. No structural concerns from sodium.'
            };
        }
        if (SAR < t.moderate) {
            return {
                code: 'Low-Moderate',
                class: 'status-adequate',
                desc: 'Generally acceptable. Monitor on fine-textured soils.'
            };
        }
        if (SAR < t.high) {
            return {
                code: 'Moderate',
                class: 'status-borderline',
                desc: 'Moderate sodicity. Risk on clays, compacted soils. Consider gypsum.'
            };
        }
        if (SAR < t.veryHigh) {
            return {
                code: 'High',
                class: 'status-deficient',
                desc: 'High sodicity. Structural decline likely without calcium amendments.'
            };
        }
        return {
            code: 'Very High',
            class: 'status-deficient',
            desc: 'Severe sodicity hazard. Aggressive amendment program required.'
        };
    }

    /**
     * Infiltration hazard based on SAR × EC interaction
     * Low EC + High SAR = worst case (clay dispersion)
     */
    function classifyInfiltration(SAR, EC_dSm) {
        SAR = safeNum(SAR);
        EC_dSm = safeNum(EC_dSm);
        
        // Find appropriate SAR band
        var matrix = BLEND_CONFIG.infiltrationMatrix;
        var band = null;
        
        for (var i = 0; i < matrix.length; i++) {
            if (SAR >= matrix[i].sarMin && SAR < matrix[i].sarMax) {
                band = matrix[i];
                break;
            }
        }
        
        // SAR > 40 uses last band
        if (!band && SAR >= 20) {
            band = matrix[matrix.length - 1];
        }
        
        if (!band) {
            return {
                code: 'Low',
                class: 'status-adequate',
                desc: 'No infiltration concerns at this SAR/EC combination.'
            };
        }
        
        if (EC_dSm >= band.ecProblem) {
            return {
                code: 'Low',
                class: 'status-adequate',
                desc: 'EC adequate to maintain flocculation at this SAR level.'
            };
        }
        
        if (EC_dSm >= band.ecSafe) {
            return {
                code: 'Moderate',
                class: 'status-borderline',
                desc: 'Increasing infiltration risk. EC marginal for this SAR. Monitor Ksat.'
            };
        }
        
        return {
            code: 'High',
            class: 'status-deficient',
            desc: 'High infiltration hazard. Low EC + elevated SAR causes clay dispersion. Gypsum or blending required.'
        };
    }

    function classifyBicarbonate(HCO3_meq, RSC) {
        HCO3_meq = safeNum(HCO3_meq);
        RSC = safeNum(RSC);
        
        var t = BLEND_CONFIG.thresholds;
        
        if (RSC > t.RSC.hazard || HCO3_meq > t.bicarbonate.high) {
            return {
                code: 'High',
                class: 'status-deficient',
                desc: 'High bicarbonate/RSC hazard. Scaling, pH drift, Ca precipitation likely. Acidification recommended.'
            };
        }
        
        if (RSC > t.RSC.marginal || HCO3_meq > t.bicarbonate.moderate) {
            return {
                code: 'Moderate',
                class: 'status-borderline',
                desc: 'Moderate bicarbonate. Monitor pH, surface crusting. Consider acidification.'
            };
        }
        
        if (HCO3_meq > t.bicarbonate.low) {
            return {
                code: 'Low-Moderate',
                class: 'status-adequate',
                desc: 'Acceptable bicarbonate levels. No treatment typically required.'
            };
        }
        
        return {
            code: 'Low',
            class: 'status-adequate',
            desc: 'Low bicarbonate hazard.'
        };
    }

    function classifyLSI(LSI) {
        LSI = safeNum(LSI);
        
        if (LSI > 0.5) {
            return {
                code: 'Scale-Forming',
                class: 'status-borderline',
                desc: 'Water is supersaturated with CaCO₃. Expect scale in pipes, emitters, and on leaf surfaces.'
            };
        }
        if (LSI > 0) {
            return {
                code: 'Slightly Scaling',
                class: 'status-adequate',
                desc: 'Slight tendency to deposit CaCO₃. Generally acceptable for irrigation.'
            };
        }
        if (LSI > -0.5) {
            return {
                code: 'Balanced',
                class: 'status-adequate',
                desc: 'Near equilibrium. Neither scaling nor corrosive.'
            };
        }
        return {
            code: 'Corrosive',
            class: 'status-borderline',
            desc: 'Water is undersaturated. May dissolve CaCO₃ from soil, corrode metal components.'
        };
    }

    // ========================================================================
    // BLENDING FUNCTIONS
    // ========================================================================

    /**
     * Normalize blend fractions to sum to 1.0
     */
    function normalizeFractions(fractions) {
        var sum = 0;
        var i;
        
        for (i = 0; i < fractions.length; i++) {
            sum += safeNum(fractions[i]);
        }
        
        if (sum <= 0) {
            // Default to equal fractions
            var equal = 1 / Math.max(1, fractions.length);
            var result = [];
            for (i = 0; i < fractions.length; i++) {
                result.push(equal);
            }
            return result;
        }
        
        var normalized = [];
        for (i = 0; i < fractions.length; i++) {
            normalized.push(safeNum(fractions[i]) / sum);
        }
        return normalized;
    }

    /**
     * Linear volumetric blend of a single field across sources
     */
    function blendField(sources, fractions, field) {
        var sum = 0;
        for (var i = 0; i < sources.length; i++) {
            var src = sources[i] || {};
            sum += fractions[i] * safeNum(src[field]);
        }
        return sum;
    }

    /**
     * Main blending computation
     * 
     * @param {Array} sources - Array of water source objects with ion concentrations (mg/L)
     * @param {Array} fractions - Optional array of blend fractions (0-1 or 0-100)
     * @param {Object} options - Optional: { temperatureC: 25 }
     * @returns {Object} Blended chemistry and classifications
     */
    function computeBlend(sources, fractions, options) {
        if (!Array.isArray(sources) || sources.length === 0) {
            return { error: 'At least one water source is required.' };
        }
        
        // Handle optional arguments
        if (!Array.isArray(fractions) && typeof fractions === 'object') {
            options = fractions;
            fractions = null;
        }
        
        options = options || {};
        var tempC = safeNum(options.temperatureC, 25);
        
        // Get fractions from sources if not provided
        if (!fractions) {
            fractions = [];
            for (var i = 0; i < sources.length; i++) {
                fractions.push(safeNum(sources[i].fraction, 1));
            }
        }
        
        var fx = normalizeFractions(fractions);
        
        // Blend all fields (mg/L for ions, dS/m for EC)
        var blended = {
            EC_dSm: blendField(sources, fx, 'EC_dSm'),
            pH: blendField(sources, fx, 'pH'),
            Ca: blendField(sources, fx, 'Ca'),
            Mg: blendField(sources, fx, 'Mg'),
            Na: blendField(sources, fx, 'Na'),
            K: blendField(sources, fx, 'K'),
            Cl: blendField(sources, fx, 'Cl'),
            SO4: blendField(sources, fx, 'SO4'),
            HCO3: blendField(sources, fx, 'HCO3'),
            CO3: blendField(sources, fx, 'CO3'),
            B: blendField(sources, fx, 'B'),
            Fe: blendField(sources, fx, 'Fe'),
            NO3: blendField(sources, fx, 'NO3'),
            PO4: blendField(sources, fx, 'PO4')
        };
        
        // Convert to meq/L for calculations
        var Ca_meq = toMeq(blended.Ca, 'Ca');
        var Mg_meq = toMeq(blended.Mg, 'Mg');
        var Na_meq = toMeq(blended.Na, 'Na');
        var K_meq = toMeq(blended.K, 'K');
        var Cl_meq = toMeq(blended.Cl, 'Cl');
        var SO4_meq = toMeq(blended.SO4, 'SO4');
        var HCO3_meq = toMeq(blended.HCO3, 'HCO3');
        var CO3_meq = toMeq(blended.CO3, 'CO3');
        
        // Estimate alkalinity if not provided (assume HCO₃ + CO₃)
        var alkalinity_meq = HCO3_meq + CO3_meq;
        
        // Derived chemistry
        var SAR = calcSAR(Ca_meq, Mg_meq, Na_meq);
        // b35fix335: forward EC_dSm so FAO Table 11 lookup uses the correct ECw column
        var suarezResult = calcSuarezSARadj(Ca_meq, Mg_meq, Na_meq, HCO3_meq, blended.EC_dSm);
        var SARadj = suarezResult.adjSAR;
        var RSC = calcRSC(HCO3_meq, CO3_meq, Ca_meq, Mg_meq);
        var pHc = calcPHc(blended.EC_dSm, Ca_meq, Mg_meq, alkalinity_meq, tempC);
        var LSI = calcLSI(blended.pH, pHc);
        
        // Ion balance check (cations vs anions)
        var cations = Ca_meq + Mg_meq + Na_meq + K_meq;
        var anions = Cl_meq + SO4_meq + HCO3_meq + CO3_meq;
        var ionBalance = cations > 0 ? ((cations - anions) / cations) * 100 : 0;
        
        // Classifications
        var classifications = {
            salinity: classifySalinity(blended.EC_dSm),
            sodicity: classifySodicity(SAR),
            infiltration: classifyInfiltration(SAR, blended.EC_dSm),
            bicarbonate: classifyBicarbonate(HCO3_meq, RSC),
            LSI: classifyLSI(LSI)
        };
        
        return {
            blendedMgL: blended,
            blendedMeq: {
                Ca: Ca_meq,
                Mg: Mg_meq,
                Na: Na_meq,
                K: K_meq,
                Cl: Cl_meq,
                SO4: SO4_meq,
                HCO3: HCO3_meq,
                CO3: CO3_meq,
                alkalinity: alkalinity_meq
            },
            derived: {
                SAR: SAR,
                SARadj: SARadj,
                RSC: RSC,
                pHc: pHc,
                LSI: LSI,
                ionBalance: ionBalance,
                suarez: {
                    Cax: suarezResult.Cax,
                    HCO3_Ca_ratio: suarezResult.HCO3_Ca_ratio,
                    adjustment: suarezResult.adjustment,
                    method: suarezResult.method,
                    citation: suarezResult.citation
                }
            },
            classifications: classifications,
            fractionsNormalized: fx,
            sourceCount: sources.length,
            ccpi: calcCCPI(blended.pH, pHc),
            ccpiClassification: classifyCCPI(calcCCPI(blended.pH, pHc)),
            _sources: sources  // retained for optimiser in toHubWaterState
        };
    }

    // ========================================================================
    // HUB STATE INTEGRATION
    // ========================================================================

    /**
     * Convert blended result to Hub water state format
     * This allows blended water to flow through existing analysis modules
     */
    function toHubWaterState(blendResult) {
        if (!blendResult || blendResult.error) {
            return null;
        }
        
        var b = blendResult.blendedMgL;
        
        var d = blendResult.derived;
        var c = blendResult.classifications;
        var ccpiVal = blendResult.ccpi !== undefined ? blendResult.ccpi : null;
        var ccpiClass = blendResult.ccpiClassification || null;

        // Run optimiser if ≥2 sources
        var optimiserResult = null;
        if (blendResult._sources && blendResult._sources.length >= 2) {
            try { optimiserResult = findOptimalBlend(blendResult._sources); } catch(e) {}
        }

        return {
            ecw: b.EC_dSm,
            pH: b.pH,
            ions: {
                Ca: b.Ca,
                Mg: b.Mg,
                Na: b.Na,
                K: b.K,
                Cl: b.Cl,
                SO4: b.SO4,
                HCO3: b.HCO3,
                CO3: b.CO3,
                B: b.B,
                Fe: b.Fe,
                NO3: b.NO3,
                PO4: b.PO4
            },
            // Derived values for word export
            SAR: d ? d.SAR : null,
            SARadj: d ? d.SARadj : null,
            RSC: d ? d.RSC : null,
            LSI: d ? d.LSI : null,
            // Classifications
            salinityClass: c ? c.salinity : null,
            sodicityClass: c ? c.sodicity : null,
            infiltrationClass: c ? c.infiltration : null,
            bicarbonateClass: c ? c.bicarbonate : null,
            // CCPI
            ccpi: ccpiVal,
            ccpiClassification: ccpiClass,
            // Optimiser
            optimiserResult: optimiserResult,
            // Flag that this is blended water
            isBlended: true,
            sourceCount: blendResult.sourceCount,
            blendFractions: blendResult.fractionsNormalized
        };
    }

    /**
     * Create sources array from Hub UI inputs
     */
    function sourcesFromUI(sourceElements) {
        var sources = [];
        
        if (!sourceElements || !sourceElements.length) {
            return sources;
        }
        
        for (var i = 0; i < sourceElements.length; i++) {
            var el = sourceElements[i];
            if (!el) continue;
            
            var source = {
                label: el.label || ('Source ' + (i + 1)),
                fraction: safeNum(el.fraction, 0),
                EC_dSm: safeNum(el.EC_dSm || el.ecw, 0),
                pH: safeNum(el.pH, 7),
                Ca: safeNum(el.Ca, 0),
                Mg: safeNum(el.Mg, 0),
                Na: safeNum(el.Na, 0),
                K: safeNum(el.K, 0),
                Cl: safeNum(el.Cl, 0),
                SO4: safeNum(el.SO4, 0),
                HCO3: safeNum(el.HCO3, 0),
                CO3: safeNum(el.CO3, 0),
                B: safeNum(el.B, 0),
                Fe: safeNum(el.Fe, 0),
                NO3: safeNum(el.NO3, 0),
                PO4: safeNum(el.PO4, 0)
            };
            
            // Only add if source has meaningful data
            if (source.EC_dSm > 0 || source.Ca > 0 || source.Na > 0) {
                sources.push(source);
            }
        }
        
        return sources;
    }

    // ========================================================================
    // UI RENDERING
    // ========================================================================

    /**
     * Render blender results as progressive disclosure cards
     */
    function renderBlenderResults(blendResult, sources) {
        if (!blendResult || blendResult.error) {
            return '<p class="gaip-note">' + (blendResult ? blendResult.error : 'No blend data') + '</p>';
        }
        
        var b = blendResult.blendedMgL;
        var d = blendResult.derived;
        var c = blendResult.classifications;
        var fx = blendResult.fractionsNormalized;
        
        var html = '<div class="gaip-water-blender-results">';
        
        // Summary card
        html += renderBlendSummaryCard(b, d, c, fx, sources);
        
        // Individual classification cards
        html += '<div class="gaip-mlsn-cards-grid" style="margin-top: 12px;">';
        html += renderClassificationCard('Salinity (EC)', b.EC_dSm.toFixed(2) + ' dS/m', c.salinity);
        html += renderClassificationCard('Sodium Hazard (SAR)', d.SAR.toFixed(1), c.sodicity);
        html += renderClassificationCard('Infiltration Risk', 'SAR ' + d.SAR.toFixed(1) + ' × EC ' + b.EC_dSm.toFixed(2), c.infiltration);
        html += renderClassificationCard('Bicarbonate (RSC)', d.RSC.toFixed(2) + ' meq/L', c.bicarbonate);
        html += renderClassificationCard('Scale Potential (LSI)', d.LSI.toFixed(2), c.LSI);
        html += '</div>';
        
        // Detailed chemistry (collapsed)
        html += renderDetailedChemistry(blendResult);
        
        html += '</div>';
        
        return html;
    }

    function renderBlendSummaryCard(b, d, c, fx, sources) {
        // Determine overall status
        var worstClass = 'status-adequate';
        var statusCounts = { deficient: 0, borderline: 0, adequate: 0 };
        
        for (var key in c) {
            if (c[key].class === 'status-deficient') {
                statusCounts.deficient++;
                worstClass = 'status-deficient';
            } else if (c[key].class === 'status-borderline' && worstClass !== 'status-deficient') {
                statusCounts.borderline++;
                worstClass = 'status-borderline';
            } else {
                statusCounts.adequate++;
            }
        }
        
        var statusText = worstClass === 'status-deficient' ? 'Issues Detected' :
                        worstClass === 'status-borderline' ? 'Monitor' : 'Acceptable';
        var statusIcon = worstClass === 'status-deficient' ? '⚠️' :
                        worstClass === 'status-borderline' ? '⚡' : '✓';
        
        // Build source labels
        var sourceLabels = [];
        for (var i = 0; i < sources.length; i++) {
            var pct = Math.round(fx[i] * 100);
            var label = sources[i].label || ('Source ' + (i + 1));
            sourceLabels.push(pct + '% ' + label);
        }
        
        var html = '<div class="gaip-diagnostic-card" style="margin-bottom: 12px;">';
        html += '<div class="gaip-verdict">';
        html += '<div class="gaip-verdict-header">';
        html += '<h4 class="gaip-parameter">Blended Water Quality</h4>';
        html += '<span class="gaip-status-badge ' + worstClass + '">';
        html += '<span class="gaip-status-icon">' + statusIcon + '</span> ' + statusText;
        html += '</span>';
        html += '</div>';
        
        html += '<div class="gaip-verdict-content">';
        html += '<div class="gaip-driver"><span class="gaip-label">Blend ratio</span>';
        html += '<span class="gaip-value">' + sourceLabels.join(' + ') + '</span></div>';
        html += '<div class="gaip-driver"><span class="gaip-label">Blended EC</span>';
        html += '<span class="gaip-value">' + b.EC_dSm.toFixed(2) + ' dS/m</span></div>';
        html += '<div class="gaip-driver"><span class="gaip-label">Blended SAR</span>';
        html += '<span class="gaip-value">' + d.SAR.toFixed(1) + '</span></div>';
        html += '</div>';
        
        if (statusCounts.deficient > 0 || statusCounts.borderline > 0) {
            html += '<p style="font-size: 12px; color: var(--gaip-text); margin: 8px 0 0 0;">';
            if (statusCounts.deficient > 0) {
                html += '<span style="color: #dc2626;">' + statusCounts.deficient + ' high-risk</span>';
            }
            if (statusCounts.borderline > 0) {
                if (statusCounts.deficient > 0) html += ', ';
                html += '<span style="color: #d97706;">' + statusCounts.borderline + ' monitor</span>';
            }
            html += ' parameters below';
            html += '</p>';
        }
        
        html += '</div></div>';
        
        return html;
    }

    function renderClassificationCard(label, value, classification) {
        var sectionId = 'blend-' + label.replace(/[^a-z0-9]/gi, '-').toLowerCase() + '-' + Date.now();
        
        var html = '<div class="gaip-diagnostic-card">';
        html += '<div class="gaip-verdict">';
        html += '<div class="gaip-verdict-header">';
        html += '<h4 class="gaip-parameter">' + label + '</h4>';
        html += '<span class="gaip-status-badge ' + classification.class + '">' + classification.code + '</span>';
        html += '</div>';
        
        html += '<div class="gaip-verdict-content">';
        html += '<div class="gaip-driver"><span class="gaip-label">Value</span>';
        html += '<span class="gaip-value">' + value + '</span></div>';
        html += '</div>';
        
        html += '<div class="gaip-verdict-actions">';
        html += '<button class="gaip-expand-btn" data-target="' + sectionId + '">';
        html += '<span class="gaip-icon">▼</span> Details</button>';
        html += '</div>';
        html += '</div>';
        
        html += '<div class="gaip-why-section gaip-collapsed" id="' + sectionId + '">';
        html += '<div class="gaip-why-content">';
        html += '<div class="gaip-recommendation">';
        html += '<span class="gaip-label">Assessment:</span>';
        html += '<p class="gaip-recommendation-text">' + classification.desc + '</p>';
        html += '</div>';
        html += '</div></div>';
        
        html += '</div>';
        
        return html;
    }

    function renderDetailedChemistry(blendResult) {
        var b = blendResult.blendedMgL;
        var m = blendResult.blendedMeq;
        var d = blendResult.derived;
        
        var sectionId = 'blend-chemistry-' + Date.now();
        
        var html = '<div class="gaip-mlsn-ratios-section" style="margin-top: 16px;">';
        html += '<div class="gaip-section-header">';
        html += '<h4>Detailed Blended Chemistry</h4>';
        html += '<button class="gaip-expand-btn" data-target="' + sectionId + '">';
        html += '<span class="gaip-icon">▼</span></button>';
        html += '</div>';
        
        html += '<div class="gaip-collapsible-content gaip-collapsed" id="' + sectionId + '">';
        html += '<div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px;">';
        
        // Cations
        html += '<div class="gaip-supply-details">';
        html += '<h5 style="margin: 0 0 8px 0; font-size: 13px;">Cations (mg/L → meq/L)</h5>';
        html += '<div class="gaip-supply-row"><span>Calcium (Ca)</span><strong>' + b.Ca.toFixed(1) + ' → ' + m.Ca.toFixed(2) + '</strong></div>';
        html += '<div class="gaip-supply-row"><span>Magnesium (Mg)</span><strong>' + b.Mg.toFixed(1) + ' → ' + m.Mg.toFixed(2) + '</strong></div>';
        html += '<div class="gaip-supply-row"><span>Sodium (Na)</span><strong>' + b.Na.toFixed(1) + ' → ' + m.Na.toFixed(2) + '</strong></div>';
        html += '<div class="gaip-supply-row"><span>Potassium (K)</span><strong>' + b.K.toFixed(1) + ' → ' + m.K.toFixed(2) + '</strong></div>';
        html += '</div>';
        
        // Anions
        html += '<div class="gaip-supply-details">';
        html += '<h5 style="margin: 0 0 8px 0; font-size: 13px;">Anions (mg/L → meq/L)</h5>';
        html += '<div class="gaip-supply-row"><span>Chloride (Cl)</span><strong>' + b.Cl.toFixed(1) + ' → ' + m.Cl.toFixed(2) + '</strong></div>';
        html += '<div class="gaip-supply-row"><span>Sulphate (SO₄)</span><strong>' + b.SO4.toFixed(1) + ' → ' + m.SO4.toFixed(2) + '</strong></div>';
        html += '<div class="gaip-supply-row"><span>Bicarbonate (HCO₃)</span><strong>' + b.HCO3.toFixed(1) + ' → ' + m.HCO3.toFixed(2) + '</strong></div>';
        html += '<div class="gaip-supply-row"><span>Carbonate (CO₃)</span><strong>' + b.CO3.toFixed(1) + ' → ' + m.CO3.toFixed(2) + '</strong></div>';
        html += '</div>';
        
        // Derived indices
        html += '<div class="gaip-supply-details">';
        html += '<h5 style="margin: 0 0 8px 0; font-size: 13px;">Derived Indices</h5>';
        html += '<div class="gaip-supply-row"><span>SAR</span><strong>' + d.SAR.toFixed(2) + '</strong></div>';
        html += '<div class="gaip-supply-row"><span>RSC</span><strong>' + d.RSC.toFixed(2) + ' meq/L</strong></div>';
        html += '<div class="gaip-supply-row"><span>pHc (saturation)</span><strong>' + d.pHc.toFixed(2) + '</strong></div>';
        html += '<div class="gaip-supply-row"><span>LSI</span><strong>' + d.LSI.toFixed(2) + '</strong></div>';
        html += '<div class="gaip-supply-row"><span>Ion balance</span><strong>' + d.ionBalance.toFixed(1) + '%</strong></div>';
        html += '</div>';
        
        // Other
        html += '<div class="gaip-supply-details">';
        html += '<h5 style="margin: 0 0 8px 0; font-size: 13px;">Other Parameters</h5>';
        html += '<div class="gaip-supply-row"><span>Boron (B)</span><strong>' + b.B.toFixed(2) + ' mg/L</strong></div>';
        html += '<div class="gaip-supply-row"><span>Iron (Fe)</span><strong>' + b.Fe.toFixed(2) + ' mg/L</strong></div>';
        html += '<div class="gaip-supply-row"><span>Nitrate (NO₃)</span><strong>' + b.NO3.toFixed(1) + ' mg/L</strong></div>';
        html += '<div class="gaip-supply-row"><span>Phosphate (PO₄)</span><strong>' + b.PO4.toFixed(1) + ' mg/L</strong></div>';
        html += '</div>';
        
        html += '</div></div></div>';
        
        return html;
    }

    // ========================================================================
    // CCPI (Calcium Carbonate Precipitation Index) — b35fix139
    // Equivalent to LSI for practical purposes but named distinctly to
    // reflect carbonate scaling potential at the soil/water interface.
    // Citation: Langelier (1936), Carrier (1965)
    // ========================================================================

    /**
     * Calculate CCPI = pH − pHc (identical formula to LSI, distinct label)
     */
    function calcCCPI(actualPH, pHc) {
        return safeNum(actualPH) - safeNum(pHc);
    }

    /**
     * Classify CCPI for carbonate scaling potential
     */
    function classifyCCPI(ccpi) {
        ccpi = safeNum(ccpi);
        if (ccpi > 0.5)  return { class: 'status-deficient',  label: 'High Scaling',    desc: 'Strong CaCO₃ precipitation expected — irrigation heads, emitters, and soil pores at risk. Acidification required.' };
        if (ccpi > 0.2)  return { class: 'status-caution',    label: 'Mild Scaling',    desc: 'CaCO₃ deposition possible under drying cycles. Monitor pH drift and surface sealing.' };
        if (ccpi > -0.2) return { class: 'status-adequate',   label: 'Stable',          desc: 'Carbonate system near equilibrium. Low scaling or corrosion risk.' };
        if (ccpi > -0.5) return { class: 'status-caution',    label: 'Mild Corrosive',  desc: 'Slight CaCO₃ dissolution. Monitor for Ca depletion and pipe corrosion at low pH.' };
        return           { class: 'status-deficient',  label: 'Corrosive',       desc: 'Active CaCO₃ dissolution. Pipe and infrastructure corrosion risk. Review source chemistry.' };
    }

    // ========================================================================
    // BRUTE-FORCE BLEND OPTIMISER — b35fix139
    // Searches blend fractions in 5% steps for 2-source blends,
    // 10% steps for 3-source blends, returning the highest fraction of
    // the primary source that satisfies all safety thresholds.
    // Extracted and adapted from gaip-blend v1.0 (Gilba Solutions)
    // ========================================================================

    // Safe thresholds — aligned with Ayers & Westcot (1985) and hub classifications
    var OPTIMISER_SAFE = {
        EC_max:   1.5,   // dS/m — moderate salinity upper limit
        SAR_max:  6.0,   // basic SAR
        SARadj_max: 8.0, // Suarez-adjusted SAR
        RSC_min:  -2.0,  // meq/L — corrosive lower limit
        RSC_max:   1.25, // meq/L — high bicarbonate threshold
        LSI_min:  -0.5,
        LSI_max:   0.5
    };

    /**
     * Test whether a blend result falls within all safety thresholds
     */
    function isBlendSafe(blendResult) {
        var b = blendResult.blendedMgL;
        var d = blendResult.derived;
        if (b.EC_dSm       >  OPTIMISER_SAFE.EC_max)    return false;
        if (d.SAR          >  OPTIMISER_SAFE.SAR_max)   return false;
        if (d.SARadj       >  OPTIMISER_SAFE.SARadj_max) return false;
        if (d.RSC          <  OPTIMISER_SAFE.RSC_min)   return false;
        if (d.RSC          >  OPTIMISER_SAFE.RSC_max)   return false;
        if (d.LSI          <  OPTIMISER_SAFE.LSI_min)   return false;
        if (d.LSI          >  OPTIMISER_SAFE.LSI_max)   return false;
        return true;
    }

    /**
     * findOptimalBlend(sources, options)
     *
     * sources: array of source objects (same format as computeBlend)
     * options: {
     *   steps: 20,          // number of steps per axis (default 20 = 5% increments)
     *   primaryIndex: 0,    // index of source to maximise (default: source with lowest EC×SAR)
     *   safe: {}            // override OPTIMISER_SAFE thresholds
     * }
     *
     * Returns: {
     *   found: true/false,
     *   fractions: [0.6, 0.4],
     *   fractionsPercent: ['60%', '40%'],
     *   result: blendResult,
     *   primaryIndex: 0,
     *   message: 'human-readable summary'
     * }
     */
    function findOptimalBlend(sources, options) {
        if (!Array.isArray(sources) || sources.length < 2) {
            return { found: false, message: 'At least two sources required for optimisation.' };
        }
        if (sources.length > 3) {
            return { found: false, message: 'Optimiser supports 2–3 sources.' };
        }

        options = options || {};
        var steps = options.steps || 20;
        var safe = options.safe || {};
        // Allow threshold overrides
        var savedSafe = OPTIMISER_SAFE;
        if (Object.keys(safe).length > 0) {
            OPTIMISER_SAFE = Object.assign({}, OPTIMISER_SAFE, safe);
        }

        // Determine primary source (maximise its fraction) — lowest EC×SAR unless overridden
        var primaryIdx = typeof options.primaryIndex === 'number' ? options.primaryIndex : -1;
        if (primaryIdx < 0) {
            var bestScore = Infinity;
            for (var s = 0; s < sources.length; s++) {
                var src = sources[s];
                var sCa = toMeq(safeNum(src.Ca), 'Ca');
                var sMg = toMeq(safeNum(src.Mg), 'Mg');
                var sNa = toMeq(safeNum(src.Na), 'Na');
                var sSAR = calcSAR(sCa, sMg, sNa);
                var sEC = safeNum(src.EC_dSm);
                var score = sEC * Math.max(sSAR, 0.1);
                if (score < bestScore && sEC > 0) {
                    bestScore = score;
                    primaryIdx = s;
                }
            }
            if (primaryIdx < 0) primaryIdx = 0;
        }

        var best = null;

        if (sources.length === 2) {
            // Scan from 100% primary down to 0% in step increments
            var other = primaryIdx === 0 ? 1 : 0;
            for (var step = steps; step >= 0; step--) {
                var fPrimary = step / steps;
                var fOther = 1 - fPrimary;
                var fx2 = primaryIdx === 0 ? [fPrimary, fOther] : [fOther, fPrimary];
                var res2 = computeBlend(sources, fx2);
                if (isBlendSafe(res2)) {
                    best = { fractions: fx2, result: res2 };
                    break;
                }
            }
        } else {
            // 3-source: coarse 10% grid, maximise primary fraction
            var coarseSteps = 10;
            var bestPrimaryFrac = -1;
            for (var i = coarseSteps; i >= 0; i--) {
                var fA = i / coarseSteps;
                for (var j = coarseSteps - i; j >= 0; j--) {
                    var fB = j / coarseSteps;
                    var fC = 1 - fA - fB;
                    if (fC < -0.001) continue;
                    fC = Math.max(0, fC);

                    var fracs3;
                    if (primaryIdx === 0)      fracs3 = [fA, fB, fC];
                    else if (primaryIdx === 1) fracs3 = [fB, fA, fC];
                    else                       fracs3 = [fB, fC, fA];

                    var res3 = computeBlend(sources, fracs3);
                    var primaryFrac = fracs3[primaryIdx];
                    if (isBlendSafe(res3) && primaryFrac > bestPrimaryFrac) {
                        bestPrimaryFrac = primaryFrac;
                        best = { fractions: fracs3, result: res3 };
                    }
                }
            }
        }

        // Restore safe thresholds if overridden
        OPTIMISER_SAFE = savedSafe;

        if (!best) {
            return {
                found: false,
                primaryIndex: primaryIdx,
                message: 'No safe blend found under current thresholds. Consider additional treatment or dilution source.'
            };
        }

        var pctStrings = best.fractions.map(function(f) {
            return Math.round(f * 100) + '%';
        });

        var primaryLabel = sources[primaryIdx].label || ('Source ' + (primaryIdx + 1));
        var b = best.result.blendedMgL;
        var d = best.result.derived;

        var message = 'Optimal blend: ' + pctStrings.join(' / ') +
            ' — EC ' + safeNum(b.EC_dSm).toFixed(2) + ' dS/m, SAR ' + safeNum(d.SAR).toFixed(1) +
            ', RSC ' + safeNum(d.RSC).toFixed(2) + ' meq/L, LSI ' + safeNum(d.LSI).toFixed(2) + '.' +
            ' Maximises ' + primaryLabel + ' (lowest EC×SAR).';

        return {
            found: true,
            fractions: best.fractions,
            fractionsPercent: pctStrings,
            result: best.result,
            primaryIndex: primaryIdx,
            primaryLabel: primaryLabel,
            message: message
        };
    }

    /**
     * Render optimiser result as hub-styled HTML
     */
    function renderOptimiserResult(optimiserResult, sources) {
        if (!optimiserResult.found) {
            return '<div class="gaip-guidance gaip-alert" style="margin-top:12px;">' +
                '<strong>Optimiser:</strong> ' + optimiserResult.message + '</div>';
        }

        var b = optimiserResult.result.blendedMgL;
        var d = optimiserResult.result.derived;
        var pcts = optimiserResult.fractionsPercent;

        var html = '<div class="gaip-guidance gaip-info" style="margin-top:12px;">';
        html += '<strong>Recommended blend:</strong> ';

        for (var i = 0; i < pcts.length; i++) {
            var label = (sources && sources[i] && sources[i].label) ? sources[i].label : ('Source ' + (i + 1));
            html += '<strong>' + pcts[i] + '</strong> ' + label;
            if (i < pcts.length - 1) html += ' + ';
        }

        html += '<br><span style="font-size:12px;color:var(--gaip-text-secondary);">' +
            'EC ' + safeNum(b.EC_dSm).toFixed(2) + ' dS/m · ' +
            'SAR ' + safeNum(d.SAR).toFixed(1) + ' · ' +
            'RSC ' + safeNum(d.RSC).toFixed(2) + ' meq/L · ' +
            'LSI ' + safeNum(d.LSI).toFixed(2) +
            '</span></div>';

        return html;
    }

    /**
     * Render blend ratio optimisation suggestions
     */
    function renderOptimisationSuggestions(sources, currentBlend) {
        if (sources.length < 2) {
            return '';
        }
        
        // Find the "best" source (lowest EC × SAR product typically)
        var bestIdx = 0;
        var bestScore = Infinity;
        
        for (var i = 0; i < sources.length; i++) {
            var src = sources[i];
            var srcCa = toMeq(src.Ca, 'Ca');
            var srcMg = toMeq(src.Mg, 'Mg');
            var srcNa = toMeq(src.Na, 'Na');
            var srcSAR = calcSAR(srcCa, srcMg, srcNa);
            var srcEC = safeNum(src.EC_dSm);
            var score = srcEC * srcSAR;
            
            if (score < bestScore && srcEC > 0) {
                bestScore = score;
                bestIdx = i;
            }
        }
        
        var currentClass = currentBlend.classifications;
        var suggestions = [];
        
        // If infiltration is at risk, suggest increasing best source
        if (currentClass.infiltration.class === 'status-deficient') {
            suggestions.push({
                type: 'infiltration',
                text: 'Increase proportion of ' + (sources[bestIdx].label || 'Source ' + (bestIdx + 1)) + ' to reduce infiltration risk.',
                priority: 'high'
            });
        }
        
        // If salinity is high, suggest dilution with low-EC source
        if (currentClass.salinity.class === 'status-deficient') {
            var lowestEC = { idx: 0, ec: Infinity };
            for (var j = 0; j < sources.length; j++) {
                if (safeNum(sources[j].EC_dSm) < lowestEC.ec) {
                    lowestEC = { idx: j, ec: safeNum(sources[j].EC_dSm) };
                }
            }
            if (lowestEC.ec < currentBlend.blendedMgL.EC_dSm * 0.8) {
                suggestions.push({
                    type: 'salinity',
                    text: 'Increase ' + (sources[lowestEC.idx].label || 'Source ' + (lowestEC.idx + 1)) + ' (EC ' + lowestEC.ec.toFixed(2) + ') to reduce blended salinity.',
                    priority: 'high'
                });
            }
        }
        
        if (suggestions.length === 0) {
            return '';
        }
        
        var html = '<div class="gaip-guidance gaip-caution" style="margin-top: 12px;">';
        html += '<strong>Optimisation suggestions:</strong><ul style="margin: 8px 0 0 0; padding-left: 20px;">';
        for (var k = 0; k < suggestions.length; k++) {
            html += '<li>' + suggestions[k].text + '</li>';
        }
        html += '</ul></div>';
        
        return html;
    }

    // ========================================================================
    // EXPORTS
    // ========================================================================

    var WaterBlender = {
        version: BLEND_CONFIG.version,
        
        // Main computation
        computeBlend: computeBlend,
        
        // Hub integration
        toHubWaterState: toHubWaterState,
        sourcesFromUI: sourcesFromUI,
        
        // Individual calculations (for external use)
        calcSAR: calcSAR,
        calcRSC: calcRSC,
        calcPHc: calcPHc,
        calcLSI: calcLSI,
        toMeq: toMeq,
        toMgL: toMgL,
        
        // Classifications
        classifySalinity: classifySalinity,
        classifySodicity: classifySodicity,
        classifyInfiltration: classifyInfiltration,
        classifyBicarbonate: classifyBicarbonate,
        classifyLSI: classifyLSI,
        
        // Optimiser
        findOptimalBlend: findOptimalBlend,
        isBlendSafe: isBlendSafe,
        renderOptimiserResult: renderOptimiserResult,

        // CCPI
        calcCCPI: calcCCPI,
        classifyCCPI: classifyCCPI,

        // UI rendering
        renderBlenderResults: renderBlenderResults,
        renderOptimisationSuggestions: renderOptimisationSuggestions,
        
        // Config access
        config: BLEND_CONFIG
    };

    // Export
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = WaterBlender;
    }
    
    global.GAIP_WaterBlender = WaterBlender;
    global.gaip_water_blend = computeBlend;

})(typeof window !== 'undefined' ? window : this);
