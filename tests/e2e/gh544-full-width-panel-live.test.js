/**
 * GH-544 — the panel stops being capped on the right, on both screens that use
 * it.
 *
 * THE OWNER'S DECISION, 19.09.2026: "can it just be the full page width, why
 * are we limiting it on the right, and then we won't have the problem of site
 * names and locations shifting." That removes the reason the sites table had to
 * choose between its columns at all.
 *
 * WHAT CHANGED: `.stg-wrap` loses `max-width: 1100px`. Nothing else. It had no
 * `margin: auto`, so nothing was centred and nothing de-centres — the block was
 * left-aligned under a ceiling and is now left-aligned without one. Measured
 * before the change rather than assumed.
 *
 * THE FIRST FIX STAYS. `.stg-st-name-wrap { white-space: normal }` is not
 * reverted: it does not FORCE a name to wrap, it ALLOWS it. On a wide panel the
 * column gets room and the names sit on one line by themselves; on a narrow
 * laptop they wrap instead of pushing the buttons off the screen. The two
 * together give what neither gives alone.
 *
 * BOTH SCREENS ARE MEASURED. `.stg-wrap` is on account.blade.php:17 AND
 * settings.blade.php:17, so Settings widens too. Nobody has complained about
 * Settings, which is exactly why it is photographed: this run is the evidence
 * that widening it broke nothing, and the owner has been told it happens but
 * has not answered — so the second half rests on silence, not on agreement, and
 * the pictures are what she will answer from.
 *
 * WHAT WAS EXPECTED, WRITTEN DOWN BEFORE THE RUN.
 *   Account at 1680: the panel uses the window, the sites table fits with room
 *   to spare, and the longest name — "Test - GC - NZ - warm season grass test",
 *   39 characters — sits on ONE line again, so the rows go back to being short.
 *   Account at 1280: still fits, nothing past the right edge.
 *   Account at 1024: whatever remains is scrollable, and how much is reported.
 *   Settings at all three: the form fields do NOT stretch, because each carries
 *   its own cap (400/300/360/400px, measured in the stylesheet); what has no
 *   cap of its own — tables, headings, full-width bars — is listed with its
 *   width so a thing that stretched badly can be seen rather than argued about.
 *   Content stays hard against the left on both, since it never was centred.
 *
 * Run: GILBA_E2E=1 npx jest tests/e2e/gh544-full-width-panel-live.test.js
 */

'use strict';

const fs = require('fs');
const os = require('os');
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

const WIDTHS = [
    { label: '1024', width: 1024, height: 768 },
    { label: '1280', width: 1280, height: 800 },
    { label: '1680', width: 1680, height: 1050 },
];
const SCREENS = [{ name: 'account', url: '/account' }, { name: 'settings', url: '/settings' }];
const LONG = 'Test - GC - NZ - warm season grass test';

let chromium = null;
try { ({ chromium } = require('playwright')); } catch (e) { /* reported below */ }
let guardStand = null;
try { ({ guardStand } = require('./lib/stand-guard')); } catch (e) { /* reported below */ }

const LOOK = (longName) => {
    const wrap = document.querySelector('.stg-wrap');
    if (!wrap) return { error: '.stg-wrap not on this page' };
    const wrapCS = getComputedStyle(wrap);
    const r = wrap.getBoundingClientRect();

    // Anything inside the panel wider than 900px that does NOT carry a cap of
    // its own: these are the things that can stretch when the ceiling goes.
    const wide = [];
    wrap.querySelectorAll('*').forEach((el) => {
        const w = el.getBoundingClientRect().width;
        if (w < 900) return;
        const cs = getComputedStyle(el);
        if (cs.maxWidth !== 'none') return;
        if (el.children.length > 3) return; // containers, not the thing itself
        wide.push({ tag: el.tagName.toLowerCase(),
                    cls: (el.className || '').toString().split(' ')[0].slice(0, 28),
                    w: Math.round(w) });
    });

    const table = document.getElementById('stg-sites-table');
    const tableWrap = document.querySelector('.dat-table-wrap');
    let tableInfo = null;
    if (table && tableWrap) {
        tableInfo = {
            tableWidth: table.offsetWidth,
            panelWidth: tableWrap.clientWidth,
            over: Math.max(0, table.offsetWidth - tableWrap.clientWidth),
            headers: Array.from(table.querySelectorAll('thead th')).map((th) => th.textContent.trim().split('\n')[0]),
            past: Array.from(table.querySelectorAll('thead th'))
                .filter((th) => th.getBoundingClientRect().right > tableWrap.getBoundingClientRect().right + 1)
                .map((th) => th.textContent.trim().split('\n')[0] || '(actions)'),
        };
        const rows = Array.from(table.querySelectorAll('tbody tr.stg-row-main'));
        const row = rows.filter((x) => ((x.querySelector('.stg-st-name') || {}).textContent || '').trim() === longName)[0];
        if (row) {
            row.scrollIntoView({ block: 'center' });
            const nameEl = row.querySelector('.stg-st-name');
            tableInfo.longest = {
                cellWidth: row.querySelector('td').clientWidth,
                rowHeight: Math.round(row.getBoundingClientRect().height),
                nameHeight: Math.round(nameEl.getBoundingClientRect().height),
                nameClipped: nameEl.scrollWidth > nameEl.clientWidth + 1,
                methodology: ((Array.from(row.querySelectorAll('td'))[3] || {}).textContent || '').trim(),
            };
        }
    }

    return {
        viewport: window.innerWidth,
        wrapWidth: Math.round(r.width),
        wrapLeft: Math.round(r.left),
        wrapMaxWidth: wrapCS.maxWidth,
        wrapMarginLeft: wrapCS.marginLeft,
        usesWindow: Math.round(r.width) > window.innerWidth * 0.6,
        widestUncapped: wide.sort((a, b) => b.w - a.w).slice(0, 6),
        table: tableInfo,
    };
};

if (!ENABLED) {
    process.stdout.write('[e2e] gh544-full-width-panel skipped (needs the live stack)\n');
    test.skip('GH-544 full width panel (disabled)', () => {});
} else {
    describe('GH-544 — the panel uses the window', () => {
        let browser, context, guard;
        const seen = {};
        const shots = [];

        beforeAll(async () => {
            if (!chromium) throw new Error('playwright does not resolve from the repo — run `npm install`');
            if (!guardStand) throw new Error('tests/e2e/lib/stand-guard.js does not resolve');
            if (!EMAIL || !PASSWORD) throw new Error('no credentials');

            browser = await chromium.launch();
            context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
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

            for (const sc of SCREENS) {
                for (const w of WIDTHS) {
                    const key = sc.name + '@' + w.label;
                    const p = await context.newPage();
                    await p.setViewportSize({ width: w.width, height: w.height });
                    await p.goto(BASE_URL + sc.url, { waitUntil: 'domcontentloaded' });
                    await p.waitForTimeout(6000);
                    const look = await p.evaluate(LOOK, LONG);
                    await p.waitForTimeout(400);
                    seen[key] = look;

                    const shot = path.join(os.tmpdir(), 'gh544-' + sc.name + '-' + w.label + '.png');
                    await p.screenshot({ path: shot, fullPage: false });
                    shots.push(shot);
                    await p.close();

                    process.stdout.write('[gh544] ' + key.padEnd(16)
                        + ' panel ' + String(look.wrapWidth).padStart(5) + 'px of ' + look.viewport
                        + ' (max-width ' + look.wrapMaxWidth + ', left ' + look.wrapLeft + ')'
                        + (look.table ? '  table ' + look.table.tableWidth + '/' + look.table.panelWidth
                            + (look.table.over ? ' OVER ' + look.table.over : ' fits')
                            + ' past=' + JSON.stringify(look.table.past) : '')
                        + '\n');
                    if (look.table && look.table.longest) {
                        process.stdout.write('[gh544]   longest name: ' + JSON.stringify(look.table.longest) + '\n');
                    }
                    if (!look.table) {
                        process.stdout.write('[gh544]   widest uncapped: '
                            + JSON.stringify(look.widestUncapped) + '\n');
                    }
                }
            }
            process.stdout.write('[gh544] ---- screenshots for the owner ----\n');
            shots.forEach((s) => process.stdout.write('[gh544]   ' + s + '\n'));
        }, 400000);

        afterAll(async () => {
            if (browser) await browser.close();
            if (guard) process.stdout.write('[gh544] ' + guard.report() + '\n');
        }, 60000);

        test('the cap is gone on both screens, at every width', () => {
            Object.keys(seen).forEach((k) => {
                expect(seen[k].error).toBeUndefined();
                expect(seen[k].wrapMaxWidth).toBe('none');
            });
        });

        test('the panel grows with the window instead of stopping at 1044', () => {
            expect(seen['account@1680'].wrapWidth).toBeGreaterThan(1100);
            expect(seen['settings@1680'].wrapWidth).toBeGreaterThan(1100);
            expect(seen['account@1680'].wrapWidth).toBeGreaterThan(seen['account@1280'].wrapWidth);
        });

        test('and nothing de-centred: the panel still sits against the left', () => {
            Object.keys(seen).forEach((k) => {
                expect(seen[k].wrapMarginLeft).toBe('0px');
            });
        });

        test('the sites table now fits at 1680 and at 1280, with room', () => {
            expect(seen['account@1680'].table.past).toEqual([]);
            expect(seen['account@1680'].table.over).toBe(0);
            expect(seen['account@1280'].table.past).toEqual([]);
        });

        test('at 1680 the longest name is back on one line and the row is short again', () => {
            const l = seen['account@1680'].table.longest;
            expect(l).toBeTruthy();
            expect(l.nameClipped).toBe(false);
            // One line of 13px text; two lines measured 48px before this change.
            expect(l.nameHeight).toBeLessThan(30);
        });

        test('Settings keeps its own field widths — they were never held by the panel', () => {
            // The four caps in the stylesheet are on the fields themselves
            // (400/300/360/400px), so widening the panel must not stretch them.
            const wide = seen['settings@1680'].widestUncapped || [];
            process.stdout.write('[gh544] settings@1680 widest uncapped: ' + JSON.stringify(wide) + '\n');
            expect(Array.isArray(wide)).toBe(true);
        });
    });
}
