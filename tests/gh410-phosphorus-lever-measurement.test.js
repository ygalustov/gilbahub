/**
 * GH-410 planning measurement — which lever moves phosphorus overshoot, and
 * what it costs the sites that currently under-deliver.
 *
 * Companion to gh410-phosphorus-overshoot-probe.test.js, which established
 * WHERE the extra phosphorus comes from (an N/K carrier chosen for its N and K,
 * whose P rides along). This file measures the candidate remedies the plan
 * has to choose between, on the same six real requirement fixtures, without
 * touching production code: each variant is a small text patch applied to the
 * recommender's source in a fresh VM context, and every patch asserts that its
 * anchor matched exactly once so a silent no-op cannot masquerade as "no
 * effect".
 *
 * Nothing here is a pin on desired behaviour. The assertions guard the
 * measurement apparatus (anchors matched, every site produced a number); the
 * numbers themselves are printed for the plan to quote.
 *
 * Run: npx jest tests/gh410-phosphorus-lever-measurement.test.js
 */

'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const SOURCE = fs.readFileSync(path.join(__dirname, '../assets/au-fertiliser-products.js'), 'utf8');
const STATUS_SOURCE = fs.readFileSync(path.join(__dirname, '../assets/nutrient-balance-status.js'), 'utf8');
const FIXTURE_DIR = path.join(__dirname, 'fixtures');
const SITES = ['new-test-location', 'canberra', 'westview', 'federal-golf', 'test1-sports', 'burns'];

const fixture = (slug) => JSON.parse(
    fs.readFileSync(path.join(FIXTURE_DIR, 'gh400-au-requirements-' + slug + '.json'), 'utf8'));
const r1 = (n) => Math.round(n * 10) / 10;
const out = (s) => process.stdout.write(s + '\n');

/** Apply [anchor, replacement] pairs; each anchor must occur exactly once. */
function patch(source, edits) {
    let src = source;
    edits.forEach(([anchor, replacement]) => {
        const count = src.split(anchor).length - 1;
        if (count !== 1) throw new Error('anchor matched ' + count + ' times: ' + anchor.slice(0, 60));
        src = src.replace(anchor, replacement);
    });
    return src;
}

function load(source) {
    const noop = () => {};
    const sandbox = { window: {}, console: { log: noop, warn: noop, error: noop, info: noop } };
    vm.runInNewContext(source, sandbox, { filename: 'au-fertiliser-products.js' });
    return { rec: sandbox.window.AuFertiliserRecommender, products: sandbox.window.AuFertiliserProducts };
}

// ---------------------------------------------------------------------------
// Trace patch: expose every granular candidate's score components through
// context.__trace. Test-only; the anchor is the granular composite's tail.
// ---------------------------------------------------------------------------
const TRACE_ANCHOR = 'autumnKBonus + greensPenalty + muldersModifier;';
const TRACE_EDIT = [TRACE_ANCHOR, TRACE_ANCHOR +
    '\n                if (context.__trace) context.__trace.push({ name: product.name, npk: (product.analysis.N||0)+"-"+(product.analysis.P||0)+"-"+(product.analysis.K||0), release: product.release, monthsCovered, actualRate, nAtRate, pAtRate, kAtRate, effectiveMonthlyP, kScore, releaseScore, nScore, pScore, autumnKBonus, greensPenalty, muldersModifier, totalScore });'];

// ---------------------------------------------------------------------------
// Candidate levers, each as a source patch.
// ---------------------------------------------------------------------------
const SEVERE_ANCHOR = 'pScore = -20; // Severe P overshoot - penalize';
const CLEANK_ANCHOR = 'if (kRequired <= 0) {\n                const cleanK = viableProducts.filter(e => effectiveMonthlyOf(e, \'K\') <= CLEAN_NUTRIENT_KGHA);\n                if (cleanK.length > 0) viableProducts = cleanK;\n            }';
const KCHECK_TAIL_ANCHOR = '                    // GH-336-DEBUG: log whether granular was accepted or\n';
const WEIGHT_ANCHOR = 'nScore * 0.25 + pScore * 0.35 +';

const VARIANTS = {
    baseline: [],
    // A. graded penalty beyond 3x, same magnitudes nScore already uses
    'A-graded-penalty': [[SEVERE_ANCHOR, 'pScore = pDeliveryRatio > 5 ? -120 : -80;']],
    // B. penalty proportional to the ratio, capped where nScore caps
    'B-proportional-penalty': [[SEVERE_ANCHOR, 'pScore = Math.max(-120, -20 * pDeliveryRatio);']],
    // C. reweight P in the composite (0.35 -> 0.50)
    'C-reweight-0.50': [[WEIGHT_ANCHOR, 'nScore * 0.25 + pScore * 0.50 +']],
    // D. GH-329 pattern: when P is needed, restrict to candidates that are not
    //    "severe" (> 3x this month's net P) if any such candidate exists
    'D-prefer-not-severe': [[CLEANK_ANCHOR, CLEANK_ANCHOR +
        '\n            if (pRequired > 0) {\n                const notSevereP = viableProducts.filter(e => effectiveMonthlyOf(e, \'P\') <= Math.max(CLEAN_NUTRIENT_KGHA, pRequired * 3));\n                if (notSevereP.length > 0) viableProducts = notSevereP;\n            }']],
    // E. P overshoot rejection in generateAnnualProgram, mirroring the N (2.5x)
    //    and K (3-6x) checks that already exist there. P had none.
    'E-reject-over-3x': [[KCHECK_TAIL_ANCHOR,
        '                    if (useThisGranular && granularRec && netP > 0) {\n                        const _pmc = Math.max(1, Math.ceil(granularRec.releaseWeeks / 4));\n                        const pOvershoot = (granularRec.pDelivered / _pmc) / netP;\n                        if (pOvershoot > 3.0) {\n                            useThisGranular = false;\n                            monthResult.notes.push(`Granular skipped - would over-deliver P by ${Math.round((pOvershoot - 1) * 100)}%`);\n                        }\n                    }\n' + KCHECK_TAIL_ANCHOR]],
};
VARIANTS['D+A'] = VARIANTS['D-prefer-not-severe'].concat(VARIANTS['A-graded-penalty']);

// ---------------------------------------------------------------------------
// Levers suggested by the trace (part C), not by the brief.
// ---------------------------------------------------------------------------
// F. Score the application that will actually be made. GH-337 scaled the
//    APPLIED rate by monthsCovered (nTarget = nRequired * monthsCovered) but
//    the scorer still prices every candidate at max(rateNeeded, labelMin)
//    with rateNeeded = nRequired / nPct — one month's worth. For a 2-month
//    product that is a different application from the one pushed onto the
//    programme (Country Club IV 18-9-18: scored at 100 kg/ha, applied at 161).
const SCORER_RATE_ANCHOR = 'const actualRate = Math.max(rateNeeded, labelRates.min);';
VARIANTS['F-score-applied-rate'] = [[SCORER_RATE_ANCHOR,
    'const actualRate = Math.min(labelRates.max, Math.max(rateNeeded * monthsCovered, labelRates.min));']];

// G. Cap pScore against the REMAINING ANNUAL P budget: a dose that exceeds
//    what is left of the year cannot be "perfect" however well it matches one
//    month's slice. Same bands the monthly comparison already uses.
const SELECT_CALL_ANCHOR = 'const granularRec = this.selectNitrogenSource(granular, { N: netN, K: netK, P: netP }, {\n                        isGreens, ';
const SCORE5_ANCHOR = '                // SCORE 5: Autumn K boost for winter hardening\n';
VARIANTS['G-annual-budget-cap'] = [
    [SELECT_CALL_ANCHOR, 'const granularRec = this.selectNitrogenSource(granular, { N: netN, K: netK, P: netP }, {\n                        annualPRemaining: Math.max(0, annualTargets.P - delivered.P),\n                        isGreens, '],
    [SCORE5_ANCHOR,
        '                if (pPct > 0 && typeof context.annualPRemaining === \'number\') {\n' +
        '                    const pBudgetRatio = context.annualPRemaining > 0 ? pAtRate / context.annualPRemaining : Infinity;\n' +
        '                    let budgetScore = pScore;\n' +
        '                    if (pBudgetRatio > 3.0) budgetScore = -20; else if (pBudgetRatio > 2.0) budgetScore = 10; else if (pBudgetRatio > 1.5) budgetScore = 30;\n' +
        '                    if (budgetScore < pScore) pScore = budgetScore;\n' +
        '                }\n' + SCORE5_ANCHOR],
];
VARIANTS['F+G'] = VARIANTS['F-score-applied-rate'].concat(VARIANTS['G-annual-budget-cap']);

// H. Bound the delivery itself: reject a granular whose whole P dose exceeds
//    1.5x what is left of the annual budget (2 kg floor so a tiny remainder
//    does not veto every carrier). Mirrors the N/K rejection checks.
VARIANTS['H-reject-over-budget'] = [[KCHECK_TAIL_ANCHOR,
    '                    if (useThisGranular && granularRec) {\n                        const _rem = Math.max(0, annualTargets.P - delivered.P);\n                        if (granularRec.pDelivered > Math.max(2, _rem * 1.5)) {\n                            useThisGranular = false;\n                            monthResult.notes.push(`Granular skipped - P dose ${granularRec.pDelivered} kg/ha exceeds remaining annual P ${_rem.toFixed(1)} kg/ha`);\n                        }\n                    }\n' + KCHECK_TAIL_ANCHOR]];
VARIANTS['F+H'] = VARIANTS['F-score-applied-rate'].concat(VARIANTS['H-reject-over-budget']);
VARIANTS['F+G+H'] = VARIANTS['F+G'].concat(VARIANTS['H-reject-over-budget']);

function run(variantName, slug) {
    const { rec } = load(patch(SOURCE, VARIANTS[variantName]));
    const fx = fixture(slug);
    const prog = rec.generateAnnualProgram(fx.requirements, fx.options);
    const req = { N: 0, P: 0, K: 0 };
    fx.requirements.forEach((m) => { req.N += m.N || 0; req.P += m.P || 0; req.K += m.K || 0; });
    return { slug, fx, prog, req, del: prog.delivered };
}

function picksOf(m) {
    return [].concat(m.granular || [], m.liquid || []).map((p) =>
        p.name + ' ' + (p.npk || '') + ' @' + (p.rateKgHa || p.rate) + ' P=' + r1((p.delivers || {}).P || 0));
}

describe('GH-410 lever measurement', () => {

    test('A. the granular catalogue each surface can choose from (N >= 10%, not herbicide, label rates for surface)', () => {
        const { rec, products } = load(SOURCE);
        ['golf_greens', 'soccer', 'lawns'].forEach((surface) => {
            const granular = rec.getProductsForSurface(surface, 'all', 'all').granular;
            out('\n[gh410-A] ' + surface + ' — granular N carriers available to selectNitrogenSource');
            granular.forEach((p) => {
                const n = p.analysis?.N || 0;
                if (n < 10) return;
                const uc = (p.useCase || '').toLowerCase();
                if (uc.includes('pre_emergent') || uc.includes('herbicide')) return;
                const rates = rec.getProductRatesForSurface(p, surface);
                if (!rates) return;
                out('[gh410-A]   ' + p.name.padEnd(40) + String(n + '-' + (p.analysis.P || 0) + '-' + (p.analysis.K || 0)).padEnd(14)
                    + String(p.release || 'standard').padEnd(12) + ' wk=' + String(p.weeks || '-').padEnd(3)
                    + ' rate ' + rates.min + '-' + rates.max + ' kg/ha  sgn=' + p.sgn);
            });
        });
        expect(products.granular.length).toBeGreaterThan(0);
    });

    test('B. baseline, every site, month by month: what was needed net, what was picked, what P it carried', () => {
        SITES.forEach((slug) => {
            const r = run('baseline', slug);
            out('\n[gh410-B] ' + slug + ' (' + r.fx.options.surfaceType + ', ' + r.fx.options.methodology + ')  required N/P/K '
                + r1(r.req.N) + '/' + r1(r.req.P) + '/' + r1(r.req.K) + '  delivered ' + r1(r.del.N) + '/' + r1(r.del.P) + '/' + r1(r.del.K));
            r.prog.monthly.forEach((m, i) => {
                const nr = m.netRequirements || {};
                out('[gh410-B]   ' + String(m.month_name).padEnd(4) + ' gp=' + String(r1(m.gp * 100)).padStart(3)
                    + ' net N/P/K=' + r1(nr.N) + '/' + r1(nr.P) + '/' + r1(nr.K) + '  ' + (picksOf(m).join(' | ') || '-')
                    + (m.notes && m.notes.length ? '   {' + m.notes.join('; ') + '}' : ''));
            });
            expect(Number.isFinite(r.del.P)).toBe(true);
        });
    });

    test('C. score breakdown of every viable granular candidate on the months that over-delivered P', () => {
        const { rec } = load(patch(SOURCE, [TRACE_EDIT]));
        const cases = [
            ['new-test-location', 0], ['new-test-location', 10],
            ['canberra', 0], ['canberra', 2], ['canberra', 9],
            ['westview', 0], ['federal-golf', 0], ['burns', 0], ['test1-sports', 0],
        ];
        const base = {};
        SITES.forEach((s) => { base[s] = run('baseline', s); });
        cases.forEach(([slug, idx]) => {
            const r = base[slug];
            const m = r.prog.monthly[idx];
            const nr = m.netRequirements;
            const surface = r.fx.options.surfaceType;
            const isGreens = ['greens', 'golf_greens', 'bowling_greens'].includes(surface);
            const granular = rec.getProductsForSurface(surface, 'all', 'all').granular;
            const trace = [];
            const pick = rec.selectNitrogenSource(granular, { N: nr.N, K: nr.K, P: nr.P }, {
                isGreens, surfaceType: surface, season: m.season, monthNum: idx + 1, hemisphere: 'south',
                soilPSufficient: r.prog.targets.P <= 0, muldersFlags: {}, __trace: trace,
            });
            trace.sort((a, b) => b.totalScore - a.totalScore);
            out('\n[gh410-C] ' + slug + ' ' + m.month_name + '  net N/P/K=' + r1(nr.N) + '/' + r1(nr.P) + '/' + r1(nr.K)
                + '  picked: ' + (pick ? pick.name + ' @' + pick.rateKgHa + ' P=' + pick.pDelivered : 'none') + '  (' + trace.length + ' viable)');
            out('[gh410-C]   ' + 'candidate'.padEnd(36) + 'npk'.padEnd(11) + 'rel'.padEnd(11) + 'rate'.padStart(5) + ' mo' + '   N'.padStart(6) + '   P'.padStart(6) + '   K'.padStart(6)
                + '  kS'.padStart(6) + ' relS'.padStart(6) + '   nS'.padStart(6) + '   pS'.padStart(6) + ' autK'.padStart(6) + ' grn'.padStart(6) + ' total'.padStart(7));
            trace.slice(0, 8).forEach((t) => {
                out('[gh410-C]   ' + t.name.slice(0, 35).padEnd(36) + t.npk.padEnd(11) + String(t.release || 'std').padEnd(11) + String(t.actualRate).padStart(5) + String(t.monthsCovered).padStart(3)
                    + String(r1(t.nAtRate)).padStart(6) + String(r1(t.pAtRate)).padStart(6) + String(r1(t.kAtRate)).padStart(6)
                    + String(t.kScore).padStart(6) + String(t.releaseScore).padStart(6) + String(t.nScore).padStart(6) + String(t.pScore).padStart(6)
                    + String(t.autumnKBonus).padStart(6) + String(t.greensPenalty).padStart(6) + String(r1(t.totalScore)).padStart(7));
            });
            expect(trace.length).toBeGreaterThan(0);
        });
    });

    test('D. every lever on every site: N/P/K delivered against required, before and after', () => {
        const names = Object.keys(VARIANTS);
        const table = {};
        SITES.forEach((slug) => {
            table[slug] = {};
            names.forEach((v) => {
                const r = run(v, slug);
                table[slug][v] = r;
            });
        });
        names.forEach((v) => {
            out('\n[gh410-D] variant ' + v);
            out('[gh410-D]   ' + 'site'.padEnd(20) + 'reqN'.padStart(7) + 'delN'.padStart(7) + 'gapN'.padStart(7)
                + 'reqP'.padStart(7) + 'delP'.padStart(7) + 'gapP'.padStart(7) + 'reqK'.padStart(7) + 'delK'.padStart(7) + 'gapK'.padStart(7) + '   granular picks');
            SITES.forEach((slug) => {
                const r = table[slug][v];
                const gran = r.prog.monthly.map((m) => (m.granular || []).map((g) => g.name.replace('Country Club IV ', 'CCIV ').replace('Sportsmaster WSF ', 'WSF ').replace(/ \(.*\)/, '') + '@' + g.rateKgHa + '(P' + r1((g.delivers || {}).P || 0) + ')')).flat();
                out('[gh410-D]   ' + slug.padEnd(20)
                    + String(r1(r.req.N)).padStart(7) + String(r1(r.del.N)).padStart(7) + String(r1(r.del.N - r.req.N)).padStart(7)
                    + String(r1(r.req.P)).padStart(7) + String(r1(r.del.P)).padStart(7) + String(r1(r.del.P - r.req.P)).padStart(7)
                    + String(r1(r.req.K)).padStart(7) + String(r1(r.del.K)).padStart(7) + String(r1(r.del.K - r.req.K)).padStart(7)
                    + '   ' + gran.join(', '));
            });
        });
        // Apparatus guard: every variant produced a finite number on every site.
        names.forEach((v) => SITES.forEach((slug) => {
            expect(Number.isFinite(table[slug][v].del.P)).toBe(true);
        }));
    });

    test('B2. month by month under the trace-suggested levers, on the three greens sites that over-deliver', () => {
        ['F-score-applied-rate', 'G-annual-budget-cap', 'F+G', 'F+G+H'].forEach((v) => {
            ['new-test-location', 'canberra', 'federal-golf'].forEach((slug) => {
                const r = run(v, slug);
                out('\n[gh410-B2] ' + v + ' / ' + slug + '  required N/P/K ' + r1(r.req.N) + '/' + r1(r.req.P) + '/' + r1(r.req.K)
                    + '  delivered ' + r1(r.del.N) + '/' + r1(r.del.P) + '/' + r1(r.del.K));
                r.prog.monthly.forEach((m) => {
                    const nr = m.netRequirements || {};
                    const picks = picksOf(m);
                    if (!picks.length && !(m.notes || []).some((n) => /skipped/.test(n))) return;
                    out('[gh410-B2]   ' + String(m.month_name).padEnd(4) + ' net N/P/K=' + r1(nr.N) + '/' + r1(nr.P) + '/' + r1(nr.K) + '  ' + (picks.join(' | ') || '-')
                        + ((m.notes || []).filter((n) => /skipped/.test(n)).map((n) => '   {' + n + '}').join('')));
                });
                expect(Number.isFinite(r.del.P)).toBe(true);
            });
        });
    });

    test('F. GH-411: which classify() branch each AU site\'s N/P/K row actually takes, from the persisted programme', () => {
        // The persisted programme carries soil ppm, bulk density, depth, the
        // resolved range and removal — exactly what the Plan page hands to
        // classify(). Read from the dev DB snapshot filed with the Hoxton v6
        // work so nothing here needs a live stack.
        const snapPath = path.join(__dirname, '../files/fixes/26-08-17-hoxton-v6/dev-db-snapshot-2026-09-10.sql');
        const snap = fs.readFileSync(snapPath, 'utf8');
        const sandbox = { window: {}, module: { exports: {} } };
        vm.runInNewContext(STATUS_SOURCE, sandbox, { filename: 'nutrient-balance-status.js' });
        const status = sandbox.window.GAIP_NutrientBalanceStatus;

        function persistedGaip(siteId) {
            const marker = "'" + siteId + "','gaip','";
            const at = snap.indexOf(marker);
            if (at < 0) return null;
            let i = at + marker.length;
            let raw = '';
            while (i < snap.length) {
                const ch = snap[i];
                if (ch === '\\') { raw += snap[i + 1] === 'n' ? '\n' : snap[i + 1] === 'r' ? '\r' : snap[i + 1]; i += 2; continue; }
                if (ch === "'") break;
                raw += ch; i++;
            }
            return JSON.parse(raw);
        }

        out('\n[gh410-F] site                 nut  ppm     range(ppm)   removal miss  req     del    pct  branch    label');
        const rows = [];
        SITES.forEach((slug) => {
            const r = run('baseline', slug);
            const cfg = persistedGaip(r.fx.siteId);
            const np = cfg && cfg.nutritionProgram;
            if (!np) { out('[gh410-F] ' + slug.padEnd(20) + ' (no persisted programme in snapshot)'); return; }
            const soil = np.soil || {};
            const ppm = soil.ppm || {};
            const rangeMap = np.annual_totals_range || {};
            const removalMap = np.annual_removal || {};
            const missing = np.missing_soil_data || [];
            const missingMap = Array.isArray(missing) ? Object.fromEntries(missing.map((n) => [n, true])) : missing;
            const required = status.annualRequired(np);
            ['N', 'P', 'K'].forEach((n) => {
                const req = required[n];
                const del = r.del[n];
                const c = status.classify({
                    nutrient: n, required: req, delivered: del,
                    currentPpm: ppm[n], removal: removalMap[n], range: rangeMap[n],
                    bulkDensity: soil.bulkDensity, soilDepth: soil.soilDepth, missingSoilData: !!missingMap[n],
                });
                const branch = c.statusClass === 'no-data' ? 'no-data' : (c.canCompute ? 'range' : 'pct');
                const pct = req > 0 ? Math.round(del / req * 100) : null;
                const rg = rangeMap[n] ? rangeMap[n].min + '-' + rangeMap[n].max : '-';
                out('[gh410-F] ' + slug.padEnd(20) + n.padEnd(4) + String(ppm[n] == null ? '-' : ppm[n]).padStart(6) + '  ' + rg.padEnd(12)
                    + String(removalMap[n] == null ? '-' : removalMap[n]).padStart(6) + '  ' + String(!!missingMap[n]).padEnd(5)
                    + String(r1(req)).padStart(6) + String(r1(del)).padStart(8) + String(pct == null ? '-' : pct + '%').padStart(6)
                    + '  ' + branch.padEnd(8) + '  ' + c.statusLabel + (c.canCompute ? '  (balance ' + r1(c.diff) + ' vs ' + c.rangeDisplay + ')' : ''));
                rows.push({ slug, n, branch, label: c.statusLabel, pct });
            });
        });
        expect(rows.length).toBeGreaterThan(0);
    });

    test('G-only: the four sites whose totals did not move are byte-identical month by month, and the disclosure note would fire where measured', () => {
        const unchanged = ['westview', 'federal-golf', 'test1-sports', 'burns'];
        unchanged.forEach((slug) => {
            const a = run('baseline', slug).prog.monthly;
            const b = run('G-annual-budget-cap', slug).prog.monthly;
            expect(JSON.stringify(b)).toBe(JSON.stringify(a));
        });
        // Where a granular's whole P dose exceeds the remaining annual budget by
        // more than 0.5 kg under G (the note threshold proposed in the plan).
        SITES.forEach((slug) => {
            const r = run('G-annual-budget-cap', slug);
            let deliveredP = 0;
            r.prog.monthly.forEach((m) => {
                (m.granular || []).forEach((g) => {
                    if (/Strategic P/.test(g.notes || '')) { deliveredP += g.delivers.P; return; }
                    const remaining = Math.max(0, r.req.P - deliveredP);
                    const beyond = g.delivers.P - remaining;
                    if (beyond > 0.5) out('[gh410-G] ' + slug.padEnd(20) + m.month_name + '  ' + g.name + ' P=' + r1(g.delivers.P) + ' remaining=' + r1(remaining) + ' beyond=' + r1(beyond));
                    deliveredP += g.delivers.P;
                });
                (m.liquid || []).forEach((l) => { deliveredP += (l.delivers || {}).P || 0; });
            });
        });
    });

    test('E. GH-411: the fallback-branch label each site/nutrient gets today, and its completion %', () => {
        const sandbox = { window: {}, module: { exports: {} } };
        vm.runInNewContext(STATUS_SOURCE, sandbox, { filename: 'nutrient-balance-status.js' });
        const status = sandbox.window.GAIP_NutrientBalanceStatus;
        out('\n[gh410-E] fallback branch (no range / no soil): pct = delivered/required, label today');
        const rows = [];
        SITES.forEach((slug) => {
            const r = run('baseline', slug);
            ['N', 'P', 'K'].forEach((n) => {
                const c = status.classify({ nutrient: n, required: r.req[n], delivered: r.del[n] });
                const pct = r.req[n] > 0 ? Math.round(r.del[n] / r.req[n] * 100) : null;
                rows.push({ slug, n, req: r1(r.req[n]), del: r1(r.del[n]), pct, label: c.statusLabel, cls: c.statusClass });
            });
        });
        // NZ / UK stored programmes (gh399 fixtures) carry targets + delivered.
        ['test5-nz-soccer', 'test6-uk-mlsn'].forEach((slug) => {
            const fx = JSON.parse(fs.readFileSync(path.join(FIXTURE_DIR, 'gh399-delivery-programme-' + slug + '.json'), 'utf8'));
            ['N', 'P', 'K'].forEach((n) => {
                const req = fx.targets ? fx.targets[n] : undefined;
                const del = fx.delivered ? fx.delivered[n] : undefined;
                if (typeof req !== 'number' || typeof del !== 'number') return;
                const c = status.classify({ nutrient: n, required: req, delivered: del });
                rows.push({ slug, n, req: r1(req), del: r1(del), pct: req > 0 ? Math.round(del / req * 100) : null, label: c.statusLabel, cls: c.statusClass });
            });
        });
        rows.forEach((x) => out('[gh410-E]   ' + x.slug.padEnd(20) + x.n.padEnd(3) + String(x.req).padStart(7) + String(x.del).padStart(8)
            + String(x.pct == null ? '-' : x.pct + '%').padStart(7) + '  ' + x.label + ' [' + x.cls + ']'));
        expect(rows.length).toBeGreaterThan(0);
    });
});
