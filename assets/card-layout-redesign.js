/**
 * =============================================================================
 * GILBA CARD LAYOUT REDESIGN v1.3.0 (b35fix358)
 * =============================================================================
 *
 * Phase 3 of UI redesign: Progressive disclosure card layout.
 *
 * What this does:
 *   1. Collapses input cards by default (they're "set and forget")
 *   2. Makes results section visible immediately with skeleton placeholders
 *   3. Wraps result blocks in collapsible cards grouped by category
 *   4. Adds "Inputs" accordion at bottom for editing lab data
 *
 * b35fix358 changes:
 *   - "Input Data" header renamed to "Inputs" (parallel to Run/Reports tab labels)
 *   - 📝 emoji icon dropped (consistency with text-only top-bar nav)
 *   - Dashed warning-coloured border on the header until inputs are entered
 *   - "Setup required" badge shown until first input data lands; CSS-driven
 *     toggle via .has-data class added by updateInputsSetupState()
 *   - Setup state read from GAIP_STATE.soil.ppm / .water / .tissue / .pgr;
 *     refreshed on gaip:analysis-complete, gaip:hub-state-update, gaip:site-changed
 *
 * Architecture:
 *   - Pure DOM restructuring — no PHP changes needed
 *   - All existing module .gaip-result-body elements stay in place
 *   - JS engines still write to the same selectors
 *   - CSS overlay on top of existing hub.css
 *
 * Dependencies: daily-dashboard.js, hub-persistence.js, auto-refresh.js
 * @version 1.3.0
 * =============================================================================
 */

(function() {
    'use strict';

    var VERSION = '1.3.0';

    function log(msg, data) {
        if (data !== undefined) {
        } else {
        }
    }

    // =========================================================================
    // RESULT CARD DEFINITIONS
    // =========================================================================
    // Maps the existing result blocks (data-section) into collapsible card groups.
    // Order here determines display order.

    var RESULT_GROUPS = [
        {
            id: 'disease-risk',
            title: 'Disease Risk',
            icon: '🦠',
            color: '#ef4444',
            sections: ['disease'],
            priority: 'climate',   // climate-driven = shows skeleton on load
            defaultOpen: true
        },
        {
            id: 'climate-analysis',
            title: 'Climate & Weather',
            icon: '🌤️',
            color: '#0ea5e9',
            sections: ['climate', 'dew'],
            priority: 'climate',
            defaultOpen: true
        },
        {
            id: 'growth-conditions',
            title: 'Growth & Light',
            icon: '🌱',
            color: '#8b5cf6',
            sections: ['growth', 'shade'],
            priority: 'climate',
            defaultOpen: true
        },
        {
            id: 'pgr-irrigation',
            title: 'PGR & Irrigation',
            icon: '💧',
            color: '#7c3aed',
            sections: ['pgr', 'sensor', 'irrigation'],
            priority: 'climate',
            defaultOpen: true
        },
        {
            id: 'lab-results',
            title: 'Soil, Water & Tissue Analysis',
            icon: '🧪',
            color: '#3b82f6',
            sections: ['mlsn', 'nutrient-demand', 'tissue', 'water'],
            priority: 'lab',
            defaultOpen: true,
            fullwidth: true
        },
        {
            id: 'nutrition-program',
            title: 'Nutrition Program',
            icon: '📅',
            color: '#16a34a',
            sections: ['nutrition-program'],
            priority: 'lab',
            defaultOpen: true,
            fullwidth: true
        },
        {
            id: 'performance-wear',
            title: 'Performance & Wear',
            icon: '🏟️',
            color: '#10b981',
            sections: ['traffic'],
            priority: 'climate',
            defaultOpen: false
        },
        {
            id: 'planning-tools',
            title: 'Planning Tools',
            icon: '📋',
            color: '#f59e0b',
            sections: ['seasonal', 'calendar', 'pests'],
            priority: 'lab',
            defaultOpen: false
        },
        {
            id: 'cultivar-profile',
            title: 'Cultivar Performance',
            icon: '🌾',
            color: '#78716c',
            sections: ['cultivar'],
            priority: 'lab',
            defaultOpen: true
        }
    ];

    // =========================================================================
    // CSS INJECTION
    // =========================================================================

    function injectStyles() {
        if (document.getElementById('gaip-card-layout-styles')) return;

        var style = document.createElement('style');
        style.id = 'gaip-card-layout-styles';
        style.textContent = [
            '/* ============================================ */',
            '/* PHASE 3: CARD LAYOUT REDESIGN               */',
            '/* ============================================ */',
            '',
            '/* Hide old section dividers (colored h3 bars) */',
            '.gaip-results > div[style*="border-bottom: 2px"] { display: none !important; }',
            '.gaip-results > h3 { display: none !important; }',
            '',
            '/* Result cards container */',
            '.gaip-result-cards {',
            '  display: grid;',
            '  grid-template-columns: 1fr 1fr;',
            '  gap: 16px;',
            '  margin-bottom: 20px;',
            '}',
            '',
            '@media (max-width: 900px) {',
            '  .gaip-result-cards {',
            '    grid-template-columns: 1fr;',
            '  }',
            '}',
            '',
            '/* Individual result card */',
            '.gaip-rc {',
            '  background: var(--gaip-surface);',
            '  border: 1px solid var(--gaip-border);',
            '  border-radius: 10px;',
            '  overflow: hidden;',
            '  transition: box-shadow 0.2s;',
            '}',
            '',
            '.gaip-rc:hover {',
            '  box-shadow: 0 2px 12px rgba(0,0,0,0.06);',
            '}',
            '',
            '/* Card header */',
            '.gaip-rc-header {',
            '  display: flex;',
            '  align-items: center;',
            '  gap: 10px;',
            '  padding: 12px 16px;',
            '  cursor: pointer;',
            '  user-select: none;',
            '  background: var(--gaip-surface-muted);',
            '  border-bottom: 1px solid var(--gaip-border);',
            '  transition: background 0.15s;',
            '}',
            '',
            '.gaip-rc-header:hover {',
            '  background: var(--gaip-surface-hover);',
            '}',
            '',
            '.gaip-rc-color-bar {',
            '  width: 4px;',
            '  height: 24px;',
            '  border-radius: 2px;',
            '  flex-shrink: 0;',
            '}',
            '',
            '.gaip-rc-icon {',
            '  font-size: 16px;',
            '  flex-shrink: 0;',
            '}',
            '',
            '.gaip-rc-title {',
            '  font-size: 14px;',
            '  font-weight: 600;',
            '  color: var(--gaip-text);',
            '  flex: 1;',
            '}',
            '',
            '.gaip-rc-status {',
            '  font-size: 11px;',
            '  padding: 2px 8px;',
            '  border-radius: 10px;',
            '  font-weight: 500;',
            '  white-space: nowrap;',
            '}',
            '',
            '.gaip-rc-toggle {',
            '  font-size: 14px;',
            '  color: var(--gaip-text-muted);',
            '  transition: transform 0.2s;',
            '}',
            '',
            '.gaip-rc.collapsed .gaip-rc-toggle {',
            '  transform: rotate(-90deg);',
            '}',
            '',
            '/* Card body */',
            '.gaip-rc-body {',
            '  padding: 0;',
            '  overflow: visible;',
            '}',
            '',
            '.gaip-rc.collapsed .gaip-rc-body {',
            '  display: none;',
            '}',
            '',
            '/* Skeleton placeholder */',
            '.gaip-rc-skeleton {',
            '  padding: 20px 16px;',
            '  text-align: center;',
            '  color: var(--gaip-text-muted);',
            '  font-size: 13px;',
            '}',
            '',
            '.gaip-rc-skeleton-bar {',
            '  height: 12px;',
            '  background: linear-gradient(90deg, var(--gaip-surface-hover) 25%, var(--gaip-border) 50%, var(--gaip-surface-hover) 75%);',
            '  background-size: 200% 100%;',
            '  animation: gaip-shimmer 1.5s infinite;',
            '  border-radius: 6px;',
            '  margin: 8px 0;',
            '}',
            '',
            '.gaip-rc-skeleton-bar:nth-child(2) { width: 75%; }',
            '.gaip-rc-skeleton-bar:nth-child(3) { width: 50%; }',
            '',
            '@keyframes gaip-shimmer {',
            '  0% { background-position: 200% 0; }',
            '  100% { background-position: -200% 0; }',
            '}',
            '',
            '/* Hide original result blocks, they get moved into cards */',
            '.gaip-results .gaip-result-block { display: none; }',
            '',
            '/* But show them when inside a result card */',
            '.gaip-rc .gaip-result-block { display: block !important; }',
            '',
            '/* Hide the old climate banner (now inside a card) */',
            '.gaip-results > #gaip-climate-status-banner { display: none !important; }',
            '',
            '/* ============================================ */',
            '/* INPUT CARDS: COLLAPSED BY DEFAULT            */',
            '/* b35fix358: dashed border + Setup required    */',
            '/* badge until inputs entered                   */',
            '/* ============================================ */',
            '',
            '/* Input section wrapper */',
            '.gaip-inputs-section {',
            '  margin-top: 16px;',
            '}',
            '',
            '.gaip-inputs-header {',
            '  display: flex;',
            '  align-items: center;',
            '  gap: 12px;',
            '  padding: 16px 20px;',
            '  background: var(--gaip-surface-muted);',
            '  border: 2px dashed var(--gaip-warning, #f59e0b);',
            '  border-radius: 10px;',
            '  cursor: pointer;',
            '  user-select: none;',
            '  transition: background 0.15s, border 0.15s;',
            '}',
            '',
            '.gaip-inputs-header:hover {',
            '  background: var(--gaip-surface-hover);',
            '}',
            '',
            '/* Once inputs have been entered, switch to solid border in neutral tone */',
            '.gaip-inputs-section.has-data .gaip-inputs-header {',
            '  border: 1px solid var(--gaip-border);',
            '}',
            '',
            '.gaip-inputs-title {',
            '  font-size: 16px;',
            '  font-weight: 600;',
            '  color: var(--gaip-text);',
            '  flex: 0 0 auto;',
            '}',
            '',
            '.gaip-inputs-setup-badge {',
            '  display: inline-flex;',
            '  align-items: center;',
            '  padding: 4px 10px;',
            '  border-radius: 999px;',
            '  background: var(--gaip-warning-bg, rgba(245, 158, 11, 0.15));',
            '  color: var(--gaip-warning, #f59e0b);',
            '  font-size: 11px;',
            '  font-weight: 700;',
            '  letter-spacing: 0.04em;',
            '  text-transform: uppercase;',
            '}',
            '.gaip-inputs-section.has-data .gaip-inputs-setup-badge {',
            '  display: none;',
            '}',
            '',
            '.gaip-inputs-hint {',
            '  font-size: 12px;',
            '  color: var(--gaip-text-muted);',
            '  flex: 1 1 auto;',
            '  text-align: right;',
            '}',
            '',
            '.gaip-inputs-toggle {',
            '  font-size: 14px;',
            '  color: var(--gaip-text-muted);',
            '  transition: transform 0.2s;',
            '  flex: 0 0 auto;',
            '}',
            '',
            '.gaip-inputs-section.collapsed .gaip-inputs-toggle {',
            '  transform: rotate(-90deg);',
            '}',
            '',
            '.gaip-inputs-section.collapsed .gaip-grid {',
            '  display: none;',
            '}',
            '',
            '/* When inputs are showing, restore the grid */',
            '.gaip-inputs-section .gaip-grid {',
            '  margin-top: 12px;',
            '  border-radius: 10px;',
            '  border: 1px solid var(--gaip-border);',
            '  padding: 12px;',
            '  background: var(--gaip-surface);',
            '  display: grid;',
            '  grid-template-columns: repeat(2, 1fr);',
            '  gap: 16px;',
            '}',
            '',
            '/* Turf profile always full width */',
            '.gaip-inputs-section .gaip-turf-profile-card {',
            '  grid-column: 1 / -1;',
            '}',
            '',
            '@media (max-width: 900px) {',
            '  .gaip-inputs-section .gaip-grid {',
            '    grid-template-columns: 1fr;',
            '  }',
            '}',
            '',
            '/* Results section visible by default (override display:none) */',
            '.gaip-results.gaip-results-active {',
            '  display: block !important;',
            '}',
            '',
            '/* Fullwidth cards */',
            '.gaip-rc.gaip-rc-fullwidth {',
            '  grid-column: 1 / -1;',
            '}',
            '',
            '/* Nutrition calendar table: prevent overflow, allow horizontal scroll */',
            '.gaip-rc .gaip-nutrition-calendar-module {',
            '  overflow-x: auto;',
            '}',
            '.gaip-rc .gaip-nutrition-calendar-module table {',
            '  width: 100%;',
            '  table-layout: auto;',
            '  font-size: 13px;',
            '}',
            '.gaip-rc .gaip-nutrition-calendar-module td,',
            '.gaip-rc .gaip-nutrition-calendar-module th {',
            '  white-space: nowrap;',
            '  padding: 6px 8px;',
            '}',
            ''
        ].join('\n');

        document.head.appendChild(style);
        log('Styles injected');
    }

    // =========================================================================
    // SKELETON BUILDER
    // =========================================================================

    function buildSkeleton(group) {
        return '<div class="gaip-rc-skeleton">' +
            '<div class="gaip-rc-skeleton-bar"></div>' +
            '<div class="gaip-rc-skeleton-bar"></div>' +
            '<div class="gaip-rc-skeleton-bar"></div>' +
            '<div style="margin-top: 8px; font-size: 12px; color: var(--gaip-border);">Analysing...</div>' +
        '</div>';
    }

    // =========================================================================
    // RESULT CARD BUILDER
    // =========================================================================

    function buildResultCard(group) {
        var card = document.createElement('div');
        card.className = 'gaip-rc' + (group.defaultOpen ? '' : ' collapsed');
        if (group.fullwidth) card.classList.add('gaip-rc-fullwidth');
        card.id = 'gaip-rc-' + group.id;
        card.setAttribute('data-group', group.id);

        // Header
        var header = document.createElement('div');
        header.className = 'gaip-rc-header';
        header.innerHTML =
            '<div class="gaip-rc-color-bar" style="background: ' + group.color + ';"></div>' +
            '<span class="gaip-rc-icon">' + group.icon + '</span>' +
            '<span class="gaip-rc-title">' + group.title + '</span>' +
            '<span class="gaip-rc-status" id="gaip-rc-status-' + group.id + '"></span>' +
            '<span class="gaip-rc-toggle">▼</span>';

        header.addEventListener('click', function() {
            card.classList.toggle('collapsed');
        });

        // Body
        var body = document.createElement('div');
        body.className = 'gaip-rc-body';
        body.id = 'gaip-rc-body-' + group.id;

        // Initially show skeleton
        body.innerHTML = buildSkeleton(group);

        card.appendChild(header);
        card.appendChild(body);

        return card;
    }

    // =========================================================================
    // MOVE RESULT BLOCKS INTO CARDS
    // =========================================================================

    /**
     * Move existing .gaip-result-block elements from .gaip-results
     * into the appropriate result card body.
     * Safe to call multiple times — skips blocks already moved.
     */
    function moveResultBlocks(resultsContainer) {
        var moved = 0;

        RESULT_GROUPS.forEach(function(group) {
            var cardBody = document.getElementById('gaip-rc-body-' + group.id);
            if (!cardBody) return;

            var hasContent = false;

            group.sections.forEach(function(sectionId) {
                // Look in the results container (original position)
                var block = resultsContainer.querySelector(':scope > .gaip-result-block[data-section="' + sectionId + '"]');
                if (!block) {
                    block = resultsContainer.querySelector(':scope > #gaip-' + sectionId + '-section');
                }
                // Also check if block is inside old section divider wrappers (not direct child)
                if (!block) {
                    block = resultsContainer.querySelector('.gaip-result-block[data-section="' + sectionId + '"]');
                    // Skip if already inside a result card
                    if (block && block.closest('.gaip-rc')) {
                        // Block already in card — still mark hasContent
                        hasContent = true;
                        block = null;
                    }
                }
                if (block) {
                    cardBody.appendChild(block);
                    hasContent = true;
                    moved++;
                }
            });

            // Remove skeleton if result block bodies have actual rendered content.
            // This works both when blocks are freshly moved AND when they were
            // moved earlier and have since been populated by analysis.
            if (hasContent) {
                var hasRenderedContent = false;
                var bodies = cardBody.querySelectorAll('.gaip-result-body');
                bodies.forEach(function(b) {
                    if (b.children.length > 0 || b.textContent.trim().length > 10) {
                        hasRenderedContent = true;
                    }
                });
                if (hasRenderedContent) {
                    var skeleton = cardBody.querySelector('.gaip-rc-skeleton');
                    if (skeleton) skeleton.remove();
                }
            }
        });

        // Move the climate status banner into the climate card
        var climateBanner = resultsContainer.querySelector('#gaip-climate-status-banner');
        var climateBody = document.getElementById('gaip-rc-body-climate-analysis');
        if (climateBanner && climateBody && !climateBanner.closest('.gaip-rc')) {
            climateBody.insertBefore(climateBanner, climateBody.firstChild);
            climateBanner.style.display = '';
        }

        if (moved > 0) log('Moved ' + moved + ' result blocks into cards');

        // v1.2.0: Relocate the Unusual Values / Input Issues banner into the lab-results card
        relocateValidationBanner(resultsContainer);
    }

    // =========================================================================
    // VALIDATION BANNER RELOCATION
    // =========================================================================

    /**
     * Move the Unusual Values / Input Issues banner from the top of .gaip-results
     * into the lab-results card where it contextually belongs.
     * Safe to call multiple times.
     */
    function relocateValidationBanner(resultsContainer) {
        var banner = resultsContainer.querySelector(':scope > .gaip-validation-banner');
        if (!banner) {
            // Also check if it's at the top of .gaip-result-cards (validator might inject after restructuring)
            var cards = resultsContainer.querySelector('.gaip-result-cards');
            if (cards) {
                banner = cards.previousElementSibling;
                if (!banner || !banner.classList || !banner.classList.contains('gaip-validation-banner')) {
                    banner = null;
                }
            }
        }
        if (!banner) return;

        // Already inside a result card? Skip
        if (banner.closest('.gaip-rc')) return;

        var labBody = document.getElementById('gaip-rc-body-lab-results');
        if (!labBody) return;

        // Insert at the top of the lab-results card body
        labBody.insertBefore(banner, labBody.firstChild);
        log('Validation banner moved into lab-results card');
    }

    // =========================================================================
    // INPUT CARDS RESTRUCTURING
    // =========================================================================

    /**
     * Wrap the .gaip-grid (input cards) in a collapsible "Inputs" section.
     * Collapse by default for returning users.
     * IMPORTANT: Must run AFTER dashboard has initialized (dashboard inserts
     * itself before .gaip-grid as a direct child of #gaip-hub).
     */
    function restructureInputCards(hub) {
        var grid = hub.querySelector('.gaip-grid');
        if (!grid) return;

        // Skip if already restructured
        if (hub.querySelector('.gaip-inputs-section')) return;

        // Create wrapper
        var wrapper = document.createElement('div');
        wrapper.className = 'gaip-inputs-section collapsed';

        // Create header
        // b35fix358: rename Input Data → Inputs; drop emoji icon; add Setup
        // required badge that hides via CSS when wrapper has 'has-data' class.
        var header = document.createElement('div');
        header.className = 'gaip-inputs-header';
        header.innerHTML =
            '<span class="gaip-inputs-title">Inputs</span>' +
            '<span class="gaip-inputs-setup-badge">Setup required</span>' +
            '<span class="gaip-inputs-hint">Soil, water, tissue, PGR, traffic settings</span>' +
            '<span class="gaip-inputs-toggle">▼</span>';

        header.addEventListener('click', function() {
            wrapper.classList.toggle('collapsed');
        });

        // Insert wrapper where grid currently sits.
        // grid is a direct child of #gaip-hub at this point (dashboard sits before it).
        grid.parentNode.insertBefore(wrapper, grid);
        wrapper.appendChild(header);
        wrapper.appendChild(grid);

        log('Input cards wrapped in collapsible section');
    }

    // =========================================================================
    // RESULTS SECTION: MAKE VISIBLE WITH CARDS
    // =========================================================================

    function restructureResults(hub) {
        var results = hub.querySelector('.gaip-results');
        if (!results) {
            // Fallback: try document-level query
            results = document.querySelector('.gaip-results');
            if (results) {
                log('Found .gaip-results via document fallback (not direct child of hub)');
            }
        }
        if (!results) {
            log('WARNING: .gaip-results not found, result cards cannot be created');
            return;
        }

        // Skip if already restructured
        if (results.querySelector('.gaip-result-cards')) {
            log('Results already restructured, skipping');
            return;
        }

        // Make results visible immediately
        results.classList.add('gaip-results-active');

        // Create cards container
        var cardsContainer = document.createElement('div');
        cardsContainer.className = 'gaip-result-cards';

        // Build result cards
        RESULT_GROUPS.forEach(function(group) {
            var card = buildResultCard(group);
            cardsContainer.appendChild(card);
        });

        // Insert cards container at top of results (before existing content)
        results.insertBefore(cardsContainer, results.firstChild);

        // Move existing result blocks into cards immediately.
        // On first load they'll be empty (skeletons stay visible).
        // When analysis runs and populates them, skeletons get removed.
        moveResultBlocks(results);

        log('Results restructured into ' + RESULT_GROUPS.length + ' cards');
    }

    // =========================================================================
    // STATUS BADGES
    // =========================================================================

    /**
     * Update the status badge on a result card based on analysis results.
     * Called after analysis completes.
     */
    function updateCardStatuses() {
        // Disease risk
        var diseaseResult = window.GAIP_DISEASE_RESULT;
        if (diseaseResult) {
            var risk = diseaseResult.overallRisk || 'unknown';
            setCardStatus('disease-risk', risk, getRiskColor(risk));
        }

        // Growth potential
        var climateMetrics = window.climateMetrics;
        if (climateMetrics && climateMetrics.growth) {
            var gp = Math.round(climateMetrics.growth.c3GrowthPercent || climateMetrics.growth.potential || 0);
            setCardStatus('growth-conditions', gp + '% GP', gp > 70 ? '#10b981' : gp > 40 ? '#f59e0b' : '#ef4444');
        }

        // Shade
        var shadeResult = window.GAIP_SHADE_RESULT;
        if (shadeResult) {
            var shadeStatus = shadeResult.effectiveStatus || shadeResult.status || '';
            if (shadeStatus) {
                setCardStatus('growth-conditions',
                    shadeStatus.charAt(0).toUpperCase() + shadeStatus.slice(1),
                    shadeStatus === 'optimal' ? '#10b981' : shadeStatus === 'marginal' ? '#f59e0b' : '#ef4444'
                );
            }
        }

        // PGR
        var pgrResult = window.GAIP_PGR_RESULT;
        if (pgrResult && pgrResult.effect) {
            var suppression = Math.round(pgrResult.effect.currentSuppressionPct || 0);
            setCardStatus('pgr-irrigation',
                suppression > 0 ? suppression + '% suppression' : 'Inactive',
                suppression > 20 ? '#7c3aed' : 'var(--gaip-text-muted)'
            );
        }

        // Lab results (soil + tissue + water)
        var state = window.GAIP_STATE;
        if (state && state.soil && state.soil.ppm) {
            var hasSoilData = Object.values(state.soil.ppm).some(function(v) { return v > 0; });
            if (hasSoilData) {
                setCardStatus('lab-results', 'Data loaded', '#3b82f6');
            }
        }

        log('Card statuses updated');
    }

    function setCardStatus(groupId, text, bgColor) {
        var el = document.getElementById('gaip-rc-status-' + groupId);
        if (!el) return;
        el.textContent = text;
        el.style.background = bgColor + '18';
        el.style.color = bgColor;
    }

    function getRiskColor(risk) {
        switch (risk) {
            case 'low': return '#10b981';
            case 'moderate': return '#f59e0b';
            case 'high': return '#ef4444';
            case 'critical': return '#dc2626';
            default: return 'var(--gaip-text-muted)';
        }
    }

    // =========================================================================
    // REMOVE SKELETONS AFTER ANALYSIS
    // =========================================================================

    function removeSkeletons() {
        var skeletons = document.querySelectorAll('.gaip-rc-skeleton');
        skeletons.forEach(function(s) { s.remove(); });
    }

    // =========================================================================
    // INPUTS SETUP STATE — b35fix358
    // =========================================================================

    /**
     * Toggle the .has-data class on the Inputs section wrapper.
     * When present, the dashed warning border switches to the neutral
     * solid border and the "Setup required" badge is hidden via CSS.
     *
     * Setup is considered complete when ANY of the following hold:
     *   - state.soil.ppm has at least one positive numeric reading
     *   - state.water has any positive numeric reading
     *   - state.tissue has any positive numeric reading
     *   - state.pgr has been entered (any non-falsy product field)
     *
     * Read-only — never mutates state.
     */
    function updateInputsSetupState() {
        var section = document.querySelector('.gaip-inputs-section');
        if (!section) return;

        var hasData = false;
        var state = window.GAIP_STATE;

        if (state) {
            // Soil ppm — primary signal, same check as updateCardStatuses
            if (state.soil && state.soil.ppm) {
                try {
                    hasData = Object.values(state.soil.ppm).some(function(v) {
                        return typeof v === 'number' && v > 0;
                    });
                } catch (e) { /* defensive */ }
            }
            // Water — any numeric reading
            if (!hasData && state.water) {
                try {
                    hasData = Object.values(state.water).some(function(v) {
                        return typeof v === 'number' && v > 0;
                    });
                } catch (e) { /* defensive */ }
            }
            // Tissue — any numeric reading
            if (!hasData && state.tissue) {
                try {
                    hasData = Object.values(state.tissue).some(function(v) {
                        return typeof v === 'number' && v > 0;
                    });
                } catch (e) { /* defensive */ }
            }
            // PGR — any product field set
            if (!hasData && state.pgr) {
                try {
                    hasData = Object.values(state.pgr).some(function(v) {
                        return v != null && v !== '' && v !== 0;
                    });
                } catch (e) { /* defensive */ }
            }
        }

        section.classList.toggle('has-data', hasData);
    }

    // =========================================================================
    // INIT
    // =========================================================================

    function init() {
        var hub = document.getElementById('gaip-hub');
        if (!hub) {
            log('Hub element not found, deferring');
            setTimeout(init, 500);
            return;
        }

        // CRITICAL: Wait for dashboard to initialize first.
        // Dashboard inserts itself before .gaip-grid using hub.insertBefore().
        // If we restructure the grid before that, dashboard can't find its
        // insertion point and crashes.
        var dashboard = document.getElementById('gaip-daily-dashboard');
        if (!dashboard) {
            log('Dashboard not initialized yet, deferring 500ms');
            setTimeout(init, 500);
            return;
        }

        log('Initializing v' + VERSION);

        // Inject CSS
        injectStyles();

        // Restructure results into cards (with skeletons)
        restructureResults(hub);

        // Wrap input cards in collapsible section
        restructureInputCards(hub);

        // Listen for analysis completion
        document.addEventListener('gaip:analysis-complete', function() {
            log('Analysis complete, moving blocks and updating statuses');
            var results = hub.querySelector('.gaip-results') || document.querySelector('.gaip-results');
            if (results) {
                moveResultBlocks(results);
                // v1.2.0: Relocate validation banner (validator re-injects after analysis)
                setTimeout(function() { relocateValidationBanner(results); }, 500);
            }
            // Always remove skeletons after analysis (uses document.querySelectorAll)
            removeSkeletons();
            setTimeout(updateCardStatuses, 400);
            // b35fix358: refresh Inputs setup-required badge state
            setTimeout(updateInputsSetupState, 400);
        });

        // Also watch for cascade completion (orchestrator)
        document.addEventListener('gaip:hub-state-update', function() {
            setTimeout(updateCardStatuses, 500);
            setTimeout(updateInputsSetupState, 500);
        });

        // b35fix358: site-switch resets input-data context
        document.addEventListener('gaip:site-changed', function() {
            setTimeout(updateInputsSetupState, 600);
        });

        // b35fix358: initial pass once any prior persisted state has restored
        setTimeout(updateInputsSetupState, 800);

        log('Ready');
    }

    // =========================================================================
    // PUBLIC API
    // =========================================================================

    window.GilbaCardLayout = {
        version: VERSION,
        expandInputs: function() {
            var section = document.querySelector('.gaip-inputs-section');
            if (section) section.classList.remove('collapsed');
        },
        collapseInputs: function() {
            var section = document.querySelector('.gaip-inputs-section');
            if (section) section.classList.add('collapsed');
        },
        expandCard: function(groupId) {
            var card = document.getElementById('gaip-rc-' + groupId);
            if (card) card.classList.remove('collapsed');
        },
        collapseCard: function(groupId) {
            var card = document.getElementById('gaip-rc-' + groupId);
            if (card) card.classList.add('collapsed');
        }
    };

    // =========================================================================
    // BOOTSTRAP
    // =========================================================================

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function() {
            setTimeout(init, 300);
        });
    } else {
        setTimeout(init, 300);
    }

})();
