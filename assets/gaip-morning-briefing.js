/**
 * =============================================================================
 * GAIP MORNING BRIEFING  v1.0.0
 * =============================================================================
 *
 * Entry-point summary across all configured sites. Renders immediately from
 * localStorage (gilba_hub_site_configs + gilba_hub_cache) with no orchestrator
 * dependency. Computed metrics (GP, disease, stress, irrigation) are shown for
 * the last active site from cache; other sites show profile + PGR status only.
 *
 * Architecture:
 *   1. Read GAIP_SampleManager.getSiteList() for all site IDs/labels
 *   2. Read gilba_hub_site_configs for per-site turf profile + PGR
 *   3. Read gilba_hub_cache for computed metrics (active site, last 24h)
 *   4. Read gaip_sensor_data_{siteId} for VWC if present
 *   5. Render site cards, sorted by risk (highest first)
 *   6. Refresh on gaip:orchestrator-complete (active site metrics update)
 *   7. On site-switch, update which card shows computed metrics
 *
 * Single-site behaviour: one full-detail card, same as above.
 * Multi-site behaviour: stacked risk-sorted cards, tap to expand.
 *
 * Dependencies:
 *   - gilba-storage-ns.js (namespace shim — must load first)
 *   - sample-manager.js  (GAIP_SampleManager)
 *   - site-config-persistence.js (GAIP_SiteConfig — optional, for live snapshot)
 *
 * Storage keys read (never written):
 *   gilba_hub_site_configs   — per-site turf/location/pgr profile
 *   gilba_hub_cache[_uid]    — last computed metrics for active site
 *   gaip_sensor_data_{id}    — sensor VWC for any site
 *
 * =============================================================================
 */
(function (global) {
    'use strict';

    var VERSION = '1.0.0';
    var CONTAINER_ID = 'gaip-morning-briefing';
    var CACHE_MAX_AGE_H = 24;
    var DEBUG = false;

    // =========================================================================
    // LOGGING
    // =========================================================================

    function log() {
        if (!DEBUG) return;
        var args = ['[Briefing]'].concat(Array.prototype.slice.call(arguments));
        console.log.apply(console, args);
    }

    // =========================================================================
    // STORAGE HELPERS
    // =========================================================================

    function safeGet(key) {
        try { return localStorage.getItem(key); } catch (e) { return null; }
    }

    function safeParse(raw) {
        try { return raw ? JSON.parse(raw) : null; } catch (e) { return null; }
    }

    // =========================================================================
    // DATA LAYER
    // =========================================================================

    /**
     * Return all configured sites from SampleManager.
     * @returns {Array<{id, label}>}
     */
    // GH-444: the sites this login has, as the server lists them.
    //
    // getSiteList() used to walk four localStorage keys of sample snapshots,
    // then SampleManager, then fall back to a placeholder called "My Site".
    // On /morning-briefing none of those exist -- the page does not load
    // sample-persistence.js -- so a client with a fully configured site was
    // shown "My Site / Species not set" while /field-log, same login, showed
    // the real site. One GET of /api/sites answers both questions this page
    // has: what the sites are called, and what their configs hold.
    var _serverSites = null;   // [{ id, label }]
    var _serverConfigs = null; // { siteId: config }
    var _sitesError = false;

    function loadSitesFromServer() {
        var base = (global.GAIP_HUB_CONFIG && global.GAIP_HUB_CONFIG.restUrl) || '/api/';
        if (typeof fetch !== 'function') return Promise.resolve(false);

        return fetch(base.replace(/\/?$/, '/') + 'sites', {
            credentials: 'same-origin',
            headers: { Accept: 'application/json' },
        })
            .then(function (r) {
                if (!r.ok) throw new Error('HTTP ' + r.status);
                return r.json();
            })
            .then(function (payload) {
                var rows = (payload && payload.data) || [];
                _serverSites = rows.map(function (site) {
                    return { id: site.id, label: site.name || site.id };
                });
                _serverConfigs = {};
                rows.forEach(function (site) {
                    var cfg = site && site.configs && site.configs.gaip && site.configs.gaip.config;
                    if (site && site.id && cfg && typeof cfg === 'object' && !Array.isArray(cfg)) {
                        _serverConfigs[site.id] = cfg;
                    }
                });
                _sitesError = false;
                log('Loaded ' + _serverSites.length + ' sites from the server');
                return true;
            })
            .catch(function (err) {
                // GH-444: no invented list. The page says the data could not be
                // read instead of naming a site that is not there.
                warn('Could not load the site list:', err && err.message);
                _sitesError = true;
                _serverSites = [];
                _serverConfigs = {};
                if (global.GilbaSettingsUnavailable && typeof global.GilbaSettingsUnavailable.show === 'function') {
                    global.GilbaSettingsUnavailable.show({ reason: 'sites-list' });
                }
                return false;
            });
    }

    function getSiteList() {
        if (_serverSites) return _serverSites;

        // Before the fetch resolves, the one site the page was rendered with.
        var hub = global.GAIP_HUB_CONFIG || {};
        if (hub.activeSiteId) return [{ id: hub.activeSiteId, label: hub.siteName || '' }];
        return [];
    }

    /**
     * Return active site ID.
     */
    function getActiveSiteId() {
        var SM = global.GAIP_SampleManager;
        if (SM && typeof SM.getActiveSiteId === 'function') return SM.getActiveSiteId();
        return 'default';
    }

    /**
     * GH-442 (GH-439 stage 3): every site's config, from the server.
     *
     * GAIP_SiteConfig fills its cache from GET /api/sites (this page loads
     * site-config-persistence.js), and the page itself is rendered with the
     * active site's config. The localStorage fallback that stood here -- two
     * keys, bare and namespaced, merged by precedence -- is gone with the copy
     * it read: on a browser carrying an old one, this page showed a briefing
     * built from another session's settings and said nothing about it.
     *
     * @returns {Object}  { siteId: { turf, location, pgr, savedAt } }
     */
    function getAllSiteConfigs() {
        // GH-444: the same GET that gave the site list.
        if (_serverConfigs && Object.keys(_serverConfigs).length) return _serverConfigs;

        if (global.GAIP_SiteConfig && typeof global.GAIP_SiteConfig.getAllConfigs === 'function') {
            var cached = global.GAIP_SiteConfig.getAllConfigs();
            if (cached && Object.keys(cached).length) return cached;
        }

        // Before that module has finished loading, the one config the server
        // rendered into this page is what there is.
        var hub = global.GAIP_HUB_CONFIG || {};
        if (hub.activeSiteId && hub.gaipConfig) {
            var only = {};
            only[hub.activeSiteId] = hub.gaipConfig;
            return only;
        }

        log('getAllSiteConfigs: no server config available yet');
        return {};
    }

    /**
     * Return cached computed metrics for a site (only valid for last active site).
     * @param {string} siteId
     * @returns {Object|null}
     */
    function getCachedMetrics(siteId) {
        // Cache is keyed by userId, not siteId — it only covers the last analysed site.
        // Determine cache key (mirrors hub-persistence.js logic).
        var uid = (global.GAIP_HUB_CONFIG && global.GAIP_HUB_CONFIG.userId) || 0;
        var suffix = uid ? '_' + uid : '';
        var cacheKey = 'gilba_hub_cache' + suffix;

        var cached = safeParse(safeGet(cacheKey));
        if (!cached) return null;

        // Reject if expired
        var ageH = (Date.now() - new Date(cached.cachedAt).getTime()) / 3600000;
        if (ageH > CACHE_MAX_AGE_H) return null;

        // Cache covers the last-analysed site only. On a standalone page
        // getActiveSiteId() returns 'default' (cold SampleManager), so we can't
        // match by siteId. Instead: tag the cache with the siteId it was written for
        // (stored in cached.siteId if hub-persistence writes it, otherwise fall back
        // to matching against gilba_hub_site_configs to find the most recently saved site).
        // For now: return metrics for whichever site this cache belongs to, and let
        // render() assign it to the correct card by matching cachedSiteId.
        return cached.dashboard || null;
    }

    /**
     * Return latest VWC reading for a site from sensor-import storage.
     * @param {string} siteId
     * @returns {number|null}  VWC % or null
     */
    function getSiteVWC(siteId) {
        var key = siteId ? 'gaip_sensor_data_' + siteId : 'gaip_sensor_data';
        var data = safeParse(safeGet(key));
        if (!data || !data.readings || !data.readings.length) return null;

        // Average the most recent readings (last import)
        var vwcValues = [];
        data.readings.forEach(function (r) {
            if (r.vwc !== undefined && r.vwc !== null && !isNaN(r.vwc)) {
                vwcValues.push(parseFloat(r.vwc));
            }
        });
        if (!vwcValues.length) return null;
        var avg = vwcValues.reduce(function (a, b) { return a + b; }, 0) / vwcValues.length;
        return Math.round(avg * 10) / 10;
    }

    // =========================================================================
    // RISK SCORING  (for multi-site sort)
    // =========================================================================

    /**
     * Compute a simple 0–100 priority score for a site card.
     * Higher = needs attention sooner.
     */
    function computePriorityScore(metrics, config) {
        var score = 0;

        if (metrics) {
            // Disease (0–40 points)
            var disease = metrics.diseaseRisk || 0;
            score += disease * 0.4;

            // Stress (0–20 points)
            var stress = metrics.stressIndex || 0;
            score += stress * 0.2;

            // Low GP is a warning in summer (0–15 points)
            var gp = metrics.growthPotential;
            if (gp !== null && gp !== undefined) {
                var gpPct = gp > 1 ? gp : gp * 100;
                if (gpPct < 30) score += 15;
                else if (gpPct < 50) score += 8;
            }
        }

        // PGR overdue (0–15 points)
        if (config && config.pgr && config.pgr.enabled && config.pgr.applicationDate) {
            var daysSince = Math.floor((Date.now() - new Date(config.pgr.applicationDate).getTime()) / 86400000);
            if (daysSince > 28) score += 15;
            else if (daysSince > 21) score += 10;
            else if (daysSince > 14) score += 5;
        }

        return Math.min(100, Math.round(score));
    }

    // =========================================================================
    // LANGUAGE HELPERS
    // =========================================================================

    function diseaseDecision(overall, topDisease, forecastPeak, peakDay) {
        if (overall === null || overall === undefined) return null;
        var pct = overall;
        var peakPct = forecastPeak || pct;
        var diseaseLabel = topDisease ? formatDiseaseName(topDisease) : 'disease';

        if (pct >= 70 || peakPct >= 75) {
            var timing = peakDay ? ' in ' + peakDay + 'd' : '';
            return {
                level: 'high',
                text: diseaseLabel + ' risk HIGH' + (peakPct > pct ? ', forecast ' + Math.round(peakPct) + '%' + timing : '') + '. Consider fungicide application.'
            };
        }
        if (pct >= 50 || peakPct >= 65) {
            return {
                level: 'moderate',
                text: diseaseLabel + ' pressure building (' + Math.round(pct) + '%). Monitor closely.'
            };
        }
        return {
            level: 'low',
            text: diseaseLabel + ' risk low (' + Math.round(pct) + '%).'
        };
    }

    function gpDecision(gpRaw) {
        if (gpRaw === null || gpRaw === undefined) return null;
        var pct = gpRaw > 1 ? Math.round(gpRaw) : Math.round(gpRaw * 100);
        if (pct >= 70) return { level: 'good', text: 'GP ' + pct + '%, good growing conditions.' };
        if (pct >= 40) return { level: 'moderate', text: 'GP ' + pct + '%, moderate growth, watch stress.' };
        return { level: 'poor', text: 'GP ' + pct + '%, poor growing conditions.' };
    }

    function pgrDecision(pgr) {
        if (!pgr || !pgr.applicationDate) return null;
        var daysSince = Math.floor((Date.now() - new Date(pgr.applicationDate).getTime()) / 86400000);
        if (daysSince < 0) return null;
        var product = pgr.productType ? pgr.productType : 'PGR';
        if (daysSince > 28) return { level: 'overdue', text: product + ', ' + daysSince + 'd since last application. Review reapplication window.' };
        if (daysSince > 21) return { level: 'due', text: product + ', ' + daysSince + 'd since application. Reapplication window approaching.' };
        if (daysSince > 14) return { level: 'active', text: product + ', ' + daysSince + 'd since application. Active suppression period.' };
        return { level: 'active', text: product + ', ' + daysSince + 'd since application.' };
    }

    function vwcDecision(vwc) {
        if (vwc === null || vwc === undefined) return null;
        if (vwc < 10) return { level: 'low', text: 'VWC ' + vwc + '%, soil dry, irrigation likely needed.' };
        if (vwc < 15) return { level: 'moderate', text: 'VWC ' + vwc + '%, soil moisture marginal.' };
        if (vwc > 35) return { level: 'high', text: 'VWC ' + vwc + '%, soil wet, hold irrigation.' };
        return { level: 'ok', text: 'VWC ' + vwc + '%, moisture adequate.' };
    }

    function formatDiseaseName(key) {
        var map = {
            dollarSpot:          'Dollar Spot',
            dollar_spot:         'Dollar Spot',
            brownPatch:          'Brown Patch',
            brown_patch:         'Brown Patch',
            anthracnose:         'Anthracnose',
            pythium:             'Pythium Blight',
            helminthosporium:    'Leaf Spot',
            grayLeafSpot:        'Gray Leaf Spot',
            gray_leaf_spot:      'Gray Leaf Spot',
            fusarium:            'Fusarium Patch',
            microdochium:        'Microdochium Patch',
            springDeadSpot:      'Spring Dead Spot',
            spring_dead_spot:    'Spring Dead Spot',
            largePatch:          'Large Patch',
            large_patch:         'Large Patch',
            takeAllPatch:        'Take-All Patch',
            crownRust:           'Crown Rust',
            crown_rust:          'Crown Rust'
        };
        if (map[key]) return map[key];
        // Fallback: CamelCase → words
        return key.replace(/([A-Z])/g, ' $1').replace(/^./, function (c) { return c.toUpperCase(); }).trim();
    }

    function speciesLabel(species) {
        var map = {
            'bentgrass':          'Creeping Bent',
            'browntop_bent':      'Browntop Bent',
            'couch':              'Couch/Bermuda',
            'bermuda':            'Couch/Bermuda',
            'kikuyu':             'Kikuyu',
            'ryegrass':           'Perennial Ryegrass',
            'perennial_ryegrass': 'Perennial Ryegrass',
            'bluegrass':          'Poa/Bluegrass',
            'poa':                'Poa/Bluegrass',
            'fescue':             'Fescue',
            'tall_fescue':        'Tall Fescue',
            'zoysia':             'Zoysia',
            'seashore_paspalum':  'Seashore Paspalum',
            'buffalograss':       'Buffalo',
            'st_augustine':       'St Augustine'
        };
        if (!species) return 'Species not set';
        return map[species.toLowerCase()] || species;
    }

    function turfTypeLabel(turfType, subCategory) {
        var labels = {
            'greens':   'Greens',
            'tees':     'Tees',
            'fairways': 'Fairways',
            'roughs':   'Roughs',
            'sport':    subCategory ? subCategory.charAt(0).toUpperCase() + subCategory.slice(1) : 'Sports',
            'bowls':    'Bowling Green',
            'lawns':    'Lawn',
            'parks':    'Park'
        };
        return labels[turfType] || (turfType ? turfType.charAt(0).toUpperCase() + turfType.slice(1) : '');
    }

    // =========================================================================
    // HTML RENDERING
    // =========================================================================

    function badgeHTML(level, text) {
        var colours = {
            high:     'background:var(--gaip-critical-bg);color:#991b1b;border:1px solid #fca5a5;',
            severe:   'background:var(--gaip-critical-bg);color:#831843;border:1px solid #f9a8d4;',
            moderate: 'background:var(--gaip-warning-bg);color:#92400e;border:1px solid var(--gaip-warning-border);',
            due:      'background:var(--gaip-warning-bg);color:#92400e;border:1px solid var(--gaip-warning-border);',
            overdue:  'background:var(--gaip-critical-bg);color:#991b1b;border:1px solid #fca5a5;',
            low:      'background:var(--gaip-good-bg);color:#166534;border:1px solid #86efac;',
            good:     'background:var(--gaip-good-bg);color:#166534;border:1px solid #86efac;',
            ok:       'background:var(--gaip-good-bg);color:#166534;border:1px solid #86efac;',
            active:   'background:var(--gaip-info-bg);color:#1e40af;border:1px solid #93c5fd;',
            poor:     'background:var(--gaip-critical-bg);color:#991b1b;border:1px solid #fca5a5;',
            default:  'background:var(--gaip-surface-hover);color:var(--gaip-text-secondary);border:1px solid var(--gaip-border);'
        };
        var style = colours[level] || colours.default;
        return '<span style="display:inline-block;padding:2px 8px;border-radius:4px;font-size:0.78em;font-weight:600;' + style + '">' + text + '</span>';
    }

    // GH-445: inline SVG in place of the emoji that were here, matching the
    // 24-box, currentColor, 2.5-stroke shapes the db-shell pages use. Three
    // marks carry the three meanings the levels have: a warning, a clock, and
    // a tick.
    var LEVEL_ICONS = {
        warning: '<path stroke-linecap="round" stroke-linejoin="round" d="M12 9v4m0 4h.01M10.3 3.9L1.8 18a2 2 0 001.7 3h16.9a2 2 0 001.7-3L13.7 3.9a2 2 0 00-3.4 0z"/>',
        clock: '<path stroke-linecap="round" stroke-linejoin="round" d="M12 7v5l3 2m6-2a9 9 0 11-18 0 9 9 0 0118 0z"/>',
        tick: '<path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/>',
    };

    var LEVEL_ICON_FOR = {
        high: 'warning', severe: 'warning', poor: 'warning',
        due: 'clock', overdue: 'clock', moderate: 'clock',
        low: 'tick', good: 'tick', ok: 'tick', active: 'tick',
    };

    function levelIconSvg(level) {
        var path = LEVEL_ICONS[LEVEL_ICON_FOR[level] || 'tick'];
        return '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" '
            + 'stroke-width="2.5" aria-hidden="true" focusable="false" '
            + 'style="flex-shrink:0;display:inline-block;vertical-align:-2px;">' + path + '</svg>';
    }

    function actionRowHTML(decision) {
        if (!decision) return '';
        var i = levelIconSvg(decision.level);
        var style = (decision.level === 'high' || decision.level === 'severe' || decision.level === 'overdue' || decision.level === 'poor')
            ? 'color:#991b1b;font-weight:600;'
            : (decision.level === 'moderate' || decision.level === 'due')
            ? 'color:#92400e;font-weight:500;'
            : 'color:#166534;';
        return '<div style="display:flex;gap:8px;align-items:flex-start;padding:4px 0;font-size:0.88em;line-height:1.4;">'
            + '<span style="' + style + 'flex-shrink:0;width:16px;text-align:center;">' + i + '</span>'
            + '<span style="' + style + '">' + decision.text + '</span>'
            + '</div>';
    }

    function metricPillHTML(label, value, unit, level) {
        var colours = {
            high:     '#ef4444',
            moderate: '#f59e0b',
            low:      '#22c55e',
            good:     '#22c55e',
            ok:       '#22c55e',
            poor:     '#ef4444',
            default:  'var(--gaip-text-secondary)'
        };
        var colour = colours[level] || colours.default;
        return '<div style="display:inline-flex;flex-direction:column;align-items:center;padding:6px 10px;background:var(--gaip-surface-muted);border:1px solid var(--gaip-border);border-radius:6px;min-width:60px;">'
            + '<span style="font-size:1.1em;font-weight:700;color:' + colour + ';">' + value + '<span style="font-size:0.7em;">' + (unit || '') + '</span></span>'
            + '<span style="font-size:0.72em;color:var(--gaip-text-secondary);margin-top:1px;">' + label + '</span>'
            + '</div>';
    }

    function buildSiteCard(site, config, metrics, vwc, isExpanded, isSingle) {
        var siteId     = site.id;
        var label      = site.label || siteId;
        var turf       = (config && config.turf)     || {};
        var pgr        = (config && config.pgr)      || {};
        // GH-477: the place and the coordinates come from the site row, which
        // owns them. This card was the reader the previous guard could not
        // see: the config arrives as a PARAMETER, and the guard looked for a
        // `getConfig(` call standing next to the read.
        var _row       = (global.GAIP_SiteConfig && typeof global.GAIP_SiteConfig.getSite === 'function')
            ? global.GAIP_SiteConfig.getSite(siteId) : null;
        var location   = _row
            ? { name: _row.location_name, lat: _row.latitude, lon: _row.longitude }
            : {};

        var species    = speciesLabel(turf.species);
        var turfType   = turfTypeLabel(turf.turfType, turf.subCategory);
        // The coordinates printed in place of a missing name are UNCHANGED
        // here, deliberately: what a card should say when a site has no name
        // for its place is question 10.8(12), the owner's, and it is in the
        // substitution inventory below (tests/gh477-…). The owner has already
        // said the report's Location line prints nothing rather than
        // coordinates (10.8(10)); whether the card follows is hers to say.
        var locName    = location.name || (location.lat ? Number(location.lat).toFixed(3) + ',' + Number(location.lon).toFixed(3) : '');

        // Priority score drives header colour.
        //
        // GH-443: a card with no analysis behind it gets no verdict colour.
        // Green here means "nothing needs attention", and it was shown for a
        // site whose data had simply not been read -- next to a banner saying
        // the settings could not be loaded. Grey says what is true: unknown.
        var hasData    = !!metrics || vwc !== null || !!pgr.applicationDate;
        var score      = computePriorityScore(metrics, config);
        // Literal colours for the no-data case: this page also renders on the
        // old layout, where the design-system custom properties are not
        // defined, and an undefined var() resolves to transparent -- which is
        // how a grey card would lose its border and its dot entirely.
        var headerBg   = !hasData ? '#f3f4f6'
            : score >= 60 ? 'var(--gaip-critical-bg)' : score >= 35 ? 'var(--gaip-warning-bg)' : 'var(--gaip-good-bg)';
        var headerBorder = !hasData ? '#d1d5db'
            : score >= 60 ? '#fca5a5' : score >= 35 ? 'var(--gaip-warning-border)' : '#86efac';
        var headerDot  = !hasData ? '#9ca3af'
            : score >= 60 ? '#ef4444' : score >= 35 ? '#f59e0b' : '#22c55e';

        // Computed metric pills
        var pillsHTML = '';
        if (metrics) {
            var gpRaw  = metrics.growthPotential;
            var gpPct  = gpRaw !== null && gpRaw !== undefined ? (gpRaw > 1 ? Math.round(gpRaw) : Math.round(gpRaw * 100)) : null;
            var disease = metrics.diseaseRisk;
            var stress  = metrics.stressIndex;
            var irr     = metrics.irrigationNeed;

            if (gpPct !== null) {
                // GH-257: canonical GP colour thresholds — see gp-status.js.
                var gpTier = window.GAIP_GPStatus ? window.GAIP_GPStatus.getLevelPct(gpPct) : (gpPct >= 70 ? 'high' : (gpPct >= 40 ? 'moderate' : 'low'));
                var gpLevel = gpTier === 'high' ? 'good' : gpTier === 'moderate' ? 'moderate' : 'poor';
                pillsHTML += metricPillHTML('GP', gpPct, '%', gpLevel);
            }
            if (disease !== null && disease !== undefined) {
                var dLevel = disease >= 70 ? 'high' : disease >= 50 ? 'moderate' : 'low';
                pillsHTML += metricPillHTML('Disease', Math.round(disease), '%', dLevel);
            }
            if (stress !== null && stress !== undefined) {
                var sLevel = stress >= 60 ? 'high' : stress >= 30 ? 'moderate' : 'low';
                pillsHTML += metricPillHTML('Stress', Math.round(stress), '', sLevel);
            }
            if (irr !== null && irr !== undefined) {
                var iLevel = irr > 20 ? 'high' : irr > 5 ? 'moderate' : 'ok';
                pillsHTML += metricPillHTML('Irr', Math.round(irr), 'mm', iLevel);
            }
        }
        if (vwc !== null && vwc !== undefined) {
            var vLevel = vwc < 10 ? 'poor' : vwc > 35 ? 'high' : 'ok';
            pillsHTML += metricPillHTML('VWC', vwc, '%', vLevel);
        }

        // Action rows
        var actionsHTML = '';
        if (metrics || vwc !== null) {
            if (metrics) {
                actionsHTML += actionRowHTML(gpDecision(metrics.growthPotential));
                actionsHTML += actionRowHTML(diseaseDecision(
                    metrics.diseaseRisk,
                    metrics.topDisease,
                    metrics.forecastPeak || null,
                    metrics.peakDay || null
                ));
            }
            if (vwc !== null && vwc !== undefined) {
                actionsHTML += actionRowHTML(vwcDecision(vwc));
            }
        }
        if (pgr.applicationDate) {
            actionsHTML += actionRowHTML(pgrDecision(pgr));
        }

        // No-data state for non-active sites
        // GH-443: no analysis, and no instruction to open the old hub. /hub is
        // the plugin-era interface: no client opens it and nothing links to
        // it. What this state means is that the site has not been analysed
        // yet, and the Dashboard is where that happens.
        var noDataHTML = !hasData
            ? '<div style="font-size:0.85em;color:var(--gaip-text-muted);padding:4px 0;">No analysis for this site yet.</div>'
            : '';

        // Header meta line
        var metaLine = [turfType, species, locName].filter(Boolean).join(' · ');

        // Expandable (multi-site) vs always-open (single)
        var bodyDisplay  = (isSingle || isExpanded) ? 'block' : 'none';
        var chevron      = isExpanded ? '▲' : '▼';
        var headerCursor = isSingle ? 'default' : 'pointer';
        var headerToggle = isSingle ? '' : ' onclick="window.GAIP_Briefing._toggle(\'' + siteId + '\')"';

        var cacheNote = metrics
            ? '<span style="font-size:0.72em;color:var(--gaip-text-muted);margin-left:auto;">last analysis</span>'
            : '';

        return '<div id="gaip-brief-card-' + siteId + '" style="border:1px solid ' + headerBorder + ';border-radius:8px;overflow:hidden;margin-bottom:10px;">'

            // Card header
            + '<div style="background:' + headerBg + ';padding:10px 14px;cursor:' + headerCursor + ';display:flex;align-items:center;gap:10px;"'
            + headerToggle + '>'
            + '<span style="width:8px;height:8px;border-radius:50%;background:' + headerDot + ';flex-shrink:0;display:inline-block;"></span>'
            + '<div style="flex:1;min-width:0;">'
            + '<div style="font-weight:600;font-size:0.95em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + label + '</div>'
            + (metaLine ? '<div style="font-size:0.78em;color:var(--gaip-text-secondary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + metaLine + '</div>' : '')
            + '</div>'
            + cacheNote
            + (!isSingle ? '<span style="font-size:0.8em;color:var(--gaip-text-muted);flex-shrink:0;">' + chevron + '</span>' : '')
            + '</div>'

            // Card body
            + '<div id="gaip-brief-body-' + siteId + '" style="display:' + bodyDisplay + ';padding:12px 14px;background:var(--gaip-surface);">'

            // Metric pills row
            + (pillsHTML ? '<div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:10px;">' + pillsHTML + '</div>' : '')

            // Action rows
            + (actionsHTML ? '<div style="border-top:1px solid var(--gaip-surface-hover);padding-top:8px;">' + actionsHTML + '</div>' : '')

            // No data notice
            + noDataHTML

            // Link to open site in hub
            + '<div style="margin-top:10px;padding-top:8px;border-top:1px solid var(--gaip-surface-hover);">'
            // GH-443: opens the site on the Dashboard, not the old hub.
            + '<a href="#" style="font-size:0.82em;color:#3b82f6;text-decoration:none;" onclick="window.GAIP_Briefing._openSite(\'' + siteId + '\');return false;">Open site →</a>'
            + '</div>'

            + '</div>'  // body
            + '</div>'; // card
    }

    // =========================================================================
    // MAIN RENDER
    // =========================================================================

    function render() {
        var container = document.getElementById(CONTAINER_ID);
        if (!container) return;

        var sites     = getSiteList();
        var configs   = getAllSiteConfigs();
        var activeSite = getActiveSiteId();

        if (!sites.length) {
            // GH-444: two different situations, said apart. Neither mentions
            // the old hub, which is not a page a client opens.
            container.innerHTML = _sitesError
                ? '<div style="padding:20px;color:#7f1d1d;font-size:0.9em;">Your sites could not be loaded. Reload the page; if this keeps happening, the server is not answering.</div>'
                : '<div style="padding:20px;color:var(--gaip-text-secondary);font-size:0.9em;">No sites yet. Add one in Settings.</div>';
            return;
        }

        var isSingle = sites.length === 1;

        // Read cache — hub-persistence now stamps siteId at write time (b35fix116d).
        var uid = (global.GAIP_HUB_CONFIG && global.GAIP_HUB_CONFIG.userId) || 0;
        var cacheRaw = safeParse(safeGet('gilba_hub_cache' + (uid ? '_' + uid : '')))
                    || safeParse(safeGet('gilba_hub_cache_1'))
                    || safeParse(safeGet('gilba_hub_cache'));
        var cachedDashboard = null;
        var cachedSiteId = null;
        if (cacheRaw && cacheRaw.dashboard) {
            var ageH = (Date.now() - new Date(cacheRaw.cachedAt).getTime()) / 3600000;
            if (ageH <= CACHE_MAX_AGE_H) {
                cachedDashboard = cacheRaw.dashboard;
                // Use siteId stamped by hub-persistence at cache write time
                cachedSiteId = cacheRaw.siteId || activeSite;
                log('Cache assigned to site:', cachedSiteId, '(age:', Math.round(ageH * 60), 'min)');
            } else {
                log('Cache expired:', Math.round(ageH), 'h old, run analysis in hub to refresh');
            }
        }

        // Build site data objects
        var cards = sites.map(function (site) {
            var config  = configs[site.id] || null;
            var metrics = (site.id === cachedSiteId) ? cachedDashboard : null;
            var vwc     = getSiteVWC(site.id);
            var score   = computePriorityScore(metrics, config);
            return { site: site, config: config, metrics: metrics, vwc: vwc, score: score };
        });

        // Sort multi-site: highest priority first
        if (!isSingle) {
            cards.sort(function (a, b) { return b.score - a.score; });
        }

        // Timestamp line
        var now     = new Date();
        var timeStr = now.toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short' })
                    + ' · ' + now.toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' });

        var html = '<div style="font-family:system-ui,sans-serif;max-width:800px;">';

        // Header
        html += '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;">'
            + '<div>'
            + '<div style="font-size:1.1em;font-weight:700;color:var(--gaip-text);">Morning Briefing</div>'
            + '<div style="font-size:0.8em;color:var(--gaip-text-muted);">' + timeStr + '</div>'
            + '</div>'
            + '<button onclick="window.GAIP_Briefing._refresh()" style="font-size:0.8em;padding:5px 12px;border:1px solid var(--gaip-border);border-radius:5px;background:var(--gaip-surface-muted);cursor:pointer;color:var(--gaip-text-secondary);">Refresh</button>'
            + '</div>';

        // Site cards
        cards.forEach(function (c, idx) {
            var expanded = isSingle || idx === 0; // expand first card by default
            html += buildSiteCard(c.site, c.config, c.metrics, c.vwc, expanded, isSingle);
        });

        // Footer
        if (!isSingle) {
            var activeLabel = '';
            sites.forEach(function (s) { if (s.id === activeSite) activeLabel = s.label; });
            if (activeLabel) {
                html += '<div style="font-size:0.78em;color:var(--gaip-text-muted);text-align:center;margin-top:4px;">'
                    + 'Computed metrics available for: <strong>' + activeLabel + '</strong> (last analysis). Open other sites in hub to populate their metrics.'
                    + '</div>';
            }
        }

        html += '</div>';
        container.innerHTML = html;

        log('Rendered', cards.length, 'site cards');
    }

    // =========================================================================
    // PUBLIC INTERFACE (called from inline onclick)
    // =========================================================================

    global.GAIP_Briefing = {
        version: VERSION,

        _toggle: function (siteId) {
            var body = document.getElementById('gaip-brief-body-' + siteId);
            var card = document.getElementById('gaip-brief-card-' + siteId);
            if (!body) return;
            var open = body.style.display !== 'none';
            body.style.display = open ? 'none' : 'block';
            // Update chevron
            if (card) {
                var chevron = card.querySelector('span:last-child');
                if (chevron && (chevron.textContent === '▲' || chevron.textContent === '▼')) {
                    chevron.textContent = open ? '▼' : '▲';
                }
            }
        },

        _openSite: function (siteId) {
            // GH-443: switch the active site and go to the Dashboard. This used
            // to navigate to GAIP_HUB_CONFIG.hubUrl -- the old plugin
            // interface, which is a calculation runner and not a page anyone is
            // meant to open.
            var SM = global.GAIP_SampleManager;
            if (SM && typeof SM.switchToSite === 'function') {
                SM.switchToSite(siteId);
            }

            var base = (global.GAIP_HUB_CONFIG && global.GAIP_HUB_CONFIG.siteUrl) || '';
            window.location.href = base.replace(/\/?$/, '') + '/dashboard';
        },

        _refresh: function () {
            // GH-444: Refresh re-reads the sites, not just the screen.
            loadSitesFromServer().then(render, render);
        },

        render: render
    };

    // =========================================================================
    // EVENT HOOKS
    // =========================================================================

    function init() {
        render();

        // Re-render when active site analysis completes (updates metrics).
        // b35fix135: use a one-shot flag to absorb the burst of orchestrator-complete
        // events that fire on page load (hub runs 2-3 analysis cycles during init).
        // After the first post-init render, subsequent events re-render normally.
        var _initBurst = true;
        setTimeout(function() { _initBurst = false; }, 5000);
        var _pendingRender = false;
        document.addEventListener('gaip:orchestrator-complete', function () {
            if (_initBurst) {
                // Coalesce burst — schedule one render 500ms after last event
                if (_pendingRender) return;
                _pendingRender = true;
                setTimeout(function() {
                    _pendingRender = false;
                    log('Orchestrator complete, refreshing briefing');
                    render();
                }, 500);
                return;
            }
            log('Orchestrator complete, refreshing briefing');
            render();
        });

        // Re-render on site switch (active site changed, cache now points elsewhere)
        document.addEventListener('gaip:site-changed', function () {
            log('Site changed, refreshing briefing');
            setTimeout(render, 400); // wait for SampleManager to update _currentSite
        });
    }

    // =========================================================================
    // BOOT
    // =========================================================================

    // GH-444: the sites come from the server before anything is drawn. The old
    // 1200 ms wait was for SampleManager to finish reading localStorage, which
    // is no longer where any of this comes from.
    function boot() {
        loadSitesFromServer().then(init, init);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', boot);
    } else {
        boot();
    }

}(window));
