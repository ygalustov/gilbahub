/**
 * Tissue Analysis Progressive Disclosure Module
 * Integrates with Gilba Agronomic Intelligence Hub
 * Includes soil-tissue cross-validation
 */

// =====================================================
// TISSUE PROGRESSIVE DISCLOSURE ENGINE
// =====================================================

function renderTissueProgressiveDisclosure(tissueHTML, tissueData, soilData) {
    
    if (!tissueData || !tissueData.status) {
        return `
            <div class="gaip-tissue-no-data">
                <p class="gaip-note">
                    <strong>No tissue test data entered.</strong><br>
                    Enter tissue nutrient values (N, P, K, Ca, Mg, S, Fe, Mn, Zn, Cu, B) in the Tissue Testing section.
                </p>
            </div>
        `;
    }

    // Build diagnostics from tissue data
    const diagnostics = buildTissueDiagnostics(tissueData, soilData);
    
    
    if (diagnostics.length === 0) {
        return '<p class="gaip-note">Tissue data present but insufficient for analysis</p>';
    }

    let html = '<div class="gaip-tissue-progressive-container">';
    
    // Render diagnostic cards
    html += '<div class="gaip-tissue-cards-grid">';
    diagnostics.forEach(diagnostic => {
        html += renderTissueCard(diagnostic);
    });
    html += '</div>';

    // Render limiting nutrients section if any
    const limiting = diagnostics.filter(d => 
        d.statusClass === 'status-deficient' || d.statusClass === 'status-borderline'
    );
    
    if (limiting.length > 0) {
        html += renderLimitingNutrientsSection(limiting);
    }

    // Render soil-tissue cross-validation if we have soil data
    if (soilData && soilData.ppm) {
        const crossValidation = buildSoilTissueCrossValidation(tissueData, soilData);
        if (crossValidation.length > 0) {
            html += renderCrossValidationSection(crossValidation);
        }
    }

    html += '</div>';
    return html;
}

/**
 * Build tissue diagnostics from tissue engine output
 */
function buildTissueDiagnostics(tissueData, soilData) {
    const diagnostics = [];
    const status = tissueData.status || {};
    
    // Macronutrients (order by importance)
    const macros = ['N', 'P', 'K', 'Ca', 'Mg', 'S'];
    const traces = ['Fe', 'Mn', 'Zn', 'Cu', 'B'];
    
    // Process macros first
    macros.forEach(nutrient => {
        if (!status[nutrient]) return;
        
        const diagnostic = buildNutrientDiagnostic(
            nutrient,
            status[nutrient],
            'macro',
            tissueData,
            soilData
        );
        
        if (diagnostic) diagnostics.push(diagnostic);
    });
    
    // Then traces
    traces.forEach(nutrient => {
        if (!status[nutrient]) return;
        
        const diagnostic = buildNutrientDiagnostic(
            nutrient,
            status[nutrient],
            'trace',
            tissueData,
            soilData
        );
        
        if (diagnostic) diagnostics.push(diagnostic);
    });
    
    return diagnostics;
}

/**
 * Build individual nutrient diagnostic
 */
function buildNutrientDiagnostic(nutrient, nutrientStatus, type, tissueData, soilData) {
    const band = nutrientStatus.band;
    const value = nutrientStatus.value;
    const range = nutrientStatus.range;
    
    if (!band || !value) return null;
    
    // Determine status
    const statusInfo = getTissueStatus(band, nutrient);
    
    // Build recommendation
    const recommendation = getTissueRecommendation(nutrient, band, type, tissueData, soilData);
    
    // Check for soil-tissue mismatch
    const mismatch = checkSoilTissueMismatch(nutrient, band, soilData);
    
    return {
        parameter: nutrient,
        label: getNutrientLabel(nutrient),
        value: value.toFixed(type === 'macro' ? 2 : 0),
        unit: type === 'macro' ? '%' : 'mg/kg',
        status: statusInfo.label,
        statusClass: statusInfo.class,
        driver: statusInfo.driver,
        recommendation: recommendation,
        range: range,
        mismatch: mismatch,
        type: type
    };
}

/**
 * Get tissue status from band
 */
function getTissueStatus(band, nutrient) {
    switch (band) {
        case 'Deficient':
            return {
                label: 'Deficient',
                class: 'status-deficient',
                driver: 'Below sufficiency range'
            };
        case 'Marginal':
            return {
                label: 'Marginal',
                class: 'status-borderline',
                driver: 'Near lower threshold'
            };
        case 'Sufficient':
            return {
                label: 'Sufficient',
                class: 'status-adequate',
                driver: 'Within optimal range'
            };
        case 'High':
            return {
                label: 'High',
                class: 'status-borderline',
                driver: 'Above upper threshold'
            };
        default:
            return {
                label: 'Unknown',
                class: 'status-no-data',
                driver: 'Status unclear'
            };
    }
}

/**
 * Get nutrient label
 */
function getNutrientLabel(nutrient) {
    const labels = {
        'N': 'Nitrogen (N)',
        'P': 'Phosphorus (P)',
        'K': 'Potassium (K)',
        'Ca': 'Calcium (Ca)',
        'Mg': 'Magnesium (Mg)',
        'S': 'Sulphur (S)',
        'Fe': 'Iron (Fe)',
        'Mn': 'Manganese (Mn)',
        'Zn': 'Zinc (Zn)',
        'Cu': 'Copper (Cu)',
        'B': 'Boron (B)'
    };
    return labels[nutrient] || nutrient;
}

/**
 * Get tissue recommendation
 */
function getTissueRecommendation(nutrient, band, type, tissueData, soilData) {
    if (band === 'Deficient') {
        if (type === 'macro') {
            return `Apply ${nutrient} through soil program + foliar if rapid response needed`;
        } else {
            return `Apply foliar ${nutrient} for rapid correction (10-21 day response)`;
        }
    } else if (band === 'Marginal') {
        return `Monitor closely - supplement with ${type === 'macro' ? 'soil + foliar' : 'foliar'} ${nutrient} if symptoms appear`;
    } else if (band === 'High') {
        return `Reduce ${nutrient} applications - check for imbalance with other nutrients`;
    } else {
        return `Maintain current ${nutrient} program`;
    }
}

/**
 * Check for soil-tissue mismatch
 */
function checkSoilTissueMismatch(nutrient, tissueBand, soilData) {
    if (!soilData || !soilData.ppm || !soilData.ppm[nutrient]) {
        return null;
    }
    
    // Get MLSN threshold
    const mlsnThresholds = {
        'P': 21, 'K': 37, 'Ca': 331, 'Mg': 47, 'S': 7,
        'Fe': 2, 'Mn': 1, 'Zn': 1, 'Cu': 0.3, 'B': 0.3
    };
    
    const soilValue = soilData.ppm[nutrient];
    const mlsn = mlsnThresholds[nutrient];
    
    if (!mlsn) return null;
    
    const soilAdequate = soilValue >= mlsn;
    const tissueDeficient = (tissueBand === 'Deficient' || tissueBand === 'Marginal');
    
    // Mismatch: adequate soil but deficient tissue = uptake constraint
    if (soilAdequate && tissueDeficient) {
        return {
            type: 'UPTAKE_CONSTRAINT',
            message: `Soil ${nutrient} adequate (${soilValue.toFixed(1)} ppm) but tissue deficient → uptake constraint`,
            cause: 'Check water quality, pH, compaction, or root health'
        };
    }
    
    // Mismatch: deficient soil but adequate tissue = recent fertiliser
    if (!soilAdequate && !tissueDeficient) {
        return {
            type: 'RECENT_FERTILIZER',
            message: `Tissue ${nutrient} adequate but soil low (${soilValue.toFixed(1)} ppm) → recent fertiliser effect`,
            cause: 'Temporary - continue soil program to build reserves'
        };
    }
    
    return null;
}

/**
 * Build soil-tissue cross-validation
 */
function buildSoilTissueCrossValidation(tissueData, soilData) {
    const crossValidation = [];
    const status = tissueData.status || {};
    
    const nutrients = ['P', 'K', 'Ca', 'Mg', 'S', 'Fe', 'Mn', 'Zn', 'Cu', 'B'];
    
    nutrients.forEach(nutrient => {
        if (!status[nutrient] || !soilData.ppm[nutrient]) return;
        
        const mismatch = checkSoilTissueMismatch(
            nutrient,
            status[nutrient].band,
            soilData
        );
        
        if (mismatch) {
            crossValidation.push({
                nutrient: nutrient,
                label: getNutrientLabel(nutrient),
                type: mismatch.type,
                message: mismatch.message,
                cause: mismatch.cause,
                priority: mismatch.type === 'UPTAKE_CONSTRAINT' ? 1 : 2
            });
        }
    });
    
    // Sort by priority
    crossValidation.sort((a, b) => a.priority - b.priority);
    
    return crossValidation;
}

/**
 * Render tissue card
 */
function renderTissueCard(diagnostic) {
    const cardId = `tissue-${diagnostic.parameter}-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
    
    return `
        <div class="gaip-diagnostic-card tissue-card ${diagnostic.mismatch ? 'tissue-mismatch' : ''}">
            <div class="gaip-verdict">
                <div class="gaip-verdict-header">
                    <h4 class="gaip-parameter">${diagnostic.label}</h4>
                    <div class="gaip-status-badge ${diagnostic.statusClass}">
                        <span class="gaip-status-icon">${getStatusIcon(diagnostic.statusClass)}</span>
                        <span class="gaip-status-label">${diagnostic.status}</span>
                    </div>
                </div>
                <div class="gaip-verdict-content">
                    <div class="gaip-driver">
                        <span class="gaip-label">Tissue:</span>
                        <span class="gaip-value">${diagnostic.value} ${diagnostic.unit}</span>
                    </div>
                    ${diagnostic.range ? `
                        <div class="gaip-range-info">
                            <span class="gaip-label">Range:</span>
                            <span class="gaip-range-value">${diagnostic.range.lo.toFixed(diagnostic.type === 'macro' ? 2 : 0)}-${diagnostic.range.hi.toFixed(diagnostic.type === 'macro' ? 2 : 0)} ${diagnostic.unit}</span>
                        </div>
                    ` : ''}
                    <div class="gaip-driver-text">${diagnostic.driver}</div>
                    ${diagnostic.mismatch ? `
                        <div class="gaip-mismatch-flag">
                            ⚠️ ${diagnostic.mismatch.type === 'UPTAKE_CONSTRAINT' ? 'Uptake issue' : 'Recent fertiliser'}
                        </div>
                    ` : ''}
                    <div class="gaip-confidence confidence-high">
                        <span class="gaip-confidence-bars">▮▮▮▮▯</span>
                        <span class="gaip-confidence-percentage">90%</span>
                    </div>
                </div>
                <div class="gaip-verdict-actions">
                    <button class="gaip-expand-btn" data-target="why-${cardId}">
                        Why? <span class="gaip-icon">▼</span>
                    </button>
                    <button class="gaip-tissue-assumptions-btn" data-nutrient="${diagnostic.parameter}" title="Show assumptions">
                        <span class="gaip-icon-info">ⓘ</span>
                    </button>
                </div>
            </div>
            <div class="gaip-why-section gaip-collapsed" id="why-${cardId}">
                <div class="gaip-why-content">
                    <div class="gaip-recommendation">
                        <span class="gaip-label">Management:</span>
                        <div class="gaip-recommendation-text">${diagnostic.recommendation}</div>
                    </div>
                    ${diagnostic.mismatch ? `
                        <div class="gaip-mismatch-details" style="margin-top: 12px; padding: 10px; background: var(--gaip-warning-bg); border-left: 3px solid #f59e0b; border-radius: 4px;">
                            <strong>🔍 Soil-Tissue Mismatch:</strong><br>
                            <span style="font-size: 12px;">${diagnostic.mismatch.message}</span><br>
                            <span style="font-size: 11px; color: var(--gaip-text);"><strong>Cause:</strong> ${diagnostic.mismatch.cause}</span>
                        </div>
                    ` : ''}
                </div>
            </div>
        </div>
    `;
}

/**
 * Get status icon
 */
function getStatusIcon(statusClass) {
    if (statusClass === 'status-adequate') return '✓';
    if (statusClass === 'status-deficient') return '⚠';
    if (statusClass === 'status-borderline') return '⚠';
    return '?';
}

/**
 * Render limiting nutrients section
 */
function renderLimitingNutrientsSection(limiting) {
    const sectionId = `tissue-limiting-${Date.now()}`;
    
    return `
        <div class="gaip-tissue-limiting-section">
            <div class="gaip-section-header">
                <h4>Priority Nutrient Corrections</h4>
                <button class="gaip-expand-btn" data-target="${sectionId}">
                    <span class="gaip-icon">▼</span>
                </button>
            </div>
            <div class="gaip-collapsible-content gaip-collapsed" id="${sectionId}">
                <div class="gaip-limiting-summary">
                    <p style="font-weight: 600; color: #dc2626; margin: 0 0 12px 0;">
                        ${limiting.length} nutrient${limiting.length > 1 ? 's' : ''} below sufficiency:
                    </p>
                    <ul style="margin: 0; padding-left: 20px;">
                        ${limiting.map(d => `
                            <li style="margin: 6px 0;">
                                <strong>${d.label}:</strong> ${d.value} ${d.unit} 
                                <span style="color: var(--gaip-text);">(${d.status})</span>
                                <br>
                                <span style="font-size: 12px; color: var(--gaip-text);">${d.recommendation}</span>
                            </li>
                        `).join('')}
                    </ul>
                </div>
            </div>
        </div>
    `;
}

/**
 * Render cross-validation section
 */
function renderCrossValidationSection(crossValidation) {
    if (crossValidation.length === 0) return '';
    
    const sectionId = `tissue-cross-${Date.now()}`;
    
    return `
        <div class="gaip-tissue-cross-section" style="margin-top: 20px;">
            <div class="gaip-section-header">
                <h4>🔗 Soil-Tissue Cross-Validation</h4>
                <button class="gaip-expand-btn" data-target="${sectionId}">
                    <span class="gaip-icon">▼</span>
                </button>
            </div>
            <div class="gaip-collapsible-content gaip-collapsed" id="${sectionId}">
                <div class="gaip-cross-validation-items">
                    ${crossValidation.map(item => `
                        <div class="gaip-cross-item" style="margin: 12px 0; padding: 12px; background: ${item.type === 'UPTAKE_CONSTRAINT' ? 'var(--gaip-critical-bg)' : 'var(--gaip-info-bg)'}; border-left: 3px solid ${item.type === 'UPTAKE_CONSTRAINT' ? '#dc2626' : '#3b82f6'}; border-radius: 4px;">
                            <strong style="font-size: 13px;">${item.label}</strong>
                            <span style="display: inline-block; margin-left: 8px; padding: 2px 8px; background: var(--gaip-surface); border-radius: 12px; font-size: 11px; font-weight: 600;">
                                ${item.type === 'UPTAKE_CONSTRAINT' ? '🚫 Uptake Constraint' : '📈 Recent Fertiliser'}
                            </span>
                            <br>
                            <span style="font-size: 12px; color: var(--gaip-text); margin-top: 4px; display: block;">${item.message}</span>
                            <span style="font-size: 11px; color: var(--gaip-text); margin-top: 4px; display: block;"><strong>Action:</strong> ${item.cause}</span>
                        </div>
                    `).join('')}
                </div>
            </div>
        </div>
    `;
}

// Export function
if (typeof window !== 'undefined') {
    window.renderTissueProgressiveDisclosure = renderTissueProgressiveDisclosure;
    
    /* ================================================================
       TURF PROFILE LISTENER
       Updates tissue interpretation context based on turf type.
       Golf greens have different tissue sufficiency ranges than sports fields.
    ================================================================ */
    
    // Current turf context for tissue interpretation
    var tissueTurfContext = {
        turfType: null,
        subCategory: null,
        tissueContext: 'sports',  // Default
        description: ''
    };
    
    /**
     * Handle turf profile changes
     * Updates tissue interpretation context
     */
    function handleTissueProfileChange(event) {
        var detail = event.detail;
        var thresholds = detail.thresholds;
        
        if (thresholds) {
            tissueTurfContext.turfType = detail.turfType;
            tissueTurfContext.subCategory = detail.subCategory;
            tissueTurfContext.tissueContext = thresholds.tissueContext || 'sports';
            tissueTurfContext.description = thresholds.description || '';
            
        }
    }
    
    /**
     * Get current turf context for tissue calculations
     */
    window.gaip_tissue_getTurfContext = function() {
        return tissueTurfContext;
    };
    
    // Listen for turf profile changes
    document.addEventListener('gaip:turf-profile-change', handleTissueProfileChange);
    
    // Tissue assumptions click handler
    document.addEventListener('click', function(e) {
        if (e.target.closest('.gaip-tissue-assumptions-btn')) {
            const btn = e.target.closest('.gaip-tissue-assumptions-btn');
            const nutrient = btn.dataset.nutrient;
            showTissueAssumptions(btn, nutrient);
        }
    });
    
}

/**
 * Show tissue test assumptions tooltip
 */
function showTissueAssumptions(btn, nutrient) {
    // Get species from tissue module
    const speciesSelect = document.querySelector('[data-tissue="speciesGroup"]');
    const species = speciesSelect ? speciesSelect.value : 'bentgrass';
    
    const speciesNames = {
        'bentgrass': 'Bentgrass',
        'perennialRyegrass': 'Perennial Ryegrass',
        'poaAnnua': 'Poa annua',
        'couch': 'Couch/Bermuda',
        'C3': 'C3 (cool-season)',
        'C4': 'C4 (warm-season)'
    };
    
    const speciesName = speciesNames[species] || species;
    
    const assumptions = [
        `Sufficiency ranges for ${speciesName}`,
        'Wet chemistry analysis (ICP-OES/AAS)',
        'Whole leaf tissue sample assumed',
        'Marginal = within 10% of deficiency threshold',
        'Values normalized to % (macros) or ppm (traces)'
    ];
    
    // Add nutrient-specific notes
    const nutrientNotes = {
        'N': 'N status affected by recent fertilization and PGR use',
        'P': 'P uptake pH-dependent; may appear low on high-pH soils',
        'K': 'K:Mg ratio affects uptake; luxury consumption common',
        'Ca': 'Ca relatively immobile; deficiency rare in turf',
        'Mg': 'Mg deficiency often from K excess, not low soil Mg',
        'S': 'S correlates with N; ratio typically 15:1 N:S',
        'Fe': 'Fe chlorosis often pH-induced, not true deficiency',
        'Mn': 'Mn toxicity possible on acidic soils',
        'Zn': 'Zn-P antagonism: high P can reduce Zn uptake',
        'Cu': 'Cu toxicity risk on sand greens with repeated apps',
        'B': 'B has narrow sufficiency range; toxicity risk'
    };
    
    if (nutrientNotes[nutrient]) {
        assumptions.push(nutrientNotes[nutrient]);
    }
    
    // Remove existing tooltips
    document.querySelectorAll('.gaip-assumptions-tooltip').forEach(t => t.remove());

    const tooltip = document.createElement('div');
    tooltip.className = 'gaip-assumptions-tooltip';
    tooltip.style.cssText = `
        position: fixed;
        z-index: 99999;
        max-width: 300px;
        background: var(--gaip-surface);
        color: var(--gaip-text);
        border: 1px solid var(--gaip-border);
        padding: 12px 14px;
        border-radius: 8px;
        box-shadow: 0 10px 25px rgba(0, 0, 0, 0.4);
        font-size: 12px;
        line-height: 1.5;
    `;
    
    tooltip.innerHTML = `
        <div style="margin-bottom: 8px; font-weight: 600; font-size: 13px; border-bottom: 1px solid var(--gaip-border); padding-bottom: 6px;">
            Tissue Assumptions (${nutrient})
        </div>
        <ul style="margin: 0; padding-left: 16px;">
            ${assumptions.map(a => `<li style="margin: 4px 0;">${a}</li>`).join('')}
        </ul>
        <div style="margin-top: 10px; font-size: 10px; color: var(--gaip-text); text-align: right;">
            Click anywhere to close
        </div>
    `;

    document.body.appendChild(tooltip);

    // Position tooltip
    const btnRect = btn.getBoundingClientRect();
    let top = btnRect.top;
    let left = btnRect.right + 10;
    
    if (left + 300 > window.innerWidth - 20) {
        left = btnRect.left - 310;
    }
    if (top + 200 > window.innerHeight - 20) {
        top = window.innerHeight - 220;
    }
    
    tooltip.style.top = `${top}px`;
    tooltip.style.left = `${left}px`;

    // Auto-hide after 8 seconds
    const autoHide = setTimeout(() => tooltip.remove(), 8000);
    
    // Hide on click anywhere
    setTimeout(() => {
        document.addEventListener('click', function hideTooltip(e) {
            clearTimeout(autoHide);
            tooltip.remove();
            document.removeEventListener('click', hideTooltip);
        }, { once: true });
    }, 100);
}
