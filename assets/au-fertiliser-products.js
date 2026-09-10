/**
 * Australian Fertiliser Product Database & Recommendation Engine
 * 
 * Complete database of Australian turf fertilisers with verified label data.
 * Includes SGN filtering, state availability, and surface-specific rates.
 * 
 * Data sourced from manufacturer labels and verified by Gilba Solutions.
 * 
 * @package Gilba_Hub
 * @version 3.21.0
 * @since 10.3.43
 * @updated 2026-05-01
 * 
 * Products: 125 granular, 99 liquid, 11 soluble (235 total — b35fix398 ICL audit additions)
 * 
 * v3.21.0 - b35fix398 - ICL Database Audit Reconciliation:
 *   Diff existing 31 ICL entries (b35fix380-verified baseline) against
 *   K&B Adams Australia ICL Product Analysis Worksheet (the authoritative
 *   current product analysis for ICL ANZ exclusive distribution).
 *   Audit method: row-by-row classification with hand-resolution of
 *   ambiguous matches. Output: 28 corrections, 20 new additions, 1 exact
 *   match, 2 existing-only entries preserved (Cal K Mag 0-0-11.6,
 *   Step Hi Mag 7-0-14 + 5Mg) per audit-preservation rule.
 *   
 *   Corrections (28): in-place updates to existing ICL entries.
 *   Most are micronutrient additions (S, Mn, Mo, Zn, B, Cu, Si)
 *   the original entries lacked. Material macronutrient corrections:
 *     - ICL-PROTURFNPK15  Ca: 1.4 -> 5.0 (per K&B label)
 *     - ICL-PROTURFHIK12  Ca: 2.0 -> 4.6, Mg: 2.0 -> 1.2
 *     - ICL-SIERRAFORMGT4 Mg: 2.0 -> 1.2, Fe: 3.0 -> 0.7
 *     - ICL-SPORTSMASTER2 Fe: 19.5 -> 17.5
 *   Existing rates / sgn / release / weeks / suitableFor / useCase
 *   preserved on all 28 corrected entries. Only analysis: {} block
 *   modified.
 *   
 *   New additions (20): full nutrient profile from K&B worksheet.
 *   Line metadata (sgn, packSize, release, weeks, rates, suitableFor)
 *   inherited from same-line peer entries since the K&B sheet does
 *   not include particle-size or rate data:
 *     Sierraform GT (line: methylene urea) — sgn 90, slow 8wk
 *     Greenmaster Pro-Lite — sgn 90, quick 6wk
 *     Sierrablen Plus — sgn 150, controlled 16wk
 *     ProTurf — sgn 200, controlled 10wk
 *     Sportsmaster WSF — sgn 80, quick 2wk (water-soluble flake)
 *     Greenmaster Liquid (incl. Advance) — liquid, foliar rates
 *     Vitalnova — liquid, foliar rates
 *   Sierrablen Plus Mini NPK flagged in notes for SGN verification
 *   (Mini variant may use smaller particle size than line default 150).
 *   
 *   Existing-only preserved (NOT removed):
 *     - ICL-CALKMAG00116 Cal K Mag 0-0-11.6 + Ca/Mg
 *     - ICL-STEPHIMAG701 Step Hi Mag 7-0-14 + 5Mg
 *   Both flagged for ICL/K&B confirmation before any future removal.
 *   
 *   ICL-SIERRABLENPL1 retains existing analysis (N11, P4.8, K4.2)
 *   — this matches K&B "Sierrablen Plus Pearl - Renovator" row,
 *   not the regular "Sierrablen Plus - Renovator (3mth)" which
 *   is added as a new entry (ICL-SIERRABLENPL5).
 *   
 *   All values elemental (matches AU DB convention; b35fix380 baseline).
 *   Citation source for all corrections and additions:
 *   K&B Adams Australia ICL Product Analysis Worksheet (received via
 *   Jerry Spencer, Apr 2026).
 * 
 * v3.20.0 - b35fix397 - Soluble K2SO4 + paspalum metadata:
 *   - Added SOL-K2SO4: Potassium Sulphate (0-0-41.5 + 18% S, elemental)
 *     Pure K + S, no N. Chloride-free. Fills gap for tissue-K correction
 *     on high-N programmes and chloride-sensitive turf (couch, paspalum,
 *     fine fescues). 41.5% K elemental = 50% K2O x 0.8302 conversion;
 *     18% S textbook value (Havlin et al., Soil Fertility and Fertilizers,
 *     8th ed., Ch.10).
 *   - SOL-KNO3 useCase metadata extended with nitrate-N preference
 *     citation for seashore paspalum (Duncan & Carrow 2000, Seashore
 *     Paspalum: The Environmental Turfgrass, Wiley). No engine logic
 *     change; metadata only.
 * 
 * v3.19.0 - b35fix380 - Audit reconciliation against
 *           fertiliser_product_analysis_audit.xlsx (verified-against-supplier):
 *   - FT-MPGREENSTART: added S: 2.8 (audit row 56)
 *   - WE-WILBURELLISL1: added S: 1.8 (audit row 127)
 *   - WE-WILBURELLISP3: added S: 6.7 (audit row 131)
 *   - WE-WILBURELLISS:  added S: 2.8 (audit row 132)
 *   - TC-CARBONUREA:    removed erroneous S: 24 (urea has no S; audit row 23)
 *   - SOL-KNO3:         oxide -> elemental conversion
 *                       N: 13 -> 13.85, K: 44 -> 38.67
 *                       (matches UK audit-verified row 395; rest of AU DB is elemental)
 * 
 * v3.18.0 - Seashore paspalum support - nitrate-based solubles:
 *   - Added SOL-KNO3: Potassium Nitrate (13-0-44) for high-K needs with nitrate-N
 *   - Added SOL-CANO3: Calcium Nitrate (15.5-0-0 + 19% Ca) for Ca supplementation  
 *   - Added SOL-MGNO3: Magnesium Nitrate (11-0-0 + 9.5% Mg) for Mg with nitrate-N
 *   - All nitrate products available nationally from all distributors as solubles
 *   - Addresses seashore paspalum's preference for nitrate-N in cool weather
 * 
 * v3.17.1 - Autumn K hardening support:
 *   - Enhanced autumn K bonus (up to +55 points for high-K products)
 *   - K overshoot threshold relaxed in autumn: 5x greens, 6x sports (was 3x/4x)
 *   - Greens K penalty reduced in autumn to allow hardening applications
 *   - No-K products now penalized -25 in autumn (was -15)
 *   - Reference: Christians et al. (2016) - K enhances winter hardiness
 * 
 * v3.17.0 - Major fixes to N delivery accuracy:
 *   - Granular threshold simplified: GP >= 30% for ALL surfaces
 *   - N overshoot check now applies to ALL surfaces (was greens-only for K)
 *   - Viability check tightened to 2.0x max overshoot (was 2.5x)
 *   - N scoring dramatically increased: -120 points for >3x overshoot
 *   - Products rejected if they would deliver >2.5x target N
 * 
 * v3.16.0 - N overshoot and GP-based product selection fixes:
 *   - Fixed: Sports turf now uses GP threshold (not always granular)
 *   - Fixed: Much stricter N overshoot penalties in scoring
 *   - Fixed: Viability check tightened from 4x to 2.5x N overshoot
 *   - Products that would massively over-deliver now rejected earlier
 * 
 * v3.1.0 - Enhanced liquid/soluble differentiation:
 *   - Quick-release liquids prioritised at low GP (immediate foliar uptake)
 *   - Slow-release liquids preferred at high GP (root uptake works)
 *   - Solubles for greens spoonfeeding programs (precise, frequent apps)
 *   - Slow-release efficiency calculation based on GP and soil temp
 * 
 * v3.0.0 - Complete recommender rebuild matching NZ/Prebble approach:
 *   - GP-aware delivery strategies (liquid-only at low GP, granular dominant at high GP)
 *   - Greens vs sportsfield differentiation
 *   - Soluble products for spoonfeeding and targeted applications
 *   - Active nutrient tracking for slow-release carry-over
 *   - K deficit supplementation
 * 
 * Distributors:
 *   - Nuturf: Nuturf Black Label, FoliMAX, Andersons, Lebanon
 *   - K&B Adams: ICL Sierraform/Greenmaster/Vitalnova, Wilbur Ellis
 *   - GTS: Terralift, Sport Series
 *   - Oasis Turf: Oasis range, Match Play
 *   - Living Turf: Match Play range
 *   - Various: Technical grades (MAP, SOP, Urea, etc.)
 */

(function() {
    'use strict';

    // ========================================================================
    // CONFIGURATION
    // ========================================================================

    const CONFIG = {
        version: '3.18.4',
        
        // SGN ranges for surface type filtering
        // Products must fall within range OR have sgn: null (DG/soluble)
        surfaceSGN: {
            'greens': { min: 0, max: 100 },
            'golf_greens': { min: 0, max: 100 },
            'bowling_greens': { min: 0, max: 100 },
            'cricket_wickets': { min: 0, max: 150 },
            'tees': { min: 80, max: 250 },
            'low_cut': { min: 80, max: 250 },
            'fairways': { min: 150, max: 999 },
            'sports': { min: 150, max: 999 },
            'landscaping': { min: 200, max: 999 },
            'lawns': { min: 200, max: 999 },
        },
        
        // State/region options for availability filtering
        availabilityOptions: [
            { value: 'all', label: 'All Products' },
            { value: 'national', label: 'National' },
            { value: 'VIC', label: 'Victoria' },
            { value: 'NSW', label: 'New South Wales' },
            { value: 'QLD', label: 'Queensland' },
            { value: 'SA', label: 'South Australia' },
            { value: 'WA', label: 'Western Australia' },
        ],
        
        // Distributor options for supplier filtering
        // "All Products" selects best match across distributors
        // Single distributor limits recommendations to that supplier's range
        distributorOptions: [
            { value: 'all', label: 'All Products (best match)' },
            { value: 'Nuturf', label: 'Nuturf' },
            { value: 'K&B Adams', label: 'K&B Adams' },
            { value: 'Oasis Turf', label: 'Oasis Turf' },
            { value: 'GTS', label: 'GTS' },
            { value: 'Living Turf', label: 'Living Turf' },
            { value: 'Turfcare', label: 'Turfcare' },
        ],
        
        // Distributor territory coverage by state
        // Used to filter dropdown based on user's location
        distributorTerritories: {
            'Nuturf': ['National'],
            'K&B Adams': ['National'],
            'Oasis Turf': ['VIC', 'TAS'],
            'GTS': ['National'],
            'Living Turf': ['National'],
            'Turfcare': ['National'],
        },
        
        // Australian state bounding boxes for auto-detection
        stateBounds: {
            'VIC': { latMin: -39.2, latMax: -33.9, lonMin: 140.9, lonMax: 150.0 },
            'NSW': { latMin: -37.5, latMax: -28.2, lonMin: 140.9, lonMax: 153.6 },
            'QLD': { latMin: -29.0, latMax: -10.7, lonMin: 138.0, lonMax: 153.6 },
            'SA': { latMin: -38.1, latMax: -26.0, lonMin: 129.0, lonMax: 141.0 },
            'WA': { latMin: -35.1, latMax: -13.7, lonMin: 112.9, lonMax: 129.0 },
            'TAS': { latMin: -43.6, latMax: -39.6, lonMin: 143.8, lonMax: 148.5 },
            'NT': { latMin: -26.0, latMax: -10.9, lonMin: 129.0, lonMax: 138.0 },
            'ACT': { latMin: -35.9, latMax: -35.1, lonMin: 148.8, lonMax: 149.4 },
        },
    };

    // ========================================================================
    // BRAND DEFINITIONS
    // ========================================================================

    const BRANDS = {
        'nuturf': { name: 'Nuturf', distributor: 'Nuturf' },
        'andersons': { name: 'Andersons', distributor: 'Nuturf' },
        'lebanon': { name: 'Lebanon', distributor: 'Nuturf' },
        'icl': { name: 'ICL', distributor: 'K&B Adams' },
        'gts': { name: 'GTS', distributor: 'GTS' },
        'wilbur-ellis': { name: 'Wilbur Ellis', distributor: 'Oasis Turf' },
        'ferti-technologies': { name: 'Ferti Technologies', distributor: 'Living Turf' },
        'match-play': { name: 'Match Play', distributor: 'Living Turf' },
        'oasis': { name: 'Oasis', distributor: 'Oasis Turf' },
        'swancorp': { name: 'Swancorp', distributor: 'Various' },
        'greenspec': { name: 'Greenspec', distributor: 'Various' },
        'various': { name: 'Various', distributor: 'Various' },
        'indigo': { name: 'Indigo', distributor: 'Indigo' },
        'living-turf': { name: 'Living Turf', distributor: 'Living Turf' },
        'k-and-b-adams': { name: 'K&B Adams', distributor: 'K&B Adams' },
        'kandb-adams': { name: 'K&B Adams', distributor: 'K&B Adams' },
        'skw': { name: 'SKW', distributor: 'Various' },
        'calcium-products': { name: 'Calcium Products', distributor: 'Various' },
        'agrotain': { name: 'Agrotain', distributor: 'Various' },
        'tpg': { name: 'TPG', distributor: 'Turfcare' },
        'fertpro': { name: 'Fertpro', distributor: 'Turfcare' },
        'turfcare': { name: 'Turfcare', distributor: 'Turfcare' },
    };

    const LIQUID_BRANDS = {
        'nuturf': { name: 'Nuturf FoliMAX', distributor: 'Nuturf' },
        'icl': { name: 'ICL', distributor: 'K&B Adams' },
        'gts': { name: 'GTS', distributor: 'GTS' },
        'oasis': { name: 'Oasis', distributor: 'Oasis Turf' },
        'indigo': { name: 'Indigo', distributor: 'Indigo' },
        'living-turf': { name: 'Living Turf', distributor: 'Living Turf' },
        'k-and-b-adams': { name: 'K&B Adams', distributor: 'K&B Adams' },
        'turfcare': { name: 'Turfcare', distributor: 'Turfcare' },
    };

    // ========================================================================
    // PRODUCT DATABASE
    // ========================================================================

    const AuFertiliserProducts = {
        
        version: '3.18.0',
        brands: BRANDS,
        liquidBrands: LIQUID_BRANDS,
        
        // --------------------------------------------------------------------
        // GRANULAR PRODUCTS
        // --------------------------------------------------------------------
        granular: [
            {
                id: 'NUT-BLACKLABELST',
                name: 'Black Label Starter',
                brand: 'nuturf',
                distributor: 'Nuturf',
                availability: 'National',
                line: 'Black Label Standard',
                analysis: { N: 18, P: 10, K: 9, S: 8.3 } /* b35fix317: corrected from (N 17.8 P 9.6 K 8.7 S 8.3) per official Nuturf brochure */,
                sgn: 350,
                packSize: 20,
                release: 'controlled',
                weeks: 8,
                rates: { teesMin: 275, teesMax: 275, fairwaysMin: 275, fairwaysMax: 275 },
                useCase: 'establishment',
                notes: 'DO NOT apply when temperature exceeds 28°C.',
            },
            {
                id: 'NUT-BLACKLABELAL',
                name: 'Black Label All Purpose',
                brand: 'nuturf',
                distributor: 'Nuturf',
                availability: 'National',
                line: 'Black Label Standard',
                analysis: { N: 19, K: 19, Fe: 1.5, S: 12, Mg: 1.4, Mn: 0.13, Cu: 0.13 } /* b35fix317: was (N 19.2 K 19 Fe 0.5); added S, Mg, Mn, Cu and corrected Fe per official Nuturf brochure */,
                sgn: 350,
                packSize: 20,
                release: 'controlled',
                weeks: 8,
                rates: { teesMin: 265, teesMax: 265, fairwaysMin: 265, fairwaysMax: 265 },
                useCase: 'maintenance',
                notes: 'DO NOT apply when temperature exceeds 28°C.',
            },
            {
                id: 'NUT-BLACKLABELRA',
                name: 'Black Label Rapid',
                brand: 'nuturf',
                distributor: 'Nuturf',
                availability: 'National',
                line: 'Black Label Standard',
                analysis: { N: 20, K: 16, Fe: 3, S: 2.8, Ca: 1.7, Mg: 0.1, Zn: 0.02 } /* b35fix317: was (N 19.9 K 16); added Fe, S, Ca, Mg, Zn per official Nuturf brochure */,
                sgn: 350,
                packSize: 20,
                release: 'quick',
                weeks: 4,
                rates: { teesMin: 250, teesMax: 250, fairwaysMin: 250, fairwaysMax: 250 },
                useCase: 'recovery',
                notes: 'DO NOT apply when temperature exceeds 28°C.',
            },
            {
                id: 'NUT-BLACKLABELTU',
                name: 'Black Label Turf King',
                brand: 'nuturf',
                distributor: 'Nuturf',
                availability: 'National',
                line: 'Black Label Standard',
                analysis: { N: 23, P: 1, K: 10, Fe: 2.5, S: 6.8, Mg: 1.7, Mn: 0.47 } /* b35fix317: removed phantom Ca=4; corrected S (4.6→6.8), N (22.4→23), P (0.9→1), Fe (2.7→2.5), Mg (2→1.7), Mn (0.5→0.47) per official Nuturf brochure */,
                sgn: 250,
                packSize: 20,
                release: 'stabilised',
                weeks: 8,
                rates: { teesMin: 220, teesMax: 220, fairwaysMin: 220, fairwaysMax: 220 },
                useCase: 'maintenance',
                notes: 'DO NOT apply when temperature exceeds 28°C.',
            },
            {
                id: 'NUT-BLACKLABELUP',
                name: 'Black Label Uplift',
                brand: 'nuturf',
                distributor: 'Nuturf',
                availability: 'National',
                line: 'Black Label Standard',
                analysis: { N: 28, P: 1, K: 8, Ca: 0.03, S: 7.6 } /* b35fix317: N 28.3→28, P 1.2→1, K 7.9→8 per official Nuturf brochure */,
                sgn: 350,
                packSize: 20,
                release: 'controlled',
                weeks: 7,
                rates: { teesMin: 185, teesMax: 185, fairwaysMin: 185, fairwaysMax: 185 },
                useCase: 'growth_boost',
                notes: 'DO NOT apply when temperature exceeds 28°C.',
            },
            {
                id: 'NUT-BLACKLABELBI',
                name: 'Black Label BioSmart',
                brand: 'nuturf',
                distributor: 'Nuturf',
                availability: 'National',
                line: 'Black Label Standard',
                analysis: { N: 23, K: 4, Ca: 0.9, Mg: 0.1, Fe: 1.5, Mn: 0.7, S: 5.1 } /* b35fix317: N 23.2→23, K 4.2→4 per official Nuturf brochure */,
                sgn: 350,
                packSize: 20,
                release: 'controlled',
                weeks: 8,
                rates: { teesMin: 210, teesMax: 210, fairwaysMin: 210, fairwaysMax: 210 },
                useCase: 'soil_health',
                notes: 'DO NOT apply when temperature exceeds 28°C.',
            },
            {
                id: 'NUT-BLACKLABELPR',
                name: 'Black Label Pro All Seasons',
                brand: 'nuturf',
                distributor: 'Nuturf',
                availability: 'National',
                line: 'Black Label Pro',
                analysis: { N: 24, P: 2, K: 9, Ca: 4.9, Fe: 2, S: 5.5 } /* b35fix317: K 9.1→9, Fe 1.9→2 per official Nuturf brochure */,
                sgn: 215,
                packSize: 20,
                release: 'controlled',
                weeks: 10,
                rates: { teesMin: 210, teesMax: 210, fairwaysMin: 210, fairwaysMax: 210 },
                useCase: 'maintenance',
                notes: 'DO NOT apply when temperature exceeds 28°C.',
            },
            {
                id: 'NUT-BLACKLABELPR1',
                name: 'Black Label Pro Balance',
                brand: 'nuturf',
                distributor: 'Nuturf',
                availability: 'National',
                line: 'Black Label Pro',
                analysis: { N: 22, K: 18, Fe: 2, S: 3.5, Ca: 0.9, Mg: 0.1, Zn: 0.01 } /* b35fix317: WATTLEFORD CASE — was (N 22 K 18 Fe 2) missing S, Ca, Mg, Zn. Pre-b35fix317 this product appeared to deliver zero S — directly caused wrong "elemental sulphur" recommendations at low-pH sites like Wattleford. Corrected per official Nuturf brochure. */,
                sgn: 215,
                packSize: 20,
                release: 'controlled',
                weeks: 7,
                rates: { teesMin: 230, teesMax: 230, fairwaysMin: 230, fairwaysMax: 230 },
                useCase: 'stress_hardening',
                notes: 'DO NOT apply when temperature exceeds 28°C.',
            },
            {
                id: 'NUT-BLACKLABELPR2',
                name: 'Black Label Pro Super',
                brand: 'nuturf',
                distributor: 'Nuturf',
                availability: 'National',
                line: 'Black Label Pro',
                analysis: { N: 30, P: 1, K: 5, Fe: 0.18, S: 8.6, Ca: 2.6 } /* b35fix317: N 29.7→30, added Ca 2.6 per official Nuturf brochure */,
                sgn: 215,
                packSize: 20,
                release: 'controlled',
                weeks: 10,
                rates: { teesMin: 165, teesMax: 165, fairwaysMin: 165, fairwaysMax: 165 },
                useCase: 'sustained_growth',
                notes: 'DO NOT apply when temperature exceeds 28°C.',
            },
            {
                id: 'NUT-BLACKLABELPR3',
                name: 'Black Label Pro Hi-Performance',
                brand: 'nuturf',
                distributor: 'Nuturf',
                availability: 'National',
                line: 'Black Label Pro',
                analysis: { N: 34, P: 1, K: 6, Ca: 1.7, Fe: 2, S: 3.6 } /* b35fix317: Fe 0.18→2 (significant), K 5.7→6, S 3.4→3.6, Ca 2.6→1.7, N 33.9→34 per official Nuturf brochure */,
                sgn: 215,
                packSize: 20,
                release: 'controlled',
                weeks: 6,
                rates: { teesMin: 150, teesMax: 150, fairwaysMin: 150, fairwaysMax: 150 },
                useCase: 'recovery',
                notes: 'DO NOT apply when temperature exceeds 28°C.',
            },
            {
                id: 'NUT-BLACKLABELPR4',
                name: 'Black Label Pro Hi-K',
                brand: 'nuturf',
                distributor: 'Nuturf',
                availability: 'National',
                line: 'Black Label Pro',
                analysis: { N: 14, K: 24, Fe: 0.2, Ca: 5.6, Mg: 2.9, S: 12 } /* b35fix317: Fe 1.5→0.2, removed phantom Mn 1.1, added Ca 5.6 and Mg 2.9 per official Nuturf brochure. S kept at 12 (brochure table was ambiguous for S column — VERIFY with Nuturf SDS). */,
                sgn: 210,
                packSize: 20,
                release: 'controlled',
                weeks: 8,
                rates: { teesMin: 200, teesMax: 200, fairwaysMin: 200, fairwaysMax: 200 },
                useCase: 'stress_hardening',
                notes: 'DO NOT apply when temperature exceeds 28°C.',
            },
            {
                id: 'NUT-BLACKLABELPR5',
                name: 'Black Label Pro+ Extend',
                brand: 'nuturf',
                distributor: 'Nuturf',
                availability: 'National',
                line: 'Black Label Pro+',
                analysis: { N: 30, K: 7, Fe: 1, S: 6 } /* b35fix317: N 30.5→30, K 7.2→7, Fe 1.5→1 per official Nuturf brochure */,
                sgn: 150,
                packSize: 20,
                release: 'controlled',
                weeks: 10,
                rates: { teesMin: 170, teesMax: 170, fairwaysMin: 170, fairwaysMax: 170 },
                useCase: 'sustained_growth',
                notes: 'DO NOT apply when temperature exceeds 28°C.',
            },
            {
                id: 'NUT-BLACKLABELPR6',
                name: 'Black Label Pro+ Elite',
                brand: 'nuturf',
                distributor: 'Nuturf',
                availability: 'National',
                line: 'Black Label Pro+',
                analysis: { N: 25, K: 13, Fe: 3, S: 3.6 } /* b35fix317: N 25.3→25, K 13.2→13 per official Nuturf brochure */,
                sgn: 150,
                packSize: 20,
                release: 'controlled',
                weeks: 8,
                rates: { teesMin: 200, teesMax: 200, fairwaysMin: 200, fairwaysMax: 200 },
                useCase: 'premium_fine_cut',
                notes: 'DO NOT apply when temperature exceeds 28°C.',
            },
            {
                id: 'NUT-BLACKLABELPR7',
                name: 'Black Label Pro+ Strength',
                brand: 'nuturf',
                distributor: 'Nuturf',
                availability: 'National',
                line: 'Black Label Pro+',
                analysis: { N: 22, K: 19, Fe: 2, S: 3.1 } /* b35fix317: K 19.4→19 per official Nuturf brochure */,
                sgn: 150,
                packSize: 20,
                release: 'controlled',
                weeks: 8,
                rates: { teesMin: 230, teesMax: 230, fairwaysMin: 230, fairwaysMax: 230 },
                useCase: 'stress_hardening',
                notes: 'DO NOT apply when temperature exceeds 28°C.',
            },
            {
                id: 'AND-NUTRIDG18115',
                name: 'Nutri DG 18-1-15',
                brand: 'andersons',
                distributor: 'Nuturf',
                availability: 'National',
                line: 'Nutri DG',
                analysis: { N: 18, P: 1, K: 15, S: 6.9 } /* b35fix318: corrected per Jerry Spencer audit Apr 2026 (S 0→6.9) */,
                sgn: 80,
                packSize: 20,
                release: 'slow',
                weeks: 8,
                rates: { greensMin: 150, greensMax: 300 },
                useCase: 'maintenance',
                notes: '',
            },
            {
                id: 'AND-NUTRIDGGREEN',
                name: 'Nutri DG Greens Turfstarter',
                brand: 'andersons',
                distributor: 'Nuturf',
                availability: 'National',
                line: 'Nutri DG',
                analysis: { N: 12, P: 10.6, K: 6.6, Fe: 0.3, S: 4.9, Mg: 0.5, Mn: 0.5 } /* b35fix318: corrected per Jerry Spencer audit Apr 2026 (P 11→10.6; K 7→6.6; Fe 0→0.3; S 0→4.9; Mg 0→0.5; Mn 0→0.5) */,
                sgn: 80,
                packSize: 20,
                release: 'slow',
                weeks: 8,
                rates: { greensMin: 150, greensMax: 300 },
                useCase: 'establishment',
                notes: '',
            },
            {
                id: 'AND-NUTRIDGGREEN1',
                name: 'Nutri DG Greens Extra K - XSR',
                brand: 'andersons',
                distributor: 'Nuturf',
                availability: 'National',
                line: 'Nutri DG',
                analysis: { N: 13, K: 21.6, S: 8.8 } /* b35fix318: corrected per Jerry Spencer audit Apr 2026 (K 22→21.6; S 0→8.8) */,
                sgn: 80,
                packSize: 20,
                release: 'slow',
                weeks: 8,
                rates: { greensMin: 150, greensMax: 300 },
                useCase: 'stress_hardening',
                notes: '',
            },
            {
                id: 'AND-NUTRIDGGREEN2',
                name: 'Nutri DG Greens Zero N',
                brand: 'andersons',
                distributor: 'Nuturf',
                availability: 'National',
                line: 'Nutri DG',
                analysis: { K: 21, S: 13.7, Mg: 4, Mn: 3 } /* b35fix318: corrected per Jerry Spencer audit Apr 2026 (S 0→13.7) */,
                sgn: 80,
                packSize: 20,
                release: 'quick',
                weeks: 4,
                rates: { greensMin: 150, greensMax: 300 },
                useCase: 'potassium_only',
                notes: '',
            },
            {
                id: 'GRS-GREENSPEC7IR',
                name: 'Green Spec 7 Iron',
                brand: 'greenspec',
                distributor: 'Nuturf',
                availability: 'National',
                line: 'Green spec',
                analysis: { N: 7, P: 3, K: 6, Ca: 7, Fe: 7, Mn: 1.5, S: 7 },
                sgn: 100,
                packSize: 20,
                release: 'quick',
                weeks: 6,
                rates: { greensMin: 200, greensMax: 400, teesMin: 340, teesMax: 500, fairwaysMin: 340, fairwaysMax: 500 },
                useCase: 'maintenance',
                notes: '',
            },
            {
                id: 'AND-NUTRIDGGYPSU',
                name: 'Nutri DG Gypsum',
                brand: 'andersons',
                distributor: 'Nuturf',
                availability: 'National',
                line: 'Amendments',
                analysis: { Ca: 21, S: 17 },
                sgn: 80,
                packSize: 25,
                release: 'quick',
                weeks: 8,
                rates: { greensMin: 250, greensMax: 500, teesMin: 250, teesMax: 500, fairwaysMin: 250, fairwaysMax: 500 },
                useCase: 'soil_amendment',
                notes: '',
            },
            {
                id: 'AND-NUTRIDGLIME',
                name: 'Nutri DG Lime',
                brand: 'andersons',
                distributor: 'Nuturf',
                availability: 'National',
                line: 'Amendments',
                analysis: { Ca: 30 },
                sgn: 80,
                packSize: 25,
                release: 'quick',
                weeks: 8,
                rates: null,
                useCase: 'ph_correction',
                notes: '',
            },
            {
                id: 'AND-NUTRIDGMAGTE',
                name: 'Nutri DG Mag Tec',
                brand: 'andersons',
                distributor: 'Nuturf',
                availability: 'National',
                line: 'Amendments',
                analysis: { K: 10, S: 12, Mg: 24 } /* b35fix318: corrected per Jerry Spencer audit Apr 2026 (S 0→12; Mg 10→24) */,
                sgn: 80,
                packSize: 25,
                release: 'quick',
                weeks: 8,
                rates: null,
                useCase: 'mg_correction',
                notes: '',
            },
            {
                id: 'AND-HUMICDG100GR',
                name: 'Humic DG 100 Greens',
                brand: 'andersons',
                distributor: 'Nuturf',
                availability: 'National',
                line: 'Amendments',
                analysis: {  },
                sgn: 80,
                packSize: 20,
                release: 'quick',
                weeks: 8,
                rates: null,
                useCase: 'soil_health',
                notes: '',
            },
            {
                id: 'SWA-GREENCALGYPS',
                name: 'Green Cal Gypsum',
                brand: 'swancorp',
                distributor: 'Nuturf',
                availability: 'National',
                line: 'Amendments',
                analysis: { Ca: 23, S: 18 },
                sgn: 300,
                packSize: 25,
                release: 'quick',
                weeks: 8,
                rates: { teesMin: 100, teesMax: 500, fairwaysMin: 100, fairwaysMax: 500 },
                useCase: 'maintenance',
                notes: '',
            },
            {
                id: 'SWA-GREENCALGYPS1',
                name: 'Green Cal Gypsum Greens',
                brand: 'swancorp',
                distributor: 'Nuturf',
                availability: 'National',
                line: 'Amendments',
                analysis: { Ca: 23, S: 18 },
                sgn: 100,
                packSize: 25,
                release: 'quick',
                weeks: 8,
                rates: { greensMin: 100, greensMax: 500, teesMin: 100, teesMax: 500, fairwaysMin: 100, fairwaysMax: 500 },
                useCase: 'maintenance',
                notes: '',
            },
            {
                id: 'AND-BLACKGYPSUMD',
                name: 'Black Gypsum DG',
                brand: 'andersons',
                distributor: 'Nuturf',
                availability: 'National',
                line: 'Amendments',
                analysis: { Ca: 12, S: 8.9 },
                sgn: 80,
                packSize: 20,
                release: 'quick',
                weeks: 8,
                rates: { greensMin: 150, greensMax: 600, teesMin: 150, teesMax: 600, fairwaysMin: 150, fairwaysMax: 600 },
                useCase: 'soil_amendment',
                notes: '',
            },
            {
                id: 'AND-ATEP12MGTE',
                name: 'A-Tep 12% Mg + TE',
                brand: 'andersons',
                distributor: 'Nuturf',
                availability: 'National',
                line: 'Amendments',
                analysis: { Fe: 8, S: 9, Mg: 12, Mn: 3, Zn: 1, Cu: 0.5 } /* b35fix318: corrected per Jerry Spencer audit Apr 2026 (Fe 1→8; S 8→9; Mn 2→3; Zn 0→1; Cu 0→0.5) */,
                sgn: 80,
                packSize: 20,
                release: 'quick',
                weeks: 8,
                rates: null,
                useCase: 'micronutrient_correction',
                notes: '',
            },
            {
                id: 'AND-OXAPRO1528',
                name: 'OxaPro 15-2-8',
                brand: 'andersons',
                distributor: 'Nuturf',
                availability: 'National',
                line: 'Fert+Herb',
                analysis: { N: 15, P: 2, K: 8, S: 2.4 } /* b35fix318: corrected per Jerry Spencer audit Apr 2026 (S 0→2.4) */,
                sgn: 200,
                packSize: 20,
                release: 'slow',
                weeks: 8,
                rates: null,
                useCase: 'pre_emergent',
                notes: '',
            },
            {
                id: 'AND-OXAMAX18109',
                name: 'OxaMAX 18-10-9',
                brand: 'andersons',
                distributor: 'Nuturf',
                availability: 'National',
                line: 'Fert+Herb',
                analysis: { N: 18, P: 10, K: 9, S: 0.8 } /* b35fix318: corrected per Jerry Spencer audit Apr 2026 (S 0→0.8) */,
                sgn: 200,
                packSize: 20,
                release: 'blended',
                weeks: 6,
                rates: null,
                useCase: 'pre_emergent_establishment',
                notes: '',
            },
            {
                id: 'AND-PENDIPRO2205',
                name: 'Pendi-Pro 22-0-5',
                brand: 'andersons',
                distributor: 'Nuturf',
                availability: 'National',
                line: 'Fert+Herb',
                analysis: { N: 22, K: 5, S: 3.5 } /* b35fix318: corrected per Jerry Spencer audit Apr 2026 (S 0→3.5) */,
                sgn: 200,
                packSize: 20,
                release: 'slow',
                weeks: 8,
                rates: null,
                useCase: 'pre_emergent',
                notes: '',
            },
            {
                id: 'LEB-COUNTRYCLUBI',
                name: 'Country Club IV 17-0-17',
                brand: 'lebanon',
                distributor: 'Oasis Turf',
                availability: 'VIC',
                line: 'Country Club IV',
                analysis: { N: 17, K: 14.11, Fe: 1, Mn: 0.5 },
                sgn: 80,
                packSize: 18.14,
                release: 'slow',
                weeks: 8,
                rates: { greensMin: 100, greensMax: 280, teesMin: 100, teesMax: 280, fairwaysMin: 100, fairwaysMax: 280 },
                useCase: 'maintenance',
                notes: '',
            },
            {
                id: 'LEB-COUNTRYCLUBI1',
                name: 'Country Club IV 24-3-12',
                brand: 'lebanon',
                distributor: 'Oasis Turf',
                availability: 'VIC',
                line: 'Country Club IV',
                analysis: { N: 24, P: 1.32, K: 9.96 },
                sgn: 80,
                packSize: 18.14,
                release: 'slow',
                weeks: 8,
                rates: { greensMin: 100, greensMax: 280, teesMin: 100, teesMax: 280, fairwaysMin: 100, fairwaysMax: 280 },
                useCase: 'growth_boost',
                notes: '',
            },
            {
                id: 'LEB-COUNTRYCLUBI2',
                name: 'Country Club IV 18-9-18',
                brand: 'lebanon',
                distributor: 'Oasis Turf',
                availability: 'VIC',
                line: 'Country Club IV',
                analysis: { N: 18, P: 3.96, K: 14.94, Mg: 0.5, Fe: 0.5, Mn: 0.5 },
                sgn: 80,
                packSize: 18.14,
                release: 'slow',
                weeks: 8,
                rates: { greensMin: 100, greensMax: 280, teesMin: 100, teesMax: 280, fairwaysMin: 100, fairwaysMax: 280 },
                useCase: 'establishment',
                notes: '',
            },
            {
                id: 'LEB-COUNTRYCLUBI3',
                name: 'Country Club IV 0-0-25',
                brand: 'lebanon',
                distributor: 'Oasis Turf',
                availability: 'VIC',
                line: 'Country Club IV',
                analysis: { K: 20.75, Mg: 2, Fe: 2 },
                sgn: 80,
                packSize: 18.14,
                release: 'straight',
                weeks: 6,
                rates: { greensMin: 100, greensMax: 280, teesMin: 100, teesMax: 280, fairwaysMin: 100, fairwaysMax: 280 },
                useCase: 'potassium_only',
                notes: '',
            },
            {
                id: 'LEB-COUNTRYCLUBM',
                name: 'Country Club MD 18-3-18',
                brand: 'lebanon',
                distributor: 'Oasis Turf',
                availability: 'VIC',
                line: 'Country Club MD',
                analysis: { N: 18, P: 1.32, K: 14.94, Mg: 0.65, Fe: 1.5, Mn: 0.5 },
                sgn: 80,
                packSize: 18.14,
                release: 'slow',
                weeks: 8,
                rates: { greensMin: 100, greensMax: 280, teesMin: 100, teesMax: 280, fairwaysMin: 100, fairwaysMax: 280 },
                useCase: 'maintenance',
                notes: '',
            },
            {
                id: 'LEB-COUNTRYCLUBM1',
                name: 'Country Club MD 20-0-10',
                brand: 'lebanon',
                distributor: 'Oasis Turf',
                availability: 'VIC',
                line: 'Country Club MD',
                analysis: { N: 20, K: 8.3, S: 12.6 },
                sgn: 80,
                packSize: 18.14,
                release: 'slow',
                weeks: 8,
                rates: { greensMin: 100, greensMax: 280, teesMin: 100, teesMax: 280, fairwaysMin: 100, fairwaysMax: 280 },
                useCase: 'sustained_growth',
                notes: '',
            },
            {
                id: 'LEB-COUNTRYCLUBM2',
                name: 'Country Club MD 22-0-16',
                brand: 'lebanon',
                distributor: 'Oasis Turf',
                availability: 'VIC',
                line: 'Country Club MD',
                analysis: { N: 22, K: 13.28, Mg: 0.7, Fe: 1.6, Mn: 0.8, S: 6.2 },
                sgn: 80,
                packSize: 18.14,
                release: 'slow',
                weeks: 8,
                rates: { greensMin: 100, greensMax: 280, teesMin: 100, teesMax: 280, fairwaysMin: 100, fairwaysMax: 280 },
                useCase: 'premium_fine_cut',
                notes: '',
            },
            {
                id: 'LEB-COUNTRYCLUB1',
                name: 'Country Club 19-0-19',
                brand: 'lebanon',
                distributor: 'Oasis Turf',
                availability: 'VIC',
                line: 'Country Club',
                analysis: { N: 19, K: 15.77, Fe: 3, S: 11.1 },
                sgn: 150,
                packSize: 22.7,
                release: 'slow',
                weeks: 8,
                rates: { teesMin: 100, teesMax: 280, fairwaysMin: 100, fairwaysMax: 280 },
                useCase: 'maintenance',
                notes: '',
            },
            {
                id: 'LEB-COUNTRYCLUB2',
                name: 'Country Club 21-0-20',
                brand: 'lebanon',
                distributor: 'Oasis Turf',
                availability: 'VIC',
                line: 'Country Club',
                analysis: { N: 21, K: 16.6, Fe: 1.5, S: 5.8 },
                sgn: 150,
                packSize: 22.7,
                release: 'slow',
                weeks: 8,
                rates: { teesMin: 100, teesMax: 280, fairwaysMin: 100, fairwaysMax: 280 },
                useCase: 'stress_hardening',
                notes: '',
            },
            {
                id: 'LEB-COUNTRYCLUB21',
                name: 'Country Club 29-0-10',
                brand: 'lebanon',
                distributor: 'Oasis Turf',
                availability: 'VIC',
                line: 'Country Club',
                analysis: { N: 29, K: 8.3, S: 4.2 },
                sgn: 150,
                packSize: 22.7,
                release: 'slow',
                weeks: 8,
                rates: { teesMin: 100, teesMax: 280, fairwaysMin: 100, fairwaysMax: 280 },
                useCase: 'growth_boost',
                notes: '',
            },
            {
                id: 'LEB-MESA303000',
                name: 'MESA 30 (30-0-0)',
                brand: 'lebanon',
                distributor: 'Living Turf',
                availability: 'National',
                line: 'MESA',
                analysis: { N: 30, S: 12 },
                sgn: 200,
                packSize: 22.7,
                release: 'slow',
                weeks: 8,
                rates: null,
                useCase: 'high_n',
                notes: '',
            },
            {
                id: 'LEB-MESASPORTS19',
                name: 'MESA Sports 19-0-16 + 3Fe',
                brand: 'lebanon',
                distributor: 'Living Turf',
                availability: 'National',
                line: 'MESA',
                analysis: { N: 19, K: 16, Fe: 3, S: 11.1 },
                sgn: 200,
                packSize: 22.7,
                release: 'slow',
                weeks: 8,
                rates: { teesMin: 220, teesMax: 220, fairwaysMin: 220, fairwaysMax: 220 },
                useCase: 'maintenance',
                notes: '',
            },
            {
                id: 'LEB-MESAXP200103',
                name: 'MESA XP 20-0-10 + 3Fe',
                brand: 'lebanon',
                distributor: 'Living Turf',
                availability: 'National',
                line: 'MESA',
                analysis: { N: 20, K: 10, Fe: 3, S: 4 },
                sgn: 200,
                packSize: 22.7,
                release: 'slow',
                weeks: 8,
                rates: { teesMin: 200, teesMax: 250, fairwaysMin: 200, fairwaysMax: 250 },
                useCase: 'growth_boost',
                notes: '',
            },
            {
                id: 'FT-MPSPRINGSTAR',
                name: 'MP Spring Start',
                brand: 'ferti-technologies',
                distributor: 'Living Turf',
                availability: 'National',
                line: 'Match Play',
                analysis: { N: 16, P: 1, K: 10, Ca: 2, Mg: 1, Mn: 0.5, S: 4 },
                sgn: 100,
                packSize: 20,
                release: 'slow',
                weeks: 8,
                rates: { greensMin: 125, greensMax: 250, teesMin: 125, teesMax: 250, fairwaysMin: 125, fairwaysMax: 250 },
                useCase: 'maintenance',
                notes: '',
            },
            {
                id: 'FT-MPKCALPLUS',
                name: 'MP K Cal Plus',
                brand: 'ferti-technologies',
                distributor: 'Living Turf',
                availability: 'National',
                line: 'Match Play',
                analysis: { K: 19.92, Ca: 7.8, Mg: 6, S: 14.5 },
                sgn: 90,
                packSize: 20,
                release: 'quick',
                weeks: 6,
                rates: { greensMin: 250, greensMax: 250, teesMin: 250, teesMax: 250, fairwaysMin: 250, fairwaysMax: 250 },
                useCase: 'maintenance',
                notes: '',
            },
            {
                id: 'FT-MPHIGHK',
                name: 'MP High K',
                brand: 'ferti-technologies',
                distributor: 'Living Turf',
                availability: 'National',
                line: 'Match Play',
                analysis: { N: 15, K: 25 },
                sgn: 100,
                packSize: 20,
                release: 'slow',
                weeks: 8,
                rates: { greensMin: 90, greensMax: 175, teesMin: 90, teesMax: 175, fairwaysMin: 90, fairwaysMax: 175 },
                useCase: 'maintenance',
                notes: '',
            },
            {
                id: 'FT-MPGREENSTART',
                name: 'MP Green Starter',
                brand: 'ferti-technologies',
                distributor: 'Living Turf',
                availability: 'National',
                line: 'Match Play',
                // b35fix380: S: 2.8 added per audit row 56 (verified against supplier)
                analysis: { N: 16, P: 9, K: 6, Ca: 1, Fe: 1.5, S: 2.8, Mn: 0.5 },
                sgn: 100,
                packSize: 20,
                release: 'quick',
                weeks: 8,
                rates: { greensMin: 150, greensMax: 240, teesMin: 150, teesMax: 240, fairwaysMin: 150, fairwaysMax: 240 },
                useCase: 'maintenance',
                notes: '',
            },
            {
                id: 'CAL-MICROGYPSUM',
                name: 'Micro Gypsum',
                brand: 'calcium-products',
                distributor: 'Living Turf',
                availability: 'National',
                line: 'Match Play',
                analysis: { Ca: 21, S: 17 },
                sgn: 100,
                packSize: 20,
                release: 'quick',
                weeks: 6,
                rates: null,
                useCase: 'maintenance',
                notes: '',
            },
            {
                id: 'FT-MPHIGHPERFOR',
                name: 'MP High Performance',
                brand: 'ferti-technologies',
                distributor: 'Living Turf',
                availability: 'National',
                line: 'Match Play',
                analysis: { N: 31, P: 1, K: 8, Fe: 1.5, Mn: 0.5 },
                sgn: 145,
                packSize: 20,
                release: 'slow',
                weeks: 8,
                rates: { greensMin: 160, greensMax: 240, teesMin: 160, teesMax: 240, fairwaysMin: 160, fairwaysMax: 240 },
                useCase: 'maintenance',
                notes: '',
            },
            {
                id: 'MP-SPECTRUMMINI',
                name: 'Spectrum mini',
                brand: 'match-play',
                distributor: 'Living Turf',
                availability: 'National',
                line: 'Match Play',
                analysis: { N: 19.5, P: 2, K: 5, Fe: 2.4, S: 4, Ca: 7, Mg: 0.5 } /* b35fix318: corrected per Jerry Spencer audit Apr 2026 (Fe 1.1→2.4; S 0→4; Ca 6→7; Mg 0.1→0.5) */,
                sgn: 150,
                packSize: 20,
                release: 'quick',
                weeks: 6,
                rates: { teesMin: 150, teesMax: 300, fairwaysMin: 150, fairwaysMax: 300 },
                useCase: 'maintenance',
                notes: '',
            },
            {
                id: 'MP-MPORIGINMINI',
                name: 'MP Origin Mini',
                brand: 'match-play',
                distributor: 'Living Turf',
                availability: 'National',
                line: 'Match Play',
                analysis: { N: 27.8, P: 1.3, K: 8.4, Ca: 3.3, Mg: 0.1, Fe: 0.6, S: 0.3 },
                sgn: 150,
                packSize: 20,
                release: 'quick',
                weeks: 6,
                rates: { teesMin: 180, teesMax: 270, fairwaysMin: 180, fairwaysMax: 270 },
                useCase: 'maintenance',
                notes: '',
            },
            {
                id: 'MP-MPCOUCHMASTE',
                name: 'MP Couch master',
                brand: 'match-play',
                distributor: 'Living Turf',
                availability: 'National',
                line: 'Match Play',
                analysis: { N: 23, P: 1, K: 10, Mg: 1.5, Fe: 1.5, Mn: 0.25, S: 6.7 },
                sgn: 200,
                packSize: 20,
                release: 'slow',
                weeks: 8,
                rates: { teesMin: 125, teesMax: 250, fairwaysMin: 125, fairwaysMax: 250 },
                useCase: 'maintenance',
                notes: '',
            },
            {
                id: 'AGR-UFLEXX',
                name: 'Uflexx',
                brand: 'agrotain',
                distributor: 'Living Turf',
                availability: 'National',
                line: 'Agrotain',
                analysis: { N: 46 },
                sgn: 200,
                packSize: 22.7,
                release: 'slow',
                weeks: 8,
                rates: { teesMin: 150, teesMax: 250, fairwaysMin: 150, fairwaysMax: 250 },
                useCase: 'maintenance',
                notes: '',
            },
            {
                id: 'WE-WILGROTURFST',
                name: 'Wil-Gro Turf Starter 10-8-5',
                brand: 'wilbur-ellis',
                distributor: 'Oasis Turf',
                availability: 'VIC',
                line: 'methylene urea',
                analysis: { N: 10, P: 8, K: 5, Mg: 6.7, Fe: 0.8, Mn: 0.32, S: 3.27 },
                sgn: 80,
                packSize: 20,
                release: 'slow',
                weeks: 8,
                rates: { greensMin: 250, greensMax: 300, teesMin: 250, teesMax: 300, fairwaysMin: 250, fairwaysMax: 300 },
                useCase: 'maintenance',
                notes: '',
            },
            {
                id: 'WE-WILBURELLISC',
                name: 'Wilbur Ellis Complete Green 17-1-12 & traces',
                brand: 'wilbur-ellis',
                distributor: 'Oasis Turf',
                availability: 'VIC',
                line: 'methylene urea',
                analysis: { N: 17, P: 1, K: 12, Ca: 3.19, Mg: 1.54, Fe: 1, Mn: 0.4, S: 6 },
                sgn: 80,
                packSize: 20,
                release: 'slow',
                weeks: 8,
                rates: { greensMin: 250, greensMax: 250, teesMin: 250, teesMax: 250, fairwaysMin: 250, fairwaysMax: 250 },
                useCase: 'maintenance',
                notes: '',
            },
            {
                id: 'WE-WILBURELLISL',
                name: 'Wilbur Ellis Long Distance 25-0-10 & 5% Fe',
                brand: 'wilbur-ellis',
                distributor: 'Oasis Turf',
                availability: 'VIC',
                line: 'PCU/methylene urea',
                analysis: { N: 25, K: 10, Fe: 5, S: 4.92, Mn: 0.5 } /* b35fix318: corrected per Jerry Spencer audit Apr 2026 (S 0→4.92) */,
                sgn: 200,
                packSize: 20,
                release: 'slow',
                weeks: 10,
                rates: { teesMin: 225, teesMax: 225, fairwaysMin: 225, fairwaysMax: 225 },
                useCase: 'maintenance',
                notes: '',
            },
            {
                id: 'WE-WILBURELLISL1',
                name: 'Wilbur Ellis Long Drive 28-0-10 & 4% Fe',
                brand: 'wilbur-ellis',
                distributor: 'Oasis Turf',
                availability: 'VIC',
                line: '60% PCU/40% straight',
                // b35fix380: S: 1.8 added per audit row 127 (verified against supplier)
                analysis: { N: 28, K: 10, Fe: 4, S: 1.8 },
                sgn: 200,
                packSize: 20,
                release: 'slow',
                weeks: 8,
                rates: { teesMin: 150, teesMax: 250, fairwaysMin: 150, fairwaysMax: 250 },
                useCase: 'maintenance',
                notes: '',
            },
            {
                id: 'WE-WILBURELLISP',
                name: 'Wilbur Ellis Pelletized Dolomite',
                brand: 'wilbur-ellis',
                distributor: 'Oasis Turf',
                availability: 'VIC',
                line: 'Straight',
                analysis: { Ca: 23.5, Mg: 9.5 },
                sgn: 80,
                packSize: 20,
                release: 'quick',
                weeks: 6,
                rates: { greensMin: 250, greensMax: 750, teesMin: 250, teesMax: 750, fairwaysMin: 250, fairwaysMax: 750 },
                useCase: 'maintenance',
                notes: '',
            },
            {
                id: 'WE-WILBURELLISP1',
                name: 'Wilbur Ellis Pelletized Lime',
                brand: 'wilbur-ellis',
                distributor: 'Oasis Turf',
                availability: 'VIC',
                line: 'Straight',
                analysis: { Ca: 35 },
                sgn: 80,
                packSize: 20,
                release: 'quick',
                weeks: 6,
                rates: { greensMin: 250, greensMax: 750, teesMin: 250, teesMax: 750, fairwaysMin: 250, fairwaysMax: 750 },
                useCase: 'maintenance',
                notes: '',
            },
            {
                id: 'WE-WILBURELLISP2',
                name: 'Wilbur Ellis Pelletized Gypsum',
                brand: 'wilbur-ellis',
                distributor: 'Oasis Turf',
                availability: 'VIC',
                line: 'Straight',
                analysis: { Ca: 21, S: 17 },
                sgn: 80,
                packSize: 20,
                release: 'quick',
                weeks: 6,
                rates: { greensMin: 250, greensMax: 750, teesMin: 250, teesMax: 750, fairwaysMin: 250, fairwaysMax: 750 },
                useCase: 'maintenance',
                notes: '',
            },
            {
                id: 'WE-WILBURELLISG',
                name: 'Wilbur Ellis GroMaxx 25-1-10',
                brand: 'wilbur-ellis',
                distributor: 'Oasis Turf',
                availability: 'VIC',
                line: 'Inhibited',
                analysis: { N: 25, P: 1, K: 10, Mg: 1, Fe: 2, Mn: 1 },
                sgn: 200,
                packSize: 20,
                release: 'stabilised',
                weeks: 8,
                rates: { teesMin: 150, teesMax: 250, fairwaysMin: 150, fairwaysMax: 250 },
                useCase: 'maintenance',
                notes: '',
            },
            {
                id: 'WE-WILBURELLISG1',
                name: 'Wilbur Ellis GroMaxx 46',
                brand: 'wilbur-ellis',
                distributor: 'Oasis Turf',
                availability: 'VIC',
                line: 'Inhibited',
                analysis: { N: 46 },
                sgn: 200,
                packSize: 20,
                release: 'stabilised',
                weeks: 8,
                rates: { teesMin: 50, teesMax: 150, fairwaysMin: 50, fairwaysMax: 150 },
                useCase: 'maintenance',
                notes: '',
            },
            {
                id: 'WE-WILBURELLISP3',
                name: 'Wilbur Ellis Pro Start 10-9-16',
                brand: 'wilbur-ellis',
                distributor: 'Oasis Turf',
                availability: 'VIC',
                line: 'Straight',
                // b35fix380: S: 6.7 added per audit row 131 (verified against supplier)
                analysis: { N: 10, P: 9, K: 16, S: 6.7 },
                sgn: 200,
                packSize: 20,
                release: 'quick',
                weeks: 6,
                rates: { teesMin: 250, teesMax: 300, fairwaysMin: 250, fairwaysMax: 300 },
                useCase: 'maintenance',
                notes: '',
            },
            {
                id: 'WE-WILBURELLISS',
                name: 'Wilbur Ellis Six Iron 20-0-16 6% Fe',
                brand: 'wilbur-ellis',
                distributor: 'Oasis Turf',
                availability: 'VIC',
                line: '60% PCU/40% straight',
                // b35fix380: S: 2.8 added per audit row 132 (verified against supplier)
                analysis: { N: 20, K: 16, Fe: 6, S: 2.8 },
                sgn: 200,
                packSize: 20,
                release: 'slow',
                weeks: 8,
                rates: { teesMin: 250, teesMax: 250, fairwaysMin: 250, fairwaysMax: 250 },
                useCase: 'maintenance',
                notes: '',
            },
            {
                id: 'WE-WILBURELLISS1',
                name: 'Wilbur Ellis Slow K 0-0-41',
                brand: 'wilbur-ellis',
                distributor: 'Oasis Turf',
                availability: 'VIC',
                line: 'PCU/methylene urea',
                analysis: { K: 41 },
                sgn: 80,
                packSize: 20,
                release: 'controlled',
                weeks: 8,
                rates: { greensMin: 150, greensMax: 300, teesMin: 150, teesMax: 300, fairwaysMin: 150, fairwaysMax: 300 },
                useCase: 'maintenance',
                notes: '',
            },
            {
                id: 'WE-WILBURELLIST',
                name: 'Wilbur Ellis Tee Topper 16-0-15 & traces',
                brand: 'wilbur-ellis',
                distributor: 'Oasis Turf',
                availability: 'VIC',
                line: '50% Inhibited',
                analysis: { N: 16, K: 15, Ca: 3, Mg: 1.5, Fe: 4, Mn: 2 },
                sgn: 200,
                packSize: 20,
                release: 'stabilised',
                weeks: 8,
                rates: { teesMin: 150, teesMax: 299, fairwaysMin: 150, fairwaysMax: 200 },
                useCase: 'maintenance',
                notes: '',
            },
            {
                id: 'ICL-SIERRAFORMGT',
                name: 'Sierraform GT Anti Stress 15-0-22',
                brand: 'icl',
                distributor: 'K&B Adams',
                availability: 'National',
                line: 'methylene urea',
                analysis: { N: 15, P: 0, K: 21.6, S: 8.6, Fe: 1, Si: 4 },
                sgn: 90,
                packSize: 20,
                release: 'slow',
                weeks: 8,
                rates: { greensMin: 200, greensMax: 200 },
                useCase: 'stress_hardening',
                notes: '',
            },
            {
                id: 'ICL-SIERRAFORMGT1',
                name: 'Sierraform GT All Seasons 18-3-15',
                brand: 'icl',
                distributor: 'K&B Adams',
                availability: 'National',
                line: 'methylene urea',
                analysis: { N: 18, P: 2.6, K: 14.9, S: 5.7, Mg: 1.2, Fe: 0.5, Mn: 0.1, Mo: 0.001, Zn: 0.02, Cu: 0.02, Si: 2.6 },
                sgn: 90,
                packSize: 20,
                release: 'slow',
                weeks: 8,
                rates: { greensMin: 200, greensMax: 200 },
                useCase: 'maintenance',
                notes: '',
            },
            {
                id: 'ICL-SIERRAFORMGT2',
                name: 'Sierraform GT Spring Start 16-0-13',
                brand: 'icl',
                distributor: 'K&B Adams',
                availability: 'National',
                line: 'methylene urea',
                analysis: { N: 16, P: 0, K: 13, S: 14.9, Fe: 1, Mn: 0.3, Si: 1.5 },
                sgn: 90,
                packSize: 20,
                release: 'slow',
                weeks: 8,
                rates: { greensMin: 200, greensMax: 200 },
                useCase: 'recovery',
                notes: '',
            },
            {
                id: 'ICL-SIERRAFORMGT3',
                name: 'Sierraform GT Momentum 22-2.2-9',
                brand: 'icl',
                distributor: 'K&B Adams',
                availability: 'National',
                line: 'methylene urea',
                analysis: { N: 22, P: 2.2, K: 9.1, S: 5.1, Mg: 1.2, Fe: 0.5, Mn: 0.1, Mo: 0.001, Zn: 0.02, Cu: 0.02, Si: 1.5 },
                sgn: 90,
                packSize: 20,
                release: 'slow',
                weeks: 8,
                rates: { greensMin: 200, greensMax: 200 },
                useCase: 'growth_boost',
                notes: '',
            },
            {
                id: 'ICL-SIERRAFORMGT4',
                name: 'Sierraform GT K-Step 6-0-22',
                brand: 'icl',
                distributor: 'K&B Adams',
                availability: 'National',
                line: 'methylene urea',
                analysis: { N: 6, P: 0, K: 22.4, S: 9.4, Mg: 1.2, Fe: 0.7, Mn: 0.15, Mo: 0.001, Zn: 0.025, Cu: 0.03, Si: 3.9 },
                sgn: 90,
                packSize: 20,
                release: 'slow',
                weeks: 8,
                rates: { greensMin: 200, greensMax: 200 },
                useCase: 'stress_hardening',
                notes: '',
            },
            {
                id: 'ICL-SIERRAFORMGT5',
                name: 'Sierraform GT NK 19-0-16',
                brand: 'icl',
                distributor: 'K&B Adams',
                availability: 'National',
                line: 'methylene urea',
                analysis: { N: 19, P: 0, K: 15.8, S: 6, Mg: 1.2, Fe: 0.5, Mn: 0.1, Mo: 0.001, Zn: 0.02, Cu: 0.02, Si: 2.6 },
                sgn: 90,
                packSize: 20,
                release: 'slow',
                weeks: 8,
                rates: { greensMin: 200, greensMax: 200 },
                useCase: 'maintenance',
                notes: '',
            },
            {
                id: 'ICL-SIERRAFORMGT6',
                name: 'Sierraform GT Pre Seeder 18-10-4',
                brand: 'icl',
                distributor: 'K&B Adams',
                availability: 'National',
                line: 'methylene urea',
                analysis: { N: 13.3, P: 9.6, K: 4.1, S: 3, Si: 0.9 },
                sgn: 90,
                packSize: 20,
                release: 'slow',
                weeks: 8,
                rates: { greensMin: 200, greensMax: 250 },
                useCase: 'establishment',
                notes: '',
            },
            {
                id: 'ICL-GREENMASTERP',
                name: 'Greenmaster Pro-Lite Cold Start 11-2.2-4.1 + 8Fe',
                brand: 'icl',
                distributor: 'K&B Adams',
                availability: 'National',
                line: 'Greenmaster Pro-Lite',
                analysis: { N: 11, P: 2.2, K: 4.1, S: 13.5, Fe: 8 },
                sgn: 90,
                packSize: 25,
                release: 'quick',
                weeks: 6,
                rates: { teesMin: 300, teesMax: 350, fairwaysMin: 300, fairwaysMax: 350 },
                useCase: 'recovery',
                notes: '',
            },
            {
                id: 'ICL-GREENMASTERP1',
                name: 'Greenmaster Pro-Lite Spring & Summer 14-2.2-8.3',
                brand: 'icl',
                distributor: 'K&B Adams',
                availability: 'National',
                line: 'Greenmaster Pro-Lite',
                analysis: { N: 14, P: 2.2, K: 8.3, S: 13, Mg: 1.2 },
                sgn: 90,
                packSize: 25,
                release: 'quick',
                weeks: 6,
                rates: { teesMin: 300, teesMax: 350, fairwaysMin: 300, fairwaysMax: 350 },
                useCase: 'maintenance',
                notes: '',
            },
            {
                id: 'ICL-GREENMASTERP2',
                name: 'Greenmaster Pro-Lite Invigorator Plus 4-0-11.6 + 8Fe',
                brand: 'icl',
                distributor: 'K&B Adams',
                availability: 'National',
                line: 'Greenmaster Pro-Lite',
                analysis: { N: 4, P: 0, K: 11.6, Mg: 12, Fe: 8 },
                sgn: 90,
                packSize: 25,
                release: 'quick',
                weeks: 6,
                rates: { teesMin: 300, teesMax: 350, fairwaysMin: 300, fairwaysMax: 350 },
                useCase: 'stress_hardening',
                notes: '',
            },
            {
                id: 'ICL-SIERRABLENPL',
                name: 'Sierrablen Plus Turf Starter 5-12.2-0 + Pearl',
                brand: 'icl',
                distributor: 'K&B Adams',
                availability: 'National',
                line: 'Sierrablen Plus',
                analysis: { N: 5, P: 12.2, Mg: 9.6 },
                sgn: 150,
                packSize: 25,
                release: 'controlled',
                weeks: 16,
                rates: { teesMin: 250, teesMax: 350, fairwaysMin: 250, fairwaysMax: 350 },
                useCase: 'establishment',
                notes: '',
            },
            {
                id: 'ICL-SIERRABLENPL1',
                name: 'Sierrablen Plus Renovator 11-4.8-4.2 + Pearl',
                brand: 'icl',
                distributor: 'K&B Adams',
                availability: 'National',
                line: 'Sierrablen Plus',
                analysis: { N: 11, P: 4.8, K: 4.2, Ca: 4.3, Mg: 4.8 },
                sgn: 150,
                packSize: 25,
                release: 'controlled',
                weeks: 20,
                rates: { teesMin: 250, teesMax: 350, fairwaysMin: 250, fairwaysMax: 350 },
                useCase: 'establishment',
                notes: '',
            },
            {
                id: 'ICL-SIERRABLENTU',
                name: 'Sierrablen Turfstarter 16-10.9-10',
                brand: 'icl',
                distributor: 'K&B Adams',
                availability: 'National',
                line: 'Sierrablen',
                analysis: { N: 16, P: 10.9, K: 10 },
                sgn: 200,
                packSize: 25,
                release: 'controlled',
                weeks: 20,
                rates: { teesMin: 250, teesMax: 350, fairwaysMin: 250, fairwaysMax: 350 },
                useCase: 'establishment',
                notes: '',
            },
            {
                id: 'ICL-STEPHIMAG',
                name: 'STEP Hi Mag',
                brand: 'icl',
                distributor: 'K&B Adams',
                availability: 'National',
                line: 'ICL',
                analysis: { S: 9, Mg: 12, Fe: 8, Mn: 3, Zn: 1, Cu: 0.5 } /* b35fix318: corrected per Jerry Spencer audit Apr 2026 (Fe 0→8; Mg 0→12; Mn 0→3; Zn 0→1; Cu 0→0.5) */,
                sgn: 150,
                packSize: 20,
                release: 'quick',
                weeks: 6,
                rates: null,
                useCase: 'maintenance',
                notes: '',
            },
            {
                id: 'ICL-SIERRABLENMI',
                name: 'Sierrablen Mini Hi K 0-0-32',
                brand: 'icl',
                distributor: 'K&B Adams',
                availability: 'National',
                line: 'Sierrablen',
                analysis: { N: 0, P: 0, K: 32, S: 13.4 },
                sgn: 150,
                packSize: 25,
                release: 'controlled',
                weeks: 16,
                rates: { greensMin: 200, greensMax: 300, teesMin: 200, teesMax: 300, fairwaysMin: 200, fairwaysMax: 300 },
                useCase: 'potassium_only',
                notes: '',
            },
            {
                id: 'ICL-PROTURFN2005',
                name: 'ProTurf N 20-0-5.8 + Ca/Mg',
                brand: 'icl',
                distributor: 'K&B Adams',
                availability: 'National',
                line: 'ProTurf',
                analysis: { N: 20, P: 0, K: 5.8, S: 11.6, Ca: 6.4, Mg: 1.8 },
                sgn: 200,
                packSize: 25,
                release: 'controlled',
                weeks: 10,
                rates: { teesMin: 200, teesMax: 350, fairwaysMin: 200, fairwaysMax: 350 },
                useCase: 'growth_boost',
                notes: '',
            },
            {
                id: 'ICL-PROTURFNPK15',
                name: 'ProTurf NPK 15-2.2-12.4 + Ca/Mg',
                brand: 'icl',
                distributor: 'K&B Adams',
                availability: 'National',
                line: 'ProTurf',
                analysis: { N: 15, P: 2.2, K: 12.4, S: 9.2, Ca: 5, Mg: 1.2 },
                sgn: 200,
                packSize: 25,
                release: 'controlled',
                weeks: 10,
                rates: { teesMin: 200, teesMax: 350, fairwaysMin: 200, fairwaysMax: 350 },
                useCase: 'maintenance',
                notes: '',
            },
            {
                id: 'ICL-PROTURFHIK12',
                name: 'ProTurf Hi K 12-2.2-16.6 + Ca/Mg',
                brand: 'icl',
                distributor: 'K&B Adams',
                availability: 'National',
                line: 'ProTurf',
                analysis: { N: 12, P: 2.2, K: 16.6, S: 8.4, Ca: 4.6, Mg: 1.2 },
                sgn: 200,
                packSize: 25,
                release: 'controlled',
                weeks: 10,
                rates: { teesMin: 200, teesMax: 350, fairwaysMin: 200, fairwaysMax: 350 },
                useCase: 'stress_hardening',
                notes: '',
            },
            {
                id: 'ICL-SPORTSMASTER',
                name: 'Sportsmaster WSF High N 35-0-11',
                brand: 'icl',
                distributor: 'K&B Adams',
                availability: 'National',
                line: 'Sportsmaster WSF',
                analysis: { N: 35, P: 0, K: 11, Fe: 0.13 },
                sgn: 80,
                packSize: 15,
                release: 'quick',
                weeks: 2,
                rates: { greensMin: 50, greensMax: 150, teesMin: 50, teesMax: 150, fairwaysMin: 50, fairwaysMax: 150 },
                useCase: 'growth_boost',
                notes: '',
            },
            {
                id: 'ICL-SPORTSMASTER1',
                name: 'Sportsmaster WSF High K 15-0-35',
                brand: 'icl',
                distributor: 'K&B Adams',
                availability: 'National',
                line: 'Sportsmaster WSF',
                analysis: { N: 15, P: 0, K: 35, Fe: 0.13 },
                sgn: 80,
                packSize: 15,
                release: 'quick',
                weeks: 2,
                rates: { greensMin: 50, greensMax: 150, teesMin: 50, teesMax: 150, fairwaysMin: 50, fairwaysMax: 150 },
                useCase: 'stress_hardening',
                notes: '',
            },
            {
                id: 'ICL-SPORTSMASTER2',
                name: 'Sportsmaster WSF Iron 19.5% Fe',
                brand: 'icl',
                distributor: 'K&B Adams',
                availability: 'National',
                line: 'Sportsmaster WSF',
                analysis: { N: 0, P: 0, K: 0, Fe: 17.5 },
                sgn: 80,
                packSize: 15,
                release: 'quick',
                weeks: 2,
                rates: { greensMin: 50, greensMax: 150, teesMin: 50, teesMax: 150, fairwaysMin: 50, fairwaysMax: 150 },
                useCase: 'micronutrient_correction',
                notes: '',
            },
            {
                id: 'ICL-CALKMAG00116',
                name: 'Cal K Mag 0-0-11.6 + Ca/Mg',
                brand: 'icl',
                distributor: 'K&B Adams',
                availability: 'National',
                line: 'Specialty',
                analysis: { K: 11.6, S: 19.2, Ca: 3.6, Mg: 3.6 } /* b35fix318: corrected per Jerry Spencer audit Apr 2026 (S 0→19.2; Ca 10→3.6; Mg 5→3.6) */,
                sgn: 90,
                packSize: 25,
                release: 'quick',
                weeks: 6,
                rates: null,
                useCase: 'micronutrient_correction',
                notes: '',
            },
            {
                id: 'ICL-STEPHIMAG701',
                name: 'Step Hi Mag 7-0-14 + 5Mg',
                brand: 'icl',
                distributor: 'K&B Adams',
                availability: 'National',
                line: 'Specialty',
                analysis: { N: 7, K: 14, Mg: 12, Fe: 8, Mn: 3 },
                sgn: 90,
                packSize: 25,
                release: 'slow',
                weeks: 8,
                rates: { greensMin: 70, greensMax: 110, teesMin: 70, teesMax: 110, fairwaysMin: 70, fairwaysMax: 110 },
                useCase: 'mg_correction',
                notes: '',
            },
            {
                id: 'ICL-GREENMASTERP3',
                name: 'Greenmaster Pro-Lite - NK',
                brand: 'icl',
                distributor: 'K&B Adams',
                availability: 'National',
                line: 'Greenmaster Pro-Lite',
                analysis: { N: 12, P: 0, K: 10, S: 12.4, Mg: 1.8, Fe: 2 },
                sgn: 90,
                packSize: 20,
                release: 'quick',
                weeks: 6,
                rates: { greensMin: 200, greensMax: 350, teesMin: 300, teesMax: 350, fairwaysMin: 300, fairwaysMax: 350 },
                suitableFor: ['greens', 'golf_greens', 'bowling_greens', 'tees'],
                useCase: 'maintenance',
                notes: 'Source: K&B Adams Australia ICL Product Analysis Worksheet (b35fix398).',
            },
            {
                id: 'ICL-SIERRAFORMGT7',
                name: 'Sierraform GT - Spring and Summer CalMag',
                brand: 'icl',
                distributor: 'K&B Adams',
                availability: 'National',
                line: 'methylene urea',
                analysis: { N: 14, P: 0, K: 5.8, Ca: 5.7, Mg: 3, Fe: 0.5, Mn: 0.1, Mo: 0.001, Zn: 0.02, Cu: 0.02, Si: 0 },
                sgn: 90,
                packSize: 20,
                release: 'slow',
                weeks: 8,
                rates: { greensMin: 200, greensMax: 200 },
                suitableFor: ['greens', 'golf_greens', 'bowling_greens'],
                useCase: 'maintenance',
                notes: 'Source: K&B Adams Australia ICL Product Analysis Worksheet (b35fix398).',
            },
            {
                id: 'ICL-SIERRABLENPL2',
                name: 'Sierrablen Plus - Active (3mth)',
                brand: 'icl',
                distributor: 'K&B Adams',
                availability: 'National',
                line: 'Sierrablen Plus',
                analysis: { N: 19, P: 2.2, K: 14.9, S: 12, Mg: 1.2, Mn: 0.14, Zn: 0.08, Cu: 0.035 },
                sgn: 150,
                packSize: 25,
                release: 'controlled',
                weeks: 16,
                rates: { teesMin: 250, teesMax: 350, fairwaysMin: 250, fairwaysMax: 350 },
                suitableFor: ['tees', 'fairways', 'sports'],
                useCase: 'maintenance',
                notes: 'Source: K&B Adams Australia ICL Product Analysis Worksheet (b35fix398).',
            },
            {
                id: 'ICL-SIERRABLENPL3',
                name: 'Sierrablen Plus - Active (4-5mth)',
                brand: 'icl',
                distributor: 'K&B Adams',
                availability: 'National',
                line: 'Sierrablen Plus',
                analysis: { N: 18, P: 2.2, K: 14.9, S: 9.6, Mg: 1.2 },
                sgn: 150,
                packSize: 25,
                release: 'controlled',
                weeks: 16,
                rates: { teesMin: 250, teesMax: 350, fairwaysMin: 250, fairwaysMax: 350 },
                suitableFor: ['tees', 'fairways', 'sports'],
                useCase: 'maintenance',
                notes: 'Source: K&B Adams Australia ICL Product Analysis Worksheet (b35fix398).',
            },
            {
                id: 'ICL-SIERRABLENPL4',
                name: 'Sierrablen Plus - Mini NPK (2-3mth)',
                brand: 'icl',
                distributor: 'K&B Adams',
                availability: 'National',
                line: 'Sierrablen Plus',
                analysis: { N: 25, P: 2.2, K: 10, S: 6.8 },
                sgn: 150,
                packSize: 25,
                release: 'controlled',
                weeks: 16,
                rates: { teesMin: 250, teesMax: 350, fairwaysMin: 250, fairwaysMax: 350 },
                suitableFor: ['tees', 'fairways', 'sports'],
                useCase: 'maintenance',
                notes: 'SGN inherited from Sierrablen Plus line default (150). Mini formulation may have smaller particle; verify with ICL spec sheet for close-cut surface deployment. Source: K&B Adams Australia ICL Product Analysis Worksheet (b35fix398).',
            },
            {
                id: 'ICL-SIERRABLENPL5',
                name: 'Sierrablen Plus - Renovator (3mth)',
                brand: 'icl',
                distributor: 'K&B Adams',
                availability: 'National',
                line: 'Sierrablen Plus',
                analysis: { N: 20, P: 8.7, K: 6.6, S: 8.4 },
                sgn: 150,
                packSize: 25,
                release: 'controlled',
                weeks: 16,
                rates: { teesMin: 250, teesMax: 350, fairwaysMin: 250, fairwaysMax: 350 },
                suitableFor: ['tees', 'fairways', 'sports'],
                useCase: 'maintenance',
                notes: 'Source: K&B Adams Australia ICL Product Analysis Worksheet (b35fix398).',
            },
            {
                id: 'ICL-SIERRABLENPL6',
                name: 'Sierrablen Plus - Spring Starter (3mth)',
                brand: 'icl',
                distributor: 'K&B Adams',
                availability: 'National',
                line: 'Sierrablen Plus',
                analysis: { N: 24, P: 2.2, K: 10.8, S: 10.8 },
                sgn: 150,
                packSize: 25,
                release: 'controlled',
                weeks: 16,
                rates: { teesMin: 250, teesMax: 350, fairwaysMin: 250, fairwaysMax: 350 },
                suitableFor: ['tees', 'fairways', 'sports'],
                useCase: 'maintenance',
                notes: 'Source: K&B Adams Australia ICL Product Analysis Worksheet (b35fix398).',
            },
            {
                id: 'ICL-SIERRABLENPL7',
                name: 'Sierrablen Plus - Stress Control (3mth)',
                brand: 'icl',
                distributor: 'K&B Adams',
                availability: 'National',
                line: 'Sierrablen Plus',
                analysis: { N: 15, P: 0, K: 23.2, S: 13.6, Mg: 1.2 },
                sgn: 150,
                packSize: 25,
                release: 'controlled',
                weeks: 16,
                rates: { teesMin: 250, teesMax: 350, fairwaysMin: 250, fairwaysMax: 350 },
                suitableFor: ['tees', 'fairways', 'sports'],
                useCase: 'maintenance',
                notes: 'Source: K&B Adams Australia ICL Product Analysis Worksheet (b35fix398).',
            },
            {
                id: 'ICL-SPORTSMASTER3',
                name: 'Sportsmaster WSF 20-0-0 + Seaweed',
                brand: 'icl',
                distributor: 'K&B Adams',
                availability: 'National',
                line: 'Sportsmaster WSF',
                analysis: { N: 20, P: 0, K: 0, S: 20 },
                sgn: 80,
                packSize: 25,
                release: 'quick',
                weeks: 2,
                rates: { greensMin: 50, greensMax: 150, teesMin: 50, teesMax: 150, fairwaysMin: 50, fairwaysMax: 150 },
                suitableFor: ['greens', 'tees', 'fairways', 'sports'],
                useCase: 'maintenance',
                notes: 'Source: K&B Adams Australia ICL Product Analysis Worksheet (b35fix398).',
            },
            {
                id: 'ICL-SPORTSMASTER4',
                name: 'Sportsmaster WSF Seaweed',
                brand: 'icl',
                distributor: 'K&B Adams',
                availability: 'National',
                line: 'Sportsmaster WSF',
                analysis: { N: 4, P: 0, K: 12.4, Fe: 0.13, Mn: 0.06, Mo: 0.01, Zn: 0.016 },
                sgn: 80,
                packSize: 25,
                release: 'quick',
                weeks: 2,
                rates: { greensMin: 50, greensMax: 150, teesMin: 50, teesMax: 150, fairwaysMin: 50, fairwaysMax: 150 },
                suitableFor: ['greens', 'tees', 'fairways', 'sports'],
                useCase: 'maintenance',
                notes: 'Source: K&B Adams Australia ICL Product Analysis Worksheet (b35fix398).',
            },
            {
                id: 'GTS-TERRALIFTTX1',
                name: 'Terralift TX10 5-2-8 + Mycorrhiza',
                brand: 'gts',
                distributor: 'GTS',
                availability: 'National',
                line: 'Terralift Greens',
                analysis: { N: 5, P: 2, K: 8, Ca: 4.2, Mg: 0.8, Fe: 0.5, S: 3.1 },
                sgn: 100,
                packSize: 20,
                release: 'slow',
                weeks: 6,
                rates: { greensMin: 150, greensMax: 300, teesMin: 150, teesMax: 300 },
                useCase: 'soil_health',
                notes: '',
            },
            {
                id: 'GTS-TERRALIFTACT',
                name: 'Terralift Activate N 18-1-4',
                brand: 'gts',
                distributor: 'GTS',
                availability: 'National',
                line: 'Terralift Greens',
                analysis: { N: 18, P: 1, K: 4, Ca: 2.4, Mg: 2, S: 8.2 },
                sgn: 100,
                packSize: 20,
                release: 'slow',
                weeks: 8,
                rates: { greensMin: 150, greensMax: 400, teesMin: 150, teesMax: 400, fairwaysMin: 150, fairwaysMax: 400 },
                useCase: 'growth_boost',
                notes: '',
            },
            {
                id: 'GTS-TERRALIFTACT1',
                name: 'Terralift Activate K 8-0-16',
                brand: 'gts',
                distributor: 'GTS',
                availability: 'National',
                line: 'Terralift Greens',
                analysis: { N: 8, K: 16, Ca: 3.2, Mg: 1, Fe: 2, S: 5.7 },
                sgn: 100,
                packSize: 20,
                release: 'slow',
                weeks: 8,
                rates: { greensMin: 150, greensMax: 400, teesMin: 150, teesMax: 400, fairwaysMin: 150, fairwaysMax: 400 },
                useCase: 'stress_hardening',
                notes: '',
            },
            {
                id: 'GTS-TERRALIFTTXT',
                name: 'Terralift TX Trace',
                brand: 'gts',
                distributor: 'GTS',
                availability: 'National',
                line: 'Terralift Greens',
                analysis: { N: 3, K: 5, Ca: 2, Mg: 2, Fe: 5.5, Mn: 5, S: 9 },
                sgn: 100,
                packSize: 20,
                release: 'quick',
                weeks: 6,
                rates: { greensMin: 200, greensMax: 200, teesMin: 200, teesMax: 200 },
                useCase: 'micronutrient_correction',
                notes: '',
            },
            {
                id: 'GTS-TERRALIFTSOI',
                name: 'Terralift Soilfix Mg',
                brand: 'gts',
                distributor: 'GTS',
                availability: 'National',
                line: 'Terralift Greens',
                analysis: { N: 0.5, P: 0.3, K: 0.1, Ca: 6, Mg: 16, Mn: 0.3 },
                sgn: 100,
                packSize: 20,
                release: 'quick',
                weeks: 4,
                rates: { greensMin: 200, greensMax: 200, teesMin: 200, teesMax: 200 },
                useCase: 'mg_correction',
                notes: '',
            },
            {
                id: 'GTS-TERRALIFTSOI1',
                name: 'Terralift Soilfix KCa',
                brand: 'gts',
                distributor: 'GTS',
                availability: 'National',
                line: 'Terralift Greens',
                analysis: { N: 0.5, P: 0.3, K: 10, Ca: 10, Mg: 3, S: 5 },
                sgn: 100,
                packSize: 20,
                release: 'slow',
                weeks: 8,
                rates: { greensMin: 200, greensMax: 200, teesMin: 200, teesMax: 200 },
                useCase: 'micronutrient_correction',
                notes: '',
            },
            {
                id: 'GTS-TERRALIFTTX11',
                name: 'Terralift TX10 Outfield 5-2-8',
                brand: 'gts',
                distributor: 'GTS',
                availability: 'National',
                line: 'Terralift High Cut',
                analysis: { N: 5, P: 2, K: 8, Ca: 4.2, Mg: 0.8, Fe: 0.5, S: 3.1 },
                sgn: 250,
                packSize: 20,
                release: 'slow',
                weeks: 11,
                rates: { teesMin: 200, teesMax: 600, fairwaysMin: 200, fairwaysMax: 600 },
                useCase: 'soil_health',
                notes: '',
            },
            {
                id: 'GTS-GTSSPORTSERI',
                name: 'GTS Sport Series Maintain 26-2-9',
                brand: 'gts',
                distributor: 'GTS',
                availability: 'National',
                line: 'Sport Series',
                analysis: { N: 26.1, P: 2, K: 8.9, Fe: 3.4, S: 4.3 },
                sgn: 250,
                packSize: 20,
                release: 'controlled',
                weeks: 12,
                rates: { teesMin: 150, teesMax: 250, fairwaysMin: 150, fairwaysMax: 250 },
                useCase: 'sustained_growth',
                notes: '',
            },
            {
                id: 'GTS-GTSSPORTSERI1',
                name: 'GTS Sport Series Enhance 34-1-6',
                brand: 'gts',
                distributor: 'GTS',
                availability: 'National',
                line: 'Sport Series',
                analysis: { N: 34.3, P: 1.1, K: 5.3, Fe: 2.5, S: 2.2 },
                sgn: 250,
                packSize: 20,
                release: 'controlled',
                weeks: 8,
                rates: { teesMin: 150, teesMax: 200, fairwaysMin: 150, fairwaysMax: 200 },
                useCase: 'growth_boost',
                notes: '',
            },
            {
                id: 'GTS-GTSSPORTSERI2',
                name: 'GTS Sport Series Starter 19-10-9',
                brand: 'gts',
                distributor: 'GTS',
                availability: 'National',
                line: 'Sport Series',
                analysis: { N: 18.8, P: 10.9, K: 9, Mn: 1.8, S: 1 },
                sgn: 250,
                packSize: 20,
                release: 'controlled',
                weeks: 10,
                rates: { teesMin: 200, teesMax: 300, fairwaysMin: 200, fairwaysMax: 300 },
                useCase: 'establishment',
                notes: '',
            },
            {
                id: 'GTS-GTSSPORTSERI3',
                name: 'GTS Sport Series High K 20-0-20',
                brand: 'gts',
                distributor: 'GTS',
                availability: 'National',
                line: 'Sport Series',
                analysis: { N: 20, K: 19.7, Fe: 3.4, S: 1.5 },
                sgn: 250,
                packSize: 20,
                release: 'controlled',
                weeks: 10,
                rates: { teesMin: 200, teesMax: 300, fairwaysMin: 200, fairwaysMax: 300 },
                useCase: 'stress_hardening',
                notes: '',
            },
            {
                id: 'GTS-GTSSPORTSERI4',
                name: 'GTS Sport Series Sportflexx 19-1-16',
                brand: 'gts',
                distributor: 'GTS',
                availability: 'National',
                line: 'Sport Series',
                analysis: { N: 19.2, P: 1, K: 16, Fe: 3.5, S: 9.4 },
                sgn: 250,
                packSize: 20,
                release: 'stabilised',
                weeks: 8,
                rates: { teesMin: 200, teesMax: 300, fairwaysMin: 200, fairwaysMax: 300 },
                useCase: 'maintenance',
                notes: '',
            },
            {
                id: 'GTS-GTSSPORTSERI5',
                name: 'GTS Sport Series Colour Plus 20-0-16',
                brand: 'gts',
                distributor: 'GTS',
                availability: 'National',
                line: 'Sport Series',
                analysis: { N: 20.8, P: 1, K: 16, Fe: 5, S: 9.08 },
                sgn: 250,
                packSize: 20,
                release: 'slow',
                weeks: 8,
                rates: { teesMin: 200, teesMax: 300, fairwaysMin: 200, fairwaysMax: 300 },
                useCase: 'maintenance',
                notes: '',
            },
            // ========================================
            // GTS N-Lift Range (High N, lower min rates)
            // ========================================
            {
                id: 'GTS-NLIFT22',
                name: 'N-Lift 22',
                brand: 'gts',
                distributor: 'GTS',
                availability: 'National',
                line: 'N-Lift',
                analysis: { N: 22.2, P: 2.2, K: 8.5, Fe: 6.5, S: 8.8 } /* b35fix318: corrected per Jerry Spencer audit Apr 2026 (Fe 0→6.5; S 0→8.8) */,
                sgn: 250,
                packSize: 20,
                release: 'controlled',
                weeks: 8,
                rates: { teesMin: 150, teesMax: 250, fairwaysMin: 150, fairwaysMax: 250 },
                useCase: 'maintenance',
                notes: '',
            },
            {
                id: 'GTS-NLIFT24',
                name: 'N-Lift 24',
                brand: 'gts',
                distributor: 'GTS',
                availability: 'National',
                line: 'N-Lift',
                analysis: { N: 24.3, P: 4.2, K: 8.6, Fe: 3, S: 5.2 } /* b35fix318: corrected per Jerry Spencer audit Apr 2026 (Fe 0→3; S 0→5.2) */,
                sgn: 250,
                packSize: 20,
                release: 'controlled',
                weeks: 8,
                rates: { teesMin: 150, teesMax: 250, fairwaysMin: 150, fairwaysMax: 250 },
                useCase: 'maintenance',
                notes: '',
            },
            {
                id: 'GTS-NLIFT33',
                name: 'N-Lift 33',
                brand: 'gts',
                distributor: 'GTS',
                availability: 'National',
                line: 'N-Lift',
                analysis: { N: 33.1, K: 11, S: 2.6 } /* b35fix318: corrected per Jerry Spencer audit Apr 2026 (S 0→2.6) */,
                sgn: 250,
                packSize: 20,
                release: 'controlled',
                weeks: 8,
                rates: { teesMin: 100, teesMax: 200, fairwaysMin: 100, fairwaysMax: 200 },
                useCase: 'maintenance',
                notes: 'Lower min rate - good for moderate N requirements',
            },
            {
                id: 'GTS-NLIFT46',
                name: 'N-Lift 46',
                brand: 'gts',
                distributor: 'GTS',
                availability: 'National',
                line: 'N-Lift',
                analysis: { N: 46 },
                sgn: 250,
                packSize: 20,
                release: 'controlled',
                weeks: 8,
                rates: { teesMin: 100, teesMax: 200, fairwaysMin: 100, fairwaysMax: 200 },
                useCase: 'maintenance',
                notes: 'High N, lower min rate - good for moderate N requirements',
            },
            // ========================================
            // GTS Simplot Range
            // ========================================
            {
                id: 'GTS-SIMPLOTBAS',
                name: 'Simplot Best All Season',
                brand: 'gts',
                distributor: 'GTS',
                availability: 'National',
                line: 'Simplot',
                analysis: { N: 19, K: 10, Fe: 2.2, S: 13, Mn: 0.25 } /* b35fix318: corrected per Jerry Spencer audit Apr 2026 (Fe 0→2.2; S 0→13; Mn 0→0.25) */,
                sgn: 250,
                packSize: 20,
                release: 'controlled',
                weeks: 8,
                rates: { teesMin: 200, teesMax: 400, fairwaysMin: 200, fairwaysMax: 400 },
                useCase: 'maintenance',
                notes: '',
            },
            {
                id: 'GTS-SIMPLOTNFX',
                name: 'Simplot Best N Flexx',
                brand: 'gts',
                distributor: 'GTS',
                availability: 'National',
                line: 'Simplot',
                analysis: { N: 22, P: 0.76, K: 6.89, Fe: 5.8, S: 5.5 } /* b35fix318: corrected per Jerry Spencer audit Apr 2026 (Fe 0→5.8; S 0→5.5) */,
                sgn: 250,
                packSize: 20,
                release: 'controlled',
                weeks: 8,
                rates: { teesMin: 200, teesMax: 400, fairwaysMin: 200, fairwaysMax: 400 },
                useCase: 'maintenance',
                notes: '',
            },
            {
                id: 'GTS-BESTTURFGOLD',
                name: 'Best Turf Gold',
                brand: 'gts',
                distributor: 'GTS',
                availability: 'National',
                line: 'Simplot',
                analysis: { N: 21, P: 1, K: 3, Fe: 3, S: 13 } /* b35fix318: corrected per Jerry Spencer audit Apr 2026 (N 23→21; Fe 0→3; S 0→13) */,
                sgn: 250,
                packSize: 20,
                release: 'controlled',
                weeks: 8,
                rates: { teesMin: 200, teesMax: 400, fairwaysMin: 200, fairwaysMax: 400 },
                useCase: 'maintenance',
                notes: '',
            },
            {
                id: 'GTS-SIMPLOTPRILLS',
                name: 'Simplot Best Pro Prills',
                brand: 'gts',
                distributor: 'GTS',
                availability: 'National',
                line: 'Simplot',
                analysis: { N: 12, P: 3, K: 13, Fe: 3, S: 17 } /* b35fix318: corrected per Jerry Spencer audit Apr 2026 (Fe 0→3; S 0→17) */,
                sgn: 250,
                packSize: 20,
                release: 'controlled',
                weeks: 8,
                rates: { teesMin: 200, teesMax: 400, fairwaysMin: 200, fairwaysMax: 400 },
                useCase: 'maintenance',
                notes: '',
            },
            // ========================================
            // GTS Other Products
            // ========================================
            {
                id: 'GTS-PLATINUMHN',
                name: 'GTS Platinum High N',
                brand: 'gts',
                distributor: 'GTS',
                availability: 'National',
                line: 'GTS',
                analysis: { N: 21.14, P: 2.65, K: 5.74 },
                sgn: 250,
                packSize: 20,
                release: 'controlled',
                weeks: 8,
                rates: { teesMin: 200, teesMax: 300, fairwaysMin: 200, fairwaysMax: 300 },
                useCase: 'maintenance',
                notes: '',
            },
            {
                id: 'GTS-NEXENUREA',
                name: 'Nexen Urea',
                brand: 'gts',
                distributor: 'GTS',
                availability: 'National',
                line: 'GTS',
                analysis: { N: 46 },
                sgn: 250,
                packSize: 20,
                release: 'quick',
                weeks: 4,
                rates: { teesMin: 100, teesMax: 100, fairwaysMin: 100, fairwaysMax: 100 },
                useCase: 'maintenance',
                notes: 'Quick release urea',
            },
            {
                id: 'GTS-NITREX',
                name: 'Nitrex',
                brand: 'gts',
                distributor: 'GTS',
                availability: 'National',
                line: 'Simplot',
                analysis: { N: 20, P: 0.87, K: 2, Fe: 5, S: 12 } /* b35fix318: corrected per Jerry Spencer audit Apr 2026 (Fe 0→5; S 0→12) */,
                sgn: 250,
                packSize: 20,
                release: 'quick',
                weeks: 4,
                rates: { teesMin: 120, teesMax: 240, fairwaysMin: 120, fairwaysMax: 240 },
                useCase: 'maintenance',
                notes: '',
            },
            {
                id: 'SKW-ALZONNEON460',
                name: 'Alzon Neo N 46-0-0',
                brand: 'skw',
                distributor: 'Gilba',
                availability: 'NSW, QLD, VIC',
                line: 'Alzon',
                analysis: { N: 46 },
                sgn: 250,
                packSize: 25,
                release: 'slow',
                weeks: 12,
                rates: { greensMin: 25, greensMax: 25, teesMin: 150, teesMax: 150, fairwaysMin: 150, fairwaysMax: 150 },
                useCase: 'maintenance',
                notes: '',
            },
            {
                id: 'VAR-AMMONIUMSULP',
                name: 'Ammonium sulphate Tech',
                brand: 'various',
                distributor: 'Various',
                availability: 'National',
                line: 'Various',
                analysis: { N: 21, S: 24 },
                sgn: 80,
                packSize: 20,
                release: 'quick',
                weeks: 2,
                rates: { greensMin: 5, greensMax: 25, teesMin: 5, teesMax: 150, fairwaysMin: 5, fairwaysMax: 150 },
                useCase: 'maintenance',
                notes: '',
            },
            {
                id: 'VAR-MAPTECH',
                name: 'MAP Tech',
                brand: 'various',
                distributor: 'Various',
                availability: 'National',
                line: 'Various',
                analysis: { N: 12, P: 27 },
                sgn: 80,
                packSize: 20,
                release: 'quick',
                weeks: 2,
                rates: { greensMin: 5, greensMax: 25, teesMin: 5, teesMax: 150, fairwaysMin: 5, fairwaysMax: 150 },
                useCase: 'maintenance',
                notes: '',
            },
            {
                id: 'VAR-SULPHATEOFPO',
                name: 'Sulphate of potash Soluble',
                brand: 'various',
                distributor: 'Various',
                availability: 'National',
                line: 'Various',
                analysis: { K: 41.5, S: 18 },
                sgn: 80,
                packSize: 20,
                release: 'quick',
                weeks: 2,
                rates: { greensMin: 5, greensMax: 25, teesMin: 5, teesMax: 150, fairwaysMin: 5, fairwaysMax: 150 },
                useCase: 'maintenance',
                notes: '',
            },
            {
                id: 'VAR-IRONSULPHATE',
                name: 'Iron sulphate Hepta Soluble',
                brand: 'various',
                distributor: 'Various',
                availability: 'National',
                line: 'Various',
                analysis: { Fe: 19.5, S: 11 },
                sgn: 80,
                packSize: 20,
                release: 'quick',
                weeks: 2,
                rates: { greensMin: 5, greensMax: 10, teesMin: 5, teesMax: 10, fairwaysMin: 5, fairwaysMax: 10 },
                useCase: 'maintenance',
                notes: '',
            },
            {
                id: 'VAR-MAGNESIUMSUL',
                name: 'Magnesium sulphate Soluble',
                brand: 'various',
                distributor: 'Various',
                availability: 'National',
                line: 'Various',
                analysis: { Mg: 9.8, S: 13 },
                sgn: 80,
                packSize: 20,
                release: 'quick',
                weeks: 2,
                rates: { greensMin: 5, greensMax: 10, teesMin: 5, teesMax: 10, fairwaysMin: 5, fairwaysMax: 10 },
                useCase: 'maintenance',
                notes: '',
            },
            {
                id: 'VAR-KIESERITE',
                name: 'Kieserite',
                brand: 'various',
                distributor: 'Various',
                availability: 'National',
                line: 'Various',
                analysis: { Mg: 15.1, S: 16 },
                sgn: 250,
                packSize: 20,
                release: 'slow',
                weeks: 8,
                rates: { greensMin: 150, greensMax: 300, teesMin: 150, teesMax: 300, fairwaysMin: 150, fairwaysMax: 300 },
                useCase: 'After hollow tine aeration on greens',
                notes: '',
            },
            {
                id: 'VAR-LOBIURETUREA',
                name: 'Lo biuret urea',
                brand: 'various',
                distributor: 'Various',
                availability: 'National',
                line: 'Various',
                analysis: { N: 46 },
                sgn: 80,
                packSize: 20,
                release: 'quick',
                weeks: 2,
                rates: { greensMin: 5, greensMax: 20, teesMin: 150, teesMax: 150, fairwaysMin: 150, fairwaysMax: 150 },
                useCase: 'maintenance',
                notes: '',
            },
            {
                id: 'VAR-MANGANESESUL',
                name: 'Manganese sulphate',
                brand: 'various',
                distributor: 'Various',
                availability: 'National',
                line: 'Various',
                analysis: { Mn: 31, S: 19 },
                sgn: 80,
                packSize: 20,
                release: 'quick',
                weeks: 2,
                rates: { greensMin: 5, greensMax: 25, teesMin: 5, teesMax: 25, fairwaysMin: 5, fairwaysMax: 25 },
                useCase: 'maintenance',
                notes: '',
            },
            // ----------------------------------------------------------------
            // TURFCARE - TPG Range (v10.3.77)
            // ----------------------------------------------------------------
            {
                id: 'TC-CARBONUREA',
                name: 'Carbon Coated Urea',
                brand: 'fertpro',
                distributor: 'Turfcare',
                availability: 'National',
                line: 'Fertpro',
                // b35fix380: S removed per audit row 23 — pure urea has no sulphur.
                // Pre-fix value (S: 24) was an erroneous copy from ammonium sulphate.
                analysis: { N: 46 },
                sgn: 250,
                packSize: 20,
                release: 'quick',
                weeks: 2,
                rates: { greensMin: 5, greensMax: 25, teesMin: 5, teesMax: 150, fairwaysMin: 5, fairwaysMax: 150 },
                useCase: 'maintenance',
                notes: '',
            },
            {
                id: 'TC-TPGCOMPLETEKP',
                name: 'TPG Complete K Plus',
                brand: 'tpg',
                distributor: 'Turfcare',
                availability: 'National',
                line: 'TPG',
                analysis: { N: 10, P: 2, K: 17, Fe: 1, Mn: 0.2 },
                sgn: 100,
                packSize: 20,
                release: 'slow',
                weeks: 6,
                rates: { greensMin: 300, greensMax: 400 },
                useCase: 'maintenance',
                notes: '',
            },
            {
                id: 'TC-TPGCOMPLETEPP',
                name: 'TPG Complete P Plus',
                brand: 'tpg',
                distributor: 'Turfcare',
                availability: 'National',
                line: 'TPG',
                analysis: { N: 8, P: 9, K: 4, Fe: 1 },
                sgn: 100,
                packSize: 20,
                release: 'slow',
                weeks: 6,
                rates: { greensMin: 300, greensMax: 400 },
                useCase: 'establishment',
                notes: '',
            },
            {
                id: 'TC-TPGENHANCE',
                name: 'TPG Enhance',
                brand: 'tpg',
                distributor: 'Turfcare',
                availability: 'National',
                line: 'TPG',
                analysis: { N: 25, P: 2.1, K: 11.1, Ca: 2, Mg: 0.16, Fe: 0.05, S: 5 },
                sgn: 250,
                packSize: 20,
                release: 'quick',
                weeks: 6,
                rates: { teesMin: 200, teesMax: 300, fairwaysMin: 200, fairwaysMax: 300 },
                useCase: 'growth_boost',
                notes: '',
            },
            {
                id: 'TC-TPGMAINTENANCE',
                name: 'TPG Maintenance',
                brand: 'tpg',
                distributor: 'Turfcare',
                availability: 'National',
                line: 'TPG',
                analysis: { N: 13, P: 1, K: 13, Ca: 3.5, Mg: 4.8, Fe: 1.5, Mn: 0.21 },
                sgn: 85,
                packSize: 20,
                release: 'slow',
                weeks: 6,
                rates: { greensMin: 200, greensMax: 250 },
                useCase: 'maintenance',
                notes: '',
            },
            {
                id: 'TC-TPGRATIO',
                name: 'TPG Ratio',
                brand: 'tpg',
                distributor: 'Turfcare',
                availability: 'National',
                line: 'TPG',
                analysis: { N: 20.7, P: 0.07, K: 16, Ca: 2.5, Mg: 0.2, Fe: 0.07, Mn: 0.01, S: 7 },
                sgn: 250,
                packSize: 20,
                release: 'quick',
                weeks: 6,
                rates: { teesMin: 250, teesMax: 250, fairwaysMin: 250, fairwaysMax: 250 },
                useCase: 'maintenance',
                notes: '',
            },
            {
                id: 'TC-TPGSPECIALK',
                name: 'TPG Special K',
                brand: 'tpg',
                distributor: 'Turfcare',
                availability: 'National',
                line: 'TPG',
                analysis: { N: 13.1, K: 25.2, Fe: 5, S: 11.1 },
                sgn: 250,
                packSize: 20,
                release: 'quick',
                weeks: 6,
                rates: { teesMin: 300, teesMax: 400, fairwaysMin: 300, fairwaysMax: 400 },
                useCase: 'stress_hardening',
                notes: '',
            },
            {
                id: 'TC-TPGSPRINGSUMM',
                name: 'TPG Spring Summer',
                brand: 'tpg',
                distributor: 'Turfcare',
                availability: 'National',
                line: 'TPG',
                analysis: { N: 17, P: 2, K: 14, Fe: 1 },
                sgn: 85,
                packSize: 20,
                release: 'slow',
                weeks: 6,
                rates: { greensMin: 200, greensMax: 250 },
                useCase: 'maintenance',
                notes: '',
            },
            {
                id: 'TC-TPGSTARTMEUP',
                name: 'TPG Start Me Up',
                brand: 'tpg',
                distributor: 'Turfcare',
                availability: 'National',
                line: 'TPG',
                analysis: { N: 16, P: 9.9, K: 10.1, Ca: 3.2, Mg: 0.01, Fe: 0.26, S: 5.3 },
                sgn: 200,
                packSize: 20,
                release: 'quick',
                weeks: 6,
                rates: { teesMin: 200, teesMax: 350, fairwaysMin: 200, fairwaysMax: 350 },
                useCase: 'establishment',
                notes: '',
            },
            {
                id: 'TC-TPGSTRENGTH',
                name: 'TPG Strength',
                brand: 'tpg',
                distributor: 'Turfcare',
                availability: 'National',
                line: 'TPG',
                analysis: { N: 20.1, P: 0.17, K: 8, Ca: 5.7, Mg: 0.46, Fe: 0.16, S: 0.02 },
                sgn: 200,
                packSize: 20,
                release: 'quick',
                weeks: 6,
                rates: { teesMin: 250, teesMax: 350, fairwaysMin: 250, fairwaysMax: 350 },
                useCase: 'maintenance',
                notes: '',
            },
        ],
        
        // --------------------------------------------------------------------
        // LIQUID PRODUCTS
        // --------------------------------------------------------------------
        liquid: [
            {
                id: 'NUT-FOLIMAXNHANC',
                name: 'FoliMAX N-Hancer-N',
                brand: 'nuturf',
                line: 'FoliMAX',
                availability: 'National',
                analysis: { N: 35 },
                form: 'liquid',
                packSize: 20,
                release: 'slow',
                rates: { maxLHa: 50, greensLHa: 20, teesLHa: 20, fairwaysLHa: 20 },
                useCase: 'High N foliar',
                notes: '',
            },
            {
                id: 'NUT-FOLIMAXTRACE',
                name: 'FoliMAX Trace+',
                brand: 'nuturf',
                line: 'FoliMAX',
                availability: 'National',
                analysis: { Mg: 0.06, Mn: 1.08, Zn: 5.7, B: 0.24 },
                form: 'liquid',
                packSize: 20,
                release: 'quick',
                rates: { maxLHa: 10, greensLHa: 5, teesLHa: 5, fairwaysLHa: 5 },
                useCase: 'maintenance',
                notes: '',
            },
            {
                id: 'NUT-FOLIMAXNFE',
                name: 'FoliMAX NFE',
                brand: 'nuturf',
                line: 'FoliMAX',
                availability: 'National',
                analysis: { N: 15, Fe: 6, Mn: 2 },
                form: 'liquid',
                packSize: 20,
                release: 'stabilised',
                rates: { maxLHa: 50, greensLHa: 20, teesLHa: 20, fairwaysLHa: 20 },
                useCase: 'Colour boost',
                notes: '',
            },
            {
                id: 'NUT-FOLIMAXCALMA',
                name: 'FoliMAX Cal Mag',
                brand: 'nuturf',
                line: 'FoliMAX',
                availability: 'National',
                analysis: { N: 11.2, Ca: 13, Mg: 3.4 },
                form: 'liquid',
                packSize: 20,
                release: 'quick',
                rates: { maxLHa: 40, greensLHa: 20, teesLHa: 20, fairwaysLHa: 20 },
                useCase: 'maintenance',
                notes: '',
            },
            {
                id: 'NUT-FOLIMAXNRGNK',
                name: 'FoliMAX NRG-NK',
                brand: 'nuturf',
                line: 'FoliMAX',
                availability: 'National',
                analysis: { N: 19.1, K: 12.7, Fe: 0.4 },
                form: 'liquid',
                packSize: 20,
                release: 'quick',
                rates: { maxLHa: 50, greensLHa: 20, teesLHa: 20, fairwaysLHa: 20 },
                useCase: 'Balanced NK foliar',
                notes: '',
            },
            {
                id: 'NUT-FOLIMAXVIGOR',
                name: 'FoliMAX Vigor-K',
                brand: 'nuturf',
                line: 'FoliMAX',
                availability: 'National',
                analysis: { K: 30 },
                form: 'liquid',
                packSize: 20,
                release: 'quick',
                rates: { maxLHa: 50, greensLHa: 20, teesLHa: 20, fairwaysLHa: 20 },
                useCase: 'K foliar',
                notes: '',
            },
            {
                id: 'NUT-FOLIMAXCALCI',
                name: 'FoliMAX Calcium +',
                brand: 'nuturf',
                line: 'FoliMAX',
                availability: 'National',
                analysis: { Ca: 15 },
                form: 'liquid',
                packSize: 20,
                release: 'quick',
                rates: { maxLHa: 20, greensLHa: 20, teesLHa: 20, fairwaysLHa: 20 },
                useCase: 'Ca foliar',
                notes: '',
            },
            {
                id: 'NUT-FOLIMAXIRON',
                name: 'FoliMAX Iron +',
                brand: 'nuturf',
                line: 'FoliMAX',
                availability: 'National',
                analysis: { Fe: 6 },
                form: 'liquid',
                packSize: 20,
                release: 'quick',
                rates: { maxLHa: 50, greensLHa: 20, teesLHa: 20, fairwaysLHa: 20 },
                useCase: 'Fe foliar',
                notes: '',
            },
            {
                id: 'NUT-FOLIMAXMAGNE',
                name: 'FoliMAX Magnesium +',
                brand: 'nuturf',
                line: 'FoliMAX',
                availability: 'National',
                analysis: { N: 6, Mg: 5 },
                form: 'liquid',
                packSize: 20,
                release: 'quick',
                rates: { maxLHa: 50, greensLHa: 20, teesLHa: 20, fairwaysLHa: 20 },
                useCase: 'Mg correction',
                notes: '',
            },
            {
                id: 'NUT-FOLIMAXMANGA',
                name: 'FoliMAX Manganese +',
                brand: 'nuturf',
                line: 'FoliMAX',
                availability: 'National',
                analysis: { N: 8, Mn: 6 },
                form: 'liquid',
                packSize: 20,
                release: 'quick',
                rates: { maxLHa: 30, greensLHa: 10, teesLHa: 10, fairwaysLHa: 10 },
                useCase: 'Mn correction',
                notes: '',
            },
            {
                id: 'NUT-FOLIMAXLAUNC',
                name: 'FoliMAX Launcher',
                brand: 'nuturf',
                line: 'FoliMAX',
                availability: 'National',
                analysis: { N: 8, P: 10, K: 4 },
                form: 'liquid',
                packSize: 20,
                release: 'quick',
                rates: { maxLHa: 30, greensLHa: 10, teesLHa: 10, fairwaysLHa: 10 },
                useCase: 'Establishment',
                notes: '',
            },
            {
                id: 'NUT-FOLIMAXCHARG',
                name: 'FoliMAX Charger',
                brand: 'nuturf',
                line: 'FoliMAX',
                availability: 'National',
                analysis: { N: 7.2, K: 7.2, Fe: 3.8, Mn: 2.2, S: 3.6, Zn: 0.22 },
                form: 'liquid',
                packSize: 20,
                release: 'quick',
                rates: { maxLHa: 50, greensLHa: 20, teesLHa: 20, fairwaysLHa: 20 },
                useCase: 'Recovery',
                notes: '',
            },
            {
                id: 'NUT-FOLIMAXTURBO',
                name: 'FoliMAX Turbo',
                brand: 'nuturf',
                line: 'FoliMAX',
                availability: 'National',
                analysis: { N: 10, K: 20 },
                form: 'liquid',
                packSize: 20,
                release: 'slow',
                rates: { maxLHa: 50, greensLHa: 40, teesLHa: 40, fairwaysLHa: 40 },
                useCase: 'NK maintenance',
                notes: '',
            },
            {
                id: 'ICL-VITALNOVASTR',
                name: 'Vitalnova Stressbuster',
                brand: 'icl',
                line: 'Vitalnova',
                availability: 'National',
                analysis: { N: 9, P: 0, K: 0.7, Fe: 2, Mn: 0.035, Zn: 0.04, Cu: 0.02 },
                form: 'liquid',
                packSize: 10,
                release: 'quick',
                rates: { maxLHa: 50, greensLHa: 25, teesLHa: 25, fairwaysLHa: 25 },
                useCase: 'Stress relief',
                notes: '',
            },
            {
                id: 'ICL-VITALNOVABLA',
                name: 'Vitalnova Blade',
                brand: 'icl',
                line: 'Vitalnova',
                availability: 'National',
                analysis: { N: 5, P: 2.8, K: 2.9, Fe: 0.05, Mn: 0.06, Zn: 0.08, Cu: 0.02 },
                form: 'liquid',
                packSize: 10,
                release: 'quick',
                rates: { maxLHa: 50, greensLHa: 25, teesLHa: 25, fairwaysLHa: 25 },
                useCase: 'Biostimulant',
                notes: '',
            },
            {
                id: 'ICL-GREENMASTERL',
                name: 'Greenmaster Liquid Spring & Summer',
                brand: 'icl',
                line: 'Greenmaster Liquid',
                availability: 'National',
                analysis: { N: 12, P: 1.7, K: 5, Mn: 0.012, Mo: 0.004, Zn: 0.006, B: 0.012, Cu: 0.006 },
                form: 'liquid',
                packSize: 10,
                release: 'quick',
                rates: { maxLHa: 120, greensLHa: 80, teesLHa: 80, fairwaysLHa: 80 },
                useCase: 'Balanced NPK',
                notes: '',
            },
            {
                id: 'ICL-GREENMASTERL1',
                name: 'Greenmaster Liquid NK',
                brand: 'icl',
                line: 'Greenmaster Liquid',
                availability: 'National',
                analysis: { N: 10, P: 0, K: 8.3, Mo: 0.004, Zn: 0.006, B: 0.013, Cu: 0.006 },
                form: 'liquid',
                packSize: 10,
                release: 'quick',
                rates: { maxLHa: 120, greensLHa: 40, teesLHa: 40, fairwaysLHa: 40 },
                useCase: 'Balanced NK',
                notes: '',
            },
            {
                id: 'ICL-GREENMASTERL2',
                name: 'Greenmaster Liquid High N',
                brand: 'icl',
                line: 'Greenmaster Liquid',
                availability: 'National',
                analysis: { N: 25, P: 0, K: 0, Mg: 1.2, Mn: 0.01, Mo: 0.001, Zn: 0.004, B: 0.01, Cu: 0.004 },
                form: 'liquid',
                packSize: 10,
                release: 'quick',
                rates: { maxLHa: 120, greensLHa: 40, teesLHa: 40, fairwaysLHa: 40 },
                useCase: 'Quick green-up',
                notes: '',
            },
            {
                id: 'ICL-GREENMASTERL3',
                name: 'Greenmaster Liquid High K',
                brand: 'icl',
                line: 'Greenmaster Liquid',
                availability: 'National',
                analysis: { N: 3, P: 1.3, K: 8.3, Mn: 0.012, Mo: 0.004, Zn: 0.006, B: 0.012, Cu: 0.006 },
                form: 'liquid',
                packSize: 10,
                release: 'quick',
                rates: { maxLHa: 80, greensLHa: 40, teesLHa: 40, fairwaysLHa: 40 },
                useCase: 'Pre-stress',
                notes: '',
            },
            {
                id: 'ICL-GREENMASTERL4',
                name: 'Greenmaster Liquid Effect Iron',
                brand: 'icl',
                line: 'Greenmaster Liquid',
                availability: 'National',
                analysis: { N: 0, P: 0, K: 0, Mg: 1, Fe: 7.2, Mn: 0.038, Zn: 0.025, Cu: 0.025 },
                form: 'liquid',
                packSize: 10,
                release: 'quick',
                rates: { maxLHa: 30, greensLHa: 20, teesLHa: 20, fairwaysLHa: 20 },
                useCase: 'Rapid colour',
                notes: '',
            },
            {
                id: 'ICL-GREENMASTERL5',
                name: 'Greenmaster Liquid Step',
                brand: 'icl',
                line: 'Greenmaster Liquid',
                availability: 'National',
                analysis: { P: 0, K: 0, Mn: 2, Mo: 0.115, Zn: 1.15, B: 0.23, Cu: 1.15 },
                form: 'liquid',
                packSize: 10,
                release: 'quick',
                rates: { maxLHa: 60, greensLHa: 40, teesLHa: 40, fairwaysLHa: 40 },
                useCase: 'Micronutrient',
                notes: '',
            },
            {
                id: 'ICL-GREENMASTERL6',
                name: 'Greenmaster Liquid - CalMag',
                brand: 'icl',
                distributor: 'K&B Adams',
                availability: 'National',
                line: 'Greenmaster Liquid',
                analysis: { N: 9, P: 0, K: 0, Ca: 9.3, Mg: 1.8 },
                packSize: 10,
                release: 'quick',
                rates: { maxLHa: 80, greensLHa: 40, teesLHa: 40, fairwaysLHa: 40 },
                suitableFor: ['greens', 'tees', 'fairways'],
                form: 'liquid',
                useCase: 'maintenance',
                notes: 'Source: K&B Adams Australia ICL Product Analysis Worksheet (b35fix398).',
            },
            {
                id: 'ICL-GREENMASTERL7',
                name: 'Greenmaster Liquid Advance - Spring and Summer',
                brand: 'icl',
                distributor: 'K&B Adams',
                availability: 'National',
                line: 'Greenmaster Liquid',
                analysis: { N: 14.1, P: 2, K: 5.9, Mn: 0.012, Mo: 0.004, Zn: 0.006, B: 0.012, Cu: 0.006 },
                packSize: 10,
                release: 'quick',
                rates: { maxLHa: 80, greensLHa: 40, teesLHa: 40, fairwaysLHa: 40 },
                suitableFor: ['greens', 'tees', 'fairways'],
                form: 'liquid',
                useCase: 'maintenance',
                notes: 'Source: K&B Adams Australia ICL Product Analysis Worksheet (b35fix398).',
            },
            {
                id: 'ICL-GREENMASTERL8',
                name: 'Greenmaster Liquid Advance - NK',
                brand: 'icl',
                distributor: 'K&B Adams',
                availability: 'National',
                line: 'Greenmaster Liquid',
                analysis: { N: 12.5, P: 0, K: 10.3, Mn: 0.011, Mo: 0.004, Zn: 0.005, B: 0.012, Cu: 0.005 },
                packSize: 10,
                release: 'quick',
                rates: { maxLHa: 80, greensLHa: 40, teesLHa: 40, fairwaysLHa: 40 },
                suitableFor: ['greens', 'tees', 'fairways'],
                form: 'liquid',
                useCase: 'maintenance',
                notes: 'Source: K&B Adams Australia ICL Product Analysis Worksheet (b35fix398).',
            },
            {
                id: 'ICL-GREENMASTERL9',
                name: 'Greenmaster Liquid Advance - High N',
                brand: 'icl',
                distributor: 'K&B Adams',
                availability: 'National',
                line: 'Greenmaster Liquid',
                analysis: { N: 33, P: 0, K: 0, Mg: 1.6, Mn: 0.013, Mo: 0.004, Zn: 0.006, B: 0.013, Cu: 0.006 },
                packSize: 10,
                release: 'quick',
                rates: { maxLHa: 80, greensLHa: 40, teesLHa: 40, fairwaysLHa: 40 },
                suitableFor: ['greens', 'tees', 'fairways'],
                form: 'liquid',
                useCase: 'maintenance',
                notes: 'Source: K&B Adams Australia ICL Product Analysis Worksheet (b35fix398).',
            },
            {
                id: 'ICL-GREENMASTERL10',
                name: 'Greenmaster Liquid Advance - CalMag',
                brand: 'icl',
                distributor: 'K&B Adams',
                availability: 'National',
                line: 'Greenmaster Liquid',
                analysis: { N: 11.2, P: 0, K: 0, Ca: 10, Mg: 1.5 },
                packSize: 10,
                release: 'quick',
                rates: { maxLHa: 80, greensLHa: 40, teesLHa: 40, fairwaysLHa: 40 },
                suitableFor: ['greens', 'tees', 'fairways'],
                form: 'liquid',
                useCase: 'maintenance',
                notes: 'Source: K&B Adams Australia ICL Product Analysis Worksheet (b35fix398).',
            },
            {
                id: 'ICL-GREENMASTERL11',
                name: 'Greenmaster Liquid Advance - High K',
                brand: 'icl',
                distributor: 'K&B Adams',
                availability: 'National',
                line: 'Greenmaster Liquid',
                analysis: { N: 7, P: 0, K: 23.2, Mn: 0.007, Mo: 0.001, Zn: 0.002, B: 0.008, Cu: 0.001 },
                packSize: 10,
                release: 'quick',
                rates: { maxLHa: 80, greensLHa: 40, teesLHa: 40, fairwaysLHa: 40 },
                suitableFor: ['greens', 'tees', 'fairways'],
                form: 'liquid',
                useCase: 'maintenance',
                notes: 'Source: K&B Adams Australia ICL Product Analysis Worksheet (b35fix398).',
            },
            {
                id: 'ICL-VITALNOVA0',
                name: 'VitalNova Silk',
                brand: 'icl',
                distributor: 'K&B Adams',
                availability: 'National',
                line: 'Vitalnova',
                analysis: { P: 4.4, K: 15.8, Si: 6 },
                packSize: 10,
                release: 'quick',
                rates: { maxLHa: 50, greensLHa: 25, teesLHa: 25, fairwaysLHa: 25 },
                suitableFor: ['greens', 'tees', 'fairways'],
                form: 'liquid',
                useCase: 'maintenance',
                notes: 'Source: K&B Adams Australia ICL Product Analysis Worksheet (b35fix398).',
            },
            {
                id: 'ICL-VITALNOVA1',
                name: 'VitalNova AminoBoost',
                brand: 'icl',
                distributor: 'K&B Adams',
                availability: 'National',
                line: 'Vitalnova',
                analysis: { N: 10, P: 0, K: 7.5 },
                packSize: 10,
                release: 'quick',
                rates: { maxLHa: 50, greensLHa: 25, teesLHa: 25, fairwaysLHa: 25 },
                suitableFor: ['greens', 'tees', 'fairways'],
                form: 'liquid',
                useCase: 'maintenance',
                notes: 'Source: K&B Adams Australia ICL Product Analysis Worksheet (b35fix398).',
            },
            {
                id: 'ICL-VITALNOVA2',
                name: 'VitalNova Links',
                brand: 'icl',
                distributor: 'K&B Adams',
                availability: 'National',
                line: 'Vitalnova',
                analysis: { N: 3.2, P: 4, K: 3.7 },
                packSize: 10,
                release: 'quick',
                rates: { maxLHa: 50, greensLHa: 25, teesLHa: 25, fairwaysLHa: 25 },
                suitableFor: ['greens', 'tees', 'fairways'],
                form: 'liquid',
                useCase: 'maintenance',
                notes: 'Source: K&B Adams Australia ICL Product Analysis Worksheet (b35fix398).',
            },
            {
                id: 'ICL-VITALNOVA3',
                name: 'VitalNova SMX',
                brand: 'icl',
                distributor: 'K&B Adams',
                availability: 'National',
                line: 'Vitalnova',
                analysis: { N: 4, P: 0, K: 9.2 },
                packSize: 10,
                release: 'quick',
                rates: { maxLHa: 50, greensLHa: 25, teesLHa: 25, fairwaysLHa: 25 },
                suitableFor: ['greens', 'tees', 'fairways'],
                form: 'liquid',
                useCase: 'maintenance',
                notes: 'Source: K&B Adams Australia ICL Product Analysis Worksheet (b35fix398).',
            },
            {
                id: 'KBA-GREENTSYNERG',
                name: 'Green-T Synergy 16-1-6',
                brand: 'kandb-adams',
                line: 'Green-T',
                availability: 'National',
                analysis: { N: 16, P: 1, K: 6 },
                form: 'liquid',
                packSize: 9.46,
                release: 'slow',
                rates: { maxLHa: 45, greensLHa: 13, teesLHa: 13, fairwaysLHa: 13 },
                useCase: 'Maintenance foliar',
                notes: '',
            },
            {
                id: 'KBA-GREENT2012',
                name: 'Green-T 20-1-2',
                brand: 'kandb-adams',
                line: 'Green-T',
                availability: 'National',
                analysis: { N: 20, P: 1, K: 2, Fe: 2 },
                form: 'liquid',
                packSize: 9.46,
                release: 'slow',
                rates: { maxLHa: 50, greensLHa: 20, teesLHa: 20, fairwaysLHa: 20 },
                useCase: 'Growth boost',
                notes: '',
            },
            {
                id: 'KBA-GREENT6IRON',
                name: 'Green-T 6 Iron',
                brand: 'kandb-adams',
                line: 'Green-T',
                availability: 'National',
                analysis: { N: 12, Fe: 6, Mn: 0.5 },
                form: 'liquid',
                packSize: 9.46,
                release: 'quick',
                rates: { maxLHa: 13, greensLHa: 6, teesLHa: 6, fairwaysLHa: 6 },
                useCase: 'Colour',
                notes: '',
            },
            {
                id: 'KBA-GREENT12IRON',
                name: 'Green-T 12 Iron',
                brand: 'kandb-adams',
                line: 'Green-T',
                availability: 'National',
                analysis: { N: 12, Fe: 6, Mn: 2, S: 4 },
                form: 'liquid',
                packSize: 9.46,
                release: 'quick',
                rates: { maxLHa: 13, greensLHa: 6, teesLHa: 6, fairwaysLHa: 6 },
                useCase: 'Strong colour',
                notes: '',
            },
            {
                id: 'KBA-FAIRWAYATHLE',
                name: 'Fairway & Athletic 17-1-6',
                brand: 'kandb-adams',
                line: 'Green-T',
                availability: 'National',
                analysis: { N: 17, P: 1, K: 6 },
                form: 'liquid',
                packSize: 9.46,
                release: 'slow',
                rates: { maxLHa: 75, teesLHa: 30, fairwaysLHa: 30 },
                useCase: 'Fairway liquid',
                notes: '',
            },
            {
                id: 'KBA-GREENTIMPULS',
                name: 'Green-T Impulse',
                brand: 'kandb-adams',
                line: 'Green-T',
                availability: 'National',
                analysis: { N: 4, K: 4 },
                form: 'liquid',
                packSize: 9.46,
                release: 'quick',
                rates: { maxLHa: 30, greensLHa: 10, teesLHa: 10, fairwaysLHa: 10 },
                useCase: 'Biostimulant',
                notes: '',
            },
            {
                id: 'KBA-3TIERMAINTAI',
                name: '3 Tier Maintain 11.2-9.9-9.2',
                brand: 'kandb-adams',
                line: '3 Tier',
                availability: 'National',
                analysis: { N: 11.2, P: 9.9, K: 9.2 },
                form: 'liquid',
                packSize: 9.46,
                release: 'quick',
                rates: { maxLHa: 50, greensLHa: 25, teesLHa: 25, fairwaysLHa: 25 },
                useCase: 'Maintenance',
                notes: '',
            },
            {
                id: 'KBA-3TIERESTABLI',
                name: '3 Tier Establish 7-9.9-14',
                brand: 'kandb-adams',
                line: '3 Tier',
                availability: 'National',
                analysis: { N: 7, P: 9.9, K: 14 },
                form: 'liquid',
                packSize: 9.46,
                release: 'quick',
                rates: { maxLHa: 50, greensLHa: 25, teesLHa: 25, fairwaysLHa: 25 },
                useCase: 'Establishment',
                notes: '',
            },
            {
                id: 'KBA-3TIERGROWTH2',
                name: '3 Tier Growth 22.4-2.48-9.2',
                brand: 'kandb-adams',
                line: '3 Tier',
                availability: 'National',
                analysis: { N: 22.4, P: 2.48, K: 9.2 },
                form: 'liquid',
                packSize: 9.46,
                release: 'slow',
                rates: { maxLHa: 50, greensLHa: 25, teesLHa: 25, fairwaysLHa: 25 },
                useCase: 'Growth',
                notes: '',
            },
            {
                id: 'KBA-3TIERCAL86',
                name: '3 Tier Cal 86',
                brand: 'kandb-adams',
                line: '3 Tier',
                availability: 'National',
                analysis: { Ca: 8.6 },
                form: 'liquid',
                packSize: 9.46,
                release: 'quick',
                rates: { maxLHa: 50, greensLHa: 25, teesLHa: 25, fairwaysLHa: 25 },
                useCase: 'Ca foliar',
                notes: '',
            },
            {
                id: 'KBA-3TIERHUMAMNF',
                name: '3 Tier Huma Mn & Fe',
                brand: 'kandb-adams',
                line: '3 Tier',
                availability: 'National',
                analysis: { Fe: 5, Mn: 5 },
                form: 'liquid',
                packSize: 9.46,
                release: 'quick',
                rates: { maxLHa: 50, greensLHa: 25, teesLHa: 25, fairwaysLHa: 25 },
                useCase: 'Mn/Fe humate',
                notes: '',
            },
            {
                id: 'KBA-NITRON14N11F',
                name: 'Nitron 14N + 11Fe',
                brand: 'kandb-adams',
                line: 'Specialty',
                availability: 'National',
                analysis: { N: 14, Fe: 11 },
                form: 'liquid',
                packSize: 20,
                release: 'quick',
                rates: { maxLHa: 30, greensLHa: 15, teesLHa: 15, fairwaysLHa: 15 },
                useCase: 'Colour + growth',
                notes: '',
            },
            {
                id: 'KBA-INFILTRATEK',
                name: 'Infiltrate K',
                brand: 'kandb-adams',
                line: 'Specialty',
                availability: 'National',
                analysis: { K: 24 },
                form: 'liquid',
                packSize: 9.46,
                release: 'quick',
                rates: { maxLHa: 26, greensLHa: 6, teesLHa: 6, fairwaysLHa: 6 },
                useCase: 'K boost',
                notes: '',
            },
            {
                id: 'KBA-SUGARCAL',
                name: 'Sugar Cal',
                brand: 'kandb-adams',
                line: 'Specialty',
                availability: 'National',
                analysis: { Ca: 10 },
                form: 'liquid',
                packSize: 10,
                release: 'quick',
                rates: { maxLHa: 45, greensLHa: 13, teesLHa: 13, fairwaysLHa: 13 },
                useCase: 'Ca foliar',
                notes: '',
            },
            {
                id: 'KBA-RESURGENCE',
                name: 'Resurgence',
                brand: 'kandb-adams',
                line: 'Specialty',
                availability: 'National',
                analysis: { N: 14, Fe: 13 },
                form: 'liquid',
                packSize: 20,
                release: 'quick',
                rates: { maxLHa: 30, greensLHa: 15, teesLHa: 15, fairwaysLHa: 15 },
                useCase: 'Soil health',
                notes: '',
            },
            {
                id: 'KBA-MAGTRACE',
                name: 'Magtrace',
                brand: 'kandb-adams',
                line: 'Specialty',
                availability: 'National',
                analysis: { N: 5.6, Mg: 5, S: 5.1 },
                form: 'liquid',
                packSize: 20,
                release: 'quick',
                rates: { maxLHa: 40, greensLHa: 10, teesLHa: 10, fairwaysLHa: 10 },
                useCase: 'Mg correction',
                notes: '',
            },
            {
                id: 'KBA-LONGPADDOCKS',
                name: 'Long Paddock Sportsturf 10-2-6',
                brand: 'kandb-adams',
                line: 'Long Paddock',
                availability: 'National',
                analysis: { N: 10, P: 2, K: 6 },
                form: 'liquid',
                packSize: 20,
                release: 'quick',
                rates: { maxLHa: 15, greensLHa: 7, teesLHa: 7, fairwaysLHa: 7 },
                useCase: 'Organic NPK',
                notes: '',
            },
            {
                id: 'KBA-LONGPADDOCKR',
                name: 'Long Paddock Rapid Uptake',
                brand: 'kandb-adams',
                line: 'Long Paddock',
                availability: 'National',
                analysis: { N: 11, P: 2, K: 10 },
                form: 'liquid',
                packSize: 20,
                release: 'quick',
                rates: { maxLHa: 15, greensLHa: 7, teesLHa: 7, fairwaysLHa: 7 },
                useCase: 'Quick organic',
                notes: '',
            },
            {
                id: 'IND-INTECMAJORK',
                name: 'Intec Major K',
                brand: 'indigo',
                line: 'LiquiMaxx',
                availability: 'National',
                analysis: { K: 30 },
                form: 'liquid',
                packSize: 10,
                release: 'stabilised',
                rates: { maxLHa: 40, greensLHa: 10, teesLHa: 10, fairwaysLHa: 10 },
                useCase: 'Concentrated N',
                notes: '',
            },
            {
                id: 'IND-INTECCOLOURP',
                name: 'Intec Colourphyll',
                brand: 'indigo',
                line: 'LiquiMaxx',
                availability: 'National',
                analysis: { N: 20, Mg: 1, Fe: 6 },
                form: 'liquid',
                packSize: 10,
                release: 'stabilised',
                rates: { maxLHa: 50, greensLHa: 10, teesLHa: 10, fairwaysLHa: 10 },
                useCase: 'Colour + growth',
                notes: '',
            },
            {
                id: 'IND-INTECCOLOURP1',
                name: 'Intec Colourphyll K',
                brand: 'indigo',
                line: 'LiquiMaxx',
                availability: 'National',
                analysis: { N: 15, K: 10, Mg: 1, Fe: 4 },
                form: 'liquid',
                packSize: 10,
                release: 'stabilised',
                rates: { maxLHa: 50, greensLHa: 10, teesLHa: 10, fairwaysLHa: 10 },
                useCase: 'NK + colour',
                notes: '',
            },
            {
                id: 'IND-INTECCOLOURP2',
                name: 'Intec Colourphyll Total',
                brand: 'indigo',
                line: 'LiquiMaxx',
                availability: 'National',
                analysis: { N: 17, Mg: 1, Fe: 6 },
                form: 'liquid',
                packSize: 10,
                release: 'stabilised',
                rates: { maxLHa: 50, greensLHa: 10, teesLHa: 10, fairwaysLHa: 10 },
                useCase: 'Complete foliar',
                notes: '',
            },
            {
                id: 'OAS-GRASSROOTSBA',
                name: 'Grass Roots Balance',
                brand: 'oasis',
                line: 'Classic',
                availability: 'VIC',
                analysis: { N: 12, K: 12, Fe: 0.5 },
                form: 'liquid',
                packSize: 20,
                release: 'quick',
                rates: { maxLHa: 50, greensLHa: 20, teesLHa: 20, fairwaysLHa: 20 },
                useCase: 'Balanced maintenance',
                notes: '',
            },
            {
                id: 'OAS-GRASSROOTSCA',
                name: 'Grass Roots Carbon Plus',
                brand: 'oasis',
                line: 'Specialty',
                availability: 'VIC',
                analysis: { N: 3.88, K: 2.17, Ca: 9.11, B: 0.3 },
                form: 'liquid',
                packSize: 20,
                release: 'quick',
                rates: { maxLHa: 60, greensLHa: 20, teesLHa: 20, fairwaysLHa: 20 },
                useCase: 'maintenance',
                notes: '',
            },
            {
                id: 'OAS-GRASSROOTSCA1',
                name: 'Grass Roots Calcium',
                brand: 'oasis',
                line: 'Specialty',
                availability: 'VIC',
                analysis: { N: 15, Ca: 18 },
                form: 'liquid',
                packSize: 20,
                release: 'quick',
                rates: { maxLHa: 20, greensLHa: 10, teesLHa: 10, fairwaysLHa: 10 },
                useCase: 'maintenance',
                notes: '',
            },
            {
                id: 'OAS-GRASSROOTSCO',
                name: 'Grass Roots Complete Trace',
                brand: 'oasis',
                line: 'Specialty',
                availability: 'VIC',
                analysis: { N: 3, Mg: 1.5, Fe: 1.5, Mn: 1.5, Cu: 0.6 },
                form: 'liquid',
                packSize: 20,
                release: 'quick',
                rates: { maxLHa: 20, greensLHa: 10, teesLHa: 10, fairwaysLHa: 10 },
                useCase: 'maintenance',
                notes: '',
            },
            {
                id: 'OAS-GRASSROOTSGR',
                name: 'Grass Roots Green Blast 22',
                brand: 'oasis',
                line: 'Specialty',
                availability: 'VIC',
                analysis: { N: 22, Mg: 2, Fe: 4.05, Mn: 1.05 },
                form: 'liquid',
                packSize: 20,
                release: 'stabilised',
                rates: { maxLHa: 60, greensLHa: 20, teesLHa: 20, fairwaysLHa: 20 },
                useCase: 'Disease suppression',
                notes: '',
            },
            {
                id: 'OAS-GRASSROOTSHI',
                name: 'Grass Roots High K',
                brand: 'oasis',
                line: 'Specialty',
                availability: 'VIC',
                analysis: { N: 10, K: 20, Fe: 0.5, Mn: 0.05 },
                form: 'liquid',
                packSize: 20,
                release: 'stabilised',
                rates: { maxLHa: 40, greensLHa: 20, teesLHa: 20, fairwaysLHa: 20 },
                useCase: 'maintenance',
                notes: '',
            },
            {
                id: 'OAS-GRASSROOTSIR',
                name: 'Grass Roots Iron',
                brand: 'oasis',
                line: 'Specialty',
                availability: 'VIC',
                analysis: { Fe: 6 },
                form: 'liquid',
                packSize: 20,
                release: 'quick',
                rates: { maxLHa: 20, greensLHa: 10, teesLHa: 10, fairwaysLHa: 10 },
                useCase: 'maintenance',
                notes: '',
            },
            {
                id: 'OAS-GRASSROOTSMA',
                name: 'Grass Roots Magnesium',
                brand: 'oasis',
                line: 'Specialty',
                availability: 'VIC',
                analysis: { Mg: 5 },
                form: 'liquid',
                packSize: 20,
                release: 'quick',
                rates: { maxLHa: 20, greensLHa: 10, teesLHa: 10, fairwaysLHa: 10 },
                useCase: 'maintenance',
                notes: '',
            },
            {
                id: 'OAS-GRASSROOTSMA1',
                name: 'Grass Roots Manganese',
                brand: 'oasis',
                line: 'Specialty',
                availability: 'VIC',
                analysis: { Mn: 5 },
                form: 'liquid',
                packSize: 20,
                release: 'quick',
                rates: { maxLHa: 20, greensLHa: 10, teesLHa: 10, fairwaysLHa: 10 },
                useCase: 'maintenance',
                notes: '',
            },
            {
                id: 'OAS-GRASSROOTSMA2',
                name: 'Grass Roots Maxi Green 6',
                brand: 'oasis',
                line: 'Specialty',
                availability: 'VIC',
                analysis: { N: 20, Fe: 6 },
                form: 'liquid',
                packSize: 20,
                release: 'stabilised',
                rates: { maxLHa: 50, greensLHa: 20, teesLHa: 20, fairwaysLHa: 20 },
                useCase: 'maintenance',
                notes: '',
            },
            {
                id: 'OAS-GRASSROOTSNI',
                name: 'Grass Roots Nitro 8 Iron',
                brand: 'oasis',
                line: 'Specialty',
                availability: 'VIC',
                analysis: { N: 12, Fe: 8 },
                form: 'liquid',
                packSize: 20,
                release: 'quick',
                rates: { maxLHa: 30, greensLHa: 20, teesLHa: 20, fairwaysLHa: 20 },
                useCase: 'maintenance',
                notes: '',
            },
            {
                id: 'OAS-GRASSROOTSPL',
                name: 'Grass Roots Platinum 5',
                brand: 'oasis',
                line: 'Specialty',
                availability: 'VIC',
                analysis: { N: 5.13, Mg: 4.05, Fe: 4.14, Mn: 2.07 },
                form: 'liquid',
                packSize: 20,
                release: 'quick',
                rates: { maxLHa: 30, greensLHa: 20, teesLHa: 20, fairwaysLHa: 20 },
                useCase: 'maintenance',
                notes: '',
            },
            {
                id: 'OAS-GRASSROOTSST',
                name: 'Grass Roots Stand Up',
                brand: 'oasis',
                line: 'Specialty',
                availability: 'VIC',
                analysis: { K: 45 },
                form: 'liquid',
                packSize: 20,
                release: 'quick',
                rates: { maxLHa: 15, greensLHa: 5, teesLHa: 5, fairwaysLHa: 5 },
                useCase: 'maintenance',
                notes: '',
            },
            {
                id: 'OAS-GRASSROOTSSU',
                name: 'Grass Roots Super Greens',
                brand: 'oasis',
                line: 'Specialty',
                availability: 'VIC',
                analysis: { N: 18, K: 9, Fe: 0.5, Mn: 0.2 },
                form: 'liquid',
                packSize: 20,
                release: 'stabilised',
                rates: { maxLHa: 30, greensLHa: 20, teesLHa: 20, fairwaysLHa: 20 },
                useCase: 'maintenance',
                notes: '',
            },
            {
                id: 'OAS-GRASSROOTSTU',
                name: 'Grass Roots Turf pro',
                brand: 'oasis',
                line: 'Specialty',
                availability: 'VIC',
                analysis: { N: 15, P: 1, K: 15, Fe: 0.5, Mn: 0.05 },
                form: 'liquid',
                packSize: 20,
                release: 'stabilised',
                rates: { maxLHa: 40, greensLHa: 20, teesLHa: 20, fairwaysLHa: 20 },
                useCase: 'maintenance',
                notes: '',
            },
            {
                id: 'LT-MPBRILLIANCE',
                name: 'MP BRILLIANCE',
                brand: 'living-turf',
                line: 'MATCHPLAY',
                availability: 'National',
                analysis: { N: 20, Mg: 1, Fe: 6 },
                form: 'liquid',
                packSize: 20,
                release: 'stabilised',
                rates: { maxLHa: 50, greensLHa: 20, teesLHa: 20, fairwaysLHa: 20 },
                useCase: 'Colour + N + Fe + Mg',
                notes: 'Tees/greens 200–500 mL/100 m² (≈20–50 L/ha) in 6–10 L water/100 m²; fairways/sportsturf 20–50 L/ha in 400–1000 L water/ha.',
            },
            {
                id: 'LT-MPENDURE',
                name: 'MP ENDURE',
                brand: 'living-turf',
                line: 'MATCHPLAY',
                availability: 'National',
                analysis: { N: 40 },
                form: 'liquid',
                packSize: 20,
                release: 'stabilised',
                rates: { maxLHa: 50, greensLHa: 20, teesLHa: 20, fairwaysLHa: 20 },
                useCase: 'High N, long feeding',
                notes: 'Tees/greens 200–500 mL/100 m² (≈20–50 L/ha) in 6–10 L water/100 m²; fairways/sportsturf 20–50 L/ha in 400–1000 L water/ha.',
            },
            {
                id: 'LT-MPENHANCE',
                name: 'MP ENHANCE',
                brand: 'living-turf',
                line: 'MATCHPLAY',
                availability: 'National',
                analysis: { N: 12, Mg: 1, Fe: 10 },
                form: 'liquid',
                packSize: 20,
                release: 'stabilised',
                rates: { maxLHa: 50, greensLHa: 20, teesLHa: 20, fairwaysLHa: 20 },
                useCase: 'Intense green-up (Fe)',
                notes: 'Brochure rate 20–50 L/ha (surface/response dependent).',
            },
            {
                id: 'LT-MPSTRENGTH',
                name: 'MP STRENGTH',
                brand: 'living-turf',
                line: 'MATCHPLAY',
                availability: 'National',
                analysis: { N: 12, K: 20, Fe: 0.5 },
                form: 'liquid',
                packSize: 20,
                release: 'stabilised',
                rates: { maxLHa: 50, greensLHa: 20, teesLHa: 20, fairwaysLHa: 20 },
                useCase: 'NK stress pre-conditioning',
                notes: 'Tees/greens 200–500 mL/100 m² (≈20–50 L/ha) in 6–10 L water/100 m²; fairways/sportsturf 20–50 L/ha in 400–1000 L water/ha.',
            },
            {
                id: 'LT-MPMANGANITE',
                name: 'MP MANGANITE',
                brand: 'living-turf',
                line: 'MATCHPLAY',
                availability: 'National',
                analysis: { Mn: 11 },
                form: 'liquid',
                packSize: 20,
                release: 'quick',
                rates: { maxLHa: 20, greensLHa: 10, teesLHa: 10, fairwaysLHa: 10 },
                useCase: 'Manganese nutrition',
                notes: 'Brochure rate 10–20 L/ha.',
            },
            {
                id: 'LT-MPENRICH',
                name: 'MP ENRICH',
                brand: 'living-turf',
                line: 'MATCHPLAY',
                availability: 'National',
                analysis: { N: 1, Fe: 5, Mn: 4, Zn: 3 },
                form: 'liquid',
                packSize: 20,
                release: 'quick',
                rates: { maxLHa: 40, greensLHa: 20, teesLHa: 20, fairwaysLHa: 20 },
                useCase: 'Micros + colour',
                notes: 'General rate 20–40 L/ha in 150–500 L/ha spray mix; packs 20/200/1000 L.',
            },
            {
                id: 'LT-MPNOURISH',
                name: 'MP NOURISH',
                brand: 'living-turf',
                line: 'MATCHPLAY',
                availability: 'National',
                analysis: { N: 10, P: 1, K: 11 },
                form: 'liquid',
                packSize: 20,
                release: 'medium',
                rates: { maxLHa: 60, greensLHa: 40, teesLHa: 40, fairwaysLHa: 40 },
                useCase: 'Balanced N:K + biology',
                notes: 'General rate 40–60 L/ha; packs 20/200/1000 L.',
            },
            {
                id: 'LT-MPREFRESH',
                name: 'MP REFRESH',
                brand: 'living-turf',
                line: 'MATCHPLAY',
                availability: 'National',
                analysis: { N: 10, P: 1, Ca: 10, B: 1.5 },
                form: 'liquid',
                packSize: 20,
                release: 'medium',
                rates: { maxLHa: 40, greensLHa: 20, teesLHa: 20, fairwaysLHa: 20 },
                useCase: 'Calcium + recovery',
                notes: 'General rate 20–40 L/ha in 150–500 L/ha water; foliar or drench; packs 20/200/1000 L.',
            },
            {
                id: 'LT-MPROOTS',
                name: 'MP ROOTS',
                brand: 'living-turf',
                line: 'MATCHPLAY',
                availability: 'National',
                analysis: { N: 5, P: 5, K: 3 },
                form: 'liquid',
                packSize: 20,
                release: 'medium',
                rates: { maxLHa: 40, greensLHa: 10, teesLHa: 10, fairwaysLHa: 10 },
                useCase: 'Rooting/establishment',
                notes: 'General rate 10–40 L/ha; packs 20/200/1000 L.',
            },
            {
                id: 'LT-MPSAFEK',
                name: 'MP SAFE K',
                brand: 'living-turf',
                line: 'MATCHPLAY',
                availability: 'National',
                analysis: { N: 2, K: 21 },
                form: 'liquid',
                packSize: 20,
                release: 'medium',
                rates: { maxLHa: 40, greensLHa: 20, teesLHa: 20, fairwaysLHa: 20 },
                useCase: 'Potassium citrate + stress',
                notes: 'General rate 20–40 L/ha; packs 20/200/1000 L.',
            },
            {
                id: 'LT-MPSAFEN',
                name: 'MP SAFE N',
                brand: 'living-turf',
                line: 'MATCHPLAY',
                availability: 'National',
                analysis: { N: 28 },
                form: 'liquid',
                packSize: 20,
                release: 'medium',
                rates: { maxLHa: 60, greensLHa: 20, teesLHa: 20, fairwaysLHa: 20 },
                useCase: 'Plant-safe N + biology',
                notes: 'General rate 20–60 L/ha; packs 20/200/1000 L.',
            },
            {
                id: 'LT-MPDEFENCE',
                name: 'MP DEFENCE',
                brand: 'living-turf',
                line: 'MATCHPLAY',
                availability: 'National',
                analysis: { P: 19, K: 30 },
                form: 'liquid',
                packSize: 20,
                release: 'quick',
                rates: { maxLHa: 10, greensLHa: 5, teesLHa: 5, fairwaysLHa: 5 },
                useCase: 'Phosphite + K stress/disease support',
                notes: 'Brochure lists 5–10 L/ha; verify surface-specific directions on label/tech sheet.',
            },
            {
                id: 'GTS-GREENXTRA',
                name: 'Green Xtra',
                brand: 'gts',
                line: 'Agrichem',
                availability: 'National',
                analysis: { N: 20, Mg: 1, Fe: 6 },
                form: 'liquid',
                packSize: 10,
                release: 'quick',
                rates: { maxLHa: 50, greensLHa: 20, teesLHa: 20, fairwaysLHa: 20 },
                useCase: 'maintenance',
                notes: '',
            },
            {
                id: 'GTS-GROCALMGB',
                name: 'Grocal MGB',
                brand: 'gts',
                line: 'Agrichem',
                availability: 'National',
                analysis: { Ca: 17, Mg: 4, B: 0.1 },
                form: 'liquid',
                packSize: 20,
                release: 'quick',
                rates: { maxLHa: 20, greensLHa: 20, teesLHa: 20, fairwaysLHa: 20 },
                useCase: 'maintenance',
                notes: '',
            },
            {
                id: 'GTS-MAXIMANG',
                name: 'Maxi Mang',
                brand: 'gts',
                line: 'Agrichem',
                availability: 'National',
                analysis: { N: 4.6, Mn: 50 },
                form: 'liquid',
                packSize: 20,
                release: 'quick',
                rates: { maxLHa: 10, greensLHa: 5, teesLHa: 10, fairwaysLHa: 10 },
                useCase: 'maintenance',
                notes: '',
            },
            {
                id: 'GTS-NITROIRONADV',
                name: 'Nitro Iron Advance Turf',
                brand: 'gts',
                line: 'Agrichem',
                availability: 'National',
                analysis: { N: 16, Fe: 7, Mn: 1 },
                form: 'liquid',
                packSize: 20,
                release: 'quick',
                rates: { maxLHa: 50, greensLHa: 20, teesLHa: 20, fairwaysLHa: 20 },
                useCase: 'maintenance',
                notes: '',
            },
            {
                id: 'GTS-SUPASTANDPHO',
                name: 'Supa standphos',
                brand: 'gts',
                line: 'Agrichem',
                availability: 'National',
                analysis: { N: 6.2, P: 9.9, K: 3.1, S: 1 },
                form: 'liquid',
                packSize: 20,
                release: 'quick',
                rates: { maxLHa: 20, greensLHa: 20, teesLHa: 20, fairwaysLHa: 20 },
                useCase: 'maintenance',
                notes: '',
            },
            {
                id: 'GTS-SUPATURFIRON',
                name: 'Supaturf Iron',
                brand: 'gts',
                line: 'Agrichem',
                availability: 'National',
                analysis: { Fe: 9 },
                form: 'liquid',
                packSize: 20,
                release: 'quick',
                rates: { maxLHa: 50, greensLHa: 20, teesLHa: 20, fairwaysLHa: 20 },
                useCase: 'maintenance',
                notes: '',
            },
            {
                id: 'GTS-TRACEXTRA',
                name: 'Trace Xtra',
                brand: 'gts',
                line: 'Agrichem',
                availability: 'National',
                analysis: { Mg: 2, Fe: 4, Mn: 1, Zn: 1 },
                form: 'liquid',
                packSize: 20,
                release: 'quick',
                rates: { maxLHa: 50, greensLHa: 20, teesLHa: 20, fairwaysLHa: 20 },
                useCase: 'maintenance',
                notes: '',
            },
            {
                id: 'GTS-CHELATEDCALC',
                name: 'Chelated Calcium EDTA',
                brand: 'gts',
                line: 'GMX',
                availability: 'National',
                analysis: { Ca: 5 },
                form: 'liquid',
                packSize: 10,
                release: 'quick',
                rates: { maxLHa: 50, greensLHa: 20, teesLHa: 20, fairwaysLHa: 20 },
                useCase: 'maintenance',
                notes: '',
            },
            {
                id: 'GTS-CHELATEDIRON',
                name: 'Chelated Iron EDTA',
                brand: 'gts',
                line: 'GMX',
                availability: 'National',
                analysis: { Fe: 7 },
                form: 'liquid',
                packSize: 10,
                release: 'quick',
                rates: { maxLHa: 50, greensLHa: 20, teesLHa: 20, fairwaysLHa: 20 },
                useCase: 'maintenance',
                notes: '',
            },
            {
                id: 'GTS-CHELATEDMAGN',
                name: 'Chelated Magnesium',
                brand: 'gts',
                line: 'GMX',
                availability: 'National',
                analysis: { Mg: 5 },
                form: 'liquid',
                packSize: 10,
                release: 'quick',
                rates: { maxLHa: 50, greensLHa: 20, teesLHa: 20, fairwaysLHa: 20 },
                useCase: 'maintenance',
                notes: '',
            },
            {
                id: 'GTS-HISTARTTURF',
                name: 'Hi Start Turf',
                brand: 'gts',
                line: 'GMX',
                availability: 'National',
                analysis: { N: 10, P: 13, K: 5, Zn: 1 },
                form: 'liquid',
                packSize: 10,
                release: 'quick',
                rates: { maxLHa: 20, greensLHa: 15, teesLHa: 15, fairwaysLHa: 15 },
                useCase: 'maintenance',
                notes: '',
            },
            {
                id: 'GTS-HIGHKLIQUID',
                name: 'High K liquid',
                brand: 'gts',
                line: 'GMX',
                availability: 'National',
                analysis: { K: 30 },
                form: 'liquid',
                packSize: 10,
                release: 'quick',
                rates: { maxLHa: 50, greensLHa: 20, teesLHa: 20, fairwaysLHa: 20 },
                useCase: 'maintenance',
                notes: '',
            },
            {
                id: 'GTS-IRONPLUS',
                name: 'Iron Plus',
                brand: 'gts',
                line: 'GMX',
                availability: 'National',
                analysis: { N: 12, Mg: 1, Fe: 8 },
                form: 'liquid',
                packSize: 10,
                release: 'quick',
                rates: { maxLHa: 50, greensLHa: 20, teesLHa: 20, fairwaysLHa: 20 },
                useCase: 'maintenance',
                notes: '',
            },
            {
                id: 'GTS-SOCAL',
                name: 'Socal',
                brand: 'gts',
                line: 'GMX',
                availability: 'National',
                analysis: { N: 11, Ca: 16 },
                form: 'liquid',
                packSize: 10,
                release: 'quick',
                rates: { maxLHa: 20, greensLHa: 20, teesLHa: 20, fairwaysLHa: 20 },
                useCase: 'maintenance',
                notes: '',
            },
            {
                id: 'GTS-SOCALLESSN',
                name: 'Socal Less N',
                brand: 'gts',
                line: 'GMX',
                availability: 'National',
                analysis: { Ca: 16 },
                form: 'liquid',
                packSize: 10,
                release: 'quick',
                rates: { maxLHa: 20, greensLHa: 20, teesLHa: 20, fairwaysLHa: 20 },
                useCase: 'maintenance',
                notes: '',
            },
            {
                id: 'GTS-SOCALMAG',
                name: 'Socal Mag',
                brand: 'gts',
                line: 'GMX',
                availability: 'National',
                analysis: { N: 12, Ca: 12, Mg: 3 },
                form: 'liquid',
                packSize: 10,
                release: 'quick',
                rates: { maxLHa: 20, greensLHa: 20, teesLHa: 20, fairwaysLHa: 20 },
                useCase: 'maintenance',
                notes: '',
            },
            {
                id: 'GTS-TRACES',
                name: 'Traces',
                brand: 'gts',
                line: 'GMX',
                availability: 'National',
                analysis: { Mg: 2, Fe: 4, Mn: 1, Zn: 1, Cu: 1 },
                form: 'liquid',
                packSize: 10,
                release: 'quick',
                rates: { maxLHa: 50, greensLHa: 20, teesLHa: 20, fairwaysLHa: 20 },
                useCase: 'maintenance',
                notes: '',
            },
            {
                id: 'GTS-LIQUIMAXX101',
                name: 'Liquimaxx 10-1-10',
                brand: 'gts',
                line: 'Liquimaxx',
                availability: 'National',
                analysis: { N: 10, P: 1, K: 10, Fe: 0.5 },
                form: 'liquid',
                packSize: 10,
                release: 'stabilised',
                rates: { maxLHa: 40, greensLHa: 20, teesLHa: 20, fairwaysLHa: 20 },
                useCase: 'maintenance',
                notes: '',
            },
            {
                id: 'GTS-LIQUIMAXX120',
                name: 'Liquimaxx 12-0-20',
                brand: 'gts',
                line: 'Liquimaxx',
                availability: 'National',
                analysis: { N: 12, K: 20, Fe: 0.5 },
                form: 'liquid',
                packSize: 10,
                release: 'stabilised',
                rates: { maxLHa: 50, greensLHa: 20, teesLHa: 20, fairwaysLHa: 20 },
                useCase: 'maintenance',
                notes: '',
            },
            {
                id: 'GTS-NMAXX4000',
                name: 'N Maxx 40-0-0',
                brand: 'gts',
                line: 'Liquimaxx',
                availability: 'National',
                analysis: { N: 40 },
                form: 'liquid',
                packSize: 10,
                release: 'stabilised',
                rates: { maxLHa: 50, greensLHa: 20, teesLHa: 20, fairwaysLHa: 20 },
                useCase: 'maintenance',
                notes: '',
            },
            {
                id: 'GTS-GREENMAXX',
                name: 'Greenmaxx',
                brand: 'gts',
                line: 'Liquimaxx',
                availability: 'National',
                analysis: { N: 20, Mg: 1, Fe: 6 },
                form: 'liquid',
                packSize: 10,
                release: 'stabilised',
                rates: { maxLHa: 50, greensLHa: 20, teesLHa: 20, fairwaysLHa: 20 },
                useCase: 'maintenance',
                notes: '',
            },
            {
                id: 'GTS-GREENMAXXCOM',
                name: 'Greenmaxx Complete',
                brand: 'gts',
                line: 'Liquimaxx',
                availability: 'National',
                analysis: { N: 17, Mg: 1, Fe: 6 },
                form: 'liquid',
                packSize: 10,
                release: 'stabilised',
                rates: { maxLHa: 50, greensLHa: 20, teesLHa: 20, fairwaysLHa: 20 },
                useCase: 'maintenance',
                notes: '',
            },
            {
                id: 'GTS-GREENMAXXK',
                name: 'Greenmaxx K',
                brand: 'gts',
                line: 'Liquimaxx',
                availability: 'National',
                analysis: { N: 15, K: 10, Mg: 1, Fe: 4 },
                form: 'liquid',
                packSize: 10,
                release: 'stabilised',
                rates: { maxLHa: 50, greensLHa: 20, teesLHa: 20, fairwaysLHa: 20 },
                useCase: 'maintenance',
                notes: '',
            },
            // ----------------------------------------------------------------
            // TURFCARE - TPL Liquid Range (v10.3.77)
            // ----------------------------------------------------------------
            {
                id: 'TC-TPLCOMBO',
                name: 'TPL Combo',
                brand: 'turfcare',
                line: 'TPL',
                availability: 'National',
                analysis: { N: 11.2, Ca: 13, Mg: 3.4 },
                form: 'liquid',
                packSize: 20,
                release: 'quick',
                rates: { maxLHa: 40, greensLHa: 10, teesLHa: 10, fairwaysLHa: 10 },
                useCase: 'Calcium + Magnesium',
                notes: 'Contains B 0.1%',
            },
            {
                id: 'TC-TPLENTIRE',
                name: 'TPL Entire',
                brand: 'turfcare',
                line: 'TPL',
                availability: 'National',
                analysis: { N: 18, K: 12, Fe: 0.04 },
                form: 'liquid',
                packSize: 20,
                release: 'slow',
                rates: { maxLHa: 20, greensLHa: 6, teesLHa: 6, fairwaysLHa: 6 },
                useCase: 'Balanced NK slow release',
                notes: '',
            },
            {
                id: 'TC-TPLESSENCE',
                name: 'TPL Essence',
                brand: 'turfcare',
                line: 'TPL',
                availability: 'National',
                analysis: { N: 14.2, P: 3, K: 5.3, Fe: 0.9, Mn: 0.02 },
                form: 'liquid',
                packSize: 20,
                release: 'quick',
                rates: { maxLHa: 50, greensLHa: 20, teesLHa: 20, fairwaysLHa: 20 },
                useCase: 'Complete foliar',
                notes: 'Contains Zn 0.05%',
            },
            {
                id: 'TC-TPLHIK',
                name: 'TPL Hi K',
                brand: 'turfcare',
                line: 'TPL',
                availability: 'National',
                analysis: { N: 10, K: 20, Fe: 0.4 },
                form: 'liquid',
                packSize: 20,
                release: 'slow',
                rates: { maxLHa: 100, greensLHa: 40, teesLHa: 40, fairwaysLHa: 40 },
                useCase: 'K stress hardening',
                notes: '',
            },
            {
                id: 'TC-TPLSTANDOUT',
                name: 'TPL Standout',
                brand: 'turfcare',
                line: 'TPL',
                availability: 'National',
                analysis: { N: 15, Fe: 6, Mn: 2 },
                form: 'liquid',
                packSize: 20,
                release: 'quick',
                rates: { maxLHa: 40, greensLHa: 20, teesLHa: 20, fairwaysLHa: 20 },
                useCase: 'Colour boost',
                notes: '',
            },
            {
                id: 'TC-TPLSTANDOUTLON',
                name: 'TPL Standout Lo N',
                brand: 'turfcare',
                line: 'TPL',
                availability: 'National',
                analysis: { N: 5, Mg: 0.3, Fe: 6, Mn: 4 },
                form: 'liquid',
                packSize: 20,
                release: 'quick',
                rates: { maxLHa: 40, greensLHa: 20, teesLHa: 20, fairwaysLHa: 20 },
                useCase: 'Low N colour boost',
                notes: '',
            },
            {
                id: 'TC-TPLSTRENGTH',
                name: 'TPL Strength',
                brand: 'turfcare',
                line: 'TPL',
                availability: 'National',
                analysis: { P: 22, K: 32 },
                form: 'liquid',
                packSize: 20,
                release: 'quick',
                rates: { maxLHa: 10, greensLHa: 5, teesLHa: 5, fairwaysLHa: 5 },
                useCase: 'Phosphite + K stress',
                notes: '',
            },
            // ----------------------------------------------------------------
            // TURFCARE - Floratine Range (v10.3.77)
            // ----------------------------------------------------------------
            {
                id: 'TC-LARGO',
                name: 'Largo',
                brand: 'turfcare',
                line: 'Floratine',
                availability: 'National',
                analysis: { N: 12, Fe: 6, Mn: 1.5, S: 4.2 },
                form: 'liquid',
                packSize: 10,
                release: 'quick',
                rates: { maxLHa: 10, greensLHa: 5, teesLHa: 5, fairwaysLHa: 5 },
                useCase: 'Colour + micros',
                notes: 'Contains Zn 1%',
            },
            {
                id: 'TC-PHLEXMAG',
                name: 'Phlex Mag',
                brand: 'turfcare',
                line: 'Floratine',
                availability: 'National',
                analysis: { Mg: 4 },
                form: 'liquid',
                packSize: 10,
                release: 'quick',
                rates: { maxLHa: 5, greensLHa: 2.5, teesLHa: 2.5, fairwaysLHa: 2.5 },
                useCase: 'Magnesium correction',
                notes: '',
            },
            {
                id: 'TC-PHLEXMAN',
                name: 'Phlex Man',
                brand: 'turfcare',
                line: 'Floratine',
                availability: 'National',
                analysis: { Mn: 5 },
                form: 'liquid',
                packSize: 10,
                release: 'quick',
                rates: { maxLHa: 5, greensLHa: 2.5, teesLHa: 2.5, fairwaysLHa: 2.5 },
                useCase: 'Manganese correction',
                notes: '',
            },
            {
                id: 'TC-XFACTOR0022',
                name: 'X Factor 0-0-22',
                brand: 'turfcare',
                line: 'Floratine',
                availability: 'National',
                analysis: { K: 22, S: 4.2 },
                form: 'liquid',
                packSize: 10,
                release: 'quick',
                rates: { maxLHa: 30, greensLHa: 10, teesLHa: 10, fairwaysLHa: 10 },
                useCase: 'K foliar',
                notes: '',
            },
            {
                id: 'TC-XFACTOR1836',
                name: 'X Factor 18-3-6',
                brand: 'turfcare',
                line: 'Floratine',
                availability: 'National',
                analysis: { N: 18, P: 1.32, K: 4.98, S: 4 },
                form: 'liquid',
                packSize: 10,
                release: 'quick',
                rates: { maxLHa: 30, greensLHa: 10, teesLHa: 10, fairwaysLHa: 10 },
                useCase: 'Balanced NPK foliar',
                notes: '',
            },
            {
                id: 'TC-XFACTOR2800',
                name: 'X Factor 28-0-0',
                brand: 'turfcare',
                line: 'Floratine',
                availability: 'National',
                analysis: { N: 28 },
                form: 'liquid',
                packSize: 10,
                release: 'quick',
                rates: { maxLHa: 30, greensLHa: 10, teesLHa: 10, fairwaysLHa: 10 },
                useCase: 'High N foliar',
                notes: '',
            },
            {
                id: 'TC-XFACTOR4416',
                name: 'X Factor 4-4-16',
                brand: 'turfcare',
                line: 'Floratine',
                availability: 'National',
                analysis: { N: 4, P: 4, K: 16, S: 4 },
                form: 'liquid',
                packSize: 10,
                release: 'quick',
                rates: { maxLHa: 30, greensLHa: 10, teesLHa: 10, fairwaysLHa: 10 },
                useCase: 'High K foliar',
                notes: '',
            },
            {
                id: 'TC-QUADK',
                name: 'Quad K',
                brand: 'turfcare',
                line: 'Floratine',
                availability: 'National',
                analysis: { K: 37.35 },
                form: 'liquid',
                packSize: 10,
                release: 'quick',
                rates: { maxLHa: 20, greensLHa: 20, teesLHa: 20, fairwaysLHa: 20 },
                useCase: 'Ultra high K foliar',
                notes: '',
            },
        ],
        
        // ========================================================================
        // SOLUBLE PRODUCTS - Technical grades for spoonfeeding and targeted applications
        // Available from agricultural merchants, Elders, Landmark, etc.
        // ========================================================================
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
            // SOLUBLE POTASSIUM NITRATE - HIGH K WITH NITRATE N
            // ============================================================
            {
                id: 'SOL-KNO3',
                name: 'Potassium Nitrate (KNO3)',
                brand: 'various',
                distributor: 'Various',
                availability: 'National',
                // b35fix380: K converted from oxide (44% K2O) to elemental (38.67% K)
                // per AU agronomic convention. N updated to 13.85 to match KNO3
                // stoichiometry (matches UK audit-verified row 395).
                // Pre-fix b35fix378 entry was {N: 13, K: 44} = oxide values; rest of
                // AU database is elemental, so this entry was inconsistent.
                analysis: { N: 13.85, P: 0, K: 38.67, S: 0 },
                form: 'soluble',
                packSize: 25,
                maxRateKgHa: 100,
                greensMaxRateKgHa: 30,
                suitableFor: ['greens', 'golf_greens', 'bowling_greens', 'tees', 'fairways', 'sports'],
                notes: 'Nitrate N + high K. Chloride-free. Ideal cool weather NK source. Low scorch risk.',
                useCase: 'Seashore paspalum NK (nitrate-N preferred over ammonium per Duncan & Carrow 2000; ~40-50% lower N rates than bermudagrass). Cool-season K hardening. Nitrate N preference.',
            },
            // ============================================================
            // SOLUBLE CALCIUM NITRATE - CALCIUM WITH NITRATE N
            // ============================================================
            {
                id: 'SOL-CANO3',
                name: 'Calcium Nitrate Ca(NO3)2',
                brand: 'various',
                distributor: 'Various',
                availability: 'National',
                analysis: { N: 15.5, P: 0, K: 0, Ca: 19, S: 0 },
                form: 'soluble',
                packSize: 25,
                maxRateKgHa: 150,
                greensMaxRateKgHa: 30,
                suitableFor: ['greens', 'golf_greens', 'bowling_greens', 'tees', 'fairways', 'sports'],
                notes: 'Nitrate N + readily available Ca. Fast Ca uptake. Cool-temperature N source.',
                useCase: 'Seashore paspalum Ca needs. Cell wall strength. Cool-season growth.',
            },
            // ============================================================
            // SOLUBLE MAGNESIUM NITRATE - MAGNESIUM WITH NITRATE N
            // ============================================================
            {
                id: 'SOL-MGNO3',
                name: 'Magnesium Nitrate Mg(NO3)2',
                brand: 'various',
                distributor: 'Various',
                availability: 'National',
                analysis: { N: 11, P: 0, K: 0, Mg: 9.5, S: 0 },
                form: 'soluble',
                packSize: 25,
                maxRateKgHa: 100,
                greensMaxRateKgHa: 25,
                suitableFor: ['greens', 'golf_greens', 'bowling_greens', 'tees', 'fairways', 'sports'],
                notes: 'Nitrate N + Mg. Superior to sulphate form in cool weather. Chlorophyll response.',
                useCase: 'Mg deficiency with nitrate N. Cool-weather Mg uptake. Tank mix compatible.',
            },
            // ============================================================
            // SOLUBLE POTASSIUM SULPHATE - PURE K + S, NO N
            // b35fix397: added to fill the chloride-free, N-free K source gap.
            // Useful for tissue-K correction on high-N programmes where
            // additional N from KNO3 is undesirable, and for chloride-sensitive
            // turf (couch greens, paspalum, fine fescues). 0-0-41.5 elemental
            // (52% K2O x 0.8302 conversion); 18% S textbook value
            // (Havlin et al., Soil Fertility and Fertilizers, 8th ed., Ch.10).
            // ============================================================
            {
                id: 'SOL-K2SO4',
                name: 'Potassium Sulphate (K2SO4)',
                brand: 'various',
                distributor: 'Various',
                availability: 'National',
                analysis: { N: 0, P: 0, K: 41.5, S: 18 },
                form: 'soluble',
                packSize: 25,
                maxRateKgHa: 80,
                greensMaxRateKgHa: 25,
                suitableFor: ['greens', 'golf_greens', 'bowling_greens', 'tees', 'fairways', 'sports'],
                notes: 'Pure K + S, no N. Chloride-free. Lower solubility than KNO3 (~110 g/L at 20C, ~85 g/L at 5C). Tank check after cold storage.',
                useCase: 'Tissue-K correction without added N. Chloride-sensitive turf. K2SO4 preferred over MOP on couch/paspalum/fine fescues.',
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
        ],
    };
    // ========================================================================
    // RECOMMENDATION ENGINE v3.0.0
    // Rebuilt to match NZ/Prebble approach with GP-aware delivery strategies
    // ========================================================================

    const AuFertiliserRecommender = {
        
        version: '3.15.1',
        
        // ====================================================================
        // SEASON RELEASE PREFERENCES
        // ====================================================================
        seasonRelease: {
            'peak_growth': ['slow', 'controlled', 'standard'],
            'spring': ['slow', 'controlled', 'standard'],
            'autumn': ['slow', 'controlled', 'standard'],
            'summer_stress': ['slow', 'controlled'],
            'winter': ['standard', 'slow'], // Quick release works better in cold
        },
        
        /**
         * Detect Australian state from coordinates
         */
        detectState: function(lat, lon) {
            for (const [state, bounds] of Object.entries(CONFIG.stateBounds)) {
                if (lat >= bounds.latMin && lat <= bounds.latMax &&
                    lon >= bounds.lonMin && lon <= bounds.lonMax) {
                    return state;
                }
            }
            return null;
        },
        
        /**
         * Get season phase based on GP and calendar
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
         * Filter products by availability
         */
        filterByAvailability: function(products, availability) {
            if (!availability || availability === 'all') {
                return products;
            }
            
            return products.filter(p => {
                if (p.availability === 'National') return true;
                if (availability === 'national') return p.availability === 'National';
                return p.availability && p.availability.includes(availability);
            });
        },
        
        /**
         * Filter products by distributor
         */
        filterByDistributor: function(products, distributor) {
            if (!distributor || distributor === 'all') {
                return products;
            }
            
            return products.filter(p => {
                // Direct distributor match
                if (p.distributor === distributor) return true;
                
                // "Various" distributor products are generic and available from any distributor
                // (e.g., Ammonium Sulphate Tech, technical grade fertilisers)
                if (p.distributor === 'Various') return true;
                
                // Brand-based lookup for products without distributor field
                if (p.brand && !p.distributor) {
                    const brandKey = p.brand.toLowerCase().replace(/\s+/g, '-');
                    const brandInfo = BRANDS[brandKey] || LIQUID_BRANDS[brandKey];
                    if (brandInfo && brandInfo.distributor === distributor) return true;
                    if (brandKey === 'kandb-adams' && distributor === 'K&B Adams') return true;
                }
                
                return false;
            });
        },
        
        /**
         * Get distributor options for UI
         * @param {string} state - Optional state code (VIC, NSW, etc.) to filter by territory
         * @returns {Array} Distributor options available for the state
         */
        getDistributorOptions: function(state) {
            if (!state) {
                return CONFIG.distributorOptions;
            }
            
            // Filter distributors by territory coverage
            const territories = CONFIG.distributorTerritories;
            return CONFIG.distributorOptions.filter(opt => {
                if (opt.value === 'all') return true; // Always show "All Products"
                
                const coverage = territories[opt.value];
                if (!coverage) return true; // Unknown distributor - show by default
                
                // National distributors service all states
                if (coverage.includes('National')) return true;
                
                // Check if distributor services this state
                return coverage.includes(state);
            });
        },
        
        /**
         * Get distributor territory coverage
         * @param {string} distributor - Distributor name
         * @returns {Array} States/territories covered
         */
        getDistributorTerritory: function(distributor) {
            return CONFIG.distributorTerritories[distributor] || ['National'];
        },
        
        /**
         * Filter products by surface type (SGN check)
         */
        filterBySurface: function(products, surfaceType) {
            const sgnRange = CONFIG.surfaceSGN[surfaceType] || { min: 0, max: 999 };
            
            return products.filter(p => {
                // Liquids and solubles always suitable (no SGN constraint)
                if (p.form === 'liquid' || p.form === 'soluble') return true;
                
                // Null SGN means DG/soluble - works everywhere
                if (p.sgn === null) return true;
                
                // Check SGN range
                const sgn = p.sgn || 200;
                return sgn >= sgnRange.min && sgn <= sgnRange.max;
            });
        },
        
        /**
         * Filter products by release type for season
         */
        filterByRelease: function(products, seasonPhase) {
            const preferredRelease = this.seasonRelease[seasonPhase] || ['slow', 'standard'];
            
            // Sort by preference, don't exclude
            return products.sort((a, b) => {
                const aRelease = a.release || 'standard';
                const bRelease = b.release || 'standard';
                const aIndex = preferredRelease.indexOf(aRelease);
                const bIndex = preferredRelease.indexOf(bRelease);
                
                const aScore = aIndex === -1 ? 99 : aIndex;
                const bScore = bIndex === -1 ? 99 : bIndex;
                
                return aScore - bScore;
            });
        },
        
        /**
         * Get rate for surface type
         */
        getRateForSurface: function(product, surfaceType) {
            if (!product.rates) return null;
            
            const isGreens = ['greens', 'golf_greens', 'bowling_greens'].includes(surfaceType);
            const isTees = ['tees', 'low_cut', 'cricket_wickets'].includes(surfaceType);
            
            if (product.form === 'liquid' || product.form === 'soluble') {
                if (isGreens && product.rates.greensLHa) return { value: product.rates.greensLHa, unit: 'L/ha' };
                if (isTees && product.rates.teesLHa) return { value: product.rates.teesLHa, unit: 'L/ha' };
                if (product.rates.fairwaysLHa) return { value: product.rates.fairwaysLHa, unit: 'L/ha' };
                if (product.rates.maxLHa) return { value: product.rates.maxLHa, unit: 'L/ha' };
            } else {
                if (isGreens && product.rates.greensMax) return { value: product.rates.greensMax, unit: 'kg/ha' };
                if (isTees && product.rates.teesMax) return { value: product.rates.teesMax, unit: 'kg/ha' };
                if (product.rates.fairwaysMax) return { value: product.rates.fairwaysMax, unit: 'kg/ha' };
            }
            return null;
        },
        
        /**
         * Calculate application rate to deliver target nutrient
         */
        calcRate: function(product, targetAmount, nutrient) {
            const pct = (product.analysis[nutrient] || 0) / 100;
            if (pct === 0) return null;
            return Math.round(targetAmount / pct);
        },
        
        /**
         * Get products for surface with optional filters
         * NOTE: Solubles are always included regardless of distributor filter
         * (they're generic technical grades available from any ag merchant)
         */
        getProductsForSurface: function(surfaceType, stateFilter, distributorFilter) {
            let granular = this.filterBySurface(AuFertiliserProducts.granular, surfaceType);
            let liquid = AuFertiliserProducts.liquid || [];
            let soluble = AuFertiliserProducts.soluble || [];
            
            if (stateFilter && stateFilter !== 'all') {
                granular = this.filterByAvailability(granular, stateFilter);
                liquid = this.filterByAvailability(liquid, stateFilter);
                // Solubles are national - no state filtering needed
            }
            
            if (distributorFilter && distributorFilter !== 'all') {
                granular = this.filterByDistributor(granular, distributorFilter);
                liquid = this.filterByDistributor(liquid, distributorFilter);
                // IMPORTANT: Solubles are NOT filtered by distributor
                // They're generic technical grades (MAP, SOP, AS, Urea) available from any ag merchant
            }
            
            // Combine liquids and solubles for the 'all' array
            const liquidAndSoluble = [...liquid, ...soluble];
            
            return { 
                granular, 
                liquid: liquid,
                soluble: soluble,
                all: liquidAndSoluble 
            };
        },
        
        /**
         * Get label rates for a product and surface type
         * Returns { min, max } in kg/ha, or null if product not suitable for surface
         */
        getProductRatesForSurface: function(product, surfaceType) {
            if (!product.rates) {
                // No rates specified - use sensible defaults
                return { min: 100, max: 300 };
            }
            
            const isGreens = ['greens', 'golf_greens', 'bowling_greens'].includes(surfaceType);
            const isTees = ['tees', 'low_cut', 'cricket_wickets'].includes(surfaceType);
            const isFairways = ['fairways', 'sports', 'sportsturf', 'athletic'].includes(surfaceType);
            
            if (isGreens) {
                if (product.rates.greensMin !== undefined && product.rates.greensMax !== undefined) {
                    return { min: product.rates.greensMin, max: product.rates.greensMax };
                }
                // No greens rates = not suitable for greens
                return null;
            }
            
            if (isTees) {
                if (product.rates.teesMin !== undefined && product.rates.teesMax !== undefined) {
                    return { min: product.rates.teesMin, max: product.rates.teesMax };
                }
                // Fall through to fairways rates
            }
            
            // Fairways/sports - use fairways rates or defaults
            if (product.rates.fairwaysMin !== undefined && product.rates.fairwaysMax !== undefined) {
                return { min: product.rates.fairwaysMin, max: product.rates.fairwaysMax };
            }
            
            // Fallback defaults for sportsturf
            return { min: 100, max: 350 };
        },
        
        /**
         * Select best nitrogen source for requirements
         * Uses actual label rates from products
         * Excludes pre-emergent herbicide products
         * 
         * @param {Array} products - Granular products to choose from
         * @param {Object} monthData - { N, K, gp, ... }
         * @param {Object} context - { isGreens, surfaceType, ... }
         * @returns {Object|null} Product recommendation with rate and delivery
         */
        selectNitrogenSource: function(products, monthData, context) {
            const nRequired = monthData.N || 0;
            const kRequired = monthData.K || 0;
            // GH-327: P was never passed into this function at all -- only
            // penalized via soilPSufficient (a boolean, magnitude-blind) in
            // SCORE 4 below. Following GH-326's diagnosis: unlike K, P had no
            // positive score rewarding a product for actually matching a real
            // deficit, so a genuine Required P (e.g. 14 kg/ha, confirmed live)
            // never pulled selection toward a P-containing product.
            const pRequired = monthData.P || 0;
            const surfaceType = context.surfaceType || 'sports';
            const isGreens = context.isGreens || ['greens', 'golf_greens', 'bowling_greens'].includes(surfaceType);
            
            if (nRequired <= 0) return null;
            
            // PRE-FILTER: Only products that:
            // 1. Have at least 10% N
            // 2. Are NOT pre-emergent herbicides (useCase !== 'pre_emergent*')
            // 3. Have label rates for this surface type
            // 4. Can deliver required N within their label rate range
            let viableProducts = [];

            products.forEach(product => {
                const nPct = (product.analysis?.N || 0) / 100;
                if (nPct < 0.10) return; // Need at least 10% N
                
                // EXCLUDE pre-emergent herbicide products
                const useCase = (product.useCase || '').toLowerCase();
                if (useCase.includes('pre_emergent') || useCase.includes('herbicide')) {
                    return; // Skip herbicide products
                }
                
                const labelRates = this.getProductRatesForSurface(product, surfaceType);
                if (!labelRates) return; // Product not suitable for this surface
                
                const rateNeeded = nRequired / nPct;
                const minRateNDelivery = labelRates.min * nPct;
                const maxRateNDelivery = labelRates.max * nPct;
                
                // For slow-release products, account for multi-month coverage
                // v3.18.2: Use product.weeks if defined, otherwise default based on release AND form
                // Liquids have much shorter duration than granular equivalents
                // Granular: controlled=12wk, slow/stabilised=8wk, quick=4wk
                // Liquid: controlled/slow/stabilised=4wk, quick=2wk
                const isLiquid = product.form === 'liquid';
                let defaultWeeks;
                if (isLiquid) {
                    defaultWeeks = (product.release === 'quick') ? 2 : 4;
                } else {
                    defaultWeeks = product.release === 'controlled' ? 12 
                        : (product.release === 'slow' || product.release === 'stabilised') ? 8 
                        : 4;
                }
                const releaseWeeks = product.weeks || defaultWeeks;
                const monthsCovered = Math.max(1, Math.ceil(releaseWeeks / 4));
                const effectiveMonthlyN = minRateNDelivery / monthsCovered;
                
                // v3.17.0: Stricter viability check
                // Product is viable if:
                // - Rate needed is within label range, OR
                // - Effective monthly N delivery is within 2.0x of requirement (was 2.5x), OR
                // - Max rate delivers at least 50% of what we need
                // 
                // Key change: 2.0x max overshoot prevents products like 46% urea at min 100kg
                // from being selected when only 5kg N is needed
                const maxOvershoot = 2.0;
                const canDeliver = (
                    (rateNeeded >= labelRates.min && rateNeeded <= labelRates.max) ||
                    (rateNeeded < labelRates.min && effectiveMonthlyN <= nRequired * maxOvershoot) ||
                    (rateNeeded > labelRates.max && maxRateNDelivery >= nRequired * 0.5)
                );
                
                if (canDeliver) {
                    viableProducts.push({
                        product,
                        labelRates,
                        rateNeeded,
                        nPct,
                        monthsCovered,
                        effectiveMonthlyN
                    });
                }
            });
            
            
            if (viableProducts.length === 0) {
                return null;
            }
            
            // Calculate required N:K ratio
            const requiredRatio = kRequired > 0 ? nRequired / kRequired : Infinity;
            
            // Context for advanced scoring
            const season = context.season || '';
            const monthNum = context.monthNum || 0;
            const soilPSufficient = context.soilPSufficient !== false; // Default true (MLSN approach - don't add P unless deficient)
            const isAutumn = ['Autumn', 'autumn'].includes(season) ||
                            (context.hemisphere === 'south' && [3, 4, 5].includes(monthNum)) ||
                            (context.hemisphere !== 'south' && [9, 10, 11].includes(monthNum));

            // GH-329: hard-exclude P/K when not needed and a clean (low-P/K)
            // alternative exists among viable N-delivery candidates -- same
            // "exclude entirely" pattern as the herbicide/N-content filter
            // above, instead of leaving this as one more soft score term.
            // Confirmed live: a dilute product (6% N, e.g. Ezyreno 6-2.5-3.7)
            // needs a large total mass to hit N targets, so even a modest
            // 2.5%/3.7% P/K content compounds into a large absolute delivery
            // -- its resulting excellent N-match score kept winning over a
            // concentrated, P/K-free alternative (46-0-0 urea) despite
            // Required P/K = 0; GH-327/328's pScore/kScore penalty alone
            // wasn't reliably enough to displace it. Falls back to keeping
            // the P/K-containing candidates when NO clean alternative exists
            // this month, so a genuine N need is never left unmet.
            const CLEAN_NUTRIENT_KGHA = 2; // same "minimal" cutoff pScore/kScore's own "not needed" bands already use
            const effectiveMonthlyOf = (entry, key) => {
                const pct = (entry.product.analysis?.[key] || 0) / 100;
                const actualRate = Math.max(entry.rateNeeded, entry.labelRates.min);
                return (actualRate * pct) / entry.monthsCovered;
            };
            if (soilPSufficient) {
                const cleanP = viableProducts.filter(e => effectiveMonthlyOf(e, 'P') <= CLEAN_NUTRIENT_KGHA);
                if (cleanP.length > 0) viableProducts = cleanP;
            }
            if (kRequired <= 0) {
                const cleanK = viableProducts.filter(e => effectiveMonthlyOf(e, 'K') <= CLEAN_NUTRIENT_KGHA);
                if (cleanK.length > 0) viableProducts = cleanK;
            }


            // Score viable products
            let bestMatch = null;
            let bestScore = -Infinity;
            
            viableProducts.forEach(({ product, labelRates, rateNeeded, nPct, monthsCovered, effectiveMonthlyN }) => {
                const kPct = (product.analysis?.K || 0) / 100;
                const pPct = (product.analysis?.P || 0) / 100;
                
                // Calculate what will actually be delivered at the rate we'd use
                const actualRate = Math.max(rateNeeded, labelRates.min);
                const nAtRate = actualRate * nPct;
                const kAtRate = actualRate * kPct;
                const pAtRate = actualRate * pPct;

                // For slow-release, calculate effective monthly delivery
                const effectiveMonthlyK = kAtRate / monthsCovered;
                const effectiveMonthlyP = pAtRate / monthsCovered;
                const effectiveMonthlyNActual = nAtRate / monthsCovered;
                
                // SCORE 1: K Delivery Accuracy (0-100 points) - REVISED
                // Use EFFECTIVE MONTHLY K delivery for slow-release products
                // This allows high-delivery products that spread over multiple months
                let kScore = 50; // Default neutral
                if (kRequired > 0 && kPct > 0) {
                    const kDeliveryRatio = effectiveMonthlyK / kRequired;
                    if (kDeliveryRatio >= 0.7 && kDeliveryRatio <= 1.3) {
                        kScore = 100; // Perfect K delivery
                    } else if (kDeliveryRatio >= 0.5 && kDeliveryRatio <= 1.5) {
                        kScore = 70; // Good K delivery
                    } else if (kDeliveryRatio < 0.5) {
                        kScore = 40; // Under-delivering K - not ideal but acceptable
                    } else if (kDeliveryRatio <= 2.0) {
                        kScore = 30; // Moderate K overshoot
                    } else if (kDeliveryRatio <= 3.0) {
                        kScore = 10; // Heavy K overshoot
                    } else {
                        kScore = -20; // Severe K overshoot - penalize
                    }
                } else if (kRequired <= 0 && kPct > 0) {
                    // No K needed but product contains K - penalize based on effective monthly K
                    if (effectiveMonthlyK > 10) kScore = -30;      // Heavy K when none needed
                    else if (effectiveMonthlyK > 5) kScore = -15;  // Moderate K when none needed
                    else if (effectiveMonthlyK > 2) kScore = 0;    // Some K when none needed
                    else kScore = 30;                              // Minimal K
                } else if (kRequired > 0 && kPct === 0) {
                    // K needed but product has none - PENALIZE more heavily
                    // Can't deliver K at all, so need to rely on other products
                    kScore = -10; // Changed from +25 to -10
                } else {
                    // No K needed, product has no K - good
                    kScore = 80;
                }
                
                // SCORE 2: Release Type (0-60 points)
                // Bonus for slow-release on greens (consistent feeding)
                let releaseScore = 25;
                const release = product.release || 'standard';
                if (release === 'controlled' || release === 'slow') {
                    releaseScore = isGreens ? 60 : 50; // Extra bonus for greens
                } else if (release === 'stabilised') {
                    releaseScore = 40;
                }
                
                // SCORE 3: N Delivery Accuracy - THE MOST IMPORTANT SCORE
                // v3.17.0: Dramatically increased penalties for overshoot
                // A product delivering 3x what's needed is NOT acceptable even if it's slow-release
                let nScore = 0;
                const nDeliveryRatio = effectiveMonthlyNActual / nRequired;
                if (nDeliveryRatio >= 0.85 && nDeliveryRatio <= 1.15) {
                    nScore = 50; // Excellent N delivery (within 15%) - BEST CHOICE
                } else if (nDeliveryRatio >= 0.7 && nDeliveryRatio <= 1.3) {
                    nScore = 35; // Good N delivery (within 30%)
                } else if (nDeliveryRatio >= 0.5 && nDeliveryRatio <= 1.5) {
                    nScore = 20; // Acceptable N delivery
                } else if (nDeliveryRatio > 1.5 && nDeliveryRatio <= 2.0) {
                    nScore = -20; // Moderate overshoot - penalize
                } else if (nDeliveryRatio > 2.0 && nDeliveryRatio <= 2.5) {
                    nScore = -50; // Heavy overshoot - strong penalty
                } else if (nDeliveryRatio > 2.5 && nDeliveryRatio <= 3.0) {
                    nScore = -80; // Severe overshoot - very strong penalty
                } else if (nDeliveryRatio > 3.0) {
                    nScore = -120; // Extreme overshoot - should never be selected
                } else if (nDeliveryRatio < 0.5) {
                    nScore = -10; // Under-delivering - moderate penalty
                }
                
                // SCORE 4: P Delivery Accuracy (GH-327, GH-342)
                // GH-342: "not needed" branch now gates on pRequired <= 0
                // (mirrors kScore exactly) instead of the annual-level
                // soilPSufficient flag, since pRequired is netted against
                // carry-over now -- a month can have pRequired=0 (already
                // covered) while soilPSufficient is still false (real
                // annual deficit exists elsewhere in the year). The old
                // soilPSufficient gate missed that case, defaulting such a
                // candidate to the "no P needed, none contains P" branch
                // (pScore=80) even when pPct > 0.
                let pScore = 50; // Default neutral
                if (pRequired > 0 && pPct > 0) {
                    const pDeliveryRatio = effectiveMonthlyP / pRequired;
                    if (pDeliveryRatio >= 0.7 && pDeliveryRatio <= 1.3) {
                        pScore = 100; // Perfect P delivery
                    } else if (pDeliveryRatio >= 0.5 && pDeliveryRatio <= 1.5) {
                        pScore = 70; // Good P delivery
                    } else if (pDeliveryRatio < 0.5) {
                        pScore = 40; // Under-delivering P - not ideal but acceptable
                    } else if (pDeliveryRatio <= 2.0) {
                        pScore = 30; // Moderate P overshoot
                    } else if (pDeliveryRatio <= 3.0) {
                        pScore = 10; // Heavy P overshoot
                    } else {
                        pScore = -20; // Severe P overshoot - penalize
                    }
                } else if (pRequired <= 0 && pPct > 0) {
                    // No P needed (net of carry-over, this month) but product
                    // contains P - penalize based on effective monthly P.
                    // Same thresholds as kScore's equivalent branch.
                    if (effectiveMonthlyP > 10) pScore = -30;      // Heavy P when none needed
                    else if (effectiveMonthlyP > 5) pScore = -15;  // Moderate P when none needed
                    else if (effectiveMonthlyP > 2) pScore = 0;    // Some P when none needed
                    else pScore = 30;                              // Minimal P
                } else if (pRequired > 0 && pPct === 0) {
                    // P needed but product has none - penalize more heavily,
                    // need to rely on other products
                    pScore = -10;
                } else {
                    // No P needed, product has no P - good
                    pScore = 80;
                }
                
                // SCORE 5: Autumn K boost for winter hardening
                // In autumn, prefer products with K for winter hardiness
                // This is CRITICAL - K builds cell wall strength, improves cold tolerance
                // Reference: Christians et al. (2016) - K enhances winter hardiness
                //
                // GH-326: was unconditional on kRequired (only checked isAutumn
                // and kPct > 0) -- the sibling liquid-product scoring function
                // below already gates its own autumn K bonus on kRequired > 0;
                // this one didn't, so a soil already far above its K ceiling
                // (nutrition-calendar.js zeroes Required to 0 in that case)
                // could still get pushed a high-K granular product every
                // autumn, confirmed live: soil K at 356% of ceiling still
                // received a K-containing recommendation. Gating on
                // kRequired > 0 here too means the hardening bonus only
                // applies when the soil genuinely still needs K this year.
                let autumnKBonus = 0;
                if (isAutumn && kRequired > 0) {
                    if (kPct > 0) {
                        const kContent = product.analysis?.K || 0;
                        // In autumn, high-K products get strong bonus regardless of soil K status
                        if (kContent >= 15) autumnKBonus = 40;      // High K (15%+) - ideal for hardening
                        else if (kContent >= 10) autumnKBonus = 30; // Good K (10-15%)
                        else if (kContent >= 5) autumnKBonus = 20;  // Moderate K (5-10%)
                        else autumnKBonus = 10;                     // Some K better than none

                        // Extra bonus if K delivery ratio is good (not excessive)
                        const kDeliveryRatio = effectiveMonthlyK / kRequired;
                        if (kDeliveryRatio >= 0.8 && kDeliveryRatio <= 2.0) {
                            autumnKBonus += 15; // Sweet spot for K delivery
                        }
                    } else {
                        // No K in product during autumn - significant penalty
                        // Missing the hardening window is agronomically costly
                        autumnKBonus = -25;
                    }
                }
                
                // SCORE 6: Greens-specific penalties
                // v3.17.0: Reduced K penalties in autumn to allow hardening applications
                let greensPenalty = 0;
                if (isGreens) {
                    // Greens: penalty for K overshoot - BUT reduced in autumn
                    if (kRequired > 0) {
                        const kDeliveryRatio = kAtRate / kRequired;
                        if (isAutumn) {
                            // Autumn: be lenient with K for hardening
                            if (kDeliveryRatio > 4.0) greensPenalty -= 20;      // Only penalize severe overshoot
                            else if (kDeliveryRatio > 3.0) greensPenalty -= 10; // Moderate penalty
                            // No penalty for 1.5-3x in autumn - this is desirable for hardening
                        } else {
                            // Non-autumn: standard K penalties
                            if (kDeliveryRatio > 3.0) greensPenalty -= 40;      // Severe K overshoot
                            else if (kDeliveryRatio > 2.0) greensPenalty -= 25; // Heavy K overshoot
                            else if (kDeliveryRatio > 1.5) greensPenalty -= 10; // Moderate K overshoot
                        }
                    }
                    // Greens: heavy penalty for N overshoot (always - no autumn exemption for N)
                    const nDeliveryRatio = nAtRate / nRequired;
                    if (nDeliveryRatio > 2.0) greensPenalty -= 30;      // >2x N overshoot
                    else if (nDeliveryRatio > 1.5) greensPenalty -= 15; // 1.5-2x N overshoot
                }
                
                // SCORE 7: Mulder's antagonism modifier (b35fix266)
                // Penalise products that would exacerbate detected antagonisms.
                // K→Mg active: penalise high-K granulars (competitive suppression at root level)
                // P→Fe active: penalise high-P products (Fe precipitation in rhizosphere)
                // K→Ca active: additional K penalty (Ca translocation impaired)
                // Severity 'high' doubles the penalty.
                let muldersModifier = 0;
                const _mFlags = context.muldersFlags || {};
                const _kPct = product.analysis?.K || 0;
                const _pPct2 = product.analysis?.P || 0;
                const _severityMult = function(flags, sym) {
                    if (!flags[sym] || !flags[sym].length) return 0;
                    return flags[sym].some(function(f) { return f.severity === 'high'; }) ? 2 : 1;
                };
                // K→Mg: penalise products where K% > 12
                if (_mFlags['Mg'] && _mFlags['Mg'].some(function(f) { return f.suppressor === 'K'; })) {
                    if (_kPct > 20) muldersModifier -= 40 * _severityMult(_mFlags, 'Mg');
                    else if (_kPct > 12) muldersModifier -= 25 * _severityMult(_mFlags, 'Mg');
                    else if (_kPct > 6) muldersModifier -= 10 * _severityMult(_mFlags, 'Mg');
                }
                // P→Fe: penalise high-P products
                if (_mFlags['Fe'] && _mFlags['Fe'].some(function(f) { return f.suppressor === 'P'; })) {
                    if (_pPct2 > 5) muldersModifier -= 35 * _severityMult(_mFlags, 'Fe');
                    else if (_pPct2 > 2) muldersModifier -= 20 * _severityMult(_mFlags, 'Fe');
                }
                // K→Ca: additional K penalty (less severe than K→Mg)
                if (_mFlags['Ca'] && _mFlags['Ca'].some(function(f) { return f.suppressor === 'K'; })) {
                    if (_kPct > 15) muldersModifier -= 20 * _severityMult(_mFlags, 'Ca');
                    else if (_kPct > 8) muldersModifier -= 10 * _severityMult(_mFlags, 'Ca');
                }
                // P→Zn: penalise high-P where Zn is suppressed
                if (_mFlags['Zn'] && _mFlags['Zn'].some(function(f) { return f.suppressor === 'P'; })) {
                    if (_pPct2 > 3) muldersModifier -= 20 * _severityMult(_mFlags, 'Zn');
                }

                // GH-327: pScore weighted the same as kScore (0.35) -- P now
                // carries the same relative importance K already had, instead
                // of the old unweighted pPenalty (which only ever subtracted).
                const totalScore = kScore * 0.35 + releaseScore * 0.20 + nScore * 0.25 + pScore * 0.35 +
                                   autumnKBonus + greensPenalty + muldersModifier;
                
                if (totalScore > bestScore) {
                    bestScore = totalScore;
                    bestMatch = { product, labelRates, rateNeeded, nPct };
                }
            });
            
            if (!bestMatch) return null;
            
            const { product, labelRates, nPct } = bestMatch;

            // v3.18.2: Liquids have shorter duration - controlled/slow/stabilised=4wk, quick=2wk
            const isLiquid = product.form === 'liquid';
            let defaultWeeks;
            if (isLiquid) {
                defaultWeeks = (product.release === 'quick') ? 2 : 4;
            } else {
                defaultWeeks = product.release === 'controlled' ? 12
                    : (product.release === 'slow' || product.release === 'stabilised') ? 8
                    : 4;
            }
            const releaseWeeks = product.weeks || defaultWeeks;
            const monthsCovered = Math.max(1, Math.ceil(releaseWeeks / 4));

            // ================================================================
            // CALCULATE RATE WITHIN LABEL LIMITS
            // ================================================================
            // GH-337: nRequired (netN) is only ONE month's share of what a
            // multi-month-release batch needs to deliver in total -- the
            // batch releases evenly across monthsCovered months (see
            // activeNutrients tracking in generateAnnualProgram(), which
            // credits nDelivered/monthsCovered to each subsequent month).
            // Sizing the batch for nRequired alone (the old behaviour) meant
            // the same finite dose got credited as satisfying the full
            // requirement THIS month AND a further monthsCovered-1 months via
            // carryover -- e.g. a 35.3kg-N batch (sized for January's 35.3kg
            // requirement alone, 2-month release) also carried 17.65kg into
            // February, crediting 52.95kg of satisfied requirement from a
            // batch that only contains 35.3kg of actual N. Confirmed live:
            // Canberra golf_greens site, Required N=200, Delivered=159.3.
            // Scale the target by monthsCovered (1 for quick/standard release
            // -- no change there) so each month's actual share
            // (nDelivered / monthsCovered) matches nRequired, not the whole
            // batch.
            const nTarget = nRequired * monthsCovered;
            let rateKgHa = Math.round(nTarget / nPct);
            let notes = '';
            let actualNDelivered = nTarget;

            if (rateKgHa < labelRates.min) {
                // Below min - use min rate (will over-deliver)
                rateKgHa = labelRates.min;
                actualNDelivered = rateKgHa * nPct;
                notes = `Label min rate: ${rateKgHa} kg/ha (delivers ${actualNDelivered.toFixed(1)} kg N)`;
            } else if (rateKgHa > labelRates.max) {
                // Above max - cap at max (shortfall)
                rateKgHa = labelRates.max;
                actualNDelivered = rateKgHa * nPct;
                const shortfall = nTarget - actualNDelivered;
                notes = `Label max rate: ${rateKgHa} kg/ha (delivers ${actualNDelivered.toFixed(1)} of ${nTarget.toFixed(1)} kg N)`;
                if (shortfall > 2) {
                    notes += ` - ${shortfall.toFixed(1)} kg shortfall`;
                }
            }

            const kDelivered = rateKgHa * ((product.analysis?.K || 0) / 100);
            const pDelivered = rateKgHa * ((product.analysis?.P || 0) / 100);

            return {
                id: product.id,
                name: product.name,
                brand: BRANDS[product.brand]?.name || product.brand,
                npk: `${product.analysis.N || 0}-${product.analysis.P || 0}-${product.analysis.K || 0}`,
                analysis: product.analysis,
                release: product.release || 'standard',
                releaseWeeks: releaseWeeks,
                rateKgHa: rateKgHa,
                rateGM2: (rateKgHa / 10).toFixed(1),
                labelRates: labelRates,
                nDelivered: Math.round(actualNDelivered * 10) / 10,
                kDelivered: Math.round(kDelivered * 10) / 10,
                pDelivered: Math.round(pDelivered * 10) / 10,
                notes: notes,
            };
        },
        
        /**
         * Select best foliar/liquid nitrogen source
         * Differentiates between:
         *   - Quick-release liquids: Ideal at low GP, immediate foliar uptake
         *   - Slow-release/stabilised liquids: Better at moderate+ GP when root uptake works
         *   - Solubles: Spoonfeeding, precise rates, tank mixing - flexible across GP
         * 
         * @param {Array} liquidProducts - Array of liquid and soluble products
         * @param {Object} monthData - Month requirements including GP
         * @param {Object} context - Surface type, greens flag, etc.
         * @returns {Object|null} The chosen product with its rate and the
         *   nutrients that rate delivers over `applications` applications:
         *   { id, name, brand, npk, analysis, form, release, rateLHa, rateUnit,
         *     rateMLM2, applications, nDelivered, kDelivered, pDelivered, notes }
         *   — `pDelivered` added GH-400; see the comment beside its calculation.
         */
        selectFoliarNitrogen: function(liquidProducts, monthData, context) {
            const gp = monthData.gp || 0.5;
            const nRequired = monthData.N || 0;
            const kRequired = monthData.K || 0;
            // GH-328: monthData is built as `{ ...month, N: remainingN, K: netK, gp }`
            // at the call site, so month.P already comes through via the
            // spread -- unlike selectNitrogenSource() (granular), which had
            // to have P added explicitly (GH-327).
            const pRequired = monthData.P || 0;
            const isGreens = context.isGreens || false;
            
            if (nRequired <= 0) return null;
            
            // MINIMUM N CONTENT: 10% for primary N source, otherwise it's a secondary nutrient product
            // This prevents selecting Ca, Fe, Mg products as N sources
            const MIN_N_PCT = 10;
            
            // Separate products by type - require meaningful N content
            const quickLiquids = liquidProducts.filter(p => 
                p.form === 'liquid' && 
                (p.release === 'quick' || p.release === 'standard' || !p.release) &&
                (p.analysis?.N || 0) >= MIN_N_PCT
            );
            
            const slowLiquids = liquidProducts.filter(p => 
                p.form === 'liquid' && 
                (p.release === 'slow' || p.release === 'stabilised' || p.release === 'controlled') &&
                (p.analysis?.N || 0) >= MIN_N_PCT
            );
            
            const solubles = liquidProducts.filter(p => 
                p.form === 'soluble' && 
                (p.analysis?.N || 0) >= MIN_N_PCT
            );
            
            
            // ================================================================
            // GP-BASED PRODUCT SELECTION STRATEGY
            // ================================================================
            let candidates = [];
            
            if (gp < 0.3) {
                // ============================================================
                // LOW GP (< 30%): QUICK-RELEASE LIQUIDS OR SOLUBLES
                // Soil uptake limited - need immediate foliar delivery
                // Slow-release liquids won't work effectively
                // ============================================================
                
                // Priority 1: Quick-release liquids (immediate N)
                candidates = [...quickLiquids];
                
                // Priority 2: Solubles (can be applied foliar, immediate)
                candidates = [...candidates, ...solubles];
                
                // Slow-release liquids only as last resort at low GP
                // (they won't release properly but better than nothing)
                if (candidates.length === 0) {
                    candidates = [...slowLiquids];
                }
                
            } else if (gp < 0.5) {
                // ============================================================
                // MODERATE GP (30-50%): ALL TYPES VIABLE
                // Root uptake starting to work, foliar still useful
                // ============================================================
                
                // Slight preference for quick liquids, but all types work
                candidates = [...quickLiquids, ...solubles, ...slowLiquids];
                
            } else {
                // ============================================================
                // HIGH GP (≥ 50%): SLOW-RELEASE LIQUIDS PREFERRED
                // Full root uptake - can use stabilised/slow products
                // ============================================================
                
                // Priority 1: Slow-release liquids (extended feeding)
                candidates = [...slowLiquids];
                
                // Priority 2: Quick liquids and solubles still work
                candidates = [...candidates, ...quickLiquids, ...solubles];
            }
            
            // ================================================================
            // GREENS SPOONFEEDING: PREFER SOLUBLES
            // Greens benefit from precise, frequent applications
            // ================================================================
            if (isGreens && solubles.length > 0) {
                // Move solubles to front for greens (spoonfeeding program)
                candidates = [...solubles, ...candidates.filter(p => p.form !== 'soluble')];
            }
            
            if (candidates.length === 0) {
                console.warn(`[AuFertiliserRecommender] No suitable liquid/soluble N products found`);
                return null;
            }

            // GH-329: same hard exclusion as selectNitrogenSource() (granular)
            // -- when P/K isn't needed, drop candidates that would deliver a
            // non-trivial amount of it, provided a clean alternative remains.
            // See that function's GH-329 comment for the full rationale.
            const soilPSufficient = context.soilPSufficient !== false;
            const CLEAN_NUTRIENT_KGHA = 2;
            const effectiveDeliveryOf = (product, key) => {
                const pct = (product.analysis?.[key] || 0) / 100;
                const nPctLocal = (product.analysis?.N || 0) / 100;
                if (pct <= 0 || nPctLocal <= 0) return 0;
                const maxRateLocal = product.maxRateLHa || product.rates?.maxLHa || product.greensMaxRateKgHa || 30;
                const estimatedRateLocal = Math.min(nRequired / nPctLocal, maxRateLocal * 2);
                return estimatedRateLocal * pct;
            };
            if (soilPSufficient) {
                const cleanP = candidates.filter(p => effectiveDeliveryOf(p, 'P') <= CLEAN_NUTRIENT_KGHA);
                if (cleanP.length > 0) candidates = cleanP;
            }
            if (kRequired <= 0) {
                const cleanK = candidates.filter(p => effectiveDeliveryOf(p, 'K') <= CLEAN_NUTRIENT_KGHA);
                if (cleanK.length > 0) candidates = cleanK;
            }

            // ================================================================
            // SCORE CANDIDATES
            // ================================================================

            let bestProduct = null;
            let bestScore = -Infinity;
            
            candidates.forEach((product, idx) => {
                const nPct = product.analysis.N;
                const kPct = product.analysis.K || 0;
                const isQuick = product.release === 'quick' || product.release === 'standard' || !product.release;
                const isSoluble = product.form === 'soluble';
                const isSlow = product.release === 'slow' || product.release === 'stabilised' || product.release === 'controlled';
                
                // Estimate what rate we'd use and K delivered
                const maxRate = product.maxRateLHa || product.rates?.maxLHa || product.greensMaxRateKgHa || 30;
                const rateForN = nRequired / (nPct / 100);
                const estimatedRate = Math.min(rateForN, maxRate * 2); // Assume up to 2 applications
                const kAtRate = estimatedRate * (kPct / 100);
                
                // SCORE 1: K Delivery Accuracy (0-100 points) - REVISED
                // Score based on how well K delivery matches K requirement
                let kScore = 50; // Default neutral
                if (kRequired > 0 && kPct > 0) {
                    const kDeliveryRatio = kAtRate / kRequired;
                    if (kDeliveryRatio >= 0.7 && kDeliveryRatio <= 1.3) {
                        kScore = 100; // Perfect K delivery
                    } else if (kDeliveryRatio >= 0.5 && kDeliveryRatio <= 1.5) {
                        kScore = 70; // Good K delivery
                    } else if (kDeliveryRatio < 0.5) {
                        kScore = 40; // Under-delivering K
                    } else if (kDeliveryRatio <= 2.0) {
                        kScore = 25; // Moderate K overshoot
                    } else if (kDeliveryRatio <= 3.0) {
                        kScore = 0; // Heavy K overshoot
                    } else {
                        kScore = -25; // Severe K overshoot
                    }
                } else if (kRequired <= 0 && kPct > 0) {
                    // No K needed but product contains K - penalize
                    if (kAtRate > 10) kScore = -20;
                    else if (kAtRate > 5) kScore = 0;
                    else kScore = 30;
                } else if (kRequired > 0 && kPct === 0) {
                    // K needed but product has none
                    kScore = 25;
                } else {
                    // No K needed, product has no K
                    kScore = 80;
                }

                // SCORE 1.5: N Delivery Accuracy (GH-339)
                // selectFoliarNitrogen() exists to close a real N shortfall
                // (nRequired), but nothing here scored how well a candidate's
                // own N% and label-rate ceiling could actually fill it --
                // unlike selectNitrogenSource()'s granular path, which has
                // this exact check ("THE MOST IMPORTANT SCORE"). Without it,
                // a low-N%/off-purpose liquid (e.g. Hi Start Turf, N=10%,
                // P=13%) could out-score a purpose-built high-N liquid
                // (Greenmaster Liquid High N, N=25%) on pScore/kScore alone,
                // then only deliver a fraction of the month's N need even
                // after 4 applications (confirmed live: Feb remainingN=16.7kg,
                // Hi Start Turf capped at 8.0kg after 4x20L/ha).
                const nAtRate = estimatedRate * (nPct / 100);
                const nDeliveryRatio = nRequired > 0 ? nAtRate / nRequired : 1;
                let nScore = 0;
                if (nDeliveryRatio >= 0.85 && nDeliveryRatio <= 1.15) {
                    nScore = 50; // Excellent N delivery
                } else if (nDeliveryRatio >= 0.7 && nDeliveryRatio <= 1.3) {
                    nScore = 35; // Good N delivery
                } else if (nDeliveryRatio >= 0.5 && nDeliveryRatio <= 1.5) {
                    nScore = 20; // Acceptable N delivery
                } else if (nDeliveryRatio > 1.5) {
                    nScore = -20; // Overshoot
                } else if (nDeliveryRatio >= 0.3) {
                    nScore = -10; // Under-delivering
                } else {
                    nScore = -40; // Structurally can't fill this month's N gap
                }

                // SCORE 2: GP-appropriate release type (0-50 points)
                let releaseScore = 25;
                if (gp < 0.3) {
                    // Low GP: quick liquids and solubles score high
                    if (isQuick) releaseScore = 50;
                    else if (isSoluble) releaseScore = 45;
                    else if (isSlow) releaseScore = 10; // Penalty - won't work well
                } else if (gp >= 0.5) {
                    // High GP: slow-release preferred
                    if (isSlow) releaseScore = 50;
                    else if (isSoluble) releaseScore = 40;
                    else if (isQuick) releaseScore = 35;
                } else {
                    // Moderate GP: slight preference for quick
                    if (isQuick) releaseScore = 45;
                    else if (isSoluble) releaseScore = 40;
                    else if (isSlow) releaseScore = 40;
                }
                
                // SCORE 3: Greens spoonfeeding bonus (0-30 points)
                let greensScore = 0;
                if (isGreens) {
                    if (isSoluble) greensScore = 30; // Solubles ideal for spoonfeeding
                    else if (isQuick && nPct >= 15) greensScore = 15; // High-N quick liquids also good
                }
                
                // SCORE 4: Pure high-N bonus at low GP (0-30 points)
                let pureNScore = 0;
                if (gp < 0.3 && nPct >= 20 && kPct === 0) {
                    pureNScore = 30; // Pure high-N for winter foliar
                } else if (gp < 0.3 && nPct >= 15 && kPct === 0) {
                    pureNScore = 20;
                }
                
                // SCORE 5: Rate reasonableness (0-20 points)
                let rateScore = 10;
                // maxRate already defined above
                if (rateForN <= maxRate) {
                    rateScore = 20;
                } else if (rateForN <= maxRate * 1.5) {
                    rateScore = 10;
                } else {
                    rateScore = 0;
                }
                
                // SCORE 6: Position bonus (prefer earlier in sorted candidates)
                const positionScore = Math.max(0, 10 - idx);
                
                // SCORE 7: P Delivery Accuracy (GH-328, GH-342)
                // GH-342: "not needed" branch gates on pRequired <= 0 (mirrors
                // kScore) instead of the annual-level soilPSufficient flag --
                // see SCORE 4's GH-342 comment in selectNitrogenSource() for
                // why (pRequired is now netted against carry-over per month).
                const pPct = (product.analysis?.P || 0) / 100;
                const pAtRate = estimatedRate * pPct;
                let pScore = 50; // Default neutral
                if (pRequired > 0 && pPct > 0) {
                    const pDeliveryRatio = pAtRate / pRequired;
                    if (pDeliveryRatio >= 0.7 && pDeliveryRatio <= 1.3) {
                        pScore = 100; // Perfect P delivery
                    } else if (pDeliveryRatio >= 0.5 && pDeliveryRatio <= 1.5) {
                        pScore = 70; // Good P delivery
                    } else if (pDeliveryRatio < 0.5) {
                        pScore = 40; // Under-delivering P
                    } else if (pDeliveryRatio <= 2.0) {
                        pScore = 25; // Moderate P overshoot
                    } else if (pDeliveryRatio <= 3.0) {
                        pScore = 0; // Heavy P overshoot
                    } else {
                        pScore = -25; // Severe P overshoot
                    }
                } else if (pRequired <= 0 && pPct > 0) {
                    // No P needed (net of carry-over, this month) but product
                    // contains P - penalize
                    if (pAtRate > 10) pScore = -20;
                    else if (pAtRate > 5) pScore = 0;
                    else pScore = 30;
                } else if (pRequired > 0 && pPct === 0) {
                    // P needed but product has none
                    pScore = 25;
                } else {
                    // No P needed, product has no P
                    pScore = 80;
                }
                
                // SCORE 8: Autumn K boost (0-20 points)
                // In autumn, prefer liquids with K for winter hardiness
                // BUT only if K delivery is reasonable
                const season = context.season || '';
                const monthNum = context.monthNum || 0;
                const isAutumn = ['Autumn', 'autumn'].includes(season) || 
                                (context.hemisphere === 'south' && [3, 4, 5].includes(monthNum)) ||
                                (context.hemisphere !== 'south' && [9, 10, 11].includes(monthNum));
                let autumnKBonus = 0;
                if (isAutumn && kPct > 0 && kRequired > 0) {
                    const kDeliveryRatio = kAtRate / kRequired;
                    if (kDeliveryRatio <= 2.0) { // Only boost if not causing major overshoot
                        if (kPct >= 15) autumnKBonus = 20;       // High K (15%+)
                        else if (kPct >= 10) autumnKBonus = 15;  // Good K (10-15%)
                        else if (kPct >= 5) autumnKBonus = 8;    // Moderate K (5-10%)
                    }
                }
                
                // SCORE 9: Greens K overshoot penalty
                let greensKPenalty = 0;
                if (isGreens && kRequired > 0 && kPct > 0) {
                    const kDeliveryRatio = kAtRate / kRequired;
                    if (kDeliveryRatio > 3.0) greensKPenalty = -30;
                    else if (kDeliveryRatio > 2.0) greensKPenalty = -15;
                }
                
                // SCORE: Mulder's antagonism modifier (b35fix266)
                let _mModifier = 0;
                const _mf = context.muldersFlags || {};
                const _kP = product.analysis?.K || 0;
                const _pP = product.analysis?.P || 0;
                const _sev = function(flags, sym) {
                    if (!flags[sym] || !flags[sym].length) return 0;
                    return flags[sym].some(function(f) { return f.severity === 'high'; }) ? 2 : 1;
                };
                if (_mf['Mg'] && _mf['Mg'].some(function(f) { return f.suppressor === 'K'; })) {
                    if (_kP > 20) _mModifier -= 40 * _sev(_mf, 'Mg');
                    else if (_kP > 12) _mModifier -= 25 * _sev(_mf, 'Mg');
                    else if (_kP > 6) _mModifier -= 10 * _sev(_mf, 'Mg');
                }
                if (_mf['Fe'] && _mf['Fe'].some(function(f) { return f.suppressor === 'P'; })) {
                    if (_pP > 5) _mModifier -= 35 * _sev(_mf, 'Fe');
                    else if (_pP > 2) _mModifier -= 20 * _sev(_mf, 'Fe');
                }
                if (_mf['Ca'] && _mf['Ca'].some(function(f) { return f.suppressor === 'K'; })) {
                    if (_kP > 15) _mModifier -= 20 * _sev(_mf, 'Ca');
                    else if (_kP > 8) _mModifier -= 10 * _sev(_mf, 'Ca');
                }

                // TOTAL SCORE
                // GH-328: pScore weighted the same as kScore (×0.25), replacing
                // the old unweighted pPenalty (which only ever subtracted).
                // GH-339: nScore added at the same weight (×0.25) -- see
                // SCORE 1.5 above for why this was missing.
                const totalScore = (kScore * 0.25) +
                                   (releaseScore * 0.18) +
                                   (greensScore * 0.12) +
                                   (pureNScore * 0.12) +
                                   (rateScore * 0.10) +
                                   (positionScore * 0.03) +
                                   (pScore * 0.25) +
                                   (nScore * 0.25) +
                                   autumnKBonus +
                                   greensKPenalty +
                                   _mModifier;

                // GH-336-DEBUG: score breakdown per liquid candidate, so a
                // surprising winner (e.g. a low-N%/off-purpose product beating
                // a purpose-built high-N maintenance liquid) can be traced to
                // the exact score component responsible.
                console.log('[GH336-DEBUG] liquid candidate score', monthData.month_name, '|', product.name, '| total:', Math.round(totalScore * 10) / 10, '| kScore:', kScore, '| releaseScore:', releaseScore, '| greensScore:', greensScore, '| pureNScore:', pureNScore, '| rateScore:', rateScore, '| positionScore:', positionScore, '| pScore:', pScore, '| nScore:', nScore, '| nDeliveryRatio:', Math.round(nDeliveryRatio * 100) / 100, '| autumnKBonus:', autumnKBonus, '| greensKPenalty:', greensKPenalty, '| muldersModifier:', _mModifier, '| nPct:', nPct, '| kPct:', kPct);

                if (totalScore > bestScore) {
                    bestScore = totalScore;
                    bestProduct = product;
                }
            });
            
            if (!bestProduct) {
                return null;
            }

            // GH-336-DEBUG: which candidate actually won this month.
            console.log('[GH336-DEBUG] liquid candidate WINNER', monthData.month_name, '|', bestProduct.name, '| score:', Math.round(bestScore * 10) / 10);


            // ================================================================
            // CALCULATE RATE TO DELIVER REQUIRED N - RESPECT LABEL RATES
            // ================================================================
            const nPctFinal = bestProduct.analysis.N / 100;
            let rate = Math.round(nRequired / nPctFinal);
            
            // Get max rate for this product/surface - USE ACTUAL LABEL RATES
            let maxRate;
            if (bestProduct.form === 'soluble') {
                maxRate = isGreens ? (bestProduct.greensMaxRateKgHa || 25) : (bestProduct.maxRateKgHa || 50);
            } else {
                // Liquid - use product-specific label rates
                // Prefer maxLHa (label maximum) over surface-specific rates for N delivery
                if (bestProduct.rates) {
                    if (isGreens) {
                        maxRate = bestProduct.rates.greensLHa || bestProduct.rates.maxLHa || 30;
                    } else {
                        // For sports/fairways, use maxLHa (label max) to allow proper N delivery
                        maxRate = bestProduct.rates.maxLHa || bestProduct.rates.fairwaysLHa || 50;
                    }
                } else {
                    maxRate = bestProduct.maxRateLHa || 50;
                }
            }
            
            let notes = '';
            let actualNDelivered = nRequired;
            let applicationsNeeded = 1;
            
            if (rate > maxRate) {
                // Calculate how many applications at max rate would be needed
                applicationsNeeded = Math.ceil(rate / maxRate);
                
                if (applicationsNeeded <= 4) {
                    // Reasonable number of applications - use max rate per application
                    rate = maxRate;
                    actualNDelivered = rate * applicationsNeeded * nPctFinal;
                    notes = `${applicationsNeeded}x applications @ ${maxRate} ${bestProduct.form === 'soluble' ? 'kg' : 'L'}/ha = ${actualNDelivered.toFixed(1)} kg N`;
                } else {
                    // Too many applications needed - cap at 4 and note shortfall
                    applicationsNeeded = 4;
                    rate = maxRate;
                    actualNDelivered = rate * applicationsNeeded * nPctFinal;
                    const shortfall = nRequired - actualNDelivered;
                    notes = `4x applications @ ${maxRate} ${bestProduct.form === 'soluble' ? 'kg' : 'L'}/ha (max practical) = ${actualNDelivered.toFixed(1)} kg N, shortfall ${shortfall.toFixed(1)} kg`;
                }
            }
            
            const kDelivered = rate * applicationsNeeded * ((bestProduct.analysis.K || 0) / 100);
            // GH-400: liquids carry phosphorus too. The granular sibling
            // (selectNitrogenSource) has computed `pDelivered` from the same
            // rate × analysis.P formula since the file's first commit; this
            // return simply never had the field, and its call site therefore
            // pushed a hard-coded `delivers.P = 0` onto every liquid
            // application and never added anything to the annual `delivered.P`
            // accumulator. Nothing decided that liquid P was worth ignoring —
            // it was never computed. Two products on one live site alone
            // (Greenmaster Liquid Spring & Summer 1.7% P, Long Paddock Rapid
            // Uptake 2% P) put real phosphorus on the turf while declaring
            // none, so the annual requirement the P scorer is handed
            // (annualTargets.P − delivered.P, netP/annualPRemaining) was
            // overstated by exactly that amount and a product that genuinely
            // overshot scored as a perfect fit.
            //
            // `applicationsNeeded` is the multiplier for the same reason it is
            // for N and K above: `rate` is one application's volume.
            const pDelivered = rate * applicationsNeeded * ((bestProduct.analysis.P || 0) / 100);
            const rateUnit = bestProduct.form === 'soluble' ? 'kg/ha' : 'L/ha';


            return {
                id: bestProduct.id,
                name: bestProduct.name,
                brand: BRANDS[bestProduct.brand]?.name || LIQUID_BRANDS[bestProduct.brand]?.name || bestProduct.brand,
                npk: `${bestProduct.analysis.N || 0}-${bestProduct.analysis.P || 0}-${bestProduct.analysis.K || 0}`,
                analysis: bestProduct.analysis,
                form: bestProduct.form,
                release: bestProduct.release || 'quick',
                rateLHa: rate,
                rateUnit: rateUnit,
                rateMLM2: (rate / 10).toFixed(1),
                applications: applicationsNeeded,
                nDelivered: Math.round(actualNDelivered * 10) / 10,
                kDelivered: Math.round(kDelivered * 10) / 10,
                pDelivered: Math.round(pDelivered * 10) / 10, // GH-400
                notes: notes,
            };
        },

        /**
         * selectPotassiumSource — REMOVED b35fix330
         *
         * Single call site (per-month K supplementation in generateAnnualProgram)
         * was removed; see the rationale block at the former call site for the
         * full audit. Summary:
         *   - Sportsfield path was dead (granular returns silently dropped).
         *   - Greens path duplicated b35fix324 K-recon synthesis without its
         *     soil-K sanity floor, which created Item 1a-class over-application
         *     risk on samples with SLAN-midpoint-inflated K targets.
         *   - b35fix324's _synthesiseKReconDecision (word-export.js) is the
         *     architected K-shortfall path; selectGreensSpoonfeed (below) is
         *     the architected greens-spoonfeed path.
         *   - PrebbleRecommender has its own selectPotassiumSource — not
         *     affected by this removal.
         */
        
        /**
         * Select soluble product for greens spoonfeeding program
         * Solubles allow precise, frequent applications via spray tank
         * 
         * @param {Array} solubles - Soluble products array
         * @param {string} nutrient - Primary nutrient needed ('N', 'K', 'P', 'Fe', 'Mg')
         * @param {number} amount - Amount needed in kg/ha
         */
        selectGreensSpoonfeed: function(solubles, nutrient, amount) {
            if (!solubles || solubles.length === 0 || amount <= 0) return null;
            
            // Filter to products with the target nutrient
            const candidates = solubles.filter(p => (p.analysis?.[nutrient] || 0) > 0);
            if (candidates.length === 0) return null;
            
            // Sort by nutrient content (highest first)
            candidates.sort((a, b) => (b.analysis?.[nutrient] || 0) - (a.analysis?.[nutrient] || 0));
            
            const product = candidates[0];
            const nutrientPct = product.analysis[nutrient] / 100;
            const maxRate = product.greensMaxRateKgHa || product.maxRateKgHa || 25;
            
            // Calculate rate to deliver the amount (capped at max)
            let rateKgHa = Math.min(Math.round(amount / nutrientPct), maxRate);
            
            
            return {
                product: product,
                rateKgHa: rateKgHa,
                delivers: {
                    N: Math.round(rateKgHa * (product.analysis.N || 0) / 100 * 10) / 10,
                    P: Math.round(rateKgHa * (product.analysis.P || 0) / 100 * 10) / 10,
                    K: Math.round(rateKgHa * (product.analysis.K || 0) / 100 * 10) / 10,
                },
            };
        },

        /**
         * Select P source for supplementation (GH-331).
         *
         * selectNitrogenSource()/selectFoliarNitrogen() only ever deliver P
         * as an accidental byproduct of whichever product wins the
         * N-delivery competition -- a genuine P-correction product (e.g.
         * SOL-MAP, deliberately rate-capped low, 12-22-0) can never win that
         * competition on N-delivery grounds, so a real P deficit was never
         * corrected at all. Confirmed live on a golf_greens/MLSN site:
         * Required P=14 kg/ha every month, zero delivered all year, because
         * both selected N products (Sportsmaster WSF 20-0-0, Ammonium
         * Sulphate 21-0-0) carry no P.
         *
         * Mirrors prebbles-products.js's selectPhosphorusSource() (NZ) --
         * same tiered P% preference (dedicated P source >=20%, then
         * moderate 2-15%, then any with P), MAP preferred by name -- adapted
         * to this file's product shape (maxRateKgHa/greensMaxRateKgHa/
         * maxRateLHa fields directly on the product, not a `rates`
         * sub-object like getProductRatesForSurface() expects).
         */
        selectPhosphorusSource: function(granular, liquidAndSoluble, pRequired, isGreens) {
            if (!pRequired || pRequired <= 0) return null;

            const allProducts = [...granular, ...liquidAndSoluble];

            let pSources = allProducts.filter(p => (p.analysis?.P || 0) >= 20);
            if (pSources.length === 0) {
                pSources = allProducts.filter(p => {
                    const pPct = p.analysis?.P || 0;
                    return pPct >= 2 && pPct <= 15;
                });
            }
            if (pSources.length === 0) {
                pSources = allProducts.filter(p => (p.analysis?.P || 0) >= 1);
            }
            if (pSources.length === 0) return null;

            pSources.sort((a, b) => (b.analysis?.P || 0) - (a.analysis?.P || 0));
            const bestProduct = pSources.find(p => (p.id || '').toUpperCase().includes('MAP')) || pSources[0];

            const pPct = bestProduct.analysis.P / 100;
            const isLiquidForm = bestProduct.form === 'liquid';
            const maxRate = isGreens
                ? (bestProduct.greensMaxRateKgHa || bestProduct.maxRateLHa || bestProduct.maxRateKgHa || 15)
                : (bestProduct.maxRateKgHa || bestProduct.maxRateLHa || 350);

            let rateKgHa = Math.round(pRequired / pPct);
            let notes = bestProduct.notes || 'P supplementation';
            if (rateKgHa > maxRate) {
                rateKgHa = maxRate;
                notes = `Capped at ${maxRate} ${isLiquidForm ? 'L/ha' : 'kg/ha'} - partial P delivery`;
            }

            return {
                id: bestProduct.id,
                name: bestProduct.name,
                brand: bestProduct.brand,
                npk: `${bestProduct.analysis.N || 0}-${bestProduct.analysis.P || 0}-${bestProduct.analysis.K || 0}`,
                analysis: bestProduct.analysis,
                form: bestProduct.form || 'granular',
                rateKgHa: rateKgHa,
                rateGM2: (rateKgHa / 10).toFixed(1),
                pDelivered: Math.round(rateKgHa * pPct * 10) / 10,
                nDelivered: Math.round(rateKgHa * ((bestProduct.analysis.N || 0) / 100) * 10) / 10,
                kDelivered: Math.round(rateKgHa * ((bestProduct.analysis.K || 0) / 100) * 10) / 10,
                notes: notes,
            };
        },
        
        /**
         * Determine if slow-release granular is appropriate for current conditions
         * Returns efficiency factor (0-1) based on GP and soil temp
         */
        getSlowReleaseEfficiency: function(gp, soilTemp) {
            // Slow-release products need biological activity or warmth to release
            // At low GP / cold temps, they don't work effectively
            
            let efficiency = 1.0;
            
            // GP-based efficiency
            if (gp < 0.15) {
                efficiency *= 0.3; // Very low GP - slow release won't work
            } else if (gp < 0.3) {
                efficiency *= 0.6; // Low GP - reduced efficiency
            } else if (gp < 0.5) {
                efficiency *= 0.85; // Moderate GP - slight reduction
            }
            // High GP (≥ 0.5) - full efficiency
            
            // Soil temp adjustment (if provided)
            if (soilTemp !== undefined) {
                if (soilTemp < 8) {
                    efficiency *= 0.4; // Very cold - microbial activity minimal
                } else if (soilTemp < 12) {
                    efficiency *= 0.7; // Cold - reduced activity
                } else if (soilTemp < 15) {
                    efficiency *= 0.85; // Cool - slight reduction
                }
                // 15°C+ - full efficiency
            }
            
            return efficiency;
        },
        
        /**
         * Calculate liquid/soluble application to deliver target N
         * Returns application details including rate, N delivered, and any shortfall
         * 
         * @param {Object} product - Liquid/soluble product
         * @param {number} targetN - Target N to deliver (kg/ha)
         * @param {string} surfaceType - Surface type for rate limits
         * @returns {Object} { rateLHa, nDelivered, kDelivered, shortfall, notes }
         */
        calculateLiquidApplication: function(product, targetN, surfaceType) {
            const nPct = (product.analysis?.N || 0) / 100;
            if (nPct === 0 || targetN <= 0) {
                return { rateLHa: 0, nDelivered: 0, kDelivered: 0, shortfall: targetN, notes: 'No N in product' };
            }
            
            // Get max rate for this surface
            const isGreens = ['greens', 'golf_greens', 'bowling_greens'].includes(surfaceType);
            const isSports = surfaceType === 'sports' || surfaceType === 'sportsturf';
            
            let maxRate;
            if (product.rates) {
                if (isGreens && product.rates.greensLHa) {
                    maxRate = product.rates.greensLHa;
                } else if (product.rates.maxLHa) {
                    maxRate = product.rates.maxLHa;
                } else {
                    maxRate = 40; // Default max for liquids
                }
            } else if (product.maxRateLHa) {
                maxRate = product.maxRateLHa;
            } else if (product.greensMaxRateKgHa && isGreens) {
                // Solubles use kg/ha rates
                maxRate = product.greensMaxRateKgHa;
            } else if (product.maxRateKgHa) {
                maxRate = product.maxRateKgHa;
            } else {
                maxRate = product.form === 'soluble' ? 25 : 40; // Defaults
            }
            
            // Calculate rate needed to deliver target N
            const requiredRate = targetN / nPct;
            
            // Apply rate within label limits
            let actualRate;
            let shortfall = 0;
            let notes = '';
            
            if (requiredRate <= maxRate) {
                // Can deliver full requirement
                actualRate = Math.round(requiredRate);
                notes = '';
            } else {
                // Can't deliver full requirement - apply max and note shortfall
                actualRate = maxRate;
                const nAtMaxRate = actualRate * nPct;
                shortfall = targetN - nAtMaxRate;
                notes = `Max rate ${maxRate} ${product.form === 'soluble' ? 'kg' : 'L'}/ha - ${shortfall.toFixed(1)} kg N shortfall`;
            }
            
            const nDelivered = actualRate * nPct;
            const kDelivered = actualRate * ((product.analysis?.K || 0) / 100);
            
            return {
                rateLHa: actualRate,
                rateUnit: product.form === 'soluble' ? 'kg/ha' : 'L/ha',
                nDelivered: Math.round(nDelivered * 10) / 10,
                kDelivered: Math.round(kDelivered * 10) / 10,
                shortfall: Math.round(shortfall * 10) / 10,
                notes: notes,
            };
        },
        
        /**
         * Calculate granular application to deliver target N
         * Returns application details including rate, nutrients delivered
         * 
         * @param {Object} product - Granular product
         * @param {number} targetN - Target N to deliver (kg/ha)
         * @param {string} surfaceType - Surface type for rate limits
         * @returns {Object} { rateKgHa, nDelivered, pDelivered, kDelivered, weeks, notes }
         */
        calculateGranularApplication: function(product, targetN, surfaceType) {
            const nPct = (product.analysis?.N || 0) / 100;
            if (nPct === 0 || targetN <= 0) {
                return null;
            }
            
            const isGreens = ['greens', 'golf_greens', 'bowling_greens'].includes(surfaceType);
            
            // Get max rate - greens have lower limits
            let maxRate;
            if (product.rates) {
                if (isGreens && product.rates.greensMax) {
                    maxRate = product.rates.greensMax;
                } else if (product.rates.fairwaysMax) {
                    maxRate = product.rates.fairwaysMax;
                } else {
                    maxRate = isGreens ? 200 : 350;
                }
            } else {
                maxRate = isGreens ? 200 : 350;
            }
            
            // Minimum rate for even spreading
            const minRate = isGreens ? 100 : 150;
            
            // Calculate rate needed
            const requiredRate = targetN / nPct;
            
            let actualRate;
            let notes = '';
            
            if (requiredRate < minRate) {
                // Below minimum - N requirement too low for granular
                // Return null to signal liquid should be used instead
                return null;
            } else if (requiredRate <= maxRate) {
                actualRate = Math.round(requiredRate);
            } else {
                // Above max - cap at max
                actualRate = maxRate;
                const nAtMax = actualRate * nPct;
                notes = `Capped at ${maxRate} kg/ha - delivers ${nAtMax.toFixed(1)} of ${targetN.toFixed(1)} kg N required`;
            }
            
            const nDelivered = actualRate * nPct;
            const pDelivered = actualRate * ((product.analysis?.P || 0) / 100);
            const kDelivered = actualRate * ((product.analysis?.K || 0) / 100);
            // v3.18.2: Liquids have shorter duration - controlled/slow/stabilised=4wk, quick=2wk
            const isLiquid = product.form === 'liquid';
            let defaultWeeks;
            if (isLiquid) {
                defaultWeeks = (product.release === 'quick') ? 2 : 4;
            } else {
                defaultWeeks = product.release === 'controlled' ? 12 
                    : (product.release === 'slow' || product.release === 'stabilised') ? 8 
                    : 4;
            }
            const weeks = product.weeks || defaultWeeks;
            
            return {
                rateKgHa: actualRate,
                rateGM2: (actualRate / 10).toFixed(1),
                nDelivered: Math.round(nDelivered * 10) / 10,
                pDelivered: Math.round(pDelivered * 10) / 10,
                kDelivered: Math.round(kDelivered * 10) / 10,
                weeks: weeks,
                notes: notes,
            };
        },
        
        /**
         * Generate annual program from nutrition calendar data
         * GP-aware delivery strategies matching Prebble approach
         */
        generateAnnualProgram: function(monthlyData, options) {
            const surfaceType = options.surfaceType || 'sports';
            const stateFilter = options.stateFilter || 'all';
            const distributorFilter = options.distributorFilter || 'all';
            const methodology = options.methodology || 'mlsn';
            const hemisphere = options.hemisphere || 'south';
            const muldersFlags = options.muldersFlags || {}; // b35fix266: Mulder antagonism flags

            const { granular, liquid, soluble, all } = this.getProductsForSurface(surfaceType, stateFilter, distributorFilter);
            const isGreens = ['greens', 'golf_greens', 'bowling_greens'].includes(surfaceType);
            
            // Log filter results
            
            // Calculate annual targets
            const annualTargets = { N: 0, P: 0, K: 0 };
            monthlyData.forEach(m => {
                annualTargets.N += m.N || 0;
                annualTargets.P += m.P || 0;
                annualTargets.K += m.K || 0;
            });
            
            // GH-326: was `annualTargets.P < 15` -- an arbitrary, uncited cutoff
            // on the annual REQUIREMENT figure, not on real soil P status. A
            // genuine deficit whose Required just happened to land under 15
            // (e.g. 14 kg/ha, a confirmed live case) got misclassified as
            // "sufficient" and penalized instead of recommended. Required is
            // already 0 exactly when nutrition-calendar.js's own ceiling check
            // (GH-300/305/319) finds soil P at or above the methodology's
            // ceiling -- that's the real, already-computed "soil P is
            // sufficient, don't add more" signal; anything above 0 means
            // Removal-only or Removal+Lift is genuinely still needed.
            const soilPSufficient = annualTargets.P <= 0;


            const program = [];
            const delivered = { N: 0, P: 0, K: 0 };
            const activeNutrients = []; // Track slow-release carry-over

            // GH-331: same strategic-month P-application approach already
            // proven in prebbles-products.js (NZ) -- pick ONE agronomically
            // sensible month up front (first spring month with GP >= 0.4,
            // same threshold/season logic NZ already uses) and deliver the
            // full remaining annual P there in one application. AU's version
            // gates on annualTargets.P (a magnitude, already computed above)
            // rather than NZ's separately-computed boolean context.pDeficient.
            const springMonths = hemisphere === 'south' ? [8, 9, 10] : [2, 3, 4];
            let pApplicationMonth = null;
            if (annualTargets.P > 5) {
                pApplicationMonth = springMonths.find(idx => monthlyData[idx] && monthlyData[idx].gp >= 0.4) ?? springMonths[0];
            }

            monthlyData.forEach((month, idx) => {
                const gp = month.gp || 0;
                
                // Calculate active nutrients from previous slow-release
                // GH-342: activeP/netP added alongside the existing N/K
                // carry-over -- see the P SUPPLEMENTATION comment further
                // down and selectNitrogenSource()'s pScore for why P used to
                // have no equivalent (GH-327's comment: "there's nothing to
                // net it against").
                let activeN = 0, activeK = 0, activeP = 0;
                activeNutrients.forEach(a => {
                    if (a.endsIdx > idx) {
                        activeN += a.monthlyN || 0;
                        activeK += a.monthlyK || 0;
                        activeP += a.monthlyP || 0;
                    }
                });

                const netN = Math.max(0, (month.N || 0) - activeN);
                // GH-343: netK also caps at whatever's left of the ANNUAL K
                // budget (annualTargets.K - delivered.K so far), same fix as
                // GH-342 for P -- confirmed live on Canberra: three separate
                // granular N-carrier picks (Jan/Mar/Oct), each K-rich
                // (Country Club IV 18-9-18 twice, Sierraform GT All Seasons
                // once), non-overlapping release windows, so activeK alone
                // never saw the earlier deliveries and K landed at 131.2kg
                // against a 110kg annual target.
                const netK = Math.min(
                    Math.max(0, (month.K || 0) - activeK),
                    Math.max(0, annualTargets.K - delivered.K)
                );
                // GH-342: netP also caps at whatever's left of the ANNUAL P
                // budget (annualTargets.P - delivered.P so far), not just
                // release-window carry-over (activeP) -- confirmed live on
                // Canberra: three separate granular N-carrier picks
                // (Jan/Mar/Oct) each scored P against their own raw monthly
                // slice with non-overlapping release windows, so activeP
                // never saw the earlier deliveries and P landed at 33.7kg
                // against a 19.9kg annual target.
                const netP = Math.min(
                    Math.max(0, (month.P || 0) - activeP),
                    Math.max(0, annualTargets.P - delivered.P)
                );

                // GH-336-DEBUG: per-month N accounting -- added to trace a
                // live report of annual N under-delivery (Required=200,
                // Delivered=159.3) where the rendered Monthly Program table's
                // per-month rates, hand-reconciled, didn't obviously explain
                // the gap. Kept until confirmed fixed per project convention.
                console.log('[GH336-DEBUG] month start', month.month_name, '| month.N (required):', month.N, '| activeN (carried):', activeN, '| netN (target for new applications):', netN, '| gp:', gp, '| delivered.N so far:', delivered.N);

                const monthResult = {
                    month_name: month.month_name,
                    season: month.season,
                    gp: gp,
                    requirements: { N: month.N || 0, P: month.P || 0, K: month.K || 0 },
                    netRequirements: { N: netN, P: netP, K: netK },
                    activeFromPrevious: { N: Math.round(activeN * 10) / 10, P: Math.round(activeP * 10) / 10, K: Math.round(activeK * 10) / 10 },
                    granular: [],
                    liquid: [],
                    notes: [],
                };
                
                
                // ================================================================
                // STRATEGY: Granular first (main N delivery), liquid as supplement
                // v3.17.3: Skip granular if slow-release is already providing good coverage
                // ================================================================
                
                // Skip if minimal requirements
                if (netN < 2 && netK < 2) {
                    if (activeN > 0) {
                        monthResult.notes.push('Covered by previous slow-release application');
                    } else {
                        monthResult.notes.push('Minimal requirements - no application needed');
                    }
                    program.push(monthResult);
                    return;
                }
                
                // ================================================================
                // GRANULAR APPLICATION (main N delivery)
                // ================================================================
                // v3.17.0: Complete rewrite of granular/liquid decision
                // v3.17.3: Skip granular when slow-release is providing significant coverage
                // 
                // Agronomic rationale:
                // - At low GP (<30%), root activity is minimal - foliar uptake more efficient
                // - Granular at low GP leads to N sitting in soil, leaching risk, wasted product
                // - Greens: use granular only at GP >= 30% (spoonfeeding culture)
                // - Sports: use granular at GP >= 30%, liquids below that
                // - Below GP 15%: liquids only for both (minimal growth, preserve turf)
                // - If slow-release is already providing >50% of monthly need, use liquid top-up instead
                
                const useGranular = (gp >= 0.30);  // Simple: 30%+ GP = granular viable
                
                // v3.17.3: Check if slow-release is already providing substantial coverage
                // If activeN is providing >50% of target, skip granular and use liquid top-up
                const slowReleaseCoverage = activeN / (month.N || 1);
                const skipGranularDueToSlowRelease = slowReleaseCoverage > 0.5;
                
                if (skipGranularDueToSlowRelease) {
                    monthResult.notes.push(`Slow-release covering ${(slowReleaseCoverage * 100).toFixed(0)}% - liquid top-up only`);
                }
                
                
                // Use granular if net N >= 3 (lowered from 5 to catch more months)
                // v3.17.3: Also skip if slow-release is providing substantial coverage
                if (useGranular && !skipGranularDueToSlowRelease && netN >= 3 && granular.length > 0) {
                    // selectNitrogenSource now returns product WITH calculated rate
                    // Pass additional context for P-conscious and autumn K scoring
                    // GH-342: P now nets against activeP the same way N/K do
                    // (was: GH-327 passed the raw monthly P requirement since
                    // there was nothing to net it against -- confirmed live
                    // on Canberra, a repeated P-rich granular pick (Country
                    // Club IV 18-9-18, P=9%) delivered P=33.7kg against a
                    // 19.9kg annual removal-only requirement, +69%, because
                    // each month scored P as if no prior month had ever
                    // delivered any).
                    const granularRec = this.selectNitrogenSource(granular, { N: netN, K: netK, P: netP }, {
                        isGreens, 
                        surfaceType,
                        season: month.season,
                        monthNum: month.month_num || idx + 1,
                        hemisphere: hemisphere,
                        soilPSufficient: soilPSufficient,
                        muldersFlags: muldersFlags,
                    });
                    
                    
                    // v3.17.0: OVERSHOOT CHECK FOR ALL SURFACES
                    // Reject granular if it would deliver excessive N or K
                    // BUT: Be more lenient with K in autumn (hardening applications)
                    let useThisGranular = !!granularRec;
                    
                    // Determine if this is autumn (for K hardening allowance)
                    const monthNum = month.month_num || idx + 1;
                    const isAutumnMonth = (hemisphere === 'south' && [3, 4, 5].includes(monthNum)) ||
                                          (hemisphere !== 'south' && [9, 10, 11].includes(monthNum));
                    
                    if (granularRec) {
                        const monthsCovered = Math.max(1, Math.ceil(granularRec.releaseWeeks / 4));
                        const effectiveMonthlyN = granularRec.nDelivered / monthsCovered;
                        const effectiveMonthlyK = granularRec.kDelivered / monthsCovered;
                        
                        // N OVERSHOOT CHECK - applies to ALL surfaces, ALL seasons
                        // N overshoot is never desirable (disease risk, leaching, burn)
                        const nOvershoot = effectiveMonthlyN / netN;
                        if (nOvershoot > 2.5) {
                            useThisGranular = false;
                            monthResult.notes.push(`Granular skipped - would over-deliver N by ${Math.round((nOvershoot - 1) * 100)}%`);
                        }
                        
                        // K OVERSHOOT CHECK - stricter for greens, MORE LENIENT in autumn
                        // Autumn K applications for hardening are agronomically beneficial
                        if (useThisGranular && netK > 0) {
                            const kOvershoot = effectiveMonthlyK / netK;
                            // In autumn: allow up to 5x K for hardening (greens) or 6x (sports)
                            // Other seasons: standard 3x (greens) or 4x (sports)
                            const kThreshold = isAutumnMonth 
                                ? (isGreens ? 5.0 : 6.0)   // Autumn: generous for hardening
                                : (isGreens ? 3.0 : 4.0);  // Other: standard limits
                            
                            if (kOvershoot > kThreshold) {
                                useThisGranular = false;
                                monthResult.notes.push(`Granular skipped - would over-deliver K by ${Math.round((kOvershoot - 1) * 100)}%`);
                            }
                        }
                    }
                    
                    // GH-336-DEBUG: log whether granular was accepted or
                    // rejected (and why), and what it would have delivered
                    // either way, so a rejected month's lost N is visible.
                    console.log('[GH336-DEBUG] granular decision', month.month_name, '| picked:', granularRec ? granularRec.name : null, '| would deliver N:', granularRec ? granularRec.nDelivered : null, '| kDelivered:', granularRec ? granularRec.kDelivered : null, '| useThisGranular:', useThisGranular);

                    if (useThisGranular && granularRec) {
                        delivered.N += granularRec.nDelivered;
                        delivered.P += granularRec.pDelivered;
                        delivered.K += granularRec.kDelivered;
                        
                        // Track slow-release for future months
                        if (granularRec.releaseWeeks > 4) {
                            const monthsCovered = Math.ceil(granularRec.releaseWeeks / 4);
                            activeNutrients.push({
                                endsIdx: idx + monthsCovered,
                                monthlyN: granularRec.nDelivered / monthsCovered,
                                monthlyK: granularRec.kDelivered / monthsCovered,
                                monthlyP: granularRec.pDelivered / monthsCovered,
                            });
                        }
                        
                        monthResult.granular.push({
                            id: granularRec.id,
                            name: granularRec.name,
                            brand: granularRec.brand,
                            npk: granularRec.npk,
                            // b35fix322 Bug 1 structural: publish full analysis
                            // (S/Ca/Mg/Fe/Mn/Zn/Cu/B etc.) so amendment self-suppression
                            // and combined-export totalDelivered see real deliveries.
                            // delivers{} only tracks N/P/K (engine-computed for release
                            // timing); analysis is the canonical full breakdown.
                            analysis: granularRec.analysis || {},
                            rateKgHa: granularRec.rateKgHa,
                            rateGM2: granularRec.rateGM2,
                            release: granularRec.release,
                            weeks: granularRec.releaseWeeks,
                            delivers: {
                                N: granularRec.nDelivered,
                                P: granularRec.pDelivered,
                                K: granularRec.kDelivered,
                            },
                            notes: granularRec.notes,
                        });
                        
                    }
                }
                
                // ================================================================
                // LIQUID APPLICATION
                // ================================================================
                // Use liquid when:
                // - Low GP (< 30%) - foliar bypasses soil
                // - Greens at any GP - spoonfeeding program
                // - Granular couldn't deliver full requirement
                
                const granularNDelivered = monthResult.granular.reduce((sum, g) => sum + (g.delivers?.N || 0), 0);
                const remainingN = netN - granularNDelivered;
                // GH-342: same netting as remainingN, so selectFoliarNitrogen()
                // sees what's actually still owed after carry-over AND this
                // month's own granular pick, not the raw monthly P figure.
                const granularPDelivered = monthResult.granular.reduce((sum, g) => sum + (g.delivers?.P || 0), 0);
                const remainingP = Math.max(0, netP - granularPDelivered);

                const useLiquid = (gp < 0.3) || isGreens || (remainingN > 3);

                // b35fix281: lower threshold for greens — small monthly remainders accumulate to annual shortfall
                const liquidThreshold = isGreens ? 0.5 : 2;
                // GH-336-DEBUG: is liquid even attempted this month, and with
                // how much N still owed after granular?
                console.log('[GH336-DEBUG] liquid gate', month.month_name, '| granularNDelivered:', granularNDelivered, '| remainingN:', remainingN, '| useLiquid:', useLiquid, '| liquidThreshold:', liquidThreshold, '| will attempt liquid:', useLiquid && remainingN > liquidThreshold && all.length > 0);
                if (useLiquid && remainingN > liquidThreshold && all.length > 0) {
                    // selectFoliarNitrogen now returns product WITH calculated rate
                    const liquidRec = this.selectFoliarNitrogen(all, { ...month, N: remainingN, K: netK, P: remainingP, gp }, {
                        gp, 
                        isGreens, 
                        surfaceType,
                        season: month.season,
                        monthNum: month.month_num || idx + 1,
                        hemisphere: hemisphere,
                        soilPSufficient: soilPSufficient,
                        muldersFlags: muldersFlags,
                    });

                    // GH-336-DEBUG: what liquid picked and would deliver,
                    // vs. remainingN it was asked to cover.
                    console.log('[GH336-DEBUG] liquid decision', month.month_name, '| picked:', liquidRec ? liquidRec.name : null, '| asked to cover (remainingN):', remainingN, '| would deliver N:', liquidRec ? liquidRec.nDelivered : null, '| applications:', liquidRec ? liquidRec.applications : null, '| notes:', liquidRec ? liquidRec.notes : null);

                    if (liquidRec && liquidRec.nDelivered > 0) {
                        delivered.N += liquidRec.nDelivered;
                        delivered.K += liquidRec.kDelivered;
                        // GH-400: and its phosphorus. Declaring it on the
                        // application below is not enough on its own — this is
                        // the accumulator every downstream P decision reads:
                        // `netP` (GH-342's annual cap, `annualTargets.P −
                        // delivered.P`), the strategic-P top-up's
                        // `annualPRemaining`, and through them the P-delivery
                        // scorers in selectNitrogenSource/selectFoliarNitrogen.
                        // Without this line the requirement stays overstated by
                        // whatever the liquids already applied, so later months
                        // buy phosphorus the turf has already had.
                        delivered.P += liquidRec.pDelivered || 0;


                        // Format rate display with applications count if > 1
                        const apps = liquidRec.applications || 1;
                        const rateDisplay = apps > 1 
                            ? `${apps}x ${liquidRec.rateLHa} ${liquidRec.rateUnit}`
                            : `${liquidRec.rateLHa} ${liquidRec.rateUnit}`;
                        
                        monthResult.liquid.push({
                            id: liquidRec.id,
                            name: liquidRec.name,
                            brand: liquidRec.brand,
                            npk: liquidRec.npk,
                            form: liquidRec.form,
                            // b35fix322 Bug 1 structural: see granular.push above.
                            analysis: liquidRec.analysis || {},
                            rate: rateDisplay,
                            rateLHa: liquidRec.rateLHa,
                            rateMLM2: liquidRec.rateMLM2,
                            applications: apps,
                            delivers: {
                                N: liquidRec.nDelivered,
                                // GH-400: was a hard-coded 0 while the same
                                // object's `analysis.P` carried up to 2% — the
                                // Plan's Delivered column and the exported
                                // Annual Product Summary both read this vector.
                                P: liquidRec.pDelivered || 0,
                                K: liquidRec.kDelivered,
                            },
                            notes: liquidRec.notes || (gp < 0.3 ? 'Foliar application - soil uptake limited' : ''),
                        });
                        
                        
                        // Note if there's still a shortfall after max practical applications
                        const totalNDelivered = granularNDelivered + liquidRec.nDelivered;
                        if (netN - totalNDelivered > 3) {
                            monthResult.notes.push(`N shortfall: ${(netN - totalNDelivered).toFixed(1)} kg/ha - product range limitation`);
                        }
                    }
                }

                // ================================================================
                // P SUPPLEMENTATION (GH-331 -- strategic month, repeats if capped)
                // ================================================================
                // See selectPhosphorusSource()'s doc comment for the P-vs-N
                // competition rationale, and this function's GH-331 comment
                // above the month loop for the strategic-month timing.
                //
                // GH-331 follow-up 3: a single application at pApplicationMonth
                // isn't always enough to close the annual gap -- confirmed
                // live on golf_greens: SOL-MAP capped at its 15 kg/ha greens
                // rate limit (agronomically correct, prevents burn) delivers
                // at most 3.3 kg P per visit, far short of a 14 kg/ha annual
                // deficit. A single "dump the whole year's P in one visit"
                // application physically can't work when the safe per-visit
                // rate is this restrictive. Instead of a one-shot check at
                // exactly pApplicationMonth, keep applying (capped each time
                // by selectPhosphorusSource()'s own rate limit) in every
                // month from pApplicationMonth onward until the annual
                // target is met or the season runs out -- same spirit as a
                // real spoon-feeding programme.
                if (pApplicationMonth !== null && idx >= pApplicationMonth) {
                    const annualPRemaining = Math.max(0, annualTargets.P - delivered.P);
                    if (annualPRemaining > 2) {
                        const pProduct = this.selectPhosphorusSource(granular, all, annualPRemaining, isGreens);
                        if (pProduct) {
                            // GH-391: count the P source's N and K too, not
                            // just its P. selectPhosphorusSource() returns all
                            // three and the application pushed below declares
                            // all three in `delivers`, but only P reached the
                            // annual accumulator -- so every consumer that
                            // builds its rows from the monthly applications
                            // (the Plan page's Annual Product Summary, the
                            // Word export's) printed a product row the
                            // "Total Delivered" row did not contain. Live on
                            // Burns "12th Fairway": rows 113 + 7 + 5 = 125 kg
                            // N/ha against a printed total of 120, the 5 being
                            // MAP Tech (12-27-0), picked here for its P.
                            //
                            // Not a display fix: `delivered.N` is also what
                            // balance.N is measured against, so the missing N
                            // was hiding a genuine over-delivery rather than
                            // merely mis-printing one. MAP carries no K, so
                            // the K line is a no-op on this catalogue's usual
                            // pick; it is here because netK's annual budget
                            // cap (GH-343) reads `delivered.K`, and a K-
                            // bearing P source would otherwise be spent twice.
                            delivered.N += pProduct.nDelivered;
                            delivered.P += pProduct.pDelivered;
                            delivered.K += pProduct.kDelivered;
                            const pushTarget = (pProduct.form === 'granular') ? monthResult.granular : monthResult.liquid;
                            pushTarget.push({
                                id: pProduct.id,
                                name: pProduct.name,
                                brand: pProduct.brand,
                                npk: pProduct.npk,
                                analysis: pProduct.analysis || {},
                                rateKgHa: pProduct.rateKgHa,
                                rateGM2: pProduct.rateGM2,
                                form: pProduct.form,
                                delivers: { N: pProduct.nDelivered, P: pProduct.pDelivered, K: pProduct.kDelivered },
                                notes: `Strategic P application: ${pProduct.notes}`,
                            });
                            monthResult.notes.push(`Strategic P application: ${pProduct.pDelivered.toFixed(1)} kg/ha (annual requirement)`);
                        } else {
                            monthResult.notes.push(`P deficit: ${annualPRemaining.toFixed(1)} kg/ha - no suitable P source found`);
                        }
                    }
                }

                // ================================================================
                // K SUPPLEMENTATION — REMOVED b35fix330
                // ================================================================
                // Pre-b35fix330 this block computed a per-month kShortfall and,
                // when > 5 kg K/ha and !greens-only, called selectPotassiumSource
                // to push a soluble/liquid K supplement onto the month.
                //
                // Removed because the path is functionally redundant with the
                // b35fix324 K-reconciliation synthesis (word-export.js
                // _synthesiseKReconDecision) and agronomically less safe:
                //
                //   1. Sportsfield surfaces — dead code. selectPotassiumSource
                //      returns granular for non-greens; the consumer was gated
                //      to soluble/liquid only and silently dropped granular
                //      returns. Sites needing 165 kg K/ha annually never got
                //      spot-K from this path (the original Item 1b symptom).
                //
                //   2. Greens surfaces — duplicates b35fix324's intent without
                //      its Gate 2 (soil-K sanity floor). On Item 1a-class sites
                //      where SLAN-midpoint inflation pushes month.K above
                //      catalogue delivery while soil K is in range, this path
                //      applied K to soils that did not need K. b35fix324
                //      explicitly defends against that with soilK < floor.
                //
                //   3. No coordination with K-recon. The two paths shared no
                //      state. Catalogue-form K from this path was counted by
                //      _computeProgrammeKDelivered, which could mask a genuine
                //      programme deficit and prevent the (more carefully
                //      gated) split-SOP from firing.
                //
                // Greens spoonfeeding remains available via selectGreensSpoonfeed
                // (line 5011 below in this file, post-deletion line numbering)
                // — that is the architected greens-K path.
                //
                // Production-verified at Kew 2026-04-25: 5/5 affected greens
                // received the b35fix324 split-SOP via _synthesiseKReconDecision.
                // No regression expected from removing this path; if anything,
                // Item 1a-class over-application risk is reduced.
                //
                // selectPotassiumSource function definition was the only caller
                // and is also removed (was lines ~4976–5011). PrebbleRecommender
                // has its own selectPotassiumSource — unrelated, untouched.
                // ================================================================

                // Add GP note
                if (gp < 0.15) {
                    monthResult.notes.push(`Very low GP (${(gp * 100).toFixed(0)}%) - minimal application recommended`);
                } else if (gp < 0.3) {
                    monthResult.notes.push(`Low GP (${(gp * 100).toFixed(0)}%) - foliar preferred`);
                }

                // GH-336-DEBUG: month-end running total, so it's clear
                // exactly how much N this month contributed and where the
                // annual total (delivered.N) stands after it.
                console.log('[GH336-DEBUG] month end', month.month_name, '| running delivered.N total:', delivered.N, '| running delivered.K total:', delivered.K);

                program.push(monthResult);
            });
            
            
            return {
                meta: {
                    surfaceType: surfaceType,
                    stateFilter: stateFilter,
                    distributorFilter: distributorFilter,
                    methodology: methodology,
                    generated: new Date().toISOString(),
                },
                monthly: program,
                targets: annualTargets,
                delivered: delivered,
                balance: {
                    N: Math.round((delivered.N - annualTargets.N) * 10) / 10,
                    P: Math.round((delivered.P - annualTargets.P) * 10) / 10,
                    K: Math.round((delivered.K - annualTargets.K) * 10) / 10,
                },
            };
        },
    };

    // ========================================================================
    // EXPORT
    // ========================================================================

    window.AuFertiliserProducts = AuFertiliserProducts;
    window.AuFertiliserRecommender = AuFertiliserRecommender;
    
    window.GAIP_AU_FERTILISER = {
        products: AuFertiliserProducts,
        recommender: AuFertiliserRecommender,
        config: CONFIG,
        version: AuFertiliserProducts.version,
    };

})();
