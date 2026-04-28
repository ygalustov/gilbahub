/**
 * AU Turf Fungicide Database
 * ==========================
 *
 * Sources:
 *   - APVMA PubCRIS (primary registration authority)
 *   - Syngenta AU / Bayer AU / Envu AU product labels
 *   - Living Turf AU product listings
 *   - Greenway Turf Solutions product data
 *   - Dow AgroSciences / Corteva AU
 *
 * Version: 1.0.0
 * Last Updated: March 2026
 *
 * Structure mirrors FUNGICIDES_NZ in nz-fungicides.js for compatibility
 * with the FungicideFilter service (fungicide-filter.js).
 *
 * Data extracted and validated from FUNGICIDES_AU in disease-engine.js,
 * restructured as a standalone queryable module with APVMA registration
 * validation support.
 *
 * Registration: APVMA (Australian Pesticides and Veterinary Medicines Authority)
 * PubCRIS dataset: https://data.gov.au/dataset/apvma-pubcris
 * Updated weekly by APVMA. Last sync: see apvmaLastSync below.
 *
 * Mode of Action codes (FRAC):
 *   M = Multi-site contact
 *   1 = MBC fungicides (benzimidazoles)
 *   2 = Dicarboximides
 *   3 = DMI / Sterol synthesis (triazoles)
 *  11 = QoI / Strobilurins
 *  12 = PP-fungicides (phenylpyrroles)
 *  14 = Various
 *  21 = QiI / Cyazofamid
 *  28 = Carbamates
 *  29 = Uncouplers
 *  33 = Phosphonates
 *  43 = SDHI / Succinate dehydrogenase inhibitors
 *  49 = Oxysterol binding protein inhibitors
 *
 * Resistance Risk: NR = No risk, L = Low, M = Medium, H = High
 *
 * Efficacy ratings (1-4 scale, 4 = most effective):
 *   Based on AU label claims, Envu trials, and field experience.
 *   0 = labelled but insufficient AU efficacy data.
 */

(function () {
    'use strict';

    // ========================================================================
    // APVMA SYNC METADATA
    // Populated by PHP sync class (class-gilba-apvma-sync.php) via wp_localize_script
    // Falls back to static if sync hasn't run
    // ========================================================================

    var apvmaLastSync = (typeof window !== 'undefined' && window.GAIP_APVMA_META)
        ? window.GAIP_APVMA_META.lastSync
        : null;

    var apvmaVersion = (typeof window !== 'undefined' && window.GAIP_APVMA_META)
        ? window.GAIP_APVMA_META.version
        : 'static-1.0.0';

    // ========================================================================
    // FUNGICIDE DATABASE
    // ========================================================================

    var FUNGICIDES_AU = {

        // ---- FRAC GROUP 1: MBC Fungicides (Benzimidazoles) ----

        thiophanateMethyl: {
            frac: 1,
            useCategory: 'professional',
            allowedUses: ['golf', 'sportsfield', 'amenity', 'sod'],
            products: [
                // Note: Clean Sweep Trio (3-way mix) is listed under cleanSweepTrio key (FRAC 1+29+3)
            ],
            targets: ['dollarSpot', 'helminthosporium', 'anthracnose', 'brownPatch', 'eri', 'fairyRing'],
            systemic: true,
            mode: 'MBC - Mitosis and cell division',
            resistanceRisk: 'H',
            efficacyAU: { dollarSpot: 3, anthracnose: 3, brownPatch: 2.5, fusarium: 2 }
        },

        thiabendazole: {
            frac: 1,
            useCategory: 'professional',
            allowedUses: ['golf', 'sportsfield', 'amenity'],
            products: [
                {
                    trade: 'Vorlon',
                    ai: 'thiabendazole',
                    rate: '3.8-5.6 L/ha',
                    interval: '14-21',
                    distributor: 'Syngenta AU',
                    notes: ''
                }
            ],
            targets: ['dollarSpot', 'fusarium'],
            systemic: true,
            mode: 'MBC - Mitosis and cell division',
            resistanceRisk: 'H',
            efficacyAU: { dollarSpot: 3, fusarium: 2.5 }
        },

        // ---- FRAC GROUP 2: Dicarboximides ----

        iprodione: {
            frac: 2,
            useCategory: 'professional',
            allowedUses: ['golf', 'sportsfield', 'amenity', 'bowling', 'lawn'],
            products: [
                { trade: 'Voltar 250 GT',    ai: '250 g/L iprodione', rate: '9-18 L/ha',     interval: '14-28', distributor: 'Bayer AU' },
                { trade: 'Iprodione 365',    ai: '365 g/L iprodione', rate: '6.5-12.5 L/ha', interval: '14-28', distributor: 'Generic' },
                { trade: 'Chief Aquaflo',    ai: '500 g/L iprodione', rate: '4.5-9 L/ha',    interval: '14-28', distributor: 'Nufarm AU' },
                { trade: 'Ippon 500',        ai: '500 g/L iprodione', rate: '4.5-9 L/ha',    interval: '14-28', distributor: 'Nufarm AU' },
                { trade: 'Voltar 500',       ai: '500 g/L iprodione', rate: '4.5-9 L/ha',    interval: '14-28', distributor: 'Bayer AU' },
                { trade: 'Chief Topflo',     ai: '700 g/L iprodione', rate: '3.6-7.2 L/ha',  interval: '14-28', distributor: 'Nufarm AU' }
            ],
            targets: ['brownPatch', 'curvularia', 'dollarSpot', 'fusarium', 'helminthosporium', 'springDeadSpot'],
            systemic: false,
            mode: 'Lipids and membranes',
            resistanceRisk: 'M',
            efficacyAU: { brownPatch: 3.5, dollarSpot: 3, fusarium: 3.5, helminthosporium: 3, springDeadSpot: 3 }
        },

        procymidone: {
            frac: 2,
            useCategory: 'professional',
            allowedUses: ['golf', 'sportsfield', 'amenity'],
            products: [
                { trade: 'Sumisclex', ai: '500 g/L procymidone', rate: '6-6.5 L/ha', interval: '14-28', distributor: 'Sumitomo AU', notes: 'Do not apply to hybrid couch Apr-Sep' },
                { trade: 'Sporex',    ai: '500 g/L procymidone', rate: '6-6.5 L/ha', interval: '14-28', distributor: 'Sipcam AU' }
            ],
            targets: ['dollarSpot', 'helminthosporium', 'springDeadSpot'],
            systemic: true,
            mode: 'Lipids and membranes',
            resistanceRisk: 'M',
            efficacyAU: { dollarSpot: 3.5, helminthosporium: 3, springDeadSpot: 3 }
        },

        // ---- FRAC GROUP 3: DMI Fungicides (Triazoles) ----

        propiconazole: {
            frac: 3,
            useCategory: 'professional',
            allowedUses: ['golf', 'sportsfield', 'amenity', 'bowling'],
            products: [
                { trade: 'Banner Maxx',    ai: '250 g/L propiconazole', rate: '5-10 L/ha',   interval: '14-28', distributor: 'Syngenta AU', notes: 'Greens/tees' },
                { trade: 'Regiment 550',   ai: '550 g/L propiconazole', rate: '1.4-2.8 L/ha', interval: '14-28', distributor: 'Dow AU' },
                { trade: 'Prop 500',       ai: '500 g/L propiconazole', rate: '1.5-3 L/ha',   interval: '14-28', distributor: 'Nufarm AU' },
                { trade: 'Banner Fairway', ai: '250 g/L propiconazole', rate: '3-6 L/ha',     interval: '14-28', distributor: 'Syngenta AU', notes: 'Fairways only' },
                { trade: 'Bumper 625',     ai: '625 g/L propiconazole', rate: '1.2-2.4 L/ha', interval: '14-28', distributor: 'Nufarm AU' }
            ],
            targets: ['anthracnose', 'brownPatch', 'dollarSpot', 'fusarium', 'helminthosporium', 'largePatch', 'eri', 'springDeadSpot'],
            systemic: true,
            mode: 'Sterol synthesis (DMI)',
            resistanceRisk: 'M',
            efficacyAU: { dollarSpot: 4, brownPatch: 3.5, anthracnose: 3, springDeadSpot: 3, largePatch: 3 }
        },

        tebuconazole: {
            frac: 3,
            useCategory: 'professional',
            allowedUses: ['golf', 'sportsfield', 'amenity'],
            products: [
                // Dedicate Forte moved to combination product entry (b35fix204)
            ],
            targets: ['anthracnose', 'brownPatch', 'dollarSpot', 'fairyRing', 'fusarium', 'grayLeafSpot', 'helminthosporium', 'largePatch', 'rust', 'takeAll'],
            systemic: true,
            mode: 'Sterol synthesis (DMI)',
            resistanceRisk: 'M',
            efficacyAU: { dollarSpot: 3.5, brownPatch: 3.5, anthracnose: 3, takeAll: 3, fairyRing: 3 }
        },

        triticonazole: {
            frac: 3,
            useCategory: 'professional',
            allowedUses: ['golf', 'sportsfield', 'amenity'],
            products: [
                { trade: 'Tribeca', ai: 'triticonazole + fludioxonil', rate: '6 L/ha', interval: '14-28', distributor: 'BASF AU', notes: '2-way mix with fludioxonil' }
            ],
            targets: ['anthracnose', 'brownPatch', 'dollarSpot', 'eri', 'helminthosporium', 'takeAll', 'fusarium', 'springDeadSpot'],
            systemic: true,
            mode: 'Sterol synthesis (DMI)',
            resistanceRisk: 'M',
            efficacyAU: { dollarSpot: 3.5, brownPatch: 3, fusarium: 3.5, takeAll: 3 }
        },

        triadimenol: {
            frac: 3,
            useCategory: 'professional',
            allowedUses: ['golf', 'sportsfield', 'amenity'],
            products: [
                { trade: 'Citadel',   ai: 'triadimenol', rate: '3-6 L/ha', interval: '28', distributor: 'Bayer AU', notes: 'State restrictions apply' },
                { trade: 'Tridim 250', ai: '250 g/L triadimenol', rate: '3-6 L/ha', interval: '28', distributor: 'Generic' },
                { trade: 'Patchwork', ai: 'triadimenol', rate: '3-6 L/ha', interval: '28', distributor: 'Syngenta AU' }
            ],
            targets: ['brownPatch', 'dollarSpot', 'fairyRing', 'helminthosporium', 'rust', 'springDeadSpot'],
            systemic: true,
            mode: 'Sterol synthesis (DMI)',
            resistanceRisk: 'M',
            efficacyAU: { dollarSpot: 3, springDeadSpot: 3.5, fairyRing: 2.5 }
        },

        myclobutanil: {
            frac: 3,
            useCategory: 'professional',
            allowedUses: ['golf', 'sportsfield', 'amenity', 'bowling', 'lawn'],
            products: [
                { trade: 'Systhane Turf', ai: '200 g/L myclobutanil', rate: '1.5-3 L/ha', interval: '14-28', distributor: 'Dow AU' }
            ],
            targets: ['brownPatch', 'dollarSpot', 'fairyRing', 'helminthosporium', 'rust', 'springDeadSpot'],
            systemic: true,
            mode: 'Sterol synthesis (DMI)',
            resistanceRisk: 'M',
            efficacyAU: { dollarSpot: 3, fairyRing: 2.5, rust: 3 }
        },

        // ---- FRAC GROUP 7: SDHI Fungicides ----

        boscalid: {
            frac: 7,
            useCategory: 'professional',
            allowedUses: ['golf', 'sportsfield', 'amenity'],
            products: [
                { trade: 'Emerald', ai: 'boscalid + pyraclostrobin', rate: '1-1.5 L/ha', interval: '14-21', distributor: 'BASF AU', notes: '2-way mix. See also fluazinam entry.' }
            ],
            targets: ['dollarSpot', 'brownPatch', 'anthracnose', 'fairyRing'],
            systemic: true,
            mode: 'SDHI - Succinate dehydrogenase inhibitor',
            resistanceRisk: 'M',
            efficacyAU: { dollarSpot: 4, brownPatch: 3.5, anthracnose: 3 }
        },

        fluxapyroxad: {
            frac: 7,
            useCategory: 'professional',
            allowedUses: ['golf', 'sportsfield', 'amenity'],
            products: [
                { trade: 'Xzemplar', ai: 'fluxapyroxad', rate: '1.5 L/ha', interval: '21-28', distributor: 'BASF AU', notes: 'Preventive only. Low use rate.' }
            ],
            targets: ['brownPatch', 'dollarSpot', 'anthracnose', 'fairyRing', 'helminthosporium'],
            systemic: true,
            mode: 'SDHI - Succinate dehydrogenase inhibitor',
            resistanceRisk: 'M',
            efficacyAU: { dollarSpot: 4, brownPatch: 4, anthracnose: 3.5, fairyRing: 3 }
        },

        penthiopyrad: {
            frac: 7,
            useCategory: 'professional',
            allowedUses: ['golf', 'sportsfield', 'amenity'],
            products: [
                { trade: 'Velista', ai: '200 g/L penthiopyrad', rate: '3-4 L/ha', interval: '21-28', distributor: 'Syngenta AU', notes: 'Preventive only' }
            ],
            targets: ['brownPatch', 'dollarSpot', 'anthracnose', 'fairyRing', 'helminthosporium'],
            systemic: true,
            mode: 'SDHI - Succinate dehydrogenase inhibitor',
            resistanceRisk: 'M',
            efficacyAU: { dollarSpot: 4, brownPatch: 4, anthracnose: 3, fairyRing: 3 }
        },

        // b35fix294: Posterity — pydiflumetofen 200 g/L SC
        // APVMA Approval No: 87385/118243. Syngenta AU.
        // Label: dollar spot, Microdochium patch, spring dead spot.
        // Max 2 consecutive Group 7 apps. Max 2 L/ha per year.
        // Dollar spot / Microdochium: 0.5-1 L/ha foliar, 14-28 day interval.
        // Spring dead spot: 0.5-1 L/ha soil-applied, 2 apps 28 days apart, irrigate 6-10mm after.
        pydiflumetofen: {
            frac: 7,
            useCategory: 'professional',
            allowedUses: ['golf', 'sportsfield', 'amenity'],
            products: [
                { trade: 'Posterity', ai: '200 g/L pydiflumetofen', rate: '0.5-1 L/ha', interval: '14-28', distributor: 'Syngenta AU', notes: 'Max 2 consecutive Gp7 apps. Max 2 L/ha/year. SDS: irrigate 6-10mm after application.' }
            ],
            targets: ['dollarSpot', 'fusarium', 'springDeadSpot'],
            systemic: true,
            mode: 'SDHI - Succinate dehydrogenase inhibitor',
            resistanceRisk: 'M',
            efficacyAU: { dollarSpot: 5, fusarium: 4, springDeadSpot: 4.5 }
        },

        // ---- FRAC GROUP 11: QoI Fungicides (Strobilurins) ----

        azoxystrobin: {
            frac: 11,
            useCategory: 'professional',
            allowedUses: ['golf', 'sportsfield', 'amenity', 'bowling', 'lawn'],
            products: [
                { trade: 'Heritage',       ai: '500 g/kg azoxystrobin WG', rate: '0.3-0.6 kg/ha', interval: '14-28', distributor: 'Syngenta AU' },
                { trade: 'Heritage Maxx',  ai: '250 g/L azoxystrobin',     rate: '0.6-1.2 L/ha',  interval: '14-28', distributor: 'Syngenta AU' },
                { trade: 'Azoxy 250 SC',   ai: '250 g/L azoxystrobin',     rate: '1.5-2.5 L/ha',  interval: '14-28', distributor: 'Generic' }
            ],
            targets: ['anthracnose', 'brownPatch', 'dollarSpot', 'fairyRing', 'fusarium', 'helminthosporium', 'largePatch', 'rust', 'springDeadSpot', 'takeAll'],
            systemic: true,
            mode: 'QoI - Strobilurin (XMS)',
            resistanceRisk: 'H',
            efficacyAU: { brownPatch: 4, anthracnose: 3.5, fairyRing: 3, dollarSpot: 3, fusarium: 3.5, largePatch: 3 }
        },

        pyraclostrobin: {
            frac: 11,
            useCategory: 'professional',
            allowedUses: ['golf', 'sportsfield', 'amenity'],
            products: [
                { trade: 'Insignia', ai: '200 g/kg pyraclostrobin WG', rate: '3.3-5 kg/ha', interval: '14-21', distributor: 'BASF AU' }
            ],
            targets: ['anthracnose', 'brownPatch', 'dollarSpot', 'fairyRing', 'fusarium', 'helminthosporium', 'largePatch'],
            systemic: true,
            mode: 'QoI - Strobilurin (XMS)',
            resistanceRisk: 'H',
            efficacyAU: { brownPatch: 4, anthracnose: 3.5, fairyRing: 3 }
        },

        trifloxystrobin: {
            frac: 11,
            useCategory: 'professional',
            allowedUses: ['golf', 'sportsfield', 'amenity'],
            products: [
                { trade: 'Patriot', ai: 'trifloxystrobin', rate: '2-3 L/ha', interval: '14-28', distributor: 'Bayer AU' }
                // Tombstone Duo, Dedicate, Interface Stressgard moved to combination product entries (b35fix204)
            ],
            targets: ['anthracnose', 'brownPatch', 'curvularia', 'dollarSpot', 'helminthosporium', 'fusarium', 'springDeadSpot', 'eri', 'grayLeafSpot', 'rust'],
            systemic: true,
            mode: 'QoI - Strobilurin (XMS)',
            resistanceRisk: 'H',
            efficacyAU: { brownPatch: 4, dollarSpot: 3.5, anthracnose: 3.5, grayLeafSpot: 3 }
        },

        mandestrobin: {
            frac: 11,
            useCategory: 'professional',
            allowedUses: ['golf', 'sportsfield', 'amenity'],
            products: [
                { trade: 'Rapidol', ai: '200 g/L mandestrobin', rate: '4 L/ha', interval: '14-21', distributor: 'Sumitomo AU', notes: 'Preventive only' }
            ],
            targets: ['anthracnose', 'brownPatch', 'dollarSpot', 'fairyRing', 'fusarium'],
            systemic: true,
            mode: 'QoI - Strobilurin (XMS)',
            resistanceRisk: 'H',
            efficacyAU: { dollarSpot: 3.5, brownPatch: 3.5, anthracnose: 3 }
        },

        // ---- FRAC GROUP 12: Phenylpyrroles ----

        fludioxonil: {
            frac: 12,
            useCategory: 'professional',
            allowedUses: ['golf', 'sportsfield', 'amenity', 'bowling'],
            products: [
                { trade: 'Medallion', ai: '500 g/kg fludioxonil WG', rate: '3-4 L/ha', interval: '14-21', distributor: 'Syngenta AU' },
                { trade: 'Sceptre',   ai: '500 g/kg fludioxonil WG', rate: '3-4 L/ha', interval: '14-21', distributor: 'Corteva AU' }
            ],
            targets: ['anthracnose', 'brownPatch', 'dollarSpot', 'helminthosporium', 'fusarium'],
            systemic: false,
            mode: 'Phenylpyrrole - Signalling',
            resistanceRisk: 'L',
            efficacyAU: { fusarium: 4, dollarSpot: 3.5, brownPatch: 3, anthracnose: 3 }
        },

        // ---- FRAC GROUP 14: ----

        etridiazole: {
            frac: 14,
            useCategory: 'professional',
            allowedUses: ['golf', 'sportsfield', 'amenity'],
            products: [
                { trade: 'Terrazole', ai: 'etridiazole', rate: '10-25 L/ha', interval: '5-10', distributor: 'Sipcam AU', notes: 'Pythium curative specialist. Use highest rate for curative.' }
            ],
            targets: ['pythium'],
            systemic: false,
            curativePreferred: true,
            mode: 'Lipids and cell membrane systems',
            resistanceRisk: 'L',
            efficacyAU: { pythium: 4 }
        },

        tolclofosMethyl: {
            frac: 14,
            useCategory: 'professional',
            allowedUses: ['golf', 'sportsfield', 'amenity'],
            products: [
                { trade: 'Shiba', ai: '500 g/L tolclofos-methyl', rate: '8-10 L/ha', interval: '14-21', distributor: 'Sumitomo AU', notes: 'Green couch, creeping bentgrass, buffalo' }
            ],
            targets: ['anthracnose', 'brownPatch', 'curvularia', 'dollarSpot', 'fairyRing', 'grayLeafSpot', 'helminthosporium', 'fusarium'],
            systemic: false,
            mode: 'Lipids and cell membrane systems',
            resistanceRisk: 'L',
            efficacyAU: { brownPatch: 3, dollarSpot: 3, fairyRing: 2.5 }
        },

        // ---- FRAC GROUP 21: QiI Fungicides ----

        cyazofamid: {
            frac: 21,
            useCategory: 'professional',
            allowedUses: ['golf', 'sportsfield', 'amenity'],
            products: [
                { trade: 'Segway', ai: '100 g/L cyazofamid', rate: '1 L/ha', interval: '21', distributor: 'ISK Biosciences AU' }
            ],
            targets: ['pythium'],
            systemic: false,
            mode: 'QiI - Mitochondrial respiration',
            resistanceRisk: 'M',
            efficacyAU: { pythium: 4 }
        },

        // ---- FRAC GROUP 28: Carbamates ----

        propamocarb: {
            frac: 28,
            useCategory: 'professional',
            allowedUses: ['golf', 'sportsfield', 'amenity'],
            products: [
                { trade: 'Schrapnel', ai: '722 g/L propamocarb hydrochloride', rate: '3-4 L/ha', interval: '7-14', distributor: 'Nufarm AU' }
            ],
            targets: ['pythium'],
            systemic: true,
            mode: 'Cell membrane permeability',
            resistanceRisk: 'M',
            efficacyAU: { pythium: 3.5 }
        },

        // ---- FRAC GROUP 29: Uncouplers ----

        fluazinam: {
            frac: 29,
            useCategory: 'professional',
            allowedUses: ['golf', 'sportsfield', 'amenity'],
            products: [
                { trade: 'Emerald',  ai: 'fluazinam + boscalid', rate: '1-1.5 L/ha', interval: '7-14', distributor: 'BASF AU' },
                { trade: 'Compass', ai: 'fluazinam',             rate: '1-1.5 L/ha', interval: '7-14', distributor: 'Sipcam AU' }
            ],
            targets: ['anthracnose', 'dollarSpot', 'grayLeafSpot', 'helminthosporium', 'pythium'],
            weakCurativeFor: ['pythium'],
            systemic: false,
            mode: 'Uncoupler of oxidative phosphorylation',
            resistanceRisk: 'L',
            efficacyAU: { dollarSpot: 3.5, anthracnose: 3, pythium: 2.5 }
        },

        // ---- FRAC GROUP 33: Phosphonates ----

        fosetylAl: {
            frac: 33,
            useCategory: 'professional',
            allowedUses: ['golf', 'sportsfield', 'amenity', 'bowling'],
            products: [
                { trade: 'Proforce Grenadier 800',   ai: '800 g/kg fosetyl-Al WG',   rate: '12.5 kg/ha',  interval: '14-21', distributor: 'Proforce AU', notes: 'Primary pythium preventive. Cost-effective.' },
                { trade: 'Signature Xtra Stressgard', ai: 'fosetyl-Al + phosphonate', rate: '5.5-16.5 kg/ha', interval: '14-21', distributor: 'Envu AU', notes: 'Stressgard formulation technology' }
            ],
            targets: ['anthracnose', 'pythium'],
            systemic: true,
            preventiveOnly: true,
            mode: 'Host defence induction / phosphonate',
            resistanceRisk: 'L',
            efficacyAU: { pythium: 3.5, anthracnose: 2.5 }
        },

        // ---- FRAC GROUP M (Multi-site Contact) ----

        chlorothalonil: {
            frac: 'M5',
            useCategory: 'professional',
            allowedUses: ['golf', 'sportsfield', 'amenity', 'bowling'],
            products: [
                { trade: 'Chloronil 720',    ai: '720 g/L chlorothalonil', rate: '7-21 L/ha',  interval: '7-14', distributor: 'Nufarm AU' },
                { trade: 'Bravo WeatherStik', ai: '720 g/L chlorothalonil', rate: '7-21 L/ha', interval: '7-14', distributor: 'Syngenta AU', notes: 'Rain-fast formulation' }
            ],
            targets: ['dollarSpot', 'brownPatch', 'anthracnose', 'helminthosporium', 'fusarium', 'fairyRing', 'dampingOff'],
            systemic: false,
            mode: 'Multi-site contact (M5)',
            resistanceRisk: 'NR',
            efficacyAU: { dollarSpot: 3, brownPatch: 3, anthracnose: 3, fusarium: 3, dampingOff: 3 }
        },

        mancozeb: {
            frac: 'M3',
            useCategory: 'professional',
            allowedUses: ['golf', 'sportsfield', 'amenity'],
            products: [
                { trade: 'Liquid Dek',    ai: '455 g/L mancozeb',  rate: '33-41.5 L/ha', interval: '7-14', distributor: 'Nufarm AU' },
                { trade: 'Penncozeb 750', ai: '750 g/kg mancozeb WP', rate: '20-25 g/ha', interval: '7-14', distributor: 'UPL AU' }
            ],
            targets: ['brownPatch', 'dollarSpot', 'fairyRing', 'fusarium', 'helminthosporium', 'pythium'],
            systemic: false,
            mode: 'Multi-site contact (M3)',
            resistanceRisk: 'NR',
            efficacyAU: { brownPatch: 2.5, dollarSpot: 2.5, fusarium: 2.5 }
        },

        // ---- FRAC GROUP 49: Oxysterol binding protein inhibitors ----

        oxathiapiprolin: {
            frac: 49,
            useCategory: 'professional',
            allowedUses: ['golf', 'sportsfield', 'amenity'],
            products: [
                { trade: 'Segovis', ai: '100 g/L oxathiapiprolin', rate: '0.4-0.6 L/ha', interval: '14-21', distributor: 'Syngenta AU', notes: 'Pythium specialist. Mefenoxam-resistant strains covered.' }
            ],
            targets: ['pythium'],
            systemic: true,
            mode: 'Oxysterol binding protein inhibitor',
            resistanceRisk: 'M',
            efficacyAU: { pythium: 4 }
        },

        // ---- COMBINATION PRODUCTS ----

        evolution: {
            frac: '11+3',
            useCategory: 'professional',
            allowedUses: ['golf', 'sportsfield', 'amenity'],
            products: [
                { trade: 'Evolution', ai: 'azoxystrobin + tebuconazole', rate: '2-3 L/ha', interval: '21-28', distributor: 'Syngenta AU' }
            ],
            actives: ['azoxystrobin', 'tebuconazole'],
            targets: ['anthracnose', 'brownPatch', 'dollarSpot', 'fusarium', 'helminthosporium', 'fairyRing'],
            systemic: true,
            mode: 'QoI + DMI combination',
            resistanceRisk: 'M',
            efficacyAU: { dollarSpot: 4, brownPatch: 4, anthracnose: 3.5 }
        },

        instrata: {
            frac: 'M5+3+12',
            useCategory: 'professional',
            allowedUses: ['golf', 'sportsfield', 'amenity'],
            products: [
                { trade: 'Instrata', ai: 'chlorothalonil + propiconazole + fludioxonil', rate: '18 L/ha', interval: '28', distributor: 'Syngenta AU' }
            ],
            actives: ['chlorothalonil', 'propiconazole', 'fludioxonil'],
            targets: ['anthracnose', 'brownPatch', 'dollarSpot', 'helminthosporium', 'fusarium'],
            systemic: true,
            mode: 'Multi-site + DMI + Phenylpyrrole combination',
            resistanceRisk: 'L',
            efficacyAU: { dollarSpot: 4, brownPatch: 3.5, fusarium: 3.5, anthracnose: 3 }
        },

        enclave: {
            frac: 'M5+2+1+3',
            useCategory: 'professional',
            allowedUses: ['golf', 'sportsfield', 'amenity'],
            products: [
                { trade: 'Qualipro-Enclave', ai: 'chlorothalonil + iprodione + thiophanate-methyl + tebuconazole', rate: '16-24 L/ha', interval: '21-28', distributor: 'Quali-Pro AU' }
            ],
            actives: ['chlorothalonil', 'iprodione', 'thiophanateMethyl', 'tebuconazole'],
            targets: ['anthracnose', 'brownPatch', 'dollarSpot', 'fusarium', 'grayLeafSpot', 'helminthosporium', 'springDeadSpot', 'takeAll'],
            systemic: true,
            mode: '4-way combination',
            resistanceRisk: 'L',
            efficacyAU: { dollarSpot: 4, brownPatch: 3.5, fusarium: 3.5, springDeadSpot: 3 }
        },

        cleanSweepTrio: {
            frac: '1+29+3',
            useCategory: 'professional',
            allowedUses: ['golf', 'sportsfield', 'amenity'],
            products: [
                { trade: 'Clean Sweep Trio', ai: 'thiophanate-methyl + fluazinam + tebuconazole', rate: '12-20 L/ha', interval: '14-28', distributor: 'Syngenta AU' }
            ],
            actives: ['thiophanateMethyl', 'fluazinam', 'tebuconazole'],
            targets: ['dollarSpot', 'helminthosporium', 'anthracnose', 'brownPatch', 'eri', 'couchgrassDecline', 'takeAll', 'fairyRing'],
            systemic: true,
            mode: '3-way combination',
            resistanceRisk: 'L',
            efficacyAU: { dollarSpot: 4, anthracnose: 3.5, brownPatch: 3.5, takeAll: 3 }
        },

        // b35fix204: Bayer combination products — dedicated entries with correct compound FRAC groups
        tombstoneDuo: {
            frac: '11+3',
            useCategory: 'professional',
            allowedUses: ['golf', 'sportsfield', 'amenity'],
            products: [
                { trade: 'Tombstone Duo', ai: 'trifloxystrobin + tebuconazole', rate: '2-3 L/ha', interval: '14-28', distributor: 'Bayer AU' }
            ],
            actives: ['trifloxystrobin', 'tebuconazole'],
            targets: ['anthracnose', 'brownPatch', 'curvularia', 'dollarSpot', 'helminthosporium', 'fusarium', 'springDeadSpot', 'eri', 'grayLeafSpot', 'rust'],
            systemic: true,
            mode: 'QoI + DMI combination',
            resistanceRisk: 'M',
            efficacyAU: { dollarSpot: 4, brownPatch: 4, anthracnose: 3.5, fusarium: 3.5 }
        },

        dedicate: {
            frac: '11+3',
            useCategory: 'professional',
            allowedUses: ['golf', 'sportsfield', 'amenity'],
            products: [
                { trade: 'Dedicate', ai: 'trifloxystrobin + tebuconazole', rate: '2-3 L/ha', interval: '14-28', distributor: 'Bayer AU' }
            ],
            actives: ['trifloxystrobin', 'tebuconazole'],
            targets: ['anthracnose', 'brownPatch', 'curvularia', 'dollarSpot', 'helminthosporium', 'fusarium', 'springDeadSpot', 'eri', 'grayLeafSpot', 'rust'],
            systemic: true,
            mode: 'QoI + DMI combination',
            resistanceRisk: 'M',
            efficacyAU: { dollarSpot: 4, brownPatch: 4, anthracnose: 3.5, fusarium: 3.5 }
        },

        dedicateForte: {
            frac: '3+11',
            useCategory: 'professional',
            allowedUses: ['golf', 'sportsfield', 'amenity'],
            products: [
                { trade: 'Dedicate Forte', ai: 'tebuconazole + trifloxystrobin', rate: '3.5 L/ha', interval: '14-28', distributor: 'Bayer AU' }
            ],
            actives: ['tebuconazole', 'trifloxystrobin'],
            targets: ['anthracnose', 'brownPatch', 'dollarSpot', 'fairyRing', 'fusarium', 'grayLeafSpot', 'helminthosporium', 'largePatch', 'rust', 'takeAll'],
            systemic: true,
            mode: 'DMI + QoI combination',
            resistanceRisk: 'M',
            efficacyAU: { dollarSpot: 4, brownPatch: 4, fusarium: 3.5, anthracnose: 3.5 }
        },

        interfaceStressgard: {
            frac: '11+2',
            useCategory: 'professional',
            allowedUses: ['golf', 'sportsfield', 'amenity'],
            products: [
                { trade: 'Interface Stressgard', ai: 'trifloxystrobin + iprodione', rate: '12.5 L/ha', interval: '14-28', distributor: 'Bayer AU' }
            ],
            actives: ['trifloxystrobin', 'iprodione'],
            targets: ['anthracnose', 'brownPatch', 'curvularia', 'dollarSpot', 'helminthosporium', 'fusarium', 'springDeadSpot'],
            systemic: true,
            mode: 'QoI + Dicarboximide combination',
            resistanceRisk: 'M',
            efficacyAU: { dollarSpot: 3.5, brownPatch: 4, anthracnose: 3.5, fusarium: 3 }
        }
    };

    // ========================================================================
    // QUERY FUNCTIONS
    // ========================================================================

    /**
     * Get all products registered for a given disease.
     * Returns sorted array: highest efficacy first, then lowest resistance risk.
     */
    function getProductsForDisease(disease) {
        var results = [];
        var riskOrder = { 'NR': 0, 'L': 1, 'L-M': 2, 'M': 3, 'M-H': 4, 'H': 5 };

        for (var key in FUNGICIDES_AU) {
            var entry = FUNGICIDES_AU[key];
            if (entry.targets && entry.targets.indexOf(disease) !== -1) {
                entry.products.forEach(function (p) {
                    results.push({
                        active:         key,
                        trade:          p.trade,
                        ai:             p.ai || key,
                        frac:           entry.frac,
                        rate:           p.rate,
                        interval:       p.interval,
                        mode:           entry.mode,
                        systemic:       entry.systemic,
                        resistanceRisk: entry.resistanceRisk || 'M',
                        distributor:    p.distributor || '',
                        notes:          p.notes || '',
                        allowedUses:    entry.allowedUses || [],
                        preventiveOnly: entry.preventiveOnly || false,
                        curativePreferred: entry.curativePreferred || false,
                        efficacy:       entry.efficacyAU ? (entry.efficacyAU[disease] || 0) : 0
                    });
                });
            }
        }

        results.sort(function (a, b) {
            var ea = a.efficacy || 0, eb = b.efficacy || 0;
            if (eb !== ea) return eb - ea;
            return (riskOrder[a.resistanceRisk] || 3) - (riskOrder[b.resistanceRisk] || 3);
        });

        return results;
    }

    /**
     * Get active ingredients for a disease (used by fungicide-filter.js queryAUDatabase).
     * Returns format compatible with the FungicideFilter service.
     */
    function getActivesForDisease(disease) {
        var products = getProductsForDisease(disease);

        if (!products.length) {
            return {
                actives: [],
                source: 'au',
                registrationBody: 'APVMA',
                warnings: ['No AU-registered fungicides found for ' + disease + '. Consult APVMA PubCRIS at portal.apvma.gov.au/pubcris']
            };
        }

        return {
            actives: products.map(function (p) {
                return {
                    active:         p.active,
                    type:           'primary',
                    fracGroup:      String(p.frac),
                    trade:          p.trade,
                    ai:             p.ai,
                    rate:           p.rate,
                    interval:       p.interval,
                    mode:           p.mode,
                    systemic:       p.systemic,
                    resistanceRisk: p.resistanceRisk,
                    distributor:    p.distributor,
                    notes:          p.notes,
                    allowedUses:    p.allowedUses,
                    preventiveOnly: p.preventiveOnly,
                    curativePreferred: p.curativePreferred,
                    efficacy:       p.efficacy,
                    registration:   { body: 'APVMA', status: 'registered' }
                };
            }),
            source:           'au',
            registrationBody: 'APVMA',
            apvmaLastSync:    apvmaLastSync,
            apvmaVersion:     apvmaVersion
        };
    }

    /**
     * Build a FRAC rotation for a disease.
     * Prioritises multi-site products first (lowest resistance risk),
     * then singles from different FRAC groups.
     */
    function getRotationForDisease(disease) {
        var products = getProductsForDisease(disease);
        var fracGroups = {};

        products.forEach(function (p) {
            var f = String(p.frac);
            if (!fracGroups[f]) fracGroups[f] = p;
        });

        var rotation = [];
        var keys = Object.keys(fracGroups);

        // Multi-site first
        keys.forEach(function (k) {
            if (k.indexOf('M') === 0 && rotation.length < 4) {
                rotation.push({
                    step:   rotation.length + 1,
                    trade:  fracGroups[k].trade,
                    frac:   k,
                    rate:   fracGroups[k].rate,
                    reason: 'Multi-site - no resistance risk'
                });
            }
        });

        // Then single-site by FRAC group
        keys.forEach(function (k) {
            if (k.indexOf('M') !== 0 && rotation.length < 4) {
                rotation.push({
                    step:   rotation.length + 1,
                    trade:  fracGroups[k].trade,
                    frac:   k,
                    rate:   fracGroups[k].rate,
                    reason: 'FRAC ' + k + ' rotation'
                });
            }
        });

        return rotation;
    }

    /**
     * Get all diseases with at least one registered AU product.
     */
    function getSupportedDiseases() {
        var diseases = {};
        for (var key in FUNGICIDES_AU) {
            var entry = FUNGICIDES_AU[key];
            if (entry.targets) {
                entry.targets.forEach(function (d) { diseases[d] = true; });
            }
        }
        return Object.keys(diseases).sort();
    }

    /**
     * Validate a product name against the database (basic check).
     * For full APVMA validation, the PHP sync class queries PubCRIS.
     */
    function validateProduct(tradeName) {
        for (var key in FUNGICIDES_AU) {
            var entry = FUNGICIDES_AU[key];
            for (var i = 0; i < entry.products.length; i++) {
                if (entry.products[i].trade.toLowerCase() === tradeName.toLowerCase()) {
                    return {
                        found:  true,
                        active: key,
                        frac:   entry.frac,
                        entry:  entry.products[i]
                    };
                }
            }
        }
        return { found: false, tradeName: tradeName, suggestion: 'Check APVMA PubCRIS at portal.apvma.gov.au/pubcris' };
    }

    // ========================================================================
    // PUBLIC API
    // ========================================================================

    var AU_FUNGICIDES_API = {
        db:                   FUNGICIDES_AU,
        getProductsForDisease: getProductsForDisease,
        getActivesForDisease:  getActivesForDisease,
        getRotationForDisease: getRotationForDisease,
        getSupportedDiseases:  getSupportedDiseases,
        validateProduct:       validateProduct,
        version:               '1.0.0',
        region:                'AU',
        registrationBody:      'APVMA',
        apvmaLastSync:         apvmaLastSync,
        source:                'APVMA PubCRIS, Syngenta AU, Bayer AU, Envu AU, BASF AU, Nufarm AU, Corteva AU'
    };

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = AU_FUNGICIDES_API;
    }
    if (typeof window !== 'undefined') {
        window.GAIP_AU_FUNGICIDES = AU_FUNGICIDES_API;
    }

})();
