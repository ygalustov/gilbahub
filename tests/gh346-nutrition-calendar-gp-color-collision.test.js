/**
 * GH-346 — Westview site: GP=1% (three winter months) rendered green
 * ("high") in the Monthly Nutrient Program table, while GP=3-4% correctly
 * rendered red ("low"). Root cause: gp-status.js's toPct() treats any
 * incoming value <= 1 as a 0-1 fraction and multiplies by 100. The table
 * had already converted m.gp to a percentage (gpPct = Math.round(m.gp*100))
 * before calling getLevel(gpPct) -- gpPct=1 (a genuine 1%) collided with
 * that heuristic and got re-multiplied to 100 -> "high".
 *
 * FIX: pass the raw fraction (m.gp) to getLevel() instead of the
 * pre-converted gpPct, matching the convention already used by
 * nutrition-au-fertiliser-integration.js and nutrition-prebble-integration.js.
 */

'use strict';

const fs = require('fs');
const path = require('path');

describe('GH-346 — nutrition-calendar.js passes the raw GP fraction to GAIP_GPStatus.getLevel()', () => {
    let src;
    beforeAll(() => {
        src = fs.readFileSync(path.join(__dirname, '../assets/nutrition-calendar.js'), 'utf8');
    });

    test('getLevel() is called with m.gp, not the pre-rounded gpPct', () => {
        expect(src).toMatch(/const gpLevel = window\.GAIP_GPStatus \? window\.GAIP_GPStatus\.getLevelFrac\(m\.gp\) : /);
        expect(src).not.toMatch(/window\.GAIP_GPStatus\.getLevel\(gpPct\)/);
    });

    test('gpPct itself is unchanged -- still used for the visible percentage text', () => {
        expect(src).toMatch(/const gpPct = Math\.round\(m\.gp \* 100\);/);
        expect(src).toMatch(/\$\{gpPct\}%/);
    });
});

describe('GH-346 — standalone reimplementation: gp-status.js\'s toPct/getLevel collision at exactly 1', () => {
    const HIGH_THRESHOLD = 70;
    const MODERATE_THRESHOLD = 40;

    function toPct(gp) {
        if (gp === null || gp === undefined) return null;
        return gp <= 1 ? gp * 100 : gp;
    }

    function getLevel(gp) {
        const pct = toPct(gp);
        if (pct === null) return null;
        if (pct >= HIGH_THRESHOLD) return 'high';
        if (pct >= MODERATE_THRESHOLD) return 'moderate';
        return 'low';
    }

    test('OLD bug: passing the pre-converted percentage 1 (meaning 1%) misclassifies as "high"', () => {
        const gpFraction = 0.01; // 1%
        const gpPctPreConverted = Math.round(gpFraction * 100); // 1
        expect(getLevel(gpPctPreConverted)).toBe('high'); // wrong -- proves the collision
    });

    test('FIX: passing the raw fraction (0.01) correctly classifies as "low"', () => {
        const gpFraction = 0.01; // 1%
        expect(getLevel(gpFraction)).toBe('low');
    });

    test('FIX: GP=3-4% (already unambiguous, > 1 either way) still classifies as "low" -- no regression', () => {
        expect(getLevel(0.03)).toBe('low');
        expect(getLevel(0.04)).toBe('low');
    });

    test('FIX: GP=55%/42% (moderate band) still classify correctly via the fraction path', () => {
        expect(getLevel(0.55)).toBe('moderate');
        expect(getLevel(0.42)).toBe('moderate');
    });
});
