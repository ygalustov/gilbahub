/**
 * GH-552 — WHERE THE CHAIN IS BROKEN, MEASURED.
 *
 * THE LIVE INSTANCE. Federal Golf's row, written by a real Re-run on 22.09.2026
 * (`analysis_results` id 13, `run_id` run-1790050104727-k7vbb7), carries SIX of
 * the thirteen keys `assets/analysis-result.schema.json` declares required —
 * `timestamp, growthPotential, soilTemp, weatherSource, irrigationNeed,
 * irrigationDeficit` — and `outcome = 'complete'`.
 *
 * The plan says that row cannot exist. Section 3 point 4: a key the run could
 * not produce is sent as `null` with the outcome saying why, so "twelve keys" is
 * inexpressible. Section 3 point 6: the server answers 422 `incomplete` to a
 * missing key.
 *
 * TWO CANDIDATES, AND THIS FILE MEASURES EACH ON ITS OWN. Either the producer
 * does not build its body from the declared set, or the server's completeness
 * check does not fire on this path. They are separate claims and a single
 * measurement that mixes them would leave the answer "one of these".
 *
 * NO LIVE TEST AND NO STAND WRITE. The producer half runs in the sandbox against
 * the same file the browser loaded; the server half is PHPUnit
 * (`Gh552ServerAcceptsAnIncompleteResultTest`). The live row is read and not
 * touched.
 */

'use strict';

const fs = require('fs');
const path = require('path');

const SCHEMA = JSON.parse(fs.readFileSync(
    path.join(__dirname, '..', 'assets', 'analysis-result.schema.json'), 'utf8'));

/** What Federal Golf's row actually has, read from the stand with SELECT. */
const FEDERAL_GOLF_ROW_KEYS = [
    'soilTemp', 'timestamp', 'weatherSource', 'irrigationNeed', 'growthPotential', 'irrigationDeficit',
];

// ─────────────────────────────────────────────────────────────────────────────
// The sandbox: the runner, loaded as the page loads it
// ─────────────────────────────────────────────────────────────────────────────

const RUN = 'run-measure';
const SITE = 'site-fg';

function makeDocument() {
    const listeners = {};
    return {
        readyState: 'complete',
        addEventListener(t, f) { (listeners[t] = listeners[t] || []).push(f); },
        removeEventListener() {},
        dispatchEvent(e) { (listeners[e.type] || []).forEach((f) => f(e)); },
        _fire(type, detail) { this.dispatchEvent({ type, detail }); },
        getElementById: () => null,
        querySelector: () => null,
        querySelectorAll: () => [],
        body: { appendChild() {}, removeChild() {} },
        head: { appendChild() {} },
        createElement: () => ({ style: {}, setAttribute() {} }),
    };
}

/**
 * @param {object} engines what the orchestrator and the live globals hold when
 *                         the run completes
 */
function runAndCapture(engines) {
    jest.useFakeTimers();
    jest.resetModules();

    const posts = [];
    const win = {};
    global.window = win;
    global.document = makeDocument();
    global.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
    global.sessionStorage = global.localStorage;
    global.CustomEvent = global.CustomEvent || class { constructor(t, i) { this.type = t; this.detail = i && i.detail; } };
    win.CustomEvent = global.CustomEvent;
    win.addEventListener = () => {};
    win.location = { search: '?rerun=' + RUN + '&site=' + SITE, href: 'http://localhost/hub', origin: 'http://localhost' };
    win.localStorage = global.localStorage;
    const messages = [];
    win.parent = { postMessage(m) { messages.push(m); } };

    global.GAIP_HUB_CONFIG = win.GAIP_HUB_CONFIG = {
        restUrl: '/api/', csrfToken: 'tok', activeSiteId: SITE, userId: 1,
    };
    global.GAIP_SiteContext = win.GAIP_SiteContext = { getSiteId: () => SITE };
    // GH-553: the declared form, as `layouts/app.blade.php` renders it. Passed
    // in rather than hardcoded — the list is read from the schema file, which is
    // the whole point of the fix.
    if (engines.__noSchema) {
        delete win.GAIP_ANALYSIS_SCHEMA;
        delete global.GAIP_ANALYSIS_SCHEMA;
    } else {
        global.GAIP_ANALYSIS_SCHEMA = win.GAIP_ANALYSIS_SCHEMA = {
            version: SCHEMA.version,
            metrics: {
                required: SCHEMA.metrics.required,
                conditional: Object.keys(SCHEMA.metrics.conditional).filter((k) => k !== '$comment'),
                branchDependent: Object.keys(SCHEMA.metrics.branchDependent).filter((k) => k !== '$comment'),
            },
        };
    }

    // The engines, exactly as the page would hold them.
    Object.keys(engines).forEach((k) => {
        if (k === '__noSchema' || k === '__refuseResultWith') return;
        global[k] = win[k] = engines[k];
    });

    const refuse = engines.__refuseResultWith;
    global.fetch = (url, init) => {
        const m = ((init || {}).method || 'GET').toUpperCase();
        if (m !== 'GET') posts.push({ url: String(url), body: JSON.parse(init.body) });
        if (refuse && /\/analysis-cache$/.test(String(url))) {
            return Promise.resolve({
                ok: false, status: refuse.status,
                json: () => Promise.resolve(refuse.body),
            });
        }
        return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({ ok: true }) });
    };
    win.fetch = global.fetch;
    global.URLSearchParams = global.URLSearchParams || require('url').URLSearchParams;

    require('../assets/hub-persistence.js');

    const doc = global.document;
    doc._fire('gaip:weather-ready', {});
    doc._fire('gaip:orchestrator-complete', {});
    doc._fire('gaip:analysis-complete', { state: {} });

    return new Promise((resolve) => {
        const settle = async () => {
            for (let i = 0; i < 20; i += 1) { await Promise.resolve(); }
            resolve({
                results:  posts.filter((p) => /\/analysis-cache$/.test(p.url)),
                failures: posts.filter((p) => /\/analysis-cache\/runs$/.test(p.url)),
                messages,
            });
        };
        settle();
    });
}

/** Just the result bodies, for the cases that only look at those. */
async function runAndCaptureBody(engines) {
    return (await runAndCapture(engines)).results;
}

/** A site where every engine answered: the control. */
const ALL_ENGINES = {
    GaipOrchestrator: {
        getState: () => ({
            computed: {
                climate: { growth: { weighted: 61 }, soilTemp: { depths: { d100mm: 14.2 } } },
                forecast: { summary: { peakRisk: 40, peakDay: 2, topThreat: 'dollar spot' },
                            diseases: [{ key: 'dollar', name: 'Dollar Spot', peakRisk: 40, peakDay: 2 }] },
            },
        }),
    },
    rawWeatherData: { _weatherStatus: 'live', forecast: {} },
    // Each of the seven missing keys has its own source global, read from the
    // producer rather than guessed: disease (2 keys), the orchestrator's
    // forecast (3), the trajectory (2).
    GAIP_DISEASE_RESULT: { overallScore: 33, topThreats: [{ disease: 'dollar spot' }] },
    GAIP_TRAJECTORY_RESULT: { summary: { currentScore: 12, trend: 'steady' } },
    GAIP_IrrigationResults: { weeklyNeed: 18, summary: { netDeficit: 4 } },
};

/**
 * The same site with the two engines that fell over on Federal Golf answering
 * null — which is what its row shows: `computed.disease` and `computed.stress`
 * are present as KEYS with the value null, and `computed.forecast` is absent
 * altogether.
 */
const ENGINES_THAT_FELL_OVER = {
    GaipOrchestrator: {
        getState: () => ({
            computed: {
                climate: { growth: { weighted: 61 }, soilTemp: { depths: { d100mm: 14.2 } } },
                // Present as keys, null as values — exactly what the live row
                // carries — and `forecast` absent altogether, likewise.
                disease: null,
                stress: null,
            },
        }),
    },
    rawWeatherData: { _weatherStatus: 'live', forecast: {} },
    // Irrigation answered on Federal Golf: its two keys are in the live row.
    GAIP_IrrigationResults: { weeklyNeed: 18, summary: { netDeficit: 4 } },
};

describe('GH-552 — half one: does the producer build its body from the declared set?', () => {
    const REQUIRED = SCHEMA.metrics.required;

    test('the schema really declares thirteen — the control for everything below', () => {
        expect(REQUIRED.length).toBe(13);
        expect(REQUIRED).toEqual(expect.arrayContaining([
            'diseaseRisk', 'topDisease', 'forecastPeak', 'peakDay',
            'forecastDisease', 'stressIndex', 'trendDirection',
        ]));
    });

    test('with every engine answering, the body carries what the run produced', async () => {
        // The control run: without it a short body below proves nothing, because
        // a sandbox that produces nothing at all agrees with every assertion
        // about missing keys.
        const posts = await runAndCaptureBody(ALL_ENGINES);
        expect(posts.length).toBe(1);
        const sent = Object.keys(posts[0].body.metrics);
        expect(sent).toEqual(expect.arrayContaining([
            'timestamp', 'growthPotential', 'soilTemp', 'weatherSource',
            'diseaseRisk', 'topDisease', 'forecastPeak', 'peakDay', 'forecastDisease',
            'irrigationNeed', 'irrigationDeficit',
        ]));
    });

    /**
     * The measurement that found the defect, kept and inverted.
     *
     * It read: seven keys ABSENT, none present as null, and the six sent were
     * Federal Golf's six key for key. It now reads thirteen of thirteen with
     * those seven null — the same sandbox, the same engines, the opposite
     * answer. This is the shape the reviewer's mutation will attack: a producer
     * whose engines did not answer, measured against the declared form.
     */
    test('MEASUREMENT: two engines answering null and the keys travel as null', async () => {
        const posts = await runAndCaptureBody(ENGINES_THAT_FELL_OVER);
        expect(posts.length).toBe(1);

        const body = posts[0].body.metrics;
        const sent = Object.keys(body);
        const missing = REQUIRED.filter((k) => !sent.includes(k));
        const presentButNull = REQUIRED.filter((k) => sent.includes(k) && body[k] === null);

        process.stdout.write('[q31] the runner sent ' + sent.length + ' keys, '
            + (REQUIRED.length - missing.length) + ' of ' + REQUIRED.length + ' required\n');
        process.stdout.write('[q31] ABSENT from the body: ' + JSON.stringify(missing.sort()) + '\n');
        process.stdout.write('[q31] present as null: ' + JSON.stringify(presentButNull.sort()) + '\n');

        expect(missing).toEqual([]);
        expect(presentButNull.sort()).toEqual([
            'diseaseRisk', 'forecastDisease', 'forecastPeak', 'peakDay',
            'stressIndex', 'topDisease', 'trendDirection',
        ]);
    });

    test('the keys the run DID produce are not flattened along with them', async () => {
        // A body built from the form could just as easily overwrite what the run
        // computed. The six Federal Golf actually had must still carry values.
        const posts = await runAndCaptureBody(ENGINES_THAT_FELL_OVER);
        const body = posts[0].body.metrics;
        FEDERAL_GOLF_ROW_KEYS.forEach((k) => {
            expect([k, body[k] === null || body[k] === undefined]).toEqual([k, false]);
        });
    });

    test('the declared order is the stored order, so a row reads like the form', async () => {
        const posts = await runAndCaptureBody(ENGINES_THAT_FELL_OVER);
        expect(Object.keys(posts[0].body.metrics).slice(0, REQUIRED.length)).toEqual(REQUIRED);
    });

    test('keys outside the required set are carried, not dropped', async () => {
        // `companionDisease` and `vwc` are conditional and `gdd`/`et` belong to a
        // climate branch. A body built from the form must not become a filter.
        const posts = await runAndCaptureBody(Object.assign({}, ALL_ENGINES, {
            GAIP_SENSOR_DATA: { vwc: 22.5 },
        }));
        expect(posts[0].body.metrics.vwc).toBe(22.5);
    });

    /**
     * The link nothing asserted, found by the reviewer's finding on the link
     * next to it.
     *
     * The server names the keys it refused a body for; the screen prints them
     * (GH-554). Between the two, the runner has to carry the list from the 422
     * body into `detail.keys` — and removing that step left both suites green.
     * A chain measured link by link with one link unmeasured is a chain nobody
     * has measured.
     */
    test('a 422 carries the server’s list into the failure report', async () => {
        const MISSING = ['diseaseRisk', 'topDisease', 'stressIndex'];
        const out = await runAndCapture(Object.assign({
            __refuseResultWith: { status: 422, body: { message: 'incomplete-result', missing: MISSING } },
        }, ALL_ENGINES));

        expect(out.failures.length).toBe(1);
        expect(out.failures[0].body.reason).toBe('incomplete-result');
        expect(out.failures[0].body.detail).toEqual({ status: 422, keys: MISSING });
        // and it does not report success on the way
        expect(out.messages.map((m) => m.type)).toEqual(['gilba:analysis-failed']);
    });

    test('a refusal that names nothing is reported as a refusal with no list', async () => {
        // A 403 has no list to carry, and the reason differs from a 422's.
        const out = await runAndCapture(Object.assign({
            __refuseResultWith: { status: 403, body: { message: 'site-not-editable' } },
        }, ALL_ENGINES));

        expect(out.failures[0].body.reason).toBe('rejected');
        expect(out.failures[0].body.detail).toEqual({ status: 403 });
    });

    test('no schema on the page means no write, and the run says so', async () => {
        // The alternative was to fall back to the old assembly, which is this
        // defect with a fallback in front of it — and silent, because the body
        // would look exactly as it did.
        const out = await runAndCapture(Object.assign({ __noSchema: true }, ENGINES_THAT_FELL_OVER));
        expect(out.results).toEqual([]);
        expect(out.failures.length).toBe(1);
        expect(out.failures[0].body.reason).toBe('schema-unavailable');
        expect(out.messages.map((m) => m.type)).toEqual(['gilba:analysis-failed']);
    });

    /**
     * Keeping the two halves apart, which is what was asked.
     *
     * The orchestrator's silence about a fallen engine (plan 8.3 p. 7, the
     * `warn()` that does not accumulate) explains why nobody SAYS anything. It
     * does not explain the missing keys, and this is the measurement that
     * separates them: nothing in this sandbox touches `warn()` at all, and the
     * seven keys are gone regardless. The producer drops them on its own.
     */
    /**
     * Keeping the two halves apart, which is what was asked, and saying where
     * the remaining one is.
     *
     * A run whose disease and stress engines fell over still reports SUCCESS —
     * the orchestrator's `warn()` does not accumulate anything, so nothing
     * downstream is even asked (plan 8.3 p. 7, NOT done here). What has changed
     * is that the result no longer hides it: the seven keys are on the row as
     * `null`, which is "nothing was computed" stated rather than omitted. The
     * reason why is the half still open, and this test is where it will be
     * measured when it is closed.
     */
    test('MEASUREMENT: the run still reports success — the reason is the open half', async () => {
        const out = await runAndCapture(ENGINES_THAT_FELL_OVER);

        process.stdout.write('[q31] failure reports sent: ' + out.failures.length + '\n');
        process.stdout.write('[q31] messages to the opener: '
            + JSON.stringify(out.messages.map((m) => m.type)) + '\n');

        expect(out.failures).toEqual([]);
        expect(out.messages.map((m) => m.type)).toEqual(['gilba:analysis-complete']);
        // But the body is complete, so "six keys and complete" is no longer
        // expressible even while the silence lasts.
        expect(out.results.length).toBe(1);
        expect(Object.keys(out.results[0].body.metrics).length).toBeGreaterThanOrEqual(13);
    });

    test('the producer takes the form from the page, and keeps no list of its own', async () => {
        // The measurement that stood here found NOTHING reading the schema. Now
        // the producer reads it — and the assertion that matters is the second
        // one: it does not carry a copy of the thirteen names, because two lists
        // of thirteen drift, which is how this question started.
        const src = fs.readFileSync(path.join(__dirname, '..', 'assets', 'hub-persistence.js'), 'utf8');
        const code = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
        expect(code).toMatch(/GAIP_ANALYSIS_SCHEMA/);
        SCHEMA.metrics.required.forEach((key) => {
            // `timestamp`, `growthPotential` and the rest are assigned by the
            // collector; what must not appear is a LIST of them next to the
            // schema read.
            expect([key, new RegExp("'" + key + "'\\s*,\\s*'").test(code)]).toEqual([key, false]);
        });
    });
});
