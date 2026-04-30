/**
 * =============================================================================
 * UNIFIED VENUE SELECTOR v2.1.0
 * =============================================================================
 * 
 * Populates the Hub's stadium venue dropdown with ALL venues from database.
 * Includes Australia, UK, and Japan stadiums.
 * 
 * FLOW:
 *   Hub stadium dropdown → Sets coordinates → Auto-detects hemisphere
 *   → Triggers Stadium Light shade calc → Results flow to Hub modules
 * 
 * =============================================================================
 */

(function(global) {
    'use strict';

    // =========================================================================
    // STADIUM DATA (from PHP via wp_localize_script)
    // =========================================================================
    
    // Will be populated from GilbaStadiumData.stadiums if available
    let ALL_STADIUMS = {};

    // ── Per-venue species preference store (b35fix156) ──────────────────────
    // When a user explicitly sets a species on a GSSH venue page, that choice
    // is saved here and takes precedence over the venue database default
    // (including overseed-active logic). Cleared only when venue changes.
    var GSSH_SPECIES_PREFS_KEY = 'gilba_gssh_species_prefs';

    function getVenueSpeciesPref(venueId) {
        try {
            var raw = localStorage.getItem(GSSH_SPECIES_PREFS_KEY);
            var prefs = raw ? JSON.parse(raw) : {};
            return prefs[venueId] || null;
        } catch(e) { return null; }
    }

    function setVenueSpeciesPref(venueId, species) {
        try {
            var raw = localStorage.getItem(GSSH_SPECIES_PREFS_KEY);
            var prefs = raw ? JSON.parse(raw) : {};
            prefs[venueId] = species;
            localStorage.setItem(GSSH_SPECIES_PREFS_KEY, JSON.stringify(prefs));
        } catch(e) {}
    }

    // Listen for explicit species selections by the user and save the preference
    document.addEventListener('gaip:speciesChanged', function(e) {
        var detail = e.detail || {};
        var currentVenueId = (window.GSSH_UnifiedVenueSelector && window.GSSH_UnifiedVenueSelector.getCurrentVenueId)
            ? window.GSSH_UnifiedVenueSelector.getCurrentVenueId() : null;
        if (currentVenueId && detail.species && detail.source === 'user') {
            setVenueSpeciesPref(currentVenueId, detail.species);
            console.log('[UnifiedVenue] Saved species preference for', currentVenueId, ':', detail.species);
        }
    });
    
    // Fallback UK stadiums if PHP data not available
    const UK_STADIUMS_FALLBACK = {
        'emirates_stadium': { name: 'Emirates Stadium', lat: 51.5549, lng: -0.1084, region: 'uk', state: 'London' },
        'old_trafford': { name: 'Old Trafford', lat: 53.4631, lng: -2.2913, region: 'uk', state: 'Manchester' },
        'anfield': { name: 'Anfield', lat: 53.4308, lng: -2.9609, region: 'uk', state: 'Liverpool' },
        'wembley_stadium': { name: 'Wembley Stadium', lat: 51.5560, lng: -0.2795, region: 'uk', state: 'London' }
    };

    // =========================================================================
    // UNIFIED VENUE SELECTOR
    // =========================================================================
    
    const UnifiedVenueSelector = {
        
        version: '2.1.0',
        currentVenue: null,
        currentMode: 'stadium',
        initialized: false,
        
        // =====================================================================
        // INITIALIZATION
        // =====================================================================
        
        init: function() {
            if (this.initialized) return;

            console.log('[UnifiedVenue] Initializing v' + this.version);

            // Load stadium data from PHP or use fallback.
            // Always safe to run — no DOM dependency.
            this.loadStadiumData();

            // Check URL for venue parameter.
            // Always safe to run — reads window.location only.
            this.checkURLParams();

            // Setup when DOM ready — but do NOT set initialized=true yet.
            // setup() returns true only when the stadium dropdown was found
            // and fully wired. If the wrapper hasn't been injected by
            // stadium-tab-ui.js yet, setup() is a no-op and we stay
            // uninitialized so the second call (post-injection) completes it.
            if (document.readyState === 'loading') {
                document.addEventListener('DOMContentLoaded', () => {
                    if (this.setup()) this.initialized = true;
                });
            } else {
                if (this.setup()) this.initialized = true;
            }
        },
        
        loadStadiumData: function() {
            // Check if PHP passed stadium data
            if (typeof GilbaStadiumData !== 'undefined' && GilbaStadiumData.stadiums) {
                ALL_STADIUMS = GilbaStadiumData.stadiums;
                console.log('[UnifiedVenue] Loaded', Object.keys(ALL_STADIUMS).length, 'stadiums from database');
            } else {
                ALL_STADIUMS = UK_STADIUMS_FALLBACK;
                console.log('[UnifiedVenue] Using fallback UK stadiums');
            }
        },
        
        setup: function() {
            const found = this.populateStadiumDropdown();
            if (!found) {
                // Dropdown not in DOM yet — stadium-tab-ui.js will call init()
                // again after injecting the wrapper. Stay uninitialized.
                return false;
            }
            this.setupModeToggle();
            this.bindVenueSelect();
            this.hideStadiumLightDropdowns();

            if (this.currentVenue) {
                // Only auto-select on the first successful setup() call.
                // stadium-tab-ui.js calls init() a second time after injecting the
                // wrapper DOM — without this guard, selectVenue fires twice.
                if (!this._venueAutoSelected) {
                    this._venueAutoSelected = true;
                    setTimeout(() => this.selectVenue(this.currentVenue), 500);
                }
            }

            console.log('[UnifiedVenue] Ready - ' + Object.keys(ALL_STADIUMS).length + ' venues available');
            return true;
        },
        
        checkURLParams: function() {
            const urlParams = new URLSearchParams(window.location.search);
            const venueId = urlParams.get('gssh_venue');
            
            if (venueId) {
                this.currentVenue = venueId;
                console.log('[UnifiedVenue] Venue from URL:', venueId);
            }
        },
        
        // =====================================================================
        // POPULATE HUB DROPDOWN
        // =====================================================================
        
        populateStadiumDropdown: function() {
            const select = document.getElementById('gssh-stadium-venue-select');
            if (!select) {
                console.log('[UnifiedVenue] Hub stadium dropdown not found');
                return false;
            }
            
            // Group stadiums by region/country
            const grouped = {
                australia: { label: '🇦🇺 Australia', stadiums: [] },
                nz: { label: '🇳🇿 New Zealand', stadiums: [] },
                uk: { label: '🇬🇧 United Kingdom', stadiums: [] },
                japan: { label: '🇯🇵 Japan', stadiums: [] },
                other: { label: 'Other', stadiums: [] }
            };

            // Map PHP region/country values to our group keys
            const regionMap = {
                'Oceania': 'australia',  // Default Oceania to AU (NZ overridden by country)
                'Australia': 'australia',
                'australia': 'australia',
                'New Zealand': 'nz',
                'new_zealand': 'nz',
                'Europe': 'uk',
                'United Kingdom': 'uk',
                'uk': 'uk',
                'Asia': 'japan',
                'Japan': 'japan',
                'japan': 'japan'
            };
            
            for (const [id, data] of Object.entries(ALL_STADIUMS)) {
                // Try country first, then region, then fallback
                const country = data.country || '';
                const region = data.region || '';
                const groupKey = regionMap[country] || regionMap[region] || 'other';
                
                if (grouped[groupKey]) {
                    grouped[groupKey].stadiums.push({ id, ...data });
                } else {
                    grouped.other.stadiums.push({ id, ...data });
                }
            }
            
            // Sort stadiums within each region by name
            for (const region of Object.values(grouped)) {
                region.stadiums.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
            }
            
            // Clear and rebuild dropdown
            select.innerHTML = '<option value="">-- Select a Stadium --</option>';
            
            // Add each region as optgroup
            const regionOrder = ['australia', 'nz', 'uk', 'japan', 'other'];
            
            for (const regionKey of regionOrder) {
                const region = grouped[regionKey];
                if (region.stadiums.length === 0) continue;
                
                const optgroup = document.createElement('optgroup');
                optgroup.label = region.label;
                
                // Sub-group by state within region
                const byState = {};
                region.stadiums.forEach(s => {
                    const state = (s.location ? s.location.state : s.state) || 'Other';
                    if (!byState[state]) byState[state] = [];
                    byState[state].push(s);
                });
                
                // If more than 3 states, group by state
                const stateKeys = Object.keys(byState).sort();
                if (stateKeys.length > 3) {
                    for (const state of stateKeys) {
                        byState[state].forEach(s => {
                            const opt = document.createElement('option');
                            opt.value = s.id;
                            opt.textContent = `${s.name} (${state})`;
                            opt.dataset.lat = (s.location ? s.location.lat : s.lat);
                            opt.dataset.lng = (s.location ? s.location.lng : s.lng);
                            optgroup.appendChild(opt);
                        });
                    }
                } else {
                    // Just list all
                    region.stadiums.forEach(s => {
                        const opt = document.createElement('option');
                        opt.value = s.id;
                        const city = s.location ? s.location.city : s.city;
                        opt.textContent = city ? `${s.name} - ${city}` : s.name;
                        opt.dataset.lat = (s.location ? s.location.lat : s.lat);
                        opt.dataset.lng = (s.location ? s.location.lng : s.lng);
                        optgroup.appendChild(opt);
                    });
                }
                
                select.appendChild(optgroup);
            }
            
            console.log('[UnifiedVenue] Populated dropdown with', Object.keys(ALL_STADIUMS).length, 'venues');

            // Set the dropdown value immediately so it shows the correct venue
            // before selectVenue fires (avoids 500ms flash of wrong default option).
            if (this.currentVenue) {
                const select = document.getElementById('gssh-stadium-venue-select');
                if (select) select.value = this.currentVenue;
            }
            return true;
        },
        
        // =====================================================================
        // MODE TOGGLE (Stadium vs Custom)
        // =====================================================================
        
        setupModeToggle: function() {
            const modeBtns = document.querySelectorAll('.gssh-location-mode-btn');
            const stadiumSection = document.getElementById('gssh-stadium-venue-section');
            const customSection = document.getElementById('gssh-custom-location-section');
            
            if (!modeBtns.length) return;
            
            modeBtns.forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const mode = btn.dataset.mode;
                    this.currentMode = mode;
                    
                    modeBtns.forEach(b => {
                        if (b.dataset.mode === mode) {
                            b.style.background = '#3b82f6';
                            b.style.color = 'white';
                            b.style.borderColor = '#3b82f6';
                            b.classList.add('active');
                        } else {
                            b.style.background = '#f5f5f5';
                            b.style.color = '#333';
                            b.style.borderColor = '#ccc';
                            b.classList.remove('active');
                        }
                    });
                    
                    if (mode === 'stadium') {
                        if (stadiumSection) stadiumSection.style.display = 'block';
                        if (customSection) customSection.style.display = 'none';
                    } else {
                        if (stadiumSection) stadiumSection.style.display = 'none';
                        if (customSection) customSection.style.display = 'block';
                    }
                    
                    console.log('[UnifiedVenue] Mode switched to:', mode);
                });
            });
        },
        
        // =====================================================================
        // VENUE SELECTION
        // =====================================================================
        
        bindVenueSelect: function() {
            const select = document.getElementById('gssh-stadium-venue-select');
            if (!select) return;

            // Guard: only attach the change listener once per element instance
            if (select._gsshVenueSelectBound) return;
            select._gsshVenueSelectBound = true;

            select.addEventListener('change', (e) => {
                const venueId = e.target.value;
                if (venueId) {
                    this.selectVenue(venueId);
                }
                this.updateDeleteButton(venueId);
            });

            // Inject delete button next to the dropdown if not already present
            if (!document.getElementById('gssh-venue-delete-btn')) {
                const btn = document.createElement('button');
                btn.id = 'gssh-venue-delete-btn';
                btn.type = 'button';
                btn.textContent = '🗑 Delete';
                btn.title = 'Delete this custom venue';
                btn.style.cssText = 'display:none;margin-left:6px;padding:4px 8px;background:#dc3545;color:#fff;border:none;border-radius:4px;cursor:pointer;font-size:12px;';
                btn.addEventListener('click', () => {
                    const sel = document.getElementById('gssh-stadium-venue-select');
                    const venueId = sel && sel.value;
                    if (!venueId) return;
                    const venueName = sel.options[sel.selectedIndex] && sel.options[sel.selectedIndex].text;
                    if (!confirm('Delete "' + venueName + '"? This cannot be undone.')) return;
                    this.deleteCustomVenue(venueId);
                });
                select.parentNode.insertBefore(btn, select.nextSibling);
            }
        },

        updateDeleteButton: function(venueId) {
            const btn = document.getElementById('gssh-venue-delete-btn');
            if (!btn) return;
            const venue = ALL_STADIUMS[venueId];
            // Only show for custom (user-added) venues
            btn.style.display = (venue && venue._custom) ? 'inline-block' : 'none';
        },

        deleteCustomVenue: function(venueId) {
            const venue = ALL_STADIUMS[venueId];
            if (!venue || !venue._custom) return;

            delete ALL_STADIUMS[venueId];
            this.currentVenue = null;
            this.populateStadiumDropdown();
            this.updateDeleteButton('');
            console.log('[UnifiedVenue] Deleted custom venue:', venueId);
            document.dispatchEvent(new CustomEvent('gssh:venueDeleted', { detail: { venue_id: venueId } }));
        },
        
        selectVenue: function(venueId) {
            const venue = ALL_STADIUMS[venueId];
            if (!venue) {
                console.warn('[UnifiedVenue] Unknown venue:', venueId);
                return;
            }
            
            // Flatten nested location for convenience
            if (venue.location && !venue.lat) {
                venue.lat = venue.location.lat;
                venue.lng = venue.location.lng;
                venue.city = venue.location.city;
                venue.state = venue.location.state;
                venue.timezone = venue.location.timezone;
            }
            
            this.currentVenue = venueId;
            console.log('[UnifiedVenue] Selected:', venue.name, venue.lat, venue.lng);
            
            this.updateHubLocation(venue.lat, venue.lng, venue.name);
            this.updateHemisphere(venue.lat);
            this.showShadeAvailable(venue.name);
            
            const select = document.getElementById('gssh-stadium-venue-select');
            if (select && select.value !== venueId) {
                select.value = venueId;
            }
            
            this.updateURL(venueId);
            this.dispatchVenueEvents(venueId, venue);
            
            // Compute overseed state here in selectVenue scope so GSSH_CONTEXT writes
            // below don't throw ReferenceError for venues without turf data.
            // dispatchVenueEvents() does the same computation independently for the event payload.
            var turf = venue.turf || null;
            var overseedActiveNow = false;
            var isPermanentOverseed = false;
            if (turf) {
                var _month = new Date().getMonth() + 1;
                if (turf.permanent_overseed) {
                    overseedActiveNow = true;
                    isPermanentOverseed = true;
                } else if (Array.isArray(turf.overseed_months)) {
                    overseedActiveNow = turf.overseed_months.indexOf(_month) !== -1;
                } else if (turf.overseed_period) {
                    var _s = turf.overseed_period.start_month || 1;
                    var _e = turf.overseed_period.end_month   || 12;
                    overseedActiveNow = (_month >= _s && _month <= _e);
                }
            }

            // b35fix264: always initialise GSSH_CONTEXT — previous guard silently
            // dropped all writes if the object didn't already exist, meaning
            // getCurrentRegion() and hub-orchestrator enrichment never saw venue coords.
            global.GSSH_CONTEXT = global.GSSH_CONTEXT || {};
            global.GSSH_CONTEXT.venue_id           = venueId;
            global.GSSH_CONTEXT.venue_name         = venue.name;
            global.GSSH_CONTEXT.lat                = venue.lat;
            global.GSSH_CONTEXT.lng                = venue.lng;
            global.GSSH_CONTEXT.overseed_active    = overseedActiveNow;
            global.GSSH_CONTEXT.permanent_overseed = isPermanentOverseed;
            // Store full venue turf metadata so overseed-climate-integration
            // and other modules can access seasonal_c3_fraction, management type etc.
            global.GSSH_CONTEXT.turf               = turf;
            // Also merge venue turf metadata into GSSH_STATE.turf so it is available
            // when hub-state-update fires and overseed-climate-integration runs.
            if (global.GSSH_STATE && global.GSSH_STATE.turf && turf) {
                global.GSSH_STATE.turf.seasonal_c3_fraction = turf.seasonal_c3_fraction || null;
                global.GSSH_STATE.turf.permanent_overseed   = turf.permanent_overseed   || false;
                global.GSSH_STATE.turf.overseed_active      = overseedActiveNow;
                global.GSSH_STATE.turf.management           = turf.management                  || null;
            }

            // Populate Poa annua % from venue contamination data.
            // This ensures disease and irrigation engines use the correct value automatically
            // rather than relying on the user to enter it manually.
            var poaAnnuaFromVenue = (venue.turf && venue.turf.contamination && venue.turf.contamination.poa_annua != null)
                ? venue.turf.contamination.poa_annua
                : null;
            var poaInput = document.querySelector('.gssh-poa-percent');
            if (poaInput) {
                if (poaAnnuaFromVenue !== null) {
                    poaInput.value = poaAnnuaFromVenue;
                    poaInput.dataset.venueSource = venueId; // mark as venue-populated
                    poaInput.title = 'Set from venue data (' + venue.name + ')';
                    // Fire change so dependent modules (disease engine, irrigation scheduler) react
                    poaInput.dispatchEvent(new Event('change', { bubbles: true }));
                } else if (poaInput.dataset.venueSource && poaInput.dataset.venueSource !== venueId) {
                    // Switching to a venue with no contamination data -- clear the field
                    // only if the current value was set by a previous venue, not by the user
                    poaInput.value = '0';
                    poaInput.dataset.venueSource = '';
                    poaInput.title = '';
                    poaInput.dispatchEvent(new Event('change', { bubbles: true }));
                }
            }
            // Also update GSSH_STATE directly for immediate availability
            if (global.GSSH_STATE && global.GSSH_STATE.turf) {
                global.GSSH_STATE.turf.poaPercent = poaAnnuaFromVenue !== null ? poaAnnuaFromVenue : (global.GSSH_STATE.turf.poaPercent || 0);
            }
        },
        
        updateHubLocation: function(lat, lng, name) {
            // Set BOTH values before dispatching any change events.
            // TurfProfile's lat change listener calls updateSpeciesOptions() which
            // immediately reads .gssh-lon — if lng hasn't been written yet it gets
            // the stale previous venue's longitude, producing wrong region detection.
            const latInput = document.querySelector('.gssh-lat, #gssh-lat');
            const lngInput = document.querySelector('.gssh-lon, #gssh-lon');

            if (latInput) latInput.value = lat;
            if (lngInput) lngInput.value = lng;

            // Also sync GAIP lat/lon inputs so the GAIP location map (gaip-location-map)
            // reflects the selected venue rather than the last saved GAIP site location.
            const gaipLat = document.querySelector('.gaip-lat');
            const gaipLon = document.querySelector('.gaip-lon');
            if (gaipLat) gaipLat.value = lat;
            if (gaipLon) gaipLon.value = lng;

            // Move the GAIP location map marker if it exists
            if (window.GAIP_LocationMap && typeof window.GAIP_LocationMap.setView === 'function') {
                window.GAIP_LocationMap.setView([lat, lng], 16);
                if (typeof window.GAIP_AddOrMoveMarker === 'function') {
                    window.GAIP_AddOrMoveMarker(lat, lng);
                }
            }

            // Fire change on both gssh-lat (for GSSH TurfProfile cascade) and
            // gaip-lat (so GAIP's TurfProfile and weather engine pick up the new
            // venue location). Both values were written above before any events fire,
            // so region detection reads the correct pair in both handlers.
            if (latInput) latInput.dispatchEvent(new Event('change', { bubbles: true }));
            // Only fire gaip-lat change if it's a different element from latInput
            // (on GAIP-only pages they may be the same element).
            if (gaipLat && gaipLat !== latInput) {
                gaipLat.dispatchEvent(new Event('change', { bubbles: true }));
            }

            // Auto-locate the shade location picker map to the selected venue.
            // The stadium database has exact coordinates — no manual address entry needed.
            if (typeof GSSH_MapInit !== 'undefined' && GSSH_MapInit.map) {
                GSSH_MapInit.map.setView([lat, lng], 16);
                if (GSSH_MapInit.marker) {
                    GSSH_MapInit.marker.setLatLng([lat, lng]);
                } else {
                    GSSH_MapInit.marker = L.marker([lat, lng], { draggable: true }).addTo(GSSH_MapInit.map);
                    GSSH_MapInit._bindMarkerEvents();
                }
                GSSH_MapInit._updateInputs(lat, lng);
            } else if (typeof GSSH_MapInit !== 'undefined') {
                // Map not yet initialised (Stadium tab not open) — store coords so
                // GSSH_MapInit.init() picks them up when the panel renders.
                GSSH_MapInit._pendingVenue = { lat: lat, lng: lng };
            }
            
            const searchInput = document.getElementById('gssh-location-search');
            if (searchInput) {
                searchInput.value = '';
                searchInput.placeholder = name + ' (coordinates from database)';
            }

            // Update the GAIP location name field so Site & Climate section
            // shows the venue name rather than the last manually searched address.
            const gaipLocSearch = document.getElementById('gaip-location-search');
            if (gaipLocSearch) gaipLocSearch.value = name;
            
            const statusEl = document.getElementById('gssh-venue-status');
            if (statusEl) {
                statusEl.innerHTML = `<span style="color: #16a34a;">✓ ${name}</span>`;
            }
            
            console.log('[UnifiedVenue] Hub location updated:', lat, lng);
        },
        
        updateHemisphere: function(lat) {
            const hemiSelect = document.querySelector('.gssh-hemi, #gssh-hemi');
            if (hemiSelect) {
                hemiSelect.value = lat >= 0 ? 'northern' : 'southern';
                hemiSelect.dispatchEvent(new Event('change', { bubbles: true }));
            }
        },
        
        showShadeAvailable: function(venueName) {
            const shadeStatus = document.getElementById('gssh-shade-status');
            if (shadeStatus) {
                shadeStatus.style.display = 'block';
                shadeStatus.innerHTML = `<span style="color: #16a34a; font-size: 12px;">✓ Shade analysis available for ${venueName}</span>`;
            }
        },
        
        updateURL: function(venueId) {
            const url = new URL(window.location);
            url.searchParams.set('gssh_venue', venueId);
            window.history.replaceState({}, '', url);
        },
        
        dispatchVenueEvents: function(venueId, venue) {
            // Compute whether overseed is currently active for this venue.
            // This prevents overseed-climate-integration from firing in summer
            // for AU venues that only oversow Apr-Sep.
            var turf = venue.turf || null;
            var overseedActiveNow = false;
            var isPermanentOverseed = false;
            if (turf && turf.oversown) {
                var month = new Date().getMonth() + 1; // 1-12
                if (turf.permanent_overseed) {
                    overseedActiveNow   = true;
                    isPermanentOverseed = true;
                } else if (Array.isArray(turf.overseed_months)) {
                    overseedActiveNow = turf.overseed_months.indexOf(month) !== -1;
                } else if (turf.overseed_period) {
                    var s = turf.overseed_period.start_month || 1;
                    var e = turf.overseed_period.end_month   || 12;
                    overseedActiveNow = (month >= s && month <= e);
                }
            }

            document.dispatchEvent(new CustomEvent('gssh:venueSelect', {
                detail: {
                    venue_id:             venueId,
                    venue_name:           venue.name,
                    lat:                  venue.lat,
                    lng:                  venue.lng,
                    region:               venue.region,
                    state:                venue.state,
                    // Turf data — lets downstream modules know base species,
                    // whether overseed is currently in play, and its schedule
                    turf:                 turf,
                    overseed_active:      overseedActiveNow,
                    permanent_overseed:   isPermanentOverseed
                },
                bubbles: true
            }));
            
            document.dispatchEvent(new CustomEvent('gssh:locationChange', {
                detail: {
                    lat: venue.lat,
                    lng: venue.lng,
                    venue_id: venueId,
                    display_name: venue.name
                },
                bubbles: true
            }));

            // Map venue turf data to TurfProfileController species string and update
            // the species dropdown immediately on venue select. Without this, the
            // controller keeps the previous species (default: Perennial Ryegrass)
            // until the user manually changes it or presses Run.
            if (turf && window.GaipTurfProfile && typeof window.GaipTurfProfile.selectSpecies === 'function') {
                var venueSpecies = null;
                var variety = (turf.variety || '').toLowerCase();
                var species = (turf.species || '').toLowerCase();
                var overseedVariety = (turf.overseed_variety || '').toLowerCase();
                var overseedSpecies = (turf.overseed_species || '').toLowerCase();

                // Priority 1: If overseed is currently active (or permanent), use the overseed species
                var showOverseed = isPermanentOverseed || (turf.oversown && overseedActiveNow);

                if (showOverseed && (overseedVariety || overseedSpecies)) {
                    var c3OverseedVarieties = ['perennial_rye', 'annual_rye', 'ryegrass', 'tall_fescue', 'fine_fescue'];
                    var c3OverseedSpecies   = ['lolium', 'festuca', 'poa', 'agrostis'];
                    var isC3Overseed = false;
                    c3OverseedVarieties.forEach(function(v) { if (overseedVariety.indexOf(v) !== -1) isC3Overseed = true; });
                    c3OverseedSpecies.forEach(function(s)   { if (overseedSpecies.indexOf(s) !== -1) isC3Overseed = true; });
                    if (isC3Overseed) venueSpecies = 'Perennial Ryegrass';
                }

                // Priority 2: Base variety/species mapping
                if (!venueSpecies) {
                    var c4Varieties = ['tiftuf', 'tahoma31', 'tahoma_31', 'legend', 'couch', 'wintergreen',
                                       'tifsport', 'tifway', 'tifway_419', 'tifdwarf', 'bermuda', 'hybrid_bermuda',
                                       'kikuyu', 'buffalo', 'zoysia', 'santa_ana', 'seashore_paspalum'];
                    var c4Species  = ['cynodon', 'pennisetum clandestinum', 'stenotaphrum', 'zoysia',
                                      'paspalum vaginatum', 'axonopus', 'eremochloa'];
                    var c3Varieties = ['perennial_rye', 'annual_rye', 'ryegrass', 'tall_fescue',
                                       'fine_fescue', 'kentucky_bluegrass', 'bentgrass', 'poa_trivialis'];
                    var c3Species   = ['lolium', 'festuca', 'poa', 'agrostis'];

                    var isC4 = false;
                    var isC3 = false;
                    c4Varieties.forEach(function(v) { if (variety.indexOf(v) !== -1) isC4 = true; });
                    c4Species.forEach(function(s)   { if (species.indexOf(s) !== -1) isC4 = true; });
                    c3Varieties.forEach(function(v) { if (variety.indexOf(v) !== -1) isC3 = true; });
                    c3Species.forEach(function(s)   { if (species.indexOf(s) !== -1) isC3 = true; });

                    if (isC4) {
                        venueSpecies = (variety.indexOf('kikuyu') !== -1 || species.indexOf('pennisetum') !== -1)
                            ? 'Kikuyu' : 'Couch';
                    } else if (isC3) {
                        // Resolve to correct C3 species — don't default everything to PRG
                        var isBentgrass = variety.indexOf('bentgrass') !== -1 || variety.indexOf('bent') !== -1 ||
                                          species.indexOf('agrostis') !== -1;
                        var isBluegrass = variety.indexOf('bluegrass') !== -1 || variety.indexOf('poa') !== -1 ||
                                          species.indexOf('poa pratensis') !== -1;
                        var isTallFescue = variety.indexOf('tall_fescue') !== -1 || variety.indexOf('fescue') !== -1 ||
                                           species.indexOf('festuca arundinacea') !== -1;
                        if (isBentgrass) {
                            venueSpecies = 'Creeping Bentgrass (Greens)';
                        } else if (isBluegrass) {
                            venueSpecies = 'Kentucky Bluegrass';
                        } else if (isTallFescue) {
                            venueSpecies = 'Tall Fescue';
                        } else {
                            venueSpecies = 'Perennial Ryegrass';
                        }
                    }
                }

                if (venueSpecies) {
                    // b35fix156: Check for user-saved species preference first.
                    // This takes priority over venue database default AND overseed logic.
                    var userSavedSpecies = getVenueSpeciesPref(venueId);
                    if (userSavedSpecies) {
                        venueSpecies = userSavedSpecies;
                        console.log('[UnifiedVenue] Using saved species preference for', venueId, ':', userSavedSpecies);
                    }

                    // Skip species override if either SiteConfig or GSSH_VenueProfiles
                    // has a saved profile for this venue — user has already set it.
                    var hasSavedConfig = false;
                    if (window.GAIP_SiteConfig && typeof window.GAIP_SiteConfig.getConfig === 'function') {
                        var _sm = window.GAIP_SampleManager;
                        var _siteId = (_sm && typeof _sm.getActiveSiteId === 'function')
                            ? _sm.getActiveSiteId() : venueId;
                        var savedCfg = window.GAIP_SiteConfig.getConfig(_siteId);
                        if (savedCfg && savedCfg.species) hasSavedConfig = true;
                    }
                    if (!hasSavedConfig && window.GSSH_VenueProfiles) {
                        var vp = window.GSSH_VenueProfiles.getProfile(venueId);
                        if (vp && vp.species) hasSavedConfig = true;
                    }
                    if (hasSavedConfig) {
                        console.log('[UnifiedVenue] Skipping species override — saved config exists for site');
                    } else {
                    // Delay 600ms to guarantee this fires after:
                    //   hub-persistence restoreInputState (~100ms) — restores saved species from localStorage
                    //   TurfProfileController location update (~50ms) — repopulates species options
                    // Without sufficient delay, hub-persistence overwrites our species change back to
                    // the previously saved value (e.g. Perennial Ryegrass) before auto-run reads DOM.
                    var speciesTarget = venueSpecies;
                    setTimeout(function() {
                        console.log('[UnifiedVenue] Setting species from venue turf data:', speciesTarget, '(was:', (window.GaipTurfProfile && window.GaipTurfProfile.state && window.GaipTurfProfile.state.species) + ')');
                        if (window.GaipTurfProfile && typeof window.GaipTurfProfile.selectSpecies === 'function') {
                            window.GaipTurfProfile.selectSpecies(speciesTarget);
                        }
                    }, 600);
                    }
                }
            }
            
            document.dispatchEvent(new CustomEvent('gssh:requestShadeAnalysis', {
                detail: {
                    venue_id: venueId,
                    lat: venue.lat,
                    lng: venue.lng,
                    date: new Date().toISOString().split('T')[0]
                },
                bubbles: true
            }));
        },
        
        // =====================================================================
        // HIDE STADIUM LIGHT DROPDOWNS
        // =====================================================================
        
        hideStadiumLightDropdowns: function() {
            const selectorsToHide = [
                '.gssh-venue-select',
                '.gssh-hemisphere-select',
                '.gssh-venue-row',
                '.gssh-shade-controls .gssh-control-group'
            ];
            
            let hidden = 0;
            selectorsToHide.forEach(selector => {
                document.querySelectorAll(selector).forEach(el => {
                    if (!el.closest('.gssh-location-card') && !el.closest('#gssh-stadium-venue-section')) {
                        el.style.display = 'none';
                        hidden++;
                    }
                });
            });
            
            if (hidden > 0) {
                console.log('[UnifiedVenue] Hiding', hidden, 'separate Stadium Light dropdowns');
            }
        },
        
        // =====================================================================
        // PUBLIC API
        // =====================================================================
        
        getCurrentVenueId: function() {
            return this.currentVenue;
        },
        
        getCurrentVenue: function() {
            if (!this.currentVenue) return null;
            return { id: this.currentVenue, ...ALL_STADIUMS[this.currentVenue] };
        },
        
        getVenues: function() {
            return ALL_STADIUMS;
        },
        
        isStadiumMode: function() {
            return this.currentMode === 'stadium';
        }
    };

    // =========================================================================
    // AUTO-INITIALIZE
    // =========================================================================
    
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function() {
            setTimeout(function() { UnifiedVenueSelector.init(); }, 300);
        });
    } else {
        setTimeout(function() { UnifiedVenueSelector.init(); }, 300);
    }

    // gssh:stadiumTabReady listener removed (Bug 2 fix, b35fix60).
    // stadium-tab-ui.js manages re-init explicitly with a DOM-rebuild guard.
    // Keeping the listener here caused double-init: duplicate dropdown population
    // and duplicate change listeners on every tab activate.
    
    // Expose species pref API so settings panel and other callers can save
    // the user's explicit species choice for the current venue (b35fix156)
    UnifiedVenueSelector.saveSpeciesPref = function(venueId, species) {
        setVenueSpeciesPref(venueId || this.getCurrentVenueId(), species);
        console.log('[UnifiedVenue] Species pref saved:', venueId || this.getCurrentVenueId(), '->', species);
    };
    UnifiedVenueSelector.getSpeciesPref = function(venueId) {
        return getVenueSpeciesPref(venueId || this.getCurrentVenueId());
    };
    UnifiedVenueSelector.clearSpeciesPref = function(venueId) {
        try {
            var raw = localStorage.getItem(GSSH_SPECIES_PREFS_KEY);
            var prefs = raw ? JSON.parse(raw) : {};
            delete prefs[venueId || this.getCurrentVenueId()];
            localStorage.setItem(GSSH_SPECIES_PREFS_KEY, JSON.stringify(prefs));
        } catch(e) {}
    };

    global.UnifiedVenueSelector = UnifiedVenueSelector;
    global.GSSH_UnifiedVenueSelector = UnifiedVenueSelector;
    
})(typeof window !== 'undefined' ? window : this);
