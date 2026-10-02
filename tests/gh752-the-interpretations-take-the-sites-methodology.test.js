/**
 * GH-752 (queue item 3bl, part A, delivery 2) — THE TWO INTERPRETATIONS THE WORD EXPORT PRINTS TAKE
 * THE SITE'S METHODOLOGY AND CONSTRUCTION, NOT THE PAGE'S.
 *
 * The soil interpretation (`gilba-soil-interpretation.js`, `collectSoilOutput`) read the methodology
 * off the form field, then the page's `GAIP_STATE`, then `'mlsn'`; the synthesis
 * (`gilba-synthesis-interpretation.js`, `collectSynthesisData`) took the methodology from
 * `GAIP_STATE` with `|| 'mlsn'`, and the construction from `GAIP_STATE`, the canonical state and last
 * the form field. Both texts reach the client through the Word export. The site's config is on the
 * page as `GAIP_HUB_CONFIG` and is the one owner.
 *
 * THE PAGE STATE AND THE FIELDS ARE SET TO CONTRADICT THE CONFIG on purpose: only then does "reads the
 * config" differ from "reads something that happened to agree".
 */

'use strict';

const vm = require('vm');
const fs = require('fs');
const path = require('path');

const ASSETS = path.join(__dirname, '..', 'assets');
const read = (f) => fs.readFileSync(path.join(ASSETS, f), 'utf8');

function slice(src, sig) {
    const at = src.indexOf(sig);
    expect(at).toBeGreaterThan(-1);
    let depth = 0;
    for (let j = src.indexOf('{', at); j < src.length; j++) {
        if (src[j] === '{') depth++;
        else if (src[j] === '}') { depth--; if (!depth) return src.slice(at, j + 1); }
    }
    throw new Error('unbalanced ' + sig);
}

function page() {
    const fields = { '.gaip-soil-methodology': 'mlsn', '.gaip-construction': 'soil' };
    const box = {
        console: { log() {}, warn() {}, error() {} },
        document: {
            querySelector: (sel) => (sel in fields ? { value: fields[sel], selectedIndex: 0, options: [{ value: fields[sel] }] } : null),
            querySelectorAll: () => [],
        },
        Date, JSON, Math, Object, Array, String, Number, parseFloat, parseInt, isNaN,
    };
    box.window = box; box.global = box; box.globalThis = box;
    box.GAIP_HUB_CONFIG = {
        construction: { value: 'sand_profile', resolves: {}, known: true },
        gaipConfig: { turf: { methodology: 'slan', construction: 'sand_profile' } },
    };
    // Water too: the synthesis needs two modules before it answers at all.
    box.GAIP_STATE = { soil: { methodology: 'mlsn', ppm: { K: 40, P: 20 }, pH_water: 6.2 }, turf: { construction: 'soil' },
        water: { ecw: 0.5, pH: 7.1, ions: { Na: 20, Ca: 40, Mg: 10, HCO3: 90 } } };
    box.GilbaEngineConfidence = { assessConfidence: () => ({ level: 'medium' }) };
    box.log = () => {}; box.warn = () => {};
    box.GAIP_CANONICAL_STATE = { soil: {}, turf: { construction: 'soil' } };
    return box;
}

describe('GH-752 — the interpretations the export prints read the site, not the page', () => {
    test('the soil interpretation sends the site\'s methodology', () => {
        const src = read('gilba-soil-interpretation.js');
        const box = page();
        const ctx = vm.createContext(box);
        const method = slice(src, 'collectSoilOutput() {').replace('collectSoilOutput() {', 'function collectSoilOutput() {');
        vm.runInContext(method, ctx);
        const out = vm.runInContext('collectSoilOutput.call({ detectRegion: function () { return "au"; } })', ctx);
        process.stdout.write('[gh752] soil interpretation methodology (config slan, field and page mlsn): ' + JSON.stringify(out && out.methodology) + '\n');
        expect(out.methodology).toBe('slan');
    });

    test('the synthesis sends the site\'s methodology and construction', () => {
        const src = read('gilba-synthesis-interpretation.js');
        const box = page();
        const ctx = vm.createContext(box);
        ['log', 'warn', 'collectGridValues', 'getInputValue', 'getSelectedValue', 'detectRegion', 'getLatitude']
            .forEach((n) => { if (src.indexOf('function ' + n + '(') > -1) vm.runInContext(slice(src, 'function ' + n + '('), ctx); });
        vm.runInContext(slice(src, 'function collectSynthesisData('), ctx);
        const data = vm.runInContext('collectSynthesisData()', ctx);
        const got = { methodology: data && data.soil && data.soil.methodology, construction: data && data.soil && data.soil.construction };
        process.stdout.write('[gh752] synthesis soil (config slan / sand_profile, page mlsn / soil): ' + JSON.stringify(got) + '\n');
        expect(got).toEqual({ methodology: 'slan', construction: 'sand_profile' });
    });

    test('the export never takes a site\'s construction off the page (held by the text: collectData is not run here)', () => {
        /**
         * GH-808 (queue item 3gy) rewrote this case, and the reason is the one this project has a
         * rule about: the assertion named a BLOCK -- the soil state the amendment engine was handed
         * -- and that block is gone. The export no longer calls the engine at all, so the question
         * "does that block read the page" has no subject, and a case whose subject has disappeared
         * passes or fails by accident.
         *
         * What GH-752 was actually about survives and is asserted here instead, wider than before:
         * nowhere in this file is a site's construction taken off the page. That is true whether the
         * reader is the engine's soil state, a future block, or none at all.
         */
        const code = read('word-export.js').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
        const pageReads = (code.match(/GAIP_STATE[^\n]{0,40}construction/g) || [])
            .concat(code.match(/construction[^\n]{0,40}GAIP_STATE/g) || []);
        const inputReads = code.match(/inputs[^\n]{0,30}\.construction/g) || [];
        process.stdout.write('[gh752] construction read off the page: ' + JSON.stringify(pageReads)
            + '; read off the export\'s own inputs: ' + JSON.stringify(inputReads) + '\n');
        expect(pageReads).toEqual([]);
        // And the universe is real: the word is in this file, so an empty list above is an answer
        // about where it is read rather than about whether it is mentioned.
        expect(code.indexOf('construction')).toBeGreaterThan(-1);
    });
});
