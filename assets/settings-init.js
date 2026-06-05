/* settings-init.js — Settings page logic */
(function () {
    'use strict';

    var D = window.STG_DATA || {};
    var siteId   = D.activeSiteId || null;
    var apiBase  = (D.apiBase || '').replace(/\/$/, '');
    var csrf     = D.csrfToken || '';
    var zones    = (D.zones && Array.isArray(D.zones)) ? D.zones.slice() : [];

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
        if (panel) panel.classList.remove('stg-hidden');
    }

    document.querySelectorAll('.stg-tab[data-tab]').forEach(function (tab) {
        tab.addEventListener('click', function () { activateTab(tab.dataset.tab); });
    });

    // Activate tab from URL hash (e.g. /settings#integrations)
    if (location.hash) {
        var hashKey = location.hash.slice(1);
        if (document.querySelector('.stg-tab[data-tab="' + hashKey + '"]')) {
            activateTab(hashKey);
        }
    }

    /* ── Sites tab ───────────────────────────────────────────── */
    (function initSitesTab() {
        var sitesData    = (D.sitesTableData && Array.isArray(D.sitesTableData)) ? D.sitesTableData.slice() : [];
        var tbody        = document.getElementById('stg-sites-tbody');
        var detailPanel  = document.getElementById('stg-site-detail');
        var detailTitle  = document.getElementById('stg-detail-title');
        var detailSub    = document.getElementById('stg-detail-subtitle');
        var detailBody   = document.getElementById('stg-detail-body');
        var detailClose  = document.getElementById('stg-detail-close');
        var addBtn       = document.getElementById('stg-add-site-btn');
        var addForm      = document.getElementById('stg-add-site-form');
        var addNameEl    = document.getElementById('stg-new-site-name');
        var addTypeEl    = document.getElementById('stg-new-site-type');
        var addSaveBtn   = document.getElementById('stg-add-site-save-btn');
        var addCancelBtn = document.getElementById('stg-add-site-cancel-btn');

        if (!tbody) return;

        var sortCol  = 'name', sortDir = 1;
        var openSiteId = null;

        var TYPE_LABELS = { golf: 'Golf', sports: 'Sports', bowls: 'Bowls', lawns: 'Lawns', precinct: 'General' };

        function esc(s) {
            return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
        }

        function fmtLastRun(iso) {
            if (!iso) return '<span class="stg-st-muted">Never</span>';
            var d = new Date(iso), now = new Date();
            var diff = Math.floor((now - d) / 1000);
            var str = diff < 60 ? diff + 's ago' : diff < 3600 ? Math.floor(diff/60) + 'm ago' : diff < 86400 ? Math.floor(diff/3600) + 'h ago' : Math.floor(diff/86400) + 'd ago';
            return '<span title="' + d.toLocaleString() + '">' + str + '</span>';
        }

        function sortData() {
            sitesData.sort(function (a, b) {
                var av = a[sortCol] != null ? a[sortCol] : '', bv = b[sortCol] != null ? b[sortCol] : '';
                if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * sortDir;
                return String(av).localeCompare(String(bv)) * sortDir;
            });
        }

        /* ── Detail panel ── */
        function openDetail(s) {
            openSiteId = s.id;
            if (detailTitle) detailTitle.textContent = s.name;
            if (detailSub)   detailSub.textContent   = (TYPE_LABELS[s.site_type] || s.site_type || 'General') + (s.location ? ' · ' + s.location : '');
            var lastRunFull = s.last_run ? new Date(s.last_run).toLocaleString() : 'Never';
            if (detailBody) detailBody.innerHTML =
                '<div class="dat-metric-grid">' +
                '<div class="dat-metric-card"><div class="stg-detail-label">Location</div><div class="stg-detail-value">' + (s.location ? esc(s.location) : '—') + '</div></div>' +
                '<div class="dat-metric-card"><div class="stg-detail-label">Grass</div><div class="stg-detail-value">' + (s.species ? esc(s.species) : '—') + '</div>' + (s.hoc != null ? '<div class="stg-detail-sub">HOC ' + s.hoc + ' mm</div>' : '') + '</div>' +
                '<div class="dat-metric-card"><div class="stg-detail-label">Soil samples</div><div class="stg-detail-value">' + (s.soil || 0) + '</div></div>' +
                '<div class="dat-metric-card"><div class="stg-detail-label">Water samples</div><div class="stg-detail-value">' + (s.water || 0) + '</div></div>' +
                '</div>' +
                '<div style="font-size:12px;color:var(--gaip-text-muted);margin-bottom:16px">Last analysis run: ' + esc(lastRunFull) + '</div>' +
                (sitesData.length > 1
                    ? '<button type="button" class="stg-detail-delete-btn" data-site-id="' + esc(s.id) + '" style="padding:6px 14px;font-size:12px;font:inherit;font-weight:500;background:transparent;border:1px solid #f5c6c6;border-radius:7px;color:#c0392b;cursor:pointer">Delete this site</button>'
                    : '<span style="font-size:12px;color:var(--gaip-text-muted)">Cannot delete the only site.</span>');
            if (detailPanel) { detailPanel.style.display = ''; detailPanel.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); }
            tbody.querySelectorAll('tr.stg-row-main').forEach(function (r) { r.classList.toggle('stg-row-expanded', r.dataset.siteId === s.id); });
        }

        function closeDetail() {
            openSiteId = null;
            if (detailPanel) detailPanel.style.display = 'none';
            tbody.querySelectorAll('tr.stg-row-main').forEach(function (r) { r.classList.remove('stg-row-expanded'); });
        }

        if (detailClose) detailClose.addEventListener('click', closeDetail);

        /* Delete — delegated from detail body */
        if (detailBody) detailBody.addEventListener('click', function (e) {
            var btn = e.target.closest('.stg-detail-delete-btn');
            if (!btn) return;
            var id = btn.dataset.siteId;
            if (!id) return;
            var site = sitesData.find(function (s) { return s.id === id; });
            if (!confirm('Delete site "' + (site ? site.name : id) + '"? This cannot be undone.')) return;
            fetch(apiBase + '/sites/' + id, {
                method: 'DELETE',
                headers: { 'Accept': 'application/json', 'X-CSRF-TOKEN': csrf },
            }).then(function (r) { return r.ok ? r.json() : r.json().then(function (d) { return Promise.reject(d); }); })
              .then(function () {
                  sitesData = sitesData.filter(function (s) { return s.id !== id; });
                  closeDetail();
                  renderTable();
              }).catch(function (d) { alert((d && d.message) || 'Failed to delete site.'); });
        });

        /* ── Render table ── */
        var STATUS_COLORS = { green: '#16a34a', amber: '#d97706', red: '#dc2626' };

        function statusDotHtml(status) {
            var bg = status ? (STATUS_COLORS[status] || '#9ca3af') : '#d1d5db';
            return '<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:' + bg + ';flex-shrink:0"></span>';
        }

        function renderTable() {
            sortData();
            if (!sitesData.length) {
                tbody.innerHTML = '<tr><td colspan="7" style="padding:20px;text-align:center;color:var(--gaip-text-muted)">No sites yet</td></tr>';
                return;
            }
            tbody.innerHTML = sitesData.map(function (s) {
                var typeLabel  = TYPE_LABELS[s.site_type] || s.site_type || 'General';
                var speciesStr = s.species ? esc(s.species) + (s.hoc != null ? ' <span class="stg-st-muted">· ' + s.hoc + ' mm</span>' : '') : '<span class="stg-st-muted">—</span>';
                var isSelected = openSiteId === s.id;
                var actionCell = s.is_active
                    ? '<td><span style="font-size:12px;font-weight:600;color:var(--gaip-accent,#2da85e)">Active</span></td>'
                    : '<td><button type="button" class="stg-set-active-btn" data-site-id="' + esc(s.id) + '">Set active</button></td>';
                return '<tr class="stg-row-main' + (isSelected ? ' stg-row-expanded' : '') + '" data-site-id="' + esc(s.id) + '">' +
                    '<td><div class="stg-st-name-wrap">' + statusDotHtml(s.status) + '<span class="stg-st-name">' + esc(s.name) + '</span><span class="stg-st-type-badge">' + esc(typeLabel) + '</span></div></td>' +
                    '<td>' + (s.location ? esc(s.location) : '<span class="stg-st-muted">—</span>') + '</td>' +
                    '<td>' + speciesStr + '</td>' +
                    '<td class="dat-td-num">' + (s.soil || 0) + '</td>' +
                    '<td class="dat-td-num">' + (s.water || 0) + '</td>' +
                    '<td>' + fmtLastRun(s.last_run) + '</td>' +
                    actionCell + '</tr>';
            }).join('');
        }

        /* ── Column sort ── */
        document.querySelectorAll('.stg-st-sortable').forEach(function (th) {
            th.addEventListener('click', function () {
                var col = th.dataset.col;
                if (sortCol === col) { sortDir = -sortDir; } else { sortCol = col; sortDir = 1; }
                document.querySelectorAll('.stg-st-sortable').forEach(function (h) { h.classList.remove('sort-asc', 'sort-desc'); });
                th.classList.add(sortDir === 1 ? 'sort-asc' : 'sort-desc');
                renderTable();
            });
        });

        /* ── Row clicks ── */
        tbody.addEventListener('click', function (e) {
            // "Set active" button in row
            var setActiveBtn = e.target.closest('.stg-set-active-btn');
            if (setActiveBtn) {
                e.stopPropagation();
                var id = setActiveBtn.dataset.siteId;
                fetch(apiBase + '/active-site', {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json', 'X-CSRF-TOKEN': csrf },
                    body: JSON.stringify({ site_id: id }),
                }).then(function (r) { return r.ok ? r.json() : Promise.reject(r); })
                  .then(function () { window.location.reload(); })
                  .catch(function () { alert('Failed to set active site.'); });
                return;
            }
            // Row click — toggle detail
            var row = e.target.closest('tr.stg-row-main');
            if (!row) return;
            var id = row.dataset.siteId;
            var site = sitesData.find(function (s) { return s.id === id; });
            if (!site) return;
            if (openSiteId === id) { closeDetail(); } else { openDetail(site); }
        });

        /* ── Add site ── */
        if (addBtn) addBtn.addEventListener('click', function () { addForm.classList.remove('stg-hidden'); if (addNameEl) addNameEl.focus(); });
        if (addCancelBtn) addCancelBtn.addEventListener('click', function () { addForm.classList.add('stg-hidden'); if (addNameEl) addNameEl.value = ''; });
        if (addSaveBtn) addSaveBtn.addEventListener('click', function () {
            var name = addNameEl ? addNameEl.value.trim() : '';
            var type = addTypeEl ? addTypeEl.value : 'precinct';
            if (!name) { if (addNameEl) addNameEl.focus(); return; }
            addSaveBtn.disabled = true;
            fetch(apiBase + '/sites', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Accept': 'application/json', 'X-CSRF-TOKEN': csrf },
                body: JSON.stringify({ name: name, site_type: type }),
            }).then(function (r) { return r.ok ? r.json() : Promise.reject(r); })
              .then(function (resp) {
                  var s = resp.data;
                  sitesData.forEach(function (site) { site.is_active = false; });
                  sitesData.push({ id: s.id, name: s.name, site_type: s.site_type, location: null, species: null, hoc: null, soil: 0, water: 0, last_run: null, is_active: true });
                  addForm.classList.add('stg-hidden');
                  if (addNameEl) addNameEl.value = '';
                  addSaveBtn.disabled = false;
                  renderTable();

                  var prompt = document.getElementById('stg-onboard-prompt');
                  var yesBtn = document.getElementById('stg-onboard-yes');
                  var noBtn  = document.getElementById('stg-onboard-no');
                  if (prompt) { prompt.classList.remove('stg-hidden'); prompt.style.display = 'flex'; }
                  if (yesBtn) { yesBtn.onclick = function () { window.location.href = '/dashboard?setup=1'; }; }
                  if (noBtn)  { noBtn.onclick  = function () { if (prompt) prompt.style.display = 'none'; }; }
              }).catch(function () { addSaveBtn.disabled = false; alert('Failed to create site.'); });
        });

        renderTable();
    })();

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

            cfg.location = Object.assign({}, cfg.location || {}, {
                name:      siteForm.querySelector('#stg-location-name').value.trim() || '',
                elevation: elevEl && elevEl.value !== '' ? parseInt(elevEl.value, 10) : null,
            });

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

    var _overseedGroups = {
        'Warm-season (C4)': ['Couch', 'Bermuda', 'Kikuyu', 'Zoysia', 'Seashore Paspalum', 'Buffalo'],
        'Cool-season (C3)': ['Perennial Ryegrass', 'Annual Ryegrass', 'Tall Fescue', 'Fine Fescue', 'Kentucky Bluegrass', 'Creeping Bentgrass'],
    };

    function getPrimarySpeciesType() {
        if (!turfSpeciesEl || !turfSpeciesEl.value) return null;
        var opt = turfSpeciesEl.options[turfSpeciesEl.selectedIndex];
        if (!opt || !opt.parentNode || opt.parentNode.tagName !== 'OPTGROUP') return null;
        var label = opt.parentNode.label || '';
        if (label.indexOf('C4') !== -1) return 'c4';
        if (label.indexOf('C3') !== -1) return 'c3';
        return null;
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

    if (turfSpeciesEl) {
        var _initVariety = (D.gaipConfig && D.gaipConfig.turf && D.gaipConfig.turf.variety) || 'generic';
        repopulateVariety(turfSpeciesEl.value, _initVariety);
        repopulateOverseedOptions();
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
                poaPercent:     document.getElementById('stg-turf-poa').value || '0',
                c3Cover:        document.getElementById('stg-turf-c3').value || '0',
                // Save under both keys: overseedSpecies (hub persistence layer) and
                // coolOverseed (engine internal name read by hub-tissue-v3, hub-orchestrator, etc.)
                overseedSpecies:  document.getElementById('stg-turf-cool-overseed').value || '',
                coolOverseed:     document.getElementById('stg-turf-cool-overseed').value || '',
                overseedVariety:  document.getElementById('stg-turf-overseed-variety').value || 'generic',
                overseedStatus:   document.getElementById('stg-turf-overseed-status').value || 'none',
                summerIntent:     document.getElementById('stg-turf-summer-intent').value || 'transition',
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
            html += '<div style="padding:10px 0;font-size:12px;color:var(--gaip-text-muted,#6b8878)">No readings cached. Go to Sensor Data to fetch live data.</div>';
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
            var sensorStubs = sensors.map(function (s) {
                return { sensorId: s.sensorId, name: s.name || s.sensorId, vwc: null, ec: null, soilTemp: null };
            });
            lsSet('gilba_sensor_last_fetch', JSON.stringify({
                fetchedAt: new Date().toISOString(), provider: 'Hydrosight', locations: sensorStubs
            }));
            hsSave({ apiKey: apiKey, keyConfigured: true, enabled: true });
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
            html += '<div style="padding:10px 0;font-size:12px;color:var(--gaip-text-muted,#6b8878)">No readings cached. Go to Sensor Data to fetch live data.</div>';
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
                poaPercent:     t.poaPercent     || '0',
                c3Cover:        t.c3Cover        || '0',
                warmBase:       t.warmBase       || '',
                coolOverseed:   t.coolOverseed   || '',
                overseedStatus: t.overseedStatus || 'none',
                aaTexture:      t.aaTexture      || '',
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
                poaPercent:     t.poaPercent     || '0',
                c3Cover:        t.c3Cover        || '0',
                warmBase:       t.warmBase       || '',
                coolOverseed:   t.coolOverseed   || '',
                overseedStatus: t.overseedStatus || 'none',
            });
            if (loc && typeof loc.lat === 'number') {
                existing.location = { lat: loc.lat, lon: loc.lon, name: loc.name || '' };
            }
            localStorage.setItem(stateKey, JSON.stringify(existing));
        } catch (_) {}

        return Promise.all(tasks);
    }

    /* ── Users tab ───────────────────────────────────────────────── */
    (function initUsersTab() {
        var D = window.STG_DATA || {};
        var isAdmin = D.activeSiteRole === 'admin';

        var utabBtns       = document.querySelectorAll('[data-utab]');
        var activePanel    = document.getElementById('users-active-panel');
        var pendingPanel   = document.getElementById('users-pending-panel');
        var suspendedPanel = document.getElementById('users-suspended-panel');
        var tbody          = document.getElementById('users-tbody');
        var pendingTbody   = document.getElementById('users-pending-tbody');
        var suspendedTbody = document.getElementById('users-suspended-tbody');
        var invitationsTbody   = document.getElementById('users-invitations-tbody');
        var invitationsSection = document.getElementById('users-invitations-section');
        var emptyState     = document.getElementById('users-empty');
        var inviteBtn      = document.getElementById('users-invite-btn');
        var inviteEmptyBtn = document.getElementById('users-invite-empty-btn');
        var inviteModal    = document.getElementById('users-invite-modal');
        var inviteClose    = document.getElementById('invite-modal-close');
        var inviteCancelBtn = document.getElementById('invite-cancel-btn');
        var inviteSubmitBtn = document.getElementById('invite-submit-btn');
        var inviteError    = document.getElementById('invite-modal-error');
        var inviteNameInput  = document.getElementById('invite-name');
        var inviteEmailInput = document.getElementById('invite-email');
        var inviteSiteSelect = document.getElementById('invite-site');
        var searchInput    = document.getElementById('users-search');
        var siteFilter     = document.getElementById('users-site-filter');
        var roleFilter     = document.getElementById('users-role-filter');
        var pendingCountEl = document.getElementById('users-pending-count');

        var _members = [], _pending = [], _suspended = [], _invitations = [];

        function showInviteError(msg) {
            if (!inviteError) return;
            inviteError.textContent = msg;
            inviteError.style.display = msg ? '' : 'none';
        }

        function switchUtab(tab) {
            utabBtns.forEach(function (b) {
                b.classList.toggle('active', b.dataset.utab === tab);
            });
            if (activePanel)    activePanel.style.display    = (tab === 'active')    ? '' : 'none';
            if (pendingPanel)   pendingPanel.style.display   = (tab === 'pending')   ? '' : 'none';
            if (suspendedPanel) suspendedPanel.style.display = (tab === 'suspended') ? '' : 'none';
        }

        utabBtns.forEach(function (b) {
            b.addEventListener('click', function () { switchUtab(b.dataset.utab); });
        });

        function roleLabel(role) {
            var map = { manager: 'Manager', editor: 'Editor', viewer: 'Viewer' };
            return map[role] || role;
        }

        function getSearchQuery() {
            var q = searchInput ? searchInput.value.toLowerCase() : '';
            var rf = roleFilter ? roleFilter.value : '';
            var sf = siteFilter ? siteFilter.value : '';
            return { q: q, role: rf, site: sf };
        }

        function renderMemberRow(u) {
            var isSelf = u.email === D.userEmail;
            var canEdit = !isSelf;
            var roleOptions = ['manager', 'editor', 'viewer'].map(function (r) {
                return '<option value="' + r + '"' + (u.role === r ? ' selected' : '') + '>' + roleLabel(r) + '</option>';
            }).join('');
            var siteCol = isAdmin ? ('<td>' + escHtml(u.site_name || '') + '</td>') : '';
            var actions = canEdit && u.site_id
                ? '<button class="stg-btn-ghost remove-site-btn" style="font-size:12px;padding:3px 8px" data-site-id="' + u.site_id + '">Remove</button>' +
                  (isAdmin ? ' <button class="stg-btn-ghost suspend-btn" style="font-size:12px;padding:3px 8px;color:#dc2626">Suspend</button>' : '')
                : '';
            return '<tr data-user-id="' + u.id + '">' +
                '<td>' + escHtml(u.name || '') + '</td>' +
                '<td>' + escHtml(u.email) + '</td>' +
                siteCol +
                '<td>' +
                    (canEdit && u.site_id
                        ? '<select class="stg-select role-select" style="font-size:13px;padding:4px 8px" data-site-id="' + u.site_id + '">' + roleOptions + '</select>'
                        : '<span>' + roleLabel(u.role) + '</span>') +
                '</td>' +
                '<td style="white-space:nowrap">' + actions + '</td>' +
                '</tr>';
        }

        function applyFilters(list) {
            var f = getSearchQuery();
            return list.filter(function (u) {
                if (f.q && !(u.name || '').toLowerCase().includes(f.q) && !u.email.toLowerCase().includes(f.q)) return false;
                if (f.role && u.role !== f.role) return false;
                if (f.site && u.site_id !== f.site) return false;
                return true;
            });
        }

        function renderMembers() {
            if (!tbody) return;
            var filtered = applyFilters(_members);
            var colspan = isAdmin ? 5 : 4;
            if (emptyState) emptyState.style.display = (!_members.length) ? '' : 'none';
            if (!filtered.length) {
                tbody.innerHTML = '<tr><td colspan="' + colspan + '" style="color:#6b8878;padding:16px 0">No members found.</td></tr>';
                return;
            }
            tbody.innerHTML = filtered.map(renderMemberRow).join('');
        }

        function renderInvitations() {
            if (!invitationsTbody) return;
            var inv = _invitations;
            if (!inv.length) {
                if (invitationsSection) invitationsSection.style.display = 'none';
                return;
            }
            if (invitationsSection) invitationsSection.style.display = '';
            invitationsTbody.innerHTML = inv.map(function (i) {
                return '<tr data-inv-id="' + i.id + '">' +
                    '<td>' + escHtml(i.name || '') + '</td>' +
                    '<td>' + escHtml(i.email) + '</td>' +
                    (isAdmin ? '<td>' + escHtml(i.site_name || '') + '</td>' : '') +
                    '<td>' + roleLabel(i.role) + '</td>' +
                    '<td><button class="stg-btn-ghost cancel-invite-btn" style="font-size:12px;padding:3px 8px">Cancel</button></td>' +
                    '</tr>';
            }).join('');
        }

        function renderPending() {
            if (!pendingTbody) return;
            if (!_pending.length) {
                pendingTbody.innerHTML = '<tr><td colspan="4" style="color:#6b8878;padding:16px 0">No pending registrations.</td></tr>';
                return;
            }
            pendingTbody.innerHTML = _pending.map(function (u) {
                return '<tr data-user-id="' + u.id + '">' +
                    '<td>' + escHtml(u.name || '') + '</td>' +
                    '<td>' + escHtml(u.email) + '</td>' +
                    '<td>' + (u.created_at || '') + '</td>' +
                    '<td style="white-space:nowrap">' +
                        '<button class="stg-btn-primary approve-btn" style="font-size:12px;padding:4px 10px;margin-right:6px">Approve</button>' +
                        '<button class="stg-btn-ghost delete-btn" style="font-size:12px;padding:4px 10px;color:#dc2626">Delete</button>' +
                    '</td>' +
                    '</tr>';
            }).join('');
        }

        function renderSuspended() {
            if (!suspendedTbody) return;
            if (!_suspended.length) {
                suspendedTbody.innerHTML = '<tr><td colspan="3" style="color:#6b8878;padding:16px 0">No suspended accounts.</td></tr>';
                return;
            }
            suspendedTbody.innerHTML = _suspended.map(function (u) {
                return '<tr data-user-id="' + u.id + '">' +
                    '<td>' + escHtml(u.name || '') + '</td>' +
                    '<td>' + escHtml(u.email) + '</td>' +
                    '<td style="white-space:nowrap">' +
                        '<button class="stg-btn-ghost unsuspend-btn" style="font-size:12px;padding:4px 10px;margin-right:6px">Restore</button>' +
                        '<button class="stg-btn-ghost delete-btn" style="font-size:12px;padding:4px 10px;color:#dc2626">Delete</button>' +
                    '</td>' +
                    '</tr>';
            }).join('');
        }

        function populateSiteFilterAndSelect(sites) {
            if (siteFilter) {
                siteFilter.innerHTML = '<option value="">All sites</option>' +
                    sites.map(function (s) { return '<option value="' + s.id + '">' + escHtml(s.name) + '</option>'; }).join('');
            }
            if (inviteSiteSelect) {
                inviteSiteSelect.innerHTML = '<option value="">Select site…</option>' +
                    sites.map(function (s) { return '<option value="' + s.id + '">' + escHtml(s.name) + '</option>'; }).join('');
            }
        }

        function loadUsers() {
            apiFetch('GET', '/users').then(function (data) {
                _members     = (data && data.members)     || [];
                _pending     = (data && data.pending)     || [];
                _suspended   = (data && data.suspended)   || [];
                _invitations = (data && data.invitations) || [];

                if (data && data.all_sites) populateSiteFilterAndSelect(data.all_sites);

                renderMembers();
                renderInvitations();
                renderPending();
                renderSuspended();

                if (pendingCountEl) {
                    pendingCountEl.textContent = _pending.length;
                    pendingCountEl.style.display = _pending.length ? '' : 'none';
                }
            }).catch(function () {});
        }

        if (searchInput) searchInput.addEventListener('input', renderMembers);
        if (roleFilter)  roleFilter.addEventListener('change', renderMembers);
        if (siteFilter)  siteFilter.addEventListener('change', renderMembers);

        // Delegated: members table
        if (tbody) {
            tbody.addEventListener('click', function (e) {
                var row = e.target.closest('tr[data-user-id]');
                if (!row) return;
                var userId = row.dataset.userId;

                if (e.target.classList.contains('remove-site-btn')) {
                    var sid = e.target.dataset.siteId;
                    if (!confirm('Remove this user from the site?')) return;
                    apiFetch('DELETE', '/users/' + userId + '/site/' + sid)
                        .then(loadUsers).catch(function () { alert('Failed to remove user.'); });
                }
                if (e.target.classList.contains('suspend-btn')) {
                    if (!confirm('Suspend this user? They will be logged out immediately.')) return;
                    apiFetch('PATCH', '/users/' + userId + '/suspend')
                        .then(loadUsers).catch(function () { alert('Failed to suspend user.'); });
                }
            });
            tbody.addEventListener('change', function (e) {
                if (!e.target.classList.contains('role-select')) return;
                var row = e.target.closest('tr[data-user-id]');
                if (!row) return;
                var userId = row.dataset.userId;
                var sid = e.target.dataset.siteId;
                apiFetch('PATCH', '/users/' + userId + '/role', { site_id: sid, role: e.target.value })
                    .catch(function () { alert('Failed to update role.'); loadUsers(); });
            });
        }

        // Delegated: invitations
        if (invitationsTbody) {
            invitationsTbody.addEventListener('click', function (e) {
                if (!e.target.classList.contains('cancel-invite-btn')) return;
                var row = e.target.closest('tr[data-inv-id]');
                if (!row) return;
                var invId = row.dataset.invId;
                apiFetch('DELETE', '/invitations/' + invId)
                    .then(loadUsers).catch(function () { alert('Failed to cancel invitation.'); });
            });
        }

        // Delegated: pending
        if (pendingTbody) {
            pendingTbody.addEventListener('click', function (e) {
                var row = e.target.closest('tr[data-user-id]');
                if (!row) return;
                var userId = row.dataset.userId;
                if (e.target.classList.contains('approve-btn')) {
                    apiFetch('PATCH', '/users/' + userId + '/approve')
                        .then(loadUsers).catch(function () { alert('Failed to approve user.'); });
                } else if (e.target.classList.contains('delete-btn')) {
                    if (!confirm('Delete this user?')) return;
                    apiFetch('DELETE', '/users/' + userId)
                        .then(loadUsers).catch(function () { alert('Failed to delete user.'); });
                }
            });
        }

        // Delegated: suspended
        if (suspendedTbody) {
            suspendedTbody.addEventListener('click', function (e) {
                var row = e.target.closest('tr[data-user-id]');
                if (!row) return;
                var userId = row.dataset.userId;
                if (e.target.classList.contains('unsuspend-btn')) {
                    apiFetch('PATCH', '/users/' + userId + '/unsuspend')
                        .then(loadUsers).catch(function () { alert('Failed to restore user.'); });
                } else if (e.target.classList.contains('delete-btn')) {
                    if (!confirm('Delete this user?')) return;
                    apiFetch('DELETE', '/users/' + userId)
                        .then(loadUsers).catch(function () { alert('Failed to delete user.'); });
                }
            });
        }

        // Invite modal
        function openInviteModal() {
            if (!inviteModal) return;
            if (inviteNameInput)  inviteNameInput.value  = '';
            if (inviteEmailInput) inviteEmailInput.value = '';
            var defaultRole = inviteModal.querySelector('[name="invite-role"][value="editor"]');
            if (defaultRole) defaultRole.checked = true;
            showInviteError('');
            inviteModal.style.display = 'flex';
        }
        function closeInviteModal() {
            if (inviteModal) inviteModal.style.display = 'none';
        }

        if (inviteBtn)      inviteBtn.addEventListener('click', openInviteModal);
        if (inviteEmptyBtn) inviteEmptyBtn.addEventListener('click', openInviteModal);
        if (inviteClose)    inviteClose.addEventListener('click', closeInviteModal);
        if (inviteCancelBtn) inviteCancelBtn.addEventListener('click', closeInviteModal);
        if (inviteModal) {
            inviteModal.addEventListener('click', function (e) {
                if (e.target === inviteModal) closeInviteModal();
            });
        }

        if (inviteSubmitBtn) {
            inviteSubmitBtn.addEventListener('click', function () {
                var name  = inviteNameInput  ? inviteNameInput.value.trim()  : '';
                var email = inviteEmailInput ? inviteEmailInput.value.trim() : '';
                var roleEl = inviteModal ? inviteModal.querySelector('[name="invite-role"]:checked') : null;
                var role  = roleEl ? roleEl.value : 'editor';
                var sid   = inviteSiteSelect ? inviteSiteSelect.value : (D.activeSiteId || '');

                if (!email) { showInviteError('Email is required.'); return; }

                inviteSubmitBtn.disabled = true;
                showInviteError('');

                apiFetch('POST', '/invitations', { name: name || null, email: email, role: role, site_id: sid })
                    .then(function () {
                        loadUsers();
                        closeInviteModal();
                    })
                    .catch(function (err) {
                        showInviteError((err && err.message) || 'Failed to send invitation.');
                    })
                    .finally(function () {
                        inviteSubmitBtn.disabled = false;
                    });
            });
        }

        // Load on tab show
        var usersTabTrigger = document.querySelector('[data-tab="users"]');
        if (usersTabTrigger) {
            usersTabTrigger.addEventListener('click', loadUsers);
        }
        if (document.querySelector('[data-tab="users"].active') || document.querySelector('#stg-tab-users:not(.stg-hidden)')) {
            loadUsers();
        }
    }());

    /* ── Profile tab ─────────────────────────────────────────────── */
    (function initProfileTab() {
        var D = window.STG_DATA || {};

        var profileNameInput = document.getElementById('profile-name');
        var profileNameSave  = document.getElementById('profile-name-save');
        var profileNameMsg   = document.getElementById('profile-name-msg');

        var pwdModal       = document.getElementById('password-modal');
        var pwdModalClose  = document.getElementById('pw-modal-close');
        var pwdCancelBtn   = document.getElementById('pw-cancel-btn');
        var pwdSubmitBtn   = document.getElementById('pw-submit-btn');
        var pwdCurrentField = document.getElementById('pw-current-field');
        var pwdCurrentInput = document.getElementById('pw-current');
        var pwdNewInput     = document.getElementById('pw-new');
        var pwdConfirmInput = document.getElementById('pw-confirm');
        var pwdError        = document.getElementById('pw-modal-error');
        var pwdSuccess      = document.getElementById('pw-modal-success');
        var pwdTitle        = document.getElementById('pw-modal-title');
        var pwdForgotLink   = document.getElementById('pw-forgot-link');
        var setPwdBtn       = document.getElementById('set-password-btn');
        var changePwdBtn    = document.getElementById('change-password-btn');

        function showNameMsg(text, ok) {
            if (!profileNameMsg) return;
            profileNameMsg.textContent = text;
            profileNameMsg.style.color = ok ? '#2da85e' : '#dc2626';
            profileNameMsg.style.display = text ? '' : 'none';
        }

        function showPwdMsg(errText, okText) {
            if (pwdError)   { pwdError.textContent = errText || ''; pwdError.style.display = errText ? '' : 'none'; }
            if (pwdSuccess) { pwdSuccess.textContent = okText || ''; pwdSuccess.style.display = okText ? '' : 'none'; }
        }

        if (profileNameSave) {
            profileNameSave.addEventListener('click', function () {
                var name = profileNameInput ? profileNameInput.value.trim() : '';
                if (!name) { showNameMsg('Name cannot be empty.', false); return; }
                profileNameSave.disabled = true;
                showNameMsg('', false);
                apiFetch('PATCH', '/profile', { name: name })
                    .then(function () { showNameMsg('Saved.', true); })
                    .catch(function (err) { showNameMsg((err && err.message) || 'Failed to save.', false); })
                    .finally(function () { profileNameSave.disabled = false; });
            });
        }

        function openPwdModal(hasPassword) {
            if (!pwdModal) return;
            if (pwdCurrentInput) pwdCurrentInput.value = '';
            if (pwdNewInput)     pwdNewInput.value     = '';
            if (pwdConfirmInput) pwdConfirmInput.value = '';
            showPwdMsg('', '');
            if (pwdCurrentField) pwdCurrentField.style.display = hasPassword ? '' : 'none';
            if (pwdTitle) pwdTitle.textContent = hasPassword ? 'Change password' : 'Set password';
            pwdModal.style.display = 'flex';
        }
        function closePwdModal() {
            if (pwdModal) pwdModal.style.display = 'none';
        }

        if (setPwdBtn)    setPwdBtn.addEventListener('click',    function () { openPwdModal(false); });
        if (changePwdBtn) changePwdBtn.addEventListener('click', function () { openPwdModal(true); });
        if (pwdModalClose) pwdModalClose.addEventListener('click', closePwdModal);
        if (pwdCancelBtn)  pwdCancelBtn.addEventListener('click', closePwdModal);
        if (pwdModal) {
            pwdModal.addEventListener('click', function (e) {
                if (e.target === pwdModal) closePwdModal();
            });
        }

        if (pwdSubmitBtn) {
            pwdSubmitBtn.addEventListener('click', function () {
                var current = pwdCurrentInput ? pwdCurrentInput.value : '';
                var newPwd  = pwdNewInput     ? pwdNewInput.value     : '';
                var confirm = pwdConfirmInput ? pwdConfirmInput.value : '';

                if (newPwd.length < 8) { showPwdMsg('Password must be at least 8 characters.', ''); return; }
                if (newPwd !== confirm) { showPwdMsg('Passwords do not match.', ''); return; }

                pwdSubmitBtn.disabled = true;
                showPwdMsg('', '');

                apiFetch('POST', '/profile/password', { current_password: current || null, password: newPwd, password_confirmation: confirm })
                    .then(function () {
                        showPwdMsg('', 'Password saved successfully.');
                        setTimeout(closePwdModal, 1400);
                    })
                    .catch(function (err) { showPwdMsg((err && err.message) || 'Failed to set password.', ''); })
                    .finally(function () { pwdSubmitBtn.disabled = false; });
            });
        }

        if (pwdForgotLink) {
            pwdForgotLink.addEventListener('click', function (e) {
                e.preventDefault();
                var email = D.userEmail || '';
                if (!email) return;
                apiFetch('POST', '/login/magic', { email: email, password_reset: true })
                    .then(function () { showPwdMsg('', 'Magic link sent to ' + email + '. Check your inbox.'); })
                    .catch(function () { showPwdMsg('Failed to send link.', ''); });
            });
        }

        if (D.openPasswordModal) {
            openPwdModal(D.hasPassword);
        }
    }());

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
