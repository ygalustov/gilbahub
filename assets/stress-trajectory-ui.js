/**
 * GILBA AGRONOMIC INTELLIGENCE HUB
 * Stress Trajectory UI Renderer v1.2.0
 * 
 * Renders the stress trajectory analysis with progressive disclosure:
 * - Summary card (always visible)
 * - Trajectory chart (expandable)
 * - Critical points timeline (expandable)
 * - Intervention windows (expandable)
 * - Event simulator (expandable)
 * 
 * v1.2.0 - Dynamic Y-axis scaling for better data visualization
 *          - Y-axis now fits data range with padding instead of fixed 0-100
 *          - Threshold zones and labels adjust to visible range
 *          - Better visual impact for narrow stress bands
 * v1.1.0 - Fixed data contract compatibility with Engine v2.0.0:
 *          - Now accepts totalScore/weightedScore (not just composite)
 *          - Now accepts level at top level (not just status.level)
 *          - Now accepts date (not just dateReadable)
 *          - Summary handles flat format (currentScore, currentLevel)
 *          - Trend normalisation (improving/worsening → FALLING/RISING)
 * v1.0.6 - Added defensive checks for missing criticalPoints/interventionWindows/recommendations
 * 
 * @version 1.2.0
 * @date January 2026
 * @author Gilba Solutions
 */

var StressTrajectoryUI = (function() {
    'use strict';

    // =========================================================================
    // CONFIGURATION
    // =========================================================================

    var CONFIG = {
        chartHeight: 200,
        chartPadding: { top: 20, right: 20, bottom: 40, left: 50 },
        colors: {
            normal: '#22c55e',
            caution: '#eab308',
            warning: '#f97316',
            critical: '#ef4444',
            failure: '#7f1d1d',
            line: '#3b82f6',
            lineFill: 'rgba(59, 130, 246, 0.1)',
            grid: 'var(--gaip-border)',
            text: 'var(--gaip-text)',
            textMuted: 'var(--gaip-text-secondary)'
        }
    };

    // =========================================================================
    // HELPER FUNCTIONS
    // =========================================================================

    /**
     * Create HTML element with attributes
     */
    function createElement(tag, attrs, children) {
        var el = document.createElement(tag);
        if (attrs) {
            for (var key in attrs) {
                if (attrs.hasOwnProperty(key)) {
                    if (key === 'className') {
                        el.className = attrs[key];
                    } else if (key === 'innerHTML') {
                        el.innerHTML = attrs[key];
                    } else if (key === 'style' && typeof attrs[key] === 'object') {
                        for (var prop in attrs[key]) {
                            if (attrs[key].hasOwnProperty(prop)) {
                                el.style[prop] = attrs[key][prop];
                            }
                        }
                    } else {
                        el.setAttribute(key, attrs[key]);
                    }
                }
            }
        }
        if (children) {
            if (typeof children === 'string') {
                el.textContent = children;
            } else if (Array.isArray(children)) {
                for (var i = 0; i < children.length; i++) {
                    if (children[i]) el.appendChild(children[i]);
                }
            } else {
                el.appendChild(children);
            }
        }
        return el;
    }

    /**
     * Escape HTML to prevent XSS
     */
    function escapeHtml(str) {
        if (!str) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    /**
     * Get urgency badge class
     */
    function getUrgencyClass(urgency) {
        switch (urgency) {
            case 'IMMEDIATE': return 'gaip-badge-critical';
            case 'URGENT': return 'gaip-badge-warning';
            default: return 'gaip-badge-info';
        }
    }

    /**
     * Get status color
     */
    function getStatusColor(level) {
        return CONFIG.colors[level] || CONFIG.colors.text;
    }

    // =========================================================================
    // CHART RENDERING
    // =========================================================================

    /**
     * Render SVG trajectory chart
     */
    function renderChart(trajectory) {
        var width = 600;
        var height = CONFIG.chartHeight;
        var padding = CONFIG.chartPadding;
        var chartWidth = width - padding.left - padding.right;
        var chartHeight = height - padding.top - padding.bottom;
        
        // v1.2.0: Calculate dynamic Y-axis range based on data
        var scores = trajectory.map(function(d) {
            return d.totalScore !== undefined ? d.totalScore : 
                   (d.weightedScore !== undefined ? d.weightedScore : 
                   (d.composite !== undefined ? d.composite : 0));
        });
        var minScore = Math.min.apply(null, scores);
        var maxScore = Math.max.apply(null, scores);
        
        // Add 15% padding above and below, but clamp to 0-100
        var range = maxScore - minScore;
        var paddingAmount = Math.max(range * 0.15, 5); // At least 5 points padding
        var yMin = Math.max(0, Math.floor((minScore - paddingAmount) / 5) * 5);
        var yMax = Math.min(100, Math.ceil((maxScore + paddingAmount) / 5) * 5);
        
        // Ensure minimum range of 20 points for readability
        if (yMax - yMin < 20) {
            var mid = (yMin + yMax) / 2;
            yMin = Math.max(0, mid - 10);
            yMax = Math.min(100, mid + 10);
        }
        
        var yRange = yMax - yMin;
        
        // Helper to convert score to Y position
        function scoreToY(score) {
            return padding.top + chartHeight - ((score - yMin) / yRange * chartHeight);
        }
        
        // Create SVG
        var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.setAttribute('viewBox', '0 0 ' + width + ' ' + height);
        svg.setAttribute('class', 'gaip-trajectory-chart');
        svg.style.width = '100%';
        svg.style.height = 'auto';
        svg.style.maxHeight = height + 'px';
        
        // Background threshold zones (only draw portions visible in current range)
        var thresholds = [
            { y: 0, h: 30, color: 'rgba(34, 197, 94, 0.1)' },    // Normal
            { y: 30, h: 20, color: 'rgba(234, 179, 8, 0.1)' },   // Caution
            { y: 50, h: 15, color: 'rgba(249, 115, 22, 0.15)' }, // Warning
            { y: 65, h: 15, color: 'rgba(239, 68, 68, 0.15)' },  // Critical
            { y: 80, h: 20, color: 'rgba(127, 29, 29, 0.15)' }   // Failure
        ];
        
        for (var t = 0; t < thresholds.length; t++) {
            var zone = thresholds[t];
            var zoneBottom = zone.y;
            var zoneTop = zone.y + zone.h;
            
            // Only draw if zone overlaps with visible range
            if (zoneTop > yMin && zoneBottom < yMax) {
                var visibleBottom = Math.max(zoneBottom, yMin);
                var visibleTop = Math.min(zoneTop, yMax);
                
                var rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
                rect.setAttribute('x', padding.left);
                rect.setAttribute('y', scoreToY(visibleTop));
                rect.setAttribute('width', chartWidth);
                rect.setAttribute('height', (visibleTop - visibleBottom) / yRange * chartHeight);
                rect.setAttribute('fill', zone.color);
                svg.appendChild(rect);
            }
        }
        
        // Threshold lines (only visible ones)
        var thresholdLines = [30, 50, 65, 80];
        for (var i = 0; i < thresholdLines.length; i++) {
            if (thresholdLines[i] >= yMin && thresholdLines[i] <= yMax) {
                var y = scoreToY(thresholdLines[i]);
                var line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
                line.setAttribute('x1', padding.left);
                line.setAttribute('y1', y);
                line.setAttribute('x2', width - padding.right);
                line.setAttribute('y2', y);
                line.setAttribute('stroke', CONFIG.colors.grid);
                line.setAttribute('stroke-dasharray', '4,4');
                svg.appendChild(line);
                
                // Label
                var label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
                label.setAttribute('x', padding.left - 5);
                label.setAttribute('y', y + 4);
                label.setAttribute('text-anchor', 'end');
                label.setAttribute('font-size', '10');
                label.setAttribute('fill', CONFIG.colors.textMuted);
                label.textContent = thresholdLines[i];
                svg.appendChild(label);
            }
        }
        
        // Add Y-axis min/max labels if not already shown
        var yAxisLabels = [yMin, yMax];
        for (var j = 0; j < yAxisLabels.length; j++) {
            if (thresholdLines.indexOf(yAxisLabels[j]) === -1) {
                var axisLabel = document.createElementNS('http://www.w3.org/2000/svg', 'text');
                axisLabel.setAttribute('x', padding.left - 5);
                axisLabel.setAttribute('y', scoreToY(yAxisLabels[j]) + 4);
                axisLabel.setAttribute('text-anchor', 'end');
                axisLabel.setAttribute('font-size', '10');
                axisLabel.setAttribute('fill', CONFIG.colors.textMuted);
                axisLabel.textContent = yAxisLabels[j];
                svg.appendChild(axisLabel);
            }
        }
        
        // Build path data
        var points = [];
        var areaPoints = [];
        for (var d = 0; d < trajectory.length; d++) {
            var score = trajectory[d].totalScore !== undefined ? trajectory[d].totalScore : 
                       (trajectory[d].weightedScore !== undefined ? trajectory[d].weightedScore : 
                       (trajectory[d].composite !== undefined ? trajectory[d].composite : 0));
            var x = padding.left + (d / (trajectory.length - 1)) * chartWidth;
            var yPos = scoreToY(score);
            points.push(x + ',' + yPos);
            areaPoints.push({ x: x, y: yPos });
        }
        
        // Fill area under curve
        var areaPath = 'M' + areaPoints[0].x + ',' + (padding.top + chartHeight);
        for (var a = 0; a < areaPoints.length; a++) {
            areaPath += ' L' + areaPoints[a].x + ',' + areaPoints[a].y;
        }
        areaPath += ' L' + areaPoints[areaPoints.length - 1].x + ',' + (padding.top + chartHeight) + ' Z';
        
        var area = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        area.setAttribute('d', areaPath);
        area.setAttribute('fill', CONFIG.colors.lineFill);
        svg.appendChild(area);
        
        // Main line
        var path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        path.setAttribute('d', 'M' + points.join(' L'));
        path.setAttribute('fill', 'none');
        path.setAttribute('stroke', CONFIG.colors.line);
        path.setAttribute('stroke-width', '2');
        svg.appendChild(path);
        
        // Data points with tooltips
        for (var p = 0; p < trajectory.length; p++) {
            var point = trajectory[p];
            var pointScore = point.totalScore !== undefined ? point.totalScore : 
                            (point.weightedScore !== undefined ? point.weightedScore : 
                            (point.composite !== undefined ? point.composite : 0));
            var px = padding.left + (p / (trajectory.length - 1)) * chartWidth;
            var py = scoreToY(pointScore);
            
            // Get level - support both formats
            var pointLevel = point.level || (point.status && point.status.level) || 'normal';
            // Normalise level to lowercase for color lookup
            var levelKey = String(pointLevel).toLowerCase();
            
            var circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
            circle.setAttribute('cx', px);
            circle.setAttribute('cy', py);
            circle.setAttribute('r', p === 0 ? 5 : 3);
            circle.setAttribute('fill', getStatusColor(levelKey));
            circle.setAttribute('stroke', 'var(--gaip-surface)');
            circle.setAttribute('stroke-width', '1');
            circle.setAttribute('class', 'gaip-chart-point');
            circle.setAttribute('data-day', p);
            circle.setAttribute('data-score', pointScore);
            circle.setAttribute('data-date', point.date || point.dateReadable || '');
            svg.appendChild(circle);
        }
        
        // X-axis labels (every 2 days)
        for (var l = 0; l < trajectory.length; l += 2) {
            var lx = padding.left + (l / (trajectory.length - 1)) * chartWidth;
            var ly = height - 10;
            var xLabel = document.createElementNS('http://www.w3.org/2000/svg', 'text');
            xLabel.setAttribute('x', lx);
            xLabel.setAttribute('y', ly);
            xLabel.setAttribute('text-anchor', 'middle');
            xLabel.setAttribute('font-size', '10');
            xLabel.setAttribute('fill', CONFIG.colors.textMuted);
            xLabel.textContent = l === 0 ? 'Today' : '+' + l + 'd';
            svg.appendChild(xLabel);
        }
        
        // Y-axis label
        var yAxisLabel = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        yAxisLabel.setAttribute('x', 15);
        yAxisLabel.setAttribute('y', height / 2);
        yAxisLabel.setAttribute('text-anchor', 'middle');
        yAxisLabel.setAttribute('transform', 'rotate(-90, 15, ' + (height / 2) + ')');
        yAxisLabel.setAttribute('font-size', '11');
        yAxisLabel.setAttribute('fill', CONFIG.colors.textMuted);
        yAxisLabel.textContent = 'Stress Score';
        svg.appendChild(yAxisLabel);
        
        return svg;
    }

    // =========================================================================
    // SECTION RENDERERS
    // =========================================================================

    /**
     * Render summary card
     */
    function renderSummary(result) {
        var summary = result.summary;
        
        // Defensive: ensure summary exists
        if (!summary) {
            return '<div style="padding: 12px; background: var(--gaip-warning-bg); border-radius: 6px; color: #92400e;">Summary data not available</div>';
        }
        
        // Support both engine v2.0 format (flat) and legacy format (nested)
        // Engine v2.0: summary.currentScore, summary.currentLevel
        // Legacy: summary.current.score, summary.current.status.level
        var currentScore, currentLevel, peakScore, peakLevel, peakDate;
        
        if (summary.currentScore !== undefined) {
            // Engine v2.0 format
            currentScore = summary.currentScore;
            currentLevel = String(summary.currentLevel || 'Normal').toLowerCase();
            peakScore = summary.peakScore;
            peakLevel = String(summary.peakLevel || 'Normal').toLowerCase();
            peakDate = summary.peakDate || '';
        } else {
            // Legacy format
            var current = summary.current || {};
            var peak = summary.peak || {};
            currentScore = current.score;
            currentLevel = (current.status && current.status.level) ? current.status.level : 'normal';
            peakScore = peak.score;
            peakLevel = (peak.status && peak.status.level) ? peak.status.level : 'normal';
            peakDate = peak.dateReadable || '';
        }
        
        // Format peak date for display
        var peakDateDisplay = '';
        if (peakDate) {
            // Handle ISO date format
            if (peakDate.includes('-')) {
                var d = new Date(peakDate);
                if (!isNaN(d.getTime())) {
                    peakDateDisplay = d.toLocaleDateString('en-AU', { day: 'numeric', month: 'short' });
                } else {
                    peakDateDisplay = peakDate;
                }
            } else {
                peakDateDisplay = peakDate;
            }
        }
        
        // Normalise trend to uppercase for display
        var trendRaw = summary.trend || 'stable';
        var trendDisplay = String(trendRaw).toUpperCase();
        if (trendDisplay === 'IMPROVING') trendDisplay = 'FALLING';
        else if (trendDisplay === 'WORSENING') trendDisplay = 'RISING';
        else if (trendDisplay === 'STABLE') trendDisplay = 'STABLE';
        
        // Get label from level
        function getLevelLabel(level) {
            var labels = {
                'normal': 'Normal',
                'caution': 'Caution',
                'warning': 'Warning',
                'critical': 'Critical',
                'failure': 'Failure'
            };
            return labels[level] || level;
        }
        
        var html = '<div class="gaip-trajectory-summary">';
        
        // Headline - use recommendation message if available, or generate one
        var headline = summary.headline;
        if (!headline && summary.recommendation && summary.recommendation.message) {
            headline = summary.recommendation.message;
        }
        if (!headline) {
            headline = 'Current stress: ' + getLevelLabel(currentLevel);
        }
        
        html += '<div class="gaip-trajectory-headline" style="' +
                'padding: 12px; background: ' + getStatusColor(currentLevel) + '15; ' +
                'border-left: 4px solid ' + getStatusColor(currentLevel) + '; ' +
                'border-radius: 4px; margin-bottom: 16px;">';
        html += '<p style="margin: 0; font-weight: 500;">' + escapeHtml(headline) + '</p>';
        html += '</div>';
        
        // Stats grid
        html += '<div class="gaip-trajectory-stats" style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px;">';
        
        // Current
        html += '<div class="gaip-stat-card" style="text-align: center; padding: 12px; background: var(--gaip-surface-muted); border-radius: 6px;">';
        html += '<div style="font-size: 20px; font-weight: 600; color: ' + getStatusColor(currentLevel) + ';">' + 
                (currentScore !== undefined ? currentScore : '-') + '</div>';
        html += '<div style="font-size: 12px; color: var(--gaip-text);">Current</div>';
        html += '<div style="font-size: 11px; color: ' + getStatusColor(currentLevel) + ';">' + 
                escapeHtml(getLevelLabel(currentLevel)) + '</div>';
        html += '</div>';
        
        // Peak
        html += '<div class="gaip-stat-card" style="text-align: center; padding: 12px; background: var(--gaip-surface-muted); border-radius: 6px;">';
        html += '<div style="font-size: 20px; font-weight: 600; color: ' + getStatusColor(peakLevel) + ';">' + 
                (peakScore !== undefined ? peakScore : '-') + '</div>';
        html += '<div style="font-size: 12px; color: var(--gaip-text);">Peak' + (peakDateDisplay ? ' (' + escapeHtml(peakDateDisplay) + ')' : '') + '</div>';
        html += '<div style="font-size: 11px; color: ' + getStatusColor(peakLevel) + ';">' + 
                escapeHtml(getLevelLabel(peakLevel)) + '</div>';
        html += '</div>';
        
        // Trend
        var trendIcon = trendDisplay === 'RISING' ? '↗' : trendDisplay === 'FALLING' ? '↘' : '→';
        var trendColor = trendDisplay === 'RISING' ? CONFIG.colors.warning : 
                        trendDisplay === 'FALLING' ? CONFIG.colors.normal : CONFIG.colors.textMuted;
        html += '<div class="gaip-stat-card" style="text-align: center; padding: 12px; background: var(--gaip-surface-muted); border-radius: 6px;">';
        html += '<div style="font-size: 20px; font-weight: 600; color: ' + trendColor + ';">' + trendIcon + '</div>';
        html += '<div style="font-size: 12px; color: var(--gaip-text);">Trend</div>';
        html += '<div style="font-size: 11px; color: ' + trendColor + ';">' + escapeHtml(trendDisplay) + '</div>';
        html += '</div>';
        
        html += '</div>'; // End stats grid
        
        // Primary driver - support both formats
        var primaryDriver = null;
        if (summary.primaryStressor) {
            // Engine v2.0 format
            primaryDriver = {
                component: summary.primaryStressor,
                label: summary.primaryStressor.charAt(0).toUpperCase() + summary.primaryStressor.slice(1),
                score: summary.primaryStressorValue || ''
            };
        } else if (summary.current && summary.current.primaryDriver) {
            // Legacy format
            primaryDriver = summary.current.primaryDriver;
        }
        
        if (primaryDriver && primaryDriver.component) {
            html += '<div style="margin-top: 12px; padding: 8px 12px; background: var(--gaip-surface-hover); border-radius: 4px; font-size: 13px;">';
            html += '<strong>Primary driver:</strong> ' + escapeHtml(primaryDriver.label) + 
                    (primaryDriver.score ? ' (' + primaryDriver.score + ')' : '');
            html += '</div>';
        }
        
        html += '</div>'; // End summary
        
        return html;
    }

    /**
     * Render critical points timeline
     */
    function renderCriticalPoints(criticalPoints) {
        if (!criticalPoints || criticalPoints.length === 0) {
            return '<p style="color: var(--gaip-text); font-style: italic;">No critical events in forecast period.</p>';
        }
        
        // Helper to format date
        function formatDate(dateStr) {
            if (!dateStr) return '';
            if (!dateStr.includes('-')) return dateStr; // Already formatted
            var d = new Date(dateStr);
            if (isNaN(d.getTime())) return dateStr;
            return d.toLocaleDateString('en-AU', { day: 'numeric', month: 'short' });
        }
        
        var html = '<div class="gaip-critical-points">';
        
        for (var i = 0; i < criticalPoints.length; i++) {
            var point = criticalPoints[i];
            var icon = point.type === 'THRESHOLD_CROSSED' ? '⚠️' : 
                       point.type === 'COMPOUND_ACTIVATED' ? '⚡' : '📈';
            var bgColor = point.type === 'THRESHOLD_CROSSED' ? 'var(--gaip-critical-bg)' :
                          point.type === 'COMPOUND_ACTIVATED' ? 'var(--gaip-warning-bg)' : 'var(--gaip-good-bg)';
            var borderColor = point.type === 'THRESHOLD_CROSSED' ? 'var(--gaip-critical-border)' :
                              point.type === 'COMPOUND_ACTIVATED' ? '#fef08a' : 'var(--gaip-good-bg)';
            
            // Support both date and dateReadable
            var displayDate = point.dateReadable || formatDate(point.date) || 'Day ' + point.day;
            
            html += '<div class="gaip-critical-point" style="' +
                    'display: flex; align-items: flex-start; gap: 12px; ' +
                    'padding: 10px 12px; margin-bottom: 8px; ' +
                    'background: ' + bgColor + '; border: 1px solid ' + borderColor + '; border-radius: 6px;">';
            html += '<div style="font-size: 14px;">' + icon + '</div>';
            html += '<div style="flex: 1;">';
            html += '<div style="font-weight: 500; font-size: 13px;">' + 
                    escapeHtml(displayDate) + ' (Day ' + point.day + ')</div>';
            html += '<div style="font-size: 12px; color: var(--gaip-text);">' + escapeHtml(point.description || '') + '</div>';
            if (point.driver && point.driver.label) {
                html += '<div style="font-size: 11px; color: var(--gaip-text); margin-top: 2px;">Driver: ' + 
                        escapeHtml(point.driver.label) + '</div>';
            }
            html += '</div>';
            html += '</div>';
        }
        
        html += '</div>';
        return html;
    }

    /**
     * Render intervention windows
     */
    function renderInterventionWindows(windows) {
        if (!windows || windows.length === 0) {
            return '<p style="color: var(--gaip-text); font-style: italic;">No threshold crossings expected in forecast period.</p>';
        }
        
        var html = '<div class="gaip-intervention-windows">';
        
        for (var i = 0; i < windows.length; i++) {
            var window = windows[i];
            var urgencyColor = window.urgency === 'IMMEDIATE' ? CONFIG.colors.critical :
                               window.urgency === 'URGENT' ? CONFIG.colors.warning : CONFIG.colors.normal;
            
            html += '<div class="gaip-intervention-window" style="' +
                    'padding: 12px; margin-bottom: 10px; ' +
                    'background: linear-gradient(to right, ' + urgencyColor + '15, transparent); ' +
                    'border-left: 4px solid ' + urgencyColor + '; border-radius: 0 6px 6px 0;">';
            
            html += '<div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">';
            html += '<span style="font-weight: 600; color: ' + urgencyColor + ';">' + 
                    escapeHtml(window.thresholdLabel) + ' Threshold</span>';
            html += '<span class="gaip-badge ' + getUrgencyClass(window.urgency) + '" style="' +
                    'padding: 2px 8px; border-radius: 12px; font-size: 11px; font-weight: 500; ' +
                    'background: ' + urgencyColor + '20; color: ' + urgencyColor + ';">' + 
                    escapeHtml(window.urgency) + '</span>';
            html += '</div>';
            
            html += '<div style="font-size: 13px; color: var(--gaip-text);">';
            html += '<strong>Crosses:</strong> ' + escapeHtml(window.crossingDateReadable) + 
                    ' (Day ' + window.crossingDay + ')<br>';
            html += '<strong>Window closes:</strong> ' + escapeHtml(window.windowClosesReadable) + 
                    ' (' + window.daysRemaining + ' days remaining)<br>';
            html += '<strong>Address:</strong> ' + escapeHtml(window.primaryDriver.label);
            html += '</div>';
            
            html += '</div>';
        }
        
        html += '</div>';
        return html;
    }

    /**
     * Render recommendations
     */
    function renderRecommendations(recommendations) {
        var hasRecs = (recommendations.immediate.length > 0 || 
                       recommendations.preventive.length > 0 || 
                       recommendations.monitoring.length > 0);
        
        if (!hasRecs) {
            return '<p style="color: var(--gaip-text); font-style: italic;">No specific recommendations at this time.</p>';
        }
        
        var html = '<div class="gaip-recommendations">';
        
        if (recommendations.immediate.length > 0) {
            html += '<div style="margin-bottom: 12px;">';
            html += '<h5 style="margin: 0 0 6px 0; color: ' + CONFIG.colors.critical + '; font-size: 13px;">⚡ Immediate</h5>';
            html += '<ul style="margin: 0; padding-left: 20px; font-size: 13px;">';
            for (var i = 0; i < recommendations.immediate.length; i++) {
                html += '<li>' + escapeHtml(recommendations.immediate[i]) + '</li>';
            }
            html += '</ul></div>';
        }
        
        if (recommendations.preventive.length > 0) {
            html += '<div style="margin-bottom: 12px;">';
            html += '<h5 style="margin: 0 0 6px 0; color: ' + CONFIG.colors.warning + '; font-size: 13px;">🛡️ Preventive</h5>';
            html += '<ul style="margin: 0; padding-left: 20px; font-size: 13px;">';
            for (var p = 0; p < recommendations.preventive.length; p++) {
                html += '<li>' + escapeHtml(recommendations.preventive[p]) + '</li>';
            }
            html += '</ul></div>';
        }
        
        if (recommendations.monitoring.length > 0) {
            html += '<div>';
            html += '<h5 style="margin: 0 0 6px 0; color: ' + CONFIG.colors.line + '; font-size: 13px;">👁️ Monitoring</h5>';
            html += '<ul style="margin: 0; padding-left: 20px; font-size: 13px;">';
            for (var m = 0; m < recommendations.monitoring.length; m++) {
                html += '<li>' + escapeHtml(recommendations.monitoring[m]) + '</li>';
            }
            html += '</ul></div>';
        }
        
        html += '</div>';
        return html;
    }

    /**
     * Render event simulator form
     */
    function renderEventSimulator() {
        var html = '<div class="gaip-event-simulator">';
        
        html += '<p style="font-size: 13px; color: var(--gaip-text); margin-bottom: 12px;">' +
                'Simulate the impact of a proposed event on stress trajectory.</p>';
        
        html += '<div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px;">';
        
        // Date
        html += '<div>';
        html += '<label style="font-size: 12px; color: var(--gaip-text); display: block; margin-bottom: 4px;">Event Date</label>';
        html += '<input type="date" id="gaip-sim-date" class="gaip-input" style="width: 100%; padding: 8px; border: 1px solid var(--gaip-border); border-radius: 4px;">';
        html += '</div>';
        
        // Type
        html += '<div>';
        html += '<label style="font-size: 12px; color: var(--gaip-text); display: block; margin-bottom: 4px;">Event Type</label>';
        html += '<select id="gaip-sim-type" class="gaip-input" style="width: 100%; padding: 8px; border: 1px solid var(--gaip-border); border-radius: 4px;">';
        html += '<option value="match">Match (90 min)</option>';
        html += '<option value="training">Training Session</option>';
        html += '<option value="concert">Concert/Festival (with cover)</option>';
        html += '<option value="cover">Ground Cover Only</option>';
        html += '</select>';
        html += '</div>';
        
        // Intensity
        html += '<div>';
        html += '<label style="font-size: 12px; color: var(--gaip-text); display: block; margin-bottom: 4px;">Intensity</label>';
        html += '<select id="gaip-sim-intensity" class="gaip-input" style="width: 100%; padding: 8px; border: 1px solid var(--gaip-border); border-radius: 4px;">';
        html += '<option value="0.5">Low</option>';
        html += '<option value="1.0" selected>Standard</option>';
        html += '<option value="1.5">High</option>';
        html += '<option value="2.0">Major Event</option>';
        html += '</select>';
        html += '</div>';
        
        // Duration - with dynamic unit
        html += '<div>';
        html += '<label id="gaip-sim-duration-label" style="font-size: 12px; color: var(--gaip-text); display: block; margin-bottom: 4px;">Duration (minutes)</label>';
        html += '<input type="number" id="gaip-sim-duration" class="gaip-input" value="90" min="1" max="30" style="width: 100%; padding: 8px; border: 1px solid var(--gaip-border); border-radius: 4px;">';
        html += '<input type="hidden" id="gaip-sim-duration-unit" value="minutes">';
        html += '</div>';
        
        html += '</div>';
        
        // Warning for cover events
        html += '<div id="gaip-sim-cover-warning" style="display: none; margin-top: 12px; padding: 10px; background: var(--gaip-warning-bg); border: 1px solid #f59e0b; border-radius: 6px; font-size: 12px; color: #92400e;">';
        html += '⚠️ Cover events are measured in <strong>days</strong>. Extended cover (>2 days) is high risk for C3 grasses in warm weather.';
        html += '</div>';
        
        html += '<button id="gaip-sim-run" class="gaip-button" style="' +
                'margin-top: 12px; padding: 10px 20px; background: #3b82f6; color: var(--gaip-surface); ' +
                'border: none; border-radius: 6px; cursor: pointer; font-weight: 500;">Simulate Impact</button>';
        
        html += '<div id="gaip-sim-results" style="margin-top: 16px;"></div>';
        
        html += '</div>';
        
        return html;
    }

    /**
     * Render simulation results
     */
    function renderSimulationResults(result) {
        if (result.error) {
            return '<p style="color: #ef4444;">' + escapeHtml(result.error) + '</p>';
        }
        
        var recColor = result.recommendation === 'NOT_RECOMMENDED' ? CONFIG.colors.critical :
                       result.recommendation === 'CONDITIONAL' ? CONFIG.colors.warning : CONFIG.colors.normal;
        
        var html = '<div class="gaip-sim-results" style="padding: 12px; background: var(--gaip-surface-muted); border-radius: 6px;">';
        
        // Recommendation badge
        html += '<div style="margin-bottom: 12px; text-align: center;">';
        html += '<span style="display: inline-block; padding: 6px 16px; background: ' + recColor + '20; ' +
                'color: ' + recColor + '; border-radius: 20px; font-weight: 600; font-size: 14px;">';
        html += result.recommendation.replace('_', ' ');
        html += '</span>';
        html += '</div>';
        
        // Comparison
        html += '<div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; text-align: center; margin-bottom: 12px;">';
        
        html += '<div style="padding: 8px; background: var(--gaip-surface); border-radius: 4px;">';
        html += '<div style="font-size: 11px; color: var(--gaip-text);">Without Event</div>';
        html += '<div style="font-size: 20px; font-weight: 600; color: ' + 
                getStatusColor(result.baseline.dayStatus.level) + ';">' + result.baseline.dayScore + '</div>';
        html += '</div>';
        
        html += '<div style="padding: 8px; background: var(--gaip-surface); border-radius: 4px;">';
        html += '<div style="font-size: 11px; color: var(--gaip-text);">With Event</div>';
        html += '<div style="font-size: 20px; font-weight: 600; color: ' + 
                getStatusColor(result.withEvent.dayStatus.level) + ';">' + result.withEvent.dayScore + '</div>';
        html += '</div>';
        
        html += '<div style="padding: 8px; background: var(--gaip-surface); border-radius: 4px;">';
        html += '<div style="font-size: 11px; color: var(--gaip-text);">Impact</div>';
        html += '<div style="font-size: 20px; font-weight: 600; color: ' + 
                (result.impact.stressIncrease > 15 ? CONFIG.colors.warning : CONFIG.colors.text) + ';">' +
                '+' + result.impact.stressIncrease + '</div>';
        html += '</div>';
        
        html += '</div>';
        
        // Event context info
        if (result.event && result.event.totalDays > 1) {
            html += '<div style="margin-bottom: 12px; padding: 8px; background: var(--gaip-info-bg); border-radius: 4px; font-size: 12px;">';
            html += '<strong>Multi-day event:</strong> ' + result.event.totalDays + ' days';
            if (result.context && result.context.hasCover) {
                html += ' with ground cover';
            }
            if (result.context && result.context.maxTemp > 0) {
                html += ' (forecast high: ' + Math.round(result.context.maxTemp) + '°C)';
            }
            html += '</div>';
        }
        
        // Warnings (critical)
        if (result.warnings && result.warnings.length > 0) {
            html += '<div style="margin-bottom: 12px; padding: 10px; background: var(--gaip-critical-bg); border: 1px solid #ef4444; border-radius: 6px;">';
            html += '<strong style="color: #dc2626; font-size: 12px;">⚠️ Critical Warnings:</strong>';
            html += '<ul style="margin: 4px 0 0 0; padding-left: 20px; font-size: 12px; color: #991b1b;">';
            for (var w = 0; w < result.warnings.length; w++) {
                html += '<li>' + escapeHtml(result.warnings[w]) + '</li>';
            }
            html += '</ul></div>';
        }
        
        // Conditions
        if (result.conditions.length > 0) {
            html += '<div style="margin-bottom: 8px;">';
            html += '<strong style="font-size: 12px;">Conditions:</strong>';
            html += '<ul style="margin: 4px 0 0 0; padding-left: 20px; font-size: 12px;">';
            for (var c = 0; c < result.conditions.length; c++) {
                html += '<li>' + escapeHtml(result.conditions[c]) + '</li>';
            }
            html += '</ul></div>';
        }
        
        // Preparation requirements
        if (result.preparation && result.preparation.length > 0) {
            html += '<div>';
            html += '<strong style="font-size: 12px;">Preparation required:</strong>';
            html += '<ul style="margin: 4px 0 0 0; padding-left: 20px; font-size: 12px;">';
            for (var p = 0; p < result.preparation.length; p++) {
                html += '<li>' + escapeHtml(result.preparation[p]) + '</li>';
            }
            html += '</ul></div>';
        }
        
        html += '</div>';
        return html;
    }

    // =========================================================================
    // MAIN RENDER FUNCTION
    // =========================================================================

    /**
     * Render full stress trajectory analysis
     * 
     * @param {String} containerId - ID of container element
     * @param {Object} result - Result from StressTrajectoryEngine.project()
     * @param {Object} options - Rendering options
     */
    function render(containerId, result, options) {
        options = options || {};
        
        var container = document.getElementById(containerId);
        if (!container) {
            console.error('StressTrajectoryUI: Container not found:', containerId);
            return;
        }
        
        // Validate result object
        if (!result) {
            console.error('StressTrajectoryUI: No result object provided');
            container.innerHTML = '<div style="padding: 20px; color: #ef4444;">Trajectory analysis failed: No result data</div>';
            return;
        }
        
        // Ensure trajectory array exists
        if (!result.trajectory || !Array.isArray(result.trajectory)) {
            console.error('StressTrajectoryUI: Invalid or missing trajectory array', result);
            container.innerHTML = '<div style="padding: 20px; color: #f59e0b; background: var(--gaip-warning-bg); border: 1px solid var(--gaip-warning-border); border-radius: 6px;">' +
                '<strong>⚠️ Insufficient data for trajectory analysis</strong><br>' +
                '<span style="font-size: 13px; color: #92400e;">Run a full analysis with climate and turf data to generate stress projections.</span></div>';
            return;
        }
        
        // Handle empty trajectory (no data points)
        if (result.trajectory.length === 0) {
            console.warn('StressTrajectoryUI: Empty trajectory array');
            container.innerHTML = '<div style="padding: 20px; color: #f59e0b; background: var(--gaip-warning-bg); border: 1px solid var(--gaip-warning-border); border-radius: 6px;">' +
                '<strong>⚠️ No trajectory data available</strong><br>' +
                '<span style="font-size: 13px; color: #92400e;">The stress projection engine returned no data points. Check that climate data is available.</span></div>';
            return;
        }
        
        // Ensure summary exists with defaults
        if (!result.summary) {
            result.summary = {
                headline: 'Stress trajectory analysis',
                trend: 'STABLE',
                current: { score: 0, status: { level: 'normal', label: 'Normal' } },
                peak: { score: 0, status: { level: 'normal', label: 'Normal' } }
            };
        }
        
        // Ensure arrays exist with defaults (defensive)
        if (!result.criticalPoints || !Array.isArray(result.criticalPoints)) {
            result.criticalPoints = [];
        }
        if (!result.interventionWindows || !Array.isArray(result.interventionWindows)) {
            result.interventionWindows = [];
        }
        if (!result.recommendations) {
            result.recommendations = { immediate: [], preventive: [], monitoring: [] };
        } else {
            // Ensure sub-arrays exist
            if (!result.recommendations.immediate) result.recommendations.immediate = [];
            if (!result.recommendations.preventive) result.recommendations.preventive = [];
            if (!result.recommendations.monitoring) result.recommendations.monitoring = [];
        }
        
        // Ensure metadata exists with defaults
        var metadata = result.metadata || {};
        var species = metadata.species || 'turf';
        var daysProjected = metadata.daysProjected || result.trajectory.length;
        
        // Build main structure
        var html = '<div class="gaip-trajectory-module">';
        
        // Header
        html += '<div class="gaip-section-header" style="margin-bottom: 10px; display:flex; align-items:baseline; gap:8px;">';
        html += '<span style="margin: 0; font-size: 13px; font-weight: 600; color: var(--gaip-text);">📈 Stress Trajectory</span>';
        html += '<span style="font-size: 11px; color: var(--gaip-text-secondary);">' + 
                daysProjected + '-day projection for ' + 
                escapeHtml(species) + '</span>';
        html += '</div>';
        
        // Summary (always visible)
        html += renderSummary(result);
        
        // Chart section (collapsible)
        html += '<div class="gaip-card" style="margin-top: 16px;">';
        html += '<div class="gaip-card-header" style="cursor: pointer; padding: 12px; background: var(--gaip-surface-muted); border-radius: 6px 6px 0 0; display: flex; justify-content: space-between; align-items: center; font-size: 14px;" data-toggle="trajectory-chart">';
        html += '<span style="font-weight: 500;">📊 Trajectory Chart</span>';
        html += '<span class="gaip-card-toggle">▼</span>';
        html += '</div>';
        html += '<div class="gaip-card-body" id="trajectory-chart-body" style="padding: 16px; border: 1px solid var(--gaip-border); border-top: none; border-radius: 0 0 6px 6px;">';
        html += '<div id="trajectory-chart-container"></div>';
        html += '</div></div>';
        
        // Critical Points (collapsible)
        html += '<div class="gaip-card" style="margin-top: 12px;">';
        html += '<div class="gaip-card-header" style="cursor: pointer; padding: 12px; background: var(--gaip-surface-muted); border-radius: 6px 6px 0 0; display: flex; justify-content: space-between; align-items: center; font-size: 14px;" data-toggle="critical-points">';
        html += '<span style="font-weight: 500;">⚠️ Critical Points (' + result.criticalPoints.length + ')</span>';
        html += '<span class="gaip-card-toggle">▼</span>';
        html += '</div>';
        html += '<div class="gaip-card-body" id="critical-points-body" style="padding: 16px; border: 1px solid var(--gaip-border); border-top: none; border-radius: 0 0 6px 6px; display: none;">';
        html += renderCriticalPoints(result.criticalPoints);
        html += '</div></div>';
        
        // Intervention Windows (collapsible)
        html += '<div class="gaip-card" style="margin-top: 12px;">';
        html += '<div class="gaip-card-header" style="cursor: pointer; padding: 12px; background: var(--gaip-surface-muted); border-radius: 6px 6px 0 0; display: flex; justify-content: space-between; align-items: center; font-size: 14px;" data-toggle="intervention-windows">';
        html += '<span style="font-weight: 500;">🎯 Intervention Windows (' + result.interventionWindows.length + ')</span>';
        html += '<span class="gaip-card-toggle">▼</span>';
        html += '</div>';
        html += '<div class="gaip-card-body" id="intervention-windows-body" style="padding: 16px; border: 1px solid var(--gaip-border); border-top: none; border-radius: 0 0 6px 6px; display: none;">';
        html += renderInterventionWindows(result.interventionWindows);
        html += '</div></div>';
        
        // Recommendations (collapsible)
        html += '<div class="gaip-card" style="margin-top: 12px;">';
        html += '<div class="gaip-card-header" style="cursor: pointer; padding: 12px; background: var(--gaip-surface-muted); border-radius: 6px 6px 0 0; display: flex; justify-content: space-between; align-items: center; font-size: 14px;" data-toggle="recommendations">';
        html += '<span style="font-weight: 500;">💡 Recommendations</span>';
        html += '<span class="gaip-card-toggle">▼</span>';
        html += '</div>';
        html += '<div class="gaip-card-body" id="recommendations-body" style="padding: 16px; border: 1px solid var(--gaip-border); border-top: none; border-radius: 0 0 6px 6px; display: none;">';
        html += renderRecommendations(result.recommendations);
        html += '</div></div>';
        
        // Event Simulator (collapsible)
        if (options.showSimulator !== false) {
            html += '<div class="gaip-card" style="margin-top: 12px;">';
            html += '<div class="gaip-card-header" style="cursor: pointer; padding: 12px; background: var(--gaip-surface-muted); border-radius: 6px 6px 0 0; display: flex; justify-content: space-between; align-items: center; font-size: 14px;" data-toggle="event-simulator">';
            html += '<span style="font-weight: 500;">⚡ Event Simulator</span>';
            html += '<span class="gaip-card-toggle">▼</span>';
            html += '</div>';
            html += '<div class="gaip-card-body" id="event-simulator-body" style="padding: 16px; border: 1px solid var(--gaip-border); border-top: none; border-radius: 0 0 6px 6px; display: none;">';
            html += renderEventSimulator();
            html += '</div></div>';
        }
        
        html += '</div>'; // End module
        
        container.innerHTML = html;
        
        // Render chart (after DOM is ready)
        setTimeout(function() {
            var chartContainer = container.querySelector('#trajectory-chart-container');
            if (!chartContainer) {
                chartContainer = document.getElementById('trajectory-chart-container');
            }
            if (chartContainer && result.trajectory) {
                var svg = renderChart(result.trajectory);
                chartContainer.appendChild(svg);
            }
        }, 50);
        
        // Attach toggle handlers
        attachToggleHandlers(container);
        
        // Store result for simulator
        container._trajectoryResult = result;
        
        // Attach simulator handler if present
        if (options.showSimulator !== false) {
            attachSimulatorHandler(container, options);
        }
    }

    /**
     * Attach toggle handlers for collapsible sections
     */
    function attachToggleHandlers(container) {
        var headers = container.querySelectorAll('.gaip-card-header[data-toggle]');
        for (var i = 0; i < headers.length; i++) {
            headers[i].addEventListener('click', function(e) {
                var targetId = this.getAttribute('data-toggle') + '-body';
                var body = document.getElementById(targetId);
                var toggle = this.querySelector('.gaip-card-toggle');
                
                if (body) {
                    if (body.style.display === 'none') {
                        body.style.display = 'block';
                        if (toggle) toggle.textContent = '▲';
                    } else {
                        body.style.display = 'none';
                        if (toggle) toggle.textContent = '▼';
                    }
                }
            });
        }
    }

    /**
     * Attach event simulator handler
     */
    function attachSimulatorHandler(container, options) {
        setTimeout(function() {
            // Set up duration unit switcher
            var typeSelect = document.getElementById('gaip-sim-type');
            if (typeSelect) {
                typeSelect.addEventListener('change', function() {
                    var eventType = this.value;
                    var label = document.getElementById('gaip-sim-duration-label');
                    var input = document.getElementById('gaip-sim-duration');
                    var unitInput = document.getElementById('gaip-sim-duration-unit');
                    var warning = document.getElementById('gaip-sim-cover-warning');
                    
                    if (eventType === 'concert' || eventType === 'cover' || eventType === 'festival') {
                        if (label) label.textContent = 'Duration (days)';
                        if (input) { input.value = '1'; input.min = '1'; input.max = '14'; }
                        if (unitInput) unitInput.value = 'days';
                        if (warning) warning.style.display = 'block';
                    } else {
                        if (label) label.textContent = 'Duration (minutes)';
                        if (input) { input.value = eventType === 'training' ? '60' : '90'; input.min = '30'; input.max = '300'; }
                        if (unitInput) unitInput.value = 'minutes';
                        if (warning) warning.style.display = 'none';
                    }
                });
            }
            
            var runBtn = document.getElementById('gaip-sim-run');
            if (runBtn) {
                runBtn.addEventListener('click', function() {
                    var dateInput = document.getElementById('gaip-sim-date');
                    var typeInput = document.getElementById('gaip-sim-type');
                    var intensityInput = document.getElementById('gaip-sim-intensity');
                    var durationInput = document.getElementById('gaip-sim-duration');
                    var resultsDiv = document.getElementById('gaip-sim-results');
                    
                    if (!dateInput.value) {
                        resultsDiv.innerHTML = '<p style="color: #ef4444;">Please select an event date.</p>';
                        return;
                    }
                    
                    var event = {
                        date: dateInput.value,
                        type: typeInput.value,
                        intensity: parseFloat(intensityInput.value),
                        duration: parseInt(durationInput.value, 10),
                        durationUnit: document.getElementById('gaip-sim-duration-unit') ? 
                                      document.getElementById('gaip-sim-duration-unit').value : 'minutes'
                    };
                    
                    // Get state and weather from options or stored data
                    if (options.onSimulate && typeof options.onSimulate === 'function') {
                        options.onSimulate(event, function(simResult) {
                            resultsDiv.innerHTML = renderSimulationResults(simResult);
                        });
                    } else {
                        resultsDiv.innerHTML = '<p style="color: var(--gaip-text);">Simulator not connected. Provide onSimulate callback in options.</p>';
                    }
                });
            }
        }, 50);
    }

    // =========================================================================
    // PUBLIC API
    // =========================================================================

    return {
        render: render,
        renderChart: renderChart,
        renderSummary: renderSummary,
        renderCriticalPoints: renderCriticalPoints,
        renderInterventionWindows: renderInterventionWindows,
        renderRecommendations: renderRecommendations,
        renderSimulationResults: renderSimulationResults,
        version: '1.2.0'
    };

})();

// Export for Node.js testing if available
if (typeof module !== 'undefined' && module.exports) {
    module.exports = StressTrajectoryUI;
}
