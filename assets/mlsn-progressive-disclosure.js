/**
 * Soil Nutrient Progressive Disclosure Module v7.5.1
 * Integrates with Gilba Agronomic Intelligence Hub
 * 
 * v7.5.1 Changes:
 *   - Fixed: Shows "Enter soil data" instead of rendering empty/default results
 *   - Updated: SLAN description to "Traditional sufficiency-range approach — widely used across all turf types"
 *   - Updated: MLSN description to "Threshold-based approach — validated primarily on golf putting greens"
 * 
 * v7.5.0 Changes:
 *   - Added prominent methodology header badge (MLSN vs SLAN)
 *   - Methodology displayed at top of results with appropriate description
 *   - Card labels reflect methodology (MLSN threshold vs SLAN range)
 *   - Clear visual distinction between methodologies
 * 
 * Converts soil interpretation output (MLSN or SLAN) to compact 
 * progressive disclosure cards. Includes contextual warnings for
 * high-traffic scenarios where MLSN may be less validated.
 */

// =====================================================
// SOIL NUTRIENT PROGRESSIVE DISCLOSURE ENGINE
// =====================================================

/**
 * v7.5.0: Render methodology header badge
 * Shows MLSN, SLAN, or Ammonium Acetate with appropriate description and styling
 */
function renderMethodologyHeader(context) {
    const methodology = (context && context.methodology) || 'mlsn';
    const isSLAN = methodology === 'slan';
    const isAA = methodology === 'ammonium_acetate';
    
    let config;
    
    if (isAA) {
        // Ammonium Acetate (Hill Labs NZ)
        const soilType = context.soilType || 'others';
        config = {
            label: 'Ammonium Acetate',
            fullName: 'Hill Labs NZ Method',
            description: `Olsen P + NH₄OAc extraction — calibrated for NZ soils (${soilType === 'sands' ? 'sand-based rootzone' : 'native soil'})`,
            bgColor: 'var(--gaip-warning-bg)',
            borderColor: '#f59e0b',
            textColor: '#92400e',
            icon: '🧪'
        };
    } else if (isSLAN) {
        config = {
            label: 'SLAN',
            fullName: 'Sufficiency Level of Available Nutrients',
            description: 'Traditional sufficiency-range approach — widely used across all turf types',
            bgColor: 'var(--gaip-info-bg)',
            borderColor: '#3b82f6',
            textColor: '#1e40af',
            icon: '📊'
        };
    } else {
        config = {
            label: 'MLSN',
            fullName: 'Minimum Levels for Sustainable Nutrition',
            description: 'Threshold-based approach — validated primarily on golf putting greens',
            bgColor: 'var(--gaip-good-bg)',
            borderColor: '#10b981',
            textColor: '#065f46',
            icon: '🎯'
        };
    }
    
    // Get confidence badge if available
    let confidenceHTML = '';
    if (window.GilbaEngineConfidence && window.GAIP_STATE) {
        const confidence = window.GilbaEngineConfidence.assessConfidence('mlsn-calculator', window.GAIP_STATE);
        confidenceHTML = window.GilbaEngineConfidence.renderCompactConfidence(confidence.score);
    }
    
    return `
        <div class="gaip-methodology-header" style="
            display: flex;
            align-items: center;
            gap: 12px;
            padding: 10px 14px;
            margin-bottom: 12px;
            background: ${config.bgColor};
            border: 1px solid ${config.borderColor};
            border-radius: 8px;
        ">
            <div style="font-size: 20px;">${config.icon}</div>
            <div style="flex: 1;">
                <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
                    <span style="
                        font-weight: 700;
                        font-size: 14px;
                        color: ${config.textColor};
                        background: var(--gaip-surface);
                        padding: 2px 8px;
                        border-radius: 4px;
                        border: 1px solid ${config.borderColor};
                    ">${config.label}</span>
                    <span style="font-size: 12px; color: ${config.textColor}; opacity: 0.85;">
                        ${config.fullName}
                    </span>
                    ${confidenceHTML}
                </div>
                <div style="font-size: 11px; color: ${config.textColor}; margin-top: 4px; opacity: 0.8;">
                    ${config.description}
                </div>
            </div>
        </div>
    `;
}

function renderMLSNProgressiveDisclosure(mlsnResults) {
    if (!mlsnResults || !mlsnResults.nutrients) {
        return '<p class="gaip-no-data">No soil nutrient data available</p>';
    }

    const nutrients = mlsnResults.nutrients;
    const ratios = mlsnResults.ratios || [];
    const context = mlsnResults.context || {};
    const mulders = mlsnResults.mulders || { summaryBanner: '', nutrientBadges: {} };
    
    // v7.5.1: Check if any actual soil data was entered (not just defaults)
    const hasActualSoilData = nutrients.some(n => n.actual && n.actual > 0);
    
    if (!hasActualSoilData) {
        return `
            <div class="gaip-mlsn-progressive-container">
                ${renderMethodologyHeader(context)}
                <div class="gaip-no-data" style="
                    padding: 20px;
                    background: var(--gaip-surface-muted);
                    border: 1px dashed var(--gaip-border);
                    border-radius: 8px;
                    text-align: center;
                    color: var(--gaip-text);
                ">
                    <div style="font-size: 24px; margin-bottom: 8px;">📋</div>
                    <div style="font-weight: 500;">Enter soil test values above</div>
                    <div style="font-size: 12px; margin-top: 4px;">K, P, Ca, Mg, S, Fe, Mn values required for analysis</div>
                </div>
            </div>
        `;
    }

    let html = '<div class="gaip-mlsn-progressive-container">';
    
    // v7.5.0: Add methodology header badge at top
    html += renderMethodologyHeader(context);
    
    // Mulder's interaction summary banner (above cards grid)
    if (mulders.summaryBanner) html += mulders.summaryBanner;
    
    // Render diagnostic cards for each nutrient
    html += '<div class="gaip-mlsn-cards-grid">';
    nutrients.forEach(nutrient => {
        html += renderMLSNDiagnosticCard(nutrient, context, mulders.nutrientBadges);
    });
    html += '</div>';

    // Render ratio analysis section (collapsed by default)
    if (ratios.length > 0) {
        html += renderMLSNRatioSection(ratios);
    }

    // Render context information (growth potential, demand)
    if (context.growthPotential || context.turfType) {
        html += renderMLSNContextSection(context);
    }

    html += '</div>';
    return html;
}

/**
 * Check for tissue conflict with soil MLSN status
 * Returns conflict object if soil adequate but tissue deficient
 */
function checkTissueConflict(nutrient) {
    // Get tissue data from global state (set by hub-tissue-v3.js)
    const tissueResult = window.__GAIP_TISSUE_LAST__ || window.GAIP_TISSUE_RESULT;
    if (!tissueResult || !tissueResult.status) return null;
    
    const nutrientKey = nutrient.nutrient;
    const tissueStatus = tissueResult.status[nutrientKey];
    
    if (!tissueStatus) return null;
    
    // Check if soil is adequate/borderline but tissue is deficient
    const soilAdequate = nutrient.status === 'ADEQUATE' || nutrient.status === 'HIGH';
    const tissueDeficient = tissueStatus.band === 'Deficient' || tissueStatus.band === 'Marginal';
    
    if (soilAdequate && tissueDeficient) {
        return {
            type: 'UPTAKE_CONSTRAINT',
            tissueValue: tissueStatus.value,
            tissueBand: tissueStatus.band,
            message: `Tissue ${nutrientKey} ${tissueStatus.band.toLowerCase()} despite adequate soil`,
            action: 'Check pH, root health, water quality, or compaction'
        };
    }
    
    return null;
}

/**
 * Render tissue conflict warning badge
 */
function renderTissueConflictBadge(conflict) {
    if (!conflict) return '';
    
    return `
        <div class="gaip-tissue-conflict-badge" style="
            margin-top: 8px;
            padding: 6px 10px;
            background: linear-gradient(135deg, var(--gaip-warning-bg) 0%, var(--gaip-warning-border) 100%);
            border: 1px solid #f59e0b;
            border-radius: 6px;
            font-size: 11px;
            display: flex;
            align-items: center;
            gap: 6px;
        ">
            <span style="font-size: 14px;">⚠️</span>
            <div>
                <strong style="color: #92400e;">Tissue Conflict</strong>
                <span style="color: #78350f; display: block; margin-top: 2px;">${conflict.message}</span>
            </div>
        </div>
    `;
}

/**
 * Render expanded tissue conflict details for WHY section
 */
function renderTissueConflictDetails(conflict, nutrient) {
    if (!conflict) return '';
    
    const unitLabel = ['N', 'P', 'K', 'Ca', 'Mg', 'S'].includes(nutrient.nutrient) ? '%' : 'mg/kg';
    
    return `
        <div class="gaip-tissue-conflict-details" style="
            margin: 12px 0;
            padding: 12px;
            background: var(--gaip-warning-bg);
            border: 1px solid #fbbf24;
            border-left: 4px solid #f59e0b;
            border-radius: 6px;
        ">
            <div style="font-weight: 600; color: #92400e; margin-bottom: 8px; display: flex; align-items: center; gap: 6px;">
                <span style="font-size: 16px;">🔬</span>
                Soil-Tissue Mismatch Detected
            </div>
            
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 10px; font-size: 12px;">
                <div style="padding: 6px 8px; background: var(--gaip-good-bg); border-radius: 4px;">
                    <span style="color: #065f46; font-weight: 500;">Soil ${nutrient.nutrient}:</span>
                    <span style="color: #047857;"> ${nutrient.actual} ppm (${nutrient.status})</span>
                </div>
                <div style="padding: 6px 8px; background: var(--gaip-critical-bg); border-radius: 4px;">
                    <span style="color: #991b1b; font-weight: 500;">Tissue ${nutrient.nutrient}:</span>
                    <span style="color: #dc2626;"> ${conflict.tissueValue?.toFixed(2) || '?'} ${unitLabel} (${conflict.tissueBand})</span>
                </div>
            </div>
            
            <div style="font-size: 12px; color: #78350f;">
                <strong>Interpretation:</strong> Plant is not accessing available soil ${nutrient.nutrient}. 
                This indicates an uptake constraint rather than a true soil deficiency.
            </div>
            
            <div style="margin-top: 10px; padding: 8px; background: var(--gaip-surface); border-radius: 4px; font-size: 11px;">
                <strong style="color: #b45309;">Investigate:</strong>
                <ul style="margin: 4px 0 0 16px; padding: 0; color: #92400e;">
                    <li>Soil pH affecting ${nutrient.nutrient} availability</li>
                    <li>Root zone compaction or restricted rooting</li>
                    <li>Water quality issues (salinity, sodicity)</li>
                    <li>Antagonistic nutrient interactions</li>
                    ${nutrient.nutrient === 'Fe' || nutrient.nutrient === 'Mn' ? '<li>High soil pH locking out trace elements</li>' : ''}
                    ${nutrient.nutrient === 'K' || nutrient.nutrient === 'Mg' ? '<li>K:Mg imbalance affecting uptake</li>' : ''}
                </ul>
            </div>
        </div>
    `;
}

/**
 * Render individual nutrient diagnostic card
 * v7.5.0: Labels now reflect methodology (MLSN threshold vs SLAN range)
 */
function renderMLSNDiagnosticCard(nutrient, context, muldersBadges) {
    const cardId = `mlsn-${nutrient.nutrient.toLowerCase()}-${Date.now()}`;
    const confidence = calculateMLSNConfidence(nutrient, context);
    const methodology = (context && context.methodology) || 'mlsn';
    const isSLAN = methodology === 'slan';
    
    // v7.5.0: Methodology-specific labels
    const isAA = methodology === 'ammonium_acetate';
    const thresholdLabel = isAA ? 'AA:' : isSLAN ? 'Range:' : 'MLSN:';
    const thresholdTooltip = isAA
        ? 'Ammonium Acetate sufficiency threshold (Hill Labs NZ)'
        : isSLAN 
        ? 'SLAN sufficiency range for this nutrient' 
        : 'MLSN minimum threshold';
    
    // Check for tissue conflict (soil adequate but tissue deficient)
    const tissueConflict = checkTissueConflict(nutrient);
    const hasConflict = tissueConflict !== null;
    
    return `
        <div class="gaip-diagnostic-card mlsn-card ${hasConflict ? 'mlsn-tissue-conflict' : ''}" data-nutrient="${nutrient.nutrient}" data-methodology="${methodology}">
            <!-- STATE 1: VERDICT (Always Visible) -->
            <div class="gaip-verdict">
                <div class="gaip-verdict-header">
                    <h4 class="gaip-parameter">${nutrient.nutrient}</h4>
                    ${renderMLSNStatusBadge(nutrient.status, nutrient.statusClass, tissueConflict)}
                </div>
                
                <div class="gaip-verdict-content">
                    <div class="gaip-driver">
                        <span class="gaip-label">Current:</span>
                        <span class="gaip-value">${nutrient.actual} ppm</span>
                    </div>
                    
                    <div class="gaip-mlsn-threshold" title="${thresholdTooltip}">
                        <span class="gaip-label">${thresholdLabel}</span>
                        <span class="gaip-value">${nutrient.mlsn} ppm</span>
                    </div>
                    
                    ${renderMLSNConfidence(confidence)}
                    ${renderTissueConflictBadge(tissueConflict)}
                </div>

                <div class="gaip-verdict-actions">
                    <button class="gaip-expand-btn" data-target="why-${cardId}">
                        Why? <span class="gaip-icon">▼</span>
                    </button>
                    <button class="gaip-assumptions-btn" data-nutrient="${nutrient.nutrient}" title="Show assumptions">
                        <span class="gaip-icon-info">ⓘ</span>
                    </button>
                </div>
            </div>

            <!-- STATE 2: WHY (Collapsed by Default) -->
            <div class="gaip-why-section gaip-collapsed" id="why-${cardId}">
                <div class="gaip-why-content">
                    <div class="gaip-rule-fired">
                        <span class="gaip-label">Classification:</span>
                        <span class="gaip-value">${getMLSNClassificationRule(nutrient, context)}</span>
                    </div>

                    <div class="gaip-recommendation">
                        <span class="gaip-label">Action:</span>
                        <div class="gaip-recommendation-text">${nutrient.recommendation}</div>
                    </div>

                    ${hasConflict ? renderTissueConflictDetails(tissueConflict, nutrient) : ''}

                    ${(muldersBadges && muldersBadges[nutrient.nutrient]) || ''}

                    ${renderMLSNCalculationDetails(nutrient, context)}
                    
                    <button class="gaip-expand-btn" data-target="sensitivity-${cardId}">
                        Soil reserve? <span class="gaip-icon">▼</span>
                    </button>
                </div>
            </div>

            <!-- STATE 3: SENSITIVITY (Deeply Collapsed) -->
            <div class="gaip-sensitivity-section gaip-collapsed" id="sensitivity-${cardId}">
                <div class="gaip-sensitivity-content">
                    ${renderMLSNSupplyAnalysis(nutrient, context)}
                </div>
            </div>
        </div>
    `;
}

/**
 * Render status badge
 * Enhanced: If tissue conflict exists, override visual status to show warning
 */
function renderMLSNStatusBadge(status, statusClass, tissueConflict) {
    const statusConfig = {
        // MLSN statuses
        'DEFICIENT': { icon: '⚠', class: 'status-deficient' },
        'BORDERLINE': { icon: '⚠', class: 'status-borderline' },
        'ADEQUATE': { icon: '✓', class: 'status-adequate' },
        'HIGH': { icon: '⚠', class: 'status-high' },
        // SLAN statuses (v7.5.3)
        'LOW': { icon: '⚠', class: 'status-deficient' },
        'SUFFICIENT': { icon: '✓', class: 'status-adequate' },
        // Fallback
        'NO DATA': { icon: '?', class: 'status-no-data' },
        // Tissue conflict override
        'UPTAKE ISSUE': { icon: '🔬', class: 'status-tissue-conflict' }
    };

    // CRITICAL FIX: If soil shows adequate but tissue is deficient, 
    // override the status to highlight the conflict prominently
    let effectiveStatus = status;
    let effectiveConfig = statusConfig[status] || statusConfig['NO DATA'];
    
    if (tissueConflict && (status === 'ADEQUATE' || status === 'HIGH')) {
        effectiveStatus = 'UPTAKE ISSUE';
        effectiveConfig = statusConfig['UPTAKE ISSUE'];
    }

    return `
        <div class="gaip-status-badge ${effectiveConfig.class}">
            <span class="gaip-status-icon">${effectiveConfig.icon}</span>
            <span class="gaip-status-label">${effectiveStatus}</span>
        </div>
    `;
}

/**
 * Render confidence indicator
 */
function renderMLSNConfidence(confidence) {
    // Handle undefined/NaN confidence - default to 80%
    if (confidence === undefined || confidence === null || isNaN(confidence)) {
        confidence = 80;
    }
    const percentage = Math.round(confidence);
    const bars = Math.round(confidence / 20);
    const filledBars = '▮'.repeat(Math.min(bars, 5));
    const emptyBars = '▯'.repeat(Math.max(0, 5 - bars));
    
    let confidenceClass = 'confidence-high';
    if (percentage < 60) confidenceClass = 'confidence-low';
    else if (percentage < 80) confidenceClass = 'confidence-medium';

    return `
        <div class="gaip-confidence ${confidenceClass}">
            <span class="gaip-confidence-bars">${filledBars}${emptyBars}</span>
            <span class="gaip-confidence-percentage">${percentage}%</span>
        </div>
    `;
}

/**
 * Calculate confidence for MLSN diagnosis
 */
function calculateMLSNConfidence(nutrient, context) {
    let confidence = 100;
    
    // Reduce confidence if no MLSN threshold exists
    if (!nutrient.mlsn || nutrient.mlsn === 'N/A') {
        confidence -= 40;
    }
    
    // Reduce confidence if actual value is very low (possible test error)
    if (parseFloat(nutrient.actual) < 1) {
        confidence -= 15;
    }
    
    // Reduce confidence if no growth potential data
    if (!context.growthPotential) {
        confidence -= 10;
    }
    
    // Reduce confidence if pH affects availability (P especially)
    if (nutrient.nutrient === 'P' && context.phAdjusted) {
        confidence -= 15;
    }
    
    // Increase confidence if we have historical data
    if (context.hasHistorical) {
        confidence += 10;
    }
    
    return Math.max(0, Math.min(100, confidence));
}

/**
 * Get classification rule explanation
 * v7.5.0: Now handles SLAN ranges properly
 */
function getMLSNClassificationRule(nutrient, context) {
    const methodology = (context && context.methodology) || 'mlsn';
    const isSLAN = methodology === 'slan';
    
    // For SLAN, check if mlsn field contains a range (e.g., "12-28")
    if (isSLAN && nutrient.mlsn && nutrient.mlsn.includes('-')) {
        const parts = nutrient.mlsn.split('-');
        const lo = parseFloat(parts[0]);
        const hi = parseFloat(parts[1]);
        const actual = parseFloat(nutrient.actual);
        
        if (actual < lo) {
            return `Below SLAN sufficiency range (${((actual/lo) * 100).toFixed(0)}% of minimum)`;
        } else if (actual <= hi) {
            return `Within SLAN sufficiency range`;
        } else {
            return `Above SLAN sufficiency range by ${(actual - hi).toFixed(0)} ppm`;
        }
    }
    
    // MLSN ratio-based classification
    const actual = parseFloat(nutrient.actual);
    const mlsn = parseFloat(nutrient.mlsn);
    const ratio = actual / mlsn;
    const methodLabel = isSLAN ? 'threshold' : 'MLSN minimum';

    if (ratio < 0.8) {
        return `Below 80% of ${methodLabel} (${(ratio * 100).toFixed(0)}% of target)`;
    } else if (ratio < 1.0) {
        return `Between 80-100% of ${methodLabel} (${(ratio * 100).toFixed(0)}% of target)`;
    } else if (ratio <= 2.0) {
        return `Above ${methodLabel} by ${((ratio - 1) * 100).toFixed(0)}%`;
    } else {
        return `${ratio.toFixed(1)}× ${methodLabel} (excessive)`;
    }
}

/**
 * Render calculation details
 * v7.5.0: Methodology-aware labels and calculations
 */
function renderMLSNCalculationDetails(nutrient, context) {
    const actual = parseFloat(nutrient.actual);
    const methodology = (context && context.methodology) || 'mlsn';
    const isSLAN = methodology === 'slan';
    
    // For SLAN with ranges, show different info
    if (isSLAN && nutrient.mlsn && nutrient.mlsn.includes('-')) {
        const parts = nutrient.mlsn.split('-');
        const lo = parseFloat(parts[0]);
        const hi = parseFloat(parts[1]);
        const midpoint = (lo + hi) / 2;
        
        return `
            <div class="gaip-mlsn-calculations">
                <div class="gaip-calc-row">
                    <span class="gaip-calc-label">SLAN sufficiency range:</span>
                    <span class="gaip-calc-value">${lo}-${hi} ppm</span>
                </div>
                <div class="gaip-calc-row">
                    <span class="gaip-calc-label">Range midpoint:</span>
                    <span class="gaip-calc-value">${midpoint.toFixed(1)} ppm</span>
                </div>
                ${actual < lo ? `
                    <div class="gaip-calc-row">
                        <span class="gaip-calc-label">Below range by:</span>
                        <span class="gaip-calc-value">${(lo - actual).toFixed(1)} ppm</span>
                    </div>
                ` : actual > hi ? `
                    <div class="gaip-calc-row">
                        <span class="gaip-calc-label">Above range by:</span>
                        <span class="gaip-calc-value">${(actual - hi).toFixed(1)} ppm</span>
                    </div>
                ` : ''}
                ${context.depth && context.bulkDensity ? `
                    <div class="gaip-calc-row">
                        <span class="gaip-calc-label">Soil reserve:</span>
                        <span class="gaip-calc-value">${(actual * context.depth * context.bulkDensity * 0.1).toFixed(1)} kg/ha</span>
                    </div>
                ` : ''}
            </div>
        `;
    }
    
    // MLSN calculation
    const mlsn = parseFloat(nutrient.mlsn);
    const target = mlsn * 1.5;
    
    return `
        <div class="gaip-mlsn-calculations">
            <div class="gaip-calc-row">
                <span class="gaip-calc-label">Target level (1.5× MLSN):</span>
                <span class="gaip-calc-value">${target.toFixed(1)} ppm</span>
            </div>
            ${actual < target ? `
                <div class="gaip-calc-row">
                    <span class="gaip-calc-label">Deficit to target:</span>
                    <span class="gaip-calc-value">${(target - actual).toFixed(1)} ppm</span>
                </div>
            ` : ''}
            ${context.depth && context.bulkDensity ? `
                <div class="gaip-calc-row">
                    <span class="gaip-calc-label">Soil reserve:</span>
                    <span class="gaip-calc-value">${(actual * context.depth * context.bulkDensity * 0.1).toFixed(1)} kg/ha</span>
                </div>
            ` : ''}
        </div>
    `;
}

/**
 * Render soil reserve analysis
 */
function renderMLSNSupplyAnalysis(nutrient, context) {
    if (!context.annualDemand || !context.annualDemand[nutrient.nutrient]) {
        return '<p class="gaip-note">Soil reserve analysis requires growth potential data</p>';
    }

    const actual = parseFloat(nutrient.actual);
    const mlsn = parseFloat(nutrient.mlsn);
    const depth = context.depth || 10;
    const bd = context.bulkDensity || 1.4;
    
    const currentKgHa = actual * depth * bd * 0.1;
    const thresholdKgHa = mlsn * depth * bd * 0.1;
    const surplusKgHa = Math.max(0, currentKgHa - thresholdKgHa);
    const annualDemand = context.annualDemand[nutrient.nutrient];
    const yearsSupply = annualDemand > 0 ? surplusKgHa / annualDemand : null;
    
    return `
        <div class="gaip-supply-analysis">
            <div class="gaip-supply-row">
                <span class="gaip-supply-label">Current soil reserve:</span>
                <span class="gaip-supply-value">${currentKgHa.toFixed(1)} kg/ha</span>
            </div>
            <div class="gaip-supply-row">
                <span class="gaip-supply-label">Reserve above threshold:</span>
                <span class="gaip-supply-value">${surplusKgHa.toFixed(1)} kg/ha</span>
            </div>
            ${annualDemand > 0 ? `
                <div class="gaip-supply-row">
                    <span class="gaip-supply-label">Est. annual demand (N-linked):</span>
                    <span class="gaip-supply-value">${annualDemand.toFixed(1)} kg/ha</span>
                </div>
            ` : ''}
            ${yearsSupply !== null && yearsSupply > 0 ? `
                <div class="gaip-supply-row supply-highlight">
                    <span class="gaip-supply-label">Years of surplus supply:</span>
                    <span class="gaip-supply-value">${yearsSupply.toFixed(1)} years</span>
                </div>
            ` : ''}
            <p class="gaip-note" style="margin-top: 10px; font-size: 10px; color: var(--gaip-text);">
                Calculations assume ${depth}cm depth × ${bd} g/cm³ bulk density. 
                Demand linked to N program via tissue concentration ratios.
            </p>
        </div>
    `;
}

/**
 * Render ratio analysis section
 */
function renderMLSNRatioSection(ratios) {
    if (!ratios || ratios.length === 0) return '';
    
    const sectionId = `mlsn-ratios-${Date.now()}`;
    
    let ratioCards = '';
    ratios.forEach(ratio => {
        ratioCards += `
            <div class="gaip-ratio-card ${ratio.statusClass || ''}">
                <div class="gaip-ratio-name">${ratio.name}</div>
                <div class="gaip-ratio-value">${ratio.value.toFixed(2)}</div>
                <div class="gaip-ratio-status">${ratio.status || ''}</div>
                ${ratio.interpretation ? `
                    <div class="gaip-ratio-interpretation">${ratio.interpretation}</div>
                ` : ''}
            </div>
        `;
    });
    
    return `
        <div class="gaip-mlsn-ratios-section">
            <div class="gaip-section-header">
                <h4>Nutrient Ratios</h4>
                <button class="gaip-expand-btn" data-target="${sectionId}">
                    <span class="gaip-icon">▼</span>
                </button>
            </div>
            <div class="gaip-collapsible-content gaip-collapsed" id="${sectionId}">
                <div class="gaip-ratios-grid">
                    ${ratioCards}
                </div>
                <p class="gaip-note">Ratios help identify potential antagonisms. 
                   High K:Mg can limit Mg uptake; very high Ca:Mg may also restrict Mg availability.</p>
            </div>
        </div>
    `;
}

/**
 * Render context section
 */
function renderMLSNContextSection(context) {
    const sectionId = `mlsn-context-${Date.now()}`;
    const methodology = (context && context.methodology) || 'mlsn';
    const isSLAN = methodology === 'slan';
    
    return `
        <div class="gaip-mlsn-context-section">
            <div class="gaip-section-header">
                <h4>Analysis Context</h4>
                <button class="gaip-expand-btn" data-target="${sectionId}">
                    <span class="gaip-icon">▼</span>
                </button>
            </div>
            <div class="gaip-collapsible-content gaip-collapsed" id="${sectionId}">
                <div class="gaip-context-details">
                    <div class="gaip-context-row">
                        <span class="gaip-context-label">Methodology:</span>
                        <span class="gaip-context-value">${isSLAN ? 'SLAN (Sufficiency Levels)' : 'MLSN (Minimum Levels)'}</span>
                    </div>
                    ${context.turfType ? `
                        <div class="gaip-context-row">
                            <span class="gaip-context-label">Turf type:</span>
                            <span class="gaip-context-value">${context.turfType}</span>
                        </div>
                    ` : ''}
                    ${context.growthPotential ? `
                        <div class="gaip-context-row">
                            <span class="gaip-context-label">Current growth potential:</span>
                            <span class="gaip-context-value">${context.growthPotential}%</span>
                        </div>
                    ` : ''}
                    ${context.temperature ? `
                        <div class="gaip-context-row">
                            <span class="gaip-context-label">Average temperature:</span>
                            <span class="gaip-context-value">${context.temperature.toFixed(1)}°C</span>
                        </div>
                    ` : ''}
                    ${context.depth ? `
                        <div class="gaip-context-row">
                            <span class="gaip-context-label">Rootzone depth:</span>
                            <span class="gaip-context-value">${context.depth} cm</span>
                        </div>
                    ` : ''}
                    ${context.bulkDensity ? `
                        <div class="gaip-context-row">
                            <span class="gaip-context-label">Bulk density:</span>
                            <span class="gaip-context-value">${context.bulkDensity} g/cm³</span>
                        </div>
                    ` : ''}
                </div>
                ${context.phAdjusted ? `
                    <div class="gaip-context-note">
                        <strong>Note:</strong> P threshold adjusted for pH (${context.soilPH}) to account for reduced availability.
                    </div>
                ` : ''}
            </div>
        </div>
    `;
}

// =====================================================
// INTEGRATION WITH EXISTING HUB
// =====================================================

/**
 * Convert existing mlsnEngine output to progressive disclosure format
 */
function convertMLSNToProgressive(state, weather) {
    // Run existing mlsnEngine function
    const mlsnHTML = window.mlsnEngine(state, weather);
    
    // Parse the existing output to extract nutrient data
    const nutrients = parseMLSNTableHTML(mlsnHTML);
    const ratios = extractRatiosFromHTML(mlsnHTML);
    const context = extractMLSNContext(state, weather);
    
    // Run Mulder's interaction checker (methodology-aware)
    const mulders = window.GilbaMulders
        ? window.GilbaMulders.analyse(nutrients, context)
        : { flags: {}, summaryBanner: '', nutrientBadges: {} };
    
    // Generate progressive disclosure output
    return renderMLSNProgressiveDisclosure({
        nutrients: nutrients,
        ratios: ratios,
        context: context,
        mulders: mulders
    });
}

/**
 * Parse existing MLSN table HTML to extract data
 * (Used during transition period)
 */
function parseMLSNTableHTML(html) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    const rows = doc.querySelectorAll('.gaip-mlsn-table tbody tr');
    
    const nutrients = [];
    rows.forEach(row => {
        const cells = row.querySelectorAll('td');
        if (cells.length >= 7) {
            // 7-column table: Nutrient(0), Soil(1), MLSN(2), Uptake(3), Target(4), Status(5), Action(6)
            nutrients.push({
                nutrient: cells[0].textContent.trim(),
                actual: cells[1].textContent.trim(),
                mlsn: cells[2].textContent.trim(),
                uptakePpm: cells[3].textContent.trim(),
                targetPpm: cells[4].textContent.trim(),
                status: cells[5].textContent.trim(),
                statusClass: row.className.replace('status-', ''),
                recommendation: cells[6].textContent.trim()
            });
        } else if (cells.length >= 5) {
            // Legacy 5-column fallback
            nutrients.push({
                nutrient: cells[0].textContent.trim(),
                actual: cells[1].textContent.trim(),
                mlsn: cells[2].textContent.trim(),
                status: cells[3].textContent.trim(),
                statusClass: row.className.replace('status-', ''),
                recommendation: cells[4].textContent.trim()
            });
        }
    });
    
    return nutrients;
}

/**
 * Extract ratio analysis from HTML
 */
function extractRatiosFromHTML(html) {
    const ratios = [];
    
    // Extract Ca:Mg ratio - handle <strong> tags
    const caMgMatch = html.match(/Ca:Mg ratio<\/strong>\s*≈\s*([\d.]+)\s*–\s*([^<]+)/i);
    if (caMgMatch) {
        ratios.push({
            name: 'Ca:Mg',
            value: parseFloat(caMgMatch[1]),
            status: getMLSNRatioStatus(parseFloat(caMgMatch[1]), 'CaMg'),
            statusClass: getMLSNRatioStatusClass(parseFloat(caMgMatch[1]), 'CaMg'),
            interpretation: caMgMatch[2].trim()
        });
    }
    
    // Extract K:Mg ratio - handle <strong> tags
    const kMgMatch = html.match(/K:Mg ratio<\/strong>\s*≈\s*([\d.]+)\s*–\s*([^<]+)/i);
    if (kMgMatch) {
        ratios.push({
            name: 'K:Mg',
            value: parseFloat(kMgMatch[1]),
            status: getMLSNRatioStatus(parseFloat(kMgMatch[1]), 'KMg'),
            statusClass: getMLSNRatioStatusClass(parseFloat(kMgMatch[1]), 'KMg'),
            interpretation: kMgMatch[2].trim()
        });
    }
    
    // Extract K:Ca ratio - handle <strong> tags
    const kCaMatch = html.match(/K:Ca ratio<\/strong>\s*≈\s*([\d.]+)\s*–\s*([^<]+)/i);
    if (kCaMatch) {
        ratios.push({
            name: 'K:Ca',
            value: parseFloat(kCaMatch[1]),
            status: getMLSNRatioStatus(parseFloat(kCaMatch[1]), 'KCa'),
            statusClass: getMLSNRatioStatusClass(parseFloat(kCaMatch[1]), 'KCa'),
            interpretation: kCaMatch[2].trim()
        });
    }
    
    return ratios;
}

/**
 * Get ratio status
 */
function getMLSNRatioStatus(value, ratioType) {
    if (ratioType === 'CaMg') {
        if (value < 2) return 'Low';
        if (value <= 6) return 'Balanced';
        return 'High';
    } else if (ratioType === 'KMg') {
        if (value < 0.1) return 'Low';
        if (value <= 0.3) return 'Balanced';
        return 'High';
    } else if (ratioType === 'KCa') {
        if (value < 0.03) return 'Low';
        if (value <= 0.1) return 'Balanced';
        return 'High';
    }
    return 'Unknown';
}

/**
 * Get ratio status class
 */
function getMLSNRatioStatusClass(value, ratioType) {
    const status = getMLSNRatioStatus(value, ratioType);
    if (status === 'Balanced') return 'ratio-balanced';
    if (status === 'Low' || status === 'High') return 'ratio-caution';
    return 'ratio-unknown';
}

/**
 * Extract MLSN context from state
 */
function extractMLSNContext(state, weather) {
    const soil = state.soil || {};
    const turf = state.turf || {};
    
    // Determine turf type
    let turfType = "cool-season";
    if (turf.warmBase && turf.percentC3Cover < 50) {
        turfType = "warm-season";
    }
    
    // Get temperature
    let Tavg = null;
    if (weather && weather.length > 0) {
        const temps = weather.map(d => (d.tmin + d.tmax) / 2);
        Tavg = temps.reduce((a, b) => a + b, 0) / temps.length;
    }
    
    // Calculate growth potential
    let growthPotential = null;
    if (Tavg !== null) {
        const fractions = calculateC3C4Fractions(turf);
        const growthData = calcMixedGrowthPotential(Tavg, fractions.c3frac, fractions.c4frac);
        growthPotential = growthData.weighted;
    }
    
    // Get N program rate (kg/ha/yr)
    const nProgram = turf.nProgramKgHaYr || 0;
    
    // Check if pH adjusted
    const soilPH = soil.pH_water || soil.pH_cacl2;
    const phAdjusted = soilPH && (soilPH < 5.5 || soilPH > 7.5);
    
    // Get methodology (MLSN or SLAN)
    const methodology = soil.methodology || 'mlsn';
    
    return {
        turfType: turfType,
        growthPotential: growthPotential,
        temperature: Tavg,
        nProgram: nProgram,
        depth: soil.depthCm || 10,
        bulkDensity: soil.bulkDensity || 1.4,
        soilPH: soilPH,
        phAdjusted: phAdjusted,
        methodology: methodology,
        annualDemand: calculateAnnualDemand(turfType, growthPotential, nProgram),
        hasHistorical: false // Set to true if historical data available
    };
}

/**
 * Calculate C3/C4 fractions from turf state
 */
function calculateC3C4Fractions(turf) {
    if (!turf) return { c3frac: 1, c4frac: 0 };
    
    // Check if species is explicitly C4
    const species = (turf.grassSpecies || turf.species || '').toLowerCase();
    const isC4 = species.includes('couch') || species.includes('bermuda') || 
                 species.includes('kikuyu') || species.includes('buffalo') ||
                 species.includes('zoysia') || species.includes('paspalum');
    
    if (isC4) {
        // Check for overseed percentage
        const c3Cover = turf.percentC3Cover || turf.overseedPercent || 0;
        return {
            c3frac: c3Cover / 100,
            c4frac: 1 - (c3Cover / 100)
        };
    }
    
    return { c3frac: 1, c4frac: 0 };
}

/**
 * Calculate mixed growth potential
 */
function calcMixedGrowthPotential(temp, c3frac, c4frac) {
    // C3 optimal around 20°C, C4 optimal around 31°C
    const c3GP = 100 * Math.exp(-0.5 * Math.pow((temp - 20) / 5.5, 2));
    const c4GP = 100 * Math.exp(-0.5 * Math.pow((temp - 31) / 7, 2));
    
    const weighted = c3frac * c3GP + c4frac * c4GP;
    
    return {
        c3: Math.round(c3GP),
        c4: Math.round(c4GP),
        weighted: Math.round(weighted)
    };
}

/**
 * Calculate annual demand based on N program (the driver) and turf type
 */
function calculateAnnualDemand(turfType, growthPotential, nProgram) {
    const estimatedN = nProgram > 0 ? nProgram : (turfType === "warm-season" ? 180 : 150);
    
    const ratios = {
        "cool-season": { 
            K: 0.8, P: 0.10, Ca: 0.20, Mg: 0.10, S: 0.12,
            Fe: 0.025, Mn: 0.012, Zn: 0.004, Cu: 0.002, B: 0.0015
        },
        "warm-season": { 
            K: 1.0, P: 0.08, Ca: 0.25, Mg: 0.12, S: 0.10,
            Fe: 0.020, Mn: 0.010, Zn: 0.003, Cu: 0.002, B: 0.001
        }
    };
    
    const baseRatios = ratios[turfType] || ratios["cool-season"];
    const gpFactor = growthPotential ? Math.max(0.3, growthPotential / 100) : 0.7;
    const effectiveN = estimatedN * gpFactor;
    
    const demand = {};
    for (let nutrient in baseRatios) {
        demand[nutrient] = effectiveN * baseRatios[nutrient];
    }
    demand.N = effectiveN;
    
    return demand;
}

// =====================================================
// TURF PROFILE CONTEXT DETECTION
// =====================================================

var mlsnTurfContext = {
    mlsnContext: 'sports',
    subCategory: null,
    construction: null,
    traffic: 'moderate'
};

/**
 * Update turf context from profile controller
 */
function updateMLSNTurfContext(turfType, subCategory, construction) {
    mlsnTurfContext.mlsnContext = turfType || 'sports';
    mlsnTurfContext.subCategory = subCategory || null;
    mlsnTurfContext.construction = construction || null;
    
}

// Listen for turf profile changes
document.addEventListener('gaip:turf-profile-change', function(e) {
    if (e.detail) {
        updateMLSNTurfContext(
            e.detail.mlsnContext || e.detail.turfType,
            e.detail.subCategory,
            e.detail.construction
        );
    }
});

// =====================================================
// INITIALIZATION AND EVENT HANDLERS
// =====================================================

document.addEventListener('DOMContentLoaded', function() {
    
    // Handle all button clicks via event delegation on document
    document.addEventListener('click', function(e) {
        const target = e.target;
        
        // Handle info/assumptions button clicks
        const assumptionsBtn = target.closest('.gaip-assumptions-btn');
        if (assumptionsBtn) {
            e.preventDefault();
            e.stopPropagation();
            const nutrient = assumptionsBtn.dataset.nutrient;
            showMLSNAssumptions(assumptionsBtn, nutrient);
            return;
        }
        
        // Handle expand button clicks (Why?, Soil reserve?, etc.)
        const expandBtn = target.closest('.gaip-expand-btn');
        if (expandBtn) {
            e.preventDefault();
            e.stopPropagation();
            const targetId = expandBtn.dataset.target;
            if (targetId) {
                toggleMLSNSection(targetId, expandBtn);
            }
            return;
        }
    }, true); // Use capture phase to ensure we get the event first
});

/**
 * Toggle expansion of sections
 */
function toggleMLSNSection(targetId, btn) {
    const section = document.getElementById(targetId);
    if (!section) {
        console.warn('MLSN section not found:', targetId);
        const container = btn.closest('.gaip-mlsn-ratios-section, .gaip-mlsn-context-section, .gaip-diagnostic-card, .gaip-water-management-section, .gaip-section-header');
        if (container) {
            // Try to find collapsible content in container or next sibling
            let collapsible = container.querySelector('.gaip-collapsible-content, .gaip-why-section, .gaip-sensitivity-section');
            if (!collapsible && container.classList.contains('gaip-section-header')) {
                // For section headers, the collapsible is a sibling
                collapsible = container.nextElementSibling;
                if (collapsible && !collapsible.classList.contains('gaip-collapsible-content')) {
                    collapsible = null;
                }
            }
            if (collapsible) {
                toggleCollapsibleElement(collapsible, btn);
                return;
            }
        }
        return;
    }
    toggleCollapsibleElement(section, btn);
}

/**
 * Toggle collapsible element
 */
function toggleCollapsibleElement(section, btn) {
    const hasExpandedClass = section.classList.contains('gaip-expanded');
    const hasCollapsedClass = section.classList.contains('gaip-collapsed');
    const currentMaxHeight = section.style.maxHeight;
    
    const isExpanded = hasExpandedClass || 
                       (currentMaxHeight && currentMaxHeight !== '0px' && currentMaxHeight !== '0');
    
    if (isExpanded) {
        section.classList.add('gaip-collapsed');
        section.classList.remove('gaip-expanded');
        section.style.maxHeight = '0';
        section.style.opacity = '0';
        section.style.overflow = 'hidden';
        if (btn) {
            const icon = btn.querySelector('.gaip-icon');
            if (icon) icon.textContent = '▼';
        }
    } else {
        section.classList.remove('gaip-collapsed');
        section.classList.add('gaip-expanded');
        section.style.maxHeight = section.scrollHeight + 'px';
        section.style.opacity = '1';
        section.style.overflow = 'visible';
        if (btn) {
            const icon = btn.querySelector('.gaip-icon');
            if (icon) icon.textContent = '▲';
        }
    }
}

/**
 * Show assumptions tooltip (matching tissue/water style)
 */
function showMLSNAssumptions(btn, nutrient) {
    const methodology = document.querySelector('.gaip-soil-methodology')?.value || 'mlsn';
    const isSLAN = methodology === 'slan';
    const construction = document.querySelector('.gaip-construction')?.value || '';
    const soilType = (construction === 'sand_profile') ? 'sands' : 'native/push-up';
    const depth = document.querySelector('.gaip-depth')?.value || 
                  document.querySelector('.gaip-sampling-depth')?.value || '10';
    
    let assumptions = [];
    
    if (isSLAN) {
        assumptions = [
            'SLAN sufficiency ranges from published standards',
            `Soil type: ${soilType}`,
            `Sampling depth: ${depth} cm`,
            'Maintain within sufficiency range',
            'Suited for sports turf and general applications'
        ];
    } else {
        assumptions = [
            'MLSN thresholds from Pace Turf research (Woods & Stowell)',
            `Sampling depth: ${depth} cm`,
            'Apply fertiliser only when below minimum',
            'Validated primarily on golf putting greens',
            'May need adjustment for high-traffic sports turf'
        ];
    }
    
    // Add nutrient-specific notes
    const nutrientNotes = {
        'P': 'P availability pH-dependent; Mehlich-3 extraction used',
        'K': 'K leaches readily from sand profiles; frequent monitoring recommended',
        'Ca': 'Ca rarely limiting; high levels can reduce K/Mg availability',
        'Mg': 'Mg deficiency often from K:Mg imbalance, not low soil Mg',
        'S': 'S leaches readily; organic matter is primary reserve',
        'Fe': 'Fe availability decreases above pH 7; chelated forms more available',
        'Mn': 'Mn availability increases on acidic soils; toxicity possible',
        'Zn': 'Zn-P antagonism: high P can reduce Zn uptake',
        'Cu': 'Cu binds to organic matter; deficiency rare'
    };
    
    if (nutrientNotes[nutrient]) {
        assumptions.push(nutrientNotes[nutrient]);
    }
    
    // Remove existing tooltips
    document.querySelectorAll('.gaip-assumptions-tooltip').forEach(t => t.remove());
    
    // Create tooltip with soil-themed brown style
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
            ${isSLAN ? 'SLAN' : 'MLSN'} Assumptions (${nutrient})
        </div>
        <ul style="margin: 0; padding-left: 16px;">
            ${assumptions.map(a => `<li style="margin: 4px 0;">${a}</li>`).join('')}
        </ul>
        <div style="margin-top: 10px; font-size: 10px; color: var(--gaip-text-muted); text-align: right;">
            Click anywhere to close
        </div>
    `;
    
    document.body.appendChild(tooltip);
    
    // Position tooltip (same logic as tissue)
    const btnRect = btn.getBoundingClientRect();
    let top = btnRect.top;
    let left = btnRect.right + 10;
    
    // Flip to left side if too close to right edge
    if (left + 300 > window.innerWidth - 20) {
        left = btnRect.left - 310;
    }
    // Adjust if too close to bottom
    if (top + 200 > window.innerHeight - 20) {
        top = window.innerHeight - 220;
    }
    
    tooltip.style.top = `${top}px`;
    tooltip.style.left = `${left}px`;
    
    // Auto-hide after 8 seconds
    const autoHide = setTimeout(() => tooltip.remove(), 8000);
    
    // Close on click anywhere
    setTimeout(() => {
        document.addEventListener('click', function closeTooltip() {
            clearTimeout(autoHide);
            tooltip.remove();
            document.removeEventListener('click', closeTooltip);
        }, { once: true });
    }, 100);
}

// =====================================================
// TISSUE CONFLICT DYNAMIC UPDATE
// =====================================================

function handleTissueDataUpdate(event) {
    const tissueResult = event?.detail || window.__GAIP_TISSUE_LAST__ || window.GAIP_TISSUE_RESULT;
    if (!tissueResult || !tissueResult.status) return;
    
    const mlsnCards = document.querySelectorAll('.gaip-diagnostic-card.mlsn-card');
    
    mlsnCards.forEach(function(card) {
        const nutrient = card.dataset.nutrient;
        if (!nutrient) return;
        
        const tissueStatus = tissueResult.status[nutrient];
        if (!tissueStatus) return;
        
        const statusBadge = card.querySelector('.gaip-status-badge');
        if (!statusBadge) return;
        
        const currentStatus = statusBadge.querySelector('.gaip-status-label')?.textContent?.trim();
        const soilAdequate = currentStatus === 'ADEQUATE' || currentStatus === 'HIGH';
        const tissueDeficient = tissueStatus.band === 'Deficient' || tissueStatus.band === 'Marginal';
        
        if (soilAdequate && tissueDeficient) {
            card.classList.add('mlsn-tissue-conflict');
            
            if (!statusBadge.classList.contains('status-tissue-conflict')) {
                statusBadge.classList.add('status-tissue-conflict');
                statusBadge.innerHTML = `
                    <span class="gaip-status-icon">🔬</span>
                    <span class="gaip-status-label">UPTAKE ISSUE</span>
                `;
            }
            
            const tissueConflict = {
                type: 'UPTAKE_CONSTRAINT',
                tissueValue: tissueStatus.value,
                tissueBand: tissueStatus.band,
                message: `Tissue ${nutrient} ${tissueStatus.band.toLowerCase()} despite adequate soil`
            };
            
            const verdictContent = card.querySelector('.gaip-verdict-content');
            if (verdictContent && !verdictContent.querySelector('.gaip-tissue-conflict-badge')) {
                verdictContent.insertAdjacentHTML('beforeend', renderTissueConflictBadge(tissueConflict));
            }
            
        } else {
            if (card.classList.contains('mlsn-tissue-conflict') && 
                statusBadge.classList.contains('status-tissue-conflict')) {
                card.classList.remove('mlsn-tissue-conflict');
            }
        }
    });
}

document.addEventListener('gaip:tissue-data-update', handleTissueDataUpdate);

let lastTissueState = null;
setInterval(function() {
    const currentState = window.__GAIP_TISSUE_LAST__ || window.GAIP_TISSUE_RESULT;
    if (currentState && currentState !== lastTissueState) {
        lastTissueState = currentState;
        handleTissueDataUpdate({ detail: currentState });
    }
}, 2000);

// =====================================================
// HIGH-TRAFFIC / RECOVERY WARNING SYSTEM
// =====================================================

function checkHighTrafficContext() {
    var context = {
        isHighTraffic: false,
        isRecoveryMode: false,
        reasons: []
    };
    
    var matchesInput = document.querySelector('.gaip-matches-week');
    var matchesPerWeek = matchesInput ? parseFloat(matchesInput.value) || 0 : 0;
    if (matchesPerWeek > 2) {
        context.isHighTraffic = true;
        context.reasons.push(matchesPerWeek + ' matches/week');
    }
    
    var sessionsInput = document.querySelector('.gaip-sessions-week');
    var sessionsPerWeek = sessionsInput ? parseFloat(sessionsInput.value) || 0 : 0;
    if (sessionsPerWeek > 4) {
        context.isHighTraffic = true;
        context.reasons.push(sessionsPerWeek + ' training sessions/week');
    }
    
    if (mlsnTurfContext.mlsnContext === 'sports') {
        context.isSportsTurf = true;
    }
    
    if (window.GilbaHubOrchestrator) {
        var state = window.GilbaHubOrchestrator.getState();
        if (state && state.computed && state.computed.stress) {
            var stressMod = state.computed.stress.combinedGrowthModifier;
            if (stressMod < 0.7) {
                context.isRecoveryMode = true;
                context.reasons.push('stress recovery active');
            }
        }
    }
    
    return context;
}

function renderHighTrafficWarning(context) {
    if (!context.isHighTraffic && !context.isRecoveryMode) {
        return '';
    }
    
    var reasonText = context.reasons.length > 0 ? 
        ' (' + context.reasons.join(', ') + ')' : '';
    
    return `
        <div class="gaip-methodology-warning" style="
            margin-bottom: 12px;
            padding: 10px 12px;
            background: linear-gradient(135deg, var(--gaip-warning-bg) 0%, var(--gaip-warning-border) 100%);
            border: 1px solid #f59e0b;
            border-left: 4px solid #d97706;
            border-radius: 6px;
            font-size: 12px;
            line-height: 1.5;
        ">
            <div style="display: flex; align-items: flex-start; gap: 8px;">
                <span style="font-size: 16px; flex-shrink: 0;">⚠️</span>
                <div>
                    <strong style="color: #92400e;">High-use scenario detected${reasonText}</strong>
                    <p style="margin: 6px 0 0 0; color: #78350f;">
                        MLSN thresholds were validated primarily on golf putting greens with moderate N rates. 
                        On heavily trafficked sports turf with recovery fertilisation, increased growth rates 
                        may deplete secondary nutrients (K, Mg, Ca) faster than MLSN models predict.
                    </p>
                    <p style="margin: 6px 0 0 0; color: #78350f;">
                        <strong>Consider:</strong> Using SLAN ranges, or monitoring tissue tests closely 
                        for K and Mg status during intensive recovery programmes.
                    </p>
                </div>
            </div>
        </div>
    `;
}

function updateMethodologyWarning() {
    var warningContainer = document.querySelector('.gaip-soil-method-warning');
    if (!warningContainer) return;
    
    var methodologySelect = document.querySelector('.gaip-soil-methodology');
    var methodology = methodologySelect ? methodologySelect.value : 'slan';
    
    if (methodology === 'mlsn') {
        var context = checkHighTrafficContext();
        if (context.isHighTraffic || context.isRecoveryMode || context.isSportsTurf) {
            warningContainer.innerHTML = renderHighTrafficWarning(context);
            warningContainer.style.display = 'block';
        } else {
            warningContainer.style.display = 'none';
            warningContainer.innerHTML = '';
        }
    } else {
        warningContainer.style.display = 'none';
        warningContainer.innerHTML = '';
    }
}

document.addEventListener('DOMContentLoaded', function() {
    var methodologySelect = document.querySelector('.gaip-soil-methodology');
    if (methodologySelect) {
        methodologySelect.addEventListener('change', updateMethodologyWarning);
    }
    
    var trafficInputs = ['.gaip-matches-week', '.gaip-sessions-week'];
    trafficInputs.forEach(function(selector) {
        var input = document.querySelector(selector);
        if (input) {
            input.addEventListener('change', updateMethodologyWarning);
            input.addEventListener('input', updateMethodologyWarning);
        }
    });
    
    setTimeout(updateMethodologyWarning, 500);
});

document.addEventListener('gaip:turf-profile-change', function() {
    setTimeout(updateMethodologyWarning, 100);
});

window.gaip_updateMethodologyWarning = updateMethodologyWarning;

