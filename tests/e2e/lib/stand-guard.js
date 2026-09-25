/**
 * GH-519 — a live run does not change the state of existing sites.
 *
 * WHY THIS EXISTS. Nineteen live tests press Generate on the Plan page. A
 * generated programme persists itself, so every one of those presses writes to
 * the site it was pressed on, and — measured across the nineteen — not one of
 * them puts the configuration back. That is how a fabricated nutrition
 * programme came to sit on Russley, where it then prefilled the very field the
 * test that wrote it needs empty.
 *
 * THE REMEDY, AND WHY THIS ONE. Three were available:
 *
 *   1. the test creates its own site and deletes it — the pattern already in
 *      the tree at tests/e2e/gh439-config-reset-live.test.js, which works
 *      because that test needs no pre-existing data;
 *   2. the test captures the configuration and puts it back;
 *   3. the write never leaves the browser.
 *
 * Seventeen of the nineteen open the sample picker and select a soil sample. A
 * site created a moment ago has no samples, so (1) cannot carry them without
 * inventing lab data, and inventing lab data is the thing this project refuses
 * to do. Between (2) and (3): a capture-and-restore leaves the stand holding a
 * fabricated programme for the length of the run, and a process killed in that
 * window leaves it there for good. Nothing is written here, so there is nothing
 * to undo.
 *
 * WHAT IT BLOCKS, and the list is derived from the snapshot rather than from
 * memory: every endpoint whose write lands in a table that belongs to a site —
 * site_configs, samples, site_summaries, predictions, sites. Everything else,
 * including every GET and the active-site pointer, goes to the server
 * untouched, because a route that swallows the page's traffic also swallows
 * what the test is trying to see.
 *
 * WHAT IT DOES NOT DO. It does not make a test pass. A test whose claim is that
 * a write SURVIVES — that a second browser reads back what the first one saved
 * — is broken by this guard rather than protected by it, and must use remedy
 * (1) or (2) instead. gh394-traffic-live.test.js is exactly that case.
 */

'use strict';

/** Endpoints whose writes land in a table the stand snapshot watches. */
const SITE_STATE_WRITES = [
    { re: /\/api\/sites\/[^/]+\/config\//, table: 'site_configs' },
    // GH-546 (stage 1): sub-paths too, not just the exact route.
    // This was anchored at `(\?|$)`, so it covered `/api/analysis-cache`
    // and nothing under it. Stage 2 adds the run's failure report at
    // `/api/analysis-cache/runs` — a write to the same storage — and it
    // would have arrived UNGUARDED, with the guard still reporting that it
    // protects this table. The other entries here already read `(\/|\?|$)`
    // for the same reason. Widened now rather than with the route, because
    // a guard is worth least on the day the thing it guards is new.
    // GH-550 (stage 4): the storage moved out of the settings table into
    // `analysis_results`. The route did not move, so the pattern is unchanged
    // and the TABLE it is labelled with is not — a guard that names the wrong
    // table tells the reader of its report the wrong thing about what was held.
    { re: /\/api\/analysis-cache(\/|\?|$)/, table: 'analysis_results' },
    { re: /\/api\/samples(\/|\?|$)/, table: 'samples' },
    { re: /\/api\/site-summaries(\/|\?|$)/, table: 'site_summaries' },
    { re: /\/api\/predictions(\/|\?|$)/, table: 'predictions' },
    { re: /\/api\/sites\/sync(\?|$)/, table: 'sites' }
];

const READ_METHODS = ['GET', 'HEAD', 'OPTIONS'];

/**
 * Install the guard on a page or a context. Returns a record that names, after
 * the run, what was held back and what still reached the server — so "narrow"
 * is a pair of numbers rather than an argument about the patterns above.
 */
async function guardStand(target) {
    const held = [];
    const reached = [];
    await target.route('**/api/**', async (route) => {
        const req = route.request();
        const method = req.method();
        const url = req.url();
        if (READ_METHODS.indexOf(method) >= 0) { reached.push(method + ' ' + path(url)); return route.fallback(); }
        const hit = SITE_STATE_WRITES.filter((w) => w.re.test(url))[0];
        if (!hit) { reached.push(method + ' ' + path(url)); return route.fallback(); }
        let body = null;
        try { body = req.postData(); } catch (e) { body = null; }
        held.push({
            method: method,
            path: path(url),
            table: hit.table,
            bytes: body ? body.length : 0,
            keys: patchKeys(body)
        });
        await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ ok: true, held: 'GH-519: not written to the stand' })
        });
    });
    return {
        held: held,
        reached: reached,
        report: function () {
            return 'GH-519 stand guard — held back ' + held.length + ' write(s) '
                + JSON.stringify(Array.from(new Set(held.map((h) => h.table))))
                + '; ' + reached.length + ' request(s) reached the server ('
                + Array.from(new Set(reached.map((r) => r.split(' ')[0]))).sort().join(', ') + ')';
        }
    };
}

function path(url) {
    try { return new URL(url).pathname; } catch (e) { return url; }
}

function patchKeys(body) {
    if (!body) return [];
    try {
        const o = JSON.parse(body);
        return Object.keys(o.patch || o || {}).slice(0, 8);
    } catch (e) { return []; }
}

module.exports = { guardStand, SITE_STATE_WRITES };

/**
 * GH-519 — the annual N target a press needs comes from the SITE, never from
 * the footprint of an earlier run.
 *
 * WHY. Fifteen of the nineteen live tests press Generate and never touch the
 * annual-N field: they relied on it arriving prefilled, and it arrived
 * prefilled because a saved programme was there, and the saved programme was
 * there because the previous run of the same suite had left it. "The suite
 * leaves no trace" and "the suite is green" were incompatible for exactly that
 * reason — the input came out of the trace. Measured: with Russley's stored
 * programme gone, gh424 and gh426 time out waiting for twelve rows, because the
 * product correctly refuses to generate without a target.
 *
 * WHAT IT DOES NOT DO. It does not invent a value. The number is the site's own
 * `turf.nProgram`, read from the site's own configuration through the API. If
 * the site has none, this THROWS and names the site — it does not fall back to
 * zero, to an average, or to a neighbour's figure. A test that makes up its own
 * input is testing a case nobody has.
 */
async function fillOwnAnnualN(page) {
    // What the page already holds. A site with a saved programme arrives with
    // the field filled from it, and that value is the site's own: it is what
    // its stored programme was built from. Overwriting it with turf.nProgram
    // changes the input and therefore every figure computed from it — measured,
    // gh400-au-liquid-phosphorus-live pins exact Delivered figures and went
    // from 24 of 24 green to 6 failures when 120 became 150.
    //
    // So the rule is not "always fill". It is: the test must not DEPEND on a
    // saved programme being there. Where one is there, its target is used;
    // where there is none, the site's own turf.nProgram is used; where there is
    // neither, this throws and names the site rather than inventing a number.
    const arrived = await page.evaluate(() =>
        (document.querySelector('#plan-nut-annual-n') || {}).value);
    if (arrived !== null && arrived !== undefined && String(arrived).trim() !== '') {
        process.stdout.write('[e2e] GH-519 annual N arrived from the site itself: '
            + arrived + ' — left as it is\n');
        return { value: arrived, source: 'the field as the site filled it' };
    }
    const own = await page.evaluate(async () => {
        const opts = { headers: { Accept: 'application/json' }, credentials: 'same-origin' };
        const list = await (await fetch('/api/sites', opts)).json();
        const id = list && list.active_site_id;
        if (!id) return { error: 'no active site on /api/sites' };
        const body = await (await fetch('/api/sites/' + id, opts)).json();
        const site = body.data || body;
        const cfg = (site.configs && site.configs.gaip && site.configs.gaip.config) || {};
        return {
            id: id,
            name: site.name || id,
            value: (cfg.turf && cfg.turf.nProgram != null) ? cfg.turf.nProgram : null
        };
    });
    if (own.error) throw new Error('GH-519: ' + own.error);
    if (own.value == null || own.value === '') {
        throw new Error('GH-519: site "' + own.name + '" (' + own.id + ') arrived with an empty '
            + 'annual N field and has no target of its own (turf.nProgram) either. The test does '
            + 'not invent one — no zero, no average, no neighbouring site\'s figure. Give the site '
            + 'its own value, or this scenario does not exist on it.');
    }
    await page.fill('#plan-nut-annual-n', String(own.value));
    await page.waitForTimeout(400);
    const inTheBox = await page.evaluate(() =>
        (document.querySelector('#plan-nut-annual-n') || {}).value);
    if (String(inTheBox) !== String(own.value)) {
        throw new Error('GH-519: the annual N field did not take the site\'s own value; wanted "'
            + own.value + '", the box holds "' + inTheBox + '"');
    }
    process.stdout.write('[e2e] GH-519 the field for "' + own.name + '" arrived EMPTY; filled from '
        + 'its own turf.nProgram: ' + own.value + '\n');
    return { value: own.value, source: 'turf.nProgram', name: own.name };
}

module.exports.fillOwnAnnualN = fillOwnAnnualN;

/**
 * GH-519 — capture and put back, for the tests the guard cannot serve.
 *
 * WHY A SECOND REMEDY. Holding the write in the browser works for a test that
 * reads ONE surface after generating. It breaks a test whose claim is that two
 * surfaces agree, because the document is built from the PERSISTED programme:
 * with the write held, the Plan shows the fresh figures and the document shows
 * the stored ones. Measured — calc-audit-export-parity-live reported
 * `"document": "120.0"` against `"plan": "150.0"`, 120 being the stored
 * programme's annual base and 150 the site's own turf.nProgram — and
 * gh399-delivery-live was 7 of 7 green before the guard was put on it.
 *
 * WHY THE RESTORE GOES THROUGH SQL AND NOT THROUGH THE PRODUCT. Both API paths
 * were tried and both refuse, on purpose. Each refusal is given by ADDRESS
 * below, because the previous version of this paragraph said of the first one
 * "the route does not exist" — two lines after saying both paths "refuse on
 * purpose", which a non-existent route cannot do. A reader took the wrong half
 * and passed it on as fact. The half that was right carried addresses; the half
 * that was wrong carried a status code and an inference from it. So: addresses,
 * and the reader checks rather than believes.
 *
 *   PUT  /api/sites/{id}/config/gaip  → 410. The route EXISTS —
 *         app/routes/web.php:106, `Route::put('/sites/{site}/config/{namespace?}')`
 *         → SiteController::updateConfig (SiteController.php:395). It refuses a
 *         whole-object write to the `gaip` namespace by decision GH-442
 *         (GH-439 stage 3): the reasoning is at SiteController.php:407 and the
 *         refusal itself at :416-419. A config assembled in the browser is no
 *         longer allowed to become the truth about a site; the change is sent
 *         instead. The `gssh` namespace still goes through, by decision 7.
 *   PATCH /api/sites/{id}/config/gaip → 422, "Unknown site config key: savedAt",
 *         because `savedAt` is deliberately absent from GAIP_CONFIG_KEYS —
 *         SiteController.php:23 and :573-576: the SERVER stamps it, precisely
 *         so that a timestamp a client chose cannot decide a merge.
 *
 * That refusal is right, and it is also why the restore cannot be a write
 * through the product: a config put back through the API would carry a fresh
 * `savedAt` and a fresh `updated_at`, and the row would then look exactly like
 * a row a user had just saved. A trace that cannot be told from real work is
 * worse than a visible one. SQL puts back the bytes AND the timestamp, so the
 * row is the row that was there.
 *
 * SQL IS FOR PUTTING BACK, NEVER FOR SETTING UP. State the product should
 * create is created by the product; this only undoes. The same line is already
 * drawn in tests/e2e/gh439-config-reset-live.test.js, which cleans up that way.
 */
const { execFileSync } = require('child_process');

/**
 * THE STATEMENT TRAVELS ON STDIN, NOT IN THE ARGUMENT LIST.
 *
 * WHAT WAS BROKEN, and it was broken in the half nobody checks. This function
 * put the whole statement into one `argv` element after `-e`. For the short
 * SELECTs around it that is fine. For `restoreConfigs()` it is not: the
 * statement carries the row's entire content as base64, and every
 * `analysis_cache` row on the stand is 209-234 KB of it. Linux caps a SINGLE
 * argv element at 128 KB (MAX_ARG_STRLEN), so the exec never happened:
 *
 *     exec /usr/bin/mysql: argument list too long
 *
 * The limit is on one ARGUMENT, not on the total — the host's ARG_MAX is 1 MB
 * and was never the thing in the way. Detection kept working the whole time:
 * the md5 comparison saw the drift and said so. Only the putting-back failed,
 * which is the worse half to lose, because a guard that reports a failure it
 * cannot repair still reads as coverage in a census that only asks whether a
 * remedy is named.
 *
 * WHAT IT DOES NOW. `docker exec -i` and the statement on the child's stdin —
 * the same shape as `mysql < file`, which is how the one manual repair of this
 * kind was done. The payload never enters argv, so the 128 KB ceiling is not
 * in the path at all. Measured on the largest row present, a 468 KB statement:
 * through argv it throws the message above, through stdin it answers.
 *
 * AND STDERR IS NO LONGER DISCARDED. It used to be `stdio: [..., 'ignore']`,
 * which is why a failed restore could say THAT it failed and never WHY —
 * the sentence above had to be recovered by re-running the command by hand.
 * It is captured and attached to the error instead.
 */
function sqlRaw(query) {
    try {
        return execFileSync('docker', [
            'exec', '-i', 'gilba_mysql', 'mysql', '-ugilba', '-pgilba_secret', 'gilba',
            '--batch', '--raw', '--skip-column-names',
        ], { input: query, encoding: 'utf8', maxBuffer: 256 * 1024 * 1024,
             stdio: ['pipe', 'pipe', 'pipe'] });
    } catch (e) {
        const why = String((e && e.stderr) || '').trim();
        const err = new Error('stand-guard SQL failed'
            + (why ? ': ' + why.split('\n').filter((l) => !/Using a password/.test(l)).join('; ') : '')
            + ' [statement ' + query.length + ' chars]');
        err.stderr = why;
        err.statementLength = query.length;
        throw err;
    }
}

let _captured = null;
let _capturedRuns = null; // GH-550: the analysis_results high-water mark

/**
 * Every gaip config, as bytes, with its timestamp and its hash.
 *
 * Read with SQL rather than through the API because what has to go back is the
 * stored column, not a re-serialisation of it. Base64 is stripped of the line
 * breaks MySQL wraps it in, and the fields are joined with `~`, which cannot
 * occur in base64, a uuid or a namespace — both learned by getting them wrong:
 * a first attempt split on a tab that arrived as two literal characters and
 * produced 24 unusable rows.
 */
function captureConfigsOnce() {
    if (_captured) return _captured;
    const out = sqlRaw("SELECT CONCAT(site_id,'~',namespace,'~',MD5(config),'~',"
        + "UNIX_TIMESTAMP(updated_at),'~',REPLACE(REPLACE(TO_BASE64(config),'\n',''),'\r','')) "
        + "FROM site_configs;");
    const rows = {};
    out.split('\n').filter((l) => l.trim()).forEach((line) => {
        const p = line.split('~');
        if (p.length !== 5) return;
        rows[p[0] + '~' + p[1]] = { site: p[0], ns: p[1], md5: p[2], updated: p[3], b64: p[4] };
    });
    const n = Object.keys(rows).length;
    if (!n) throw new Error('GH-519: captured no site configurations — nothing could be put back');
    _captured = rows;
    process.stdout.write('[e2e] GH-519 captured ' + n + ' site configuration row(s), bytes and timestamps\n');
    // GH-550: the analysis result left this table. Taken here rather than in a
    // second call every live test would have to learn, because "capture the
    // stand's state" is one act and ten files should not have to be edited to
    // keep it whole.
    captureAnalysisRunsOnce();
    return _captured;
}

/**
 * GH-753 — THE KEYS A GENERATE PRESS WRITES, AND THE ONLY ONES A RESTORE MAY PUT BACK.
 *
 * Read off the write paths rather than remembered: `nutritionCalendarProgram` and `maxNPerMonth`
 * (nutrition-calendar.js, the persist beside computeProgram), `nutritionProgramCoords` (the stamp
 * set on the same patch), `nutritionProgram` (the four regional integrations), `appliedMonthlyN`
 * (the monthly-N field). Anything else in a site's configuration was not put there by the run.
 *
 * The list is PRINTED by the restore, and so is every key of the test's own site that moved and is
 * NOT on it — because a list of keys goes stale the day someone writes a sixth, and a list that
 * only lives in this comment would go stale silently.
 */
const PROGRAMME_KEYS = [
    'nutritionCalendarProgram',
    'maxNPerMonth',
    'nutritionProgramCoords',
    'nutritionProgram',
    'appliedMonthlyN',
];

/** Base64 of a UTF-8 string, so a value travels into SQL without quoting rules. */
function b64(text) {
    return Buffer.from(String(text), 'utf8').toString('base64');
}

/**
 * GH-753 — THE STATEMENTS A RESTORE WOULD RUN, BUILT WITHOUT A DATABASE.
 *
 * Kept apart from the running of them for one reason, which the reviewer of this item set as a
 * condition: a Jest set with a stand-in database proves the statement it was given, so the text
 * must be THE SAME text in both modes. It is built here, once, and either executed against the
 * stand or handed to the set to be read.
 *
 * WHAT IT WILL NOT DO, and this is the whole of the item: it touches only the sites the caller
 * names as its own, only the keys above, and never `updated_at`. A row of another site that moved
 * during the run is REPORTED and left alone — the old restore put every changed row of every site
 * back, timestamp included, so an owner editing Settings in that window lost the edit with no
 * trace.
 */
function restoreStatements(captured, nowRows, mine, keys) {
    /**
     * GH-753 (the reviewer's return, position 2) — THE KEYS ARE A PARAMETER, defaulting to the five.
     * `gh394` writes `traffic` as the very thing it is about, so the control site kept a traffic
     * schedule after every run: a key the restore does not own is a key the run leaves behind. A
     * test that writes outside the five says so here rather than being quietly uncovered.
     */
    const OWNED = (keys && keys.length) ? keys : PROGRAMME_KEYS;
    const own = [];
    const foreign = [];
    const unlisted = [];
    Object.keys(captured).forEach((key) => {
        const want = captured[key];
        const now = nowRows[key];
        if (now === undefined) { foreign.push({ key: key, what: 'the row is gone' }); return; }
        if (now.md5 === want.md5) return;
        if (mine.indexOf(want.site) < 0) {
            foreign.push({ key: key, what: 'changed during the run and was LEFT ALONE' });

            return;
        }
        let before = {};
        let after = {};
        try { before = JSON.parse(Buffer.from(want.b64, 'base64').toString('utf8')) || {}; } catch (e) { before = {}; }
        try { after = JSON.parse(Buffer.from(now.b64 || '', 'base64').toString('utf8')) || {}; } catch (e) { after = {}; }
        Object.keys(after).forEach((k) => {
            if (OWNED.indexOf(k) >= 0) return;
            // GH-753 (position 1): `savedAt` is the SERVER's stamp, set on every PATCH of the
            // config (`SiteController::patchConfig`). It is not the run's doing and is never put
            // back — for the same reason `updated_at` is not. Reporting it as an unlisted key
            // would cry wolf on every single run.
            if (k === 'savedAt') return;
            if (JSON.stringify(after[k]) !== JSON.stringify(before[k])) {
                unlisted.push({ key: key, jsonKey: k });
            }
        });
        let expr = 'config';
        const touched = [];
        OWNED.forEach((k) => {
            const had = Object.prototype.hasOwnProperty.call(before, k);
            const has = Object.prototype.hasOwnProperty.call(after, k);
            if (!had && !has) return;
            if (had && has && JSON.stringify(before[k]) === JSON.stringify(after[k])) return;
            touched.push(k);
            expr = had
                ? "JSON_SET(" + expr + ", '$.\"" + k + "\"', CAST(CONVERT(FROM_BASE64('"
                    + b64(JSON.stringify(before[k])) + "') USING utf8mb4) AS JSON))"
                : "JSON_REMOVE(" + expr + ", '$.\"" + k + "\"')";
        });
        if (!touched.length) return;
        own.push({
            key: key,
            site: want.site,
            ns: want.ns,
            keysPutBack: touched,
            // `updated_at` is absent from the SET on purpose: the row's time belongs to whoever
            // wrote it last, and moving it back was how this restore hid its own footprint.
            sql: 'UPDATE site_configs SET config=' + expr
                + " WHERE site_id='" + want.site + "' AND namespace='" + want.ns + "';",
        });
    });

    return { own: own, foreign: foreign, unlisted: unlisted, keys: OWNED.slice() };
}

/**
 * Put back what THIS test wrote, on the sites it names as its own, and prove it by the hash the
 * database itself reports — not by the fact that the UPDATE ran.
 *
 * GH-753: `sites` is required. A restore that does not know whose rows are its own is the restore
 * this item exists against.
 */
function restoreConfigs(options) {
    const mine = (options && options.sites) || [];
    const keys = (options && options.keys) || null;
    // GH-753 (the reviewer's return, position 4): asked for BEFORE the capture is looked at, so a
    // call with no sites fails the same way whether or not a snapshot was taken — and so the demand
    // can be witnessed without a stand.
    if (!mine.length) {
        throw new Error('GH-753: restoreConfigs({ sites: [...] }) needs the ids of the sites this '
            + 'test wrote to. A restore that does not know whose rows are its own puts back every '
            + 'changed row of every site, and an edit made by someone else in that window is gone '
            + 'with no trace.');
    }
    if (!_captured) return { restored: [], failed: [], unchanged: 0, note: 'nothing was captured' };
    const now = {};
    sqlRaw("SELECT CONCAT(site_id,'~',namespace,'~',MD5(config),'~',"
        + "REPLACE(REPLACE(TO_BASE64(config),'\n',''),'\r','')) FROM site_configs;")
        .split('\n').filter((l) => l.trim()).forEach((line) => {
            const p = line.split('~');
            if (p.length === 4) now[p[0] + '~' + p[1]] = { md5: p[2], b64: p[3] };
        });
    const plan = restoreStatements(_captured, now, mine, keys);
    const restored = [];
    const failed = [];
    const unchanged = Object.keys(_captured).length - plan.own.length - plan.foreign.length;
    plan.own.forEach((stmt) => {
        try {
            sqlRaw(stmt.sql);
        } catch (e) {
            failed.push(stmt.key + ': the UPDATE threw: ' + String(e && e.message).slice(0, 120));

            return;
        }
        /**
         * GH-753 (the reviewer's return, position 1) — THE PROOF IS PER KEY, NOT THE ROW'S md5.
         *
         * Measured: the server stamps `savedAt` into the config on every `PATCH config/gaip`, which
         * is the path a Generate press writes by. A narrowed restore does not put that stamp back —
         * it is not the run's value — so the row's md5 CANNOT match afterwards, and a check on it
         * would report a failure on the first live run of all eight tests. What the restore
         * promises is the keys it owns, so that is what is read back, from the database, key by key.
         */
        const wantCfg = JSON.parse(Buffer.from(_captured[stmt.key].b64, 'base64').toString('utf8'));
        const wrong = [];
        stmt.keysPutBack.forEach((k) => {
            const got = sqlRaw("SELECT IFNULL(JSON_EXTRACT(config,'$.\"" + k + "\"'),'ABSENT') "
                + "FROM site_configs WHERE site_id='" + stmt.site + "' AND namespace='" + stmt.ns + "';").trim();
            const wanted = Object.prototype.hasOwnProperty.call(wantCfg, k)
                ? JSON.stringify(wantCfg[k]) : 'ABSENT';
            // MySQL prints JSON with its own spacing, so the two are compared as parsed values.
            const same = (got === 'ABSENT' && wanted === 'ABSENT')
                || (got !== 'ABSENT' && wanted !== 'ABSENT'
                    && JSON.stringify(JSON.parse(got)) === JSON.stringify(JSON.parse(wanted)));
            if (!same) wrong.push(k + ': ' + got.slice(0, 60) + ' wanted ' + wanted.slice(0, 60));
        });
        if (wrong.length) {
            failed.push(stmt.key + ': keys did not come back — ' + JSON.stringify(wrong));

            return;
        }
        restored.push(stmt.key);
    });
    // Named, never touched: the rows of sites this test does not own, and the keys of its OWN
    // sites that moved and are not on the programme list. Both are how this restore says what it
    // saw rather than only what it did.
    process.stdout.write('[e2e] GH-753 restore is narrowed to ' + JSON.stringify(mine)
        + ' and to ' + JSON.stringify(plan.keys)
        + '; neither `updated_at` nor the server\'s `savedAt` is put back, and the proof is per key\n');
    plan.foreign.forEach((f) => process.stdout.write('[e2e] GH-753 ANOTHER SITE\'S ROW, left alone: '
        + f.key + ' — ' + f.what + '\n'));
    plan.unlisted.forEach((u) => process.stdout.write('[e2e] GH-753 A KEY OUTSIDE THE LIST moved on '
        + 'this run\'s own site and was left alone: ' + u.key + ' -> ' + u.jsonKey + '\n'));
    // GH-550: and the rows the run APPENDED to analysis_results. A failure here
    // joins the same list rather than printing quietly, because a restore that
    // half-worked and reported success is the thing this file exists against.
    const runs = restoreAnalysisRuns(mine);
    if (runs.ok === false) failed.push('analysis_results: ' + runs.high + ' row(s) of this run\'s own sites above id ' + runs.deleted + ' are still there');

    process.stdout.write('[e2e] GH-519 put back ' + restored.length + ' row(s), ' + unchanged
        + ' were untouched' + (failed.length ? '; FAILED: ' + JSON.stringify(failed) : '') + '\n');
    return { restored: restored, failed: failed, unchanged: unchanged, runs: runs,
        leftAlone: plan.foreign, keysOutsideTheList: plan.unlisted, keys: plan.keys };
}

/**
 * GH-550 (stage 4) — THE SNAPSHOT FOLLOWED THE DATA, AND IT HAD TO BE MADE
 * TO.
 *
 * `captureConfigsOnce` / `restoreConfigs` above watch `site_configs` and nothing
 * else. That was the whole of the analysis result's storage until this stage;
 * it is now a table they had never heard of, so a run that reached the server
 * during a live test would have left a row behind with the snapshot reporting
 * that everything was put back. The guard would have gone on being right about
 * the table it watches and wrong about the stand.
 *
 * The two tables need different treatment, and pretending otherwise is how this
 * goes wrong quietly. `site_configs` is overwritten in place, so the remedy is
 * to put the bytes back. `analysis_results` is APPENDED to — one row per run —
 * so a row written during a test is a row that did not exist before, and the
 * remedy is to delete exactly those. Nothing is ever put back into it, and
 * nothing already there is touched.
 *
 * NOT EXERCISED. Live tests are banned for this work, so this code has never
 * run against the stand. It is written now rather than with the first live run
 * because that run is the one it protects, and it is said here rather than left
 * to be discovered.
 */
function captureAnalysisRunsOnce() {
    if (_capturedRuns) return _capturedRuns;
    let high;
    try {
        const out = sqlRaw('SELECT IFNULL(MAX(id), 0) FROM analysis_results;').trim();
        high = Number(out.split('\n').filter((l) => l.trim()).pop());
    } catch (e) {
        // The table arrives with GH-550's migration. A stand that has not been
        // migrated yet says so and carries on, rather than taking every live
        // test down with it — but it says so, because a silent skip here is a
        // snapshot that does not cover what it claims to.
        _capturedRuns = { high: null, note: 'analysis_results is not on this stand yet' };
        process.stdout.write('[e2e] GH-550 analysis_results NOT PRESENT — runs are not covered by this snapshot\n');
        return _capturedRuns;
    }
    if (!Number.isFinite(high)) {
        throw new Error('GH-550: could not read the high-water mark of analysis_results');
    }
    _capturedRuns = { high: high };
    process.stdout.write('[e2e] GH-550 analysis_results high-water mark: ' + high + '\n');
    return _capturedRuns;
}

/** Delete the rows this run appended, and prove the table is back where it was. */
function restoreAnalysisRuns(mine) {
    if (!_capturedRuns) return { deleted: 0, note: 'nothing was captured' };
    const before = _capturedRuns.high;
    if (before === null) return { deleted: 0, note: _capturedRuns.note };
    /**
     * GH-753 (the reviewer's return, position 3) — AND THE RUNS ARE THIS TEST'S RUNS.
     *
     * `WHERE id > <snapshot>` removes whatever appeared after the snapshot, of any site and any
     * author: a run the owner started in that window went with it. The site list is the same one
     * the configuration restore is given, and rows of other sites are counted and named instead.
     */
    const own = "('" + mine.join("','") + "')";
    const others = Number(sqlRaw('SELECT COUNT(*) FROM analysis_results WHERE id > ' + before
        + ' AND site_id NOT IN ' + own + ';').trim().split('\n').filter((l) => l.trim()).pop());
    if (others) {
        process.stdout.write('[e2e] GH-753 ' + others + ' analysis_results row(s) of OTHER sites '
            + 'appeared during the run and were LEFT ALONE\n');
    }
    sqlRaw('DELETE FROM analysis_results WHERE id > ' + before + ' AND site_id IN ' + own + ';');
    const left = Number(sqlRaw('SELECT COUNT(*) FROM analysis_results WHERE id > ' + before
        + ' AND site_id IN ' + own + ';').trim().split('\n').filter((l) => l.trim()).pop());
    const after = left;
    const ok = left === 0;
    process.stdout.write('[e2e] GH-550/753 analysis_results rows of ' + JSON.stringify(mine)
        + ' above id ' + before + ': ' + left + (ok ? '' : ' — FAILED, wanted 0') + '\n');
    return { deleted: before, high: after, ok: ok };
}

module.exports.captureAnalysisRunsOnce = captureAnalysisRunsOnce;
module.exports.restoreAnalysisRuns = restoreAnalysisRuns;
module.exports.captureConfigsOnce = captureConfigsOnce;
module.exports.restoreConfigs = restoreConfigs;
module.exports.restoreStatements = restoreStatements;
module.exports.PROGRAMME_KEYS = PROGRAMME_KEYS;
