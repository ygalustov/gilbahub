/**
 * NZ Turf Fungicide Database
 * ==========================
 *
 * Sources:
 *   - Living Turf NZ Fungicide Chart (primary - verified rates & efficacy)
 *   - PGG Wrightson Turf NZ product listings
 *   - Syngenta NZ / Living Turf tech sheets & labels
 *   - ACVM Register (MPI NZ) for registration status
 *
 * Version: 2.0.0
 * Last Updated: February 2026
 *
 * Structure mirrors FUNGICIDES_AU in disease-engine.js for compatibility.
 * Each active ingredient entry contains NZ-specific trade name products
 * with rates verified from distributor charts and product labels.
 *
 * Registration: ACVM (Agricultural Compounds and Veterinary Medicines)
 * under MPI (Ministry for Primary Industries), New Zealand.
 *
 * Mode of Action codes:
 *   C   = Contact
 *   LS  = Locally systemic
 *   PMS = Phloem mobile systemic
 *   XMS = Xylem-mobile systemic
 *
 * Resistance Risk: NR = No risk, L = Low, M = Medium, H = High
 *
 * Efficacy ratings (from Living Turf chart, 1-4 scale, 4 = most effective):
 *   Stored per-disease in the efficacyNZ object on each active.
 *   *L = labelled but no published efficacy rating (stored as 0 in data).
 */

(function () {
    'use strict';

    var FUNGICIDES_NZ = {

        chlorothalonil: {
            frac: 'M05', useCategory: 'professional',
            allowedUses: ['golf', 'sportsfield', 'amenity', 'bowling'],
            products: [
                { trade: 'Balear 720SC', ai: '720 g/L chlorothalonil', rate: '7-21 L/ha', interval: '7-14', distributor: 'Living Turf NZ', notes: 'Broad spectrum preventative/early curative. Rate varies by disease pressure.' },
                { trade: 'Daconil Weather Stik', ai: '720 g/L chlorothalonil', rate: '7-21 L/ha', interval: '7-14', distributor: 'Syngenta NZ', notes: 'Same AI concentration as Balear.' }
            ],
            targets: ['dollarSpot','brownPatch','fusarium','anthracnose','helminthosporium','dampingOff','fairyRing','redThread'],
            systemic: false, mode: 'Multi-site contact (C)', resistanceRisk: 'NR',
            efficacyNZ: { anthracnose:3, brownPatch:3, dampingOff:3, dollarSpot:2.5, fairyRing:2.5, meltingOut:3, fusarium:3 }
        },

        azoxystrobin: {
            frac: 11, useCategory: 'professional',
            allowedUses: ['golf', 'sportsfield', 'amenity', 'bowling', 'lawn'],
            products: [
                { trade: 'Atlantis Flo', ai: '250 g/L azoxystrobin', rate: '1.5-2.5 L/ha', interval: '14-28', distributor: 'Living Turf NZ', notes: 'Broad range excluding Dollar Spot.' },
                { trade: 'Azoxy 250 SC', ai: '250 g/L azoxystrobin', rate: '1.5-2.5 L/ha', interval: '14-28', distributor: 'PGG Wrightson Turf / Turf Culture', notes: 'Controls damping-off, brown patch, fusarium, red thread, leaf spot, anthracnose, rust.' }
            ],
            targets: ['anthracnose','brownPatch','dampingOff','dollarSpot','fairyRing','fusarium','helminthosporium','redThread','rust','takeAll','springDeadSpot'],
            systemic: true, mode: 'QoI - Strobilurin (XMS)', resistanceRisk: 'H',
            efficacyNZ: { anthracnose:3, brownPatch:4, dampingOff:3, dollarSpot:3, fairyRing:2.5, meltingOut:4, fusarium:4, pinkPatch:3.5, redThread:3 }
        },

        propiconazole: {
            frac: 3, useCategory: 'professional',
            allowedUses: ['golf', 'sportsfield', 'amenity', 'bowling'],
            products: [
                { trade: 'Proplant', ai: '250 g/L propiconazole', rate: '2-3 L/ha', interval: '14-28', distributor: 'Living Turf NZ', notes: 'Particularly effective on Dollar Spot. Also rust and Take-All Patch.' },
                { trade: 'Condor', ai: '250 g/L propiconazole', rate: '2-3 L/ha', interval: '14-28', distributor: 'PGG Wrightson Turf', notes: 'Wide range of leaf and stem diseases.' }
            ],
            targets: ['dollarSpot','brownPatch','anthracnose','fusarium','rust','takeAll','redThread','pinkPatch','springDeadSpot','helminthosporium'],
            systemic: true, mode: 'DMI - Triazole (XMS)', resistanceRisk: 'M',
            efficacyNZ: { anthracnose:2, brownPatch:3, dollarSpot:4, fairyRing:2, meltingOut:3, fusarium:3, pinkPatch:3.5, redThread:1.5, rust:2.5, springDeadSpot:3, takeAll:2 }
        },

        azoxystrobinPropiconazole: {
            frac: '11+3', useCategory: 'professional',
            allowedUses: ['golf', 'sportsfield', 'amenity', 'bowling'],
            products: [
                { trade: 'Headway Maxx', ai: '62 g/L azoxystrobin + 104 g/L propiconazole', rate: '9 L/ha', interval: '14-28', distributor: 'Syngenta NZ / Living Turf / PGG Wrightson', notes: 'Broad spectrum systemic. All surfaces incl greens. Water: 300-500 L/ha leaf, up to 1000 L/ha root.' }
            ],
            targets: ['dollarSpot','brownPatch','anthracnose','pythium','takeAll','fusarium','helminthosporium'],
            systemic: true, mode: 'QoI + DMI combination (XMS)', resistanceRisk: 'M-H',
            efficacyNZ: { anthracnose:3, brownPatch:3.5, dampingOff:3.5, dollarSpot:3, fairyRing:3.5, redThread:3.5 }
        },

        tebuconazole: {
            frac: 3, useCategory: 'professional',
            allowedUses: ['golf', 'sportsfield', 'amenity', 'bowling'],
            products: [
                { trade: 'Compass', ai: '430 g/L tebuconazole', rate: '2 L/ha', interval: '14-28', distributor: 'Living Turf NZ', notes: 'Economical. Particularly effective on Dollar Spot.' }
            ],
            targets: ['dollarSpot','brownPatch','anthracnose','fusarium','pinkPatch','redThread','rust','takeAll'],
            systemic: true, mode: 'DMI - Triazole (XMS)', resistanceRisk: 'M',
            efficacyNZ: { anthracnose:3, brownPatch:3, dollarSpot:4, rust:3 }
        },

        fluazinam: {
            frac: 29, useCategory: 'professional',
            allowedUses: ['golf', 'sportsfield', 'amenity', 'bowling'],
            products: [
                { trade: 'Curalan', ai: '500 g/L fluazinam', rate: '2 L/ha', interval: '14-28', distributor: 'Living Turf NZ', notes: 'Low resistance risk. Economical. Excellent Dollar Spot and Brown Patch.' }
            ],
            targets: ['dollarSpot','brownPatch','dampingOff','fusarium','fairyRing','pinkPatch'],
            systemic: false, mode: 'Oxidative phosphorylation uncoupler (C)', resistanceRisk: 'L-M',
            efficacyNZ: { anthracnose:1.5, brownPatch:4, dampingOff:3, dollarSpot:3 }
        },

        fludioxonil: {
            frac: 12, useCategory: 'professional',
            allowedUses: ['golf', 'sportsfield', 'amenity', 'bowling'],
            products: [
                { trade: 'Fludio', ai: '100 g/L fludioxonil', rate: '3 L/ha', interval: '14-28', distributor: 'Living Turf NZ', notes: 'Highly rated for Fusarium, Brown Patch and Melting-out.' }
            ],
            targets: ['fusarium','brownPatch','anthracnose','dollarSpot','helminthosporium','redThread'],
            systemic: false, mode: 'Signal transduction (C)', resistanceRisk: 'L-M',
            efficacyNZ: { anthracnose:2.5, brownPatch:3, dampingOff:3.5, dollarSpot:4, meltingOut:3, redThread:2.5 }
        },

        difenoconazoleFludioxonil: {
            frac: '3+12', useCategory: 'professional',
            allowedUses: ['golf', 'sportsfield', 'amenity', 'bowling'],
            products: [
                { trade: 'Instrata Elite', ai: '80.3 g/L difenoconazole + 80.3 g/L fludioxonil', rate: '3 L/ha', interval: '14', distributor: 'Syngenta NZ / Living Turf / PGG Wrightson', notes: 'Max 2 apps/year at 14-day intervals. Rainfast 30 min. NZ ACVM: HSR101610.' }
            ],
            targets: ['fusarium','anthracnose','dollarSpot','brownPatch','redThread'],
            systemic: true, mode: 'DMI + Signal transduction (C + XMS)', resistanceRisk: 'L-M',
            efficacyNZ: { anthracnose:3.5, brownPatch:3, dollarSpot:3.5, fusarium:4, redThread:2.5 }
        },

        cyproconazole: {
            frac: 3, useCategory: 'professional',
            allowedUses: ['golf', 'sportsfield', 'amenity', 'bowling'],
            products: [
                { trade: 'Cypro 200SC', ai: '200 g/L cyproconazole', rate: '2-4 L/ha', interval: '14-28', distributor: 'Living Turf NZ', notes: 'Highly active DMI. Broad spectrum.' }
            ],
            targets: ['dollarSpot','fusarium','brownPatch','anthracnose'],
            systemic: true, mode: 'DMI - Triazole (XMS)', resistanceRisk: 'M',
            efficacyNZ: {}
        },

        penthiopyrad: {
            frac: 7, useCategory: 'professional',
            allowedUses: ['golf', 'sportsfield', 'amenity', 'bowling'],
            products: [
                { trade: 'Velista', ai: '500 g/kg penthiopyrad', rate: '1-1.5 kg/ha', interval: '14-28', distributor: 'Syngenta NZ / Living Turf / PGG Wrightson', notes: 'First NZ turf-registered fairy ring control. Also anthracnose, dollar spot, brown ring patch, leaf and sheath spot.' }
            ],
            targets: ['anthracnose','brownPatch','dollarSpot','fairyRing','helminthosporium','fusarium','springDeadSpot','waiteaPatch'],
            systemic: true, mode: 'SDHI (XMS)', resistanceRisk: 'M-H',
            efficacyNZ: { anthracnose:3, brownPatch:4, dollarSpot:3.5, meltingOut:3.5, redThread:4, waiteaPatch:3.5 }
        },

        boscalid: {
            frac: 7, useCategory: 'professional',
            allowedUses: ['golf', 'sportsfield', 'amenity', 'bowling'],
            products: [
                { trade: 'Unistar', ai: '500 g/L boscalid', rate: '0.4-0.6 L/ha', interval: '14-28', distributor: 'Living Turf NZ', notes: 'Very effective on Dollar Spot.' }
            ],
            targets: ['dollarSpot'],
            systemic: true, mode: 'SDHI (XMS)', resistanceRisk: 'M-H',
            efficacyNZ: { dollarSpot:3.5 }
        },

        iprodione: {
            frac: 2, useCategory: 'professional',
            allowedUses: ['golf', 'sportsfield', 'amenity', 'bowling'],
            products: [
                { trade: 'Ippon 500SC', ai: '500 g/L iprodione', rate: '5 L/ha', interval: '14-28', distributor: 'Living Turf NZ / PGG Wrightson', notes: 'Contact. Preventative control of wide range of diseases.' },
                { trade: 'Defence', ai: '250 g/L iprodione', rate: '10 L/ha', interval: '14-28', distributor: 'Arxada NZ', notes: 'Equivalent AI delivery to Ippon at 5 L/ha.' }
            ],
            targets: ['brownPatch','dollarSpot','fusarium','helminthosporium','redThread'],
            systemic: false, mode: 'Dicarboximide (LS)', resistanceRisk: 'M-H',
            efficacyNZ: { brownPatch:3, dollarSpot:3.5, meltingOut:3, fusarium:3, redThread:3.5 }
        },

        trifloxystrobin: {
            frac: 11, useCategory: 'professional',
            allowedUses: ['golf', 'sportsfield', 'amenity', 'bowling'],
            products: [
                { trade: 'Protiva', ai: '500 g/L trifloxystrobin', rate: '0.35-0.65 L/ha', interval: '14-28', distributor: 'Living Turf NZ', notes: 'Anthracnose, Brown Patch and Fusarium.' }
            ],
            targets: ['anthracnose','brownPatch','fusarium','dollarSpot','helminthosporium','redThread'],
            systemic: false, mode: 'QoI - Strobilurin (LS)', resistanceRisk: 'H',
            efficacyNZ: { anthracnose:3.5, brownPatch:4, dollarSpot:2.5, meltingOut:3, redThread:2.5 }
        },

        pyraclostrobin: {
            frac: 11, useCategory: 'professional',
            allowedUses: ['golf', 'sportsfield', 'amenity', 'bowling'],
            products: [
                { trade: 'Pyrax', ai: '250 g/L pyraclostrobin', rate: '1.3-2.25 L/ha', interval: '14-28', distributor: 'Living Turf NZ', notes: 'Very effective across broad range incl Take-All, Anthracnose, Brown Patch.' }
            ],
            targets: ['anthracnose','brownPatch','dollarSpot','fusarium','helminthosporium','redThread','rust','takeAll','fairyRing'],
            systemic: false, mode: 'QoI - Strobilurin (LS)', resistanceRisk: 'H',
            efficacyNZ: { anthracnose:3, brownPatch:4, dollarSpot:2.5, fairyRing:3, meltingOut:3, fusarium:3, redThread:4, rust:3, takeAll:3 }
        },

        carbendazim: {
            frac: 1, useCategory: 'professional',
            allowedUses: ['golf', 'sportsfield', 'amenity', 'bowling'],
            products: [
                { trade: 'Goldazim', ai: '500 g/L carbendazim', rate: '5-10 L/ha', interval: '14-28', distributor: 'Living Turf NZ', notes: 'Useful in tank mixes with chlorothalonil. Good during wet weather.' },
                { trade: 'Carbenz', ai: '500 g/L carbendazim', rate: '5-10 L/ha', interval: '14-28', distributor: 'PGG Wrightson Turf', notes: 'Ideal alternative in resistance prevention strategy.' }
            ],
            targets: ['dollarSpot','fusarium','brownPatch','anthracnose','helminthosporium'],
            systemic: true, mode: 'MBC - Benzimidazole (XMS)', resistanceRisk: 'H',
            efficacyNZ: {}
        },

        thiophanateMethyl: {
            frac: 1, useCategory: 'professional',
            allowedUses: ['golf', 'sportsfield', 'amenity', 'bowling'],
            products: [
                { trade: 'Topsin M-4A', ai: '400 g/L thiophanate-methyl', rate: '5-10 L/ha', interval: '14-28', distributor: 'PGG Wrightson Turf', notes: 'Broad spectrum for brown patch.' }
            ],
            targets: ['brownPatch','dollarSpot','fusarium','helminthosporium','anthracnose'],
            systemic: true, mode: 'MBC - Benzimidazole (XMS)', resistanceRisk: 'H',
            efficacyNZ: {}
        },

        chlorothalonilThiophanate: {
            frac: 'M05+1', useCategory: 'professional',
            allowedUses: ['golf', 'sportsfield', 'amenity', 'bowling'],
            products: [
                { trade: 'Taratek 5F', ai: '250 g/L chlorothalonil + 250 g/L thiophanate-methyl', rate: '10-15 L/ha', interval: '14-28', distributor: 'PGG Wrightson Turf', notes: 'Contact + systemic combination.' }
            ],
            targets: ['dollarSpot','brownPatch','fusarium','helminthosporium','anthracnose','dampingOff'],
            systemic: true, mode: 'Multi-site + MBC (C + XMS)', resistanceRisk: 'M',
            efficacyNZ: {}
        },

        mancozeb: {
            frac: 'M03', useCategory: 'professional',
            allowedUses: ['golf', 'sportsfield', 'amenity', 'bowling'],
            products: [
                { trade: 'Supamanz', ai: '455 g/L mancozeb', rate: '10-20 L/ha', interval: '7-14', distributor: 'Living Turf NZ', notes: 'No resistance risk. Use as protectant or tank mix partner.' }
            ],
            targets: ['brownPatch','dampingOff','dollarSpot','fusarium','helminthosporium','rust'],
            systemic: false, mode: 'Multi-site contact (C)', resistanceRisk: 'NR',
            efficacyNZ: { brownPatch:3, dampingOff:1, dollarSpot:3.5, meltingOut:2, fusarium:2, redThread:3 }
        },

        thiram: {
            frac: 'M03', useCategory: 'professional',
            allowedUses: ['golf', 'sportsfield', 'amenity', 'bowling'],
            products: [
                { trade: 'Thiram 40F', ai: '400 g/L thiram', rate: '15 L/ha', interval: '7-14', distributor: 'Living Turf NZ / PGG Wrightson', notes: 'Broad spectrum contact. No resistance risk.' }
            ],
            targets: ['brownPatch','dampingOff','helminthosporium','fusarium'],
            systemic: false, mode: 'Multi-site contact (C)', resistanceRisk: 'NR',
            efficacyNZ: { brownPatch:2, dampingOff:1 }
        },

        fosetylAl: {
            frac: 'P07', useCategory: 'professional',
            allowedUses: ['golf', 'sportsfield', 'amenity', 'bowling'],
            products: [
                { trade: 'Fostonic', ai: 'fosetyl-aluminium', rate: '6-12 kg/ha', interval: '14-28', distributor: 'Living Turf NZ', notes: 'Primary pythium preventive. Systemic, leaf and root absorbed.' },
                { trade: 'Aliette WG', ai: '800 g/kg fosetyl-aluminium', rate: '6-12 kg/ha', interval: '14-28', distributor: 'PGG Wrightson Turf', notes: 'Fast acting. Bi-directional movement.' }
            ],
            targets: ['pythium'],
            systemic: true, preventiveOnly: true, mode: 'Phosphonate (PMS)', resistanceRisk: 'L',
            efficacyNZ: {}
        },

        phosphite: {
            frac: 'P07', useCategory: 'professional',
            allowedUses: ['golf', 'sportsfield', 'amenity', 'bowling', 'lawn'],
            products: [
                { trade: 'Phosgard', ai: 'phosphite', rate: '8 L/ha', interval: '14-28', distributor: 'Living Turf NZ', notes: 'Preventative Pythium (damping off) control.' }
            ],
            targets: ['pythium'],
            systemic: true, preventiveOnly: true, mode: 'Phosphonate (PMS)', resistanceRisk: 'L',
            efficacyNZ: { pythium:2.5 }
        },

        propamocarb: {
            frac: 28, useCategory: 'professional',
            allowedUses: ['golf', 'sportsfield', 'amenity', 'bowling'],
            products: [
                { trade: 'Procura', ai: '605 g/L propamocarb', rate: '4.5-6.5 L/ha', interval: '14-28', distributor: 'Living Turf NZ', notes: 'Systemic for Pythium in preventative program.' }
            ],
            targets: ['pythium'],
            systemic: false, mode: 'Carbamate (LS)', resistanceRisk: 'M',
            efficacyNZ: {}
        },

        metalaxyl: {
            frac: 4, useCategory: 'professional',
            allowedUses: ['golf', 'sportsfield', 'amenity', 'bowling'],
            products: [
                { trade: 'Ventura', ai: '250 g/L metalaxyl', rate: '3-6 L/ha', interval: '14-28', distributor: 'Living Turf NZ', notes: 'Damping off, preventative and curative.' }
            ],
            targets: ['pythium'],
            systemic: true, mode: 'Phenylamide (XMS)', resistanceRisk: 'H',
            efficacyNZ: {}
        },

        metalaxylMMancozeb: {
            frac: '4+M03', useCategory: 'professional',
            allowedUses: ['golf', 'sportsfield', 'amenity', 'bowling'],
            products: [
                { trade: 'Ridomil Gold MZ WG', ai: '40 g/kg metalaxyl-M + 640 g/kg mancozeb', rate: '2.5-5 kg/ha', interval: '14-28', distributor: 'PGG Wrightson Turf', notes: 'Pythium blight in newly sown or young turf.' }
            ],
            targets: ['pythium','dampingOff'],
            systemic: true, mode: 'Phenylamide + Multi-site (XMS + C)', resistanceRisk: 'M-H',
            efficacyNZ: {}
        },

        triadimenol: {
            frac: 3, useCategory: 'professional',
            allowedUses: ['golf', 'sportsfield', 'amenity', 'bowling'],
            products: [
                { trade: 'Vandia', ai: '250 g/L triadimenol', rate: '3-6 L/ha', interval: '14-28', distributor: 'Living Turf NZ', notes: 'Highly active against Dollar Spot, Take All Patch and Fusarium.' }
            ],
            targets: ['dollarSpot','takeAll','fusarium','brownPatch','rust','springDeadSpot'],
            systemic: true, mode: 'DMI - Triazole (XMS)', resistanceRisk: 'M',
            efficacyNZ: { brownPatch:1.5, dollarSpot:4, fairyRing:2, fusarium:3, redThread:3.5, takeAll:2.5 }
        },

        myclobutanil: {
            frac: 3, useCategory: 'professional',
            allowedUses: ['golf', 'sportsfield', 'amenity', 'bowling'],
            products: [
                { trade: 'Validus', ai: '200 g/L myclobutanil', rate: '3.6 L/ha', interval: '14-28', distributor: 'Living Turf NZ', notes: 'Highly rated for Dollar Spot. Also Anthracnose, Brown Patch and Fusarium.' }
            ],
            targets: ['dollarSpot','anthracnose','brownPatch','fusarium','redThread','takeAll'],
            systemic: true, mode: 'DMI - Triazole (XMS)', resistanceRisk: 'M',
            efficacyNZ: { anthracnose:2, brownPatch:2.5, dollarSpot:4, fairyRing:1, fusarium:2, redThread:2, takeAll:2 }
        },

        prochloraz: {
            frac: 3, useCategory: 'professional',
            allowedUses: ['golf', 'sportsfield', 'amenity', 'bowling'],
            products: [
                { trade: 'Varicur 450EW', ai: '450 g/L prochloraz', rate: '6.5 L/ha', interval: '14-28', distributor: 'Living Turf NZ', notes: 'Unique AI for Dollar Spot control.' }
            ],
            targets: ['dollarSpot','fusarium','brownPatch','anthracnose','helminthosporium','redThread'],
            systemic: true, mode: 'DMI - Imidazole (XMS)', resistanceRisk: 'M',
            efficacyNZ: {}
        },

        bacillusSubtilis: {
            frac: 'BM02', useCategory: 'professional',
            allowedUses: ['golf', 'sportsfield', 'amenity', 'bowling', 'lawn'],
            products: [
                { trade: 'Clarity', ai: 'Bacillus subtilis', rate: '265 g/sachet', interval: '7-14', distributor: 'Living Turf NZ', notes: 'Preventative biological fungicide.' }
            ],
            targets: ['dollarSpot','brownPatch','fusarium'],
            systemic: false, mode: 'Biological (C)', resistanceRisk: 'L',
            efficacyNZ: { dollarSpot:1.5, brownPatch:1, fusarium:1 }
        }
    };

    // ========================================================================
    // HELPER FUNCTIONS
    // ========================================================================

    function getProductsForDisease(disease) {
        var results = [];
        var norm = disease.toLowerCase().replace(/[_\s-]+/g, '').replace('microdochium','fusarium');

        for (var key in FUNGICIDES_NZ) {
            if (!FUNGICIDES_NZ.hasOwnProperty(key)) continue;
            var entry = FUNGICIDES_NZ[key];
            if (!entry.targets) continue;

            var matched = entry.targets.some(function(t) {
                var tn = t.toLowerCase().replace(/[_\s-]+/g, '');
                return tn.indexOf(norm) >= 0 || norm.indexOf(tn) >= 0;
            });

            if (matched) {
                entry.products.forEach(function(p) {
                    results.push({
                        active: key, trade: p.trade, frac: entry.frac,
                        rate: p.rate, interval: p.interval, mode: entry.mode,
                        systemic: entry.systemic, resistanceRisk: entry.resistanceRisk,
                        distributor: p.distributor, notes: p.notes,
                        efficacy: entry.efficacyNZ ? (entry.efficacyNZ[disease] || null) : null
                    });
                });
            }
        }

        var riskOrder = {'NR':0,'L':1,'L-M':2,'M':3,'M-H':4,'H':5};
        results.sort(function(a,b) {
            var ea = a.efficacy||0, eb = b.efficacy||0;
            if (eb !== ea) return eb - ea;
            return (riskOrder[a.resistanceRisk]||3) - (riskOrder[b.resistanceRisk]||3);
        });
        return results;
    }

    function getRotationForDisease(disease) {
        var products = getProductsForDisease(disease);
        var fracGroups = {};
        products.forEach(function(p) {
            var f = String(p.frac);
            if (!fracGroups[f]) fracGroups[f] = p;
        });
        var rotation = [], keys = Object.keys(fracGroups);
        keys.forEach(function(k) {
            if (k.indexOf('M') === 0 && rotation.length < 4)
                rotation.push({ step: rotation.length+1, trade: fracGroups[k].trade, frac: k, rate: fracGroups[k].rate, reason: 'Multi-site (low resistance risk)' });
        });
        keys.forEach(function(k) {
            if (k.indexOf('M') !== 0 && rotation.length < 4)
                rotation.push({ step: rotation.length+1, trade: fracGroups[k].trade, frac: k, rate: fracGroups[k].rate, reason: 'FRAC '+k+' rotation' });
        });
        return rotation;
    }

    // ========================================================================
    // PUBLIC API
    // ========================================================================

    var NZ_FUNGICIDES_API = {
        db: FUNGICIDES_NZ,
        getProductsForDisease: getProductsForDisease,
        getRotationForDisease: getRotationForDisease,
        version: '2.0.0',
        region: 'NZ',
        source: 'Living Turf NZ Fungicide Chart, PGG Wrightson Turf, Syngenta NZ, ACVM Register'
    };

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = NZ_FUNGICIDES_API;
    }
    if (typeof window !== 'undefined') {
        window.GAIP_NZ_FUNGICIDES = NZ_FUNGICIDES_API;
    }

})();
