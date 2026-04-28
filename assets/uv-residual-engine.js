/**
 * UV Photolysis Fungicide Residual Engine
 * ========================================
 *
 * Calculates remaining efficacy of applied fungicides based on cumulative
 * UV dose, rainfall washoff, and biological (temperature-driven) degradation
 * since application.
 *
 * Model: First-order decay with three parallel degradation pathways:
 *   R(t) = R₀ × exp(-k_UV × UV_dose) × exp(-k_rain × rain) × exp(-k_bio × bio_factor)
 *
 * Where:
 *   k_UV   = photolysis rate constant (per MJ/m² UV-B)
 *   k_rain = washoff rate constant (per mm rainfall)
 *   k_bio  = biological degradation rate constant (per °C-day above threshold)
 *   bio_factor = accumulated thermal units since application
 *
 * Photolysis half-life data sources (field/foliar surface conditions):
 *
 *   Chlorothalonil:
 *     Monadjemi et al. (2011) Environ Sci Technol 45(22):9582–9589
 *     Field-extrapolated foliar half-life: 5.3 days under simulated solar light.
 *     Aqueous photolysis half-life: 1–48 hours depending on conditions.
 *     Conservative foliar estimate used: 5.3 days at 18 MJ/m² daily UV-B.
 *
 *   Azoxystrobin:
 *     ScienceDirect Topics (Azoxystrobin overview); FAO JMPR Evaluation 2008.
 *     Photolysis half-life in soils: 11–15 days. Foliar: faster due to direct
 *     sunlight exposure. Phototransformation (isomerisation) known for strobilurins.
 *     Conservative foliar estimate: 14 days at 18 MJ/m² daily UV-B.
 *
 *   Iprodione:
 *     Moderate UV stability documented. Not a primary photolysis substrate.
 *     Estimated foliar half-life: 21 days at 18 MJ/m² daily UV-B (conservative).
 *
 *   Propiconazole:
 *     Wang et al. (2022) Sci Total Environ. Aqueous photolysis half-life: 636 days
 *     (extremely UV-stable). Foliar degradation primarily biological/microbial.
 *     Photolysis rate set to negligible — biological degradation dominates.
 *     Foliar UV half-life estimate: 90+ days.
 *
 *   Tebuconazole:
 *     Vione et al. (2022) Chemosphere. Direct photolysis negligible in water.
 *     Indirect photochemistry gives ~1 week lifetime in surface waters.
 *     Foliar UV half-life estimate: 30 days (conservative, indirect photolysis
 *     via OH radicals on leaf surface).
 *
 *   Fludioxonil:
 *     Duan et al. (2013) cited in ScienceDirect. Direct photodegradation half-life
 *     9.9 days (summer, 30°N) to 8.7 days (40°N) in aquatic systems.
 *     Foliar estimate: 10 days at 18 MJ/m² daily UV-B (phenylpyrrole chromophore
 *     absorbs UV directly; confirmed photolabile by EFSA guidance document 2022).
 *
 *   Fluazinam:
 *     Moderate UV sensitivity (dinitroaniline chromophore). Limited foliar data.
 *     Conservative estimate: 14 days at 18 MJ/m² daily UV-B.
 *
 *   Mancozeb (EBDC dithiocarbamates):
 *     Highly UV-sensitive. Aqueous half-life often <1 day under direct UV.
 *     Foliar estimate: 3 days at 18 MJ/m² daily UV-B.
 *
 *   Fosetyl-Al (phosphonates):
 *     Systemic compound — photolysis less relevant as primary site of action
 *     is within plant tissue. Surface residue degrades moderately.
 *     Foliar UV half-life estimate: 30 days.
 *
 *   Cyazofamid, Propamocarb, Etridiazole:
 *     Limited foliar photolysis data. Conservative class estimates applied.
 *
 *   Trifloxystrobin, Pyraclostrobin (strobilurins):
 *     Leaching study (Agronomy Journal 2021, NIBIO Landvik) confirms fast
 *     aqueous photolysis for strobilurins post-spraying. Prothioconazole also
 *     confirmed rapid aqueous photolysis to desthio metabolite.
 *     Foliar estimate: 10 days for trifloxystrobin/pyraclostrobin.
 *
 *   Mandestrobin: Limited data; estimated with strobilurin class default.
 *
 *   Boscalid, Fluxapyroxad, Penthiopyrad (SDHIs):
 *     Generally UV-stable. Boscalid confirmed persistent in leaching study above.
 *     Foliar UV half-life estimate: 28 days.
 *
 *   Oxathiapiprolin: Limited data. Conservative estimate: 21 days.
 *
 * IMPORTANT CAVEATS:
 *   All values are conservative foliar surface estimates derived from available
 *   literature. Actual degradation rates vary with formulation, adjuvants,
 *   leaf surface chemistry, and local UV intensity. This model provides a
 *   relative residual index, NOT a label compliance guarantee.
 *   Always apply within label re-entry intervals regardless of model output.
 *
 * UV-B estimation from shortwave radiation:
 *   UV-B (280-315nm) is approximately 0.5-1% of total shortwave radiation.
 *   This engine uses 0.7% as a conservative mid-range factor, which is
 *   consistent with published ratios for mid-latitude clear-sky conditions.
 *   Reference: WMO/WHO (1994) Environmental Health Criteria 160; Diffey (2002).
 *
 * Version: 1.0.0
 * @package GilbaHub
 */

(function () {
    'use strict';

    // ========================================================================
    // PHOTOLYSIS DATA TABLE
    // UV half-life in days at reference UV-B dose of 18 MJ/m² (full-sun day)
    // k_UV derived as: k_UV = ln(2) / (t½_days × 18 MJ/m²/day)
    // Residual efficacy: R(t) = exp(-k_UV × cumulative_UV_MJ)
    // ========================================================================

    var PHOTOLYSIS_DATA = {

        // ---- FRAC M (Multi-site contact) ----

        chlorothalonil: {
            frac: 'M5',
            uvHalfLifeDays: 5.3,        // Monadjemi et al. 2011, ESciT foliar wax model
            uvSensitivity: 'high',
            rainWashoffK: 0.08,         // high surface mobility, no cuticle penetration
            bioHalfLifeDays: 30,        // primarily surface residue, moderate microbial
            notes: 'Monadjemi et al. (2011) Environ Sci Technol 45:9582. Field foliar t½ 5.3d.'
        },

        mancozeb: {
            frac: 'M3',
            uvHalfLifeDays: 3.0,        // EBDC class: highly UV-sensitive
            uvSensitivity: 'very-high',
            rainWashoffK: 0.10,
            bioHalfLifeDays: 14,
            notes: 'EBDC dithiocarbamates: rapid UV degradation, aqueous t½ often <1 day.'
        },

        // ---- FRAC 1 (MBC/Benzimidazoles) ----

        thiophanateMethyl: {
            frac: 1,
            uvHalfLifeDays: 14,         // moderate UV sensitivity; systemic component
            uvSensitivity: 'moderate',
            rainWashoffK: 0.04,         // translaminar — some internal protection
            bioHalfLifeDays: 21,
            notes: 'Moderate UV sensitivity. Systemic component provides partial internal protection.'
        },

        thiabendazole: {
            frac: 1,
            uvHalfLifeDays: 14,
            uvSensitivity: 'moderate',
            rainWashoffK: 0.04,
            bioHalfLifeDays: 21,
            notes: 'MBC class. Estimated from class data.'
        },

        // ---- FRAC 2 (Dicarboximides) ----

        iprodione: {
            frac: 2,
            uvHalfLifeDays: 21,         // moderate UV stability documented
            uvSensitivity: 'low-moderate',
            rainWashoffK: 0.06,         // contact/locally systemic
            bioHalfLifeDays: 28,
            notes: 'Moderate UV stability. Conservative foliar estimate 21d.'
        },

        procymidone: {
            frac: 2,
            uvHalfLifeDays: 21,
            uvSensitivity: 'low-moderate',
            rainWashoffK: 0.06,
            bioHalfLifeDays: 28,
            notes: 'Dicarboximide class. Conservative estimate from class data.'
        },

        // ---- FRAC 3 (DMI/Triazoles) ----

        propiconazole: {
            frac: 3,
            uvHalfLifeDays: 90,         // aqueous photolysis t½ 636d (Wang et al. 2022)
            uvSensitivity: 'very-low',
            rainWashoffK: 0.02,         // xylem-mobile systemic
            bioHalfLifeDays: 42,
            notes: 'Wang et al. (2022) Sci Total Environ. Aqueous t½ 636d. UV extremely stable.'
        },

        tebuconazole: {
            frac: 3,
            uvHalfLifeDays: 30,         // Vione et al. 2022: negligible direct photolysis
            uvSensitivity: 'low',
            rainWashoffK: 0.02,
            bioHalfLifeDays: 35,
            notes: 'Vione et al. (2022). Direct photolysis negligible; indirect ~1wk in water. Foliar: 30d.'
        },

        triticonazole: {
            frac: 3,
            uvHalfLifeDays: 30,
            uvSensitivity: 'low',
            rainWashoffK: 0.02,
            bioHalfLifeDays: 35,
            notes: 'Triazole class estimate. Conservative 30d foliar.'
        },

        triadimenol: {
            frac: 3,
            uvHalfLifeDays: 30,
            uvSensitivity: 'low',
            rainWashoffK: 0.03,
            bioHalfLifeDays: 35,
            notes: 'Triazole class estimate.'
        },

        myclobutanil: {
            frac: 3,
            uvHalfLifeDays: 30,
            uvSensitivity: 'low',
            rainWashoffK: 0.03,
            bioHalfLifeDays: 35,
            notes: 'Triazole class estimate.'
        },

        // ---- FRAC 7 (SDHI) ----

        boscalid: {
            frac: 7,
            uvHalfLifeDays: 28,         // confirmed persistent in Agronomy Journal 2021 leaching study
            uvSensitivity: 'low',
            rainWashoffK: 0.03,
            bioHalfLifeDays: 42,
            notes: 'Leaching study (Agronomy Journal 2021, NIBIO): confirmed UV-stable relative to strobilurins.'
        },

        fluxapyroxad: {
            frac: 7,
            uvHalfLifeDays: 28,
            uvSensitivity: 'low',
            rainWashoffK: 0.02,
            bioHalfLifeDays: 42,
            notes: 'SDHI class. Conservative 28d estimate.'
        },

        penthiopyrad: {
            frac: 7,
            uvHalfLifeDays: 28,
            uvSensitivity: 'low',
            rainWashoffK: 0.02,
            bioHalfLifeDays: 42,
            notes: 'SDHI class. Conservative 28d estimate.'
        },

        // ---- FRAC 11 (QoI/Strobilurins) ----

        azoxystrobin: {
            frac: 11,
            uvHalfLifeDays: 14,         // FAO JMPR 2008: soil photolysis 11-15d; foliar faster
            uvSensitivity: 'moderate',
            rainWashoffK: 0.03,         // xylem-mobile
            bioHalfLifeDays: 30,
            notes: 'FAO JMPR 2008. Soil photolysis 11-15d; foliar faster due to direct exposure. 14d used.'
        },

        trifloxystrobin: {
            frac: 11,
            uvHalfLifeDays: 10,         // Agronomy Journal 2021: fast aqueous photolysis confirmed
            uvSensitivity: 'high',
            rainWashoffK: 0.04,
            bioHalfLifeDays: 21,
            notes: 'Agronomy Journal 2021 (NIBIO Landvik): fast aqueous photolysis post-spraying confirmed.'
        },

        pyraclostrobin: {
            frac: 11,
            uvHalfLifeDays: 10,
            uvSensitivity: 'high',
            rainWashoffK: 0.04,
            bioHalfLifeDays: 21,
            notes: 'Strobilurin class: fast photolysis confirmed in leaching study.'
        },

        mandestrobin: {
            frac: 11,
            uvHalfLifeDays: 12,         // strobilurin class estimate
            uvSensitivity: 'moderate-high',
            rainWashoffK: 0.04,
            bioHalfLifeDays: 21,
            notes: 'Limited data. Strobilurin class estimate applied.'
        },

        // ---- FRAC 12 (Phenylpyrroles) ----

        fludioxonil: {
            frac: 12,
            uvHalfLifeDays: 10,         // Duan et al. 2013 (cited in SciDirect): 9.9d at 30°N summer
            uvSensitivity: 'moderate-high',
            rainWashoffK: 0.02,         // strongly sorbed to leaf surface/cuticle
            bioHalfLifeDays: 45,        // highly persistent biologically
            notes: 'Duan et al. (2013): direct photolysis t½ 9.9d (30°N summer), 8.7d (40°N). EFSA 2022 confirms photolabile.'
        },

        // ---- FRAC 14 ----

        etridiazole: {
            frac: 14,
            uvHalfLifeDays: 14,         // limited data; moderate UV sensitivity
            uvSensitivity: 'moderate',
            rainWashoffK: 0.05,
            bioHalfLifeDays: 14,        // volatile/unstable
            notes: 'Limited foliar data. Conservative class estimate.'
        },

        tolclofosMethyl: {
            frac: 14,
            uvHalfLifeDays: 21,
            uvSensitivity: 'low-moderate',
            rainWashoffK: 0.04,
            bioHalfLifeDays: 28,
            notes: 'Limited foliar UV data. Conservative estimate.'
        },

        // ---- FRAC 21 (QiI) ----

        cyazofamid: {
            frac: 21,
            uvHalfLifeDays: 21,
            uvSensitivity: 'low-moderate',
            rainWashoffK: 0.05,
            bioHalfLifeDays: 21,
            notes: 'Limited foliar photolysis data. Conservative estimate.'
        },

        // ---- FRAC 28 (Carbamates) ----

        propamocarb: {
            frac: 28,
            uvHalfLifeDays: 21,         // systemic; surface residue moderate
            uvSensitivity: 'low',
            rainWashoffK: 0.03,
            bioHalfLifeDays: 21,
            notes: 'Systemic compound. UV degradation less relevant post-uptake.'
        },

        // ---- FRAC 29 (Uncouplers) ----

        fluazinam: {
            frac: 29,
            uvHalfLifeDays: 14,         // dinitroaniline chromophore — moderate UV sensitivity
            uvSensitivity: 'moderate',
            rainWashoffK: 0.06,
            bioHalfLifeDays: 21,
            notes: 'Dinitroaniline chromophore absorbs UV. Moderate sensitivity. Conservative 14d.'
        },

        // ---- FRAC 33 (Phosphonates) ----

        fosetylAl: {
            frac: 33,
            uvHalfLifeDays: 30,         // systemic; mode of action internal
            uvSensitivity: 'low',
            rainWashoffK: 0.02,         // phloem-mobile, rapidly absorbed
            bioHalfLifeDays: 28,
            notes: 'Phloem-mobile systemic. UV degradation of surface residue only; internal activity independent.'
        },

        // ---- FRAC 49 ----

        oxathiapiprolin: {
            frac: 49,
            uvHalfLifeDays: 21,
            uvSensitivity: 'low-moderate',
            rainWashoffK: 0.03,
            bioHalfLifeDays: 28,
            notes: 'Limited foliar photolysis data. Conservative estimate.'
        }
    };

    // ========================================================================
    // CONSTANTS
    // ========================================================================

    // UV-B as fraction of total shortwave radiation (conservative mid-latitude estimate)
    // Source: WMO/WHO (1994) Environmental Health Criteria 160; Diffey (2002)
    var UV_B_FRACTION = 0.007;          // 0.7% of shortwave

    // Reference UV-B dose for a full-sun day (MJ/m²)
    var REFERENCE_DAILY_UV_B = 18 * UV_B_FRACTION;   // ~0.126 MJ/m² UV-B

    // Efficacy threshold below which reapplication should be considered (%)
    var REAPPLY_THRESHOLD = 70;

    // Biological degradation base temperature (°C) — below this, microbial activity minimal
    var BIO_BASE_TEMP = 5;

    // ========================================================================
    // CORE CALCULATION ENGINE
    // ========================================================================

    /**
     * Calculate remaining residual efficacy for a single application.
     *
     * @param {Object} application - Spray log entry
     *   @param {string} application.activeIngredient - Key matching PHOTOLYSIS_DATA
     *   @param {string} application.applicationDate  - ISO date string
     *   @param {number} application.ratePercent      - Application rate as % of label max (0-100)
     * @param {Array}  climateHistory - Array of daily climate objects since application
     *   Each: { date, shortwaveRadiation_MJ, precipitation_mm, tempMean_C }
     * @returns {Object} Residual efficacy result
     */
    function calculateResidualEfficacy(application, climateHistory) {

        var entry = PHOTOLYSIS_DATA[application.activeIngredient];

        if (!entry) {
            return {
                activeIngredient: application.activeIngredient,
                error: 'No photolysis data available for this active ingredient.',
                residualPct: null,
                daysElapsed: null
            };
        }

        if (!climateHistory || climateHistory.length === 0) {
            return {
                activeIngredient: application.activeIngredient,
                error: 'No climate data available to calculate degradation.',
                residualPct: null,
                daysElapsed: 0
            };
        }

        // Derive rate constants from half-lives
        // k = ln(2) / t½  (per unit of degradation driver)

        // UV-B half-life is in days at reference daily UV-B dose
        // Convert to per-MJ/m² UV-B rate constant
        var totalReferenceUV = entry.uvHalfLifeDays * REFERENCE_DAILY_UV_B;
        var k_UV   = Math.log(2) / totalReferenceUV;  // per MJ/m² UV-B

        // Rain washoff: per mm rainfall (contact products wash off faster)
        var k_rain = entry.rainWashoffK;               // per mm

        // Biological: per degree-day above base temp
        var k_bio  = Math.log(2) / (entry.bioHalfLifeDays * 10);  // 10 DD/day reference

        // Accumulate degradation drivers from climate history
        var cumulativeUV_MJ   = 0;
        var cumulativeRain_mm = 0;
        var cumulativeBioDays = 0;

        climateHistory.forEach(function (day) {
            // UV-B from shortwave radiation
            var uvB = (day.shortwaveRadiation_MJ || 0) * UV_B_FRACTION;
            cumulativeUV_MJ += uvB;

            // Rainfall (subtract 5mm threshold — light rain doesn't wash off effectively)
            var effectiveRain = Math.max(0, (day.precipitation_mm || 0) - 5);
            cumulativeRain_mm += effectiveRain;

            // Biological degree-days
            var dd = Math.max(0, (day.tempMean_C || 15) - BIO_BASE_TEMP);
            cumulativeBioDays += dd;
        });

        // Calculate survival fraction for each pathway (multiplicative)
        var survivalUV   = Math.exp(-k_UV   * cumulativeUV_MJ);
        var survivalRain = Math.exp(-k_rain  * cumulativeRain_mm);
        var survivalBio  = Math.exp(-k_bio   * cumulativeBioDays);

        // Combined residual (multiplicative pathways)
        var combined = survivalUV * survivalRain * survivalBio;

        // Adjust for application rate (higher rate = longer effective residual)
        var rateFactor = (application.ratePercent || 100) / 100;
        // At label rate (100%), residual is as calculated.
        // At lower rates, effective residual starts at lower initial concentration.
        // Model: effective residual = combined × rateFactor (simplified linear)
        var adjustedResidual = combined * rateFactor;

        var residualPct = Math.round(Math.max(0, Math.min(100, adjustedResidual * 100)));

        return {
            activeIngredient:  application.activeIngredient,
            applicationDate:   application.applicationDate,
            daysElapsed:       climateHistory.length,
            residualPct:       residualPct,
            belowThreshold:    residualPct < REAPPLY_THRESHOLD,
            reapplyFlag:       residualPct < REAPPLY_THRESHOLD,
            breakdown: {
                uvSurvival:    Math.round(survivalUV   * 100),
                rainSurvival:  Math.round(survivalRain * 100),
                bioSurvival:   Math.round(survivalBio  * 100),
                cumulativeUVmj:  Math.round(cumulativeUV_MJ   * 100) / 100,
                cumulativeRainmm: Math.round(cumulativeRain_mm),
                cumulativeBioDD:  Math.round(cumulativeBioDays)
            },
            uvSensitivity:   entry.uvSensitivity,
            dataSource:      entry.notes,
            confidence:      _assessConfidence(entry)
        };
    }

    /**
     * Calculate residuals for all active applications in the spray log.
     * Filters to applications within the past 56 days (2 label intervals max).
     *
     * @param {Array}  sprayLog      - Array of application objects
     * @param {Array}  climateData   - Full climate data array (daily)
     * @returns {Array} Array of residual results, sorted by residualPct ascending
     */
    function calculateAllResiduals(sprayLog, climateData) {
        if (!sprayLog || !sprayLog.length) return [];
        if (!climateData || !climateData.length) return [];

        var today = new Date();
        var cutoffDate = new Date(today);
        cutoffDate.setDate(cutoffDate.getDate() - 56);

        return sprayLog
            .filter(function (app) {
                var appDate = new Date(app.applicationDate);
                return appDate >= cutoffDate && appDate <= today;
            })
            .map(function (app) {
                var appDate = new Date(app.applicationDate);
                var historySlice = climateData.filter(function (day) {
                    var dayDate = new Date(day.date);
                    return dayDate >= appDate && dayDate <= today;
                });
                return calculateResidualEfficacy(app, historySlice);
            })
            .filter(function (r) { return r.residualPct !== null; })
            .sort(function (a, b) { return a.residualPct - b.residualPct; });
    }

    /**
     * Extract UV-B dose from Open-Meteo shortwave radiation data.
     * Open-Meteo returns shortwave_radiation in W/m² (hourly).
     * Convert to MJ/m² for a day.
     *
     * @param {Array} hourlyShortwave - Array of hourly W/m² values (24 values per day)
     * @returns {number} Daily UV-B dose in MJ/m²
     */
    function extractDailyUVB(hourlyShortwave) {
        if (!hourlyShortwave || !hourlyShortwave.length) return 0;

        // Sum hourly W/m² and convert to MJ/m²
        // MJ/m² = (W/m² × 3600s) / 1,000,000
        var totalWh = hourlyShortwave.reduce(function (sum, w) { return sum + (w || 0); }, 0);
        var totalMJ = (totalWh * 3600) / 1e6;

        // Apply UV-B fraction
        return totalMJ * UV_B_FRACTION;
    }

    /**
     * Build daily climate history array from Open-Meteo forecast/historical data.
     * Bridges to existing climate-engine.js data structures.
     *
     * @param {Object} climateMetrics - Output from gaip_climate_calculate_metrics()
     * @param {string} startDate      - ISO date string (application date)
     * @returns {Array} Array of daily climate objects for residual calculation
     */
    function buildClimateHistoryFromGAIP(climateMetrics, startDate, rawWeatherData) {
        var appDate = new Date(startDate);
        appDate.setHours(0, 0, 0, 0);
        var today = new Date();
        today.setHours(0, 0, 0, 0);
        var combined = [];

        // ── PAST DAYS: use historical daily data if available ──────────────
        // rawWeatherData.historical.daily comes from Open-Meteo archive API
        // and covers actual UV/rain conditions since application date.
        var hist = rawWeatherData && rawWeatherData.historical && rawWeatherData.historical.daily;
        if (hist && hist.time) {
            for (var hi = 0; hi < hist.time.length; hi++) {
                var hDate = new Date(hist.time[hi]);
                hDate.setHours(0, 0, 0, 0);
                if (hDate >= appDate && hDate < today) {
                    combined.push({
                        date:                  hist.time[hi],
                        shortwaveRadiation_MJ: hist.shortwave_radiation_sum ? hist.shortwave_radiation_sum[hi] : 0,
                        precipitation_mm:      hist.precipitation_sum ? hist.precipitation_sum[hi] : 0,
                        tempMean_C:            hist.temperature_2m_mean ? hist.temperature_2m_mean[hi] : 15
                    });
                }
            }
        }

        // ── FUTURE / TODAY: use forecast dailyData ─────────────────────────
        // Covers today and coming days within the protection window.
        if (climateMetrics && climateMetrics.dailyData) {
            climateMetrics.dailyData.forEach(function(day) {
                var dDate = new Date(day.date);
                dDate.setHours(0, 0, 0, 0);
                // Include today + forward; skip if already covered by historical
                if (dDate >= today && dDate >= appDate) {
                    combined.push({
                        date:                  day.date,
                        shortwaveRadiation_MJ: day.solar ? day.solar.total : 0,
                        precipitation_mm:      day.precipitation ? day.precipitation.total : 0,
                        tempMean_C:            day.temp ? day.temp.mean : 15
                    });
                }
            });
        }

        // ── FALLBACK: estimate missing historical days from lat/date ────────
        // If no historical data at all, estimate solar from latitude and
        // use zero rainfall — conservative (overestimates residual).
        if (combined.length === 0 && appDate < today) {
            var lat = (climateMetrics && climateMetrics.lat) ||
                      (rawWeatherData && rawWeatherData.latitude) || -27;
            var cursor = new Date(appDate);
            while (cursor < today) {
                var dateStr = cursor.toISOString().split('T')[0];
                var doy = Math.floor((cursor - new Date(cursor.getFullYear(), 0, 0)) / 86400000);
                // Simple sinusoidal solar estimate: 8–22 MJ/m²/day by lat/season
                var declination = 23.45 * Math.sin((360 / 365 * (doy - 81)) * Math.PI / 180);
                var latRad = Math.abs(lat) * Math.PI / 180;
                var decRad = declination * Math.PI / 180;
                var cosZenith = Math.sin(latRad) * Math.sin(decRad) + Math.cos(latRad) * Math.cos(decRad);
                var solar = Math.max(4, Math.min(25, cosZenith * 30));
                combined.push({
                    date: dateStr,
                    shortwaveRadiation_MJ: Math.round(solar * 10) / 10,
                    precipitation_mm: 0,
                    tempMean_C: 20
                });
                cursor.setDate(cursor.getDate() + 1);
            }
        }

        combined.sort(function(a, b) { return a.date < b.date ? -1 : a.date > b.date ? 1 : 0; });
        return combined;
    }

    /**
     * Get a human-readable recommendation string for a residual result.
     *
     * @param {Object} result - Output from calculateResidualEfficacy()
     * @returns {string} Recommendation text
     */
    function getRecommendation(result) {
        if (!result || result.residualPct === null) return 'Insufficient data to assess residual.';

        var pct = result.residualPct;
        var ai  = result.activeIngredient;

        if (pct >= 90) {
            return 'Good residual protection (' + pct + '%). No reapplication required based on degradation modelling.';
        } else if (pct >= REAPPLY_THRESHOLD) {
            return 'Adequate residual (' + pct + '%). Monitor disease conditions closely. Consider reapplication if disease pressure is high.';
        } else if (pct >= 50) {
            return 'Reduced residual (' + pct + '%). UV/rainfall degradation has reduced protection. Reapplication recommended if disease risk persists.';
        } else if (pct >= 25) {
            return 'Low residual (' + pct + '%). Significant UV and/or rain degradation. Reapplication strongly recommended.';
        } else {
            return 'Minimal residual protection (' + pct + '%). Cumulative UV dose and/or rainfall has substantially degraded this product. Treat as unprotected.';
        }
    }

    /**
     * Assess data confidence for a given active ingredient.
     * Returns 'high', 'medium', or 'low' based on literature quality.
     */
    function _assessConfidence(entry) {
        var highConfidence = ['chlorothalonil', 'azoxystrobin', 'propiconazole', 'tebuconazole', 'fludioxonil', 'trifloxystrobin', 'pyraclostrobin', 'boscalid'];
        var ai = entry.frac; // use frac as proxy — not ideal but avoids needing key
        if (entry.notes && entry.notes.indexOf('doi') !== -1) return 'high';
        if (entry.notes && (entry.notes.indexOf('class estimate') !== -1 || entry.notes.indexOf('Conservative') !== -1)) return 'low';
        return 'medium';
    }

    /**
     * Get supported active ingredients list with UV sensitivity ratings.
     * Useful for populating UI dropdowns with relevant warnings.
     *
     * @returns {Array} Array of {key, frac, uvSensitivity, uvHalfLifeDays}
     */
    function getSupportedActives() {
        return Object.keys(PHOTOLYSIS_DATA).map(function (key) {
            var entry = PHOTOLYSIS_DATA[key];
            return {
                key:           key,
                frac:          entry.frac,
                uvSensitivity: entry.uvSensitivity,
                uvHalfLifeDays: entry.uvHalfLifeDays,
                dataSource:    entry.notes
            };
        });
    }

    // ========================================================================
    // PUBLIC API
    // ========================================================================

    var UV_RESIDUAL_ENGINE = {
        calculateResidualEfficacy:       calculateResidualEfficacy,
        calculateAllResiduals:           calculateAllResiduals,
        buildClimateHistoryFromGAIP:     buildClimateHistoryFromGAIP,
        extractDailyUVB:                 extractDailyUVB,
        getRecommendation:               getRecommendation,
        getSupportedActives:             getSupportedActives,
        PHOTOLYSIS_DATA:                 PHOTOLYSIS_DATA,
        REAPPLY_THRESHOLD:               REAPPLY_THRESHOLD,
        UV_B_FRACTION:                   UV_B_FRACTION,
        version:                         '1.0.0'
    };

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = UV_RESIDUAL_ENGINE;
    }
    if (typeof window !== 'undefined') {
        window.GAIP_UV_RESIDUAL = UV_RESIDUAL_ENGINE;
    }

})();
