/**
 * GH-661 (the analyst's 23.1, second half) — THE ADDRESS AND THE CONTENTS OF THE
 * ROW THE FRAME WOULD FILE, READ OUT OF A WRITE THAT IS HELD INSTEAD OF SENT.
 *
 * WHAT GH-660 ESTABLISHED and what is left. The frame is built from the user's
 * pointer, not from `?site=`: opened as `/hub?site=<Burns>` with the pointer on
 * `Westview`, every field on the page was Westview's — coordinates, species, turf
 * type, and the sample manager's active site. What that measurement could not
 * show is the ADDRESS the row would be filed under, because the address only
 * exists at the moment of the write.
 *
 * WHY THE WRITE IS HELD RATHER THAN UNDONE. Filing a row under one site with
 * another site's numbers is a corruption of live data, and undoing it afterwards
 * is two edits instead of none. Held, the request is captured and answered `200`
 * locally: the page believes it succeeded, the server never hears it, and the
 * body — the address and the contents — is printed. EVERY non-GET request is
 * held, not only the one expected, so a second write path cannot slip out while
 * this looks at the first.
 *
 * ONE PRESS. There is no second one under any outcome; the output is read from
 * the transcript file.
 *
 * BOTH OUTCOMES, NAMED BEFORE THE PRESS:
 *   - `site_id` in the held body is BURNS while the contents are WESTVIEW's —
 *     the GH-459 class entire: a row filed under one site carrying another's
 *     climate, species and samples, with annual totals that would still agree
 *     because the annual figure is normalised to its target;
 *   - `site_id` is WESTVIEW — the write follows the pointer as well, the row is
 *     filed under the site it really computed, and the defect is a different one:
 *     the opener asked for A and got a row for B. The analyst's reading of the
 *     address would then be wrong, and that is a result, not a failure.
 *
 * ============================================================================
 * SECOND RUN, 24.09.2026 — THE SAME PRESS AS THE ACCEPTANCE OF GH-663.
 *
 * The first run of this file was the proof of the defect. This one is the proof
 * of the repair, in the analyst's own words (29.5): pointer on one site, frame
 * opened for another, and the held body must now carry the PRESSED site's sample,
 * species and soil temperature.
 *
 * BOTH OUTCOMES, NAMED BEFORE THIS PRESS:
 *   - the held body carries the PRESSED site throughout — `site_id`, the sample,
 *     the soil temperature, the disease — and the repair holds on the stand as
 *     well as on the bench;
 *   - it still carries the pointer's data anywhere — then the repair does not
 *     reach the live render, the four bench mutations proved only the bench, and
 *     that is the finding. There is no second press under either outcome.
 *
 * WHY THERE IS NO SEPARATE CONTROL RUN WITH `pointer == ?site=`, and it is not a
 * corner cut: after the repair the frame is rendered from the parameter and the
 * pointer is not consulted at all, so the two configurations produce the SAME
 * render by construction — a control run could not tell them apart. What the
 * pointer still decides is tested where it is decidable, on the server side, by
 * `Gh663…Test`: a page with no `rerun`/`site` follows the pointer, a frame does
 * not, and the pointer is unchanged afterwards.
 *
 * WHAT WOULD MAKE THIS GREEN OVER NOTHING, and each is asserted: the row count
 * unchanged (the hold worked), the write attempted at all (the run reached the
 * point of filing), and the two sites differing (there is something to tell
 * apart).
 * ============================================================================
 *
 * Run: GILBA_E2E=1 npx jest tests/e2e/gh661-the-held-write-names-its-site-live.test.js --runInBand
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
const { openTranscript } = require('./lib/transcript');

function query(sql) {
    return execFileSync('docker', ['exec', 'gilba_mysql', 'mysql', '-ugilba', '-pgilba_secret',
        'gilba', '-N', '-e', sql], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })
        .split('\n').map((l) => l.trim()).filter((l) => l);
}

if (!ENABLED) {
    process.stdout.write('[e2e] gh661 skipped (needs the live stack; one press, every write held)\n');
    test.skip('GH-661 the held write names its site (disabled)', () => {});
} else {
    describe('GH-661 — the address and the contents of the row that was never sent', () => {
        jest.setTimeout(420000);
        let browser, page;
        const transcript = openTranscript('gh661-live');
        const say = (line) => transcript.say(line);

        const held = [];        // every non-GET request, captured and answered locally
        let pointer = null;
        let asked = null;
        let sitesById = {};
        let rowsBefore = null;
        let rowsAfter = null;
        let theWrite = null;    // the analysis-cache write, if it came

        beforeAll(async () => {
            if (!chromium) throw new Error('playwright does not resolve from the repo — run `npm install`');
            if (!EMAIL || !PASSWORD) throw new Error('no credentials — see tests/e2e/.e2e-credentials.example.json');

            query("SELECT CONCAT(id,'|',name,'|',IFNULL(latitude,''),'|',IFNULL(longitude,'')) "
                + 'FROM sites WHERE deleted_at IS NULL').forEach((r) => {
                const [id, name, lat, lon] = r.split('|');
                sitesById[id] = { name, lat, lon };
            });

            const row = query("SELECT CONCAT(IFNULL(u.last_active_site_id,''),'|',IFNULL(s.name,'(none)')) "
                + 'FROM users u LEFT JOIN sites s ON s.id=u.last_active_site_id '
                + "WHERE u.email='" + EMAIL.replace(/'/g, '') + "'")[0] || '';
            const [pid, pname] = row.split('|');
            pointer = { id: pid, name: pname };

            const candidates = query("SELECT CONCAT(id,'|',name) FROM sites WHERE name IN "
                + "('Burns','Russley','Test5 - NZ','Test6 - UK') AND deleted_at IS NULL ORDER BY name")
                .map((r) => { const [id, name] = r.split('|'); return { id, name }; })
                .filter((s) => s.id !== pointer.id);
            asked = candidates[0];

            // The two coordinate strings that tell the contents apart by themselves.
            say('the pointer stands on: ' + pointer.name + ' (' + pointer.id + '), coordinates '
                + JSON.stringify(sitesById[pointer.id]));
            say('`?site=` will name:    ' + asked.name + ' (' + asked.id + '), coordinates '
                + JSON.stringify(sitesById[asked.id]));
            expect(asked.id).not.toBe(pointer.id);

            rowsBefore = query('SELECT CONCAT(COUNT(*)) FROM analysis_results')[0];
            say('rows in analysis_results before the press: ' + rowsBefore);

            browser = await chromium.launch();
            page = await browser.newPage();

            // EVERY non-GET held. Nothing reaches the server.
            await page.route('**/api/**', async (route) => {
                const req = route.request();
                if (['GET', 'HEAD', 'OPTIONS'].includes(req.method())) return route.fallback();
                let body = null;
                try { body = req.postData(); } catch (e) { body = null; }
                held.push({ method: req.method(), url: req.url(), body: body });
                await route.fulfill({ status: 200, contentType: 'application/json',
                    body: JSON.stringify({ ok: true, held: 'GH-661: not written to the stand' }) });
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

            // THE PRESS: the frame exactly as the opener builds it.
            const runId = 'gh661-' + Date.now();
            const url = BASE_URL + '/hub?rerun=' + encodeURIComponent(runId)
                + '&site=' + encodeURIComponent(asked.id);
            say('THE PRESS: ' + url.replace(BASE_URL, ''));
            await page.goto(url, { waitUntil: 'domcontentloaded' });
            await page.waitForTimeout(150000);

            theWrite = held.find((h) => /\/api\/analysis-cache(\?|$)/.test(h.url)) || null;
            say('non-GET requests held: ' + held.length);
            held.forEach((h) => say('   HELD ' + h.method + ' ' + h.url.replace(BASE_URL, '')
                + ' (' + (h.body ? h.body.length : 0) + ' bytes)'));

            rowsAfter = query('SELECT CONCAT(COUNT(*)) FROM analysis_results')[0];
            say('rows in analysis_results after the press: ' + rowsAfter);
        });

        afterAll(async () => {
            if (browser) await browser.close();
            transcript.close();
        });

        test('THE HOLD WORKED: not one row was added to the stand', () => {
            // First, because every claim below is only allowed if this is true. If
            // it is false the press escaped and that is said here, not smoothed over.
            say('rows before ' + rowsBefore + ' -> after ' + rowsAfter);
            expect(rowsAfter).toBe(rowsBefore);
        });

        test('POSITIVE CONTROL: the run reached the point of writing at all', () => {
            // Without this, "no foreign site in the body" and "there was no body"
            // are the same output.
            say('the analysis-cache write was attempted: ' + !!theWrite);
            expect(theWrite).not.toBeNull();
            expect(theWrite.body).toBeTruthy();
        });

        test('THE ANSWER: whose site the address names, and whose numbers the body carries', () => {
            const payload = JSON.parse(theWrite.body);
            const addressedTo = payload.site_id;
            const addressName = (sitesById[addressedTo] || {}).name || '(unknown)';

            // The contents, named one by one rather than called "foreign".
            const raw = theWrite.body;
            const pointerCoords = sitesById[pointer.id];
            const askedCoords = sitesById[asked.id];
            const carries = (v) => (v ? raw.includes(String(v).replace(/0+$/, '').slice(0, 8)) : false);

            const sampleKeys = payload.inputs && payload.inputs.samples
                ? Object.keys(payload.inputs.samples) : [];
            const sampleIds = payload.inputs && payload.inputs.samples
                ? Object.values(payload.inputs.samples) : [];

            say('ADDRESS: site_id = ' + addressedTo + ' = ' + addressName);
            say('   the press named:   ' + asked.name);
            say('   the pointer named: ' + pointer.name);
            say('CONTENTS:');
            say('   the body mentions the POINTER\'s latitude (' + pointerCoords.lat + '): ' + carries(pointerCoords.lat));
            say('   the body mentions the PRESSED site\'s latitude (' + askedCoords.lat + '): ' + carries(askedCoords.lat));
            say('   sample keys in inputs: ' + JSON.stringify(sampleKeys));
            say('   sample ids in inputs:  ' + JSON.stringify(sampleIds));
            say('   metrics: ' + JSON.stringify(payload.metrics));
            const climate = payload.computed && payload.computed.climate;
            say('   computed.climate location fields: ' + JSON.stringify(climate ? {
                lat: climate.lat, lon: climate.lat === undefined ? undefined : climate.lon,
                location: climate.location, timezone: climate.timezone,
                regime: climate.climateRegime || climate.regime,
            } : null));
            const soil = payload.computed && payload.computed.soilNutrition;
            say('   computed.soilNutrition sample label: ' + JSON.stringify(soil
                ? { label: soil.sampleLabel, date: soil.sampleDate } : null));

            // WHICH SITE THE SAMPLES BELONG TO, from the database rather than by
            // eye: every sample id in the body, with the site that owns it.
            if (sampleIds.length) {
                const list = sampleIds.map((v) => String(v).replace(/'/g, '')).join("','");
                const owners = query("SELECT CONCAT(s.id,' -> ',si.name) FROM samples s "
                    + "JOIN sites si ON si.id=s.site_id WHERE s.id IN ('" + list + "') "
                    + "OR s.client_uid IN ('" + list + "')");
                owners.forEach((o) => say('   sample ' + o));
            }

            // The address is one of the two, or there is a third source nobody named.
            expect([asked.id, pointer.id]).toContain(addressedTo);

            // GH-663 — THE ACCEPTANCE, and it is stated as equality rather than as
            // "no foreign site": an equality also reddens when the field is absent,
            // which is the hole my first reading of the predictions bodies fell
            // into (GH-662).
            say('ACCEPTANCE: the address must be the pressed site, and so must the data');
            expect(addressedTo).toBe(asked.id);

            // The sample must belong to the site pressed. Asked of the database,
            // not of the eye.
            if (sampleIds.length) {
                const soil = String(sampleIds[0] || '').replace(/^sample_/, '');
                if (soil) {
                    // THE KEY IS NOT UNIQUE BETWEEN SITES, and asserting one owner
                    // was wrong: the analyst measured this in 23.1 and the first
                    // acceptance run proved it on me. `Soil_26_zo0t` belongs to
                    // sample 26 of `Test1 - Sports` AND sample 53 of `Burns`; my
                    // query took the first row and the case reddened on a product
                    // that was right. The lawful claim is the one the server makes:
                    // the site pressed must be AMONG the owners.
                    const owners = query("SELECT CONCAT(si.name) FROM samples s "
                        + "JOIN sites si ON si.id=s.site_id WHERE s.client_uid='"
                        + soil.replace(/'/g, '') + "'"
                        + (/^\d+$/.test(soil) ? " OR s.id=" + soil : ''));
                    say('   the soil key in the body belongs to: ' + JSON.stringify(owners));
                    expect(owners).toContain(asked.name);
                }
            }
        });
    });
}
