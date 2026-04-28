/**
 * GAIP Disease Integration v2.5.0
 * 
 * v2.5.0: SPECIES CONTROLLER INTEGRATION
 *   - Now uses SpeciesController.normalize() for all species normalisation
 *   - Single Source of Truth eliminates species mismatch bugs
 *   - Local normalizeSpecies() delegates to SpeciesController
 * 
 * v2.4.18: Clear forecast data on species change
 *   - Also clears GAIP_DISEASE_FORECAST and _diseaseForecastData on species switch
 *   - Prevents stale forecast data from showing wrong disease trajectory in dashboard
 *   - Fixes "two clicks needed" issue when switching species
 * 
 * v2.4.16: Add gaip:disease-updated event dispatch for dashboard sync
 * v2.4.15: Fix disease card showing base species diseases when overseed is dominant
 *   - In gaip:analysis-complete handler, now checks state.turf.effectiveSpecies FIRST
 *   - When overseed is dominant (>50% C3), effectiveSpecies is PRG, not base couch
 *   - validateResult() was comparing orchestrator PRG result against DOM couch species
 *   - This caused correct PRG disease results to be rejected as "stale"
 *   - Now: effectiveSpecies → GAIP_OVERSEED_STATE → DOM dropdown → TurfProfileController
 *   - Fixes: 53% ryegrass overseed showing couch diseases instead of PRG diseases
 * 
 * v2.4.14: Check turf.effectiveSpecies FIRST before other sources
 *   - hub-tissue-v3.js sets turf.effectiveSpecies when overseed is dominant (>50% C3)
 *   - This is set during state building, before async overseed state updates
 *   - Now checks turf.effectiveSpecies as PRIORITY 1 for C4 base scenarios
 *   - Falls back to GAIP_OVERSEED_STATE and DOM dropdown as PRIORITY 2
 *   - Fixes 55% ryegrass on couch base showing couch diseases on first run
 * 
 * v2.4.13: Fix overseed detection for C4 base + overseed scenarios
 *   - When base is C4 (Couch), turf.coolOverseed is cleared by hub-tissue-v3.js
 *   - Now checks GAIP_OVERSEED_STATE.overseedSpecies (set by overseed-climate-integration)
 *   - Also checks DOM dropdown .gaip-cool-overseed directly as fallback
 *   - Respects GAIP_OVERSEED_STATE.c3Fraction and summerIntent
 * 
 * v2.4.10: Fix species detection - DOM dropdown FIRST
 *   - DOM dropdown is only reliable source during species switch
 *   - TurfProfileController.getState() can return stale species
 *   - Added debug logging to trace species detection
 * 
 * v2.4.9: Fix stale species detection on species change
 *   - findDiseaseResult() now checks if result.species matches current turf species
 *   - Skips stale results from previous species selection
 *   - Fixes PRG diseases showing when Couch selected (required 2 clicks before)
 * 
 * v2.4.7: Clear stale GAIP_DISEASE_RESULT on species change
 *   - When turf profile changes species, immediately clear GAIP_DISEASE_RESULT
 *   - Prevents first "Run Analysis" from rendering stale disease list
 *   - Fixes PRG->Couch switch requiring two clicks to update diseases
 * 
 * v2.4.6: Fix result discovery - check GaipOrchestrator.getComputed().disease
 *   - Added getComputed() as PRIMARY location (where orchestrator actually stores it)
 *   - Now finds 10 diseases from orchestrator computation
 * 
 * v2.4.5: Fix result discovery - check multiple storage locations
 *   - findDiseaseResult() checks: GAIP_DISEASE_RESULT, GaipOrchestrator.results,
 *     GaipOrchestrator.getState(), GAIP_CANONICAL_STATE, GAIP_CASCADE_RESULTS, GAIP_STATE
 *   - Extended polling timeout to 1000ms (was 500ms)
 *   - Also listens for 'gaip:orchestrator-complete' event
 *   - Sets GAIP_DISEASE_RESULT for legacy consumers when found elsewhere
 * 
 * v2.4.4: Fix timing - poll for GAIP_DISEASE_RESULT after orchestrator completes
 *   - gaip:analysis-complete fires BEFORE orchestrator's computeAll
 *   - Now polls for up to 500ms waiting for orchestrator to set result
 *   - Ensures bipolaris/curvularia diseases are always displayed
 * 
 * v2.4.3: Fix disease display - stop bypassing orchestrator's cached result
 *   - gaip:hub-state-update now defers to gaip:analysis-complete
 *   - turfProfileChange only re-renders if cached species matches
 *   - Never calls analyzeDiseaseRisk() directly from event handlers
 *   - This ensures bipolaris/curvularia patches are always applied
 * 
 * v2.4.1: Silent deferral when DiseaseEngine not loaded
 *   - Removed console.warn for expected early calls
 *   - Orchestrator properly loads DiseaseEngine before analysis
 *   - Added 'deferred' flag to indicate pending analysis
 * 
 * Refactored for what-if scenario support:
 * - All functions accept state parameter
 * - No DOM reading in core analysis
 * - Pure functions for testability
 */

(function() {
    'use strict';
    // b35fix272: namespaced storage — prevents cross-mode key bleed
    var _ls = window.GilbaStorageNS ? window.GilbaStorageNS.get() : localStorage;


    /* ============================================================
       MOBILE DISEASE CACHE
       Persists disease results to localStorage keyed by site so the
       standalone mobile field log page can read them without the hub
       being loaded on the same page. Uses a separate key namespace
       (gilba_disease_cache_*) — does not touch any existing storage.
       Results expire after 24 hours.
    ============================================================ */
    var DISEASE_CACHE_TTL = 24 * 60 * 60 * 1000;

    function getActiveSiteIdForCache() {
        try {
            // b35fix272: GAIP_SiteContext is the single source of truth
            if (window.GAIP_SiteContext) return window.GAIP_SiteContext.getSiteId();
            if (window.GAIP_SampleManager && typeof window.GAIP_SampleManager.getActiveSiteId === 'function') {
                return window.GAIP_SampleManager.getActiveSiteId();
            }
            var sel = document.getElementById('gaip-site-select') || document.querySelector('[data-site-id]');
            if (sel) { return sel.value || sel.dataset.siteId || null; }
            return _ls.getItem('gaip_active_site') || null;
        } catch (e) { return null; }
    }

    function cacheDiseaseResult(result) {
        if (!result || !result.diseases) { return; }
        try {
            var siteId = getActiveSiteIdForCache();
            if (!siteId || siteId === 'default' || siteId === '__all_sites__') { return; }
            // Attach siteId to the result so mobile can validate it matches the active site
            result.siteId = siteId;
            _ls.setItem('gilba_disease_cache_' + siteId, JSON.stringify({
                result:   result,
                siteId:   siteId,
                cachedAt: Date.now()
            }));
        } catch (e) { /* quota or private browsing — silently ignore */ }
    }

    /* ============================================================
       SPECIES NORMALIZATION - NOW DELEGATES TO SPECIESCONTROLLER
    ============================================================ */

    /**
     * Normalize species string to canonical form
     * Now delegates to SpeciesController for Single Source of Truth
     * @param {string} species - Raw species name
     * @returns {string} Canonical species key
     */
    function normalizeSpecies(species) {
        // Use SpeciesController if available (preferred)
        if (window.SpeciesController && typeof window.SpeciesController.normalize === 'function') {
            return window.SpeciesController.normalize(species);
        }
        
        // Fallback for early loading before SpeciesController is ready
        if (!species || typeof species !== 'string') return 'perennialRyegrass';
        
        const s = species.toLowerCase().replace(/[^a-z0-9]/g, '');
        
        const mapping = {
            // Bentgrass variants
            bentgrass: 'bentgrass',
            creepingbentgrass: 'bentgrass',
            creepingbentgrassgreens: 'bentgrass',
            velvetbentgrass: 'bentgrass',
            bent: 'bentgrass',
            
            // Ryegrass
            perennialryegrass: 'perennialRyegrass',
            perennialryegrasssports: 'perennialRyegrass',
            ryegrass: 'perennialRyegrass',
            prg: 'perennialRyegrass',
            
            // Bluegrass
            kentuckybluegrass: 'kentuckyBluegrass',
            bluegrass: 'kentuckyBluegrass',
            kbg: 'kentuckyBluegrass',
            
            // Poa
            annualbluegrass: 'poaAnnua',
            poaannua: 'poaAnnua',
            poa: 'poaAnnua',
            
            // Fescue
            tallfescue: 'tallFescue',
            fescue: 'tallFescue',
            finefescue: 'fineFescue',
            
            // Warm season - couch/bermuda are the same grass, use 'couch' as canonical
            bermuda: 'couch',
            bermudagrass: 'couch',
            couch: 'couch',
            couchgrass: 'couch',
            couchbermudagrass: 'couch',  // "Couch (Bermudagrass)" from dropdown
            kikuyu: 'kikuyu',
            zoysia: 'zoysia',
            buffalo: 'buffalo',
            buffalograss: 'buffalo',
            paspalum: 'seashore_paspalum',
            seashorepaspalum: 'seashore_paspalum'
        };
        
        if (mapping[s]) return mapping[s];
        
        // Partial matches - check couch BEFORE bermuda since they're the same
        if (s.includes('bent')) return 'bentgrass';
        if (s.includes('rye')) return 'perennialRyegrass';
        if (s.includes('poa') || s.includes('annual')) return 'poaAnnua';
        if (s.includes('tall') && s.includes('fescue')) return 'tallFescue';
        if (s.includes('fescue') || s.includes('chewing')) return 'fineFescue';
        if (s.includes('blue')) return 'kentuckyBluegrass';
        if (s.includes('couch')) return 'couch';  // Check couch first
        if (s.includes('bermuda')) return 'couch'; // bermuda = couch
        if (s.includes('kikuyu')) return 'kikuyu';
        if (s.includes('zoysia')) return 'zoysia';
        if (s.includes('buffalo')) return 'buffalo';
        if (s.includes('paspalum')) return 'seashore_paspalum';
        
        return 'perennialRyegrass';
    }

    /* ============================================================
       REGION DETECTION
    ============================================================ */

    function detectRegion(lat, lon) {
        if (lat === undefined || lon === undefined) return 'AU';
        
        // Australia / New Zealand
        if (lat < 0 && lon > 110 && lon < 180) {
            return lon > 165 ? 'NZ' : 'AU';
        }
        
        // Japan
        if (lat > 24 && lat < 46 && lon > 123 && lon < 146) return 'JP';
        
        // Europe
        if (lat > 35 && lat < 72 && lon > -12 && lon < 45) {
            if (lon < 2 && lat > 50 && lat < 61) return lon < -5.5 ? 'IE' : 'GB';
            if (lat > 55 && lon > 11 && lon < 24) return 'SE';
            if (lat > 58 && lon > 4 && lon < 11) return 'NO';
            if (lat > 54.5 && lat < 58 && lon > 8 && lon < 15) return 'DK';
            if (lat > 60 && lon > 20 && lon < 32) return 'FI';
            if (lat > 47 && lat < 55 && lon > 6 && lon < 15) return 'DE';
            if (lat > 42 && lat < 51 && lon > -5 && lon < 8) return 'FR';
            if (lat > 36 && lat < 44 && lon > -9 && lon < 4) return 'ES';
            if (lat > 36 && lat < 47 && lon > 6 && lon < 19) return 'IT';
            if (lat > 50 && lat < 54 && lon > 3 && lon < 7) return 'NL';
            if (lat > 46 && lat < 48.5 && lon > 6 && lon < 17) return lon < 10 ? 'CH' : 'AT';
            return 'EU';
        }
        
        // North America
        if (lat > 24 && lat < 72 && lon > -170 && lon < -50) {
            return lat > 49 ? 'CA' : 'US';
        }
        
        // South Africa
        if (lat < -22 && lat > -35 && lon > 16 && lon < 33) return 'ZA';
        
        return 'AU';
    }

    /* ============================================================
       SPECIES RESOLUTION (State-based)
    ============================================================ */

    function resolveEffectiveSpecies(state) {
        let species = null;
        let overseedSpecies = null;
        
        // Get base species
        if (state.turf?.grassSpecies) {
            species = normalizeSpecies(state.turf.grassSpecies);
        }
        
        // Check if base is C4 (warm season)
        const isC4Base = ['couch', 'bermuda', 'kikuyu', 'zoysia', 'buffalo', 'buffalograss', 'paspalum', 'seashore_paspalum']
            .includes(species);
        
        // v2.4.14: PRIORITY 1 - Check if hub already resolved effectiveSpecies
        // When hub-tissue-v3 detects overseed dominant (>50% C3), it sets turf.effectiveSpecies
        // This is the most reliable source as it's set during state building, not async
        if (isC4Base && state.turf?.effectiveSpecies) {
            const normalizedEffective = normalizeSpecies(state.turf.effectiveSpecies);
            // Only use effectiveSpecies if it's different from base (i.e., it's the overseed)
            if (normalizedEffective !== species) {
                const c3Pct = state.turf.species?.c3Fraction ? Math.round(state.turf.species.c3Fraction * 100) : 
                              (state.turf.percentC3Cover || 0);
                return normalizedEffective;
            }
        }
        
        // v2.4.14: PRIORITY 2 - Get overseed species from multiple sources
        // When base is C4 (Couch), turf.coolOverseed is cleared by hub-tissue-v3.js
        // Must also check GAIP_OVERSEED_STATE and DOM dropdown
        let rawOverseed = state.turf?.coolOverseed;
        
        // Check GAIP_OVERSEED_STATE if no coolOverseed in state
        if ((!rawOverseed || rawOverseed.trim() === '') && typeof window !== 'undefined') {
            const overseedState = window.GAIP_OVERSEED_STATE;
            if (overseedState?.overseedSpecies && overseedState.overseedSpecies.trim() !== '') {
                rawOverseed = overseedState.overseedSpecies;
            }
        }
        
        // Check DOM dropdown as final fallback
        if ((!rawOverseed || rawOverseed.trim() === '') && typeof document !== 'undefined') {
            const overseedDropdown = document.querySelector('.gaip-cool-overseed');
            if (overseedDropdown?.value && overseedDropdown.value.trim() !== '') {
                rawOverseed = overseedDropdown.value;
            }
        }
        
        if (rawOverseed && rawOverseed.trim() !== '') {
            const normalizedOverseed = normalizeSpecies(rawOverseed);
            // Only treat as overseed if it's actually different from base species
            // AND if it's a C3 species (overseed is always C3 over C4 base)
            const isC3Overseed = ['perennialRyegrass', 'bentgrass', 'kentuckyBluegrass', 'tallFescue', 'fineFescue', 'poaAnnua']
                .includes(normalizedOverseed);
            
            if (normalizedOverseed !== species && isC3Overseed) {
                overseedSpecies = normalizedOverseed;
            } else {
            }
        }
        
        // Fallback chain for base species
        if (!species) {
            if (state.variety?.species) {
                species = normalizeSpecies(state.variety.species);
            } else if (state.turf?.warmBase) {
                species = normalizeSpecies(state.turf.warmBase);
            }
        }
        
        
        // If no overseed or not a C4 base, return base species
        // This handles: pure C3 stands, pure C4 stands without overseed
        if (!overseedSpecies || !isC4Base) {
            const result = species || 'perennialRyegrass';
            return result;
        }
        
        // We have a C4 base with C3 overseed - check %C3 cover and season
        // v2.4.14: Also check GAIP_OVERSEED_STATE.c3Fraction
        let c3Fraction = state.turf?.percentC3Cover || 0;
        if (c3Fraction === 0 && typeof window !== 'undefined' && window.GAIP_OVERSEED_STATE?.c3Fraction) {
            c3Fraction = window.GAIP_OVERSEED_STATE.c3Fraction * 100; // Convert from 0-1 to 0-100
        }
        
        // If user set >50% C3 cover, overseed is dominant
        if (c3Fraction > 50) {
            return overseedSpecies;
        }
        
        // Check explicit overseed status from UI (transitioning, fading, dead = use base)
        const overseedStatus = state.turf?.overseedStatus || '';
        const isTransitioningOut = ['transitioning', 'fading', 'dead'].includes(overseedStatus);
        
        if (isTransitioningOut) {
            return species;
        }
        
        // Check summer intent - if "retain" or "perennial", overseed stays year-round
        // v2.4.14: Also check GAIP_OVERSEED_STATE.summerIntent
        let summerIntent = state.turf?.overseedSummerIntent || 'transition';
        if (summerIntent === 'transition' && typeof window !== 'undefined' && window.GAIP_OVERSEED_STATE?.summerIntent) {
            summerIntent = window.GAIP_OVERSEED_STATE.summerIntent;
        }
        
        const isRetainingOverseed = ['retain', 'perennial', 'maintain', 'keep'].includes(summerIntent);
        
        if (isRetainingOverseed) {
            // When retaining, check if there's still significant C3 cover
            // Even 30%+ C3 in summer with retain intent means manage for ryegrass
            if (c3Fraction >= 30) {
                return overseedSpecies;
            }
            // Low C3 cover even with retain intent - the overseed might have failed
            return species;
        }
        
        // Intent is "transition" - seasonal logic applies
        
        // Seasonal logic for southern hemisphere
        const lat = state.climate?.lat || state.location?.lat || -33.87;
        const isSouthern = lat < 0;
        const isTransitionZone = Math.abs(lat) >= 30 && Math.abs(lat) <= 38;
        
        if (!isSouthern && !isTransitionZone) {
            return species;
        }
        
        const month = (new Date()).getMonth() + 1;
        
        // Southern hemisphere: summer = Dec-Feb (dead), winter = Jun-Aug (dominant)
        const southernStatus = {
            12: 'dead', 1: 'dead', 2: 'dead', 3: 'dying', 4: 'dying',
            5: 'establishing', 6: 'dominant', 7: 'dominant', 8: 'dominant',
            9: 'fading', 10: 'fading', 11: 'dying'
        };
        
        const northernStatus = {
            6: 'dead', 7: 'dead', 8: 'dead', 9: 'dying', 10: 'establishing',
            11: 'dominant', 12: 'dominant', 1: 'dominant', 2: 'dominant',
            3: 'fading', 4: 'fading', 5: 'dying'
        };
        
        const seasonalStatus = (isSouthern ? southernStatus : northernStatus)[month] || 'dead';
        
        
        // dead = overseed gone, use base
        if (seasonalStatus === 'dead') {
            return species;
        }
        
        // dying/fading = transitioning OUT, use base (manage for the grass staying)
        if (seasonalStatus === 'dying' || seasonalStatus === 'fading') {
            return species;
        }
        
        // dominant = winter, overseed is the active grass
        if (seasonalStatus === 'dominant') {
            return overseedSpecies;
        }
        
        // establishing = new overseed going in, protect it
        return overseedSpecies;
    }

    /* ============================================================
       INPUT EXTRACTORS (State-based, no DOM)
    ============================================================ */

    function extractShadeData(state) {
        // Check state.shadeMetrics first
        if (state.shadeMetrics) {
            const sm = state.shadeMetrics;
            const modular = sm.modular || {};
            
            const dliShaded = modular.dliShaded || sm.DLI_adj || sm.dliShaded || 0;
            const dliOptimal = modular.dliOptimal || sm.dliOptimal || sm.dliTarget || 30;
            const dliOpen = modular.dliOpen || sm.DLI_measured || sm.dliOpen || 0;
            
            let deficitPct = 0;
            if (dliShaded > 0 && dliShaded < dliOptimal) {
                deficitPct = ((dliOptimal - dliShaded) / dliOptimal) * 100;
            }
            
            const shadePct = dliOpen > 0 ? ((dliOpen - dliShaded) / dliOpen) * 100 : 0;
            
            return {
                dliDeficit: {
                    percentage: deficitPct,
                    value: Math.max(0, dliOptimal - dliShaded),
                    shadePercent: shadePct
                },
                status: modular.status || sm.c3Status || 'unknown',
                statusSeverity: modular.statusSeverity || sm.stressClass?.severity || 'unknown',
                dliOpen,
                dliShaded,
                dliOptimal,
                stressIndex: sm.stressIndex || 0,
                stressClass: sm.stressClass?.label || modular.status || 'unknown',
                fungalRisk: sm.fungalRisk || 0,
                fungalClass: sm.fungalClass?.label || 'unknown',
                recoveryWindow: sm.recoveryWindow,
                mowingAdjustment: sm.mowingGuidance?.increasePct || 0,
                mowingGuidance: sm.mowingGuidance
            };
        }
        
        // Fallback to global result
        if (typeof window !== 'undefined' && window.GAIP_SHADE_RESULT) {
            return extractShadeData({ shadeMetrics: window.GAIP_SHADE_RESULT });
        }
        
        return null;
    }

    function extractDewData(state) {
        if (state.dewData?.leafWetness) {
            return state.dewData;
        }
        
        // Fallback to global result
        if (typeof window !== 'undefined' && window.GAIP_DEW_RESULT?.applicable) {
            return {
                leafWetness: window.GAIP_DEW_RESULT.leafWetness,
                forecast: window.GAIP_DEW_RESULT.forecast,
                summary: window.GAIP_DEW_RESULT.summary,
                source: 'dew-prediction-module'
            };
        }
        
        return null;
    }

    function extractNitrogenStatus(state) {
        // From nitrogen program
        if (state.nitrogenStatus) {
            const ns = state.nitrogenStatus;
            let status = {
                'Insufficient': 'low',
                'Adequate': 'adequate', 
                'Excessive': 'excessive',
                'Unknown': 'adequate'
            }[ns.status] || 'adequate';
            
            if (ns.opt && ns.applied !== undefined) {
                const ratio = ns.applied / ns.opt;
                status = ratio < 0.5 ? 'deficient' :
                         ratio < 0.8 ? 'low' :
                         ratio <= 1 ? 'adequate' :
                         ratio <= 1.2 ? 'optimal' :
                         ratio <= 1.5 ? 'high' : 'excessive';
            }
            
            return {
                status,
                value: ns.applied,
                optimal: ns.opt,
                ratio: ns.opt ? ns.applied / ns.opt : null,
                source: 'n_program'
            };
        }
        
        // From tissue data
        if (state.tissue?.N) {
            const tissueN = parseFloat(state.tissue.N);
            const speciesKey = normalizeSpecies(state.turf?.grassSpecies || 'generic');
            
            const thresholds = {
                couch: { deficient: 2.5, low: 3.0, optimal: 3.65, high: 4.3, excessive: 5.0 },
                bermuda: { deficient: 2.5, low: 3.0, optimal: 3.65, high: 4.3, excessive: 5.0 },
                kikuyu: { deficient: 2.7, low: 3.2, optimal: 3.8, high: 4.5, excessive: 5.2 },
                bentgrass: { deficient: 3.5, low: 4.0, optimal: 4.5, high: 5.0, excessive: 5.5 },
                perennialRyegrass: { deficient: 2.8, low: 3.34, optimal: 4.2, high: 5.1, excessive: 5.8 },
                generic: { deficient: 2.8, low: 3.3, optimal: 4.0, high: 4.8, excessive: 5.5 }
            };
            
            const t = thresholds[speciesKey] || thresholds.generic;
            let status;
            
            if (tissueN < t.deficient) status = 'deficient';
            else if (tissueN < t.low) status = 'low';
            else if (tissueN < t.optimal) status = 'adequate';
            else if (tissueN <= t.high) status = 'optimal';
            else if (tissueN <= t.excessive) status = 'high';
            else status = 'excessive';
            
            return { status, value: tissueN, species: speciesKey, thresholds: t };
        }
        
        return { status: 'adequate' };
    }

    function extractTissueModifiers(state) {
        if (!state.tissue) return null;
        
        const modifiers = {};
        const notes = [];
        let hasData = false;
        
        const speciesKey = normalizeSpecies(state.turf?.grassSpecies || 'generic');
        const isC4 = ['couch', 'bermuda', 'kikuyu', 'buffalo'].includes(speciesKey);
        
        // Potassium
        if (state.tissue.K) {
            hasData = true;
            const K = parseFloat(state.tissue.K);
            const thresholds = isC4 
                ? { deficient: 1.4, low: 1.6, optimal: 1.9, high: 2.25 }
                : { deficient: 1.8, low: 2.0, optimal: 2.7, high: 3.5 };
            
            if (K < thresholds.deficient) {
                modifiers.K = { factor: 1.25, status: 'deficient', effect: 'increases_all' };
                notes.push(`Low K (${K.toFixed(2)}%) weakening cell walls - increased disease susceptibility`);
            } else if (K < thresholds.low) {
                modifiers.K = { factor: 1.1, status: 'low', effect: 'increases_all' };
                notes.push('Marginal K may reduce stress tolerance');
            } else if (K <= thresholds.high) {
                modifiers.K = { factor: 1.0, status: 'adequate', effect: 'neutral' };
            } else {
                modifiers.K = { factor: 1.05, status: 'high', effect: 'minor_risk' };
                notes.push('High K may affect Ca/Mg balance');
            }
        }
        
        // K:N Ratio
        if (state.tissue.K && state.tissue.N) {
            const ratio = parseFloat(state.tissue.K) / parseFloat(state.tissue.N);
            modifiers.KN_ratio = {
                value: ratio,
                status: ratio < 0.4 ? 'poor' : ratio < 0.5 ? 'low' : ratio <= 0.8 ? 'optimal' : 'high'
            };
            
            if (ratio < 0.4) {
                modifiers.KN_ratio.factor = 1.2;
                modifiers.KN_ratio.effect = 'increases_fungal';
                notes.push(`K:N ratio (${ratio.toFixed(2)}) too low - soft tissue prone to disease`);
            } else if (ratio < 0.5) {
                modifiers.KN_ratio.factor = 1.1;
                notes.push('K:N ratio marginal - monitor tissue quality');
            } else {
                modifiers.KN_ratio.factor = 1.0;
            }
        }
        
        // Calcium
        if (state.tissue.Ca) {
            hasData = true;
            const Ca = parseFloat(state.tissue.Ca);
            const t = { deficient: 0.2, low: 0.25, optimal: 0.45, high: 0.75 };
            
            if (Ca < t.deficient) {
                modifiers.Ca = { factor: 1.2, status: 'deficient', effect: 'increases_pythium_brownpatch' };
                notes.push(`Low Ca (${Ca.toFixed(2)}%) compromising cell walls`);
            } else if (Ca < t.low) {
                modifiers.Ca = { factor: 1.1, status: 'low', effect: 'slight_increase' };
            } else {
                modifiers.Ca = { factor: 1.0, status: 'adequate', effect: 'neutral' };
            }
        }
        
        // Manganese
        if (state.tissue.Mn) {
            hasData = true;
            const Mn = parseFloat(state.tissue.Mn);
            const t = speciesKey === 'bentgrass' || speciesKey === 'poaAnnua'
                ? { deficient: 20, low: 30, optimal: 80, high: 200 }
                : { deficient: 15, low: 25, optimal: 60, high: 200 };
            
            if (Mn < t.deficient) {
                modifiers.Mn = { factor: 1.1, status: 'deficient', effect: 'reduces_stress_tolerance' };
                notes.push(`Low tissue Mn (${Mn} mg/kg) - check soil pH`);
            } else if (Mn < t.low) {
                modifiers.Mn = { factor: 1.05, status: 'low', effect: 'slight_stress' };
            } else {
                modifiers.Mn = { factor: 1.0, status: 'adequate', effect: 'neutral' };
            }
        }
        
        // Silicon
        if (state.tissue.Si) {
            hasData = true;
            const Si = parseFloat(state.tissue.Si);
            
            if (Si >= 0.5) {
                modifiers.Si = { factor: 0.9, status: 'high', effect: 'reduces_fungal' };
                notes.push('Good Si levels providing disease resistance');
            } else if (Si >= 0.2) {
                modifiers.Si = { factor: 1.0, status: 'adequate', effect: 'neutral' };
            } else {
                modifiers.Si = { factor: 1.05, status: 'low', effect: 'slight_increase' };
            }
        }
        
        // Calculate composite modifier
        let product = 1;
        let count = 0;
        for (const key in modifiers) {
            if (modifiers[key].factor) {
                product *= modifiers[key].factor;
                count++;
            }
        }
        
        const compositeModifier = count > 0 ? Math.pow(product, 1 / count) : 1;
        
        return hasData ? { modifiers, notes, compositeModifier, hasData: true } : null;
    }

    function extractSoilContext(state) {
        if (!state.soil) return null;
        
        const thatchMm = state.siteHistory?.thatchMm || state.thatchDepth || null;
        
        return {
            pH: parseFloat(state.soil.pH) || null,
            K_ppm: parseFloat(state.soil.K) || parseFloat(state.soil.ppm?.K) || null,
            Mn_ppm: parseFloat(state.soil.Mn) || parseFloat(state.soil.ppm?.Mn) || null,
            thatchMm
        };
    }

    function extractMowingContext(state) {
        if (state.mowing) {
            return { heightOfCut: parseFloat(state.mowing.height) || 4 };
        }
        
        if (state.shadeMetrics?.mowingAdjustment) {
            return { heightOfCut: state.shadeMetrics.mowingAdjustment.currentHeight || 4 };
        }
        
        return { heightOfCut: state.turf?.hoc || 4 };
    }

    /* ============================================================
       VARIETY TRAITS
    ============================================================ */

    function getVarietyTraits(state, species) {
        // Check state first
        if (state.varietyTraits?.disease) {
            return state.varietyTraits;
        }
        
        const turf = state.turf || {};
        let varietyName, speciesKey;
        
        // Overseed-dominant scenario
        if (turf.overseedDominant === true && turf.effectiveVariety && turf.effectiveVariety !== 'generic') {
            varietyName = turf.effectiveVariety;
            speciesKey = normalizeSpecies(turf.effectiveSpecies || species);
        } else {
            varietyName = turf.variety;
            speciesKey = normalizeSpecies(species);
        }
        
        if (!varietyName || varietyName === 'generic') return null;
        
        
        // Use variety trait function if available
        const getDiseaseModifier = typeof window !== 'undefined' && (
            window.GAIP_VarietyTraits?.getDiseaseModifier ||
            window.gaip_getRegionalDiseaseModifier ||
            window.gaip_getDiseaseModifier
        );
        
        if (typeof getDiseaseModifier === 'function') {
            const traits = {
                name: varietyName,
                species: speciesKey,
                disease: {}
            };
            
            const diseases = ['dollarSpot', 'brownPatch', 'pythium', 'anthracnose',
                            'grayLeafSpot', 'springDeadSpot', 'redThread', 'fusarium',
                            'largePatch', 'helminthosporium'];
            
            diseases.forEach(disease => {
                const result = getDiseaseModifier(speciesKey, varietyName, disease);
                traits.disease[disease] = { riskMultiplier: result.riskMultiplier };
                if (!traits.region && result.region) traits.region = result.region;
            });

            return traits;
        }
        
        return null;
    }

    /* ============================================================
       MAIN ANALYSIS FUNCTION
    ============================================================ */

    /**
     * Run disease analysis with state parameter only
     * @param {Object} state - Complete state object
     * @returns {Object} Disease analysis results
     */
    function analyzeDiseaseRisk(state) {
        if (!state) {
            console.warn('Disease Engine: No state provided');
            return null;
        }
        
        try {
            // Resolve effective species
            const species = resolveEffectiveSpecies(state);
            
            // Get base species for tissue analysis
            const baseSpecies = state.turf?.grassSpecies 
                ? normalizeSpecies(state.turf.grassSpecies)
                : null;
            
            // Poa percentage
            const poaPercent = state.turf?.poaPercent || 0;
            
            // Location/region
            const lat = state.climate?.lat || state.location?.lat;
            const lon = state.climate?.lon || state.location?.lon;
            const region = detectRegion(lat, lon);
            
            // Extract all data from state
            const dewData = extractDewData(state);
            const tissueModifiers = extractTissueModifiers(state);
            const nitrogenStatus = extractNitrogenStatus(state);
            const soilContext = extractSoilContext(state);
            const shadeData = extractShadeData(state);
            const mowingContext = extractMowingContext(state);
            const varietyTraits = getVarietyTraits(state, species);
            
            // Build inputs object for engine
            // b35fix92-humidity: Merge hourlyData from raw Open-Meteo forecast into climateMetrics
            // so getSmithKernsConcurrentHours() gets real RH/temp arrays instead of hitting
            // the mean-humidity fallback (which returns 0 for temperate climates).
            // b35fix98: rawWeatherData is structured as { forecast: { hourly: {...} } } not { hourly: {...} }
            // Previous fallback path window.rawWeatherData?.hourly was always undefined.
            const _rawHourly = state.climate?.forecast?.hourly
                || window.rawWeatherData?.forecast?.hourly
                || window.rawWeatherData?.hourly
                || null;

            const _climateWithHourly = state.climateMetrics
                ? { ...state.climateMetrics, hourlyData: _rawHourly || state.climateMetrics.hourlyData || null }
                : null;

            const inputs = {
                climate: _climateWithHourly,
                dewData: dewData,        // analyse() destructures 'dewData', not 'dew'
                tissueNutrients: tissueModifiers, // analyse() destructures 'tissueNutrients', not 'tissue'
                nitrogen: nitrogenStatus,
                soil: soilContext,
                shade: shadeData,
                mowing: mowingContext,
                variety: varietyTraits,
                poaPercent,
                region,
                species,
                baseSpecies
            };
            
            // Call disease engine if available
            // v2.5.0: Prefer DiseaseEnginePure (Smith-Kerns concurrent hours model)
            const usePure = window.GILBA_USE_PURE_DISEASE !== false &&
                            typeof DiseaseEnginePure !== 'undefined' &&
                            typeof DiseaseEnginePure.analyse === 'function';
            const engineAvailable = usePure ||
                            (typeof DiseaseEngine !== 'undefined' && typeof DiseaseEngine.analyse === 'function');

            if (engineAvailable) {
                let result;
                if (usePure) {
                    // Build injectable dependencies for pure engine
                    const pureInputs = {
                        species,
                        region,
                        ...inputs,
                        regionalMultipliers: (function() {
                            const mults = {};
                            if (typeof window.gaip_getDiseaseMultiplier === 'function') {
                                const diseases = ['dollarSpot','brownPatch','pythiumBlight','fusariumPatch',
                                                  'anthracnose','takeAllPatch','grayLeafSpot','springDeadSpot',
                                                  'largePatch','wateaPatch','redThread'];
                                diseases.forEach(d => {
                                    const m = window.gaip_getDiseaseMultiplier(d, region);
                                    if (m !== 1) mults[d] = m;
                                });
                            }
                            return mults;
                        })(),
                        regionDisplayInfo: typeof window.gaip_getRegionDisplayInfo === 'function'
                            ? window.gaip_getRegionDisplayInfo(region) : { name: region || 'Unknown' },
                        // b35fix116j: inject spray-log residual context so buildRecommendation()
                        // can upgrade action when UV/half-life model shows cover is expiring.
                        // spray-log-cascade writes this to window._sprayResidualProtection at
                        // cascade stage 0.5. We pass it explicitly here so the pure engine
                        // remains DOM-free; the window fallback inside analyse() is a safety net.
                        residualContext: window._sprayResidualProtection || null,
                    };
                    result = DiseaseEnginePure.analyse(pureInputs);
                } else {
                    result = DiseaseEngine.analyse({
                        species,
                        region,
                        ...inputs
                    });
                }
                
                // Store inputs for debugging/export
                if (result) {
                    result.inputs = inputs;
                }
                
                // Store globally for other modules
                if (typeof window !== 'undefined') {
                    window.GAIP_DISEASE_RESULT = result;
                    cacheDiseaseResult(result);
                    // v2.4.16: Dispatch event for dashboard and other listeners
                    try {
                        document.dispatchEvent(new CustomEvent('gaip:disease-updated', { 
                            detail: { result, species, region }
                        }));
                    } catch (e) {
                        // Ignore dispatch errors
                    }
                }
                
                return result;
            }
            
            // DiseaseEngine not yet loaded - this is normal during initial state dispatch
            // The orchestrator will call disease analysis properly once DiseaseEngine is ready
            // Only log in debug mode to reduce console noise
            if (window.GAIP_DEBUG) {
            }
            return {
                species,
                region,
                inputs,
                diseases: [],
                overallScore: 0,
                overallRisk: 'Pending',
                deferred: true  // Flag to indicate this was deferred
            };
            
        } catch (e) {
            console.error('Disease analysis error:', e);
            return null;
        }
    }

    /**
     * Convert risk score to severity label
     */
    function getRiskSeverity(score) {
        if (score >= 85) return 'severe';
        if (score >= 70) return 'high';
        if (score >= 50) return 'moderate';
        if (score >= 25) return 'low';
        return 'minimal';
    }

    /* ============================================================
       UI RENDERING (Optional - only if container exists)
    ============================================================ */

    function renderDiseaseResults(result, container, state) {
        if (!container) {
            console.warn('Disease output container not found');
            return;
        }
        
        if (!result) {
            container.innerHTML = '<p class="gaip-disease-empty" style="padding: 16px; color: var(--gaip-text); font-style: italic;">Disease analysis requires climate data. Ensure location is set and weather data loads successfully.</p>';
            return;
        }
        
        if (result.diseases && result.diseases.length === 0) {
            container.innerHTML = '<p class="gaip-disease-empty" style="padding: 16px; color: var(--gaip-text); font-style: italic;">No disease risks detected for current conditions and species.</p>';
            return;
        }
        
        // Use DiseaseUI if available
        if (typeof DiseaseUI !== 'undefined' && typeof DiseaseUI.render === 'function') {
            DiseaseUI.render(container.id || 'gaip-disease-output', result, { compact: false, state });
        } else {
            // Basic fallback render
            container.innerHTML = `
                <div style="padding: 16px;">
                    <strong>Overall Disease Risk: ${result.overallRisk || 'Unknown'}</strong>
                    <p>Score: ${result.overallScore || 0}/100</p>
                    <p>Species: ${result.species || 'Unknown'}</p>
                    <p>Region: ${result.region || 'Unknown'}</p>
                </div>
            `;
        }
    }

    /* ============================================================
       EVENT INTEGRATION
    ============================================================ */

    function setupEventListeners() {
        if (typeof document === 'undefined') return;
        
        // Listen for hub state updates
        // IMPORTANT: Don't call analyzeDiseaseRisk() here - the orchestrator will run disease
        // analysis with bipolaris/curvularia patches applied. Re-running here bypasses those patches.
        document.addEventListener('gaip:hub-state-update', function(e) {
            // Defer to gaip:analysis-complete event which fires after orchestrator completes
        });
        
        // Listen for analysis complete - but orchestrator runs AFTER this event fires
        // So we need to wait for orchestrator to complete
        document.addEventListener('gaip:analysis-complete', function(e) {
            if (e.detail?.state) {
                const state = e.detail.state;
                
                // v2.4.15: Check effectiveSpecies FIRST for overseed scenarios
                // When overseed is dominant (>50% C3), hub-tissue-v3 sets turf.effectiveSpecies
                // This is the species we should use for disease validation, NOT the base species
                let currentSpecies = null;
                let effectiveSpeciesUsed = false;
                
                // PRIORITY 1: Check effectiveSpecies from state (set by hub for overseed scenarios)
                if (state.turf?.effectiveSpecies) {
                    currentSpecies = DiseaseIntegration.normalizeSpecies(state.turf.effectiveSpecies);
                    effectiveSpeciesUsed = true;
                }
                
                // PRIORITY 2: Check GAIP_OVERSEED_STATE for C4 base with active overseed
                if (!currentSpecies && window.GAIP_OVERSEED_STATE) {
                    const os = window.GAIP_OVERSEED_STATE;
                    // Only use overseed species if c3Fraction > 50% (overseed dominant)
                    if (os.overseedSpecies && os.c3Fraction > 0.5) {
                        currentSpecies = DiseaseIntegration.normalizeSpecies(os.overseedSpecies);
                        effectiveSpeciesUsed = true;
                    }
                }
                
                // PRIORITY 3: Read base species from DOM dropdown
                if (!currentSpecies) {
                    const speciesDropdown = document.querySelector('.gaip-species') || 
                                            document.getElementById('gaip-species-select') ||
                                            document.querySelector('[data-field="species"]');
                    if (speciesDropdown) {
                        const selectedText = speciesDropdown.selectedOptions?.[0]?.text || speciesDropdown.value;
                        if (selectedText) {
                            currentSpecies = DiseaseIntegration.normalizeSpecies(selectedText);
                        }
                    }
                }
                
                // PRIORITY 4: Fallback to TurfProfileController
                if (!currentSpecies && window.TurfProfileController?.getState) {
                    const tpcState = window.TurfProfileController.getState();
                    if (tpcState?.species) {
                        currentSpecies = DiseaseIntegration.normalizeSpecies(tpcState.species);
                    }
                }
                
                // PRIORITY 5: Final fallback to event state
                if (!currentSpecies) {
                    let speciesValue = state.turf?.grassSpecies || state.turf?.species;
                    if (speciesValue && typeof speciesValue === 'string') {
                        currentSpecies = DiseaseIntegration.normalizeSpecies(speciesValue);
                    } else {
                    }
                }
                
                // Helper to find disease result from multiple possible locations
                // v2.4.8: Now validates species matches current selection
                function findDiseaseResult() {
                    function validateResult(result, source) {
                        if (!result?.diseases?.length) return null;
                        
                        // v2.4.8: Check if result species matches current species
                        const resultSpecies = DiseaseIntegration.normalizeSpecies(result.species);
                        if (currentSpecies && resultSpecies && resultSpecies !== currentSpecies) {
                            return null;
                        }
                        return { result, source };
                    }
                    
                    // Check direct global (legacy)
                    let found = validateResult(window.GAIP_DISEASE_RESULT, 'GAIP_DISEASE_RESULT');
                    if (found) return found;
                    
                    // Check orchestrator getComputed() - PRIMARY LOCATION
                    if (typeof window.GaipOrchestrator?.getComputed === 'function') {
                        const computed = window.GaipOrchestrator.getComputed();
                        found = validateResult(computed?.disease, 'GaipOrchestrator.getComputed()');
                        if (found) return found;
                    }
                    // Check orchestrator results (alternate structure)
                    found = validateResult(window.GaipOrchestrator?.results?.disease, 'GaipOrchestrator.results');
                    if (found) return found;
                    
                    // Check orchestrator getState
                    if (typeof window.GaipOrchestrator?.getState === 'function') {
                        const orchState = window.GaipOrchestrator.getState();
                        found = validateResult(orchState?.disease, 'GaipOrchestrator.getState()');
                        if (found) return found;
                    }
                    // Check canonical state
                    found = validateResult(window.GAIP_CANONICAL_STATE?.disease, 'GAIP_CANONICAL_STATE');
                    if (found) return found;
                    
                    // Check cascade results
                    found = validateResult(window.GAIP_CASCADE_RESULTS?.disease, 'GAIP_CASCADE_RESULTS');
                    if (found) return found;
                    
                    // Check GAIP_STATE (sometimes stored here)
                    found = validateResult(window.GAIP_STATE?.disease, 'GAIP_STATE');
                    if (found) return found;
                    
                    return null;
                }
                
                // v2.4.17: Don't render immediately — the orchestrator runs disease
                // analysis ~300ms AFTER gaip:analysis-complete fires (via gaip:hub-state-update
                // debounce). The immediate GAIP_DISEASE_RESULT is STALE from the prior run.
                // Instead, poll for the orchestrator to update the result.
                // The gaip-orchestrator-complete handler (below) will also catch it.
                
                let found = findDiseaseResult();

                // Track whether orchestrator-complete already rendered
                let renderedByOrchestrator = false;
                
                const onOrchestratorDone = function(e) {
                    const diseaseResult = e.detail?.state?.computed?.disease || e.detail?.results?.disease || e.detail?.disease;
                    // b35fix98: render whenever orchestrator fires a result, overwriting stale display
                    if (diseaseResult) {
                        renderedByOrchestrator = true;
                        window.GAIP_DISEASE_RESULT = diseaseResult;
                        if (diseaseResult.diseases?.length > 0) { cacheDiseaseResult(diseaseResult); }
                        const container = document.getElementById('gaip-disease-output');
                        if (container) {
                            renderDiseaseResults(diseaseResult, container, state);
                        }
                        try {
                            document.dispatchEvent(new CustomEvent('gaip:disease-updated', {
                                detail: { result: diseaseResult, source: 'orchestrator-complete' }
                            }));
                        } catch (err) { /* ignore */ }
                    }
                    document.removeEventListener('gaip:orchestrator-complete', onOrchestratorDone);
                };
                document.addEventListener('gaip:orchestrator-complete', onOrchestratorDone);
                
                // Fallback poll: if orchestrator-complete doesn't fire within 800ms,
                // render whatever we have (handles edge cases like first load)
                let pollAttempts = 0;
                const maxPollAttempts = 16; // 16 × 50ms = 800ms
                const pollInterval = setInterval(function() {
                    pollAttempts++;
                    
                    if (renderedByOrchestrator) {
                        clearInterval(pollInterval);
                        return;
                    }
                    
                    found = findDiseaseResult();
                    
                    if (pollAttempts >= maxPollAttempts) {
                        clearInterval(pollInterval);
                        document.removeEventListener('gaip:orchestrator-complete', onOrchestratorDone);
                        
                        if (found) {
                            window.GAIP_DISEASE_RESULT = found.result;
                            try {
                                document.dispatchEvent(new CustomEvent('gaip:disease-updated', { 
                                    detail: { result: found.result, source: found.source }
                                }));
                            } catch (err) { /* ignore */ }
                            const container = document.getElementById('gaip-disease-output');
                            if (container) {
                                renderDiseaseResults(found.result, container, state);
                            }
                        } else {
                        }
                    }
                }, 50);
            }
        });
        
        // Also listen for orchestrator completion event if it exists
        document.addEventListener('gaip:orchestrator-complete', function(e) {
            const diseaseResult = e.detail?.state?.computed?.disease || e.detail?.results?.disease || e.detail?.disease;
            if (diseaseResult?.diseases?.length > 0) {
                window.GAIP_DISEASE_RESULT = diseaseResult;
                cacheDiseaseResult(diseaseResult);
                const state = window.GAIP_STATE || e.detail?.state;
                const container = document.getElementById('gaip-disease-output');
                if (container) {
                    renderDiseaseResults(diseaseResult, container, state);
                }
            }
        });
        
        // Listen for turf profile changes
        document.addEventListener('gaip:turf-profile-change', function(e) {
            const detail = e.detail;
            
            // Check if species changed - if so, clear stale disease result
            const newSpecies = DiseaseIntegration.normalizeSpecies(detail?.species);
            const cachedSpecies = window.GAIP_DISEASE_RESULT?.species;
            
            if (cachedSpecies && newSpecies !== cachedSpecies) {
                window.GAIP_DISEASE_RESULT = null;
                // v2.4.18: Also clear forecast data to prevent stale forecast showing in dashboard
                window.GAIP_DISEASE_FORECAST = null;
                window._diseaseForecastData = null;
            }
            
            // IMPORTANT: Do NOT re-run analyzeDiseaseRisk() here!
            // The bipolaris/curvularia patches only work when called through the orchestrator.
            // Just use the cached result if it matches current species.
            const container = document.querySelector('.gaip-results');
            if (container && container.style.display !== 'none') {
                const state = typeof window !== 'undefined' ? window.GAIP_STATE : null;
                const cachedResult = window.GAIP_DISEASE_RESULT;
                
                if (state && cachedResult) {
                    // Only re-render if cached result matches current species
                    const currentSpecies = DiseaseIntegration.normalizeSpecies(state.turf?.grassSpecies);
                    const resultSpecies = cachedResult.species;
                    
                    if (currentSpecies === resultSpecies) {
                        const outputContainer = document.getElementById('gaip-disease-output');
                        if (outputContainer) {
                            renderDiseaseResults(cachedResult, outputContainer, state);
                        }
                    }
                    // If species changed, don't render stale data - wait for next "Run Analysis"
                }
            }
        });
    }

    /* ============================================================
       INITIALIZATION
    ============================================================ */

    function init() {
        // Check dependencies - only log if debug mode
        if (typeof DiseaseEngine === 'undefined' && window.GAIP_DEBUG) {
        }
        if (typeof DiseaseUI === 'undefined' && window.GAIP_DEBUG) {
        }
        
        // Setup event listeners
        setupEventListeners();
        
    }

    // Auto-initialize on DOM ready
    if (typeof document !== 'undefined') {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', init);
        } else {
            init();
        }
    }

    /* ============================================================
       FUNGICIDE FILTER INTEGRATION
       Routes to correct regional database (AU/NZ/EU/etc)
    ============================================================ */

    /**
     * Get approved fungicides for a disease in user's region
     * Wrapper around GAIP_FungicideFilter for convenience
     * 
     * @param {string} disease - Disease name
     * @param {Object} state - State object with location
     * @returns {Object} Approved actives and metadata
     */
    function getApprovedFungicides(disease, state) {
        if (typeof window === 'undefined' || !window.GAIP_FungicideFilter) {
            console.warn('[DiseaseIntegration] FungicideFilter not loaded');
            return { actives: [], warnings: ['Fungicide filter not available'] };
        }

        const lat = state?.location?.lat || state?.climate?.lat;
        const lon = state?.location?.lon || state?.climate?.lon;

        return window.GAIP_FungicideFilter.getApprovedFungicides(disease, {
            lat,
            lon,
            turfRegisteredOnly: true,
            useType: 'golf'
        });
    }

    /**
     * Get rotation recommendation for resistance management
     */
    function getRotationRecommendation(currentActive, disease, state) {
        if (typeof window === 'undefined' || !window.GAIP_FungicideFilter) {
            return { error: 'FungicideFilter not available' };
        }

        const lat = state?.location?.lat || state?.climate?.lat;
        const lon = state?.location?.lon || state?.climate?.lon;

        return window.GAIP_FungicideFilter.getRotationRecommendation(currentActive, disease, {
            lat, lon
        });
    }

    /* ============================================================
       EXPORTS
    ============================================================ */

    const DiseaseIntegration = {
        analyze: analyzeDiseaseRisk,
        render: renderDiseaseResults,
        normalizeSpecies,
        detectRegion,
        resolveEffectiveSpecies,
        extractShadeData,
        extractTissueModifiers,
        extractNitrogenStatus,
        getRiskSeverity,
        getApprovedFungicides,
        getRotationRecommendation,
        VERSION: '2.4.18'
    };

    // Export to global scope
    if (typeof window !== 'undefined') {
        window.GAIP_DiseaseIntegration = DiseaseIntegration;
        window.runDiseaseAnalysis = analyzeDiseaseRisk;
        window.gaip_disease_analyze = analyzeDiseaseRisk;

        // v2.5.0: Shim legacy DiseaseEngine.analyse to route through pure engine
        // This catches ALL callers (hub-v2, hub-tissue, etc.) that call
        // DiseaseEngine.analyse() directly, preventing stale 91% scores from
        // the legacy continuous-humidity model.
        if (typeof DiseaseEngine !== 'undefined' && typeof DiseaseEnginePure !== 'undefined') {
            const _legacyAnalyse = DiseaseEngine.analyse;
            DiseaseEngine.analyse = function(inputs) {
                if (window.GILBA_USE_PURE_DISEASE === false) {
                    return _legacyAnalyse.call(DiseaseEngine, inputs);
                }
                // Build injectable deps if missing
                if (!inputs.regionalMultipliers) {
                    inputs.regionalMultipliers = {};
                    if (typeof window.gaip_getDiseaseMultiplier === 'function') {
                        ['dollarSpot','brownPatch','pythiumBlight','fusariumPatch',
                         'anthracnose','takeAllPatch','grayLeafSpot','springDeadSpot',
                         'largePatch','wateaPatch','redThread'].forEach(function(d) {
                            var m = window.gaip_getDiseaseMultiplier(d, inputs.region || 'AU');
                            if (m !== 1) inputs.regionalMultipliers[d] = m;
                        });
                    }
                }
                if (!inputs.regionDisplayInfo) {
                    inputs.regionDisplayInfo = typeof window.gaip_getRegionDisplayInfo === 'function'
                        ? window.gaip_getRegionDisplayInfo(inputs.region || 'AU')
                        : { name: inputs.region || 'Unknown' };
                }
                return DiseaseEnginePure.analyse(inputs);
            };
        }
    }

})();
