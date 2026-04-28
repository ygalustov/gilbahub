/**
 * =============================================================================
 * GILBA SPRAY LOG — Client Module v1.0.0
 * =============================================================================
 * 
 * JavaScript client for the spray log REST API. Provides:
 * - CRUD operations against /gilba/v1/spray-log
 * - Engine context loading for cascade stage 0.5
 * - Product dropdown builders from existing JS product databases
 * - Rate unit conversion helpers
 * - Local cache to avoid redundant API calls within a session
 * 
 * DEPENDENCIES:
 *   - GAIP_HUB_CONFIG (restUrl, restNonce) — from wp_localize_script
 *   - GAIP_SampleManager.getActiveSiteId() — for site context
 *   - Product databases (optional): GAIP_DMI.products, window.AU_FUNGICIDE_DB, etc.
 * 
 * GLOBAL EXPORT:
 *   window.GAIP_SprayLog
 * 
 * @author  Gilba Solutions
 * @version 1.0.0
 * =============================================================================
 */
(function(global) {
    'use strict';

    const VERSION = '1.0.0';
    const LOG_PREFIX = '[SprayLog]';

    // =========================================================================
    // CONFIGURATION
    // =========================================================================

    function getRestUrl() {
        return (global.GAIP_HUB_CONFIG && global.GAIP_HUB_CONFIG.restUrl) || '/wp-json/gilba/v1/';
    }

    function getRestNonce() {
        return (global.GAIP_HUB_CONFIG && global.GAIP_HUB_CONFIG.restNonce) || '';
    }

    function getActiveSiteId() {
        // b35fix271: Delegate to GAIP_SiteContext
        if (global.GAIP_SiteContext) return global.GAIP_SiteContext.getSiteId();
        if (global.GAIP_SampleManager && typeof global.GAIP_SampleManager.getActiveSiteId === 'function') {
            return global.GAIP_SampleManager.getActiveSiteId();
        }
        return null;
    }

    function getCurrentUserId() {
        // WordPress passes this if available
        if (global.GAIP_HUB_CONFIG && global.GAIP_HUB_CONFIG.userId) {
            return global.GAIP_HUB_CONFIG.userId;
        }
        return null;
    }

    function log(...args) {
    }

    function warn(...args) {
        console.warn(LOG_PREFIX, ...args);
    }

    // =========================================================================
    // UUID GENERATION (for client-side pre-generation if needed)
    // =========================================================================

    function generateUUID() {
        // crypto.randomUUID if available, otherwise fallback
        if (typeof crypto !== 'undefined' && crypto.randomUUID) {
            return crypto.randomUUID();
        }
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
            const r = Math.random() * 16 | 0;
            const v = c === 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    }

    // =========================================================================
    // SESSION CACHE
    // =========================================================================

    /** 
     * Simple in-memory cache for the current session.
     * Avoids hitting the REST API repeatedly for the same context.
     * Invalidated on create/update/delete.
     */
    const _cache = {
        context: {},   // keyed by `${siteId}:${zone}`
        list: {},      // keyed by serialised filter params
        summary: {},   // keyed by `${siteId}:${zone}:${months}`
        _ttl: 5 * 60 * 1000, // 5 minutes

        set(type, key, data) {
            this[type][key] = { data, ts: Date.now() };
        },

        get(type, key) {
            const entry = this[type][key];
            if (!entry) return null;
            if (Date.now() - entry.ts > this._ttl) {
                delete this[type][key];
                return null;
            }
            return entry.data;
        },

        invalidate() {
            this.context = {};
            this.list = {};
            this.summary = {};
            log('Cache invalidated');
        }
    };

    // =========================================================================
    // REST API CLIENT
    // =========================================================================

    async function apiRequest(method, endpoint, body = null, params = null) {
        let url = getRestUrl() + endpoint;

        // Append query params for GET requests
        if (params) {
            const qs = new URLSearchParams();
            Object.entries(params).forEach(([k, v]) => {
                if (v !== null && v !== undefined && v !== '') {
                    qs.append(k, v);
                }
            });
            const qsString = qs.toString();
            if (qsString) {
                url += (url.includes('?') ? '&' : '?') + qsString;
            }
        }

        const options = {
            method,
            headers: {
                'Content-Type': 'application/json',
                'X-WP-Nonce': getRestNonce()
            }
        };

        if (body && (method === 'POST' || method === 'PUT')) {
            options.body = JSON.stringify(body);
        }

        try {
            const response = await fetch(url, options);
            const data = await response.json();

            if (!response.ok) {
                warn('API error:', response.status, data);
            }

            return data;
        } catch (err) {
            warn('API request failed:', err);
            return { success: false, error: err.message };
        }
    }

    // =========================================================================
    // CRUD OPERATIONS
    // =========================================================================

    /**
     * Create a spray log entry.
     * 
     * @param {Object} entry - Entry data
     * @param {string} entry.site_id
     * @param {string} entry.application_date - YYYY-MM-DD
     * @param {string} entry.product_name
     * @param {string} [entry.zone] - Single zone (default: 'greens')
     * @param {string[]} [entry.zones] - Multi-zone array (overrides zone)
     * @param {string} [entry.product_category]
     * @param {string} [entry.product_key]
     * @param {string} [entry.active_ingredient]
     * @param {string} [entry.frac_group]
     * @param {number} [entry.rate]
     * @param {string} [entry.rate_unit]
     * @param {number} [entry.water_volume]
     * @param {string} [entry.target]
     * @param {string} [entry.source] - 'manual'|'recommendation'|'bulk_import'
     * @param {string} [entry.recommendation_id]
     * @param {string} [entry.notes]
     * @returns {Promise<Object>}
     */
    async function create(entry) {
        // Default site_id from active site
        if (!entry.site_id) {
            entry.site_id = getActiveSiteId();
        }
        if (!entry.site_id) {
            warn('No site_id available');
            return { success: false, error: 'No active site' };
        }

        // Default date to today
        if (!entry.application_date) {
            entry.application_date = new Date().toISOString().split('T')[0];
        }

        log('Creating entry:', entry.product_name, entry.zones || entry.zone || 'greens', 'site:', entry.site_id);
        const result = await apiRequest('POST', 'spray-log', entry);

        if (result.success || result.count > 0) {
            _cache.invalidate();
            // Dispatch event for other modules to react
            document.dispatchEvent(new CustomEvent('gaip:spray-log-updated', {
                detail: { action: 'create', result }
            }));
        }

        return result;
    }

    /**
     * List spray log entries with filters.
     * 
     * @param {Object} filters
     * @param {string} filters.site_id
     * @param {string} [filters.zone]
     * @param {string} [filters.category]
     * @param {string} [filters.frac_group]
     * @param {number} [filters.days]
     * @param {string} [filters.date_from]
     * @param {string} [filters.date_to]
     * @param {number} [filters.limit]
     * @param {number} [filters.offset]
     * @returns {Promise<Object>}
     */
    async function list(filters = {}) {
        if (!filters.site_id) {
            filters.site_id = getActiveSiteId();
        }
        if (!filters.site_id) {
            return { success: false, error: 'No active site', entries: [] };
        }

        // Check cache
        const cacheKey = JSON.stringify(filters);
        const cached = _cache.get('list', cacheKey);
        if (cached) return cached;

        const result = await apiRequest('GET', 'spray-log', null, filters);

        if (result.success) {
            _cache.set('list', cacheKey, result);
        }

        return result;
    }

    /**
     * Update a spray log entry.
     * 
     * @param {string} logId - UUID of the entry
     * @param {Object} updates - Fields to update
     * @returns {Promise<Object>}
     */
    async function update(logId, updates) {
        log('Updating entry:', logId);
        const result = await apiRequest('PUT', `spray-log/${logId}`, updates);

        if (result.success) {
            _cache.invalidate();
            document.dispatchEvent(new CustomEvent('gaip:spray-log-updated', {
                detail: { action: 'update', logId, result }
            }));
        }

        return result;
    }

    /**
     * Delete a spray log entry.
     * 
     * @param {string} logId - UUID of the entry
     * @returns {Promise<Object>}
     */
    async function remove(logId) {
        log('Deleting entry:', logId);
        const result = await apiRequest('DELETE', `spray-log/${logId}`);

        if (result.success) {
            _cache.invalidate();
            document.dispatchEvent(new CustomEvent('gaip:spray-log-updated', {
                detail: { action: 'delete', logId, result }
            }));
        }

        return result;
    }

    // =========================================================================
    // ENGINE CONTEXT — for cascade stage 0.5
    // =========================================================================

    /**
     * Fetch structured spray context for engine consumption.
     * Called by the cascade orchestrator before engines run.
     * 
     * @param {string} siteId
     * @param {string} zone
     * @param {number} [days=90]
     * @returns {Promise<Object>} Structured context with lastPGR, dmiApplications, fracHistory, etc.
     */
    async function getContext(siteId, zone, days = 90) {
        siteId = siteId || getActiveSiteId();
        zone = zone || 'greens';

        if (!siteId) {
            return { success: false, error: 'No active site', recentApplications: [] };
        }

        // Check cache
        const cacheKey = `${siteId}:${zone}:${days}`;
        const cached = _cache.get('context', cacheKey);
        if (cached) return cached;

        const result = await apiRequest('GET', 'spray-log/context', null, {
            site_id: siteId,
            zone,
            days
        });

        if (result.success) {
            _cache.set('context', cacheKey, result);
        }

        return result;
    }

    // =========================================================================
    // CONVENIENCE QUERIES
    // =========================================================================

    /**
     * Get the most recent application of a specific category for a zone.
     * 
     * @param {Object} opts
     * @param {string} [opts.site_id]
     * @param {string} [opts.zone]
     * @param {string} opts.category - 'pgr', 'fungicide', etc.
     * @returns {Promise<Object|null>}
     */
    async function getLatest(opts) {
        const result = await list({
            site_id: opts.site_id,
            zone: opts.zone,
            category: opts.category,
            limit: 1,
            days: 365
        });

        if (result.success && result.entries && result.entries.length > 0) {
            return result.entries[0];
        }
        return null;
    }

    /**
     * Get recent applications within a time window.
     * 
     * @param {Object} opts
     * @param {string} [opts.site_id]
     * @param {string} [opts.zone]
     * @param {string} [opts.category]
     * @param {string} [opts.frac_group]
     * @param {number} [opts.days=90]
     * @returns {Promise<Array>}
     */
    async function getRecent(opts) {
        const result = await list({
            site_id: opts.site_id,
            zone: opts.zone,
            category: opts.category,
            frac_group: opts.frac_group,
            days: opts.days || 90,
            limit: 50
        });

        return (result.success && result.entries) ? result.entries : [];
    }

    /**
     * Get FRAC rotation history for resistance management analysis.
     * 
     * @param {Object} opts
     * @param {string} [opts.site_id]
     * @param {string} [opts.zone]
     * @param {number} [opts.months=12]
     * @returns {Promise<Object>}
     */
    async function getFRACHistory(opts) {
        const siteId = opts.site_id || getActiveSiteId();
        if (!siteId) {
            return { success: false, error: 'No active site' };
        }

        // Check cache
        const cacheKey = `${siteId}:${opts.zone || 'all'}:${opts.months || 12}`;
        const cached = _cache.get('summary', cacheKey);
        if (cached) return cached;

        const result = await apiRequest('GET', 'spray-log/summary', null, {
            site_id: siteId,
            zone: opts.zone || '',
            months: opts.months || 12
        });

        if (result.success) {
            _cache.set('summary', cacheKey, result);
        }

        return result;
    }

    // =========================================================================
    // PRODUCT DATABASE HELPERS
    // =========================================================================

    /**
     * Build a product list for dropdowns, pulling from existing JS product databases.
     * Returns products grouped by category.
     * 
     * @param {string} region - 'au', 'nz', 'uk', 'eu', 'jp'
     * @returns {Object} Grouped product list
     */
    function getProductList(region) {
        const products = {
            fungicide: [],
            pgr: [],
            nutrition: [],
            wetting_agent: [],
            pre_emergent: [],
            insecticide: [],
            other: []
        };

        // Pull DMI fungicides from GAIP_DMI
        if (global.GAIP_DMI && global.GAIP_DMI.products) {
            Object.entries(global.GAIP_DMI.products).forEach(([key, product]) => {
                if (product.products && Array.isArray(product.products)) {
                    product.products.forEach(p => {
                        products.fungicide.push({
                            key: key,
                            name: p.trade || key,
                            activeIngredient: key,
                            fracGroup: String(product.frac || '3'),
                            category: 'fungicide',
                            defaultRate: p.rate || null,
                            defaultUnit: 'L/ha'
                        });
                    });
                }
            });
        }

        // Pull from regional fungicide databases
        // NZ fungicides
        if (region === 'nz' && global.GAIP_NZ_FUNGICIDES) {
            const db = global.GAIP_NZ_FUNGICIDES;
            if (db.products) {
                Object.entries(db.products).forEach(([key, product]) => {
                    if (product.products) {
                        product.products.forEach(p => {
                            // Avoid duplicates already added from DMI
                            const exists = products.fungicide.some(
                                f => f.name === (p.trade || key)
                            );
                            if (!exists) {
                                products.fungicide.push({
                                    key: key,
                                    name: p.trade || key,
                                    activeIngredient: key,
                                    fracGroup: String(product.frac || ''),
                                    category: 'fungicide',
                                    defaultRate: p.rate || null,
                                    defaultUnit: 'L/ha'
                                });
                            }
                        });
                    }
                });
            }
        }

        // AU fertiliser products
        if (global.AU_FERTILISER_DB || global.GAIP_AU_FERTILISER) {
            const db = global.AU_FERTILISER_DB || global.GAIP_AU_FERTILISER;
            if (db && db.products) {
                Object.entries(db.products).forEach(([key, product]) => {
                    products.nutrition.push({
                        key: key,
                        name: product.name || product.trade || key,
                        activeIngredient: product.analysis || null,
                        fracGroup: null,
                        category: 'nutrition',
                        defaultRate: product.rate || null,
                        defaultUnit: product.rateUnit || 'kg/ha'
                    });
                });
            }
        }

        // PGR products (common across regions)
        products.pgr.push(
            { key: 'TE250', name: 'Primo 250EC (Trinexapac-ethyl)', activeIngredient: 'trinexapac-ethyl', fracGroup: null, category: 'pgr', defaultRate: 2.0, defaultUnit: 'L/ha' },
            { key: 'TE120', name: 'Primo Maxx (Trinexapac-ethyl)', activeIngredient: 'trinexapac-ethyl', fracGroup: null, category: 'pgr', defaultRate: 1.5, defaultUnit: 'L/ha' },
            { key: 'PB', name: 'Paclobutrazol', activeIngredient: 'paclobutrazol', fracGroup: null, category: 'pgr', defaultRate: 1.0, defaultUnit: 'L/ha' },
            { key: 'FP', name: 'Flurprimidol', activeIngredient: 'flurprimidol', fracGroup: null, category: 'pgr', defaultRate: 1.0, defaultUnit: 'L/ha' }
        );

        // Sort each category alphabetically
        Object.keys(products).forEach(cat => {
            products[cat].sort((a, b) => a.name.localeCompare(b.name));
        });

        return products;
    }

    /**
     * Look up a product by key across all databases.
     * Returns product metadata for auto-filling log entries.
     * 
     * @param {string} productKey
     * @returns {Object|null}
     */
    function lookupProduct(productKey) {
        // Check DMI products
        if (global.GAIP_DMI && global.GAIP_DMI.products) {
            const dmi = global.GAIP_DMI.products[productKey];
            if (dmi) {
                return {
                    key: productKey,
                    name: dmi.products?.[0]?.trade || productKey,
                    activeIngredient: productKey,
                    fracGroup: String(dmi.frac || '3'),
                    category: 'fungicide'
                };
            }
        }

        // Check PGR products
        const pgrMap = { 'TE250': 'trinexapac-ethyl', 'TE120': 'trinexapac-ethyl', 'PB': 'paclobutrazol', 'FP': 'flurprimidol' };
        if (pgrMap[productKey]) {
            return {
                key: productKey,
                name: productKey,
                activeIngredient: pgrMap[productKey],
                fracGroup: null,
                category: 'pgr'
            };
        }

        return null;
    }

    // =========================================================================
    // RATE CONVERSION HELPERS
    // =========================================================================

    /**
     * Convert rate between units.
     * 
     * @param {number} rate
     * @param {string} fromUnit
     * @param {string} toUnit
     * @returns {number|null}
     */
    function convertRate(rate, fromUnit, toUnit) {
        if (fromUnit === toUnit) return rate;

        // All conversions go through per-hectare as base
        const toHa = {
            'L/ha': 1,
            'kg/ha': 1,
            'mL/100m2': 0.1,   // mL/100m² × 0.1 = L/ha
            'g/100m2': 0.1     // g/100m²  × 0.1 = kg/ha
        };

        const fromHa = {
            'L/ha': 1,
            'kg/ha': 1,
            'mL/100m2': 10,    // L/ha × 10 = mL/100m²
            'g/100m2': 10      // kg/ha × 10 = g/100m²
        };

        // Normalise to ha
        const haRate = rate * (toHa[fromUnit] || 1);
        // Convert from ha to target
        return haRate * (fromHa[toUnit] || 1);
    }

    /**
     * Get the preferred rate unit for a region.
     */
    function getRegionalUnit(region) {
        const regionUnits = {
            'au': 'L/ha',
            'nz': 'L/ha',
            'uk': 'L/ha',
            'eu': 'L/ha',
            'us': 'L/ha',   // Most Hub users will use metric
            'jp': 'L/ha'
        };
        return regionUnits[region] || 'L/ha';
    }

    // =========================================================================
    // DATE HELPERS
    // =========================================================================

    /**
     * Calculate days between two dates.
     */
    function daysBetween(dateStr1, dateStr2) {
        const d1 = new Date(dateStr1);
        const d2 = new Date(dateStr2 || new Date().toISOString().split('T')[0]);
        return Math.floor((d2 - d1) / (1000 * 60 * 60 * 24));
    }

    /**
     * Format a date string for display (respects locale).
     */
    function formatDate(dateStr) {
        if (!dateStr) return '—';
        const d = new Date(dateStr + 'T00:00:00'); // Avoid timezone shift
        return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
    }

    // =========================================================================
    // CREATE FROM RECOMMENDATION
    // =========================================================================

    /**
     * Create a spray log entry pre-filled from a recommendation card.
     * Used by the "Log Application" buttons on disease/PGR/nutrition cards.
     * 
     * @param {Object} recommendation
     * @param {string} recommendation.module - 'disease', 'pgr', 'nutrition'
     * @param {string} recommendation.productName
     * @param {string} [recommendation.productKey]
     * @param {string} [recommendation.activeIngredient]
     * @param {string} [recommendation.fracGroup]
     * @param {number} [recommendation.rate]
     * @param {string} [recommendation.rateUnit]
     * @param {string} [recommendation.target] - e.g. 'dollarSpot'
     * @param {string} [recommendation.recommendationId]
     * @param {string} [recommendation.zone]
     * @param {string[]} [recommendation.zones] - For multi-zone
     * @returns {Promise<Object>}
     */
    async function createFromRecommendation(recommendation) {
        const categoryMap = {
            'disease': 'fungicide',
            'pgr': 'pgr',
            'nutrition': 'nutrition',
            'pre_emergent': 'pre_emergent'
        };

        const entry = {
            application_date: recommendation.applicationDate || new Date().toISOString().split('T')[0],
            product_name: recommendation.productName,
            product_key: recommendation.productKey || null,
            product_category: categoryMap[recommendation.module] || 'other',
            active_ingredient: recommendation.activeIngredient || null,
            frac_group: recommendation.fracGroup || null,
            rate: recommendation.rate || null,
            rate_unit: recommendation.rateUnit || 'L/ha',
            target: recommendation.target || null,
            source: 'recommendation',
            recommendation_id: recommendation.recommendationId || null,
            zone: recommendation.zone || null,
            zones: recommendation.zones || null
        };

        return create(entry);
    }

    // =========================================================================
    // PUBLIC API
    // =========================================================================

    const GAIP_SprayLog = {
        version: VERSION,

        // CRUD
        create,
        list,
        update,
        remove,  // 'delete' is a reserved word

        // Engine context
        getContext,

        // Convenience queries
        getLatest,
        getRecent,
        getFRACHistory,

        // Recommendation integration
        createFromRecommendation,

        // Product helpers
        getProductList,
        lookupProduct,

        // Rate helpers
        convertRate,
        getRegionalUnit,

        // Date helpers
        daysBetween,
        formatDate,

        // Utility
        generateUUID,
        invalidateCache: () => _cache.invalidate()
    };

    // Export to global scope
    global.GAIP_SprayLog = GAIP_SprayLog;

    log(`v${VERSION} loaded`);

    // Invalidate in-memory cache on site switch so stale cross-site results
    // don't persist for the session lifetime.
    document.addEventListener('gaip:site-changed', function() {
        _cache.invalidate();
        log('Cache invalidated on site change');
    });

})(typeof window !== 'undefined' ? window : this);
