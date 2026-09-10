/**
 * GH-398 live check — the Plan page's Monthly Nutrient Program and the Word
 * export's Monthly N Distribution are ONE series, on a site whose monthly N cap
 * actually binds.
 *
 * This is the check the parity harness could not make. `ui-vs-export-parity`
 * compares annual figures and product programmes; it never compared the two
 * monthly series, and its default fixture (Test5 - NZ) peaks at ~35 kg against
 * a cap of 50, so the cap has never bound in a harness run. Four of the ten
 * dev sites carry a cap of 15 and it binds on all four — the Word export
 * printed the unclamped series for every one of them, beside a Plan page that
 * had clamped it, for as long as the two engines existed.
 *
 * What this file reads:
 *   - the twelve N cells the Plan page actually RENDERS
 *     (td.gilba-nut-cell--n in the "Monthly Nutrient Program" table), not
 *     the in-memory programme object;
 *   - the twelve N figures in the generated .docx's "Monthly N Distribution"
 *     table, parsed out of word/document.xml.
 * Then it asserts they are the same twelve numbers, that neither exceeds the
 * site's own cap, and that the document states the cap the way the Plan page's
 * banner does.
 *
 * Defaults to the SLAN fixture — New test - location, cap 15, which binds.
 * Point GILBA_E2E_FIXTURE at another fixture to run it elsewhere; on an
 * uncapped site the cap assertions relax to "no month exceeds the cap" and the
 * equality assertion still stands, which is the half that matters everywhere.
 *
 * Credentials come from tests/e2e/.e2e-credentials.json, same as the parity
 * harness. Run: npm run test:e2e:cap
 */

'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const ENABLED = process.env.GILBA_E2E === '1';

let credentials = {};
try {
    credentials = JSON.parse(fs.readFileSync(
        process.env.GILBA_E2E_CREDENTIALS || path.join(__dirname, '.e2e-credentials.json'), 'utf8'));
} catch (e) { credentials = {}; }

const BASE_URL = process.env.GILBA_E2E_URL || credentials.url || 'http://127.0.0.1:8080';
const EMAIL = process.env.GILBA_E2E_EMAIL || credentials.email;
const PASSWORD = process.env.GILBA_E2E_PASSWORD || credentials.password;
const FIXTURE_PATH = process.env.GILBA_E2E_FIXTURE
    || path.join(__dirname, '../fixtures/e2e-parity-new-test-location-slan.json');

let chromium = null;
try { ({ chromium } = require('playwright')); } catch (e) { /* reported below */ }

if (!ENABLED) {
    process.stdout.write('[e2e] gh398-monthly-distribution-live skipped (needs the live stack) — npm run test:e2e:cap\n');
    test.skip('GH-398 live monthly-distribution check (disabled)', () => {});
} else {

const fixture = JSON.parse(fs.readFileSync(FIXTURE_PATH, 'utf8'));
const SITE_ID = fixture.site.id;
const SITE_NAME = fixture.site.name;
const SAMPLE_LABEL = fixture.soilSample.label;
const SAMPLE_UID = SITE_ID + '::' + fixture.soilSample.clientId;

function decodeEntities(s) {
    return s.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"').replace(/&apos;/g, "'")
        .replace(/&#(\d+);/g, (m, d) => String.fromCharCode(parseInt(d, 10)));
}

function fragmentText(xml) {
    const parts = [];
    const re = /<w:t(?:\s[^>]*)?>([^<]*)<\/w:t>/g;
    let m;
    while ((m = re.exec(xml))) parts.push(m[1]);
    return decodeEntities(parts.join(''));
}

function docxTables(xml) {
    const tables = [];
    const tblRe = /<w:tbl>([\s\S]*?)<\/w:tbl>/g;
    let t;
    while ((t = tblRe.exec(xml))) {
        const rows = [];
        const trRe = /<w:tr(?:\s[^>]*)?>([\s\S]*?)<\/w:tr>/g;
        let r;
        while ((r = trRe.exec(t[1]))) {
            const cells = [];
            const tcRe = /<w:tc(?:\s[^>]*)?>([\s\S]*?)<\/w:tc>/g;
            let c;
            while ((c = tcRe.exec(r[1]))) {
                const paras = c[1].split('</w:p>').map((p) => fragmentText(p).trim()).filter(Boolean);
                cells.push(paras.join('\n'));
            }
            rows.push(cells);
        }
        tables.push(rows);
    }
    return tables;
}

function docxText(xml) {
    return decodeEntities(xml
        .replace(/<\/w:p>/g, '\n')
        .replace(/<\/w:tc>/g, '\t')
        .replace(/<[^>]+>/g, ''))
        .replace(/[ \t]+\n/g, '\n');
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/**
 * The Monthly N Distribution table is the one whose header row is exactly the
 * twelve month abbreviations. Its single data row carries "<N>\nGP <pct>%" per
 * cell — N is printed with toFixed(0), so the document rounds to whole kg and
 * the Plan page's 0.1 figures are compared at that precision.
 */
function monthlyNFromDocx(tables) {
    const t = tables.find((rows) => rows.length >= 2 && rows[0].length === 12 &&
        rows[0].every((c, i) => (c || '').trim() === MONTHS[i]));
    if (!t) return null;
    return t[1].map((cell) => parseFloat(String(cell).split('\n')[0]));
}

describe('GH-398 — one monthly series on both surfaces (' + SITE_NAME + ' / ' + SAMPLE_LABEL + ')', () => {
    let browser, page, previousActiveSiteId = null;
    let planMonthlyN = null, planCapBanner = null, planAdjustments = null, planMeta = null, siteMaxN = null;
    let docxMonthlyN = null, docxTextAll = null;
    const consoleLines = [];
    let docxDiagnostic = null;

    beforeAll(async () => {
        if (!chromium) throw new Error('playwright does not resolve from the repo — run `npm install`');
        if (!EMAIL || !PASSWORD) throw new Error('no credentials — see tests/e2e/.e2e-credentials.example.json');
        try {
            execFileSync('unzip', ['-v'], { stdio: 'ignore' });
        } catch (e) {
            throw new Error('`unzip` is not on PATH (used to read word/document.xml out of the .docx)');
        }

        browser = await chromium.launch();
        page = await browser.newPage({ acceptDownloads: true });
        // A silent engine failure is exactly how a missing table would be
        // mistaken for "this site has no monthly programme".
        page.on('console', (m) => {
            const t = m.text();
            if (/\[WordExport\]|\[CombinedExport\]|NutritionRequirementEngine|NutritionMonthlyDistribution|is not loaded/i.test(t)) {
                consoleLines.push(m.type() + ': ' + t);
            }
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

        // Point the login at the fixture's site, remembering where it was.
        const sites = await page.evaluate(async () => {
            const r = await fetch('/api/sites', { headers: { Accept: 'application/json' }, credentials: 'same-origin' });
            return r.json();
        });
        previousActiveSiteId = sites.active_site_id;
        if (previousActiveSiteId !== SITE_ID) {
            await page.evaluate(async ({ id }) => {
                const t = document.querySelector('meta[name=csrf-token]');
                await fetch('/api/active-site', {
                    method: 'PATCH',
                    headers: Object.assign({ 'Content-Type': 'application/json', Accept: 'application/json' },
                        t ? { 'X-CSRF-TOKEN': t.getAttribute('content') } : {}),
                    body: JSON.stringify({ site_id: id }),
                    credentials: 'same-origin',
                });
            }, { id: SITE_ID });
        }

        // ── the Plan page ───────────────────────────────────────────────────
        await page.goto(BASE_URL + '/plan', { waitUntil: 'domcontentloaded' });
        await page.waitForFunction(() => !!window.GilbaNutritionCalendar, null, { timeout: 30000 });
        await page.waitForTimeout(2500); // site-config restore cascade
        await page.click('a[data-tab="nutrition"]');
        await page.waitForTimeout(1000);
        await page.waitForSelector('#plan-nut-sample-picker .sn-drop-btn', { timeout: 20000 });
        const picked = await page.evaluate((label) => {
            const btn = document.querySelector('#plan-nut-sample-picker .sn-drop-btn');
            if (!btn) return { ok: false, reason: 'no picker' };
            btn.click();
            const rows = Array.from(document.querySelectorAll('#plan-nut-sample-picker .sn-drop-row'));
            const available = rows.map((r) => (r.querySelector('.sn-drop-cell-zone') || {}).textContent);
            const row = rows.find((r) => ((r.querySelector('.sn-drop-cell-zone') || {}).textContent || '').trim() === label);
            if (!row) return { ok: false, reason: 'label not in picker', available };
            row.click();
            return { ok: true };
        }, SAMPLE_LABEL);
        if (!picked.ok) throw new Error('could not pin "' + SAMPLE_LABEL + '" in the Plan sample picker: ' + JSON.stringify(picked));
        await page.waitForTimeout(1200);

        await page.evaluate(() => {
            window.__gh398Generated = 0;
            document.addEventListener('gaip:nutrition-calendar-generated', () => { window.__gh398Generated++; });
        });
        await page.click('#plan-nut-generate-btn');
        await page.waitForFunction(() => {
            const el = document.querySelector('#plan-nut-results');
            return window.__gh398Generated > 0 && el && el.style.display !== 'none' &&
                document.querySelectorAll('td.gilba-nut-cell--n').length === 12;
        }, null, { timeout: 90000 });
        await page.waitForTimeout(1500);

        const planRead = await page.evaluate(() => {
            // The RENDERED cells, not the programme object — a rendering bug
            // between the two is exactly the kind of thing a live check is for.
            const cells = Array.from(document.querySelectorAll('td.gilba-nut-cell--n'))
                .map((td) => parseFloat(td.textContent.trim()));
            const banner = Array.from(document.querySelectorAll('.gilba-nut-banner'))
                .map((b) => b.textContent.replace(/\s+/g, ' ').trim())
                .find((t) => /Monthly N cap/i.test(t)) || null;
            // GH-398: the calendar's OWN programme object. Deliberately not
            // window.GAIP_NUTRITION_PROGRAM — that name belongs to the regional
            // integrations' product-recommendation object, a different shape
            // with no `adjustments` at all (nutrition-calendar.js says so at
            // restoreFromPersisted()). Reading it here made every cap assertion
            // below silently unreachable.
            const NC = window.GilbaNutritionCalendar;
            const p = (NC && NC.program) ||
                window.GAIP_NUTRITION_CALENDAR_PROGRAM ||
                (window.GAIP_SITE_CONFIG && window.GAIP_SITE_CONFIG.nutritionCalendarProgram) || null;
            return {
                cells: cells,
                banner: banner,
                adjustments: p ? p.adjustments : null,
                meta: p ? p.meta : null,
                maxNInput: (document.getElementById('plan-nut-max-n') || {}).value || null,
                siteCfgMaxN: (window.GAIP_SITE_CONFIG || {}).maxNPerMonth || null
            };
        });
        planMonthlyN = planRead.cells;
        planCapBanner = planRead.banner;
        planAdjustments = planRead.adjustments;
        planMeta = planRead.meta;
        siteMaxN = parseFloat(planRead.maxNInput) || planRead.siteCfgMaxN || null;

        // ── the Word export ─────────────────────────────────────────────────
        await page.goto(BASE_URL + '/reports/export', { waitUntil: 'domcontentloaded' });
        await page.waitForFunction(() => !!(window.GilbaNutritionCalendar && window.NutritionRequirementEngine_Pure &&
            (window.PrebbleRecommender || window.AuFertiliserRecommender) && window.GAIP_SampleManager),
            null, { timeout: 30000 });
        // The per-sample recompute takes its annual N from this input, which the
        // site-config restore cascade fills a few seconds after load. Exporting
        // before it lands produces a document with NO Annual Nutrient
        // Requirements section and therefore no Monthly N Distribution table at
        // all — the engine block is gated on the sample's soil having arrived —
        // which reads exactly like "the table regressed". Same wait the parity
        // harness makes, for the same reason.
        await page.waitForFunction(() => {
            const el = document.querySelector('.gaip-nutrition-annual-n');
            return !!(el && el.value);
        }, null, { timeout: 20000 }).catch(() => {});
        await page.waitForTimeout(2500);

        await page.click('text=Generate & Download Word');
        await page.waitForSelector('.gaip-bulk-area-backdrop', { timeout: 15000 });
        await page.waitForTimeout(500);
        await page.click('text=Deselect all');
        await page.waitForTimeout(300);
        const pick = await page.evaluate(({ uid }) => {
            const cb = document.querySelector('input[data-sample-uid="' + uid + '"]');
            if (!cb) {
                return { found: false, available: Array.from(document.querySelectorAll('input[data-sample-uid]'))
                    .map((c) => c.getAttribute('data-sample-uid')) };
            }
            cb.checked = true;
            cb.dispatchEvent(new Event('change', { bubbles: true }));
            return { found: true, checked: document.querySelectorAll('input[data-sample-uid]:checked').length };
        }, { uid: SAMPLE_UID });
        if (!pick.found) throw new Error('fixture sample ' + SAMPLE_UID + ' not in the export picker: ' + JSON.stringify(pick));
        if (pick.checked !== 1) throw new Error('expected exactly one ticked sample, got ' + pick.checked);

        const [download] = await Promise.all([
            page.waitForEvent('download', { timeout: 180000 }),
            page.locator('button:has-text("Generate & Download")').last().click()
        ]);
        const docxPath = path.join(os.tmpdir(), 'gilba-gh398-' + Date.now() + '.docx');
        await download.saveAs(docxPath);
        const xml = execFileSync('unzip', ['-p', docxPath, 'word/document.xml'],
            { maxBuffer: 64 * 1024 * 1024 }).toString();
        const tables = docxTables(xml);
        docxMonthlyN = monthlyNFromDocx(tables);
        docxTextAll = docxText(xml);
        if (!docxMonthlyN) {
            // Fail-loud diagnostic: a missing table and a mis-parsed one look
            // identical from the assertion alone.
            docxDiagnostic = {
                mentionsHeading: /Monthly N Distribution/.test(docxTextAll),
                // The engine block as a whole, not just this table: if the
                // Annual Nutrient Requirements heading is missing too, the
                // export ran before the sample's soil data arrived and nothing
                // engine-driven was rendered — a different fault from a broken
                // monthly table, and the two look identical from the assertion.
                mentionsANR: /Annual Nutrient Requirements/.test(docxTextAll),
                tableHeaders: tables.map((rows) => (rows[0] || []).slice(0, 13).join('|')).slice(0, 40),
                console: consoleLines.slice(0, 40)
            };
        }
        if (process.env.GILBA_E2E_KEEP === '1') {
            process.stdout.write('[gh398] kept ' + docxPath + '\n');
        } else {
            try { fs.unlinkSync(docxPath); } catch (e) { /* best effort */ }
        }

        process.stdout.write('[gh398] ' + SITE_NAME + ' / ' + SAMPLE_LABEL +
            '\n[gh398]   cap        : ' + siteMaxN +
            '\n[gh398]   plan  (UI) : ' + JSON.stringify(planMonthlyN) +
            '\n[gh398]   export(doc): ' + JSON.stringify(docxMonthlyN) +
            '\n[gh398]   plan banner: ' + planCapBanner +
            (docxDiagnostic ? '\n[gh398]   NO TABLE   : ' + JSON.stringify(docxDiagnostic, null, 1) : '') + '\n');
    }, 300000);

    afterAll(async () => {
        if (page && previousActiveSiteId && previousActiveSiteId !== SITE_ID) {
            await page.evaluate(async ({ id }) => {
                const t = document.querySelector('meta[name=csrf-token]');
                await fetch('/api/active-site', {
                    method: 'PATCH',
                    headers: Object.assign({ 'Content-Type': 'application/json', Accept: 'application/json' },
                        t ? { 'X-CSRF-TOKEN': t.getAttribute('content') } : {}),
                    body: JSON.stringify({ site_id: id }),
                    credentials: 'same-origin',
                });
            }, { id: previousActiveSiteId });
        }
        if (browser) await browser.close();
    }, 120000);

    test('both surfaces rendered a twelve-month series', () => {
        expect(planMonthlyN).toHaveLength(12);
        expect(docxMonthlyN).not.toBeNull();
        expect(docxMonthlyN).toHaveLength(12);
        planMonthlyN.forEach((v) => expect(Number.isFinite(v)).toBe(true));
        docxMonthlyN.forEach((v) => expect(Number.isFinite(v)).toBe(true));
    });

    test('the twelve rendered N figures are the SAME series, month for month', () => {
        // The document prints whole kg (toFixed(0)) and the Plan page one
        // decimal, so the comparison is at the document's precision. Before
        // GH-398 the difference on a capped site was 6 kg in January, not
        // half a kilo.
        const mismatches = [];
        for (let m = 0; m < 12; m++) {
            if (Math.round(planMonthlyN[m]) !== docxMonthlyN[m]) {
                mismatches.push({ month: MONTHS[m], plan: planMonthlyN[m], export: docxMonthlyN[m] });
            }
        }
        expect(mismatches).toEqual([]);
    });

    test('no month on either surface exceeds the site\'s own Max N per application', () => {
        if (!(siteMaxN > 0)) return;   // site with no cap configured
        planMonthlyN.forEach((v, m) => {
            expect({ month: MONTHS[m], n: v }).toEqual({ month: MONTHS[m], n: Math.min(v, siteMaxN + 0.05) });
        });
        docxMonthlyN.forEach((v, m) => {
            expect({ month: MONTHS[m], n: v }).toEqual({ month: MONTHS[m], n: Math.min(v, Math.ceil(siteMaxN)) });
        });
    });

    test('when the cap binds, the document says so in the Plan page\'s own terms', () => {
        if (!planAdjustments || !planAdjustments.n_cap_applied) {
            // Not a capped site — assert the negative instead, so this test
            // never passes by having found nothing to check.
            expect(docxTextAll).not.toMatch(/Monthly N cap/);
            return;
        }
        expect(planCapBanner).toMatch(/Monthly N cap/);
        expect(docxTextAll).toMatch(/Monthly N cap/);
        if (planAdjustments.n_unschedulable > 0) {
            expect(docxTextAll).toContain('Monthly N cap too low: target ' + planAdjustments.original_n_total);
            expect(docxTextAll).toContain(planAdjustments.n_unschedulable + ' kg/ha cannot be scheduled');
        } else {
            expect(docxTextAll).toContain('Monthly N cap applied (' + planAdjustments.max_n_per_month + ' kg/ha per month)');
            expect(docxTextAll).toContain(planAdjustments.n_redistributed + ' kg/ha redistributed to shoulder months');
            expect(docxTextAll).toContain('Full target of ' + planAdjustments.original_n_total + ' kg/ha delivered');
        }
    });

    test('the heading names the distribution mode that actually ran', () => {
        expect(docxTextAll).toMatch(/Monthly N Distribution \((GP-Weighted|Even|Front-loaded)\)/);
        // The heading is now composed from the mode rather than hard-coded, so
        // it has to agree with the mode the Plan page stamped on the programme.
        const stamped = { gp_weighted: 'GP-Weighted', even: 'Even', front_loaded: 'Front-loaded' }[
            (planMeta && planMeta.distribution) || 'gp_weighted'];
        expect(docxTextAll).toContain('Monthly N Distribution (' + stamped + ')');
    });

    test('the annual total did not move — the cap changes the schedule, not the target', () => {
        expect(planAdjustments).not.toBeNull();
        expect(planAdjustments.original_n_total).toBeCloseTo(planAdjustments.target_n, 0);
        const scheduled = planMonthlyN.reduce((s, v) => s + v, 0);
        expect(scheduled).toBeCloseTo(planAdjustments.scheduled_n_total, 0);
    });
});

}
