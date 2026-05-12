/**
 * =============================================================================
 * GILBA SITE DASHBOARD v2.0.0
 * =============================================================================
 *
 * Unified site management dashboard — always visible at the top of the hub.
 *
 * FEATURES:
 *   - Shows up to 6 most recently updated sites as clickable cards
 *   - Searchable combobox for accessing the full site list (scales to 50+)
 *   - Zone breakdown tooltip on sample count hover (e.g. 18 greens, 18 fairways)
 *   - Overflow indicator when sites exceed card limit
 *   - Active site pinned into card view if not in recent 6
 *   - Inline add/rename (no prompt() dialogs)
 *   - Per-site and global JSON export/backup
 *   - Persistent auto-save status indicator
 *   - Storage abstraction layer for future server-side migration
 *
 * DEPENDENCIES:
 *   - sample-manager.js (GAIP_SampleManager)
 *   - site-config-persistence.js (GAIP_SiteConfig)
 *   - hub-persistence.js (GilbaPersistence)
 *
 * LOAD ORDER: After dependencies listed above.
 *
 * @author Gilba Solutions
 * @version 2.0.0
 * =============================================================================
 */
(function(global) {
    'use strict';

    var VERSION = '2.0.0';
    var DEBUG = false;
    var DASHBOARD_ID = 'gaip-site-dashboard';
    var MAX_CARDS = 6;
    var MAX_INIT_RETRIES = 15;

    // Zone icons matching sample-switcher-ui.js ZONE_LABELS
    var ZONE_ICONS = {
        green: '\uD83D\uDFE2', fairway: '\uD83C\uDF3F', tee: '\u26F3', rough: '\uD83C\uDF3E',
        approach: '\uD83C\uDFAF', collar: '\u2B55', bunker: '\uD83C\uDFD6\uFE0F',
        sports_pitch: '\u26BD', goal_area: '\uD83E\uDD45', centre: '\u25C9',
        bore: '\uD83D\uDCA7', recycled: '\u267B\uFE0F', potable: '\uD83D\uDEB0',
        surface: '\uD83C\uDF0A', other: '\uD83D\uDCCD'
    };

    var TYPE_LABELS = {
        soil: '\uD83E\uDDEA Soil',
        water: '\uD83D\uDCA7 Water',
        tissue: '\uD83C\uDF3F Tissue'
    };

    // =========================================================================
    // LOGGING
    // =========================================================================

    function log() {
        if (!DEBUG) return;
        var args = ['[SiteDashboard]'].concat(Array.prototype.slice.call(arguments));
        console.log.apply(console, args);
    }

    function warn() {
        var args = ['[SiteDashboard]'].concat(Array.prototype.slice.call(arguments));
        console.warn.apply(console, args);
    }

    // =========================================================================
    // STORAGE ABSTRACTION LAYER
    // =========================================================================

    var StorageAdapter = {

        getSiteList: function() {
            var SM = global.GAIP_SampleManager;
            return SM ? SM.getSiteList() : [];
        },

        getActiveSiteId: function() {
            var SM = global.GAIP_SampleManager;
            return SM ? SM.getActiveSiteId() : 'default';
        },

        setActiveSite: function(siteId) {
            var SM = global.GAIP_SampleManager;
            if (SM) SM.setActiveSite(siteId);
        },

        addSite: function(label) {
            var SM = global.GAIP_SampleManager;
            return SM ? SM.addSite(label) : null;
        },

        renameSite: function(siteId, newLabel) {
            var SM = global.GAIP_SampleManager;
            if (SM) SM.renameSite(siteId, newLabel);
        },

        removeSite: function(siteId) {
            var SM = global.GAIP_SampleManager;
            if (SM) SM.removeSite(siteId);
        },

        /**
         * Get sample counts AND zone breakdown for a site.
         * Returns { soil: { total, zones: {green: 5, fairway: 3} }, water: {...}, tissue: {...} }
         */
        getSampleBreakdown: function(siteId) {
            var SM = global.GAIP_SampleManager;
            if (!SM) return { soil: { total: 0, zones: {} }, water: { total: 0, zones: {} }, tissue: { total: 0, zones: {} } };

            var allData = SM.getAllSamples();
            var currentId = SM.getActiveSiteId();
            var siteStore;

            if (siteId === currentId) {
                // Current site: read from live proxied store
                siteStore = {};
                var types = ['soil', 'water', 'tissue'];
                for (var t = 0; t < types.length; t++) {
                    var samples = SM.getSamples(types[t]);
                    siteStore[types[t]] = {};
                    if (samples) {
                        for (var s = 0; s < samples.length; s++) {
                            var sid = samples[s].id || samples[s].sampleId;
                            siteStore[types[t]][sid] = samples[s];
                        }
                    }
                }
            } else {
                siteStore = (allData.allSites && allData.allSites[siteId]) || {};
            }

            var result = {};
            var dataTypes = ['soil', 'water', 'tissue'];
            for (var i = 0; i < dataTypes.length; i++) {
                var dt = dataTypes[i];
                var store = siteStore[dt] || {};
                var keys = Object.keys(store);
                var zones = {};
                for (var k = 0; k < keys.length; k++) {
                    var sample = store[keys[k]];
                    var zone = (sample && sample.zoneType) || 'other';
                    zones[zone] = (zones[zone] || 0) + 1;
                }
                result[dt] = { total: keys.length, zones: zones };
            }
            return result;
        },

        getSiteConfig: function(siteId) {
            var SC = global.GAIP_SiteConfig;
            return SC ? SC.getConfig(siteId) : null;
        },

        exportSite: function(siteId) {
            var SM = global.GAIP_SampleManager;
            var SC = global.GAIP_SiteConfig;
            var allData = SM ? SM.getAllSamples() : {};
            var config = SC ? SC.getConfig(siteId) : null;
            var siteInfo = (allData.sites && allData.sites[siteId]) || {};
            return {
                exportVersion: '2.0.0',
                exportedAt: new Date().toISOString(),
                siteId: siteId,
                label: siteInfo.label || siteId,
                config: config,
                samples: (allData.allSites && allData.allSites[siteId]) || {},
                activeSamples: (allData.allActive && allData.allActive[siteId]) || {},
                meta: (allData.allMeta && allData.allMeta[siteId]) || {}
            };
        },

        exportAll: function() {
            var SM = global.GAIP_SampleManager;
            var SC = global.GAIP_SiteConfig;
            var allData = SM ? SM.getAllSamples() : {};
            var allConfigs = SC ? SC.getAllConfigs() : {};
            return {
                exportVersion: '2.0.0',
                exportedAt: new Date().toISOString(),
                sites: allData.sites || {},
                allSamples: allData.allSites || {},
                allActive: allData.allActive || {},
                allMeta: allData.allMeta || {},
                configs: allConfigs,
                currentSite: allData.currentSite || 'default'
            };
        },

        getLastSaveTime: function() {
            var HP = global.GilbaPersistence;
            return HP ? HP.getLastSaveTime() : null;
        }
    };

    // =========================================================================
    // UTILITIES
    // =========================================================================

    function esc(str) {
        if (!str) return '';
        var d = document.createElement('div');
        d.textContent = str;
        return d.innerHTML;
    }

    function formatRelativeTime(isoString) {
        if (!isoString) return 'never';
        var then = new Date(isoString);
        var now = new Date();
        var diffMs = now - then;
        var diffSec = Math.floor(diffMs / 1000);
        var diffMin = Math.floor(diffSec / 60);
        var diffHr = Math.floor(diffMin / 60);
        var diffDay = Math.floor(diffHr / 24);
        if (diffSec < 10) return 'just now';
        if (diffSec < 60) return diffSec + 's ago';
        if (diffMin < 60) return diffMin + 'm ago';
        if (diffHr < 24) return diffHr + 'h ago';
        if (diffDay < 7) return diffDay + 'd ago';
        return then.toLocaleDateString();
    }

    function formatSpeciesName(species) {
        if (!species) return '';
        return species.replace(/[_-]/g, ' ').replace(/\b\w/g, function(c) { return c.toUpperCase(); });
    }

    function formatTurfType(turfType, subCategory) {
        var types = { golf: 'Golf', sports: 'Sports', lawns: 'Lawn' };
        var subs = { greens: 'Green', fairways: 'Fairway', tees: 'Tee', roughs: 'Rough', approaches: 'Approach', stadium: 'Stadium', training: 'Training', municipal: 'Municipal' };
        var parts = [];
        if (types[turfType]) parts.push(types[turfType]);
        if (subs[subCategory]) parts.push(subs[subCategory]);
        return parts.join(' ') || turfType || '';
    }

    function downloadJson(data, filename) {
        var json = JSON.stringify(data, null, 2);
        var blob = new Blob([json], { type: 'application/json' });
        var url = URL.createObjectURL(blob);
        var a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    function sampleCountText(breakdown) {
        var parts = [];
        if (breakdown.soil && breakdown.soil.total > 0) parts.push(breakdown.soil.total + ' soil');
        if (breakdown.water && breakdown.water.total > 0) parts.push(breakdown.water.total + ' water');
        if (breakdown.tissue && breakdown.tissue.total > 0) parts.push(breakdown.tissue.total + ' tissue');
        return parts.length > 0 ? parts.join(', ') : 'no samples';
    }

    function totalSampleCount(breakdown) {
        return (breakdown.soil ? breakdown.soil.total : 0) +
               (breakdown.water ? breakdown.water.total : 0) +
               (breakdown.tissue ? breakdown.tissue.total : 0);
    }

    function formatZoneLine(zones) {
        var entries = [];
        var keys = Object.keys(zones);
        // Sort by count descending
        keys.sort(function(a, b) { return zones[b] - zones[a]; });
        for (var i = 0; i < keys.length; i++) {
            var zone = keys[i];
            var icon = ZONE_ICONS[zone] || '\uD83D\uDCCD';
            var label = zone.replace(/_/g, ' ').replace(/\b\w/g, function(c) { return c.toUpperCase(); });
            entries.push(icon + ' ' + zones[zone] + ' ' + label);
        }
        return entries.join(',  ');
    }

    // =========================================================================
    // DASHBOARD STATE
    // =========================================================================

    var _saveStatusTimer = null;
    var _searchOpen = false;
    var _searchQuery = '';
    var _searchHighlight = -1;
    var _tooltipEl = null;

    // =========================================================================
    // SORT SITES BY RECENT
    // =========================================================================

    function getRecentSites(sites, max) {
        var withTime = [];
        for (var i = 0; i < sites.length; i++) {
            var config = StorageAdapter.getSiteConfig(sites[i].id);
            var savedAt = config ? config.savedAt : sites[i].createdAt;
            withTime.push({ site: sites[i], savedAt: savedAt || '' });
        }
        withTime.sort(function(a, b) {
            return new Date(b.savedAt || 0) - new Date(a.savedAt || 0);
        });
        var result = [];
        for (var j = 0; j < Math.min(withTime.length, max); j++) {
            result.push(withTime[j].site);
        }
        return result;
    }

    // =========================================================================
    // BUILD HTML
    // =========================================================================

    function buildDashboard() {
        var el = document.createElement('div');
        el.className = 'gaip-site-dashboard';
        el.id = DASHBOARD_ID;
        el.innerHTML = buildHeaderHTML() + '<div class="gaip-sd-cards" id="gaip-sd-cards"></div>' + buildFooterHTML();
        return el;
    }

    function buildHeaderHTML() {
        var sites = StorageAdapter.getSiteList();
        var hiddenCount = Math.max(0, sites.length - MAX_CARDS);
        var searchLabel = '\uD83D\uDD0D Find Site' + (hiddenCount > 0 ? ' (+' + hiddenCount + ' more)' : '');

        return '' +
            '<div class="gaip-sd-header">' +
                '<div class="gaip-sd-header-left">' +
                    '<span class="gaip-sd-title">Sites</span>' +
                    '<span class="gaip-sd-site-count" id="gaip-sd-site-count">' + sites.length + '</span>' +
                '</div>' +
                '<div class="gaip-sd-header-actions">' +
                    '<div class="gaip-sd-search-wrap" id="gaip-sd-search-wrap">' +
                        '<button type="button" class="gaip-sd-search-btn" id="gaip-sd-search-btn">' + esc(searchLabel) + '</button>' +
                    '</div>' +
                    '<button type="button" class="gaip-sd-btn gaip-sd-btn-primary" id="gaip-sd-add-btn">' +
                        '<span class="gaip-sd-btn-icon">+</span> Add Site' +
                    '</button>' +
                    '<button type="button" class="gaip-sd-btn" id="gaip-sd-export-all-btn" title="Export all sites as JSON backup">' +
                        '\u2B07 Export All' +
                    '</button>' +
                '</div>' +
            '</div>';
    }

    function buildSiteCardHTML(site, isActive, breakdown) {
        var config = StorageAdapter.getSiteConfig(site.id);
        var turf = (config && config.turf) || {};
        var location = (config && config.location) || {};
        var savedAt = config ? config.savedAt : site.createdAt;

        var speciesText = '';
        if (turf.species) {
            speciesText = formatSpeciesName(turf.species);
            if (turf.turfType) speciesText += ' \u00B7 ' + formatTurfType(turf.turfType, turf.subCategory);
        } else if (turf.turfType) {
            speciesText = formatTurfType(turf.turfType, turf.subCategory);
        }

        var locationText = '';
        if (location.name) {
            locationText = location.name;
        } else if (location.lat && location.lon) {
            locationText = location.lat.toFixed(2) + ', ' + location.lon.toFixed(2);
        }

        var countStr = sampleCountText(breakdown);
        var total = totalSampleCount(breakdown);
        var activeClass = isActive ? ' gaip-sd-active' : '';
        var isDefault = site.id === 'default';
        var samplesClass = total > 0 ? 'gaip-sd-card-samples-hoverable' : 'gaip-sd-card-meta-item';

        return '' +
            '<div class="gaip-sd-card' + activeClass + '" data-site-id="' + esc(site.id) + '">' +
                '<div class="gaip-sd-card-indicator"></div>' +
                '<div class="gaip-sd-card-actions">' +
                    '<button type="button" class="gaip-sd-card-action gaip-sd-action-rename" data-site-id="' + esc(site.id) + '" title="Rename">\u270E</button>' +
                    '<button type="button" class="gaip-sd-card-action gaip-sd-action-export" data-site-id="' + esc(site.id) + '" title="Export">\u2B07</button>' +
                    (isDefault ? '' : '<button type="button" class="gaip-sd-card-action gaip-sd-action-delete" data-site-id="' + esc(site.id) + '" title="Delete">\u2715</button>') +
                '</div>' +
                '<div class="gaip-sd-card-name" id="gaip-sd-name-' + esc(site.id) + '">' + esc(site.label) + '</div>' +
                (locationText
                    ? '<div class="gaip-sd-card-location">\uD83D\uDCCD ' + esc(locationText) + '</div>'
                    : '<div class="gaip-sd-card-location-empty">No location set</div>') +
                (speciesText ? '<div class="gaip-sd-card-species">\uD83C\uDF3F ' + esc(speciesText) + '</div>' : '') +
                '<div class="gaip-sd-card-meta">' +
                    '<span class="' + samplesClass + '" data-tooltip-site="' + esc(site.id) + '">\uD83E\uDDEA ' + esc(countStr) + '</span>' +
                    '<span class="gaip-sd-card-meta-item">\uD83D\uDD52 ' + formatRelativeTime(savedAt) + '</span>' +
                '</div>' +
            '</div>';
    }

    function buildFooterHTML() {
        return '' +
            '<div class="gaip-sd-footer">' +
                '<div class="gaip-sd-save-status" id="gaip-sd-save-status">' +
                    '<span class="gaip-sd-save-dot" id="gaip-sd-save-dot"></span>' +
                    '<span id="gaip-sd-save-text">Checking...</span>' +
                '</div>' +
                '<div class="gaip-sd-footer-actions"></div>' +
            '</div>';
    }

    // =========================================================================
    // SEARCH COMBOBOX
    // =========================================================================

    function openSearch() {
        _searchOpen = true;
        _searchQuery = '';
        _searchHighlight = -1;

        var wrap = document.getElementById('gaip-sd-search-wrap');
        var btn = document.getElementById('gaip-sd-search-btn');
        if (!wrap || !btn) return;

        btn.classList.add('gaip-sd-search-open');

        // Build dropdown
        var dropdown = document.createElement('div');
        dropdown.className = 'gaip-sd-search-dropdown';
        dropdown.id = 'gaip-sd-search-dropdown';
        dropdown.innerHTML = '' +
            '<div class="gaip-sd-search-input-wrap">' +
                '<input type="text" class="gaip-sd-search-input" id="gaip-sd-search-input" placeholder="Type to search sites...">' +
            '</div>' +
            '<div class="gaip-sd-search-list" id="gaip-sd-search-list"></div>';

        wrap.appendChild(dropdown);
        renderSearchResults();

        var input = document.getElementById('gaip-sd-search-input');
        if (input) {
            input.focus();
            input.addEventListener('input', function() {
                _searchQuery = input.value;
                _searchHighlight = 0;
                renderSearchResults();
            });
            input.addEventListener('keydown', handleSearchKeyDown);
        }

        // Close on outside click
        setTimeout(function() {
            document.addEventListener('mousedown', _closeSearchOnOutsideClick);
        }, 0);
    }

    function closeSearch() {
        _searchOpen = false;
        _searchQuery = '';
        _searchHighlight = -1;

        var dropdown = document.getElementById('gaip-sd-search-dropdown');
        if (dropdown) dropdown.remove();

        var btn = document.getElementById('gaip-sd-search-btn');
        if (btn) btn.classList.remove('gaip-sd-search-open');

        document.removeEventListener('mousedown', _closeSearchOnOutsideClick);
    }

    function _closeSearchOnOutsideClick(e) {
        var wrap = document.getElementById('gaip-sd-search-wrap');
        if (wrap && !wrap.contains(e.target)) {
            closeSearch();
        }
    }

    function getFilteredSites() {
        var sites = StorageAdapter.getSiteList();
        if (!_searchQuery.trim()) return sites;
        var q = _searchQuery.toLowerCase();
        var filtered = [];
        for (var i = 0; i < sites.length; i++) {
            var s = sites[i];
            var config = StorageAdapter.getSiteConfig(s.id);
            var locName = (config && config.location && config.location.name) || '';
            var species = (config && config.turf && config.turf.species) || '';
            if (s.label.toLowerCase().indexOf(q) !== -1 ||
                locName.toLowerCase().indexOf(q) !== -1 ||
                species.replace(/_/g, ' ').toLowerCase().indexOf(q) !== -1) {
                filtered.push(s);
            }
        }
        return filtered;
    }

    function renderSearchResults() {
        var list = document.getElementById('gaip-sd-search-list');
        if (!list) return;

        var filtered = getFilteredSites();
        var activeId = StorageAdapter.getActiveSiteId();

        if (filtered.length === 0) {
            list.innerHTML = '<div class="gaip-sd-search-empty">No sites match "' + esc(_searchQuery) + '"</div>';
            return;
        }

        var html = '';
        for (var i = 0; i < filtered.length; i++) {
            var site = filtered[i];
            var isActive = site.id === activeId;
            var isHighlighted = i === _searchHighlight;
            var config = StorageAdapter.getSiteConfig(site.id);
            var locName = (config && config.location && config.location.name) || '';
            var species = (config && config.turf) ? formatSpeciesName(config.turf.species) : '';
            var savedAt = config ? config.savedAt : site.createdAt;
            var breakdown = StorageAdapter.getSampleBreakdown(site.id);
            var total = totalSampleCount(breakdown);
            var detail = [locName, species, total > 0 ? total + ' samples' : ''].filter(Boolean).join(' \u00B7 ');

            html += '' +
                '<div class="gaip-sd-search-item' + (isHighlighted ? ' gaip-sd-highlighted' : '') + '" data-search-idx="' + i + '" data-site-id="' + esc(site.id) + '">' +
                    '<div style="min-width:0;flex:1">' +
                        '<div class="gaip-sd-search-item-name' + (isActive ? ' gaip-sd-item-active' : '') + '">' +
                            (isActive ? '<span class="gaip-sd-search-item-dot"></span>' : '') +
                            esc(site.label) +
                        '</div>' +
                        '<div class="gaip-sd-search-item-detail">' + esc(detail) + '</div>' +
                    '</div>' +
                    '<div class="gaip-sd-search-item-time">' + formatRelativeTime(savedAt) + '</div>' +
                '</div>';
        }
        list.innerHTML = html;

        // Use delegated listeners on the container — avoids losing listeners when
        // mouseenter previously triggered renderSearchResults() and replaced all DOM nodes.
        list.onclick = function(e) {
            var item = e.target.closest('.gaip-sd-search-item');
            if (!item) return;
            var siteId = item.dataset.siteId;
            if (siteId) activateSite(siteId);
            closeSearch();
        };
        list.onmouseover = function(e) {
            var item = e.target.closest('.gaip-sd-search-item');
            if (!item) return;
            var idx = parseInt(item.dataset.searchIdx, 10);
            if (idx === _searchHighlight) return;
            // Update highlight via class toggle — no re-render needed
            var prev = list.querySelector('.gaip-sd-highlighted');
            if (prev) prev.classList.remove('gaip-sd-highlighted');
            item.classList.add('gaip-sd-highlighted');
            _searchHighlight = idx;
        };
    }

    function handleSearchKeyDown(e) {
        var filtered = getFilteredSites();
        if (e.key === 'Escape') {
            closeSearch();
            return;
        }
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            _searchHighlight = Math.min(_searchHighlight + 1, filtered.length - 1);
            renderSearchResults();
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            _searchHighlight = Math.max(_searchHighlight - 1, 0);
            renderSearchResults();
        } else if (e.key === 'Enter') {
            if (_searchHighlight >= 0 && filtered[_searchHighlight]) {
                activateSite(filtered[_searchHighlight].id);
                closeSearch();
            }
        }
    }

    // =========================================================================
    // TOOLTIP
    // =========================================================================

    function showTooltip(siteId, anchorEl) {
        hideTooltip();

        var breakdown = StorageAdapter.getSampleBreakdown(siteId);
        var total = totalSampleCount(breakdown);
        if (total === 0) return;

        var rect = anchorEl.getBoundingClientRect();

        var el = document.createElement('div');
        el.className = 'gaip-sd-tooltip';
        el.id = 'gaip-sd-tooltip';
        el.style.top = (rect.bottom + 6) + 'px';
        el.style.left = Math.max(8, rect.left - 40) + 'px';

        var html = '<div class="gaip-sd-tooltip-title">Sample breakdown</div>';
        var dataTypes = ['soil', 'water', 'tissue'];
        for (var i = 0; i < dataTypes.length; i++) {
            var dt = dataTypes[i];
            var info = breakdown[dt];
            if (!info || info.total === 0) continue;
            html += '<div class="gaip-sd-tooltip-type">';
            html += '<div class="gaip-sd-tooltip-type-label">' + (TYPE_LABELS[dt] || dt) + ' (' + info.total + ')</div>';
            if (Object.keys(info.zones).length > 0) {
                html += '<div class="gaip-sd-tooltip-zones">' + formatZoneLine(info.zones) + '</div>';
            }
            html += '</div>';
        }

        el.innerHTML = html;
        document.body.appendChild(el);
        _tooltipEl = el;
    }

    function hideTooltip() {
        if (_tooltipEl) {
            _tooltipEl.remove();
            _tooltipEl = null;
        }
    }

    // =========================================================================
    // ACTIONS
    // =========================================================================

    function activateSite(siteId) {
        var currentActive = StorageAdapter.getActiveSiteId();
        if (siteId === currentActive) return;
        log('Activating site:', siteId);
        StorageAdapter.setActiveSite(siteId);
        // refresh() triggered by gaip:site-changed event
    }

    function showAddForm() {
        var form = document.getElementById('gaip-sd-add-form');
        var input = document.getElementById('gaip-sd-add-input');
        if (!form) return;
        form.classList.add('gaip-sd-visible');
        if (input) { input.value = ''; input.focus(); }
    }

    function hideAddForm() {
        var form = document.getElementById('gaip-sd-add-form');
        if (form) form.classList.remove('gaip-sd-visible');
    }

    function confirmAddSite() {
        var input = document.getElementById('gaip-sd-add-input');
        if (!input) return;
        var name = input.value.trim();
        if (!name) { input.focus(); return; }
        var newId = StorageAdapter.addSite(name);
        if (newId) {
            StorageAdapter.setActiveSite(newId);
            log('Added and activated:', newId, name);
        }
        hideAddForm();
    }

    function startInlineRename(siteId) {
        var nameEl = document.getElementById('gaip-sd-name-' + siteId);
        if (!nameEl) return;

        var currentName = nameEl.textContent;
        var input = document.createElement('input');
        input.type = 'text';
        input.className = 'gaip-sd-rename-input';
        input.value = currentName;
        input.maxLength = 80;

        nameEl.textContent = '';
        nameEl.appendChild(input);
        input.focus();
        input.select();

        var committed = false;

        function commit() {
            if (committed) return;
            committed = true;
            var newName = input.value.trim();
            if (newName && newName !== currentName) {
                StorageAdapter.renameSite(siteId, newName);
                log('Renamed:', siteId, '->', newName);
            }
            refresh();
        }

        input.addEventListener('blur', commit);
        input.addEventListener('keydown', function(e) {
            if (e.key === 'Enter') { e.preventDefault(); input.blur(); }
            else if (e.key === 'Escape') {
                committed = true;
                nameEl.textContent = currentName;
            }
        });
    }

    // =========================================================================
    // RENDER / REFRESH
    // =========================================================================

    function refresh() {
        var dashboard = document.getElementById(DASHBOARD_ID);
        if (!dashboard) return;

        var sites = StorageAdapter.getSiteList();
        var activeId = StorageAdapter.getActiveSiteId();
        var recentSites = getRecentSites(sites, MAX_CARDS);
        var hiddenCount = Math.max(0, sites.length - MAX_CARDS);

        // Update header count + search button label
        var countEl = document.getElementById('gaip-sd-site-count');
        if (countEl) countEl.textContent = sites.length;

        var searchBtn = document.getElementById('gaip-sd-search-btn');
        if (searchBtn) {
            searchBtn.textContent = '\uD83D\uDD0D Find Site' + (hiddenCount > 0 ? ' (+' + hiddenCount + ' more)' : '');
        }

        // Preserve add form state
        var addForm = document.getElementById('gaip-sd-add-form');
        var addFormVisible = addForm && addForm.classList.contains('gaip-sd-visible');
        var addInputValue = '';
        var addInput = document.getElementById('gaip-sd-add-input');
        if (addInput) addInputValue = addInput.value;

        // Build cards
        var cardsContainer = document.getElementById('gaip-sd-cards');
        if (!cardsContainer) return;

        var html = '';

        // Recent cards
        var activeInRecent = false;
        for (var i = 0; i < recentSites.length; i++) {
            var isActive = recentSites[i].id === activeId;
            if (isActive) activeInRecent = true;
            var breakdown = StorageAdapter.getSampleBreakdown(recentSites[i].id);
            html += buildSiteCardHTML(recentSites[i], isActive, breakdown);
        }

        // Pin active site if not in recent
        if (!activeInRecent) {
            var activeSite = null;
            for (var j = 0; j < sites.length; j++) {
                if (sites[j].id === activeId) { activeSite = sites[j]; break; }
            }
            if (activeSite) {
                var bd = StorageAdapter.getSampleBreakdown(activeSite.id);
                html += buildSiteCardHTML(activeSite, true, bd);
            }
        }

        // Add form
        html += '' +
            '<div class="gaip-sd-add-form' + (addFormVisible ? ' gaip-sd-visible' : '') + '" id="gaip-sd-add-form">' +
                '<input type="text" class="gaip-sd-add-input" id="gaip-sd-add-input" placeholder="Site name (e.g. Royal Melbourne GC)" maxlength="80" value="' + esc(addInputValue) + '">' +
                '<button type="button" class="gaip-sd-add-confirm" id="gaip-sd-add-confirm">Add</button>' +
                '<button type="button" class="gaip-sd-add-cancel" id="gaip-sd-add-cancel">Cancel</button>' +
            '</div>';

        // Overflow indicator
        if (hiddenCount > 0 && !addFormVisible) {
            html += '<div class="gaip-sd-overflow" id="gaip-sd-overflow">+' + hiddenCount + ' more, search to find</div>';
        }

        cardsContainer.innerHTML = html;
        bindCardEvents();

        log('Refreshed: ' + sites.length + ' sites, showing ' + recentSites.length + ' cards, active=' + activeId);
    }

    // =========================================================================
    // SAVE STATUS
    // =========================================================================

    function updateSaveStatus() {
        var textEl = document.getElementById('gaip-sd-save-text');
        var dotEl = document.getElementById('gaip-sd-save-dot');
        if (!textEl || !dotEl) return;
        var lastSave = StorageAdapter.getLastSaveTime();
        if (lastSave) {
            textEl.textContent = 'Saved ' + formatRelativeTime(lastSave);
            dotEl.classList.remove('gaip-sd-saving');
        } else {
            textEl.textContent = 'Not saved yet';
            dotEl.classList.remove('gaip-sd-saving');
        }
    }

    function showSaving() {
        var textEl = document.getElementById('gaip-sd-save-text');
        var dotEl = document.getElementById('gaip-sd-save-dot');
        if (!textEl || !dotEl) return;
        textEl.textContent = 'Saving...';
        dotEl.classList.add('gaip-sd-saving');
    }

    function startSaveStatusRefresh() {
        if (_saveStatusTimer) clearInterval(_saveStatusTimer);
        _saveStatusTimer = setInterval(updateSaveStatus, 30000);
        updateSaveStatus();
    }

    // =========================================================================
    // EVENT BINDING
    // =========================================================================

    function bindHeaderEvents() {
        var searchBtn = document.getElementById('gaip-sd-search-btn');
        if (searchBtn) {
            searchBtn.addEventListener('click', function() {
                if (_searchOpen) closeSearch();
                else openSearch();
            });
        }

        var addBtn = document.getElementById('gaip-sd-add-btn');
        if (addBtn) {
            addBtn.addEventListener('click', showAddForm);
        }

        var exportAllBtn = document.getElementById('gaip-sd-export-all-btn');
        if (exportAllBtn) {
            exportAllBtn.addEventListener('click', function() {
                var data = StorageAdapter.exportAll();
                var dateStr = new Date().toISOString().slice(0, 10);
                downloadJson(data, 'gilba-all-sites-' + dateStr + '.json');
                log('Exported all sites');
            });
        }
    }

    function bindCardEvents() {
        var cardsContainer = document.getElementById('gaip-sd-cards');
        if (!cardsContainer) return;

        cardsContainer.onclick = function(e) {
            var target = e.target;

            if (target.closest('.gaip-sd-action-rename')) {
                e.stopPropagation();
                startInlineRename(target.closest('.gaip-sd-action-rename').dataset.siteId);
                return;
            }
            if (target.closest('.gaip-sd-action-export')) {
                e.stopPropagation();
                var siteId = target.closest('.gaip-sd-action-export').dataset.siteId;
                var data = StorageAdapter.exportSite(siteId);
                var safeName = (data.label || siteId).replace(/[^a-zA-Z0-9]+/g, '-').toLowerCase();
                var dateStr = new Date().toISOString().slice(0, 10);
                downloadJson(data, 'gilba-site-' + safeName + '-' + dateStr + '.json');
                log('Exported site:', siteId);
                return;
            }
            if (target.closest('.gaip-sd-action-delete')) {
                e.stopPropagation();
                var siteId = target.closest('.gaip-sd-action-delete').dataset.siteId;
                var sites = StorageAdapter.getSiteList();
                var label = siteId;
                for (var i = 0; i < sites.length; i++) {
                    if (sites[i].id === siteId) { label = sites[i].label; break; }
                }
                if (!confirm('Delete "' + label + '" and all its samples? This cannot be undone.')) return;
                StorageAdapter.removeSite(siteId);
                refresh();
                return;
            }
            if (target.closest('#gaip-sd-add-confirm')) {
                e.stopPropagation();
                confirmAddSite();
                return;
            }
            if (target.closest('#gaip-sd-add-cancel')) {
                e.stopPropagation();
                hideAddForm();
                return;
            }
            if (target.closest('#gaip-sd-overflow')) {
                e.stopPropagation();
                openSearch();
                return;
            }

            var card = target.closest('.gaip-sd-card');
            if (card && card.dataset.siteId) {
                activateSite(card.dataset.siteId);
            }
        };

        // Tooltip hover on sample counts
        cardsContainer.addEventListener('mouseover', function(e) {
            var hoverEl = e.target.closest('[data-tooltip-site]');
            if (hoverEl) {
                showTooltip(hoverEl.dataset.tooltipSite, hoverEl);
            }
        });
        cardsContainer.addEventListener('mouseout', function(e) {
            var hoverEl = e.target.closest('[data-tooltip-site]');
            if (hoverEl) {
                hideTooltip();
            }
        });

        // Add form keyboard
        var addInput = document.getElementById('gaip-sd-add-input');
        if (addInput) {
            addInput.addEventListener('keydown', function(e) {
                if (e.key === 'Enter') { e.preventDefault(); confirmAddSite(); }
                else if (e.key === 'Escape') { hideAddForm(); }
            });
        }
    }

    // Debounced refresh — collapses rapid-fire events (e.g. site-config
    // restore cascade) into a single DOM rebuild. 250ms window lets the
    // turf profile → species → variety → location chain settle first.
    var _refreshTimer = null;
    function debouncedRefresh() {
        if (_refreshTimer) clearTimeout(_refreshTimer);
        _refreshTimer = setTimeout(function() {
            _refreshTimer = null;
            refresh();
        }, 250);
    }

    function bindGlobalEvents() {
        var siteEvents = ['gaip:site-changed', 'gaip:site-added', 'gaip:site-removed', 'gaip:site-renamed'];
        for (var i = 0; i < siteEvents.length; i++) {
            document.addEventListener(siteEvents[i], function() { debouncedRefresh(); });
        }

        document.addEventListener('gaip:state-saved', function() {
            updateSaveStatus();
        });

        var hubEl = document.getElementById('gaip-hub') || document.getElementById('gaip-hub-container');
        if (hubEl) {
            var savingTimeout = null;
            hubEl.addEventListener('input', function() {
                showSaving();
                if (savingTimeout) clearTimeout(savingTimeout);
                savingTimeout = setTimeout(updateSaveStatus, 2000);
            });
        }

        var sampleEvents = [
            'gaip:samples-imported', 'gaip:sample-added', 'gaip:sample-deleted',
            'gaip:samples-cleared', 'gaip:all-samples-cleared', 'gaip:samples-restored'
        ];
        for (var j = 0; j < sampleEvents.length; j++) {
            document.addEventListener(sampleEvents[j], function() {
                debouncedRefresh();
            });
        }

        document.addEventListener('gaip:turf-profile-change', function() {
            debouncedRefresh();
        });

        document.addEventListener('gaip:site-config-applied', function() {
            debouncedRefresh();
        });

        log('Global events bound');
    }

    // =========================================================================
    // INJECTION
    // =========================================================================

    function inject() {
        if (document.getElementById(DASHBOARD_ID)) return false;

        var hub = document.getElementById('gaip-hub') || document.getElementById('gaip-hub-container');
        if (!hub) {
            log('Hub container not found');
            return false;
        }

        var dashboard = buildDashboard();
        hub.insertBefore(dashboard, hub.firstChild);

        bindHeaderEvents();
        refresh();
        startSaveStatusRefresh();

        log('Dashboard injected');
        return true;
    }

    // =========================================================================
    // INIT
    // =========================================================================

    var _initRetries = 0;

    function init() {
        _initRetries++;
        var SM = global.GAIP_SampleManager;
        if (!SM || typeof SM.getSiteList !== 'function') {
            if (_initRetries < MAX_INIT_RETRIES) {
                setTimeout(init, 500);
                return;
            }
            warn('SampleManager not available after ' + MAX_INIT_RETRIES + ' retries');
            return;
        }

        if (inject()) {
            bindGlobalEvents();
            setTimeout(refresh, 1500);
            log('v' + VERSION + ' initialized');
        }
    }

    // =========================================================================
    // BOOT
    // =========================================================================

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function() { setTimeout(init, 400); });
    } else {
        setTimeout(init, 400);
    }

    // =========================================================================
    // EXPORTS
    // =========================================================================

    global.GaipSiteDashboard = {
        version: VERSION,
        refresh: refresh,
        inject: inject,
        openSearch: openSearch,
        closeSearch: closeSearch,
        exportSite: StorageAdapter.exportSite,
        exportAll: StorageAdapter.exportAll,
        StorageAdapter: StorageAdapter
    };

})(window);
