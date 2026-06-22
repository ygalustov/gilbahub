/**
 * ============================================================================
 * PGR FORECAST CHART v1.3.0
 * ============================================================================
 * 
 * Generates PGR activity visualization using Kreuser sinewave model:
 * - Suppression phase (0 to threshold GDD)
 * - Rebound phase (threshold to 2× threshold GDD)
 * - GDD accumulation over time
 * - Reapplication threshold marker
 * - Projected reapplication date
 * 
 * v1.3.0 Changes:
 * - Species-specific thresholds with validation status
 * - Removed rate-scaling (research shows rate affects amplitude, not duration)
 * 
 * v1.2.0 Changes:
 * - Rate adjustment indicator in threshold display (removed in v1.3.0)
 * - Pass through rateAdjustment data (now thresholdConfig)
 * 
 * v1.1.0 Changes:
 * - Sinewave decay curve (replaces linear)
 * - Rebound phase visualization
 * - Mowing height indicator
 * - Base temperature display
 * - Extended forecast to show rebound
 * 
 * Dependencies:
 * - PGR Module v2.3 (gilba-pgr-module-v2.js) - species-specific thresholds
 * 
 * @version 1.3.0
 * @date January 2026
 * @author Gilba Solutions
 * ============================================================================
 */

var PGRForecast = (function() {
    'use strict';

    // =========================================================================
    // CONFIGURATION
    // =========================================================================

    var CONFIG = {
        forecastDays: 21,  // Extended to show rebound phase
        showReboundPhase: true,
        colours: {
            // Suppression phase
            suppression: '#8b5cf6',        // Violet for suppression
            suppressionFill: 'rgba(139, 92, 246, 0.15)',
            
            // Rebound phase
            rebound: '#f97316',            // Orange for rebound
            reboundFill: 'rgba(249, 115, 22, 0.12)',
            
            // Reference lines
            baseline: 'var(--gaip-text-secondary)',           // Grey for 100% baseline
            gddLine: '#f59e0b',            // Amber for GDD accumulation
            threshold: '#ef4444',          // Red for reapply threshold
            thresholdZone: 'rgba(239, 68, 68, 0.06)',
            activeZone: 'rgba(34, 197, 94, 0.06)',
            reboundZone: 'rgba(249, 115, 22, 0.06)',
            
            // Markers
            reapplyMarker: '#ef4444',
            peakSuppression: '#7c3aed',
            peakRebound: '#ea580c',
            today: '#3b82f6',
            
            // Text
            grid: 'var(--gaip-border)',
            text: 'var(--gaip-text)',
            textMuted: 'var(--gaip-text-muted)'
        },
        // Product colours
        productColours: {
            TE120: '#10b981',
            TE175: '#059669',
            TE250: '#047857',
            PBZ: '#8b5cf6',
            ETH: '#ec4899',
            primo: '#10b981',
            trimmit: '#3b82f6',
            regulate: '#8b5cf6'
        }
    };

    // =========================================================================
    // SINEWAVE CALCULATION (mirrors PGR module)
    // =========================================================================

    /**
     * Calculate sinewave decay values
     * Matches the sinewaveDecay function in pgr-module-v2.js
     */
    function calculateSinewave(gdd, threshold, amplitude, periodMultiplier) {
        amplitude = amplitude || 0.40;
        periodMultiplier = periodMultiplier || 2.0;
        
        var period = threshold * periodMultiplier;
        
        // Sinewave: Relative Yield = 1 - A × sin(π × GDD / period × 2)
        var relativeYield = 1 - amplitude * Math.sin(Math.PI * gdd / period * 2);
        
        // Suppression is inverse (clamped for display)
        var suppression = 1 - relativeYield;
        
        return {
            relativeYield: relativeYield,
            suppression: suppression,
            // Convert to percentage for display (can go negative in rebound)
            activityPct: Math.max(0, suppression * 100),
            // Relative yield as percentage (>100% = rebound)
            yieldPct: relativeYield * 100,
            isInRebound: relativeYield > 1.0
        };
    }

    // =========================================================================
    // CHART GENERATION
    // =========================================================================

    /**
     * Generate PGR forecast data with sinewave model
     */
    function generateForecast(pgrResults, state) {
        if (!pgrResults || !pgrResults.success) {
            return { error: 'No PGR application data available', days: [] };
        }
        
        var gdd = pgrResults.gdd;
        var projection = pgrResults.projection;
        var product = pgrResults.product;
        var sinewaveModel = pgrResults.sinewaveModel || {};
        var mowingHeight = pgrResults.mowingHeight || {};
        var baseTempConfig = pgrResults.baseTempConfig || {};

        // b35fix201b: projection may be absent when gaip_pgr_calculate is called
        // without a full analysis run (e.g. b35fix199b autofill redraw path).
        // b35fix-plan: derive projection from gdd.days when projection is absent
        // so the chart renders from Plan page where orchestrator doesn't attach projection.
        if (!projection) {
            // gdd.days is a count of days since application (number), gdd.accumulated is total GDD
            var derivedRate = 10; // safe fallback
            if (gdd && gdd.accumulated > 0 && gdd.days > 0) {
                derivedRate = Math.min(50, Math.max(0.5, gdd.accumulated / gdd.days));
            }
            var derivedRemaining = (gdd && gdd.remaining != null) ? gdd.remaining : 0;
            var derivedDaysUntil = derivedRemaining > 0 ? Math.ceil(derivedRemaining / derivedRate) : 0;
            var derivedReapplyDate = (function() {
                var d = new Date();
                d.setDate(d.getDate() + derivedDaysUntil);
                return d.toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' });
            })();
            projection = {
                dailyGDDRate: derivedRate,
                daysUntil: derivedDaysUntil,
                dateFormatted: derivedReapplyDate
            };
        }
        
        // Get sinewave parameters
        var amplitude = sinewaveModel.raw ? sinewaveModel.raw.amplitude : 0.40;
        var periodMultiplier = 2.0;
        
        // Get daily GDD rate — clamp to [0.5, 50] to prevent negative/NaN values
        // from bad weather data producing garbage forecast curves or display text.
        var rawRate = projection ? (projection.dailyGDDRate || 0) : 0;
        var dailyGDDRate = Math.min(50, Math.max(0.5, rawRate || 10));
        
        // Calculate daily forecast
        var days = [];
        var today = new Date();
        var currentGDD = gdd.accumulated || 0;
        var threshold = gdd.threshold || 200;
        
        // Extend forecast to show rebound if enabled
        var forecastDays = CONFIG.showReboundPhase ? 
            Math.max(CONFIG.forecastDays, Math.ceil((threshold * 1.8 - currentGDD) / dailyGDDRate) + 3) :
            CONFIG.forecastDays;
        forecastDays = Math.min(forecastDays, 28); // Cap at 4 weeks
        
        for (var d = 0; d < forecastDays; d++) {
            var date = new Date(today);
            date.setDate(date.getDate() + d);
            
            var projectedGDD = currentGDD + (d * dailyGDDRate);
            var sinewave = calculateSinewave(projectedGDD, threshold, amplitude, periodMultiplier);
            
            // Determine phase
            var phase = 'suppression';
            if (projectedGDD < threshold * 0.25) {
                phase = 'onset';
            } else if (projectedGDD < threshold * 0.75) {
                phase = 'peak';
            } else if (projectedGDD < threshold) {
                phase = 'declining';
            } else if (projectedGDD < threshold * 1.5) {
                phase = 'rebound';
            } else {
                phase = 'expired';
            }
            
            days.push({
                day: d,
                date: date.toISOString().split('T')[0],
                dateLabel: d === 0 ? 'Today' : '+' + d + 'd',
                gddAccumulated: Math.round(projectedGDD),
                // Sinewave values
                relativeYield: sinewave.relativeYield,
                suppression: sinewave.suppression,
                activityPct: Math.round(sinewave.activityPct),
                yieldPct: Math.round(sinewave.yieldPct),
                isInRebound: sinewave.isInRebound,
                phase: phase,
                isOverdue: projectedGDD >= threshold
            });
        }
        
        // Find key points
        var reapplyDay = null;
        var peakSuppressionDay = null;
        var peakSuppressionValue = 0;
        var peakReboundDay = null;
        var peakReboundValue = 100;
        
        for (var i = 0; i < days.length; i++) {
            // Reapplication point
            // b35fix193: reapply window is 75% of threshold (Kreuser & Soldat 2011), not 100%
            if (reapplyDay === null && days[i].gddAccumulated >= threshold * 0.75) {
                reapplyDay = i;
            }
            // Peak suppression (lowest relative yield)
            if (days[i].suppression > peakSuppressionValue && !days[i].isInRebound) {
                peakSuppressionValue = days[i].suppression;
                peakSuppressionDay = i;
            }
            // Peak rebound (highest relative yield above 100%)
            if (days[i].isInRebound && days[i].yieldPct > peakReboundValue) {
                peakReboundValue = days[i].yieldPct;
                peakReboundDay = i;
            }
        }
        
        return {
            days: days,
            product: product,
            currentGDD: currentGDD,
            threshold: threshold,
            dailyGDDRate: dailyGDDRate,
            amplitude: amplitude,
            // Key markers
            reapplyDay: reapplyDay,
            peakSuppressionDay: peakSuppressionDay,
            peakSuppressionPct: Math.round(peakSuppressionValue * 100),
            peakReboundDay: peakReboundDay,
            peakReboundPct: Math.round(peakReboundValue),
            // Status
            reapplyDate: projection.dateFormatted,
            daysUntilReapply: projection.daysUntil,
            isOverdue: gdd.isOverdue,
            currentPhase: sinewaveModel.phase || 'unknown',
            // Config info
            mowingHeight: mowingHeight,
            baseTempConfig: baseTempConfig,
            thresholdConfig: pgrResults.thresholdConfig || null
        };
    }

    /**
     * Render PGR sinewave chart
     */
    function render(container, pgrResults, state) {
        if (!container) {
            console.error('[PGRForecast] No container provided');
            return false;
        }
        
        var forecast = generateForecast(pgrResults, state);
        
        // Skip sinewave chart for products that don't use decay model (e.g., ethephon)
        if (pgrResults && pgrResults.confidence && pgrResults.confidence.showSinewave === false) {
            var productType = pgrResults.product ? pgrResults.product.type : '';
            var isETH = productType === 'ETH';
            
            if (isETH) {
                container.innerHTML = '<div style="padding: 12px; background: linear-gradient(135deg, #fdf4ff 0%, var(--gaip-info-bg) 100%); border-left: 3px solid #a855f7; border-radius: 4px; margin: 10px 0;">' +
                    '<strong style="color: #7c3aed;">🌱 Poa annua Seedhead Timing Model</strong><br>' +
                    '<span style="font-size: 12px; color: var(--gaip-text-secondary); line-height: 1.5;">' +
                    'Ethephon suppresses seedhead emergence via ethylene release. Unlike growth regulators, it does not follow a decay curve.<br><br>' +
                    '<strong>Timing Protocol (GDD&#8320;&#8322; from Jan 1):</strong><br>' +
                    '• <strong>Autumn app (optional):</strong> After last mowing, improves spring control ~25%<br>' +
                    '• <strong>1st spring app:</strong> At 150-200 GDD&#8320;&#8322; (or forsythia bloom / boot stage)<br>' +
                    '• <strong>2nd spring app:</strong> 200 GDD&#8320;&#8322; after first (3-4 weeks), add TE for safety<br><br>' +
                    '<em>Alternative: 50 GDD&#8325;&#8320; from Feb 1 (Mid-Atlantic). Southern hemisphere: Aug 1 biofix.</em>' +
                    '</span></div>';
            } else {
                container.innerHTML = '<div style="padding: 12px; background: var(--gaip-info-bg); border-left: 3px solid #3b82f6; border-radius: 4px; margin: 10px 0;">' +
                    '<strong>Threshold-Only Model</strong><br>' +
                    '<span style="font-size: 12px; color: var(--gaip-text-secondary);">Limited research data for this product/species combination. GDD threshold shown without decay curve.</span></div>';
            }
            return true;
        }
        
        if (forecast.error) {
            // b35fix202b: distinguish between "no application data" (permanent) and
            // "no projection" (transient — weather not yet loaded). Guide the user.
            var isTransient = forecast.error.indexOf('projection') !== -1;
            var msg = isTransient
                ? 'Chart will appear after running analysis with weather data loaded.'
                : forecast.error;
            container.innerHTML = '<div class="gaip-chart-empty" style="color:var(--gaip-text-muted);font-size:12px;padding:16px;">' + msg + '</div>';
            return false;
        }
        
        var html = buildChartHTML(forecast);
        container.innerHTML = html;
        
        return true;
    }

    /**
     * Build chart HTML with SVG - sinewave visualization
     */
    function buildChartHTML(forecast) {
        var width = 650;
        var height = 220;
        var padding = { top: 25, right: 55, bottom: 40, left: 50 };
        var chartWidth = width - padding.left - padding.right;
        var chartHeight = height - padding.top - padding.bottom;
        
        var days = forecast.days;
        var threshold = forecast.threshold;
        var maxGDD = Math.max(threshold * 1.6, days[days.length - 1].gddAccumulated * 1.1);
        
        // Y-axis: Relative Yield (0% to 140% to show rebound)
        var minYield = 40;   // 40%
        var maxYield = 140;  // 140% (shows rebound above 100%)
        var yieldRange = maxYield - minYield;
        
        // Get product color
        var productKey = forecast.product.code || 'primo';
        var productColour = CONFIG.productColours[productKey] || CONFIG.colours.suppression;
        
        // Scale functions
        var xScale = function(dayIdx) {
            return padding.left + (dayIdx / (days.length - 1)) * chartWidth;
        };
        var yScaleYield = function(yieldPct) {
            var clamped = Math.max(minYield, Math.min(maxYield, yieldPct));
            return padding.top + chartHeight - ((clamped - minYield) / yieldRange) * chartHeight;
        };
        var yScaleGDD = function(gdd) {
            return padding.top + chartHeight - (gdd / maxGDD) * chartHeight;
        };
        
        // Key Y positions
        var baselineY = yScaleYield(100);  // 100% yield baseline
        var thresholdX = null;
        
        // Find threshold X position — reapply window at 75% GDD (Kreuser & Soldat 2011)
        for (var t = 0; t < days.length; t++) {
            if (days[t].gddAccumulated >= threshold * 0.75) {
                thresholdX = xScale(t);
                break;
            }
        }
        
        // Build SVG
        var svg = '<svg viewBox="0 0 ' + width + ' ' + height + '" width="100%" style="display:block;overflow:visible;" xmlns="http://www.w3.org/2000/svg">';
        
        // Background zones
        // Suppression zone (below 100% baseline)
        svg += '<rect x="' + padding.left + '" y="' + baselineY + '" ';
        svg += 'width="' + chartWidth + '" height="' + (height - padding.bottom - baselineY) + '" ';
        svg += 'fill="' + CONFIG.colours.activeZone + '"/>';
        
        // Rebound zone (above 100% baseline)
        svg += '<rect x="' + padding.left + '" y="' + padding.top + '" ';
        svg += 'width="' + chartWidth + '" height="' + (baselineY - padding.top) + '" ';
        svg += 'fill="' + CONFIG.colours.reboundZone + '"/>';
        
        // Grid lines
        var gridYields = [60, 80, 100, 120];
        for (var g = 0; g < gridYields.length; g++) {
            var gridY = yScaleYield(gridYields[g]);
            var isBaseline = gridYields[g] === 100;
            svg += '<line x1="' + padding.left + '" y1="' + gridY + '" ';
            svg += 'x2="' + (width - padding.right) + '" y2="' + gridY + '" ';
            svg += 'stroke="' + (isBaseline ? CONFIG.colours.baseline : CONFIG.colours.grid) + '" ';
            svg += 'stroke-width="' + (isBaseline ? '1.5' : '1') + '" ';
            if (!isBaseline) svg += 'stroke-dasharray="3,3" ';
            svg += '/>';
        }
        
        // 100% baseline label
        svg += '<text x="' + (width - padding.right + 5) + '" y="' + (baselineY + 4) + '" ';
        svg += 'fill="' + CONFIG.colours.baseline + '" font-size="10" font-weight="500">100%</text>';
        
        // Threshold vertical line
        if (thresholdX !== null) {
            svg += '<line x1="' + thresholdX + '" y1="' + padding.top + '" ';
            svg += 'x2="' + thresholdX + '" y2="' + (height - padding.bottom) + '" ';
            svg += 'stroke="' + CONFIG.colours.threshold + '" stroke-width="2" stroke-dasharray="6,3"/>';
            svg += '<text x="' + thresholdX + '" y="' + (padding.top - 8) + '" ';
            svg += 'text-anchor="middle" fill="' + CONFIG.colours.threshold + '" font-size="10" font-weight="500">Reapply</text>';
        }
        
        // Build sinewave path
        // Area fill (different colours for suppression vs rebound)
        var suppressionPath = 'M' + xScale(0) + ',' + baselineY;
        var reboundPath = 'M';
        var reboundStarted = false;
        
        for (var j = 0; j < days.length; j++) {
            var jx = xScale(j);
            var jy = yScaleYield(days[j].yieldPct);
            
            if (days[j].yieldPct <= 100) {
                suppressionPath += ' L' + jx + ',' + jy;
            }
            
            if (days[j].yieldPct >= 100) {
                if (!reboundStarted) {
                    reboundPath += jx + ',' + baselineY;
                    reboundStarted = true;
                }
                reboundPath += ' L' + jx + ',' + jy;
            }
        }
        
        // Close suppression area
        var lastSuppressionIdx = 0;
        for (var ls = days.length - 1; ls >= 0; ls--) {
            if (days[ls].yieldPct <= 100) {
                lastSuppressionIdx = ls;
                break;
            }
        }
        suppressionPath += ' L' + xScale(lastSuppressionIdx) + ',' + baselineY + ' Z';
        
        // Close rebound area
        if (reboundStarted) {
            reboundPath += ' L' + xScale(days.length - 1) + ',' + baselineY + ' Z';
            svg += '<path d="' + reboundPath + '" fill="' + CONFIG.colours.reboundFill + '"/>';
        }
        
        svg += '<path d="' + suppressionPath + '" fill="' + CONFIG.colours.suppressionFill + '"/>';
        
        // Sinewave line
        var sinePath = 'M';
        for (var k = 0; k < days.length; k++) {
            var kx = xScale(k);
            var ky = yScaleYield(days[k].yieldPct);
            
            if (k === 0) {
                sinePath += kx + ',' + ky;
            } else {
                sinePath += ' L' + kx + ',' + ky;
            }
        }
        
        // Draw line with gradient effect (purple in suppression, orange in rebound)
        svg += '<path d="' + sinePath + '" fill="none" stroke="' + productColour + '" stroke-width="2.5" stroke-linecap="round"/>';
        
        // Markers
        // Today marker
        svg += '<line x1="' + xScale(0) + '" y1="' + padding.top + '" ';
        svg += 'x2="' + xScale(0) + '" y2="' + (height - padding.bottom) + '" ';
        svg += 'stroke="' + CONFIG.colours.today + '" stroke-width="1.5" stroke-dasharray="4,3"/>';
        svg += '<circle cx="' + xScale(0) + '" cy="' + yScaleYield(days[0].yieldPct) + '" r="5" ';
        svg += 'fill="' + CONFIG.colours.today + '" stroke="var(--gaip-surface)" stroke-width="2"/>';
        
        // Peak suppression marker
        if (forecast.peakSuppressionDay !== null && forecast.peakSuppressionDay < days.length) {
            var psx = xScale(forecast.peakSuppressionDay);
            var psy = yScaleYield(days[forecast.peakSuppressionDay].yieldPct);
            svg += '<circle cx="' + psx + '" cy="' + psy + '" r="4" ';
            svg += 'fill="' + CONFIG.colours.peakSuppression + '" stroke="var(--gaip-surface)" stroke-width="1.5"/>';
        }
        
        // Peak rebound marker
        if (forecast.peakReboundDay !== null && forecast.peakReboundDay < days.length) {
            var prx = xScale(forecast.peakReboundDay);
            var pry = yScaleYield(days[forecast.peakReboundDay].yieldPct);
            svg += '<circle cx="' + prx + '" cy="' + pry + '" r="4" ';
            svg += 'fill="' + CONFIG.colours.peakRebound + '" stroke="var(--gaip-surface)" stroke-width="1.5"/>';
        }
        
        // Data points (every 3rd day)
        for (var p = 3; p < days.length; p += 3) {
            var px = xScale(p);
            var py = yScaleYield(days[p].yieldPct);
            var pointColor = days[p].isInRebound ? CONFIG.colours.rebound : productColour;
            
            svg += '<circle cx="' + px + '" cy="' + py + '" r="3" ';
            svg += 'fill="' + pointColor + '" stroke="var(--gaip-surface)" stroke-width="1"/>';
        }
        
        // X-axis labels
        var labelInterval = Math.ceil(days.length / 7);
        for (var m = 0; m < days.length; m += labelInterval) {
            var mx = xScale(m);
            svg += '<text x="' + mx + '" y="' + (height - padding.bottom + 15) + '" ';
            svg += 'text-anchor="middle" fill="' + CONFIG.colours.text + '" font-size="10">';
            svg += days[m].dateLabel + '</text>';
        }
        
        // Y-axis labels
        svg += '<text x="' + (padding.left - 8) + '" y="' + yScaleYield(120) + '" ';
        svg += 'text-anchor="end" fill="' + CONFIG.colours.textMuted + '" font-size="9">120%</text>';
        svg += '<text x="' + (padding.left - 8) + '" y="' + yScaleYield(80) + '" ';
        svg += 'text-anchor="end" fill="' + CONFIG.colours.textMuted + '" font-size="9">80%</text>';
        svg += '<text x="' + (padding.left - 8) + '" y="' + yScaleYield(60) + '" ';
        svg += 'text-anchor="end" fill="' + CONFIG.colours.textMuted + '" font-size="9">60%</text>';
        
        // Y-axis title
        svg += '<text x="15" y="' + (height / 2) + '" text-anchor="middle" ';
        svg += 'transform="rotate(-90, 15, ' + (height / 2) + ')" ';
        svg += 'fill="' + CONFIG.colours.textMuted + '" font-size="11">Relative Growth</text>';
        
        // Legend
        var legendY = padding.top + 5;
        svg += '<rect x="' + (padding.left + 10) + '" y="' + legendY + '" width="12" height="12" rx="2" fill="' + productColour + '"/>';
        svg += '<text x="' + (padding.left + 26) + '" y="' + (legendY + 10) + '" fill="' + CONFIG.colours.text + '" font-size="10">Suppression</text>';
        
        svg += '<rect x="' + (padding.left + 95) + '" y="' + legendY + '" width="12" height="12" rx="2" fill="' + CONFIG.colours.rebound + '"/>';
        svg += '<text x="' + (padding.left + 111) + '" y="' + (legendY + 10) + '" fill="' + CONFIG.colours.text + '" font-size="10">Rebound</text>';
        
        // Phase labels on curve
        if (days.length > 10) {
            // "Suppression" label
            var suppLabelIdx = Math.min(Math.floor(days.length * 0.3), forecast.peakSuppressionDay || 5);
            if (suppLabelIdx < days.length) {
                svg += '<text x="' + xScale(suppLabelIdx) + '" y="' + (yScaleYield(days[suppLabelIdx].yieldPct) + 15) + '" ';
                svg += 'text-anchor="middle" fill="' + productColour + '" font-size="9" font-style="italic">↓ Suppression</text>';
            }
            
            // "Rebound" label
            if (forecast.peakReboundDay !== null) {
                svg += '<text x="' + xScale(forecast.peakReboundDay) + '" y="' + (yScaleYield(days[forecast.peakReboundDay].yieldPct) - 10) + '" ';
                svg += 'text-anchor="middle" fill="' + CONFIG.colours.rebound + '" font-size="9" font-style="italic">↑ Rebound</text>';
            }
        }
        
        svg += '</svg>';
        
        // ── Status & phase labels ──────────────────────────────────────────────
        var statusText = '';
        var statusColor = 'var(--gaip-text-muted)';

        if (forecast.isOverdue) {
            statusText = 'Reapplication overdue';
            statusColor = CONFIG.colours.threshold;
        } else if (forecast.daysUntilReapply !== null && forecast.daysUntilReapply <= 3) {
            statusText = 'Due in ' + forecast.daysUntilReapply + ' day' + (forecast.daysUntilReapply !== 1 ? 's' : '');
            statusColor = CONFIG.colours.threshold;
        } else if (forecast.reapplyDate) {
            statusText = 'Reapply ' + forecast.reapplyDate;
        }

        var phaseColors = { onset: '#10b981', peak: '#8b5cf6', declining: '#f59e0b', rebound: '#f97316', expired: 'var(--gaip-text-muted)' };
        var phaseLabels = { onset: 'Building', peak: 'Peak suppression', declining: 'Declining', rebound: 'Rebound phase', expired: 'Expired' };
        var phaseLabel  = (forecast.currentPhase && phaseLabels[forecast.currentPhase]) ? phaseLabels[forecast.currentPhase] : null;
        var phaseColor  = (forecast.currentPhase && phaseColors[forecast.currentPhase]) || 'var(--gaip-text-muted)';

        // SVG icon for chart title
        var chartIcon = '<svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" style="flex-shrink:0;color:var(--gaip-accent)"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>';

        // Warning icon (replaces emoji)
        var warnIcon = '<svg width="10" height="10" fill="none" viewBox="0 0 24 24" stroke="#f59e0b" stroke-width="2.5" style="vertical-align:middle"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/></svg>';

        // ── Build HTML ─────────────────────────────────────────────────────────
        var html = '<div style="margin-top:4px">';

        // Header row: icon + title + subtitle
        html += '<div style="display:flex;align-items:center;gap:8px;margin-bottom:10px">' +
            chartIcon +
            '<span style="font-size:13px;font-weight:700;color:var(--gaip-text)">PGR Response Curve</span>' +
            '<span style="font-size:11px;color:var(--gaip-text-muted);font-weight:400">Kreuser sinewave model</span>' +
            '</div>';

        // Product + phase + reapply info row
        var infoItems = [];
        infoItems.push(
            '<span style="display:inline-flex;align-items:center;gap:5px">' +
            '<span style="width:8px;height:8px;border-radius:50%;background:' + productColour + ';flex-shrink:0;display:inline-block"></span>' +
            '<span style="font-size:12px;color:var(--gaip-text);font-weight:500">' + forecast.product.name + '</span>' +
            '</span>'
        );
        if (phaseLabel) {
            infoItems.push('<span style="font-size:12px;color:' + phaseColor + '">' + phaseLabel + '</span>');
        }
        if (statusText) {
            infoItems.push('<span style="font-size:12px;font-weight:600;color:' + statusColor + '">' + statusText + '</span>');
        }
        html += '<div style="display:flex;align-items:center;gap:12px;margin-bottom:10px;flex-wrap:wrap">';
        for (var ii = 0; ii < infoItems.length; ii++) {
            if (ii > 0) html += '<span style="color:var(--gaip-border);font-size:12px">·</span>';
            html += infoItems[ii];
        }
        html += '</div>';

        // SVG chart
        html += '<div style="margin-bottom:12px">' + svg + '</div>';

        // ── Metrics row ────────────────────────────────────────────────────────
        var currentYield = days[0] ? days[0].yieldPct : 100;
        var yieldColor   = currentYield > 100 ? CONFIG.colours.rebound : productColour;

        var thresholdSuffix = '';
        if (forecast.thresholdConfig && !forecast.thresholdConfig.validated) {
            thresholdSuffix = ' ' + warnIcon;
        }
        if (forecast.mowingHeight && forecast.mowingHeight.category) {
            thresholdSuffix += ' <span style="font-size:10px;color:var(--gaip-text-muted)">(' + forecast.mowingHeight.category + ')</span>';
        }

        var metrics = [
            { value: forecast.currentGDD + ' GDD',  label: 'Accumulated<br><span style="font-size:10px;color:var(--gaip-text-muted)">base ' + (forecast.baseTempConfig.value != null ? forecast.baseTempConfig.value : 0) + '°C</span>', color: null },
            { value: forecast.threshold + ' GDD',   label: 'Threshold' + thresholdSuffix, color: null },
            { value: Math.round(currentYield) + '%', label: 'Relative growth', color: yieldColor },
            { value: forecast.peakSuppressionPct + '%', label: 'Peak suppression', color: null }
        ];
        if (forecast.peakReboundPct > 100) {
            metrics.push({ value: forecast.peakReboundPct + '%', label: 'Peak rebound', color: CONFIG.colours.rebound });
        }

        html += '<div style="display:flex;gap:0;border:1px solid var(--gaip-border);border-radius:var(--gaip-radius-sm);overflow:hidden;margin-bottom:10px">';
        for (var mi = 0; mi < metrics.length; mi++) {
            var m = metrics[mi];
            html += '<div style="flex:1;padding:8px 10px;' + (mi > 0 ? 'border-left:1px solid var(--gaip-border);' : '') + 'text-align:center">' +
                '<div style="font-size:14px;font-weight:700;color:' + (m.color || 'var(--gaip-text)') + ';line-height:1.2">' + m.value + '</div>' +
                '<div style="font-size:10px;color:var(--gaip-text-muted);margin-top:2px;line-height:1.3">' + m.label + '</div>' +
                '</div>';
        }
        html += '</div>';

        // ── Explainer note ─────────────────────────────────────────────────────
        html += '<div style="padding:8px 12px;background:var(--gaip-surface-muted);border-left:3px solid var(--gaip-border);border-radius:var(--gaip-radius-sm);font-size:11px;color:var(--gaip-text-muted);line-height:1.5">' +
            'Growth dips during suppression, then rebounds above normal once PGR wears off. ' +
            'Reapply before the 75% threshold window to maintain steady regulation.' +
            '</div>';

        html += '</div>';

        return html;
    }

    // =========================================================================
    // PUBLIC API
    // =========================================================================

    return {
        generateForecast: generateForecast,
        render: render,
        calculateSinewave: calculateSinewave,
        CONFIG: CONFIG
    };

})();

// Export for browser/WordPress
if (typeof window !== 'undefined') {
    window.PGRForecast = PGRForecast;
}

