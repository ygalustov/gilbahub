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

    function extractBlock(startMarker, maxLen) {
        const idx = src.indexOf(startMarker);
        expect(idx).toBeGreaterThan(-1);
        return src.slice(idx, idx + maxLen);
    }

    test('restoreFromPersisted() dispatches the event after setting this.program', () => {
        const block = extractBlock('NutritionCalendar.restoreFromPersisted = function() {', 4000);
        const programAssignIdx = block.indexOf('this.program = program;');
        const dispatchIdx = block.indexOf("document.dispatchEvent(new CustomEvent('gaip:nutrition-calendar-generated'");
        expect(programAssignIdx).toBeGreaterThan(-1);
        expect(dispatchIdx).toBeGreaterThan(-1);
        expect(dispatchIdx).toBeGreaterThan(programAssignIdx);
    });

    test('dispatch uses the same detail shape (program) as the live generate() dispatch', () => {
        const block = extractBlock('NutritionCalendar.restoreFromPersisted = function() {', 4000);
        expect(block).toMatch(/detail:\s*\{\s*program:\s*this\.program\s*\}/);
    });

    test('early-return branches (already has a program, or nothing persisted) do not dispatch', () => {
        const block = extractBlock('NutritionCalendar.restoreFromPersisted = function() {', 1500);
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
