/**
 * GH-417 — the "Strategic P application" note prints what the product delivers,
 * not what was asked for. And a measurement of the counter beside it.
 *
 * WHAT WAS WRONG (audit F8). `recommendations.notes.push(...pToApply...)` in
 * prebbles-products.js printed the annual phosphorus requirement the month was
 * asked to cover, while every phosphorus source in the New Zealand catalogue is
 * rate-capped: MAP Tech at 20 kg/ha of product is 5.4 kg P/ha. The March row of
 * Test - GC - NZ - delivery therefore read "Strategic P application: 19.8 kg
 * P/ha" directly above a product line supplying 5.4, and the Couch site read
 * "25.0" above the same 5.4.
 *
 * WHAT THE PLAN EXPECTED AND WHAT IS ACTUALLY THERE. The plan (GH-417, decision
 * D-4) treats the line below the note — `recommendations.pDelivered +=
 * pToApply` — as a live counter that "marks the year's phosphorus closed", and
 * expects correcting it to raise Delivered P on the NZ greens from 10.6 towards
 * the 25 required. It does not: NOTHING READS `recommendations.pDelivered`.
 * The accumulator the pacing decisions actually use is `delivered.P` in
 * generateProgram(), built from the applied products' own analysis
 * (`delivered.P += rate * splitCount * analysis.P / 100`), and the reason a NZ
 * green receives one phosphorus application is `pApplicationMonth` — a single
 * month index — plus `excludeStarters`, which suppresses phosphorus in every
 * other month of a P-deficient site.
 *
 * The last two tests here are that measurement: the field is corrected because
 * a field called `pDelivered` must not hold a request, but the programme is
 * byte-identical either way, and the plan's premise that Delivered P would rise
 * is wrong. Both variants are built by patching the recommender's source in a
 * fresh VM, so the comparison is against the real old code rather than a
 * transcription of it (the pattern from tests/gh410-*.test.js).
 */

'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const SOURCE = fs.readFileSync(path.join(__dirname, '../assets/prebbles-products.js'), 'utf8');

const NOTE_NOW = 'recommendations.notes.push(`${notePrefix}: ${pActuallyDelivered.toFixed(1)} kg P/ha` +';
const NOTE_BEFORE = 'recommendations.notes.push(`${notePrefix}: ${pToApply.toFixed(1)} kg P/ha`);';
const COUNTER_NOW = 'recommendations.pDelivered = Math.round((pDelivered + pActuallyDelivered) * 10) / 10;';
const COUNTER_BEFORE = 'recommendations.pDelivered = Math.round((pDelivered + (shouldApplyP ? pToApply : 0)) * 10) / 10;';

/** Apply [anchor, replacement] pairs; each anchor must occur exactly once. */
function patch(source, edits) {
    let src = source;
    edits.forEach(([anchor, replacement]) => {
        const count = src.split(anchor).length - 1;
        if (count !== 1) throw new Error('anchor matched ' + count + ' times: ' + anchor.slice(0, 70));
        src = src.replace(anchor, replacement);
    });
    return src;
}

function load(source) {
    const noop = () => {};
    const sandbox = { window: {}, console: { log: noop, warn: noop, error: noop, info: noop } };
    vm.runInNewContext(source, sandbox, { filename: 'prebbles-products.js' });
    return sandbox.window.PrebbleRecommender;
}

// A New Zealand golf green with a phosphorus requirement well past what one
// capped application can supply — the shape of Test - GC - NZ - delivery, whose
// March note the audit read: annual P 25 kg/ha, soil P below the deficiency
// threshold so the single-strategic-application path is the one taken.
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const GP = [0.95, 0.92, 0.80, 0.60, 0.35, 0.18, 0.12, 0.20, 0.45, 0.70, 0.88, 0.95];
const SEASONS = ['summer', 'summer', 'autumn', 'autumn', 'autumn', 'winter',
    'winter', 'winter', 'spring', 'spring', 'spring', 'summer'];

function calendar() {
    const annualN = 250, annualP = 25, annualK = 143.8;
    const gpSum = GP.reduce((a, b) => a + b, 0);
    return {
        meta: { hemisphere: 'south', latitude: -36.9 },
        soil: { methodology: 'ammonium_acetate' },
        program: {
            monthly: MONTHS.map((m, i) => ({
                month: m, month_name: m, month_num: i + 1, gp: GP[i], season: SEASONS[i],
                N: +(annualN * GP[i] / gpSum).toFixed(2),
                P: +(annualP * GP[i] / gpSum).toFixed(2),
                K: +(annualK * GP[i] / gpSum).toFixed(2)
            }))
        }
    };
}

const CONTEXT = {
    surfaceType: 'golf_greens',
    methodology: 'ammonium_acetate',
    soilCEC: 6,
    irrigationFrequency: 'moderate',
    soilTemp: 14,
    latitude: -36.9,
    hemisphere: 'south',
    soilPpm: { P: 6, K: 90, Ca: 700, Mg: 100, S: 20 },
    pDeficient: true,
    tissueStatus: null,
    establishment: false, seeding: false, renovation: false
};

function run(source) {
    const rec = load(source);
    const program = rec.generateProgram(calendar(), CONTEXT);
    if (program.error) throw new Error('recommender refused the fixture: ' + program.error);
    return program;
}

function strategicNotes(program) {
    const out = [];
    (program.monthly || []).forEach((m) => {
        (m.notes || []).forEach((n) => {
            if (/Strategic P application|P supplement/.test(n)) out.push({ month: m.month, note: n });
        });
    });
    return out;
}

function deliveredP(program) {
    return (program.monthly || []).reduce((sum, m) => {
        return sum + [].concat(m.granular || [], m.liquid || []).reduce((s, p) => {
            const rate = p.rateKgHa || p.rateLHa || 0;
            return s + rate * (p.splitCount || 1) * ((p.analysis && p.analysis.P) || 0) / 100;
        }, 0);
    }, 0);
}

describe('GH-417 — the note names what the product delivers', () => {
    const now = run(SOURCE);
    const before = run(patch(SOURCE, [[NOTE_NOW + '\n                        (shortfall ? ` (of ${pToApply.toFixed(1)} requested)` : \'\'));', NOTE_BEFORE]]));

    test('the fixture reproduces the audit\'s shape — one strategic application, capped well below the request', () => {
        const notes = strategicNotes(now);
        expect(notes.length).toBeGreaterThan(0);
        process.stdout.write('[gh417] note now:    ' + JSON.stringify(notes) + '\n');
        process.stdout.write('[gh417] note before: ' + JSON.stringify(strategicNotes(before)) + '\n');
    });

    test('the printed figure equals the phosphorus the month\'s products actually carry', () => {
        const notes = strategicNotes(now);
        notes.forEach(({ month, note }) => {
            const printed = parseFloat(/:\s*([0-9.]+)\s*kg P\/ha/.exec(note)[1]);
            const m = now.monthly.find((x) => x.month === month);
            const carried = [].concat(m.granular || [], m.liquid || []).reduce((s, p) => {
                const rate = p.rateKgHa || p.rateLHa || 0;
                return s + rate * (p.splitCount || 1) * ((p.analysis && p.analysis.P) || 0) / 100;
            }, 0);
            expect(printed).toBeLessThanOrEqual(Math.round(carried * 10) / 10 + 0.05);
        });
    });

    test('the request is still stated, so the shortfall is visible rather than rounded away', () => {
        const shortfallNotes = strategicNotes(now).filter((n) => /requested/.test(n.note));
        expect(shortfallNotes.length).toBeGreaterThan(0);
        expect(shortfallNotes[0].note).toMatch(/^Strategic P application: [0-9.]+ kg P\/ha \(of [0-9.]+ requested\)$/);
    });

    test('the old note over-stated it — the figure moved down, on the same programme', () => {
        const nowFig = parseFloat(/:\s*([0-9.]+)/.exec(strategicNotes(now)[0].note)[1]);
        const beforeFig = parseFloat(/:\s*([0-9.]+)/.exec(strategicNotes(before)[0].note)[1]);
        expect(beforeFig).toBeGreaterThan(nowFig);
    });
});

describe('GH-417 — the pDelivered field, measured', () => {
    test('nothing reads it: the programme is identical with the old counter restored', () => {
        const now = run(SOURCE);
        const oldCounter = run(patch(SOURCE, [[COUNTER_NOW, COUNTER_BEFORE]]));
        expect(deliveredP(oldCounter)).toBeCloseTo(deliveredP(now), 6);
        expect(JSON.stringify(oldCounter.annualSummary.products))
            .toBe(JSON.stringify(now.annualSummary.products));
        process.stdout.write('[gh417] delivered P, corrected counter: ' + deliveredP(now).toFixed(2) +
            ' | old counter: ' + deliveredP(oldCounter).toFixed(2) + '\n');
    });

    test('the annual accumulator that IS read is built from the products, not from that field', () => {
        expect(SOURCE).toMatch(/delivered\.P \+= rate \* splitCount \* \(analysis\.P \|\| 0\) \/ 100;/);
        // The single-application behaviour the audit attributed to the counter.
        expect(SOURCE).toMatch(/isPApplicationMonth: index === pApplicationMonth,/);
        expect(SOURCE).toMatch(/excludeStarters: soilPDeficient && index !== pApplicationMonth,/);
    });

    test('the field no longer records a request', () => {
        expect(SOURCE).toContain(COUNTER_NOW);
        expect(SOURCE).not.toContain(COUNTER_BEFORE);
    });
});
