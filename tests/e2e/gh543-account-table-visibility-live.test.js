/**
 * GH-543 — the Account site list after the methodology column: what is actually
 * on the rendered page, at the owner's likely width as well as a wide one.
 *
 * THE REPORT, in the owner's words: "now not all the information is shown, it
 * is as if it hid under the panel." The column stays — her decision, asked
 * directly: "no, fix it now. We need this column."
 *
 * WHY THIS IS MEASURED IN A BROWSER AND NOT READ. The markup did not change
 * except by one `<th>`; the wrapper and the table's own widths are exactly what
 * they were when eight columns fitted. Whatever went wrong is a property of the
 * LAID-OUT page, and the source cannot answer it. The coordinator stopped at
 * the markup and said so.
 *
 * WHAT READING DID ESTABLISH, so the run measures the right things:
 *   `.dat-table-wrap` is `overflow-x: auto` — a scroller is already there.
 *   `.dat-table` is `width: 100%; min-width: 580px`, and the Account page
 *   overrides that inline with `min-width: 0`. Together those keep the table at
 *   the container's width no matter how many columns it has, so the scroller
 *   never has anything to scroll and the columns compress instead.
 *   `thead th` is `white-space: nowrap`; the body cells are not.
 *
 * WHAT WAS EXPECTED, WRITTEN DOWN BEFORE ANYTHING WAS LOOKED AT.
 *   The complaint should show up as ONE of three pictures, and they need
 *   different fixes, so the run names which:
 *     (1) the table is wider than the wrapper and the wrapper does not scroll —
 *         columns on the right are unreachable;
 *     (2) the table is held at the wrapper's width and the CELLS are clipped or
 *         wrapped to nothing — the text is squeezed, not off-screen;
 *     (3) neither — the table fits and something else is wrong.
 *   After the fix, at BOTH widths: all nine headers present, the Methodology
 *   value readable in full on every row, and the last column's buttons
 *   ("Set active" / "Invite") reachable — by scrolling if need be, but reachable.
 *
 * WHAT THE FIX WAS AND WHAT IS EXPECTED OF IT, WRITTEN BEFORE THE SECOND RUN.
 *   The first run found picture (1): the table is 1213px inside a panel of 1044
 *   that does not grow with the window, and the Site column alone takes 360px
 *   because `.stg-st-name-wrap` forbade wrapping and one site is named
 *   "Test - GC - NZ - warm season grass test" — 39 characters, the longest on
 *   the stand. The fix lets that name wrap. `.stg-wrap`'s 1100px cap is NOT
 *   touched: it is shared with the Settings page, which nobody has complained
 *   about, and widening it would change two screens to repair one.
 *
 *   EXPECTED, in words:
 *     - at 1280 the whole table sits inside the panel: nothing past the right
 *       edge, so the Users column and the row buttons are simply there;
 *     - the Site column is materially narrower than 360px, and the long name is
 *       shown IN FULL across two lines rather than truncated — a wrapped name
 *       is the point, a cut one would be a different defect;
 *     - the type badge sits beside the name or drops under it, not squeezed;
 *     - at 1024 the panel is 908 and some overflow may remain. That is an
 *       expected outcome, not a failure: the wrapper already scrolls. The run
 *       reports how many pixels remain rather than chasing zero;
 *     - the Methodology column still reads its own value per row.
 *
 * The page only reads; `guardStand` holds anything that tries otherwise.
 *
 * Run: GILBA_E2E=1 npx jest tests/e2e/gh543-account-table-visibility-live.test.js
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

/** A laptop the owner might have, and a wide desktop. */
const WIDTHS = [
    { label: 'laptop 1280x800', width: 1280, height: 800 },
    { label: 'narrow 1024x768', width: 1024, height: 768 },
    { label: 'wide 1680x1050', width: 1680, height: 1050 },
];

let chromium = null;
try { ({ chromium } = require('playwright')); } catch (e) { /* reported below */ }
let guardStand = null;
try { ({ guardStand } = require('./lib/stand-guard')); } catch (e) { /* reported below */ }

/** Everything about the laid-out table that could produce the complaint. */
const LOOK = () => {
    const wrap = document.querySelector('.dat-table-wrap');
    const table = document.getElementById('stg-sites-table');
    if (!wrap || !table) return { error: 'table or wrapper not on the page' };

    const wrapCS = getComputedStyle(wrap);
    const tableCS = getComputedStyle(table);
    const heads = Array.from(table.querySelectorAll('thead th'));
    const firstRow = table.querySelector('tbody tr.stg-row-main');
    const cells = firstRow ? Array.from(firstRow.querySelectorAll('td')) : [];

    const wrapRect = wrap.getBoundingClientRect();

    return {
        headerCount: heads.length,
        headers: heads.map((th) => th.textContent.trim().split('\n')[0]),
        wrapClientWidth: wrap.clientWidth,
        wrapScrollWidth: wrap.scrollWidth,
        wrapOverflowX: wrapCS.overflowX,
        wrapScrolls: wrap.scrollWidth > wrap.clientWidth,
        tableOffsetWidth: table.offsetWidth,
        tableMinWidth: tableCS.minWidth,
        tableWidth: tableCS.width,
        tableLayout: tableCS.tableLayout,
        // A column whose right edge is past the wrapper's is not on screen.
        headerRight: heads.map((th) => Math.round(th.getBoundingClientRect().right)),
        wrapRight: Math.round(wrapRect.right),
        columnsPastTheEdge: heads
            .map((th, i) => ({ i: i, name: th.textContent.trim().split('\n')[0],
                               right: Math.round(th.getBoundingClientRect().right) }))
            .filter((c) => c.right > Math.round(wrapRect.right) + 1)
            .map((c) => c.name || '(actions)'),
        // A cell whose content is wider than the cell is squeezed.
        cellWidths: cells.map((td, i) => ({
            col: (heads[i] ? heads[i].textContent.trim().split('\n')[0] : 'col' + i),
            client: td.clientWidth,
            scroll: td.scrollWidth,
            clipped: td.scrollWidth > td.clientWidth + 1,
            lines: Math.round(td.getBoundingClientRect().height / 18),
            text: (td.textContent || '').trim().slice(0, 28),
        })),
        rowHeight: firstRow ? Math.round(firstRow.getBoundingClientRect().height) : null,
    };
};

if (!ENABLED) {
    process.stdout.write('[e2e] gh543-account-table-visibility skipped (needs the live stack)\n');
    test.skip('GH-543 account table visibility (disabled)', () => {});
} else {
    describe('GH-543 — the Account table, as it is drawn', () => {
        let browser, context, guard;
        const seen = {};

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

            for (const w of WIDTHS) {
                const p = await context.newPage();
                await p.setViewportSize({ width: w.width, height: w.height });
                await p.goto(BASE_URL + '/account', { waitUntil: 'domcontentloaded' });
                await p.waitForTimeout(6000);
                const look = await p.evaluate(LOOK);
                seen[w.label] = look;

                process.stdout.write('[gh543] ' + w.label + '\n');
                if (look.error) { process.stdout.write('[gh543]   ' + look.error + '\n'); await p.close(); continue; }
                process.stdout.write('[gh543]   headers ' + look.headerCount + ': ' + JSON.stringify(look.headers) + '\n');
                process.stdout.write('[gh543]   wrap client/scroll: ' + look.wrapClientWidth + '/' + look.wrapScrollWidth
                    + '  overflowX=' + look.wrapOverflowX + '  scrolls=' + look.wrapScrolls + '\n');
                process.stdout.write('[gh543]   table offsetWidth=' + look.tableOffsetWidth
                    + '  min-width=' + look.tableMinWidth + '  width=' + look.tableWidth + '\n');
                process.stdout.write('[gh543]   columns past the right edge: '
                    + JSON.stringify(look.columnsPastTheEdge) + '\n');
                process.stdout.write('[gh543]   row height ' + look.rowHeight + 'px; cells:\n');
                look.cellWidths.forEach((c) => process.stdout.write('[gh543]      ' + String(c.col).padEnd(12)
                    + ' w=' + String(c.client).padStart(4) + ' needs=' + String(c.scroll).padStart(4)
                    + (c.clipped ? ' CLIPPED' : '        ') + ' lines=' + c.lines + '  "' + c.text + '"\n'));

                // The worst case has to be ON the picture the owner is shown:
                // the longest site name, not whichever row happens to be first.
                const LONG = 'Test - GC - NZ - warm season grass test';
                const scrolled = await p.evaluate((name) => {
                    const rows = Array.from(document.querySelectorAll('#stg-sites-table tbody tr.stg-row-main'));
                    const row = rows.filter((r) => ((r.querySelector('.stg-st-name') || {}).textContent || '').trim() === name)[0];
                    if (!row) return { found: false };
                    row.scrollIntoView({ block: 'center' });
                    const cell = row.querySelector('td');
                    const nameEl = row.querySelector('.stg-st-name');
                    return {
                        found: true,
                        cellWidth: cell ? cell.clientWidth : null,
                        rowHeight: Math.round(row.getBoundingClientRect().height),
                        // Not `getClientRects().length`: an earlier draft used
                        // it as a line count and it answered 1 for a name that
                        // plainly spans two, so it was measuring the probe. The
                        // question is whether the whole name is SHOWN, which is
                        // scrollWidth against clientWidth, and whether the cell
                        // grew taller than one line of 13px text.
                        nameClipped: nameEl ? nameEl.scrollWidth > nameEl.clientWidth + 1 : null,
                        nameHeight: nameEl ? Math.round(nameEl.getBoundingClientRect().height) : null,
                        nameText: nameEl ? nameEl.textContent.trim() : null,
                        methodology: ((Array.from(row.querySelectorAll('td'))[3] || {}).textContent || '').trim(),
                    };
                }, LONG);
                await p.waitForTimeout(400);
                seen[w.label].longest = scrolled;
                process.stdout.write('[gh543]   longest-named row: ' + JSON.stringify(scrolled) + '\n');

                const shot = require('os').tmpdir() + '/gh543-after-' + w.width + '.png';
                await p.screenshot({ path: shot, fullPage: false });
                seen[w.label].screenshot = shot;
                await p.close();
            }
            process.stdout.write('[gh543] ---- screenshots for the owner ----\n');
            WIDTHS.forEach((w) => process.stdout.write('[gh543]   ' + w.label + ': ' + seen[w.label].screenshot + '\n'));
            WIDTHS.forEach((w) => {
                const s2 = seen[w.label];
                const over = Math.max(0, s2.tableOffsetWidth - s2.wrapClientWidth);
                process.stdout.write('[gh543] VERDICT ' + w.label + ': table ' + s2.tableOffsetWidth
                    + ' vs panel ' + s2.wrapClientWidth + ' -> ' + (over ? over + 'px still over' : 'FITS')
                    + '; off the right edge: ' + JSON.stringify(s2.columnsPastTheEdge) + '\n');
            });
        }, 300000);

        afterAll(async () => {
            if (browser) await browser.close();
            if (guard) process.stdout.write('[gh543] ' + guard.report() + '\n');
        }, 60000);

        test('the nine columns are all in the markup at every width', () => {
            WIDTHS.forEach((w) => {
                expect(seen[w.label].headerCount).toBe(9);
                expect(seen[w.label].headers).toContain('Methodology');
            });
        });

        test('at 1280 the whole table sits inside the panel', () => {
            const s2 = seen['laptop 1280x800'];
            expect(s2.columnsPastTheEdge).toEqual([]);
            expect(s2.tableOffsetWidth).toBeLessThanOrEqual(s2.wrapClientWidth);
        });

        test('the longest name is on the 1280 picture, wrapped and whole', () => {
            const l = seen['laptop 1280x800'].longest;
            expect(l.found).toBe(true);
            expect(l.nameText).toBe('Test - GC - NZ - warm season grass test');
            // Wrapped, not cut: the whole string is there and the Site column
            // gave back the width it was holding.
            expect(l.cellWidth).toBeLessThan(360);
            // Wrapped, not cut. 39 characters cannot sit on one line inside a
            // 124px cell, so the name occupying more than one line of text is
            // the wrap; nothing of it being hidden is the "whole".
            expect(l.nameClipped).toBe(false);
            expect(l.nameHeight).toBeGreaterThan(20);
            expect(l.methodology).toBeTruthy();
        });

        test('at 1024 whatever remains is reported, and the wrapper can scroll it', () => {
            const s2 = seen['narrow 1024x768'];
            const over = Math.max(0, s2.tableOffsetWidth - s2.wrapClientWidth);
            process.stdout.write('[gh543] 1024 overflow remaining: ' + over + 'px\n');
            expect(s2.wrapOverflowX).toBe('auto');
        });

        test('which of the three pictures it is, recorded', () => {
            // Named before the run; this prints the answer rather than
            // demanding one, because all three are findings.
            WIDTHS.forEach((w) => {
                const s = seen[w.label];
                const picture = s.wrapScrolls
                    ? (s.columnsPastTheEdge.length ? '1: wider than the wrapper, columns off the right' : '1a: scrolls, nothing off-screen yet')
                    : (s.cellWidths.some((c) => c.clipped) ? '2: held at width, cells clipped' : '3: fits');
                process.stdout.write('[gh543] ' + w.label + ' -> picture ' + picture + '\n');
            });
            expect(Object.keys(seen).length).toBe(WIDTHS.length);
        });
    });
}
