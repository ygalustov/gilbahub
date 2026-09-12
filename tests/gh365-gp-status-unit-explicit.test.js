/**
 * GH-365 (Hoxton audit follow-up) — GAIP_GPStatus.toPct() guesses the caller's
 * unit: `gp <= 1 ? gp * 100 : gp`. That guess is unavoidably wrong for exactly
 * one input. A GP of `1` means 100% to a fraction-caller (the recommender
 * engines, whose m.gp is 0-1) and 1% to a percentage-caller (the dashboards,
 * whose own fallbacks compare against 70/40) — and the heuristic answers 100%
 * for both, so a genuinely near-dormant surface at 1% GP rendered green
 * "High".
 *
 * GH-346 and GH-350 each patched one call site of this; the ambiguity itself
 * stayed. GH-365 adds unit-explicit entry points (…Pct / …Frac) and moves every
 * call site onto the one that matches its own unit, so the exactly-1 case no
 * longer depends on which module is asking.
 */

'use strict';

const fs = require('fs');
const path = require('path');

// The module attaches to `window` when one exists, otherwise to its own
// `this` — which under CommonJS is module.exports, not the global. Give it a
// window to attach to so the test reads the same object a browser would.
global.window = global.window || global;
require('../assets/gp-status.js');
const GP = global.window.GAIP_GPStatus;

describe('GH-365 — unit-explicit GP status entry points', () => {
    test('the ambiguous input: 1% is low, 100% is high, and each API says so', () => {
        expect(GP.getLevelPct(1)).toBe('low');
        expect(GP.getLevelFrac(1)).toBe('high');
    });

    test('toPct()\'s old heuristic is what made those two indistinguishable', () => {
        // Documents the behaviour that is being moved away from: the legacy
        // entry point still answers 'high' for a 1% percentage caller.
        expect(GP.getLevel(1)).toBe('high');
    });

    test('0 is low on both APIs (it was never the broken case, despite the GH-350 note)', () => {
        expect(GP.getLevelPct(0)).toBe('low');
        expect(GP.getLevelFrac(0)).toBe('low');
    });

    test('canonical thresholds hold on the percentage API', () => {
        expect(GP.getLevelPct(70)).toBe('high');
        expect(GP.getLevelPct(69.9)).toBe('moderate');
        expect(GP.getLevelPct(40)).toBe('moderate');
        expect(GP.getLevelPct(39.9)).toBe('low');
    });

    test('the fraction API is the percentage API scaled, thresholds included', () => {
        expect(GP.getLevelFrac(0.7)).toBe('high');
        expect(GP.getLevelFrac(0.699)).toBe('moderate');
        expect(GP.getLevelFrac(0.4)).toBe('moderate');
        expect(GP.getLevelFrac(0.399)).toBe('low');
    });

    test('colours and labels come from the same canonical palette on both APIs', () => {
        expect(GP.getColorPct(80)).toBe(GP.COLORS.high);
        expect(GP.getColorFrac(0.8)).toBe(GP.COLORS.high);
        expect(GP.getColorDocxPct(80)).toBe('16A34A');
        expect(GP.getColorDocxFrac(0.8)).toBe('16A34A');
        expect(GP.getLabelPct(50)).toBe('Moderate');
        expect(GP.getLabelFrac(0.5)).toBe('Moderate');
    });

    test('null/undefined/non-numeric stay unknown rather than defaulting to a band', () => {
        expect(GP.getLevelPct(null)).toBeNull();
        expect(GP.getLevelFrac(undefined)).toBeNull();
        expect(GP.getLevelPct('not a number')).toBeNull();
        expect(GP.getColorPct(null)).toBe(GP.COLORS.unknown);
        expect(GP.getLabelFrac(null)).toBeNull();
    });
});

describe('GH-365 — call sites use the entry point matching their own unit', () => {
    function read(f) {
        return fs.readFileSync(path.join(__dirname, '../assets/', f), 'utf8');
    }

    // These modules hold GP as a 0-100 percentage — their own inline fallbacks
    // compare against 70/40, which is the tell.
    const percentCallers = [
        'daily-dashboard.js',
        'dashboard-init.js',
        'gaip-morning-briefing.js',
        'growth-light-analysis.js',
        'gssh-led-export.js',
    ];

    // These hold the recommender engines' 0-1 fraction (m.gp) — their fallbacks
    // compare against 0.7/0.4.
    const fractionCallers = [
        'nutrition-au-fertiliser-integration.js',
        'nutrition-prebble-integration.js',
        'nutrition-calendar.js',
        'word-export.js',
    ];

    // GH-436: these two tests were BOTH negative — "does not call the legacy
    // API" and "does not call the other unit's API". A file that stopped
    // calling GAIP_GPStatus altogether and inlined its own thresholds and
    // colours satisfied both, which is exactly what CLAUDE.md forbids
    // ("Never hardcode a separate GP threshold/palette ... load gp-status.js
    // and call it"). Proven by mutation: replacing daily-dashboard.js's
    // GAIP_GPStatus.getLevelPct( call with an inline
    // `v>=65?'high':v>=45?'moderate':'low'` left both green. Each list now
    // asserts the positive too.
    const CANON = { high: 70, moderate: 40 };

    test.each(percentCallers)('%s uses the percentage API, and only that', (file) => {
        const src = read(file);
        // positive: it really does route through the shared module
        expect(src).toMatch(/GAIP_GPStatus\.(getLevelPct|getColorPct|getColorDocxPct|getLabelPct)\(/);
        expect(src).not.toMatch(/GAIP_GPStatus\.(getLevel|getColor|getColorDocx|getLabel)\(/);
        expect(src).not.toMatch(/GAIP_GPStatus\.(getLevelFrac|getColorFrac|getColorDocxFrac|getLabelFrac)\(/);
    });

    test.each(fractionCallers)('%s uses the fraction API, and only that', (file) => {
        const src = read(file);
        expect(src).toMatch(/GAIP_GPStatus\.(getLevelFrac|getColorFrac|getColorDocxFrac|getLabelFrac)\(/);
        expect(src).not.toMatch(/GAIP_GPStatus\.(getLevel|getColor|getColorDocx|getLabel)\(/);
        expect(src).not.toMatch(/GAIP_GPStatus\.(getLevelPct|getColorPct|getColorDocxPct|getLabelPct)\(/);
    });

    test.each(percentCallers.concat(fractionCallers))(
        '%s inline fallback, where it has one, quotes the module\'s own thresholds', (file) => {
            const src = read(file);
            // Several call sites keep a literal ternary beside the module call
            // for the case where gp-status.js has not loaded. That is allowed;
            // a fallback that has DRIFTED is not, because it is then a second
            // palette wearing the module's name. Only ternaries that decide a
            // GP level are looked at — the files also colour disease severity
            // and DLI suitability on their own scales, which is out of scope by
            // design and is why a blanket hex search is the wrong test here.
            // Only the lines that ALSO name GAIP_GPStatus: these files score
            // disease, stress, irrigation and VWC on their own scales with the
            // same ternary shape, and none of those are growth potential.
            const quoted = [];
            src.split('\n').forEach((line) => {
                if (!/GAIP_GPStatus\./.test(line)) return;
                const re = /([0-9.]+)\s*\?\s*['"](high|moderate)['"]/g;
                let m;
                while ((m = re.exec(line))) quoted.push({ value: parseFloat(m[1]), level: m[2] });
            });
            if (!quoted.length) return; // no fallback — the better state
            quoted.forEach((q) => {
                const asPct = q.value <= 1 ? Math.round(q.value * 1000) / 10 : q.value;
                expect(asPct).toBe(q.level === 'high' ? CANON.high : CANON.moderate);
            });
        });

    test('CANON is the module\'s own pair, not two numbers typed twice', () => {
        // Everything above is measured against CANON, so CANON has to be the
        // module's. Read back through the module's own behaviour: moving the
        // threshold in gp-status.js fails this line rather than leaving the
        // assertions above pinned to a stale 70/40.
        expect(GP.HIGH_THRESHOLD).toBe(CANON.high);
        expect(GP.MODERATE_THRESHOLD).toBe(CANON.moderate);
        expect(GP.getLevelPct(CANON.high)).toBe('high');
        expect(GP.getLevelPct(CANON.high - 0.1)).toBe('moderate');
        expect(GP.getLevelPct(CANON.moderate)).toBe('moderate');
        expect(GP.getLevelPct(CANON.moderate - 0.1)).toBe('low');
    });
});
