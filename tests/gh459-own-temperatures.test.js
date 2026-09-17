/**
 * GH-478 (PLAN-GH439 section 10.6, twenty-second refinement, point 1) —
 * a report is printed on ITS OWN site's temperatures, and the ordinary run
 * can now say so.
 *
 * The defect in its own form: the owner exported Test5 and got another site's
 * climate — the right growth-potential curve on Christchurch temperatures, and
 * with it a different monthly nitrogen split. Until now no suite in `npx jest`
 * could see it. The product calls `getResolvedSync(_lat, _lon)`
 * (word-export.js:7347); the sandbox's stub was declared with no parameters at
 * all and answered one row to any argument, so the mutation "resolve
 * Christchurch's coordinates instead of this sample's" changed nothing any
 * assertion could reach: 27/27, 42/42, 16/16, 9/9, 12/12, all green. The
 * defect was caught only by the live pair (gh459-cross-site-inputs-live.js:229
 * and the parity harness), which need a stand and are skipped here.
 *
 * ── Passport ────────────────────────────────────────────────────────────────
 * guarantee   The twelve monthly temperatures behind an exported report are
 *             the temperatures of the site that report is about.
 * claims      By VALUE, not by text: the twelve GP figures printed in the
 *             document equal the growth potential of site A's twelve
 *             temperatures, and none of them equals site B's; the twelve
 *             temperatures that reach the engine are A's; and the call that
 *             fetched them was made with A's coordinates.
 * universe    The export page's two entry points — GAIP_WordExport.export()
 *             (single) and GAIP_CombinedExport (the per-sample loop).
 * unit        One exported report.
 * moment      A whole export, from the entry point to the produced .docx.
 * distinguishability  Two climate rows keyed by coordinates, differing in
 *             every month and sharing no value; their difference is asserted
 *             BEFORE the export runs, because on two equal rows every
 *             assertion below would pass without meaning anything.
 * carrier     The printed GP figures and the engine's monthlyTemps, plus the
 *             arguments the store was actually called with — a value, a
 *             border, and a call, so that agreement is not read off one of
 *             them alone.
 * input       BOTH entry points a client uses: GAIP_WordExport.export() and
 *             the combined export, which is what the button on
 *             /reports/export runs. In each, the page's coordinate surfaces
 *             hold site B while the report is about site A — the DOM's
 *             .gaip-lat/.gaip-lon and the hub's savedLocation — which is the
 *             original race, with the page a step behind the sample.
 * positive-control  The same assertions are re-run against a deliberately
 *             wrong store answer (B's row for every key) and must fail; the
 *             control is in this file, below.
 * exemptions  None.
 * ratchet     None — this is an assertion about values, not an inventory.
 * rc          The reviewer's mutation: B's coordinates at the call site, and
 *             the call with no arguments at all.
 * ────────────────────────────────────────────────────────────────────────────
 *
 * The input axis was open when this file was first written: the combined
 * document carried no Monthly N table in a sandbox, because that section needs
 * `data.soil` and nothing filled the page's soil form. GH-479 filled it the
 * way the live page does — loadSample() puts the sample being printed into the
 * form — so the printed twelve are asserted on both entry points now, and the
 * combined one is also asserted at its border (the temperatures that reached
 * collectData, and the coordinates the store was asked for). The browser
 * halves (`gh459-cross-site-inputs-live.test.js:229`, the parity harness) stay
 * the live proof.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const {
    loadPage, SITE_ID, SITE_NAME, OTHER_SITE_ID,
    SITE_LAT, SITE_LON, OTHER_SITE_LAT, OTHER_SITE_LON,
    MONTHLY_TEMPS_FIXTURE, MONTHLY_TEMPS_DECOY, coordKey, climateStore,
    poisonPage, POISON_SENTINEL
} = require('./helpers/export-page-sandbox');
const { EMPTY } = require('./lib/empty-inputs');

const MONTHS = 12;

/** The document as plain text: one line per paragraph, cells tab-separated. */
function documentText(xml) {
    return xml.replace(/<\/w:p>/g, '\n').replace(/<\/w:tc>/g, '\t').replace(/<[^>]+>/g, '');
}

/** The twelve "GP nn%" figures the Monthly N Distribution table prints. */
function printedGp(xml) {
    return (documentText(xml).match(/GP (\d+)%/g) || []).map((s) => parseInt(s.slice(3), 10));
}

/**
 * The growth potential of a row of temperatures, computed through the engine
 * that owns the curve rather than through the path under test. The fixture
 * site is 100% C3 (perennial ryegrass, c3Cover 100), so this is the C3 curve.
 */
function gpRow(sandbox, temps) {
    const GPE = sandbox.GilbaGrowthPotentialEngine;
    return temps.map((t) => Math.round(GPE.compute(t, { model: 'pace', species: 'c3' }) * 100));
}

/** The page a step behind: its coordinate surfaces hold site B. */
function pageStandsOnB(sandbox) {
    sandbox.GAIP_HUB_CONFIG.savedLocation = { lat: OTHER_SITE_LAT, lon: OTHER_SITE_LON };
    const inner = sandbox.document.querySelector;
    sandbox.document.querySelector = (sel) => {
        const s = String(sel);
        if (s.indexOf('gaip-lat') >= 0) return { value: String(OTHER_SITE_LAT), textContent: String(OTHER_SITE_LAT) };
        if (s.indexOf('gaip-lon') >= 0) return { value: String(OTHER_SITE_LON), textContent: String(OTHER_SITE_LON) };
        return inner ? inner.call(sandbox.document, sel) : null;
    };
}

/** Records every call to the store, with how many arguments it was made with. */
function watchTheStore(sandbox) {
    const calls = [];
    const inner = sandbox.GilbaClimateNormalsService.getResolvedSync;
    sandbox.GilbaClimateNormalsService.getResolvedSync = function (lat, lon) {
        calls.push({ argc: arguments.length, lat: lat, lon: lon });
        return inner(lat, lon);
    };
    return calls;
}

async function waitForBlob(page) {
    for (let i = 0; i < 400 && !page.blobs.length; i++) {
        await new Promise((r) => setImmediate(r));
    }
    return page.blobs[page.blobs.length - 1];
}

async function documentXmlOf(page) {
    const blob = await waitForBlob(page);
    expect(blob && blob.size).toBeGreaterThan(0);
    const zip = await page.sandbox.JSZip.loadAsync(Buffer.from(await blob.arrayBuffer()));
    return zip.file('word/document.xml').async('string');
}

describe('GH-478 — the two climate rows are told apart before anything is exported', () => {
    let page;

    beforeAll(() => {
        page = loadPage({ errors: [], warnings: [], alerts: [] });
        expect(page.failures).toEqual([]);
    });

    test('the store holds a row for each site, keyed by its coordinates', () => {
        const store = climateStore();
        expect(store.name).toBe('GilbaClimateNormalsService.getResolvedSync(lat, lon)');
        expect(store.keys.length).toBe(2);
        expect(store.fixtureKey).toBe(coordKey(SITE_LAT, SITE_LON));
        expect(store.decoyKey).toBe(coordKey(OTHER_SITE_LAT, OTHER_SITE_LON));
        expect(store.fixtureKey).not.toBe(store.decoyKey);
    });

    test('the stub is keyed exactly the way the service keys itself', () => {
        // A stub keyed differently answers null to every call the product
        // makes, and a test built on it proves the absence of an answer.
        const service = fs.readFileSync(path.join(__dirname, '..', 'assets', 'climate-normals-service.js'), 'utf8');
        expect(service).toContain("return lat.toFixed(2) + ',' + lon.toFixed(2);");
        const sandboxSrc = fs.readFileSync(path.join(__dirname, 'helpers', 'export-page-sandbox.js'), 'utf8');
        expect(sandboxSrc).toContain("return lat.toFixed(2) + ',' + lon.toFixed(2);");
    });

    test('the two rows differ in every month and share no value', () => {
        expect(MONTHLY_TEMPS_FIXTURE.length).toBe(MONTHS);
        expect(MONTHLY_TEMPS_DECOY.length).toBe(MONTHS);
        const same = MONTHLY_TEMPS_FIXTURE
            .map((t, i) => ({ month: i + 1, a: t, b: MONTHLY_TEMPS_DECOY[i] }))
            .filter((m) => m.a === m.b);
        expect(same).toEqual([]);
        const shared = MONTHLY_TEMPS_FIXTURE.filter((t) => MONTHLY_TEMPS_DECOY.indexOf(t) >= 0);
        expect(shared).toEqual([]);
    });

    test('and so do the twelve growth potentials they produce', () => {
        // The assertions below compare PRINTED GP figures. Two temperature
        // rows that differ but produce the same GP would make every one of
        // them pass without meaning anything — the curve saturates at both
        // ends, so this is a real possibility and not a formality.
        const a = gpRow(page.sandbox, MONTHLY_TEMPS_FIXTURE);
        const b = gpRow(page.sandbox, MONTHLY_TEMPS_DECOY);
        const same = a.map((v, i) => ({ month: i + 1, a: v, b: b[i] })).filter((m) => m.a === m.b);
        expect(same).toEqual([]);
    });
});

describe('GH-478 — single export: the printed twelve are the sample\'s site\'s', () => {
    jest.setTimeout(120000);
    let page, record, xml, calls, expectedA, expectedB;

    beforeAll(async () => {
        record = { errors: [], warnings: [], alerts: [] };
        page = loadPage(record);
        expect(page.failures).toEqual([]);
        pageStandsOnB(page.sandbox);
        calls = watchTheStore(page.sandbox);
        expectedA = gpRow(page.sandbox, MONTHLY_TEMPS_FIXTURE);
        expectedB = gpRow(page.sandbox, MONTHLY_TEMPS_DECOY);
        await page.sandbox.GAIP_WordExport.export();
        xml = await documentXmlOf(page);
    });

    test('the document is about site A', () => {
        expect(xml).toContain(SITE_NAME);
        expect(documentText(xml)).toContain('Auckland');
    });

    test('the twelve printed GP figures are A\'s, month by month', () => {
        expect(printedGp(xml)).toEqual(expectedA);
    });

    test('not one of them is B\'s', () => {
        const printed = printedGp(xml);
        const fromB = printed
            .map((v, i) => ({ month: i + 1, printed: v, b: expectedB[i] }))
            .filter((m) => m.printed === m.b);
        expect(fromB).toEqual([]);
    });

    test('the store was asked for A\'s coordinates, with both of them', () => {
        expect(calls.length).toBeGreaterThan(0);
        const short = calls.filter((c) => c.argc < 2);
        expect(short).toEqual([]);
        const asked = calls.map((c) => coordKey(parseFloat(c.lat), parseFloat(c.lon)));
        expect(Array.from(new Set(asked))).toEqual([coordKey(SITE_LAT, SITE_LON)]);
        expect(asked).not.toContain(coordKey(OTHER_SITE_LAT, OTHER_SITE_LON));
    });

    test('nothing wrote to console.error while it happened', () => {
        expect({ errors: record.errors }).toEqual({ errors: [] });
    });
});

describe('GH-478 — positive control: the same assertions on a wrong answer must fail', () => {
    jest.setTimeout(120000);
    let printed, expectedA, expectedB, calls;

    beforeAll(async () => {
        const record = { errors: [], warnings: [], alerts: [] };
        const page = loadPage(record);
        expect(page.failures).toEqual([]);
        pageStandsOnB(page.sandbox);
        calls = watchTheStore(page.sandbox);
        expectedA = gpRow(page.sandbox, MONTHLY_TEMPS_FIXTURE);
        expectedB = gpRow(page.sandbox, MONTHLY_TEMPS_DECOY);
        // The store answers B's row whatever it is asked — the shape the stub
        // had before this file existed, and what the defect looks like from
        // the document's side.
        const row = climateStore().byKey(climateStore().decoyKey);
        page.sandbox.GilbaClimateNormalsService.getResolvedSync = () => row;
        await page.sandbox.GAIP_WordExport.export();
        printed = printedGp(await documentXmlOf(page));
    });

    test('the document then prints B\'s twelve, and the assertions above would go red', () => {
        expect(printed.length).toBe(MONTHS);
        expect(printed).toEqual(expectedB);
        expect(printed).not.toEqual(expectedA);
    });
});

describe('GH-478 — combined export: the twelve that reach the engine are the sample\'s site\'s', () => {
    jest.setTimeout(180000);
    let page, record, calls, collected, xml;

    beforeAll(async () => {
        record = { errors: [], warnings: [], alerts: [] };
        page = loadPage(record);
        expect(page.failures).toEqual([]);
        const sandbox = page.sandbox;
        pageStandsOnB(sandbox);
        calls = watchTheStore(sandbox);

        // GH-479: the two methods the loop drives the page with are the
        // sandbox's own now, so the pointer really moves and the sample really
        // goes into the page's form. What stays behind is the page's
        // COORDINATES, which is the race this test is about.
        const switched = [];
        const innerSet = sandbox.GAIP_SampleManager.setActiveSite;
        sandbox.GAIP_SampleManager.setActiveSite = (id) => { switched.push(id); return innerSet(id); };

        // What the document was built from, captured at the border.
        collected = [];
        const innerCollect = sandbox.GAIP_WordExport.collectData;
        sandbox.GAIP_WordExport.collectData = function (inputs) {
            const data = innerCollect.call(this, inputs);
            collected.push(data);
            return data;
        };

        const entries = sandbox.GAIP_CombinedExport.enumerate('current');
        expect(entries.map((e) => e.siteId)).toEqual([SITE_ID]);
        await sandbox.GAIP_CombinedExport.exportCurrentSite();
        expect(switched).toContain(SITE_ID);
        xml = await documentXmlOf(page);
    });

    test('one report was collected, and it is site A\'s', () => {
        expect(collected.length).toBe(1);
        expect(collected[0].site.name).toBe(SITE_NAME);
    });

    test('its twelve monthly temperatures are A\'s, month by month', () => {
        const temps = collected[0].engineInputs.climate.monthlyTemps;
        expect(temps).not.toBeNull();
        const asRow = [];
        for (let m = 1; m <= MONTHS; m++) asRow.push(temps[m]);
        expect(asRow).toEqual(MONTHLY_TEMPS_FIXTURE);
    });

    test('not one of them is B\'s', () => {
        const temps = collected[0].engineInputs.climate.monthlyTemps;
        const fromB = [];
        for (let m = 1; m <= MONTHS; m++) {
            if (temps[m] === MONTHLY_TEMPS_DECOY[m - 1]) fromB.push({ month: m, value: temps[m] });
        }
        expect(fromB).toEqual([]);
    });

    test('the report\'s own resolver asked for A\'s coordinates, with both of them', () => {
        expect(calls.length).toBeGreaterThan(0);
        expect(calls.filter((c) => c.argc < 2)).toEqual([]);
        const asked = calls.map((c) => coordKey(parseFloat(c.lat), parseFloat(c.lon)));
        expect(asked).toContain(coordKey(SITE_LAT, SITE_LON));
    });

    test('the twelve the loop bakes onto the report are A\'s too, not the page\'s', () => {
        // This was a PIN: `word-export-combined.js:883` called
        // `GilbaNutritionSummary.extractMonthlyTemps()` with no site, and that
        // reader takes `window.climateMetrics.monthlyTemps`, then the
        // orchestrator's state, then the normals cached for the coordinates it
        // reads out of the DOM — three page-level answers. With the page a
        // step behind, as it is here, the loop baked the OTHER site's twelve
        // months onto this sample's report.
        //
        // GH-480 replaced that call with this sample's own resolved climate,
        // so the expectation is inverted: what the loop bakes is A's row, and
        // the page is not asked at all.
        const ctx = collected[0]._combinedCtx;
        expect(ctx).toBeTruthy();
        const asRow = [];
        for (let m = 1; m <= MONTHS; m++) asRow.push(ctx.monthlyTemps[m]);
        expect(asRow).toEqual(MONTHLY_TEMPS_FIXTURE);
        expect(asRow).not.toEqual(MONTHLY_TEMPS_DECOY);
    });

    test('the store is never asked for the page\'s coordinates during the run', () => {
        const asked = calls.map((c) => coordKey(parseFloat(c.lat), parseFloat(c.lon)));
        expect(Array.from(new Set(asked))).toEqual([coordKey(SITE_LAT, SITE_LON)]);
    });

    test('the document names A and not the site the page is standing on', () => {
        expect(xml).toContain(SITE_NAME);
        expect(xml).not.toContain('Elsewhere');
    });

    test('and its twelve PRINTED GP figures are A\'s, month by month', () => {
        // GH-479 closed the input axis: the combined document now carries the
        // Monthly N Distribution table, because the page's soil form is filled
        // the way the live one is — by loadSample(), out of the sample the
        // loop is printing. Before that this entry point could only be
        // asserted at the border, and the printed twelve existed on the single
        // export alone, which is not the path a client takes.
        const printed = printedGp(xml);
        expect(printed.length).toBe(MONTHS);
        expect(printed).toEqual(gpRow(page.sandbox, MONTHLY_TEMPS_FIXTURE));
    });

    test('not one printed figure is B\'s', () => {
        const printed = printedGp(xml);
        const expectedB = gpRow(page.sandbox, MONTHLY_TEMPS_DECOY);
        const fromB = printed
            .map((v, i) => ({ month: i + 1, printed: v, b: expectedB[i] }))
            .filter((m) => m.printed === m.b);
        expect(fromB).toEqual([]);
    });

    test('nothing wrote to console.error while it happened', () => {
        expect({ errors: record.errors }).toEqual({ errors: [] });
    });
});

/**
 * GH-480 (PLAN-GH439 section 10.6) — the methodology and the rootzone the
 * document interprets against come from the site, not from the page.
 *
 * The same shape as the temperatures above, one field along, and with the same
 * consequence for a client: the methodology decides whether a report shows
 * MLSN floors or Ammonium Acetate ranges (word-export.js branches the whole
 * threshold block on it), and the rootzone bucket decides what the AA
 * narrative states about the thresholds it applied.
 *
 * What stood there: `GAIP_STATE.soil.methodology` — a page object that is
 * undefined throughout a real export, measured on the stand — then
 * `.gaip-soil-methodology`, then the literal 'MLSN'; and for the rootzone,
 * `.gaip-aa-soil-texture`, then the same dead page object, then 'others'.
 *
 * Both fields exist on /reports/export, which embeds the legacy hub form:
 * measured on the stand, the methodology field held each site's own value as
 * the loop switched sites, and the texture field held 'sands' for all of them.
 * That is one field for a document that prints several sites — right only
 * while the switch has settled, which is the race GH-459 was filed for.
 *
 * ── Passport ────────────────────────────────────────────────────────────────
 * guarantee   The methodology and the rootzone bucket in a report are the
 *             site's own, and a site that has neither is told neither.
 * claims      By VALUE: two sites whose configs disagree resolve to their own
 *             methodologies; a poisoned page changes neither; a site with no
 *             methodology at all prints none rather than 'MLSN'; the rootzone
 *             bucket follows the site's texture and is absent when there is
 *             none. Structurally: neither selector is read any more.
 * universe    collectData(), the one border every printed soil figure passes.
 * unit        One report.
 * moment      During collection, per report.
 * distinguishability  Two configs that disagree ('ammonium_acetate' against
 *             'mlsn'), and a poisoned page whose every DOM answer is a
 *             sentinel, so "came from the site" is distinguishable from "came
 *             from the page" and from "came from a literal".
 * carrier     `data.soil.methodology` and `data.soil.aaSoilTexture` — the two
 *             values the threshold block and the AA narrative read.
 * input       The resolver by site id, which is what both entry points hand
 *             collectData.
 * positive-control  The bucket is asserted PRESENT for a site that has a
 *             texture, so "absent everywhere" cannot pass as "absent when
 *             unknown".
 * exemptions  None.
 * ratchet     None.
 * rc          The reviewer's mutation: restore either selector, or restore the
 *             'MLSN' / 'others' literal.
 * ────────────────────────────────────────────────────────────────────────────
 */
describe('GH-480 — the methodology and the rootzone are the site\'s', () => {
    const fs2 = require('fs');
    const path2 = require('path');
    /** Comments stripped: the retired reads are NAMED in the comments that
     *  replaced them, which is the documentation a reader needs and exactly
     *  what a naive text search would trip over. */
    const WORD_EXPORT = fs2.readFileSync(path2.join(__dirname, '..', 'assets', 'word-export.js'), 'utf8')
        .replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/[^\n]*/g, '$1');

    let page, npi, we;

    beforeAll(() => {
        page = loadPage({ errors: [], warnings: [], alerts: [] });
        expect(page.failures).toEqual([]);
        poisonPage(page.sandbox);
        npi = page.sandbox.GAIP_NutritionProgramInputs;
        we = page.sandbox.GAIP_WordExport;
    });

    test('neither page field is read any more', () => {
        expect(WORD_EXPORT).not.toMatch(/\.gaip-soil-methodology/);
        expect(WORD_EXPORT).not.toMatch(/querySelector\(['"]\.gaip-aa-soil-texture['"]\)/);
    });

    test('two sites whose configs disagree get their own methodology', () => {
        const mine = we.collectData(npi.resolveExportInputs({ siteId: SITE_ID }));
        const other = we.collectData(npi.resolveExportInputs({ siteId: OTHER_SITE_ID }));
        expect(mine.soil.methodology).toBe('AMMONIUM_ACETATE');
        expect(other.soil.methodology).toBe('MLSN');
    });

    test('the poisoned page reaches neither of them', () => {
        const mine = we.collectData(npi.resolveExportInputs({ siteId: SITE_ID }));
        expect(String(mine.soil.methodology)).not.toContain(POISON_SENTINEL);
        expect(String(mine.soil.aaSoilTexture)).not.toContain(POISON_SENTINEL);
    });

    test('a site with no methodology of its own prints none, not MLSN', () => {
        // The resolver ends its chain with `|| 'mlsn'` and records it as
        // source 'default'; printing that would move the substitution one
        // level down instead of removing it.
        const empty = we.collectData(EMPTY);
        expect(empty.soil.methodology).toBeNull();
    });

    test('the rootzone bucket follows the site\'s texture, and is absent when the site has none', () => {
        // GH-482: the texture comes from the row that owns it — the site's own
        // column first, the account's setting second — so this walks both
        // links and then the case where neither is set.
        const row = page.sandbox.GAIP_SiteConfig.getSite(SITE_ID);
        const sample = page.sandbox.GAIP_SampleManager.getActiveSample('soil');
        const restore = { own: row.soil_texture_override, account: row.account_soil_texture,
            snapshot: sample.soilTextureSnapshot };
        sample.soilTextureSnapshot = '';

        const sands = we.collectData(npi.resolveExportInputs({ siteId: SITE_ID }));
        expect(sands.soil.aaSoilTexture).toBe('sands');

        row.soil_texture_override = null;
        const fromAccount = we.collectData(npi.resolveExportInputs({ siteId: SITE_ID }));
        expect(fromAccount.soil.aaSoilTexture).toBe('others');

        row.account_soil_texture = null;
        const none = we.collectData(npi.resolveExportInputs({ siteId: SITE_ID }));
        expect(none.soil.aaSoilTexture).toBeNull();

        row.soil_texture_override = restore.own;
        row.account_soil_texture = restore.account;
        sample.soilTextureSnapshot = restore.snapshot;
    });

    test('the bucket is the resolver\'s own rule, not a second copy of it', () => {
        expect(WORD_EXPORT).toMatch(/GAIP_NutritionProgramInputs\.aaTextureKey\(/);
        expect(typeof npi.aaTextureKey).toBe('function');
        expect(npi.aaTextureKey('sandy loam')).toBe('sands');
        expect(npi.aaTextureKey('clay')).toBe('others');
    });
});
