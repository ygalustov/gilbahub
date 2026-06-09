/* Shared UI utilities for all dashboard pages
 * Handles: site switcher dropdown, Re-run button
 * Loaded before page-specific scripts on every page.
 */
(function (global) {
    'use strict';

    // ── Site switcher ─────────────────────────────────────────────────────────

    function initSiteSwitcher() {
        var btn      = document.getElementById('db-site-switcher-btn');
        var dropdown = document.getElementById('db-site-dropdown');
        if (!btn || !dropdown) return;

        btn.addEventListener('click', function (e) {
            e.stopPropagation();
            var open = !dropdown.hidden;
            dropdown.hidden = open;
            btn.setAttribute('aria-expanded', String(!open));
        });

        document.addEventListener('click', function () {
            dropdown.hidden = true;
            btn.setAttribute('aria-expanded', 'false');
        });

        dropdown.addEventListener('click', function (e) {
            e.stopPropagation();
            var target = e.target.closest('[data-site-id]');
            if (!target) return;
            var csrfToken = document.querySelector('meta[name="csrf-token"]') &&
                            document.querySelector('meta[name="csrf-token"]').content ||
                            (global.GAIP_HUB_CONFIG && global.GAIP_HUB_CONFIG.csrfToken) || '';
            target.disabled = true;
            target.textContent = '…';
            fetch('/api/active-site', {
                method:  'PATCH',
                headers: { 'Content-Type': 'application/json', 'X-CSRF-TOKEN': csrfToken, 'Accept': 'application/json' },
                body:    JSON.stringify({ site_id: target.dataset.siteId }),
            })
            .then(function (r) { return r.ok ? r.json() : Promise.reject(r.status); })
            .then(function () { global.location.reload(); })
            .catch(function () {
                target.disabled = false;
                target.textContent = target.dataset.siteName || 'Error';
            });
        });

        dropdown.querySelectorAll('[data-site-id]').forEach(function (el) {
            el.dataset.siteName = el.textContent.trim();
        });
    }

    // ── Re-run button ─────────────────────────────────────────────────────────

    function initRerun() {
        var btn = document.getElementById('db-rerun-btn');
        if (!btn) return;

        if (!document.getElementById('db-spin-style')) {
            var s = document.createElement('style');
            s.id = 'db-spin-style';
            s.textContent = '@keyframes db-spin { to { transform: rotate(360deg); } }';
            document.head.appendChild(s);
        }

        btn.addEventListener('click', function (e) {
            e.preventDefault();
            if (btn.dataset.running === '1') return;
            btn.dataset.running = '1';
            btn.disabled = true;
            btn.innerHTML = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="animation:db-spin 0.8s linear infinite"><path d="M4 12a8 8 0 018-8v4l4-4-4-4v4a10 10 0 100 10"/></svg> Running…';

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
                global.location.reload();
            }

            global.addEventListener('message', function onMsg(e) {
                if (e.data === 'gilba:analysis-complete') {
                    global.removeEventListener('message', onMsg);
                    finish();
                }
            });

            setTimeout(finish, 30000);
        });
    }

    // ── Tab badges ────────────────────────────────────────────────────────────
    // Reads GAIP_DASHBOARD_DATA.computed and populates the gl-badge-disease /
    // gl-badge-stress spans in the tabs bar consistently on all analysis pages.

    function initTabBadges() {
        var data     = global.GAIP_DASHBOARD_DATA;
        var computed = data && data.computed;
        if (!computed) return;

        function applyBadge(id, text, level) {
            var el = document.getElementById(id);
            if (!el || !text) return;
            var lvl = (level || '').toLowerCase();
            var cls = lvl === 'severe' || lvl === 'high' ? 'high'
                    : lvl === 'moderate'                 ? 'moderate'
                    : 'ok';
            el.textContent = text.charAt(0).toUpperCase() + text.slice(1);
            el.className   = 'gl-tab-badge ' + cls;
        }

        var disease     = computed.disease || {};
        var diseaseRisk = disease.overallRisk || disease.riskLevel || null;
        if (diseaseRisk) applyBadge('gl-badge-disease', diseaseRisk, diseaseRisk);

        var stress      = computed.stress || {};
        var stressLevel = stress.severity || stress.level || null;
        if (stressLevel) applyBadge('gl-badge-stress', stressLevel, stressLevel);

        var accEl = document.getElementById('gl-tab-accuracy');
        var conf  = computed.confidence;
        var confScore = conf && typeof conf === 'object' ? (conf.overall && conf.overall.score) : (typeof conf === 'number' ? conf : null);
        if (accEl && confScore != null) {
            accEl.textContent = 'Accuracy ' + Math.round(confScore) + '%';
            accEl.hidden = false;
        }
    }

    // ── Boot ──────────────────────────────────────────────────────────────────

    function initAnalysisTimestamp() {
        var data = global.GAIP_DASHBOARD_DATA;
        var ts = data && data.analyzedAt;
        if (!ts) return;
        var el = document.getElementById('db-analysis-ts');
        if (!el) return;
        var d = new Date(ts);
        if (isNaN(d.getTime())) return;
        var label = d.toLocaleDateString('en', { month: 'short', day: 'numeric' }) + ' ' +
                    d.toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit', hour12: false });
        el.textContent = 'Analysis: ' + label;
    }

    // ── Info popovers (db-info-icon) — shared across all pages ───────────
    function initInfoPopover() {
        var popover  = document.getElementById('db-info-popover');
        if (!popover || popover.dataset.initialized) return; // dashboard-init.js handles it there
        popover.dataset.initialized = '1';
        var popTitle = document.getElementById('db-info-popover-title');
        var popBody  = document.getElementById('db-info-popover-body');
        var popClose = document.getElementById('db-info-popover-close');
        var popArrow = document.getElementById('db-info-popover-arrow');
        if (!popover) return;

        var currentAnchor = null;

        function showPopover(anchor) {
            var key   = anchor.dataset.info;
            var store = global.GAIP_GLOSSARY || {};
            var entry = store[key];
            if (!entry) return;
            popTitle.textContent = entry.title || '';
            popBody.textContent  = entry.body  || '';
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

            popover.style.position   = 'fixed';
            popover.style.left       = left + 'px';
            popover.style.top        = top  + 'px';
            popover.style.visibility = '';

            if (popArrow) {
                var arrowLeft = Math.round(rect.left + rect.width / 2 - left - 5);
                arrowLeft = Math.max(12, Math.min(arrowLeft, pw - 22));
                popArrow.style.left      = arrowLeft + 'px';
                popArrow.style.top       = flipped ? ''     : '-6px';
                popArrow.style.bottom    = flipped ? '-6px' : '';
                popArrow.style.transform = flipped ? 'rotate(225deg)' : 'rotate(45deg)';
            }
            currentAnchor = anchor;
        }

        function hidePopover() { popover.style.display = 'none'; currentAnchor = null; }

        document.addEventListener('click', function (e) {
            var icon = e.target.closest('.db-info-icon');
            if (icon) {
                e.stopPropagation();
                if (currentAnchor === icon) { hidePopover(); } else { showPopover(icon); }
                return;
            }
            if (!popover.contains(e.target)) hidePopover();
        });

        document.addEventListener('keydown', function (e) { if (e.key === 'Escape') hidePopover(); });
        if (popClose) popClose.addEventListener('click', function (e) { e.stopPropagation(); hidePopover(); });

        document.querySelectorAll('.db-info-icon[data-info]').forEach(function (icon) {
            icon.addEventListener('keydown', function (e) {
                if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); showPopover(icon); }
            });
        });
    }

    function boot() {
        initSiteSwitcher();
        initRerun();
        initTabBadges();
        initAnalysisTimestamp();
        initInfoPopover();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', boot);
    } else {
        boot();
    }

}(window));

/* ── Shared Google Places geocoding helper ───────────────────────────────
 * Proxies through Laravel — API key stays server-side, no Maps JS needed.
 */
window.GilbaGeo = (function () {
    var _base  = (window.GAIP_HUB_CONFIG && window.GAIP_HUB_CONFIG.restUrl) || '/api/';
    var _csrf  = function () { return (window.GAIP_HUB_CONFIG && window.GAIP_HUB_CONFIG.csrfToken) || ''; };
    var _hdrs  = function () { return { 'Accept': 'application/json', 'X-CSRF-TOKEN': _csrf() }; };

    return {
        // search(query, fn) — fn receives [{description, placeId}]
        search: function (query, fn) {
            fetch(_base + 'geocode?q=' + encodeURIComponent(query), { headers: _hdrs() })
                .then(function (r) { return r.ok ? r.json() : Promise.reject(); })
                .then(function (d) { fn(d.suggestions || []); })
                .catch(function () { fn([]); });
        },

        // getDetails(placeId, fn) — fn receives {lat, lon, name} or null
        getDetails: function (placeId, fn) {
            fetch(_base + 'geocode/' + encodeURIComponent(placeId), { headers: _hdrs() })
                .then(function (r) { return r.ok ? r.json() : Promise.reject(); })
                .then(function (d) { fn(d); })
                .catch(function () { fn(null); });
        },
    };
}());
