/**
 * =============================================================================
 * GSSH SHADE ↔ NUTRITION INTEGRATION v1.0.0
 * =============================================================================
 * 
 * Bridges the gap between shade/DLI analysis and nutrition planning.
 * Currently, the shade engine calculates N adjustments and growth modifiers
 * but these never flow into:
 *   1. Growth Potential calculations (temperature-only in climate-module-v2.js)
 *   2. Nutrition Calendar GP-weighted distribution
 *   3. Nutrient Demand Engine annual estimates
 *
 * This module:
 *   A. Applies DLI-based growth modifier to monthly GP values
 *   B. Adjusts the nutrition calendar's N programme for shade deficit
 *   C. Adjusts nutrient demand engine thresholds under shade
 *   D. Listens for shade changes and triggers nutrition recalculation
 *
 * SCIENTIFIC BASIS:
 *   - Bell & Danneberger (1999): N reduction under shade to prevent weak,
 *     etiolated growth with thin cell walls and increased disease susceptibility
 *   - Beard (1973): Shade reduces photosynthetic capacity, limiting N
 *     utilisation and carbohydrate production
 *   - Stier & Gardner (2008): Reduced N under shade improves turf quality
 *     vs full-rate N which promotes disease
 *   - PACE Turf GP model: Temperature-based GP represents maximum potential;
 *     actual growth is limited by the most constraining factor (Liebig's law)
 *   - Cockerham et al. (2004): Light is often the primary limiting factor
 *     in stadium environments, overriding temperature-driven GP
 *
 * DATA FLOW:
 *   shade-engine.js → nAdjustment.factor, deficitPct, growthModifier
 *   shade-orchestrator.js → growth_modifier (0-1), dispatches events
 *   THIS MODULE → intercepts GP, adjusts nutrition calendar, adjusts thresholds
 *   → nutrition-calendar.js receives shade-adjusted GP values
 *   → nutrient-demand-engine.js receives shade-adjusted N rate
 *
 * =============================================================================
 */

(function(global) {
    'use strict';

    const VERSION = '1.0.0';
    const MODULE_ID = 'ShadeNutritionIntegration';

    /* ========================================================================
       CONFIGURATION
    ======================================================================== */

    const CONFIG = {
        /**
         * Minimum DLI deficit (%) before GP adjustment kicks in.
         * Below this threshold, temperature-driven GP is used unmodified.
         * Rationale: Small shade deficits (<10%) have negligible impact on
         * photosynthetic rate for most species (Bell et al. 2000).
         */
        minDeficitPctForGPAdjust: 10,

        /**
         * Maximum GP reduction from shade alone.
         * Even under severe shade, temperature still drives some metabolic
         * activity (respiration, root growth). Cap prevents GP hitting zero
         * when temperature is otherwise optimal.
         * Rationale: Cockerham et al. (2004) observed ~20% GP at survival DLI.
         */
        maxGPReductionFactor: 0.80,

        /**
         * Whether to apply shade adjustment to the nutrition calendar's
         * monthly GP distribution. When true, shaded months get less nutrient
         * allocation (matching reduced growth and uptake capacity).
         */
        adjustCalendarGP: true,

        /**
         * Whether to reduce the effective annual N input to the nutrient
         * demand engine based on shade deficit.
         * This changes the total annual programme, not just distribution.
         */
        adjustDemandEngineN: true,

        /**
         * Whether to adjust MLSN/SLAN threshold calculations under shade.
         * Under shade, lower N → lower clipping yield → lower nutrient removal.
         * The nutrient demand engine's threshold adjustment (which increases
         * K/Mg/Ca thresholds at high N) should be recalculated at the
         * shade-adjusted N rate.
         */
        adjustDemandThresholds: true,

        /**
         * Under shade, K demand actually increases relative to N because
         * potassium is critical for stress tolerance, cell wall rigidity,
         * and disease resistance — all more important under low light.
         * This factor boosts K relative to the shade-adjusted N.
         *
         * Reference: Beard (1973) Ch. 9; Bell & Danneberger (1999);
         *            Christians et al. (2016) "Fundamentals of Turfgrass Management"
         */
        shadeKBoostFactor: 1.15,

        /**
         * Fe demand also increases under shade — chlorophyll production is
         * upregulated as the plant attempts to maximise light capture.
         * Reference: Beard (1973), Hull (2000)
         */
        shadeFeBoostFactor: 1.20,

        /**
         * Log debug messages to console
         */
        debug: true
    };

    /* ========================================================================
       UTILITY
    ======================================================================== */

    function log(context, msg, data) {
        if (CONFIG.debug) {
            const prefix = `[${MODULE_ID}:${context}]`;
            if (data !== undefined) {
                console.log(prefix, msg, data);
            } else {
                console.log(prefix, msg);
            }
        }
    }

    function warn(msg, data) {
        console.warn(`[${MODULE_ID}]`, msg, data || '');
    }

    /* ========================================================================
       A. GROWTH POTENTIAL ADJUSTMENT
       
       The climate engine calculates GP purely from temperature (PACE Turf
       Gaussian model). This is the MAXIMUM possible growth rate at that
       temperature. Actual growth is constrained by Liebig's Law — the most
       limiting factor determines realised growth.
       
       Under shade, light becomes the limiting factor. We apply a DLI-based
       modifier to the temperature GP to get a "realised GP" that accounts
       for both temperature and light availability.
       
       Formula:
         realisedGP = temperatureGP × lightModifier
         
       Where lightModifier = shade-orchestrator's growth_modifier (0–1 scale)
       which is already calculated from DLI relative to species thresholds.
       
       This is conservative: we don't let shade INCREASE GP (modifier capped
       at 1.0), only reduce it when DLI is below target.
    ======================================================================== */

    /**
     * Calculate shade-adjusted monthly GP values.
     * Takes the temperature-driven GP array (0-1 per month) and applies
     * the shade growth modifier.
     *
     * @param {Object} monthlyGP - {0: 0.85, 1: 0.90, ...} temperature-based GP
     * @param {Object} shadeData - shade engine/orchestrator output
     * @returns {Object} { adjustedGP: {...}, modifier, applied, reason }
     */
    function adjustMonthlyGPForShade(monthlyGP, shadeData) {
        if (!shadeData || !monthlyGP) {
            return {
                adjustedGP: monthlyGP || {},
                modifier: 1.0,
                applied: false,
                reason: 'No shade data available'
            };
        }

        // Extract shade growth modifier from various possible locations
        const growthModifier = getShadeGrowthModifier(shadeData);
        const deficitPct = getShadeDeficitPct(shadeData);

        if (deficitPct < CONFIG.minDeficitPctForGPAdjust) {
            return {
                adjustedGP: { ...monthlyGP },
                modifier: 1.0,
                deficitPct: deficitPct,
                applied: false,
                reason: `DLI deficit ${deficitPct.toFixed(1)}% below ${CONFIG.minDeficitPctForGPAdjust}% threshold, no GP adjustment`
            };
        }

        // Apply modifier, respecting the max reduction cap
        const effectiveModifier = Math.max(1 - CONFIG.maxGPReductionFactor, growthModifier);
        const adjustedGP = {};

        for (let m = 0; m < 12; m++) {
            const baseGP = monthlyGP[m] || 0;
            adjustedGP[m] = baseGP * effectiveModifier;
        }

        log('adjustGP', `Applied shade modifier ${effectiveModifier.toFixed(2)} to monthly GP`, {
            deficitPct: deficitPct.toFixed(1),
            rawModifier: growthModifier,
            effectiveModifier: effectiveModifier,
            exampleMonth: {
                month: 0,
                baseGP: (monthlyGP[0] || 0).toFixed(3),
                adjustedGP: adjustedGP[0].toFixed(3)
            }
        });

        return {
            adjustedGP: adjustedGP,
            modifier: effectiveModifier,
            deficitPct: deficitPct,
            applied: true,
            reason: `DLI deficit ${deficitPct.toFixed(1)}% → GP reduced by ${Math.round((1 - effectiveModifier) * 100)}%`,
            reference: 'Liebig\'s Law of the Minimum; Bell & Danneberger (1999); Cockerham et al. (2004)'
        };
    }

    /* ========================================================================
       B. NUTRITION CALENDAR N ADJUSTMENT
       
       The nutrition calendar takes an annual N target (user input) and
       distributes it across months by GP weighting. Under shade:
       
       1. The annual N total should be reduced (plant can't utilise full rate)
       2. The monthly GP distribution should reflect shade (Part A above)
       
       The shade engine already calculates an N reduction factor
       (nitrogenAdjustment in shade-engine.js) based on Bell & Danneberger
       (1999). We use that factor to scale the user's annual N input before
       the nutrition calendar distributes it.
       
       We DON'T silently override the user's N target. Instead, we provide
       the adjustment as metadata that the nutrition calendar can display
       and optionally apply, keeping the user in control.
    ======================================================================== */

    /**
     * Calculate shade-adjusted annual N rate for the nutrition calendar.
     *
     * @param {number} userAnnualN - User's entered annual N target (kg/ha)
     * @param {Object} shadeData - shade engine output
     * @returns {Object} adjustment result with recommended N rate
     */
    function adjustAnnualNForShade(userAnnualN, shadeData) {
        if (!shadeData || !userAnnualN) {
            return {
                originalN: userAnnualN || 0,
                adjustedN: userAnnualN || 0,
                factor: 1.0,
                applied: false,
                reason: 'No shade data or N rate'
            };
        }

        // Try to get the shade engine's pre-calculated N adjustment
        const nAdj = shadeData.nAdjustment || shadeData.modular?.nAdjustment;
        const deficitPct = getShadeDeficitPct(shadeData);

        if (nAdj && typeof nAdj.factor === 'number') {
            // Use shade engine's research-backed factor directly
            const adjustedN = Math.round(userAnnualN * nAdj.factor);

            return {
                originalN: userAnnualN,
                adjustedN: adjustedN,
                factor: nAdj.factor,
                reductionPct: nAdj.reductionPct || Math.round((1 - nAdj.factor) * 100),
                deficitPct: deficitPct,
                applied: nAdj.factor < 1.0,
                label: nAdj.label || 'Shade-adjusted',
                reason: nAdj.reason || `DLI deficit ${deficitPct.toFixed(0)}% → N reduced ${Math.round((1 - nAdj.factor) * 100)}%`,
                severity: nAdj.severity || 'watch',
                reference: nAdj.reference || 'Bell & Danneberger (1999), Beard (1973)',
                kBoost: CONFIG.shadeKBoostFactor,
                feBoost: CONFIG.shadeFeBoostFactor
            };
        }

        // Fallback: calculate from deficit percentage using the same thresholds
        // as shade-engine.js N_REDUCTION_FACTORS
        const factor = calculateNFactorFromDeficit(deficitPct);
        const adjustedN = Math.round(userAnnualN * factor);

        return {
            originalN: userAnnualN,
            adjustedN: adjustedN,
            factor: factor,
            reductionPct: Math.round((1 - factor) * 100),
            deficitPct: deficitPct,
            applied: factor < 1.0,
            label: factor < 0.7 ? 'Significant reduction' : (factor < 1.0 ? 'Moderate reduction' : 'Full rate'),
            reason: factor < 1.0
                ? `DLI deficit ${deficitPct.toFixed(0)}% reduces N utilisation capacity by ${Math.round((1 - factor) * 100)}%`
                : 'Adequate light for full N programme',
            severity: factor < 0.7 ? 'concern' : (factor < 1.0 ? 'watch' : 'good'),
            reference: 'Bell & Danneberger (1999), Beard (1973)',
            kBoost: factor < 1.0 ? CONFIG.shadeKBoostFactor : 1.0,
            feBoost: factor < 1.0 ? CONFIG.shadeFeBoostFactor : 1.0
        };
    }

    /**
     * Fallback N factor calculation matching shade-engine.js thresholds.
     * Used when shade engine's nAdjustment isn't available in the data.
     */
    function calculateNFactorFromDeficit(deficitPct) {
        if (deficitPct <= 15) return 1.00;
        if (deficitPct <= 25) return 0.85;
        if (deficitPct <= 40) return 0.70;
        if (deficitPct <= 55) return 0.55;
        return 0.50;
    }


    /* ========================================================================
       C. NUTRIENT DEMAND ENGINE THRESHOLD ADJUSTMENT
       
       The nutrient demand engine (nutrient-demand-engine.js) adjusts MLSN
       thresholds upward when N rate is high (because high N → more clippings
       → faster nutrient depletion).
       
       Under shade, N is reduced, so clipping yield drops. This means the
       threshold adjustment should be recalculated at the shade-adjusted N
       rate, not the original.
       
       Additionally, under shade:
       - K demand stays higher relative to N (stress tolerance)
       - Fe demand increases (chlorophyll upregulation)
       
       We provide a function that wraps the demand engine's
       calculateAdjustedThresholds() with shade context.
    ======================================================================== */

    /**
     * Recalculate adjusted thresholds accounting for shade-reduced N.
     *
     * @param {number} originalNRate - User's original annual N (kg/ha/year)
     * @param {Object} shadeData - shade engine output
     * @param {string} context - 'greens' or 'sports'
     * @param {string} methodology - 'mlsn' or 'slan'
     * @returns {Object} Adjusted thresholds with shade context
     */
    function calculateShadeAdjustedThresholds(originalNRate, shadeData, context, methodology) {
        if (!CONFIG.adjustDemandThresholds) {
            return { applied: false, reason: 'Shade threshold adjustment disabled' };
        }

        const demandEngine = global.GilbaNutrientDemandEngine;
        if (!demandEngine || typeof demandEngine.calculateAdjustedThresholds !== 'function') {
            return { applied: false, reason: 'Nutrient demand engine not loaded' };
        }

        // Get shade-adjusted N rate
        const nAdj = adjustAnnualNForShade(originalNRate, shadeData);
        
        // Calculate thresholds at the ADJUSTED N rate
        const shadedThresholds = demandEngine.calculateAdjustedThresholds(
            nAdj.adjustedN,
            context,
            methodology
        );

        // Calculate what thresholds would be at ORIGINAL N rate (for comparison)
        const originalThresholds = demandEngine.calculateAdjustedThresholds(
            originalNRate,
            context,
            methodology
        );

        // Apply K and Fe boosts for shade stress tolerance
        if (nAdj.applied && shadedThresholds.adjustedThresholds) {
            const adj = shadedThresholds.adjustedThresholds;
            
            // K boost under shade
            if (adj.K) {
                const baseK = adj.K;
                adj.K = Math.round(baseK * CONFIG.shadeKBoostFactor);
                shadedThresholds.adjustments.K.shadeBoost = {
                    factor: CONFIG.shadeKBoostFactor,
                    original: baseK,
                    adjusted: adj.K,
                    reason: 'K demand elevated under shade for stress tolerance and disease resistance',
                    reference: 'Beard (1973), Christians et al. (2016)'
                };
            }
            
            // Fe boost under shade
            if (adj.Fe) {
                const baseFe = adj.Fe;
                adj.Fe = Math.round(baseFe * CONFIG.shadeFeBoostFactor * 10) / 10;
                shadedThresholds.adjustments.Fe = {
                    ...(shadedThresholds.adjustments.Fe || {}),
                    shadeBoost: {
                        factor: CONFIG.shadeFeBoostFactor,
                        original: baseFe,
                        adjusted: adj.Fe,
                        reason: 'Fe demand elevated under shade for chlorophyll upregulation',
                        reference: 'Beard (1973), Hull (2000)'
                    }
                };
            }
        }

        return {
            applied: nAdj.applied,
            originalNRate: originalNRate,
            adjustedNRate: nAdj.adjustedN,
            nReductionPct: nAdj.reductionPct,
            shadedThresholds: shadedThresholds,
            originalThresholds: originalThresholds,
            shadeContext: {
                deficitPct: nAdj.deficitPct,
                nFactor: nAdj.factor,
                kBoost: CONFIG.shadeKBoostFactor,
                feBoost: CONFIG.shadeFeBoostFactor
            },
            methodology: methodology || 'mlsn',
            note: nAdj.applied
                ? `Thresholds recalculated at shade-adjusted N rate (${nAdj.adjustedN} vs ${originalNRate} kg/ha/yr). ` +
                  `K and Fe thresholds boosted for shade stress tolerance.`
                : 'No shade adjustment needed, adequate light.',
            reference: 'Bell & Danneberger (1999), Beard (1973), Kussow et al. (2012)'
        };
    }


    /* ========================================================================
       D. EVENT WIRING & INTEGRATION HOOKS
       
       Listen for shade changes and trigger downstream recalculations.
       Patch the nutrition calendar's generate() to include shade context.
    ======================================================================== */

    /**
     * Extract shade growth modifier from various data shapes.
     * The shade data can come from shade-engine.js or shade-orchestrator.js
     * and the property names differ slightly.
     */
    function getShadeGrowthModifier(shadeData) {
        if (!shadeData) return 1.0;

        // shade-orchestrator format
        if (typeof shadeData.growth_modifier === 'number') return shadeData.growth_modifier;

        // shade-engine format (via cascade-orchestrator)
        if (shadeData.modular && typeof shadeData.modular.growthModifier === 'number') {
            return shadeData.modular.growthModifier;
        }

        // Direct from shade engine result
        if (typeof shadeData.growthModifier === 'number') return shadeData.growthModifier;

        // Calculate from deficit if we have it
        const deficitPct = getShadeDeficitPct(shadeData);
        if (deficitPct > 0) {
            // Mirror shade-orchestrator's calculateGrowthModifier logic
            // but simplified since we don't have species thresholds here
            if (deficitPct <= 10) return 1.0;
            if (deficitPct <= 25) return 0.85;
            if (deficitPct <= 40) return 0.65;
            if (deficitPct <= 60) return 0.45;
            return 0.25;
        }

        return 1.0;
    }

    /**
     * Extract DLI deficit percentage from various data shapes.
     */
    function getShadeDeficitPct(shadeData) {
        if (!shadeData) return 0;
        if (typeof shadeData.deficitPct === 'number') return shadeData.deficitPct;
        if (typeof shadeData.deficit_pct === 'number') return shadeData.deficit_pct;
        if (shadeData.modular && typeof shadeData.modular.deficitPct === 'number') {
            return shadeData.modular.deficitPct;
        }
        return 0;
    }

    /**
     * Get current shade data from the hub state.
     */
    function getCurrentShadeData() {
        // Try cascade orchestrator computed state
        const hubState = global._gsshHubState || global.GSSH_STATE || {};
        if (hubState.computed && hubState.computed.shade) {
            return hubState.computed.shade;
        }

        // Try shade orchestrator's cached result
        if (global.GSSH_ShadeOrchestrator && global.GSSH_ShadeOrchestrator.currentShade) {
            return global.GSSH_ShadeOrchestrator.currentShade;
        }

        // Try last shade engine result
        if (global.__gssh_lastShadeResult) {
            return global.__gssh_lastShadeResult;
        }

        return null;
    }

    /**
     * Patch the NutritionCalendar to incorporate shade adjustments.
     * This wraps the existing generate() method to inject shade context.
     */
    function patchNutritionCalendar() {
        // Wait for NutritionCalendar to be available
        if (!global.NutritionCalendar) {
            log('patch', 'NutritionCalendar not yet loaded, deferring patch');
            return false;
        }

        const NC = global.NutritionCalendar;

        // Don't patch twice
        if (NC._shadePatchApplied) {
            log('patch', 'Already patched');
            return true;
        }

        // Store original methods
        const originalCalculateMonthlyGP = NC.calculateMonthlyGP.bind(NC);
        const originalGenerate = NC.generate.bind(NC);

        // === PATCH 1: calculateMonthlyGP — apply shade modifier ===
        NC.calculateMonthlyGP = function(monthlyTemps, isC4) {
            const baseGP = originalCalculateMonthlyGP(monthlyTemps, isC4);

            if (!CONFIG.adjustCalendarGP) return baseGP;

            const shadeData = getCurrentShadeData();
            const result = adjustMonthlyGPForShade(baseGP, shadeData);

            if (result.applied) {
                log('patchGP', `Shade-adjusted monthly GP (modifier: ${result.modifier.toFixed(2)})`, {
                    reason: result.reason,
                    jan_base: (baseGP[0] || 0).toFixed(3),
                    jan_adjusted: result.adjustedGP[0].toFixed(3)
                });

                // Store shade GP metadata for rendering
                NC._shadeGPAdjustment = result;

                return result.adjustedGP;
            }

            NC._shadeGPAdjustment = null;
            return baseGP;
        };

        // === PATCH 2: generate — add shade metadata to program output ===
        const originalGenerateRef = NC.generate;
        NC.generate = function() {
            // Run the original generation (which now uses shade-adjusted GP)
            const program = originalGenerateRef.call(this);

            if (!program) return program;

            // Append shade context to the program
            const shadeData = getCurrentShadeData();
            if (shadeData) {
                const nAdj = adjustAnnualNForShade(
                    program.adjustments?.target_n || program.annual_totals?.N,
                    shadeData
                );

                program.shade = {
                    applied: nAdj.applied,
                    gpAdjustment: NC._shadeGPAdjustment || null,
                    nAdjustment: nAdj,
                    deficitPct: getShadeDeficitPct(shadeData),
                    growthModifier: getShadeGrowthModifier(shadeData),
                    kBoostApplied: nAdj.applied ? CONFIG.shadeKBoostFactor : 1.0,
                    feBoostApplied: nAdj.applied ? CONFIG.shadeFeBoostFactor : 1.0,
                    note: nAdj.applied
                        ? `⚠️ Shade adjustment: N programme reduced from ${nAdj.originalN} to ${nAdj.adjustedN} kg/ha/yr ` +
                          `(${nAdj.reductionPct}% reduction). Monthly GP distribution also shade-adjusted. ` +
                          `K and Fe demand elevated for shade tolerance.`
                        : 'Adequate light, no shade adjustment applied.',
                    reference: 'Bell & Danneberger (1999), Beard (1973), Stier & Gardner (2008)'
                };

                if (nAdj.applied) {
                    log('generate', 'Shade context appended to nutrition program', program.shade);
                }
            }

            return program;
        };

        NC._shadePatchApplied = true;
        log('patch', 'NutritionCalendar patched for shade integration');
        return true;
    }

    /**
     * Set up event listeners for shade changes to trigger nutrition updates.
     */
    function setupEventListeners() {
        // When shade analysis completes, flag that nutrition should recalculate
        document.addEventListener('gssh:shadeOrchestratorComplete', function(e) {
            log('event', 'Shade analysis completed, nutrition recalculation available');

            // Store latest shade result for the patch to pick up
            if (e.detail) {
                global.__gssh_lastShadeResult = e.detail;
            }

            // Dispatch nutrition hint event
            document.dispatchEvent(new CustomEvent('gssh:shadeNutritionUpdate', {
                detail: {
                    trigger: 'shade_change',
                    shadeData: e.detail,
                    growthModifier: getShadeGrowthModifier(e.detail),
                    deficitPct: getShadeDeficitPct(e.detail),
                    nFactor: calculateNFactorFromDeficit(getShadeDeficitPct(e.detail)),
                    message: 'Shade data updated, regenerate nutrition calendar to apply shade adjustments'
                }
            }));
        });

        // When shade context updates (more granular events)
        document.addEventListener('gssh:shadeContextUpdate', function(e) {
            if (e.detail && typeof e.detail.growthModifier === 'number') {
                log('event', `Shade context updated: growth modifier = ${e.detail.growthModifier.toFixed(2)}`);
            }
        });

        // Add nutrition to the selective compute engine list
        document.addEventListener('gssh:selectiveComputeComplete', function(e) {
            if (e.detail && e.detail.trigger === 'shade') {
                // Original list: ['disease', 'stress', 'wear', 'irrigation', 'pgr']
                // We flag that nutrition should also refresh
                log('event', 'Selective compute from shade, nutrition refresh recommended');
            }
        });

        log('events', 'Event listeners registered');
    }

    /* ========================================================================
       E. RENDER HELPERS
       
       UI components for displaying shade-nutrition adjustments.
       These can be injected into the nutrition calendar or progressive
       disclosure panels.
    ======================================================================== */

    /**
     * Render a shade adjustment banner for the nutrition calendar.
     * Shows the user what shade is doing to their nutrition programme.
     *
     * @param {Object} shadeContext - program.shade from the patched generate()
     * @returns {string} HTML string
     */
    function renderShadeNutritionBanner(shadeContext) {
        if (!shadeContext || !shadeContext.applied) {
            return '';
        }

        const nAdj = shadeContext.nAdjustment;
        const gpAdj = shadeContext.gpAdjustment;
        const severity = nAdj.severity === 'concern' ? '#dc2626' : '#d97706';
        const bg = nAdj.severity === 'concern' ? 'var(--gaip-critical-bg)' : 'var(--gaip-warning-bg)';
        const icon = nAdj.severity === 'concern' ? '🔴' : '⚠️';

        let html = `
            <div class="gssh-shade-nutrition-banner" style="
                margin: 12px 0; padding: 12px; 
                background: ${bg}; 
                border-left: 4px solid ${severity}; 
                border-radius: 6px;
            ">
                <div style="font-weight: 600; color: ${severity}; margin-bottom: 8px;">
                    ${icon} Shade-Adjusted Nutrition Programme
                </div>
                <div style="font-size: 12px; color: var(--gaip-text); margin-bottom: 8px;">
                    DLI deficit of ${nAdj.deficitPct.toFixed(0)}% reduces photosynthetic capacity 
                    and N utilisation. Applying full N under shade promotes weak, etiolated growth 
                    with increased disease susceptibility.
                </div>
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); gap: 8px; margin-bottom: 8px;">
                    <div style="padding: 8px; background: rgba(255,255,255,0.05); border-radius: 4px; text-align: center;">
                        <div style="font-size: 18px; font-weight: 600; color: ${severity};">${nAdj.originalN} → ${nAdj.adjustedN}</div>
                        <div style="font-size: 10px; color: var(--gaip-text-secondary);">N kg/ha/yr</div>
                    </div>`;

        if (gpAdj && gpAdj.applied) {
            html += `
                    <div style="padding: 8px; background: rgba(255,255,255,0.05); border-radius: 4px; text-align: center;">
                        <div style="font-size: 18px; font-weight: 600; color: ${severity};">${Math.round((1 - gpAdj.modifier) * 100)}%</div>
                        <div style="font-size: 10px; color: var(--gaip-text-secondary);">GP reduction</div>
                    </div>`;
        }

        if (shadeContext.kBoostApplied > 1) {
            html += `
                    <div style="padding: 8px; background: rgba(255,255,255,0.05); border-radius: 4px; text-align: center;">
                        <div style="font-size: 18px; font-weight: 600; color: #059669;">+${Math.round((shadeContext.kBoostApplied - 1) * 100)}%</div>
                        <div style="font-size: 10px; color: var(--gaip-text-secondary);">K boost (stress)</div>
                    </div>`;
        }

        if (shadeContext.feBoostApplied > 1) {
            html += `
                    <div style="padding: 8px; background: rgba(255,255,255,0.05); border-radius: 4px; text-align: center;">
                        <div style="font-size: 18px; font-weight: 600; color: #059669;">+${Math.round((shadeContext.feBoostApplied - 1) * 100)}%</div>
                        <div style="font-size: 10px; color: var(--gaip-text-secondary);">Fe boost (chlorophyll)</div>
                    </div>`;
        }

        html += `
                </div>
                <div style="font-size: 10px; color: var(--gaip-text-secondary); border-top: 1px solid var(--gaip-border); padding-top: 6px;">
                    ${nAdj.reference}
                </div>
            </div>`;

        return html;
    }

    /* ========================================================================
       F. CASCADE ORCHESTRATOR HOOK
       
       Provides a function the cascade orchestrator can call to get
       shade-adjusted nutrition data in a single call.
    ======================================================================== */

    /**
     * One-shot function for the cascade orchestrator to get shade-adjusted
     * nutrition context. Call after shade engine has run.
     *
     * @param {Object} state - Hub state
     * @param {Object} shadeResult - Output from shade engine
     * @returns {Object} Shade-nutrition integration result
     */
    function computeShadeNutritionContext(state, shadeResult) {
        if (!shadeResult) {
            return { applied: false, reason: 'No shade result' };
        }

        const nRate = parseFloat(state?.turf?.nProgramKgHaYr) ||
                      parseFloat(state?.fertility?.annualN) ||
                      200;

        const context = state?.soil?.surfaceType || 'sports';
        const methodology = state?.soil?.methodology || 'mlsn';

        const nAdjustment = adjustAnnualNForShade(nRate, shadeResult);
        const gpResult = adjustMonthlyGPForShade(
            // Use climate GP if available, otherwise temperature-estimated
            global.climateMetrics?.growth?.dailyPattern?.reduce((acc, d, i) => {
                const month = new Date(d.date).getMonth();
                if (!acc[month] || d.weighted > acc[month]) {
                    acc[month] = d.weighted / 100;
                }
                return acc;
            }, {}) || {},
            shadeResult
        );

        let thresholdResult = null;
        if (CONFIG.adjustDemandThresholds) {
            thresholdResult = calculateShadeAdjustedThresholds(
                nRate, shadeResult, context, methodology
            );
        }

        return {
            applied: nAdjustment.applied,
            nAdjustment: nAdjustment,
            gpAdjustment: gpResult,
            thresholdAdjustment: thresholdResult,
            summary: nAdjustment.applied
                ? {
                    nReduction: `${nAdjustment.reductionPct}% (${nRate} → ${nAdjustment.adjustedN} kg/ha/yr)`,
                    gpModifier: gpResult.modifier.toFixed(2),
                    kBoost: `+${Math.round((CONFIG.shadeKBoostFactor - 1) * 100)}%`,
                    feBoost: `+${Math.round((CONFIG.shadeFeBoostFactor - 1) * 100)}%`
                }
                : { message: 'Adequate light, no adjustment' },
            reference: 'Bell & Danneberger (1999), Beard (1973), Stier & Gardner (2008), Cockerham et al. (2004)',
            hpsLedTransitionWarning: (function() {
                // Detect HPS→LED switch without IR heater. HPS delivers substantial radiant heat
                // that elevates canopy temperature and drives cation uptake. LED systems produce
                // negligible radiant heat; Ca and K uptake efficiency can drop post-transition.
                // Monitor tissue for 2–4 weeks (Pinho 2017).
                var stadium = state && state.stadium ? state.stadium : {};
                var prevType = (stadium.previousEquipmentType || stadium.prevLightType || '').toUpperCase();
                var currType = (stadium.equipmentType || stadium.lightType || '').toUpperCase();
                var isHPStoLED = prevType.indexOf('HPS') >= 0 && currType.indexOf('LED') >= 0;
                if (!isHPStoLED) return null;
                var hasIR = !!(stadium.hasIRHeater || stadium.irHeaterInstalled);
                if (hasIR) return null;
                return {
                    active: true,
                    severity: 'watch',
                    message: 'HPS-to-LED transition detected without an IR heater on record. ' +
                        'HPS lamps deliver significant radiant heat that elevates canopy temperature ' +
                        'and drives transpiration-linked Ca and K uptake. LED systems produce ' +
                        'negligible radiant heat, reducing canopy temperature and potentially ' +
                        'suppressing Ca and K uptake efficiency in the weeks following transition. ' +
                        'Monitor tissue Ca and K for 2–4 weeks post-transition and be prepared to ' +
                        'adjust fertiliser programme if deficiency symptoms appear (Pinho 2017).',
                    monitorNutrients: ['Ca', 'K'],
                    monitorPeriodWeeks: '2–4',
                    citation: 'Pinho 2017'
                };
            })()
        };
    }


    /* ========================================================================
       INITIALISATION
    ======================================================================== */

    function init() {
        log('init', `Shade ↔ Nutrition Integration v${VERSION} initialising`);

        setupEventListeners();

        // Attempt to patch NutritionCalendar (may need to retry)
        if (!patchNutritionCalendar()) {
            // Retry when NutritionCalendar loads
            document.addEventListener('gssh:nutrition-calendar-ready', function() {
                patchNutritionCalendar();
            });

            // Also retry on DOMContentLoaded
            if (document.readyState === 'loading') {
                document.addEventListener('DOMContentLoaded', function() {
                    setTimeout(patchNutritionCalendar, 500);
                });
            } else {
                setTimeout(patchNutritionCalendar, 500);
            }
        }

        log('init', 'Ready');
    }

    /* ========================================================================
       EXPORTS
    ======================================================================== */

    const ShadeNutritionIntegration = {
        version: VERSION,

        // Core functions
        adjustMonthlyGPForShade: adjustMonthlyGPForShade,
        adjustAnnualNForShade: adjustAnnualNForShade,
        calculateShadeAdjustedThresholds: calculateShadeAdjustedThresholds,
        computeShadeNutritionContext: computeShadeNutritionContext,

        // Helpers
        getShadeGrowthModifier: getShadeGrowthModifier,
        getShadeDeficitPct: getShadeDeficitPct,
        getCurrentShadeData: getCurrentShadeData,
        calculateNFactorFromDeficit: calculateNFactorFromDeficit,

        // Rendering
        renderShadeNutritionBanner: renderShadeNutritionBanner,

        // Patching
        patchNutritionCalendar: patchNutritionCalendar,

        // Config (allow runtime adjustment)
        CONFIG: CONFIG,

        // Initialise
        init: init
    };

    global.GSSH_ShadeNutritionIntegration = ShadeNutritionIntegration;

    // Auto-init
    init();

    console.log(`✅ Shade ↔ Nutrition Integration v${VERSION} loaded`);

})(typeof self !== 'undefined' ? self : this);
