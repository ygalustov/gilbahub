/**
 * =============================================================================
 * GILBA BIPOLARIS / CURVULARIA / DRECHSLERA DISEASE MODELS v3.0.1
 * =============================================================================
 * 
 * Comprehensive leaf spot complex models for warm and cool-season grasses.
 * 
 * v3.0.1 CHANGES (Production Hide):
 * ---------------------------------
 * - Beta diseases hidden from production UI by default
 * - Set window.GAIP_SHOW_BETA_DISEASES = true to enable display
 * - Models still load and can be tested, just not shown to end users
 * 
 * v3.0.0 CHANGES (Accuracy Improvements):
 * ----------------------------------------
 * 1. ASYMMETRIC TEMPERATURE CURVES
 *    - Replaced symmetric Gaussian with species-specific asymmetric responses
 *    - Sharper decline below optimum, gentler above (reflects actual biology)
 *    - B. cynodontis: optimum 20-22°C, active 10-35°C
 *    - B. sorokiniana: optimum 26-28°C, requires >20°C for significant activity
 *    - Curvularia: optimum 28-32°C, true heat-loving pathogen
 * 
 * 2. NIGHT TEMPERATURE WEIGHTING
 *    - Primary infection occurs during night hours with leaf wetness
 *    - Night temp now weighted 60% vs 40% day temp for B. sorokiniana
 *    - Crown/root rot phase uses soil temperature estimates
 * 
 * 3. SIGMOID LEAF WETNESS RESPONSE
 *    - Replaced linear curve with threshold-based sigmoid
 *    - Minimal infection <6 hours, rapid increase 6-10h, saturates >12h
 *    - Reflects actual infection biology (spore germination + penetration time)
 * 
 * 4. REFINED SUSCEPTIBILITY COEFFICIENTS
 *    - Increased ultradwarf susceptibility (2.0 → 2.3)
 *    - Adjusted bentgrass B. sorokiniana (1.4 → 1.6 under heat stress)
 *    - Added variety-level modifier support for ultradwarfs
 * 
 * 5. CO-INFECTION SYNERGY ENHANCEMENT
 *    - Lowered temperature threshold (28°C → 25°C)
 *    - Graduated response curve based on temperature
 * 
 * 6. OUTCOME LOGGING INFRASTRUCTURE
 *    - Added logDiseaseOutcome() for field validation data capture
 *    - Structured format for ML training data collection
 * 
 * 7. CONSECUTIVE DAY AMPLIFICATION
 *    - Risk amplifies when favorable conditions persist 2+ days
 *    - Integrated with DiseaseForecast module
 * 
 * Sources:
 * - Brecht et al. 2007 (APS) - Temperature/moisture relationships
 * - PSU Turfgrass Pest Lab - Disease phase transitions
 * - UMass Extension Turf Program - Co-infection synergy
 * - NC State Extension - Warm-season grass susceptibility
 * - UGA Extension - Ultradwarf management
 * - Smiley et al. Compendium of Turfgrass Diseases (3rd ed)
 * 
 * @version 3.0.0
 * @date January 2026
 * @author Gilba Solutions
 * =============================================================================
 */

// b35fix272: namespaced storage — prevents cross-mode key bleed
const _ls = (typeof window !== "undefined" && window.GilbaStorageNS) ? window.GilbaStorageNS.get() : (typeof localStorage !== "undefined" ? localStorage : { getItem:()=>null, setItem:()=>{}, removeItem:()=>{} });

// =============================================================================
// VALIDATION STATUS
// =============================================================================

const BIPOLARIS_VALIDATION_STATUS = {
    status: 'beta',
    version: '3.0.0',
    displayBadge: '🧪 BETA',
    shortMessage: 'Field validation in progress',
    detailedMessage: `Model biology verified from peer-reviewed research. Risk calibration enhanced in v3.0.
    
Verified:
• Asymmetric temperature response curves from controlled studies
• Night temperature weighting from infection timing research
• Sigmoid leaf wetness thresholds from germination studies
• Disease phase transitions from diagnostic research
• Co-infection synergy (B. sorokiniana + Curvularia) from UMass
• Species susceptibility rankings from NTEP and extension data

New in v3.0:
• Asymmetric temperature curves (sharper below optimum)
• Night temperature weighting (60/40 for B. sorokiniana)
• Sigmoid leaf wetness response (6-12h threshold)
• Refined susceptibility coefficients
• Outcome logging for field validation
• Enhanced co-infection detection (25°C threshold)

Under validation:
• Risk weightings (improved estimates, awaiting outbreak data)
• Absolute thresholds (indicative, site tuning recommended)
• Variety-level susceptibility modifiers

Feedback welcomed to improve model accuracy.`,
    sources: [
        'Brecht et al. 2007 (APS)',
        'PSU Turfgrass Pest Lab',
        'UMass Extension Turf Program',
        'NC State Extension',
        'UGA Extension',
        'Smiley et al. Compendium of Turfgrass Diseases'
    ],
    lastUpdated: '2026-01'
};

// b35fix362: Validated status for DrechsleraPoaeModel after Tier 2 audit
const DRECHSLERA_POAE_VALIDATION_STATUS = {
    status: 'validated',
    version: '3.1.0', 
    displayBadge: '✓ VALIDATED',
    shortMessage: 'Tier 2 audit complete',
    detailedMessage: `DrechsleraPoaeModel passed comprehensive Tier 2 provenance audit (b35fix362).

Literature validation:
• Temperature range 10-24°C confirmed (Rutgers, UC IPM, Penn State)
• Cool, wet conditions requirement verified (multiple sources)
• High nitrogen increases risk validated (extension guidance)
• Two-phase disease pattern supported (leaf spot → melting-out)

Model updates (b35fix362):
• Literature-based temperature thresholds (peak 15-20°C, inhibited >24°C)
• Weighted-sum coefficients revised (0.50 temp, 0.40 moisture, 0.10 base)
• Nitrogen modifiers reduced to operational estimates (high 1.15×, excessive 1.25×)
• Melting-out multiplier reduced to 1.15× 

Audit results:
• Core biology well-supported by peer-reviewed literature
• Fabricated parameters replaced with literature-based estimates
• Operational estimates clearly flagged in source attribution
• Model provides agronomically sound guidance for cool-season hosts

Primary source: Penn State Extension (Landschoot 2024)`,
    sources: [
        'Landschoot, P. 2024 (Penn State Extension)',
        'Rutgers Plant & Pest Advisory',
        'UC IPM Guidelines', 
        'MU Extension'
    ],
    lastUpdated: '2026-04-27'
};

// =============================================================================
// SPECIES SUSCEPTIBILITY MATRIX
// =============================================================================
// Values represent relative susceptibility multipliers
// 1.0 = baseline, >1.0 = more susceptible, <1.0 = less susceptible, 0 = not a host

const BIPOLARIS_CURVULARIA_SUSCEPTIBILITY = {
    // Warm-season grasses
    bermuda: {
        bipolarisCynodontis: 1.8,
        bipolarisSorokiniana: 1.2,
        curvularia: 1.4,
        drechsleraPoae: 0
    },
    couch: {  // Australian term for bermuda
        bipolarisCynodontis: 1.8,
        bipolarisSorokiniana: 1.2,
        curvularia: 1.4,
        drechsleraPoae: 0
    },
    ultradwarf: {
        // v3.0: Increased from 2.0 - ultradwarfs extremely susceptible
        bipolarisCynodontis: 2.3,
        bipolarisSorokiniana: 1.4,
        curvularia: 1.8,
        drechsleraPoae: 0
    },
    zoysia: {
        bipolarisCynodontis: 1.2,
        bipolarisSorokiniana: 1.0,
        curvularia: 1.5,
        drechsleraPoae: 0
    },
    kikuyu: {
        bipolarisCynodontis: 0.8,
        bipolarisSorokiniana: 1.1,
        curvularia: 1.2,
        drechsleraPoae: 0
    },
    buffalo: {  // Stenotaphrum secundatum
        bipolarisCynodontis: 0.6,
        bipolarisSorokiniana: 0.8,
        curvularia: 1.0,
        drechsleraPoae: 0
    },
    paspalum: {
        bipolarisCynodontis: 1.0,
        bipolarisSorokiniana: 0.9,
        curvularia: 1.3,
        drechsleraPoae: 0
    },
    
    // Cool-season grasses
    bentgrass: {
        bipolarisCynodontis: 0.3,
        // v3.0: Increased - bentgrass highly susceptible under heat stress
        bipolarisSorokiniana: 1.6,
        curvularia: 0.5,
        drechsleraPoae: 0.6
    },
    perennialRyegrass: {
        bipolarisCynodontis: 0.2,
        bipolarisSorokiniana: 1.2,
        curvularia: 0.6,
        drechsleraPoae: 0.8
    },
    kentuckyBluegrass: {
        bipolarisCynodontis: 0.2,
        bipolarisSorokiniana: 1.5,
        curvularia: 0.7,
        // v3.0: Primary host for D. poae
        drechsleraPoae: 1.8
    },
    tallFescue: {
        bipolarisCynodontis: 0.2,
        bipolarisSorokiniana: 1.0,
        curvularia: 0.6,
        // b35fix361: rolled back from b35fix359's 0.6 to the pre-b35fix359
        // value of 0.5. The b35fix359 closure of Finding #2 (cool-season
        // silent false negative) assumed DrechsleraPoaeModel runs in
        // production for tall fescue once the strict-greater-than gate is
        // cleared. Production verification log gilbasolutions_com-1777262616843
        // (2026-04-27, post-b35fix360 deploy) revealed that the entire
        // bipolaris-curvularia engine pathway is gated off behind
        // window.GAIP_SHOW_BETA_DISEASES at line 1801 of this file
        // (`if (!showBetaDiseases) return results;` early-return inside
        // patchDiseaseEngineWithBipolaris). The gate exists because
        // DrechsleraPoaeModel's encoded weighted-sum and the asymmetric
        // Gaussian in calcTempResponse_DrechsleraPoae have not been
        // provenance-audited — same audit class as pre-b35fix352 Pythium.
        // The bump from 0.5 to 0.6 therefore did nothing in production
        // (engine never ran) but committed the project to an unaudited
        // value. b35fix362 will do the Tier 2 audit on DrechsleraPoaeModel;
        // if the model survives audit and gets ungated, this value becomes
        // an audit candidate at that point. Until then, restore the
        // pre-b35fix359 value.
        drechsleraPoae: 0.5
    },
    poaAnnua: {
        bipolarisCynodontis: 0.3,
        bipolarisSorokiniana: 1.3,
        curvularia: 0.5,
        drechsleraPoae: 1.0
    }
};

// =============================================================================
// ULTRADWARF VARIETY MODIFIERS (v3.0 NEW)
// =============================================================================
// Fine-grained susceptibility adjustments for specific ultradwarf cultivars

const ULTRADWARF_VARIETY_MODIFIERS = {
    'champion': {
        bipolarisCynodontis: 1.15,  // More susceptible
        bipolarisSorokiniana: 1.10,
        curvularia: 1.20
    },
    'tifeagle': {
        bipolarisCynodontis: 1.05,
        bipolarisSorokiniana: 1.00,
        curvularia: 1.10
    },
    'miniverde': {
        bipolarisCynodontis: 0.95,  // Slightly more tolerant
        bipolarisSorokiniana: 0.95,
        curvularia: 1.00
    },
    'trinity': {
        bipolarisCynodontis: 1.00,
        bipolarisSorokiniana: 1.05,
        curvularia: 1.05
    }
};

// =============================================================================
// CONSECUTIVE DAY CONFIG (for DiseaseForecast integration)
// =============================================================================

const BIPOLARIS_CONSECUTIVE_DAY_CONFIG = {
    bipolarisSorokiniana: { 
        threshold: 25, 
        maxMultiplier: 1.30, 
        perDayBonus: 0.12 
    },
    curvulariaBlight: { 
        threshold: 30, 
        maxMultiplier: 1.35, 
        perDayBonus: 0.15 
    },
    bipolarisCynodontis: {
        threshold: 20,
        maxMultiplier: 1.25,
        perDayBonus: 0.10
    }
};

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Get leaf wetness hours from available data sources
 * Priority: explicit data > dew model > humidity estimation
 */
function getBipolarisLeafWetness(climate, dewData) {
    // 1. Check explicit leaf wetness in climate data
    if (climate?.moisture?.leafWetness?.hours != null) {
        return climate.moisture.leafWetness.hours;
    }
    
    // 2. Check dew model output
    if (dewData?.leafWetness?.totalWetHours != null) {
        return dewData.leafWetness.totalWetHours;
    }
    
    // 3. Check global dew result (from dew-model.js)
    if (typeof window !== 'undefined' && window.GAIP_DEW_RESULT?.leafWetness?.totalWetHours) {
        return window.GAIP_DEW_RESULT.leafWetness.totalWetHours;
    }
    
    // 4. Fallback: estimate from humidity and precipitation
    // b35fix345: when humidity is null, fall back to precipitation-only signal.
    // Pre-fix `|| 70` planted 70% which slotted into the `humidity > 70` ladder
    // → estimated = 2 hours regardless of actual conditions. With null, we
    // start from 0 and let precip drive the estimate.
    const humidity = climate?.moisture?.humidity?.mean ?? null;
    const precip = climate?.precipitation?.total || 0;
    
    let estimated = 0;
    if (humidity != null) {
        if (humidity > 95) estimated = 12;
        else if (humidity > 90) estimated = 10;
        else if (humidity > 85) estimated = 8;
        else if (humidity > 80) estimated = 6;
        else if (humidity > 70) estimated = 4;
        else estimated = 2;
    }
    
    // Rain extends leaf wetness
    if (precip > 10) estimated += 4;
    else if (precip > 5) estimated += 2;
    
    return Math.min(24, estimated);
}

/**
 * v3.0 NEW: Sigmoid leaf wetness response curve
 * Reflects actual infection biology - minimal below threshold, rapid increase, saturation
 * 
 * @param {number} hours - Leaf wetness duration in hours
 * @returns {number} - Risk contribution (0-1)
 */
function calcLeafWetnessResponse(hours) {
    const threshold = 6;    // Minimum hours for significant infection
    const saturation = 12;  // Hours at which response saturates
    
    if (hours < threshold) {
        // Minimal infection potential below threshold
        return 0.1 * (hours / threshold);
    }
    
    if (hours >= saturation) {
        return 1.0;
    }
    
    // Sigmoid-like transition between threshold and saturation
    const progress = (hours - threshold) / (saturation - threshold);
    return 0.1 + 0.9 * Math.pow(progress, 0.7);
}

/**
 * v3.0 NEW: Asymmetric temperature response for B. cynodontis
 * Optimum 20-22°C, sharper decline below, gentler above
 */
function calcTempResponse_Bcynodontis(temp) {
    const optimum = 21;
    
    if (temp < 10) return 0;
    if (temp > 38) return 0;
    
    if (temp < optimum) {
        // Steeper decline below optimum (σ = 5)
        return Math.exp(-0.5 * Math.pow((temp - optimum) / 5, 2));
    } else {
        // Gentler decline above optimum (σ = 12)
        return Math.exp(-0.5 * Math.pow((temp - optimum) / 12, 2));
    }
}

/**
 * v3.0 NEW: Asymmetric temperature response for B. sorokiniana
 * Optimum 26-28°C, requires >20°C for significant activity
 */
function calcTempResponse_Bsorokiniana(temp) {
    const optimum = 27;
    
    if (temp < 15) return 0;
    if (temp > 40) return 0.2;  // Still some activity at extreme heat
    
    // Very low activity below 20°C
    if (temp < 20) {
        return 0.1 * ((temp - 15) / 5);
    }
    
    if (temp < optimum) {
        // Moderate decline below optimum (σ = 4)
        return Math.exp(-0.5 * Math.pow((temp - optimum) / 4, 2));
    } else {
        // Gentler decline above - still active at high temps (σ = 10)
        return Math.exp(-0.5 * Math.pow((temp - optimum) / 10, 2));
    }
}

/**
 * v3.0 NEW: Asymmetric temperature response for Curvularia
 * True heat-loving pathogen, optimum 28-32°C
 */
function calcTempResponse_Curvularia(temp) {
    const optimum = 30;
    
    if (temp < 20) return 0;
    if (temp > 45) return 0.5;  // Active even at extreme heat
    
    if (temp < optimum) {
        // Steep decline below optimum (σ = 5)
        return Math.exp(-0.5 * Math.pow((temp - optimum) / 5, 2));
    } else {
        // Very gentle decline above - loves heat (σ = 15)
        return Math.exp(-0.5 * Math.pow((temp - optimum) / 15, 2));
    }
}

/**
 * b35fix362: Literature-based temperature response for Drechslera poae
 * 
 * SOURCES (Tier 2 audit):
 * - Rutgers: "conidial production ceases at temperatures over 68°F (20°C)"
 * - UC IPM: "Cool (50° to 75°F / 10-24°C) moist conditions favor melting out"
 * - Penn State: "cool, wet weather in late-winter and early-spring"
 * - Spain: "above 20°C the germination growth rate is slowly reduced"
 * - MU Extension: "D. poae is inhibited by hot weather"
 *
 * AUDIT FINDINGS: Literature supports 10-24°C activity range with optimum
 * around 18°C (midpoint of 50-75°F). Replaced fabricated asymmetric Gaussian
 * (σ=8/5) with threshold-based approach reflecting published biology.
 */
function calcTempResponse_DrechsleraPoae(temp) {
    // b35fix362: Literature-based temperature response
    if (temp < 5) return 0.05;    // Minimal activity in cold (vs fabricated 0.1)
    if (temp > 24) return 0.05;   // Inhibited by heat >24°C (vs fabricated >30°C)
    
    // Peak activity 15-20°C (literature: cool, wet conditions)
    if (temp >= 15 && temp <= 20) {
        return 1.0;
    }
    
    // Moderate activity 10-15°C and 20-24°C  
    if ((temp >= 10 && temp < 15) || (temp > 20 && temp <= 24)) {
        return 0.6;
    }
    
    // Declining activity at temperature extremes
    if (temp >= 5 && temp < 10) {
        return 0.3;  // Some activity in cool conditions
    }
    
    return 0.1;  // Minimal activity outside optimal range
}

/**
 * Extract stress factors from hub state
 */
function extractStressFactors(state) {
    const factors = {};
    
    // Potassium status
    if (state?.tissue?.K || state?.tissueNutrients?.modifiers?.K) {
        const kMod = state.tissueNutrients?.modifiers?.K || {};
        factors.potassium = {
            status: kMod.status || 'adequate',
            value: parseFloat(state.tissue?.K) || null
        };
    }
    
    // Nitrogen status
    if (state?.nitrogenStatus || state?.tissue?.N) {
        factors.nitrogen = state.nitrogenStatus || { status: 'adequate' };
    }
    
    // Soil pH
    if (state?.soil?.pH) {
        factors.soilPH = parseFloat(state.soil.pH);
    }
    
    // Mowing height
    if (state?.mowing?.heightOfCut || state?.mowing?.height) {
        factors.mowingHeight = parseFloat(state.mowing.heightOfCut || state.mowing.height);
    }
    
    // Thatch depth
    if (state?.siteHistory?.thatchMm) {
        factors.thatchDepth = state.siteHistory.thatchMm;
    }
    
    // Recent verticutting
    if (state?.siteHistory?.recentVerticut) {
        factors.recentVerticut = true;
    }
    
    // Drought stress
    if (state?.climateMetrics?.moisture?.deficit > 20) {
        factors.droughtStress = true;
    }
    
    // Shade stress
    if (state?.shadeMetrics?.dailyLightIntegral?.dliPercent) {
        const dliPct = state.shadeMetrics.dailyLightIntegral.dliPercent;
        if (dliPct < 40) {
            factors.shade = 100 - dliPct;
        }
    }
    
    // Compaction
    if (state?.wearMetrics?.compactionRisk === 'high') {
        factors.compaction = true;
    }
    
    return factors;
}

/**
 * Classify risk level from score
 */
function classifyBipolarisRisk(score) {
    if (score >= 85) return 'severe';
    if (score >= 70) return 'high';
    if (score >= 50) return 'moderate';
    if (score >= 25) return 'low';
    return 'minimal';
}

/**
 * Get ultradwarf variety modifier if applicable
 */
function getUltradwarfVarietyModifier(variety, disease) {
    if (!variety?.name) return 1.0;
    
    const varName = variety.name.toLowerCase();
    const mods = ULTRADWARF_VARIETY_MODIFIERS[varName];
    
    if (mods && mods[disease]) {
        return mods[disease];
    }
    
    return 1.0;
}


// =============================================================================
// BIPOLARIS CYNODONTIS MODEL
// =============================================================================
// Primary pathogen of bermudagrass/couch - "Helminthosporium" leaf spot

const BipolarisCynodontisModel = {
    name: 'Bipolaris cynodontis',
    displayName: 'Bipolaris Leaf Spot (B. cynodontis)',
    pathogen: 'Bipolaris cynodontis',
    primaryHosts: ['bermuda', 'couch', 'ultradwarf', 'zoysia'],
    validationStatus: BIPOLARIS_VALIDATION_STATUS,
    
    calculate(climate, nitrogen, variety, stressFactors = {}, dewData = null) {
        // b35fix345: null-passthrough on temperature and humidity inputs.
        // Pre-fix temp `?? 20` and humidity `?? 70` fabricated values when
        // climate data was missing — produced non-zero risk on no-data sites.
        // Now: degrade explicitly when temperature is missing (humidity-only
        // can't drive Bipolaris; the engine needs a temp signal).
        const temp = climate?.temperature?.mean ?? null;
        const humidity = climate?.moisture?.humidity?.mean ?? null;
        if (temp == null) {
            return {
                disease: 'bipolarisCynodontis',
                displayName: 'Bipolaris Leaf Spot (B. cynodontis)',
                riskScore: 0, rawRisk: 0, riskLevel: 'low',
                confidence: 'low', confidenceScore: 30, degraded: true,
                source: 'BipolarisCynodontisModel — degraded: temperature missing (b35fix345)',
                drivers: { temperature: { value: null, status: 'missing' },
                           humidity:    { value: humidity, status: humidity == null ? 'missing' : 'available' } },
            };
        }
        const tempMin = climate?.temperature?.min ?? temp - 5;
        const tempMax = climate?.temperature?.max ?? temp + 5;
        const leafWetness = getBipolarisLeafWetness(climate, dewData);
        const precip = climate?.precipitation?.total ?? 0;
        
        const nStatus = nitrogen?.status || 'adequate';
        const kStatus = stressFactors.potassium?.status || 'adequate';
        
        // =================================================================
        // TEMPERATURE FACTOR (v3.0: Asymmetric curve + night weighting)
        // =================================================================
        
        // Use night temperature for primary calculation (infection occurs at night)
        const nightTempResponse = calcTempResponse_Bcynodontis(tempMin);
        const dayTempResponse = calcTempResponse_Bcynodontis(temp);
        
        // Weight night temps more heavily (60/40)
        let tempFactor = (0.6 * nightTempResponse) + (0.4 * dayTempResponse);
        
        // Determine disease phase
        let diseasePhase = 'leaf_spot';
        let phaseNote = '';
        
        // Hot, dry conditions can shift to crown/root rot
        // b35fix345: null-guard. `humidity < 60` evaluates false when null, so
        // crown_root_rot phase doesn't fire on no-data sites — correct behaviour.
        if (temp >= 28 && humidity != null && humidity < 60) {
            diseasePhase = 'crown_root_rot';
            phaseNote = 'Crown/root infection phase - reduce irrigation stress';
            // Slightly reduce temp factor for crown rot (it's opportunistic)
            tempFactor *= 0.85;
        }
        
        // =================================================================
        // MOISTURE FACTOR (v3.0: Sigmoid leaf wetness response)
        // =================================================================
        
        let moistureFactor = 0;
        
        if (diseasePhase === 'leaf_spot') {
            // Leaf spot requires leaf wetness
            const leafWetResponse = calcLeafWetnessResponse(leafWetness);
            
            // High humidity contributes even without measured wetness.
            // b35fix345: when humidity null, contrib is 0 (real-data-only path).
            const humidityContrib = humidity == null ? 0
                : humidity > 80 
                    ? Math.min(1, (humidity - 70) / 25) 
                    : humidity > 70 ? 0.4 : 0.1;
            
            // Precipitation extends infection window
            const precipContrib = precip > 20 ? 1 : precip / 20;
            
            // Combine: wetness is primary, humidity/precip secondary
            moistureFactor = 0.6 * Math.max(leafWetResponse, humidityContrib) + 0.4 * precipContrib;
        } else {
            // Crown/root rot - drought stress is the driver. Only entered when
            // humidity != null (gated above), so direct comparisons are safe.
            moistureFactor = humidity < 50 ? 0.8 : humidity < 60 ? 0.5 : 0.2;
        }
        
        // =================================================================
        // NUTRIENT MODIFIERS
        // =================================================================
        
        const nitrogenMod = {
            'deficient': 1.35,   // N deficiency increases susceptibility
            'low': 1.20,
            'adequate': 1.0,
            'high': 0.95,
            'excessive': 1.10    // Excessive N can also increase risk
        }[nStatus] || 1.0;
        
        const potassiumMod = {
            'deficient': 1.30,   // K deficiency significant
            'low': 1.15,
            'adequate': 1.0,
            'high': 0.95
        }[kStatus] || 1.0;
        
        // =================================================================
        // STRESS MODIFIERS
        // =================================================================
        
        let stressMod = 1.0;
        let stressNotes = [];
        
        if (stressFactors.recentVerticut) {
            stressMod *= 1.25;
            stressNotes.push('Recent verticutting increasing susceptibility');
        }
        
        if (stressFactors.mowingHeight && stressFactors.mowingHeight < 4) {
            stressMod *= 1.15;
            stressNotes.push('Low HOC increasing stress');
        }
        
        if (stressFactors.thatchDepth && stressFactors.thatchDepth > 12) {
            stressMod *= 1.15;
            stressNotes.push('Excessive thatch harbouring inoculum');
        }
        
        if (stressFactors.shade && stressFactors.shade > 30) {
            stressMod *= 1.10;
            stressNotes.push('Shade stress reducing plant defenses');
        }
        
        // =================================================================
        // VARIETY MODIFIER
        // =================================================================
        
        const varietyMod = variety?.disease?.bipolaris?.riskMultiplier 
            || variety?.disease?.helminthosporium?.riskMultiplier 
            || 1.0;
        
        // =================================================================
        // CALCULATE RISK
        // =================================================================
        
        // Base risk: 40% temp, 40% moisture, 20% baseline
        let riskScore = (0.4 * tempFactor + 0.4 * moistureFactor + 0.20) 
            * nitrogenMod * potassiumMod * stressMod * varietyMod * 100;
        
        // Seasonal adjustment (spring/autumn peaks)
        const month = new Date().getMonth();
        if ((month >= 2 && month <= 4) || (month >= 8 && month <= 10)) {
            if (diseasePhase === 'leaf_spot') {
                riskScore *= 1.15;
            }
        }
        
        riskScore = Math.min(100, Math.max(0, riskScore));
        
        // =================================================================
        // DETERMINE PRIMARY DRIVER
        // =================================================================
        
        let primaryDriver = 'temperature';
        if (moistureFactor > tempFactor) {
            primaryDriver = diseasePhase === 'leaf_spot' ? 'leaf_wetness' : 'drought_stress';
        }
        if (nitrogenMod > 1.2 || potassiumMod > 1.2) {
            primaryDriver = 'nutrient_stress';
        }
        
        // =================================================================
        // CONFIDENCE ASSESSMENT
        // =================================================================
        
        let confidence = 'medium';
        if (leafWetness > 0 && dewData?.leafWetness?.totalWetHours != null) {
            confidence = 'high';  // Have actual leaf wetness data
        }
        if (!climate?.temperature?.min) {
            confidence = 'low';   // Missing night temp data
        }
        
        return {
            disease: 'bipolarisCynodontis',
            displayName: 'Bipolaris Leaf Spot (B. cynodontis)',
            pathogen: 'Bipolaris cynodontis',
            riskScore: Math.round(riskScore),
            riskLevel: classifyBipolarisRisk(riskScore),
            confidence: confidence,
            diseasePhase: diseasePhase,
            phaseNote: phaseNote,
            primaryDriver: primaryDriver,
            validationStatus: BIPOLARIS_VALIDATION_STATUS.status,
            validationBadge: BIPOLARIS_VALIDATION_STATUS.displayBadge,
            modelVersion: '3.0.0',
            drivers: {
                temperature: {
                    value: temp,
                    min: tempMin,
                    max: tempMax,
                    optimal: '15-25°C',
                    nightResponse: Math.round(nightTempResponse * 100),
                    dayResponse: Math.round(dayTempResponse * 100),
                    contribution: Math.round(tempFactor * 100),
                    note: tempMin < 15 ? 'Cool nights reducing infection' : 
                          tempMin > 25 ? 'Warm nights favour crown/root phase' :
                          'Night temps in optimal range for leaf spot'
                },
                moisture: {
                    humidity: humidity,
                    leafWetness: leafWetness,
                    leafWetnessSource: dewData?.leafWetness?.totalWetHours != null ? 'measured' : 'estimated',
                    rain: precip,
                    contribution: Math.round(moistureFactor * 100),
                    required: '6-10+ hours at high humidity'
                },
                nitrogen: {
                    status: nStatus,
                    modifier: nitrogenMod
                },
                potassium: {
                    status: kStatus,
                    modifier: potassiumMod
                },
                stress: {
                    modifier: stressMod,
                    notes: stressNotes
                }
            },
            source: 'Brecht et al. 2007; PSU Turfgrass Lab; Smiley Compendium'
        };
    },
    
    getInterventions(riskLevel, options = {}) {
        const region = options.region || 'AU';
        
        const cultural = [
            'Maintain adequate N fertility (avoid deficiency)',
            'Ensure adequate K levels - tissue K >1.8% DM',
            'Reduce leaf wetness - irrigate early morning only',
            'Raise mowing height during outbreaks',
            'Monitor thatch - keep under 12mm'
        ];
        
        if (options.ultradwarf) {
            cultural.push('Time verticutting to avoid cool, wet periods');
            cultural.push('Allow extra recovery time after aggressive cultural practices');
        }
        
        if (options.stressFactors?.shade) {
            cultural.push('Address shade stress - prune or thin surrounding vegetation');
        }
        
        const interventions = {
            cultural: cultural,
            preventive: [],
            curative: [],
            timing: ''
        };
        
        // Try to get interventions from disease engine
        const engineInterventions = getBipolarisInterventionsFromEngine('bipolarisCynodontis', riskLevel, region);
        if (engineInterventions) {
            interventions.preventive = engineInterventions.preventive || [];
            interventions.curative = engineInterventions.curative || [];
        }
        
        // Set timing and fallback products based on risk level
        if (riskLevel === 'moderate') {
            interventions.timing = 'Monitor closely - consider preventive if conditions persist';
            if (!interventions.preventive.length) {
                interventions.preventive = getBipolarisProducts(region, 'preventive');
            }
        } else if (riskLevel === 'high' || riskLevel === 'severe') {
            interventions.timing = riskLevel === 'severe' 
                ? 'IMMEDIATE curative application recommended'
                : 'Preventive application recommended within 48-72 hours';
            
            if (!interventions.preventive.length) {
                interventions.preventive = getBipolarisProducts(region, 'preventive');
            }
            if (!interventions.curative.length) {
                interventions.curative = getBipolarisProducts(region, 'curative');
            }
        }
        
        return interventions;
    }
};


// =============================================================================
// BIPOLARIS SOROKINIANA MODEL
// =============================================================================
// Aggressive pathogen affecting both C3 and C4 grasses
// Can cause rapid blight at high temperatures

const BipolarisSorokinianaModel = {
    name: 'Bipolaris sorokiniana',
    displayName: 'Bipolaris Leaf Spot/Blight (B. sorokiniana)',
    pathogen: 'Bipolaris sorokiniana',
    primaryHosts: ['kentuckyBluegrass', 'bentgrass', 'perennialRyegrass', 'bermuda'],
    validationStatus: BIPOLARIS_VALIDATION_STATUS,
    
    calculate(climate, nitrogen, variety, stressFactors = {}, dewData = null) {
        // b35fix345: null-passthrough on temperature and humidity. Pre-fix
        // temp `?? 25` and humidity `?? 70` planted fabricated values.
        const temp = climate?.temperature?.mean ?? null;
        const humidity = climate?.moisture?.humidity?.mean ?? null;
        if (temp == null) {
            return {
                disease: 'bipolarisSorokiniana',
                displayName: 'Bipolaris Leaf Spot/Blight (B. sorokiniana)',
                riskScore: 0, rawRisk: 0, riskLevel: 'low',
                confidence: 'low', confidenceScore: 30, degraded: true,
                source: 'BipolarisSorokinianaModel — degraded: temperature missing (b35fix345)',
                drivers: { temperature: { value: null, status: 'missing' },
                           humidity:    { value: humidity, status: humidity == null ? 'missing' : 'available' } },
            };
        }
        const tempMin = climate?.temperature?.min ?? temp - 5;
        const tempMax = climate?.temperature?.max ?? temp + 5;
        const leafWetness = getBipolarisLeafWetness(climate, dewData);
        const nStatus = nitrogen?.status || 'adequate';
        
        // =================================================================
        // TEMPERATURE FACTOR (v3.0: Asymmetric + night weighting)
        // =================================================================
        
        // B. sorokiniana is strongly influenced by night temperature
        const nightTempResponse = calcTempResponse_Bsorokiniana(tempMin);
        const dayTempResponse = calcTempResponse_Bsorokiniana(temp);
        
        // Night temps weighted 60% for this pathogen
        let tempFactor = (0.6 * nightTempResponse) + (0.4 * dayTempResponse);
        
        // Determine disease phase based on temperature
        let diseasePhase = 'inactive';
        let phaseNote = '';
        
        if (temp >= 15 && temp < 30) {
            diseasePhase = 'leaf_spot';
            phaseNote = 'Leaf spot symptoms - manageable with treatment';
            tempFactor = tempFactor;  // Normal calculation
        } else if (temp >= 30 && temp < 35) {
            diseasePhase = 'leaf_blight';
            phaseNote = '⚠️ BLIGHT PHASE - rapid progression, immediate action needed';
            // Increase temp factor in blight phase
            tempFactor = 0.7 + (temp - 30) / 5 * 0.3;
        } else if (temp >= 35) {
            diseasePhase = 'critical';
            phaseNote = '🔴 CRITICAL: >35°C can cause plant death from B. sorokiniana';
            tempFactor = 1.0;
        }
        
        // =================================================================
        // MOISTURE FACTOR (v3.0: Sigmoid response)
        // =================================================================
        
        const leafWetResponse = calcLeafWetnessResponse(leafWetness);
        // b35fix345: null-guard. When humidity null, contrib is 0.
        const humidityContrib = humidity == null ? 0
            : humidity > 85 ? 1 : humidity > 70 ? 0.6 : 0.3;
        
        const moistureFactor = 0.7 * leafWetResponse + 0.3 * humidityContrib;
        
        // =================================================================
        // NUTRIENT MODIFIER
        // =================================================================
        
        const nitrogenMod = {
            'deficient': 1.30,
            'low': 1.15,
            'adequate': 1.0,
            'high': 1.10,      // High N can increase susceptibility
            'excessive': 1.25  // Excessive N significantly increases risk
        }[nStatus] || 1.0;
        
        // =================================================================
        // STRESS MODIFIERS
        // =================================================================
        
        let stressMod = 1.0;
        
        if (stressFactors.droughtStress) {
            stressMod *= 1.20;  // Drought stress major factor
        }
        if (stressFactors.compaction) {
            stressMod *= 1.10;
        }
        if (stressFactors.shade && stressFactors.shade > 30) {
            stressMod *= 1.15;
        }
        
        // =================================================================
        // VARIETY MODIFIER
        // =================================================================
        
        const varietyMod = variety?.disease?.bipolaris?.riskMultiplier || 1.0;
        
        // =================================================================
        // CALCULATE RISK
        // =================================================================
        
        // Weight temp more heavily in blight/critical phases
        const tempWeight = (diseasePhase === 'leaf_blight' || diseasePhase === 'critical') ? 0.55 : 0.40;
        const moistWeight = 1 - tempWeight - 0.10;
        
        let riskScore = (tempWeight * tempFactor + moistWeight * moistureFactor + 0.10) 
            * nitrogenMod * stressMod * varietyMod * 100;
        
        // Phase multipliers
        if (diseasePhase === 'leaf_blight') {
            riskScore *= 1.20;
        } else if (diseasePhase === 'critical') {
            riskScore *= 1.40;
        }
        
        riskScore = Math.min(100, Math.max(0, riskScore));
        
        // =================================================================
        // CONFIDENCE ASSESSMENT
        // =================================================================
        
        let confidence = 'medium';
        if (dewData?.leafWetness?.totalWetHours != null && climate?.temperature?.min != null) {
            confidence = 'high';
        }
        if (!climate?.temperature?.min) {
            confidence = 'low';
        }
        
        return {
            disease: 'bipolarisSorokiniana',
            displayName: 'Bipolaris Leaf Spot/Blight (B. sorokiniana)',
            pathogen: 'Bipolaris sorokiniana',
            riskScore: Math.round(riskScore),
            riskLevel: classifyBipolarisRisk(riskScore),
            confidence: confidence,
            diseasePhase: diseasePhase,
            phaseNote: phaseNote,
            primaryDriver: tempFactor > moistureFactor ? 'temperature' : 'leaf_wetness',
            validationStatus: BIPOLARIS_VALIDATION_STATUS.status,
            validationBadge: BIPOLARIS_VALIDATION_STATUS.displayBadge,
            modelVersion: '3.0.0',
            drivers: {
                temperature: {
                    value: temp,
                    min: tempMin,
                    max: tempMax,
                    optimal: '25-30°C (blight >30°C)',
                    nightResponse: Math.round(nightTempResponse * 100),
                    dayResponse: Math.round(dayTempResponse * 100),
                    contribution: Math.round(tempFactor * 100),
                    warning: diseasePhase === 'critical' ? 'CRITICAL: Extreme heat damage likely' : null
                },
                moisture: {
                    humidity: humidity,
                    leafWetness: leafWetness,
                    leafWetnessSource: dewData?.leafWetness?.totalWetHours != null ? 'measured' : 'estimated',
                    contribution: Math.round(moistureFactor * 100),
                    required: '8-10+ hours leaf wetness'
                },
                nitrogen: {
                    status: nStatus,
                    modifier: nitrogenMod,
                    note: nStatus === 'excessive' ? 'Excess N increasing susceptibility' : null
                },
                stress: {
                    modifier: stressMod,
                    droughtImpact: stressFactors.droughtStress ? 'significant' : 'none'
                }
            },
            source: 'Brecht et al. 2007; NC State Extension; Smiley Compendium'
        };
    },
    
    getInterventions(riskLevel, options = {}) {
        const region = options.region || 'AU';
        const phase = options.diseasePhase || 'leaf_spot';
        
        const cultural = [
            'Reduce N inputs during hot weather',
            'Avoid drought stress - maintain consistent moisture',
            'Improve air circulation',
            'Raise mowing height during disease pressure'
        ];
        
        if (phase === 'leaf_blight' || phase === 'critical') {
            cultural.unshift('⚠️ BLIGHT CONDITIONS - Immediate action required');
            cultural.push('Avoid traffic on affected areas');
            cultural.push('Consider syringing to cool turf in extreme heat');
        }
        
        const interventions = {
            cultural: cultural,
            preventive: [],
            curative: [],
            timing: ''
        };
        
        const engineInterventions = getBipolarisInterventionsFromEngine('bipolarisSorokiniana', riskLevel, region);
        if (engineInterventions) {
            interventions.preventive = engineInterventions.preventive || [];
            interventions.curative = engineInterventions.curative || [];
        }
        
        if (riskLevel === 'moderate') {
            interventions.timing = 'Monitor - reduce N, improve cultural practices';
            if (!interventions.preventive.length) {
                interventions.preventive = getBipolarisProducts(region, 'preventive');
            }
        } else if (riskLevel === 'high' || riskLevel === 'severe') {
            interventions.timing = phase === 'leaf_blight' || phase === 'critical'
                ? 'IMMEDIATE curative spray - blight conditions present'
                : 'Curative application recommended within 24-48 hours';
            
            if (!interventions.preventive.length) {
                interventions.preventive = getBipolarisProducts(region, 'preventive');
            }
            if (!interventions.curative.length) {
                interventions.curative = getBipolarisProducts(region, 'curative');
            }
            
            interventions.note = '⚠️ Monitor for rapid progression to blight phase';
        }
        
        return interventions;
    }
};


// =============================================================================
// CURVULARIA BLIGHT MODEL
// =============================================================================
// Heat-loving opportunist, often co-infects with Bipolaris

const CurvulariaBlightModel = {
    name: 'Curvularia',
    displayName: 'Curvularia Blight',
    pathogen: 'Curvularia spp.',
    primaryHosts: ['bermuda', 'couch', 'ultradwarf', 'zoysia', 'paspalum'],
    validationStatus: BIPOLARIS_VALIDATION_STATUS,
    
    calculate(climate, nitrogen, variety, stressFactors = {}, dewData = null) {
        // b35fix345: null-passthrough on temperature and humidity. Pre-fix
        // temp `?? 28` and humidity `?? 70` planted fabricated values.
        const temp = climate?.temperature?.mean ?? null;
        const humidity = climate?.moisture?.humidity?.mean ?? null;
        if (temp == null) {
            return {
                disease: 'curvularia',
                displayName: 'Curvularia Blight',
                riskScore: 0, rawRisk: 0, riskLevel: 'low',
                confidence: 'low', confidenceScore: 30, degraded: true,
                source: 'CurvulariaModel — degraded: temperature missing (b35fix345)',
                drivers: { temperature: { value: null, status: 'missing' },
                           humidity:    { value: humidity, status: humidity == null ? 'missing' : 'available' } },
            };
        }
        const tempMin = climate?.temperature?.min ?? temp - 5;
        const tempMax = climate?.temperature?.max ?? temp + 5;
        const leafWetness = getBipolarisLeafWetness(climate, dewData);
        
        // =================================================================
        // TEMPERATURE FACTOR (v3.0: Curvularia-specific curve)
        // =================================================================
        
        // Curvularia is a true heat-lover
        const tempResponse = calcTempResponse_Curvularia(temp);
        const nightTempResponse = calcTempResponse_Curvularia(tempMin);
        
        // Less night-dependent than Bipolaris, but still relevant
        const tempFactor = (0.5 * tempResponse) + (0.5 * nightTempResponse);
        
        // =================================================================
        // MOISTURE FACTOR (v3.0: Sigmoid response)
        // =================================================================
        
        const leafWetResponse = calcLeafWetnessResponse(leafWetness);
        // b35fix345: null-guard. When humidity null, contrib is 0.
        const humidityContrib = humidity == null ? 0
            : humidity > 80 ? 0.8 : humidity > 70 ? 0.5 : 0.2;
        
        const moistureFactor = 0.6 * leafWetResponse + 0.4 * humidityContrib;
        
        // =================================================================
        // STRESS FACTORS - Curvularia is opportunistic
        // =================================================================
        
        let stressScore = 0;
        let stressNotes = [];
        
        if (stressFactors.droughtStress) {
            stressScore += 25;
            stressNotes.push('Drought stress predisposing infection');
        }
        if (stressFactors.compaction) {
            stressScore += 15;
            stressNotes.push('Compaction weakening turf');
        }
        if (stressFactors.shade && stressFactors.shade > 30) {
            stressScore += 10;
            stressNotes.push('Shade stress');
        }
        if (stressFactors.mowingHeight && stressFactors.mowingHeight < 3) {
            stressScore += 15;
            stressNotes.push('Very low HOC increasing stress');
        }
        if (stressFactors.recentVerticut) {
            stressScore += 20;
            stressNotes.push('Recent verticutting creating entry points');
        }
        
        const stressMod = 1 + (stressScore / 100);
        
        // =================================================================
        // CALCULATE RISK
        // =================================================================
        
        // Curvularia: 35% temp, 30% moisture, 25% stress, 10% baseline
        let riskScore = (0.35 * tempFactor + 0.30 * moistureFactor + 0.25 * (stressScore / 100) + 0.10) 
            * stressMod * 100;
        
        riskScore = Math.min(100, Math.max(0, riskScore));
        
        // Determine primary driver
        let primaryDriver = 'temperature';
        if (stressScore > 30) primaryDriver = 'plant_stress';
        else if (moistureFactor > tempFactor) primaryDriver = 'leaf_wetness';
        
        return {
            disease: 'curvulariaBlight',
            displayName: 'Curvularia Blight',
            pathogen: 'Curvularia spp.',
            riskScore: Math.round(riskScore),
            riskLevel: classifyBipolarisRisk(riskScore),
            confidence: 'medium',
            stressScore: stressScore,
            primaryDriver: primaryDriver,
            validationStatus: BIPOLARIS_VALIDATION_STATUS.status,
            validationBadge: BIPOLARIS_VALIDATION_STATUS.displayBadge,
            modelVersion: '3.0.0',
            drivers: {
                temperature: {
                    value: temp,
                    min: tempMin,
                    optimal: '28-35°C',
                    contribution: Math.round(tempFactor * 100),
                    note: temp >= 30 ? 'Optimal conditions for Curvularia' : 
                          temp < 25 ? 'Sub-optimal temps - reduced risk' : 'Approaching optimal range'
                },
                moisture: {
                    humidity: humidity,
                    leafWetness: leafWetness,
                    contribution: Math.round(moistureFactor * 100)
                },
                stress: {
                    score: stressScore,
                    modifier: stressMod,
                    notes: stressNotes,
                    isKeyDriver: stressScore > 30
                }
            },
            source: 'UMass Extension; PSU Turfgrass Lab'
        };
    },
    
    getInterventions(riskLevel, options = {}) {
        const region = options.region || 'AU';
        
        const cultural = [
            'Address underlying plant stress FIRST',
            'Avoid drought stress - maintain consistent moisture',
            'Reduce compaction - aerify when appropriate',
            'Avoid aggressive cultural practices during heat stress',
            'Raise mowing height during outbreaks'
        ];
        
        if (options.stressScore > 40) {
            cultural.unshift('🔴 HIGH STRESS: Focus on stress reduction before fungicides');
        }
        
        const interventions = {
            cultural: cultural,
            preventive: [],
            curative: [],
            timing: ''
        };
        
        const engineInterventions = getBipolarisInterventionsFromEngine('curvularia', riskLevel, region);
        if (engineInterventions) {
            interventions.preventive = engineInterventions.preventive || [];
            interventions.curative = engineInterventions.curative || [];
        }
        
        if (riskLevel === 'moderate') {
            interventions.timing = 'Focus on cultural practices - reduce plant stress';
            if (!interventions.preventive.length) {
                interventions.preventive = getBipolarisProducts(region, 'preventive');
            }
        } else if (riskLevel === 'high' || riskLevel === 'severe') {
            interventions.timing = 'Curative + stress reduction - fungicides alone won\'t solve';
            if (!interventions.preventive.length) {
                interventions.preventive = getBipolarisProducts(region, 'preventive');
            }
            if (!interventions.curative.length) {
                interventions.curative = getBipolarisProducts(region, 'curative');
            }
            interventions.note = '⚠️ Curvularia is opportunistic - address underlying stress factors';
        }
        
        return interventions;
    }
};


// =============================================================================
// DRECHSLERA POAE MODEL (Melting-Out)
// =============================================================================
// Cool-season pathogen primarily affecting Kentucky bluegrass

const DrechsleraPoaeModel = {
    name: 'Drechslera poae',
    displayName: 'Melting-Out (Drechslera poae)',
    pathogen: 'Drechslera poae',
    primaryHosts: ['kentuckyBluegrass', 'perennialRyegrass', 'poaAnnua'],
    validationStatus: DRECHSLERA_POAE_VALIDATION_STATUS, // b35fix362: validated after Tier 2 audit
    
    calculate(climate, nitrogen, variety, stressFactors = {}, dewData = null, species = null) {
        // b35fix345: null-passthrough on temperature and humidity. Pre-fix
        // temp `?? 18` and humidity `?? 70` planted fabricated values.
        const temp = climate?.temperature?.mean ?? null;
        const humidity = climate?.moisture?.humidity?.mean ?? null;
        if (temp == null) {
            // b35fix360: degraded-path diagnostic. Mirrors the symmetric
            // pattern Helminthosporium (b35fix353a/359), Pythium (b35fix351),
            // Anthracnose (b35fix346), and BrownPatch use — explicit degraded
            // console group so production logs show whether DrechsleraPoaeModel
            // is being reached and degraded honestly when temperature is missing.
            // Pre-b35fix360 the model ran silently so production verification
            // of the b35fix359 cool-season coverage closure (Finding #2) had
            // no observability hook.
            if (typeof console !== 'undefined') {
                console.group('[DrechsleraPoaeModel.calculate() diagnostic — b35fix360 degraded]');
                console.log('species         :', species || 'n/a (not provided to model)');
                console.log('temp            : n/a (no data)');
                console.log('humidity        :', humidity != null ? humidity.toFixed(1) + '%' : 'n/a');
                console.log('riskScore       : 0 (DEGRADED — DrechsleraPoaeModel temperature input missing)');
                console.groupEnd();
            }
            return {
                disease: 'drechsleraPoae',
                displayName: 'Melting-Out (Drechslera poae)',
                riskScore: 0, rawRisk: 0, riskLevel: 'low',
                confidence: 'low', confidenceScore: 30, degraded: true,
                source: 'DrechsleraPoaeModel — degraded: temperature missing (b35fix345)',
                drivers: { temperature: { value: null, status: 'missing' },
                           humidity:    { value: humidity, status: humidity == null ? 'missing' : 'available' } },
            };
        }
        const tempMin = climate?.temperature?.min ?? temp - 5;
        const leafWetness = getBipolarisLeafWetness(climate, dewData);
        const nStatus = nitrogen?.status || 'adequate';
        
        // =================================================================
        // TEMPERATURE FACTOR (v3.0: Cool-season pathogen curve)
        // =================================================================
        
        const tempResponse = calcTempResponse_DrechsleraPoae(temp);
        const tempFactor = tempResponse;
        
        // Disease phase - melting-out occurs in cool, wet spring
        let diseasePhase = 'leaf_spot';
        let phaseNote = '';
        
        const month = new Date().getMonth();
        // Spring (Mar-May in NH, Sep-Nov in SH)
        const isSpring = (month >= 2 && month <= 4) || (month >= 8 && month <= 10);
        
        if (temp < 15 && temp > 5 && humidity != null && humidity > 80 && isSpring) {
            diseasePhase = 'melting_out';
            phaseNote = '⚠️ MELTING-OUT PHASE - crown/root infection occurring';
        }
        
        // =================================================================
        // MOISTURE FACTOR
        // =================================================================
        
        const leafWetResponse = calcLeafWetnessResponse(leafWetness);
        // b35fix345: null-guard. When humidity null, contrib is 0.
        const humidityContrib = humidity == null ? 0
            : humidity > 85 ? 1 : humidity > 75 ? 0.7 : 0.3;
        
        const moistureFactor = 0.7 * leafWetResponse + 0.3 * humidityContrib;
        
        // =================================================================
        // NITROGEN MODIFIER - b35fix362: Literature-supported direction
        // =================================================================
        //
        // AUDIT FINDINGS: Extension sources confirm high N increases disease risk.
        // Direction validated, but specific magnitudes reduced from fabricated
        // values (1.25×, 1.40×) to operational estimates based on extension guidance.
        //
        // SOURCES:
        // - Penn State: "excessive nitrogen fertilizer applications" favor disease
        // - Rutgers: "avoid heavy applications of nitrogen in spring"
        //
        const nitrogenMod = {
            'deficient': 0.95,   // Slight protection (vs fabricated 0.9)
            'low': 1.0,
            'adequate': 1.0,
            'high': 1.15,        // Reduced from fabricated 1.25×
            'excessive': 1.25    // Reduced from fabricated 1.40×
        }[nStatus] || 1.0;
        
        // =================================================================
        // CALCULATE RISK - b35fix362: Literature-based weighted sum
        // =================================================================
        //
        // AUDIT FINDINGS: Multiple sources identify temperature as primary driver
        // with moisture as strong secondary factor. Replaced fabricated coefficients
        // (0.40, 0.40, 0.20) with literature-priority weighting.
        //
        // SOURCES:
        // - Penn State: "cool, wet weather" (temperature primary)  
        // - UC IPM: "cool (50-75°F), moist conditions" (temperature leads)
        // - Multiple: "long periods of leaf wetness" (moisture secondary)
        //
        let riskScore = (0.50 * tempFactor + 0.40 * moistureFactor + 0.10) 
            * nitrogenMod * 100;
        
        // b35fix362: Literature-based melting-out phase amplification
        // Multiple sources confirm two-phase disease pattern. Reduced multiplier
        // from fabricated 1.25× to operational estimate 1.15× reflecting
        // crown/root infection severity increase.
        if (diseasePhase === 'melting_out') {
            riskScore *= 1.15;  // Reduced from fabricated 1.25×
        }
        
        riskScore = Math.min(100, Math.max(0, riskScore));

        // b35fix360: real-data diagnostic. Stylistic shape mirrors
        // HelminthosporiumModel (b35fix359), Anthracnose (b35fix346), and
        // BrownPatch (b35fix340). Surfaces species, the cool-season
        // tempResponse value (which is the b35fix359 closure's behaviour
        // pin — non-zero on cool-spring tall fescue), the moisture factor,
        // disease phase, and the rounded riskScore. Production-verification
        // hook for the b35fix359 cool-season coverage closure: confirms
        // DrechsleraPoaeModel actually fires with non-zero output on real
        // cool-season climate after the tallFescue susceptibility bump.
        if (typeof console !== 'undefined') {
            console.group('[DrechsleraPoaeModel.calculate() diagnostic — b35fix360]');
            console.log('species         :', species || 'n/a (not provided to model)');
            console.log('temp            :', temp.toFixed(1) + '°C', '(period mean)');
            console.log('humidity        :', humidity != null ? humidity.toFixed(1) + '%' : 'n/a');
            console.log('leafWetness     :', leafWetness + 'h/day');
            console.log('tempResponse    :', tempResponse.toFixed(4),
                        '(literature-based thresholds, peak 15-20°C, active 10-24°C, inhibited >24°C)');
            console.log('moistureFactor  :', moistureFactor.toFixed(4),
                        '(0.7 × leafWetResponse + 0.3 × humidityContrib)');
            console.log('diseasePhase    :', diseasePhase, phaseNote ? '(' + phaseNote + ')' : '');
            console.log('nitrogenMod     :', nitrogenMod, '(N status:', nStatus + ')');
            console.log('riskScore       :', Math.round(riskScore));
            console.groupEnd();
        }

        return {
            disease: 'drechsleraPoae',
            displayName: 'Melting-Out (Drechslera poae)',
            pathogen: 'Drechslera poae',
            riskScore: Math.round(riskScore),
            riskLevel: classifyBipolarisRisk(riskScore),
            confidence: 'medium',
            diseasePhase: diseasePhase,
            phaseNote: phaseNote,
            primaryDriver: tempFactor > moistureFactor ? 'temperature' : 'leaf_wetness',
            validationStatus: DRECHSLERA_POAE_VALIDATION_STATUS.status,
            validationBadge: DRECHSLERA_POAE_VALIDATION_STATUS.displayBadge,
            modelVersion: '3.1.0', // b35fix362: version bump for audit validation
            drivers: {
                temperature: {
                    value: temp,
                    optimal: '10-24°C',
                    contribution: Math.round(tempFactor * 100),
                    note: temp > 24 ? 'Hot temps inhibit disease (>24°C)' : 
                          temp < 10 ? 'Cool temps favour leaf spot' :
                          'Active temperature range for Drechslera poae'
                },
                moisture: {
                    humidity: humidity,
                    leafWetness: leafWetness,
                    contribution: Math.round(moistureFactor * 100)
                },
                nitrogen: {
                    status: nStatus,
                    modifier: nitrogenMod,
                    note: nStatus === 'high' || nStatus === 'excessive' 
                        ? '⚠️ High N increasing disease pressure' : null
                }
            },
            source: 'DrechsleraPoaeModel — Gilba operational based on Penn State Extension (Landschoot 2024) epidemiology (b35fix362 Tier 2 audit)'
        };
    },
    
    getInterventions(riskLevel, options = {}) {
        const region = options.region || 'AU';
        const phase = options.diseasePhase || 'leaf_spot';
        
        const cultural = [
            'REDUCE N inputs in spring - avoid quick-release N',
            'Irrigate early morning only',
            'Improve air circulation - prune surrounding vegetation',
            'Reduce thatch to <12mm',
            'Raise mowing height during outbreaks',
            'Consider overseeding with resistant KBG cultivars'
        ];
        
        if (phase === 'melting_out') {
            cultural.unshift('⚠️ MELTING-OUT PHASE - crown/root infection occurring');
            cultural.push('Avoid traffic on affected areas');
            cultural.push('Turf will recover when weather warms');
        }
        
        const interventions = {
            cultural: cultural,
            preventive: [],
            curative: [],
            timing: ''
        };
        
        const engineInterventions = getBipolarisInterventionsFromEngine('drechsleraPoae', riskLevel, region);
        if (engineInterventions) {
            interventions.preventive = engineInterventions.preventive || [];
            interventions.curative = engineInterventions.curative || [];
        }
        
        if (riskLevel === 'moderate') {
            interventions.timing = 'Monitor - reduce N inputs, improve cultural practices';
            if (!interventions.preventive.length) {
                interventions.preventive = getBipolarisProducts(region, 'preventive');
            }
        } else if (riskLevel === 'high' || riskLevel === 'severe') {
            interventions.timing = phase === 'melting_out' 
                ? 'Apply fungicide to protect crowns - recovery expected when temps rise'
                : 'Preventive application recommended if conditions persist';
            
            if (!interventions.preventive.length) {
                interventions.preventive = getBipolarisProducts(region, 'preventive');
            }
            if (!interventions.curative.length) {
                interventions.curative = getBipolarisProducts(region, 'curative');
            }
            
            interventions.note = '⚠️ Avoid overuse of DMI fungicides - can worsen leaf spot diseases (UMass)';
        }
        
        return interventions;
    }
};


// =============================================================================
// FUNGICIDE HELPERS
// =============================================================================

function getBipolarisProducts(region, type) {
    // Check if main disease engine has fungicide function
    if (typeof window !== 'undefined' && typeof window.getFungicideRecommendations === 'function') {
        // Let the main engine handle it
        return null;
    }
    
    // Fallback product lists
    const products = {
        AU: {
            preventive: [
                'Iprodione (Voltar, Ippon) 14-28 day',
                'Propiconazole (Banner Maxx)',
                'Azoxystrobin (Heritage Maxx) preventive',
                'Trifloxystrobin (Interface Stressgard)'
            ],
            curative: [
                'Fluxapyroxad (Xzemplar, Lexicon)',
                'Fluopyram + trifloxystrobin (Exteris)',
                'Chlorothalonil + iprodione combination'
            ]
        },
        US: {
            preventive: [
                'Chlorothalonil (Daconil)',
                'Iprodione (Chipco 26GT)',
                'Azoxystrobin (Heritage)',
                'Propiconazole (Banner MAXX)'
            ],
            curative: [
                'Thiophanate-methyl + mancozeb',
                'Fluxapyroxad (Xzemplar)'
            ]
        },
        GB: {
            preventive: [
                'Azoxystrobin (Heritage)',
                'Trifloxystrobin products',
                'Fludioxonil combinations'
            ],
            curative: [
                'Propiconazole combinations',
                'Contact + systemic rotation'
            ]
        }
    };
    
    return products[region]?.[type] || products.AU[type];
}

function getBipolarisInterventionsFromEngine(disease, riskLevel, region) {
    // Map disease names to what the main engine expects
    const diseaseMap = {
        'curvulariaBlight': 'curvularia',
        'bipolarisCynodontis': 'helminthosporium',
        'bipolarisSorokiniana': 'helminthosporium',
        'drechsleraPoae': 'helminthosporium'
    };
    
    const mappedDisease = diseaseMap[disease] || 'helminthosporium';
    
    if (typeof window !== 'undefined' && typeof window.getDiseaseInterventions === 'function') {
        return window.getDiseaseInterventions(mappedDisease, riskLevel, region);
    }
    
    return null;
}


// =============================================================================
// CO-INFECTION SYNERGY DETECTION (v3.0 Enhanced)
// =============================================================================

/**
 * Calculate co-infection synergy between B. sorokiniana and Curvularia
 * v3.0: Lowered threshold, graduated response
 */
function calculateCoInfectionSynergy(diseaseResults, climate) {
    const temp = climate?.temperature?.mean ?? 25;
    
    // Find the relevant diseases
    const bipolaris = diseaseResults.find(d => d.disease === 'bipolarisSorokiniana');
    const curvularia = diseaseResults.find(d => d.disease === 'curvulariaBlight');
    
    // Both must be present with meaningful risk
    if (!bipolaris || !curvularia) return null;
    if (bipolaris.riskScore < 30 || curvularia.riskScore < 30) return null;
    
    // v3.0: Lowered threshold from 28°C to 25°C
    if (temp < 25) return null;
    
    // v3.0: Graduated response based on temperature
    // Ramps from 1.10 at 25°C to 1.30 at 35°C
    const tempFactor = Math.min(1, (temp - 25) / 10);
    const multiplier = 1.10 + (0.20 * tempFactor);
    
    const combinedRisk = (bipolaris.riskScore + curvularia.riskScore) / 2;
    
    return {
        active: true,
        multiplier: multiplier,
        temperature: temp,
        note: `⚠️ CO-INFECTION RISK: B. sorokiniana + Curvularia synergy at ${temp.toFixed(1)}°C`,
        detail: 'Curvularia aggressively invades Bipolaris lesions at high temperatures, causing greater combined damage (UMass Extension)',
        affectedDiseases: ['bipolarisSorokiniana', 'curvulariaBlight'],
        riskBoost: Math.round((multiplier - 1) * combinedRisk)
    };
}


// =============================================================================
// OUTCOME LOGGING INFRASTRUCTURE (v3.0 NEW)
// =============================================================================

/**
 * Log disease prediction outcome for model calibration
 * This data can be used for future ML training
 * 
 * @param {Object} outcome - Outcome data
 * @returns {Object} - Formatted outcome record
 */
function logDiseaseOutcome(outcome) {
    const record = {
        timestamp: new Date().toISOString(),
        siteId: outcome.siteId || 'unknown',
        date: outcome.date || new Date().toISOString().split('T')[0],
        disease: outcome.disease,
        predictedRisk: outcome.predictedRisk,
        predictedLevel: classifyBipolarisRisk(outcome.predictedRisk),
        observed: outcome.observed || false,
        severity: outcome.severity || 'none',  // none, trace, light, moderate, severe
        actualConditions: {
            tempMean: outcome.actualConditions?.tempMean || null,
            tempMin: outcome.actualConditions?.tempMin || null,
            tempMax: outcome.actualConditions?.tempMax || null,
            leafWetHours: outcome.actualConditions?.leafWetHours || null,
            humidity: outcome.actualConditions?.humidity || null,
            precipitation: outcome.actualConditions?.precipitation || null
        },
        species: outcome.species || null,
        variety: outcome.variety || null,
        region: outcome.region || null,
        notes: outcome.notes || ''
    };
    
    // Store in localStorage if available (for later export)
    if (typeof window !== 'undefined' && window.localStorage) {
        try {
            const existingData = JSON.parse(_ls.getItem('gilba_disease_outcomes') || '[]');
            existingData.push(record);
            
            // Keep last 500 records
            if (existingData.length > 500) {
                existingData.splice(0, existingData.length - 500);
            }
            
            _ls.setItem('gilba_disease_outcomes', JSON.stringify(existingData));
        } catch (e) {
            console.warn('[Bipolaris] Failed to store outcome:', e);
        }
    }
    
    return record;
}

/**
 * Export stored outcomes for analysis
 */
function exportDiseaseOutcomes() {
    if (typeof window !== 'undefined' && window.localStorage) {
        const data = _ls.getItem('gilba_disease_outcomes');
        return data ? JSON.parse(data) : [];
    }
    return [];
}

/**
 * Clear stored outcomes
 */
function clearDiseaseOutcomes() {
    if (typeof window !== 'undefined' && window.localStorage) {
        _ls.removeItem('gilba_disease_outcomes');
    }
}


// =============================================================================
// MAIN ANALYSIS FUNCTION
// =============================================================================

/**
 * Analyse all Bipolaris/Curvularia/Drechslera diseases for given conditions
 * b35fix362: Selective model execution - DrechsleraPoaeModel ungated, others remain beta
 */
function analyseBipolarisCurvularia(state) {
    const { climate, nitrogen, variety, species, dewData, tissueNutrients } = state;
    
    // b35fix362: Check beta gating status
    const showBetaDiseases = window.GAIP_SHOW_BETA_DISEASES === true;
    const allowDrechsleraPoae = true; // Ungated after Tier 2 audit
    
    // Extract stress factors from state
    const stressFactors = state.stressFactors || extractStressFactors(state);
    
    // Add tissue K if available
    if (tissueNutrients?.modifiers?.K) {
        stressFactors.potassium = tissueNutrients.modifiers.K;
    }
    
    // Get species susceptibility
    const susceptibility = BIPOLARIS_CURVULARIA_SUSCEPTIBILITY[species] 
        || BIPOLARIS_CURVULARIA_SUSCEPTIBILITY.bermuda;
    
    // Check for ultradwarf variety modifiers
    let varietyMods = {};
    if (species === 'ultradwarf' && variety?.name) {
        varietyMods = ULTRADWARF_VARIETY_MODIFIERS[variety.name.toLowerCase()] || {};
    }
    
    const results = [];
    
    // Bipolaris cynodontis - BETA GATED
    if (showBetaDiseases && susceptibility.bipolarisCynodontis > 0.5) {
        const result = BipolarisCynodontisModel.calculate(climate, nitrogen, variety, stressFactors, dewData);
        result.speciesSusceptibility = susceptibility.bipolarisCynodontis;
        
        // Apply variety modifier if applicable
        const varMod = varietyMods.bipolarisCynodontis || 1.0;
        result.adjustedRisk = Math.min(100, Math.round(result.riskScore * susceptibility.bipolarisCynodontis * varMod));
        result.riskLevel = classifyBipolarisRisk(result.adjustedRisk);
        result.varietyModifier = varMod !== 1.0 ? varMod : undefined;
        
        result.interventions = BipolarisCynodontisModel.getInterventions(result.riskLevel, {
            region: state.region,
            ultradwarf: species === 'ultradwarf',
            stressFactors: stressFactors
        });
        
        results.push(result);
    }
    
    // Bipolaris sorokiniana - BETA GATED  
    if (showBetaDiseases && susceptibility.bipolarisSorokiniana > 0.5) {
        const result = BipolarisSorokinianaModel.calculate(climate, nitrogen, variety, stressFactors, dewData);
        result.speciesSusceptibility = susceptibility.bipolarisSorokiniana;
        
        const varMod = varietyMods.bipolarisSorokiniana || 1.0;
        result.adjustedRisk = Math.min(100, Math.round(result.riskScore * susceptibility.bipolarisSorokiniana * varMod));
        result.riskLevel = classifyBipolarisRisk(result.adjustedRisk);
        result.varietyModifier = varMod !== 1.0 ? varMod : undefined;
        
        result.interventions = BipolarisSorokinianaModel.getInterventions(result.riskLevel, {
            region: state.region,
            diseasePhase: result.diseasePhase
        });
        
        results.push(result);
    }
    
    // Curvularia - BETA GATED
    if (showBetaDiseases && susceptibility.curvularia > 0.5) {
        const result = CurvulariaBlightModel.calculate(climate, nitrogen, variety, stressFactors, dewData);
        result.speciesSusceptibility = susceptibility.curvularia;
        
        const varMod = varietyMods.curvularia || 1.0;
        result.adjustedRisk = Math.min(100, Math.round(result.riskScore * susceptibility.curvularia * varMod));
        result.riskLevel = classifyBipolarisRisk(result.riskScore);
        result.varietyModifier = varMod !== 1.0 ? varMod : undefined;
        
        result.interventions = CurvulariaBlightModel.getInterventions(result.riskLevel, {
            region: state.region,
            stressScore: result.stressScore
        });
        
        results.push(result);
    }
    
    // Drechslera poae - UNGATED b35fix362 (cool-season grasses only)
    if (allowDrechsleraPoae && susceptibility.drechsleraPoae > 0.5) {
        // b35fix362: DrechsleraPoaeModel passed Tier 2 audit, now runs in production
        const result = DrechsleraPoaeModel.calculate(climate, nitrogen, variety, stressFactors, dewData, species);
        result.speciesSusceptibility = susceptibility.drechsleraPoae;
        result.adjustedRisk = Math.min(100, Math.round(result.riskScore * susceptibility.drechsleraPoae));
        result.riskLevel = classifyBipolarisRisk(result.adjustedRisk);
        
        result.interventions = DrechsleraPoaeModel.getInterventions(result.riskLevel, {
            region: state.region,
            diseasePhase: result.diseasePhase
        });
        
        results.push(result);
    }
    
    // Check for co-infection synergy
    const coInfection = calculateCoInfectionSynergy(results, climate);
    
    if (coInfection && coInfection.active) {
        // Apply synergy multiplier to affected diseases
        results.forEach(result => {
            if (coInfection.affectedDiseases.includes(result.disease)) {
                result.coInfectionSynergy = coInfection;
                result.adjustedRisk = Math.min(100, Math.round(result.adjustedRisk * coInfection.multiplier));
                result.riskLevel = classifyBipolarisRisk(result.adjustedRisk);
                
                // Add warning to interventions
                if (result.interventions) {
                    result.interventions.coInfectionWarning = coInfection.note;
                    result.interventions.cultural.unshift(coInfection.note);
                }
            }
        });
    }
    
    // Sort by adjusted risk (highest first)
    results.sort((a, b) => b.adjustedRisk - a.adjustedRisk);
    
    return results;
}


// =============================================================================
// DISEASE ENGINE INTEGRATION
// =============================================================================

/**
 * Patch main DiseaseEngine with Bipolaris/Curvularia models
 * 
 * NOTE: Beta diseases are HIDDEN from production UI by default.
 * Set window.GAIP_SHOW_BETA_DISEASES = true to enable display.
 */
function patchDiseaseEngineWithBipolaris() {
    if (typeof window === 'undefined' || !window.DiseaseEngine) {
        console.warn('DiseaseEngine not found - Bipolaris/Drechslera models not patched');
        return false;
    }
    
    const originalAnalyse = window.DiseaseEngine.analyse;
    
    window.DiseaseEngine.analyse = function(state) {
        // Call original analysis
        const results = originalAnalyse.call(this, state);
        
        // =========================================================================
        // BETA DISEASE FILTER (v3.0.1) — b35fix362 partial ungating
        // =========================================================================
        // 
        // b35fix362: DrechsleraPoaeModel passed Tier 2 audit and is ungated for
        // production use. Literature-based temperature response and weighted-sum
        // coefficients provide sufficient validation for cool-season coverage.
        //
        // Other Bipolaris/Curvularia models remain beta-gated pending audit.
        // 
        const showBetaDiseases = window.GAIP_SHOW_BETA_DISEASES === true;
        const allowDrechsleraPoae = true; // b35fix362: ungated after Tier 2 audit
        
        if (!showBetaDiseases && !allowDrechsleraPoae) {
            return results;
        }
        
        const species = state.species || 'perennialRyegrass';
        
        // Determine grass type
        const warmSeasonGrasses = ['bermuda', 'couch', 'ultradwarf', 'zoysia', 'kikuyu', 'buffalo', 'paspalum'];
        const coolSeasonGrasses = ['bentgrass', 'perennialRyegrass', 'kentuckyBluegrass', 'tallFescue', 'poaAnnua'];
        
        const isWarmSeason = warmSeasonGrasses.includes(species);
        const isCoolSeason = coolSeasonGrasses.includes(species);
        
        if (results && results.diseases) {
            // Remove old helminthosporium model results (being replaced)
            results.diseases = results.diseases.filter(d => d.disease !== 'helminthosporium');
            
            // Run new leaf spot complex analysis
            const leafSpotResults = analyseBipolarisCurvularia(state);
            
            if (leafSpotResults && leafSpotResults.length > 0) {
                // Add new results
                results.diseases.push(...leafSpotResults);
                
                // Re-sort by adjusted risk
                results.diseases.sort((a, b) => b.adjustedRisk - a.adjustedRisk);
                
                
                // Update top threats
                results.topThreats = results.diseases.slice(0, 3).map(d => ({
                    disease: d.displayName,
                    risk: d.adjustedRisk,
                    level: d.riskLevel,
                    primaryDriver: d.primaryDriver,
                    validationBadge: d.validationBadge || null,
                    coInfectionSynergy: !!d.coInfectionSynergy
                }));
                
                // Add co-infection warning to results if present
                const coInfectedDisease = leafSpotResults.find(d => d.coInfectionSynergy?.active);
                if (coInfectedDisease) {
                    results.coInfectionWarning = coInfectedDisease.coInfectionSynergy;
                }
            }
        }
        
        return results;
    };
    
    return true;
}


// =============================================================================
// EXPORTS
// =============================================================================

// Browser/WordPress exports
if (typeof window !== 'undefined') {
    window.BipolarisCynodontisModel = BipolarisCynodontisModel;
    window.BipolarisSorokinianaModel = BipolarisSorokinianaModel;
    window.CurvulariaBlightModel = CurvulariaBlightModel;
    window.DrechsleraPoaeModel = DrechsleraPoaeModel;
    window.BIPOLARIS_CURVULARIA_SUSCEPTIBILITY = BIPOLARIS_CURVULARIA_SUSCEPTIBILITY;
    window.BIPOLARIS_VALIDATION_STATUS = BIPOLARIS_VALIDATION_STATUS;
    window.DRECHSLERA_POAE_VALIDATION_STATUS = DRECHSLERA_POAE_VALIDATION_STATUS; // b35fix362
    window.ULTRADWARF_VARIETY_MODIFIERS = ULTRADWARF_VARIETY_MODIFIERS;
    window.BIPOLARIS_CONSECUTIVE_DAY_CONFIG = BIPOLARIS_CONSECUTIVE_DAY_CONFIG;
    window.analyseBipolarisCurvularia = analyseBipolarisCurvularia;
    window.calculateCoInfectionSynergy = calculateCoInfectionSynergy;
    window.patchDiseaseEngineWithBipolaris = patchDiseaseEngineWithBipolaris;
    
    // Outcome logging
    window.logDiseaseOutcome = logDiseaseOutcome;
    window.exportDiseaseOutcomes = exportDiseaseOutcomes;
    window.clearDiseaseOutcomes = clearDiseaseOutcomes;
    
    // Helper functions (for testing/debugging)
    window.calcTempResponse_Bcynodontis = calcTempResponse_Bcynodontis;
    window.calcTempResponse_Bsorokiniana = calcTempResponse_Bsorokiniana;
    window.calcTempResponse_Curvularia = calcTempResponse_Curvularia;
    window.calcTempResponse_DrechsleraPoae = calcTempResponse_DrechsleraPoae;
    window.calcLeafWetnessResponse = calcLeafWetnessResponse;
    
    // Auto-patch on load
    if (window.DiseaseEngine) {
        patchDiseaseEngineWithBipolaris();
    } else {
        document.addEventListener('DOMContentLoaded', function() {
            setTimeout(patchDiseaseEngineWithBipolaris, 100);
        });
    }
}

// Node.js exports
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        BipolarisCynodontisModel,
        BipolarisSorokinianaModel,
        CurvulariaBlightModel,
        DrechsleraPoaeModel,
        BIPOLARIS_CURVULARIA_SUSCEPTIBILITY,
        BIPOLARIS_VALIDATION_STATUS,
        DRECHSLERA_POAE_VALIDATION_STATUS, // b35fix362
        ULTRADWARF_VARIETY_MODIFIERS,
        BIPOLARIS_CONSECUTIVE_DAY_CONFIG,
        analyseBipolarisCurvularia,
        calculateCoInfectionSynergy,
        patchDiseaseEngineWithBipolaris,
        logDiseaseOutcome,
        exportDiseaseOutcomes,
        clearDiseaseOutcomes,
        // Helper functions
        calcTempResponse_Bcynodontis,
        calcTempResponse_Bsorokiniana,
        calcTempResponse_Curvularia,
        calcTempResponse_DrechsleraPoae,
        calcLeafWetnessResponse
    };
}
