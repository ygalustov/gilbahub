/**
 * Gilba Hub — GP Status
 * ============================================================================
 * GH-257. Canonical Growth Potential (GP%) status thresholds and colors —
 * single source of truth for every surface that colour-codes a GP value:
 * dashboard, /analysis, nutrition calendars (NZ/AU/generic), Word export.
 *
 * Before this file, five different thresholds/palettes existed across the
 * hub for the same concept (70/40 green-amber-red on the dashboard, 70/40
 * green-amber-grey in Word export, 50/25 green-amber-grey in the nutrition
 * calendar tables) — the same GP% could read as a different colour
 * depending which screen or export showed it. This is now the only place
 * that defines the boundary.
 *
 * Deliberately standalone — no GilbaHub / orchestrator dependency — so any
 * page can load it independently, same rationale as climate-normals-service
 * .js.
 *
 * Explicitly NOT for: disease risk (inverted semantics — high is bad, and
 * uses its own 70/50 thresholds), fungicide residual %, or the richer
 * multi-tier status systems in hub-tissue-v3.js (5-state banner with
 * temperature overrides) and gssh-operational-summary.js (5-tier narrative
 * text) — those are intentionally more detailed than a 3-colour badge and
 * are out of scope for this unification.
 *
 * @version 1.0.0
 */

(function (global) {
    'use strict';

    var HIGH_THRESHOLD = 70;
    var MODERATE_THRESHOLD = 40;

    var COLORS = {
        high: '#16a34a',
        moderate: '#d97706',
        low: '#dc2626',
        unknown: '#9ca3af'
    };

    var LABELS = {
        high: 'High',
        moderate: 'Moderate',
        low: 'Low'
    };

    // GP values sometimes arrive as a 0-1 fraction (e.g. m.gp from the
    // recommender engines) rather than a 0-100 percentage — normalise so
    // callers don't each have to remember to *100 first.
    function toPct(gp) {
        if (gp === null || gp === undefined) return null;
        return gp <= 1 ? gp * 100 : gp;
    }

    function getLevel(gp) {
        var pct = toPct(gp);
        if (pct === null) return null;
        if (pct >= HIGH_THRESHOLD) return 'high';
        if (pct >= MODERATE_THRESHOLD) return 'moderate';
        return 'low';
    }

    function getColor(gp) {
        var level = getLevel(gp);
        return level ? COLORS[level] : COLORS.unknown;
    }

    // Uppercase, no '#' — the format the docx library (word-export.js) needs.
    function getColorDocx(gp) {
        return getColor(gp).replace('#', '').toUpperCase();
    }

    function getLabel(gp) {
        var level = getLevel(gp);
        return level ? LABELS[level] : null;
    }

    global.GAIP_GPStatus = {
        HIGH_THRESHOLD: HIGH_THRESHOLD,
        MODERATE_THRESHOLD: MODERATE_THRESHOLD,
        COLORS: COLORS,
        getLevel: getLevel,
        getColor: getColor,
        getColorDocx: getColorDocx,
        getLabel: getLabel
    };
})(typeof window !== 'undefined' ? window : this);
