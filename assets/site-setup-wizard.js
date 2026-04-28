/**
 * Site Setup Wizard v1.0.0
 * 
 * First-run onboarding wizard for the Gilba Agronomic Intelligence Hub.
 * Walks new users through: Location → Turf Type → Species & Methodology → Summary.
 * 
 * On completion:
 *   1. Programmatically sets DOM inputs (lat, lon, turf type, species, methodology)
 *   2. Calls GaipTurfProfile.dispatchStateChange() so all engines respond
 *   3. Triggers location save via existing AJAX handler
 *   4. Marks wizard complete via user_meta so it doesn't show again
 *   5. Fires 'gaip:wizard-complete' custom event for any listeners
 * 
 * Dependencies: turf-profile-controller.js, regional-profiles.js
 * Requires: GAIP_WIZARD_CONFIG (from wp_localize_script)
 */
!(function() {
    'use strict';
    // b35fix272: namespaced storage — prevents cross-mode key bleed
    var _ls = window.GilbaStorageNS ? window.GilbaStorageNS.get() : localStorage;


    const WIZARD_VERSION = '1.0.0';
    const WIZARD_STORAGE_KEY = 'gilba_wizard_complete';

    window.GaipSetupWizard = {

        currentStep: 0,
        totalSteps: 5,
        overlay: null,
        modal: null,

        // Collected wizard state
        data: {
            location: null,      // { lat, lon, name }
            turfType: null,      // 'golf' | 'sports' | 'lawns'
            subCategory: null,   // 'greens' | 'fairways' | 'tees' | etc.
            species: null,       // species value string
            variety: null,       // variety/cultivar value string
            methodology: null,   // 'mlsn' | 'slan' | 'ammonium_acetate'
        },

        // ================================================================
        // INIT
        // ================================================================

        init: function() {

            // Respect manual re-trigger
            if (window.GAIP_FORCE_WIZARD) {
                // Pre-populate from existing turf profile so steps aren't blocked
                const tp = window.GaipTurfProfile;
                const existingState = (tp && tp.state) || window.GAIP_STATE?.turf || {};
                const domTurfType   = document.querySelector('.gaip-turf-type')?.value || null;
                const domSpecies    = document.querySelector('.gaip-species')?.value || null;
                const domMethodology = document.querySelector('.gaip-methodology, [name="gaip-methodology"]')?.value || null;
                const domSubCat     = document.querySelector('.gaip-sub-category')?.value || null;

                this.data.turfType    = existingState.turfType    || domTurfType    || null;
                this.data.subCategory = existingState.subCategory || domSubCat      || null;
                this.data.species     = existingState.species     || domSpecies      || null;
                this.data.methodology = existingState.methodology || domMethodology  || null;

                // Pre-fill location from GAIP_WIZARD_CONFIG if available
                if (typeof GAIP_WIZARD_CONFIG !== 'undefined' && GAIP_WIZARD_CONFIG.savedLocation && GAIP_WIZARD_CONFIG.savedLocation.lat) {
                    this.data.location = {
                        lat: parseFloat(GAIP_WIZARD_CONFIG.savedLocation.lat),
                        lon: parseFloat(GAIP_WIZARD_CONFIG.savedLocation.lon),
                        name: GAIP_WIZARD_CONFIG.savedLocation.name || ''
                    };
                }

                this.show();
                return;
            }

            // Check server-side flag first (from wp_localize_script)
            if (typeof GAIP_WIZARD_CONFIG !== 'undefined') {
                if (GAIP_WIZARD_CONFIG.wizardComplete) {
                    return;
                }
                // Pre-fill location from saved data if available
                if (GAIP_WIZARD_CONFIG.savedLocation && GAIP_WIZARD_CONFIG.savedLocation.lat) {
                    this.data.location = {
                        lat: parseFloat(GAIP_WIZARD_CONFIG.savedLocation.lat),
                        lon: parseFloat(GAIP_WIZARD_CONFIG.savedLocation.lon),
                        name: GAIP_WIZARD_CONFIG.savedLocation.name || ''
                    };
                    this.syncLocationToDOM();
                }
            }

            // Fallback: check localStorage for non-logged-in users
            if (_ls.getItem(WIZARD_STORAGE_KEY)) {
                return;
            }

            // Also skip if user already has saved profiles (returning user)
            const existingProfiles = _ls.getItem('gilba_turf_profiles');
            if (existingProfiles) {
                try {
                    const profiles = JSON.parse(existingProfiles);
                    if (Object.keys(profiles).length > 0) {
                        return;
                    }
                } catch(e) { /* ignore parse errors */ }
            }

            this.show();
        },

        // ================================================================
        // MODAL CONSTRUCTION
        // ================================================================

        show: function() {
            this.buildOverlay();
            this.renderStep();
            document.body.style.overflow = 'hidden';
        },

        buildOverlay: function() {
            // Overlay
            this.overlay = document.createElement('div');
            this.overlay.id = 'gaip-wizard-overlay';
            this.overlay.innerHTML = '';
            Object.assign(this.overlay.style, {
                position: 'fixed',
                top: '0',
                left: '0',
                width: '100%',
                height: '100%',
                background: 'rgba(0, 0, 0, 0.6)',
                zIndex: '100000',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                backdropFilter: 'blur(4px)'
            });

            // Modal container
            this.modal = document.createElement('div');
            this.modal.id = 'gaip-wizard-modal';
            Object.assign(this.modal.style, {
                background: 'var(--gaip-surface)',
                borderRadius: '12px',
                width: '90%',
                maxWidth: '560px',
                maxHeight: '85vh',
                overflowY: 'auto',
                boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
                position: 'relative',
                color: 'var(--gaip-text)'
            });

            this.overlay.appendChild(this.modal);
            document.body.appendChild(this.overlay);
        },

        // ================================================================
        // STEP RENDERING
        // ================================================================

        renderStep: function() {
            const steps = [
                this.renderStep0_Welcome,
                this.renderStep1_Location,
                this.renderStep2_TurfType,
                this.renderStep3_SpeciesMethod,
                this.renderStep4_WhatNow,
            ];

            this.modal.innerHTML = '';
            this.modal.appendChild(this.buildProgressBar());

            const content = document.createElement('div');
            content.style.padding = '24px 28px 20px';
            // Append content to modal FIRST so step functions can query their DOM
            this.modal.appendChild(content);
            steps[this.currentStep].call(this, content);

            this.modal.appendChild(this.buildNavButtons());
        },

        buildProgressBar: function() {
            const bar = document.createElement('div');
            Object.assign(bar.style, {
                display: 'flex',
                gap: '4px',
                padding: '16px 28px 0',
            });

            for (let i = 0; i < this.totalSteps; i++) {
                const seg = document.createElement('div');
                Object.assign(seg.style, {
                    flex: '1',
                    height: '4px',
                    borderRadius: '2px',
                    background: i <= this.currentStep ? '#166534' : 'var(--gaip-border)',
                    transition: 'background 0.3s ease'
                });
                bar.appendChild(seg);
            }
            return bar;
        },

        buildNavButtons: function() {
            const nav = document.createElement('div');
            Object.assign(nav.style, {
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '12px 28px 20px',
                borderTop: '1px solid var(--gaip-surface-hover)'
            });

            // Back button
            const back = document.createElement('button');
            back.type = 'button';
            back.textContent = this.currentStep === 0 ? 'Skip Setup' : '← Back';
            Object.assign(back.style, {
                background: 'none',
                border: 'none',
                color: 'var(--gaip-text-secondary)',
                cursor: 'pointer',
                fontSize: '14px',
                padding: '8px 0',
                fontFamily: 'inherit'
            });
            back.addEventListener('click', () => {
                if (this.currentStep === 0) {
                    this.skipWizard();
                } else {
                    this.currentStep--;
                    this.renderStep();
                }
            });

            // Next / Finish button
            const isLast = this.currentStep === this.totalSteps - 1;
            const canProceed = this.canProceedFromStep();

            const next = document.createElement('button');
            next.type = 'button';
            next.textContent = isLast ? 'Launch Hub →' : 'Next →';
            Object.assign(next.style, {
                background: canProceed ? '#166534' : 'var(--gaip-border)',
                color: canProceed ? 'var(--gaip-surface)' : 'var(--gaip-text-muted)',
                border: 'none',
                borderRadius: '8px',
                padding: '10px 24px',
                fontSize: '14px',
                fontWeight: '600',
                cursor: canProceed ? 'pointer' : 'not-allowed',
                fontFamily: 'inherit',
                transition: 'background 0.2s'
            });
            next.addEventListener('click', () => {
                if (!canProceed) return;
                if (isLast) {
                    this.applyAndClose();
                } else {
                    this.currentStep++;
                    this.renderStep();
                }
            });

            // Step indicator
            const indicator = document.createElement('span');
            indicator.style.cssText = 'font-size: 12px; color: var(--gaip-text-muted);';
            indicator.textContent = `Step ${this.currentStep + 1} of ${this.totalSteps}`;

            nav.appendChild(back);
            nav.appendChild(indicator);
            nav.appendChild(next);
            return nav;
        },

        canProceedFromStep: function() {
            switch (this.currentStep) {
                case 0: return true; // Welcome - always can proceed
                case 1: return !!this.data.location;
                case 2: {
                    if (!this.data.turfType) return false;
                    if (this.data.turfType === 'golf' && !this.data.subCategory) return false;
                    return true;
                }
                case 3: return !!this.data.species && !!this.data.methodology;
                case 4: return true; // What Now — always can proceed
                default: return false;
            }
        },

        // ================================================================
        // STEP 0: WELCOME
        // ================================================================

        renderStep0_Welcome: function(container) {
            container.innerHTML = `
                <div style="text-align: center; padding: 12px 0;">
                    <div style="font-size: 36px; margin-bottom: 12px;">🌿</div>
                    <h2 style="margin: 0 0 8px; font-size: 22px; color: var(--gaip-text); font-weight: 600;">
                        Welcome to the Gilba Hub
                    </h2>
                    <p style="color: var(--gaip-text-secondary); font-size: 15px; line-height: 1.6; margin: 0 0 20px;">
                        Let's configure your site in three quick steps so every analysis — soil, tissue, 
                        disease, nutrition — uses the right thresholds for your turf.
                    </p>
                    <div style="background: var(--gaip-good-bg); border: 1px solid var(--gaip-good-bg); border-radius: 8px; padding: 14px; text-align: left; font-size: 13px; line-height: 1.6; color: #166534;">
                        <div style="margin-bottom: 6px;"><strong>What we'll set up:</strong></div>
                        <div>📍 Your location (for live weather + climate data)</div>
                        <div>🏟️ Turf type (greens, sports field, etc.)</div>
                        <div>🌱 Species + soil methodology</div>
                    </div>
                    <p style="color: var(--gaip-text-muted); font-size: 12px; margin: 16px 0 0;">
                        You can change all of these anytime in the Turf Profile panel.
                    </p>
                </div>
            `;
        },

        // ================================================================
        // STEP 1: LOCATION
        // ================================================================

        renderStep1_Location: function(container) {
            const self = this;
            const hasLoc = !!this.data.location;

            container.innerHTML = `
                <h3 style="margin: 0 0 4px; font-size: 18px; color: var(--gaip-text); font-weight: 600;">
                    Where is your site?
                </h3>
                <p style="color: var(--gaip-text-secondary); font-size: 13px; margin: 0 0 16px;">
                    This loads regional climate data, species availability, and fungicide registrations.
                </p>

                <label style="display: block; font-size: 12px; font-weight: 600; color: var(--gaip-text-secondary); margin-bottom: 6px; text-transform: uppercase; letter-spacing: 0.5px;">
                    Search location
                </label>
                <div style="position: relative;">
                    <input type="text" id="gaip-wizard-location-search"
                           placeholder="Search suburb, city, or course name..."
                           value="${hasLoc ? this.escHtml(this.data.location.name) : ''}"
                           autocomplete="off"
                           style="width: 100%; padding: 10px 12px; border: 1px solid var(--gaip-border); border-radius: 8px;
                                  font-size: 14px; font-family: inherit; box-sizing: border-box; color: var(--gaip-text);">
                    <div id="gaip-wizard-location-results" style="
                        position: absolute; top: 100%; left: 0; right: 0;
                        background: var(--gaip-surface); border: 1px solid var(--gaip-border); border-radius: 8px;
                        box-shadow: 0 8px 24px rgba(0,0,0,0.12); z-index: 1001;
                        max-height: 200px; overflow-y: auto; display: none;
                    "></div>
                </div>

                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-top: 12px;">
                    <div>
                        <label style="display: block; font-size: 11px; color: var(--gaip-text-muted); margin-bottom: 4px;">Latitude</label>
                        <input type="number" id="gaip-wizard-lat" step="0.0001"
                               value="${hasLoc ? this.data.location.lat : ''}"
                               placeholder="-37.8136"
                               style="width: 100%; padding: 8px 10px; border: 1px solid var(--gaip-border); border-radius: 6px;
                                      font-size: 13px; font-family: inherit; box-sizing: border-box; color: var(--gaip-text);">
                    </div>
                    <div>
                        <label style="display: block; font-size: 11px; color: var(--gaip-text-muted); margin-bottom: 4px;">Longitude</label>
                        <input type="number" id="gaip-wizard-lon" step="0.0001"
                               value="${hasLoc ? this.data.location.lon : ''}"
                               placeholder="144.9631"
                               style="width: 100%; padding: 8px 10px; border: 1px solid var(--gaip-border); border-radius: 6px;
                                      font-size: 13px; font-family: inherit; box-sizing: border-box; color: var(--gaip-text);">
                    </div>
                </div>

                ${hasLoc ? `
                    <div style="margin-top: 12px; padding: 10px; background: var(--gaip-good-bg); border: 1px solid var(--gaip-good-bg);
                                border-radius: 6px; font-size: 13px; color: #166534;">
                        ✓ Location set: ${this.escHtml(this.data.location.name)}
                        (${this.data.location.lat.toFixed(4)}, ${this.data.location.lon.toFixed(4)})
                    </div>
                ` : ''}
            `;

            // Bind geocode search
            this.bindLocationSearch();

            // Bind manual lat/lon entry
            const latInput = document.getElementById('gaip-wizard-lat');
            const lonInput = document.getElementById('gaip-wizard-lon');
            if (latInput && lonInput) {
                const updateFromManual = function() {
                    const lat = parseFloat(latInput.value);
                    const lon = parseFloat(lonInput.value);
                    if (!isNaN(lat) && !isNaN(lon) && lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180) {
                        self.data.location = { lat: lat, lon: lon, name: 'Manual (' + lat.toFixed(2) + ', ' + lon.toFixed(2) + ')' };
                        self.syncLocationToDOM();
                        self.renderStep();
                    }
                };
                latInput.addEventListener('change', updateFromManual);
                lonInput.addEventListener('change', updateFromManual);
            }
        },

        bindLocationSearch: function() {
            const self = this;
            const input = document.getElementById('gaip-wizard-location-search');
            const results = document.getElementById('gaip-wizard-location-results');
            if (!input || !results) return;

            let debounceTimer = null;

            input.addEventListener('input', function() {
                clearTimeout(debounceTimer);
                const query = this.value.trim();
                if (query.length < 2) {
                    results.style.display = 'none';
                    return;
                }

                debounceTimer = setTimeout(function() {
                    self.geocodeSearch(query, results);
                }, 300);
            });

            // Close results on outside click
            document.addEventListener('click', function(e) {
                if (!input.contains(e.target) && !results.contains(e.target)) {
                    results.style.display = 'none';
                }
            });
        },

        geocodeSearch: function(query, resultsEl) {
            const self = this;

            // Use Open-Meteo geocoding (no API key needed)
            fetch('https://geocoding-api.open-meteo.com/v1/search?name=' + encodeURIComponent(query) + '&count=5&language=en&format=json')
                .then(function(r) { return r.json(); })
                .then(function(data) {
                    if (!data.results || !data.results.length) {
                        resultsEl.innerHTML = '<div style="padding: 10px; color: var(--gaip-text-muted); font-size: 13px;">No results found</div>';
                        resultsEl.style.display = 'block';
                        return;
                    }

                    resultsEl.innerHTML = '';
                    data.results.forEach(function(place) {
                        const item = document.createElement('div');
                        const displayName = [place.name, place.admin1, place.country].filter(Boolean).join(', ');
                        item.innerHTML = `
                            <div style="font-size: 14px; color: var(--gaip-text);">${self.escHtml(displayName)}</div>
                            <div style="font-size: 11px; color: var(--gaip-text-muted);">${place.latitude.toFixed(4)}, ${place.longitude.toFixed(4)}</div>
                        `;
                        Object.assign(item.style, {
                            padding: '10px 12px',
                            cursor: 'pointer',
                            borderBottom: '1px solid var(--gaip-surface-hover)'
                        });
                        item.addEventListener('mouseenter', function() { this.style.background = 'var(--gaip-good-bg)'; });
                        item.addEventListener('mouseleave', function() { this.style.background = 'transparent'; });
                        item.addEventListener('click', function() {
                            self.data.location = {
                                lat: place.latitude,
                                lon: place.longitude,
                                name: displayName
                            };
                            self.syncLocationToDOM();
                            resultsEl.style.display = 'none';
                            self.renderStep(); // Re-render with confirmation
                        });
                        resultsEl.appendChild(item);
                    });
                    resultsEl.style.display = 'block';
                })
                .catch(function(err) {
                    console.warn('[SetupWizard] Geocode error:', err);
                    // Fallback: try existing Hub AJAX if available
                    if (typeof GAIP_HUB_CONFIG !== 'undefined' && GAIP_HUB_CONFIG.ajaxUrl) {
                        self.geocodeViaAjax(query, resultsEl);
                    }
                });
        },

        geocodeViaAjax: function(query, resultsEl) {
            const self = this;
            const formData = new FormData();
            formData.append('action', 'gilba_geocode_search');
            formData.append('query', query);

            fetch(GAIP_HUB_CONFIG.ajaxUrl, { method: 'POST', body: formData })
                .then(function(r) { return r.json(); })
                .then(function(response) {
                    if (!response.success || !response.data || !response.data.length) {
                        resultsEl.innerHTML = '<div style="padding: 10px; color: var(--gaip-text-muted); font-size: 13px;">No results found</div>';
                        resultsEl.style.display = 'block';
                        return;
                    }
                    resultsEl.innerHTML = '';
                    response.data.forEach(function(place) {
                        const item = document.createElement('div');
                        item.innerHTML = `<div style="font-size: 14px; color: var(--gaip-text);">${self.escHtml(place.name)}</div>`;
                        Object.assign(item.style, {
                            padding: '10px 12px',
                            cursor: 'pointer',
                            borderBottom: '1px solid var(--gaip-surface-hover)'
                        });
                        item.addEventListener('mouseenter', function() { this.style.background = 'var(--gaip-good-bg)'; });
                        item.addEventListener('mouseleave', function() { this.style.background = 'transparent'; });
                        item.addEventListener('click', function() {
                            self.data.location = {
                                lat: parseFloat(place.lat),
                                lon: parseFloat(place.lon),
                                name: place.name
                            };
                            self.syncLocationToDOM();
                            resultsEl.style.display = 'none';
                            self.renderStep();
                        });
                        resultsEl.appendChild(item);
                    });
                    resultsEl.style.display = 'block';
                })
                .catch(function(err) {
                    console.warn('[SetupWizard] AJAX geocode error:', err);
                });
        },

        // ================================================================
        // STEP 2: TURF TYPE (+ Subcategory for Golf)
        // ================================================================

        renderStep2_TurfType: function(container) {
            const self = this;

            container.innerHTML = `
                <h3 style="margin: 0 0 4px; font-size: 18px; color: var(--gaip-text); font-weight: 600;">
                    What are you managing?
                </h3>
                <p style="color: var(--gaip-text-secondary); font-size: 13px; margin: 0 0 16px;">
                    This sets interpretation thresholds, species options, and analysis parameters.
                </p>

                <div id="gaip-wizard-turf-types" style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 10px; margin-bottom: 16px;"></div>
                <div id="gaip-wizard-subcategory" style="display: none;"></div>
            `;

            // Build turf type buttons
            const types = [
                { id: 'sports', label: 'Sports Field', desc: 'Soccer, AFL, Rugby, Cricket', icon: '🏟️' },
                { id: 'golf', label: 'Golf', desc: 'Greens, Fairways, Tees', icon: '⛳' },
                { id: 'lawns', label: 'Lawns', desc: 'Residential, Parks', icon: '🏡' },
            ];

            const grid = document.getElementById('gaip-wizard-turf-types');
            types.forEach(function(t) {
                const btn = document.createElement('div');
                const isActive = self.data.turfType === t.id;
                btn.innerHTML = `
                    <div style="font-size: 28px; margin-bottom: 6px;">${t.icon}</div>
                    <div style="font-size: 14px; font-weight: 600; color: ${isActive ? '#166534' : 'var(--gaip-text)'};">${t.label}</div>
                    <div style="font-size: 11px; color: ${isActive ? '#166534' : 'var(--gaip-text-muted)'}; margin-top: 2px;">${t.desc}</div>
                `;
                Object.assign(btn.style, {
                    textAlign: 'center',
                    padding: '16px 8px',
                    border: isActive ? '2px solid #166534' : '2px solid var(--gaip-border)',
                    borderRadius: '10px',
                    cursor: 'pointer',
                    background: isActive ? 'var(--gaip-good-bg)' : 'var(--gaip-surface)',
                    transition: 'all 0.2s ease'
                });
                btn.addEventListener('click', function() {
                    self.data.turfType = t.id;
                    if (t.id !== 'golf') {
                        self.data.subCategory = null; // Reset sub for non-golf
                    }
                    self.renderStep(); // Re-render to show active state + subcategory
                });
                grid.appendChild(btn);
            });

            // Show golf subcategories if golf selected
            if (this.data.turfType === 'golf') {
                this.renderGolfSubcategory();
            }
        },

        renderGolfSubcategory: function() {
            const self = this;
            const subEl = document.getElementById('gaip-wizard-subcategory');
            subEl.style.display = 'block';

            const subs = [
                { id: 'greens', label: 'Greens' },
                { id: 'fairways', label: 'Fairways' },
                { id: 'tees', label: 'Tees' },
                { id: 'surrounds', label: 'Surrounds' },
            ];

            subEl.innerHTML = `
                <label style="display: block; font-size: 12px; font-weight: 600; color: var(--gaip-text-secondary); margin-bottom: 8px; text-transform: uppercase; letter-spacing: 0.5px;">
                    Surface type
                </label>
                <div id="gaip-wizard-sub-grid" style="display: grid; grid-template-columns: 1fr 1fr 1fr 1fr; gap: 8px;"></div>
            `;

            const grid = document.getElementById('gaip-wizard-sub-grid');
            subs.forEach(function(s) {
                const btn = document.createElement('div');
                const isActive = self.data.subCategory === s.id;
                btn.textContent = s.label;
                Object.assign(btn.style, {
                    textAlign: 'center',
                    padding: '10px 6px',
                    border: isActive ? '2px solid #166534' : '2px solid var(--gaip-border)',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontSize: '13px',
                    fontWeight: '600',
                    color: isActive ? '#166534' : 'var(--gaip-text-secondary)',
                    background: isActive ? 'var(--gaip-good-bg)' : 'var(--gaip-surface)',
                    transition: 'all 0.2s ease'
                });
                btn.addEventListener('click', function() {
                    self.data.subCategory = s.id;
                    self.renderStep();
                });
                grid.appendChild(btn);
            });
        },

        // ================================================================
        // STEP 3: SPECIES, VARIETY & METHODOLOGY
        // ================================================================

        renderStep3_SpeciesMethod: function(container) {
            const self = this;

            // Determine available species based on turf type + location
            const speciesOptions = this.getAvailableSpecies();
            const isNZ = this.isNewZealandLocation();
            const varietyOptions = this.data.species ? this.getVarietiesForWizard(this.data.species) : [];
            const showVariety = this.data.species && varietyOptions.length > 1; // >1 because generic is always there

            container.innerHTML = `
                <h3 style="margin: 0 0 4px; font-size: 18px; color: var(--gaip-text); font-weight: 600;">
                    Species, Variety &amp; Soil Method
                </h3>
                <p style="color: var(--gaip-text-secondary); font-size: 13px; margin: 0 0 16px;">
                    These drive all downstream thresholds, trait matching, and interpretation ranges.
                </p>

                <div style="margin-bottom: 14px;">
                    <label style="display: block; font-size: 12px; font-weight: 600; color: var(--gaip-text-secondary); margin-bottom: 6px; text-transform: uppercase; letter-spacing: 0.5px;">
                        Primary Species
                    </label>
                    <select id="gaip-wizard-species" style="width: 100%; padding: 10px 12px; border: 1px solid var(--gaip-border);
                            border-radius: 8px; font-size: 14px; font-family: inherit; color: var(--gaip-text);
                            background: var(--gaip-surface); cursor: pointer;">
                        <option value="">— Select species —</option>
                        ${speciesOptions.map(function(s) {
                            return '<option value="' + self.escHtml(s.value) + '"' + 
                                   (self.data.species === s.value ? ' selected' : '') + '>' +
                                   self.escHtml(s.label) + ' (' + s.type + ')</option>';
                        }).join('')}
                    </select>
                </div>

                <div id="gaip-wizard-variety-section" style="margin-bottom: 14px; ${showVariety ? '' : 'display: none;'}">
                    <label style="display: block; font-size: 12px; font-weight: 600; color: var(--gaip-text-secondary); margin-bottom: 6px; text-transform: uppercase; letter-spacing: 0.5px;">
                        Variety / Cultivar
                    </label>
                    <select id="gaip-wizard-variety" style="width: 100%; padding: 10px 12px; border: 1px solid var(--gaip-border);
                            border-radius: 8px; font-size: 14px; font-family: inherit; color: var(--gaip-text);
                            background: var(--gaip-surface); cursor: pointer;">
                        ${varietyOptions.map(function(v) {
                            var label = v.label || v.value;
                            // Only show ratingDesc if it's genuinely informative
                            // Filter out "Insufficient data", empty strings, and zero-score descriptions
                            if (v.ratingDesc && v.rating > 0 && 
                                v.ratingDesc.toLowerCase().indexOf('insufficient') === -1 &&
                                v.ratingDesc.toLowerCase().indexOf('no data') === -1 &&
                                v.ratingDesc.toLowerCase().indexOf('unknown') === -1) {
                                label += ' — ' + v.ratingDesc;
                            }
                            return '<option value="' + self.escHtml(v.value) + '"' +
                                   (self.data.variety === v.value ? ' selected' : '') + '>' +
                                   self.escHtml(label) + '</option>';
                        }).join('')}
                    </select>
                    <div style="font-size: 11px; color: var(--gaip-text-muted); margin-top: 4px;">
                        You can refine this in the Turf Profile panel after setup.
                    </div>
                </div>

                <div style="margin-bottom: 14px;">
                    <label style="display: block; font-size: 12px; font-weight: 600; color: var(--gaip-text-secondary); margin-bottom: 6px; text-transform: uppercase; letter-spacing: 0.5px;">
                        Soil Interpretation Method
                    </label>
                    <div id="gaip-wizard-method-grid" style="display: grid; grid-template-columns: ${isNZ ? '1fr 1fr 1fr' : '1fr 1fr'}; gap: 10px;"></div>
                </div>

                <div id="gaip-wizard-species-note" style="display: none; padding: 10px; background: var(--gaip-warning-bg);
                     border: 1px solid var(--gaip-warning-border); border-radius: 6px; font-size: 12px; color: #92400e; line-height: 1.5;"></div>
            `;

            // Species select handler
            var speciesEl = document.getElementById('gaip-wizard-species');
            if (speciesEl) {
                speciesEl.addEventListener('change', function() {
                    self.data.species = this.value || null;
                    self.data.variety = null; // Reset variety on species change
                    self.updateMethodologyNote();
                    self.renderStep();
                });
            }

            // Variety select handler
            var varietyEl = document.getElementById('gaip-wizard-variety');
            if (varietyEl) {
                varietyEl.addEventListener('change', function() {
                    self.data.variety = this.value || null;
                });
                // Set default to generic if nothing selected yet
                if (!self.data.variety && varietyOptions.length > 0) {
                    self.data.variety = varietyOptions[0].value; // 'generic'
                }
            }

            // Methodology buttons
            this.renderMethodologyButtons();
            this.updateMethodologyNote();
        },

        getVarietiesForWizard: function(species) {
            // Use GaipTurfProfile's variety resolution which respects region
            var tp = window.GaipTurfProfile;
            if (tp && typeof tp.getVarietiesForSpecies === 'function') {
                var varieties = tp.getVarietiesForSpecies(species);
                if (varieties && varieties.length > 0) {
                    return varieties;
                }
            }
            // Fallback: just generic
            return [{ value: 'generic', label: 'Generic / Unknown' }];
        },

        isNewZealandLocation: function() {
            if (!this.data.location) return false;
            var lat = this.data.location.lat;
            var lon = this.data.location.lon;
            // Match regional-profiles.js NZ detection
            return (lat < 0 && lon >= 166 && lon <= 179 && lat >= -47 && lat <= -34);
        },

        renderMethodologyButtons: function() {
            const self = this;
            const grid = document.getElementById('gaip-wizard-method-grid');
            if (!grid) return;

            const isNZ = this.isNewZealandLocation();

            const methods = [
                {
                    id: 'mlsn',
                    label: 'MLSN',
                    desc: 'Threshold-based. Validated for sand-based putting greens.',
                },
                {
                    id: 'slan',
                    label: 'SLAN',
                    desc: 'Sufficiency ranges. Standard for sports fields, fairways, lawns.',
                }
            ];

            // Add Ammonium Acetate for NZ locations
            if (isNZ) {
                methods.push({
                    id: 'ammonium_acetate',
                    label: 'Ammonium Acetate',
                    desc: 'Hill Labs NZ method. Olsen P + NH\u2084OAc extraction.',
                });
            }

            // Auto-suggest methodology based on turf type + region
            if (!this.data.methodology) {
                if (isNZ) {
                    this.data.methodology = 'ammonium_acetate';
                } else if (this.data.turfType === 'golf' && this.data.subCategory === 'greens') {
                    this.data.methodology = 'mlsn';
                } else {
                    this.data.methodology = 'slan';
                }
            }

            grid.innerHTML = '';
            methods.forEach(function(m) {
                const btn = document.createElement('div');
                const isActive = self.data.methodology === m.id;
                btn.innerHTML = `
                    <div style="font-size: 14px; font-weight: 600; color: ${isActive ? '#166534' : 'var(--gaip-text)'};">${m.label}</div>
                    <div style="font-size: 11px; color: ${isActive ? '#166534' : 'var(--gaip-text-muted)'}; margin-top: 4px; line-height: 1.4;">${m.desc}</div>
                `;
                Object.assign(btn.style, {
                    padding: '12px 10px',
                    border: isActive ? '2px solid #166534' : '2px solid var(--gaip-border)',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    background: isActive ? 'var(--gaip-good-bg)' : 'var(--gaip-surface)',
                    transition: 'all 0.2s ease'
                });
                btn.addEventListener('click', function() {
                    self.data.methodology = m.id;
                    self.renderStep();
                });
                grid.appendChild(btn);
            });
        },

        updateMethodologyNote: function() {
            const noteEl = document.getElementById('gaip-wizard-species-note');
            if (!noteEl) return;

            const isNZ = this.isNewZealandLocation();

            if (isNZ && this.data.methodology !== 'ammonium_acetate') {
                noteEl.textContent = 'Note: Most NZ soil labs (Hill Labs) use ammonium acetate extraction. ' +
                    'If your lab report shows Olsen P and NH\u2084OAc-extractable K/Ca/Mg, select Ammonium Acetate ' +
                    'for accurate threshold matching.';
                noteEl.style.display = 'block';
            } else if (this.data.methodology === 'mlsn' && this.data.turfType !== 'golf') {
                noteEl.textContent = 'Note: MLSN guidelines were developed for sand-based golf putting greens. ' +
                    'Applying MLSN to sports fields or lawns on native soils may produce misleading results. ' +
                    'Consider SLAN for this turf type.';
                noteEl.style.display = 'block';
            } else if (this.data.methodology === 'mlsn' && this.data.turfType === 'golf' && 
                       this.data.subCategory && this.data.subCategory !== 'greens') {
                noteEl.textContent = 'Note: MLSN was validated primarily for putting greens. ' +
                    'For fairways and tees on native soil, SLAN may be more appropriate.';
                noteEl.style.display = 'block';
            } else {
                noteEl.style.display = 'none';
            }
        },

        getAvailableSpecies: function() {
            // Use GaipTurfProfile's species data if available
            const tp = window.GaipTurfProfile;
            if (!tp || !tp.speciesByType) return [];

            const turfType = this.data.turfType;
            const subCat = this.data.subCategory;
            let speciesData;

            if (turfType === 'golf' && subCat) {
                speciesData = tp.speciesByType.golf[subCat];
            } else if (turfType === 'sports') {
                speciesData = tp.speciesByType.sports;
            } else if (turfType === 'lawns') {
                speciesData = tp.speciesByType.lawns;
            }

            if (!speciesData) return [];

            // Determine C4 viability from location
            let includeC4 = true;
            if (this.data.location) {
                const absLat = Math.abs(this.data.location.lat);
                // C4 viable in tropical, subtropical, warm temperate (< ~45° latitude)
                includeC4 = absLat < 45;
            }

            let result = [];
            if (speciesData.c3) result = result.concat(speciesData.c3);
            if (includeC4 && speciesData.c4) result = result.concat(speciesData.c4);

            return result;
        },

        // ================================================================
        // STEP 4: WHAT NOW
        // ================================================================

        renderStep4_WhatNow: function(container) {
            const self = this;
            const species = this.data.species || 'your turf';
            const methodology = this.data.methodology ? this.data.methodology.toUpperCase().replace('_', ' ') : 'MLSN';
            const locationName = this.data.location ? this.data.location.name : 'your site';

            const tiles = [
                {
                    icon: '💧',
                    title: 'Enter your water test',
                    body: 'Open the Water Quality card and import a PDF or CSV from your lab, or enter manually. EC, pH, SAR and ion composition all feed the analysis.',
                    action: 'Go to Water Quality',
                    selector: '.gaip-water-card',
                    tab: 'analysis',
                },
                {
                    icon: '🌱',
                    title: 'Enter your soil test',
                    body: 'Open the Soil Analysis card and import your lab report or enter values manually. The hub uses ' + methodology + ' sufficiency ranges for your species.',
                    action: 'Go to Soil Analysis',
                    selector: '.gaip-soil-card',
                    tab: 'analysis',
                },
                {
                    icon: '🧪',
                    title: 'Enter your tissue test',
                    body: 'Tissue testing gives the hub real plant uptake data to cross-validate soil and water recommendations. Import a lab report or enter values manually.',
                    action: 'Go to Tissue Testing',
                    selector: '.gaip-enable-tissue',
                    tab: 'analysis',
                },
                {
                    icon: '📡',
                    title: 'Connect sensor data',
                    body: 'Import TDR soil moisture data via CSV or connect Hydrosight / SpecConnect live feeds. Sensor data feeds the irrigation and VWC calculations.',
                    action: 'Go to Sensor Import',
                    selector: '.gaip-collapsible-header[data-target="gaip-sensor-import-body"]',
                    tab: 'analysis',
                    expand: 'gaip-sensor-import-body',
                },
                {
                    icon: '▶️',
                    title: 'Run your first analysis',
                    body: 'Hit the green Run button at the top of the hub. Results appear across all output cards — disease risk, growth potential, irrigation, PGR and more.',
                    action: 'Run now',
                    selector: '.gaip-run-btn',
                    tab: 'analysis',
                },
                {
                    icon: '📊',
                    title: 'Read the Daily Dashboard',
                    body: 'The dashboard gives you an at-a-glance summary — growth potential, disease risk, stress index and today\'s priority actions.',
                    action: 'Go to Dashboard',
                    selector: '.gaip-daily-dashboard, .gaip-decision-engine',
                    tab: 'today',
                },
                {
                    icon: '❓',
                    title: 'Not sure what a result means?',
                    body: 'Every output card has a Why? button that explains the science behind the flag. The Evidence tab shows the source data driving each recommendation.',
                    action: null,
                    selector: null,
                    tab: null,
                },
            ];

            container.innerHTML = `
                <div style="text-align:center; margin-bottom:20px;">
                    <div style="font-size:32px; margin-bottom:8px;">🚀</div>
                    <h2 style="margin:0 0 6px; font-size:20px; color:var(--gaip-text); font-family:inherit;">
                        ${locationName} is ready
                    </h2>
                    <p style="margin:0; font-size:13px; color:var(--gaip-text-secondary);">
                        Here's what to do first. Click any tile to jump straight there.
                    </p>
                </div>
                <div id="gaip-wizard-tiles" style="display:flex; flex-direction:column; gap:8px;">
                </div>
            `;

            const tilesContainer = container.querySelector('#gaip-wizard-tiles');

            tiles.forEach(function(tile) {
                const el = document.createElement('div');
                el.style.cssText = [
                    'display:flex',
                    'align-items:flex-start',
                    'gap:12px',
                    'padding:12px 14px',
                    'background:var(--gaip-surface-muted)',
                    'border:1px solid var(--gaip-border)',
                    'border-radius:8px',
                    'cursor:' + (tile.selector ? 'pointer' : 'default'),
                    'transition:border-color 0.15s ease',
                ].join(';');

                el.innerHTML = `
                    <span style="font-size:20px;flex-shrink:0;margin-top:2px;">${tile.icon}</span>
                    <div style="flex:1;min-width:0;">
                        <div style="font-weight:600;font-size:13px;color:var(--gaip-text);margin-bottom:3px;">${tile.title}</div>
                        <div style="font-size:12px;color:var(--gaip-text-secondary);line-height:1.5;">${tile.body}</div>
                        ${tile.action ? `<div style="margin-top:5px;font-size:11px;color:var(--gaip-accent);font-weight:600;">${tile.action} →</div>` : ''}
                    </div>
                `;

                if (tile.selector) {
                    el.addEventListener('mouseenter', function() {
                        el.style.borderColor = 'var(--gaip-accent)';
                    });
                    el.addEventListener('mouseleave', function() {
                        el.style.borderColor = 'var(--gaip-border)';
                    });
                    el.addEventListener('click', function() {
                        self.close(); // just remove overlay — no DOM re-run
                        setTimeout(function() {
                            if (tile.tab && window.GilbaTabNav && typeof window.GilbaTabNav.switchTab === 'function') {
                                window.GilbaTabNav.switchTab(tile.tab);
                            }
                            setTimeout(function() {
                                // Expand Input Data section if collapsed
                                var inputsSection = document.querySelector('.gaip-inputs-section');
                                if (inputsSection && inputsSection.classList.contains('collapsed')) {
                                    var inputsHeader = inputsSection.querySelector('.gaip-inputs-header');
                                    if (inputsHeader) inputsHeader.click();
                                }
                                var target = document.querySelector(tile.selector);
                                if (!target) return;
                                var card = target.closest('.gaip-card') || target;
                                var header = card.querySelector('.gaip-card-header');
                                var body = card.querySelector('.gaip-card-body');
                                if (header && body && body.style.display === 'none') {
                                    header.click();
                                }
                                if (tile.expand) {
                                    var expandBody = document.getElementById(tile.expand);
                                    if (expandBody && expandBody.style.display === 'none') {
                                        target.click();
                                    }
                                }
                                // Brief extra delay if inputs section was collapsed — needs paint time
                                var extraDelay = (inputsSection && inputsSection.classList.contains('collapsed')) ? 150 : 0;
                                setTimeout(function() {
                                    var rect = card.getBoundingClientRect();
                                    var absoluteTop = rect.top + window.pageYOffset - 80;
                                    window.scrollTo({ top: absoluteTop, behavior: 'smooth' });
                                    card.style.transition = 'box-shadow 0.3s ease';
                                    card.style.boxShadow = '0 0 0 3px var(--gaip-accent)';
                                    setTimeout(function() { card.style.boxShadow = ''; }, 2000);
                                }, extraDelay);
                            }, 300);
                        }, 100);
                    });
                }

                tilesContainer.appendChild(el);
            });
        },

        // ================================================================
        // APPLY + CLOSE
        // ================================================================

        applyAndClose: function() {

            // 1. Set location on DOM inputs
            if (this.data.location) {
                const latInput = document.querySelector('.gaip-lat');
                const lonInput = document.querySelector('.gaip-lon');
                const searchInput = document.getElementById('gaip-location-search');

                if (latInput) {
                    latInput.value = this.data.location.lat.toFixed(4);
                    latInput.dispatchEvent(new Event('change', { bubbles: true }));
                }
                if (lonInput) {
                    lonInput.value = this.data.location.lon.toFixed(4);
                    lonInput.dispatchEvent(new Event('change', { bubbles: true }));
                }
                if (searchInput) {
                    searchInput.value = this.data.location.name;
                }

                // Save location via AJAX (reuse existing handler)
                this.saveLocationViaAjax();
            }

            // 2. Set turf type via GaipTurfProfile
            const tp = window.GaipTurfProfile;
            if (tp) {
                if (this.data.turfType) {
                    tp.selectTurfType(this.data.turfType);
                }
                if (this.data.subCategory) {
                    // Small delay to let turf type render subcategory DOM
                    const self = this;
                    setTimeout(function() {
                        tp.selectSubCategory(self.data.subCategory);

                        // 3. Set species
                        setTimeout(function() {
                            if (self.data.species && tp.elements.speciesSelect) {
                                tp.elements.speciesSelect.value = self.data.species;
                                tp.selectSpecies(self.data.species);
                            }

                            // 3b. Set variety
                            if (self.data.variety && self.data.variety !== 'generic' && tp.elements.varietySelect) {
                                tp.elements.varietySelect.value = self.data.variety;
                                tp.selectVariety(self.data.variety);
                            }

                            // 4. Set soil methodology
                            if (self.data.methodology) {
                                const methodSelect = document.querySelector('.gaip-soil-methodology');
                                if (methodSelect) {
                                    // For AA, ensure the option exists (it may need to be added by the AA module)
                                    if (self.data.methodology === 'ammonium_acetate' && 
                                        !methodSelect.querySelector('option[value="ammonium_acetate"]')) {
                                        var aaOpt = document.createElement('option');
                                        aaOpt.value = 'ammonium_acetate';
                                        aaOpt.textContent = 'Ammonium Acetate (Hill Labs NZ)';
                                        methodSelect.appendChild(aaOpt);
                                    }
                                    methodSelect.value = self.data.methodology;
                                    methodSelect.dispatchEvent(new Event('change', { bubbles: true }));
                                }
                            }

                            // 5. Final state dispatch — all engines respond
                            tp.dispatchStateChange();

                        }, 100);
                    }, 100);
                } else {
                    // Non-golf: no subcategory step needed
                    if (this.data.species && tp.elements.speciesSelect) {
                        tp.elements.speciesSelect.value = this.data.species;
                        tp.selectSpecies(this.data.species);
                    }

                    // Set variety
                    if (this.data.variety && this.data.variety !== 'generic' && tp.elements.varietySelect) {
                        tp.elements.varietySelect.value = this.data.variety;
                        tp.selectVariety(this.data.variety);
                    }

                    if (this.data.methodology) {
                        const methodSelect = document.querySelector('.gaip-soil-methodology');
                        if (methodSelect) {
                            if (this.data.methodology === 'ammonium_acetate' && 
                                !methodSelect.querySelector('option[value="ammonium_acetate"]')) {
                                var aaOpt = document.createElement('option');
                                aaOpt.value = 'ammonium_acetate';
                                aaOpt.textContent = 'Ammonium Acetate (Hill Labs NZ)';
                                methodSelect.appendChild(aaOpt);
                            }
                            methodSelect.value = this.data.methodology;
                            methodSelect.dispatchEvent(new Event('change', { bubbles: true }));
                        }
                    }

                    tp.dispatchStateChange();
                }
            }

            // 6. Mark wizard complete
            this.markComplete();

            // 7. Close modal
            this.close();

            // 8. Dispatch completion event
            document.dispatchEvent(new CustomEvent('gaip:wizard-complete', {
                detail: { ...this.data, timestamp: Date.now() },
                bubbles: true
            }));
        },

        saveLocationViaAjax: function() {
            if (!this.data.location) return;

            const ajaxUrl = (typeof GAIP_HUB_CONFIG !== 'undefined' && GAIP_HUB_CONFIG.ajaxUrl) 
                ? GAIP_HUB_CONFIG.ajaxUrl 
                : '/wp-admin/admin-ajax.php';

            const nonce = (typeof GAIP_HUB_CONFIG !== 'undefined' && GAIP_HUB_CONFIG.nonce)
                ? GAIP_HUB_CONFIG.nonce
                : (typeof GAIP_WIZARD_CONFIG !== 'undefined' && GAIP_WIZARD_CONFIG.nonce)
                    ? GAIP_WIZARD_CONFIG.nonce
                    : '';

            const formData = new FormData();
            formData.append('action', 'gilba_save_location');
            formData.append('nonce', nonce);
            formData.append('lat', this.data.location.lat);
            formData.append('lon', this.data.location.lon);
            formData.append('name', this.data.location.name);

            fetch(ajaxUrl, { method: 'POST', body: formData })
                .then(function(r) { return r.json(); })
                .then(function(response) {
                    if (response.success) {
                    } else {
                        console.warn('[SetupWizard] Location save failed:', response);
                    }
                })
                .catch(function(err) {
                    console.warn('[SetupWizard] Location save error:', err);
                });
        },

        markComplete: function() {
            // localStorage for immediate client-side check
            _ls.setItem(WIZARD_STORAGE_KEY, JSON.stringify({
                completedAt: new Date().toISOString(),
                version: WIZARD_VERSION
            }));

            // Server-side: save to user_meta via AJAX
            const ajaxUrl = (typeof GAIP_WIZARD_CONFIG !== 'undefined' && GAIP_WIZARD_CONFIG.ajaxUrl) 
                ? GAIP_WIZARD_CONFIG.ajaxUrl 
                : (typeof GAIP_HUB_CONFIG !== 'undefined' && GAIP_HUB_CONFIG.ajaxUrl)
                    ? GAIP_HUB_CONFIG.ajaxUrl
                    : '/wp-admin/admin-ajax.php';

            const nonce = (typeof GAIP_WIZARD_CONFIG !== 'undefined' && GAIP_WIZARD_CONFIG.nonce)
                ? GAIP_WIZARD_CONFIG.nonce
                : (typeof GAIP_HUB_CONFIG !== 'undefined' && GAIP_HUB_CONFIG.nonce)
                    ? GAIP_HUB_CONFIG.nonce
                    : '';

            const formData = new FormData();
            formData.append('action', 'gilba_wizard_complete');
            formData.append('nonce', nonce);
            formData.append('version', WIZARD_VERSION);
            formData.append('turf_type', this.data.turfType || '');
            formData.append('species', this.data.species || '');
            formData.append('variety', this.data.variety || '');
            formData.append('methodology', this.data.methodology || '');

            fetch(ajaxUrl, { method: 'POST', body: formData })
                .then(function(r) { return r.json(); })
                .then(function(response) {
                    if (response.success) {
                    } else {
                        console.warn('[SetupWizard] user_meta save failed:', response);
                    }
                })
                .catch(function(err) {
                    // Non-critical — localStorage fallback is already set
                    console.warn('[SetupWizard] user_meta save error:', err);
                });
        },

        skipWizard: function() {
            // Still mark as seen so it doesn't show again
            _ls.setItem(WIZARD_STORAGE_KEY, JSON.stringify({
                completedAt: new Date().toISOString(),
                version: WIZARD_VERSION,
                skipped: true
            }));
            this.close();
        },

        close: function() {
            // Preserve scroll position — body overflow:hidden can shift page on restore
            var scrollY = window.pageYOffset;
            if (this.overlay && this.overlay.parentNode) {
                this.overlay.parentNode.removeChild(this.overlay);
            }
            this.overlay = null;
            this.modal = null;
            document.body.style.overflow = '';
            // Restore scroll position immediately after overflow is re-enabled
            window.scrollTo(0, scrollY);
        },

        // ================================================================
        // UTILITY
        // ================================================================

        escHtml: function(str) {
            if (!str) return '';
            const div = document.createElement('div');
            div.textContent = str;
            return div.innerHTML;
        },

        /**
         * Write wizard location to the Hub's DOM inputs early,
         * so gaip_detectRegion returns the correct region for
         * variety filtering in step 3.
         */
        syncLocationToDOM: function() {
            if (!this.data.location) return;
            const latInput = document.querySelector('.gaip-lat');
            const lonInput = document.querySelector('.gaip-lon');
            if (latInput) latInput.value = this.data.location.lat.toFixed(4);
            if (lonInput) lonInput.value = this.data.location.lon.toFixed(4);
        },

        /**
         * Programmatic trigger for testing or re-onboarding
         * Usage: GaipSetupWizard.reset(); GaipSetupWizard.show();
         */
        reset: function() {
            _ls.removeItem(WIZARD_STORAGE_KEY);
        },

        /**
         * v1.1.0: Open wizard in edit mode, pre-populated from current state.
         * Called by header bar "Site Settings" button.
         */
        openEditMode: function() {
            // Pre-fill from current turf profile state
            const state = window.GaipTurfProfile?.state || window.GAIP_STATE?.turf || {};
            
            // Location
            const lat = parseFloat(document.querySelector('.gaip-lat')?.value || state.lat || 0);
            const lon = parseFloat(document.querySelector('.gaip-lon')?.value || state.lon || 0);
            const locName = document.querySelector('#gaip-location-search')?.value || 
                            state.locationName || '';
            if (lat && lon) {
                this.data.location = { lat: lat, lon: lon, name: locName };
            }
            
            // Turf type and sub-category
            const turfTypeEl = document.querySelector('.gaip-turf-type');
            if (turfTypeEl) {
                this.data.turfType = turfTypeEl.value || null;
            }
            const subCatEl = document.querySelector('.gaip-sub-category, .gaip-subcategory');
            if (subCatEl) {
                this.data.subCategory = subCatEl.value || null;
            }
            
            // Species
            const speciesEl = document.querySelector('.gaip-species');
            if (speciesEl) {
                this.data.species = speciesEl.value || null;
            }
            
            // Variety
            const varietyEl = document.querySelector('.gaip-variety');
            if (varietyEl) {
                this.data.variety = varietyEl.value || null;
            }
            
            // Methodology
            const methEl = document.querySelector('.gaip-soil-methodology');
            if (methEl) {
                this.data.methodology = methEl.value || null;
            }
            
            this.currentStep = 0;
            this._editMode = true;
            this.show();
        }
    };

    // ================================================================
    // AUTO-INIT: Wait for TurfProfile to be ready, then check wizard
    // ================================================================
    
    function initWhenReady() {
        if (window.GaipTurfProfile && window.GaipTurfProfile.version) {
            // Small delay to let TurfProfile finish its own init
            setTimeout(function() {
                window.GaipSetupWizard.init();
            }, 500);
        } else {
            // TurfProfile not ready yet — wait
            setTimeout(initWhenReady, 200);
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initWhenReady);
    } else {
        initWhenReady();
    }

})();
