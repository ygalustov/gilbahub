/**
 * =============================================================================
 * GILBA HUB NUTRIENT TREND TRACKING v1.0.0
 * =============================================================================
 * 
 * Temporal trend analysis for soil (and later water/tissue) samples.
 * Groups samples by zone across time, calculates nutrient direction,
 * projects MLSN threshold crossing risk, and renders inline SVG sparklines
 * within the existing MLSN progressive disclosure cards.
 *
 * DEPENDENCIES:
 *   - sample-manager.js (GAIP_SampleManager)
 *   - mlsn-progressive-disclosure.js (card DOM structure)
 *   - nutrient-demand-engine.js (GilbaNutrientDemandEngine.MLSN_THRESHOLDS)
 *
 * EVENTS CONSUMED:
 *   - gaip:analysis-complete (main hub calculation done, MLSN cards in DOM)
 *   - gaip:sampleLoaded / gaip:sampleAdded / gaip:samples-imported
 *
 * EVENTS PRODUCED:
 *   - gaip:trendDataReady ({ dataType, trends, index })
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

    var CONFIG = {
        version: '1.1.0',
        debug: true,

        // Direction classification: % change below this = stable
        stableThresholdPercent: 5,

        // Crossing risk horizons (months)
        warningMonths: 6,
        watchMonths: 12,

        // Chart dimensions
        chartWidth: 280,
        chartHeight: 80,
        chartPadding: { top: 12, right: 12, bottom: 20, left: 40 },

        // Nutrients to track (soil)
        soilNutrients: ['K', 'P', 'Ca', 'Mg', 'S', 'Fe', 'Mn', 'Zn', 'Cu', 'B'],

        // Nutrients to track (tissue) - macros in % DW, traces in mg/kg
        tissueNutrients: ['N', 'P', 'K', 'Ca', 'Mg', 'S', 'Fe', 'Mn', 'Zn', 'Cu', 'B'],

        // Parameters to track (water) - mapped to CSV column names + calculated indices
        waterNutrients: ['SAR', 'SARadj', 'EC', 'HCO3', 'Cl', 'Na', 'B', 'Fe', 'pH', 'Ca', 'Mg', 'K', 'SO4'],  // All nutrients with rendered diagnostic cards

        // Max data point labels before switching to first/last only
        maxInlineLabels: 6
    };

    // =========================================================================
    // LOGGING
    // =========================================================================

    function log(message, data) {
        if (!CONFIG.debug) return;
        if (data !== undefined) {
            console.log('[NutrientTrend]', message, data);
        } else {
            console.log('[NutrientTrend]', message);
        }
    }

    function warn(message, data) {
        if (data !== undefined) {
            console.warn('[NutrientTrend]', message, data);
        } else {
            console.warn('[NutrientTrend]', message);
        }
    }

    // =========================================================================
    // ZONE KEY DERIVATION
    // =========================================================================

    /**
     * Strip temporal qualifiers from a sample ID to derive the zone identity.
     *
     * "Green 1 Q1 2025"   → "green 1"
     * "Grn1 Jan 2025"     → "grn1"
     * "Fairway 3 July"    → "fairway 3"
     * "Putting Green"     → "putting green"
     */
    function deriveZoneKey(sample) {
        // b35fix311_1: zone-key derivation moved to assets/zone-key.js — single
        // source of truth shared with word-export-combined.js. This wrapper
        // preserves the internal name used throughout this file.
        if (typeof global.GaipZoneKey !== 'undefined' &&
            typeof global.GaipZoneKey.derive === 'function') {
            return global.GaipZoneKey.derive(sample);
        }
        // Defensive fallback — should never happen if enqueue order is correct.
        // Log once so an enqueue regression is visible in production logs.
        if (!deriveZoneKey._warned) {
            console.warn('[NutrientTrend] GaipZoneKey not loaded; trend grouping may drift');
            deriveZoneKey._warned = true;
        }
        var key = (sample && (sample.label || sample.id)) || '';
        return String(key).toLowerCase().trim();
    }

    // =========================================================================
    // TEMPORAL INDEX
    // =========================================================================

    /**
     * Build a temporal index from existing SampleManager store.
     * Groups samples by (dataType, zoneType, derivedZoneKey), sorted by date ascending.
     *
     * @param {string} dataType - 'soil', 'water', or 'tissue'
     * @returns {Object} { 'soil:green:green 1': [sample, sample, ...], ... }
     */
    function buildTemporalIndex(dataType) {
        if (!global.GAIP_SampleManager) {
            warn('SampleManager not available');
            return {};
        }

        var samples = global.GAIP_SampleManager.getSamples(dataType);
        console.log('[NutrientTrend] buildTemporalIndex(' + dataType + '): getSamples returned',
            samples ? samples.length : 'null',
            samples ? samples.map(function(s) { return (s.label || s.id) + ' (' + s.date + ')'; }) : []);

        if (!samples || samples.length === 0) return {};

        var index = {};

        for (var i = 0; i < samples.length; i++) {
            var sample = samples[i];
            var zoneKey = deriveZoneKey(sample);
            var indexKey = dataType + ':' + (sample.zoneType || 'other') + ':' + zoneKey;

            if (!index[indexKey]) index[indexKey] = [];
            index[indexKey].push(sample);
        }

        // Sort each group by date ascending
        var keys = Object.keys(index);
        for (var k = 0; k < keys.length; k++) {
            index[keys[k]].sort(function(a, b) {
                return new Date(a.date) - new Date(b.date);
            });
        }

        console.log('[NutrientTrend] buildTemporalIndex(' + dataType + '): groups built:',
            Object.keys(index).map(function(k) { return k + ' (' + index[k].length + ' samples)'; }));

        return index;
    }

    // =========================================================================
    // THRESHOLDS (methodology-aware)
    // =========================================================================

    /**
     * MLSN fixed thresholds (fallback when NutrientDemandEngine not available).
     * b35fix301a: sourced from gaip-classification-constants.js when loaded.
     */
    var MLSN_DEFAULTS =
        (typeof window !== 'undefined' && window.GilbaClassificationConstants &&
         window.GilbaClassificationConstants.MLSN_THRESHOLDS) ||
        (typeof globalThis !== 'undefined' && globalThis.GilbaClassificationConstants &&
         globalThis.GilbaClassificationConstants.MLSN_THRESHOLDS) ||
        { K: 37, P: 21, Ca: 331, Mg: 47, S: 7, Fe: 2, Mn: 1, Zn: 1, Cu: 0.3, B: 0.3 };

    /**
     * Get threshold for a nutrient, respecting the active methodology.
     * 
     * Reads from three sources in priority order:
     * 1. DOM: the rendered MLSN card shows the actual threshold used in the analysis
     * 2. GilbaNutrientDemandEngine.MLSN_THRESHOLDS (for pure MLSN)
     * 3. Hardcoded MLSN defaults
     *
     * This approach is methodology-agnostic because the MLSN card always renders
     * the threshold that was used, whether MLSN, SLAN lo, or AA lo.
     */
    function getThreshold(nutrient) {
        // Strategy 1: Read from the rendered MLSN card DOM
        // The card shows "MLSN: X ppm" or "Range: X ppm" or "AA: X ppm"
        try {
            var card = document.querySelector(
                '.gaip-diagnostic-card.mlsn-card[data-nutrient="' + nutrient + '"]'
            );
            if (card) {
                var methodology = card.getAttribute('data-methodology') || 'mlsn';
                var thresholdEl = card.querySelector('.gaip-mlsn-threshold .gaip-value');
                if (thresholdEl) {
                    var thresholdText = thresholdEl.textContent.trim();
                    // For SLAN ranges displayed as "X-Y ppm", parse the low value
                    var rangeMatch = thresholdText.match(/([\d.]+)\s*[-–]\s*([\d.]+)/);
                    var parsed;
                    if (rangeMatch) {
                        parsed = parseFloat(rangeMatch[1]);
                    } else {
                        parsed = parseFloat(thresholdText);
                    }
                    if (!isNaN(parsed) && parsed > 0) {
                        return {
                            mlsn: parsed,
                            isAdjusted: methodology !== 'mlsn',
                            base: parsed,
                            methodology: methodology
                        };
                    }
                }
            }
        } catch (e) {
            warn('Error reading threshold from DOM for ' + nutrient + ':', e);
        }

        // Strategy 2: GilbaNutrientDemandEngine (MLSN only)
        var engine = global.GilbaNutrientDemandEngine;
        if (engine && engine.MLSN_THRESHOLDS) {
            var base = engine.MLSN_THRESHOLDS[nutrient];
            if (base !== undefined) {
                // Check for demand-adjusted thresholds
                var state = global.GAIP_STATE;
                var adjusted = null;
                if (state && state.nutrientDemand &&
                    state.nutrientDemand.thresholds &&
                    state.nutrientDemand.thresholds.adjustedThresholds) {
                    adjusted = state.nutrientDemand.thresholds.adjustedThresholds[nutrient];
                }
                return {
                    mlsn: (adjusted != null && adjusted !== base) ? adjusted : base,
                    isAdjusted: (adjusted != null && adjusted !== base),
                    base: base,
                    methodology: 'mlsn'
                };
            }
        }

        // Strategy 3: Hardcoded MLSN defaults
        if (MLSN_DEFAULTS[nutrient] !== undefined) {
            return {
                mlsn: MLSN_DEFAULTS[nutrient],
                isAdjusted: false,
                base: MLSN_DEFAULTS[nutrient],
                methodology: 'mlsn'
            };
        }

        return null;
    }

    // =========================================================================
    // TISSUE THRESHOLDS (PACE Turf sufficiency lo values)
    // =========================================================================

    /**
     * Default tissue ranges (bentgrass/C3 greens) - lo value used as threshold line.
     * Will read from GilbaTissueEngine.RANGES if available.
     */
    var TISSUE_DEFAULTS = {
        N: 4.00, P: 0.30, K: 2.20, Ca: 0.25, Mg: 0.20, S: 0.25,
        Fe: 50, Mn: 25, Zn: 20, Cu: 5, B: 3
    };

    function getTissueThreshold(nutrient) {
        // Try GilbaTissueEngine for species-specific ranges
        var engine = global.GilbaTissueEngine;
        if (engine && engine.RANGES) {
            // Determine active species from turf profile
            var speciesKey = 'bentgrass'; // default
            var state = global.GAIP_STATE;
            if (state && state.turf) {
                var species = (state.turf.grassSpecies || '').toLowerCase();
                if (species.indexOf('couch') >= 0 || species.indexOf('bermuda') >= 0 ||
                    species.indexOf('cynodon') >= 0 || species.indexOf('zoysiagrass') >= 0) {
                    speciesKey = 'couch';
                } else if (species.indexOf('ryegrass') >= 0 || species.indexOf('perennial') >= 0) {
                    speciesKey = 'perennialRyegrass';
                }
            }
            var ranges = engine.RANGES[speciesKey];
            if (ranges) {
                var r = (ranges.macros && ranges.macros[nutrient]) ||
                        (ranges.traces && ranges.traces[nutrient]);
                if (r && r.lo !== undefined) {
                    return { mlsn: r.lo, isAdjusted: false, base: r.lo, methodology: 'tissue' };
                }
            }
        }

        // Fallback defaults
        if (TISSUE_DEFAULTS[nutrient] !== undefined) {
            return { mlsn: TISSUE_DEFAULTS[nutrient], isAdjusted: false, base: TISSUE_DEFAULTS[nutrient], methodology: 'tissue' };
        }
        return null;
    }

    // =========================================================================
    // WATER THRESHOLDS (FAO Ayers & Westcot 1985 guidelines)
    // =========================================================================

    /**
     * Water quality guideline thresholds (lo = caution begins).
     * These are "slight-to-moderate restriction" thresholds.
     */
    var WATER_DEFAULTS = {
        pH: 8.5,       // upper pH limit
        EC: 3.0,       // dS/m - severe restriction above this
        SAR: 6.0,      // slight-to-moderate restriction (Ayers & Westcot 1985)
        SARadj: 6.0,   // same threshold for adjusted SAR
        Na: 200,       // mg/L foliar toxicity sprinkler
        Cl: 350,       // mg/L foliar toxicity sprinkler
        HCO3: 520,     // mg/L overhead sprinkler
        B: 1.0,        // mg/L sensitive crops
        Fe: 5.0,       // mg/L staining threshold
        Ca: null,       // no single threshold (part of SAR)
        Mg: null,       // no single threshold
        K: null,        // no single threshold
        SO4: null       // no single threshold
    };

    function getWaterThreshold(nutrient) {
        if (WATER_DEFAULTS[nutrient] != null) {
            return { mlsn: WATER_DEFAULTS[nutrient], isAdjusted: false, base: WATER_DEFAULTS[nutrient], methodology: 'water' };
        }
        return null;
    }

    // =========================================================================
    // METHODOLOGY LABELS
    // =========================================================================

    /**
     * Get the display label for a threshold methodology.
     * Water uses FAO guidelines, soil uses MLSN/SLAN/AA.
     */
    function getMethodologyLabel(methodology) {
        if (methodology === 'water') return 'FAO guideline';
        if (methodology === 'tissue') return 'sufficiency range';
        if (methodology === 'slan') return 'SLAN';
        if (methodology === 'ammonium_acetate') return 'AA';
        return 'MLSN';
    }

    /**
     * Get the unit suffix for a given methodology.
     */
    function getMethodologyUnit(methodology) {
        if (methodology === 'water') return '';
        return ' ppm';
    }

    // =========================================================================
    // LINEAR REGRESSION
    // =========================================================================

    /**
     * Simple least-squares linear regression.
     * @param {Array} pairs - [[x, y], [x, y], ...]
     * @returns {{ slope: number, intercept: number }}
     */
    function linearRegression(pairs) {
        var n = pairs.length;
        if (n < 2) return { slope: 0, intercept: pairs.length ? pairs[0][1] : 0 };

        var sumX = 0, sumY = 0, sumXY = 0, sumXX = 0;
        for (var i = 0; i < n; i++) {
            var x = pairs[i][0];
            var y = pairs[i][1];
            sumX += x;
            sumY += y;
            sumXY += x * y;
            sumXX += x * x;
        }

        var denom = n * sumXX - sumX * sumX;
        if (denom === 0) return { slope: 0, intercept: sumY / n };

        var slope = (n * sumXY - sumX * sumY) / denom;
        var intercept = (sumY - slope * sumX) / n;

        return { slope: slope, intercept: intercept };
    }

    // =========================================================================
    // CROSSING RISK
    // =========================================================================

    /**
     * Estimate months until MLSN threshold crossing at current decline rate.
     *
     * @param {Array} points - [{ date, value }, ...]
     * @param {Object|null} threshold - { mlsn, isAdjusted, base }
     * @returns {Object|null}
     */
    function calculateCrossingRisk(points, threshold) {
        if (!threshold || points.length < 2) return null;

        // Regression on timestamps
        var pairs = [];
        for (var i = 0; i < points.length; i++) {
            pairs.push([new Date(points[i].date).getTime(), points[i].value]);
        }
        var reg = linearRegression(pairs);

        // Slope per month (30.44 avg days)
        var msPerMonth = 30.44 * 24 * 60 * 60 * 1000;
        var slopePerMonth = reg.slope * msPerMonth;

        var current = points[points.length - 1].value;
        var isWater = threshold.methodology === 'water';

        if (isWater) {
            // WATER: threshold is an UPPER limit — above = bad
            var headroom = threshold.mlsn - current;

            // Already above threshold
            if (headroom <= 0) {
                return {
                    status: 'above',
                    monthsUntilCrossing: 0,
                    slopePerMonth: Math.round(slopePerMonth * 10) / 10
                };
            }

            // Not rising → no risk
            if (slopePerMonth <= 0) return null;

            var months = headroom / slopePerMonth;

            var status;
            if (months <= CONFIG.warningMonths) {
                status = 'warning';
            } else if (months <= CONFIG.watchMonths) {
                status = 'watch';
            } else {
                status = 'ok';
            }

            return {
                status: status,
                monthsUntilCrossing: Math.round(months),
                slopePerMonth: Math.round(slopePerMonth * 10) / 10
            };
        }

        // SOIL/TISSUE: threshold is a LOWER limit — below = bad
        var gap = current - threshold.mlsn;

        // Already below threshold
        if (gap <= 0) {
            return {
                status: 'below',
                monthsUntilCrossing: 0,
                slopePerMonth: Math.round(slopePerMonth * 10) / 10
            };
        }

        // Not declining → no risk
        if (slopePerMonth >= 0) return null;

        var months = gap / Math.abs(slopePerMonth);

        var status;
        if (months <= CONFIG.warningMonths) {
            status = 'warning';
        } else if (months <= CONFIG.watchMonths) {
            status = 'watch';
        } else {
            status = 'ok';
        }

        return {
            status: status,
            monthsUntilCrossing: Math.round(months),
            slopePerMonth: Math.round(slopePerMonth * 10) / 10
        };
    }

    // =========================================================================
    // TREND CALCULATION
    // =========================================================================

    /**
     * Calculate trend data for one nutrient across a temporal group.
     *
     * @param {Array} sampleGroup - Date-sorted samples for one zone
     * @param {string} nutrient - 'K', 'P', 'Ca', etc.
     * @returns {Object|null} Trend analysis or null if <2 data points
     */
    function calculateNutrientTrend(sampleGroup, nutrient, dataType) {
        var points = [];
        for (var i = 0; i < sampleGroup.length; i++) {
            var s = sampleGroup[i];
            var val = s.normalized ? s.normalized[nutrient] : undefined;

            // Calculate SAR/SARadj on the fly from ion data
            if (dataType === 'water' && (nutrient === 'SAR' || nutrient === 'SARadj') && (val === undefined || val === null)) {
                var n = s.normalized || {};
                var Ca_meq = (parseFloat(n.Ca) || 0) / 20.04;
                var Mg_meq = (parseFloat(n.Mg) || 0) / 12.15;
                var Na_meq = (parseFloat(n.Na) || 0) / 22.99;
                var denom = Math.sqrt((Ca_meq + Mg_meq) / 2);
                if (denom > 0) {
                    var sar = Na_meq / denom;
                    if (nutrient === 'SARadj') {
                        // Approximate Suarez adjustment: SARadj ≈ SAR × (1 + HCO3_meq/Ca_meq × 0.5)
                        var HCO3_meq = (parseFloat(n.HCO3) || 0) / 61.02;
                        if (Ca_meq > 0 && HCO3_meq > 0) {
                            sar = sar * (1 + (HCO3_meq / Ca_meq) * 0.5);
                        }
                    }
                    val = Math.round(sar * 100) / 100;
                }
            }

            // Calculate EC from raw data if not in normalized
            if (dataType === 'water' && nutrient === 'EC' && (val === undefined || val === null)) {
                var nd = s.normalized || {};
                val = parseFloat(nd.ecw) || parseFloat(nd.ECw) || parseFloat(nd.ec) || parseFloat(nd.EC_dSm) || undefined;
                if (val === undefined && s.rawData) {
                    val = parseFloat(s.rawData.EC) || parseFloat(s.rawData.ECw) || parseFloat(s.rawData.EC_dSm) || undefined;
                }
            }

            // pH may be stored as water_ph
            if (dataType === 'water' && nutrient === 'pH' && (val === undefined || val === null)) {
                var nd2 = s.normalized || {};
                val = parseFloat(nd2.water_ph) || parseFloat(nd2.pH) || undefined;
                if (val === undefined && s.rawData) {
                    val = parseFloat(s.rawData.pH) || parseFloat(s.rawData.ph) || undefined;
                }
            }

            if (val !== undefined && val !== null && !isNaN(val)) {
                points.push({
                    date: s.date,
                    value: val,
                    sampleId: s.id
                });
            }
        }

        if (points.length < 2) return null;

        var latest = points[points.length - 1].value;
        var previous = points[points.length - 2].value;

        // Absolute and percentage change (most recent pair)
        var absoluteChange = latest - previous;
        var percentChange = previous !== 0
            ? ((latest - previous) / previous) * 100
            : null;

        // Overall direction from index-based regression
        var regPairs = [];
        for (var j = 0; j < points.length; j++) {
            regPairs.push([j, points[j].value]);
        }
        var regression = linearRegression(regPairs);

        // Direction classification (neutral: no value judgment on good/bad)
        var direction;
        var absPercent = percentChange !== null ? Math.abs(percentChange) : 0;
        if (absPercent < CONFIG.stableThresholdPercent) {
            direction = 'stable';
        } else if (absoluteChange > 0) {
            direction = 'increasing';
        } else {
            direction = 'decreasing';
        }

        // Threshold context (methodology-aware)
        var threshold;
        if (dataType === 'tissue') {
            threshold = getTissueThreshold(nutrient);
        } else if (dataType === 'water') {
            threshold = getWaterThreshold(nutrient);
        } else {
            threshold = getThreshold(nutrient);
        }
        // For soil: margin = value - threshold (positive = safely above minimum)
        // For water: margin = threshold - value (positive = safely below maximum)
        var mlsnMargin = null;
        if (threshold) {
            mlsnMargin = threshold.methodology === 'water'
                ? threshold.mlsn - latest   // headroom below upper limit
                : latest - threshold.mlsn;  // buffer above lower limit
        }
        var crossingRisk = calculateCrossingRisk(points, threshold);

        return {
            nutrient: nutrient,
            points: points,
            latest: latest,
            previous: previous,
            absoluteChange: Math.round(absoluteChange * 10) / 10,
            percentChange: percentChange !== null ? Math.round(percentChange * 10) / 10 : null,
            direction: direction,
            regression: regression,
            threshold: threshold,
            mlsnMargin: mlsnMargin !== null ? Math.round(mlsnMargin * 10) / 10 : null,
            crossingRisk: crossingRisk
        };
    }

    // =========================================================================
    // SVG SPARKLINE RENDERER
    // =========================================================================

    /**
     * Render an inline SVG sparkline for a nutrient trend.
     * Pure string generation — no DOM dependency at build time.
     */
    function renderTrendChart(trendData, options) {
        options = options || {};
        var width = options.width || CONFIG.chartWidth;
        var height = options.height || CONFIG.chartHeight;
        var showThreshold = options.showThreshold !== false;
        var showLabels = options.showLabels !== false;
        var pad = CONFIG.chartPadding;

        var points = trendData.points;
        var plotW = width - pad.left - pad.right;
        var plotH = height - pad.top - pad.bottom;

        // Y-axis range
        var values = [];
        for (var i = 0; i < points.length; i++) {
            values.push(points[i].value);
        }
        var yMin = Math.min.apply(null, values);
        var yMax = Math.max.apply(null, values);

        // Include threshold line in range
        if (showThreshold && trendData.threshold) {
            yMin = Math.min(yMin, trendData.threshold.mlsn * 0.9);
            yMax = Math.max(yMax, trendData.threshold.mlsn * 1.1);
        }

        // Add 10% padding to y range
        var yRange = yMax - yMin;
        if (yRange === 0) yRange = 1;
        yMin -= yRange * 0.1;
        yMax += yRange * 0.1;

        // Scale functions
        var xDenom = points.length > 1 ? points.length - 1 : 1;
        function xScale(idx) {
            return pad.left + (idx / xDenom) * plotW;
        }
        function yScale(v) {
            return pad.top + plotH - ((v - yMin) / (yMax - yMin)) * plotH;
        }

        // Direction colour - context-neutral (blue for movement, grey for stable)
        var color;
        if (trendData.direction === 'decreasing') {
            color = '#dc2626';
        } else if (trendData.direction === 'increasing') {
            color = '#2563eb';
        } else {
            color = 'var(--gaip-text-secondary)';
        }

        var svg = '<svg width="' + width + '" height="' + height + '" ' +
                  'viewBox="0 0 ' + width + ' ' + height + '" ' +
                  'xmlns="http://www.w3.org/2000/svg" ' +
                  'style="font-family: -apple-system, BlinkMacSystemFont, sans-serif;">';

        // Threshold line
        if (showThreshold && trendData.threshold) {
            var ty = yScale(trendData.threshold.mlsn).toFixed(1);
            svg += '<line x1="' + pad.left + '" y1="' + ty + '" ' +
                   'x2="' + (width - pad.right) + '" y2="' + ty + '" ' +
                   'stroke="#f59e0b" stroke-width="1" stroke-dasharray="4 2" />';
            // Threshold label
            var threshMeth = getMethodologyLabel(trendData.threshold.methodology);
            var threshLabel = (trendData.threshold.isAdjusted && trendData.threshold.methodology === 'mlsn' ? '\u25B2' : '') +
                              trendData.threshold.mlsn;
            svg += '<text x="' + (pad.left - 4) + '" y="' + (parseFloat(ty) + 3) + '" ' +
                   'text-anchor="end" fill="#f59e0b" font-size="9">' + threshLabel + '</text>';
        }

        // Build polyline path
        var pathParts = [];
        for (var p = 0; p < points.length; p++) {
            var px = xScale(p).toFixed(1);
            var py = yScale(points[p].value).toFixed(1);
            pathParts.push((p === 0 ? 'M' : 'L') + ' ' + px + ' ' + py);
        }
        svg += '<path d="' + pathParts.join(' ') + '" fill="none" ' +
               'stroke="' + color + '" stroke-width="2" stroke-linejoin="round" />';

        // Data points + value labels
        for (var d = 0; d < points.length; d++) {
            var cx = xScale(d).toFixed(1);
            var cy = yScale(points[d].value).toFixed(1);

            svg += '<circle cx="' + cx + '" cy="' + cy + '" r="3" ' +
                   'fill="' + color + '" stroke="white" stroke-width="1.5" />';

            // Value labels above points
            if (showLabels) {
                svg += '<text x="' + cx + '" y="' + (parseFloat(cy) - 7) + '" ' +
                       'text-anchor="middle" fill="var(--gaip-text)" font-size="9" font-weight="500">' +
                       roundDisplay(points[d].value) + '</text>';
            }
        }

        // Date labels on x-axis
        if (showLabels) {
            var labelIndices;
            if (points.length <= CONFIG.maxInlineLabels) {
                labelIndices = [];
                for (var li = 0; li < points.length; li++) labelIndices.push(li);
            } else {
                labelIndices = [0, points.length - 1];
            }

            for (var la = 0; la < labelIndices.length; la++) {
                var idx = labelIndices[la];
                var dateLabel = formatShortDate(points[idx].date);
                svg += '<text x="' + xScale(idx).toFixed(1) + '" y="' + (height - 3) + '" ' +
                       'text-anchor="middle" fill="var(--gaip-text-muted)" font-size="8">' + dateLabel + '</text>';
            }
        }

        svg += '</svg>';
        return svg;
    }

    // =========================================================================
    // FORMATTING HELPERS
    // =========================================================================

    var SHORT_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                        'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    function formatShortDate(dateStr) {
        if (!dateStr) return '';
        var d = new Date(dateStr);
        if (isNaN(d.getTime())) return dateStr;
        return SHORT_MONTHS[d.getMonth()] + ' ' + String(d.getFullYear()).slice(2);
    }

    function roundDisplay(value) {
        if (value >= 100) return Math.round(value);
        if (value >= 10) return Math.round(value * 10) / 10;
        return Math.round(value * 100) / 100;
    }

    function signedNumber(n) {
        if (n > 0) return '+' + n;
        return '' + n;
    }

    // =========================================================================
    // TREND SUMMARY STRIP
    // =========================================================================

    /**
     * Render the compact trend summary strip above MLSN cards.
     *
     * @param {Array} sampleGroup - Sorted samples for one zone
     * @param {string} dataType - 'soil'
     * @param {string} zoneLabel - Display label for the zone
     * @returns {string} HTML
     */
    function renderTrendSummary(sampleGroup, dataType, zoneLabel) {
        var typeConf = TYPE_CONFIG[dataType] || TYPE_CONFIG.soil;
        var nutrients = typeConf.nutrients;
        var indicators = [];
        var warnings = [];

        for (var i = 0; i < nutrients.length; i++) {
            var trend = calculateNutrientTrend(sampleGroup, nutrients[i], dataType);
            if (!trend) continue;

            // Direction arrow
            var arrow, dirClass;
            if (trend.direction === 'increasing') {
                arrow = '\u2197'; // ↗
                dirClass = 'increasing';
            } else if (trend.direction === 'decreasing') {
                arrow = '\u2198'; // ↘
                dirClass = 'decreasing';
            } else {
                arrow = '\u2192'; // →
                dirClass = 'stable';
            }

            indicators.push(
                '<span class="gaip-trend-indicator gaip-trend-indicator--' + dirClass + '">' +
                    '<span class="gaip-trend-indicator-nutrient">' + nutrients[i] + '</span>' +
                    '<span class="gaip-trend-indicator-arrow">' + arrow + '</span>' +
                    '<span class="gaip-trend-indicator-value">' + signedNumber(trend.absoluteChange) + '</span>' +
                '</span>'
            );

            // Crossing risk warnings
            if (trend.crossingRisk) {
                var methName = trend.threshold
                    ? getMethodologyLabel(trend.threshold.methodology)
                    : 'MLSN';
                var unitName = trend.threshold
                    ? getMethodologyUnit(trend.threshold.methodology)
                    : ' ppm';

                if (trend.crossingRisk.status === 'below') {
                    warnings.push(
                        '<div class="gaip-trend-warning gaip-trend-warning--critical">' +
                            '\u26A0 ' + nutrients[i] + ' is below ' + methName + ' minimum (' +
                            trend.latest + unitName + ' vs ' + trend.threshold.mlsn + unitName + ')' +
                        '</div>'
                    );
                } else if (trend.crossingRisk.status === 'above') {
                    warnings.push(
                        '<div class="gaip-trend-warning gaip-trend-warning--critical">' +
                            '\u26A0 ' + nutrients[i] + ' exceeds ' + methName + ' limit (' +
                            trend.latest + ' vs ' + trend.threshold.mlsn + ')' +
                        '</div>'
                    );
                } else if (trend.crossingRisk.status === 'warning') {
                    var dirWord = (trend.threshold && trend.threshold.methodology === 'water')
                        ? 'rising toward' : 'declining toward';
                    warnings.push(
                        '<div class="gaip-trend-warning">' +
                            '\u26A0 ' + nutrients[i] + ' ' + dirWord + ' ' + methName + ' threshold ' +
                            '(\u2248' + trend.crossingRisk.monthsUntilCrossing + ' months at ' +
                            trend.crossingRisk.slopePerMonth + unitName + '/month)' +
                        '</div>'
                    );
                }
            }
        }

        if (indicators.length === 0) return '';

        // Date range
        var first = sampleGroup[0];
        var last = sampleGroup[sampleGroup.length - 1];
        var dateRange = formatShortDate(first.date) + ' \u2192 ' + formatShortDate(last.date);

        var html = '<div class="gaip-trend-summary">';
        html += '<div class="gaip-trend-summary-header">';
        html += '<span class="gaip-trend-summary-title">';
        html += '\uD83D\uDCC8 ' + typeConf.label + ' Trends';
        if (zoneLabel) html += ' (' + escapeHTML(zoneLabel) + ')';
        html += '</span>';
        html += '<span class="gaip-trend-summary-meta">' +
                sampleGroup.length + ' tests, ' + dateRange + '</span>';
        html += '</div>';

        html += '<div class="gaip-trend-indicators">' + indicators.join('') + '</div>';

        if (warnings.length > 0) {
            html += '<div class="gaip-trend-warnings">' + warnings.join('') + '</div>';
        }

        html += '</div>';
        return html;
    }

    // =========================================================================
    // PER-NUTRIENT TREND SECTION (inside MLSN card)
    // =========================================================================

    /**
     * Build the trend section HTML for injection into an expanded MLSN card.
     */
    function buildTrendSection(trendData) {
        var html = '<div class="gaip-nutrient-trend-header">Trend History</div>';

        // SVG chart
        html += '<div class="gaip-nutrient-trend-chart">';
        html += renderTrendChart(trendData);
        html += '</div>';

        // Meta line: change + margin
        html += '<div class="gaip-nutrient-trend-meta">';

        // Change indicator
        var changeClass = 'neutral';
        if (trendData.direction === 'increasing') changeClass = 'positive';
        if (trendData.direction === 'decreasing') changeClass = 'negative';

        html += '<span class="gaip-trend-change gaip-trend-change--' + changeClass + '">';
        html += signedNumber(trendData.absoluteChange) + ' ppm';
        if (trendData.percentChange !== null) {
            html += ' (' + signedNumber(trendData.percentChange) + '%)';
        }
        html += ' from last test';
        html += '</span>';

        // Threshold margin
        if (trendData.mlsnMargin !== null) {
            var methLabel = trendData.threshold
                ? getMethodologyLabel(trendData.threshold.methodology)
                : 'MLSN';
            var unitLabel = trendData.threshold
                ? getMethodologyUnit(trendData.threshold.methodology)
                : ' ppm';
            var isWater = trendData.threshold && trendData.threshold.methodology === 'water';
            html += '<span>';
            if (isWater) {
                html += 'Margin: ' + Math.abs(trendData.mlsnMargin) + unitLabel + (trendData.mlsnMargin >= 0 ? ' below' : ' above') + ' ' + methLabel;
            } else {
                html += 'Margin: ' + signedNumber(trendData.mlsnMargin) + unitLabel + ' above ' + methLabel;
            }
            html += '</span>';
        }

        html += '</div>';

        // Crossing risk alert
        if (trendData.crossingRisk) {
            var alertMeth = trendData.threshold
                ? getMethodologyLabel(trendData.threshold.methodology)
                : 'MLSN';
            var alertUnit = trendData.threshold
                ? getMethodologyUnit(trendData.threshold.methodology)
                : ' ppm';

            if (trendData.crossingRisk.status === 'below') {
                html += '<div class="gaip-trend-crossing-alert gaip-trend-crossing-alert--below">';
                html += 'Below ' + alertMeth + ' minimum. Corrective application recommended.';
                html += '</div>';
            } else if (trendData.crossingRisk.status === 'above') {
                html += '<div class="gaip-trend-crossing-alert gaip-trend-crossing-alert--below">';
                html += 'Above ' + alertMeth + ' limit. Management action recommended.';
                html += '</div>';
            } else if (trendData.crossingRisk.status === 'warning') {
                html += '<div class="gaip-trend-crossing-alert gaip-trend-crossing-alert--warning">';
                html += 'At current rate (' + trendData.crossingRisk.slopePerMonth +
                        alertUnit + '/month), may exceed ' + alertMeth + ' in ~' +
                        trendData.crossingRisk.monthsUntilCrossing + ' months.';
                html += '</div>';
            }
        }

        return html;
    }

    // =========================================================================
    // MAIN INTEGRATION: ATTACH TRENDS TO PROGRESSIVE DISCLOSURE CARDS
    // =========================================================================

    /**
     * Data-type configuration for DOM targeting.
     */
    var TYPE_CONFIG = {
        soil: {
            nutrients: CONFIG.soilNutrients,
            containerSelector: '.gaip-mlsn-progressive-container',
            gridSelector: '.gaip-mlsn-cards-grid',
            cardSelector: '.gaip-diagnostic-card.mlsn-card',
            cardNutrientAttr: 'data-nutrient',
            label: 'Soil'
        },
        tissue: {
            nutrients: CONFIG.tissueNutrients,
            containerSelector: '.gaip-tissue-progressive-container',
            gridSelector: '.gaip-tissue-cards-grid',
            cardSelector: '.gaip-diagnostic-card.tissue-card',
            cardNutrientAttr: null, // uses h4.gaip-parameter text
            label: 'Tissue'
        },
        water: {
            nutrients: CONFIG.waterNutrients,
            containerSelector: '.gaip-water-progressive-container',
            gridSelector: '.gaip-water-cards-grid',
            cardSelector: '.gaip-diagnostic-card.water-card',
            cardNutrientAttr: null, // uses h4.gaip-parameter text
            label: 'Water'
        }
    };

    /**
     * Find a card for a given nutrient by data attribute or heading text.
     */
    function findCard(nutrient, typeConf) {
        // Strategy 1: data-nutrient attribute (soil MLSN cards)
        if (typeConf.cardNutrientAttr) {
            return document.querySelector(
                typeConf.cardSelector + '[' + typeConf.cardNutrientAttr + '="' + nutrient + '"]'
            );
        }

        // Strategy 2: match h4.gaip-parameter text (tissue/water cards)
        var cards = document.querySelectorAll(typeConf.cardSelector);

        // Water cards use diagnostic labels matching water-progressive-disclosure-WITH-SOIL-INTERACTION.js
        // Only nutrients that have a rendered .gaip-diagnostic-card water-card are listed here.
        // pH, Ca, Mg, K, SO4 have no standalone water card — do not add them.
        var waterCardMap = {
            'SAR':    'Sodium Hazard (SAR)',
            'SARadj': 'Adjusted SAR (SARadj)',
            'EC':     'Salinity (ECw)',
            'HCO3':   'Residual Sodium Carbonate',
            'Cl':     'Chloride Toxicity',
            'Na':     'Sodium Toxicity',
            'B':      'Boron Toxicity',
            'Fe':     'Iron (Staining Risk)',
            'pH':     'pH',
            'Ca':     'Calcium (Ca)',
            'Mg':     'Magnesium (Mg)',
            'K':      'Potassium (K)',
            'SO4':    'Sulphate (SO4)'
        };

        for (var c = 0; c < cards.length; c++) {
            var paramEl = cards[c].querySelector('h4.gaip-parameter');
            if (paramEl) {
                var paramText = paramEl.textContent.trim();
                // Match nutrient symbol at start of label text
                // e.g. "Nitrogen (N)" matches N, "Sodium Hazard (SAR)" matches SAR,
                // "EC" matches EC, "pH" matches pH, "K" matches K etc.
                if (paramText === nutrient ||
                    paramText === getNutrientFullName(nutrient) ||
                    paramText.indexOf('(' + nutrient + ')') >= 0 ||
                    paramText.indexOf('(' + nutrient + 'w)') >= 0 ||
                    paramText.indexOf(nutrient + ' ') === 0) {
                    return cards[c];
                }
                // Water diagnostic card matching: label starts with mapped name
                if (waterCardMap[nutrient] && paramText.indexOf(waterCardMap[nutrient]) === 0) {
                    return cards[c];
                }
            }
        }
        return null;
    }

    /**
     * Map nutrient symbols to common full names for card matching.
     */
    function getNutrientFullName(nutrient) {
        var names = {
            N: 'Nitrogen (N)', P: 'Phosphorus (P)', K: 'Potassium (K)',
            Ca: 'Calcium (Ca)', Mg: 'Magnesium (Mg)', S: 'Sulphur (S)',
            Fe: 'Iron (Fe)', Mn: 'Manganese (Mn)', Zn: 'Zinc (Zn)',
            Cu: 'Copper (Cu)', B: 'Boron (B)', Na: 'Sodium (Na)',
            Cl: 'Chloride (Cl)', pH: 'pH', EC: 'Salinity (EC)',
            HCO3: 'Bicarbonate (HCO₃)', SO4: 'Sulphate (SO₄)'
        };
        return names[nutrient] || nutrient;
    }

    /**
     * Find the active zone's temporal group and attach trend data to cards.
     *
     * @param {string} dataType - 'soil', 'tissue', or 'water'
     */
    function attachTrendCharts(dataType) {
        dataType = dataType || 'soil';
        var typeConf = TYPE_CONFIG[dataType];
        if (!typeConf) {
            log('Unknown data type: ' + dataType);
            return;
        }

        if (!global.GAIP_SampleManager) {
            log('SampleManager not ready, skipping');
            return;
        }

        var index = buildTemporalIndex(dataType);
        var indexKeys = Object.keys(index);
        if (indexKeys.length === 0) {
            log('No samples in store for ' + dataType);
            return;
        }

        // Find the active sample's zone group
        var activeSample = global.GAIP_SampleManager.getActiveSample(dataType);
        var group = null;
        var zoneLabel = '';

        if (activeSample) {
            var activeZoneKey = deriveZoneKey(activeSample);
            var groupKey = dataType + ':' + (activeSample.zoneType || 'other') + ':' + activeZoneKey;
            group = index[groupKey] || null;
            zoneLabel = activeZoneKey;

            // Fuzzy match on zone key alone
            if (!group) {
                for (var k = 0; k < indexKeys.length; k++) {
                    if (indexKeys[k].endsWith(':' + activeZoneKey)) {
                        group = index[indexKeys[k]];
                        break;
                    }
                }
            }
        }

        // If no active sample or no match, use the largest group
        if (!group) {
            var bestKey = null;
            var bestLen = 0;
            for (var bk = 0; bk < indexKeys.length; bk++) {
                if (index[indexKeys[bk]].length > bestLen) {
                    bestLen = index[indexKeys[bk]].length;
                    bestKey = indexKeys[bk];
                }
            }
            if (bestKey) {
                group = index[bestKey];
                var parts = bestKey.split(':');
                zoneLabel = parts.length >= 3 ? parts.slice(2).join(':') : bestKey;
            }
        }

        if (!group || group.length < 2) {
            log('[' + dataType + '] Need 2+ samples for trends, found: ' + (group ? group.length : 0) + ', trying spatial comparison');
            removeTrendUI(dataType);
            // Still attempt spatial comparison (multiple zones, same date)
            // This is the normal case when all samples are different zones taken at the same time
            attachSpatialComparison(dataType);
            return;
        }

        log('[' + dataType + '] Attaching trends for zone "' + zoneLabel + '" with ' + group.length + ' samples');

        // 1. Render summary strip above cards
        injectTrendSummary(group, dataType, zoneLabel);

        // 2. Attach per-nutrient sections inside cards
        var nutrients = typeConf.nutrients;
        for (var n = 0; n < nutrients.length; n++) {
            var trend = calculateNutrientTrend(group, nutrients[n], dataType);
            if (!trend) continue;

            injectCardTrend(trend, typeConf);
            applyCrossingAlert(trend, typeConf);
        }

        // 3. Dispatch event
        var allTrends = {};
        for (var t = 0; t < nutrients.length; t++) {
            var td = calculateNutrientTrend(group, nutrients[t], dataType);
            if (td) allTrends[nutrients[t]] = td;
        }

        document.dispatchEvent(new CustomEvent('gaip:trend-data-ready', {
            detail: {
                dataType: dataType,
                trends: allTrends,
                index: index,
                activeZone: zoneLabel,
                sampleCount: group.length
            }
        }));
    }

    // =========================================================================
    // DOM INJECTION
    // =========================================================================

    /**
     * Inject the trend summary strip above the MLSN cards grid.
     */
    function injectTrendSummary(group, dataType, zoneLabel) {
        var typeConf = TYPE_CONFIG[dataType] || TYPE_CONFIG.soil;
        var container = document.querySelector(typeConf.containerSelector);
        if (!container) {
            log('[' + dataType + '] Container not found (' + typeConf.containerSelector + '), cannot inject summary');
            return;
        }

        // Remove existing summary for this data type
        var existing = container.querySelector('.gaip-trend-summary');
        if (existing) existing.remove();

        var summaryHTML = renderTrendSummary(group, dataType, zoneLabel);
        if (!summaryHTML) return;

        // Insert before the cards grid
        var cardsGrid = container.querySelector(typeConf.gridSelector);
        if (cardsGrid) {
            cardsGrid.insertAdjacentHTML('beforebegin', summaryHTML);
            log('[' + dataType + '] Trend summary strip injected before cards grid');
        } else {
            container.insertAdjacentHTML('beforeend', summaryHTML);
            log('[' + dataType + '] Trend summary strip appended to container (no cards grid found)');
        }
    }

    /**
     * Inject trend chart section into an MLSN diagnostic card.
     */
    function injectCardTrend(trendData, typeConf) {
        typeConf = typeConf || TYPE_CONFIG.soil;
        
        // Find the card
        var card = findCard(trendData.nutrient, typeConf);
        if (!card) {
            log('Card not found for nutrient: ' + trendData.nutrient + ' (' + typeConf.label + ')');
            return;
        }

        // Target: insert into the "why" section (STATE 2), which is the first expand
        var whySection = card.querySelector('.gaip-why-content');
        if (!whySection) {
            // Fallback: try the sensitivity section
            whySection = card.querySelector('.gaip-sensitivity-content');
        }
        if (!whySection) {
            log('No why/sensitivity section found in card for: ' + trendData.nutrient);
            return;
        }

        // Remove existing trend section
        var existingTrend = whySection.querySelector('.gaip-nutrient-trend-section');
        if (existingTrend) existingTrend.remove();

        // Build and insert
        var section = document.createElement('div');
        section.className = 'gaip-nutrient-trend-section';
        section.innerHTML = buildTrendSection(trendData);

        whySection.appendChild(section);

        log('Trend chart injected into ' + trendData.nutrient + ' card (' + trendData.direction + ', ' + trendData.absoluteChange + ' ppm)');

        // Recalculate maxHeight if the section is currently expanded
        var whyContainer = whySection.closest('.gaip-why-section');
        if (whyContainer && whyContainer.classList.contains('gaip-expanded')) {
            whyContainer.style.maxHeight = whyContainer.scrollHeight + 'px';
        }
    }

    /**
     * Apply crossing risk CSS classes to MLSN cards.
     */
    function applyCrossingAlert(trendData, typeConf) {
        typeConf = typeConf || TYPE_CONFIG.soil;
        var card = findCard(trendData.nutrient, typeConf);
        if (!card) return;

        // Remove existing alert classes
        card.classList.remove('gaip-trend-crossing-warning', 'gaip-trend-below-threshold');

        if (!trendData.crossingRisk) return;

        if (trendData.crossingRisk.status === 'below') {
            card.classList.add('gaip-trend-below-threshold');
        } else if (trendData.crossingRisk.status === 'warning') {
            card.classList.add('gaip-trend-crossing-warning');
        }
    }

    /**
     * Remove all trend UI (when no longer applicable).
     */
    function removeTrendUI(dataType) {
        var scope = document;
        if (dataType && TYPE_CONFIG[dataType]) {
            scope = document.querySelector(TYPE_CONFIG[dataType].containerSelector);
            if (!scope) return;
        }

        // Remove summary strip
        var summaries = scope.querySelectorAll('.gaip-trend-summary');
        for (var s = 0; s < summaries.length; s++) summaries[s].remove();

        // Remove card trend sections
        var sections = scope.querySelectorAll('.gaip-nutrient-trend-section');
        for (var t = 0; t < sections.length; t++) sections[t].remove();

        // Remove alert classes
        var cards = scope.querySelectorAll('.gaip-trend-crossing-warning, .gaip-trend-below-threshold');
        for (var c = 0; c < cards.length; c++) {
            cards[c].classList.remove('gaip-trend-crossing-warning', 'gaip-trend-below-threshold');
        }
    }

    // =========================================================================
    // WORD EXPORT DATA
    // =========================================================================

    /**
     * Get structured trend data for Word export.
     * Called by word-export module to include trends in reports.
     */
    function getTrendExportData(dataType) {
        dataType = dataType || 'soil';
        var index = buildTemporalIndex(dataType);
        var keys = Object.keys(index);
        var trends = {};

        var nutrientMap = {
            soil: CONFIG.soilNutrients,
            tissue: CONFIG.tissueNutrients,
            water: CONFIG.waterNutrients
        };
        var nutrients = nutrientMap[dataType] || CONFIG.soilNutrients;

        for (var k = 0; k < keys.length; k++) {
            var group = index[keys[k]];
            if (group.length < 2) continue;

            var keyParts = keys[k].split(':');
            var zone = keyParts.length >= 3 ? keyParts.slice(2).join(':') : keys[k];

            trends[keys[k]] = {
                zone: zone,
                zoneType: keyParts[1] || 'other',
                sampleCount: group.length,
                dateRange: group[0].date + ' \u2192 ' + group[group.length - 1].date,
                nutrients: {}
            };

            for (var n = 0; n < nutrients.length; n++) {
                var trend = calculateNutrientTrend(group, nutrients[n], dataType);
                if (trend) {
                    trends[keys[k]].nutrients[nutrients[n]] = {
                        direction: trend.direction,
                        change: trend.absoluteChange,
                        percentChange: trend.percentChange,
                        latest: trend.latest,
                        previous: trend.previous,
                        mlsnMargin: trend.mlsnMargin,
                        crossingRisk: trend.crossingRisk
                    };
                }
            }
        }

        return trends;
    }

    // =========================================================================
    // UTILITY
    // =========================================================================

    function escapeHTML(str) {
        var div = document.createElement('div');
        div.appendChild(document.createTextNode(str));
        return div.innerHTML;
    }

    // =========================================================================
    // EVENT WIRING
    // =========================================================================

    /**
     * Debounce to avoid rapid re-renders during batch imports.
     */
    var _attachTimeout = null;
    function debouncedAttach(dataType, delay) {
        if (_attachTimeout) clearTimeout(_attachTimeout);
        _attachTimeout = setTimeout(function() {
            attachTrendCharts(dataType || 'soil');
        }, delay || 300);
    }

    /**
     * Check if the MLSN progressive disclosure container is in the DOM
     * and has rendered cards. If not, retry with backoff.
     */
    var _retryCount = 0;
    var _retryMax = 5;
    var _retryTimeout = null;

    function attachWithRetry(dataType) {
        dataType = dataType || 'soil';
        var typeConf = TYPE_CONFIG[dataType] || TYPE_CONFIG.soil;

        // If no samples exist for this site+type, skip card-wait entirely and go straight
        // to spatial (or do nothing). Avoids the 5-retry loop on sites with no soil data.
        var SM = global.GAIP_SampleManager;
        var sampleCount = SM ? (SM.getSamples(dataType) || []).length : -1;
        if (sampleCount === 0) {
            log('[' + dataType + '] No samples on this site, skipping card retry, attempting spatial only');
            _retryCount = 0;
            attachSpatialComparison(dataType);
            return;
        }

        var container = document.querySelector(typeConf.containerSelector);
        var hasCards = container && container.querySelector(typeConf.cardSelector);

        if (hasCards) {
            _retryCount = 0;
            attachTrendCharts(dataType);
        } else if (_retryCount < _retryMax) {
            _retryCount++;
            var delay = _retryCount * 500;
            log('[' + dataType + '] Cards not in DOM yet, retry ' + _retryCount + '/' + _retryMax + ' in ' + delay + 'ms');
            if (_retryTimeout) clearTimeout(_retryTimeout);
            _retryTimeout = setTimeout(function() {
                attachWithRetry(dataType);
            }, delay);
        } else {
            log('MLSN cards not found after ' + _retryMax + ' retries, giving up for this cycle');
            _retryCount = 0;
            // Still attempt spatial (multi-zone same-date scenario)
            attachSpatialComparison(dataType);
        }
    }

    function init() {
        // Always log init regardless of debug flag so we can confirm the module loaded
        console.log('[NutrientTrend] v' + CONFIG.version + ' initialised');

        // Multi-source overlay toggle (collapse/expand)
        document.addEventListener('click', function(e) {
            var hdr = e.target.closest('.gaip-mso-toggle-btn');
            if (!hdr) return;
            var body = hdr.nextElementSibling;
            if (!body) return;
            var collapsed = body.style.display === 'none';
            body.style.display = collapsed ? 'block' : 'none';
            var tog = hdr.querySelector('.gaip-mso-toggle');
            if (tog) tog.textContent = collapsed ? '▼' : '▶';
        });

        // Click to enlarge a multi-source chart cell
        document.addEventListener('click', function(e) {
            var cell = e.target.closest('.gaip-mso-expandable');
            if (!cell) return;
            var nutrient = cell.getAttribute('data-nutrient');
            var label    = cell.getAttribute('data-label');
            var dtype    = cell.getAttribute('data-dtype');
            if (!nutrient || !dtype) return;

            // Build a large version of the chart
            var SM = global.GAIP_SampleManager;
            if (!SM || !global.GilbaNutrientTrend) return;
            var srcIdx = buildMultiSourceIndex(dtype);
            if (!srcIdx || Object.keys(srcIdx).length < 1) return;

            // Render large SVG (500x300)
            var savedW = 280, savedH = 120, savedPad = { t: 14, r: 14, b: 28, l: 40 };
            // Temporarily override dims via closure trick: pass large dims directly
            var largeSvg = renderMultiSourceChartLarge(srcIdx, nutrient, dtype, SOURCE_COLOURS, 500, 300, { t: 24, r: 20, b: 40, l: 52 });
            if (!largeSvg) return;

            // Source legend for overlay
            var srcKeys = Object.keys(srcIdx);
            var legendHtml = '<div style="display:flex;flex-wrap:wrap;gap:10px;margin-bottom:14px;">';
            for (var li = 0; li < srcKeys.length; li++) {
                var col = SOURCE_COLOURS[li % SOURCE_COLOURS.length];
                legendHtml += '<span style="display:flex;align-items:center;gap:5px;font-size:13px;color:#374151;">' +
                    '<span style="display:inline-block;width:12px;height:12px;border-radius:50%;background:' + col + ';flex-shrink:0;"></span>' +
                    escapeHTML(srcKeys[li]) + '</span>';
            }
            legendHtml += '</div>';

            var overlay = document.createElement('div');
            overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.55);z-index:10005;display:flex;align-items:center;justify-content:center;padding:16px;';
            var dialog = document.createElement('div');
            dialog.style.cssText = 'background:#ffffff;color:#111827;border-radius:12px;padding:20px 24px;max-width:580px;width:100%;box-shadow:0 12px 40px rgba(0,0,0,0.3);';
            dialog.innerHTML =
                '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">' +
                    '<span style="font-weight:700;font-size:16px;color:#1e3a5f;">' + escapeHTML(label) + '</span>' +
                    '<button class="gaip-mso-close-large" style="border:none;background:none;font-size:20px;cursor:pointer;color:#6b7280;line-height:1;">&times;</button>' +
                '</div>' +
                legendHtml +
                '<div style="width:100%;overflow:hidden;">' + largeSvg + '</div>';
            dialog.querySelector('.gaip-mso-close-large').onclick = function() { overlay.remove(); };
            overlay.onclick = function(ev) { if (ev.target === overlay) overlay.remove(); };
            overlay.appendChild(dialog);
            document.body.appendChild(overlay);
        });

        // Primary hook: after main analysis completes
        // Handles soil, tissue, and water all at once (all render during this event)
        document.addEventListener('gaip:analysis-complete', function() {
            log('Analysis complete, attaching trends for all data types');
            _retryCount = 0;
            setTimeout(function() {
                attachWithRetry('soil');
            }, 800);
            // Tissue and water cards render in same cycle
            setTimeout(function() {
                attachTrendCharts('tissue');
            }, 1200);
            setTimeout(function() {
                attachTrendCharts('water');
            }, 1400);
            // Multi-source overlay: fires after spatial, shows all sources on one chart
            setTimeout(function() {
                attachMultiSourceOverlay('water');
                attachMultiSourceOverlay('soil');
                attachMultiSourceOverlay('tissue');
            }, 1800);
        });

        // Sample lifecycle events
        document.addEventListener('gaip:sample-loaded', function(e) {
            var dt = (e.detail && e.detail.dataType) || 'soil';
            var typeConf = TYPE_CONFIG[dt];
            if (typeConf && document.querySelector(typeConf.cardSelector)) {
                debouncedAttach(dt);
            }
        });

        document.addEventListener('gaip:sample-added', function(e) {
            var dt = (e.detail && e.detail.dataType) || 'soil';
            var typeConf = TYPE_CONFIG[dt];
            if (typeConf && document.querySelector(typeConf.cardSelector)) {
                debouncedAttach(dt);
            }
        });

        document.addEventListener('gaip:samples-imported', function(e) {
            var dt = (e.detail && e.detail.dataType) || 'soil';
            var typeConf = TYPE_CONFIG[dt];
            if (typeConf && document.querySelector(typeConf.cardSelector)) {
                debouncedAttach(dt);
            }
        });

        document.addEventListener('gaip:sample-deleted', function() {
            debouncedAttach('soil');
        });

        document.addEventListener('gaip:samples-cleared', function() {
            removeTrendUI();
        });

        document.addEventListener('gaip:all-samples-cleared', function() {
            removeTrendUI();
        });

        // Samples restored from localStorage on page load
        // Cards won't be in DOM yet — gaip:analysis-complete will handle the actual attach.
        // Just reset retry counter so attach logic is ready.
        document.addEventListener('gaip:samples-restored', function() {
            _retryCount = 0;
        });

        // Site switch — clear stale trend UI; next analysis-complete re-attaches
        document.addEventListener('gaip:site-changed', function() {
            removeTrendUI();
            _retryCount = 0;
        });

        // MutationObservers for all three result bodies
        var observerTargets = [
            { selector: '.gaip-mlsn-body', dataType: 'soil' },
            { selector: '.gaip-tissue-body, .gaip-result-body:has(.gaip-tissue-progressive-container)', dataType: 'tissue' },
            { selector: '.gaip-water-body, .gaip-result-body:has(.gaip-water-progressive-container)', dataType: 'water' }
        ];

        for (var ot = 0; ot < observerTargets.length; ot++) {
            (function(target) {
                var el = document.querySelector(target.selector);
                if (el) {
                    var observer = new MutationObserver(function(mutations) {
                        var hasNew = false;
                        for (var m = 0; m < mutations.length; m++) {
                            if (mutations[m].type === 'childList' && mutations[m].addedNodes.length > 0) {
                                hasNew = true;
                                break;
                            }
                        }
                        if (hasNew) {
                            log('MutationObserver: ' + target.dataType + ' content changed');
                            debouncedAttach(target.dataType, 600);
                        }
                    });
                    observer.observe(el, { childList: true, subtree: false });
                    log('MutationObserver attached for ' + target.dataType + ' (' + target.selector + ')');
                }
            })(observerTargets[ot]);
        }

        log('Nutrient Trend Tracking v' + CONFIG.version + ' ready');
    }

    // Initialize on DOM ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        setTimeout(init, 150);
    }

    // =========================================================================
    // SPATIAL COMPARISON — multiple zones, same (or near) date
    // =========================================================================

    /**
     * Build a spatial index: groups samples by (dataType, normalizedDate),
     * where normalizedDate = ISO date rounded to the nearest 14-day window.
     *
     * "Green 1 Jan 2025", "Green 2 Jan 2025", "Green 3 Jan 2025" → same bucket.
     * Requires 2+ distinct zones in the same bucket to be useful.
     *
     * @param {string} dataType
     * @returns {Object} { 'soil:2025-01-01': [sample, sample, ...], ... }
     */
    function buildSpatialIndex(dataType) {
        if (!global.GAIP_SampleManager) return {};

        var samples = global.GAIP_SampleManager.getSamples(dataType);
        if (!samples || samples.length === 0) return {};

        var index = {};

        for (var i = 0; i < samples.length; i++) {
            var sample = samples[i];
            var d = new Date(sample.date);
            if (isNaN(d.getTime())) continue;

            // Round to 14-day window (fortnight bucket) so samples a few days apart
            // within the same sampling round are grouped together.
            var dayOfYear = Math.floor((d - new Date(d.getFullYear(), 0, 0)) / 86400000);
            var bucket = d.getFullYear() + '-' + String(Math.floor(dayOfYear / 14)).padStart(3, '0');
            var key = dataType + ':' + bucket;

            if (!index[key]) index[key] = [];
            index[key].push(sample);
        }

        // Filter to buckets with 2+ distinct zone keys (i.e. actual spatial comparison)
        var result = {};
        var keys = Object.keys(index);
        for (var k = 0; k < keys.length; k++) {
            var group = index[keys[k]];
            var zoneKeys = {};
            for (var g = 0; g < group.length; g++) {
                zoneKeys[deriveZoneKey(group[g])] = true;
            }
            if (Object.keys(zoneKeys).length >= 2) {
                result[keys[k]] = group;
            }
        }

        console.log('[NutrientTrend] buildSpatialIndex(' + dataType + '): all buckets:',
            Object.keys(index).map(function(k) {
                var zk = {}; index[k].forEach(function(s){ zk[deriveZoneKey(s)] = 1; });
                return k + ' zones=' + Object.keys(zk).join(',');
            }),
            'qualifying:', Object.keys(result));

        return result;
    }

    /**
     * Get the spatial group for comparison.
     * Merges ALL qualifying buckets so every zone appears, deduplicating by
     * zone key — newer samples win when the same zone appears in multiple rounds.
     *
     * @param {string} dataType
     * @returns {{ key: string, group: Array }|null}
     */
    function getLatestSpatialGroup(dataType) {
        var index = buildSpatialIndex(dataType);
        var keys = Object.keys(index).sort().reverse(); // newest first
        if (keys.length === 0) return null;

        // Single bucket — return as-is (original behaviour)
        if (keys.length === 1) {
            return { key: keys[0], group: index[keys[0]] };
        }

        // Multiple buckets — merge, keeping the newest sample per zone key
        var seen = {};   // zoneKey -> true
        var merged = [];
        for (var ki = 0; ki < keys.length; ki++) {
            var bucket = index[keys[ki]];
            for (var si = 0; si < bucket.length; si++) {
                var zk = deriveZoneKey(bucket[si]);
                if (!seen[zk]) {
                    seen[zk] = true;
                    merged.push(bucket[si]);
                }
            }
        }

        return { key: keys[0] + '+' + (keys.length - 1) + 'more', group: merged };
    }

    /**
     * Render a horizontal bar chart SVG comparing nutrient values across zones.
     *
     * @param {string} nutrient   - e.g. 'K'
     * @param {Array}  zoneValues - [{ label: 'Green 1', value: 52 }, ...]
     * @param {Object} threshold  - { mlsn, methodology } or null
     * @param {Object} options    - width, height overrides
     * @returns {string} SVG markup
     */
    function renderSpatialBarChart(nutrient, zoneValues, threshold, options) {
        options = options || {};
        var width  = options.width  || 300;
        var height = options.height || Math.max(60, zoneValues.length * 28 + 30);
        var padL = 80, padR = 50, padT = 14, padB = 18;
        var plotW = width  - padL - padR;
        var plotH = height - padT - padB;
        var barH  = Math.max(10, Math.floor((plotH / zoneValues.length) * 0.65));
        var barGap = Math.floor(plotH / zoneValues.length);

        // X domain: 0 to max value (or threshold × 1.2 if larger)
        var maxVal = 0;
        for (var i = 0; i < zoneValues.length; i++) {
            if (zoneValues[i].value > maxVal) maxVal = zoneValues[i].value;
        }
        if (threshold) maxVal = Math.max(maxVal, threshold.mlsn * 1.2);
        if (maxVal === 0) maxVal = 1;

        function xScale(v) { return padL + (v / maxVal) * plotW; }
        function yCenter(idx) { return padT + idx * barGap + barGap / 2; }

        var svg = '<svg width="' + width + '" height="' + height + '" ' +
                  'viewBox="0 0 ' + width + ' ' + height + '" ' +
                  'xmlns="http://www.w3.org/2000/svg" ' +
                  'style="font-family:-apple-system,BlinkMacSystemFont,sans-serif;">';

        // Threshold vertical line
        if (threshold) {
            var tx = xScale(threshold.mlsn).toFixed(1);
            svg += '<line x1="' + tx + '" y1="' + padT + '" ' +
                   'x2="' + tx + '" y2="' + (height - padB) + '" ' +
                   'stroke="#f59e0b" stroke-width="1.5" stroke-dasharray="4 2" />';
            // Threshold label at top
            var threshMethodLabel = threshold ? getMethodologyLabel(threshold.methodology) : 'MLSN';
            svg += '<text x="' + tx + '" y="' + (padT - 2) + '" ' +
                   'text-anchor="middle" fill="#f59e0b" font-size="8">' +
                   threshold.mlsn + ' (' + threshMethodLabel + ')</text>';
        }

        // Bars
        for (var b = 0; b < zoneValues.length; b++) {
            var zv = zoneValues[b];
            var barW = xScale(zv.value) - padL;
            var cy = yCenter(b);
            var y1 = cy - barH / 2;

            // Colour: red if below threshold (soil/tissue), red if above (water), else blue
            var barColor = '#3b82f6';
            if (threshold) {
                var isWater = threshold.methodology === 'water';
                var belowThresh = !isWater && zv.value < threshold.mlsn;
                var aboveThresh = isWater  && zv.value > threshold.mlsn;
                if (belowThresh || aboveThresh) barColor = '#dc2626';
                else if (!isWater && zv.value < threshold.mlsn * 1.15) barColor = '#f59e0b';
            }

            // Bar rect
            if (barW > 0) {
                svg += '<rect x="' + padL + '" y="' + y1.toFixed(1) + '" ' +
                       'width="' + barW.toFixed(1) + '" height="' + barH + '" ' +
                       'fill="' + barColor + '" rx="2" />';
            }

            // Zone label (left side, right-aligned)
            var shortLabel = zv.label.length > 10 ? zv.label.slice(0, 10) + '…' : zv.label;
            svg += '<text x="' + (padL - 5) + '" y="' + (cy + 3.5).toFixed(1) + '" ' +
                   'text-anchor="end" fill="var(--gaip-text)" font-size="9">' +
                   escapeHTML(shortLabel) + '</text>';

            // Value label (right of bar or inside if wide)
            var valX = xScale(zv.value) + 4;
            if (valX + 30 > width) valX = xScale(zv.value) - 4;
            svg += '<text x="' + valX.toFixed(1) + '" y="' + (cy + 3.5).toFixed(1) + '" ' +
                   'fill="var(--gaip-text)" font-size="9" font-weight="500">' +
                   roundDisplay(zv.value) + '</text>';
        }

        svg += '</svg>';
        return svg;
    }

    /**
     * Build the full spatial comparison section HTML for injection above (or below)
     * the MLSN cards grid.
     *
     * @param {Array}  group     - Samples from the spatial bucket
     * @param {string} dataType  - 'soil', 'tissue', or 'water'
     * @returns {string} HTML
     */
    function renderSpatialComparisonSection(group, dataType) {
        var typeConf = TYPE_CONFIG[dataType] || TYPE_CONFIG.soil;
        var nutrients = typeConf.nutrients;

        // Derive zone labels and sort by zone key
        var zoneMap = {};
        for (var i = 0; i < group.length; i++) {
            var s = group[i];
            var zk = deriveZoneKey(s);
            if (!zoneMap[zk]) {
                zoneMap[zk] = { label: s.label || s.id, sample: s };
            }
        }
        var zoneKeys = Object.keys(zoneMap).sort();

        if (zoneKeys.length < 2) return '';

        // Date label — use most common date in group
        var dateCounts = {};
        for (var d = 0; d < group.length; d++) {
            var ds = group[d].date || '';
            dateCounts[ds] = (dateCounts[ds] || 0) + 1;
        }
        var dateLabel = Object.keys(dateCounts).sort(function(a, b) {
            return dateCounts[b] - dateCounts[a];
        })[0] || '';

        var html = '<div class="gaip-spatial-comparison">';
        html += '<div class="gaip-spatial-comparison-header">';
        html += '<span class="gaip-spatial-comparison-title">&#x1F4CA; ' +
                typeConf.label + ' Zone Comparison</span>';
        html += '<span class="gaip-spatial-comparison-meta">' +
                zoneKeys.length + ' zones, ' + formatShortDate(dateLabel) + '</span>';
        html += '</div>';

        html += '<div class="gaip-spatial-charts-grid">';

        var chartCount = 0;
        for (var n = 0; n < nutrients.length; n++) {
            var nutrient = nutrients[n];
            var zoneValues = [];

            for (var z = 0; z < zoneKeys.length; z++) {
                var sample = zoneMap[zoneKeys[z]].sample;
                var val = sample.normalized ? sample.normalized[nutrient] : undefined;
                if (val !== undefined && val !== null && !isNaN(val)) {
                    zoneValues.push({
                        label: zoneMap[zoneKeys[z]].label,
                        zoneKey: zoneKeys[z],
                        value: val
                    });
                }
            }

            // Need at least 2 zones with data for this nutrient
            if (zoneValues.length < 2) continue;

            var threshold = null;
            if (dataType === 'tissue') threshold = getTissueThreshold(nutrient);
            else if (dataType === 'water') threshold = getWaterThreshold(nutrient);
            else threshold = getThreshold(nutrient);

            // Variance flag: CV > 20% = high variability worth showing
            var avg = 0;
            for (var v = 0; v < zoneValues.length; v++) avg += zoneValues[v].value;
            avg /= zoneValues.length;
            var variance = 0;
            for (var vv = 0; vv < zoneValues.length; vv++) {
                variance += Math.pow(zoneValues[vv].value - avg, 2);
            }
            var cv = avg > 0 ? (Math.sqrt(variance / zoneValues.length) / avg * 100) : 0;
            var cvLabel = cv >= 30 ? ' &#x26A0; high CV' : (cv >= 15 ? ' moderate CV' : '');

            html += '<div class="gaip-spatial-chart-item">';
            html += '<div class="gaip-spatial-chart-title">' + nutrient +
                    (cvLabel ? '<span class="gaip-spatial-cv">' + cvLabel + '</span>' : '') +
                    '</div>';
            html += renderSpatialBarChart(nutrient, zoneValues, threshold, { width: 260 });
            html += '</div>';

            chartCount++;
        }

        html += '</div>'; // .gaip-spatial-charts-grid

        if (chartCount === 0) return '';

        // Spatial summary: which zones are below threshold in ≥1 nutrient
        var zoneBelowMap = {};
        for (var nb = 0; nb < nutrients.length; nb++) {
            var thr = null;
            if (dataType === 'tissue') thr = getTissueThreshold(nutrients[nb]);
            else if (dataType === 'water') thr = getWaterThreshold(nutrients[nb]);
            else thr = getThreshold(nutrients[nb]);
            if (!thr) continue;

            for (var zb = 0; zb < zoneKeys.length; zb++) {
                var sp = zoneMap[zoneKeys[zb]].sample;
                var nv = sp.normalized ? sp.normalized[nutrients[nb]] : undefined;
                if (nv === undefined || nv === null || isNaN(nv)) continue;
                var isWaterThr = thr.methodology === 'water';
                var fail = isWaterThr ? nv > thr.mlsn : nv < thr.mlsn;
                if (fail) {
                    if (!zoneBelowMap[zoneKeys[zb]]) zoneBelowMap[zoneKeys[zb]] = [];
                    zoneBelowMap[zoneKeys[zb]].push(nutrients[nb]);
                }
            }
        }

        var failZones = Object.keys(zoneBelowMap);
        if (failZones.length > 0) {
            html += '<div class="gaip-spatial-alerts">';
            for (var fa = 0; fa < failZones.length; fa++) {
                var zLabel = zoneMap[failZones[fa]] ? zoneMap[failZones[fa]].label : failZones[fa];
                html += '<div class="gaip-spatial-alert">';
                html += '&#x26A0; <strong>' + escapeHTML(zLabel) + '</strong>: ';
                html += zoneBelowMap[failZones[fa]].join(', ') + ' at/below threshold';
                html += '</div>';
            }
            html += '</div>';
        }

        html += '</div>'; // .gaip-spatial-comparison
        return html;
    }

    /**
     * Attach spatial comparison section to the DOM.
     * Inserts after the trend summary strip (or before cards grid if no summary).
     *
     * @param {string} dataType
     */
    function attachSpatialComparison(dataType) {
        dataType = dataType || 'soil';
        var typeConf = TYPE_CONFIG[dataType];
        if (!typeConf) return;

        if (!global.GAIP_SampleManager) return;

        var latestSpatial = getLatestSpatialGroup(dataType);
        log('[' + dataType + '] attachSpatialComparison: latestSpatial=' + (latestSpatial ? latestSpatial.key + ' (' + latestSpatial.group.length + ' samples)' : 'null'));

        var container = document.querySelector(typeConf.containerSelector);
        if (!container) {
            log('[' + dataType + '] Spatial: container not found (' + typeConf.containerSelector + ')');
            return;
        }

        // Remove any existing spatial comparison block
        var existing = container.querySelector('.gaip-spatial-comparison');
        if (existing) existing.remove();

        if (!latestSpatial) return; // no multi-zone data

        var html = renderSpatialComparisonSection(latestSpatial.group, dataType);
        if (!html) return;

        // Insert after trend summary (if present), otherwise before cards grid
        var trendSummary = container.querySelector('.gaip-trend-summary');
        var cardsGrid    = container.querySelector(typeConf.gridSelector);

        if (trendSummary) {
            trendSummary.insertAdjacentHTML('afterend', html);
        } else if (cardsGrid) {
            cardsGrid.insertAdjacentHTML('beforebegin', html);
        } else {
            container.insertAdjacentHTML('beforeend', html);
        }

        log('[' + dataType + '] Spatial comparison injected (' +
            latestSpatial.group.length + ' samples in bucket ' + latestSpatial.key + ')');
    }

    // =========================================================================
    // WORD EXPORT — spatial comparison data
    // =========================================================================

    /**
     * Get structured spatial data for Word export.
     * Returns one entry per spatial bucket per nutrient.
     *
     * @param {string} dataType
     * @returns {Array} [{ bucket, dateLabel, zones: [{label, value}], nutrient, cv, threshold }, ...]
     */
    function getSpatialExportData(dataType) {
        dataType = dataType || 'soil';
        var index = buildSpatialIndex(dataType);
        var typeConf = TYPE_CONFIG[dataType] || TYPE_CONFIG.soil;
        var nutrients = typeConf.nutrients;
        var result = [];

        var bucketKeys = Object.keys(index).sort().reverse(); // newest first

        for (var bk = 0; bk < bucketKeys.length; bk++) {
            var group = index[bucketKeys[bk]];

            var zoneMap = {};
            for (var i = 0; i < group.length; i++) {
                var zk = deriveZoneKey(group[i]);
                if (!zoneMap[zk]) zoneMap[zk] = { label: group[i].label || group[i].id, sample: group[i] };
            }
            var zoneKeys = Object.keys(zoneMap).sort();

            // Date label
            var dateCounts = {};
            for (var d = 0; d < group.length; d++) {
                var ds = group[d].date || '';
                dateCounts[ds] = (dateCounts[ds] || 0) + 1;
            }
            var dateLabel = Object.keys(dateCounts).sort(function(a, b) {
                return dateCounts[b] - dateCounts[a];
            })[0] || '';

            for (var n = 0; n < nutrients.length; n++) {
                var nutrient = nutrients[n];
                var zoneValues = [];

                for (var z = 0; z < zoneKeys.length; z++) {
                    var sp = zoneMap[zoneKeys[z]].sample;
                    var val = sp.normalized ? sp.normalized[nutrient] : undefined;
                    if (val !== undefined && val !== null && !isNaN(val)) {
                        zoneValues.push({ label: zoneMap[zoneKeys[z]].label, value: val });
                    }
                }

                if (zoneValues.length < 2) continue;

                var avg = 0;
                for (var v = 0; v < zoneValues.length; v++) avg += zoneValues[v].value;
                avg /= zoneValues.length;
                var variance = 0;
                for (var vv = 0; vv < zoneValues.length; vv++) {
                    variance += Math.pow(zoneValues[vv].value - avg, 2);
                }
                var cv = avg > 0 ? Math.round(Math.sqrt(variance / zoneValues.length) / avg * 1000) / 10 : 0;

                var threshold = null;
                if (dataType === 'tissue') threshold = getTissueThreshold(nutrient);
                else if (dataType === 'water') threshold = getWaterThreshold(nutrient);
                else threshold = getThreshold(nutrient);

                result.push({
                    bucket: bucketKeys[bk],
                    dateLabel: dateLabel,
                    dataType: dataType,
                    nutrient: nutrient,
                    zones: zoneValues,
                    avg: Math.round(avg * 10) / 10,
                    cv: cv,
                    threshold: threshold
                });
            }
        }

        return result;
    }

    // =========================================================================
    // MULTI-SOURCE OVERLAY
    // Plots ALL samples for a dataType on one chart per nutrient,
    // one line per source (zone key), regardless of date bucket.
    // Complements temporal (same-source over time) and spatial (same-date multi-zone).
    // =========================================================================

    var SOURCE_COLOURS = [
        '#2563eb', '#dc2626', '#16a34a', '#d97706', '#7c3aed',
        '#0891b2', '#db2777', '#65a30d', '#ea580c', '#0284c7'
    ];

    /**
     * Build a per-source index: { 'bore water': [s1, s2, ...], '8th pond': [s1], ... }
     * All samples grouped by derived zone key, sorted by date ascending.
     */
    function buildMultiSourceIndex(dataType) {
        var SM = global.GAIP_SampleManager;
        if (!SM) return {};
        var samples = SM.getSamples(dataType);
        if (!samples || samples.length === 0) return {};

        var index = {};
        for (var i = 0; i < samples.length; i++) {
            var s = samples[i];
            var key = deriveZoneKey(s);
            if (!index[key]) index[key] = [];
            index[key].push(s);
        }

        // Sort each source by date ascending
        var keys = Object.keys(index);
        for (var k = 0; k < keys.length; k++) {
            index[keys[k]].sort(function(a, b) {
                return new Date(a.date) - new Date(b.date);
            });
        }
        return index;
    }

    /**
     * Render a small SVG multi-line chart for one nutrient across all sources.
     * Each source = one coloured line. X axis = date, Y = value.
     * Returns SVG string or null if insufficient data.
     * Accepts optional W, H, PAD overrides for the enlarged view.
     */
    function renderMultiSourceChartLarge(sourceIndex, nutrient, dataType, colours, W, H, PAD) {
        return renderMultiSourceChart(sourceIndex, nutrient, dataType, colours, W, H, PAD);
    }

    function renderMultiSourceChart(sourceIndex, nutrient, dataType, colours, _W, _H, _PAD) {
        var W = _W || 280, H = _H || 120, PAD = _PAD || { t: 14, r: 14, b: 28, l: 40 };
        var cW = W - PAD.l - PAD.r;
        var cH = H - PAD.t - PAD.b;

        // Collect all (date, value) points per source
        var sourceData = [];
        var allDates = [];
        var allVals = [];
        var sourceKeys = Object.keys(sourceIndex);

        for (var si = 0; si < sourceKeys.length; si++) {
            var samples = sourceIndex[sourceKeys[si]];
            var pts = [];
            for (var i = 0; i < samples.length; i++) {
                var s = samples[i];
                var val = s.normalized ? s.normalized[nutrient] : undefined;

                // Water EC/pH special lookups (mirrors calculateNutrientTrend)
                if (dataType === 'water' && nutrient === 'EC' && (val === undefined || val === null)) {
                    var nd = s.normalized || {};
                    val = parseFloat(nd.ecw) || parseFloat(nd.ECw) || parseFloat(nd.EC_dSm) || undefined;
                    if (val === undefined && s.rawData) {
                        val = parseFloat(s.rawData.EC) || parseFloat(s.rawData.ECw) || parseFloat(s.rawData.EC_dSm) || undefined;
                    }
                }
                if (dataType === 'water' && nutrient === 'pH' && (val === undefined || val === null)) {
                    var nd2 = s.normalized || {};
                    val = parseFloat(nd2.water_ph) || parseFloat(nd2.pH) || undefined;
                    if (val === undefined && s.rawData) val = parseFloat(s.rawData.pH) || parseFloat(s.rawData.ph) || undefined;
                }
                if (dataType === 'water' && (nutrient === 'SAR' || nutrient === 'SARadj') && (val === undefined || val === null)) {
                    var n2 = s.normalized || {};
                    var Ca_meq = (parseFloat(n2.Ca) || 0) / 20.04;
                    var Mg_meq = (parseFloat(n2.Mg) || 0) / 12.15;
                    var Na_meq = (parseFloat(n2.Na) || 0) / 22.99;
                    var denom = Math.sqrt((Ca_meq + Mg_meq) / 2);
                    if (denom > 0) {
                        var sar2 = Na_meq / denom;
                        if (nutrient === 'SARadj') {
                            // Suarez (1981) adjustment: reduce effective Ca when HCO3 > Ca (calcite precipitation)
                            var HCO3_meq2 = (parseFloat(n2.HCO3) || 0) / 61.02;
                            if (Ca_meq > 0 && HCO3_meq2 > 0) {
                                sar2 = sar2 * (1 + (HCO3_meq2 / Ca_meq) * 0.5);
                            }
                        }
                        val = Math.round(sar2 * 100) / 100;
                    }
                }

                if (val === undefined || val === null || isNaN(parseFloat(val))) continue;
                val = parseFloat(val);
                var d = new Date(s.date);
                if (isNaN(d.getTime())) continue;
                pts.push({ date: d, value: val, label: s.label || s.id });
                allDates.push(d.getTime());
                allVals.push(val);
            }
            if (pts.length > 0) {
                sourceData.push({ key: sourceKeys[si], pts: pts, colour: colours[si % colours.length] });
            }
        }

        // Need at least 2 sources with data, or 1 source with 2+ points
        var totalSources = sourceData.length;
        var totalPoints = 0;
        for (var sd = 0; sd < sourceData.length; sd++) totalPoints += sourceData[sd].pts.length;
        if (totalSources < 1 || totalPoints < 2) return null;

        // Axis ranges
        var minDate = Math.min.apply(null, allDates);
        var maxDate = Math.max.apply(null, allDates);
        var minVal  = Math.min.apply(null, allVals);
        var maxVal  = Math.max.apply(null, allVals);
        var dateRange = maxDate - minDate || 1;
        var valRange  = maxVal - minVal  || 1;
        // Add 10% padding top/bottom
        minVal -= valRange * 0.1;
        maxVal += valRange * 0.1;
        valRange = maxVal - minVal;

        function xPos(d) { return PAD.l + ((d.getTime() - minDate) / dateRange) * cW; }
        function yPos(v) { return PAD.t + cH - ((v - minVal) / valRange) * cH; }

        var svg = '<svg width="' + W + '" height="' + H + '" viewBox="0 0 ' + W + ' ' + H + '" ' +
                  'style="width:100%;max-width:' + W + 'px;height:auto;overflow:visible;">';

        // Grid lines
        svg += '<line x1="' + PAD.l + '" y1="' + PAD.t + '" x2="' + PAD.l + '" y2="' + (PAD.t + cH) + '" stroke="var(--gaip-border)" stroke-width="1"/>';
        svg += '<line x1="' + PAD.l + '" y1="' + (PAD.t + cH) + '" x2="' + (PAD.l + cW) + '" y2="' + (PAD.t + cH) + '" stroke="var(--gaip-border)" stroke-width="1"/>';

        // Y axis labels (min, max)
        var yLabelMin = minVal < 0 ? minVal.toFixed(1) : (minVal < 10 ? minVal.toFixed(2) : Math.round(minVal));
        var yLabelMax = maxVal < 0 ? maxVal.toFixed(1) : (maxVal < 10 ? maxVal.toFixed(2) : Math.round(maxVal));
        svg += '<text x="' + (PAD.l - 3) + '" y="' + (PAD.t + cH) + '" text-anchor="end" font-size="8" fill="var(--gaip-text-muted)">' + yLabelMin + '</text>';
        svg += '<text x="' + (PAD.l - 3) + '" y="' + (PAD.t + 4) + '" text-anchor="end" font-size="8" fill="var(--gaip-text-muted)">' + yLabelMax + '</text>';

        // Threshold line if applicable
        var thr = null;
        if (dataType === 'water') thr = getWaterThreshold(nutrient);
        else if (dataType === 'tissue') thr = getTissueThreshold(nutrient);
        else thr = getThreshold(nutrient);
        if (thr && thr.mlsn !== undefined) {
            var ty = yPos(thr.mlsn);
            if (ty >= PAD.t && ty <= PAD.t + cH) {
                svg += '<line x1="' + PAD.l + '" y1="' + ty + '" x2="' + (PAD.l + cW) + '" y2="' + ty +
                       '" stroke="#f59e0b" stroke-width="1" stroke-dasharray="3,3" opacity="0.7"/>';
            }
        }

        // Draw one line + dots per source
        for (var sd2 = 0; sd2 < sourceData.length; sd2++) {
            var src = sourceData[sd2];
            var colour = src.colour;

            if (src.pts.length >= 2) {
                // Line path
                var path = 'M ' + xPos(src.pts[0].date) + ' ' + yPos(src.pts[0].value);
                for (var p = 1; p < src.pts.length; p++) {
                    path += ' L ' + xPos(src.pts[p].date) + ' ' + yPos(src.pts[p].value);
                }
                svg += '<path d="' + path + '" stroke="' + colour + '" stroke-width="1.5" fill="none" opacity="0.9"/>';
            }

            // Dots + value labels
            for (var dp = 0; dp < src.pts.length; dp++) {
                var pt = src.pts[dp];
                var cx = xPos(pt.date);
                var cy = yPos(pt.value);
                // Larger dot — readable on mobile
                svg += '<circle cx="' + cx + '" cy="' + cy + '" r="5" fill="' + colour + '" stroke="var(--gaip-surface)" stroke-width="1.5">' +
                       '<title>' + escapeHTML(src.key) + ': ' + pt.value + ' (' + pt.date.toLocaleDateString() + ')</title>' +
                       '</circle>';
                // Value label above/below dot — offset alternates to reduce overlap
                var valStr = (Math.abs(pt.value) >= 100) ? Math.round(pt.value) :
                             (Math.abs(pt.value) >= 10)  ? pt.value.toFixed(1) : pt.value.toFixed(2);
                var labelY = cy - 8; // above by default
                if (labelY < PAD.t + 6) labelY = cy + 14; // flip below if near top
                svg += '<text x="' + cx + '" y="' + labelY + '" text-anchor="middle" font-size="8" ' +
                       'fill="' + colour + '" font-weight="600">' + valStr + '</text>';
            }
        }

        // X axis date labels (first and last)
        var d0 = new Date(minDate);
        var d1 = new Date(maxDate);
        var fmt = function(d) { return (d.getMonth()+1) + '/' + (d.getFullYear().toString().slice(2)); };
        svg += '<text x="' + PAD.l + '" y="' + (H - 4) + '" text-anchor="middle" font-size="8" fill="var(--gaip-text-muted)">' + fmt(d0) + '</text>';
        if (dateRange > 0) {
            svg += '<text x="' + (PAD.l + cW) + '" y="' + (H - 4) + '" text-anchor="middle" font-size="8" fill="var(--gaip-text-muted)">' + fmt(d1) + '</text>';
        }

        svg += '</svg>';
        return svg;
    }

    /**
     * Render the full multi-source overlay panel HTML.
     * Shows a grid of charts, one per nutrient that has data across 2+ sources.
     */
    function renderMultiSourceOverlay(dataType) {
        var sourceIndex = buildMultiSourceIndex(dataType);
        var sourceKeys = Object.keys(sourceIndex);
        if (sourceKeys.length < 2) return null; // Need 2+ sources

        var typeConf = TYPE_CONFIG[dataType] || TYPE_CONFIG.soil;
        var nutrients = typeConf.nutrients;

        // Assign colours
        var colours = {};
        for (var ci = 0; ci < sourceKeys.length; ci++) {
            colours[sourceKeys[ci]] = SOURCE_COLOURS[ci % SOURCE_COLOURS.length];
        }

        // Build charts
        var charts = [];
        for (var ni = 0; ni < nutrients.length; ni++) {
            var nutrient = nutrients[ni];
            var svg = renderMultiSourceChart(sourceIndex, nutrient, dataType, SOURCE_COLOURS);
            if (svg) {
                charts.push({ nutrient: nutrient, svg: svg });
            }
        }

        if (charts.length === 0) return null;

        // Legend
        var legendHtml = '<div class="gaip-mso-legend">';
        for (var li = 0; li < sourceKeys.length; li++) {
            var col = SOURCE_COLOURS[li % SOURCE_COLOURS.length];
            legendHtml += '<span class="gaip-mso-legend-item">' +
                '<span class="gaip-mso-swatch" style="background:' + col + ';"></span>' +
                escapeHTML(sourceKeys[li]) +
                '</span>';
        }
        legendHtml += '</div>';

        // Shared nutrient display name map
        var MSO_DISPLAY_NAMES = {
            SAR: 'SAR', SARadj: 'SAR adj', EC: 'EC', pH: 'pH',
            Na: 'Na', Cl: 'Cl', HCO3: 'HCO₃', B: 'B', Fe: 'Fe',
            Ca: 'Ca', Mg: 'Mg', K: 'K', SO4: 'SO₄',
            N: 'N', P: 'P', S: 'S', Mn: 'Mn', Cu: 'Cu', Zn: 'Zn', Mo: 'Mo'
        };

        // Chart grid — each cell is clickable to enlarge
        var gridHtml = '<div class="gaip-mso-grid">';
        for (var ci2 = 0; ci2 < charts.length; ci2++) {
            var label = MSO_DISPLAY_NAMES[charts[ci2].nutrient] || charts[ci2].nutrient;
            gridHtml += '<div class="gaip-mso-cell gaip-mso-expandable"' +
                ' data-nutrient="' + escapeHTML(charts[ci2].nutrient) + '"' +
                ' data-label="' + escapeHTML(label) + '"' +
                ' data-dtype="' + escapeHTML(dataType) + '"' +
                ' title="Click to enlarge">' +
                '<div class="gaip-mso-label">' + escapeHTML(label) +
                ' <span class="gaip-mso-expand-hint">⛶</span></div>' +
                charts[ci2].svg +
                '</div>';
        }
        gridHtml += '</div>';

        var panelId = 'gaip-mso-' + dataType;
        var html =
            '<div class="gaip-multi-source-overlay" id="' + panelId + '">' +
                '<div class="gaip-mso-header gaip-mso-toggle-btn">' +
                    '<span class="gaip-mso-toggle">▼</span>' +
                    '<strong>All Sources, ' + escapeHTML(typeConf.label) + '</strong>' +
                    '<span class="gaip-mso-subtitle"> ' + sourceKeys.length + ' sources, ' + charts.length + ' parameters</span>' +
                '</div>' +
                '<div class="gaip-mso-body">' +
                    legendHtml +
                    gridHtml +
                '</div>' +
            '</div>';

        return html;
    }

    /**
     * Inject the multi-source overlay into the DOM.
     * Fires after spatial comparison, only when 2+ distinct sources exist.
     */
    function attachMultiSourceOverlay(dataType) {
        dataType = dataType || 'water';
        var typeConf = TYPE_CONFIG[dataType];
        if (!typeConf) return;

        var container = document.querySelector(typeConf.containerSelector);
        if (!container) return;

        // Remove existing
        var existing = container.querySelector('.gaip-multi-source-overlay');
        if (existing) existing.remove();

        var html = renderMultiSourceOverlay(dataType);
        if (!html) return;

        // Insert after spatial comparison block, else after trend summary, else before grid
        var spatial   = container.querySelector('.gaip-spatial-comparison');
        var summary   = container.querySelector('.gaip-trend-summary');
        var cardsGrid = container.querySelector(typeConf.gridSelector);

        if (spatial) {
            spatial.insertAdjacentHTML('afterend', html);
        } else if (summary) {
            summary.insertAdjacentHTML('afterend', html);
        } else if (cardsGrid) {
            cardsGrid.insertAdjacentHTML('beforebegin', html);
        } else {
            container.insertAdjacentHTML('beforeend', html);
        }

        log('[' + dataType + '] Multi-source overlay injected (' + Object.keys(buildMultiSourceIndex(dataType)).length + ' sources)');
    }

    // =========================================================================
    // PUBLIC API
    // =========================================================================

    global.GilbaNutrientTrend = {
        // Core analysis
        buildTemporalIndex: buildTemporalIndex,
        buildSpatialIndex: buildSpatialIndex,
        calculateNutrientTrend: calculateNutrientTrend,
        calculateCrossingRisk: calculateCrossingRisk,
        deriveZoneKey: deriveZoneKey,

        // Rendering
        renderTrendChart: renderTrendChart,
        renderTrendSummary: renderTrendSummary,
        renderSpatialBarChart: renderSpatialBarChart,
        renderSpatialComparisonSection: renderSpatialComparisonSection,
        attachTrendCharts: attachTrendCharts,
        attachSpatialComparison: attachSpatialComparison,

        // Export
        getTrendExportData: getTrendExportData,
        getSpatialExportData: getSpatialExportData,
        attachMultiSourceOverlay: attachMultiSourceOverlay,
        renderMultiSourceOverlay: renderMultiSourceOverlay,
        buildMultiSourceIndex: buildMultiSourceIndex,

        // Utilities
        getThreshold: getThreshold,
        linearRegression: linearRegression,

        // Version
        version: CONFIG.version
    };

})(window);
