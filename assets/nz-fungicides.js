/**
 * NZ Turf Fungicide Database
 * ==========================
 *
 * Sources:
 *   - Living Turf NZ Fungicide Chart (primary - verified rates & efficacy)
 *   - PGG Wrightson Turf NZ product listings
 *   - Syngenta NZ / Living Turf tech sheets & labels
 *   - ACVM Register (MPI NZ) and EPA HSNO approvals for authorisation status
 *   - J. Spencer label verification, 13 Jul 2026
 *
 * Version: 3.0.0
 * Last Updated: July 2026
 *
 * Authorisation model (NZ-specific, A0):
 *   A product is lawfully authorised if ACVM-registered OR HSNO-approved under
 *   an ACVM exemption. Absence of an ACVM number is NOT a gate. Turf-only
 *   products routinely hold only a HSNO approval (no ACVM registration).
 *   Each product carries: acvm (P-number or null), hsno (HSR-code or null),
 *   authorisation ('ACVM' | 'HSNO' | 'unresolved').
 *
 * Registration gate (R0):
 *   A product may be recommended for a disease if and only if that disease
 *   appears in its own per-product targets list (exact match after normalise).
 *   Block-level targets is the union of all products' labels, used only by
 *   spray-log-cascade for active-level reasoning.
 *
 * Multi-site classification (R1):
 *   A product is multi-site if and only if EVERY component FRAC group is
 *   M-prefixed. BM02 (biological) and P07 (phosphonate) are NOT multi-site.
 *
 * Efficacy ratings (1-4 scale, 4 = most effective):
 *   Stored per active in efficacyNZ. 0 = explicit no activity (load-bearing
 *   for R4 credit; do not omit). null/absent = no rating available.
 *
 * Mode of Action: C = Contact, LS = Locally systemic,
 *   PMS = Phloem mobile systemic, XMS = Xylem-mobile systemic
 */

(function () {
    'use strict';

    var FUNGICIDES_NZ = {

        chlorothalonil: {
            frac: 'M05', useCategory: 'professional',
            allowedUses: ['golf', 'sportsfield', 'amenity', 'bowling'],
            products: [
                {
                    trade: 'Balear 720SC', ai: '720 g/L chlorothalonil',
                    rate: '7-21 L/ha', interval: '7-14', distributor: 'Living Turf NZ',
                    notes: 'Broad spectrum preventative/early curative. Rate varies by disease pressure.',
                    acvm: null, hsno: null, authorisation: 'ACVM',
                    targets: ['dollarSpot','brownPatch','fusarium','anthracnose','helminthosporium',
                              'dampingOff','fairyRing','redThread','leafSpot','grayLeafSpot']
                },
                {
                    trade: 'Daconil Weather Stik', ai: '720 g/L chlorothalonil',
                    rate: '7-21 L/ha', interval: '7-14', distributor: 'Syngenta NZ',
                    notes: 'Same AI concentration as Balear.',
                    acvm: null, hsno: null, authorisation: 'ACVM',
                    targets: ['dollarSpot','brownPatch','fusarium','anthracnose','helminthosporium',
                              'dampingOff','fairyRing','redThread','leafSpot','grayLeafSpot']
                }
            ],
            targets: ['dollarSpot','brownPatch','fusarium','anthracnose','helminthosporium',
                      'dampingOff','fairyRing','redThread','leafSpot','grayLeafSpot'],
            systemic: false, mode: 'Multi-site contact (C)', resistanceRisk: 'NR',
            efficacyNZ: { anthracnose:3, brownPatch:3, dampingOff:3, dollarSpot:2.5, fairyRing:2.5, meltingOut:3, fusarium:3 }
        },

        azoxystrobin: {
            frac: 11, useCategory: 'professional',
            allowedUses: ['golf', 'sportsfield', 'amenity', 'bowling', 'lawn'],
            products: [
                {
                    trade: 'Atlantis Flo', ai: '250 g/L azoxystrobin',
                    rate: '1.5-2.5 L/ha', interval: '14-28', distributor: 'Living Turf NZ',
                    notes: 'Broad range excluding Dollar Spot.',
                    acvm: null, hsno: null, authorisation: 'ACVM',
                    targets: ['anthracnose','brownPatch','grayLeafSpot','dampingOff','fusarium',
                              'helminthosporium','redThread','pythium','springDeadSpot']
                },
                {
                    trade: 'Azoxy 250 SC', ai: '250 g/L azoxystrobin',
                    rate: '1.5-2.5 L/ha', interval: '14-28', distributor: 'PGG Wrightson Turf / Turf Culture',
                    notes: 'Controls damping-off, brown patch, fusarium, red thread, leaf spot, anthracnose, rust.',
                    acvm: null, hsno: null, authorisation: 'ACVM',
                    targets: ['anthracnose','brownPatch','grayLeafSpot','dampingOff','fusarium',
                              'helminthosporium','redThread','leafSpot','rust']
                }
            ],
            targets: ['anthracnose','brownPatch','grayLeafSpot','dampingOff','fusarium',
                      'helminthosporium','redThread','pythium','springDeadSpot','leafSpot','rust'],
            systemic: true, mode: 'QoI - Strobilurin (XMS)', resistanceRisk: 'H',
            efficacyNZ: { anthracnose:3, brownPatch:4, dampingOff:3, dollarSpot:3, fairyRing:2.5, meltingOut:4, fusarium:4, pinkPatch:3.5, redThread:3 }
        },

        propiconazole: {
            frac: 3, useCategory: 'professional',
            allowedUses: ['golf', 'sportsfield', 'amenity', 'bowling'],
            products: [
                {
                    trade: 'Condor', ai: '250 g/L propiconazole',
                    rate: '2-3 L/ha', interval: '14-28', distributor: 'PGG Wrightson Turf',
                    notes: 'Wide range of leaf and stem diseases.',
                    acvm: null, hsno: null, authorisation: 'ACVM',
                    targets: ['dollarSpot','brownPatch','anthracnose','fusarium','rust','takeAll',
                              'redThread','pinkPatch','springDeadSpot','helminthosporium']
                }
            ],
            targets: ['dollarSpot','brownPatch','anthracnose','fusarium','rust','takeAll',
                      'redThread','pinkPatch','springDeadSpot','helminthosporium'],
            systemic: true, mode: 'DMI - Triazole (XMS)', resistanceRisk: 'M',
            efficacyNZ: { anthracnose:2, brownPatch:3, dollarSpot:4, fairyRing:2, meltingOut:3, fusarium:3, pinkPatch:3.5, redThread:1.5, rust:4, springDeadSpot:3, takeAll:2.5 }
        },

        azoxystrobinPropiconazole: {
            frac: '11+3',
            components: [
                { active: 'azoxystrobin', frac: 11 },
                { active: 'propiconazole', frac: 3 }
            ],
            useCategory: 'professional',
            allowedUses: ['golf', 'sportsfield', 'amenity', 'bowling'],
            products: [
                {
                    trade: 'Headway Maxx', ai: '62 g/L azoxystrobin + 104 g/L propiconazole',
                    rate: '9 L/ha', interval: '14-28',
                    distributor: 'Syngenta NZ / Living Turf / PGG Wrightson',
                    notes: 'Broad spectrum systemic. All surfaces incl greens. Water: 300-500 L/ha leaf, up to 1000 L/ha root.',
                    acvm: null, hsno: null, authorisation: 'ACVM',
                    targets: ['dollarSpot','brownPatch','anthracnose','pythium','takeAll','fusarium',
                              'helminthosporium','rust','springDeadSpot','redThread','yellowPatch']
                }
            ],
            targets: ['dollarSpot','brownPatch','anthracnose','pythium','takeAll','fusarium',
                      'helminthosporium','rust','springDeadSpot','redThread','yellowPatch'],
            systemic: true, mode: 'QoI + DMI combination (XMS)', resistanceRisk: 'M-H',
            efficacyNZ: { anthracnose:3, brownPatch:3.5, dampingOff:3.5, dollarSpot:3, fairyRing:3.5, redThread:3.5 }
        },

        tebuconazole: {
            frac: 3, useCategory: 'professional',
            allowedUses: ['golf', 'sportsfield', 'amenity', 'bowling'],
            products: [
                {
                    trade: 'Compass', ai: '430 g/L tebuconazole',
                    rate: '2 L/ha', interval: '14-28', distributor: 'Living Turf NZ',
                    notes: 'Economical. Particularly effective on Dollar Spot.',
                    acvm: null, hsno: null, authorisation: 'ACVM',
                    targets: ['dollarSpot','brownPatch','anthracnose','fusarium','pinkPatch','redThread','rust','takeAll']
                }
            ],
            targets: ['dollarSpot','brownPatch','anthracnose','fusarium','pinkPatch','redThread','rust','takeAll'],
            systemic: true, mode: 'DMI - Triazole (XMS)', resistanceRisk: 'M',
            efficacyNZ: { anthracnose:3, brownPatch:3, dollarSpot:4, rust:3 }
        },

        fluazinam: {
            frac: 29, useCategory: 'professional',
            allowedUses: ['golf', 'sportsfield', 'amenity', 'bowling'],
            products: [
                {
                    trade: 'Curalan', ai: '500 g/L fluazinam',
                    rate: '2 L/ha', interval: '14-28', distributor: 'Living Turf NZ',
                    notes: 'Low resistance risk. Economical. Excellent Dollar Spot and Brown Patch.',
                    acvm: null, hsno: null, authorisation: 'ACVM',
                    targets: ['dollarSpot','brownPatch','dampingOff','fusarium','fairyRing','pinkPatch']
                }
            ],
            targets: ['dollarSpot','brownPatch','dampingOff','fusarium','fairyRing','pinkPatch'],
            systemic: false, mode: 'Oxidative phosphorylation uncoupler (C)', resistanceRisk: 'L-M',
            efficacyNZ: { anthracnose:1.5, brownPatch:4, dampingOff:3, dollarSpot:3 }
        },

        fludioxonil: {
            frac: 12, useCategory: 'professional',
            allowedUses: ['golf', 'sportsfield', 'amenity', 'bowling'],
            products: [
                {
                    trade: 'Fludio', ai: '100 g/L fludioxonil',
                    rate: '3 L/ha', interval: '14-28', distributor: 'Living Turf NZ',
                    notes: 'Highly rated for Fusarium, Brown Patch and Melting-out.',
                    acvm: null, hsno: null, authorisation: 'ACVM',
                    targets: ['fusarium','brownPatch','anthracnose','dollarSpot','helminthosporium','redThread']
                }
            ],
            targets: ['fusarium','brownPatch','anthracnose','dollarSpot','helminthosporium','redThread'],
            systemic: false, mode: 'Signal transduction (C)', resistanceRisk: 'L-M',
            efficacyNZ: { anthracnose:2.5, brownPatch:3, dampingOff:3.5, dollarSpot:4, fusarium:4, meltingOut:3, redThread:2.5 }
        },

        difenoconazoleFludioxonil: {
            frac: '3+12',
            components: [
                { active: 'difenoconazole', frac: 3 },
                { active: 'fludioxonil', frac: 12 }
            ],
            useCategory: 'professional',
            allowedUses: ['golf', 'sportsfield', 'amenity', 'bowling'],
            products: [
                {
                    trade: 'Instrata Elite', ai: '80.3 g/L difenoconazole + 80.3 g/L fludioxonil',
                    rate: '3 L/ha', interval: '14', distributor: 'Syngenta NZ / Living Turf / PGG Wrightson',
                    notes: 'Max 2 apps/year at 14-day intervals. Rainfast 30 min.',
                    acvm: null, hsno: 'HSR101610', authorisation: 'HSNO',
                    targets: ['fusarium','anthracnose','dollarSpot','brownPatch','redThread']
                }
            ],
            targets: ['fusarium','anthracnose','dollarSpot','brownPatch','redThread'],
            systemic: true, mode: 'DMI + Signal transduction (C + XMS)', resistanceRisk: 'L-M',
            efficacyNZ: { anthracnose:3.5, brownPatch:3, dollarSpot:3.5, fusarium:4, redThread:2.5 }
        },

        cyproconazole: {
            frac: 3, useCategory: 'professional',
            allowedUses: ['golf', 'sportsfield', 'amenity', 'bowling'],
            products: [
                {
                    trade: 'Cypro 200SC', ai: '200 g/L cyproconazole',
                    rate: '2-4 L/ha', interval: '14-28', distributor: 'Living Turf NZ',
                    notes: 'Highly active DMI. Broad spectrum.',
                    acvm: null, hsno: null, authorisation: 'ACVM',
                    targets: ['dollarSpot','fusarium','brownPatch','anthracnose']
                }
            ],
            targets: ['dollarSpot','fusarium','brownPatch','anthracnose'],
            systemic: true, mode: 'DMI - Triazole (XMS)', resistanceRisk: 'M',
            efficacyNZ: {}
        },

        penthiopyrad: {
            frac: 7, useCategory: 'professional',
            allowedUses: ['golf', 'sportsfield', 'amenity', 'bowling'],
            products: [
                {
                    trade: 'Velista', ai: '500 g/kg penthiopyrad',
                    rate: '1-1.5 kg/ha', interval: '14-28',
                    distributor: 'Syngenta NZ / Living Turf / PGG Wrightson',
                    notes: 'First NZ turf-registered fairy ring control. Also anthracnose, dollar spot, brown ring patch, leaf and sheath spot.',
                    acvm: null, hsno: null, authorisation: 'HSNO',
                    targets: ['anthracnose','brownPatch','dollarSpot','fairyRing','helminthosporium',
                              'fusarium','springDeadSpot','waiteaPatch']
                }
            ],
            targets: ['anthracnose','brownPatch','dollarSpot','fairyRing','helminthosporium',
                      'fusarium','springDeadSpot','waiteaPatch'],
            systemic: true, mode: 'SDHI (XMS)', resistanceRisk: 'M-H',
            efficacyNZ: { anthracnose:3, brownPatch:4, dollarSpot:3.5, meltingOut:3.5, redThread:4, waiteaPatch:3.5 }
        },

        boscalid: {
            frac: 7, useCategory: 'professional',
            allowedUses: ['golf', 'sportsfield', 'amenity', 'bowling'],
            products: [
                {
                    trade: 'Unistar', ai: '500 g/L boscalid',
                    rate: '0.4-0.6 L/ha', interval: '14-28', distributor: 'Living Turf NZ',
                    notes: 'Very effective on Dollar Spot.',
                    acvm: null, hsno: null, authorisation: 'ACVM',
                    targets: ['dollarSpot']
                }
            ],
            targets: ['dollarSpot'],
            systemic: true, mode: 'SDHI (XMS)', resistanceRisk: 'M-H',
            efficacyNZ: { dollarSpot:3.5 }
        },

        iprodione: {
            frac: 2, useCategory: 'professional',
            allowedUses: ['golf', 'sportsfield', 'amenity', 'bowling'],
            products: [
                {
                    trade: 'Ippon 500SC', ai: '500 g/L iprodione',
                    rate: '5 L/ha', interval: '14-28', distributor: 'Living Turf NZ / PGG Wrightson',
                    notes: 'Contact. Preventative control of wide range of diseases.',
                    acvm: 'P005644', hsno: null, authorisation: 'ACVM',
                    targets: ['brownPatch','dollarSpot','fusarium','helminthosporium','redThread','curvularia']
                },
                {
                    trade: 'Defence', ai: '250 g/L iprodione',
                    rate: '10 L/ha', interval: '14-28', distributor: 'Arxada NZ',
                    notes: 'Equivalent AI delivery to Ippon at 5 L/ha.',
                    acvm: null, hsno: null, authorisation: 'ACVM',
                    targets: ['brownPatch','dollarSpot','fusarium','helminthosporium','redThread']
                }
            ],
            targets: ['brownPatch','dollarSpot','fusarium','helminthosporium','redThread','curvularia'],
            systemic: false, mode: 'Dicarboximide (LS)', resistanceRisk: 'M-H',
            efficacyNZ: { brownPatch:3, dollarSpot:3.5, meltingOut:3, fusarium:3, redThread:3.5 }
        },

        trifloxystrobin: {
            frac: 11, useCategory: 'professional',
            allowedUses: ['golf', 'sportsfield', 'amenity', 'bowling'],
            products: [
                {
                    trade: 'Protiva', ai: '500 g/L trifloxystrobin',
                    rate: '0.35-0.65 L/ha', interval: '14-28', distributor: 'Living Turf NZ',
                    notes: 'Anthracnose, Brown Patch and Fusarium.',
                    acvm: null, hsno: null, authorisation: 'ACVM',
                    targets: ['anthracnose','brownPatch','fusarium','dollarSpot','helminthosporium','redThread']
                }
            ],
            targets: ['anthracnose','brownPatch','fusarium','dollarSpot','helminthosporium','redThread'],
            systemic: false, mode: 'QoI - Strobilurin (LS)', resistanceRisk: 'H',
            efficacyNZ: { anthracnose:3.5, brownPatch:4, dollarSpot:2.5, meltingOut:3, redThread:2.5 }
        },

        pyraclostrobin: {
            frac: 11, useCategory: 'professional',
            allowedUses: ['golf', 'sportsfield', 'amenity', 'bowling'],
            products: [
                {
                    trade: 'Pyrax', ai: '250 g/L pyraclostrobin',
                    rate: '1.3-2.25 L/ha', interval: '14-28', distributor: 'Living Turf NZ',
                    notes: 'Very effective across broad range incl Take-All, Anthracnose, Brown Patch.',
                    acvm: null, hsno: null, authorisation: 'ACVM',
                    targets: ['anthracnose','brownPatch','dollarSpot','fusarium','helminthosporium',
                              'redThread','rust','takeAll','fairyRing']
                }
            ],
            targets: ['anthracnose','brownPatch','dollarSpot','fusarium','helminthosporium',
                      'redThread','rust','takeAll','fairyRing'],
            systemic: false, mode: 'QoI - Strobilurin (LS)', resistanceRisk: 'H',
            efficacyNZ: { anthracnose:3, brownPatch:4, dollarSpot:2.5, fairyRing:3, meltingOut:3, fusarium:3, redThread:4, rust:3, takeAll:3 }
        },

        carbendazim: {
            frac: 1, useCategory: 'professional',
            allowedUses: ['golf', 'sportsfield', 'amenity', 'bowling'],
            products: [
                {
                    trade: 'Goldazim', ai: '500 g/L carbendazim',
                    rate: '5-10 L/ha', interval: '14-28', distributor: 'Living Turf NZ',
                    notes: 'Useful in tank mixes with chlorothalonil. Good during wet weather.',
                    acvm: null, hsno: null, authorisation: 'ACVM',
                    targets: ['dollarSpot','fusarium','brownPatch','anthracnose','helminthosporium']
                },
                {
                    trade: 'Carbenz', ai: '500 g/L carbendazim',
                    rate: '5-10 L/ha', interval: '14-28', distributor: 'PGG Wrightson Turf',
                    notes: 'Ideal alternative in resistance prevention strategy.',
                    acvm: null, hsno: null, authorisation: 'ACVM',
                    targets: ['dollarSpot','fusarium','brownPatch','anthracnose','helminthosporium']
                }
            ],
            targets: ['dollarSpot','fusarium','brownPatch','anthracnose','helminthosporium'],
            systemic: true, mode: 'MBC - Benzimidazole (XMS)', resistanceRisk: 'H',
            efficacyNZ: {}
        },

        thiophanateMethyl: {
            frac: 1, useCategory: 'professional',
            allowedUses: ['golf', 'sportsfield', 'amenity', 'bowling'],
            products: [
                {
                    trade: 'Topsin M-4A', ai: '400 g/L thiophanate-methyl',
                    rate: '5-10 L/ha', interval: '14-28', distributor: 'PGG Wrightson Turf',
                    notes: 'Broad spectrum for brown patch.',
                    acvm: null, hsno: null, authorisation: 'ACVM',
                    targets: ['brownPatch','dollarSpot','fusarium','helminthosporium','anthracnose']
                }
            ],
            targets: ['brownPatch','dollarSpot','fusarium','helminthosporium','anthracnose'],
            systemic: true, mode: 'MBC - Benzimidazole (XMS)', resistanceRisk: 'H',
            efficacyNZ: {}
        },

        chlorothalonilThiophanate: {
            frac: 'M05+1',
            components: [
                { active: 'chlorothalonil', frac: 'M05' },
                { active: 'thiophanateMethyl', frac: 1 }
            ],
            useCategory: 'professional',
            allowedUses: ['golf', 'sportsfield', 'amenity', 'bowling'],
            products: [
                {
                    trade: 'Taratek 5F', ai: '250 g/L chlorothalonil + 250 g/L thiophanate-methyl',
                    rate: '10-15 L/ha', interval: '14-28', distributor: 'PGG Wrightson Turf',
                    notes: 'Contact + systemic combination.',
                    acvm: null, hsno: null, authorisation: 'ACVM',
                    targets: ['dollarSpot','brownPatch','fusarium','helminthosporium','anthracnose','dampingOff']
                }
            ],
            targets: ['dollarSpot','brownPatch','fusarium','helminthosporium','anthracnose','dampingOff'],
            systemic: true, mode: 'Multi-site + MBC (C + XMS)', resistanceRisk: 'M',
            efficacyNZ: {}
        },

        mancozeb: {
            frac: 'M03', useCategory: 'professional',
            allowedUses: ['golf', 'sportsfield', 'amenity', 'bowling'],
            products: [
                {
                    trade: 'Supamanz', ai: '455 g/L mancozeb',
                    rate: '10-20 L/ha', interval: '7-14', distributor: 'Living Turf NZ',
                    notes: 'No resistance risk. Use as protectant or tank mix partner.',
                    acvm: null, hsno: null, authorisation: 'unresolved',
                    targets: ['brownPatch','dampingOff','dollarSpot','fusarium','helminthosporium','rust']
                }
            ],
            targets: ['brownPatch','dampingOff','dollarSpot','fusarium','helminthosporium','rust'],
            systemic: false, mode: 'Multi-site contact (C)', resistanceRisk: 'NR',
            efficacyNZ: { brownPatch:3, dampingOff:1, dollarSpot:3.5, meltingOut:2, fusarium:2, pythium:0, redThread:3 }
        },

        thiram: {
            frac: 'M03', useCategory: 'professional',
            allowedUses: ['golf', 'sportsfield', 'amenity', 'bowling'],
            products: [
                {
                    trade: 'Thiram 40F', ai: '400 g/L thiram',
                    rate: '15 L/ha', interval: '7-14', distributor: 'Living Turf NZ / PGG Wrightson',
                    notes: 'Broad spectrum contact. No resistance risk.',
                    acvm: null, hsno: null, authorisation: 'ACVM',
                    targets: ['brownPatch','dampingOff','helminthosporium','fusarium']
                }
            ],
            targets: ['brownPatch','dampingOff','helminthosporium','fusarium'],
            systemic: false, mode: 'Multi-site contact (C)', resistanceRisk: 'NR',
            efficacyNZ: { brownPatch:2, dampingOff:1 }
        },

        fosetylAl: {
            frac: 'P07', useCategory: 'professional',
            allowedUses: ['golf', 'sportsfield', 'amenity', 'bowling'],
            products: [
                {
                    trade: 'Fostonic', ai: 'fosetyl-aluminium',
                    rate: '6-12 kg/ha', interval: '14-28', distributor: 'Living Turf NZ',
                    notes: 'Primary pythium preventive. Systemic, leaf and root absorbed.',
                    acvm: null, hsno: null, authorisation: 'unresolved',
                    targets: ['pythium']
                },
                {
                    trade: 'Aliette WG', ai: '800 g/kg fosetyl-aluminium',
                    rate: '6-12 kg/ha', interval: '14-28', distributor: 'PGG Wrightson Turf',
                    notes: 'Fast acting. Bi-directional movement.',
                    acvm: null, hsno: null, authorisation: 'ACVM',
                    targets: ['pythium']
                }
            ],
            targets: ['pythium'],
            systemic: true, preventiveOnly: true, mode: 'Phosphonate (PMS)', resistanceRisk: 'L',
            efficacyNZ: {}
        },

        phosphite: {
            frac: 'P07', useCategory: 'professional',
            allowedUses: ['golf', 'sportsfield', 'amenity', 'bowling', 'lawn'],
            products: [
                {
                    trade: 'Phosgard', ai: 'phosphite',
                    rate: '8 L/ha', interval: '14-28', distributor: 'Living Turf NZ',
                    notes: 'Preventative Pythium (damping off) control.',
                    acvm: null, hsno: null, authorisation: 'ACVM',
                    targets: ['pythium']
                }
            ],
            targets: ['pythium'],
            systemic: true, preventiveOnly: true, mode: 'Phosphonate (PMS)', resistanceRisk: 'L',
            efficacyNZ: { pythium:2.5 }
        },

        propamocarb: {
            frac: 28, useCategory: 'professional',
            allowedUses: ['golf', 'sportsfield', 'amenity', 'bowling'],
            products: [
                {
                    trade: 'Procura', ai: '605 g/L propamocarb',
                    rate: '4.5-6.5 L/ha', interval: '14-28', distributor: 'Living Turf NZ',
                    notes: 'Systemic for Pythium in preventative program.',
                    acvm: null, hsno: 'HSR000481', authorisation: 'HSNO',
                    targets: ['pythium']
                }
            ],
            targets: ['pythium'],
            systemic: false, mode: 'Carbamate (LS)', resistanceRisk: 'M',
            efficacyNZ: {}
        },

        metalaxyl: {
            frac: 4, useCategory: 'professional',
            allowedUses: ['golf', 'sportsfield', 'amenity', 'bowling'],
            products: [
                {
                    trade: 'Ventura', ai: '250 g/L metalaxyl',
                    rate: '3-6 L/ha', interval: '14-28', distributor: 'Living Turf NZ',
                    notes: 'Damping off, preventative and curative.',
                    acvm: null, hsno: null, authorisation: 'ACVM',
                    targets: ['pythium']
                }
            ],
            targets: ['pythium'],
            systemic: true, mode: 'Phenylamide (XMS)', resistanceRisk: 'H',
            efficacyNZ: {}
        },

        metalaxylMMancozeb: {
            frac: '4+M03',
            components: [
                { active: 'metalaxyl', frac: 4 },
                { active: 'mancozeb', frac: 'M03' }
            ],
            useCategory: 'professional',
            allowedUses: ['golf', 'sportsfield', 'amenity', 'bowling'],
            products: [
                {
                    trade: 'Ridomil Gold MZ WG', ai: '40 g/kg metalaxyl-M + 640 g/kg mancozeb',
                    rate: '2.5-5 kg/ha', interval: '14-28', distributor: 'PGG Wrightson Turf',
                    notes: 'Pythium blight in newly sown or young turf.',
                    acvm: null, hsno: null, authorisation: 'ACVM',
                    targets: ['pythium','dampingOff']
                }
            ],
            targets: ['pythium','dampingOff'],
            systemic: true, mode: 'Phenylamide + Multi-site (XMS + C)', resistanceRisk: 'M-H',
            efficacyNZ: { dampingOff:1, pythium:0 }
        },

        triadimenol: {
            frac: 3, useCategory: 'professional',
            allowedUses: ['golf', 'sportsfield', 'amenity', 'bowling'],
            products: [
                {
                    trade: 'Vandia', ai: '250 g/L triadimenol',
                    rate: '3-6 L/ha', interval: '14-28', distributor: 'Living Turf NZ',
                    notes: 'Highly active against Dollar Spot, Take All Patch and Fusarium.',
                    acvm: null, hsno: null, authorisation: 'ACVM',
                    targets: ['dollarSpot','takeAll','fusarium','brownPatch','rust','springDeadSpot']
                }
            ],
            targets: ['dollarSpot','takeAll','fusarium','brownPatch','rust','springDeadSpot'],
            systemic: true, mode: 'DMI - Triazole (XMS)', resistanceRisk: 'M',
            efficacyNZ: { brownPatch:1.5, dollarSpot:4, fairyRing:2, fusarium:3, redThread:3.5, takeAll:2.5 }
        },

        myclobutanil: {
            frac: 3, useCategory: 'professional',
            allowedUses: ['golf', 'sportsfield', 'amenity', 'bowling'],
            products: [
                {
                    trade: 'Validus', ai: '200 g/L myclobutanil',
                    rate: '3.6 L/ha', interval: '14-28', distributor: 'Living Turf NZ',
                    notes: 'Highly rated for Dollar Spot. Also Anthracnose, Brown Patch and Fusarium.',
                    acvm: null, hsno: null, authorisation: 'ACVM',
                    targets: ['dollarSpot','anthracnose','brownPatch','fusarium','redThread','takeAll']
                }
            ],
            targets: ['dollarSpot','anthracnose','brownPatch','fusarium','redThread','takeAll'],
            systemic: true, mode: 'DMI - Triazole (XMS)', resistanceRisk: 'M',
            efficacyNZ: { anthracnose:2, brownPatch:2.5, dollarSpot:4, fairyRing:1, fusarium:2, redThread:2, takeAll:2 }
        },

        prochloraz: {
            frac: 3, useCategory: 'professional',
            allowedUses: ['golf', 'sportsfield', 'amenity', 'bowling'],
            products: [
                {
                    trade: 'Varicur 450EW', ai: '450 g/L prochloraz',
                    rate: '6.5 L/ha', interval: '14-28', distributor: 'Living Turf NZ',
                    notes: 'Unique AI for Dollar Spot control.',
                    acvm: null, hsno: null, authorisation: 'ACVM',
                    targets: ['dollarSpot','fusarium','brownPatch','anthracnose','helminthosporium','redThread']
                }
            ],
            targets: ['dollarSpot','fusarium','brownPatch','anthracnose','helminthosporium','redThread'],
            systemic: true, mode: 'DMI - Imidazole (XMS)', resistanceRisk: 'M',
            efficacyNZ: {}
        },

        bacillusSubtilis: {
            frac: 'BM02', useCategory: 'professional',
            allowedUses: ['golf', 'sportsfield', 'amenity', 'bowling', 'lawn'],
            products: [
                {
                    trade: 'Clarity', ai: 'Bacillus subtilis',
                    rate: '265 g/sachet', interval: '7-14', distributor: 'Living Turf NZ',
                    notes: 'Preventative biological fungicide.',
                    acvm: null, hsno: null, authorisation: 'ACVM',
                    targets: ['dollarSpot','brownPatch','fusarium']
                }
            ],
            targets: ['dollarSpot','brownPatch','fusarium'],
            systemic: false, mode: 'Biological (C)', resistanceRisk: 'L',
            efficacyNZ: { dollarSpot:1.5, brownPatch:1, fusarium:1 }
        },

        difenoconazole: {
            frac: 3, useCategory: 'professional',
            allowedUses: ['golf', 'sportsfield', 'amenity', 'bowling'],
            products: [],
            targets: [],
            systemic: true, mode: 'DMI - Triazole (XMS)', resistanceRisk: 'M',
            efficacyNZ: {}
        }
    };

    // ========================================================================
    // HELPER FUNCTIONS
    // ========================================================================

    function normaliseDisease(d) {
        return d.toLowerCase().replace(/[_\s-]+/g, '').replace('microdochium', 'fusarium');
    }

    // R1: a product is multi-site only if EVERY component FRAC group is M-prefixed.
    // BM02 and P07 are not multi-site.
    function isAllMultiSite(fracStr) {
        return String(fracStr).split('+').every(function(c) {
            return /^M\d/i.test(c.trim());
        });
    }

    function getFracComponents(fracStr) {
        return String(fracStr).split('+').map(function(c) { return c.trim(); });
    }

    // Groups subject to R2 consecutive limits and R3 season caps.
    var _MANAGED_GROUPS = { '1': 1, '2': 1, '3': 1, '4': 1, '7': 1, '11': 1 };

    function isManagedGroup(g) { return !!_MANAGED_GROUPS[String(g)]; }

    // Returns the FRAC component groups subject to R2/R3 management for a FRAC string.
    function getManagedComponents(fracStr) {
        return getFracComponents(fracStr).filter(function(g) { return isManagedGroup(g); });
    }

    // R0: exact match against per-product targets (falls back to block targets).
    // Substring matching is prohibited — it creates false registrations.
    function getProductsForDisease(disease) {
        var results = [];
        var norm = normaliseDisease(disease);

        for (var key in FUNGICIDES_NZ) {
            if (!FUNGICIDES_NZ.hasOwnProperty(key)) continue;
            var entry = FUNGICIDES_NZ[key];
            if (!entry.products) continue;

            entry.products.forEach(function(p) {
                var targetList = p.targets || entry.targets;
                if (!targetList) return;

                var matched = targetList.some(function(t) {
                    return normaliseDisease(t) === norm;
                });

                if (matched) {
                    results.push({
                        active: key, trade: p.trade, frac: entry.frac,
                        rate: p.rate, interval: p.interval, mode: entry.mode,
                        systemic: entry.systemic, resistanceRisk: entry.resistanceRisk,
                        distributor: p.distributor, notes: p.notes,
                        authorisation: p.authorisation || null,
                        acvm: p.acvm || null, hsno: p.hsno || null,
                        efficacy: entry.efficacyNZ ? (entry.efficacyNZ[disease] || null) : null
                    });
                }
            });
        }

        var riskOrder = {'NR':0,'L':1,'L-M':2,'M':3,'M-H':4,'H':5};
        results.sort(function(a, b) {
            var ea = a.efficacy || 0, eb = b.efficacy || 0;
            if (eb !== ea) return eb - ea;
            return (riskOrder[a.resistanceRisk] || 3) - (riskOrder[b.resistanceRisk] || 3);
        });
        return results;
    }

    // ========================================================================
    // R4: MIXTURE CREDIT
    // ========================================================================

    // Returns array of { component, active, hasCredit, reason } for each managed
    // (resistance-prone) component in a mixture block.
    // Rule (a/b): single-site partner efficacy strictly > 3 grants credit.
    // Rule (b'): multi-site partner grants credit if it has activity > 0 against the disease.
    function getMixtureCredit(blockKey, disease) {
        var entry = FUNGICIDES_NZ[blockKey];
        if (!entry || !entry.components || entry.components.length < 2) return [];

        var result = [];

        entry.components.forEach(function(comp) {
            if (!isManagedGroup(String(comp.frac))) return;

            var hasCredit = false;
            var reason = 'no credit';
            var reportingPartnerActive = null;
            var reportingPartnerEfficacy = null;

            entry.components.forEach(function(partner) {
                if (hasCredit || String(partner.frac) === String(comp.frac)) return;

                var partnerEntry = FUNGICIDES_NZ[partner.active];
                var partnerEff = (partnerEntry && partnerEntry.efficacyNZ)
                    ? partnerEntry.efficacyNZ[disease]
                    : undefined;
                var partnerIsMS = /^M\d/i.test(String(partner.frac));

                reportingPartnerActive   = partner.active;
                reportingPartnerEfficacy = (partnerEff != null) ? partnerEff : null;

                if (partnerIsMS) {
                    if (typeof partnerEff === 'number' && partnerEff > 0) {
                        hasCredit = true;
                        reason = 'FRAC ' + partner.frac + ' partner has activity (' + partnerEff + ')';
                    } else {
                        reason = 'FRAC ' + partner.frac + ' partner has no activity against ' + disease;
                    }
                } else {
                    if (typeof partnerEff === 'number' && partnerEff > 3) {
                        hasCredit = true;
                        reason = 'FRAC ' + partner.frac + ' partner efficacy ' + partnerEff + ' > 3';
                    } else {
                        reason = 'FRAC ' + partner.frac + ' partner efficacy ' +
                            (partnerEff != null ? partnerEff : 'unknown') + ' ≤3';
                    }
                }
            });

            result.push({
                component: String(comp.frac),
                active: comp.active,
                hasCredit: hasCredit,
                reason: reason,
                partnerActive: reportingPartnerActive,
                partnerEfficacy: reportingPartnerEfficacy
            });
        });

        return result;
    }

    // ========================================================================
    // R2/R3: PROGRAMME VALIDATION
    // ========================================================================

    var _R2_LIMITS     = { '1': 2, '2': 2, '3': 1, '4': 2, '7': 1, '11': 1 };
    var _R3_COUNT_CAPS = { '2': 3, '3': 4, '4': 4, '7': 4 };

    // Validate an ordered fungicide programme for R2 (consecutive limits) and R3 (season caps).
    // steps:       array of FRAC strings in application order, e.g. ['M05', '3', '11+3', '7']
    // totalSprays: total spray count for the season (for fraction caps; defaults to steps.length)
    // Returns { valid: boolean, violations: [{ step, rule, reason }] }
    function validateProgramme(steps, totalSprays) {
        var violations = [];
        totalSprays = totalSprays || steps.length;

        var groupCounts = {};
        var frac1Solo  = false;
        var frac11Solo = false;

        steps.forEach(function(fracStr, idx) {
            var comps = getFracComponents(fracStr);
            var hasMS = comps.some(function(g) { return /^M\d/i.test(g); });

            comps.forEach(function(g) {
                if (!isManagedGroup(g)) return;

                groupCounts[g] = (groupCounts[g] || 0) + 1;

                if (g === '1'  && !hasMS) frac1Solo  = true;
                if (g === '11' && !hasMS) frac11Solo = true;

                // R2: count the current consecutive run length ending at this step
                var run = 0;
                for (var i = idx; i >= 0; i--) {
                    if (getFracComponents(steps[i]).indexOf(g) !== -1) { run++; } else { break; }
                }
                var limit = _R2_LIMITS[g];
                if (limit !== undefined && run > limit) {
                    violations.push({ step: idx + 1, rule: 'R2',
                        reason: 'FRAC ' + g + ': ' + run + ' consecutive exceeds limit of ' + limit });
                }
            });
        });

        // R3: fixed count caps
        Object.keys(_R3_COUNT_CAPS).forEach(function(g) {
            var count = groupCounts[g] || 0;
            var cap   = _R3_COUNT_CAPS[g];
            if (count > cap) {
                violations.push({ step: null, rule: 'R3',
                    reason: 'FRAC ' + g + ': ' + count + ' applications exceeds season cap of ' + cap });
            }
        });

        // R3: FRAC 1 — fixed cap 5 AND fraction cap (33% solo / 50% all premix)
        var frac1Count = groupCounts['1'] || 0;
        if (frac1Count > 0) {
            if (frac1Count > 5) {
                violations.push({ step: null, rule: 'R3',
                    reason: 'FRAC 1: ' + frac1Count + ' applications exceeds season cap of 5' });
            }
            var frac1Cap = frac1Solo ? 0.33 : 0.50;
            var frac1Pct = frac1Count / totalSprays;
            if (frac1Pct > frac1Cap) {
                violations.push({ step: null, rule: 'R3',
                    reason: 'FRAC 1: ' + Math.round(frac1Pct * 100) + '% of sprays exceeds ' +
                        Math.round(frac1Cap * 100) + '% cap' + (frac1Solo ? ' (solo use detected)' : ' (all premix)') });
            }
        }

        // R3: FRAC 11 — fraction cap only, no fixed count (33% solo / 50% all premix)
        var frac11Count = groupCounts['11'] || 0;
        if (frac11Count > 0) {
            var frac11Cap = frac11Solo ? 0.33 : 0.50;
            var frac11Pct = frac11Count / totalSprays;
            if (frac11Pct > frac11Cap) {
                violations.push({ step: null, rule: 'R3',
                    reason: 'FRAC 11: ' + Math.round(frac11Pct * 100) + '% of sprays exceeds ' +
                        Math.round(frac11Cap * 100) + '% cap' + (frac11Solo ? ' (solo use detected)' : ' (all premix)') });
            }
        }

        return { valid: violations.length === 0, violations: violations };
    }

    function getRotationForDisease(disease) {
        var products = getProductsForDisease(disease);
        var fracGroups = {};
        products.forEach(function(p) {
            var f = String(p.frac);
            if (!fracGroups[f]) fracGroups[f] = p;
        });

        var rotation = [];
        var keys = Object.keys(fracGroups);

        // Multi-site steps first (R1: every component M-prefixed)
        keys.forEach(function(k) {
            if (rotation.length < 2 && isAllMultiSite(k)) {
                var p = fracGroups[k];
                rotation.push({
                    step: rotation.length + 1,
                    trade: p.trade, frac: k, rate: p.rate,
                    reason: 'Multi-site (low resistance risk)',
                    mixtureCredit: getMixtureCredit(p.active, disease)
                });
            }
        });

        // At-risk steps: R2-aware ordering — avoid consecutive FRAC 3/7/11
        var atRiskQueue = keys.filter(function(k) { return !isAllMultiSite(k); });
        var lastMC = null;

        while (atRiskQueue.length > 0 && rotation.length < 4) {
            var chosen = null;
            var chosenIdx = -1;
            var r2Warn = false;

            for (var i = 0; i < atRiskQueue.length; i++) {
                var k = atRiskQueue[i];
                var mc = getManagedComponents(k);
                var violates = lastMC !== null && mc.some(function(g) {
                    return _R2_LIMITS[g] === 1 && lastMC.indexOf(g) !== -1;
                });
                if (!violates) { chosen = k; chosenIdx = i; break; }
            }

            if (chosen === null) {
                chosen = atRiskQueue[0]; chosenIdx = 0; r2Warn = true;
            }

            atRiskQueue.splice(chosenIdx, 1);
            lastMC = getManagedComponents(chosen);

            var p = fracGroups[chosen];
            var credit = getMixtureCredit(p.active, disease);

            var reason = 'FRAC ' + chosen + ' rotation';
            if (credit.length) {
                var credited   = credit.filter(function(c) { return c.hasCredit; });
                var uncredited = credit.filter(function(c) { return !c.hasCredit; });
                if (credited.length) {
                    reason += ' — ' + credited.map(function(c) {
                        return 'FRAC ' + c.component + ' protected (' + c.reason + ')';
                    }).join('; ');
                }
                if (uncredited.length) {
                    reason += (credited.length ? ' | ' : ' — ') + uncredited.map(function(c) {
                        return 'FRAC ' + c.component + ' unprotected (' + c.reason + ')';
                    }).join('; ');
                }
            }
            if (r2Warn) {
                reason += ' [R2: space away from previous step]';
            }

            rotation.push({
                step: rotation.length + 1,
                trade: p.trade, frac: chosen, rate: p.rate,
                reason: reason,
                mixtureCredit: credit
            });
        }

        return rotation;
    }

    // ========================================================================
    // PUBLIC API
    // ========================================================================

    var NZ_FUNGICIDES_API = {
        db: FUNGICIDES_NZ,
        getProductsForDisease: getProductsForDisease,
        getRotationForDisease: getRotationForDisease,
        getMixtureCredit: getMixtureCredit,
        validateProgramme: validateProgramme,
        version: '3.1.0',
        region: 'NZ',
        source: 'Living Turf NZ Fungicide Chart, PGG Wrightson Turf, Syngenta NZ, ACVM Register, J. Spencer label verification Jul 2026'
    };

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = NZ_FUNGICIDES_API;
    }
    if (typeof window !== 'undefined') {
        window.GAIP_NZ_FUNGICIDES = NZ_FUNGICIDES_API;
    }

})();
