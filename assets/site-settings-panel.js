/**
 * =============================================================================
 * SITE SETTINGS SLIDE-OVER PANEL v1.0.0
 * =============================================================================
 *
 * Phase 2 of the progressive UI redesign.
 *
 * The existing Turf Profile card stays in the DOM (modules still query it),
 * but gets visually collapsed/hidden by default. This slide-over panel
 * becomes the primary way to edit profile settings.
 *
 * Internally it reads from and writes to the SAME DOM elements the card
 * uses. So all downstream modules keep working because the actual
 * .gaip-species, .gaip-construction etc. elements are unchanged.
 *
 * Opens from: header bar "Site Settings" button, or GaipSettingsPanel.open()
 *
 * Dependencies: turf-profile-controller.js, hub-header-bar.js
 * @version 1.0.0
 * =============================================================================
 */

(function() {
    'use strict';

    var VERSION = '1.0.0';
    var PANEL_ID = 'gaip-settings-panel';
    var OVERLAY_ID = 'gaip-settings-overlay';

    // =========================================================================
    // STATE
    // =========================================================================

    var _panelEl = null;
    var _overlayEl = null;
    var _isOpen = false;
    var _snapshot = null; // Pre-edit snapshot for cancel/revert

    // =========================================================================
    // LOGGING
    // =========================================================================

    function log(msg, data) {
        if (data !== undefined) {
        } else {
        }
    }

    // =========================================================================
    // HELPERS
    // =========================================================================

    function escHtml(str) {
        if (!str) return '';
        var d = document.createElement('div');
        d.textContent = str;
        return d.innerHTML;
    }

    /**
     * Read a DOM input/select value by selector
     */
    function domVal(selector) {
        var el = document.querySelector(selector);
        if (!el) return '';
        return el.value || '';
    }

    /**
     * Set a DOM input/select value and fire change event
     */
    function setDomVal(selector, value) {
        var el = document.querySelector(selector);
        if (!el) return;
        el.value = value;
        el.dispatchEvent(new Event('change', { bubbles: true }));
    }

    /**
     * Read current active turf type from DOM classes
     */
    function getActiveTurfType() {
        var tp = window.GaipTurfProfile;
        if (tp && tp.state) return tp.state.turfType || '';
        // Fallback: check DOM
        var active = document.querySelector('.gaip-turf-type-option.active');
        return active ? active.getAttribute('data-type') || '' : '';
    }

    function getActiveSubCategory() {
        var tp = window.GaipTurfProfile;
        if (tp && tp.state) return tp.state.subCategory || '';
        return '';
    }

    /**
     * Snapshot current profile state for cancel/revert
     */
    function takeSnapshot() {
        var tp = window.GaipTurfProfile;
        var state = tp ? tp.state : {};
        return {
            turfType: state.turfType || '',
            subCategory: state.subCategory || '',
            species: domVal('.gaip-species'),
            variety: domVal('.gaip-variety'),
            construction: domVal('.gaip-construction'),
            drainage: domVal('.gaip-drainage'),
            hoc: domVal('.gaip-hoc'),
            nProgram: domVal('.gaip-n-program'),
            methodology: domVal('.gaip-soil-methodology'),
            overseedSpecies: domVal('.gaip-cool-overseed'),
            overseedVariety: domVal('.gaip-overseed-variety'),
            summerIntent: domVal('.gaip-overseed-summer-intent'),
            yearsEstablished: domVal('.gaip-years-established'),
            thatchDepth: domVal('.gaip-thatch-depth'),
            winterMinTemp: domVal('.gaip-winter-min-temp'),
            aaTexture: domVal('.gaip-aa-soil-texture')
        };
    }

    /**
     * Restore a snapshot (on cancel)
     */
    function restoreSnapshot(snap) {
        if (!snap) return;

        var tp = window.GaipTurfProfile;
        if (tp) {
            if (snap.turfType) tp.selectTurfType(snap.turfType);
            if (snap.subCategory) {
                setTimeout(function() { tp.selectSubCategory(snap.subCategory); }, 50);
            }
            setTimeout(function() {
                if (snap.species) {
                    setDomVal('.gaip-species', snap.species);
                    if (tp.selectSpecies) tp.selectSpecies(snap.species);
                }
                if (snap.variety) {
                    setDomVal('.gaip-variety', snap.variety);
                }
            }, 100);
        }

        setDomVal('.gaip-construction', snap.construction);
        setDomVal('.gaip-drainage', snap.drainage);
        setDomVal('.gaip-hoc', snap.hoc);
        setDomVal('.gaip-n-program', snap.nProgram);
        setDomVal('.gaip-soil-methodology', snap.methodology);
        setDomVal('.gaip-cool-overseed', snap.overseedSpecies);
        setDomVal('.gaip-overseed-variety', snap.overseedVariety);
        setDomVal('.gaip-overseed-summer-intent', snap.summerIntent);
        setDomVal('.gaip-years-established', snap.yearsEstablished);
        setDomVal('.gaip-thatch-depth', snap.thatchDepth);
        setDomVal('.gaip-winter-min-temp', snap.winterMinTemp);
        if (snap.aaTexture) setDomVal('.gaip-aa-soil-texture', snap.aaTexture);

        if (tp && tp.dispatchStateChange) tp.dispatchStateChange();
    }

    // =========================================================================
    // PANEL STRUCTURE
    // =========================================================================

    /**
     * Build the panel DOM. The panel body contains labelled sections that
     * mirror the Turf Profile card. Each control reads from / writes to the
     * real DOM elements directly.
     */
    function buildPanel() {
        // Overlay (click to close)
        _overlayEl = document.createElement('div');
        _overlayEl.id = OVERLAY_ID;
        _overlayEl.addEventListener('click', function() { close(true); });

        // Panel
        _panelEl = document.createElement('div');
        _panelEl.id = PANEL_ID;

        // Build inner HTML
        _panelEl.innerHTML = buildPanelHTML();

        document.body.appendChild(_overlayEl);
        document.body.appendChild(_panelEl);

        injectStyles();
        bindPanelEvents();
    }

    function buildPanelHTML() {
        return '' +
            '<div class="gaip-sp-header">' +
                '<div class="gaip-sp-header-title">' +
                    '<svg width="18" height="18" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">' +
                        '<circle cx="8" cy="8" r="2.5"/>' +
                        '<path d="M8 1.5v1.2M8 13.3v1.2M1.5 8h1.2M13.3 8h1.2M3.4 3.4l.85.85M11.75 11.75l.85.85M3.4 12.6l.85-.85M11.75 4.25l.85-.85"/>' +
                    '</svg>' +
                    '<span>Site Settings</span>' +
                '</div>' +
                '<button class="gaip-sp-close" id="gaip-sp-close-btn" title="Close">&times;</button>' +
            '</div>' +

            '<div class="gaip-sp-body">' +

                // Section 1: Turf Type
                buildSection('Turf Type', 'turf-type',
                    '<div class="gaip-sp-turf-grid" id="gaip-sp-turf-grid"></div>' +
                    '<div class="gaip-sp-sub-grid" id="gaip-sp-sub-grid" style="display:none;"></div>'
                ) +

                // Section 1b: Location & Climate
                buildSection('Location &amp; Climate', 'location',
                    '<div class="gaip-sp-field">' +
                        '<label class="gaip-sp-label">Location (for live weather)</label>' +
                        '<input type="text" class="gaip-sp-input" id="gaip-sp-location" ' +
                            'placeholder="Search suburb, city, or stadium..." autocomplete="off">' +
                    '</div>' +
                    '<div class="gaip-sp-row">' +
                        '<div class="gaip-sp-field">' +
                            '<label class="gaip-sp-label">Latitude</label>' +
                            '<input type="number" class="gaip-sp-input" id="gaip-sp-lat" step="0.0001">' +
                        '</div>' +
                        '<div class="gaip-sp-field">' +
                            '<label class="gaip-sp-label">Longitude</label>' +
                            '<input type="number" class="gaip-sp-input" id="gaip-sp-lon" step="0.0001">' +
                        '</div>' +
                    '</div>' +
                    '<div class="gaip-sp-row">' +
                        '<div class="gaip-sp-field">' +
                            '<label class="gaip-sp-label">Hemisphere</label>' +
                            '<select class="gaip-sp-select" id="gaip-sp-hemi">' +
                                '<option value="southern">Southern</option>' +
                                '<option value="northern">Northern</option>' +
                            '</select>' +
                        '</div>' +
                        '<div class="gaip-sp-field">' +
                            '<label class="gaip-sp-label">Elevation (m)</label>' +
                            '<input type="number" class="gaip-sp-input" id="gaip-sp-elev" step="1" min="0" max="5000">' +
                        '</div>' +
                    '</div>'
                ) +

                // Section 2: Species & Variety
                buildSection('Species &amp; Variety', 'species',
                    '<div class="gaip-sp-field">' +
                        '<label class="gaip-sp-label">Species</label>' +
                        '<select class="gaip-sp-select" id="gaip-sp-species"></select>' +
                    '</div>' +
                    '<div class="gaip-sp-field">' +
                        '<label class="gaip-sp-label">Variety / Cultivar</label>' +
                        '<select class="gaip-sp-select" id="gaip-sp-variety"></select>' +
                    '</div>'
                ) +

                // Section 3: Construction & Conditions
                buildSection('Construction &amp; Conditions', 'construction',
                    '<div class="gaip-sp-row">' +
                        '<div class="gaip-sp-field">' +
                            '<label class="gaip-sp-label">Construction</label>' +
                            '<select class="gaip-sp-select" id="gaip-sp-construction">' +
                                '<option value="sand_carpet">Sand carpet</option>' +
                                '<option value="sand_profile">Sand profile (USGA-style)</option>' +
                                '<option value="pipe_drained">Pipe drained + slit drained</option>' +
                                '<option value="soil">Soil field</option>' +
                                '<option value="hybrid">Hybrid reinforced</option>' +
                            '</select>' +
                        '</div>' +
                        '<div class="gaip-sp-field">' +
                            '<label class="gaip-sp-label">Drainage</label>' +
                            '<select class="gaip-sp-select" id="gaip-sp-drainage">' +
                                '<option value="excellent">Excellent (&gt;150 mm/hr)</option>' +
                                '<option value="good">Good (100-150 mm/hr)</option>' +
                                '<option value="moderate">Moderate (50-100 mm/hr)</option>' +
                                '<option value="poor">Poor (&lt;50 mm/hr)</option>' +
                            '</select>' +
                        '</div>' +
                    '</div>' +
                    '<div class="gaip-sp-row">' +
                        '<div class="gaip-sp-field">' +
                            '<label class="gaip-sp-label">Height of Cut (mm)</label>' +
                            '<input type="number" class="gaip-sp-input" id="gaip-sp-hoc" step="0.5" min="1" max="100">' +
                        '</div>' +
                        '<div class="gaip-sp-field">' +
                            '<label class="gaip-sp-label">N Program (kg/ha/yr)</label>' +
                            '<input type="number" class="gaip-sp-input" id="gaip-sp-n-program" step="10" min="0" max="500">' +
                        '</div>' +
                    '</div>'
                ) +

                // Section 4: Soil Methodology
                buildSection('Soil Interpretation', 'methodology',
                    '<div class="gaip-sp-method-grid" id="gaip-sp-method-grid"></div>' +
                    '<div class="gaip-sp-method-note" id="gaip-sp-method-note"></div>' +
                    '<div class="gaip-sp-aa-texture" id="gaip-sp-aa-texture" style="display:none; margin-top: 10px;">' +
                        '<label class="gaip-sp-label">Rootzone Type (for K/Mg ranges)</label>' +
                        '<select class="gaip-sp-select" id="gaip-sp-aa-soil-texture">' +
                            '<option value="native">Native soil / Soil-based</option>' +
                            '<option value="sands">Sand-based rootzone (USGA spec)</option>' +
                        '</select>' +
                        '<div class="gaip-sp-hint" style="margin-top: 4px;">Sand-based rootzones have different K and Mg sufficiency thresholds</div>' +
                    '</div>'
                ) +

                // Section 5: Overseed (conditional)
                '<div class="gaip-sp-section gaip-sp-overseed-section" id="gaip-sp-overseed-section" style="display:none;">' +
                    '<div class="gaip-sp-section-header">' +
                        '<span class="gaip-sp-section-title">Winter Overseed Program</span>' +
                    '</div>' +
                    '<div class="gaip-sp-section-body">' +
                        '<div class="gaip-sp-field">' +
                            '<label class="gaip-sp-label">Overseed Species</label>' +
                            '<select class="gaip-sp-select" id="gaip-sp-overseed-species">' +
                                '<option value="">None / No overseed</option>' +
                                '<option value="Perennial Ryegrass">Perennial Ryegrass</option>' +
                            '</select>' +
                        '</div>' +
                        '<div class="gaip-sp-field" id="gaip-sp-overseed-variety-field" style="display:none;">' +
                            '<label class="gaip-sp-label">Overseed Variety</label>' +
                            '<select class="gaip-sp-select" id="gaip-sp-overseed-variety"></select>' +
                        '</div>' +
                        '<div class="gaip-sp-field" id="gaip-sp-overseed-intent-field" style="display:none;">' +
                            '<label class="gaip-sp-label">Summer Management Intent</label>' +
                            '<select class="gaip-sp-select" id="gaip-sp-overseed-intent">' +
                                '<option value="transition">Transition — let ryegrass fade</option>' +
                                '<option value="maintain">Maintain — keep ryegrass through summer</option>' +
                            '</select>' +
                        '</div>' +
                    '</div>' +
                '</div>' +

                // Section 6: Site History
                buildSection('Site History', 'history',
                    '<div class="gaip-sp-hint">Used for disease risk calculations</div>' +
                    '<div class="gaip-sp-row gaip-sp-row-3">' +
                        '<div class="gaip-sp-field">' +
                            '<label class="gaip-sp-label">Years Established</label>' +
                            '<input type="number" class="gaip-sp-input" id="gaip-sp-years" step="1" min="0" max="50" placeholder="e.g. 5">' +
                        '</div>' +
                        '<div class="gaip-sp-field">' +
                            '<label class="gaip-sp-label">Thatch (mm)</label>' +
                            '<input type="number" class="gaip-sp-input" id="gaip-sp-thatch" step="1" min="0" max="50" placeholder="e.g. 12">' +
                        '</div>' +
                        '<div class="gaip-sp-field">' +
                            '<label class="gaip-sp-label">Winter Min (°C)</label>' +
                            '<input type="number" class="gaip-sp-input" id="gaip-sp-winter-temp" step="0.5" min="-20" max="15" placeholder="e.g. -2">' +
                        '</div>' +
                    '</div>'
                ) +

                // Section 7: Saved Profiles
                buildSection('Saved Profiles', 'profiles',
                    '<div class="gaip-sp-profiles-row">' +
                        '<select class="gaip-sp-select gaip-sp-profile-dropdown" id="gaip-sp-profile-select"></select>' +
                        '<button type="button" class="gaip-sp-btn gaip-sp-btn-save" id="gaip-sp-save-btn">Save</button>' +
                        '<button type="button" class="gaip-sp-btn gaip-sp-btn-delete" id="gaip-sp-delete-btn">Delete</button>' +
                    '</div>'
                ) +

                // Section 8: Alerts
                buildSection('Alerts', 'alerts',
                    '<p style="font-size:12px;color:var(--gaip-text-secondary);margin:0 0 10px;">SMS and email alerts when thresholds are crossed. Each alert fires at most once per site per day.</p>' +
                    '<div class="gaip-sp-field">' +
                        '<label class="gaip-sp-label">SMS number (E.164 format, e.g. +61412345678)</label>' +
                        '<div style="display:flex;gap:6px;">' +
                            '<input type="tel" class="gaip-sp-input" id="gaip-sp-alert-sms" placeholder="+61412345678" style="flex:1;">' +
                            '<button type="button" class="gaip-sp-btn" id="gaip-sp-alert-test-sms" style="white-space:nowrap;font-size:11px;padding:0 10px;">Test SMS</button>' +
                        '</div>' +
                    '</div>' +
                    '<div class="gaip-sp-field">' +
                        '<label class="gaip-sp-label">Email address</label>' +
                        '<div style="display:flex;gap:6px;">' +
                            '<input type="email" class="gaip-sp-input" id="gaip-sp-alert-email" placeholder="super@club.com" style="flex:1;">' +
                            '<button type="button" class="gaip-sp-btn" id="gaip-sp-alert-test-email" style="white-space:nowrap;font-size:11px;padding:0 10px;">Test email</button>' +
                        '</div>' +
                    '</div>' +
                    '<div class="gaip-sp-field">' +
                        '<label class="gaip-sp-label" style="margin-bottom:6px;">Alert triggers</label>' +
                        '<div style="display:flex;flex-direction:column;gap:6px;">' +
                            '<label style="display:flex;align-items:center;gap:8px;font-size:13px;cursor:pointer;">' +
                                '<input type="checkbox" id="gaip-sp-alert-disease" checked> ' +
                                'Disease risk (Smith-Kerns &ge;20% or overall &ge;70%)' +
                            '</label>' +
                            '<label style="display:flex;align-items:center;gap:8px;font-size:13px;cursor:pointer;">' +
                                '<input type="checkbox" id="gaip-sp-alert-preemergent" checked> ' +
                                'Pre-emergent timing window closing / missed' +
                            '</label>' +
                            '<label style="display:flex;align-items:center;gap:8px;font-size:13px;cursor:pointer;">' +
                                '<input type="checkbox" id="gaip-sp-alert-stress" checked> ' +
                                'Stress trajectory &ge;70%' +
                            '</label>' +
                        '</div>' +
                    '</div>' +
                    '<div class="gaip-sp-field">' +
                        '<label style="display:flex;align-items:center;gap:8px;font-size:13px;cursor:pointer;">' +
                            '<input type="checkbox" id="gaip-sp-alert-quiet" checked> ' +
                            'Quiet hours — suppress SMS between 10 pm and 7 am UTC' +
                        '</label>' +
                    '</div>' +
                    '<div id="gaip-sp-alert-status" style="font-size:12px;color:var(--gaip-text-secondary);margin-top:4px;min-height:18px;"></div>' +
                    '<p style="font-size:11px;color:var(--gaip-text-muted);margin:8px 0 0;">ClickSend API credentials are configured in WordPress admin settings.</p>'
                ) +

            '</div>' +

            // Footer
            '<div class="gaip-sp-footer">' +
                '<button type="button" class="gaip-sp-btn gaip-sp-btn-cancel" id="gaip-sp-cancel-btn">Cancel</button>' +
                '<button type="button" class="gaip-sp-btn gaip-sp-btn-apply" id="gaip-sp-apply-btn">Apply &amp; Close</button>' +
            '</div>';
    }

    function buildSection(title, id, content) {
        return '' +
            '<div class="gaip-sp-section" data-section="' + id + '">' +
                '<div class="gaip-sp-section-header">' +
                    '<span class="gaip-sp-section-title">' + title + '</span>' +
                '</div>' +
                '<div class="gaip-sp-section-body">' +
                    content +
                '</div>' +
            '</div>';
    }

    // =========================================================================
    // STYLES
    // =========================================================================

    function injectStyles() {
        if (document.getElementById('gaip-settings-panel-styles')) return;

        var s = document.createElement('style');
        s.id = 'gaip-settings-panel-styles';
        s.textContent = '' +

            /* Overlay */
            '#' + OVERLAY_ID + ' {' +
                'position: fixed; top: 0; left: 0; width: 100%; height: 100%;' +
                'background: rgba(0,0,0,0.35); z-index: 99998;' +
                'opacity: 0; transition: opacity 0.25s ease;' +
                'pointer-events: none;' +
            '}' +
            '#' + OVERLAY_ID + '.gaip-sp-visible {' +
                'opacity: 1; pointer-events: auto;' +
            '}' +

            /* Panel */
            '#' + PANEL_ID + ' {' +
                'position: fixed; top: 0; right: 0; width: 420px; max-width: 90vw;' +
                'height: 100vh; background: var(--gaip-surface); z-index: 99999;' +
                'display: flex; flex-direction: column;' +
                'box-shadow: -6px 0 30px rgba(0,0,0,0.15);' +
                'transform: translateX(100%); transition: transform 0.3s cubic-bezier(0.4,0,0.2,1);' +
                'font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;' +
                'color: var(--gaip-text); font-size: 14px;' +
            '}' +
            '#' + PANEL_ID + '.gaip-sp-open {' +
                'transform: translateX(0);' +
            '}' +

            /* Header */
            '.gaip-sp-header {' +
                'display: flex; align-items: center; justify-content: space-between;' +
                'padding: 16px 20px; border-bottom: 1px solid var(--gaip-border);' +
                'flex-shrink: 0; background: var(--gaip-surface-muted);' +
            '}' +
            '.gaip-sp-header-title {' +
                'display: flex; align-items: center; gap: 8px;' +
                'font-size: 16px; font-weight: 600; color: var(--gaip-text);' +
            '}' +
            '.gaip-sp-close {' +
                'background: none; border: none; font-size: 24px; color: var(--gaip-text-secondary);' +
                'cursor: pointer; padding: 4px 8px; border-radius: 6px;' +
                'line-height: 1; transition: background 0.15s, color 0.15s;' +
            '}' +
            '.gaip-sp-close:hover { background: var(--gaip-surface-hover); color: var(--gaip-text); }' +

            /* Body (scrollable) */
            '.gaip-sp-body {' +
                'flex: 1; overflow-y: auto; padding: 0;' +
            '}' +

            /* Sections */
            '.gaip-sp-section {' +
                'border-bottom: 1px solid var(--gaip-surface-hover);' +
            '}' +
            '.gaip-sp-section-header {' +
                'padding: 14px 20px 0;' +
            '}' +
            '.gaip-sp-section-title {' +
                'font-size: 11px; font-weight: 700; text-transform: uppercase;' +
                'letter-spacing: 0.6px; color: var(--gaip-text-secondary);' +
            '}' +
            '.gaip-sp-section-body {' +
                'padding: 10px 20px 16px;' +
            '}' +

            /* Labels & fields */
            '.gaip-sp-label {' +
                'display: block; font-size: 12px; font-weight: 500; color: var(--gaip-text);' +
                'margin-bottom: 4px;' +
            '}' +
            '.gaip-sp-field { margin-bottom: 12px; }' +
            '.gaip-sp-hint {' +
                'font-size: 11px; color: var(--gaip-text-muted); margin-bottom: 10px;' +
            '}' +
            '.gaip-sp-select, .gaip-sp-input {' +
                'width: 100%; padding: 8px 10px; border: 1px solid var(--gaip-border);' +
                'border-radius: 6px; font-size: 13px; font-family: inherit;' +
                'color: var(--gaip-text); background: var(--gaip-surface); box-sizing: border-box;' +
                'transition: border-color 0.15s;' +
            '}' +
            '.gaip-sp-select:focus, .gaip-sp-input:focus {' +
                'outline: none; border-color: #2d7a4f; box-shadow: 0 0 0 2px rgba(45,122,79,0.15);' +
            '}' +

            /* Rows */
            '.gaip-sp-row {' +
                'display: grid; grid-template-columns: 1fr 1fr; gap: 12px;' +
            '}' +
            '.gaip-sp-row-3 {' +
                'grid-template-columns: 1fr 1fr 1fr;' +
            '}' +

            /* Turf type grid in panel */
            '.gaip-sp-turf-btn {' +
                'text-align: center; padding: 12px 8px; border: 2px solid var(--gaip-border);' +
                'border-radius: 8px; cursor: pointer; background: var(--gaip-surface);' +
                'transition: all 0.15s ease;' +
            '}' +
            '.gaip-sp-turf-btn:hover { border-color: var(--gaip-border); background: var(--gaip-surface-muted); }' +
            '.gaip-sp-turf-btn.active {' +
                'border-color: #166534; background: var(--gaip-good-bg);' +
            '}' +
            '.gaip-sp-turf-btn-icon { font-size: 22px; margin-bottom: 4px; }' +
            '.gaip-sp-turf-btn-label {' +
                'font-size: 13px; font-weight: 600; color: var(--gaip-text);' +
            '}' +
            '.gaip-sp-turf-btn.active .gaip-sp-turf-btn-label { color: #166534; }' +

            /* Sub-category pills */
            '#gaip-sp-sub-grid {' +
                'display: flex; gap: 8px; margin-top: 10px; flex-wrap: wrap;' +
            '}' +
            '.gaip-sp-sub-btn {' +
                'padding: 6px 14px; border: 2px solid var(--gaip-border); border-radius: 20px;' +
                'font-size: 12px; font-weight: 600; cursor: pointer; background: var(--gaip-surface);' +
                'color: var(--gaip-text-secondary); transition: all 0.15s ease;' +
            '}' +
            '.gaip-sp-sub-btn:hover { border-color: var(--gaip-border); }' +
            '.gaip-sp-sub-btn.active {' +
                'border-color: #166534; background: var(--gaip-good-bg); color: #166534;' +
            '}' +

            /* Methodology buttons */
            '.gaip-sp-method-btn {' +
                'padding: 10px 12px; border: 2px solid var(--gaip-border); border-radius: 8px;' +
                'cursor: pointer; background: var(--gaip-surface); transition: all 0.15s ease;' +
            '}' +
            '.gaip-sp-method-btn:hover { border-color: var(--gaip-border); }' +
            '.gaip-sp-method-btn.active {' +
                'border-color: #166534; background: var(--gaip-good-bg);' +
            '}' +
            '.gaip-sp-method-btn-title {' +
                'font-size: 13px; font-weight: 600; color: var(--gaip-text);' +
            '}' +
            '.gaip-sp-method-btn.active .gaip-sp-method-btn-title { color: #166534; }' +
            '.gaip-sp-method-btn-desc {' +
                'font-size: 11px; color: var(--gaip-text-secondary); margin-top: 2px; line-height: 1.4;' +
            '}' +
            '.gaip-sp-method-note {' +
                'margin-top: 8px; padding: 8px 10px; font-size: 11px; line-height: 1.5;' +
                'background: var(--gaip-warning-bg); border: 1px solid var(--gaip-warning-border); border-radius: 6px;' +
                'color: #92400e; display: none;' +
            '}' +

            /* Profiles row */
            '.gaip-sp-profiles-row {' +
                'display: flex; gap: 8px; align-items: center;' +
            '}' +
            '.gaip-sp-profiles-row .gaip-sp-select { flex: 1; }' +

            /* Buttons */
            '.gaip-sp-btn {' +
                'padding: 8px 16px; border-radius: 6px; font-size: 13px; font-weight: 600;' +
                'cursor: pointer; border: 1px solid transparent; font-family: inherit;' +
                'transition: background 0.15s, border-color 0.15s;' +
            '}' +
            '.gaip-sp-btn-save {' +
                'background: var(--gaip-good-bg); color: #166534; border-color: var(--gaip-good-bg);' +
            '}' +
            '.gaip-sp-btn-save:hover { background: var(--gaip-good-bg); }' +
            '.gaip-sp-btn-delete {' +
                'background: var(--gaip-critical-bg); color: #b91c1c; border-color: var(--gaip-critical-border);' +
            '}' +
            '.gaip-sp-btn-delete:hover { background: var(--gaip-critical-bg); }' +
            '.gaip-sp-btn-cancel {' +
                'background: var(--gaip-surface-muted); color: var(--gaip-text); border-color: var(--gaip-border);' +
            '}' +
            '.gaip-sp-btn-cancel:hover { background: var(--gaip-surface-hover); }' +
            '.gaip-sp-btn-apply {' +
                'background: #166534; color: var(--gaip-surface); border-color: #166534;' +
            '}' +
            '.gaip-sp-btn-apply:hover { background: #15803d; }' +

            /* Footer */
            '.gaip-sp-footer {' +
                'display: flex; justify-content: flex-end; gap: 10px;' +
                'padding: 14px 20px; border-top: 1px solid var(--gaip-border);' +
                'flex-shrink: 0; background: var(--gaip-surface-muted);' +
            '}' +

            /* Overseed section highlight */
            '.gaip-sp-overseed-section .gaip-sp-section-header { padding-top: 14px; }' +
            '.gaip-sp-overseed-section .gaip-sp-section-title { color: #166534; }' +
            '.gaip-sp-overseed-section { background: var(--gaip-surface-muted); }' +

            /* Collapse the Turf Profile card by default when panel is available */
            '.gaip-turf-profile-card .gaip-card-body { display: none; }' +
            '.gaip-turf-profile-card .gaip-card-header .gaip-card-toggle { transform: rotate(-90deg); }' +
            '.gaip-turf-profile-card .gaip-profile-badge {' +
                'font-size: 10px; color: var(--gaip-text-muted);' +
            '}' +
            '.gaip-turf-profile-card .gaip-profile-badge::after {' +
                'content: " — Edit via header bar"; font-style: italic;' +
            '}' +

            /* Mobile responsive */
            '@media (max-width: 480px) {' +
                '#' + PANEL_ID + ' { width: 100vw; max-width: 100vw; }' +
                '.gaip-sp-row { grid-template-columns: 1fr; }' +
                '.gaip-sp-row-3 { grid-template-columns: 1fr 1fr 1fr; }' +
            '}' +

            '';

        document.head.appendChild(s);
    }

    // =========================================================================
    // POPULATE PANEL FROM DOM
    // =========================================================================

    /**
     * Read values from the real DOM elements and populate the panel controls
     */
    function populateFromDOM() {
        log('Populating panel from DOM');

        var tp = window.GaipTurfProfile;
        var state = tp ? tp.state : {};

        // --- Turf Type Grid ---
        var turfGrid = document.getElementById('gaip-sp-turf-grid');
        if (turfGrid) {
            var types = [
                { id: 'sports', label: 'Sports Field', icon: '🏟️' },
                { id: 'golf', label: 'Golf', icon: '⛳' },
                { id: 'lawns', label: 'Lawns', icon: '🏡' }
            ];

            // Add Bowls for NZ sites — uses same isNewZealand() check as cotula module
            var _spIsNZ = (window.GAIP_CotulaBowling && window.GAIP_CotulaBowling.isNZ)
                ? window.GAIP_CotulaBowling.isNZ()
                : (window.GAIP_AmmoniumAcetate && window.GAIP_AmmoniumAcetate.isNewZealand)
                    ? window.GAIP_AmmoniumAcetate.isNewZealand()
                    : false;

            if (_spIsNZ) {
                types.push({ id: 'bowls', label: 'Bowls', icon: '🌿' });
            }

            turfGrid.innerHTML = '';
            var cols = types.length === 4 ? '1fr 1fr 1fr 1fr' : '1fr 1fr 1fr';
            turfGrid.style.cssText = 'display: grid; grid-template-columns: ' + cols + '; gap: 8px;';

            types.forEach(function(t) {
                var btn = document.createElement('div');
                btn.className = 'gaip-sp-turf-btn' + (state.turfType === t.id ? ' active' : '');
                btn.setAttribute('data-type', t.id);
                btn.innerHTML = '<div class="gaip-sp-turf-btn-icon">' + t.icon + '</div>' +
                                '<div class="gaip-sp-turf-btn-label">' + t.label + '</div>';
                btn.addEventListener('click', function() {
                    // Cotula bowls: delegate to cotula module which handles
                    // AA methodology selection and species setup
                    if (t.id === 'bowls' && window.GAIP_CotulaBowling) {
                        window.GAIP_CotulaBowling.handleBowlsSelection();
                    } else if (tp && tp.selectTurfType) {
                        tp.selectTurfType(t.id);
                    }
                    // Re-render turf grid + sub grid + species
                    setTimeout(function() { populateTurfSubGrid(); populateSpecies(); }, 50);
                    // Update active state
                    turfGrid.querySelectorAll('.gaip-sp-turf-btn').forEach(function(b) {
                        b.classList.remove('active');
                    });
                    btn.classList.add('active');
                });
                turfGrid.appendChild(btn);
            });
        }

        // Sub-category
        populateTurfSubGrid();

        // Location & Climate
        var locSearch = document.getElementById('gaip-sp-location');
        var realLocSearch = document.getElementById('gaip-location-search');
        if (locSearch && realLocSearch) locSearch.value = realLocSearch.value;
        var spLat = document.getElementById('gaip-sp-lat');
        if (spLat) spLat.value = domVal('.gaip-lat');
        var spLon = document.getElementById('gaip-sp-lon');
        if (spLon) spLon.value = domVal('.gaip-lon');
        var spHemi = document.getElementById('gaip-sp-hemi');
        if (spHemi) spHemi.value = domVal('.gaip-hemi');
        var spElev = document.getElementById('gaip-sp-elev');
        if (spElev) spElev.value = domVal('.gaip-elev');

        // Species + Variety — populateSpecies handles the empty-select fallback internally
        populateSpecies();

        // Construction & Drainage
        var con = document.getElementById('gaip-sp-construction');
        if (con) con.value = domVal('.gaip-construction');
        var drain = document.getElementById('gaip-sp-drainage');
        if (drain) drain.value = domVal('.gaip-drainage');

        // HOC & N Program
        var hoc = document.getElementById('gaip-sp-hoc');
        if (hoc) hoc.value = domVal('.gaip-hoc');
        var nprog = document.getElementById('gaip-sp-n-program');
        if (nprog) nprog.value = domVal('.gaip-n-program');

        // Methodology
        populateMethodology();

        // Overseed
        populateOverseed();

        // Site History
        var yrs = document.getElementById('gaip-sp-years');
        if (yrs) yrs.value = domVal('.gaip-years-established');
        var thatch = document.getElementById('gaip-sp-thatch');
        if (thatch) thatch.value = domVal('.gaip-thatch-depth');
        var winterTemp = document.getElementById('gaip-sp-winter-temp');
        if (winterTemp) winterTemp.value = domVal('.gaip-winter-min-temp');

        // Profiles dropdown - mirror the real one
        populateProfiles();

        // Alert contacts
        populateAlerts();
    }

    function populateTurfSubGrid() {
        var subGrid = document.getElementById('gaip-sp-sub-grid');
        if (!subGrid) return;

        var tp = window.GaipTurfProfile;
        var state = tp ? tp.state : {};
        var turfType = state.turfType || '';

        if (turfType === 'golf') {
            var subs = [
                { id: 'greens', label: 'Greens' },
                { id: 'fairways', label: 'Fairways' },
                { id: 'tees', label: 'Tees' },
                { id: 'surrounds', label: 'Surrounds' }
            ];
            subGrid.innerHTML = '';
            subGrid.style.display = 'flex';

            subs.forEach(function(s) {
                var btn = document.createElement('div');
                btn.className = 'gaip-sp-sub-btn' + (state.subCategory === s.id ? ' active' : '');
                btn.textContent = s.label;
                btn.addEventListener('click', function() {
                    if (tp && tp.selectSubCategory) tp.selectSubCategory(s.id);
                    subGrid.querySelectorAll('.gaip-sp-sub-btn').forEach(function(b) {
                        b.classList.remove('active');
                    });
                    btn.classList.add('active');
                    // Species list changes with subcategory
                    setTimeout(populateSpecies, 50);
                });
                subGrid.appendChild(btn);
            });
        } else if (turfType === 'sports') {
            var sports = [
                { id: 'soccer', label: 'Soccer' },
                { id: 'afl', label: 'AFL' },
                { id: 'rugby_union', label: 'Rugby Union' },
                { id: 'rugby_league', label: 'Rugby League' }
            ];
            subGrid.innerHTML = '';
            subGrid.style.display = 'flex';

            sports.forEach(function(s) {
                var btn = document.createElement('div');
                btn.className = 'gaip-sp-sub-btn' + (state.subCategory === s.id ? ' active' : '');
                btn.textContent = s.label;
                btn.addEventListener('click', function() {
                    // Sports subcategory uses data-sport on the real DOM
                    var realBtn = document.querySelector('.gaip-subcategory-option[data-sport="' + s.id + '"]');
                    if (realBtn) realBtn.click();
                    subGrid.querySelectorAll('.gaip-sp-sub-btn').forEach(function(b) {
                        b.classList.remove('active');
                    });
                    btn.classList.add('active');
                    setTimeout(populateSpecies, 50);
                });
                subGrid.appendChild(btn);
            });
        } else if (turfType === 'bowls') {
            // Cotula bowling green — single surface, no sub-selection needed
            subGrid.innerHTML = '<div style="padding:6px 10px;font-size:12px;color:#065f46;' +
                'background:var(--gaip-good-bg);border:1px solid #10b981;border-radius:6px;line-height:1.5;">' +
                '🌿 <strong>Cotula (Leptinella)</strong> — NZ bowling green.<br>' +
                'Soil interpretation uses Hill Labs S78 ranges. ' +
                'Ammonium Acetate methodology will be applied.</div>';
            subGrid.style.display = 'block';
        } else {
            subGrid.style.display = 'none';
            subGrid.innerHTML = '';
        }
    }

    function populateSpecies() {
        var spSelect = document.getElementById('gaip-sp-species');
        var varSelect = document.getElementById('gaip-sp-variety');
        if (!spSelect) return;

        var tp = window.GaipTurfProfile;

        // Clone options from the real species select.
        // If it's empty (venue-loaded page, turfType null, no saved site config),
        // build a sports species list directly from TurfProfile.speciesByType so
        // the panel doesn't open with a blank dropdown.
        // We never call updateSpeciesOptions() here — that fires change events and
        // can trigger cascades. We just need options to display.
        var realSpecies = document.querySelector('.gaip-species');
        if (realSpecies && !realSpecies.options.length && tp && tp.speciesByType) {
            var _isC4 = tp.isC4Viable ? tp.isC4Viable() : true;
            var _sports = tp.speciesByType.sports || {};
            var _opts = [];
            if (_sports.c3) _sports.c3.forEach(function(s) { _opts.push(s); });
            if (_isC4 && _sports.c4) _sports.c4.forEach(function(s) { _opts.push(s); });
            if (_opts.length) {
                realSpecies.innerHTML = _opts.map(function(s) {
                    return '<option value="' + s.value + '">' + s.label + '</option>';
                }).join('');
            }
        }

        // Clone options from the real species select
        if (realSpecies) {
            spSelect.innerHTML = realSpecies.innerHTML;
            // Prefer TurfProfile state over DOM value (DOM can be out of sync)
            var stateSpecies = (tp && tp.state) ? tp.state.species : '';
            if (stateSpecies) {
                spSelect.value = stateSpecies;
                // If the value didn't take (option not in list), try the DOM value
                if (!spSelect.value || spSelect.value !== stateSpecies) {
                    spSelect.value = realSpecies.value;
                }
            } else {
                spSelect.value = realSpecies.value;
            }
        }

        // Clone variety options.
        // On GSSH venue-loaded pages turfType is null during initial load, so the real
        // variety select may only contain the generic fallback. If we detect that, build
        // the full variety list directly from TurfProfile.getVarietiesForRegion using
        // the current species — same approach as populateOverseed uses.
        var realVariety = document.querySelector('.gaip-variety');
        if (realVariety && varSelect) {
            var tp2 = window.GaipTurfProfile;
            var stateVariety = (tp2 && tp2.state) ? tp2.state.variety : '';
            var currentSpecies = (tp2 && tp2.state) ? (tp2.state.effectiveSpecies || tp2.state.species) : '';
            var isGenericOnly = realVariety.options.length <= 1 &&
                                (!realVariety.options[0] || realVariety.options[0].value === 'generic');

            if (isGenericOnly && currentSpecies && tp2 && tp2.getVarietiesForRegion) {
                // Build full variety list for this species
                var varRegion = (tp2.getVarietyRegion ? tp2.getVarietyRegion() : null) || 'australia';
                var builtVars = tp2.getVarietiesForRegion(currentSpecies, varRegion);
                if (builtVars && builtVars.length > 1) {
                    var varHtml = builtVars.map(function(v) {
                        return '<option value="' + v.value + '">' + v.label + '</option>';
                    }).join('');
                    varSelect.innerHTML = varHtml;
                    // Mirror back to real select so writePanelToDOM writes correctly
                    realVariety.innerHTML = varHtml;
                } else {
                    varSelect.innerHTML = realVariety.innerHTML;
                }
            } else {
                varSelect.innerHTML = realVariety.innerHTML;
            }

            // Set value — prefer TurfProfile state over DOM
            if (stateVariety) {
                varSelect.value = stateVariety;
                if (!varSelect.value || varSelect.value !== stateVariety) {
                    varSelect.value = realVariety.value;
                }
            } else {
                varSelect.value = realVariety.value;
            }
        }

        // Check if C4 for overseed visibility
        checkOverseedVisibility();
    }

    function populateMethodology() {
        var grid = document.getElementById('gaip-sp-method-grid');
        if (!grid) return;

        var currentMethod = domVal('.gaip-soil-methodology');

        // Check if ammonium acetate option exists AND is visible on real select
        var realSelect = document.querySelector('.gaip-soil-methodology');
        var aaOption = realSelect && realSelect.querySelector('option[value="ammonium_acetate"]');
        var hasAA = aaOption && aaOption.style.display !== 'none';

        var methods = [
            { id: 'mlsn', label: 'MLSN', desc: 'Threshold-based. Validated for sand-based putting greens.' },
            { id: 'slan', label: 'SLAN', desc: 'Sufficiency ranges. Standard for sports fields, fairways, lawns.' }
        ];

        if (hasAA) {
            methods.push({
                id: 'ammonium_acetate',
                label: 'Ammonium Acetate',
                desc: 'Hill Labs NZ method. Olsen P + NH\u2084OAc extraction.'
            });
        }

        grid.innerHTML = '';
        grid.style.cssText = 'display: grid; grid-template-columns: ' +
            (methods.length === 3 ? '1fr 1fr 1fr' : '1fr 1fr') + '; gap: 8px;';

        methods.forEach(function(m) {
            var btn = document.createElement('div');
            btn.className = 'gaip-sp-method-btn' + (currentMethod === m.id ? ' active' : '');
            btn.innerHTML = '<div class="gaip-sp-method-btn-title">' + m.label + '</div>' +
                            '<div class="gaip-sp-method-btn-desc">' + m.desc + '</div>';
            btn.addEventListener('click', function() {
                grid.querySelectorAll('.gaip-sp-method-btn').forEach(function(b) {
                    b.classList.remove('active');
                });
                btn.classList.add('active');
                // Write to real DOM
                setDomVal('.gaip-soil-methodology', m.id);
                // Mark as explicit user choice (prevents auto-select override for NZ)
                if (window.GAIP_STATE && window.GAIP_STATE.soil) {
                    window.GAIP_STATE.soil.methodologyExplicit = true;
                }
                updateMethodNote();
                updateAATextureVisibility();
            });
            grid.appendChild(btn);
        });

        // Sync AA soil texture from real DOM
        var aaTexturePanel = document.getElementById('gaip-sp-aa-soil-texture');
        var realTexture = document.querySelector('.gaip-aa-soil-texture');
        if (aaTexturePanel && realTexture) {
            aaTexturePanel.value = realTexture.value;
        }

        updateMethodNote();
        updateAATextureVisibility();
    }

    /**
     * Show/hide the AA rootzone type selector based on active methodology
     */
    function updateAATextureVisibility() {
        var container = document.getElementById('gaip-sp-aa-texture');
        if (!container) return;
        var method = domVal('.gaip-soil-methodology');
        container.style.display = (method === 'ammonium_acetate') ? 'block' : 'none';
    }

    function updateMethodNote() {
        var noteEl = document.getElementById('gaip-sp-method-note');
        if (!noteEl) return;

        var method = domVal('.gaip-soil-methodology');
        var tp = window.GaipTurfProfile;
        var state = tp ? tp.state : {};

        if (method === 'mlsn' && state.turfType !== 'golf') {
            noteEl.textContent = 'MLSN was developed for sand-based golf putting greens. ' +
                'Applying MLSN to sports fields or lawns on native soils may produce misleading results.';
            noteEl.style.display = 'block';
        } else if (method === 'mlsn' && state.turfType === 'golf' &&
                   state.subCategory && state.subCategory !== 'greens') {
            noteEl.textContent = 'MLSN was validated primarily for putting greens. ' +
                'For fairways and tees on native soil, SLAN may be more appropriate.';
            noteEl.style.display = 'block';
        } else {
            noteEl.style.display = 'none';
        }
    }

    function checkOverseedVisibility() {
        var section = document.getElementById('gaip-sp-overseed-section');
        if (!section) return;

        // Show overseed if C4 species selected (same logic as PHP)
        var tp = window.GaipTurfProfile;
        var realOverseedSection = document.querySelector('.gaip-overseed-section');
        var isVisible = realOverseedSection && realOverseedSection.style.display !== 'none';

        section.style.display = isVisible ? 'block' : 'none';

        if (isVisible) {
            populateOverseed();
        }
    }

    function populateOverseed() {
        var spEl = document.getElementById('gaip-sp-overseed-species');
        var varEl = document.getElementById('gaip-sp-overseed-variety');
        var intentEl = document.getElementById('gaip-sp-overseed-intent');

        if (spEl) spEl.value = domVal('.gaip-cool-overseed');

        // Show variety + intent if overseed species selected
        var hasOverseed = spEl && spEl.value !== '';
        var varField = document.getElementById('gaip-sp-overseed-variety-field');
        var intentField = document.getElementById('gaip-sp-overseed-intent-field');
        if (varField) varField.style.display = hasOverseed ? 'block' : 'none';
        if (intentField) intentField.style.display = hasOverseed ? 'block' : 'none';

        if (hasOverseed) {
            // Clone variety options from real select.
            // If the real select has no options (venue-loaded page, PHP didn't
            // render varieties for this species), build options directly from
            // TurfProfile.getVarietiesForRegion so the panel isn't blank.
            var realVar = document.querySelector('.gaip-overseed-variety');
            if (realVar && varEl) {
                if (realVar.options.length > 0) {
                    varEl.innerHTML = realVar.innerHTML;
                    varEl.value = realVar.value;
                } else {
                    var tp = window.GaipTurfProfile;
                    var osSpecies = spEl ? spEl.value : '';
                    if (tp && tp.getVarietiesForRegion && osSpecies) {
                        var region = tp.getVarietyRegion ? tp.getVarietyRegion() : 'australia';
                        var vars = tp.getVarietiesForRegion(osSpecies, region);
                        if (vars && vars.length) {
                            varEl.innerHTML = vars.map(function(v) {
                                return '<option value="' + v.value + '">' + v.label + '</option>';
                            }).join('');
                            // Also populate the real select so writePanelToDOM has something to read
                            realVar.innerHTML = varEl.innerHTML;
                            varEl.value = domVal('.gaip-overseed-variety') || vars[0].value;
                        }
                    }
                }
            }
            if (intentEl) intentEl.value = domVal('.gaip-overseed-summer-intent');
        }
    }

    function populateProfiles() {
        var panelSelect = document.getElementById('gaip-sp-profile-select');
        var realSelect = document.getElementById('gaip-profile-select');
        if (!panelSelect || !realSelect) return;

        panelSelect.innerHTML = realSelect.innerHTML;
        panelSelect.value = realSelect.value;
    }

    // =========================================================================
    // WRITE PANEL VALUES BACK TO DOM
    // =========================================================================

    /**
     * Write all panel values back to the real DOM elements.
     * Turf type and species are already synced via click handlers above.
     * This covers the remaining fields.
     */
    function writePanelToDOM() {
        log('Writing panel values to DOM');

        // Location & Climate
        var spLoc = document.getElementById('gaip-sp-location');
        var realLoc = document.getElementById('gaip-location-search');
        if (spLoc && realLoc && spLoc.value !== realLoc.value) {
            realLoc.value = spLoc.value;
        }
        var spLat = document.getElementById('gaip-sp-lat');
        if (spLat) { var realLat = document.querySelector('.gaip-lat'); if (realLat && spLat.value !== realLat.value) setDomVal('.gaip-lat', spLat.value); }
        var spLon = document.getElementById('gaip-sp-lon');
        if (spLon) { var realLon = document.querySelector('.gaip-lon'); if (realLon && spLon.value !== realLon.value) setDomVal('.gaip-lon', spLon.value); }
        var spHemi = document.getElementById('gaip-sp-hemi');
        if (spHemi) { var realHemi = document.querySelector('.gaip-hemi'); if (realHemi && spHemi.value !== realHemi.value) setDomVal('.gaip-hemi', spHemi.value); }
        var spElev = document.getElementById('gaip-sp-elev');
        if (spElev) setDomVal('.gaip-elev', spElev.value);

        var cfg = window.GAIP_HUB_CONFIG || {};
        if (cfg.ajaxUrl && spLat && spLon && isFinite(parseFloat(spLat.value)) && isFinite(parseFloat(spLon.value))) {
            var saveFd = new FormData();
            saveFd.append('action', 'gilba_save_location');
            if (window.GAIP_SampleManager && typeof window.GAIP_SampleManager.getActiveSiteId === 'function') {
                saveFd.append('site_id', window.GAIP_SampleManager.getActiveSiteId());
            }
            saveFd.append('lat', spLat.value);
            saveFd.append('lon', spLon.value);
            saveFd.append('name', spLoc ? spLoc.value : '');
            saveFd.append('nonce', cfg.nonce || cfg.csrfToken || '');
            fetch(cfg.ajaxUrl, { method: 'POST', credentials: 'same-origin', body: saveFd })
                .catch(function(err) { log('Location persist failed', err); });
        }

        // Construction & Drainage
        var spCon = document.getElementById('gaip-sp-construction');
        if (spCon) setDomVal('.gaip-construction', spCon.value);
        var spDrain = document.getElementById('gaip-sp-drainage');
        if (spDrain) setDomVal('.gaip-drainage', spDrain.value);

        // HOC & N Program
        setDomVal('.gaip-hoc', document.getElementById('gaip-sp-hoc').value);
        setDomVal('.gaip-n-program', document.getElementById('gaip-sp-n-program').value);

        // Species + Variety (in case user changed via dropdowns)
        var panelSpecies = document.getElementById('gaip-sp-species');
        var panelVariety = document.getElementById('gaip-sp-variety');
        var realSpecies = document.querySelector('.gaip-species');
        var realVariety = document.querySelector('.gaip-variety');

        if (panelSpecies && realSpecies && panelSpecies.value !== realSpecies.value) {
            realSpecies.value = panelSpecies.value;
            realSpecies.dispatchEvent(new Event('change', { bubbles: true }));
            var tp = window.GaipTurfProfile;
            if (tp && tp.selectSpecies) tp.selectSpecies(panelSpecies.value);
            // b35fix156: Save explicit species choice as venue preference so it
            // survives page refresh and overrides the venue database overseed logic
            if (window.GSSH_UnifiedVenueSelector && typeof window.GSSH_UnifiedVenueSelector.saveSpeciesPref === 'function') {
                window.GSSH_UnifiedVenueSelector.saveSpeciesPref(null, panelSpecies.value);
            }
        }
        if (panelVariety && realVariety && panelVariety.value !== realVariety.value) {
            realVariety.value = panelVariety.value;
            realVariety.dispatchEvent(new Event('change', { bubbles: true }));
        }

        // Overseed — b35fix200a: only write when the panel section was actually
        // populated (C4 species with overseed visible). If the section was hidden
        // when the panel opened, the panel selects are empty and writing them would
        // blank the real DOM values, causing the snapshot to lose overseed/intent.
        var _overseedSection = document.getElementById('gaip-sp-overseed-section');
        var _overseedVisible = _overseedSection && _overseedSection.style.display !== 'none';
        if (_overseedVisible) {
            setDomVal('.gaip-cool-overseed', (document.getElementById('gaip-sp-overseed-species') || {}).value || '');
            setDomVal('.gaip-overseed-variety', (document.getElementById('gaip-sp-overseed-variety') || {}).value || '');
            setDomVal('.gaip-overseed-summer-intent', (document.getElementById('gaip-sp-overseed-intent') || {}).value || '');
        }

        // Site History
        setDomVal('.gaip-years-established', document.getElementById('gaip-sp-years').value);
        setDomVal('.gaip-thatch-depth', document.getElementById('gaip-sp-thatch').value);
        setDomVal('.gaip-winter-min-temp', document.getElementById('gaip-sp-winter-temp').value);

        // Methodology is already synced via click handler in populateMethodology

        // AA soil texture — sync panel selection back to real DOM
        var panelAATexture = document.getElementById('gaip-sp-aa-soil-texture');
        var realAATexture = document.querySelector('.gaip-aa-soil-texture');
        if (panelAATexture && realAATexture && panelAATexture.value !== realAATexture.value) {
            realAATexture.value = panelAATexture.value;
            realAATexture.dispatchEvent(new Event('change', { bubbles: true }));
        }

        // Final state dispatch so all engines pick up the changes
        var tp = window.GaipTurfProfile;
        if (tp && tp.dispatchStateChange) {
            tp.dispatchStateChange();
        }

        // Alert contacts — persist to site config
        saveAlerts();
    }

    // =========================================================================
    // ALERTS POPULATE / SAVE
    // =========================================================================

    function populateAlerts() {
        if (!window.GAIP_Alerts) return;
        var siteId = window.GAIP_SampleManager && window.GAIP_SampleManager.getActiveSiteId
            ? window.GAIP_SampleManager.getActiveSiteId() : null;
        if (!siteId) return;

        var cfg = window.GAIP_Alerts.getSiteAlertConfig(siteId);
        var contacts = cfg.contacts || [];

        var smsContact   = contacts.find(function(c) { return c.type === 'sms'; });
        var emailContact = contacts.find(function(c) { return c.type === 'email'; });

        var smsInput   = document.getElementById('gaip-sp-alert-sms');
        var emailInput = document.getElementById('gaip-sp-alert-email');
        if (smsInput)   smsInput.value   = smsContact   ? smsContact.value   : '';
        if (emailInput) emailInput.value = emailContact ? emailContact.value : '';

        // Checkbox states — derive from first contact's alerts array, or default all on
        var allAlerts = smsContact ? smsContact.alerts : (emailContact ? emailContact.alerts : ['disease','pre_emergent','stress']);
        var cbDisease   = document.getElementById('gaip-sp-alert-disease');
        var cbPreEm     = document.getElementById('gaip-sp-alert-preemergent');
        var cbStress    = document.getElementById('gaip-sp-alert-stress');
        var cbQuiet     = document.getElementById('gaip-sp-alert-quiet');
        if (cbDisease)  cbDisease.checked  = allAlerts.indexOf('disease') !== -1;
        if (cbPreEm)    cbPreEm.checked    = allAlerts.indexOf('pre_emergent') !== -1;
        if (cbStress)   cbStress.checked   = allAlerts.indexOf('stress') !== -1;
        if (cbQuiet)    cbQuiet.checked    = cfg.quietHours !== false;
    }

    function saveAlerts() {
        if (!window.GAIP_Alerts) return;
        var siteId = window.GAIP_SampleManager && window.GAIP_SampleManager.getActiveSiteId
            ? window.GAIP_SampleManager.getActiveSiteId() : null;
        if (!siteId) return;

        var smsVal   = (document.getElementById('gaip-sp-alert-sms')   || {}).value || '';
        var emailVal = (document.getElementById('gaip-sp-alert-email') || {}).value || '';

        var enabledAlerts = [];
        if ((document.getElementById('gaip-sp-alert-disease')    || {}).checked) enabledAlerts.push('disease');
        if ((document.getElementById('gaip-sp-alert-preemergent')|| {}).checked) enabledAlerts.push('pre_emergent');
        if ((document.getElementById('gaip-sp-alert-stress')     || {}).checked) enabledAlerts.push('stress');

        var quietHours = !!(document.getElementById('gaip-sp-alert-quiet') || {}).checked;

        var contacts = [];
        if (smsVal.trim())   contacts.push({ type: 'sms',   value: smsVal.trim(),   alerts: enabledAlerts });
        if (emailVal.trim()) contacts.push({ type: 'email', value: emailVal.trim(), alerts: enabledAlerts });

        window.GAIP_Alerts.saveSiteAlertConfig(siteId, contacts, quietHours);
    }

    function bindAlertEvents() {
        var testSmsBtn   = document.getElementById('gaip-sp-alert-test-sms');
        var testEmailBtn = document.getElementById('gaip-sp-alert-test-email');
        var statusEl     = document.getElementById('gaip-sp-alert-status');

        function setStatus(msg, isError) {
            if (!statusEl) return;
            statusEl.textContent = msg;
            statusEl.style.color = isError ? '#b91c1c' : '#166534';
        }

        if (testSmsBtn) {
            testSmsBtn.addEventListener('click', function() {
                var val = (document.getElementById('gaip-sp-alert-sms') || {}).value || '';
                if (!val.trim()) { setStatus('Enter an SMS number first.', true); return; }
                if (!window.GAIP_Alerts) { setStatus('Alerts module not loaded.', true); return; }
                setStatus('Sending test SMS…', false);
                window.GAIP_Alerts.sendTest('sms', val.trim())
                    .then(function() { setStatus('Test SMS sent to ' + val.trim(), false); })
                    .catch(function(e) { setStatus('SMS failed: ' + (e.message || e), true); });
            });
        }

        if (testEmailBtn) {
            testEmailBtn.addEventListener('click', function() {
                var val = (document.getElementById('gaip-sp-alert-email') || {}).value || '';
                if (!val.trim()) { setStatus('Enter an email address first.', true); return; }
                if (!window.GAIP_Alerts) { setStatus('Alerts module not loaded.', true); return; }
                setStatus('Sending test email…', false);
                window.GAIP_Alerts.sendTest('email', val.trim())
                    .then(function() { setStatus('Test email sent to ' + val.trim(), false); })
                    .catch(function(e) { setStatus('Email failed: ' + (e.message || e), true); });
            });
        }
    }

    // =========================================================================
    // EVENT BINDING
    // =========================================================================

    function bindPanelEvents() {
        // ---- Location search with geocoding ----
        var locInput = document.getElementById('gaip-sp-location');
        if (locInput) {
            var searchTimeout;
            // Create results dropdown
            var resultsDiv = document.createElement('div');
            resultsDiv.id = 'gaip-sp-location-results';
            resultsDiv.style.cssText = 'display:none; position:absolute; left:0; right:0; top:100%; ' +
                'background:var(--gaip-surface); border:1px solid var(--gaip-border); border-radius:6px; ' +
                'box-shadow:0 4px 12px rgba(0,0,0,0.15); z-index:10010; max-height:220px; overflow-y:auto;';
            // Make the parent field relative for absolute positioning
            var locField = locInput.closest('.gaip-sp-field');
            if (locField) {
                locField.style.position = 'relative';
                locField.appendChild(resultsDiv);
            }

            locInput.addEventListener('input', function() {
                clearTimeout(searchTimeout);
                var query = locInput.value.trim();
                if (query.length < 3) { resultsDiv.style.display = 'none'; return; }

                searchTimeout = setTimeout(function() {
                    resultsDiv.innerHTML = '<div style="padding:10px; color:var(--gaip-text-secondary); font-size:13px;">Searching...</div>';
                    resultsDiv.style.display = 'block';

                    // Use same AJAX endpoint as the main location search
                    var cfg = window.GAIP_HUB_CONFIG || {};
                    if (!cfg.ajaxUrl) {
                        resultsDiv.innerHTML = '<div style="padding:10px; color:#c41e3a;">AJAX not configured</div>';
                        return;
                    }

                    var fd = new FormData();
                    fd.append('action', 'gilba_geocode_search');
                    fd.append('address', query);
                    fd.append('nonce', cfg.nonce || '');

                    // Try WordPress AJAX first, fall back to Open-Meteo geocoding if session/nonce issue
                    function renderLocResults(locations) {
                        var html = '';
                        locations.forEach(function(loc, idx2) {
                            var shortName = (loc.display_name || loc.name || '').split(',').slice(0, 2).join(',');
                            var lat = parseFloat(loc.lat || loc.latitude).toFixed(4);
                            var lon = parseFloat(loc.lon || loc.longitude).toFixed(4);
                            html += '<div class="gaip-sp-loc-result" data-idx="' + idx2 + '" style="' +
                                'padding:10px 12px; border-bottom:1px solid var(--gaip-surface-hover); cursor:pointer; transition:background 0.15s;">' +
                                '<div style="font-weight:500; color:#2c5f2d; font-size:13px;">📍 ' + shortName + '</div>' +
                                '<div style="font-size:11px; color:var(--gaip-text-secondary); font-family:monospace; margin-top:2px;">' +
                                lat + '°, ' + lon + '°</div></div>';
                        });
                        resultsDiv.innerHTML = html;
                        resultsDiv.querySelectorAll('.gaip-sp-loc-result').forEach(function(el) {
                            el.addEventListener('mouseenter', function() { el.style.background = 'var(--gaip-surface-muted)'; });
                            el.addEventListener('mouseleave', function() { el.style.background = 'var(--gaip-surface)'; });
                            el.addEventListener('click', function() {
                                var i = parseInt(el.getAttribute('data-idx'));
                                var chosen = locations[i];
                                var name = (chosen.display_name || chosen.name || '').split(',').slice(0, 2).join(',');
                                var lat2 = parseFloat(chosen.lat || chosen.latitude).toFixed(4);
                                var lon2 = parseFloat(chosen.lon || chosen.longitude).toFixed(4);
                                locInput.value = name;
                                var spLat = document.getElementById('gaip-sp-lat');
                                var spLon = document.getElementById('gaip-sp-lon');
                                var spHemi = document.getElementById('gaip-sp-hemi');
                                if (spLat) spLat.value = lat2;
                                if (spLon) spLon.value = lon2;
                                if (spHemi) spHemi.value = parseFloat(lat2) < 0 ? 'southern' : 'northern';
                                setDomVal('.gaip-lat', lat2);
                                setDomVal('.gaip-lon', lon2);
                                setDomVal('.gaip-hemi', parseFloat(lat2) < 0 ? 'southern' : 'northern');
                                var realLoc = document.getElementById('gaip-location-search');
                                if (realLoc) realLoc.value = name;
                                var saveFd = new FormData();
                                saveFd.append('action', 'gilba_save_location');
                                if (window.GAIP_SampleManager && typeof window.GAIP_SampleManager.getActiveSiteId === 'function') {
                                    saveFd.append('site_id', window.GAIP_SampleManager.getActiveSiteId());
                                }
                                saveFd.append('lat', lat2);
                                saveFd.append('lon', lon2);
                                saveFd.append('name', name);
                                saveFd.append('nonce', cfg.nonce || '');
                                if (cfg.ajaxUrl) fetch(cfg.ajaxUrl, { method: 'POST', body: saveFd });
                                resultsDiv.style.display = 'none';
                                log('Location selected: ' + name + ' (' + lat2 + ', ' + lon2 + ')');
                            });
                        });
                    }

                    function openMeteoFallback(q) {
                        var url = 'https://geocoding-api.open-meteo.com/v1/search?name=' + encodeURIComponent(q) + '&count=5&language=en&format=json';
                        fetch(url)
                            .then(function(r) { return r.json(); })
                            .then(function(data) {
                                if (data.results && data.results.length > 0) {
                                    // Normalise Open-Meteo format to Nominatim-like
                                    var locs = data.results.map(function(r2) {
                                        return {
                                            display_name: [r2.name, r2.admin1, r2.country].filter(Boolean).join(', '),
                                            lat: r2.latitude,
                                            lon: r2.longitude
                                        };
                                    });
                                    renderLocResults(locs);
                                } else {
                                    resultsDiv.innerHTML = '<div style="padding:10px; color:var(--gaip-text-muted); font-size:13px;">No locations found</div>';
                                }
                            })
                            .catch(function() {
                                resultsDiv.innerHTML = '<div style="padding:10px; color:#c41e3a; font-size:13px;">Search unavailable — check internet connection</div>';
                            });
                    }

                    if (!cfg.ajaxUrl) {
                        openMeteoFallback(query);
                    } else {
                        fetch(cfg.ajaxUrl, { method: 'POST', body: fd })
                            .then(function(r) { return r.json(); })
                            .then(function(resp) {
                                if (resp.success && resp.data && resp.data.length > 0) {
                                    renderLocResults(resp.data);
                                } else if (resp.data && resp.data.code === 'nonce_expired') {
                                    // Nonce expired — fall back to Open-Meteo directly
                                    openMeteoFallback(query);
                                } else {
                                    // AJAX returned no results — try Open-Meteo
                                    openMeteoFallback(query);
                                }
                            })
                            .catch(function() {
                                // AJAX failed entirely (network, auth, non-JSON) — fall back
                                openMeteoFallback(query);
                            });
                    }
                }, 500);
            });

            // Close results when clicking outside
            document.addEventListener('click', function(e) {
                if (!e.target.closest('#gaip-sp-location, #gaip-sp-location-results')) {
                    resultsDiv.style.display = 'none';
                }
            });
        }

        // Close button
        var closeBtn = document.getElementById('gaip-sp-close-btn');
        if (closeBtn) {
            closeBtn.addEventListener('click', function() { close(true); });
        }

        // Cancel button — revert to snapshot
        var cancelBtn = document.getElementById('gaip-sp-cancel-btn');
        if (cancelBtn) {
            cancelBtn.addEventListener('click', function() {
                restoreSnapshot(_snapshot);
                close(false);
            });
        }

        // Apply button — write panel values to DOM and close
        var applyBtn = document.getElementById('gaip-sp-apply-btn');
        if (applyBtn) {
            applyBtn.addEventListener('click', function() {
                writePanelToDOM();
                close(false);
                // Flash the header bar to confirm
                var header = document.getElementById('gaip-hub-header-bar');
                if (header) {
                    header.style.transition = 'box-shadow 0.3s ease';
                    header.style.boxShadow = '0 0 0 3px rgba(22,101,52,0.3)';
                    setTimeout(function() { header.style.boxShadow = ''; }, 1200);
                }
            });
        }

        // Species select in panel — sync to real DOM + update variety
        var spSelect = document.getElementById('gaip-sp-species');
        if (spSelect) {
            spSelect.addEventListener('change', function() {
                var tp = window.GaipTurfProfile;
                if (tp && tp.selectSpecies) {
                    tp.selectSpecies(spSelect.value);
                }
                // Wait for variety options to update, then re-clone.
                // On GSSH venue-loaded pages turfType may be null so the real
                // select will only have generic — fall back to getVarietiesForRegion.
                setTimeout(function() {
                    var varSelect = document.getElementById('gaip-sp-variety');
                    var realVar = document.querySelector('.gaip-variety');
                    if (varSelect && realVar) {
                        var isGenericOnly2 = realVar.options.length <= 1 &&
                            (!realVar.options[0] || realVar.options[0].value === 'generic');
                        if (isGenericOnly2 && tp && tp.getVarietiesForRegion && spSelect.value) {
                            var varRegion2 = (tp.getVarietyRegion ? tp.getVarietyRegion() : null) || 'australia';
                            var builtVars2 = tp.getVarietiesForRegion(spSelect.value, varRegion2);
                            if (builtVars2 && builtVars2.length > 1) {
                                var varHtml2 = builtVars2.map(function(v) {
                                    return '<option value="' + v.value + '">' + v.label + '</option>';
                                }).join('');
                                varSelect.innerHTML = varHtml2;
                                realVar.innerHTML = varHtml2;
                                varSelect.value = builtVars2[0].value;
                            } else {
                                varSelect.innerHTML = realVar.innerHTML;
                                varSelect.value = realVar.value;
                            }
                        } else {
                            varSelect.innerHTML = realVar.innerHTML;
                            varSelect.value = realVar.value;
                        }
                    }
                    checkOverseedVisibility();
                }, 100);
            });
        }

        // Overseed species — show/hide variety + intent, and populate variety options
        var osSelect = document.getElementById('gaip-sp-overseed-species');
        if (osSelect) {
            osSelect.addEventListener('change', function() {
                var hasOverseed = osSelect.value !== '';
                var varField = document.getElementById('gaip-sp-overseed-variety-field');
                var intentField = document.getElementById('gaip-sp-overseed-intent-field');
                if (varField) varField.style.display = hasOverseed ? 'block' : 'none';
                if (intentField) intentField.style.display = hasOverseed ? 'block' : 'none';
                // Populate variety options for the newly selected overseed species
                if (hasOverseed) {
                    var varEl = document.getElementById('gaip-sp-overseed-variety');
                    var tp = window.GaipTurfProfile;
                    if (varEl && tp && tp.getVarietiesForRegion) {
                        var region = tp.getVarietyRegion ? tp.getVarietyRegion() : 'australia';
                        var vars = tp.getVarietiesForRegion(osSelect.value, region);
                        if (vars && vars.length) {
                            varEl.innerHTML = vars.map(function(v) {
                                return '<option value="' + v.value + '">' + v.label + '</option>';
                            }).join('');
                            // Mirror to real select
                            var realVar = document.querySelector('.gaip-overseed-variety');
                            if (realVar) realVar.innerHTML = varEl.innerHTML;
                            varEl.value = vars[0].value;
                        }
                    }
                }
            });
        }

        // Profile save — overwrite if selected, prompt for new name if not
        var saveBtn = document.getElementById('gaip-sp-save-btn');
        if (saveBtn) {
            saveBtn.addEventListener('click', function() {
                // First write panel values to DOM so the save captures current state
                writePanelToDOM();

                var panelSel = document.getElementById('gaip-sp-profile-select');
                var selectedName = panelSel ? panelSel.value : '';

                if (selectedName) {
                    // Overwrite existing profile — no prompt needed
                    var tp = window.GaipTurfProfile;
                    if (tp && tp.getSavedProfiles && tp.state) {
                        var profiles = tp.getSavedProfiles();
                        profiles[selectedName] = Object.assign({}, tp.state, {
                            location: tp.snapshotLocation ? tp.snapshotLocation() : null,
                            savedAt: new Date().toISOString()
                        });
                        try {
                            localStorage.setItem(tp.STORAGE_KEY, JSON.stringify(profiles));
                            if (tp.updateProfileSelect) tp.updateProfileSelect();
                            if (tp.showNotification) tp.showNotification('Profile updated: ' + selectedName);
                            log('Overwrote profile: ' + selectedName);
                        } catch (err) {
                            console.error('[SettingsPanel] Error saving profile:', err);
                        }
                    }
                } else {
                    // No profile selected — prompt for new name via original handler
                    var realSave = document.getElementById('gaip-save-profile');
                    if (realSave) realSave.click();
                }

                // Refresh panel dropdown after a brief delay
                setTimeout(populateProfiles, 200);
            });
        }

        // Profile delete
        var deleteBtn = document.getElementById('gaip-sp-delete-btn');
        if (deleteBtn) {
            deleteBtn.addEventListener('click', function() {
                // Sync selection to real dropdown first
                var panelSel = document.getElementById('gaip-sp-profile-select');
                var realSel = document.getElementById('gaip-profile-select');
                if (panelSel && realSel) {
                    realSel.value = panelSel.value;
                }
                var realDelete = document.getElementById('gaip-delete-profile');
                if (realDelete) realDelete.click();
                setTimeout(populateProfiles, 200);
            });
        }

        // Profile load — when panel dropdown changes
        var profileSel = document.getElementById('gaip-sp-profile-select');
        if (profileSel) {
            profileSel.addEventListener('change', function() {
                // Sync to real dropdown and trigger its change
                var realSel = document.getElementById('gaip-profile-select');
                if (realSel) {
                    realSel.value = profileSel.value;
                    realSel.dispatchEvent(new Event('change', { bubbles: true }));
                }
                // Re-populate panel from DOM after profile loads
                setTimeout(populateFromDOM, 200);
            });
        }

        // Escape key
        document.addEventListener('keydown', function(e) {
            if (e.key === 'Escape' && _isOpen) {
                close(true);
            }
        });

        // Alert test buttons
        bindAlertEvents();
    }

    // =========================================================================
    // OPEN / CLOSE
    // =========================================================================

    function open() {
        if (_isOpen) return;
        log('Opening settings panel');

        if (!_panelEl) {
            buildPanel();
        }

        // Take snapshot before editing
        _snapshot = takeSnapshot();

        // Populate controls from current DOM state
        populateFromDOM();

        // Animate in
        requestAnimationFrame(function() {
            _overlayEl.classList.add('gaip-sp-visible');
            _panelEl.classList.add('gaip-sp-open');
        });

        _isOpen = true;
        document.body.style.overflow = 'hidden';
    }

    function close(isCancel) {
        if (!_isOpen) return;
        log('Closing settings panel' + (isCancel ? ' (cancelled)' : ''));

        _panelEl.classList.remove('gaip-sp-open');
        _overlayEl.classList.remove('gaip-sp-visible');

        _isOpen = false;
        document.body.style.overflow = '';

        _snapshot = null;
    }

    // =========================================================================
    // HEADER BAR INTEGRATION
    // =========================================================================

    /**
     * Override the header bar "Site Settings" button to open the slide-over
     * instead of scrolling to the Turf Profile card.
     */
    function interceptHeaderButton() {
        var btn = document.getElementById('gaip-header-settings-btn');
        if (!btn) {
            // Header bar might not be ready yet
            setTimeout(interceptHeaderButton, 200);
            return;
        }

        // Clone and replace to remove existing scroll listener
        var newBtn = btn.cloneNode(true);
        btn.parentNode.replaceChild(newBtn, btn);

        newBtn.setAttribute('title', 'Open Site Settings');
        newBtn.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            open();
        });

        log('Header button intercepted — now opens slide-over panel');
    }

    // =========================================================================
    // PUBLIC API
    // =========================================================================

    window.GaipSettingsPanel = {
        version: VERSION,
        open: open,
        close: function() { close(false); },
        isOpen: function() { return _isOpen; }
    };

    // =========================================================================
    // INIT
    // =========================================================================

    function init() {
        log('Initializing v' + VERSION);
        interceptHeaderButton();

        // Also collapse the Turf Profile card (CSS does it, but ensure JS state matches)
        var profileCard = document.querySelector('.gaip-turf-profile-card');
        if (profileCard) {
            var body = profileCard.querySelector('.gaip-card-body');
            if (body) body.style.display = 'none';
            var toggle = profileCard.querySelector('.gaip-card-toggle');
            if (toggle) toggle.textContent = '▶';
        }

        log('Ready');
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function() {
            setTimeout(init, 300); // After header bar init
        });
    } else {
        setTimeout(init, 300);
    }

})();
