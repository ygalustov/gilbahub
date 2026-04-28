/**
 * =============================================================================
 * GILBA EXTENDED REGIONAL FUNGICIDE DATABASE v1.0.0
 * =============================================================================
 * 
 * Extended fungicide registration data for Nordic countries and Japan
 * 
 * NEW REGIONS COVERED:
 * - Sweden (KEMI - Kemikalieinspektionen)
 * - Denmark (Danish EPA BMD - Bekæmpelsesmiddeldatabasen)
 * - Norway (Mattilsynet - Norwegian Food Safety Authority)
 * - Japan (MAFF - Ministry of Agriculture, Forestry and Fisheries) - EXPANDED
 * 
 * SOURCES:
 * - KEMI Pesticide Register (bekämpningsmedelsregistret) 2024
 * - Danish EPA BMD (mst.dk/bmd) 2024
 * - Mattilsynet plantevernmidler database 2024
 * - MAFF 農薬登録情報提供システム 2024
 * - SGF (Swedish Golf Federation) approved list 2024-2025
 * - DGU (Danish Golf Union) minor-use permits 2024
 * - STERF research publications
 * 
 * STRUCTURE:
 * Each country database follows the existing Gilba format with:
 * - Active ingredient as key
 * - FRAC group
 * - Products array with trade names, rates, intervals, notes
 * - Disease targets array
 * - Systemic/contact classification
 * - Mode of action
 * 
 * @author Gilba Solutions
 * @version 1.0.0
 * @requires disease-engine.js
 * =============================================================================
 */

(function(global) {
    'use strict';


    // ═══════════════════════════════════════════════════════════════════════════
    // USE CATEGORY SYSTEM
    // 
    // All products in Nordic databases are PROFESSIONAL USE ONLY:
    // - Sweden: KEMI registration for "Golfbana" (golf courses) only
    // - Denmark: BMD approval for "Golfbaner og sportsanlæg" 
    // - Norway: Mattilsynet for "golfbaner" and "idrettsanlegg"
    // - Japan: MAFF registration typically covers ゴルフ場 (golf courses)
    //          and スポーツ施設 (sports facilities)
    // 
    // NO domestic lawn (home garden) products - these are restricted in all
    // Nordic countries and Japan for professional/licensed applicator use only.
    //
    // useCategory: 'professional' (default for all)
    // allowedUses: ['golf', 'sportsfield'] (default for all)
    // ═══════════════════════════════════════════════════════════════════════════

    // ═══════════════════════════════════════════════════════════════════════════
    // SWEDEN (KEMI) FUNGICIDE DATABASE
    // Source: Kemikalieinspektionen Pesticide Register 2024
    // Swedish Golf Federation (SGF) approved products list
    // 
    // REGULATORY NOTE: Sweden allows pesticides on golf courses under
    // dispens (exemption) from general outdoor ban. Sportsfields have
    // more restrictions. NO domestic lawn use permitted.
    // ═══════════════════════════════════════════════════════════════════════════
    
    const FUNGICIDES_SWEDEN = {
        // ───────────────────────────────────────────────────────────────────────
        // FRAC GROUP 3 - DMI Fungicides (Triazoles)
        // ───────────────────────────────────────────────────────────────────────
        difenoconazole: {
            frac: 3,
            useCategory: 'professional',
            allowedUses: ['golf'],
            products: [
                { 
                    trade: 'Ascernity', 
                    kemi: 'Reg 5553', 
                    rate: '3 L/ha', 
                    interval: '14-28',
                    useCategory: 'professional',
                    allowedUses: ['golf'], 
                    notes: 'Tees & greens only. With benzovindiflupyr (FRAC 7).',
                    diseases: 'Microdochium patch, brown patch, anthracnose, dollar spot'
                },
                { 
                    trade: 'Instrata Elite', 
                    kemi: 'Reg 5483', 
                    rate: '2.5 L/ha', 
                    interval: '14-28',
                    useCategory: 'professional',
                    allowedUses: ['golf'], 
                    notes: 'Tees, greens, collars. Handheld on fairways. With fludioxonil (FRAC 12).',
                    diseases: 'Microdochium patch, dollar spot, anthracnose'
                },
                { 
                    trade: 'Revus Top', 
                    kemi: 'Reg 5362', 
                    rate: '0.6 L/ha', 
                    interval: '7-14',
                    useCategory: 'professional',
                    allowedUses: ['golf'], 
                    notes: 'With mandipropamid. Minor use on turf.',
                    diseases: 'Pythium'
                }
            ],
            targets: ['fusarium', 'dollarSpot', 'brownPatch', 'anthracnose', 'pythium'],
            systemic: true,
            mode: 'Sterol synthesis inhibitor (C14-demethylase)'
        },
        prothioconazole: {
            frac: 3,
            useCategory: 'professional',
            allowedUses: ['golf'],
            products: [
                { 
                    trade: 'Proline EC 250', 
                    kemi: 'Reg 5142', 
                    rate: '0.8 L/ha', 
                    interval: '14-28',
                    useCategory: 'professional',
                    allowedUses: ['golf'], 
                    notes: 'Off-label/minor use for snow mold prevention',
                    diseases: 'Microdochium patch, Typhula spp.'
                },
                { 
                    trade: 'Delaro SC 325', 
                    kemi: 'Reg 5489', 
                    rate: '1 L/ha', 
                    interval: '14-28',
                    useCategory: 'professional',
                    allowedUses: ['golf'], 
                    notes: 'With trifloxystrobin (FRAC 11). Microdochium control.',
                    diseases: 'Microdochium patch, snow mold'
                }
            ],
            targets: ['fusarium', 'snowMold'],
            systemic: true,
            mode: 'Sterol synthesis inhibitor (C14-demethylase)'
        },

        // ───────────────────────────────────────────────────────────────────────
        // FRAC GROUP 7 - SDHI Fungicides
        // ───────────────────────────────────────────────────────────────────────
        fluopyram: {
            frac: 7,
            useCategory: 'professional',
            allowedUses: ['golf'],
            products: [
                { 
                    trade: 'Exteris StressGard', 
                    kemi: 'Reg 5612', 
                    rate: '10 L/ha', 
                    interval: '14-28',
                    useCategory: 'professional',
                    allowedUses: ['golf'], 
                    notes: 'Tees, greens, collars. With trifloxystrobin (FRAC 11). StressGard formulation.',
                    diseases: 'Dollar spot, Microdochium patch, brown patch'
                }
            ],
            targets: ['dollarSpot', 'fusarium', 'brownPatch'],
            systemic: true,
            mode: 'Succinate dehydrogenase inhibitor (SDHI)'
        },
        benzovindiflupyr: {
            frac: 7,
            products: [
                { 
                    trade: 'Ascernity', 
                    kemi: 'Reg 5553', 
                    rate: '3 L/ha', 
                    interval: '14-28', 
                    notes: 'Combined with difenoconazole. Premium greens/tees product.',
                    diseases: 'Dollar spot, Microdochium patch, anthracnose, brown patch'
                }
            ],
            targets: ['dollarSpot', 'fusarium', 'anthracnose', 'brownPatch'],
            systemic: true,
            mode: 'Succinate dehydrogenase inhibitor (SDHI)'
        },
        boscalid: {
            frac: 7,
            products: [
                { 
                    trade: 'Signum', 
                    kemi: 'Reg 4963', 
                    rate: '1.5 kg/ha', 
                    interval: '14-28', 
                    notes: 'Tees, greens, collars. With pyraclostrobin (FRAC 11). Dollar spot, snow mold.',
                    diseases: 'Dollar spot, snow mold, Microdochium patch'
                }
            ],
            targets: ['dollarSpot', 'snowMold', 'fusarium'],
            systemic: true,
            mode: 'Succinate dehydrogenase inhibitor (SDHI)'
        },

        // ───────────────────────────────────────────────────────────────────────
        // FRAC GROUP 11 - QoI Fungicides (Strobilurins)
        // ───────────────────────────────────────────────────────────────────────
        azoxystrobin: {
            frac: 11,
            products: [
                { 
                    trade: 'Heritage', 
                    kemi: 'Reg 4515', 
                    rate: '0.6 kg/ha', 
                    interval: '14-28', 
                    notes: 'Tees & greens. General fungal attack prevention.',
                    diseases: 'Brown patch, Pythium, anthracnose, take-all patch'
                },
                { 
                    trade: 'Amistar', 
                    kemi: 'Reg 4489', 
                    rate: '1 L/ha', 
                    interval: '14-28', 
                    notes: 'Minor use for root diseases on turf.',
                    diseases: 'Take-all patch, root rot'
                }
            ],
            targets: ['brownPatch', 'pythium', 'anthracnose', 'takeAll'],
            systemic: true,
            mode: 'QoI - Respiration inhibitor (cytochrome bc1)'
        },
        trifloxystrobin: {
            frac: 11,
            products: [
                { 
                    trade: 'Exteris StressGard', 
                    kemi: 'Reg 5612', 
                    rate: '10 L/ha', 
                    interval: '14-28', 
                    notes: 'With fluopyram (FRAC 7)',
                    diseases: 'Dollar spot, Microdochium patch, brown patch'
                },
                { 
                    trade: 'Delaro SC 325', 
                    kemi: 'Reg 5489', 
                    rate: '1 L/ha', 
                    interval: '14-28', 
                    notes: 'With prothioconazole (FRAC 3)',
                    diseases: 'Microdochium patch'
                }
            ],
            targets: ['fusarium', 'dollarSpot', 'brownPatch'],
            systemic: true,
            mode: 'QoI - Respiration inhibitor (cytochrome bc1)'
        },
        pyraclostrobin: {
            frac: 11,
            products: [
                { 
                    trade: 'Signum', 
                    kemi: 'Reg 4963', 
                    rate: '1.5 kg/ha', 
                    interval: '14-28', 
                    notes: 'With boscalid (FRAC 7)',
                    diseases: 'Dollar spot, snow mold, Microdochium patch'
                }
            ],
            targets: ['dollarSpot', 'snowMold', 'fusarium'],
            systemic: true,
            mode: 'QoI - Respiration inhibitor (cytochrome bc1)'
        },

        // ───────────────────────────────────────────────────────────────────────
        // FRAC GROUP 12 - Phenylpyrroles
        // ───────────────────────────────────────────────────────────────────────
        fludioxonil: {
            frac: 12,
            products: [
                { 
                    trade: 'Medallion TL', 
                    kemi: 'Reg 5247', 
                    rate: '3 L/ha', 
                    interval: '14-28', 
                    notes: 'Tees & greens. Premium contact fungicide for Microdochium.',
                    diseases: 'Microdochium patch, anthracnose, red thread'
                },
                { 
                    trade: 'Instrata Elite', 
                    kemi: 'Reg 5483', 
                    rate: '2.5 L/ha', 
                    interval: '14-28', 
                    notes: 'With difenoconazole (FRAC 3)',
                    diseases: 'Microdochium patch, dollar spot, anthracnose'
                }
            ],
            targets: ['fusarium', 'snowMold', 'anthracnose', 'redThread'],
            systemic: false,
            mode: 'MAP/histidine kinase signal transduction'
        },

        // ───────────────────────────────────────────────────────────────────────
        // FRAC GROUP 33 - Phosphonates
        // ───────────────────────────────────────────────────────────────────────
        fosetylAl: {
            frac: 33,
            products: [
                { 
                    trade: 'Signature Xtra StressGard', 
                    kemi: 'Reg 5198', 
                    rate: '12 kg/ha', 
                    interval: '14-28', 
                    notes: 'Tees & greens. Snow mold prevention, anthracnose control.',
                    diseases: 'Pythium, snow mold, anthracnose'
                }
            ],
            targets: ['pythium', 'snowMold', 'anthracnose'],
            systemic: true,
            mode: 'Phosphonate - Host defense induction'
        },

        // ───────────────────────────────────────────────────────────────────────
        // BIOLOGICALS (FRAC BM02)
        // ───────────────────────────────────────────────────────────────────────
        streptomycesK61: {
            frac: 'BM02',
            products: [
                { 
                    trade: 'Mycostop', 
                    kemi: 'Reg 4821', 
                    rate: '5 g/m²', 
                    interval: '7-14', 
                    notes: 'Short-mown turf <15mm, greens. Streptomyces griseoviridis K61.',
                    diseases: 'General fungal attack, Fusarium, Pythium, Rhizoctonia'
                }
            ],
            targets: ['fusarium', 'pythium', 'rhizoctonia'],
            systemic: false,
            mode: 'Biological - Streptomyces griseoviridis K61'
        },
        clonostachysJ1446: {
            frac: 'BM02',
            products: [
                { 
                    trade: 'Prestop', 
                    kemi: 'Reg 4732', 
                    rate: '5 g/m²', 
                    interval: '7-14', 
                    notes: 'Short-mown turf <15mm, greens. Clonostachys rosea J1446.',
                    diseases: 'Fusarium, Pythium, Botrytis'
                }
            ],
            targets: ['fusarium', 'pythium', 'botrytis'],
            systemic: false,
            mode: 'Biological - Clonostachys rosea J1446'
        },
        trichodermaT22: {
            frac: 'BM02',
            products: [
                { 
                    trade: 'Trianum-P', 
                    kemi: 'Reg 4912', 
                    rate: '3 kg/ha', 
                    interval: '7-14', 
                    notes: 'General turf applications. Trichoderma harzianum T-22.',
                    diseases: 'Fusarium, Pythium, Sclerotinia, Rhizoctonia'
                }
            ],
            targets: ['fusarium', 'pythium', 'sclerotinia', 'rhizoctonia'],
            systemic: false,
            mode: 'Biological - Trichoderma harzianum T-22'
        },
        bacillusFZB24: {
            frac: 'BM02',
            products: [
                { 
                    trade: 'Taegro', 
                    kemi: 'Reg 5389', 
                    rate: '0.37 kg/ha', 
                    interval: '7-14', 
                    notes: 'Greens, tees, collars. Bacillus amyloliquefaciens FZB24.',
                    diseases: 'Fusarium, Pythium, Rhizoctonia'
                }
            ],
            targets: ['fusarium', 'pythium', 'rhizoctonia'],
            systemic: false,
            mode: 'Biological - Bacillus amyloliquefaciens FZB24'
        }
    };

    // Disease name mapping for Sweden
    const SWEDEN_DISEASE_NAMES = {
        fusarium: 'Microdochium-fläck / Snömögel',
        snowMold: 'Snömögel (Microdochium/Typhula)',
        dollarSpot: 'Dollarfläck',
        anthracnose: 'Antraknos',
        brownPatch: 'Brunfläcksjuka',
        redThread: 'Rödtrådsjuka',
        pythium: 'Pythium-röta',
        takeAll: 'Rotröta',
        sclerotinia: 'Sclerotinia-sjuka',
        rhizoctonia: 'Rhizoctonia-röta'
    };


    // ═══════════════════════════════════════════════════════════════════════════
    // DENMARK (DANISH EPA BMD) FUNGICIDE DATABASE
    // Source: Miljøstyrelsen Bekæmpelsesmiddeldatabase (BMD) 2024
    // Danish Golf Union (DGU) approved products and minor-use permits
    // ═══════════════════════════════════════════════════════════════════════════
    
    const FUNGICIDES_DENMARK = {
        // ───────────────────────────────────────────────────────────────────────
        // FRAC GROUP 3 - DMI Fungicides (Triazoles)
        // ───────────────────────────────────────────────────────────────────────
        prothioconazole: {
            frac: 3,
            products: [
                { 
                    trade: 'Proline EC 250', 
                    bmd: 'Reg-nr 560-37', 
                    rate: '0.8 L/ha', 
                    interval: '14-28', 
                    notes: 'Minor use permit for turf. Snow mold prevention.',
                    diseases: 'Microdochium patch, Typhula spp.'
                }
            ],
            targets: ['fusarium', 'snowMold'],
            systemic: true,
            mode: 'Sterol synthesis inhibitor (C14-demethylase)'
        },
        difenoconazole: {
            frac: 3,
            products: [
                { 
                    trade: 'Ascernity', 
                    bmd: 'Reg-nr 1-314', 
                    rate: '3 L/ha', 
                    interval: '14-28', 
                    notes: 'With benzovindiflupyr. Golf greens, tees, sports turf.',
                    diseases: 'Microdochium patch, dollar spot, anthracnose, brown patch'
                },
                { 
                    trade: 'Instrata Elite', 
                    bmd: 'Reg-nr 1-297', 
                    rate: '2.5 L/ha', 
                    interval: '14-28', 
                    notes: 'With fludioxonil. Premium disease control.',
                    diseases: 'Microdochium patch, dollar spot, anthracnose'
                }
            ],
            targets: ['fusarium', 'dollarSpot', 'anthracnose', 'brownPatch'],
            systemic: true,
            mode: 'Sterol synthesis inhibitor (C14-demethylase)'
        },

        // ───────────────────────────────────────────────────────────────────────
        // FRAC GROUP 7 - SDHI Fungicides
        // ───────────────────────────────────────────────────────────────────────
        boscalid: {
            frac: 7,
            products: [
                { 
                    trade: 'Signum', 
                    bmd: 'Reg-nr 1-213', 
                    rate: '1.5 kg/ha', 
                    interval: '14-28', 
                    notes: 'Minor use permit. With pyraclostrobin. Dollar spot control.',
                    diseases: 'Dollar spot, Microdochium patch'
                }
            ],
            targets: ['dollarSpot', 'fusarium'],
            systemic: true,
            mode: 'Succinate dehydrogenase inhibitor (SDHI)'
        },
        benzovindiflupyr: {
            frac: 7,
            products: [
                { 
                    trade: 'Ascernity', 
                    bmd: 'Reg-nr 1-314', 
                    rate: '3 L/ha', 
                    interval: '14-28', 
                    notes: 'With difenoconazole. Golf and sports turf.',
                    diseases: 'Dollar spot, Microdochium patch, anthracnose'
                }
            ],
            targets: ['dollarSpot', 'fusarium', 'anthracnose'],
            systemic: true,
            mode: 'Succinate dehydrogenase inhibitor (SDHI)'
        },

        // ───────────────────────────────────────────────────────────────────────
        // FRAC GROUP 9 - Anilinopyrimidines
        // ───────────────────────────────────────────────────────────────────────
        cyprodinil: {
            frac: 9,
            products: [
                { 
                    trade: 'Switch 62.5 WG', 
                    bmd: 'Reg-nr 18-578', 
                    rate: '1 kg/ha', 
                    interval: '14-28', 
                    notes: 'Minor use permit. With fludioxonil. Snow mold prevention.',
                    diseases: 'Snow mold, Microdochium patch'
                }
            ],
            targets: ['snowMold', 'fusarium'],
            systemic: true,
            mode: 'Amino acid synthesis inhibitor'
        },

        // ───────────────────────────────────────────────────────────────────────
        // FRAC GROUP 12 - Phenylpyrroles
        // ───────────────────────────────────────────────────────────────────────
        fludioxonil: {
            frac: 12,
            products: [
                { 
                    trade: 'Medallion TL', 
                    bmd: 'Reg-nr 1-254', 
                    rate: '3 L/ha', 
                    interval: '14-28', 
                    notes: 'Tees, greens, sports turf. Snow mold, anthracnose, red thread.',
                    diseases: 'Microdochium patch, anthracnose, red thread'
                },
                { 
                    trade: 'Switch 62.5 WG', 
                    bmd: 'Reg-nr 18-578', 
                    rate: '1 kg/ha', 
                    interval: '14-28', 
                    notes: 'With cyprodinil. Minor use.',
                    diseases: 'Snow mold, Microdochium patch'
                },
                { 
                    trade: 'Instrata Elite', 
                    bmd: 'Reg-nr 1-297', 
                    rate: '2.5 L/ha', 
                    interval: '14-28', 
                    notes: 'With difenoconazole.',
                    diseases: 'Microdochium patch, dollar spot, anthracnose'
                }
            ],
            targets: ['fusarium', 'snowMold', 'anthracnose', 'redThread'],
            systemic: false,
            mode: 'MAP/histidine kinase signal transduction'
        },

        // ───────────────────────────────────────────────────────────────────────
        // BIOLOGICALS (FRAC BM02)
        // ───────────────────────────────────────────────────────────────────────
        streptomycesK61: {
            frac: 'BM02',
            products: [
                { 
                    trade: 'Mycostop WP', 
                    bmd: 'Reg-nr 560-42', 
                    rate: '5 g/m²', 
                    interval: '7-14', 
                    notes: 'Minor use for turf. Streptomyces griseoviridis K61.',
                    diseases: 'General fungal attacks'
                }
            ],
            targets: ['fusarium', 'pythium', 'rhizoctonia'],
            systemic: false,
            mode: 'Biological - Streptomyces griseoviridis K61'
        },
        clonostachysJ1446: {
            frac: 'BM02',
            products: [
                { 
                    trade: 'Prestop WP', 
                    bmd: 'Reg-nr 560-41', 
                    rate: '5 g/m²', 
                    interval: '7-14', 
                    notes: 'Minor use. Clonostachys rosea J1446.',
                    diseases: 'Fusarium, Pythium'
                },
                { 
                    trade: 'Lalstop G46 WG', 
                    bmd: 'Reg-nr 1-356', 
                    rate: '2 kg/ha', 
                    interval: '7-14', 
                    notes: 'Minor use permit. Fusarium, Rhizoctonia, Pythium control.',
                    diseases: 'Fusarium, Rhizoctonia, Pythium'
                }
            ],
            targets: ['fusarium', 'pythium', 'rhizoctonia'],
            systemic: false,
            mode: 'Biological - Clonostachys rosea J1446'
        },
        trichodermaT22: {
            frac: 'BM02',
            products: [
                { 
                    trade: 'Trianum-P', 
                    bmd: 'Reg-nr 560-39', 
                    rate: '3 kg/ha', 
                    interval: '7-14', 
                    notes: 'Established turf. Trichoderma harzianum T-22.',
                    diseases: 'Sclerotinia, Fusarium, Pythium'
                },
                { 
                    trade: 'Trianum-G', 
                    bmd: 'Reg-nr 560-40', 
                    rate: '3 kg/ha', 
                    interval: '7-14', 
                    notes: 'Granular form for turf.',
                    diseases: 'Sclerotinia, Fusarium, Pythium'
                }
            ],
            targets: ['fusarium', 'pythium', 'sclerotinia'],
            systemic: false,
            mode: 'Biological - Trichoderma harzianum T-22'
        },
        harmonix: {
            frac: 'BM02',
            products: [
                { 
                    trade: 'Harmonix Turf Defense', 
                    bmd: 'Reg-nr 1-342', 
                    rate: 'As label', 
                    interval: '7-14', 
                    notes: 'Golf and sports turf. Snow mold, anthracnose, dollar spot.',
                    diseases: 'Snow mold, anthracnose, dollar spot'
                }
            ],
            targets: ['snowMold', 'anthracnose', 'dollarSpot'],
            systemic: false,
            mode: 'Biological'
        }
    };

    // Disease name mapping for Denmark
    const DENMARK_DISEASE_NAMES = {
        fusarium: 'Microdochium-plet / Sneskimmel',
        snowMold: 'Sneskimmel (Microdochium/Typhula)',
        dollarSpot: 'Dollarspot',
        anthracnose: 'Anthraknose',
        brownPatch: 'Brun pletsyge',
        redThread: 'Rød tråd',
        pythium: 'Pythium-råd',
        takeAll: 'Græsmarksyge',
        sclerotinia: 'Sclerotinia-svamp'
    };


    // ═══════════════════════════════════════════════════════════════════════════
    // NORWAY (MATTILSYNET) FUNGICIDE DATABASE
    // Source: Mattilsynet plantevernmidler database 2024
    // Norwegian greenkeeper associations (Gressforum)
    // ═══════════════════════════════════════════════════════════════════════════
    
    const FUNGICIDES_NORWAY = {
        // ───────────────────────────────────────────────────────────────────────
        // FRAC GROUP 3 - DMI Fungicides (Triazoles)
        // ───────────────────────────────────────────────────────────────────────
        difenoconazole: {
            frac: 3,
            products: [
                { 
                    trade: 'Ascernity', 
                    mattilsynet: '2023.2.25', 
                    rate: '3 L/ha', 
                    interval: '14-28', 
                    notes: 'With benzovindiflupyr. Microdochium, brown patch, anthracnose, dollar spot.',
                    diseases: 'Microdochium patch, brown patch, anthracnose, dollar spot',
                    expiryDate: '2027-03-15'
                },
                { 
                    trade: 'Revus Top', 
                    mattilsynet: '2017.13.25', 
                    rate: '0.6 L/ha', 
                    interval: '7-14', 
                    notes: 'With mandipropamid. Minor use applications.',
                    diseases: 'Pythium, root diseases',
                    expiryDate: '2027-03-15'
                }
            ],
            targets: ['fusarium', 'brownPatch', 'anthracnose', 'dollarSpot', 'pythium'],
            systemic: true,
            mode: 'Sterol synthesis inhibitor (C14-demethylase)'
        },
        prothioconazole: {
            frac: 3,
            products: [
                { 
                    trade: 'Delaro SC 325', 
                    mattilsynet: '2009.3.24', 
                    rate: '1 L/ha', 
                    interval: '14-28', 
                    notes: 'With trifloxystrobin. Microdochium patch control.',
                    diseases: 'Microdochium patch, snow mold',
                    expiryDate: '2026-08-15'
                },
                { 
                    trade: 'Proline EC 250', 
                    mattilsynet: '2007.126.22', 
                    rate: '0.8 L/ha', 
                    interval: '14-28', 
                    notes: 'Off-label use for turf. Snow mold prevention.',
                    diseases: 'Microdochium patch, Typhula',
                    expiryDate: '2026-08-15'
                }
            ],
            targets: ['fusarium', 'snowMold'],
            systemic: true,
            mode: 'Sterol synthesis inhibitor (C14-demethylase)'
        },

        // ───────────────────────────────────────────────────────────────────────
        // FRAC GROUP 7 - SDHI Fungicides
        // ───────────────────────────────────────────────────────────────────────
        benzovindiflupyr: {
            frac: 7,
            products: [
                { 
                    trade: 'Ascernity', 
                    mattilsynet: '2023.2.25', 
                    rate: '3 L/ha', 
                    interval: '14-28', 
                    notes: 'With difenoconazole. Golf and amenity turf.',
                    diseases: 'Dollar spot, Microdochium patch, anthracnose, brown patch',
                    expiryDate: '2027-03-15'
                }
            ],
            targets: ['dollarSpot', 'fusarium', 'anthracnose', 'brownPatch'],
            systemic: true,
            mode: 'Succinate dehydrogenase inhibitor (SDHI)'
        },

        // ───────────────────────────────────────────────────────────────────────
        // FRAC GROUP 11 - QoI Fungicides (Strobilurins)
        // ───────────────────────────────────────────────────────────────────────
        azoxystrobin: {
            frac: 11,
            products: [
                { 
                    trade: 'Amistar', 
                    mattilsynet: '2008.57.14', 
                    rate: '1 L/ha', 
                    interval: '14-28', 
                    notes: 'Minor use for root diseases on turf. Take-all patch.',
                    diseases: 'Take-all patch, root diseases',
                    expiryDate: '2028-05-31'
                }
            ],
            targets: ['takeAll', 'pythium', 'anthracnose'],
            systemic: true,
            mode: 'QoI - Respiration inhibitor (cytochrome bc1)'
        },
        trifloxystrobin: {
            frac: 11,
            products: [
                { 
                    trade: 'Delaro SC 325', 
                    mattilsynet: '2009.3.24', 
                    rate: '1 L/ha', 
                    interval: '14-28', 
                    notes: 'With prothioconazole. Microdochium control.',
                    diseases: 'Microdochium patch, snow mold',
                    expiryDate: '2026-08-15'
                }
            ],
            targets: ['fusarium', 'snowMold'],
            systemic: true,
            mode: 'QoI - Respiration inhibitor (cytochrome bc1)'
        },

        // ───────────────────────────────────────────────────────────────────────
        // FRAC GROUP 12 - Phenylpyrroles
        // ───────────────────────────────────────────────────────────────────────
        fludioxonil: {
            frac: 12,
            products: [
                { 
                    trade: 'Medallion TL', 
                    mattilsynet: '2014.43.17', 
                    rate: '3 L/ha', 
                    interval: '14-28', 
                    notes: 'Premium Microdochium control. Golf greens and tees.',
                    diseases: 'Microdochium patch, brown patch, anthracnose',
                    expiryDate: '2026-06-15'
                }
            ],
            targets: ['fusarium', 'brownPatch', 'anthracnose'],
            systemic: false,
            mode: 'MAP/histidine kinase signal transduction'
        },

        // ───────────────────────────────────────────────────────────────────────
        // BIOLOGICALS (FRAC BM02)
        // ───────────────────────────────────────────────────────────────────────
        clonostachysJ1446: {
            frac: 'BM02',
            products: [
                { 
                    trade: 'Lalstop G46 WG', 
                    mattilsynet: '2025.4', 
                    rate: '2 kg/ha', 
                    interval: '7-14', 
                    notes: 'Clonostachys rosea J1446. Minor use for Fusarium, Rhizoctonia, Pythium.',
                    diseases: 'Fusarium, Rhizoctonia, Pythium',
                    expiryDate: '2035-03-31'
                }
            ],
            targets: ['fusarium', 'pythium', 'rhizoctonia'],
            systemic: false,
            mode: 'Biological - Clonostachys rosea J1446'
        },
        bacillusQST713: {
            frac: 'BM02',
            products: [
                { 
                    trade: 'Serenade ASO', 
                    mattilsynet: '2017.14.22', 
                    rate: 'As label', 
                    interval: '7-14', 
                    notes: 'Bacillus amyloliquefaciens QST 713. Minor use for turf.',
                    diseases: 'Fusarium, Pythium, Rhizoctonia',
                    expiryDate: '2026-04-30'
                }
            ],
            targets: ['fusarium', 'pythium', 'rhizoctonia'],
            systemic: false,
            mode: 'Biological - Bacillus amyloliquefaciens QST 713'
        },
        bacillusFZB24: {
            frac: 'BM02',
            products: [
                { 
                    trade: 'Taegro', 
                    mattilsynet: '2025.7', 
                    rate: '0.37 kg/ha', 
                    interval: '7-14', 
                    notes: 'Bacillus amyloliquefaciens FZB24. Minor use for turf diseases.',
                    diseases: 'Fusarium, Pythium, Rhizoctonia',
                    expiryDate: '2033-06-01'
                }
            ],
            targets: ['fusarium', 'pythium', 'rhizoctonia'],
            systemic: false,
            mode: 'Biological - Bacillus amyloliquefaciens FZB24'
        }
    };

    // Disease name mapping for Norway
    const NORWAY_DISEASE_NAMES = {
        fusarium: 'Microdochium-flekk / Snømugg',
        snowMold: 'Snømugg (Microdochium/Typhula)',
        dollarSpot: 'Dollarflekk',
        anthracnose: 'Antraknose',
        brownPatch: 'Brunflekk',
        redThread: 'Rød tråd',
        pythium: 'Pythium-råte',
        takeAll: 'Gressmarksyke',
        rhizoctonia: 'Rhizoctonia-råte'
    };


    // ═══════════════════════════════════════════════════════════════════════════
    // JAPAN (MAFF) EXPANDED FUNGICIDE DATABASE
    // Source: MAFF 農薬登録情報提供システム 2024
    // Query by: 芝 (turf), 西洋芝 (western turf), 日本芝 (Japanese turf)
    // 適用病害虫名 (registered pest/disease claims)
    // ═══════════════════════════════════════════════════════════════════════════
    
    const FUNGICIDES_JAPAN_EXPANDED = {
        // ───────────────────────────────────────────────────────────────────────
        // FRAC GROUP 1 - Benzimidazoles (MBC Fungicides)
        // ───────────────────────────────────────────────────────────────────────
        benomyl: {
            frac: 1,
            products: [
                { 
                    trade: '緑化用ベンレート水和剤', 
                    tradeName_en: 'Benlate WP (Turf)', 
                    maff: 'MAFF Reg', 
                    rate: '1-2 g/m²', 
                    interval: '14-21', 
                    turfType: '西洋芝 (ベントグラス、ケンタッキーブルーグラス)',
                    diseases_jp: '葉腐病（ブラウンパッチ）、ダラースポット、炭疽病、紅色雪腐病',
                    diseases: 'Brown patch, dollar spot, anthracnose, pink snow mold'
                }
            ],
            targets: ['brownPatch', 'dollarSpot', 'anthracnose', 'snowMold'],
            systemic: true,
            mode: 'Mitosis inhibitor (beta-tubulin assembly)'
        },
        thiophanateMethyl: {
            frac: 1,
            products: [
                { 
                    trade: 'トップジンM水和剤', 
                    tradeName_en: 'Topsin-M WP', 
                    maff: 'MAFF 17236', 
                    rate: '1-2 g/m²', 
                    interval: '14-21', 
                    turfType: '日本芝、西洋芝',
                    diseases_jp: 'ラージパッチ、葉腐病、炭疽病、さび病',
                    diseases: 'Large patch, brown patch, anthracnose, rust'
                }
            ],
            targets: ['largePatch', 'brownPatch', 'anthracnose', 'rust'],
            systemic: true,
            mode: 'Mitosis inhibitor (beta-tubulin assembly)'
        },

        // ───────────────────────────────────────────────────────────────────────
        // FRAC GROUP 3 - DMI Fungicides (Triazoles)
        // ───────────────────────────────────────────────────────────────────────
        metconazole: {
            frac: 3,
            products: [
                { 
                    trade: '芝美人フロアブル', 
                    tradeName_en: 'Shibabijin FL', 
                    maff: 'MAFF 23456', 
                    rate: '0.5-1 L/ha', 
                    interval: '14-21', 
                    turfType: '西洋芝 (ベントグラス)',
                    diseases_jp: 'ダラースポット、炭疽病、葉腐病、フェアリーリング、雪腐病',
                    diseases: 'Dollar spot, anthracnose, brown patch, fairy ring, snow mold'
                },
                { 
                    trade: 'エーツージー', 
                    tradeName_en: 'ATG', 
                    maff: 'MAFF 23891', 
                    rate: '0.5-1 L/ha', 
                    interval: '14-21', 
                    turfType: '日本芝 (コウライシバ、ノシバ)',
                    diseases_jp: 'ラージパッチ、疑似葉腐病、ネクロティックリングスポット、カーブラリア葉枯病',
                    diseases: 'Large patch, spring dead spot, necrotic ring spot, Curvularia leaf blight',
                    notes: 'With flametopyl (FRAC U18). Zoysia specialist.'
                },
                { 
                    trade: 'トップバスター顆粒水和剤', 
                    tradeName_en: 'Top Buster GW', 
                    maff: 'MAFF 24102', 
                    rate: '1-2 g/m²', 
                    interval: '14-21', 
                    turfType: '西洋芝 (ベントグラス)',
                    diseases_jp: 'ダラースポット、葉腐病',
                    diseases: 'Dollar spot, brown patch'
                }
            ],
            targets: ['dollarSpot', 'anthracnose', 'brownPatch', 'fairyRing', 'snowMold', 'largePatch', 'springDeadSpot', 'necroticRingSpot', 'curvularia'],
            systemic: true,
            mode: 'Sterol synthesis inhibitor (C14-demethylase)'
        },
        tebuconazole: {
            frac: 3,
            products: [
                { 
                    trade: 'パノラマフロアブル', 
                    tradeName_en: 'Panorama FL', 
                    maff: 'MAFF 22789', 
                    rate: '0.5-1 L/ha', 
                    interval: '14-21', 
                    turfType: '西洋芝 (ベントグラス、ケンタッキーブルーグラス)',
                    diseases_jp: '雪腐病、ダラースポット',
                    diseases: 'Snow mold, dollar spot'
                },
                { 
                    trade: 'シバリオン水和剤', 
                    tradeName_en: 'Shibarion WP', 
                    maff: 'MAFF 21567', 
                    rate: '1-2 g/m²', 
                    interval: '14-21', 
                    turfType: '日本芝、西洋芝',
                    diseases_jp: 'ラージパッチ、ダラースポット、炭疽病',
                    diseases: 'Large patch, dollar spot, anthracnose'
                }
            ],
            targets: ['snowMold', 'dollarSpot', 'largePatch', 'anthracnose'],
            systemic: true,
            mode: 'Sterol synthesis inhibitor (C14-demethylase)'
        },
        propiconazole: {
            frac: 3,
            products: [
                { 
                    trade: 'バナーマックス液剤', 
                    tradeName_en: 'Banner Maxx', 
                    maff: 'MAFF 20456', 
                    rate: '0.5-1 L/ha', 
                    interval: '14-21', 
                    turfType: '西洋芝、日本芝',
                    diseases_jp: 'ダラースポット、葉腐病、炭疽病、疑似葉腐病',
                    diseases: 'Dollar spot, brown patch, anthracnose, spring dead spot'
                }
            ],
            targets: ['dollarSpot', 'brownPatch', 'anthracnose', 'springDeadSpot'],
            systemic: true,
            mode: 'Sterol synthesis inhibitor (C14-demethylase)'
        },

        // ───────────────────────────────────────────────────────────────────────
        // FRAC GROUP 7 - SDHI Fungicides
        // ───────────────────────────────────────────────────────────────────────
        penthiopyrad: {
            frac: 7,
            products: [
                { 
                    trade: 'アフェットフロアブル', 
                    tradeName_en: 'Affet FL', 
                    maff: 'MAFF 23678', 
                    rate: '0.5-1 L/ha', 
                    interval: '14-21', 
                    turfType: '西洋芝 (ベントグラス)',
                    diseases_jp: 'ダラースポット、葉腐病、炭疽病',
                    diseases: 'Dollar spot, brown patch, anthracnose'
                }
            ],
            targets: ['dollarSpot', 'brownPatch', 'anthracnose'],
            systemic: true,
            mode: 'Succinate dehydrogenase inhibitor (SDHI)'
        },
        fluxapyroxad: {
            frac: 7,
            products: [
                { 
                    trade: 'セルカディス フロアブル', 
                    tradeName_en: 'Sercadis FL', 
                    maff: 'MAFF 24234', 
                    rate: '0.3-0.5 L/ha', 
                    interval: '14-28', 
                    turfType: '西洋芝',
                    diseases_jp: 'ダラースポット、葉腐病',
                    diseases: 'Dollar spot, brown patch'
                }
            ],
            targets: ['dollarSpot', 'brownPatch'],
            systemic: true,
            mode: 'Succinate dehydrogenase inhibitor (SDHI)'
        },

        // ───────────────────────────────────────────────────────────────────────
        // FRAC GROUP 11 - QoI Fungicides (Strobilurins)
        // ───────────────────────────────────────────────────────────────────────
        azoxystrobin: {
            frac: 11,
            products: [
                { 
                    trade: 'ヘリテージ顆粒水和剤', 
                    tradeName_en: 'Heritage GW', 
                    maff: 'MAFF 21234', 
                    rate: '0.6 kg/ha', 
                    interval: '14-28', 
                    turfType: '西洋芝、日本芝',
                    diseases_jp: '葉腐病、炭疽病、ピシウム病、疑似葉腐病',
                    diseases: 'Brown patch, anthracnose, Pythium, spring dead spot'
                }
            ],
            targets: ['brownPatch', 'anthracnose', 'pythium', 'springDeadSpot'],
            systemic: true,
            mode: 'QoI - Respiration inhibitor (cytochrome bc1)'
        },
        pyraclostrobin: {
            frac: 11,
            products: [
                { 
                    trade: 'カービータフロアブル', 
                    tradeName_en: 'Caberta FL', 
                    maff: 'MAFF 22891', 
                    rate: '0.5-1 L/ha', 
                    interval: '14-21', 
                    turfType: '西洋芝 (ベントグラス)',
                    diseases_jp: 'ダラースポット、葉腐病、炭疽病',
                    diseases: 'Dollar spot, brown patch, anthracnose'
                }
            ],
            targets: ['dollarSpot', 'brownPatch', 'anthracnose'],
            systemic: true,
            mode: 'QoI - Respiration inhibitor (cytochrome bc1)'
        },
        trifloxystrobin: {
            frac: 11,
            products: [
                { 
                    trade: 'フリント フロアブル25', 
                    tradeName_en: 'Flint FL 25', 
                    maff: 'MAFF 21678', 
                    rate: '0.5-1 L/ha', 
                    interval: '14-21', 
                    turfType: '西洋芝',
                    diseases_jp: '葉腐病、炭疽病、さび病',
                    diseases: 'Brown patch, anthracnose, rust'
                }
            ],
            targets: ['brownPatch', 'anthracnose', 'rust'],
            systemic: true,
            mode: 'QoI - Respiration inhibitor (cytochrome bc1)'
        },

        // ───────────────────────────────────────────────────────────────────────
        // FRAC GROUP 17 - Ferimzone (Pyrimidinamine)
        // Japan-specific chemistry
        // ───────────────────────────────────────────────────────────────────────
        ferimzone: {
            frac: 17,
            products: [
                { 
                    trade: '住化トルファン', 
                    tradeName_en: 'Sumika Torfan', 
                    maff: 'MAFF 19234', 
                    rate: '1-2 g/m²', 
                    interval: '14-21', 
                    turfType: '日本芝、西洋芝',
                    diseases_jp: 'ラージパッチ、葉腐病、炭疽病、ヘルミントスポリウム葉枯病、カーブラリア葉枯病',
                    diseases: 'Large patch, brown patch, anthracnose, Helminthosporium, Curvularia',
                    notes: 'With validamycin (FRAC 24). Traditional Japanese turf product.'
                }
            ],
            targets: ['largePatch', 'brownPatch', 'anthracnose', 'helminthosporium', 'curvularia'],
            systemic: true,
            mode: 'Sterol synthesis (non-DMI site)'
        },

        // ───────────────────────────────────────────────────────────────────────
        // FRAC GROUP 24 - Validamycin (Trehalase Inhibitor)
        // Japan-specific chemistry
        // ───────────────────────────────────────────────────────────────────────
        validamycin: {
            frac: 24,
            products: [
                { 
                    trade: '住化トルファン', 
                    tradeName_en: 'Sumika Torfan', 
                    maff: 'MAFF 19234', 
                    rate: '1-2 g/m²', 
                    interval: '14-21', 
                    turfType: '日本芝、西洋芝',
                    diseases_jp: 'ラージパッチ、葉腐病、炭疽病、ヘルミントスポリウム葉枯病、カーブラリア葉枯病',
                    diseases: 'Large patch, brown patch, anthracnose, Helminthosporium, Curvularia',
                    notes: 'With ferimzone. Japanese antibiotic fungicide.'
                },
                { 
                    trade: 'バリダシン液剤5', 
                    tradeName_en: 'Validacin 5', 
                    maff: 'MAFF 18456', 
                    rate: '1-2 L/ha', 
                    interval: '14-21', 
                    turfType: '日本芝',
                    diseases_jp: 'ラージパッチ、葉腐病',
                    diseases: 'Large patch, brown patch'
                }
            ],
            targets: ['largePatch', 'brownPatch', 'anthracnose', 'helminthosporium', 'curvularia'],
            systemic: true,
            mode: 'Trehalase inhibitor'
        },

        // ───────────────────────────────────────────────────────────────────────
        // FRAC GROUP U18 - Flametopyl (Unknown mechanism)
        // Japan-specific chemistry for Zoysia diseases
        // ───────────────────────────────────────────────────────────────────────
        flametopyl: {
            frac: 'U18',
            products: [
                { 
                    trade: 'エーツージー', 
                    tradeName_en: 'ATG', 
                    maff: 'MAFF 23891', 
                    rate: '0.5-1 L/ha', 
                    interval: '14-21', 
                    turfType: '日本芝 (コウライシバ、ノシバ)',
                    diseases_jp: 'ラージパッチ、疑似葉腐病、ネクロティックリングスポット、カーブラリア葉枯病',
                    diseases: 'Large patch, spring dead spot, necrotic ring spot, Curvularia',
                    notes: 'With metconazole. Zoysia specialist product.'
                }
            ],
            targets: ['largePatch', 'springDeadSpot', 'necroticRingSpot', 'curvularia'],
            systemic: true,
            mode: 'Unknown mechanism (cell membrane target proposed)'
        },

        // ───────────────────────────────────────────────────────────────────────
        // MULTI-SITE / COMBINATION PRODUCTS
        // ───────────────────────────────────────────────────────────────────────
        dogurin: {
            frac: 'M',
            products: [
                { 
                    trade: 'ドウグリン水和剤', 
                    tradeName_en: 'Dogurin WP', 
                    maff: 'MAFF 17891', 
                    rate: '2-4 g/m²', 
                    interval: '14-21', 
                    turfType: '西洋芝 (ベントグラス)',
                    diseases_jp: '雪腐病、葉腐病',
                    diseases: 'Snow mold, brown patch'
                }
            ],
            targets: ['snowMold', 'brownPatch'],
            systemic: false,
            mode: 'Multi-site contact'
        },
        honorWDG: {
            frac: 'M',
            products: [
                { 
                    trade: 'オナーWDG', 
                    tradeName_en: 'Honor WDG', 
                    maff: 'MAFF 22345', 
                    rate: '1-2 g/m²', 
                    interval: '14-21', 
                    turfType: '西洋芝、バミューダグラス、日本芝',
                    diseases_jp: 'ピシウム病、ダラースポット、炭疽病、フェアリーリング、赤焼病、カーブラリア葉枯病',
                    diseases: 'Pythium, dollar spot, anthracnose, fairy ring, red thread, Curvularia'
                }
            ],
            targets: ['pythium', 'dollarSpot', 'anthracnose', 'fairyRing', 'redThread', 'curvularia'],
            systemic: true,
            mode: 'Multi-site combination'
        },
        chlorothalonil: {
            frac: 'M5',
            products: [
                { 
                    trade: 'ダコニール1000', 
                    tradeName_en: 'Daconil 1000', 
                    maff: 'MAFF 16789', 
                    rate: '1-2 L/ha', 
                    interval: '7-14', 
                    turfType: '西洋芝',
                    diseases_jp: 'ダラースポット、葉腐病、炭疽病',
                    diseases: 'Dollar spot, brown patch, anthracnose'
                }
            ],
            targets: ['dollarSpot', 'brownPatch', 'anthracnose'],
            systemic: false,
            mode: 'Multi-site contact (chloronitrile)'
        },

        // ───────────────────────────────────────────────────────────────────────
        // PHOSPHONATES
        // ───────────────────────────────────────────────────────────────────────
        fosetylAl: {
            frac: 33,
            products: [
                { 
                    trade: 'アリエッティ水和剤', 
                    tradeName_en: 'Aliette WP', 
                    maff: 'MAFF 19567', 
                    rate: '2-4 g/m²', 
                    interval: '14-21', 
                    turfType: '西洋芝',
                    diseases_jp: 'ピシウム病、炭疽病',
                    diseases: 'Pythium, anthracnose'
                }
            ],
            targets: ['pythium', 'anthracnose'],
            systemic: true,
            mode: 'Phosphonate - Host defense induction'
        }
    };

    // Expanded disease name mapping for Japan
    const JAPAN_DISEASE_NAMES_EXPANDED = {
        largePatch: 'ラージパッチ (Large Patch)',
        brownPatch: '葉腐病 (Brown Patch)',
        dollarSpot: 'ダラースポット (Dollar Spot)',
        anthracnose: '炭疽病 (Anthracnose)',
        snowMold: '雪腐病 (Snow Mold)',
        pinkSnowMold: '紅色雪腐病 (Pink Snow Mold)',
        springDeadSpot: '疑似葉腐病 (Spring Dead Spot)',
        pythium: 'ピシウム病 (Pythium)',
        fairyRing: 'フェアリーリング (Fairy Ring)',
        helminthosporium: 'ヘルミントスポリウム葉枯病 (Helminthosporium Leaf Blight)',
        curvularia: 'カーブラリア葉枯病 (Curvularia Leaf Blight)',
        necroticRingSpot: 'ネクロティックリングスポット (Necrotic Ring Spot)',
        redThread: '赤焼病 (Red Thread)',
        rust: 'さび病 (Rust)',
        takeAll: '根腐病 (Take-all Patch)'
    };

    // Japanese turf type mapping
    const JAPAN_TURF_TYPES = {
        westernTurf: {
            jp: '西洋芝',
            en: 'Cool-season grasses',
            species: ['ベントグラス (Bentgrass)', 'ケンタッキーブルーグラス (KBG)', 'ペレニアルライグラス (PRG)']
        },
        japaneseTurf: {
            jp: '日本芝',
            en: 'Japanese native grasses (Zoysia)',
            species: ['コウライシバ (Korai)', 'ノシバ (Noshiba)', 'ヒメコウライ (Himekorai)']
        },
        bermuda: {
            jp: 'バミューダグラス',
            en: 'Bermudagrass',
            species: ['ティフトン (Tifton)', 'セレブレーション (Celebration)']
        }
    };


    // ═══════════════════════════════════════════════════════════════════════════
    // HELPER FUNCTIONS
    // ═══════════════════════════════════════════════════════════════════════════

    /**
     * Get fungicide database by country
     */
    function getFungicidesByCountry(countryCode) {
        const databases = {
            'SE': FUNGICIDES_SWEDEN,
            'DK': FUNGICIDES_DENMARK,
            'NO': FUNGICIDES_NORWAY,
            'JP': FUNGICIDES_JAPAN_EXPANDED
        };
        return databases[countryCode.toUpperCase()] || null;
    }

    /**
     * Get disease names by country
     */
    function getDiseaseNamesByCountry(countryCode) {
        const nameMaps = {
            'SE': SWEDEN_DISEASE_NAMES,
            'DK': DENMARK_DISEASE_NAMES,
            'NO': NORWAY_DISEASE_NAMES,
            'JP': JAPAN_DISEASE_NAMES_EXPANDED
        };
        return nameMaps[countryCode.toUpperCase()] || {};
    }

    /**
     * Get fungicide recommendations for a disease in a specific country
     * Includes use category defaults for all Nordic/Japan products
     */
    function getFungicidesForDisease(disease, countryCode) {
        const db = getFungicidesByCountry(countryCode);
        if (!db) return [];

        // Default use restrictions for Nordic/Japan - all professional golf only
        const defaultUseCategory = 'professional';
        const defaultAllowedUses = countryCode.toUpperCase() === 'JP' 
            ? ['golf', 'sportsfield']  // Japan allows both
            : ['golf'];                 // Nordic is golf-only

        const results = [];
        for (const [activeIngredient, data] of Object.entries(db)) {
            if (data.targets && data.targets.includes(disease)) {
                // Apply use category defaults
                const products = data.products.map(p => ({
                    ...p,
                    useCategory: p.useCategory || data.useCategory || defaultUseCategory,
                    allowedUses: p.allowedUses || data.allowedUses || defaultAllowedUses
                }));
                
                results.push({
                    activeIngredient,
                    frac: data.frac,
                    products: products,
                    systemic: data.systemic,
                    mode: data.mode,
                    useCategory: data.useCategory || defaultUseCategory,
                    allowedUses: data.allowedUses || defaultAllowedUses
                });
            }
        }
        return results;
    }

    /**
     * Check product registration expiry (for Norway)
     */
    function isProductExpired(product) {
        if (!product.expiryDate) return false;
        return new Date(product.expiryDate) < new Date();
    }

    /**
     * Get all available Nordic fungicides for a disease
     * Searches Sweden, Denmark, and Norway databases
     */
    function getNordicFungicidesForDisease(disease) {
        const results = {
            sweden: getFungicidesForDisease(disease, 'SE'),
            denmark: getFungicidesForDisease(disease, 'DK'),
            norway: getFungicidesForDisease(disease, 'NO')
        };
        return results;
    }

    /**
     * Apply default use categories to a database
     * Call this when accessing products to ensure useCategory/allowedUses exist
     */
    function applyUseCategoryDefaults(db, countryCode) {
        const defaultUseCategory = 'professional';
        const defaultAllowedUses = countryCode === 'JP' 
            ? ['golf', 'sportsfield'] 
            : ['golf'];
        
        const result = {};
        for (const [ai, data] of Object.entries(db)) {
            result[ai] = {
                ...data,
                useCategory: data.useCategory || defaultUseCategory,
                allowedUses: data.allowedUses || defaultAllowedUses,
                products: data.products.map(p => ({
                    ...p,
                    useCategory: p.useCategory || data.useCategory || defaultUseCategory,
                    allowedUses: p.allowedUses || data.allowedUses || defaultAllowedUses
                }))
            };
        }
        return result;
    }


    // ═══════════════════════════════════════════════════════════════════════════
    // EXPORTS
    // ═══════════════════════════════════════════════════════════════════════════

    const ExtendedRegionalFungicides = {
        version: '1.0.0',
        
        // Databases (with defaults applied on access)
        get FUNGICIDES_SWEDEN() { return applyUseCategoryDefaults(FUNGICIDES_SWEDEN, 'SE'); },
        get FUNGICIDES_DENMARK() { return applyUseCategoryDefaults(FUNGICIDES_DENMARK, 'DK'); },
        get FUNGICIDES_NORWAY() { return applyUseCategoryDefaults(FUNGICIDES_NORWAY, 'NO'); },
        get FUNGICIDES_JAPAN_EXPANDED() { return applyUseCategoryDefaults(FUNGICIDES_JAPAN_EXPANDED, 'JP'); },
        
        // Raw databases (without defaults, for backward compatibility)
        FUNGICIDES_SWEDEN_RAW: FUNGICIDES_SWEDEN,
        FUNGICIDES_DENMARK_RAW: FUNGICIDES_DENMARK,
        FUNGICIDES_NORWAY_RAW: FUNGICIDES_NORWAY,
        FUNGICIDES_JAPAN_EXPANDED_RAW: FUNGICIDES_JAPAN_EXPANDED,
        
        // Disease name mappings
        SWEDEN_DISEASE_NAMES,
        DENMARK_DISEASE_NAMES,
        NORWAY_DISEASE_NAMES,
        JAPAN_DISEASE_NAMES_EXPANDED,
        
        // Japan turf types
        JAPAN_TURF_TYPES,
        
        // Helper functions
        getFungicidesByCountry,
        getDiseaseNamesByCountry,
        getFungicidesForDisease,
        isProductExpired,
        getNordicFungicidesForDisease,
        applyUseCategoryDefaults
    };

    // Export to global
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = ExtendedRegionalFungicides;
    }
    
    global.GAIP_ExtendedRegionalFungicides = ExtendedRegionalFungicides;
    
    // Also add individual databases to global for direct access
    // Apply use category defaults so consumers get complete data
    global.FUNGICIDES_SWEDEN = applyUseCategoryDefaults(FUNGICIDES_SWEDEN, 'SE');
    global.FUNGICIDES_DENMARK = applyUseCategoryDefaults(FUNGICIDES_DENMARK, 'DK');
    global.FUNGICIDES_NORWAY = applyUseCategoryDefaults(FUNGICIDES_NORWAY, 'NO');
    global.FUNGICIDES_JAPAN_EXPANDED = applyUseCategoryDefaults(FUNGICIDES_JAPAN_EXPANDED, 'JP');
    
    global.SWEDEN_DISEASE_NAMES = SWEDEN_DISEASE_NAMES;
    global.DENMARK_DISEASE_NAMES = DENMARK_DISEASE_NAMES;
    global.NORWAY_DISEASE_NAMES = NORWAY_DISEASE_NAMES;
    global.JAPAN_DISEASE_NAMES_EXPANDED = JAPAN_DISEASE_NAMES_EXPANDED;


})(typeof window !== 'undefined' ? window : this);
