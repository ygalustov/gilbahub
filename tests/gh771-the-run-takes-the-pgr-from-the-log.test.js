/**
 * GH-771 (queue item 3azh) — THE RUN TAKES THE PGR APPLICATION FROM THE SPRAY LOG, THROUGH THE
 * SERVER, AND KEEPS NO COPY OF IT.
 *
 * The owner's decision: "we simply take it from the log". Three sources stood in the run's state and
 * the log was the last of them -- the Programmes card's fields, then `GAIP_LAST_PGR`, then the saved
 * config's `pgr` section. Measured on the stand before the repair: `pgr.enabled` is `false` on 12
 * sites and absent on 9, so the application date stored beside it on 12 of them reached no
 * calculation at all; and `GAIP_LAST_PGR` was restored from `localStorage`, which is a copy of the
 * server's answer that outlives it.
 *
 * WHAT IS ASSERTED HERE, and each fails on its own:
 *   - an application the server named for THIS site is the one the run is built with;
 *   - an application named for ANOTHER site is not borrowed (GH-459: what a document prints comes
 *     from the object it is about, not from the page it is drawn on);
 *   - with no answer from the server there is no application, and the card's own date is not used
 *     in its place -- a field the new hub does not even show must not decide a calculation;
 *   - the cascade keeps no `localStorage` copy of the answer.
 *
 * The 90-day window is NOT applied here: an application older than it reaches the engine, which
 * records that its effect is spent. That is a different answer from "no application", and the
 * server-side half of it is measured live in `tests/e2e/gh771-the-pgr-the-run-is-given-live.test.js`.
 */
'use strict';

const vm = require('vm');
const fs = require('fs');
const path = require('path');

const { stubSampleManager } = require('./lib/sample-readings');

const HUB = fs.readFileSync(path.join(__dirname, '..', 'assets', 'hub-tissue-v3.js'), 'utf8');
const CASCADE = fs.readFileSync(path.join(__dirname, '..', 'assets', 'spray-log-cascade.js'), 'utf8');

const ASSEMBLY = ['safeNum', 'collectGridValues', 'convertDateToISO', 'calculateEndDate', 'gaip_readSoilForm',
    'gaip_soilFromActiveSample', 'gaip_soilStateFrom', 'gaip_namedSample', 'gaip_sampleReadings',
    'gaip_waterFromActiveSample', 'calculateC3C4Fractions', 'enforceHemisphereTurfRules', 'gaip_build_state'];

function declared(name) {
    const at = HUB.indexOf('function ' + name + '(');
    expect(at).toBeGreaterThan(-1);
    let depth = 0;
    for (let j = HUB.indexOf('{', at); j < HUB.length; j++) {
        if (HUB[j] === '{') depth++;
        else if (HUB[j] === '}') { depth--; if (!depth) return HUB.slice(at, j + 1); }
    }
    throw new Error('unbalanced ' + name);
}

/** The run's `pgr` block, from `gaip_build_state` itself. `card` is what the old form would hold. */
function assembledPgr({ lastPGR, runSite, card }) {
    const fields = card || {};
    const el = (selector) => (Object.prototype.hasOwnProperty.call(fields, selector)
        ? { value: fields[selector] } : null);
    const sandbox = {
        console: { log() {}, warn() {}, error() {} },
        document: { querySelector: el, querySelectorAll: () => [] },
        location: { search: '' }, URLSearchParams,
        Date, JSON, Math, Object, Array, String, Number, parseFloat, parseInt, isNaN,
    };
    sandbox.window = sandbox; sandbox.global = sandbox; sandbox.globalThis = sandbox;
    sandbox.GAIP_SampleManager = stubSampleManager({});
    sandbox.GAIP_LAST_PGR = lastPGR || undefined;
    sandbox.GAIP_HUB_CONFIG = runSite ? { activeSiteId: runSite } : undefined;
    const ctx = vm.createContext(sandbox);
    ASSEMBLY.forEach((name) => vm.runInContext(declared(name), ctx, { filename: name }));

    return ctx.gaip_build_state({ querySelector: el, querySelectorAll: () => [] }).pgr;
}

/** The server's answer for `Russley`, as the live measurement printed it on 28.09. */
const FROM_THE_LOG = {
    log_id: 14, site_id: 'russley', zone: 'greens', application_date: '2026-07-20',
    product_name: 'Amigo 175', product_category: 'pgr', product_key: 'TE175', rate: 0.5,
};

describe('GH-771 — the PGR the run is built with', () => {
    test('the application the server named for this site is the one the run carries', () => {
        const pgr = assembledPgr({ lastPGR: FROM_THE_LOG, runSite: 'russley' });
        process.stdout.write('[gh771] the run is built with: ' + JSON.stringify(pgr) + '\n');

        expect(pgr.applicationDate).toBe('2026-07-20');
        expect(pgr.productType).toBe('TE175');
        expect(pgr.rateLperHa).toBe(0.5);
    });

    test('an application named for another site is not borrowed', () => {
        const pgr = assembledPgr({ lastPGR: FROM_THE_LOG, runSite: 'another-site' });
        process.stdout.write('[gh771] with the answer belonging to another site: ' + JSON.stringify(pgr) + '\n');

        expect(pgr.applicationDate).toBeNull();
        expect(pgr.productType).toBe('');
    });

    test('with no answer there is no application, and the old form does not stand in for one', () => {
        const pgr = assembledPgr({
            lastPGR: null, runSite: 'russley',
            card: { '.gaip-pgr-product': 'TE250', '.gaip-pgr-date': '2026-05-01', '.gaip-pgr-rate': '0.4' },
        });
        process.stdout.write('[gh771] with no answer but a filled form: ' + JSON.stringify(pgr) + '\n');

        expect(pgr.applicationDate).toBeNull();
        expect(pgr.productType).toBe('');
        expect(pgr.rateLperHa).toBe(0);
    });

    test('an application older than the window still reaches the run, for the engine to judge', () => {
        const old = Object.assign({}, FROM_THE_LOG, { application_date: '2026-06-16', product_key: 'TE250' });
        const pgr = assembledPgr({ lastPGR: old, runSite: 'russley' });
        process.stdout.write('[gh771] an application 104 days old: ' + JSON.stringify(pgr) + '\n');

        // The window is the engine's one place; the assembly does not decide it.
        expect(pgr.applicationDate).toBe('2026-06-16');
    });

    test('the cascade keeps no copy of the answer in browser storage', () => {
        const withoutComments = CASCADE
            .replace(/\/\*[\s\S]*?\*\//g, '')
            .split('\n').filter((line) => !/^\s*\/\//.test(line)).join('\n');
        const writes = [...withoutComments.matchAll(/setItem\(\s*'gilba_last_pgr_[^)]*\)/g)].map((m) => m[0]);
        const restores = [...withoutComments.matchAll(/getItem\(\s*'gilba_last_pgr_[^)]*\)/g)].map((m) => m[0]);
        process.stdout.write('[gh771] writes of the copy: ' + JSON.stringify(writes)
            + ' | reads of the copy: ' + JSON.stringify(restores) + '\n');

        // Removals stay: an old device still carries the key this work stopped writing.
        expect(writes).toEqual([]);
        expect(restores).toEqual([]);
    });
});
