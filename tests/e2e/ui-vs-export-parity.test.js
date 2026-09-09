/**
 * E2E parity harness — drives the REAL app and compares what the user SEES on
 * the Plan page against what the client RECEIVES in the Combined Word export,
 * on one known fixture site and sample. This is the Hoxton audit's own
 * assertion 20: "UI and export return identical annual N, P and K requirements
 * for the same site" — plus assertion 14 (no cross-catalogue product leakage).
 *
 * GH-380 rewrote it after it had quietly proved nothing for two days:
 *
 *   - `require('playwright')` never resolved from the repo (the only install
 *     lived in a scratch directory), so with GILBA_E2E=1 it printed
 *     "playwright is not installed" and skipped; every full-suite "5 skipped"
 *     was this file. playwright is now a pinned devDependency and
 *     `npm run test:e2e` is the one command that runs it.
 *   - Its one recorded green run (2026-09-07) was made while the fixture's
 *     soil K sat ABOVE the ceiling, where every engine returns 0 and a
 *     divergence cannot show. The precondition test below refuses to pass
 *     unless the fixture is below floor on the nutrients it names.
 *   - It exported "whatever matched a search term on whatever site was
 *     active". It now pins the site and sample from a fixture JSON, switches
 *     the login's active site to it and restores the pointer afterwards.
 *   - It compared only the Annual Requirements cards against the ANR table.
 *     It now also compares Removal / Required / Delivered (Nutrient Delivery
 *     Summary vs ANR + K Reconciliation), the product set and rates (Annual
 *     Product Summary + Monthly Schedule on both surfaces), and — the check
 *     that catches the methodology-case class of defect directly — which
 *     methodology branch, floors/ceilings and range sources each surface
 *     actually resolved.
 *
 * HOW TO RUN (needs the docker stack at http://127.0.0.1:8080 and a real login):
 *
 *   npm install                       # playwright is a pinned devDependency
 *   npx playwright install chromium   # once per machine (~150 MB)
 *   GILBA_E2E_EMAIL=you@example.com GILBA_E2E_PASSWORD='...' npm run test:e2e
 *
 * Optional: GILBA_E2E_URL (default http://127.0.0.1:8080),
 *           GILBA_E2E_FIXTURE (another fixture JSON of the same shape as
 *           tests/fixtures/e2e-parity-test5-soccer.json),
 *           GILBA_E2E_KEEP=1 to keep the generated .docx and print its path.
 *
 * `npx jest` alone still skips this file (one stdout line says so): it needs
 * a live stack and real credentials, and the normal suite must stay offline
 * and fast. With GILBA_E2E=1 set, anything that prevents the run — playwright
 * or its browser missing, credentials missing, login refused, fixture absent
 * from the stack — is a FAILURE, never a skip.
 *
 * WHAT IT REPORTS TODAY (2026-09-09): the requirement-parity tests FAIL, and
 * they should. The audit's D31 defect is real and still open: the export's
 * ANR / K Reconciliation figures come from nutrition-requirement-engine.js,
 * which scales P/K removal against the species table's N (180 for perennial
 * ryegrass), while the Plan page (nutrition-calendar.js) scales it against the
 * site's real annual N (250 on the fixture). Do NOT widen a tolerance to make
 * them pass; they go green when D31 stage 2 (the GH-376 core cutover) lands.
 * Every other test here is a genuine "must agree today" check.
 *
 * Side effects on the stack: generating on /plan persists a fresh
 * nutritionCalendarProgram for the fixture site (exactly what the user's own
 * click does); the login's active-site pointer is switched to the fixture
 * site for the run and restored afterwards.
 */

'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const ENABLED = process.env.GILBA_E2E === '1';
const BASE_URL = process.env.GILBA_E2E_URL || 'http://127.0.0.1:8080';
const EMAIL = process.env.GILBA_E2E_EMAIL;
const PASSWORD = process.env.GILBA_E2E_PASSWORD;
const FIXTURE_PATH = process.env.GILBA_E2E_FIXTURE
    || path.join(__dirname, '../fixtures/e2e-parity-test5-soccer.json');

let chromium = null;
let playwrightError = null;
try {
    ({ chromium } = require('playwright'));
} catch (e) {
    playwrightError = e;
}

if (!ENABLED) {
    // One line, every default run: a harness that skips silently is how this
    // file spent two days reporting nothing.
    process.stdout.write('[e2e] tests/e2e/ui-vs-export-parity.test.js skipped (needs the live stack) — run it with `npm run test:e2e`, see the file header.\n');
}

const blockers = [];
if (ENABLED) {
    if (!chromium) {
        blockers.push('playwright does not resolve from the repo (' +
            (playwrightError && playwrightError.message) + ') — run `npm install`');
    }
    if (!EMAIL || !PASSWORD) blockers.push('GILBA_E2E_EMAIL / GILBA_E2E_PASSWORD are not set');
    if (!fs.existsSync(FIXTURE_PATH)) blockers.push('fixture JSON not found: ' + FIXTURE_PATH);
    try {
        execFileSync('unzip', ['-v'], { stdio: 'ignore' });
    } catch (e) {
        blockers.push('`unzip` is not on PATH (used to read word/document.xml out of the .docx)');
    }
}

const fixture = (ENABLED && fs.existsSync(FIXTURE_PATH))
    ? JSON.parse(fs.readFileSync(FIXTURE_PATH, 'utf8'))
    : null;

// ───────────────────────────── .docx reading ─────────────────────────────

function decodeEntities(s) {
    return s.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"').replace(/&apos;/g, "'")
        .replace(/&#(\d+);/g, (m, d) => String.fromCharCode(parseInt(d, 10)));
}

function readDocumentXml(file) {
    return execFileSync('unzip', ['-p', file, 'word/document.xml'], { maxBuffer: 64 * 1024 * 1024 }).toString();
}

/** Text of every <w:t> run in an XML fragment, concatenated. */
function fragmentText(xml) {
    const parts = [];
    const re = /<w:t(?:\s[^>]*)?>([^<]*)<\/w:t>/g;
    let m;
    while ((m = re.exec(xml))) parts.push(m[1]);
    return decodeEntities(parts.join(''));
}

/**
 * Every table in the document as rows of cell strings (paragraphs inside a
 * cell joined with '\n'). The docx library never nests tables in this export,
 * so a lazy <w:tbl>…</w:tbl> match is enough. Reading cells structurally
 * beats the old flat-text positional parse: a multi-paragraph cell (the
 * K Reconciliation "Spot K?" column) no longer shifts every value after it.
 */
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

/** Plain text of the whole document (paragraph per line, cells tab-separated). */
function docxText(xml) {
    return decodeEntities(xml
        .replace(/<\/w:p>/g, '\n')
        .replace(/<\/w:tc>/g, '\t')
        .replace(/<[^>]+>/g, ''))
        .replace(/[ \t]+\n/g, '\n');
}

/** First table whose header row starts with the given cells (case-insensitive). */
function findTable(tables, headerPrefix) {
    return tables.find((rows) => rows.length > 0 && headerPrefix.every((h, i) =>
        rows[0][i] != null && rows[0][i].trim().toLowerCase() === h.toLowerCase())) || null;
}

/** All tables whose header row starts with the given cells. */
function findTables(tables, headerPrefix) {
    return tables.filter((rows) => rows.length > 0 && headerPrefix.every((h, i) =>
        rows[0][i] != null && rows[0][i].trim().toLowerCase() === h.toLowerCase()));
}

function num(s) {
    if (s == null) return null;
    const v = parseFloat(String(s).replace(/[†‡]/g, '').replace(/[^0-9.+\-]/g, ''));
    return isNaN(v) ? null : v;
}

// ─────────────────────────── Plan-page text parsing ───────────────────────────

/** "<value>\n<NUTRIENT>[Generic]\nkg/ha/yr" cards → { N, P, K, Ca, Mg, S }. */
function annualFromPlanText(text) {
    const out = {};
    const lines = text.split('\n').map((l) => l.trim());
    for (let i = 1; i < lines.length - 1; i++) {
        const nutrient = lines[i].replace(/GENERIC|CERTIFICATE/i, '').trim().toUpperCase();
        if (!['N', 'P', 'K', 'CA', 'MG', 'S'].includes(nutrient)) continue;
        if (!/^kg\/ha/i.test(lines[i + 1])) continue;
        const value = parseFloat(lines[i - 1].replace(/[^0-9.\-]/g, ''));
        if (!isNaN(value)) out[nutrient === 'CA' ? 'Ca' : nutrient === 'MG' ? 'Mg' : nutrient] = value;
    }
    return out;
}

/**
 * Nutrient Delivery Summary rows — innerText gives one line per row with
 * cells tab-separated: Nutrient | Current | Removal | Required | Delivered |
 * Range | Balance | Status.
 */
function deliverySummaryFromPlanText(text) {
    const out = {};
    text.split('\n').forEach((line) => {
        const cells = line.split('\t').map((s) => s.trim());
        if (cells.length >= 8 && ['N', 'P', 'K'].includes(cells[0]) && !(cells[0] in out)) {
            out[cells[0]] = {
                current: num(cells[1]), removal: num(cells[2]), required: num(cells[3]),
                delivered: num(cells[4]), range: cells[5], balance: num(cells[6]), status: cells[7]
            };
        }
    });
    return out;
}

/** Annual Product Summary footer rows: "Total Delivered\tN\tP\tK", "Required (kg/ha)\tN\tP\tK". */
function productFooterFromPlanText(text) {
    const out = {};
    text.split('\n').forEach((line) => {
        const cells = line.split('\t').map((s) => s.trim());
        if (cells.length >= 4 && /^Total Delivered$/i.test(cells[0]) && !out.delivered) {
            out.delivered = { N: num(cells[1]), P: num(cells[2]), K: num(cells[3]) };
        }
        if (cells.length >= 4 && /^Required/i.test(cells[0]) && !out.required) {
            out.required = { N: num(cells[1]), P: num(cells[2]), K: num(cells[3]) };
        }
    });
    return out;
}

/** Every product name in the NZ catalogues (PGG Wrightson + Prebbles). */
function nzCatalogueNames() {
    const prevWindow = global.window;
    const prevDocument = global.document;
    global.window = {};
    global.document = { readyState: 'complete', addEventListener() {}, querySelector: () => null, querySelectorAll: () => [] };
    try {
        jest.isolateModules(() => {
            require('../../assets/nz-fertiliser-products.js');
            require('../../assets/prebbles-products.js');
        });
        const nz = global.window.GAIP_NZ_FERTILISER;
        const pb = global.window.PrebbleProducts;
        return []
            .concat((nz && nz.products && nz.products.granular) || [])
            .concat((nz && nz.products && nz.products.liquid) || [])
            .concat((pb && pb.granular) || [])
            .concat((pb && pb.liquid) || [])
            .map((prod) => prod.name)
            .filter(Boolean);
    } finally {
        global.window = prevWindow;
        global.document = prevDocument;
    }
}

function isCatalogueName(name, catalogue) {
    return catalogue.some((c) => c === name || name.indexOf(c) === 0 || c.indexOf(name) === 0);
}

/**
 * Collects { what, plan, export } rows whose two numbers differ by more than
 * `tol` (or where either side is missing). Asserting `toEqual([])` on the
 * result prints every offending row with both values, which is what a reader
 * of a failed run needs — a bare toBeLessThanOrEqual loses the context.
 */
function numericMismatches(rows, tol) {
    return rows.filter((r) => {
        const a = r.plan, b = r.export;
        if (typeof a !== 'number' || typeof b !== 'number' || isNaN(a) || isNaN(b)) return true;
        return Math.abs(a - b) > tol;
    }).map((r) => Object.assign({}, r, {
        diff: (typeof r.plan === 'number' && typeof r.export === 'number') ? +(r.export - r.plan).toFixed(3) : 'missing'
    }));
}

function normaliseMethodology(m) {
    const u = String(m || '').toUpperCase().replace(/[\s-]+/g, '_');
    if (u === 'AA' || u === 'AMMONIUMACETATE') return 'AMMONIUM_ACETATE';
    return u;
}

// ───────────────────── code that runs INSIDE the browser ─────────────────────
// Passed to page.evaluate() by source, so it must not close over anything.

/** Shape a regional product programme (PrebbleRecommender output) for comparison. */
function summariseProgram(lp) {
    if (!lp) return null;
    const products = Object.keys((lp.annualSummary && lp.annualSummary.products) || {}).map(function (id) {
        const d = lp.annualSummary.products[id];
        return {
            id: id, name: d.name, applications: d.applications, totalKg: d.totalKg,
            nutrients: d.nutrients ? { N: d.nutrients.N, P: d.nutrients.P, K: d.nutrients.K } : null,
            isLiquid: !!d.isLiquid, isAmendment: !!d._isAmendment
        };
    });
    const monthly = (lp.monthly || []).map(function (m) {
        return {
            month: m.month,
            granular: (m.granular || []).map(function (g) { return { name: g.name, rateKgHa: g.rateKgHa, splitCount: g.splitCount || 1 }; }),
            liquid: (m.liquid || []).map(function (l) { return { name: l.name, rateLHa: l.rateLHa, rateKgHa: l.rateKgHa, form: l.form || null }; })
        };
    });
    return { meta: lp.meta ? { surfaceType: lp.meta.surfaceType, methodology: lp.meta.methodology } : null, products: products, monthly: monthly };
}

/** Shape a nutrition-calendar computeProgram() result for comparison. */
function summariseCalendar(p) {
    if (!p) return null;
    if (p.error) return { error: p.error };
    if (p.climateDataUnavailable) return { climateDataUnavailable: true, reason: p.climateDataUnavailableReason || null };
    const j = function (x) { return x == null ? null : JSON.parse(JSON.stringify(x)); };
    return {
        annual_totals: j(p.annual_totals),
        annual_removal: j(p.annual_removal),
        annual_lift: j(p.annual_lift),
        annual_totals_range: j(p.annual_totals_range),
        annual_totals_range_source: j(p.annual_totals_range_source),
        missing_soil_data: j(p.missing_soil_data),
        tissue_gate_applied: p.tissue_gate_applied,
        meta: p.meta ? {
            methodology: p.meta.methodology, species: p.meta.species, speciesDisplay: p.meta.speciesDisplay,
            surfaceType: p.meta.surfaceType, generated: p.meta.generated, lat: p.meta.lat, lon: p.meta.lon
        } : null,
        soil: p.soil ? { ppm: j(p.soil.ppm), bulkDensity: p.soil.bulkDensity, soilDepth: p.soil.soilDepth } : null,
        adjustments: p.adjustments ? {
            target_n: p.adjustments.target_n, applied_n: p.adjustments.applied_n,
            scheduled_n_total: p.adjustments.scheduled_n_total, original_n_total: p.adjustments.original_n_total
        } : null
    };
}

/**
 * Installed on /reports/export before the export is triggered: wraps the three
 * functions the Combined export calls per sample so the harness can read the
 * INPUTS each engine received and the OUTPUTS it produced — the resolved
 * ranges, the methodology branch, removal/lift — none of which the .docx
 * prints. Observation only: every wrapper calls through unchanged.
 */
function installExportHooks(arg) {
    const summariseProgram = new Function('return ' + arg.summariseProgramSrc)();
    const summariseCalendar = new Function('return ' + arg.summariseCalendarSrc)();
    const j = function (x) { try { return x == null ? null : JSON.parse(JSON.stringify(x)); } catch (e) { return String(x); } };
    const cap = window.__gilbaE2E = { calendar: [], engine: [], recommender: [], hooked: {} };

    const NC = window.GilbaNutritionCalendar;
    if (NC && typeof NC.computeProgram === 'function') {
        const orig = NC.computeProgram;
        NC.computeProgram = function (inputs) {
            const out = orig.apply(this, arguments);
            try {
                cap.calendar.push({
                    inputs: inputs ? {
                        methodology: inputs.methodology, species: inputs.species, speciesDisplay: inputs.speciesDisplay,
                        soilTexture: inputs.soilTexture, CEC: inputs.CEC, annualNOverride: inputs.annualNOverride,
                        soilPpm: j(inputs.soilPpm), tissuePercent: j(inputs.tissuePercent),
                        bulkDensity: inputs.bulkDensity, soilDepth: inputs.soilDepth,
                        clippingManagement: inputs.clippingManagement, traffic: inputs.traffic,
                        distribution: inputs.distribution, surfaceType: inputs.surfaceType
                    } : null,
                    out: summariseCalendar(out)
                });
            } catch (e) { cap.calendar.push({ captureError: String(e) }); }
            return out;
        };
        cap.hooked.calendar = true;
    }

    const E = window.NutritionRequirementEngine_Pure;
    if (E && typeof E.compute === 'function') {
        const orig = E.compute;
        E.compute = function (inputs) {
            const out = orig.apply(this, arguments);
            try {
                const per = {};
                ['P', 'K', 'S', 'Ca', 'Mg'].forEach(function (n) {
                    const r = out && out.perSample && out.perSample[n];
                    if (!r) return;
                    per[n] = {
                        removal: r.removal, correctionRequired: r.correctionRequired, annualRequirement: r.annualRequirement,
                        // AA branch reports its range as threshold/target, SLAN as floor/ceiling.
                        floor: r.floor != null ? r.floor : (r.threshold != null ? r.threshold : null),
                        ceiling: r.ceiling != null ? r.ceiling : (r.target != null ? r.target : null),
                        intent: r.intent || null, methodology: r.methodology || null,
                        status: r.status || null, tissueInformed: !!r.tissueInformed, currentLevel: r.currentLevel
                    };
                });
                const soil = (inputs && inputs.soil) || {};
                cap.engine.push({
                    inputs: {
                        soil: { methodology: soil.methodology, P: soil.P, K: soil.K, S: soil.S, Ca: soil.Ca, Mg: soil.Mg,
                                pH: soil.pH, CEC: soil.CEC, bulkDensity: soil.bulkDensity, depth: soil.depth },
                        turf: j(inputs && inputs.turf), aaRanges: j(inputs && inputs.aaRanges),
                        tissuePercent: j(inputs && inputs.tissuePercent)
                    },
                    out: {
                        perSample: per,
                        facilityAnnualN: out && out.facility ? out.facility.annualN : null,
                        // The engine accepts the display name ("Perennial Ryegrass") and
                        // folds it to its table key itself; compare what it resolved.
                        speciesResolved: (typeof E._normalizeSpecies === 'function' && inputs && inputs.turf)
                            ? E._normalizeSpecies(inputs.turf.species) : null
                    }
                });
            } catch (e) { cap.engine.push({ captureError: String(e) }); }
            return out;
        };
        cap.hooked.engine = true;
    }

    const PR = window.PrebbleRecommender;
    if (PR && typeof PR.generateProgram === 'function') {
        const orig = PR.generateProgram;
        PR.generateProgram = function (calendar, context) {
            const out = orig.apply(this, arguments);
            try {
                cap.recommender.push({
                    calendar: calendar ? { annual_totals: j(calendar.annual_totals), meta: calendar.meta ? { methodology: calendar.meta.methodology, surfaceType: calendar.meta.surfaceType } : null } : null,
                    context: j(context),
                    out: summariseProgram(out)
                });
            } catch (e) { cap.recommender.push({ captureError: String(e) }); }
            return out;
        };
        cap.hooked.recommender = true;
    }
    return cap.hooked;
}

function readPlanState(arg) {
    const summariseProgram = new Function('return ' + arg.summariseProgramSrc)();
    const summariseCalendar = new Function('return ' + arg.summariseCalendarSrc)();
    const NC = window.GilbaNutritionCalendar;
    const el = document.querySelector('#plan-nut-results');
    // The programme the user actually sees: on an NZ site the distributor-aware
    // NutritionNzFertiliserIntegration renders its own panel (and hides the
    // plain Prebble one); every regional integration publishes what it
    // rendered as window.GAIP_NUTRITION_PROGRAM, the same global the export
    // page reads back. Fall back to the integrations' own lastProgram fields.
    const NZ = window.NutritionNzFertiliserIntegration, PI = window.NutritionPrebbleIntegration, AU = window.NutritionAuFertiliserIntegration;
    const shown = window.GAIP_NUTRITION_PROGRAM || (NZ && NZ.lastProgram) || (PI && PI.lastProgram) || (AU && AU.lastProgram) || null;
    const visiblePanels = ['[data-nz-fertiliser-recommendations]', '[data-prebble-recommendations]', '[data-au-fertiliser-recommendations]', '[data-uk-fertiliser-recommendations]']
        .filter(function (sel) { const c = document.querySelector(sel); return !!(c && getComputedStyle(c).display !== 'none' && (c.innerText || '').length > 0); });
    const distSel = document.getElementById('nz-fert-distributor-select');
    return {
        activeSiteId: window.GAIP_HUB_CONFIG && window.GAIP_HUB_CONFIG.activeSiteId,
        program: summariseCalendar(NC && NC.program),
        products: summariseProgram(shown),
        visiblePanels: visiblePanels,
        distributor: distSel ? distSel.value : null,
        text: el ? el.innerText : '',
        visible: !!(el && el.style.display !== 'none')
    };
}

// ─────────────────────────────── the suite ───────────────────────────────

const SUITE = 'E2E — Plan page and Combined Word export agree on one fixture site (Hoxton audit assertions 20 and 14)';

if (!ENABLED) {
    describe.skip(SUITE, () => { test('skipped without GILBA_E2E=1', () => {}); });
} else if (blockers.length) {
    describe(SUITE, () => {
        test('the run is possible (GILBA_E2E=1 was set, so a blocked run is a failure, not a skip)', () => {
            throw new Error('E2E harness cannot run:\n  - ' + blockers.join('\n  - '));
        });
    });
} else {
    describe(SUITE, () => {
        jest.setTimeout(240000);

        const SITE_ID = fixture.site.id;
        const SAMPLE_LABEL = fixture.soilSample.label;
        const SAMPLE_UID = SITE_ID + '::' + fixture.soilSample.clientId;
        const FX = fixture.currentInputs;
        const evalArg = { summariseProgramSrc: summariseProgram.toString(), summariseCalendarSrc: summariseCalendar.toString() };

        let browser, page, docxPath;
        let previousActiveSiteId = null;
        let plan = null;            // readPlanState() result
        let exportXml = '', exportText = '', exportTables = [];
        let capture = null;         // window.__gilbaE2E after the export
        let pickerResult = null;
        const consoleLines = [];
        const failLoud = [];

        function csrfFetch(method, url, body) {
            // Runs in-page so the browser's session cookie and the page's CSRF
            // meta token are used, exactly like dashboard-ui.js's own switcher.
            return page.evaluate(async ({ method, url, body }) => {
                const meta = document.querySelector('meta[name="csrf-token"]');
                const token = (meta && meta.content) || (window.GAIP_HUB_CONFIG && window.GAIP_HUB_CONFIG.csrfToken) || '';
                const r = await fetch(url, {
                    method,
                    headers: { 'Content-Type': 'application/json', 'X-CSRF-TOKEN': token, 'Accept': 'application/json' },
                    body: body ? JSON.stringify(body) : undefined,
                    credentials: 'same-origin'
                });
                let json = null;
                try { json = await r.json(); } catch (e) { /* non-JSON */ }
                return { ok: r.ok, status: r.status, json };
            }, { method, url, body });
        }

        async function login() {
            await page.goto(BASE_URL + '/login', { waitUntil: 'domcontentloaded' });
            await page.fill('#email', EMAIL);
            await page.fill('#password', PASSWORD);
            await Promise.all([
                page.waitForNavigation({ waitUntil: 'domcontentloaded' }).catch(() => {}),
                page.click('form.login-form button[type=submit]')
            ]);
            await page.waitForTimeout(1500);
            if (/\/login/.test(page.url())) {
                throw new Error('login was refused for ' + EMAIL + ' (still on ' + page.url() + ')');
            }
        }

        async function switchToFixtureSite() {
            const sites = await csrfFetch('GET', '/api/sites');
            if (!sites.ok) throw new Error('GET /api/sites failed: HTTP ' + sites.status);
            previousActiveSiteId = sites.json && sites.json.active_site_id;
            const listed = (sites.json && sites.json.data) || [];
            if (!listed.some((s) => s.id === SITE_ID)) {
                throw new Error('fixture site ' + SITE_ID + ' (' + fixture.site.name + ') is not among this login\'s sites: ' +
                    listed.map((s) => s.name + ' ' + s.id).join(', '));
            }
            if (previousActiveSiteId !== SITE_ID) {
                const r = await csrfFetch('PATCH', '/api/active-site', { site_id: SITE_ID });
                if (!r.ok) throw new Error('PATCH /api/active-site to the fixture site failed: HTTP ' + r.status);
            }
        }

        async function runPlan() {
            await page.goto(BASE_URL + '/plan', { waitUntil: 'domcontentloaded' });
            await page.waitForFunction(() => !!(window.GilbaNutritionCalendar && window.NutritionPrebbleIntegration), null, { timeout: 30000 });
            await page.waitForTimeout(2500); // site-config restore cascade
            await page.click('a[data-tab="nutrition"]');
            await page.waitForTimeout(1000);
            // Count fresh generations so a programme restored from the cache
            // on page load is never mistaken for the one we asked for.
            await page.evaluate(() => {
                window.__gilbaE2EGenerated = 0;
                window.__gilbaE2EPrevProgram = window.GAIP_NUTRITION_PROGRAM || null;
                document.addEventListener('gaip:nutrition-calendar-generated', () => { window.__gilbaE2EGenerated++; });
            });
            await page.click('#plan-nut-generate-btn');
            await page.waitForFunction(() => {
                const NC = window.GilbaNutritionCalendar;
                const el = document.querySelector('#plan-nut-results');
                return window.__gilbaE2EGenerated > 0 && NC && NC.program &&
                    window.GAIP_NUTRITION_PROGRAM && window.GAIP_NUTRITION_PROGRAM !== window.__gilbaE2EPrevProgram &&
                    el && el.style.display !== 'none' && /Nutrient Delivery Summary/i.test(el.innerText || '');
            }, null, { timeout: 90000 });
            await page.waitForTimeout(1500); // persist + product panel settle
            plan = await page.evaluate(readPlanState, evalArg);
        }

        async function runExport() {
            await page.goto(BASE_URL + '/reports/export', { waitUntil: 'domcontentloaded' });
            await page.waitForFunction(() => !!(window.GilbaNutritionCalendar && window.NutritionRequirementEngine_Pure &&
                window.PrebbleRecommender && window.GAIP_SampleManager), null, { timeout: 30000 });
            // The per-sample recompute takes its annual N from this input,
            // which the restore cascade fills a few seconds after load
            // (REVIEW-GH349-onward.md open question 12).
            await page.waitForFunction(() => {
                const el = document.querySelector('.gaip-nutrition-annual-n');
                return !!(el && el.value);
            }, null, { timeout: 20000 }).catch(() => {});
            await page.waitForTimeout(1500);

            const hooked = await page.evaluate(installExportHooks, evalArg);
            if (!hooked.calendar || !hooked.engine || !hooked.recommender) {
                throw new Error('could not hook the export engines on /reports/export: ' + JSON.stringify(hooked));
            }

            await page.click('text=Generate & Download Word');
            await page.waitForSelector('.gaip-bulk-area-backdrop', { timeout: 15000 });
            await page.waitForTimeout(500);
            await page.click('text=Deselect all');
            await page.waitForTimeout(300);
            pickerResult = await page.evaluate(({ uid }) => {
                const all = Array.from(document.querySelectorAll('input[data-sample-uid]')).map((cb) => ({
                    uid: cb.getAttribute('data-sample-uid'),
                    label: (cb.closest('tr') && cb.closest('tr').querySelector('.gaip-bulk-sample-label') || {}).textContent || ''
                }));
                const cb = document.querySelector('input[data-sample-uid="' + uid + '"]');
                if (!cb) return { found: false, available: all };
                cb.checked = true;
                cb.dispatchEvent(new Event('change', { bubbles: true }));
                const row = cb.closest('tr');
                return {
                    found: true,
                    rowLabel: ((row && row.querySelector('.gaip-bulk-sample-label')) || {}).textContent || '',
                    checkedCount: document.querySelectorAll('input[data-sample-uid]:checked').length,
                    available: all
                };
            }, { uid: SAMPLE_UID });
            if (!pickerResult.found) {
                throw new Error('fixture sample ' + SAMPLE_UID + ' is not in the export picker. Available: ' +
                    JSON.stringify(pickerResult.available));
            }
            if (pickerResult.rowLabel.trim() !== SAMPLE_LABEL) {
                throw new Error('picker row for ' + SAMPLE_UID + ' is labelled "' + pickerResult.rowLabel.trim() +
                    '", fixture says "' + SAMPLE_LABEL + '" — is this still the same sample?');
            }
            if (pickerResult.checkedCount !== 1) {
                throw new Error('expected exactly 1 checked sample in the picker, got ' + pickerResult.checkedCount);
            }

            // Only export-time calls count; the page may have run the engines on load.
            await page.evaluate(() => { const c = window.__gilbaE2E; c.calendar.length = 0; c.engine.length = 0; c.recommender.length = 0; });
            const [download] = await Promise.all([
                page.waitForEvent('download', { timeout: 180000 }),
                page.locator('button:has-text("Generate & Download")').last().click()
            ]);
            docxPath = path.join(os.tmpdir(), 'gilba-e2e-' + Date.now() + '.docx');
            await download.saveAs(docxPath);
            capture = await page.evaluate(() => window.__gilbaE2E);
            exportXml = readDocumentXml(docxPath);
            exportText = docxText(exportXml);
            exportTables = docxTables(exportXml);
        }

        beforeAll(async () => {
            try {
                browser = await chromium.launch({ headless: true });
            } catch (e) {
                throw new Error('Chromium could not be launched — run `npx playwright install chromium` once. Original: ' + e.message);
            }
            const context = await browser.newContext({ acceptDownloads: true, viewport: { width: 1400, height: 1000 } });
            page = await context.newPage();
            page.on('pageerror', (e) => { consoleLines.push('[PAGEERROR] ' + e.message); failLoud.push('pageerror: ' + e.message); });
            page.on('console', (m) => {
                const t = m.text();
                consoleLines.push(t);
                // The engines' own fail-loud signals — a run where these fire
                // is not a clean run even if the numbers happen to match.
                if (/GH-36[0-9]:|GH-377 |climate data unavailable|per-sample programme failed|computeProgram error/.test(t)) {
                    failLoud.push('console: ' + t.slice(0, 300));
                }
            });

            await login();
            await switchToFixtureSite();
            await runPlan();
            await runExport();
        });

        afterAll(async () => {
            try {
                if (page && previousActiveSiteId && previousActiveSiteId !== SITE_ID) {
                    await csrfFetch('PATCH', '/api/active-site', { site_id: previousActiveSiteId });
                }
            } catch (e) { /* best effort */ }
            if (browser) await browser.close();
            if (docxPath && fs.existsSync(docxPath)) {
                if (process.env.GILBA_E2E_KEEP === '1') {
                    process.stdout.write('[e2e] kept ' + docxPath + '\n');
                } else {
                    fs.unlinkSync(docxPath);
                }
            }
        });

        // ── accessors over the collected data ──

        function exportAnrRow() {
            const t = findTable(exportTables, ['Sample', 'N kg/ha', 'P ppm', 'P req', 'K ppm', 'K req', 'S ppm', 'S req']);
            if (!t) return null;
            const row = t.slice(1).find((r) => r[0] && r[0].trim() === SAMPLE_LABEL);
            if (!row) return null;
            return { N: num(row[1]), P_ppm: num(row[2]), P_req: num(row[3]), K_ppm: num(row[4]), K_req: num(row[5]),
                     S_ppm: num(row[6]), S_req: num(row[7]), raw: row };
        }
        function exportKReconRow() {
            const t = findTable(exportTables, ['Sample', 'K req', 'K delivered', 'K balance', 'Spot K?']);
            if (!t) return null;
            const row = t.slice(1).find((r) => r[0] && r[0].trim() === SAMPLE_LABEL);
            if (!row) return null;
            return { K_req: num(row[1]), K_delivered: num(row[2]), K_balance: row[3] === '-' ? null : num(row[3]),
                     spot: row[4], tissue: row[5], raw: row };
        }
        function exportProductRows() {
            const t = findTable(exportTables, ['Product', 'Applications', 'Total kg/ha', 'N']);
            if (!t) return null;
            const header = t[0].map((h) => h.trim());
            const col = (name) => header.indexOf(name);
            return t.slice(1).map((r) => ({
                name: r[0].trim(), applications: num(r[col('Applications')]), totalKg: num(r[col('Total kg/ha')]),
                N: num(r[col('N')]), P: col('P') >= 0 ? num(r[col('P')]) : 0, K: num(r[col('K')]),
                Ca: col('Ca') >= 0 ? num(r[col('Ca')]) : 0, Mg: col('Mg') >= 0 ? num(r[col('Mg')]) : 0, S: col('S') >= 0 ? num(r[col('S')]) : 0
            }));
        }
        function exportMonthlyRows() {
            const t = findTable(exportTables, ['Month', 'GP%', 'Granular Products', 'Liquid / Foliar', 'Notes']);
            if (!t) return null;
            return t.slice(1).map((r) => ({ month: r[0].trim(), gp: r[1], granular: r[2], liquid: r[3], notes: r[4] }));
        }
        /** The export's per-sample calendar call for the fixture sample (last one wins). */
        function exportCalendarCall() {
            const calls = (capture.calendar || []).filter((c) => c.inputs && c.inputs.soilPpm &&
                num(c.inputs.soilPpm.K) === FX.soilPpm.K && num(c.inputs.soilPpm.P) === FX.soilPpm.P);
            return calls.length ? calls[calls.length - 1] : null;
        }
        /** The export's requirement-engine call for the fixture sample (the last one feeds the printed tables). */
        function exportEngineCall() {
            const calls = (capture.engine || []).filter((c) => c.inputs && c.inputs.soil &&
                num(c.inputs.soil.K) === FX.soilPpm.K && num(c.inputs.soil.P) === FX.soilPpm.P);
            return calls.length ? calls[calls.length - 1] : null;
        }
        function exportRecommenderCall() {
            const calls = (capture.recommender || []).filter((c) => c.out && c.out.products);
            return calls.length ? calls[calls.length - 1] : null;
        }

        // ─────────────────────────────── tests ───────────────────────────────

        test('preconditions: the fixture site and sample are what both surfaces used, and the sample is genuinely below floor', () => {
            expect(plan.activeSiteId).toBe(SITE_ID);
            expect(plan.program && plan.program.soil && plan.program.soil.ppm).toBeTruthy();
            // Same sample on both surfaces — by its own ppm values, not by trust.
            const planPpm = plan.program.soil.ppm;
            const anr = exportAnrRow();
            expect(anr).not.toBeNull();
            const identity = numericMismatches([
                { what: 'soil K ppm on Plan vs fixture', plan: num(planPpm.K), export: FX.soilPpm.K },
                { what: 'soil P ppm on Plan vs fixture', plan: num(planPpm.P), export: FX.soilPpm.P },
                { what: 'soil K ppm in export ANR row vs fixture', plan: anr.K_ppm, export: FX.soilPpm.K },
                { what: 'soil P ppm in export ANR row vs fixture', plan: anr.P_ppm, export: FX.soilPpm.P }
            ], 0.01);
            // If this fails the fixture's currentInputs have drifted from the DB
            // (someone edited the sample) — update the fixture, this is not a
            // parity failure.
            expect(identity).toEqual([]);
            expect(exportCalendarCall()).not.toBeNull();
            expect(exportEngineCall()).not.toBeNull();
            expect(exportRecommenderCall()).not.toBeNull();

            // Meaningfulness: above the ceiling every engine returns 0 and the
            // two surfaces cannot be told apart. The run only counts when the
            // fixture is below the floor the Plan page itself resolved.
            const notBelowFloor = (fixture.mustBeBelowFloor || []).filter((n) => {
                const range = plan.program.annual_totals_range && plan.program.annual_totals_range[n];
                return !(range && typeof range.min === 'number' && num(planPpm[n]) < range.min);
            });
            expect({ notBelowFloor, ranges: plan.program.annual_totals_range, ppm: planPpm }).toEqual(
                expect.objectContaining({ notBelowFloor: [] }));
        });

        test('the Plan page rendered a full programme (cards, Nutrient Delivery Summary, Annual Product Summary)', () => {
            expect(plan.visible).toBe(true);
            expect(plan.text).toMatch(/Annual Requirements/i);
            expect(plan.text).toMatch(/Nutrient Delivery Summary/i);
            expect(plan.text).toMatch(/Annual Product Summary/i);
            expect(Object.keys(annualFromPlanText(plan.text)).sort()).toEqual(expect.arrayContaining(['N', 'P', 'K']));
            expect(Object.keys(deliverySummaryFromPlanText(plan.text)).sort()).toEqual(['K', 'N', 'P']);
            expect(plan.products && plan.products.products.length).toBeGreaterThan(0);
        });

        test('the export rendered the sample\'s Nutrition Program, Annual Nutrient Requirements and K Reconciliation', () => {
            expect(exportText).toMatch(/Annual Nutrient Requirements/);
            expect(exportAnrRow()).not.toBeNull();
            expect(exportKReconRow()).not.toBeNull();
            expect(exportProductRows()).not.toBeNull();
            expect(exportMonthlyRows()).not.toBeNull();
            expect(exportMonthlyRows().length).toBe(12);
        });

        test('no fail-loud signal fired on either surface', () => {
            expect(failLoud).toEqual([]);
        });

        test('sufficiency thresholds: both surfaces resolved the same methodology branch, floors/ceilings and range sources', () => {
            // This is the check that catches the methodology-case class of
            // defect directly: a calendar that silently takes the MLSN branch
            // has no AA ranges at all (annual_totals_range is null per
            // nutrient) whatever its range-source stamp claims, and an engine
            // handed a different aaRanges object prints a different floor.
            const cal = exportCalendarCall();
            const eng = exportEngineCall();
            const planMeth = normaliseMethodology(plan.program.meta.methodology);
            expect({
                plan: planMeth,
                exportCalendar: normaliseMethodology(cal.out.meta && cal.out.meta.methodology),
                exportCalendarInput: normaliseMethodology(cal.inputs.methodology),
                exportEngineInput: normaliseMethodology(eng.inputs.soil.methodology)
            }).toEqual({ plan: planMeth, exportCalendar: planMeth, exportCalendarInput: planMeth, exportEngineInput: planMeth });

            const rows = [];
            const sources = [];
            ['P', 'K', 'Ca', 'Mg', 'S'].forEach((n) => {
                const pr = plan.program.annual_totals_range && plan.program.annual_totals_range[n];
                const cr = cal.out.annual_totals_range && cal.out.annual_totals_range[n];
                const er = eng.inputs.aaRanges && eng.inputs.aaRanges[n];
                const eo = eng.out.perSample[n];
                rows.push({ what: n + ' floor: Plan vs export calendar', plan: pr && pr.min, export: cr && cr.min });
                rows.push({ what: n + ' ceiling: Plan vs export calendar', plan: pr && pr.max, export: cr && cr.max });
                rows.push({ what: n + ' floor: Plan vs export engine aaRanges', plan: pr && pr.min, export: er && er.min });
                rows.push({ what: n + ' ceiling: Plan vs export engine aaRanges', plan: pr && pr.max, export: er && er.max });
                if (eo) {
                    rows.push({ what: n + ' floor: Plan vs export engine output', plan: pr && pr.min, export: eo.floor });
                    rows.push({ what: n + ' ceiling: Plan vs export engine output', plan: pr && pr.max, export: eo.ceiling });
                    sources.push({ what: n + ' engine methodology', plan: planMeth, export: normaliseMethodology(eo.methodology) });
                }
                sources.push({
                    what: n + ' range source',
                    plan: plan.program.annual_totals_range_source && plan.program.annual_totals_range_source[n],
                    export: cal.out.annual_totals_range_source && cal.out.annual_totals_range_source[n]
                });
            });
            expect(numericMismatches(rows, 1e-6)).toEqual([]);
            expect(sources.filter((s) => s.plan !== s.export)).toEqual([]);
        });

        test('same inputs reached both surfaces: species, annual N, soil ppm, tissue, bulk density / depth', () => {
            const cal = exportCalendarCall();
            const eng = exportEngineCall();
            const cards = annualFromPlanText(plan.text);
            const anr = exportAnrRow();
            // word-export.js hands the engine the display name ("Perennial
            // Ryegrass") where the calendar gets the key ("perennialRyegrass");
            // the engine's own normalizeSpecies() folds it, so the resolved key
            // is what has to agree.
            expect({ plan: plan.program.meta.species, exportCalendar: cal.out.meta && cal.out.meta.species, exportEngine: eng.out.speciesResolved || (eng.inputs.turf && eng.inputs.turf.species) })
                .toEqual({ plan: plan.program.meta.species, exportCalendar: plan.program.meta.species, exportEngine: plan.program.meta.species });
            const rows = [
                { what: 'annual N: Plan card vs export ANR "N kg/ha"', plan: cards.N, export: anr.N },
                { what: 'annual N: Plan target vs export calendar target', plan: plan.program.adjustments.target_n, export: cal.out.adjustments && cal.out.adjustments.target_n },
                { what: 'annual N: Plan target vs export engine facility N', plan: plan.program.adjustments.target_n, export: eng.out.facilityAnnualN },
                { what: 'bulk density: Plan vs export calendar', plan: plan.program.soil.bulkDensity, export: cal.out.soil && cal.out.soil.bulkDensity },
                { what: 'soil depth: Plan vs export calendar', plan: plan.program.soil.soilDepth, export: cal.out.soil && cal.out.soil.soilDepth }
            ];
            ['P', 'K', 'Ca', 'Mg', 'S'].forEach((n) => {
                rows.push({ what: 'soil ' + n + ' ppm: Plan vs export calendar', plan: num(plan.program.soil.ppm[n]), export: num(cal.inputs.soilPpm[n]) });
                rows.push({ what: 'soil ' + n + ' ppm: Plan vs export engine', plan: num(plan.program.soil.ppm[n]), export: num(eng.inputs.soil[n]) });
            });
            ['N', 'P', 'K'].forEach((n) => {
                rows.push({ what: 'tissue ' + n + ' %: fixture vs export calendar', plan: FX.tissuePercent[n], export: cal.inputs.tissuePercent && num(cal.inputs.tissuePercent[n]) });
                rows.push({ what: 'tissue ' + n + ' %: fixture vs export engine', plan: FX.tissuePercent[n], export: eng.inputs.tissuePercent && num(eng.inputs.tissuePercent[n]) });
            });
            expect(numericMismatches(rows, 0.01)).toEqual([]);
            expect({ plan: plan.program.tissue_gate_applied, exportCalendar: cal.out.tissue_gate_applied })
                .toEqual({ plan: plan.program.tissue_gate_applied, exportCalendar: plan.program.tissue_gate_applied });
        });

        test('the export\'s calendar branch (Monthly Schedule inputs) reproduces the Plan programme: removal, lift, totals', () => {
            // Same function (nutrition-calendar.js computeProgram) on both
            // surfaces, so anything but equality here means the export fed it
            // different inputs — the class of defect GH-363 and the
            // methodology-case bug belonged to.
            const cal = exportCalendarCall();
            const rows = [];
            ['N', 'P', 'K', 'Ca', 'Mg', 'S'].forEach((n) => {
                rows.push({ what: n + ' annual_totals', plan: plan.program.annual_totals[n], export: cal.out.annual_totals && cal.out.annual_totals[n] });
                if (n !== 'N') {
                    rows.push({ what: n + ' annual_removal', plan: plan.program.annual_removal[n], export: cal.out.annual_removal && cal.out.annual_removal[n] });
                    rows.push({ what: n + ' annual_lift', plan: plan.program.annual_lift[n], export: cal.out.annual_lift && cal.out.annual_lift[n] });
                }
            });
            expect(numericMismatches(rows, 0.05)).toEqual([]);
        });

        test('the below-floor correction term (GH-370) agrees between the export\'s requirement engine and the Plan', () => {
            const eng = exportEngineCall();
            const rows = ['P', 'K', 'S'].filter((n) => eng.out.perSample[n]).map((n) => ({
                what: n + ' correction (lift): Plan annual_lift vs export engine correctionRequired',
                plan: plan.program.annual_lift[n], export: eng.out.perSample[n].correctionRequired
            }));
            expect(rows.length).toBeGreaterThan(0);
            expect(numericMismatches(rows, 0.05)).toEqual([]);
        });

        test('annual N/P/K requirement: Plan cards vs export Annual Nutrient Requirements table (assertion 20) — FAILS until D31 stage 2', () => {
            // Known-open defect, deliberately NOT masked: the export's ANR row
            // is nutrition-requirement-engine.js output (removal scaled against
            // the species table's N), the Plan card is nutrition-calendar.js
            // output (removal scaled against the site's real annual N). The
            // GH-376 core cutover is what makes these equal. 1 kg/ha covers the
            // integer-vs-one-decimal rendering difference, nothing more.
            const cards = annualFromPlanText(plan.text);
            const anr = exportAnrRow();
            const rows = [
                { what: 'N: Plan card vs export ANR', plan: cards.N, export: anr.N },
                { what: 'P: Plan card vs export ANR "P req"', plan: cards.P, export: anr.P_req },
                { what: 'K: Plan card vs export ANR "K req"', plan: cards.K, export: anr.K_req }
            ];
            expect(numericMismatches(rows, 1)).toEqual([]);
        });

        test('Removal and Required per nutrient: Plan Nutrient Delivery Summary vs export engine / K Reconciliation — FAILS until D31 stage 2', () => {
            // Same defect as the previous test, seen through the other two
            // surfaces that print it: the Plan's Removal/Required columns and
            // the export's K Reconciliation "K req" (removal itself is not
            // printed by the export, so that half is read from the engine call).
            const ds = deliverySummaryFromPlanText(plan.text);
            const eng = exportEngineCall();
            const krec = exportKReconRow();
            const rows = [
                { what: 'P removal: Plan column vs export engine', plan: ds.P.removal, export: eng.out.perSample.P.removal },
                { what: 'K removal: Plan column vs export engine', plan: ds.K.removal, export: eng.out.perSample.K.removal },
                { what: 'P required: Plan column vs export engine annualRequirement', plan: ds.P.required, export: eng.out.perSample.P.annualRequirement },
                { what: 'K required: Plan column vs export engine annualRequirement', plan: ds.K.required, export: eng.out.perSample.K.annualRequirement },
                { what: 'K required: Plan column vs export K Reconciliation "K req"', plan: ds.K.required, export: krec.K_req }
            ];
            expect(numericMismatches(rows, 1)).toEqual([]);
        });

        test('Delivered N/P/K: Plan Nutrient Delivery Summary vs export K Reconciliation "K delivered" and Annual Product Summary', () => {
            const ds = deliverySummaryFromPlanText(plan.text);
            const footer = productFooterFromPlanText(plan.text);
            const krec = exportKReconRow();
            const prodRows = exportProductRows();
            const catalogue = nzCatalogueNames();
            // The export's K delivered is the catalogue-only sum (amendment
            // rows such as gypsum are export-side additions, see b35fix322/324);
            // the Plan panel has no amendments at all, so its Delivered column
            // is the same catalogue-only quantity.
            const catalogueRows = prodRows.filter((r) => isCatalogueName(r.name, catalogue));
            const sum = (k) => catalogueRows.reduce((s, r) => s + (r[k] || 0), 0);
            const rows = [
                { what: 'K delivered: Plan column vs export K Reconciliation', plan: ds.K.delivered, export: krec.K_delivered },
                { what: 'K delivered: Plan column vs export Annual Product Summary catalogue rows', plan: ds.K.delivered, export: sum('K') },
                { what: 'N delivered: Plan column vs export Annual Product Summary catalogue rows', plan: ds.N.delivered, export: sum('N') },
                { what: 'P delivered: Plan column vs export Annual Product Summary catalogue rows', plan: ds.P.delivered, export: sum('P') },
                { what: 'K delivered: Plan "Total Delivered" footer vs export K Reconciliation', plan: footer.delivered && footer.delivered.K, export: krec.K_delivered }
            ];
            // Each export row is rounded to a whole kg before summing.
            expect(numericMismatches(rows, 0.5 * Math.max(1, catalogueRows.length) + 0.5)).toEqual([]);
        });

        test('product selection and rates: Plan Annual Product Summary + Monthly Program vs export Annual Product Summary + Monthly Schedule', () => {
            const rec = exportRecommenderCall();
            const planProducts = plan.products.products.filter((p) => !p.isAmendment);
            const exportProducts = rec.out.products.filter((p) => !p.isAmendment);
            // Structured: the recommender ran with the same calendar on both
            // surfaces, so ids, application counts and totals must match.
            expect(exportProducts.map((p) => p.id).sort()).toEqual(planProducts.map((p) => p.id).sort());
            const rows = [];
            planProducts.forEach((pp) => {
                const ep = exportProducts.find((p) => p.id === pp.id) || {};
                rows.push({ what: pp.name + ' applications', plan: pp.applications, export: ep.applications });
                rows.push({ what: pp.name + ' total kg/ha', plan: pp.totalKg, export: ep.totalKg });
                ['N', 'P', 'K'].forEach((n) => rows.push({ what: pp.name + ' ' + n + ' delivered', plan: pp.nutrients && pp.nutrients[n], export: ep.nutrients && ep.nutrients[n] }));
            });
            expect(numericMismatches(rows, 0.05)).toEqual([]);

            // Month by month, the same granular and liquid products at the same rates.
            const monthRows = [];
            const monthMismatch = [];
            plan.products.monthly.forEach((pm, i) => {
                const em = rec.out.monthly[i] || { granular: [], liquid: [] };
                const key = (x) => x.name + ' @ ' + (x.rateKgHa != null ? x.rateKgHa : x.rateLHa) + ' x' + (x.splitCount || 1);
                const pg = pm.granular.map(key).sort(), eg = em.granular.map(key).sort();
                const pl = pm.liquid.map((l) => l.name + ' @ ' + (l.rateLHa != null ? l.rateLHa : l.rateKgHa)).sort();
                const el = em.liquid.map((l) => l.name + ' @ ' + (l.rateLHa != null ? l.rateLHa : l.rateKgHa)).sort();
                if (JSON.stringify(pg) !== JSON.stringify(eg) || JSON.stringify(pl) !== JSON.stringify(el)) {
                    monthMismatch.push({ month: pm.month, plan: { granular: pg, liquid: pl }, export: { granular: eg, liquid: el } });
                }
                monthRows.push(pm.month);
            });
            expect(monthRows.length).toBe(12);
            expect(monthMismatch).toEqual([]);

            // Rendered: every Plan product is a row of the export's table with
            // the same figures, and every Plan granular application appears in
            // the export's Monthly Schedule cell for that month.
            const exportRows = exportProductRows().slice();
            const renderedRows = [];
            planProducts.forEach((pp) => {
                // Same product can appear twice (a base and a "balance" top-up
                // entry share the name) — take the unused row of that name
                // whose total is closest, then retire it.
                const candidates = exportRows.filter((r) => r.name === pp.name);
                candidates.sort((a, b) => Math.abs(a.totalKg - pp.totalKg) - Math.abs(b.totalKg - pp.totalKg));
                const er = candidates[0] || {};
                if (candidates[0]) exportRows.splice(exportRows.indexOf(candidates[0]), 1);
                renderedRows.push({ what: 'rendered ' + pp.name + ' applications', plan: pp.applications, export: er.applications });
                renderedRows.push({ what: 'rendered ' + pp.name + ' total kg/ha', plan: Math.round(pp.totalKg), export: er.totalKg });
                renderedRows.push({ what: 'rendered ' + pp.name + ' N', plan: Math.round(pp.nutrients.N), export: er.N });
                renderedRows.push({ what: 'rendered ' + pp.name + ' K', plan: Math.round(pp.nutrients.K), export: er.K });
                expect(plan.text).toContain(pp.name);
            });
            expect(numericMismatches(renderedRows, 1)).toEqual([]);
            const schedule = exportMonthlyRows();
            const missingFromSchedule = [];
            plan.products.monthly.forEach((pm, i) => {
                pm.granular.forEach((g) => {
                    const expected = g.name + ' @ ' + g.rateKgHa + ' kg/ha';
                    if (!schedule[i] || schedule[i].granular.indexOf(expected) === -1) {
                        missingFromSchedule.push({ month: pm.month, expected, exportCell: schedule[i] && schedule[i].granular });
                    }
                });
            });
            expect(missingFromSchedule).toEqual([]);
        });

        test('"Balance" means different things on the two surfaces — each is consistent with its own definition', () => {
            // Plan (nutrition-prebble-integration.js classifyBalance, GH-312):
            //   Balance = Current + Delivered − Removal — the PROJECTED SOIL POOL
            //   in kg/ha at season end, judged against the floor/ceiling range.
            // Export (word-export-combined.js K Reconciliation, b35fix316/325):
            //   K balance = K delivered − K req — PROGRAMME MINUS REQUIREMENT,
            //   i.e. how far the N programme's incidental K falls short of the
            //   engine's figure; '-' when K req is 0.
            // They are not the same quantity and must not be forced equal; what
            // is asserted is that each surface's printed Balance is the
            // arithmetic of its own printed inputs.
            const ds = deliverySummaryFromPlanText(plan.text);
            const krec = exportKReconRow();
            const planRows = ['P', 'K'].filter((n) => ds[n] && ds[n].current != null && ds[n].removal != null).map((n) => ({
                what: 'Plan ' + n + ' Balance = Current + Delivered − Removal',
                plan: ds[n].balance, export: +(ds[n].current + ds[n].delivered - ds[n].removal).toFixed(1)
            }));
            expect(planRows.length).toBeGreaterThan(0);
            expect(numericMismatches(planRows, 0.15)).toEqual([]);
            if (krec.K_balance != null) {
                expect(numericMismatches([{
                    what: 'export K balance = K delivered − K req', plan: krec.K_balance, export: +(krec.K_delivered - krec.K_req).toFixed(1)
                }], 0.15)).toEqual([]);
            } else {
                expect(krec.K_req).toBe(0);
            }
        });

        test('every product in the export exists in this region\'s own catalogue (assertion 14)', () => {
            const isNZ = /Prebble|NZ Fertiliser|Hill Labs|New Zealand/i.test(exportText);
            if (!isNZ) return; // an AU/UK fixture needs its own inverse check
            const catalogue = nzCatalogueNames();
            expect(catalogue.length).toBeGreaterThan(0);
            const rec = exportRecommenderCall();
            // Name-for-name against the catalogue modules, not a hand-written
            // list of "foreign-looking" brands: FoliMAX reads Australian but is
            // a PGG Wrightson NZ line — the audit's own misattribution.
            const missing = rec.out.products.filter((p) => !p.isAmendment).map((p) => p.name)
                .filter((name) => !isCatalogueName(name, catalogue));
            expect(missing).toEqual([]);
            const renderedMissing = exportProductRows().map((r) => r.name)
                .filter((name) => !isCatalogueName(name, catalogue))
                // amendment rows (gypsum, dolomite, Epsom salts, SOP) are export-side by design
                .filter((name) => !/gypsum|dolomite|lime|magnesium sulphate|epsom|potassium sulphate|sulphate of potash|elemental sulphur/i.test(name));
            expect(renderedMissing).toEqual([]);
        });
    });
}
