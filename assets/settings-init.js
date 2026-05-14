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
                name:          name,
                location_name: siteForm.querySelector('#stg-location-name').value.trim() || null,
                site_type:     siteForm.querySelector('#stg-site-type').value,
                timezone:      siteForm.querySelector('#stg-timezone').value,
                latitude:      siteForm.querySelector('#stg-latitude').value !== ''
                                   ? parseFloat(siteForm.querySelector('#stg-latitude').value) : null,
                longitude:     siteForm.querySelector('#stg-longitude').value !== ''
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
    var hsSave   = document.getElementById('stg-hs-save');
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
            impSuccessMsg.innerHTML = afterMsg +
                '<br><span style="font-size:12px;opacity:0.75">Re-running analysis…</span>';
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
