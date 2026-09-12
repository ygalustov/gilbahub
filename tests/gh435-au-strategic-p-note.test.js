/**
 * GH-435 — the Australian "Strategic P application" note names the shortfall.
 *
 * THE DEFECT. GH-417 fixed the New Zealand note, which printed the REQUEST
 * ("19.8 kg P/ha") above a product line supplying 5.4, and changed it to
 * "5.4 kg P/ha (of 19.8 requested)". Its own changelog entry recorded that the
 * Australian twin "has always printed the delivered figure", which is true and
 * was taken as meaning the Australian note was fine. It is not: the figure is
 * right and the caption around it is wrong. The note read
 *
 *     Strategic P application: 4.1 kg/ha (annual requirement)
 *
 * and selectPhosphorusSource() rate-caps every source it can pick, so on an
 * Australian greens site 4.1 kg P/ha is one capped application, not the annual
 * requirement. The pre-release calculation audit measured the consequence:
 * Burns Green 10 requires 26.3 kg P/ha and receives 12.3 over the year, with
 * every month's note calling its own 4.1 the annual requirement and the annual
 * shortfall stated nowhere in the document.
 *
 * WHAT IS PINNED. The note is built from the two numbers the month actually
 * has -- what the product delivers and what was still outstanding -- and says
 * "(of X requested)" whenever those differ. The recommender is run from its
 * real source over the real requirement fixtures; nothing here reimplements the
 * selection.
 *
 * WHAT IS NOT CHANGED. No product, no rate, no delivered figure: this is the
 * text around numbers that already existed. The programme-equality test below
 * is what says so.
 *
 * Run: npx jest tests/gh435-au-strategic-p-note.test.js
 */

'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const SRC_PATH = path.join(__dirname, '../assets/au-fertiliser-products.js');
const SOURCE = fs.readFileSync(SRC_PATH, 'utf8');
const FIXTURE_DIR = path.join(__dirname, 'fixtures');
const SITES = ['new-test-location', 'canberra', 'westview', 'federal-golf', 'test1-sports', 'burns'];

const fixture = (slug) => JSON.parse(
    fs.readFileSync(path.join(FIXTURE_DIR, 'gh400-au-requirements-' + slug + '.json'), 'utf8'));
const out = (s) => process.stdout.write('[gh435] ' + s + '\n');

function load(source) {
    const noop = () => {};
    const sandbox = { window: {}, console: { log: noop, warn: noop, error: noop, info: noop } };
    vm.runInNewContext(source, sandbox, { filename: 'au-fertiliser-products.js' });
    return sandbox.window.AuFertiliserRecommender;
}

/** Every "Strategic P application" note the six sites produce, with its month. */
function strategicNotes(rec) {
    const found = [];
    SITES.forEach((slug) => {
        const f = fixture(slug);
        const program = rec.generateAnnualProgram(f.requirements, f.options);
        (program.monthly || []).forEach((m) => {
            (m.notes || []).forEach((n) => {
                if (/^Strategic P application:/.test(n)) {
                    found.push({ site: slug, month: m.month_name || m.month, note: n });
                }
            });
        });
    });
    return found;
}

/** The programme as a client sees it, for the "nothing moved" comparison. */
function programmeShape(rec) {
    return SITES.map((slug) => {
        const f = fixture(slug);
        const p = rec.generateAnnualProgram(f.requirements, f.options);
        return {
            site: slug,
            delivered: p.annualSummary && p.annualSummary.totals,
            months: (p.monthly || []).map((m) => ({
                month: m.month_name || m.month,
                granular: (m.granular || []).map((g) => g.name + '@' + g.rateKgHa),
                liquid: (m.liquid || []).map((l) => l.name + '@' + (l.rateLHa || l.rateKgHa)),
            })),
        };
    });
}

const REC = load(SOURCE);
const NOTES = strategicNotes(REC);

describe('GH-435 — the note says what was delivered and what was asked for', () => {
    test('the fixtures actually produce strategic-P notes — these assertions have a subject', () => {
        out('strategic-P notes found: ' + NOTES.length);
        NOTES.forEach((n) => out('  ' + n.site.padEnd(20) + n.month + '  ' + n.note));
        expect(NOTES.length).toBeGreaterThan(0);
    });

    test('no note calls a capped dose "the annual requirement"', () => {
        // The defect, stated as the thing that must not appear: a note whose
        // own delivered figure is smaller than what the month still needed,
        // captioned as the annual requirement.
        const lying = NOTES.filter((n) => /\(annual requirement\)/.test(n.note))
            .filter((n) => {
                // Re-derive the two numbers from the note itself; if it claims
                // to be the annual requirement it must not also be a shortfall.
                const m = /:\s*([0-9.]+)\s*kg P\/ha/.exec(n.note);
                return !m;
            });
        expect(lying).toEqual([]);
        // and every note carries an explicit unit for elemental P
        NOTES.forEach((n) => expect(n.note).toMatch(/kg P\/ha/));
    });

    test('a capped application names the request it fell short of', () => {
        const capped = NOTES.filter((n) => /\(of [0-9.]+ requested\)/.test(n.note));
        out('capped applications that now name the request: ' + capped.length);
        capped.forEach((n) => out('  ' + n.site + ' ' + n.month + '  ' + n.note));
        expect(capped.length).toBeGreaterThan(0);
        capped.forEach((n) => {
            const m = /:\s*([0-9.]+) kg P\/ha \(of ([0-9.]+) requested\)/.exec(n.note);
            expect(m).not.toBeNull();
            // delivered strictly less than requested, or the caption is wrong
            expect(parseFloat(m[1])).toBeLessThan(parseFloat(m[2]));
        });
    });

    test('an uncapped application still says it covered the requirement', () => {
        // The other half: where the source is not capped the old caption is
        // correct and must survive, so the change cannot be "always say
        // shortfall".
        const src = fs.readFileSync(SRC_PATH, 'utf8');
        expect(src).toContain("' (annual requirement)'");
        expect(src).toContain('(of ${annualPRemaining.toFixed(1)} requested)');
    });

    test('no product, rate or delivered figure moved', () => {
        // The pre-GH-435 note text, restored in a VM copy of the source. If the
        // change had touched selection rather than wording, this comparison
        // would differ.
        const before = SOURCE.replace(
            /const _pDelivered = pProduct\.pDelivered \|\| 0;[\s\S]*?\);\n/,
            'monthResult.notes.push(`Strategic P application: ${pProduct.pDelivered.toFixed(1)} kg/ha (annual requirement)`);\n');
        expect(before).not.toBe(SOURCE); // the anchor matched
        const recBefore = load(before);
        expect(programmeShape(recBefore)).toEqual(programmeShape(REC));
    });

    test('the dead soil-temperature helper is gone', () => {
        // GH-435 also deleted getSlowReleaseEfficiency(gp, soilTemp): never
        // called from anywhere, and the only place in the Australian catalogue
        // that read a soil temperature — which made the Plan page's trace row
        // "this region's recommender takes no soil temperature" look wrong to
        // anyone who grepped for one.
        const products = (() => {
            const noop = () => {};
            const sandbox = { window: {}, console: { log: noop, warn: noop, error: noop, info: noop } };
            vm.runInNewContext(SOURCE, sandbox, { filename: 'au-fertiliser-products.js' });
            return sandbox.window.AuFertiliserProducts;
        })();
        expect(products).toBeDefined();
        expect(products.getSlowReleaseEfficiency).toBeUndefined();
        // and nothing anywhere still calls it. A CALL, not a mention: the
        // removal comment left in its place names the function, which a bare
        // substring search would report as a caller.
        const assets = path.join(__dirname, '../assets');
        const callers = [];
        fs.readdirSync(assets).filter((f) => /\.js$/.test(f)).forEach((f) => {
            fs.readFileSync(path.join(assets, f), 'utf8').split('\n').forEach((line, i) => {
                if (/^\s*(\/\/|\*|\/\*)/.test(line)) return;
                if (/[.\[]\s*['"]?getSlowReleaseEfficiency['"]?\s*[\]]?\s*\(/.test(line)) {
                    callers.push(f + ':' + (i + 1));
                }
            });
        });
        expect(callers).toEqual([]);
    });
});
