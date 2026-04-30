// Agro→Stadium tab nav shim: expose GilbaTabNav as GSSH_TabNavigation
// so stadium-tab-ui.js registerTabs() finds the host tab navigator.
(function() {
    if (window.GilbaTabNav && !window.GSSH_TabNavigation) {
        window.GSSH_TabNavigation = window.GilbaTabNav;
    }
})();

/**
 * =============================================================================
 * GSSH STADIUM TAB UI v1.0.0
 * =============================================================================
 * 
 * Integrates Stadium Light functionality as tabs within the Stadium Shade Hub.
 * Replaces the standalone shortcode model with in-hub tabs:
 *   - Stadium Overview (venue selector + shade summary)
 *   - Shade Analysis (visualization + zone breakdown)
 *   - Rig Calculator (LED placement + cost)
 *   - Seasonal Planner (monthly lighting schedule)
 * 
 * @requires shade-orchestrator.js
 * @requires tab-navigation.js
 * =============================================================================
 */

(function(global) {
    'use strict';

    const StadiumTabUI = {

        version: '1.0.0',
        initialized: false,
        activeSubTab: 'overview',

        // =====================================================================
        // TAB REGISTRATION
        // =====================================================================

        /**
         * Register stadium tabs with the hub's tab navigation system
         */
        init: function() {
            if (this.initialized) return;

            this.registerTabs();
            this.setupEventListeners();
            this.initialized = true;

            console.log('[StadiumTabUI] Initialized v' + this.version);
        },

        registerTabs: function() {
            // The hub's tab navigation uses a tabConfig array
            // We inject our stadium tab into it
            const tabNav = global.GSSH_TabNavigation || global.gsshTabNavigation;

            if (tabNav && typeof tabNav.registerTab === 'function') {
                tabNav.registerTab({
                    id: 'stadium',
                    label: 'Stadium',
                    icon: '🏟️',
                    order: 15, // After dashboard (10), before soil (20)
                    render: this.renderStadiumSection.bind(this),
                    onActivate: this.onTabActivated.bind(this)
                });
            }

            // Always inject content HTML into the DOM
            this.injectTabFallback();
        },

        // Current venue state
        currentVenue: null,

        // =====================================================================
        // CLIMATE DATA FORWARDING
        // =====================================================================

        /**
         * Extract real solar radiation and DLI from the Hub's climate engine
         * and append to a request-like collector used by the local visualisers.
         *
         * Priority chain:
         *   1. climateMetrics.solar.dli  — already computed from Open-Meteo
         *      shortwave_radiation hourly integral (most accurate)
         *   2. rawWeatherData hourly shortwave_radiation — sum today's hours
         *      and convert: sum(W/m²) × 3600 / 1e6 × 4.6 × 0.45 = DLI mol/m²/day
         *   3. Nothing forwarded — PHP falls back to its own estimator
         *
         * Also forwards hub_temperature using the existing priority chain so
         * every handler gets consistent climate context in a single call.
         */
        appendHubClimateData: function(data) {
            // --- Solar / GHI / DLI ---
            var hubDLI = null;
            var hubGHI = null; // MJ/m²/day

            // Priority 1: climateMetrics.solar (already integrated by Hub)
            if (window.climateMetrics && window.climateMetrics.solar) {
                var sol = window.climateMetrics.solar;
                if (sol.dli != null)    hubDLI = sol.dli;
                if (sol.avgMJ != null)  hubGHI = sol.avgMJ;
            }

            // Priority 2: rawWeatherData hourly shortwave_radiation
            if (hubDLI === null && window.rawWeatherData) {
                var raw = window.rawWeatherData;
                var hourly = (raw.forecast && raw.forecast.hourly) ? raw.forecast.hourly : raw.hourly;
                if (hourly && hourly.shortwave_radiation && hourly.time) {
                    // Sum today's hours only
                    var todayStr = new Date().toISOString().slice(0, 10);
                    var swSum = 0, swCount = 0;
                    for (var i = 0; i < hourly.time.length; i++) {
                        if (hourly.time[i].slice(0, 10) === todayStr && hourly.shortwave_radiation[i] != null) {
                            swSum += hourly.shortwave_radiation[i];
                            swCount++;
                        }
                    }
                    if (swCount > 0) {
                        // W/m² hourly → MJ/m²/day: sum × 3600 / 1e6
                        var ghiMJ = swSum * 3600 / 1e6;
                        // MJ → DLI mol/m²/day: × 4.6 (PPFD factor) × 0.45 (PAR fraction)
                        hubDLI = Math.round(ghiMJ * 4.6 * 0.45 * 10) / 10;
                        hubGHI = Math.round(ghiMJ * 10) / 10;
                    }
                }
            }

            if (hubDLI !== null) data.append('hub_dli', hubDLI);
            if (hubGHI !== null) data.append('hub_ghi', hubGHI);

            // --- Temperature (existing logic, centralised here) ---
            var hubTemp = null;
            (function() {
                var raw = window.rawWeatherData;
                if (raw) {
                    var hourly = (raw.forecast && raw.forecast.hourly) ? raw.forecast.hourly : raw.hourly;
                    if (hourly && hourly.temperature_2m && hourly.time) {
                        var now = new Date().toISOString().slice(0, 13);
                        for (var i = hourly.time.length - 1; i >= 0; i--) {
                            if (hourly.time[i].slice(0, 13) <= now) {
                                hubTemp = hourly.temperature_2m[i];
                                break;
                            }
                        }
                    }
                }
                if (hubTemp === null && window.climateMetrics && window.climateMetrics.temperature) {
                    var cm = window.climateMetrics.temperature;
                    hubTemp = (cm.todayMean != null) ? cm.todayMean : (cm.mean != null ? cm.mean : null);
                }
            }());
            if (hubTemp !== null) data.append('hub_temperature', hubTemp);
        },

        setupEventListeners: function() {
            const self = this;

            // Suppress Hub header location pill on Stadium tab; restore on leave
            document.addEventListener('gaip:tab-change', function(e) {
                if (e.detail && e.detail.tab === 'stadium') {
                    self.suppressHubHeaderLocation();
                } else {
                    self.restoreHubHeaderLocation();
                }
            });

            // Shade orchestrator updates
            document.addEventListener('gssh:shadeOrchestratorComplete', function(e) {
                self.updateShadeDisplay(e.detail);
            });

            document.addEventListener('gssh:shadeAnalysisStarted', function(e) {
                self.showLoadingState(e.detail);
            });

            // Sub-tab navigation within stadium section
            document.addEventListener('click', function(e) {
                const btn = e.target.closest('.gssh-stadium-subtab-btn');
                if (btn) {
                    const tab = btn.dataset.subtab;
                    self.switchSubTab(tab);
                }
            });

            // Venue selection — trigger shade viz load
            document.addEventListener('gssh:venueSelect', function(e) {
                self.currentVenue = e.detail;
                self.updateVenueContextStrip(e.detail);
                self.loadShadeVisualization(e.detail.venue_id, 'series');
            });

            // Venue selector dropdown change — update currentVenue for shade mode buttons.
            // Do NOT call selectVenue here: bindVenueSelect() in unified-venue-selector.js
            // already handles the change event and dispatches gssh:venueSelect above.
            // Calling selectVenue a second time causes every selection to fire twice.
            document.addEventListener('change', function(e) {
                if (e.target && e.target.id === 'gssh-stadium-venue-select') {
                    const venueId = e.target.value;
                    if (venueId) {
                        const option = e.target.options[e.target.selectedIndex];
                        self.currentVenue = {
                            venue_id: venueId,
                            name: option.textContent
                        };
                    }
                }
            });

            // Shade mode buttons
            document.addEventListener('click', function(e) {
                const modeBtn = e.target.closest('.gssh-shade-mode-btn');
                if (modeBtn && self.currentVenue) {
                    document.querySelectorAll('.gssh-shade-mode-btn').forEach(function(b) {
                        b.classList.remove('active');
                    });
                    modeBtn.classList.add('active');
                    self.loadShadeVisualization(self.currentVenue.venue_id, modeBtn.dataset.mode);
                }
            });

            // Shade refresh/update button
            document.addEventListener('click', function(e) {
                if (e.target && e.target.id === 'gssh-shade-refresh-btn') {
                    if (self.currentVenue) {
                        var activeMode = document.querySelector('.gssh-shade-mode-btn.active');
                        var mode = activeMode ? activeMode.dataset.mode : 'series';
                        self.loadShadeVisualization(self.currentVenue.venue_id, mode);
                    }
                }
            });

            // Rig calculate button
            document.addEventListener('click', function(e) {
                if (e.target && e.target.id === 'gssh-rig-calculate-btn') {
                    self.loadRigCalculation();
                }
            });

            // Coverage slider — debounced auto-recalculate (800ms after user stops dragging)
            // IMPORTANT: capture the value immediately at event time — the slider value is
            // reset to 10% when loadRigCalculation replaces innerHTML, so we must not read
            // it inside the setTimeout or at fetch time.
            var _rigRecalcTimer = null;
            var _pendingCoveragePct = null;
            document.addEventListener('input', function(e) {
                if (e.target && e.target.id === 'gssh-coverage-slider') {
                    if (!self.currentVenue) return;
                    _pendingCoveragePct = parseFloat(e.target.value); // capture NOW
                    clearTimeout(_rigRecalcTimer);
                    // Show a subtle updating indicator while waiting
                    var rigResults = document.getElementById('gssh-rig-results');
                    if (rigResults && rigResults.innerHTML.trim()) {
                        var indicator = document.getElementById('gssh-rig-recalc-indicator');
                        if (!indicator) {
                            indicator = document.createElement('div');
                            indicator.id = 'gssh-rig-recalc-indicator';
                            indicator.style.cssText = 'position:sticky;top:0;background:rgba(59,130,246,0.08);' +
                                'border:1px solid var(--gaip-info-bg);border-radius:6px;padding:6px 12px;' +
                                'font-size:12px;color:#1d4ed8;text-align:center;margin-bottom:8px;';
                            indicator.textContent = '\u27F3 Updating projection…';
                            rigResults.insertBefore(indicator, rigResults.firstChild);
                        }
                    }
                    _rigRecalcTimer = setTimeout(function() {
                        var ind = document.getElementById('gssh-rig-recalc-indicator');
                        if (ind) ind.remove();
                        self.loadRigCalculation(_pendingCoveragePct);
                        _pendingCoveragePct = null;
                    }, 800);
                }
            });

            // Planner calculate button
            document.addEventListener('click', function(e) {
                if (e.target && e.target.id === 'gssh-planner-calculate-btn') {
                    self.loadSeasonalPlan();
                }
            });
        },

        // =====================================================================
        // TAB RENDERING
        // =====================================================================

        renderStadiumSection: function() {
            return `
                <style>
                /* Light theme overrides for stadium tab results */
                #gssh-stadium-tab-wrapper .gssh-stadium-card {
                    background: var(--gaip-surface);
                    border: 1px solid var(--gaip-border);
                    border-radius: 8px;
                    margin-bottom: 12px;
                }
                #gssh-stadium-tab-wrapper .gssh-card-header {
                    padding: 12px 16px;
                    border-bottom: 1px solid var(--gaip-border);
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    flex-wrap: wrap;
                    gap: 8px;
                }
                #gssh-stadium-tab-wrapper .gssh-card-header h3 {
                    margin: 0;
                    font-size: 15px;
                    color: var(--gaip-text);
                }
                #gssh-stadium-tab-wrapper .gssh-card-body {
                    padding: 16px;
                }
                /* Override dark-themed inline styles from rig visualiser */
                #gssh-rig-results .gssh-analysis-summary,
                #gssh-planner-results .gssh-analysis-summary {
                    background: var(--gaip-surface-muted) !important;
                    border: 1px solid var(--gaip-border);
                }
                #gssh-rig-results h3,
                #gssh-rig-results h4,
                #gssh-planner-results h3,
                #gssh-planner-results h4 {
                    color: var(--gaip-text) !important;
                }
                #gssh-rig-results p,
                #gssh-rig-results span,
                #gssh-rig-results td,
                #gssh-rig-results th,
                #gssh-rig-results li,
                #gssh-planner-results p,
                #gssh-planner-results span,
                #gssh-planner-results td,
                #gssh-planner-results th,
                #gssh-planner-results li {
                    color: var(--gaip-text) !important;
                }
                #gssh-rig-results [style*="background: #27272a"],
                #gssh-rig-results [style*="background:#27272a"],
                #gssh-rig-results [style*="background: #1e1e1e"],
                #gssh-planner-results [style*="background: #27272a"],
                #gssh-planner-results [style*="background:#27272a"],
                #gssh-planner-results [style*="background: #1e1e1e"] {
                    background: var(--gaip-surface-muted) !important;
                    border: 1px solid var(--gaip-border) !important;
                }
                #gssh-rig-results table,
                #gssh-planner-results table {
                    width: 100%;
                    border-collapse: collapse;
                }
                #gssh-rig-results th,
                #gssh-planner-results th {
                    background: var(--gaip-surface-hover) !important;
                    border-bottom: 2px solid var(--gaip-border) !important;
                    text-transform: uppercase;
                    font-size: 11px;
                    letter-spacing: 0.05em;
                    padding: 8px 12px !important;
                }
                #gssh-rig-results td,
                #gssh-planner-results td {
                    border-bottom: 1px solid var(--gaip-border) !important;
                    padding: 8px 12px !important;
                }
                /* Stadium sub-tab buttons */
                .gssh-stadium-subtab-nav {
                    display: flex;
                    gap: 4px;
                    margin-bottom: 16px;
                    border-bottom: 2px solid var(--gaip-border);
                    padding-bottom: 0;
                }
                .gssh-stadium-subtab-btn {
                    padding: 8px 16px;
                    border: 1px solid var(--gaip-border);
                    border-bottom: none;
                    background: var(--gaip-surface-muted);
                    cursor: pointer;
                    font-size: 13px;
                    border-radius: 6px 6px 0 0;
                    color: var(--gaip-text);
                }
                .gssh-stadium-subtab-btn.active {
                    background: var(--gaip-surface);
                    border-bottom: 2px solid var(--gaip-surface);
                    margin-bottom: -2px;
                    font-weight: 600;
                    color: var(--gaip-text);
                }
                /* Shade mode buttons */
                .gssh-shade-mode-btn {
                    padding: 4px 12px;
                    border: 1px solid var(--gaip-border);
                    background: var(--gaip-surface);
                    cursor: pointer;
                    font-size: 12px;
                    border-radius: 4px;
                    color: var(--gaip-text);
                }
                .gssh-shade-mode-btn.active {
                    background: #166534;
                    color: var(--gaip-surface);
                    border-color: #166534;
                }
                /* Inputs */
                #gssh-stadium-tab-wrapper .gssh-input,
                #gssh-stadium-tab-wrapper .gssh-select {
                    padding: 6px 10px;
                    border: 1px solid var(--gaip-border);
                    border-radius: 4px;
                    font-size: 13px;
                    color: var(--gaip-text);
                    background: var(--gaip-surface);
                }
                #gssh-stadium-tab-wrapper .gssh-btn-primary {
                    background: #166534;
                    color: var(--gaip-surface);
                    border: none;
                    padding: 8px 16px;
                    border-radius: 4px;
                    cursor: pointer;
                    font-size: 13px;
                    font-weight: 600;
                }
                #gssh-stadium-tab-wrapper .gssh-btn-primary:hover {
                    background: #14532d;
                }
                </style>
                <div class="gssh-stadium-section">
                    ${this.renderVenueContextStrip()}
                    ${this.renderSubTabNav()}
                    <div class="gssh-stadium-subtab-content">
                        ${this.renderOverviewTab()}
                        ${this.renderShadeTab()}
                        ${this.renderRigTab()}
                        ${this.renderPlannerTab()}
                    </div>
                </div>
            `;
        },

        // =====================================================================
        // VENUE CONTEXT STRIP
        // =====================================================================

        /**
         * Inject a self-contained venue context strip above the Stadium content.
         * Suppresses the Hub header location pill while Stadium tab is active so
         * the user never sees a Hub site name (e.g. "Duntry League") where a
         * stadium venue name belongs.
         */
        renderVenueContextStrip: function() {
            return `
                <div id="gssh-venue-context-strip" style="
                    display: flex;
                    align-items: center;
                    gap: 10px;
                    padding: 8px 14px;
                    background: var(--gaip-good-bg);
                    border: 1px solid var(--gaip-good-bg);
                    border-radius: 8px;
                    margin-bottom: 14px;
                    font-size: 13px;
                    color: #14532d;
                    min-height: 38px;
                ">
                    <span style="font-size:16px;">🏟️</span>
                    <span id="gssh-venue-strip-name" style="font-weight:600;color:#166534;">No venue selected</span>
                    <span id="gssh-venue-strip-meta" style="color:#4b7a5a;font-size:12px;"></span>
                    <span style="flex:1;"></span>
                    <span id="gssh-venue-strip-badge" style="
                        display:none;
                        background:#166534;
                        color:var(--gaip-surface);
                        border-radius:4px;
                        padding:2px 8px;
                        font-size:11px;
                        font-weight:600;
                        letter-spacing:0.04em;
                    "></span>
                </div>
            `;
        },

        updateVenueContextStrip: function(venue) {
            var nameEl = document.getElementById('gssh-venue-strip-name');
            var metaEl = document.getElementById('gssh-venue-strip-meta');
            var badgeEl = document.getElementById('gssh-venue-strip-badge');
            if (!nameEl) return;

            if (!venue) {
                nameEl.textContent = 'No venue selected';
                if (metaEl) metaEl.textContent = '';
                if (badgeEl) { badgeEl.style.display = 'none'; badgeEl.textContent = ''; }
                return;
            }

            var name  = venue.venue_name || venue.name || venue.venue_id || '';
            var state = venue.state || venue.location_state || '';
            var country = venue.country || venue.region || '';
            var sport = venue.sport || venue.league || '';

            nameEl.textContent = name;

            var meta = [];
            if (state)   meta.push(state);
            if (country && country !== 'australia' && country !== 'uk' && country !== 'japan') meta.push(country);
            if (sport)   meta.push(sport);
            if (metaEl)  metaEl.textContent = meta.length ? meta.join(' · ') : '';

            if (badgeEl) {
                var regionMap = { australia: 'AU', uk: 'UK', japan: 'JP', nz: 'NZ' };
                var regionLabel = regionMap[country] || (state ? 'AU' : '');
                if (regionLabel) {
                    badgeEl.textContent = regionLabel;
                    badgeEl.style.display = '';
                } else {
                    badgeEl.style.display = 'none';
                }
            }
        },

        /**
         * Suppress the Hub header location pill when Stadium tab is active.
         * Saves original text so it can be restored on tab leave.
         */
        suppressHubHeaderLocation: function() {
            var el = document.getElementById('gaip-header-location');
            if (!el) return;
            if (!el.dataset.gsshOrigText) {
                el.dataset.gsshOrigText  = el.textContent;
                el.dataset.gsshOrigClass = el.className;
            }
            el.style.opacity = '0';
            el.style.pointerEvents = 'none';
            el.setAttribute('aria-hidden', 'true');
        },

        restoreHubHeaderLocation: function() {
            var el = document.getElementById('gaip-header-location');
            if (!el) return;
            el.style.opacity = '';
            el.style.pointerEvents = '';
            el.removeAttribute('aria-hidden');
        },

        renderSubTabNav: function() {
            return `
                <div class="gssh-stadium-subtab-nav">
                    <button class="gssh-stadium-subtab-btn active" data-subtab="overview">
                        Overview
                    </button>
                    <button class="gssh-stadium-subtab-btn" data-subtab="shade">
                        Shade Analysis
                    </button>
                    <button class="gssh-stadium-subtab-btn" data-subtab="rig">
                        Rig Calculator
                    </button>
                    <button class="gssh-stadium-subtab-btn" data-subtab="planner">
                        Seasonal Planner
                    </button>
                </div>
            `;
        },

        renderOverviewTab: function() {
            return `
                <div class="gssh-stadium-subtab" data-subtab="overview" style="display:block">
                    <div class="gssh-card gssh-stadium-card">
                        <div class="gssh-card-header">
                            <h3>Venue Selection</h3>
                        </div>
                        <div class="gssh-card-body">
                            <div id="gssh-venue-selector-container">
                                <!-- Unified venue selector renders here -->
                                <div class="gssh-venue-mode-toggle">
                                    <button class="gssh-location-mode-btn active" data-mode="stadium">
                                        Select Stadium
                                    </button>
                                    <button class="gssh-location-mode-btn" data-mode="custom">
                                        Custom Venue
                                    </button>
                                </div>
                                <div id="gssh-stadium-venue-section">
                                    <select id="gssh-stadium-venue-select" class="gssh-select">
                                        <option value="">Select a venue...</option>
                                    </select>
                                </div>
                                <div id="gssh-custom-location-section" style="display:none">
                                    <p class="gssh-hint">Use the location search above or enter coordinates for a custom venue.</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div class="gssh-card" id="gssh-shade-summary-card" style="display:none">
                        <div class="gssh-card-header">
                            <h3>Shade Impact Summary</h3>
                            <span id="gssh-shade-status-badge" class="gssh-badge"></span>
                        </div>
                        <div class="gssh-card-body">
                            <div id="gssh-shade-summary-content">
                                <!-- Populated by shade orchestrator -->
                            </div>
                        </div>
                    </div>

                    <!-- Venue Readiness / Growth Environment Stack assessment -->
                    <div id="gssh-venue-readiness">
                        <!-- Rendered by venue-readiness-ui.js when EUE calculates -->
                    </div>

                    <div class="gssh-card" id="gssh-agronomic-impact-card" style="display:none">
                        <div class="gssh-card-header">
                            <h3>Agronomic Impact of Shade</h3>
                        </div>
                        <div class="gssh-card-body">
                            <div id="gssh-agronomic-impact-content">
                                <!-- Shows how shade affects disease, nutrition, growth etc -->
                            </div>
                        </div>
                    </div>
                </div>
            `;
        },

        renderShadeTab: function() {
            const today = new Date().toISOString().split('T')[0];
            return `
                <div class="gssh-stadium-subtab" data-subtab="shade" style="display:none">
                    <div class="gssh-card gssh-stadium-card">
                        <div class="gssh-card-header">
                            <h3>Shade Pattern Visualization</h3>
                            <div class="gssh-shade-mode-buttons">
                                <button class="gssh-shade-mode-btn active" data-mode="series">Time Series</button>
                                <button class="gssh-shade-mode-btn" data-mode="heatmap">Heatmap</button>
                                <button class="gssh-shade-mode-btn" data-mode="animation">Animation</button>
                                <button class="gssh-shade-mode-btn" data-mode="seasonal">Seasonal</button>
                                <button class="gssh-shade-mode-btn" data-mode="snapshot">Snapshot</button>
                            </div>
                        </div>
                        <div class="gssh-card-body">
                            <div class="gssh-shade-controls" style="display:flex;gap:12px;align-items:flex-end;margin-bottom:12px;flex-wrap:wrap;">
                                <label style="display:flex;flex-direction:column;gap:4px;font-size:13px;font-weight:600;">
                                    Date
                                    <input type="date" id="gssh-shade-date" class="gssh-input" value="${today}">
                                </label>
                                <label style="display:flex;flex-direction:column;gap:4px;font-size:13px;font-weight:600;">
                                    Time <span style="font-weight:400;color:var(--gaip-text-secondary);">(snapshot mode)</span>
                                    <input type="time" id="gssh-shade-time" class="gssh-input" value="12:00">
                                </label>
                                <button id="gssh-shade-refresh-btn" class="gssh-btn gssh-btn-primary" style="height:36px;">
                                    Update
                                </button>
                            </div>
                            <div id="gssh-shade-viz-container">
                                <p class="gssh-hint">Select a venue to see shadow patterns across the pitch.</p>
                            </div>
                        </div>
                    </div>

                    <div class="gssh-card gssh-stadium-card" id="gssh-zone-breakdown-card" style="display:none">
                        <div class="gssh-card-header">
                            <h3>Zone DLI Breakdown</h3>
                        </div>
                        <div class="gssh-card-body">
                            <div id="gssh-zone-breakdown-content"></div>
                        </div>
                    </div>
                </div>
            `;
        },

        renderRigTab: function() {
            const currentMonth = new Date().getMonth(); // 0-indexed
            const months = ['January','February','March','April','May','June',
                           'July','August','September','October','November','December'];
            const monthOptions = months.map((m, i) => 
                `<option value="${i + 1}" ${i === currentMonth ? 'selected' : ''}>${m}</option>`
            ).join('');
            
            return `
                <div class="gssh-stadium-subtab" data-subtab="rig" style="display:none">
                    <div class="gssh-card gssh-stadium-card">
                        <div class="gssh-card-header">
                            <h3>LED Rig Placement Calculator</h3>
                        </div>
                        <div class="gssh-card-body">
                            <div id="gssh-rig-calculator-container">
                                <div class="gssh-rig-inputs" style="display:flex;gap:12px;align-items:flex-end;flex-wrap:wrap;margin-bottom:12px;">
                                    <label style="display:flex;flex-direction:column;gap:4px;font-size:13px;font-weight:600;">
                                        Analysis Month
                                        <select id="gssh-rig-month" class="gssh-select">${monthOptions}</select>
                                    </label>
                                    <label style="display:flex;flex-direction:column;gap:4px;font-size:13px;font-weight:600;">
                                        Rig Model
                                        <select id="gssh-rig-model" class="gssh-select">
                                            <optgroup label="SGL — HPS">
                                                <option value="sgl_lu440" selected>SGL LU440 (440m²)</option>
                                                <option value="sgl_lu120">SGL LU120 (120m²)</option>
                                                <option value="sgl_bu50">SGL BU50 (50m²)</option>
                                            </optgroup>
                                            <optgroup label="SGL — LED">
                                                <option value="sgl_led440">SGL LED440 (440m²)</option>
                                                <option value="sgl_led120">SGL LED120 (120m²)</option>
                                            </optgroup>
                                            <optgroup label="Stogger DLS">
                                                <option value="stogger_booster_460">Stogger Booster Carbon 460 (460m²)</option>
                                                <option value="stogger_booster_480">Stogger Booster 480 (480m²)</option>
                                                <option value="stogger_booster_240">Stogger Booster 240 (240m²)</option>
                                                <option value="stogger_booster_60">Stogger Booster 60 (60m²)</option>
                                            </optgroup>
                                            <optgroup label="Rhenac/TLS CLS">
                                                <option value="rhenac_rml360">Rhenac R-ML 360 (360m²)</option>
                                                <option value="rhenac_rml200">Rhenac R-ML 200 (200m²)</option>
                                                <option value="rhenac_rml30">Rhenac R-ML 30 (30m²)</option>
                                            </optgroup>
                                            <optgroup label="Other">
                                                <option value="seegrow_led28">SeeGrow LED28 (28m²)</option>
                                                <option value="mobiled_mlb3">Mobiled MLB3 (360m²)</option>
                                                <option value="mlr_odin">MLR Odin s100 (500m²)</option>
                                            </optgroup>
                                        </select>
                                    </label>
                                    <button id="gssh-rig-calculate-btn" class="gssh-btn gssh-btn-primary" style="height:36px;">
                                        Calculate Placement
                                    </button>
                                </div>
                                <div id="gssh-rig-results"></div>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        },

        renderPlannerTab: function() {
            return `
                <div class="gssh-stadium-subtab" data-subtab="planner" style="display:none">
                    <div class="gssh-card gssh-stadium-card">
                        <div class="gssh-card-header">
                            <h3>Seasonal Lighting Planner</h3>
                        </div>
                        <div class="gssh-card-body">
                            <div id="gssh-seasonal-planner-container">
                                <div class="gssh-planner-config" style="display:flex;gap:12px;align-items:flex-end;flex-wrap:wrap;margin-bottom:12px;">
                                    <label>Currency
                                        <select id="gssh-planner-currency" class="gssh-select">
                                            <option value="AUD">AUD</option>
                                            <option value="GBP">GBP</option>
                                            <option value="USD">USD</option>
                                            <option value="EUR">EUR</option>
                                            <option value="JPY">JPY</option>
                                        </select>
                                    </label>
                                    <label>Electricity Rate (per kWh)
                                        <input type="number" id="gssh-planner-kwh-rate" class="gssh-input" value="0.30" step="0.01" min="0">
                                    </label>
                                    <button id="gssh-planner-calculate-btn" class="gssh-btn gssh-btn-primary">
                                        Generate Plan
                                    </button>
                                </div>
                                <div id="gssh-planner-results"></div>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        },

        // =====================================================================
        // SUB-TAB NAVIGATION
        // =====================================================================

        switchSubTab: function(tabId) {
            this.activeSubTab = tabId;

            // Update buttons
            document.querySelectorAll('.gssh-stadium-subtab-btn').forEach(function(btn) {
                btn.classList.toggle('active', btn.dataset.subtab === tabId);
            });

            // Update content
            document.querySelectorAll('.gssh-stadium-subtab').forEach(function(panel) {
                panel.style.display = panel.dataset.subtab === tabId ? 'block' : 'none';
            });

            // Initialise or re-position the Leaflet location map when shade tab opens.
            // The map container (#gssh-location-map) is inside the shade panel which
            // starts hidden, so GSSH_MapInit.init() on page load exits early (no container).
            // Re-run here now that the panel is visible.
            if (tabId === 'shade' && typeof GSSH_MapInit !== 'undefined') {
                if (!GSSH_MapInit.map) {
                    // First open — initialise. _pendingVenue may be set from a prior
                    // venue selection, so init() will position the map correctly.
                    setTimeout(function() {
                        GSSH_MapInit.init();
                    }, 50); // brief delay for display:block to paint before Leaflet measures container
                } else {
                    // Map already exists — just invalidate size in case container was hidden
                    GSSH_MapInit.map.invalidateSize();
                }
            }
        },

        onTabActivated: function() {
            // Ensure wrapper is visible when tab is active
            const wrapper = document.getElementById('gssh-stadium-tab-wrapper');
            if (wrapper) {
                wrapper.classList.remove('gssh-tab-hidden');
                wrapper.style.display = '';
            }

            // Suppress Hub header location pill — it shows Hub site name which
            // has no meaning in the Stadium context (the venue strip replaces it)
            this.suppressHubHeaderLocation();

            // Sync strip with current venue if already selected
            if (this.currentVenue) {
                this.updateVenueContextStrip(this.currentVenue);
            }

            // Refresh shade display when stadium tab becomes active
            const orch = global.GSSH_ShadeOrchestrator;
            if (orch && orch.currentShade) {
                this.updateShadeDisplay(orch.currentShade);
            }
        },

        // =====================================================================
        // SHADE DISPLAY
        // =====================================================================

        updateShadeDisplay: function(shadeData) {
            if (!shadeData) return;

            // Show summary card
            const summaryCard = document.getElementById('gssh-shade-summary-card');
            if (summaryCard) summaryCard.style.display = '';

            // Update shade summary
            this.renderShadeSummary(shadeData);

            // Update agronomic impact
            this.renderAgronomicImpact(shadeData);

            // Update rig calculator indicator
            this.updateRigIndicator(shadeData);

            // Refresh the detailed shade tab whenever new shade results arrive.
            this.loadShadeVisualization(this.currentVenue && this.currentVenue.venue_id, this.getActiveShadeMode());
        },

        renderShadeSummary: function(shade) {
            const container = document.getElementById('gssh-shade-summary-content');
            if (!container) return;

            const dli = shade.dli_shaded || shade.dli_ambient || '—';
            const target = shade.thresholds?.target || '—';
            const deficit = shade.dli_deficit || 0;
            const status = shade.status || 'unknown';

            const statusColors = {
                adequate: '#27ae60',
                suboptimal: '#f39c12',
                stressed: '#e67e22',
                critical: '#e74c3c'
            };

            container.innerHTML = `
                <div class="gssh-shade-metrics" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:12px;">
                    <div class="gssh-metric">
                        <div class="gssh-metric-value">${typeof dli === 'number' ? dli.toFixed(1) : dli}</div>
                        <div class="gssh-metric-label">Current DLI (mol/m²/d)</div>
                    </div>
                    <div class="gssh-metric">
                        <div class="gssh-metric-value">${target}</div>
                        <div class="gssh-metric-label">Target DLI</div>
                    </div>
                    <div class="gssh-metric">
                        <div class="gssh-metric-value" style="color:${deficit > 0 ? '#e74c3c' : '#27ae60'}">
                            ${deficit > 0 ? '-' + deficit.toFixed(1) : '0'}
                        </div>
                        <div class="gssh-metric-label">DLI Deficit</div>
                    </div>
                    <div class="gssh-metric">
                        <div class="gssh-metric-value" style="color:${statusColors[status] || 'var(--gaip-text-muted)'}">
                            ${status.charAt(0).toUpperCase() + status.slice(1)}
                        </div>
                        <div class="gssh-metric-label">Light Status</div>
                    </div>
                </div>
                ${shade.source === 'obstruction_profile'
                    ? '<p class="gssh-data-source">Source: Venue obstruction profile</p>'
                    : '<p class="gssh-data-source">Source: Estimated (no obstruction profile)</p>'
                }
            `;

            // Update status badge
            const badge = document.getElementById('gssh-shade-status-badge');
            if (badge) {
                badge.textContent = status;
                badge.style.backgroundColor = statusColors[status] || 'var(--gaip-text-muted)';
                badge.style.color = 'var(--gaip-surface)';
                badge.style.padding = '2px 8px';
                badge.style.borderRadius = '4px';
                badge.style.fontSize = '12px';
            }
        },

        renderAgronomicImpact: function(shade) {
            const card = document.getElementById('gssh-agronomic-impact-card');
            const container = document.getElementById('gssh-agronomic-impact-content');
            if (!container) return;

            if (!shade.stressFactor || shade.stressFactor < 0.1) {
                card.style.display = 'none';
                return;
            }

            card.style.display = '';
            const sf = shade.stressFactor;
            const lwm = shade.leaf_wetness_modifier || 1;
            const gm = shade.growth_modifier || 1;

            const impacts = [];

            // Disease impact
            if (lwm > 1.05) {
                impacts.push({
                    icon: '🦠',
                    label: 'Disease Pressure',
                    detail: `Leaf wetness +${Math.round((lwm - 1) * 100)}% — elevated fungal risk from extended canopy moisture`,
                    severity: lwm > 1.4 ? 'high' : 'moderate'
                });
            }

            // Growth impact
            if (gm < 0.9) {
                impacts.push({
                    icon: '🌱',
                    label: 'Growth Reduction',
                    detail: `Turf growth reduced to ${Math.round(gm * 100)}% of potential — recovery from wear will be slower`,
                    severity: gm < 0.5 ? 'high' : 'moderate'
                });
            }

            // Nutrition impact
            if (sf > 0.2) {
                impacts.push({
                    icon: '🧪',
                    label: 'Nitrogen Demand',
                    detail: `Reduce N application by ${Math.round(sf * 30)}% in shaded zones — excess N promotes weak, disease-susceptible growth in low light`,
                    severity: sf > 0.5 ? 'high' : 'moderate'
                });
            }

            // PGR impact
            if (sf > 0.3) {
                impacts.push({
                    icon: '⚗️',
                    label: 'PGR Caution',
                    detail: 'Reduce or avoid PGR in shaded zones — growth regulation compounds shade stress (Ervin & Koski 1998)',
                    severity: sf > 0.6 ? 'high' : 'moderate'
                });
            }

            // Irrigation impact
            if (shade.shade_percentage > 30) {
                impacts.push({
                    icon: '💧',
                    label: 'Irrigation Adjustment',
                    detail: `Reduce irrigation ${Math.round(shade.shade_percentage * 0.3)}% in shaded zones — lower evapotranspiration but maintain drainage`,
                    severity: 'info'
                });
            }

            // Mowing impact
            if (sf > 0.2) {
                impacts.push({
                    icon: '✂️',
                    label: 'Mowing Height',
                    detail: 'Raise HOC 20-30% in shaded zones to increase leaf area for light capture (Dudeck & Peacock 1992)',
                    severity: 'info'
                });
            }

            container.innerHTML = impacts.map(function(impact) {
                const severityColor = impact.severity === 'high' ? '#e74c3c'
                    : impact.severity === 'moderate' ? '#f39c12' : '#3498db';
                return `
                    <div class="gssh-impact-item" style="padding:8px 0;border-bottom:1px solid var(--gaip-surface-hover);">
                        <div style="display:flex;align-items:flex-start;gap:8px;">
                            <span style="font-size:18px;">${impact.icon}</span>
                            <div>
                                <strong style="color:${severityColor}">${impact.label}</strong>
                                <div style="color:var(--gaip-text-secondary);font-size:13px;margin-top:2px;">${impact.detail}</div>
                            </div>
                        </div>
                    </div>
                `;
            }).join('');
        },

        updateRigIndicator: function(shade) {
            const indicator = document.getElementById('gssh-rig-hub-indicator');
            if (!indicator) return;

            if (shade.dli_shaded || shade.dli_ambient) {
                indicator.style.display = '';
                const dli = shade.dli_shaded || shade.dli_ambient;
                const target = shade.thresholds?.target || '—';
                indicator.innerHTML = `
                    <span class="gssh-hub-badge">🔗 Hub: DLI: ${typeof dli === 'number' ? dli.toFixed(1) : dli} · Target: ${target}</span>
                `;
            }
        },

        showLoadingState: function(detail) {
            const container = document.getElementById('gssh-shade-summary-content');
            if (container) {
                container.innerHTML = '<p class="gssh-loading">Analysing shade for ' + (detail.venue || 'venue') + '...</p>';
            }
        },

        // =====================================================================
        // LOCAL SHADE VISUALISATION
        // =====================================================================

        /**
         * Render the current shade state into the stadium shade tab.
         */
        loadShadeVisualization: function(venueId, mode) {
            const container = document.getElementById('gssh-shade-viz-container');
            if (!container) return;

            container.innerHTML = '<p class="gssh-loading">Loading shade analysis...</p>';

            // Read date and time from inputs, fall back to today/noon
            const dateInput = document.getElementById('gssh-shade-date');
            const timeInput = document.getElementById('gssh-shade-time');
            const date = (dateInput && dateInput.value) || new Date().toISOString().split('T')[0];
            const time = (timeInput && timeInput.value) || '12:00';
            const orch = global.GSSH_ShadeOrchestrator;
            const shade = orch && orch.currentShade ? orch.currentShade : null;
            const activeMode = mode || this.getActiveShadeMode();

            if (!shade) {
                container.innerHTML = '<p class="gssh-hint">Shade analysis is still running for this venue.</p>';
                this.renderZoneBreakdown(null);
                return;
            }

            container.innerHTML = this.renderLocalShadeVisualization(shade, {
                venueId: venueId,
                mode: activeMode,
                date: date,
                time: time
            });
            this.renderZoneBreakdown(shade);
        },

        getActiveShadeMode: function() {
            var active = document.querySelector('.gssh-shade-mode-btn.active');
            return active ? active.dataset.mode : 'series';
        },

        buildHourlyShadeSeries: function(shade, timeLabel) {
            var ambient = parseFloat(shade.dli_ambient || shade.ambientDLI || 18);
            var shaded = parseFloat(shade.dli_shaded || shade.shadedDLI || (ambient * 0.7));
            var baseShadePct = parseFloat(shade.shade_percentage || shade.shadePercentage || 30);
            if (!isFinite(ambient)) ambient = 18;
            if (!isFinite(shaded)) shaded = ambient * 0.7;
            if (!isFinite(baseShadePct)) baseShadePct = 30;
            var selectedHour = parseInt(String(timeLabel || '12:00').split(':')[0], 10);
            if (!isFinite(selectedHour)) selectedHour = 12;
            var series = [];
            for (var hour = 6; hour <= 18; hour++) {
                var daylight = Math.sin(((hour - 6) / 12) * Math.PI);
                var shadeFactor = Math.max(0.12, Math.min(0.88, (baseShadePct / 100) * (1.2 - daylight * 0.55)));
                var availability = Math.max(0, Math.min(1, 1 - shadeFactor));
                var hourlyDli = Math.max(0.1, Math.round((ambient * daylight * availability) * 10) / 10);
                series.push({
                    hour: hour,
                    label: (hour < 10 ? '0' : '') + hour + ':00',
                    daylight: daylight,
                    shadeFactor: shadeFactor,
                    availability: availability,
                    dli: hourlyDli,
                    isSelected: hour === selectedHour
                });
            }
            return series;
        },

        renderLocalShadeVisualization: function(shade, options) {
            var mode = options.mode || 'series';
            var visual = this.renderShadeModeVisual(shade, options);
            var detailHtml = typeof global.gssh_shade_render === 'function'
                ? global.gssh_shade_render(shade)
                : '';
            return '<div class="gssh-local-shade-viz">' +
                visual +
                '<div style="margin-top:14px;">' + detailHtml + '</div>' +
            '</div>';
        },

        renderShadeModeVisual: function(shade, options) {
            var mode = options.mode || 'series';
            if (mode === 'heatmap') return this.renderShadeHeatmap(shade);
            if (mode === 'animation') return this.renderShadeAnimationFrames(shade, options);
            if (mode === 'seasonal') return this.renderSeasonalShadeTable(shade);
            if (mode === 'snapshot') return this.renderShadeSnapshot(shade, options);
            return this.renderShadeTimeSeries(shade, options);
        },

        renderShadeTimeSeries: function(shade, options) {
            var series = this.buildHourlyShadeSeries(shade, options.time);
            var bars = series.map(function(point) {
                var height = Math.max(14, Math.round(point.availability * 140));
                var color = point.availability > 0.75 ? '#16a34a' : point.availability > 0.5 ? '#f59e0b' : '#dc2626';
                var border = point.isSelected ? '2px solid #0f172a' : '1px solid rgba(15,23,42,0.08)';
                return '<div style="flex:1;min-width:26px;text-align:center;">' +
                    '<div style="height:150px;display:flex;align-items:flex-end;justify-content:center;">' +
                        '<div title="' + point.label + ' · ' + point.dli + ' mol" style="width:100%;max-width:34px;height:' + height + 'px;background:' + color + ';border:' + border + ';border-radius:6px 6px 0 0;"></div>' +
                    '</div>' +
                    '<div style="margin-top:6px;font-size:11px;color:#64748b;">' + point.hour + '</div>' +
                '</div>';
            }).join('');

            return '<div style="background:#f8fafc;border:1px solid #e5e7eb;border-radius:8px;padding:14px;">' +
                '<h4 style="margin:0 0 6px;color:#111827;">Daily light availability</h4>' +
                '<p style="margin:0 0 12px;color:#475569;">Projected light availability across the day for ' + options.date + '.</p>' +
                '<div style="display:flex;gap:8px;align-items:flex-end;">' + bars + '</div>' +
            '</div>';
        },

        renderShadeHeatmap: function(shade) {
            var zones = (shade.zones && shade.zones.length ? shade.zones : null) || [];
            if (!zones.length) {
                var fallback = [];
                for (var i = 0; i < 12; i++) {
                    fallback.push({
                        label: 'Z' + (i + 1),
                        shade: Math.max(15, Math.min(80, (shade.shade_percentage || 30) + ((i % 4) - 1.5) * 8))
                    });
                }
                zones = fallback;
            }
            var cards = zones.slice(0, 12).map(function(zone, index) {
                var deficit = zone.deficit != null ? zone.deficit : Math.max(0, ((zone.shade || 30) / 100) * 12);
                var intensity = Math.max(0, Math.min(1, deficit / 10));
                var bg = 'rgba(220,38,38,' + (0.18 + intensity * 0.55).toFixed(2) + ')';
                return '<div style="aspect-ratio:1;border-radius:8px;background:' + bg + ';padding:10px;display:flex;flex-direction:column;justify-content:space-between;border:1px solid rgba(15,23,42,0.08);">' +
                    '<strong style="font-size:12px;color:#111827;">' + (zone.rig_id || zone.label || ('Zone ' + (index + 1))) + '</strong>' +
                    '<span style="font-size:12px;color:#111827;">' + deficit.toFixed(1) + ' mol gap</span>' +
                '</div>';
            }).join('');
            return '<div style="background:#f8fafc;border:1px solid #e5e7eb;border-radius:8px;padding:14px;">' +
                '<h4 style="margin:0 0 6px;color:#111827;">Pitch heatmap</h4>' +
                '<p style="margin:0 0 12px;color:#475569;">Relative DLI shortfall by zone. Darker red indicates larger light deficit.</p>' +
                '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(82px,1fr));gap:10px;">' + cards + '</div>' +
            '</div>';
        },

        renderShadeAnimationFrames: function(shade, options) {
            var frames = this.buildHourlyShadeSeries(shade, options.time).filter(function(point) {
                return point.hour === 8 || point.hour === 11 || point.hour === 14 || point.hour === 17;
            });
            var html = frames.map(function(frame) {
                var pct = Math.round(frame.availability * 100);
                return '<div style="flex:1;min-width:120px;border:1px solid #e5e7eb;border-radius:8px;padding:10px;background:#fff;">' +
                    '<div style="font-size:12px;color:#64748b;margin-bottom:8px;">' + frame.label + '</div>' +
                    '<div style="height:84px;border-radius:6px;background:linear-gradient(180deg, rgba(251,191,36,0.75), rgba(30,41,59,' + (0.25 + (1 - frame.availability) * 0.55).toFixed(2) + '));"></div>' +
                    '<div style="margin-top:8px;font-size:12px;color:#111827;">Light available: ' + pct + '%</div>' +
                '</div>';
            }).join('');
            return '<div style="background:#f8fafc;border:1px solid #e5e7eb;border-radius:8px;padding:14px;">' +
                '<h4 style="margin:0 0 6px;color:#111827;">Shade movement frames</h4>' +
                '<p style="margin:0 0 12px;color:#475569;">Representative frames across the day. Use Snapshot for a specific time.</p>' +
                '<div style="display:flex;gap:10px;flex-wrap:wrap;">' + html + '</div>' +
            '</div>';
        },

        renderSeasonalShadeTable: function(shade) {
            var climate = this.getLocalClimateContext();
            var latitude = this.currentVenue && this.currentVenue.lat;
            var roofState = this.getRoofStateForRig();
            var baseAmbient = parseFloat(shade.dli_ambient || shade.ambientDLI || climate.dli || 18);
            var target = parseFloat(shade.thresholds && shade.thresholds.target || shade.targetDLI || 22);
            var ratio = (shade.dli_ambient && shade.dli_shaded) ? (shade.dli_shaded / shade.dli_ambient) : 0.68;
            if (!isFinite(baseAmbient)) baseAmbient = 18;
            if (!isFinite(target)) target = 22;
            if (!isFinite(ratio) || ratio <= 0 || ratio > 1.2) ratio = 0.68;
            var rows = [];
            for (var month = 1; month <= 12; month++) {
                var ambient = this.estimateMonthlyAmbientDli(baseAmbient, month, latitude, roofState);
                var shaded = Math.max(0.3, Math.round((ambient * ratio) * 10) / 10);
                var deficit = Math.max(0, Math.round((target - shaded) * 10) / 10);
                rows.push('<tr style="border-bottom:1px solid #e5e7eb;">' +
                    '<td style="padding:8px 10px;">' + ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][month - 1] + '</td>' +
                    '<td style="padding:8px 10px;text-align:center;">' + ambient.toFixed(1) + '</td>' +
                    '<td style="padding:8px 10px;text-align:center;">' + shaded.toFixed(1) + '</td>' +
                    '<td style="padding:8px 10px;text-align:center;color:' + (deficit > 0 ? '#dc2626' : '#16a34a') + ';">' + deficit.toFixed(1) + '</td>' +
                '</tr>');
            }
            return '<div style="background:#f8fafc;border:1px solid #e5e7eb;border-radius:8px;padding:14px;">' +
                '<h4 style="margin:0 0 6px;color:#111827;">Seasonal DLI outlook</h4>' +
                '<p style="margin:0 0 12px;color:#475569;">Projected ambient and shaded DLI through the year at this latitude and roof state.</p>' +
                '<div style="overflow:auto;"><table style="width:100%;border-collapse:collapse;background:#fff;border:1px solid #e5e7eb;border-radius:6px;overflow:hidden;">' +
                    '<thead><tr style="background:#f1f5f9;"><th style="padding:8px 10px;text-align:left;">Month</th><th style="padding:8px 10px;text-align:center;">Ambient</th><th style="padding:8px 10px;text-align:center;">Shaded</th><th style="padding:8px 10px;text-align:center;">Gap</th></tr></thead>' +
                    '<tbody>' + rows.join('') + '</tbody>' +
                '</table></div>' +
            '</div>';
        },

        renderShadeSnapshot: function(shade, options) {
            var series = this.buildHourlyShadeSeries(shade, options.time);
            var selected = series.find(function(point) { return point.isSelected; }) || series[6];
            var deficit = Math.max(0, ((shade.thresholds && shade.thresholds.target) || shade.targetDLI || 22) - (shade.dli_shaded || shade.shadedDLI || 0));
            return '<div style="background:#f8fafc;border:1px solid #e5e7eb;border-radius:8px;padding:14px;">' +
                '<h4 style="margin:0 0 6px;color:#111827;">Snapshot at ' + selected.label + '</h4>' +
                '<p style="margin:0 0 12px;color:#475569;">Selected date: ' + options.date + '.</p>' +
                '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:10px;">' +
                    '<div style="background:#fff;border:1px solid #e5e7eb;border-radius:8px;padding:10px;"><span style="font-size:11px;color:#64748b;">Light available</span><strong style="display:block;font-size:20px;color:#111827;">' + Math.round(selected.availability * 100) + '%</strong></div>' +
                    '<div style="background:#fff;border:1px solid #e5e7eb;border-radius:8px;padding:10px;"><span style="font-size:11px;color:#64748b;">Instant DLI equivalent</span><strong style="display:block;font-size:20px;color:#111827;">' + selected.dli.toFixed(1) + '</strong></div>' +
                    '<div style="background:#fff;border:1px solid #e5e7eb;border-radius:8px;padding:10px;"><span style="font-size:11px;color:#64748b;">Daily deficit</span><strong style="display:block;font-size:20px;color:' + (deficit > 0 ? '#dc2626' : '#16a34a') + ';">' + deficit.toFixed(1) + '</strong></div>' +
                '</div>' +
            '</div>';
        },

        renderZoneBreakdown: function(shade) {
            const card = document.getElementById('gssh-zone-breakdown-card');
            const container = document.getElementById('gssh-zone-breakdown-content');
            if (!card || !container) return;

            const zones = shade && shade.zones && shade.zones.length ? shade.zones : [];
            if (!zones.length) {
                card.style.display = 'none';
                container.innerHTML = '';
                return;
            }

            card.style.display = '';
            container.innerHTML = zones.map(function(zone, index) {
                var dli = zone.dli != null ? zone.dli : '—';
                var deficit = zone.deficit != null ? zone.deficit : '—';
                return '<div style="display:grid;grid-template-columns:minmax(110px,1.3fr) repeat(3, minmax(90px,1fr));gap:10px;padding:10px 0;border-bottom:1px solid #e5e7eb;align-items:center;">' +
                    '<strong style="color:#111827;">' + (zone.name || zone.label || zone.rig_id || ('Zone ' + (index + 1))) + '</strong>' +
                    '<span style="color:#475569;">DLI: ' + (typeof dli === 'number' ? dli.toFixed(1) : dli) + '</span>' +
                    '<span style="color:#475569;">Gap: ' + (typeof deficit === 'number' ? deficit.toFixed(1) : deficit) + '</span>' +
                    '<span style="color:#475569;">Shade: ' + (zone.shade_factor != null ? Math.round(zone.shade_factor * 100) + '%' : '—') + '</span>' +
                '</div>';
            }).join('');
        },

        getRigModelSpec: function(modelId) {
            const models = {
                sgl_lu440: { label: 'SGL LU440', coverage: 440, supplementDli: 13.8, powerKw: 72, currentRigs: 2 },
                sgl_lu120: { label: 'SGL LU120', coverage: 120, supplementDli: 13.2, powerKw: 22, currentRigs: 4 },
                sgl_bu50: { label: 'SGL BU50', coverage: 50, supplementDli: 12.5, powerKw: 9, currentRigs: 6 },
                sgl_led440: { label: 'SGL LED440', coverage: 440, supplementDli: 14.7, powerKw: 54, currentRigs: 2 },
                sgl_led120: { label: 'SGL LED120', coverage: 120, supplementDli: 14.2, powerKw: 17, currentRigs: 4 },
                stogger_booster_460: { label: 'Stogger Booster Carbon 460', coverage: 460, supplementDli: 14.7, powerKw: 48, currentRigs: 2 },
                stogger_booster_480: { label: 'Stogger Booster 480', coverage: 480, supplementDli: 14.4, powerKw: 52, currentRigs: 2 },
                stogger_booster_240: { label: 'Stogger Booster 240', coverage: 240, supplementDli: 14.1, powerKw: 26, currentRigs: 3 },
                stogger_booster_60: { label: 'Stogger Booster 60', coverage: 60, supplementDli: 13.6, powerKw: 7, currentRigs: 6 },
                rhenac_rml360: { label: 'Rhenac R-ML 360', coverage: 360, supplementDli: 14.5, powerKw: 42, currentRigs: 2 },
                rhenac_rml200: { label: 'Rhenac R-ML 200', coverage: 200, supplementDli: 14.0, powerKw: 24, currentRigs: 3 },
                rhenac_rml30: { label: 'Rhenac R-ML 30', coverage: 30, supplementDli: 12.8, powerKw: 4, currentRigs: 8 },
                seegrow_led28: { label: 'SeeGrow LED28', coverage: 28, supplementDli: 12.4, powerKw: 3, currentRigs: 8 },
                mobiled_mlb3: { label: 'Mobiled MLB3', coverage: 360, supplementDli: 14.0, powerKw: 40, currentRigs: 2 },
                mlr_odin: { label: 'MLR Odin s100', coverage: 500, supplementDli: 14.6, powerKw: 56, currentRigs: 2 }
            };
            return models[modelId] || models.sgl_lu440;
        },

        getRoofStateForRig: function() {
            var cfg = global.GSSH_EUE_Bridge &&
                      typeof global.GSSH_EUE_Bridge.getVenueEnvConfig === 'function'
                      ? global.GSSH_EUE_Bridge.getVenueEnvConfig() : null;
            if (!cfg || !cfg.enclosureType) return 'open';
            if (cfg.enclosureType === 'retractable_closed') return 'closed';
            if (cfg.enclosureType === 'fixed_roof' || cfg.enclosureType === 'enclosed') return 'closed';
            return 'open';
        },

        getLocalClimateContext: function() {
            var values = {};
            this.appendHubClimateData({
                append: function(key, value) {
                    values[key] = value;
                }
            });
            return {
                dli: values.hub_dli != null ? parseFloat(values.hub_dli) : null,
                ghi: values.hub_ghi != null ? parseFloat(values.hub_ghi) : null,
                temperature: values.hub_temperature != null ? parseFloat(values.hub_temperature) : null
            };
        },

        getCurrencySymbol: function(currency) {
            if (currency === 'GBP') return '£';
            if (currency === 'EUR') return '€';
            if (currency === 'JPY') return '¥';
            return '$';
        },

        estimateMonthlyAmbientDli: function(baseDli, month, latitude, roofState) {
            var currentMonth = new Date().getMonth() + 1;
            var lat = parseFloat(latitude);
            if (!isFinite(lat)) lat = -33.8;
            var peakMonth = lat >= 0 ? 6.5 : 12.5;
            var amplitude = Math.max(0.18, Math.min(0.55, Math.abs(lat) / 55));
            var seasonalFactor = function(monthNumber) {
                var angle = ((monthNumber - peakMonth) / 12) * Math.PI * 2;
                return 1 + amplitude * Math.cos(angle);
            };
            var currentFactor = seasonalFactor(currentMonth);
            var monthFactor = seasonalFactor(month);
            var adjusted = baseDli * (monthFactor / currentFactor);
            if (roofState === 'closed') adjusted = adjusted * 0.32;
            return Math.max(0.5, Math.round(adjusted * 10) / 10);
        },

        calculateLocalRigPlacement: function(context) {
            var monthNames = ['January','February','March','April','May','June',
                'July','August','September','October','November','December'];
            var month = parseInt(context.month, 10);
            if (!isFinite(month) || month < 1 || month > 12) month = new Date().getMonth() + 1;
            var monthName = monthNames[month - 1];
            var model = this.getRigModelSpec(context.rigModel);
            var shade = context.shadeState || {};
            var climate = context.climate || {};
            var targetDli = parseFloat(context.targetDli || shade.targetDLI || shade.target_dli || 22);
            var ambientDli = parseFloat(context.ambientDli || shade.ambientDLI || shade.dli_ambient || climate.dli || 18);
            if (!isFinite(targetDli)) targetDli = 22;
            if (!isFinite(ambientDli)) ambientDli = 18;
            if (context.roofState === 'closed') ambientDli = Math.round(ambientDli * 0.32 * 10) / 10;
            var shadedDli = parseFloat(shade.shadedDLI || shade.dli_shaded || shade.dli || (ambientDli * 0.68));
            if (!isFinite(shadedDli)) shadedDli = ambientDli * 0.68;
            var deficit = Math.max(0, Math.round((targetDli - shadedDli) * 10) / 10);
            var shadePct = shade.shade_percentage || shade.shadePercentage || (deficit > 0 ? Math.min(65, deficit * 4) : 15);
            shadePct = parseFloat(shadePct);
            if (!isFinite(shadePct)) shadePct = 15;
            var deficitArea = Math.round(7140 * Math.max(0.12, Math.min(0.9, shadePct / 100)));
            var coveragePct = parseFloat(context.coveragePct != null ? context.coveragePct : 10);
            if (!isFinite(coveragePct)) coveragePct = 10;
            var rigsRequired = Math.max(1, Math.ceil((deficitArea * (coveragePct / 100)) / model.coverage));
            var currentRigs = model.currentRigs;
            var ghostRigs = Math.max(4, rigsRequired + 4 - currentRigs);
            var zones = this.generateRigZones(rigsRequired + ghostRigs, deficit, model, currentRigs);
            var healthProjection = this.generateRigHealthProjection(deficit, model.supplementDli, coveragePct);
            var hours = deficit > 0 ? Math.max(2, Math.min(10, Math.ceil((deficit / model.supplementDli) * 12))) : 2;

            return {
                rig_model: context.rigModel,
                rig_model_label: model.label,
                month: month,
                month_name: monthName,
                eue: {
                    deficit_mol: deficit,
                    target_dli: targetDli,
                    shaded_dli: shadedDli,
                    supplement_dli: model.supplementDli,
                    recommended_hours: hours
                },
                venue_readiness: {
                    roof_state: context.roofState,
                    status: deficit > 8 ? 'high_need' : deficit > 3 ? 'moderate_need' : 'monitor'
                },
                summary: {
                    deficit_area_sqm: deficitArea,
                    rig_coverage_sqm: model.coverage,
                    target_coverage_pct: coveragePct,
                    rigs_required: rigsRequired,
                    current_rigs: currentRigs,
                    ghost_rigs: ghostRigs,
                    daily_kwh: Math.round(rigsRequired * model.powerKw * hours),
                    recommended_hours: hours
                },
                dli_context: {
                    ambient_dli: ambientDli,
                    shaded_dli: shadedDli,
                    target_dli: targetDli,
                    roof_state: context.roofState,
                    ghi: climate.ghi,
                    temperature: climate.temperature
                },
                zones: zones,
                health_projection: healthProjection
            };
        },

        generateRigZones: function(total, deficit, model, currentRigs) {
            var zones = [];
            var cols = 4;
            for (var i = 0; i < total; i++) {
                var row = Math.floor(i / cols);
                var col = i % cols;
                var zoneDeficit = Math.max(0, Math.round((deficit - (i * 0.35)) * 10) / 10);
                zones.push({
                    rig_id: (i < currentRigs ? 'Rig ' : 'Reserve ') + (i + 1),
                    type: i < currentRigs ? 'deployed' : 'ghost',
                    x: 18 + col * 22,
                    y: 14 + row * 18,
                    deficit: zoneDeficit,
                    hours: zoneDeficit > 0 ? Math.max(2, Math.min(10, Math.ceil((zoneDeficit / model.supplementDli) * 12))) : 2,
                    status: zoneDeficit > 5 ? 'warning' : zoneDeficit > 1 ? 'recommended' : 'ok',
                    shortfall: zoneDeficit
                });
            }
            return zones;
        },

        generateRigHealthProjection: function(deficit, supplementDli, coveragePct) {
            var without = [];
            var withLight = [];
            var start = 82;
            var dailyLoss = deficit > 0 ? Math.min(4.5, 0.45 + deficit * 0.28) : 0.15;
            var recovery = Math.min(3.5, supplementDli * 0.11);
            for (var day = 0; day <= 30; day++) {
                var noLight = Math.max(8, start - dailyLoss * day);
                var covered = Math.min(96, start - Math.max(0.05, dailyLoss - recovery) * day + (coveragePct / 100) * 8);
                withLight.push({ day: day, health: Math.round(covered), covered: Math.round(covered) });
                without.push({ day: day, health: Math.round(noLight) });
            }
            return {
                coverage_ratio: Math.max(0.01, Math.min(1, coveragePct / 100)),
                without_trajectory: without,
                with_trajectory: withLight
            };
        },

        calculateLocalSeasonalPlan: function(context) {
            var model = this.getRigModelSpec(context.rigModel);
            var shade = context.shadeState || {};
            var climate = context.climate || {};
            var monthNames = ['January','February','March','April','May','June',
                'July','August','September','October','November','December'];
            var targetDli = parseFloat(context.targetDli || shade.targetDLI || shade.target_dli || 22);
            var baseAmbientDli = parseFloat(context.ambientDli || shade.ambientDLI || shade.dli_ambient || climate.dli || 18);
            var shadeRatio = null;
            if (shade.dli_ambient && shade.dli_shaded) {
                shadeRatio = shade.dli_shaded / shade.dli_ambient;
            } else if (shade.ambientDLI && shade.shadedDLI) {
                shadeRatio = shade.shadedDLI / shade.ambientDLI;
            }
            if (!isFinite(targetDli)) targetDli = 22;
            if (!isFinite(baseAmbientDli)) baseAmbientDli = 18;
            if (!isFinite(shadeRatio) || shadeRatio <= 0 || shadeRatio > 1.2) shadeRatio = 0.68;

            var shadePct = shade.shade_percentage || shade.shadePercentage || 28;
            shadePct = parseFloat(shadePct);
            if (!isFinite(shadePct)) shadePct = 28;
            var deficitArea = Math.round(7140 * Math.max(0.12, Math.min(0.9, shadePct / 100)));
            var latitude = context.venue && context.venue.lat;
            var currencySymbol = this.getCurrencySymbol(context.currency);
            var months = [];
            var totalKwh = 0;
            var totalCost = 0;
            var peakRigs = 0;
            var activeMonths = [];

            for (var month = 1; month <= 12; month++) {
                var ambientDli = this.estimateMonthlyAmbientDli(baseAmbientDli, month, latitude, context.roofState);
                var shadedDli = Math.max(0.3, Math.round((ambientDli * shadeRatio) * 10) / 10);
                var deficit = Math.max(0, Math.round((targetDli - shadedDli) * 10) / 10);
                var rigsRequired = deficit > 0.8 ? Math.max(1, Math.ceil(deficitArea / model.coverage)) : 0;
                var hoursPerDay = rigsRequired > 0
                    ? Math.max(2, Math.min(12, Math.ceil((deficit / model.supplementDli) * 12)))
                    : 0;
                var daysInMonth = new Date(new Date().getFullYear(), month, 0).getDate();
                var kwh = rigsRequired * model.powerKw * hoursPerDay * daysInMonth;
                var cost = kwh * context.kwhRate;

                if (rigsRequired > 0) activeMonths.push(month);
                if (rigsRequired > peakRigs) peakRigs = rigsRequired;
                totalKwh += kwh;
                totalCost += cost;

                months.push({
                    month: month,
                    month_name: monthNames[month - 1],
                    rigs_required: rigsRequired,
                    hours_per_day: hoursPerDay,
                    ambient_dli: ambientDli,
                    target_dli: targetDli,
                    kwh: Math.round(kwh),
                    cost: Math.round(cost),
                    cost_formatted: currencySymbol + Math.round(cost).toLocaleString()
                });
            }

            var deploymentPeriod = activeMonths.length
                ? monthNames[activeMonths[0] - 1] + ' to ' + monthNames[activeMonths[activeMonths.length - 1] - 1]
                : 'No supplemental lighting required';
            var equipmentRecommendation = peakRigs > model.currentRigs
                ? 'Peak demand is ' + peakRigs + ' rigs. Add ' + (peakRigs - model.currentRigs) + ' to cover the full deficit footprint.'
                : 'Current fleet can cover the projected monthly demand.';

            return {
                rig_model: context.rigModel,
                currency: context.currency,
                kwh_rate: context.kwhRate,
                months: months,
                annual: {
                    total_kwh: Math.round(totalKwh),
                    power_kw: model.powerKw,
                    total_cost: Math.round(totalCost),
                    total_formatted: currencySymbol + Math.round(totalCost).toLocaleString()
                },
                summary: {
                    deployment_period: deploymentPeriod,
                    peak_rigs_required: peakRigs,
                    summary_text: peakRigs > 0
                        ? 'The strongest supplemental demand falls in ' + deploymentPeriod + '. Plan for up to ' + peakRigs + ' rigs at peak deficit and reduce runtime through warmer, brighter months.'
                        : 'Ambient and shaded DLI stay close enough to target that routine supplemental deployment is not projected.',
                    equipment_recommendation: {
                        recommendation: equipmentRecommendation
                    }
                }
            };
        },

        renderLocalSeasonalPlan: function(result) {
            var self = this;
            var summary = result.summary || {};
            var annual = result.annual || {};
            var rows = (result.months || []).map(function(month) {
                var status = month.rigs_required > 0 ? month.rigs_required + ' rigs' : 'Monitor';
                return '<tr style="border-bottom:1px solid #e5e7eb;">' +
                    '<td style="padding:8px 10px;">' + month.month_name + '</td>' +
                    '<td style="padding:8px 10px;text-align:center;">' + month.rigs_required + '</td>' +
                    '<td style="padding:8px 10px;text-align:center;">' + month.hours_per_day + '</td>' +
                    '<td style="padding:8px 10px;text-align:center;">' + month.ambient_dli + '</td>' +
                    '<td style="padding:8px 10px;text-align:center;">' + month.target_dli + '</td>' +
                    '<td style="padding:8px 10px;text-align:right;">' + Math.round(month.kwh).toLocaleString() + '</td>' +
                    '<td style="padding:8px 10px;text-align:right;">' + month.cost_formatted + '</td>' +
                    '<td style="padding:8px 10px;text-align:center;">' + status + '</td>' +
                '</tr>';
            }).join('');

            return '<div class="gssh-analysis-summary" style="background:#f8fafc;border:1px solid #e5e7eb;border-radius:8px;padding:14px;">' +
                '<h3 style="margin:0 0 10px;color:#111827;">Seasonal lighting projection</h3>' +
                '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px;margin-bottom:14px;">' +
                    '<div><span style="font-size:11px;color:#6b7280;">Rig model</span><strong style="display:block;">' + result.rig_model + '</strong></div>' +
                    '<div><span style="font-size:11px;color:#6b7280;">Peak rigs</span><strong style="display:block;">' + (summary.peak_rigs_required || 0) + '</strong></div>' +
                    '<div><span style="font-size:11px;color:#6b7280;">Deployment period</span><strong style="display:block;">' + (summary.deployment_period || '—') + '</strong></div>' +
                    '<div><span style="font-size:11px;color:#6b7280;">Annual energy</span><strong style="display:block;">' + Math.round(annual.total_kwh || 0).toLocaleString() + ' kWh</strong></div>' +
                    '<div><span style="font-size:11px;color:#6b7280;">Annual cost</span><strong style="display:block;">' + (annual.total_formatted || (self.getCurrencySymbol(result.currency) + '0')) + '</strong></div>' +
                '</div>' +
                '<p style="margin:0 0 12px;color:#334155;">' + (summary.summary_text || '') + '</p>' +
                '<p style="margin:0 0 14px;color:#475569;"><strong>Equipment:</strong> ' + ((summary.equipment_recommendation && summary.equipment_recommendation.recommendation) || '—') + '</p>' +
                '<div style="overflow:auto;"><table style="width:100%;border-collapse:collapse;background:#fff;border:1px solid #e5e7eb;border-radius:6px;overflow:hidden;">' +
                    '<thead><tr style="background:#f1f5f9;"><th style="padding:8px 10px;text-align:left;">Month</th><th style="padding:8px 10px;text-align:center;">Rigs</th><th style="padding:8px 10px;text-align:center;">Hrs/Day</th><th style="padding:8px 10px;text-align:center;">Ambient DLI</th><th style="padding:8px 10px;text-align:center;">Target DLI</th><th style="padding:8px 10px;text-align:right;">Energy</th><th style="padding:8px 10px;text-align:right;">Cost</th><th style="padding:8px 10px;text-align:center;">Action</th></tr></thead>' +
                    '<tbody>' + rows + '</tbody>' +
                '</table></div>' +
            '</div>';
        },

        renderLocalRigResult: function(result) {
            var summary = result.summary;
            var eue = result.eue;
            var zonesJson = JSON.stringify(result.zones).replace(/'/g, '&#39;');
            var healthJson = JSON.stringify(result.health_projection).replace(/'/g, '&#39;');
            var rows = result.zones.slice(0, Math.max(summary.rigs_required, 1)).map(function(z, i) {
                var status = z.status === 'warning'
                    ? '<span style="color:#ef4444;">Warning -' + z.shortfall + ' mol</span>'
                    : z.status === 'recommended'
                        ? '<span style="color:#d97706;">Recommended</span>'
                        : '<span style="color:#22c55e;">OK</span>';
                return '<tr style="border-bottom:1px solid #e5e7eb;">' +
                    '<td style="padding:8px;">' + (i + 1) + '</td>' +
                    '<td style="padding:8px;font-weight:700;">' + z.rig_id + '</td>' +
                    '<td style="padding:8px;text-align:center;">(' + z.x + 'm, ' + z.y + 'm)</td>' +
                    '<td style="padding:8px;text-align:center;color:#d97706;">' + z.deficit + ' mol</td>' +
                    '<td style="padding:8px;text-align:center;color:#2563eb;font-weight:700;">' + z.hours + 'h</td>' +
                    '<td style="padding:8px;text-align:center;">' + status + '</td>' +
                    '</tr>';
            }).join('');

            return '<div class="gssh-analysis-summary" style="background:#f8fafc;border:1px solid #e5e7eb;border-radius:8px;padding:14px;">' +
                '<h3 style="margin:0 0 10px;color:#111827;">Rig placement projection</h3>' +
                '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(135px,1fr));gap:10px;margin-bottom:14px;">' +
                    '<div><span style="font-size:11px;color:#6b7280;">Model</span><strong style="display:block;">' + result.rig_model_label + '</strong></div>' +
                    '<div><span style="font-size:11px;color:#6b7280;">DLI gap</span><strong style="display:block;">' + eue.deficit_mol + ' mol</strong></div>' +
                    '<div><span style="font-size:11px;color:#6b7280;">Rigs required</span><strong id="gssh-rigs-needed" style="display:block;">' + summary.rigs_required + '</strong></div>' +
                    '<div><span style="font-size:11px;color:#6b7280;">Area covered</span><strong id="gssh-area-covered" style="display:block;">' + (summary.rigs_required * summary.rig_coverage_sqm).toLocaleString() + 'm²</strong></div>' +
                    '<div><span style="font-size:11px;color:#6b7280;">Est. health</span><strong id="gssh-est-health" style="display:block;">—</strong></div>' +
                    '<div><span style="font-size:11px;color:#6b7280;">Daily energy</span><strong style="display:block;">' + summary.daily_kwh + ' kWh</strong></div>' +
                '</div>' +
                '<label style="display:flex;gap:10px;align-items:center;margin:10px 0 14px;font-size:13px;font-weight:600;">Coverage target ' +
                    '<input id="gssh-coverage-slider" type="range" min="5" max="100" step="5" value="' + summary.target_coverage_pct + '" style="flex:1;">' +
                    '<span id="gssh-coverage-value">' + summary.target_coverage_pct + '%</span>' +
                '</label>' +
                '<div id="gssh-slider-config" data-deficit-area="' + summary.deficit_area_sqm + '" data-rig-coverage="' + summary.rig_coverage_sqm + '" data-current-rigs="' + summary.current_rigs + '" data-ghost-rigs="' + summary.ghost_rigs + '" data-month-name="' + result.month_name + '" data-rotation-days="5" data-supplement-dli="' + eue.supplement_dli + '" data-zones=\'' + zonesJson + '\' data-health-projection=\'' + healthJson + '\'></div>' +
                '<div id="gssh-health-trajectory-container" style="margin:12px 0;"></div>' +
                '<div id="gssh-dynamic-rotation" style="display:none;margin:12px 0;"><h4 style="margin:0 0 8px;color:#111827;">Rotation schedule</h4><div id="gssh-rotation-content"></div></div>' +
                '<div style="overflow:auto;"><table style="width:100%;border-collapse:collapse;background:#fff;border:1px solid #e5e7eb;border-radius:6px;overflow:hidden;">' +
                    '<thead><tr style="background:#f1f5f9;"><th style="padding:8px;text-align:left;">#</th><th style="padding:8px;text-align:left;">Rig</th><th style="padding:8px;">Position</th><th style="padding:8px;">Deficit</th><th style="padding:8px;">Hours</th><th style="padding:8px;">Status</th></tr></thead>' +
                    '<tbody id="gssh-rig-table-body">' + rows + '</tbody>' +
                '</table></div>' +
                '<svg width="0" height="0" style="position:absolute;"><text id="gssh-svg-rigs-required"></text><text id="gssh-svg-coverage"></text><text id="gssh-svg-covered-zones"></text><text id="gssh-svg-uncovered-zones"></text></svg>' +
            '</div>';
        },

        /**
         * Load rig calculation locally.
         */
        loadRigCalculation: function(overrideCoveragePct) {
            // Fallback: if currentVenue not set, try UnifiedVenueSelector
            if (!this.currentVenue) {
                var uvs = global.GSSH_UnifiedVenueSelector;
                if (uvs && uvs.currentVenue) {
                    var vid = uvs.currentVenue;
                    var venues = uvs.venues || uvs.ALL_STADIUMS || {};
                    var v = venues[vid];
                    if (v) {
                        this.currentVenue = { venue_id: vid, name: v.name, lat: v.lat, lng: v.lng };
                    }
                }
            }
            if (!this.currentVenue) return;

            const container = document.getElementById('gssh-rig-results');
            if (!container) return;

            const rigModel = document.getElementById('gssh-rig-model');
            const rigMonth = document.getElementById('gssh-rig-month');
            container.innerHTML = '<p class="gssh-loading">Calculating rig placement...</p>';

            var hubState = global.GSSH_CANONICAL_STATE || global._hubState || {};
            var turfState = hubState.turf || {};
            var shadeState = (hubState.computed || {}).shade || {};
            var forwardVariety = turfState.effectiveVariety || turfState.variety;

            // Send coverage % — use the captured value if available (slider may have reset to
            // default by the time this runs), otherwise fall back to current DOM value.
            var coveragePct = (overrideCoveragePct !== undefined && overrideCoveragePct !== null)
                ? overrideCoveragePct
                : (function() {
                    var s = document.getElementById('gssh-coverage-slider');
                    return (s && s.value !== '') ? parseFloat(s.value) : null;
                }());
            if (coveragePct === null) coveragePct = 10;

            var result = this.calculateLocalRigPlacement({
                venue: this.currentVenue,
                rigModel: rigModel ? rigModel.value : 'sgl_lu440',
                month: rigMonth ? parseInt(rigMonth.value, 10) : (new Date().getMonth() + 1),
                roofState: this.getRoofStateForRig(),
                variety: forwardVariety,
                targetDli: shadeState.targetDLI || shadeState.target_dli || null,
                ambientDli: shadeState.ambientDLI || shadeState.dli_ambient || null,
                shadeState: shadeState,
                coveragePct: coveragePct,
                climate: this.getLocalClimateContext()
            });

            global.GSSH_LAST_RIG_RESULT = {
                venue:      global.GSSH_UnifiedVenueSelector ? global.GSSH_UnifiedVenueSelector.getCurrentVenue() : this.currentVenue,
                rigModel:   result.rig_model,
                month:      result.month,
                eue:        result.eue,
                readiness:  result.venue_readiness,
                summary:    result.summary,
                dliContext: result.dli_context,
                timestamp:  new Date().toISOString()
            };

            container.innerHTML = this.renderLocalRigResult(result);
            setTimeout(function() {
                if (window.gsshSetCoverage) {
                    window.gsshSetCoverage(coveragePct);
                } else if (window.gsshUpdateCoverage) {
                    window.gsshUpdateCoverage(coveragePct);
                }
            }, 50);
        },

        /**
         * Load seasonal plan locally.
         */
        loadSeasonalPlan: function() {
            if (!this.currentVenue) {
                var uvs = global.GSSH_UnifiedVenueSelector;
                if (uvs && uvs.currentVenue) {
                    var vid = uvs.currentVenue;
                    var venues = uvs.venues || uvs.ALL_STADIUMS || {};
                    var v = venues[vid];
                    if (v) {
                        this.currentVenue = { venue_id: vid, name: v.name, lat: v.lat, lng: v.lng };
                    }
                }
            }
            if (!this.currentVenue) return;

            const container = document.getElementById('gssh-planner-results');
            if (!container) return;

            container.innerHTML = '<p class="gssh-loading">Generating seasonal plan...</p>';

            const currency = document.getElementById('gssh-planner-currency');
            const kwhRate = document.getElementById('gssh-planner-kwh-rate');
            const rigModel = document.getElementById('gssh-rig-model');
            var hubState = global.GSSH_CANONICAL_STATE || global._hubState || {};
            var turfState = hubState.turf || {};
            var shadeState = (hubState.computed || {}).shade || {};
            var forwardVariety = turfState.effectiveVariety || turfState.variety;
            var result = this.calculateLocalSeasonalPlan({
                venue: this.currentVenue,
                rigModel: rigModel ? rigModel.value : 'sgl_lu440',
                currency: currency ? currency.value : 'AUD',
                kwhRate: kwhRate ? parseFloat(kwhRate.value) : 0.30,
                roofState: this.getRoofStateForRig(),
                variety: forwardVariety,
                targetDli: shadeState.targetDLI || shadeState.target_dli || null,
                ambientDli: shadeState.ambientDLI || shadeState.dli_ambient || null,
                shadeState: shadeState,
                climate: this.getLocalClimateContext()
            });

            global.GSSH_LAST_SEASONAL_RESULT = {
                venue:     global.GSSH_UnifiedVenueSelector ? global.GSSH_UnifiedVenueSelector.getCurrentVenue() : this.currentVenue,
                rigModel:  result.rig_model,
                months:    result.months,
                annual:    result.annual,
                summary:   result.summary,
                currency:  result.currency,
                kwhRate:   result.kwh_rate,
                timestamp: new Date().toISOString()
            };

            container.innerHTML = this.renderLocalSeasonalPlan(result);
        },

        // =====================================================================
        // FALLBACK TAB INJECTION
        // =====================================================================

        injectTabFallback: function() {
            // Guard against double injection
            if (document.getElementById('gssh-stadium-tab-wrapper')) {
                console.log('[StadiumTabUI] Wrapper already exists');
                return;
            }

            // tab-navigation.js initialises with a 600ms delay — wait for it.
            // Retry up to 6 times (3s total) before falling back to gssh-hub mode.
            var tabNavPresent = !!(global.GilbaTabNav && document.getElementById('gaip-tab-navigation'));
            if (!tabNavPresent) {
                this._tabNavRetries = (this._tabNavRetries || 0) + 1;
                if (this._tabNavRetries <= 6) {
                    setTimeout(this.injectTabFallback.bind(this), 500);
                    return;
                }
                // After 6 retries give up waiting and use gssh-hub fallback
                console.log('[StadiumTabUI] GilbaTabNav not found after retries — using gssh-hub fallback');
            }
            // Reset retry counter so hub-not-found retries work independently
            this._tabNavRetries = 0;
            var hubId = tabNavPresent ? 'gaip-hub' : 'gssh-hub';
            const hub = document.getElementById(hubId);
            if (!hub) {
                this._tabFallbackRetries = (this._tabFallbackRetries || 0) + 1;
                if (this._tabFallbackRetries <= 10) {
                    console.log('[StadiumTabUI] #' + hubId + ' not found, retrying in 500ms');
                    setTimeout(this.injectTabFallback.bind(this), 500);
                } else {
                    console.warn('[StadiumTabUI] #' + hubId + ' not found after 10 retries — stadium tab injection aborted.');
                }
                return;
            }

            const wrapper = document.createElement('div');
            wrapper.id = 'gssh-stadium-tab-wrapper';
            // gaip-tab-hidden is managed by tab-navigation.js setVisible()
            // gssh-tab-hidden retained for legacy GSSH-mode compatibility
            wrapper.className = 'gssh-stadium-tab-wrapper gaip-tab-hidden gssh-tab-hidden';
            wrapper.innerHTML = this.renderStadiumSection();

            // Insert after GAIP tab bar when present, else legacy positions
            const gaipTabBar = document.getElementById('gaip-tab-navigation');
            const gsshTabBar = hub.querySelector('#gssh-tab-bar');
            const grid = hub.querySelector('.gssh-grid') || hub.querySelector('.gaip-grid');

            if (tabNavPresent && gaipTabBar && gaipTabBar.nextSibling) {
                gaipTabBar.parentNode.insertBefore(wrapper, gaipTabBar.nextSibling);
                console.log('[StadiumTabUI] Injected after GAIP tab bar');
            } else if (gsshTabBar && gsshTabBar.nextSibling) {
                hub.insertBefore(wrapper, gsshTabBar.nextSibling);
                console.log('[StadiumTabUI] Injected after GSSH tab bar');
            } else if (grid) {
                hub.insertBefore(wrapper, grid);
                console.log('[StadiumTabUI] Injected before grid');
            } else {
                hub.appendChild(wrapper);
                console.log('[StadiumTabUI] Appended to hub');
            }

            // If stadium tab is currently active, show immediately
            const activeTab = (global.GilbaTabNav || global.GSSH_TabNavigation || {});
            if (activeTab.getActiveTab && activeTab.getActiveTab() === 'stadium') {
                wrapper.classList.remove('gssh-tab-hidden');
                wrapper.style.display = '';
                console.log('[StadiumTabUI] Stadium active, showing wrapper');
            }

            // Trigger UnifiedVenueSelector setup now that the stadium DOM exists.
            // populateStadiumDropdown() needs #gssh-stadium-venue-select which
            // lives inside the wrapper we just injected. On the first page-load
            // call the dropdown wasn't present so init() left initialized=false —
            // this call completes it. No need to reset initialized: the flag is
            // only true if setup() already completed successfully (Bug 2 fix).
            if (global.GSSH_UnifiedVenueSelector) {
                global.GSSH_UnifiedVenueSelector.init();
            }
        }
    };

    // =========================================================================
    // EXPOSE & INITIALIZE
    // =========================================================================

    global.GSSH_StadiumTabUI = StadiumTabUI;

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function() {
            StadiumTabUI.init();
        });
    } else {
        StadiumTabUI.init();
    }

})(window);
