/**
 * =============================================================================
 * GILBA EUROPEAN REGIONAL FUNGICIDE DATABASE v1.0.0
 * =============================================================================
 * 
 * Turf fungicide registration data for France, Spain, and Germany
 * 
 * REGIONS COVERED:
 * - France (ANSES E-Phy - Agence nationale de sécurité sanitaire)
 * - Spain (MAPA - Ministerio de Agricultura, Pesca y Alimentación)
 * - Germany (BVL - Bundesamt für Verbraucherschutz und Lebensmittelsicherheit)
 * 
 * SOURCES:
 * - ANSES E-Phy database (ephy.anses.fr) December 2024
 * - MAPA Registro de Productos Fitosanitarios December 2024
 * - BVL §17 PflSchG approved list for golf/sport turf December 2024
 * - DGV (Deutscher Golf Verband) AK IPS approved products list 2024
 * - French law "Loi Labbé" derogation list January 2025
 * 
 * REGULATORY NOTES:
 * - France: Loi Labbé restrictions apply from Jan 2025; 6 disease usages permitted
 *   by derogation for competition sports surfaces (golf greens, fairways, sports pitches)
 * - Spain: Products must have explicit "césped/zonas verdes" registration
 * - Germany: §17 PflSchG governs use on "Flächen für die Allgemeinheit" (public areas)
 *   including golf courses and sports fields; approval via BVL genehmigung required
 * 
 * USE CATEGORIES:
 * - France: Most products require 'derogation' status for professional sports use.
 *           Biocontrol products ('exempt') can be used on all turf including domestic.
 *           NO conventional pesticides permitted on domestic lawns under Loi Labbé.
 * - Germany: §17 products are PROFESSIONAL ONLY (golf, sportsfield).
 *           NO domestic lawn use permitted for §17 approved products.
 * - Spain: Products with 'césped' registration may include amenity; check label.
 * 
 * DISEASE NAME STANDARDIZATION:
 * - Microdochium nivale = Fusarium nivale = Pink snow mold = Fusariose froide
 * - Sclerotinia homoeocarpa = Dollar spot = Maladie du dollar = Dollarflecken
 * - Rhizoctonia solani = Brown patch = Plaque brune = Braunfleckenkrankheit
 * 
 * @author Gilba Solutions
 * @version 1.0.0
 * @requires disease-engine.js
 * @requires extended-regional-fungicides.js
 * =============================================================================
 */

(function(global) {
    'use strict';


    // ═══════════════════════════════════════════════════════════════════════════
    // FRANCE (ANSES E-Phy) FUNGICIDE DATABASE
    // Source: ANSES E-Phy database (ephy.anses.fr) December 2024
    // Regulatory framework: Loi Labbé with January 2025 derogations
    // 
    // IMPORTANT: As of January 2025, France restricts pesticide use on sports turf
    // under Loi Labbé. Competition-grade surfaces (golf greens/tees, professional
    // sports pitches) have a 6-disease derogation for specific treatments.
    // Biocontrol products are exempt from restrictions.
    // 
    // USE CATEGORIES FOR FRANCE:
    // - loiLabbe: 'derogation' = Professional sports only (golf, sportsfield)
    // - loiLabbe: 'exempt' = Biocontrol, can be used on all turf including domestic
    // - NO conventional pesticides on domestic lawns
    // ═══════════════════════════════════════════════════════════════════════════
    
    const FUNGICIDES_FRANCE = {
        // ───────────────────────────────────────────────────────────────────────
        // FRAC GROUP 3 - DMI Fungicides (Triazoles)
        // ───────────────────────────────────────────────────────────────────────
        difenoconazole: {
            frac: 3,
            useCategory: 'professional',
            allowedUses: ['golf', 'sportsfield'],
            products: [
                { 
                    trade: 'Instrata Elite', 
                    amm: '2190895',
                    rate: '2.5 L/ha', 
                    interval: '14-28',
                    loiLabbe: 'derogation',
                    useCategory: 'professional',
                    allowedUses: ['golf', 'sportsfield'],
                    usageType: 'Terrains de sport et terrains de golf',
                    notes: 'Avec fludioxonil (FRAC 12). Dérogation Loi Labbé pour surfaces compétition.',
                    diseases_fr: 'Fusariose froide, dollar spot, anthracnose',
                    diseases: 'Microdochium patch, dollar spot, anthracnose'
                },
                { 
                    trade: 'Ascernity', 
                    amm: '2200145',
                    rate: '3 L/ha', 
                    interval: '14-28',
                    loiLabbe: 'derogation',
                    useCategory: 'professional',
                    allowedUses: ['golf'],
                    usageType: 'Terrains de golf: greens et départs',
                    notes: 'Avec benzovindiflupyr (FRAC 7). Surfaces de compétition uniquement.',
                    diseases_fr: 'Fusariose froide, plaque brune, dollar spot, anthracnose',
                    diseases: 'Microdochium patch, brown patch, dollar spot, anthracnose'
                }
            ],
            targets: ['fusarium', 'dollarSpot', 'brownPatch', 'anthracnose'],
            systemic: true,
            mode: 'Inhibiteur de la synthèse des stérols (C14-déméthylase)'
        },
        tebuconazole: {
            frac: 3,
            useCategory: 'professional',
            allowedUses: ['golf', 'sportsfield'],
            products: [
                { 
                    trade: 'Folicur EW', 
                    amm: '9900472',
                    rate: '1 L/ha', 
                    interval: '14-21',
                    loiLabbe: 'derogation',
                    useCategory: 'professional',
                    allowedUses: ['golf', 'sportsfield'],
                    usageType: 'Gazons de sport',
                    notes: 'Usage autorisé terrains sport. Fusariose, dollar spot.',
                    diseases_fr: 'Fusariose froide, dollar spot',
                    diseases: 'Microdochium patch, dollar spot'
                }
            ],
            targets: ['fusarium', 'dollarSpot'],
            systemic: true,
            mode: 'Inhibiteur de la synthèse des stérols (C14-déméthylase)'
        },
        propiconazole: {
            frac: 3,
            products: [
                { 
                    trade: 'Banner Maxx II', 
                    amm: '2170612',
                    rate: '0.8-1.6 L/ha', 
                    interval: '14-28',
                    loiLabbe: 'derogation',
                    usageType: 'Terrains de golf',
                    notes: 'Large spectre. Greens, départs, fairways.',
                    diseases_fr: 'Fusariose froide, dollar spot, anthracnose, fil rouge',
                    diseases: 'Microdochium patch, dollar spot, anthracnose, red thread'
                }
            ],
            targets: ['fusarium', 'dollarSpot', 'anthracnose', 'redThread'],
            systemic: true,
            mode: 'Inhibiteur de la synthèse des stérols (C14-déméthylase)'
        },

        // ───────────────────────────────────────────────────────────────────────
        // FRAC GROUP 7 - SDHI Fungicides
        // ───────────────────────────────────────────────────────────────────────
        fluopyram: {
            frac: 7,
            products: [
                { 
                    trade: 'Exteris Stressgard', 
                    amm: '2190648',
                    rate: '10 L/ha', 
                    interval: '14-28',
                    loiLabbe: 'derogation',
                    usageType: 'Terrains de golf: greens, départs, collars',
                    notes: 'Avec trifloxystrobin (FRAC 11). Formulation Stressgard.',
                    diseases_fr: 'Dollar spot, fusariose froide',
                    diseases: 'Dollar spot, Microdochium patch'
                }
            ],
            targets: ['dollarSpot', 'fusarium'],
            systemic: true,
            mode: 'Inhibiteur de la succinate déshydrogénase (SDHI)'
        },
        benzovindiflupyr: {
            frac: 7,
            products: [
                { 
                    trade: 'Ascernity', 
                    amm: '2200145',
                    rate: '3 L/ha', 
                    interval: '14-28',
                    loiLabbe: 'derogation',
                    usageType: 'Terrains de golf: greens et départs',
                    notes: 'Combiné avec difenoconazole (FRAC 3).',
                    diseases_fr: 'Fusariose froide, dollar spot, anthracnose, plaque brune',
                    diseases: 'Microdochium patch, dollar spot, anthracnose, brown patch'
                }
            ],
            targets: ['fusarium', 'dollarSpot', 'anthracnose', 'brownPatch'],
            systemic: true,
            mode: 'Inhibiteur de la succinate déshydrogénase (SDHI)'
        },
        boscalid: {
            frac: 7,
            products: [
                { 
                    trade: 'Signum', 
                    amm: '2050081',
                    rate: '1.5 kg/ha', 
                    interval: '14-28',
                    loiLabbe: 'derogation',
                    usageType: 'Gazons de sport',
                    maxApps: 2,
                    notes: 'Avec pyraclostrobin (FRAC 11). Maladies automnales/hivernales.',
                    diseases_fr: 'Dollar spot, fusariose froide',
                    diseases: 'Dollar spot, Microdochium patch'
                }
            ],
            targets: ['dollarSpot', 'fusarium'],
            systemic: true,
            mode: 'Inhibiteur de la succinate déshydrogénase (SDHI)'
        },

        // ───────────────────────────────────────────────────────────────────────
        // FRAC GROUP 11 - QoI Fungicides (Strobilurins)
        // ───────────────────────────────────────────────────────────────────────
        azoxystrobin: {
            frac: 11,
            products: [
                { 
                    trade: 'Heritage', 
                    amm: '9800595',
                    rate: '0.6 kg/ha', 
                    interval: '14-28',
                    loiLabbe: 'derogation',
                    usageType: 'Terrains de golf et sport',
                    notes: 'Large spectre. Greens et départs.',
                    diseases_fr: 'Plaque brune, pythium, anthracnose',
                    diseases: 'Brown patch, Pythium, anthracnose'
                }
            ],
            targets: ['brownPatch', 'pythium', 'anthracnose'],
            systemic: true,
            mode: 'QoI - Inhibiteur de la respiration (cytochrome bc1)'
        },
        trifloxystrobin: {
            frac: 11,
            products: [
                { 
                    trade: 'Exteris Stressgard', 
                    amm: '2190648',
                    rate: '10 L/ha', 
                    interval: '14-28',
                    loiLabbe: 'derogation',
                    usageType: 'Terrains de golf',
                    notes: 'Combiné avec fluopyram (FRAC 7).',
                    diseases_fr: 'Dollar spot, fusariose froide',
                    diseases: 'Dollar spot, Microdochium patch'
                }
            ],
            targets: ['dollarSpot', 'fusarium'],
            systemic: true,
            mode: 'QoI - Inhibiteur de la respiration (cytochrome bc1)'
        },

        // ───────────────────────────────────────────────────────────────────────
        // FRAC GROUP 12 - Phenylpyrroles
        // ───────────────────────────────────────────────────────────────────────
        fludioxonil: {
            frac: 12,
            products: [
                { 
                    trade: 'Instrata Elite', 
                    amm: '2190895',
                    rate: '2.5 L/ha', 
                    interval: '14-28',
                    loiLabbe: 'derogation',
                    usageType: 'Terrains de golf et sport',
                    notes: 'Combiné avec difenoconazole (FRAC 3). Excellente fusariose.',
                    diseases_fr: 'Fusariose froide, dollar spot, anthracnose',
                    diseases: 'Microdochium patch, dollar spot, anthracnose'
                },
                { 
                    trade: 'Medallion TL', 
                    amm: '2120389',
                    rate: '3 L/ha', 
                    interval: '14-28',
                    loiLabbe: 'derogation',
                    usageType: 'Terrains de golf: greens',
                    notes: 'Contact. Standard hivernal pour fusariose.',
                    diseases_fr: 'Fusariose froide',
                    diseases: 'Microdochium patch'
                }
            ],
            targets: ['fusarium', 'dollarSpot', 'anthracnose'],
            systemic: false,
            mode: 'Inhibiteur de la transduction du signal (MAP kinase)'
        },

        // ───────────────────────────────────────────────────────────────────────
        // BIOCONTRÔLE (Exempt from Loi Labbé) - CAN BE USED ON DOMESTIC LAWNS
        // ───────────────────────────────────────────────────────────────────────
        bacillusSubtilis: {
            frac: 44,
            useCategory: 'both',
            allowedUses: ['golf', 'sportsfield', 'amenity', 'lawn'],
            products: [
                { 
                    trade: 'Serenade ASO', 
                    amm: '2110117',
                    rate: '4-8 L/ha', 
                    interval: '7-14',
                    loiLabbe: 'exempt',
                    useCategory: 'both',
                    allowedUses: ['golf', 'sportsfield', 'amenity', 'lawn'],
                    usageType: 'Tous gazons',
                    notes: 'Biocontrôle - exempt Loi Labbé. Préventif uniquement. ✓ Usage domestique autorisé.',
                    diseases_fr: 'Fusariose froide, dollar spot',
                    diseases: 'Microdochium patch, dollar spot'
                }
            ],
            targets: ['fusarium', 'dollarSpot'],
            systemic: false,
            mode: 'Biocontrôle - Compétition + lipopeptides antifongiques'
        },
        trichodermaAsperellum: {
            frac: 'BM',
            useCategory: 'both',
            allowedUses: ['golf', 'sportsfield', 'amenity', 'lawn'],
            products: [
                { 
                    trade: 'Xilon GR', 
                    amm: '2160087',
                    rate: '2-3 kg/ha', 
                    interval: '21-28',
                    loiLabbe: 'exempt',
                    useCategory: 'both',
                    allowedUses: ['golf', 'sportsfield', 'amenity', 'lawn'],
                    usageType: 'Tous gazons',
                    notes: 'Biocontrôle - exempt Loi Labbé. Sol granulé. ✓ Usage domestique autorisé.',
                    diseases_fr: 'Maladies du sol',
                    diseases: 'Root diseases, take-all patch'
                }
            ],
            targets: ['takeAll', 'pythium'],
            systemic: false,
            mode: 'Biocontrôle - Parasitisme mycorhizien'
        }
    };

    // French disease name mapping
    const FRANCE_DISEASE_NAMES = {
        fusarium: 'Fusariose froide (Microdochium nivale)',
        dollarSpot: 'Maladie du dollar (Sclerotinia homoeocarpa)',
        brownPatch: 'Plaque brune (Rhizoctonia solani)',
        anthracnose: 'Anthracnose (Colletotrichum graminicola)',
        pythium: 'Pythium (Pythium spp.)',
        redThread: 'Fil rouge (Laetisaria fuciformis)',
        takeAll: 'Piétin échaudage (Gaeumannomyces graminis)',
        snowMold: 'Moisissure des neiges (Typhula spp.)',
        fairyRing: 'Ronds de sorcière (Marasmius oreades)',
        rust: 'Rouille (Puccinia spp.)'
    };


    // ═══════════════════════════════════════════════════════════════════════════
    // SPAIN (MAPA) FUNGICIDE DATABASE
    // Source: MAPA Registro de Productos Fitosanitarios December 2024
    // Products must have explicit césped/zonas verdes registration
    // 
    // Spain follows EU Regulation 1107/2009 with national registration
    // Greater product diversity than northern EU countries
    // ═══════════════════════════════════════════════════════════════════════════
    
    const FUNGICIDES_SPAIN = {
        // ───────────────────────────────────────────────────────────────────────
        // FRAC GROUP 3 - DMI Fungicides (Triazoles)
        // ───────────────────────────────────────────────────────────────────────
        difenoconazole: {
            frac: 3,
            products: [
                { 
                    trade: 'Instrata Elite', 
                    registro: 'ES-00814',
                    rate: '2.5 L/ha', 
                    interval: '14-28',
                    cultivo: 'Césped ornamental y de campos de golf',
                    notes: 'Con fludioxonil (FRAC 12). Fusariosis, dollar spot.',
                    diseases_es: 'Fusariosis invernal, dollar spot, antracnosis',
                    diseases: 'Microdochium patch, dollar spot, anthracnose'
                },
                { 
                    trade: 'Ascernity', 
                    registro: 'ES-00892',
                    rate: '3 L/ha', 
                    interval: '14-28',
                    cultivo: 'Césped de campos de golf',
                    notes: 'Con benzovindiflupyr (FRAC 7). Amplio espectro.',
                    diseases_es: 'Fusariosis, placa marrón, dollar spot, antracnosis',
                    diseases: 'Microdochium patch, brown patch, dollar spot, anthracnose'
                }
            ],
            targets: ['fusarium', 'dollarSpot', 'brownPatch', 'anthracnose'],
            systemic: true,
            mode: 'Inhibidor de la síntesis de esteroles (C14-desmetilasa)'
        },
        tebuconazole: {
            frac: 3,
            products: [
                { 
                    trade: 'Folicur 25 WG', 
                    registro: 'ES-00298',
                    rate: '1 kg/ha', 
                    interval: '14-21',
                    cultivo: 'Césped',
                    notes: 'Amplio uso. Fusariosis, dollar spot.',
                    diseases_es: 'Fusariosis invernal, dollar spot',
                    diseases: 'Microdochium patch, dollar spot'
                }
            ],
            targets: ['fusarium', 'dollarSpot'],
            systemic: true,
            mode: 'Inhibidor de la síntesis de esteroles (C14-desmetilasa)'
        },
        propiconazole: {
            frac: 3,
            products: [
                { 
                    trade: 'Banner Maxx', 
                    registro: 'ES-00567',
                    rate: '0.8-1.6 L/ha', 
                    interval: '14-28',
                    cultivo: 'Césped ornamental, campos de golf, campos de fútbol',
                    notes: 'Amplio espectro. Control preventivo y curativo.',
                    diseases_es: 'Fusariosis, dollar spot, antracnosis, hilo rojo',
                    diseases: 'Microdochium patch, dollar spot, anthracnose, red thread'
                }
            ],
            targets: ['fusarium', 'dollarSpot', 'anthracnose', 'redThread'],
            systemic: true,
            mode: 'Inhibidor de la síntesis de esteroles (C14-desmetilasa)'
        },
        myclobutanil: {
            frac: 3,
            products: [
                { 
                    trade: 'Eagle 20 EW', 
                    registro: 'ES-00445',
                    rate: '0.6-0.9 L/ha', 
                    interval: '14-21',
                    cultivo: 'Césped ornamental',
                    notes: 'Dollar spot, roya, hilo rojo.',
                    diseases_es: 'Dollar spot, roya, hilo rojo',
                    diseases: 'Dollar spot, rust, red thread'
                }
            ],
            targets: ['dollarSpot', 'rust', 'redThread'],
            systemic: true,
            mode: 'Inhibidor de la síntesis de esteroles (C14-desmetilasa)'
        },

        // ───────────────────────────────────────────────────────────────────────
        // FRAC GROUP 7 - SDHI Fungicides
        // ───────────────────────────────────────────────────────────────────────
        fluopyram: {
            frac: 7,
            products: [
                { 
                    trade: 'Exteris Stressgard', 
                    registro: 'ES-00756',
                    rate: '10 L/ha', 
                    interval: '14-28',
                    cultivo: 'Césped de campos de golf',
                    notes: 'Con trifloxystrobin (FRAC 11). Formulación Stressgard.',
                    diseases_es: 'Dollar spot, fusariosis invernal',
                    diseases: 'Dollar spot, Microdochium patch'
                }
            ],
            targets: ['dollarSpot', 'fusarium'],
            systemic: true,
            mode: 'Inhibidor de la succinato deshidrogenasa (SDHI)'
        },
        benzovindiflupyr: {
            frac: 7,
            products: [
                { 
                    trade: 'Ascernity', 
                    registro: 'ES-00892',
                    rate: '3 L/ha', 
                    interval: '14-28',
                    cultivo: 'Césped de campos de golf',
                    notes: 'Combinado con difenoconazole (FRAC 3).',
                    diseases_es: 'Fusariosis, dollar spot, antracnosis, placa marrón',
                    diseases: 'Microdochium patch, dollar spot, anthracnose, brown patch'
                }
            ],
            targets: ['fusarium', 'dollarSpot', 'anthracnose', 'brownPatch'],
            systemic: true,
            mode: 'Inhibidor de la succinato deshidrogenasa (SDHI)'
        },
        boscalid: {
            frac: 7,
            products: [
                { 
                    trade: 'Signum', 
                    registro: 'ES-00412',
                    rate: '1.5 kg/ha', 
                    interval: '14-28',
                    cultivo: 'Césped',
                    maxApps: 2,
                    notes: 'Con pyraclostrobin (FRAC 11).',
                    diseases_es: 'Dollar spot, fusariosis invernal',
                    diseases: 'Dollar spot, Microdochium patch'
                }
            ],
            targets: ['dollarSpot', 'fusarium'],
            systemic: true,
            mode: 'Inhibidor de la succinato deshidrogenasa (SDHI)'
        },
        fluxapyroxad: {
            frac: 7,
            products: [
                { 
                    trade: 'Xzemplar', 
                    registro: 'ES-00834',
                    rate: '0.75 L/ha', 
                    interval: '14-28',
                    cultivo: 'Césped ornamental y campos de golf',
                    notes: 'SDHI de última generación.',
                    diseases_es: 'Dollar spot, fusariosis, antracnosis',
                    diseases: 'Dollar spot, Microdochium patch, anthracnose'
                }
            ],
            targets: ['dollarSpot', 'fusarium', 'anthracnose'],
            systemic: true,
            mode: 'Inhibidor de la succinato deshidrogenasa (SDHI)'
        },

        // ───────────────────────────────────────────────────────────────────────
        // FRAC GROUP 11 - QoI Fungicides (Strobilurins)
        // ───────────────────────────────────────────────────────────────────────
        azoxystrobin: {
            frac: 11,
            products: [
                { 
                    trade: 'Heritage', 
                    registro: 'ES-00234',
                    rate: '0.6 kg/ha', 
                    interval: '14-28',
                    cultivo: 'Césped ornamental, campos de golf',
                    notes: 'Amplio espectro. Preventivo principalmente.',
                    diseases_es: 'Placa marrón, pythium, antracnosis, mal del pie',
                    diseases: 'Brown patch, Pythium, anthracnose, take-all patch'
                }
            ],
            targets: ['brownPatch', 'pythium', 'anthracnose', 'takeAll'],
            systemic: true,
            mode: 'QoI - Inhibidor de la respiración (citocromo bc1)'
        },
        trifloxystrobin: {
            frac: 11,
            products: [
                { 
                    trade: 'Exteris Stressgard', 
                    registro: 'ES-00756',
                    rate: '10 L/ha', 
                    interval: '14-28',
                    cultivo: 'Césped de campos de golf',
                    notes: 'Combinado con fluopyram (FRAC 7).',
                    diseases_es: 'Dollar spot, fusariosis invernal',
                    diseases: 'Dollar spot, Microdochium patch'
                }
            ],
            targets: ['dollarSpot', 'fusarium'],
            systemic: true,
            mode: 'QoI - Inhibidor de la respiración (citocromo bc1)'
        },
        pyraclostrobin: {
            frac: 11,
            products: [
                { 
                    trade: 'Signum', 
                    registro: 'ES-00412',
                    rate: '1.5 kg/ha', 
                    interval: '14-28',
                    cultivo: 'Césped',
                    notes: 'Combinado con boscalid (FRAC 7).',
                    diseases_es: 'Dollar spot, fusariosis',
                    diseases: 'Dollar spot, Microdochium patch'
                }
            ],
            targets: ['dollarSpot', 'fusarium'],
            systemic: true,
            mode: 'QoI - Inhibidor de la respiración (citocromo bc1)'
        },

        // ───────────────────────────────────────────────────────────────────────
        // FRAC GROUP 12 - Phenylpyrroles
        // ───────────────────────────────────────────────────────────────────────
        fludioxonil: {
            frac: 12,
            products: [
                { 
                    trade: 'Instrata Elite', 
                    registro: 'ES-00814',
                    rate: '2.5 L/ha', 
                    interval: '14-28',
                    cultivo: 'Césped ornamental y campos de golf',
                    notes: 'Combinado con difenoconazole (FRAC 3).',
                    diseases_es: 'Fusariosis invernal, dollar spot, antracnosis',
                    diseases: 'Microdochium patch, dollar spot, anthracnose'
                },
                { 
                    trade: 'Medallion TL', 
                    registro: 'ES-00623',
                    rate: '3 L/ha', 
                    interval: '14-28',
                    cultivo: 'Césped de campos de golf',
                    notes: 'Contacto. Estándar para fusariosis invernal.',
                    diseases_es: 'Fusariosis invernal',
                    diseases: 'Microdochium patch'
                }
            ],
            targets: ['fusarium', 'dollarSpot', 'anthracnose'],
            systemic: false,
            mode: 'Inhibidor de transducción de señales (MAP quinasa)'
        },

        // ───────────────────────────────────────────────────────────────────────
        // FRAC GROUP 4 - Phenylamides
        // ───────────────────────────────────────────────────────────────────────
        metalaxyl: {
            frac: 4,
            products: [
                { 
                    trade: 'Ridomil Gold MZ', 
                    registro: 'ES-00189',
                    rate: '2.5 kg/ha', 
                    interval: '14-21',
                    cultivo: 'Césped',
                    notes: 'Con mancozeb. Pythium y oomicetos.',
                    diseases_es: 'Pythium',
                    diseases: 'Pythium'
                }
            ],
            targets: ['pythium'],
            systemic: true,
            mode: 'Inhibidor de la ARN polimerasa I'
        },

        // ───────────────────────────────────────────────────────────────────────
        // CONTACT/MULTI-SITE FUNGICIDES
        // ───────────────────────────────────────────────────────────────────────
        iprodione: {
            frac: 2,
            products: [
                { 
                    trade: 'Chipco Green', 
                    registro: 'ES-00156',
                    rate: '3 L/ha', 
                    interval: '14-21',
                    cultivo: 'Césped ornamental, campos de golf',
                    notes: 'Contacto. Fusariosis, dollar spot.',
                    diseases_es: 'Fusariosis invernal, dollar spot, placa marrón',
                    diseases: 'Microdochium patch, dollar spot, brown patch'
                }
            ],
            targets: ['fusarium', 'dollarSpot', 'brownPatch'],
            systemic: false,
            mode: 'Dicarboximida - Inhibidor de señal osmótica'
        }
    };

    // Spanish disease name mapping
    const SPAIN_DISEASE_NAMES = {
        fusarium: 'Fusariosis invernal (Microdochium nivale)',
        dollarSpot: 'Dollar spot (Sclerotinia homoeocarpa)',
        brownPatch: 'Placa marrón (Rhizoctonia solani)',
        anthracnose: 'Antracnosis (Colletotrichum graminicola)',
        pythium: 'Pythium (Pythium spp.)',
        redThread: 'Hilo rojo (Laetisaria fuciformis)',
        helminthosporium: 'Helmintosporiosis (Drechslera/Bipolaris spp.)',
        rust: 'Roya (Puccinia spp.)',
        takeAll: 'Mal del pie (Gaeumannomyces graminis)',
        snowMold: 'Moho de nieve (Microdochium nivale)',
        fairyRing: 'Anillos de brujas (Marasmius oreades)',
        springDeadSpot: 'Spring dead spot (Ophiosphaerella spp.)'
    };


    // ═══════════════════════════════════════════════════════════════════════════
    // GERMANY (BVL) FUNGICIDE DATABASE
    // Source: BVL §17 PflSchG approved list for golf/sport turf, December 2024
    // DGV (Deutscher Golf Verband) AK IPS approved products list
    // 
    // IMPORTANT: Germany has very restrictive turf fungicide regulations.
    // Only products with explicit §17 PflSchG (Pflanzenschutzgesetz) approval
    // for "Flächen für die Allgemeinheit" (public areas) may be used on golf
    // courses and sports fields. Many approvals are time-limited.
    // 
    // Categories:
    // - Kat. 6: Sportplatz (sports fields)
    // - Golf: Golfplatz (all functional areas)
    // 
    // USE CATEGORIES FOR GERMANY:
    // ALL §17 products are PROFESSIONAL ONLY - NO domestic lawn use permitted.
    // These products require Sachkundenachweis (professional certification).
    // 
    // AUFLAGEN (conditions) codes:
    // - NW: Naturhaushalt und Wasser (environment/water protection)
    // - SF: Sachkundepflicht (professional competence required)
    // ═══════════════════════════════════════════════════════════════════════════
    
    const FUNGICIDES_GERMANY = {
        // ───────────────────────────────────────────────────────────────────────
        // FRAC GROUP 7 - SDHI Fungicides
        // ───────────────────────────────────────────────────────────────────────
        fluopyram: {
            frac: 7,
            useCategory: 'professional',
            allowedUses: ['golf', 'sportsfield'],
            products: [
                { 
                    trade: 'Exteris Stressgard', 
                    bvl: '00A892-00',
                    para17: true,
                    useCategory: 'professional',
                    allowedUses: ['golf', 'sportsfield'],
                    rate: '10 L/ha', 
                    interval: '14-28',
                    anwendungsbereich: 'Golfplatz: alle Funktionsflächen; Sportplatz',
                    zulassungEnde: '2026-12-31',
                    auflagen: ['NW 802', 'SF 251', 'SF 252'],
                    notes: 'Mit Trifloxystrobin (FRAC 11). Stressgard Formulierung. §17-Genehmigung. ⛔ Kein Haus- und Kleingarten.',
                    diseases_de: 'Dollarflecken-Krankheit, Schneeschimmel',
                    diseases: 'Dollar spot, Microdochium patch (snow mold)'
                }
            ],
            targets: ['dollarSpot', 'fusarium'],
            systemic: true,
            mode: 'Succinat-Dehydrogenase-Inhibitor (SDHI)'
        },
        boscalid: {
            frac: 7,
            useCategory: 'professional',
            allowedUses: ['golf', 'sportsfield'],
            products: [
                { 
                    trade: 'Signum', 
                    bvl: '024780-00',
                    para17: true,
                    useCategory: 'professional',
                    allowedUses: ['golf', 'sportsfield'],
                    rate: '1.5 kg/ha in max. 1000 L', 
                    interval: '14-28',
                    maxApps: 2,
                    anwendungsbereich: 'Golfplatz: Greens und Tees; Sportplatz',
                    zulassungEnde: '2025-08-31',
                    auflagen: ['NW 605', 'NW 606', 'NW 607', 'SF 251'],
                    notes: 'Mit Pyraclostrobin (FRAC 11). Zulassung voraussichtlich verlängert. ⛔ Kein Haus- und Kleingarten.',
                    diseases_de: 'Dollarflecken-Krankheit, Schneeschimmel',
                    diseases: 'Dollar spot, Microdochium patch'
                }
            ],
            targets: ['dollarSpot', 'fusarium'],
            systemic: true,
            mode: 'Succinat-Dehydrogenase-Inhibitor (SDHI)'
        },

        // ───────────────────────────────────────────────────────────────────────
        // FRAC GROUP 11 - QoI Fungicides (Strobilurins)
        // ───────────────────────────────────────────────────────────────────────
        azoxystrobin: {
            frac: 11,
            useCategory: 'professional',
            allowedUses: ['golf'],
            products: [
                { 
                    trade: 'Heritage', 
                    bvl: '024312-00',
                    para17: true,
                    useCategory: 'professional',
                    allowedUses: ['golf'],
                    rate: '600 g/ha', 
                    interval: '14-28',
                    anwendungsbereich: 'Golfplatz: Greens und Tees',
                    zulassungEnde: '2025-03-31',
                    auflagen: ['NW 605', 'NW 606', 'SF 251'],
                    notes: '⚠️ ZULASSUNG ENDET BALD. Breitband-Strobilurin. ⛔ Kein Haus- und Kleingarten.',
                    diseases_de: 'Braunfleckenkrankheit, Pythium, Anthraknose',
                    diseases: 'Brown patch, Pythium, anthracnose'
                }
            ],
            targets: ['brownPatch', 'pythium', 'anthracnose'],
            systemic: true,
            mode: 'QoI - Atmungsinhibitor (Cytochrom bc1)'
        },
        trifloxystrobin: {
            frac: 11,
            useCategory: 'professional',
            allowedUses: ['golf', 'sportsfield'],
            products: [
                { 
                    trade: 'Exteris Stressgard', 
                    bvl: '00A892-00',
                    para17: true,
                    useCategory: 'professional',
                    allowedUses: ['golf', 'sportsfield'],
                    rate: '10 L/ha', 
                    interval: '14-28',
                    anwendungsbereich: 'Golfplatz; Sportplatz',
                    zulassungEnde: '2026-12-31',
                    auflagen: ['NW 802', 'SF 251', 'SF 252'],
                    notes: 'Mit Fluopyram (FRAC 7). ⛔ Kein Haus- und Kleingarten.',
                    diseases_de: 'Dollarflecken, Schneeschimmel',
                    diseases: 'Dollar spot, Microdochium patch'
                }
            ],
            targets: ['dollarSpot', 'fusarium'],
            systemic: true,
            mode: 'QoI - Atmungsinhibitor (Cytochrom bc1)'
        },
        pyraclostrobin: {
            frac: 11,
            products: [
                { 
                    trade: 'Signum', 
                    bvl: '024780-00',
                    para17: true,
                    rate: '1.5 kg/ha', 
                    interval: '14-28',
                    anwendungsbereich: 'Golfplatz: Greens und Tees; Sportplatz',
                    zulassungEnde: '2025-08-31',
                    auflagen: ['NW 605', 'NW 606', 'NW 607', 'SF 251'],
                    notes: 'Mit Boscalid (FRAC 7).',
                    diseases_de: 'Dollarflecken, Schneeschimmel',
                    diseases: 'Dollar spot, Microdochium patch'
                }
            ],
            targets: ['dollarSpot', 'fusarium'],
            systemic: true,
            mode: 'QoI - Atmungsinhibitor (Cytochrom bc1)'
        },

        // ───────────────────────────────────────────────────────────────────────
        // FRAC GROUP 4 - Phenylamides
        // ───────────────────────────────────────────────────────────────────────
        propamocarb: {
            frac: 28,
            products: [
                { 
                    trade: 'Previcur Energy', 
                    bvl: '006706-00',
                    para17: true,
                    rate: '3 L/ha', 
                    interval: '7-14',
                    anwendungsbereich: 'Golfplatz: Greens; Sportplatz',
                    zulassungEnde: '2025-04-30',
                    auflagen: ['NW 605', 'SF 251'],
                    notes: '⚠️ ZULASSUNG ENDET BALD. Mit Fosetyl-Al. Pythium-Spezialist.',
                    diseases_de: 'Pythium',
                    diseases: 'Pythium'
                }
            ],
            targets: ['pythium'],
            systemic: true,
            mode: 'Carbamat - Membranbiosynthese'
        },

        // ───────────────────────────────────────────────────────────────────────
        // FRAC GROUP 12 - Phenylpyrroles
        // ───────────────────────────────────────────────────────────────────────
        fludioxonil: {
            frac: 12,
            products: [
                { 
                    trade: 'Medallion TL', 
                    bvl: '007234-00',
                    para17: true,
                    rate: '3 L/ha', 
                    interval: '14-28',
                    anwendungsbereich: 'Golfplatz: Greens und Tees',
                    zulassungEnde: '2026-06-30',
                    auflagen: ['NW 605', 'NW 606', 'SF 251'],
                    notes: 'Kontaktmittel. Standard für Schneeschimmel.',
                    diseases_de: 'Schneeschimmel (Microdochium nivale)',
                    diseases: 'Microdochium patch (snow mold)'
                }
            ],
            targets: ['fusarium'],
            systemic: false,
            mode: 'Signaltransduktionsinhibitor (MAP-Kinase)'
        },

        // ───────────────────────────────────────────────────────────────────────
        // BIOLOGISCHE PFLANZENSCHUTZMITTEL
        // ───────────────────────────────────────────────────────────────────────
        bacillusSubtilis: {
            frac: 44,
            products: [
                { 
                    trade: 'Serenade ASO', 
                    bvl: '007045-00',
                    para17: true,
                    rate: '4-8 L/ha', 
                    interval: '7-14',
                    anwendungsbereich: 'Golfplatz; Sportplatz; öffentliches Grün',
                    zulassungEnde: '2027-12-31',
                    auflagen: ['SF 251'],
                    notes: 'Biologisch. Präventiv. Weniger Auflagen.',
                    diseases_de: 'Schneeschimmel, Dollarflecken',
                    diseases: 'Microdochium patch, dollar spot'
                }
            ],
            targets: ['fusarium', 'dollarSpot'],
            systemic: false,
            mode: 'Biologisch - Kompetition + antifungale Lipopeptide'
        }
    };

    // German disease name mapping
    const GERMANY_DISEASE_NAMES = {
        fusarium: 'Schneeschimmel (Microdochium nivale)',
        dollarSpot: 'Dollarflecken-Krankheit (Sclerotinia homoeocarpa)',
        brownPatch: 'Braunfleckenkrankheit (Rhizoctonia solani)',
        anthracnose: 'Anthraknose (Colletotrichum graminicola)',
        pythium: 'Pythium-Fäule (Pythium spp.)',
        redThread: 'Rotspitzigkeit (Laetisaria fuciformis)',
        takeAll: 'Schwarzbeinigkeit (Gaeumannomyces graminis)',
        snowMold: 'Schneeschimmel (Typhula spp.)',
        fairyRing: 'Hexenringe (Marasmius oreades)',
        rust: 'Rost (Puccinia spp.)',
        leafSpot: 'Blattfleckenkrankheit (Drechslera/Bipolaris spp.)'
    };

    // German Auflagen (restriction codes) explanations
    const GERMANY_AUFLAGEN = {
        'NW 605': 'Gewässerabstand 5m (standard)',
        'NW 606': 'Gewässerabstand 10m',
        'NW 607': 'Gewässerabstand 15m',
        'NW 608': 'Gewässerabstand 20m',
        'NW 642': 'Kein Einsatz auf drainierten Flächen',
        'NW 800': 'Gewässerabstand reduzierbar mit Abdriftminderung',
        'NW 802': 'Gewässerabstand reduzierbar mit 75% Abdriftminderung',
        'SF 251': 'Sachkundenachweis erforderlich',
        'SF 252': 'Anwenderschutz: Schutzhandschuhe + Schutzanzug'
    };


    // ═══════════════════════════════════════════════════════════════════════════
    // HELPER FUNCTIONS
    // ═══════════════════════════════════════════════════════════════════════════

    /**
     * Get fungicide database by country code
     */
    function getEuropeanFungicidesByCountry(countryCode) {
        const databases = {
            'FR': FUNGICIDES_FRANCE,
            'ES': FUNGICIDES_SPAIN,
            'DE': FUNGICIDES_GERMANY
        };
        return databases[countryCode.toUpperCase()] || null;
    }

    /**
     * Get disease names by country
     */
    function getEuropeanDiseaseNamesByCountry(countryCode) {
        const nameMaps = {
            'FR': FRANCE_DISEASE_NAMES,
            'ES': SPAIN_DISEASE_NAMES,
            'DE': GERMANY_DISEASE_NAMES
        };
        return nameMaps[countryCode.toUpperCase()] || {};
    }

    /**
     * Get default use categories by country
     * France: Loi Labbé means golf/sportsfield only (except biocontrol)
     * Germany: §17 PflSchG means golf/sportsfield only
     * Spain: More permissive but still professional only
     */
    function getDefaultUseCategory(countryCode, product) {
        const code = countryCode.toUpperCase();
        
        // France: biocontrol is exempt and can be used on lawns
        if (code === 'FR' && product?.loiLabbe === 'exempt') {
            return { useCategory: 'both', allowedUses: ['golf', 'sportsfield', 'amenity', 'lawn'] };
        }
        
        // France derogation products - professional only
        if (code === 'FR') {
            return { useCategory: 'professional', allowedUses: ['golf', 'sportsfield'] };
        }
        
        // Germany §17 - golf and sportsfield only
        if (code === 'DE') {
            return { useCategory: 'professional', allowedUses: ['golf', 'sportsfield'] };
        }
        
        // Spain - slightly more permissive, includes amenity
        if (code === 'ES') {
            return { useCategory: 'professional', allowedUses: ['golf', 'sportsfield', 'amenity'] };
        }
        
        // Default: professional golf/sportsfield
        return { useCategory: 'professional', allowedUses: ['golf', 'sportsfield'] };
    }

    /**
     * Apply use category defaults to a product
     */
    function applyProductDefaults(product, activeData, countryCode) {
        const defaults = getDefaultUseCategory(countryCode, product);
        return {
            ...product,
            useCategory: product.useCategory || activeData.useCategory || defaults.useCategory,
            allowedUses: product.allowedUses || activeData.allowedUses || defaults.allowedUses
        };
    }

    /**
     * Get fungicide recommendations for a disease in a specific country
     * Includes use category defaults
     */
    function getEuropeanFungicidesForDisease(disease, countryCode) {
        const db = getEuropeanFungicidesByCountry(countryCode);
        if (!db) return [];

        const results = [];
        for (const [activeIngredient, data] of Object.entries(db)) {
            if (data.targets && data.targets.includes(disease)) {
                const defaults = getDefaultUseCategory(countryCode);
                const products = data.products.map(p => applyProductDefaults(p, data, countryCode));
                
                results.push({
                    activeIngredient,
                    frac: data.frac,
                    products: products,
                    systemic: data.systemic,
                    mode: data.mode,
                    useCategory: data.useCategory || defaults.useCategory,
                    allowedUses: data.allowedUses || defaults.allowedUses
                });
            }
        }
        return results;
    }

    /**
     * Check if German product approval is expiring soon (within 6 months)
     */
    function isGermanProductExpiringSoon(product) {
        if (!product.zulassungEnde) return false;
        const expiryDate = new Date(product.zulassungEnde);
        const sixMonthsFromNow = new Date();
        sixMonthsFromNow.setMonth(sixMonthsFromNow.getMonth() + 6);
        return expiryDate <= sixMonthsFromNow;
    }

    /**
     * Check if German product approval has expired
     */
    function isGermanProductExpired(product) {
        if (!product.zulassungEnde) return false;
        return new Date(product.zulassungEnde) < new Date();
    }

    /**
     * Get French products by Loi Labbé status
     */
    function getFrenchProductsByLoiLabbeStatus(status) {
        const results = [];
        for (const [ai, data] of Object.entries(FUNGICIDES_FRANCE)) {
            for (const product of data.products) {
                if (product.loiLabbe === status) {
                    results.push({
                        activeIngredient: ai,
                        product: applyProductDefaults(product, data, 'FR'),
                        frac: data.frac
                    });
                }
            }
        }
        return results;
    }

    /**
     * Get all European fungicides for a disease (cross-country)
     */
    function getAllEuropeanFungicidesForDisease(disease) {
        return {
            france: getEuropeanFungicidesForDisease(disease, 'FR'),
            spain: getEuropeanFungicidesForDisease(disease, 'ES'),
            germany: getEuropeanFungicidesForDisease(disease, 'DE')
        };
    }

    /**
     * Get German Auflagen explanation
     */
    function getAuflagenExplanation(code) {
        return GERMANY_AUFLAGEN[code] || 'Unbekannte Auflage';
    }

    /**
     * Apply use category defaults to an entire database
     */
    function applyUseCategoryDefaults(db, countryCode) {
        const result = {};
        for (const [ai, data] of Object.entries(db)) {
            const defaults = getDefaultUseCategory(countryCode);
            result[ai] = {
                ...data,
                useCategory: data.useCategory || defaults.useCategory,
                allowedUses: data.allowedUses || defaults.allowedUses,
                products: data.products.map(p => applyProductDefaults(p, data, countryCode))
            };
        }
        return result;
    }


    // ═══════════════════════════════════════════════════════════════════════════
    // EXPORTS
    // ═══════════════════════════════════════════════════════════════════════════

    const EuropeanRegionalFungicides = {
        version: '1.0.0',
        
        // Databases (with defaults applied on access)
        get FUNGICIDES_FRANCE() { return applyUseCategoryDefaults(FUNGICIDES_FRANCE, 'FR'); },
        get FUNGICIDES_SPAIN() { return applyUseCategoryDefaults(FUNGICIDES_SPAIN, 'ES'); },
        get FUNGICIDES_GERMANY() { return applyUseCategoryDefaults(FUNGICIDES_GERMANY, 'DE'); },
        
        // Raw databases (without defaults, for backward compatibility)
        FUNGICIDES_FRANCE_RAW: FUNGICIDES_FRANCE,
        FUNGICIDES_SPAIN_RAW: FUNGICIDES_SPAIN,
        FUNGICIDES_GERMANY_RAW: FUNGICIDES_GERMANY,
        
        // Disease name mappings
        FRANCE_DISEASE_NAMES,
        SPAIN_DISEASE_NAMES,
        GERMANY_DISEASE_NAMES,
        
        // German regulatory info
        GERMANY_AUFLAGEN,
        
        // Helper functions
        getEuropeanFungicidesByCountry,
        getEuropeanDiseaseNamesByCountry,
        getEuropeanFungicidesForDisease,
        isGermanProductExpiringSoon,
        isGermanProductExpired,
        getFrenchProductsByLoiLabbeStatus,
        getAllEuropeanFungicidesForDisease,
        getAuflagenExplanation,
        applyUseCategoryDefaults,
        getDefaultUseCategory
    };

    // Export to global
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = EuropeanRegionalFungicides;
    }
    
    global.GAIP_EuropeanRegionalFungicides = EuropeanRegionalFungicides;
    
    // Add individual databases to global WITH use category defaults applied
    global.FUNGICIDES_FRANCE = applyUseCategoryDefaults(FUNGICIDES_FRANCE, 'FR');
    global.FUNGICIDES_SPAIN = applyUseCategoryDefaults(FUNGICIDES_SPAIN, 'ES');
    global.FUNGICIDES_GERMANY = applyUseCategoryDefaults(FUNGICIDES_GERMANY, 'DE');
    
    global.FRANCE_DISEASE_NAMES = FRANCE_DISEASE_NAMES;
    global.SPAIN_DISEASE_NAMES = SPAIN_DISEASE_NAMES;
    global.GERMANY_DISEASE_NAMES = GERMANY_DISEASE_NAMES;


})(typeof window !== 'undefined' ? window : this);
