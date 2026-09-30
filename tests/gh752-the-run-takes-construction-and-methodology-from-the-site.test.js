/**
 * GH-752 (queue item 3bl, part A) — THE RUN TAKES THE SITE'S CONSTRUCTION AND METHODOLOGY FROM THE
 * SITE, NOT FROM THE FORM ON THE PAGE.
 *
 * `gaip_build_state` read both off `/hub`'s own fields — `.gaip-construction` and
 * `.gaip-soil-methodology`, the second with `|| "mlsn"` when empty. A field is the state of whatever
 * page the run happens to be drawn on (GH-459), and methodology has one owner: `config.turf.methodology`.
 * The server resolves both for the page it builds: `GAIP_HUB_CONFIG.construction` (the construction,
 * resolved by the one dictionary, GH-664) and `GAIP_HUB_CONFIG.gaipConfig` (the site's config).
 *
 * THE STATE THAT DECIDES IS THE CONTRADICTING ONE: only a field that says something ELSE than the
 * config tells "reads the config" from "reads a field that happened to agree". So each field is run
 * in three states — empty, contradicting, agreeing — and the answer must be the site's in all three.
 * What each reader received is printed.
 */

'use strict';

const vm = require('vm');
const fs = require('fs');
const path = require('path');
const { stubSampleManager } = require('./lib/sample-readings');

const HUB = fs.readFileSync(path.join(__dirname, '..', 'assets', 'hub-tissue-v3.js'), 'utf8');
const ASSEMBLY = ['safeNum', 'collectGridValues', 'convertDateToISO', 'calculateEndDate', 'gaip_readSoilForm',
    'gaip_soilFromActiveSample', 'gaip_soilStateFrom', 'gaip_namedSample', 'gaip_sampleReadings',
    'gaip_waterFromActiveSample', 'calculateC3C4Fractions', 'enforceHemisphereTurfRules', 'gaip_lastPgrForThisRun', 'gaip_build_state'];

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

const SITE = {
    construction: { value: 'sand_profile', resolves: { surfaceKey: 'sandProfile' }, known: true },
    gaipConfig: { turf: { methodology: 'slan', construction: 'sand_profile' } },
};

function build(fields, site = SITE) {
    const box = {
        console: { log() {}, warn() {}, error() {} },
        document: { querySelector: () => null, querySelectorAll: () => [] },
        location: { search: '' }, URLSearchParams,
        Date, JSON, Math, Object, Array, String, Number, parseFloat, parseInt, isNaN,
    };
    box.window = box; box.global = box; box.globalThis = box;
    box.GAIP_HUB_CONFIG = site;
    box.GAIP_SampleManager = stubSampleManager({ soil: { pH: '6.2', K: '40' } });
    const ctx = vm.createContext(box);
    ASSEMBLY.forEach((n) => vm.runInContext(declared(n), ctx, { filename: n }));
    const hub = {
        querySelector: (sel) => (sel in fields ? { value: fields[sel], dataset: {} } : null),
        querySelectorAll: () => [],
    };
    const st = ctx.gaip_build_state(hub);
    return { construction: st.turf && st.turf.construction, methodology: st.soil && st.soil.methodology };
}

describe('GH-752 — the run reads the site, not the page, for construction and methodology', () => {
    test('construction: in every state of the field the run carries the site\'s', () => {
        const got = {};
        ['', 'soil', 'sand_profile'].forEach((f) => { got[f === '' ? 'empty' : f] = build({ '.gaip-construction': f }).construction; });
        process.stdout.write('[gh752] config says sand_profile; field -> run construction: ' + JSON.stringify(got) + '\n');
        expect(got).toEqual({ empty: 'sand_profile', soil: 'sand_profile', sand_profile: 'sand_profile' });
    });

    test('methodology: in every state of the field the run carries the site\'s', () => {
        const got = {};
        ['', 'mlsn', 'slan'].forEach((f) => { got[f === '' ? 'empty' : f] = build({ '.gaip-soil-methodology': f }).methodology; });
        process.stdout.write('[gh752] config says slan; field -> run methodology: ' + JSON.stringify(got) + '\n');
        expect(got).toEqual({ empty: 'slan', mlsn: 'slan', slan: 'slan' });
    });

    /**
     * GH-752, on the reviewer's return — A SITE THAT HAS NEITHER. With the config always full, a
     * `|| "mlsn"` put back at the root of the run's methodology was never reached, and the cases above
     * stayed green: green meant "not reached", not "guarded". So the site here carries no methodology
     * and no construction, and says so in what it prints before anything is judged.
     */
    test('a site with no methodology and no construction: the run carries both as absent', () => {
        const NONE = { construction: null, gaipConfig: { turf: {} } };
        const cfgTurf = NONE.gaipConfig.turf;
        const got = {};
        ['', 'mlsn', 'slan'].forEach((f) => {
            const r = build({ '.gaip-soil-methodology': f, '.gaip-construction': f === '' ? '' : 'soil' }, NONE);
            got[f === '' ? 'empty' : f] = { methodology: r.methodology, construction: r.construction };
        });
        process.stdout.write('[gh752] the site has methodology: ' + JSON.stringify(cfgTurf.methodology === undefined ? 'none' : cfgTurf.methodology)
            + ' | construction: ' + JSON.stringify(NONE.construction === null ? 'none' : NONE.construction)
            + '; field -> run: ' + JSON.stringify(got) + '\n');
        expect(cfgTurf.methodology).toBeUndefined();
        const none = { methodology: null, construction: null };
        expect(got).toEqual({ empty: none, mlsn: none, slan: none });
    });
});
