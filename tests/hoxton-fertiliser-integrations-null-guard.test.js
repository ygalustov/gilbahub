/**
 * Hoxton audit D02/D03 (follow-up) — the four product-recommender
 * integrations (AU/NZ/UK/Prebble) all receive calendar.program as their
 * generateAndRender(calendarData) argument, and calendar.program is now
 * `null` whenever NutritionCalendar couldn't resolve real monthly climate
 * normals (see hoxton-nutrition-calendar-monthly-temps.test.js).
 *
 * nutrition-uk-fertiliser-integration.js read `calendarData.program` at line
 * ~806 with no null-check on calendarData itself — unlike its AU/NZ/Prebble
 * siblings, which either guard early or delegate to a generateProgram() that
 * guards internally. Post the nutrition-calendar.js fix, that line would
 * throw `TypeError: Cannot read properties of null (reading 'program')` on
 * every export attempt for a site with unresolved climate data.
 *
 * These are source-pattern regression guards (matching this repo's existing
 * convention for renderer-shape tests, e.g. monthly-n-distribution-renderer-
 * b35fix387.test.js) rather than full DOM-driven behavioural tests — each of
 * these four files reads live GAIP_STATE/DOM/SampleManager globals throughout
 * generateAndRender, which would need heavy mocking disproportionate to what
 * this guard needs to prove: the null-check exists and runs before any
 * `.program` / `.monthly` access on calendarData.
 */

'use strict';

const fs = require('fs');
const path = require('path');

const FILES = {
    au: '../assets/nutrition-au-fertiliser-integration.js',
    nz: '../assets/nutrition-nz-fertiliser-integration.js',
    uk: '../assets/nutrition-uk-fertiliser-integration.js',
    prebble: '../assets/nutrition-prebble-integration.js'
};

const sources = {};
beforeAll(() => {
    Object.keys(FILES).forEach((key) => {
        sources[key] = fs.readFileSync(path.join(__dirname, FILES[key]), 'utf8');
    });
});

describe('generateAndRender(calendarData) — early null guard, all four integrations', () => {
    Object.keys(FILES).forEach((key) => {
        test(`${key}: generateAndRender has an "if (!calendarData)" guard`, () => {
            const src = sources[key];
            const fnStart = src.indexOf('generateAndRender: function(calendarData)');
            expect(fnStart).toBeGreaterThan(-1);

            const guardIdx = src.indexOf('if (!calendarData)', fnStart);
            expect(guardIdx).toBeGreaterThan(-1);

            // The guard must appear before the function's first *code* (not
            // comment) dereference of calendarData.program (the UK crash
            // pattern) — not merely exist somewhere later in the file.
            // Search from just after the guard's own "if" line so the
            // guard's explanatory comment (which necessarily names
            // calendarData.program) doesn't self-match.
            const guardLineEnd = src.indexOf('\n', guardIdx);
            const nextProgramAccess = src.indexOf('calendarData.program', guardLineEnd);
            if (nextProgramAccess !== -1) {
                expect(guardIdx).toBeLessThan(nextProgramAccess);
            }
        });

        test(`${key}: null guard shows a climate-data-unavailable message, not a silent no-op`, () => {
            const src = sources[key];
            const guardIdx = src.indexOf('if (!calendarData)');
            const guardBlock = src.slice(guardIdx, guardIdx + 600);
            expect(guardBlock).toMatch(/Climate data unavailable/);
            expect(guardBlock).toMatch(/gilba-nut-banner--warning/);
        });
    });

    test('UK integration no longer dereferences calendarData.program before the null guard', () => {
        // The specific line that would have thrown: calendarData.program
        // used directly in a ternary with no prior null-check on calendarData.
        const src = sources.uk;
        const guardIdx = src.indexOf('if (!calendarData)');
        const ternaryIdx = src.indexOf('calendarData.program ?');
        expect(guardIdx).toBeGreaterThan(-1);
        expect(ternaryIdx).toBeGreaterThan(-1);
        expect(guardIdx).toBeLessThan(ternaryIdx);
    });
});

describe('window.GAIP_NUTRITION_PROGRAM_UNAVAILABLE — cleared on every successful program', () => {
    Object.keys(FILES).forEach((key) => {
        test(`${key}: sets GAIP_NUTRITION_PROGRAM_UNAVAILABLE = false right after GAIP_NUTRITION_PROGRAM = program`, () => {
            const src = sources[key];
            const assignIdx = src.indexOf('window.GAIP_NUTRITION_PROGRAM = program;');
            expect(assignIdx).toBeGreaterThan(-1);
            const after = src.slice(assignIdx, assignIdx + 200);
            expect(after).toMatch(/GAIP_NUTRITION_PROGRAM_UNAVAILABLE\s*=\s*false/);
        });
    });
});
