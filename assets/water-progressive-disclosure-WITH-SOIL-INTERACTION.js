/**
 * Water Quality Progressive Disclosure - DIRECT STATE VERSION
 * Reads from state object instead of parsing HTML output
 */

// Store state for direct access
window.__GAIP_WATER_STATE__ = null;

// Override water engine to capture state
if (typeof window.waterEngine_original === 'undefined') {
    window.waterEngine_original = window.waterEngine;
    window.waterEngine = function(state) {
        window.__GAIP_WATER_STATE__ = state;
        return window.waterEngine_original(state);
    };
}

function renderWaterProgressiveDisclosure(waterResults, state) {
    
    if (!state || !state.water) {
        return `
            <div class="gaip-water-no-data">
                <p class="gaip-note">
                    <strong>No water quality data entered.</strong><br>
                    Enter water ion concentrations (Ca, Mg, Na, Cl, HCO3, etc.) in the "Soil & Water" section above.
                </p>
            </div>
        `;
    }
    
    const ions = state.water.ions || {};
    const ecw = state.water.ecw || 0;
    const pH = state.water.pH || 7;
    
    
    // Check if we have real data
    const hasData = Object.keys(ions).some(key => ions[key] > 0) || ecw > 0;
    
    if (!hasData) {
        return `
            <div class="gaip-water-no-data">
                <p class="gaip-note">
                    <strong>No water ion values detected.</strong><br>
                    Enter Ca, Mg, Na, and other ions in the water quality section.
                </p>
            </div>
        `;
    }
    
    // Calculate values directly
    const diagnostics = calculateWaterDiagnostics(ions, ecw, pH);
    
    // Add soil-water interaction analysis
    const soilWaterInteraction = analyzeSoilWaterInteraction(state);
    if (soilWaterInteraction) {
        diagnostics.unshift(soilWaterInteraction); // Add at beginning for prominence
    }
    
    
    if (diagnostics.length === 0) {
        return `<p class="gaip-note">Water data present but insufficient for analysis</p>`;
    }
    
    // Render cards
    let html = '<div class="gaip-water-progressive-container">';
    html += '<div class="gaip-water-cards-grid">';
    
    diagnostics.forEach(diagnostic => {
        html += renderWaterCard(diagnostic);
    });
    
    // NOTE: Salinity growth penalty card is added by salinity-penalty.js wrapper
    // Do not add it here to avoid duplication
    
    // Add phytotoxicity analysis card if module is loaded
    if (typeof window.gaip_analyzePhytotoxicity === 'function' && state?.turf?.grassSpecies) {
        const waterData = {
            Na: ions.Na || 0,
            Cl: ions.Cl || 0,
            B: ions.B || 0,
            HCO3: ions.HCO3 || 0
        };
        
        // Only analyze if we have relevant ions
        if (waterData.Na > 0 || waterData.Cl > 0 || waterData.B > 0 || waterData.HCO3 > 0) {
            const irrigMethod = state?.irrigation?.method || 'sprinkler';
            const variety = state?.turf?.variety || null;
            
            const phytotoxResult = window.gaip_analyzePhytotoxicity(
                waterData, 
                state.turf.grassSpecies,
                variety,
                irrigMethod
            );
            
            if (phytotoxResult && phytotoxResult.assessments.length > 0) {
                html += window.gaip_renderPhytotoxicityCard(phytotoxResult);
            }
        }
    }
    
    html += '</div><!-- end cards grid -->';

    // ── RECYCLED WATER NUTRIENT ADVISORY ────────────────────────────────────
    if (state?.water?.recycledWater && typeof window.RecycledWaterNutrientEngine !== 'undefined') {
        const rwResult = window.RecycledWaterNutrientEngine.analyse(
            { ecw: ecw, ions: ions },
            state?.turf?.grassSpecies || 'unknown'
        );
        html += renderRecycledWaterAdvisory(rwResult);

        // Inject Mulders overlays into global context for mulders-interaction-checker
        if (rwResult.muldersOverlays && rwResult.muldersOverlays.length > 0) {
            window.__GAIP_RECYCLED_WATER_OVERLAYS__ = rwResult.muldersOverlays;
        } else {
            window.__GAIP_RECYCLED_WATER_OVERLAYS__ = [];
        }
    } else {
        window.__GAIP_RECYCLED_WATER_OVERLAYS__ = [];
    }

    // Priority actions
    const highRisk = diagnostics.filter(d => d.statusClass === 'status-deficient');
    const caution = diagnostics.filter(d => d.statusClass === 'status-borderline');
    
    if (highRisk.length > 0 || caution.length > 0) {
        html += renderPriorityActions(highRisk, caution);
    }
    
    html += '</div>';
    return html;
}

// ── RECYCLED WATER ADVISORY RENDERER ────────────────────────────────────────
function renderRecycledWaterAdvisory(rwResult) {
    let html = '<div class="gaip-recycled-advisory-panel">';
    html += '<div class="gaip-recycled-advisory-header">♻️ Recycled Water — Nutrient Interaction Advisory</div>';
    html += '<div class="gaip-recycled-advisory-body">';

    if (!rwResult.active) {
        html += '<p class="gaip-recycled-no-flags">No significant nutrient interaction flags for current water data. Continue standard monitoring.</p>';
        html += '</div></div>';
        return html;
    }

    function renderItems(items, sectionTitle) {
        if (!items || items.length === 0) return '';
        let s = `<div class="gaip-recycled-advisory-section-title">${sectionTitle}</div>`;
        items.forEach((item, idx) => {
            const id = 'rw-adv-' + sectionTitle.replace(/\s+/g, '-').toLowerCase() + '-' + idx;
            s += `<div class="gaip-recycled-advisory-item severity-${item.severity}" id="${id}">`;
            s += `<div class="gaip-recycled-advisory-driver">${item.driver || (item.ratio ? item.ratio + ' = ' + item.value : '')}</div>`;
            s += `<div class="gaip-recycled-advisory-message">${item.message}</div>`;
            if (item.detail) {
                s += `<button class="gaip-recycled-advisory-expand" onclick="
                    var el = document.getElementById('${id}');
                    el.classList.toggle('expanded');
                    this.textContent = el.classList.contains('expanded') ? 'Show less' : 'Why?';
                ">Why?</button>`;
                s += `<div class="gaip-recycled-advisory-detail">${item.detail}</div>`;
            }
            if (item.citation) {
                s += `<div class="gaip-recycled-advisory-citation">📚 ${item.citation}</div>`;
            }
            s += '</div>';
        });
        return s;
    }

    html += renderItems(rwResult.nForm, 'N Form Advisory');
    html += renderItems(rwResult.micronutrient, 'Micronutrient Availability');
    html += renderItems(rwResult.cationRatio, 'Cation Ratio Disturbance');

    html += '</div></div>';
    return html;
}

function calculateWaterDiagnostics(ions, ecw, pH) {
    const diagnostics = [];
    
    // Convert mg/L to meq/L
    function meq(mg, eqw) {
        return (mg || 0) / eqw;
    }
    
    const Ca = meq(ions.Ca, 20.04);
    const Mg = meq(ions.Mg, 12.15);
    const Na = meq(ions.Na, 23.0);
    const K = meq(ions.K, 39.1);
    const Cl = meq(ions.Cl, 35.45);
    const HCO3 = meq(ions.HCO3, 61.0);
    const CO3 = meq(ions.CO3, 30.0);
    
    
    // SAR and SARadj (Adjusted SAR) using Suarez (1981) pHc method
    // Accounts for calcite precipitation/dissolution based on ionic equilibrium
    if (Ca + Mg > 0 && Na > 0) {
        const basicSAR = Na / Math.sqrt((Ca + Mg) / 2);
        
        // Calculate SARadj using Suarez (1981) method
        // SARadj = Na / sqrt((Cax + Mg) / 2) where Cax is equilibrium Ca
        let SARadj = basicSAR;
        let hasAdjustment = false;
        let adjustmentNote = '';
        
        if (HCO3 + CO3 > 0 && Ca > 0) {
            // Suarez (1981) pHc calculation for calcite equilibrium
            // pHc = (pK2 - pKc) + p(Ca + Mg) + p(Alk)
            // Using simplified Langelier approach with tables
            
            // Calculate ionic strength (approximate from EC)
            const ionicStrength = ecw * 0.013;  // Approximate I from EC
            
            // Activity coefficients (Davies equation approximation)
            const sqrtI = Math.sqrt(ionicStrength);
            const gamma2 = Math.pow(10, -4 * ((sqrtI / (1 + sqrtI)) - 0.3 * ionicStrength));  // Divalent
            
            // p(Ca + Mg) - negative log of Ca + Mg in meq/L
            const pCaMg = -Math.log10((Ca + Mg) * gamma2);
            
            // p(Alk) - negative log of alkalinity (HCO3 + 2*CO3) in meq/L
            const Alk = HCO3 + 2 * CO3;
            const pAlk = -Math.log10(Alk * Math.sqrt(gamma2));
            
            // pK2 - pKc varies with temperature and ionic strength
            // At 25°C and low I: approximately 2.5
            const pK2pKc = 2.3 + 0.1 * Math.sqrt(ionicStrength);
            
            // Calculate pHc
            const pHc = pK2pKc + pCaMg + pAlk;
            
            // Calculate Cax (equilibrium calcium) using Suarez equation
            // If water pH > pHc, calcite precipitates, reducing Ca
            // If water pH < pHc, calcite dissolves, increasing Ca
            const waterPHeff = pH || 7.5;  // Use actual water pH if available
            
            if (waterPHeff > pHc + 0.3) {
                // Significant calcite precipitation expected
                // Cax = Ca * 10^(pHc - pH)
                const Cax = Ca * Math.pow(10, pHc - waterPHeff);
                const CaxMg = Math.max(0.1, Cax + Mg);  // Minimum to prevent division by zero
                SARadj = Na / Math.sqrt(CaxMg / 2);
                hasAdjustment = true;
                adjustmentNote = `pHc ${pHc.toFixed(2)} < water pH ${waterPHeff.toFixed(1)} → calcite precipitates, Ca reduced`;
            } else if (waterPHeff < pHc - 0.3) {
                // Calcite dissolution may occur
                hasAdjustment = false;
                adjustmentNote = `pHc ${pHc.toFixed(2)} > water pH ${waterPHeff.toFixed(1)} → no calcite precipitation`;
            } else {
                // Near equilibrium
                hasAdjustment = false;
                adjustmentNote = `Near calcite equilibrium (pHc ≈ ${pHc.toFixed(2)})`;
            }
        }
        
        
        // Basic SAR card
        const sarStatus = getSARStatus(basicSAR);
        diagnostics.push({
            parameter: 'SAR',
            label: 'Sodium Hazard (SAR)',
            value: basicSAR.toFixed(2),
            unit: '',
            status: sarStatus.label,
            statusClass: sarStatus.class,
            driver: sarStatus.driver,
            recommendation: 'Basic SAR - does not account for bicarbonate effects'
        });
        
        // SARadj card
        const saradjStatus = getSARStatus(SARadj);
        const adjustPct = hasAdjustment ? ((SARadj / basicSAR - 1) * 100).toFixed(0) : 0;
        diagnostics.push({
            parameter: 'SARadj',
            label: 'Adjusted SAR (SARadj)',
            value: SARadj.toFixed(2),
            unit: '',
            status: saradjStatus.label,
            statusClass: saradjStatus.class,
            driver: hasAdjustment ? 
                `${adjustPct > 0 ? '+' : ''}${adjustPct}% vs basic SAR: ${adjustmentNote}` :
                adjustmentNote || 'No significant adjustment - bicarbonate in equilibrium',
            recommendation: saradjStatus.recommendation + ' (Suarez 1981 method)'
        });
    }
    
    // EC (Salinity)
    if (ecw > 0) {
        const status = getECStatus(ecw);
        diagnostics.push({
            parameter: 'EC',
            label: 'Salinity (ECw)',
            value: ecw.toFixed(2),
            unit: 'dS/m',
            status: status.label,
            statusClass: status.class,
            driver: status.driver,
            recommendation: status.recommendation
        });
    }
    
    // RSC
    if (HCO3 + CO3 > 0 && Ca + Mg > 0) {
        const RSC = (HCO3 + CO3) - (Ca + Mg);
        const status = getRSCStatus(RSC);
        diagnostics.push({
            parameter: 'RSC',
            label: 'Residual Sodium Carbonate',
            value: RSC.toFixed(2),
            unit: 'meq/L',
            status: status.label,
            statusClass: status.class,
            driver: status.driver,
            recommendation: status.recommendation
        });
    }
    
    // Chloride toxicity (use mg/L directly)
    if (ions.Cl > 0) {
        const status = getChlorideStatus(ions.Cl);
        diagnostics.push({
            parameter: 'Cl',
            label: 'Chloride Toxicity',
            value: ions.Cl.toFixed(1),
            unit: 'mg/L',
            status: status.label,
            statusClass: status.class,
            driver: status.driver,
            recommendation: status.recommendation
        });
    }
    
    // Sodium toxicity (use mg/L directly)
    if (ions.Na > 0) {
        const status = getSodiumToxStatus(ions.Na);
        diagnostics.push({
            parameter: 'Na',
            label: 'Sodium Toxicity',
            value: ions.Na.toFixed(1),
            unit: 'mg/L',
            status: status.label,
            statusClass: status.class,
            driver: status.driver,
            recommendation: status.recommendation
        });
    }
    
    // Boron toxicity
    if (ions.B > 0) {
        const status = getBoronStatus(ions.B);
        diagnostics.push({
            parameter: 'B',
            label: 'Boron Toxicity',
            value: ions.B.toFixed(2),
            unit: 'mg/L',
            status: status.label,
            statusClass: status.class,
            driver: status.driver,
            recommendation: status.recommendation
        });
    }
    
    // Iron
    if (ions.Fe > 0) {
        const status = getIronStatus(ions.Fe);
        diagnostics.push({
            parameter: 'Fe',
            label: 'Iron (Staining Risk)',
            value: ions.Fe.toFixed(2),
            unit: 'mg/L',
            status: status.label,
            statusClass: status.class,
            driver: status.driver,
            recommendation: status.recommendation
        });
    }

    // pH
    if (pH > 0) {
        const status = getPHStatus(pH);
        diagnostics.push({
            parameter: 'pH',
            label: 'pH',
            value: pH.toFixed(1),
            unit: '',
            status: status.label,
            statusClass: status.class,
            driver: status.driver,
            recommendation: status.recommendation
        });
    }

    // Calcium
    if (ions.Ca > 0) {
        const status = getCalciumStatus(ions.Ca);
        diagnostics.push({
            parameter: 'Ca',
            label: 'Calcium (Ca)',
            value: ions.Ca.toFixed(1),
            unit: 'mg/L',
            status: status.label,
            statusClass: status.class,
            driver: status.driver,
            recommendation: status.recommendation
        });
    }

    // Magnesium
    if (ions.Mg > 0) {
        const status = getMagnesiumStatus(ions.Mg);
        diagnostics.push({
            parameter: 'Mg',
            label: 'Magnesium (Mg)',
            value: ions.Mg.toFixed(1),
            unit: 'mg/L',
            status: status.label,
            statusClass: status.class,
            driver: status.driver,
            recommendation: status.recommendation
        });
    }

    // Potassium
    if (ions.K > 0) {
        const status = getPotassiumStatus(ions.K);
        diagnostics.push({
            parameter: 'K',
            label: 'Potassium (K)',
            value: ions.K.toFixed(1),
            unit: 'mg/L',
            status: status.label,
            statusClass: status.class,
            driver: status.driver,
            recommendation: status.recommendation
        });
    }

    // Sulphate
    if (ions.SO4 > 0) {
        const status = getSulphateStatus(ions.SO4);
        diagnostics.push({
            parameter: 'SO4',
            label: 'Sulphate (SO4)',
            value: ions.SO4.toFixed(1),
            unit: 'mg/L',
            status: status.label,
            statusClass: status.class,
            driver: status.driver,
            recommendation: status.recommendation
        });
    }

    return diagnostics;
}

// Status functions
function getSARStatus(value) {
    if (value < 3) return { label: 'Safe', class: 'status-adequate', driver: 'Low sodium hazard', recommendation: 'No sodium management required' };
    if (value < 6) return { label: 'Marginal', class: 'status-borderline', driver: 'Moderate sodium hazard', recommendation: 'Consider preventative gypsum (0.5-1.0 t/ha)' };
    if (value < 9) return { label: 'High Risk', class: 'status-deficient', driver: 'Infiltration decline likely', recommendation: 'Apply gypsum 1.0-2.0 t/ha, monitor infiltration' };
    return { label: 'Severe', class: 'status-deficient', driver: 'Severe sodicity hazard', recommendation: 'Heavy gypsum (2.0+ t/ha), consider water blending' };
}

function getECStatus(value) {
    if (value < 0.7) return { label: 'Low Risk', class: 'status-adequate', driver: 'Minimal salt accumulation', recommendation: 'Standard leaching (10-15%)' };
    if (value < 1.5) return { label: 'Medium Risk', class: 'status-borderline', driver: 'Monitor salt levels', recommendation: 'Increase leaching to 15-20%' };
    if (value < 3.0) return { label: 'High Risk', class: 'status-deficient', driver: 'Salt stress likely', recommendation: 'Leaching 20-25%, salt-tolerant cultivars' };
    return { label: 'Very High', class: 'status-deficient', driver: 'Specialized management needed', recommendation: 'Leaching >25%, consider water treatment' };
}

function getRSCStatus(value) {
    if (value < 0) return { label: 'No Hazard', class: 'status-adequate', driver: 'No carbonate precipitation', recommendation: 'Ca/Mg remain available' };
    if (value < 1.25) return { label: 'Moderate', class: 'status-borderline', driver: 'Some Ca/Mg precipitation', recommendation: 'Monitor Ca/Mg availability' };
    if (value < 2.5) return { label: 'High Hazard', class: 'status-deficient', driver: 'Significant precipitation', recommendation: 'Regular gypsum applications' };
    return { label: 'Severe', class: 'status-deficient', driver: 'Severe carbonate hazard', recommendation: 'Acidification or heavy gypsum required' };
}

function getChlorideStatus(value) {
    if (value < 100) return { label: 'Safe', class: 'status-adequate', driver: 'No toxicity risk', recommendation: 'No chloride management required' };
    if (value < 350) return { label: 'Caution', class: 'status-borderline', driver: 'Monitor sensitive species', recommendation: 'Avoid foliar irrigation during heat stress' };
    return { label: 'High Risk', class: 'status-deficient', driver: 'Foliar damage likely', recommendation: 'Avoid overhead irrigation, increase leaching' };
}

function getSodiumToxStatus(value) {
    if (value < 70) return { label: 'Safe', class: 'status-adequate', driver: 'No toxicity risk', recommendation: 'No sodium management required' };
    if (value < 150) return { label: 'Caution', class: 'status-borderline', driver: 'Monitor sensitive species', recommendation: 'Maintain adequate soil calcium levels' };
    return { label: 'High Risk', class: 'status-deficient', driver: 'Direct toxicity risk', recommendation: 'Gypsum applications, increase leaching' };
}

function getBoronStatus(value) {
    if (value < 0.5) return { label: 'Safe', class: 'status-adequate', driver: 'No toxicity risk', recommendation: 'No boron management required' };
    if (value < 2.0) return { label: 'Caution', class: 'status-borderline', driver: 'Sensitive turf affected', recommendation: 'Monitor sensitive species, increase leaching' };
    return { label: 'High Risk', class: 'status-deficient', driver: 'Toxicity likely', recommendation: 'Water blending or treatment system required' };
}

function getIronStatus(value) {
    if (value < 0.3) return { label: 'Safe', class: 'status-adequate', driver: 'No staining risk', recommendation: 'No iron management required' };
    if (value < 1.0) return { label: 'Caution', class: 'status-borderline', driver: 'Moderate staining possible', recommendation: 'Monitor surfaces, consider filtration if needed' };
    if (value < 2.0) return { label: 'High Risk', class: 'status-deficient', driver: 'Staining likely', recommendation: 'Install iron filtration system' };
    return { label: 'Severe', class: 'status-deficient', driver: 'Severe staining expected', recommendation: 'Mandatory filtration, avoid if possible' };
}

function getPHStatus(value) {
    // Irrigation water pH thresholds — Ayers & Westcot (1985), FAO 29
    if (value < 6.5) return { label: 'Acidic', class: 'status-borderline', driver: 'Low pH may increase metal solubility and equipment corrosion', recommendation: 'Check bicarbonate alkalinity; monitor equipment. pH <6.0 may require buffering.' };
    if (value <= 8.4) return { label: 'Suitable', class: 'status-adequate', driver: 'pH within normal irrigation range (6.5–8.4)', recommendation: 'No adjustment required' };
    return { label: 'Alkaline', class: 'status-deficient', driver: 'High pH promotes calcite precipitation, raises soil pH, reduces P availability', recommendation: 'Acidify water to pH 6.5–7.0; inject sulphuric or phosphoric acid' };
}

function getCalciumStatus(mgL) {
    // Ayers & Westcot (1985) — Ca in irrigation water; low Ca promotes sodicity
    if (mgL < 20)  return { label: 'Low', class: 'status-borderline', driver: 'Low Ca — reduced buffering against sodium-induced sodicity', recommendation: 'Monitor SAR closely; consider Ca-containing amendments (gypsum)' };
    if (mgL <= 200) return { label: 'Adequate', class: 'status-adequate', driver: 'Adequate Ca — good buffering capacity', recommendation: 'No action required' };
    return { label: 'High', class: 'status-borderline', driver: 'Elevated Ca may contribute to scale and calcite deposition', recommendation: 'Check LSI; consider water treatment if scale is present' };
}

function getMagnesiumStatus(mgL) {
    // Ayers & Westcot (1985); Carrow & Duncan (1998)
    if (mgL < 5)   return { label: 'Low', class: 'status-borderline', driver: 'Low Mg may limit plant uptake if soil Mg is borderline', recommendation: 'Supplement with MgSO4 (Epsom salt) if soil Mg is also low' };
    if (mgL <= 60) return { label: 'Adequate', class: 'status-adequate', driver: 'Adequate Mg — no concerns', recommendation: 'No action required' };
    return { label: 'Elevated', class: 'status-borderline', driver: 'High Mg relative to Ca can displace Ca on exchange sites', recommendation: 'Check Ca:Mg ratio in soil; apply gypsum if Ca:Mg < 3:1' };
}

function getPotassiumStatus(mgL) {
    // No specific toxicity threshold for turfgrass irrigation water;
    // Ayers & Westcot (1985) — K < 2 meq/L (78 mg/L) presents no irrigation concern
    if (mgL < 78)  return { label: 'Normal', class: 'status-adequate', driver: 'K within normal irrigation range', recommendation: 'No action required' };
    if (mgL < 200) return { label: 'Elevated', class: 'status-borderline', driver: 'Elevated K may contribute to K accumulation in soils', recommendation: 'Reduce K fertiliser inputs; monitor soil K levels' };
    return { label: 'High', class: 'status-deficient', driver: 'High K can displace Ca/Mg on exchange sites; may promote luxury K consumption', recommendation: 'Consider water blending; monitor Ca:K and Mg:K ratios in soil' };
}

function getSulphateStatus(mgL) {
    // Ayers & Westcot (1985) — SO4 up to 1000 mg/L generally tolerated by turfgrass
    if (mgL < 200)  return { label: 'Low', class: 'status-adequate', driver: 'Low sulphate — no concerns', recommendation: 'No action required' };
    if (mgL <= 600) return { label: 'Moderate', class: 'status-adequate', driver: 'Moderate sulphate — within normal irrigation range', recommendation: 'No action required; contributes S to plant nutrition' };
    if (mgL <= 1000) return { label: 'Elevated', class: 'status-borderline', driver: 'Elevated SO4 — monitor total salinity (EC)', recommendation: 'Monitor ECw; ensure adequate leaching fraction' };
    return { label: 'High', class: 'status-deficient', driver: 'High sulphate contributes significantly to EC and total salt load', recommendation: 'Increase leaching fraction; consider water blending or treatment' };
}

function renderWaterCard(diagnostic) {
    const cardId = `water-${diagnostic.parameter}-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
    
    // Special rendering for soil-water interaction card
    if (diagnostic.parameter === 'SOIL_WATER' && diagnostic.issues) {
        return renderSoilWaterInteractionCard(diagnostic, cardId);
    }
    
    return `
        <div class="gaip-diagnostic-card water-card">
            <div class="gaip-verdict">
                <div class="gaip-verdict-header">
                    <h4 class="gaip-parameter">${diagnostic.label}</h4>
                    <div class="gaip-status-badge ${diagnostic.statusClass}">
                        <span class="gaip-status-icon">${diagnostic.statusClass === 'status-adequate' ? '✓' : '⚠'}</span>
                        <span class="gaip-status-label">${diagnostic.status}</span>
                    </div>
                </div>
                <div class="gaip-verdict-content">
                    <div class="gaip-driver">
                        <span class="gaip-label">Value:</span>
                        <span class="gaip-value">${diagnostic.value} ${diagnostic.unit}</span>
                    </div>
                    <div class="gaip-driver-text">${diagnostic.driver}</div>
                    <div class="gaip-confidence confidence-high">
                        <span class="gaip-confidence-bars">▮▮▮▮▯</span>
                        <span class="gaip-confidence-percentage">88%</span>
                    </div>
                </div>
                <div class="gaip-verdict-actions">
                    <button class="gaip-expand-btn" data-target="why-${cardId}">
                        Why? <span class="gaip-icon">▼</span>
                    </button>
                    <button class="gaip-water-assumptions-btn" data-parameter="${diagnostic.label}" title="Show assumptions">
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
                </div>
            </div>
        </div>
    `;
}

/**
 * Render soil-water interaction card with detailed issues
 */
function renderSoilWaterInteractionCard(diagnostic, cardId) {
    const highSeverity = diagnostic.issues.filter(i => i.severity === 'high');
    const modSeverity = diagnostic.issues.filter(i => i.severity === 'moderate');
    const lowSeverity = diagnostic.issues.filter(i => i.severity === 'low');
    
    return `
        <div class="gaip-diagnostic-card water-card soil-water-card" style="border-left: 4px solid ${diagnostic.statusClass === 'status-deficient' ? '#dc2626' : diagnostic.statusClass === 'status-borderline' ? '#f59e0b' : '#10b981'};">
            <div class="gaip-verdict">
                <div class="gaip-verdict-header">
                    <h4 class="gaip-parameter">🔗 ${diagnostic.label}</h4>
                    <div class="gaip-status-badge ${diagnostic.statusClass}">
                        <span class="gaip-status-icon">${diagnostic.statusClass === 'status-adequate' ? '✓' : '⚠'}</span>
                        <span class="gaip-status-label">${diagnostic.status}</span>
                    </div>
                </div>
                <div class="gaip-verdict-content">
                    <div class="gaip-driver">
                        <span class="gaip-label">Detected:</span>
                        <span class="gaip-value">${diagnostic.value}</span>
                    </div>
                    <div class="gaip-driver-text">${diagnostic.driver}</div>
                    <div class="gaip-confidence confidence-high">
                        <span class="gaip-confidence-bars">▮▮▮▮▮</span>
                        <span class="gaip-confidence-percentage">95%</span>
                    </div>
                </div>
                <div class="gaip-verdict-actions">
                    <button class="gaip-expand-btn" data-target="why-${cardId}">
                        Details <span class="gaip-icon">▼</span>
                    </button>
                </div>
            </div>
            <div class="gaip-why-section gaip-collapsed" id="why-${cardId}">
                <div class="gaip-why-content">
                    ${highSeverity.length > 0 ? `
                        <div class="gaip-interaction-issues" style="margin-bottom: 12px;">
                            <p style="color: #dc2626; font-weight: 600; margin: 0 0 8px 0;">🔴 High Priority:</p>
                            ${highSeverity.map(issue => `
                                <div style="margin: 8px 0; padding: 8px; background: var(--gaip-critical-bg); border-left: 3px solid #dc2626; border-radius: 4px;">
                                    <strong style="font-size: 13px;">${issue.type}</strong><br>
                                    <span style="font-size: 12px; color: var(--gaip-text);">${issue.description}</span><br>
                                    <span style="font-size: 11px; color: var(--gaip-text);"><strong>Impact:</strong> ${issue.impact}</span><br>
                                    <span style="font-size: 11px; color: var(--gaip-text);"><strong>Action:</strong> ${issue.action}</span>
                                </div>
                            `).join('')}
                        </div>
                    ` : ''}
                    
                    ${modSeverity.length > 0 ? `
                        <div class="gaip-interaction-issues" style="margin-bottom: 12px;">
                            <p style="color: #f59e0b; font-weight: 600; margin: 0 0 8px 0;">🟡 Monitor:</p>
                            ${modSeverity.map(issue => `
                                <div style="margin: 8px 0; padding: 8px; background: var(--gaip-warning-bg); border-left: 3px solid #f59e0b; border-radius: 4px;">
                                    <strong style="font-size: 13px;">${issue.type}</strong><br>
                                    <span style="font-size: 12px; color: var(--gaip-text);">${issue.description}</span><br>
                                    <span style="font-size: 11px; color: var(--gaip-text);"><strong>Impact:</strong> ${issue.impact}</span><br>
                                    <span style="font-size: 11px; color: var(--gaip-text);"><strong>Action:</strong> ${issue.action}</span>
                                </div>
                            `).join('')}
                        </div>
                    ` : ''}
                    
                    ${lowSeverity.length > 0 ? `
                        <div class="gaip-interaction-issues">
                            <p style="color: #3b82f6; font-weight: 600; margin: 0 0 8px 0;">ℹ️ Note:</p>
                            ${lowSeverity.map(issue => `
                                <div style="margin: 8px 0; padding: 8px; background: var(--gaip-info-bg); border-left: 3px solid #3b82f6; border-radius: 4px;">
                                    <strong style="font-size: 13px;">${issue.type}</strong><br>
                                    <span style="font-size: 12px; color: var(--gaip-text);">${issue.description}</span><br>
                                    <span style="font-size: 11px; color: var(--gaip-text);"><strong>Impact:</strong> ${issue.impact}</span><br>
                                    <span style="font-size: 11px; color: var(--gaip-text);"><strong>Action:</strong> ${issue.action}</span>
                                </div>
                            `).join('')}
                        </div>
                    ` : ''}
                </div>
            </div>
        </div>
    `;
}

function renderPriorityActions(highRisk, caution) {
    const sectionId = `water-actions-${Date.now()}`;
    
    if (highRisk.length === 0 && caution.length === 0) return '';
    
    return `
        <div class="gaip-water-management-section">
            <div class="gaip-section-header">
                <h4>Priority Actions</h4>
                <button class="gaip-expand-btn" data-target="${sectionId}">
                    <span class="gaip-icon">▼</span>
                </button>
            </div>
            <div class="gaip-collapsible-content gaip-collapsed" id="${sectionId}">
                ${highRisk.length > 0 ? `
                    <p style="color: #dc2626; font-weight: 600; margin: 0 0 8px 0;">⚠️ High Risk Parameters:</p>
                    <ul style="margin: 0 0 16px 0; padding-left: 20px;">
                        ${highRisk.map(d => `<li style="margin: 4px 0;"><strong>${d.label}:</strong> ${d.recommendation}</li>`).join('')}
                    </ul>
                ` : ''}
                ${caution.length > 0 ? `
                    <p style="color: #d97706; font-weight: 600; margin: 0 0 8px 0;">⚠ Monitor Closely:</p>
                    <ul style="margin: 0; padding-left: 20px;">
                        ${caution.map(d => `<li style="margin: 4px 0;"><strong>${d.label}:</strong> ${d.recommendation}</li>`).join('')}
                    </ul>
                ` : ''}
            </div>
        </div>
    `;
}

/**
 * Analyze soil-water interactions
 * Checks pH × water chemistry, combined sodicity, calcium dynamics
 */
function analyzeSoilWaterInteraction(state) {
    if (!state || !state.soil || !state.water) {
        return null;
    }
    
    const soil = state.soil;
    const water = state.water;
    const ions = water.ions || {};
    
    // Get soil pH and EC
    const soilPH = soil.pH_water || soil.pH_cacl2 || 0;
    const soilECe = soil.ECe || 0;  // Saturated paste EC (dS/m)
    const waterECw = water.ecw || 0;
    
    if (soilPH === 0 && soilECe === 0) return null;
    
    // Convert water ions to meq/L for calculations
    const waterCa = (ions.Ca || 0) / 20.04;
    const waterMg = (ions.Mg || 0) / 12.15;
    const waterNa = (ions.Na || 0) / 23.0;
    const waterHCO3 = (ions.HCO3 || 0) / 61.0;
    const waterCO3 = (ions.CO3 || 0) / 30.0;
    
    // Get soil sodium
    const soilNa = soil.ppm?.Na || 0;
    
    // Calculate water SARadj (adjusted for bicarbonate precipitation)
    let waterSARadj = 0;
    if (waterCa + waterMg > 0 && waterNa > 0) {
        const basicSAR = waterNa / Math.sqrt((waterCa + waterMg) / 2);
        waterSARadj = basicSAR;
        
        // Adjust if bicarbonate/carbonate exceeds Ca+Mg
        const HCO3CO3_total = waterHCO3 + waterCO3;
        const CaMg_total = waterCa + waterMg;
        if (HCO3CO3_total > CaMg_total) {
            const CaMg_after = Math.max(0.5, CaMg_total - (HCO3CO3_total - CaMg_total) * 0.5);
            waterSARadj = waterNa / Math.sqrt(CaMg_after / 2);
        }
    }
    
    // Analyse interactions
    const issues = [];
    let overallStatus = 'adequate';
    let priority = 0;
    
    // 0. Soil EC × Water EC Interaction (Salinity Accumulation)
    // FAO 29 Rev: ECe should not exceed species tolerance thresholds
    if (soilECe > 0 && waterECw > 0) {
        // Estimate steady-state soil EC from water EC (approx 1.5-3× depending on leaching)
        const leachingFraction = 0.15;  // Assume 15% LF
        const estimatedSteadyStateEC = waterECw * (1 / (2 * leachingFraction));  // Simplified Ayers & Westcot
        
        if (soilECe > 4.0 && waterECw > 1.5) {
            issues.push({
                type: 'Salinity Accumulation',
                severity: 'high',
                description: `High soil EC (${soilECe.toFixed(1)} dS/m) + saline irrigation (ECw ${waterECw.toFixed(1)} dS/m)`,
                impact: 'Salt accumulation exceeding cool-season tolerance (threshold ~3-4 dS/m)',
                action: 'Increase leaching fraction to 20-25%, monitor rootzone EC monthly'
            });
            overallStatus = 'deficient';
            priority = Math.max(priority, 3);
        } else if (soilECe > 2.5 && waterECw > 1.0) {
            issues.push({
                type: 'Salinity Build-up',
                severity: 'moderate',
                description: `Elevated soil EC (${soilECe.toFixed(1)} dS/m) with ECw ${waterECw.toFixed(1)} dS/m`,
                impact: `At 15% LF, steady-state EC ≈ ${estimatedSteadyStateEC.toFixed(1)} dS/m`,
                action: 'Maintain leaching fraction ≥15%, monitor soil EC quarterly'
            });
            overallStatus = overallStatus === 'adequate' ? 'borderline' : overallStatus;
            priority = Math.max(priority, 2);
        } else if (soilECe < waterECw * 0.8) {
            // Soil EC lower than expected from water - good drainage or recent flush
            issues.push({
                type: 'Effective Leaching',
                severity: 'low',
                description: `Soil EC (${soilECe.toFixed(1)} dS/m) below expected from ECw (${waterECw.toFixed(1)} dS/m)`,
                impact: 'Current leaching regime effectively preventing salt accumulation',
                action: 'Maintain current irrigation practices'
            });
        }
    } else if (soilECe > 0 && waterECw === 0) {
        // Soil EC entered but no water EC - flag as incomplete
        if (soilECe > 2.5) {
            issues.push({
                type: 'Soil Salinity - No Water Data',
                severity: 'moderate',
                description: `Soil EC elevated (${soilECe.toFixed(1)} dS/m) - water EC unknown`,
                impact: 'Unable to assess salt loading from irrigation',
                action: 'Enter water EC to enable full salinity assessment'
            });
            overallStatus = overallStatus === 'adequate' ? 'borderline' : overallStatus;
            priority = Math.max(priority, 1);
        }
    }
    
    // 1. pH × Water Chemistry Interaction
    const isDepositingWater = (ions.Ca > 60 && ions.HCO3 > 100);
    const isStrippingWater = (ions.Ca < 20 && (ions.HCO3 > 100 || ions.CO3 > 10));
    
    if (soilPH > 7.5 && isDepositingWater) {
        issues.push({
            type: 'pH × Depositing Water',
            severity: 'high',
            description: `Alkaline soil (pH ${soilPH.toFixed(1)}) + Ca/HCO₃-rich water → Progressive pH increase`,
            impact: 'Each irrigation deposits calcium carbonate, raising soil pH further',
            action: 'Acidify irrigation water to pH 6.5-7.0 or apply elemental sulphur'
        });
        overallStatus = 'deficient';
        priority = Math.max(priority, 3);
    } else if (soilPH > 7.0 && isDepositingWater) {
        issues.push({
            type: 'pH × Depositing Water',
            severity: 'moderate',
            description: `Slightly alkaline soil (pH ${soilPH.toFixed(1)}) + depositing water`,
            impact: 'Monitor for gradual pH drift upward',
            action: 'Consider water acidification or sulphur applications'
        });
        overallStatus = 'borderline';
        priority = Math.max(priority, 2);
    }
    
    if (soilPH < 6.0 && isStrippingWater) {
        issues.push({
            type: 'pH × Stripping Water',
            severity: 'moderate',
            description: `Acidic soil (pH ${soilPH.toFixed(1)}) + low-Ca water`,
            impact: 'Water may strip calcium from soil, degrading structure',
            action: 'Add gypsum or calcium chloride to maintain soil calcium'
        });
        overallStatus = overallStatus === 'adequate' ? 'borderline' : overallStatus;
        priority = Math.max(priority, 2);
    }
    
    // 2. Combined Sodicity Risk (Soil Na + Water SARadj)
    if (soilNa > 50 && waterSARadj > 3) {
        issues.push({
            type: 'Combined Sodicity',
            severity: 'high',
            description: `Elevated soil Na (${soilNa.toFixed(0)} ppm) + moderate-high water SARadj (${waterSARadj.toFixed(1)})`,
            impact: 'Compounding sodium accumulation → infiltration failure risk',
            action: 'Immediate gypsum application + improve drainage'
        });
        overallStatus = 'deficient';
        priority = Math.max(priority, 3);
    } else if (soilNa > 30 && waterSARadj > 6) {
        issues.push({
            type: 'Combined Sodicity',
            severity: 'high',
            description: `Soil Na (${soilNa.toFixed(0)} ppm) + high water SARadj (${waterSARadj.toFixed(1)})`,
            impact: 'Continuous sodium loading on already-sodic soil',
            action: 'Heavy gypsum required + consider water blending'
        });
        overallStatus = 'deficient';
        priority = Math.max(priority, 3);
    } else if ((soilNa > 50 || waterSARadj > 6) && !(soilNa > 50 && waterSARadj > 6)) {
        issues.push({
            type: 'Sodicity Watch',
            severity: 'moderate',
            description: soilNa > 50 ? 
                `Elevated soil Na (${soilNa.toFixed(0)} ppm) - water SARadj OK but monitor` :
                `High water SARadj (${waterSARadj.toFixed(1)}) - soil Na OK but monitor`,
            impact: 'One parameter elevated - prevent second from rising',
            action: 'Preventative gypsum, monitor both soil Na and water SARadj'
        });
        overallStatus = overallStatus === 'adequate' ? 'borderline' : overallStatus;
        priority = Math.max(priority, 1);
    }
    
    // 3. Calcium Dynamics
    if (soilPH > 7.5 && ions.Ca > 100) {
        issues.push({
            type: 'Calcium Excess + Alkalinity',
            severity: 'low',
            description: `High-Ca water (${ions.Ca.toFixed(0)} mg/L) on alkaline soil (pH ${soilPH.toFixed(1)})`,
            impact: 'Ca dominance may induce Mg/K deficiency symptoms',
            action: 'Monitor Mg and K levels, supplement if deficiency appears'
        });
        priority = Math.max(priority, 1);
    }
    
    // 4. Bicarbonate on Neutral/Alkaline Soils
    if (soilPH > 6.5 && ions.HCO3 > 200) {
        issues.push({
            type: 'Bicarbonate + Neutral/Alkaline pH',
            severity: 'moderate',
            description: `High HCO₃ water (${ions.HCO3.toFixed(0)} mg/L) on pH ${soilPH.toFixed(1)} soil`,
            impact: 'Bicarbonate accumulation → Fe/Mn chlorosis risk',
            action: 'Foliar Fe applications, consider acidifying fertilisers'
        });
        overallStatus = overallStatus === 'adequate' ? 'borderline' : overallStatus;
        priority = Math.max(priority, 2);
    }
    
    // If no issues detected, return null (no card needed)
    if (issues.length === 0) {
        return null;
    }
    
    // Determine status
    let status, statusClass, driver;
    
    if (overallStatus === 'deficient') {
        status = 'High Risk';
        statusClass = 'status-deficient';
        driver = 'Soil-water incompatibility detected';
    } else if (overallStatus === 'borderline') {
        status = 'Monitor';
        statusClass = 'status-borderline';
        driver = 'Interaction requires attention';
    } else {
        status = 'Acceptable';
        statusClass = 'status-adequate';
        driver = 'No critical interactions';
    }
    
    // Build summary recommendation
    const highPriorityIssues = issues.filter(i => i.severity === 'high');
    const recommendation = highPriorityIssues.length > 0 ?
        highPriorityIssues[0].action :
        issues[0].action;
    
    return {
        parameter: 'SOIL_WATER',
        label: 'Soil-Water Interaction',
        value: `${issues.length} interaction${issues.length > 1 ? 's' : ''}`,
        unit: '',
        status: status,
        statusClass: statusClass,
        driver: driver,
        recommendation: recommendation,
        issues: issues,
        priority: priority
    };
}

if (typeof window !== 'undefined') {
    window.renderWaterProgressiveDisclosure = renderWaterProgressiveDisclosure;
    
    // Water assumptions click handler
    document.addEventListener('DOMContentLoaded', function() {
        document.addEventListener('click', function(e) {
            if (e.target.closest('.gaip-water-assumptions-btn')) {
                const btn = e.target.closest('.gaip-water-assumptions-btn');
                const parameter = btn.dataset.parameter;
                showWaterAssumptions(btn, parameter);
            }
        });
    });
}

/**
 * Show water quality assumptions tooltip
 */
function showWaterAssumptions(btn, parameter) {
    const assumptions = {
        'Salinity (ECw)': [
            'Thresholds from Ayers & Westcot (1985) FAO guidelines',
            'ECw categories: <0.7 low, 0.7-3.0 moderate, >3.0 severe',
            'Turf tolerance varies by species (C4 generally more tolerant)',
            'Leaching requirement increases with salinity'
        ],
        'Sodium Hazard (SAR)': [
            'SAR = Na / √((Ca + Mg) / 2)',
            'Thresholds adjusted for ECw (Ayers & Westcot)',
            'High SAR + low EC = worst case for soil structure',
            'Gypsum requirement based on SAR and soil CEC'
        ],
        'Chloride (Cl)': [
            'Direct foliar toxicity threshold: >350 mg/L',
            'Root zone accumulation depends on leaching',
            'C3 grasses more sensitive than C4',
            'Leaf tip burn is primary symptom'
        ],
        'Boron (B)': [
            'Narrow sufficiency range: 0.5-1.0 mg/L optimal',
            'Toxicity threshold species-dependent',
            'Accumulates in leaf margins',
            'Difficult to leach from soil'
        ],
        'Bicarbonate (HCO₃)': [
            'Lime precipitation risk with Ca when HCO₃ > 120 mg/L',
            'Affects sprinkler system deposits',
            'RSC (Residual Sodium Carbonate) calculated',
            'Acid injection may be required'
        ],
        'pH': [
            'Irrigation water pH affects nutrient availability',
            'Optimal range: 6.5-8.4 for irrigation',
            'High pH may precipitate nutrients in tank mixes',
            'Soil buffering capacity moderates effects'
        ],
        'Scale Potential (LSI)': [
            'Langelier Saturation Index: LSI = pH - pHs',
            'LSI > 0 = scale-forming (deposits CaCO₃)',
            'LSI < 0 = corrosive (dissolves/strips CaCO₃)',
            'Based on Ca, alkalinity, TDS, temperature (25°C assumed)',
            'Acidification lowers pH toward pHs to prevent scaling'
        ],
        'Calcium Carbonate': [
            'Langelier Saturation Index determines scaling/stripping',
            'Scale-forming water clogs emitters, deposits on surfaces',
            'Corrosive water strips calcium from soil profile',
            'Acid injection targets pH just below saturation point'
        ]
    };
    
    // Get assumptions for this parameter, or use default
    const paramAssumptions = assumptions[parameter] || [
        'Thresholds from Ayers & Westcot (1985) FAO guidelines',
        'Turf species tolerance considered',
        'Soil interaction effects evaluated',
        'Management based on cumulative exposure'
    ];
    
    // Remove existing tooltips
    document.querySelectorAll('.gaip-assumptions-tooltip').forEach(t => t.remove());

    const tooltip = document.createElement('div');
    tooltip.className = 'gaip-assumptions-tooltip';
    tooltip.style.cssText = `
        position: fixed;
        z-index: 99999;
        max-width: 300px;
        background: #1e3a5f;
        color: #ffffff;
        border: 1px solid #2d4a6f;
        padding: 12px 14px;
        border-radius: 8px;
        box-shadow: 0 10px 25px rgba(0, 0, 0, 0.4);
        font-size: 12px;
        line-height: 1.5;
    `;
    
    tooltip.innerHTML = `
        <div style="margin-bottom: 8px; font-weight: 600; font-size: 13px; border-bottom: 1px solid #2d4a6f; padding-bottom: 6px;">
            Water Quality Assumptions (${parameter})
        </div>
        <ul style="margin: 0; padding-left: 16px;">
            ${paramAssumptions.map(a => `<li style="margin: 4px 0;">${a}</li>`).join('')}
        </ul>
        <div style="margin-top: 10px; font-size: 10px; color: rgba(255,255,255,0.7); text-align: right;">
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
