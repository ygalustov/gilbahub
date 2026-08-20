/**
 * Test GH-258 — Hill Labs sample-type SSOT data layer (D07 item 1).
 *
 * Covers `assets/hill-labs-sample-types.js`'s new `deriveCode()`,
 * `getRangesPpm()`, and `resolveSoilTexture()` (GH-259), plus the S279
 * (Browntop, Sand) entry added alongside them.
 *
 * BUG CONTEXT: before this SSOT existed, AA sufficiency-range data was
 * independently duplicated across 9 places in the codebase (see docs/
 * instructions.md GH-258), each with its own numbers and its own
 * texture-bucketing rule. These functions are meant to be the one place
 * (per runtime) that mapping lives — this file pins their behaviour so
 * future edits can't silently reintroduce drift.
 */

const HillLabsSampleTypes = require('../assets/hill-labs-sample-types.js');

describe('GH-258 — Hill Labs sample-type SSOT', () => {
    // -------------------------------------------------------------------------
    // S279 DATA — new sample type added this fix
    // -------------------------------------------------------------------------

    describe('S279 (Browntop, Sand) certificate data', () => {
        test('S279 exists with the expected code/label', () => {
            const ranges = HillLabsSampleTypes.getRanges('S279');
            expect(ranges).not.toBeNull();
            expect(ranges.code).toBe('S279');
            expect(ranges.label).toMatch(/Browntop/);
        });

        test('S279 K/Ca/Mg/Na me/100g match S277 (same cation/CEC calibration)', () => {
            const s277 = HillLabsSampleTypes.getRanges('S277').thresholds;
            const s279 = HillLabsSampleTypes.getRanges('S279').thresholds;
            ['K', 'Ca', 'Mg', 'Na'].forEach((nut) => {
                expect(s279[nut].min).toBe(s277[nut].min);
                expect(s279[nut].max).toBe(s277[nut].max);
                expect(s279[nut].unit).toBe(s277[nut].unit);
            });
        });

        test('S279 pH/Olsen P/TBS differ per the Russley certificate (not copy-pasted from S277)', () => {
            const t = HillLabsSampleTypes.getThreshold('S279', 'pH');
            expect(t).toEqual({ min: 5.0, max: 5.7, unit: 'pH', axis: 'pH', label: '5.0-5.7' });
            const p = HillLabsSampleTypes.getThreshold('S279', 'P');
            expect(p.min).toBe(5);
            expect(p.max).toBe(15);
        });

        test('listCodes() includes all 4 codes', () => {
            expect(HillLabsSampleTypes.listCodes().sort()).toEqual(['S277', 'S279', 'S78', 'S81']);
        });
    });

    // -------------------------------------------------------------------------
    // deriveCode() — species + texture -> sample-type code
    // -------------------------------------------------------------------------

    describe('deriveCode(species, soilTexture)', () => {
        test('perennialRyegrass + sand-ish texture -> S277', () => {
            expect(HillLabsSampleTypes.deriveCode('perennialRyegrass', 'sand')).toBe('S277');
            expect(HillLabsSampleTypes.deriveCode('perennialRyegrass', 'sandy_loam')).toBe('S277');
            expect(HillLabsSampleTypes.deriveCode('perennialRyegrass', 'loamy_sand')).toBe('S277');
        });

        test('perennialRyegrass + non-sand texture -> null (not certificate-covered)', () => {
            expect(HillLabsSampleTypes.deriveCode('perennialRyegrass', 'loam')).toBeNull();
            expect(HillLabsSampleTypes.deriveCode('perennialRyegrass', 'clay_loam')).toBeNull();
            expect(HillLabsSampleTypes.deriveCode('perennialRyegrass', 'clay')).toBeNull();
        });

        test('browntopBent + sand-ish texture -> S279', () => {
            expect(HillLabsSampleTypes.deriveCode('browntopBent', 'sand')).toBe('S279');
            expect(HillLabsSampleTypes.deriveCode('browntopBent', 'sandy_loam')).toBe('S279');
        });

        test('browntopBent + non-sand texture -> null', () => {
            expect(HillLabsSampleTypes.deriveCode('browntopBent', 'loam')).toBeNull();
        });

        test('fineFescue / tallFescue -> S81 regardless of texture (cert states no rootzone)', () => {
            expect(HillLabsSampleTypes.deriveCode('fineFescue', 'sand')).toBe('S81');
            expect(HillLabsSampleTypes.deriveCode('fineFescue', 'loam')).toBe('S81');
            expect(HillLabsSampleTypes.deriveCode('tallFescue', 'clay')).toBe('S81');
        });

        test('cotula -> S78 always, texture does not gate it', () => {
            expect(HillLabsSampleTypes.deriveCode('cotula', 'sand')).toBe('S78');
            expect(HillLabsSampleTypes.deriveCode('cotula', 'loam')).toBe('S78');
            expect(HillLabsSampleTypes.deriveCode('cotula', null)).toBe('S78');
            expect(HillLabsSampleTypes.deriveCode('cotula', undefined)).toBe('S78');
        });

        test('uncovered species (C4, Bentgrass, Kentucky Bluegrass, Poa Annua) -> null', () => {
            ['kikuyu', 'couch', 'zoysia', 'buffalo', 'seashore_paspalum', 'bentgrass', 'kentuckyBluegrass', 'poaAnnua']
                .forEach((sp) => {
                    expect(HillLabsSampleTypes.deriveCode(sp, 'sand')).toBeNull();
                });
        });

        test('no species -> null, does not throw', () => {
            expect(HillLabsSampleTypes.deriveCode(null, 'sand')).toBeNull();
            expect(HillLabsSampleTypes.deriveCode('', 'sand')).toBeNull();
            expect(HillLabsSampleTypes.deriveCode(undefined, undefined)).toBeNull();
        });
    });

    // -------------------------------------------------------------------------
    // resolveSoilTexture() — GH-259 fallback chain
    // -------------------------------------------------------------------------

    describe('resolveSoilTexture(siteOverride, accountTexture)', () => {
        test('site override wins when present', () => {
            expect(HillLabsSampleTypes.resolveSoilTexture('sand', 'loam')).toBe('sand');
        });

        test('falls back to account texture when site override is null', () => {
            expect(HillLabsSampleTypes.resolveSoilTexture(null, 'loam')).toBe('loam');
            expect(HillLabsSampleTypes.resolveSoilTexture('', 'loam')).toBe('loam');
        });

        test('returns null when neither is set', () => {
            expect(HillLabsSampleTypes.resolveSoilTexture(null, null)).toBeNull();
            expect(HillLabsSampleTypes.resolveSoilTexture(undefined, undefined)).toBeNull();
        });
    });

    // -------------------------------------------------------------------------
    // getRangesPpm() — unit conversion to ppm
    // -------------------------------------------------------------------------

    describe('getRangesPpm(code, nutrient, cec)', () => {
        test('me/100g absolute axis converts via the documented factors (Hagley Oval K worked example)', () => {
            // word-export.js b35fix441: K=0.15 me/100g -> 58.7ppm (rounded)
            expect(HillLabsSampleTypes.meq100gToPpm(0.15, 'K')).toBeCloseTo(58.65, 2);
            const r = HillLabsSampleTypes.getRangesPpm('S277', 'K');
            expect(r).toEqual({ min: 78.2, max: 195.5 });
        });

        test('S279 K range matches S277 (same me/100g source values)', () => {
            expect(HillLabsSampleTypes.getRangesPpm('S279', 'K')).toEqual({ min: 78.2, max: 195.5 });
        });

        test('mg/L (Olsen P) axis passes through unconverted', () => {
            expect(HillLabsSampleTypes.getRangesPpm('S277', 'P')).toEqual({ min: 20, max: 30 });
        });

        test('%BS proportion axis requires CEC and converts through it (S81)', () => {
            expect(HillLabsSampleTypes.getRangesPpm('S81', 'K')).toBeNull();
            expect(HillLabsSampleTypes.getRangesPpm('S81', 'K', null)).toBeNull();
            const r = HillLabsSampleTypes.getRangesPpm('S81', 'K', 18);
            // 2.0%BS of CEC18 = 0.36 me/100g * 391 = 140.76; 6.0%BS = 1.08 * 391 = 422.28
            expect(r.min).toBeCloseTo(140.76, 2);
            expect(r.max).toBeCloseTo(422.28, 2);
        });

        test('S78 (Cotula, delegated) always returns null — never invents a range', () => {
            expect(HillLabsSampleTypes.getRangesPpm('S78', 'K')).toBeNull();
            expect(HillLabsSampleTypes.getRangesPpm('S78', 'P')).toBeNull();
        });

        test('physical/mass-ratio/pH axes are not nutrient ranges -> null', () => {
            expect(HillLabsSampleTypes.getRangesPpm('S277', 'CEC')).toBeNull();
            expect(HillLabsSampleTypes.getRangesPpm('S277', 'KMgRatio')).toBeNull();
            expect(HillLabsSampleTypes.getRangesPpm('S277', 'pH')).toBeNull();
        });

        test('unknown code or unknown nutrient -> null, does not throw', () => {
            expect(HillLabsSampleTypes.getRangesPpm('S999', 'K')).toBeNull();
            expect(HillLabsSampleTypes.getRangesPpm('S277', 'Zz')).toBeNull();
        });
    });
});
