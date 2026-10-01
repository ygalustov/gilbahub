/**
 * =============================================================================
 * GILBA AUTO-REFRESH v1.0.0
 * =============================================================================
 *
 * For returning users, automatically runs climate-driven analysis on page load
 * so the daily dashboard is populated without requiring "Analyse."
 *
 * Flow:
 *   1. Wait for persistence to finish restoring (gaip:stateRestored)
 *   2. Verify this is a returning user (wizard complete + location set)
 *   3. Programmatically click the run button (same flow as manual analysis)
 *   4. Dashboard updates via existing gaip:analysis-complete listener
 *
 * Soil/tissue/water widgets show whatever cached values persistence restored.
 * Climate-driven widgets (growth potential, disease risk, ETo, weather, PGR
 * countdown) get fresh data from Open-Meteo.
 *
 * Guard: Only fires once per page load. Does not fire if:
 *   - Wizard hasn't been completed (first-run user)
 *   - No location/coordinates set
 *   - User has already clicked "Analyse" manually
 *   - Analysis is already in progress
 *
 * Dependencies: hub-persistence.js, hub-tissue-v3.js, site-setup-wizard.js
 * @version 1.0.0
 * =============================================================================
 */

(function() {
    'use strict';

    var VERSION = '1.0.0';
    var _hasFired = false;
    var _manualRunDetected = false;
    var _stateRestored = false;
    var _siteConfigApplied = false; // Gate added to wait for correct species/turfType in DOM

    // =========================================================================
    // LOGGING
    // =========================================================================

    function log(msg, data) {
        if (data !== undefined) {
        } else {
        }
    }

    // =========================================================================
    // GUARDS
    // =========================================================================

    /**
     * Check all preconditions for auto-refresh
     */
    function canAutoRefresh() {
        // GH-441 (GH-439 stage 2, review): the site's settings could not be
        // read, so the legacy form holds its own defaults and nothing else.
        // An analysis run from here would produce a Growth Potential, a
        // disease risk and a stress score that look measured and are not. The
        // page shows the settings-unavailable banner instead.
        if (window.GAIP_SITE_CONFIG_FAILED) {
            log('Skipping, site settings could not be loaded');
            return false;
        }

        // Already fired this page load
        if (_hasFired) {
            log('Skipping, already fired this session');
            return false;
        }

        // User already clicked Analyse manually before restore finished
        if (_manualRunDetected) {
            log('Skipping, manual analysis already triggered');
            return false;
        }

        // First-run user (wizard not completed AND no saved state restored)
        if (!_stateRestored && typeof GAIP_WIZARD_CONFIG !== 'undefined' && !GAIP_WIZARD_CONFIG.wizardComplete) {
            log('Skipping, wizard not completed and no saved state (first-run user)');
            return false;
        }

        // No coordinates set — nothing to fetch weather for
        var lat = document.querySelector('.gaip-lat');
        var lon = document.querySelector('.gaip-lon');
        if (!lat || !lon) {
            log('Skipping, no lat/lon inputs found');
            return false;
        }
        var latVal = parseFloat(lat.value);
        var lonVal = parseFloat(lon.value);
        if (!latVal && !lonVal) {
            log('Skipping, coordinates are 0,0 (no location set)');
            return false;
        }

        // v2.10.2: Live weather check removed from guard
        // triggerAutoRefresh() now enables live weather automatically if location is set
        // This ensures dashboard auto-populates on page load

        return true;
    }

    // =========================================================================
    // STALENESS INDICATOR
    // =========================================================================

    /**
     * GH-790 (queue item 9) — THE "LAST ANALYSED" BADGE IS GONE, because its time was never that.
     *
     * It read `savedAt` out of `gilba_hub_state`, the snapshot of this page's own form, and printed it on
     * the soil, tissue and water cards as when the site was last ANALYSED. The two are different facts: the
     * snapshot was rewritten on every keystroke inside the hub and on fourteen events of the page, so the
     * badge said "just now" about an analysis that had not run, and the key was one per user rather than per
     * site. The snapshot is withdrawn by this item, and this page is handed no analysis time by the server
     * -- the legacy layout carries no `analysisCache` -- so there is nothing to print rather than something
     * to print differently. `/hub` is a calculation runner and no client sees this panel.
     *
     * `removeStalenessIndicators()` below stays: it clears badges, and clearing nothing is safe.
     */


    /**
     * Remove staleness badges (after a full manual analysis)
     */
    function removeStalenessIndicators() {
        var badges = document.querySelectorAll('.gaip-staleness-badge');
        badges.forEach(function(b) { b.remove(); });
    }

    // =========================================================================
    // TRIGGER
    // =========================================================================

    /**
     * Gate function: fires triggerAutoRefresh only when BOTH state is restored
     * AND site-config has applied the correct turfType/species to the DOM.
     * Called by both gaip:stateRestored and gaip:site-config-applied listeners.
     */
    function _maybeFireAutoRefresh() {
        if (_hasFired || _manualRunDetected) return;
        if (!_stateRestored || !_siteConfigApplied) return;
        // Small settling delay (species dropdown cascade takes ~50ms after dispatch)
        setTimeout(triggerAutoRefresh, 150);
    }

    function triggerAutoRefresh() {
        if (!canAutoRefresh()) return;

        _hasFired = true;
        log('Triggering auto-refresh for returning user');

        // v2.10.2: Enable live weather if coordinates are set
        // Dashboard needs current weather to produce meaningful results
        var liveWeather = document.querySelector('.gaip-use-live-weather');
        if (liveWeather && !liveWeather.checked) {
            var lat = document.querySelector('.gaip-lat');
            var lon = document.querySelector('.gaip-lon');
            if (lat && lon && parseFloat(lat.value) && parseFloat(lon.value)) {
                log('Enabling live weather for auto-refresh (location is set)');
                liveWeather.checked = true;
                liveWeather.dispatchEvent(new Event('change', { bubbles: true }));
            }
        }

        // Find the real run button
        var runBtn = document.querySelector('.gaip-run-btn');
        if (!runBtn) {
            log('Run button not found, aborting');
            return;
        }

        // GH-790 (queue item 9): the badge is gone and so is its call. My own slip, caught by reading the file
        // after the removal rather than by a run: the function was deleted and this line left behind, which
        // would have thrown on every auto-refresh of `/hub` -- the frame nobody watches.

        // Scroll dashboard into view (it's the landing)
        var dashboard = document.getElementById('gaip-daily-dashboard');
        if (dashboard) {
            // Ensure dashboard is expanded
            if (dashboard.classList.contains('collapsed')) {
                var header = dashboard.querySelector('.gaip-dashboard-header');
                if (header) header.click();
            }
        }

        // Show a subtle loading indicator on the dashboard
        var updatedEl = document.querySelector('.gaip-dashboard-updated');
        if (updatedEl) {
            updatedEl.textContent = 'Refreshing...';
            updatedEl.style.color = '#2d7a4f';
        }

        // Click the run button — this triggers the full analysis chain
        log('Clicking run button');
        runBtn.click();

        // Listen for completion to update dashboard timestamp
        var onComplete = function() {
            log('Auto-refresh analysis complete');
            if (updatedEl) {
                updatedEl.style.color = '';
            }
            document.removeEventListener('gaip:analysis-complete', onComplete);
        };
        document.addEventListener('gaip:analysis-complete', onComplete);

        // Fallback timeout
        setTimeout(function() {
            if (updatedEl) {
                updatedEl.style.color = '';
            }
        }, 15000);
    }

    // =========================================================================
    // INIT
    // =========================================================================

    function init() {
        log('Initializing v' + VERSION);

        // Detect if user manually clicks Analyse before auto-refresh fires
        var runBtn = document.querySelector('.gaip-run-btn');
        if (runBtn) {
            runBtn.addEventListener('click', function() {
                if (!_hasFired) {
                    _manualRunDetected = true;
                    log('Manual run detected, suppressing auto-refresh');
                }
                // Remove staleness badges on manual analysis
                removeStalenessIndicators();
            }, { once: false });
        }

        // Listen for persistence restore completion.
        // We no longer fire immediately on state-restore — we also need gaip:site-config-applied
        // so that SiteConfig has restored the correct turfType/species before the run fires.
        // Without this gate, AutoRefresh was clicking run at ~500ms with sports/Ryegrass in the DOM
        // while SiteConfig was still initialising and hadn't yet set golf/Bentgrass.
        document.addEventListener('gaip:stateRestored', function(e) {
            _stateRestored = true;
            log('State restored', e.detail);
            _maybeFireAutoRefresh();
        });

        // Also listen on the kebab-case variant dispatched by hub-persistence.js
        document.addEventListener('gaip:state-restored', function(e) {
            _stateRestored = true;
            _maybeFireAutoRefresh();
        });

        // Wait for SiteConfig to finish applying the correct turf profile to the DOM.
        // site-config-persistence.js dispatches this after restoreConfig() cascade completes.
        document.addEventListener('gaip:site-config-applied', function() {
            _siteConfigApplied = true;
            _maybeFireAutoRefresh();
        });

        // Fallback: if gaip:site-config-applied never fires (SiteConfig not installed,
        // SampleManager unavailable, or first-ever visit), run after 4.5s.
        setTimeout(function() {
            if (!_hasFired && !_manualRunDetected) {
                _siteConfigApplied = true;  // unblock the gate
                _stateRestored = true;
                log('Fallback trigger, site-config-applied not received');
                triggerAutoRefresh();
            }
        }, 4500);

        log('Ready, waiting for state restore');
    }

    // =========================================================================
    // PUBLIC API
    // =========================================================================

    window.GilbaAutoRefresh = {
        version: VERSION,
        trigger: triggerAutoRefresh,
        hasFired: function() { return _hasFired; }
    };

    // =========================================================================
    // BOOTSTRAP
    // =========================================================================

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function() {
            setTimeout(init, 200);
        });
    } else {
        setTimeout(init, 200);
    }

})();
