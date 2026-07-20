/**
 * b35fix503 — disease-forecast.js normalizeSpecies: browntop before generic bent
 *
 * Pre-fix: normalizeSpecies in disease-forecast.js checked indexOf('bent') FIRST.
 * normalizeSpecies("browntopBent") → s = "browntopbent" → indexOf('bent') >= 0
 * → returned 'bentgrass'.
 *
 * Root cause: disease-forecast.js's local normalizeSpecies was never updated when
 * b35fix492 added browntopBent support to disease-engine-pure.js.  After b35fix501
 * writes the normalised key "browntopBent" to GAIP_STATE, DiseaseForecast reads it
 * back via SpeciesController.getBaseSpecies() or GAIP_STATE, passes it through its
 * own normalizeSpecies, and gets 'bentgrass' — wrong susceptibility multipliers for
 * the 7-day forecast chart on Russley (browntopBent site).
 *
 * Fix: add browntop/colonial/capillaris guard BEFORE the generic bent check,
 * mirroring b35fix492 in disease-engine-pure.js.
 *
 * Spec: tests/disease-forecast-browntop-normalize-b35fix503.test.js (11 tests)
 */

'use strict';

const fs   = require('fs');
const path = require('path');

const src = fs.readFileSync(
    path.join(__dirname, '../assets/disease-forecast.js'),
    'utf8'
);

// Extract a named function's body by brace-counting from its declaration.
function extractFunctionSrc(source, fnName) {
    var start = source.indexOf('function ' + fnName + '(');
    if (start === -1) return null;
    var depth = 0, begun = false;
    for (var i = start; i < source.length; i++) {
        if (source[i] === '{') { depth++; begun = true; }
        if (source[i] === '}') depth--;
        if (begun && depth === 0) return source.slice(start, i + 1);
    }
    return null;
}

// Eval the pure normalizeSpecies function (no browser deps in its body)
const normalizeSpeciesSrc = extractFunctionSrc(src, 'normalizeSpecies');
// eslint-disable-next-line no-new-func
const normalizeSpecies = normalizeSpeciesSrc ? new Function('return (' + normalizeSpeciesSrc + ')')() : null;

// ─────────────────────────────────────────────────────────────────────────────
// A. Source structure (4 tests)
// ─────────────────────────────────────────────────────────────────────────────

describe('b35fix503 — source structure', () => {
    test('normalizeSpecies is present in disease-forecast.js', () => {
        expect(normalizeSpeciesSrc).not.toBeNull();
    });

    test('b35fix503 comment is present', () => {
        expect(src).toContain('b35fix503');
    });

    test('browntop guard appears BEFORE generic bent check in function body', () => {
        const browntopPos = normalizeSpeciesSrc.indexOf("indexOf('browntop')");
        const bentPos     = normalizeSpeciesSrc.indexOf("indexOf('bent')");
        expect(browntopPos).toBeGreaterThan(-1);
        expect(bentPos).toBeGreaterThan(-1);
        expect(browntopPos).toBeLessThan(bentPos);
    });

    test('colonial and capillaris are also guarded before generic bent', () => {
        const colonialPos  = normalizeSpeciesSrc.indexOf("indexOf('colonial')");
        const capillarisPos = normalizeSpeciesSrc.indexOf("indexOf('capillaris')");
        const bentPos      = normalizeSpeciesSrc.indexOf("indexOf('bent')");
        expect(colonialPos).toBeLessThan(bentPos);
        expect(capillarisPos).toBeLessThan(bentPos);
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// B. normalizeSpecies browntop routing (5 tests)
// ─────────────────────────────────────────────────────────────────────────────

describe('b35fix503 — browntop routing', () => {
    test('already-normalised key "browntopBent" resolves to browntopBent, not bentgrass', () => {
        // This was the primary failure: b35fix501 writes "browntopBent" to GAIP_STATE,
        // DiseaseForecast reads it back and calls normalizeSpecies("browntopBent") →
        // "browntopbent".indexOf('bent') was truthy → returned 'bentgrass' pre-fix.
        expect(normalizeSpecies('browntopBent')).toBe('browntopBent');
    });

    test('display string "Browntop Bent (Greens)" resolves to browntopBent', () => {
        expect(normalizeSpecies('Browntop Bent (Greens)')).toBe('browntopBent');
    });

    test('"browntop bent" resolves to browntopBent', () => {
        expect(normalizeSpecies('browntop bent')).toBe('browntopBent');
    });

    test('"colonial bent" resolves to browntopBent', () => {
        expect(normalizeSpecies('colonial bent')).toBe('browntopBent');
    });

    test('"Agrostis capillaris" resolves to browntopBent', () => {
        expect(normalizeSpecies('Agrostis capillaris')).toBe('browntopBent');
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// C. Generic bent and other species unaffected (2 tests)
// ─────────────────────────────────────────────────────────────────────────────

describe('b35fix503 — generic bent and other species unaffected', () => {
    test('"creeping bent" still resolves to bentgrass', () => {
        expect(normalizeSpecies('creeping bent')).toBe('bentgrass');
    });

    test('"Creeping Bentgrass (Greens)" still resolves to bentgrass', () => {
        expect(normalizeSpecies('Creeping Bentgrass (Greens)')).toBe('bentgrass');
    });
});
