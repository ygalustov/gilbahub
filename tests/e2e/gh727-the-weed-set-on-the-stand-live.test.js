/**
 * GH-727 (queue item 3bt) — THE WEED SET IN A STORED ROW, BEFORE AND AFTER THE PRODUCT'S OWN RE-RUN.
 *
 * WHAT THIS IS FOR. `/plan` draws the STORED row, so until a site is run again it keeps showing the set
 * the old code computed. The offline guard (`tests/gh727-…`) measures the engine and the builder; this
 * one measures what a row says after the Re-run button is pressed, and it is the only thing that can:
 * the difference between "the fix works" and "the fix works and the stand still shows the old set" is
 * invisible in the code.
 *
 * IT NAMES NO SITE OF THE STAND, and that is deliberate (GH-703): the sites to press are handed in as
 * `GILBA_E2E_GH727_SITES`, a `;`-separated list, and with none the run refuses instead of pressing
 * everything. Every window on this stand is opened for named sites anyway, so the list belongs to the
 * window and not to the file — and the numbers of a particular site belong to the run's transcript,
 * which this file writes, rather than to a literal here that the owner's own edit could break.
 *
 * WHAT IT ASSERTS, per site pressed:
 *   - a row landed, and the run says which sites it could not press and why;
 *   - the row carries a region the owner's list declares, and as many species as the plan's table gives
 *     that region. The counts are written out below from the plan, not read from the engine;
 *   - NO SITE OUTSIDE THE LIST HAS A NEW LAST ROW. That is the stand protection of this file, and it
 *     covers every site with a stored row rather than a list of protected names.
 *
 * WHY THE STAND GUARD IS NOT USED, said plainly: `guardStand` holds every write to
 * `/api/analysis-cache`, and the write IS the measurement — a run whose row never lands proves nothing
 * about what `/plan` will draw. The exemption is declared in `tests/gh532-…` with this reason.
 *
 * WHY A COVERED BUTTON IS AN OUTCOME. On one site the click was intercepted: Playwright resolved
 * `#db-rerun-btn`, found it visible and enabled, retried for thirty seconds against `<div>… intercepts
 * pointer events`, and threw out of `beforeAll` — so all three cases reported a Playwright timeout and
 * none of them reported the stand. The overlay was the product's own setup wizard
 * (`onboarding-wizard.js`, `_buildOverlay`: a `div` with no id and no class, `position:fixed; inset:0;
 * z-index:9999`), opened because the server said that site was short of a required input, and `?setup=0`
 * does not suppress it — the wizard decided the state opens it, not the address. So the button is waited
 * for until it is the element at its own centre, whatever stands over it is PRINTED with enough of its
 * markup to be recognised, and a button still covered is recorded as an outcome and the run goes on.
 *
 * Run: GILBA_E2E=1 GILBA_E2E_GH727=1 GILBA_E2E_GH727_SITES='<name>;<name>' \
 *      npx jest tests/e2e/gh727-the-weed-set-on-the-stand-live.test.js
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

let chromium = null;
try { ({ chromium } = require('playwright')); } catch (e) { /* reported below */ }
const { openTranscript } = require('./lib/transcript');

const ENABLED = process.env.GILBA_E2E === '1' && process.env.GILBA_E2E_GH727 === '1' && !!chromium;
const CREDENTIALS_PATH = process.env.GILBA_E2E_CREDENTIALS || path.join(__dirname, '.e2e-credentials.json');
const credentials = fs.existsSync(CREDENTIALS_PATH) ? JSON.parse(fs.readFileSync(CREDENTIALS_PATH, 'utf8')) : {};
const BASE_URL = process.env.GILBA_E2E_URL || credentials.url || 'http://127.0.0.1:8080';
const EMAIL = process.env.GILBA_E2E_EMAIL || credentials.email;
const PASSWORD = process.env.GILBA_E2E_PASSWORD || credentials.password;

/** The sites this run may press, from the window it was opened for. */
const PRESSING = String(process.env.GILBA_E2E_GH727_SITES || '').split(';')
    .map((n) => n.trim()).filter((n) => n);

/**
 * How many species each region gets, from the plan's own table — the numbers a person will count as
 * cards on `/plan`. Written out rather than taken from the engine: an expectation read from the thing
 * under measurement agrees with it however wrong both are.
 *
 * A region absent from here is not a pass: the case says so by name, because a row carrying a region
 * whose set nobody has established is exactly the thing worth looking at.
 */
const SET_SIZE = {
    australia_temperate: 13,
    australia_mediterranean: 13,
    australia: 13,
    new_zealand: 12,
    uk_ireland: 9,
    us_north: 7,
    us_transition: 7,
    us_south: 7,
    japan: 7,
    south_africa: 7,
    southeast_asia: 22,
    australia_tropical: 22,
    australia_subtropical: 18,
};

function query(sql) {
    return execFileSync('docker', ['exec', 'gilba_mysql', 'mysql', '-ugilba', '-pgilba_secret',
        'gilba', '-N', '-e', sql], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })
        .split('\n').map((l) => l.trim()).filter((l) => l);
}

/** The last stored row of every site that has one, with the region and the species count it carries. */
function standNow() {
    const rows = query(
        "SELECT CONCAT(s.name,'|',s.id,'|',COALESCE(s.latitude,'-'),'|',COALESCE(s.longitude,'-'),'|',"
        + "ar.id,'|',COALESCE(JSON_UNQUOTE(JSON_EXTRACT(ar.computed,'$.preEmergent.summary.region')),'(none)'),'|',"
        + "COALESCE(JSON_LENGTH(JSON_EXTRACT(ar.computed,'$.preEmergent.results')),'(none)'),'|',ar.created_at) "
        + "FROM sites s JOIN analysis_results ar "
        + "  ON ar.id = (SELECT MAX(id) FROM analysis_results WHERE site_id = s.id) "
        + "ORDER BY s.name");
    const out = {};
    rows.forEach((r) => {
        const [name, id, lat, lon, rowId, region, n, at] = r.split('|');
        out[name] = { name, id, lat, lon, rowId, region, n, at };
    });

    return out;
}

if (!ENABLED) {
    process.stdout.write('[e2e] gh727-the-weed-set-on-the-stand skipped '
        + '(presses Re-run on the stand — announce first, GILBA_E2E_GH727=1 and the site list)\n');
    test.skip('GH-727 on the stand (disabled)', () => {});
} else {
    describe('GH-727 — what the stored row says about the weeds, before and after the run', () => {
        jest.setTimeout(2400000);
        let browser, page;
        const transcript = openTranscript('gh727-preemergent-region');
        const say = (line) => transcript.say(line);
        let before = {};
        let after = {};
        const pressed = [];
        let refused = null;

        beforeAll(async () => {
            if (!EMAIL || !PASSWORD) throw new Error('no credentials — see tests/e2e/.e2e-credentials.example.json');

            before = standNow();
            say('BEFORE — every site with a stored row: name · pe_region · pe_n · row · run at');
            Object.keys(before).sort().forEach((k) => {
                const b = before[k];
                say('  BEFORE  ' + b.name + ' · ' + b.region + ' · ' + b.n + ' · row ' + b.rowId + ' · ' + b.at
                    + ' · (' + b.lat + ', ' + b.lon + ')');
            });

            if (!PRESSING.length) {
                refused = 'no site list: set GILBA_E2E_GH727_SITES to the sites the window was opened for';
                say('REFUSED — ' + refused);
                after = before;

                return;
            }
            const notOnTheStand = PRESSING.filter((n) => !before[n]);
            if (notOnTheStand.length) {
                refused = 'named sites with no stored row to compare: ' + notOnTheStand.join(', ');
                say('REFUSED — ' + refused);
                after = before;

                return;
            }
            say('sites this run may press: ' + JSON.stringify(PRESSING));

            browser = await chromium.launch();
            page = await browser.newPage();
            page.on('console', (m) => {
                const t = m.text();
                if (/PreEmergent|pre-emergent|region/i.test(t)) say('console: ' + t.slice(0, 200));
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
            say('logged in as ' + EMAIL);

            for (const name of PRESSING) {
                const wasRow = (before[name] || {}).rowId || '0';
                say('--- ' + name + ': switching through the product’s own switcher');
                await page.goto(BASE_URL + '/dashboard?setup=0', { waitUntil: 'domcontentloaded' });
                await page.waitForTimeout(2500);

                let standing = await page.evaluate(() => ({
                    id: (window.GAIP_HUB_CONFIG || {}).activeSiteId || null,
                    label: ((document.getElementById('db-site-switcher-btn') || {}).textContent || '').trim(),
                }));
                if (standing.label !== name) {
                    await page.click('#db-site-switcher-btn');
                    await page.waitForTimeout(800);
                    const clicked = await page.evaluate((wanted) => {
                        const dd = document.getElementById('db-site-dropdown');
                        if (!dd) return 'no dropdown';
                        const items = Array.from(dd.querySelectorAll('a,button,[data-site-id],li'));
                        const exact = items.find((el) => (el.textContent || '').trim() === wanted);
                        const hit = exact || items.find((el) => (el.textContent || '').trim().includes(wanted));
                        if (!hit) return 'not in the list';
                        hit.click();
                        return exact ? 'clicked (exact)' : 'clicked (by prefix)';
                    }, name);
                    say('  switcher: ' + clicked);
                    await page.waitForTimeout(4000);
                    await page.goto(BASE_URL + '/dashboard?setup=0', { waitUntil: 'domcontentloaded' });
                    await page.waitForTimeout(2500);
                    standing = await page.evaluate(() => ({
                        id: (window.GAIP_HUB_CONFIG || {}).activeSiteId || null,
                        label: ((document.getElementById('db-site-switcher-btn') || {}).textContent || '').trim(),
                    }));
                }
                say('  standing on ' + standing.id + ' — "' + standing.label + '"');

                if (standing.id !== (before[name] || {}).id) {
                    pressed.push({ site: name, pressed: false, why: 'the page stood on ' + standing.label });
                    say('  NOT PRESSED — the page is not standing on this site');
                    continue;
                }

                // WHAT STANDS OVER THE BUTTON, printed, and then waited out.
                let over = null;
                for (let i = 0; i < 40; i += 1) {
                    over = await page.evaluate(() => {
                        const b = document.getElementById('db-rerun-btn');
                        if (!b) return 'no button';
                        const r = b.getBoundingClientRect();
                        const at = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
                        if (!at) return 'nothing at its centre';
                        if (at === b || b.contains(at)) return null;
                        const cls = (at.className && String(at.className).slice(0, 60)) || '';
                        const named = at.tagName + (at.id ? '#' + at.id : '') + (cls ? '.' + cls : '');
                        // An overlay built in JavaScript carries neither, so enough of its own markup
                        // travels with it to be recognised without reading the page's source.
                        const head = String(at.outerHTML || '').replace(/\s+/g, ' ').slice(0, 110);

                        return named + ' — ' + head;
                    });
                    if (!over) break;
                    if (i === 0) say('  the button is covered by ' + over + ' — waiting');
                    await page.waitForTimeout(500);
                }
                say('  what is at the button’s centre: ' + (over ? over + ' (still covering it)' : 'the button itself'));

                if (over) {
                    // NOT AN ERROR HERE, AN ANSWER: something in the product stands between a person
                    // and this button, and that is what this run has to say about the site.
                    pressed.push({ site: name, pressed: false, why: 'covered by ' + over });
                    say('  NOT PRESSED — the button is not reachable on this site');
                    continue;
                }

                try {
                    await page.click('#db-rerun-btn', { timeout: 15000 });
                } catch (e) {
                    pressed.push({ site: name, pressed: false, why: 'the click did not land: ' + String(e.message).split('\n')[0] });
                    say('  NOT PRESSED — ' + String(e.message).split('\n')[0]);
                    continue;
                }
                say('  pressed Re-run at ' + new Date().toISOString());

                // The row landing is the signal, taken from the database rather than from the screen.
                let landed = null;
                for (let i = 0; i < 60 && !landed; i += 1) {
                    await page.waitForTimeout(3000);
                    const now = standNow()[name];
                    if (now && Number(now.rowId) > Number(wasRow)) landed = now;
                }
                if (landed) {
                    say('  row ' + wasRow + ' -> ' + landed.rowId + ' · ' + landed.region + ' · ' + landed.n);
                    pressed.push({ site: name, pressed: true, row: landed.rowId });
                } else {
                    say('  NO NEW ROW within 180s');
                    pressed.push({ site: name, pressed: true, row: null });
                }
            }

            after = standNow();
            say('AFTER — the same list, side by side with before:');
            Object.keys(after).sort().forEach((k) => {
                const b = before[k] || {};
                const a = after[k];
                const moved = b.rowId !== a.rowId;
                say('  ' + (moved ? 'RAN     ' : 'AS WAS  ') + a.name
                    + ' · ' + (b.region || '(no row)') + ' -> ' + a.region
                    + ' · ' + (b.n || '-') + ' -> ' + a.n
                    + ' · row ' + (b.rowId || '-') + ' -> ' + a.rowId);
            });
        });

        afterAll(async () => {
            if (browser) await browser.close();
            transcript.close();
        });

        test('POSITIVE CONTROL: the run had a list, and every site on it was pressed with a row landing', () => {
            // Without this, the case below is satisfied by a run that never happened: an unchanged row
            // reads the same as a row that was never asked for.
            say('presses: ' + JSON.stringify(pressed));
            expect(refused).toBeNull();
            expect(pressed.map((p) => p.site)).toEqual(PRESSING);
            expect(pressed.filter((p) => !p.pressed || !p.row)
                .map((p) => p.site + ': ' + (p.why || 'pressed, but no row landed within 180s')))
                .toEqual([]);
        });

        test('THE ANSWER: each row that was written carries a declared region and that region’s set', () => {
            const said = PRESSING.map((name) => {
                const a = after[name] || {};
                const n = Number(a.n);
                const wanted = SET_SIZE[a.region];

                return [name, a.region, n, wanted === undefined ? 'no set size declared for this region'
                    : (n === wanted ? 'as the plan says' : 'the plan says ' + wanted)];
            });
            said.forEach((r) => say('  AFTER ' + r[0] + ' · ' + r[1] + ' · ' + r[2] + ' — ' + r[3]));
            expect(said.map((r) => [r[0], r[3]]))
                .toEqual(PRESSING.map((name) => [name, 'as the plan says']));
        });

        test('and no site outside the list has a new row — this file’s own stand protection', () => {
            const moved = Object.keys(before)
                .filter((name) => PRESSING.indexOf(name) < 0)
                .filter((name) => (after[name] || {}).rowId !== before[name].rowId)
                .map((name) => name + ': row ' + before[name].rowId + ' -> ' + (after[name] || {}).rowId);
            say('sites outside the list whose last row moved: ' + JSON.stringify(moved));
            expect(moved).toEqual([]);
            // and the comparison was made over a stand that has rows at all
            expect(Object.keys(before).length).toBeGreaterThan(PRESSING.length);
        });
    });
}
