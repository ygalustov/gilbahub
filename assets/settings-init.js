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
        }).then(function (r) { return r.json(); });
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
                setMsg(siteMsg, 'Site name is required.', 'err');
                return;
            }

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

            // Irrigation system + weather override → gaip config (location/irrigation/weatherOverride keys)
            var cfg = JSON.parse(JSON.stringify(D.gaipConfig || {}));
            if (Array.isArray(cfg)) cfg = {};

            // GH-371 follow-up (independent review): this form never reads,
            // edits, or otherwise legitimately needs to round-trip the
            // cached nutrition programme -- cfg is just a full clone of
            // whatever D.gaipConfig happened to hold at page load, and
            // these three keys ride along as unintended baggage. Sent as-is,
            // that clone can carry a now-stale programme (computed for the
            // OLD coordinates, since this clone was taken before the edits
            // below) straight back into the DB via this same save's PUT --
            // including immediately after the sibling PATCH below has just
            // cleared it server-side for this exact coordinate change (both
            // requests fire together, see the Promise.all below). Stripped
            // here so this save's PUT body can never carry them; the server
            // side (SiteController::updateConfig()) independently also
            // never lets a client payload overwrite these three keys with
            // anything other than a freshly, correctly-stamped programme,
            // so this is belt-and-braces, not the only guard.
            delete cfg.nutritionProgram;
            delete cfg.nutritionCalendarProgram;
            delete cfg.nutritionProgramCoords;

            var _latVal = siteForm.querySelector('#stg-latitude').value;
            var _lonVal = siteForm.querySelector('#stg-longitude').value;
            var _latNum = _latVal !== '' ? parseFloat(_latVal) : null;
            var _lonNum = _lonVal !== '' ? parseFloat(_lonVal) : null;
            var _locUpdate = {
                name:      siteForm.querySelector('#stg-location-name').value.trim() || '',
                elevation: elevEl && elevEl.value !== '' ? parseInt(elevEl.value, 10) : null,
            };
            if (_latNum !== null && !isNaN(_latNum)) _locUpdate.lat = _latNum;
            if (_lonNum !== null && !isNaN(_lonNum)) _locUpdate.lon = _lonNum;
            cfg.location = Object.assign({}, cfg.location || {}, _locUpdate);

            var irrigMethodEl     = siteForm.querySelector('#stg-irrig-method');
            var irrigEffEl        = siteForm.querySelector('#stg-irrig-efficiency');
            var irrigRainEl       = siteForm.querySelector('#stg-irrig-rain');
            var irrigCostEl       = siteForm.querySelector('#stg-irrig-cost');
            if (irrigMethodEl) {
                cfg.irrigation = {
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
                cfg.weatherOverride = {
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
                apiFetch('PUT', '/sites/' + encodeURIComponent(siteId) + '/config/gaip', { config: cfg }),
            ])
                .then(function (results) {
                    var data = results[0];
                    if (data && data.data && data.data.name) {
                        D.gaipConfig = cfg;
                        // Mirror location to localStorage so LocationPreloader and
                        // the old hub iframe use the updated coordinates immediately.
                        if (_locUpdate.lat && _locUpdate.lon) {
                            try {
                                var _cfgKey = 'gilba_hub_site_configs';
                                var _cfgs = {};
                                try { _cfgs = JSON.parse(localStorage.getItem(_cfgKey) || '{}'); } catch (_) {}
                                if (!_cfgs[siteId]) _cfgs[siteId] = {};
                                _cfgs[siteId].location = Object.assign({}, _cfgs[siteId].location || {}, _locUpdate);
                                localStorage.setItem(_cfgKey, JSON.stringify(_cfgs));
                            } catch (_) {}
                        }
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
                .catch(function () { setMsg(siteMsg, 'Network error.', 'err'); })
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

    var _speciesTraitsKey = {
        'Creeping Bentgrass (Greens)':              'bentgrass',
        'Creeping Bentgrass (Fairway)':             'bentgrass',
        'Creeping Bentgrass':                       'bentgrass',
        'Colonial Bentgrass':                       'bentgrass',
        'Browntop Bent':                            'browntopBent',
        'Browntop Bent (Greens)':                   'browntopBent',
        'Browntop Bent (Fairways)':                 'browntopBent',
        'Perennial Ryegrass':                       'perennialRyegrass',
        'Kentucky Bluegrass':                       'kentuckyBluegrass',
        'Tall Fescue':                              'tallFescue',
        'Fine Fescue':                              'fineFescue',
        'Chewings Fescue':                          'chewingsFescue',
        'Chewings Fescue (Greens)':                 'chewingsFescue',
        'Chewings Fescue (Fairways)':               'chewingsFescue',
        'Slender Creeping Red Fescue':              'slenderCreepingRedFescue',
        'Slender Creeping Red Fescue (Greens)':     'slenderCreepingRedFescue',
        'Slender Creeping Red Fescue (Fairways)':   'slenderCreepingRedFescue',
        'Strong Creeping Red Fescue':               'strongCreepingRedFescue',
        'Strong Creeping Red Fescue (Fairways)':    'strongCreepingRedFescue',
        'Poa annua':                                null,
        'Annual Bluegrass (Greens)':                null,
        'Annual Bluegrass (Fairway)':               null,
        'Couch':                                    'couch',
        'Bermuda':                                  'couch',
        'Kikuyu':                                   'kikuyu',
        'Zoysia':                                   'zoysia',
        'Seashore Paspalum':                        'seashore_paspalum',
        'Buffalo':                                  'buffalo',
        'Buffalograss':                             'buffalo',
        'Cotula':                                   null,
    };

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
        var key = _speciesTraitsKey[species];
        var varieties = [{ value: 'generic', label: 'Generic / Unknown' }];

        var vt = window.GAIP_VARIETY_TRAITS;
        if (vt && key && vt[key]) {
            Object.keys(vt[key]).forEach(function (name) {
                if (name.startsWith('_')) return;
                var v = vt[key][name];
                varieties.push({ value: name, label: (v && v.displayName) || name });
            });
        }

        turfVarietyEl.innerHTML = '';
        varieties.forEach(function (v) {
            var o = document.createElement('option');
            o.value = v.value;
            o.textContent = v.label;
            if (v.value === selectedValue) o.selected = true;
            turfVarietyEl.appendChild(o);
        });
        // If saved variety not in list, prepend it
        if (selectedValue && selectedValue !== 'generic' &&
            !varieties.some(function (v) { return v.value === selectedValue; })) {
            var o = document.createElement('option');
            o.value = selectedValue;
            o.textContent = selectedValue;
            o.selected = true;
            turfVarietyEl.insertBefore(o, turfVarietyEl.firstChild);
        }
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
    var _initVariety  = (D.gaipConfig && D.gaipConfig.turf && D.gaipConfig.turf.variety) || 'generic';

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
                poaPercent:     document.getElementById('stg-turf-poa').value || '0',
                c3Cover:        document.getElementById('stg-turf-c3').value || '0',
                // Save under both keys: overseedSpecies (hub persistence layer) and
                // coolOverseed (engine internal name read by hub-tissue-v3, hub-orchestrator, etc.)
                overseedSpecies:  document.getElementById('stg-turf-cool-overseed').value || '',
                coolOverseed:     document.getElementById('stg-turf-cool-overseed').value || '',
                overseedVariety:  document.getElementById('stg-turf-overseed-variety').value || 'generic',
                overseedStatus:   document.getElementById('stg-turf-overseed-status').value || 'none',
                summerIntent:     document.getElementById('stg-turf-summer-intent').value || 'transition',
                companionSpecies: (document.getElementById('stg-companion-species') || {}).value || '',
            };

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

            // Merge into existing gaip config — preserve all fields not shown in this form
            // (aaTexture, overseedSpecies, summerIntent, trafficEnabled, wizard, pgr, etc.)
            var cfg = JSON.parse(JSON.stringify(D.gaipConfig || {}));
            // New sites initialise config as [] (PHP empty array → JSON array).
            // Array properties are silently dropped by JSON.stringify, so convert to object.
            if (Array.isArray(cfg)) cfg = {};
            cfg.turf = Object.assign({}, cfg.turf || {}, turf);

            // GH-371 follow-up (independent review): same reasoning as the
            // site form's save handler above -- this form doesn't touch
            // nutrition-programme data either, so a possibly-stale
            // D.gaipConfig clone must never carry these three keys back in.
            delete cfg.nutritionProgram;
            delete cfg.nutritionCalendarProgram;
            delete cfg.nutritionProgramCoords;

            // soil_texture_override lives on the site model, not gaip config — save separately
            var saves = [
                apiFetch('PUT', '/sites/' + encodeURIComponent(siteId) + '/config/gaip', { config: cfg }),
                apiFetch('PATCH', '/sites/' + encodeURIComponent(siteId), { soil_texture_override: soilTexture }),
            ];

            Promise.all(saves)
                .then(function () {
                    D.gaipConfig = cfg;
                    // Mirror to localStorage so the hub engine picks up the new values
                    // without requiring a manual re-run or page reload.
                    try {
                        var configsKey = 'gilba_hub_site_configs';
                        var allConfigs = {};
                        try { allConfigs = JSON.parse(localStorage.getItem(configsKey) || '{}'); } catch (_) {}
                        if (!allConfigs[siteId]) allConfigs[siteId] = {};
                        allConfigs[siteId].turf = Object.assign({}, allConfigs[siteId].turf || {}, turf);
                        localStorage.setItem(configsKey, JSON.stringify(allConfigs));
                    } catch (_) {}
                    _checkAfterSave('stg-turf-form');
                    setMsg(turfMsg, 'Saved.', 'ok');
                    updateTrafficTabVisibility(turf.turfType);
                    // Update topbar pills
                    var speciesEl = document.getElementById('db-pill-species');
                    if (speciesEl) speciesEl.textContent = turf.species || '';
                })
                .catch(function () { setMsg(turfMsg, 'Save failed.', 'err'); })
                .finally(function () { setSaving(turfSaveBtn, false); });
        });
    }

    /* ── Zones ───────────────────────────────────────────────── */
    var zoneList    = document.getElementById('stg-zone-list');
    var zoneInput   = document.getElementById('stg-zone-input');
    var zoneAddBtn  = document.getElementById('stg-zone-add-btn');
    var zonesSave   = document.getElementById('stg-zones-save');
    var zonesMsg    = document.getElementById('stg-zones-msg');

    function renderZones() {
        if (!zoneList) return;
        zoneList.innerHTML = '';
        if (!zones.length) {
            zoneList.innerHTML = '<div class="stg-zone-empty">No zones defined yet.</div>';
            return;
        }
        zones.forEach(function (name, idx) {
            var item = document.createElement('div');
            item.className = 'stg-zone-item';
            item.innerHTML =
                '<span class="stg-zone-name">' + escHtml(name) + '</span>' +
                '<button type="button" class="stg-zone-del" data-idx="' + idx + '" title="Remove zone">×</button>';
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

        zoneList.addEventListener('click', function (e) {
            var btn = e.target.closest('.stg-zone-del');
            if (!btn) return;
            var idx = parseInt(btn.dataset.idx, 10);
            zones.splice(idx, 1);
            renderZones();
            markDirty('stg-zones-form');
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
            if (zones.indexOf(name) === -1) {
                zones.push(name);
                renderZones();
                markDirty('stg-zones-form');
            }
            zoneInput.value = '';
            zoneInput.focus();
        }

        zoneAddBtn.addEventListener('click', addZone);
        zoneInput.addEventListener('keydown', function (e) {
            if (e.key === 'Enter') { e.preventDefault(); addZone(); }
        });
    }

    if (zonesSave) {
        zonesSave.addEventListener('click', function () {
            if (!siteId) return;

            setSaving(zonesSave, true);
            setMsg(zonesMsg, '', '');

            apiFetch('PATCH', '/sites/' + siteId, { attributes_json: { zones: zones } })
                .then(function (data) {
                    if (data && data.data) {
                        setMsg(zonesMsg, 'Zones saved.', 'ok');
                        _checkAfterSave('stg-zones-form');
                    } else {
                        var err = (data && data.message) ? data.message : 'Save failed.';
                        setMsg(zonesMsg, err, 'err');
                    }
                })
                .catch(function () { setMsg(zonesMsg, 'Network error.', 'err'); })
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

    function runAnalysisAndRedirect(afterMsg) {
        if (impSuccessMsg) {
            impSuccessMsg.innerHTML =
                '<div>' + afterMsg + '</div>' +
                '<div style="font-size:15px;font-weight:600;color:#2c5f2d;">Re-running analysis…</div>' +
                '<div style="font-size:12px;color:#6b7f76;">You will be redirected to the dashboard when complete.</div>';
        }

        var iframe = document.createElement('iframe');
        iframe.src = '/hub';
        iframe.style.cssText = 'position:fixed;top:-9999px;left:-9999px;width:1px;height:1px;opacity:0;pointer-events:none;border:0';
        iframe.setAttribute('aria-hidden', 'true');
        document.body.appendChild(iframe);

        var done = false;
        function finish() {
            if (done) return;
            done = true;
            try { document.body.removeChild(iframe); } catch (e) {}
            window.location.href = '/dashboard';
        }

        window.addEventListener('message', function onMsg(e) {
            if (e.data === 'gilba:analysis-complete') {
                window.removeEventListener('message', onMsg);
                finish();
            }
        });

        setTimeout(finish, 30000);
    }

    // Apply siteConfig from bundle: update DB site record + gaip config + localStorage hub state
    function applySiteConfig(bundle) {
        var cfg = bundle.siteConfig;
        if (!cfg || !siteId) return Promise.resolve();

        var tasks = [];

        // 1. Update site model: location + clear soil_texture_override (not in import bundle)
        var loc = cfg.location;
        var t = cfg.turf || {};
        var sitePatch = { soil_texture_override: null };
        if (loc && typeof loc.lat === 'number' && typeof loc.lon === 'number') {
            sitePatch.location_name = loc.name || '';
            sitePatch.latitude      = loc.lat;
            sitePatch.longitude     = loc.lon;
        }
        tasks.push(apiFetch('PATCH', '/sites/' + encodeURIComponent(siteId), sitePatch));

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
        tasks.push(apiFetch('PUT', '/sites/' + encodeURIComponent(siteId) + '/config/gaip', {
            config: { turf: t, location: cfg.location || {}, pgr: cfg.pgr || {} }
        }));

        // 3. Update gilba_hub_site_configs (SiteConfigPersistence key) — force-overwrites so
        //    the seed guard ("skip if species already set") doesn't prevent using fresh data
        try {
            var configsKey = 'gilba_hub_site_configs';
            var allConfigs = {};
            try { allConfigs = JSON.parse(localStorage.getItem(configsKey) || '{}'); } catch (_) {}
            if (!allConfigs[siteId]) allConfigs[siteId] = {};
            allConfigs[siteId].turf = Object.assign({}, allConfigs[siteId].turf || {}, {
                species:      t.species      || '',
                variety:      t.variety      || '',
                turfType:     t.turfType     || '',
                subCategory:  t.subCategory  || '',
                construction: t.construction || '',
                drainage:     t.drainage     || '',
                hoc:          t.hoc          || '',
                nProgram:     t.nProgram     || '',
                methodology:  t.methodology  || '',
                poaPercent:     t.poaPercent     || '0',
                c3Cover:        t.c3Cover        || '0',
                warmBase:       t.warmBase       || '',
                coolOverseed:     t.coolOverseed     || '',
                overseedStatus:   t.overseedStatus   || 'none',
                aaTexture:        t.aaTexture        || '',
                companionSpecies: t.companionSpecies || '',
            });
            if (loc && typeof loc.lat === 'number') {
                allConfigs[siteId].location = { lat: loc.lat, lon: loc.lon, name: loc.name || '' };
            }
            localStorage.setItem(configsKey, JSON.stringify(allConfigs));
        } catch (_) {}

        return Promise.all(tasks);
    }

    /* ── Traffic & Wear form ─────────────────────────────── */
    var trafficForm    = document.getElementById('stg-traffic-form');
    var trafficSaveBtn = document.getElementById('stg-traffic-save');
    var trafficMsg     = document.getElementById('stg-traffic-msg');

    function getTrafficStateKey() {
        return 'gilba_traffic_state_' + (siteId || 'default');
    }

    function loadTrafficForm() {
        if (!trafficForm) return;
        var saved = {};
        try { saved = JSON.parse(localStorage.getItem(getTrafficStateKey()) || '{}'); } catch(e) {}
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

            try { localStorage.setItem(getTrafficStateKey(), JSON.stringify(state)); } catch(e) {}
            _checkAfterSave('stg-traffic-form');

            setSaving(trafficSaveBtn, true);
            setMsg(trafficMsg, 'Saved.', 'ok');
            setTimeout(function () {
                setSaving(trafficSaveBtn, false);
                setMsg(trafficMsg, '', '');
            }, 2000);
        });
    }

    if (impRunBtn) {
        impRunBtn.addEventListener('click', function () {
            if (!siteId || !_bundle) return;

            var remapped = remapBundle(_bundle, siteId);
            impRunBtn.disabled = true;
            if (impCancelBtn) impCancelBtn.disabled = true;
            setMsg(impMsg, 'Importing…', '');

            try {
                var _snap = {};
                try { _snap = JSON.parse(localStorage.getItem('gilba_samples') || '{}'); } catch (_e) {}
                ['allSites', 'allActive', 'allMeta', 'sites'].forEach(function (k) {
                    if (_snap[k]) delete _snap[k][siteId];
                });
                localStorage.setItem('gilba_samples', JSON.stringify(_snap));
                var SM = window.GAIP_SampleManager;
                if (SM && typeof SM.restoreFromPersistence === 'function') SM.restoreFromPersistence(_snap);
            } catch (_e) {}
            try { localStorage.removeItem('gilba_last_pgr_' + siteId); } catch (_e) {}
            try {
                var _smaps = {};
                try { _smaps = JSON.parse(localStorage.getItem('gilba_sensor_mappings') || '{}'); } catch (_e) {}
                delete _smaps[siteId];
                localStorage.setItem('gilba_sensor_mappings', JSON.stringify(_smaps));
            } catch (_e) {}

            apiFetch('POST', '/samples/sync', { allSites: remapped, clearSiteData: true, sourceFile: _impSourceFile || null })
                .then(function (data) {
                    var synced = (data && data.data && data.data.synced) || 0;
                    return applySiteConfig(_bundle).then(function () { return synced; });
                })
                .then(function (synced) {
                    impStepPreview.classList.add('stg-hidden');
                    impStepDone.classList.remove('stg-hidden');
                    var checkmark = '<svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5" style="flex-shrink:0"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/></svg>';
                    var msg = checkmark + ' ' + synced + ' record' + (synced !== 1 ? 's' : '') + ' imported successfully.';
                    runAnalysisAndRedirect(msg);
                })
                .catch(function () {
                    setMsg(impMsg, 'Import failed — please try again.', 'err');
                    if (impRunBtn) impRunBtn.disabled = false;
                    if (impCancelBtn) impCancelBtn.disabled = false;
                });
        });
    }

})();
