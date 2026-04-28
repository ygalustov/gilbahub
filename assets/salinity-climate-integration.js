/**
 * Gilba Salinity Climate Integration v1.0
 * 
 * Enhances salinity-penalty.js with temperature-dependent adjustments
 * 
 * Key interactions:
 * - High temperatures increase ET, concentrating salts in root zone
 * - Temperature stress + salinity stress compound (not additive)
 * - Effective EC thresholds shift lower under heat stress
 * - Cool conditions provide higher salt tolerance
 * 
 * Data Sources:
 * - Maas & Hoffman (1977) - base salinity tolerance
 * - Carrow & Duncan (1998) - temperature interactions
 * - Harivandi et al. (1992) - turfgrass salinity management
 * - Marcum (2006) - warm-season grass salinity tolerance
 * 
 * Integrates with: window.climateMetrics from climate-module-v2
 */

(function() {
    'use strict';

    // =========================================================================
    // TEMPERATURE-SALINITY INTERACTION COEFFICIENTS
    // =========================================================================
    
    /**
     * Temperature modification factors for salinity tolerance
     * 
     * At higher temperatures:
     * - ET increases, concentrating salts faster
     * - Plant stress response compromised
     * - Root zone accumulation accelerates
     * 
     * These coefficients modify the effective EC threshold
     * Coefficient > 1 = more tolerant, < 1 = less tolerant
     * 
     * Reference: Carrow & Duncan (1998), Salt-Affected Turfgrass Sites
     */
    var TEMP_SALINITY_MODIFIERS = {
        C3: [
            { minTemp: -999, maxTemp: 10, modifier: 1.15, note: 'Cool conditions - enhanced tolerance' },
            { minTemp: 10, maxTemp: 15, modifier: 1.10, note: 'Optimal cool-season temps' },
            { minTemp: 15, maxTemp: 22, modifier: 1.00, note: 'Reference conditions' },
            { minTemp: 22, maxTemp: 26, modifier: 0.90, note: 'Mild heat - reduced tolerance' },
            { minTemp: 26, maxTemp: 30, modifier: 0.75, note: 'Heat stress - significantly reduced tolerance' },
            { minTemp: 30, maxTemp: 35, modifier: 0.55, note: 'Severe heat - salinity damage accelerated' },
            { minTemp: 35, maxTemp: 999, modifier: 0.40, note: 'Critical heat - minimal salinity tolerance' }
        ],
        C4: [
            { minTemp: -999, maxTemp: 15, modifier: 0.85, note: 'Cool stress - reduced tolerance' },
            { minTemp: 15, maxTemp: 20, modifier: 0.95, note: 'Sub-optimal temps' },
            { minTemp: 20, maxTemp: 30, modifier: 1.00, note: 'Reference conditions' },
            { minTemp: 30, maxTemp: 35, modifier: 0.90, note: 'Mild heat - slight reduction' },
            { minTemp: 35, maxTemp: 40, modifier: 0.75, note: 'Heat stress - reduced tolerance' },
            { minTemp: 40, maxTemp: 999, modifier: 0.60, note: 'Extreme heat - significantly compromised' }
        ]
    };

    // =========================================================================
    // ET-BASED CONCENTRATION FACTORS
    // =========================================================================
    
    /**
     * ET multipliers for salt concentration in root zone
     * 
     * Higher ET = faster concentration of salts
     * Lower ET = slower accumulation
     * 
     * ET is primarily driven by:
     * - Temperature
     * - Humidity
     * - Wind
     * - Solar radiation
     * 
     * This simplified model uses temperature as primary driver
     */
    var ET_CONCENTRATION_FACTORS = {
        // mm/day reference ET at various temps (Penman-Monteith approximation)
        referenceET: 5.0,  // mm/day at ~25°C, moderate conditions
        
        // Temperature-based ET multipliers
        tempETMultipliers: [
            { minTemp: -999, maxTemp: 10, multiplier: 0.4 },
            { minTemp: 10, maxTemp: 15, multiplier: 0.6 },
            { minTemp: 15, maxTemp: 20, multiplier: 0.8 },
            { minTemp: 20, maxTemp: 25, multiplier: 1.0 },
            { minTemp: 25, maxTemp: 30, multiplier: 1.3 },
            { minTemp: 30, maxTemp: 35, multiplier: 1.6 },
            { minTemp: 35, maxTemp: 40, multiplier: 1.9 },
            { minTemp: 40, maxTemp: 999, multiplier: 2.2 }
        ]
    };

    // =========================================================================
    // COMPOUND STRESS CALCULATIONS
    // =========================================================================
    
    /**
     * Compound stress multiplier
     * 
     * When multiple stresses combine, the effect is greater than additive
     * This follows a synergistic model based on:
     * - Mittler (2006) - Abiotic stress combinations
     * - Munns & Tester (2008) - Salinity tolerance mechanisms
     * 
     * Formula: CompoundEffect = 1 - (1-stress1) * (1-stress2) * interaction_factor
     */
    var COMPOUND_STRESS_CONFIG = {
        // Interaction factor: 1.0 = purely multiplicative, >1.0 = synergistic
        tempSalinityInteraction: 1.25,  // 25% synergistic penalty
        
        // Threshold below which stresses are considered negligible
        negligibleStress: 0.05
    };

    // =========================================================================
    // CORE CALCULATION FUNCTIONS
    // =========================================================================

    /**
     * Get temperature modifier for salinity tolerance
     */
    function getTempSalinityModifier(temperature, grassType) {
        var type = (grassType || 'C3').toUpperCase();
        var modifiers = TEMP_SALINITY_MODIFIERS[type] || TEMP_SALINITY_MODIFIERS['C3'];
        
        for (var i = 0; i < modifiers.length; i++) {
            var range = modifiers[i];
            if (temperature >= range.minTemp && temperature < range.maxTemp) {
                return {
                    modifier: range.modifier,
                    note: range.note
                };
            }
        }
        
        return { modifier: 1.0, note: 'Default conditions' };
    }

    /**
     * Get ET concentration factor based on temperature
     */
    function getETConcentrationFactor(temperature) {
        var factors = ET_CONCENTRATION_FACTORS.tempETMultipliers;
        
        for (var i = 0; i < factors.length; i++) {
            var range = factors[i];
            if (temperature >= range.minTemp && temperature < range.maxTemp) {
                return {
                    etMultiplier: range.multiplier,
                    estimatedET: ET_CONCENTRATION_FACTORS.referenceET * range.multiplier
                };
            }
        }
        
        return { etMultiplier: 1.0, estimatedET: ET_CONCENTRATION_FACTORS.referenceET };
    }

    /**
     * Calculate temperature-adjusted effective EC
     * 
     * Under heat stress, the same EC causes more damage
     * This calculates the "effective" EC the plant experiences
     */
    function calculateEffectiveEC(measuredEC, temperature, grassType) {
        var tempMod = getTempSalinityModifier(temperature, grassType);
        
        // Effective EC = measured EC / tolerance modifier
        // When modifier < 1, effective EC increases (more damaging)
        var effectiveEC = measuredEC / tempMod.modifier;
        
        return {
            measured: measuredEC,
            effective: Math.round(effectiveEC * 100) / 100,
            modifier: tempMod.modifier,
            note: tempMod.note,
            increase: tempMod.modifier < 1 
                ? Math.round((1 / tempMod.modifier - 1) * 100) + '% more damaging'
                : tempMod.modifier > 1 
                    ? Math.round((1 - 1 / tempMod.modifier) * 100) + '% less damaging'
                    : 'Reference conditions'
        };
    }

    /**
     * Calculate temperature-adjusted salinity threshold
     * 
     * This adjusts the Maas-Hoffman threshold based on temperature
     */
    function calculateAdjustedThreshold(baseThreshold, temperature, grassType) {
        var tempMod = getTempSalinityModifier(temperature, grassType);
        
        // Adjusted threshold = base threshold * modifier
        // When modifier < 1, threshold decreases (plant less tolerant)
        var adjustedThreshold = baseThreshold * tempMod.modifier;
        
        return {
            base: baseThreshold,
            adjusted: Math.round(adjustedThreshold * 100) / 100,
            modifier: tempMod.modifier,
            note: tempMod.note
        };
    }

    /**
     * Calculate compound stress effect
     * 
     * Combines temperature stress and salinity stress
     * using synergistic model
     */
    function calculateCompoundStress(temperatureStress, salinityStress) {
        var config = COMPOUND_STRESS_CONFIG;
        
        // Normalize stress values (0-1)
        var tStress = Math.max(0, Math.min(1, temperatureStress || 0));
        var sStress = Math.max(0, Math.min(1, salinityStress || 0));
        
        // If either stress is negligible, use simpler calculation
        if (tStress < config.negligibleStress && sStress < config.negligibleStress) {
            return {
                compound: 0,
                individual: { temperature: tStress, salinity: sStress },
                synergy: 0,
                severity: 'none'
            };
        }
        
        // Multiplicative combination with synergy factor
        var multiplicative = 1 - (1 - tStress) * (1 - sStress);
        var synergisticBoost = tStress * sStress * (config.tempSalinityInteraction - 1);
        var compoundStress = Math.min(1, multiplicative + synergisticBoost);
        
        // Determine severity
        var severity;
        if (compoundStress < 0.15) {
            severity = 'mild';
        } else if (compoundStress < 0.30) {
            severity = 'moderate';
        } else if (compoundStress < 0.50) {
            severity = 'significant';
        } else if (compoundStress < 0.70) {
            severity = 'severe';
        } else {
            severity = 'critical';
        }
        
        return {
            compound: Math.round(compoundStress * 100) / 100,
            individual: {
                temperature: Math.round(tStress * 100) / 100,
                salinity: Math.round(sStress * 100) / 100
            },
            synergy: Math.round(synergisticBoost * 100) / 100,
            severity: severity,
            percentReduction: Math.round(compoundStress * 100)
        };
    }

    /**
     * Calculate root zone salt accumulation rate
     * 
     * Based on ET rate and irrigation water quality
     */
    function calculateAccumulationRate(waterEC, irrigationMM, temperature) {
        var etFactor = getETConcentrationFactor(temperature);
        
        // Daily salt load = EC (dS/m) * irrigation (mm) * 0.64 (conversion to kg/ha)
        var dailySaltLoad = waterEC * irrigationMM * 0.64;
        
        // Net accumulation depends on ET (salts left behind when water evaporates)
        // and leaching fraction
        var etMM = etFactor.estimatedET;
        var netAccumulation = dailySaltLoad * (etMM / irrigationMM);
        
        return {
            dailySaltLoadKgHa: Math.round(dailySaltLoad * 10) / 10,
            etMM: Math.round(etMM * 10) / 10,
            netAccumulationKgHa: Math.round(netAccumulation * 10) / 10,
            concentrationFactor: Math.round((etMM / irrigationMM) * 100) / 100,
            note: etFactor.etMultiplier > 1.2 
                ? 'High ET accelerating salt accumulation'
                : 'Normal accumulation rate'
        };
    }

    /**
     * Calculate adjusted leaching requirement
     * 
     * Higher temperatures require more leaching to maintain
     * acceptable soil salinity levels
     */
    function calculateAdjustedLeachingRequirement(baseLR, temperature, grassType) {
        var tempMod = getTempSalinityModifier(temperature, grassType);
        var etFactor = getETConcentrationFactor(temperature);
        
        // Adjust LR for temperature effects:
        // 1. Tolerance reduction requires lower soil EC target
        // 2. Higher ET concentrates salts faster
        
        var toleranceAdjustment = 1 / tempMod.modifier;
        var etAdjustment = etFactor.etMultiplier;
        
        var adjustedLR = baseLR * toleranceAdjustment * Math.sqrt(etAdjustment);
        
        // Cap at practical maximum
        adjustedLR = Math.min(0.40, adjustedLR);
        
        return {
            baseLR: Math.round(baseLR * 100),
            adjustedLR: Math.round(adjustedLR * 100),
            toleranceAdjustment: Math.round(toleranceAdjustment * 100) / 100,
            etAdjustment: Math.round(etAdjustment * 100) / 100,
            percentIncrease: Math.round((adjustedLR / baseLR - 1) * 100),
            note: adjustedLR > baseLR * 1.2 
                ? 'Significant increase in leaching needed due to temperature conditions'
                : 'Standard leaching requirement'
        };
    }

    // =========================================================================
    // INTEGRATION WITH EXISTING SALINITY PENALTY
    // =========================================================================

    /**
     * Enhance base salinity penalty with climate data
     */
    function enhanceSalinityPenalty(basePenalty, climateData, speciesConfig) {
        if (!basePenalty) {
            return null;
        }
        
        // Extract temperature from climate data
        var temperature = 25; // Default reference temp
        
        if (climateData) {
            if (typeof climateData.airTemp === 'number') {
                temperature = climateData.airTemp;
            } else if (climateData.current && typeof climateData.current.temperature === 'number') {
                temperature = climateData.current.temperature;
            }
        }
        
        // Determine grass type
        var grassType = 'C3';
        if (speciesConfig) {
            if (speciesConfig.c4Fraction > 0.5) {
                grassType = 'C4';
            } else if (speciesConfig.grassType) {
                grassType = speciesConfig.grassType.toUpperCase();
            }
        }
        
        // Calculate temperature adjustments
        var tempMod = getTempSalinityModifier(temperature, grassType);
        var ecw = basePenalty.ecw || basePenalty.ec || 0;
        var effectiveEC = calculateEffectiveEC(ecw, temperature, grassType);
        
        // Calculate compound stress if base penalty includes growth reduction
        var baseReduction = basePenalty.reductionPercent || basePenalty.reduction || 0;
        var temperatureStress = tempMod.modifier < 1 ? (1 - tempMod.modifier) : 0;
        var salinityStress = baseReduction / 100;
        
        var compoundStress = calculateCompoundStress(temperatureStress, salinityStress);
        
        // Adjust threshold
        var adjustedThreshold = null;
        if (basePenalty.threshold) {
            adjustedThreshold = calculateAdjustedThreshold(basePenalty.threshold, temperature, grassType);
        }
        
        // Calculate adjusted leaching requirement if available
        var adjustedLR = null;
        if (basePenalty.leachingRequirement) {
            adjustedLR = calculateAdjustedLeachingRequirement(
                basePenalty.leachingRequirement / 100,
                temperature,
                grassType
            );
        }
        
        return {
            // Base values (preserve original)
            basePenalty: {
                ec: ecw,
                reduction: baseReduction,
                threshold: basePenalty.threshold,
                status: basePenalty.status
            },
            
            // Temperature context
            temperature: temperature,
            grassType: grassType,
            temperatureModifier: {
                value: tempMod.modifier,
                note: tempMod.note
            },
            
            // Climate-adjusted values
            effectiveEC: effectiveEC,
            adjustedThreshold: adjustedThreshold,
            adjustedLeachingRequirement: adjustedLR,
            
            // Compound stress
            compoundStress: compoundStress,
            
            // Adjusted recommendation
            adjustedReduction: Math.round(compoundStress.compound * 100),
            
            // Overall assessment
            climateImpact: assessClimateImpact(tempMod.modifier, compoundStress.compound, baseReduction),
            
            // Management recommendations
            recommendations: generateSalinityRecommendations(
                effectiveEC,
                compoundStress,
                adjustedLR,
                temperature,
                grassType
            ),
            
            // Weather data source status
            weatherStatus: (function() {
                if (typeof window.GAIP_WeatherResilience !== 'undefined') {
                    var status = window.GAIP_WeatherResilience.getStatus();
                    return {
                        status: status.status || 'unknown',
                        fetchedAt: status.fetchedAt || null,
                        cacheAge: status.cacheAge || null,
                        isLive: status.status === 'live'
                    };
                }
                return { status: 'unknown', isLive: false };
            })()
        };
    }

    /**
     * Assess overall climate impact on salinity stress
     */
    function assessClimateImpact(tempModifier, compoundStress, baseReduction) {
        var originalStress = baseReduction / 100;
        var additionalStress = compoundStress - originalStress;
        
        if (additionalStress < 0.05) {
            return {
                level: 'minimal',
                description: 'Temperature conditions have minimal impact on salinity stress.',
                additionalReduction: 0
            };
        } else if (additionalStress < 0.15) {
            return {
                level: 'moderate',
                description: 'Temperature conditions moderately increasing salinity impact.',
                additionalReduction: Math.round(additionalStress * 100)
            };
        } else if (additionalStress < 0.25) {
            return {
                level: 'significant',
                description: 'Temperature stress significantly compounding salinity damage.',
                additionalReduction: Math.round(additionalStress * 100)
            };
        } else {
            return {
                level: 'severe',
                description: 'Combined heat and salinity stress causing severe growth limitation.',
                additionalReduction: Math.round(additionalStress * 100)
            };
        }
    }

    /**
     * Generate climate-aware salinity management recommendations
     */
    function generateSalinityRecommendations(effectiveEC, compoundStress, adjustedLR, temperature, grassType) {
        var recs = [];
        
        // Temperature-specific recommendations
        if (effectiveEC.modifier < 0.85) {
            recs.push({
                priority: 'high',
                action: 'Increase irrigation frequency',
                detail: 'High temperatures reducing salt tolerance by ' + 
                    Math.round((1 - effectiveEC.modifier) * 100) + 
                    '%. More frequent, lighter irrigations will help flush salts.'
            });
        }
        
        // Compound stress recommendations
        if (compoundStress.severity === 'severe' || compoundStress.severity === 'critical') {
            recs.push({
                priority: 'urgent',
                action: 'Emergency stress management',
                detail: 'Combined heat + salinity stress at ' + compoundStress.percentReduction + 
                    '% reduction. Consider shade cloth, syringing, and temporary traffic restrictions.'
            });
        } else if (compoundStress.severity === 'significant') {
            recs.push({
                priority: 'high',
                action: 'Enhanced monitoring',
                detail: 'Significant compound stress. Monitor tissue EC and increase leaching events.'
            });
        }
        
        // Leaching requirement adjustments
        if (adjustedLR && adjustedLR.percentIncrease > 20) {
            recs.push({
                priority: 'medium',
                action: 'Increase leaching fraction',
                detail: 'Temperature conditions require ' + adjustedLR.adjustedLR + 
                    '% leaching fraction (up from ' + adjustedLR.baseLR + '% base requirement).'
            });
        }
        
        // ET-based recommendations
        if (temperature > 30) {
            recs.push({
                priority: 'medium',
                action: 'Compensate for high ET',
                detail: 'Elevated ET concentrating salts faster. Consider gypsum application and acidifying irrigation.'
            });
        }
        
        // Cool season advantage
        if (temperature < 18 && grassType === 'C3') {
            recs.push({
                priority: 'info',
                action: 'Favorable conditions',
                detail: 'Cool temperatures providing ' + Math.round((effectiveEC.modifier - 1) * 100) + 
                    '% improved salt tolerance. Good window for recovery.'
            });
        }
        
        if (recs.length === 0) {
            recs.push({
                priority: 'info',
                action: 'Standard management',
                detail: 'Current conditions within normal parameters. Continue standard salinity management.'
            });
        }
        
        return recs;
    }

    // =========================================================================
    // PUBLIC API
    // =========================================================================

    /**
     * Main function: Get climate-enhanced salinity assessment
     */
    function getClimateEnhancedSalinity(salinityConfig) {
        // Get climate data from validated climateMetrics
        var climateData = null;
        
        // Primary source: window.climateMetrics
        if (window.climateMetrics && window.climateMetrics.temperature) {
            climateData = {
                airTemp: window.climateMetrics.temperature.mean
            };
        }
        // Fallback: GAIP_STATE from state dispatch
        else if (window.GAIP_STATE && window.GAIP_STATE.climateMetrics && window.GAIP_STATE.climateMetrics.temperature) {
            climateData = {
                airTemp: window.GAIP_STATE.climateMetrics.temperature.mean
            };
        }
        
        // Get species config from GAIP_STATE
        var speciesConfig = null;
        if (window.GAIP_STATE && window.GAIP_STATE.turf && window.GAIP_STATE.turf.species) {
            speciesConfig = window.GAIP_STATE.turf.species;
        } else if (window.GAIP_STATE && window.GAIP_STATE.turf) {
            // Build species config from turf state
            var turf = window.GAIP_STATE.turf;
            var grassType = turf.grassType || turf.grassSpecies || '';
            speciesConfig = {
                grassType: grassType.toLowerCase().includes('c3') ? 'C3' : 
                           grassType.toLowerCase().includes('c4') ? 'C4' : 'C3',
                c3Fraction: turf.c3Fraction || 0,
                c4Fraction: turf.c4Fraction || 1
            };
        }
        
        // Get base salinity penalty if available
        var basePenalty = null;
        if (window.gaip_salinity_penalty && salinityConfig && salinityConfig.ec) {
            try {
                var species = salinityConfig.species || 
                              (window.GAIP_STATE && window.GAIP_STATE.turf ? window.GAIP_STATE.turf.grassSpecies : 'couch');
                basePenalty = window.gaip_salinity_penalty(salinityConfig.ec, species);
            } catch (e) {
                console.warn('Could not get base salinity calculation:', e);
            }
        }
        
        // If no base penalty, create from config
        if (!basePenalty && salinityConfig) {
            basePenalty = {
                ecw: salinityConfig.ec || salinityConfig.ecw,
                reductionPercent: salinityConfig.reduction || 0,
                threshold: salinityConfig.threshold,
                status: salinityConfig.status || 'unknown'
            };
        }
        
        if (!basePenalty) {
            return null;
        }
        
        return enhanceSalinityPenalty(basePenalty, climateData, speciesConfig);
    }

    // =========================================================================
    // STATE DISPATCH LISTENER
    // =========================================================================

    /**
     * Listen for hub state updates and recalculate
     */
    function handleStateUpdate(event) {
        var detail = event.detail;
        var state = detail ? detail.state : null;
        
        if (!state || !state.water) {
            return;
        }
        
        // Check for ECw in water data
        var ecw = state.water.ecw || state.water.ec;
        if (!ecw) {
            return;
        }
        
        var species = state.turf ? state.turf.grassSpecies : 'couch';
        
        var salinityConfig = {
            ec: ecw,
            species: species,
            threshold: state.water.salinityThreshold,
            status: state.water.salinityStatus
        };
        
        var enhanced = getClimateEnhancedSalinity(salinityConfig);
        
        if (enhanced) {
            // Dispatch enhanced result
            document.dispatchEvent(new CustomEvent('gaip:salinity-climate-update', {
                detail: enhanced
            }));
        }
    }

    // Register listener
    document.addEventListener('gaip:hub-state-update', handleStateUpdate);

    // =========================================================================
    // UI RENDERING - Climate-Enhanced Salinity Card
    // =========================================================================

    /**
     * Render climate-enhanced salinity card
     */
    /**
     * Get weather status badge HTML
     */
    function getWeatherStatusBadge(weatherStatus) {
        if (!weatherStatus || weatherStatus.status === 'unknown') {
            return '<span style="font-size: 10px; color: var(--gaip-text); margin-left: 8px;">(weather: unknown)</span>';
        }
        
        var configs = {
            'live': { icon: '●', color: '#10b981', label: 'Live' },
            'cached': { icon: '●', color: '#f59e0b', label: 'Cached' },
            'cached_stale': { icon: '●', color: '#ea580c', label: 'Cached (aging)' },
            'estimated': { icon: '○', color: 'var(--gaip-text-muted)', label: 'Estimated' },
            'error': { icon: '●', color: '#ef4444', label: 'Error' }
        };
        
        var cfg = configs[weatherStatus.status] || configs['estimated'];
        return '<span style="font-size: 10px; color: ' + cfg.color + '; margin-left: 8px;" title="Weather data: ' + cfg.label + '">' + cfg.icon + ' ' + cfg.label + '</span>';
    }

    function renderSalinityClimateCard(result) {
        if (!result) return '';
        
        var cardId = 'salinity-climate-' + Date.now();
        var statusClass = getSeverityClass(result.compoundStress.severity);
        var weatherBadge = getWeatherStatusBadge(result.weatherStatus);
        
        return '\
            <div class="gaip-diagnostic-card salinity-climate-card">\
                <div class="gaip-card-header">\
                    <span class="gaip-card-title">Temperature-Adjusted Salinity Impact</span>' + weatherBadge + '\
                </div>\
                <div class="gaip-verdict">\
                    <span class="gaip-status-indicator ' + statusClass + '"></span>\
                    <span class="gaip-status-text">' + getSeverityLabel(result.compoundStress.severity) + '</span>\
                </div>\
                <div class="gaip-primary-value">\
                    <span class="gaip-value">' + (100 - result.adjustedReduction) + '%</span>\
                    <span class="gaip-unit">relative yield</span>\
                </div>\
                <div class="gaip-salinity-summary">\
                    <p><strong>Measured EC:</strong> ' + result.basePenalty.ec.toFixed(1) + ' dS/m</p>\
                    <p><strong>Effective EC:</strong> ' + result.effectiveEC.effective.toFixed(1) + ' dS/m <span class="gaip-note">(' + result.effectiveEC.increase + ')</span></p>\
                    <p><strong>At ' + result.temperature.toFixed(1) + '°C:</strong> ' + result.temperatureModifier.note + '</p>\
                </div>\
                <button class="gaip-expand-btn" onclick="document.getElementById(\'' + cardId + '\').style.display = document.getElementById(\'' + cardId + '\').style.display === \'none\' ? \'block\' : \'none\'">Details ▼</button>\
                <div id="' + cardId + '" class="gaip-detail-panel" style="display: none;">\
                    <div class="gaip-compound-stress">\
                        <p><strong>Compound Stress Analysis:</strong></p>\
                        <p>Temperature stress: ' + Math.round(result.compoundStress.individual.temperature * 100) + '%</p>\
                        <p>Salinity stress: ' + Math.round(result.compoundStress.individual.salinity * 100) + '%</p>\
                        <p>Synergistic effect: +' + Math.round(result.compoundStress.synergy * 100) + '%</p>\
                        <p><strong>Total reduction:</strong> ' + result.compoundStress.percentReduction + '%</p>\
                    </div>\
                    ' + (result.adjustedThreshold ? '\
                    <div class="gaip-threshold-adjustment">\
                        <p><strong>Threshold adjustment:</strong></p>\
                        <p>Base threshold: ' + result.adjustedThreshold.base.toFixed(1) + ' dS/m</p>\
                        <p>Adjusted threshold: ' + result.adjustedThreshold.adjusted.toFixed(1) + ' dS/m</p>\
                    </div>' : '') + '\
                    ' + (result.adjustedLeachingRequirement ? '\
                    <div class="gaip-lr-adjustment">\
                        <p><strong>Leaching requirement:</strong></p>\
                        <p>Base LR: ' + result.adjustedLeachingRequirement.baseLR + '%</p>\
                        <p>Climate-adjusted LR: ' + result.adjustedLeachingRequirement.adjustedLR + '% (+' + result.adjustedLeachingRequirement.percentIncrease + '%)</p>\
                    </div>' : '') + '\
                    ' + (result.recommendations && result.recommendations.length > 0 ? '\
                    <div class="gaip-recommendations">\
                        <p><strong>Recommendations:</strong></p>\
                        <ul>' + result.recommendations.map(function(r) { return '<li><strong>' + r.priority.toUpperCase() + ':</strong> ' + r.action + ' - ' + r.detail + '</li>'; }).join('') + '</ul>\
                    </div>' : '') + '\
                </div>\
            </div>';
    }

    function getSeverityClass(severity) {
        switch (severity) {
            case 'none': return 'status-adequate';
            case 'mild': return 'status-adequate';
            case 'moderate': return 'status-borderline';
            case 'significant': return 'status-borderline';
            case 'severe': return 'status-deficient';
            case 'critical': return 'status-critical';
            default: return 'status-borderline';
        }
    }

    function getSeverityLabel(severity) {
        switch (severity) {
            case 'none': return 'Minimal Impact';
            case 'mild': return 'Mild Compound Stress';
            case 'moderate': return 'Moderate Compound Stress';
            case 'significant': return 'Significant Compound Stress';
            case 'severe': return 'Severe Compound Stress';
            case 'critical': return 'Critical Compound Stress';
            default: return 'Unknown';
        }
    }

    // =========================================================================
    // INTEGRATION WITH EXISTING SALINITY PENALTY
    // =========================================================================

    /**
     * Hook into existing salinity penalty module
     */
    function integrateWithSalinityModule() {
        // Check if base module exists
        if (typeof window.gaip_salinity_penalty !== 'function') {
            console.warn('Salinity Climate: Base salinity penalty not loaded');
            return false;
        }

        // Store original function
        var originalPenalty = window.gaip_salinity_penalty;

        // Override with climate-enhanced version
        window.gaip_salinity_penalty = function(ecwDsm, species) {
            // Call original
            var result = originalPenalty(ecwDsm, species);
            
            // Get climate data from validated climateMetrics
            var climateData = null;
            if (window.climateMetrics && window.climateMetrics.temperature) {
                climateData = { airTemp: window.climateMetrics.temperature.mean };
            } else if (window.GAIP_STATE && window.GAIP_STATE.climateMetrics && window.GAIP_STATE.climateMetrics.temperature) {
                climateData = { airTemp: window.GAIP_STATE.climateMetrics.temperature.mean };
            }
            
            // Get species config from GAIP_STATE
            var speciesConfig = null;
            if (window.GAIP_STATE && window.GAIP_STATE.turf) {
                var turf = window.GAIP_STATE.turf;
                var grassType = turf.grassType || turf.grassSpecies || species || '';
                speciesConfig = {
                    grassType: grassType.toLowerCase().includes('c3') ? 'C3' : 
                               grassType.toLowerCase().includes('c4') ? 'C4' : 
                               grassType.toLowerCase().includes('ryegrass') ? 'C3' :
                               grassType.toLowerCase().includes('bent') ? 'C3' : 'C4',
                    c3Fraction: turf.c3Fraction || 0,
                    c4Fraction: turf.c4Fraction || 1
                };
            }
            
            if (climateData && climateData.airTemp) {
                var basePenalty = {
                    ecw: ecwDsm,
                    reductionPercent: result.growthPenaltyPct,
                    threshold: result.thresholdECw,
                    status: result.status,
                    leachingRequirement: result.leachingReqPct
                };
                
                var enhanced = enhanceSalinityPenalty(basePenalty, climateData, speciesConfig);
                
                if (enhanced) {
                    // Merge climate data into result
                    result.climateEnhanced = true;
                    result.effectiveEC = enhanced.effectiveEC;
                    result.temperatureModifier = enhanced.temperatureModifier;
                    result.compoundStress = enhanced.compoundStress;
                    result.adjustedReduction = enhanced.adjustedReduction;
                    result.adjustedThreshold = enhanced.adjustedThreshold;
                    result.adjustedLeachingRequirement = enhanced.adjustedLeachingRequirement;
                    result.climateImpact = enhanced.climateImpact;
                    result.climateRecommendations = enhanced.recommendations;
                    result.temperature = enhanced.temperature;
                }
            }
            
            return result;
        };

        return true;
    }

    // Auto-integrate when ready
    if (typeof window.gaip_salinity_penalty === 'function') {
        integrateWithSalinityModule();
    } else {
        document.addEventListener('DOMContentLoaded', function() {
            setTimeout(integrateWithSalinityModule, 200);
        });
    }

    // =========================================================================
    // EXPORTS
    // =========================================================================

    window.gaip_salinity_climate = {
        // Core calculations
        getTempSalinityModifier: getTempSalinityModifier,
        calculateEffectiveEC: calculateEffectiveEC,
        calculateAdjustedThreshold: calculateAdjustedThreshold,
        calculateCompoundStress: calculateCompoundStress,
        calculateAccumulationRate: calculateAccumulationRate,
        calculateAdjustedLeachingRequirement: calculateAdjustedLeachingRequirement,
        
        // Enhanced calculation
        enhancePenalty: enhanceSalinityPenalty,
        getEnhanced: getClimateEnhancedSalinity,
        
        // UI
        renderCard: renderSalinityClimateCard,
        
        // Reference data
        TEMP_SALINITY_MODIFIERS: TEMP_SALINITY_MODIFIERS,
        ET_CONCENTRATION_FACTORS: ET_CONCENTRATION_FACTORS,
        COMPOUND_STRESS_CONFIG: COMPOUND_STRESS_CONFIG
    };

    // Also export individual functions for direct use
    window.gaip_salinity_temp_modifier = getTempSalinityModifier;
    window.gaip_salinity_effective_ec = calculateEffectiveEC;
    window.gaip_salinity_compound_stress = calculateCompoundStress;


})();
