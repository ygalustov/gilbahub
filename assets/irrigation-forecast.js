/**
 * ============================================================================
 * GILBA IRRIGATION FORECAST CHART v1.0.0
 * ============================================================================
 * 
 * Extends the Irrigation Scheduler UI to provide a timeline visualization
 * of soil moisture balance over the forecast period.
 * 
 * Shows:
 * - Soil depletion percentage as a line/area
 * - Rainfall events as bars
 * - Irrigation recommendations as bars
 * - MAD threshold line
 * 
 * INTEGRATION:
 * - Reads schedule data from irrigation scheduler results
 * - Uses GilbaCharts.createIrrigationTimeline() for rendering
 * - Integrates as progressive disclosure section in irrigation UI
 * 
 * @requires irrigation-scheduler.js
 * @requires gilba-charts.js
 * @version 1.0.0
 * @date December 2025
 * @author Gilba Solutions
 * ============================================================================
 */

var IrrigationForecast = (function() {
    'use strict';

    // =========================================================================
    // CONFIGURATION
    // =========================================================================

    var CONFIG = {
        // Default MAD threshold if not provided
        defaultMAD: 50,
        
        // Minimum days to show
        minDays: 5,
        
        // Status colours
        colors: {
            optimal: '#22c55e',
            adequate: '#84cc16',
            stressed: '#f59e0b',
            critical: '#ef4444'
        }
    };

    // =========================================================================
    // FORECAST ANALYSIS
    // =========================================================================

    /**
     * Analyse irrigation schedule to extract key insights
     */
    function analyseSchedule(schedule, waterBalance) {
        if (!schedule || schedule.length === 0) {
            return { error: 'No schedule data available' };
        }
        
        var analysis = {
            days: schedule.length,
            currentDepletion: waterBalance ? waterBalance.currentDepletion : 0,
            mad: waterBalance ? waterBalance.mad : CONFIG.defaultMAD,
            taw: waterBalance ? waterBalance.taw : 50,
            
            // Irrigation summary
            irrigationDays: 0,
            totalIrrigation: 0,
            totalRainfall: 0,
            totalET: 0,
            
            // Risk analysis
            daysAboveMAD: 0,
            daysCritical: 0,
            peakDepletion: 0,
            peakDepletionDay: 0,
            
            // Water balance trajectory
            trajectory: []
        };
        
        for (var i = 0; i < schedule.length; i++) {
            var day = schedule[i];
            
            // Accumulate totals
            if (day.irrigation && day.irrigation.recommended) {
                analysis.irrigationDays++;
                analysis.totalIrrigation += day.irrigation.totalDepth || 0;
            }
            analysis.totalRainfall += day.precipitation || 0;
            analysis.totalET += day.etc || 0;
            
            // Track depletion
            var depletion = day.depletionPct || 0;
            if (depletion > analysis.peakDepletion) {
                analysis.peakDepletion = depletion;
                analysis.peakDepletionDay = i;
            }
            if (depletion > analysis.mad) {
                analysis.daysAboveMAD++;
            }
            if (depletion > 70) {
                analysis.daysCritical++;
            }
            
            // Build trajectory
            analysis.trajectory.push({
                day: i,
                date: day.date,
                depletionPct: depletion,
                status: classifyDepletion(depletion, analysis.mad)
            });
        }
        
        // Calculate net water balance
        analysis.netBalance = analysis.totalRainfall + analysis.totalIrrigation - analysis.totalET;
        
        // Determine overall status
        if (analysis.daysCritical > 0) {
            analysis.status = 'critical';
            analysis.message = 'Critical stress predicted on ' + analysis.daysCritical + ' day(s)';
        } else if (analysis.daysAboveMAD > 2) {
            analysis.status = 'stressed';
            analysis.message = 'Stress threshold exceeded on ' + analysis.daysAboveMAD + ' days';
        } else if (analysis.irrigationDays === 0 && analysis.totalET > analysis.totalRainfall) {
            analysis.status = 'watch';
            analysis.message = 'No irrigation scheduled despite ET deficit';
        } else {
            analysis.status = 'optimal';
            analysis.message = 'Water balance within acceptable range';
        }
        
        return analysis;
    }

    /**
     * Classify depletion level
     */
    function classifyDepletion(depletion, mad) {
        if (depletion > 70) return 'critical';
        if (depletion > mad) return 'stressed';
        if (depletion > 30) return 'adequate';
        return 'optimal';
    }

    // =========================================================================
    // RENDER FUNCTION
    // =========================================================================

    /**
     * Render irrigation forecast timeline into container
     * 
     * @param {HTMLElement|string} container - Container element or ID
     * @param {Object} irrigationResult - Result from irrigation scheduler
     * @param {Object} options - Rendering options
     */
    function render(container, irrigationResult, options) {
        options = options || {};
        
        if (typeof container === 'string') {
            container = document.getElementById(container);
        }
        
        if (!container) {
            console.warn('IrrigationForecast: Container not found');
            return;
        }
        
        // Handle dormancy or error
        if (!irrigationResult || irrigationResult.dormant || irrigationResult.error) {
            container.innerHTML = '<div class="gaip-chart-empty" style="padding: 20px; text-align: center; color: var(--gaip-text);">' +
                                 '<p>' + (irrigationResult ? (irrigationResult.error || 'Irrigation not required (dormant)') : 'No irrigation data') + '</p></div>';
            return;
        }
        
        var schedule = irrigationResult.schedule;
        var waterBalance = irrigationResult.waterBalance;
        
        if (!schedule || schedule.length < CONFIG.minDays) {
            container.innerHTML = '<div class="gaip-chart-empty" style="padding: 20px; text-align: center; color: var(--gaip-text);">' +
                                 '<p>Insufficient forecast data for timeline</p></div>';
            return;
        }
        
        // Analyse schedule
        var analysis = analyseSchedule(schedule, waterBalance);
        
        // Create wrapper
        var wrapper = document.createElement('div');
        wrapper.className = 'gaip-irrigation-forecast-chart';
        wrapper.style.cssText = 'margin: 16px 0; padding: 16px; background: var(--gaip-surface-muted); border: 1px solid var(--gaip-border); border-radius: 8px;';
        
        // Header with summary
        var statusColor = CONFIG.colors[analysis.status] || 'var(--gaip-text-secondary)';
        var header = document.createElement('div');
        header.style.cssText = 'margin-bottom: 12px; display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 8px;';
        header.innerHTML = 
            '<div style="font-weight: 600; color: var(--gaip-text);">Water Balance Forecast (' + analysis.days + ' days)</div>' +
            '<div style="font-size: 12px; text-align: right;">' +
                '<span style="color: ' + statusColor + '; font-weight: 600;">' + analysis.message + '</span><br>' +
                '<span style="color: var(--gaip-text);">Peak: ' + Math.round(analysis.peakDepletion) + '% depletion on day ' + (analysis.peakDepletionDay + 1) + '</span>' +
            '</div>';
        wrapper.appendChild(header);
        
        // Create chart using GilbaCharts
        if (typeof GilbaCharts !== 'undefined' && GilbaCharts.createIrrigationTimeline) {
            var svg = GilbaCharts.createIrrigationTimeline(schedule, {
                madThreshold: analysis.mad
            });
            wrapper.appendChild(svg);
            
            // Attach tooltips
            GilbaCharts.attachTooltips(wrapper, function(value, label) {
                return label || ('Depletion: ' + value + '%');
            });
        } else {
            wrapper.innerHTML += '<p style="color: #ef4444;">GilbaCharts module not loaded</p>';
        }
        
        // Summary stats bar
        var statsBar = document.createElement('div');
        statsBar.style.cssText = 'display: flex; justify-content: space-around; margin-top: 12px; padding-top: 12px; border-top: 1px solid var(--gaip-border); font-size: 12px;';
        statsBar.innerHTML = 
            '<div style="text-align: center;"><div style="font-weight: 600; color: #f97316;">' + Math.round(analysis.totalET) + ' mm</div><div style="color: var(--gaip-text);">ET Loss</div></div>' +
            '<div style="text-align: center;"><div style="font-weight: 600; color: #06b6d4;">' + Math.round(analysis.totalRainfall) + ' mm</div><div style="color: var(--gaip-text);">Rainfall</div></div>' +
            '<div style="text-align: center;"><div style="font-weight: 600; color: #22c55e;">' + Math.round(analysis.totalIrrigation) + ' mm</div><div style="color: var(--gaip-text);">Irrigation</div></div>' +
            '<div style="text-align: center;"><div style="font-weight: 600; color: ' + (analysis.netBalance >= 0 ? '#22c55e' : '#ef4444') + '">' + 
                (analysis.netBalance >= 0 ? '+' : '') + Math.round(analysis.netBalance) + ' mm</div><div style="color: var(--gaip-text);">Net Balance</div></div>';
        wrapper.appendChild(statsBar);
        
        container.innerHTML = '';
        container.appendChild(wrapper);
        
        return analysis;
    }

    // =========================================================================
    // PUBLIC API
    // =========================================================================

    return {
        CONFIG: CONFIG,
        analyseSchedule: analyseSchedule,
        render: render
    };

})();

// Export for browser/WordPress
if (typeof window !== 'undefined') {
    window.IrrigationForecast = IrrigationForecast;
}
