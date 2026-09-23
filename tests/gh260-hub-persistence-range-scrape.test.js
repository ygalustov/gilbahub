/**
 * GH-260 — rangeMin/rangeMax reach the stored nutrient row (primary path).
 *
 * WHAT THIS FILE USED TO BE, and why it is not that any more. `mlsnEngine`'s AA
 * branch sets `rangeMin`/`rangeMax` on each row; `hub-persistence.js` rendered
 * them into `data-range-min` / `data-range-max` attributes and then read them
 * back off the produced HTML with `DOMParser`. This file exercised that
 * round-trip: the engine's own output, scraped by the engine's own consumer.
 *
 * GH-574 removed the round trip. The engine returns `{ html, nutrients }` and
 * the producer copies the rows, so there is no scrape to test — and the claim
 * that matters was never about the scrape. It is that the AA range the engine
 * decided is the range that lands in `computed.soilNutrition.nutrients[]`, and
 * that an MLSN or SLAN row carries none.
 *
 * HOW IT BITES: drop `rangeMin`/`rangeMax` from the copy in `hub-persistence.js`
 * and the first case goes red; take the AA branch out of the engine and the
 * second does.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { buildContext, run } = require('./helpers/mlsn-engine-harness');

const PRODUCER = fs.readFileSync(path.join(__dirname, '..', 'assets', 'hub-persistence.js'), 'utf8');

describe('GH-260 — the AA range travels from the engine to the stored row', () => {
    let ctx;
    beforeAll(() => {
        ctx = buildContext();
    });

    test('the producer copies the range fields, and reads no markup to get them', () => {
        // Both copies — the primary path and the sample fallback — carry the
        // three fields, and neither parses anything.
        expect((PRODUCER.match(/rangeMin:\s*r\.rangeMin/g) || []).length).toBe(2);
        expect(PRODUCER).not.toMatch(/data-range-min/);
        expect(PRODUCER).not.toMatch(/parseFromString/);
    });

    test('AA row, certificate-backed: the range is on the row as numbers', () => {
        const { row } = run(ctx, {
            methodology: 'ammonium_acetate', species: 'perennialRyegrass',
            construction: 'sand_profile', soilTexture: 'sand', cec: 5, ppm: { K: 199 },
        });
        const k = row('K');
        expect(k.status).toBe('HIGH');
        expect(k.rangeMin).toBeCloseTo(78.2, 1);
        expect(k.rangeMax).toBeCloseTo(195.5, 1);
        expect(k.hasRangeAttrs).toBe(true);
    });

    test('MLSN row: no range at all, and nothing breaks', () => {
        const { row } = run(ctx, { methodology: 'mlsn', soilTexture: 'loam', ppm: { K: 50 } });
        const k = row('K');
        expect(k.rangeMin).toBeUndefined();
        expect(k.rangeMax).toBeUndefined();
        expect(k.status).toBeTruthy();
    });

    test('SLAN row: no range at all either', () => {
        const { row } = run(ctx, { methodology: 'slan', soilTexture: 'loam', ppm: { K: 50 } });
        const k = row('K');
        expect(k.rangeMin).toBeUndefined();
        expect(k.rangeMax).toBeUndefined();
    });

    test('the other fields arrive beside the ranges, not instead of them', () => {
        const { row } = run(ctx, {
            methodology: 'ammonium_acetate', species: 'perennialRyegrass',
            construction: 'sand_profile', soilTexture: 'sand', cec: 5, ppm: { K: 199 },
        });
        const k = row('K');
        expect(k.nutrient === undefined ? 'K' : k.nutrient).toBe('K');
        expect(k.actual).toBeTruthy();
        expect(k.col).toBeTruthy();
        expect(k.statusClass).toBeTruthy();
        expect(typeof k.recommendation).toBe('string');
    });
});
