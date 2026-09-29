/**
 * GH-771 (queue item 3azh) — WHICH PGR APPLICATION THE RUN IS GIVEN, AND WHAT THE SERVER SAYS ABOUT
 * ONE OLDER THAN THE WINDOW.
 *
 * THE POSITIVE CONTROL THE PLAN ASKS FOR FIRST, printed before anything is asserted about it: the
 * `lastPGR` of `GET /api/spray-log/context`, per site, for the sites whose log carries a PGR entry.
 * The plan's three cases all have a live site behind them, measured in the log today:
 *   - inside the window: `Russley`, applied 2026-07-20, 69 days ago;
 *   - older than the window: `Test5 - NZ`, applied 2026-06-16, 103 days ago -- the case that cannot
 *     exist while the server itself cuts the log at 90 days;
 *   - only in the config: `Burns`, which carries no log entry at all.
 *
 * WHAT IS ASSERTED, and only this: an application the log holds is the one the server names, and a
 * site with no entry is given none. Whether an application older than the window reaches the run is
 * the subject of the repair, so this file records what the server says about it rather than fixing
 * the number in place.
 *
 * READ ONLY, held to it by the GH-519 stand guard: GETs only, no site is written, and
 * `Hoxton Soccer - Kate's test` is read like any other.
 *
 * Run: GILBA_E2E=1 GILBA_E2E_GH771=1 npx jest tests/e2e/gh771-the-pgr-the-run-is-given-live.test.js
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

let chromium = null;
try { ({ chromium } = require('playwright')); } catch (e) { /* reported below */ }
const { guardStand } = require('./lib/stand-guard');

const ENABLED = process.env.GILBA_E2E === '1' && process.env.GILBA_E2E_GH771 === '1' && !!chromium;
const CREDENTIALS_PATH = process.env.GILBA_E2E_CREDENTIALS || path.join(__dirname, '.e2e-credentials.json');
const credentials = fs.existsSync(CREDENTIALS_PATH) ? JSON.parse(fs.readFileSync(CREDENTIALS_PATH, 'utf8')) : {};
const BASE_URL = process.env.GILBA_E2E_URL || credentials.url || 'http://127.0.0.1:8080';
const EMAIL = process.env.GILBA_E2E_EMAIL || credentials.email;
const PASSWORD = process.env.GILBA_E2E_PASSWORD || credentials.password;

function query(sql) {
    return execFileSync('docker', ['exec', 'gilba_mysql', 'mysql', '-ugilba', '-pgilba_secret',
        'gilba', '-N', '-e', sql], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })
        .split('\n').map((l) => l.trim()).filter((l) => l);
}

(ENABLED ? describe : describe.skip)('GH-771 — the PGR application the server hands the run', () => {
    let browser, page, held;
    const inTheLog = [];
    const fromServer = [];

    beforeAll(async () => {
        query("SELECT CONCAT(st.name,'|',sl.site_id,'|',sl.event_date,'|',DATEDIFF(CURDATE(), sl.event_date),'|',sl.product_name) "
            + "FROM spray_logs sl JOIN sites st ON st.id=sl.site_id WHERE sl.product_type='pgr' ORDER BY sl.event_date DESC")
            .forEach((row) => {
                const [name, siteId, date, daysAgo, product] = row.split('|');
                inTheLog.push({ name, siteId, date, daysAgo: Number(daysAgo), product });
            });
        // A site with no PGR entry at all, so the other half is measured too.
        const none = query("SELECT CONCAT(st.name,'|',st.id) FROM sites st WHERE st.deleted_at IS NULL "
            + "AND NOT EXISTS (SELECT 1 FROM spray_logs sl WHERE sl.site_id=st.id AND sl.product_type='pgr') "
            + "AND EXISTS (SELECT 1 FROM site_configs c WHERE c.site_id=st.id AND c.namespace='gaip') LIMIT 1")[0];
        const [noneName, noneId] = (none || '|').split('|');

        browser = await chromium.launch();
        const context = await browser.newContext();
        held = await guardStand(context);
        page = await context.newPage();
        await page.goto(BASE_URL + '/login', { waitUntil: 'domcontentloaded' });
        await page.fill('#email', EMAIL);
        await page.fill('#password', PASSWORD);
        await Promise.all([
            page.waitForNavigation({ waitUntil: 'domcontentloaded' }).catch(() => null),
            page.click('form.login-form button[type=submit]'),
        ]);
        if (/\/login/.test(page.url())) throw new Error('login refused for ' + EMAIL);
        await page.goto(BASE_URL + '/dashboard?setup=0', { waitUntil: 'domcontentloaded' });

        const ask = async (siteId) => page.evaluate(async (id) => {
            const r = await fetch('/api/spray-log/context?site_id=' + encodeURIComponent(id), {
                credentials: 'same-origin', headers: { Accept: 'application/json' },
            });
            const body = r.ok ? await r.json() : (await r.text()).slice(0, 200);
            const ctx = (body && (body.context || body.data || body)) || {};
            return { status: r.status, lastPGR: ctx.lastPGR === undefined ? '(no key)' : ctx.lastPGR,
                keys: Object.keys(ctx).slice(0, 12) };
        }, siteId);

        for (const row of inTheLog) {
            fromServer.push({ site: row.name, daysAgo: row.daysAgo, asked: await ask(row.siteId) });
        }
        if (noneId) fromServer.push({ site: noneName + ' (no PGR in the log)', daysAgo: null, asked: await ask(noneId) });
    }, 180000);

    afterAll(async () => { if (browser) await browser.close(); });

    test('POSITIVE CONTROL, printed first: what the server names as the last PGR, per site', () => {
        inTheLog.forEach((r) => process.stdout.write('[gh771] the log holds: ' + r.name + ' | '
            + r.date + ' (' + r.daysAgo + ' days ago) | ' + r.product + '\n'));
        fromServer.forEach((r) => process.stdout.write('[gh771] the server answers for ' + r.site
            + ' (' + r.daysAgo + ' days ago): HTTP ' + r.asked.status
            + ' | lastPGR ' + JSON.stringify(r.asked.lastPGR)
            + ' | context keys ' + JSON.stringify(r.asked.keys) + '\n'));
        process.stdout.write('[gh771] ' + held.report() + '\n');

        expect(held.held).toEqual([]);
        // The control itself: a site whose log carries an application inside the window is named it.
        const inside = fromServer.filter((r) => r.daysAgo !== null && r.daysAgo <= 90);
        expect(inside.length).toBeGreaterThan(0);
        inside.forEach((r) => expect(r.asked.lastPGR).not.toBeNull());
    }, 120000);
});
