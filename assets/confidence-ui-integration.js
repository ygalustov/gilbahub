/**
 * =============================================================================
 * GILBA CONFIDENCE UI INTEGRATION v1.0.1
 * =============================================================================
 * 
 * v1.0.1 - Fixed TypeError when warnings array is undefined
 * 
 * Displays confidence badges and warnings in the Hub UI
 * Listens for orchestrator completion and renders confidence information
 * 
 * @author Gilba Solutions
 * @version 1.0.0
 * =============================================================================
 */

(function(global) {
    'use strict';

    const VERSION = '1.0.2';
    let _initialized = false;
    let _confidencePanelContainer = null;

    // =========================================================================
    // INITIALIZATION
    // =========================================================================

    function init() {
        if (_initialized) return;
        
        // Listen for orchestrator completion
        document.addEventListener('gaip:orchestrator-complete', handleOrchestratorComplete);
        
        // Listen for analysis complete (backup)
        document.addEventListener('gaip:analysis-complete', handleAnalysisComplete);
        
        // Create floating confidence indicator
        createConfidenceIndicator();
        
        _initialized = true;
    }

    // =========================================================================
    // EVENT HANDLERS
    // =========================================================================

    function handleOrchestratorComplete(e) {
        const confidence = e.detail?.confidence;
        if (confidence) {
            updateConfidenceIndicator(confidence);
            renderWarningsToast(confidence.warnings);
        }
    }

    function handleAnalysisComplete(e) {
        // Calculate confidence if orchestrator didn't provide it
        if (!global.GilbaEngineConfidence) return;
        
        const state = e.detail?.state || global.GAIP_STATE;
        if (!state) return;
        
        // Small delay to ensure orchestrator has run
        setTimeout(() => {
            if (!state.computed?.confidence) {
                const confidence = global.GilbaEngineConfidence.getConfidenceSummary(state);
                updateConfidenceIndicator(confidence);
            }
        }, 500);
    }

    // =========================================================================
    // UI COMPONENTS
    // =========================================================================

    /**
     * Create floating confidence indicator in results header
     */
    function createConfidenceIndicator() {
        // Find results container header
        const resultsHeader = document.querySelector('.gaip-results-header, .gaip-results > h2, .gaip-results > h3');
        
        if (!resultsHeader) {
            // Try to inject into results section after it exists
            const observer = new MutationObserver((mutations, obs) => {
                const header = document.querySelector('.gaip-results-header, .gaip-results .gaip-section-title');
                if (header) {
                    injectIndicatorIntoHeader(header);
                    obs.disconnect();
                }
            });
            
            const results = document.querySelector('.gaip-results');
            if (results) {
                observer.observe(results, { childList: true, subtree: true });
            }
            return;
        }
        
        injectIndicatorIntoHeader(resultsHeader);
    }

    function injectIndicatorIntoHeader(header) {
        // Don't duplicate
        if (header.querySelector('.gaip-confidence-indicator')) return;
        
        const indicator = document.createElement('span');
        indicator.className = 'gaip-confidence-indicator';
        indicator.id = 'gaip-confidence-indicator';
        indicator.style.cssText = `
            display: none;
            margin-left: auto;
            cursor: pointer;
        `;
        indicator.title = 'Click for confidence details';
        indicator.onclick = showConfidenceDetails;
        
        header.style.display = 'flex';
        header.style.alignItems = 'center';
        header.appendChild(indicator);
        
        _confidencePanelContainer = indicator;
    }

    /**
     * Update the confidence indicator with current values
     */
    function updateConfidenceIndicator(confidence) {
        let indicator = document.getElementById('gaip-confidence-indicator');
        
        // Guard: Don't display if confidence or score is undefined
        if (!confidence || confidence.score === undefined || confidence.score === null) {
            if (indicator) {
                indicator.style.display = 'none';
                indicator.innerHTML = '';
            }
            return;
        }
        
        // If indicator doesn't exist, create it dynamically
        if (!indicator) {
            // Try to find a suitable container
            const diseaseCard = document.querySelector('.gaip-disease-section .gaip-card-header, .gaip-disease-body');
            if (diseaseCard && !diseaseCard.querySelector('.gaip-confidence-indicator')) {
                indicator = document.createElement('span');
                indicator.className = 'gaip-confidence-indicator';
                indicator.id = 'gaip-confidence-indicator-disease';
                indicator.style.cssText = 'margin-left: 8px; cursor: pointer;';
                indicator.onclick = showConfidenceDetails;
                diseaseCard.appendChild(indicator);
            }
            
            if (!indicator) return;
        }
        
        indicator.style.display = 'inline-flex';
        indicator.innerHTML = global.GilbaEngineConfidence.renderCompactConfidence(confidence.score, true);
        
        // Store confidence for details panel
        indicator.dataset.confidence = JSON.stringify(confidence);
    }

    /**
     * Show detailed confidence breakdown
     */
    function showConfidenceDetails(e) {
        const target = e.currentTarget;
        const confidenceData = target.dataset.confidence;
        if (!confidenceData) return;
        
        const confidence = JSON.parse(confidenceData);
        
        // Create/update details panel
        let panel = document.getElementById('gaip-confidence-details-panel');
        if (!panel) {
            panel = document.createElement('div');
            panel.id = 'gaip-confidence-details-panel';
            panel.className = 'gaip-confidence-details-panel';
            document.body.appendChild(panel);
        }
        
        panel.innerHTML = buildConfidenceDetailsHTML(confidence);
        panel.style.display = panel.style.display === 'block' ? 'none' : 'block';
        
        // Position near the indicator
        const rect = target.getBoundingClientRect();
        panel.style.position = 'fixed';
        panel.style.top = (rect.bottom + 8) + 'px';
        panel.style.right = '20px';
        panel.style.zIndex = '10000';
        
        // Close on click outside
        setTimeout(() => {
            document.addEventListener('click', closePanelOnClickOutside);
        }, 100);
    }

    function closePanelOnClickOutside(e) {
        const panel = document.getElementById('gaip-confidence-details-panel');
        if (panel && !panel.contains(e.target) && !e.target.closest('.gaip-confidence-indicator')) {
            panel.style.display = 'none';
            document.removeEventListener('click', closePanelOnClickOutside);
        }
    }

    function buildConfidenceDetailsHTML(confidence) {
        let html = `
            <div style="
                background: var(--gaip-surface);
                border: 1px solid var(--gaip-border);
                border-radius: 8px;
                box-shadow: 0 10px 25px rgba(0,0,0,0.15);
                padding: 16px;
                max-width: 350px;
                font-size: 13px;
            ">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
                    <strong style="font-size: 14px;">Analysis Confidence</strong>
                    <span style="
                        font-size: 18px;
                        font-weight: 700;
                        color: ${confidence.color};
                    ">${confidence.score}%</span>
                </div>
        `;
        
        // Input completeness section
        const completeness = confidence.inputCompleteness;
        html += `
            <div style="margin-bottom: 12px;">
                <div style="font-size: 11px; color: var(--gaip-text); margin-bottom: 4px;">Input Completeness</div>
                <div style="height: 6px; background: var(--gaip-border); border-radius: 3px; overflow: hidden;">
                    <div style="height: 100%; width: ${completeness.score}%; background: ${confidence.color}; transition: width 0.3s;"></div>
                </div>
            </div>
        `;
        
        // Present inputs
        if (completeness.present.length > 0) {
            html += `
                <div style="margin-bottom: 8px;">
                    <div style="font-size: 10px; color: #059669; font-weight: 600; margin-bottom: 4px;">✓ Available</div>
                    <div style="font-size: 11px; color: var(--gaip-text);">
                        ${completeness.present.map(p => p.label).join(', ')}
                    </div>
                </div>
            `;
        }
        
        // Missing inputs
        if (completeness.missing.length > 0) {
            const critical = completeness.missing.filter(m => m.importance === 'critical');
            const other = completeness.missing.filter(m => m.importance !== 'critical');
            
            if (critical.length > 0) {
                html += `
                    <div style="margin-bottom: 8px; padding: 8px; background: var(--gaip-critical-bg); border-radius: 4px;">
                        <div style="font-size: 10px; color: #dc2626; font-weight: 600; margin-bottom: 4px;">⚠️ Critical Missing</div>
                        <div style="font-size: 11px; color: #991b1b;">
                            ${critical.map(m => m.label).join(', ')}
                        </div>
                    </div>
                `;
            }
            
            if (other.length > 0) {
                html += `
                    <div style="margin-bottom: 8px;">
                        <div style="font-size: 10px; color: #d97706; font-weight: 600; margin-bottom: 4px;">Optional Missing</div>
                        <div style="font-size: 11px; color: var(--gaip-text);">
                            ${other.map(m => m.label).join(', ')}
                        </div>
                    </div>
                `;
            }
        }
        
        // Warnings
        const warnings = confidence.warnings.filter(w => w.level !== 'info');
        if (warnings.length > 0) {
            html += `
                <div style="border-top: 1px solid var(--gaip-border); padding-top: 8px; margin-top: 8px;">
                    <div style="font-size: 10px; color: var(--gaip-text); font-weight: 600; margin-bottom: 6px;">Recommendations</div>
            `;
            
            warnings.slice(0, 4).forEach(w => {
                const color = w.level === 'error' ? '#dc2626' : '#d97706';
                const icon = w.level === 'error' ? '⚠️' : '💡';
                html += `
                    <div style="font-size: 11px; color: ${color}; margin-bottom: 4px; display: flex; gap: 6px;">
                        <span>${icon}</span>
                        <span>${w.message}</span>
                    </div>
                `;
            });
            
            html += '</div>';
        }
        
        html += `
                <div style="text-align: center; margin-top: 12px; padding-top: 8px; border-top: 1px solid var(--gaip-border);">
                    <button onclick="document.getElementById('gaip-confidence-details-panel').style.display='none'" style="
                        background: var(--gaip-surface-hover);
                        border: none;
                        padding: 6px 16px;
                        border-radius: 4px;
                        cursor: pointer;
                        font-size: 11px;
                        color: var(--gaip-text);
                    ">Close</button>
                </div>
            </div>
        `;
        
        return html;
    }

    /**
     * Show toast notification for important warnings
     */
    function renderWarningsToast(warnings) {
        // Guard against undefined/null warnings array
        if (!warnings || !Array.isArray(warnings)) {
            return;
        }
        
        // Only show for errors/warnings, not info
        const importantWarnings = warnings.filter(w => w.level === 'error' || w.level === 'warning');
        if (importantWarnings.length === 0) return;
        
        // Only show once per session for same warnings
        const warningKey = importantWarnings.map(w => w.input).sort().join(',');
        if (global._lastWarningKey === warningKey) return;
        global._lastWarningKey = warningKey;
        
        // Create toast
        let toast = document.getElementById('gaip-confidence-toast');
        if (!toast) {
            toast = document.createElement('div');
            toast.id = 'gaip-confidence-toast';
            toast.style.cssText = `
                position: fixed;
                bottom: 20px;
                right: 20px;
                background: var(--gaip-warning-bg);
                border: 1px solid #f59e0b;
                border-radius: 8px;
                padding: 12px 16px;
                box-shadow: 0 4px 12px rgba(0,0,0,0.15);
                z-index: 10001;
                max-width: 320px;
                font-size: 12px;
                animation: slideIn 0.3s ease;
            `;
            document.body.appendChild(toast);
            
            // Add animation style
            if (!document.getElementById('gaip-toast-style')) {
                const style = document.createElement('style');
                style.id = 'gaip-toast-style';
                style.textContent = `
                    @keyframes slideIn {
                        from { transform: translateX(100%); opacity: 0; }
                        to { transform: translateX(0); opacity: 1; }
                    }
                `;
                document.head.appendChild(style);
            }
        }
        
        toast.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: start; gap: 12px;">
                <div>
                    <div style="font-weight: 600; color: #92400e; margin-bottom: 4px;">
                        ⚡ Data Quality Notice
                    </div>
                    <div style="color: #78350f;">
                        ${importantWarnings[0].message}
                        ${importantWarnings.length > 1 ? `<br><span style="font-size: 11px; opacity: 0.8;">+ ${importantWarnings.length - 1} more</span>` : ''}
                    </div>
                </div>
                <button onclick="this.parentElement.parentElement.style.display='none'" style="
                    background: none;
                    border: none;
                    cursor: pointer;
                    color: #92400e;
                    font-size: 16px;
                    padding: 0;
                    line-height: 1;
                ">×</button>
            </div>
        `;
        
        toast.style.display = 'block';
        
        // Auto-hide after 8 seconds
        setTimeout(() => {
            if (toast) toast.style.display = 'none';
        }, 8000);
    }

    // =========================================================================
    // EXPORTS
    // =========================================================================

    global.GilbaConfidenceUI = {
        version: VERSION,
        init: init,
        updateConfidenceIndicator: updateConfidenceIndicator,
        showConfidenceDetails: showConfidenceDetails,
        renderWarningsToast: renderWarningsToast
    };

    // Auto-init on DOM ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }


})(typeof window !== 'undefined' ? window : this);
