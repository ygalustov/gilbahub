/**
 * GH-756 — THE TISSUE PANE RECEIVES ONLY THE SOIL IT READS.
 *
 * `hub-tissue-v3.js` builds a soil object for `renderTissueProgressiveDisclosure` (anchor `rt = {`).
 * Beside `ppm` it carried six fields with values the soil did not have: sodium, EC1:5, ECe and water
 * EC put to zero, the texture put to "loam", and pH (CaCl2) passed as pH (water). The renderer reads
 * `ppm` and nothing else, so none of them reached a screen; they are removed, not corrected.
 *
 * 1. Every field the block passes carries the soil's own value under its own name.
 * 2. The premise that makes the removal invisible: the pane's HTML does not depend on any soil field
 *    but `ppm`. A positive control shows the comparison sees a change when `ppm` changes.
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const HUB = 'assets/hub-tissue-v3.js';
const PANE = 'assets/tissue-progressive-disclosure.js';

function blockSource() {
    const src = fs.readFileSync(path.join(ROOT, HUB), 'utf8');
    const found = src.match(/\(rt = \{[\s\S]*?\}\)/g) || [];
    expect(found).toEqual([expect.stringContaining('ppm: e.soil.ppm')]);
    const line = src.slice(0, src.indexOf(found[0])).split('\n').length;
    return { code: found[0], line };
}

function runBlock(e) {
    const { code } = blockSource();
    const run = new Function('c', 'e', 'var rt = null; ' + code + '; return rt;');
    return run(true, e);
}

function pane() {
    const ctx = { document: { addEventListener() {}, querySelector() { return null; } }, console };
    ctx.window = ctx;
    vm.createContext(ctx);
    vm.runInContext('Math.random = function () { return 0.5; }; Date.now = function () { return 0; };', ctx);
    vm.runInContext(fs.readFileSync(path.join(ROOT, PANE), 'utf8'), ctx, { filename: PANE });
    return ctx.renderTissueProgressiveDisclosure;
}

const TISSUE = {
    status: {
        K: { band: 'Marginal', value: 1.5, range: { lo: 1.8, hi: 2.5 } },
        P: { band: 'Sufficient', value: 0.35, range: { lo: 0.3, hi: 0.5 } },
    },
};

describe('GH-756 the tissue pane receives only the soil it reads', () => {
    test('every field the block passes is the soil\'s own value under its own name', () => {
        const { line } = blockSource();
        const soil = { ppm: { K: 80, P: 10 }, pH_cacl2: 5.8 };
        const rt = runBlock({ soil, water: null });
        const foreign = Object.keys(rt).filter((k) => rt[k] !== soil[k]);
        console.log(`[gh756] ${HUB}:${line} passes ${JSON.stringify(Object.keys(rt))}; ` +
            `not the soil's own: ${JSON.stringify(foreign.map((k) => [k, rt[k]]))}`);
        expect(foreign).toEqual([]);
        expect(rt.ppm).toBe(soil.ppm);
    });

    test('the pane\'s HTML depends on no soil field but ppm', () => {
        const render = pane();
        const ppm = { K: 80, P: 10 };
        const bare = render(null, TISSUE, { ppm });
        const full = render(null, TISSUE, {
            ppm, pH_water: 5.8, Na_ppm: 0, EC1_5: 0, ECe: 0, soilTexture: 'loam', ecw: 0,
        });
        const otherPpm = render(null, TISSUE, { ppm: { K: 20, P: 40 } });
        console.log(`[gh756] ${PANE}: html ${bare.length} chars with ppm only, ${full.length} with six more fields, ` +
            `${otherPpm.length} with another ppm (positive control)`);
        expect(bare).toContain('Soil K adequate');
        expect(full).toBe(bare);
        expect(otherPpm).not.toBe(bare);
    });
});
