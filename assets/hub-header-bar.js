/**
 * =============================================================================
 * GILBA HUB HEADER BAR v1.1.0
 * =============================================================================
 * 
 * Sticky header bar showing current site profile at a glance.
 * Displays: site name/location, species, cultivar, methodology, region,
 * and a "Site Settings" button that scrolls to the Turf Profile card.
 * 
 * Phase 1 of the progressive UI redesign. Pure addition — no existing
 * DOM elements are modified or moved. Reads from GaipTurfProfile.state
 * and listens to gaip:turf-profile-change for live updates.
 * 
 * @author Gilba Solutions
 * @version 1.1.0
 * =============================================================================
 */

(function() {
    'use strict';

    var VERSION = '1.2.0';  // v1.2.0: Site Settings opens wizard edit mode
    var HEADER_ID = 'gaip-hub-header-bar';

    // =========================================================================
    // HELPERS
    // =========================================================================

    function log(msg, data) {
        if (data !== undefined) {
        } else {
        }
    }

    /**
     * Get a human-readable label for the turf type + subcategory
     */
    function getTurfLabel(turfType, subCategory) {
        if (!turfType) return null;
        var labels = {
            golf: 'Golf',
            sports: 'Sports Field',
            lawns: 'Lawn'
        };
        var base = labels[turfType] || turfType;
        if (turfType === 'golf' && subCategory) {
            var subLabels = {
                greens: 'Greens',
                fairways: 'Fairways',
                tees: 'Tees',
                surrounds: 'Surrounds'
            };
            return base + ' · ' + (subLabels[subCategory] || subCategory);
        }
        return base;
    }

    /**
     * Get methodology display name
     */
    function getMethodologyLabel(value) {
        if (!value) return null;
        var labels = {
            mlsn: 'MLSN',
            slan: 'SLAN',
            ammonium_acetate: 'Ammonium Acetate'
        };
        return labels[value] || value;
    }

    /**
     * Get region display name from regional profiles if available
     */
    function getRegionLabel() {
        if (typeof window.gaip_getRegionDisplayInfo === 'function') {
            var info = window.gaip_getRegionDisplayInfo();
            if (info && info.name && info.name !== 'Unknown') return info.name;
        }
        return null;
    }

    /**
     * Get the current location name from the search input or saved config
     */
    function getLocationName() {
        // Priority 0: Active GSSH venue name (stadium mode overrides GAIP site label)
        if (window.GSSH_UnifiedVenueSelector && typeof window.GSSH_UnifiedVenueSelector.getCurrentVenue === 'function') {
            var venue = window.GSSH_UnifiedVenueSelector.getCurrentVenue();
            if (venue && venue.name) return venue.name;
        }

        // Priority 1: Active site label from SampleManager (e.g. "Federal Golf Club Canberra")
        if (window.GAIP_SampleManager && window.GAIP_SampleManager.getActiveSiteLabel) {
            var siteLabel = window.GAIP_SampleManager.getActiveSiteLabel();
            if (siteLabel && siteLabel !== 'default' && siteLabel !== 'Default Site') {
                return siteLabel;
            }
        }
        
        // Priority 2: Loaded profile name from TurfProfile
        if (window.GaipTurfProfile && window.GaipTurfProfile.state && window.GaipTurfProfile.state._profileName) {
            return window.GaipTurfProfile.state._profileName;
        }
        
        // Priority 3: Location search input (address)
        var searchInput = document.getElementById('gaip-location-search');
        if (searchInput && searchInput.value && searchInput.value.trim()) {
            return searchInput.value.trim();
        }
        // FIX v10.9.8: site-config-persistence restores to .gaip-location-name,
        // not #gaip-location-search. Check it as a fallback (critical on iOS Safari).
        var nameInput = document.querySelector('.gaip-location-name');
        if (nameInput && nameInput.value && nameInput.value.trim()) {
            return nameInput.value.trim();
        }
        // Fallback to localized config
        if (typeof GAIP_HUB_CONFIG !== 'undefined' && GAIP_HUB_CONFIG.savedLocation) {
            return GAIP_HUB_CONFIG.savedLocation.name || null;
        }
        return null;
    }

    /**
     * Read the current methodology from the DOM select
     */
    function getCurrentMethodology() {
        var sel = document.querySelector('.gaip-soil-methodology');
        return sel ? sel.value : null;
    }

    // =========================================================================
    // RENDER
    // =========================================================================

    function buildHeaderHTML() {
        return '' +
            '<div id="' + HEADER_ID + '" class="gaip-header-bar">' +
                '<div class="gaip-header-bar-inner">' +
                    '<div class="gaip-header-bar-left">' +
                        '<div class="gaip-header-bar-logo">' +
                            '<span class="gaip-header-bar-logo-icon">🌿</span>' +
                            '<span class="gaip-header-bar-logo-text">Gilba Hub</span>' +
                        '</div>' +
                        '<span class="gaip-header-bar-divider"></span>' +
                        '<div class="gaip-header-bar-location" id="gaip-header-location"></div>' +
                    '</div>' +
                    '<div class="gaip-header-bar-pills" id="gaip-header-pills"></div>' +
                    '<div class="gaip-header-bar-right">' +
                        '<button class="gaip-header-bar-theme-toggle" id="gaip-header-theme-btn" title="Toggle light/dark theme" aria-label="Toggle theme">' +
                            '<span class="gaip-theme-icon-dark">🌙</span>' +
                            '<span class="gaip-theme-icon-light">☀️</span>' +
                        '</button>' +
                        '<button class="gaip-header-bar-settings" id="gaip-header-settings-btn" title="Scroll to Site Settings">' +
                            '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">' +
                                '<circle cx="8" cy="8" r="2.5"/>' +
                                '<path d="M8 1.5v1.2M8 13.3v1.2M1.5 8h1.2M13.3 8h1.2M3.4 3.4l.85.85M11.75 11.75l.85.85M3.4 12.6l.85-.85M11.75 4.25l.85-.85"/>' +
                            '</svg>' +
                            '<span>Site Settings</span>' +
                        '</button>' +
                    '</div>' +
                '</div>' +
            '</div>';
    }

    /**
     * Update the header pills with current profile state
     */
    function updateHeader() {
        var pillsContainer = document.getElementById('gaip-header-pills');
        var locationContainer = document.getElementById('gaip-header-location');
        if (!pillsContainer) return;

        var tp = window.GaipTurfProfile;
        var state = tp ? tp.state : {};

        // Location
        var locationName = getLocationName();
        if (locationContainer) {
            locationContainer.textContent = locationName || 'No location set';
            locationContainer.className = 'gaip-header-bar-location' + 
                (locationName ? '' : ' gaip-header-bar-empty');
        }

        // Build pills
        var pills = [];

        // Turf type pill
        var turfLabel = getTurfLabel(state.turfType, state.subCategory);
        if (turfLabel) {
            pills.push({ label: turfLabel, icon: state.turfType === 'golf' ? '⛳' : state.turfType === 'sports' ? '🏟' : '🏡', tappable: true });
        }

        // Species pill
        if (state.species) {
            var speciesLabel = state.species;
            // Shorten common long names
            if (speciesLabel === 'Creeping Bentgrass (Greens)') speciesLabel = 'Creeping Bentgrass';
            if (speciesLabel === 'Browntop Bent (Greens)') speciesLabel = 'Browntop Bent';
            if (speciesLabel === 'Annual Bluegrass (Greens)') speciesLabel = 'Annual Bluegrass';
            pills.push({ label: speciesLabel, icon: '🌱', tappable: true });
        }

        // Variety pill (only if not generic)
        if (state.variety && state.variety !== 'generic') {
            pills.push({ label: state.variety, cls: 'cultivar', tappable: true });
        }

        // Methodology pill
        var methodology = getCurrentMethodology();
        var methodLabel = getMethodologyLabel(methodology);
        if (methodLabel) {
            pills.push({ label: methodLabel, cls: 'method' });
        }

        // Region pill
        var regionLabel = getRegionLabel();
        if (regionLabel) {
            pills.push({ label: regionLabel, cls: 'region' });
        }

        // Render pills
        var html = '';
        for (var i = 0; i < pills.length; i++) {
            var p = pills[i];
            var tag = p.tappable ? 'button' : 'span';
            var cls = 'gaip-header-pill' + (p.cls ? ' gaip-header-pill-' + p.cls : '')
                    + (p.tappable ? ' gaip-header-pill-tappable' : '');
            html += '<' + tag + ' class="' + cls + '"' + (p.tappable ? ' type="button"' : '') + '>';
            if (p.icon) html += '<span class="gaip-header-pill-icon">' + p.icon + '</span>';
            html += '<span>' + escHtml(p.label) + '</span>';
            html += '</' + tag + '>';
        }

        // Empty state — tappable to guide user to turf profile setup
        if (pills.length === 0) {
            html = '<button class="gaip-header-bar-empty gaip-header-pill-tappable" type="button">Tap to configure turf profile</button>';
        }

        pillsContainer.innerHTML = html;
    }

    function escHtml(str) {
        if (!str) return '';
        var div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    /**
     * Navigate to the Analysis tab and scroll to the turf profile card.
     * Shared by the Settings button and tappable turf pills.
     */
    function navigateToTurfProfile() {
        // Switch to Analysis tab if not already there
        if (window.GilbaTabNav && window.GilbaTabNav.getActiveTab() !== 'analysis') {
            window.GilbaTabNav.switchTab('analysis');
        }
        // Short delay for tab DOM update, then scroll
        setTimeout(function() {
            var profileCard = document.querySelector('.gaip-turf-profile-card');
            if (!profileCard) return;
            // Expand the card if it's collapsed (class-based, not inline style)
            var isCollapsed = profileCard.classList.contains('collapsed');
            if (isCollapsed) {
                var toggle = profileCard.querySelector('.gaip-card-toggle');
                if (toggle) toggle.click();
            }
            profileCard.scrollIntoView({ behavior: 'smooth', block: 'start' });
            profileCard.style.transition = 'box-shadow 0.3s ease';
            profileCard.style.boxShadow = '0 0 0 3px var(--gaip-accent, #2d7a4f)';
            setTimeout(function() { profileCard.style.boxShadow = ''; }, 1500);
        }, 150);
    }

    // =========================================================================
    // STYLES
    // =========================================================================

    function injectStyles() {
        if (document.getElementById('gaip-header-bar-styles')) return;

        var style = document.createElement('style');
        style.id = 'gaip-header-bar-styles';
        style.textContent = '' +
            /* Container */
            '.gaip-header-bar {' +
                'position: sticky;' +
                'top: 32px;' + /* WP admin bar clearance */
                'z-index: 150;' +
                'background: var(--gaip-surface, var(--gaip-surface));' +
                'border-bottom: 1px solid var(--gaip-border, var(--gaip-border));' +
                'margin: -20px -20px 16px -20px;' + /* Bleed into #gaip-hub padding */
                'padding: 0 20px;' +
                'border-radius: var(--gaip-radius, 10px) var(--gaip-radius, 10px) 0 0;' +
                'transition: box-shadow 0.2s ease;' +
            '}' +

            /* Shadow when stuck */
            '.gaip-header-bar.is-stuck {' +
                'box-shadow: 0 2px 12px rgba(0,0,0,0.08);' +
                'border-radius: 0;' +
            '}' +

            /* Inner flex container */
            '.gaip-header-bar-inner {' +
                'display: flex;' +
                'align-items: center;' +
                'gap: 16px;' +
                'padding: 10px 0;' +
                'min-height: 48px;' +
            '}' +

            /* Left section: logo + location */
            '.gaip-header-bar-left {' +
                'display: flex;' +
                'align-items: center;' +
                'gap: 12px;' +
                'flex-shrink: 0;' +
            '}' +

            '.gaip-header-bar-logo {' +
                'display: flex;' +
                'align-items: center;' +
                'gap: 6px;' +
            '}' +

            '.gaip-header-bar-logo-icon {' +
                'font-size: 18px;' +
                'line-height: 1;' +
            '}' +

            '.gaip-header-bar-logo-text {' +
                'font-size: 15px;' +
                'font-weight: 700;' +
                'color: var(--gaip-accent-dark, var(--gaip-accent-dark));' +
                'letter-spacing: -0.3px;' +
            '}' +

            '.gaip-header-bar-divider {' +
                'width: 1px;' +
                'height: 20px;' +
                'background: var(--gaip-border, var(--gaip-border));' +
                'flex-shrink: 0;' +
            '}' +

            '.gaip-header-bar-location {' +
                'font-size: 13px;' +
                'font-weight: 500;' +
                'color: var(--gaip-text, var(--gaip-text));' +
                'max-width: 200px;' +
                'overflow: hidden;' +
                'text-overflow: ellipsis;' +
                'white-space: nowrap;' +
            '}' +

            '.gaip-header-bar-location.gaip-header-bar-empty,' +
            '.gaip-header-bar-empty {' +
                'color: var(--gaip-text-muted, var(--gaip-text-muted));' +
                'font-style: italic;' +
                'font-weight: 400;' +
            '}' +

            /* Centre section: pills */
            '.gaip-header-bar-pills {' +
                'display: flex;' +
                'align-items: center;' +
                'gap: 6px;' +
                'flex: 1;' +
                'flex-wrap: wrap;' +
                'justify-content: center;' +
                'min-width: 0;' +
            '}' +

            '.gaip-header-pill {' +
                'display: inline-flex;' +
                'align-items: center;' +
                'gap: 4px;' +
                'padding: 3px 10px;' +
                'background: var(--gaip-surface-muted, var(--gaip-surface-muted));' +
                'border: 1px solid var(--gaip-border-light, var(--gaip-surface-hover));' +
                'border-radius: var(--gaip-radius-pill, 20px);' +
                'font-size: 12px;' +
                'font-weight: 500;' +
                'color: var(--gaip-text, var(--gaip-text));' +
                'white-space: nowrap;' +
                'line-height: 1.4;' +
            '}' +

            '.gaip-header-pill-icon {' +
                'font-size: 12px;' +
                'line-height: 1;' +
            '}' +

            /* Cultivar pill — subtle accent */
            '.gaip-header-pill-cultivar {' +
                'background: var(--gaip-accent-light, var(--gaip-accent-light));' +
                'border-color: var(--gaip-good-border, var(--gaip-good-border));' +
                'color: var(--gaip-accent-dark, var(--gaip-accent-dark));' +
            '}' +

            /* Method pill — info tone */
            '.gaip-header-pill-method {' +
                'background: var(--gaip-info-bg, var(--gaip-info-bg));' +
                'border-color: var(--gaip-info-border, var(--gaip-info-border));' +
                'color: var(--gaip-info, var(--gaip-info));' +
            '}' +

            /* Region pill — subtle */
            '.gaip-header-pill-region {' +
                'background: var(--gaip-surface-muted, var(--gaip-surface-muted));' +
                'color: var(--gaip-text-secondary, var(--gaip-text-secondary));' +
            '}' +

            /* Tappable turf pills */
            '.gaip-header-pill-tappable {' +
                'cursor: pointer;' +
                'border: 1px solid var(--gaip-border-light, #dce5dc);' +
                'font: inherit;' +
                'font-size: 12px;' +
                'font-weight: 500;' +
                'background: var(--gaip-surface-muted, var(--gaip-surface-muted));' +
                'padding: 3px 10px;' +
                'border-radius: var(--gaip-radius-pill, 20px);' +
                'transition: background 0.15s ease, border-color 0.15s ease;' +
            '}' +
            '.gaip-header-pill-tappable:hover {' +
                'background: var(--gaip-accent-light, var(--gaip-accent-light));' +
                'border-color: var(--gaip-good-border, var(--gaip-good-border));' +
            '}' +

            /* Right section: settings button */
            '.gaip-header-bar-right {' +
                'flex-shrink: 0;' +
            '}' +

            '.gaip-header-bar-settings {' +
                'display: inline-flex;' +
                'align-items: center;' +
                'gap: 6px;' +
                'padding: 6px 14px;' +
                'background: var(--gaip-surface, var(--gaip-surface));' +
                'border: 1px solid var(--gaip-border, var(--gaip-border));' +
                'border-radius: var(--gaip-radius-sm, 6px);' +
                'font-size: 13px;' +
                'font-weight: 500;' +
                'color: var(--gaip-text, var(--gaip-text));' +
                'cursor: pointer;' +
                'font-family: inherit;' +
                'transition: all 0.15s ease;' +
                'line-height: 1;' +
            '}' +

            '.gaip-header-bar-settings:hover {' +
                'background: var(--gaip-surface-hover, var(--gaip-surface-hover));' +
                'border-color: var(--gaip-accent, #2d7a4f);' +
                'color: var(--gaip-accent, #2d7a4f);' +
            '}' +

            '.gaip-header-bar-settings svg {' +
                'flex-shrink: 0;' +
            '}' +

            /* Theme toggle button */
            '.gaip-header-bar-theme-toggle {' +
                'display: inline-flex;' +
                'align-items: center;' +
                'justify-content: center;' +
                'width: 32px;' +
                'height: 32px;' +
                'padding: 0;' +
                'background: var(--gaip-surface);' +
                'border: 1px solid var(--gaip-border);' +
                'border-radius: var(--gaip-radius-sm);' +
                'cursor: pointer;' +
                'font-size: 15px;' +
                'line-height: 1;' +
                'transition: all 0.15s ease;' +
                'margin-right: 6px;' +
            '}' +

            '.gaip-header-bar-theme-toggle:hover {' +
                'border-color: var(--gaip-accent);' +
                'background: var(--gaip-surface-hover);' +
            '}' +

            /* Show moon in light mode (click to go dark), sun in dark mode (click to go light) */
            '.gaip-theme-icon-dark { display: inline; }' +
            '.gaip-theme-icon-light { display: none; }' +
            '#gaip-hub.gaip-dark .gaip-theme-icon-dark { display: none; }' +
            '#gaip-hub.gaip-dark .gaip-theme-icon-light { display: inline; }' +

            /* Hide the old <h2> title since the header bar replaces it */
            '#gaip-hub > h2 {' +
                'display: none;' +
            '}' +

            /* Responsive: stack on narrow screens */
            '@media (max-width: 768px) {' +
                '.gaip-header-bar-inner {' +
                    'flex-wrap: wrap;' +
                    'gap: 8px;' +
                    'padding: 8px 0;' +
                '}' +
                '.gaip-header-bar-left {' +
                    'width: 100%;' +
                    'justify-content: space-between;' +
                '}' +
                '.gaip-header-bar-pills {' +
                    'justify-content: flex-start;' +
                    'width: 100%;' +
                '}' +
                '.gaip-header-bar-right {' +
                    'display: none;' + /* Settings btn hidden on mobile — full profile card visible */
                '}' +
                '.gaip-header-bar-location {' +
                    'max-width: 150px;' +
                '}' +

            '}' +

            '@media (max-width: 480px) {' +
                '.gaip-header-pill {' +
                    'font-size: 11px;' +
                    'padding: 2px 8px;' +
                '}' +
            '}' +

            /* No WP admin bar (frontend / logged out) */
            'body:not(.admin-bar) .gaip-header-bar {' +
                'top: 0;' +
            '}';

        document.head.appendChild(style);
    }

    // =========================================================================
    // STICKY DETECTION
    // =========================================================================

    function setupStickyDetection(headerEl) {
        if (typeof IntersectionObserver === 'undefined') return;

        // Sentinel element — sits above the header; when it leaves the viewport,
        // the header is stuck
        var sentinel = document.createElement('div');
        sentinel.style.cssText = 'height: 1px; margin-bottom: -1px; pointer-events: none;';
        sentinel.setAttribute('aria-hidden', 'true');
        headerEl.parentNode.insertBefore(sentinel, headerEl);

        var observer = new IntersectionObserver(function(entries) {
            entries.forEach(function(entry) {
                if (entry.isIntersecting) {
                    headerEl.classList.remove('is-stuck');
                } else {
                    headerEl.classList.add('is-stuck');
                }
            });
        }, { threshold: 0 });

        observer.observe(sentinel);
    }

    // =========================================================================
    // INIT
    // =========================================================================

    function init() {
        var hub = document.getElementById('gaip-hub');
        if (!hub) return;

        // Don't double-inject
        if (document.getElementById(HEADER_ID)) return;

        log('Initializing v' + VERSION);

        // Inject CSS
        injectStyles();

        // Create header and insert as first child of #gaip-hub
        var wrapper = document.createElement('div');
        wrapper.innerHTML = buildHeaderHTML();
        var header = wrapper.firstElementChild;
        hub.insertBefore(header, hub.firstChild);

        // Sticky shadow detection
        setupStickyDetection(header);

        // Theme toggle — light/dark
        var hub = document.getElementById('gaip-hub');
        var themeBtn = document.getElementById('gaip-header-theme-btn');
        var THEME_KEY = 'gaip:theme';

        function applyTheme(isDark) {
            if (isDark) {
                hub.classList.add('gaip-dark');
            } else {
                hub.classList.remove('gaip-dark');
            }
            if (themeBtn) {
                themeBtn.setAttribute('aria-pressed', isDark ? 'true' : 'false');
            }
        }

        // Restore persisted theme preference
        var savedTheme = null;
        try {
            var sa = window.StorageAdapter || (window.GilbaHub && window.GilbaHub.StorageAdapter);
            if (sa && typeof sa.getGlobal === 'function') {
                savedTheme = sa.getGlobal(THEME_KEY);
            } else {
                savedTheme = localStorage.getItem(THEME_KEY);
            }
        } catch(e) {}
        // Default: dark (preserve existing user experience)
        applyTheme(savedTheme !== 'light');

        if (themeBtn) {
            themeBtn.addEventListener('click', function() {
                var nowDark = !hub.classList.contains('gaip-dark');
                applyTheme(nowDark);
                try {
                    var sa = window.StorageAdapter || (window.GilbaHub && window.GilbaHub.StorageAdapter);
                    if (sa && typeof sa.setGlobal === 'function') {
                        sa.setGlobal(THEME_KEY, nowDark ? 'dark' : 'light');
                    } else {
                        localStorage.setItem(THEME_KEY, nowDark ? 'dark' : 'light');
                    }
                } catch(e) {}
            });
        }

        // Settings button — navigate to Turf Profile card
        var settingsBtn = document.getElementById('gaip-header-settings-btn');
        if (settingsBtn) {
            settingsBtn.addEventListener('click', function(e) {
                e.preventDefault();
                // v1.1.0: Open wizard in edit mode if available, else scroll to profile
                if (window.GaipSetupWizard && typeof window.GaipSetupWizard.openEditMode === 'function') {
                    window.GaipSetupWizard.openEditMode();
                } else {
                    navigateToTurfProfile();
                }
            });
        }

        // Tappable pills — event delegation on pills container (survives re-renders)
        var pillsContainer = document.getElementById('gaip-header-pills');
        if (pillsContainer) {
            pillsContainer.addEventListener('click', function(e) {
                var pill = e.target.closest('.gaip-header-pill-tappable');
                if (!pill) return;
                navigateToTurfProfile();
            });
        }

        // Initial render
        updateHeader();

        // Listen for profile changes
        document.addEventListener('gaip:turf-profile-change', function() {
            updateHeader();
        });

        // Listen for methodology changes (not included in turfProfileChange)
        var methodSelect = document.querySelector('.gaip-soil-methodology');
        if (methodSelect) {
            methodSelect.addEventListener('change', function() {
                updateHeader();
            });
        }

        // Listen for location save (update location pill)
        document.addEventListener('gaip:wizard-complete', function() {
            updateHeader();
        });

        // Update region badge when site-config-persistence restores lat/lon for a new site.
        // Without this, the region pill shows the previous site's region until
        // the user manually triggers another update.
        document.addEventListener('gaip:site-config-applied', function() {
            updateHeader();
        });

        // Also refresh on explicit location restore (manual lat/lon change)
        // Small delay to ensure .gaip-lat/.gaip-lon DOM inputs are settled
        // before detectRegionFromHub reads them for the badge.
        document.addEventListener('gaip:location-restored', function() {
            setTimeout(updateHeader, 150);
        });

        // Also update when location search input changes
        var locSearch = document.getElementById('gaip-location-search');
        if (locSearch) {
            var locTimer;
            locSearch.addEventListener('change', function() {
                clearTimeout(locTimer);
                locTimer = setTimeout(updateHeader, 300);
            });
        }

        // Update header when stadium venue changes (GSSH mode)
        document.addEventListener('gssh:venueSelect', function() {
            updateHeader();
        });

        log('Ready');
    }

    // =========================================================================
    // BOOTSTRAP
    // =========================================================================

    // Run on DOMContentLoaded or immediately if already loaded
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function() {
            // Defer slightly to let TurfProfile initialize first
            setTimeout(init, 100);
        });
    } else {
        setTimeout(init, 100);
    }

})();
