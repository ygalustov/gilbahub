/**
 * GH-522 — a witness for the stand guard.
 *
 * WHY THIS FILE EXISTS. Nineteen live tests use one of the GH-519 remedies —
 * `guardStand` in 12 of them, `fillOwnAnnualN` in 17, capture-and-restore in 7
 * — and, measured across the suite, NOT ONE of them asserted that the guard had
 * held anything. Every one of them would pass exactly as it does now if
 * `guardStand()` returned an object that intercepted nothing: the route handler
 * would never fire, the writes would go through to the stand, and the tests
 * would stay green while the thing they were fitted with did nothing.
 *
 * "The stand did not move" was then read off a snapshot diff taken outside the
 * suite. That is a real measurement, but it answers a different question: a diff
 * of zero is equally consistent with "the guard held the writes" and with "no
 * write was attempted this run". The two are told apart by asking the guard what
 * it caught, and until this file nobody asked.
 *
 * WHAT IT ASSERTS
 *   1. Positive control — the guard held a write to SITE_CONFIGS, named by
 *      table. Not "held more than zero": the first version of this file
 *      asserted a count, and the reviewer broke the `site_configs` pattern —
 *      the one row-class the stand was actually moving on — and got three of
 *      three green with a byte-identical report, because the page this witness
 *      walked never writes a config at all. A witness that counts is satisfied
 *      by whatever happens to pass; a witness that names the table has to be
 *      taken to the place the thing it guards occurs. So it now presses
 *      Generate on the Plan page, which persists the programme.
 *   2. Negative control — reads still reach the server. Without it, "held
 *      everything" and "held the right things" are indistinguishable, and a
 *      guard that blocked the whole API would pass control 1.
 *   3. The held entries carry what they held: a method, a path, a table.
 *
 * WHAT IT DOES NOT ASSERT, said here rather than left to be assumed: that the
 * database row is unchanged. This test sees the browser side of the guard. The
 * row is checked by the stand snapshot taken around the run, which is a separate
 * instrument with a separate failure mode.
 *
 * Site: Burns (019e96d8-97b7-714c-9bd6-d65b16ec7f2e). The annual-N field is
 * filled only if it is empty, through `fillOwnAnnualN`, which takes the site's
 * own figure and throws rather than inventing one — the same call gh398 makes.
 * Then Generate, which is what saves a programme and therefore what writes a
 * config.
 *
 * Run: GILBA_E2E=1 npx jest tests/e2e/gh522-stand-guard-witness-live.test.js
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

const SITE = { name: 'Burns', id: '019e96d8-97b7-714c-9bd6-d65b16ec7f2e' };

let chromium = null;
try { ({ chromium } = require('playwright')); } catch (e) { /* reported below */ }
let guardStand = null, SITE_STATE_WRITES = null;
let fillOwnAnnualN = null, captureConfigsOnce = null, restoreConfigs = null;
try {
    ({ guardStand, SITE_STATE_WRITES, fillOwnAnnualN, captureConfigsOnce, restoreConfigs }
        = require('./lib/stand-guard'));
} catch (e) { /* reported below */ }

/** Which tables a slice of the held list names — printed, so the journal says what, not how many. */
function tablesOf(held) {
    const t = Array.from(new Set(held.map((h) => h.table)));
    return t.length ? t.join(', ') : 'nothing';
}

if (!ENABLED) {
    process.stdout.write('[e2e] gh522-stand-guard-witness-live skipped (needs the live stack)\n');
    test.skip('GH-522 stand guard witness (disabled)', () => {});
} else {
    describe('GH-522 — the stand guard is asked what it caught', () => {
        let browser, page, guard, previousActiveSiteId = null;
        const journal = [];

        beforeAll(async () => {
            if (!chromium) throw new Error('playwright does not resolve from the repo — run `npm install`');
            if (!guardStand) throw new Error('tests/e2e/lib/stand-guard.js does not resolve');
            if (!EMAIL || !PASSWORD) throw new Error('no credentials');
            // GH-522: capture BEFORE anything, and put back in afterAll — even
            // though this test installs the guard two lines below and the guard
            // is supposed to make that unnecessary.
            //
            // It is necessary precisely here. This is the one test whose red
            // check is performed by BREAKING THE GUARD ITSELF: to prove the
            // assertion below is not blind, someone edits a pattern in
            // SITE_STATE_WRITES so the config write is no longer intercepted.
            // That run has no protection at all, and the writes land on the
            // stand. Measured, the first time it was done here: Burns's config
            // row moved — md5 3afdaffd -> f1179119, 19857 -> 19862 bytes,
            // updated_at 2026-09-17 07:13:28 -> 2026-09-18 03:38:26 — and had to
            // be put back by hand from the GH-519 content backup.
            //
            // A remedy whose own red check disables the remedy needs a second,
            // independent one. Capture-and-restore is SQL and does not go
            // through the intercepted routes, so it survives the mutation that
            // this file's positive control exists to be caught by.
            captureConfigsOnce();
            browser = await chromium.launch();
            const context = await browser.newContext();
            guard = await guardStand(context);
            page = await context.newPage();
            await page.goto(BASE_URL + '/login', { waitUntil: 'domcontentloaded' });
            await page.fill('#email', EMAIL);
            await page.fill('#password', PASSWORD);
            await Promise.all([
                page.waitForNavigation({ waitUntil: 'domcontentloaded' }).catch(() => {}),
                page.click('form.login-form button[type=submit]')
            ]);
            await page.waitForTimeout(1500);
            if (/\/login/.test(page.url())) throw new Error('login refused for ' + EMAIL);

            const sites = await page.evaluate(async () => {
                const r = await fetch('/api/sites', { headers: { Accept: 'application/json' }, credentials: 'same-origin' });
                return r.json();
            });
            previousActiveSiteId = sites.active_site_id;
            await page.evaluate(async ({ id }) => {
                const t = document.querySelector('meta[name=csrf-token]');
                await fetch('/api/active-site', {
                    method: 'PATCH',
                    headers: Object.assign({ 'Content-Type': 'application/json', Accept: 'application/json' },
                        t ? { 'X-CSRF-TOKEN': t.getAttribute('content') } : {}),
                    body: JSON.stringify({ site_id: id }),
                    credentials: 'same-origin',
                });
            }, { id: SITE.id });

            // THE PROVOCATION, and how it was arrived at. The first draft opened
            // /plan alone, on the strength of GH-519's note that "opening the
            // Plan page already writes", and the guard held ZERO — a witness
            // whose provocation never reaches the path, which is the exact class
            // of test this delivery is fixing.
            //
            // Stated no wider than the measurement: that does NOT show GH-519's
            // note was wrong. It was made in a different flow, where the capture
            // came first and nothing else had run. What the journal below shows
            // is this walk, in this order, on this site — and in this order /plan
            // adds nothing, because the sync has already gone out on the page
            // before it. So the walk is recorded step by step and printed, which
            // is what makes the number below a measurement rather than a hope.
            for (const step of ['/analysis/growth-light', '/plan']) {
                const before = guard.held.length;
                await page.goto(BASE_URL + step, { waitUntil: 'domcontentloaded' });
                await page.waitForTimeout(9000);
                journal.push(step + ' → held ' + (guard.held.length - before)
                    + ' (' + tablesOf(guard.held.slice(before)) + ')');
            }

            // The provocation that matters: generating a programme persists it,
            // and persisting it is a config write. Walking pages was never going
            // to produce one.
            const beforeGen = guard.held.length;
            // The Plan page keeps this behind a tab, and Generate needs a pinned
            // sample. The first draft clicked the button straight away and timed
            // out against an element that existed but was not reachable — the
            // same sequence gh398 makes, for the same reason.
            await page.waitForFunction(() => !!window.GilbaNutritionCalendar, null, { timeout: 30000 });
            await page.click('a[data-tab="nutrition"]');
            await page.waitForTimeout(1000);
            await page.waitForSelector('#plan-nut-sample-picker .sn-drop-btn', { timeout: 20000 });
            const picked = await page.evaluate(() => {
                const btn = document.querySelector('#plan-nut-sample-picker .sn-drop-btn');
                if (!btn) return { ok: false, reason: 'no picker' };
                btn.click();
                const rows = Array.from(document.querySelectorAll('#plan-nut-sample-picker .sn-drop-row'));
                if (!rows.length) return { ok: false, reason: 'picker has no rows' };
                // The first row, whichever it is: this file's subject is the
                // guard, not a particular sample. Which one it was is recorded,
                // so the run is not describing a sample it never names.
                const label = ((rows[0].querySelector('.sn-drop-cell-zone') || {}).textContent || '').trim();
                rows[0].click();
                return { ok: true, label: label, of: rows.length };
            });
            if (!picked.ok) throw new Error('could not pin a sample in the Plan picker: ' + JSON.stringify(picked));
            journal.push('pinned sample "' + picked.label + '" (1 of ' + picked.of + ')');
            await page.waitForTimeout(1200);
            await fillOwnAnnualN(page);
            await page.evaluate(() => { window.__gh522Generated = 0;
                document.addEventListener('gaip:nutrition-calendar-generated', () => { window.__gh522Generated++; }); });
            await page.click('#plan-nut-generate-btn');
            await page.waitForFunction(() => window.__gh522Generated > 0
                && document.querySelectorAll('td.gilba-nut-cell--n').length === 12,
                null, { timeout: 120000 });
            await page.waitForTimeout(6000);
            journal.push('Generate on /plan → held ' + (guard.held.length - beforeGen)
                + ' (' + tablesOf(guard.held.slice(beforeGen)) + ')');
            process.stdout.write('[gh522] provocation journal:\n  ' + journal.join('\n  ') + '\n');
        }, 600000);

        afterAll(async () => {
            if (page && previousActiveSiteId) {
                await page.evaluate(async ({ id }) => {
                    const t = document.querySelector('meta[name=csrf-token]');
                    await fetch('/api/active-site', {
                        method: 'PATCH',
                        headers: Object.assign({ 'Content-Type': 'application/json', Accept: 'application/json' },
                            t ? { 'X-CSRF-TOKEN': t.getAttribute('content') } : {}),
                        body: JSON.stringify({ site_id: id }),
                        credentials: 'same-origin',
                    });
                }, { id: previousActiveSiteId }).catch(() => {});
            }
            if (browser) await browser.close();
            const back = restoreConfigs();
            process.stdout.write('[gh522] GH-519 restore: ' + JSON.stringify({
                restored: back.restored, failed: back.failed, unchanged: back.unchanged }) + '\n');
            if (back.failed && back.failed.length) {
                throw new Error('GH-522: a captured configuration could not be put back: '
                    + JSON.stringify(back.failed));
            }
        }, 180000);

        test('positive control: the guard held a write to site_configs, by name', () => {
            expect.hasAssertions();
            process.stdout.write('[gh522] journal:\n  ' + journal.join('\n  ') + '\n');
            process.stdout.write('[gh522] ' + guard.report() + '\n');
            process.stdout.write('[gh522] held: ' + JSON.stringify(guard.held) + '\n');
            expect(Array.isArray(guard.held)).toBe(true);
            const tables = guard.held.map((h) => h.table);
            // The named table, not a count. Breaking the `site_configs` pattern
            // in SITE_STATE_WRITES must bring this down; a count survives it.
            expect(tables).toContain('site_configs');
        });

        test('what it held is a site-state write, named by table', () => {
            expect.hasAssertions();
            const tables = SITE_STATE_WRITES.map((w) => w.table);
            guard.held.forEach((h) => {
                expect(typeof h.method).toBe('string');
                expect(['POST', 'PUT', 'PATCH', 'DELETE']).toContain(h.method);
                expect(typeof h.path).toBe('string');
                expect(h.path.length).toBeGreaterThan(0);
                expect(tables).toContain(h.table);
            });
        });

        test('negative control: reads still reach the server, so the guard is narrow', () => {
            // Without this, a guard that answered every request would pass the
            // control above. "Held something" and "held only what it should" are
            // two claims and need two assertions.
            expect.hasAssertions();
            const reached = guard.reached || [];
            process.stdout.write('[gh522] reached the server: ' + reached.length
                + ' — methods ' + JSON.stringify(Array.from(new Set(reached.map((r) => r.split(' ')[0]))).sort()) + '\n');
            expect(reached.length).toBeGreaterThan(0);
            expect(reached.some((r) => /^GET /.test(r))).toBe(true);
        });
    });
}
