/**
 * ============================================================================
 * SHADE/DLI FORECAST CHART v1.0.0
 * ============================================================================
 * 
 * Generates seasonal DLI trajectory visualization showing:
 * - Monthly relative DLI across the year
 * - Current month marker
 * - Stress threshold zone
 * - Peak and trough periods
 * 
 * Dependencies:
 * - GilbaCharts (gilba-charts.js) - SVG primitives
 * - Shade Engine (shade-engine.js) - DLI calculations
 * 
 * Integration:
 * - Renders in shade progressive disclosure section
 * - Uses seasonalTrajectory from shade engine
 * 
 * @version 1.0.0
 * @date December 2025
 * @author Gilba Solutions
 * ============================================================================
 */

var ShadeForecast = (function() {
    'use strict';

    // =========================================================================
    // CONFIGURATION
    // =========================================================================

    var CONFIG = {
        minThreshold: 0.6,  // Below 60% of peak = stress period
        colors: {
            line: '#f59e0b',        // Amber for DLI
            lineFill: 'rgba(245, 158, 11, 0.15)',
            point: '#f59e0b',
            pointStroke: 'var(--gaip-surface)',
            stressZone: 'rgba(239, 68, 68, 0.10)',
            adequateZone: 'rgba(34, 197, 94, 0.08)',
            currentMonth: '#3b82f6',
            grid: 'var(--gaip-border)',
            text: 'var(--gaip-text)',
            textMuted: 'var(--gaip-text-muted)',
            peak: '#22c55e',
            trough: '#ef4444'
        }
    };

    // =========================================================================
    // CHART GENERATION
    // =========================================================================

    /**
     * Generate seasonal DLI forecast data
     * @param {Object} shadeResults - Results from shade engine
     * @returns {Object} Forecast data for chart
     */
    function generateForecast(shadeResults) {
        if (!shadeResults || !shadeResults.seasonalTrajectory) {
            return { error: 'No seasonal trajectory data available', months: [] };
        }
        
        var trajectory = shadeResults.seasonalTrajectory;
        var monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 
                         'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        
        var months = [];
        var peakDLI = trajectory.peakDLI || 1.0;
        var stressThreshold = peakDLI * CONFIG.minThreshold;
        
        for (var i = 0; i < 12; i++) {
            var relativeDLI = trajectory.monthlyRelativeDLI[i] || 0;
            var isStress = relativeDLI < stressThreshold;
            var isPeak = i === trajectory.peakMonth;
            var isTrough = i === trajectory.troughMonth;
            
            months.push({
                month: i,
                name: monthNames[i],
                relativeDLI: relativeDLI,
                pctOfPeak: Math.round((relativeDLI / peakDLI) * 100),
                isStress: isStress,
                isPeak: isPeak,
                isTrough: isTrough,
                altitude: trajectory.monthlyAltitude ? trajectory.monthlyAltitude[i] : null
            });
        }
        
        return {
            months: months,
            peakMonth: trajectory.peakMonthName,
            peakDLI: trajectory.peakDLI,
            troughMonth: trajectory.troughMonthName,
            troughDLI: trajectory.troughDLI,
            stressPeriods: trajectory.stressPeriods || [],
            stressThreshold: stressThreshold,
            currentDLI: shadeResults.dliShaded,
            targetDLI: shadeResults.dliTarget,
            deficitPct: shadeResults.deficitPct
        };
    }

    /**
     * Render seasonal DLI chart
     * @param {HTMLElement} container - Container element
     * @param {Object} shadeResults - Shade engine results
     * @returns {boolean} Success status
     */
    function render(container, shadeResults) {
        
        if (!container) {
            console.error('[ShadeForecast] No container provided');
            return false;
        }
        
        var forecast = generateForecast(shadeResults);
        
        if (forecast.error) {
            container.innerHTML = '<div class="gssh-chart-empty">' + forecast.error + '</div>';
            return false;
        }
        
        // Build chart HTML
        var html = buildChartHTML(forecast, shadeResults);
        container.innerHTML = html;
        
        // Attach tooltips after render
        setTimeout(function() {
            attachTooltips(container, forecast);
        }, 50);
        
        return true;
    }

    /**
     * Build chart HTML with SVG
     */
    function buildChartHTML(forecast, shadeResults) {
        var width = 600;
        var height = 180;
        var padding = { top: 20, right: 20, bottom: 35, left: 45 };
        var chartWidth = width - padding.left - padding.right;
        var chartHeight = height - padding.top - padding.bottom;
        
        var months = forecast.months;
        var maxDLI = forecast.peakDLI * 1.1;  // 10% headroom
        var stressThreshold = forecast.stressThreshold;
        var currentMonth = new Date().getMonth();
        
        // Scale functions
        var xScale = function(monthIdx) {
            return padding.left + (monthIdx / 11) * chartWidth;
        };
        var yScale = function(dli) {
            return padding.top + chartHeight - (dli / maxDLI) * chartHeight;
        };
        
        // Build SVG
        var svg = '';
        svg += '<svg viewBox="0 0 ' + width + ' ' + height + '" class="gssh-shade-chart">';
        
        // Stress zone (below threshold)
        var stressY = yScale(stressThreshold);
        svg += '<rect x="' + padding.left + '" y="' + stressY + '" ';
        svg += 'width="' + chartWidth + '" height="' + (chartHeight - (height - padding.bottom - stressY)) + '" ';
        svg += 'fill="' + CONFIG.colors.stressZone + '"/>';
        
        // Adequate zone (above threshold)
        svg += '<rect x="' + padding.left + '" y="' + padding.top + '" ';
        svg += 'width="' + chartWidth + '" height="' + (stressY - padding.top) + '" ';
        svg += 'fill="' + CONFIG.colors.adequateZone + '"/>';
        
        // Horizontal grid lines
        var gridLines = [0.25, 0.5, 0.75, 1.0];
        for (var g = 0; g < gridLines.length; g++) {
            var gridY = yScale(maxDLI * gridLines[g]);
            svg += '<line x1="' + padding.left + '" y1="' + gridY + '" ';
            svg += 'x2="' + (width - padding.right) + '" y2="' + gridY + '" ';
            svg += 'stroke="' + CONFIG.colors.grid + '" stroke-dasharray="2,2"/>';
            
            // Y-axis labels
            svg += '<text x="' + (padding.left - 8) + '" y="' + (gridY + 4) + '" ';
            svg += 'text-anchor="end" fill="' + CONFIG.colors.textMuted + '" font-size="10">';
            svg += Math.round(gridLines[g] * 100) + '%</text>';
        }
        
        // Stress threshold line
        svg += '<line x1="' + padding.left + '" y1="' + stressY + '" ';
        svg += 'x2="' + (width - padding.right) + '" y2="' + stressY + '" ';
        svg += 'stroke="' + CONFIG.colors.trough + '" stroke-width="1" stroke-dasharray="4,2"/>';
        svg += '<text x="' + (width - padding.right - 5) + '" y="' + (stressY - 4) + '" ';
        svg += 'text-anchor="end" fill="' + CONFIG.colors.trough + '" font-size="9">Stress threshold</text>';
        
        // Build line path
        var linePath = 'M';
        var areaPath = 'M' + xScale(0) + ',' + (height - padding.bottom);
        
        for (var i = 0; i < months.length; i++) {
            var x = xScale(i);
            var y = yScale(months[i].relativeDLI);
            
            if (i === 0) {
                linePath += x + ',' + y;
            } else {
                linePath += ' L' + x + ',' + y;
            }
            areaPath += ' L' + x + ',' + y;
        }
        areaPath += ' L' + xScale(11) + ',' + (height - padding.bottom) + ' Z';
        
        // Area fill
        svg += '<path d="' + areaPath + '" fill="' + CONFIG.colors.lineFill + '"/>';
        
        // Line
        svg += '<path d="' + linePath + '" fill="none" stroke="' + CONFIG.colors.line + '" stroke-width="2.5"/>';
        
        // Data points
        for (var j = 0; j < months.length; j++) {
            var px = xScale(j);
            var py = yScale(months[j].relativeDLI);
            var isCurrentMonth = j === currentMonth;
            var pointColor = months[j].isPeak ? CONFIG.colors.peak : 
                            (months[j].isTrough ? CONFIG.colors.trough : CONFIG.colors.point);
            
            // Point circle
            svg += '<circle cx="' + px + '" cy="' + py + '" r="' + (isCurrentMonth ? 6 : 4) + '" ';
            svg += 'fill="' + (isCurrentMonth ? CONFIG.colors.currentMonth : pointColor) + '" ';
            svg += 'stroke="' + CONFIG.colors.pointStroke + '" stroke-width="2" ';
            svg += 'class="gssh-chart-point" data-month="' + j + '"/>';
            
            // Current month indicator
            if (isCurrentMonth) {
                svg += '<text x="' + px + '" y="' + (py - 12) + '" text-anchor="middle" ';
                svg += 'fill="' + CONFIG.colors.currentMonth + '" font-size="10" font-weight="bold">NOW</text>';
            }
        }
        
        // X-axis labels (months)
        for (var m = 0; m < months.length; m++) {
            var mx = xScale(m);
            svg += '<text x="' + mx + '" y="' + (height - padding.bottom + 15) + '" ';
            svg += 'text-anchor="middle" fill="' + CONFIG.colors.text + '" font-size="10">';
            svg += months[m].name + '</text>';
        }
        
        // Y-axis title
        svg += '<text x="12" y="' + (height / 2) + '" text-anchor="middle" ';
        svg += 'transform="rotate(-90, 12, ' + (height / 2) + ')" ';
        svg += 'fill="' + CONFIG.colors.textMuted + '" font-size="11">Relative DLI</text>';
        
        svg += '</svg>';
        
        // Build container with header
        var headerText = 'Peak: <strong style="color:' + CONFIG.colors.peak + '">' + 
                        forecast.peakMonth + '</strong> · Trough: <strong style="color:' + 
                        CONFIG.colors.trough + '">' + forecast.troughMonth + '</strong>';
        
        if (forecast.stressPeriods.length > 0) {
            headerText += ' · Stress: <span style="color:' + CONFIG.colors.trough + '">' + 
                         forecast.stressPeriods.join(', ') + '</span>';
        }
        
        var html = '';
        html += '<div class="gssh-shade-forecast">';
        html += '<div class="gssh-chart-header">';
        html += '<span class="gssh-chart-title">📊 Seasonal DLI Trajectory</span>';
        html += '<span class="gssh-chart-subtitle">12-month light availability</span>';
        html += '</div>';
        html += '<div class="gssh-chart-container">';
        html += '<div class="gssh-chart-info">' + headerText + '</div>';
        html += svg;
        html += '</div>';
        
        // Summary metrics
        html += '<div class="gssh-shade-metrics">';
        html += '<div class="gssh-shade-metric">';
        var currentDLI = shadeResults.dliShaded !== undefined && shadeResults.dliShaded !== null ? shadeResults.dliShaded : 'N/A';
        html += '<span class="gssh-metric-value">' + currentDLI + '</span><br/>';
        html += '<span class="gssh-metric-label">Current DLI</span>';
        html += '</div>';
        html += '<div class="gssh-shade-metric">';
        var targetDLI = shadeResults.dliTarget !== undefined && shadeResults.dliTarget !== null ? shadeResults.dliTarget : 'N/A';
        html += '<span class="gssh-metric-value">' + targetDLI + '</span><br/>';
        html += '<span class="gssh-metric-label">Target DLI</span>';
        html += '</div>';
        html += '<div class="gssh-shade-metric">';
        var deficit = shadeResults.deficitPct !== undefined && shadeResults.deficitPct !== null ? shadeResults.deficitPct : 0;
        html += '<span class="gssh-metric-value">' + deficit + '%</span><br/>';
        html += '<span class="gssh-metric-label">Deficit</span>';
        html += '</div>';
        html += '<div class="gssh-shade-metric">';
        html += '<span class="gssh-metric-value">' + Math.round((forecast.peakDLI - forecast.troughDLI) * 100) + '%</span><br/>';
        html += '<span class="gssh-metric-label">Seasonal Range</span>';
        html += '</div>';
        html += '</div>';
        
        html += '</div>';
        
        return html;
    }

    /**
     * Attach hover tooltips to chart points
     */
    function attachTooltips(container, forecast) {
        var points = container.querySelectorAll('.gssh-chart-point');
        
        points.forEach(function(point) {
            var monthIdx = parseInt(point.getAttribute('data-month'), 10);
            var monthData = forecast.months[monthIdx];
            
            point.addEventListener('mouseenter', function(e) {
                showTooltip(e, monthData, forecast);
            });
            
            point.addEventListener('mouseleave', function() {
                hideTooltip();
            });
        });
    }

    function showTooltip(event, monthData, forecast) {
        var tooltip = document.getElementById('gssh-shade-tooltip');
        if (!tooltip) {
            tooltip = document.createElement('div');
            tooltip.id = 'gssh-shade-tooltip';
            tooltip.className = 'gssh-chart-tooltip';
            document.body.appendChild(tooltip);
        }
        
        var content = '<strong>' + monthData.name + '</strong><br>';
        content += 'Relative DLI: ' + (monthData.relativeDLI * 100).toFixed(0) + '%<br>';
        content += 'Of peak: ' + monthData.pctOfPeak + '%';
        
        if (monthData.isPeak) {
            content += '<br><span style="color:#22c55e">★ Peak month</span>';
        }
        if (monthData.isTrough) {
            content += '<br><span style="color:#ef4444">↓ Lowest DLI</span>';
        }
        if (monthData.isStress) {
            content += '<br><span style="color:#ef4444">⚠ Stress period</span>';
        }
        if (monthData.altitude) {
            content += '<br>Sun altitude: ' + Math.round(monthData.altitude) + '°';
        }
        
        tooltip.innerHTML = content;
        tooltip.style.display = 'block';
        tooltip.style.left = (event.pageX + 10) + 'px';
        tooltip.style.top = (event.pageY - 10) + 'px';
    }

    function hideTooltip() {
        var tooltip = document.getElementById('gssh-shade-tooltip');
        if (tooltip) {
            tooltip.style.display = 'none';
        }
    }

    // =========================================================================
    // PUBLIC API
    // =========================================================================

    return {
        generateForecast: generateForecast,
        render: render,
        CONFIG: CONFIG
    };

})();

// Export for browser/WordPress
if (typeof window !== 'undefined') {
    window.ShadeForecast = ShadeForecast;
}

