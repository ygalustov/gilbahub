/**
 * =============================================================================
 * GILBA SPRAY LOG — UI Module v2.0.0
 * =============================================================================
 *
 * Context-aware product entry form. Category selection switches the product
 * field to a structured dropdown sourced from regional databases:
 *
 *   PGR          — 7-product list, same AU + NZ
 *   Fungicide    — GAIP_AU_FUNGICIDES.db (AU) / GAIP_NZ_FUNGICIDES.db (NZ)
 *                  Trade name selection auto-fills AI, FRAC, label rate
 *   Nutrition    — GAIP_AU_FERTILISER.products (AU) / PrebbleProducts (NZ)
 *                  Grouped by granular / liquid / soluble
 *   Wetting Agent— hardcoded AU / NZ lists
 *   Pre-emergent — hardcoded active-ingredient list (AU + NZ), HRAC groups
 *   Insecticide  — free text
 *   Other        — free text
 *
 * product_key always populated for structured categories — eliminates the
 * name-map fragility that caused PGR autofill failures (b35fix201).
 *
 * Region: fungicide-filter.js getCurrentRegion() → AU / NZ / uk_ireland / continental_europe / scandinavia.
 *
 * @author  Gilba Solutions
 * @version 2.0.0
 * =============================================================================
 */
(function(global) {
    'use strict';

    const VERSION = '2.0.0';
    const LOG_PREFIX = '[SprayLogUI]';
    function log(...args) { ; }

    // =========================================================================
    // CONSTANTS
    // =========================================================================

    const ZONES = [
        { id: 'greens',       label: 'Greens',       icon: '\u{1F7E2}' },
        { id: 'tees',         label: 'Tees',         icon: '\u{1F535}' },
        { id: 'fairways',     label: 'Fairways',     icon: '\u{1F7E1}' },
        { id: 'surrounds',    label: 'Surrounds',    icon: '\u{1F7E0}' },
        { id: 'sportsground', label: 'Sportsground', icon: '\u26BD' },
        { id: 'other',        label: 'Other',        icon: '\u26AA' }
    ];

    const CATEGORIES = [
        { id: 'fungicide',     label: 'Fungicide',     icon: '\u{1F48A}' },
        { id: 'pgr',           label: 'PGR',           icon: '\u{1F4D0}' },
        { id: 'nutrition',     label: 'Nutrition',     icon: '\u{1F331}' },
        { id: 'wetting_agent', label: 'Wetting Agent', icon: '\u{1F4A7}' },
        { id: 'pre_emergent',  label: 'Pre-emergent',  icon: '\u{1F6E1}\uFE0F' },
        { id: 'insecticide',   label: 'Insecticide',   icon: '\u{1F41B}' },
        { id: 'other',         label: 'Other',         icon: '\u{1F4E6}' }
    ];

    const RATE_UNITS = ['L/ha', 'kg/ha', 'mL/100m2', 'g/100m2'];

    // PGR — same AU + NZ
    const PGR_PRODUCTS = [
        { key: 'TE250',  label: 'TE 250g/L (Primo 250EC)',         ai: 'trinexapac-ethyl',    defaultRate: 0.4,  rateUnit: 'L/ha'  },
        { key: 'TE175',  label: 'TE 175g/L (Amigo 175 / Marvel 175)',       ai: 'trinexapac-ethyl',    defaultRate: 0.5,  rateUnit: 'L/ha'  },
        { key: 'TE120',  label: 'TE 120g/L (Amigo 120 / Primo Maxx 120)',   ai: 'trinexapac-ethyl',    defaultRate: 0.7,  rateUnit: 'L/ha'  },
        { key: 'PBZ200', label: 'Paclobutrazol 200g/L',            ai: 'paclobutrazol',       defaultRate: 1.0,  rateUnit: 'L/ha'  },
        { key: 'PBZ250', label: 'Paclobutrazol 250g/L',            ai: 'paclobutrazol',       defaultRate: 0.8,  rateUnit: 'L/ha'  },
        { key: 'ANUEW',  label: 'Prohexadione-Ca 27.5% (Anuew)',  ai: 'prohexadione-calcium', defaultRate: 1.5, rateUnit: 'kg/ha' },
        { key: 'ETH',    label: 'Ethephon 480g/L (Incognito)',     ai: 'ethephon',            defaultRate: 2.0,  rateUnit: 'L/ha'  }
    ];

    // Wetting agents
    const WA_AU = [
        'Tricure','Hydroforce Ultra','Hydroforce Extend','Stamina 90',
        'Hydroforce Inject','Hydroforce Rapid','Hydroforce Recharge',
        'Hydroforce Granular Greens','Stamina Remain','Stamina Rescue',
        'Stamina Express','Stamina Balance'
    ];
    const WA_NZ = [
        '50/90','Advantage Pellets','Alypso','Aqueduct','Aqua-sorb',
        'Bi-Agra','Breakthru Gold','Firmway','Injectaforce','Primer',
        'Restore Granules','Restore Liquid','Revolution','Zipline'
    ];

    // UK/Ireland wetting agents
    // Source: BASIS-registered distributor catalogues; ICL Turf & Landscape UK product range.
    // No peer-reviewed UK-specific comparative trial data equivalent to AU literature.
    const WA_UK = [
        'H2Pro Granular','H2Pro Triformance','H2Pro TriFilm',
        'Qualibra','Dispatch','Aqueduct','Aqua-Aid Ultra',
        'Primer (ICL)','Revolution (ICL)','Restore Granules (ICL)'
    ];

    // Pre-emergent actives — AU
    const PRE_EM_AU = [
        { key: 'prodiamine',          label: 'Prodiamine (HRAC 3)',           ai: 'prodiamine' },
        { key: 'pendimethalin',       label: 'Pendimethalin (HRAC 3)',        ai: 'pendimethalin' },
        { key: 'oxadiazon',           label: 'Oxadiazon (HRAC 14)',           ai: 'oxadiazon' },
        { key: 'dithiopyr',           label: 'Dithiopyr (HRAC 3)',            ai: 'dithiopyr' },
        { key: 'isoxaben',            label: 'Isoxaben (HRAC 21)',            ai: 'isoxaben' },
        { key: 'oryzalin',            label: 'Oryzalin (HRAC 3)',             ai: 'oryzalin' },
        { key: 'simazine',            label: 'Simazine (HRAC 5)',             ai: 'simazine' },
        { key: 'halosulfuron-methyl', label: 'Halosulfuron-methyl (HRAC 2)',  ai: 'halosulfuron-methyl' },
        { key: 'imazosulfuron',       label: 'Imazosulfuron (HRAC 2)',        ai: 'imazosulfuron' }
    ];
    // Pre-emergent actives — NZ (isoxaben flagged as unverified)
    const PRE_EM_NZ = [
        { key: 'prodiamine',          label: 'Prodiamine (HRAC 3)',                         ai: 'prodiamine' },
        { key: 'pendimethalin',       label: 'Pendimethalin (HRAC 3)',                      ai: 'pendimethalin' },
        { key: 'oxadiazon',           label: 'Oxadiazon (HRAC 14)',                         ai: 'oxadiazon' },
        { key: 'dithiopyr',           label: 'Dithiopyr (HRAC 3)',                          ai: 'dithiopyr' },
        { key: 'isoxaben',            label: 'Isoxaben (HRAC 21) \u26A0 verify ACVM',      ai: 'isoxaben' },
        { key: 'oryzalin',            label: 'Oryzalin (HRAC 3)',                           ai: 'oryzalin' },
        { key: 'simazine',            label: 'Simazine (HRAC 5)',                           ai: 'simazine' },
        { key: 'halosulfuron-methyl', label: 'Halosulfuron-methyl (HRAC 2)',                ai: 'halosulfuron-methyl' },
        { key: 'imazosulfuron',       label: 'Imazosulfuron (HRAC 2)',                      ai: 'imazosulfuron' }
    ];

    // Pre-emergent actives — UK/Ireland
    // REGISTRATION REALITY: UK approval for turf PEs is extremely limited.
    // Prodiamine, dithiopyr, oxadiazon: no current UK MAPP registration for turf.
    // Source: UK HSE Pesticide Register; BCPC Pesticide Manual.
    // Efficacy ref: Dernoeden (2000) Turfgrass Weed Management (pendimethalin general).
    const PRE_EM_UK = [
        {
            key:   'pendimethalin_uk',
            label: 'Pendimethalin — Stomp Aqua MAPP 14664 (HRAC 3) \u26A0 off-label on turf',
            ai:    'pendimethalin',
            warn:  'MAPP 14664 approved for agricultural crops only. No on-label turf EAMU confirmed (GB, 2024). Professional use only (PA1/PA6 required).'
        },
        {
            key:   'propyzamide_uk',
            label: 'Propyzamide — Kerb Flo / generics (HRAC 3) \u2744 soil temp <8\u00b0C',
            ai:    'propyzamide',
            warn:  'Amenity vegetation approval confirmed. Apply Oct\u2013Jan only when soil temp <8\u00b0C. Breaks down rapidly in warm soil.'
        }
    ];

    let _entries  = [];
    let _isLoading = false;

    function todayISO() { return new Date().toISOString().split('T')[0]; }

    function getCategoryLabel(id) {
        const c = CATEGORIES.find(x => x.id === id);
        return c ? c.icon + ' ' + c.label : id;
    }
    function getZoneLabel(id) {
        const z = ZONES.find(x => x.id === id);
        return z ? z.label : id;
    }

    // =========================================================================
    // REGION DETECTION
    // =========================================================================

    function getCurrentRegion() {
        // Resolve coordinates from all available sources first.
        // GAIP_FungicideFilter.getCurrentRegion() only reads GAIP_CANONICAL_STATE.location.lat
        // (not populated on GSSH pages) so we must pass coords explicitly via options.lat/lon.
        var _lat = null, _lon = null;

        // GSSH_CONTEXT — written by unified-venue-selector.js, reliable after b35fix264
        if (global.GSSH_CONTEXT && global.GSSH_CONTEXT.lat) {
            _lat = parseFloat(global.GSSH_CONTEXT.lat);
            _lon = parseFloat(global.GSSH_CONTEXT.lng || 0);
        }
        // GilbaStadiumData URL-param fallback — same path hub-orchestrator uses
        if (!_lat && global.location && global.GilbaStadiumData && global.GilbaStadiumData.stadiums) {
            try {
                var _vid = ((global.location.search.match(/gssh_venue=([^&]+)/)) || [])[1] || null;
                if (_vid) {
                    var _sv = global.GilbaStadiumData.stadiums[_vid];
                    if (_sv) {
                        _lat = parseFloat((_sv.location && _sv.location.lat) || _sv.lat || 0);
                        _lon = parseFloat((_sv.location && _sv.location.lng) || _sv.lng || 0);
                    }
                }
            } catch(e) {}
        }
        // GAIP_CANONICAL_STATE top-level lat/lon (written by hub-orchestrator climate block)
        if (!_lat && global.GAIP_CANONICAL_STATE && global.GAIP_CANONICAL_STATE.lat) {
            _lat = parseFloat(global.GAIP_CANONICAL_STATE.lat);
            _lon = parseFloat(global.GAIP_CANONICAL_STATE.lon || 0);
        }
        // GAIP_STATE location fallback
        if (!_lat) {
            var _gs = global.GAIP_STATE;
            if (_gs && _gs.location && _gs.location.lat) {
                _lat = parseFloat(_gs.location.lat);
                _lon = parseFloat(_gs.location.lon || _gs.location.lng || 0);
            }
        }
        // b35fix294: GAIP_SiteConfig — active site location (updates on site-switch)
        // Must be checked BEFORE GAIP_HUB_CONFIG.savedLocation which is static from PHP
        if (!_lat) {
            try {
                var _SC = global.GAIP_SiteConfig || global.GAIP_SiteContext;
                var _siteId = global.GAIP_SiteContext ? global.GAIP_SiteContext.getSiteId() : null;
                if (_SC && _siteId && typeof _SC.getConfig === 'function') {
                    var _cfg = _SC.getConfig(_siteId);
                    if (_cfg && _cfg.location && _cfg.location.lat) {
                        _lat = parseFloat(_cfg.location.lat);
                        _lon = parseFloat(_cfg.location.lon || _cfg.location.lng || 0);
                    }
                }
            } catch(e) {}
        }
        // b35fix294: GAIP_HUB_CONFIG.savedLocation REMOVED as coord source.
        // It is static from PHP wp_localize_script and does NOT update on client-side
        // site-switch. Using it caused all sites to resolve to whatever region the
        // server-side saved location was set to (e.g. UK coords applied to AU sites).
        // RegionalProfiles — direct region string (no coords needed)
        if (!_lat && global.GAIP_RegionalProfiles && typeof global.GAIP_RegionalProfiles.detectRegionFromHub === 'function') {
            try {
                var _rpRegion = global.GAIP_RegionalProfiles.detectRegionFromHub();
                if (_rpRegion) return _rpRegion;
            } catch(e) {}
        }

        // 1. Delegate to GAIP_FungicideFilter passing coords explicitly.
        //    Without coords, FungicideFilter falls through to 'australia' default
        //    because GAIP_CANONICAL_STATE.location is not populated on GSSH pages.
        if (global.GAIP_FungicideFilter && typeof global.GAIP_FungicideFilter.getCurrentRegion === 'function') {
            try {
                var _opts = _lat ? { lat: _lat, lon: _lon } : {};
                const r = global.GAIP_FungicideFilter.getCurrentRegion(_opts);
                if (r && r !== 'australia') return r;
                // If FungicideFilter returned 'australia' but we have coords, verify with
                // detectRegionFromCoords directly — FungicideFilter may have no other source
                if (r === 'australia' && _lat && typeof global.GAIP_FungicideFilter.detectRegionFromCoords === 'function') {
                    const rc = global.GAIP_FungicideFilter.detectRegionFromCoords(_lat, _lon);
                    if (rc) return rc;
                }
                if (r) return r;
            } catch(e) {}
        }

        // 2. Inline coord detection — final fallback if FungicideFilter unavailable
        if (_lat) {
            if (global.GAIP_FungicideFilter && typeof global.GAIP_FungicideFilter.detectRegionFromCoords === 'function') {
                try {
                    const r = global.GAIP_FungicideFilter.detectRegionFromCoords(_lat, _lon);
                    if (r) return r;
                } catch(e) {}
            }
            if (_lat < 0 && _lon > 165 && _lon < 180) return 'new_zealand';
            if (_lat < 0 && _lon > 110 && _lon <= 165) return 'australia';
            if (_lon > -11 && _lon < 2 && _lat > 49.9 && _lat < 61.1) return 'uk_ireland';
            if (_lat > 55 && _lon > 4 && _lon < 32) return 'scandinavia';
            if (_lat > 35 && _lat < 72 && _lon > -12 && _lon < 45) return 'continental_europe';
            if (_lat > 24 && _lat < 46 && _lon > 123 && _lon < 146) return 'japan';
        }

        return 'australia';
    }

    function isNZ()  { const r = getCurrentRegion(); return r === 'new_zealand' || r === 'nz'; }
    function isUK()  { const r = getCurrentRegion(); return r === 'uk_ireland'; }
    function isEU()  { const r = getCurrentRegion(); return r === 'continental_europe' || r === 'scandinavia'; }

    // =========================================================================
    // PRODUCT DATA BUILDERS
    // =========================================================================

    function buildFungicideOptions(nz) {
        const region = getCurrentRegion();
        let db;
        if (region === 'uk_ireland') {
            db = global.GAIP_UK_FUNGICIDES && global.GAIP_UK_FUNGICIDES.db;
            if (!db) console.error('[SprayLogUI] GAIP_UK_FUNGICIDES not loaded — check uk-fungicides.js enqueue order');
        } else if (region === 'continental_europe' || region === 'scandinavia') {
            // Use European regional db if available; fall back to UK as closest proxy
            db = (global.GAIP_EUROPEAN_FUNGICIDES && global.GAIP_EUROPEAN_FUNGICIDES.db)
              || (global.GAIP_UK_FUNGICIDES && global.GAIP_UK_FUNGICIDES.db);
            if (!db) console.warn('[SprayLogUI] No European fungicide db loaded — falling back to AU');
        } else if (nz) {
            db = global.GAIP_NZ_FUNGICIDES && global.GAIP_NZ_FUNGICIDES.db;
        } else {
            db = global.GAIP_AU_FUNGICIDES && global.GAIP_AU_FUNGICIDES.db;
        }
        if (!db) return null;
        const opts = [];
        Object.keys(db).forEach(function(aiKey) {
            const entry = db[aiKey];
            if (!entry.products || !entry.products.length) return;
            entry.products.forEach(function(p) {
                opts.push({
                    key:   aiKey,
                    label: p.trade,
                    ai:    aiKey,
                    frac:  String(entry.frac || ''),
                    rate:  p.rate || ''
                });
            });
        });
        opts.sort(function(a, b) { return a.label.localeCompare(b.label); });
        return opts;
    }

    function buildNutritionOptions(nz) {
        var db;
        if (isUK() && global.GAIP_UK_FERTILISER && global.GAIP_UK_FERTILISER.products) {
            // b35fix293: UK sites use dedicated UK fertiliser database
            db = global.GAIP_UK_FERTILISER.products;
        } else if (isUK() || isEU()) {
            // EU or UK fallback if UK db not loaded: use AU fertiliser list
            db = global.GAIP_AU_FERTILISER && global.GAIP_AU_FERTILISER.products;
        } else if (nz) {
            db = global.PrebbleProducts;
        } else {
            db = global.GAIP_AU_FERTILISER && global.GAIP_AU_FERTILISER.products;
        }
        if (!db) return null;
        var opts = [];
        var arrays = [
            { group: 'Granular', arr: db.granular || [] },
            { group: 'Liquid',   arr: db.liquid   || [] },
            { group: 'Soluble',  arr: db.soluble  || [] }
        ];
        arrays.forEach(function(g) {
            g.arr.forEach(function(p) {
                if (!p.id || !p.name) return;
                var analysis = p.analysis || p.npk || {};
                var aiStr = '';
                if (typeof analysis === 'string') {
                    aiStr = analysis;
                } else if (typeof analysis === 'object') {
                    var parts = [];
                    if (analysis.N != null) parts.push('N' + analysis.N);
                    if (analysis.P != null) parts.push('P' + analysis.P);
                    if (analysis.K != null) parts.push('K' + analysis.K);
                    aiStr = parts.join(' ');
                }
                opts.push({ key: p.id, label: p.name, ai: aiStr, group: g.group });
            });
        });
        return opts;
    }

    // =========================================================================
    // DYNAMIC FORM FIELDS
    // =========================================================================

    function onCategoryChange(cat) {
        var nz = isNZ();
        _rebuildProductRow(cat, nz);
        _updateContextualFields(cat);
    }

    function _rebuildProductRow(cat, nz) {
        var productRow = document.getElementById('gaip-sl-product-row');
        if (!productRow) return;
        var aiEl   = document.getElementById('gaip-sl-f-ai');
        var fracEl = document.getElementById('gaip-sl-f-frac');
        var keyEl  = document.getElementById('gaip-sl-f-key');
        if (aiEl)   aiEl.value   = '';
        if (fracEl) fracEl.value = '';
        if (keyEl)  keyEl.value  = '';

        var fracRow = document.getElementById('gaip-sl-frac-row');

        if (cat === 'pgr') {
            _buildDropdown(productRow, PGR_PRODUCTS, 'PGR product', function(opt) {
                if (!opt) return;
                if (aiEl)  aiEl.value  = opt.ai;
                if (keyEl) keyEl.value = opt.key;
                var rateEl = document.getElementById('gaip-sl-f-rate');
                var unitEl = document.getElementById('gaip-sl-f-unit');
                if (rateEl && opt.defaultRate) rateEl.value = opt.defaultRate;
                if (unitEl && opt.rateUnit)    unitEl.value = opt.rateUnit;
            });
            if (fracRow) fracRow.style.display = 'none';
        }
        else if (cat === 'fungicide') {
            var fopts = buildFungicideOptions(nz);
            if (fopts) {
                _buildDropdown(productRow, fopts, 'Select product', function(opt) {
                    if (!opt) return;
                    if (aiEl)   aiEl.value   = opt.ai;
                    if (fracEl) fracEl.value = opt.frac;
                    if (keyEl)  keyEl.value  = opt.key;
                    var rateEl = document.getElementById('gaip-sl-f-rate');
                    if (rateEl && opt.rate) {
                        var m = String(opt.rate).match(/[\d.]+/);
                        if (m) rateEl.value = m[0];
                    }
                });
            } else {
                _buildFreeText(productRow, 'e.g. Heritage Maxx');
            }
            if (fracRow) fracRow.style.display = '';
        }
        else if (cat === 'nutrition') {
            var nopts = buildNutritionOptions(nz);
            if (nopts) {
                _buildGroupedDropdown(productRow, nopts, 'Select product', function(opt) {
                    if (!opt) return;
                    if (aiEl)  aiEl.value  = opt.ai;
                    if (keyEl) keyEl.value = opt.key;
                });
            } else {
                _buildFreeText(productRow, 'e.g. product name');
            }
            if (fracRow) fracRow.style.display = 'none';
        }
        else if (cat === 'wetting_agent') {
            var wlist = isUK() || isEU() ? WA_UK : nz ? WA_NZ : WA_AU;
            var wopts = wlist.map(function(name) {
                return { key: name.toLowerCase().replace(/\s+/g,'-'), label: name, ai: '' };
            });
            _buildDropdown(productRow, wopts, 'Select product', function(opt) {
                if (!opt) return;
                if (keyEl) keyEl.value = opt.key;
            });
            if (fracRow) fracRow.style.display = 'none';
        }
        else if (cat === 'pre_emergent') {
            var peopts = isUK() || isEU() ? PRE_EM_UK : nz ? PRE_EM_NZ : PRE_EM_AU;
            _buildDropdown(productRow, peopts, 'Select active ingredient', function(opt) {
                if (!opt) return;
                if (aiEl)  aiEl.value  = opt.ai;
                if (keyEl) keyEl.value = opt.key;
                // Show registration warning for UK products that carry a warn property
                var warnEl = document.getElementById('gaip-sl-pe-warn');
                if (warnEl) warnEl.parentNode.removeChild(warnEl);
                if (opt.warn) {
                    var w = document.createElement('p');
                    w.id = 'gaip-sl-pe-warn';
                    w.className = 'gaip-sl-warn-text';
                    w.textContent = '\u26A0\uFE0F ' + opt.warn;
                    productRow.parentNode.insertBefore(w, productRow.nextSibling);
                }
            });
            if (fracRow) fracRow.style.display = 'none';
        }
        else {
            _buildFreeText(productRow, 'e.g. product name');
            if (fracRow) fracRow.style.display = (cat === 'insecticide') ? '' : 'none';
        }
    }

    function _buildDropdown(row, opts, placeholder, onChange) {
        row.innerHTML = '';
        var label = document.createElement('label');
        label.textContent = 'Product';
        row.appendChild(label);
        var sel = document.createElement('select');
        sel.id = 'gaip-sl-f-product';
        sel.className = 'gaip-sl-select';
        var blank = document.createElement('option');
        blank.value = '';
        blank.textContent = '\u2014 ' + placeholder + ' \u2014';
        sel.appendChild(blank);
        opts.forEach(function(opt) {
            var o = document.createElement('option');
            o.value = opt.label;
            o.dataset.key      = opt.key      || '';
            o.dataset.ai       = opt.ai       || '';
            o.dataset.frac     = opt.frac     || '';
            o.dataset.rate     = opt.rate     || '';
            o.dataset.rateUnit = opt.rateUnit || '';
            o.textContent = opt.label;
            sel.appendChild(o);
        });
        sel.addEventListener('change', function() {
            var s = this.options[this.selectedIndex];
            onChange(s.value ? { key: s.dataset.key, label: s.value, ai: s.dataset.ai, frac: s.dataset.frac, rate: s.dataset.rate, rateUnit: s.dataset.rateUnit } : null);
        });
        row.appendChild(sel);
    }

    function _buildGroupedDropdown(row, opts, placeholder, onChange) {
        row.innerHTML = '';
        var label = document.createElement('label');
        label.textContent = 'Product';
        row.appendChild(label);
        var sel = document.createElement('select');
        sel.id = 'gaip-sl-f-product';
        sel.className = 'gaip-sl-select';
        var blank = document.createElement('option');
        blank.value = '';
        blank.textContent = '\u2014 ' + placeholder + ' \u2014';
        sel.appendChild(blank);
        var groups = {};
        opts.forEach(function(opt) {
            var g = opt.group || 'Other';
            if (!groups[g]) groups[g] = [];
            groups[g].push(opt);
        });
        Object.keys(groups).forEach(function(groupName) {
            var og = document.createElement('optgroup');
            og.label = groupName;
            groups[groupName].forEach(function(opt) {
                var o = document.createElement('option');
                o.value = opt.label;
                o.dataset.key = opt.key || '';
                o.dataset.ai  = opt.ai  || '';
                o.textContent = opt.label;
                og.appendChild(o);
            });
            sel.appendChild(og);
        });
        sel.addEventListener('change', function() {
            var s = this.options[this.selectedIndex];
            onChange(s.value ? { key: s.dataset.key, label: s.value, ai: s.dataset.ai } : null);
        });
        row.appendChild(sel);
    }

    function _buildFreeText(row, placeholder) {
        row.innerHTML = '';
        var label = document.createElement('label');
        label.textContent = 'Product Name';
        row.appendChild(label);
        var inp = document.createElement('input');
        inp.type = 'text';
        inp.id   = 'gaip-sl-f-product';
        inp.placeholder = placeholder;
        inp.className = 'gaip-sl-input';
        row.appendChild(inp);
    }

    function _updateContextualFields(cat) {
        var aiRow = document.getElementById('gaip-sl-ai-row');
        if (!aiRow) return;
        var lbl = aiRow.querySelector('label');
        var inp = document.getElementById('gaip-sl-f-ai');
        if (cat === 'pgr' || cat === 'wetting_agent' || cat === 'pre_emergent') {
            aiRow.style.display = 'none';
        } else if (cat === 'nutrition') {
            aiRow.style.display = '';
            if (lbl) lbl.textContent = 'Analysis (NPK)';
            if (inp) inp.placeholder = 'e.g. N18 P1 K15';
        } else {
            aiRow.style.display = '';
            if (lbl) lbl.textContent = 'Active Ingredient';
            if (inp) inp.placeholder = 'e.g. azoxystrobin';
        }
    }

    // =========================================================================
    // CSS
    // =========================================================================

    function injectStyles() {
        if (document.getElementById('gaip-spray-log-styles')) return;
        var s = document.createElement('style');
        s.id = 'gaip-spray-log-styles';
        s.textContent = [
            '.gaip-spray-log-container{padding:0}',
            '.gaip-sl-toolbar{display:flex;justify-content:space-between;align-items:center;padding:12px 16px;background:var(--gaip-surface-muted);border-bottom:1px solid var(--gaip-border);flex-wrap:wrap;gap:8px}',
            '.gaip-sl-filters{display:flex;gap:8px;align-items:center;flex-wrap:wrap}',
            '.gaip-sl-filters select,.gaip-sl-select{padding:6px 10px;border:1px solid var(--gaip-border);border-radius:6px;font-size:13px;background:var(--gaip-surface);width:100%;box-sizing:border-box;color:var(--gaip-text)}',
            '.gaip-sl-input{width:100%;padding:8px 10px;border:1px solid var(--gaip-border);border-radius:6px;font-size:13px;background:var(--gaip-surface);color:var(--gaip-text);box-sizing:border-box}',
            '.gaip-sl-add-btn{display:inline-flex;align-items:center;gap:6px;padding:8px 14px;background:#2563eb;color:white;border:none;border-radius:6px;font-size:13px;font-weight:500;cursor:pointer}',
            '.gaip-sl-add-btn:hover{background:#1d4ed8}',
            '.gaip-sl-table-wrap{overflow-x:auto}',
            '.gaip-sl-table{width:100%;border-collapse:collapse;font-size:13px}',
            '.gaip-sl-table th{text-align:left;padding:10px 12px;background:var(--gaip-surface-hover);color:var(--gaip-text-secondary);font-weight:500;font-size:11px;text-transform:uppercase;letter-spacing:.05em;border-bottom:1px solid var(--gaip-border);white-space:nowrap}',
            '.gaip-sl-table td{padding:10px 12px;border-bottom:1px solid var(--gaip-surface-hover);color:var(--gaip-text)}',
            '.gaip-sl-table tr:hover td{background:var(--gaip-surface-muted)}',
            '.gaip-sl-badge{display:inline-block;padding:2px 8px;border-radius:10px;font-size:11px;font-weight:500}',
            '.gaip-sl-badge-greens{background:var(--gaip-good-bg);color:#065f46}',
            '.gaip-sl-badge-tees{background:var(--gaip-info-bg);color:#1e40af}',
            '.gaip-sl-badge-fairways{background:var(--gaip-warning-bg);color:#92400e}',
            '.gaip-sl-badge-fungicide{background:var(--gaip-critical-bg);color:#9d174d}',
            '.gaip-sl-badge-pgr{background:var(--gaip-info-bg);color:#5b21b6}',
            '.gaip-sl-badge-nutrition{background:var(--gaip-good-bg);color:#065f46}',
            '.gaip-sl-badge-wetting_agent{background:var(--gaip-info-bg);color:#0369a1}',
            '.gaip-sl-badge-pre_emergent{background:var(--gaip-warning-bg);color:#854d0e}',
            '.gaip-sl-badge-insecticide{background:var(--gaip-critical-bg);color:#991b1b}',
            '.gaip-sl-badge-rec{background:var(--gaip-info-bg);color:#1e40af;font-size:10px}',
            '.gaip-sl-badge-manual{background:var(--gaip-surface-hover);color:var(--gaip-text-secondary);font-size:10px}',
            '.gaip-sl-actions button{padding:4px 8px;border:1px solid var(--gaip-border);border-radius:4px;background:var(--gaip-surface);font-size:11px;cursor:pointer;color:var(--gaip-text-secondary);margin-right:2px}',
            '.gaip-sl-actions .del:hover{background:var(--gaip-critical-bg);color:#dc2626;border-color:var(--gaip-critical-border)}',
            '.gaip-sl-empty{text-align:center;padding:48px 24px;color:var(--gaip-text-muted)}',
            '.gaip-sl-empty-icon{font-size:32px;margin-bottom:12px}',
            '.gaip-sl-form{padding:16px;background:var(--gaip-surface-muted);border-bottom:2px solid #2563eb;display:none}',
            '.gaip-sl-form.visible{display:block}',
            '.gaip-sl-form-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:12px}',
            '.gaip-sl-field label{display:block;font-size:11px;font-weight:500;color:var(--gaip-text-secondary);margin-bottom:4px;text-transform:uppercase;letter-spacing:.05em}',
            '.gaip-sl-field input,.gaip-sl-field select,.gaip-sl-field textarea{width:100%;padding:8px 10px;border:1px solid var(--gaip-border);border-radius:6px;font-size:13px;background:var(--gaip-surface);color:var(--gaip-text);box-sizing:border-box}',
            '.gaip-sl-field textarea{resize:vertical;min-height:60px}',
            '.gaip-sl-zones-grid{display:flex;gap:6px;flex-wrap:wrap}',
            '.gaip-sl-zone-chk{display:inline-flex;align-items:center;gap:4px;padding:4px 10px;border:1px solid var(--gaip-border);border-radius:16px;font-size:12px;cursor:pointer;user-select:none;transition:all .15s}',
            '.gaip-sl-zone-chk.checked{background:#2563eb;color:white;border-color:#2563eb}',
            '.gaip-sl-form-btns{display:flex;gap:8px;margin-top:12px;padding-top:12px;border-top:1px solid var(--gaip-border)}',
            '.gaip-sl-form-btns button{padding:8px 16px;border-radius:6px;font-size:13px;font-weight:500;cursor:pointer;border:1px solid transparent}',
            '.gaip-sl-btn-save{background:#2563eb;color:white}',
            '.gaip-sl-btn-save:hover{background:#1d4ed8}',
            '.gaip-sl-btn-save:disabled{background:#93c5fd;cursor:not-allowed}',
            '.gaip-sl-btn-cancel{background:var(--gaip-surface);color:var(--gaip-text-secondary);border-color:var(--gaip-border)}',
            '.gaip-sl-btn-cancel:hover{background:var(--gaip-surface-muted)}',
            '.gaip-log-app-btn{display:inline-flex;align-items:center;gap:4px;padding:6px 12px;background:var(--gaip-good-bg);color:#166534;border:1px solid var(--gaip-good-bg);border-radius:6px;font-size:12px;font-weight:500;cursor:pointer;margin-top:8px;transition:all .15s}',
            '.gaip-log-app-btn:hover{background:var(--gaip-good-bg);border-color:#86efac}',
            '.gaip-log-app-btn.logged{background:var(--gaip-good-bg);color:#065f46;cursor:default;border-color:var(--gaip-good-border)}',
            '.gaip-log-app-btn.logging{opacity:.6;cursor:wait}',
            '.gaip-sl-loading{text-align:center;padding:32px;color:var(--gaip-text-muted)}',
            '.gaip-sl-residual{display:inline-flex;align-items:center;gap:5px;font-size:12px;font-weight:600}',
            '.gaip-sl-residual-bar{display:inline-block;width:36px;height:6px;border-radius:3px;background:var(--gaip-border);overflow:hidden;vertical-align:middle}',
            '.gaip-sl-residual-fill{height:100%;border-radius:3px;transition:width .3s}',
            '.gaip-sl-residual-high .gaip-sl-residual-fill{background:#16a34a}',
            '.gaip-sl-residual-medium .gaip-sl-residual-fill{background:#ca8a04}',
            '.gaip-sl-residual-low .gaip-sl-residual-fill{background:#dc2626}',
            '.gaip-sl-residual-high{color:#166534}',
            '.gaip-sl-residual-medium{color:#92400e}',
            '.gaip-sl-residual-low{color:#991b1b}',
            '.gaip-sl-reapply-flag{display:inline-block;padding:1px 6px;border-radius:8px;font-size:10px;font-weight:600;background:var(--gaip-critical-bg);color:#dc2626;border:1px solid var(--gaip-critical-border);margin-left:4px}',
            '.gaip-sl-residual-na{color:var(--gaip-text-muted);font-size:11px}',
            '.gaip-sl-region-note{font-size:11px;color:var(--gaip-text-muted);font-style:italic;padding:4px 0 8px}',
            '@media(max-width:768px){.gaip-sl-form-grid{grid-template-columns:1fr 1fr}.gaip-sl-toolbar{flex-direction:column;align-items:stretch}}'
        ].join('\n');
        document.head.appendChild(s);
    }

    // =========================================================================
    // BUILD TAB SECTION
    // =========================================================================

    function buildSection() {
        var section = document.createElement('div');
        section.id = 'gaip-spray-log-section';
        section.className = 'gaip-rc gaip-spray-log-container';
        section.setAttribute('data-group', 'spray-log');

        var nz = isNZ();
        var regionNote = isUK()
            ? 'Region: UK & Ireland \u2014 UK product lists active'
            : isEU()
                ? 'Region: Europe \u2014 European product lists active'
                : nz
                    ? 'Region: New Zealand \u2014 NZ product lists active'
                    : 'Region: Australia \u2014 AU product lists active';

        var catOpts = CATEGORIES.map(function(c) {
            return '<option value="' + c.id + '">' + c.icon + ' ' + c.label + '</option>';
        }).join('');
        var zoneOpts = ZONES.map(function(z) {
            return '<option value="' + z.id + '">' + z.icon + ' ' + z.label + '</option>';
        }).join('');
        var zoneChks = ZONES.map(function(z) {
            return '<span class="gaip-sl-zone-chk' + (z.id === 'greens' ? ' checked' : '') + '" data-zone="' + z.id + '">' + z.icon + ' ' + z.label + '</span>';
        }).join('');
        var rateUnitOpts = RATE_UNITS.map(function(u) { return '<option value="' + u + '">' + u + '</option>'; }).join('');

        section.innerHTML = '<div class="gaip-rc-header" style="display:flex;justify-content:space-between;align-items:center;padding:12px 16px;">'
            + '<h3 class="gaip-rc-title" style="margin:0;font-size:16px;font-weight:600;">\uD83D\uDCCB Spray Log</h3>'
            + '<span id="gaip-sl-count" style="font-size:12px;color:var(--gaip-text-muted);"></span>'
            + '</div>'
            + '<div class="gaip-sl-form" id="gaip-sl-form">'
            + '<div class="gaip-sl-region-note" id="gaip-sl-region-note">' + regionNote + '</div>'
            + '<div class="gaip-sl-form-grid">'
            + '<div class="gaip-sl-field"><label>Date</label><input type="date" id="gaip-sl-f-date" value="' + todayISO() + '"></div>'
            + '<div class="gaip-sl-field"><label>Category</label><select id="gaip-sl-f-cat">' + catOpts + '</select></div>'
            + '<div class="gaip-sl-field" id="gaip-sl-product-row"><label>Product Name</label><input type="text" id="gaip-sl-f-product" class="gaip-sl-input" placeholder="e.g. Heritage Maxx"></div>'
            + '<input type="hidden" id="gaip-sl-f-key">'
            + '<div class="gaip-sl-field" id="gaip-sl-ai-row"><label>Active Ingredient</label><input type="text" id="gaip-sl-f-ai" class="gaip-sl-input" placeholder="e.g. azoxystrobin"></div>'
            + '<div class="gaip-sl-field" id="gaip-sl-frac-row"><label>FRAC Group</label><input type="text" id="gaip-sl-f-frac" class="gaip-sl-input" placeholder="e.g. 11" style="max-width:80px;"></div>'
            + '<div class="gaip-sl-field"><label>Rate</label><div style="display:flex;gap:4px;"><input type="number" id="gaip-sl-f-rate" step="0.1" placeholder="0.0" style="flex:1;padding:8px 10px;border:1px solid var(--gaip-border);border-radius:6px;font-size:13px;"><select id="gaip-sl-f-unit" style="width:auto;padding:8px 6px;border:1px solid var(--gaip-border);border-radius:6px;font-size:13px;">' + rateUnitOpts + '</select></div></div>'
            + '<div class="gaip-sl-field"><label>Water Volume (L/ha)</label><input type="number" id="gaip-sl-f-water" step="10" placeholder="400" class="gaip-sl-input"></div>'
            + '<div class="gaip-sl-field"><label>Target</label><input type="text" id="gaip-sl-f-target" class="gaip-sl-input" placeholder="e.g. Dollar Spot"></div>'
            + '</div>'
            + '<div class="gaip-sl-field" style="margin-top:12px;"><label>Zones Applied</label><div class="gaip-sl-zones-grid" id="gaip-sl-f-zones">' + zoneChks + '</div></div>'
            + '<div class="gaip-sl-field" style="margin-top:8px;"><label>Notes</label><textarea id="gaip-sl-f-notes" placeholder="Optional notes..."></textarea></div>'
            + '<div class="gaip-sl-form-btns"><button class="gaip-sl-btn-save" id="gaip-sl-save">\uD83D\uDCBE Save Entry</button><button class="gaip-sl-btn-cancel" id="gaip-sl-cancel">Cancel</button></div>'
            + '</div>'
            + '<div class="gaip-sl-toolbar">'
            + '<div class="gaip-sl-filters">'
            + '<select id="gaip-sl-flt-zone"><option value="">All Zones</option>' + zoneOpts + '</select>'
            + '<select id="gaip-sl-flt-cat"><option value="">All Categories</option>' + catOpts + '</select>'
            + '<select id="gaip-sl-flt-days"><option value="90">Last 90 days</option><option value="180">Last 6 months</option><option value="365" selected>Last 12 months</option></select>'
            + '</div>'
            + '<button class="gaip-sl-add-btn" id="gaip-sl-add-btn">\uFF0B Log Application</button>'
            + '</div>'
            + '<div id="gaip-sl-body"><div class="gaip-sl-loading">Loading spray log...</div></div>';

        return section;
    }

    // =========================================================================
    // RENDER TABLE
    // =========================================================================

    function renderTable(entries) {
        var body  = document.getElementById('gaip-sl-body');
        var count = document.getElementById('gaip-sl-count');
        if (!body) return;

        if (!entries || entries.length === 0) {
            body.innerHTML = '<div class="gaip-sl-empty"><div class="gaip-sl-empty-icon">\uD83D\uDCCB</div><p><strong>No applications logged yet</strong></p><p>Click \u201CLog Application\u201D to record your first spray.</p></div>';
            if (count) count.textContent = '';
            return;
        }
        if (count) count.textContent = entries.length + ' entries';

        var residualMap = {};
        var uvEngine = global.GAIP_UV_RESIDUAL;
        if (uvEngine) {
            var climateMetrics = global.climateMetrics || (global.GAIP_STATE && global.GAIP_STATE.computed && global.GAIP_STATE.computed.climate);
            entries.forEach(function(e) {
                if (e.product_category === 'fungicide' && e.active_ingredient && e.application_date) {
                    try {
                        var ch = climateMetrics ? uvEngine.buildClimateHistoryFromGAIP(climateMetrics, e.application_date) : [];
                        residualMap[e.log_id] = uvEngine.calculateResidualEfficacy({
                            activeIngredient: _normaliseActiveKey(e.active_ingredient),
                            applicationDate:  e.application_date,
                            ratePercent:      e.rate_percent || 100
                        }, ch);
                    } catch(err) {}
                }
            });
        }

        var html = '<div class="gaip-sl-table-wrap"><table class="gaip-sl-table"><thead><tr>'
            + '<th>Date</th><th>Zone</th><th>Product</th><th>Category</th>'
            + '<th>Rate</th><th>Target</th>'
            + '<th style="cursor:help;" title="Residual index — fungicide only. UV/rain/biological degradation model.">Residual \u24D8</th>'
            + '<th>Source</th><th></th>'
            + '</tr></thead><tbody>';

        entries.forEach(function(e) {
            var SL = global.GAIP_SprayLog;
            var dateStr   = SL ? SL.formatDate(e.application_date) : e.application_date;
            var daysAgo   = SL ? SL.daysBetween(e.application_date) : '';
            var daysLabel = daysAgo !== '' ? ' <span style="color:var(--gaip-text-muted);font-size:11px;">(' + daysAgo + 'd ago)</span>' : '';
            var rateStr   = e.rate ? e.rate + ' ' + (e.rate_unit || '') : '\u2014';
            var fracLabel = e.frac_group ? ' <span style="color:var(--gaip-text-muted);font-size:11px;">FRAC ' + e.frac_group + '</span>' : '';

            html += '<tr data-logid="' + e.log_id + '">'
                + '<td>' + dateStr + daysLabel + '</td>'
                + '<td><span class="gaip-sl-badge gaip-sl-badge-' + e.zone + '">' + getZoneLabel(e.zone) + '</span></td>'
                + '<td><strong>' + escHtml(e.product_name) + '</strong>' + fracLabel + '<br><span style="color:var(--gaip-text-muted);font-size:11px;">' + escHtml(e.active_ingredient || '') + '</span></td>'
                + '<td><span class="gaip-sl-badge gaip-sl-badge-' + e.product_category + '">' + getCategoryLabel(e.product_category) + '</span></td>'
                + '<td>' + rateStr + '</td>'
                + '<td>' + escHtml(e.target || '\u2014') + '</td>'
                + '<td>' + _buildResidualCell(residualMap[e.log_id], e.product_category, e.application_date) + '</td>'
                + '<td><span class="gaip-sl-badge gaip-sl-badge-' + e.source + '">' + e.source + '</span></td>'
                + '<td class="gaip-sl-actions"><button class="del" data-logid="' + e.log_id + '" title="Delete">\uD83D\uDDD1</button></td>'
                + '</tr>';
        });

        html += '</tbody></table></div>';
        body.innerHTML = html;

        body.querySelectorAll('.del').forEach(function(btn) {
            btn.addEventListener('click', async function() {
                var id = this.getAttribute('data-logid');
                if (!confirm('Delete this application entry?')) return;
                var result = await global.GAIP_SprayLog.remove(id);
                if (result.success) loadEntries();
            });
        });
    }

    // =========================================================================
    // RESIDUAL HELPERS
    // =========================================================================

    function _buildResidualCell(result, category, applicationDate) {
        if (category !== 'fungicide') return '<span class="gaip-sl-residual-na">\u2014</span>';
        if (!result || result.residualPct === null || result.error) {
            // b35fix203b: same-day applications have zero elapsed time — UV engine returns
            // no-climate-data error. Show 100% (just applied) rather than n/a.
            if (applicationDate) {
                var appDay = applicationDate.split('T')[0];
                var today  = new Date().toISOString().split('T')[0];
                if (appDay === today) {
                    return '<span class="gaip-sl-residual gaip-sl-residual-high" title="Applied today — residual at 100%"><span class="gaip-sl-residual-bar"><span class="gaip-sl-residual-fill" style="width:100%"></span></span> 100%</span>';
                }
            }
            var reason = result && result.error ? result.error : 'No UV data';
            return '<span class="gaip-sl-residual-na" title="' + escHtml(reason) + '">n/a</span>';
        }
        var pct  = result.residualPct;
        var tier = pct >= 70 ? 'high' : pct >= 40 ? 'medium' : 'low';
        var badge = result.reapplyFlag ? '<span class="gaip-sl-reapply-flag">\u21BA Review</span>' : '';
        var bd = result.breakdown;
        var tip = 'Residual: ' + pct + '%' + (bd ? ' | UV: ' + bd.uvSurvival + '% Rain: ' + bd.rainSurvival + '% Bio: ' + bd.bioSurvival + '%' : '') + (result.dataSource ? ' | ' + result.dataSource : '');
        return '<span class="gaip-sl-residual gaip-sl-residual-' + tier + '" title="' + escHtml(tip) + '"><span class="gaip-sl-residual-bar"><span class="gaip-sl-residual-fill" style="width:' + pct + '%"></span></span> ' + pct + '%' + badge + '</span>';
    }

    function _normaliseActiveKey(raw) {
        if (!raw) return '';
        var s = raw.toLowerCase().replace(/\s*\d+\s*(g\/l|g\/kg|sc|wp|wg|ec|fl|df|sl|se|me)\b/g,'').replace(/[^a-z\s-]/g,'').trim();
        var MAP = {'chlorothalonil':'chlorothalonil','bravo':'chlorothalonil','daconil':'chlorothalonil','mancozeb':'mancozeb','dithane':'mancozeb','penncozeb':'mancozeb','thiophanate-methyl':'thiophanateMethyl','thiophanate methyl':'thiophanateMethyl','thiabendazole':'thiabendazole','vorlon':'thiabendazole','iprodione':'iprodione','voltar':'iprodione','ippon':'iprodione','procymidone':'procymidone','sumisclex':'procymidone','propiconazole':'propiconazole','banner':'propiconazole','regiment':'propiconazole','tebuconazole':'tebuconazole','dedicate':'tebuconazole','triticonazole':'triticonazole','tribeca':'triticonazole','triadimenol':'triadimenol','citadel':'triadimenol','myclobutanil':'myclobutanil','systhane':'myclobutanil','boscalid':'boscalid','fluxapyroxad':'fluxapyroxad','xzemplar':'fluxapyroxad','penthiopyrad':'penthiopyrad','velista':'penthiopyrad','azoxystrobin':'azoxystrobin','heritage':'azoxystrobin','trifloxystrobin':'trifloxystrobin','patriot':'trifloxystrobin','pyraclostrobin':'pyraclostrobin','insignia':'pyraclostrobin','mandestrobin':'mandestrobin','rapidol':'mandestrobin','fludioxonil':'fludioxonil','medallion':'fludioxonil','sceptre':'fludioxonil','etridiazole':'etridiazole','terrazole':'etridiazole','tolclofos-methyl':'tolclofosMethyl','tolclofos methyl':'tolclofosMethyl','cyazofamid':'cyazofamid','segway':'cyazofamid','propamocarb':'propamocarb','schrapnel':'propamocarb','fluazinam':'fluazinam','compass':'fluazinam','emerald':'fluazinam','fosetyl-al':'fosetylAl','fosetyl al':'fosetylAl','grenadier':'fosetylAl','oxathiapiprolin':'oxathiapiprolin','segovis':'oxathiapiprolin'};
        if (MAP[s]) return MAP[s];
        for (var k in MAP) { if (s.indexOf(k) !== -1) return MAP[k]; }
        return s.replace(/\s+/g,'');
    }

    function escHtml(s) {
        if (!s) return '';
        var d = document.createElement('div');
        d.textContent = s;
        return d.innerHTML;
    }

    // =========================================================================
    // LOAD ENTRIES
    // =========================================================================

    async function loadEntries() {
        if (!global.GAIP_SprayLog) return;
        _isLoading = true;
        var body = document.getElementById('gaip-sl-body');
        if (body) body.innerHTML = '<div class="gaip-sl-loading">Loading...</div>';
        var zf = document.getElementById('gaip-sl-flt-zone');
        var cf = document.getElementById('gaip-sl-flt-cat');
        var df = document.getElementById('gaip-sl-flt-days');
        var result = await global.GAIP_SprayLog.list({
            zone:     zf ? zf.value : '',
            category: cf ? cf.value : '',
            days:     df ? parseInt(df.value) : 365,
            limit:    200
        });
        _isLoading = false;
        if (result.success) {
            _entries = result.entries || [];
            renderTable(_entries);
        } else {
            if (body) body.innerHTML = '<div class="gaip-sl-empty"><p>Could not load spray log.</p><p style="font-size:12px;color:#dc2626;">' + escHtml(result.error || '') + '</p></div>';
        }
    }

    // =========================================================================
    // FORM HANDLING
    // =========================================================================

    function toggleForm(show) {
        var form = document.getElementById('gaip-sl-form');
        if (!form) return;
        if (show) {
            form.classList.add('visible');
            document.getElementById('gaip-sl-f-date').value = todayISO();
            // Refresh region note in case site switched
            var nz = isNZ();
            var note = document.getElementById('gaip-sl-region-note');
            if (note) note.textContent = isUK()
                ? 'Region: UK & Ireland \u2014 UK product lists active'
                : isEU()
                    ? 'Region: Europe \u2014 European product lists active'
                    : nz
                        ? 'Region: New Zealand \u2014 NZ product lists active'
                        : 'Region: Australia \u2014 AU product lists active';
            onCategoryChange(document.getElementById('gaip-sl-f-cat').value || 'fungicide');
        } else {
            form.classList.remove('visible');
            resetForm();
        }
    }

    function resetForm() {
        document.getElementById('gaip-sl-f-date').value = todayISO();
        document.getElementById('gaip-sl-f-cat').value  = 'fungicide';
        ['gaip-sl-f-rate','gaip-sl-f-water','gaip-sl-f-target','gaip-sl-f-notes',
         'gaip-sl-f-ai','gaip-sl-f-frac','gaip-sl-f-key'].forEach(function(id) {
            var el = document.getElementById(id);
            if (el) el.value = '';
        });
        document.querySelectorAll('#gaip-sl-f-zones .gaip-sl-zone-chk').forEach(function(el) {
            el.classList.remove('checked');
        });
        var greens = document.querySelector('#gaip-sl-f-zones .gaip-sl-zone-chk[data-zone="greens"]');
        if (greens) greens.classList.add('checked');
    }

    function getFormData() {
        var zones = [];
        document.querySelectorAll('#gaip-sl-f-zones .gaip-sl-zone-chk.checked').forEach(function(el) {
            zones.push(el.getAttribute('data-zone'));
        });
        if (zones.length === 0) zones.push('greens');
        var productEl = document.getElementById('gaip-sl-f-product');
        var productName = productEl ? (productEl.value || '').trim() : '';
        return {
            application_date:  document.getElementById('gaip-sl-f-date').value,
            product_category:  document.getElementById('gaip-sl-f-cat').value,
            product_name:      productName,
            product_key:       (document.getElementById('gaip-sl-f-key')  || {}).value || null,
            active_ingredient: ((document.getElementById('gaip-sl-f-ai')  || {}).value || '').trim() || null,
            frac_group:        ((document.getElementById('gaip-sl-f-frac')|| {}).value || '').trim() || null,
            rate:              document.getElementById('gaip-sl-f-rate').value ? parseFloat(document.getElementById('gaip-sl-f-rate').value) : null,
            rate_unit:         document.getElementById('gaip-sl-f-unit').value,
            water_volume:      document.getElementById('gaip-sl-f-water').value ? parseFloat(document.getElementById('gaip-sl-f-water').value) : null,
            target:            ((document.getElementById('gaip-sl-f-target') || {}).value || '').trim() || null,
            notes:             ((document.getElementById('gaip-sl-f-notes')  || {}).value || '').trim() || null,
            source: 'manual',
            zones: zones.length > 1 ? zones : undefined,
            zone:  zones.length === 1 ? zones[0] : undefined
        };
    }

    async function handleSave() {
        var data = getFormData();
        if (!data.product_name) { alert('Please select or enter a product.'); return; }
        if (!data.application_date) { alert('Application date is required.'); return; }
        var saveBtn = document.getElementById('gaip-sl-save');
        if (saveBtn) { saveBtn.disabled = true; saveBtn.textContent = 'Saving...'; }
        var result = await global.GAIP_SprayLog.create(data);
        if (saveBtn) { saveBtn.disabled = false; saveBtn.textContent = '\uD83D\uDCBE Save Entry'; }
        if (result.success || result.count > 0) {
            toggleForm(false);
            loadEntries();
            // b35fix204: if a PGR entry was just saved, propagate directly to
            // the PGR module and chart without going through the event chain.
            // GAIP_SprayCascade.refreshPGRFromEntry writes the inputs and
            // redraws the chart in one clean call.
            if (data.product_category === 'pgr' &&
                data.product_key && data.application_date &&
                global.GAIP_SprayCascade &&
                typeof global.GAIP_SprayCascade.refreshPGRFromEntry === 'function') {
                global.GAIP_SprayCascade.refreshPGRFromEntry(data);
            }
        } else {
            alert('Error saving entry: ' + (result.error || (result.errors && result.errors.join(', ')) || 'Unknown error'));
        }
    }

    // =========================================================================
    // WIRE EVENTS
    // =========================================================================

    function wireEvents() {
        var addBtn    = document.getElementById('gaip-sl-add-btn');
        var cancelBtn = document.getElementById('gaip-sl-cancel');
        var saveBtn   = document.getElementById('gaip-sl-save');
        var catSel    = document.getElementById('gaip-sl-f-cat');
        if (addBtn)    addBtn.addEventListener('click', function() { toggleForm(true); });
        if (cancelBtn) cancelBtn.addEventListener('click', function() { toggleForm(false); });
        if (saveBtn)   saveBtn.addEventListener('click', handleSave);
        if (catSel)    catSel.addEventListener('change', function() { onCategoryChange(this.value); });

        document.querySelectorAll('#gaip-sl-f-zones .gaip-sl-zone-chk').forEach(function(el) {
            el.addEventListener('click', function() { this.classList.toggle('checked'); });
        });
        ['gaip-sl-flt-zone','gaip-sl-flt-cat','gaip-sl-flt-days'].forEach(function(id) {
            var el = document.getElementById(id);
            if (el) el.addEventListener('change', loadEntries);
        });
        document.addEventListener('gaip:spray-log-updated', function() { loadEntries(); });
        document.addEventListener('gaip:site-changed', function() {
            if (global.GAIP_SprayLog && global.GAIP_SprayLog.invalidateCache) global.GAIP_SprayLog.invalidateCache();
            loadEntries();
            // b35fix294: rebuild product dropdown for current category —
            // region detection may return a different region after site-switch
            var catSel = document.getElementById('gaip-sl-f-cat');
            if (catSel && catSel.value) {
                onCategoryChange(catSel.value);
            }
        });
        document.addEventListener('gaip:cascade-complete', function() {
            if (_entries && _entries.length) renderTable(_entries);
        });
    }

    // =========================================================================
    // LOG APPLICATION BUTTON FACTORY
    // =========================================================================

    function createLogButton(opts) {
        var btn = document.createElement('button');
        btn.className = 'gaip-log-app-btn';
        btn.innerHTML = '\uD83D\uDCCB Log Application';
        btn.title = 'Log ' + opts.productName + ' application to spray diary';
        btn.addEventListener('click', async function(e) {
            e.preventDefault(); e.stopPropagation();
            if (this.classList.contains('logged') || this.classList.contains('logging')) return;
            this.classList.add('logging');
            this.innerHTML = '\u23F3 Logging...';
            try {
                var result = await global.GAIP_SprayLog.createFromRecommendation(opts);
                if (result.success || result.count > 0) {
                    this.classList.remove('logging'); this.classList.add('logged');
                    this.innerHTML = '\u2705 Logged';
                } else {
                    this.classList.remove('logging');
                    this.innerHTML = '\u274C Error \u2014 retry';
                    var self = this;
                    setTimeout(function() { self.innerHTML = '\uD83D\uDCCB Log Application'; }, 3000);
                }
            } catch(err) {
                this.classList.remove('logging');
                this.innerHTML = '\u274C Error';
                console.error(LOG_PREFIX, 'Log from recommendation failed:', err);
            }
        });
        return btn;
    }

    // =========================================================================
    // INITIALISATION
    // =========================================================================

    var _initialised = false;

    function init() {
        if (_initialised) return;
        _initialised = true;
        injectStyles();
        var resultsArea = document.querySelector('.gaip-result-cards')
            || document.querySelector('.gaip-results')
            || document.querySelector('.gaip-hub-container')
            || document.querySelector('#gaip-hub');
        if (!resultsArea) { setTimeout(init, 1000); return; }
        var section = buildSection();
        resultsArea.appendChild(section);
        wireEvents();
        onCategoryChange('fungicide');
        setTimeout(loadEntries, 500);
    }

    // =========================================================================
    // PUBLIC API
    // =========================================================================

    global.GAIP_SprayLogUI = {
        version: VERSION,
        init: init,
        createLogButton: createLogButton,
        loadEntries: loadEntries,
        toggleForm: toggleForm,
        getEntries: function() { return _entries; }
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function() { setTimeout(init, 300); });
    } else {
        setTimeout(init, 300);
    }

})(typeof window !== 'undefined' ? window : this);
