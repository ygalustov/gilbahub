/**
 * GH-777 (queue item 4, slice 3 and the page reader) — WHAT A STORED ROW SAYS ABOUT THE TISSUE, AND WHAT
 * THE PAGE PRINTS, BOTH AFTER THE PRODUCT'S OWN RE-RUN.
 *
 * WHAT THIS IS FOR, measured before it: the tissue section was empty in 13 of 13 stored rows and not one
 * of them said why. Slice 3 declares the requirement (`samples.tissue`) and gates the cascade on the
 * sample THIS RUN WAS GIVEN; the page reader hands three cards the server's sentence instead of one. Both
 * halves are settled offline. What no offline case can settle is whether a real run names its sample and
 * whether the sentence reaches a card on a real page, and that is this file.
 *
 * IT NAMES NO SITE OF THE STAND (GH-703): the sites to press arrive as `GILBA_E2E_GH777_SITES`, a
 * `;`-separated list, and with none the run refuses rather than pressing everything.
 *
 * WHAT IT ASSERTS, per site pressed:
 *   - a row landed, and the run says which sites it could not press and why;
 *   - the run NAMED its tissue sample, which is what decides the gate (GH-724);
 *   - THE TISSUE SECTION IS NOT EMPTY WITHOUT A REASON: either the row carries tissue, or
 *     `notApplicable` carries `samples.tissue`. Both at once, and neither, are outcomes this prints;
 *   - the page is handed the section answers, and for every card that reads them the card's own text
 *     AGREES with what the server said: a sentence is printed where there is one, and the card's old
 *     words stand where there is none. Either way round is a pass, and the count of each is printed —
 *     a run on a site whose sections all computed has no sentence to show, and that is not a failure;
 *   - NO SITE OUTSIDE THE LIST HAS A NEW LAST ROW. That is this file's own stand protection, and it
 *     covers every site with a stored row rather than a list of protected names.
 *
 * WHY `guardStand` IS NOT USED: it holds every write to `/api/analysis-cache`, and the write IS the
 * measurement. The exemption is declared in `tests/gh532-…` with this reason.
 *
 * Run: GILBA_E2E=1 GILBA_E2E_GH777=1 GILBA_E2E_GH777_SITES='<name>;<name>' \
 *      npx jest tests/e2e/gh777-the-tissue-and-the-screen-live.test.js
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

let chromium = null;
try { ({ chromium } = require('playwright')); } catch (e) { /* reported below */ }
const { openTranscript } = require('./lib/transcript');

const ENABLED = process.env.GILBA_E2E === '1' && process.env.GILBA_E2E_GH777 === '1' && !!chromium;
const CREDENTIALS_PATH = process.env.GILBA_E2E_CREDENTIALS || path.join(__dirname, '.e2e-credentials.json');
const credentials = fs.existsSync(CREDENTIALS_PATH) ? JSON.parse(fs.readFileSync(CREDENTIALS_PATH, 'utf8')) : {};
const BASE_URL = process.env.GILBA_E2E_URL || credentials.url || 'http://127.0.0.1:8080';
const EMAIL = process.env.GILBA_E2E_EMAIL || credentials.email;
const PASSWORD = process.env.GILBA_E2E_PASSWORD || credentials.password;

/** The sites this run may press, from the window it was opened for. */
const PRESSING = String(process.env.GILBA_E2E_GH777_SITES || '').split(';')
    .map((n) => n.trim()).filter((n) => n);

/** The three cards of `/plan` that read the server's section answers, and the element each writes into. */
const CARDS = [
    { key: 'preEmergent', node: 'plan-pe-body', tab: 'pre-emergent', wasPrinted: 'No pre-emergent data' },
    { key: 'pgr', node: 'plan-pgr-body', tab: 'pgr', wasPrinted: 'No PGR application recorded' },
    { key: 'wear', node: 'plan-rec-body', tab: 'recovery', wasPrinted: 'No traffic data configured' },
];

function query(sql) {
    return execFileSync('docker', ['exec', 'gilba_mysql', 'mysql', '-ugilba', '-pgilba_secret',
        'gilba', '-N', '-e', sql], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })
        .split('\n').map((l) => l.trim()).filter((l) => l);
}

/**
 * The last stored row of every site that has one, with what it says about the tissue.
 *
 * `row_tissue` is the row's own block (`computed.soilNutrition.tissue`, where the producer puts it under
 * GH-589) and `computed_tissue` is the pass's own key, because the two are different places and a claim
 * about "the section" has to say which one it read.
 */
function standNow() {
    const rows = query(
        "SELECT CONCAT_WS('|', s.name, s.id, ar.id, ar.outcome, "
        + "COALESCE(JSON_EXTRACT(ar.detail,'$.notApplicable'),'(none)'), "
        + "COALESCE(JSON_EXTRACT(ar.detail,'$.runStart.named'),'(none)'), "
        + "CASE WHEN JSON_TYPE(JSON_EXTRACT(ar.computed,'$.soilNutrition.tissue')) NOT IN ('NULL') "
        + "  THEN 'yes' ELSE 'no' END, "
        /**
         * BY THE VALUE, NOT BY THE KEY. The first form asked `JSON_CONTAINS_PATH`, and the pass writes
         * `computed.tissue = null` for a module that produced nothing -- so the key is there and the case
         * printed "tissue computed" over an empty section, missing the one outcome this file forbids. It
         * was caught by a hand-written query, not by this probe, which is the shape of fault this repository
         * keeps finding in guards: the form checked instead of the consequence.
         */
        + "CASE WHEN JSON_TYPE(JSON_EXTRACT(ar.computed,'$.tissue')) NOT IN ('NULL') "
        + "  THEN 'yes' ELSE 'no' END, "
        /**
         * GH-781 (the window of 30.09.2026) — TWO MORE FACTS OF THE SAME ROW, so that one press answers
         * four questions instead of one: what the row says was not computed (`skipped`, which is what the
         * server turns into an outcome), and whether the note about an exhausted PGR window reached it.
         * `has_pgr_note` is asked BY ITS REASON rather than by its words -- the sentence may change, the
         * reason is the key a reader can ask for.
         */
        + "COALESCE(JSON_EXTRACT(ar.detail,'$.skipped'),'(none)'), "
        + "CASE WHEN JSON_SEARCH(ar.detail,'one','pgr-window-exhausted') IS NULL "
        + "  THEN '0' ELSE '1' END, "
        + "ar.created_at) "
        + "FROM sites s JOIN analysis_results ar "
        + "  ON ar.id = (SELECT MAX(id) FROM analysis_results WHERE site_id = s.id) "
        + "ORDER BY s.name");
    const out = {};
    rows.forEach((r) => {
        const [name, id, rowId, outcome, notApplicable, named, rowTissue, computedTissue,
            skipped, pgrNote, at] = r.split('|');
        out[name] = { name, id, rowId, outcome, notApplicable, named, rowTissue, computedTissue,
            skipped, pgrNote, at };
    });

    return out;
}

/**
 * Open `/plan`, with the run frame's own navigation still settling.
 *
 * Returns `null` when the page opened, and the reason when it did not: the caller records that rather than
 * throwing, because a probe that dies here reports nothing about the rows it already measured.
 */
async function openThePlanPage(page, name, say) {
    let last = null;
    for (let attempt = 1; attempt <= 4; attempt += 1) {
        try {
            await page.goto(BASE_URL + '/plan?setup=0', { waitUntil: 'load', timeout: 45000 });
            await page.waitForLoadState('domcontentloaded').catch(() => {});

            return null;
        } catch (e) {
            last = String((e && e.message) || e).split('\n')[0];
            if (typeof say === 'function') {
                say('  the plan page did not open for ' + name + ' (attempt ' + attempt + '): ' + last);
            }
            await page.waitForTimeout(4000);
        }
    }

    return last;
}

/** Whichever entry of a row's `notApplicable` belongs to this module, as text for the transcript. */
function entryFor(row, module) {
    try {
        const list = JSON.parse((row || {}).notApplicable || '[]');

        return (Array.isArray(list) ? list : []).filter((e) => e && e.module === module);
    } catch (e) {
        return [];
    }
}

if (!ENABLED) {
    process.stdout.write('[e2e] gh777-the-tissue-and-the-screen skipped '
        + '(presses Re-run on the stand — announce first, GILBA_E2E_GH777=1 and the site list)\n');
    test.skip('GH-777 on the stand (disabled)', () => {});
} else {
    describe('GH-777 — the tissue in a stored row, and the sentence on the page', () => {
        jest.setTimeout(2400000);
        let browser, page;
        const transcript = openTranscript('gh777-tissue-and-screen');
        const say = (line) => transcript.say(line);
        let before = {};
        let after = {};
        const pressed = [];
        const consoleLines = [];
        const sentBodies = {};
        const frameLines = {};
        const frameLast = {};
        let sentSoFar = 0;
        let refused = null;
        const screens = {};

        beforeAll(async () => {
            if (!EMAIL || !PASSWORD) throw new Error('no credentials — see tests/e2e/.e2e-credentials.example.json');

            before = standNow();
            say('BEFORE — every site with a stored row: name · row · outcome · named samples · tissue in row · notApplicable');
            Object.keys(before).sort().forEach((k) => {
                const b = before[k];
                say('  BEFORE  ' + b.name + ' · row ' + b.rowId + ' · ' + b.outcome
                    + ' · named ' + b.named + ' · tissue in row ' + b.rowTissue
                    + ' · computed.tissue ' + b.computedTissue
                    + ' · has_pgr_note ' + b.pgrNote + ' · skipped ' + b.skipped
                    + ' · ' + b.notApplicable);
            });

            if (!PRESSING.length) {
                refused = 'no site list: set GILBA_E2E_GH777_SITES to the sites the window was opened for';
                say('REFUSED — ' + refused);
                after = before;

                return;
            }
            const notOnTheStand = PRESSING.filter((n) => !before[n]);
            if (notOnTheStand.length) {
                refused = 'named sites with no stored row to compare: ' + notOnTheStand.join(', ');
                say('REFUSED — ' + refused);
                after = before;

                return;
            }
            say('sites this run may press: ' + JSON.stringify(PRESSING));

            browser = await chromium.launch();
            page = await browser.newPage();
            /**
             * GH-781 (the window): the console is KEPT, not only echoed. One of the three numbers of this
             * window is whether a repeat of the pass happened at all, and the product says that in one line
             * (`[GH-589] cascade re-run ...`). Read from the page, which receives its frames' messages too.
             */
            page.on('console', (m) => {
                const t = m.text();
                consoleLines.push(t);
                if (/tissue|sample|notApplicable|GH-777|GH-589|cascade re-run|pgr/i.test(t)) {
                    say('console: ' + t.slice(0, 200));
                }
            });

            /**
             * GH-781 (delivery 5, the reviewer's second half) — WHAT THE RUNNER SENDS, recorded in the
             * frame that sends it. The row is what the server KEPT; these two are different facts, and if
             * the body carries a record the row does not, the subject is a server-side filter rather than
             * this delivery. Installed before the press so it reaches the run frame at its creation.
             */
            /**
             * GH-781 — THE BODY IS KEPT IN THE TOP WINDOW, NOT IN THE FRAME THAT SENT IT.
             *
             * The first form kept it in the sending frame's own `window`, and the window measured 0 bodies on
             * both sites: the run frame is replaced as soon as the run finishes, so by the time anything read
             * it the frame was gone. The page outlives every frame it opens and is same-origin with them, so
             * the record goes up to `window.top` and is read from the page afterwards.
             */
            await page.addInitScript(() => {
                try {
                    const bin = () => {
                        const top = window.top || window;
                        if (!top.__gilbaSentAll) top.__gilbaSentAll = [];

                        return top.__gilbaSentAll;
                    };
                    const real = window.fetch;
                    window.fetch = function (url, init) {
                        try {
                            const method = ((init || {}).method || 'GET').toUpperCase();
                            if (method !== 'GET' && /analysis-cache/.test(String(url))) {
                                bin().push({ url: String(url), at: Date.now(), body: (init || {}).body || null });
                            }
                        } catch (e) { /* never break the run to watch it */ }

                        return real.apply(this, arguments);
                    };
                } catch (e) { /* as above */ }
            });

            await page.goto(BASE_URL + '/login', { waitUntil: 'domcontentloaded' });
            await page.fill('#email', EMAIL);
            await page.fill('#password', PASSWORD);
            await Promise.all([
                page.waitForNavigation({ waitUntil: 'domcontentloaded' }).catch(() => {}),
                page.click('form.login-form button[type=submit]'),
            ]);
            await page.waitForTimeout(1500);
            if (/\/login/.test(page.url())) throw new Error('login refused for ' + EMAIL);
            say('logged in as ' + EMAIL);

            for (const name of PRESSING) {
                const wasRow = (before[name] || {}).rowId || '0';
                say('--- ' + name + ': switching through the product’s own switcher');
                await page.goto(BASE_URL + '/dashboard?setup=0', { waitUntil: 'domcontentloaded' });
                await page.waitForTimeout(2500);

                let standing = await page.evaluate(() => ({
                    id: (window.GAIP_HUB_CONFIG || {}).activeSiteId || null,
                    label: ((document.getElementById('db-site-switcher-btn') || {}).textContent || '').trim(),
                }));
                if (standing.label !== name) {
                    await page.click('#db-site-switcher-btn');
                    await page.waitForTimeout(800);
                    const clicked = await page.evaluate((wanted) => {
                        const dd = document.getElementById('db-site-dropdown');
                        if (!dd) return 'no dropdown';
                        const items = Array.from(dd.querySelectorAll('a,button,[data-site-id],li'));
                        const exact = items.find((el) => (el.textContent || '').trim() === wanted);
                        const hit = exact || items.find((el) => (el.textContent || '').trim().includes(wanted));
                        if (!hit) return 'not in the list';
                        hit.click();
                        return exact ? 'clicked (exact)' : 'clicked (by prefix)';
                    }, name);
                    say('  switcher: ' + clicked);
                    await page.waitForTimeout(4000);
                    await page.goto(BASE_URL + '/dashboard?setup=0', { waitUntil: 'domcontentloaded' });
                    await page.waitForTimeout(2500);
                    standing = await page.evaluate(() => ({
                        id: (window.GAIP_HUB_CONFIG || {}).activeSiteId || null,
                        label: ((document.getElementById('db-site-switcher-btn') || {}).textContent || '').trim(),
                    }));
                }
                say('  standing on ' + standing.id + ' — "' + standing.label + '"');

                if (standing.id !== (before[name] || {}).id) {
                    pressed.push({ site: name, pressed: false, why: 'the page stood on ' + standing.label });
                    say('  NOT PRESSED — the page is not standing on this site');
                    continue;
                }

                // WHAT STANDS OVER THE BUTTON, printed, and then waited out: on one site of the 3bt window
                // the product's own setup overlay intercepted the click and every case reported a timeout.
                let over = null;
                for (let i = 0; i < 40; i += 1) {
                    over = await page.evaluate(() => {
                        const b = document.getElementById('db-rerun-btn');
                        if (!b) return 'no button';
                        const r = b.getBoundingClientRect();
                        const at = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
                        if (!at) return 'nothing at its centre';
                        if (at === b || b.contains(at)) return null;
                        const cls = (at.className && String(at.className).slice(0, 60)) || '';
                        const named = at.tagName + (at.id ? '#' + at.id : '') + (cls ? '.' + cls : '');
                        const head = String(at.outerHTML || '').replace(/\s+/g, ' ').slice(0, 110);

                        return named + ' — ' + head;
                    });
                    if (!over) break;
                    if (i === 0) say('  the button is covered by ' + over + ' — waiting');
                    await page.waitForTimeout(500);
                }
                say('  what is at the button’s centre: ' + (over ? over + ' (still covering it)' : 'the button itself'));

                if (over) {
                    pressed.push({ site: name, pressed: false, why: 'covered by ' + over });
                    say('  NOT PRESSED — the button is not reachable on this site');
                    continue;
                }

                try {
                    await page.click('#db-rerun-btn', { timeout: 15000 });
                } catch (e) {
                    pressed.push({ site: name, pressed: false, why: 'the click did not land: ' + String(e.message).split('\n')[0] });
                    say('  NOT PRESSED — ' + String(e.message).split('\n')[0]);
                    continue;
                }
                say('  pressed Re-run at ' + new Date().toISOString());

                /**
                 * WHAT THE RUN FRAME ITSELF SAYS ABOUT ITS SAMPLES, taken while it is still running.
                 *
                 * The repeat of a pass fires when the fingerprint of its inputs changes (GH-589, and the
                 * analyst's answer of 29.09.2026: the fingerprint is built by the chooser the pass reads
                 * with). Live, the tissue stayed empty anyway -- so the question is whether the named tissue
                 * sample ever reaches the frame's store at all. That cannot be read from a row: it is a fact
                 * about the frame, and this reads it from the frame, every three seconds, as a sequence.
                 */
                const frameSaid = [];
                let landed = null;
                for (let i = 0; i < 60 && !landed; i += 1) {
                    await page.waitForTimeout(3000);
                    const runFrame = page.frames().find((f) => /\/hub\?rerun=/.test(f.url()));
                    if (runFrame) {
                        const seen = await runFrame.evaluate(() => {
                            const SM = window.GAIP_SampleManager;
                            const count = (kind) => {
                                try {
                                    return (SM && typeof SM.getSamples === 'function')
                                        ? (SM.getSamples(kind) || []).length : 'no store';
                                } catch (e) { return 'threw'; }
                            };
                            const named = (kind) => {
                                try {
                                    const answer = (typeof window.gaip_namedSample === 'function')
                                        ? window.gaip_namedSample(kind) : 'no function';

                                    return (answer && answer.id) ? answer.id : answer;
                                } catch (e) { return 'threw'; }
                            };

                            /**
                             * GH-781 — WHAT THE PASS IS ACTUALLY HANDED, read in the frame.
                             *
                             * Seven builders of the orchestrator read `schedule` and `site`, and the note
                             * about an exhausted PGR window read `pgr`; by the analyst's reading nothing
                             * publishes any of the three. An offline bench cannot answer this -- it fills
                             * those sections itself (`tests/lib/orchestrator-bench.js`), so a zero there
                             * described the bench. This reads the frame's own `_hubState.inputs`, section by
                             * section, as SHAPE rather than contents: how many keys, or `absent`/`null`.
                             */
                            const inputsNow = (function () {
                                try {
                                    const state = window.GaipOrchestrator
                                        && typeof window.GaipOrchestrator.getState === 'function'
                                        ? window.GaipOrchestrator.getState() : null;
                                    const inputs = (state && state.inputs) || null;
                                    if (!inputs) return 'no pass state on this page';
                                    const shape = {};
                                    ['climate', 'turf', 'soil', 'water', 'tissue', 'schedule', 'site', 'pgr']
                                        .forEach(function (k) {
                                            const v = inputs[k];
                                            shape[k] = (v === undefined) ? 'absent'
                                                : (v === null) ? 'null'
                                                    : (typeof v === 'object'
                                                        ? Object.keys(v).length + ' keys' : typeof v);
                                        });

                                    return shape;
                                } catch (e) {
                                    return 'unreadable: ' + String(e.message).split('\n')[0];
                                }
                            })();

                            return {
                                fingerprint: (typeof window.gaip_passSampleIds === 'function')
                                    ? window.gaip_passSampleIds() : 'no function',
                                inStore: { soil: count('soil'), water: count('water'), tissue: count('tissue') },
                                named: { soil: named('soil'), tissue: named('tissue') },
                                lastPass: (window.GAIP_LAST_CASCADE_PASS || {}).reason || null,
                                passSampleIds: (window.GAIP_LAST_CASCADE_PASS || {}).sampleIds || null,
                                passInputs: inputsNow,
                            };
                        }).catch((e) => ({ unreadable: String(e.message).split('\n')[0] }));
                        const line = JSON.stringify(seen);
                        if (seen && seen.passInputs) frameLast[name] = seen;
                        if (frameSaid[frameSaid.length - 1] !== line) {
                            frameSaid.push(line);
                            say('  FRAME +' + ((i + 1) * 3) + 's: ' + line);
                        }
                    }
                    const now = standNow()[name];
                    if (now && Number(now.rowId) > Number(wasRow)) landed = now;
                }
                frameLines[name] = frameSaid.slice();
                say('  the frame said ' + frameSaid.length + ' distinct thing(s) about its samples');
                if (landed) {
                    say('  row ' + wasRow + ' -> ' + landed.rowId + ' · ' + landed.outcome
                        + ' · named ' + landed.named + ' · tissue in row ' + landed.rowTissue
                        + ' · computed.tissue ' + landed.computedTissue);
                    say('  notApplicable: ' + landed.notApplicable);
                    /**
                     * THE SAME ROW, compared with ITS OWN PREVIOUS ONE and with what was sent. Sites are not
                     * compared with each other: a difference between two sites is a difference of sites.
                     */
                    const was = before[name] || {};
                    say('  THIS SITE, then and now · outcome ' + was.outcome + ' -> ' + landed.outcome
                        + ' · has_pgr_note ' + was.pgrNote + ' -> ' + landed.pgrNote
                        + ' · skipped ' + was.skipped + ' -> ' + landed.skipped);
                    // Read from the PAGE, where every frame's record was accumulated, and take only the
                    // bodies this site's press produced -- the bin is shared, so the earlier site's are cut
                    // off by what was already in it.
                    const allSent = await page.evaluate(() => (window.__gilbaSentAll || []).map((e) => e.body));
                    const sent = allSent.slice(sentSoFar);
                    sentSoFar = allSent.length;
                    sentBodies[name] = sent;
                    if (!sent.length) {
                        say('  SENT: not captured — the frame that posted it had gone before it could be read');
                    }
                    sent.forEach((b, i) => {
                        let d = null;
                        try { d = JSON.parse(b).detail || null; } catch (e) { d = null; }
                        say('  SENT body ' + (i + 1) + ' · skipped ' + JSON.stringify((d || {}).skipped)
                            + ' · warnings ' + JSON.stringify(((d || {}).warnings || [])
                                .map((w) => w && w.module + '/' + w.level))
                            + ' · notApplicable ' + JSON.stringify(((d || {}).notApplicable || [])
                                .map((n) => n && n.module)));
                    });
                    pressed.push({ site: name, pressed: true, row: landed.rowId });
                } else {
                    say('  NO NEW ROW within 180s');
                    pressed.push({ site: name, pressed: true, row: null });
                    continue;
                }

                /**
                 * THE SCREEN, for THIS site, read while the page stands on it. What the server handed the
                 * page (`GAIP_ANALYSIS_TEXTS.sections`) and what each reading card actually printed: a
                 * claim about what a person sees is settled by the card's own text.
                 *
                 * OPENING THE PAGE IS ITSELF AN OUTCOME. On 29.09.2026 this `goto` returned
                 * `net::ERR_ABORTED` -- the run frame the press had just opened was still navigating, and
                 * the request was cancelled under it. Every case then failed with a Playwright message, so
                 * the ONE thing that had been measured (the row) read the same as the thing that had not
                 * (the screen). Now the page is opened with a wait and up to four attempts, and a page that
                 * still refuses is RECORDED AS UNREAD with its reason, which the case below prints and
                 * fails on by name. An unmeasured claim must not be able to look measured.
                 */
                const opened = await openThePlanPage(page, name, say);
                if (opened !== null) {
                    screens[name] = { unread: opened };
                    say('  SCREEN ' + name + ': NOT READ — ' + opened);
                    continue;
                }
                await page.waitForTimeout(6000);
                /**
                 * EACH CARD IS DRAWN WHEN ITS TAB IS OPENED, and not before (`plan-ui.js`, `showTab` guards
                 * on `rendered[tabId]`). The first form read all three straight after loading `/plan`, whose
                 * default tab is the pre-emergent one -- so `pgr` and `wear` returned the template's own
                 * "Loading…", and the probe reported that as a card disagreeing with the server. It was not
                 * the product failing to draw: it was this file reading a tab nobody had opened.
                 */
                const tabsHere = {};
                for (const c of CARDS) {
                    const opened = await page.evaluate((tab) => {
                        const el = document.querySelector('.gl-tab[data-tab="' + tab + '"]');
                        if (!el) return 'no such tab';
                        el.click();

                        return 'clicked';
                    }, c.tab);
                    tabsHere[c.key] = opened === 'clicked';
                    say('  tab ' + c.tab + ': ' + opened);
                    await page.waitForTimeout(2500);
                }
                screens[name] = await page.evaluate(({ cards, tabs }) => {
                    const texts = window.GAIP_ANALYSIS_TEXTS || null;
                    const sections = (texts && texts.sections) || null;
                    const out = {
                        site: (window.GAIP_HUB_CONFIG || {}).activeSiteId || null,
                        sectionKeys: sections ? Object.keys(sections).sort() : null,
                        pill: ((document.getElementById('db-analysis-ts') || {}).textContent || '').trim() || null,
                        cards: {},
                    };
                    cards.forEach((c) => {
                        const el = document.getElementById(c.node);
                        const answer = sections ? sections[c.key] : undefined;
                        out.cards[c.key] = {
                            tabHere: tabs[c.key] !== false,
                            nodeHere: !!el,
                            serverText: (answer && answer.text) || null,
                            serverCause: (answer && answer.cause) || null,
                            cardText: el ? String(el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 300) : null,
                            cardIsEmptyState: el ? /plan-empty/.test(String(el.innerHTML || '')) : null,
                        };
                    });

                    return out;
                }, { cards: CARDS, tabs: tabsHere });
                say('  SCREEN ' + name + ': ' + JSON.stringify(screens[name]));
            }

            after = standNow();
            say('AFTER — the same list, side by side with before:');
            Object.keys(after).sort().forEach((k) => {
                const b = before[k] || {};
                const a = after[k];
                const moved = b.rowId !== a.rowId;
                say('  ' + (moved ? 'RAN     ' : 'AS WAS  ') + a.name
                    + ' · row ' + (b.rowId || '-') + ' -> ' + a.rowId
                    + ' · tissue in row ' + (b.rowTissue || '-') + ' -> ' + a.rowTissue
                    + ' · named ' + (b.named || '-') + ' -> ' + a.named);
            });
        });

        afterAll(async () => {
            if (browser) await browser.close();
            transcript.close();
        });

        test('POSITIVE CONTROL: the run had a list, and every site on it was pressed with a row landing', () => {
            // Without this the cases below are satisfied by a run that never happened: an unchanged row
            // reads the same as a row nobody asked for.
            say('presses: ' + JSON.stringify(pressed));
            expect(refused).toBeNull();
            expect(pressed.map((p) => p.site)).toEqual(PRESSING);
            expect(pressed.filter((p) => !p.pressed || !p.row)
                .map((p) => p.site + ': ' + (p.why || 'pressed, but no row landed within 180s')))
                .toEqual([]);
        });

        test('THE RUN NAMED ITS TISSUE SAMPLE, which is what the gate judges', () => {
            // GH-724: the frame carries `&tissue=` and the run records what it was told. A row with no
            // named sample cannot be read as evidence about the gate either way.
            const said = PRESSING.map((name) => {
                const a = after[name] || {};
                let named = null;
                try { named = JSON.parse(a.named === '(none)' ? 'null' : a.named); } catch (e) { named = 'unreadable'; }

                return [name, named && typeof named === 'object' && 'tissue' in named
                    ? 'tissue named: ' + JSON.stringify(named.tissue) : 'no tissue named: ' + a.named];
            });
            said.forEach((r) => say('  NAMED ' + r[0] + ' — ' + r[1]));

            expect(said.filter((r) => !/^tissue named:/.test(r[1])).map((r) => r[0] + ': ' + r[1])).toEqual([]);
        });

        test('THE ANSWER: the tissue section is never empty without a reason', () => {
            /**
             * The shape of the fault this slice closed, on a real row: the engine ran over a site with no
             * usable tissue sample, returned nothing, and the row carried an empty section with no cause —
             * 13 of 13 before this. Either the row carries tissue, or the run says which input it lacked.
             */
            const said = PRESSING.map((name) => {
                const a = after[name] || {};
                const entry = entryFor(a, 'tissue');
                const hasTissue = a.rowTissue === 'yes' || a.computedTissue === 'yes';
                const verdict = hasTissue
                    ? (entry.length ? 'tissue computed AND a reason recorded: ' + JSON.stringify(entry)
                        : 'tissue computed')
                    : (entry.length ? 'not computed, reason recorded: ' + JSON.stringify(entry)
                        : 'EMPTY WITH NO REASON');

                return [name, verdict];
            });
            said.forEach((r) => say('  TISSUE ' + r[0] + ' — ' + r[1]));

            expect(said.filter((r) => r[1] === 'EMPTY WITH NO REASON').map((r) => r[0])).toEqual([]);
        });

        test('THE SCREEN: every card that reads the server agrees with what the server said', () => {
            /**
             * The page reader of this item hands three cards the server's sentence; before it, one card did.
             * What is asserted is AGREEMENT, in both directions: where the server has a sentence the card
             * prints it, and where it has none the card prints its own old words or its numbers. A run on a
             * site whose sections all computed has no sentence to show — that is an outcome, and the count
             * of each kind is printed so it cannot be mistaken for a measurement that never reached a card.
             */
            const disagreed = [];
            const unread = [];
            /**
             * A TAB THIS SITE DOES NOT HAVE IS AN OUTCOME, NOT A DISAGREEMENT.
             *
             * `/plan` shows the Recovery tab to a sports site alone, so on a golf site the card is never
             * drawn and keeps the template's "Loading…". The first form counted that as "the card printed
             * neither the server's sentence nor its own words" -- a fault of the product, where the fact is
             * that there is nothing there to read. It is named with the site, and it leaves the count of
             * cards alone rather than being silently forgiven: the expected total is the cards this stand's
             * sites actually have.
             */
            const notHere = [];
            let printedASentence = 0;
            let keptItsOwnWords = 0;
            PRESSING.forEach((name) => {
                const screen = screens[name];
                if (!screen) { unread.push(name + ': no screen was read at all'); return; }
                if (screen.unread) { unread.push(name + ': ' + screen.unread); return; }
                say('  SCREEN ' + name + ' · keys ' + (screen.sectionKeys || []).length
                    + ' · pill ' + JSON.stringify(screen.pill));
                CARDS.forEach((c) => {
                    const seen = (screen.cards || {})[c.key] || {};
                    if (seen.tabHere === false) {
                        notHere.push(name + ' · ' + c.key + ' (tab "' + c.tab + '" is not on this site)');
                        say('    ' + c.key + ': this site has no such tab — nothing to read');

                        return;
                    }
                    say('    ' + c.key + ': server ' + JSON.stringify(seen.serverText)
                        + ' | card ' + JSON.stringify(seen.cardText));
                    if (seen.nodeHere === false) {
                        // AN ELEMENT THAT IS NOT THERE IS NOT AGREEMENT. With the node renamed, `cardText`
                        // is null and the branch below counted it as "kept its own words" — so the probe
                        // would have gone green while reading nothing at all.
                        disagreed.push(name + ' · ' + c.key + ': the card element `' + c.node
                            + '` is not on this page');

                        return;
                    }
                    if (seen.serverText) {
                        if (seen.cardText && seen.cardText.indexOf(seen.serverText.slice(0, 60)) >= 0) {
                            printedASentence += 1;
                        } else {
                            disagreed.push(name + ' · ' + c.key + ': the server said '
                                + JSON.stringify(seen.serverText) + ' and the card printed '
                                + JSON.stringify(seen.cardText));
                        }

                        return;
                    }
                    // No sentence: the card must be showing either its own old words or real content, and
                    // never a sentence attributed to a server that composed none.
                    if (seen.cardIsEmptyState && seen.cardText
                        && seen.cardText.indexOf(c.wasPrinted) < 0) {
                        disagreed.push(name + ' · ' + c.key + ': empty with neither the server’s sentence nor '
                            + 'its own words — ' + JSON.stringify(seen.cardText));

                        return;
                    }
                    // AND A CARD WITH NO TEXT AT ALL IS NOT AGREEMENT EITHER. The branch above only fires
                    // when `cardText` is a non-empty string, so a card that rendered nothing -- an element
                    // present and empty -- fell straight through to the count of cards that "kept their own
                    // words". Reading nothing is not reading the old sentence (the reviewer's second line).
                    if (!seen.cardText) {
                        disagreed.push(name + ' · ' + c.key + ': the card element `' + c.node
                            + '` is on the page and has no text at all');

                        return;
                    }
                    keptItsOwnWords += 1;
                });
            });
            const expected = PRESSING.length * CARDS.length - notHere.length;
            say('  screens read: ' + (PRESSING.length - unread.length) + ' of ' + PRESSING.length
                + (unread.length ? ' · UNREAD: ' + JSON.stringify(unread) : '')
                + '\n  cards this site does not have (' + notHere.length + '): ' + JSON.stringify(notHere)
                + '\n  cards printing the server’s sentence: ' + printedASentence
                + ' · cards keeping their own words or their numbers: ' + keptItsOwnWords
                + ' · of ' + expected + ' the pressed sites actually have'
                + ' (' + (PRESSING.length * CARDS.length) + ' cards minus ' + notHere.length + ' absent tabs)');

            // A SCREEN NOBODY COULD OPEN IS NAMED FIRST, and on its own: the previous form let a Playwright
            // message stand in for a verdict about the page, so an unmeasured claim looked like a measured
            // one. This says which page could not be opened and why, before anything is judged about cards.
            expect({ screensNotRead: unread }).toEqual({ screensNotRead: [] });

            /**
             * THE FORGIVEN CANNOT BE THE WHOLE, and the half that never ran says so out loud.
             *
             * Two holes the reviewer measured in the form above. First: with `.gl-tab[data-tab=…]` renamed,
             * every card becomes "this site has no such tab", `expected` falls to zero and `0 + 0 === 0`
             * passes — a guard that reads nothing reports agreement. Second: `printedASentence` has been 0
             * on every live run so far, so the half of this case that checks a PRINTED SENTENCE has never
             * executed; silence let that look like a pass. Neither is allowed to be silent now: the counts
             * are asserted against the stand, and a run where no sentence appeared says so with its reason.
             */
            expect(notHere.length).toBeLessThan(PRESSING.length * CARDS.length);
            const sentenceless = [];
            PRESSING.forEach((name) => {
                CARDS.forEach((c) => {
                    const seen = ((screens[name] || {}).cards || {})[c.key] || {};
                    if (seen.tabHere !== false && !seen.serverText) {
                        sentenceless.push(name + ' · ' + c.key + ': the server composed no sentence');
                    }
                });
            });
            if (printedASentence === 0) {
                say('  NO CARD PRINTED A SENTENCE on this run, and here is why, card by card: '
                    + JSON.stringify(sentenceless));
            }
            // Either a sentence reached a card, or every card that could have shown one is accounted for by
            // name. An empty run cannot pass as a measured one.
            expect(printedASentence > 0 || sentenceless.length === expected).toBe(true);
            // The map reached the browser at all, with the declared consumer keys in it.
            PRESSING.forEach((name) => {
                expect(Array.isArray((screens[name] || {}).sectionKeys)).toBe(true);
                expect((screens[name] || {}).sectionKeys).toContain('pgr');
                expect((screens[name] || {}).sectionKeys).toContain('tissue');
            });
            expect({ cardsDisagreeingWithTheServer: disagreed })
                .toEqual({ cardsDisagreeingWithTheServer: [] });
            expect(printedASentence + keptItsOwnWords).toBe(expected);
        });

        test('and no site outside the list has a new row — this file’s own stand protection', () => {
            const moved = Object.keys(before)
                .filter((name) => PRESSING.indexOf(name) < 0)
                .filter((name) => (after[name] || {}).rowId !== before[name].rowId)
                .map((name) => name + ': row ' + before[name].rowId + ' -> ' + (after[name] || {}).rowId);
            say('sites outside the list whose last row moved: ' + JSON.stringify(moved));
            expect(moved).toEqual([]);
            // and the comparison was made over a stand that has rows at all
            expect(Object.keys(before).length).toBeGreaterThan(PRESSING.length);
        });

        /**
         * GH-781 (the window of 30.09.2026) - THE FOUR THINGS THIS ONE PRESS WAS OPENED FOR, side by side.
         *
         * It PRINTS all four and fails only on the one the window exists to settle: a site whose PGR window
         * is exhausted must end with the note in its row. The other three are measurements whose outcomes
         * were named before the press, so a surprise in them is a finding, not a failure of this file.
         *
         * EACH SITE AGAINST ITS OWN PREVIOUS ROW. Two sites differ because they are two sites; only a site
         * against itself measures the change.
         */
        test('THE WINDOW: the journal answer, the note, the repeat, and sent against saved', () => {
            expect(refused).toBeNull();
            const landedSites = pressed.filter((p) => p.pressed && p.row).map((p) => p.site);
            const summary = landedSites.map((site) => {
                const was = before[site] || {};
                const now = after[site] || {};
                const pgrSeen = (frameLines[site] || []).map((l) => {
                    const m = /pgr:[a-z_0-9]+/.exec(l);

                    return m ? m[0] : null;
                }).filter((v, i, a) => v && a.indexOf(v) === i);

                return {
                    site: site,
                    row: was.rowId + ' -> ' + now.rowId,
                    outcome: was.outcome + ' -> ' + now.outcome,
                    has_pgr_note: was.pgrNote + ' -> ' + now.pgrNote,
                    skipped: was.skipped + ' -> ' + now.skipped,
                    notApplicable: now.notApplicable,
                    pgrInTheFingerprint: pgrSeen,
                    cascadeReRunLines: consoleLines.filter((l) => /cascade re-run/.test(l)).length,
                    bodiesCaptured: (sentBodies[site] || []).length,
                    /**
                     * GH-781: the eight sections of `_hubState.inputs` AS THE PRODUCT HAD THEM when the pass
                     * ran. The offline bench fills `schedule` itself (`orchestrator-bench.js`), so a zero
                     * there described the bench; this is the frame's own answer, and it belongs in the
                     * summary rather than only in the frame log nobody totals.
                     */
                    passInputs: (frameLast[site] || {}).passInputs || 'not read',
                    // What the runner SENT against what the row KEPT -- the reviewer's second half.
                    sentVersusSaved: (() => {
                        const bodies = sentBodies[site] || [];
                        if (!bodies.length) return 'no body captured';
                        let d = null;
                        try { d = JSON.parse(bodies[bodies.length - 1]).detail || {}; } catch (e) { return 'unparsed'; }

                        return {
                            sentSkipped: (d.skipped || []).map((e) => e && e.module + '/' + e.reason),
                            savedSkipped: now.skipped,
                            sentNotApplicable: (d.notApplicable || []).map((e) => e && e.module),
                        };
                    })(),
                };
            });
            summary.forEach((r) => say('WINDOW ' + JSON.stringify(r)));
            process.stdout.write('[gh781] window: ' + JSON.stringify(summary, null, 1) + '\n');

            expect(summary.map((r) => r.site)).toEqual(landedSites);
            /**
             * THE ONE THING THIS WINDOW SETTLES, decided by the MEASUREMENT and not by a site's name:
             * a run whose journal answered with an application must end with the note in its row, and a
             * run answered `none` must not. Naming a site here would also put this file in the
             * inventory of live tests that name the stand (GH-703), for a fact it can read instead.
             */
            summary.forEach((r) => {
                const answered = r.pgrInTheFingerprint.filter((v) => /^pgr:log_/.test(v));
                const none = r.pgrInTheFingerprint.indexOf('pgr:none') >= 0;
                if (answered.length) expect(r.has_pgr_note.split(' -> ')[1]).toBe('1');
                if (none && !answered.length) expect(r.has_pgr_note.split(' -> ')[1]).toBe('0');
            });
        });
    });
}
