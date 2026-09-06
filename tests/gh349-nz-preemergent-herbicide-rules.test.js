/**
 * GH-349 — Andersons Pendi Pro 22-0-5 (PGG Wrightson) contains a
 * pre-emergent herbicide (pendimethalin) but had no seeding/winter safety
 * rules anywhere in the recommendation engine. Client-confirmed spec:
 *
 *   Rule 1 (automatic): don't recommend a preEmergentHerbicide-flagged
 *   product on sports fields once GP drops below 20% (too cold for the
 *   target weeds to germinate anyway).
 *
 *   Rule 2 (NOT automatic): a static warning note, always shown alongside
 *   the product on sports fields, telling the end user to verify their own
 *   seeding/overseeding schedule. No date/calendar check involved.
 *
 * Scope: sports fields only, per client's explicit answer. Greens/
 * golf_greens/bowling_greens/cricket_wickets are unaffected -- they already
 * never see this product at all (existing suitableFor exclusion).
 */

'use strict';

const fs = require('fs');
const path = require('path');

describe('GH-349 — nz-fertiliser-products.js: structured herbicide flag', () => {
    let src;
    beforeAll(() => {
        src = fs.readFileSync(path.join(__dirname, '../assets/nz-fertiliser-products.js'), 'utf8');
    });

    test('Andersons Pendi Pro is flagged preEmergentHerbicide: true', () => {
        const idx = src.indexOf('"id": "PGG-AND-PENDI-22-0-5"');
        expect(idx).toBeGreaterThan(-1);
        const block = src.slice(idx, idx + 1200);
        expect(block).toMatch(/"preEmergentHerbicide":\s*true/);
    });
});

describe('GH-349 — prebbles-products.js: Rule 1 (GP<20% exclusion) + Rule 2 (static warning)', () => {
    let src;
    beforeAll(() => {
        src = fs.readFileSync(path.join(__dirname, '../assets/prebbles-products.js'), 'utf8');
    });

    test('a shared warning note constant exists and is not seeding-date-checked', () => {
        expect(src).toMatch(/HERBICIDE_WARNING_NOTE:\s*'Contains pre-emergent herbicide[^']*next 12 weeks[^']*'/);
    });

    test('winter branch excludes preEmergentHerbicide candidates below GP 20% on sports fields', () => {
        const idx = src.indexOf("let winterCandidates = mesaProducts.length > 0 ? mesaProducts");
        expect(idx).toBeGreaterThan(-1);
        const block = src.slice(idx, idx + 1600);
        expect(block).toMatch(/if \(surfaceType === 'sports' && monthData\.gp < 0\.20\) \{\s*\n\s*winterCandidates = winterCandidates\.filter\(p => !p\.preEmergentHerbicide\);/);
    });

    test('winter branch pushes the warning note when the herbicide product IS selected on sports fields', () => {
        const idx = src.indexOf('recommendations.granular.push(granularProduct);');
        expect(idx).toBeGreaterThan(-1);
        const block = src.slice(idx, idx + 700);
        expect(block).toMatch(/if \(bestMesa\.preEmergentHerbicide && surfaceType === 'sports'\) \{\s*\n\s*recommendations\.notes\.push\(this\.HERBICIDE_WARNING_NOTE\);/);
    });

    test('selectNitrogenSource() passes the herbicide flag through to its returned product', () => {
        const idx = src.indexOf('preEmergentHerbicide: bestProduct.preEmergentHerbicide || false,');
        expect(idx).toBeGreaterThan(-1);
    });

    test('both non-winter granular push sites (moderate/high GP) also check and warn', () => {
        const matches = src.match(/if \(nProduct\.preEmergentHerbicide && surfaceType === 'sports'\) \{\s*\n\s*recommendations\.notes\.push\(this\.HERBICIDE_WARNING_NOTE\);/g);
        expect(matches).not.toBeNull();
        expect(matches.length).toBe(2);
    });
});

describe('GH-349 — standalone reimplementation: Rule 1 exclusion behaviour', () => {
    function applyRule1(candidates, surfaceType, gp) {
        if (surfaceType === 'sports' && gp < 0.20) {
            return candidates.filter(p => !p.preEmergentHerbicide);
        }
        return candidates;
    }

    const candidates = [
        { name: 'Andersons Pendi Pro', preEmergentHerbicide: true },
        { name: 'MESA Proscape', preEmergentHerbicide: false },
    ];

    test('excluded on sports fields when GP < 20%', () => {
        const result = applyRule1(candidates, 'sports', 0.15);
        expect(result.map(p => p.name)).toEqual(['MESA Proscape']);
    });

    test('NOT excluded on sports fields when GP is 20% or above (e.g. the confirmed live July=29% case)', () => {
        const result = applyRule1(candidates, 'sports', 0.29);
        expect(result.map(p => p.name)).toContain('Andersons Pendi Pro');
    });

    test('NOT excluded on non-sports surfaces regardless of GP (scope is sports fields only)', () => {
        const result = applyRule1(candidates, 'tees', 0.05);
        expect(result.map(p => p.name)).toContain('Andersons Pendi Pro');
    });
});
