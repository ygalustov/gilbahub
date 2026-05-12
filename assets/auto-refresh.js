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
     * Add "last analysed" staleness badges to soil/tissue/water cards
     * so users know those sections show cached (not fresh) data.
     */
    function addStalenessIndicators() {
        try {
            var savedState = localStorage.getItem('gilba_hub_state');
            if (!savedState) return;

            var parsed = JSON.parse(savedState);
            var savedAt = parsed.savedAt;
            if (!savedAt) return;

            var date = new Date(savedAt);
            var now = new Date();
            var diffMs = now - date;
            var diffMins = Math.floor(diffMs / 60000);
            var diffHours = Math.floor(diffMs / 3600000);
            var diffDays = Math.floor(diffMs / 86400000);

            var label;
            if (diffMins < 2) {
                label = 'just now';
            } else if (diffMins < 60) {
                label = diffMins + 'min ago';
            } else if (diffHours < 24) {
                label = diffHours + 'h ago';
            } else if (diffDays === 1) {
                label = 'yesterday';
            } else {
                label = diffDays + ' days ago';
            }

            // Find cards that hold lab-based data (not climate-driven)
            var staleCards = [
                { selector: '[data-section="mlsn"]', name: 'Soil' },
                { selector: '[data-section="tissue"]', name: 'Tissue' },
                { selector: '.gaip-water-grid', name: 'Water' }
            ];

            staleCards.forEach(function(card) {
                var el = document.querySelector(card.selector);
                if (!el) return;

                // Find the parent card
                var cardEl = el.closest('.gaip-card');
                if (!cardEl) return;

                // Don't add if already present
                if (cardEl.querySelector('.gaip-staleness-badge')) return;

                var header = cardEl.querySelector('.gaip-card-header h3');
                if (!header) return;

                var badge = document.createElement('span');
                badge.className = 'gaip-staleness-badge';
                badge.textContent = 'Last analysed ' + label;
                badge.style.cssText = 'font-size: 10px; font-weight: 400; color: var(--gaip-text-muted); ' +
                    'margin-left: 8px; padding: 2px 6px; background: var(--gaip-surface-hover); ' +
                    'border-radius: 4px; vertical-align: middle;';
                header.appendChild(badge);
            });

        } catch (e) {
            // Ignore — staleness is non-critical
        }
    }

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

        // Add staleness badges to lab-based cards before analysis runs
        addStalenessIndicators();

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
