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
         * and append to a FormData object for PHP AJAX handlers.
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
                                            <optgroup label="SGL, HPS">
                                                <option value="sgl_lu440" selected>SGL LU440 (440m²)</option>
                                                <option value="sgl_lu120">SGL LU120 (120m²)</option>
                                                <option value="sgl_bu50">SGL BU50 (50m²)</option>
                                            </optgroup>
                                            <optgroup label="SGL, LED">
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
        },

        renderShadeSummary: function(shade) {
            const container = document.getElementById('gssh-shade-summary-content');
            if (!container) return;

            const dli = shade.dli_shaded || shade.dli_ambient || '-';
            const target = shade.thresholds?.target || '-';
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
                    detail: `Leaf wetness +${Math.round((lwm - 1) * 100)}%, elevated fungal risk from extended canopy moisture`,
                    severity: lwm > 1.4 ? 'high' : 'moderate'
                });
            }

            // Growth impact
            if (gm < 0.9) {
                impacts.push({
                    icon: '🌱',
                    label: 'Growth Reduction',
                    detail: `Turf growth reduced to ${Math.round(gm * 100)}% of potential, recovery from wear will be slower`,
                    severity: gm < 0.5 ? 'high' : 'moderate'
                });
            }

            // Nutrition impact
            if (sf > 0.2) {
                impacts.push({
                    icon: '🧪',
                    label: 'Nitrogen Demand',
                    detail: `Reduce N application by ${Math.round(sf * 30)}% in shaded zones, excess N promotes weak, disease-susceptible growth in low light`,
                    severity: sf > 0.5 ? 'high' : 'moderate'
                });
            }

            // PGR impact
            if (sf > 0.3) {
                impacts.push({
                    icon: '⚗️',
                    label: 'PGR Caution',
                    detail: 'Reduce or avoid PGR in shaded zones, growth regulation compounds shade stress (Ervin & Koski 1998)',
                    severity: sf > 0.6 ? 'high' : 'moderate'
                });
            }

            // Irrigation impact
            if (shade.shade_percentage > 30) {
                impacts.push({
                    icon: '💧',
                    label: 'Irrigation Adjustment',
                    detail: `Reduce irrigation ${Math.round(shade.shade_percentage * 0.3)}% in shaded zones, lower evapotranspiration but maintain drainage`,
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
                const target = shade.thresholds?.target || '-';
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
        // AJAX FETCH METHODS
        // =====================================================================

        /**
         * Load shade visualization via AJAX
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

            const config = global.GSSH_HUB_CONFIG || global.GSSH_STADIUM_CONFIG || {};
            const nonce = config.nonce || '';

            // Defer if nonce not yet available
            if (!nonce) {
                var self = this;
                setTimeout(function() { self.loadShadeVisualization(venueId, mode); }, 500);
                return;
            }

            const data = new FormData();
            data.append('nonce', nonce);
            data.append('venue_id', venueId);
            data.append('date', date);
            data.append('mode', mode || 'series');
            data.append('time', time);

            // Forward real climate data from Hub's Open-Meteo fetch
            this.appendHubClimateData(data);

            fetch((config.restUrl || '/api/').replace(/\/+$/, '') + '/stadium/shade-render', {
                method: 'POST',
                body: data,
                credentials: 'same-origin',
                headers: {
                    'X-CSRF-TOKEN': config.csrfToken || config.restNonce || config.nonce || ''
                }
            })
            .then(function(r) { return r.json(); })
            .then(function(result) {
                if (result.success && result.data && result.data.html) {
                    container.innerHTML = result.data.html;
                    // Execute any inline scripts (innerHTML doesn't run <script> tags)
                    container.querySelectorAll('script').forEach(function(oldScript) {
                        var newScript = document.createElement('script');
                        newScript.textContent = oldScript.textContent;
                        oldScript.parentNode.replaceChild(newScript, oldScript);
                    });
                } else {
                    container.innerHTML = '<p class="gssh-error">Shade analysis unavailable: ' + 
                        (result.data?.message || 'Unknown error') + '</p>';
                }
            })
            .catch(function(err) {
                container.innerHTML = '<p class="gssh-error">Failed to load shade analysis: ' + err.message + '</p>';
            });
        },

        /**
         * Load rig calculation via AJAX
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

            const config = global.GSSH_HUB_CONFIG || global.GSSH_STADIUM_CONFIG || {};
            const nonce = config.nonce || '';

            // Defer if nonce not yet available (matches guard pattern in loadShadeVisualization)
            if (!nonce) {
                var self = this;
                var capturedCoverage = overrideCoveragePct;
                setTimeout(function() { self.loadRigCalculation(capturedCoverage); }, 500);
                return;
            }

            const data = new FormData();
            data.append('nonce', nonce);
            data.append('venue_id', this.currentVenue.venue_id);
            data.append('rig_model', rigModel ? rigModel.value : 'SGL_MU460');
            data.append('month', rigMonth ? rigMonth.value : (new Date().getMonth() + 1));

            // b35fix250: forward roof state so PHP can attenuate hub_ambient_dli.
            // Mirrors the logic in shade-orchestrator.js getRoofStateParam().
            var _roofStateForRig = (function() {
                var cfg = global.GSSH_EUE_Bridge &&
                          typeof global.GSSH_EUE_Bridge.getVenueEnvConfig === 'function'
                          ? global.GSSH_EUE_Bridge.getVenueEnvConfig() : null;
                if (!cfg || !cfg.enclosureType) return 'open';
                if (cfg.enclosureType === 'retractable_closed') return 'closed';
                if (cfg.enclosureType === 'fixed_roof' || cfg.enclosureType === 'enclosed') return 'closed';
                return 'open';
            }());
            data.append('roof_state', _roofStateForRig);

            // Forward hub context for accurate variety/DLI resolution
            var hubState = global.GSSH_CANONICAL_STATE || global._hubState || {};
            var turfState = hubState.turf || {};
            var shadeState = (hubState.computed || {}).shade || {};
            // Use effectiveVariety — reflects overseed dominance correctly.
            // effectiveVariety = overseed variety when overseedDominant, base variety otherwise.
            var forwardVariety = turfState.effectiveVariety || turfState.variety;
            if (forwardVariety) {
                data.append('variety', forwardVariety);
            }
            if (shadeState.targetDLI) {
                data.append('target_dli', shadeState.targetDLI);
            }
            if (shadeState.ambientDLI) {
                data.append('ambient_dli', shadeState.ambientDLI);
            }

            // Send coverage % — use the captured value if available (slider may have reset to
            // default by the time this runs), otherwise fall back to current DOM value.
            var coveragePct = (overrideCoveragePct !== undefined && overrideCoveragePct !== null)
                ? overrideCoveragePct
                : (function() {
                    var s = document.getElementById('gssh-coverage-slider');
                    return (s && s.value !== '') ? parseFloat(s.value) : null;
                }());
            if (coveragePct !== null) {
                data.append('target_coverage_pct', coveragePct);
            }

            // Forward real climate data (GHI, DLI, temperature) from Hub's Open-Meteo fetch
            this.appendHubClimateData(data);

            // Send venue environment config for server-side EUE calculation
            var venueEnv = (global.GSSH_EUE_Bridge && typeof global.GSSH_EUE_Bridge.getVenueEnvConfig === 'function')
                ? global.GSSH_EUE_Bridge.getVenueEnvConfig()
                : null;
            if (venueEnv) {
                var envKeys = Object.keys(venueEnv);
                for (var ei = 0; ei < envKeys.length; ei++) {
                    var ek = envKeys[ei];
                    if (venueEnv[ek] !== null && venueEnv[ek] !== undefined) {
                        data.append('venue_environment[' + ek + ']', venueEnv[ek]);
                    }
                }
            }

            fetch((config.restUrl || '/api/').replace(/\/+$/, '') + '/stadium/rig-calculate', {
                method: 'POST',
                body: data,
                credentials: 'same-origin',
                headers: {
                    'X-CSRF-TOKEN': config.csrfToken || config.restNonce || config.nonce || ''
                }
            })
            .then(function(r) { return r.json(); })
            .then(function(result) {
                if (result.success && result.data) {
                    // Cache structured data for LED export module
                    global.GSSH_LAST_RIG_RESULT = {
                        venue:      global.GSSH_UnifiedVenueSelector ? global.GSSH_UnifiedVenueSelector.getCurrentVenue() : null,
                        rigModel:   result.data.rig_model || (rigModel ? rigModel.value : 'SGL_MU460'),
                        month:      rigMonth ? parseInt(rigMonth.value) : (new Date().getMonth() + 1),
                        eue:        result.data.eue || null,
                        readiness:  result.data.venue_readiness || null,
                        summary:    result.data.summary || null,
                        dliContext: result.data.dli_context || null,
                        timestamp:  new Date().toISOString()
                    };
                    if (result.data.html) {
                        // Restore the slider to the value we calculated with, so the UI
                        // stays in sync — the fresh PHP HTML always defaults to 10%.
                        var restorePct = coveragePct;
                        container.innerHTML = result.data.html;
                        if (restorePct !== null) {
                            // Small delay so MutationObserver fires first (resets to 10),
                            // then we override it back to the correct position.
                            setTimeout(function() {
                                if (window.gsshSetCoverage) {
                                    window.gsshSetCoverage(restorePct);
                                } else {
                                    var s = document.getElementById('gssh-coverage-slider');
                                    if (s) {
                                        s.value = restorePct;
                                        if (window.gsshUpdateCoverage) window.gsshUpdateCoverage(restorePct);
                                    }
                                }
                            }, 50);
                        }
                    } else if (result.data.result) {
                        container.innerHTML = '<pre>' + JSON.stringify(result.data.result, null, 2) + '</pre>';
                    }
                } else {
                    container.innerHTML = '<p class="gssh-error">Rig calculation failed: ' + 
                        (result.data?.message || 'Unknown error') + '</p>';
                }
            })
            .catch(function(err) {
                container.innerHTML = '<p class="gssh-error">Failed: ' + err.message + '</p>';
            });
        },

        /**
         * Load seasonal plan via AJAX
         */
        loadSeasonalPlan: function() {
            if (!this.currentVenue) return;

            const container = document.getElementById('gssh-planner-results');
            if (!container) return;

            container.innerHTML = '<p class="gssh-loading">Generating seasonal plan...</p>';

            const config = global.GSSH_HUB_CONFIG || global.GSSH_STADIUM_CONFIG || {};
            const nonce = config.nonce || '';

            // Defer if nonce not yet available (matches guard pattern in loadShadeVisualization)
            if (!nonce) {
                var self = this;
                setTimeout(function() { self.loadSeasonalPlan(); }, 500);
                return;
            }

            const currency = document.getElementById('gssh-planner-currency');
            const kwhRate = document.getElementById('gssh-planner-kwh-rate');
            const rigModel = document.getElementById('gssh-rig-model');

            const data = new FormData();
            data.append('nonce', config.nonce || '');
            data.append('venue_id', this.currentVenue.venue_id);
            data.append('rig_model', rigModel ? rigModel.value : 'SGL_MU460');
            data.append('currency', currency ? currency.value : 'AUD');
            data.append('kwh_rate', kwhRate ? kwhRate.value : '0.30');

            // Forward hub variety context — use effectiveVariety for overseed awareness
            var hubState = global.GSSH_CANONICAL_STATE || global._hubState || {};
            var turfState = hubState.turf || {};
            var forwardVariety = turfState.effectiveVariety || turfState.variety;
            if (forwardVariety) {
                data.append('variety', forwardVariety);
            }

            // Forward real climate data (GHI, DLI, temperature) from Hub's Open-Meteo fetch
            this.appendHubClimateData(data);

            fetch((config.restUrl || '/api/').replace(/\/+$/, '') + '/stadium/seasonal-plan', {
                method: 'POST',
                body: data,
                credentials: 'same-origin',
                headers: {
                    'X-CSRF-TOKEN': config.csrfToken || config.restNonce || config.nonce || ''
                }
            })
            .then(function(r) { return r.json(); })
            .then(function(result) {
                if (result.success && result.data) {
                    // Cache for LED export module
                    global.GSSH_LAST_SEASONAL_RESULT = {
                        venue:     global.GSSH_UnifiedVenueSelector ? global.GSSH_UnifiedVenueSelector.getCurrentVenue() : null,
                        rigModel:  result.data.rig_model || (rigModel ? rigModel.value : 'SGL_MU460'),
                        months:    result.data.months || null,
                        annual:    result.data.annual || null,
                        summary:   result.data.summary || null,
                        currency:  result.data.currency || (currency ? currency.value : 'AUD'),
                        kwhRate:   result.data.kwh_rate || (kwhRate ? parseFloat(kwhRate.value) : 0.30),
                        timestamp: new Date().toISOString()
                    };
                    if (result.data.html) {
                        container.innerHTML = result.data.html;
                    } else if (result.data.result) {
                        container.innerHTML = '<pre>' + JSON.stringify(result.data.result, null, 2) + '</pre>';
                    }
                } else {
                    container.innerHTML = '<p class="gssh-error">Seasonal plan failed: ' + 
                        (result.data?.message || 'Unknown error') + '</p>';
                }
            })
            .catch(function(err) {
                container.innerHTML = '<p class="gssh-error">Failed: ' + err.message + '</p>';
            });
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
                console.log('[StadiumTabUI] GilbaTabNav not found after retries, using gssh-hub fallback');
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
                    console.warn('[StadiumTabUI] #' + hubId + ' not found after 10 retries, stadium tab injection aborted.');
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
