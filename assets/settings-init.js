/* settings-init.js — Settings page logic */
(function () {
    'use strict';

    // Eye toggle for API key fields
    document.querySelectorAll('.sens-eye-btn').forEach(function (btn) {
        btn.addEventListener('click', function () {
            var input = document.getElementById(btn.dataset.target);
            if (!input) return;
            var show = input.type === 'password';
            input.type = show ? 'text' : 'password';
            btn.querySelector('.pw-eye-show').style.display = show ? 'none' : '';
            btn.querySelector('.pw-eye-hide').style.display = show ? '' : 'none';
        });
    });

    var D = window.STG_DATA || {};
    var siteId   = D.activeSiteId || null;
    var apiBase  = (D.apiBase || '').replace(/\/$/, '');
    var csrf     = D.csrfToken || '';
    /**
     * GH-801 (queue item "Zones", stage C2): the zones as ROWS from the server -- `{id, name, zoneType,
     * zoneTypeLabel}` -- where this was the site's list of NAMES. The dictionary of types and whether a
     * type is required here come the same way, from the server, because the file that declares them has
     * one reader and it is not a page.
     */
    var zones    = (D.zones && Array.isArray(D.zones)) ? D.zones.slice() : [];

    /* ── Custom confirm dialog ───────────────────────────────── */
    var _STG_FONT = '"Barlow", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';

    function stgConfirm(title, message, onConfirm) {
        var overlay = document.createElement('div');
        overlay.className = 'stg-confirm-overlay';
        overlay.innerHTML =
            '<div class="stg-confirm-dialog">' +
                '<div class="stg-confirm-title">' + title + '</div>' +
                '<div class="stg-confirm-msg">' + message + '</div>' +
                '<div class="stg-confirm-actions">' +
                    '<button class="stg-btn-secondary stg-confirm-cancel" type="button">Cancel</button>' +
                    '<button class="stg-btn-danger stg-confirm-ok" type="button">Leave without saving</button>' +
                    '<button class="stg-btn-primary stg-confirm-save" type="button">Save &amp; leave</button>' +
                '</div>' +
            '</div>';
        overlay.style.fontFamily = _STG_FONT;
        overlay.style.fontSize   = '14px';
        document.body.appendChild(overlay);

        function close() { if (overlay.parentNode) overlay.parentNode.removeChild(overlay); }
        overlay.querySelector('.stg-confirm-cancel').addEventListener('click', close);
        overlay.querySelector('.stg-confirm-ok').addEventListener('click', function () {
            close();
            _dirtyForms = {};
            onConfirm();
        });
        overlay.querySelector('.stg-confirm-save').addEventListener('click', function () {
            close();
            var dirty = Object.keys(_dirtyForms);
            _afterSaveCallback = onConfirm;
            _afterSavePending  = dirty.length;
            dirty.forEach(function (formId) {
                var form = document.getElementById(formId);
                if (form) form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
            });
        });
        overlay.addEventListener('click', function (e) {
            if (e.target === overlay) close();
        });
    }

    /* ── Unsaved changes tracking ────────────────────────────── */
    var _dirtyForms        = {};
    var _afterSaveCallback = null;
    var _afterSavePending  = 0;

    function _checkAfterSave(formId) {
        markClean(formId);
        if (!_afterSaveCallback) return;
        _afterSavePending--;
        if (_afterSavePending <= 0) {
            var cb = _afterSaveCallback;
            _afterSaveCallback = null;
            _afterSavePending  = 0;
            cb();
        }
    }

    function markDirty(formId) { _dirtyForms[formId] = true; }
    function markClean(formId) { delete _dirtyForms[formId]; }
    function isAnyDirty()      { return Object.keys(_dirtyForms).length > 0; }

    function watchForm(formId) {
        var form = document.getElementById(formId);
        if (!form) return;
        form.addEventListener('change', function () { markDirty(formId); });
        form.addEventListener('input',  function () { markDirty(formId); });
        // markClean is called by _checkAfterSave in each form's success handler
    }

    watchForm('stg-site-form');
    watchForm('stg-turf-form');
    watchForm('stg-traffic-form');

    // Intercept sidebar / topbar navigation links so we can show our custom dialog
    // instead of the native beforeunload prompt.
    document.addEventListener('click', function (e) {
        if (!isAnyDirty()) return;
        var link = e.target.closest('a[href]');
        if (!link) return;
        var href = link.getAttribute('href');
        // Ignore hash-only links, javascript: and same-page anchors
        if (!href || href.charAt(0) === '#' || href.indexOf('javascript') === 0) return;
        e.preventDefault();
        stgConfirm(
            'Unsaved changes',
            'You have unsaved changes. Leave this page without saving?',
            function () { _dirtyForms = {}; window.location.href = href; }
        );
    });

    /* ── Tab switching ───────────────────────────────────────── */
    function activateTab(tabKey) {
        if (!tabKey) return;
        document.querySelectorAll('.stg-tab[data-tab]').forEach(function (t) {
            t.classList.remove('active');
            t.setAttribute('aria-selected', 'false');
        });
        document.querySelectorAll('.stg-panel').forEach(function (p) {
            p.classList.add('stg-hidden');
        });
        var tab = document.querySelector('.stg-tab[data-tab="' + tabKey + '"]');
        if (tab) { tab.classList.add('active'); tab.setAttribute('aria-selected', 'true'); }
        var panel = document.getElementById('stg-tab-' + tabKey);
        if (panel) { panel.style.display = ''; panel.classList.remove('stg-hidden'); }
    }

    document.querySelectorAll('.stg-tab[data-tab]').forEach(function (tab) {
        tab.addEventListener('click', function () {
            var targetTab = tab.dataset.tab;
            if (isAnyDirty()) {
                stgConfirm(
                    'Unsaved changes',
                    'You have unsaved changes on this tab. Leave without saving?',
                    function () { _dirtyForms = {}; activateTab(targetTab); }
                );
                return;
            }
            activateTab(targetTab);
        });
    });

    // Activate tab from URL hash (e.g. /settings#traffic), then clear hash
    // so page refresh returns to the default tab, not the hash target.
    if (location.hash) {
        var hashKey = location.hash.slice(1);
        var hashTabBtn = document.querySelector('.stg-tab[data-tab="' + hashKey + '"]');
        if (hashTabBtn && hashTabBtn.style.display !== 'none') {
            activateTab(hashKey);
            history.replaceState(null, '', location.pathname + location.search);
        }
    }

    /* ── Helpers ─────────────────────────────────────────────── */
    function setMsg(el, text, type) {
        if (!el) return;
        el.textContent = text;
        el.className = 'stg-save-msg ' + (type || '');
        el.hidden = !text;
    }

    function setSaving(btn, saving) {
        if (!btn) return;
        btn.setAttribute('data-saving', saving ? '1' : '0');
        btn.disabled = saving;
    }

    function apiFetch(method, path, body) {
        return fetch(apiBase + path, {
            method: method,
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                'X-CSRF-TOKEN': csrf,
            },
            body: body ? JSON.stringify(body) : undefined,
        }).then(function (r) {
            // GH-526 (PLAN-samples-sync-FINAL stage 1, item 7): a refusal is a
            // refusal.
            //
            // This returned r.json() for ANY status. A 422, a 403, a 419 or a
            // 500 came back as an ordinary object, and the import handler read
            // `data.synced` off it as undefined -- printing "0 records imported
            // successfully" and redirecting to the dashboard. The user was told
            // their import had worked, with a count of zero, while the server
            // had told us exactly what was wrong. Stage 1 narrows the clearing
            // sync to one site with a 422, so without this the new refusal would
            // arrive as that same false success.
            if (r.ok) return r.json();
            return r.json().catch(function () { return {}; }).then(function (body) {
                var message = (body && body.message)
                    || ('The server refused the request (HTTP ' + r.status + ').');
                var err = new Error(message);
                err.status = r.status;
                err.body = body;
                throw err;
            });
        });
    }

    /**
     * GH-440 (GH-439 stage 1): send the sections this form just changed, and
     * take the site's config back from the answer.
     *
     * Every save here used to PUT a clone of D.gaipConfig -- the whole config
     * as it stood when the page loaded -- so saving the Turf tab could undo a
     * location set in another tab, and an empty field anywhere in that clone
     * became an empty field in the database. Only the named sections travel
     * now, and a null inside one of them (an unset number: irrigation
     * efficiency, any weather override, elevation) is stated as `clear`,
     * because the route refuses null rather than guessing what it meant.
     */
    /**
     * GH-789 (queue item 7): GAIP_IDENTITY_FIELDS stood here -- five fields named in this file that a form
     * would never send empty, so a person who cleared their species read "Saved." while the server kept
     * the old value. It was one of four hand-written answers to "which inputs are required"; the list is
     * the only one now, and it is read on the server. An empty required field travels as a `clear` and the
     * server refuses it, naming the field -- which is what the person needed to be told in the first place.
     */

    /**
     * GH-789: the refusal a form shows when the server names fields.
     *
     * The marking and the sentence come from `GilbaRequiredFields` in `dashboard-ui.js`, which the setup
     * wizard uses as well: one behaviour for a required field wherever it is asked for, which is the
     * owner's decision of 29.09.2026. Anything that is not about a field keeps the server's own words.
     */
    function showRefusal(formId, msgEl, err) {
        var form = document.getElementById(formId);
        var marker = window.GilbaRequiredFields;
        var missing = err && err.body && err.body.missing;
        if (form && marker && missing && missing.length) {
            setMsg(msgEl, marker.mark(form, missing), 'err');

            return;
        }
        if (form && marker) marker.clear(form);
        setMsg(msgEl, (err && err.message) || 'Save failed.', 'err');
    }

    /**
     * GH-637 (queue item 17, stage 3a of `PLAN-config-patch-race-RU.md`) — A
     * FIELD THE PERSON DID NOT TOUCH DOES NOT TRAVEL AT ALL.
     *
     * WHAT WAS WRONG. This form sent its SECTION as the form was showing it, so
     * a field somebody else had changed after the page loaded went back up at
     * its old value and the later save was undone. Measured, both tabs
     * answering 200: `Gh633ConfigPatchRaceMeasureTest` — tab A saved its Turf
     * tab and tab B's `construction` returned to `sand_profile`. And without
     * any race at all, an empty control the person never touched travelled as a
     * `clear` and erased a stored value.
     *
     * WHAT IT SENDS NOW. Only the fields that differ from WHAT THE SERVER GAVE
     * THIS PAGE. `D.gaipConfig` is that: rendered into the page by the server
     * (`STG_DATA` in `settings.blade.php`) and replaced from the server's own
     * answer after every save. Not the form's own state after autofill — the
     * plan names that trap, because a form default would then read as a value
     * the person had chosen.
     *
     * THIS IS NOT A BROWSER COPY BEING WRITTEN BACK. Nothing of the baseline is
     * sent: it decides what NOT to send. What travels is still the change.
     *
     * THREE THINGS FOLLOW, and they are the point:
     *  - a field nobody touched is absent from both `patch` and `clear`, so it
     *    cannot undo anyone's edit;
     *  - an empty control whose stored value was ALSO empty is not a clear —
     *    there is nothing to empty, and asking to empty it is the form asking
     *    for something nobody asked for;
     *  - a field the person really did empty still travels as `clear`, because
     *    that is a change.
     *
     * WHAT IS NOT DONE HERE, deliberately: no condition and no 409. That is
     * stage 3b, it needs a new thing said to the person, and it waits for the
     * owner. Nothing on screen changes with this.
     *
     * THE SAFE FALLBACK, named: if the page has no server config at all, every
     * field reads as changed and the behaviour is today's.
     */
    /**
     * GH-789 (queue item 7): `place` says WHICH TAB is saving -- a key the list itself declares in
     * `places`. The server judges that tab by the inputs that place collects and by nothing else, so
     * saving Site settings is not refused over an empty cultivar on the Turf tab.
     */
    function patchGaipConfig(sections, place) {
        var patch = {};
        var clear = [];
        var saved = (D.gaipConfig && typeof D.gaipConfig === 'object') ? D.gaipConfig : {};

        function isEmpty(value) {
            return value === null || value === undefined
                || (typeof value === 'string' && value.trim() === '');
        }

        // Equality between a form control and a stored value, and it is lenient
        // about SHAPE only: a number stored as 25 comes back out of a text input
        // as "25", and treating that as a change would send every field on every
        // save, which is the behaviour being removed.
        function unchanged(now, was) {
            if (isEmpty(now) && isEmpty(was)) return true;
            if (isEmpty(now) || isEmpty(was)) return false;
            if (typeof now === 'object' || typeof was === 'object') {
                return JSON.stringify(now) === JSON.stringify(was);
            }
            if (typeof now === 'boolean' || typeof was === 'boolean') return !!now === !!was;
            var a = String(now).trim();
            var b = String(was).trim();
            if (a === b) return true;
            if (a !== '' && b !== '' && !isNaN(Number(a)) && !isNaN(Number(b))) {
                return Number(a) === Number(b);
            }
            return false;
        }

        Object.keys(sections).forEach(function (key) {
            var value = sections[key];
            if (isEmpty(value)) {
                if (!isEmpty(saved[key])) clear.push(key);
                return;
            }
            if (value && typeof value === 'object' && !Array.isArray(value)) {
                var section = {};
                var storedSection = (saved[key] && typeof saved[key] === 'object') ? saved[key] : {};
                Object.keys(value).forEach(function (field) {
                    var path = key + '.' + field;
                    var was = storedSection[field];
                    if (!isEmpty(value[field])) {
                        if (unchanged(value[field], was)) return;
                        section[field] = value[field];
                        return;
                    }
                    // GH-789: an empty field is stated, whatever field it is. It used to be held back
                    // for the five names above, and the form then reported "Saved." about a value the
                    // server had kept -- the person was told the opposite of what happened.
                    //
                    // Nothing stored, nothing to empty: the control was empty
                    // when the page arrived and is empty now, and the person
                    // never touched it.
                    if (isEmpty(was)) return;
                    // An unset number or a cleared text box: said as a clear,
                    // because the route refuses null and never sees the empty
                    // string (Laravel converts it on the way in).
                    clear.push(path);
                });
                if (Object.keys(section).length) patch[key] = section;
                return;
            }
            if (unchanged(value, saved[key])) return;
            patch[key] = value;
        });

        var body = {};
        if (Object.keys(patch).length) body.patch = patch;
        if (clear.length) body.clear = clear;
        if (place) body.place = place;

        // Nothing changed: nothing is sent. The route refuses a body with
        // neither half, and a request that says "I changed nothing" is not a
        // change to begin with.
        if (!body.patch && !body.clear) {
            return Promise.resolve(null);
        }

        return apiFetch('PATCH', '/sites/' + encodeURIComponent(siteId) + '/config/gaip', body)
            .then(function (response) {
                var saved = response && response.data && response.data.config;
                if (saved && typeof saved === 'object' && !Array.isArray(saved)) {
                    D.gaipConfig = saved;
                }
                return response;
            });
    }

    /* ── Site form ───────────────────────────────────────────── */
    var siteForm = document.getElementById('stg-site-form');
    var siteSaveBtn = document.getElementById('stg-site-save');
    var siteMsg = document.getElementById('stg-site-msg');

    if (siteForm) {
        siteForm.addEventListener('submit', function (e) {
            e.preventDefault();
            if (!siteId) return;

            var name = siteForm.querySelector('#stg-name').value.trim();
            if (!name) {
                // GH-789: the page's check, because the name is not a calculation input and the list has
                // no words for it -- but it LOOKS like every other required field: red frame, "Required",
                // and one sentence under the button, drawn by the shared marker.
                var nameMarker = window.GilbaRequiredFields;
                setMsg(siteMsg, nameMarker
                    ? nameMarker.mark(siteForm, [{ input: 'site.name', label: 'the site name' }])
                    : 'Site name is required.', 'err');

                return;
            }

            /**
             * GH-789 (queue item 7) — THE COORDINATES ARE JUDGED BY THE SERVER, from the list.
             *
             * GH-404's gate stood here: two paragraphs of the page's own words, refusing the save before
             * it left the browser. It was the fourth hand-written answer to "which inputs are required",
             * and it refused without marking the field. `location.lat` and `location.lon` are required
             * inputs of the list and this tab is their place, so the server refuses the save and names
             * them, the same way it refuses an empty cultivar on the Turf tab.
             *
             * WHAT GH-404 WAS ABOUT IS UNCHANGED: a site cannot be saved with no coordinates. Five
             * engines substitute a hardcoded Sydney latitude when they cannot resolve one, so a site with
             * none gets a full, confident report computed for somewhere it is not. Removing those
             * substitutions is still its own work.
             *
             * The site name keeps its own check below: it is not an input of the calculation, so the list
             * has no words for it, and the words live where the check lives.
             */

            var elevEl = siteForm.querySelector('#stg-elevation');

            var payload = {
                name:                 name,
                location_name:        siteForm.querySelector('#stg-location-name').value.trim() || null,
                site_type:            siteForm.querySelector('#stg-site-type').value,
                timezone:             siteForm.querySelector('#stg-timezone').value,
                latitude:             siteForm.querySelector('#stg-latitude').value !== ''
                                          ? parseFloat(siteForm.querySelector('#stg-latitude').value) : null,
                longitude:            siteForm.querySelector('#stg-longitude').value !== ''
                                          ? parseFloat(siteForm.querySelector('#stg-longitude').value) : null,
            };

            // GH-440 (GH-439 stage 1): only the sections this form owns.
            // What used to go up was a clone of the whole config taken at page
            // load; the three programme keys had to be deleted from it by hand
            // (GH-371) precisely because a clone carries things the form never
            // touched. A patch has nothing to strip.
            var _locUpdate = {
                name:      siteForm.querySelector('#stg-location-name').value.trim() || '',
                elevation: elevEl && elevEl.value !== '' ? parseInt(elevEl.value, 10) : null,
            };
            var _latVal = siteForm.querySelector('#stg-latitude').value;
            var _lonVal = siteForm.querySelector('#stg-longitude').value;
            var _latNum = _latVal !== '' ? parseFloat(_latVal) : null;
            var _lonNum = _lonVal !== '' ? parseFloat(_lonVal) : null;
            if (_latNum !== null && !isNaN(_latNum)) _locUpdate.lat = _latNum;
            if (_lonNum !== null && !isNaN(_lonNum)) _locUpdate.lon = _lonNum;

            var _sections = { location: _locUpdate };

            var irrigMethodEl     = siteForm.querySelector('#stg-irrig-method');
            var irrigEffEl        = siteForm.querySelector('#stg-irrig-efficiency');
            var irrigRainEl       = siteForm.querySelector('#stg-irrig-rain');
            var irrigCostEl       = siteForm.querySelector('#stg-irrig-cost');
            if (irrigMethodEl) {
                _sections.irrigation = {
                    method:            irrigMethodEl.value || '',
                    efficiency:        irrigEffEl   && irrigEffEl.value   !== '' ? parseInt(irrigEffEl.value, 10)   : null,
                    effectiveRainfall: irrigRainEl  && irrigRainEl.value  !== '' ? parseInt(irrigRainEl.value, 10)  : null,
                    costPerKl:         irrigCostEl  && irrigCostEl.value  !== '' ? parseFloat(irrigCostEl.value)    : null,
                };
            }

            var wxTminEl     = siteForm.querySelector('#stg-wx-tmin');
            var wxTmaxEl     = siteForm.querySelector('#stg-wx-tmax');
            var wxHumEl      = siteForm.querySelector('#stg-wx-humidity');
            var wxRainEl     = siteForm.querySelector('#stg-wx-rain');
            var wxSoilEl     = siteForm.querySelector('#stg-wx-soiltemp');
            var wxEt0El      = siteForm.querySelector('#stg-wx-et0');
            if (wxTminEl) {
                _sections.weatherOverride = {
                    tmin:     wxTminEl.value !== '' ? parseFloat(wxTminEl.value) : null,
                    tmax:     wxTmaxEl && wxTmaxEl.value !== '' ? parseFloat(wxTmaxEl.value) : null,
                    humidity: wxHumEl  && wxHumEl.value  !== '' ? parseFloat(wxHumEl.value)  : null,
                    rainfall: wxRainEl && wxRainEl.value !== '' ? parseFloat(wxRainEl.value) : null,
                    soilTemp: wxSoilEl && wxSoilEl.value !== '' ? parseFloat(wxSoilEl.value) : null,
                    et0:      wxEt0El  && wxEt0El.value  !== '' ? parseFloat(wxEt0El.value)  : null,
                };
            }

            setSaving(siteSaveBtn, true);
            setMsg(siteMsg, '', '');

            Promise.all([
                apiFetch('PATCH', '/sites/' + siteId, payload),
                patchGaipConfig(_sections, 'settings.site'),
            ])
                .then(function (results) {
                    var data = results[0];
                    if (data && data.data && data.data.name) {
                        // GH-442 (GH-439 stage 3): no mirror. This wrote the
                        // new coordinates into gilba_hub_site_configs so
                        // location-preloader.js and the hidden /hub iframe
                        // would pick them up; the preloader is gone (stage 2)
                        // and every page reads the config the server sends.
                        _checkAfterSave('stg-site-form');
                        setMsg(siteMsg, 'Saved.', 'ok');
                        // Update topbar to reflect saved values without page reload
                        var siteNameEl = document.getElementById('db-site-name');
                        if (siteNameEl) siteNameEl.textContent = payload.name;
                        var regionEl = document.getElementById('db-pill-region');
                        if (regionEl) regionEl.textContent = payload.location_name || '';
                    } else {
                        var err = (data && data.message) ? data.message : 'Save failed.';
                        setMsg(siteMsg, err, 'err');
                    }
                })
                .catch(function (err) { showRefusal('stg-site-form', siteMsg, err); })
                .finally(function () { setSaving(siteSaveBtn, false); });
        });
    }

    /* ── Location geocoding autocomplete ────────────────────── */
    (function () {
        var locInput   = document.getElementById('stg-location-name');
        var resultsDiv = document.getElementById('stg-location-results');
        if (!locInput || !resultsDiv) return;

        var _geoTimer;

        locInput.addEventListener('input', function () {
            clearTimeout(_geoTimer);
            var q = locInput.value.trim();
            if (q.length < 3) { resultsDiv.style.display = 'none'; return; }

            _geoTimer = setTimeout(function () {
                resultsDiv.innerHTML = '<div style="padding:10px;color:#6b7f76;font-size:13px;">Searching…</div>';
                resultsDiv.style.display = 'block';

                window.GilbaGeo.search(q, function (preds) {
                    if (!preds.length) {
                        resultsDiv.innerHTML = '<div style="padding:10px;color:#6b7f76;font-size:13px;">No locations found</div>';
                        return;
                    }
                    var html = '';
                    preds.forEach(function (p, i) {
                        html += '<div class="stg-loc-result" data-i="' + i + '" data-place="' + escHtml(p.placeId) + '" style="padding:10px 12px;border-bottom:1px solid #eef1ef;cursor:pointer;">' +
                            '<div style="font-weight:500;color:#2c5f2d;font-size:13px;">' + escHtml(p.description) + '</div>' +
                            '</div>';
                    });
                    resultsDiv.innerHTML = html;
                    resultsDiv.querySelectorAll('.stg-loc-result').forEach(function (el) {
                        var placeId = el.dataset.place;
                        var desc    = preds[parseInt(el.dataset.i, 10)].description;
                        el.addEventListener('mouseenter', function () { el.style.background = '#f4f8f5'; });
                        el.addEventListener('mouseleave', function () { el.style.background = ''; });
                        el.addEventListener('click', function () {
                            resultsDiv.style.display = 'none';
                            locInput.value = desc;
                            window.GilbaGeo.getDetails(placeId, function (loc) {
                                if (!loc) return;
                                locInput.value = loc.name;
                                var latEl = document.getElementById('stg-latitude');
                                var lonEl = document.getElementById('stg-longitude');
                                if (latEl) { latEl.value = loc.lat.toFixed(7); updateHemisphere(loc.lat); }
                                if (lonEl) lonEl.value = loc.lon.toFixed(7);
                            });
                        });
                    });
                });
            }, 400);
        });

        document.addEventListener('click', function (e) {
            if (!e.target.closest('#stg-location-name, #stg-location-results')) {
                resultsDiv.style.display = 'none';
            }
        });
    }());

    function updateHemisphere(lat) {
        var hEl = document.getElementById('stg-hemisphere');
        if (!hEl) return;
        var v = parseFloat(lat);
        hEl.value = isNaN(v) ? '' : (v < 0 ? 'Southern' : 'Northern');
    }
    var _latInput = document.getElementById('stg-latitude');
    var _lonInput = document.getElementById('stg-longitude');
    if (_latInput) {
        _latInput.addEventListener('input', function () { updateHemisphere(this.value); });
        _latInput.addEventListener('change', function () {
            repopulateSpeciesOptions(turfSpeciesEl ? turfSpeciesEl.value : '');
            repopulateVariety(turfSpeciesEl && turfSpeciesEl.value, turfVarietyEl && turfVarietyEl.value);
        });
    }
    if (_lonInput) {
        _lonInput.addEventListener('change', function () {
            repopulateSpeciesOptions(turfSpeciesEl ? turfSpeciesEl.value : '');
            repopulateVariety(turfSpeciesEl && turfSpeciesEl.value, turfVarietyEl && turfVarietyEl.value);
        });
    }

    /* ── Turf profile ───────────────────────────────────────── */
    var turfForm    = document.getElementById('stg-turf-form');
    var turfSaveBtn = document.getElementById('stg-turf-save');
    var turfMsg     = document.getElementById('stg-turf-msg');
    var turfTypeEl  = document.getElementById('stg-turf-type');
    var turfSubEl   = document.getElementById('stg-turf-subcategory');

    var turfVarietyEl = document.getElementById('stg-turf-variety');
    var turfSpeciesEl = document.getElementById('stg-turf-species');

    // GH-684: the table moved to `dashboard-ui.js`, which the db-shell layout loads before this
    // file, so Settings and the onboarding wizard offer cultivars from the same one.
    var _speciesTraitsKey = window.GAIP_SpeciesTraitsKey || {};

    function _normalizeRegion(regionId) {
        if (!regionId) return null;
        if (regionId.indexOf('australia') === 0) return 'australia';
        return regionId;
    }

    function _detectRegionFromForm() {
        var lat = parseFloat((document.getElementById('stg-latitude') || {}).value);
        var lon = parseFloat((document.getElementById('stg-longitude') || {}).value);
        if (isNaN(lat) || isNaN(lon)) return null;
        if (window.GAIP_RegionalProfiles && typeof window.GAIP_RegionalProfiles.detectRegion === 'function') {
            return window.GAIP_RegionalProfiles.detectRegion(lat, lon);
        }
        if (lat < 0 && lon >= 113 && lon <= 154) return 'australia_temperate';
        if (lat < 0 && lon >= 166 && lon <= 179) return 'new_zealand';
        if (lat >= 49 && lat <= 61 && lon >= -12 && lon <= 2) return 'uk_ireland';
        if (lat >= 54 && lon >= 4 && lon <= 32) return 'scandinavia';
        return null;
    }

    function _isC4Viable() {
        // turf-profile-controller.js isC4Viable(): |lat| < 45
        var lat = parseFloat((document.getElementById('stg-latitude') || {}).value);
        if (isNaN(lat)) return true;
        return Math.abs(lat) < 45;
    }

    function repopulateSpeciesOptions(savedSpecies) {
        if (!turfSpeciesEl) return;
        var turfType  = turfTypeEl ? turfTypeEl.value : '';
        var subCat    = turfSubEl  ? turfSubEl.value  : '';
        var rawRegion = _detectRegionFromForm();
        var c4Viable  = _isC4Viable();

        // Match turf-profile-controller.js getSpeciesOptions()
        var sbt = (window.GAIP_SpeciesData && window.GAIP_SpeciesData.speciesByType) || {};
        var group = null;
        if (turfType === 'golf' && subCat) group = sbt.golf && sbt.golf[subCat];
        else if (turfType === 'sports')    group = sbt.sports;
        else if (turfType === 'lawns')     group = sbt.lawns;

        // turf-profile-controller.js filterByRegion(): include if no regions[] OR region matches
        function filterByRegion(sp) {
            if (!sp.regions) return true;
            if (!rawRegion) return true;
            return sp.regions.indexOf(rawRegion) !== -1;
        }

        // NZ fairways are cool-season only — never show C4
        var nzFairways = rawRegion === 'new_zealand' && turfType === 'golf' && subCat === 'fairways';

        // C3 first, then C4 (matches old hub order)
        var options = [];
        if (group) {
            options = options.concat((group.c3 || []).filter(filterByRegion));
            if (c4Viable && !nzFairways) options = options.concat((group.c4 || []).filter(filterByRegion));
        }

        turfSpeciesEl.innerHTML = '<option value="">— select —</option>';
        options.forEach(function (sp) {
            var o = document.createElement('option');
            o.value = sp.value;
            o.textContent = sp.label;
            if (sp.value === savedSpecies) o.selected = true;
            turfSpeciesEl.appendChild(o);
        });

        // Saved species not directly in the new list — try to find an equivalent by canonical key
        if (savedSpecies && !options.some(function (sp) { return sp.value === savedSpecies; })) {
            var savedCanonical = _speciesTraitsKey[savedSpecies];
            var equivalent = savedCanonical && options.find(function (sp) {
                return _speciesTraitsKey[sp.value] === savedCanonical;
            });
            if (equivalent) {
                // Select the equivalent species in the new surface list
                var eqEl = turfSpeciesEl.querySelector('option[value="' + equivalent.value.replace(/"/g, '\\"') + '"]');
                if (eqEl) eqEl.selected = true;
            } else {
                // No equivalent — keep the saved value so it is not silently lost
                var o = document.createElement('option');
                o.value = savedSpecies;
                o.textContent = savedSpecies;
                o.selected = true;
                turfSpeciesEl.insertBefore(o, turfSpeciesEl.children[1] || null);
            }
        }
    }

    function repopulateVariety(species, selectedValue) {
        if (!turfVarietyEl) return;
        /**
         * GH-684 — THE LIST COMES FROM THE ONE PRODUCER, in `dashboard-ui.js`, which the db-shell
         * layout loads before this file. Settings and the onboarding wizard offered the same list
         * and each built it, which is two rules to keep in step; there is one now, and it decides
         * both halves that matter — Generic is offered, and Generic is not what you get by not
         * choosing.
         *
         * Without the producer nothing is rebuilt and the element keeps what the template rendered.
         * Said rather than silently falling back to a list of our own here.
         */
        if (typeof window.GAIP_CultivarOptions !== 'function') {
            if (window.console) { console.warn('[Settings] no cultivar producer; the list is left as rendered'); }

            return;
        }

        turfVarietyEl.innerHTML = '';
        window.GAIP_CultivarOptions(species, selectedValue).forEach(function (v) {
            var o = document.createElement('option');
            o.value = v.value;
            o.textContent = v.label;
            if (v.selected) o.selected = true;
            turfVarietyEl.appendChild(o);
        });
    }

    var _overseedGroups = {
        'Warm-season (C4)': ['Couch', 'Kikuyu', 'Zoysia', 'Seashore Paspalum', 'Buffalo'],
        'Cool-season (C3)': ['Perennial Ryegrass', 'Annual Ryegrass', 'Tall Fescue', 'Fine Fescue', 'Kentucky Bluegrass', 'Creeping Bentgrass'],
    };

    var _C4_VALUES = ['Couch', 'Kikuyu', 'Zoysia', 'Seashore Paspalum', 'Buffalo', 'Buffalograss'];
    function getPrimarySpeciesType() {
        if (!turfSpeciesEl || !turfSpeciesEl.value) return null;
        return _C4_VALUES.indexOf(turfSpeciesEl.value) !== -1 ? 'c4' : 'c3';
    }

    var turfOverseedEl = document.getElementById('stg-turf-cool-overseed');

    function repopulateOverseedOptions() {
        if (!turfOverseedEl) return;
        var currentVal = turfOverseedEl.value;
        var primaryType = getPrimarySpeciesType();
        turfOverseedEl.innerHTML = '<option value="">— none —</option>';
        Object.keys(_overseedGroups).forEach(function (groupLabel) {
            var groupType = groupLabel.indexOf('C4') !== -1 ? 'c4' : 'c3';
            if (primaryType && groupType === primaryType) return;
            var og = document.createElement('optgroup');
            og.label = groupLabel;
            _overseedGroups[groupLabel].forEach(function (sp) {
                var o = document.createElement('option');
                o.value = sp;
                o.textContent = sp;
                if (sp === currentVal) o.selected = true;
                og.appendChild(o);
            });
            turfOverseedEl.appendChild(og);
        });
    }

    var _savedSpecies = turfSpeciesEl ? (turfSpeciesEl.dataset.savedSpecies || '') : '';
    /**
     * GH-684 — NO DEFAULT. This used to fall back to `'generic'`, so a site with NO cultivar opened
     * Settings with "Generic / Unknown" already selected, and pressing Save stored a cultivar
     * nobody chose. That is the substitution the owner removed from the wizard on 24.09.2026 --
     * "so that it is not filled in by default, but that they choose it from the list knowingly" --
     * and the same value arrived by this road.
     *
     * The six sites that carry `generic` are unaffected: their value comes from the config, not
     * from this fallback, and Generic / Unknown is offered and shown selected for them as before.
     * What changes is a site with nothing: it now shows the empty prompt, which is the truth.
     *
     * BEYOND THE THREE ITEMS OF THE PLAN for this part, and said out loud rather than folded in: it
     * is one line in the area the part is about, and leaving it would have kept the defect the part
     * exists to remove.
     */
    var _initVariety  = (D.gaipConfig && D.gaipConfig.turf && D.gaipConfig.turf.variety) || null;

    if (turfSpeciesEl) {
        turfSpeciesEl.addEventListener('change', function () {
            repopulateVariety(turfSpeciesEl.value, 'generic');
            repopulateOverseedOptions();
        });
    }

    var _subOptions = {
        golf:   { greens: 'Greens', fairways: 'Fairways', tees: 'Tees', surrounds: 'Surrounds' },
        sports: { soccer: 'Soccer', afl: 'AFL', rugby_union: 'Rugby Union', rugby_league: 'Rugby League' },
        lawns:  {},
    };

    function repopulateSubcategory(turfType, selectedValue) {
        if (!turfSubEl) return;
        var opts = _subOptions[turfType] || {};
        turfSubEl.innerHTML = '<option value="">— select —</option>';
        Object.keys(opts).forEach(function (v) {
            var o = document.createElement('option');
            o.value = v;
            o.textContent = opts[v];
            if (v === selectedValue) o.selected = true;
            turfSubEl.appendChild(o);
        });
    }

    function updateCompanionRowVisibility() {
        var row = document.getElementById('stg-companion-row');
        if (!row) return;
        var type = turfTypeEl ? turfTypeEl.value : '';
        var sub  = turfSubEl  ? turfSubEl.value  : '';
        row.style.display = (type === 'golf' && sub === 'greens') ? '' : 'none';
        repopulateCompanionOptions();
    }

    function repopulateCompanionOptions() {
        var sel = document.getElementById('stg-companion-species');
        if (!sel) return;
        var savedVal = sel.value || sel.getAttribute('data-saved-companion') || '';
        var region = _detectRegionFromForm();

        var opts;
        if (region === 'new_zealand') {
            opts = [
                { value: '',                                   label: '— None (greens only) —' },
                { value: 'Perennial Ryegrass',                 label: 'Perennial Ryegrass' },
                { value: 'Browntop Bent (Fairways)',           label: 'Browntop Bent' },
                { value: 'Chewings Fescue (Fairways)',         label: 'Chewings Fescue' },
                { value: 'Slender Creeping Red Fescue (Fairways)', label: 'Slender Creeping Red Fescue' },
                { value: 'Strong Creeping Red Fescue (Fairways)',  label: 'Strong Creeping Red Fescue' },
            ];
        } else {
            opts = [
                { value: '',        label: '— None (greens only) —' },
                { value: 'couch',   label: 'Couch (Bermudagrass)' },
                { value: 'kikuyu',  label: 'Kikuyu' },
                { value: 'zoysia',  label: 'Zoysia' },
                { value: 'buffalo', label: 'Buffalo (St Augustine)' },
            ];
        }

        sel.innerHTML = '';
        opts.forEach(function (o) {
            var el = document.createElement('option');
            el.value = o.value;
            el.textContent = o.label;
            if (o.value === savedVal) el.selected = true;
            sel.appendChild(el);
        });
    }

    function updateTrafficTabVisibility(turfType) {
        var trafficTabBtn   = document.querySelector('.stg-tab[data-tab="traffic"]');
        var trafficTabPanel = document.getElementById('stg-tab-traffic');
        var isSports = turfType === 'sports';
        if (trafficTabBtn)   trafficTabBtn.style.display = isSports ? '' : 'none';
        if (trafficTabPanel) {
            if (isSports) {
                // Clear PHP-injected inline display:none so the panel can be shown by activateTab
                trafficTabPanel.style.display = '';
            } else {
                trafficTabPanel.classList.add('stg-hidden');
                // If traffic tab is active, switch to turf tab
                if (trafficTabBtn && trafficTabBtn.classList.contains('active')) {
                    activateTab('turf');
                }
            }
        }
    }

    if (turfTypeEl) {
        var _initSub = (D.gaipConfig && D.gaipConfig.turf && D.gaipConfig.turf.subCategory) || '';
        repopulateSubcategory(turfTypeEl.value, _initSub);
        repopulateSpeciesOptions(_savedSpecies);
        repopulateVariety(turfSpeciesEl ? turfSpeciesEl.value : '', _initVariety);
        repopulateOverseedOptions();
        updateTrafficTabVisibility(turfTypeEl.value);
        updateCompanionRowVisibility();
        repopulateCompanionOptions();
        turfTypeEl.addEventListener('change', function () {
            repopulateSubcategory(turfTypeEl.value, '');
            updateTrafficTabVisibility(turfTypeEl.value);
            updateCompanionRowVisibility();
            repopulateSpeciesOptions('');
            repopulateCompanionOptions();
        });
    }
    if (turfSubEl) {
        turfSubEl.addEventListener('change', function () {
            updateCompanionRowVisibility();
            repopulateSpeciesOptions(turfSpeciesEl ? turfSpeciesEl.value : '');
        });
    }

    if (turfForm) {
        turfForm.addEventListener('submit', function (e) {
            e.preventDefault();
            if (!siteId) return;
            setSaving(turfSaveBtn, true);
            setMsg(turfMsg, '', '');

            var soilTexture = document.getElementById('stg-turf-soil-texture').value || null;
            /**
             * GH-733 (queue item 3e) — THREE FIELDS NO LONGER CARRY AN ANSWER NOBODY GAVE.
             *
             * `overseedVariety`, `overseedStatus` and `summerIntent` were written with a stand-in
             * whenever the form field was empty, so the database was told something the person had
             * not said. They are added after this literal, and only when there is a value.
             *
             * NOT closed here, and it is the analyst's decision rather than an oversight: a field
             * the person CLEARS cannot be cleared this way, because a key absent from a patch means
             * "unchanged". Sending an explicit emptiness is a separate shape.
             *
             * The neighbours keep their own stand-ins -- the two percentage fields and the two
             * species keys -- because they are a different family and are not in this item.
             */
            var turf = {
                species:      document.getElementById('stg-turf-species').value,
                variety:      document.getElementById('stg-turf-variety').value.trim(),
                turfType:     document.getElementById('stg-turf-type').value,
                subCategory:  document.getElementById('stg-turf-subcategory').value,
                construction: document.getElementById('stg-turf-construction').value,
                drainage:     document.getElementById('stg-turf-drainage').value,
                hoc:          document.getElementById('stg-turf-hoc').value,
                methodology:  document.getElementById('stg-turf-methodology').value,
                nProgram:     document.getElementById('stg-turf-n').value,
                /**
                 * GH-789 (queue item 7) — AN EMPTY BOX IS NOT NOUGHT PER CENT.
                 *
                 * These two carried `|| '0'`, and the template put `0` in the box as well, so a person who
                 * never touched either field stored "no Poa annua" and "no cool-season cover" as measured
                 * facts. Both are values somebody can mean: the C3 hint on the page says so in as many
                 * words -- "0 = pure C4" -- and a stand with no Poa is an ordinary stand. A default that
                 * equals a real answer cannot be told from one, and `/plan` already carries the workaround
                 * for it (`plan-ui.js`, "c3Cover=0 is both the default (never set) and pure C4. Use
                 * species to disambiguate").
                 *
                 * MEASURED ON THE STAND, 30.09.2026: all 13 configured sites hold `poaPercent: "0"` and 10
                 * of 13 hold `c3Cover: "0"` -- a value nobody chose thirteen times over. Stored as the
                 * STRING "0", which is this expression's own fingerprint.
                 *
                 * Empty now means empty: the field is left out of the patch by the rule below, which has
                 * said so since GH-733 for the three fields beside it.
                 */
                poaPercent:     document.getElementById('stg-turf-poa').value,
                c3Cover:        document.getElementById('stg-turf-c3').value,
                // Save under both keys: overseedSpecies (hub persistence layer) and
                // coolOverseed (engine internal name read by hub-tissue-v3, hub-orchestrator, etc.)
                overseedSpecies:  document.getElementById('stg-turf-cool-overseed').value || '',
                coolOverseed:     document.getElementById('stg-turf-cool-overseed').value || '',
                companionSpecies: (document.getElementById('stg-companion-species') || {}).value || '',
            };

            /**
             * GH-733 — AN EMPTY FIELD GIVES NO KEY, WHICH IS WHAT "NO DEFAULTS" MEANS HERE.
             *
             * Taken from the elements rather than written out twice, so a field added to the group
             * arrives with its own name and cannot be forgotten in one of the two places.
             */
            [['overseedVariety', 'stg-turf-overseed-variety'],
                ['overseedStatus', 'stg-turf-overseed-status'],
                ['summerIntent', 'stg-turf-summer-intent']].forEach(function (pair) {
                var el = document.getElementById(pair[1]);
                var v = el && typeof el.value === 'string' ? el.value.trim() : '';
                if (v !== '') turf[pair[0]] = v;
            });


            var yearsEl     = document.getElementById('stg-turf-years');
            var thatchEl    = document.getElementById('stg-turf-thatch');
            var winterEl    = document.getElementById('stg-turf-wintermin');
            if (yearsEl || thatchEl || winterEl) {
                turf.siteHistory = {
                    yearsEstablished: yearsEl  && yearsEl.value  !== '' ? parseInt(yearsEl.value,  10) : null,
                    thatchDepth:      thatchEl && thatchEl.value !== '' ? parseInt(thatchEl.value, 10) : null,
                    winterMinTemp:    winterEl && winterEl.value !== '' ? parseFloat(winterEl.value)   : null,
                };
            }

            var ledPpfdEl  = document.getElementById('stg-turf-led-ppfd');
            var ledHoursEl = document.getElementById('stg-turf-led-hours');
            if (ledPpfdEl || ledHoursEl) {
                turf.led = {
                    ppfd:  ledPpfdEl  && ledPpfdEl.value  !== '' ? parseInt(ledPpfdEl.value,  10) : null,
                    hours: ledHoursEl && ledHoursEl.value !== '' ? parseFloat(ledHoursEl.value)   : null,
                };
            }

            // GH-440 (GH-439 stage 1): the turf section alone. Merging into
            // a page-load clone and sending the result is what let this form
            // undo edits made elsewhere; the server merges now, field by
            // field, and everything this form does not name is left alone --
            // including the three programme keys that used to be deleted from
            // the clone by hand (GH-371).
            /**
             * GH-797 (queue item 3ashch) — THE COLUMN FIRST, THE CONFIG ONLY IF IT WAS ACCEPTED.
             *
             * These two went out together (`Promise.all`), and from the moment the texture is required the
             * site route can refuse one of them: the refusal would have arrived while the config half had
             * already been written, under the words "Not saved". One of the two tabs' fields would be
             * saved and the other not, and the message would say neither.
             *
             * The reverse order is NOT symmetrical and is why the column goes first: the refusal this work
             * adds belongs to the site route, so putting it first means nothing is written when it fires.
             * The opposite partial case -- the column saved and the config refused, over an empty cultivar
             * -- exists today, is not created here and is not fixed here.
             */
            var saves = apiFetch('PATCH', '/sites/' + encodeURIComponent(siteId), { soil_texture_override: soilTexture })
                .then(function () { return patchGaipConfig({ turf: turf }, 'settings.turf'); });

            saves
                .then(function () {
                    // GH-442 (GH-439 stage 3): no mirror -- the hub engine
                    // reads the site config the server returned from the save
                    // above, not a copy written beside it.
                    _checkAfterSave('stg-turf-form');
                    setMsg(turfMsg, 'Saved.', 'ok');
                    updateTrafficTabVisibility(turf.turfType);
                    // Update topbar pills
                    var speciesEl = document.getElementById('db-pill-species');
                    if (speciesEl) speciesEl.textContent = turf.species || '';
                })
                .catch(function (err) { showRefusal('stg-turf-form', turfMsg, err); })
                .finally(function () { setSaving(turfSaveBtn, false); });
        });
    }

    /* ── Zones ───────────────────────────────────────────────── */
    /**
     * GH-801 (queue item "Zones", stage C2) — THE TAB SENDS WHAT THE PERSON DID, AND THE TYPE IS ASKED
     * FOR HERE.
     *
     * WHAT THIS TAB USED TO DO. It held the site's zone names in the browser and PATCHed the SITE with
     * the whole list on every save (`attributes_json: {zones: [...]}`) — a copy of the product's own
     * state, sent back to be stored, which is the one shape this project does not allow. It now sends
     * the changes: created, renamed, typed, deleted, to a route of their own.
     *
     * THE OBLIGATION IS THE SERVER'S TO JUDGE, and nothing here decides it. The `Required` note is drawn
     * from the declaration the server handed this page (`D.zoneTypeField`), and a save that would leave a
     * zone without a type is refused by the server, which names the zones in its own sentence. A check
     * written here as well would be a second owner of the rule and would disagree with it one day.
     */
    var zoneList      = document.getElementById('stg-zone-list');
    var zoneInput     = document.getElementById('stg-zone-input');
    var zoneTypeInput = document.getElementById('stg-zone-type-input');
    var zoneAddBtn    = document.getElementById('stg-zone-add-btn');
    var zonesSave     = document.getElementById('stg-zones-save');
    var zonesMsg      = document.getElementById('stg-zones-msg');
    var zoneTypes     = (D.zoneTypes && Array.isArray(D.zoneTypes)) ? D.zoneTypes : [];
    /**
     * GH-804 (part 1) — THE OBLIGATION IS NOT GUESSED WHEN IT DOES NOT ARRIVE.
     *
     * This read `|| { label: 'the zone type', required: false }`: a page that had not been told whether
     * a type is required decided it was NOT, drew no mark, and let a person press Save on a zone the
     * server would refuse. "Unknown" is not "optional". If the field is missing the tab says so where
     * the person is looking, and the server's own refusal is still the thing that decides.
     */
    var zoneTypeField = D.zoneTypeField || null;
    var zoneTypeFieldMissing = !zoneTypeField;

    // GH-817: a row also carries the number of the zone's live samples and the server's sentence about
    // them -- the cross decides by the number and prints the sentence as it came.
    function asRow(zone) {
        return {
            id: zone.id || null, name: zone.name || '', zoneType: zone.zoneType || null,
            samples: zone.samples || 0, removeRefusal: zone.removeRefusal || null, refused: false
        };
    }

    // What the server last gave this page, and what the person has done to it since. The first decides
    // what NOT to send (the shape GH-637 put on the Turf tab); the second is what the rows show.
    var zonesAsSaved = zones.map(asRow);
    var zonesNow     = zones.map(asRow);

    function zoneTypeOptions(selected) {
        var html = '<option value="">Select a type</option>';
        zoneTypes.forEach(function (type) {
            html += '<option value="' + escHtml(type.id) + '"'
                + (selected === type.id ? ' selected' : '') + '>' + escHtml(type.label) + '</option>';
        });

        return html;
    }

    /**
     * The name a refusal uses for this row, so the server can mark the row a person has to look at.
     * A zone the save is creating has no id yet and is named by its place among the created ones — the
     * same order this page sends them in, which is the order of the list itself.
     */
    function inputNameFor(idx) {
        var zone = zonesNow[idx];
        if (zone.id) return 'zone.' + zone.id;
        var created = 0;
        for (var i = 0; i < idx; i++) {
            if (!zonesNow[i].id) created++;
        }

        return 'zone.new:' + created;
    }

    function renderZones() {
        if (!zoneList) return;
        zoneList.innerHTML = '';
        if (!zonesNow.length) {
            zoneList.innerHTML = '<div class="stg-zone-empty">No zones defined yet.</div>';

            return;
        }
        zonesNow.forEach(function (zone, idx) {
            var item = document.createElement('div');
            item.className = 'stg-zone-item';
            item.innerHTML =
                '<input type="text" class="stg-zone-input stg-zone-name" data-idx="' + idx + '"'
                    + ' maxlength="191" value="' + escHtml(zone.name) + '" aria-label="Zone name">' +
                '<span class="stg-zone-type-cell">' +
                    '<select class="stg-select stg-zone-type" data-idx="' + idx + '"'
                        + ' data-input="' + escHtml(inputNameFor(idx)) + '" aria-label="Zone type">'
                        + zoneTypeOptions(zone.zoneType) +
                    '</select>' +
                    ((zoneTypeField && zoneTypeField.required && !zone.zoneType)
                        ? '<span class="gilba-required-note">Required</span>' : '') +
                '</span>' +
                '<button type="button" class="stg-zone-del" data-idx="' + idx + '" title="Remove zone">×</button>' +
                (zone.refused && zone.removeRefusal
                    ? '<span class="gilba-required-note stg-zone-refusal">' + escHtml(zone.removeRefusal) + '</span>' : '');
            zoneList.appendChild(item);
        });
    }

    function escHtml(str) {
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    if (zoneList) {
        renderZones();
        if (zoneTypeFieldMissing) {
            // Said where the person is looking, not only in a console: the page does not know whether a
            // type is required, so it claims neither.
            setMsg(zonesMsg, 'The server did not say whether a zone type is required. Reload the page.', 'err');
        }

        zoneList.addEventListener('click', function (e) {
            var btn = e.target.closest('.stg-zone-del');
            if (!btn) return;
            var idx = parseInt(btn.dataset.idx, 10);
            /**
             * GH-804 (the owner's decision, variant (a)): a zone with samples is not removed -- the cross refuses
             * and says how many samples are linked. GH-817 puts the refusal on the cross itself, as she worded it;
             * the save's refusal stays behind it as the second layer (the page may be older than a sample).
             * The decision is the server's number, the words are the server's sentence; the row stays, and
             * nothing goes into `deleted`.
             */
            if (zonesNow[idx] && zonesNow[idx].samples > 0) {
                zonesNow[idx].refused = true;
                renderZones();
                return;
            }
            zonesNow.splice(idx, 1);
            renderZones();
            markDirty('stg-zones-form');
        });

        // The name is edited in place, so renaming a zone is a rename and not a zone thrown away and
        // another made: that is the whole reason a zone has an identity (plan section 2).
        zoneList.addEventListener('input', function (e) {
            var field = e.target.closest('.stg-zone-name');
            if (!field) return;
            zonesNow[parseInt(field.dataset.idx, 10)].name = field.value;
            markDirty('stg-zones-form');
        });

        zoneList.addEventListener('change', function (e) {
            var select = e.target.closest('.stg-zone-type');
            if (!select) return;
            var idx = parseInt(select.dataset.idx, 10);
            zonesNow[idx].zoneType = select.value || null;
            markDirty('stg-zones-form');
            // Only this row's note moves; re-drawing the list would take the person's cursor with it.
            var cell = select.parentNode;
            var note = cell ? cell.querySelector('.gilba-required-note') : null;
            if (zonesNow[idx].zoneType && note) {
                cell.removeChild(note);
            } else if (!zonesNow[idx].zoneType && !note && zoneTypeField && zoneTypeField.required && cell) {
                var fresh = document.createElement('span');
                fresh.className = 'gilba-required-note';
                fresh.textContent = 'Required';
                cell.appendChild(fresh);
            }
        });
    }

    // Allow stgConfirm "Save & leave" to trigger zones save via submit event
    var zonesForm = document.getElementById('stg-zones-form');
    if (zonesForm) {
        zonesForm.addEventListener('submit', function (e) {
            e.preventDefault();
            if (zonesSave) zonesSave.click();
        });
    }

    if (zoneAddBtn && zoneInput) {
        function addZone() {
            var name = zoneInput.value.trim();
            if (!name) return;
            var taken = zonesNow.some(function (zone) {
                return zone.name.toLowerCase() === name.toLowerCase();
            });
            if (!taken) {
                zonesNow.push({ id: null, name: name, zoneType: (zoneTypeInput && zoneTypeInput.value) || null });
                renderZones();
                markDirty('stg-zones-form');
            }
            zoneInput.value = '';
            if (zoneTypeInput) zoneTypeInput.value = '';
            zoneInput.focus();
        }

        zoneAddBtn.addEventListener('click', addZone);
        zoneInput.addEventListener('keydown', function (e) {
            if (e.key === 'Enter') { e.preventDefault(); addZone(); }
        });
    }

    /** What the person did, against what the server gave this page. Nothing of the baseline travels. */
    function zoneChanges() {
        var created = [];
        var renamed = [];
        var typed = [];
        var deleted = [];
        var saved = {};
        var present = {};
        zonesAsSaved.forEach(function (zone) { saved[zone.id] = zone; });

        zonesNow.forEach(function (zone) {
            if (!zone.id) {
                created.push({ name: zone.name, zoneType: zone.zoneType || '' });

                return;
            }
            present[zone.id] = true;
            var was = saved[zone.id];
            if (!was) return;
            if (was.name !== zone.name) renamed.push({ id: zone.id, name: zone.name });
            if ((was.zoneType || null) !== (zone.zoneType || null)) {
                typed.push({ id: zone.id, zoneType: zone.zoneType || '' });
            }
        });
        zonesAsSaved.forEach(function (zone) {
            if (!present[zone.id]) deleted.push(zone.id);
        });

        return { created: created, renamed: renamed, typed: typed, deleted: deleted };
    }

    if (zonesSave) {
        zonesSave.addEventListener('click', function () {
            if (!siteId) return;

            setSaving(zonesSave, true);
            setMsg(zonesMsg, '', '');
            var marker = window.GilbaRequiredFields;
            if (marker && zonesForm) marker.clear(zonesForm);

            apiFetch('PATCH', '/sites/' + siteId + '/zones', zoneChanges())
                .then(function (data) {
                    var fresh = data && data.data && data.data.zones;
                    if (Array.isArray(fresh)) {
                        zones = fresh.slice();
                        zonesAsSaved = fresh.map(asRow);
                        zonesNow = fresh.map(asRow);
                        renderZones();
                        setMsg(zonesMsg, 'Zones saved.', 'ok');
                        _checkAfterSave('stg-zones-form');

                        return;
                    }
                    setMsg(zonesMsg, (data && data.message) ? data.message : 'Save failed.', 'err');
                })
                .catch(function (err) {
                    /**
                     * THE SENTENCE IS THE SERVER'S, and that is the difference from every other tab here.
                     * Elsewhere the page composes it from the fields named; this refusal names the ZONES —
                     * which may be zones the person never touched, created from the Data page or moved in
                     * by the transfer — and only the server knows them. The marker is still what outlines
                     * the rows, so a refusal looks the same wherever it comes from.
                     */
                    var missing = err && err.body && err.body.missing;
                    if (marker && zonesForm && missing && missing.length) marker.mark(zonesForm, missing);
                    setMsg(zonesMsg, (err && err.message) || 'Network error.', 'err');
                })
                .finally(function () { setSaving(zonesSave, false); });
        });
    }

    /* ── Sensor integrations (Hydrosight + SpecConnect) ─────────── */
    // localStorage helpers
    function lsGet(key) { try { return localStorage.getItem(key); } catch (e) { return null; } }
    function lsSet(key, val) { try { localStorage.setItem(key, val); return true; } catch (e) { return false; } }
    function lsDel(key) { try { localStorage.removeItem(key); } catch (e) {} }
    function lsJson(key) { var raw = lsGet(key); if (!raw) return null; try { return JSON.parse(raw); } catch (e) { return null; } }

    function hsKey() { return 'gaip_hydrosight_config_' + (siteId || 'default'); }
    function scKey() { return 'gilba_specconnect_config'; }

    function setSensMsg(el, text, cls) {
        if (!el) return;
        el.textContent = text;
        el.className   = 'sens-field-msg' + (cls ? ' ' + cls : '');
    }

    async function proxyCall(provider, endpoint, apiKey) {
        var url = '/api/sensors/' + provider + '/proxy';
        var r;
        try {
            r = await fetch(url, {
                method: 'POST',
                credentials: 'same-origin',
                headers: { 'Content-Type': 'application/json', 'Accept': 'application/json', 'X-CSRF-TOKEN': csrf },
                body: JSON.stringify({ endpoint: endpoint, api_key: apiKey }),
            });
        } catch (networkErr) {
            throw new Error('Network error — check your connection.');
        }
        if (r.status === 419) throw new Error('Session expired — please refresh the page.');
        if (r.status === 401) throw new Error('Not authenticated — please log in again.');
        if (r.status === 403) throw new Error('Request blocked (403) — please refresh the page and try again.');
        var text = await r.text();
        var json;
        try { json = JSON.parse(text); } catch (_) {
            throw new Error('Unexpected response (HTTP ' + r.status + ') — please refresh the page.');
        }
        if (!json.success) {
            var msg = (json.data && json.data.message) ? json.data.message : ('HTTP ' + r.status);
            throw new Error(msg);
        }
        return json.data;
    }

    function esc(s) {
        return String(s == null ? '' : s)
            .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
    }

    // ── Hydrosight ────────────────────────────────────────────────────────
    var _hsCfg = null;

    function hsLoad() { _hsCfg = lsJson(hsKey()) || {}; return _hsCfg; }

    function hsSave(cfg) {
        _hsCfg = Object.assign(_hsCfg || {}, cfg);
        lsSet(hsKey(), JSON.stringify(_hsCfg));
    }

    function hsRender() {
        var cfg   = hsLoad();
        var badge = document.getElementById('sens-hs-badge');
        var keyIn = document.getElementById('sens-hs-key');
        var disc  = document.getElementById('sens-hs-disconnect');
        var list  = document.getElementById('sens-hs-list');
        if (!badge) return;
        if (cfg.keyConfigured || cfg.apiKey) {
            badge.textContent = 'Connected'; badge.className = 'sens-status-badge connected';
            if (keyIn) keyIn.placeholder = '••••••••••••••••';
            if (disc) disc.style.display = '';
            hsRenderSensors(cfg, list);
        } else {
            badge.textContent = 'Not configured'; badge.className = 'sens-status-badge';
            if (disc) disc.style.display = 'none';
            if (list) list.style.display = 'none';
        }
    }

    function hsRenderSensors(cfg, list) {
        if (!list) return;
        var readingsCache = lsJson('gaip_hydrosight_readings_cache_' + (siteId || 'default')) || {};
        var readings = readingsCache.data || [];
        var cache = lsJson('gilba_sensor_last_fetch');
        var locations = (cache && cache.provider === 'Hydrosight' && cache.locations) || [];
        var excluded = cfg.excludedSensors || {};

        var html = '<div class="sens-sensor-list-head">Connected Sensors</div>'
            + '<div class="sens-sensor-list-hint">Excluded sensors are removed from zone averages and engine calculations — use this for replaced units.</div>';
        if (!readings.length && !locations.length) {
            html += '<div style="padding:10px 0;font-size:12px;color:var(--gaip-text-muted,#6b8878)">No readings yet — click Test &amp; Save to connect and load live data.</div>';
        } else {
            var zones = ['Greens','Fairways','Tees','Roughs','Other'];
            var items = readings.length ? readings : locations;
            items.slice(0, 12).forEach(function (item) {
                var sid  = item.sensorId || item.id;
                var name = item.name || sid || '—';
                var vwc  = item.vwc  != null ? item.vwc.toFixed(1)  : null;
                var ec   = item.ec   != null ? item.ec.toFixed(2)   : null;
                var tmp  = item.soilTemp != null ? item.soilTemp.toFixed(1) : null;
                var mapping  = (cfg.sensorZoneMapping || {})[sid] || '';
                var isExcl   = !!excluded[sid];
                var rowCls   = 'sens-sensor-row' + (isExcl ? ' sens-sensor-row--excluded' : '');
                var dotCls   = 'sens-sensor-dot' + (!isExcl && vwc ? ' live' : '');
                html += '<div class="' + rowCls + '">'
                    + '<span class="' + dotCls + '"></span>'
                    + '<span class="sens-sensor-name">' + esc(name) + '</span>'
                    + '<span class="sens-sensor-readings">'
                    + (vwc ? '<span class="sens-sensor-val"><span>' + vwc + '%</span> VWC</span>' : '')
                    + (ec  ? '<span class="sens-sensor-val"><span>' + ec  + '</span> EC</span>' : '')
                    + (tmp ? '<span class="sens-sensor-val"><span>' + tmp + '°C</span></span>' : '')
                    + '</span>'
                    + (isExcl
                        ? '<span class="sens-excl-label">Excluded</span>'
                        : '<select class="sens-zone-select" data-sensor-id="' + esc(sid) + '">'
                          + '<option value="">Zone…</option>'
                          + zones.map(function (z) { return '<option value="' + z + '"' + (mapping === z ? ' selected' : '') + '>' + z + '</option>'; }).join('')
                          + '</select>'
                      )
                    + '<button class="sens-excl-btn" data-sensor-id="' + esc(sid) + '" title="' + (isExcl ? 'Include in calculations' : 'Exclude from calculations') + '">'
                    + (isExcl ? 'Include' : 'Exclude')
                    + '</button>'
                    + '</div>';
            });
        }
        list.innerHTML = html;
        list.style.display = '';

        list.querySelectorAll('.sens-zone-select').forEach(function (sel) {
            sel.addEventListener('change', function () {
                var cfg2 = hsLoad();
                cfg2.sensorZoneMapping = cfg2.sensorZoneMapping || {};
                if (sel.value) cfg2.sensorZoneMapping[sel.dataset.sensorId] = sel.value;
                else delete cfg2.sensorZoneMapping[sel.dataset.sensorId];
                hsSave(cfg2);
            });
        });

        list.querySelectorAll('.sens-excl-btn').forEach(function (btn) {
            btn.addEventListener('click', function () {
                var cfg2 = hsLoad();
                cfg2.excludedSensors = cfg2.excludedSensors || {};
                var sid = btn.dataset.sensorId;
                if (cfg2.excludedSensors[sid]) {
                    delete cfg2.excludedSensors[sid];
                } else {
                    cfg2.excludedSensors[sid] = true;
                }
                hsSave(cfg2);
                hsRenderSensors(cfg2, list);
            });
        });
    }

    async function hsTestAndSave() {
        var keyIn  = document.getElementById('sens-hs-key');
        var msg    = document.getElementById('sens-hs-msg');
        var badge  = document.getElementById('sens-hs-badge');
        var btn    = document.getElementById('sens-hs-test');
        var apiKey = (keyIn && keyIn.value.trim()) || (_hsCfg && _hsCfg.apiKey) || '';

        if (!apiKey) { setSensMsg(msg, 'Enter an API key first.', 'err'); return; }

        btn.disabled = true; btn.textContent = 'Testing…';
        badge.textContent = 'Testing…'; badge.className = 'sens-status-badge testing';
        setSensMsg(msg, 'Connecting to Hydrosight…', 'info');

        try {
            var locData  = await proxyCall('hydrosight', '/locations', apiKey);
            var locCount = (locData && locData.items) ? locData.items.length : 0;
            var senData  = await proxyCall('hydrosight', '/sensors', apiKey);
            var sensors  = (senData && senData.items) || [];

            hsSave({ apiKey: apiKey, keyConfigured: true, enabled: true });
            setSensMsg(msg, 'Connected — fetching live readings…', 'info');

            var readings = [];
            var zoneMapping = (hsLoad().sensorZoneMapping) || {};
            for (var _i = 0; _i < sensors.length; _i++) {
                var _s = sensors[_i];
                try {
                    var detail = await proxyCall('hydrosight', '/sensors/' + encodeURIComponent(_s.sensorId), apiKey);
                    var lr = detail.lastReadings || {};
                    var _vwc = parseFloat(lr.moisture);
                    var _ec  = parseFloat(lr.ec);
                    var _tmp = parseFloat(lr.temperature);
                    readings.push({
                        sensorId: detail.sensorId || _s.sensorId,
                        name:     detail.name || _s.name || _s.sensorId,
                        vwc:      isNaN(_vwc) ? null : _vwc,
                        ec:       isNaN(_ec)  ? null : _ec,
                        soilTemp: isNaN(_tmp) ? null : _tmp,
                        zone:     zoneMapping[_s.sensorId] || null,
                    });
                } catch (_) {
                    readings.push({ sensorId: _s.sensorId, name: _s.name || _s.sensorId, vwc: null, ec: null, soilTemp: null });
                }
            }
            lsSet('gaip_hydrosight_readings_cache_' + (siteId || 'default'), JSON.stringify({ timestamp: Date.now(), data: readings }));
            lsSet('gilba_sensor_last_fetch', JSON.stringify({
                fetchedAt: new Date().toISOString(), provider: 'Hydrosight', locations: readings
            }));

            setSensMsg(msg, 'Connected — ' + locCount + ' location' + (locCount === 1 ? '' : 's') + ', ' + sensors.length + ' sensor' + (sensors.length === 1 ? '' : 's') + ' found.', 'ok');
            hsRender();
        } catch (e) {
            setSensMsg(msg, 'Failed: ' + e.message, 'err');
            badge.textContent = 'Error'; badge.className = 'sens-status-badge error';
        } finally {
            btn.disabled = false; btn.textContent = 'Test & Save';
        }
    }

    function hsDisconnect() {
        lsDel(hsKey());
        _hsCfg = null;
        var msg   = document.getElementById('sens-hs-msg');
        var keyIn = document.getElementById('sens-hs-key');
        setSensMsg(msg, 'Disconnected.', 'info');
        if (keyIn) keyIn.value = '';
        hsRender();
    }

    // ── SpecConnect ───────────────────────────────────────────────────────
    var _scCfg = null;

    function scLoad() { _scCfg = lsJson(scKey()) || {}; return _scCfg; }

    function scSave(cfg) {
        _scCfg = Object.assign(_scCfg || {}, cfg);
        lsSet(scKey(), JSON.stringify(_scCfg));
    }

    function scRender() {
        var cfg   = scLoad();
        var badge = document.getElementById('sens-sc-badge');
        var keyIn = document.getElementById('sens-sc-key');
        var disc  = document.getElementById('sens-sc-disconnect');
        var list  = document.getElementById('sens-sc-list');
        if (!badge) return;
        if (cfg.apiKey) {
            badge.textContent = 'Connected'; badge.className = 'sens-status-badge connected';
            if (keyIn) keyIn.placeholder = '••••••••••••••••';
            if (disc) disc.style.display = '';
            scRenderEquipment(list);
        } else {
            badge.textContent = 'Not configured'; badge.className = 'sens-status-badge';
            if (disc) disc.style.display = 'none';
            if (list) list.style.display = 'none';
        }
    }

    function scRenderEquipment(list) {
        if (!list) return;
        var cache = lsJson('gilba_specconnect_cache_' + (siteId || 'default'));
        var items = (cache && cache.data) ? cache.data : [];

        var html = '<div class="sens-sensor-list-head">Connected Equipment</div>';
        if (!items.length) {
            html += '<div style="padding:10px 0;font-size:12px;color:var(--gaip-text-muted,#6b8878)">No devices found in this account. Live readings are fetched on the Sensor Data page.</div>';
        } else {
            items.slice(0, 12).forEach(function (item) {
                var name = item.surfaceName || item.collectionName || item.SerialNumber || '—';
                var vwc  = item.vwc  != null ? item.vwc.toFixed(1)  : null;
                var tmp  = item.soilTemp != null ? item.soilTemp.toFixed(1) : null;
                html += '<div class="sens-sensor-row">'
                    + '<span class="sens-sensor-dot' + (vwc ? ' live' : '') + '"></span>'
                    + '<span class="sens-sensor-name">' + esc(name) + '</span>'
                    + '<span class="sens-sensor-readings">'
                    + (vwc ? '<span class="sens-sensor-val"><span>' + vwc + '%</span> VWC</span>' : '')
                    + (tmp ? '<span class="sens-sensor-val"><span>' + tmp + '°C</span></span>' : '')
                    + '</span>'
                    + '</div>';
            });
        }
        list.innerHTML = html;
        list.style.display = '';
    }

    async function scTestAndSave() {
        var keyIn  = document.getElementById('sens-sc-key');
        var msg    = document.getElementById('sens-sc-msg');
        var badge  = document.getElementById('sens-sc-badge');
        var btn    = document.getElementById('sens-sc-test');
        var apiKey = (keyIn && keyIn.value.trim()) || (_scCfg && _scCfg.apiKey) || '';

        if (!apiKey) { setSensMsg(msg, 'Enter an API key first.', 'err'); return; }

        btn.disabled = true; btn.textContent = 'Testing…';
        badge.textContent = 'Testing…'; badge.className = 'sens-status-badge testing';
        setSensMsg(msg, 'Connecting to SpecConnect…', 'info');

        try {
            var ep   = '/api/Customer/GetCustomerEquipment?customerApiKey={key}&optUnits=1';
            var data = await proxyCall('specconnect', ep, apiKey);
            var count = Array.isArray(data) ? data.length : 0;
            scSave({ apiKey: apiKey, enabled: true });
            if (Array.isArray(data) && data.length) {
                var scItems = data.map(function (d) {
                    return { SerialNumber: d.SerialNumber || '', collectionName: d.CollectionName || '', surfaceName: d.SurfaceName || '', vwc: null, soilTemp: null };
                });
                lsSet('gilba_specconnect_cache_' + (siteId || 'default'), JSON.stringify({ timestamp: Date.now(), data: scItems }));
            }
            setSensMsg(msg, 'Connected — ' + count + ' device' + (count === 1 ? '' : 's') + ' found.', 'ok');
            scRender();
        } catch (e) {
            setSensMsg(msg, 'Failed: ' + e.message, 'err');
            badge.textContent = 'Error'; badge.className = 'sens-status-badge error';
        } finally {
            btn.disabled = false; btn.textContent = 'Test & Save';
        }
    }

    function scDisconnect() {
        lsDel(scKey());
        _scCfg = null;
        var msg   = document.getElementById('sens-sc-msg');
        var keyIn = document.getElementById('sens-sc-key');
        setSensMsg(msg, 'Disconnected.', 'info');
        if (keyIn) keyIn.value = '';
        scRender();
    }

    // Init sensor integration UI
    (function initSensors() {
        if (!document.getElementById('sens-hs-badge')) return; // not on integrations panel
        hsRender();
        scRender();

        var hsTestBtn = document.getElementById('sens-hs-test');
        if (hsTestBtn) hsTestBtn.addEventListener('click', hsTestAndSave);
        var hsDiscBtn = document.getElementById('sens-hs-disconnect');
        if (hsDiscBtn) hsDiscBtn.addEventListener('click', hsDisconnect);
        var scTestBtn = document.getElementById('sens-sc-test');
        if (scTestBtn) scTestBtn.addEventListener('click', scTestAndSave);
        var scDiscBtn = document.getElementById('sens-sc-disconnect');
        if (scDiscBtn) scDiscBtn.addEventListener('click', scDisconnect);

        ['sens-hs-key', 'sens-sc-key'].forEach(function (id) {
            var el = document.getElementById(id);
            if (el) el.addEventListener('keydown', function (e) {
                if (e.key === 'Enter') {
                    var btn = document.getElementById(id === 'sens-hs-key' ? 'sens-hs-test' : 'sens-sc-test');
                    if (btn) btn.click();
                }
            });
        });
    }());

    /* ── Info popovers ───────────────────────────────────────── */
    var STG_GLOSSARY = {
        'elevation': {
            title: 'Elevation',
            body:  'Height above sea level in metres. Affects ET₀ calculation and weather-adjusted growth potential. Leave blank or set to 0 if unknown.',
        },
        'irrig-method': {
            title: 'Irrigation method',
            body:  'Affects how water delivery losses are calculated. Overhead sprinklers lose more to wind and evaporation than drip systems.',
        },
        'irrig-efficiency': {
            title: 'System efficiency',
            body:  'Percentage of water actually delivered to the rootzone. Typical ranges: Sprinklers 70–80 %, drip/sub-surface 85–95 %.',
        },
        'irrig-rain': {
            title: 'Effective rainfall',
            body:  'Fraction of rainfall that actually infiltrates the rootzone rather than running off or evaporating. Typically 70–90 % for well-drained turf.',
        },
        'irrig-cost': {
            title: 'Water cost',
            body:  'Cost per kilolitre (1 000 L) of irrigation water. Used to calculate water cost estimates in irrigation scheduling reports.',
        },
        'wx-soiltemp': {
            title: 'Soil temperature @ 10 cm',
            body:  'Used by disease risk models (Pythium, dollar spot, brown patch). Optional — estimated from air temperature if left blank.',
        },
        'wx-et0': {
            title: 'Reference ET₀ (mm/day)',
            body:  'Reference evapotranspiration — the water demand of a standard grass surface. If left blank, calculated from temperature and humidity using the Penman-Monteith equation.',
        },
        'poa-percent': {
            title: 'Poa annua content',
            body:  'Estimated percentage of Poa annua in the stand. A higher Poa % increases disease susceptibility (particularly dollar spot and Pythium) and raises irrigation demand due to shallower rooting.',
        },
        'c3-cover': {
            title: 'C3 cover',
            body:  'Percentage of the surface area covered by cool-season (C3) grass. Used during transition periods to weight the growth potential calculation between the warm-season base and the cool-season component.',
        },
        'summer-intent': {
            title: 'Summer management intent',
            body:  'Tells the model how you plan to manage the overseed as temperatures rise.\n\nTransition: standard — allow the cool-season grass to fade as heat increases and prioritise base grass recovery. The disease and nutrition models reduce protection for the overseed component.\n\nMaintain: choose this if your base grass is sparse and the surface relies on the overseed for playability through summer. The model adjusts fungicide and nitrogen targets to protect the remaining cool-season component.',
        },
        'site-years': {
            title: 'Years established',
            body:  'Number of years since the surface was established. Peak risk for some soil-borne diseases (e.g. SDS, Pythium root rot) occurs 3–7 years after establishment when organic matter accumulates in the rootzone.',
        },
        'site-thatch': {
            title: 'Thatch depth',
            body:  'Thickness of the thatch layer in millimetres. Thatch creates a moist, warm microclimate close to the soil surface that favours fungal disease. Target: <12 mm. Typically measured by a soil core.',
        },
        'site-wintermin': {
            title: 'Winter minimum temperature',
            body:  'The average minimum temperature (°C) at this site during the coldest month. Used to assess cold-stress disease risk (e.g. Pythium blight increases when winter lows are mild and wet).',
        },
        'led-ppfd': {
            title: 'LED PPFD',
            body:  'Photosynthetic Photon Flux Density — the intensity of your supplemental LED system in µmol/m²/s. Typical stadium grow-light systems: 800–1 200 µmol/m²/s. Used to calculate total DLI when natural light is insufficient.',
        },
        'led-hours': {
            title: 'LED hours per day',
            body:  'Average daily hours the LED system is active during the growing season. Combined with PPFD to calculate the supplemental DLI contribution.',
        },
    };

    (function initStgInfoPopovers() {
        var popover  = document.getElementById('stg-info-popover');
        var popTitle = document.getElementById('stg-info-popover-title');
        var popBody  = document.getElementById('stg-info-popover-body');
        var popClose = document.getElementById('stg-info-popover-close');
        var popArrow = document.getElementById('stg-info-popover-arrow');
        if (!popover) return;

        var _anchor = null;

        function showPopover(anchor) {
            var key   = anchor.dataset.stgInfo;
            var entry = STG_GLOSSARY[key];
            if (!entry) return;
            popTitle.textContent = entry.title;
            popBody.textContent  = entry.body;
            popover.style.visibility = 'hidden';
            popover.style.display    = 'block';

            var rect  = anchor.getBoundingClientRect();
            var pw    = popover.offsetWidth;
            var ph    = popover.offsetHeight;
            var viewW = window.innerWidth;
            var viewH = window.innerHeight;

            var left = Math.round(rect.left + rect.width / 2 - pw / 2);
            left = Math.max(8, Math.min(left, viewW - pw - 8));

            var top, flipped = false;
            if (rect.bottom + 10 + ph > viewH - 8) {
                top = Math.round(rect.top - 10 - ph);
                flipped = true;
            } else {
                top = Math.round(rect.bottom + 10);
            }

            popover.style.left       = left + 'px';
            popover.style.top        = top  + 'px';
            popover.style.visibility = '';

            if (popArrow) {
                var arrowLeft = Math.round(rect.left + rect.width / 2 - left - 5);
                arrowLeft = Math.max(12, Math.min(arrowLeft, pw - 22));
                popArrow.style.left   = arrowLeft + 'px';
                popArrow.style.top    = flipped ? (ph - 1) + 'px' : '-6px';
                popArrow.style.bottom = '';
                popArrow.style.transform = flipped ? 'none' : '';
            }
            _anchor = anchor;
        }

        function hidePopover() {
            popover.style.display = 'none';
            _anchor = null;
        }

        document.addEventListener('click', function (e) {
            if (e.target.closest('.stg-info-icon')) {
                var icon = e.target.closest('.stg-info-icon');
                if (_anchor === icon) { hidePopover(); return; }
                showPopover(icon);
                e.stopPropagation();
                return;
            }
            if (!e.target.closest('#stg-info-popover')) {
                hidePopover();
            }
        });

        if (popClose) popClose.addEventListener('click', hidePopover);
    }());

    /* ── Import from old portal (JSON file) ──────────────────── */

    var SAMPLE_TYPES = ['soil', 'tissue', 'water', 'loi'];

    var impFileInput   = document.getElementById('imp-file-input');
    var impFileName    = document.getElementById('imp-file-name');
    var impStepIdle    = document.getElementById('imp-step-idle');
    var impStepPreview = document.getElementById('imp-step-preview');
    var impStepDone    = document.getElementById('imp-step-done');
    var impRunBtn      = document.getElementById('imp-run-btn');
    var impCancelBtn   = document.getElementById('imp-cancel-btn');
    var impAgainBtn    = document.getElementById('imp-again-btn');
    var impFoundTable  = document.getElementById('imp-found-table');
    var impTargetNote  = document.getElementById('imp-target-note');
    var impMsg         = document.getElementById('imp-msg');
    var impSuccessMsg  = document.getElementById('imp-success-msg');

    var _bundle = null;   /* parsed JSON bundle from file */

    function impReset() {
        _bundle = null;
        if (impFileName) impFileName.textContent = 'Choose .json file…';
        if (impFileInput) impFileInput.value = '';
        impStepPreview && impStepPreview.classList.add('stg-hidden');
        impStepDone    && impStepDone.classList.add('stg-hidden');
        impStepIdle    && impStepIdle.classList.remove('stg-hidden');
        setMsg(impMsg, '', '');
    }

    function countByType(allSites) {
        var counts = { soil: 0, tissue: 0, water: 0, loi: 0 };
        Object.keys(allSites || {}).forEach(function (sid) {
            SAMPLE_TYPES.forEach(function (type) {
                var block = allSites[sid][type];
                if (block && typeof block === 'object') {
                    counts[type] += Object.keys(block).filter(function (k) {
                        var s = block[k];
                        return s && s.rawData && typeof s.rawData === 'object';
                    }).length;
                }
            });
        });
        return counts;
    }

    /* Remap bundle's site data to the active site ID */
    function remapBundle(bundle, targetSiteId) {
        var allSites = (bundle.samples && bundle.samples.allSites) || {};
        var result = {};
        result[targetSiteId] = { soil: {}, tissue: {}, water: {}, loi: {} };

        Object.keys(allSites).forEach(function (oldSiteId) {
            SAMPLE_TYPES.forEach(function (type) {
                var block = allSites[oldSiteId][type];
                if (!block || typeof block !== 'object') return;
                Object.keys(block).forEach(function (k) {
                    var sample = block[k];
                    if (!sample || !sample.rawData) return;
                    var newKey = oldSiteId === targetSiteId ? k : (oldSiteId + '__' + k);
                    result[targetSiteId][type][newKey] = sample;
                });
            });
        });

        return result;
    }

    function showPreview(bundle) {
        var counts = countByType((bundle.samples && bundle.samples.allSites) || {});
        var total = counts.soil + counts.tissue + counts.water + counts.loi;

        var typeLabels = { soil: 'Soil', tissue: 'Tissue', water: 'Water', loi: 'LOI' };
        var html = '';
        SAMPLE_TYPES.forEach(function (type) {
            var n = counts[type];
            html += '<div class="imp-found-row">' +
                '<span class="imp-found-label">' + escHtml(typeLabels[type]) + '</span>' +
                '<span class="imp-found-count' + (n === 0 ? ' zero' : '') + '">' + n + '</span>' +
                '</div>';
        });

        if (impFoundTable) impFoundTable.innerHTML = html;
        if (impTargetNote) {
            var srcLabel = escHtml((bundle.site && bundle.site.label) || 'old portal');
            var dstLabel = escHtml(D.siteName || 'this site');
            impTargetNote.innerHTML = 'From <strong>' + srcLabel + '</strong> → importing into <strong>' + dstLabel + '</strong>.';
        }
        if (impRunBtn) impRunBtn.disabled = (total === 0);

        impStepIdle.classList.add('stg-hidden');
        impStepPreview.classList.remove('stg-hidden');
    }

    var _impSourceFile = null;

    if (impFileInput) {
        impFileInput.addEventListener('change', function () {
            var file = impFileInput.files && impFileInput.files[0];
            if (!file) return;
            _impSourceFile = file.name;
            if (impFileName) impFileName.textContent = file.name;

            var reader = new FileReader();
            reader.onload = function (e) {
                try {
                    var parsed = JSON.parse(e.target.result);
                    if (!parsed.version || !parsed.site || !parsed.samples) {
                        setMsg(impMsg, 'File not recognised — export it again from the old GAIP Hub.', 'err');
                        impStepIdle.classList.remove('stg-hidden');
                        return;
                    }
                    _bundle = parsed;
                    showPreview(_bundle);
                } catch (err) {
                    setMsg(impMsg, 'Could not read file.', 'err');
                }
            };
            reader.readAsText(file);
        });
    }

    if (impCancelBtn) {
        impCancelBtn.addEventListener('click', impReset);
    }

    if (impAgainBtn) {
        impAgainBtn.addEventListener('click', impReset);
    }

    // GH-547 (stage 2): the site is named by the caller. After an import
    // the run belongs to the site that was imported into, which is not
    // necessarily the one the active-site pointer happens to hold.
    function runAnalysisAndRedirect(afterMsg, runSiteId) {
        if (impSuccessMsg) {
            impSuccessMsg.innerHTML =
                '<div>' + afterMsg + '</div>' +
                '<div style="font-size:15px;font-weight:600;color:#2c5f2d;">Re-running analysis…</div>' +
                '<div style="font-size:12px;color:#6b7f76;">You will be redirected to the dashboard when complete.</div>';
        }

        var runId = 'run-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8);
        var siteForRun = runSiteId
            || (window.GAIP_HUB_CONFIG && window.GAIP_HUB_CONFIG.activeSiteId) || '';

        var iframe = document.createElement('iframe');
        iframe.style.cssText = 'position:fixed;top:-9999px;left:-9999px;width:1px;height:1px;opacity:0;pointer-events:none;border:0';
        iframe.setAttribute('aria-hidden', 'true');
        document.body.appendChild(iframe);

        /**
         * GH-724 (queue item 19) — THIS OPENER ASKS THE SAME QUESTIONS AS THE OTHER ONE.
         *
         * It named neither the soil sample nor the tissue one, so a run started from Settings
         * computed on whatever the frame happened to hold, while the same press from the dashboard
         * was told which soil sample to use. Both call the one builder in `dashboard-ui.js`, which
         * the shell loads on every page, so a sample kind added there arrives here without a
         * second edit. If the builder is not present the frame still opens — a run without the
         * parameters is the behaviour this page had all along, and is not made worse by the
         * builder being absent.
         */
        (function () {
            var RF = window.GilbaRunFrame;
            if (RF && typeof RF.url === 'function') {
                RF.url(runId, siteForRun, null).then(function (src) { iframe.src = src; });

                return;
            }
            iframe.src = '/hub?rerun=' + encodeURIComponent(runId) + '&site=' + encodeURIComponent(siteForRun);
        })();

        var done = false;
        function cleanUp() {
            try { document.body.removeChild(iframe); } catch (e) {}
        }
        function succeed() {
            if (done) return;
            done = true;
            cleanUp();
            window.location.href = '/dashboard';
        }
        /**
         * GH-547: a run that did not finish leaves the user on Settings with a
         * reason, instead of sending them to the dashboard to look at the
         * previous result under the impression that the import produced it.
         * That is the plan's wording exactly: the import after a refusal stays
         * where it is.
         */
        /**
         * GH-548 (stage 3): the reason in words, from the one map — the
         * server renders it into `GAIP_ANALYSIS_TEXTS` with the topbar pill.
         * This box used to print the bare code in brackets.
         */
        function failureSentence(reason) {
            var api = window.GilbaAnalysisNotice;
            return api && typeof api.failureText === 'function'
                ? api.failureText(reason)
                : 'The re-run did not complete (' + (reason || 'run-not-completed') + '). Try Re-run from the dashboard.';
        }

        function stall(reason) {
            if (done) return;
            done = true;
            cleanUp();
            if (impSuccessMsg) {
                impSuccessMsg.innerHTML =
                    '<div>' + afterMsg + '</div>' +
                    '<div style="font-size:15px;font-weight:600;color:#8a5a00;">Analysis did not complete</div>' +
                    '<div style="font-size:12px;color:#6b7f76;">The import was saved. The previous analysis is kept'
                    + '.</div>'
                    + '<div style="font-size:12px;color:#6b7f76;">' + failureSentence(reason) + '</div>';
            }
            console.warn('[GilbaImport] re-run did not complete:', reason);
        }

        window.addEventListener('message', function onMsg(e) {
            var d = e && e.data;
            if (!d || typeof d !== 'object' || d.runId !== runId) return;
            if (d.type === 'gilba:analysis-complete') {
                window.removeEventListener('message', onMsg);
                succeed();
            } else if (d.type === 'gilba:analysis-partial') {
                // GH-557 (section 15): a run that finished without
                // part of its result does NOT reload the page. The
                // numbers on screen are the last complete ones, and
                // reloading would replace them with blanks — the same
                // rule as a failure (GH-548).
                window.removeEventListener('message', onMsg);
                stall('values-not-computed');
            } else if (d.type === 'gilba:analysis-failed') {
                window.removeEventListener('message', onMsg);
                stall(d.reason);
            }
        });

        setTimeout(function () { stall('no-report'); }, 30000);
    }

    // Apply siteConfig from bundle: update DB site record + gaip config + localStorage hub state
    function applySiteConfig(bundle) {
        var cfg = bundle.siteConfig;
        if (!cfg || !siteId) return Promise.resolve();

        var tasks = [];

        /**
         * 1. Update site model: location. GH-797 (queue item 3ashch) — THE IMPORT NO LONGER CLEARS THE
         * SOIL TEXTURE.
         *
         * `soil_texture_override: null` stood here because the bundle carries no texture, and from
         * 01.10.2026 the field is required: the write would have been refused at the site route with the
         * samples already replaced, so a person would have read "Not saved" in the middle of a finished
         * import. The owner's words: "then if the import fails now, okay, then during an import just do
         * not delete that field for now. And then we will decide what to do next."
         *
         * The texture now stands with the other properties of a site that the file does not carry -- the
         * name, the time zone and the site type, none of which the import touches. What an import should
         * do with it in the end is her open question.
         */
        var loc = cfg.location;
        var t = cfg.turf || {};
        var sitePatch = {};
        if (loc && typeof loc.lat === 'number' && typeof loc.lon === 'number') {
            sitePatch.location_name = loc.name || '';
            sitePatch.latitude      = loc.lat;
            sitePatch.longitude     = loc.lon;
        }
        // GH-797: with the clearing gone this request can have nothing left in it -- a bundle whose
        // location carries no coordinates -- and a write of nothing is not a change.
        if (Object.keys(sitePatch).length) {
            tasks.push(apiFetch('PATCH', '/sites/' + encodeURIComponent(siteId), sitePatch));
        }

        // 2. Save full turf + location + pgr config to DB gaip namespace
        //
        // GH-377: this body carries a (possibly new) species/methodology but
        // never the cached nutrition programme, so the server's
        // resolveGaipConfigWrite() (GH-371 follow-up) carries the existing DB
        // programme forward unchanged — a programme computed under the
        // PRE-import species then sits next to the post-import turf. That
        // is intended here (this flow has no fresh programme to offer, and a
        // wholesale clear would also wipe a still-valid one on a same-species
        // import); what makes it safe is the read side: restoreConfig()
        // (site-config-persistence.js) and restoreFromPersisted()
        // (nutrition-calendar.js) compare the programme's stamped
        // meta.species/methodology against the restored turf and refuse the
        // stale copy, showing the regenerate state instead.
        // GH-440 (GH-439 stage 1): the three sections the bundle carries,
        // as a patch. As a whole-object write this deleted every section the
        // bundle happened not to mention -- traffic, irrigation, alerts, the
        // wizard record -- from a site the owner was only importing turf and
        // location into.
        tasks.push(patchGaipConfig({
            turf: t,
            location: cfg.location || {},
            pgr: cfg.pgr || {},
        }));

        // GH-442 (GH-439 stage 3): the third mirror is gone too. An import
        // wrote its turf and location into gilba_hub_site_configs so the hub
        // engine would use the fresh values immediately; the engine reads the
        // server's config now, and the patch above is what makes it fresh.

        return Promise.all(tasks);
    }

    /* ── Traffic & Wear form ─────────────────────────────── */
    var trafficForm    = document.getElementById('stg-traffic-form');
    var trafficSaveBtn = document.getElementById('stg-traffic-save');
    var trafficMsg     = document.getElementById('stg-traffic-msg');

    /**
     * GH-790 (queue item 9) — THE SCHEDULE HAS ONE RECORD, AND IT IS THE SITE'S.
     *
     * GH-394 kept a same-device mirror in `localStorage` beside the server's copy. Three places read it --
     * this form, the Plan page's recovery section and the Clegg fields of the `/hub` markup -- and this
     * form's "Save" then carried whatever it had read back up to the server. A browser's memory could
     * therefore write itself into the site's configuration, which is the one thing the project's rule about
     * the database forbids outright: send the change, not the state.
     *
     * The mirror is not read and not written any more. A device that held one shows an empty form until the
     * site itself carries a schedule, which is the truth about the site rather than what this browser
     * happened to remember. The old key is removed once, on load, below.
     */
    function getTrafficSchedule() {
        var cfg = D.gaipConfig;
        if (cfg && !Array.isArray(cfg) && cfg.traffic && cfg.traffic.schedule) return cfg.traffic.schedule;

        return {};
    }

    /**
     * GH-790: the mirror's key is cleared once per site, the same way the last-PGR key was cleared when its
     * store was withdrawn. Left behind, it is a value in a browser with no reader -- the shape somebody
     * finds in a year and takes for a store that is still in use.
     */
    try {
        if (siteId) localStorage.removeItem('gilba_traffic_state_' + siteId);
        localStorage.removeItem('gilba_traffic_state_default');
    } catch (_mirrorErr) { /* a browser that refuses storage has nothing to clear */ }

    function loadTrafficForm() {
        if (!trafficForm) return;
        var saved = getTrafficSchedule() || {};
        function setVal(id, val) { var el = document.getElementById(id); if (el && val !== undefined && val !== null) el.value = val; }
        setVal('stg-tw-moisture',    saved.moisture);
        setVal('stg-tw-root-depth',  saved.rootDepth);
        setVal('stg-tw-sport',       saved.sport);
        setVal('stg-tw-matches',     saved.matchesPerWeek);
        setVal('stg-tw-match-dur',   saved.matchDuration);
        setVal('stg-tw-age-group',   saved.ageGroup);
        setVal('stg-tw-squad-size',  saved.squadSize);
        setVal('stg-tw-train-type',  saved.trainingType);
        setVal('stg-tw-sessions',    saved.sessionsPerWeek);
        setVal('stg-tw-session-dur', saved.sessionDuration);
        setVal('stg-tw-area-pct',    saved.trainingAreaPct);
        setVal('stg-tw-rest-days',   saved.restDays);
        setVal('stg-tw-h1',          saved.h1);
        setVal('stg-tw-h2',          saved.h2);
        setVal('stg-tw-h3',          saved.h3);
        setVal('stg-tw-h4',          saved.h4);
        setVal('stg-tw-clegg-mean',  saved.cleggMean);
        setVal('stg-tw-clegg-hard',  saved.cleggHard);
        setVal('stg-tw-clegg-soft',  saved.cleggSoft);
    }

    if (trafficForm) {
        loadTrafficForm();
        trafficForm.addEventListener('submit', function (e) {
            e.preventDefault();
            if (!siteId) return;
            function getVal(id) { var el = document.getElementById(id); return el ? el.value : ''; }
            function getNum(id) { var v = getVal(id); return v !== '' ? parseFloat(v) : null; }

            var state = {
                moisture:        getVal('stg-tw-moisture'),
                rootDepth:       getNum('stg-tw-root-depth'),
                sport:           getVal('stg-tw-sport'),
                matchesPerWeek:  getNum('stg-tw-matches'),
                matchDuration:   getNum('stg-tw-match-dur'),
                ageGroup:        getVal('stg-tw-age-group'),
                squadSize:       getVal('stg-tw-squad-size'),
                trainingType:    getVal('stg-tw-train-type'),
                sessionsPerWeek: getNum('stg-tw-sessions'),
                sessionDuration: getNum('stg-tw-session-dur'),
                trainingAreaPct: getNum('stg-tw-area-pct'),
                restDays:        getNum('stg-tw-rest-days'),
                h1:              getNum('stg-tw-h1'),
                h2:              getNum('stg-tw-h2'),
                h3:              getNum('stg-tw-h3'),
                h4:              getNum('stg-tw-h4'),
                cleggMean:       getNum('stg-tw-clegg-mean'),
                cleggHard:       getNum('stg-tw-clegg-hard'),
                cleggSoft:       getNum('stg-tw-clegg-soft'),
            };

            // GH-790 (queue item 9): the mirror is not written. What this form sends to the server IS the
            // record; a copy beside it could only disagree with it, and the copy was the one that travelled
            // back up on the next save.

            // GH-394 (D31 stage 3): persist the schedule server-side as well.
            // Until now this form wrote localStorage and nothing else, so the
            // nutrition traffic modifier could never see it — it resolved
            // 'moderate' x1.0 on every site — and neither could the Plan page
            // on another device or the Word export. `config.traffic` is a
            // top-level key deliberately, NOT `config.turf.*`: site-config-
            // persistence.js's snapshotConfig() rebuilds `turf` from the legacy
            // DOM on hub pages, so a turf field with no DOM twin is dropped on
            // the first site switch. That same file's carry-forward list gained
            // `traffic` in this ticket for exactly the same reason.
            setSaving(trafficSaveBtn, true);
            setMsg(trafficMsg, '', '');
            // GH-440 (GH-439 stage 1): the traffic section alone; nothing this
            // form does not own travels with it, so there is no clone to strip
            // the programme keys out of.
            patchGaipConfig({ traffic: { schedule: state, savedAt: new Date().toISOString() } },
                'settings.trafficAndWear')
                .then(function () {
                    _checkAfterSave('stg-traffic-form');
                    setMsg(trafficMsg, 'Saved.', 'ok');
                    setTimeout(function () { setMsg(trafficMsg, '', ''); }, 2000);
                })
                .catch(function (err) { showRefusal('stg-traffic-form', trafficMsg, err); })
                .finally(function () { setSaving(trafficSaveBtn, false); });
        });
    }

    if (impRunBtn) {
        impRunBtn.addEventListener('click', function () {
            if (!siteId || !_bundle) return;

            var remapped = remapBundle(_bundle, siteId);
            impRunBtn.disabled = true;
            if (impCancelBtn) impCancelBtn.disabled = true;
            setMsg(impMsg, 'Importing…', '');

            // GH-722: the server checks the whole file BEFORE it clears anything, and a file with
            // nothing recognised in it comes back refused with the site untouched. So nothing on
            // this page is cleared before the server has answered either; the block below ran
            // ahead of the request until now.
            apiFetch('POST', '/samples/sync', { allSites: remapped, clearSiteData: true, sourceFile: _impSourceFile || null })
                .then(function (data) {
                    // GH-536 (PLAN-samples-sync-FINAL, stage 3): this block used to read
                    // the browser copy, cut the target site out of it, write it back and
                    // feed the result to the store. The copy is gone; the in-memory store
                    // is taken from the store itself. What it does is unchanged: the
                    // site being imported into is emptied on screen, because the server
                    // side of the import (clearSiteData) has just emptied it there.
                    //
                    // restoreFromPersistence, not clearSamples: clearSamples dispatches
                    // the mutation events, which per-record writes would turn into a
                    // DELETE per sample against rows the import has already removed.
                    try {
                        var SM = window.GAIP_SampleManager;
                        if (SM && typeof SM.getAllSamples === 'function'
                               && typeof SM.restoreFromPersistence === 'function') {
                            var _snap = SM.getAllSamples();
                            ['allSites', 'allActive', 'allMeta', 'sites'].forEach(function (k) {
                                if (_snap[k]) delete _snap[k][siteId];
                            });
                            SM.restoreFromPersistence(_snap);
                        }
                    } catch (_e) {}
                    try { localStorage.removeItem('gilba_last_pgr_' + siteId); } catch (_e) {}
                    try {
                        var _smaps = {};
                        try { _smaps = JSON.parse(localStorage.getItem('gilba_sensor_mappings') || '{}'); } catch (_e) {}
                        delete _smaps[siteId];
                        localStorage.setItem('gilba_sensor_mappings', JSON.stringify(_smaps));
                    } catch (_e) {}
                    var outcome = (data && data.data && data.data.outcome) || null;
                    return applySiteConfig(_bundle).then(function () { return outcome; });
                })
                .then(function (outcome) {
                    impStepPreview.classList.add('stg-hidden');
                    impStepDone.classList.remove('stg-hidden');
                    // GH-722: the sentence is the server's, and the CLASS decides how it is shown.
                    // `partial` is never worded or drawn as a success: no check mark, the warning
                    // style. The numbers are inside the sentence.
                    var partial = !outcome || outcome.outcome !== 'saved';
                    if (impSuccessMsg) impSuccessMsg.classList.toggle('partial', partial);
                    var checkmark = '<svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5" style="flex-shrink:0"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/></svg>';
                    var outcomeHtml = escHtml((outcome && outcome.message) || 'The server did not say what the import came to.');
                    runAnalysisAndRedirect(partial ? outcomeHtml : (checkmark + ' ' + outcomeHtml), siteId);
                })
                .catch(function (err) {
                    // GH-526 (stage 1, item 7): say what the server said. "Please
                    // try again" is advice that cannot work when the answer is
                    // "this import names more than one site" -- trying again
                    // sends the same request. apiFetch now throws with the
                    // server's own message on it.
                    var detail = (err && err.message) ? err.message : '';
                    setMsg(impMsg, detail
                        ? ('Import failed — ' + detail)
                        : 'Import failed — please try again.', 'err');
                    if (impRunBtn) impRunBtn.disabled = false;
                    if (impCancelBtn) impCancelBtn.disabled = false;
                });
        });
    }

})();
