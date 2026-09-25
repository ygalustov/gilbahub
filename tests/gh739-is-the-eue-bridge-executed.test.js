/**
 * GH-739 — DOES ANYTHING EXECUTE THE EUE BRIDGE ON THE PAGE THAT LOADS IT?
 *
 * The one reader of `GAIP_MLSN_RESULT` is `assembleChemInputs` in
 * `environmental-utilisation-engine.js`, reached through `GSSH_EUE.calculate`. Read from the code,
 * nothing reaches it: the bridge (`eue-integration-bridge.js`) listens for `gssh:*` events that no
 * script on its pages sends, and its initial run waits for a `GSSH_STATE` nobody writes. A reading
 * is a claim about form. THIS MEASURES BEHAVIOUR: the `/hub` page's own scripts, in the order its
 * template lists them, are loaded into a blank page with no login, no site and no press, and every
 * channel through which the bridge could run is watched.
 *
 * NOTHING LEAVES THE BROWSER. Every request is answered here: an asset from disk, anything else with
 * an empty reply, and every one of them is recorded with its method, so a write attempt would be seen
 * rather than made.
 *
 * WHAT THIS DOES NOT SEE, and says: a run. No run is started — pressing is forbidden tonight — so a
 * path that only a run would open is outside it. The run's own events are `gaip:*`; the census of
 * `gssh:*` senders below is what covers it, and it is read from the scripts, not assumed.
 */

'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const HUB = fs.readFileSync(path.join(ROOT, 'app', 'resources', 'views', 'hub.blade.php'), 'utf8');

let chromium = null;
let why = null;
try {
    chromium = require('playwright').chromium;
} catch (err) {
    why = 'playwright is not resolvable: ' + err.code;
}

/**
 * The page's scripts, in the order the template lists them — AS THEY STOOD WHEN THIS WAS MEASURED.
 *
 * GH-748 took the engine and the bridge off `/hub` because of this measurement. So that the
 * measurement stays reproducible rather than silently turning into a test of nothing, the two are
 * put back where they stood — after `site-data-transfer.js` — and the reconstruction is printed.
 */
const RESTORED = [];
function hubScripts() {
    const at = HUB.indexOf('$hubScripts = [');
    const end = HUB.indexOf('];', at);
    const list = Array.from(HUB.slice(at, end).matchAll(/'([\w.-]+\.js)'/g)).map((m) => m[1]);
    if (!list.includes('eue-integration-bridge.js')) {
        const after = list.indexOf('site-data-transfer.js');
        expect(after).toBeGreaterThan(-1);
        list.splice(after + 1, 0, 'environmental-utilisation-engine.js', 'eue-integration-bridge.js');
        RESTORED.push('environmental-utilisation-engine.js', 'eue-integration-bridge.js');
    }
    return list;
}

/** Who sends a `gssh:*` event, among the page's own scripts. */
function gsshSenders(scripts) {
    const out = [];
    scripts.forEach((f) => {
        const p = path.join(ROOT, 'assets', f);
        if (!fs.existsSync(p)) return;
        const src = fs.readFileSync(p, 'utf8');
        for (const m of src.matchAll(/new CustomEvent\(\s*['"](gssh:[\w-]+)['"]/g)) out.push(f + ' -> ' + m[1]);
    });
    return out;
}

const WATCH = `
    (function () {
        var seen = window.__gh739 = { events: [], mlsnAssigned: [], calculate: 0, errors: [] };
        ['dispatchEvent'].forEach(function (name) {
            [Document.prototype, Window.prototype, EventTarget.prototype].forEach(function (proto) {
                var orig = proto[name];
                if (!orig || orig.__gh739) return;
                var wrapped = function (ev) {
                    try { if (ev && typeof ev.type === 'string' && ev.type.indexOf('gssh:') === 0) seen.events.push(ev.type); } catch (e) {}
                    return orig.apply(this, arguments);
                };
                wrapped.__gh739 = true;
                proto[name] = wrapped;
            });
        });
        var mlsn;
        Object.defineProperty(window, 'GAIP_MLSN_RESULT', {
            configurable: true,
            get: function () { return mlsn; },
            set: function (v) { seen.mlsnAssigned.push(typeof v); mlsn = v; },
        });
        var eue;
        Object.defineProperty(window, 'GSSH_EUE', {
            configurable: true,
            get: function () { return eue; },
            set: function (v) {
                if (v && typeof v.calculate === 'function' && !v.calculate.__gh739) {
                    var orig = v.calculate;
                    v.calculate = function () { seen.calculate += 1; return orig.apply(this, arguments); };
                    v.calculate.__gh739 = true;
                }
                eue = v;
            },
        });
        window.addEventListener('error', function (e) { seen.errors.push(String(e.message).slice(0, 120)); });
    })();
`;

describe('GH-739 — the outcome: the engine does not read a global nothing in the product writes', () => {
    // The measurement above found the bridge not executed on the page that loads it, and nothing in
    // the tree assigns `GAIP_MLSN_RESULT`. The agreed outcome for that finding is that the read goes.
    // Held by its consequence: a value placed in the foreign global does not reach the engine's inputs.
    const vm = require('vm');
    function inputsWith(globalValue) {
        const box = { console: { log() {}, warn() {}, error() {} }, Date, JSON, Math, Object, Array, String, Number, parseFloat, isNaN };
        box.window = box; box.global = box; box.globalThis = box;
        if (globalValue !== undefined) box.GAIP_MLSN_RESULT = globalValue;
        vm.runInContext(fs.readFileSync(path.join(ROOT, 'assets', 'environmental-utilisation-engine.js'), 'utf8'),
            vm.createContext(box), { filename: 'environmental-utilisation-engine.js' });
        expect(typeof box.GSSH_EUE.assembleChemInputs).toBe('function');
        const got = box.GSSH_EUE.assembleChemInputs({}, {});
        return { soil1to5EC: got.soil1to5EC, soilKStatus: got.soilKStatus };
    }

    test('a value put in GAIP_MLSN_RESULT does not reach the engine; with nothing there it is the same', () => {
        const planted = inputsWith({ raw: { ec: 0.4 }, nutrients: { K: { delta: -5 } } });
        const empty = inputsWith(undefined);
        process.stdout.write('[gh739] engine inputs — global planted ' + JSON.stringify(planted) + ', nothing there ' + JSON.stringify(empty) + '\n');
        expect(planted).toEqual({ soil1to5EC: null, soilKStatus: null });
        expect(empty).toEqual(planted);
    });
});

describe('GH-739 — is the EUE bridge executed on the page that loads it', () => {
    const scripts = hubScripts();

    test('THE READING: the page\'s scripts, and who among them sends a gssh event', () => {
        const senders = gsshSenders(scripts);
        process.stdout.write('[gh739] restored to the pre-GH-748 list: ' + JSON.stringify(RESTORED) + '\n');
        process.stdout.write('[gh739] /hub scripts in the template: ' + scripts.length
            + ' | bridge listed: ' + scripts.includes('eue-integration-bridge.js')
            + ' | engine listed: ' + scripts.includes('environmental-utilisation-engine.js') + '\n');
        process.stdout.write('[gh739] gssh:* senders among them: ' + JSON.stringify(senders) + '\n');
        expect(scripts.length).toBeGreaterThan(100);
        expect(scripts).toContain('eue-integration-bridge.js');
        expect(scripts).toContain('environmental-utilisation-engine.js');
    });

    test('MEASURED IN A BROWSER: loading the page runs the bridge or it does not, channel by channel', async () => {
        if (!chromium) {
            process.stdout.write('[gh739] SKIPPED, and this is not a green: ' + why + '\n');
            expect(why).toBeTruthy();
            return;
        }
        const browser = await chromium.launch();
        const requests = [];
        const consoleEUE = [];
        try {
            const page = await browser.newPage();
            page.on('console', (m) => { const t = m.text(); if (/EUE/i.test(t)) consoleEUE.push(t.slice(0, 140)); });
            await page.route('**/*', async (route) => {
                const req = route.request();
                const url = new URL(req.url());
                if (url.pathname === '/blank') {
                    const tags = scripts.map((s) => '<script src="/assets/' + s + '"></script>').join('\n');
                    return route.fulfill({ status: 200, contentType: 'text/html', body: '<!doctype html><html><head></head><body>\n' + tags + '\n</body></html>' });
                }
                const asset = url.pathname.startsWith('/assets/') ? path.join(ROOT, 'assets', url.pathname.slice('/assets/'.length)) : null;
                if (asset && fs.existsSync(asset)) {
                    return route.fulfill({ status: 200, contentType: 'application/javascript', body: fs.readFileSync(asset, 'utf8') });
                }
                requests.push(req.method() + ' ' + url.pathname);
                return route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
            });
            await page.addInitScript(WATCH);
            await page.goto('http://gh739.invalid/blank');
            await page.waitForTimeout(8000);
            const seen = await page.evaluate(() => ({
                ...window.__gh739,
                bridgeLoaded: typeof window.GSSH_EUE_Bridge,
                engineLoaded: typeof window.GSSH_EUE,
                lastEUE: window.GSSH_EUE_Bridge && typeof window.GSSH_EUE_Bridge.getLastEUE === 'function'
                    ? window.GSSH_EUE_Bridge.getLastEUE() === null ? 'null' : 'a result' : 'no accessor',
            }));
            const writes = requests.filter((r) => !r.startsWith('GET '));
            process.stdout.write('[gh739] positive control — bridge object: ' + seen.bridgeLoaded + ', engine object: ' + seen.engineLoaded + '\n');
            process.stdout.write('[gh739] channel 1, gssh:* events dispatched: ' + JSON.stringify(seen.events) + '\n');
            process.stdout.write('[gh739] channel 2, GSSH_EUE.calculate calls: ' + seen.calculate + '\n');
            process.stdout.write('[gh739] channel 3, GAIP_MLSN_RESULT assignments: ' + JSON.stringify(seen.mlsnAssigned) + '\n');
            process.stdout.write('[gh739] channel 4, the bridge\'s last result: ' + seen.lastEUE + '\n');
            process.stdout.write('[gh739] channel 5, console lines naming EUE: ' + JSON.stringify(consoleEUE) + '\n');
            process.stdout.write('[gh739] channel 6, requests answered here: ' + JSON.stringify(requests) + '\n');
            process.stdout.write('[gh739]            of them not GET: ' + JSON.stringify(writes) + '\n');
            process.stdout.write('[gh739] page errors: ' + seen.errors.length + ' ' + JSON.stringify(seen.errors.slice(0, 8)) + '\n');
            // The control: the watch is worth reading only if both objects are on the page.
            expect(seen.bridgeLoaded).toBe('object');
            expect(seen.engineLoaded).toBe('object');
            // The measurement, held as a guard: loading the page runs nothing of the bridge.
            expect({ calculate: seen.calculate, mlsn: seen.mlsnAssigned, gssh: seen.events })
                .toEqual({ calculate: 0, mlsn: [], gssh: [] });

            // THE WATCH IS NOT BLIND: send the page the one event the bridge waits for, the way the
            // stadium page would, and the same channels must see it run. Without this, "no call"
            // could not be told from "a trap that sees nothing".
            const before = requests.length;
            await page.evaluate(() => document.dispatchEvent(new CustomEvent('gssh:shadeOrchestratorComplete', { detail: {} })));
            await page.waitForTimeout(2000);
            const after = await page.evaluate(() => ({ calculate: window.__gh739.calculate, events: window.__gh739.events.slice(),
                lastEUE: window.GSSH_EUE_Bridge.getLastEUE() === null ? 'null' : 'a result' }));
            const writesAfter = requests.slice(before).filter((r) => !r.startsWith('GET '));
            process.stdout.write('[gh739] control, after one gssh event: calculate ' + after.calculate + ', events ' + JSON.stringify(after.events)
                + ', last result ' + after.lastEUE + ', non-GET requests ' + JSON.stringify(writesAfter) + '\n');
            expect(after.calculate).toBeGreaterThan(0);
        } finally {
            await browser.close();
        }
    }, 60000);
});
