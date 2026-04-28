/**
 * ============================================================================
 * GILBA CHARTS MODULE v1.1.0
 * ============================================================================
 * 
 * Shared SVG chart primitives for the Gilba Agronomic Intelligence Hub.
 * Provides consistent, responsive timeline charts matching the existing
 * stress trajectory pattern.
 * 
 * v1.1.0 - Taller disease chart for Word export readability
 *   - Default height increased 200→280 (aspect ratio 3:1 → 2.14:1)
 *   - Disease forecast charts render ~40% taller in Word documents
 *   - Risk zones and legend remain proportionally scaled
 * 
 * CHART TYPES:
 * - Timeline Chart: Multi-line forecast with threshold zones
 * - Balance Chart: Stacked area for irrigation water balance
 * 
 * DESIGN PRINCIPLES:
 * - SVG-based for scalability and print-friendliness
 * - Responsive width (100%) with fixed aspect ratio
 * - Consistent colour palette matching hub.css
 * - Interactive hover tooltips
 * - Progressive disclosure integration
 * 
 * @version 1.1.0
 * @date January 2026
 * @author Gilba Solutions
 * ============================================================================
 */

var GilbaCharts = (function() {
    'use strict';

    // =========================================================================
    // HELPER FUNCTIONS
    // =========================================================================
    
    /**
     * Abbreviate disease names for chart legend to prevent overlap
     * Uses partial matching to handle variations in disease name formatting
     */
    function abbreviateDiseaseName(fullName) {
        if (!fullName) return fullName;
        
        // Normalize the name for matching (lowercase, remove extra spaces)
        var normalized = fullName.toLowerCase().trim();
        
        // Match patterns and return abbreviated names
        if (normalized.indexOf('cynodontis') !== -1) return 'B. cynodontis';
        if (normalized.indexOf('sorokiniana') !== -1) return 'B. sorokiniana';
        if (normalized.indexOf('drechslera') !== -1) return 'Drechslera';
        if (normalized.indexOf('curvularia') !== -1) return 'Curvularia';
        if (normalized.indexOf('helminthosporium') !== -1) return 'Helminthosporium';
        if (normalized.indexOf('spring dead') !== -1) return 'SDS';
        if (normalized.indexOf('gray leaf') !== -1 || normalized.indexOf('grey leaf') !== -1) return 'Gray Leaf';
        if (normalized.indexOf('fusarium') !== -1) return 'Fusarium';
        if (normalized.indexOf('pythium') !== -1) return 'Pythium';
        if (normalized.indexOf('take-all') !== -1 || normalized.indexOf('takeall') !== -1) return 'Take-all';
        if (normalized.indexOf('brown patch') !== -1) return 'Brown Patch';
        if (normalized.indexOf('dollar spot') !== -1) return 'Dollar Spot';
        if (normalized.indexOf('anthracnose') !== -1) return 'Anthracnose';
        
        // If no match, truncate long names
        if (fullName.length > 15) {
            return fullName.substring(0, 12) + '...';
        }
        return fullName;
    }

    // =========================================================================
    // CONFIGURATION
    // =========================================================================

    var CONFIG = {
        // Chart dimensions
        // v1.x.x: Height increased 200→280 for better Word export readability
        width: 600,
        height: 280,
        padding: { top: 25, right: 20, bottom: 45, left: 55 },
        
        // Colour palette (matches hub.css and stress-trajectory-ui.js)
        colors: {
            // Risk/threshold zones
            low: '#22c55e',           // Green
            moderate: '#eab308',      // Yellow
            high: '#f97316',          // Orange
            severe: '#ef4444',        // Red
            critical: '#7f1d1d',      // Dark red
            
            // Risk zone backgrounds (with transparency)
            zoneLow: 'rgba(34, 197, 94, 0.10)',
            zoneModerate: 'rgba(234, 179, 8, 0.10)',
            zoneHigh: 'rgba(249, 115, 22, 0.15)',
            zoneSevere: 'rgba(239, 68, 68, 0.15)',
            zoneCritical: 'rgba(127, 29, 29, 0.15)',
            
            // Chart elements
            grid: 'var(--gaip-border)',
            axis: 'var(--gaip-text-secondary)',
            text: 'var(--gaip-text)',
            textMuted: 'var(--gaip-text-muted)',
            
            // Disease lines (distinct, accessible palette)
            lines: [
                '#3b82f6',  // Blue - primary disease
                '#ef4444',  // Red - second disease
                '#10b981',  // Emerald - third disease
                '#f59e0b',  // Amber - fourth disease
                '#8b5cf6',  // Violet - fifth disease
                '#ec4899',  // Pink - sixth disease
                '#06b6d4',  // Cyan - seventh disease
                '#84cc16'   // Lime - eighth disease
            ],
            
            // Irrigation balance colours
            soilMoisture: '#3b82f6',
            soilMoistureFill: 'rgba(59, 130, 246, 0.15)',
            rainfall: '#06b6d4',
            rainfallFill: 'rgba(6, 182, 212, 0.4)',
            irrigation: '#22c55e',
            irrigationFill: 'rgba(34, 197, 94, 0.5)',
            et: '#f97316',
            deficit: '#ef4444',
            deficitFill: 'rgba(239, 68, 68, 0.2)'
        },
        
        // Disease risk thresholds (matches DISEASE_CONFIG)
        diseaseThresholds: {
            low: 25,
            moderate: 50,
            high: 70,
            severe: 85
        },
        
        // Irrigation thresholds (MAD-based)
        irrigationThresholds: {
            optimal: 30,      // 0-30% depletion
            adequate: 50,     // 30-50% depletion
            stressed: 70,     // 50-70% depletion
            critical: 100     // 70-100% depletion
        }
    };

    // =========================================================================
    // SVG UTILITIES
    // =========================================================================

    /**
     * Create SVG element with namespace
     */
    function createSVG(tag, attrs) {
        var el = document.createElementNS('http://www.w3.org/2000/svg', tag);
        if (attrs) {
            for (var key in attrs) {
                if (attrs.hasOwnProperty(key)) {
                    el.setAttribute(key, attrs[key]);
                }
            }
        }
        return el;
    }

    /**
     * Create responsive SVG container
     */
    function createSVGContainer(width, height, className) {
        var svg = createSVG('svg', {
            'viewBox': '0 0 ' + width + ' ' + height,
            'class': className || 'gilba-chart',
            'preserveAspectRatio': 'xMidYMid meet'
        });
        svg.style.width = '100%';
        svg.style.height = 'auto';
        svg.style.maxHeight = height + 'px';
        svg.style.display = 'block';
        return svg;
    }

    /**
     * Draw horizontal threshold zones
     */
    function drawThresholdZones(svg, zones, chartArea) {
        for (var i = 0; i < zones.length; i++) {
            var zone = zones[i];
            var yTop = chartArea.top + chartArea.height * (1 - zone.max / 100);
            var yBottom = chartArea.top + chartArea.height * (1 - zone.min / 100);
            var zoneHeight = yBottom - yTop;
            
            var rect = createSVG('rect', {
                'x': chartArea.left,
                'y': yTop,
                'width': chartArea.width,
                'height': zoneHeight,
                'fill': zone.color
            });
            svg.appendChild(rect);
        }
    }

    /**
     * Draw horizontal grid lines with labels
     */
    function drawHorizontalGrid(svg, values, chartArea, options) {
        options = options || {};
        var showLabels = options.showLabels !== false;
        var suffix = options.suffix || '';
        
        for (var i = 0; i < values.length; i++) {
            var value = values[i];
            var y = chartArea.top + chartArea.height * (1 - value / (options.max || 100));
            
            // Grid line
            var line = createSVG('line', {
                'x1': chartArea.left,
                'y1': y,
                'x2': chartArea.left + chartArea.width,
                'y2': y,
                'stroke': CONFIG.colors.grid,
                'stroke-dasharray': '4,4',
                'stroke-width': '1'
            });
            svg.appendChild(line);
            
            // Label
            if (showLabels) {
                var label = createSVG('text', {
                    'x': chartArea.left - 8,
                    'y': y + 4,
                    'text-anchor': 'end',
                    'font-size': '10',
                    'fill': CONFIG.colors.textMuted
                });
                label.textContent = value + suffix;
                svg.appendChild(label);
            }
        }
    }

    /**
     * Draw X-axis date labels
     */
    function drawXAxisLabels(svg, dates, chartArea, options) {
        options = options || {};
        var interval = options.interval || 2;  // Show every Nth label
        var yPosition = chartArea.top + chartArea.height + 20;
        
        for (var i = 0; i < dates.length; i += interval) {
            var x = chartArea.left + (i / (dates.length - 1)) * chartArea.width;
            var label = createSVG('text', {
                'x': x,
                'y': yPosition,
                'text-anchor': 'middle',
                'font-size': '10',
                'fill': CONFIG.colors.textMuted
            });
            
            if (i === 0) {
                label.textContent = 'Today';
            } else {
                label.textContent = '+' + i + 'd';
            }
            svg.appendChild(label);
        }
    }

    /**
     * Draw Y-axis title (rotated)
     */
    function drawYAxisTitle(svg, title, chartArea) {
        var x = 12;
        var y = chartArea.top + chartArea.height / 2;
        
        var text = createSVG('text', {
            'x': x,
            'y': y,
            'text-anchor': 'middle',
            'transform': 'rotate(-90, ' + x + ', ' + y + ')',
            'font-size': '11',
            'font-weight': '500',
            'fill': CONFIG.colors.textMuted
        });
        text.textContent = title;
        svg.appendChild(text);
    }

    /**
     * Draw a data line with optional area fill
     */
    function drawLine(svg, points, chartArea, options) {
        options = options || {};
        var color = options.color || CONFIG.colors.lines[0];
        var fillColor = options.fill || null;
        var strokeWidth = options.strokeWidth || 2;
        var dashed = options.dashed || false;
        
        if (points.length < 2) return;
        
        // Calculate pixel positions
        var pixelPoints = [];
        for (var i = 0; i < points.length; i++) {
            var x = chartArea.left + (i / (points.length - 1)) * chartArea.width;
            var y = chartArea.top + chartArea.height * (1 - points[i].value / (options.max || 100));
            pixelPoints.push({ x: x, y: y, data: points[i] });
        }
        
        // Draw fill area if requested
        if (fillColor) {
            var areaPath = 'M' + pixelPoints[0].x + ',' + (chartArea.top + chartArea.height);
            for (var a = 0; a < pixelPoints.length; a++) {
                areaPath += ' L' + pixelPoints[a].x + ',' + pixelPoints[a].y;
            }
            areaPath += ' L' + pixelPoints[pixelPoints.length - 1].x + ',' + (chartArea.top + chartArea.height) + ' Z';
            
            var area = createSVG('path', {
                'd': areaPath,
                'fill': fillColor,
                'stroke': 'none'
            });
            svg.appendChild(area);
        }
        
        // Draw line
        var pathData = 'M' + pixelPoints.map(function(p) { return p.x + ',' + p.y; }).join(' L');
        var path = createSVG('path', {
            'd': pathData,
            'fill': 'none',
            'stroke': color,
            'stroke-width': strokeWidth
        });
        if (dashed) {
            path.setAttribute('stroke-dasharray', '6,4');
        }
        svg.appendChild(path);
        
        return pixelPoints;
    }

    /**
     * Draw data points with hover capability
     */
    function drawDataPoints(svg, pixelPoints, options) {
        options = options || {};
        var color = options.color || CONFIG.colors.lines[0];
        var radius = options.radius || 3;
        var hoverRadius = options.hoverRadius || 5;
        
        for (var i = 0; i < pixelPoints.length; i++) {
            var p = pixelPoints[i];
            
            var circle = createSVG('circle', {
                'cx': p.x,
                'cy': p.y,
                'r': i === 0 ? hoverRadius : radius,
                'fill': color,
                'stroke': 'var(--gaip-surface)',
                'stroke-width': '1.5',
                'class': 'gilba-chart-point',
                'data-index': i,
                'data-value': p.data.value,
                'data-label': p.data.label || ''
            });
            
            // Add hover effect via CSS class
            circle.style.cursor = 'pointer';
            circle.style.transition = 'r 0.15s ease';
            
            svg.appendChild(circle);
        }
    }

    /**
     * Draw chart legend with multi-row support for long labels
     */
    function drawLegend(svg, items, chartArea, options) {
        options = options || {};
        var baseY = options.y || (chartArea.top + chartArea.height + 28);
        var itemWidth = options.spacing || 120;  // Width per legend item
        var rowHeight = 14;  // Height between rows
        var maxItemsPerRow = Math.floor(chartArea.width / itemWidth) || 2;
        
        for (var i = 0; i < items.length; i++) {
            var item = items[i];
            var row = Math.floor(i / maxItemsPerRow);
            var col = i % maxItemsPerRow;
            
            // Calculate position - center each row
            var itemsInThisRow = Math.min(maxItemsPerRow, items.length - row * maxItemsPerRow);
            var rowWidth = itemsInThisRow * itemWidth;
            var rowStartX = chartArea.left + (chartArea.width - rowWidth) / 2;
            
            var x = rowStartX + col * itemWidth;
            var y = baseY + row * rowHeight;
            
            // Colour swatch - use line for dashed items, rect for solid
            if (item.dashed) {
                // Dashed line for beta diseases
                var dashedLine = createSVG('line', {
                    'x1': x,
                    'y1': y - 4,
                    'x2': x + 12,
                    'y2': y - 4,
                    'stroke': item.color,
                    'stroke-width': '2',
                    'stroke-dasharray': '3,2'
                });
                svg.appendChild(dashedLine);
            } else {
                // Solid rect for established diseases
                var swatch = createSVG('rect', {
                    'x': x,
                    'y': y - 6,
                    'width': 12,
                    'height': 3,
                    'rx': 1.5,
                    'fill': item.color
                });
                svg.appendChild(swatch);
            }
            
            // Label
            var label = createSVG('text', {
                'x': x + 16,
                'y': y,
                'font-size': '9',
                'fill': CONFIG.colors.text
            });
            label.textContent = item.label;
            svg.appendChild(label);
        }
    }

    /**
     * Draw "today" marker line
     */
    function drawTodayMarker(svg, chartArea) {
        var x = chartArea.left;
        
        var line = createSVG('line', {
            'x1': x,
            'y1': chartArea.top,
            'x2': x,
            'y2': chartArea.top + chartArea.height,
            'stroke': CONFIG.colors.text,
            'stroke-width': '1',
            'stroke-dasharray': '2,2'
        });
        svg.appendChild(line);
    }

    // =========================================================================
    // DISEASE FORECAST TIMELINE CHART
    // =========================================================================

    /**
     * Create disease risk forecast timeline
     * 
     * @param {Array} diseases - Array of disease objects with daily forecasts
     *   Each disease: { name: string, color: string, forecast: [{ day: 0, risk: 45 }, ...] }
     * @param {Object} options - Chart options
     * @returns {SVGElement} The chart SVG element
     */
    function createDiseaseTimeline(diseases, options) {
        options = options || {};
        var width = options.width || CONFIG.width;
        var height = options.height || CONFIG.height;
        var padding = options.padding || CONFIG.padding;
        
        var chartArea = {
            left: padding.left,
            top: padding.top,
            width: width - padding.left - padding.right,
            height: height - padding.top - padding.bottom
        };
        
        // Create SVG container
        var svg = createSVGContainer(width, height, 'gilba-disease-timeline');
        
        // Draw threshold zones
        var zones = [
            { min: 0, max: 25, color: CONFIG.colors.zoneLow },
            { min: 25, max: 50, color: CONFIG.colors.zoneModerate },
            { min: 50, max: 70, color: CONFIG.colors.zoneHigh },
            { min: 70, max: 85, color: CONFIG.colors.zoneSevere },
            { min: 85, max: 100, color: CONFIG.colors.zoneCritical }
        ];
        drawThresholdZones(svg, zones, chartArea);
        
        // Draw grid lines
        drawHorizontalGrid(svg, [25, 50, 70, 85], chartArea, { suffix: '%' });
        
        // Draw Y-axis title
        drawYAxisTitle(svg, 'Disease Risk', chartArea);
        
        // Get the number of forecast days from first disease
        var forecastDays = diseases.length > 0 && diseases[0].forecast ? 
                          diseases[0].forecast.length : 7;
        
        // Draw X-axis labels
        var dates = [];
        for (var d = 0; d < forecastDays; d++) {
            dates.push(d);
        }
        drawXAxisLabels(svg, dates, chartArea, { interval: 2 });
        
        // Draw each disease line
        var legendItems = [];
        for (var i = 0; i < diseases.length && i < 6; i++) {
            var disease = diseases[i];
            var color = disease.color || CONFIG.colors.lines[i];
            var isBeta = disease.beta || false;
            
            // Prepare points
            var points = [];
            for (var f = 0; f < disease.forecast.length; f++) {
                points.push({
                    value: disease.forecast[f].risk,
                    label: disease.name + ': ' + disease.forecast[f].risk + '%' + (isBeta ? ' (beta)' : '')
                });
            }
            
            // Draw line - beta diseases get dashed line and reduced opacity
            var lineOptions = {
                color: color,
                fill: i === 0 && !isBeta ? color.replace(')', ', 0.1)').replace('rgb', 'rgba') : null,
                strokeWidth: isBeta ? 1.5 : (i === 0 ? 2.5 : 2),
                dashed: isBeta,
                max: 100
            };
            
            // For beta diseases, also reduce opacity
            var pixelPoints = drawLine(svg, points, chartArea, lineOptions);
            
            // Draw data points for primary disease only (to avoid clutter)
            // Skip data points for beta diseases
            if (i === 0 && pixelPoints && !isBeta) {
                drawDataPoints(svg, pixelPoints, { color: color });
            }
            
            // Abbreviate long disease names for legend readability
            var shortName = abbreviateDiseaseName(disease.name);
            legendItems.push({ 
                label: shortName + (isBeta ? ' *' : ''), 
                color: color,
                dashed: isBeta
            });
        }
        
        // Draw legend (only if multiple diseases)
        if (legendItems.length > 1) {
            drawLegend(svg, legendItems, chartArea, { centered: true, spacing: 110 });
        }
        
        // Add today marker
        drawTodayMarker(svg, chartArea);
        
        return svg;
    }

    // =========================================================================
    // IRRIGATION BALANCE TIMELINE CHART
    // =========================================================================

    /**
     * Create irrigation water balance timeline
     * 
     * @param {Array} schedule - Array of daily schedule objects
     *   Each day: { date, depletion, depletionPct, etc, precipitation, irrigation }
     * @param {Object} options - Chart options
     * @returns {SVGElement} The chart SVG element
     */
    function createIrrigationTimeline(schedule, options) {
        options = options || {};
        var width = options.width || CONFIG.width;
        var height = options.height || 220;
        var padding = options.padding || CONFIG.padding;
        
        var chartArea = {
            left: padding.left,
            top: padding.top,
            width: width - padding.left - padding.right,
            height: height - padding.top - padding.bottom
        };
        
        // Create SVG container
        var svg = createSVGContainer(width, height, 'gilba-irrigation-timeline');
        
        // Draw threshold zones for depletion
        var zones = [
            { min: 0, max: 30, color: CONFIG.colors.zoneLow },           // Optimal
            { min: 30, max: 50, color: CONFIG.colors.zoneModerate },     // Adequate
            { min: 50, max: 70, color: CONFIG.colors.zoneHigh },         // Stressed
            { min: 70, max: 100, color: CONFIG.colors.zoneSevere }       // Critical
        ];
        drawThresholdZones(svg, zones, chartArea);
        
        // Draw grid lines
        drawHorizontalGrid(svg, [30, 50, 70], chartArea, { suffix: '%' });
        
        // Draw Y-axis title
        drawYAxisTitle(svg, 'Soil Depletion %', chartArea);
        
        // Draw X-axis labels
        var dates = [];
        for (var d = 0; d < schedule.length; d++) {
            dates.push(d);
        }
        drawXAxisLabels(svg, dates, chartArea, { interval: 1 });
        
        // Prepare depletion line data
        var depletionPoints = [];
        for (var i = 0; i < schedule.length; i++) {
            var day = schedule[i];
            depletionPoints.push({
                value: day.depletionPct || 0,
                label: 'Depletion: ' + (day.depletionPct || 0) + '%'
            });
        }
        
        // Draw depletion line with fill
        var pixelPoints = drawLine(svg, depletionPoints, chartArea, {
            color: CONFIG.colors.soilMoisture,
            fill: CONFIG.colors.soilMoistureFill,
            strokeWidth: 2.5,
            max: 100
        });
        
        // Draw data points
        if (pixelPoints) {
            drawDataPoints(svg, pixelPoints, { color: CONFIG.colors.soilMoisture });
        }
        
        // Draw rainfall bars
        var maxPrecip = Math.max.apply(null, schedule.map(function(d) { return d.precipitation || 0; }));
        var maxIrrigation = Math.max.apply(null, schedule.map(function(d) { 
            return d.irrigation && d.irrigation.recommended ? d.irrigation.totalDepth : 0; 
        }));
        var maxWater = Math.max(maxPrecip, maxIrrigation, 10);  // Minimum 10mm scale
        
        var barWidth = (chartArea.width / schedule.length) * 0.35;
        
        for (var b = 0; b < schedule.length; b++) {
            var bDay = schedule[b];
            var bx = chartArea.left + (b / (schedule.length - 1)) * chartArea.width;
            
            // Rainfall bar (cyan, left of center)
            if (bDay.precipitation > 0) {
                var rainHeight = (bDay.precipitation / maxWater) * 30;  // Max 30px height
                var rainBar = createSVG('rect', {
                    'x': bx - barWidth - 1,
                    'y': chartArea.top + chartArea.height - rainHeight,
                    'width': barWidth,
                    'height': rainHeight,
                    'fill': CONFIG.colors.rainfall,
                    'rx': 2
                });
                svg.appendChild(rainBar);
            }
            
            // Irrigation bar (green, right of center)
            if (bDay.irrigation && bDay.irrigation.recommended) {
                var irrHeight = (bDay.irrigation.totalDepth / maxWater) * 30;
                var irrBar = createSVG('rect', {
                    'x': bx + 1,
                    'y': chartArea.top + chartArea.height - irrHeight,
                    'width': barWidth,
                    'height': irrHeight,
                    'fill': CONFIG.colors.irrigation,
                    'rx': 2
                });
                svg.appendChild(irrBar);
            }
        }
        
        // Draw MAD threshold line (if provided)
        if (options.madThreshold) {
            var madY = chartArea.top + chartArea.height * (1 - options.madThreshold / 100);
            var madLine = createSVG('line', {
                'x1': chartArea.left,
                'y1': madY,
                'x2': chartArea.left + chartArea.width,
                'y2': madY,
                'stroke': CONFIG.colors.high,
                'stroke-width': '2',
                'stroke-dasharray': '8,4'
            });
            svg.appendChild(madLine);
            
            // MAD label
            var madLabel = createSVG('text', {
                'x': chartArea.left + chartArea.width - 5,
                'y': madY - 5,
                'text-anchor': 'end',
                'font-size': '9',
                'font-weight': '600',
                'fill': CONFIG.colors.high
            });
            madLabel.textContent = 'MAD ' + options.madThreshold + '%';
            svg.appendChild(madLabel);
        }
        
        // Draw legend
        var legendItems = [
            { label: 'Depletion', color: CONFIG.colors.soilMoisture },
            { label: 'Rainfall', color: CONFIG.colors.rainfall },
            { label: 'Irrigation', color: CONFIG.colors.irrigation }
        ];
        drawLegend(svg, legendItems, chartArea, { centered: true, spacing: 80 });
        
        // Add today marker
        drawTodayMarker(svg, chartArea);
        
        return svg;
    }

    // =========================================================================
    // TOOLTIP SYSTEM
    // =========================================================================

    /**
     * Attach tooltip handlers to chart
     */
    function attachTooltips(container, formatFn) {
        var tooltip = null;
        
        function showTooltip(e) {
            var target = e.target;
            if (!target.classList.contains('gilba-chart-point')) return;
            
            var value = target.getAttribute('data-value');
            var label = target.getAttribute('data-label');
            
            if (!tooltip) {
                tooltip = document.createElement('div');
                tooltip.className = 'gilba-chart-tooltip';
                tooltip.style.cssText = 'position: absolute; background: var(--gaip-text); color: var(--gaip-surface); ' +
                    'padding: 6px 10px; border-radius: 4px; font-size: 12px; pointer-events: none; ' +
                    'z-index: 1000; white-space: nowrap; box-shadow: 0 2px 8px rgba(0,0,0,0.2);';
                container.style.position = 'relative';
                container.appendChild(tooltip);
            }
            
            tooltip.textContent = formatFn ? formatFn(value, label) : (label || value);
            tooltip.style.display = 'block';
            
            var rect = target.getBoundingClientRect();
            var containerRect = container.getBoundingClientRect();
            tooltip.style.left = (rect.left - containerRect.left + rect.width / 2 - tooltip.offsetWidth / 2) + 'px';
            tooltip.style.top = (rect.top - containerRect.top - tooltip.offsetHeight - 8) + 'px';
            
            // Enlarge point on hover
            target.setAttribute('r', '6');
        }
        
        function hideTooltip(e) {
            var target = e.target;
            if (!target.classList.contains('gilba-chart-point')) return;
            
            if (tooltip) {
                tooltip.style.display = 'none';
            }
            
            // Restore point size (keep first point larger)
            var index = parseInt(target.getAttribute('data-index'), 10);
            target.setAttribute('r', index === 0 ? '5' : '3');
        }
        
        container.addEventListener('mouseover', showTooltip);
        container.addEventListener('mouseout', hideTooltip);
    }

    // =========================================================================
    // PUBLIC API
    // =========================================================================

    return {
        // Configuration
        CONFIG: CONFIG,
        
        // Core utilities
        createSVG: createSVG,
        createSVGContainer: createSVGContainer,
        
        // Drawing primitives
        drawThresholdZones: drawThresholdZones,
        drawHorizontalGrid: drawHorizontalGrid,
        drawXAxisLabels: drawXAxisLabels,
        drawYAxisTitle: drawYAxisTitle,
        drawLine: drawLine,
        drawDataPoints: drawDataPoints,
        drawLegend: drawLegend,
        drawTodayMarker: drawTodayMarker,
        
        // High-level charts
        createDiseaseTimeline: createDiseaseTimeline,
        createIrrigationTimeline: createIrrigationTimeline,
        
        // Interactivity
        attachTooltips: attachTooltips
    };

})();

// Export for browser/WordPress
if (typeof window !== 'undefined') {
    window.GilbaCharts = GilbaCharts;
}
