/**
 * ============================================================================
 * GAIP FIELD LOG v1.0.0
 * ============================================================================
 *
 * Mobile-first field data capture for the [gaip_field_log] shortcode page.
 *
 * OBSERVATION TYPES:
 *   spray       — log a product application
 *   disease     — disease symptom observation (type, location, severity, photo)
 *   tdr         — manual TDR / soil moisture reading
 *   mowing      — mowing height and/or clipping yield
 *   note        — general field note with optional photo
 *
 * STORAGE:
 *   All observations save directly to MySQL through REST.
 *   Spray entries also mirror into the dedicated spray-log endpoint.
 *
 * OFFLINE:
 *   No browser database is used for persistence. If the server request fails,
 *   the save fails and nothing is stored locally.
 *
 * ANALYSIS:
 *   On load, triggers a lightweight weather fetch + engine run via the Hub's
 *   existing GaipOrchestrator (gilba-hub-v2.js). Reads GAIP_DISEASE_RESULT,
 *   GAIP_PGR_RESULT, GAIP_CLIMATE_STRESS_RESULT for the status tiles.
 *   If GaipOrchestrator is not present (standalone page load without full hub
 *   assets), tiles show cached values from localStorage or a placeholder.
 *
 * PHOTO UPLOAD:
 *   Uses browser native <input type="file" accept="image/*" capture="environment">
 *   which triggers camera on mobile. On save, uploads to WP media library via
 *   POST /wp/v2/media (core REST, no plugin needed). Attachment ID is stored
 *   with the MySQL-backed observation payload.
 *
 * CONFIG:
 *   Reads window.GAIP_HUB_CONFIG for restUrl, restNonce, ajaxUrl, userId.
 *   Falls back to window.GAIP_FIELD_LOG_CONFIG if shortcode passes separate config.
 *
 * ============================================================================
 */

(function (global) {
    'use strict';

    // =========================================================================
    // CONFIG
    // =========================================================================

    var VERSION = '1.1.0'; // b35fix97 — server site fetch on init + localStorage injection on site switch

    // Namespaced localStorage shim — isolates keys per plugin instance (GAIP vs GSSH).
    var _ls = (window.GilbaStorageNS && window.GilbaStorageNS.get) ? window.GilbaStorageNS.get() : localStorage;

    var cfg = global.GAIP_FIELD_LOG_CONFIG || global.GAIP_HUB_CONFIG || {};
    var REST_URL    = (cfg.restUrl    || '/wp-json/gilba/v1/').replace(/\/$/, '');
    var WP_REST_URL = (cfg.wpRestUrl  || '/wp-json/wp/v2');
    var REST_NONCE  = cfg.restNonce   || '';
    var USER_ID     = cfg.userId      || 0;

    // =========================================================================
    // LOGGING
    // =========================================================================

    function log() {
        var args = Array.prototype.slice.call(arguments);
        args.unshift('[FieldLog]');
        console.log.apply(console, args);
    }

    function warn() {
        var args = Array.prototype.slice.call(arguments);
        args.unshift('[FieldLog WARN]');
        console.warn.apply(console, args);
    }

    // =========================================================================
    // UUID
    // =========================================================================

    function uuid() {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
            var r = Math.random() * 16 | 0;
            var v = c === 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    }

    // =========================================================================
    // FIELD LOG REST API
    // =========================================================================

    function parseApiError(res) {
        return res.json().catch(function () { return {}; }).then(function (err) {
            throw new Error(err.message || (err.data && err.data.message) || ('REST error ' + res.status));
        });
    }

    var FieldLogAPI = {

        list: function (siteId, limit) {
            var qs = new URLSearchParams();
            qs.append('site_id', siteId);
            qs.append('limit', String(limit || 20));

            return fetch(REST_URL + '/field-log/entries?' + qs.toString(), {
                method: 'GET',
                headers: {
                    'X-WP-Nonce': REST_NONCE
                }
            }).then(function (res) {
                if (!res.ok) { return parseApiError(res); }
                return res.json();
            }).then(function (json) {
                return json && Array.isArray(json.data) ? json.data : [];
            });
        },

        post: function (payload) {
            return fetch(REST_URL + '/field-log/entries', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-WP-Nonce': REST_NONCE
                },
                body: JSON.stringify(payload)
            }).then(function (res) {
                if (!res.ok) { return parseApiError(res); }
                return res.json();
            });
        }
    };

    // =========================================================================
    // SPRAY REST API
    // =========================================================================

    var SprayAPI = {

        post: function (payload) {
            return fetch(REST_URL + '/spray-log', {
                method:  'POST',
                headers: {
                    'Content-Type':    'application/json',
                    'X-WP-Nonce':      REST_NONCE
                },
                body: JSON.stringify(payload)
            }).then(function (res) {
                if (!res.ok) { return parseApiError(res); }
                return res.json();
            });
        }
    };

    // =========================================================================
    // SITE LOADER  (b35fix97)
    // =========================================================================
    //
    // Fetches the canonical site list from the server (wp_ajax_gilba_sites_load)
    // and injects it into the _ls 'gilba_samples' blob so that all Hub modules
    // — including gaip-field-log — read the same data source.
    //
    // Called once at init.  Returns a Promise that resolves to the site list
    // array ([{ id, label }]) regardless of success/failure.
    //
    // On site switch (renderSiteSelector change handler) we call
    // SiteLoader.setActive(siteId) to keep gilba_samples.currentSite in sync.
    // =========================================================================

    var SiteLoader = {

        /**
         * Fetch site list from server and inject into localStorage.
         * Returns Promise<Array<{id:string, label:string}>>
         */
        fetchAndInject: function () {
            var ajaxUrl = cfg.ajaxUrl || '/wp-admin/admin-ajax.php';
            var nonce   = cfg.nonce   || cfg.restNonce || '';

            if (!ajaxUrl || !nonce) {
                warn('SiteLoader: no ajaxUrl/nonce — skipping server fetch');
                return Promise.resolve(SiteLoader._fromStorage());
            }

            var body = new URLSearchParams();
            body.append('action', 'gilba_sites_load');
            body.append('nonce',  nonce);

            return fetch(ajaxUrl, {
                method:  'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body:    body.toString()
            })
            .then(function (res) {
                if (!res.ok) { throw new Error('HTTP ' + res.status); }
                return res.json();
            })
            .then(function (json) {
                if (!json.success || !json.data || !json.data.sites) {
                    throw new Error(json.data && json.data.message ? json.data.message : 'Bad response');
                }

                var serverSites = json.data.sites; // { siteId: { label, createdAt } }
                SiteLoader._injectIntoStorage(serverSites);

                var list = Object.keys(serverSites).map(function (id) {
                    return { id: id, label: serverSites[id].label || id };
                });

                log('SiteLoader: injected', list.length, 'sites from server');
                return list.length ? list : [{ id: 'default', label: 'Default Site' }];
            })
            .catch(function (err) {
                warn('SiteLoader: server fetch failed (' + err.message + ') — using localStorage fallback');
                return SiteLoader._fromStorage();
            });
        },

        /**
         * Write server sites into the gilba_samples blob in localStorage,
         * preserving currentSite and any sample data already there.
         * @param {Object} serverSites  { siteId: { label, createdAt } }
         */
        _injectIntoStorage: function (serverSites) {
            try {
                var existing = {};
                var raw = _ls.getItem('gilba_samples');
                if (raw) { existing = JSON.parse(raw); }

                // Merge: server is authoritative for site metadata; keep existing
                // currentSite if it still exists in the new list, otherwise reset.
                var merged = Object.assign({}, existing, { sites: serverSites });

                if (merged.currentSite && !serverSites[merged.currentSite]) {
                    // Previously active site was deleted server-side — reset
                    var keys = Object.keys(serverSites);
                    merged.currentSite = keys.length ? keys[0] : 'default';
                    warn('SiteLoader: previous active site gone — reset to', merged.currentSite);
                }

                _ls.setItem('gilba_samples', JSON.stringify(merged));
            } catch (e) {
                warn('SiteLoader: localStorage write failed:', e.message);
            }
        },

        /**
         * Update gilba_samples.currentSite in localStorage when the user
         * switches site in the field-log selector.
         * @param {string} siteId
         */
        setActive: function (siteId) {
            try {
                var raw  = _ls.getItem('gilba_samples');
                var data = raw ? JSON.parse(raw) : {};
                data.currentSite = siteId;
                _ls.setItem('gilba_samples', JSON.stringify(data));
                log('SiteLoader: currentSite set to', siteId);
            } catch (e) {
                warn('SiteLoader: could not persist active site:', e.message);
            }
        },

        /**
         * Read site list directly from localStorage (fallback path).
         * @returns {Array<{id:string, label:string}>}
         */
        _fromStorage: function () {
            try {
                var raw = _ls.getItem('gilba_samples');
                if (raw) {
                    var data  = JSON.parse(raw);
                    var sites = data.sites || {};
                    var keys  = Object.keys(sites);
                    if (keys.length) {
                        return keys.map(function (id) {
                            return { id: id, label: sites[id].label || id };
                        });
                    }
                }
            } catch (e) { /* silent */ }
            return [{ id: 'default', label: 'Default Site' }];
        }
    };

    // =========================================================================
    // PHOTO UPLOAD
    // =========================================================================

    var PhotoUpload = {

        // Returns Promise<attachmentId|null>
        // If offline, returns null and caller stores base64 for later
        upload: function (file, title) {
            if (!navigator.onLine) { return Promise.resolve(null); }

            var formData = new FormData();
            formData.append('file', file, file.name);
            if (title) { formData.append('title', title); }

            return fetch(WP_REST_URL + '/media', {
                method:  'POST',
                headers: { 'X-WP-Nonce': REST_NONCE },
                body:    formData
            }).then(function (res) {
                if (!res.ok) { throw new Error('Media upload failed: ' + res.status); }
                return res.json();
            }).then(function (data) {
                return data.id || null;
            }).catch(function (err) {
                warn('Photo upload failed:', err.message);
                return null;
            });
        },

        // Read file as base64 for offline storage
        toBase64: function (file) {
            return new Promise(function (resolve, reject) {
                var reader = new FileReader();
                reader.onload  = function () { resolve(reader.result); };
                reader.onerror = function () { reject(reader.error); };
                reader.readAsDataURL(file);
            });
        }
    };

    // =========================================================================
    // SITE LIST  (from GAIP_SampleManager or localStorage fallback)
    // =========================================================================

    function getSiteList() {
        // Try live SampleManager first (loaded as dependency)
        if (global.GAIP_SampleManager && typeof global.GAIP_SampleManager.getSiteList === 'function') {
            return global.GAIP_SampleManager.getSiteList();
        }

        // Fallback: read gilba_samples directly from localStorage
        // Structure: { sites: { siteId: { label, createdAt } }, currentSite, ... }
        try {
            var raw = _ls.getItem('gilba_samples');
            if (raw) {
                var data   = JSON.parse(raw);
                var sites  = data.sites || {};
                var keys   = Object.keys(sites);
                if (keys.length) {
                    return keys.map(function (id) {
                        return { id: id, label: sites[id].label || id };
                    });
                }
            }
        } catch (e) {
            warn('Could not read site list from localStorage:', e.message);
        }

        return [{ id: 'default', label: 'Default Site' }];
    }

    function getActiveSiteId() {
        if (global.GAIP_SampleManager && typeof global.GAIP_SampleManager.getActiveSiteId === 'function') {
            return global.GAIP_SampleManager.getActiveSiteId();
        }
        // Read currentSite from gilba_samples blob
        try {
            var raw = _ls.getItem('gilba_samples');
            if (raw) {
                var data = JSON.parse(raw);
                if (data.currentSite) { return data.currentSite; }
            }
        } catch (e) { /* silent */ }
        return 'default';
    }

    // =========================================================================
    // STATUS TILES  (lightweight engine result read)
    // =========================================================================

    function getStatusTiles() {
        var tiles = {
            disease:  { label: 'Disease Risk',    value: '--',   level: 'none'    },
            stress:   { label: 'Growth Potential', value: '--',   level: 'none'    },
            pgr:      { label: 'PGR Status',      value: '--',   level: 'none'    }
        };

        // Disease
        try {
            var dis = global.GAIP_DISEASE_RESULT;
            if (dis && dis.diseases) {
                var topRisk = 0;
                var topName = '';
                dis.diseases.forEach(function (d) {
                    var r = d.adjustedRisk || d.riskScore || 0;
                    if (r > topRisk) { topRisk = r; topName = d.displayName || d.disease || ''; }
                });
                tiles.disease.value = topRisk + '%';
                tiles.disease.name  = topName;
                tiles.disease.level = topRisk >= 70 ? 'high' : topRisk >= 40 ? 'medium' : 'low';
                // Cache age note — shown when serving stale data while background refresh runs
                if (dis._cacheAge) {
                    var ageHrs = dis._cacheAge / 3600000;
                    if (ageHrs >= 1) {
                        tiles.disease.cacheNote = dis._cacheStale
                            ? Math.round(ageHrs) + 'h ago — refreshing…'
                            : Math.round(ageHrs) + 'h ago';
                    }
                }
            }
        } catch (e) { /* silent */ }

        // Stress
        try {
            var str = global.GAIP_CLIMATE_STRESS_RESULT;
            if (str) {
                var gp = str.growthPotential || str.gp || (str.c3 || str.c4) || null;
                if (gp !== null) {
                    var gpPct = Math.round(gp * 100);
                    tiles.stress.value = gpPct + '%';
                    // GP colouring: high GP (≥70%) = good/green, low GP (<40%) = concern/red
                    tiles.stress.level = gpPct < 40 ? 'high' : gpPct < 70 ? 'medium' : 'low';
                }
            }
        } catch (e) { /* silent */ }

        // PGR
        try {
            var pgr = global.GAIP_PGR_RESULT;
            if (pgr && pgr.success) {
                var pct = (pgr.effect && pgr.effect.suppressionPct) || 0;
                tiles.pgr.value = pct + '%';
                tiles.pgr.name  = (pgr.product && pgr.product.name) || '';
                tiles.pgr.level = pct >= 40 ? 'high' : pct >= 20 ? 'medium' : 'low';
            }
        } catch (e) { /* silent */ }

        return tiles;
    }

    // =========================================================================
    // TOAST
    // =========================================================================

    function showToast(msg, isError) {
        var existing = document.getElementById('gaip-fl-toast');
        if (existing) { existing.remove(); }

        var t = document.createElement('div');
        t.id = 'gaip-fl-toast';
        t.className = 'gaip-fl-toast' + (isError ? ' gaip-fl-toast--error' : '');
        t.textContent = msg;
        document.body.appendChild(t);

        setTimeout(function () { t.classList.add('gaip-fl-toast--visible'); }, 10);
        setTimeout(function () {
            t.classList.remove('gaip-fl-toast--visible');
            setTimeout(function () { t.remove(); }, 300);
        }, 3000);
    }

    // =========================================================================
    // UI STATE
    // =========================================================================

    var _state = {
        activeSiteId:   '',
        activeType:     'spray',   // spray | disease | tdr | mowing | note
        photoFile:      null,
        photoBase64:    null,
        saving:         false
    };

    // =========================================================================
    // RENDER HELPERS
    // =========================================================================

    function el(id) { return document.getElementById(id); }

    // siteList is optional — supplied by init() after SiteLoader.fetchAndInject resolves.
    // If omitted, falls back to getSiteList() (localStorage / SampleManager).
    function renderSiteSelector(container, siteList) {
        var sites  = siteList || getSiteList();
        var active = getActiveSiteId();
        _state.activeSiteId = active;

        var html = '<select id="gaip-fl-site" class="gaip-fl-select gaip-fl-select--site" aria-label="Active site">';
        sites.forEach(function (s) {
            html += '<option value="' + s.id + '"' + (s.id === active ? ' selected' : '') + '>'
                 + escHtml(s.label || s.id) + '</option>';
        });
        html += '</select>';
        container.innerHTML = html;

        el('gaip-fl-site').addEventListener('change', function () {
            _state.activeSiteId = this.value;

            // b35fix97 — inject active site into localStorage so Hub cascade
            // engines and other modules immediately see the switch.
            SiteLoader.setActive(_state.activeSiteId);

            refreshRecentList();
            // Re-run analysis for newly selected site
            if (window.GAIP_FieldAnalysis && typeof window.GAIP_FieldAnalysis.run === 'function') {
                window.GAIP_FieldAnalysis.run(_state.activeSiteId);
            }
        });
    }

    function renderStatusTiles(container) {
        var tiles = getStatusTiles();
        var html  = '';

        Object.keys(tiles).forEach(function (key) {
            var t = tiles[key];
            html += '<div class="gaip-fl-tile gaip-fl-tile--' + t.level + '">'
                  + '<div class="gaip-fl-tile__value">' + escHtml(t.value) + '</div>'
                  + '<div class="gaip-fl-tile__label">' + escHtml(t.label) + '</div>'
                  + (t.name ? '<div class="gaip-fl-tile__sub">' + escHtml(t.name) + '</div>' : '')
                  + (t.cacheNote ? '<div class="gaip-fl-tile__age" style="font-size:9px;opacity:0.6;margin-top:2px;">' + escHtml(t.cacheNote) + '</div>' : '')
                  + '</div>';
        });

        container.innerHTML = html;
    }

    function renderTypeNav(container) {
        var types = [
            { id: 'spray',   icon: '🧪', label: 'Spray'   },
            { id: 'disease', icon: '🔬', label: 'Disease' },
            { id: 'tdr',     icon: '💧', label: 'TDR'     },
            { id: 'mowing',  icon: '✂️',  label: 'Mowing'  },
            { id: 'note',    icon: '📝', label: 'Note'    }
        ];

        var html = '';
        types.forEach(function (t) {
            html += '<button class="gaip-fl-type-btn' + (t.id === _state.activeType ? ' active' : '') + '" '
                  + 'data-type="' + t.id + '" aria-pressed="' + (t.id === _state.activeType) + '">'
                  + '<span class="gaip-fl-type-icon">' + t.icon + '</span>'
                  + '<span class="gaip-fl-type-label">' + t.label + '</span>'
                  + '</button>';
        });

        container.innerHTML = html;

        container.querySelectorAll('.gaip-fl-type-btn').forEach(function (btn) {
            btn.addEventListener('click', function () {
                _state.activeType  = this.dataset.type;
                _state.photoFile   = null;
                _state.photoBase64 = null;
                container.querySelectorAll('.gaip-fl-type-btn').forEach(function (b) {
                    b.classList.toggle('active', b.dataset.type === _state.activeType);
                    b.setAttribute('aria-pressed', b.dataset.type === _state.activeType);
                });
                renderForm(el('gaip-fl-form'));
            });
        });
    }

    function renderForm(container) {
        var today = new Date().toISOString().slice(0, 10);
        var html  = '';

        // Date (common to all)
        html += '<div class="gaip-fl-field">'
              + '<label class="gaip-fl-label" for="gaip-fl-date">Date</label>'
              + '<input class="gaip-fl-input" type="date" id="gaip-fl-date" value="' + today + '" max="' + today + '">'
              + '</div>';

        // Zone (common to all)
        html += '<div class="gaip-fl-field">'
              + '<label class="gaip-fl-label" for="gaip-fl-zone">Zone</label>'
              + '<select class="gaip-fl-select" id="gaip-fl-zone">'
              + '<option value="greens">Greens</option>'
              + '<option value="tees">Tees</option>'
              + '<option value="fairways">Fairways</option>'
              + '<option value="roughs">Roughs</option>'
              + '<option value="surrounds">Surrounds</option>'
              + '<option value="all">All areas</option>'
              + '</select>'
              + '</div>';

        switch (_state.activeType) {

            case 'spray':
                html += '<div class="gaip-fl-field">'
                      + '<label class="gaip-fl-label" for="gaip-fl-product">Product name *</label>'
                      + '<input class="gaip-fl-input" type="text" id="gaip-fl-product" placeholder="e.g. Banner Maxx" autocomplete="off">'
                      + '</div>';
                html += '<div class="gaip-fl-field">'
                      + '<label class="gaip-fl-label" for="gaip-fl-category">Category</label>'
                      + '<select class="gaip-fl-select" id="gaip-fl-category">'
                      + '<option value="fungicide">Fungicide</option>'
                      + '<option value="pgr">PGR</option>'
                      + '<option value="nutrition">Nutrition</option>'
                      + '<option value="wetting_agent">Wetting Agent</option>'
                      + '<option value="pre_emergent">Pre-emergent</option>'
                      + '<option value="insecticide">Insecticide</option>'
                      + '<option value="other">Other</option>'
                      + '</select>'
                      + '</div>';
                html += '<div class="gaip-fl-field gaip-fl-field--row">'
                      + '<div class="gaip-fl-field__half">'
                      + '<label class="gaip-fl-label" for="gaip-fl-rate">Rate</label>'
                      + '<input class="gaip-fl-input" type="number" id="gaip-fl-rate" placeholder="0.0" step="0.01" min="0" inputmode="decimal">'
                      + '</div>'
                      + '<div class="gaip-fl-field__half">'
                      + '<label class="gaip-fl-label" for="gaip-fl-rate-unit">Unit</label>'
                      + '<select class="gaip-fl-select" id="gaip-fl-rate-unit">'
                      + '<option value="L/ha">L/ha</option>'
                      + '<option value="kg/ha">kg/ha</option>'
                      + '<option value="mL/100m2">mL/100m²</option>'
                      + '<option value="g/100m2">g/100m²</option>'
                      + '</select>'
                      + '</div>'
                      + '</div>';
                html += '<div class="gaip-fl-field">'
                      + '<label class="gaip-fl-label" for="gaip-fl-target">Target pest / disease</label>'
                      + '<input class="gaip-fl-input" type="text" id="gaip-fl-target" placeholder="e.g. Dollar Spot" autocomplete="off">'
                      + '</div>';
                break;

            case 'disease':
                html += '<div class="gaip-fl-field">'
                      + '<label class="gaip-fl-label" for="gaip-fl-disease-type">Disease / symptom *</label>'
                      + '<input class="gaip-fl-input" type="text" id="gaip-fl-disease-type" placeholder="e.g. Dollar Spot, Brown Patch" autocomplete="off">'
                      + '</div>';
                html += '<div class="gaip-fl-field">'
                      + '<label class="gaip-fl-label" for="gaip-fl-severity">Severity</label>'
                      + '<select class="gaip-fl-select" id="gaip-fl-severity">'
                      + '<option value="trace">Trace — a few spots</option>'
                      + '<option value="low">Low — scattered</option>'
                      + '<option value="moderate">Moderate — widespread</option>'
                      + '<option value="high">High — severe</option>'
                      + '</select>'
                      + '</div>';
                html += '<div class="gaip-fl-field">'
                      + '<label class="gaip-fl-label" for="gaip-fl-location">Location on course</label>'
                      + '<input class="gaip-fl-input" type="text" id="gaip-fl-location" placeholder="e.g. Green 7, Fairway 12 approach">'
                      + '</div>';
                html += renderPhotoField();
                break;

            case 'tdr':
                html += '<div class="gaip-fl-field gaip-fl-field--row">'
                      + '<div class="gaip-fl-field__half">'
                      + '<label class="gaip-fl-label" for="gaip-fl-vwc">VWC %</label>'
                      + '<input class="gaip-fl-input" type="number" id="gaip-fl-vwc" placeholder="0.0" step="0.1" min="0" max="100" inputmode="decimal">'
                      + '</div>'
                      + '<div class="gaip-fl-field__half">'
                      + '<label class="gaip-fl-label" for="gaip-fl-ec">EC (dS/m)</label>'
                      + '<input class="gaip-fl-input" type="number" id="gaip-fl-ec" placeholder="0.0" step="0.01" min="0" inputmode="decimal">'
                      + '</div>'
                      + '</div>';
                html += '<div class="gaip-fl-field">'
                      + '<label class="gaip-fl-label" for="gaip-fl-depth">Depth (mm)</label>'
                      + '<select class="gaip-fl-select" id="gaip-fl-depth">'
                      + '<option value="100">100 mm</option>'
                      + '<option value="150">150 mm</option>'
                      + '<option value="200">200 mm</option>'
                      + '<option value="300">300 mm</option>'
                      + '</select>'
                      + '</div>';
                html += '<div class="gaip-fl-field">'
                      + '<label class="gaip-fl-label" for="gaip-fl-soil-temp">Soil temp (°C)</label>'
                      + '<input class="gaip-fl-input" type="number" id="gaip-fl-soil-temp" placeholder="e.g. 18.5" step="0.1" inputmode="decimal">'
                      + '</div>';
                break;

            case 'mowing':
                html += '<div class="gaip-fl-field gaip-fl-field--row">'
                      + '<div class="gaip-fl-field__half">'
                      + '<label class="gaip-fl-label" for="gaip-fl-hoc">Height of cut (mm)</label>'
                      + '<input class="gaip-fl-input" type="number" id="gaip-fl-hoc" placeholder="e.g. 3.5" step="0.1" min="0" inputmode="decimal">'
                      + '</div>'
                      + '<div class="gaip-fl-field__half">'
                      + '<label class="gaip-fl-label" for="gaip-fl-clippings">Clippings (mL/m²)</label>'
                      + '<input class="gaip-fl-input" type="number" id="gaip-fl-clippings" placeholder="e.g. 45" step="1" min="0" inputmode="decimal">'
                      + '</div>'
                      + '</div>';
                html += '<div class="gaip-fl-field">'
                      + '<label class="gaip-fl-label" for="gaip-fl-mow-passes">Passes / direction</label>'
                      + '<input class="gaip-fl-input" type="text" id="gaip-fl-mow-passes" placeholder="e.g. 2× N-S + diagonal">'
                      + '</div>';
                break;
        }

        // Notes (common to all)
        html += '<div class="gaip-fl-field">'
              + '<label class="gaip-fl-label" for="gaip-fl-notes">Notes</label>'
              + '<textarea class="gaip-fl-textarea" id="gaip-fl-notes" rows="3" placeholder="Additional observations..."></textarea>'
              + '</div>';

        // Photo for spray, note (disease has own photo field above)
        if (_state.activeType === 'spray' || _state.activeType === 'note') {
            html += renderPhotoField();
        }

        container.innerHTML = html;

        // Wire photo input if present
        var photoInput = el('gaip-fl-photo');
        if (photoInput) {
            photoInput.addEventListener('change', function () {
                var file = this.files && this.files[0];
                if (!file) { return; }
                _state.photoFile = file;
                PhotoUpload.toBase64(file).then(function (b64) {
                    _state.photoBase64 = b64;
                    var preview = el('gaip-fl-photo-preview');
                    if (preview) {
                        preview.innerHTML = '<img src="' + b64 + '" class="gaip-fl-photo-img" alt="Photo preview">';
                    }
                });
            });
        }
    }

    function renderPhotoField() {
        return '<div class="gaip-fl-field">'
             + '<label class="gaip-fl-label">Photo</label>'
             + '<label class="gaip-fl-photo-btn" for="gaip-fl-photo">'
             + '<span>📷 Take / choose photo</span>'
             + '<input type="file" id="gaip-fl-photo" accept="image/*" capture="environment" class="gaip-fl-photo-input">'
             + '</label>'
             + '<div id="gaip-fl-photo-preview" class="gaip-fl-photo-preview"></div>'
             + '</div>';
    }

    function renderOnlineBadge(container) {
        function update() {
            container.innerHTML = navigator.onLine
                ? '<span class="gaip-fl-badge gaip-fl-badge--online">● Online</span>'
                : '<span class="gaip-fl-badge gaip-fl-badge--offline">● Offline</span>';
        }
        update();
        window.addEventListener('online',  update);
        window.addEventListener('offline', update);
    }

    function renderRecentList(container, siteId) {
        container.innerHTML = '<div class="gaip-fl-recent-loading">Loading...</div>';

        FieldLogAPI.list(siteId, 20).then(function (obs) {
            if (!obs.length) {
                container.innerHTML = '<div class="gaip-fl-recent-empty">No observations recorded for this site yet.</div>';
                return;
            }

            var html = '<ul class="gaip-fl-recent-list">';
            obs.forEach(function (o) {
                var date    = (o.observed_at || o.created_at || o.created || '').slice(0, 10);
                var typeMap = { spray: '🧪', disease: '🔬', tdr: '💧', mowing: '✂️', note: '📝' };
                var icon    = typeMap[o.type] || '📋';
                var summary = buildSummary(o);

                html += '<li class="gaip-fl-recent-item">'
                      + '<span class="gaip-fl-recent-icon">' + icon + '</span>'
                      + '<div class="gaip-fl-recent-body">'
                      + '<div class="gaip-fl-recent-summary">' + escHtml(summary) + '</div>'
                      + '<div class="gaip-fl-recent-meta">'
                      + escHtml(o.zone || '') + (o.zone ? ' · ' : '') + escHtml(date)
                      + '</div>'
                      + '</div>'
                      + '</li>';
            });
            html += '</ul>';
            container.innerHTML = html;
        }).catch(function (err) {
            container.innerHTML = '<div class="gaip-fl-recent-empty">Could not load observations.</div>';
            warn('renderRecentList error:', err.message);
        });
    }

    function buildSummary(obs) {
        switch (obs.type) {
            case 'spray':   return (obs.data.product_name || 'Spray') + (obs.data.rate ? ' @ ' + obs.data.rate + ' ' + obs.data.rate_unit : '');
            case 'disease': return (obs.data.disease_type || 'Disease') + ' — ' + (obs.data.severity || '');
            case 'tdr':     return 'TDR: ' + (obs.data.vwc != null ? obs.data.vwc + '% VWC' : '') + (obs.data.ec != null ? ', EC ' + obs.data.ec : '');
            case 'mowing':  return 'HOC ' + (obs.data.hoc || '--') + 'mm' + (obs.data.clippings ? ', ' + obs.data.clippings + ' mL/m²' : '');
            case 'note':    return obs.data.notes ? obs.data.notes.slice(0, 60) : 'Note';
            default:        return obs.type;
        }
    }

    var _refreshTimer = null;
    function refreshRecentList() {
        clearTimeout(_refreshTimer);
        _refreshTimer = setTimeout(function () {
            var container = el('gaip-fl-recent');
            if (container) { renderRecentList(container, _state.activeSiteId); }
        }, 100);
    }

    // =========================================================================
    // SAVE
    // =========================================================================

    function collectFormData() {
        var data = {
            date:  (el('gaip-fl-date')  && el('gaip-fl-date').value)  || new Date().toISOString().slice(0, 10),
            zone:  (el('gaip-fl-zone')  && el('gaip-fl-zone').value)  || 'greens',
            notes: (el('gaip-fl-notes') && el('gaip-fl-notes').value) || ''
        };

        switch (_state.activeType) {
            case 'spray':
                data.product_name  = (el('gaip-fl-product')   && el('gaip-fl-product').value.trim())   || '';
                data.product_category = (el('gaip-fl-category') && el('gaip-fl-category').value) || 'other';
                data.rate          = parseFloat((el('gaip-fl-rate') && el('gaip-fl-rate').value) || '0') || null;
                data.rate_unit     = (el('gaip-fl-rate-unit') && el('gaip-fl-rate-unit').value) || 'L/ha';
                data.target        = (el('gaip-fl-target') && el('gaip-fl-target').value.trim()) || null;
                break;

            case 'disease':
                data.disease_type = (el('gaip-fl-disease-type') && el('gaip-fl-disease-type').value.trim()) || '';
                data.severity     = (el('gaip-fl-severity') && el('gaip-fl-severity').value) || 'low';
                data.location     = (el('gaip-fl-location') && el('gaip-fl-location').value.trim()) || '';
                break;

            case 'tdr':
                data.vwc       = parseFloat((el('gaip-fl-vwc') && el('gaip-fl-vwc').value) || '') || null;
                data.ec        = parseFloat((el('gaip-fl-ec')  && el('gaip-fl-ec').value)  || '') || null;
                data.depth     = parseInt((el('gaip-fl-depth') && el('gaip-fl-depth').value) || '100', 10);
                data.soil_temp = parseFloat((el('gaip-fl-soil-temp') && el('gaip-fl-soil-temp').value) || '') || null;
                break;

            case 'mowing':
                data.hoc       = parseFloat((el('gaip-fl-hoc')       && el('gaip-fl-hoc').value)       || '') || null;
                data.clippings = parseFloat((el('gaip-fl-clippings') && el('gaip-fl-clippings').value) || '') || null;
                data.passes    = (el('gaip-fl-mow-passes') && el('gaip-fl-mow-passes').value.trim()) || '';
                break;
        }

        return data;
    }

    function validateFormData(data) {
        if (_state.activeType === 'spray' && !data.product_name) {
            return 'Product name is required';
        }
        if (_state.activeType === 'disease' && !data.disease_type) {
            return 'Disease / symptom is required';
        }
        return null;
    }

    function handleSave() {
        if (_state.saving) { return; }

        var data  = collectFormData();
        var error = validateFormData(data);
        if (error) { showToast(error, true); return; }

        _state.saving = true;
        var saveBtn   = el('gaip-fl-save');
        if (saveBtn) { saveBtn.disabled = true; saveBtn.textContent = 'Saving…'; }

        var obsId = uuid();

        // Handle photo
        var photoPromise = Promise.resolve(null);
        if (_state.photoFile) {
            photoPromise = PhotoUpload.upload(_state.photoFile, _state.activeType + ' ' + data.date);
        }

        photoPromise.then(function (attachmentId) {
            var obs = {
                id:      obsId,
                type:    _state.activeType,
                site_id: _state.activeSiteId,
                zone:    data.zone,
                created: new Date().toISOString(),
                data:    data,
                photo:   {
                    attachmentId: attachmentId,
                    base64:       attachmentId ? null : _state.photoBase64
                }
            };

            return syncObservation(obs, data);
        }).then(function () {
            showToast('Saved');
            resetForm();
            refreshRecentList();
        }).catch(function (err) {
            warn('Save failed:', err.message);
            showToast('Save failed: ' + err.message, true);
        }).finally(function () {
            _state.saving     = false;
            _state.photoFile  = null;
            _state.photoBase64 = null;
            if (saveBtn) { saveBtn.disabled = false; saveBtn.textContent = 'Save'; }
        });
    }

    function buildObservationPayload(obs) {
        return {
            client_uid:  obs.id,
            site_id:     obs.site_id,
            type:        obs.type,
            zone:        obs.zone || null,
            observed_at: obs.created || new Date().toISOString(),
            data:        obs.data || {},
            photo:       obs.photo || null
        };
    }

    function buildSprayPayload(obs, data) {
        return {
            site_id:          obs.site_id,
            zone:             obs.zone,
            application_date: data.date,
            product_name:     data.product_name,
            product_category: data.product_category,
            rate:             data.rate,
            rate_unit:        data.rate_unit,
            target:           data.target || null,
            notes:            data.notes  || null,
            source:           'manual'
        };
    }

    function syncObservation(obs, data) {
        return FieldLogAPI.post(buildObservationPayload(obs))
            .then(function () {
                if (obs.type === 'spray') {
                    return SprayAPI.post(buildSprayPayload(obs, data));
                }
                return null;
            });
    }

    function resetForm() {
        renderForm(el('gaip-fl-form'));
    }

    // =========================================================================
    // LIGHTWEIGHT ANALYSIS TRIGGER
    // =========================================================================

    function triggerAnalysis() {
        // If full hub orchestrator is present, run it
        if (global.GaipOrchestrator && typeof global.GaipOrchestrator.computeAll === 'function'
            && !global.GaipOrchestrator.isRunning()) {
            log('Triggering lightweight analysis via GaipOrchestrator');
            global.GaipOrchestrator.computeAll().then(function () {
                var tilesEl = el('gaip-fl-tiles');
                if (tilesEl) { renderStatusTiles(tilesEl); }
            });
            return;
        }

        // Hub not present — tiles stay on cached globals or '--'
        log('GaipOrchestrator not available — status tiles showing cached values');
        var tilesEl = el('gaip-fl-tiles');
        if (tilesEl) { renderStatusTiles(tilesEl); }
    }

    // =========================================================================
    // ESCAPE HTML
    // =========================================================================

    function escHtml(str) {
        if (!str) { return ''; }
        return String(str)
            .replace(/&/g,  '&amp;')
            .replace(/</g,  '&lt;')
            .replace(/>/g,  '&gt;')
            .replace(/"/g,  '&quot;')
            .replace(/'/g,  '&#39;');
    }

    // =========================================================================
    // INIT
    // =========================================================================

    function init() {
        var root = el('gaip-field-log');
        if (!root) {
            // Not on a field-log page
            return;
        }

        log('v' + VERSION + ' initialising');

        // Render chrome that doesn't depend on site list first
        var badgeBar  = el('gaip-fl-badge-bar');
        var tilesEl   = el('gaip-fl-tiles');
        var typeNav   = el('gaip-fl-type-nav');
        var formEl    = el('gaip-fl-form');
        var recentEl  = el('gaip-fl-recent');
        var saveBtn   = el('gaip-fl-save');

        if (badgeBar) { renderOnlineBadge(badgeBar); }
        if (tilesEl)  { renderStatusTiles(tilesEl); }
        if (typeNav)  { renderTypeNav(typeNav); }
        if (formEl)   { renderForm(formEl); }

        if (saveBtn) {
            saveBtn.addEventListener('click', handleSave);
        }

        // Listen for analysis-complete from gaip-field-log-analysis.js
        document.addEventListener('gaip:field-analysis-complete', function () {
            var tilesEl = el('gaip-fl-tiles');
            if (tilesEl) { renderStatusTiles(tilesEl); }
        });

        // b35fix97 — fetch site locations from server, inject into localStorage,
        // then render site selector with the authoritative list.
        // renderRecentList and analysis run after sites settle.
        var siteBar = el('gaip-fl-site-bar');
        if (siteBar) {
            // Show placeholder while fetch is in flight
            siteBar.innerHTML = '<select class="gaip-fl-select gaip-fl-select--site" disabled>'
                              + '<option>Loading sites\u2026</option></select>';
        }

        SiteLoader.fetchAndInject().then(function (siteList) {
            // Resolve active site — server data is now in localStorage so
            // getActiveSiteId() will return the correct value.
            _state.activeSiteId = getActiveSiteId();

            if (siteBar) { renderSiteSelector(siteBar, siteList); }

            if (recentEl) { renderRecentList(recentEl, _state.activeSiteId); }

            // Small delay so hub globals (if shared page) settle first
            setTimeout(triggerAnalysis, 800);

            log('Ready — active site:', _state.activeSiteId);
        });
    }

    // Boot on DOM ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    // Public API
    global.GAIP_FieldLog = {
        version:         VERSION,
        flush:           function () { return Promise.resolve(0); },
        getObs:          FieldLogAPI.list,
        triggerAnalysis: triggerAnalysis,
        renderTiles:     function () {
            var tilesEl = el('gaip-fl-tiles');
            if (tilesEl) { renderStatusTiles(tilesEl); }
        },
        // b35fix97 — allow external callers (e.g. Hub site-switch handler)
        // to force a re-fetch and re-render of the site selector.
        refreshSites: function () {
            var siteBar = el('gaip-fl-site-bar');
            if (!siteBar) { return Promise.resolve(); }
            return SiteLoader.fetchAndInject().then(function (siteList) {
                _state.activeSiteId = getActiveSiteId();
                renderSiteSelector(siteBar, siteList);
                refreshRecentList();
            });
        }
    };

})(typeof window !== 'undefined' ? window : this);
