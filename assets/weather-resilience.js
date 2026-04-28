/**
 * =============================================================================
 * GILBA WEATHER RESILIENCE MODULE v1.0
 * =============================================================================
 * 
 * Provides graceful degradation when weather API is unavailable:
 * - 24-hour caching of successful weather fetches
 * - Clear status indicators (Live / Cached / Estimated)
 * - Automatic fallback chain: Live → Cached → Estimated
 * 
 * Integration: Wraps climate-engine.js fetch functions
 * 
 * =============================================================================
 */

(function() {
    'use strict';

    // =========================================================================
    // CONFIGURATION
    // =========================================================================
    
    var CONFIG = {
        cacheKey: 'gaip_weather_cache',
        statusKey: 'gaip_weather_status',
        cacheMaxAge: 24 * 60 * 60 * 1000,  // 24 hours in milliseconds
        staleWarningAge: 6 * 60 * 60 * 1000, // 6 hours - show "aging" warning
        retryInterval: 5 * 60 * 1000,  // 5 minutes between retry attempts
        maxRetries: 3
    };

    // =========================================================================
    // WEATHER STATUS TRACKING
    // =========================================================================
    
    /**
     * Weather status enum
     */
    var WeatherStatus = {
        LIVE: 'live',           // Fresh data from API
        CACHED: 'cached',       // Using cached data (API unavailable)
        CACHED_STALE: 'cached_stale',  // Cache > 6 hours old
        ESTIMATED: 'estimated', // No cache, using defaults
        LOADING: 'loading',     // Currently fetching
        ERROR: 'error'          // Fetch failed, no fallback available
    };

    /**
     * Current weather status
     */
    var currentStatus = {
        status: WeatherStatus.LOADING,
        source: null,
        fetchedAt: null,
        cacheAge: null,
        lastError: null,
        retryCount: 0,
        locationKey: null
    };

    // =========================================================================
    // CACHE MANAGEMENT
    // =========================================================================
    
    /**
     * Generate cache key for location
     */
    function getLocationKey(lat, lon) {
        if (!lat || !lon) return null;
        // Round to 2 decimal places for reasonable cache hits
        return Math.round(lat * 100) / 100 + '_' + Math.round(lon * 100) / 100;
    }

    /**
     * Save weather data to cache
     */
    function saveToCache(locationKey, weatherData) {
        if (!locationKey || !weatherData) return false;
        
        try {
            var cacheEntry = {
                locationKey: locationKey,
                data: weatherData,
                savedAt: new Date().toISOString(),
                timestamp: Date.now()
            };
            
            localStorage.setItem(CONFIG.cacheKey + '_' + locationKey, JSON.stringify(cacheEntry));
            return true;
        } catch (e) {
            console.warn('[WeatherResilience] Cache save failed:', e.message);
            return false;
        }
    }

    /**
     * Load weather data from cache
     */
    function loadFromCache(locationKey) {
        if (!locationKey) return null;
        
        try {
            var cached = localStorage.getItem(CONFIG.cacheKey + '_' + locationKey);
            if (!cached) return null;
            
            var cacheEntry = JSON.parse(cached);
            var age = Date.now() - cacheEntry.timestamp;
            
            // Check if cache is expired
            if (age > CONFIG.cacheMaxAge) {
                localStorage.removeItem(CONFIG.cacheKey + '_' + locationKey);
                return null;
            }
            
            cacheEntry.age = age;
            cacheEntry.isStale = age > CONFIG.staleWarningAge;
            
            return cacheEntry;
        } catch (e) {
            console.warn('[WeatherResilience] Cache load failed:', e.message);
            return null;
        }
    }

    /**
     * Clear cache for location or all
     */
    function clearCache(locationKey) {
        try {
            if (locationKey) {
                localStorage.removeItem(CONFIG.cacheKey + '_' + locationKey);
            } else {
                // Clear all weather caches
                Object.keys(localStorage).forEach(function(key) {
                    if (key.startsWith(CONFIG.cacheKey)) {
                        localStorage.removeItem(key);
                    }
                });
            }
        } catch (e) {
            console.warn('[WeatherResilience] Cache clear failed:', e.message);
        }
    }

    // =========================================================================
    // RESILIENT FETCH WRAPPER
    // =========================================================================
    
    /**
     * Fetch weather with automatic fallback to cache
     * Wraps the existing climate engine fetch
     */
    async function fetchWithResilience(state) {
        var lat = state?.climate?.lat;
        var lon = state?.climate?.lon;
        var locationKey = getLocationKey(lat, lon);
        
        currentStatus.locationKey = locationKey;
        currentStatus.status = WeatherStatus.LOADING;
        updateStatusBadge();
        
        // Check if live weather is disabled
        if (!state?.climate?.useLiveWeather) {
            currentStatus.status = WeatherStatus.ESTIMATED;
            currentStatus.source = 'manual';
            updateStatusBadge();
            return null;
        }
        
        // Try live fetch first
        try {
            var liveData = await fetchLiveWeather(state);
            
            if (liveData && (liveData.forecast || liveData.historical)) {
                // Success! Cache it and update status
                saveToCache(locationKey, liveData);
                
                currentStatus.status = WeatherStatus.LIVE;
                currentStatus.source = 'api';
                currentStatus.fetchedAt = new Date().toISOString();
                currentStatus.cacheAge = null;
                currentStatus.lastError = null;
                currentStatus.retryCount = 0;
                
                // Mark the data as live
                liveData._weatherStatus = WeatherStatus.LIVE;
                liveData._fetchedAt = currentStatus.fetchedAt;
                
                updateStatusBadge();
                return liveData;
            }
        } catch (error) {
            console.warn('[WeatherResilience] Live fetch failed:', error.message);
            currentStatus.lastError = error.message;
            currentStatus.retryCount++;
        }
        
        // Live failed - try cache
        var cached = loadFromCache(locationKey);
        if (cached && cached.data) {
            currentStatus.status = cached.isStale ? WeatherStatus.CACHED_STALE : WeatherStatus.CACHED;
            currentStatus.source = 'cache';
            currentStatus.fetchedAt = cached.savedAt;
            currentStatus.cacheAge = cached.age;
            
            // Mark the data as cached
            cached.data._weatherStatus = currentStatus.status;
            cached.data._fetchedAt = cached.savedAt;
            cached.data._cacheAge = cached.age;
            
            updateStatusBadge();
            return cached.data;
        }
        
        // No cache available - estimated mode
        currentStatus.status = WeatherStatus.ESTIMATED;
        currentStatus.source = 'none';
        updateStatusBadge();
        
        return null;
    }

    /**
     * Fetch live weather from API
     * Uses existing climate engine if available
     */
    async function fetchLiveWeather(state) {
        // Use original climate engine fetch (before we wrapped it)
        if (typeof window._original_gaip_climate_fetch === 'function') {
            return await window._original_gaip_climate_fetch(state);
        }
        
        // Or use unwrapped version if available
        if (typeof window.gaip_climate_fetch === 'function') {
            return await window.gaip_climate_fetch(state);
        }
        
        // Fallback: direct Open-Meteo call
        if (!state?.climate?.lat || !state?.climate?.lon) {
            throw new Error('No coordinates provided');
        }
        
        var params = new URLSearchParams({
            latitude: state.climate.lat,
            longitude: state.climate.lon,
            timezone: 'auto',
            forecast_days: 16,
            hourly: [
                'temperature_2m',
                'relative_humidity_2m',
                'dewpoint_2m',
                'precipitation',
                'soil_moisture_0_to_7cm',
                'soil_temperature_0_to_7cm',
                'shortwave_radiation',
                'et0_fao_evapotranspiration',
                'wind_speed_10m',
                'cloud_cover'
            ].join(','),
            daily: [
                'temperature_2m_max',
                'temperature_2m_min',
                'precipitation_sum',
                'et0_fao_evapotranspiration'
            ].join(',')
        });
        
        var baseUrl = (window.GAIP_HUB_CONFIG && GAIP_HUB_CONFIG.openMeteoUrl) || 'https://api.open-meteo.com/v1/forecast';
        var response = await fetch(baseUrl + '?' + params);
        
        if (!response.ok) {
            throw new Error('API error: ' + response.status);
        }
        
        var data = await response.json();
        return {
            forecast: data,
            fetchedAt: new Date().toISOString(),
            errors: []
        };
    }

    // =========================================================================
    // STATUS BADGE UI
    // =========================================================================
    
    /**
     * Create or update the weather status badge
     */
    function updateStatusBadge() {
        var badge = document.getElementById('gaip-weather-status-badge');
        
        if (!badge) {
            // Badge will be created when renderStatusBadge is called
            return;
        }
        
        var config = getStatusConfig(currentStatus.status);
        
        badge.className = 'gaip-weather-badge gaip-weather-badge-' + currentStatus.status;
        badge.innerHTML = config.icon + ' ' + config.label;
        badge.title = config.tooltip;
        badge.style.backgroundColor = config.bgColor;
        badge.style.color = config.textColor;
        badge.style.borderColor = config.borderColor;
    }

    /**
     * Get status configuration for display
     */
    function getStatusConfig(status) {
        var configs = {
            live: {
                icon: '●',
                label: 'Weather: Live',
                tooltip: 'Fresh data from Open-Meteo API',
                bgColor: 'var(--gaip-good-bg)',
                textColor: '#166534',
                borderColor: '#86efac'
            },
            cached: {
                icon: '◐',
                label: 'Weather: Cached',
                tooltip: 'Using cached data (API unavailable). Cache age: ' + formatCacheAge(currentStatus.cacheAge),
                bgColor: 'var(--gaip-warning-bg)',
                textColor: '#854d0e',
                borderColor: '#fde047'
            },
            cached_stale: {
                icon: '◔',
                label: 'Weather: Cached (Aging)',
                tooltip: 'Cache is over 6 hours old. Data may be outdated. Cache age: ' + formatCacheAge(currentStatus.cacheAge),
                bgColor: 'var(--gaip-warning-bg)',
                textColor: '#9a3412',
                borderColor: '#fdba74'
            },
            estimated: {
                icon: '○',
                label: 'Weather: Estimated',
                tooltip: 'No live or cached data available. Using default estimates.',
                bgColor: 'var(--gaip-surface-hover)',
                textColor: 'var(--gaip-text-secondary)',
                borderColor: 'var(--gaip-border)'
            },
            loading: {
                icon: '◌',
                label: 'Weather: Loading...',
                tooltip: 'Fetching weather data...',
                bgColor: 'var(--gaip-info-bg)',
                textColor: '#0369a1',
                borderColor: '#7dd3fc'
            },
            error: {
                icon: '✕',
                label: 'Weather: Error',
                tooltip: 'Failed to fetch weather data: ' + (currentStatus.lastError || 'Unknown error'),
                bgColor: 'var(--gaip-critical-bg)',
                textColor: '#dc2626',
                borderColor: '#fca5a5'
            }
        };
        
        return configs[status] || configs.estimated;
    }

    /**
     * Format cache age for display
     */
    function formatCacheAge(ageMs) {
        if (!ageMs) return 'unknown';
        
        var minutes = Math.round(ageMs / 60000);
        if (minutes < 60) return minutes + ' minutes';
        
        var hours = Math.round(minutes / 60);
        if (hours < 24) return hours + ' hour' + (hours !== 1 ? 's' : '');
        
        var days = Math.round(hours / 24);
        return days + ' day' + (days !== 1 ? 's' : '');
    }

    /**
     * Render the status badge HTML
     */
    function renderStatusBadge() {
        var config = getStatusConfig(currentStatus.status);
        
        return '<div id="gaip-weather-status-badge" class="gaip-weather-badge gaip-weather-badge-' + currentStatus.status + '" ' +
               'style="display: inline-flex; align-items: center; gap: 6px; padding: 4px 10px; ' +
               'border-radius: 12px; font-size: 12px; font-weight: 500; cursor: help; ' +
               'background-color: ' + config.bgColor + '; color: ' + config.textColor + '; ' +
               'border: 1px solid ' + config.borderColor + ';" ' +
               'title="' + config.tooltip + '">' +
               config.icon + ' ' + config.label +
               '</div>';
    }

    /**
     * Render detailed status panel (for settings/debug)
     */
    function renderStatusPanel() {
        var config = getStatusConfig(currentStatus.status);
        
        var html = '<div class="gaip-weather-status-panel" style="padding: 12px; background: var(--gaip-surface-muted); border-radius: 8px; margin: 10px 0;">';
        html += '<div style="display: flex; align-items: center; gap: 10px; margin-bottom: 8px;">';
        html += renderStatusBadge();
        if (currentStatus.status === WeatherStatus.CACHED || currentStatus.status === WeatherStatus.CACHED_STALE) {
            html += '<button onclick="window.GAIP_WeatherResilience.retryFetch()" style="padding: 4px 8px; font-size: 11px; cursor: pointer;">Retry Live</button>';
        }
        html += '</div>';
        
        html += '<div style="font-size: 11px; color: var(--gaip-text);">';
        if (currentStatus.fetchedAt) {
            html += '<div><strong>Last fetch:</strong> ' + new Date(currentStatus.fetchedAt).toLocaleString() + '</div>';
        }
        if (currentStatus.cacheAge) {
            html += '<div><strong>Cache age:</strong> ' + formatCacheAge(currentStatus.cacheAge) + '</div>';
        }
        if (currentStatus.lastError) {
            html += '<div style="color: #dc2626;"><strong>Last error:</strong> ' + currentStatus.lastError + '</div>';
        }
        html += '</div></div>';
        
        return html;
    }

    // =========================================================================
    // INTEGRATION WITH EXISTING CLIMATE ENGINE
    // =========================================================================
    
    /**
     * Wrap existing climate fetch function
     */
    function wrapClimateEngine() {
        // Store original if exists
        if (typeof window.gaip_climate_fetch === 'function' && !window._original_gaip_climate_fetch) {
            window._original_gaip_climate_fetch = window.gaip_climate_fetch;
            
            // Replace with resilient version
            window.gaip_climate_fetch = async function(state) {
                return await fetchWithResilience(state);
            };
            
        }
    }

    /**
     * Retry live fetch (called from UI)
     */
    async function retryFetch() {
        if (!window.GAIP_STATE && !window.GAIP_CURRENT_STATE) {
            console.warn('[WeatherResilience] No state available for retry');
            return;
        }
        
        var state = window.GAIP_STATE || window.GAIP_CURRENT_STATE;
        currentStatus.retryCount = 0;
        
        try {
            var result = await fetchWithResilience(state);
            
            // Trigger re-render if hub is available
            if (typeof window.gaip_runAnalysis === 'function') {
                window.gaip_runAnalysis();
            }
            
            return result;
        } catch (e) {
            console.error('[WeatherResilience] Retry failed:', e);
        }
    }

    // =========================================================================
    // INJECT STATUS BADGE INTO HUB UI
    // =========================================================================
    
    /**
     * Inject the status badge into the hub header
     */
    function injectStatusBadge() {
        // Look for hub header or climate section header
        var targets = [
            '.gaip-header',
            '.gaip-results-header', 
            '.gaip-climate-header',
            '.gaip-hub-title'
        ];
        
        var target = null;
        for (var i = 0; i < targets.length; i++) {
            target = document.querySelector(targets[i]);
            if (target) break;
        }
        
        if (!target) {
            // Create floating badge if no header found
            var existing = document.getElementById('gaip-weather-status-container');
            if (existing) return;
            
            var container = document.createElement('div');
            container.id = 'gaip-weather-status-container';
            container.style.cssText = 'position: fixed; top: 10px; right: 10px; z-index: 9999;';
            container.innerHTML = renderStatusBadge();
            document.body.appendChild(container);
        } else {
            // Check if already injected
            if (target.querySelector('#gaip-weather-status-badge')) return;
            
            var badgeContainer = document.createElement('span');
            badgeContainer.style.marginLeft = '10px';
            badgeContainer.innerHTML = renderStatusBadge();
            target.appendChild(badgeContainer);
        }
    }

    // =========================================================================
    // INITIALIZATION
    // =========================================================================
    
    function init() {
        // Wrap climate engine
        wrapClimateEngine();
        
        // Inject status badge when DOM ready
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', function() {
                setTimeout(injectStatusBadge, 500);
            });
        } else {
            setTimeout(injectStatusBadge, 500);
        }
        
        // Also inject after analysis runs
        document.addEventListener('gaip:analysis-complete', function() {
            setTimeout(injectStatusBadge, 100);
        });
        
    }

    // =========================================================================
    // EXPORTS
    // =========================================================================
    
    window.GAIP_WeatherResilience = {
        // Core functions
        fetch: fetchWithResilience,
        retryFetch: retryFetch,
        
        // Cache management
        saveToCache: saveToCache,
        loadFromCache: loadFromCache,
        clearCache: clearCache,
        
        // Status
        getStatus: function() { return Object.assign({}, currentStatus); },
        WeatherStatus: WeatherStatus,
        
        // UI
        renderStatusBadge: renderStatusBadge,
        renderStatusPanel: renderStatusPanel,
        updateStatusBadge: updateStatusBadge,
        injectStatusBadge: injectStatusBadge,
        
        // Config
        CONFIG: CONFIG
    };

    // Auto-initialize
    init();


})();
