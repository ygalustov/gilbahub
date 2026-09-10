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
 *   cp tests/e2e/.e2e-credentials.example.json tests/e2e/.e2e-credentials.json
 *                                     # then put a real dev login in it
 *   npm run test:e2e
 *
 * The credentials file is git-ignored and holds {"email", "password"} plus an
 * optional "url". Keeping them out of the command line is deliberate — see
 * the GH-390 comment at CREDENTIALS_PATH below.
 *
 * Optional: GILBA_E2E_CREDENTIALS (another credentials JSON),
 *           GILBA_E2E_URL (default http://127.0.0.1:8080),
 *           GILBA_E2E_FIXTURE (another fixture JSON of the same shape as
 *           tests/fixtures/e2e-parity-test5-soccer.json),
 *           GILBA_E2E_KEEP=1 to keep the generated .docx and print its path.
 *           GILBA_E2E_EMAIL / GILBA_E2E_PASSWORD still override the file.
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
 * The harness selects the fixture's soil sample through the Plan page's own
 * picker widget, the way a user does, rather than trusting the page to open on
 * it: with nothing remembered the picker opens on whatever the list order puts
 * first, which on a multi-sample site is not the fixture's sample. (Found by
 * GH-384's MLSN/SLAN fixtures, when the Plan page was on Burns' "Green 2" while
 * the export used "12th Fairway". The related defect — that a REMEMBERED
 * selection was never restored either, because a numeric API id was compared
 * with `===` against a string from localStorage — was fixed separately in
 * GH-386.)
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

// GH-390: credentials come from a local, git-ignored file by default, so the
// run command is the constant `npm run test:e2e` with nothing in front of it.
// Two reasons, both practical rather than cosmetic. A command carrying inline
// `GILBA_E2E_EMAIL=... GILBA_E2E_PASSWORD=...` assignments is a different
// string every time it is quoted or reordered, so a permission allowlist can
// never match it and every run asks again. And a password on the command line
// ends up in shell history, in process listings, and in every transcript and
// allowlist rule that quotes the command — this file is read by a real login
// against the dev stack, so that is a real secret spread across places nobody
// remembers to clean. Environment variables still win when present (CI, or a
// one-off run as a different user); the file is only the fallback.
const CREDENTIALS_PATH = process.env.GILBA_E2E_CREDENTIALS
    || path.join(__dirname, '.e2e-credentials.json');
let fileCredentials = {};
try {
    fileCredentials = JSON.parse(fs.readFileSync(CREDENTIALS_PATH, 'utf8'));
} catch (e) {
    // Absent or unreadable is not an error here — env vars may supply
    // everything. The blockers list below reports it if they don't.
    fileCredentials = {};
}

const ENABLED = process.env.GILBA_E2E === '1';
const BASE_URL = process.env.GILBA_E2E_URL || fileCredentials.url || 'http://127.0.0.1:8080';
const EMAIL = process.env.GILBA_E2E_EMAIL || fileCredentials.email;
const PASSWORD = process.env.GILBA_E2E_PASSWORD || fileCredentials.password;
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
    if (!EMAIL || !PASSWORD) {
        blockers.push('no login credentials — create ' + CREDENTIALS_PATH +
            ' as {"email": "...", "password": "..."} (git-ignored), or set ' +
            'GILBA_E2E_EMAIL / GILBA_E2E_PASSWORD');
    }
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

/**
 * Annual Product Summary footer rows ("Total Delivered", "Required (kg/ha)").
 *
 * GH-387: column-indexed off the table's own header rather than assuming N/P/K
 * sit at cells 1-3. That assumption holds for the NZ panel ("Product | N | P |
 * K") and not for the Australian one, whose header is "Product | Applications |
 * Total Rate | N | P | K" — so the harness was reading the APPLICATION COUNT as
 * the delivered N (12 instead of 120) and reporting a parity failure that was
 * entirely its own parse.
 */
function productFooterFromPlanText(text) {
    const out = {};
    const lines = text.split('\n');
    let idx = null;
    lines.forEach((line) => {
        const cells = line.split('\t').map((s) => s.trim());
        if (idx === null && /^Product$/i.test(cells[0] || '')) {
            const find = (n) => cells.findIndex((c) => c.toUpperCase() === n);
            const i = { N: find('N'), P: find('P'), K: find('K') };
            if (i.N > 0 && i.P > 0 && i.K > 0) idx = i;
            return;
        }
        // Header indices when they were found, otherwise the panel's simplest
        // layout; and if the header-derived read comes up empty for this row
        // (a footer with fewer cells than the header), fall back rather than
        // silently reporting "missing".
        // Two candidate layouts: the table's own header indices, and the
        // simple "Product | N | P | K" the NZ panel uses. Take whichever
        // actually reads three numbers off THIS row — a footer row can be
        // narrower than the header it sits under.
        const read = (cs) => {
            const at = (i) => (i > 0 && i < cs.length) ? num(cs[i]) : null;
            const score = (r) => ['N', 'P', 'K'].filter((k) => r[k] !== null).length;
            const simple = { N: at(1), P: at(2), K: at(3) };
            if (!idx) return simple;
            const byHeader = { N: at(idx.N), P: at(idx.P), K: at(idx.K) };
            return score(byHeader) >= score(simple) ? byHeader : simple;
        };
        if (cells.length >= 4 && /^Total Delivered$/i.test(cells[0]) && !out.delivered) {
            out.delivered = read(cells);
        }
        if (cells.length >= 4 && /^Required/i.test(cells[0]) && !out.required) {
            out.required = read(cells);
        }
    });
    return out;
}

/**
 * GH-387: every product name in a region's catalogues. The AU fixtures added
 * for GH-384 pass through the Australian catalogue, which this helper did not
 * know about, so assertion 14 reported every legitimate AU product as foreign.
 */
function catalogueNames(region) {
    if (region === 'au') return auCatalogueNames();
    return nzCatalogueNames();
}

/** Every product name in the AU catalogue. */
function auCatalogueNames() {
    const prevWindow = global.window;
    const prevDocument = global.document;
    global.window = {};
    global.document = { readyState: 'complete', addEventListener() {}, querySelector: () => null, querySelectorAll: () => [] };
    try {
        jest.isolateModules(() => { require('../../assets/au-fertiliser-products.js'); });
        const au = global.window.GAIP_AU_FERTILISER;
        const groups = (au && au.products) || {};
        return []
            .concat(groups.granular || [], groups.liquid || [], groups.soluble || [], groups.organic || [])
            .map((prod) => prod.name)
            .filter(Boolean);
    } finally {
        global.window = prevWindow;
        global.document = prevDocument;
    }
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
    // The requirement engine labels its SLAN results with the citation and the
    // pH-adjustment flag ('SLAN-Carrow-2004-range', '...-PH-ADJUSTED'); the
    // calendar stamps the bare methodology key. Fold the label to the branch it
    // names — this compares WHICH BRANCH each surface took, and the citation
    // suffix is not part of that answer.
    if (u.indexOf('SLAN') === 0) return 'SLAN';
    if (u.indexOf('MLSN') === 0) return 'MLSN';
    if (u.indexOf('AMMONIUM_ACETATE') === 0) return 'AMMONIUM_ACETATE';
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
            id: id, name: d.name || d.productName || null, applications: d.applications, totalKg: d.totalKg,
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
    // GH-387: the two surfaces hand the harness objects of different shapes —
    // the Plan page publishes the regional INTEGRATION's enriched programme
    // (which carries annualSummary.products), while the export hook captures
    // the RECOMMENDER's raw return (which does not). Comparing those two
    // directly made the export look like it had chosen no products at all.
    // Rolled up from the monthly series instead, which both sides always have
    // and which is what the client reads in the Monthly Schedule.
    const byName = {};
    (lp.monthly || []).forEach(function (m) {
        [].concat(m.granular || [], m.liquid || []).forEach(function (prod) {
            if (!prod || !prod.name) return;
            const e = byName[prod.name] || (byName[prod.name] = { name: prod.name, applications: 0, totalKg: 0 });
            e.applications += (prod.splitCount || 1);
            e.totalKg += (typeof prod.rateKgHa === 'number' ? prod.rateKgHa : 0) * (prod.splitCount || 1);
        });
    });
    const fromMonthly = Object.keys(byName).sort().map(function (n) {
        return { name: n, applications: byName[n].applications, totalKg: Math.round(byName[n].totalKg * 10) / 10 };
    });
    // GH-391: the annual `delivered` vector and the `targets` it is measured
    // against, at full precision. `delivered` is what both surfaces print as
    // the Annual Product Summary's "Total Delivered" row; the sum of the
    // monthly `delivers` below is what they build the product ROWS from. The
    // two must be the same quantity, and on Burns they were not — MAP Tech's
    // N reached every row and no total. Captured separately from `targets`
    // because Burns' annual N target is also ~120, which makes a rendered
    // figure alone unable to tell a correct total from the target.
    // Only the AU/UK recommenders stamp a `delivers` vector on each
    // application; the NZ one re-derives delivery from rate x analysis at
    // accumulation time, so there is nothing per-application to sum there and
    // `deliversSum` stays null rather than a misleading zero.
    let deliversSum = null;
    (lp.monthly || []).forEach(function (m) {
        [].concat(m.granular || [], m.liquid || []).forEach(function (prod) {
            const d = prod && prod.delivers;
            if (!d) return;
            if (!deliversSum) deliversSum = { N: 0, P: 0, K: 0 };
            deliversSum.N += d.N || 0;
            deliversSum.P += d.P || 0;
            deliversSum.K += d.K || 0;
        });
    });
    const jv = function (v) { return v ? { N: v.N, P: v.P, K: v.K } : null; };
    return {
        meta: lp.meta ? { surfaceType: lp.meta.surfaceType, methodology: lp.meta.methodology } : null,
        products: products, productsFromMonthly: fromMonthly, monthly: monthly,
        delivered: jv(lp.delivered), targets: jv(lp.targets), deliversSum: deliversSum
    };
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
                        turf: j(inputs && inputs.turf),
                        // GH-383: `ranges` covers AA, SLAN and MLSN; `aaRanges`
                        // is the AA-only legacy field, null on the other two.
                        ranges: j(inputs && inputs.ranges),
                        aaRanges: j(inputs && inputs.aaRanges),
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

    // GH-384: the Combined export picks the product recommender from each
    // sample's own coordinates (GH-362), so an Australian fixture never touches
    // PrebbleRecommender at all. Hook both; `hooked.recommender` means "a
    // recommender was hooked", whichever region this fixture is in.
    function hookRecommender(obj, method) {
        if (!obj || typeof obj[method] !== 'function') return false;
        const orig = obj[method];
        obj[method] = function (calendar, context) {
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
        return true;
    }
    const hookedNZ = hookRecommender(window.PrebbleRecommender, 'generateProgram');
    const hookedAU = hookRecommender(window.AuFertiliserRecommender, 'generateAnnualProgram');
    const hookedUK = hookRecommender(window.UkFertiliserRecommender, 'generateAnnualProgram');
    cap.hooked.recommender = hookedNZ || hookedAU || hookedUK;
    cap.hooked.recommenderNZ = hookedNZ;
    cap.hooked.recommenderAU = hookedAU;

    // GH-392: Mulder's interaction checker. Its `basis` is the cation map every
    // ratio rule divides, and nothing prints it, so a unit error there is
    // invisible in the document — which is how a cmol/kg conversion survived on
    // a hub that stores mg/kg. Captured as (input readings, resulting basis) so
    // the harness can assert the basis IS the readings on live page data.
    cap.mulders = [];
    if (window.GilbaMulders && typeof window.GilbaMulders.analyse === 'function') {
        const origAnalyse = window.GilbaMulders.analyse;
        window.GilbaMulders.analyse = function (nutrients, context) {
            const out = origAnalyse.apply(this, arguments);
            try {
                const input = {};
                (nutrients || []).forEach(function (n) {
                    const v = parseFloat(n && n.actual);
                    if (!isNaN(v) && v > 0) input[n.nutrient] = v;
                });
                cap.mulders.push({
                    methodology: (context && context.methodology) || null,
                    input: input,
                    basis: j(out && out.basis)
                });
            } catch (e) { cap.mulders.push({ captureError: String(e) }); }
            return out;
        };
        cap.hooked.mulders = true;
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
        let persistedBaseN = null;
        let crossTables = null;
        let crossCapture = null;
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
            await page.waitForFunction(() => !!(window.GilbaNutritionCalendar &&
                (window.NutritionPrebbleIntegration || window.NutritionAuFertiliserIntegration)), null, { timeout: 30000 });
            await page.waitForTimeout(2500); // site-config restore cascade
            await page.click('a[data-tab="nutrition"]');
            await page.waitForTimeout(1000);
            // GH-384: pin the Plan page's soil sample by driving its own picker.
            // On a multi-sample site the page opens on whichever sample the list
            // order puts first, so without this the two surfaces can silently
            // compute for DIFFERENT samples and every comparison below is
            // meaningless. Test5 - NZ has a single soil sample, which is why
            // this never showed until the MLSN and SLAN fixtures were added.
            // Driven through the UI rather than by seeding localStorage: it is
            // what a user does, and it exercises the selection path itself.
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
                return { ok: true, available };
            }, SAMPLE_LABEL);
            if (!picked.ok) {
                throw new Error('could not select "' + SAMPLE_LABEL + '" in the Plan page\'s sample picker (' +
                    picked.reason + '). Available: ' + JSON.stringify(picked.available));
            }
            await page.waitForTimeout(1200);
            const pinnedLabel = await page.evaluate(() => {
                const el = document.getElementById('plan-nut-sample-label');
                return el ? el.textContent.trim() : null;
            });
            if (pinnedLabel !== SAMPLE_LABEL) {
                throw new Error('the Plan page is computing for sample "' + pinnedLabel +
                    '" but the fixture pins "' + SAMPLE_LABEL + '" (db id ' + fixture.soilSample.dbId +
                    ') — the two surfaces would be compared on different samples.');
            }
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
                (window.PrebbleRecommender || window.AuFertiliserRecommender) && window.GAIP_SampleManager), null, { timeout: 30000 });
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
            // Each site's own persisted base N, read from the page's per-site
            // config store — the value the export is supposed to use for that
            // site, and the one the cross-site leak replaced with the active
            // site's. Captured here, used by the multi-site test below.
            persistedBaseN = await page.evaluate((ids) => {
                const out = {};
                ids.forEach((id) => {
                    const c = window.GAIP_SiteConfig && window.GAIP_SiteConfig.getConfig(id);
                    const prog = c && c.nutritionCalendarProgram;
                    out[id] = prog ? {
                        annualNBase: prog.meta && prog.meta.annualNBase,
                        targetN: prog.adjustments && prog.adjustments.target_n
                    } : null;
                });
                return out;
            }, [SITE_ID].concat(fixture.crossSite ? [fixture.crossSite.siteId] : []));

            // Only export-time calls count; the page may have run the engines on load.
            await page.evaluate(() => { const c = window.__gilbaE2E; c.calendar.length = 0; c.engine.length = 0; c.recommender.length = 0; if (c.mulders) c.mulders.length = 0; });
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

        /**
         * GH-389: a SECOND export, of this fixture's sample plus one from a
         * different site, purely for the per-site annual-N check.
         *
         * Deliberately a separate export rather than a second tick in the one
         * above: the Combined document's Annual Product Summary aggregates
         * every ticked sample, so a two-sample run would silently change what
         * every other comparison in this file means. Only the ANR table (one
         * row per sample) and the engine calls are read from this run.
         */
        async function runCrossSiteExport() {
            if (!fixture.crossSite) return;
            await page.goto(BASE_URL + '/reports/export', { waitUntil: 'domcontentloaded' });
            await page.waitForFunction(() => !!(window.GilbaNutritionCalendar && window.NutritionRequirementEngine_Pure &&
                (window.PrebbleRecommender || window.AuFertiliserRecommender) && window.GAIP_SampleManager), null, { timeout: 30000 });
            await page.waitForTimeout(2500);
            const hooked = await page.evaluate(installExportHooks, evalArg);
            if (!hooked.engine) throw new Error('could not hook the engine for the cross-site export');
            await page.click('text=Generate & Download Word');
            await page.waitForSelector('.gaip-bulk-area-backdrop', { timeout: 15000 });
            await page.waitForTimeout(600);
            await page.click('text=Deselect all');
            await page.waitForTimeout(300);
            const picked = await page.evaluate(({ uids }) => {
                const out = [];
                uids.forEach((uid) => {
                    const cb = document.querySelector('input[data-sample-uid="' + uid + '"]');
                    if (!cb) { out.push({ uid, found: false }); return; }
                    cb.checked = true;
                    cb.dispatchEvent(new Event('change', { bubbles: true }));
                    const row = cb.closest('tr');
                    out.push({ uid, found: true, label: ((row && row.querySelector('.gaip-bulk-sample-label')) || {}).textContent || '' });
                });
                return { out, checked: document.querySelectorAll('input[data-sample-uid]:checked').length };
            }, { uids: [SAMPLE_UID, fixture.crossSite.sampleUid] });
            const missing = picked.out.filter((r) => !r.found);
            if (missing.length) {
                throw new Error('cross-site export: sample(s) not in the picker: ' + JSON.stringify(missing));
            }
            if (picked.checked !== 2) {
                throw new Error('cross-site export: expected 2 checked samples, got ' + picked.checked);
            }
            await page.evaluate(() => { const c = window.__gilbaE2E; c.calendar.length = 0; c.engine.length = 0; c.recommender.length = 0; if (c.mulders) c.mulders.length = 0; });
            const [download] = await Promise.all([
                page.waitForEvent('download', { timeout: 180000 }),
                page.locator('button:has-text("Generate & Download")').last().click()
            ]);
            const p2 = path.join(os.tmpdir(), 'gilba-e2e-cross-' + Date.now() + '.docx');
            await download.saveAs(p2);
            crossTables = docxTables(readDocumentXml(p2));
            crossCapture = await page.evaluate(() => window.__gilbaE2E);
            if (process.env.GILBA_E2E_KEEP === '1') {
                process.stdout.write('[e2e] kept cross-site export ' + p2 + '\n');
            } else {
                fs.unlinkSync(p2);
            }
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
            await runCrossSiteExport();
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

        // GH-396 reshaped the Annual Nutrient Requirements table: one row per
        // sample-and-nutrient (Sample | Nutrient | Current (kg/ha, ppm) |
        // Removal | Required | Delivered | Range | Balance | Status) instead
        // of one row per sample with a (ppm, req) column pair per nutrient,
        // and the nutrient set narrowed from N/P/K/S to the Plan's N/P/K.
        // PARSING ONLY: every expected value below is untouched, because the
        // ticket changed no arithmetic. `N`, `P_req` and `K_req` still mean
        // the Required figure and `P_ppm` / `K_ppm` still mean the printed
        // soil concentration — which is now in brackets after the kg/ha
        // figure ("56 (40 ppm)") rather than in a column of its own.
        function anrTable() {
            return findTable(exportTables, ['Sample', 'Nutrient', 'Current (kg/ha, ppm)', 'Removal',
                                            'Required', 'Delivered', 'Range', 'Balance', 'Status']);
        }
        /** ppm out of a "56 (40 ppm)" Current cell; null when the cell is a dash. */
        function ppmFromCurrentCell(cell) {
            const m = /\(([-\d.]+)\s*ppm\)/.exec(String(cell || ''));
            return m ? num(m[1]) : null;
        }
        function anrRowsFor(table, label) {
            if (!table) return {};
            const out = {};
            table.slice(1).forEach((r) => {
                if (!r[0] || r[0].trim() !== label) return;
                out[String(r[1]).trim()] = {
                    current: r[2], current_ppm: ppmFromCurrentCell(r[2]),
                    current_kg: (String(r[2]).trim() === '—') ? null : num(String(r[2]).split('(')[0]),
                    removal: r[3] === '—' ? null : num(r[3]),
                    required: num(r[4]),
                    delivered: r[5] === '—' ? null : num(r[5]),
                    range: r[6], balance: r[7] === '—' ? null : num(r[7]), status: r[8], raw: r
                };
            });
            return out;
        }
        function exportAnrRow() {
            const t = anrTable();
            if (!t) return null;
            const byNut = anrRowsFor(t, SAMPLE_LABEL);
            if (!byNut.N && !byNut.P && !byNut.K) return null;
            return {
                N: byNut.N ? byNut.N.required : null,
                P_ppm: byNut.P ? byNut.P.current_ppm : null,
                P_req: byNut.P ? byNut.P.required : null,
                K_ppm: byNut.K ? byNut.K.current_ppm : null,
                K_req: byNut.K ? byNut.K.required : null,
                byNutrient: byNut,
                raw: byNut.K ? byNut.K.raw : null
            };
        }
        function exportKReconRow() {
            // GH-396 renamed this table's columns to the Plan page's words:
            // "K req" -> "Required", "K delivered" -> "Delivered", and
            // "K balance" -> "Programme vs required", which is what that
            // column always computed (Delivered - Required) and which the Plan
            // page's own Balance column never meant.
            const t = findTable(exportTables, ['Sample', 'Required', 'Delivered', 'Programme vs required', 'Spot K?']);
            if (!t) return null;
            const row = t.slice(1).find((r) => r[0] && r[0].trim() === SAMPLE_LABEL);
            if (!row) return null;
            return { K_req: num(row[1]), K_delivered: num(row[2]), K_balance: row[3] === '-' ? null : num(row[3]),
                     spot: row[4], tissue: row[5], raw: row };
        }
        /** K the Plan page says its own programme delivers, rounded. */
        function planDeliveredK() {
            const ds = deliverySummaryFromPlanText(plan.text);
            return Math.round((ds.K && ds.K.delivered) || 0);
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

        /** The ANR row for a named sample label, in the cross-site document. */
        function crossAnrRowFor(label) {
            // GH-396: same reshape as exportAnrRow() above, on the cross-site
            // document. Parsing only.
            const t = findTable(crossTables || [], ['Sample', 'Nutrient', 'Current (kg/ha, ppm)', 'Removal',
                                                    'Required', 'Delivered', 'Range', 'Balance', 'Status']);
            if (!t) return null;
            const byNut = anrRowsFor(t, label);
            if (!byNut.N && !byNut.P && !byNut.K) return null;
            return {
                label: label,
                N: byNut.N ? byNut.N.required : null,
                P_req: byNut.P ? byNut.P.required : null,
                K_req: byNut.K ? byNut.K.required : null,
                raw: byNut
            };
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
                { what: 'soil P ppm on Plan vs fixture', plan: num(planPpm.P), export: FX.soilPpm.P }
            ], 0.01).concat(
                // The ANR table PRINTS soil ppm rounded to a whole number
                // (Math.round in the renderer), so a fractional reading such as
                // 23.81 appears as 24. That is a rendering precision, not an
                // input difference — the input itself is compared exactly, per
                // nutrient, against both engines' received values in the "same
                // inputs reached both surfaces" test below.
                numericMismatches([
                    { what: 'soil K ppm printed in the export ANR row vs fixture', plan: anr.K_ppm, export: FX.soilPpm.K },
                    { what: 'soil P ppm printed in the export ANR row vs fixture', plan: anr.P_ppm, export: FX.soilPpm.P }
                ], 0.5));
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
            expect(exportProductRows()).not.toBeNull();
            expect(exportMonthlyRows()).not.toBeNull();
            expect(exportMonthlyRows().length).toBe(12);
            // GH-387: the K Reconciliation section is rendered only when the N
            // programme actually delivers some K — `_perSampleKDelivered()`
            // returns null at zero, and there is nothing to reconcile. That is
            // reachable on a real site (Burns 12th Fairway: soil K 195 ppm is
            // far above the MLSN ceiling, K req 0, and the greens products
            // chosen for it carry no K at all). Assert the two states, rather
            // than assuming the table is always there or skipping it silently.
            const krec = exportKReconRow();
            if (krec === null) {
                expect(planDeliveredK()).toBe(0);
                expect(exportText).not.toMatch(/K Reconciliation/);
            } else {
                expect(planDeliveredK()).toBeGreaterThan(0);
            }
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
                const _engRanges = eng.inputs.ranges || eng.inputs.aaRanges;
                const er = _engRanges && _engRanges[n];
                const eo = eng.out.perSample[n];
                rows.push({ what: n + ' floor: Plan vs export calendar', plan: pr && pr.min, export: cr && cr.min });
                rows.push({ what: n + ' ceiling: Plan vs export calendar', plan: pr && pr.max, export: cr && cr.max });
                rows.push({ what: n + ' floor: Plan vs export engine ranges', plan: pr && pr.min, export: er && er.min });
                rows.push({ what: n + ' ceiling: Plan vs export engine ranges', plan: pr && pr.max, export: er && er.max });
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
            // A fixture site with no tissue sample on file declares nulls; the
            // rows below would then compare "absent" against "absent" and
            // numericMismatches() reports any non-number as a mismatch. Assert
            // the absence explicitly instead of skipping it silently.
            const fixtureHasTissue = ['N', 'P', 'K'].every((n) => typeof FX.tissuePercent[n] === 'number');
            if (fixtureHasTissue) {
                ['N', 'P', 'K'].forEach((n) => {
                    rows.push({ what: 'tissue ' + n + ' %: fixture vs export calendar', plan: FX.tissuePercent[n], export: cal.inputs.tissuePercent && num(cal.inputs.tissuePercent[n]) });
                    rows.push({ what: 'tissue ' + n + ' %: fixture vs export engine', plan: FX.tissuePercent[n], export: eng.inputs.tissuePercent && num(eng.inputs.tissuePercent[n]) });
                });
            } else {
                expect({ planGate: plan.program.tissue_gate_applied, exportGate: cal.out.tissue_gate_applied })
                    .toEqual({ planGate: false, exportGate: false });
            }
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
                { what: 'K required: Plan column vs export engine annualRequirement', plan: ds.K.required, export: eng.out.perSample.K.annualRequirement }
            ];
            // GH-387: the K Reconciliation section only renders when the
            // programme delivers some K — see the render test.
            if (krec !== null) {
                rows.push({ what: 'K required: Plan column vs export K Reconciliation "K req"', plan: ds.K.required, export: krec.K_req });
            }
            expect(numericMismatches(rows, 1)).toEqual([]);
        });

        // GH-387: the three product tests below are asserted for every fixture.
        // GH-384 had let the two AU fixtures opt out with a `productParity`
        // block, on the reading that the divergence they showed was a regional
        // catalogue question outside D31. That reading was wrong — every
        // product involved came from the SAME (Australian) catalogue, and the
        // real cause was the two surfaces handing their recommender different
        // surface types. The opt-out is gone with the defect.
        test('Delivered N/P/K: Plan Nutrient Delivery Summary vs export K Reconciliation "K delivered" and Annual Product Summary', () => {
            const ds = deliverySummaryFromPlanText(plan.text);
            const footer = productFooterFromPlanText(plan.text);
            const krec = exportKReconRow();
            const prodRows = exportProductRows();
            const catalogue = catalogueNames(fixture.region || 'nz');
            if (krec === null) {
                // No K Reconciliation section — the programme delivers no K at
                // all (see the render test above). The catalogue-sum rows below
                // still apply; the two K-Reconciliation rows have nothing to
                // read, and both surfaces must agree that the answer is zero.
                expect(planDeliveredK()).toBe(0);
            }
            // The export's K delivered is the catalogue-only sum (amendment
            // rows such as gypsum are export-side additions, see b35fix322/324);
            // the Plan panel has no amendments at all, so its Delivered column
            // is the same catalogue-only quantity.
            const catalogueRows = prodRows.filter((r) => isCatalogueName(r.name, catalogue));
            // GH-387 preferred the document's OWN "Total Delivered" row on the
            // grounds that summing the per-product columns is only equal to it
            // when each row is a clean partition of the total — true of the NZ
            // table and, at the time, not of the AU one, whose rows read
            // 113 + 7 + 5 = 125 kg N/ha against a printed total of 120.
            //
            // GH-391: that was not a renderer inconsistency to be tolerated, it
            // was a real accounting defect in the AU recommender — the
            // strategic P application (MAP Tech, 12-27-0, picked for its P)
            // reached the monthly programme with its full `delivers` vector but
            // added only its P to the annual `delivered` accumulator, so its
            // 5.4 kg N was in every row and in no total. Fixed at the root, so
            // the AU table partitions like the NZ one and the region opt-out
            // below is gone with it.
            const sum = (k) => catalogueRows.reduce((s, r) => s + (r[k] || 0), 0);
            const rows = [];
            rows.push({ what: 'K delivered: Plan column vs export Annual Product Summary catalogue rows', plan: ds.K.delivered, export: sum('K') });
            rows.push({ what: 'N delivered: Plan column vs export Annual Product Summary catalogue rows', plan: ds.N.delivered, export: sum('N') });
            rows.push({ what: 'P delivered: Plan column vs export Annual Product Summary catalogue rows', plan: ds.P.delivered, export: sum('P') });
            // Each surface's printed Delivered column against its own printed
            // footer total — the check that reads the actual rendered figures.
            rows.push({ what: 'Plan Delivered column vs Plan "Total Delivered" footer (N)', plan: ds.N.delivered, export: footer.delivered && footer.delivered.N });
            rows.push({ what: 'Plan Delivered column vs Plan "Total Delivered" footer (K)', plan: ds.K.delivered, export: footer.delivered && footer.delivered.K });
            if (krec !== null) {
                rows.push({ what: 'K delivered: Plan column vs export K Reconciliation', plan: ds.K.delivered, export: krec.K_delivered });
                rows.push({ what: 'K delivered: Plan "Total Delivered" footer vs export K Reconciliation', plan: footer.delivered && footer.delivered.K, export: krec.K_delivered });
            }
            // Each export row is rounded to a whole kg before summing.
            expect(numericMismatches(rows, 0.5 * Math.max(1, catalogueRows.length) + 0.5)).toEqual([]);
        });

        // GH-391: the source-level invariant behind the rendered check above.
        // The rendered figures are rounded per row and can hide a small gap;
        // these are the recommender's own unrounded vectors on both surfaces.
        test('the programme\'s annual "delivered" is exactly the sum of its monthly applications, on both surfaces', () => {
            const rec = exportRecommenderCall();
            const surfaces = [
                { name: 'Plan page', prog: plan.products },
                { name: 'export', prog: rec && rec.out }
            ];
            const rows = [];
            surfaces.forEach((s) => {
                if (!s.prog || !s.prog.delivered || !s.prog.deliversSum) return;
                ['N', 'P', 'K'].forEach((k) => {
                    rows.push({
                        what: s.name + ': delivered.' + k + ' vs sum of monthly delivers.' + k,
                        plan: s.prog.deliversSum[k], export: s.prog.delivered[k]
                    });
                });
            });
            // Only shapes that stamp a per-application `delivers` vector can be
            // checked this way — that is the AU (and UK) recommender, and the AU
            // fixtures must actually exercise it. The NZ recommender re-derives
            // delivery from rate x analysis instead, so there is nothing
            // per-application to sum and this test has no work to do there.
            if ((fixture.region || 'nz') === 'au') {
                expect(rows.length).toBeGreaterThan(0);
            }
            expect(numericMismatches(rows, 0.05)).toEqual([]);
        });

        // GH-391: the "Total Delivered" figure is a SUM of the programme, not
        // the site's annual N target — a distinction the Burns fixture makes
        // hard to see by eye, because its annual N target is 120 and its
        // delivered N lands within a kilogram of it by design. Asserting that
        // the printed total tracks `delivered` (and not `targets`) is what
        // stops a future "fix" from quietly substituting one for the other.
        test('the Plan\'s "Total Delivered" footer prints the programme\'s delivered vector, not its targets', () => {
            const footer = productFooterFromPlanText(plan.text);
            const prog = plan.products;
            if (!prog || !prog.delivered || !footer.delivered) return;
            const rows = [];
            ['N', 'P', 'K'].forEach((k) => {
                if (prog.delivered[k] == null || footer.delivered[k] == null) return;
                // The unrounded programme figure goes in the label so a failure
                // says WHICH rounding step moved the number, not just that one did.
                rows.push({ what: 'Plan "Total Delivered" ' + k + ' vs programme delivered.' + k
                                  + ' (unrounded ' + prog.delivered[k] + ', rows sum ' + prog.deliversSum[k] + ')',
                            plan: Math.round(prog.delivered[k]), export: footer.delivered[k] });
            });
            if ((fixture.region || 'nz') === 'au') {
                expect(rows.length).toBeGreaterThan(0);
            }
            // Tolerance 1, not 0: all three regional integrations round their
            // totals twice — to 1 dp for the Nutrient Delivery Summary
            // (`nutrientTotals[k] = Math.round(nutrientTotals[k] * 10) / 10`)
            // and then to a whole number for this footer — so a true total in
            // [n + 0.45, n + 0.5) prints as n + 1. Burns lands exactly there
            // (delivered N 125.4999…, printed 126). That artefact is
            // pre-existing, shared by the AU/NZ/UK renderers alike, and is a
            // display-policy question, not this ticket's accounting defect; it
            // is deliberately not papered over here. What this assertion pins
            // is the thing that matters — the footer tracks `delivered` and
            // not `targets`, which on this fixture differ by 6 kg N.
            expect(numericMismatches(rows, 1)).toEqual([]);
            // And the "Required" row is the targets vector, kept separate.
            if (footer.required && prog.targets && prog.targets.N != null) {
                expect(Math.abs(footer.required.N - Math.round(prog.targets.N))).toBeLessThanOrEqual(1);
            }
        });

        // GH-392: Mulder's basis is the cation map every ratio rule divides,
        // and no surface prints it — which is how a cmol/kg → mg/kg conversion
        // survived on a hub that stores mg/kg. Here it is checked against the
        // readings that produced it, on live page data, for whatever
        // methodology this fixture resolved.
        test('Mulder\'s interaction basis is the soil readings themselves, unconverted', () => {
            const calls = (capture.mulders || []).filter((c) => c.basis && c.input);
            expect(capture.hooked.mulders).toBe(true);
            expect(calls.length).toBeGreaterThan(0);
            const bad = calls.filter((c) => JSON.stringify(c.basis) !== JSON.stringify(c.input));
            expect(bad).toEqual([]);
        });

        test('product selection and rates: Plan Annual Product Summary + Monthly Program vs export Annual Product Summary + Monthly Schedule', () => {
            const rec = exportRecommenderCall();
            // GH-387: rolled up from the monthly series on both sides — the two
            // surfaces hand the harness differently-shaped programme objects
            // (see summariseProgram). This is also the comparison that catches
            // the defect this ticket fixed: identical monthly nutrient series,
            // different products, because the two were given different surface
            // types.
            const planProducts = plan.products.productsFromMonthly;
            const exportProducts = rec.out.productsFromMonthly;
            expect(exportProducts.map((p) => p.name).sort()).toEqual(planProducts.map((p) => p.name).sort());
            const rows = [];
            planProducts.forEach((pp) => {
                const ep = exportProducts.find((p) => p.name === pp.name) || {};
                rows.push({ what: pp.name + ' applications', plan: pp.applications, export: ep.applications });
                rows.push({ what: pp.name + ' total kg/ha', plan: pp.totalKg, export: ep.totalKg });
            });
            expect(numericMismatches(rows, 0.05)).toEqual([]);
            // The surface each recommender was given — the input that produced
            // the divergence, asserted directly so a future regression names
            // itself instead of showing up as a different product list.
            expect({ plan: plan.products.meta && plan.products.meta.surfaceType,
                     export: rec.out.meta && rec.out.meta.surfaceType })
                .toEqual({ plan: plan.products.meta && plan.products.meta.surfaceType,
                           export: plan.products.meta && plan.products.meta.surfaceType });

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
            // The RENDERED comparison stays on the Plan's own annual summary,
            // which is what its Annual Product Summary panel prints and is
            // directly comparable to the document's table. (The monthly
            // roll-up above is comparable BETWEEN the two surfaces, because
            // both sides are rolled up the same way, but it is not the same
            // quantity as either surface's printed annual total — a liquid
            // carries rateLHa, not rateKgHa.)
            // GH-387: entries without a name cannot be matched against a
            // rendered table row; the AU annual summary keys by product id and
            // does not always repeat the name inside the entry. Those products
            // are still compared between the two surfaces by the monthly
            // roll-up above, which always has real names.
            const planRenderedProducts = plan.products.products.filter((p) => !p.isAmendment && p.name);
            const exportRows = exportProductRows().slice();
            const renderedRows = [];
            planRenderedProducts.forEach((pp) => {
                // Same product can appear twice (a base and a "balance" top-up
                // entry share the name) — take the unused row of that name
                // whose total is closest, then retire it.
                const candidates = exportRows.filter((r) => r.name === pp.name);
                candidates.sort((a, b) => Math.abs(a.totalKg - pp.totalKg) - Math.abs(b.totalKg - pp.totalKg));
                const er = candidates[0] || {};
                if (candidates[0]) exportRows.splice(exportRows.indexOf(candidates[0]), 1);
                renderedRows.push({ what: 'rendered ' + pp.name + ' applications', plan: pp.applications, export: er.applications });
                renderedRows.push({ what: 'rendered ' + pp.name + ' total kg/ha', plan: Math.round(pp.totalKg), export: er.totalKg });
                if (pp.nutrients) {
                    renderedRows.push({ what: 'rendered ' + pp.name + ' N', plan: Math.round(pp.nutrients.N), export: er.N });
                    renderedRows.push({ what: 'rendered ' + pp.name + ' K', plan: Math.round(pp.nutrients.K), export: er.K });
                }
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
            // Export (word-export-combined.js K Reconciliation, b35fix316/325,
            // the column GH-396 renamed from "K balance"):
            //   Programme vs required = Delivered − Required — PROGRAMME MINUS
            //   REQUIREMENT,
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

            // GH-396: the Plan's Balance is now printed in the export too,
            // under its own name, beside the columns it is derived from —
            // Current, Removal, Range and Status. What is asserted here is
            // presentation parity, not new arithmetic:
            //
            //   * the soil-state columns (Current in kg/ha AND the certificate
            //     ppm in brackets, Removal, Range) must be identical across the
            //     two surfaces — they come from one computeProgram() result;
            //   * each surface's printed Balance must be its own printed
            //     Current + Delivered − Removal, so neither is displaying a
            //     number it cannot justify from its own row;
            //   * the Status verdict (Deficit / Monitor / On Track / Excess /
            //     No Soil Data) must agree.
            //
            // The Status PERCENTAGE and the Balance figure itself are compared
            // across surfaces only as far as Delivered agrees, which is
            // measured by its own dedicated test above at its own documented
            // tolerance. That is not a loophole, it is a real, pre-existing gap
            // this ticket made visible rather than caused: on the SLAN fixture
            // (New test - location, "Putter Green") the Plan's P Delivered is
            // 14.0 and the export's 14.5, so Balance reads 35.3 against 35.8
            // and the same Deficit verdict prints as -7% and -5%. Cause: the
            // export's product accumulator prefers each application's
            // `delivers` vector when populated and falls back to
            // analysis × rate, while the Plan always multiplies
            // rate × splitCount × analysis; N and K agree to the last decimal
            // on all three fixtures, P does not on this one. Out of scope for a
            // presentation ticket — closing it moves printed figures in the
            // Annual Product Summary and the Purchasing Summary across all
            // three regional integrations — and reported as an open item.
            const anrByNut = (exportAnrRow() || {}).byNutrient || {};
            const gh396 = [];
            const gh396Text = [];
            const verdict = (s) => String(s == null ? '' : s).replace(/\s*\(.*$/, '').trim();
            ['N', 'P', 'K'].forEach((n) => {
                const planRow = ds[n];
                const expRow = anrByNut[n];
                if (!planRow || !expRow) {
                    gh396Text.push({ what: n + ' row present on both surfaces', plan: !!planRow, export: !!expRow });
                    return;
                }
                if (planRow.current != null && expRow.current_kg != null) {
                    gh396.push({ what: n + ' Current (kg/ha): Plan vs export ANR', plan: planRow.current, export: expRow.current_kg });
                }
                if (planRow.removal != null && expRow.removal != null) {
                    gh396.push({ what: n + ' Removal: Plan vs export ANR', plan: planRow.removal, export: expRow.removal });
                }
                // Self-consistency, per surface: the printed Balance is the
                // printed row's own arithmetic.
                if (expRow.current_kg != null && expRow.delivered != null && expRow.removal != null) {
                    gh396.push({
                        what: n + ' export Balance = its own Current + Delivered − Removal',
                        plan: expRow.balance,
                        export: +(expRow.current_kg + expRow.delivered - expRow.removal).toFixed(1)
                    });
                }
                gh396Text.push({ what: n + ' Range: Plan vs export ANR', plan: planRow.range, export: expRow.range });
                gh396Text.push({ what: n + ' Status verdict: Plan vs export ANR', plan: verdict(planRow.status), export: verdict(expRow.status) });
            });
            // GH-396: with GILBA_E2E_KEEP=1 the run prints the two tables side
            // by side, so "the numbers match" can be read rather than trusted.
            if (process.env.GILBA_E2E_KEEP === '1') {
                process.stdout.write('[e2e] GH-396 ' + SAMPLE_LABEL +
                    ' — Plan Nutrient Delivery Summary vs export Annual Nutrient Requirements\n');
                ['N', 'P', 'K'].forEach((n) => {
                    const a = ds[n] || {}; const b = anrByNut[n] || {};
                    process.stdout.write('       ' + n +
                        '  plan: current ' + a.current + ' | removal ' + a.removal +
                        ' | required ' + a.required + ' | delivered ' + a.delivered +
                        ' | range ' + a.range + ' | balance ' + a.balance + ' | ' + a.status + '\n');
                    process.stdout.write('       ' + n +
                        '  export: current ' + b.current + ' | removal ' + b.removal +
                        ' | required ' + b.required + ' | delivered ' + b.delivered +
                        ' | range ' + b.range + ' | balance ' + b.balance + ' | ' + b.status + '\n');
                });
            }
            expect(numericMismatches(gh396, 0.15)).toEqual([]);
            expect(gh396Text.filter((r) => String(r.plan) !== String(r.export))).toEqual([]);
            // And the unit note the whole ticket turns on: a soil level is
            // printed once, in kg/ha, with the certificate's ppm in brackets —
            // never as a bare ppm figure the reader has to reconcile against
            // the Plan's kg/ha by hand.
            ['P', 'K'].forEach((n) => {
                if (!anrByNut[n] || anrByNut[n].current_kg == null) return;
                expect(anrByNut[n].current).toMatch(/^[\d.]+ \([\d.]+ ppm\)$/);
            });

            if (krec === null) return; // no K Reconciliation section — see the render test
            if (krec.K_balance != null) {
                expect(numericMismatches([{
                    what: 'export "Programme vs required" = Delivered − Required', plan: krec.K_balance, export: +(krec.K_delivered - krec.K_req).toFixed(1)
                }], 0.15)).toEqual([]);
            } else {
                expect(krec.K_req).toBe(0);
            }
        });

        test('multi-site: every sample carries ITS OWN site\'s annual N, not the active site\'s (GH-383 stage 1\'s headline fix)', () => {
            if (!fixture.crossSite) {
                // Nothing to prove without a second site — say so rather than
                // passing silently.
                expect(fixture.crossSite).toBeUndefined();
                return;
            }
            const own = persistedBaseN[SITE_ID];
            const other = persistedBaseN[fixture.crossSite.siteId];
            expect(own && own.annualNBase).toBeGreaterThan(0);
            expect(other && other.annualNBase).toBeGreaterThan(0);
            // The check is only meaningful when the two targets differ — equal
            // targets make a leak indistinguishable from correct behaviour.
            expect(other.annualNBase).not.toBe(own.annualNBase);

            const mine = crossAnrRowFor(SAMPLE_LABEL);
            const theirs = crossAnrRowFor(fixture.crossSite.label);
            expect(mine).not.toBeNull();
            expect(theirs).not.toBeNull();
            expect(numericMismatches([
                { what: 'ANR "N kg/ha" for ' + SAMPLE_LABEL + ' vs that site\'s own meta.annualNBase', plan: mine.N, export: own.annualNBase },
                { what: 'ANR "N kg/ha" for ' + fixture.crossSite.label + ' vs ' + fixture.crossSite.name + '\'s own meta.annualNBase', plan: theirs.N, export: other.annualNBase }
            ], 1)).toEqual([]);
            // And the leak's own signature, named: the second site must not be
            // printing the ACTIVE site's target.
            expect(theirs.N).not.toBe(mine.N);

            // Both engine calls resolved their N from a generated programme,
            // not from the Settings fallback (which would also be a wrong
            // number here, just a differently wrong one).
            const sources = ((crossCapture && crossCapture.engine) || [])
                .map((c) => c.inputs && c.inputs.turf && c.inputs.turf.annualNSource)
                .filter((v) => v !== undefined && v !== null);
            expect(sources.length).toBeGreaterThan(0);
            expect(sources.filter((v) => v !== 'plan-persisted' && v !== 'plan')).toEqual([]);
        });

        test('every product in the export exists in this region\'s own catalogue (assertion 14)', () => {
            // GH-387: the fixture declares its region — the old text sniff
            // matched "Hill Labs" in an Australian site's document and then
            // checked its products against the NZ catalogue.
            const region = fixture.region || 'nz';
            if (region !== 'nz' && region !== 'au') return; // UK has no catalogue check yet
            const catalogue = catalogueNames(region);
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
