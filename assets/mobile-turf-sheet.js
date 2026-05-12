/**
 * ============================================================================
 * MOBILE TURF PROFILE BOTTOM SHEET  v1.0.0
 * ============================================================================
 *
 * Floating FAB button (bottom-right) → bottom sheet that mirrors the full
 * Turf Profile card contents. Only shown on screens ≤768 px wide.
 *
 * Strategy: the sheet contains its OWN set of inputs/selects that are kept
 * in sync with the real card elements. Changes in the sheet fire change/input
 * events on the real elements so the TurfProfile controller picks them up
 * normally. Changes made on the card (e.g. by persistence restore) are
 * propagated back into the sheet when it next opens.
 *
 * This means zero risk of breaking existing event listeners, zero DOM juggling,
 * and the sheet works even if the main card is collapsed/hidden.
 *
 * @author Gilba Solutions
 * @version 1.0.0
 */

(function (global) {
    'use strict';

    // =========================================================================
    // CONSTANTS
    // =========================================================================

    var MOBILE_BREAKPOINT = 768;
    var SHEET_ID          = 'gaip-mobile-turf-sheet';
    var FAB_ID            = 'gaip-mobile-turf-fab';
    var OVERLAY_ID        = 'gaip-mobile-sheet-overlay';

    // =========================================================================
    // HELPERS
    // =========================================================================

    function log() {
        var args = Array.prototype.slice.call(arguments);
        args.unshift('[MobileTurfSheet]');
        console.log.apply(console, args);
    }

    function isMobile() {
        return window.innerWidth <= MOBILE_BREAKPOINT;
    }

    /** Read value from a real card element */
    function realVal(selector) {
        var el = document.querySelector(selector);
        if (!el) return null;
        if (el.type === 'checkbox') return el.checked;
        return el.value;
    }

    /** Write a value to a real card element and fire appropriate events */
    function setReal(selector, value, eventName) {
        var el = document.querySelector(selector);
        if (!el) return;

        if (el.type === 'checkbox') {
            if (el.checked === !!value) return;
            el.checked = !!value;
        } else {
            if (el.value === String(value)) return;
            el.value = value;
        }

        el.dispatchEvent(new Event(eventName || 'change', { bubbles: true }));
    }

    /** Click a real card element (for turf type / subcategory buttons) */
    function clickReal(selector) {
        var el = document.querySelector(selector);
        if (el) el.click();
    }

    // =========================================================================
    // SHEET HTML
    // =========================================================================

    function buildSheetHTML() {
        return [
            '<div id="' + OVERLAY_ID + '" class="gaip-sheet-overlay"></div>',

            '<div id="' + SHEET_ID + '" class="gaip-mobile-sheet" role="dialog" aria-modal="true" aria-label="Turf Profile Settings">',

            '  <!-- Handle bar -->',
            '  <div class="gaip-sheet-handle-bar">',
            '    <div class="gaip-sheet-handle"></div>',
            '    <span class="gaip-sheet-title">Turf Profile</span>',
            '    <button class="gaip-sheet-close" aria-label="Close">✕</button>',
            '  </div>',

            '  <div class="gaip-sheet-body">',

            '  <!-- ── Turf Type ─────────────────────────────────────────────── -->',
            '  <div class="gaip-sheet-section">',
            '    <div class="gaip-turf-type-grid">',
            '      <div class="gaip-turf-type-option gaip-sheet-type-btn" data-type="sports" touch-action="manipulation">',
            '        <h4>Sports Field</h4><p>Soccer, AFL, Rugby</p>',
            '      </div>',
            '      <div class="gaip-turf-type-option gaip-sheet-type-btn" data-type="golf" touch-action="manipulation">',
            '        <h4>Golf</h4><p>Greens, Fairways, Tees</p>',
            '      </div>',
            '      <div class="gaip-turf-type-option gaip-sheet-type-btn" data-type="lawns" touch-action="manipulation">',
            '        <h4>Lawns</h4><p>Residential</p>',
            '      </div>',
            '    </div>',
            '  </div>',

            '  <!-- ── Golf sub-category ─────────────────────────────────────── -->',
            '  <div class="gaip-sheet-section gaip-sheet-golf-sub" style="display:none;">',
            '    <label class="gaip-sheet-label">Surface Type</label>',
            '    <div class="gaip-subcategory-grid">',
            '      <div class="gaip-subcategory-option gaip-sheet-sub-btn" data-surface="greens">Greens</div>',
            '      <div class="gaip-subcategory-option gaip-sheet-sub-btn" data-surface="fairways">Fairways</div>',
            '      <div class="gaip-subcategory-option gaip-sheet-sub-btn" data-surface="tees">Tees</div>',
            '      <div class="gaip-subcategory-option gaip-sheet-sub-btn" data-surface="surrounds">Surrounds</div>',
            '    </div>',
            '  </div>',

            '  <!-- ── Sports sub-category ───────────────────────────────────── -->',
            '  <div class="gaip-sheet-section gaip-sheet-sports-sub" style="display:none;">',
            '    <label class="gaip-sheet-label">Sport</label>',
            '    <div class="gaip-subcategory-grid">',
            '      <div class="gaip-subcategory-option gaip-sheet-sub-btn" data-sport="soccer">Soccer</div>',
            '      <div class="gaip-subcategory-option gaip-sheet-sub-btn" data-sport="afl">AFL</div>',
            '      <div class="gaip-subcategory-option gaip-sheet-sub-btn" data-sport="rugby_union">Rugby Union</div>',
            '      <div class="gaip-subcategory-option gaip-sheet-sub-btn" data-sport="rugby_league">Rugby League</div>',
            '    </div>',
            '  </div>',

            '  <!-- ── Species & Variety ─────────────────────────────────────── -->',
            '  <div class="gaip-sheet-section">',
            '    <div class="gaip-form-row-grid">',
            '      <div>',
            '        <label class="gaip-sheet-label">Species</label>',
            '        <select class="gaip-sheet-species gaip-sheet-select"></select>',
            '      </div>',
            '      <div>',
            '        <label class="gaip-sheet-label">Variety</label>',
            '        <select class="gaip-sheet-variety gaip-sheet-select"></select>',
            '      </div>',
            '    </div>',
            '  </div>',

            '  <!-- ── Construction & Drainage ───────────────────────────────── -->',
            '  <div class="gaip-sheet-section">',
            '    <div class="gaip-form-row-grid">',
            '      <div>',
            '        <label class="gaip-sheet-label">Construction</label>',
            '        <select class="gaip-sheet-construction gaip-sheet-select">',
            '          <option value="sand_carpet">Sand carpet</option>',
            '          <option value="sand_profile">Sand profile (USGA)</option>',
            '          <option value="pipe_drained">Pipe drained + slit drained</option>',
            '          <option value="soil">Soil field</option>',
            '          <option value="hybrid">Hybrid reinforced</option>',
            '        </select>',
            '      </div>',
            '      <div>',
            '        <label class="gaip-sheet-label">Drainage</label>',
            '        <select class="gaip-sheet-drainage gaip-sheet-select">',
            '          <option value="excellent">Excellent (&gt;150 mm/hr)</option>',
            '          <option value="good">Good (100–150 mm/hr)</option>',
            '          <option value="moderate">Moderate (50–100 mm/hr)</option>',
            '          <option value="poor">Poor (&lt;50 mm/hr)</option>',
            '        </select>',
            '      </div>',
            '    </div>',
            '  </div>',

            '  <!-- ── HOC & N Program ───────────────────────────────────────── -->',
            '  <div class="gaip-sheet-section">',
            '    <div class="gaip-form-row-grid">',
            '      <div>',
            '        <label class="gaip-sheet-label">Height of Cut (mm)</label>',
            '        <input type="number" class="gaip-sheet-hoc gaip-sheet-input" value="25" step="0.5" min="1" max="100">',
            '      </div>',
            '      <div>',
            '        <label class="gaip-sheet-label">N Program (kg/ha/yr)</label>',
            '        <input type="number" class="gaip-sheet-n-program gaip-sheet-input" value="200" step="10" min="0" max="500">',
            '      </div>',
            '    </div>',
            '  </div>',

            '  <!-- ── Overseed (C4 only, shown by JS) ───────────────────────── -->',
            '  <div class="gaip-sheet-section gaip-sheet-overseed" style="display:none; background:var(--gaip-good-bg); border:1px solid var(--gaip-good-bg); border-radius:6px; padding:12px;">',
            '    <div style="font-weight:600; color:#166534; margin-bottom:10px;">Winter Overseed Program</div>',
            '    <label class="gaip-sheet-label">Overseed Species</label>',
            '    <select class="gaip-sheet-cool-overseed gaip-sheet-select">',
            '      <option value="">None / No overseed</option>',
            '      <option value="Perennial Ryegrass">Perennial Ryegrass</option>',
            '    </select>',
            '    <label class="gaip-sheet-label" style="margin-top:8px;">Overseed Variety</label>',
            '    <select class="gaip-sheet-overseed-variety gaip-sheet-select">',
            '      <option value="generic">Generic / Unknown</option>',
            '      <option value="RPR">RPR (Regenerating)</option>',
            '      <option value="Slugger 3GL">Slugger 3GL</option>',
            '      <option value="Derby Xtreme">Derby Xtreme</option>',
            '      <option value="SR 4700">SR 4700</option>',
            '      <option value="Karma">Karma</option>',
            '      <option value="Barolympic">Barolympic</option>',
            '      <option value="Barorlando">Barorlando</option>',
            '      <option value="Pinnacle 3">Pinnacle 3</option>',
            '      <option value="Premier 3">Premier 3</option>',
            '      <option value="Intense">Intense</option>',
            '      <option value="Grand Slam GLS">Grand Slam GLS</option>',
            '      <option value="APS">APS</option>',
            '    </select>',
            '    <label class="gaip-sheet-label" style="margin-top:8px;">Summer Management Intent</label>',
            '    <select class="gaip-sheet-overseed-intent gaip-sheet-select">',
            '      <option value="transition">Transition, let ryegrass fade, support couch recovery</option>',
            '      <option value="maintain">Maintain, keep ryegrass through summer</option>',
            '    </select>',
            '  </div>',

            '  <!-- ── Site History ──────────────────────────────────────────── -->',
            '  <div class="gaip-sheet-section" style="background:var(--gaip-warning-bg); border:1px solid var(--gaip-warning-border); border-radius:6px; padding:12px;">',
            '    <div style="font-weight:600; color:#92400e; margin-bottom:10px;">Site History <span style="font-weight:normal;font-size:11px;">(disease risk)</span></div>',
            '    <div class="gaip-form-row-grid" style="grid-template-columns:1fr 1fr 1fr; gap:12px;">',
            '      <div>',
            '        <label class="gaip-sheet-label">Years Est.</label>',
            '        <input type="number" class="gaip-sheet-years-est gaip-sheet-input" placeholder="e.g. 5" step="1" min="0" max="50">',
            '      </div>',
            '      <div>',
            '        <label class="gaip-sheet-label">Thatch (mm)</label>',
            '        <input type="number" class="gaip-sheet-thatch gaip-sheet-input" placeholder="e.g. 12" step="1" min="0" max="50">',
            '      </div>',
            '      <div>',
            '        <label class="gaip-sheet-label">Winter Min (°C)</label>',
            '        <input type="number" class="gaip-sheet-winter-min gaip-sheet-input" placeholder="e.g. -2" step="0.5" min="-20" max="15">',
            '      </div>',
            '    </div>',
            '  </div>',

            '  <!-- ── Poa % ──────────────────────────────────────────────────── -->',
            '  <div class="gaip-sheet-section">',
            '    <label class="gaip-sheet-label">Poa annua % (estimated)</label>',
            '    <input type="number" class="gaip-sheet-poa gaip-sheet-input" value="0" min="0" max="100" step="5">',
            '  </div>',

            '  <!-- ── Weather ───────────────────────────────────────────────── -->',
            '  <div class="gaip-sheet-section">',
            '    <label class="gaip-sheet-label" style="display:flex; align-items:center; gap:8px; cursor:pointer;">',
            '      <input type="checkbox" class="gaip-sheet-live-weather" checked>',
            '      <span>Use live weather (Open-Meteo)</span>',
            '    </label>',
            '    <div class="gaip-sheet-manual-weather" style="display:none; margin-top:10px; padding:10px; background:var(--gaip-surface-muted); border-radius:6px;">',
            '      <div class="gaip-form-row-grid">',
            '        <div>',
            '          <label class="gaip-sheet-label">Min Temp (°C)</label>',
            '          <input type="number" class="gaip-sheet-tmin gaip-sheet-input" step="0.1" value="12">',
            '        </div>',
            '        <div>',
            '          <label class="gaip-sheet-label">Max Temp (°C)</label>',
            '          <input type="number" class="gaip-sheet-tmax gaip-sheet-input" step="0.1" value="24">',
            '        </div>',
            '      </div>',
            '      <div class="gaip-form-row-grid" style="margin-top:8px;">',
            '        <div>',
            '          <label class="gaip-sheet-label">Humidity (%)</label>',
            '          <input type="number" class="gaip-sheet-humidity gaip-sheet-input" step="1" value="65" min="0" max="100">',
            '        </div>',
            '        <div>',
            '          <label class="gaip-sheet-label">Rainfall (mm)</label>',
            '          <input type="number" class="gaip-sheet-rain gaip-sheet-input" step="0.1" value="0" min="0">',
            '        </div>',
            '      </div>',
            '      <div class="gaip-form-row-grid" style="margin-top:8px;">',
            '        <div>',
            '          <label class="gaip-sheet-label">Soil Temp (°C)</label>',
            '          <input type="number" class="gaip-sheet-soil-temp gaip-sheet-input" step="0.1" value="18">',
            '        </div>',
            '        <div>',
            '          <label class="gaip-sheet-label">ETo (mm/day)</label>',
            '          <input type="number" class="gaip-sheet-eto gaip-sheet-input" step="0.1" placeholder="e.g. 4.5">',
            '        </div>',
            '      </div>',
            '    </div>',
            '  </div>',

            '  <!-- ── Apply button ──────────────────────────────────────────── -->',
            '  <div class="gaip-sheet-section">',
            '    <button class="gaip-sheet-apply" type="button">Apply &amp; Run Analysis</button>',
            '  </div>',

            '  </div><!-- /.gaip-sheet-body -->',
            '</div>',
        ].join('\n');
    }

    // =========================================================================
    // CSS
    // =========================================================================

    function injectStyles() {
        if (document.getElementById('gaip-mobile-sheet-styles')) return;

        var css = [

            /* FAB trigger */
            '#' + FAB_ID + ' {',
            '  display: none;',
            '  position: fixed;',
            '  bottom: 24px;',
            '  right: 20px;',
            '  z-index: 9990;',
            '  width: 56px;',
            '  height: 56px;',
            '  border-radius: 50%;',
            '  background: #1a5d1a;',
            '  color: var(--gaip-surface);',
            '  border: none;',
            '  box-shadow: 0 4px 16px rgba(0,0,0,0.3);',
            '  cursor: pointer;',
            '  touch-action: manipulation;',
            '  -webkit-tap-highlight-color: transparent;',
            '  align-items: center;',
            '  justify-content: center;',
            '  transition: background 0.2s, transform 0.15s;',
            '}',
            '#' + FAB_ID + ':active { transform: scale(0.93); background: #145214; }',
            '#' + FAB_ID + ' svg { width: 26px; height: 26px; fill: var(--gaip-surface); pointer-events: none; }',

            /* Badge on FAB showing current turf type initial */
            '#' + FAB_ID + ' .gaip-fab-badge {',
            '  position: absolute;',
            '  top: -4px;',
            '  right: -4px;',
            '  background: #f59e0b;',
            '  color: var(--gaip-text);',
            '  font-size: 10px;',
            '  font-weight: 700;',
            '  border-radius: 10px;',
            '  padding: 2px 5px;',
            '  line-height: 1;',
            '  white-space: nowrap;',
            '  pointer-events: none;',
            '}',

            /* Overlay */
            '.gaip-sheet-overlay {',
            '  display: none;',
            '  position: fixed;',
            '  inset: 0;',
            '  background: rgba(0,0,0,0.45);',
            '  z-index: 9991;',
            '  touch-action: none;',
            '}',
            '.gaip-sheet-overlay.open { display: block; }',

            /* Sheet */
            '.gaip-mobile-sheet {',
            '  position: fixed;',
            '  bottom: 0;',
            '  left: 0;',
            '  right: 0;',
            '  z-index: 9992;',
            '  background: var(--gaip-surface);',
            '  border-radius: 20px 20px 0 0;',
            '  max-height: 90vh;',
            '  display: flex;',
            '  flex-direction: column;',
            '  transform: translateY(100%);',
            '  transition: transform 0.32s cubic-bezier(0.32, 0.72, 0, 1);',
            '  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;',
            '  font-size: 14px;',
            '}',
            '.gaip-mobile-sheet.open { transform: translateY(0); }',

            /* Handle bar */
            '.gaip-sheet-handle-bar {',
            '  display: flex;',
            '  align-items: center;',
            '  padding: 12px 16px 10px;',
            '  flex-shrink: 0;',
            '  border-bottom: 1px solid var(--gaip-border);',
            '}',
            '.gaip-sheet-handle {',
            '  width: 36px;',
            '  height: 4px;',
            '  background: var(--gaip-border);',
            '  border-radius: 2px;',
            '  margin: 0 auto;',
            '  position: absolute;',
            '  left: 50%;',
            '  transform: translateX(-50%);',
            '  top: 8px;',
            '}',
            '.gaip-sheet-title {',
            '  font-size: 16px;',
            '  font-weight: 700;',
            '  color: var(--gaip-text);',
            '  flex: 1;',
            '}',
            '.gaip-sheet-close {',
            '  background: var(--gaip-surface-hover);',
            '  border: none;',
            '  border-radius: 50%;',
            '  width: 32px;',
            '  height: 32px;',
            '  font-size: 16px;',
            '  cursor: pointer;',
            '  display: flex;',
            '  align-items: center;',
            '  justify-content: center;',
            '  color: var(--gaip-text);',
            '  touch-action: manipulation;',
            '  -webkit-tap-highlight-color: transparent;',
            '  flex-shrink: 0;',
            '}',

            /* Scrollable body */
            '.gaip-sheet-body {',
            '  overflow-y: auto;',
            '  -webkit-overflow-scrolling: touch;',
            '  padding: 4px 16px 48px;',
            '  flex: 1;',
            '}',

            /* Sections */
            '.gaip-sheet-section {',
            '  margin-bottom: 16px;',
            '  padding-top: 4px;',
            '}',
            '.gaip-sheet-label {',
            '  display: block;',
            '  font-size: 12px;',
            '  font-weight: 600;',
            '  color: var(--gaip-text);',
            '  margin-bottom: 4px;',
            '  text-transform: uppercase;',
            '  letter-spacing: 0.04em;',
            '}',

            /* Sheet-specific inputs & selects */
            '.gaip-sheet-input, .gaip-sheet-select {',
            '  width: 100%;',
            '  padding: 10px 12px;',
            '  border: 1.5px solid var(--gaip-border);',
            '  border-radius: 8px;',
            '  font-size: 15px;',
            '  background: var(--gaip-surface);',
            '  box-sizing: border-box;',
            '  -webkit-appearance: none;',
            '  appearance: none;',
            '  color: var(--gaip-text);',
            '}',
            '.gaip-sheet-input:focus, .gaip-sheet-select:focus {',
            '  border-color: #1a5d1a;',
            '  outline: none;',
            '}',

            /* Apply button */
            '.gaip-sheet-apply {',
            '  width: 100%;',
            '  padding: 14px;',
            '  background: #1a5d1a;',
            '  color: var(--gaip-surface);',
            '  border: none;',
            '  border-radius: 10px;',
            '  font-size: 16px;',
            '  font-weight: 700;',
            '  cursor: pointer;',
            '  touch-action: manipulation;',
            '  -webkit-tap-highlight-color: transparent;',
            '}',
            '.gaip-sheet-apply:active { background: #145214; }',

            /* Only show FAB on mobile */
            '@media (min-width: 769px) {',
            '  #' + FAB_ID + ' { display: none !important; }',
            '  .gaip-sheet-overlay, .gaip-mobile-sheet { display: none !important; }',
            '}',
            '@media (max-width: 768px) {',
            '  #' + FAB_ID + ' { display: flex; }',
            '}',

        ].join('\n');

        var style = document.createElement('style');
        style.id = 'gaip-mobile-sheet-styles';
        style.textContent = css;
        document.head.appendChild(style);
    }

    // =========================================================================
    // SHEET CONTROLLER
    // =========================================================================

    var Sheet = {

        el: null,
        overlay: null,
        fab: null,
        _startY: 0,
        _currentY: 0,
        _dragging: false,

        init: function () {
            injectStyles();
            this._inject();
            this._bindFAB();
            this._bindSheet();
            this._bindDrag();
            this._observeTurfProfile();
            log('Initialized');
        },

        _inject: function () {
            var wrapper = document.createElement('div');
            wrapper.innerHTML = buildSheetHTML();
            while (wrapper.firstChild) {
                document.body.appendChild(wrapper.firstChild);
            }
            this.el      = document.getElementById(SHEET_ID);
            this.overlay = document.getElementById(OVERLAY_ID);
            this.fab     = document.getElementById(FAB_ID);
        },

        // -----------------------------------------------------------------
        // FAB
        // -----------------------------------------------------------------

        _bindFAB: function () {
            if (!this.fab) return;
            var self = this;
            this.fab.addEventListener('click', function (e) {
                e.stopPropagation();
                self.open();
            });
        },

        _updateFABBadge: function () {
            if (!this.fab) return;
            var badge = this.fab.querySelector('.gaip-fab-badge');
            if (!badge) return;

            var turfType = realVal('.gaip-turf-type-option.selected');
            // turfType is a boolean from checked — need the data-type attribute instead
            var selectedBtn = document.querySelector('.gaip-turf-type-option.selected');
            var label = selectedBtn ? (selectedBtn.dataset.type || '').toUpperCase().slice(0, 1) : '?';
            badge.textContent = label;
        },

        // -----------------------------------------------------------------
        // OPEN / CLOSE
        // -----------------------------------------------------------------

        open: function () {
            this._syncFromCard();
            this.el.classList.add('open');
            this.overlay.classList.add('open');
            document.body.style.overflow = 'hidden';
            // Focus first interactive element for a11y
            var first = this.el.querySelector('button, select, input');
            if (first) setTimeout(function () { first.focus(); }, 350);
        },

        close: function () {
            this.el.classList.remove('open');
            this.overlay.classList.remove('open');
            document.body.style.overflow = '';
        },

        // -----------------------------------------------------------------
        // SHEET BINDINGS
        // -----------------------------------------------------------------

        _bindSheet: function () {
            var self = this;
            var sheet = this.el;
            if (!sheet) return;

            // Close via overlay / close button
            this.overlay.addEventListener('click', function () { self.close(); });
            sheet.querySelector('.gaip-sheet-close').addEventListener('click', function () { self.close(); });

            // ── Turf type buttons ────────────────────────────────────────
            sheet.querySelectorAll('.gaip-sheet-type-btn').forEach(function (btn) {
                btn.addEventListener('click', function () {
                    var type = this.dataset.type;
                    // Click the real button to trigger the full controller cascade
                    clickReal('.gaip-turf-type-option[data-type="' + type + '"]');
                    // Update sheet UI immediately (don't wait for observer)
                    self._highlightType(type);
                    self._showSubcategory(type);
                });
            });

            // ── Subcategory buttons ──────────────────────────────────────
            sheet.querySelectorAll('.gaip-sheet-sub-btn').forEach(function (btn) {
                btn.addEventListener('click', function () {
                    var surface = this.dataset.surface;
                    var sport   = this.dataset.sport;
                    var selector = surface
                        ? '.gaip-subcategory-option[data-surface="' + surface + '"]'
                        : '.gaip-subcategory-option[data-sport="' + sport + '"]';
                    clickReal(selector);
                    self._highlightSub(surface || sport);
                });
            });

            // ── Species ──────────────────────────────────────────────────
            sheet.querySelector('.gaip-sheet-species').addEventListener('change', function () {
                setReal('.gaip-species', this.value, 'change');
                // After species changes, re-sync variety options with a small delay
                setTimeout(function () { self._syncVarietyOptions(); }, 100);
            });

            // ── Variety ──────────────────────────────────────────────────
            sheet.querySelector('.gaip-sheet-variety').addEventListener('change', function () {
                setReal('.gaip-variety', this.value, 'change');
            });

            // ── Construction / Drainage / HOC / N Program ────────────────
            [
                ['.gaip-sheet-construction', '.gaip-construction'],
                ['.gaip-sheet-drainage',     '.gaip-drainage'],
            ].forEach(function (pair) {
                sheet.querySelector(pair[0]).addEventListener('change', function () {
                    setReal(pair[1], this.value, 'change');
                });
            });
            [
                ['.gaip-sheet-hoc',       '.gaip-hoc'],
                ['.gaip-sheet-n-program', '.gaip-n-program'],
            ].forEach(function (pair) {
                sheet.querySelector(pair[0]).addEventListener('input', function () {
                    setReal(pair[1], this.value, 'input');
                });
            });

            // ── Overseed ─────────────────────────────────────────────────
            sheet.querySelector('.gaip-sheet-cool-overseed').addEventListener('change', function () {
                setReal('.gaip-cool-overseed', this.value, 'change');
            });
            sheet.querySelector('.gaip-sheet-overseed-variety').addEventListener('change', function () {
                setReal('.gaip-overseed-variety', this.value, 'change');
            });
            sheet.querySelector('.gaip-sheet-overseed-intent').addEventListener('change', function () {
                setReal('.gaip-overseed-summer-intent', this.value, 'change');
            });

            // ── Site history ──────────────────────────────────────────────
            [
                ['.gaip-sheet-years-est',  '.gaip-years-established'],
                ['.gaip-sheet-thatch',     '.gaip-thatch-depth'],
                ['.gaip-sheet-winter-min', '.gaip-winter-min-temp'],
                ['.gaip-sheet-poa',        '.gaip-poa-percent'],
            ].forEach(function (pair) {
                sheet.querySelector(pair[0]).addEventListener('input', function () {
                    setReal(pair[1], this.value, 'input');
                });
            });

            // ── Live weather toggle ───────────────────────────────────────
            var liveWeatherCb  = sheet.querySelector('.gaip-sheet-live-weather');
            var manualSection  = sheet.querySelector('.gaip-sheet-manual-weather');
            liveWeatherCb.addEventListener('change', function () {
                manualSection.style.display = this.checked ? 'none' : 'block';
                setReal('.gaip-use-live-weather', this.checked, 'change');
            });

            // ── Manual weather inputs ─────────────────────────────────────
            [
                ['.gaip-sheet-tmin',      '.gaip-manual-tmin'],
                ['.gaip-sheet-tmax',      '.gaip-manual-tmax'],
                ['.gaip-sheet-humidity',  '.gaip-manual-humidity'],
                ['.gaip-sheet-rain',      '.gaip-manual-rain'],
                ['.gaip-sheet-soil-temp', '.gaip-manual-soil-temp'],
                ['.gaip-sheet-eto',       '.gaip-manual-eto'],
            ].forEach(function (pair) {
                sheet.querySelector(pair[0]).addEventListener('input', function () {
                    setReal(pair[1], this.value, 'input');
                });
            });

            // ── Apply button ──────────────────────────────────────────────
            sheet.querySelector('.gaip-sheet-apply').addEventListener('click', function () {
                self.close();
                // Trigger the Hub's Run button
                var runBtn = document.getElementById('gaip-run-btn') ||
                             document.querySelector('.gaip-run-btn, .gaip-floating-run-btn button');
                if (runBtn) {
                    setTimeout(function () { runBtn.click(); }, 200);
                }
            });
        },

        // -----------------------------------------------------------------
        // DRAG TO DISMISS
        // -----------------------------------------------------------------

        _bindDrag: function () {
            var self  = this;
            var sheet = this.el;
            if (!sheet) return;

            sheet.addEventListener('touchstart', function (e) {
                // Only drag from the handle bar
                if (!e.target.closest('.gaip-sheet-handle-bar')) return;
                self._dragging = true;
                self._startY   = e.touches[0].clientY;
                sheet.style.transition = 'none';
            }, { passive: true });

            sheet.addEventListener('touchmove', function (e) {
                if (!self._dragging) return;
                self._currentY = e.touches[0].clientY;
                var delta = self._currentY - self._startY;
                if (delta < 0) return; // Don't drag up
                sheet.style.transform = 'translateY(' + delta + 'px)';
            }, { passive: true });

            sheet.addEventListener('touchend', function () {
                if (!self._dragging) return;
                self._dragging = false;
                sheet.style.transition = '';
                var delta = self._currentY - self._startY;
                if (delta > 80) {
                    self.close();
                } else {
                    sheet.style.transform = '';
                }
            });
        },

        // -----------------------------------------------------------------
        // SYNC FROM CARD → SHEET  (called on open)
        // -----------------------------------------------------------------

        _syncFromCard: function () {
            var sheet = this.el;
            if (!sheet) return;

            // Turf type
            var selectedType = document.querySelector('.gaip-turf-type-option.selected');
            var turfType = selectedType ? selectedType.dataset.type : null;
            if (turfType) {
                this._highlightType(turfType);
                this._showSubcategory(turfType);
            }

            // Subcategory
            var selectedSub = document.querySelector('.gaip-subcategory-option.selected');
            if (selectedSub) {
                var subVal = selectedSub.dataset.surface || selectedSub.dataset.sport;
                this._highlightSub(subVal);
            }

            // Species — mirror options from real select
            this._syncSpeciesOptions();
            this._syncVarietyOptions();

            // Simple selects
            [
                ['.gaip-sheet-construction', '.gaip-construction'],
                ['.gaip-sheet-drainage',     '.gaip-drainage'],
            ].forEach(function (pair) {
                var v = realVal(pair[1]);
                if (v !== null) sheet.querySelector(pair[0]).value = v;
            });

            // Number inputs
            [
                ['.gaip-sheet-hoc',       '.gaip-hoc'],
                ['.gaip-sheet-n-program', '.gaip-n-program'],
                ['.gaip-sheet-years-est', '.gaip-years-established'],
                ['.gaip-sheet-thatch',    '.gaip-thatch-depth'],
                ['.gaip-sheet-winter-min','.gaip-winter-min-temp'],
                ['.gaip-sheet-poa',       '.gaip-poa-percent'],
            ].forEach(function (pair) {
                var v = realVal(pair[1]);
                if (v !== null && v !== '') sheet.querySelector(pair[0]).value = v;
            });

            // Overseed
            var overseedSection = document.querySelector('.gaip-overseed-section');
            var sheetOverseed   = sheet.querySelector('.gaip-sheet-overseed');
            if (overseedSection && sheetOverseed) {
                var overseedVisible = overseedSection.style.display !== 'none';
                sheetOverseed.style.display = overseedVisible ? 'block' : 'none';
            }
            [
                ['.gaip-sheet-cool-overseed',     '.gaip-cool-overseed'],
                ['.gaip-sheet-overseed-variety',  '.gaip-overseed-variety'],
                ['.gaip-sheet-overseed-intent',   '.gaip-overseed-summer-intent'],
            ].forEach(function (pair) {
                var v = realVal(pair[1]);
                if (v !== null) sheet.querySelector(pair[0]).value = v;
            });

            // Live weather
            var liveChecked  = realVal('.gaip-use-live-weather');
            var sheetLiveCb  = sheet.querySelector('.gaip-sheet-live-weather');
            var sheetManual  = sheet.querySelector('.gaip-sheet-manual-weather');
            sheetLiveCb.checked = !!liveChecked;
            sheetManual.style.display = liveChecked ? 'none' : 'block';

            // Manual weather inputs
            [
                ['.gaip-sheet-tmin',      '.gaip-manual-tmin'],
                ['.gaip-sheet-tmax',      '.gaip-manual-tmax'],
                ['.gaip-sheet-humidity',  '.gaip-manual-humidity'],
                ['.gaip-sheet-rain',      '.gaip-manual-rain'],
                ['.gaip-sheet-soil-temp', '.gaip-manual-soil-temp'],
                ['.gaip-sheet-eto',       '.gaip-manual-eto'],
            ].forEach(function (pair) {
                var v = realVal(pair[1]);
                if (v !== null && v !== '') sheet.querySelector(pair[0]).value = v;
            });
        },

        // -----------------------------------------------------------------
        // SPECIES & VARIETY OPTION MIRRORING
        // -----------------------------------------------------------------

        _syncSpeciesOptions: function () {
            var realSelect  = document.querySelector('.gaip-species');
            var sheetSelect = this.el.querySelector('.gaip-sheet-species');
            if (!realSelect || !sheetSelect) return;

            sheetSelect.innerHTML = realSelect.innerHTML;
            sheetSelect.value     = realSelect.value;
        },

        _syncVarietyOptions: function () {
            var realSelect  = document.querySelector('.gaip-variety');
            var sheetSelect = this.el.querySelector('.gaip-sheet-variety');
            if (!realSelect || !sheetSelect) return;

            sheetSelect.innerHTML = realSelect.innerHTML;
            sheetSelect.value     = realSelect.value;
        },

        // -----------------------------------------------------------------
        // UI STATE HELPERS
        // -----------------------------------------------------------------

        _highlightType: function (type) {
            var sheet = this.el;
            sheet.querySelectorAll('.gaip-sheet-type-btn').forEach(function (btn) {
                btn.classList.toggle('selected', btn.dataset.type === type);
            });
        },

        _showSubcategory: function (type) {
            var sheet = this.el;
            sheet.querySelector('.gaip-sheet-golf-sub').style.display   = type === 'golf'   ? 'block' : 'none';
            sheet.querySelector('.gaip-sheet-sports-sub').style.display = type === 'sports' ? 'block' : 'none';
        },

        _highlightSub: function (val) {
            var sheet = this.el;
            sheet.querySelectorAll('.gaip-sheet-sub-btn').forEach(function (btn) {
                var btnVal = btn.dataset.surface || btn.dataset.sport;
                btn.classList.toggle('selected', btnVal === val);
            });
        },

        // -----------------------------------------------------------------
        // OBSERVE CARD FOR EXTERNAL CHANGES (persistence restore, etc.)
        // -----------------------------------------------------------------

        _observeTurfProfile: function () {
            var self = this;

            // Listen for TurfProfile state dispatches to keep FAB badge current
            document.addEventListener('gaip:turf-profile-change', function () {
                self._updateFABBadge();
            });

            // Also listen for the TurfProfileController's custom event
            document.addEventListener('gaip:state-update', function () {
                self._updateFABBadge();
            });

            // Observe variety select changes (populated dynamically)
            var varietyEl = document.querySelector('.gaip-variety');
            if (varietyEl && window.MutationObserver) {
                new MutationObserver(function () {
                    // If sheet is open, re-sync variety options
                    if (self.el && self.el.classList.contains('open')) {
                        self._syncVarietyOptions();
                    }
                }).observe(varietyEl, { childList: true });
            }

            // Initial badge update
            setTimeout(function () { self._updateFABBadge(); }, 500);
        },

    };

    // =========================================================================
    // INIT
    // =========================================================================

    function init() {
        // Build FAB element first (HTML is injected by buildSheetHTML called in Sheet.init)
        // but FAB needs to be created first
        var fab = document.createElement('button');
        fab.id = FAB_ID;
        fab.setAttribute('aria-label', 'Open Turf Profile Settings');
        fab.innerHTML = [
            '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">',
            '<path d="M19.14 12.94c.04-.3.06-.61.06-.94s-.02-.64-.07-.94l2.03-1.58a.49.49 0 0 0 .12-.61l-1.92-3.32a.49.49 0 0 0-.59-.22l-2.39.96a6.97 6.97 0 0 0-1.62-.94l-.36-2.54a.484.484 0 0 0-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54a7.22 7.22 0 0 0-1.62.94l-2.39-.96a.47.47 0 0 0-.59.22L2.74 8.87a.47.47 0 0 0 .12.61l2.03 1.58c-.05.3-.09.63-.09.94s.02.64.07.94l-2.03 1.58a.49.49 0 0 0-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54a7.22 7.22 0 0 0 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32a.47.47 0 0 0-.12-.61l-2.01-1.58zM12 15.6a3.6 3.6 0 1 1 0-7.2 3.6 3.6 0 0 1 0 7.2z"/>',
            '</svg>',
            '<span class="gaip-fab-badge">?</span>',
        ].join('');
        document.body.appendChild(fab);

        Sheet.init();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    // Expose for debugging
    global.GaipMobileTurfSheet = Sheet;

}(window));
