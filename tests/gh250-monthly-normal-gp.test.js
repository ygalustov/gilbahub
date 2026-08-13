/**
 * GH-250 — "This Month's Normal GP" row on the Growth & Temperature panel.
 *
 * Background: comparing "Today's Growth Potential" (live, from today's
 * actual/forecast temperature) against the Plan page's 12-month schedule
 * figure for the current month (from the site's 20-year NASA POWER climate
 * normal) showed a large, confusing gap — e.g. 34% today vs 6% for August's
 * long-term average at the same Christchurch site. Both numbers are
 * individually correct (verified against client reference calculations in
 * docs/instructions.md items 80a/244) — live weather vs. a climatological
 * baseline are legitimately different quantities. There was previously no
 * way to see both side by side on the dashboard.
 *
 * Fix: `cacheAnalysisResults()` (hub-persistence.js) now computes the
 * current month's GP from `climateMetrics.monthlyTemps[month]` (NASA POWER
 * climatology, GH-245) using the same `calculateWeightedGrowth()` function
 * `dailyPattern` entries are built with — not a new formula — and persists
 * it as `computed.climate.growth.monthlyNormal`. `growth-light-analysis.js`
 * renders it as a third row under "8-Day Average GP", same `.gl-gp-row`
 * visual pattern, no day-tile strip underneath.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

// ─────────────────────────────────────────────────────────────────────────────
// 1. calculateWeightedGrowth() math — confirms the reused function produces
//    the right shape/values for a monthly-normal temperature input.
// ─────────────────────────────────────────────────────────────────────────────

describe('GH-250 — calculateWeightedGrowth() reused correctly for monthly-normal temps', () => {
    global.window = global.window || {};
    global.window.GilbaGrowthPotentialEngine = require('../assets/growth-potential-engine.js');

    const engineSrc = fs.readFileSync(path.join(__dirname, '../assets/climate-engine.js'), 'utf8');
    const sandbox = { window: global.window, console };
    vm.createContext(sandbox);
    vm.runInContext(engineSrc + '\nthis.calculateWeightedGrowth = calculateWeightedGrowth;', sandbox);

    test('pure C3 site: August normal ~7°C gives ~6% (matches docs/instructions.md item 244 reference)', () => {
        const result = sandbox.calculateWeightedGrowth(7.0, 1, 0); // pure C3
        expect(Math.round(100 * result.c3)).toBeCloseTo(6, 0);
        expect(Math.round(100 * result.weighted)).toBe(Math.round(100 * result.c3));
    });

    test('pure C4 site: warm month normal near optimum (31°C) gives high GP', () => {
        const result = sandbox.calculateWeightedGrowth(31.0, 0, 1); // pure C4
        expect(Math.round(100 * result.c4)).toBeGreaterThan(95);
    });

    test('returns independent c3/c4/weighted fields (same shape dailyPattern entries use)', () => {
        const result = sandbox.calculateWeightedGrowth(15.0, 0.5, 0.5);
        expect(result).toHaveProperty('weighted');
        expect(result).toHaveProperty('c3');
        expect(result).toHaveProperty('c4');
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. hub-persistence.js — source-pattern pins for the new block
// ─────────────────────────────────────────────────────────────────────────────

describe('GH-250 — hub-persistence.js computes and stores monthlyNormal', () => {
    const src = fs.readFileSync(path.join(__dirname, '../assets/hub-persistence.js'), 'utf8');

    test('reads the current month key (1-12) from climateMetrics.monthlyTemps', () => {
        expect(src).toMatch(/_normalMonth\s*=\s*new Date\(\)\.getMonth\(\)\s*\+\s*1/);
        expect(src).toMatch(/climateMetrics\.monthlyTemps\[_normalMonth\]/);
    });

    test('reuses calculateWeightedGrowth (not a new duplicate GP formula)', () => {
        expect(src).toMatch(/_normalGrowth\s*=\s*calculateWeightedGrowth\(_normalTemp,\s*_c3f,\s*_c4f\)/);
    });

    test('is guarded — only assigns monthlyNormal when a real number is available', () => {
        const idx = src.indexOf('_normalMonth');
        expect(idx).toBeGreaterThan(-1);
        const window_ = src.slice(idx, idx + 900);
        expect(window_).toMatch(/if\s*\(\s*typeof _normalTemp === 'number'\s*\)/);
    });

    test('stores month/temp/weighted/c3/c4/source on computed.climate.growth.monthlyNormal', () => {
        expect(src).toMatch(/cache\.computed\.climate\.growth\.monthlyNormal\s*=\s*\{/);
        const idx = src.indexOf('cache.computed.climate.growth.monthlyNormal = {');
        const obj = src.slice(idx, idx + 500);
        ['month:', 'temp:', 'weighted:', 'c3:', 'c4:', 'source:'].forEach((key) => {
            expect(obj).toContain(key);
        });
    });

    test('failure is caught and logged, never throws out of cacheAnalysisResults', () => {
        const idx = src.indexOf('_normalMonth');
        const window_ = src.slice(idx - 50, idx + 1100);
        expect(window_).toMatch(/catch\s*\(_normalErr\)/);
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. growth-light-analysis.js — source-pattern pins for the new row
// ─────────────────────────────────────────────────────────────────────────────

describe('GH-250 — growth-light-analysis.js renders the monthlyNormal row', () => {
    const src = fs.readFileSync(path.join(__dirname, '../assets/growth-light-analysis.js'), 'utf8');

    test('reads growth.monthlyNormal and picks c3/c4 by grassType, matching baseGpVal\'s mixed-stand convention', () => {
        expect(src).toMatch(/var monthlyNormal = growth\.monthlyNormal;/);
        expect(src).toMatch(/grassType === 'c4' \? monthlyNormal\.c4 : monthlyNormal\.c3/);
    });

    test('is guarded — renders nothing (empty string) when monthlyNormal or its value is absent', () => {
        expect(src).toMatch(/var normalSectionHtml = '';/);
        expect(src).toMatch(/if \(monthlyNormal\) \{/);
    });

    test('normalSectionHtml is inserted after avgSectionHtml in the returned block body', () => {
        const idx = src.indexOf('mixedBannerHtml,');
        expect(idx).toBeGreaterThan(-1);
        const block = src.slice(idx, idx + 300);
        const avgIdx = block.indexOf('avgSectionHtml,');
        const normalIdx = block.indexOf('normalSectionHtml,');
        expect(avgIdx).toBeGreaterThan(-1);
        expect(normalIdx).toBeGreaterThan(avgIdx);
    });

    test('no day-tile strip for the normal row (renderDailyStrip is not called inside the monthlyNormal block)', () => {
        const startIdx = src.indexOf('var normalSectionHtml');
        const endIdx = src.indexOf('return [', startIdx);
        const section = src.slice(startIdx, endIdx);
        expect(section).not.toMatch(/renderDailyStrip/);
    });

    test('reuses the existing .gl-gp-row/.gl-insight-box classes (no new CSS needed)', () => {
        const startIdx = src.indexOf('var normalSectionHtml');
        const endIdx = src.indexOf('return [', startIdx);
        const section = src.slice(startIdx, endIdx);
        expect(section).toMatch(/class="gl-gp-row"/);
        expect(section).toMatch(/class="gl-gp-row-left"/);
        expect(section).toMatch(/class="gl-gp-row-right"/);
        expect(section).toMatch(/class="gl-insight-box"/);
    });

    test('GL_GLOSSARY has a gl-gp-normal entry for the new info button', () => {
        expect(src).toMatch(/'gl-gp-normal':\s*\{/);
        const idx = src.indexOf("'gl-gp-normal': {");
        const entry = src.slice(idx, idx + 300);
        expect(entry).toMatch(/title:\s*'Monthly Climate Normal'/);
    });

    test('info button for the new row references the gl-gp-normal glossary key', () => {
        expect(src).toMatch(/infoBtn\('gl-gp-normal'\)/);
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// GH-252 — buildClimateView() must forward monthlyNormal, not silently drop it.
//
// Production testing (diagnostic logging in hub-persistence.js) confirmed
// climateMetrics.monthlyTemps/computed.climate.growth.monthlyNormal WAS being
// set correctly on every Re-run, yet the row never rendered. Root cause:
// buildClimateView() (growth-light-analysis.js) rebuilds the `growth` object
// passed to renderGrowthBlock() from an explicit field list (c3/c4/weighted/
// status/dailyPattern/gdd) rather than spreading the source object — any
// field not named in that list (monthlyNormal included) is silently dropped
// between computed.climate.growth and the renderer, even though dailyPattern
// (right next to it in the same object) survives fine because it IS named.
// ─────────────────────────────────────────────────────────────────────────────

describe('GH-252 — buildClimateView() forwards growth.monthlyNormal', () => {
    const src = fs.readFileSync(path.join(__dirname, '../assets/growth-light-analysis.js'), 'utf8');

    test('the growth object literal returned by buildClimateView() includes monthlyNormal', () => {
        const idx = src.indexOf('function buildClimateView(data)');
        expect(idx).toBeGreaterThan(-1);
        const returnIdx = src.indexOf('return {', idx);
        const body = src.slice(returnIdx, returnIdx + 900);
        expect(body).toMatch(/dailyPattern:\s*dailyPattern/); // sibling field, confirms right object literal
        expect(body).toMatch(/monthlyNormal:\s*growth\.monthlyNormal/);
    });
});
