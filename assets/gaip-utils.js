/**
 * GAIP Shared Utilities
 * Version: 1.0.0
 *
 * Canonical implementations of functions duplicated across 10+ modules.
 * All modules should use window.GAIP_Utils instead of local copies.
 *
 * Exposed as window.GAIP_Utils — no dependencies, loads before all other scripts.
 */

(function(global) {
    'use strict';

    // =========================================================================
    // CONSTANTS
    // =========================================================================

    var MONTH_NAMES_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                             'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    var MONTH_NAMES_FULL = ['January', 'February', 'March', 'April', 'May', 'June',
                            'July', 'August', 'September', 'October', 'November', 'December'];

    // 1-indexed version (index 0 = empty string, index 1 = Jan, etc.)
    var MONTH_NAMES_1 = [''].concat(MONTH_NAMES_SHORT);

    // =========================================================================
    // NUMERIC UTILITIES
    // =========================================================================

    /**
     * Clamp a value between min and max (inclusive).
     * Replaces 10 identical copies across the codebase.
     * @param {number} val
     * @param {number} min
     * @param {number} max
     * @returns {number}
     */
    function clamp(val, min, max) {
        return Math.max(min, Math.min(max, val));
    }

    // =========================================================================
    // DATE UTILITIES
    // =========================================================================

    /**
     * Format a date string for display.
     * Consolidates 7 different formatDate implementations.
     *
     * @param {string|Date} dateInput - ISO date string (YYYY-MM-DD) or Date object
     * @param {object} [options] - Formatting options
     * @param {boolean} [options.weekday=false] - Include short weekday (Mon, Tue...)
     * @param {boolean} [options.year=false] - Include year
     * @param {boolean} [options.iso=false] - Return ISO YYYY-MM-DD instead of display format
     * @returns {string} Formatted date string
     */
    function formatDate(dateInput, options) {
        options = options || {};

        if (options.iso) {
            var d = (dateInput instanceof Date) ? dateInput : new Date(dateInput);
            return d.toISOString().split('T')[0];
        }

        var date;
        if (dateInput instanceof Date) {
            date = dateInput;
        } else if (typeof dateInput === 'string') {
            // Timezone-safe parsing for YYYY-MM-DD strings
            if (dateInput.indexOf('T') === -1 && /^\d{4}-\d{2}-\d{2}$/.test(dateInput)) {
                date = new Date(dateInput + 'T00:00:00');
            } else {
                date = new Date(dateInput);
            }
        } else {
            return '';
        }

        if (isNaN(date.getTime())) return '';

        var day = date.getDate();
        var month = MONTH_NAMES_SHORT[date.getMonth()];
        var parts = [];

        if (options.weekday) {
            var days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
            parts.push(days[date.getDay()]);
        }

        parts.push(day + ' ' + month);

        if (options.year) {
            parts.push(date.getFullYear());
        }

        return parts.join(' ');
    }

    /**
     * Get month name (short) by 1-based index.
     * @param {number} month - 1-12
     * @returns {string} e.g. 'Jan'
     */
    function getMonthName(month) {
        return MONTH_NAMES_SHORT[(month - 1)] || '';
    }

    /**
     * Get full month name by 1-based index.
     * @param {number} month - 1-12
     * @returns {string} e.g. 'January'
     */
    function getMonthNameFull(month) {
        return MONTH_NAMES_FULL[(month - 1)] || '';
    }

    // =========================================================================
    // SPECIES UTILITIES
    // =========================================================================

    /**
     * Check if a species is C4 (warm-season).
     * Delegates to SpeciesController when available, falls back to canonical list.
     * Replaces 15 divergent copies with inconsistent species lists.
     *
     * @param {string} species - Species name (any format)
     * @returns {boolean}
     */
    function isC4Species(species) {
        // Prefer canonical SpeciesController
        if (global.SpeciesController && typeof global.SpeciesController.isC4Species === 'function') {
            return global.SpeciesController.isC4Species(species);
        }

        if (!species) return false;
        var s = String(species).toLowerCase().trim();

        // Canonical C4 keys (from species-controller.js)
        var c4 = [
            'couch', 'bermuda', 'bermudagrass', 'couchgrass', 'cynodon',
            'kikuyu', 'kikuyugrass',
            'zoysia', 'zoysiagrass',
            'buffalo', 'buffalograss', 'st augustine', 'staugustine',
            'paspalum', 'seashore paspalum', 'seashore_paspalum', 'seashorepaspalum',
            'centipede', 'bahia', 'mixedwarm'
        ];

        return c4.indexOf(s) >= 0;
    }

    /**
     * Check if a species is C3 (cool-season).
     * @param {string} species
     * @returns {boolean}
     */
    function isC3Species(species) {
        return !isC4Species(species);
    }

    // =========================================================================
    // PUBLIC API
    // =========================================================================

    global.GAIP_Utils = {
        version: '1.0.0',

        // Constants
        MONTH_NAMES_SHORT: MONTH_NAMES_SHORT,
        MONTH_NAMES_FULL: MONTH_NAMES_FULL,
        MONTH_NAMES_1: MONTH_NAMES_1,

        // Numeric
        clamp: clamp,

        // Date
        formatDate: formatDate,
        getMonthName: getMonthName,
        getMonthNameFull: getMonthNameFull,

        // Species
        isC4Species: isC4Species,
        isC3Species: isC3Species
    };

})(window);
