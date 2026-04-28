/**
 * Cultivar Performance Profile UI
 * Renders variety trait information in the web interface
 * Version 1.4.1 - Fix stale overseed state on species switch
 */

(function() {
    'use strict';
    
    /**
     * Check if a species is C4 (warm-season)
     */
    function isC4Species(speciesName) {
        if (!speciesName) return false;
        const normalized = speciesName.toLowerCase().replace(/\s+/g, '');
        const c4Species = ['couch', 'bermuda', 'bermudagrass', 'cynodon', 'zoysia', 'zoysiagrass', 
                          'kikuyu', 'buffalo', 'seashore', 'seashorepaspalum', 'paspalum', 
                          'st.augustine', 'staugustine', 'centipede', 'bahia'];
        return c4Species.some(c4 => normalized.includes(c4));
    }
    
    /**
     * Render the cultivar profile card
     * Called when variety changes or analysis runs
     */
    function renderCultivarProfile() {
        const container = document.querySelector('.gaip-cultivar-body');
        if (!container) {
            return;
        }
        
        // ALWAYS get current species from DOM first - this is the source of truth for user selection
        const currentSpeciesFromDOM = document.querySelector('.gaip-species')?.value;
        const currentVarietyFromDOM = document.querySelector('.gaip-variety')?.value;
        
        // Get state objects
        const state = window.GAIP_STATE || {};
        const overseedState = window.GAIP_OVERSEED_STATE || {};
        const turfState = state.turf || {};
        
        // Check if DOM species is C4 - if so, no overseed scenario applies unless explicitly configured
        const domSpeciesIsC4 = isC4Species(currentSpeciesFromDOM);
        
        // Validate overseed state is fresh and relevant
        // State is stale if:
        // 1. It's null/undefined
        // 2. DOM shows C4 species but state says overseed is dominant
        // 3. The overseed species doesn't match the current DOM selection (for C3 scenarios)
        const overseedStateExists = overseedState && overseedState.c3Fraction > 0;
        const overseedMatchesDOM = overseedState?.overseedSpecies === currentSpeciesFromDOM;
        const hasActiveOverseedConfig = turfState.coolOverseed && turfState.coolOverseed.length > 0;
        
        // Only consider overseed valid if:
        // - State exists AND
        // - Either the overseed matches DOM (user selected the overseed species) OR
        // - There's an active overseed config AND DOM species matches the configured overseed
        const overseedIsValid = overseedStateExists && 
            (overseedMatchesDOM || (hasActiveOverseedConfig && !domSpeciesIsC4));
        
        // If DOM species is C4 with no configured cool overseed, ignore any stale overseed state
        if (domSpeciesIsC4 && !hasActiveOverseedConfig && overseedStateExists) {
        }
        
        // Get c3Fraction only if overseed state is valid
        const c3Fraction = overseedIsValid ? (
                          turfState.species?.c3Fraction || 
                          turfState.c3Fraction || 
                          state.c3Fraction || 
                          overseedState.c3Fraction || 0
                          ) : 0;
        
        // Determine species/variety to display
        let species, variety;
        const overseedDominant = c3Fraction > 0.5 && overseedIsValid;
        
        if (overseedDominant) {
            // Use effective species from valid overseed state
            species = turfState.effectiveSpecies || 
                     state.effectiveSpecies || 
                     turfState.coolOverseed || 
                     overseedState.coolOverseed ||
                     'Perennial Ryegrass';
            variety = turfState.effectiveVariety || 
                     state.effectiveVariety || 
                     turfState.overseedVariety ||
                     overseedState.overseedVariety ||
                     'generic';
        } else {
            // Use dropdown values (base species)
            species = currentSpeciesFromDOM;
            variety = currentVarietyFromDOM;
        }
        
        if (!variety || variety === 'generic') {
            container.innerHTML = `
                <div class="gaip-cultivar-empty" style="padding: 1rem; color: var(--gaip-text); font-style: italic;">
                    Select a specific variety to see performance data.
                </div>
            `;
            return;
        }
        
        // Get traits from integration
        const VT = window.GAIP_VarietyTraits;
        if (!VT) {
            container.innerHTML = `<div class="gaip-cultivar-error" style="padding: 1rem; color: #dc2626;">Variety traits module not loaded.</div>`;
            return;
        }
        
        // Detect region from coordinates (most reliable method)
        let region = null;
        const latInput = document.querySelector('.gaip-lat');
        const lonInput = document.querySelector('.gaip-lon');
        let lat = null, lon = null;
        
        if (latInput && lonInput) {
            lat = parseFloat(latInput.value);
            lon = parseFloat(lonInput.value);
            if (!isNaN(lat) && !isNaN(lon)) {
                region = VT.detectVarietyRegion(lat, lon);
            }
        }
        
        // If region detection failed or returned ntep but we're clearly in UK, override
        if (!region || region === 'ntep') {
            // Check if UK based on coordinates (backup check)
            if (lat !== null && lat > 49 && lat < 61 && lon > -12 && lon < 2) {
                region = 'bspb';
            }
        }
        
        // Final fallback
        if (!region) {
            region = VT.getCurrentRegion() || 'ntep';
        }
        
        
        // Normalize species for lookup
        const normalizedSpecies = species ? species.replace(/\s+/g, '').replace(/^(.)/, c => c.toLowerCase()) : '';
        
        // Get traits with explicit region
        const traits = VT.getVarietyTraits ? VT.getVarietyTraits(species, variety, region) : null;
        const wear = VT.getWearModifier(species, variety, region);
        const disease = VT.getDiseaseModifier(species, variety, region === 'bspb' ? 'redThread' : 'dollarSpot', region);
        const water = VT.getWaterUseModifier(species, variety);
        const cold = VT.getColdModifier(species, variety);
        const heat = VT.getHeatDroughtModifier(species, variety);
        const shade = VT.getShadeModifier ? VT.getShadeModifier(species, variety) : { thresholdModifier: 1.0, confidence: 'none' };

        // Log coverage to console
        if (VT.logTraitCoverage) {
            VT.logTraitCoverage(species, variety);
        }
        
        // Region display names
        const regionNames = {
            'bspb': 'UK & Ireland (BSPB/STRI trials)',
            'scanturf': 'Scandinavia (Scanturf trials)',
            'geves': 'France (GEVES trials)',
            'ntep': 'US/Australia (NTEP trials)'
        };
        
        // Build HTML
        let html = `
            <div class="gaip-cultivar-profile" style="padding: 0.5rem;">
                <div class="gaip-cultivar-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem; padding-bottom: 0.5rem; border-bottom: 1px solid var(--gaip-border);">
                    <div>
                        <span style="font-weight: 600; font-size: 1.1rem; color: var(--gaip-text);">${variety}</span>
                        ${traits?._isBlend ? '<span style="margin-left: 0.5rem; padding: 2px 8px; background: var(--gaip-info-bg); color: #1e40af; border-radius: 4px; font-size: 0.75rem;">BLEND</span>' : ''}
                    </div>
                    <div style="font-size: 0.8rem; color: var(--gaip-text);">
                        📍 ${regionNames[region] || region || 'Unknown region'}
                    </div>
                </div>
        `;
        
        // BSPB ratings table for UK
        if (region === 'bspb') {
            // Try to get BSPB ratings from traits or direct lookup
            let bspbRatings = traits?.bspbRatings;
            
            // If not in traits, try direct lookup
            if (!bspbRatings && typeof window.gaip_getUKVarietyData === 'function') {
                const ukData = window.gaip_getUKVarietyData(species, variety);
                bspbRatings = ukData?.bspbRatings;
            }
            
            if (bspbRatings) {
                html += renderBSPBRatings(bspbRatings);
            }
        }
        
        // Performance modifiers grid
        html += `<div class="gaip-modifiers-grid" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 0.75rem; margin-bottom: 1rem;">`;
        
        // Wear tolerance
        html += renderModifierCard('Wear Tolerance', wear, 
            wear.confidence !== 'none' ? formatModifier(wear.multiplier, true, 'wear') : 'No data',
            wear.source || 'No trial data available');
        
        // Recovery (if available)
        if (wear.recoveryMultiplier && wear.recoveryMultiplier !== 1.0) {
            html += renderModifierCard('Recovery Rate', { confidence: wear.confidence },
                formatModifier(wear.recoveryMultiplier, true, 'recovery'),
                wear.source || 'No data');
        }
        
        // Water use
        html += renderModifierCard('Water Use', water,
            water.confidence !== 'none' ? formatModifier(water.multiplier, true, 'water') : 'No data',
            water.source || 'No trial data available');
        
        // Heat/drought
        if (heat.confidence !== 'none') {
            html += renderModifierCard('Drought Tolerance', heat,
                formatModifier(heat.droughtMultiplier, true, 'drought'),
                heat.source || 'NTEP');
        }
        
        // Shade tolerance
        if (shade.confidence !== 'none') {
            const shadePct = Math.round((1 - shade.thresholdModifier) * 100);
            html += renderModifierCard('Shade Tolerance', shade,
                shadePct > 0 ? `${shadePct}% lower light requirement` : shadePct < 0 ? `${Math.abs(shadePct)}% higher light requirement` : 'Average',
                shade.source || 'Trial data');
        }
        
        // Cold tolerance
        if (cold.confidence !== 'none') {
            html += renderModifierCard('Winter Hardiness', cold,
                `${Math.round((1 - cold.winterkillRisk) * 100)}% lower winterkill risk vs generic`,
                cold.source || 'NTEP');
        }
        
        html += `</div>`;
        
        // Disease resistance section
        html += renderDiseaseResistance(VT, species, variety, region);
        
        // Blend composition (if applicable)
        if (traits?._isBlend && traits?.components) {
            html += renderBlendComposition(traits);
        }
        
        // Data availability note
        html += renderDataAvailabilityNote(region, wear, water, cold, heat, shade);
        
        html += `</div>`;
        
        container.innerHTML = html;
    }
    
    /**
     * Render BSPB ratings table
     */
    function renderBSPBRatings(ratings) {
        if (!ratings) return '';
        
        const ratingItems = [
            { key: 'overallMean', label: 'Overall Mean' },
            { key: 'liveGroundCover', label: 'Live Ground Cover' },
            { key: 'visualMerit', label: 'Visual Merit' },
            { key: 'recovery', label: 'Recovery' },
            { key: 'shootDensity', label: 'Shoot Density' },
            { key: 'finenessOfLeaf', label: 'Fineness of Leaf' },
            { key: 'redThread', label: 'Red Thread Resistance' }
        ];
        
        let html = `
            <div class="gaip-bspb-ratings" style="margin-bottom: 1rem;">
                <div style="font-weight: 600; font-size: 0.9rem; color: var(--gaip-text); margin-bottom: 0.5rem;">BSPB Trial Ratings (1-9 scale)</div>
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 0.5rem;">
        `;
        
        for (const item of ratingItems) {
            const value = ratings[item.key];
            if (value !== undefined && value !== null) {
                const color = getRatingColor(value);
                const desc = getRatingDescription(value);
                html += `
                    <div style="background: var(--gaip-surface-muted); padding: 0.5rem; border-radius: 6px; border-left: 3px solid ${color};">
                        <div style="font-size: 0.7rem; color: var(--gaip-text); text-transform: uppercase;">${item.label}</div>
                        <div style="font-size: 1.1rem; font-weight: 600; color: ${color};">${value.toFixed(1)}</div>
                        <div style="font-size: 0.7rem; color: var(--gaip-text);">${desc}</div>
                    </div>
                `;
            }
        }
        
        html += `</div></div>`;
        return html;
    }
    
    /**
     * Render a single modifier card
     */
    function renderModifierCard(title, data, value, source) {
        const confidence = data?.confidence || 'none';
        const confidenceColors = {
            'high': '#22c55e',
            'medium': '#f59e0b', 
            'low': 'var(--gaip-text-muted)',
            'none': 'var(--gaip-border)'
        };
        const borderColor = confidenceColors[confidence] || 'var(--gaip-border)';
        
        return `
            <div style="background: var(--gaip-surface-muted); padding: 0.75rem; border-radius: 8px; border-left: 3px solid ${borderColor};">
                <div style="font-size: 0.75rem; color: var(--gaip-text); text-transform: uppercase; margin-bottom: 0.25rem;">${title}</div>
                <div style="font-size: 1rem; font-weight: 600; color: var(--gaip-text);">${value}</div>
                <div style="font-size: 0.7rem; color: var(--gaip-text); margin-top: 0.25rem;" title="${source}">${truncate(source, 30)}</div>
            </div>
        `;
    }
    
    /**
     * Render disease resistance section
     */
    function renderDiseaseResistance(VT, species, variety, region) {
        // Species-aware disease lists
        const speciesLower = (species || '').toLowerCase();
        const isBermuda = speciesLower.includes('bermuda') || speciesLower.includes('couch');
        const isZoysia = speciesLower.includes('zoysia');
        
        let diseases;
        if (region === 'bspb') {
            // UK cool-season diseases
            diseases = ['redThread', 'fusarium', 'takeAll'];
        } else if (region === 'japan') {
            // Japan - zoysia dominant
            if (isZoysia) {
                diseases = ['largePatch', 'dollarSpot', 'rust'];
            } else {
                diseases = ['dollarSpot', 'brownPatch', 'pythium', 'grayLeafSpot'];
            }
        } else if (isBermuda) {
            // Bermuda/couch warm-season diseases
            diseases = ['springDeadSpot', 'largePatch', 'dollarSpot'];
        } else if (isZoysia) {
            // Zoysia diseases
            diseases = ['largePatch', 'dollarSpot', 'rust'];
        } else {
            // Cool-season defaults
            diseases = ['dollarSpot', 'brownPatch', 'pythium', 'grayLeafSpot'];
        }
        
        const diseaseLabels = {
            'redThread': 'Red Thread',
            'fusarium': 'Fusarium Patch',
            'takeAll': 'Take-All Patch',
            'dollarSpot': 'Dollar Spot',
            'brownPatch': 'Brown Patch',
            'pythium': 'Pythium',
            'grayLeafSpot': 'Gray Leaf Spot',
            'springDeadSpot': 'Spring Dead Spot',
            'largePatch': 'Large Patch',
            'largePathBrownPatch': 'Large Patch',
            'rust': 'Rust',
            'rustZoysia': 'Rust'
        };
        
        let hasData = false;
        let html = `
            <div class="gaip-disease-resistance" style="margin-bottom: 1rem;">
                <div style="font-weight: 600; font-size: 0.9rem; color: var(--gaip-text); margin-bottom: 0.5rem;">Disease Resistance</div>
                <div style="display: flex; flex-wrap: wrap; gap: 0.5rem;">
        `;
        
        for (const disease of diseases) {
            const mod = VT.getDiseaseModifier(species, variety, disease, region);
            if (mod.confidence !== 'none') {
                hasData = true;
                const risk = mod.riskMultiplier || 1.0;
                const color = risk < 0.9 ? '#22c55e' : risk > 1.1 ? '#ef4444' : '#f59e0b';
                const label = risk < 0.9 ? 'Resistant' : risk > 1.1 ? 'Susceptible' : 'Moderate';
                
                html += `
                    <div style="background: ${color}15; border: 1px solid ${color}40; padding: 0.4rem 0.75rem; border-radius: 6px;">
                        <span style="font-size: 0.8rem; color: var(--gaip-text);">${diseaseLabels[disease] || disease}</span>
                        <span style="font-size: 0.75rem; color: ${color}; margin-left: 0.5rem; font-weight: 600;">${label}</span>
                    </div>
                `;
            }
        }
        
        if (!hasData) {
            html += `<div style="color: var(--gaip-text); font-size: 0.85rem; font-style: italic;">No disease resistance data available for this region.</div>`;
        }
        
        html += `</div></div>`;
        return html;
    }
    
    /**
     * Render blend composition
     */
    function renderBlendComposition(traits) {
        if (!traits?.components) return '';
        
        let html = `
            <div class="gaip-blend-composition" style="margin-bottom: 1rem; background: var(--gaip-info-bg); padding: 0.75rem; border-radius: 8px;">
                <div style="font-weight: 600; font-size: 0.9rem; color: #1e40af; margin-bottom: 0.5rem;">
                    Blend Composition
                    ${traits._supplier ? `<span style="font-weight: 400; color: #3b82f6;"> — ${traits._supplier}</span>` : ''}
                </div>
                <div style="display: flex; flex-wrap: wrap; gap: 0.5rem;">
        `;
        
        for (const comp of traits.components) {
            html += `
                <div style="background: var(--gaip-surface); padding: 0.4rem 0.75rem; border-radius: 4px; font-size: 0.85rem;">
                    <span style="color: var(--gaip-text);">${comp.cultivar || comp.name}</span>
                    ${comp.percentage ? `<span style="color: var(--gaip-text); margin-left: 0.25rem;">${comp.percentage}%</span>` : ''}
                </div>
            `;
        }
        
        html += `</div></div>`;
        return html;
    }
    
    /**
     * Render data availability note
     */
    function renderDataAvailabilityNote(region, wear, water, cold, heat, shade) {
        const available = [];
        const noData = [];
        
        if (wear.confidence !== 'none') available.push('Wear'); else noData.push('Wear');
        if (water.confidence !== 'none') available.push('Water Use'); else noData.push('Water Use');
        if (cold.confidence !== 'none') available.push('Cold'); else noData.push('Cold');
        if (heat.confidence !== 'none') available.push('Heat/Drought'); else noData.push('Heat/Drought');
        if (shade && shade.confidence !== 'none') available.push('Shade'); else noData.push('Shade');
        
        if (noData.length === 0) return '';
        
        const regionNotes = {
            'bspb': 'UK trials focus on wear, recovery, and disease resistance. Heat/drought/cold tolerance less relevant for UK climate.',
            'scanturf': 'Nordic trials focus on winter hardiness and wear. Heat/drought tolerance less relevant.',
            'geves': 'French trials focus on wear tolerance.',
            'ntep': ''
        };
        
        return `
            <div style="margin-top: 0.75rem; padding: 0.75rem; background: var(--gaip-warning-bg); border-radius: 6px; border-left: 3px solid #eab308;">
                <div style="font-size: 0.8rem; color: #854d0e;">
                    <strong>Data Note:</strong> No trial data available for ${noData.join(', ')}.
                    ${regionNotes[region] ? `<br><em>${regionNotes[region]}</em>` : ''}
                </div>
            </div>
        `;
    }
    
    // Utility functions
    function formatModifier(multiplier, lowerIsBetter, traitType) {
        if (multiplier === 1.0) return 'Average';
        const pct = Math.round((1 - multiplier) * 100);
        
        // Trait-specific wording
        if (traitType === 'wear') {
            return pct > 0 ? `${pct}% less wear damage vs generic` : `${Math.abs(pct)}% more wear damage vs generic`;
        }
        if (traitType === 'water') {
            return pct > 0 ? `${pct}% less water required vs generic` : `${Math.abs(pct)}% more water required vs generic`;
        }
        if (traitType === 'recovery') {
            return pct > 0 ? `${pct}% faster recovery vs generic` : `${Math.abs(pct)}% slower recovery vs generic`;
        }
        if (traitType === 'drought') {
            return pct > 0 ? `${pct}% less drought stress vs generic` : `${Math.abs(pct)}% more drought stress vs generic`;
        }
        
        // Generic fallback
        if (lowerIsBetter) {
            return pct > 0 ? `${pct}% better than generic` : `${Math.abs(pct)}% worse than generic`;
        }
        return pct > 0 ? `−${pct}%` : `+${Math.abs(pct)}%`;
    }
    
    function getRatingColor(value) {
        if (value >= 7.5) return '#22c55e';
        if (value >= 6.0) return '#84cc16';
        if (value >= 5.0) return '#f59e0b';
        return '#ef4444';
    }
    
    function getRatingDescription(value) {
        if (value >= 8.0) return 'Excellent';
        if (value >= 7.0) return 'Very Good';
        if (value >= 6.0) return 'Good';
        if (value >= 5.0) return 'Average';
        return 'Below Average';
    }
    
    function truncate(str, len) {
        if (!str) return '';
        return str.length > len ? str.substring(0, len) + '...' : str;
    }
    
    // Event listeners
    document.addEventListener('DOMContentLoaded', function() {
        // Initial render if variety already selected
        setTimeout(renderCultivarProfile, 500);
        
        // Re-render on variety change
        const varietySelect = document.querySelector('.gaip-variety');
        if (varietySelect) {
            varietySelect.addEventListener('change', function() {
                setTimeout(renderCultivarProfile, 100);
            });
        }
        
        // Re-render on species change
        const speciesSelect = document.querySelector('.gaip-species');
        if (speciesSelect) {
            speciesSelect.addEventListener('change', function() {
                setTimeout(renderCultivarProfile, 200);
            });
        }
        
        // Re-render after analysis runs
        document.addEventListener('gaip:hub-state-update', function() {
            setTimeout(renderCultivarProfile, 100);
        });
        
        // Re-render when turf profile changes (ensures we pick up species switch before analysis)
        document.addEventListener('gaip:turf-profile-update', function(e) {
            // Use longer delay to ensure overseed state has been cleared
            setTimeout(renderCultivarProfile, 150);
        });
        
        // Also listen for overseed fraction updates
        document.addEventListener('gaip:overseed-fraction-update', function(e) {
            setTimeout(renderCultivarProfile, 50);
        });
    });
    
    // Export
    window.GAIP_CultivarProfileUI = {
        render: renderCultivarProfile,
        version: '1.4.1'
    };
    
    
})();
