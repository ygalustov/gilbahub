/**
 * GH-789 (queue item 7) — A SCHEDULE OF NO LOAD IS ENTERED THROUGH THE PRODUCT'S OWN ROUTE.
 *
 * WHY THIS EXISTS AND WHY IT IS A LIVE FILE. The list declares `traffic.schedule` required for a sports
 * surface, and the setup wizard is about to ask for it — so the lock (`EnsureSiteIsSetUp`) will hold every page
 * of the group for a sports site that has none: Settings, Data, `/plan`, the reports, and the run frame `/hub`,
 * which means neither a Re-run nor an export. Six sports sites of the stand have no schedule at all.
 *
 * THE OWNER'S CONDITION, 30.09.2026: those six get nought matches and nought sessions, and they get it BY THE
 * PRODUCT'S ROUTE rather than by a write to the database — "so that I have definitely not touched anything".
 * The route is the one Settings itself uses: `PATCH /api/sites/{id}/config/gaip` with `{patch: {...}}`, sent
 * from a page of a signed-in session with its CSRF token, exactly as `apiFetch` sends it.
 *
 * WHY NOT THE SETTINGS FORM, which would also accept a zero: it sends the WHOLE schedule, and five of its
 * selects travel with whatever they show by default — `sport: soccer`, `ageGroup: adult`, `squadSize: medium`,
 * `trainingType: skills`, `moisture: optimal`. Six sites would receive five values nobody chose, and one of
 * them is the storage of another input of the list (`soil.moisture`), which would then read as entered.
 *
 * WHAT IT REFUSES TO DO. It takes its sites from the window that opened it and touches no other. It stops on
 * the FIRST site if the route refuses OR if the route accepts and the zero is not in the config afterwards —
 * an accepted request that stored nothing is the same as a refusal, only quiet. And it reads the last row id of
 * every site before and after, so a site outside the window that moved is visible.
 *
 * Run: GILBA_E2E=1 GILBA_E2E_GH789=1 GILBA_E2E_GH789_SITES='<name>;<name>;…' \
 *      npx jest tests/e2e/gh789-the-zero-schedule-goes-in-by-the-product-live.test.js --runInBand --testTimeout=600000
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

let chromium = null;
try { ({ chromium } = require('playwright')); } catch (e) { /* reported below */ }

const ENABLED = process.env.GILBA_E2E === '1' && process.env.GILBA_E2E_GH789 === '1' && !!chromium;
const CREDENTIALS_PATH = process.env.GILBA_E2E_CREDENTIALS || path.join(__dirname, '.e2e-credentials.json');
const credentials = fs.existsSync(CREDENTIALS_PATH) ? JSON.parse(fs.readFileSync(CREDENTIALS_PATH, 'utf8')) : {};
const BASE_URL = process.env.GILBA_E2E_URL || credentials.url || 'http://127.0.0.1:8080';
const EMAIL = process.env.GILBA_E2E_EMAIL || credentials.email;
const PASSWORD = process.env.GILBA_E2E_PASSWORD || credentials.password;
const SITES = String(process.env.GILBA_E2E_GH789_SITES || '').split(';')
    .map((n) => n.trim()).filter((n) => n);

function query(sql) {
    return execFileSync('docker', ['exec', 'gilba_mysql', 'mysql', '-ugilba', '-pgilba_secret',
        'gilba', '-N', '--raw', '-e', sql], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })
        .split('\n').map((l) => l.trim()).filter((l) => l);
}

/** The schedule each named site holds, and its id — read, never written, from here. */
function scheduleOf(name) {
    const rows = query("SELECT CONCAT_WS('\\t', s.id, COALESCE(JSON_EXTRACT(c.config,'$.traffic.schedule'),'(none)'), "
        + "COALESCE(JSON_UNQUOTE(JSON_EXTRACT(c.config,'$.turf.turfType')),'(none)')) "
        + 'FROM sites s LEFT JOIN site_configs c ON c.site_id = s.id AND c.namespace = \'gaip\' '
        + "WHERE s.name = '" + name.replace(/'/g, "''") + "'");
    const cut = (rows[0] || '').split('\t');

    return { id: cut[0] || null, schedule: cut[1] || '(none)', turfType: cut[2] || '(none)' };
}

/** Every site's last row id, so a site outside the window is seen if it moves. */
function standNow() {
    const out = {};
    query("SELECT CONCAT_WS('\\t', s.name, COALESCE(MAX(ar.id), 0)) FROM sites s "
        + 'LEFT JOIN analysis_results ar ON ar.site_id = s.id GROUP BY s.id, s.name').forEach((line) => {
        const cut = line.split('\t');
        out[cut[0]] = cut[1];
    });

    return out;
}

(ENABLED ? describe : describe.skip)('GH-789 — nought matches and nought sessions, by the product\'s route', () => {
    if (!ENABLED) {
        process.stdout.write('[e2e] gh789 skipped (writes a config through the product — announce first, then'
            + ' GILBA_E2E=1 GILBA_E2E_GH789=1 GILBA_E2E_GH789_SITES=…)\n');
    }

    const say = (s) => process.stdout.write('[gh789] ' + s + '\n');

    test('the six named sites receive {matchesPerWeek: 0, sessionsPerWeek: 0} and nothing else moves', async () => {
        expect(SITES.length).toBeGreaterThan(0);
        expect(EMAIL && PASSWORD).toBeTruthy();

        const before = {};
        SITES.forEach((name) => { before[name] = scheduleOf(name); });
        const standBefore = standNow();
        say('BEFORE:');
        SITES.forEach((name) => say('  ' + name + ': turfType ' + before[name].turfType
            + ' | traffic.schedule ' + before[name].schedule));

        // A site that already holds something is NOT overwritten silently: the window said so.
        const alreadyHolding = SITES.filter((n) => before[n].schedule !== '(none)' && before[n].schedule !== 'null');
        say('already holding a schedule (' + alreadyHolding.length + '): ' + JSON.stringify(alreadyHolding));
        expect({ sitesThatAlreadyHoldASchedule: alreadyHolding }).toEqual({ sitesThatAlreadyHoldASchedule: [] });

        const missingId = SITES.filter((n) => !before[n].id);
        expect({ namesTheStandDoesNotHave: missingId }).toEqual({ namesTheStandDoesNotHave: [] });

        const browser = await chromium.launch({ headless: true });
        const page = await (await browser.newContext()).newPage();
        await page.goto(BASE_URL + '/login', { waitUntil: 'domcontentloaded' });
        await page.fill('#email', EMAIL);
        await page.fill('#password', PASSWORD);
        await Promise.all([
            page.waitForNavigation({ waitUntil: 'domcontentloaded' }).catch(() => {}),
            page.click('form.login-form button[type=submit]'),
        ]);
        await page.waitForTimeout(1500);
        if (/\/login/.test(page.url())) throw new Error('login refused for ' + EMAIL);
        await page.goto(BASE_URL + '/dashboard?setup=0', { waitUntil: 'domcontentloaded' });
        await page.waitForTimeout(2500);
        say('signed in as ' + EMAIL);

        const results = [];
        for (const name of SITES) {
            const siteId = before[name].id;
            /**
             * The product's own request, from the page: same route, same headers, same body shape as
             * `apiFetch` in `settings-init.js`. The patch carries TWO KEYS and nothing else.
             */
            const answer = await page.evaluate(async (args) => {
                const hub = window.GAIP_HUB_CONFIG || {};
                const base = String(hub.restUrl || '/api').replace(/\/?$/, '');
                const csrf = hub.csrfToken || hub.nonce
                    || (document.querySelector('meta[name=csrf-token]') || {}).content || '';
                try {
                    const r = await fetch(base + '/sites/' + encodeURIComponent(args.id) + '/config/gaip', {
                        method: 'PATCH',
                        headers: {
                            'Content-Type': 'application/json',
                            Accept: 'application/json',
                            'X-CSRF-TOKEN': csrf,
                        },
                        body: JSON.stringify({ patch: { traffic: { schedule: {
                            matchesPerWeek: 0, sessionsPerWeek: 0,
                        } } } }),
                    });
                    const text = await r.text();

                    return { status: r.status, body: text.slice(0, 400) };
                } catch (e) {
                    return { status: 0, body: 'fetch threw: ' + String(e && e.message) };
                }
            }, { id: siteId });

            const after = scheduleOf(name);
            const stored = (function () {
                try { return JSON.parse(after.schedule); } catch (e) { return null; }
            })();
            const zeroIsThere = !!stored && stored.matchesPerWeek === 0 && stored.sessionsPerWeek === 0;
            const extraKeys = stored ? Object.keys(stored).filter((k) =>
                k !== 'matchesPerWeek' && k !== 'sessionsPerWeek') : [];
            results.push({ name, status: answer.status, after: after.schedule, zeroIsThere, extraKeys });
            say(name + ': HTTP ' + answer.status + ' | now ' + after.schedule
                + ' | the nought is stored: ' + zeroIsThere
                + (extraKeys.length ? ' | other keys: ' + JSON.stringify(extraKeys) : ''));
            if (answer.status !== 200) say('  the route answered: ' + answer.body);

            /**
             * STOP ON THE FIRST SITE, for either kind of failure — a refusal, or an acceptance that stored
             * nothing. The second is the same as the first, only quiet, which is why it is checked here and not
             * at the end.
             */
            if (answer.status !== 200 || !zeroIsThere) {
                await browser.close();
                throw new Error('stopped at the first site: ' + name + ' — HTTP ' + answer.status
                    + ', config now ' + after.schedule + '. The route\'s answer: ' + answer.body);
            }
        }
        await browser.close();

        const standAfter = standNow();
        const moved = Object.keys(standBefore)
            .filter((n) => String(standBefore[n]) !== String(standAfter[n]))
            .map((n) => n + ': ' + standBefore[n] + ' -> ' + standAfter[n]);
        say('rows that moved anywhere on the stand: ' + JSON.stringify(moved));

        // Every named site holds exactly the two keys, and nothing else on the stand produced a row.
        expect(results.every((r) => r.zeroIsThere)).toBe(true);
        expect(results.filter((r) => r.extraKeys.length).map((r) => r.name + ' ' + r.extraKeys.join(','))).toEqual([]);
        expect({ rowsThatMoved: moved }).toEqual({ rowsThatMoved: [] });
    });
});
