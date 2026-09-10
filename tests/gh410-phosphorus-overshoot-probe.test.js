/**
 * GH-410 investigation probe — where does the extra phosphorus come from?
 *
 * Recorded cause, from GH-400's report: "the phosphorus scorer compares a
 * product's MONTHLY delivery against the ANNUAL requirement". Reading the code
 * that does not hold: `pRequired` reaches the scorer as `netP`
 * (au-fertiliser-products.js:6075), which is a single month's slice already
 * capped by whatever is left of the annual budget —
 *
 *     netP = min( month.P - activeP,  annualTargets.P - delivered.P )
 *
 * — so a monthly figure is compared against a monthly figure, and the annual
 * cap is a guard against overshoot rather than its cause.
 *
 * The overshoot itself is real and measured live (New test - location: P
 * delivered 18.7 against 14.2 required). This file exists to find out what
 * actually produces it, by running the real recommender over the real
 * requirement rows and reading back what it chose, month by month.
 *
 * It asserts only what it has established. Where it is measuring rather than
 * pinning, it says so.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const SOURCE = fs.readFileSync(path.join(__dirname, '../assets/au-fertiliser-products.js'), 'utf8');

function loadRecommender() {
    const noop = () => {};
    const sandbox = { window: {}, console: { log: noop, warn: noop, error: noop, info: noop } };
    vm.runInNewContext(SOURCE, sandbox, { filename: 'au-fertiliser-products.js' });
    return sandbox.window.AuFertiliserRecommender;
}

const rec = loadRecommender();
const FIXTURE_DIR = path.join(__dirname, 'fixtures');
const SITES = ['new-test-location', 'burns', 'canberra', 'federal-golf', 'test1-sports', 'westview'];

const fixture = (slug) => JSON.parse(
    fs.readFileSync(path.join(FIXTURE_DIR, 'gh400-au-requirements-' + slug + '.json'), 'utf8'));

const round1 = (n) => Math.round(n * 10) / 10;

function summarise(slug) {
    const fx = fixture(slug);
    const prog = rec.generateAnnualProgram(fx.requirements, fx.options);
    const requiredP = fx.requirements.reduce((a, r) => a + (r.P || 0), 0);
    // The recommender publishes these at the top level: targets / delivered /
    // balance, plus the twelve monthly picks.
    return {
        slug,
        requiredP: round1(requiredP),
        targetP: round1((prog.targets && prog.targets.P) || 0),
        deliveredP: round1((prog.delivered && prog.delivered.P) || 0),
        balanceP: round1((prog.balance && prog.balance.P) || 0),
        prog,
        fx,
    };
}

describe('GH-410 probe — phosphorus delivered against phosphorus required', () => {
    const results = SITES.map(summarise);

    test('measure every site, worst overshoot first', () => {
        const sorted = results.slice().sort((a, b) => b.gap - a.gap);
        process.stdout.write('\n[gh410] site                 required  delivered   gap\n');
        sorted.forEach((r) => {
            process.stdout.write('[gh410] ' + r.slug.padEnd(22)
                + String(r.requiredP).padStart(6)
                + String(r.deliveredP).padStart(10)
                + String(r.gap).padStart(7) + '\n');
        });
        // Measurement, not a pin: every site produced a number.
        expect(results.every((r) => Number.isFinite(r.deliveredP))).toBe(true);
    });

    test('measure the gap on every site', () => {
        process.stdout.write('\n[gh410] site                  required  target  delivered  balance   gap\n');
        results.slice().sort((x, y) => (y.deliveredP - y.requiredP) - (x.deliveredP - x.requiredP))
            .forEach((r) => {
                process.stdout.write('[gh410] ' + r.slug.padEnd(22)
                    + String(r.requiredP).padStart(6)
                    + String(r.targetP).padStart(8)
                    + String(r.deliveredP).padStart(11)
                    + String(r.balanceP).padStart(9)
                    + String(round1(r.deliveredP - r.requiredP)).padStart(7) + '\n');
            });
        expect(results.every((r) => Number.isFinite(r.deliveredP))).toBe(true);
    });

    test('month by month on the worst site: what was needed, what was picked', () => {
        const worst = results.slice()
            .sort((x, y) => (y.deliveredP - y.requiredP) - (x.deliveredP - x.requiredP))[0];
        process.stdout.write('\n[gh410] ' + worst.slug + ' — required ' + worst.requiredP
            + ', delivered ' + worst.deliveredP + '\n');
        const monthly = worst.prog.monthly || [];
        monthly.forEach((m, i) => {
            const need = (worst.fx.requirements[i] || {}).P;
            const picks = []
                .concat(m.granular || [], m.liquid || [], m.products || [])
                .filter(Boolean)
                .map((p) => {
                    const nm = (p.product && p.product.name) || p.name || p.brandName || '?';
                    const an = (p.product && p.product.analysis) || p.analysis || {};
                    const del = (p.delivers && p.delivers.P);
                    return nm + ' [P%=' + (an.P != null ? an.P : '?')
                        + ' rate=' + (p.rate || p.rateKgHa || p.rateLHa || '?')
                        + ' releases=' + (p.monthsCovered || p.releaseMonths || 1)
                        + ' declaresP=' + (del != null ? round1(del) : '-') + ']';
                });
            process.stdout.write('[gh410]   ' + String(m.month_name || i + 1).padEnd(4)
                + ' needP=' + String(need == null ? '-' : need).padStart(5)
                + '  ' + (picks.join('  ') || '(nothing)') + '\n');
        });
        expect(monthly.length).toBe(12);
    });

    test('the recorded cause does not survive reading: pRequired is a monthly slice', () => {
        // The annual cap is already applied where netP is built.
        expect(SOURCE).toMatch(/const netP = Math\.min\(/);
        expect(SOURCE).toMatch(/Math\.max\(0, annualTargets\.P - delivered\.P\)/);
        // And the scorer's own input is that monthly figure.
        expect(SOURCE).toMatch(/const pRequired = monthData\.P \|\| 0;/);
        expect(SOURCE).toMatch(/const pDeliveryRatio = effectiveMonthlyP \/ pRequired;/);
    });

    test('the slow-release division is the candidate: a dose applied once, scored as a share', () => {
        // effectiveMonthlyP spreads one application across the release window,
        // but the application itself lands whole in one month.
        expect(SOURCE).toMatch(/const effectiveMonthlyP = pAtRate \/ monthsCovered;/);
        expect(SOURCE).toMatch(/const pAtRate = actualRate \* pPct;/);
    });
});
