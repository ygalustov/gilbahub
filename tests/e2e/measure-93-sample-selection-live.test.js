'use strict';
/**
 * Measurement 93.1 (queue item 19, analyst section 93) — what changing a
 * sample in each of the four sample pickers does TODAY.
 *
 * WHY THIS EXISTS. Item 19 asks whether tissue and LOI selection can work "the
 * same way as the other samples". Read in the code, the four pickers do three
 * different things. Reading is not a measurement, so this presses each picker
 * once and prints what happened. Outcomes were named before the run:
 *   recompute: A full run (a /hub?rerun frame, a held POST analysis-cache),
 *              B recomputed on the page, C one sample analysed by the server
 *              (GET .../analyse), D nothing but the label changes;
 *   storage:   S1 in the database, S2 in this browser only, S3 nowhere.
 *
 * WHAT IT WRITES. Nothing. Every request except GET is held and answered 200
 * without reaching the server. The run is meant for an account whose pointer
 * already stands on a site with several samples (variant a). Switching the
 * pointer is possible only if GILBA_MEASURE_93_SWITCH_TO names a site: then
 * PATCH /api/active-site is the one request let through, and the pointer is put
 * back in afterAll. Both pointer values are printed either way.
 *
 * WHAT TREE IT SAW. A path -> md5 map of assets/** and app/** is taken at the
 * start and at the end. Any difference makes the run INVALID; the output file
 * says so on its first line, with the paths.
 *
 * Silent unless BOTH GILBA_E2E=1 and GILBA_E2E_MEASURE_93=1, so that
 * `npm run test:e2e:all` does not press it.
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execFileSync } = require('child_process');

const ENABLED = process.env.GILBA_E2E === '1' && process.env.GILBA_E2E_MEASURE_93 === '1';
const ROOT = path.join(__dirname, '..', '..');
// Variant (a), coordinator 24.09: run under an account whose pointer already stands
// on a site with several soil samples, so NO write reaches the server at all.
// Switching the pointer is off unless GILBA_MEASURE_93_SWITCH_TO names a site.
const SWITCH_TO = process.env.GILBA_MEASURE_93_SWITCH_TO || null;
const OUT_DIR = path.join(ROOT, 'files', 'fixes', '26-08-17-hoxton-v6', 'live-runs');

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
let guardStand = null;
try { ({ guardStand } = require('./lib/stand-guard')); } catch (e) { /* reported below */ }

// ── tree map ────────────────────────────────────────────────────────────────
const SKIP = [path.join('app', 'vendor'), path.join('app', 'storage'), 'node_modules'];
function walk(dir, out) {
    for (const name of fs.readdirSync(dir)) {
        const full = path.join(dir, name);
        const rel = path.relative(ROOT, full);
        if (SKIP.some((s) => rel === s || rel.startsWith(s + path.sep) || rel.includes(path.sep + 'node_modules'))) continue;
        const st = fs.statSync(full);
        if (st.isDirectory()) walk(full, out);
        else out[rel] = crypto.createHash('md5').update(fs.readFileSync(full)).digest('hex');
    }
    return out;
}
function treeMap() { return walk(path.join(ROOT, 'app'), walk(path.join(ROOT, 'assets'), {})); }
function aggregate(map) {
    return crypto.createHash('md5').update(Object.keys(map).sort().map((k) => k + ' ' + map[k]).join('\n')).digest('hex');
}
function roughCut() {
    // The coordinator's own method, kept as a rough cut only: it sees a file
    // appear in or leave the list of changed paths, not an edit inside one.
    try {
        const out = execFileSync('git', ['status', '--porcelain'], { cwd: ROOT, encoding: 'utf8' });
        const lines = out.split('\n').filter((l) => /^..\s+(assets|app)\//.test(l)).join('\n') + '\n';
        return crypto.createHash('md5').update(lines).digest('hex');
    } catch (e) { return 'unavailable: ' + e.message; }
}
function diffMaps(a, b) {
    const out = [];
    Object.keys(a).forEach((k) => { if (!(k in b)) out.push('removed  ' + k); else if (a[k] !== b[k]) out.push('changed  ' + k); });
    Object.keys(b).forEach((k) => { if (!(k in a)) out.push('added    ' + k); });
    return out.sort();
}

// ── output ──────────────────────────────────────────────────────────────────
const lines = [];
function say(s) { lines.push(s); process.stdout.write('[93.1] ' + s + '\n'); }

(ENABLED ? describe : describe.skip)('93.1 — what changing a sample does in each picker today', () => {
    let browser, context, page;
    let treeBefore, treeAfter, roughBefore;
    let pointerBefore = null, pointerAfterRestore = null, pointerMoveOk = false, restoreOk = false;
    let targetSiteId = null;
    const requests = [];
    let stepName = null; // name of the step whose requests are being collected

    async function login(ctx) {
        const p = await ctx.newPage();
        await p.goto(BASE_URL + '/login', { waitUntil: 'domcontentloaded' });
        await p.fill('#email', EMAIL);
        await p.fill('#password', PASSWORD);
        await Promise.all([
            p.waitForNavigation({ waitUntil: 'domcontentloaded' }).catch(() => null),
            p.click('form.login-form button[type=submit]'),
        ]);
        if (/\/login/.test(p.url())) throw new Error('login refused for ' + EMAIL);
        return p;
    }
    async function activeSiteId(p) {
        await p.goto(BASE_URL + '/dashboard?setup=0', { waitUntil: 'domcontentloaded' });
        return p.evaluate(() => (window.GAIP_HUB_CONFIG && window.GAIP_HUB_CONFIG.activeSiteId) || null);
    }
    async function setPointer(p, siteId) {
        return p.evaluate(async (id) => {
            const csrf = (document.querySelector('meta[name="csrf-token"]') || {}).content || '';
            const r = await fetch('/api/active-site', {
                method: 'PATCH', credentials: 'same-origin',
                headers: { 'Content-Type': 'application/json', Accept: 'application/json', 'X-CSRF-TOKEN': csrf },
                body: JSON.stringify({ site_id: id }),
            });
            return { status: r.status, body: (await r.text()).slice(0, 200) };
        }, siteId);
    }
    async function storageOf(p) {
        return p.evaluate(() => {
            const dump = (s) => { const o = {}; for (let i = 0; i < s.length; i++) { const k = s.key(i); o[k] = s.getItem(k); } return o; };
            return { local: dump(localStorage), session: dump(sessionStorage) };
        });
    }
    function storageDiff(a, b) {
        const out = [];
        ['local', 'session'].forEach((kind) => {
            const x = a[kind], y = b[kind];
            Object.keys(y).forEach((k) => { if (!(k in x)) out.push(kind + ' + ' + k + ' = ' + String(y[k]).slice(0, 80)); else if (x[k] !== y[k]) out.push(kind + ' ~ ' + k + ' = ' + String(y[k]).slice(0, 80)); });
            Object.keys(x).forEach((k) => { if (!(k in y)) out.push(kind + ' - ' + k); });
        });
        return out;
    }
    async function mainText(p) {
        return p.evaluate(() => (document.querySelector('main') || document.body).innerText.split('\n').map((l) => l.trim()).filter(Boolean));
    }
    function textDiff(a, b) {
        const sa = new Set(a), sb = new Set(b);
        return { gone: a.filter((l) => !sb.has(l)).slice(0, 25), came: b.filter((l) => !sa.has(l)).slice(0, 25) };
    }
    async function activeRow(p, listSel, idxAttr) {
        return p.evaluate(({ listSel, idxAttr }) => {
            const row = document.querySelector(listSel + ' .sn-drop-row.active');
            return row ? { idx: row.getAttribute(idxAttr), text: row.innerText.replace(/\s+/g, ' ').slice(0, 90) } : null;
        }, { listSel, idxAttr });
    }

    // One picker: open, choose a row that is NOT active, watch.
    async function openView(p, url, tab) {
        await p.goto(BASE_URL + url, { waitUntil: 'networkidle' }).catch((e) => say('goto failed: ' + e.message));
        if (tab) {
            // The analysis page keeps Soil & Nutrition and Water Balance in tabs that are
            // hidden until chosen; the first valid press found 0 rows for that reason.
            const clicked = await p.$eval('a[data-tab="' + tab + '"]', (a) => { a.click(); return true; }).catch((e) => 'tab click failed: ' + e.message);
            say('tab ' + tab + ': ' + clicked);
            await p.waitForTimeout(2000);
        }
    }

    // One picker: open its view (and tab), choose a row that is NOT active, watch.
    async function pressPicker(label, url, tab, listSel, idxAttr, sampleType) {
        say('── ' + label + ' — ' + url + (tab ? '#' + tab : ''));
        await openView(page, url, tab);
        await page.waitForSelector(listSel + ' .sn-drop-row', { state: 'attached', timeout: 30000 }).catch(() => say('no .sn-drop-row attached under ' + listSel + ' within 30 s'));
        // Three outcomes, not two (coordinator, after the second press printed
        // "fewer than two samples" for a picker that was simply not found):
        //   LIST NOT FOUND — the selector is not on the page;
        //   LIST FOUND, TOO FEW — printed beside what the server holds for the site;
        //   LIST FOUND, ENOUGH — measured.
        const listPresent = await page.$(listSel);
        const serverCount = await page.evaluate(async (type) => {
            const id = window.GAIP_HUB_CONFIG && window.GAIP_HUB_CONFIG.activeSiteId;
            if (!id) return 'no active site id on the page';
            const r = await fetch('/api/samples?site_id=' + encodeURIComponent(id) + '&sample_type=' + type + '&limit=100', { headers: { Accept: 'application/json' } });
            const j = await r.json().catch(() => null);
            const rows = j && (j.data || j.samples);
            return Array.isArray(rows) ? rows.length : 'unreadable (' + r.status + ')';
        }, sampleType).catch((e) => 'count failed: ' + e.message);
        if (!listPresent) { say('LIST NOT FOUND — selector ' + listSel + ' is not on the page | server has ' + serverCount + ' ' + sampleType + ' sample(s) for this site'); return; }
        const rows = await page.$$eval(listSel + ' .sn-drop-row', (els, a) => els.map((e) => ({ idx: e.getAttribute(a), active: e.classList.contains('active') })), idxAttr).catch(() => []);
        say('LIST FOUND — rows in the picker: ' + rows.length + ' | server has ' + serverCount + ' ' + sampleType + ' sample(s) | active before: ' + JSON.stringify(await activeRow(page, listSel, idxAttr)));
        if (rows.length < 2) { say('LIST FOUND, TOO FEW — ' + rows.length + ' row(s); not measured'); return; }
        const target = rows.find((r) => !r.active);
        const textBefore = await mainText(page);
        const storeBefore = await storageOf(page);
        const framesBefore = page.frames().length;
        stepName = label; const from = requests.length;
        // element.click() runs the same click listener a person's click runs, without
        // depending on the panel being open; the second press lost a row that way.
        const picked = await page.$eval(listSel + ' .sn-drop-row[' + idxAttr + '="' + target.idx + '"]', (el) => { el.click(); return true; })
            .catch((e) => 'row click failed: ' + e.message);
        say('row ' + target.idx + ' clicked: ' + picked);
        await page.waitForTimeout(3000);
        await page.waitForLoadState('networkidle', { timeout: 120000 }).catch(() => null);
        const rerunFrames = page.frames().filter((f) => /\/hub\?rerun=/.test(f.url())).map((f) => f.url());
        stepName = null;
        const mine = requests.slice(from);
        say('chosen row: ' + target.idx + ' | active after: ' + JSON.stringify(await activeRow(page, listSel, idxAttr)));
        say('frames before/after: ' + framesBefore + ' / ' + page.frames().length + ' | /hub?rerun frames: ' + JSON.stringify(rerunFrames));
        say('requests (' + mine.length + '):');
        mine.forEach((r) => say('   ' + r.method + ' ' + r.path + (r.held ? '  [HELD]' : '') + (r.body ? '  body keys: ' + r.body : '')));
        const d = textDiff(textBefore, await mainText(page));
        say('screen lines gone (' + d.gone.length + '): ' + JSON.stringify(d.gone));
        say('screen lines came (' + d.came.length + '): ' + JSON.stringify(d.came));
        say('browser storage changes: ' + JSON.stringify(storageDiff(storeBefore, await storageOf(page))));
        // Does the choice hold? Reload, then a fresh browser context.
        await page.reload({ waitUntil: 'networkidle' }).catch((e) => say('reload failed: ' + e.message));
        await openView(page, url, tab);
        await page.waitForSelector(listSel + ' .sn-drop-row', { state: 'attached', timeout: 30000 }).catch(() => say('after reload: no rows within 30 s'));
        say('after reload, active: ' + JSON.stringify(await activeRow(page, listSel, idxAttr)));
        const fresh = await browser.newContext();
        const fp = await login(fresh);
        await installHold(fresh);
        await openView(fp, url, tab);
        await fp.waitForSelector(listSel + ' .sn-drop-row', { state: 'attached', timeout: 30000 }).catch(() => say('fresh context: no rows within 30 s'));
        say('fresh browser context, active: ' + JSON.stringify(await activeRow(fp, listSel, idxAttr)));
        await fresh.close();
    }

    // Everything except GET is held; PATCH /api/active-site is the one declared exception.
    async function installHold(ctx) {
        await ctx.route('**/*', async (route) => {
            const req = route.request();
            const method = req.method();
            const u = new URL(req.url());
            const rec = { step: stepName, method, path: u.pathname + u.search, held: false, body: null };
            const post = req.postData();
            if (post) { try { rec.body = Object.keys(JSON.parse(post)).join(','); } catch (e) { rec.body = '(non-JSON, ' + post.length + ' bytes)'; } }
            if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') { if (u.pathname.startsWith('/api/') || /\/hub/.test(u.pathname)) requests.push(rec); return route.fallback(); }
            if (SWITCH_TO && method === 'PATCH' && u.pathname === '/api/active-site') { requests.push(rec); return route.fallback(); }
            rec.held = true; requests.push(rec);
            return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, held: '93.1: not written to the stand' }) });
        });
    }

    beforeAll(async () => {
        if (!chromium) throw new Error('playwright does not resolve from the repo — run `npm install`');
        if (!EMAIL || !PASSWORD) throw new Error('no credentials — see tests/e2e/.e2e-credentials.example.json');
        if (!guardStand) throw new Error('tests/e2e/lib/stand-guard.js does not resolve');
        treeBefore = treeMap(); roughBefore = roughCut();
        say('tree at start: ' + Object.keys(treeBefore).length + ' files, map hash ' + aggregate(treeBefore) + ' | rough cut (changed-paths list) ' + roughBefore);
        browser = await chromium.launch();
        context = await browser.newContext();
        // The hold is installed AFTER login: the login form is a POST, and holding it
        // is what made the first press stop at /login (24.09, 07:50 UTC).
        page = await login(context);
        await installHold(context);            // context route: runs after the page's guard falls back
        await guardStand(page);                // GH-519 remedy, named for gh532; page routes run first
        pointerBefore = await activeSiteId(page);
        say('pointer before: ' + pointerBefore);
        if (SWITCH_TO) {
            const sites = await page.evaluate(async () => (await (await fetch('/api/sites', { headers: { Accept: 'application/json' } })).json()));
            const list = (sites && (sites.sites || sites.data)) || [];
            const t = list.find((s) => s.name === SWITCH_TO);
            if (!t) throw new Error('site not found: ' + SWITCH_TO);
            targetSiteId = t.id;
            const moved = await setPointer(page, targetSiteId);
            pointerMoveOk = moved.status === 200;
            say('PATCH /api/active-site -> ' + SWITCH_TO + ' (' + targetSiteId + '): ' + JSON.stringify(moved));
        } else {
            pointerMoveOk = true;
            say('pointer NOT switched (variant a): every write, including PATCH /api/active-site, is held');
        }
    }, 120000);

    afterAll(async () => {
        try {
            if (SWITCH_TO && page && pointerBefore) {
                const back = await setPointer(page, pointerBefore);
                say('PATCH /api/active-site -> back to ' + pointerBefore + ': ' + JSON.stringify(back));
                pointerAfterRestore = await activeSiteId(page);
                restoreOk = pointerAfterRestore === pointerBefore;
            } else if (page) {
                pointerAfterRestore = await activeSiteId(page);
                restoreOk = pointerAfterRestore === pointerBefore;
            }
        } catch (e) { say('restore failed: ' + e.message); }
        if (browser) await browser.close();
        treeAfter = treeMap();
        const drift = diffMaps(treeBefore || {}, treeAfter);
        say('tree at end: ' + Object.keys(treeAfter).length + ' files, map hash ' + aggregate(treeAfter) + ' | rough cut ' + roughCut());
        say('pointer: before ' + pointerBefore + ' | after restore ' + pointerAfterRestore);
        const head = [];
        head.push(drift.length ? 'RUN INVALID — the tree moved during the run: ' + JSON.stringify(drift) : 'run valid — the tree did not move');
        head.push(pointerBefore === null
            ? 'pointer never read — the run did not get past login, and no switch was made'
            : restoreOk ? 'pointer restored: ' + pointerBefore + ' -> ' + pointerAfterRestore
                : 'POINTER NOT RESTORED — before ' + pointerBefore + ', now ' + pointerAfterRestore + ' — put it back by hand');
        fs.mkdirSync(OUT_DIR, { recursive: true });
        const file = path.join(OUT_DIR, '93-1-sample-selection-' + new Date().toISOString().replace(/[:.]/g, '-') + '.log');
        fs.writeFileSync(file, head.concat(lines).join('\n') + '\n');
        process.stdout.write('[93.1] written: ' + file + '\n');
    }, 120000);

    test('the four pickers, one press each', async () => {
        expect(pointerMoveOk).toBe(true);
        await pressPicker('water balance — soil', '/analysis', 'water-balance', '#wb-drop-list-soil', 'data-wb-idx', 'soil');
        await pressPicker('water balance — water', '/analysis', 'water-balance', '#wb-drop-list-water', 'data-wb-idx', 'water');
        await pressPicker('soil & nutrition — soil', '/analysis', 'soil-nutrition', '#sn-sample-selector', 'data-sn-idx', 'soil');
        await pressPicker('plan — soil sample', '/plan', null, '#plan-nut-sample-picker', 'data-sn-idx', 'soil');
        // A measurement, not a verdict: it passes when all four were pressed and printed.
        expect(lines.filter((l) => /^── /.test(l)).length).toBe(4);
    }, 900000);
});
