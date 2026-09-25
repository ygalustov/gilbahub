/**
 * GH-720 (queue item 3e) — DOES THE RUNNER HEAR ITS OWN EVENT? MEASURED IN A REAL BROWSER.
 *
 * The item says the frame does not hear a site change made while a run is in flight. Reading the
 * code gives a mechanism for that: `hub-persistence.js` registers
 * `window.addEventListener('gaip:site-changed', …)` with no capture option, and all three senders
 * dispatch on `document` with a plain `CustomEvent` — no `bubbles`. By the DOM rules a listener
 * bound to `window` in the bubble phase is never reached by such an event.
 *
 * THAT IS A CLAIM ABOUT BEHAVIOUR, SO IT IS MEASURED AS BEHAVIOUR, and neither of the two easy
 * ways of "measuring" it would have done:
 *
 *   - a DOM stub written here would encode my own belief about propagation and agree with it;
 *   - the analyst's form says jsdom, and this project has no jsdom installed — measured:
 *     `require.resolve('jsdom')` throws `MODULE_NOT_FOUND`.
 *
 * So the propagation is measured in a real browser, and this is NOT a live test: it opens a blank
 * page, logs in nowhere, presses nothing, and touches no site. The one thing it borrows from the
 * product is the SHAPE of the registration and of the dispatch, and both are read out of the
 * source files at run time rather than written out here — a paraphrase of the product would be
 * measuring my transcription.
 */

'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const asset = (f) => fs.readFileSync(path.join(ROOT, 'assets', f), 'utf8');

let chromium = null;
let why = null;
try {
    chromium = require('playwright').chromium;
} catch (err) {
    why = 'playwright is not resolvable: ' + err.code;
}

/** The senders of the event, found by directory listing rather than from a list. */
function sendersOfTheEvent() {
    const files = fs.readdirSync(path.join(ROOT, 'assets')).filter((f) => f.endsWith('.js'));
    const out = [];
    files.forEach((f) => {
        let src;
        try {
            src = asset(f);
        } catch (err) {
            if (err && err.code === 'ENOENT') return;
            throw err;
        }
        for (const m of src.matchAll(
            /(document|window)\.dispatchEvent\(\s*new CustomEvent\(\s*'gaip:site-changed'\s*,\s*\{([\s\S]{0,240}?)\}\s*\)/g)) {
            out.push({ file: f, target: m[1], declaresBubbles: /bubbles\s*:\s*true/.test(m[2]) });
        }
    });

    return out;
}

/** The runner's own condition, lifted out of its source and run as the function it is. */
function liftedCondition() {
    const src = asset('hub-persistence.js');
    const at = src.indexOf('function _foreignSiteChange(');
    if (at < 0) return null;
    let depth = 0;
    for (let i = src.indexOf('{', at); i < src.length; i++) {
        if (src[i] === '{') depth++;
        else if (src[i] === '}') {
            depth--;
            if (!depth) {
                const body = src.slice(at, i + 1);
                // eslint-disable-next-line no-new-func
                return { fn: new Function(body + '; return _foreignSiteChange;')(), body };
            }
        }
    }

    return null;
}

/** How the runner registers its listener today, taken from its own source. */
function runnerRegistration() {
    const src = asset('hub-persistence.js');
    const m = /(window|document)\.addEventListener\('gaip:site-changed',\s*function/.exec(src);

    return { target: m ? m[1] : null, capture: m ? /\},\s*true\)/.test(src.slice(m.index, m.index + 200)) : null };
}

describe('GH-720 — the frame and the site-change event', () => {
    const senders = sendersOfTheEvent();
    const registration = runnerRegistration();

    test('THE SHAPES, read from the product: where it is sent and where it is heard', () => {
        process.stdout.write('\n[gh720] senders of `gaip:site-changed` (' + senders.length + '):\n');
        senders.forEach((s) => {
            process.stdout.write('[gh720]   ' + s.file.padEnd(34) + ' -> ' + s.target
                + ', declares bubbles: ' + s.declaresBubbles + '\n');
        });
        process.stdout.write('[gh720] the runner listens on: ' + registration.target
            + ', capture: ' + registration.capture + '\n');

        expect(senders.length).toBeGreaterThan(0);
        // Every sender aims at `document` and none asks the event to bubble. If one of them did,
        // the measurement below would be about a case the product does not have.
        expect(senders.every((s) => s.target === 'document')).toBe(true);
        expect(senders.filter((s) => s.declaresBubbles)).toEqual([]);
    });

    test('MEASURED IN A REAL BROWSER: which listener hears a non-bubbling event sent to `document`', async () => {
        if (!chromium) {
            // A skip that does not say why is indistinguishable from a pass.
            process.stdout.write('[gh720] SKIPPED, and this is not a green: ' + why + '\n');
            expect(why).toBeTruthy();

            return;
        }

        const browser = await chromium.launch();
        try {
            const page = await browser.newPage();
            await page.setContent('<!doctype html><title>gh720</title>');
            const heard = await page.evaluate(() => {
                const log = {};
                window.addEventListener('gaip:site-changed', () => { log.windowBubble = true; });
                window.addEventListener('gaip:site-changed', () => { log.windowCapture = true; }, true);
                document.addEventListener('gaip:site-changed', () => { log.documentBubble = true; });
                document.dispatchEvent(new CustomEvent('gaip:site-changed', {
                    detail: { siteId: 'X', label: 'X' },
                }));

                return {
                    windowBubble: !!log.windowBubble,
                    windowCapture: !!log.windowCapture,
                    documentBubble: !!log.documentBubble,
                    userAgent: navigator.userAgent,
                };
            });
            process.stdout.write('[gh720] dispatched on `document`, no bubbles. Heard by — '
                + 'window (bubble phase): ' + heard.windowBubble
                + ' | window (capture): ' + heard.windowCapture
                + ' | document: ' + heard.documentBubble + '\n'
                + '[gh720] browser: ' + heard.userAgent + '\n');

            // POSITIVE CONTROL FIRST: the dispatch happened at all. Without this, three falses
            // would read as "the event does not reach a window listener" when the truth could be
            // "nothing was dispatched".
            expect(heard.documentBubble).toBe(true);

            /**
             * THE DEFECT, measured rather than reasoned, AND KEPT AFTER THE REPAIR.
             *
             * `window` in the bubble phase does not hear this event. That is the fact the item
             * rested on and it does not stop being worth guarding once the listener has moved: if
             * someone puts the registration back on `window`, this line still says what that
             * costs. So the propagation stays asserted and the REGISTRATION assertion is the one
             * that turned over — it read `window` before GH-720 and reads `document` now.
             */
            expect(heard.windowBubble).toBe(false);
            expect(heard.windowCapture).toBe(true);
            expect(heard.documentBubble).toBe(true);

            // The repaired shape. This is an assertion about a decision, so it changes with the
            // decision: GH-720 moved the listener because the measurement above showed it deaf.
            expect(registration.target).toBe('document');
            expect(registration.capture).toBe(false);
        } finally {
            await browser.close();
        }
    }, 60000);

    test('THE CONDITION, run as a function: another site is heard, the frame\u2019s own settling is not', () => {
        /**
         * The analyst's pair, and they are two different mistakes rather than one: a condition that
         * fires on everything refuses every run the moment the listener works, and a condition that
         * fires on nothing leaves the net as deaf as it was on `window`.
         */
        const lifted = liftedCondition();
        expect(lifted).not.toBeNull();
        const foreign = lifted.fn;
        const intent = { runId: 'r1', siteId: 'A' };

        const answers = {
            'the frame settling onto the site it was opened for': foreign({ siteId: 'A' }, intent),
            'a switch to another site': foreign({ siteId: 'X' }, intent),
            'a switch back to the original': foreign({ siteId: 'A' }, intent),
            'an event naming no site at all': foreign({ label: 'A' }, intent),
            'no detail at all': foreign(null, intent),
            'a numeric id against a string intent': foreign({ siteId: 'A' }, { siteId: 'A' }),
            'not a runner at all': foreign({ siteId: 'X' }, null),
        };
        Object.entries(answers).forEach(([what, verdict]) => {
            process.stdout.write('[gh720]   ' + what.padEnd(52) + ' -> foreign: ' + verdict + '\n');
        });

        expect(answers['a switch to another site']).toBe(true);
        expect(answers['the frame settling onto the site it was opened for']).toBe(false);
        expect(answers['a switch back to the original']).toBe(false);
        expect(answers['an event naming no site at all']).toBe(false);
        expect(answers['no detail at all']).toBe(false);
        expect(answers['not a runner at all']).toBe(false);
    });

    test('AND THE WIRING, MEASURED IN THE BROWSER: `A -> X -> A` raises the flag, `default -> A` does not', async () => {
        if (!chromium) {
            process.stdout.write('[gh720] SKIPPED, and this is not a green: ' + why + '\n');
            expect(why).toBeTruthy();

            return;
        }
        const lifted = liftedCondition();
        expect(lifted).not.toBeNull();

        const browser = await chromium.launch();
        try {
            const page = await browser.newPage();
            await page.setContent('<!doctype html><title>gh720</title>');
            // The condition comes from the product's source; only the flag and the listener are
            // written here, and they are the two lines the product has.
            const result = await page.evaluate(({ body }) => {
                // eslint-disable-next-line no-new-func
                const foreign = new Function(body + '; return _foreignSiteChange;')();
                const intent = { runId: 'r1', siteId: 'A' };
                let flag = false;
                document.addEventListener('gaip:site-changed', (e) => {
                    if (foreign(e && e.detail, intent)) flag = true;
                });
                const send = (siteId) => document.dispatchEvent(
                    new CustomEvent('gaip:site-changed', { detail: { siteId } }));

                send('A');                          // the frame settling, on its own site
                const afterSettling = flag;
                send('X');
                send('A');                          // and back, so both reporters name A again
                const afterTheRoundTrip = flag;

                return { afterSettling, afterTheRoundTrip };
            }, { body: lifted.body });

            process.stdout.write('[gh720] after the frame settled on its own site, flag: '
                + result.afterSettling + '\n'
                + '[gh720] after A -> X -> A, flag: ' + result.afterTheRoundTrip + '\n');

            expect(result.afterSettling).toBe(false);
            expect(result.afterTheRoundTrip).toBe(true);
        } finally {
            await browser.close();
        }
    }, 60000);
});
