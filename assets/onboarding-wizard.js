/**
 * Onboarding Wizard — new hub (db-shell)
 * Replaces site-setup-wizard.js from old hub.
 *
 * Shows when user has no active site or no species configured.
 * Steps: Welcome → Location → Turf Type → Species & Method → What Now
 * On finish: saves via API then reloads dashboard.
 */
(function () {
    'use strict';

    var cfg  = window.GAIP_HUB_CONFIG || {};
    var CSRF = cfg.csrfToken || (document.querySelector('meta[name="csrf-token"]') || {}).content || '';
    var API  = (cfg.restUrl || '/api/').replace(/\/?$/, '/');

    // ── Species data (from turf-profile-controller.js) ───────────────────────

    // ── Wizard state ─────────────────────────────────────────────────────────
    var W = {
        step:    0,
        total:   5,
        overlay: null,
        modal:   null,
        d: {
            location:    null,   // { lat, lon, name }
            turfType:    null,   // 'sports' | 'golf' | 'lawns'
            subCategory: null,   // 'greens' | 'fairways' | 'tees' | 'surrounds'
            species:     null,
            methodology: null,
        },

        // ── Init ─────────────────────────────────────────────────────────────
        init: function () {
            var loc = cfg.savedLocation || {};
            var isSetUp = !!(cfg.turfSpecies && cfg.turfMethodology && loc.lat && loc.lon);
            if (isSetUp) return;

            if (new URLSearchParams(window.location.search).get('setup') === '1') {
                history.replaceState(null, '', window.location.pathname + window.location.hash);
                this.show();
            }
        },

        show: function () {
            this._buildOverlay();
            this._render();
            document.body.style.overflow = 'hidden';
        },

        // ── Overlay / modal shell ─────────────────────────────────────────────
        _buildOverlay: function () {
            var self = this;
            this.overlay = document.createElement('div');
            Object.assign(this.overlay.style, {
                position: 'fixed', inset: '0',
                background: 'rgba(10,24,16,0.6)',
                zIndex: '9999',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                backdropFilter: 'blur(3px)',
            });
            this.modal = document.createElement('div');
            Object.assign(this.modal.style, {
                background: 'var(--gaip-surface, #fff)',
                borderRadius: '12px',
                width: '90%', maxWidth: '520px',
                maxHeight: '88vh', overflowY: 'auto',
                boxShadow: '0 24px 64px rgba(0,0,0,0.24)',
                fontFamily: 'var(--gaip-font, "Barlow", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif)',
                fontSize: '14px',
                color: 'var(--gaip-text, #17231f)',
            });
            this.overlay.appendChild(this.modal);
            document.body.appendChild(this.overlay);
        },

        _render: function () {
            this.modal.innerHTML = '';
            this.modal.appendChild(this._buildProgress());
            var body = document.createElement('div');
            body.style.cssText = 'padding:24px 28px 8px';
            this.modal.appendChild(body);
            [
                this._step0_Welcome,
                this._step1_Location,
                this._step2_TurfType,
                this._step3_Species,
                this._step4_WhatNow,
            ][this.step].call(this, body);
            this.modal.appendChild(this._buildNav());
        },

        // ── Progress bar ──────────────────────────────────────────────────────
        _buildProgress: function () {
            var bar = document.createElement('div');
            bar.style.cssText = 'display:flex;gap:4px;padding:16px 28px 0';
            for (var i = 0; i < this.total; i++) {
                var seg = document.createElement('div');
                seg.style.cssText = 'flex:1;height:4px;border-radius:2px;background:' +
                    (i <= this.step ? 'var(--gaip-accent,#2da85e)' : 'var(--gaip-border,#d1dbd6)');
                bar.appendChild(seg);
            }
            return bar;
        },

        // ── Nav buttons ───────────────────────────────────────────────────────
        _buildNav: function () {
            var self = this;
            var nav = document.createElement('div');
            nav.style.cssText = 'display:flex;justify-content:space-between;align-items:center;padding:16px 28px 20px;border-top:1px solid var(--gaip-border,#d1dbd6);margin-top:16px';

            var back = document.createElement('button');
            back.type = 'button';
            back.textContent = this.step === 0 ? 'Skip Setup' : '← Back';
            back.style.cssText = 'background:none;border:none;color:var(--gaip-text-muted,#6b8878);cursor:pointer;font-size:14px;padding:8px 0;font-family:inherit';
            back.addEventListener('click', function () {
                if (self.step === 0) { self._skip(); }
                else { self.step--; self._render(); }
            });

            var indicator = document.createElement('span');
            indicator.style.cssText = 'font-size:12px;color:var(--gaip-text-muted,#6b8878)';
            indicator.textContent = 'Step ' + (this.step + 1) + ' of ' + this.total;

            var isLast = this.step === this.total - 1;
            var canGo  = this._canProceed();
            var next = document.createElement('button');
            next.type = 'button';
            next.textContent = isLast ? 'Go to Dashboard' : 'Next →';
            next.style.cssText = [
                'border:none;border-radius:8px;padding:10px 22px',
                'font-size:14px;font-weight:600;font-family:inherit',
                'background:' + (canGo ? 'var(--gaip-accent,#2da85e)' : 'var(--gaip-border,#d1dbd6)'),
                'color:' + (canGo ? '#fff' : 'var(--gaip-text-muted,#6b8878)'),
                'cursor:' + (canGo ? 'pointer' : 'not-allowed'),
                'transition:background 0.15s',
            ].join(';');
            next.addEventListener('click', function () {
                if (!self._canProceed()) return;
                if (isLast) { self._finish(); }
                else { self.step++; self._render(); }
            });

            nav.appendChild(back);
            nav.appendChild(indicator);
            nav.appendChild(next);
            return nav;
        },

        _canProceed: function () {
            switch (this.step) {
                case 0: return true;
                case 1: return !!this.d.location;
                case 2: return !!this.d.turfType && (this.d.turfType !== 'golf' || !!this.d.subCategory);
                case 3: return !!this.d.species && !!this.d.methodology;
                case 4: return true;
                default: return false;
            }
        },

        // ── Step 0: Welcome ───────────────────────────────────────────────────
        _step0_Welcome: function (c) {
            c.innerHTML = [
                '<div style="text-align:center;padding:8px 0 16px">',
                '<svg width="44" height="44" viewBox="0 0 48 48" fill="none" style="display:block;margin:0 auto 14px">',
                '<rect width="48" height="48" rx="10" fill="var(--gaip-accent,#2da85e)"/>',
                '<text x="24" y="25" text-anchor="middle" dominant-baseline="middle" font-family="Arial,Helvetica,sans-serif" font-size="32" font-weight="700" fill="white">G</text>',
                '</svg>',
                '<h2 style="margin:0 0 8px;font-size:21px;font-weight:700;color:var(--gaip-text,#17231f)">Welcome to the Gilba Hub</h2>',
                '<p style="color:var(--gaip-text-secondary,#4a5e55);font-size:14px;line-height:1.6;margin:0 0 20px">',
                'Quick setup — three steps to configure your site so every analysis',
                ' uses the right thresholds for your turf.',
                '</p>',
                '<div style="background:var(--gaip-surface-muted,#f3f7f5);border:1px solid var(--gaip-border,#d1dbd6);border-radius:8px;padding:14px 16px;text-align:left;font-size:13px;line-height:1.8;color:var(--gaip-text,#17231f)">',
                this._iconRow('M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z M15 11a3 3 0 11-6 0 3 3 0 016 0z', 'Location — for live weather &amp; climate data'),
                this._iconRow('M3 17l4-4 4 3 4-6 4-2 M3 21h18', 'Turf type — greens, sports field, etc.'),
                this._iconRow('M9 3H5a2 2 0 00-2 2v4m6-6h10a2 2 0 012 2v4M9 3v18m0 0h10a2 2 0 002-2V9M9 21H5a2 2 0 01-2-2V9m0 0h18', 'Species &amp; soil methodology'),
                '</div>',
                '<p style="color:var(--gaip-text-muted,#6b8878);font-size:12px;margin:14px 0 0">',
                'You can change all settings anytime in Settings.',
                '</p>',
                '</div>',
            ].join('');
        },

        _iconRow: function (d, label) {
            return '<div style="display:flex;align-items:center;gap:8px;margin-bottom:2px">' +
                '<svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="var(--gaip-accent,#2da85e)" stroke-width="2" style="flex-shrink:0"><path stroke-linecap="round" stroke-linejoin="round" d="' + d + '"/></svg>' +
                '<span>' + label + '</span></div>';
        },

        // ── Step 1: Location ──────────────────────────────────────────────────
        _step1_Location: function (c) {
            var self = this;
            var loc  = this.d.location;

            c.innerHTML = [
                '<h3 style="margin:0 0 4px;font-size:17px;font-weight:700;color:var(--gaip-text,#17231f)">Where is your site?</h3>',
                '<p style="color:var(--gaip-text-secondary,#4a5e55);font-size:13px;margin:0 0 16px">',
                'Used for live weather data, disease models, and growth potential calculations.',
                '</p>',
                '<label style="display:block;font-size:11px;font-weight:700;color:var(--gaip-text-muted,#6b8878);margin-bottom:5px;text-transform:uppercase;letter-spacing:.5px">Search location</label>',
                '<div style="position:relative">',
                '<input type="text" id="wiz-loc-search" autocomplete="off" placeholder="Search suburb, city, or course name…"',
                ' value="' + this._esc(loc ? loc.name : '') + '"',
                ' style="width:100%;padding:9px 12px;border:1px solid var(--gaip-border,#d1dbd6);border-radius:8px;font-size:14px;font-family:inherit;box-sizing:border-box;color:var(--gaip-text,#17231f);background:var(--gaip-surface,#fff)">',
                '<div id="wiz-loc-results" style="display:none;position:absolute;top:100%;left:0;right:0;background:var(--gaip-surface,#fff);border:1px solid var(--gaip-border,#d1dbd6);border-radius:8px;box-shadow:0 8px 24px rgba(0,0,0,.1);z-index:100;max-height:200px;overflow-y:auto"></div>',
                '</div>',
                '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:12px">',
                '<div><label style="display:block;font-size:11px;color:var(--gaip-text-muted,#6b8878);margin-bottom:4px">Latitude</label>',
                '<input type="number" id="wiz-lat" step="0.0001" placeholder="-37.8136" value="' + (loc ? loc.lat : '') + '"',
                ' style="width:100%;padding:8px 10px;border:1px solid var(--gaip-border,#d1dbd6);border-radius:6px;font-size:13px;font-family:inherit;box-sizing:border-box;color:var(--gaip-text,#17231f);background:var(--gaip-surface,#fff)"></div>',
                '<div><label style="display:block;font-size:11px;color:var(--gaip-text-muted,#6b8878);margin-bottom:4px">Longitude</label>',
                '<input type="number" id="wiz-lon" step="0.0001" placeholder="144.9631" value="' + (loc ? loc.lon : '') + '"',
                ' style="width:100%;padding:8px 10px;border:1px solid var(--gaip-border,#d1dbd6);border-radius:6px;font-size:13px;font-family:inherit;box-sizing:border-box;color:var(--gaip-text,#17231f);background:var(--gaip-surface,#fff)"></div>',
                '</div>',
                loc ? '<div style="margin-top:12px;padding:9px 12px;background:var(--gaip-surface-muted,#f3f7f5);border:1px solid var(--gaip-border,#d1dbd6);border-radius:6px;font-size:13px;color:var(--gaip-text,#17231f)"><svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="var(--gaip-accent,#2da85e)" stroke-width="2.5" style="vertical-align:middle;margin-right:5px"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/></svg>' + this._esc(loc.name) + ' (' + loc.lat.toFixed(4) + ', ' + loc.lon.toFixed(4) + ')</div>' : '',
            ].join('');

            // Geocode search
            var input   = document.getElementById('wiz-loc-search');
            var results = document.getElementById('wiz-loc-results');
            var timer   = null;
            if (input) {
                input.addEventListener('input', function () {
                    clearTimeout(timer);
                    var q = this.value.trim();
                    if (q.length < 2) { results.style.display = 'none'; return; }
                    timer = setTimeout(function () { self._geocode(q, results); }, 300);
                });
                document.addEventListener('click', function onOutside(e) {
                    if (!input.contains(e.target) && !results.contains(e.target)) {
                        results.style.display = 'none';
                        document.removeEventListener('click', onOutside);
                    }
                });
            }

            // Manual lat/lon
            var latEl = document.getElementById('wiz-lat');
            var lonEl = document.getElementById('wiz-lon');
            function fromManual() {
                var lat = parseFloat(latEl.value), lon = parseFloat(lonEl.value);
                if (!isNaN(lat) && !isNaN(lon) && lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180) {
                    self.d.location = { lat: lat, lon: lon, name: 'Manual (' + lat.toFixed(2) + ', ' + lon.toFixed(2) + ')' };
                    self._render();
                }
            }
            if (latEl) latEl.addEventListener('change', fromManual);
            if (lonEl) lonEl.addEventListener('change', fromManual);
        },

        _geocode: function (q, resultsEl) {
            var self = this;
            window.GilbaGeo.search(q, function (preds) {
                if (!preds.length) {
                    resultsEl.innerHTML = '<div style="padding:10px 12px;font-size:13px;color:var(--gaip-text-muted,#6b8878)">No results found</div>';
                    resultsEl.style.display = 'block';
                    return;
                }
                resultsEl.innerHTML = '';
                preds.forEach(function (p) {
                    var item = document.createElement('div');
                    item.style.cssText = 'padding:9px 12px;cursor:pointer;border-bottom:1px solid var(--gaip-border,#d1dbd6)';
                    item.innerHTML = '<div style="font-size:13px;color:var(--gaip-text,#17231f)">' + self._esc(p.description) + '</div>';
                    item.addEventListener('mouseenter', function () { this.style.background = 'var(--gaip-surface-muted,#f3f7f5)'; });
                    item.addEventListener('mouseleave', function () { this.style.background = ''; });
                    item.addEventListener('click', function () {
                        resultsEl.style.display = 'none';
                        window.GilbaGeo.getDetails(p.placeId, function (loc) {
                            if (!loc) return;
                            self.d.location = { lat: loc.lat, lon: loc.lon, name: loc.name };
                            self._render();
                        });
                    });
                    resultsEl.appendChild(item);
                });
                resultsEl.style.display = 'block';
            });
        },

        // ── Step 2: Turf Type ─────────────────────────────────────────────────
        _step2_TurfType: function (c) {
            var self = this;

            var typeHtml = [
                { id: 'sports', label: 'Sports Field', desc: 'Soccer, AFL, Rugby, Cricket',
                  icon: 'M3 17l4-4 4 3 4-6 4-2 M3 21h18' },
                { id: 'golf',   label: 'Golf',         desc: 'Greens, Fairways, Tees',
                  icon: 'M12 2a10 10 0 100 20 10 10 0 000-20z M12 8v4l3 3' },
                { id: 'lawns',  label: 'Lawns',        desc: 'Residential, Parks',
                  icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6' },
            ].map(function (t) {
                var active = self.d.turfType === t.id;
                return '<div data-type="' + t.id + '" class="wiz-type-btn" style="text-align:center;padding:16px 10px;border:2px solid ' +
                    (active ? 'var(--gaip-accent,#2da85e)' : 'var(--gaip-border,#d1dbd6)') +
                    ';border-radius:10px;cursor:pointer;background:' +
                    (active ? 'var(--gaip-surface-muted,#f3f7f5)' : 'var(--gaip-surface,#fff)') +
                    ';transition:all .15s">' +
                    '<svg width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="' +
                    (active ? 'var(--gaip-accent,#2da85e)' : 'var(--gaip-text-muted,#6b8878)') +
                    '" stroke-width="2" style="display:block;margin:0 auto 8px"><path stroke-linecap="round" stroke-linejoin="round" d="' + t.icon + '"/></svg>' +
                    '<div style="font-size:13px;font-weight:700;color:' + (active ? 'var(--gaip-accent,#2da85e)' : 'var(--gaip-text,#17231f)') + '">' + t.label + '</div>' +
                    '<div style="font-size:11px;color:var(--gaip-text-muted,#6b8878);margin-top:2px">' + t.desc + '</div>' +
                    '</div>';
            }).join('');

            var subHtml = '';
            if (this.d.turfType === 'golf') {
                var subs = ['greens', 'fairways', 'tees', 'surrounds'];
                subHtml = '<div style="margin-top:16px">' +
                    '<label style="display:block;font-size:11px;font-weight:700;color:var(--gaip-text-muted,#6b8878);margin-bottom:8px;text-transform:uppercase;letter-spacing:.5px">Surface type</label>' +
                    '<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px">' +
                    subs.map(function (s) {
                        var a = self.d.subCategory === s;
                        return '<div data-sub="' + s + '" class="wiz-sub-btn" style="text-align:center;padding:9px 6px;border:2px solid ' +
                            (a ? 'var(--gaip-accent,#2da85e)' : 'var(--gaip-border,#d1dbd6)') +
                            ';border-radius:8px;cursor:pointer;font-size:12px;font-weight:700;color:' +
                            (a ? 'var(--gaip-accent,#2da85e)' : 'var(--gaip-text-secondary,#4a5e55)') +
                            ';background:' + (a ? 'var(--gaip-surface-muted,#f3f7f5)' : 'var(--gaip-surface,#fff)') +
                            ';text-transform:capitalize;transition:all .15s">' + s + '</div>';
                    }).join('') +
                    '</div></div>';
            }

            c.innerHTML = '<h3 style="margin:0 0 4px;font-size:17px;font-weight:700;color:var(--gaip-text,#17231f)">What are you managing?</h3>' +
                '<p style="color:var(--gaip-text-secondary,#4a5e55);font-size:13px;margin:0 0 16px">Sets interpretation thresholds, species options, and analysis parameters.</p>' +
                '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px">' + typeHtml + '</div>' +
                subHtml;

            c.querySelectorAll('.wiz-type-btn').forEach(function (btn) {
                btn.addEventListener('click', function () {
                    self.d.turfType = this.dataset.type;
                    if (self.d.turfType !== 'golf') self.d.subCategory = null;
                    self.d.species = null;
                    self._render();
                });
            });
            c.querySelectorAll('.wiz-sub-btn').forEach(function (btn) {
                btn.addEventListener('click', function () {
                    self.d.subCategory = this.dataset.sub;
                    self.d.species = null;
                    self._render();
                });
            });
        },

        // ── Step 3: Species & Methodology ─────────────────────────────────────
        _step3_Species: function (c) {
            var self    = this;
            var isNZ    = this._isNZ();
            var options = this._speciesOptions();

            // Auto-suggest methodology first time
            if (!this.d.methodology) {
                this.d.methodology = isNZ ? 'ammonium_acetate'
                    : (this.d.turfType === 'golf' && this.d.subCategory === 'greens') ? 'mlsn'
                    : 'slan';
            }

            var methods = [
                { id: 'mlsn',             label: 'MLSN',              desc: 'Threshold-based. Validated for sand-based putting greens.' },
                { id: 'slan',             label: 'SLAN',              desc: 'Sufficiency ranges. Standard for sports fields, fairways, lawns.' },
            ];
            if (isNZ) {
                methods.push({ id: 'ammonium_acetate', label: 'Ammonium Acetate', desc: 'Hill Labs NZ — Olsen P + NH₄OAc extraction.' });
            }

            var methodHtml = methods.map(function (m) {
                var a = self.d.methodology === m.id;
                return '<div data-method="' + m.id + '" class="wiz-method-btn" style="padding:11px 10px;border:2px solid ' +
                    (a ? 'var(--gaip-accent,#2da85e)' : 'var(--gaip-border,#d1dbd6)') +
                    ';border-radius:8px;cursor:pointer;background:' +
                    (a ? 'var(--gaip-surface-muted,#f3f7f5)' : 'var(--gaip-surface,#fff)') +
                    ';transition:all .15s">' +
                    '<div style="font-size:13px;font-weight:700;color:' + (a ? 'var(--gaip-accent,#2da85e)' : 'var(--gaip-text,#17231f)') + '">' + m.label + '</div>' +
                    '<div style="font-size:11px;color:var(--gaip-text-muted,#6b8878);margin-top:3px;line-height:1.4">' + m.desc + '</div>' +
                    '</div>';
            }).join('');

            var speciesTopt = '<option value="">— Select species —</option>' +
                options.map(function (s) {
                    return '<option value="' + self._esc(s.value) + '"' + (self.d.species === s.value ? ' selected' : '') + '>' +
                        self._esc(s.label) + ' (' + s.type + ')</option>';
                }).join('');

            c.innerHTML = '<h3 style="margin:0 0 4px;font-size:17px;font-weight:700;color:var(--gaip-text,#17231f)">Species &amp; Soil Method</h3>' +
                '<p style="color:var(--gaip-text-secondary,#4a5e55);font-size:13px;margin:0 0 16px">These drive all downstream thresholds and interpretation ranges.</p>' +
                '<div style="margin-bottom:16px">' +
                '<label style="display:block;font-size:11px;font-weight:700;color:var(--gaip-text-muted,#6b8878);margin-bottom:5px;text-transform:uppercase;letter-spacing:.5px">Primary species</label>' +
                '<select id="wiz-species" style="width:100%;padding:9px 12px;border:1px solid var(--gaip-border,#d1dbd6);border-radius:8px;font-size:14px;font-family:inherit;color:var(--gaip-text,#17231f);background:var(--gaip-surface,#fff)">' +
                speciesTopt + '</select>' +
                '</div>' +
                '<div>' +
                '<label style="display:block;font-size:11px;font-weight:700;color:var(--gaip-text-muted,#6b8878);margin-bottom:8px;text-transform:uppercase;letter-spacing:.5px">Soil interpretation method</label>' +
                '<div style="display:grid;grid-template-columns:' + (isNZ ? '1fr 1fr 1fr' : '1fr 1fr') + ';gap:10px">' + methodHtml + '</div>' +
                '</div>' +
                this._methodNote();

            var speciesEl = document.getElementById('wiz-species');
            if (speciesEl) {
                speciesEl.addEventListener('change', function () {
                    self.d.species = this.value || null;
                    var note = c.querySelector('.wiz-method-note');
                    if (note) note.outerHTML = self._methodNote();
                });
            }

            c.querySelectorAll('.wiz-method-btn').forEach(function (btn) {
                btn.addEventListener('click', function () {
                    self.d.methodology = this.dataset.method;
                    self._render();
                });
            });
        },

        _methodNote: function () {
            var isNZ  = this._isNZ();
            var msg   = '';
            if (isNZ && this.d.methodology !== 'ammonium_acetate') {
                msg = 'Most NZ soil labs (Hill Labs) use ammonium acetate extraction. If your report shows Olsen P and NH₄OAc-extractable nutrients, select Ammonium Acetate.';
            } else if (this.d.methodology === 'mlsn' && this.d.turfType !== 'golf') {
                msg = 'MLSN was developed for sand-based golf putting greens. For sports fields or lawns, SLAN is more appropriate.';
            } else if (this.d.methodology === 'mlsn' && this.d.subCategory && this.d.subCategory !== 'greens') {
                msg = 'MLSN was validated primarily for putting greens. For fairways and tees, SLAN may be more appropriate.';
            }
            if (!msg) return '';
            return '<div class="wiz-method-note" style="margin-top:12px;padding:10px 12px;background:var(--gaip-warn-bg,#fef3c7);border:1px solid var(--gaip-warn-border,#fcd34d);border-radius:6px;font-size:12px;color:var(--gaip-warn-text,#92400e);line-height:1.5">' + msg + '</div>';
        },

        _speciesOptions: function () {
            var t   = this.d.turfType;
            var sc  = this.d.subCategory;
            var sbt = (window.GAIP_SpeciesData && window.GAIP_SpeciesData.speciesByType) || {};
            var data;
            if (t === 'golf' && sc)  data = sbt.golf && sbt.golf[sc];
            else if (t === 'sports') data = sbt.sports;
            else if (t === 'lawns')  data = sbt.lawns;
            if (!data) return [];
            var c4ok = !this.d.location || Math.abs(this.d.location.lat) < 45;
            var out  = [];
            if (data.c3) out = out.concat(data.c3);
            if (c4ok && data.c4) out = out.concat(data.c4);
            return out;
        },

        _isNZ: function () {
            if (!this.d.location) return false;
            var lat = this.d.location.lat, lon = this.d.location.lon;
            return (lat < 0 && lon >= 166 && lon <= 179 && lat >= -47 && lat <= -34);
        },

        // ── Step 4: What Now ──────────────────────────────────────────────────
        _step4_WhatNow: function (c) {
            var locName = this.d.location ? this.d.location.name : 'Your site';
            var method  = (this.d.methodology || 'slan').toUpperCase().replace('_', ' ');

            var steps = [
                {
                    icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2 M9 3h6a1 1 0 011 1v1H8V4a1 1 0 011-1z M9 12h6M9 16h4',
                    label: 'Add your soil test',
                    note:  'Import a lab report or enter values. Hub applies ' + method + ' ranges.',
                },
                {
                    icon: 'M12 2a5 5 0 00-5 5c0 3.5 5 11 5 11s5-7.5 5-11a5 5 0 00-5-5z',
                    label: 'Add your water test',
                    note:  'EC, pH, SAR and ion composition feed the irrigation and water analysis.',
                },
                {
                    icon: 'M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z',
                    label: 'Add your tissue test',
                    note:  'Cross-validates soil and water recommendations with real plant uptake data.',
                },
                {
                    icon: 'M5 3l14 9-14 9V3z',
                    label: 'Run your first analysis',
                    note:  'Hit Re-run in the top-right. Results appear across all analysis pages.',
                },
            ];

            c.innerHTML = '<div style="text-align:center;margin-bottom:20px">' +
                '<svg width="36" height="36" fill="none" viewBox="0 0 24 24" stroke="var(--gaip-accent,#2da85e)" stroke-width="1.5" style="display:block;margin:0 auto 10px"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z"/></svg>' +
                '<h2 style="margin:0 0 6px;font-size:19px;font-weight:700;color:var(--gaip-text,#17231f)">' + this._esc(locName) + ' is ready</h2>' +
                '<p style="margin:0;font-size:13px;color:var(--gaip-text-muted,#6b8878)">Here\'s what to do to get the most out of the hub.</p>' +
                '</div>' +

                '<div style="display:flex;flex-direction:column;gap:8px;margin-bottom:16px">' +
                steps.map(function (s, i) {
                    return '<div style="display:flex;align-items:flex-start;gap:12px;padding:11px 13px;background:var(--gaip-surface-muted,#f3f7f5);border:1px solid var(--gaip-border,#d1dbd6);border-radius:8px">' +
                        '<div style="flex-shrink:0;width:22px;height:22px;border-radius:50%;background:var(--gaip-accent,#2da85e);color:#fff;font-size:11px;font-weight:700;display:flex;align-items:center;justify-content:center;margin-top:1px">' + (i + 1) + '</div>' +
                        '<div style="flex:1;min-width:0">' +
                        '<div style="font-weight:700;font-size:13px;color:var(--gaip-text,#17231f);margin-bottom:2px">' + s.label + '</div>' +
                        '<div style="font-size:12px;color:var(--gaip-text-secondary,#4a5e55);line-height:1.5">' + s.note + '</div>' +
                        '</div></div>';
                }).join('') +
                '</div>' +

                '<div style="display:flex;align-items:center;gap:10px;padding:12px 14px;background:#eff8f3;border:1px solid #b6dfc8;border-radius:8px;font-size:13px;color:var(--gaip-text,#17231f)">' +
                '<svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="var(--gaip-accent,#2da85e)" stroke-width="2" style="flex-shrink:0"><path stroke-linecap="round" stroke-linejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>' +
                '<span>A <strong>Getting Started</strong> card will appear on your dashboard with links to each step — it stays there until you dismiss it.</span>' +
                '</div>';
        },

        // ── Finish / Save ─────────────────────────────────────────────────────
        _finish: function () {
            var self = this;

            // Disable nav while saving
            var nextBtn = this.modal.querySelector('button:last-child');
            if (nextBtn) { nextBtn.disabled = true; nextBtn.textContent = 'Saving…'; }

            this._save()
                .then(function () {
                    localStorage.setItem('gilba_wizard_complete', JSON.stringify({
                        completedAt: new Date().toISOString(),
                        version: '1.0',
                    }));
                    localStorage.setItem('gilba_getting_started', '1');
                    self._close();
                    window.location.href = '/dashboard';
                })
                .catch(function (err) {
                    console.warn('[Wizard] Save failed:', err);
                    if (nextBtn) { nextBtn.disabled = false; nextBtn.textContent = 'Go to Dashboard'; }
                    alert('Could not save settings. Please check your connection and try again.');
                });
        },

        _save: function () {
            var self = this;
            return this._ensureSite().then(function (siteId) {
                var tasks = [];

                if (self.d.location) {
                    tasks.push(self._api('PATCH', 'sites/' + siteId, {
                        location_name: self.d.location.name,
                        latitude:      self.d.location.lat,
                        longitude:     self.d.location.lon,
                    }));
                }

                var gaipCfg = {
                    location: self.d.location ? { name: self.d.location.name, lat: self.d.location.lat, lon: self.d.location.lon } : {},
                    turf: {
                        turfType:    self.d.turfType    || '',
                        subCategory: self.d.subCategory || '',
                        species:     self.d.species     || '',
                        variety:     'generic',
                        methodology: self.d.methodology || 'slan',
                    },
                    wizard: { complete: true, completedAt: new Date().toISOString(), version: '1.0' },
                };

                tasks.push(self._api('PUT', 'sites/' + encodeURIComponent(siteId) + '/config/gaip', { config: gaipCfg }));

                return Promise.all(tasks);
            });
        },

        _ensureSite: function () {
            var self = this;
            var id   = cfg.activeSiteId;
            if (id) return Promise.resolve(id);

            var name = (this.d.location && this.d.location.name) || 'My Site';
            return this._api('POST', 'sites', {
                name:          name,
                location_name: this.d.location ? this.d.location.name : '',
                latitude:      this.d.location ? this.d.location.lat  : null,
                longitude:     this.d.location ? this.d.location.lon  : null,
                site_type:     this.d.turfType || 'sports',
                timezone:      'Australia/Sydney',
            }).then(function (payload) {
                var site = payload && payload.data ? payload.data : null;
                if (!site || !site.id) throw new Error('Site creation failed');
                cfg.activeSiteId = site.id;
                return self._api('PATCH', 'active-site', { site_id: site.id })
                    .catch(function () {})
                    .then(function () { return site.id; });
            });
        },

        _api: function (method, path, body) {
            var headers = { 'Accept': 'application/json', 'X-CSRF-TOKEN': CSRF };
            var opts    = { method: method, credentials: 'same-origin', headers: headers };
            if (body) {
                headers['Content-Type'] = 'application/json';
                opts.body = JSON.stringify(body);
            }
            return fetch(API + path, opts).then(function (r) {
                return r.json().catch(function () { return {}; }).then(function (data) {
                    if (!r.ok) throw new Error((data && data.message) || 'HTTP ' + r.status);
                    return data;
                });
            });
        },

        // ── Skip ──────────────────────────────────────────────────────────────
        _skip: function () {
            localStorage.setItem('gilba_wizard_complete', JSON.stringify({
                completedAt: new Date().toISOString(),
                skipped: true,
                version: '1.0',
            }));
            this._close();
        },

        // ── Close ─────────────────────────────────────────────────────────────
        _close: function () {
            var scrollY = window.pageYOffset;
            if (this.overlay && this.overlay.parentNode) {
                this.overlay.parentNode.removeChild(this.overlay);
            }
            this.overlay = null;
            this.modal   = null;
            document.body.style.overflow = '';
            window.scrollTo(0, scrollY);
        },

        // ── Utility ───────────────────────────────────────────────────────────
        _esc: function (s) {
            if (!s) return '';
            var d = document.createElement('div');
            d.textContent = s;
            return d.innerHTML;
        },
    };

    // Expose globally so other pages can trigger wizard (e.g. after new site created in Settings)
    window.GilbaWizard = W;

    // Auto-init after DOM ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function () { W.init(); });
    } else {
        W.init();
    }

})();
