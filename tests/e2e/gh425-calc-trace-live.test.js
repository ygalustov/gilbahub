/**
 * GH-425 live check — the temporary "How this was calculated" block under the
 * Plan page's Nutrient Delivery Summary reads the engines, and agrees with the
 * table it sits under.
 *
 * WHY A LIVE FILE. The whole risk of a block like this is that it becomes a
 * second implementation of the calculation: it would then agree with itself and
 * disagree with the product. The only way to know it does not is to render it
 * on the real page, beside the real summary, and compare the two cell by cell —
 * which is what the block itself does on screen and what this file asserts.
 *
 * THE SITES, chosen so the empty and unusual cases are seen and not just the
 * happy one. All are Australian: New Zealand sites are deliberately untouched
 * (opening /plan on one re-runs and re-persists its programme).
 *
 *   Burns / Other        MLSN.  No phosphorus reading on the sample at all, and
 *                        potassium 7.6 ppm — far below the MLSN floor of 37, so
 *                        the requirement takes the below-floor lift branch.
 *   Burns / Greens       MLSN.  P 57 / K 73 against MLSN's 21-31.5 and 37-55.5:
 *                        both at or above the ceiling, the GH-415 branch.
 *   New test - location  SLAN.  A second methodology, with its own floors.
 *   Westview             MLSN.  Buffalograss lawn, a sample with NEITHER P nor
 *                        K — both rows must say so rather than show a verdict.
 *   Federal Golf         SLAN.  Greens, a sample with real readings.
 *
 * Ammonium Acetate is not live here: every AA site on the development database
 * is in New Zealand. It is covered against the same shared engines in
 * tests/gh425-calc-trace.test.js.
 *
 * Run: GILBA_E2E=1 npx jest tests/e2e/gh425-calc-trace-live.test.js --runInBand --testTimeout=600000
 */

'use strict';

const fs = require('fs');
const path = require('path');

const ENABLED = process.env.GILBA_E2E === '1';

let credentials = {};
try {
    credentials = JSON.parse(fs.readFileSync(
        process.env.GILBA_E2E_CREDENTIALS || path.join(__dirname, '.e2e-credentials.json'), 'utf8'));
} catch (e) { credentials = {}; }

const BASE_URL = process.env.GILBA_E2E_URL || credentials.url || 'http://127.0.0.1:8080';
const EMAIL = process.env.GILBA_E2E_EMAIL || credentials.email;
const PASSWORD = process.env.GILBA_E2E_PASSWORD || credentials.password;

let chromium = null;
try { ({ chromium } = require('playwright')); } catch (e) { /* reported below */ }

const CASES = [
    {
        // samples.id 53 — P absent, K 7.6 ppm against an MLSN floor of 37.
        key: 'burns-other',
        siteId: '019e96d8-97b7-714c-9bd6-d65b16ec7f2e',
        siteName: 'Burns',
        pick: 'Rye Nursery',
        expect: { methodology: 'MLSN', P: 'removal-only-no-soil-data', K: 'lift-to-floor' }
    },
    {
        // samples.id 50 — P 57 / K 73 at pH 7.3, i.e. above MLSN's 31.5 and 55.5.
        key: 'burns-greens',
        siteId: '019e96d8-97b7-714c-9bd6-d65b16ec7f2e',
        siteName: 'Burns',
        pick: 'Putter Green',
        expect: { methodology: 'MLSN', P: 'ceiling', K: 'ceiling' }
    },
    {
        // samples.id 132 — SLAN, P 50.69 inside 27-54, K 23.32 below 75.
        key: 'ntl-slan',
        siteId: '01a00d5b-c67a-7281-8f0f-2d8de6676a0f',
        siteName: 'New test - location',
        pick: 'Green 6',
        expect: { methodology: 'SLAN', P: 'removal-only', K: 'lift-to-floor' }
    },
    {
        // samples.id 118 — a Buffalograss lawn whose sample carries neither.
        key: 'westview',
        siteId: '019f7d28-50ed-71e2-b817-c252b0160460',
        siteName: 'Westview',
        pick: 'Backyard',
        expect: { methodology: 'MLSN', P: 'removal-only-no-soil-data', K: 'removal-only-no-soil-data' }
    },
    {
        // samples.id 143 — SLAN greens with real readings on both.
        key: 'federal',
        siteId: '019e96d7-36aa-707a-9879-68ab28726e12',
        siteName: 'Federal Golf',
        pick: 'Green 1',
        expect: { methodology: 'SLAN' }
    }
];

const ONLY = process.env.GILBA_E2E_SITE;
const RUN = ONLY ? CASES.filter((c) => c.key === ONLY) : CASES;

/* istanbul ignore next — evaluated in the page, not in node */
function readTraceInPage() {
    var host = document.querySelector('[data-gaip-calc-trace-host]');
    if (!host) return { found: false };
    var block = host.querySelector('[data-gaip-calc-trace]');
    var text = (host.textContent || '').replace(/\s+/g, ' ').trim();

    // Where the host sits relative to the summary card it explains.
    var heads = Array.prototype.slice.call(document.querySelectorAll('h4'));
    var card = null;
    heads.forEach(function (h) {
        if (!card && /Nutrient Delivery Summary/i.test(h.textContent || '')) card = h.parentElement;
    });

    var sections = Array.prototype.slice.call(host.querySelectorAll('.gaip-ctrace-sec'));
    var nutrientSections = {};
    sections.forEach(function (s) {
        var h5 = s.querySelector('h5');
        var name = h5 ? (h5.textContent || '').trim() : '';
        if (['N', 'P', 'K'].indexOf(name) < 0) return;
        nutrientSections[name] = Array.prototype.slice.call(s.querySelectorAll('.gaip-ctrace-step'))
            .map(function (st) {
                return {
                    label: ((st.children[0] || {}).textContent || '').trim(),
                    working: ((st.children[1] || {}).textContent || '').replace(/\s+/g, ' ').trim(),
                    result: ((st.children[2] || {}).textContent || '').trim()
                };
            });
        nutrientSections[name + '_lines'] = Array.prototype.slice.call(s.querySelectorAll('.gaip-ctrace-led li'))
            .map(function (li) { return (li.textContent || '').replace(/\s+/g, ' ').trim(); });
        nutrientSections[name + '_lineValues'] = Array.prototype.slice.call(s.querySelectorAll('.gaip-ctrace-led li .v'))
            .map(function (v) { return parseFloat(v.textContent); });
        nutrientSections[name + '_lineExcluded'] = Array.prototype.slice.call(s.querySelectorAll('.gaip-ctrace-led li'))
            .map(function (li) { return /amendment/.test(li.textContent || ''); });
    });

    var inputRows = {};
    var inputTable = sections.length ? sections[0].querySelector('table') : null;
    if (inputTable) {
        Array.prototype.slice.call(inputTable.querySelectorAll('tbody tr')).forEach(function (tr) {
            var tds = tr.children;
            inputRows[(tds[0].textContent || '').trim()] = {
                value: (tds[1].textContent || '').replace(/\s+/g, ' ').trim(),
                source: (tds[2].textContent || '').replace(/\s+/g, ' ').trim()
            };
        });
    }

    var cal = (window.GilbaNutritionCalendar && window.GilbaNutritionCalendar.program) || null;
    var rec = window.GAIP_NUTRITION_PROGRAM || null;

    return {
        found: true,
        rendered: !!block,
        immediatelyAfterSummary: !!(card && card.nextElementSibling === host),
        inExportOnlyPage: false,
        saysTemporary: /Temporary — this panel will be removed/.test(text),
        checksAllGood: !!host.querySelector('.gaip-ctrace-ok'),
        checksBad: host.querySelector('.gaip-ctrace-bad')
            ? Array.prototype.slice.call(host.querySelectorAll('.gaip-ctrace-sec table'))
                .slice(-1).map(function (t) { return (t.textContent || '').replace(/\s+/g, ' ').trim(); })[0]
            : null,
        checkCount: (function () {
            var m = text.match(/All (\d+) figures match/);
            return m ? parseInt(m[1], 10) : 0;
        })(),
        sections: nutrientSections,
        inputRows: inputRows,
        engine: cal ? {
            methodology: cal.meta.methodology,
            annualNBase: cal.meta.annualNBase,
            targetN: cal.adjustments.target_n,
            appliedN: cal.adjustments.applied_n,
            required: cal.annual_totals,
            removal: cal.annual_removal,
            missing: cal.missing_soil_data,
            intents: cal.requirement_detail ? {
                P: cal.requirement_detail.P.intent,
                K: cal.requirement_detail.K.intent
            } : null,
            detail: cal.requirement_detail ? {
                P: cal.requirement_detail.P,
                K: cal.requirement_detail.K
            } : null,
            monthlyTempsSource: cal.meta.monthlyTempsSource,
            soilPH: cal.soil.pH,
            soilTexture: cal.soil.soilTexture
        } : null,
        deliveredTotals: rec && window.GAIP_NutritionDelivery
            ? window.GAIP_NutritionDelivery.accumulate(rec.monthly || []).totals : null,
        sampleLabel: (document.getElementById('plan-nut-sample-label') || {}).textContent || null
    };
}

/* istanbul ignore next — evaluated in the page, not in node */
function isExportDocumentClean() {
    // The block is Plan-only by decision. Nothing on this page may carry it into
    // the export path: assert the module is not even loaded on /reports/export.
    return { moduleLoaded: !!window.GAIP_PlanCalcTrace,
             hostPresent: !!document.querySelector('[data-gaip-calc-trace-host]') };
}

if (!ENABLED) {
    process.stdout.write('[e2e] gh425-calc-trace-live skipped (needs the live stack)\n');
    test.skip('GH-425 live calc-trace check (disabled)', () => {});
} else {

let browser = null;
let page = null;
let previousActiveSiteId = null;
const results = {};
const consoleLines = [];
const out = (s) => process.stdout.write('[gh425] ' + s + '\n');

async function setActiveSite(id) {
    await page.evaluate(async ({ id }) => {
        const t = document.querySelector('meta[name=csrf-token]');
        await fetch('/api/active-site', {
            method: 'PATCH',
            headers: Object.assign({ 'Content-Type': 'application/json', Accept: 'application/json' },
                t ? { 'X-CSRF-TOKEN': t.getAttribute('content') } : {}),
            body: JSON.stringify({ site_id: id }), credentials: 'same-origin'
        });
    }, { id });
}

describe('GH-425 live — the calculation trace block', () => {
    let exportPage = null;

    beforeAll(async () => {
        if (!chromium) throw new Error('playwright does not resolve from the repo — run `npm install`');
        if (!EMAIL || !PASSWORD) throw new Error('no credentials — see tests/e2e/.e2e-credentials.json');

        browser = await chromium.launch();
        page = await browser.newPage();
        page.on('console', (m) => {
            const t = m.text();
            if (/GH-425|calc trace|is not loaded/i.test(t)) consoleLines.push(m.type() + ': ' + t.slice(0, 200));
        });
        page.on('pageerror', (e) => { consoleLines.push('pageerror: ' + (e && e.message)); });

        await page.goto(BASE_URL + '/login', { waitUntil: 'domcontentloaded' });
        await page.fill('#email', EMAIL);
        await page.fill('#password', PASSWORD);
        await Promise.all([
            page.waitForNavigation({ waitUntil: 'domcontentloaded' }).catch(() => {}),
            page.click('form.login-form button[type=submit]')
        ]);
        await page.waitForTimeout(1500);
        if (/\/login/.test(page.url())) throw new Error('login refused for ' + EMAIL);

        const sites = await page.evaluate(async () =>
            (await fetch('/api/sites', { headers: { Accept: 'application/json' }, credentials: 'same-origin' })).json());
        previousActiveSiteId = sites.active_site_id;

        for (const c of RUN) {
            await setActiveSite(c.siteId);
            await page.goto(BASE_URL + '/plan', { waitUntil: 'domcontentloaded' });
            await page.waitForFunction(() => !!window.GilbaNutritionCalendar, null, { timeout: 30000 });
            await page.waitForTimeout(2500);
            await page.click('a[data-tab="nutrition"]');
            await page.waitForTimeout(1200);
            await page.waitForSelector('#plan-nut-sample-picker .sn-drop-btn', { timeout: 20000 });

            if (c.pick) {
                const picked = await page.evaluate((needle) => {
                    const btn = document.querySelector('#plan-nut-sample-picker .sn-drop-btn');
                    if (!btn) return { ok: false, reason: 'no picker' };
                    btn.click();
                    const rows = Array.from(document.querySelectorAll('#plan-nut-sample-picker .sn-drop-row[data-sn-idx]'));
                    const texts = rows.map((r) => (r.textContent || '').replace(/\s+/g, ' ').trim());
                    const zones = rows.map((r) => ((r.querySelector('.sn-drop-cell-zone') || {}).textContent || '')
                        .replace(/^●\s*/, '').trim());
                    const i = zones.indexOf(needle);
                    if (i < 0) { btn.click(); return { ok: false, reason: 'zone not in picker', zones: zones, texts: texts }; }
                    rows[i].click();
                    return { ok: true, zone: zones[i], text: texts[i] };
                }, c.pick);
                if (!picked.ok) throw new Error('could not pin "' + c.pick + '" on ' + c.siteName +
                    ': ' + JSON.stringify(picked));
                out(c.key + ' sample: ' + picked.text);
                await page.waitForTimeout(1200);
            }

            await page.evaluate(() => {
                window.__gh425 = 0;
                document.addEventListener('gaip:nutrition-calendar-generated', () => { window.__gh425++; });
            });
            await page.click('#plan-nut-generate-btn');
            await page.waitForFunction(() => window.__gh425 > 0
                && document.querySelectorAll('tr.gilba-nut-row').length === 12, null, { timeout: 90000 });
            await page.waitForTimeout(3000);

            results[c.key] = await page.evaluate(readTraceInPage);
            // Reading the rendered block is the point of the ticket, so make it
            // readable: GILBA_E2E_DUMP=<dir> writes each site's block out as
            // HTML to look at in a browser, and as plain text to read in a diff.
            if (process.env.GILBA_E2E_DUMP) {
                const dump = await page.evaluate(() => {
                    const h = document.querySelector('[data-gaip-calc-trace-host]');
                    return h ? { html: h.innerHTML, text: h.innerText } : null;
                });
                if (dump) {
                    fs.writeFileSync(path.join(process.env.GILBA_E2E_DUMP, 'gh425-' + c.key + '.html'), dump.html);
                    fs.writeFileSync(path.join(process.env.GILBA_E2E_DUMP, 'gh425-' + c.key + '.txt'), dump.text);
                    await page.locator('[data-gaip-calc-trace-host]').screenshot({
                        path: path.join(process.env.GILBA_E2E_DUMP, 'gh425-' + c.key + '.png')
                    }).catch(() => {});
                }
            }
            out(c.key + ' → ' + JSON.stringify({
                found: results[c.key].found,
                after: results[c.key].immediatelyAfterSummary,
                checks: results[c.key].checkCount,
                ok: results[c.key].checksAllGood,
                bad: results[c.key].checksBad,
                meth: results[c.key].engine && results[c.key].engine.methodology,
                intents: results[c.key].engine && results[c.key].engine.intents
            }));
        }

        // The block is Plan-only: prove it is absent from the export page.
        exportPage = await page.evaluate(() => null);
        await page.goto(BASE_URL + '/reports/export', { waitUntil: 'domcontentloaded' });
        await page.waitForTimeout(2500);
        exportPage = await page.evaluate(isExportDocumentClean);
        out('export page: ' + JSON.stringify(exportPage));
        consoleLines.slice(0, 10).forEach((l) => out('console: ' + l));
    }, 900000);

    afterAll(async () => {
        if (page && previousActiveSiteId) {
            try { await setActiveSite(previousActiveSiteId); } catch (e) { /* */ }
        }
        if (browser) await browser.close();
    }, 120000);

    RUN.forEach((c) => {
        describe(c.siteName + (c.pick ? ' / ' + c.pick : ''), () => {
            test('the block renders directly under the Nutrient Delivery Summary, and says it is temporary', () => {
                const r = results[c.key];
                expect(r && r.found).toBe(true);
                expect(r.rendered).toBe(true);
                expect(r.immediatelyAfterSummary).toBe(true);
                expect(r.saysTemporary).toBe(true);
            });

            test('every figure it prints matches the summary cell it explains', () => {
                const r = results[c.key];
                expect(r.checksBad).toBeNull();
                expect(r.checksAllGood).toBe(true);
                expect(r.checkCount).toBe(21);   // 3 nutrients x 7 columns
            });

            test('the branch it names is the branch the engine took', () => {
                const r = results[c.key];
                expect(r.engine).toBeTruthy();
                expect(r.engine.intents).toBeTruthy();
                ['P', 'K'].forEach((n) => {
                    const intent = r.engine.intents[n];
                    const steps = r.sections[n] || [];
                    const branchStep = steps.find((s) => /^Requirement — branch/.test(s.label));
                    expect(branchStep).toBeTruthy();
                    if (intent === 'lift-to-floor') {
                        expect(branchStep.label).toMatch(/lift to floor/);
                    } else if (intent === 'maintain-floor' || intent === 'suppress-above-ceiling') {
                        expect(branchStep.label).toMatch(/at or above the ceiling/);
                    } else {
                        expect(branchStep.label).toMatch(/removal only/);
                    }
                    // The branch's printed result is the engine's own figure.
                    expect(parseFloat(branchStep.result)).toBeCloseTo(
                        r.engine.detail[n].annualRequirement, 4);
                    // And, where this case was chosen for a branch, it is that one.
                    if (c.expect[n] === 'ceiling') {
                        expect(['maintain-floor', 'suppress-above-ceiling']).toContain(intent);
                    } else if (c.expect[n]) {
                        expect(intent).toBe(c.expect[n]);
                    }
                });
            });

            test('the delivered lines add up to the delivered total it prints', () => {
                const r = results[c.key];
                ['N', 'P', 'K'].forEach((n) => {
                    const steps = r.sections[n] || [];
                    const delivered = steps.find((s) => /^Delivered/.test(s.label));
                    expect(delivered).toBeTruthy();
                    const values = r.sections[n + '_lineValues'] || [];
                    const excluded = r.sections[n + '_lineExcluded'] || [];
                    const sum = values.reduce((a, v, i) => a + (excluded[i] ? 0 : v), 0);
                    expect(sum).toBeCloseTo(parseFloat(delivered.result), 2);
                    expect(parseFloat(delivered.result)).toBeCloseTo(r.deliveredTotals[n], 2);
                });
            });

            test('the methodology, and the inputs the page did not otherwise show, are named', () => {
                const r = results[c.key];
                expect(r.engine.methodology).toBe(c.expect.methodology);
                expect(r.inputRows['Methodology'].value).toBe(c.expect.methodology);
                // The half of the block that matters most: inputs with no other
                // home on this page.
                ['Annual N target (as entered)', 'Traffic intensity', 'Clipping management',
                 'Monthly N cap', 'Distribution mode', 'Soil texture', 'Sample pH',
                 'Bulk density / soil depth', 'Tissue analysis', 'Years to correct a deficit',
                 'Monthly temperature normals', 'Growth potential series',
                 'Soil temperature (product selection)'].forEach((label) => {
                    expect(r.inputRows[label]).toBeTruthy();
                });
                expect(r.inputRows['Monthly temperature normals'].value).toMatch(/degC/);
                expect(r.inputRows['Growth potential series'].value).toMatch(/%/);
            });

            if (c.expect.P) {
                test('a nutrient with no reading on the sample says so instead of showing a verdict', () => {
                    const r = results[c.key];
                    ['P', 'K'].forEach((n) => {
                        if (c.expect[n] !== 'removal-only-no-soil-data') return;
                        expect(r.engine.missing[n]).toBe(true);
                        const steps = r.sections[n] || [];
                        expect(steps[0].result).toMatch(/no reading/);
                        const bal = steps.find((s) => /^Balance and status/.test(s.label));
                        expect(bal.result).toBe('No Soil Data');
                    });
                });
            }

            if (c.expect.K === 'lift-to-floor') {
                test('the below-floor branch shows the lift as its own step, with its own figures', () => {
                    const r = results[c.key];
                    const d = r.engine.detail.K;
                    expect(r.engine.intents.K).toBe('lift-to-floor');
                    const steps = r.sections.K || [];
                    const branchStep = steps.find((s) => /^Requirement — branch/.test(s.label));
                    expect(branchStep.working).toMatch(/lift = /);
                    expect(branchStep.working).toMatch(new RegExp('spread over ' + d.yearsToCorrect + ' years'));
                    expect(branchStep.working).toContain(String(d.floor));
                });
            }
        });
    });

    test('the block is Plan-only — the export page does not load it at all', () => {
        expect(exportPage).toBeTruthy();
        expect(exportPage.moduleLoaded).toBe(false);
        expect(exportPage.hostPresent).toBe(false);
    });

    test('the page reported no error from the block', () => {
        expect(consoleLines.filter((l) => /calc trace failed|pageerror/.test(l))).toEqual([]);
    });
});
}
