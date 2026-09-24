/**
 * GH-660 (the analyst's 23.1) — IS THE PATH REACHABLE: DOES THE RUN FRAME
 * COMPUTE THE POINTER'S SITE WHILE ADDRESSING ITS WRITE TO THE SITE IN `?site=`?
 *
 * WHAT WAS READ AND WHAT IS MEASURED HERE. The analyst read that `/hub` is
 * rendered by the server from `users.last_active_site_id` and not from the
 * `?site=` parameter, and she marked her finding honestly: read, not executed,
 * no trace in the database. She also measured that no stored row carries a
 * foreign sample — and said what that is worth: a property of 31 rows, not proof
 * that the path is closed. So the open question is reachability, and reachability
 * is what this measures.
 *
 * IT WRITES NOTHING, AND THAT IS BY CONSTRUCTION, NOT BY CARE.
 *   - The frame is opened WITHOUT `rerun=`, so no calculation starts and there is
 *     no row to file. What the server rendered is read off the page.
 *   - `guardStand` is installed anyway and every held write is printed. If merely
 *     opening `/hub` writes something, that is itself a finding and it is held
 *     rather than delivered.
 *   - The pointer is NOT moved. It already stands on a site other than the one
 *     this asks for, which is the state the two-tab case produces; moving it
 *     would add a write this measurement does not need.
 *
 * BOTH OUTCOMES, NAMED BEFORE THE RUN:
 *   - the page reports the POINTER's site while `?site=` named another — the path
 *     is reachable, the frame computes one site and would file under another, and
 *     this is the GH-459 class with a second address;
 *   - the page reports the site from `?site=` — the reading is wrong, the server
 *     does follow the parameter, and the path is closed. Nothing to carry to the
 *     owner beyond that.
 *
 * WHAT IT DOES NOT MEASURE, said plainly: the write itself. Filing a row under
 * one site with another site's numbers is a corruption of the stand's data, and
 * that is forbidden — so the address half stays where the analyst found it, in
 * the code and in `gh547`'s own case. This measures the half nobody has executed.
 *
 * Run: GILBA_E2E=1 npx jest tests/e2e/gh660-does-the-frame-compute-the-pointers-site-live.test.js --runInBand
 */

'use strict';

const fs = require('fs');
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

let chromium = null;
try { ({ chromium } = require('playwright')); } catch (e) { /* reported below */ }
let guardStand = null;
try { ({ guardStand } = require('./lib/stand-guard')); } catch (e) { /* reported below */ }
const { openTranscript } = require('./lib/transcript');

/** One read of the stand, read-only. */
function query(sql) {
    return execFileSync('docker', ['exec', 'gilba_mysql', 'mysql', '-ugilba', '-pgilba_secret',
        'gilba', '-N', '-e', sql], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })
        .split('\n').map((l) => l.trim()).filter((l) => l);
}

if (!ENABLED) {
    process.stdout.write('[e2e] gh660 skipped (needs the live stack; it opens one page and writes nothing)\n');
    test.skip('GH-660 does the frame compute the pointer’s site (disabled)', () => {});
} else {
    describe('GH-660 — which site the run frame is built for', () => {
        jest.setTimeout(300000);
        let browser, page, guard;
        const transcript = openTranscript('gh660-live');
        const say = (line) => transcript.say(line);
        const sitesById = {};
        let pointer = null;   // the site the user's pointer stands on, before anything
        let asked = null;     // the site named in `?site=`
        let rendered = null;  // what the page says it is
        const predictionWrites = [];   // GH-662: the held predictions writes, bodies and all
        let predictionRowsBefore = null;
        let predictionRowsAfter = null;

        beforeAll(async () => {
            if (!chromium) throw new Error('playwright does not resolve from the repo — run `npm install`');
            if (!EMAIL || !PASSWORD) throw new Error('no credentials — see tests/e2e/.e2e-credentials.example.json');
            if (!guardStand) throw new Error('tests/e2e/lib/stand-guard.js does not resolve');

            query("SELECT CONCAT(id,'|',name) FROM sites WHERE deleted_at IS NULL").forEach((r) => {
                const [id, name] = r.split('|');
                sitesById[id] = { name };
            });

            // The pointer, from the database, before the browser touches anything.
            const rows = query("SELECT CONCAT(u.email,'|',IFNULL(u.last_active_site_id,''),'|',"
                + "IFNULL(s.name,'(none)')) FROM users u LEFT JOIN sites s ON s.id=u.last_active_site_id "
                + "WHERE u.email='" + EMAIL.replace(/'/g, '') + "'");
            const [, pointerId, pointerName] = (rows[0] || '').split('|');
            pointer = { id: pointerId, name: pointerName };
            say('the pointer stands on: ' + pointer.name + ' (' + pointer.id + ')');
            predictionRowsBefore = query('SELECT CONCAT(COUNT(*)) FROM predictions')[0];
            say('rows in `predictions` before: ' + predictionRowsBefore);

            // A site that is NOT the pointer's and is not one of the marked ones.
            const candidates = query("SELECT CONCAT(id,'|',name) FROM sites WHERE name IN "
                + "('Burns','Russley','Test5 - NZ','Test6 - UK') AND deleted_at IS NULL ORDER BY name")
                .map((r) => { const [id, name] = r.split('|'); return { id, name }; })
                .filter((s) => s.id !== pointer.id);
            asked = candidates[0];
            say('`?site=` will name: ' + asked.name + ' (' + asked.id + ')');
            // Positive control on the setup itself: the two must differ, or the
            // measurement has nothing to tell apart.
            expect(asked.id).not.toBe(pointer.id);

            browser = await chromium.launch();
            page = await browser.newPage();
            guard = await guardStand(page);

            // GH-662 — THE BODIES OF THE PREDICTIONS WRITES, WHICH THE GUARD HELD
            // BUT DID NOT SHOW. The guard records method, path and size; the
            // question asked of this run is WHOSE data those two requests carry
            // and WHICH site they are addressed to, and that is in the body. This
            // route is registered after the guard's, so it wins for this one URL
            // and the guard keeps everything else; the request is answered locally
            // and never sent, exactly as the guard would have done.
            await page.route('**/api/predictions**', async (route) => {
                const req = route.request();
                if (['GET', 'HEAD', 'OPTIONS'].includes(req.method())) return route.fallback();
                let body = null;
                try { body = req.postData(); } catch (e) { body = null; }
                predictionWrites.push({ url: req.url(), body: body });
                await route.fulfill({ status: 200, contentType: 'application/json',
                    body: JSON.stringify({ ok: true, held: 'GH-662: not written to the stand' }) });
            });

            await page.goto(BASE_URL + '/login', { waitUntil: 'domcontentloaded' });
            await page.fill('#email', EMAIL);
            await page.fill('#password', PASSWORD);
            await Promise.all([
                page.waitForNavigation({ waitUntil: 'domcontentloaded' }).catch(() => {}),
                page.click('form.login-form button[type=submit]'),
            ]);
            await page.waitForTimeout(1500);
            if (/\/login/.test(page.url())) throw new Error('login refused for ' + EMAIL);

            // THE FRAME, WITHOUT `rerun=`: the page is built, nothing is computed.
            await page.goto(BASE_URL + '/hub?site=' + encodeURIComponent(asked.id),
                { waitUntil: 'domcontentloaded' });
            await page.waitForTimeout(8000);

            rendered = await page.evaluate(() => {
                const cfg = window.GAIP_HUB_CONFIG || {};
                const sm = window.GAIP_SampleManager;
                let sampleSiteIds = null;
                try {
                    sampleSiteIds = sm && typeof sm.getActiveSiteId === 'function'
                        ? sm.getActiveSiteId() : null;
                } catch (e) { sampleSiteIds = 'threw: ' + e.message; }
                const el = (sel) => {
                    const n = document.querySelector(sel);
                    return n ? (n.value !== undefined && n.value !== '' ? n.value
                        : (n.textContent || '').trim().slice(0, 60)) : null;
                };
                return {
                    urlSite: new URLSearchParams(location.search).get('site'),
                    hubConfigActiveSiteId: cfg.activeSiteId || null,
                    sampleManagerActiveSiteId: sampleSiteIds,
                    latOnThePage: el('.gaip-lat'),
                    lonOnThePage: el('.gaip-lon'),
                    speciesOnThePage: el('.gaip-species'),
                    constructionOnThePage: el('[data-mlsn="construction"]')
                        || el('#gaip-sp-construction') || el('.gaip-construction'),
                    savedLocation: (window.GAIP_SAVED_LOCATION && window.GAIP_SAVED_LOCATION.name) || null,
                };
            });
            say('what the page reports: ' + JSON.stringify(rendered, null, 1));
            say(guard.report());
            guard.held.forEach((h) => say('HELD WRITE: ' + JSON.stringify(h)));
            predictionRowsAfter = query('SELECT CONCAT(COUNT(*)) FROM predictions')[0];
            say('rows in `predictions` after: ' + predictionRowsAfter);
        });

        afterAll(async () => {
            if (browser) await browser.close();
            transcript.close();
        });

        test('POSITIVE CONTROL: the page was built and reports a site at all', () => {
            expect(rendered).not.toBeNull();
            expect(rendered.urlSite).toBe(asked.id);
            // If the page reported nothing, neither outcome below could be told
            // from a page that failed to load.
            expect(rendered.hubConfigActiveSiteId).toBeTruthy();
        });

        test('THE ANSWER: which site the frame was built for', () => {
            const followsTheParameter = rendered.hubConfigActiveSiteId === asked.id;
            const followsThePointer = rendered.hubConfigActiveSiteId === pointer.id;
            say('ANSWER: `?site=` named ' + asked.name + '; the frame reports '
                + rendered.hubConfigActiveSiteId
                + ' — follows the parameter: ' + followsTheParameter
                + ' | follows the pointer: ' + followsThePointer);

            // One of the two must be true, or there is a third source nobody named
            // and that is the finding instead.
            expect([followsTheParameter, followsThePointer]).toContain(true);
        });

        test('GH-662 — whose site the predictions writes name, and whose data they carry', () => {
            // WHY THIS IS ASKED OF A PAGE THAT WAS MERELY OPENED. Two
            // `POST /api/predictions` were attempted with no `rerun=` at all, so
            // the legacy page computes and files disease predictions on load. The
            // `predictions` table holds 1700 rows addressed by site id, so this
            // path does reach the database in ordinary use — it is a second
            // address, outside `analysis_results`, and nobody has looked at what
            // it is addressed by.
            say('rows in `predictions`: ' + predictionRowsBefore + ' -> ' + predictionRowsAfter);
            expect(predictionRowsAfter).toBe(predictionRowsBefore);

            // Positive control: they were attempted at all, or every claim below
            // would be about an absence.
            say('predictions writes held: ' + predictionWrites.length);
            expect(predictionWrites.length).toBeGreaterThan(0);

            predictionWrites.forEach((w, i) => {
                let payload = null;
                try { payload = JSON.parse(w.body); } catch (e) { payload = null; }
                const list = (payload && payload.predictions) || [];
                // THE KEY IS `site_id`, NOT `site_identifier`. The first reading of
                // these bodies looked for `site_identifier` — the COLUMN's name —
                // and found nothing, which would have read as "the server decides
                // the site". The controller takes `site_id` off each prediction and
                // SKIPS the item when it is empty (`PredictionController::store`),
                // so the name matters and an empty answer has a second meaning.
                const ids = Array.from(new Set(list.map((x) => x && (x.site_id || x.site_identifier))
                    .filter((x) => x)));
                const withoutASite = list.filter((x) => !(x && (x.site_id || x.site_identifier))).length;
                const modules = Array.from(new Set(list.map((x) => x && x.module).filter((x) => x)));
                const labels = Array.from(new Set(list.map((x) => x && x.predicted_label).filter((x) => x))).slice(0, 6);
                say('   write ' + (i + 1) + ': ' + list.length + ' prediction(s)'
                    + ' | site_identifier values: ' + JSON.stringify(ids.map((id) => id + ' = '
                        + ((sitesById[id] || {}).name || '(unknown)')))
                    + ' | modules: ' + JSON.stringify(modules)
                    + ' | labels: ' + JSON.stringify(labels)
                    + ' | items carrying NO site: ' + withoutASite + ' of ' + list.length);
                // And the discriminator, named: is the address the pointer's site
                // or the one `?site=` asked for?
                ids.forEach((id) => {
                    say('      addressed to ' + ((sitesById[id] || {}).name || id)
                        + ' — the pointer: ' + (id === pointer.id)
                        + ' | the `?site=` parameter: ' + (id === asked.id));
                });
            });
        });

        test('GH-662 — and whether a REPORT page writes predictions too, since it embeds the same bundle', async () => {
            // WHY THIS IS ASKED HERE. `reports/export.blade.php` carries a docblock
            // stating that "a page that was not opened as `/hub?rerun=&site=` does
            // not write". That is true of the RESULT row. The predictions write is
            // not gated by `rerun=` — this run has just shown it firing on a plain
            // open — and the predictions controller's own comment says it dedupes
            // "when the hidden hub re-runs analysis on report pages
            // (forensic/scenarios/export)". So the claim is measured rather than
            // reasoned about: the page is opened with every write held.
            const before = query('SELECT CONCAT(COUNT(*)) FROM predictions')[0];
            const seen = [];
            const reportPage = await browser.newPage();
            await reportPage.route('**/api/**', async (route) => {
                const req = route.request();
                if (['GET', 'HEAD', 'OPTIONS'].includes(req.method())) return route.fallback();
                let body = null;
                try { body = req.postData(); } catch (e) { body = null; }
                seen.push({ method: req.method(), url: req.url(), body: body });
                await route.fulfill({ status: 200, contentType: 'application/json',
                    body: JSON.stringify({ ok: true, held: 'GH-662: not written to the stand' }) });
            });
            await reportPage.goto(BASE_URL + '/reports/export', { waitUntil: 'domcontentloaded' });
            await reportPage.waitForTimeout(45000);
            const after = query('SELECT CONCAT(COUNT(*)) FROM predictions')[0];

            say('/reports/export — non-GET requests held: ' + seen.length);
            seen.forEach((w) => {
                let payload = null;
                try { payload = JSON.parse(w.body); } catch (e) { payload = null; }
                const list = (payload && payload.predictions) || [];
                const ids = Array.from(new Set(list.map((x) => x && (x.site_id || x.site_identifier))
                    .filter((x) => x)));
                say('   HELD ' + w.method + ' ' + w.url.replace(BASE_URL, '')
                    + ' | ' + (w.body ? w.body.length : 0) + ' bytes'
                    + (list.length ? ' | ' + list.length + ' prediction(s) for '
                        + JSON.stringify(ids.map((id) => (sitesById[id] || {}).name || id)) : ''));
            });
            say('/reports/export — rows in `predictions`: ' + before + ' -> ' + after);
            await reportPage.close();

            // Nothing written, whatever the answer is.
            expect(after).toBe(before);
            // The answer itself is printed: a page that writes and a page that does
            // not are both results, and neither is asserted as the expected one.
            expect(Array.isArray(seen)).toBe(true);
        });

        test('and nothing was written to the stand while the frame was merely opened', () => {
            guard.held.forEach((h) => say('HELD: ' + JSON.stringify(h)));
            // Printed either way: a held write here would mean opening the legacy
            // page writes on load, which is a finding of its own.
            expect(Array.isArray(guard.held)).toBe(true);
        });
    });
}
