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
    //
    // GH-365: this guess is unavoidably wrong for exactly one input. A GP of
    // `1` is 100% to a fraction-caller and 1% to a percentage-caller, and the
    // heuristic answers 100% either way — so a genuinely near-dormant surface
    // at 1% GP renders green "High". That is the same root cause GH-346 and
    // GH-350 each patched at one call site. Callers that know their unit
    // should say so via fromPercent()/fromFraction() below; toPct() stays for
    // callers that genuinely cannot know, with the ambiguity documented rather
    // than hidden.
    function toPct(gp) {
        if (gp === null || gp === undefined) return null;
        return gp <= 1 ? gp * 100 : gp;
    }

    function getLevel(gp) {
        var pct = toPct(gp);
        if (pct === null) return null;
        return levelFromPct(pct);
    }

    function levelFromPct(pct) {
        if (pct === null || pct === undefined) return null;
        if (pct >= HIGH_THRESHOLD) return 'high';
        if (pct >= MODERATE_THRESHOLD) return 'moderate';
        return 'low';
    }

    // GH-365: unambiguous entry points, drop-in shaped so call sites stay
    // one-for-one. getLevelPct(1) is 1% -> 'low'; getLevelFrac(1) is 100% ->
    // 'high'. No guessing, and the exactly-1 case stops depending on which
    // module happens to be calling.
    function _num(v) {
        if (v === null || v === undefined) return null;
        var n = parseFloat(v);
        return isNaN(n) ? null : n;
    }
    function getLevelPct(gpPct)     { return levelFromPct(_num(gpPct)); }
    function getColorPct(gpPct)     { var l = getLevelPct(gpPct); return l ? COLORS[l] : COLORS.unknown; }
    function getColorDocxPct(gpPct) { return getColorPct(gpPct).replace('#', '').toUpperCase(); }
    function getLabelPct(gpPct)     { var l = getLevelPct(gpPct); return l ? LABELS[l] : null; }

    function _fracToPct(gpFrac)      { var n = _num(gpFrac); return n === null ? null : n * 100; }
    function getLevelFrac(gpFrac)     { return getLevelPct(_fracToPct(gpFrac)); }
    function getColorFrac(gpFrac)     { return getColorPct(_fracToPct(gpFrac)); }
    function getColorDocxFrac(gpFrac) { return getColorDocxPct(_fracToPct(gpFrac)); }
    function getLabelFrac(gpFrac)     { return getLabelPct(_fracToPct(gpFrac)); }

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
        getLabel: getLabel,
        // GH-365: prefer these where the caller knows its unit.
        getLevelPct: getLevelPct,
        getColorPct: getColorPct,
        getColorDocxPct: getColorDocxPct,
        getLabelPct: getLabelPct,
        getLevelFrac: getLevelFrac,
        getColorFrac: getColorFrac,
        getColorDocxFrac: getColorDocxFrac,
        getLabelFrac: getLabelFrac
    };
})(typeof window !== 'undefined' ? window : this);
