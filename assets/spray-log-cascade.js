/**
 * =============================================================================
 * GILBA SPRAY LOG — Cascade Context v1.0.0
 * =============================================================================
 * 
 * Cascade Stage 0.5: Loads spray context from the spray log REST API
 * and injects it into GAIP_STATE so downstream engines can consume it.
 * 
 * CONSUMERS:
 *   - Disease UI: Residual protection notes on disease cards
 *   - PGR module: Auto-populate last application date if no manual entry
 *   - DMI module: Auto-populate last DMI application if no manual entry
 *   - FRAC rotation: Warn on consecutive same-FRAC group applications
 * 
 * TIMING:
 *   Runs after gaip:analysis-complete, before disease UI renders.
 *   Also hooks into the cascade orchestrator via gaip:cascade-complete.
 * 
 * DEPENDENCIES:
 *   - GAIP_SprayLog.getContext() — REST client
 *   - GAIP_STATE — global state object
 * 
 * @author  Gilba Solutions
 * @version 1.0.0
 * =============================================================================
 */
(function(global) {
    'use strict';

    // b35fix274: namespaced storage adapter
    var _ls = window.GilbaStorageNS ? window.GilbaStorageNS.get() : localStorage;

    const VERSION = '1.0.0';
    const LOG_PREFIX = '[SprayCascade]';
    function log(...args) { ; }

    // Cache context per site+zone to avoid redundant REST calls during
    // rapid cascade cycles
    let _cachedContext = null;
    let _cacheKey = '';
    let _cacheTime = 0;
    const CACHE_TTL = 60000; // 1 minute

    // =========================================================================
    // LOAD SPRAY CONTEXT
    // =========================================================================

    /**
     * Load spray context from the spray log API and inject into GAIP_STATE.
     * Returns the context object for direct use.
     */
    async function loadSprayContext() {
        if (!global.GAIP_SprayLog) {
            log('SprayLog client not available');
            return null;
        }

        // Determine site and zone
        const siteId = getSiteId();
        const zone = getCurrentZone();
        
        log('Context query params: siteId=' + siteId + ' zone=' + zone);
        
        if (!siteId) {
            log('No site ID available');
            return null;
        }

        // Check cache
        const key = `${siteId}:${zone}`;
        const now = Date.now();
        if (_cachedContext && _cacheKey === key && (now - _cacheTime) < CACHE_TTL) {
            log('Using cached spray context');
            injectIntoState(_cachedContext);
            return _cachedContext;
        }

        // Fetch from API
        try {
            const result = await global.GAIP_SprayLog.getContext(siteId, zone, 90);
            
            if (!result || result.error) {
                log('Context fetch failed:', result?.error || 'unknown');
                // Explicitly clear stale state so a previous site's data doesn't persist
                global._sprayResidualProtection = null;
                global._sprayFRACWarnings = [];
                if (global.GAIP_STATE) global.GAIP_STATE.sprayContext = null;
                if (global.currentState) global.currentState.sprayContext = null;
                return null;
            }

            // Build enriched context
            const context = {
                raw: result,
                lastPGR: result.lastPGR || null,
                lastFungicide: result.lastFungicide || null,
                dmiApplications: result.dmiApplications || [],
                fracHistory: result.fracHistory || [],
                recentApplications: result.recentApplications || [],
                residualProtection: {},
                fracWarnings: [],
                loaded: true,
                loadedAt: new Date().toISOString()
            };

            // Calculate residual protection for recent fungicide applications
            if (context.lastFungicide) {
                context.residualProtection = calculateResidualProtection(context.lastFungicide);
            }

            // Check FRAC rotation warnings
            if (context.fracHistory && context.fracHistory.length >= 2) {
                context.fracWarnings = checkFRACRotation(context.fracHistory);
            }

            // Cache
            _cachedContext = context;
            _cacheKey = key;
            _cacheTime = now;

            // Inject into global state
            injectIntoState(context);

            // b35fix237: notify consumers (evidence UI, decision engine) that
            // spray context is now in GAIP_STATE — they may have already rendered
            // from gaip:orchestrator-complete before this async fetch completed.
            document.dispatchEvent(new CustomEvent('gaip:spray-context-loaded', {
                detail: { siteId: siteId, zone: zone }
            }));

            log('Spray context loaded: lastPGR=' + (context.lastPGR?.product_name || 'none') +
                ' lastFungicide=' + (context.lastFungicide?.product_name || 'none') +
                ' dmiCount=' + context.dmiApplications.length +
                ' fracWarnings=' + context.fracWarnings.length +
                ' residual=' + (context.residualProtection.pctRemaining || 'none') +
                ' totalApps=' + (result.totalApplications || 0));

            return context;

        } catch (err) {
            log('Error loading spray context:', err);
            return null;
        }
    }

    // =========================================================================
    // RESIDUAL PROTECTION CALCULATION
    // =========================================================================

    /**
     * Estimate residual fungicide protection based on product half-life
     * and days since application.
     * 
     * Reference: Vincelli 2002 - Chemical Control of Turfgrass Diseases;
     * product label re-application intervals.
     */
    function calculateResidualProtection(lastFungicide) {
        if (!lastFungicide) return {};

        const daysSince = daysBetween(lastFungicide.application_date);
        if (daysSince === null || daysSince < 0) return {};

        // Product-specific protection windows (days)
        // ─────────────────────────────────────────────────────────────────────
        // window:   Minimum label re-application interval (APVMA/ACVM labels)
        // halfLife: Estimated residual decay rate based on:
        //   - AI chemistry class (systemic vs contact)
        //   - Published soil/foliar half-life data where available
        //   - Label re-application interval as upper bound
        //
        // Sources:
        //   Primary: Product labels (APVMA PubCRIS; NZ ACVM register)
        //   Supporting: Vincelli (2002) Plant Disease 86(10);
        //     Frederick et al. (2005) Crop Protection 24(4);
        //     Kaminski & Fidanza (2009) Golf Course Management;
        //     Bartlett et al. (2002) Pest Management Science 58(7) — DMI review
        //
        // COVERAGE: AU (APVMA) and NZ (ACVM) registered active ingredients only.
        // Product mixes inherit the shortest window of their component AIs.
        // ─────────────────────────────────────────────────────────────────────
        const protectionWindows = {
            // FRAC 1 — Benzimidazoles (systemic, xylem-mobile)
            'thiophanate-methyl': { window: 14, halfLife: 10 },  // AU 14-28d; NZ 14-28d
            'thiophanate methyl': { window: 14, halfLife: 10 },
            'thiabendazole':      { window: 14, halfLife: 10 },  // AU 14-21d
            'carbendazim':        { window: 14, halfLife: 10 },  // NZ 14-28d

            // FRAC 2 — Dicarboximides (local penetrant)
            'iprodione':    { window: 14, halfLife: 10 },  // AU 14-28d; NZ 14-28d
            'procymidone':  { window: 14, halfLife: 10 },  // AU 14-28d

            // FRAC 3 — DMI triazoles/imidazoles (systemic, acropetal)
            // Ref: Bartlett et al. 2002 — DMI class persistence review
            'propiconazole':       { window: 14, halfLife: 10 },  // AU 14-28d; NZ 14-28d
            'tebuconazole':        { window: 14, halfLife: 10 },  // AU 14-28d; NZ 14-28d
            'myclobutanil':        { window: 14, halfLife: 10 },  // NZ 14-28d
            'triticonazole':       { window: 14, halfLife: 10 },  // AU 14-28d; seed trt longer
            'difenoconazole':      { window: 14, halfLife: 10 },  // AU 14-28d
            'metconazole':         { window: 14, halfLife: 10 },  // AU label
            'prothioconazole':     { window: 21, halfLife: 14 },  // AU 21-28d; strong persistence
            'mefentrifluconazole': { window: 14, halfLife: 10 },  // AU 14-21d; Revysol
            'triadimenol':         { window: 28, halfLife: 18 },  // AU 28d; NZ 14-28d; soil-applied
            'prochloraz':          { window: 14, halfLife: 10 },  // NZ 14-28d; rapid foliar loss
            'cyproconazole':       { window: 14, halfLife: 10 },  // NZ 14-28d

            // FRAC 4 — Phenylamides (systemic, oomycete-specific)
            'metalaxyl-m': { window: 14, halfLife: 10 },  // AU 14-21d
            'metalaxyl':   { window: 14, halfLife: 10 },  // NZ 14-28d
            'mefenoxam':   { window: 14, halfLife: 10 },  // = metalaxyl-M

            // FRAC 7 — SDHI (systemic, long residual)
            // Ref: Frederick et al. 2005 — SDHI persistence in turf
            'penthiopyrad':      { window: 14, halfLife: 10 },  // AU 14-21d; NZ 14-28d
            'fluopyram':         { window: 14, halfLife: 10 },  // AU 14-28d
            'boscalid':          { window: 14, halfLife: 10 },  // AU 14-28d; NZ 14-28d
            'fluxapyroxad':      { window: 14, halfLife: 10 },  // AU 14-28d
            'benzovindiflupyr':  { window: 14, halfLife: 10 },  // AU 14-28d
            'pydiflumetofen':    { window: 14, halfLife: 10 },  // AU 14-28d; Adepidyn
            'flutolanil':        { window: 14, halfLife: 10 },  // AU 14-28d

            // FRAC 9 — Anilinopyrimidines (locally systemic)
            'cyprodinil': { window: 10, halfLife: 7 },  // AU 10-14d; limited redistribution

            // FRAC 11 — QoI strobilurins (translaminar/systemic)
            // Ref: Vincelli 2002 — strobilurin persistence on turf
            'azoxystrobin':   { window: 21, halfLife: 14 },  // AU 21-28d; NZ 14-28d
            'trifloxystrobin': { window: 14, halfLife: 10 },  // AU 14-28d; NZ 14-28d
            'pyraclostrobin': { window: 14, halfLife: 10 },  // AU 14-21d; NZ 14-28d
            'mandestrobin':   { window: 14, halfLife: 10 },  // AU 14-21d

            // FRAC 12 — Phenylpyrroles (contact/local penetrant)
            'fludioxonil': { window: 14, halfLife: 10 },  // AU 14-21d; NZ 14-28d

            // FRAC 14 — Aromatic hydrocarbons
            'etridiazole':      { window: 5, halfLife: 3 },   // AU 5-10d; short residual
            'tolclofos-methyl': { window: 14, halfLife: 10 },  // AU 14-21d
            'tolclofos methyl': { window: 14, halfLife: 10 },

            // FRAC 21 — Cyano-imidazole
            'cyazofamid': { window: 21, halfLife: 14 },  // AU 21d; oomycete-specific

            // FRAC 28 — Carbamates
            'propamocarb': { window: 7, halfLife: 5 },  // AU 7-14d; NZ 14-28d; rapid degradation

            // FRAC 29 — Uncouplers
            'fluazinam': { window: 7, halfLife: 5 },  // AU 7-14d; NZ 14-28d; contact

            // FRAC 33 — Phosphonates (phloem-mobile, systemic)
            'fosetyl-al':  { window: 14, halfLife: 10 },  // AU 14-21d; NZ 14-28d
            'fosetyl al':  { window: 14, halfLife: 10 },
            'phosphonate': { window: 14, halfLife: 10 },  // NZ 14-28d
            'phosphite':   { window: 14, halfLife: 10 },

            // FRAC M3 — Dithiocarbamates/Thiram (contact, short residual)
            'mancozeb': { window: 7, halfLife: 5 },  // AU 7-14d; NZ 7-14d
            'thiram':   { window: 7, halfLife: 5 },  // AU 7-14d; NZ 7-14d

            // FRAC M4 — Phthalimides (contact)
            'captan': { window: 7, halfLife: 5 },  // AU 7-14d

            // FRAC M5 — Chloronitriles (contact, short residual)
            'chlorothalonil': { window: 7, halfLife: 5 }  // AU 7-14d; NZ 7-14d
        };

        const ai = (lastFungicide.active_ingredient || '').toLowerCase()
            .replace(/[_]+/g, '-')   // underscores to hyphens
            .replace(/\s+/g, ' ')    // normalise whitespace
            .trim();
        const spec = protectionWindows[ai]
            || protectionWindows[ai.replace(/-/g, ' ')]   // try space variant
            || protectionWindows[ai.replace(/\s/g, '-')]; // try hyphen variant
        
        // Default if unknown product
        const baseWindow = spec ? spec.window : 14;
        const baseHalfLife = spec ? spec.halfLife : 10;

        // ─────────────────────────────────────────────────────────────────────
        // CLIMATE-ADJUSTED DECAY MODEL
        // 
        // Temperature effect on degradation rate:
        //   Q10 = 2.58 (EFSA 2007 regulatory default)
        //   Reference temperature: 20°C
        //   Factor = Q10^((T - Tref) / 10)
        //
        // At 10°C: factor = 0.39 (fungicide persists ~2.5× longer)
        // At 20°C: factor = 1.0  (baseline)
        // At 30°C: factor = 2.58 (half-life roughly halved)
        // At 35°C: factor = 4.0  (rapid degradation)
        //
        // Rainfall washoff for contact fungicides:
        //   30-60% loss from >25mm event within 24h (Willis et al. 1996)
        //   Systemics: <15% loss under same conditions
        //
        // Refs:
        //   EFSA (2007) Scientific Opinion — default Q10 for pesticide
        //     degradation in soil. EFSA Journal 622:1-32
        //   FOCUS (2006) Guidance Document on Estimating Persistence and
        //     Degradation Kinetics. EC Document Reference Sanco/10058/2005
        //   Willis et al. (1996) J Environ Qual 25(4):879-885
        //   Latin (2011) A Practical Guide to Turfgrass Fungicides, APS Press
        // ─────────────────────────────────────────────────────────────────────

        const Q10 = 2.58;
        const T_REF = 20; // °C reference temperature

        // Get climate data for the period since application
        const cm = global.climateMetrics;
        let tempFactor = 1.0;  // default: no adjustment
        let rainWashoff = 0;   // percentage lost to rain
        let climateAdjusted = false;

        if (cm && cm.temperature && typeof cm.temperature.mean === 'number') {
            const avgTemp = cm.temperature.mean;
            tempFactor = Math.pow(Q10, (avgTemp - T_REF) / 10);
            // Clamp to reasonable range (0.2× to 6×)
            tempFactor = Math.max(0.2, Math.min(6.0, tempFactor));
            climateAdjusted = true;
            log(`Climate decay adjustment: avgTemp=${avgTemp.toFixed(1)}°C → tempFactor=${tempFactor.toFixed(2)}×`);
        }

        // Rainfall washoff — contact fungicides only
        // Contact FRAC groups: M3, M4, M5, 29, also fludioxonil (12) and etridiazole (14)
        const contactFRACs = ['m3', 'm4', 'm5', '29'];
        const fracStr = (lastFungicide.frac_group || '').toString().toLowerCase();
        const isContact = contactFRACs.includes(fracStr) || !spec?.systemic === true;
        // More precisely: check if AI is in our contact list
        const CONTACT_AIS = [
            'chlorothalonil', 'mancozeb', 'thiram', 'captan', 'fluazinam',
            'etridiazole', 'propamocarb'
        ];
        const isContactAI = CONTACT_AIS.includes(ai) || CONTACT_AIS.includes(ai.replace(/-/g, ' '));

        if (isContactAI && cm && cm.precipitation) {
            const totalPrecipMM = cm.precipitation.total || 0;
            // Approximate washoff: up to 50% for heavy rain on contact fungicides
            // Linear scale: 0% at 0mm, 50% at 50mm+
            // Ref: Willis et al. 1996 — 30-60% loss from >25mm within 24h
            if (totalPrecipMM > 5) {
                rainWashoff = Math.min(50, totalPrecipMM * 1.0);
                climateAdjusted = true;
                log(`Rain washoff (contact AI): ${totalPrecipMM.toFixed(0)}mm → ${rainWashoff.toFixed(0)}% loss`);
            }
        }

        // Adjusted half-life (shorter in hot weather)
        const adjustedHalfLife = baseHalfLife / tempFactor;
        
        // Adjusted protection window (shorter in hot weather, longer in cold)
        const adjustedWindow = Math.round(baseWindow / tempFactor);
        
        // Exponential decay with climate-adjusted rate
        const decayRate = Math.LN2 / adjustedHalfLife;
        let pctRemaining = 100 * Math.exp(-decayRate * daysSince);
        
        // Apply rain washoff reduction for contact fungicides
        if (rainWashoff > 0) {
            pctRemaining *= (1 - rainWashoff / 100);
        }
        
        pctRemaining = Math.round(Math.max(0, Math.min(100, pctRemaining)));

        // ─────────────────────────────────────────────────────────────────────
        // DISEASE-TARGET LOOKUP
        //
        // Build list of diseases this AI is registered to target, from
        // FUNGICIDES_AU / FUNGICIDES_NZ databases already in the Hub.
        // Used by enrichDiseaseCards() to flag off-target applications.
        // ─────────────────────────────────────────────────────────────────────
        const targets = getAITargets(ai, lastFungicide.frac_group);

        const result = {
            productName: lastFungicide.product_name,
            activeIngredient: ai,
            fracGroup: lastFungicide.frac_group,
            applicationDate: lastFungicide.application_date,
            daysSince,
            protectionWindow: adjustedWindow,
            labelWindow: baseWindow,
            halfLife: adjustedHalfLife,
            baseHalfLife,
            pctRemaining,
            isWithinWindow: daysSince <= adjustedWindow,
            isExpired: daysSince > adjustedWindow,
            target: lastFungicide.target || null,
            targets,
            climateAdjusted,
            tempFactor: Math.round(tempFactor * 100) / 100,
            rainWashoff: Math.round(rainWashoff),
            isContactAI,
            // b35fix178a: persist the zone this application was logged against so
            // enrichDiseaseCards() can detect cross-zone bleed (e.g. a fairway
            // fungicide appearing on a greens disease card).
            applicationZone: lastFungicide.zone || 'greens',
            uvResidual: null   // populated below if UV engine and climate data available
        };

        // ─────────────────────────────────────────────────────────────────────
        // UV PHOTOLYSIS AUGMENTATION
        //
        // When GAIP_UV_RESIDUAL is loaded and climate daily data is available,
        // run the three-pathway model (UV photolysis + rainfall + biological)
        // and attach the result as result.uvResidual.
        //
        // The Q10-temperature model above remains authoritative for:
        //   - protectionWindow / pctRemaining (label-interval logic)
        //   - isWithinWindow / isExpired flags
        //
        // uvResidual supplements it with photolysis-specific data (residualPct,
        // breakdown.uvSurvival, confidence, recommendation) for display in the
        // spray log card and any downstream export.
        //
        // Graceful fallback: if UV engine absent or climate data missing,
        // result.uvResidual stays null — no change to existing behaviour.
        // ─────────────────────────────────────────────────────────────────────
        try {
            const uvEngine = (typeof window !== 'undefined' && window.GAIP_UV_RESIDUAL)
                ? window.GAIP_UV_RESIDUAL
                : (typeof GAIP_UV_RESIDUAL !== 'undefined' ? GAIP_UV_RESIDUAL : null);

            if (uvEngine && typeof uvEngine.calculateResidualEfficacy === 'function') {
                const climateHistory = uvEngine.buildClimateHistoryFromGAIP(
                    global.climateMetrics,
                    lastFungicide.application_date,
                    global.rawWeatherData || null
                );
                if (climateHistory && climateHistory.length > 0) {
                    const uvResult = uvEngine.calculateResidualEfficacy(
                        {
                            activeIngredient: ai,
                            applicationDate:  lastFungicide.application_date,
                            ratePercent:      lastFungicide.rate_percent || 100
                        },
                        climateHistory
                    );
                    if (uvResult && uvResult.residualPct !== null) {
                        result.uvResidual = {
                            residualPct:    uvResult.residualPct,
                            belowThreshold: uvResult.belowThreshold,
                            reapplyFlag:    uvResult.reapplyFlag,
                            breakdown:      uvResult.breakdown,
                            uvSensitivity:  uvResult.uvSensitivity,
                            confidence:     uvResult.confidence,
                            recommendation: uvEngine.getRecommendation(uvResult),
                            dataSource:     uvResult.dataSource,
                            daysElapsed:    uvResult.daysElapsed
                        };
                        log(`UV residual (${ai}): ${uvResult.residualPct}% — UV survival ${uvResult.breakdown.uvSurvival}%, rain ${uvResult.breakdown.rainSurvival}%, bio ${uvResult.breakdown.bioSurvival}%`);
                    } else {
                        log(`UV residual (${ai}): no photolysis data — ${uvResult ? uvResult.error : 'null result'}`);
                    }
                } else {
                    log(`UV residual (${ai}): no climate history available from application date`);
                }
            }
        } catch (uvErr) {
            // Non-fatal — legacy model still intact
            log(`UV residual augmentation failed (${ai}): ${uvErr.message}`);
        }

        return result;
    }

    // =========================================================================
    // AI → DISEASE TARGET LOOKUP
    // =========================================================================

    /**
     * Look up which diseases an active ingredient targets, using the
     * FUNGICIDES_AU and NZ databases already loaded by the disease engine.
     *
     * Returns Set of disease keys (e.g. 'dollarSpot', 'brownPatch')
     * that match the data-disease attributes on disease cards.
     */
    function getAITargets(ai, fracGroup) {
        const targets = new Set();
        
        // Normalise AI to camelCase key used in FUNGICIDES_AU
        const aiKey = normaliseToCamelCase(ai);

        // Check AU database
        if (global.FUNGICIDES_AU) {
            const entry = global.FUNGICIDES_AU[aiKey];
            if (entry && entry.targets) {
                entry.targets.forEach(t => targets.add(normaliseTargetKey(t)));
            }
        }

        // Check NZ database
        if (global.GAIP_NZ_FUNGICIDES && global.GAIP_NZ_FUNGICIDES.db) {
            const entry = global.GAIP_NZ_FUNGICIDES.db[aiKey];
            if (entry && entry.targets) {
                entry.targets.forEach(t => targets.add(normaliseTargetKey(t)));
            }
        }

        if (targets.size > 0) {
            log(`AI target lookup: ${ai} → ${[...targets].join(', ')}`);
        } else {
            log(`AI target lookup: ${ai} → no targets found (key tried: ${aiKey})`);
        }

        return targets;
    }

    /**
     * Normalise fungicide DB target keys to match disease card data-disease attributes.
     * DB uses some short forms; disease cards use specific keys.
     */
    function normaliseTargetKey(target) {
        const TARGET_ALIASES = {
            'pythium':       'pythiumBlight',
            'rhizoctonia':   'brownPatch',
            'sclerotinia':   'dollarSpot',
            'eri':           'takeAll',       // Ectotrophic Root Infecting — take-all patch
            'leafSpot':      'helminthosporium',
            'snowMold':      'fusarium',
            'dampingOff':    'pythiumBlight',  // Pythium spp.
            'botrytis':      'fusarium',       // grey snow mould — maps to fusarium card
            'yellowTuft':    'yellowTuft',     // no card currently
            'rust':          'rust'            // no dedicated card currently
        };
        return TARGET_ALIASES[target] || target;
    }

    /**
     * Convert lowercase-hyphenated AI name to camelCase key for DB lookup.
     * e.g. 'thiophanate-methyl' → 'thiophanateMethyl'
     *      'fosetyl-al' → 'fosetylAl'
     *      'metalaxyl-m' → 'metalaxylM'
     */
    function normaliseToCamelCase(ai) {
        return ai
            .replace(/-/g, ' ')
            .replace(/\s+(.)/g, (_, c) => c.toUpperCase())
            .replace(/\s/g, '');
    }

    // =========================================================================
    // FRAC ROTATION CHECK
    // =========================================================================

    /**
     * Check for consecutive same-FRAC group applications.
     * Returns array of warning objects.
     */
    function checkFRACRotation(fracHistory) {
        const warnings = [];
        const seenFRAC = new Set();

        if (!fracHistory || fracHistory.length < 2) return warnings;

        // Sort by date descending, fungicides only
        const sorted = [...fracHistory]
            .filter(e => e.frac_group && e.product_category === 'fungicide')
            .sort((a, b) => new Date(b.application_date) - new Date(a.application_date));

        // b35fix204: split compound FRAC strings (e.g. '11+3') and check each
        // component independently so combination products flag both FRAC groups.
        const allSingleGroups = [...new Set(
            sorted.flatMap(e => String(e.frac_group).split('+').map(g => g.trim()).filter(Boolean))
        )];

        allSingleGroups.forEach(fracGroup => {
            if (seenFRAC.has(fracGroup)) return;

            // All entries whose frac_group contains this single group
            const matching = sorted.filter(e =>
                String(e.frac_group).split('+').map(g => g.trim()).includes(fracGroup)
            );
            if (matching.length < 2) return;

            // Count consecutive block (within 60-day window)
            let count = 1;
            for (let i = 1; i < matching.length; i++) {
                const daysBetween = (new Date(matching[i-1].application_date) - new Date(matching[i].application_date)) / 864e5;
                if (daysBetween <= 60) { count++; } else { break; }
            }
            if (count < 2) return;

            seenFRAC.add(fracGroup);
            const products = [...new Set(matching.slice(0, count).map(e => e.product_name))];
            const productText = products.length === 1
                ? `${count}× ${products[0]}`
                : products.join(', ');

            warnings.push({
                type: 'consecutive_frac',
                fracGroup,
                count,
                products,
                dates: [matching[0].application_date, matching[count - 1].application_date],
                message: `⚠️ ${count} consecutive FRAC ${fracGroup} applications (${productText}). ` +
                         `Rotate to a different mode of action to manage resistance risk.`
            });
        });

        // Check DMI (FRAC 3) frequency across all entries including combos
        const dmiApps = sorted.filter(e =>
            String(e.frac_group).split('+').map(g => g.trim()).includes('3')
        );
        if (dmiApps.length >= 3) {
            warnings.push({
                type: 'dmi_overuse',
                fracGroup: '3',
                count: dmiApps.length,
                message: `⚠️ ${dmiApps.length} FRAC 3 (DMI) applications in 90 days. ` +
                         `Consider reducing DMI frequency to manage resistance development.`
            });
        }

        return warnings;
    }

    // =========================================================================
    // STATE INJECTION
    // =========================================================================

    /**
     * Inject spray context into GAIP_STATE so engines can access it.
     */
    function injectIntoState(context) {
        if (!context) return;

        // b35fix237d: write to stable dedicated global — survives GAIP_STATE replacement
        global.GAIP_SPRAY_CONTEXT = context;

        // GAIP_STATE — may be wiped by hub-tissue reconstruction, GAIP_SPRAY_CONTEXT is the SSOT
        if (global.GAIP_STATE) {
            global.GAIP_STATE.sprayContext = context;
        }

        // Also inject into currentState (legacy)
        if (global.currentState) {
            global.currentState.sprayContext = context;
        }

        // b35fix233: seed Programmes card inputs from spray log so engine can read them.
        // Analysis tab inputs are gone; Programmes card inputs are the only DOM source.
        // autofillPGRDate writes to .gaip-pgr-product / .gaip-pgr-date / .gaip-pgr-rate
        // which the engine reads as its primary source (with GAIP_LAST_PGR as fallback).
        if (context.lastPGR) {
            autofillPGRDate(context.lastPGR);
        }
        if (context.dmiApplications && context.dmiApplications.length > 0) {
            autofillDMIDate(context.dmiApplications[0]);
        }

        // Store for disease UI enrichment
        global._sprayResidualProtection = context.residualProtection;
        global._sprayFRACWarnings = context.fracWarnings;

        // b35fix212: expose lastPGR globally so hub-tissue-v3 can read it
        // as a fallback when the DOM product input is empty (cleared by
        // site-config-persistence before the cascade has run).
        if (context.lastPGR) {
            global.GAIP_LAST_PGR = context.lastPGR;
            // b35fix216/217: persist to localStorage for synchronous page-load restore.
            // b35fix259: Write site-specific key only — _latest removed as cross-site bleed vector.
            try {
                var _siteId = getSiteId() || null;
                var _payload = Object.assign({}, context.lastPGR, { _siteId: _siteId });
                var _json = JSON.stringify(_payload);
                if (_siteId) _ls.setItem('gilba_last_pgr_' + _siteId, _json);
            } catch(e) { /* ignore quota/security errors */ }
        }
    }

    // =========================================================================
    // =========================================================================
    // AUTOFILL HELPERS
    // =========================================================================

    /**
     * Format a YYYY-MM-DD date string for display in badges.
     */
    function _fmtDate(dateStr) {
        if (!dateStr) return '';
        try {
            return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-AU', {
                day: 'numeric', month: 'short', year: 'numeric'
            });
        } catch(e) { return dateStr; }
    }

    /**
     * Show the "📋 From spray log" badge on an autofill badge slot.
     * The slot is a .pgr-autofill-badge div immediately after the input
     * (see pgr-ui.js initPGRPanel). Uses the slot id so we don't rely
     * on parentNode structure.
     */
    function _showBadge(badgeId, text) {
        var el = document.getElementById(badgeId);
        if (!el) return;
        el.textContent = '📋 ' + text;
        el.classList.add('visible');
    }

    // =========================================================================
    // PGR AUTO-POPULATE
    // =========================================================================

    /**
     * Product name → select option value map.
     * Spray log stores human product names; the select needs option codes.
     * Extended vs previous version to cover AU product naming variants.
     */
    var PGR_PRODUCT_MAP = {
        // Primo / trinexapac-ethyl
        'primo 250ec': 'TE250', 'primo 250 ec': 'TE250', 'primo maxx': 'TE120', 'primo maxx 120': 'TE120', 'primo maxx 1ec': 'TE175',  // b35fix209: Primo Maxx std = 120g/L; Maxx 1EC = 175g/L
        'te250': 'TE250', 'te175': 'TE175', 'te120': 'TE120',
        'trinexapac-ethyl': 'TE250', 'trinexapac ethyl': 'TE250',
        // Indigo Amigo — with and without concentration suffix (b35fix201a)
        'indigo amigo': 'TE175',      // bare name → default to 175 formulation
        'indigo amigo 250': 'TE250', 'indigo amigo 175': 'TE175', 'indigo amigo 120': 'TE120',
        'amigo': 'TE175', 'amigo 175': 'TE175', 'amigo 250': 'TE250', 'amigo 120': 'TE120',
        // Marvel 175 (b35fix209)
        'marvel 175': 'TE175', 'marvel': 'TE175', 'indigo marvel 175': 'TE175', 'indigo marvel': 'TE175',
        // Paclobutrazol
        'paclobutrazol': 'PBZ200', 'paclobutrazol 200sc': 'PBZ200',
        'paclobutrazol 200g/l': 'PBZ200', 'paclobutrazol 250g/l': 'PBZ250',
        'trimmit': 'PBZ200', 'trimmit 2sc': 'PBZ200',
        'indigo regulate': 'PBZ200',
        // Prohexadione
        'anuew': 'ANUEW', 'prohexadione-calcium': 'ANUEW', 'prohexadione calcium': 'ANUEW',
        // Ethephon
        'ethephon': 'ETH', 'ethephon 480g/l': 'ETH',
        'indigo incognito': 'ETH', 'proxy': 'ETH'
    };

    /**
     * Write a value to an input/select only if it is eligible for autofill.
     *
     * Eligibility (data-autofilled attribute pattern):
     *   - "false"  → user has manually edited this field; DO NOT overwrite.
     *   - "true"   → field was autofilled from spray log; safe to update on
     *                site-switch (spray log context has changed).
     *   - ""       → field has never been touched; safe to write.
     *   - absent   → treat as never touched; safe to write.
     *
     * The pgr-ui.js input listener sets data-autofilled="false" on first
     * user keystroke, locking the field against autofill for this session.
     * initPGRPanel initialises all fields with data-autofilled="false" so
     * we only ever autofill fields whose attribute was explicitly set to
     * "" or "true" by a previous autofill call here.
     *
     * Returns true if the value was written.
     */
    function _writeIfEligible(el, value) {
        if (!el || value == null || value === '') return false;
        var flag = el.getAttribute('data-autofilled');
        if (flag === 'false') return false;   // user-locked
        el.value = value;
        el.setAttribute('data-autofilled', 'true');
        return true;
    }

    /**
     * Populate PGR inputs from the most recent spray log PGR entry.
     *
     * Called by injectIntoState() whenever a spray context loads.
     * Uses _writeIfEligible so manual entries are never overwritten.
     * Fires change events so hub-tissue-v3 picks up new values on next Run.
     */
    function autofillPGRDate(lastPGR) {
        var dateInput    = document.querySelector('.gaip-pgr-date');
        var productInput = document.querySelector('.gaip-pgr-product');
        var rateInput    = document.querySelector('.gaip-pgr-rate');
        if (!dateInput) return;

        var nameKey = (lastPGR.product_name || '').toLowerCase().trim();
        // b35fix201a: product_key is already a valid select code when set by
        // createFromRecommendation (e.g. 'TE175'). Try it first; fall back to
        // the name map only for manually-entered entries where product_key is null.
        var code    = lastPGR.product_key || PGR_PRODUCT_MAP[nameKey] || '';

        var wrote = false;
        if (_writeIfEligible(dateInput,    lastPGR.application_date))       wrote = true;
        if (_writeIfEligible(productInput, code))                            wrote = true;
        if (_writeIfEligible(rateInput,    lastPGR.rate != null ? String(lastPGR.rate) : '')) wrote = true;

        if (wrote) {
            log('Autofilled PGR inputs from spray log: ' +
                (lastPGR.product_name || code) + ' ' + lastPGR.application_date);
            _showBadge('pgr-date-badge',
                (lastPGR.product_name || code) + ', ' + _fmtDate(lastPGR.application_date));
        }

        // Always fire change events so hub reads current values on next manual Run
        [dateInput, productInput, rateInput].filter(Boolean).forEach(function(el) {
            el.dispatchEvent(new Event('change', { bubbles: true }));
        });
    }

    // =========================================================================
    // DMI AUTO-POPULATE
    // =========================================================================

    /**
     * Populate DMI inputs from the most recent FRAC 3 spray log entry.
     * Same eligibility logic as autofillPGRDate.
     */
    function autofillDMIDate(lastDMI) {
        var dateInput    = document.querySelector('.gaip-dmi-date');
        var productInput = document.querySelector('.gaip-dmi-product');
        var rateInput    = document.querySelector('.gaip-dmi-rate');
        if (!dateInput) return;

        // b35fix245: product_key is the DMI_PRODUCTS registry key (e.g. 'BUMPER').
        // Use it first; fall back to product_name for manually-entered entries.
        var dmiCode = lastDMI.product_key || lastDMI.product_name || '';

        var wrote = false;
        if (_writeIfEligible(dateInput,    lastDMI.application_date))                          wrote = true;
        if (_writeIfEligible(productInput, dmiCode))                                            wrote = true;
        if (_writeIfEligible(rateInput,    lastDMI.rate != null ? String(lastDMI.rate) : '')) wrote = true;

        if (wrote) {
            log('Autofilled DMI inputs from spray log: ' +
                (lastDMI.product_name || dmiCode) + ' ' + lastDMI.application_date);
            _showBadge('dmi-date-badge',
                (lastDMI.product_name || dmiCode) + ', ' + _fmtDate(lastDMI.application_date));
        }

        [dateInput, productInput, rateInput].filter(Boolean).forEach(function(el) {
            el.dispatchEvent(new Event('change', { bubbles: true }));
        });
    }

    // =========================================================================
    // DISEASE UI ENRICHMENT
    // =========================================================================

    /**
     * After disease cards render, inject residual protection notes and
     * FRAC rotation warnings into the disease detail sections.
     * 
     * Called by spray-log-integration.js after wireDiseaseCards().
     */
    function enrichDiseaseCards() {
        const protection = global._sprayResidualProtection;
        const fracWarnings = global._sprayFRACWarnings;

        // b35fix208b: FRAC rotation warnings are programme-wide — render them
        // regardless of whether residual protection data is available.
        // Previously the early-return for !protection blocked all FRAC warnings
        // when no fungicide was logged against the current zone.
        if (fracWarnings && fracWarnings.length > 0) {
            const _allCards = document.querySelectorAll('.gaip-disease-card');
            _allCards.forEach(function(card) {
                const detail = card.querySelector('.gaip-disease-detail');
                if (!detail) return;
                card.querySelectorAll('.gaip-spray-residual-frac').forEach(function(el) { el.remove(); });
                const wrapper = document.createElement('div');
                wrapper.innerHTML = fracWarnings.map(function(w) {
                    return '<div class="gaip-spray-residual gaip-spray-residual-frac" style="margin:8px 0;padding:8px 12px;background:var(--gaip-warning-bg);border-left:3px solid #f59e0b;border-radius:4px;font-size:12px;">' + w.message + '</div>';
                }).join('');
                const sourceEl = detail.querySelector('.gaip-source');
                if (sourceEl) sourceEl.parentNode.insertBefore(wrapper, sourceEl);
                else detail.appendChild(wrapper);
            });
        }

        if (!protection || !protection.productName) {
            // No protection data — purge any stale residual nodes from a previous site
            document.querySelectorAll('.gaip-spray-residual:not(.gaip-spray-residual-frac)').forEach(function(el) { el.remove(); });
            return;
        }

        // b35fix178b: Zone-mismatch guard.
        // The spray log is queried with the *current surface zone* so in normal
        // operation the returned lastFungicide already matches the active surface.
        // However getCurrentZone() falls back to 'greens' when surface state is
        // missing — which can cause a fairway fungicide to bleed onto greens
        // disease cards (or vice versa) if the state hydrates late.
        //
        // Strategy: compare protection.applicationZone (logged zone) against
        // the current surface zone.  If they differ:
        //   • SUPPRESS residual protection notes entirely — a fairway spray does
        //     not protect greens (different sward, HOC, application rate).
        //   • Render a single cross-zone notice instead so the user knows *why*
        //     residual data is absent on this surface.
        //   • FRAC rotation warnings are zone-agnostic (resistance is programme-
        //     wide) so they still render regardless of zone match.
        const currentZone = getCurrentZone();
        const applicationZone = protection.applicationZone || 'greens';
        const zoneMismatch = applicationZone !== currentZone;

        if (zoneMismatch) {
            log(`Zone mismatch: application zone="${applicationZone}", current zone="${currentZone}" — suppressing residual enrichment`);
            // Purge any previously injected residual nodes
            document.querySelectorAll('.gaip-spray-residual').forEach(el => el.remove());
            // Inject a single cross-zone notice on the first disease card only
            const firstCard = document.querySelector('.gaip-disease-card');
            if (firstCard) {
                const detail = firstCard.querySelector('.gaip-disease-detail');
                if (detail && !detail.querySelector('.gaip-spray-residual-zone-notice')) {
                    const ZONE_LABELS = {
                        greens: 'Greens', fairways: 'Fairways', tees: 'Tees',
                        surrounds: 'Surrounds', other: 'Other'
                    };
                    const appLabel = ZONE_LABELS[applicationZone] || applicationZone;
                    const curLabel = ZONE_LABELS[currentZone] || currentZone;
                    const notice = document.createElement('div');
                    notice.className = 'gaip-spray-residual gaip-spray-residual-zone-notice';
                    notice.style.cssText = 'margin:8px 0;padding:8px 12px;background:var(--gaip-info-bg);border-left:3px solid #0ea5e9;border-radius:4px;font-size:12px;';
                    notice.innerHTML = `ℹ️ Last logged fungicide (<strong>${protection.productName}</strong>) was applied to <strong>${appLabel}</strong> — no ${curLabel} residual data on record.`;
                    const sourceEl = detail.querySelector('.gaip-source');
                    if (sourceEl) {
                        sourceEl.parentNode.insertBefore(notice, sourceEl);
                    } else {
                        detail.appendChild(notice);
                    }
                }
            }
            // FRAC rotation warnings already rendered above (programme-wide, zone-agnostic)
            // b35fix208b: removed duplicate render from zone-mismatch path
            log('Cross-zone notice injected; residual enrichment suppressed');
            return;
        }

        // Zones match — proceed with normal enrichment
        // Find all disease cards
        const cards = document.querySelectorAll('.gaip-disease-card');
        cards.forEach(card => {
            // Remove existing residual node before re-injecting (idempotent, prevents stale data)
            card.querySelectorAll('.gaip-spray-residual').forEach(el => el.remove());

            const detail = card.querySelector('.gaip-disease-detail');
            if (!detail) return;

            // Get the disease key from the card's data attribute
            const diseaseKey = card.getAttribute('data-disease') || '';

            // Check if this AI targets this specific disease
            const hasTargets = protection.targets && protection.targets.size > 0;
            const isOnTarget = hasTargets && protection.targets.has(diseaseKey);
            const isOffTarget = hasTargets && !protection.targets.has(diseaseKey);
            // If we couldn't look up targets, don't show mismatch warnings
            // (fail open — better to show generic protection than false negatives)

            // Build residual protection note
            let noteHTML = '';

            // Climate adjustment footnote
            const climateNote = protection.climateAdjusted
                ? ` <span style="font-size:10px;color:var(--gaip-text-secondary);" title="Temperature factor: ${protection.tempFactor}×${protection.rainWashoff > 0 ? ', rain washoff: ' + protection.rainWashoff + '%' : ''}">(climate-adjusted)</span>`
                : '';
            
            if (protection.isWithinWindow && protection.pctRemaining > 10) {
                if (isOffTarget) {
                    // ─── OFF-TARGET: AI doesn't control this disease ───
                    noteHTML += `
                        <div class="gaip-spray-residual" style="margin:8px 0;padding:8px 12px;background:var(--gaip-critical-bg);border-left:3px solid #ef4444;border-radius:4px;font-size:12px;">
                            ⚠️ Recent application (<strong>${protection.productName}</strong>, ${protection.daysSince}d ago) 
                            does not target <strong>${formatDiseaseName(diseaseKey)}</strong> — 
                            specific treatment may be required.
                        </div>
                    `;
                } else {
                    // ─── ON-TARGET or UNKNOWN: show residual protection ───
                    const bgColor = protection.pctRemaining > 50 ? 'var(--gaip-good-bg)' : 'var(--gaip-warning-bg)';
                    const borderColor = protection.pctRemaining > 50 ? '#16a34a' : '#f59e0b';
                    const icon = protection.pctRemaining > 50 ? '🛡️' : '⏳';
                    const fracNote = protection.fracGroup ? ` (FRAC ${protection.fracGroup})` : '';
                    const targetNote = isOnTarget
                        ? ' <span style="font-size:10px;color:#16a34a;">✓ registered for this disease</span>'
                        : '';
                    
                    noteHTML += `
                        <div class="gaip-spray-residual" style="margin:8px 0;padding:8px 12px;background:${bgColor};border-left:3px solid ${borderColor};border-radius:4px;font-size:12px;">
                            ${icon} <strong>${protection.productName}</strong> applied ${protection.daysSince} day${protection.daysSince !== 1 ? 's' : ''} ago
                            — est. ${protection.pctRemaining}% residual activity${fracNote}${climateNote}${targetNote}
                        </div>
                    `;
                }
            } else if (protection.isExpired) {
                const windowNote = protection.climateAdjusted && protection.labelWindow !== protection.protectionWindow
                    ? ` (label ${protection.labelWindow}d, adjusted to ${protection.protectionWindow}d)`
                    : ` (${protection.protectionWindow}-day label interval)`;

                noteHTML += `
                    <div class="gaip-spray-residual" style="margin:8px 0;padding:8px 12px;background:var(--gaip-critical-bg);border-left:3px solid #dc2626;border-radius:4px;font-size:12px;">
                        ⚠️ <strong>${protection.productName}</strong> protection window expired 
                        (applied ${protection.daysSince} days ago${windowNote})
                    </div>
                `;
            }

            // FRAC rotation warnings already rendered above (b35fix208b)
            // FRAC rotation warnings already rendered above (b35fix208b)

            if (noteHTML) {
                // Insert before the source line
                const sourceEl = detail.querySelector('.gaip-source');
                const wrapper = document.createElement('div');
                wrapper.innerHTML = noteHTML;
                
                if (sourceEl) {
                    sourceEl.parentNode.insertBefore(wrapper, sourceEl);
                } else {
                    detail.appendChild(wrapper);
                }
            }
        });

        log('Disease cards enriched with spray context');
    }

    // =========================================================================
    // DISEASE NAME FORMATTING
    // =========================================================================

    /**
     * Convert camelCase disease key to readable name for UI display.
     * e.g. 'dollarSpot' → 'Dollar Spot', 'pythiumBlight' → 'Pythium Blight'
     */
    function formatDiseaseName(key) {
        if (!key) return 'this disease';
        return key
            .replace(/([A-Z])/g, ' $1')  // split camelCase
            .replace(/^./, c => c.toUpperCase())  // capitalise first
            .trim();
    }

    // =========================================================================
    // HELPERS
    // =========================================================================

    function getSiteId() {
        // b35fix271: Delegate to GAIP_SiteContext — single source of truth.
        if (global.GAIP_SiteContext) return global.GAIP_SiteContext.getSiteId();
        // Fallback if module not yet loaded
        if (global.GAIP_SampleManager && typeof global.GAIP_SampleManager.getActiveSiteId === 'function') {
            return global.GAIP_SampleManager.getActiveSiteId();
        }
        return null;
    }

    function getCurrentZone() {
        const state = global.GAIP_STATE || global.currentState;
        if (state) {
            const surface = state.surface?.type || state.turfProfile?.surface;
            if (surface) {
                const map = {
                    'greens': 'greens', 'putting_green': 'greens',
                    'tees': 'tees', 'tee': 'tees',
                    'fairways': 'fairways', 'fairway': 'fairways',
                    'surrounds': 'surrounds',
                    // b35fix209: sports surfaces map to sportsground zone
                    'sports': 'sportsground', 'sportsground': 'sportsground',
                    'athletic': 'sportsground', 'oval': 'sportsground'
                };
                return map[surface] || 'greens';
            }
        }
        return 'greens';
    }

    function daysBetween(dateStr) {
        if (!dateStr) return null;
        const d = new Date(dateStr);
        if (isNaN(d.getTime())) return null;
        const now = new Date();
        return Math.floor((now - d) / (1000 * 60 * 60 * 24));
    }

    // =========================================================================
    // CACHE INVALIDATION
    // =========================================================================

    function invalidateCache() {
        _cachedContext = null;
        _cacheKey = '';
        _cacheTime = 0;
        log('Cache invalidated');
    }

    // =========================================================================
    // EVENT LISTENERS & INIT
    // =========================================================================

    function init() {
        log(`v${VERSION} initialising...`);

        // Load context after analysis completes
        document.addEventListener('gaip:analysis-complete', async () => {
            const ctx = await loadSprayContext();
            // Only enrich if context came back with data — if null/empty, enrichDiseaseCards
            // would be a no-op anyway, but the DOM purge below is explicit and immediate
            if (ctx && ctx.lastFungicide) {
                setTimeout(enrichDiseaseCards, 500);
            } else {
                // Purge any stale residual nodes (e.g. from previous site)
                document.querySelectorAll('.gaip-spray-residual').forEach(el => el.remove());
            }
        });

        // Re-enrich after orchestrator completes (disease cards may re-render).
        // Guard: only run if we have a loaded context for the current site —
        // prevents a cascade-complete from the previous site's final run
        // re-injecting stale residual nodes after the site-changed clear.
        document.addEventListener('gaip:cascade-complete', () => {
            if (!global._sprayResidualProtection) return;
            setTimeout(enrichDiseaseCards, 300);
        });

        // Invalidate cache when spray log is updated
        document.addEventListener('gaip:spray-log-updated', () => {
            invalidateCache();
            loadSprayContext().then(() => {
                setTimeout(enrichDiseaseCards, 300);
            });
        });

        // Invalidate cache AND clear stale residual globals on site switch.
        // Without this, a site with logged applications bleeds its residual
        // protection data into the next site if that site has no spray entries
        // (loadSprayContext returns null and never calls injectIntoState to overwrite).
        document.addEventListener('gaip:site-changed', () => {
            invalidateCache();
            // Null globals so enrichDiseaseCards renders nothing for the new site
            global._sprayResidualProtection = null;
            global._sprayFRACWarnings = [];
            if (global.GAIP_STATE) global.GAIP_STATE.sprayContext = null;
            if (global.currentState) global.currentState.sprayContext = null;
            // Actively remove already-injected residual nodes from the DOM —
            // the skip guard in enrichDiseaseCards would otherwise preserve them
            // if cards haven't fully re-rendered before the next enrich call
            document.querySelectorAll('.gaip-spray-residual').forEach(el => el.remove());
            // b35fix202c: reset autofill eligibility on site-switch.
            // If the user manually entered a PGR/DMI date on the previous site,
            // data-autofilled was set to "false" and blocks spray log autofill
            // for any subsequent site. Reset it here so the new site's spray log
            // context can populate the inputs fresh.
            ['.gaip-pgr-date','.gaip-pgr-product','.gaip-pgr-rate',
             '.gaip-dmi-date','.gaip-dmi-product','.gaip-dmi-rate'].forEach(sel => {
                var el = document.querySelector(sel);
                if (el) el.setAttribute('data-autofilled', 'true');
            });
            // Load context for the new site immediately
            loadSprayContext();
        });

        // b35fix214: load context immediately at init (no fixed delay).
        // The REST call will complete well before gaip:site-config-applied fires
        // at ~2400ms, ensuring GAIP_LAST_PGR is set before the first auto-run
        // reads the DOM. Retry with backoff if GAIP_SprayLog not ready yet.
        (function _tryLoad(attempt) {
            var delay = attempt === 0 ? 0 : attempt < 3 ? 500 : 2000;
            setTimeout(async function() {
                if (!global.GAIP_SprayLog) {
                    if (attempt < 8) _tryLoad(attempt + 1);
                    return;
                }
                await loadSprayContext();
            }, delay);
        })(0);

        // Also reload when site-config-applied fires (just before the auto-run btn.click())
        // so GAIP_LAST_PGR is always current when hub-tissue reads state.pgr.
        document.addEventListener('gaip:site-config-applied', async function() {
            if (global.GAIP_SprayLog) {
                invalidateCache();
                await loadSprayContext();
            }
        });

        // b35fix216: synchronously restore GAIP_LAST_PGR from localStorage
        // before any REST call. This guarantees hub-tissue-v3 can read the
        // correct PGR product on the very first auto-run, even before the
        // async loadSprayContext() completes.
        (function _restoreLastPGRFromStorage() {
            try {
                var _siteId = getSiteId() || null;
                if (!_siteId) return;
                // b35fix259: Do NOT fall back to _latest if no site-specific key exists.
                // The _latest key stores the most recently written PGR across ALL sites
                // and is the primary cross-site bleed vector — a PGR entry for
                // marvel_stadium writes to _latest, which then bleeds into brentford_fc
                // on first load (when no site-specific key exists yet).
                // If this site has no saved PGR, leave GAIP_LAST_PGR null.
                var _stored = _ls.getItem('gilba_last_pgr_' + _siteId);
                if (!_stored) return;
                var _lastPGR = JSON.parse(_stored);
                if (!_lastPGR || !_lastPGR.product_key) return;
                global.GAIP_LAST_PGR = _lastPGR;
                log('Restored GAIP_LAST_PGR from localStorage: ' + _lastPGR.product_key + ' ' + _lastPGR.application_date);
            } catch(e) { /* ignore parse errors */ }
        })();

        // b35fix259: one-time cleanup — remove _latest and any site keys that
        // were poisoned by cross-site bleed before this fix was deployed.
        // Keyed by a localStorage flag so it only runs once per device.
        (function _cleanupPGRBleed() {
            var cleanupKey = 'gilba_pgr_bleed_cleanup_b35fix259';
            if (_ls.getItem(cleanupKey)) return;
            try {
                // Remove the _latest bleed vector entirely
                _ls.removeItem('gilba_last_pgr_latest');
                // The only poisoned site key we can identify is brentford_fc
                // (confirmed in production log as receiving marvel_stadium bleed).
                // Cannot safely remove other keys — they may be legitimate.
                _ls.removeItem('gilba_last_pgr_brentford_fc');
                _ls.setItem(cleanupKey, '1');
                log('b35fix259: PGR bleed cleanup complete — removed _latest and poisoned brentford_fc key');
            } catch(e) { /* ignore */ }
        })();

        log(`v${VERSION} initialised`);
    }

    // =========================================================================
    // EXPORT
    // =========================================================================

    /**
     * refreshPGRFromEntry — b35fix204
     *
     * Called directly from spray-log-ui.js handleSave() after a successful
     * PGR entry save. Bypasses the event chain and eligibility flags entirely.
     * Writes product/date/rate directly into the PGR DOM inputs, shows the
     * autofill badge, then calls gaip_pgr_calculate and re-renders the chart.
     *
     * @param {Object} data  The form data object from getFormData()
     *   data.product_key       — e.g. 'TE175'
     *   data.application_date  — ISO date string
     *   data.rate              — numeric L/ha or kg/ha
     */
    function refreshPGRFromEntry(data) {
        if (!data || !data.product_key || !data.application_date) return;

        var dateInput    = document.querySelector('.gaip-pgr-date');
        var productInput = document.querySelector('.gaip-pgr-product');
        var rateInput    = document.querySelector('.gaip-pgr-rate');
        if (!dateInput) return;

        // Write unconditionally — this is a deliberate new application from the form
        dateInput.value    = data.application_date;
        dateInput.setAttribute('data-autofilled', 'true');
        if (productInput) {
            productInput.value = data.product_key;
            productInput.setAttribute('data-autofilled', 'true');
        }
        if (rateInput && data.rate != null) {
            rateInput.value = String(data.rate);
            rateInput.setAttribute('data-autofilled', 'true');
        }

        // Show badge
        _showBadge('pgr-date-badge', (data.product_name || data.product_key) + ', ' + _fmtDate(data.application_date));

        // Fire change events so hub-tissue-v3 reads current values on next manual Run
        [dateInput, productInput, rateInput].filter(Boolean).forEach(function(el) {
            el.dispatchEvent(new Event('change', { bubbles: true }));
        });

        log('PGR inputs updated from form save: ' + data.product_key + ' ' + data.application_date);

        // Redraw chart directly — no event chain needed
        _redrawPGRChart({
            productType:     data.product_key,
            applicationDate: data.application_date,
            rateLperHa:      data.rate || 0
        });
    }

    /**
     * _redrawPGRChart — pure calculation + render, no DOM reads.
     * Called by refreshPGRFromEntry (direct) and autofillPGRDate (on eligible write).
     *
     * @param {Object} pgrInputs  { productType, applicationDate, rateLperHa }
     */
    function _redrawPGRChart(pgrInputs) {
        try {
            // b35fix218c: GSSH pages export gssh_pgr_calculate; resolve whichever is present.
            var _pgr_fn = global.gaip_pgr_calculate || global.gssh_pgr_calculate || null;
            if (typeof _pgr_fn !== 'function') return;
            if (typeof global.GAIP_PGRUI === 'undefined') return;
            var container = document.querySelector('.gaip-pgr-body');
            if (!container) return;

            var state = Object.assign({}, global.GAIP_STATE || global.currentState || {});
            state.pgr = Object.assign({}, state.pgr || {}, pgrInputs);

            var result = _pgr_fn(state);
            if (!result || result.error) {
                log('PGR chart redraw skipped — calculate returned: ' + (result && result.error));
                return;
            }

            // Mirror post-processing from hub-tissue-v3
            result.applicationDate = pgrInputs.applicationDate;
            var dt        = new Date(pgrInputs.applicationDate);
            var daysSince = Math.max(0, Math.floor((Date.now() - dt) / 864e5));
            result.daysSinceApplication = daysSince;
            result.gdd.baseTemp    = result.gdd.base || (result.species && result.species.gddBase) || 0;
            result.gdd.progressPct = Math.round(100 * (result.gdd.progress || 0));
            result.gdd.days        = daysSince;
            result.gdd.isOverdue   = result.gdd.progress >= 1;
            result.gdd.overdue     = result.gdd.isOverdue ? Math.abs(result.gdd.remaining) : 0;
            result.product.activeIngredient = result.product.type || 'TE';
            var prog = result.gdd.progress || 0;
            result.effect.reapplicationStatus =
                prog >= 0.75 ? 'due' : prog >= 0.6 ? 'approaching' : 'active';

            // Build projection.dateFormatted for pgr-forecast.js
            if (result.projection) {
                var _rate    = Math.max(0.5, result.projection.dailyGDDRate || 10);
                var _days    = result.gdd.remaining > 0 ? Math.ceil(result.gdd.remaining / _rate) : 0;
                var _reapply = new Date(Date.now() + _days * 864e5);
                result.projection.daysUntil     = _days;
                result.projection.dateFormatted = _reapply.toLocaleDateString('en-AU', {
                    day: 'numeric', month: 'short', year: 'numeric'
                });
            }

            global.GAIP_PGR_RESULT = result;
            global.GAIP_PGRUI.render(container, result, { showConfig: false });
            log('PGR chart redrawn (b35fix204)');
        } catch (err) {
            log('PGR chart redraw failed: ' + err.message);
        }
    }

    // b35fix237c: expose cached context so hub-tissue can re-inject synchronously
    function getCachedContext() { return _cachedContext; }

    global.GAIP_SprayCascade = {
        version: VERSION,
        init,
        loadSprayContext,
        enrichDiseaseCards,
        invalidateCache,
        calculateResidualProtection,
        refreshPGRFromEntry,
        checkFRACRotation,
        getCachedContext
    };

    // Auto-init
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => setTimeout(init, 600));
    } else {
        setTimeout(init, 600);
    }

    log(`v${VERSION} loaded`);

})(typeof window !== 'undefined' ? window : this);
