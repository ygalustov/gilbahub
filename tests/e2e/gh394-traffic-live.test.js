/**
 * GH-394 live check — the traffic modifier, end to end on the real stack.
 *
 * D31 stage 3 wired two links that did not exist: Settings > Traffic & Wear
 * now persists its schedule in the site's gaip config, and the shared input
 * adapter derives the intensity from it. Neither is provable offline — the
 * whole point is that a value written in one browser reaches the server, the
 * Plan page and the export — so this file drives the real app the way
 * tests/e2e/ui-vs-export-parity.test.js does, and for the same reason: a
 * committed test is repeatable and re-runs when the code moves under it.
 *
 * What it proves, in order:
 *   1. Saving the Settings form sends the schedule to the server (read back
 *      through the API, not through the browser that wrote it). GH-524: the
 *      product does this with `patchGaipConfig({traffic: ...})` — one key, sent
 *      as a change. This file used to describe it as a PUT and used a PUT of
 *      its own; see `patchGaipSection` below.
 *   2. A FRESH browser context — no localStorage at all, i.e. a second device
 *      — sees the schedule on Settings.
 *   3. On that fresh context, the Plan page's generated programme carries the
 *      derived level, the modifier and a scaled annual N, with the PRE-traffic
 *      base preserved as meta.annualNBase so a regenerate cannot compound it.
 *   4. A GOLF site with the identical schedule does not move at all
 *      (decision D-3, sports turfType only).
 *   5. Clearing the schedule returns the sports site to its original number —
 *      "nothing entered" is neutral, never the form placeholder's 2.
 *
 * Every site config it touches is snapshotted before and put back afterwards by
 * the GH-519 SQL restore — bytes and timestamp — and the restore is verified
 * rather than assumed.
 *
 * HOW TO RUN: same stack and credentials as the parity harness —
 *   npm run test:e2e:traffic
 * `npx jest` alone skips it with one line on stdout.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { fillOwnAnnualN, captureConfigsOnce, restoreConfigs } = require('./lib/stand-guard');

const CREDENTIALS_PATH = process.env.GILBA_E2E_CREDENTIALS
    || path.join(__dirname, '.e2e-credentials.json');
let fileCredentials = {};
try {
    fileCredentials = JSON.parse(fs.readFileSync(CREDENTIALS_PATH, 'utf8'));
} catch (e) {
    fileCredentials = {};
}

const ENABLED = process.env.GILBA_E2E === '1';
const BASE_URL = process.env.GILBA_E2E_URL || fileCredentials.url || 'http://127.0.0.1:8080';
const EMAIL = process.env.GILBA_E2E_EMAIL || fileCredentials.email;
const PASSWORD = process.env.GILBA_E2E_PASSWORD || fileCredentials.password;

// The dev stack's two fixtures for this check: one sports site (the only turf
// type traffic applies to) and one golf site as the control. Resolved by name
// so a re-seeded stack fails loudly with the list of what it does have,
// rather than silently testing some other site.
const SPORTS_SITE_NAME = 'Test1 - Sports';
const CONTROL_SITE_NAME = 'Burns';
// Decision D-10: 2 matches/week is "> 1", i.e. `high` = x1.15.
const MATCHES_PER_WEEK = 2;
const SESSIONS_PER_WEEK = 3;

let chromium = null;
let playwrightError = null;
try {
    ({ chromium } = require('playwright'));
} catch (e) {
    playwrightError = e;
}

if (!ENABLED) {
    process.stdout.write('[e2e] tests/e2e/gh394-traffic-live.test.js skipped (needs the live stack) — run it with `npm run test:e2e:traffic`, see the file header.\n');
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
}

if (!ENABLED) {
    describe('GH-394 traffic live check', () => {
        test.skip('needs GILBA_E2E=1 and the live stack', () => {});
    });
} else if (blockers.length) {
    describe('GH-394 traffic live check', () => {
        test('cannot run — every blocker is a failure, never a skip', () => {
            throw new Error('GILBA_E2E=1 but the harness cannot run:\n  - ' + blockers.join('\n  - '));
        });
    });
} else {
    describe('GH-394 — traffic, live on the real stack', () => {
        jest.setTimeout(600000);

        let browser = null;
        let page = null;                 // context A — the browser that saves
        let freshPage = null;            // context B — a second device
        let previousActiveSiteId = null;
        const original = {};             // siteId -> config snapshot
        const site = {};                 // name -> id

        // Results captured in beforeAll so each assertion below reads a
        // recorded number rather than re-driving the browser.
        let restoreReport = null;
        const seen = {
            savedSchedule: null,
            freshFormMatches: null,
            sportsBefore: null,
            sportsWithTraffic: null,
            controlWithTraffic: null,
            sportsCleared: null,
            restored: {}
        };

        function csrfFetch(p, method, url, body) {
            return p.evaluate(async ({ method, url, body }) => {
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

        async function login(p) {
            await p.goto(BASE_URL + '/login', { waitUntil: 'domcontentloaded' });
            await p.fill('#email', EMAIL);
            await p.fill('#password', PASSWORD);
            await Promise.all([
                p.waitForNavigation({ waitUntil: 'domcontentloaded' }).catch(() => {}),
                p.click('form.login-form button[type=submit]')
            ]);
            await p.waitForTimeout(1500);
            if (/\/login/.test(p.url())) {
                throw new Error('login was refused for ' + EMAIL + ' (still on ' + p.url() + ')');
            }
        }

        async function gaipConfig(p, siteId) {
            const r = await csrfFetch(p, 'GET', '/api/sites/' + siteId);
            if (!r.ok) throw new Error('GET /api/sites/' + siteId + ' failed: HTTP ' + r.status);
            const configs = (r.json && r.json.data && r.json.data.configs) || {};
            return (configs.gaip && configs.gaip.config) || null;
        }

        /**
         * GH-524: send the CHANGE, not the state.
         *
         * What stood here was `putGaipConfig`, a PUT of a whole config object
         * assembled in the browser to /api/sites/{id}/config/gaip. That route
         * exists and refuses on purpose — app/routes/web.php:106 ->
         * SiteController::updateConfig (SiteController.php:395), 410 by decision
         * GH-442, reasoning at :407 and the refusal at :416-419: a config put
         * together on the client may no longer become the truth about a site.
         * This file was therefore red without any mutation, pinning a behaviour
         * the product had removed.
         *
         * A PATCH names the keys it changes and nothing else. `traffic` is one
         * of the keys GAIP_CONFIG_KEYS allows (SiteController.php:25-29).
         * `savedAt` is deliberately NOT among them and must not be sent: the
         * server stamps it, so that a timestamp a client chose cannot decide a
         * merge — sending one is the 422 this file's own teardown note records.
         */
        async function patchGaipSection(p, siteId, patch) {
            const keys = Object.keys(patch);
            if (keys.indexOf('savedAt') >= 0) {
                throw new Error('GH-524: savedAt is the server\'s to stamp — a client must not send it');
            }
            // The body is `{patch: {...}}`, the shape settings-init.js's own
            // patchGaipConfig() builds and SiteController::patchConfig validates
            // ('patch' => required_without:clear). The first draft sent the bare
            // sections and got 422 "The patch field is required" — caught by the
            // control run, which is what the control run is for.
            const r = await csrfFetch(p, 'PATCH', '/api/sites/' + siteId + '/config/gaip', { patch: patch });
            if (!r.ok) {
                throw new Error('PATCH ' + JSON.stringify(keys) + ' for ' + siteId
                    + ' failed: HTTP ' + r.status + ' ' + JSON.stringify(r.json).slice(0, 200));
            }
            return r.json;
        }

        async function setActiveSite(p, siteId) {
            const r = await csrfFetch(p, 'PATCH', '/api/active-site', { site_id: siteId });
            if (!r.ok) throw new Error('PATCH /api/active-site failed: HTTP ' + r.status);
            await p.waitForTimeout(300);
        }

        /** Save the Settings > Traffic & Wear form through the UI, as a user does. */
        async function saveTrafficForm(p, matches, sessions) {
            await p.goto(BASE_URL + '/settings#traffic', { waitUntil: 'domcontentloaded' });
            await p.waitForSelector('#stg-traffic-form', { timeout: 30000 });
            await p.waitForTimeout(1200);
            await p.evaluate(({ matches, sessions }) => {
                const m = document.getElementById('stg-tw-matches');
                const s = document.getElementById('stg-tw-sessions');
                if (m) m.value = (matches === null) ? '' : String(matches);
                if (s) s.value = (sessions === null) ? '' : String(sessions);
            }, { matches, sessions });
            await p.click('#stg-traffic-save');
            // The save is a real server write — wait for the handler's own "Saved."
            await p.waitForFunction(() => {
                const el = document.getElementById('stg-traffic-msg');
                return el && /Saved\./i.test(el.textContent || '');
            }, null, { timeout: 30000 });
            await p.waitForTimeout(500);
        }

        /** Generate on /plan and read back what the page computed and rendered. */
        async function generateOnPlan(p) {
            await p.goto(BASE_URL + '/plan', { waitUntil: 'domcontentloaded' });
            await p.waitForFunction(() => !!(window.GilbaNutritionCalendar &&
                (window.NutritionPrebbleIntegration || window.NutritionAuFertiliserIntegration)),
            null, { timeout: 30000 });
            await p.waitForTimeout(2500);   // site-config restore cascade
            await p.click('a[data-tab="nutrition"]');
            await p.waitForTimeout(1000);
            await p.evaluate(() => {
                window.__gh394Generated = 0;
                document.addEventListener('gaip:nutrition-calendar-generated', () => { window.__gh394Generated++; });
            });
            // GH-519: the target is the site's own, not one left by an earlier run.
            await fillOwnAnnualN(p);
            await p.click('#plan-nut-generate-btn');
            await p.waitForFunction(() => {
                const NC = window.GilbaNutritionCalendar;
                const el = document.querySelector('#plan-nut-results');
                return window.__gh394Generated > 0 && NC && NC.program &&
                    el && el.style.display !== 'none' && /Nutrient Delivery Summary/i.test(el.innerText || '');
            }, null, { timeout: 90000 });
            await p.waitForTimeout(1500);   // persist settle
            return p.evaluate(() => {
                const prog = window.GilbaNutritionCalendar.program || {};
                const el = document.querySelector('#plan-nut-results');
                const text = el ? el.innerText : '';
                // The rendered "N kg/ha/yr" card, read off the page the way a
                // user reads it — not off the program object.
                let renderedN = null;
                const lines = text.split('\n').map((l) => l.trim());
                for (let i = 1; i < lines.length - 1; i++) {
                    if (lines[i].replace(/GENERIC|CERTIFICATE/i, '').trim().toUpperCase() !== 'N') continue;
                    if (!/^kg\/ha/i.test(lines[i + 1])) continue;
                    const v = parseFloat(lines[i - 1].replace(/[^0-9.\-]/g, ''));
                    if (!isNaN(v)) { renderedN = v; break; }
                }
                return {
                    renderedN: renderedN,
                    annualNInput: parseFloat((document.getElementById('plan-nut-annual-n') || {}).value),
                    targetN: prog.adjustments && prog.adjustments.target_n,
                    trafficModifier: prog.adjustments && prog.adjustments.traffic_modifier,
                    trafficIntensity: prog.meta && prog.meta.trafficIntensity,
                    trafficSource: prog.meta && prog.meta.trafficSource,
                    annualNBase: prog.meta && prog.meta.annualNBase,
                    removal: prog.annual_removal || null
                };
            });
        }

        beforeAll(async () => {
            browser = await chromium.launch({ headless: true });
            const ctxA = await browser.newContext();
            page = await ctxA.newPage();
            await login(page);

            const sites = await csrfFetch(page, 'GET', '/api/sites');
            if (!sites.ok) throw new Error('GET /api/sites failed: HTTP ' + sites.status);
            previousActiveSiteId = sites.json && sites.json.active_site_id;
            const listed = (sites.json && sites.json.data) || [];
            [SPORTS_SITE_NAME, CONTROL_SITE_NAME].forEach((name) => {
                const found = listed.find((s) => s.name === name);
                if (!found) {
                    throw new Error('site "' + name + '" is not among this login\'s sites: ' +
                        listed.map((s) => s.name).join(', '));
                }
                site[name] = found.id;
            });

            captureConfigsOnce();
            original[site[SPORTS_SITE_NAME]] = await gaipConfig(page, site[SPORTS_SITE_NAME]);
            original[site[CONTROL_SITE_NAME]] = await gaipConfig(page, site[CONTROL_SITE_NAME]);

            // ── the sports site, BEFORE any schedule exists ──
            await setActiveSite(page, site[SPORTS_SITE_NAME]);
            seen.sportsBefore = await generateOnPlan(page);

            // ── 1. save the schedule through the Settings UI ──
            await saveTrafficForm(page, MATCHES_PER_WEEK, SESSIONS_PER_WEEK);
            const afterSave = await gaipConfig(page, site[SPORTS_SITE_NAME]);
            seen.savedSchedule = afterSave && afterSave.traffic;

            // ── 2 + 3. a second device: fresh context, no localStorage ──
            const ctxB = await browser.newContext();
            freshPage = await ctxB.newPage();
            await login(freshPage);
            await freshPage.goto(BASE_URL + '/settings#traffic', { waitUntil: 'domcontentloaded' });
            await freshPage.waitForSelector('#stg-traffic-form', { timeout: 30000 });
            await freshPage.waitForTimeout(1500);
            seen.freshFormMatches = await freshPage.evaluate(() => {
                const el = document.getElementById('stg-tw-matches');
                return el ? el.value : null;
            });
            seen.sportsWithTraffic = await generateOnPlan(freshPage);

            // ── 4. the golf control, same schedule, written straight to its config ──
            // GH-524: the one key this step changes, and no copy of the rest of
            // the config travelling with it. The old line cloned the whole saved
            // object, set `traffic` on the clone and PUT the clone back — so a
            // step whose subject is "does a golf site ignore a schedule" also
            // rewrote every other field of that site from a browser's copy, and
            // stamped its own `savedAt`.
            // Shaped exactly as the product's own save shapes it
            // (settings-init.js: `patchGaipConfig({traffic: {schedule, savedAt}})`)
            // — `savedAt` nested INSIDE the key, which is allowed, not at the top
            // level, which is the 422. A setup write that differs in shape from
            // the real one is a setup write proving something else.
            await patchGaipSection(page, site[CONTROL_SITE_NAME], {
                traffic: {
                    schedule: { matchesPerWeek: MATCHES_PER_WEEK, sessionsPerWeek: SESSIONS_PER_WEEK },
                    savedAt: new Date().toISOString()
                }
            });
            await setActiveSite(page, site[CONTROL_SITE_NAME]);
            seen.controlWithTraffic = await generateOnPlan(page);

            // ── 5. clear the sports site's schedule again ──
            await setActiveSite(page, site[SPORTS_SITE_NAME]);
            await saveTrafficForm(page, null, null);
            seen.sportsCleared = await generateOnPlan(page);

            // ── read both sites back; the restore itself is in the teardown ──
            // GH-524: the two whole-object PUTs that stood here are gone. They
            // were a second restore, done through the API, on top of the SQL one
            // the teardown already performs — and the teardown's own note says
            // why that is wrong: a config put back through the API carries a
            // fresh `savedAt` and `updated_at`, and the row then looks exactly
            // like a row a user had just saved. One restore, by the method that
            // puts back the bytes AND the timestamp.
            seen.restored[site[SPORTS_SITE_NAME]] = await gaipConfig(page, site[SPORTS_SITE_NAME]);
            seen.restored[site[CONTROL_SITE_NAME]] = await gaipConfig(page, site[CONTROL_SITE_NAME]);

            // GH-524: the restore runs HERE, at the end of the run, so its own
            // report can be asserted. Putting it only in the teardown left
            // nothing to check: afterAll runs after every test, so a test asking
            // whether the configs were put back was reading a report that did
            // not exist yet — measured, `restore report: null`. The teardown
            // still calls it, and on a run that reached this line it finds every
            // row already matching and writes nothing.
            try { restoreReport = restoreConfigs(); }
            catch (e) { restoreReport = { restored: [], failed: ['the restore threw: ' + (e && e.message)] }; }
            if (previousActiveSiteId) await setActiveSite(page, previousActiveSiteId);

            // Print what was actually observed. A live check whose numbers are
            // only ever compared and never shown is one nobody can sanity-check
            // afterwards, and these are the figures a changelog entry quotes.
            const row = (label, r) => '  ' + label.padEnd(28) +
                'N target ' + String(r.targetN).padStart(4) +
                ' (base ' + r.annualNBase + ' x ' + r.trafficModifier + ')' +
                '  rendered ' + r.renderedN +
                '  ' + r.trafficIntensity + '/' + r.trafficSource +
                '  removal ' + JSON.stringify(r.removal);
            process.stdout.write('[gh394] live observations\n' +
                row(SPORTS_SITE_NAME + ' before', seen.sportsBefore) + '\n' +
                row(SPORTS_SITE_NAME + ' 2 matches', seen.sportsWithTraffic) + '\n' +
                row(CONTROL_SITE_NAME + ' (golf ctrl)', seen.controlWithTraffic) + '\n' +
                row(SPORTS_SITE_NAME + ' cleared', seen.sportsCleared) + '\n');
        });

        afterAll(async () => {
            // GH-519 — THE THIRD CASE, and it is not the other two.
            //
            // This test's claim IS that the write survives: a second browser
            // context must read back the schedule the first one saved. Holding
            // the write in the browser would not protect the stand here, it
            // would delete the thing being measured. And a site created a
            // moment ago cannot carry it either — the scenario needs a sports
            // site with settings.
            //
            // So: capture and put back. The capture was already here and went
            // nowhere; `original` was filled in beforeAll and never used. The
            // restore below closes that, and if it cannot, this run goes RED
            // rather than quiet — a stand left changed in silence is worse than
            // a failing test.
            // GH-519 — THE THIRD CASE, and it is not the other two.
            //
            // This test's claim IS that the write survives: a second browser
            // context must read back the schedule the first one saved. Holding
            // the write would delete the thing being measured, and a site
            // created a moment ago cannot carry the scenario either.
            //
            // So the configuration is put back. Not through the product: the
            // PUT route answers 410 by decision GH-442, and a PATCH carrying a
            // TOP-LEVEL `savedAt` answers 422, because the server stamps that
            // itself on purpose. A restore through the API would also stamp a
            // fresh `savedAt` and `updated_at`, and the row would then be
            // indistinguishable from a real save. SQL puts back the bytes and
            // the timestamp, and the check is the database's own md5.
            let __restore = null;
            try { __restore = restoreConfigs(); restoreReport = __restore; }
            catch (e) { __restore = { restored: [], failed: ['the restore threw: ' + (e && e.message)] }; }
            finally { if (browser) await browser.close(); }
            if (__restore && __restore.failed.length) {
                throw new Error('GH-519: gh394 could not put the stand back — '
                    + __restore.failed.join('; '));
            }
        });

        test('the saved schedule reaches the server — read back through the API, not the browser that wrote it', () => {
            expect(seen.savedSchedule).toBeTruthy();
            expect(seen.savedSchedule.schedule.matchesPerWeek).toBe(MATCHES_PER_WEEK);
            expect(seen.savedSchedule.schedule.sessionsPerWeek).toBe(SESSIONS_PER_WEEK);
            expect(typeof seen.savedSchedule.savedAt).toBe('string');
        });

        test('a fresh browser context — a second device — shows the schedule on Settings', () => {
            expect(seen.freshFormMatches).toBe(String(MATCHES_PER_WEEK));
        });

        test('the sports site scales its annual N by exactly the derived modifier', () => {
            const before = seen.sportsBefore;
            const after = seen.sportsWithTraffic;
            expect(before.trafficModifier).toBe(1);
            expect(after.trafficIntensity).toBe('high');
            expect(after.trafficModifier).toBe(1.15);
            expect(after.trafficSource).toBe('schedule');
            // The Plan input keeps showing the PRE-traffic base; the target is
            // the scaled one. Both are read off the live page.
            expect(after.annualNBase).toBe(before.annualNBase);
            expect(after.targetN).toBe(Math.round(before.annualNBase * 1.15));
            expect(after.renderedN).toBe(after.targetN);
            expect(after.annualNInput).toBe(after.annualNBase);
        });

        test('removal follows the scaled N — the modifier is applied once, upstream', () => {
            const before = seen.sportsBefore.removal;
            const after = seen.sportsWithTraffic.removal;
            ['P', 'K', 'Ca', 'Mg', 'S'].forEach((n) => {
                if (!(before[n] > 0)) return;
                // Whole-kg rounding on both sides, so allow 1 kg — but 1.3225x
                // (a second, per-nutrient application) is far outside that.
                expect(Math.abs(after[n] - before[n] * 1.15)).toBeLessThanOrEqual(1);
                expect(Math.abs(after[n] - before[n] * 1.3225)).toBeGreaterThan(1);
            });
        });

        test('the golf control does not move at all — traffic is sports turfType only', () => {
            expect(seen.controlWithTraffic.trafficModifier).toBe(1);
            expect(seen.controlWithTraffic.trafficIntensity).toBe('moderate');
            expect(seen.controlWithTraffic.trafficSource).toBe('not-sports');
            expect(seen.controlWithTraffic.targetN).toBe(seen.controlWithTraffic.annualNBase);
        });

        test('clearing the schedule returns the sports site to its original number — no placeholder 2', () => {
            expect(seen.sportsCleared.trafficModifier).toBe(1);
            expect(seen.sportsCleared.trafficSource).toBe('no-schedule');
            expect(seen.sportsCleared.targetN).toBe(seen.sportsBefore.targetN);
        });

        test('what this run left on each site it touched, read back mid-run', () => {
            // GH-524: this test's name and assertions used to say "was put
            // back", and it read `seen.restored`, captured right after the two
            // whole-object PUTs that stood at the end of the main flow. Those
            // PUTs are gone — the route refuses them (GH-442) and they were a
            // second restore layered on top of the SQL one — so this read now
            // happens BEFORE anything is put back, and it measures what the run
            // left behind, not whether it was undone.
            //
            // Renamed to what it measures. The traffic key IS expected here: the
            // run's last act on the sports site is clearing the form, which the
            // product writes as a cleared schedule rather than an absent one.
            // The identity fields must be untouched, which is the half of the
            // original assertion that still belongs to this moment.
            Object.keys(original).forEach((siteId) => {
                const was = original[siteId] || {};
                const now = seen.restored[siteId] || {};
                expect((now.turf || {}).turfType).toBe((was.turf || {}).turfType);
                expect((now.turf || {}).nProgram).toBe((was.turf || {}).nProgram);
            });
        });

        test('the restore itself is verified by the instrument that performed it', () => {
            // Where "put back" is actually proved. `restoreConfigs()` runs in the
            // teardown, writes the captured bytes AND the captured timestamp
            // back through SQL, and checks each row against the database's own
            // md5 — so its report, not an API read taken earlier in the run, is
            // the evidence. The teardown already throws on `failed`; this states
            // it as an assertion so the file says out loud that it is checked.
            process.stdout.write('[gh394] GH-519 restore report: ' + JSON.stringify(restoreReport) + '\n');
            expect(restoreReport).not.toBeNull();
            expect(restoreReport.failed).toEqual([]);
        });
    });
}
