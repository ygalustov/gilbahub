/**
 * Global Soluble Fertiliser Products
 * ====================================
 * Generic chemistry — registered and available globally (AU, NZ, UK, EU).
 * Extracted from au-fertiliser-products.js for lightweight loading on
 * non-AU/NZ sites that need soluble-only nutrition dropdown.
 *
 * Loaded unconditionally on all regions so spray-log-ui.js buildNutritionOptions
 * can always access window.GAIP_AU_FERTILISER.products.soluble.
 *
 * b35fix265: created to fix missing soluble dropdown on UK/EU GSSH pages.
 */
(function(global) {
    'use strict';

    // Merge solubles into GAIP_AU_FERTILISER if it already exists (AU path loaded full db),
    // otherwise create a minimal stub so spray-log-ui.js can read .products.soluble.
    if (!global.GAIP_AU_FERTILISER) {
        global.GAIP_AU_FERTILISER = {
            products: {
                granular: [],
                liquid:   [],
                soluble: [
            // ============================================================
            // SOLUBLE MAP - PHOSPHORUS DELIVERY
            // ============================================================
            {
                id: 'SOL-MAP',
                name: 'MAP Tech (soluble)',
                brand: 'various',
                distributor: 'Various',
                availability: 'National',
                analysis: { N: 12, P: 22, K: 0 },
                form: 'soluble',
                packSize: 25,
                maxRateKgHa: 20,
                greensMaxRateKgHa: 15,
                suitableFor: ['greens', 'golf_greens', 'bowling_greens', 'tees', 'fairways', 'sports'],
                notes: 'Soluble MAP dissolved in spray tank (400-600L water/ha). Efficient P delivery.',
                useCase: 'P maintenance on fine turf. P deficiency correction. Foliar P application.',
            },
            // ============================================================
            // SOLUBLE SOP - POTASSIUM WITHOUT NITROGEN
            // ============================================================
            {
                id: 'SOL-SOP',
                name: 'Soluble SOP (Potassium Sulphate)',
                brand: 'various',
                distributor: 'Various',
                availability: 'National',
                analysis: { N: 0, P: 0, K: 41.5, S: 18 },
                form: 'soluble',
                packSize: 25,
                maxRateKgHa: 150,
                greensMaxRateKgHa: 25,
                suitableFor: ['greens', 'golf_greens', 'bowling_greens', 'tees', 'fairways', 'sports'],
                notes: 'Chloride-free K. Dissolve fully. Low scorch risk.',
                useCase: 'K boost without N. Stress hardening. Cl-sensitive turf.',
            },
            // ============================================================
            // SOLUBLE AMMONIUM SULPHATE - ACIDIFYING N SOURCE
            // ============================================================
            {
                id: 'SOL-AS',
                name: 'Ammonium Sulphate Tech (soluble)',
                brand: 'various',
                distributor: 'Various',
                availability: 'National',
                analysis: { N: 21, P: 0, K: 0, S: 24 },
                form: 'soluble',
                packSize: 25,
                maxRateKgHa: 150,
                greensMaxRateKgHa: 25,
                suitableFor: ['greens', 'golf_greens', 'bowling_greens', 'tees', 'fairways', 'sports'],
                notes: 'Quick release N with S. Acidifying effect. Good for high pH soils.',
                useCase: 'Spoonfeeding greens. Fairway colour. pH management.',
            },
            // ============================================================
            // SOLUBLE UREA - FAST N
            // ============================================================
            {
                id: 'SOL-UREA',
                name: 'Urea Tech (soluble)',
                brand: 'various',
                distributor: 'Various',
                availability: 'National',
                analysis: { N: 46, P: 0, K: 0 },
                form: 'soluble',
                packSize: 25,
                maxRateKgHa: 50,
                greensMaxRateKgHa: 15,
                suitableFor: ['greens', 'golf_greens', 'bowling_greens', 'tees', 'fairways', 'sports'],
                notes: 'Very high N. Apply in cool conditions. Risk of volatilisation in heat.',
                useCase: 'Quick N response. Fairway colour. Tank mix applications.',
            },
            // ============================================================
            // SOLUBLE IRON SULPHATE - COLOUR WITHOUT N
            // ============================================================
            {
                id: 'SOL-FESO4',
                name: 'Iron Sulphate Hepta (soluble)',
                brand: 'various',
                distributor: 'Various',
                availability: 'National',
                analysis: { N: 0, P: 0, K: 0, Fe: 19.5, S: 11 },
                form: 'soluble',
                packSize: 25,
                maxRateKgHa: 10,
                greensMaxRateKgHa: 10,
                suitableFor: ['greens', 'golf_greens', 'bowling_greens', 'tees', 'fairways', 'sports'],
                notes: 'Pure Fe source. Can stain concrete/paths. Slight acidifying. Dissolve fully.',
                useCase: 'Colour without growth. Moss suppression. Fe deficiency.',
            },
            // ============================================================
            // SOLUBLE MAGNESIUM SULPHATE - EPSOM SALTS
            // ============================================================
            {
                id: 'SOL-MGSO4',
                name: 'Magnesium Sulphate (Epsom Salts)',
                brand: 'various',
                distributor: 'Various',
                availability: 'National',
                analysis: { N: 0, P: 0, K: 0, Mg: 9.8, S: 13 },
                form: 'soluble',
                packSize: 25,
                maxRateKgHa: 50,
                greensMaxRateKgHa: 25,
                suitableFor: ['greens', 'golf_greens', 'bowling_greens', 'tees', 'fairways', 'sports'],
                notes: 'Epsom salts. Highly soluble. Foliar Mg correction.',
                useCase: 'Mg deficiency correction. Chlorophyll production. Tank mix.',
            },
            // ============================================================
            // SOLUBLE MKP - PHOSPHORUS + POTASSIUM
            // ============================================================
            {
                id: 'SOL-MKP',
                name: 'MKP (Mono Potassium Phosphate)',
                brand: 'various',
                distributor: 'Various',
                availability: 'National',
                analysis: { N: 0, P: 22.5, K: 28 },
                form: 'soluble',
                packSize: 25,
                maxRateKgHa: 25,
                greensMaxRateKgHa: 15,
                suitableFor: ['greens', 'golf_greens', 'bowling_greens', 'tees', 'fairways', 'sports'],
                notes: 'PK without N. Neutral pH. Excellent solubility.',
                useCase: 'P+K without growth. Pre-stress. Establishment boost.',
            },
        ]
            }
        };
    }

})(typeof window !== 'undefined' ? window : this);
