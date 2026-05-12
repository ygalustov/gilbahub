/**
 * ============================================================================
 * COTULA BOWLING GREEN MODULE v1.0.0
 * ============================================================================
 *
 * Soil interpretation and agronomic context for Cotula (Leptinella dioica /
 * L. maniototo) bowling greens in New Zealand.
 *
 * KEY FACTS:
 *   - Cotula is a dicot (Asteraceae), NOT a grass. MLSN does not apply.
 *   - Reference: Hill Labs NZ "TURF Cotula (S78)" interpretation ranges.
 *     Extractants: Olsen P + NH₄OAc (pH 8.1). Reported as %BS and me/100g.
 *   - No published MLSN, NTEP, or tissue-N-ratio data exists for cotula.
 *   - N program is empirical, based on NZSTI practitioner guidance.
 *   - This module is NZ-ONLY. isNewZealand() guard is enforced on init.
 *
 * SOIL INTERPRETATION UNITS (Hill Labs S78):
 *   pH          — pH units
 *   Olsen P     — mg/L
 *   K, Ca, Mg,
 *   Na, CEC     — me/100g  (primary) and %BS (display)
 *   K/Mg ratio  — dimensionless
 *   Vol weight  — g/mL
 *   Total BS    — %
 *
 * SOURCES:
 *   Hill Laboratories Ltd, Hamilton NZ — S78 Turf Cotula interpretation ranges.
 *   Evans, P.S. (1984). The use of cotula for bowling greens in New Zealand.
 *     Journal of the Sports Turf Research Institute 60: 37-44.
 *   Hickey, M.J. et al. (1997). Selection of 'Grasslands Pahia' cotula.
 *     NZ Journal of Agricultural Research 40(3): 379-381.
 *   NZSTI Bowls Chemical Guide 2021-2022 (disease/chemical reference).
 *   Beehag, Walker, Wong & Kaapro 2024. Biology and Integrated Management of
 *     Turfgrass Diseases. CABI Wallingford. ISBN 9781789246216. Ch 8 p 215-226
 *     + Table 8.1 (cotula diseases), consolidates the NZSTI 2008, Christensen
 *     1989, Howard 2012, Ormsby & Howard 2021, and Ormsby 1990 source chain
 *     into a single peer-reviewed reference for cotula disease coverage.
 *     Cited by b35fix457 (C62) disease register, closes CABI audit
 *     recommendation #8 items (a)/(b)/(c). Item (d) host-class engine gate is
 *     logged separately for follow-on build.
 *   Erwin, D.C. & Ribeiro, O.K. 1996. Phytophthora Diseases Worldwide. APS
 *     Press, St. Paul MN. (Phytophthora cryptogea cardinal temperatures, cited
 *     by CABI Ch 8 p 220.)
 *
 * @author Gilba Solutions
 * @version 1.1.0
 * @nz-only true
 */

(function (global) {
    'use strict';

    // =========================================================================
    // HILL LABS S78 RANGES — TURF COTULA
    // Source: RJ Hill Laboratories Ltd, Hamilton NZ. Sample type code S78.
    // These are the "medium range" (optimal) bands from the S78 interpretation.
    // =========================================================================

    const COTULA_S78_RANGES = {

        // pH — 1:2 soil:water slurry, potentiometric
        pH: {
            unit: 'pH units',
            extractant: '1:2 soil:water',
            medium: [5.8, 6.5],
            low_threshold: 5.8,
            high_threshold: 6.5,
            note: 'Optimal 5.8–6.5. Below 5.5 risks Al/Mn toxicity in cotula roots.'
        },

        // Olsen P — sodium bicarbonate extraction
        P_olsen: {
            unit: 'mg/L',
            extractant: 'Olsen (NaHCO₃)',
            medium: [20, 30],
            low_threshold: 20,
            high_threshold: 30,
            note: 'Olsen P ≥30 mg/L is high. Values >80 indicate legacy P accumulation.'
        },

        // Potassium — NH₄OAc (pH 8.1), expressed as %BS
        K_pct_bs: {
            unit: '%BS',
            extractant: 'NH₄OAc (pH 8.1)',
            medium: [3.0, 6.0],
            low_threshold: 3.0,
            high_threshold: 6.0,
            note: 'K at lower end of range risks Mg dominance (see K/Mg ratio).'
        },

        // Potassium — me/100g
        K_me: {
            unit: 'me/100g',
            extractant: 'NH₄OAc (pH 8.1)',
            // Calculated from %BS × CEC / 100. Provided for reference/display.
            note: 'K me/100g: derived from K%BS × CEC.'
        },

        // Calcium — %BS
        Ca_pct_bs: {
            unit: '%BS',
            extractant: 'NH₄OAc (pH 8.1)',
            medium: [45, 75],
            low_threshold: 45,
            high_threshold: 75,
            note: 'Ca dominates the exchange complex on most NZ bowling green soils.'
        },

        // Magnesium — %BS
        Mg_pct_bs: {
            unit: '%BS',
            extractant: 'NH₄OAc (pH 8.1)',
            medium: [5.0, 15.0],
            low_threshold: 5.0,
            high_threshold: 15.0,
            note: 'High Mg relative to K suppresses K uptake even when K is sufficient.'
        },

        // Sodium — %BS
        Na_pct_bs: {
            unit: '%BS',
            extractant: 'NH₄OAc (pH 8.1)',
            medium: [0, 5.0],
            low_threshold: 0,
            high_threshold: 5.0,
            note: 'Na >5% risks dispersion of soil aggregates and reduced drainage.'
        },

        // CEC — summation of extractable cations
        CEC: {
            unit: 'me/100g',
            extractant: 'Summation (K+Ca+Mg+Na + extractable acidity)',
            medium: [12, 25],
            low_threshold: 12,
            high_threshold: 25,
            note: 'CEC 12–25 me/100g typical for NZ sedimentary bowling green soils.'
        },

        // Total Base Saturation
        TBS: {
            unit: '%',
            medium: [40, 80],
            low_threshold: 40,
            high_threshold: 80,
            note: 'TBS <40% indicates acidity and extractable aluminium risk.'
        },

        // Volume weight (bulk density proxy)
        VW: {
            unit: 'g/mL',
            medium: [0.60, 1.00],
            low_threshold: 0.60,
            high_threshold: 1.00,
            note: 'VW >1.0 g/mL may indicate surface compaction.'
        },

        // K/Mg ratio — dimensionless
        K_Mg_ratio: {
            unit: null,
            medium: [0.3, 1.0],
            low_threshold: 0.3,
            high_threshold: 1.0,
            note: 'K/Mg <0.3 indicates Mg dominance suppressing K uptake. Priority correction.'
        }
    };

    // =========================================================================
    // INTERPRETATION ENGINE
    // =========================================================================

    /**
     * Interpret a single S78 parameter.
     * @param {string} param   - Key from COTULA_S78_RANGES
     * @param {number} value   - Measured value
     * @returns {object}       - Interpretation result
     */
    function interpretS78Value(param, value) {
        const config = COTULA_S78_RANGES[param];
        if (!config || value === null || value === undefined || isNaN(value)) {
            return { param, value, status: 'NO DATA', statusClass: 'status-no-data' };
        }

        const { low_threshold, high_threshold, medium, unit, note } = config;
        let status, statusClass, recommendation;

        if (low_threshold === 0 && value >= 0 && value <= high_threshold) {
            // Na and TBS (lower is OK, upper limit matters)
            status = value > high_threshold ? 'HIGH' : 'SUFFICIENT';
        } else if (value < low_threshold) {
            status = 'LOW';
        } else if (value > high_threshold) {
            status = 'HIGH';
        } else {
            status = 'SUFFICIENT';
        }

        // Special override for Na — anything within 0–5 is fine
        if (param === 'Na_pct_bs') {
            status = value > 5.0 ? 'HIGH' : 'SUFFICIENT';
        }

        switch (status) {
            case 'LOW':
                statusClass = 'status-deficient';
                recommendation = _lowRec(param, value);
                break;
            case 'HIGH':
                statusClass = 'status-high';
                recommendation = _highRec(param, value);
                break;
            default:
                statusClass = 'status-adequate';
                recommendation = 'Within Hill Labs S78 optimal range. Maintenance only.';
        }

        return {
            param,
            value,
            unit: unit || '',
            status,
            statusClass,
            rangeMin: medium ? medium[0] : low_threshold,
            rangeMax: medium ? medium[1] : high_threshold,
            rangeDisplay: medium ? `${medium[0]}–${medium[1]}` : `≤${high_threshold}`,
            recommendation,
            note,
            methodology: 'cotula_s78',
            source: 'Hill Labs NZ S78'
        };
    }

    /**
     * Interpret a full set of S78 values from a soil test.
     * Accepts the Hill Labs data object shape produced by lab-report-parser.js
     * or entered manually into GAIP_STATE.soil.
     *
     * @param {object} soilData - { pH, P_olsen, K_pct_bs, K_me, Ca_pct_bs,
     *                              Mg_pct_bs, Na_pct_bs, CEC, TBS, VW, K_Mg_ratio }
     * @returns {object}        - Full interpretation result
     */
    function interpretCotulaSoilTest(soilData) {
        const params = [
            'pH', 'P_olsen', 'K_pct_bs', 'Ca_pct_bs', 'Mg_pct_bs',
            'Na_pct_bs', 'CEC', 'TBS', 'VW', 'K_Mg_ratio'
        ];

        const results = {};
        const flags = [];

        params.forEach(param => {
            const val = _extractValue(soilData, param);
            if (val !== null) {
                const r = interpretS78Value(param, val);
                results[param] = r;
                if (r.status === 'LOW' || r.status === 'HIGH') {
                    flags.push({ param, status: r.status, value: val, priority: _priority(param) });
                }
            }
        });

        // Sort flags by agronomic priority
        flags.sort((a, b) => a.priority - b.priority);

        // K/Mg antagonism alert — always evaluate even if individual params are "OK"
        const kMg = results['K_Mg_ratio'];
        const kBs  = results['K_pct_bs'];
        const mgBs = results['Mg_pct_bs'];
        let antagonismAlert = null;

        if (kMg && kMg.value < 0.35 && kBs && mgBs) {
            antagonismAlert = {
                type: 'K_MG_ANTAGONISM',
                severity: kMg.value < 0.25 ? 'high' : 'moderate',
                message: `K/Mg ratio ${kMg.value.toFixed(2)} is below 0.3. ` +
                         `Mg at ${mgBs.value}% BS is suppressing K uptake even if soil K appears adequate. ` +
                         `Prioritise soluble K application before next play season.`
            };
        }

        return {
            methodology: 'cotula_s78',
            methodologyLabel: 'Hill Labs S78, Turf Cotula',
            surfaceType: 'cotula_bowling_green',
            extractants: { P: 'Olsen (NaHCO₃)', cations: 'NH₄OAc (pH 8.1)' },
            source: 'RJ Hill Laboratories Ltd, S78 Turf Cotula ranges',
            nzOnly: true,
            results,
            flags,
            antagonismAlert,
            context: {
                methodology: 'cotula_s78',
                dataSource: 'Hill Labs NZ S78',
                note: 'MLSN does not apply to cotula (Asteraceae). ' +
                      'Interpretation uses Hill Labs S78 sufficiency ranges calibrated for NZ cotula bowling greens.'
            }
        };
    }

    // =========================================================================
    // N PROGRAM — EMPIRICAL FRAMEWORK
    // No published GP curve exists for Leptinella. This model uses a
    // temperature-bounded activity window (cotula growth slows below 8°C and
    // above ~24°C) with practitioner-derived annual N rate benchmarks.
    //
    // Reference basis:
    //   Evans (1984) notes cotula responds to light N applications.
    //   NZSTI natural bowling green guide (practitioner consensus).
    //   Gilba agronomic calibration (this represents a conservative baseline).
    //
    // Units: kg N/ha/year applied, split across active growth months.
    // =========================================================================

    const COTULA_N_BENCHMARKS = {
        // Annual N rate benchmarks (kg N/ha/year)
        // These are APPLIED rates, not uptake estimates.
        // Cotula is low-input relative to grass greens.
        annual_n: {
            conservative: 50,   // Minimum maintenance (older/established greens)
            moderate:     80,   // Typical program for good season performance
            high:        120,   // Maximum. Excess N promotes thatch and disease.
            note: 'Empirical, no peer-reviewed N rate trial data exists for cotula bowling greens.'
        },

        // Temperature activity window (°C)
        // Growth is active between these temps; GP fraction is linear within window
        temp_window: {
            base: 8,    // Below this, cotula is dormant/very slow
            optimal: 16, // Peak relative growth
            ceiling: 24, // Above this, growth slows markedly in NZ conditions
        },

        // Monthly split guidance
        // Avoid N applications during dormancy (< base temp) or peak summer heat
        season_split: {
            // Southern Hemisphere months active (NZ)
            // Sept–April is the main window; June–August is largely dormant
            active_months_sh: [9, 10, 11, 12, 1, 2, 3, 4], // Sep–Apr
            dormant_months_sh: [6, 7, 8],                   // Jun–Aug
            transition_months_sh: [5, 9],                   // May, Sep — light apps only
        }
    };

    /**
     * Calculate cotula growth activity fraction (0–1) from temperature.
     * This replaces the standard C3/C4 PACE Turf GP for this surface type.
     *
     * @param {number} avgTempC - Average temperature (°C)
     * @returns {number}        - Activity fraction 0–1
     */
    function calcCotulActivityFraction(avgTempC) {
        const { base, optimal, ceiling } = COTULA_N_BENCHMARKS.temp_window;
        if (avgTempC <= base) return 0;
        if (avgTempC >= ceiling) return Math.max(0, 1 - (avgTempC - ceiling) / 8);
        if (avgTempC <= optimal) {
            return (avgTempC - base) / (optimal - base);
        }
        // Between optimal and ceiling: plateau then slight decline
        return 1 - 0.3 * ((avgTempC - optimal) / (ceiling - optimal));
    }

    /**
     * Calculate monthly N rate for cotula from temperature and program level.
     *
     * @param {number} avgTempC   - Monthly average temperature (°C)
     * @param {string} level      - 'conservative' | 'moderate' | 'high'
     * @param {number} month      - Calendar month (1=Jan … 12=Dec)
     * @param {boolean} isSH      - True for Southern Hemisphere (NZ)
     * @returns {object}          - { nRate (kg/ha), activity, canApply, note }
     */
    function calcCotulaMonthlyN(avgTempC, level = 'moderate', month = null, isSH = true) {
        const benchmarks = COTULA_N_BENCHMARKS.annual_n;
        const annualN = benchmarks[level] || benchmarks.moderate;
        const activity = calcCotulActivityFraction(avgTempC);

        // Check dormancy window
        let canApply = true;
        let note = '';

        if (month !== null && isSH) {
            const dom = COTULA_N_BENCHMARKS.season_split.dormant_months_sh;
            const trans = COTULA_N_BENCHMARKS.season_split.transition_months_sh;
            if (dom.includes(month)) {
                canApply = false;
                note = 'Dormant period, withhold N. Risk of Sclerotinia minor increases with winter N.';
            } else if (trans.includes(month)) {
                note = 'Transition month, apply N at half rate only if growth is active.';
            }
        }

        // Distribute annual N across activity months proportionally
        // 8 active months in a typical NZ season
        const activeMonths = 8;
        const baseMonthlyN = annualN / activeMonths;
        const activityAdjusted = baseMonthlyN * Math.max(0.1, activity);

        return {
            nRate: canApply ? parseFloat(activityAdjusted.toFixed(1)) : 0,
            nRateUnadjusted: parseFloat(baseMonthlyN.toFixed(1)),
            activity: parseFloat(activity.toFixed(3)),
            annualBenchmark: annualN,
            level,
            canApply,
            note: note || (activity < 0.2 ? 'Low activity, apply N only if actively growing.' : ''),
            methodology: 'cotula_empirical',
            caveat: COTULA_N_BENCHMARKS.annual_n.note
        };
    }

    // =========================================================================
    // SURFACE TYPE REGISTRATION
    // Registers cotula_bowling_green as a named surface for the hub's
    // surface type selector and downstream context routing.
    // =========================================================================

    const COTULA_SURFACE_CONFIG = {
        key: 'cotula_bowling_green',
        label: 'Cotula Bowling Green',
        shortLabel: 'Cotula',
        nzOnly: true,
        turfTypeGroup: 'bowls',
        species: 'cotula',
        speciesKey: 'cotula',
        speciesLabel: 'Cotula (Leptinella)',
        varieties: [
            { key: 'grasslands_pahia', label: "Grasslands Pahia (L. dioica)" },
            { key: 'maniototo',        label: "Cotula maniototo" },
            { key: 'generic_cotula',   label: "Generic / Unknown cultivar" }
        ],
        physiology: 'dicot',       // Not C3 or C4 — important for GP routing
        photosynthesis: null,      // Do NOT route through C3/C4 GP
        methodology: 'cotula_s78', // Force S78 interpretation
        defaultSoilType: 'others', // Sedimentary NZ soils
        hocRange: [3, 8],          // mm — typical cotula bowling green HOC
        defaultHoc: 5,
        sgn_max: 100,              // Granule size limit (same as grass greens)
        // =====================================================================
        // b35fix457 (C62): COTULA DISEASE REGISTER, closes CABI 2024 audit
        // recommendation #8 items (a) taxonomic conflation, (b) Phytophthora
        // misspelling, (c) coverage gap. Audit pointer at the pre-fix flag
        // array (3 entries) was carrying a misspelled key plus an inline
        // comment that suggested one pathogen caused three different diseases.
        // Replaced here with a structured register of 9 entries per Beehag,
        // Walker, Wong & Kaapro 2024 (CABI) Ch 8 Table 8.1, the canonical
        // consolidation of the NZSTI 2008, Christensen 1989, Howard 2012,
        // Ormsby & Howard 2021, Ormsby 1990, and Erwin & Ribeiro 1996 source
        // chain. Each entry self-documents pathogen + CABI page pin +
        // qualitative epidemiology so the future host-class engine gate
        // (logged as adjacent C-entry; item (d) of audit rec #8) can read
        // pathogen-level metadata without re-parsing this file.
        //
        // CABI Ch 8 p 215-226 explicitly states that none of the nine
        // cotula diseases have peer-reviewed quantitative epidemiology models
        // that would meet the hub's Tier 2 standard; the register is a
        // reference list, NOT a risk-engine input. Rolf's disease and
        // Phytophthora root rot carry the only published quantitative
        // thresholds (single-band, qualitative) and are noted in their
        // entries below. Gold bracelet's causal agent identity is unknown
        // per CABI p 218 and predictive management remains problematic.
        //
        // Item (d) host-class gate (skip the grass disease model list and
        // emit a structured Cotula reference-register output when
        // siteSettings.turfType === 'bowls' AND region === 'NZ') is out of
        // scope for this single-purpose build; the engine currently routes
        // unknown species through SPECIES_SUSCEPTIBILITY.perennialRyegrass
        // at assets/disease-engine-pure.js, which silently scores cotula
        // bowling greens under a grass-pathogen profile. Logged as adjacent
        // C-entry for separate Tier B / SaaS-port-coordinated close.
        // =====================================================================
        diseaseRegister: [
            {
                key: 'alternaria_leaf_spot',
                displayName: 'Alternaria leaf spot',
                pathogen: 'Alternaria sp.',
                cabiPagePin: 'Ch 8 Table 8.1',
                qualitativeNote: 'Leaf spotting on cotula; no quantitative epidemiology.',
                source: 'Beehag/Walker/Wong/Kaapro 2024 CABI Ch 8 Table 8.1; NZSTI 2008'
            },
            {
                key: 'brown_patch',
                displayName: 'Brown patch',
                pathogen: 'Rhizoctonia solani',
                cabiPagePin: 'Ch 8 Table 8.1',
                qualitativeNote: 'Same R. solani genus as the grass-host disease, but Fidanza 1996 E2 regression is calibrated for perennial ryegrass, not cotula; no cotula-specific quantitative model.',
                source: 'Beehag/Walker/Wong/Kaapro 2024 CABI Ch 8 Table 8.1; NZSTI 2008'
            },
            {
                key: 'fairy_ring',
                displayName: 'Fairy ring',
                pathogen: 'various basidiomycetes',
                cabiPagePin: 'Ch 8 Table 8.1',
                qualitativeNote: 'Multiple basidiomycete causal agents; no quantitative epidemiology.',
                source: 'Beehag/Walker/Wong/Kaapro 2024 CABI Ch 8 Table 8.1; NZSTI 2008'
            },
            {
                key: 'gold_bracelet',
                displayName: 'Gold bracelet',
                pathogen: 'Rhizoctonia sp. (causal agent identity unknown)',
                cabiPagePin: 'Ch 8 p 218',
                qualitativeNote: 'CABI states predictive management remains problematic; causal agent identity unknown. Distinct from Rolf\u0027s disease and Sclerotinia patch despite historical conflation in field guides.',
                source: 'Beehag/Walker/Wong/Kaapro 2024 CABI Ch 8 p 218; Howard 2012'
            },
            {
                key: 'phytophthora_root_rot',
                displayName: 'Phytophthora root rot',
                pathogen: 'Phytophthora cryptogea',
                cabiPagePin: 'Ch 8 p 220',
                qualitativeNote: 'Cardinal temperatures per Erwin & Ribeiro 1996: optimum 22-25 deg C, range below 1 deg C to 31-33 deg C. No validated cotula-specific predictive model.',
                source: 'Beehag/Walker/Wong/Kaapro 2024 CABI Ch 8 p 220; Erwin & Ribeiro 1996'
            },
            {
                key: 'rolfs_disease',
                displayName: 'Rolf\u0027s disease (southern blight)',
                pathogen: 'Athelia rolfsii (formerly Sclerotium rolfsii)',
                cabiPagePin: 'Ch 8 p 221',
                qualitativeNote: 'Warm-season disease, single threshold above 25 deg C between December and March per Ormsby 1990 and Howard 2012.',
                source: 'Beehag/Walker/Wong/Kaapro 2024 CABI Ch 8 p 221; Ormsby 1990; Howard 2012'
            },
            {
                key: 'sclerotinia_patch',
                displayName: 'Sclerotinia patch',
                pathogen: 'Sclerotinia minor',
                cabiPagePin: 'Ch 8 p 222',
                qualitativeNote: 'CABI identifies as the most widespread and common fungal disease on mixed-cotula bowling greens. Favoured by lush growth and leaf wetness above 12 h. Observational, not quantitatively validated.',
                source: 'Beehag/Walker/Wong/Kaapro 2024 CABI Ch 8 p 222; NZSTI 2008'
            },
            {
                key: 'winter_pythium_patch',
                displayName: 'Winter Pythium patch',
                pathogen: 'Pythium sp.',
                cabiPagePin: 'Ch 8 Table 8.1',
                qualitativeNote: 'Cool-weather Pythium variant on cotula; no quantitative epidemiology. Distinct from the grass-host Pythium blight covered by PythiumModel.',
                source: 'Beehag/Walker/Wong/Kaapro 2024 CABI Ch 8 Table 8.1; Ormsby & Howard 2021'
            },
            {
                key: 'white_patch',
                displayName: 'White patch',
                pathogen: 'unknown',
                cabiPagePin: 'Ch 8 Table 8.1',
                qualitativeNote: 'Causal agent unknown; no quantitative epidemiology.',
                source: 'Beehag/Walker/Wong/Kaapro 2024 CABI Ch 8 Table 8.1; Christensen 1989'
            }
        ],
        // Nitrogen program
        nProgram: {
            model: 'cotula_empirical',
            annualRange: [50, 120],
            defaultLevel: 'moderate',
            unit: 'kg N/ha/year'
        },
        // Soil test requirements
        soilTest: {
            methodology: 'cotula_s78',
            lab: 'Hill Labs NZ',
            sampleCode: 'S78',
            extractants: { P: 'Olsen', cations: 'NH₄OAc (pH 8.1)' },
            primaryUnits: '%BS and me/100g',
            sampleDepth_mm: 75
        },
        // Agronomic limitations
        limitations: [
            'No MLSN data, S78 ranges are the only calibrated reference.',
            'No tissue N ratio data, PACE Turf uptake model does not apply.',
            'Dicot physiology: C3/C4 GP model not valid. Uses cotula activity fraction.',
            'Disease engine limited to fungal pathogens with NZ chemical registrations.'
        ]
    };

    // =========================================================================
    // UI — TURF TYPE GRID BUTTON
    // Injects a "Bowls" option into the gaip-turf-type-grid, visible for NZ only.
    // =========================================================================

    function injectBowlsButton() {
        const grid = document.querySelector('.gaip-turf-type-grid');
        if (!grid) return;
        if (grid.querySelector('[data-type="bowls"]')) return; // already present

        // NZ guard
        if (!_isNZ()) return;

        const btn = document.createElement('div');
        btn.className = 'gaip-turf-type-option';
        btn.dataset.type = 'bowls';
        btn.innerHTML = '<h4>Bowls</h4><p>Cotula bowling green</p>';
        grid.appendChild(btn);
    }

    /**
     * Inject the bowls sub-category panel into the hub HTML.
     * Shows when user selects the Bowls turf type button.
     */
    function injectBowlsSubcategory() {
        const profileCard = document.querySelector('.gaip-turf-profile-card .gaip-card-body');
        if (!profileCard) return;
        if (document.getElementById('gaip-bowls-subcategory')) return;

        const section = document.createElement('div');
        section.className = 'gaip-subcategory-section';
        section.id = 'gaip-bowls-subcategory';
        section.style.display = 'none';
        section.innerHTML = `
            <label>Surface</label>
            <div class="gaip-subcategory-grid">
                <div class="gaip-subcategory-option gaip-subcategory-option--active"
                     data-surface="cotula_bowling_green">Cotula Green</div>
            </div>
            <div class="gaip-cotula-notice" style="
                margin-top: 8px;
                padding: 8px 10px;
                background: var(--gaip-warning-bg);
                border: 1px solid #fbbf24;
                border-radius: 6px;
                font-size: 11px;
                color: #78350f;
                line-height: 1.5;
            ">
                <strong>Cotula (Leptinella)</strong>, NZ bowling green only.<br>
                Soil interpretation uses Hill Labs S78 ranges. MLSN does not apply.<br>
                Ammonium Acetate methodology will be selected automatically.
            </div>
        `;
        // Insert after the sports subcategory section
        const sportsSection = document.getElementById('gaip-sports-subcategory');
        if (sportsSection && sportsSection.nextSibling) {
            profileCard.insertBefore(section, sportsSection.nextSibling);
        } else {
            profileCard.appendChild(section);
        }
    }

    /**
     * Handle turf type button click for 'bowls'.
     * Hides other subcategories, shows bowls panel,
     * forces Ammonium Acetate methodology, and sets species to cotula.
     */
    function handleBowlsSelection() {
        // Hide all subcategory sections
        document.querySelectorAll('.gaip-subcategory-section').forEach(s => {
            s.style.display = 'none';
        });

        // Show bowls section
        const bowlsSection = document.getElementById('gaip-bowls-subcategory');
        if (bowlsSection) bowlsSection.style.display = 'block';

        // Force Ammonium Acetate methodology
        const methodSelect = document.querySelector('.gaip-soil-methodology');
        if (methodSelect && methodSelect.value !== 'ammonium_acetate') {
            methodSelect.value = 'ammonium_acetate';
            methodSelect.dispatchEvent(new Event('change'));
        }

        // Populate species select with cotula
        _setSpeciesToCotula();

        // Update GAIP_STATE — persist cotula flag durably so gaip_build_state()
        // can read it even after TurfProfileController repopulates from location events.
        //
        // b35fix388: route writes through the hub-store setter contract. Pre-fix
        // assigned to `window.GAIP_STATE.turf.<key>` directly, which silently
        // dropped under the hub-store proxy installed in gilba-hub-v2.js (~line
        // 1393). The getter synthesises a fresh `{turf: c.peek('inputs.turf')}`
        // object on every read; mutations land on that ephemeral object and are
        // GC'd. Only the setter's `e.inputs` and `e.turf` branches route writes
        // into the actual store via `c.set('inputs.turf', val, ...)` — and the
        // setter REPLACES (not patches) `inputs.turf` wholesale. So we read
        // existing turf state first, spread it, override only the cotula keys,
        // and route the merged object back through the setter. Without the
        // merge, unrelated TurfProfileController-set state (variety, companion
        // species, etc.) would be wiped every time the bowls profile activates.
        //
        // Same fix shape as b35fix386 (which closed the equivalent bug for the
        // .soil slot in nutrition-calendar.js syncSoilFromDOM). Verified against
        // a simulated proxy mirroring the gilba-hub-v2.js getter/setter pair —
        // 4 downstream readers (turf-profile-controller.js:836, nutrition-uk-
        // fertiliser-integration.js:690, hub-tissue-v3.js:1102, site-config-
        // persistence.js:406) see the persisted cotula flags after the routed
        // write; pre-existing turf keys preserved.
        if (window.GAIP_STATE) {
            try {
                var existingTurf = (window.GAIP_STATE.inputs && window.GAIP_STATE.inputs.turf)
                    || window.GAIP_STATE.turf
                    || {};
                window.GAIP_STATE = {
                    inputs: {
                        turf: Object.assign({}, existingTurf, {
                            turfType: 'bowls',
                            surfaceType: 'cotula_bowling_green',
                            speciesKey: 'cotula',
                            grassSpecies: 'cotula',
                            physiology: 'dicot',
                            cotula: true
                        })
                    }
                };
            } catch (e) {
                console.warn('[CotulaBowling b35fix388] state writeback failed:', e && e.message);
            }
        }

        // Tell TurfProfileController that turfType is 'bowls' via its proper
        // selectTurfType() method — this updates internal state AND triggers
        // dispatchStateChange() so SiteConfig snapshots 'bowls', not 'lawns'.
        // Pre-set state.species so updateSpeciesOptions() guard fires immediately.
        const tpc = window.GaipTurfProfile || window.GAIP_TurfProfileController;
        if (tpc) {
            tpc.state = tpc.state || {};
            tpc.state.species = 'cotula'; // guard fires before updateSpeciesOptions runs
            if (typeof tpc.selectTurfType === 'function') {
                tpc.selectTurfType('bowls');
            } else {
                tpc.state.turfType = 'bowls';
            }
        }

        // Fire profile change event so downstream modules update
        document.dispatchEvent(new CustomEvent('gaip:turf-profile-change', {
            detail: {
                turfType: 'bowls',
                surfaceType: 'cotula_bowling_green',
                species: 'cotula',
                methodology: 'cotula_s78'
            }
        }));

        console.log('[CotulaBowling] Bowls profile activated, S78 interpretation, AA methodology.');
    }

    // =========================================================================
    // CLEAR BOWLS STATE — b35fix394
    //
    // Inverse of handleBowlsSelection. Removes the six cotula identity keys
    // from inputs.turf so that downstream readers (turf-profile-controller.js:836,
    // nutrition-uk-fertiliser-integration.js:690, hub-tissue-v3.js:1102, the
    // b35fix365 species-resolution probe, and word-export collectData) no longer
    // see cotula state on a site that isn't a cotula bowling green.
    //
    // BUG WITHOUT THIS FUNCTION (production-confirmed 2026-04-29 from Canturf
    // combined-export log + report):
    //   1. User activates X Cotula BC → handleBowlsSelection routes 6 cotula
    //      keys into inputs.turf (b35fix388 fix shape).
    //   2. User switches to Canturf (Fyshwick, Australia, tall fescue site).
    //      site-config-persistence.js:402-410 calls tp.selectTurfType('sports')
    //      and updates DOM, but inputs.turf still carries cotula:true,
    //      speciesKey:cotula, surfaceType:cotula_bowling_green, etc.
    //   3. b35fix391's hub-tissue:6952 merge preserves fresh inputs.turf over
    //      the run-snapshot t.turf — which is the correct fix for the bowls
    //      analysis-end clobber, but means stale cotula keys also survive
    //      the post-analysis writeback.
    //   4. Combined export collectData reads inputs.turf, sees cotula keys,
    //      report renders Turf Type:bowls, Species:cotula on every Canturf
    //      sample. Tissue advice falls back to cotula sufficiency thresholds
    //      for tall fescue tissue analysis — wrong.
    //
    // Production probe evidence (gilbasolutions_com-1777429985062.log line 49):
    //   GAIP_STATE_turf_grassSpecies: "cotula"  ← stale from previous site
    //   SC_getBaseSpecies: "tallFescue"          ← TPC.state correctly carries
    //                                              the new site's species
    //
    // FIX: route a write that strips the six cotula keys and explicitly nulls
    // them so the merge in hub-tissue:6952 (which uses Object.assign with fresh
    // inputs.turf as last arg) overrides any t.turf snapshot that carries the
    // cotula keys. The merge contract requires explicit undefined or null —
    // simply omitting the keys would leave them in t.turf and the merge would
    // surface them. So we set the six keys to explicit defaults that clear them.
    //
    // Set at non-bowls site restore (site-config-persistence.js handles the
    // single confirmed-broken path). Direct DOM-click-to-non-bowls-tile path
    // is theoretically affected too but not yet observed in production —
    // deferred to b35fix395+ if that path produces a report.
    function clearBowlsState() {
        if (!global.GAIP_STATE) return;
        try {
            var existingTurf = (global.GAIP_STATE.inputs && global.GAIP_STATE.inputs.turf)
                || global.GAIP_STATE.turf
                || {};
            // Defensive: only strip cotula keys, preserve everything else
            // (variety, companionSpecies, hoc, ambientDLI, etc.)
            var cleared = Object.assign({}, existingTurf);
            // Use delete to actually remove keys — Object.assign treats undefined
            // as a value-to-set, so explicit undefined would not strip. delete
            // makes them absent from the merged object so neither the routed
            // write nor any subsequent hub-tissue:6952 merge can resurrect them
            // from a stale snapshot.
            delete cleared.cotula;
            delete cleared.surfaceType;
            delete cleared.speciesKey;
            delete cleared.grassSpecies;
            delete cleared.physiology;
            // turfType: don't strip here — TPC.selectTurfType() at the call site
            // is responsible for setting the new turfType. If we delete it, the
            // routed write below carries no turfType for this site at all,
            // breaking downstream readers that check for it.
            // But if existingTurf.turfType is still 'bowls' (stale), strip it
            // so the new TPC.selectTurfType call's eventual state propagation
            // wins.
            if (cleared.turfType === 'bowls') {
                delete cleared.turfType;
            }
            global.GAIP_STATE = {
                inputs: {
                    turf: cleared
                }
            };
            console.log('[CotulaBowling b35fix394] Cleared bowls/cotula state from inputs.turf for non-bowls site.');
        } catch (e) {
            console.warn('[CotulaBowling b35fix394] clearBowlsState failed:', e && e.message);
        }
    }

    // =========================================================================
    // METHODOLOGY HEADER
    // Renders S78 badge analogous to the existing AA methodology header.
    // =========================================================================

    function renderCotulaMethHeader() {
        return `
            <div class="gaip-methodology-header" style="
                display: flex;
                align-items: center;
                gap: 12px;
                padding: 10px 14px;
                margin-bottom: 12px;
                background: var(--gaip-good-bg);
                border: 1px solid #10b981;
                border-radius: 8px;
            ">
                <div style="font-size: 20px;">🌿</div>
                <div style="flex: 1;">
                    <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
                        <span style="
                            font-weight: 700;
                            font-size: 14px;
                            color: #065f46;
                            background: var(--gaip-surface);
                            padding: 2px 8px;
                            border-radius: 4px;
                            border: 1px solid #10b981;
                        ">Hill Labs S78, Turf Cotula</span>
                        <span style="font-size: 12px; color: #065f46; opacity: 0.85;">
                            NZ Bowling Green
                        </span>
                    </div>
                    <div style="font-size: 11px; color: #065f46; margin-top: 4px; opacity: 0.8;">
                        Olsen P + NH₄OAc extraction, calibrated for Leptinella spp. (S78 ranges).
                        MLSN does not apply to cotula.
                    </div>
                </div>
            </div>
        `;
    }

    // =========================================================================
    // HELPERS (private)
    // =========================================================================

    function _isNZ() {
        // Method 1: delegate to AA module (preferred — it has the full detection chain)
        if (window.GAIP_AmmoniumAcetate?.isNewZealand) {
            if (window.GAIP_AmmoniumAcetate.isNewZealand()) return true;
        }

        // Method 2: RegionalProfiles (available earlier than GAIP_STATE)
        if (window.GAIP_RegionalProfiles?.detectRegionFromHub) {
            if (window.GAIP_RegionalProfiles.detectRegionFromHub() === 'new_zealand') return true;
        }

        // Method 3: GAIP_STATE location region
        if (window.GAIP_STATE?.location?.region === 'new_zealand') return true;

        // Method 4: GAIP_STATE location coordinates
        const lat1 = window.GAIP_STATE?.location?.lat;
        const lon1 = window.GAIP_STATE?.location?.lon;
        if (lat1 && lon1 && lon1 >= 166 && lon1 <= 179 && lat1 >= -47 && lat1 <= -34) return true;

        // Method 5: saved site coordinates (available even before GAIP_STATE populates)
        const lat2 = window.GAIP_HUB_CONFIG?.savedLocation?.lat
                  || window.GAIP_HUB_CONFIG?.currentSite?.lat;
        const lon2 = window.GAIP_HUB_CONFIG?.savedLocation?.lon
                  || window.GAIP_HUB_CONFIG?.currentSite?.lon;
        if (lat2 && lon2 && lon2 >= 166 && lon2 <= 179 && lat2 >= -47 && lat2 <= -34) return true;

        // Method 6: turf profile controller already identified NZ
        const tpc = window.GAIP_TurfProfileController || window.TurfProfileController;
        if (tpc?.getCurrentRegion?.() === 'new_zealand') return true;
        if (tpc?.getRegion?.() === 'new_zealand') return true;

        return false;
    }

    function _extractValue(soilData, param) {
        if (!soilData) return null;
        // Direct match
        if (soilData[param] !== undefined && soilData[param] !== null && soilData[param] !== '') {
            return parseFloat(soilData[param]);
        }
        // Aliased fields from Hill Labs parser output
        const aliases = {
            pH: ['pH', 'ph', 'pH_water'],
            P_olsen: ['P_olsen', 'P', 'olsenP', 'Olsen_P'],
            K_pct_bs: ['K_pct_bs', 'K_BS', 'K_percent_bs'],
            Ca_pct_bs: ['Ca_pct_bs', 'Ca_BS', 'Ca_percent_bs'],
            Mg_pct_bs: ['Mg_pct_bs', 'Mg_BS', 'Mg_percent_bs'],
            Na_pct_bs: ['Na_pct_bs', 'Na_BS', 'Na_percent_bs'],
            K_me: ['K_me', 'K_meq'],
            CEC: ['CEC', 'cec'],
            TBS: ['TBS', 'total_bs', 'totalBS', 'base_saturation'],
            VW: ['VW', 'vol_weight', 'volumeWeight', 'bulk_density'],
            K_Mg_ratio: ['K_Mg_ratio', 'KMg', 'k_mg_ratio']
        };
        const alts = aliases[param] || [];
        for (const alt of alts) {
            if (soilData[alt] !== undefined && soilData[alt] !== null && soilData[alt] !== '') {
                return parseFloat(soilData[alt]);
            }
        }
        return null;
    }

    function _priority(param) {
        // Lower = higher priority for display sorting
        const order = {
            K_Mg_ratio: 1, K_pct_bs: 2, P_olsen: 3, pH: 4,
            Mg_pct_bs: 5, Ca_pct_bs: 6, Na_pct_bs: 7, CEC: 8, TBS: 9, VW: 10
        };
        return order[param] || 99;
    }

    function _lowRec(param, value) {
        const recs = {
            pH: 'Apply agricultural lime to raise pH toward 5.8. Calcitic lime preferred for cotula.',
            P_olsen: 'Olsen P is below optimal. Apply single superphosphate or DAP at low rate.',
            K_pct_bs: 'K below minimum. Apply sulphate of potash (SOP), avoid MOP on cotula.',
            Ca_pct_bs: 'Ca low. Apply gypsum or calcitic lime to raise Ca%BS.',
            Mg_pct_bs: 'Mg below range. Apply Epsom salts (MgSO₄) at maintenance rate.',
            Na_pct_bs: null,
            CEC: 'Low CEC indicates sandy or depleted soil. Organic matter additions will help.',
            TBS: 'Low TBS, likely excessive acidity. Lime application required.',
            VW: 'Volume weight below 0.60 g/mL suggests very high organic matter or thatchy profile.',
            K_Mg_ratio: 'K/Mg ratio is critically low. Mg is suppressing K uptake. Apply SOP before correcting Mg.'
        };
        return recs[param] || `${param} is below the Hill Labs S78 optimal range. Corrective application recommended.`;
    }

    function _highRec(param, value) {
        const recs = {
            pH: 'pH above 6.5, acidifying fertiliser (ammonium sulphate, ferrous sulphate) may be required.',
            P_olsen: `Olsen P is very high (${value} mg/L vs optimal 20–30). Eliminate all P inputs. Review if surfactant-driven P redistribution is possible.`,
            K_pct_bs: 'K above range. No K inputs needed this season.',
            Ca_pct_bs: 'Ca above range, common on NZ bowling greens. No corrective action unless Ca:Mg ratio is extreme.',
            Mg_pct_bs: 'Mg above range. High Mg may suppress K uptake. Check K/Mg ratio.',
            Na_pct_bs: 'Na above 5%, risk of soil dispersion. Apply gypsum (Ca²⁺ displacement of Na⁺) and improve drainage.',
            CEC: 'CEC high, clay-dominated. Monitor drainage carefully.',
            TBS: 'TBS high, check individual cation ratios for imbalance.',
            VW: 'Volume weight above 1.0 g/mL suggests compaction. Core aeration indicated.',
            K_Mg_ratio: 'K/Mg above 1.0 is unusual on NZ cotula greens. Confirm Mg inputs are not excessive.'
        };
        return recs[param] || `${param} is above the Hill Labs S78 optimal range. Reduce or suspend inputs.`;
    }

    function _setSpeciesToCotula() {
        const speciesSelect = document.querySelector('.gaip-species, #gaip-species-select');
        const varietySelect = document.querySelector('.gaip-variety, #gaip-variety-select');

        if (speciesSelect) {
            // Check if cotula option already exists
            let cotOpt = speciesSelect.querySelector('option[value="cotula"]');
            if (!cotOpt) {
                cotOpt = new Option('Cotula (Leptinella)', 'cotula');
                speciesSelect.appendChild(cotOpt);
            }
            speciesSelect.value = 'cotula';
            speciesSelect.dispatchEvent(new Event('change'));
        }

        if (varietySelect) {
            // Clear and repopulate with cotula varieties
            varietySelect.innerHTML = '';
            COTULA_SURFACE_CONFIG.varieties.forEach(v => {
                varietySelect.appendChild(new Option(v.label, v.key));
            });
        }
    }

    // =========================================================================
    // INIT
    // =========================================================================

    // Track whether UI has been injected to avoid duplicates
    let _uiInjected = false;

    function _injectUI() {
        if (_uiInjected) return;
        if (!_isNZ()) return;

        injectBowlsButton();
        injectBowlsSubcategory();

        // Only mark injected if the grid actually exists and button was added
        if (document.querySelector('[data-type="bowls"]')) {
            _uiInjected = true;
            console.log('[CotulaBowling] Bowls button injected.');
        }
    }

    function init() {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', init);
            return;
        }

        // Wire up click handler unconditionally — bowls button may appear later
        document.addEventListener('click', function (e) {
            const btn = e.target.closest('[data-type="bowls"]');
            if (btn) handleBowlsSelection();
        });

        // Attempt immediate injection (may succeed if location already known)
        _injectUI();

        // Listen for NZ confirmation events — any of these means location is now set
        // and _isNZ() will return a reliable answer
        const NZ_EVENTS = [
            'gaip:turf-profile-change',
            'gaip:stateRestored',
            'gaip:site-config-applied',
            'gaip:methodology-change',
        ];
        NZ_EVENTS.forEach(evt => {
            document.addEventListener(evt, () => {
                if (!_uiInjected) _injectUI();
            });
        });

        // Also listen for AmmoniumAcetate's own NZ auto-select event
        // AA fires 'gaip:methodology-change' when it auto-selects, which is
        // the most reliable signal that NZ has been confirmed
        document.addEventListener('change', function (e) {
            const sel = e.target.closest('.gaip-soil-methodology');
            if (sel && sel.value === 'ammonium_acetate' && !_uiInjected) {
                // AA just switched to NZ — we are definitely in NZ
                setTimeout(_injectUI, 50);
            }
        });

        // Timed fallbacks — covers cases where events fire before listeners attach
        setTimeout(_injectUI, 500);
        setTimeout(_injectUI, 1500);
        setTimeout(_injectUI, 3000);

        console.log('[CotulaBowling] v1.0.0 initialised, NZ bowling green module active.');
    }

    init();

    // =========================================================================
    // EXPORTS
    // =========================================================================

    const CotulaBowlingGreen = {
        // Data
        S78_RANGES: COTULA_S78_RANGES,
        N_BENCHMARKS: COTULA_N_BENCHMARKS,
        SURFACE_CONFIG: COTULA_SURFACE_CONFIG,

        // Interpretation
        interpretS78Value,
        interpretCotulaSoilTest,

        // N program
        calcCotulActivityFraction,
        calcCotulaMonthlyN,

        // UI
        renderCotulaMethHeader,
        handleBowlsSelection,
        clearBowlsState, // b35fix394: inverse of handleBowlsSelection — strips cotula keys

        // Utilities
        isNZ: _isNZ,
        init
    };

    global.GAIP_CotulaBowling = CotulaBowlingGreen;
    global.CotulaBowlingGreen = CotulaBowlingGreen;

})(typeof window !== 'undefined' ? window : this);
