/**
 * =============================================================================
 * GILBA PREDICTION LOGGER v1.0.0
 * =============================================================================
 * 
 * Phase 1 of the Outcome Logging & Empirical Calibration system.
 * 
 * This module passively observes cascade completions and writes prediction
 * records to the database. It does NOT modify any existing engine logic.
 * 
 * ARCHITECTURE:
 * - Listens for 'gaip:cascade-complete' custom events (dispatched by cascade-orchestrator)
 * - Extracts actionable predictions from each module's computed output
 * - Writes prediction records via the Laravel API
 * - Generates input_snapshot JSON for future ML training
 * 
 * PREDICTIONS LOGGED:
 * - Soil: nutrient recommendations (N, P, K, Ca, Mg, S rates in kg/ha)
 * - Disease: risk probabilities (dollar_spot, brown_patch, pythium, etc.)
 * - PGR: timing recommendations (GDD targets, reapplication windows)
 * - Stress: trajectory forecasts (categorical severity by day)
 * - Water: quality assessments (SAR, sodium hazard categories)
 * - Climate: monthly estimates (ET₀, precipitation)
 * 
 * SITE IDENTIFICATION:
 * Prefer the active Laravel site ID when available. Fall back to the legacy
 * location hash only when the hub is not yet bound to a persisted site.
 * 
 * @author Gilba Solutions
 * @version 1.0.0
 * =============================================================================
 */

(function(global) {
    'use strict';

    // =========================================================================
    // CONFIGURATION
    // =========================================================================

    const CONFIG = {
        version: '1.0.0',
        debug: false,
        
        // API endpoint for prediction writes
        endpoint: 'predictions',
        
        // Outcome windows by module (days)
        outcomeWindows: {
            soil: { start: 28, end: 42 },
            disease: { start: 3, end: 7 },
            pgr: { start: 14, end: 21 },
            stress: { start: 7, end: 14 },
            water: { start: 60, end: 90 },
            climate: { start: 25, end: 35 }
        },
        
        // Disease-specific shorter windows for temperature-sensitive diseases
        diseaseWindows: {
            dollar_spot_risk: { start: 5, end: 7 },
            brown_patch_risk: { start: 3, end: 5 },
            pythium_blight_risk: { start: 2, end: 4 },
            anthracnose_risk: { start: 5, end: 7 },
            large_patch_risk: { start: 7, end: 10 },
            red_thread_risk: { start: 5, end: 7 },
            fusarium_patch_risk: { start: 7, end: 10 },
            bipolaris_risk: { start: 5, end: 7 }
        },
        
        // Batch size for writes (predictions accumulated before flush)
        batchSize: 1,  // Immediate write for now; can batch later if needed
        
        // Minimum confidence to log (skip very low-confidence predictions)
        minConfidence: 0.0  // Log everything for now
    };

    // =========================================================================
    // STATE
    // =========================================================================

    let _pendingPredictions = [];
    let _lastCascadeId = null;

    // =========================================================================
    // LOGGING
    // =========================================================================

    function log(message, data) {
        if (!CONFIG.debug) return;
        if (data !== undefined) {
        } else {
        }
    }

    function warn(message, data) {
        if (data !== undefined) {
            console.warn('[PredictionLogger]', message, data);
        } else {
            console.warn('[PredictionLogger]', message);
        }
    }

    // =========================================================================
    // UTILITIES
    // =========================================================================

    /**
     * Generate a UUID v4 for cascade run identification
     */
    function generateUUID() {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
            const r = Math.random() * 16 | 0;
            const v = c === 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    }

    /**
     * Generate site identifier for persistence.
     * Prefer the active site ID; fall back to a stable location hash for
     * legacy/default-site sessions.
     */
    function getSiteIdentifier() {
        try {
            if (global.GAIP_SiteContext && typeof global.GAIP_SiteContext.getSiteId === 'function') {
                const siteId = global.GAIP_SiteContext.getSiteId();
                if (siteId && siteId !== 'default') return siteId;
            }
            if (global.GAIP_SampleManager && typeof global.GAIP_SampleManager.getActiveSiteId === 'function') {
                const siteId = global.GAIP_SampleManager.getActiveSiteId();
                if (siteId && siteId !== 'default') return siteId;
            }
        } catch (_e) { /* ignore and fall back */ }

        const config = global.GAIP_HUB_CONFIG || {};
        if (config.activeSiteId && config.activeSiteId !== 'default') {
            return config.activeSiteId;
        }
        const location = config.savedLocation || {};
        
        // Round coordinates to 3 decimal places (~111m precision)
        const lat = location.lat ? Math.round(location.lat * 1000) / 1000 : 0;
        const lon = location.lon ? Math.round(location.lon * 1000) / 1000 : 0;
        const locationName = location.name || 'unknown';
        
        return `${lat}_${lon}_${hashString(locationName)}`;
    }

    /**
     * Simple string hash for location name component
     */
    function hashString(str) {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32-bit integer
        }
        return Math.abs(hash).toString(36);
    }

    /**
     * Calculate outcome window dates for a prediction
     */
    function getOutcomeWindow(module, subKey) {
        const now = new Date();
        
        // Check for disease-specific windows first
        let window = CONFIG.diseaseWindows[subKey];
        if (!window) {
            window = CONFIG.outcomeWindows[module] || { start: 7, end: 14 };
        }
        
        const windowStart = new Date(now.getTime() + window.start * 24 * 60 * 60 * 1000);
        const windowEnd = new Date(now.getTime() + window.end * 24 * 60 * 60 * 1000);
        
        return {
            start: windowStart.toISOString(),
            end: windowEnd.toISOString()
        };
    }

    /**
     * Determine prediction type from value characteristics
     */
    function inferPredictionType(value, subKey) {
        // Probability indicators
        if (subKey.includes('_risk') || subKey.includes('_probability')) {
            return 'probability';
        }
        
        // Timing indicators
        if (subKey.includes('gdd') || subKey.includes('_date') || subKey.includes('_timing')) {
            return 'timing';
        }
        
        // Category indicators
        if (typeof value === 'string' || subKey.includes('_category') || subKey.includes('_class')) {
            return 'category';
        }
        
        // Default to numeric
        return 'numeric';
    }

    /**
     * Map numeric value to category label where applicable
     */
    function getCategoryFromValue(value, subKey) {
        // Risk probabilities -> category
        if (subKey.includes('_risk')) {
            if (value >= 0.8) return 'critical';
            if (value >= 0.6) return 'high';
            if (value >= 0.3) return 'moderate';
            return 'low';
        }
        return null;
    }

    // =========================================================================
    // PREDICTION EXTRACTION
    // =========================================================================

    /**
     * Extract predictions from soil/MLSN module output
     */
    function extractSoilPredictions(computed, inputs, cascadeId) {
        const predictions = [];
        const mlsn = computed.mlsn;
        
        if (!mlsn || !mlsn.recommendations) return predictions;
        
        const nutrients = ['nitrogen', 'phosphorus', 'potassium', 'calcium', 'magnesium', 'sulfur'];
        
        nutrients.forEach(nutrient => {
            const rec = mlsn.recommendations[nutrient];
            if (rec && typeof rec.rate === 'number' && rec.rate > 0) {
                const window = getOutcomeWindow('soil', `${nutrient}_rate`);
                
                predictions.push({
                    module: 'soil',
                    sub_key: `${nutrient}_rate`,
                    cascade_run_id: cascadeId,
                    prediction_type: 'numeric',
                    predicted_value: rec.rate,
                    predicted_label: `Apply ${rec.rate.toFixed(1)} kg ${nutrient.charAt(0).toUpperCase()}/ha`,
                    predicted_category: null,
                    confidence: rec.confidence || null,
                    outcome_window_start: window.start,
                    outcome_window_end: window.end
                });
            }
        });
        
        return predictions;
    }

    /**
     * Extract predictions from disease module output
     */
    function extractDiseasePredictions(computed, inputs, cascadeId) {
        const predictions = [];
        
        // Check multiple possible disease result locations
        // Disease runs through hub-orchestrator, results stored in GAIP_DISEASE_RESULT
        const diseaseResults = computed.disease || 
                              global.GAIP_DISEASE_RESULT ||
                              global.diseaseResults || 
                              global.latestDiseaseResults;
        
        if (!diseaseResults) return predictions;
        
        // GAIP_DISEASE_RESULT structure has a 'diseases' array with objects like:
        // { displayName, adjustedRisk (0-100), riskLevel, primaryDriver, ... }
        const diseasesArray = diseaseResults.diseases || [];
        
        diseasesArray.forEach(disease => {
            const displayName = disease.displayName || disease.name || 'Unknown';
            const riskValue = disease.adjustedRisk; // 0-100 scale
            
            if (typeof riskValue !== 'number' || riskValue < 0) return;
            
            // Convert to probability (0-1) and normalize name to sub_key
            const probability = riskValue / 100;
            const subKey = displayName.toLowerCase()
                .replace(/[^a-z0-9]+/g, '_')
                .replace(/_+/g, '_')
                .replace(/^_|_$/g, '') + '_risk';
            
            const window = getOutcomeWindow('disease', subKey);
            const category = getCategoryFromValue(probability, subKey);
            
            predictions.push({
                module: 'disease',
                sub_key: subKey,
                cascade_run_id: cascadeId,
                prediction_type: 'probability',
                predicted_value: probability,
                predicted_label: `${displayName} risk: ${riskValue.toFixed(0)}% (${category})`,
                predicted_category: category,
                confidence: disease.confidence || null,
                outcome_window_start: window.start,
                outcome_window_end: window.end
            });
        });
        
        return predictions;
    }

    /**
     * Extract predictions from PGR module output
     */
    function extractPgrPredictions(computed, inputs, cascadeId) {
        const predictions = [];
        
        // Check for PGR results
        const pgrResults = computed.pgr || global.pgrResults || global.latestPgrResults;
        
        if (!pgrResults) return predictions;
        
        // GDD target for reapplication
        if (typeof pgrResults.gddTarget === 'number') {
            const window = getOutcomeWindow('pgr', 'gdd_trinexapac');
            
            predictions.push({
                module: 'pgr',
                sub_key: 'gdd_trinexapac',
                cascade_run_id: cascadeId,
                prediction_type: 'timing',
                predicted_value: pgrResults.gddTarget,
                predicted_label: `Reapply at ${pgrResults.gddTarget} GDD`,
                predicted_category: null,
                confidence: pgrResults.confidence || null,
                outcome_window_start: window.start,
                outcome_window_end: window.end
            });
        }
        
        // Predicted reapplication date
        if (pgrResults.predictedDate) {
            const window = getOutcomeWindow('pgr', 'reapplication_date');
            
            predictions.push({
                module: 'pgr',
                sub_key: 'reapplication_date',
                cascade_run_id: cascadeId,
                prediction_type: 'timing',
                predicted_value: new Date(pgrResults.predictedDate).getTime(),
                predicted_label: `Predicted reapplication: ${pgrResults.predictedDate}`,
                predicted_category: null,
                confidence: pgrResults.confidence || null,
                outcome_window_start: window.start,
                outcome_window_end: window.end
            });
        }
        
        return predictions;
    }

    /**
     * Extract predictions from stress trajectory module output
     */
    function extractStressPredictions(computed, inputs, cascadeId) {
        const predictions = [];
        const stress = computed.stressTrajectory;
        
        if (!stress || !stress.trajectory) return predictions;
        
        // Log the overall stress trajectory prediction (peak stress in forecast window)
        const trajectory = stress.trajectory;
        if (Array.isArray(trajectory) && trajectory.length > 0) {
            // Find peak stress in the forecast
            let peakStress = { value: 0, day: 0, category: 'low' };
            
            trajectory.forEach((point, idx) => {
                const stressValue = point.composite || point.stress || 0;
                if (stressValue > peakStress.value) {
                    peakStress = {
                        value: stressValue,
                        day: idx,
                        category: stressValue >= 0.8 ? 'critical' : 
                                 stressValue >= 0.6 ? 'high' :
                                 stressValue >= 0.3 ? 'moderate' : 'low'
                    };
                }
            });
            
            const window = getOutcomeWindow('stress', 'peak_stress');
            
            predictions.push({
                module: 'stress',
                sub_key: 'peak_stress',
                cascade_run_id: cascadeId,
                prediction_type: 'category',
                predicted_value: peakStress.value,
                predicted_label: `Peak stress: ${peakStress.category} (day ${peakStress.day + 1})`,
                predicted_category: peakStress.category,
                confidence: stress.confidence || null,
                outcome_window_start: window.start,
                outcome_window_end: window.end
            });
        }
        
        return predictions;
    }

    /**
     * Extract predictions from water quality module output
     */
    function extractWaterPredictions(computed, inputs, cascadeId) {
        const predictions = [];
        const water = computed.water || computed.waterBlend;
        
        if (!water) return predictions;
        
        // Try to find SAR from various possible locations in the water result
        const sar = water.SAR || water.sar || 
                   water.calculations?.suarezSAR?.adjSAR ||
                   water.calculations?.SAR ||
                   (water.blendResult?.calculations?.suarezSAR?.adjSAR);
        
        // SAR assessment
        if (typeof sar === 'number' && sar > 0) {
            const window = getOutcomeWindow('water', 'sodium_hazard');
            const category = sar >= 18 ? 'severe' :
                           sar >= 10 ? 'high' :
                           sar >= 6 ? 'moderate' : 'low';
            
            predictions.push({
                module: 'water',
                sub_key: 'sodium_hazard',
                cascade_run_id: cascadeId,
                prediction_type: 'category',
                predicted_value: sar,
                predicted_label: `SAR ${sar.toFixed(1)} - ${category} sodium hazard`,
                predicted_category: category,
                confidence: water.confidence || null,
                outcome_window_start: window.start,
                outcome_window_end: window.end
            });
        }
        
        // Try to find EC from various possible locations
        const ec = water.EC || water.ec || 
                  water.calculations?.EC ||
                  water.blendResult?.EC;
        
        // Salinity (EC)
        if (typeof ec === 'number' && ec > 0) {
            const window = getOutcomeWindow('water', 'salinity_hazard');
            const category = ec >= 3.0 ? 'severe' :
                           ec >= 1.5 ? 'high' :
                           ec >= 0.75 ? 'moderate' : 'low';
            
            predictions.push({
                module: 'water',
                sub_key: 'salinity_hazard',
                cascade_run_id: cascadeId,
                prediction_type: 'category',
                predicted_value: ec,
                predicted_label: `EC ${ec.toFixed(2)} dS/m - ${category} salinity`,
                predicted_category: category,
                confidence: water.confidence || null,
                outcome_window_start: window.start,
                outcome_window_end: window.end
            });
        }
        
        return predictions;
    }

    /**
     * Extract predictions from climate module output
     */
    function extractClimatePredictions(computed, inputs, cascadeId) {
        const predictions = [];
        const climate = computed.climate || global.climateMetrics;
        
        if (!climate) return predictions;
        
        // Monthly ET₀ estimate
        if (typeof climate.monthlyETo === 'number') {
            const window = getOutcomeWindow('climate', 'monthly_eto');
            
            predictions.push({
                module: 'climate',
                sub_key: 'monthly_eto',
                cascade_run_id: cascadeId,
                prediction_type: 'numeric',
                predicted_value: climate.monthlyETo,
                predicted_label: `Monthly ET₀: ${climate.monthlyETo.toFixed(0)} mm`,
                predicted_category: null,
                confidence: climate.confidence || null,
                outcome_window_start: window.start,
                outcome_window_end: window.end
            });
        }
        
        return predictions;
    }

    /**
     * Build complete input snapshot for ML training
     * Captures all inputs that drove the prediction
     */
    function buildInputSnapshot(inputs, computed) {
        const snapshot = {};
        
        // Soil inputs
        if (inputs.soil) {
            snapshot.soil = {
                nitrogen: inputs.soil.nitrogen,
                phosphorus: inputs.soil.phosphorus,
                potassium: inputs.soil.potassium,
                calcium: inputs.soil.calcium,
                magnesium: inputs.soil.magnesium,
                sulfur: inputs.soil.sulfur,
                ph: inputs.soil.ph,
                cec: inputs.soil.cec,
                om: inputs.soil.om
            };
        }
        
        // Water inputs
        if (inputs.water) {
            snapshot.water = {
                ec: inputs.water.ec,
                sar: inputs.water.sar,
                sodium: inputs.water.sodium,
                chloride: inputs.water.chloride,
                bicarbonate: inputs.water.bicarbonate
            };
        }
        
        // Turf context
        if (inputs.turf) {
            snapshot.turf = {
                species: inputs.turf.species,
                variety: inputs.turf.variety,
                useType: inputs.turf.useType,
                region: inputs.turf.region
            };
        }
        
        // Climate context
        if (inputs.climate) {
            snapshot.climate = {
                latitude: inputs.climate.latitude,
                longitude: inputs.climate.longitude,
                month: new Date().getMonth() + 1
            };
        }
        
        // Weather forecast summary (if available)
        if (global.rawWeatherData && Array.isArray(global.rawWeatherData)) {
            const weather = global.rawWeatherData.slice(0, 7); // 7-day summary
            snapshot.weather_7d = {
                temp_max_avg: average(weather.map(d => d.temperature_2m_max)),
                temp_min_avg: average(weather.map(d => d.temperature_2m_min)),
                precip_sum: sum(weather.map(d => d.precipitation_sum)),
                humidity_avg: average(weather.map(d => d.relative_humidity_2m_mean))
            };
        }
        
        return snapshot;
    }

    function average(arr) {
        const valid = arr.filter(v => typeof v === 'number' && !isNaN(v));
        return valid.length > 0 ? valid.reduce((a, b) => a + b, 0) / valid.length : null;
    }

    function sum(arr) {
        const valid = arr.filter(v => typeof v === 'number' && !isNaN(v));
        return valid.reduce((a, b) => a + b, 0);
    }

    // =========================================================================
    // MAIN EXTRACTION ORCHESTRATOR
    // =========================================================================

    /**
     * Extract all predictions from a cascade result
     */
    function extractPredictions(cascadeResult) {
        if (!cascadeResult || !cascadeResult.success) {
            log('Skipping prediction extraction - cascade unsuccessful');
            return [];
        }

        const cascadeId = generateUUID();
        const state = cascadeResult.state || {};
        const computed = state.computed || {};
        const inputs = state.inputs || {};
        
        const siteId = getSiteIdentifier();
        const inputSnapshot = buildInputSnapshot(inputs, computed);
        const predictedAt = new Date().toISOString();
        
        let predictions = [];
        
        // Extract from each module
        predictions = predictions.concat(extractSoilPredictions(computed, inputs, cascadeId));
        predictions = predictions.concat(extractDiseasePredictions(computed, inputs, cascadeId));
        predictions = predictions.concat(extractPgrPredictions(computed, inputs, cascadeId));
        predictions = predictions.concat(extractStressPredictions(computed, inputs, cascadeId));
        predictions = predictions.concat(extractWaterPredictions(computed, inputs, cascadeId));
        predictions = predictions.concat(extractClimatePredictions(computed, inputs, cascadeId));
        
        // Attach common fields to all predictions
        predictions = predictions.map(p => ({
            ...p,
            site_id: siteId,
            predicted_at: predictedAt,
            input_snapshot: inputSnapshot,
            status: 'pending'
        }));
        
        log(`Extracted ${predictions.length} predictions from cascade ${cascadeId}`, {
            soil: predictions.filter(p => p.module === 'soil').length,
            disease: predictions.filter(p => p.module === 'disease').length,
            pgr: predictions.filter(p => p.module === 'pgr').length,
            stress: predictions.filter(p => p.module === 'stress').length,
            water: predictions.filter(p => p.module === 'water').length,
            climate: predictions.filter(p => p.module === 'climate').length
        });
        
        return predictions;
    }

    // =========================================================================
    // PERSISTENCE (API)
    // =========================================================================

    /**
     * Write predictions to database via Laravel API
     */
    async function writePredictions(predictions) {
        if (!predictions || predictions.length === 0) {
            return { success: true, written: 0 };
        }
        
        const config = global.GAIP_HUB_CONFIG || {};
        
        const baseUrl = config.restUrl || '/api/';
        const endpoint = baseUrl.replace(/\/?$/, '/') + CONFIG.endpoint;
        const csrfToken = config.csrfToken || config.restNonce || config.nonce || '';
        
        try {
            const response = await fetch(endpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                    'X-CSRF-TOKEN': csrfToken
                },
                credentials: 'same-origin',
                body: JSON.stringify({
                    predictions: predictions
                })
            });
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            const result = await response.json();
            log(`Successfully wrote ${result.written || predictions.length} predictions`);
            
            return { success: true, written: result.written || predictions.length };
            
        } catch (error) {
            warn('Failed to write predictions:', error);
            
            // Queue for retry on next cascade (in production, add proper retry logic)
            _pendingPredictions = _pendingPredictions.concat(predictions);
            
            return { success: false, error: error.message, queued: predictions.length };
        }
    }

    // =========================================================================
    // EVENT HANDLING
    // =========================================================================

    /**
     * Handle disease-updated event (fires after disease analysis completes)
     * Disease runs through hub-orchestrator AFTER the SSOT cascade
     */
    function handleDiseaseUpdated(event) {
        const detail = event.detail || {};
        const result = detail.result;
        
        if (!result || !result.diseases || result.diseases.length === 0) {
            return;
        }
        
        log('Received disease-updated event', {
            diseaseCount: result.diseases.length,
            overallRisk: result.overallRisk
        });
        
        const cascadeId = generateUUID();
        const siteId = getSiteIdentifier();
        const predictedAt = new Date().toISOString();
        
        // Build minimal input snapshot from disease result
        const inputSnapshot = {
            species: result.species,
            region: result.region,
            variety: result.variety?.name || null,
            timestamp: result.timestamp
        };
        
        const predictions = [];
        
        result.diseases.forEach(disease => {
            const displayName = disease.displayName || disease.name || 'Unknown';
            const riskValue = disease.adjustedRisk; // 0-100 scale
            
            if (typeof riskValue !== 'number' || riskValue < 0) return;
            
            const probability = riskValue / 100;
            const subKey = displayName.toLowerCase()
                .replace(/[^a-z0-9]+/g, '_')
                .replace(/_+/g, '_')
                .replace(/^_|_$/g, '') + '_risk';
            
            const window = getOutcomeWindow('disease', subKey);
            const category = getCategoryFromValue(probability, subKey);
            
            predictions.push({
                site_id: siteId,
                module: 'disease',
                sub_key: subKey,
                cascade_run_id: cascadeId,
                predicted_at: predictedAt,
                prediction_type: 'probability',
                predicted_value: probability,
                predicted_label: `${displayName} risk: ${riskValue.toFixed(0)}% (${category})`,
                predicted_category: category,
                confidence: disease.confidence || null,
                outcome_window_start: window.start,
                outcome_window_end: window.end,
                input_snapshot: inputSnapshot,
                status: 'pending'
            });
        });
        
        if (predictions.length > 0) {
            log(`Extracted ${predictions.length} disease predictions from disease-updated event`);
            writePredictions(predictions);
        }
    }

    /**
     * Handle cascade completion event
     */
    function handleCascadeComplete(event) {
        const cascadeResult = event.detail;
        
        log('Received cascade-complete event', {
            success: cascadeResult?.success,
            duration: cascadeResult?.duration
        });
        
        // Extract predictions
        const predictions = extractPredictions(cascadeResult);
        
        // Include any queued predictions from previous failed writes
        const allPredictions = _pendingPredictions.concat(predictions);
        _pendingPredictions = [];
        
        // Write to database (async, non-blocking)
        if (allPredictions.length > 0) {
            writePredictions(allPredictions);
        }
    }

    /**
     * Initialize event listener
     */
    function init() {
        // Listen for cascade completion events (SSOT cascade - soil, water, stress, etc.)
        document.addEventListener('gaip:cascade-complete', handleCascadeComplete);
        
        // Listen for disease-updated events (fires after hub-orchestrator disease analysis)
        document.addEventListener('gaip:disease-updated', handleDiseaseUpdated);
        
        log('Prediction logger initialized', { version: CONFIG.version });
    }

    // =========================================================================
    // EXPORTS
    // =========================================================================

    global.GilbaPredictionLogger = {
        version: CONFIG.version,
        
        // Manual extraction (for testing)
        extractPredictions: extractPredictions,
        
        // Configuration access
        getConfig: function() { return CONFIG; },
        setDebug: function(enabled) { CONFIG.debug = enabled; },
        
        // Queue inspection (for debugging)
        getPendingCount: function() { return _pendingPredictions.length; },
        
        // Manual trigger (for testing without event)
        logCascadeResult: function(cascadeResult) {
            const predictions = extractPredictions(cascadeResult);
            return writePredictions(predictions);
        },
        
        // Initialize
        init: init
    };

    // Auto-initialize when DOM ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})(typeof window !== 'undefined' ? window : this);
