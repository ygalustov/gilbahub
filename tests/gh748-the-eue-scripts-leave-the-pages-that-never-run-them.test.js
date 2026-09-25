/**
 * GH-748 — THE EUE ENGINE, ITS BRIDGE AND THE OPERATIONAL SUMMARY LEAVE THE PAGES THAT NEVER RUN THEM.
 *
 * GH-739 measured the bridge not executed on `/hub`. Its two readers were then read: the
 * operational summary draws only into a container it inserts after `#gssh-venue-readiness`, an
 * element made by `stadium-tab-ui.js` and `venue-readiness-ui.js`, neither of which any of these four
 * pages loads; and the LED export's data comes from globals only the stadium page writes. So three
 * scripts are loaded on four pages and do nothing there, and a reader that always receives nothing is
 * a place where tomorrow somebody puts a plausible value in.
 *
 * TWO HALVES:
 *   - THE TEMPLATES: none of the four pages lists the engine, the bridge or the summary. The LED
 *     export (`gssh-led-export.js`) stays on `reports/export`, because it is the handler of the "LED
 *     Lighting Report" card there and that card waits for the owner.
 *   - THE BROWSER: each page's own scripts, in its template's order, loaded into a blank page with no
 *     login, no site and no press, every request answered locally. Printed per channel: calls into
 *     any `GSSH_EUE` method, the summary's container, the LED button, requests that are not GET,
 *     page errors. When a script is still on a page, a positive control plants the element it waits
 *     for and the channel must see it act — otherwise "never appears" could not be told from "the
 *     watch saw nothing". When it is gone, the page must still load without an error.
 */

'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const PAGES = ['hub', 'reports/export', 'reports/forensic', 'reports/scenarios'];
const GONE = ['environmental-utilisation-engine.js', 'eue-integration-bridge.js', 'gssh-operational-summary.js'];

let chromium = null;
let why = null;
try {
    chromium = require('playwright').chromium;
} catch (err) {
    why = 'playwright is not resolvable: ' + err.code;
}

function scriptsOf(page) {
    const src = fs.readFileSync(path.join(ROOT, 'app', 'resources', 'views', page + '.blade.php'), 'utf8');
    const at = src.indexOf('$hubScripts = [');
    expect(at).toBeGreaterThan(-1);
    const end = src.indexOf('];', at);
    return Array.from(src.slice(at, end).matchAll(/'([\w.-]+\.js)'/g)).map((m) => m[1]);
}

const WATCH = `
    (function () {
        var seen = window.__gh748 = { eueCalls: {}, errors: [] };
        var eue;
        Object.defineProperty(window, 'GSSH_EUE', {
            configurable: true,
            get: function () { return eue; },
            set: function (v) {
                if (v && typeof v === 'object') {
                    Object.keys(v).forEach(function (k) {
                        if (typeof v[k] !== 'function' || v[k].__gh748) return;
                        var orig = v[k];
                        v[k] = function () { seen.eueCalls[k] = (seen.eueCalls[k] || 0) + 1; return orig.apply(this, arguments); };
                        v[k].__gh748 = true;
                    });
                }
                eue = v;
            },
        });
        window.addEventListener('error', function (e) { seen.errors.push(String(e.message).slice(0, 120)); });
    })();
`;

async function measure(browser, page, scripts) {
    const tab = await browser.newPage();
    const requests = [];
    const consoleLines = [];
    tab.on('console', (m) => { const t = m.text(); if (/OperationalSummary|LEDExport|EUE/.test(t)) consoleLines.push(t.slice(0, 100)); });
    await tab.route('**/*', async (route) => {
        const url = new URL(route.request().url());
        if (url.pathname === '/blank') {
            const tags = scripts.map((s) => '<script src="/assets/' + s + '"></script>').join('\n');
            return route.fulfill({ status: 200, contentType: 'text/html', body: '<!doctype html><html><body>\n' + tags + '\n</body></html>' });
        }
        const asset = url.pathname.startsWith('/assets/') ? path.join(ROOT, 'assets', url.pathname.slice(8)) : null;
        if (asset && fs.existsSync(asset)) {
            return route.fulfill({ status: 200, contentType: 'application/javascript', body: fs.readFileSync(asset, 'utf8') });
        }
        requests.push(route.request().method() + ' ' + url.pathname);
        return route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
    });
    await tab.addInitScript(WATCH);
    await tab.goto('http://gh748.invalid/blank');
    await tab.waitForTimeout(6000);
    const onLoad = await tab.evaluate(() => ({
        eueCalls: Object.assign({}, window.__gh748.eueCalls),
        summaryContainer: !!document.getElementById('gssh-operational-summary'),
        ledButton: !!document.getElementById('gssh-led-export-btn'),
        summaryLoaded: typeof window.GSSH_OperationalSummary,
        ledLoaded: typeof window.GSSH_LEDExport,
        errors: window.__gh748.errors.slice(),
    }));
    // THE CONTROL: plant what each script waits for, and the same channels must see it act.
    await tab.evaluate(() => {
        var r = document.createElement('div'); r.id = 'gssh-venue-readiness'; document.body.appendChild(r);
        var card = document.createElement('div'); card.className = 'gssh-card';
        card.innerHTML = '<div class="gssh-card-header"></div><div id="gssh-rig-results"></div>';
        document.body.appendChild(card);
    });
    await tab.waitForTimeout(1500);
    const control = await tab.evaluate(() => ({
        summaryContainer: !!document.getElementById('gssh-operational-summary'),
        ledButton: !!document.getElementById('gssh-led-export-btn'),
    }));
    await tab.close();
    return { onLoad, control, requests, consoleLines, writes: requests.filter((r) => !r.startsWith('GET ')) };
}

describe('GH-748 — the EUE scripts are not on the pages that never run them', () => {
    test('THE TEMPLATES: none of the four pages lists the engine, the bridge or the summary', () => {
        const still = [];
        PAGES.forEach((p) => {
            const s = scriptsOf(p);
            process.stdout.write('[gh748] ' + p + ': ' + s.length + ' scripts; of the three: '
                + JSON.stringify(GONE.filter((g) => s.includes(g))) + '; LED export: ' + s.includes('gssh-led-export.js') + '\n');
            GONE.filter((g) => s.includes(g)).forEach((g) => still.push(p + ' | ' + g));
        });
        expect(still).toEqual([]);
    });

    test('THE BROWSER: on each page nothing of it acts on load, and where it is loaded the watch is shown not blind', async () => {
        if (!chromium) {
            process.stdout.write('[gh748] SKIPPED, and this is not a green: ' + why + '\n');
            expect(why).toBeTruthy();
            return;
        }
        const browser = await chromium.launch();
        try {
            for (const p of PAGES) {
                const r = await measure(browser, p, scriptsOf(p));
                process.stdout.write('[gh748] ' + p + ' — on load: ' + JSON.stringify(r.onLoad) + '\n');
                process.stdout.write('[gh748] ' + p + ' — control, anchors planted: ' + JSON.stringify(r.control) + '\n');
                process.stdout.write('[gh748] ' + p + ' — requests answered here: ' + JSON.stringify(r.requests)
                    + ' | not GET: ' + JSON.stringify(r.writes) + ' | console: ' + JSON.stringify(r.consoleLines) + '\n');
                expect({ page: p, eueCalls: r.onLoad.eueCalls, summary: r.onLoad.summaryContainer, led: r.onLoad.ledButton, writes: r.writes, errors: r.onLoad.errors })
                    .toEqual({ page: p, eueCalls: {}, summary: false, led: false, writes: [], errors: [] });
                if (r.onLoad.summaryLoaded === 'object') expect({ page: p, summaryAppears: r.control.summaryContainer }).toEqual({ page: p, summaryAppears: true });
                if (r.onLoad.ledLoaded === 'object') expect({ page: p, buttonAppears: r.control.ledButton }).toEqual({ page: p, buttonAppears: true });
            }
        } finally {
            await browser.close();
        }
    }, 120000);
});
