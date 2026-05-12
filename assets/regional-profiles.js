/**
 * GILBA REGIONAL PROFILES v1.0.0
 * 
 * Comprehensive location-aware turf management data
 * 
 * Features:
 * - Region detection from lat/lon coordinates
 * - Region-specific variety databases
 * - Disease pressure multipliers by region
 * - Climate characteristic adjustments
 * - Growing season parameters
 * 
 * Regions Supported:
 * - UK & Ireland (BSPB/STRI data)
 * - Scandinavia (Scanturf focus)
 * - Continental Europe (GEVES/BSA)
 * - Mediterranean Europe
 * - US Northern Cool Season
 * - US Transition Zone
 * - US Southern (warm season)
 * - Australia/NZ
 * - South Africa
 * - East Asia (Japan/Korea)
 * 
 * @author Gilba Solutions
 * @version 1.0.0
 */

(function(global) {
    'use strict';


    // ═══════════════════════════════════════════════════════════════════════════
    // REGION DEFINITIONS
    // ═══════════════════════════════════════════════════════════════════════════

    const REGIONS = {
        
        // ───────────────────────────────────────────────────────────────────────
        // UK & IRELAND
        // Maritime climate, mild winters, wet summers
        // Primary data: BSPB Turfgrass Seed (STRI trials at Bingley)
        // ───────────────────────────────────────────────────────────────────────
        'uk_ireland': {
            id: 'uk_ireland',
            name: 'UK & Ireland',
            description: 'Maritime climate with mild winters and cool, wet summers',
            dataSource: 'BSPB Turfgrass Seed 2025 (STRI trials, Bingley)',
            
            climate: {
                type: 'maritime_temperate',
                winterSeverity: 'mild',        // 0-5 scale: 2
                summerHeat: 'cool',            // 0-5 scale: 2
                rainfall: 'high',              // Annual 800-1400mm
                humidityPressure: 'high',
                growingSeasonStart: 'March',
                growingSeasonEnd: 'October',
                growingDegreeDaysAnnual: 1200, // Base 0°C
                frostFreeDays: 200
            },
            
            diseaseMultipliers: {
                // Relative to baseline (1.0)
                fusarium: 1.20,          // High - maritime humidity
                redThread: 1.30,         // Very high - UK signature disease
                dollarSpot: 0.85,        // Moderate - less heat
                brownPatch: 0.70,        // Lower - cooler summers
                pythium: 0.90,           // Moderate
                anthracnose: 0.95,       // Moderate
                takeAllPatch: 1.15,      // Elevated - common on bent/poa
                springDeadSpot: 0.0,     // N/A - no bermuda
                grayLeafSpot: 0.60,      // Low - cooler climate
                snowMould: 0.80,         // Moderate - mild winters
                leafSpot: 1.00           // Baseline
            },
            
            grassTypes: {
                primary: ['Perennial Ryegrass', 'Creeping Bentgrass', 'Annual Bluegrass'],
                secondary: ['Tall Fescue', 'Kentucky Bluegrass', 'Fine Fescues'],
                warmSeason: false,
                overseedCommon: false
            },
            
            managementNotes: [
                'Red thread pressure highest May-June and Sept-Oct',
                'Fusarium risk peaks in autumn/winter',
                'Disease pressure generally higher than continental Europe',
                'Bent/Poa greens susceptible to take-all patch',
                'Growth potential peaks May-July'
            ],
            
            // Priority traits for variety selection in UK climate
            traitPriorities: {
                critical: ['redThread', 'fusarium', 'wear'],
                important: ['recovery', 'disease_general', 'cold'],
                beneficial: ['density', 'winterColor', 'springGreenup']
            }
        },

        // ───────────────────────────────────────────────────────────────────────
        // SCANDINAVIA
        // Cold winters, short growing season, snow mould critical
        // Primary data: Scanturf trials
        // ───────────────────────────────────────────────────────────────────────
        'scandinavia': {
            id: 'scandinavia',
            name: 'Scandinavia',
            description: 'Cold winters with snow cover, short intense growing season',
            dataSource: 'Scanturf trials (Nordic evaluation)',
            
            climate: {
                type: 'cold_temperate',
                winterSeverity: 'severe',      // 0-5 scale: 4-5
                summerHeat: 'mild',            // 0-5 scale: 2
                rainfall: 'moderate',          // 500-800mm
                humidityPressure: 'moderate',
                growingSeasonStart: 'May',
                growingSeasonEnd: 'September',
                growingDegreeDaysAnnual: 800,  // Base 0°C
                frostFreeDays: 120,
                snowCoverDays: 90             // Critical for snow mould
            },
            
            diseaseMultipliers: {
                fusarium: 1.40,          // Very high - Microdochium nivale dominant
                redThread: 0.70,         // Lower - shorter season
                dollarSpot: 0.50,        // Low - too cold
                brownPatch: 0.40,        // Very low
                pythium: 0.60,           // Low
                anthracnose: 0.70,       // Low-moderate
                takeAllPatch: 0.80,      // Moderate
                springDeadSpot: 0.0,     // N/A
                grayLeafSpot: 0.30,      // Very low
                snowMould: 1.80,         // CRITICAL - Typhula/Microdochium
                pinkSnowMould: 1.90,     // CRITICAL
                leafSpot: 0.90
            },
            
            grassTypes: {
                primary: ['Perennial Ryegrass', 'Kentucky Bluegrass', 'Creeping Bentgrass'],
                secondary: ['Fine Fescues', 'Rough Bluegrass'],
                warmSeason: false,
                overseedCommon: false,
                winterHardinessRequired: true
            },
            
            managementNotes: [
                'Snow mould prevention critical - autumn fungicide timing',
                'Winter hardiness is primary variety selection criterion',
                'Short renovation windows - rapid establishment essential',
                '4turf tetraploids valuable for cold germination',
                'Ice damage can be significant',
                'Consider varieties with Scanturf winter survival ratings'
            ],
            
            // Priority traits for variety selection in Nordic climate
            traitPriorities: {
                critical: ['snowMould', 'cold', 'fusarium'],
                important: ['winterColor', 'springGreenup', 'recovery'],
                beneficial: ['wear', 'density', 'disease_general']
            }
        },

        // ───────────────────────────────────────────────────────────────────────
        // CONTINENTAL EUROPE
        // Cold winters, warm summers, less maritime influence
        // Primary data: GEVES (France), BSA (Germany)
        // ───────────────────────────────────────────────────────────────────────
        'continental_europe': {
            id: 'continental_europe',
            name: 'Continental Europe',
            description: 'Continental climate with cold winters and warm summers',
            dataSource: 'GEVES (France), BSA (Germany), EU variety trials',
            countries: ['France', 'Germany', 'Belgium', 'Netherlands', 'Switzerland', 'Austria', 'Poland', 'Czech Republic'],
            
            climate: {
                type: 'continental_temperate',
                winterSeverity: 'moderate',    // 0-5 scale: 3
                summerHeat: 'warm',            // 0-5 scale: 3-4
                rainfall: 'moderate',          // 600-900mm
                humidityPressure: 'moderate',
                growingSeasonStart: 'April',
                growingSeasonEnd: 'October',
                growingDegreeDaysAnnual: 1400,
                frostFreeDays: 170
            },
            
            diseaseMultipliers: {
                fusarium: 0.90,          // Lower than UK - less maritime
                redThread: 0.80,         // Lower - drier summers
                dollarSpot: 1.10,        // Higher - warmer summers
                brownPatch: 1.15,        // Higher - summer heat
                pythium: 1.05,           // Moderate-elevated
                anthracnose: 1.10,       // Elevated - heat stress
                takeAllPatch: 0.90,      // Moderate
                springDeadSpot: 0.0,     // N/A (mostly)
                grayLeafSpot: 0.90,      // Moderate
                snowMould: 1.10,         // Elevated in alpine/eastern areas
                leafSpot: 1.00
            },
            
            grassTypes: {
                primary: ['Perennial Ryegrass', 'Kentucky Bluegrass', 'Creeping Bentgrass'],
                secondary: ['Tall Fescue', 'Fine Fescues'],
                warmSeason: false,
                overseedCommon: false,
                droughtToleranceValued: true
            },
            
            managementNotes: [
                'Summer stress more significant than UK',
                'Brown patch risk in warm summers',
                'Drought tolerance increasingly important',
                'Euro-bred varieties (DSV, Barenbrug) widely available',
                'Cold hardiness still required for eastern regions'
            ]
        },

        // ───────────────────────────────────────────────────────────────────────
        // GERMANY
        // Continental climate, BSA trial data
        // ───────────────────────────────────────────────────────────────────────
        'germany': {
            id: 'germany',
            name: 'Germany',
            description: 'Continental climate with cold winters and warm summers',
            dataSource: 'BSA (Bundessortenamt) Rasengräser trials',
            countries: ['Germany'],
            
            climate: {
                type: 'continental_temperate',
                winterSeverity: 'moderate_cold',   // 0-5 scale: 3-4
                summerHeat: 'warm',                // 0-5 scale: 3
                rainfall: 'moderate',              // 600-800mm
                humidityPressure: 'moderate',
                growingSeasonStart: 'April',
                growingSeasonEnd: 'October',
                growingDegreeDaysAnnual: 1300,
                frostFreeDays: 160
            },
            
            diseaseMultipliers: {
                fusarium: 0.95,          // Moderate - less maritime than UK
                redThread: 0.85,         // Lower than UK - drier summers
                dollarSpot: 1.05,        // Slightly elevated
                brownPatch: 1.10,        // Elevated - summer heat
                pythium: 1.00,           // Average
                anthracnose: 1.05,       // Slightly elevated
                takeAllPatch: 0.90,      // Moderate
                springDeadSpot: 0.0,     // N/A - no warm-season grasses
                grayLeafSpot: 0.85,      // Lower - cool climate
                snowMould: 1.15,         // Elevated - cold winters
                leafSpot: 1.00
            },
            
            grassTypes: {
                primary: ['Perennial Ryegrass', 'Kentucky Bluegrass', 'Creeping Bentgrass'],
                secondary: ['Tall Fescue', 'Fine Fescues'],
                warmSeason: false,
                overseedCommon: true,    // Stadium turf renovation
                droughtToleranceValued: true
            },
            
            managementNotes: [
                'BSA (Bundessortenamt) variety trials are primary data source',
                'DSV-bred varieties (Eurogala, Eurobeat, etc.) dominate market',
                'High wear tolerance required for Bundesliga stadiums',
                'Cold hardiness essential for winter months',
                'Summer drought stress increasing with climate change',
                'RSM (Regel-Saatgut-Mischung) standards for seed mixtures'
            ]
        },

        // ───────────────────────────────────────────────────────────────────────
        // MEDITERRANEAN EUROPE
        // Hot dry summers, mild wet winters
        // ───────────────────────────────────────────────────────────────────────
        'mediterranean': {
            id: 'mediterranean',
            name: 'Mediterranean Europe',
            description: 'Hot dry summers with mild wet winters',
            dataSource: 'Regional trials, Italian/Spanish research',
            countries: ['Spain', 'Portugal', 'Italy', 'Southern France', 'Greece'],
            
            climate: {
                type: 'mediterranean',
                winterSeverity: 'mild',        // 0-5 scale: 1-2
                summerHeat: 'hot',             // 0-5 scale: 4-5
                rainfall: 'low_seasonal',      // 400-600mm, mostly winter
                humidityPressure: 'low_summer',
                growingSeasonStart: 'October', // Reversed - cool season growth
                growingSeasonEnd: 'May',
                summerDormancyCommon: true,
                growingDegreeDaysAnnual: 2200,
                frostFreeDays: 280
            },
            
            diseaseMultipliers: {
                fusarium: 0.50,          // Low - too dry
                redThread: 0.40,         // Low - summer drought
                dollarSpot: 1.30,        // High - irrigation creates conditions
                brownPatch: 1.40,        // High - heat
                pythium: 1.50,           // High - irrigation + heat
                anthracnose: 1.40,       // High - heat stress
                takeAllPatch: 0.70,      // Lower
                springDeadSpot: 0.50,    // Some bermuda areas
                grayLeafSpot: 1.20,      // Elevated
                snowMould: 0.0,          // N/A
                leafSpot: 1.10
            },
            
            grassTypes: {
                primary: ['Bermudagrass', 'Seashore Paspalum', 'Tall Fescue'],
                secondary: ['Perennial Ryegrass (overseed)', 'Kikuyu', 'Zoysia'],
                warmSeason: true,
                overseedCommon: true,
                droughtToleranceRequired: true
            },
            
            managementNotes: [
                'C4 grasses dominant at lower elevations',
                'Winter overseed with PRG common on bermuda',
                'Irrigation management critical',
                'Pythium pressure high on irrigated turf',
                'Summer stress management primary concern',
                'Salinity tolerance often required (coastal)'
            ]
        },

        // ───────────────────────────────────────────────────────────────────────
        // US NORTHERN COOL SEASON
        // Cold winters, variable summers, NTEP data
        // ───────────────────────────────────────────────────────────────────────
        'us_north': {
            id: 'us_north',
            name: 'US Northern',
            description: 'Cold winters with warm to hot summers',
            dataSource: 'NTEP (National Turfgrass Evaluation Program)',
            states: ['New York', 'Michigan', 'Wisconsin', 'Minnesota', 'New England', 'Pacific Northwest'],
            
            climate: {
                type: 'continental_cold',
                winterSeverity: 'severe',
                summerHeat: 'warm_variable',
                rainfall: 'moderate',
                humidityPressure: 'variable',
                growingSeasonStart: 'April',
                growingSeasonEnd: 'October',
                growingDegreeDaysAnnual: 1300,
                frostFreeDays: 150
            },
            
            diseaseMultipliers: {
                fusarium: 0.80,          // Lower than UK
                redThread: 0.70,         // Lower
                dollarSpot: 1.40,        // HIGH - major US issue
                brownPatch: 1.10,        // Elevated in summer
                pythium: 1.15,           // Elevated
                anthracnose: 1.20,       // Significant on Poa
                takeAllPatch: 0.90,
                springDeadSpot: 0.0,     // N/A
                grayLeafSpot: 1.00,
                snowMould: 1.20,         // Northern areas
                leafSpot: 1.00
            },
            
            grassTypes: {
                primary: ['Kentucky Bluegrass', 'Perennial Ryegrass', 'Creeping Bentgrass'],
                secondary: ['Tall Fescue', 'Fine Fescues'],
                warmSeason: false,
                overseedCommon: false
            },
            
            managementNotes: [
                'Dollar spot is primary disease concern',
                'NTEP data directly applicable',
                'Kentucky Bluegrass dominant in lawns',
                'Bentgrass standard for golf greens',
                'Winter injury possible in extreme years'
            ]
        },

        // ───────────────────────────────────────────────────────────────────────
        // US TRANSITION ZONE
        // Both C3 and C4 grasses struggle
        // ───────────────────────────────────────────────────────────────────────
        'us_transition': {
            id: 'us_transition',
            name: 'US Transition Zone',
            description: 'Challenging zone where both cool and warm season grasses struggle',
            dataSource: 'NTEP',
            states: ['Virginia', 'Kentucky', 'Tennessee', 'Missouri', 'Kansas', 'Oklahoma (north)'],
            
            climate: {
                type: 'transition',
                winterSeverity: 'moderate',
                summerHeat: 'hot',
                rainfall: 'moderate',
                humidityPressure: 'high_summer',
                growingSeasonStart: 'March',
                growingSeasonEnd: 'November',
                growingDegreeDaysAnnual: 1800,
                frostFreeDays: 200
            },
            
            diseaseMultipliers: {
                fusarium: 0.70,
                redThread: 0.60,
                dollarSpot: 1.30,
                brownPatch: 1.50,        // Major issue
                pythium: 1.40,           // Hot humid summers
                anthracnose: 1.30,
                takeAllPatch: 0.80,
                springDeadSpot: 1.20,    // On bermuda
                grayLeafSpot: 1.30,      // Significant
                snowMould: 0.60,
                leafSpot: 1.10
            },
            
            grassTypes: {
                primary: ['Tall Fescue', 'Zoysiagrass', 'Bermudagrass'],
                secondary: ['Kentucky Bluegrass', 'Perennial Ryegrass'],
                warmSeason: 'mixed',
                overseedCommon: true
            },
            
            managementNotes: [
                'Most challenging turf region',
                'C3 grasses suffer summer stress',
                'C4 grasses suffer winter injury',
                'Tall fescue or zoysia often best choices',
                'Brown patch and gray leaf spot major issues',
                'Consider bermuda with winter overseed'
            ]
        },

        // ───────────────────────────────────────────────────────────────────────
        // US SOUTHERN
        // Warm season grasses, hot humid
        // ───────────────────────────────────────────────────────────────────────
        'us_south': {
            id: 'us_south',
            name: 'US Southern',
            description: 'Warm season grass zone with hot, humid summers',
            dataSource: 'NTEP',
            states: ['Florida', 'Georgia', 'Alabama', 'Louisiana', 'Texas (south)', 'South Carolina'],
            
            climate: {
                type: 'subtropical',
                winterSeverity: 'mild',
                summerHeat: 'hot',
                rainfall: 'high',
                humidityPressure: 'very_high',
                growingSeasonStart: 'February',
                growingSeasonEnd: 'November',
                growingDegreeDaysAnnual: 2500,
                frostFreeDays: 270
            },
            
            diseaseMultipliers: {
                fusarium: 0.30,
                redThread: 0.20,
                dollarSpot: 1.20,
                brownPatch: 1.60,        // Major - large patch on zoysia
                pythium: 1.70,           // Critical
                anthracnose: 1.20,
                takeAllPatch: 0.50,
                springDeadSpot: 1.30,    // Significant on bermuda
                grayLeafSpot: 1.50,      // Major issue
                snowMould: 0.0,
                leafSpot: 1.30,
                takeAllRoot: 1.40        // Bermuda specific
            },
            
            grassTypes: {
                primary: ['Bermudagrass', 'Zoysiagrass', 'St. Augustinegrass', 'Seashore Paspalum'],
                secondary: ['Centipedegrass', 'Bahiagrass'],
                warmSeason: true,
                overseedCommon: true
            },
            
            managementNotes: [
                'Warm season grasses dominant',
                'Winter overseed with ryegrass common',
                'Disease pressure very high year-round',
                'Pythium and gray leaf spot critical',
                'Nematode damage significant',
                'Salt tolerance important (coastal)'
            ]
        },

        // ───────────────────────────────────────────────────────────────────────
        // AUSTRALIA - TROPICAL
        // Darwin, Cairns, Townsville - Year-round heat, wet/dry seasons
        // NTEP Match: South Florida, Hawaii
        // ───────────────────────────────────────────────────────────────────────
        'australia_tropical': {
            id: 'australia_tropical',
            name: 'Tropical Australia',
            description: 'Year-round heat, monsoonal wet/dry seasons',
            dataSource: 'Australian turf trials, NTEP Florida/Hawaii adaptation',
            ntepMatch: 'us_south',
            
            bounds: {
                latMin: -23.5,
                latMax: -10,
                lonMin: 113,
                lonMax: 154
            },
            
            exampleCities: ['Darwin', 'Cairns', 'Townsville', 'Broome'],
            
            climate: {
                type: 'tropical',
                winterSeverity: 'none',
                summerHeat: 'extreme',
                rainfall: 'seasonal_wet',
                humidityPressure: 'very_high',
                growingSeasonStart: 'Year-round',
                growingSeasonEnd: 'Year-round',
                growingDegreeDaysAnnual: 3500,
                frostFreeDays: 365
            },
            
            // Priority traits for variety selection in this climate
            traitPriorities: {
                critical: ['heat', 'pythium', 'humidity_stress'],
                high: ['drought', 'salinity', 'wet_season_disease'],
                medium: ['wear'],
                low: ['cold', 'winterColor', 'springGreenup']
            },
            
            diseaseMultipliers: {
                fusarium: 0.40,           // Rare - too hot
                redThread: 0.30,          // Rare - too hot
                dollarSpot: 1.40,         // High - warm nights
                brownPatch: 1.50,         // Very high - heat + humidity
                pythium: 1.60,            // Critical - constant humidity
                anthracnose: 1.30,
                takeAllPatch: 0.50,
                springDeadSpot: 0.80,     // Lower - no cold stress
                grayLeafSpot: 1.20,
                snowMould: 0.0,
                leafSpot: 1.20,
                curvularia: 1.50,         // Very high - tropical
                helminthosporium: 1.40
            },
            
            grassTypes: {
                primary: ['Couch (Bermudagrass)', 'Zoysia'],
                secondary: ['Seashore Paspalum', 'Buffalo'],
                warmSeason: true,
                overseedCommon: false     // No winter dormancy
            },
            
            managementNotes: [
                'Year-round growth - no dormancy period',
                'Pythium pressure extreme in wet season',
                'Mowing frequency high year-round',
                'Heat stress management critical Dec-Feb',
                'Irrigation for leaching salts important',
                'C3 grasses not viable'
            ]
        },

        // ───────────────────────────────────────────────────────────────────────
        // SOUTHEAST ASIA
        // Vietnam, Thailand, Singapore, Malaysia, Philippines
        // Northern hemisphere tropical — same climate profile as australia_tropical
        // but correct hemisphere for seasonal calculations
        // ───────────────────────────────────────────────────────────────────────
        'southeast_asia': {
            id: 'southeast_asia',
            name: 'Southeast Asia',
            description: 'Year-round tropical heat, monsoon wet/dry seasons',
            dataSource: 'Tropical turf research, NTEP Florida/Hawaii adaptation',
            ntepMatch: 'us_south',
            hemisphere: 'northern',

            bounds: {
                latMin: 0,
                latMax: 25,
                lonMin: 95,
                lonMax: 130
            },

            exampleCities: ['Ho Chi Minh City', 'Hanoi', 'Bangkok', 'Singapore', 'Kuala Lumpur', 'Manila'],

            climate: {
                type: 'tropical',
                winterSeverity: 'none',
                summerHeat: 'extreme',
                rainfall: 'seasonal_wet',
                humidityPressure: 'very_high',
                growingSeasonStart: 'Year-round',
                growingSeasonEnd: 'Year-round',
                growingDegreeDaysAnnual: 3500,
                frostFreeDays: 365
            },

            traitPriorities: {
                critical: ['heat', 'pythium', 'humidity_stress'],
                high: ['drought', 'salinity', 'wet_season_disease'],
                medium: ['wear'],
                low: ['cold', 'winterColor', 'springGreenup']
            },

            diseaseMultipliers: {
                fusarium: 0.40,
                redThread: 0.30,
                dollarSpot: 1.40,
                brownPatch: 1.50,
                pythium: 1.60,
                anthracnose: 1.30,
                takeAllPatch: 0.50,
                springDeadSpot: 0.80,
                grayLeafSpot: 1.20,
                snowMould: 0.0,
                leafSpot: 1.20,
                curvularia: 1.50,
                helminthosporium: 1.40
            },

            grassTypes: {
                primary: ['Couch (Bermudagrass)', 'Zoysia', 'Seashore Paspalum'],
                secondary: ['Buffalo'],
                warmSeason: true,
                overseedCommon: false
            },

            managementNotes: [
                'Year-round growth, no dormancy period',
                'Pythium pressure extreme in wet season',
                'Mowing frequency high year-round',
                'Heat stress management critical',
                'C3 grasses not viable year-round',
                'Northern Hemisphere, June/July/August is peak summer'
            ]
        },

        // ───────────────────────────────────────────────────────────────────────
        // AUSTRALIA - SUBTROPICAL
        // Brisbane, Gold Coast, Northern NSW - Hot summers, mild winters
        // NTEP Match: Texas (Dallas), North Carolina
        // ───────────────────────────────────────────────────────────────────────
        'australia_subtropical': {
            id: 'australia_subtropical',
            name: 'Subtropical Australia',
            description: 'Hot humid summers, mild dry winters',
            dataSource: 'Australian turf trials, NTEP Texas/NC adaptation',
            ntepMatch: 'us_transition',
            
            bounds: {
                latMin: -35,
                latMax: -23.5,
                lonMin: 145,    // East coast only for subtropical
                lonMax: 154
            },
            
            exampleCities: ['Brisbane', 'Gold Coast', 'Sunshine Coast', 'Coffs Harbour'],
            
            climate: {
                type: 'subtropical',
                winterSeverity: 'mild',
                summerHeat: 'hot',
                rainfall: 'summer_dominant',
                humidityPressure: 'high',
                growingSeasonStart: 'August',
                growingSeasonEnd: 'May',
                growingDegreeDaysAnnual: 2500,
                frostFreeDays: 340
            },
            
            traitPriorities: {
                critical: ['heat', 'disease_general', 'humidity_stress'],
                high: ['drought', 'wear', 'recovery'],
                medium: ['cold', 'salinity'],
                low: ['winterColor', 'snowMould']
            },
            
            diseaseMultipliers: {
                fusarium: 0.60,
                redThread: 0.50,
                dollarSpot: 1.40,
                brownPatch: 1.40,
                pythium: 1.40,
                anthracnose: 1.25,
                takeAllPatch: 0.70,
                springDeadSpot: 1.20,
                grayLeafSpot: 1.10,
                snowMould: 0.0,
                leafSpot: 1.10,
                curvularia: 1.40,
                helminthosporium: 1.30
            },
            
            grassTypes: {
                primary: ['Couch (Bermudagrass)', 'Kikuyu', 'Zoysia'],
                secondary: ['Buffalo', 'Seashore Paspalum'],
                warmSeason: true,
                overseedCommon: true      // Common for winter colour
            },
            
            managementNotes: [
                'Summer disease pressure high - preventative programs essential',
                'Kikuyu invasion management on couch',
                'Winter overseed common for sports',
                'Spring dead spot risk on couch',
                'Heat stress Dec-Feb affects recovery',
                'C3 possible as overseed only'
            ]
        },

        // ───────────────────────────────────────────────────────────────────────
        // AUSTRALIA - TEMPERATE
        // Melbourne, Adelaide, Sydney, Hobart - Warm summers, cool winters
        // NTEP Match: Indiana, Kentucky, New Jersey
        // ───────────────────────────────────────────────────────────────────────
        'australia_temperate': {
            id: 'australia_temperate',
            name: 'Temperate Australia',
            description: 'Warm summers, cool winters with frost',
            dataSource: 'Australian turf trials, NTEP Indiana/Kentucky adaptation',
            ntepMatch: 'us_north',
            
            bounds: {
                latMin: -44,
                latMax: -35,
                lonMin: 113,
                lonMax: 154
            },
            
            exampleCities: ['Melbourne', 'Adelaide', 'Sydney', 'Hobart', 'Canberra', 'Geelong'],
            
            climate: {
                type: 'temperate',
                winterSeverity: 'moderate',
                summerHeat: 'warm',
                rainfall: 'even_or_winter',
                humidityPressure: 'moderate',
                growingSeasonStart: 'September',
                growingSeasonEnd: 'April',
                growingDegreeDaysAnnual: 1800,
                frostFreeDays: 280
            },
            
            traitPriorities: {
                critical: ['cold', 'winterColor', 'springGreenup'],
                high: ['wear', 'recovery', 'drought'],
                medium: ['heat', 'disease_general'],
                low: ['pythium', 'humidity_stress']
            },
            
            diseaseMultipliers: {
                fusarium: 0.90,           // Present in cool wet periods
                redThread: 0.80,
                dollarSpot: 1.20,
                brownPatch: 1.00,
                pythium: 1.10,
                anthracnose: 1.10,
                takeAllPatch: 0.90,
                springDeadSpot: 1.50,     // Major issue on couch
                grayLeafSpot: 0.70,
                snowMould: 0.20,          // Rare - highlands only
                leafSpot: 1.00,
                curvularia: 1.10,
                helminthosporium: 1.00
            },
            
            grassTypes: {
                primary: ['Couch (Bermudagrass)', 'Kikuyu', 'Perennial Ryegrass'],
                secondary: ['Tall Fescue', 'Kentucky Bluegrass', 'Buffalo'],
                warmSeason: true,         // C4 still viable
                overseedCommon: true      // Very common for winter colour/wear
            },
            
            managementNotes: [
                'Spring dead spot critical issue on couch',
                'Cold tolerance essential for C4 variety selection',
                'Winter colour retention highly valued',
                'C3/C4 choice depends on specific site',
                'Frost damage risk May-August',
                'Longer spring recovery than subtropical'
            ]
        },

        // ───────────────────────────────────────────────────────────────────────
        // AUSTRALIA - MEDITERRANEAN (Perth/SW WA)
        // Hot dry summers, cool wet winters
        // NTEP Match: California (Riverside)
        // ───────────────────────────────────────────────────────────────────────
        'australia_mediterranean': {
            id: 'australia_mediterranean',
            name: 'Mediterranean Australia',
            description: 'Hot dry summers, cool wet winters (Perth/SW WA)',
            dataSource: 'Australian turf trials, NTEP California adaptation',
            ntepMatch: 'us_california',
            
            bounds: {
                latMin: -35,
                latMax: -28,
                lonMin: 113,
                lonMax: 125     // Western Australia only
            },
            
            exampleCities: ['Perth', 'Mandurah', 'Bunbury', 'Geraldton'],
            
            climate: {
                type: 'mediterranean',
                winterSeverity: 'mild',
                summerHeat: 'hot_dry',
                rainfall: 'winter_dominant',
                humidityPressure: 'low',
                growingSeasonStart: 'September',
                growingSeasonEnd: 'May',
                growingDegreeDaysAnnual: 2200,
                frostFreeDays: 320
            },
            
            traitPriorities: {
                critical: ['drought', 'heat', 'salinity'],
                high: ['waterUse', 'wear'],
                medium: ['cold', 'disease_general'],
                low: ['pythium', 'humidity_stress', 'snowMould']
            },
            
            diseaseMultipliers: {
                fusarium: 0.70,
                redThread: 0.60,
                dollarSpot: 1.30,
                brownPatch: 0.90,         // Lower - dry summers
                pythium: 0.80,            // Lower - dry
                anthracnose: 1.00,
                takeAllPatch: 1.00,
                springDeadSpot: 1.30,
                grayLeafSpot: 0.60,
                snowMould: 0.0,
                leafSpot: 0.90,
                curvularia: 1.00,
                helminthosporium: 0.90
            },
            
            grassTypes: {
                primary: ['Couch (Bermudagrass)', 'Kikuyu'],
                secondary: ['Buffalo', 'Zoysia', 'Perennial Ryegrass (overseed)'],
                warmSeason: true,
                overseedCommon: true
            },
            
            managementNotes: [
                'Water restrictions common - drought tolerance critical',
                'Summer irrigation essential',
                'Salt in groundwater/bore water - salinity tolerance important',
                'Lower disease pressure than east coast (dry summers)',
                'Kikuyu dominant on many sports fields',
                'Sandy soils common - affects nutrition'
            ]
        },

        // ───────────────────────────────────────────────────────────────────────
        // AUSTRALIA - LEGACY/FALLBACK
        // Used when sub-region cannot be determined
        // ───────────────────────────────────────────────────────────────────────
        'australia': {
            id: 'australia',
            name: 'Australia (General)',
            description: 'General Australian conditions - use sub-region for better accuracy',
            dataSource: 'Australian turf trials, NTEP adaptation',
            ntepMatch: 'us_transition',
            
            climate: {
                type: 'variable',
                winterSeverity: 'mild',
                summerHeat: 'hot',
                rainfall: 'variable',
                humidityPressure: 'variable',
                growingSeasonStart: 'September',
                growingSeasonEnd: 'May',
                growingDegreeDaysAnnual: 2000,
                frostFreeDays: 300
            },
            
            traitPriorities: {
                critical: ['heat', 'drought', 'wear'],
                high: ['disease_general', 'recovery'],
                medium: ['cold', 'salinity'],
                low: ['snowMould']
            },
            
            diseaseMultipliers: {
                fusarium: 0.70,
                redThread: 0.60,
                dollarSpot: 1.30,
                brownPatch: 1.20,
                pythium: 1.30,
                anthracnose: 1.20,
                takeAllPatch: 0.80,
                springDeadSpot: 1.40,
                grayLeafSpot: 0.80,
                snowMould: 0.0,
                leafSpot: 1.00,
                curvularia: 1.30,
                helminthosporium: 1.20
            },
            
            grassTypes: {
                primary: ['Couch (Bermudagrass)', 'Kikuyu', 'Buffalo', 'Zoysia'],
                secondary: ['Perennial Ryegrass (south)', 'Bentgrass (greens)'],
                warmSeason: true,
                overseedCommon: true
            },
            
            managementNotes: [
                'Spring dead spot major issue on couch',
                'Kikuyu management different to bermuda',
                'Argentine Stem Weevil significant pest',
                'Water restrictions common - drought tolerance critical',
                'APVMA registered products only',
                'Southern regions can support C3 grasses'
            ]
        },

        // ───────────────────────────────────────────────────────────────────────
        // NEW ZEALAND
        // Maritime, similar to UK but southern hemisphere
        // ───────────────────────────────────────────────────────────────────────
        'new_zealand': {
            id: 'new_zealand',
            name: 'New Zealand',
            description: 'Maritime climate, similar disease pressures to UK',
            dataSource: 'NZ Sports Turf Institute, adapted UK data',
            
            climate: {
                type: 'maritime_temperate',
                winterSeverity: 'mild',
                summerHeat: 'mild',
                rainfall: 'high',
                humidityPressure: 'high',
                growingSeasonStart: 'September',
                growingSeasonEnd: 'May',
                growingDegreeDaysAnnual: 1400,
                frostFreeDays: 220
            },
            
            diseaseMultipliers: {
                fusarium: 1.10,          // Similar to UK
                redThread: 1.20,         // High
                dollarSpot: 0.90,
                brownPatch: 0.70,
                pythium: 0.80,
                anthracnose: 0.90,
                takeAllPatch: 1.00,
                springDeadSpot: 0.0,
                grayLeafSpot: 0.50,
                snowMould: 0.40,
                leafSpot: 1.00,
                waiteaPatch: 1.00        // Confirmed present - prevalence unknown, use baseline
            },
            
            grassTypes: {
                primary: ['Perennial Ryegrass', 'Browntop Bent', 'Kentucky Bluegrass'],
                secondary: ['Tall Fescue', 'Fine Fescues'],
                warmSeason: false,       // North Island has some
                overseedCommon: false
            },
            
            managementNotes: [
                'Disease profile similar to UK/Ireland',
                'Endophyte-enhanced ryegrass important (pest resistance)',
                'Argentine Stem Weevil major pest',
                'Grass grub significant',
                'UV levels high - some cultivar differences'
            ]
        },

        // ───────────────────────────────────────────────────────────────────────
        // SOUTH AFRICA
        // Variable, significant warm season
        // ───────────────────────────────────────────────────────────────────────
        'south_africa': {
            id: 'south_africa',
            name: 'South Africa',
            description: 'Variable climates from Mediterranean to subtropical',
            dataSource: 'SAPPA, local turf research',
            
            climate: {
                type: 'variable_subtropical',
                winterSeverity: 'mild',
                summerHeat: 'hot',
                rainfall: 'summer_dominant',
                humidityPressure: 'moderate',
                growingSeasonStart: 'September',
                growingSeasonEnd: 'May',
                growingDegreeDaysAnnual: 2200,
                frostFreeDays: 280
            },
            
            diseaseMultipliers: {
                fusarium: 0.50,
                redThread: 0.40,
                dollarSpot: 1.20,
                brownPatch: 1.30,
                pythium: 1.40,
                anthracnose: 1.10,
                takeAllPatch: 0.70,
                springDeadSpot: 1.30,
                grayLeafSpot: 1.20,
                snowMould: 0.0,
                leafSpot: 1.10
            },
            
            grassTypes: {
                primary: ['Kikuyu', 'Bermudagrass (Cynodon)', 'LM (Berea)', 'Zoysia'],
                secondary: ['Perennial Ryegrass (overseed)'],
                warmSeason: true,
                overseedCommon: true
            },
            
            managementNotes: [
                'Kikuyu dominant on sports fields',
                'Water scarcity major management factor',
                'Different cultivar availability to US/Europe',
                'Highveld has frost considerations'
            ]
        },

        // ───────────────────────────────────────────────────────────────────────
        // JAPAN
        // Variable, unique cultivars
        // ───────────────────────────────────────────────────────────────────────
        'japan': {
            id: 'japan',
            name: 'Japan',
            description: 'Variable from cool temperate to subtropical, high humidity',
            dataSource: 'Japanese turf research',
            
            climate: {
                type: 'variable_monsoon',
                winterSeverity: 'variable',
                summerHeat: 'hot_humid',
                rainfall: 'high',
                humidityPressure: 'very_high',
                rainySeasonPressure: true,      // Tsuyu/Baiu
                growingDegreeDaysAnnual: 1800,
                frostFreeDays: 200
            },
            
            diseaseMultipliers: {
                fusarium: 1.00,
                redThread: 0.80,
                dollarSpot: 1.30,
                brownPatch: 1.50,        // Rainy season peak
                pythium: 1.60,           // Very high - humidity
                anthracnose: 1.30,
                takeAllPatch: 0.90,
                springDeadSpot: 1.10,
                grayLeafSpot: 1.40,
                snowMould: 1.20,         // Hokkaido
                leafSpot: 1.20
            },
            
            grassTypes: {
                primary: ['Korai (Zoysia matrella)', 'Noshiba (Zoysia japonica)', 'Creeping Bentgrass'],
                secondary: ['Perennial Ryegrass (overseed)', 'Kentucky Bluegrass'],
                warmSeason: 'mixed',
                overseedCommon: true,
                zoysiaDominant: true
            },
            
            managementNotes: [
                'Zoysia species native and dominant',
                'Rainy season (June-July) disease peak',
                'Typhoon damage consideration',
                'Different cultivar availability',
                'Very high quality expectations'
            ]
        }
    };

    // ═══════════════════════════════════════════════════════════════════════════
    // REGION DETECTION
    // ═══════════════════════════════════════════════════════════════════════════

    /**
     * Detect Australian sub-region based on latitude and longitude
     * @param {number} lat - Latitude (negative for southern hemisphere)
     * @param {number} lon - Longitude
     * @returns {string} Australian sub-region ID
     */
    function detectAustralianSubRegion(lat, lon) {
        // Latitude is negative in Australia
        const absLat = Math.abs(lat);
        
        // ─────────────────────────────────────────────────────────────────────
        // TROPICAL: North of Tropic of Capricorn (~23.5°S)
        // Darwin, Cairns, Townsville, Broome
        // ─────────────────────────────────────────────────────────────────────
        if (absLat < 23.5) {
            return 'australia_tropical';
        }
        
        // ─────────────────────────────────────────────────────────────────────
        // MEDITERRANEAN: Perth / SW Western Australia
        // Hot dry summers, cool wet winters - unique climate
        // Longitude 113-125°E, Latitude 28-35°S
        // ─────────────────────────────────────────────────────────────────────
        if (lon >= 113 && lon <= 125 && absLat >= 28 && absLat <= 35) {
            return 'australia_mediterranean';
        }
        
        // ─────────────────────────────────────────────────────────────────────
        // SUBTROPICAL: East coast between 23.5°S and 32°S
        // Brisbane (~27.5°S), Gold Coast (~28°S), Northern NSW to ~32°S
        // Sydney at 33.9°S is TEMPERATE, not subtropical
        // Only applies to east coast (lon > 145°E)
        // ─────────────────────────────────────────────────────────────────────
        if (absLat >= 23.5 && absLat < 32 && lon >= 145) {
            return 'australia_subtropical';
        }
        
        // ─────────────────────────────────────────────────────────────────────
        // TEMPERATE: South of 32°S on east coast, or south of 35°S elsewhere
        // Melbourne, Adelaide, Sydney, Hobart, Canberra
        // Sydney (~33.9°S), Canberra (~35.3°S), Melbourne (~37.8°S)
        // Also includes inland areas which are more continental
        // ─────────────────────────────────────────────────────────────────────
        if (absLat >= 32 && lon >= 145) {
            // East coast south of subtropical zone
            return 'australia_temperate';
        }
        
        if (absLat >= 35) {
            // Southern Australia generally
            return 'australia_temperate';
        }
        
        // Inland areas between 23.5-35°S that aren't east coast subtropical
        // These are more arid/continental - use temperate model
        if (absLat >= 23.5 && absLat < 35 && lon < 145) {
            return 'australia_temperate';
        }
        
        // Fallback
        return 'australia';
    }

    /**
     * Detect region from latitude and longitude
     * @param {number} lat - Latitude (-90 to 90)
     * @param {number} lon - Longitude (-180 to 180)
     * @returns {string} Region ID
     */
    function detectRegion(lat, lon) {
        // Validate inputs
        if (typeof lat !== 'number' || typeof lon !== 'number') {
            console.warn('[RegionalProfiles] Invalid coordinates, defaulting to uk_ireland');
            return 'uk_ireland';
        }

        // ─────────────────────────────────────────────────────────────────────
        // SOUTHERN HEMISPHERE
        // ─────────────────────────────────────────────────────────────────────
        if (lat < 0) {
            // Australia - detect sub-region by climate zone
            // Note: lon must be >= 113 to exclude Indonesia (Jakarta ~107°E)
            if (lon >= 113 && lon <= 154 && lat >= -44 && lat <= -10) {
                return detectAustralianSubRegion(lat, lon);
            }
            
            // New Zealand
            if (lon >= 166 && lon <= 179 && lat >= -47 && lat <= -34) {
                return 'new_zealand';
            }
            
            // South Africa
            if (lon >= 16 && lon <= 33 && lat >= -35 && lat <= -22) {
                return 'south_africa';
            }
            
            // Southeast Asia (Indonesia, etc.) - tropical climate
            // Lon 95-140°E, Lat 0 to -12°S
            if (lon >= 95 && lon <= 140 && lat >= -12 && lat < 0) {
                return 'australia_tropical';  // Use tropical profile
            }
            
            // Default southern hemisphere to Australia temperate model
            return 'australia_temperate';
        }
        
        // ─────────────────────────────────────────────────────────────────────
        // SOUTHEAST ASIA (Northern hemisphere portions)
        // Singapore, Malaysia, Thailand, Vietnam, Philippines
        // ─────────────────────────────────────────────────────────────────────
        if (lon >= 95 && lon <= 130 && lat >= 0 && lat <= 25) {
            return 'southeast_asia';
        }

        // ─────────────────────────────────────────────────────────────────────
        // ASIA
        // ─────────────────────────────────────────────────────────────────────
        if (lon >= 100 && lon <= 150) {
            // Japan
            if (lat >= 30 && lat <= 46 && lon >= 128 && lon <= 146) {
                return 'japan';
            }
            
            // Could add Korea, China regions here
        }

        // ─────────────────────────────────────────────────────────────────────
        // NORTH AMERICA
        // ─────────────────────────────────────────────────────────────────────
        if (lon >= -130 && lon <= -60) {
            // US Southern (below ~33°N for Gulf states, Florida)
            if (lat < 33 && lat > 25) {
                return 'us_south';
            }
            
            // US Transition Zone (~33-39°N)
            if (lat >= 33 && lat < 39) {
                return 'us_transition';
            }
            
            // US Northern (above ~39°N)
            if (lat >= 39 && lat < 50) {
                return 'us_north';
            }
            
            // Canada - use US North model
            if (lat >= 50) {
                return 'us_north';
            }
        }

        // ─────────────────────────────────────────────────────────────────────
        // EUROPE
        // ─────────────────────────────────────────────────────────────────────
        if (lon >= -12 && lon <= 40 && lat >= 35 && lat <= 72) {
            
            // UK & Ireland
            // Includes all British Isles - southern coast (Brighton) is ~50.7°N
            if (lon <= 2 && lat >= 49 && lat <= 61) {
                // UK detection:
                // 1. West of Greenwich (lon < 0) - definitely UK/Ireland
                // 2. North of 51°N - includes eastern England
                // 3. Between 0-2°E and 50-51°N - use stricter check (east of 1°E is likely France)
                if (lon < 0 || lat >= 51 || (lat >= 50 && lon < 1)) {
                    return 'uk_ireland';
                }
            }
            
            // Scandinavia
            // Norway, Sweden, Finland, Denmark (roughly)
            if (lat >= 54 && lon >= 4 && lon <= 32) {
                if (lat >= 56 || (lat >= 54 && lon >= 8 && lon <= 13)) { // Denmark exception
                    return 'scandinavia';
                }
            }
            
            // Mediterranean
            // Spain, Portugal, Southern France, Italy, Greece
            if (lat < 44) {
                // Iberian Peninsula
                if (lon >= -10 && lon <= 4 && lat >= 36 && lat < 44) {
                    return 'mediterranean';
                }
                // Italy
                if (lon >= 6 && lon <= 19 && lat >= 36 && lat < 46) {
                    return 'mediterranean';
                }
                // Greece
                if (lon >= 19 && lon <= 30 && lat >= 34 && lat < 42) {
                    return 'mediterranean';
                }
                // Southern France (below 44°N, excluding Atlantic coast)
                if (lon >= 2 && lon <= 8 && lat >= 41 && lat < 44) {
                    return 'mediterranean';
                }
            }
            
            // Germany
            // Roughly 47°N to 55°N, 5.5°E to 15°E
            if (lat >= 47 && lat <= 55.5 && lon >= 5.5 && lon <= 15.5) {
                return 'germany';
            }
            
            // Continental Europe (everything else in Europe)
            return 'continental_europe';
        }

        // ─────────────────────────────────────────────────────────────────────
        // DEFAULT
        // ─────────────────────────────────────────────────────────────────────
        
        // Default based on latitude alone
        if (lat >= 45) {
            return 'continental_europe';  // Cool temperate default
        } else if (lat >= 30) {
            return 'us_transition';       // Warm temperate default
        } else {
            return 'us_south';            // Subtropical default
        }
    }

    /**
     * Get region from current hub location
     */
    function detectRegionFromHub() {
        const latInput = document.querySelector('.gaip-lat');
        const lonInput = document.querySelector('.gaip-lon');
        
        if (!latInput || !lonInput) {
            console.warn('[RegionalProfiles] Location inputs not found');
            return 'uk_ireland';
        }
        
        const lat = parseFloat(latInput.value);
        const lon = parseFloat(lonInput.value);
        
        if (isNaN(lat) || isNaN(lon)) {
            return 'uk_ireland';
        }
        
        return detectRegion(lat, lon);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // REGION DATA ACCESS
    // ═══════════════════════════════════════════════════════════════════════════

    /**
     * Get full region profile
     */
    function getRegion(regionId) {
        return REGIONS[regionId] || REGIONS['uk_ireland'];
    }

    /**
     * Get current region based on hub location
     */
    function getCurrentRegion() {
        const regionId = detectRegionFromHub();
        return getRegion(regionId);
    }

    /**
     * Get disease multiplier for current region
     */
    function getDiseaseMultiplier(disease, regionId) {
        const region = regionId ? getRegion(regionId) : getCurrentRegion();
        return region.diseaseMultipliers[disease] || 1.0;
    }

    /**
     * Get all disease multipliers for a region
     */
    function getAllDiseaseMultipliers(regionId) {
        const region = regionId ? getRegion(regionId) : getCurrentRegion();
        return region.diseaseMultipliers;
    }

    /**
     * Get climate characteristics for region
     */
    function getClimateCharacteristics(regionId) {
        const region = regionId ? getRegion(regionId) : getCurrentRegion();
        return region.climate;
    }

    /**
     * Get primary grass types for region
     */
    function getPrimaryGrassTypes(regionId) {
        const region = regionId ? getRegion(regionId) : getCurrentRegion();
        return region.grassTypes.primary;
    }

    /**
     * Check if warm season grasses are appropriate
     */
    function isWarmSeasonRegion(regionId) {
        const region = regionId ? getRegion(regionId) : getCurrentRegion();
        return region.grassTypes.warmSeason === true;
    }

    /**
     * Get region-specific management notes
     */
    function getManagementNotes(regionId) {
        const region = regionId ? getRegion(regionId) : getCurrentRegion();
        return region.managementNotes || [];
    }

    /**
     * Get data source citation for region
     */
    function getDataSource(regionId) {
        const region = regionId ? getRegion(regionId) : getCurrentRegion();
        return region.dataSource;
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // REGION-AWARE VARIETY SELECTION
    // ═══════════════════════════════════════════════════════════════════════════

    /**
     * Check if UK varieties should be used
     */
    function shouldUseUKVarieties() {
        const regionId = detectRegionFromHub();
        return regionId === 'uk_ireland';
    }

    /**
     * Check if NTEP varieties should be used
     */
    function shouldUseNTEPVarieties() {
        const regionId = detectRegionFromHub();
        return [
            'us_north', 'us_transition', 'us_south',
            'australia', 'australia_tropical', 'australia_subtropical', 
            'australia_temperate', 'australia_mediterranean'
        ].includes(regionId);
    }

    /**
     * Get appropriate variety database key for region
     */
    function getVarietyDatabaseKey() {
        const regionId = detectRegionFromHub();
        
        switch (regionId) {
            case 'uk_ireland':
                return 'bspb';
            case 'scandinavia':
                return 'scanturf';
            case 'continental_europe':
                return 'euro';
            case 'mediterranean':
                return 'euro';
            case 'us_north':
            case 'us_transition':
            case 'us_south':
                return 'ntep';
            case 'australia':
            case 'australia_tropical':
            case 'australia_subtropical':
            case 'australia_temperate':
            case 'australia_mediterranean':
            case 'new_zealand':
            case 'south_africa':
                return 'ntep';  // NTEP + local adaptations
            case 'japan':
                return 'japan';
            default:
                return 'ntep';
        }
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // UI HELPERS
    // ═══════════════════════════════════════════════════════════════════════════

    /**
     * Get region display info for UI
     */
    function getRegionDisplayInfo(regionId) {
        const region = regionId ? getRegion(regionId) : getCurrentRegion();
        
        return {
            name: region.name,
            description: region.description,
            dataSource: region.dataSource,
            climateType: region.climate.type,
            warmSeason: region.grassTypes.warmSeason,
            primaryGrasses: region.grassTypes.primary.join(', ')
        };
    }

    /**
     * Format disease pressure for display
     */
    function formatDiseasePressure(multiplier) {
        if (multiplier >= 1.5) return { level: 'Very High', class: 'critical', icon: '🔴' };
        if (multiplier >= 1.2) return { level: 'High', class: 'high', icon: '🟠' };
        if (multiplier >= 0.9) return { level: 'Moderate', class: 'moderate', icon: '🟡' };
        if (multiplier >= 0.5) return { level: 'Low', class: 'low', icon: '🟢' };
        return { level: 'Very Low', class: 'minimal', icon: '⚪' };
    }

    /**
     * Get all regions for dropdown
     */
    function getAllRegions() {
        return Object.keys(REGIONS).map(id => ({
            id: id,
            name: REGIONS[id].name,
            description: REGIONS[id].description
        }));
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // TRAIT PRIORITY FUNCTIONS
    // Returns which variety traits matter most for a given climate
    // ═══════════════════════════════════════════════════════════════════════════

    /**
     * Get trait priorities for current region
     * @returns {object} { critical: [], high: [], medium: [], low: [] }
     */
    function getTraitPriorities(regionId) {
        const region = regionId ? getRegion(regionId) : getCurrentRegion();
        
        if (region && region.traitPriorities) {
            return region.traitPriorities;
        }
        
        // Default priorities if not defined for region
        return {
            critical: ['wear', 'disease_general'],
            high: ['drought', 'heat', 'recovery'],
            medium: ['cold', 'shade', 'salinity'],
            low: []
        };
    }

    /**
     * Get the priority level for a specific trait in current region
     * @param {string} traitName - e.g., 'cold', 'heat', 'wear', 'pythium'
     * @returns {string} 'critical' | 'high' | 'medium' | 'low' | 'standard'
     */
    function getTraitPriorityLevel(traitName, regionId) {
        const priorities = getTraitPriorities(regionId);
        
        if (priorities.critical && priorities.critical.includes(traitName)) return 'critical';
        if (priorities.high && priorities.high.includes(traitName)) return 'high';
        if (priorities.medium && priorities.medium.includes(traitName)) return 'medium';
        if (priorities.low && priorities.low.includes(traitName)) return 'low';
        
        return 'standard';
    }

    /**
     * Check if a trait is critical for the current region
     * @param {string} traitName
     * @returns {boolean}
     */
    function isTraitCritical(traitName, regionId) {
        return getTraitPriorityLevel(traitName, regionId) === 'critical';
    }

    /**
     * Get NTEP location match for Australian sub-region
     * @param {string} regionId - Australian sub-region ID
     * @returns {object} { ntepRegion: string, matchDescription: string }
     */
    function getNTEPMatch(regionId) {
        const region = getRegion(regionId);
        
        if (!region || !region.ntepMatch) {
            return {
                ntepRegion: 'us_transition',
                matchDescription: 'General US transition zone trials'
            };
        }
        
        const matchDescriptions = {
            'us_south': 'Florida, South Texas, Hawaii trials - hot/humid conditions',
            'us_transition': 'North Carolina, Tennessee, Texas trials - hot summers, mild winters',
            'us_north': 'Indiana, Kentucky, New Jersey trials - cold winters, wear tolerance focus',
            'us_california': 'California trials - Mediterranean climate, drought focus'
        };
        
        return {
            ntepRegion: region.ntepMatch,
            matchDescription: matchDescriptions[region.ntepMatch] || 'NTEP multi-location trials',
            exampleCities: region.exampleCities || []
        };
    }

    /**
     * Get variety climate suitability rating (1-3 stars)
     * Based on how well variety traits match climate priorities
     * @param {object} varietyTraits - Variety trait data
     * @param {string} regionId - Optional region override
     * @returns {object} { rating: 1-3, description: string }
     */
    function getVarietyClimateSuitability(varietyTraits, regionId) {
        if (!varietyTraits || !varietyTraits.traits) {
            return { rating: 2, description: 'Insufficient data' };
        }
        
        const priorities = getTraitPriorities(regionId);
        const traits = varietyTraits.traits;
        let score = 0;
        let maxScore = 0;
        
        // Check critical traits (weighted x3)
        (priorities.critical || []).forEach(priority => {
            maxScore += 3;
            const traitValue = getTraitValueForPriority(traits, priority);
            if (traitValue !== null) {
                if (traitValue < 0.9) score += 3;      // Good
                else if (traitValue <= 1.0) score += 2; // Average
                else score += 1;                        // Below average
            } else {
                score += 1.5; // Unknown - neutral
            }
        });
        
        // Check high priority traits (weighted x2)
        (priorities.high || []).forEach(priority => {
            maxScore += 2;
            const traitValue = getTraitValueForPriority(traits, priority);
            if (traitValue !== null) {
                if (traitValue < 0.9) score += 2;
                else if (traitValue <= 1.0) score += 1.5;
                else score += 0.5;
            } else {
                score += 1;
            }
        });
        
        // Calculate rating
        if (maxScore === 0) {
            return { rating: 2, description: 'Standard variety' };
        }
        
        const percentage = score / maxScore;
        
        if (percentage >= 0.8) {
            return { rating: 3, description: 'Excellent for your climate' };
        } else if (percentage >= 0.6) {
            return { rating: 2, description: 'Good for your climate' };
        } else {
            return { rating: 1, description: 'May underperform in your climate' };
        }
    }

    /**
     * Helper to extract trait multiplier value for a priority category
     */
    function getTraitValueForPriority(traits, priority) {
        switch (priority) {
            case 'cold':
                return traits.cold?.winterkillRisk || traits.cold?.dormancyThresholdModifier || null;
            case 'heat':
                return traits.heat?.toleranceMultiplier || traits.heat?.stressRecoveryMultiplier || null;
            case 'drought':
            case 'waterUse':
                return traits.waterUse?.multiplier || traits.drought?.toleranceMultiplier || null;
            case 'wear':
                return traits.wear?.multiplier || null;
            case 'recovery':
                return traits.recovery?.rateMultiplier || null;
            case 'pythium':
                return traits.disease?.pythium?.riskMultiplier || traits.disease?.pythiumRootRot?.riskMultiplier || null;
            case 'disease_general':
                // Average of available disease multipliers
                if (traits.disease) {
                    const values = Object.values(traits.disease)
                        .filter(d => d && typeof d.riskMultiplier === 'number')
                        .map(d => d.riskMultiplier);
                    return values.length > 0 ? values.reduce((a, b) => a + b) / values.length : null;
                }
                return null;
            case 'salinity':
                return traits.salinity?.multiplier || null;
            case 'shade':
                return traits.shade?.thresholdModifier || null;
            default:
                return null;
        }
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // EXPORTS
    // ═══════════════════════════════════════════════════════════════════════════

    const RegionalProfiles = {
        version: '1.1.0',
        
        // Data
        REGIONS: REGIONS,
        
        // Detection
        detectRegion: detectRegion,
        detectRegionFromHub: detectRegionFromHub,
        detectAustralianSubRegion: detectAustralianSubRegion,
        
        // Data access
        getRegion: getRegion,
        getCurrentRegion: getCurrentRegion,
        getDiseaseMultiplier: getDiseaseMultiplier,
        getAllDiseaseMultipliers: getAllDiseaseMultipliers,
        getClimateCharacteristics: getClimateCharacteristics,
        getPrimaryGrassTypes: getPrimaryGrassTypes,
        isWarmSeasonRegion: isWarmSeasonRegion,
        getManagementNotes: getManagementNotes,
        getDataSource: getDataSource,
        
        // Variety selection
        shouldUseUKVarieties: shouldUseUKVarieties,
        shouldUseNTEPVarieties: shouldUseNTEPVarieties,
        getVarietyDatabaseKey: getVarietyDatabaseKey,
        
        // Trait priorities (NEW)
        getTraitPriorities: getTraitPriorities,
        getTraitPriorityLevel: getTraitPriorityLevel,
        isTraitCritical: isTraitCritical,
        getNTEPMatch: getNTEPMatch,
        getVarietyClimateSuitability: getVarietyClimateSuitability,
        
        // UI helpers
        getRegionDisplayInfo: getRegionDisplayInfo,
        formatDiseasePressure: formatDiseasePressure,
        getAllRegions: getAllRegions
    };

    // Export to global
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = RegionalProfiles;
    }
    
    global.GAIP_RegionalProfiles = RegionalProfiles;
    
    // Convenience functions
    global.gaip_detectRegion = detectRegion;
    global.gaip_getCurrentRegion = getCurrentRegion;
    global.gaip_getDiseaseMultiplier = getDiseaseMultiplier;
    global.gaip_getRegionDisplayInfo = getRegionDisplayInfo;
    global.gaip_shouldUseUKVarieties = shouldUseUKVarieties;
    global.gaip_shouldUseNTEPVarieties = shouldUseNTEPVarieties;
    
    // NEW: Trait priority convenience functions
    global.gaip_getTraitPriorities = getTraitPriorities;
    global.gaip_getTraitPriorityLevel = getTraitPriorityLevel;
    global.gaip_isTraitCritical = isTraitCritical;
    global.gaip_getNTEPMatch = getNTEPMatch;
    global.gaip_getVarietyClimateSuitability = getVarietyClimateSuitability;

})(typeof window !== 'undefined' ? window : this);
