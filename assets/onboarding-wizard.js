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
            location:     null,  // { lat, lon, name }
            turfType:     null,  // 'sports' | 'golf' | 'lawns'
            subCategory:  null,  // 'greens' | 'fairways' | 'tees' | 'surrounds'
            species:      null,
            variety:      null,
            construction: null,
            methodology:  null,
            // GH-789 (queue item 7): the schedule a sports field is asked for. `null` is an empty
            // field and `0` is an answer, so neither is ever turned into the other.
            matchesPerWeek:  null,
            sessionsPerWeek: null,
            // GH-797 (queue item 3ashch): the soil texture, asked on step 3. It is the one draft field
            // whose value does not go into the config -- the list keeps it in a column of `sites`.
            soilTexture:  null,
        },

        /**
         * GH-684 — WHICH INPUT EACH DRAFT FIELD ANSWERS.
         *
         * The inputs list names what a site must have; this wizard has always held its draft under
         * names of its own. Something has to say which is which, and this is that something --
         * BOUND, not copied: no obligation, no step and no order lives here, only the two names for
         * one thing. A test compares it with the steps the server sends in BOTH directions, so an
         * input added to the list with a wizard step reddens instead of quietly passing the gate.
         */
        _answers: {
            'location.lat':      { get: function (d) { return d.location && d.location.lat; } },
            'location.lon':      { get: function (d) { return d.location && d.location.lon; } },
            'turf.turfType':     { get: function (d) { return d.turfType; },     set: function (d, v) { d.turfType = v; } },
            'turf.species':      { get: function (d) { return d.species; },      set: function (d, v) { d.species = v; } },
            'turf.variety':      { get: function (d) { return d.variety; },      set: function (d, v) { d.variety = v; } },
            'turf.construction': { get: function (d) { return d.construction; }, set: function (d, v) { d.construction = v; } },
            'turf.methodology':  { get: function (d) { return d.methodology; },  set: function (d, v) { d.methodology = v; } },
            /**
             * GH-789 (queue item 7): the golf surface, which the list declares required for golf and
             * for no other type (`byTurfType.golf`). It was held by a line of this wizard's own
             * instead, and the lock did not ask for it at all.
             */
            'turf.subCategory':  { get: function (d) { return d.subCategory; },  set: function (d, v) { d.subCategory = v; } },
            /**
             * GH-797 (queue item 3ashch): the soil texture, required by the owner's decision of
             * 01.10.2026 and asked on step 3. The only bound input whose value does not live in the
             * config -- the list keeps it in a column of `sites`, and `_save` sends it as its own request.
             */
            'sites.soil_texture_override': { get: function (d) { return d.soilTexture; }, set: function (d, v) { d.soilTexture = v; } },
            /**
             * GH-789 (queue item 7) — THE MATCH AND TRAINING SCHEDULE, AND IT IS AN OBJECT.
             *
             * `get` answers `null` unless one of the two is a NUMBER, and the gate rests on that:
             * `String({})` is not empty, so an object would pass the gate whatever were inside it.
             * Nought is a number and passes — a week with no load is an answer, and the owner
             * entered exactly that on six sports sites on 30.09.2026.
             *
             * It sends the two fields it was given and no others: the rest of a schedule belongs to
             * Settings, and a default for one of them here would be a choice nobody made.
             */
            'traffic.schedule': {
                get: function (d) {
                    if (typeof d.matchesPerWeek !== 'number' && typeof d.sessionsPerWeek !== 'number') return null;
                    var out = {};
                    if (typeof d.matchesPerWeek === 'number') out.matchesPerWeek = d.matchesPerWeek;
                    if (typeof d.sessionsPerWeek === 'number') out.sessionsPerWeek = d.sessionsPerWeek;

                    return out;
                },
                set: function (d, v) {
                    if (!v || typeof v !== 'object') return;
                    if (typeof v.matchesPerWeek === 'number') d.matchesPerWeek = v.matchesPerWeek;
                    if (typeof v.sessionsPerWeek === 'number') d.sessionsPerWeek = v.sessionsPerWeek;
                },
            },
        },

        /**
         * GH-684 — THE SERVER SAYS WHETHER THIS OPENS, AND WHERE.
         *
         * It used to decide for itself, from four fields named here in JavaScript
         * (`turfSpecies && turfMethodology && lat && lon`), and a site with no cultivar or no
         * construction walked straight past it. Now the page is TOLD what is missing, by the
         * inputs list's own names, by the same function the lock holds on -- so the wizard and the
         * lock can never disagree about whether a site is set up.
         *
         * `?setup=1` no longer means anything: the state decides. The parameter is still cleaned
         * out of the address so a reload does not carry it around.
         *
         * WITHOUT `setup` FROM THE SERVER this does nothing at all and says so. An old page, or a
         * page that did not receive it, cannot tell a complete site from an empty one, and opening
         * a wizard whose gates it cannot compute would trap whoever is looking at it.
         */
        init: function () {
            var setup = cfg.setup;
            if (!setup || !setup.missing) {
                if (window.console) { console.warn('[Wizard] no setup state from the server; not opening'); }

                return;
            }
            this._fillFromAnswers(setup.answers || {});
            if (!setup.missing.length) return;

            this.step = this._firstStepShortOf(setup.missing);
            if (new URLSearchParams(window.location.search).get('setup') !== null) {
                history.replaceState(null, '', window.location.pathname + window.location.hash);
            }
            this.show();
        },

        /** What the site already answers, put into the draft under this wizard's own names. */
        _fillFromAnswers: function (answers) {
            var self = this;
            var lat = answers['location.lat'];
            var lon = answers['location.lon'];
            if (lat !== undefined && lon !== undefined) {
                this.d.location = {
                    lat: Number(lat), lon: Number(lon),
                    name: (cfg.savedLocation || {}).name || '',
                };
            }
            Object.keys(answers).forEach(function (key) {
                var field = self._answers[key];
                if (field && field.set) { field.set(self.d, answers[key]); }
            });
        },

        /**
         * GH-789 (queue item 7) — WHAT A STEP COLLECTS, FOR THE TYPE THE DRAFT HOLDS.
         *
         * The server sends the map for every turf type, because the type is chosen on step 2 and a
         * new site has none when this page loads. Reading one precomputed branch is what left this
         * wizard with a hand-written condition for golf and what would let a brand-new sports field
         * past step 2 with no schedule at all.
         */
        _needsOfStep: function (step) {
            var byType = (cfg.setup && cfg.setup.byStepByTurfType) || {};
            var branch = byType[this.d.turfType || ''] || byType[''] || {};

            return branch[step] || branch[String(step)] || [];
        },

        /** The first step that collects something the site has not answered. */
        _firstStepShortOf: function (missing) {
            var byType = (cfg.setup && cfg.setup.byStepByTurfType) || {};
            var byStep = byType[this.d.turfType || ''] || byType[''] || {};
            var steps = Object.keys(byStep).map(Number).sort(function (a, b) { return a - b; });
            for (var i = 0; i < steps.length; i++) {
                var needs = byStep[steps[i]] || byStep[String(steps[i])] || [];
                for (var j = 0; j < needs.length; j++) {
                    if (missing.indexOf(needs[j]) !== -1) return steps[i];
                }
            }

            return 0;
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

            /**
             * GH-684 — THERE IS NO WAY OUT OF THE WIZARD BUT THROUGH IT.
             *
             * The first step used to offer `Skip Setup`, which closed the wizard and left the site
             * with none of the fields the calculation needs. The owner's decision is that the
             * wizard cannot be left until what is required has been entered, and that reopening
             * the page brings it back while it has not been.
             *
             * MEASURED, not assumed: `_close()` is now reached from exactly one place, the
             * successful save. There is no cross, no Escape handler and no click on the backdrop
             * in this file, so removing this control leaves finishing the wizard as the only exit.
             *
             * An empty element keeps the row's `space-between` layout, so `Next` does not slide
             * across the moment the first step is drawn.
             */
            var back;
            if (this.step === 0) {
                back = document.createElement('span');
            } else {
                back = document.createElement('button');
                back.type = 'button';
                back.textContent = '← Back';
                back.style.cssText = 'background:none;border:none;color:var(--gaip-text-muted,#6b8878);cursor:pointer;font-size:14px;padding:8px 0;font-family:inherit';
                back.addEventListener('click', function () {
                    self.step--;
                    self._render();
                });
            }

            var indicator = document.createElement('span');
            indicator.style.cssText = 'font-size:12px;color:var(--gaip-text-muted,#6b8878)';
            indicator.textContent = 'Step ' + (this.step + 1) + ' of ' + this.total;

            var isLast = this.step === this.total - 1;
            /**
             * GH-789 (queue item 7) — THE BUTTON PRESSES, AND SAYS WHAT IS MISSING.
             *
             * It used to go grey and stay grey, naming nothing: a person with an unanswered field saw
             * a dead button and no reason for it. The owner's decision of 29.09.2026 is one behaviour
             * for a required field everywhere in the product -- red frame, "Required", and a sentence
             * naming the field -- so the press is what refuses, with the same marker Settings uses
             * and the same words out of the list.
             */
            var next = document.createElement('button');
            next.type = 'button';
            next.textContent = isLast ? 'Go to Dashboard' : 'Next →';
            next.style.cssText = [
                'border:none;border-radius:8px;padding:10px 22px',
                'font-size:14px;font-weight:600;font-family:inherit',
                'background:var(--gaip-accent,#2da85e);color:#fff;cursor:pointer',
                'transition:background 0.15s',
            ].join(';');
            next.addEventListener('click', function () {
                if (!self._refuseIfShort()) return;
                if (isLast) { self._finish(); }
                else { self.step++; self._render(); }
            });

            nav.appendChild(back);
            nav.appendChild(indicator);
            nav.appendChild(next);
            return nav;
        },

        /**
         * GH-789 (queue item 7): marks what the step is short of and answers false, or answers true.
         *
         * The words come from the list, delivered with the steps (`cfg.setup.labels`) -- the same
         * words the server puts in its own refusal, so the wizard and Settings say one thing about
         * one field.
         */
        _refuseIfShort: function () {
            var marker = window.GilbaRequiredFields;
            var short = this._missingOfStep(this.step);
            if (marker) { this._sayShort(marker.mark(this.modal, this._asMissing(short))); }

            return short.length === 0;
        },

        /** `[{input, label}]`, the shape the server's 422 carries, built from the list's own labels. */
        _asMissing: function (keys) {
            var labels = (cfg.setup && cfg.setup.labels) || {};

            return keys.map(function (key) { return { input: key, label: labels[key] || key }; });
        },

        /** The sentence under the button, or nothing when there is none to say. */
        _sayShort: function (sentence) {
            var holder = this.modal.querySelector('#wiz-short');
            if (!sentence) {
                if (holder && holder.parentNode) holder.parentNode.removeChild(holder);

                return;
            }
            if (!holder) {
                holder = document.createElement('div');
                holder.id = 'wiz-short';
                holder.style.cssText = 'padding:0 28px 16px;font-size:13px;color:#dc2626';
                this.modal.appendChild(holder);
            }
            holder.textContent = sentence;
        },

        /**
         * A number field of a step the wizard draws itself, carrying the input it answers so the
         * shared marker can find it.
         */
        _numberField: function (id, label, value) {
            return '<div>' +
                '<label for="' + id + '" style="display:block;font-size:12px;font-weight:600;color:var(--gaip-text-secondary,#4a5e55);margin-bottom:4px">' + label + '</label>' +
                '<input type="number" class="wiz-number" id="' + id + '" data-input="traffic.schedule"' +
                ' min="0" max="14" step="1" value="' + (typeof value === 'number' ? value : '') + '"' +
                ' style="width:100%;box-sizing:border-box;padding:9px 10px;border:1px solid var(--gaip-border,#d1dbd6);border-radius:8px;font-size:14px;font-family:inherit;color:var(--gaip-text,#17231f)">' +
                '</div>';
        },

        /**
         * GH-684 — A STEP LETS YOU PASS WHEN THE INPUTS IT COLLECTS ARE ANSWERED, AND THE LIST
         * SAYS WHICH THOSE ARE.
         *
         * This was a `switch` naming fields by hand, and it is exactly how the wizard came to let a
         * site through with no cultivar and no construction: the list called them required, the
         * `case` did not mention them, and nothing connected the two. The steps now come from the
         * server, derived from each input's own `filledIn`.
         *
         * AN INPUT THE DRAFT DOES NOT BIND REFUSES THE STEP rather than passing it. The list is
         * what declares an obligation; a wizard that cannot find the field for one has a hole in
         * it, and a hole must not read as an answer.
         *
         * GH-789 (queue item 7): AND NOW EVERY CONDITION IS DERIVED. One was not -- golf needs its
         * sub-category, held by a line of this file -- and the list did express it all along, in
         * `turf.subCategory`'s own `byTurfType.golf` branch, which nothing read. The reader reads it
         * now, so the line is gone and the lock asks for a golf surface by the same derivation.
         * Whether a SPORTS site must state its purpose is still an open question to the owner, and
         * an input whose obligation is undecided is not required by anybody.
         */
        _canProceed: function () {
            return this._missingOfStep(this.step).length === 0;
        },

        /**
         * GH-789 (queue item 7): the inputs this step collects and the draft has not answered, by the
         * list's own names — so the button can say WHICH field is wanted instead of going grey.
         *
         * An input the draft does not bind refuses the step, as before: the list is what declares an
         * obligation, and a wizard with no field for one has a hole in it. A hole must not read as an
         * answer, so it is named here under its own key.
         */
        _missingOfStep: function (step) {
            var needs = this._needsOfStep(step);
            var out = [];
            for (var i = 0; i < needs.length; i++) {
                var field = this._answers[needs[i]];
                if (!field) { out.push(needs[i]); continue; }
                var value = field.get(this.d);
                if (value === null || value === undefined || String(value).trim() === '') out.push(needs[i]);
            }

            return out;
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
                '<input type="number" id="wiz-lat" data-input="location.lat" step="0.0001" placeholder="-37.8136" value="' + (loc ? loc.lat : '') + '"',
                ' style="width:100%;padding:8px 10px;border:1px solid var(--gaip-border,#d1dbd6);border-radius:6px;font-size:13px;font-family:inherit;box-sizing:border-box;color:var(--gaip-text,#17231f);background:var(--gaip-surface,#fff)"></div>',
                '<div><label style="display:block;font-size:11px;color:var(--gaip-text-muted,#6b8878);margin-bottom:4px">Longitude</label>',
                '<input type="number" id="wiz-lon" data-input="location.lon" step="0.0001" placeholder="144.9631" value="' + (loc ? loc.lon : '') + '"',
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
                    '<div data-input="turf.subCategory" style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px">' +
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

            /**
             * GH-789 (queue item 7) — THE SCHEDULE A SPORTS FIELD IS ASKED FOR.
             *
             * It stands where golf's surface stands, for the same reason and in the same order: both
             * are what the chosen type needs and nothing else does, and the two are mutually
             * exclusive. The words are the ones Settings uses on its Traffic & Wear tab, so a person
             * who comes looking for the same two fields later finds them under the same names.
             *
             * NO `placeholder`. Settings shows "2" and "3" there, and a figure standing in an empty
             * field of a setup wizard reads as a value already entered.
             */
            var scheduleHtml = '';
            if (this.d.turfType === 'sports') {
                scheduleHtml = '<div style="margin-top:16px">' +
                    '<label style="display:block;font-size:11px;font-weight:700;color:var(--gaip-text-muted,#6b8878);margin-bottom:8px;text-transform:uppercase;letter-spacing:.5px">Match and training schedule</label>' +
                    '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">' +
                    this._numberField('wiz-matches', 'Matches per week', this.d.matchesPerWeek) +
                    this._numberField('wiz-sessions', 'Sessions per week', this.d.sessionsPerWeek) +
                    '</div></div>';
            }

            c.innerHTML = '<h3 style="margin:0 0 4px;font-size:17px;font-weight:700;color:var(--gaip-text,#17231f)">What are you managing?</h3>' +
                '<p style="color:var(--gaip-text-secondary,#4a5e55);font-size:13px;margin:0 0 16px">Sets interpretation thresholds, species options, and analysis parameters.</p>' +
                '<div data-input="turf.turfType" style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px">' + typeHtml + '</div>' +
                subHtml + scheduleHtml;

            c.querySelectorAll('.wiz-type-btn').forEach(function (btn) {
                btn.addEventListener('click', function () {
                    self.d.turfType = this.dataset.type;
                    if (self.d.turfType !== 'golf') self.d.subCategory = null;
                    // GH-789: and the schedule goes the same way the golf surface does -- an answer
                    // to a question this type is not asked is not an answer.
                    if (self.d.turfType !== 'sports') {
                        self.d.matchesPerWeek = null;
                        self.d.sessionsPerWeek = null;
                    }
                    self.d.species = null;
                    self._render();
                });
            });
            /**
             * GH-789: an empty field is `null` and a typed nought is `0`. `parseFloat('') || 0`
             * would make both of them nought, which is the whole defect of this queue item in one
             * expression: a value nobody entered reading as a value entered.
             */
            c.querySelectorAll('.wiz-number').forEach(function (input) {
                input.addEventListener('input', function () {
                    var raw = String(this.value).trim();
                    var parsed = raw === '' ? null : parseFloat(raw);
                    var value = (parsed === null || !isFinite(parsed)) ? null : parsed;
                    if (this.id === 'wiz-matches') { self.d.matchesPerWeek = value; }
                    else { self.d.sessionsPerWeek = value; }
                    // The mark answered the press that was refused; typing answers it back.
                    if (window.GilbaRequiredFields && self._canProceed()) {
                        window.GilbaRequiredFields.clear(self.modal);
                        self._sayShort('');
                    }
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

            /**
             * GH-684 — NOTHING IS CHOSEN HERE ON THE PERSON'S BEHALF.
             *
             * Two substitutions used to stand in this step. One suggested a methodology the first
             * time it was drawn -- ammonium acetate in New Zealand, MLSN for golf greens, SLAN
             * otherwise -- and the other, below, filled New Zealand's single option straight back
             * in after clearing it. Either one satisfied the step's gate without a click, so a
             * person could finish the wizard having never chosen a methodology, and the site
             * carried a value nobody picked.
             *
             * The project rule is that methodology comes from what is entered in the settings and
             * from nothing else, and that coordinates decide exactly one thing: WHICH OPTIONS THE
             * LIST OFFERS. Both of those are kept below -- New Zealand is still offered ammonium
             * acetate alone, and a choice the place does not allow is still cleared. What is gone
             * is the wizard answering for the person. New Zealand has one option and it now costs
             * one click, which the coordinator accepted when she decided this.
             */

            // GH-744: the names and sentences come from the server, out of the inputs list.
            var methods = [this._methodWords('mlsn'), this._methodWords('slan')];
            if (isNZ) {
                methods.push(this._methodWords('ammonium_acetate'));
                // GH-407: and take MLSN away, as Settings does (GH-395). This
                // step already knew the location was NZ -- it just added
                // Ammonium Acetate because of it, auto-selected it above, and
                // warns underneath if you pick something else -- but it left
                // MLSN on the list, so it stayed one click away and that
                // warning was all that stood between a new NZ site and a
                // methodology whose thresholds are not defined against the
                // numbers NZ labs report (Olsen P, ammonium-acetate
                // extractions). Warning and offering are not the same thing.
                //
                // This is the wizard the new hub actually shows. Its twin,
                // site-setup-wizard.js, has the same step and the same fix; it
                // is reached only from /hub and the report pages.
                // GH-521: on a New Zealand site the list is ammonium acetate
                // ALONE, not "everything except MLSN". GH-395 took MLSN away
                // and left SLAN; the owner's decision of 17.09 narrows it to
                // one. Narrowing what may be CHOSEN is what replaced the old
                // habit of overwriting a saved value behind the user's back.
                for (var _i = methods.length - 1; _i >= 0; _i--) {
                    if (methods[_i].id !== 'ammonium_acetate') methods.splice(_i, 1);
                }
                // A choice made before the location was set to NZ must not
                // survive as a value with no button to show it. It is CLEARED,
                // not rewritten: the old line turned a saved 'mlsn' straight
                // into ammonium_acetate, which is a value the user never picked
                // being entered on their behalf.
                // GH-521: the cleared value is REMEMBERED, so the note below can
                // name it. The flag it replaces was called _mlsnNormalisedForNZ
                // and the note said "MLSN is not offered" — true while MLSN was
                // the only thing taken away, and wrong the moment the list
                // narrowed to ammonium acetate alone, because a user who had
                // chosen SLAN was then told about MLSN.
                if (this.d.methodology && this.d.methodology !== 'ammonium_acetate') {
                    this._methodClearedForNZ = this.d.methodology;
                    this.d.methodology = null;
                }
                // GH-684: and it is NOT put back for them. The list has one entry, the person
                // clicks it. Pre-selecting it passed the gate with nothing chosen, which is the
                // same substitution as the one removed above wearing a narrower coat.
            } else {
                this._methodClearedForNZ = null;
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

            /**
             * GH-684 — THE CULTIVAR AND THE CONSTRUCTION, ASKED HERE FOR THE FIRST TIME.
             *
             * Both are required inputs and the wizard never asked for them, so every site it made
             * arrived at the dashboard short of two answers. BOTH OPEN EMPTY: the owner's decision
             * is that a person names the cultivar knowingly or chooses Generic themselves, and the
             * same reasoning covers the construction.
             *
             * The cultivars come from `GAIP_CultivarOptions` in `dashboard-ui.js`, the ONE producer
             * this screen and Settings share -- it decides both halves that matter, that Generic is
             * offered and that Generic is not what you get by not choosing. The constructions come
             * from the inputs list's own value dictionary, delivered by the server with the rest of
             * the setup state. Neither list is built in this file.
             */
            var cultivars = typeof window.GAIP_CultivarOptions === 'function'
                ? window.GAIP_CultivarOptions(this.d.species, this.d.variety)
                : [];
            var varietyOpt = cultivars.map(function (v) {
                return '<option value="' + self._esc(v.value) + '"' + (v.selected ? ' selected' : '') + '>'
                    + self._esc(v.label) + '</option>';
            }).join('');
            var constructionOpt = '<option value="">— Select construction —</option>'
                + (((cfg.setup || {}).constructionValues) || []).map(function (v) {
                    return '<option value="' + self._esc(v.id) + '"' + (self.d.construction === v.id ? ' selected' : '') + '>'
                        + self._esc(v.label) + '</option>';
                }).join('');
            /**
             * GH-797 (queue item 3ashch) — THE SOIL TEXTURE, ASKED HERE FOR THE FIRST TIME.
             *
             * The owner made it required on 01.10.2026 and no wizard step collected it, so a site made
             * here arrived at the dashboard short of it and the only way to answer was a Settings page the
             * lock does not open. The six come from the server with the rest of the setup state, out of the
             * inputs list, as the constructions beside it do.
             *
             * IT OPENS EMPTY, like the cultivar and the construction: nothing is chosen on the person's
             * behalf. And it is sent only when it has an answer, so a draft that never reached this field
             * cannot blank a texture the site already carries.
             */
            var textureOpt = '<option value="">— Select soil texture —</option>'
                + (((cfg.setup || {}).soilTextureValues) || []).map(function (v) {
                    return '<option value="' + self._esc(v.id) + '"' + (self.d.soilTexture === v.id ? ' selected' : '') + '>'
                        + self._esc(v.label) + '</option>';
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
                '<select id="wiz-species" data-input="turf.species" style="width:100%;padding:9px 12px;border:1px solid var(--gaip-border,#d1dbd6);border-radius:8px;font-size:14px;font-family:inherit;color:var(--gaip-text,#17231f);background:var(--gaip-surface,#fff)">' +
                speciesTopt + '</select>' +
                '</div>' +
                '<div style="margin-bottom:16px">' +
                '<label style="display:block;font-size:11px;font-weight:700;color:var(--gaip-text-muted,#6b8878);margin-bottom:5px;text-transform:uppercase;letter-spacing:.5px">Cultivar / variety</label>' +
                '<select id="wiz-variety" data-input="turf.variety" style="width:100%;padding:9px 12px;border:1px solid var(--gaip-border,#d1dbd6);border-radius:8px;font-size:14px;font-family:inherit;color:var(--gaip-text,#17231f);background:var(--gaip-surface,#fff)">' +
                varietyOpt + '</select>' +
                '</div>' +
                '<div style="margin-bottom:16px">' +
                '<label style="display:block;font-size:11px;font-weight:700;color:var(--gaip-text-muted,#6b8878);margin-bottom:5px;text-transform:uppercase;letter-spacing:.5px">Construction type</label>' +
                '<select id="wiz-construction" data-input="turf.construction" style="width:100%;padding:9px 12px;border:1px solid var(--gaip-border,#d1dbd6);border-radius:8px;font-size:14px;font-family:inherit;color:var(--gaip-text,#17231f);background:var(--gaip-surface,#fff)">' +
                constructionOpt + '</select>' +
                '</div>' +
                '<div style="margin-bottom:16px">' +
                '<label style="display:block;font-size:11px;font-weight:700;color:var(--gaip-text-muted,#6b8878);margin-bottom:5px;text-transform:uppercase;letter-spacing:.5px">Soil texture</label>' +
                '<select id="wiz-soil-texture" data-input="sites.soil_texture_override" style="width:100%;padding:9px 12px;border:1px solid var(--gaip-border,#d1dbd6);border-radius:8px;font-size:14px;font-family:inherit;color:var(--gaip-text,#17231f);background:var(--gaip-surface,#fff)">' +
                textureOpt + '</select>' +
                '</div>' +
                '<div>' +
                '<label style="display:block;font-size:11px;font-weight:700;color:var(--gaip-text-muted,#6b8878);margin-bottom:8px;text-transform:uppercase;letter-spacing:.5px">Soil interpretation method</label>' +
                '<div data-input="turf.methodology" style="display:grid;grid-template-columns:1fr 1fr;gap:10px">' + methodHtml + '</div>' +
                '</div>' +
                this._methodNote();

            // GH-797: and the texture beside them, written to the draft the same way.
            ['wiz-variety', 'wiz-construction', 'wiz-soil-texture'].forEach(function (id) {
                var el = document.getElementById(id);
                if (!el) return;
                el.addEventListener('change', function () {
                    if (id === 'wiz-variety') { self.d.variety = this.value || null; }
                    else if (id === 'wiz-soil-texture') { self.d.soilTexture = this.value || null; }
                    else { self.d.construction = this.value || null; }
                    self._render();
                });
            });

            var speciesEl = document.getElementById('wiz-species');
            if (speciesEl) {
                speciesEl.addEventListener('change', function () {
                    self.d.species = this.value || null;
                    // GH-684: the cultivars on offer are those of the species. Keeping a cultivar
                    // chosen for another species would store a pairing that does not exist.
                    self.d.variety = null;
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

        /**
         * GH-744: a methodology's name and sentence as the server delivered them with the setup
         * state. A value it did not deliver is shown by its key, which is the value itself and not
         * a word made up for it. A value it delivered carries its own label -- the list declares one
         * for every value -- and nothing stands in for it.
         */
        _methodWords: function (id) {
            var list = ((cfg.setup || {}).methodologyValues) || [];
            for (var i = 0; i < list.length; i++) {
                if (list[i].id === id) return { id: id, label: list[i].label, desc: list[i].description || '' };
            }
            return { id: id, label: id, desc: '' };
        },

        _methodNote: function () {
            var isNZ  = this._isNZ();
            var msg   = '';
            // GH-407: say it plainly when a choice was taken away, rather than
            // letting the button vanish between one visit to this step and the
            // next with no explanation.
            if (this._methodClearedForNZ) {
                msg = this._methodWords(this._methodClearedForNZ).label;
                msg = msg + ' is not offered for New Zealand locations, so that choice has been cleared '
                    + 'and Ammonium Acetate is selected. NZ soil labs report Olsen P and '
                    + 'ammonium-acetate extractions, and other methodologies\u2019 thresholds are not '
                    + 'defined against those numbers.';
            } else if (isNZ && this.d.methodology !== 'ammonium_acetate') {
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
            // GH-684: no stand-in. Reaching this step without a methodology is not possible now
            // that the gate is derived from the list, and if it ever were, the screen says what
            // is true rather than naming a method nobody chose.
            // GH-744: the word is the list's, as everywhere else in this wizard -- it was built
            // out of the key, which printed AMMONIUM ACETATE and made words up for undeclared keys.
            var method  = this.d.methodology
                ? this._methodWords(this.d.methodology).label
                : 'not set';

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
                    // GH-451 (GH-439 stage 4b): gilba_wizard_complete is not
                    // written. Nothing reads it any more -- the wizard record
                    // lives on the site, and the dashboard decides from the
                    // species the database holds. gilba_getting_started is a
                    // different key, read by the getting-started checklist, and
                    // stays.
                    // GH-684: `gilba_getting_started` is no longer written. Nothing in `assets` or
                    // in any view reads it -- the state lives on the site and the server answers
                    // from it -- so this was a copy in the browser with no reader.
                    self._close();
                    window.location.href = '/dashboard';
                })
                .catch(function (err) {
                    console.warn('[Wizard] Save failed:', err);
                    if (nextBtn) { nextBtn.disabled = false; nextBtn.textContent = 'Go to Dashboard'; }
                    /**
                     * GH-789 (queue item 7) — THE REFUSAL IS ABOUT A FIELD OR IT IS ABOUT THE
                     * CONNECTION, AND THOSE ARE NOT THE SAME SENTENCE.
                     *
                     * Every failure used to say "check your connection and try again", including the
                     * server refusing a field -- so a person read a network fault about their own
                     * empty cultivar, and trying again did the same thing. A refusal that names
                     * inputs is marked and named in the words of the list, the same ones Settings
                     * uses; anything else is still the connection.
                     */
                    var marker = window.GilbaRequiredFields;
                    if (err && err.missing && err.missing.length && marker) {
                        self._sayShort(marker.mark(self.modal, err.missing));

                        return;
                    }
                    self._sayShort('Could not save. Please check your connection and try again.');
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

                /**
                 * GH-797 (queue item 3ashch) — THE TEXTURE TRAVELS AS ITS OWN REQUEST.
                 *
                 * It is a column of `sites`, so it does not belong in the config patch below. And it is
                 * NOT attached to the location request above: `location.lat`/`.lon` have no `set` in
                 * `_answers`, so a wizard opened on an existing site never fills the draft's location and
                 * that request is not sent at all -- the texture would have gone with it into nothing.
                 *
                 * Only when there is an answer, by this file's own rule: a field nobody filled is not a
                 * change, and sending an empty one would blank a texture the site already carries.
                 */
                if (self.d.soilTexture) {
                    tasks.push(self._api('PATCH', 'sites/' + encodeURIComponent(siteId), {
                        soil_texture_override: self.d.soilTexture,
                    }));
                }

                // GH-630 — THE WIZARD DOES NOT SEND A KEY IT NEVER ASKED FOR.
                //
                // MEASURED, both halves (GH-629). The sub-category is asked of
                // golf only — step 2 requires it for golf and the type step
                // nulls it for anything else — and this object then sent
                // `subCategory: ''` regardless. Laravel's
                // `ConvertEmptyStringsToNull` turns that into `null` before the
                // controller sees it, and the config PATCH refuses a null
                // inside a section: `sports` with the key answered
                // 422 `{"invalid_keys":["turf.subCategory"]}`, the same body
                // WITHOUT the key answered 200, and `golf`/`greens` answered
                // 200. So no sports or lawns site created by the wizard could
                // be saved at all, and the person read "check your connection"
                // about it.
                //
                // The rule this restores is the project's own: send the change,
                // not the state. A field nobody was asked for is not a change.
                var turfSection = {
                    turfType:    self.d.turfType    || '',
                    species:     self.d.species     || '',
                    // GH-583 (stage 3): the wizard no longer writes a
                    // cultivar it did not ask for. `generic` was written on
                    // every site it created and read as a choice; it is the
                    // absence of one, and the server refuses it now. The
                    // field is left out, so Settings shows it empty and
                    // required until someone chooses — which is the truth
                    // about the site rather than a stand-in for it.
                    // The wizard does not yet ASK for the cultivar; that is
                    // the other half of this stage and is not built.
                    // GH-684: what was chosen, never a default. The server refuses a config whose
                    // result has no methodology, which is the right answer to a draft that somehow
                    // has none -- far better than storing `slan` on a site nobody asked.
                    methodology: self.d.methodology || '',
                };
                /**
                 * GH-684 — AND NOW IT SENDS WHAT IT ASKED FOR.
                 *
                 * The note above says the wizard does not send a cultivar it never asked for. It
                 * asks now, so it sends -- and only when there is an answer, which keeps the rule
                 * the note is about: a field nobody filled is not a change. The step's gate will
                 * not let anyone reach here without both, so the absence below is for a draft that
                 * arrives by some other road.
                 */
                if (self.d.variety) { turfSection.variety = self.d.variety; }
                if (self.d.construction) { turfSection.construction = self.d.construction; }
                // Golf is the only type the wizard asks this of, so it is the
                // only type that states it.
                if (self.d.turfType === 'golf' && self.d.subCategory) {
                    turfSection.subCategory = self.d.subCategory;
                }

                var gaipCfg = {
                    location: self.d.location ? { name: self.d.location.name, lat: self.d.location.lat, lon: self.d.location.lon } : {},
                    turf: turfSection,
                    wizard: { complete: true, completedAt: new Date().toISOString(), version: '1.0' },
                };
                /**
                 * GH-789 (queue item 7) — THE SCHEDULE, AND ONLY WHAT WAS TYPED INTO IT.
                 *
                 * Two keys, both numbers, no stand-in for any other field of a schedule: the rest of
                 * it is Settings' business, and a default written here would be a choice nobody made
                 * on a site nobody had configured yet. The server merges a schedule by key
                 * (`GAIP_MERGED_SUBOBJECTS`), so what is already stored beside these two survives.
                 *
                 * Sports only, because sports is the only type asked.
                 */
                var schedule = self._answers['traffic.schedule'].get(self.d);
                if (self.d.turfType === 'sports' && schedule) {
                    gaipCfg.traffic = { schedule: schedule };
                }

                // GH-440 (GH-439 stage 1): the wizard states the three things
                // it collected. As a whole-object write it also deleted
                // everything it did not collect, which on an existing site
                // meant the traffic schedule, irrigation, alerts and the
                // cached programme went with it.
                tasks.push(self._api('PATCH', 'sites/' + encodeURIComponent(siteId) + '/config/gaip', { patch: gaipCfg }));

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
                // GH-440 (GH-439 stage 1, contract 2.5): no timezone. This
                // used to send Australia/Sydney for every site anywhere in the
                // world; the server derives it from the coordinates above, and
                // Settings > Site is where a person overrides it.
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
                    if (!r.ok) {
                        var err = new Error((data && data.message) || 'HTTP ' + r.status);
                        // GH-789 (queue item 7): a refusal about a field carries the field, so the
                        // person is told which one instead of being told to check the connection.
                        if (data && data.missing) { err.missing = data.missing; }
                        throw err;
                    }
                    return data;
                });
            });
        },

        // ── Skip ──────────────────────────────────────────────────────────────
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
