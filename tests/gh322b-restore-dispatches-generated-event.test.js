/**
 * GH-322 follow-up — plan-ui.js's "Monthly N Need" KPI card listened for
 * 'gaip:site-config-applied' to catch up once NutritionCalendar.
 * restoreFromPersisted() populated the program, but that event never fires
 * on plan.blade.php: that page never loads site-config-persistence.js, and
 * NutritionCalendar.init() calls restoreFromPersisted() directly instead
 * (see the comment at that call site). Confirmed live via [GH322-DEBUG]:
 * the listener registered fine, but the event it waited for never arrived.
 *
 * FIX: restoreFromPersisted() now also dispatches
 * 'gaip:nutrition-calendar-generated' (the same event generate() always
 * dispatched) once this.program is set. Any consumer listening for "a
 * program is now available" — live-generate or restore, any page — gets
 * one consistent signal, instead of every consumer needing to guess at
 * page-specific restore timing.
 */

'use strict';

const fs = require('fs');
const path = require('path');

describe('GH-322 follow-up — restoreFromPersisted() dispatches gaip:nutrition-calendar-generated', () => {
    const src = fs.readFileSync(path.join(__dirname, '../assets/nutrition-calendar.js'), 'utf8');

    // GH-371: re-anchored to a following statement instead of a fixed
    // character count, per this project's own lesson from three prior
    // widenings of a similarly-shaped window elsewhere (GH-365's changelog
    // entry) — a fixed maxLen breaks again every time unrelated code is
    // inserted earlier in the same function (as GH-371's own D01
    // coordinate-staleness check just did). `endMarker` names a statement
    // that is stable regardless of how much grows before it.
    function extractBlock(startMarker, endMarker, trailing) {
        const idx = src.indexOf(startMarker);
        expect(idx).toBeGreaterThan(-1);
        const endIdx = src.indexOf(endMarker, idx);
        expect(endIdx).toBeGreaterThan(idx);
        return src.slice(idx, endIdx + endMarker.length + (trailing || 0));
    }

    test('restoreFromPersisted() dispatches the event after setting this.program', () => {
        const block = extractBlock('NutritionCalendar.restoreFromPersisted = function() {',
            "document.dispatchEvent(new CustomEvent('gaip:nutrition-calendar-generated'", 200);
        const programAssignIdx = block.indexOf('this.program = program;');
        const dispatchIdx = block.indexOf("document.dispatchEvent(new CustomEvent('gaip:nutrition-calendar-generated'");
        expect(programAssignIdx).toBeGreaterThan(-1);
        expect(dispatchIdx).toBeGreaterThan(-1);
        expect(dispatchIdx).toBeGreaterThan(programAssignIdx);
    });

    test('dispatch uses the same detail shape (program) as the live generate() dispatch', () => {
        const block = extractBlock('NutritionCalendar.restoreFromPersisted = function() {',
            "document.dispatchEvent(new CustomEvent('gaip:nutrition-calendar-generated'", 200);
        expect(block).toMatch(/detail:\s*\{\s*program:\s*this\.program\s*\}/);
    });

    test('early-return branches (already has a program, or nothing persisted) do not dispatch', () => {
        // Bounded to just past the "no persisted program" early return —
        // deliberately stops well before this.program is ever assigned, so
        // it can't accidentally start matching content added between the
        // early returns and the dispatch (e.g. GH-371's own coordinate
        // check, which also `return`s early and must NOT count as a dispatch
        // site here either).
        const block = extractBlock('NutritionCalendar.restoreFromPersisted = function() {',
            "console.log('[NutritionCalendar] persist-debug: SKIPPED — no persisted program, or missing annual_totals. program=', program);", 50);
        expect(block).toMatch(/if \(this\.program\) \{[\s\S]*?return;/);
        expect(block).toMatch(/if \(!program \|\| !program\.annual_totals\) \{[\s\S]*?return;/);
        // the early returns happen well before the dispatch line
        const dispatchIdx = block.indexOf("dispatchEvent");
        expect(dispatchIdx).toBe(-1);
    });

    test('regression: generate()\'s own dispatch is unchanged', () => {
        expect(src).toMatch(/console\.log\('\[NutritionCalendar\] Dispatching gaip:nutrition-calendar-generated,/);
    });
});
