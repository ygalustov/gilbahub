/**
 * GH-545 — the live-weather wait goes from 5 seconds to 15, and the page still
 * falls back when the weather really is not there.
 *
 * THE REASON, and it is a client waiting to start acceptance: the daily average
 * GP table does not compute on his stand because the weather request does not
 * finish inside five seconds. The owner's decision, as a TEMPORARY measure:
 * "raise the timing for now, and if it doesn't help we'll dig further, because
 * I need this working so he can start his acceptance."
 *
 * WHAT THIS RUN IS FOR. Raising a timeout can do two things wrong and both are
 * invisible from the source: the page can stop working when the weather DOES
 * arrive, and it can stop falling back when it does not — a page that waits for
 * ever is worse than one that gives up early. So both paths are driven.
 *
 * WHAT WAS EXPECTED, WRITTEN DOWN BEFORE THE RUN.
 *   1. An ordinary load: the weather badge leaves "Weather: Loading..." and
 *      settles on a real state — live, cached or estimated — and the page is
 *      not left waiting.
 *   2. With the provider unreachable (its host blocked in the browser, so the
 *      stand is not involved): the page STILL settles, and the time it spends
 *      showing "Weather: Loading..." is about fifteen seconds rather than about
 *      five. That is the cost being measured, not a defect: when the weather is
 *      genuinely unavailable the client now waits three times as long before
 *      the fallback, and what he sees for that whole time is the badge reading
 *      "Weather: Loading...".
 *   3. If it settles in ~5s with the provider blocked, the new value is not in
 *      the path and the change has not reached the page.
 *
 * THE PAGE: /reports/export. It carries `weather-resilience.js` and is the one
 * page of the four that does NOT write the analysis cache when opened — it sets
 * `GILBA_REPORTS_EXPORT`, measured on 19.09 as 0 POSTs against
 * /reports/forensic's and /reports/scenarios' 1 each. `guardStand` is on the
 * context as the backstop.
 *
 * Run: GILBA_E2E=1 npx jest tests/e2e/gh545-weather-timeout-live.test.js
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

let chromium = null;
try { ({ chromium } = require('playwright')); } catch (e) { /* reported below */ }
let guardStand = null;
try { ({ guardStand } = require('./lib/stand-guard')); } catch (e) { /* reported below */ }

/** Watch the badge until it stops saying Loading, and time it. */
const WATCH = async (p, budgetMs) => p.evaluate((budget) => new Promise((resolve) => {
    const started = Date.now();
    const read = () => {
        const b = document.getElementById('gaip-weather-status-badge');
        return b ? { text: (b.textContent || '').trim(), cls: b.className } : null;
    };
    const first = read();
    const tick = setInterval(() => {
        const now = read();
        const waited = Date.now() - started;
        if (now && !/Loading/i.test(now.text)) {
            clearInterval(tick);
            resolve({ settled: true, ms: waited, badge: now.text, cls: now.cls, first: first && first.text });
        } else if (waited > budget) {
            clearInterval(tick);
            resolve({ settled: false, ms: waited, badge: now && now.text, cls: now && now.cls, first: first && first.text });
        }
    }, 200);
}), budgetMs);

if (!ENABLED) {
    process.stdout.write('[e2e] gh545-weather-timeout skipped (needs the live stack)\n');
    test.skip('GH-545 weather timeout (disabled)', () => {});
} else {
    describe('GH-545 — the weather wait, and the fallback behind it', () => {
        let browser, context, guard;
        let normal = null, blocked = null, blockedHits = 0;

        beforeAll(async () => {
            if (!chromium) throw new Error('playwright does not resolve from the repo — run `npm install`');
            if (!guardStand) throw new Error('tests/e2e/lib/stand-guard.js does not resolve');
            if (!EMAIL || !PASSWORD) throw new Error('no credentials');

            browser = await chromium.launch();
            context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
            guard = await guardStand(context);

            const login = await context.newPage();
            await login.goto(BASE_URL + '/login', { waitUntil: 'domcontentloaded' });
            await login.fill('#email', EMAIL);
            await login.fill('#password', PASSWORD);
            await Promise.all([
                login.waitForNavigation({ waitUntil: 'domcontentloaded' }).catch(() => {}),
                login.click('form.login-form button[type=submit]')
            ]);
            await login.waitForTimeout(1500);
            if (/\/login/.test(login.url())) throw new Error('login refused for ' + EMAIL);
            await login.close();

            // ---- 1. ordinary load ----
            const p1 = await context.newPage();
            await p1.goto(BASE_URL + '/reports/export', { waitUntil: 'domcontentloaded' });
            normal = await WATCH(p1, 40000);
            process.stdout.write('[gh545] ordinary load: ' + JSON.stringify(normal) + '\n');
            await p1.close();

            // ---- 2. the provider HANGS ----
            // Held in the BROWSER; the stand is not touched to produce it.
            //
            // It hangs rather than fails, and an earlier draft got that wrong:
            // `route.abort()` rejects the fetch INSTANTLY, so the race was lost
            // to the error and never reached the timeout at all — the page
            // settled in 2.2s on "Weather: Cached" and the 15 seconds this
            // change is about were not exercised. That measured the probe, not
            // the product. A request that never answers is what a slow network
            // looks like, and it is the only shape that puts the timeout in the
            // path.
            const hang = (route) => { blockedHits += 1; /* never fulfilled */ };
            await context.route('**://api.open-meteo.com/**', hang);
            await context.route('**://archive-api.open-meteo.com/**', hang);

            const p2 = await context.newPage();
            await p2.goto(BASE_URL + '/reports/export', { waitUntil: 'domcontentloaded' });
            blocked = await WATCH(p2, 45000);
            process.stdout.write('[gh545] provider blocked: ' + JSON.stringify(blocked)
                + '  (requests aborted: ' + blockedHits + ')\n');
            await p2.close();

            process.stdout.write('[gh545] VERDICT: settles with weather in ' + normal.ms
                + 'ms; without it in ' + blocked.ms + 'ms, badge "' + blocked.badge + '"\n');
        }, 300000);

        afterAll(async () => {
            if (browser) await browser.close();
            if (guard) process.stdout.write('[gh545] ' + guard.report() + '\n');
        }, 60000);

        test('the constant and the message it prints cannot drift apart', () => {
            const src = fs.readFileSync(path.join(__dirname, '..', '..', 'assets', 'weather-resilience.js'), 'utf8');
            const code = src.replace(/\/\/[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '');
            expect(code).toContain('var LIVE_FETCH_TIMEOUT_MS = 15000;');
            // The number in the error text is derived, not typed. The client's
            // own diagnosis today came out of that string.
            expect(code).toContain("'Weather fetch timeout after ' + (LIVE_FETCH_TIMEOUT_MS / 1000) + 's'");
            expect(code).not.toContain('after 5s');
            expect(code).not.toContain('12s');
        });

        test('an ordinary load still settles, and not on Loading', () => {
            expect(normal.settled).toBe(true);
            expect(normal.badge).not.toMatch(/Loading/i);
        });

        test('with the provider hanging the page STILL falls back', () => {
            // The thing a longer timeout could have broken: a page that waits
            // for ever is worse than one that gives up early.
            expect(blocked.settled).toBe(true);
            expect(blocked.badge).not.toMatch(/Loading/i);
            expect(blockedHits).toBeGreaterThan(0);
        });

        test('and the wait is the new fifteen seconds, not the old five', () => {
            // The measured cost. Under 10s would mean the new value never
            // reached the page.
            process.stdout.write('[gh545] user waited ' + blocked.ms + 'ms on "'
                + blocked.first + '" before the fallback\n');
            expect(blocked.ms).toBeGreaterThan(10000);
            // And not for ever: the fallback is what ends the wait.
            expect(blocked.ms).toBeLessThan(25000);
        });
    });
}
