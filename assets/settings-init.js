/* settings-init.js — Settings page logic */
(function () {
    'use strict';

    var D = window.STG_DATA || {};
    var siteId   = D.activeSiteId || null;
    var apiBase  = (D.apiBase || '').replace(/\/$/, '');
    var csrf     = D.csrfToken || '';
    var zones    = (D.zones && Array.isArray(D.zones)) ? D.zones.slice() : [];

    /* ── Tab switching ───────────────────────────────────────── */
    document.querySelectorAll('.stg-tab').forEach(function (tab) {
        tab.addEventListener('click', function () {
            document.querySelectorAll('.stg-tab').forEach(function (t) {
                t.classList.remove('active');
                t.setAttribute('aria-selected', 'false');
            });
            document.querySelectorAll('.stg-panel').forEach(function (p) {
                p.classList.add('stg-hidden');
            });
            tab.classList.add('active');
            tab.setAttribute('aria-selected', 'true');
            var panel = document.getElementById('stg-tab-' + tab.dataset.tab);
            if (panel) panel.classList.remove('stg-hidden');
        });
    });

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

            setSaving(siteSaveBtn, true);
            setMsg(siteMsg, '', '');

            apiFetch('PATCH', '/sites/' + siteId, payload)
                .then(function (data) {
                    if (data && data.data && data.data.name) {
                        setMsg(siteMsg, 'Saved.', 'ok');
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

                fetch('https://geocoding-api.open-meteo.com/v1/search?name=' + encodeURIComponent(q) + '&count=5&language=en&format=json')
                    .then(function (r) { return r.json(); })
                    .then(function (data) {
                        var results = data.results || [];
                        if (!results.length) {
                            resultsDiv.innerHTML = '<div style="padding:10px;color:#6b7f76;font-size:13px;">No locations found</div>';
                            return;
                        }
                        var locs = results.map(function (r) {
                            return {
                                display: [r.name, r.admin1, r.country].filter(Boolean).join(', '),
                                lat: r.latitude,
                                lon: r.longitude,
                            };
                        });
                        var html = '';
                        locs.forEach(function (loc, i) {
                            html += '<div class="stg-loc-result" data-i="' + i + '" style="padding:10px 12px;border-bottom:1px solid #eef1ef;cursor:pointer;">' +
                                '<div style="font-weight:500;color:#2c5f2d;font-size:13px;">📍 ' + escHtml(loc.display) + '</div>' +
                                '<div style="font-size:11px;color:#6b7f76;font-family:monospace;margin-top:2px;">' +
                                loc.lat.toFixed(4) + '°, ' + loc.lon.toFixed(4) + '°</div></div>';
                        });
                        resultsDiv.innerHTML = html;
                        resultsDiv.querySelectorAll('.stg-loc-result').forEach(function (el) {
                            var idx = parseInt(el.dataset.i, 10);
                            el.addEventListener('mouseenter', function () { el.style.background = '#f4f8f5'; });
                            el.addEventListener('mouseleave', function () { el.style.background = ''; });
                            el.addEventListener('click', function () {
                                var loc = locs[idx];
                                locInput.value = loc.display;
                                var latEl = document.getElementById('stg-latitude');
                                var lonEl = document.getElementById('stg-longitude');
                                if (latEl) { latEl.value = loc.lat.toFixed(7); updateHemisphere(loc.lat); }
                                if (lonEl) lonEl.value = loc.lon.toFixed(7);
                                resultsDiv.style.display = 'none';
                            });
                        });
                    })
                    .catch(function () {
                        resultsDiv.innerHTML = '<div style="padding:10px;color:#c41e3a;font-size:13px;">Search unavailable — check connection</div>';
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
    if (_latInput) {
        _latInput.addEventListener('input', function () { updateHemisphere(this.value); });
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
        'Creeping Bentgrass (Greens)':  'bentgrass',
        'Creeping Bentgrass (Fairway)': 'bentgrass',
        'Creeping Bentgrass':           'bentgrass',
        'Colonial Bentgrass':           'bentgrass',
        'Browntop Bent':                'browntopBent',
        'Perennial Ryegrass':           'perennialRyegrass',
        'Kentucky Bluegrass':           'kentuckyBluegrass',
        'Tall Fescue':                  'tallFescue',
        'Fine Fescue':                  'fineFescue',
        'Chewings Fescue':              'chewingsFescue',
        'Chewings Fescue (Greens)':     'chewingsFescue',
        'Slender Creeping Red Fescue':  'slenderCreepingRedFescue',
        'Strong Creeping Red Fescue':   'strongCreepingRedFescue',
        'Poa annua':                    null,
        'Couch':                        'couch',
        'Bermuda':                      'couch',
        'Kikuyu':                       'kikuyu',
        'Zoysia':                       'zoysia',
        'Seashore Paspalum':            'seashore_paspalum',
        'Buffalo':                      'buffalo',
    };

    function repopulateVariety(species, selectedValue) {
        if (!turfVarietyEl) return;
        var vt = window.GAIP_VARIETY_TRAITS;
        var key = _speciesTraitsKey[species];
        var varieties = [{ value: 'generic', label: 'Generic / Unknown' }];
        if (vt && key && vt[key]) {
            Object.keys(vt[key]).forEach(function(name) {
                if (name.startsWith('_')) return;
                var v = vt[key][name];
                varieties.push({ value: name, label: (v && v.displayName) || name });
            });
        }
        turfVarietyEl.innerHTML = '';
        varieties.forEach(function(v) {
            var o = document.createElement('option');
            o.value = v.value;
            o.textContent = v.label;
            if (v.value === selectedValue) o.selected = true;
            turfVarietyEl.appendChild(o);
        });
        // If saved variety not in list, prepend it
        if (selectedValue && selectedValue !== 'generic' &&
            !varieties.some(function(v) { return v.value === selectedValue; })) {
            var o = document.createElement('option');
            o.value = selectedValue;
            o.textContent = selectedValue;
            o.selected = true;
            turfVarietyEl.insertBefore(o, turfVarietyEl.firstChild);
        }
    }

    if (turfSpeciesEl) {
        var _initVariety = (D.gaipConfig && D.gaipConfig.turf && D.gaipConfig.turf.variety) || 'generic';
        repopulateVariety(turfSpeciesEl.value, _initVariety);
        turfSpeciesEl.addEventListener('change', function () {
            repopulateVariety(turfSpeciesEl.value, 'generic');
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

    if (turfTypeEl) {
        var _initSub = (D.gaipConfig && D.gaipConfig.turf && D.gaipConfig.turf.subCategory) || '';
        repopulateSubcategory(turfTypeEl.value, _initSub);
        turfTypeEl.addEventListener('change', function () {
            repopulateSubcategory(turfTypeEl.value, '');
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
                poaPercent:   document.getElementById('stg-turf-poa').value || '0',
                c3Cover:      document.getElementById('stg-turf-c3').value || '0',
            };

            // Merge into existing gaip config — preserve all fields not shown in this form
            // (aaTexture, overseedSpecies, summerIntent, trafficEnabled, wizard, pgr, etc.)
            var cfg = JSON.parse(JSON.stringify(D.gaipConfig || {}));
            cfg.turf = Object.assign({}, cfg.turf || {}, turf);

            // soil_texture_override lives on the site model, not gaip config — save separately
            var saves = [
                apiFetch('PUT', '/sites/' + encodeURIComponent(siteId) + '/config/gaip', { config: cfg }),
                apiFetch('PATCH', '/sites/' + encodeURIComponent(siteId), { soil_texture_override: soilTexture }),
            ];

            Promise.all(saves)
                .then(function () {
                    D.gaipConfig = cfg;
                    setMsg(turfMsg, 'Saved.', 'ok');
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
        });
    }

    if (zoneAddBtn && zoneInput) {
        function addZone() {
            var name = zoneInput.value.trim();
            if (!name) return;
            if (zones.indexOf(name) === -1) {
                zones.push(name);
                renderZones();
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
                    } else {
                        var err = (data && data.message) ? data.message : 'Save failed.';
                        setMsg(zonesMsg, err, 'err');
                    }
                })
                .catch(function () { setMsg(zonesMsg, 'Network error.', 'err'); })
                .finally(function () { setSaving(zonesSave, false); });
        });
    }

    /* ── Hydrosight integration ───────────────────────────────── */
    var HS_STORAGE_KEY = 'gaip_hydrosight_config' + (siteId ? '_' + siteId : '');

    var hsForm   = document.getElementById('stg-hydrosight-form');
    var hsKeyEl  = document.getElementById('stg-hs-key');
    var hsTest   = document.getElementById('stg-hs-test');
    var hsMsg    = document.getElementById('stg-hs-msg');

    function hsLoad() {
        try {
            var raw = localStorage.getItem(HS_STORAGE_KEY);
            if (raw) {
                var cfg = JSON.parse(raw);
                if (cfg && cfg.apiKey && hsKeyEl) {
                    hsKeyEl.value = cfg.apiKey;
                }
            }
        } catch (e) {}
    }

    function hsSaveKey(key) {
        try {
            var existing = {};
            try { existing = JSON.parse(localStorage.getItem(HS_STORAGE_KEY) || '{}'); } catch (e) {}
            existing.apiKey = key;
            existing.keyConfigured = !!key;
            localStorage.setItem(HS_STORAGE_KEY, JSON.stringify(existing));
            /* also write to legacy global key for backwards compat */
            localStorage.setItem('gaip_hydrosight_config', JSON.stringify(existing));
        } catch (e) {}
    }

    if (hsKeyEl) hsLoad();

    if (hsForm) {
        hsForm.addEventListener('submit', function (e) {
            e.preventDefault();
            var key = hsKeyEl ? hsKeyEl.value.trim() : '';
            hsSaveKey(key);
            setMsg(hsMsg, 'API key saved.', 'ok');
        });
    }

    if (hsTest && hsKeyEl) {
        hsTest.addEventListener('click', function () {
            var key = hsKeyEl.value.trim();
            if (!key) { setMsg(hsMsg, 'Enter an API key first.', 'err'); return; }

            hsTest.disabled = true;
            setMsg(hsMsg, 'Testing…', '');

            apiFetch('POST', '/sensors/hydrosight/proxy', {
                endpoint: '/sites',
                api_key: key,
            })
                .then(function (data) {
                    if (data && data.success) {
                        setMsg(hsMsg, 'Connection successful.', 'ok');
                    } else {
                        var msg = (data && data.data && data.data.message) ? data.data.message : 'Connection failed.';
                        setMsg(hsMsg, msg, 'err');
                    }
                })
                .catch(function () { setMsg(hsMsg, 'Network error.', 'err'); })
                .finally(function () { hsTest.disabled = false; });
        });
    }

    /* ── SpecConnect integration ──────────────────────────────── */
    var SC_STORAGE_KEY = 'gaip_specconnect_config' + (siteId ? '_' + siteId : '');

    var scForm  = document.getElementById('stg-specconnect-form');
    var scKeyEl = document.getElementById('stg-sc-key');
    var scMsg   = document.getElementById('stg-sc-msg');

    function scLoad() {
        try {
            var raw = localStorage.getItem(SC_STORAGE_KEY);
            if (raw) {
                var cfg = JSON.parse(raw);
                if (cfg && cfg.apiKey && scKeyEl) scKeyEl.value = cfg.apiKey;
            }
        } catch (e) {}
    }

    if (scKeyEl) scLoad();

    if (scForm) {
        scForm.addEventListener('submit', function (e) {
            e.preventDefault();
            var key = scKeyEl ? scKeyEl.value.trim() : '';
            try {
                var existing = {};
                try { existing = JSON.parse(localStorage.getItem(SC_STORAGE_KEY) || '{}'); } catch (ex) {}
                existing.apiKey = key;
                localStorage.setItem(SC_STORAGE_KEY, JSON.stringify(existing));
            } catch (ex) {}
            setMsg(scMsg, 'API key saved.', 'ok');
        });
    }

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

    if (impFileInput) {
        impFileInput.addEventListener('change', function () {
            var file = impFileInput.files && impFileInput.files[0];
            if (!file) return;
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
                poaPercent:   t.poaPercent   || '0',
                c3Cover:      t.c3Cover      || '0',
                aaTexture:    t.aaTexture    || '',
            });
            if (loc && typeof loc.lat === 'number') {
                allConfigs[siteId].location = { lat: loc.lat, lon: loc.lon, name: loc.name || '' };
            }
            localStorage.setItem(configsKey, JSON.stringify(allConfigs));
        } catch (_) {}

        // 4. Also update gilba_hub_state (legacy key read by some hub modules)
        try {
            var userId = (window.GAIP_HUB_CONFIG && window.GAIP_HUB_CONFIG.userId) || 'anon';
            var stateKey = 'gilba_hub_state_' + userId;
            var existing = {};
            try { existing = JSON.parse(localStorage.getItem(stateKey) || '{}'); } catch (_) {}
            existing.turf = Object.assign({}, existing.turf || {}, {
                species:      t.species      || '',
                variety:      t.variety      || '',
                turfType:     t.turfType     || '',
                subCategory:  t.subCategory  || '',
                construction: t.construction || '',
                drainage:     t.drainage     || '',
                hoc:          t.hoc          || '',
                nProgram:     t.nProgram     || '',
                methodology:  t.methodology  || '',
                poaPercent:   t.poaPercent   || '0',
                c3Cover:      t.c3Cover      || '0',
            });
            if (loc && typeof loc.lat === 'number') {
                existing.location = { lat: loc.lat, lon: loc.lon, name: loc.name || '' };
            }
            localStorage.setItem(stateKey, JSON.stringify(existing));
        } catch (_) {}

        return Promise.all(tasks);
    }

    if (impRunBtn) {
        impRunBtn.addEventListener('click', function () {
            if (!siteId || !_bundle) return;

            var remapped = remapBundle(_bundle, siteId);
            impRunBtn.disabled = true;
            if (impCancelBtn) impCancelBtn.disabled = true;
            setMsg(impMsg, 'Importing…', '');

            apiFetch('POST', '/samples/sync', { allSites: remapped })
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
