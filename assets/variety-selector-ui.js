/**
 * ============================================================================
 * GILBA VARIETY SELECTOR UI v1.0.0
 * ============================================================================
 * 
 * Dropdown component for variety selection with trait summary display.
 * Integrates with variety-traits-integration.js
 * 
 * Features:
 * - Species-aware variety dropdown
 * - Confidence level badges
 * - Trait summary panel
 * - Warning flags for low-confidence data
 * 
 * @requires variety-traits-integration.js
 * ============================================================================
 */

(function(global) {
    'use strict';

    // ========================================================================
    // CSS STYLES (inline for portability)
    // ========================================================================

    const VARIETY_SELECTOR_CSS = `
        .variety-selector-wrapper {
            margin: 12px 0;
        }
        
        .variety-selector-label {
            display: block;
            font-weight: 500;
            margin-bottom: 6px;
            color: var(--gaip-text);
        }
        
        .variety-selector {
            width: 100%;
            padding: 8px 12px;
            border: 1px solid var(--gaip-border);
            border-radius: 6px;
            font-size: 14px;
            background: var(--gaip-surface);
            cursor: pointer;
        }
        
        .variety-selector:focus {
            outline: none;
            border-color: #2563eb;
            box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.1);
        }
        
        .variety-summary {
            margin-top: 12px;
            padding: 12px;
            background: var(--gaip-surface-muted);
            border-radius: 8px;
            border-left: 3px solid #2563eb;
        }
        
        .variety-summary.has-warning {
            border-left-color: #dc2626;
            background: var(--gaip-critical-bg);
        }
        
        .variety-summary-header {
            display: flex;
            align-items: center;
            gap: 8px;
            margin-bottom: 8px;
        }
        
        .variety-name {
            font-weight: 600;
            color: var(--gaip-text);
        }
        
        .confidence-badge {
            display: inline-flex;
            align-items: center;
            gap: 4px;
            padding: 2px 8px;
            border-radius: 12px;
            font-size: 11px;
            font-weight: 500;
        }
        
        .confidence-badge.high {
            background: var(--gaip-good-bg);
            color: #166534;
        }
        
        .confidence-badge.medium {
            background: var(--gaip-warning-bg);
            color: #92400e;
        }
        
        .confidence-badge.low {
            background: var(--gaip-critical-bg);
            color: #991b1b;
        }
        
        .variety-traits {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
            gap: 8px;
        }
        
        .trait-item {
            display: flex;
            align-items: center;
            gap: 6px;
            font-size: 13px;
            color: var(--gaip-text);
        }
        
        .trait-icon {
            width: 16px;
            height: 16px;
            display: flex;
            align-items: center;
            justify-content: center;
        }
        
        .trait-icon.good { color: #16a34a; }
        .trait-icon.neutral { color: var(--gaip-text); }
        .trait-icon.poor { color: #dc2626; }
        
        .variety-warning {
            margin-top: 8px;
            padding: 8px;
            background: var(--gaip-critical-bg);
            border-radius: 4px;
            font-size: 12px;
            color: #991b1b;
            display: flex;
            align-items: flex-start;
            gap: 6px;
        }
        
        .variety-warning-icon {
            flex-shrink: 0;
            margin-top: 2px;
        }
        
        .no-variety-selected {
            padding: 12px;
            background: var(--gaip-surface-hover);
            border-radius: 8px;
            color: var(--gaip-text);
            font-size: 13px;
            font-style: italic;
        }
    `;

    // ========================================================================
    // INJECT CSS
    // ========================================================================

    function injectCSS() {
        if (document.getElementById('variety-selector-styles')) return;
        
        const style = document.createElement('style');
        style.id = 'variety-selector-styles';
        style.textContent = VARIETY_SELECTOR_CSS;
        document.head.appendChild(style);
    }

    // ========================================================================
    // UI COMPONENT
    // ========================================================================

    /**
     * Create variety selector dropdown
     * @param {HTMLElement} container - Container element
     * @param {object} options - Configuration options
     * @returns {object} Controller object with update methods
     */
    function createVarietySelector(container, options) {
        if (!container) return null;
        
        injectCSS();
        
        const config = Object.assign({
            species: 'bermuda',
            selectedVariety: null,
            showSummary: true,
            onChange: null,
            label: 'Variety'
        }, options);
        
        // Get variety traits integration
        const VT = global.GAIP_VarietyTraits;
        if (!VT) {
            container.innerHTML = '<div class="no-variety-selected">Variety traits data not loaded</div>';
            return null;
        }
        
        // Build HTML
        let html = `
            <div class="variety-selector-wrapper">
                <label class="variety-selector-label">${config.label}</label>
                <select class="variety-selector" id="variety-select-${Date.now()}">
                    <option value="">Select variety...</option>
                </select>
                <div class="variety-summary-container"></div>
            </div>
        `;
        
        container.innerHTML = html;
        
        const select = container.querySelector('.variety-selector');
        const summaryContainer = container.querySelector('.variety-summary-container');
        
        // Populate varieties
        function updateVarietyList(species) {
            const varieties = VT.buildVarietyOptions(species);
            
            select.innerHTML = '<option value="">Select variety...</option>';
            
            if (varieties.length === 0) {
                select.innerHTML = '<option value="">No varieties available</option>';
                return;
            }
            
            varieties.forEach(v => {
                const opt = document.createElement('option');
                opt.value = v.value;
                opt.textContent = v.label;
                if (v.hasWarning) opt.classList.add('has-warning');
                select.appendChild(opt);
            });
            
            // Add generic option
            const genericOpt = document.createElement('option');
            genericOpt.value = 'generic';
            genericOpt.textContent = 'Generic / Unknown';
            select.appendChild(genericOpt);
        }
        
        // Update summary panel
        function updateSummary(species, variety) {
            if (!variety || !config.showSummary) {
                summaryContainer.innerHTML = '';
                return;
            }
            
            const summary = VT.getVarietySummary(species, variety);
            
            if (!summary) {
                summaryContainer.innerHTML = `
                    <div class="no-variety-selected">
                        No trait data available for this variety
                    </div>
                `;
                return;
            }
            
            // Build trait items
            let traitsHtml = '';
            
            if (summary.traits.wear) {
                const icon = summary.traits.wear.value < 1 ? '↓' : (summary.traits.wear.value > 1 ? '↑' : '○');
                const iconClass = summary.traits.wear.value < 1 ? 'good' : (summary.traits.wear.value > 1 ? 'poor' : 'neutral');
                traitsHtml += `
                    <div class="trait-item">
                        <span class="trait-icon ${iconClass}">${icon}</span>
                        ${summary.traits.wear.label}
                    </div>
                `;
            }
            
            if (summary.traits.shade) {
                const icon = summary.traits.shade.value < 1 ? '☀' : (summary.traits.shade.value > 1 ? '☁' : '○');
                const iconClass = summary.traits.shade.value < 1 ? 'good' : (summary.traits.shade.value > 1 ? 'poor' : 'neutral');
                traitsHtml += `
                    <div class="trait-item">
                        <span class="trait-icon ${iconClass}">${icon}</span>
                        ${summary.traits.shade.label}
                    </div>
                `;
            }
            
            if (summary.traits.waterUse) {
                const icon = summary.traits.waterUse.value < 1 ? '💧' : '○';
                const iconClass = summary.traits.waterUse.value < 1 ? 'good' : 'neutral';
                traitsHtml += `
                    <div class="trait-item">
                        <span class="trait-icon ${iconClass}">${icon}</span>
                        ${summary.traits.waterUse.label}
                    </div>
                `;
            }
            
            if (summary.traits.coldTolerance) {
                const icon = summary.traits.coldTolerance.value < 1 ? '❄' : '○';
                const iconClass = summary.traits.coldTolerance.value < 1 ? 'good' : 'neutral';
                traitsHtml += `
                    <div class="trait-item">
                        <span class="trait-icon ${iconClass}">${icon}</span>
                        ${summary.traits.coldTolerance.label}
                    </div>
                `;
            }
            
            if (summary.traits.recovery) {
                const icon = summary.traits.recovery.value < 1 ? '🔄' : '○';
                const iconClass = summary.traits.recovery.value < 1 ? 'good' : 'neutral';
                traitsHtml += `
                    <div class="trait-item">
                        <span class="trait-icon ${iconClass}">${icon}</span>
                        ${summary.traits.recovery.label}
                    </div>
                `;
            }
            
            // Disease traits
            if (summary.traits.disease) {
                for (const [disease, data] of Object.entries(summary.traits.disease)) {
                    const icon = data.value < 1 ? '✓' : (data.value > 1 ? '⚠' : '○');
                    const iconClass = data.value < 1 ? 'good' : (data.value > 1 ? 'poor' : 'neutral');
                    traitsHtml += `
                        <div class="trait-item">
                            <span class="trait-icon ${iconClass}">${icon}</span>
                            ${data.label}
                        </div>
                    `;
                }
            }
            
            // Warnings
            let warningsHtml = '';
            if (summary.warnings.length > 0) {
                warningsHtml = summary.warnings.map(w => `
                    <div class="variety-warning">
                        <span class="variety-warning-icon">⚠</span>
                        <span>${w}</span>
                    </div>
                `).join('');
            }
            
            // Get primary confidence
            const primaryConf = summary.traits.wear?.confidence || 
                               summary.traits.shade?.confidence || 
                               'none';
            const confBadge = VT.getConfidenceBadge(primaryConf);
            
            summaryContainer.innerHTML = `
                <div class="variety-summary ${summary.warnings.length > 0 ? 'has-warning' : ''}">
                    <div class="variety-summary-header">
                        <span class="variety-name">${variety}</span>
                        <span class="confidence-badge ${primaryConf}" title="${confBadge.label}">
                            ${confBadge.icon} ${primaryConf.toUpperCase()}
                        </span>
                    </div>
                    <div class="variety-traits">
                        ${traitsHtml || '<span style="color:var(--gaip-text)">No trait modifiers</span>'}
                    </div>
                    ${warningsHtml}
                </div>
            `;
        }
        
        // Event handler
        select.addEventListener('change', function() {
            const variety = this.value;
            updateSummary(config.species, variety);
            
            if (config.onChange) {
                config.onChange(variety, VT.getWearModifier(config.species, variety));
            }
        });
        
        // Initial setup
        updateVarietyList(config.species);
        
        if (config.selectedVariety) {
            select.value = config.selectedVariety;
            updateSummary(config.species, config.selectedVariety);
        }
        
        // Return controller
        return {
            setSpecies: function(species) {
                config.species = species;
                updateVarietyList(species);
                select.value = '';
                summaryContainer.innerHTML = '';
            },
            
            setVariety: function(variety) {
                select.value = variety;
                updateSummary(config.species, variety);
            },
            
            getVariety: function() {
                return select.value;
            },
            
            getModifiers: function() {
                const variety = select.value;
                if (!variety) return null;
                
                return {
                    wear: VT.getWearModifier(config.species, variety),
                    shade: VT.getShadeModifier(config.species, variety),
                    cold: VT.getColdModifier(config.species, variety),
                    waterUse: VT.getWaterUseModifier(config.species, variety)
                };
            }
        };
    }

    // ========================================================================
    // EXPORTS
    // ========================================================================

    global.GAIP_VarietySelector = {
        create: createVarietySelector
    };

})(typeof window !== 'undefined' ? window : this);
