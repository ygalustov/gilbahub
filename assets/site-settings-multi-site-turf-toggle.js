/**
 * Site Settings — Multi-site Turf Toggle (b35fix367)
 * ============================================================================
 * Injects a small toggle next to the Site selector that turns on per-sample
 * turf profile overrides for the currently active site. Default OFF.
 *
 * When ON for the active site:
 *   - Sample editor card shows the "🌱 Set turf profile…" button
 *   - sample.turfProfile overrides flow into engine inputs and the disease engines
 *
 * When OFF:
 *   - Behaviour identical to pre-b35fix367 (single-site users see no change)
 *   - Existing overrides on samples are preserved but ignored (non-destructive)
 *
 * Storage and round-trip handled by GAIP_SiteConfig.setMultiSiteTurfEnabled.
 */
(function (global) {
    'use strict';

    var TOGGLE_CLASS = 'gaip-multi-site-turf-toggle';

    function _isEnabledForActiveSite() {
        try {
            var SC = global.GAIP_SiteConfig;
            if (SC && typeof SC.isMultiSiteTurfEnabled === 'function') {
                return !!SC.isMultiSiteTurfEnabled();
            }
        } catch (e) { /* defensive */ }
        return false;
    }

    function _renderToggle() {
        var rows = document.querySelectorAll('.gaip-site-selector-row');
        for (var r = 0; r < rows.length; r++) {
            var row = rows[r];
            // Skip if already injected
            if (row.querySelector('.' + TOGGLE_CLASS)) continue;

            var wrap = document.createElement('label');
            wrap.className = TOGGLE_CLASS;
            wrap.title = 'When ON, samples within this site can carry their own turf type / species / variety override. Use for council and multi-cohort sites.';
            wrap.style.cssText =
                'display:inline-flex;align-items:center;gap:6px;margin-left:10px;' +
                'font-size:11px;color:var(--gaip-text-secondary,#9ca3af);' +
                'cursor:pointer;user-select:none;';

            var cb = document.createElement('input');
            cb.type = 'checkbox';
            cb.className = TOGGLE_CLASS + '-cb';
            cb.style.cssText = 'margin:0;cursor:pointer;';
            cb.checked = _isEnabledForActiveSite();

            var txt = document.createElement('span');
            txt.textContent = '🌱 Multi-site turf';

            wrap.appendChild(cb);
            wrap.appendChild(txt);
            row.appendChild(wrap);

            cb.addEventListener('change', function () {
                try {
                    var SC = global.GAIP_SiteConfig;
                    if (SC && typeof SC.setMultiSiteTurfEnabled === 'function') {
                        SC.setMultiSiteTurfEnabled(null, this.checked);
                    }
                } catch (e) {
                    console.warn('[MultiSiteTurfToggle] set failed:', e);
                    this.checked = !this.checked;
                }
            });
        }
    }

    function _refreshAllToggles() {
        var checked = _isEnabledForActiveSite();
        var cbs = document.querySelectorAll('.' + TOGGLE_CLASS + '-cb');
        for (var i = 0; i < cbs.length; i++) {
            cbs[i].checked = checked;
        }
    }

    function _init() {
        _renderToggle();

        // Re-inject when the site selector re-renders (it is replaced wholesale,
        // not edited in place, so the toggle is wiped each time).
        document.addEventListener('gaip:site-changed', function () {
            // Site dashboard re-renders synchronously on this event; allow one
            // microtask so the new selector row exists before we look for it.
            setTimeout(function () {
                _renderToggle();
                _refreshAllToggles();
            }, 0);
        });
        document.addEventListener('gaip:site-added',   function () { setTimeout(_renderToggle, 0); });
        document.addEventListener('gaip:site-removed', function () { setTimeout(_renderToggle, 0); });

        // If something else flips the toggle (programmatic, server-pull,
        // CSV import auto-flip in b35fix368), keep the visible checkbox honest.
        document.addEventListener('gaip:multi-site-turf-change', _refreshAllToggles);

        // MutationObserver fallback for cases where the site selector is
        // rendered after this script loads. Cheap because the observer scope
        // is the document body and the work it does is one querySelectorAll.
        if (typeof MutationObserver !== 'undefined') {
            var mo = new MutationObserver(function () {
                if (document.querySelector('.gaip-site-selector-row') &&
                    !document.querySelector('.' + TOGGLE_CLASS)) {
                    _renderToggle();
                }
            });
            try {
                mo.observe(document.body, { childList: true, subtree: true });
            } catch (e) { /* defensive */ }
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', _init);
    } else {
        _init();
    }

    // Expose for debugging / testability
    global.GaipMultiSiteTurfToggle = {
        version: '1.0.0',
        rerender: _renderToggle,
        refresh: _refreshAllToggles
    };
})(typeof window !== 'undefined' ? window : this);
