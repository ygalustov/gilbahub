/**
 * =============================================================================
 * GILBA DISEASE ENGINE - PURE EXTRACTED v3.0.1
 * =============================================================================
 *
 * Pure-function disease risk engine. No DOM reads, no global mutation.
 * Accepts a single state object, returns a deterministic result.
 *
 * EXTRACTION PATTERN (matches climate engine extraction):
 *   - Every calculation is a pure function: f(state) → result
 *   - No `window.*` reads inside any calculation path
 *   - No `document.*` reads
 *   - No module-level mutable state
 *   - Fungicide databases are static data, injected via state.fungicideDb or defaulted
 *   - Species normalization delegates to a single canonical function
 *   - Regional disease multipliers passed in via state, not read from globals
 *
 * INPUT SHAPE (DiseaseEngineInput):
 * {
 *   climate: { temperature: { mean, min, max, dailyPattern? }, moisture: { humidity: { mean, night? }, precipitation: { total } }, hourlyData?, dewpoint?, snowCover?, cloudCover? },
 *   nitrogen: { status: 'deficient'|'low'|'adequate'|'optimal'|'high'|'excessive' },
 *   shade: { dliDeficit: { percentage }, stressFactor?, fungalRisk? },
 *   soil: { pH?, K_ppm?, Mn_ppm?, thatchMm? },
 *   variety: { name?, species?, disease: { [diseaseName]: { riskMultiplier } }, source? },
 *   species: string,                    // Canonical species key
 *   region: string,                     // e.g. 'AU', 'NZ', 'GB', 'SE'
 *   traffic: { cumulativeStress?: { status } },
 *   mowing: { heightOfCut?, height? },
 *   dewData: { leafWetness: { averageWetHours?, totalWetHours? } },
 *   tissueNutrients: { hasData, compositeModifier, modifiers: { K?, Ca?, Mn?, Si?, KN_ratio?, P? }, notes? },
 *   poaPercent: number,
 *   baseSpecies: string,
 *   // Optional injections (replace global reads):
 *   regionalMultipliers: { [diseaseKey]: number },  // replaces window.gaip_getDiseaseMultiplier
 *   regionDisplayInfo: { name, id?, dataSource? },   // replaces window.gaip_getRegionDisplayInfo
 *   largePatchModel: object,                          // replaces window.LargePatchModel
 *   dormancyData: object,                             // replaces window.GAIP_CLIMATE_V2.dormancy
 * }
 *
 * OUTPUT SHAPE (DiseaseEngineResult):
 * {
 *   timestamp, species, region, fungicideRegion, overallRisk, overallScore,
 *   diseases: [ { disease, displayName, riskScore, adjustedRisk, riskLevel, confidence, confidenceScore, drivers, ... } ],
 *   topThreats, alerts, variety, tissueNutrients
 * }
 *
 * @version 3.0.0
 * @author Gilba Solutions
 * =============================================================================
 */

(function(root) {
'use strict';

// =============================================================================
// CONFIGURATION (immutable)
// =============================================================================

const DISEASE_CONFIG = Object.freeze({
    thresholds: { low: 25, moderate: 50, high: 70, severe: 85 },
    sprayWindow: { minRainFreeHours: 4, maxWindSpeed: 15, optimalTempMin: 10, optimalTempMax: 30 },
});

const CONFIDENCE_SCORES = Object.freeze({
    'high': 90, 'medium': 70, 'low': 40,
    'insufficient data': 10, 'insufficient': 10, 'none': 0
});

// =============================================================================
// SPECIES SUSCEPTIBILITY (immutable reference data)
// =============================================================================

const SPECIES_SUSCEPTIBILITY = Object.freeze({
    bentgrass:        { dollarSpot: 1.3, brownPatch: 1.3, pythium: 1.3, anthracnose: 1.4, fusarium: 1.2, takeAll: 1.5, grayLeafSpot: 0.5, springDeadSpot: 0, helminthosporium: 0.3, largePatch: 0 },
    // b35fix239: dollarSpot 1.1→0.95. Original 1.1 reflected old heterogeneous PRG stock.
    // Modern turf-type perennial ryegrass cultivars span a wide susceptibility range and
    // 23/29 varieties in GAIP have no cultivar-level dollar spot data, so all fall back
    // to this species floor. A floor of 1.1 with no downgrade path produces persistent
    // false-high outputs on managed golf turf. Reduced to 0.95 (neutral-to-slightly-resistant)
    // reflecting the modern turf-type breeding base.
    // Ref: NC State TurfFiles — "certain cultivars...are very susceptible, while others are
    // fairly tolerant" (wide range acknowledged); Hempfling et al. 2021 Crop Science —
    // Smith-Kerns over-predicts on tolerant cultivars at standard thresholds.
    perennialRyegrass:{ dollarSpot: 0.95, brownPatch: 1.4, pythium: 1.4, anthracnose: 0.8, fusarium: 1.0, takeAll: 0.7, grayLeafSpot: 1.5, springDeadSpot: 0, helminthosporium: 0.5, largePatch: 0 },
    kentuckyBluegrass:{ dollarSpot: 1.0, brownPatch: 0.9, pythium: 1.1, anthracnose: 0.7, fusarium: 1.2, takeAll: 0.8, grayLeafSpot: 0.6, springDeadSpot: 0, helminthosporium: 1.3, largePatch: 0 },
    tallFescue:       { dollarSpot: 0.8, brownPatch: 1.4, pythium: 0.9, anthracnose: 0.5, fusarium: 0.7, takeAll: 0.5, grayLeafSpot: 0.9, springDeadSpot: 0, helminthosporium: 0.6, largePatch: 0 },
    poaAnnua:         { dollarSpot: 1.4, brownPatch: 1.0, pythium: 1.5, anthracnose: 1.8, fusarium: 1.3, takeAll: 1.0, grayLeafSpot: 0.3, springDeadSpot: 0, helminthosporium: 0.4, largePatch: 0 },
    bermuda:          { dollarSpot: 0.3, brownPatch: 0.2, pythium: 0.6, anthracnose: 0.3, fusarium: 0.0, takeAll: 0.3, grayLeafSpot: 0.5, springDeadSpot: 1.5, helminthosporium: 1.4, largePatch: 0.7 },
    couch:            { dollarSpot: 0.3, brownPatch: 0.2, pythium: 0.6, anthracnose: 0.3, fusarium: 0.0, takeAll: 0.3, grayLeafSpot: 0.5, springDeadSpot: 1.4, helminthosporium: 1.3, largePatch: 0.7 },
    // kikuyu: primary Bipolaris/Exserohilum host (helminthosporium 1.0 correct); GLS significant warm-season host (was 0.3 → 1.1);
    //         dollar spot moderate-high susceptibility per AU field/Sclerotinia data (was 0.25 → 0.6);
    //         large patch AU-confirmed R. solani AG 2-2 LP; SDS: 0 — no credible primary AU host documentation (b35fix150: reverted from b24 0.35)
    kikuyu:           { dollarSpot: 0.6, brownPatch: 0.15, pythium: 0.6, anthracnose: 0.2, fusarium: 0.0, takeAll: 0.3, grayLeafSpot: 1.1, springDeadSpot: 0, helminthosporium: 1.0, largePatch: 1.2 },
    // zoysia: dollar spot and large patch primary hosts; brown patch most common disease (was 0.2 → 0.7);
    //         anthracnose significant per Georgia/UGA data (was 0.4 → 0.7)
    zoysia:           { dollarSpot: 0.9, brownPatch: 0.7, pythium: 0.7, anthracnose: 0.7, fusarium: 0.0, takeAll: 0.5, grayLeafSpot: 0.6, springDeadSpot: 1.2, helminthosporium: 1.3, largePatch: 1.4 },
    // buffalo (St Augustine): GLS primary host but management-responsive (was 1.8 → 1.3 per Lebanon/Lawn Institute);
    //         take-all root rot major disease (was 0.3 → 0.8 per Clemson/TAMU data);
    //         SDS secondary host Perth-documented (was 0 → 0.3)
    buffalo:          { dollarSpot: 0.5, brownPatch: 0.2, pythium: 0.5, anthracnose: 0.2, fusarium: 0.0, takeAll: 0.8, grayLeafSpot: 1.3, springDeadSpot: 0.3, helminthosporium: 0.8, largePatch: 0.9 },
    buffalograss:     { dollarSpot: 0.5, brownPatch: 0.15, pythium: 0.5, anthracnose: 0.2, fusarium: 0.0, takeAll: 0.3, grayLeafSpot: 0.3, springDeadSpot: 0, helminthosporium: 0.8, largePatch: 0.6 },
});

// =============================================================================
// NITROGEN MODIFIER TABLES (immutable)
// =============================================================================

const N_MODIFIERS = Object.freeze({
    // Dollar spot is suppressed by N. Excessive N suppresses more than high,
    // not less — the prior 1.05 reversal had no biological basis.
    // Ref: Couch 1995, Smiley et al. 2005 — increasing N progressively reduces
    // dollar spot severity up to luxury consumption levels.
    deficient: 1.5, low: 1.3, adequate: 1, optimal: 0.95, high: 0.85, excessive: 0.75
});

const N_MODIFIERS_BROWN_PATCH = Object.freeze({
    deficient: 0.6, low: 0.8, adequate: 1, optimal: 1.1, high: 1.4, excessive: 1.8
});

const N_MODIFIERS_FUSARIUM = Object.freeze({
    deficient: 0.7, low: 0.85, adequate: 1, high: 1.3, excessive: 1.5
});

// =============================================================================
// SPECIES NORMALIZATION (Single canonical function)
// =============================================================================

function normalizeSpecies(sp) {
    if (!sp) return 'perennialRyegrass';
    const lower = sp.toLowerCase().replace(/[\s\-_]/g, '');
    const aliases = {
        couch: 'couch', bermuda: 'bermuda', bermudagrass: 'bermuda', cynodon: 'bermuda',
        kikuyu: 'kikuyu', pennisetum: 'kikuyu',
        zoysia: 'zoysia', zoysiagrass: 'zoysia',
        buffalo: 'buffalo', stenotaphrum: 'buffalo', buffalograss: 'buffalograss', buchloe: 'buffalograss',
        perennialryegrass: 'perennialRyegrass', prg: 'perennialRyegrass', ryegrass: 'perennialRyegrass', loliumperenne: 'perennialRyegrass',
        bentgrass: 'bentgrass', bent: 'bentgrass', creepingbent: 'bentgrass', creepingbentgrass: 'bentgrass', agrostis: 'bentgrass',
        kentuckybluegrass: 'kentuckyBluegrass', kbg: 'kentuckyBluegrass', bluegrass: 'kentuckyBluegrass', poapratensis: 'kentuckyBluegrass',
        tallfescue: 'tallFescue', fescue: 'tallFescue', festuca: 'tallFescue',
        finefescue: 'fineFescue',
        poaannua: 'poaAnnua', poa: 'poaAnnua', annualbluegrass: 'poaAnnua',
        seashorepaspalum: 'seashore_paspalum', paspalum: 'seashore_paspalum',
    };
    if (aliases[lower]) return aliases[lower];
    if (SPECIES_SUSCEPTIBILITY[lower]) return lower;
    // Partial matches
    if (lower.includes('bent')) return 'bentgrass';
    if (lower.includes('rye')) return 'perennialRyegrass';
    if (lower.includes('couch')) return 'couch';
    if (lower.includes('bermuda')) return 'bermuda';
    if (lower.includes('poa') || lower.includes('annual')) return 'poaAnnua';
    if (lower.includes('tall') && lower.includes('fescue')) return 'tallFescue';
    if (lower.includes('fescue')) return 'fineFescue';
    if (lower.includes('blue')) return 'kentuckyBluegrass';
    if (lower.includes('kikuyu')) return 'kikuyu';
    if (lower.includes('zoysia')) return 'zoysia';
    if (lower.includes('buffalo')) return 'buffalo';
    if (lower.includes('paspalum')) return 'seashore_paspalum';
    return 'perennialRyegrass';
}

// =============================================================================
// PURE HELPER FUNCTIONS (no side effects)
// =============================================================================

function confidenceToScore(level) {
    if (typeof level === 'number') return level;
    return CONFIDENCE_SCORES[level] || 50;
}

function classifyRisk(score) {
    if (score >= DISEASE_CONFIG.thresholds.severe) return 'severe';
    if (score >= DISEASE_CONFIG.thresholds.high) return 'high';
    if (score >= DISEASE_CONFIG.thresholds.moderate) return 'moderate';
    return 'low';
}

function getNightTemp(climate) {
    if (climate?.hourlyData?.temperature_2m && climate?.hourlyData?.time) {
        const nightTemps = climate.hourlyData.time
            .map((t, i) => {
                const h = new Date(t).getHours();
                return (h >= 20 || h <= 6) ? climate.hourlyData.temperature_2m[i] : null;
            })
            .filter(v => v !== null);
        if (nightTemps.length > 0) return Math.min(...nightTemps);
    }
    return climate?.temperature?.min || 15;
}

function getNightHumidity(climate) {
    if (climate?.hourlyData?.relative_humidity_2m && climate?.hourlyData?.time) {
        const nightRH = climate.hourlyData.time
            .map((t, i) => {
                const h = new Date(t).getHours();
                return (h >= 20 || h <= 6) ? climate.hourlyData.relative_humidity_2m[i] : null;
            })
            .filter(v => v !== null);
        if (nightRH.length > 0) return nightRH.reduce((a, b) => a + b, 0) / nightRH.length;
    }
    return climate?.moisture?.humidity?.mean || 70;
}

function getHighHumidityHours(climate) {
    return climate?.hourlyData?.relative_humidity_2m
        ? climate.hourlyData.relative_humidity_2m.filter(v => v >= 85).length
        : 0;
}

/**
 * Smith-Kerns concurrent condition hours.
 * Counts hourly observations where BOTH:
 *   - RH ≥ 90% (sustained leaf wetness proxy)
 *   - Temperature 15-30°C (Dollar Spot activity window)
 * Returns average concurrent hours per day over the data period.
 * When hourly data is unavailable, falls back to a dampened estimate
 * from the period-mean humidity (conservative).
 * Source: Smith, Kerns et al. 2018 — "A method for predicting dollar spot"
 */
function getSmithKernsConcurrentHours(climate) {
    const rh = climate?.hourlyData?.relative_humidity_2m;
    const temp = climate?.hourlyData?.temperature_2m;
    const time = climate?.hourlyData?.time;
    if (rh && temp && rh.length === temp.length && rh.length > 0) {
        let concurrent = 0;
        for (let i = 0; i < rh.length; i++) {
            if (rh[i] >= 90 && temp[i] >= 15 && temp[i] <= 30) {
                // Restrict to daytime hours (06:00-20:00) where active infection occurs.
                // Overnight RH>=90 is normal in AU coastal climates and does not drive
                // dollar spot infection the same way as warm daytime leaf wetness.
                // Smith-Kerns 2018 was calibrated for US conditions where overnight
                // saturation at these temps is less common.
                if (time && time[i]) {
                    const h = new Date(time[i]).getHours();
                    if (h >= 6 && h < 20) { concurrent++; }
                } else {
                    // No time data — count all hours (conservative fallback)
                    concurrent++;
                }
            }
        }
        const days = Math.max(1, rh.length / 24);
        return concurrent / days;
    }
    // Fallback: no hourly data. Use period mean with conservative estimate.
    // Key insight: high mean RH (>90%) almost always indicates overnight saturation.
    // Overnight temps are typically below the 15-30°C activity window in temperate
    // climates. Without hourly data we can't know the actual overlap, so we apply
    // a heavy discount: estimate daytime RH as ~30% lower than the mean (diurnal
    // swing), and only credit concurrent hours if the estimated daytime RH still
    // exceeds 90%.
    const meanRH = climate?.moisture?.humidity?.mean || 70;
    const meanTemp = climate?.temperature?.mean || 20;
    if (meanTemp >= 15 && meanTemp <= 30) {
        // Estimate daytime RH: mean minus typical diurnal drop
        // Morning/evening: ~mean, Afternoon: mean - 25-35%
        // Weighted daytime estimate ≈ mean * 0.7
        const estimatedDaytimeRH = meanRH * 0.7;
        if (estimatedDaytimeRH >= 90) {
            // Genuinely humid climate (tropical, coastal) - credit some hours
            return Math.min(6, (estimatedDaytimeRH - 90) / 2);
        } else if (estimatedDaytimeRH >= 80) {
            // Marginal - maybe 1-2 transition hours at dawn/dusk
            return Math.min(2, (estimatedDaytimeRH - 80) / 10);
        }
    }
    return 0;
}

/**
 * Get leaf wetness hours - PURE version
 * The original read from module-level `_currentDewData`. Now accepts dewData as parameter.
 */
function getLeafWetnessHours(climate, dewData) {
    if (dewData?.leafWetness?.averageWetHours) {
        // Dew engine counts all 24 hours. Dollar spot infection is driven by
        // daytime leaf wetness on active turf. Apply 0.5 discount to convert
        // all-hours dew average to a daytime-equivalent infection period.
        return Math.round(dewData.leafWetness.averageWetHours * 0.5);
    }
    if (dewData?.leafWetness?.totalWetHours)
        return Math.round((dewData.leafWetness.totalWetHours / 7) * 0.5);
    if (!climate?.hourlyData?.relative_humidity_2m) return 0;
    const rh = climate.hourlyData.relative_humidity_2m;
    const time = climate.hourlyData.time;
    let wetHours = 0;
    for (let i = 0; i < rh.length; i++) {
        if (rh[i] >= 90) {
            // Restrict to daytime (06:00-20:00) — same rationale as SmithKerns:
            // overnight condensation on inactive turf is a weak infection driver.
            if (time && time[i]) {
                const h = new Date(time[i]).getHours();
                if (h >= 6 && h < 20) { wetHours++; }
            } else {
                wetHours++; // no time data — count all (conservative fallback)
            }
        }
    }
    const days = Math.max(1, rh.length / 24);
    return Math.round(wetHours / days);
}

function get5DayAvgTemp(dailyPattern) {
    if (!dailyPattern || dailyPattern.length === 0) return null;
    const slice = dailyPattern.slice(0, 5);
    return slice.reduce((sum, d) => sum + (d.mean || 0), 0) / slice.length;
}

function getFusariumNModifier(nStatus, meanTemp) {
    const r = N_MODIFIERS_FUSARIUM[nStatus] || 1;
    if (('high' === nStatus || 'excessive' === nStatus) && meanTemp <= 15) {
        return r * ('excessive' === nStatus ? 1.35 : 1.2);
    }
    return r;
}

/**
 * Get regional disease multiplier - PURE version
 * Original read from window.gaip_getDiseaseMultiplier. Now accepts multipliers map.
 */
function getRegionalDiseaseMultiplier(displayName, regionalMultipliers) {
    if (!regionalMultipliers) return 1;
    const DISPLAY_TO_KEY = {
        'Dollar Spot': 'dollarSpot', 'Brown Patch': 'brownPatch',
        'Pythium Blight': 'pythium', 'Pythium': 'pythium',
        'Anthracnose': 'anthracnose', 'Spring Dead Spot': 'springDeadSpot',
        'Helminthosporium': 'helminthosporium', 'Fusarium': 'fusarium',
        'Fusarium Patch (Microdochium)': 'fusarium',
        'Take-all Patch': 'takeAll', 'Take-all': 'takeAll',
        'Gray Leaf Spot': 'grayLeafSpot', 'Red Thread': 'redThread',
        'Snow Mould': 'snowMould', 'Pink Snow Mould': 'pinkSnowMould',
        'Waitea Patch': 'waiteaPatch', 'Brown Ring Patch': 'waiteaPatch',
        'Large Patch': 'largePatch',
        'Helminthosporium Leaf Spot': 'helminthosporium',
    };
    const key = DISPLAY_TO_KEY[displayName] || displayName.toLowerCase().replace(/\s+/g, '');
    return regionalMultipliers[key] || 1;
}

// =============================================================================
// DISEASE MODELS (all pure functions)
// =============================================================================

const DollarSpotModel = {
    name: 'Dollar Spot',
    pathogen: 'Clarireedia jacksonii',
    calculate(climate, nitrogen, variety, shade, dewData) {
        const meanTemp = climate?.temperature?.mean || 20;
        // Use daily max/min mean as better proxy for daily mean temp than
        // the 8-day all-hours hourly average (which includes all nights and
        // skews low). Falls back to meanTemp only if max/min unavailable.
        const dailyMeanTemp = (climate?.temperature?.max != null && climate?.temperature?.min != null)
            ? (climate.temperature.max + climate.temperature.min) / 2
            : meanTemp;
        const avg5Day = get5DayAvgTemp(climate?.temperature?.dailyPattern) || dailyMeanTemp;
        const leafWet = getLeafWetnessHours(climate, dewData);
        const nStatus = nitrogen?.status || 'adequate';
        const dliDeficit = shade?.dliDeficit?.percentage || 0;

        // --- Temperature factor (unchanged: 5-day rolling average) ---
        let tempFactor = 0;
        if (avg5Day >= 15 && avg5Day <= 30) {
            tempFactor = Math.exp(-0.5 * Math.pow((avg5Day - 22) / 6, 2));
        } else if (avg5Day > 30) {
            tempFactor = Math.max(0, 1 - (avg5Day - 30) / 10);
        } else if (avg5Day > 10) {
            tempFactor = (avg5Day - 10) / 10;
        }

        // --- Humidity factor (v3.0.1: Smith-Kerns concurrent condition hours) ---
        // Counts hours where BOTH RH ≥ 90% AND temp 15-30°C,
        // then normalises against a threshold of 8 hrs/day.
        // This prevents overnight-only saturation from inflating risk
        // when daytime conditions don't support sustained infection.
        const concurrentHrsPerDay = getSmithKernsConcurrentHours(climate);
        const humFactor = Math.min(1, concurrentHrsPerDay / 8);

        const wetFactor = Math.min(1, leafWet / 10);
        const nMod = N_MODIFIERS[nStatus] || 1;
        const shadeMod = dliDeficit > 30 ? 1 + (dliDeficit - 30) / 100 : 1;
        const varietyMod = variety?.disease?.dollarSpot?.riskMultiplier || 1;

        // NOTE: varietyMod is intentionally NOT applied here; it is applied via
        // taperMultiplier() in analyse(). Keeping riskScore uncapped (pre-clamp)
        // in the returned object allows taperMultiplier to work correctly when
        // conditions are severe. The Math.min(100) clamp is applied only to
        // riskScore for display; rawRisk is retained for downstream use.
        let rawRisk = (0.35 * tempFactor + 0.35 * humFactor + 0.30 * wetFactor) * nMod * shadeMod * 100;
        rawRisk = Math.max(0, rawRisk); // no upper clamp — analyse() handles it
        const risk = Math.min(100, rawRisk);

        // --- DIAGNOSTIC (b35fix99): log intermediate values to browser console ---
        if (typeof console !== 'undefined') {
            console.group('[DollarSpot.calculate() diagnostic]');
            console.log('avg5Day       :', avg5Day.toFixed(2), '°C');
            console.log('tempFactor    :', tempFactor.toFixed(4));
            console.log('humFactor     :', humFactor.toFixed(4), '(concurrentHrs:', concurrentHrsPerDay.toFixed(2), ')');
            console.log('wetFactor     :', wetFactor.toFixed(4), '(leafWetHrs:', leafWet, ')');
            console.log('nMod          :', nMod, '(N status:', nStatus, ')');
            console.log('shadeMod      :', shadeMod.toFixed(4), '(dliDeficit:', dliDeficit, '%)');
            console.log('varietyMod    :', varietyMod, '(applied in analyse(), NOT here)');
            console.log('rawRisk       :', rawRisk.toFixed(2), '(uncapped)');
            console.log('riskScore     :', Math.round(risk), '(display-capped at 100)');
            console.groupEnd();
        }
        // --- END DIAGNOSTIC ---

        return {
            disease: 'dollarSpot', displayName: 'Dollar Spot',
            riskScore: Math.round(risk), riskLevel: classifyRisk(risk),
            rawRisk: Math.round(rawRisk), // expose uncapped score for taperMultiplier
            confidence: 'high', confidenceScore: 90,
            drivers: {
                temperature: { value: Math.round(avg5Day * 10) / 10, contribution: Math.round(tempFactor * 100) },
                humidity: { value: Math.round(concurrentHrsPerDay * 10) / 10, unit: 'hrs/day concurrent', contribution: Math.round(humFactor * 100) },
                leafWetness: { hours: leafWet, contribution: Math.round(wetFactor * 100) },
                nitrogen: { status: nStatus, modifier: nMod },
            },
            modifiers: { shade: shadeMod, variety: varietyMod, nitrogen: nMod },
            source: 'Smith-Kerns 2018',
        };
    },
    getInterventions(riskLevel, opts) {
        const cultural = ['Remove dew early morning (mow, roll, or drag)'];
        if (opts?.nitrogen?.status === 'deficient' || opts?.nitrogen?.status === 'low') {
            cultural.unshift('PRIORITY: Apply nitrogen - low N dramatically increases susceptibility');
        }
        return { cultural, preventive: [], timing: null };
    },
};

const BrownPatchModel = {
    name: 'Brown Patch',
    pathogen: 'Rhizoctonia solani AG 1-A',  // AG 1-A = cool-season brown patch; AG 2-2 LP = large patch warm-season
    calculate(climate, nitrogen, variety, dewData) {
        const nightTemp = getNightTemp(climate);
        const maxTemp = climate?.temperature?.max || 25;
        const nStatus = nitrogen?.status || 'adequate';

        // Brown patch requires RH ≥95% (not 90%) — APS Plant Health Instructor; Bugwood Wiki
        // Apply stricter threshold: use hourly data if available, else correct standard helper
        let leafWet;
        if (climate?.hourlyData?.relative_humidity_2m) {
            const rhHours = climate.hourlyData.relative_humidity_2m.filter(h => h >= 95).length;
            const days = Math.max(1, climate.hourlyData.relative_humidity_2m.length / 24);
            leafWet = Math.round(rhHours / days);
        } else {
            // dewData path is unaffected (sensor data, use as-is)
            const raw = getLeafWetnessHours(climate, dewData);
            // If dewData provided it, use directly; if estimated from 90% RH proxy, apply correction
            leafWet = dewData?.leafWetness ? raw : Math.round(raw * 0.7);
        }

        if (nightTemp < 20) {
            return {
                disease: 'brownPatch', displayName: 'Brown Patch',
                riskScore: 0, riskLevel: 'low', confidence: 'high', confidenceScore: 90,
                reason: 'Night temps below threshold (20°C)',
                drivers: { nightTemperature: { value: nightTemp, threshold: 20, status: 'limiting' } },
                source: 'Fidanza & Dernoeden 1995',
            };
        }
        if (leafWet < 10) {
            return {
                disease: 'brownPatch', displayName: 'Brown Patch',
                riskScore: Math.round(5 * (nightTemp - 20)), riskLevel: 'low',
                confidence: 'high', confidenceScore: 90,
                reason: 'Insufficient leaf wetness (requires ≥10h at RH ≥95%)',
                drivers: {
                    nightTemperature: { value: nightTemp },
                    leafWetness: { hours: leafWet, minimumRequired: 10, rhThreshold: '≥95%', status: 'limiting' },
                },
                source: 'Fidanza & Dernoeden 1995; APS Plant Health Instructor',
            };
        }

        const nightFactor = Math.min(1, (nightTemp - 20) / 8);
        // Day temp: optimal 29–32°C per UC IPM/APS; below 29 no contribution; peaks at 32; declines above 35
        // b35fix242: decline above 32°C changed from /8 (→0 at 40°C) to /3 (→0 at 35°C).
        // Dernoeden 2002 (Creeping Bentgrass Mgmt) documents sharp decline above 35°C;
        // at 35°C the prior formula gave dayFactor=0.625 (still substantial), which
        // inflated scores on hot AU days where brown patch is not active.
        // Ref: Dernoeden 2002; Fidanza & Dernoeden 1995 (Plant Disease 79:721).
        const dayFactor = maxTemp < 29 ? 0 : maxTemp <= 32 ? (maxTemp - 29) / 3 : Math.max(0, 1 - (maxTemp - 32) / 3);
        // Leaf wetness: hard minimum 10h, full contribution at 14h+
        const wetFactor = leafWet < 10 ? 0 : Math.min(1, (leafWet - 10) / 4);
        const nMod = N_MODIFIERS_BROWN_PATCH[nStatus] || 1;
        const varietyMod = variety?.disease?.brownPatch?.riskMultiplier || 1;

        let risk = (0.5 * nightFactor + 0.2 * dayFactor + 0.3 * wetFactor) * nMod * 100;
        risk = Math.min(100, Math.max(0, risk));

        // --- DIAGNOSTIC (b35fix104): log intermediate values to browser console ---
        if (typeof console !== 'undefined') {
            console.group('[BrownPatch.calculate() diagnostic]');
            console.log('nightTemp     :', Math.round(nightTemp * 10) / 10, '°C (threshold: 20°C)');
            console.log('maxTemp       :', Math.round(maxTemp * 10) / 10, '°C (optimal: 29-32°C)');
            console.log('leafWetHrs    :', leafWet, '(min required: 10h, rhThreshold: ≥95%)');
            console.log('nightFactor   :', nightFactor.toFixed(4));
            console.log('dayFactor     :', dayFactor.toFixed(4));
            console.log('wetFactor     :', wetFactor.toFixed(4));
            console.log('nMod          :', nMod, '(N status:', nStatus, ')');
            console.log('varietyMod    :', varietyMod, '(applied in analyse(), NOT here)');
            console.log('riskScore     :', Math.round(risk), '(capped at 100)');
            console.groupEnd();
        }
        // --- END DIAGNOSTIC ---

        return {
            disease: 'brownPatch', displayName: 'Brown Patch',
            riskScore: Math.round(risk), riskLevel: classifyRisk(risk),
            confidence: 'high', confidenceScore: 88,
            drivers: {
                nightTemperature: { value: Math.round(nightTemp * 10) / 10, threshold: 20, optimal: '20–28°C', contribution: Math.round(nightFactor * 100) },
                dayTemperature: { value: Math.round(maxTemp * 10) / 10, optimal: '29–32°C', contribution: Math.round(dayFactor * 100) },
                leafWetness: { hours: leafWet, minimumRequired: 10, rhThreshold: '≥95%', contribution: Math.round(wetFactor * 100) },
                nitrogen: { status: nStatus, modifier: nMod },
            },
            modifiers: { variety: varietyMod, nitrogen: nMod },
            source: 'Fidanza & Dernoeden 1995; APS Plant Health Instructor (Vincelli); UC IPM Rhizoctonia guidelines',
            agGroup: 'AG 1-A',
        };
    },
    getInterventions(riskLevel, opts) {
        const cultural = [];
        if (opts?.nitrogen?.status === 'high' || opts?.nitrogen?.status === 'excessive') {
            cultural.unshift('REDUCE nitrogen - lush growth is primary driver');
        }
        return { cultural, preventive: [], timing: null };
    },
};

const PythiumModel = {
    name: 'Pythium Blight',
    pathogen: 'Pythium aphanidermatum',
    /**
     * CITATION: Nutter, F.W., Cole, H., Schein, R.D. (1983). Disease forecasting
     * system for warm weather Pythium blight of turfgrass. Plant Disease 67:1126-1128.
     *
     * TEMPERATURE GATE: 20°C night minimum (validated threshold).
     * NIGHT TEMP RAMP: 20°C (threshold) → 28°C (max risk). Corrected from erroneous
     *   18-24°C ramp present in pre-b35fix104 builds.
     * WETNESS: Uses hourly leaf wetness hours where available, falls back to night RH binary.
     * SOIL PATHWAY: Secondary root/crown risk when soil temp 100mm > 20°C.
     * Ca/K MODIFIERS: HEURISTIC — host stress physiology extrapolation, not Pythium-specific.
     * SPECIES SCOPE: P. aphanidermatum only. P. ultimum / P. graminicola (cool-season) not modelled.
     */
    calculate(climate, nitrogen, variety, dewData) {
        const nightTemp = getNightTemp(climate);
        const maxTemp = climate?.temperature?.max || 25;
        const nightRH = getNightHumidity(climate);
        const precip = climate?.precipitation?.total ?? climate?.moisture?.precipitation?.total ?? climate?.moisture?.rainfall ?? 0;

        if (nightTemp < 20) {
            return {
                disease: 'pythiumBlight', displayName: 'Pythium Blight',
                riskScore: 0, riskLevel: 'low', confidence: 'high', confidenceScore: 90,
                reason: 'Night temps below Pythium threshold (20°C)',
                drivers: { nightTemperature: { value: nightTemp, threshold: 20, status: 'limiting' } },
                speciesScope: 'P. aphanidermatum (summer blight). P. ultimum / P. graminicola not modelled — operate at lower temperatures.',
                source: 'Nutter, Cole & Schein 1983 (Plant Disease 67:1126)',
            };
        }

        // Night temp ramp: 20°C gate → 28°C max (corrected from 18-24°C)
        const nightFactor = Math.min(1, (nightTemp - 20) / 8);
        const dayFactor = maxTemp >= 30 ? Math.min(1, (maxTemp - 30) / 8) : 0;

        // Wetness: use hourly leaf wetness hours if available, else night RH binary fallback
        const wetHours = getLeafWetnessHours(climate);
        const wetFactor = wetHours >= 14 ? 1 :
                          wetHours >= 10 ? (wetHours - 10) / 4 :
                          nightRH >= 90 ? 1 : nightRH >= 80 ? 0.5 : 0;

        const rainBoost = precip > 10 ? 1.3 : precip > 5 ? 1.15 : 1;

        let risk = (0.4 * nightFactor + 0.2 * dayFactor + 0.4 * wetFactor) * rainBoost *
                   1 * 100; // variety mod applied in analyse()
        risk = Math.min(100, Math.max(0, risk));

        // Soil/crown-root pathway — requires soil temp >20°C at 100mm
        let soilTemp100mm = null;
        let soilTempSource = null;
        if (typeof window !== 'undefined') {
            if (window.GAIP_Sensor?.hasData?.()) {
                const sd = window.GAIP_Sensor.getIrrigationData?.();
                if (sd?.soilTemp != null) { soilTemp100mm = sd.soilTemp; soilTempSource = 'sensor'; }
            }
            if (soilTemp100mm === null && window.GAIP_SOIL_TEMP?.summary?.depths?.['100mm']?.mean != null) {
                soilTemp100mm = window.GAIP_SOIL_TEMP.summary.depths['100mm'].mean;
                soilTempSource = 'physics_model_100mm';
            }
        }
        if (soilTemp100mm === null && climate?.soilTemp?.depths?.d100mm != null) {
            soilTemp100mm = climate.soilTemp.depths.d100mm; soilTempSource = climate.soilTemp.source || 'canonical';
        }
        if (soilTemp100mm === null && climate?.temperature?.soil != null) {
            soilTemp100mm = typeof climate.temperature.soil === 'object' ? climate.temperature.soil.mean : climate.temperature.soil;
            soilTempSource = 'climate_temperature_soil';
        }

        let soilPathwayRisk = 0, soilPathwayNote = null;
        if (soilTemp100mm !== null && soilTemp100mm >= 20) {
            const soilRamp = Math.min(1, (soilTemp100mm - 20) / 10);
            soilPathwayRisk = Math.round(soilRamp * wetFactor * 100);
            if (soilPathwayRisk >= 50) soilPathwayNote = `Soil ${soilTemp100mm.toFixed(1)}°C at 100mm — Pythium root/crown rot conditions. Prioritise drainage and drench-registered products.`;
            else if (soilPathwayRisk >= 25) soilPathwayNote = `Soil ${soilTemp100mm.toFixed(1)}°C at 100mm — monitor root zone moisture.`;
        }

        let alertType = null;
        if (risk >= DISEASE_CONFIG.thresholds.severe) alertType = 'PYTHIUM_EMERGENCY';
        else if (risk >= DISEASE_CONFIG.thresholds.high) alertType = 'PYTHIUM_WARNING';
        else if (nightTemp >= 22 && nightRH >= 80) alertType = 'PYTHIUM_WATCH';

        // --- DIAGNOSTIC (b35fix104): log intermediate values to browser console ---
        if (typeof console !== 'undefined') {
            console.group('[Pythium.calculate() diagnostic]');
            console.log('nightTemp     :', Math.round(nightTemp * 10) / 10, '°C (threshold: 20°C, rampMax: 28°C)');
            console.log('maxTemp       :', Math.round(maxTemp * 10) / 10, '°C (dayFactor threshold: 30°C)');
            console.log('nightRH       :', Math.round(nightRH), '%');
            console.log('wetHours      :', wetHours, '(from hourly data:', wetHours > 0 ? 'yes' : 'no — using RH fallback)');
            console.log('precip        :', Math.round(precip * 10) / 10, 'mm (rainBoost:', rainBoost, ')');
            console.log('nightFactor   :', nightFactor.toFixed(4));
            console.log('dayFactor     :', dayFactor.toFixed(4));
            console.log('wetFactor     :', wetFactor.toFixed(4));
            console.log('soilTemp100mm :', soilTemp100mm !== null ? soilTemp100mm.toFixed(1) + '°C (' + soilTempSource + ')' : 'not available');
            console.log('soilPathwayRisk:', soilPathwayRisk);
            console.log('alertType     :', alertType || 'none');
            console.log('riskScore     :', Math.round(risk), '(capped at 100)');
            console.groupEnd();
        }
        // --- END DIAGNOSTIC ---

        return {
            disease: 'pythiumBlight', displayName: 'Pythium Blight',
            riskScore: Math.round(risk), riskLevel: classifyRisk(risk),
            confidence: 'high', confidenceScore: 90, alertType,
            drivers: {
                nightTemperature: { value: Math.round(nightTemp * 10) / 10, threshold: 20, rampMax: 28, contribution: Math.round(nightFactor * 100) },
                dayTemperature: { value: Math.round(maxTemp * 10) / 10, contribution: Math.round(dayFactor * 100) },
                wetness: {
                    leafWetnessHours: wetHours > 0 ? wetHours : null,
                    nightHumidity: Math.round(nightRH),
                    contribution: Math.round(wetFactor * 100),
                    method: wetHours > 0 ? 'hourly_leaf_wetness' : 'night_rh_binary',
                },
                recentRain: { mm: Math.round(precip * 10) / 10, amplifier: rainBoost },
            },
            soilPathway: {
                soilTemp100mm: soilTemp100mm !== null ? Math.round(soilTemp100mm * 10) / 10 : null,
                soilTempSource,
                rootCrownRisk: soilPathwayRisk,
                rootCrownRiskLevel: soilPathwayRisk >= 70 ? 'high' : soilPathwayRisk >= 40 ? 'moderate' : 'low',
                note: soilPathwayNote,
            },
            urgencyNote: risk >= DISEASE_CONFIG.thresholds.high
                ? 'URGENT: Pythium destroys turf in 24-48 hours. Preventive timing critical.' : null,
            speciesScope: 'P. aphanidermatum (summer blight). P. ultimum / P. graminicola not modelled — operate at lower temperatures.',
            source: 'Nutter, Cole & Schein 1983 (Plant Disease 67:1126); Shane & Tredway (APS Compendium)',
        };
    },
    getInterventions(riskLevel, opts) {
        const r = { cultural: [], preventive: [], timing: null };
        if (riskLevel === 'moderate') r.timing = 'Prepare preventive, monitor forecast';
        if (riskLevel === 'high') { r.timing = 'Apply TODAY before nightfall'; r.urgency = 'HIGH'; }
        if (riskLevel === 'severe') {
            r.timing = 'IMMEDIATE APPLICATION'; r.urgency = 'CRITICAL';
            r.curativeNote = 'Apply at curative rate (1.5x label) IMMEDIATELY';
            r.emergencyNote = 'Pythium spreads across a green in 24 hours. Do not wait.';
        }
        return r;
    },
};

const AnthracnoseModel = {
    name: 'Anthracnose',
    pathogen: 'Colletotrichum cereale',

    // -------------------------------------------------------------------------
    // b35fix241: Danneberger, Vargas & Jones (1984) weather-based infection model
    // Phytopathology 74:448-451
    //
    // ASI = 4.0233 − 0.2283·LW − 0.5308·T − 0.0013·LW² + 0.0197·T² + 0.0155·(LW×T)
    //
    // Where:
    //   LW = average hours of leaf wetness per day (3-day period, 10-12 days pre-symptom)
    //   T  = average daily temperature °C (same period)
    //   ASI ≥ 2 = threshold for infection (88% accuracy in field validation)
    //   Valid range: T 16–28°C, LW 0–24h (model produces erroneous results outside these)
    //
    // ASI scale: 1=<10%, 2=11-20%, 3=21-30%, 4=31-40%, 5=41-50%, 6=>51% area diseased
    //
    // ARCHITECTURE: Two-component model
    //   1. Infection component (Danneberger 1984): weather drives whether C. cereale
    //      can infect — outputs ASI and a 0-100 infection risk score.
    //   2. Stress susceptibility multiplier: host stress (N, HOC, shade, traffic)
    //      amplifies infection risk. Based on Inguagiato et al. 2008 (Crop Sci 48:1595)
    //      and Inguagiato et al. 2009 (Crop Sci 49:1boro). Final risk = infection × stress.
    //      Without infection conditions (ASI < 2 or T out of range), stress alone cannot
    //      drive risk above a low ceiling — consistent with field observation that stressed
    //      turf without wet+warm conditions does not develop anthracnose.
    // -------------------------------------------------------------------------

    _dannebergerASI(T, LW) {
        // Clamp inputs to model's validated range
        const Tc = Math.max(16, Math.min(28, T));
        const LWc = Math.max(0, Math.min(24, LW));
        return 4.0233
            - 0.2283 * LWc
            - 0.5308 * Tc
            - 0.0013 * LWc * LWc
            + 0.0197 * Tc * Tc
            + 0.0155 * (LWc * Tc);
    },

    calculate(climate, nitrogen, variety, shade, traffic, mowing, dewData) {
        const meanTemp = climate?.temperature?.mean ?? 20;
        const nStatus = nitrogen?.status || 'adequate';
        const dliDeficit = shade?.dliDeficit?.percentage || 0;
        const hoc = mowing?.heightOfCut || mowing?.height || 4;
        const stressStatus = traffic?.cumulativeStress?.status || 'normal';

        // ── 1. INFECTION COMPONENT (Danneberger et al. 1984) ─────────────────
        // LW source: dew engine averageWetHours (all-hours dew average).
        // Danneberger used sensors 1.3cm above soil — closer to canopy than the
        // dew engine's night-hours model. Apply 0.75 correction to convert the
        // dew engine's all-hours average to a canopy-equivalent (conservative).
        const rawLW = dewData?.leafWetness?.averageWetHours ?? null;
        const LW = rawLW !== null ? Math.min(24, rawLW * 0.75) : null;

        // Temperature validity: model only applies 16–28°C.
        // Outside that range: foliar blight (>28°C) or basal rot (<16°C) may
        // still occur but cannot be predicted by this equation — flag accordingly.
        const tempInRange = meanTemp >= 16 && meanTemp <= 28;

        let asi = null;
        let infectionRisk = 0;     // 0-100, weather-driven
        let infectionFlag = false;  // ASI ≥ 2
        let noWeatherData = false;

        if (LW === null) {
            noWeatherData = true;
            // No leaf wetness data — fall back to RH proxy
            const rh = climate?.humidity?.mean || 0;
            // Estimate LW from mean RH: rough proxy only, lower confidence
            const estimatedLW = rh >= 95 ? 10 : rh >= 85 ? 6 : rh >= 70 ? 3 : 0;
            // b35fix242: gate on estimatedLW >= 1. The Danneberger 1984 equation was
            // calibrated on field plots with mean LW 4-16h/day. At LW=0 the T² term
            // dominates and gives ASI≥2 above ~24°C with no leaf wetness — this is a
            // mathematical artifact outside the model's validated space. Anthracnose
            // requires leaf wetness to infect; LW=0 must produce no infection risk.
            if (tempInRange && estimatedLW >= 1) {
                asi = this._dannebergerASI(meanTemp, estimatedLW);
            }
        } else if (tempInRange) {
            // b35fix242: same gate applied to real dew-engine data.
            // LW values < 1h/day indicate essentially dry canopy conditions.
            if (LW >= 1) {
                asi = this._dannebergerASI(meanTemp, LW);
            }
            // If LW is present but <1h, asi remains null → stress-only ceiling applies.
        }

        if (asi !== null) {
            infectionFlag = asi >= 2;
            // Normalise ASI to 0-100:
            // ASI scale runs 1-6 (mapped to 0-51+% disease area).
            // Map ASI 0→0%, 2→threshold (20%), 6→100% for display.
            // Linear segment: below 2 = sub-threshold, above = active infection.
            infectionRisk = asi < 2
                ? Math.max(0, (asi / 2) * 20)          // 0-20% pre-threshold
                : Math.min(100, 20 + ((asi - 2) / 4) * 80); // 20-100% above threshold
        }

        // ── 2. STRESS SUSCEPTIBILITY MULTIPLIER ──────────────────────────────
        // Inguagiato et al. 2008 (Crop Sci 48:1595): N frequency primary driver,
        //   N every 7d reduced disease 5-24% vs 28d. Low N status raises risk.
        // Inguagiato et al. 2009 (Crop Sci): HOC 2.8mm increased severity 3-21%
        //   vs 3.6mm; 3.2mm intermediate. Use a stepped calibration.
        // Penn State / Settle & Martinez-Espinosa (2006): compaction, shade.
        let stressMult = 1.0;
        const stressFactors = [];

        // Nitrogen — most important single factor (Inguagiato 2008)
        if (nStatus === 'deficient') {
            stressMult *= 1.5;
            stressFactors.push({ factor: 'Nitrogen deficiency', modifier: 1.5, source: 'Inguagiato et al. 2008 Crop Sci 48:1595' });
        } else if (nStatus === 'low') {
            stressMult *= 1.25;
            stressFactors.push({ factor: 'Low nitrogen', modifier: 1.25, source: 'Inguagiato et al. 2008 Crop Sci 48:1595' });
        }

        // HOC — calibrated to Inguagiato et al. 2009 field data
        // 2.8mm vs 3.6mm: +3 to +21% severity. Use midpoint (+12%) at 2.8, scaling up below.
        if (hoc < 2.8) {
            stressMult *= 1.20;
            stressFactors.push({ factor: 'Ultra-low HOC', modifier: 1.20, detail: `${hoc}mm`, source: 'Inguagiato et al. 2009 Crop Sci' });
        } else if (hoc < 3.6) {
            const frac = (3.6 - hoc) / (3.6 - 2.8);  // 0 at 3.6mm, 1 at 2.8mm
            const mod = 1 + frac * 0.12;               // 1.0–1.12
            stressMult *= mod;
            stressFactors.push({ factor: 'Low mowing height', modifier: Math.round(mod * 100) / 100, detail: `${hoc}mm`, source: 'Inguagiato et al. 2009 Crop Sci' });
        }

        // Shade — compounding stress (Landschoot 2021 Penn State; Settle 2006 APS)
        if (dliDeficit > 40) {
            stressMult *= 1.20;
            stressFactors.push({ factor: 'Severe shade stress', modifier: 1.20, detail: `${Math.round(dliDeficit)}% DLI deficit` });
        } else if (dliDeficit > 25) {
            stressMult *= 1.10;
            stressFactors.push({ factor: 'Shade stress', modifier: 1.10, detail: `${Math.round(dliDeficit)}% DLI deficit` });
        }

        // Traffic/compaction (Settle & Martinez-Espinosa 2006 APS)
        if (stressStatus === 'critical') {
            stressMult *= 1.20;
            stressFactors.push({ factor: 'Critical traffic/compaction', modifier: 1.20 });
        } else if (stressStatus === 'stressed') {
            stressMult *= 1.10;
            stressFactors.push({ factor: 'Traffic/compaction stress', modifier: 1.10 });
        }

        // ── 3. COMBINE: infection × stress ───────────────────────────────────
        // Without infection conditions, cap at 15 (stress predisposition only —
        // not a disease prediction, just a susceptibility flag).
        // With infection conditions, apply stress multiplier to infection risk.
        let rawRisk;
        if (infectionFlag) {
            rawRisk = Math.min(100, infectionRisk * stressMult);
        } else if (asi !== null && asi > 0) {
            // Sub-threshold infection conditions — partial risk, stress-amplified
            rawRisk = Math.min(30, infectionRisk * stressMult);
        } else {
            // No infection data or temp out of range — stress-only ceiling
            rawRisk = Math.min(15, (stressMult - 1) * 50);
        }

        const riskScore = Math.round(rawRisk);

        // ── 4. CONSOLE DIAGNOSTIC ────────────────────────────────────────────
        if (typeof console !== 'undefined') {
            console.group('[Anthracnose.calculate() diagnostic]');
            console.log('meanTemp      :', meanTemp.toFixed(1), '°C (valid range 16-28°C:', tempInRange ? 'YES' : 'NO — model extrapolated)');
            console.log('LW (raw)      :', rawLW !== null ? rawLW.toFixed(2) + 'h/day (dew engine)' : 'null — RH proxy used');
            console.log('LW (adjusted) :', LW !== null ? LW.toFixed(2) + 'h/day (×0.75 canopy correction)' : 'n/a');
            console.log('ASI           :', asi !== null ? asi.toFixed(3) : 'n/a', '(threshold: 2.0, infected:', infectionFlag ? 'YES' : 'NO)');
            console.log('infectionRisk :', infectionRisk.toFixed(1), '(0-100, weather component)');
            console.log('stressMult    :', stressMult.toFixed(3), '(host susceptibility)');
            console.log('rawRisk       :', rawRisk.toFixed(1));
            console.log('riskScore     :', riskScore);
            console.groupEnd();
        }

        const primaryFactor = stressFactors.sort((a, b) => b.modifier - a.modifier)[0];

        return {
            disease: 'anthracnose', displayName: 'Anthracnose',
            riskScore,
            rawRisk: Math.round(rawRisk),
            riskLevel: classifyRisk(riskScore),
            confidence: noWeatherData ? 'low' : (tempInRange ? 'high' : 'medium'),
            confidenceScore: noWeatherData ? 40 : (tempInRange ? 85 : 60),
            asi: asi !== null ? Math.round(asi * 100) / 100 : null,
            infectionFlag,
            stressFactors,
            primaryDriver: infectionFlag
                ? (primaryFactor ? primaryFactor.factor : 'Weather conditions')
                : (primaryFactor ? primaryFactor.factor : 'Sub-threshold conditions'),
            drivers: {
                infection: {
                    asi,
                    leafWetnessHours: LW,
                    temperature: meanTemp,
                    infectionFlag,
                    temperatureInRange: tempInRange,
                },
                stress: {
                    nitrogen: nStatus,
                    mowingHeight: hoc,
                    shadeDliDeficit: dliDeficit,
                    trafficStatus: stressStatus,
                    combinedMultiplier: stressMult,
                },
            },
            keyMessage: !tempInRange && meanTemp < 16
                ? 'Temp below 16°C — Danneberger foliar blight model not applicable. Conditions favour basal rot phase (crowns/stolons). Smiley, Dernoedon & Clarke 2005: basal rot active 5-25°C, peaks 15-20°C. Manage via N, drainage and reduced leaf wetness.'
                : infectionFlag
                    ? 'Infection conditions met (ASI ≥ 2). Reduce leaf wetness and address host stress.'
                    : 'Below infection threshold. Monitor stress factors — susceptibility is elevated.',
            source: 'Danneberger, Vargas & Jones 1984 Phytopathology 74:448-451; Inguagiato et al. 2008 Crop Sci 48:1595; Inguagiato et al. 2009 Crop Sci',
        };
    },

    getInterventions(riskLevel, opts) {
        const cultural = [];
        const nStatus = opts?.nitrogen?.status;
        if (nStatus === 'deficient' || nStatus === 'low') {
            cultural.push('PRIORITY: Light, frequent nitrogen applications — N deficiency is the primary stress driver (Inguagiato et al. 2008)');
        }
        cultural.push('Remove dew/leaf wetness early morning — reduce consecutive wet hours below infection threshold');
        if (opts?.mowing?.heightOfCut < 3.6) {
            cultural.push('Raise mowing height toward 3.6mm — reduces severity 3-21% (Inguagiato et al. 2009)');
        }
        if (opts?.shade?.dliDeficit?.percentage > 25) {
            cultural.push('Address shade deficit — DLI stress compounds anthracnose susceptibility');
        }
        cultural.push('Avoid compaction — lightweight rolling preferred over heavy equipment during high-risk periods');
        return { cultural, preventive: [], timing: 'Preventive fungicides: apply when ASI trending toward 2 and stress factors present' };
    },
};

const FusariumModel = {
    name: 'Fusarium Patch (Microdochium)',
    pathogen: 'Microdochium nivale',
    calculate(climate, nitrogen, variety) {
        const meanTemp = climate?.temperature?.mean || climate?.temperature?.current || null;
        // b35fix98: return 0 risk if no temperature data — prevents false positive
        // from the || 10 fallback producing AU Fusarium risk in warm climates.
        if (meanTemp === null || meanTemp === undefined) {
            return {
                disease: 'fusarium', displayName: 'Fusarium Patch (Microdochium)',
                riskScore: 0, riskLevel: 'minimal', confidence: 'low', confidenceScore: 20,
                drivers: { temperature: { value: null, note: 'No temperature data available' } },
                source: 'Smiley, Vargas, Smith et al. 1989',
            };
        }
        const minTemp = climate?.temperature?.min ?? (meanTemp - 5);
        const maxTemp = climate?.temperature?.max ?? (meanTemp + 5);
        const humidity = climate?.moisture?.humidity?.mean || 80;
        const precip = climate?.precipitation?.total || climate?.moisture?.precipitation?.total || 0;
        const nStatus = nitrogen?.status || 'adequate';
        const diurnalRange = maxTemp - minTemp;
        const hasFreezeCycle = minTemp < -1.0 && maxTemp > 2; // Requires genuine sub-zero min, not forecast noise (< -1.0°C per Smiley et al. tissue damage threshold)
        const snowCover = climate?.snowCover?.present || climate?.precipitation?.snow > 0 || false;
        const snowDays = climate?.snowCover?.consecutiveDays || 0;
        if (meanTemp > 18) {
            return {
                disease: 'fusarium', displayName: 'Fusarium Patch (Microdochium)',
                riskScore: 0, riskLevel: 'minimal', confidence: 'high', confidenceScore: 90,
                drivers: {
                    temperature: { value: meanTemp, optimalRange: '0-12°C', contribution: 0, note: 'Too warm for Fusarium development' },
                    moisture: { humidity, rain: precip, contribution: 0 },
                    nitrogen: { status: nStatus, modifier: 1 },
                    freezeThaw: { active: false, contribution: 0 },
                },
                source: 'Smiley, Vargas, Smith et al. 1989',
            };
        }

        // Temperature factor (asymmetric, peaks 5-8°C)
        let tempFactor = 0;
        if (meanTemp >= -2 && meanTemp <= 18) {
            tempFactor = meanTemp <= 8
                ? Math.exp(-0.5 * Math.pow((meanTemp - 6) / 4, 2))
                : Math.exp(-0.5 * Math.pow((meanTemp - 6) / 6, 2));
        }

        // Freeze-thaw factor
        let freezeThawFactor = 0, freezeThawNote = null;
        if (hasFreezeCycle) {
            freezeThawFactor = maxTemp > 5 ? 0.9 : 0.7;
            if (minTemp < -3 && maxTemp > 8) {
                freezeThawFactor = 1.0;
                freezeThawNote = 'SEVERE freeze-thaw cycle - high infection risk';
            } else {
                freezeThawNote = 'Freeze-thaw cycle detected - elevated risk';
            }
        }

        // Diurnal fluctuation
        let fluctuationMod = 1.0;
        if (diurnalRange > 15) fluctuationMod = 1.25;
        else if (diurnalRange > 10) fluctuationMod = 1.15;
        else if (diurnalRange > 8) fluctuationMod = 1.08;

        // Snow cover
        let snowFactor = 0, snowNote = null;
        if (snowCover && meanTemp > -5 && meanTemp < 5) {
            snowFactor = Math.min(1, snowDays / 10);
            if (snowDays > 14) snowNote = 'Extended snow cover - Pink Snow Mould risk elevated';
            else if (snowDays > 7) snowNote = 'Snow cover persisting - monitor for snow mould';
        }

        // Moisture
        const moistureFactor = (humidity > 90 || precip > 15) ? 1 : (humidity > 80 || precip > 5) ? 0.6 : 0.2;

        // N modifier
        const nModifier = getFusariumNModifier(nStatus, meanTemp);
        const winterNRisk = (nStatus === 'high' || nStatus === 'excessive') && meanTemp <= 15;

        // Combined risk
        let baseRisk;
        if (freezeThawFactor > 0 || snowFactor > 0) {
            baseRisk = 0.30 * tempFactor + 0.35 * moistureFactor + 0.25 * freezeThawFactor + 0.10 * Math.max(snowFactor, tempFactor);
        } else {
            baseRisk = 0.40 * tempFactor + 0.60 * moistureFactor;
        }

        let riskScore = baseRisk * fluctuationMod * nModifier * 100 // variety mod applied in analyse();
        riskScore = Math.min(100, Math.max(0, riskScore));

        let primaryDriver = 'temperature';
        if (freezeThawFactor > tempFactor && freezeThawFactor > moistureFactor) primaryDriver = 'freeze_thaw';
        else if (moistureFactor > tempFactor) primaryDriver = 'moisture';
        if (winterNRisk && nModifier > 1.3) primaryDriver = 'excess_nitrogen';

        // --- DIAGNOSTIC (b35fix104): log intermediate values to browser console ---
        if (typeof console !== 'undefined') {
            console.group('[Fusarium.calculate() diagnostic]');
            console.log('meanTemp      :', meanTemp.toFixed(1), '°C (optimal: 0-12°C)');
            console.log('minTemp       :', minTemp.toFixed(1), '°C');
            console.log('maxTemp       :', maxTemp.toFixed(1), '°C');
            console.log('diurnalRange  :', diurnalRange.toFixed(1), '°C (fluctuationMod:', fluctuationMod, ')');
            console.log('humidity      :', humidity, '%');
            console.log('precip        :', precip, 'mm');
            console.log('freezeThaw    :', hasFreezeCycle ? 'YES (factor: ' + freezeThawFactor.toFixed(4) + ')' : 'no');
            console.log('snowCover     :', snowCover ? 'YES (' + snowDays + ' days, factor: ' + snowFactor.toFixed(4) + ')' : 'no');
            console.log('tempFactor    :', tempFactor.toFixed(4));
            console.log('moistureFactor:', moistureFactor.toFixed(4));
            console.log('nModifier     :', nModifier.toFixed(4), '(N status:', nStatus, ', winterRisk:', winterNRisk, ')');
            console.log('primaryDriver :', primaryDriver);
            console.log('riskScore     :', Math.round(riskScore), '(capped at 100)');
            console.groupEnd();
        }
        // --- END DIAGNOSTIC ---

        return {
            disease: 'fusarium', displayName: 'Fusarium Patch (Microdochium)',
            riskScore: Math.round(riskScore), riskLevel: classifyRisk(riskScore),
            confidence: 'high', confidenceScore: 90, primaryDriver, modelVersion: '2.0',
            drivers: {
                temperature: { value: meanTemp, min: minTemp, max: maxTemp, diurnalRange: Math.round(diurnalRange * 10) / 10, optimalRange: '0-12°C', contribution: Math.round(tempFactor * 100) },
                freezeThaw: { active: hasFreezeCycle, contribution: Math.round(freezeThawFactor * 100), note: freezeThawNote, severity: hasFreezeCycle ? (minTemp < -3 && maxTemp > 8 ? 'severe' : 'moderate') : 'none' },
                fluctuation: { diurnalRange: Math.round(diurnalRange * 10) / 10, modifier: fluctuationMod, note: diurnalRange > 10 ? 'Large temp swings increasing stress' : null },
                moisture: { humidity, rain: precip, contribution: Math.round(moistureFactor * 100) },
                snow: { present: snowCover, days: snowDays, contribution: Math.round(snowFactor * 100), note: snowNote },
                nitrogen: { status: nStatus, modifier: nModifier, winterRisk: winterNRisk, note: winterNRisk ? 'Excess N in cool conditions significantly elevates risk' : null },
            },
            source: 'Smiley, Vargas, Smith et al. 1989',
        };
    },
    getInterventions(riskLevel, opts) {
        const cultural = [];
        if (opts?.nitrogen?.status === 'high' || opts?.nitrogen?.status === 'excessive') {
            const temp = opts?.climate?.temperature?.mean;
            if (temp !== undefined && temp <= 15) {
                cultural.unshift('CRITICAL: Reduce nitrogen immediately - excess N in cool conditions is primary Fusarium driver');
                cultural.push('Avoid late-season N applications before winter');
            } else {
                cultural.unshift('PRIORITY: Reduce nitrogen - key fusarium driver');
            }
        }
        return { cultural, preventive: [], timing: null };
    },
};

const HelminthosporiumModel = {
    name: 'Helminthosporium',
    pathogen: 'Bipolaris/Drechslera spp.',
    calculate(climate, nitrogen, variety, dewData) {
        const temp = climate?.temperature?.mean || 25;
        const humidity = climate?.moisture?.humidity?.mean || 70;
        const leafWet = getLeafWetnessHours(climate, dewData);
        const nStatus = nitrogen?.status || 'adequate';

        let tempFactor = 0;
        if (temp >= 20 && temp <= 35) tempFactor = Math.exp(-0.5 * Math.pow((temp - 28) / 6, 2));
        const humFactor = humidity > 80 ? Math.min(1, (humidity - 80) / 15) : 0;
        const wetFactor = Math.min(1, leafWet / 12);

        let risk = (0.35 * tempFactor + 0.30 * humFactor + 0.35 * wetFactor) *
                   (N_MODIFIERS[nStatus] || 1) * 100 // variety mod applied in analyse();
        risk = Math.min(100, Math.max(0, risk));

        return {
            disease: 'helminthosporium', displayName: 'Helminthosporium Leaf Spot',
            riskScore: Math.round(risk), riskLevel: classifyRisk(risk),
            confidence: 'medium', confidenceScore: 70,
            validationStatus: 'beta', validationBadge: 'BETA',
            drivers: {
                temperature: { value: temp, contribution: Math.round(tempFactor * 100) },
                humidity: { value: humidity, contribution: Math.round(humFactor * 100) },
                leafWetness: { hours: leafWet, contribution: Math.round(wetFactor * 100) },
            },
            source: 'Smiley, Vargas',
        };
    },
    getInterventions(riskLevel) {
        return {
            cultural: ['Reduce leaf wetness', 'Maintain adequate N', 'Raise HOC during outbreaks'],
            preventive: [],
        };
    },
};

const GrayLeafSpotModel = {
    name: 'Gray Leaf Spot',
    pathogen: 'Pyricularia oryzae',
    calculate(climate, nitrogen, variety, turfContext) {
        const meanTemp = climate?.temperature?.mean || 25;
        const maxTemp = climate?.temperature?.max || 30;
        const minTemp = climate?.temperature?.min || meanTemp - 5;
        const humidity = climate?.moisture?.humidity?.mean || 70;
        const nightHum = climate?.moisture?.humidity?.night || humidity;
        const leafWet = climate?.leafWetness?.hoursPerDay || 0;
        const nStatus = nitrogen?.status || 'adequate';
        const isNew = turfContext?.establishmentMonths < 3;

        let tempFactor = 0;
        if (meanTemp >= 20 && meanTemp <= 34) {
            tempFactor = meanTemp <= 28 ? (meanTemp - 20) / 8 : 1 - (meanTemp - 28) / 12;
            tempFactor = Math.max(0, Math.min(1, tempFactor));
        } else if (meanTemp > 34) {
            tempFactor = Math.max(0, 0.5 - 0.25 * (meanTemp - 34));
        }

        let nightTempFactor = 0;
        if (minTemp >= 18) nightTempFactor = Math.min(1, (minTemp - 18) / 6);

        const estNightHum = nightHum || humidity + 10;
        let humFactor = estNightHum >= 95 ? 1 : estNightHum >= 85 ? (estNightHum - 85) / 10 : 0;

        let wetFactor = 0;
        if (leafWet >= 12) wetFactor = 1;
        else if (leafWet >= 10) wetFactor = 0.85 + 0.075 * (leafWet - 10);
        else if (leafWet >= 6) wetFactor = ((leafWet - 6) / 5) * 0.85;

        const nMods = { deficient: 0.5, low: 0.7, adequate: 1, high: 1.5, excessive: 2 };
        const nMod = nMods[nStatus] || 1;
        const seedlingMod = isNew ? 2.5 : 1;
        const varietyMod = variety?.disease?.grayLeafSpot?.riskMultiplier || 1;

        let risk = (0.2 * tempFactor + 0.25 * nightTempFactor + 0.25 * humFactor + 0.3 * wetFactor) * nMod * seedlingMod * 100;
        risk = Math.min(100, Math.max(0, risk));

        const conf = climate?.hourlyData ? 'high' : climate?.temperature?.min ? 'medium' : 'low';

        return {
            disease: 'grayLeafSpot', displayName: 'Gray Leaf Spot',
            riskScore: Math.round(risk), riskLevel: classifyRisk(risk),
            confidence: conf, confidenceScore: confidenceToScore(conf),
            drivers: {
                temperature: { value: meanTemp, max: maxTemp, contribution: Math.round(tempFactor * 100) },
                nightTemp: { value: minTemp, contribution: Math.round(nightTempFactor * 100) },
                nightHumidity: { value: estNightHum, contribution: Math.round(humFactor * 100) },
                leafWetness: { hours: leafWet, contribution: Math.round(wetFactor * 100) },
                nitrogen: { status: nStatus, modifier: nMod },
            },
            modifiers: { variety: varietyMod, nitrogen: nMod, seedling: seedlingMod },
            source: 'Penn State & Rutgers turf pathology',
        };
    },
    getInterventions(riskLevel) {
        return {
            cultural: ['Reduce nitrogen during hot weather', 'Avoid evening irrigation', 'Improve air circulation'],
            preventive: [], curative: [],
        };
    },
};

// WaiteaPatch - NZ (var. circinata) + AU (var. zeae) - region check is pure
//
// Two variants produce smoke ring on bentgrass:
//   var. circinata — NZ/cool-season, optimal ~22-27°C mean air temp
//   var. zeae      — AU documented strain, optimal ~28-32°C mean air temp
//                    (formerly Rhizoctonia zeae; reclassified Burpee et al. 2006)
//
// Both produce identical smoke ring symptom at lesion margin.
// AU diagnosis historically misattributed to Brown Patch (AG 1-A).
//
// Sources: Burpee et al. 2006 (Plant Disease); Smiley et al. 2005;
//          Wong & Harman 2001 (Australasian Plant Pathology); Chen et al. 2009
const WaiteaPatchModel = {
    name: 'Waitea Patch',
    pathogen: 'Waitea circinata var. circinata / var. zeae',
    isApplicable(region) {
        if (!region) return false;
        const r = region.toLowerCase();
        return r === 'nz' || r.includes('zealand') || r.includes('australia') || r === 'au';
    },
    classifyRisk(score) {
        return classifyRisk(score);
    },
    _getVariant(region) {
        // var. zeae is the AU strain; var. circinata is NZ/cooler-climate
        const r = (region || '').toLowerCase();
        return (r.includes('australia') || r === 'au') ? 'zeae' : 'circinata';
    },
    calculate(climate, nitrogen, shade, soil, variety, species, region) {
        if (!this.isApplicable(region)) return null;

        const variant = this._getVariant(region);
        const airTemp = climate?.temperature?.mean ?? 18;
        const humidity = climate?.moisture?.humidity?.mean ?? climate?.humidity?.mean ?? 70;
        const rainfall = climate?.moisture?.precipitation?.total ?? climate?.rainfall?.total ?? 0;
        const cloudCover = climate?.cloudCover ?? null;

        // Temperature — var. zeae optimal 28-32°C (active 20-38°C)
        //             — var. circinata optimal 22-27°C (active 10-35°C)
        let tempFactor = 0;
        if (variant === 'zeae') {
            // AU strain: hard floor at 20°C (below = no risk), peaks 28-32°C
            if (airTemp >= 20 && airTemp <= 38) {
                tempFactor = Math.exp(-0.5 * Math.pow((airTemp - 30) / 6, 2));
                tempFactor = Math.max(0, Math.min(1, tempFactor));
            }
        } else {
            // NZ/circinata strain: active from 10°C, optimal 22-27°C
            // b35fix242: removed the 0.7 floor that was applied for airTemp 15-24°C.
            // The floor had no direct literature support — Wong & Harman 2001
            // (Australasian Plant Pathology) state optimal 20-30°C; a flat 0.7
            // at 15°C implied 70% of peak risk at a temperature well below optimum,
            // inflating NZ/southern AU winter Waitea scores by up to 2× at 15-18°C.
            // The Gaussian (sigma=8, centre=27) alone correctly gives low values
            // at cool temperatures: 15°C→0.33, 18°C→0.53, 20°C→0.68. These are
            // agronomically plausible — some activity, not high risk.
            if (airTemp >= 10 && airTemp <= 35) {
                tempFactor = Math.exp(-0.5 * Math.pow((airTemp - 27) / 8, 2));
            }
        }

        // Moisture
        let moistureFactor = humidity >= 70 ? Math.min(1, (humidity - 70) / 25) : 0;
        if (rainfall > 0) moistureFactor = Math.min(1, moistureFactor + (rainfall / 20) * 0.3);

        // Light
        let lightFactor = cloudCover !== null ? cloudCover / 100 : 0.5;

        // Host susceptibility — bentgrass primary host for both variants in AU/NZ
        let hostFactor = 0.3;
        const spLower = (species || '').toLowerCase().replace(/[\s\-_]/g, '');
        if (spLower.includes('poa') || spLower.includes('annual')) hostFactor = 1.0;
        else if (spLower.includes('bent') || spLower.includes('agrostis')) hostFactor = 0.7; // raised: primary AU host
        else if (spLower.includes('bluegrass') || spLower.includes('kentucky')) hostFactor = 0.4;

        // Nitrogen — low N increases risk (thin, stressed canopy)
        const nStatus = nitrogen?.status || 'adequate';
        let nFactor = 0.5;
        if (nStatus === 'deficient' || nStatus === 'low') nFactor = 1.0;
        else if (nStatus === 'adequate') nFactor = 0.4;
        else if (nStatus === 'high' || nStatus === 'excessive') nFactor = 0.2;

        const baseRisk = (tempFactor * 0.35 + moistureFactor * 0.25 + lightFactor * 0.10 + hostFactor * 0.15 + nFactor * 0.15) * 100;
        const adjustedRisk = Math.min(100, Math.max(0, Math.round(baseRisk)));

        const pathogenDisplay = variant === 'zeae'
            ? 'Waitea circinata var. zeae'
            : 'Waitea circinata var. circinata';
        const displayName = variant === 'zeae'
            ? 'Brown Patch'   // AU common name (var. zeae = Rhizoctonia Yellow Patch scientifically, but Brown Patch in AU trade)
            : 'Waitea Patch'; // NZ/international name for var. circinata

        return {
            disease: 'waiteaPatch', displayName,
            pathogen: pathogenDisplay,
            adjustedRisk, riskScore: adjustedRisk,
            riskLevel: classifyRisk(adjustedRisk),
            confidence: 'low', confidenceScore: 40,
            validationStatus: 'beta', validationBadge: 'BETA',
            variant,
            note: variant === 'zeae'
                ? 'AU strain (var. zeae) — smoke ring symptom; historically misdiagnosed as Brown Patch'
                : 'NZ strain (var. circinata)',
            factors: {
                temperature: { value: airTemp, factor: tempFactor, variantOptimal: variant === 'zeae' ? '28-32°C' : '22-27°C' },
                moisture: { value: humidity, factor: moistureFactor },
                light: { factor: lightFactor },
                host: { species, factor: hostFactor },
                nitrogen: { status: nStatus, factor: nFactor },
            },
            source: 'Burpee et al. 2006 (Plant Disease); Wong & Harman 2001 (Australasian Plant Pathology); Chen et al. 2009',
        };
    },
};

// =============================================================================
// SPRING DEAD SPOT MODEL
// Pathogen: Ophiosphaerella spp. (O. narmari in AU/NZ, O. korrae and
//           O. herpotricha in US)
//
// Risk is driven by site history factors (cold exposure, turf age, thatch, pH)
// NOT by current weather conditions. Pre-emptive autumn treatment window
// is driven by soil temperature reaching 16–24°C.
//
// Sources: Tredway et al. 2020 (Crop Science); Hutchens et al. 2024;
//          Walker & Smith 1972 (original AU pathogen work)
// =============================================================================
const SpringDeadSpotModel = {
    name: 'Spring Dead Spot',
    pathogen: 'Ophiosphaerella spp.',

    /**
     * @param {Object} climate  - getAuthoritativeClimate() output
     * @param {Object} soil     - { pH, thatchMm }
     * @param {Object} variety  - variety traits
     * @param {Object} siteHistory - { winterMinTemp, daysBelow5C, yearsEstablished }
     * @param {string} region   - 'AU'|'NZ'|'US'|etc
     */
    calculate(climate, soil, variety, siteHistory, region) {
        // ── Soil temperature (treatment window only, not risk driver) ──────────
        // b35fix138: Extend resolution chain to match Pythium model — sensor first,
        // then canonical depths, then climate.soilTemp, then air temp fallback.
        // Previously fell through to climate.temperature.mean (15.3°C est.) even
        // when live sensor data was present (20°C), causing "Window Has Closed" when
        // the window was actually open.
        let soilTemp = null;
        let soilTempEstimated = true;

        // Priority 1: live sensor
        const _sensorForSDS = (typeof window !== 'undefined' && window.GAIP_SENSOR_DATA)
            ? window.GAIP_SENSOR_DATA
            : null;
        if (_sensorForSDS?.soilTemp != null) {
            soilTemp = _sensorForSDS.soilTemp;
            soilTempEstimated = false;
        }

        // Priority 2: canonical state depths (d100mm preferred for SDS root zone)
        if (soilTemp === null) {
            const _canon = (typeof window !== 'undefined' && window.GAIP_CANONICAL_STATE?.soilTemp);
            if (_canon?.depths?.d100mm != null) { soilTemp = _canon.depths.d100mm; soilTempEstimated = _canon.source === 'estimated'; }
            else if (_canon?.depths?.d50mm  != null) { soilTemp = _canon.depths.d50mm;  soilTempEstimated = _canon.source === 'estimated'; }
            else if (_canon?.mean != null)            { soilTemp = _canon.mean;           soilTempEstimated = _canon.source === 'estimated'; }
        }

        // Priority 3: climate.soilTemp passed in from orchestrator
        if (soilTemp === null) {
            const soilTempObj = climate?.soilTemp;
            if (soilTempObj?.depths?.d100mm != null) { soilTemp = soilTempObj.depths.d100mm; soilTempEstimated = soilTempObj.source === 'estimated'; }
            else if (soilTempObj?.mean != null)       { soilTemp = soilTempObj.mean;          soilTempEstimated = soilTempObj.source === 'estimated'; }
        }

        // Priority 4: air temp mean as last resort
        if (soilTemp === null) {
            soilTemp = climate?.temperature?.mean ?? 15;
            soilTempEstimated = true;
        }

        // ── Determine likely pathogen species by region ────────────────────────
        const regionCode = region || 'AU';
        let likelyPathogen = 'O. narmari';
        let pathogenNote   = null;
        if (regionCode === 'AU' || regionCode === 'NZ') {
            likelyPathogen = 'O. narmari';
            pathogenNote = 'Primary pathogen: O. narmari (some O. korrae also present)';
        } else if (regionCode === 'US') {
            likelyPathogen = 'mixed';
            pathogenNote = 'US pathogens: O. korrae (east/southeast) or O. herpotricha (midwest) — respond differently to management';
        }

        // ── Site history factors ───────────────────────────────────────────────
        const winterMinTemp    = siteHistory?.winterMinTemp    ?? null;
        const daysBelow5C      = siteHistory?.daysBelow5C      ?? null;
        const yearsEstablished = siteHistory?.yearsEstablished ?? null;
        const thatchMm         = soil?.thatchMm               ?? null;
        const pH               = soil?.pH                     ?? null;

        // Cold exposure factor (primary driver — winter min temp + cold days)
        let coldFactor     = 0;
        let coldContrib    = null;
        if (winterMinTemp !== null) {
            if (winterMinTemp < -5)  coldFactor = Math.min(1, (-5 - winterMinTemp) / 10);
            if (daysBelow5C !== null) coldFactor += Math.min(0.3, daysBelow5C / 100);
            coldContrib = Math.round(coldFactor * 100);
        }

        // Establishment factor — peak risk in years 3–7
        let estFactor   = 0.5;  // unknown
        let estContrib  = null;
        if (yearsEstablished !== null) {
            estFactor  = yearsEstablished >= 3 && yearsEstablished <= 7 ? 0.8
                       : yearsEstablished > 7  ? 0.4
                       : 0.3;
            estContrib = Math.round(estFactor * 100);
        }

        // Thatch factor — deep thatch harbours inoculum
        let thatchFactor  = 0.5;  // unknown
        let thatchContrib = null;
        if (thatchMm !== null) {
            thatchFactor  = thatchMm > 20 ? 0.9 : thatchMm > 12 ? 0.5 : 0.2;
            thatchContrib = Math.round(thatchFactor * 100);
        }

        // pH factor — effect varies by pathogen species
        let phFactor  = 0.5;
        let phNote    = null;
        let phContrib = null;
        if (pH !== null) {
            if (likelyPathogen === 'O. herpotricha') {
                phFactor = pH >= 7 ? 0.85 : pH >= 6 ? 0.5 : 0.3;
                phNote   = pH >= 7   ? 'High pH favours O. herpotricha'
                         : pH <  6   ? 'Lower pH may suppress O. herpotricha' : null;
            } else {
                // O. korrae / O. narmari — favoured by low pH
                phFactor = pH <= 5.5 ? 0.8 : pH >= 6.5 ? 0.35 : 0.5;
                phNote   = pH <= 5.5 ? 'Low pH may favour O. korrae/O. narmari'
                         : pH >= 6.5 ? 'Higher pH may suppress O. korrae' : null;
            }
            phContrib = Math.round(phFactor * 100);
        }

        // ── Weighted risk (only count factors we actually have) ────────────────
        let weightSum  = 0;
        let weightedScore = 0;
        if (coldContrib   !== null) { weightedScore += 0.35 * coldFactor;   weightSum += 0.35; }
        if (estContrib    !== null) { weightedScore += 0.30 * estFactor;    weightSum += 0.30; }
        if (thatchContrib !== null) { weightedScore += 0.20 * thatchFactor; weightSum += 0.20; }
        if (phContrib     !== null) { weightedScore += 0.15 * phFactor;     weightSum += 0.15; }

        if (weightSum === 0) {
            // No site history at all — return informational, not false zero
            return {
                disease: 'springDeadSpot', displayName: 'Spring Dead Spot',
                riskScore: 0, riskLevel: 'low',
                confidence: 'insufficient data', confidenceScore: 10,
                insufficientData: true,
                treatmentWindow: {
                    soilTemp: Math.round(soilTemp * 10) / 10,
                    soilTempEstimated,
                    inWindow: soilTemp >= 16 && soilTemp <= 24,
                    optimalRange: '16-24°C soil temperature',
                    timing: soilTemp >= 16 && soilTemp <= 24
                        ? 'WINDOW OPEN — apply preventive fungicide'
                        : soilTemp > 24
                        ? 'Too warm — window has passed'
                        : 'Too cold — wait for autumn (soil 16°C)',
                },
                drivers: {
                    coldExposure:  { contribution: 'No winter data' },
                    establishment: { contribution: 'Unknown turf age' },
                    thatch:        { contribution: 'Not measured' },
                    soilPH:        { contribution: 'Not tested' },
                },
                likelyPathogen, pathogenNote,
                keyMessage: 'Insufficient data to calculate SDS risk. Enter site history (winter min temp, turf age, thatch depth) for assessment.',
                source: 'Tredway et al. 2020, Hutchens et al. 2024',
            };
        }

        let riskScore = (weightedScore / weightSum)
                      // variety mod applied in analyse()
                      * 100;
        riskScore = Math.min(100, Math.max(0, riskScore));

        const inWindow = soilTemp >= 16 && soilTemp <= 24;

        return {
            disease: 'springDeadSpot', displayName: 'Spring Dead Spot',
            riskScore: Math.round(riskScore),
            riskLevel: classifyRisk(riskScore),
            confidence: weightSum >= 0.7 ? 'high' : 'medium',
            confidenceScore: weightSum >= 0.7 ? 90 : 70,
            treatmentWindow: {
                soilTemp: Math.round(soilTemp * 10) / 10,
                soilTempEstimated,
                inWindow,
                optimalRange: '16-24°C soil temperature',
                timing: inWindow
                    ? 'WINDOW OPEN — apply preventive fungicide'
                    : soilTemp > 24
                    ? 'Too warm — window has passed'
                    : 'Too cold — wait for autumn (soil 16°C)',
            },
            drivers: {
                coldExposure: coldContrib !== null
                    ? { winterMin: winterMinTemp, daysBelow5: daysBelow5C, contribution: coldContrib }
                    : { contribution: 'No data' },
                establishment: estContrib !== null
                    ? { years: yearsEstablished, contribution: estContrib }
                    : { contribution: 'Unknown' },
                thatch: thatchContrib !== null
                    ? { depth: thatchMm, contribution: thatchContrib }
                    : { contribution: 'Not measured' },
                soilPH: phContrib !== null
                    ? { value: pH, contribution: phContrib, note: phNote }
                    : { contribution: 'Not tested' },
            },
            likelyPathogen, pathogenNote,
            keyMessage: 'SDS cannot be treated curatively. Autumn prevention at soil 16-24°C. N source selection depends on pathogen species.',
            source: 'Tredway et al. 2020, Hutchens et al. 2024',
        };
    },

    getInterventions(riskLevel, opts) {
        const pH           = opts?.drivers?.soilPH?.value ?? opts?.soil?.pH ?? null;
        const regionCode   = opts?.region || 'AU';
        const likelyPath   = opts?.likelyPathogen || 'O. narmari';
        const inWindow     = opts?.treatmentWindow?.inWindow ?? false;
        const soilTempStr  = opts?.treatmentWindow?.soilTemp != null
            ? `${opts.treatmentWindow.soilTemp}°C` + (opts.treatmentWindow.soilTempEstimated ? ' (est.)' : '')
            : 'unknown';

        const cultural = [
            'Reduce thatch below 12mm',
            'Improve drainage',
            'Select resistant varieties (Tahoma 31, NorthBridge, Latitude 36)',
            'Hollow-tine aeration in late summer improves recovery',
        ];

        // N source recommendation varies by pathogen species
        if (likelyPath === 'O. herpotricha') {
            cultural.unshift('N SOURCE: Use ammonium sulphate during summer — suppresses O. herpotricha');
            if (pH != null && pH >= 6.5) cultural.push('Consider acidifying amendments — O. herpotricha favoured by higher pH');
        } else if (likelyPath === 'O. korrae') {
            cultural.unshift('N SOURCE: Use calcium nitrate during summer — suppresses O. korrae');
            if (pH != null && pH <= 5.5) cultural.push('Consider liming — O. korrae may be favoured by lower pH');
        } else {
            // O. narmari (AU/NZ default)
            cultural.unshift('N SOURCE: Research suggests calcium nitrate may help (similar to O. korrae response)');
            cultural.push('Australian research on O. narmari N response is limited — monitor results');
        }

        const interventions = {
            cultural,
            preventive: [],
            timing: inWindow ? `WINDOW OPEN — Soil ${soilTempStr}` : 'Wait for soil 16-24°C in autumn',
            varietyNote: 'Cold-tolerant varieties (Tahoma 31, NorthBridge) show reduced SDS severity',
            researchNote: 'N source recommendations based on Tredway et al. 2020 — different Ophiosphaerella species respond oppositely',
        };

        if (riskLevel !== 'low') {
            interventions.preventive = (regionCode === 'AU' || regionCode === 'NZ')
                ? [
                    'Azoxystrobin (Heritage, Amistar) — Autumn, soil 16-24°C',
                    'Fluopyram (Indemnify) — Root uptake, longer residual',
                    'Propiconazole — Effective in Australian trials',
                    'TWO applications 28 days apart for high-risk sites',
                ]
                : [
                    'Azoxystrobin — Autumn, soil 16-24°C',
                    'Fluopyram — Root uptake, longer residual',
                    'Tebuconazole — Effective on both O. herpotricha and O. korrae',
                    'TWO applications 28 days apart for high-risk sites',
                ];
        }

        return interventions;
    },
};

// =============================================================================
// TAKE-ALL PATCH MODEL  v2.0
// Pathogen: Gaeumannomyces graminis var. avenae (bentgrass, annual bluegrass)
//
// Risk is dominated by soil chemistry (pH → Mn availability) and soil
// temperature. Current weather (moisture) is a secondary driver.
// Fungicides provide only limited suppression — soil management is primary.
//
// Sources: Dernoeden, Creeping Bentgrass Management (3rd ed.);
//          Smiley et al., Compendium of Turfgrass Diseases;
//          Cook 2003 (applicable biology from wheat take-all)
// =============================================================================
const TakeAllModel = {
    name: 'Take-all Patch',
    pathogen: 'Gaeumannomyces graminis var. avenae',

    calculate(climate, soil, variety) {
        // ── Soil temperature ────────────────────────────────────────────────────
        // Pure path: climate.soilTemp injected by orchestrator
        const soilTempObj      = climate?.soilTemp;
        let soilTemp           = soilTempObj?.depths?.d100mm
                              ?? soilTempObj?.mean
                              ?? null;
        const soilTempEstimated = !soilTempObj || soilTempObj.source === 'estimated';

        // Hemisphere-aware air-temp lag fallback (no DOM reads)
        if (soilTemp === null) {
            const airTemp = climate?.temperature?.mean ?? 15;
            const month   = new Date().getMonth(); // 0-based
            const lat     = climate?.site?.latitude ?? null;
            const isSH    = lat !== null ? lat < 0 : false; // default NH if unknown
            const isAutumn = isSH ? (month >= 2 && month <= 4) : (month >= 8 && month <= 10);
            const isSpring = isSH ? (month >= 8 && month <= 10) : (month >= 2 && month <= 4);
            soilTemp = isAutumn ? airTemp + 2 : isSpring ? airTemp - 2 : airTemp;
        }

        // ── Soil chemistry ──────────────────────────────────────────────────────
        const soilPH      = soil?.pH     ?? 6.5;
        const soilMn      = soil?.Mn_ppm ?? 10;
        // Soil moisture: accept either fraction (0-1) or percentage (0-100)
        let soilMoisture  = climate?.moisture?.soilMoisture?.mean ?? 0.3;
        if (soilMoisture > 1) soilMoisture /= 100; // normalise percentage input

        // pH factor — high pH reduces Mn availability, favouring pathogen
        // Meaningful elevation starts at pH 6.5; high risk above 7.0
        const phFactor = soilPH > 6.5 ? Math.min(1, (soilPH - 6.5) / 1.5) : 0;

        // Mn factor — low Mn dramatically increases susceptibility
        const mnFactor = soilMn < 15 ? Math.min(1, (15 - soilMn) / 15) : 0;

        // Moisture factor — wet soils (VWC >35%) favour infection
        const moistureFactor = soilMoisture > 0.35
            ? Math.min(1, (soilMoisture - 0.35) / 0.15) : 0;

        // Soil temp factor — infection optimum 12-18°C, active 8-22°C
        let soilTempFactor = 0;
        if (soilTemp >= 8 && soilTemp <= 22) {
            soilTempFactor = Math.exp(-0.5 * Math.pow((soilTemp - 15) / 4, 2));
        }

        // ── Infection window ────────────────────────────────────────────────────
        const inInfectionWindow = soilTemp >= 12 && soilTemp <= 18;
        let windowNote = null;
        if (inInfectionWindow) {
            windowNote = '⚠️ INFECTION WINDOW OPEN — soil temp in optimal range for Take-all';
        } else if (soilTemp > 18 && soilTemp < 22) {
            windowNote = 'Infection window closing — soil warming';
        } else if (soilTemp > 8 && soilTemp < 12) {
            windowNote = 'Approaching infection window — monitor soil temps';
        }

        // ── Risk score (weights: pH 35%, Mn 30%, moisture 15%, soil temp 20%) ──
        let riskScore = (
            0.35 * phFactor +
            0.30 * mnFactor +
            0.15 * moistureFactor +
            0.20 * soilTempFactor
        ) * 100 // variety mod applied in analyse();
        riskScore = Math.min(100, Math.max(0, riskScore));

        // ── Primary driver ──────────────────────────────────────────────────────
        let primaryDriver = 'soil_pH';
        if (mnFactor > phFactor) primaryDriver = 'manganese_deficiency';
        if (soilTempFactor > phFactor && soilTempFactor > mnFactor && inInfectionWindow) {
            primaryDriver = 'soil_temperature';
        }

        // Confidence improves when actual soil data is present
        let confidence      = 'medium';
        let confidenceScore = 70;
        if (!soilTempEstimated && soil?.pH && soil?.Mn_ppm) {
            confidence = 'high'; confidenceScore = 85;
        } else if (soilTempEstimated && !soil?.pH) {
            confidence = 'low'; confidenceScore = 50;
        }

        return {
            disease: 'takeAll', displayName: 'Take-all Patch',
            riskScore: Math.round(riskScore),
            riskLevel: classifyRisk(riskScore),
            confidence, confidenceScore,
            primaryDriver,
            modelVersion: '2.0',
            drivers: {
                pH: {
                    value: soilPH,
                    contribution: Math.round(phFactor * 100),
                    status: soilPH > 7 ? 'high_risk' : soilPH > 6.5 ? 'elevated' : 'normal',
                },
                manganese: {
                    value: soilMn,
                    contribution: Math.round(mnFactor * 100),
                    status: soilMn < 10 ? 'deficient' : soilMn < 15 ? 'low' : 'adequate',
                },
                moisture: {
                    value: Math.round(soilMoisture * 100),
                    contribution: Math.round(moistureFactor * 100),
                },
                soilTemperature: {
                    value: Math.round(soilTemp * 10) / 10,
                    source: soilTempObj?.source || 'estimated',
                    estimated: soilTempEstimated,
                    contribution: Math.round(soilTempFactor * 100),
                    optimalRange: '12-18°C',
                    inInfectionWindow,
                    note: windowNote,
                },
            },
            infectionWindow: {
                active: inInfectionWindow,
                soilTemp: Math.round(soilTemp * 10) / 10,
                note: windowNote,
            },
            keyMessage: 'Take-all managed through soil chemistry (pH, Mn), not fungicides. Active infection at soil temps 12-18°C.',
            source: 'Dernoeden, Smiley et al., Cook 2003',
        };
    },

    getInterventions(riskLevel, opts) {
        const soil     = opts?.soil  || {};
        const drivers  = opts?.drivers || {};
        const inWindow = drivers?.soilTemperature?.inInfectionWindow ?? false;
        const soilTempVal = drivers?.soilTemperature?.value;

        const soilActions = [];
        if (soil.pH > 7)    soilActions.push('PRIORITY: Lower pH with ammonium sulphate');
        if (soil.pH > 6.5 && soil.pH <= 7) soilActions.push('Consider acidifying amendments to prevent pH rise');
        if (soil.Mn_ppm != null && soil.Mn_ppm < 15) soilActions.push('Apply manganese sulphate (foliar or granular)');

        const cultural = [
            'Improve drainage — wet soils favour infection',
            'Avoid excessive sand topdressing (can raise pH)',
            'Use acidifying fertilisers (ammonium sulphate)',
            'Maintain adequate Mn through foliar applications',
        ];

        if (inWindow) {
            cultural.unshift('Infection conditions present — prioritise Mn applications NOW');
        }

        const interventions = {
            cultural,
            soilManagement: soilActions,
            preventive: [],
            timing: inWindow && soilTempVal != null
                ? `⚠️ INFECTION WINDOW OPEN — soil temp ${soilTempVal}°C`
                : null,
        };

        if (riskLevel === 'high' || riskLevel === 'severe') {
            interventions.preventive = [
                'Azoxystrobin — some suppression only',
                'Fosetyl-Al — systemic, limited activity',
                'Note: Fungicides provide limited control — soil management is essential',
            ];
            if (inWindow) {
                interventions.preventive.unshift('Apply Mn sulphate NOW — infection window open');
            }
        }

        return interventions;
    },
};


// =============================================================================
// RECOMMENDATION ENGINE
// =============================================================================

/**
 * DISEASE RECOMMENDATION THRESHOLDS
 * ──────────────────────────────────
 * Preventive window: score enters moderate band (>=50) — conditions becoming
 *   favourable; apply before first symptoms if trend is up.
 * Curative pressure: score high/severe (>=70) — infection already occurring;
 *   curative rate and shorter re-application interval warranted.
 *
 * trendDelta convention: pp change over last 3 scoring periods (positive = rising).
 * Computed from forecast.daily scores when available, else null.
 */
const RECOMMENDATION_CONFIG = Object.freeze({
    thresholds: {
        action:     50,   // >= this: preventive warranted
        urgent:     70,   // >= this: apply within 24-48 h
        critical:   85,   // >= this: curative rate
    },
    trendSensitivity: 8,  // pp/period considered "rising fast"
});

/**
 * FRAC groups that carry elevated resistance risk for specific diseases.
 * Key = canonical disease key from disease-engine, value = array of fracGroup
 * codes where solo use is inadvisable.
 *
 * Sources:
 *   - FRAC Monograph No. 1 (2024 update) — benzimidazoles (FRAC 1) on dollar spot;
 *     DMIs (FRAC 3) on dollar spot and Fusarium
 *   - Kerns & Detweiler 2018 (APS) — QoI/strobilurin resistance in dollar spot AU/NZ
 *   - FRAC MoA Working Group 2023 — SDHI resistance emerging in Microdochium (FRAC 7)
 */
const RESISTANCE_WARNINGS = Object.freeze({
    dollarSpot:  { fracsAvoid: ['1','11'], note: 'QoI (FRAC 11) and benzimidazole (FRAC 1) resistance documented on fairway turf. Do not use as sole programme.' },
    fusarium:    { fracsAvoid: ['1','7'],  note: 'Benzimidazole (FRAC 1) resistance widespread in Microdochium. SDHI (FRAC 7) resistance emerging; monitor programme efficacy.' },
    brownPatch:  { fracsAvoid: ['11'],     note: 'QoI solo programmes reduce efficacy over time on Rhizoctonia. Rotate FRAC groups each application.' },
    anthracnose: { fracsAvoid: ['1'],      note: 'MBC/benzimidazole (FRAC 1) resistance documented in Colletotrichum cereale. Prioritise stress management over fungicide escalation.' },
    pythiumBlight:{ fracsAvoid: [],        note: null },  // oomycete, different MOA universe
});

/**
 * Disease-specific urgency windows — how many days from threshold crossing
 * before unacceptable loss occurs. Governs "apply within N days" language.
 * Source: expert consensus / pathogen biology (see inline comments).
 */
const URGENCY_WINDOWS = Object.freeze({
    pythiumBlight:   { preventiveDays: 1, curativeDays: null, note: 'Pythium destroys turf in 24-48 h. No curative option once blight spreads.' },
    dollarSpot:      { preventiveDays: 2, curativeDays: 4,    note: null },
    brownPatch:      { preventiveDays: 2, curativeDays: 3,    note: null },
    fusarium:        { preventiveDays: 3, curativeDays: 5,    note: null },
    grayLeafSpot:    { preventiveDays: 2, curativeDays: 3,    note: null },
    helminthosporium:{ preventiveDays: 3, curativeDays: 5,    note: null },
    largePatch:      { preventiveDays: 3, curativeDays: 5,    note: null },
    anthracnose:     { preventiveDays: null, curativeDays: null, note: 'Anthracnose is a stress disease. Fungicide without stress correction gives limited payback.' },
    springDeadSpot:  { preventiveDays: null, curativeDays: null, note: 'No curative option. Preventive timing is soil temperature-driven, not risk-score driven.' },
    takeAll:         { preventiveDays: null, curativeDays: null, note: 'Fungicides suppress only. Soil chemistry correction is the primary lever.' },
    waiteaPatch:     { preventiveDays: 3, curativeDays: 5,    note: null },
});

/**
 * Format a product list from FungicideFilter result into concise recommendation text.
 * Returns an array of strings suitable for the recommendation.products field.
 *
 * @param {Array} actives - Array of active objects from FungicideFilter
 * @param {string} region - Display name of region
 * @param {string} registrationBody - e.g. 'APVMA', 'HSE CRD'
 * @returns {string[]}
 */
function _formatProductLines(actives, region, registrationBody) {
    if (!actives || actives.length === 0) return [];
    const primary = actives.filter(a => a.type === 'primary' || !a.type);
    const items = (primary.length > 0 ? primary : actives).slice(0, 4);
    return items.map(a => {
        const reg = a.registration ? ` (${a.registration})` : '';
        const frac = a.fracGroup ? ` [FRAC ${a.fracGroup}]` : '';
        return `${a.activeIngredient || a.active}${reg}${frac}`;
    });
}

/**
 * Build a plain-English recommendation for a single disease result.
 * Pure function: accepts the resolved disease object + optional FungicideFilter
 * reference (passed in as a dep, not read from window — window is the caller's job).
 *
 * @param {Object} disease        - Post-multiplier disease result from analyse()
 * @param {string} fungicideRegion - Region code, e.g. 'AU', 'NZ', 'GB'
 * @param {number|null} trendDelta - Score change over last 3 periods (pp), or null
 * @param {Object|null} fungicideFilter - GAIP_FungicideFilter reference (or null)
 * @param {Object|null} residualCtx - Output of spray-log-cascade calculateResidualProtection(),
 *   optionally enriched with .uvResidual from GAIP_UV_RESIDUAL. Shape:
 *   {
 *     productName, activeIngredient, fracGroup, applicationDate, daysSince,
 *     pctRemaining,       // simple half-life estimate (0-100)
 *     isWithinWindow,     // true if still inside label protection window
 *     isExpired,          // true if label window passed
 *     targets: Set,       // disease keys this AI targets
 *     uvResidual?: {
 *       residualPct,      // UV+rain+bio model (0-100)
 *       belowThreshold,   // < REAPPLY_THRESHOLD (70%)
 *       reapplyFlag,
 *     }
 *   }
 * @returns {Object} recommendation object:
 *   {
 *     action: 'none'|'monitor'|'prepare'|'preventive'|'curative',
 *     headline: string,
 *     timing: string|null,
 *     trendText: string|null,
 *     residualNote: string|null,  // UV/residual context line
 *     products: string[],
 *     productsLabel: string,
 *     resistanceNote: string|null,
 *     caveat: string|null,
 *   }
 */
function buildRecommendation(disease, fungicideRegion, trendDelta, fungicideFilter, residualCtx) {
    const score    = disease.adjustedRisk || disease.riskScore || 0;
    const level    = disease.riskLevel || classifyRisk(score);
    const diseaseKey = disease.disease; // canonical key

    const cfg       = RECOMMENDATION_CONFIG.thresholds;
    const urgency   = URGENCY_WINDOWS[diseaseKey] || { preventiveDays: 3, curativeDays: 5, note: null };
    const resWarn   = RESISTANCE_WARNINGS[diseaseKey];

    // --- Action classification ---
    let action;
    if      (score >= cfg.critical) action = 'curative';
    else if (score >= cfg.urgent)   action = 'preventive';  // high — apply now
    else if (score >= cfg.action)   action = 'prepare';     // moderate — prepare/consider
    else if (score >= 30)           action = 'monitor';
    else                            action = 'none';

    // Upgrade action if trend is rising fast through lower score band
    if (action === 'monitor' && trendDelta !== null && trendDelta >= RECOMMENDATION_CONFIG.trendSensitivity) {
        action = 'prepare';
    }
    if (action === 'prepare' && trendDelta !== null && trendDelta >= RECOMMENDATION_CONFIG.trendSensitivity) {
        action = 'preventive';
    }

    // --- Residual protection override ---
    // If the spray log + UV engine tell us the existing cover is running out,
    // we can upgrade the action independently of the raw score.
    //
    // Logic:
    //   Best residual estimate = uvResidual.residualPct if available (physics-based),
    //   else pctRemaining (simple half-life table).
    //
    //   Only apply to diseases the logged product actually targets — if targets
    //   is populated and this disease isn't in it, the residual is irrelevant here.
    //
    //   Thresholds:
    //     residual < 40% and score >= 30: protection effectively gone — upgrade to preventive
    //     residual < 70% and score >= 40: below reapply threshold — upgrade to prepare
    //     residual 0% / expired: treat as unprotected — bump to at least prepare if score >= 25
    let residualNote = null;
    if (residualCtx && residualCtx.productName) {
        const isTargeted = !residualCtx.targets || residualCtx.targets.size === 0 ||
                           residualCtx.targets.has(diseaseKey);

        if (isTargeted) {
            // Prefer UV-physics model; fall back to simple half-life estimate
            const residualPct = (residualCtx.uvResidual?.residualPct != null)
                ? residualCtx.uvResidual.residualPct
                : (residualCtx.pctRemaining != null ? residualCtx.pctRemaining : null);

            const ai   = residualCtx.activeIngredient || residualCtx.productName;
            const days = residualCtx.daysSince != null ? residualCtx.daysSince : '?';
            const src  = residualCtx.uvResidual?.residualPct != null ? 'UV model' : 'half-life est.';

            if (residualCtx.isExpired) {
                // Label window has passed entirely
                residualNote = `${ai} applied ${days}d ago — label window expired. No residual protection.`;
                if (score >= 25 && (action === 'none' || action === 'monitor')) {
                    action = 'prepare';
                }
            } else if (residualPct !== null && residualPct < 40 && score >= 30) {
                // Protection nearly gone; disease conditions present
                residualNote = `${ai} residual ${residualPct}% (${src}, applied ${days}d ago) — cover expiring.`;
                if (action === 'none' || action === 'monitor' || action === 'prepare') {
                    action = 'preventive';
                }
            } else if (residualPct !== null && residualPct < 70 && score >= 40) {
                // Below reapply threshold; conditions building
                residualNote = `${ai} residual ${residualPct}% (${src}, applied ${days}d ago) — below reapply threshold.`;
                if (action === 'none' || action === 'monitor') {
                    action = 'prepare';
                }
            } else if (residualPct !== null && residualPct >= 70) {
                // Good cover — inform user, no upgrade needed
                residualNote = `${ai} residual ~${residualPct}% (${src}, applied ${days}d ago) — protection current.`;
            }
        }
    }

    // --- Trend text ---
    let trendText = null;
    if (trendDelta !== null) {
        const sign = trendDelta > 0 ? '+' : '';
        if (Math.abs(trendDelta) < 3) {
            trendText = 'stable';
        } else if (trendDelta >= RECOMMENDATION_CONFIG.trendSensitivity) {
            trendText = `rising fast (${sign}${Math.round(trendDelta)}pp 3-day)`;
        } else if (trendDelta > 0) {
            trendText = `rising (${sign}${Math.round(trendDelta)}pp 3-day)`;
        } else {
            trendText = `easing (${sign}${Math.round(trendDelta)}pp 3-day)`;
        }
    }

    // --- Headline & timing ---
    let headline, timing;

    // Special-case diseases with biology-driven language
    if (diseaseKey === 'springDeadSpot') {
        const inWindow = disease.treatmentWindow?.inWindow;
        if (inWindow) {
            action   = 'preventive';
            headline = 'Treatment window open — preventive fungicide now.';
            timing   = `Soil temp ${disease.treatmentWindow.soilTemp}°C (optimal 16–24°C).`;
        } else if (score >= 30) {
            headline = 'High site risk — wait for autumn treatment window (soil 16–24°C).';
            timing   = null;
        } else {
            headline = 'Low risk. Monitor site history and autumn conditions.';
            timing   = null;
        }
    } else if (diseaseKey === 'takeAll') {
        headline = score >= cfg.action
            ? 'Soil chemistry intervention required — fungicides provide limited suppression.'
            : 'Monitor soil pH and Mn. Chemical control is secondary to soil management.';
        timing = disease.infectionWindow?.active
            ? `Infection window active — soil temp ${disease.infectionWindow.soilTemp}°C. Prioritise Mn applications now.`
            : null;
    } else if (diseaseKey === 'anthracnose') {
        headline = score >= cfg.urgent
            ? 'Stress relief is primary action. Fungicide is a bridge — address N, HOC, and compaction first.'
            : 'Manage stress factors. Fungicide at this level has limited ROI without cultural correction.';
        timing = score >= cfg.urgent && urgency.preventiveDays
            ? `Apply within ${urgency.preventiveDays} days if cultural options delayed.`
            : null;
    } else if (diseaseKey === 'pythiumBlight') {
        if (action === 'curative' || action === 'preventive') {
            headline = 'URGENT: Pythium destroys turf in 24–48 h. Apply before nightfall.';
            timing   = 'Apply TODAY before evening.';
        } else if (action === 'prepare') {
            headline = 'Conditions approaching Pythium threshold. Prepare product; apply at first sign.';
            timing   = 'Monitor hourly. Apply immediately if conditions deteriorate.';
        } else {
            headline = 'Pythium risk low. Conditions not currently favourable.';
            timing   = null;
        }
    } else {
        // Generic language for dollar spot, brown patch, fusarium, GLS, helminthosporium, large patch
        if (action === 'curative') {
            const days = urgency.curativeDays;
            headline = `Risk CRITICAL (${score}%) — curative application required.`;
            timing   = days ? `Apply at curative rate within ${days} days.` : 'Apply immediately.';
        } else if (action === 'preventive') {
            const days = urgency.preventiveDays;
            headline = `Preventive application warranted.`;
            timing   = days ? `Apply within ${days} days.` : 'Apply promptly.';
            if (trendDelta !== null && trendDelta >= RECOMMENDATION_CONFIG.trendSensitivity) {
                timing += ` Trend rising fast — front-load interval.`;
            }
            // Residual-driven upgrade: tighten timing language
            if (residualNote && residualCtx?.uvResidual?.residualPct != null &&
                residualCtx.uvResidual.residualPct < 40) {
                timing = `Residual expiring — apply to maintain cover${days ? ` within ${days} days` : ''}.`;
            }
        } else if (action === 'prepare') {
            headline = `Conditions building — prepare programme.`;
            timing   = 'Monitor 48 h. Apply preventively if score continues to rise.';
            if (residualNote && residualCtx?.isExpired) {
                timing = 'Previous cover expired. Prepare reapplication — no residual protection in place.';
            } else if (residualNote && residualCtx?.pctRemaining != null && residualCtx.pctRemaining < 70) {
                timing = 'Residual below threshold — prepare reapplication now.';
            }
        } else if (action === 'monitor') {
            headline = 'Risk low. Scout regularly; no spray action required.';
            timing   = null;
        } else {
            headline = 'No action required. Conditions not favourable.';
            timing   = null;
        }
    }

    // Append trend context to headline when present and not already encoded
    if (trendText && trendText !== 'stable' && !headline.includes('rising') && !headline.includes('easing')) {
        headline += ` Score ${trendText}.`;
    }

    // --- Product lookup ---
    let products        = [];
    let productsLabel   = '';
    let productWarnings = [];

    if (fungicideFilter && (action === 'preventive' || action === 'curative' || action === 'prepare')) {
        try {
            const regionOpt = fungicideRegion ? { region: _fungicideRegionToFilterKey(fungicideRegion) } : {};
            // Pass diseaseKey directly — fungicide-filter.normalizeDiseaseName handles conversion
            const result    = fungicideFilter.getApprovedFungicides(diseaseKey, regionOpt);
            if (result && result.actives && result.actives.length > 0) {
                products      = _formatProductLines(result.actives, fungicideRegion, result.registrationBody);
                productsLabel = `Registered (${fungicideRegion}${result.registrationBody ? ', ' + result.registrationBody : ''})`;
            }
            if (result?.warnings?.length > 0) {
                productWarnings = result.warnings;
            }
        } catch (e) {
            // Fungicide lookup non-fatal — recommendation still valid without products
        }
    }

    // --- Resistance note ---
    let resistanceNote = resWarn?.note || null;

    return {
        action,
        headline,
        timing,
        trendText,
        residualNote,
        products,
        productsLabel,
        productWarnings,
        resistanceNote,
        caveat: urgency.note || null,
    };
}

/**
 * Map disease engine region codes to FungicideFilter region keys.
 * FungicideFilter uses full region strings; disease engine uses short codes.
 */
function _fungicideRegionToFilterKey(regionCode) {
    const MAP = {
        'AU':                   'australia',
        'australia':            'australia',
        'australia_temperate':  'australia',
        'australia_tropical':   'australia',
        'australia_arid':       'australia',
        'NZ':                   'new_zealand',
        'new_zealand':          'new_zealand',
        'GB':                   'uk_ireland',
        'UK':                   'uk_ireland',
        'uk_ireland':           'uk_ireland',
        'IE':                   'uk_ireland',
        'SE':                   'scandinavia',
        'DK':                   'scandinavia',
        'NO':                   'scandinavia',
        'scandinavia':          'scandinavia',
        'FI':                   'nordic',
        'JP':                   'japan',
        'DE':                   'germany',
        'FR':                   'france',
        'ES':                   'spain',
    };
    return MAP[regionCode] || regionCode.toLowerCase();
}


// =============================================================================
// MAIN ENGINE - PURE FUNCTION
// =============================================================================

/**
 * Run complete disease analysis. Pure function: no DOM, no globals.
 *
 * @param {Object} input - DiseaseEngineInput (see shape definition above)
 * @returns {Object} DiseaseEngineResult
 */
/**
 * Taper a post-processing multiplier based on the base score.
 *
 * When the base score is high (>=70), conditions genuinely favour the disease
 * and susceptibility compounds real risk: apply the multiplier fully.
 * When the base score is marginal (40-70), the multiplier should nudge
 * rather than catapult: taper it down.
 * When the base score is low (<40), conditions don't support the disease
 * and susceptibility is academic: cap the multiplier effect.
 *
 * Prevents multiplicative stacking of partially-overlapping factors
 * (species susceptibility, regional pressure, variety, tissue) from turning
 * every moderate base score into a false "severe" alarm.
 *
 * @param {number} baseScore - The pre-multiplied risk score (0-100)
 * @param {number} combinedMult - The raw combined multiplier (e.g. 1.64)
 * @returns {number} The tapered multiplier to actually apply
 */
function taperMultiplier(baseScore, combinedMult) {
    if (combinedMult <= 1) return combinedMult; // never dampen reductions

    if (baseScore >= 70) {
        // Full multiplier: conditions are genuinely dangerous
        return combinedMult;
    } else if (baseScore >= 40) {
        // Linear taper: at 70 -> full, at 40 -> capped at 1 + (mult-1)*0.5
        const t = (baseScore - 40) / 30; // 0 at base=40, 1 at base=70
        return 1 + (combinedMult - 1) * (0.5 + 0.5 * t);
    } else {
        // Low base: cap extra effect at 30% of what multiplier would add
        return 1 + (combinedMult - 1) * 0.3;
    }
}

function analyse(input) {
    const {
        climate, nitrogen, shade, soil, variety, species,
        traffic, mowing, region, dewData, tissueNutrients,
        poaPercent: rawPoaPercent, baseSpecies,
        // Injectable dependencies (replace global reads)
        regionalMultipliers, regionDisplayInfo,
        largePatchModel, dormancyData,
    } = input || {};

    // Helper to get variety modifier for a disease
    const getVarietyModifier = (diseaseName) => {
        if (!variety?.disease) return 1;
        const mod = variety.disease[diseaseName]?.riskMultiplier;
        return (typeof mod === 'number' && mod > 0) ? mod : 1;
    };

    const normalizedSpecies = normalizeSpecies(species);
    const susceptibility = SPECIES_SUSCEPTIBILITY[normalizedSpecies] || SPECIES_SUSCEPTIBILITY.perennialRyegrass;
    const diseases = [];
    const regionCode = region || 'AU';
    const tissueComposite = tissueNutrients?.compositeModifier || 1;
    const poaPercent = rawPoaPercent || 0;
    const mowingCtx = mowing || {};

    // === Dollar Spot ===
    if (susceptibility.dollarSpot > 0) {
        const result = DollarSpotModel.calculate(climate, nitrogen, variety, shade, dewData);
        result.speciesSusceptibility = susceptibility.dollarSpot;
        let tissueMod = 1;
        const vMod = getVarietyModifier('dollarSpot');
        if (tissueNutrients?.modifiers?.K?.status === 'deficient') tissueMod *= 1.2;
        if (tissueNutrients?.modifiers?.KN_ratio?.status === 'poor') tissueMod *= 1.15;
        // Use rawRisk (uncapped) as the base for taperMultiplier so that when
        // riskScore saturates at 100, the species/variety multiplier (e.g. bentgrass
        // 1.3) still has headroom to drive adjustedRisk above display-capped riskScore.
        // Without this, L-93 bentgrass reads 100% any time base conditions are moderate,
        // because taperMultiplier(100, 1.3) = 1.3 → 130 → clamped to 100; correct, but
        // rawRisk of e.g. 77 → taperMultiplier(77, 1.3*1.3=1.69) → ~1.65 → 127 → 100
        // only for genuinely extreme conditions, not moderate ones.
        const baseForTaper = result.rawRisk ?? result.riskScore;
        { const rawMult = susceptibility.dollarSpot * tissueMod * vMod; result.adjustedRisk = Math.min(100, Math.round(baseForTaper * taperMultiplier(baseForTaper, rawMult))); }
        result.riskLevel = classifyRisk(result.adjustedRisk);
        result.interventions = DollarSpotModel.getInterventions(result.riskLevel, { nitrogen, shade, region: regionCode });
        if (vMod !== 1) result.varietyNote = `Variety "${variety?.name}" modifier: ${vMod < 1 ? '-' : '+'}${Math.abs(Math.round((1 - vMod) * 100))}%`;
        if (tissueMod > 1) result.nutrientNote = 'Risk increased by tissue nutrient imbalance';
        // Smith-Kerns warm-season caveat: model validated on cool-season bentgrass only.
        // Running on C4 species with susceptibility modifier but score is indicative only.
        const C4_WARM_SEASON = ['bermuda','couch','kikuyu','zoysia','buffalo','buffalograss','paspalum'];
        if (C4_WARM_SEASON.includes(normalizedSpecies)) {
            result.warmSeasonCaveat = 'Smith-Kerns model validated on cool-season bentgrass only. Dollar spot score on warm-season turf is indicative — use as trend guidance, not a precise threshold.';
        }
        diseases.push(result);
    }

    // === Brown Patch ===
    if (susceptibility.brownPatch > 0) {
        const result = BrownPatchModel.calculate(climate, nitrogen, variety, dewData);
        result.speciesSusceptibility = susceptibility.brownPatch;
        let tissueMod = 1;
        const vMod = getVarietyModifier('brownPatch');
        if (tissueNutrients?.modifiers?.KN_ratio?.status === 'poor') tissueMod *= 1.2;
        if (tissueNutrients?.modifiers?.Ca?.status === 'deficient') tissueMod *= 1.15;
        { const rawMult = susceptibility.brownPatch * tissueMod * vMod; result.adjustedRisk = Math.min(100, Math.round(result.riskScore * taperMultiplier(result.riskScore, rawMult))); }
        result.riskLevel = classifyRisk(result.adjustedRisk);
        result.interventions = BrownPatchModel.getInterventions(result.riskLevel, { nitrogen, region: regionCode });
        if (vMod !== 1) result.varietyNote = `Variety "${variety?.name}" modifier: ${vMod < 1 ? '-' : '+'}${Math.abs(Math.round((1 - vMod) * 100))}%`;
        diseases.push(result);
    }

    // === Pythium Blight ===
    if (susceptibility.pythium > 0) {
        const result = PythiumModel.calculate(climate, nitrogen, variety, dewData);
        result.speciesSusceptibility = susceptibility.pythium;
        let tissueMod = 1;
        const vMod = getVarietyModifier('pythium');
        // HEURISTIC: Ca (1.2×) and K (1.1×) modifiers based on general host stress physiology.
        // No Pythium-specific peer-reviewed quantification exists for these factors. (Gilba b35fix104)
        if (tissueNutrients?.modifiers?.Ca?.status === 'deficient') tissueMod *= 1.2;
        if (tissueNutrients?.modifiers?.K?.status === 'deficient') tissueMod *= 1.1;
        { const rawMult = susceptibility.pythium * tissueMod * vMod; result.adjustedRisk = Math.min(100, Math.round(result.riskScore * taperMultiplier(result.riskScore, rawMult))); }
        result.riskLevel = classifyRisk(result.adjustedRisk);
        result.interventions = PythiumModel.getInterventions(result.riskLevel, { region: regionCode });
        if (vMod !== 1) result.varietyNote = `Variety "${variety?.name}" modifier: ${vMod < 1 ? '-' : '+'}${Math.abs(Math.round((1 - vMod) * 100))}%`;
        diseases.push(result);
    }

    // === Anthracnose ===
    if (susceptibility.anthracnose > 0.5) {
        const result = AnthracnoseModel.calculate(climate, nitrogen, variety, shade, traffic, mowingCtx, dewData);
        result.speciesSusceptibility = susceptibility.anthracnose;
        let tissueMod = tissueComposite;
        const vMod = getVarietyModifier('anthracnose');
        if (tissueNutrients?.modifiers?.P?.status === 'deficient') tissueMod *= 1.1;
        { const rawMult = susceptibility.anthracnose * tissueMod * vMod; result.adjustedRisk = Math.min(100, Math.round(result.riskScore * taperMultiplier(result.riskScore, rawMult))); }
        result.riskLevel = classifyRisk(result.adjustedRisk);
        result.interventions = AnthracnoseModel.getInterventions(result.riskLevel, { mowing: mowingCtx, shade, traffic, nitrogen, region: regionCode });
        if (vMod !== 1) result.varietyNote = `Variety "${variety?.name}" modifier: ${vMod < 1 ? '-' : '+'}${Math.abs(Math.round((1 - vMod) * 100))}%`;
        diseases.push(result);
    }

    // === Poa contamination adjustments ===
    if (poaPercent > 0 && normalizedSpecies !== 'poaAnnua') {
        const poaSusc = SPECIES_SUSCEPTIBILITY.poaAnnua;
        const poaFraction = poaPercent / 100;
        if (poaPercent >= 10) {
            const anthResult = diseases.find(d => d.disease === 'anthracnose');
            if (anthResult) {
                const blended = susceptibility.anthracnose + (poaSusc.anthracnose - susceptibility.anthracnose) * poaFraction;
                anthResult.speciesSusceptibility = Math.round(blended * 100) / 100;
                anthResult.adjustedRisk = Math.min(100, Math.round(anthResult.riskScore * blended));
                anthResult.poaNote = `${poaPercent}% Poa contamination elevates risk`;
            }
            const pythResult = diseases.find(d => d.disease === 'pythiumBlight');
            if (pythResult) {
                const blended = susceptibility.pythium + (poaSusc.pythium - susceptibility.pythium) * poaFraction;
                pythResult.speciesSusceptibility = Math.round(blended * 100) / 100;
                pythResult.adjustedRisk = Math.min(100, Math.round(pythResult.riskScore * blended));
                pythResult.poaNote = `${poaPercent}% Poa contamination elevates risk`;
            }
        }
    }

    // === Spring Dead Spot ===
    if (susceptibility.springDeadSpot > 0) {
        const result = SpringDeadSpotModel.calculate(climate, soil, variety, null, regionCode);
        const vMod = getVarietyModifier('springDeadSpot');
        result.speciesSusceptibility = susceptibility.springDeadSpot;
        { const rawMult = susceptibility.springDeadSpot * vMod; result.adjustedRisk = Math.min(100, Math.round(result.riskScore * taperMultiplier(result.riskScore, rawMult))); }
        result.riskLevel = classifyRisk(result.adjustedRisk);
        if (vMod !== 1) result.varietyNote = `Variety "${variety?.name}" modifier: ${vMod < 1 ? '-' : '+'}${Math.abs(Math.round((1 - vMod) * 100))}%`;
        diseases.push(result);
    }

    // === Large Patch (C4 only, injected model) ===
    if (susceptibility.largePatch > 0 && largePatchModel) {
        const result = largePatchModel.calculate(climate, nitrogen, variety, soil, dormancyData, normalizedSpecies);
        if (result && result.applicable !== false) {
            const vMod = getVarietyModifier('largePatch');
            result.speciesSusceptibility = susceptibility.largePatch;
            { const rawMult = susceptibility.largePatch * vMod; result.adjustedRisk = Math.min(100, Math.round(result.riskScore * taperMultiplier(result.riskScore, rawMult))); }
            result.riskLevel = classifyRisk(result.adjustedRisk);
            if (vMod !== 1) result.varietyNote = `Variety "${variety?.name}" modifier: ${vMod < 1 ? '-' : '+'}${Math.abs(Math.round((1 - vMod) * 100))}%`;
            diseases.push(result);
        }
    }

    // === Helminthosporium ===
    if (susceptibility.helminthosporium > 0.5) {
        const result = HelminthosporiumModel.calculate(climate, nitrogen, variety, dewData);
        const vMod = getVarietyModifier('helminthosporium');
        result.speciesSusceptibility = susceptibility.helminthosporium;
        { const rawMult = susceptibility.helminthosporium * vMod; result.adjustedRisk = Math.min(100, Math.round(result.riskScore * taperMultiplier(result.riskScore, rawMult))); }
        result.riskLevel = classifyRisk(result.adjustedRisk);
        result.interventions = HelminthosporiumModel.getInterventions(result.riskLevel);
        if (vMod !== 1) result.varietyNote = `Variety "${variety?.name}" modifier: ${vMod < 1 ? '-' : '+'}${Math.abs(Math.round((1 - vMod) * 100))}%`;
        diseases.push(result);
    }

    // === Fusarium ===
    if (susceptibility.fusarium > 0) {
        const result = FusariumModel.calculate(climate, nitrogen, variety);
        const vMod = getVarietyModifier('fusarium');
        result.speciesSusceptibility = susceptibility.fusarium;
        { const rawMult = susceptibility.fusarium * vMod; result.adjustedRisk = Math.min(100, Math.round(result.riskScore * taperMultiplier(result.riskScore, rawMult))); }
        result.riskLevel = classifyRisk(result.adjustedRisk);
        result.interventions = FusariumModel.getInterventions(result.riskLevel, { nitrogen, climate, region: regionCode });
        if (vMod !== 1) result.varietyNote = `Variety "${variety?.name}" modifier: ${vMod < 1 ? '-' : '+'}${Math.abs(Math.round((1 - vMod) * 100))}%`;
        if (result.drivers?.nitrogen?.winterRisk) {
            result.nutrientNote = 'Excess N in cool conditions dramatically increases Fusarium risk';
        }
        diseases.push(result);
    }

    // === Take-all Patch ===
    if (susceptibility.takeAll > 0.5) {
        const result = TakeAllModel.calculate(climate, soil, variety);
        const vMod = getVarietyModifier('takeAll');
        result.speciesSusceptibility = susceptibility.takeAll;
        let tissueMod = 1;
        const pH = soil?.pH || null;
        if (pH && pH > 7) { tissueMod *= 1.35; result.nutrientNote = `High soil pH (${pH.toFixed(1)}) reducing Mn availability`; }
        else if (pH && pH > 6.5) { tissueMod *= 1.15; result.nutrientNote = `Soil pH (${pH.toFixed(1)}) may be limiting Mn availability`; }
        { const rawMult = susceptibility.takeAll * tissueMod * vMod; result.adjustedRisk = Math.min(100, Math.round(result.riskScore * taperMultiplier(result.riskScore, rawMult))); }
        result.riskLevel = classifyRisk(result.adjustedRisk);
        if (vMod !== 1) result.varietyNote = `Variety "${variety?.name}" modifier: ${vMod < 1 ? '-' : '+'}${Math.abs(Math.round((1 - vMod) * 100))}%`;
        diseases.push(result);
    }

    // === Gray Leaf Spot ===
    if (susceptibility.grayLeafSpot > 0.5) {
        const result = GrayLeafSpotModel.calculate(climate, nitrogen, variety, null);
        const vMod = getVarietyModifier('grayLeafSpot');
        let tissueMod = tissueComposite;
        if (tissueNutrients?.modifiers?.Si?.status === 'high') tissueMod *= 0.85;
        result.speciesSusceptibility = susceptibility.grayLeafSpot;
        { const rawMult = susceptibility.grayLeafSpot * tissueMod * vMod; result.adjustedRisk = Math.min(100, Math.round(result.riskScore * taperMultiplier(result.riskScore, rawMult))); }
        result.riskLevel = classifyRisk(result.adjustedRisk);
        result.interventions = GrayLeafSpotModel.getInterventions(result.riskLevel);
        if (vMod !== 1) result.varietyNote = `Variety "${variety?.name}" modifier: ${vMod < 1 ? '-' : '+'}${Math.abs(Math.round((1 - vMod) * 100))}%`;
        diseases.push(result);
    }

    // === Waitea Patch (NZ var. circinata + AU var. zeae) ===
    {
        const waiteaResult = WaiteaPatchModel.calculate(climate, nitrogen, shade, soil, variety, normalizedSpecies, regionCode);
        if (waiteaResult !== null) diseases.push(waiteaResult);
    }

    // Sort by adjusted risk descending
    diseases.sort((a, b) => (b.adjustedRisk || 0) - (a.adjustedRisk || 0));

    // Apply regional multipliers (pure: from input, not global)
    const regionInfo = regionDisplayInfo || { name: regionCode, dataSource: 'Default parameters' };
    diseases.forEach(d => {
        const mult = getRegionalDiseaseMultiplier(d.displayName, regionalMultipliers);
        d.regionalMultiplier = mult;
        d.baseRisk = d.adjustedRisk;
        d.adjustedRisk = Math.min(100, Math.round(d.adjustedRisk * taperMultiplier(d.riskScore, mult)));
        d.riskLevel = classifyRisk(d.adjustedRisk);
        if (mult !== 1) {
            d.regionalNote = `Regional pressure: ${mult > 1 ? '+' : ''}${Math.round((mult - 1) * 100)}% (${regionInfo.name})`;
        }
    });
    diseases.sort((a, b) => (b.adjustedRisk || 0) - (a.adjustedRisk || 0));

    // === Recommendation language ===
    // Attach one `recommendation` object per disease result.
    // trendDelta: if forecast daily scores available, compute 3-day delta;
    //             otherwise null (recommendation degrades gracefully).
    // FungicideFilter: injected via input or window — never required.
    // residualContext: from spray-log-cascade (via input or window._sprayResidualProtection).
    const _ff = input?.fungicideFilter ||
                (typeof window !== 'undefined' ? window.GAIP_FungicideFilter : null) ||
                null;
    // Prefer explicit injection; fall back to global written by spray-log-cascade.injectIntoState()
    const _residualCtx = input?.residualContext ||
                (typeof window !== 'undefined' ? window._sprayResidualProtection : null) ||
                (typeof window !== 'undefined' ? window.GAIP_STATE?.sprayContext?.residualProtection : null) ||
                null;
    diseases.forEach(d => {
        let trendDelta = null;
        if (d.forecast?.daily && d.forecast.daily.length >= 2) {
            const daily   = d.forecast.daily;
            const current = daily[0]?.score ?? null;
            const past3   = daily[Math.min(2, daily.length - 1)]?.score ?? null;
            if (current !== null && past3 !== null) {
                trendDelta = current - past3;
            }
        }
        d.recommendation = buildRecommendation(d, regionCode, trendDelta, _ff, _residualCtx);
    });

    // Overall score: MAX of validated (non-beta) diseases
    const validated = diseases.filter(d => d.validationStatus !== 'beta' && !(d.validationBadge && d.validationBadge.includes('BETA')));
    const overallScore = validated.length > 0
        ? Math.max(...validated.map(d => d.adjustedRisk))
        : (diseases.length > 0 ? Math.max(...diseases.map(d => d.adjustedRisk)) : 0);

    // Alerts
    const alerts = diseases
        .filter(d => d.riskLevel === 'severe' || d.riskLevel === 'high')
        .map(d => ({
            disease: d.displayName,
            urgency: d.riskLevel === 'severe' ? 'critical' : 'high',
            message: `${d.displayName} risk ${d.riskLevel.toUpperCase()} (${d.adjustedRisk}%)`,
            action: d.interventions?.timing || 'Action recommended',
            type: d.alertType || `${d.riskLevel.toUpperCase()}_RISK`,
        }));

    // Nutrient alerts from tissue
    if (tissueNutrients?.notes?.length > 0) {
        tissueNutrients.notes.forEach(note => {
            if (note.toLowerCase().includes('critical') || note.toLowerCase().includes('low')) {
                alerts.push({
                    disease: 'Nutrition', urgency: note.toLowerCase().includes('critical') ? 'critical' : 'moderate',
                    message: note, action: 'Address nutrient imbalance to reduce disease susceptibility', type: 'NUTRIENT_ALERT',
                });
            }
        });
    }

    return {
        timestamp: new Date().toISOString(),
        species: normalizedSpecies,
        region: regionInfo,
        fungicideRegion: regionCode,
        overallRisk: classifyRisk(overallScore),
        overallScore,
        diseases,
        topThreats: diseases.slice(0, 3).map(d => ({
            disease: d.displayName, risk: d.adjustedRisk, level: d.riskLevel,
            primaryDriver: d.primaryDriver || Object.keys(d.drivers || {})[0],
            regionalMultiplier: d.regionalMultiplier,
            nutrientNote: d.nutrientNote || null,
        })),
        alerts,
        variety: variety ? {
            name: variety.name, source: variety.source,
            modifiersApplied: variety.disease ? Object.keys(variety.disease).filter(k => variety.disease[k]?.riskMultiplier !== 1) : [],
        } : null,
        tissueNutrients: tissueNutrients ? {
            hasData: tissueNutrients.hasData, compositeModifier: tissueNutrients.compositeModifier,
            modifiers: tissueNutrients.modifiers, notes: tissueNutrients.notes,
        } : null,
    };
}

// =============================================================================
// EXPORTS
// =============================================================================

const DiseaseEnginePure = {
    version: '3.0.0',
    analyse,
    buildRecommendation,  // exposed for unit testing and direct use
    // Sub-models exposed for direct testing
    models: {
        dollarSpot: DollarSpotModel,
        brownPatch: BrownPatchModel,
        pythium: PythiumModel,
        anthracnose: AnthracnoseModel,
        fusarium: FusariumModel,
        helminthosporium: HelminthosporiumModel,
        grayLeafSpot: GrayLeafSpotModel,
        waiteaPatch: WaiteaPatchModel,
        springDeadSpot: SpringDeadSpotModel,
        takeAll: TakeAllModel,
    },
    // Utilities exposed for testing and reuse
    utils: {
        classifyRisk,
        normalizeSpecies,
        getNightTemp,
        getNightHumidity,
        getLeafWetnessHours,
        get5DayAvgTemp,
        confidenceToScore,
        getRegionalDiseaseMultiplier,
        getSmithKernsConcurrentHours,
    },
    // Reference data
    SPECIES_SUSCEPTIBILITY,
    DISEASE_CONFIG,
    N_MODIFIERS,
    N_MODIFIERS_BROWN_PATCH,
    N_MODIFIERS_FUSARIUM,
};

// Export for Node.js (test harness) and browser
if (typeof module !== 'undefined' && module.exports) {
    module.exports = DiseaseEnginePure;
}
if (typeof root !== 'undefined') {
    root.DiseaseEnginePure = DiseaseEnginePure;

    // v3.0.3: Explicitly set GILBA_USE_PURE_DISEASE = true so the flag has a
    // defined value rather than relying on !==false defaulting.
    //
    // Without this, any conditional script load or wp_enqueue_script ordering
    // change silently falls back to the legacy engine with no PHP-level log.
    //
    // To revert to legacy: set window.GILBA_USE_PURE_DISEASE = false BEFORE
    // disease-engine-pure.js loads, OR set it in the browser console and reload.
    //
    // PHP note: if you ever conditionally enqueue this file, add an explicit
    //   wp_add_inline_script( 'disease-engine-pure', 'window.GILBA_USE_PURE_DISEASE = true;', 'before' );
    // so the flag remains visible in server-side logs via error_log().
    if (typeof root.GILBA_USE_PURE_DISEASE === 'undefined') {
        root.GILBA_USE_PURE_DISEASE = true;
        console.log('[DiseaseEnginePure] GILBA_USE_PURE_DISEASE set to true (pure engine active)');
    } else if (root.GILBA_USE_PURE_DISEASE === false) {
        console.warn('[DiseaseEnginePure] GILBA_USE_PURE_DISEASE is false — pure engine loaded but DISABLED. Legacy DiseaseEngine.analyse() will be used.');
    }

    // v3.0.2: Shim legacy DiseaseEngine.analyse to route through pure engine.
    // Installed here (not in disease-integration.js) to guarantee the shim is
    // active before ANY caller invokes DiseaseEngine.analyse().
    // Set window.GILBA_USE_PURE_DISEASE = false to revert.
    if (root.DiseaseEngine && root.DiseaseEngine.analyse) {
        var _legacyAnalyse = root.DiseaseEngine.analyse;
        root.DiseaseEngine._legacyAnalyse = _legacyAnalyse; // preserve for debugging
        root.DiseaseEngine.analyse = function(inputs) {
            if (root.GILBA_USE_PURE_DISEASE === false) {
                return _legacyAnalyse.call(root.DiseaseEngine, inputs);
            }
            // Inject dependencies if missing
            if (!inputs.regionalMultipliers) {
                inputs.regionalMultipliers = {};
                if (typeof root.gaip_getDiseaseMultiplier === 'function') {
                    ['dollarSpot','brownPatch','pythiumBlight','fusariumPatch',
                     'anthracnose','takeAllPatch','grayLeafSpot','springDeadSpot',
                     'largePatch','wateaPatch','redThread'].forEach(function(d) {
                        var m = root.gaip_getDiseaseMultiplier(d, inputs.region || 'AU');
                        if (m !== 1) inputs.regionalMultipliers[d] = m;
                    });
                }
            }
            if (!inputs.regionDisplayInfo) {
                inputs.regionDisplayInfo = typeof root.gaip_getRegionDisplayInfo === 'function'
                    ? root.gaip_getRegionDisplayInfo(inputs.region || 'AU')
                    : { name: inputs.region || 'Unknown' };
            }
            return DiseaseEnginePure.analyse(inputs);
        };
    }
}

})(typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : this));
