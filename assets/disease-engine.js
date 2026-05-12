const DISEASE_CONFIG = {
    thresholds: {
        low: 25,
        moderate: 50,
        high: 70,
        severe: 85
    },
    sprayWindow: {
        minRainFreeHours: 4,
        maxWindSpeed: 15,
        optimalTempMin: 10,
        optimalTempMax: 30,
    },
};

/**
 * Confidence level to numeric score mapping
 * Used for standardized numeric confidence output alongside string levels
 * @type {Object.<string, number>}
 */
const CONFIDENCE_SCORES = {
    'high': 90,
    'medium': 70,
    'low': 40,
    'insufficient data': 10,
    'insufficient': 10,
    'none': 0
};

/**
 * Convert string confidence level to numeric score
 * @param {string} level - Confidence level string
 * @returns {number} Numeric score 0-100
 */
function confidenceToScore(level) {
    if (typeof level === 'number') return level;
    return CONFIDENCE_SCORES[level] || 50;
}

let _currentDewData = null;
const USE_CATEGORIES = {
        PROFESSIONAL: "professional",
        DOMESTIC: "domestic",
        BOTH: "both",
    },
    ALLOWED_USES = {
        GOLF: "golf",
        SPORTSFIELD: "sportsfield",
        AMENITY: "amenity",
        LAWN: "lawn",
        SOD: "sod",
    };

function isProductAllowedForUse(e, t) {
    const a = e.allowedUses || ["golf", "sportsfield"],
        r = e.useCategory || "professional",
        i = (t || "golf").toLowerCase();
    if (a.includes(i)) return {
        allowed: !0,
        warning: null
    };
    if ("both" === r) return {
        allowed: !0,
        warning: null
    };
    if ("domestic" === r && ("lawn" === i || "amenity" === i))
        return {
            allowed: !0,
            warning: null
        };
    const o = {
            golf: "golf courses",
            sportsfield: "sports fields",
            amenity: "amenity turf",
            lawn: "domestic lawns",
            sod: "sod production",
        },
        n = a.map((e) => o[e] || e).join(", ");
    return {
        allowed: !1,
        warning: `⚠️ Not registered for ${o[i] || i}. Approved for: ${n}`,
    };
}

function filterFungicidesByUse(e, t, a = !0) {
    return e
        .map((e) => {
            const r = e.products.map((e) => {
                    const a = isProductAllowedForUse(e, t);
                    return {
                        ...e,
                        allowedForContext: a.allowed,
                        useWarning: a.warning
                    };
                }),
                i = r.filter((e) => e.allowedForContext),
                o = r.filter((e) => !e.allowedForContext);
            return {
                ...e,
                products: a ? r : i,
                allowedProducts: i,
                restrictedProducts: o,
                hasAllowedProducts: i.length > 0,
                allRestricted: 0 === i.length && o.length > 0,
            };
        })
        .filter((e) => a || e.hasAllowedProducts);
}

function getRegionalDiseaseMultiplier(e) {
    const t = {
        "Dollar Spot": "dollarSpot",
        "Brown Patch": "brownPatch",
        "Pythium Blight": "pythium",
        Pythium: "pythium",
        Anthracnose: "anthracnose",
        "Spring Dead Spot": "springDeadSpot",
        Helminthosporium: "helminthosporium",
        Fusarium: "fusarium",
        "Fusarium Patch": "fusarium",
        "Take-all Patch": "takeAll",
        "Take-all": "takeAll",
        "Gray Leaf Spot": "grayLeafSpot",
        "Red Thread": "redThread",
        "Snow Mould": "snowMould",
        "Pink Snow Mould": "pinkSnowMould",
        "Waitea Patch": "waiteaPatch",
        "Brown Ring Patch": "waiteaPatch",
    } [e] || e.toLowerCase().replace(/\s+/g, "");
    return "undefined" != typeof window &&
        "function" == typeof window.gaip_getDiseaseMultiplier ?
        window.gaip_getDiseaseMultiplier(t) :
        1;
}

function getCurrentRegionInfo() {
    return "undefined" != typeof window &&
        "function" == typeof window.gaip_getRegionDisplayInfo ?
        window.gaip_getRegionDisplayInfo() :
        {
            name: "Unknown",
            dataSource: "Default parameters"
        };
}
const SPECIES_SUSCEPTIBILITY = {
        bentgrass: {
            dollarSpot: 1.3,
            brownPatch: 1.3,  // Creeping bentgrass highly susceptible at golf green height — APS/Ohio State
            pythium: 1.3,
            anthracnose: 1.4,
            fusarium: 1.2,
            takeAll: 1.5,
            grayLeafSpot: 0.5,
            springDeadSpot: 0,
            helminthosporium: 0.3,
            largePatch: 0,  // C3 - immune
        },
        perennialRyegrass: {
            dollarSpot: 1.1,
            brownPatch: 1.4,  // Most susceptible cool-season — Penn State, Ohio State, Syngenta
            pythium: 1.4,
            anthracnose: 0.8,
            fusarium: 1,
            takeAll: 0.7,
            grayLeafSpot: 1.5,
            springDeadSpot: 0,
            helminthosporium: 0.5,
            largePatch: 0,  // C3 - immune
        },
        kentuckyBluegrass: {
            dollarSpot: 1,
            brownPatch: 0.9,
            pythium: 1.1,
            anthracnose: 0.7,
            fusarium: 1.2,
            takeAll: 0.8,
            grayLeafSpot: 0.6,
            springDeadSpot: 0,
            helminthosporium: 1.3,
            largePatch: 0,  // C3 - immune
        },
        tallFescue: {
            dollarSpot: 0.8,
            brownPatch: 1.4,
            pythium: 0.9,
            anthracnose: 0.5,
            fusarium: 0.7,
            takeAll: 0.5,
            grayLeafSpot: 0.9,
            springDeadSpot: 0,
            helminthosporium: 0.6,
            largePatch: 0,  // C3 - immune
        },
        poaAnnua: {
            dollarSpot: 1.4,
            brownPatch: 1,
            pythium: 1.5,
            anthracnose: 1.8,
            fusarium: 1.3,
            takeAll: 1,
            grayLeafSpot: 0.3,
            springDeadSpot: 0,
            helminthosporium: 0.4,
            largePatch: 0,  // C3 - immune
        },
        bermuda: {
            dollarSpot: 0.3,
            brownPatch: 0.2,  // R. solani AG 1-A rarely causes significant brown patch on C4 warm-season grasses
            pythium: 0.6,
            anthracnose: 0.3,
            fusarium: 0,
            takeAll: 0.3,
            grayLeafSpot: 0.5,
            springDeadSpot: 1.5,
            helminthosporium: 1.4,
            largePatch: 0.7,  // C4 - lower susceptibility, rapid recovery
        },
        couch: {
            dollarSpot: 0.3,
            brownPatch: 0.2,  // C4 warm-season — minimal brown patch (AG 1-A) risk
            pythium: 0.6,
            anthracnose: 0.3,
            fusarium: 0,
            takeAll: 0.3,
            grayLeafSpot: 0.5,
            springDeadSpot: 1.4,
            helminthosporium: 1.3,
            largePatch: 0.7,  // C4 - lower susceptibility, rapid recovery
        },
        kikuyu: {
            dollarSpot: 0.25,
            brownPatch: 0.15,  // C4 warm-season — not a meaningful host for AG 1-A
            pythium: 0.6,
            anthracnose: 0.2,
            fusarium: 0,
            takeAll: 0.3,
            grayLeafSpot: 0.3,
            springDeadSpot: 0,  // C4 warm-season, no SDS
            helminthosporium: 1.0,  // Moderate susceptibility to leaf spots
            largePatch: 1.2,  // C4 - confirmed in AU (SA, WA) per Envu trials
        },
        zoysia: {
            dollarSpot: 0.9,
            brownPatch: 0.2,  // C4 warm-season — minimal AG 1-A risk; AG 2-2 LP is the main Rhizoctonia concern
            pythium: 0.7,
            anthracnose: 0.4,
            fusarium: 0,
            takeAll: 0.5,
            grayLeafSpot: 0.6,
            springDeadSpot: 1.2,
            helminthosporium: 1.3,
            largePatch: 1.4,  // C4 - high susceptibility, slow recovery
        },
        buffalo: {
            dollarSpot: 0.5,
            brownPatch: 0.2,  // C4 warm-season — minimal AG 1-A risk
            pythium: 0.5,
            anthracnose: 0.2,
            fusarium: 0,
            takeAll: 0.3,
            grayLeafSpot: 1.8,
            springDeadSpot: 0,
            helminthosporium: 0.8,
            largePatch: 0.9,  // C4 - St. Augustine equivalent, moderate susceptibility
        },
        buffalograss: {
            dollarSpot: 0.5,
            brownPatch: 0.15,  // C4 warm-season — minimal AG 1-A risk
            pythium: 0.5,
            anthracnose: 0.2,
            fusarium: 0,
            takeAll: 0.3,
            grayLeafSpot: 0.3,
            springDeadSpot: 0,
            helminthosporium: 0.8,
            largePatch: 0.6,  // C4 - low susceptibility (Buchloe dactyloides)
        },
    },
    FUNGICIDES_AU = {
        thiophanateMethyl: {
            frac: 1,
            useCategory: "professional",
            allowedUses: ["golf", "sportsfield", "amenity", "sod"],
            products: [{
                trade: "Clean Sweep Trio",
                rate: "12-20 L/ha",
                interval: "14-28",
                notes: "3-way mix with fluazinam + tebuconazole",
            }, ],
            targets: [
                "dollarSpot",
                "helminthosporium",
                "anthracnose",
                "brownPatch",
                "eri",
                "fairyRing",
            ],
            systemic: !0,
            mode: "Mitosis and cell division",
        },
        thiabendazole: {
            frac: 1,
            useCategory: "professional",
            allowedUses: ["golf", "sportsfield", "amenity"],
            products: [{
                trade: "Vorlon",
                rate: "3.8-5.6 L/ha",
                interval: "14-21"
            }],
            targets: ["dollarSpot", "fusarium"],
            systemic: !0,
            mode: "Mitosis and cell division",
        },
        iprodione: {
            frac: 2,
            products: [{
                    trade: "Voltar 250 GT",
                    rate: "9-18 L/ha",
                    interval: "14-28"
                },
                {
                    trade: "Iprodione 365",
                    rate: "6.5-12.5 L/ha",
                    interval: "14-28"
                },
                {
                    trade: "Chief Aquaflo",
                    rate: "4.5-9 L/ha",
                    interval: "14-28"
                },
                {
                    trade: "Ippon 500",
                    rate: "4.5-9 L/ha",
                    interval: "14-28"
                },
                {
                    trade: "Voltar 500",
                    rate: "4.5-9 L/ha",
                    interval: "14-28"
                },
                {
                    trade: "Chief Topflo",
                    rate: "3.6-7.2 L/ha",
                    interval: "14-28"
                },
            ],
            targets: [
                "brownPatch",
                "curvularia",
                "dollarSpot",
                "fusarium",
                "helminthosporium",
                "springDeadSpot",
            ],
            systemic: !1,
            mode: "Lipids and membranes",
        },
        procymidone: {
            frac: 2,
            products: [{
                    trade: "Sumisclex",
                    rate: "6-6.5 L/ha",
                    interval: "14-28",
                    notes: "Do not apply to hybrid couch Apr-Sep",
                },
                {
                    trade: "Sporex",
                    rate: "6-6.5 L/ha",
                    interval: "14-28"
                },
            ],
            targets: ["dollarSpot", "helminthosporium", "springDeadSpot"],
            systemic: !0,
            mode: "Lipids and membranes",
        },
        propiconazole: {
            frac: 3,
            products: [{
                    trade: "Banner Maxx",
                    rate: "5-10 L/ha",
                    interval: "14-28",
                    notes: "Greens/tees",
                },
                {
                    trade: "Regiment 550",
                    rate: "1.4-2.8 L/ha",
                    interval: "14-28"
                },
                {
                    trade: "Prop 500",
                    rate: "1.5-3 L/ha",
                    interval: "14-28"
                },
                {
                    trade: "Banner Fairway",
                    rate: "3-6 L/ha",
                    interval: "14-28",
                    notes: "Fairways only",
                },
                {
                    trade: "Bumper 625",
                    rate: "1.2-2.4 L/ha",
                    interval: "14-28"
                },
            ],
            targets: [
                "anthracnose",
                "brownPatch",
                "dollarSpot",
                "fusarium",
                "helminthosporium",
                "largePatch",
                "eri",
                "springDeadSpot",
            ],
            systemic: !0,
            mode: "Sterol synthesis",
        },
        tebuconazole: {
            frac: 3,
            products: [{
                trade: "Dedicate Forte",
                rate: "3.5 L/ha",
                interval: "14-28"
            }, ],
            targets: [
                "anthracnose",
                "brownPatch",
                "dollarSpot",
                "fairyRing",
                "fusarium",
                "grayLeafSpot",
                "helminthosporium",
                "largePatch",
                "rust",
                "takeAll",
            ],
            systemic: !0,
            mode: "Sterol synthesis",
        },
        triticonazole: {
            frac: 3,
            products: [{
                trade: "Tribeca",
                rate: "6 L/ha",
                interval: "14-28",
                notes: "2-way mix with fludioxonil",
            }, ],
            targets: [
                "anthracnose",
                "brownPatch",
                "dollarSpot",
                "eri",
                "helminthosporium",
                "takeAll",
                "fusarium",
                "springDeadSpot",
            ],
            systemic: !0,
            mode: "Sterol synthesis",
        },
        triadimenol: {
            frac: 3,
            products: [{
                    trade: "Citadel",
                    rate: "3-6 L/ha",
                    interval: "28",
                    notes: "State restrictions apply",
                },
                {
                    trade: "Tridim 250",
                    rate: "3-6 L/ha",
                    interval: "28"
                },
                {
                    trade: "Patchwork",
                    rate: "3-6 L/ha",
                    interval: "28"
                },
            ],
            targets: ["dollarSpot", "helminthosporium", "takeAll", "fusarium"],
            systemic: !0,
            mode: "Sterol synthesis",
        },
        mefentrifluconazole: {
            frac: 3,
            products: [{
                trade: "Maxtima",
                rate: "1.25-2.5 L/ha",
                interval: "14",
                notes: "No temp/variety restrictions",
            }, ],
            targets: [
                "anthracnose",
                "brownPatch",
                "dollarSpot",
                "fairyRing",
                "fusarium",
            ],
            systemic: !0,
            mode: "Sterol synthesis",
        },
        prochloraz: {
            frac: 3,
            products: [{
                    trade: "Protak",
                    rate: "6.5 L/ha",
                    interval: "28"
                },
                {
                    trade: "Sportak",
                    rate: "6.5 L/ha",
                    interval: "28"
                },
            ],
            targets: ["dollarSpot"],
            systemic: !0,
            mode: "Sterol synthesis",
        },
        metalaxylM: {
            frac: 4,
            products: [{
                    trade: "Subdue Maxx",
                    rate: "2-4 L/ha",
                    interval: "14-21"
                },
                {
                    trade: "Solitaire",
                    rate: "2-4 L/ha",
                    interval: "14-21"
                },
                {
                    trade: "Mayfair",
                    rate: "2-4 L/ha",
                    interval: "14-21"
                },
                {
                    trade: "Triumph",
                    rate: "2-4 L/ha",
                    interval: "14-21"
                },
            ],
            targets: ["pythium"],
            systemic: !0,
            mode: "Nucleic acid synthesis",
        },
        boscalid: {
            frac: 7,
            products: [{
                    trade: "Filan",
                    rate: "0.78 L/ha",
                    interval: "14-28"
                },
                {
                    trade: "Midas",
                    rate: "0.78 L/ha",
                    interval: "14-28"
                },
            ],
            targets: ["dollarSpot"],
            systemic: !0,
            mode: "Respiration",
        },
        penthiopyrad: {
            frac: 7,
            products: [{
                trade: "Velista",
                rate: "1-1.5 L/ha",
                interval: "14-21"
            }],
            targets: [
                "anthracnose",
                "brownPatch",
                "curvularia",
                "dollarSpot",
                "helminthosporium",
                "redThread",
                "springDeadSpot",
                "fairyRing",
            ],
            systemic: !0,
            mode: "Respiration",
        },
        fluopyram: {
            frac: 7,
            products: [{
                trade: "Exteris Stressgard",
                rate: "10 L/ha",
                interval: "14-28",
                notes: "2-way mix with trifloxystrobin",
            }, ],
            targets: [
                "brownPatch",
                "dollarSpot",
                "fusarium",
                "grayLeafSpot",
                "helminthosporium",
                "rust",
            ],
            systemic: !0,
            mode: "Respiration",
        },
        fluxapyroxad: {
            frac: 7,
            products: [{
                    trade: "Xzemplar",
                    rate: "0.65-0.8 L/ha",
                    interval: "14-28"
                },
                {
                    trade: "Lexicon Intrinsic",
                    rate: "1-1.5 L/ha",
                    interval: "14-28",
                    notes: "2-way mix with pyraclostrobin - adds pythium, anthracnose",
                },
            ],
            targets: [
                "brownPatch",
                "curvularia",
                "dollarSpot",
                "fairyRing",
                "grayLeafSpot",
                "helminthosporium",
            ],
            systemic: !0,
            mode: "Respiration",
        },
        flutolanil: {
            frac: 7,
            products: [{
                trade: "Monstar SC",
                rate: "15-20 L/ha",
                interval: "14-28"
            }, ],
            targets: ["fairyRing", "largePatch", "brownPatch"],
            systemic: !1,
            mode: "Respiration",
        },
        pydiflumetofen: {
            frac: 7,
            products: [{
                trade: "Posterity",
                rate: "0.5-1 L/ha",
                interval: "14-28"
            }],
            targets: ["dollarSpot", "fusarium", "springDeadSpot"],
            systemic: !0,
            mode: "Respiration",
        },
        azoxystrobin: {
            frac: 11,
            products: [{
                    trade: "Heritage Maxx",
                    rate: "6 L/ha",
                    interval: "21-28"
                },
                {
                    trade: "Vantage",
                    rate: "6 L/ha",
                    interval: "21-28"
                },
                {
                    trade: "Azoxy 250",
                    rate: "2.3 L/ha",
                    interval: "21-28"
                },
                {
                    trade: "Azo-Force 250SC",
                    rate: "2.3 L/ha",
                    interval: "21-28"
                },
            ],
            targets: [
                "anthracnose",
                "brownPatch",
                "grayLeafSpot",
                "helminthosporium",
                "largePatch",
                "redThread",
                "fusarium",
                "pythium",
                "springDeadSpot",
            ],
            systemic: !0,
            weakCurativeFor: ["pythium"],
            mode: "Respiration",
        },
        pyraclostrobin: {
            frac: 11,
            products: [{
                trade: "Lexicon Intrinsic",
                rate: "1-1.5 L/ha",
                interval: "14-28",
                notes: "2-way mix with fluxapyroxad",
            }, ],
            targets: [
                "brownPatch",
                "dollarSpot",
                "eri",
                "fairyRing",
                "fusarium",
                "helminthosporium",
                "pythium",
            ],
            systemic: !0,
            mode: "Respiration",
        },
        trifloxystrobin: {
            frac: 11,
            products: [{
                    trade: "Tombstone Duo",
                    rate: "2-3 L/ha",
                    interval: "14-28",
                    notes: "2-way mix with tebuconazole",
                },
                {
                    trade: "Dedicate",
                    rate: "2-3 L/ha",
                    interval: "14-28"
                },
                {
                    trade: "Patriot",
                    rate: "2-3 L/ha",
                    interval: "14-28"
                },
                {
                    trade: "Interface Stressgard",
                    rate: "12.5 L/ha",
                    interval: "14-28",
                    notes: "2-way mix with iprodione",
                },
            ],
            targets: [
                "anthracnose",
                "brownPatch",
                "curvularia",
                "dollarSpot",
                "helminthosporium",
                "fusarium",
                "springDeadSpot",
                "eri",
                "grayLeafSpot",
                "rust",
            ],
            systemic: !0,
            mode: "Respiration",
        },
        mandestrobin: {
            frac: 11,
            products: [{
                trade: "Rapidol",
                rate: "4 L/ha",
                interval: "14-21",
                notes: "Preventative only",
            }, ],
            targets: [
                "anthracnose",
                "brownPatch",
                "dollarSpot",
                "fairyRing",
                "fusarium",
            ],
            systemic: !0,
            mode: "Respiration",
        },
        fludioxonil: {
            frac: 12,
            products: [{
                    trade: "Medallion",
                    rate: "3-4 L/ha",
                    interval: "14-21"
                },
                {
                    trade: "Sceptre",
                    rate: "3-4 L/ha",
                    interval: "14-21"
                },
            ],
            targets: [
                "anthracnose",
                "brownPatch",
                "dollarSpot",
                "helminthosporium",
                "fusarium",
            ],
            systemic: !1,
            mode: "Signaling",
        },
        etridiazole: {
            frac: 14,
            products: [{
                trade: "Terrazole",
                rate: "10-25 L/ha",
                interval: "5-10",
                notes: "Pythium curative specialist",
            }, ],
            targets: ["pythium"],
            systemic: !1,
            curativePreferred: !0,
            mode: "Lipids and cell membrane systems",
        },
        tolclofosMethyl: {
            frac: 14,
            products: [{
                trade: "Shiba",
                rate: "8-10 L/ha",
                interval: "14-21",
                turf: "Green couch, creeping bentgrass, buffalo",
            }, ],
            targets: [
                "anthracnose",
                "brownPatch",
                "curvularia",
                "dollarSpot",
                "fairyRing",
                "grayLeafSpot",
                "helminthosporium",
                "fusarium",
            ],
            systemic: !1,
            mode: "Lipids and cell membrane systems",
        },
        cyazofamid: {
            frac: 21,
            products: [{
                trade: "Segway",
                rate: "1 L/ha",
                interval: "21"
            }],
            targets: ["pythium"],
            systemic: !1,
            mode: "Respiration",
        },
        propamocarb: {
            frac: 28,
            products: [{
                trade: "Schrapnel",
                rate: "3-4 L/ha",
                interval: "7-14"
            }],
            targets: ["pythium"],
            systemic: !0,
            mode: "Cell membrane permeability",
        },
        fluazinam: {
            frac: 29,
            products: [{
                    trade: "Emerald",
                    rate: "1-1.5 L/ha",
                    interval: "7-14"
                },
                {
                    trade: "Compass",
                    rate: "1-1.5 L/ha",
                    interval: "7-14"
                },
            ],
            targets: [
                "anthracnose",
                "dollarSpot",
                "grayLeafSpot",
                "helminthosporium",
                "pythium",
            ],
            weakCurativeFor: ["pythium"],
            systemic: !1,
            mode: "Respiration",
        },
        fosetylAl: {
            frac: 33,
            products: [{
                    trade: "Proforce Grenadier 800",
                    rate: "12.5 kg/ha",
                    interval: "14-21",
                    notes: "Primary pythium preventive. Cost-effective phosphonate",
                },
                {
                    trade: "Signature Xtra Stressgard",
                    rate: "5.5-16.5 kg/ha",
                    interval: "14-21",
                    notes: "Stressgard formulation technology",
                },
            ],
            targets: ["anthracnose", "pythium"],
            systemic: !0,
            preventiveOnly: !0,
            mode: "Host defense induction",
        },
        mancozeb: {
            frac: "M3",
            products: [{
                    trade: "Liquid Dek",
                    rate: "33-41.5 L/ha",
                    interval: "7-14"
                },
                {
                    trade: "Penncozeb 750",
                    rate: "20-25 g/ha",
                    interval: "7-14"
                },
            ],
            targets: ["fusarium", "helminthosporium", "brownPatch"],
            systemic: !1,
            mode: "Multi-site activity",
        },
        thiram: {
            frac: "M3",
            products: [{
                    trade: "Flowable TMTD",
                    rate: "16 L/ha",
                    interval: "7-14"
                },
                {
                    trade: "Pistol 600",
                    rate: "16 L/ha",
                    interval: "7-14"
                },
            ],
            targets: ["brownPatch", "helminthosporium", "fusarium", "dampingOff"],
            systemic: !1,
            mode: "Multi-site activity",
        },
        captan: {
            frac: "M4",
            products: [{
                trade: "Captan",
                rate: "9-13.5 L/ha",
                interval: "7-14"
            }],
            targets: ["brownPatch"],
            systemic: !1,
            mode: "Multi-site activity",
        },
        chlorothalonil: {
            frac: "M5",
            products: [{
                    trade: "Daconil Weather Stik",
                    rate: "13-24 L/ha",
                    interval: "7-14"
                },
                {
                    trade: "Squadron",
                    rate: "13-24 L/ha",
                    interval: "7-14"
                },
                {
                    trade: "Reserve Stressgard",
                    rate: "13-24 L/ha",
                    interval: "7-14"
                },
            ],
            targets: ["brownPatch", "dollarSpot", "grayLeafSpot"],
            systemic: !1,
            mode: "Multi-site activity",
        },
        headwayMaxx: {
            frac: "11+3",
            products: [{
                trade: "Headway Maxx",
                rate: "9 L/ha",
                interval: "28"
            }],
            actives: ["azoxystrobin", "propiconazole"],
            targets: [
                "anthracnose",
                "brownPatch",
                "dollarSpot",
                "fusarium",
                "grayLeafSpot",
                "helminthosporium",
                "pythium",
                "springDeadSpot",
                "takeAll",
                "couchgrassDecline",
            ],
            systemic: !0,
            weakCurativeFor: ["pythium"],
            mode: "Contact and systemic",
        },
        impala: {
            frac: "11+3",
            products: [{
                trade: "Impala",
                rate: "6 L/ha",
                interval: "28",
                notes: "PGR effect on wintergrass",
            }, ],
            actives: ["azoxystrobin", "triticonazole"],
            targets: [
                "anthracnose",
                "brownPatch",
                "dollarSpot",
                "fusarium",
                "helminthosporium",
                "pythium",
                "springDeadSpot",
                "takeAll",
                "couchgrassDecline",
            ],
            systemic: !0,
            weakCurativeFor: ["pythium"],
            mode: "Contact and systemic",
        },
        evolution: {
            frac: "11+3",
            products: [{
                trade: "Evolution",
                rate: "2-3 L/ha",
                interval: "21-28"
            }],
            actives: ["azoxystrobin", "tebuconazole"],
            targets: [
                "anthracnose",
                "brownPatch",
                "dollarSpot",
                "fusarium",
                "helminthosporium",
                "fairyRing",
            ],
            systemic: !0,
            mode: "Contact and systemic",
        },
        instrata: {
            frac: "M5+3+12",
            products: [{
                trade: "Instrata",
                rate: "18 L/ha",
                interval: "28"
            }],
            actives: ["chlorothalonil", "propiconazole", "fludioxonil"],
            targets: [
                "anthracnose",
                "brownPatch",
                "dollarSpot",
                "helminthosporium",
                "fusarium",
            ],
            systemic: !0,
            mode: "Contact and systemic",
        },
        enclave: {
            frac: "M5+2+1+3",
            products: [{
                trade: "Qualipro-Enclave",
                rate: "16-24 L/ha",
                interval: "21-28"
            }, ],
            actives: [
                "chlorothalonil",
                "iprodione",
                "thiophanateMethyl",
                "tebuconazole",
            ],
            targets: [
                "anthracnose",
                "brownPatch",
                "dollarSpot",
                "fusarium",
                "grayLeafSpot",
                "helminthosporium",
                "springDeadSpot",
                "takeAll",
            ],
            systemic: !0,
            mode: "Contact and systemic",
        },
        cleanSweepTrio: {
            frac: "1+29+3",
            products: [{
                trade: "Clean Sweep Trio",
                rate: "12-20 L/ha",
                interval: "14-28"
            }, ],
            actives: ["thiophanateMethyl", "fluazinam", "tebuconazole"],
            targets: [
                "dollarSpot",
                "helminthosporium",
                "anthracnose",
                "brownPatch",
                "eri",
                "couchgrassDecline",
                "takeAll",
                "fairyRing",
            ],
            systemic: !0,
            mode: "Contact and systemic",
        },
    },
    FUNGICIDES_UK = {
        propiconazole: {
            frac: 3,
            products: [{
                trade: "Banner Maxx II",
                mapp: "13167",
                rate: "1.1 L/ha",
                interval: "14-28",
                notes: "Rainfast 15 mins",
            }, ],
            targets: ["fusarium", "dollarSpot", "anthracnose", "brownPatch", "rust"],
            systemic: !0,
            mode: "Sterol synthesis (DMI)",
        },
        tebuconazole: {
            frac: 3,
            products: [{
                    trade: "Dualitas",
                    mapp: "18000",
                    rate: "0.75-1 L/ha",
                    interval: "14-28",
                    notes: "With trifloxystrobin",
                },
                {
                    trade: "Dedicate",
                    mapp: "20307",
                    rate: "0.75-1 L/ha",
                    interval: "14-28",
                    notes: "With trifloxystrobin. Updated MAPP 2024.",
                },
            ],
            targets: [
                "fusarium",
                "redThread",
                "anthracnose",
                "dollarSpot",
                "leafSpot",
                "rust",
            ],
            systemic: !0,
            mode: "Sterol synthesis (DMI)",
        },
        difenoconazole: {
            frac: 3,
            products: [{
                    trade: "Instrata Elite",
                    mapp: "17976",
                    rate: "2.5 L/ha",
                    interval: "14-28",
                    notes: "With fludioxonil, max 2/year",
                },
                {
                    trade: "Ascernity",
                    mapp: "19544",
                    rate: "3 L/ha",
                    interval: "14-28",
                    notes: "With benzovindiflupyr",
                },
            ],
            targets: ["fusarium", "dollarSpot", "brownPatch", "anthracnose"],
            systemic: !0,
            mode: "Sterol synthesis (DMI)",
        },
        mefentrifluconazole: {
            frac: 3,
            products: [{
                trade: "Maxtima",
                mapp: "19879",
                rate: "1.5-2.5 L/ha",
                interval: "14-21",
                notes: "Broad spectrum, turf-safe",
            }, ],
            targets: [
                "fusarium",
                "dollarSpot",
                "anthracnose",
                "brownPatch",
                "leafSpot",
            ],
            systemic: !0,
            mode: "Sterol synthesis (DMI)",
        },
        metalaxylM: {
            frac: 4,
            products: [{
                trade: "Subdue Maxx",
                mapp: "12453",
                rate: "1.25 L/ha",
                interval: "14-21",
                notes: "Pythium specialist",
            }, ],
            targets: ["pythium"],
            systemic: !0,
            mode: "RNA synthesis",
        },
        propamocarb: {
            frac: 28,
            products: [{
                trade: "Filex",
                rate: "3 L/ha",
                interval: "7-14",
                notes: "Pythium root rot",
            }, ],
            targets: ["pythium"],
            systemic: !0,
            mode: "Cell membrane",
        },
        fosetylAl: {
            frac: 33,
            products: [{
                trade: "Signature XTRA Stressgard",
                mapp: "21003",
                rate: "6 kg/ha",
                interval: "14-21",
                notes: "GB approval. NI MAPP: 21103. Bidirectional systemic.",
            }],
            targets: ["pythium", "anthracnose", "takeAll", "yellowTuft"],
            systemic: !0,
            bidirectional: !0,
            mode: "Phosphonate - host defense induction",
        },
        penthiopyrad: {
            frac: 7,
            products: [{
                trade: "Velista",
                mapp: "17406",
                rate: "1-1.5 kg/ha",
                interval: "14-21",
                notes: "WG formulation",
            }, ],
            targets: [
                "fusarium",
                "anthracnose",
                "brownPatch",
                "dollarSpot",
                "redThread",
                "leafSpot",
            ],
            systemic: !0,
            mode: "Respiration (SDHI)",
        },
        benzovindiflupyr: {
            frac: 7,
            products: [{
                trade: "Ascernity",
                mapp: "19544",
                rate: "3 L/ha",
                interval: "14-28",
                notes: "With difenoconazole",
            }, ],
            targets: ["fusarium", "dollarSpot", "anthracnose"],
            systemic: !0,
            mode: "Respiration (SDHI)",
        },
        pydiflumetofen: {
            frac: 7,
            products: [{
                trade: "Posterity",
                mapp: "18739",
                rate: "0.5-1 L/ha",
                interval: "14-28",
            }, ],
            targets: ["dollarSpot", "fusarium"],
            systemic: !0,
            mode: "Respiration (SDHI)",
        },
        fluopyram: {
            frac: 7,
            products: [{
                trade: "Exteris Stressgard",
                mapp: "17825",
                rate: "3 L/ha",
                interval: "14-28",
                notes: "With trifloxystrobin. Max 2 apps/year. First UK SDHI combo.",
            }],
            targets: [
                "fusarium",
                "dollarSpot",
                "leafSpot",
                "anthracnose",
                "brownPatch",
                "redThread",
                "rust",
                "pinkSnowMold",
            ],
            systemic: !0,
            mode: "Respiration (SDHI)",
            stressgard: !0,
        },
        azoxystrobin: {
            frac: 11,
            products: [{
                    trade: "Heritage",
                    mapp: "12734",
                    rate: "100 g/ha",
                    interval: "21-28",
                    notes: "WG granular, still available",
                },
                {
                    trade: "Plazma",
                    mapp: "18621",
                    rate: "0.8 L/ha",
                    interval: "21-28",
                    notes: "250 g/L SC",
                },
            ],
            targets: [
                "fusarium",
                "takeAll",
                "anthracnose",
                "brownPatch",
                "leafSpot",
                "rust",
                "fairyRing",
            ],
            systemic: !0,
            mode: "Respiration (QoI)",
            withdrawn: [{
                trade: "Heritage Maxx",
                date: "2024-03-24",
                notes: "Liquid formulation withdrawn",
            }, ],
        },
        pyraclostrobin: {
            frac: 11,
            products: [{
                    trade: "Insignia",
                    mapp: "19403",
                    rate: "0.5 L/ha",
                    interval: "14-21",
                    notes: "200 g/L WG",
                },
                {
                    trade: "Vanguard",
                    mapp: "20846",
                    rate: "0.5 L/ha",
                    interval: "14-21",
                },
            ],
            targets: ["fusarium", "redThread", "dollarSpot"],
            systemic: !0,
            mode: "Respiration (QoI)",
        },
        trifloxystrobin: {
            frac: 11,
            products: [{
                    trade: "Dualitas",
                    mapp: "18000",
                    rate: "0.75-1 L/ha",
                    interval: "14-28",
                    notes: "With tebuconazole",
                },
                {
                    trade: "Dedicate",
                    mapp: "20307",
                    rate: "0.75-1 L/ha",
                    interval: "14-28",
                    notes: "With tebuconazole. Updated MAPP 2024.",
                },
            ],
            targets: [
                "fusarium",
                "redThread",
                "anthracnose",
                "dollarSpot",
                "leafSpot",
                "rust",
            ],
            systemic: !0,
            mode: "Respiration (QoI)",
        },
        fludioxonil: {
            frac: 12,
            products: [{
                trade: "Medallion TL",
                mapp: "15287",
                rate: "3 L/ha",
                interval: "21-28",
                notes: "Contact+ action, best in cool weather",
            }, ],
            targets: ["fusarium", "anthracnose", "leafSpot"],
            systemic: !1,
            mode: "Signal transduction",
        },
        chlorothalonil: {
            frac: "M5",
            products: [],
            targets: ["fusarium", "dollarSpot", "brownPatch", "anthracnose"],
            systemic: !1,
            mode: "Multi-site activity",
            notes: "Standalone products withdrawn. Still in Instrata Elite mix.",
            restricted: !0,
        },
        instrataElite: {
            frac: "3+12",
            products: [{
                trade: "Instrata Elite",
                mapp: "17976",
                rate: "2.5 L/ha",
                interval: "14-28",
                notes: "Max 2 applications/year",
            }, ],
            actives: ["difenoconazole", "fludioxonil"],
            composition: "80.3 g/L difenoconazole + 80.3 g/L fludioxonil",
            targets: ["fusarium", "dollarSpot", "brownPatch", "anthracnose"],
            systemic: !0,
            mode: "Contact and systemic",
        },
        ascernity: {
            frac: "3+7",
            products: [{
                trade: "Ascernity",
                mapp: "19544",
                rate: "3 L/ha",
                interval: "14-28",
                notes: "Golf greens/tees only",
            }, ],
            actives: ["difenoconazole", "benzovindiflupyr"],
            composition: "78.9 g/L difenoconazole + 23.6 g/L benzovindiflupyr",
            targets: ["fusarium", "dollarSpot", "anthracnose"],
            systemic: !0,
            mode: "Contact and systemic",
        },
        dualitas: {
            frac: "3+11",
            products: [{
                    trade: "Dualitas",
                    mapp: "18000",
                    rate: "0.75-1 L/ha",
                    interval: "14-28",
                },
                {
                    trade: "Dedicate",
                    mapp: "20307",
                    rate: "0.75-1 L/ha",
                    interval: "14-28",
                    notes: "Updated MAPP 2024.",
                },
            ],
            actives: ["tebuconazole", "trifloxystrobin"],
            composition: "200 g/L tebuconazole + 100 g/L trifloxystrobin",
            targets: [
                "fusarium",
                "redThread",
                "anthracnose",
                "dollarSpot",
                "leafSpot",
                "rust",
            ],
            systemic: !0,
            mode: "Contact and systemic",
        },
        exterisStressgard: {
            frac: "7+11",
            products: [{
                trade: "Exteris Stressgard",
                mapp: "17825",
                rate: "3 L/ha",
                interval: "14-28",
                notes: "Max 2 apps/year. Stressgard formulation.",
            }],
            actives: ["fluopyram", "trifloxystrobin"],
            composition: "12.5 g/L fluopyram + 12.5 g/L trifloxystrobin",
            targets: [
                "fusarium",
                "dollarSpot",
                "leafSpot",
                "anthracnose",
                "brownPatch",
                "redThread",
                "rust",
                "pinkSnowMold",
            ],
            systemic: !0,
            mode: "Dual SDHI + QoI systemic",
            stressgard: !0,
        },
        headway: {
            frac: "11+3",
            products: [{
                trade: "Headway",
                mapp: "14760",
                rate: "3 L/ha",
                interval: "21-28",
                notes: "Broad spectrum foliar + soil-borne",
            }],
            actives: ["azoxystrobin", "propiconazole"],
            composition: "93.5 g/L azoxystrobin + 93.5 g/L propiconazole",
            targets: [
                "fusarium",
                "takeAll",
                "anthracnose",
                "dollarSpot",
                "leafSpot",
                "rust",
                "fairyRing",
                "redThread",
            ],
            systemic: !0,
            mode: "Dual QoI + DMI systemic",
        },
        _biocontrols: {
            gliocladiumCatenulatum: {
                frac: "BM02",
                products: [{
                    trade: "Prestop",
                    rate: "5 g/m²",
                    interval: "7-14",
                    notes: "Preventive only. Soil drench.",
                }],
                targets: ["pythium", "fusarium", "brownPatch"],
                mode: "Biological - mycoparasitism",
                organic: !0,
            },
            bacillusSubtilis: {
                frac: "BM02",
                products: [{
                    trade: "Serenade ASO",
                    mapp: "21020",
                    rate: "4-8 L/ha",
                    interval: "7-14",
                    notes: "Extended GB approval to Oct 2031",
                }],
                targets: ["fusarium", "anthracnose", "brownPatch"],
                mode: "Biological - antibiosis",
                organic: !0,
            },
            trichodermaAsperellum: {
                frac: "BM02",
                products: [{
                    trade: "T34 Biocontrol",
                    rate: "As label",
                    interval: "14-21",
                    notes: "Root zone application",
                }],
                targets: ["pythium", "fusarium", "brownPatch"],
                mode: "Biological - mycoparasitism",
                organic: !0,
            },
        },
        _withdrawn: {
            iprodione: {
                frac: 2,
                products: ["Chipco Green", "Interface", "Mascot Rayzor"],
                withdrawnDate: "2018-06-05",
                reason: "Carcinogenic concerns",
                targets: [
                    "fusarium",
                    "dollarSpot",
                    "anthracnose",
                    "leafSpot",
                    "redThread",
                ],
            },
            heritageMaxx: {
                frac: 11,
                products: ["Heritage Maxx"],
                withdrawnDate: "2024-03-24",
                reason: "Regulatory withdrawal",
                targets: [
                    "fusarium",
                    "takeAll",
                    "anthracnose",
                    "brownPatch",
                    "leafSpot",
                    "rust",
                ],
            },
        },
    },
    UK_DISEASE_NAMES = {
        fusarium: "Microdochium Patch",
        dollarSpot: "Dollar Spot",
        anthracnose: "Anthracnose",
        brownPatch: "Brown Patch",
        redThread: "Red Thread",
        leafSpot: "Leaf Spot",
        rust: "Rust",
        takeAll: "Take-all Patch",
        fairyRing: "Fairy Ring",
        pythium: "Pythium",
        pinkSnowMold: "Pink Snow Mold",
        yellowTuft: "Yellow Tuft",
    },
    FUNGICIDES_SCANDINAVIA = {
        difenoconazole: {
            frac: 3,
            products: [{
                    trade: "Ascernity",
                    rate: "3 L/ha",
                    interval: "14-28",
                    notes: "SE: tees & greens. With benzovindiflupyr",
                    country: "SE",
                },
                {
                    trade: "Instrata Elite",
                    rate: "2.5 L/ha",
                    interval: "14-28",
                    notes: "SE: tees, greens, collars (fairway handheld). With fludioxonil",
                    country: "SE",
                },
                {
                    trade: "Ascernity",
                    rate: "3 L/ha",
                    interval: "14-28",
                    notes: "NO: Microdochium, brown patch, anthracnose, dollar spot",
                    country: "NO",
                },
            ],
            targets: ["fusarium", "dollarSpot", "brownPatch", "anthracnose"],
            systemic: !0,
            mode: "Sterol synthesis (DMI)",
        },
        prothioconazole: {
            frac: 3,
            products: [{
                    trade: "Proline EC 250",
                    rate: "0.8 L/ha",
                    interval: "14-28",
                    notes: "DK: minor use, snow mold",
                    country: "DK",
                },
                {
                    trade: "Delaro 325 SC",
                    rate: "1 L/ha",
                    interval: "14-28",
                    notes: "NO: with trifloxystrobin, Microdochium patch",
                    country: "NO",
                },
            ],
            targets: ["fusarium", "snowMold"],
            systemic: !0,
            mode: "Sterol synthesis (DMI)",
        },
        fluopyram: {
            frac: 7,
            products: [{
                trade: "Exteris StressGard",
                rate: "10 L/ha",
                interval: "14-28",
                notes: "SE: tees, greens, collars. With trifloxystrobin",
                country: "SE",
            }, ],
            targets: ["dollarSpot", "fusarium", "brownPatch"],
            systemic: !0,
            mode: "Succinate dehydrogenase inhibitor",
        },
        benzovindiflupyr: {
            frac: 7,
            products: [{
                trade: "Ascernity",
                rate: "3 L/ha",
                interval: "14-28",
                notes: "SE: tees & greens. With difenoconazole",
                country: "SE",
            }, ],
            targets: ["dollarSpot", "fusarium", "anthracnose", "brownPatch"],
            systemic: !0,
            mode: "Succinate dehydrogenase inhibitor",
        },
        boscalid: {
            frac: 7,
            products: [{
                    trade: "Signum",
                    rate: "1.5 kg/ha",
                    interval: "14-28",
                    notes: "SE: tees, greens, collars. With pyraclostrobin. Dollar spot, snow mold",
                    country: "SE",
                },
                {
                    trade: "Signum",
                    rate: "1.5 kg/ha",
                    interval: "14-28",
                    notes: "DK: minor use, dollar spot",
                    country: "DK",
                },
            ],
            targets: ["dollarSpot", "snowMold", "fusarium"],
            systemic: !0,
            mode: "Succinate dehydrogenase inhibitor",
        },
        azoxystrobin: {
            frac: 11,
            products: [{
                    trade: "Heritage",
                    rate: "0.6 kg/ha",
                    interval: "14-28",
                    notes: "SE: tees & greens, fungal attack",
                    country: "SE",
                },
                {
                    trade: "Amistar",
                    rate: "1 L/ha",
                    interval: "14-28",
                    notes: "NO: minor use, root diseases",
                    country: "NO",
                },
            ],
            targets: ["brownPatch", "pythium", "anthracnose", "takeAll"],
            systemic: !0,
            mode: "QoI - respiration inhibitor",
        },
        trifloxystrobin: {
            frac: 11,
            products: [{
                    trade: "Exteris StressGard",
                    rate: "10 L/ha",
                    interval: "14-28",
                    notes: "SE: with fluopyram",
                    country: "SE",
                },
                {
                    trade: "Delaro 325 SC",
                    rate: "1 L/ha",
                    interval: "14-28",
                    notes: "NO: with prothioconazole",
                    country: "NO",
                },
            ],
            targets: ["fusarium", "dollarSpot", "brownPatch"],
            systemic: !0,
            mode: "QoI - respiration inhibitor",
        },
        pyraclostrobin: {
            frac: 11,
            products: [{
                trade: "Signum",
                rate: "1.5 kg/ha",
                interval: "14-28",
                notes: "SE/DK: with boscalid",
                country: "SE",
            }, ],
            targets: ["dollarSpot", "snowMold", "fusarium"],
            systemic: !0,
            mode: "QoI - respiration inhibitor",
        },
        fludioxonil: {
            frac: 12,
            products: [{
                    trade: "Medallion TL",
                    rate: "3 L/ha",
                    interval: "14-28",
                    notes: "SE: tees & greens",
                    country: "SE",
                },
                {
                    trade: "Medallion TL",
                    rate: "3 L/ha",
                    interval: "14-28",
                    notes: "DK: tees, greens, sports. Snow mold, anthracnose, red thread",
                    country: "DK",
                },
                {
                    trade: "Medallion TL",
                    rate: "3 L/ha",
                    interval: "14-28",
                    notes: "NO: Microdochium, brown patch, anthracnose",
                    country: "NO",
                },
                {
                    trade: "Instrata Elite",
                    rate: "2.5 L/ha",
                    interval: "14-28",
                    notes: "SE: with difenoconazole",
                    country: "SE",
                },
                {
                    trade: "Switch 62.5 WG",
                    rate: "1 kg/ha",
                    interval: "14-28",
                    notes: "DK: minor use, snow mold. With cyprodinil",
                    country: "DK",
                },
            ],
            targets: [
                "fusarium",
                "snowMold",
                "anthracnose",
                "redThread",
                "brownPatch",
            ],
            systemic: !1,
            mode: "MAP/histidine kinase signal transduction",
        },
        cyprodinil: {
            frac: 9,
            products: [{
                trade: "Switch 62.5 WG",
                rate: "1 kg/ha",
                interval: "14-28",
                notes: "DK: minor use, with fludioxonil",
                country: "DK",
            }, ],
            targets: ["snowMold", "fusarium"],
            systemic: !0,
            mode: "Amino acid synthesis",
        },
        fosetylAl: {
            frac: 33,
            products: [{
                trade: "Signature Xtra StressGard",
                rate: "12 kg/ha",
                interval: "14-28",
                notes: "SE: tees & greens. Snow mold, anthracnose",
                country: "SE",
            }, ],
            targets: ["pythium", "snowMold", "anthracnose"],
            systemic: !0,
            mode: "Phosphonate - host defense",
        },
        streptomycesK61: {
            frac: "BM02",
            products: [{
                    trade: "Mycostop",
                    rate: "5 g/m²",
                    interval: "7-14",
                    notes: "SE: short-mown turf <15mm, greens. General fungal attack",
                    country: "SE",
                },
                {
                    trade: "Mycostop WP",
                    rate: "5 g/m²",
                    interval: "7-14",
                    notes: "DK: minor use, fungal attacks",
                    country: "DK",
                },
            ],
            targets: ["fusarium", "pythium", "rhizoctonia"],
            systemic: !1,
            mode: "Biological - Streptomyces griseoviridis K61",
        },
        clonostachysJ1446: {
            frac: "BM02",
            products: [{
                    trade: "Prestop",
                    rate: "5 g/m²",
                    interval: "7-14",
                    notes: "SE: short-mown turf <15mm, greens",
                    country: "SE",
                },
                {
                    trade: "Prestop WP",
                    rate: "5 g/m²",
                    interval: "7-14",
                    notes: "DK: minor use, fungal diseases",
                    country: "DK",
                },
            ],
            targets: ["fusarium", "pythium", "botrytis"],
            systemic: !1,
            mode: "Biological - Clonostachys rosea J1446",
        },
        trichodermaT22: {
            frac: "BM02",
            products: [{
                    trade: "Trianum-P",
                    rate: "3 kg/ha",
                    interval: "7-14",
                    notes: "SE: turf general. Fungal attack",
                    country: "SE",
                },
                {
                    trade: "Trianum-P",
                    rate: "3 kg/ha",
                    interval: "7-14",
                    notes: "DK: established turf. Sclerotinia",
                    country: "DK",
                },
                {
                    trade: "Trianum-G",
                    rate: "3 kg/ha",
                    interval: "7-14",
                    notes: "DK: granular form",
                    country: "DK",
                },
            ],
            targets: ["fusarium", "pythium", "sclerotinia", "rhizoctonia"],
            systemic: !1,
            mode: "Biological - Trichoderma harzianum T-22",
        },
        bacillusFZB24: {
            frac: "BM02",
            products: [{
                trade: "Taegro",
                rate: "0.37 kg/ha",
                interval: "7-14",
                notes: "SE: greens, tees, collars. Fungal attack",
                country: "SE",
            }, ],
            targets: ["fusarium", "pythium", "rhizoctonia"],
            systemic: !1,
            mode: "Biological - Bacillus amyloliquefaciens FZB24",
        },
        lalstopG46: {
            frac: "BM02",
            products: [{
                trade: "Lalstop G46 WG",
                rate: "2 kg/ha",
                interval: "7-14",
                notes: "DK: minor use. Fusarium, Rhizoctonia, Pythium",
                country: "DK",
            }, ],
            targets: ["fusarium", "pythium", "rhizoctonia"],
            systemic: !1,
            mode: "Biological",
        },
        harmonix: {
            frac: "BM02",
            products: [{
                trade: "Harmonix Turf Defense",
                rate: "As label",
                interval: "7-14",
                notes: "DK: golf, sports. Snow mold, anthracnose, dollar spot",
                country: "DK",
            }, ],
            targets: ["snowMold", "anthracnose", "dollarSpot"],
            systemic: !1,
            mode: "Biological",
        },
    },
    SCANDINAVIA_DISEASE_NAMES = {
        fusarium: "Microdochium Patch / Snow Mold",
        snowMold: "Snow Mold (Microdochium)",
        dollarSpot: "Dollar Spot",
        anthracnose: "Anthracnose",
        brownPatch: "Brown Patch",
        redThread: "Red Thread",
        pythium: "Pythium",
        takeAll: "Take-all Patch",
        sclerotinia: "Sclerotinia",
    },
    FUNGICIDES_JAPAN = {
        benomyl: {
            frac: 1,
            products: [{
                trade: "緑化用ベンレート水和剤 (Benlate)",
                rate: "As label",
                interval: "14-21",
                notes: "Cool-season: bentgrass, KBG. Brown patch, dollar spot, anthracnose, pink snow mold",
            }, ],
            targets: ["brownPatch", "dollarSpot", "anthracnose", "snowMold"],
            systemic: !0,
            mode: "Mitosis inhibitor",
        },
        metconazole: {
            frac: 3,
            products: [{
                    trade: "芝美人フロアブル",
                    rate: "As label",
                    interval: "14-21",
                    notes: "Bentgrass. Dollar spot, anthracnose, brown patch, fairy ring, snow mold",
                },
                {
                    trade: "エーツージー",
                    rate: "As label",
                    interval: "14-21",
                    notes: "With flametopyl. Zoysia: large patch, spring dead spot, necrotic ring spot, Curvularia",
                },
                {
                    trade: "トップバスター顆粒水和剤",
                    rate: "As label",
                    interval: "14-21",
                    notes: "Bentgrass. Dollar spot, brown patch",
                },
            ],
            targets: [
                "dollarSpot",
                "anthracnose",
                "brownPatch",
                "fairyRing",
                "snowMold",
                "largePatch",
                "springDeadSpot",
            ],
            systemic: !0,
            mode: "Sterol synthesis (DMI)",
        },
        tebuconazole: {
            frac: 3,
            products: [{
                trade: "パノラマフロアブル",
                rate: "As label",
                interval: "14-21",
                notes: "Bentgrass, bluegrass. Snow mold, dollar spot",
            }, ],
            targets: ["snowMold", "dollarSpot"],
            systemic: !0,
            mode: "Sterol synthesis (DMI)",
        },
        validamycin: {
            frac: 24,
            products: [{
                trade: "住化トルファン",
                rate: "As label",
                interval: "14-21",
                notes: "With ferimzone. Zoysia & bentgrass. Large patch, brown patch, anthracnose, Helminthosporium, Curvularia",
            }, ],
            targets: [
                "largePatch",
                "brownPatch",
                "anthracnose",
                "helminthosporium",
                "curvularia",
            ],
            systemic: !0,
            mode: "Trehalase inhibitor",
        },
        ferimzone: {
            frac: 17,
            products: [{
                trade: "住化トルファン",
                rate: "As label",
                interval: "14-21",
                notes: "With validamycin",
            }, ],
            targets: ["largePatch", "brownPatch", "helminthosporium"],
            systemic: !0,
            mode: "Sterol synthesis (different site)",
        },
        flametopyl: {
            frac: "U18",
            products: [{
                trade: "エーツージー",
                rate: "As label",
                interval: "14-21",
                notes: "With metconazole. Zoysia specialist",
            }, ],
            targets: [
                "largePatch",
                "springDeadSpot",
                "necroticRingSpot",
                "curvularia",
            ],
            systemic: !0,
            mode: "Unknown mechanism",
        },
        dogurin: {
            frac: "M",
            products: [{
                trade: "ドウグリン水和剤",
                rate: "As label",
                interval: "14-21",
                notes: "Bentgrass. Snow mold, brown patch",
            }, ],
            targets: ["snowMold", "brownPatch"],
            systemic: !1,
            mode: "Multi-site",
        },
        honor: {
            frac: "M",
            products: [{
                trade: "オナーWDG",
                rate: "As label",
                interval: "14-21",
                notes: "Bentgrass, bermuda, Zoysia. Pythium, dollar spot, anthracnose, fairy ring, red thread, Curvularia",
            }, ],
            targets: [
                "pythium",
                "dollarSpot",
                "anthracnose",
                "fairyRing",
                "redThread",
                "curvularia",
            ],
            systemic: !0,
            mode: "Multi-site combination",
        },
    },
    JAPAN_DISEASE_NAMES = {
        largePatch: "Large Patch (ラージパッチ)",
        brownPatch: "Brown Patch (葉腐病)",
        dollarSpot: "Dollar Spot (ダラースポット)",
        anthracnose: "Anthracnose (炭疽病)",
        snowMold: "Snow Mold (雪腐病)",
        springDeadSpot: "Spring Dead Spot (疑似葉腐病)",
        pythium: "Pythium (ピシウム病)",
        fairyRing: "Fairy Ring (フェアリーリング)",
        helminthosporium: "Helminthosporium (ヘルミントスポリウム)",
        curvularia: "Curvularia Leaf Blight (カーブラリア)",
        necroticRingSpot: "Necrotic Ring Spot",
        redThread: "Red Thread (赤焼病)",
    },
    FUNGICIDES = {
        propiconazole: {
            trade: "Banner Maxx",
            frac: 3,
            rate: "5-10 L/ha",
            targets: ["dollarSpot", "brownPatch", "anthracnose", "springDeadSpot"],
            systemic: !0,
        },
        tebuconazole: {
            trade: "Dedicate Forte",
            frac: 3,
            rate: "3.5 L/ha",
            targets: [
                "brownPatch",
                "springDeadSpot",
                "helminthosporium",
                "fairyRing",
            ],
            systemic: !0,
        },
        azoxystrobin: {
            trade: "Heritage Maxx",
            frac: 11,
            rate: "6 L/ha",
            targets: ["brownPatch", "pythium", "anthracnose", "springDeadSpot"],
            systemic: !0,
        },
        mefenoxam: {
            trade: "Subdue Maxx",
            frac: 4,
            rate: "2-4 L/ha",
            targets: ["pythium"],
            systemic: !0,
        },
        fosetylAl: {
            trade: "Signature Xtra",
            frac: 33,
            rate: "5.5-16.5 L/ha",
            targets: ["pythium", "takeAll", "eri"],
            systemic: !0,
        },
        chlorothalonil: {
            trade: "Daconil",
            frac: "M5",
            rate: "13-24 L/ha",
            targets: ["dollarSpot", "brownPatch", "anthracnose", "helminthosporium"],
            systemic: !1,
        },
        iprodione: {
            trade: "Voltar 500",
            frac: 2,
            rate: "4.5-9 L/ha",
            targets: ["dollarSpot", "brownPatch", "fusarium", "springDeadSpot"],
            systemic: !1,
        },
        fluazinam: {
            trade: "Emerald",
            frac: 29,
            rate: "1.5 L/ha",
            targets: ["dollarSpot", "brownPatch", "anthracnose", "fusarium"],
            systemic: !1,
        },
        penthiopyrad: {
            trade: "Velista",
            frac: 7,
            rate: "1-1.5 L/ha",
            targets: [
                "dollarSpot",
                "brownPatch",
                "anthracnose",
                "springDeadSpot",
                "fairyRing",
            ],
            systemic: !0,
        },
        fluopyram: {
            trade: "Exteris Stressgard",
            frac: 7,
            rate: "10 L/ha",
            targets: ["dollarSpot", "springDeadSpot", "fusarium", "rust"],
            systemic: !0,
        },
    };

function classifyRisk(e) {
    return e >= DISEASE_CONFIG.thresholds.severe ?
        "severe" :
        e >= DISEASE_CONFIG.thresholds.high ?
        "high" :
        e >= DISEASE_CONFIG.thresholds.moderate ?
        "moderate" :
        "low";
}

function getNightTemp(e) {
    // b35fix351: null-passthrough mirroring the pure-engine fix.
    // Pre-fix `|| 15` (twice) fabricated 15°C on every climate without min.
    // Currently dead code in production (only the pure file's getNightTemp
    // is wired to PythiumModel) but kept symmetric with the pure helper for
    // the same reason b35fix345 mirrored getNightHumidity here: the legacy
    // file loads BEFORE the pure file, and any future call site picking up
    // this `getNightTemp` symbol from the legacy global scope must get the
    // post-fix semantics. Strict numeric guard matches b35fix349 canonical.
    if (!e?.hourlyData?.temperature_2m || !e?.hourlyData?.time) {
        const minScalar = e?.temperature?.min;
        return (typeof minScalar === 'number' && !isNaN(minScalar)) ? minScalar : null;
    }
    const t = e.hourlyData.time
        .map((t, a) => {
            const r = new Date(t).getHours();
            if (r < 20 && r > 6) return null;
            const v = e.hourlyData.temperature_2m[a];
            return (typeof v === 'number' && !isNaN(v)) ? v : null;
        })
        .filter((v) => null !== v);
    if (t.length > 0) return Math.min(...t);
    const minScalar = e?.temperature?.min;
    return (typeof minScalar === 'number' && !isNaN(minScalar)) ? minScalar : null;
}

function getNightHumidity(e) {
    // b35fix345: null-passthrough mirroring b35fix344 in disease-engine-pure.js.
    // Pre-fix `|| 70` (twice) fabricated 70% night humidity on every site
    // without hourly RH data — the legacy engine loads BEFORE disease-engine-pure.js
    // and is what `gaip-disease-engine` registers, so this codepath was active
    // alongside the pure engine. Behaviourally inert in production (downstream
    // thresholds are >70 / >85 so 70 produces 0 contribution) but the diagnostic
    // and consumer-side value reads were wrong. Now: real night avg from hourly
    // when present, else climate.moisture.humidity.mean, else null. Consumers
    // must null-guard.
    if (!e?.hourlyData?.relative_humidity_2m || !e?.hourlyData?.time)
        return e?.moisture?.humidity?.mean ?? null;
    const t = e.hourlyData.time
        .map((t, a) => {
            const r = new Date(t).getHours();
            return r >= 20 || r <= 6 ? e.hourlyData.relative_humidity_2m[a] : null;
        })
        .filter((e) => null !== e && typeof e === 'number' && !isNaN(e));
    return t.length > 0 ? t.reduce((e, t) => e + t, 0) / t.length : (e?.moisture?.humidity?.mean ?? null);
}

function getHighHumidityHours(e) {
    return e?.hourlyData?.relative_humidity_2m ?
        e.hourlyData.relative_humidity_2m.filter((e) => e >= 85).length :
        0;
}

function getLeafWetnessHours(e) {
    if (_currentDewData?.leafWetness?.averageWetHours)
        return Math.round(_currentDewData.leafWetness.averageWetHours);
    if (_currentDewData?.leafWetness?.totalWetHours)
        return Math.round(_currentDewData.leafWetness.totalWetHours / 7);
    if (!e?.hourlyData?.relative_humidity_2m) return 0;
    const t = e.hourlyData.relative_humidity_2m.filter((e) => e >= 90).length,
        a = Math.max(1, e.hourlyData.relative_humidity_2m.length / 24);
    return Math.round(t / a);
}

function getMeanHumidity(e) {
    if (Number.isFinite(e?.moisture?.humidity?.mean)) return e.moisture.humidity.mean;
    if (!e?.hourlyData?.relative_humidity_2m || 0 === e.hourlyData.relative_humidity_2m.length) return null;
    const t = e.hourlyData.relative_humidity_2m.filter((e) => Number.isFinite(e));
    return t.length > 0 ? t.reduce((e, t) => e + t, 0) / t.length : null;
}

function hasDewOrLeafWetnessData() {
    return !!(_currentDewData?.leafWetness?.averageWetHours || _currentDewData?.leafWetness?.totalWetHours);
}

function get5DayAvgTemp(e) {
    if (!e || 0 === e.length) return null;
    const t = e.slice(0, 5);
    return t.reduce((e, t) => e + (t.mean || 0), 0) / t.length;
}
const N_MODIFIERS = {
        deficient: 1.5,
        low: 1.3,
        adequate: 1,
        optimal: 0.95,
        high: 0.9,
        excessive: 1.05,
    },
    N_MODIFIERS_BROWN_PATCH = {
        deficient: 0.6,
        low: 0.8,
        adequate: 1,
        optimal: 1.1,
        high: 1.4,
        excessive: 1.8,
    };

function getFungicideDatabase(e) {
    let t = (e || "AU").toUpperCase();
    // Normalize region IDs (e.g. 'new_zealand') to country codes (e.g. 'NZ')
    // hub-orchestrator may pass region IDs from regional-profiles.js
    const regionAliases = {
        'NEW_ZEALAND': 'NZ',
        'AUSTRALIA': 'AU', 'AUSTRALIA_TEMPERATE': 'AU', 'AUSTRALIA_SUBTROPICAL': 'AU',
        'AUSTRALIA_TROPICAL': 'AU', 'AUSTRALIA_MEDITERRANEAN': 'AU',
        'UK_IRELAND': 'UK', 'JAPAN': 'JP',
        'SCANDINAVIA': 'SCAND', 'SWEDEN': 'SE', 'NORWAY': 'NO', 'DENMARK': 'DK',
        'FRANCE': 'FR', 'SPAIN': 'ES', 'GERMANY': 'DE', 'NETHERLANDS': 'NL',
        'US_TRANSITION': 'US', 'US_COOL': 'US', 'US_WARM': 'US',
        'SOUTH_AFRICA': 'ZA'
    };
    if (regionAliases[t]) t = regionAliases[t];
    switch (t) {
        case "UK":
        case "GB":
        case "IE":
            return {
                db: FUNGICIDES_UK,
                    supported: !0,
                    region: "UK/Ireland",
                    diseaseNames: UK_DISEASE_NAMES,
            };
        case "AU":
            return {
                db: FUNGICIDES_AU, supported: !0, region: "Australia"
            };
        case "NZ":
            if (typeof window !== 'undefined' && window.GAIP_NZ_FUNGICIDES && window.GAIP_NZ_FUNGICIDES.db) {
                return {
                    db: window.GAIP_NZ_FUNGICIDES.db, supported: !0, region: "New Zealand",
                    notes: "NZ products with rates from Living Turf NZ Fungicide Chart and verified NZ labels."
                };
            }
            return {
                db: FUNGICIDES_AU, supported: !0, region: "New Zealand",
                warning: "NZ fungicide database not loaded. Showing AU products - verify ACVM registration before use.",
                notes: "Products shown are from the AU database. Verify ACVM registration before use in NZ."
            };
        case "SE":
            return "undefined" != typeof FUNGICIDES_SWEDEN ?
                {
                    db: FUNGICIDES_SWEDEN,
                    supported: !0,
                    region: "Sweden",
                    diseaseNames: SWEDEN_DISEASE_NAMES || SCANDINAVIA_DISEASE_NAMES,
                    notes: "Products from KEMI register + SGF approved list 2024-2025",
                } :
                {
                    db: FUNGICIDES_SCANDINAVIA,
                    supported: !0,
                    region: "Sweden",
                    diseaseNames: SCANDINAVIA_DISEASE_NAMES,
                    notes: "Products from SGF approved list 2025-10-31",
                };
        case "NO":
            return "undefined" != typeof FUNGICIDES_NORWAY ?
                {
                    db: FUNGICIDES_NORWAY,
                    supported: !0,
                    region: "Norway",
                    diseaseNames: NORWAY_DISEASE_NAMES || SCANDINAVIA_DISEASE_NAMES,
                    notes: "Products from Mattilsynet register 2024",
                } :
                {
                    db: FUNGICIDES_SCANDINAVIA,
                    supported: !0,
                    region: "Norway",
                    diseaseNames: SCANDINAVIA_DISEASE_NAMES,
                    notes: "Products from Gressforum 01/24 (NGF)",
                };
        case "DK":
            return "undefined" != typeof FUNGICIDES_DENMARK ?
                {
                    db: FUNGICIDES_DENMARK,
                    supported: !0,
                    region: "Denmark",
                    diseaseNames: DENMARK_DISEASE_NAMES || SCANDINAVIA_DISEASE_NAMES,
                    notes: "Products from Danish EPA BMD 2024",
                } :
                {
                    db: FUNGICIDES_SCANDINAVIA,
                    supported: !0,
                    region: "Denmark",
                    diseaseNames: SCANDINAVIA_DISEASE_NAMES,
                    notes: "Products from Danish Golf Union guidance",
                };
        case "FI":
            return {
                db: FUNGICIDES_SCANDINAVIA,
                    supported: !1,
                    region: "Finland",
                    diseaseNames: SCANDINAVIA_DISEASE_NAMES,
                    warning:
                    "Using Scandinavian registrations as reference. Verify Finnish Tukes registrations.",
            };
        case "JP":
            return "undefined" != typeof FUNGICIDES_JAPAN_EXPANDED ?
                {
                    db: FUNGICIDES_JAPAN_EXPANDED,
                    supported: !0,
                    region: "Japan",
                    diseaseNames: JAPAN_DISEASE_NAMES_EXPANDED || JAPAN_DISEASE_NAMES,
                    notes: "Products from MAFF pesticide register 2024 (expanded)",
                } :
                {
                    db: FUNGICIDES_JAPAN,
                    supported: !0,
                    region: "Japan",
                    diseaseNames: JAPAN_DISEASE_NAMES,
                    notes: "Products from MAFF pesticide register",
                };
        case "FR":
        case "FRANCE":
            return "undefined" != typeof FUNGICIDES_FRANCE ?
                {
                    db: FUNGICIDES_FRANCE,
                    supported: !0,
                    region: "France",
                    diseaseNames: FRANCE_DISEASE_NAMES,
                    notes: "Products from ANSES E-Phy 2024. ⚠️ Loi Labbé restrictions apply from Jan 2025.",
                } :
                {
                    db: FUNGICIDES_UK,
                    supported: !1,
                    region: "France",
                    diseaseNames: UK_DISEASE_NAMES,
                    warning: "European fungicides not loaded. Showing UK products as reference.",
                };
        case "DE":
        case "GERMANY":
            return "undefined" != typeof FUNGICIDES_GERMANY ?
                {
                    db: FUNGICIDES_GERMANY,
                    supported: !0,
                    region: "Germany",
                    diseaseNames: GERMANY_DISEASE_NAMES,
                    notes: "Products with §17 PflSchG approval for Golfplatz/Sportplatz. ⚠️ Check expiry dates.",
                } :
                {
                    db: FUNGICIDES_UK,
                    supported: !1,
                    region: "Germany",
                    diseaseNames: UK_DISEASE_NAMES,
                    warning: "European fungicides not loaded. Showing UK products as reference.",
                };
        case "ES":
        case "SPAIN":
            return "undefined" != typeof FUNGICIDES_SPAIN ?
                {
                    db: FUNGICIDES_SPAIN,
                    supported: !0,
                    region: "Spain",
                    diseaseNames: SPAIN_DISEASE_NAMES,
                    notes: "Products from MAPA Registro de Productos Fitosanitarios 2024",
                } :
                {
                    db: FUNGICIDES_UK,
                    supported: !1,
                    region: "Spain",
                    diseaseNames: UK_DISEASE_NAMES,
                    warning: "European fungicides not loaded. Showing UK products as reference.",
                };
        case "NL":
        case "BE":
        case "IT":
        case "PT":
        case "AT":
        case "CH":
        case "PL":
        case "CZ":
        case "EU":
            return {
                db: FUNGICIDES_UK,
                    supported: !1,
                    region: t,
                    diseaseNames: UK_DISEASE_NAMES,
                    warning:
                    "Fungicide trade names shown are UK-registered. Check your national registration authority for locally approved products.",
            };
        case "US":
        case "CA":
            return {
                db: FUNGICIDES_AU,
                    supported: !1,
                    region: t,
                    warning:
                    "Fungicide recommendations shown for reference only. Check EPA/PMRA registrations for locally approved products.",
            };
        default:
            return {
                db: FUNGICIDES_AU,
                    supported: !1,
                    region: t,
                    warning:
                    "Fungicide recommendations based on Australian registrations. Verify local registrations before use.",
            };
    }
}

function getFungicideRecommendations(e, t, a = {}) {
    const r = getFungicideDatabase(t),
        i = r.db,
        o = a.mode || "preventive",
        n = a.maxProducts || 5,
        s = a.useContext || "golf",
        l = !1 !== a.includeRestricted,
        u = [],
        c = "microdochium" === e ? "fusarium" : e;
    for (const [e, t] of Object.entries(i)) {
        if (e.startsWith("_")) continue;
        if (!t.targets || !t.targets.includes(c)) continue;
        if (t.restricted) continue;
        if (!t.products || 0 === t.products.length) continue;
        if ("curative" === o && t.preventiveOnly) continue;
        if ("preventive" === o && t.curativePreferred) continue;
        if ("curative" === o && t.weakCurativeFor && t.weakCurativeFor.includes(c))
            continue;
        const a = "curative" === o ? (t.systemic ? 1 : 0.7) : t.systemic ? 0.8 : 1,
            r = t.products[0],
            i = r.allowedUses || t.allowedUses || ["golf", "sportsfield"],
            n = r.useCategory || t.useCategory || "professional",
            l = isProductAllowedForUse({
                allowedUses: i,
                useCategory: n
            }, s);
        u.push({
            active: e,
            trade: r.trade,
            frac: t.frac,
            rate: r.rate,
            interval: r.interval,
            mapp: r.mapp || r.amm || r.bvl || r.registro || null,
            notes: r.notes || null,
            systemic: t.systemic,
            mode: t.mode,
            suitability: a,
            useCategory: n,
            allowedUses: i,
            allowedForContext: l.allowed,
            useWarning: l.warning,
            loiLabbe: r.loiLabbe || null,
            para17: r.para17 || null,
            zulassungEnde: r.zulassungEnde || null,
            auflagen: r.auflagen || null,
        });
    }
    const d = {
            29: 3,
            7: 2.5,
            3: 2,
            2: 1.8,
            12: 1.5,
            11: 0.5
        },
        h = {
            21: 7,      // Cyazofamid (Segway) - #1 pythium curative (×0.7 contact = 4.9)
            14: 6,      // Etridiazole (Terrazole) - #2 pythium curative (×0.7 contact = 4.2)
            4: 3,       // Metalaxyl-M - #3 (×1.0 systemic = 3.0)
            '4+M03': 2.8,  // Metalaxyl-M + mancozeb combo (NZ Ridomil Gold MZ)
            28: 2.5,    // Propamocarb - #4 (×1.0 systemic = 2.5)
            29: 1.5,
            'P07': 0.5,    // Fosetyl-Al is preventiveOnly - should not appear curative
            11: 0.3,
            '11+3': 0.4    // QoI+DMI combo (Headway Maxx)
        },
        // v2.10.2: Pythium preventive scoring - fosetyl-Al is the primary pythium preventive
        // Terrazole (FRAC 14) is curative specialist, not a strong preventive
        // Emerald/fluazinam (FRAC 29) weak on pythium specifically
        // Propamocarb (FRAC 28) better curative than preventive
        pythiumPrev = {
            33: 4,      // Fosetyl-Al (Grenadier/Signature) - primary pythium preventive via host defense
            'P07': 4,   // Same as FRAC 33 - P07 code used in NZ database
            21: 3.5,    // Cyazofamid (Segway) - strong oomycete-specific preventive
            11: 2,      // QoI strobilurins - reasonable preventive
            4: 1.5,     // Metalaxyl-M - good but high resistance risk, better curative
            14: 0.8,    // Etridiazole (Terrazole) - curative specialist, weak preventive
            28: 0.8,    // Propamocarb - better as curative
            29: 0.5     // Fluazinam - weak on pythium specifically
        };
    u.forEach((e) => {
        let t = 1;
        ("pythium" === c && "curative" === o ?
            (t = h[e.frac] || 1) :
            "pythium" === c && "preventive" === o ?
            (t = pythiumPrev[e.frac] || 1) :
            "dollarSpot" === c && (t = d[e.frac] || 1),
            (e.suitability *= t),
            e.allowedForContext || (e.suitability *= 0.5));
    });
    let p = l ? u : u.filter((e) => e.allowedForContext);
    const m = new Map();
    p.forEach((e) => {
        const t = e.frac || "unknown";
        (!m.has(t) || e.suitability > m.get(t).suitability) && m.set(t, e);
    });
    const g = Array.from(m.values());
    g.sort((e, t) => t.suitability - e.suitability);
    const f = g.slice(0, n);
    return (
        r.warning && (f.regionalWarning = r.warning),
        r.notes && (f.regionalNotes = r.notes),
        (f.useContext = s),
        (f.hasRestrictedProducts = u.some((e) => !e.allowedForContext)),
        f
    );
}

function getFungicideRotation(e, t) {
    const a = getFungicideDatabase(t).db,
        r = "microdochium" === e ? "fusarium" : e,
        i = new Map();
    for (const [e, t] of Object.entries(a)) {
        if (e.startsWith("_")) continue;
        if (!t.targets?.includes(r)) continue;
        if (t.restricted || !t.products?.length) continue;
        const a = String(t.frac);
        (i.has(a) || i.set(a, []),
            i.set(a, [
                ...i.get(a),
                ...t.products.map((e) => ({
                    trade: e.trade,
                    frac: a,
                    rate: e.rate,
                    systemic: t.systemic,
                })),
            ]));
    }
    const o = [],
        n = new Set();
    for (const [e, t] of i)
        if (e.startsWith("M") && !n.has(e)) {
            (o.push({
                    step: o.length + 1,
                    ...t[0],
                    reason: "Multi-site (low resistance risk)",
                }),
                n.add(e));
            break;
        }
    for (const [e, t] of i)
        !e.startsWith("M") &&
        !n.has(e) &&
        o.length < 4 &&
        (o.push({
                step: o.length + 1,
                ...t[0],
                reason: `FRAC ${e} rotation`
            }),
            n.add(e));
    return o;
}

function formatFungicideRec(e, t) {
    const a = (t || "AU").toUpperCase();
    let r = `${e.trade} at ${e.rate}`;
    return (
        e.frac && (r += ` (FRAC ${e.frac})`),
        "UK" === a && e.mapp && (r += ` [MAPP ${e.mapp}]`),
        "DE" === a && e.para17 && (r += " [§17]"),
        "FR" === a && "exempt" === e.loiLabbe && (r += " [Biocontrôle]"),
        e.notes && (r += `, ${e.notes}`),
        e.useWarning && (r += ` ${e.useWarning}`),
        r
    );
}

function getTurfContext() {
    if ("undefined" != typeof window && window.gaipTurfProfile?.state) {
        const e = window.gaipTurfProfile.state.turfType,
            t = window.gaipTurfProfile.state.subCategory || "";
        if ("golf" === e) return "golf";
        if ("sports" === e || "stadium" === e) return "sportsfield";
        if (t.includes("park") || t.includes("amenity")) return "amenity";
        if (t.includes("lawn") || t.includes("domestic") || t.includes("home"))
            return "lawn";
    }
    if ("undefined" != typeof document) {
        const e = document.querySelector(".gaip-turf-type");
        if (e) {
            const t = e.value?.toLowerCase() || "";
            if ("golf" === t) return "golf";
            if ("sports" === t || "stadium" === t) return "sportsfield";
            if ("lawn" === t || "domestic" === t) return "lawn";
        }
    }
    return "golf";
}

function getDiseaseInterventions(e, t, a) {
    const r = getTurfContext(),
        i = {
            cultural: [],
            preventive: [],
            curative: [],
            timing: null,
            rotation: null,
            resistanceNote: null,
            useContext: r,
        };
    if (
        ((i.cultural = {
                dollarSpot: [
                    "Maintain adequate N fertility",
                    "Reduce thatch",
                    "Increase air circulation",
                    "Manage irrigation timing",
                ],
                fusarium: [
                    "Reduce N in autumn",
                    "Improve drainage",
                    "Remove dew",
                    "Avoid compaction",
                ],
                brownPatch: [
                    "Reduce N during risk periods",
                    "Improve air circulation",
                    "Water early morning",
                    "Raise HOC if possible",
                ],
                anthracnose: [
                    "Maintain balanced fertility",
                    "Reduce compaction",
                    "Manage thatch",
                    "Appropriate irrigation",
                ],
                pythium: [
                    "Improve drainage",
                    "Avoid over-watering",
                    "Reduce thatch",
                    "Ensure adequate Ca",
                ],
                springDeadSpot: [
                    "Reduce N in late summer",
                    "Improve drainage",
                    "Core aerate",
                    "Manage thatch",
                ],
                redThread: ["Increase N fertility", "Improve drainage", "Reduce thatch"],
            } [e] || ["Monitor conditions", "Maintain plant health"]),
            "low" === t)
    )
        return ((i.timing = "Monitor conditions"), i);
    if ("moderate" === t) {
        i.timing = "Prepare preventive application";
        const t = getFungicideRecommendations(e, a, {
            mode: "preventive",
            maxProducts: 5,
            useContext: r,
        });
        ((i.preventive = t.map((e) => formatFungicideRec(e, a))),
            t.regionalWarning && (i.regionalWarning = t.regionalWarning),
            t.regionalNotes && (i.regionalNotes = t.regionalNotes),
            t.hasRestrictedProducts &&
            "lawn" === r &&
            (i.useContextWarning =
                '⚠️ Some products shown are not registered for domestic lawn use. Only products marked "✓ Domestic use" may be applied to home lawns.'));
    }
    if ("high" === t || "severe" === t) {
        i.timing =
            "severe" === t ?
            "URGENT: Apply within 24 hours" :
            "Apply preventive within 48 hours";
        const o = getFungicideRecommendations(e, a, {
                mode: "preventive",
                maxProducts: 5,
                useContext: r,
            }),
            n = getFungicideRecommendations(e, a, {
                mode: "curative",
                maxProducts: 5,
                useContext: r,
            });
        ((i.preventive = o.map((e) => formatFungicideRec(e, a))),
            (i.curative = n.map((e) => formatFungicideRec(e, a))),
            (i.rotation = getFungicideRotation(e, a)),
            o.regionalWarning && (i.regionalWarning = o.regionalWarning),
            o.regionalNotes && (i.regionalNotes = o.regionalNotes),
            (o.hasRestrictedProducts || n.hasRestrictedProducts) &&
            "lawn" === r &&
            (i.useContextWarning =
                '⚠️ Some products shown are not registered for domestic lawn use. Only products marked "✓ Domestic use" may be applied to home lawns.'));
        const s = {
            dollarSpot: "Dollar spot has documented DMI (FRAC 3) and QoI (FRAC 11) resistance. Include multi-site contacts in rotation.",
            fusarium: "Rotate FRAC groups to prevent resistance development.",
            anthracnose: "QoI resistance reported. Alternate with DMI and contact fungicides.",
        };
        i.resistanceNote = s[e] || null;
    }
    return i;
}
const N_MODIFIERS_FUSARIUM = {
    deficient: 0.7,
    low: 0.85,
    adequate: 1,
    high: 1.3,
    excessive: 1.5,
};

function getFusariumNModifier(e, t, a) {
    const r = N_MODIFIERS_FUSARIUM[e] || 1;
    if (("high" === e || "excessive" === e) && t <= 15) {
        return r * ("excessive" === e ? 1.35 : 1.2);
    }
    return r;
}

// =============================================================================
// LEGACY ENGINE STUB — b35fix104 consolidation
// =============================================================================
//
// All disease model logic (DollarSpotModel, BrownPatchModel, PythiumModel, etc.)
// has been REMOVED from this file and consolidated into disease-engine-pure.js.
//
// disease-engine-pure.js is the SINGLE SOURCE OF TRUTH for all disease models.
// GILBA_USE_PURE_DISEASE = true routes all analysis through DiseaseEnginePure.
//
// This file retains:
//   - DISEASE_CONFIG, SPECIES_SUSCEPTIBILITY, N_MODIFIERS
//   - All fungicide databases (FUNGICIDES_AU, FUNGICIDES_UK, etc.)
//   - Shared helpers (getFungicideDatabase, getFungicideRecommendations, etc.)
//   - getDiseaseInterventions, getFungicideRotation, getTurfContext
//
// These are still exported to window.* and consumed by disease-engine-pure.js
// indirectly (via getInterventions calls that use getDiseaseInterventions).
//
// DO NOT re-add model logic here. If you need to change a disease model,
// edit disease-engine-pure.js only.
//
// DIVERGENCE GUARD: If you find yourself editing disease model logic in this
// file, STOP. You are in the wrong file.
// =============================================================================

/**
 * Legacy DiseaseEngine stub.
 * Proxies to DiseaseEnginePure when available.
 * Throws a clear error if called when pure engine is not loaded,
 * so silent fallback to stale model logic is impossible.
 */
const DiseaseEngine = {
    version: 'STUB, delegates to DiseaseEnginePure',
    _isStub: true,
    analyse(inputs) {
        if (typeof window !== 'undefined' && window.DiseaseEnginePure) {
            console.warn(
                '[DiseaseEngine] Legacy engine called directly, delegating to DiseaseEnginePure. ' +
                'Check that GILBA_USE_PURE_DISEASE is set correctly in hub-orchestrator.js.'
            );
            return window.DiseaseEnginePure.analyse(inputs);
        }
        throw new Error(
            '[DiseaseEngine] FATAL: Legacy engine stub invoked but DiseaseEnginePure is not loaded. ' +
            'Ensure disease-engine-pure.js loads before disease-engine.js. ' +
            'Do NOT add model logic back to this file.'
        );
    },
};

// Re-export shared utilities to window (still needed by other modules)
if (typeof window !== 'undefined') {
    window.DiseaseEngine        = DiseaseEngine;
    window.DISEASE_CONFIG       = DISEASE_CONFIG;
    window.SPECIES_SUSCEPTIBILITY = SPECIES_SUSCEPTIBILITY;
    window.USE_CATEGORIES       = USE_CATEGORIES;
    window.ALLOWED_USES         = ALLOWED_USES;
    window.isProductAllowedForUse   = isProductAllowedForUse;
    window.filterFungicidesByUse    = filterFungicidesByUse;
    window.FUNGICIDES           = FUNGICIDES;
    window.FUNGICIDES_AU        = FUNGICIDES_AU;
    window.FUNGICIDES_UK        = FUNGICIDES_UK;
    window.FUNGICIDES_SCANDINAVIA = FUNGICIDES_SCANDINAVIA;
    window.FUNGICIDES_JAPAN     = FUNGICIDES_JAPAN;
    window.UK_DISEASE_NAMES     = UK_DISEASE_NAMES;
    window.SCANDINAVIA_DISEASE_NAMES = SCANDINAVIA_DISEASE_NAMES;
    window.JAPAN_DISEASE_NAMES  = JAPAN_DISEASE_NAMES;
    window.getFungicideDatabase         = getFungicideDatabase;
    window.getFungicideRecommendations  = getFungicideRecommendations;
    window.getFungicideRotation         = getFungicideRotation;
    window.getDiseaseInterventions      = getDiseaseInterventions;
    window.getTurfContext               = getTurfContext;
}
