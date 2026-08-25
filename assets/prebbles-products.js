/**
 * Prebbles Fertiliser Product Database & Recommendation Engine
 * 
 * Integrates with Gilba Hub's Nutrition Calendar to provide
 * product-specific recommendations based on:
 * - Surface type (SGN filtering)
 * - Season/growth phase (release characteristics)
 * - Release technology and soil temperature (v1.4.0)
 * - MLSN/SLAN methodology (rate precision)
 * - Nutrient requirements from calendar
 * - Soluble products for spoonfeeding programs (v1.32.0)
 * - Precision balancing to hit annual targets (v1.33.0)
 * - Surplus reduction to avoid over-delivery (v1.34.0)
 * 
 * @package Gilba_Hub
 * @version 1.34.0
 * @since 9.10.0
 * 
 * v1.34.0 - Surplus Reduction:
 *   - NEW: Reduces product rates when N surplus > 10% of target
 *   - Scales back highest-N products proportionally (min 70% of original rate)
 *   - Updates both annual summary and monthly recommendations
 *   - Monthly notes show "⚖️ Rate reduced X% to hit annual N target"
 *   - K surplus > 15% logged but not auto-reduced (would require product swaps)
 *   - Typical programs now achieve 95-105% of target vs previous 90-120%
 * 
 * v1.33.0 - Precision Balancing Strategy:
 *   - NEW: Post-processing balancing pass to hit annual N/K targets precisely
 *   - Lowered deficit thresholds: N > 5 kg/ha, K > 5 kg/ha trigger balancing
 *   - N balancing: Ammos 22 or soluble AS at calculated rate across high-GP months
 *   - K balancing: REMOVED in b35fix332 — see in-line removal block at the
 *     POTASSIUM BALANCING site for full audit. K supplementation flows
 *     through (a) the architected greens spoonfeeding path in the main
 *     month loop, and (b) word-export.js _synthesiseKReconDecision (b35fix324)
 *     which is gated on both programme balance AND soil-K floor.
 *   - Balancing products clearly labelled in program output
 *   - Typical programs now achieve 97-100% of target vs previous 90-95%
 * 
 * v1.32.0 - Soluble products now included in recommendations:
 *   - filterBySurface() includes form:'soluble' (WSF, soluble urea, SOP, etc.)
 *   - selectFoliarNitrogen() considers solubles for N delivery
 *   - selectPotassiumSource() — REMOVED b35fix332 (caller deleted, function
 *     replaced with documentation stub at original definition site)
 *   - Enables "little and often" spoonfeeding programs on greens
 * 
 * Release Technology Reference:
 * - IBDU: Isobutylidene diurea - hydrolysis release, works in cold (10-25°C optimal)
 * - MU/UF: Methylene urea/Ureaform - microbial release, needs warmth (>18°C optimal)
 * - MESA: MU + ammonium sulfate - hybrid, moderate temp dependency
 * - PCU: Polymer coated urea - diffusion release, temperature dependent
 * - SCU: Sulfur coated urea - coating breakdown, needs warmth + moisture
 * - AS: Ammonium sulfate - quick release, acidifying
 * - Urea: Standard urea - very quick release
 */

(function() {
    'use strict';

    // ========================================================================
    // PREBBLES PRODUCT DATABASE
    // ========================================================================

    const PrebbleProducts = {
        version: '1.34.0',
        
        /**
         * Release technology temperature efficiency curves
         * Returns efficiency (0-1) based on soil temperature
         * 
         * Research basis:
         * - Koivunen & Horwath (2004): MU mineralized 52% at 20°C, 63% at 30°C over 6 months
         * - Hamamoto (1966), Yurun Chemical: IBDU hydrolysis moisture-dependent, not temperature
         * - Sentek (2023): PCU release decreased 16-49% at 16°C vs 21°C
         * - El-Hout & Fountain (2021): SRFs doubled release rate/day from 25°C to 35°C
         * - Cornell turf guidelines: UF/MU little release below 10°C (50°F)
         */
        releaseTechEfficiency: {
            // IBDU - hydrolysis based, relatively temperature independent
            // Spencer 2008: 2-3× release rate at 27°C vs 10°C (much less temp dependent than MU)
            // "IBDU works well in cooler temperatures and does not 'dump' in hot weather"
            // Release governed by moisture and particle size, not temperature
            ibdu: {
                description: 'IBDU - hydrolysis (2-3× temp range per Spencer 2008), works in cold',
                tempCurve: [
                    { temp: 5, efficiency: 0.55 },   // Still releases via hydrolysis
                    { temp: 10, efficiency: 0.65 },  // Spencer baseline (1/2.5 of 27°C)
                    { temp: 15, efficiency: 0.78 },
                    { temp: 20, efficiency: 0.88 },
                    { temp: 27, efficiency: 1.00 },  // Spencer reference point
                    { temp: 35, efficiency: 0.95 },  // Slight decline in extreme heat
                ],
                minEffectiveTemp: 2,  // Works near freezing if moisture present
                optimalRange: [10, 30],
                citation: 'Spencer 2008 Table 18',
            },
            
            // Methylene Urea - microbial breakdown required
            // Spencer 2008: 10-12× release rate at 27°C vs 10°C, needs >13°C
            // Cornell: "little N released unless soil temp >50°F (10°C)"
            // Using 1/10 ratio for 10°C vs 27°C as per Spencer
            mu: {
                description: 'Methylene urea - microbial (10-12× temp range per Spencer 2008)',
                tempCurve: [
                    { temp: 5, efficiency: 0.05 },   // Essentially no microbial activity
                    { temp: 10, efficiency: 0.10 },  // Spencer: 1/10 of 27°C rate
                    { temp: 13, efficiency: 0.18 },  // Spencer: needs >13°C to be effective
                    { temp: 18, efficiency: 0.40 },  // Microbial activity increasing
                    { temp: 22, efficiency: 0.65 },  // Good activity
                    { temp: 27, efficiency: 1.00 },  // Spencer reference point (full activity)
                    { temp: 32, efficiency: 1.00 },  // Peak microbial activity
                ],
                minEffectiveTemp: 13,  // Spencer: needs >13°C
                optimalRange: [22, 35],
                citation: 'Spencer 2008 Table 18; Cornell Turf BMP',
            },
            
            // MESA - hybrid MU + ammonium sulfate (quick component)
            // AS portion provides immediate N, MU portion needs warmth
            // Typically ~50% quick release AS, 50% slow MU
            mesa: {
                description: 'MESA - ~50% quick AS + ~50% MU, moderate cold tolerance',
                tempCurve: [
                    { temp: 5, efficiency: 0.50 },   // AS component fully available
                    { temp: 10, efficiency: 0.55 },  // AS + minimal MU
                    { temp: 15, efficiency: 0.65 },  // AS + some MU
                    { temp: 20, efficiency: 0.76 },  // AS + half MU
                    { temp: 25, efficiency: 0.88 },  // Full AS + most MU
                    { temp: 30, efficiency: 1.00 },  // Full release both components
                ],
                minEffectiveTemp: 5,   // AS works at any temp
                optimalRange: [18, 32],
                citation: 'Derived from MU data + AS immediate availability',
            },
            
            // PCU - polymer coated, diffusion-based
            // Reference: Sentek 2023 - 16-49% decrease at 16°C vs 21°C
            // Reference: El-Hout 2021 - doubled release rate 25°C to 35°C
            // Using midpoint of Sentek range (32.5% decrease) for 5°C drop
            pcu: {
                description: 'Polymer coated urea - diffusion release, strongly temperature dependent',
                tempCurve: [
                    { temp: 5, efficiency: 0.15 },   // Very slow diffusion
                    { temp: 10, efficiency: 0.30 },  // Slow
                    { temp: 16, efficiency: 0.50 },  // Sentek: 16-49% less than 21°C
                    { temp: 21, efficiency: 0.75 },  // Sentek baseline
                    { temp: 25, efficiency: 0.88 },  // El-Hout baseline
                    { temp: 30, efficiency: 1.00 },  // Near optimum
                    { temp: 35, efficiency: 1.00 },  // El-Hout: doubled vs 25°C but plateau
                ],
                minEffectiveTemp: 8,
                optimalRange: [22, 35],
                citation: 'Sentek et al. 2023; El-Hout & Fountain 2021',
            },
            
            // SCU - sulfur coated urea
            // Similar to PCU but coating breakdown also microbially influenced
            // Generally considered less predictable than PCU
            // Spencer 2008: temperature dependent through microbial coating attack
            scu: {
                description: 'Sulphur coated urea - coating breakdown + microbial, variable',
                tempCurve: [
                    { temp: 5, efficiency: 0.10 },
                    { temp: 10, efficiency: 0.25 },
                    { temp: 15, efficiency: 0.45 },
                    { temp: 20, efficiency: 0.65 },
                    { temp: 25, efficiency: 0.85 },
                    { temp: 30, efficiency: 1.00 },
                ],
                minEffectiveTemp: 10,
                optimalRange: [20, 32],
                citation: 'Spencer 2008; General industry knowledge',
            },
            
            // PCSCU - Polymer Coated Sulfur Coated Urea (dual coating)
            // Spencer 2008: "premium quality PCSCU" - more predictable than SCU
            // Outer polymer layer provides initial controlled release
            // Inner sulfur coating provides secondary breakdown
            pcscu: {
                description: 'Polymer-coated SCU - dual coating, more predictable than SCU',
                tempCurve: [
                    { temp: 5, efficiency: 0.18 },   // Better than SCU due to polymer
                    { temp: 10, efficiency: 0.32 },
                    { temp: 15, efficiency: 0.50 },
                    { temp: 20, efficiency: 0.70 },
                    { temp: 25, efficiency: 0.88 },
                    { temp: 30, efficiency: 1.00 },
                ],
                minEffectiveTemp: 8,
                optimalRange: [18, 35],
                citation: 'Spencer 2008 - premium quality PCSCU',
            },
            
            // Standard/quick release - soluble, immediate availability
            // Works at any temperature where soil moisture present
            standard: {
                description: 'Quick release - soluble N, immediate availability at any temperature',
                tempCurve: [
                    { temp: 5, efficiency: 1.00 },
                    { temp: 10, efficiency: 1.00 },
                    { temp: 15, efficiency: 1.00 },
                    { temp: 20, efficiency: 1.00 },
                    { temp: 25, efficiency: 1.00 },
                    { temp: 30, efficiency: 1.00 },
                ],
                minEffectiveTemp: 0,
                optimalRange: [5, 35],
                citation: 'N/A - soluble fertilizers',
            },
            
            // Ammonium sulfate - quick release, works in cold
            as: {
                description: 'Ammonium sulfate - quick release, acidifying, works at any temp',
                tempCurve: [
                    { temp: 5, efficiency: 1.00 },
                    { temp: 10, efficiency: 1.00 },
                    { temp: 15, efficiency: 1.00 },
                    { temp: 20, efficiency: 1.00 },
                    { temp: 25, efficiency: 1.00 },
                    { temp: 30, efficiency: 1.00 },
                ],
                minEffectiveTemp: 0,
                optimalRange: [5, 35],
                citation: 'N/A - soluble fertilizers',
            },
        },
        
        /**
         * Surface type to SGN range mapping
         * SGN = Size Guide Number (particle diameter × 100)
         */
        surfaceSGN: {
            // Putting surfaces - SGN 80-100 ONLY (fine particle for close mowing)
            'greens': { min: 0, max: 100 },
            'golf_greens': { min: 0, max: 100 },
            'bowling_greens': { min: 0, max: 100 },
            'cricket_wickets': { min: 0, max: 145 },
            'lawn_greens': { min: 0, max: 145 },
            
            // Medium turf - SGN 80-210
            'tees': { min: 80, max: 210 },
            'low_cut': { min: 80, max: 210 },
            
            // Coarse turf - SGN 145-210+
            'fairways': { min: 145, max: 999 },
            'sports': { min: 145, max: 999 },
            'sports_fields': { min: 145, max: 999 },
            'landscaping': { min: 145, max: 999 },
            'lawns': { min: 145, max: 999 },
        },
        
        /**
         * Season to release type preferences
         * Maps growth phase to ideal release characteristics
         */
        seasonRelease: {
            // High growth - can use quick release
            'peak_growth': ['standard', 'slow', 'pcu'],
            'spring': ['standard', 'slow'],
            'autumn': ['standard', 'slow'],
            
            // Stress periods - prefer slow release, avoid N flush
            'summer_stress': ['slow', 'pcu'],
            'winter': ['slow'],
            
            // Establishment - need P, quick response
            'renovation': ['standard', 'slow'],
            'establishment': ['standard'],
        },

        /**
         * Granular Fertiliser Products
         * All rates in % (divide by 100 for decimal)
         * maxRateKgHa = label maximum single application rate
         */
        granular: [
            {
                id: 'CCMDGIV00',
                name: 'CC IV Spreadable Potash',
                brand: 'Country Club',
                npk: '0-0-20',
                analysis: { N: 0, P: 0, K: 20, S: 7.5, Fe: 2, Mn: 2, Mg: 2 },
                sgn: 80,
                release: 'slow', // 8-12 weeks
                releaseTech: 'standard', // K source, not N-tech dependent
                releaseWeeks: 10,
                packSize: 18.14,
                maxRateKgHa: 200, // Label: 100-200 kg/ha
                suitableFor: ['greens', 'golf_greens', 'bowling_greens', 'cricket_wickets', 'low_cut'],
                notes: 'Premier greens-grade K source. Includes Fe, Mn, Mg. No N flush.',
                useCase: 'K maintenance/correction without growth surge. Summer stress hardening.',
            },
            {
                id: 'CCLEB16',
                name: 'CC Lebanon STD',
                brand: 'Country Club',
                npk: '16-1.7-6.7',
                analysis: { N: 16, P: 1.7, K: 6.7, S: 5.1 },
                sgn: 150, // Standard granule
                release: 'standard',
                releaseTech: 'as', // Ammonium sulfate based
                releaseWeeks: 4,
                packSize: 22.68,
                maxRateKgHa: 250, // Label: 150-250 kg/ha
                suitableFor: ['greens', 'golf_greens', 'bowling_greens', 'tees', 'fairways', 'cricket_wickets'],
                notes: '3:2:1 ratio. Quick green-up. Acidifying (ammonium N).',
                useCase: 'Economical maintenance. Spring/autumn green-up.',
            },
            {
                id: 'CCMDG18',
                name: 'CC MD Greens 18-1-15',
                brand: 'Country Club MD',
                npk: '18-1-15',
                analysis: { N: 18, P: 1, K: 15 },
                sgn: 80,
                release: 'slow',
                releaseTech: 'mu', // Methylene urea - needs warmth for microbial breakdown
                releaseWeeks: 8,
                packSize: 18.14,
                maxRateKgHa: 200, // Label: 100-200 kg/ha
                suitableFor: ['greens', 'golf_greens', 'bowling_greens', 'cricket_wickets'],
                notes: 'Greens-grade with balanced N:K. Methylene urea slow release.',
                useCase: 'Greens maintenance. Best in warm conditions (>18°C soil).',
            },
            {
                id: 'CCMDGS16',
                name: 'CC MD Greens STD 16-0-6.7',
                brand: 'Country Club MD',
                npk: '16-0-6.7',
                analysis: { N: 16, P: 0, K: 6.7 },
                sgn: 80,
                release: 'standard',  // STD = standard release, NOT slow
                releaseTech: 'standard', // Quick release soluble N
                releaseWeeks: 3,      // Quick release - 2-4 weeks on low CEC
                packSize: 18.14,
                maxRateKgHa: 200, // Label: 100-200 kg/ha
                suitableFor: ['greens', 'golf_greens', 'bowling_greens', 'cricket_wickets', 'fairways'],
                notes: 'No P for P-restricted sites. Greens-grade SGN. STANDARD RELEASE.',
                useCase: 'Quick response when needed. Works at any temperature.',
            },
            {
                id: 'CCMETH24',
                name: 'Country Club 24-0-10',
                brand: 'Country Club',
                npk: '24-0-10',
                analysis: { N: 24, P: 0, K: 10 },
                sgn: 145,
                release: 'slow', // 77% SRN
                releaseTech: 'mu', // Methylene urea based
                releaseWeeks: 10,
                packSize: 22.68,
                maxRateKgHa: 200, // Label: 100-200 kg/ha
                suitableFor: ['greens', 'golf_greens', 'tees', 'fairways', 'sports'],
                notes: '77% methylene urea slow release N. Best in warm conditions.',
                useCase: 'Extended feeding in warm seasons. Reduced applications.',
            },
            {
                id: 'LEBP40',
                name: 'LebPro 40 PCU',
                brand: 'LebPro',
                npk: '24-0-4',
                analysis: { N: 24, P: 0, K: 4 },
                sgn: 200,
                release: 'pcu', // Polymer coated urea
                releaseTech: 'pcu', // Polymer coated - temperature dependent
                releaseWeeks: 12,
                packSize: 22.7,
                maxRateKgHa: 300, // Label: 150-300 kg/ha
                suitableFor: ['fairways', 'sports', 'landscaping'],
                notes: 'Polymer coated urea. Release rate increases with temperature.',
                useCase: 'Warm season extended feeding. Predictable release curve.',
            },
            {
                id: 'MESA',
                name: 'MESA Proscape 51%',
                brand: 'Proscape',
                npk: '25-0-4.2',
                analysis: { N: 25, P: 0, K: 4.2, S: 5.1, Fe: 1 },
                sgn: 210,
                release: 'slow', // MESA technology
                releaseTech: 'mesa', // MESA - hybrid MU + ammonium sulfate
                releaseWeeks: 9,
                packSize: 22.68,
                maxRateKgHa: 300, // Label: 150-300 kg/ha
                suitableFor: ['fairways', 'sports', 'landscaping'],
                notes: 'MESA technology - partial quick response + extended MU release.',
                useCase: 'Year-round use. Better cold performance than pure MU.',
            },
            {
                id: 'MESA19',
                name: 'MESA Country Club 100%',
                brand: 'Country Club',
                npk: '19-0-16',
                analysis: { N: 19, P: 0, K: 16, S: 10.2, Fe: 3 },
                sgn: 145,
                release: 'slow', // 100% MESA
                releaseTech: 'mesa', // MESA technology
                releaseWeeks: 9,
                packSize: 22.68,
                maxRateKgHa: 200, // Label: 100-200 kg/ha
                suitableFor: ['greens', 'golf_greens', 'tees', 'low_cut', 'sports', 'bowling_greens'],
                notes: '100% MESA N. Works in cooler conditions than pure MU.',
                useCase: 'Year-round balanced feeding. Moderate temp tolerance.',
            },
            {
                id: 'EXPO20',
                name: 'Proscape Expo',
                brand: 'Proscape',
                npk: '20-0-20',
                analysis: { N: 20, P: 0, K: 20, S: 8.5 },
                sgn: 145, // Label: SGN 145
                release: 'slow',
                releaseTech: 'mu', // Methylene urea
                releaseWeeks: 10,
                packSize: 22.68,
                maxRateKgHa: 300, // Label: 100-300 kg/ha
                suitableFor: ['fairways', 'sports', 'tees'],
                notes: 'MU slow release. Best performance >18°C soil temperature.',
                useCase: 'Warm season balanced N:K. Stress hardening.',
            },
            {
                id: 'PROSHI',
                name: 'Proscape Hi Iron',
                brand: 'Proscape',
                npk: '6-0.4-9',
                analysis: { N: 6, P: 0.4, K: 9, Fe: 7, S: 5.5 },
                sgn: 195, // Label: SGN 195
                release: 'standard',
                releaseTech: 'standard', // Quick release
                releaseWeeks: 4,
                packSize: 22.7,
                maxRateKgHa: 300, // Label: 150-300 kg/ha
                suitableFor: ['fairways', 'sports', 'landscaping'],
                notes: '7% Fe for colour without N flush. Low N.',
                useCase: 'Colour boost. Fe correction. Minimal growth response.',
            },
            {
                id: 'STARPR',
                name: 'Proscape Starter',
                brand: 'Proscape',
                npk: '16-11-10',
                analysis: { N: 16, P: 11, K: 10, S: 2 },
                sgn: 210,
                release: 'slow', // 25% MESA
                releaseTech: 'mesa', // Part MESA slow release
                releaseWeeks: 6,
                packSize: 22.68,
                maxRateKgHa: 300, // Label: 150-300 kg/ha
                suitableFor: ['fairways', 'sports', 'landscaping'],
                notes: 'High P for establishment. MESA component for extended N.',
                useCase: 'New seeding. Renovation. Works in moderate temps.',
            },
            {
                id: 'WOODACRE',
                name: 'Woodace A.C.R.E',
                brand: 'Woodace',
                npk: '12-1.3-5',
                analysis: { N: 12, P: 1.3, K: 5, S: 4.6, Fe: 2.5, Mn: 0.5 },
                sgn: 180,
                release: 'slow',
                releaseTech: 'mu', // Ureaform = methylene urea
                releaseWeeks: 10,
                packSize: 22.68,
                maxRateKgHa: 400, // Slow release - can go higher
                suitableFor: ['fairways', 'sports', 'landscaping', 'tees'],
                notes: 'Ureaform slow release. Needs warm soil (>18°C) for best results.',
                useCase: 'Warm season maintenance. Balanced micro nutrition.',
            },
            {
                id: 'WOOD14',
                name: 'Woodace Balanced',
                brand: 'Woodace',
                npk: '14-6-11.6',
                analysis: { N: 14, P: 6, K: 11.6 },
                sgn: 180,
                release: 'slow',
                releaseTech: 'mu', // Ureaform
                releaseWeeks: 10,
                packSize: 18.14,
                maxRateKgHa: 350,
                suitableFor: ['fairways', 'sports', 'landscaping', 'tees'],
                notes: 'Ureaform N - microbial release, needs warmth.',
                useCase: 'Warm season balanced feeding. New plantings.',
            },
            {
                id: 'WOODLT',
                name: 'Woodace Longterm',
                brand: 'Woodace',
                npk: '18-2.2-8.3',
                analysis: { N: 18, P: 2.2, K: 8.3 },
                sgn: 180,
                release: 'slow', // Ureaform
                releaseTech: 'mu', // Ureaform = MU
                releaseWeeks: 12,
                packSize: 18.14,
                maxRateKgHa: 350,
                suitableFor: ['fairways', 'sports', 'landscaping', 'tees'],
                notes: 'Extended ureaform release. Requires soil temps >18°C.',
                useCase: 'Warm season extended feeding. Low application frequency.',
            },
            // ============================================================
            // ADDITIONAL PRODUCTS FROM TURFWORLD RANGE
            // ============================================================
            {
                id: 'PROFEXT',
                name: 'Profert Extend',
                brand: 'Profert',
                npk: '24-2-5',
                analysis: { N: 24, P: 2, K: 5, S: 10.5, Fe: 3 },
                sgn: 200, // Standard sports grade
                release: 'slow',
                releaseTech: 'pcu', // Polymer coated
                releaseWeeks: 10,
                packSize: 20,
                maxRateKgHa: 300, // Label: 200-300 kg/ha
                suitableFor: ['fairways', 'sports', 'landscaping', 'tees'],
                notes: 'Extended release. Good Fe content. Suits renovation.',
                useCase: 'Warm season extended feeding. Post-renovation recovery.',
            },
            {
                id: 'CCMDGIV',
                name: 'CC MD IV Greens',
                brand: 'Country Club MD',
                npk: '18-1.3-15',
                analysis: { N: 18, P: 1.3, K: 15, S: 7.5, Fe: 2, Mn: 2, Mg: 2 },
                sgn: 80,
                release: 'slow',
                releaseTech: 'mesa', // MESA technology
                releaseWeeks: 8,
                packSize: 18.14,
                maxRateKgHa: 200, // Label: 100-200 kg/ha
                suitableFor: ['greens', 'golf_greens', 'bowling_greens', 'cricket_wickets'],
                notes: 'Increased visibility (dark granule). Balanced N:K for greens.',
                useCase: 'Greens maintenance. Premium surface finishing.',
            },
            {
                id: 'EZYRENO',
                name: 'Ezyreno',
                brand: 'Ezyspread',
                npk: '6-2.5-3.7',
                analysis: { N: 6, P: 2.5, K: 3.7 },
                sgn: 150,
                release: 'standard',
                releaseTech: 'standard',
                releaseWeeks: 4,
                packSize: 25,
                maxRateKgHa: 400, // Label: 250-400 kg/ha
                suitableFor: ['fairways', 'sports', 'landscaping'],
                notes: 'Low N renovation blend. High rates for establishment.',
                useCase: 'Post-renovation. New establishment. High-rate recovery.',
            },
            // ============================================================
            // PHOSPHORUS SOURCES
            // ============================================================
            {
                id: 'MAPGRAN',
                name: 'Granular MAP',
                brand: 'Various',
                npk: '12-27-0',
                analysis: { N: 12, P: 27, K: 0 },
                sgn: 200, // Standard granule for sports/fairways
                release: 'standard',
                releaseTech: 'standard', // Quick release
                releaseWeeks: 4,
                packSize: 25,
                maxRateKgHa: 200, // Can go slightly higher on sports turf
                suitableFor: ['fairways', 'sports', 'landscaping', 'tees'],
                notes: 'Standard-grade MAP for sports turf. Efficient P source. Slight acidifying.',
                useCase: 'P maintenance on sports fields. Establishment. P deficiency correction.',
            },
            // ============================================================
            // MAGNESIUM SOURCES - GRANULAR
            // ============================================================
            {
                id: 'KIESERITE',
                name: 'Kieserite (Granular Mg)',
                brand: 'Various',
                npk: '0-0-0',
                analysis: { N: 0, P: 0, K: 0, Mg: 15.1, S: 16 },
                sgn: 250, // Standard granule
                release: 'slow',
                releaseTech: 'standard',
                releaseWeeks: 8,
                packSize: 20,
                maxRateKgHa: 300,
                greensMaxRateKgHa: 300, // Best applied after hollow tine
                suitableFor: ['greens', 'golf_greens', 'bowling_greens', 'tees', 'fairways', 'sports'],
                notes: 'Natural magnesium sulphate mineral. Best applied after hollow tine aeration on greens.',
                useCase: 'Mg deficiency correction. Soil Mg building. Post-aeration application.',
            },
        ],

        /**
         * Liquid Fertiliser Products
         */
        liquid: [
            {
                id: 'XXTRA',
                name: 'XXTRA Liquid Iron',
                brand: 'Growth Products',
                npk: '6-0-0',
                analysis: { N: 6, P: 0, K: 0, Fe: 6 },
                form: 'liquid',
                packSize: 10, // litres
                maxRateLHa: 12, // Label: 6-12 L/ha
                density: 1.34, // kg/L
                suitableFor: ['greens', 'golf_greens', 'fairways', 'tees', 'sports', 'bowling_greens', 'cricket_wickets'],
                notes: 'Chelated Fe. Fast green-up without growth surge.',
                useCase: 'Colour boost. Fe deficiency correction. Foliar.',
            },
            {
                id: 'AMMOS',
                name: 'Ammos 22 (Nitro 22)',
                brand: 'Growth Products',
                npk: '22-0-0',
                analysis: { N: 22, P: 0, K: 0, S: 4 },
                form: 'liquid',
                packSize: 10,
                maxRateLHa: 50, // Label: 30-50 L/ha
                suitableFor: ['greens', 'golf_greens', 'fairways', 'tees', 'sports'],
                notes: 'High N liquid. Quick response. Works regardless of soil temp.',
                useCase: 'Rapid green-up. Foliar N boost. Winter N when slow-release ineffective.',
            },
            {
                id: 'LIQPOT',
                name: 'Liquid Potassium',
                brand: 'Growth Products',
                npk: '0-0-20',
                analysis: { N: 0, P: 0, K: 20 },
                form: 'liquid',
                packSize: 10,
                maxRateLHa: 20, // Label: 10-20 L/ha
                suitableFor: ['greens', 'golf_greens', 'fairways', 'tees', 'sports', 'bowling_greens'],
                notes: 'Liquid K source. No N.',
                useCase: 'K foliar. Stress hardening. No growth response.',
            },
            {
                id: 'PROBAL',
                name: 'Pro Balance',
                brand: 'Growth Products',
                npk: '15-0-12',
                analysis: { N: 15, P: 0, K: 12 },
                form: 'liquid',
                packSize: 10,
                maxRateLHa: 70, // Label: 30-70 L/ha
                release: 'slow', // 50% SRN MU
                suitableFor: ['greens', 'golf_greens', 'fairways', 'tees', 'sports'],
                notes: '50% slow release N. Balanced liquid.',
                useCase: 'Balanced foliar feeding. Extended N release.',
            },
            {
                id: 'TKOPH',
                name: 'TKO Phosphite',
                brand: 'Growth Products',
                npk: '0-13-21',
                analysis: { N: 0, P: 13, K: 21 },
                form: 'liquid',
                packSize: 10,
                maxRateLHa: 20, // Phosphite - follow label closely
                suitableFor: ['greens', 'golf_greens', 'fairways', 'tees', 'sports'],
                notes: 'Phosphite (not phosphate). Systemic. Disease suppression.',
                useCase: 'Pythium/disease pressure. Stress tolerance. Root health.',
            },
            {
                id: 'STARTP',
                name: 'Starter Plus Bloomtastic',
                brand: 'Growth Products',
                npk: '8-14-4',
                analysis: { N: 8, P: 14, K: 4 },
                form: 'liquid',
                packSize: 10,
                maxRateLHa: 20, // Label: 10-20 L/ha
                suitableFor: ['greens', 'golf_greens', 'fairways', 'sports', 'landscaping'],
                notes: 'High P starter. Root establishment.',
                useCase: 'New seeding. Renovation. Root development.',
            },
            {
                id: 'EZYFOLE',
                name: 'Ezyfoliar Enhance',
                brand: 'Ezyfoliar',
                npk: '7-0-3',
                analysis: { N: 7, P: 0, K: 3, Mg: 1.3, Mn: 0.3, S: 1.7, Fe: 3 },
                form: 'liquid',
                packSize: 20,
                maxRateLHa: 26, // Label: 18-26 L/ha
                suitableFor: ['greens', 'golf_greens', 'fairways', 'tees', 'sports'],
                notes: 'Low rate foliar. Frequent application. Contains micros.',
                useCase: 'Regular foliar program. Light feeding.',
            },
            {
                id: 'IRONM10',
                name: 'Ezyfoliar Iron Maxx',
                brand: 'Ezyfoliar',
                npk: '15-0-0',
                analysis: { N: 15, P: 0, K: 0, Fe: 6, Mn: 2, S: 3.5 },
                form: 'liquid',
                packSize: 10,
                maxRateLHa: 20, // Label: 4-20 L/ha
                suitableFor: ['greens', 'golf_greens', 'fairways', 'tees', 'sports'],
                notes: 'N + Fe combination. Colour and growth.',
                useCase: 'Combined N + Fe foliar application.',
            },
            {
                id: 'MICR10',
                name: 'Micrel Total',
                brand: 'Growth Products',
                npk: '5-0-0',
                analysis: { N: 5, P: 0, K: 0, Fe: 6, Mn: 0.5, S: 4 },
                form: 'liquid',
                packSize: 10,
                maxRateLHa: 10, // Label: 10 L/ha
                suitableFor: ['greens', 'golf_greens', 'fairways', 'tees', 'sports'],
                notes: 'Complete trace element package.',
                useCase: 'Micronutrient correction. General health.',
            },
            {
                id: 'MANGCH10',
                name: 'Manganese Chelate',
                brand: 'Growth Products',
                npk: '0-0-0',
                analysis: { N: 0, P: 0, K: 0, Mn: 5, S: 2 },
                form: 'liquid',
                packSize: 10,
                maxRateLHa: 13, // Label: 6-13 L/ha
                suitableFor: ['greens', 'golf_greens', 'fairways', 'tees', 'sports'],
                notes: 'Chelated Mn for high pH soils.',
                useCase: 'Mn deficiency. High pH correction.',
            },
            {
                id: 'BIOSEAW',
                name: 'Biopower Liquid Seaweed',
                brand: 'Biopower',
                npk: '0-0-0',
                analysis: { N: 0, P: 0, K: 0 },
                form: 'liquid',
                packSize: 20,
                maxRateLHa: 6, // Label: 3-6 L/ha
                suitableFor: ['greens', 'golf_greens', 'fairways', 'tees', 'sports', 'bowling_greens'],
                notes: 'Biostimulant. Stress tolerance. Root development.',
                useCase: 'Stress recovery. Root health. Tank mix additive.',
            },
            // ============================================================
            // SOLUBLE PHOSPHORUS - MAP Tech
            // ============================================================
            {
                id: 'MAPTECH',
                name: 'MAP Tech (soluble)',
                brand: 'Various',
                npk: '12-27-0',
                analysis: { N: 12, P: 27, K: 0 },
                form: 'soluble',
                packSize: 25, // kg bag
                maxRateKgHa: 20, // ~20kg in 400-600L water is practical limit
                suitableFor: ['greens', 'golf_greens', 'bowling_greens', 'cricket_wickets', 'tees', 'fairways', 'sports'],
                notes: 'Soluble MAP dissolved in spray tank (400-600L water/ha). Efficient P delivery. Slight acidifying.',
                useCase: 'P maintenance on fine turf. P deficiency correction. Foliar P application.',
            },
            // ============================================================
            // ICL SPORTSMASTER WSF - WATER SOLUBLE FERTILISERS
            // Cost-effective treatment for large areas (fairways, sports)
            // Also suitable for greens spoonfeeding at lower rates
            // Contains TMax technology for enhanced foliar/root uptake
            // ============================================================
            {
                id: 'WSF-HIGHN',
                name: 'Sportsmaster WSF High N',
                brand: 'ICL',
                npk: '35-0-14',
                analysis: { N: 35, P: 0, K: 14, Fe: 0.3 },
                form: 'soluble',
                packSize: 15, // kg bag
                maxRateKgHa: 50, // Label: 25-50 kg/ha fairways, 15-25 kg/ha greens
                greensMaxRateKgHa: 25, // Lower rate for greens spoonfeeding
                suitableFor: ['greens', 'golf_greens', 'bowling_greens', 'tees', 'fairways', 'sports'],
                notes: 'TMax technology. 300-600L water/ha foliar, 600-1000L for root uptake. Mixed N sources (urea + nitrate).',
                useCase: 'Quick N response. Fairway colour. Greens spoonfeeding. Tank mix with PGR.',
            },
            {
                id: 'WSF-HIGHK',
                name: 'Sportsmaster WSF High K',
                brand: 'ICL',
                npk: '15-0-43',
                analysis: { N: 15, P: 0, K: 43, Fe: 0.15 },
                form: 'soluble',
                packSize: 15, // kg bag
                maxRateKgHa: 50, // Label: 25-50 kg/ha
                greensMaxRateKgHa: 25,
                suitableFor: ['greens', 'golf_greens', 'bowling_greens', 'tees', 'fairways', 'sports'],
                notes: 'TMax technology. Low N:high K ratio. Pre-stress conditioning. May-December use.',
                useCase: 'Stress hardening. Winter prep. Low growth K boost.',
            },
            {
                id: 'WSF-SS',
                name: 'Sportsmaster WSF Spring & Summer',
                brand: 'ICL',
                npk: '24-5-15',
                analysis: { N: 24, P: 5, K: 15, Mg: 1.2, Fe: 0.15 },
                form: 'soluble',
                packSize: 15, // kg bag
                maxRateKgHa: 50, // Label: 25-50 kg/ha
                greensMaxRateKgHa: 25,
                suitableFor: ['greens', 'golf_greens', 'bowling_greens', 'tees', 'fairways', 'sports'],
                notes: 'TMax technology. Balanced NPK. Mixed N sources. Trace elements included.',
                useCase: 'Main season feeding. Balanced growth. Sep-Feb application.',
            },
            {
                id: 'WSF-IRON',
                name: 'Sportsmaster WSF Iron',
                brand: 'ICL',
                npk: '6-0-0',
                analysis: { N: 6, P: 0, K: 0, Fe: 19.5 },
                form: 'soluble',
                packSize: 15, // kg bag
                maxRateKgHa: 30, // Label: 15-30 kg/ha
                greensMaxRateKgHa: 20,
                suitableFor: ['greens', 'golf_greens', 'bowling_greens', 'tees', 'fairways', 'sports'],
                notes: 'TMax technology. High Fe for colour. Works in cold. Tank mix with Primo Maxx.',
                useCase: 'Colour without growth. Winter colour. Disease resistance.',
            },
            {
                id: 'WSF-SEAMAX',
                name: 'Sportsmaster WSF SeaMax',
                brand: 'ICL',
                npk: '4-0-15',
                analysis: { N: 4, P: 0, K: 15, Mo: 0.01 },
                form: 'soluble',
                packSize: 1, // kg bag - low rate product
                maxRateKgHa: 2, // Label: 1-2 kg/ha (very low rate)
                suitableFor: ['greens', 'golf_greens', 'bowling_greens', 'tees', 'fairways', 'sports'],
                notes: 'Ascophyllum nodosum seaweed extract. Low input rates. 100% soluble.',
                useCase: 'Biostimulant. Root health. Tank mix additive. Soil microbe support.',
                biological: true,
            },
            // ============================================================
            // SOLUBLE UREA - LO BIURET N SOURCE
            // ============================================================
            {
                id: 'SOL-UREA',
                name: 'Lo Biuret Urea (soluble)',
                brand: 'Various',
                npk: '46-0-0',
                analysis: { N: 46, P: 0, K: 0 },
                form: 'soluble',
                packSize: 20, // kg bag
                maxRateKgHa: 150,
                greensMaxRateKgHa: 20, // Keep low on greens - scorch risk
                suitableFor: ['greens', 'golf_greens', 'bowling_greens', 'tees', 'fairways', 'sports'],
                notes: 'Lo biuret grade (<0.3% biuret) safe for foliar. Dissolve fully. Risk of scorch at high rates.',
                useCase: 'Economical N source. Greens spoonfeeding. Fairway colour.',
            },
            // ============================================================
            // SOLUBLE SOP - POTASSIUM SOURCE
            // ============================================================
            {
                id: 'SOL-SOP',
                name: 'Soluble SOP (Potassium Sulphate)',
                brand: 'Various',
                npk: '0-0-41.5',
                analysis: { N: 0, P: 0, K: 41.5, S: 18 },
                form: 'soluble',
                packSize: 20, // kg bag
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
                brand: 'Various',
                npk: '21-0-0',
                analysis: { N: 21, P: 0, K: 0, S: 24 },
                form: 'soluble',
                packSize: 20, // kg bag
                maxRateKgHa: 150,
                greensMaxRateKgHa: 25,
                suitableFor: ['greens', 'golf_greens', 'bowling_greens', 'tees', 'fairways', 'sports'],
                notes: 'Quick release N with S. Acidifying effect. Good for high pH soils.',
                useCase: 'Spoonfeeding greens. Fairway colour. pH management.',
            },
            // ============================================================
            // SOLUBLE IRON SULPHATE - COLOUR WITHOUT N
            // ============================================================
            {
                id: 'SOL-FESO4',
                name: 'Iron Sulphate Hepta (soluble)',
                brand: 'Various',
                npk: '0-0-0',
                analysis: { N: 0, P: 0, K: 0, Fe: 19.5, S: 11 },
                form: 'soluble',
                packSize: 20, // kg bag
                maxRateKgHa: 10, // Low rates - can stain/scorch
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
                name: 'Magnesium Sulphate (soluble)',
                brand: 'Various',
                npk: '0-0-0',
                analysis: { N: 0, P: 0, K: 0, Mg: 9.8, S: 13 },
                form: 'soluble',
                packSize: 20, // kg bag
                maxRateKgHa: 10,
                greensMaxRateKgHa: 10,
                suitableFor: ['greens', 'golf_greens', 'bowling_greens', 'tees', 'fairways', 'sports'],
                notes: 'Epsom salts. Highly soluble. Foliar Mg correction.',
                useCase: 'Mg deficiency correction. Chlorophyll production. Tank mix.',
            },
            // ============================================================
            // SOLUBLE MANGANESE SULPHATE
            // ============================================================
            {
                id: 'SOL-MNSO4',
                name: 'Manganese Sulphate (soluble)',
                brand: 'Various',
                npk: '0-0-0',
                analysis: { N: 0, P: 0, K: 0, Mn: 31, S: 19 },
                form: 'soluble',
                packSize: 20, // kg bag
                maxRateKgHa: 25,
                greensMaxRateKgHa: 25,
                suitableFor: ['greens', 'golf_greens', 'bowling_greens', 'tees', 'fairways', 'sports'],
                notes: 'Foliar Mn source. Dissolve fully before application.',
                useCase: 'Mn deficiency correction. Enzyme activation. Take-all suppression.',
            },
        ],
    };

    // ========================================================================
    // RECOMMENDATION ENGINE
    // ========================================================================

    const PrebbleRecommender = {
        
        /**
         * Get product recommendations for monthly nutrient requirements
         * 
         * @param {Object} monthData - Single month from nutrition calendar
         *   { N: 15.2, P: 1.3, K: 7.1, Ca: 2.2, Mg: 1.1, S: 0.7, gp: 0.82, month_name: 'October', season: 'Spring' }
         * @param {Object} context - Site context
         *   { surfaceType: 'greens', methodology: 'mlsn', currentMonth: 10 }
         * @returns {Object} Recommended products with rates
         */
        getMonthlyRecommendation: function(monthData, context) {
            const surfaceType = this.normalizeSurfaceType(context.surfaceType);
            const season = this.getSeasonPhase(monthData.gp, monthData.season, context.currentMonth);
            
            // Get suitable products for this surface
            const suitableGranular = this.filterBySurface(PrebbleProducts.granular, surfaceType);
            const suitableLiquid = this.filterBySurface(PrebbleProducts.liquid, surfaceType);
            
            // Diagnostic logging
            
            if (suitableGranular.length === 0) {
                console.warn('[PrebbleRecommender] NO granular products match surface:', surfaceType);
            }
            
            // Get season-appropriate products
            const seasonGranular = this.filterByRelease(suitableGranular, season);
            
            const recommendations = {
                month: monthData.month_name,
                season: monthData.season,
                gp: monthData.gp,
                requirements: {
                    N: monthData.N,
                    P: monthData.P,
                    K: monthData.K,
                    Ca: monthData.Ca,
                    Mg: monthData.Mg,
                    S: monthData.S,
                },
                granular: [],
                liquid: [],
                notes: [],
            };
            
            // ================================================================
            // CHECK FOR ACTIVE SLOW-RELEASE
            // ================================================================
            // If previous slow-release is still providing >50% of monthly N need,
            // skip granular and optionally add foliar supplement
            const activeNutrients = context.activeNutrients || { N: 0, K: 0 };
            const skipGranular = context.skipGranular || false;
            const effectiveNRequired = Math.max(0, monthData.N - activeNutrients.N);
            const effectiveKRequired = Math.max(0, monthData.K - activeNutrients.K);
            
            // Create adjusted monthData for product selection
            const adjustedMonthData = {
                ...monthData,
                N: effectiveNRequired,
                K: effectiveKRequired,
            };
            
            // Primary N source recommendation - consider GP for delivery method
            if (effectiveNRequired > 0.5) { // Only if meaningful N still needed
                const gp = monthData.gp || 0;
                
                // If skipping granular due to active slow-release, use foliar only
                if (skipGranular && gp >= 0.25) {
                    // Only add foliar if there's still some deficit to cover
                    if (effectiveNRequired > 1) {
                        const foliarN = this.selectFoliarNitrogen(suitableLiquid, adjustedMonthData, context);
                        if (foliarN) {
                            recommendations.liquid.push(foliarN);
                            recommendations.notes.push(`Slow-release active - foliar top-up only (${effectiveNRequired.toFixed(1)} kg N/ha)`);
                        }
                    }
                } else if (gp < 0.3) {
                    // ================================================================
                    // LOW GP (< 30%): MESA GRANULAR + AMMOS 22 LIQUID
                    // ================================================================
                    // Winter program - ALWAYS apply both:
                    // 1. MESA granular - some quick N + slow N banked for spring
                    // 2. Ammos 22 liquid - immediate foliar N regardless of MESA
                    
                    const singleMonthN = monthData._singleMonthN || monthData.N;
                    
                    
                    // GREENS: For putting surfaces, use liquid-only winter program
                    const isGreens = ['greens', 'golf_greens', 'bowling_greens'].includes(context.surfaceType);
                    
                    if (isGreens) {
                        // For greens: liquid foliar only, no granular in winter
                        // Granular at low GP risks burn and poor uptake
                    } else {
                        // Find MESA products - prefer CC 100% for K content
                        const mesaProducts = seasonGranular.filter(p => 
                            p.releaseTech === 'mesa' && (p.analysis?.N || 0) >= 15
                        );
                        
                        // Prefer MESA, fall back to any slow-release granular when MESA not in pool
                        const winterCandidates = mesaProducts.length > 0 ? mesaProducts
                            : seasonGranular.filter(p => p.release === 'slow' && (p.analysis?.N || 0) >= 10);

                        if (winterCandidates.length > 0) {
                            const isMesa = mesaProducts.length > 0;
                            const bestMesa = winterCandidates.reduce((best, p) => {
                                const kPct = p.analysis?.K || 0;
                                const score = kPct >= 10 ? 20 : kPct > 0 ? 10 : 0;
                                return !best || score > best.score ? { product: p, score } : best;
                            }, null)?.product;

                            if (bestMesa) {
                                const nPct = bestMesa.analysis.N / 100;
                                const kPct = (bestMesa.analysis.K || 0) / 100;

                                // Winter rate: 150 kg/ha (moderate - not banking too much)
                                const rateKgHa = Math.min(150, bestMesa.maxRateKgHa || 150);

                                const totalN = rateKgHa * nPct;
                                const kDelivered = rateKgHa * kPct;

                                const granularProduct = {
                                    id: bestMesa.id,
                                    name: bestMesa.name,
                                    npk: bestMesa.npk,
                                    analysis: bestMesa.analysis,
                                    release: 'slow',
                                    releaseTech: bestMesa.releaseTech || (isMesa ? 'mesa' : 'pcm'),
                                    releaseWeeks: bestMesa.releaseWeeks || 6,
                                    rateKgHa: rateKgHa,
                                    rateGM2: (rateKgHa / 10).toFixed(1),
                                    nDelivered: Math.round(totalN * 10) / 10,
                                    kDelivered: Math.round(kDelivered * 10) / 10,
                                    splitCount: 1,
                                    notes: isMesa
                                        ? `Winter MESA: ${(totalN * 0.5).toFixed(0)} kg quick + ${(totalN * 0.5).toFixed(0)} kg slow`
                                        : `Winter slow-release: ${totalN.toFixed(0)} kg N/ha`,
                                };

                                recommendations.granular.push(granularProduct);
                            }
                        }
                    }

                    // Prefer Ammos 22 / Nitro liquid; fall back to any high-N liquid when not in pool
                    const ammos = suitableLiquid.find(p => p.name.includes('Ammos') || p.name.includes('Nitro'))
                        || suitableLiquid.filter(p => (p.analysis?.N || 0) >= 15).sort((a, b) => (b.analysis?.N || 0) - (a.analysis?.N || 0))[0]
                        || null;
                    if (ammos) {
                        const rateLHa = 30; // Standard 30L container
                        const nDelivered = rateLHa * (ammos.analysis.N / 100);
                        
                        const liquidProduct = {
                            id: ammos.id,
                            name: ammos.name,
                            npk: ammos.npk,
                            analysis: ammos.analysis,
                            form: 'liquid',
                            rateLHa: rateLHa,
                            rateMLM2: (rateLHa / 10).toFixed(1),
                            nDelivered: Math.round(nDelivered * 10) / 10,
                            kDelivered: 0,
                            splitCount: 1,
                            deliveryMethod: 'foliar',
                            notes: `Winter foliar: 30L container`,
                        };
                        
                        recommendations.liquid.push(liquidProduct);
                        // GH-256: previously a hardcoded "MESA + liquid foliar" note
                        // regardless of what was actually selected above (could be
                        // Ammos/Nitro, any other high-N liquid, or nothing at all —
                        // "MESA" isn't even a candidate in this branch's selection
                        // logic) and fired unconditionally even when `ammos` was
                        // null, so the note could claim a foliar application that
                        // never happened. Now names the actual selected product and
                        // only fires when one was found.
                        recommendations.notes.push(`Low GP (${(gp * 100).toFixed(0)}%) - winter program: ${liquidProduct.name} foliar top-up`);
                    } else {
                        recommendations.notes.push(`Low GP (${(gp * 100).toFixed(0)}%) - winter program: no suitable liquid nitrogen source available`);
                    }
                } else if (gp < 0.5) {
                    // Moderate GP (30-50%) - granular works fine, no need for foliar split on sportsturf
                    const nProduct = this.selectNitrogenSource(seasonGranular, monthData, context);
                    if (nProduct) {
                        recommendations.granular.push(nProduct);
                    } else {
                        // Greens: N requirement too low for min granular rate - use liquid
                        const isGreens = ['greens', 'golf_greens', 'bowling_greens'].includes(context.surfaceType);
                        if (isGreens && monthData.N > 2) {
                            const ammos = suitableLiquid.find(p => p.name.includes('Ammos') || p.name.includes('Nitro'));
                            if (ammos) {
                                let rateLHa = Math.ceil((monthData.N / 0.22) / 10) * 10; // Round to 10L
                                rateLHa = Math.min(rateLHa, 30);
                                const nDelivered = rateLHa * 0.22;
                                recommendations.liquid.push({
                                    id: ammos.id, name: ammos.name, npk: ammos.npk,
                                    analysis: ammos.analysis, form: 'liquid',
                                    rateLHa, rateMLM2: (rateLHa / 10).toFixed(1),
                                    nDelivered: Math.round(nDelivered * 10) / 10, kDelivered: 0,
                                    splitCount: 1, deliveryMethod: 'foliar',
                                    notes: `Low N month - liquid only (${rateLHa}L)`,
                                });
                            }
                        }
                    }
                } else {
                    // High GP - granular dominant, soil uptake efficient
                    const nProduct = this.selectNitrogenSource(seasonGranular, monthData, context);
                    if (nProduct) {
                        recommendations.granular.push(nProduct);
                    } else {
                        // Greens: N requirement too low for min granular rate - use liquid
                        const isGreens = ['greens', 'golf_greens', 'bowling_greens'].includes(context.surfaceType);
                        if (isGreens && monthData.N > 2) {
                            const ammos = suitableLiquid.find(p => p.name.includes('Ammos') || p.name.includes('Nitro'));
                            if (ammos) {
                                let rateLHa = Math.ceil((monthData.N / 0.22) / 10) * 10; // Round to 10L
                                rateLHa = Math.min(rateLHa, 30);
                                const nDelivered = rateLHa * 0.22;
                                recommendations.liquid.push({
                                    id: ammos.id, name: ammos.name, npk: ammos.npk,
                                    analysis: ammos.analysis, form: 'liquid',
                                    rateLHa, rateMLM2: (rateLHa / 10).toFixed(1),
                                    nDelivered: Math.round(nDelivered * 10) / 10, kDelivered: 0,
                                    splitCount: 1, deliveryMethod: 'foliar',
                                    notes: `Low N month - liquid only (${rateLHa}L)`,
                                });
                            }
                        } else {
                            console.warn('[PrebbleRecommender] NO N product selected for', monthData.month_name, 
                                'GP:', monthData.gp, 'N required:', monthData.N);
                        }
                    }
                }
            }
            
            // ================================================================
            // PER-MONTH K SUPPLEMENTATION — REMOVED b35fix332
            // ================================================================
            // Pre-b35fix332 this block computed per-month kDeficit (monthData.K
            // - K-from-N-products - K-from-active-slow-release) and, when
            // > 5 kg K/ha and !skipGranular, called selectPotassiumSource to
            // push a K product onto the month.
            //
            // Removed for the same reasons the AU equivalent was removed in
            // b35fix330 — though the surface form-gate symptom (granular
            // returns silently dropped) does NOT apply here (Prebble's
            // consumer correctly pushes granular to recommendations.granular).
            // The other two defects do apply:
            //
            //   1. Missing soil-K sanity gate (Item 1a class). The kDeficit
            //      threshold is purely arithmetic on programme balance. On a
            //      sample with soil K in the SLAN sufficiency range and
            //      SLAN-midpoint inflation pushing monthData.K above catalogue
            //      delivery, this path applied K to soil that did not need K.
            //      b35fix324 _synthesiseKReconDecision defends against this
            //      with Gate 2 (soilData.K < soilData.thresholds.K.min).
            //
            //   2. No coordination with b35fix324 K-recon. The product pushed
            //      by selectPotassiumSource lands in program.annualSummary.
            //      products (via the aggregator at ~line 364) with regular
            //      nutrients.K and NO _isAmendment flag. _computeProgrammeKDelivered
            //      sums it into kDelivered, which feeds the K-recon balance
            //      gate (kDelivered − kRequired < −20). A genuine programme
            //      deficit is masked, and the more carefully gated split-SOP
            //      from _synthesiseKReconDecision does not fire where it
            //      otherwise would.
            //
            //   3. Duplicates Phase 3 annual K balancing intent (line ~1885,
            //      also removed in b35fix332). Phase 3 was season-aware
            //      (autumn/late-season targeting via summerAutumnMonths sort)
            //      and product-specific (LIQPOT 0-0-20, SOL-SOP). Per-month
            //      K-supplement ran first and partly substituted for it
            //      without the targeting.
            //
            // The architected greens-K path on Prebble remains untouched —
            // per-month spoonfeeding embedded in the main month loop
            // (~lines 1025, 1107, 1132, 1539+) using LIQPOT/SOL-AS scaled by
            // isGreens ? 4 : 10 kg per app. Sportsfield K deficits flow
            // through b35fix324's _synthesiseKReconDecision, gated on both
            // programme balance AND soil-K floor.
            //
            // selectPotassiumSource function definition at line ~2950 is also
            // removed in b35fix332 (no remaining callers).
            //
            // Verification by absence: post-deploy Prebble exports should
            // contain zero "K supplement: dissolve N kg/ha" or "K supplement:
            // NL container" strings in Monthly Schedule notes. If they
            // reappear: stale cached build, or third-party patch reintroducing
            // the path.
            // ================================================================

            // ============================================================
            // P SUPPLEMENTATION
            // ============================================================
            // Track P delivered by selected N products
            const pFromGranular = recommendations.granular.reduce((sum, p) => {
                const pPct = (p.analysis?.P || 0) / 100;
                return sum + (p.rateKgHa * pPct);
            }, 0);
            const pFromLiquid = recommendations.liquid.reduce((sum, p) => {
                const pPct = (p.analysis?.P || 0) / 100;
                return sum + ((p.rateLHa || p.rateKgHa || 0) * pPct);
            }, 0);
            const pDelivered = pFromGranular + pFromLiquid;
            const pRequired = monthData.P || 0;
            const pDeficit = pRequired - pDelivered;
            
            // Store P deficit for later consolidation
            recommendations.pDeficit = pDeficit;
            
            // ============================================================
            // P APPLICATION STRATEGY (Annual Planning)
            // ============================================================
            // If annual planning designated this as THE P application month,
            // apply the full annual P requirement in one strategic application.
            // Otherwise, skip P supplementation entirely.
            const isPApplicationMonth = context.isPApplicationMonth || false;
            const annualPRequired = context.annualPRequired || 0;
            const annualPDelivered = context.annualPDelivered || 0;
            const annualPRemaining = Math.max(0, annualPRequired - annualPDelivered);
            
            // Legacy mode: Only if no annual planning, use old month-by-month logic
            const isStrategicPMonth = monthData.gp >= 0.4 && 
                                      ['spring', 'autumn', 'Spring', 'Autumn'].some(s => 
                                          (monthData.season || '').toLowerCase().includes(s.toLowerCase()));
            
            // Determine if we should apply P this month
            let shouldApplyP = false;
            let pToApply = 0;
            
            if (isPApplicationMonth && annualPRemaining > 2) {
                // ANNUAL PLANNING MODE: Apply remaining annual P requirement now
                shouldApplyP = true;
                pToApply = annualPRemaining;
            } else if (!context.excludeStarters && !isPApplicationMonth) {
                // LEGACY MODE: Only if annual planning didn't designate a P month
                // Apply P if deficit > 3 kg/ha (urgent)
                if (pDeficit > 3) {
                    shouldApplyP = true;
                    pToApply = pDeficit;
                }
            }
            
            if (shouldApplyP && pToApply > 0) {
                const isEstablishment = context.establishment || context.seeding || context.renovation || false;
                const isPDeficient = context.pDeficient || false;
                
                // Select P source - allow high-P starters for designated P month
                const pProduct = this.selectPhosphorusSource(suitableGranular, suitableLiquid, pToApply, isEstablishment || isPDeficient || isPApplicationMonth);
                
                if (pProduct) {
                    if (pProduct.form === 'liquid' || pProduct.form === 'soluble') {
                        recommendations.liquid.push(pProduct);
                    } else {
                        recommendations.granular.push(pProduct);
                    }
                    const notePrefix = isPApplicationMonth ? 'Strategic P application' : 'P supplement';
                    recommendations.notes.push(`${notePrefix}: ${pToApply.toFixed(1)} kg P/ha`);
                } else {
                    recommendations.notes.push(`P deficit: ${pToApply.toFixed(1)} kg/ha - consider DAP or SSP`);
                }
            }
            
            // Track P delivery in recommendations
            recommendations.pDelivered = Math.round((pDelivered + (shouldApplyP ? pToApply : 0)) * 10) / 10;
            recommendations.pRequired = Math.round(pRequired * 10) / 10;
            
            // Add context notes
            if (monthData.gp < 0.25) {
                recommendations.notes.push('Low growth period - consider reducing rates or skipping application');
            }
            if (season === 'summer_stress') {
                recommendations.notes.push('Stress period - avoid quick-release N, favour K for hardening');
            }
            
            return recommendations;
        },
        
        /**
         * Generate full program recommendations from nutrition calendar
         * 
         * @param {Object} calendar - Full calendar output from Gilba_Nutrition_Calendar
         * @param {Object} context - Site context
         * @returns {Object} Complete product program
         */
        generateProgram: function(calendar, context) {
            if (!calendar || !calendar.program || !calendar.program.monthly) {
                return { error: 'Invalid calendar data' };
            }
            
            const program = {
                meta: {
                    generated: new Date().toISOString(),
                    methodology: (function() {
                        // context.methodology is the authoritative value from getMethodology()
                        // which reads Settings first. calendar.soil.methodology may be stale
                        // (DOM read by nutrition-calendar.js which defaults to 'mlsn').
                        const raw = context.methodology || calendar.soil?.methodology || 'mlsn';
                        // Map cotula_s78/cotula → ammonium_acetate
                        if (raw === 'cotula_s78' || raw === 'cotula') return 'ammonium_acetate';
                        // If surface is bowls/cotula, AA is the correct methodology
                        const _isCotula = context.surfaceType === 'bowling_greens'
                            || context.surfaceType === 'cotula_bowling_green'
                            || (window.GAIP_STATE?.turf?.cotula === true)
                            || (window.GaipTurfProfile?.state?.turfType === 'bowls')
                            || (window.gaipTurfProfile?.state?.turfType === 'bowls');
                        if (_isCotula) return 'ammonium_acetate';
                        return raw;
                    })(),
                    surfaceType: context.surfaceType,
                    version: PrebbleProducts.version,
                },
                monthly: [],
                annualSummary: {
                    products: {},
                    totalCost: null,
                },
            };
            
            // ================================================================
            // ANNUAL PLANNING - PHASE 1: Calculate totals and strategy
            // ================================================================
            const monthlyData = calendar.program.monthly;
            const hemisphere = context.hemisphere || calendar.meta?.hemisphere || 'south';
            
            // Calculate annual requirements
            const annualN = monthlyData.reduce((sum, m) => sum + (m.N || 0), 0);
            const annualP = monthlyData.reduce((sum, m) => sum + (m.P || 0), 0);
            const annualK = monthlyData.reduce((sum, m) => sum + (m.K || 0), 0);
            
            // Is soil P deficient? If so, plan ONE strategic P application
            const soilPDeficient = context.pDeficient || (context.soilPpm?.P < 10) || false;
            const soilKDeficient = context.soilPpm?.K < 50 || false;
            
            // Find spring months (strategic P timing) - month indices
            const springMonths = hemisphere === 'south' 
                ? [8, 9, 10] // Sep, Oct, Nov
                : [2, 3, 4]; // Mar, Apr, May
            
            // Find summer/autumn months (strategic K timing)
            const summerAutumnMonths = hemisphere === 'south'
                ? [0, 1, 2, 3, 4] // Jan-May
                : [5, 6, 7, 8, 9]; // Jun-Oct
            
            // Track P application - if deficient, use ONE in early spring
            let pApplicationMonth = null;
            if (soilPDeficient && annualP > 5) {
                // Find first spring month with GP > 0.4
                pApplicationMonth = springMonths.find(idx => 
                    monthlyData[idx] && monthlyData[idx].gp >= 0.4
                ) ?? springMonths[0];
            }
            
            // Track cumulative delivery
            const delivered = { N: 0, P: 0, K: 0 };
            
            // ================================================================
            // APPLICATION WINDOW TRACKING
            // ================================================================
            // Track which months are "covered" by previous slow-release applications
            // Format: { coveredByProduct, coveredByMonth, remainingN, remainingK }
            const coveredMonths = new Array(12).fill(null);
            
            // ================================================================
            // ANNUAL PLANNING - PHASE 2: Generate monthly recommendations
            // Using APPLICATION WINDOW approach:
            // - When applying slow-release, calculate how many months it covers
            // - Mark subsequent months as "covered" 
            // - Skip granular selection for covered months
            // ================================================================
            monthlyData.forEach((monthData, index) => {
                // Check if this month is covered by a previous application
                const coverage = coveredMonths[index];
                const isCovered = coverage && coverage.remainingN > (monthData.N * 0.3);
                
                // Estimate soil temperature for this specific month
                const monthlySoilTemp = this.estimateMonthlySoilTemp(
                    monthData.month_num,
                    context.latitude || calendar.meta?.latitude || -35,
                    hemisphere,
                    context.soilTemp
                );
                
                // Build month context
                const monthContext = {
                    ...context,
                    currentMonth: monthData.month_num,
                    soilTemp: monthlySoilTemp,
                    isPApplicationMonth: index === pApplicationMonth,
                    annualPRequired: annualP,
                    annualPDelivered: delivered.P,
                    annualKRequired: annualK,
                    annualKDelivered: delivered.K,
                    excludeStarters: soilPDeficient && index !== pApplicationMonth,
                    // APPLICATION WINDOW FLAGS
                    skipGranular: isCovered,
                    activeNutrients: coverage ? { N: coverage.remainingN, K: coverage.remainingK } : { N: 0, K: 0 },
                };
                
                // If covered, create a simplified recommendation
                if (isCovered) {
                    
                    const rec = {
                        month: monthData.month_name,
                        month_num: monthData.month_num,
                        season: monthData.season,
                        gp: monthData.gp,
                        requirements: { N: monthData.N, P: monthData.P || 0, K: monthData.K || 0 },
                        granular: [],
                        liquid: [],
                        notes: [`Covered by ${coverage.coveredByProduct} (${coverage.coveredByMonth})`],
                        coveredBy: {
                            product: coverage.coveredByProduct,
                            month: coverage.coveredByMonth,
                            remainingN: coverage.remainingN,
                            remainingK: coverage.remainingK,
                        },
                    };
                    
                    // Still add foliar for covered months - ESPECIALLY for low GP
                    const gp = monthData.gp || 0;
                    
                    
                    if (gp < 0.3) {
                        // Low GP covered month - add Ammos 22 liquid anyway
                        // Granular coverage may not be releasing effectively in cold soil
                        
                        const ammos = this.filterBySurface(PrebbleProducts.liquid, context.surfaceType)
                            .find(p => p.name.includes('Ammos') || p.name.includes('Nitro'));
                        
                        if (ammos) {
                            const rateLHa = 30; // Standard 30L container
                            const nDelivered = rateLHa * (ammos.analysis.N / 100);
                            
                            rec.liquid.push({
                                id: ammos.id,
                                name: ammos.name,
                                npk: ammos.npk,
                                analysis: ammos.analysis,
                                form: 'liquid',
                                rateLHa: rateLHa,
                                rateMLM2: (rateLHa / 10).toFixed(1),
                                nDelivered: Math.round(nDelivered * 10) / 10,
                                kDelivered: 0,
                                splitCount: 1,
                                deliveryMethod: 'foliar',
                                notes: `Winter foliar: 30L container (granular coverage limited in cold soil)`,
                            });
                            // GH-256: name the actual selected product instead of a
                            // hardcoded "Ammos 22" — safe today (this branch's search
                            // only ever matches Ammos/Nitro-named products) but not
                            // future-proof against a catalogue change, same principle
                            // as the MESA note fixed above.
                            rec.notes.push(`Low GP (${(gp * 100).toFixed(0)}%) - ${ammos.name} foliar supplement`);
                            
                        }
                    } else {
                        // Normal GP - only add foliar if there's a significant gap
                        const nGap = monthData.N - coverage.remainingN;
                        if (nGap > 5) {
                            const foliarN = this.selectFoliarNitrogen(
                                this.filterBySurface(PrebbleProducts.liquid, context.surfaceType),
                                { ...monthData, N: nGap },
                                monthContext
                            );
                            if (foliarN) {
                                rec.liquid.push(foliarN);
                                rec.notes.push(`Foliar top-up: ${nGap.toFixed(1)} kg N/ha`);
                            }
                        }
                    }
                    
                    program.monthly.push(rec);
                    
                    // Update cumulative delivery from coverage + any liquid added
                    delivered.N += Math.min(coverage.remainingN, monthData.N);
                    delivered.K += Math.min(coverage.remainingK, monthData.K);
                    
                    // Add liquid delivery to cumulative AND track in annual summary
                    rec.liquid.forEach(liq => {
                        const splitCount = liq.splitCount || 1;
                        delivered.N += (liq.nDelivered || 0);
                        delivered.K += (liq.kDelivered || 0);
                        
                        // Track in annual summary (same as main loop)
                        if (!program.annualSummary.products[liq.id]) {
                            program.annualSummary.products[liq.id] = {
                                name: liq.name,
                                totalKg: 0,
                                applications: 0,
                                release: liq.release || 'standard',
                                releaseTech: liq.releaseTech || 'standard',
                                analysis: liq.analysis || {},
                                nutrients: { N: 0, P: 0, K: 0 },
                                isLiquid: true,
                            };
                        }
                        const rate = liq.rateLHa || 0;
                        program.annualSummary.products[liq.id].totalKg += rate * splitCount;
                        program.annualSummary.products[liq.id].applications += splitCount;
                        
                        const analysis = liq.analysis || {};
                        program.annualSummary.products[liq.id].nutrients.N += rate * splitCount * (analysis.N || 0) / 100;
                        program.annualSummary.products[liq.id].nutrients.P += rate * splitCount * (analysis.P || 0) / 100;
                        program.annualSummary.products[liq.id].nutrients.K += rate * splitCount * (analysis.K || 0) / 100;
                    });
                    
                    // Decay coverage for next month
                    if (coveredMonths[index + 1] === coverage) {
                        // Same coverage object - reduce remaining
                        coverage.remainingN -= monthData.N * 0.8; // Assume 80% uptake
                        coverage.remainingK -= monthData.K * 0.8;
                    }
                    
                    return; // Skip to next month
                }
                
                // NOT COVERED - Generate full recommendation
                // ================================================================
                // APPLICATION WINDOW RATE CALCULATION
                // ================================================================
                // For slow-release products on sports/fairways, calculate combined 
                // requirements for this month + the months the product will cover.
                // GREENS: No window - single month requirements only (spoonfeeding)
                
                const isGreens = ['greens', 'golf_greens', 'bowling_greens'].includes(context.surfaceType);
                
                let windowN = monthData.N;
                let windowK = monthData.K;
                let windowMonths = 0;
                
                if (!isGreens) {
                    // Look ahead to estimate combined requirements (assume 2-3 month window for slow-release)
                    windowMonths = 2; // Conservative: assume product covers ~2 months
                    for (let i = 1; i <= windowMonths && (index + i) < monthlyData.length; i++) {
                        // Only add future month requirements if not already covered and has growth
                        if (!coveredMonths[index + i] && monthlyData[index + i].gp >= 0.25) {
                            windowN += monthlyData[index + i].N || 0;
                            windowK += monthlyData[index + i].K || 0;
                        }
                    }
                }
                // For greens: windowN/K stays as single month values
                
                // Create adjusted month data with window requirements for product selection
                const windowMonthData = {
                    ...monthData,
                    N: windowN,
                    K: windowK,
                    _isWindowCalculation: !isGreens,
                    _windowMonths: windowMonths + 1, // Including current month
                    _singleMonthN: monthData.N, // Original single-month N for low GP foliar
                    _singleMonthK: monthData.K, // Original single-month K for low GP foliar
                };
                
                
                const rec = this.getMonthlyRecommendation(windowMonthData, monthContext);
                
                // Restore original month data for display
                rec.requirements = { N: monthData.N, P: monthData.P || 0, K: monthData.K || 0 };
                if (windowN > monthData.N * 1.5) {
                    rec.notes.push(`Application sized for ${windowMonths + 1} month window`);
                }
                
                // ================================================================
                // APPLICATION WINDOW: Mark future months as covered
                // GREENS: Disabled - spoonfeeding approach, no multi-month coverage
                // ================================================================
                // Note: isGreens already declared above in window calculation section
                
                if (!isGreens) {
                    let coverageSet = false;
                    
                    // First check granular slow-release products (6+ weeks)
                    rec.granular.forEach(product => {
                        const releaseWeeks = product.releaseWeeks || 4;
                        if (releaseWeeks >= 6) { // 6+ weeks = covers at least 1.5 months
                            const coverageMonths = Math.floor(releaseWeeks / 4); // ~4 weeks per month
                            const totalN = product.nDelivered || (product.rateKgHa * (product.analysis?.N || 0) / 100);
                            const totalK = product.kDelivered || (product.rateKgHa * (product.analysis?.K || 0) / 100);
                            
                            
                            // Mark future months as covered
                            const coverageObj = {
                                coveredByProduct: product.name,
                                coveredByMonth: monthData.month_name,
                                remainingN: totalN,
                                remainingK: totalK,
                            };
                            
                            for (let i = 1; i <= coverageMonths && (index + i) < 12; i++) {
                                // Decay remaining nutrients for each future month
                                const decayFactor = 1 - (i * 0.3); // 30% decay per month
                                coveredMonths[index + i] = {
                                    ...coverageObj,
                                    remainingN: totalN * Math.max(0.2, decayFactor),
                                    remainingK: totalK * Math.max(0.2, decayFactor),
                                };
                            }
                            coverageSet = true;
                        }
                    });
                    
                    // v10.3.37 FIX: If no slow-release coverage but we DID a window calculation,
                    // mark future months as covered anyway. The window N already included those months,
                    // so we must not re-calculate their requirements.
                    // This fixes the Ezyreno bug where standard-release products covering a window
                    // would cause each month to independently apply the same product.
                    if (!coverageSet && windowMonths > 0) {
                        const allProducts = [...rec.granular, ...rec.liquid];
                        const mainProduct = allProducts[0];
                        
                        // Calculate what was delivered
                        const totalNDelivered = allProducts.reduce((sum, p) => {
                            const rate = p.rateKgHa || p.rateLHa || 0;
                            const splitCount = p.splitCount || 1;
                            return sum + (rate * splitCount * (p.analysis?.N || 0) / 100);
                        }, 0);
                        
                        if (mainProduct) {
                            
                            // Distribute remaining N across covered months
                            const nPerCoveredMonth = totalNDelivered / (windowMonths + 1);
                            
                            for (let i = 1; i <= windowMonths && (index + i) < 12; i++) {
                                const futureMonthN = monthlyData[index + i]?.N || 0;
                                // Remaining N decays but should cover at least 50% of requirement
                                const decayFactor = 1 - (i * 0.25);
                                coveredMonths[index + i] = {
                                    coveredByProduct: mainProduct.name,
                                    coveredByMonth: monthData.month_name,
                                    remainingN: Math.max(futureMonthN * 0.5, nPerCoveredMonth * decayFactor),
                                    remainingK: 0,
                                    windowCoverage: true,
                                };
                            }
                        }
                    }
                } else {
                }
                
                // Update cumulative delivery
                [...rec.granular, ...rec.liquid].forEach(product => {
                    const rate = product.rateKgHa || product.rateLHa || 0;
                    const splitCount = product.splitCount || 1;
                    const analysis = product.analysis || {};
                    delivered.N += rate * splitCount * (analysis.N || 0) / 100;
                    delivered.P += rate * splitCount * (analysis.P || 0) / 100;
                    delivered.K += rate * splitCount * (analysis.K || 0) / 100;
                });
                
                program.monthly.push(rec);
                
                // Accumulate annual product usage
                [...rec.granular, ...rec.liquid].forEach(product => {
                    if (!program.annualSummary.products[product.id]) {
                        program.annualSummary.products[product.id] = {
                            name: product.name,
                            totalKg: 0,
                            applications: 0,
                            release: product.release || 'standard',
                            releaseTech: product.releaseTech || 'standard',
                            analysis: product.analysis || {},
                            nutrients: { N: 0, P: 0, K: 0 },
                        };
                    }
                    const rate = product.rateKgHa || product.rateLHa || 0;
                    const splitCount = product.splitCount || 1;
                    
                    // Account for split applications - rate is PER APPLICATION
                    program.annualSummary.products[product.id].totalKg += rate * splitCount;
                    program.annualSummary.products[product.id].applications += splitCount;
                    
                    const analysis = product.analysis || {};
                    program.annualSummary.products[product.id].nutrients.N += rate * splitCount * (analysis.N || 0) / 100;
                    program.annualSummary.products[product.id].nutrients.P += rate * splitCount * (analysis.P || 0) / 100;
                    program.annualSummary.products[product.id].nutrients.K += rate * splitCount * (analysis.K || 0) / 100;
                    
                    if (product.form === 'liquid' || product.form === 'soluble' || product.rateLHa) {
                        program.annualSummary.products[product.id].isLiquid = true;
                    }
                });
            });
            
            // ================================================================
            // PHASE 3: PRECISION BALANCING - Hit annual N/K targets precisely
            // ================================================================
            // v1.33.0: New balancing strategy - calculate exact deficits/surpluses
            // v1.34.0: Added surplus reduction - scale back rates when over-delivering
            // Target: achieve 95-105% of annual targets
            
            // Calculate ACTUAL nutrients delivered from annual summary
            let actualNDelivered = 0;
            let actualKDelivered = 0;
            let actualPDelivered = 0;
            Object.values(program.annualSummary.products).forEach(p => {
                actualNDelivered += p.nutrients.N || 0;
                actualKDelivered += p.nutrients.K || 0;
                actualPDelivered += p.nutrients.P || 0;
            });
            
            
            // Surface type affects balancing strategy
            const isGreens = ['greens', 'golf_greens', 'bowling_greens'].includes(context.surfaceType);
            
            // ----------------------------------------------------------------
            // SURPLUS REDUCTION - Scale back rates when over-delivering
            // ----------------------------------------------------------------
            // Only reduce if surplus > 10% of target (significant overage)
            const nSurplusPct = annualN > 0 ? ((actualNDelivered - annualN) / annualN) * 100 : 0;
            const kSurplusPct = annualK > 0 ? ((actualKDelivered - annualK) / annualK) * 100 : 0;
            
            // Reduce N if surplus > 10%
            if (nSurplusPct > 10) {
                const targetReduction = actualNDelivered - annualN;
                
                // Calculate scale factor to hit target (with 2% buffer)
                const nScaleFactor = (annualN * 1.02) / actualNDelivered;
                
                // Apply reduction to granular products (biggest N contributors)
                // Sort products by N contribution (highest first)
                const productsByN = Object.entries(program.annualSummary.products)
                    .filter(([id, p]) => (p.nutrients.N || 0) > 5 && !p.isBalancing)
                    .sort((a, b) => (b[1].nutrients.N || 0) - (a[1].nutrients.N || 0));
                
                let nReduced = 0;
                const targetNReduction = targetReduction * 0.95; // Aim to reduce 95% of surplus
                
                for (const [productId, productData] of productsByN) {
                    if (nReduced >= targetNReduction) break;
                    
                    const originalN = productData.nutrients.N || 0;
                    const originalK = productData.nutrients.K || 0;
                    const originalP = productData.nutrients.P || 0;
                    const originalKg = productData.totalKg || 0;
                    
                    // Don't reduce below 70% of original rate (maintain efficacy)
                    const minScaleFactor = 0.70;
                    const effectiveScale = Math.max(nScaleFactor, minScaleFactor);
                    
                    // Calculate new values
                    const newN = originalN * effectiveScale;
                    const newK = originalK * effectiveScale;
                    const newP = originalP * effectiveScale;
                    const newKg = originalKg * effectiveScale;
                    
                    const nReduction = originalN - newN;
                    
                    // Update annual summary
                    productData.nutrients.N = Math.round(newN * 10) / 10;
                    productData.nutrients.K = Math.round(newK * 10) / 10;
                    productData.nutrients.P = Math.round(newP * 10) / 10;
                    productData.totalKg = Math.round(newKg);
                    productData.rateReduced = true;
                    productData.reductionPct = Math.round((1 - effectiveScale) * 100);
                    
                    // Update monthly recommendations
                    program.monthly.forEach((monthRec, monthIdx) => {
                        // Update granular
                        monthRec.granular.forEach(g => {
                            if (g.id === productId || g.name === productData.name) {
                                const oldRate = g.rateKgHa || 0;
                                g.rateKgHa = Math.round(oldRate * effectiveScale);
                                g.nDelivered = Math.round((g.nDelivered || 0) * effectiveScale * 10) / 10;
                                g.kDelivered = Math.round((g.kDelivered || 0) * effectiveScale * 10) / 10;
                                g.rateReduced = true;
                                if (!monthRec.notes.some(n => n.includes('Rate reduced'))) {
                                    monthRec.notes.push(`Rate reduced ${productData.reductionPct}% to hit annual N target`);
                                }
                            }
                        });
                        // Update liquid (in case Ammos was added earlier)
                        monthRec.liquid.forEach(l => {
                            if ((l.id === productId || l.name === productData.name) && !l.isBalancing) {
                                const oldRate = l.rateLHa || 0;
                                l.rateLHa = Math.round(oldRate * effectiveScale);
                                l.nDelivered = Math.round((l.nDelivered || 0) * effectiveScale * 10) / 10;
                                l.kDelivered = Math.round((l.kDelivered || 0) * effectiveScale * 10) / 10;
                                l.rateReduced = true;
                            }
                        });
                    });
                    
                    nReduced += nReduction;
                    actualNDelivered -= nReduction;
                    actualKDelivered -= (originalK - newK);
                    
                }
                
            }
            
            // Reduce K if surplus > 15% (K surplus is less critical than N)
            if (kSurplusPct > 15 && nSurplusPct <= 10) {
                // Only reduce K-heavy products if we're not already reducing for N
                // (N reduction will also reduce K proportionally)
                const targetKReduction = actualKDelivered - annualK;
                // K-only reduction is complex (would need to swap products), so just log for now
                // The N reduction above will help if products have proportional K
            }
            
            // Recalculate after surplus reduction
            actualNDelivered = 0;
            actualKDelivered = 0;
            Object.values(program.annualSummary.products).forEach(p => {
                actualNDelivered += p.nutrients.N || 0;
                actualKDelivered += p.nutrients.K || 0;
            });
            
            
            // ----------------------------------------------------------------
            // NITROGEN BALANCING (deficits)
            // ----------------------------------------------------------------
            // Threshold: 5 kg/ha for all surfaces (tighter than before)
            const nDeficit = annualN - actualNDelivered;
            const nSurplus = actualNDelivered - annualN;
            
            if (nDeficit > 5) {
                
                // Find best months for N application (high GP, not already overloaded)
                const balancingMonths = monthlyData
                    .map((m, idx) => ({ ...m, idx }))
                    .filter(m => m.gp >= 0.4) // Reasonable growth
                    .sort((a, b) => b.gp - a.gp);
                
                // Choose product based on deficit size and surface
                const ammos = PrebbleProducts.liquid.find(p => p.name.includes('Ammos') || p.name.includes('Nitro'));
                const solAS = PrebbleProducts.soluble?.find(p => p.id === 'SOL-AS');
                
                let remainingNDeficit = nDeficit;
                
                // Spread across 1-3 months depending on deficit size
                const monthsToUse = Math.min(
                    Math.ceil(nDeficit / (isGreens ? 8 : 20)), // 8kg/app greens, 20kg/app sports
                    balancingMonths.length,
                    3
                );
                
                for (let i = 0; i < monthsToUse && remainingNDeficit > 2; i++) {
                    const month = balancingMonths[i];
                    if (!month) break;
                    
                    const rec = program.monthly[month.idx];
                    const nForThisApp = Math.min(remainingNDeficit, isGreens ? 8 : 20);
                    
                    // Use Ammos 22 (liquid) for precision
                    if (ammos) {
                        // Calculate exact rate: nForThisApp = rateLHa * 0.22
                        let rateLHa = nForThisApp / 0.22;
                        // Round to nearest 5L for practical application
                        rateLHa = Math.round(rateLHa / 5) * 5;
                        rateLHa = Math.max(5, Math.min(rateLHa, isGreens ? 30 : 50));
                        
                        const nDelivered = rateLHa * 0.22;
                        
                        const balanceProduct = {
                            id: ammos.id + '-BAL',
                            name: ammos.name,
                            npk: ammos.npk,
                            analysis: ammos.analysis,
                            form: 'liquid',
                            rateLHa: rateLHa,
                            rateMLM2: (rateLHa / 10).toFixed(1),
                            nDelivered: Math.round(nDelivered * 10) / 10,
                            kDelivered: 0,
                            splitCount: 1,
                            deliveryMethod: 'foliar',
                            isBalancing: true,
                            notes: `N balancing (+${nDelivered.toFixed(1)} kg N/ha to hit annual target)`,
                        };
                        
                        rec.liquid.push(balanceProduct);
                        rec.notes.push(`N balance: ${ammos.name} @ ${rateLHa} L/ha`);
                        
                        // Track in annual summary
                        const balanceId = ammos.id + '-BAL';
                        if (!program.annualSummary.products[balanceId]) {
                            program.annualSummary.products[balanceId] = {
                                name: ammos.name + ' (Balance)',
                                totalKg: 0,
                                applications: 0,
                                release: 'quick',
                                releaseTech: 'standard',
                                analysis: ammos.analysis,
                                nutrients: { N: 0, P: 0, K: 0 },
                                isLiquid: true,
                                isBalancing: true,
                            };
                        }
                        program.annualSummary.products[balanceId].totalKg += rateLHa;
                        program.annualSummary.products[balanceId].applications += 1;
                        program.annualSummary.products[balanceId].nutrients.N += nDelivered;
                        
                        actualNDelivered += nDelivered;
                        remainingNDeficit -= nDelivered;
                        
                    }
                }
                
                if (remainingNDeficit > 5) {
                    console.warn(`[PrebbleRecommender] Still ${remainingNDeficit.toFixed(0)} kg N/ha short after balancing`);
                }
            } else if (nSurplus > 10) {
                // Note significant surplus but don't reduce (user may want buffer)
            }
            
            // ----------------------------------------------------------------
            // POTASSIUM BALANCING — REMOVED b35fix332
            // ----------------------------------------------------------------
            // Pre-b35fix332 this block computed annual kDeficit (annualK -
            // actualKDelivered) and, when > 5 kg K/ha, pushed Liquid Potassium
            // (LIQPOT, 0-0-20) or SOL-SOP into 1–2 autumn/late-season months
            // selected from summerAutumnMonths sorted by ascending GP. The
            // products were tagged isBalancing:true and accumulated into
            // program.annualSummary.products[liqK.id + '-BAL'].
            //
            // Removed for the same reasons as the per-month K-supplement
            // path above (and the AU equivalent in b35fix330):
            //
            //   1. Missing soil-K sanity gate (Item 1a class). Triggered on
            //      annual programme arithmetic only — no reference to
            //      soilData.K or thresholds.K.min. On Item 1a-class samples
            //      (soil K in SLAN sufficiency range, SLAN-midpoint inflation
            //      pushing annualK above catalogue delivery), this path
            //      applied K to soils that did not need K.
            //
            //   2. No coordination with b35fix324 K-recon. The '-BAL' entries
            //      land in annualSummary.products with regular nutrients.K
            //      and NO _isAmendment flag. _computeProgrammeKDelivered sums
            //      them, masking deficit and preventing _synthesiseKReconDecision
            //      from firing where soil-K-floor logic would otherwise
            //      indicate split-SOP.
            //
            //   3. Functionally redundant with the architected Prebble greens
            //      spoonfeeding path (LIQPOT/SOL-AS in the main month loop)
            //      and the b35fix324 sportsfield K-recon synthesis. Phase 3
            //      Phase 3 balancing was a "hit the annual number"
            //      programme-completion mechanism that ignored whether the
            //      soil could justify the application.
            //
            // After removal, kDeficit/kSurplus diagnostics are no longer
            // computed at this stage — the FINAL TALLY block below still
            // recomputes finalKDelivered from annualSummary.products and
            // populates program.meta.annualPlan.achievement.K. Annual K
            // achievement may report below 100% for samples with genuine
            // programme shortfall — that is the correct signal, and
            // _synthesiseKReconDecision picks it up at export time when soil
            // K is also below floor.
            //
            // The "Still N kg K/ha short after balancing" console warning
            // (pre-fix line 2008) is no longer emitted from this block.
            // Equivalent visibility is now provided by the K Reconciliation
            // table caption on export.
            // ----------------------------------------------------------------

            // ----------------------------------------------------------------
            // FINAL TALLY
            // ----------------------------------------------------------------
            // Recalculate final delivered amounts
            let finalNDelivered = 0;
            let finalKDelivered = 0;
            let finalPDelivered = 0;
            Object.values(program.annualSummary.products).forEach(p => {
                finalNDelivered += p.nutrients.N || 0;
                finalKDelivered += p.nutrients.K || 0;
                finalPDelivered += p.nutrients.P || 0;
            });
            
            delivered.N = finalNDelivered;
            delivered.K = finalKDelivered;
            delivered.P = finalPDelivered;
            
            // Calculate achievement percentages
            const nAchievement = annualN > 0 ? Math.round((finalNDelivered / annualN) * 100) : 100;
            const kAchievement = annualK > 0 ? Math.round((finalKDelivered / annualK) * 100) : 100;
            
            
            // Store planning metadata with achievement stats
            program.meta.annualPlan = {
                annualRequirements: { N: annualN, P: annualP, K: annualK },
                delivered: delivered,
                achievement: { N: nAchievement, K: kAchievement },
                pStrategy: soilPDeficient ? `Single application in ${monthlyData[pApplicationMonth]?.month_name}` : 'Maintenance only',
                nNote: nAchievement >= 95 ? 'N target achieved' : `${100 - nAchievement}% N shortfall`,
                kNote: kAchievement >= 95 ? 'K target achieved' : `${100 - kAchievement}% K shortfall`,
            };
            
            return program;
        },
        
        /**
         * Normalize surface type string to match our keys
         */
        normalizeSurfaceType: function(surfaceType) {
            if (!surfaceType) return 'sports';
            
            const normalized = surfaceType.toLowerCase().replace(/[\s-]/g, '_');
            
            // Map common variations
            const aliases = {
                'golf': 'golf_greens',
                'green': 'greens',
                'putting_green': 'golf_greens',
                'bowling': 'bowling_greens',
                'bowls': 'bowling_greens',
                'cotula_bowling_green': 'bowling_greens',
                'cotula': 'bowling_greens',
                'cricket': 'cricket_wickets',
                'wicket': 'cricket_wickets',
                'fairway': 'fairways',
                'tee': 'tees',
                'sports_field': 'sports',
                'sportsfield': 'sports',
                // GH-307: site-settings-panel.js's Sports sub-category grid
                // (populateTurfSubGrid()) sets context.surfaceType to one of
                // these 4 specific values, not the parent 'sports' category --
                // none of them were mapped here, and no product in
                // PrebbleProducts.granular/liquid's suitableFor lists (or
                // surfaceSGN) uses anything but 'sports', so filterBySurface()
                // matched zero granular products for every Soccer/AFL/Rugby
                // site, every month, regardless of N required. Confirmed live:
                // "[PrebbleRecommender] NO granular products match surface:
                // soccer" fired for all 12 months on a real site, and most
                // months got no N product at all (liquid fallback only fires
                // in the winter GP<0.3 branch or for greens, neither of which
                // applied here).
                'soccer': 'sports',
                'afl': 'sports',
                'rugby_union': 'sports',
                'rugby_league': 'sports',
                'rugby': 'sports',
            };
            
            return aliases[normalized] || normalized;
        },
        
        /**
         * Determine growth phase from GP and season
         */
        getSeasonPhase: function(gp, season, month) {
            if (gp >= 0.7) return 'peak_growth';
            if (gp < 0.15) return 'winter';
            
            // Southern hemisphere summer stress (Dec-Feb)
            if ([12, 1, 2].includes(month) && gp < 0.5) {
                return 'summer_stress';
            }
            
            // Map season string
            const seasonLower = (season || '').toLowerCase();
            if (seasonLower.includes('spring')) return 'spring';
            if (seasonLower.includes('autumn') || seasonLower.includes('fall')) return 'autumn';
            if (seasonLower.includes('summer')) return gp < 0.5 ? 'summer_stress' : 'peak_growth';
            if (seasonLower.includes('winter')) return 'winter';
            
            return 'peak_growth';
        },
        
        /**
         * Filter products by surface type (SGN check)
         */
        filterBySurface: function(products, surfaceType) {
            const sgnRange = PrebbleProducts.surfaceSGN[surfaceType] || { min: 0, max: 999 };
            
            return products.filter(p => {
                // Liquids and solubles always suitable (no SGN constraint)
                // Solubles enable spoonfeeding programs - little and often via spray tank
                if (p.form === 'liquid' || p.form === 'soluble') return true;
                
                // Check SGN range
                const sgn = p.sgn || 200;
                if (sgn < sgnRange.min || sgn > sgnRange.max) return false;
                
                // Check explicit suitableFor list
                if (p.suitableFor && p.suitableFor.length > 0) {
                    return p.suitableFor.some(s => 
                        s === surfaceType || 
                        surfaceType.includes(s) || 
                        s.includes(surfaceType.replace('_', ''))
                    );
                }
                
                return true;
            });
        },
        
        /**
         * Filter products by release type for season
         */
        filterByRelease: function(products, seasonPhase) {
            const preferredRelease = PrebbleProducts.seasonRelease[seasonPhase] || ['slow', 'standard'];
            
            // Sort by preference, don't exclude
            return products.sort((a, b) => {
                const aIndex = preferredRelease.indexOf(a.release || 'standard');
                const bIndex = preferredRelease.indexOf(b.release || 'standard');
                
                const aScore = aIndex === -1 ? 99 : aIndex;
                const bScore = bIndex === -1 ? 99 : bIndex;
                
                return aScore - bScore;
            });
        },
        
        /**
         * Select best N source for requirements based on:
         * 1. N:K ratio matching (primary)
         * 2. Release type suitability for soil/irrigation conditions
         * 3. Release technology efficiency at current soil temperature (NEW)
         * 
         * Low CEC soils with frequent irrigation strongly favour slow/controlled release
         * to prevent leaching losses. Soil temperature determines which slow release
         * technology will actually work (e.g., MU needs warmth, IBDU works in cold).
         */
        selectNitrogenSource: function(products, monthData, context) {
            // Filter to products with N
            let nProducts = products.filter(p => (p.analysis?.N || 0) > 0);
            if (nProducts.length === 0) return null;
            
            // ============================================================
            // ANNUAL PLANNING: Starter product exclusion
            // ============================================================
            // excludeStarters flag comes from annual planning - means we've already
            // planned a P application elsewhere, so exclude high-P products now
            const isEstablishment = context.establishment || context.seeding || context.renovation || false;
            const hasPDeficiency = context.pDeficient || (context.soilPpm?.P < 10) || false;
            const forceExcludeStarters = context.excludeStarters || false;
            
            // Allow starters ONLY if: (establishment OR P deficient) AND NOT force excluded
            const allowStarters = (isEstablishment || hasPDeficiency) && !forceExcludeStarters;
            
            if (!allowStarters) {
                nProducts = nProducts.filter(p => {
                    const pPct = p.analysis?.P || 0;
                    const nPct = p.analysis?.N || 0;
                    const isStarterProduct = pPct > 8 && pPct > nPct / 2;
                    
                    if (isStarterProduct) {
                    }
                    return !isStarterProduct;
                });
            }
            
            if (nProducts.length === 0) {
                console.warn('[PrebbleRecommender] No suitable N products after filtering starters');
                return null;
            }
            
            const nRequired = monthData.N || 0;
            const kRequired = monthData.K || 0;
            // GH-330: mirrors GH-329's fix in au-fertiliser-products.js.
            // The starter-product filter above only excludes high-P% (>8%)
            // products, so a low-%-P product like Ezyreno (2.5% P) passes
            // straight through; K's only defense in the scoring below is a
            // token `80 - kPct` ratioScore penalty. Neither was strong
            // enough to reliably outweigh a strong N-match/release/tech-
            // efficiency score -- confirmed live: Ezyreno kept winning 3 of
            // 4 granular months on an AA site with Required P=0, K=0.
            const pRequired = monthData.P || 0;

            if (nRequired <= 0) return null;

            // ============================================================
            // ANNUAL PLANNING: K deficit detection
            // ============================================================
            // Check if K is running behind annually - if so, boost high-K products
            const annualKRequired = context.annualKRequired || 0;
            const annualKDelivered = context.annualKDelivered || 0;
            const kRunningBehind = annualKRequired > 0 && (annualKDelivered / annualKRequired) < 0.7;
            const kDeficitPct = annualKRequired > 0 ? (1 - annualKDelivered / annualKRequired) * 100 : 0;

            if (kRunningBehind) {
            }

            // Calculate required N:K ratio (handle K=0 case)
            const requiredRatio = kRequired > 0 ? nRequired / kRequired : Infinity;

            // Get release preference based on soil CEC and irrigation
            const releasePreference = this.getReleasePreference(context);

            // Get soil temperature for release tech efficiency calculation
            const soilTemp = context.soilTemp || context.soilTemperature || monthData.temp || 15;

            // GH-330: hard-exclude candidates that would deliver a non-trivial
            // amount of P or K when neither is required this month, provided
            // a clean (≤2 kg/ha at the rate needed for N) alternative remains
            // -- same "exclude entirely, not just score down" pattern as
            // au-fertiliser-products.js's GH-329. Falls back to keeping the
            // P/K-containing candidates when no clean alternative exists, so
            // a genuine N need is never left unmet.
            const CLEAN_NUTRIENT_KGHA = 2;
            const effectiveDeliveryOf = (product, key) => {
                const pct = (product.analysis?.[key] || 0) / 100;
                const nPctLocal = (product.analysis?.N || 0) / 100;
                if (pct <= 0 || nPctLocal <= 0) return 0;
                return (nRequired / nPctLocal) * pct;
            };
            if (pRequired <= 0) {
                const cleanP = nProducts.filter(p => effectiveDeliveryOf(p, 'P') <= CLEAN_NUTRIENT_KGHA);
                if (cleanP.length > 0) nProducts = cleanP;
            }
            if (kRequired <= 0) {
                const cleanK = nProducts.filter(p => effectiveDeliveryOf(p, 'K') <= CLEAN_NUTRIENT_KGHA);
                if (cleanK.length > 0) nProducts = cleanK;
            }

            // Score products
            let bestProduct = null;
            let bestScore = -Infinity;
            let bestTechEfficiency = 0;

            nProducts.forEach(product => {
                const nPct = product.analysis.N;
                const kPct = product.analysis.K || 0;
                
                // Calculate product N:K ratio
                const productRatio = kPct > 0 ? nPct / kPct : Infinity;
                
                // ============================================================
                // SCORE 1: N:K Ratio Match (0-100 points)
                // ============================================================
                let ratioScore = 0;
                
                if (requiredRatio === Infinity && productRatio === Infinity) {
                    ratioScore = 100;
                } else if (requiredRatio === Infinity) {
                    ratioScore = 80 - kPct;
                } else if (productRatio === Infinity) {
                    ratioScore = 20;
                } else {
                    const ratioMatch = Math.min(productRatio / requiredRatio, requiredRatio / productRatio);
                    ratioScore = ratioMatch * 100;
                }
                
                // ============================================================
                // SCORE 1b: K DEFICIT CORRECTION BONUS (0-50 points)
                // If K is running behind annually, boost high-K products
                // ============================================================
                let kDeficitBonus = 0;
                if (kRunningBehind && kPct >= 15) {
                    // High-K products (15%+ K) get a significant bonus
                    kDeficitBonus = Math.min(50, kPct * 2); // Up to 50 points
                }
                
                // ============================================================
                // SCORE 2: Release Type Suitability (0-100 points)
                // Based on soil CEC and irrigation frequency
                // ============================================================
                const releaseScore = this.scoreReleaseType(product.release, releasePreference);
                
                // ============================================================
                // SCORE 3: Release Tech Efficiency at Soil Temp (0-100 points)
                // MU ineffective in cold, IBDU works year-round, etc.
                // 
                // KEY INSIGHT: If a slow release product won't actually release
                // due to cold temps, a quick release product is BETTER because
                // at least you get the N. Paying for slow release that doesn't
                // work is worse than quick release that does.
                // ============================================================
                const releaseTech = product.releaseTech || 'standard';
                const techEfficiency = this.getReleaseTechEfficiency(releaseTech, soilTemp);
                
                // Determine if this is a slow release product
                const isSlowRelease = product.release === 'slow' || 
                                      product.release === 'controlled' ||
                                      product.release === 'pcu';
                const isQuickRelease = product.release === 'standard' || 
                                       releaseTech === 'standard' || 
                                       releaseTech === 'as';
                
                // v10.3.38: MESA is a hybrid - methylene urea (slow) + ammonium sulfate (quick)
                // The AS portion provides immediate N even in cold soil, so MESA shouldn't
                // be penalized as heavily as pure slow-release products
                const isMESA = releaseTech === 'mesa';
                
                // Effective tech score calculation:
                // For slow release products, we penalize based on efficiency loss
                // because you're paying for slow release but not getting full benefit
                let effectiveTechScore = techEfficiency;
                
                if (isSlowRelease && !isMESA) {
                    // Pure slow release (MU, PCU, etc) - penalize in cold conditions
                    if (soilTemp < 15) {
                        if (techEfficiency < 60) {
                            effectiveTechScore = techEfficiency * 0.6; // 40% penalty
                        }
                    }
                    
                    if (soilTemp < 12 && techEfficiency < 70) {
                        effectiveTechScore = techEfficiency * 0.4; // 60% penalty
                    }
                }
                
                if (isMESA) {
                    // MESA hybrid: AS portion works regardless of temp
                    // Only penalize below 8°C when even AS uptake slows
                    if (soilTemp < 8) {
                        effectiveTechScore = techEfficiency * 0.7; // Lighter 30% penalty
                    } else if (soilTemp < 12) {
                        // 8-12°C: minor penalty - AS works fine, MU portion slower
                        effectiveTechScore = techEfficiency * 0.85; // 15% penalty
                    }
                    // 12°C+: no penalty for MESA - AS delivers, MU activating
                    
                    // Give MESA a floor in cold conditions - AS component always delivers
                    if (soilTemp < 15 && soilTemp >= 8) {
                        effectiveTechScore = Math.max(effectiveTechScore, 85); // Floor at 85% (AS delivers ~40% immediately)
                    }
                }
                
                // Quick release products get a bonus in cold conditions
                // because they actually deliver the N regardless of temp
                if (isQuickRelease && soilTemp < 15) {
                    effectiveTechScore = Math.max(effectiveTechScore, 90); // Floor at 90% in cold
                    if (soilTemp < 12) {
                        effectiveTechScore = Math.max(effectiveTechScore, 95); // Higher floor in very cold
                    }
                }
                
                // ============================================================
                // SCORE 4: Rate Reasonableness (0-10 points)
                // ============================================================
                let rateScore = 0;
                const rateForN = nRequired / (nPct / 100);
                if (rateForN <= 150) rateScore = 10;
                else if (rateForN <= 250) rateScore = 6;
                else if (rateForN <= 400) rateScore = 3;
                else rateScore = 0;
                
                // ============================================================
                // TOTAL SCORE
                // Weighting: Ratio 35%, Release 25%, TechEfficiency 30%, Rate 10%
                // Plus K deficit bonus (up to 50 extra points when K is running behind)
                // ============================================================
                const totalScore = (ratioScore * 0.35) + 
                                   (releaseScore * 0.25) + 
                                   (effectiveTechScore * 0.30) + 
                                   (rateScore * 0.10) +
                                   kDeficitBonus;
                
                if (totalScore > bestScore) {
                    bestScore = totalScore;
                    bestProduct = product;
                    bestTechEfficiency = techEfficiency;
                }
            });
            
            if (!bestProduct) return null;
            
            // Calculate rate based on N requirement
            const nPct = bestProduct.analysis.N / 100;
            let rateKgHa = Math.round(monthData.N / nPct);
            
            // GREENS RATE LIMITS - respect label min/max to avoid speckling
            const isGreens = ['greens', 'golf_greens', 'bowling_greens'].includes(context.surfaceType);
            
            // Label rates for greens-grade products: 100-200 kg/ha (10-20 g/m²)
            const greensMinRate = 100; // 10 g/m² - below this causes speckling
            const greensMaxRate = 200; // 20 g/m² - label maximum
            
            // Check against max label rate (or greens limit if applicable)
            let maxRate = bestProduct.maxRateKgHa || 350;
            let minRate = 0; // Default no minimum
            
            if (isGreens) {
                maxRate = Math.min(maxRate, greensMaxRate);
                minRate = greensMinRate;
                
                // If N requirement is too low for minimum granular rate, skip granular
                const minRateNDelivery = minRate * nPct;
                if (monthData.N < minRateNDelivery * 0.7) {
                    // N requirement < 70% of what minimum rate delivers
                    // Skip granular, recommend liquid only for this month
                    return null; // Signal to use liquid only
                }
                
            }
            
            let splitRequired = false;
            let splitCount = 1;
            let actualNDelivered = monthData.N;
            let notes = bestProduct.notes;
            
            // Apply rate within label limits
            if (rateKgHa < minRate && minRate > 0) {
                // Below minimum - use minimum rate (will over-deliver N slightly)
                rateKgHa = minRate;
                actualNDelivered = rateKgHa * nPct;
                notes = `Min label rate: ${(rateKgHa/10).toFixed(0)} g/m² (delivers ${actualNDelivered.toFixed(1)} kg N)`;
            } else if (rateKgHa > maxRate) {
                if (isGreens) {
                    // GREENS: No splitting - just cap at max rate, rely on liquid foliar for remainder
                    rateKgHa = Math.round(maxRate);
                    actualNDelivered = rateKgHa * nPct;
                    const shortfall = monthData.N - actualNDelivered;
                    notes = `Greens rate: ${(rateKgHa/10).toFixed(1)} g/m² (${actualNDelivered.toFixed(1)} kg N). Foliar recommended for balance.`;
                    if (shortfall > 2) {
                    }
                } else {
                    // SPORTS/FAIRWAYS: Allow splitting
                    // Calculate how many applications needed
                    splitCount = Math.ceil(rateKgHa / maxRate);
                    
                    if (splitCount <= 2) {
                        // Split into 2 applications is manageable
                        splitRequired = true;
                        rateKgHa = Math.round(rateKgHa / splitCount);
                        actualNDelivered = rateKgHa * splitCount * nPct;
                        notes = `Split into ${splitCount} applications of ${rateKgHa} kg/ha (label max: ${maxRate} kg/ha)`;
                    } else {
                        // Too many splits - cap at max rate with warning
                        rateKgHa = maxRate;
                        actualNDelivered = rateKgHa * nPct;
                        notes = `⚠️ Capped at label max (${maxRate} kg/ha). Delivers ${actualNDelivered.toFixed(1)} kg N/ha of ${monthData.N} required. Supplement with foliar.`;
                        console.warn(`[PrebbleRecommender] ${bestProduct.name}: Rate capped - only delivering ${actualNDelivered.toFixed(1)} of ${monthData.N} kg N/ha required`);
                    }
                }
            }
            
            // Calculate K delivered - account for split applications
            const kDelivered = rateKgHa * splitCount * (bestProduct.analysis.K || 0) / 100;
            
            // Calculate K surplus/deficit for this product
            const kBalance = kDelivered - kRequired;
            
            // Estimate longevity based on release type
            const longevity = this.estimateLongevity(bestProduct.release, context);
            
            // Get release tech description
            const techInfo = this.getReleaseTechDescription(bestProduct.releaseTech, soilTemp);
            
            return {
                id: bestProduct.id,
                name: bestProduct.name,
                npk: bestProduct.npk,
                analysis: bestProduct.analysis, // CRITICAL: needed for nutrient tracking
                release: bestProduct.release || 'standard',
                releaseTech: bestProduct.releaseTech || 'standard',
                releaseWeeks: bestProduct.releaseWeeks || 4, // CRITICAL: needed for active tracking
                techEfficiency: bestTechEfficiency,
                techStatus: techInfo?.status || 'unknown',
                rateKgHa: rateKgHa,
                rateGM2: (rateKgHa / 10).toFixed(1),
                nDelivered: Math.round(actualNDelivered * 10) / 10,
                kDelivered: Math.round(kDelivered * 10) / 10,
                kBalance: Math.round(kBalance * 10) / 10,
                bagsPerHa: (rateKgHa / bestProduct.packSize).toFixed(1),
                notes: notes,
                ratioMatch: Math.round(bestScore) + '%',
                longevity: longevity,
                splitRequired: splitRequired,
                splitCount: splitCount,
                maxRate: maxRate,
            };
        },
        
        /**
         * Determine release type preference based on soil CEC and irrigation
         * 
         * Low CEC + frequent irrigation = high leaching risk = strong slow release preference
         * High CEC + infrequent irrigation = low leaching risk = standard release acceptable
         */
        getReleasePreference: function(context) {
            // Get CEC from context (default to medium if not provided)
            const cec = context.soilCEC || context.cec || 10;
            
            // Get irrigation frequency from context
            // 'frequent' = daily/every other day, 'moderate' = 2-3x week, 'infrequent' = weekly or less
            const irrigation = context.irrigationFrequency || context.irrigation || 'moderate';
            
            // Determine preference level: 'strong_slow', 'moderate_slow', 'balanced', 'any'
            if (cec < 5) {
                // Low CEC - high leaching risk
                if (irrigation === 'frequent' || irrigation === 'high') {
                    return 'strong_slow';  // Must use slow release
                } else {
                    return 'moderate_slow'; // Prefer slow release
                }
            } else if (cec < 12) {
                // Medium CEC
                if (irrigation === 'frequent' || irrigation === 'high') {
                    return 'moderate_slow';
                } else {
                    return 'balanced';
                }
            } else {
                // High CEC - good nutrient retention
                return 'any';
            }
        },
        
        /**
         * Score a product's release type against the site preference
         * Returns 0-100
         */
        scoreReleaseType: function(productRelease, preference) {
            const release = (productRelease || 'standard').toLowerCase();
            
            // Release type rankings (higher = slower/more controlled)
            const isSlowRelease = ['slow', 'controlled', 'pcu', 'mesa', 'polymer'].some(
                type => release.includes(type)
            );
            
            switch (preference) {
                case 'strong_slow':
                    // Low CEC + frequent irrigation - penalise quick release heavily
                    return isSlowRelease ? 100 : 20;
                    
                case 'moderate_slow':
                    // Prefer slow but accept standard
                    return isSlowRelease ? 100 : 50;
                    
                case 'balanced':
                    // Slight preference for slow release
                    return isSlowRelease ? 80 : 70;
                    
                case 'any':
                default:
                    // No strong preference
                    return 80;
            }
        },
        
        /**
         * Calculate release technology efficiency based on soil temperature
         * 
         * Different release technologies have different temperature dependencies:
         * - IBDU: Hydrolysis-based, works well in cold (good at 10°C)
         * - MU/UF: Microbial-dependent, needs warmth (poor below 15°C)
         * - MESA: Hybrid, moderate temperature dependency
         * - PCU: Diffusion-based, highly temperature dependent
         * 
         * @param {string} releaseTech - The release technology type
         * @param {number} soilTemp - Soil temperature in °C
         * @returns {number} Efficiency score 0-100
         */
        getReleaseTechEfficiency: function(releaseTech, soilTemp) {
            const tech = (releaseTech || 'standard').toLowerCase();
            const techData = PrebbleProducts.releaseTechEfficiency[tech] || PrebbleProducts.releaseTechEfficiency.standard;
            
            if (!techData || !techData.tempCurve) {
                console.warn('[PrebbleRecommender] Unknown release tech:', tech, '- defaulting to 100%');
                return 100;
            }
            
            // Interpolate efficiency from temperature curve
            const curve = techData.tempCurve;
            
            // Find surrounding points for interpolation
            let lower = curve[0];
            let upper = curve[curve.length - 1];
            
            for (let i = 0; i < curve.length - 1; i++) {
                if (soilTemp >= curve[i].temp && soilTemp <= curve[i + 1].temp) {
                    lower = curve[i];
                    upper = curve[i + 1];
                    break;
                }
            }
            
            // Handle temps outside range
            if (soilTemp <= lower.temp) return lower.efficiency * 100;
            if (soilTemp >= upper.temp) return upper.efficiency * 100;
            
            // Linear interpolation
            const ratio = (soilTemp - lower.temp) / (upper.temp - lower.temp);
            const efficiency = lower.efficiency + ratio * (upper.efficiency - lower.efficiency);
            
            return Math.round(efficiency * 100);
        },
        
        /**
         * Get release technology description for UI display
         */
        getReleaseTechDescription: function(releaseTech, soilTemp) {
            const tech = (releaseTech || 'standard').toLowerCase();
            const techData = PrebbleProducts.releaseTechEfficiency[tech];
            
            if (!techData) return null;
            
            const efficiency = this.getReleaseTechEfficiency(releaseTech, soilTemp);
            const isOptimal = soilTemp >= techData.optimalRange[0] && soilTemp <= techData.optimalRange[1];
            const isBelowMin = soilTemp < techData.minEffectiveTemp;
            
            let status;
            if (isBelowMin) {
                status = 'ineffective';
            } else if (efficiency >= 80) {
                status = 'optimal';
            } else if (efficiency >= 50) {
                status = 'reduced';
            } else {
                status = 'poor';
            }
            
            return {
                tech: tech,
                description: techData.description,
                efficiency: efficiency,
                status: status,
                optimalRange: techData.optimalRange,
                currentTemp: soilTemp,
            };
        },
        
        /**
         * Estimate typical soil temperature for a given month
         * 
         * This is essential for selecting appropriate release technologies.
         * MU-based products won't release in winter even if current temp is mild.
         * 
         * @param {number} month - Month number (1-12)
         * @param {number} latitude - Site latitude (negative for southern hemisphere)
         * @param {string} hemisphere - 'north' or 'south'
         * @param {number} currentTemp - Current/baseline soil temp as reference
         * @returns {number} Estimated soil temperature in °C
         */
        estimateMonthlySoilTemp: function(month, latitude, hemisphere, currentTemp) {
            // Typical monthly soil temp patterns (relative to annual mean)
            // Positive = warmer than mean, negative = cooler
            // Based on temperate climate soil temp curves at 50-100mm depth
            const northernPattern = {
                1: -8,  // Jan - coldest
                2: -7,
                3: -3,
                4: 2,
                5: 6,
                6: 9,   // Jun - warmest
                7: 10,  // Jul - warmest
                8: 8,
                9: 4,
                10: 0,
                11: -4,
                12: -7,
            };
            
            // Southern hemisphere is offset by 6 months
            const southernPattern = {
                1: 10,  // Jan - warmest (summer)
                2: 9,
                3: 5,
                4: 0,
                5: -4,
                6: -7,  // Jun - coldest (winter)
                7: -8,  // Jul - coldest
                8: -6,
                9: -2,
                10: 3,
                11: 7,
                12: 9,
            };
            
            const isSouth = hemisphere === 'south' || latitude < 0;
            const pattern = isSouth ? southernPattern : northernPattern;
            
            // Get the monthly deviation
            const deviation = pattern[month] || 0;
            
            // Estimate annual mean from current temp (rough approximation)
            // If we have current temp, assume it represents a typical value for "now"
            const annualMean = currentTemp || 15;
            
            // Scale deviation by latitude (higher latitudes have larger seasonal swings)
            const absLat = Math.abs(latitude || 35);
            const latitudeScale = 0.5 + (absLat / 90) * 0.5; // 0.5 at equator, 1.0 at poles
            
            // Calculate estimated temp
            const estimated = annualMean + (deviation * latitudeScale);
            
            // Clamp to reasonable range
            return Math.max(2, Math.min(35, Math.round(estimated * 10) / 10));
        },
        
        /**
         * Estimate product longevity based on release type and conditions
         * Returns a human-readable estimate
         */
        estimateLongevity: function(release, context) {
            const releaseType = (release || 'standard').toLowerCase();
            const cec = context.soilCEC || context.cec || 10;
            const irrigation = context.irrigationFrequency || 'moderate';
            
            // Base longevity by release type (weeks)
            let baseWeeks;
            if (releaseType.includes('pcu') || releaseType.includes('polymer')) {
                baseWeeks = 10; // Polymer coated
            } else if (releaseType.includes('mesa')) {
                baseWeeks = 8; // MESA technology
            } else if (releaseType.includes('slow') || releaseType.includes('controlled')) {
                baseWeeks = 6; // General slow release
            } else {
                baseWeeks = 3; // Standard/quick release
            }
            
            // Adjust for CEC (low CEC = faster loss)
            if (cec < 5) {
                baseWeeks = Math.round(baseWeeks * 0.6);
            } else if (cec < 10) {
                baseWeeks = Math.round(baseWeeks * 0.8);
            }
            
            // Adjust for irrigation (frequent = faster loss)
            if (irrigation === 'frequent' || irrigation === 'high') {
                baseWeeks = Math.round(baseWeeks * 0.7);
            }
            
            // Return human-readable
            if (baseWeeks <= 2) {
                return '1-2 weeks';
            } else if (baseWeeks <= 4) {
                return '2-4 weeks';
            } else if (baseWeeks <= 6) {
                return '4-6 weeks';
            } else if (baseWeeks <= 8) {
                return '6-8 weeks';
            } else {
                return '8-10+ weeks';
            }
        },
        
        /**
         * Select foliar N source for low GP periods
         * Foliar bypasses root uptake inefficiency in cold conditions
         * Uses N:K ratio matching like granular selection
         */
        selectFoliarNitrogen: function(liquidProducts, monthData, context) {
            // Filter to N-containing liquids AND solubles (both suitable for foliar/spoonfeeding)
            let nLiquids = liquidProducts.filter(p => 
                (p.form === 'liquid' || p.form === 'soluble') && (p.analysis?.N || 0) >= 5
            );
            
            if (nLiquids.length === 0) return null;
            
            // IMPORTANT: Exclude high-P "starter" liquids from normal maintenance
            // Same logic as granular selection
            const isEstablishment = context.establishment || context.seeding || context.renovation || false;
            const hasPDeficiency = context.pDeficient || false;
            
            if (!isEstablishment && !hasPDeficiency) {
                nLiquids = nLiquids.filter(p => {
                    const pPct = p.analysis?.P || 0;
                    const nPct = p.analysis?.N || 0;
                    const isStarterProduct = pPct > 8 && pPct > nPct / 2;
                    
                    if (isStarterProduct) {
                    }
                    return !isStarterProduct;
                });
            }
            
            if (nLiquids.length === 0) {
                console.warn('[PrebbleRecommender] No suitable foliar N products after filtering starters');
                return null;
            }
            
            const nRequired = monthData.N || 0;
            const kRequired = monthData.K || 0;
            const pRequired = monthData.P || 0; // GH-330, same rationale as selectNitrogenSource()

            if (nRequired <= 0) return null;

            // Calculate required N:K ratio
            const requiredRatio = kRequired > 0 ? nRequired / kRequired : Infinity;

            // GH-330: same hard exclusion as selectNitrogenSource() -- see
            // that function's GH-330 comment for the full rationale.
            const CLEAN_NUTRIENT_KGHA = 2;
            const effectiveDeliveryOf = (product, key) => {
                const pct = (product.analysis?.[key] || 0) / 100;
                const nPctLocal = (product.analysis?.N || 0) / 100;
                if (pct <= 0 || nPctLocal <= 0) return 0;
                return (nRequired / nPctLocal) * pct;
            };
            if (pRequired <= 0) {
                const cleanP = nLiquids.filter(p => effectiveDeliveryOf(p, 'P') <= CLEAN_NUTRIENT_KGHA);
                if (cleanP.length > 0) nLiquids = cleanP;
            }
            if (kRequired <= 0) {
                const cleanK = nLiquids.filter(p => effectiveDeliveryOf(p, 'K') <= CLEAN_NUTRIENT_KGHA);
                if (cleanK.length > 0) nLiquids = cleanK;
            }

            // Score products - N:K ratio match is primary criterion
            let bestProduct = null;
            let bestScore = -Infinity;

            nLiquids.forEach(product => {
                const nPct = product.analysis.N;
                const kPct = product.analysis.K || 0;
                
                // Calculate product N:K ratio
                const productRatio = kPct > 0 ? nPct / kPct : Infinity;
                
                // PRIMARY SCORE: N:K ratio match
                let ratioScore = 0;
                if (requiredRatio === Infinity && productRatio === Infinity) {
                    ratioScore = 100;
                } else if (requiredRatio === Infinity) {
                    ratioScore = 80 - kPct;
                } else if (productRatio === Infinity) {
                    // Product has 0 K but K is required - heavy penalty
                    ratioScore = 10; // Was 20, now lower
                } else {
                    const ratioMatch = Math.min(productRatio / requiredRatio, requiredRatio / productRatio);
                    ratioScore = ratioMatch * 100;
                }
                
                // SECONDARY: Foliar-specific considerations
                let secondaryScore = 0;
                
                // ================================================================
                // GP AND SOIL TEMP BASED SCORING
                // ================================================================
                // When GP < 0.3 or soil temp < 15°C:
                // - Slow-release granular is ineffective
                // - Pure N foliar (Ammos 22) is the BEST choice for N delivery
                // - Don't penalize for lacking K - that's handled by granular/separate K apps
                
                const gp = monthData.gp || context.gp || 0.5;
                const soilTemp = context.soilTemp || 15;
                const lowGPOrCold = gp < 0.3 || soilTemp < 15;
                
                if (lowGPOrCold) {
                    // LOW GP OR COLD SOIL: Pure N foliar is ideal
                    // Boost high-N products significantly - they're the best choice for immediate N
                    // Don't penalize for lacking K - that's handled by granular/separate K apps
                    if (nPct >= 20 && kPct === 0) {
                        secondaryScore += 50; // Strong bonus for pure high-N like Ammos 22
                    } else if (nPct >= 15 && kPct === 0) {
                        secondaryScore += 35; // Good bonus for pure N like Iron Maxx
                    } else if (kPct > 0) {
                        // Products with K still useful but N delivery is priority in low GP
                        // Don't add bonus - let pure N products win
                        secondaryScore += 0;
                    }
                } else {
                    // NORMAL GP/TEMP: Balance N:K delivery
                    // CRITICAL: If K is required, penalize products that deliver no K
                    if (kRequired > 0 && kPct === 0) {
                        secondaryScore -= 20; // Penalty for 0-K products when K needed
                    } else if (kRequired > 0 && kPct > 0) {
                        secondaryScore += 10; // Bonus for products that deliver K when needed
                    }
                }
                
                // Rate reasonableness for foliar (prefer lower rates)
                // Also factor in max rate - can we deliver the N within label limits?
                const productMaxRate = product.maxRateLHa || 30;
                const rateForN = nRequired / (nPct / 100);
                const canDeliverAtMaxRate = rateForN <= productMaxRate;
                
                if (canDeliverAtMaxRate) {
                    secondaryScore += 10; // Big bonus for products that can deliver within limits
                    if (rateForN <= productMaxRate * 0.5) secondaryScore += 5; // Extra if well under limit
                } else {
                    // Penalty for products that can't deliver - prefer higher N products
                    secondaryScore -= 5;
                }
                
                if (rateForN <= 30) secondaryScore += 5;
                else if (rateForN <= 50) secondaryScore += 3;
                
                // Slow release bonus
                if (product.release === 'slow') secondaryScore += 3;
                
                // ================================================================
                // TOTAL SCORE CALCULATION
                // ================================================================
                // In low GP or cold soil conditions, N delivery capacity matters
                // more than N:K ratio matching (K can come from other sources)
                let totalScore;
                if (lowGPOrCold) {
                    // LOW GP/COLD: Prioritize secondary score (N delivery, boosted pure N)
                    // Ratio still matters but less so - we need N to get there, K is secondary
                    totalScore = (ratioScore * 0.3) + (secondaryScore * 0.7);
                    if (nPct >= 15) {
                    }
                } else {
                    // NORMAL: Balanced approach - ratio matching is important
                    totalScore = (ratioScore * 0.6) + (secondaryScore * 0.4);
                }
                
                if (totalScore > bestScore) {
                    bestScore = totalScore;
                    bestProduct = product;
                }
            });
            
            if (!bestProduct) return null;
            
            const nPct = bestProduct.analysis.N / 100;
            let rateLHa = Math.round(monthData.N / nPct * 10) / 10;
            
            // Check against label maximum rate
            const maxRate = bestProduct.maxRateLHa || 30;
            let capped = false;
            let splitRequired = false;
            let splitCount = 1;
            let actualNDelivered = rateLHa * nPct; // Calculate actual delivery (not just requirement)
            let notes = bestProduct.useCase || 'Foliar N - efficient uptake in low GP conditions';
            
            if (rateLHa > maxRate) {
                // Calculate how many applications needed
                splitCount = Math.ceil(rateLHa / maxRate);
                
                if (splitCount <= 3) {
                    // Split into up to 3 applications (reasonable for winter maintenance)
                    splitRequired = true;
                    rateLHa = Math.round((rateLHa / splitCount) * 10) / 10;
                    actualNDelivered = rateLHa * splitCount * nPct;
                    notes = `Split into ${splitCount} applications of ${rateLHa} L/ha (label max: ${maxRate} L/ha)`;
                } else {
                    // Look for better alternative - prefer products that also deliver K if K is needed
                    const kRequired = monthData.K || 0;
                    
                    // First try: find product with K that can deliver
                    let betterAlternative = null;
                    if (kRequired > 0) {
                        betterAlternative = nLiquids.find(p => {
                            const altNPct = (p.analysis?.N || 0) / 100;
                            const altKPct = (p.analysis?.K || 0);
                            const altMaxRate = p.maxRateLHa || 30;
                            const altRateNeeded = monthData.N / altNPct;
                            // Must have K, can deliver within 2 splits, different product
                            return altKPct > 0 && altRateNeeded <= altMaxRate * 2 && p.id !== bestProduct.id;
                        });
                        
                        if (betterAlternative) {
                        }
                    }
                    
                    // Fallback: higher-N alternative (even without K)
                    if (!betterAlternative) {
                        betterAlternative = nLiquids.find(p => {
                            const altNPct = (p.analysis?.N || 0) / 100;
                            const altMaxRate = p.maxRateLHa || 30;
                            const altRateNeeded = monthData.N / altNPct;
                            return altRateNeeded <= altMaxRate * 2 && p.id !== bestProduct.id && altNPct > nPct;
                        });
                        
                        if (betterAlternative) {
                        }
                    }
                    
                    if (betterAlternative) {
                        bestProduct = betterAlternative;
                        const altNPct = betterAlternative.analysis.N / 100;
                        rateLHa = Math.round(monthData.N / altNPct * 10) / 10;
                        const altMaxRate = betterAlternative.maxRateLHa || 30;
                        
                        if (rateLHa > altMaxRate) {
                            splitRequired = true;
                            splitCount = Math.ceil(rateLHa / altMaxRate);
                            rateLHa = Math.round((rateLHa / splitCount) * 10) / 10;
                            actualNDelivered = rateLHa * splitCount * altNPct; // FIX: Calculate actual
                            notes = `Split into ${splitCount} applications of ${rateLHa} L/ha`;
                        } else {
                            actualNDelivered = rateLHa * altNPct; // FIX: Calculate actual
                            notes = betterAlternative.useCase || 'Foliar N application';
                        }
                    } else {
                        // No better alternative - cap and warn
                        capped = true;
                        rateLHa = maxRate;
                        actualNDelivered = rateLHa * nPct;
                        notes = `⚠️ Capped at label max (${maxRate} L/ha). Delivers ${actualNDelivered.toFixed(1)} kg N/ha. Supplement with additional applications.`;
                        console.warn(`[PrebbleRecommender] ${bestProduct.name}: Capped - only delivering ${actualNDelivered.toFixed(1)} of ${monthData.N} kg N/ha`);
                    }
                }
            }
            
            // Round liquid rate to 10L container (practical purchasing)
            rateLHa = Math.ceil(rateLHa / 10) * 10;
            // Recalculate actual delivery after rounding
            actualNDelivered = rateLHa * splitCount * nPct;
            
            // Calculate K delivered - account for split applications
            const kDelivered = rateLHa * splitCount * (bestProduct.analysis.K || 0) / 100;
            
            return {
                id: bestProduct.id,
                name: bestProduct.name,
                npk: bestProduct.npk,
                analysis: bestProduct.analysis, // CRITICAL: needed for nutrient tracking
                form: 'liquid',
                rateLHa: rateLHa,
                rateMLM2: (rateLHa / 10).toFixed(1),
                nDelivered: Math.round(actualNDelivered * 10) / 10,
                kDelivered: Math.round(kDelivered * 10) / 10,
                notes: notes + ` (${rateLHa}L container)`,
                deliveryMethod: 'foliar',
                ratioMatch: bestScore.toFixed(0) + '%',
                capped: capped,
                splitRequired: splitRequired,
                splitCount: splitCount,
                maxRate: maxRate,
            };
        },
        
        /**
         * selectPotassiumSource — REMOVED b35fix332
         *
         * Was the K-product picker called from the per-month K-supplementation
         * path at line ~1156 (also removed in b35fix332). Returned a granular,
         * soluble, or liquid K product based on kDeficit size and surface
         * type.
         *
         * Removed because:
         *   - The only caller (per-month K-supplement path) has been removed.
         *     See the deletion comment block at line ~1156 for full audit
         *     trail.
         *   - Phase 3 annual K balancing (also removed) had its own
         *     hard-coded LIQPOT/SOL-SOP selection logic; it never called
         *     this function.
         *   - The architected greens-K spoonfeeding path in the main month
         *     loop (~lines 1025, 1107, 1132, 1539+) selects products
         *     directly without going through this picker.
         *   - b35fix324's _synthesiseKReconDecision in word-export.js handles
         *     the soil-K-floor-gated K supplementation that the deleted
         *     paths were trying (badly) to provide. It synthesises a SOP
         *     amendment with full _isAmendment + _isKReconciliation
         *     sentinels so it does not contaminate _computeProgrammeKDelivered
         *     or self-suppress.
         *
         * Mirror of the AU equivalent removal in b35fix330.
         */
        /**
         * Select P source for establishment
         */
        selectPhosphorusSource: function(granular, liquid, pRequired, allowHighP = false) {
            // For P supplementation, prefer dedicated P sources like MAP (27% P)
            // rather than trying to get P from balanced fertilizers
            
            const allProducts = [...granular, ...liquid];
            
            // First priority: dedicated P sources (MAP, DAP) with P >= 20%
            let pSources = allProducts.filter(p => {
                const pPct = p.analysis?.P || 0;
                return pPct >= 20; // MAP is 27%, DAP is ~20%
            });
            
            // If no high-P sources, look for moderate P products
            if (pSources.length === 0) {
                if (allowHighP) {
                    // Establishment: any product with P >= 5%
                    pSources = allProducts.filter(p => (p.analysis?.P || 0) >= 5);
                } else {
                    // Maintenance: products with 2-15% P
                    pSources = allProducts.filter(p => {
                        const pPct = p.analysis?.P || 0;
                        return pPct >= 2 && pPct <= 15;
                    });
                }
            }
            
            if (pSources.length === 0) {
                // Last resort - any product with P
                pSources = allProducts.filter(p => (p.analysis?.P || 0) >= 1);
            }
            
            if (pSources.length === 0) return null;
            
            // Sort by P content - prefer higher P for efficiency (less product needed)
            pSources.sort((a, b) => (b.analysis?.P || 0) - (a.analysis?.P || 0));
            
            // Prefer MAP products if available
            let bestProduct = pSources.find(p => p.id === 'MAPTECH' || p.id === 'MAPGRAN') || pSources[0];
            
            // For establishment, starter products are also acceptable
            if (allowHighP && !bestProduct) {
                bestProduct = pSources.find(p => p.id === 'STARPR' || p.id === 'STARTP') || pSources[0];
            }
            
            const pPct = bestProduct.analysis.P / 100;
            let rateKgHa = Math.round(pRequired / pPct);
            
            // Check max rate - use maxRateLHa for liquids, but MAP Tech uses kg/ha even though sprayed
            const isSoluble = bestProduct.id === 'MAPTECH'; // Soluble dissolved in spray tank - rate is kg/ha
            const isLiquid = bestProduct.form === 'liquid' && !isSoluble;
            const maxRate = isSoluble ? (bestProduct.maxRateLHa || 20) : // MAP Tech: maxRateLHa is actually kg/ha
                           isLiquid ? (bestProduct.maxRateLHa || 30) :
                           (bestProduct.maxRateKgHa || 350);
            let notes = bestProduct.notes || `P supplementation`;
            
            if (isSoluble) {
                // MAP Tech - soluble applied as kg/ha in spray tank
                if (rateKgHa > maxRate) {
                    rateKgHa = maxRate;
                    notes = `Capped at ${maxRate} kg/ha (soluble limit) - partial P delivery`;
                }
                return {
                    id: bestProduct.id,
                    name: bestProduct.name,
                    npk: bestProduct.npk,
                    form: 'soluble',
                    rateKgHa: rateKgHa,
                    rateGM2: (rateKgHa / 10).toFixed(1),
                    pDelivered: Math.round(rateKgHa * pPct * 10) / 10,
                    notes: `Dissolve ${rateKgHa} kg/ha in 400-600L water`,
                    analysis: bestProduct.analysis,
                };
            } else if (isLiquid) {
                let rateLHa = Math.round(pRequired / pPct * 10) / 10;
                if (rateLHa > maxRate) {
                    rateLHa = maxRate;
                    notes = `Capped at ${maxRate} L/ha - partial P delivery`;
                }
                return {
                    id: bestProduct.id,
                    name: bestProduct.name,
                    npk: bestProduct.npk,
                    form: 'liquid',
                    rateLHa: rateLHa,
                    rateMLM2: (rateLHa / 10).toFixed(1),
                    pDelivered: Math.round(rateLHa * pPct * 10) / 10,
                    notes: notes,
                    analysis: bestProduct.analysis,
                };
            } else {
                if (rateKgHa > maxRate) {
                    rateKgHa = maxRate;
                    notes = `Capped at ${maxRate} kg/ha - partial P delivery`;
                }
                return {
                    id: bestProduct.id,
                    name: bestProduct.name,
                    npk: bestProduct.npk,
                    form: 'granular',
                    rateKgHa: rateKgHa,
                    rateGM2: (rateKgHa / 10).toFixed(1),
                    pDelivered: Math.round(rateKgHa * pPct * 10) / 10,
                    notes: notes,
                    analysis: bestProduct.analysis,
                };
            }
        },
        
        /**
         * Get all products suitable for a surface type
         */
        getProductsForSurface: function(surfaceType) {
            const normalized = this.normalizeSurfaceType(surfaceType);
            return {
                granular: this.filterBySurface(PrebbleProducts.granular, normalized),
                liquid: this.filterBySurface(PrebbleProducts.liquid, normalized),
            };
        },
        
        /**
         * Get product by ID
         */
        getProduct: function(productId) {
            return PrebbleProducts.granular.find(p => p.id === productId) ||
                   PrebbleProducts.liquid.find(p => p.id === productId);
        },
        
        /**
         * Calculate rate for specific nutrient delivery
         */
        calculateRate: function(productId, nutrient, amountKgHa) {
            const product = this.getProduct(productId);
            if (!product) return null;
            
            const pct = (product.analysis[nutrient] || 0) / 100;
            if (pct === 0) return null;
            
            const rateKgHa = amountKgHa / pct;
            
            return {
                product: product.name,
                rateKgHa: Math.round(rateKgHa),
                rateGM2: (rateKgHa / 10).toFixed(1),
                bagsPerHa: product.packSize ? (rateKgHa / product.packSize).toFixed(1) : null,
                delivers: {
                    [nutrient]: amountKgHa,
                    // Calculate other nutrients delivered
                    ...Object.fromEntries(
                        Object.entries(product.analysis)
                            .filter(([k]) => k !== nutrient)
                            .map(([k, v]) => [k, Math.round(rateKgHa * v / 100 * 10) / 10])
                    ),
                },
            };
        },
    };

    // ========================================================================
    // EXPORT
    // ========================================================================

    window.PrebbleProducts = PrebbleProducts;
    window.PrebbleRecommender = PrebbleRecommender;
    
    // Also expose as GAIP namespaced for Hub integration
    window.GAIP_PREBBLE = {
        products: PrebbleProducts,
        recommender: PrebbleRecommender,
        version: PrebbleProducts.version,
    };
    
})();
