/**
 * GH-752 (queue item 3bl, part D) — THE SOIL PAGE NAMES THE SITE'S METHODOLOGY, NOT THE RUN'S STAMP.
 *
 * `soil-nutrition-analysis.js` wrote every threshold "AA:" for AA and "MLSN:" otherwise, so a SLAN
 * site's ranges were labelled MLSN; and seven places decided the methodology from
 * `sn.methodology` — the stamp of what the run used, which the project's rule forbids reading back
 * to interpret anything — three of them with `|| 'mlsn'`. The page now takes the site's own
 * methodology from its config, and the word for it from the inputs list through the server
 * (`GAIP_HUB_CONFIG.methodologyShort`). A site with none is told so.
 *
 * THE STATE THAT DECIDES IS THE CONTRADICTING ONE: the stamp says `mlsn` while the site says
 * `slan` (or `ammonium_acetate`). What each surface printed is printed here.
 */
'use strict';

const vm = require('vm');
const fs = require('fs');
const path = require('path');

const SRC = fs.readFileSync(path.join(__dirname, '..', 'assets', 'soil-nutrition-analysis.js'), 'utf8');
const EXPORT = 'global.GAIP_SoilNutritionAnalysis = { init: init, mountSampleDropdown: mountSampleDropdown };';

function load(hubConfig) {
    expect(SRC).toContain(EXPORT);
    const src = SRC.replace(EXPORT, 'global.GAIP_SoilNutritionAnalysis = { init: init, mountSampleDropdown: mountSampleDropdown, '
        + '__t: { cards: renderNutrientCards, annual: renderAnnualRequirements, context: renderContext, header: renderPageHeader, verdict: renderVerdict } };');
    const box = {
        window: {},
        document: { createElement: () => ({ textContent: '' }), querySelector: () => null, getElementById: () => null },
        console: { log() {}, warn() {} },
        localStorage: { getItem: () => null },
    };
    box.window.GAIP_DASHBOARD_DATA = {};
    box.window.GAIP_HUB_CONFIG = hubConfig;
    box.global = box.window;
    box.globalThis = box.window;
    const ctx = vm.createContext(box);
    vm.runInContext(src.replace('(function (global) {', '(function (global) { global = global || window;'), ctx, { filename: 'soil-nutrition-analysis.js' });
    return box.window.GAIP_SoilNutritionAnalysis.__t;
}

const SN = {
    methodology: 'mlsn', // the run's stamp, contradicting the site on purpose
    verdict: 'MONITOR',
    depthCm: 10, bulkDensity: 1.4,
    annualDemand: { K: 40 },
    nutrients: [{ nutrient: 'K', actual: '60.0', mlsn: '12.0-28.0', targetPpm: '12', status: 'SUFFICIENT', statusClass: 'adequate' }],
};

function surfaces(hubConfig) {
    const t = load(hubConfig);
    const text = (html) => String(html || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    return {
        threshold: (/sn-card-threshold">([^<]*)/.exec(t.cards(SN)) || [])[1] || null,
        annual: (/Annual Nutrient Requirements \(([^)]*)\)/.exec(t.annual(SN)) || [])[1] || null,
        context: (/Methodology<\/span><span class="sn-context-val">([^<]*)/.exec(t.context(SN)) || [])[1] || null,
        header: (/flex-shrink:0">([^<]*)<\/span>/.exec(t.header(SN)) || [])[1] || null,
        verdict: (/opacity:\.7">\(([^)]*)\)<\/span>/.exec(t.verdict(SN)) || [])[1] || null,
    };
}

describe('GH-752 part D — the soil page names the site\'s methodology', () => {
    test('no place in the page reads the run\'s stamp to decide the methodology', () => {
        const code = SRC.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' ')).replace(/^[ \t]*\/\/.*$/gm, '');
        const reads = code.split('\n').map((l, i) => ({ l, i: i + 1 })).filter((r) => /\bsn\.methodology\b/.test(r.l))
            .map((r) => 'assets/soil-nutrition-analysis.js:' + r.i + ' ' + r.l.trim());
        process.stdout.write('[gh752d] reads of the stamp sn.methodology: ' + JSON.stringify(reads) + '\n');
        expect(reads).toEqual([]);
    });

    test('a SLAN site whose run was stamped mlsn is labelled SLAN everywhere', () => {
        const got = surfaces({ gaipConfig: { turf: { methodology: 'slan' } }, methodologyShort: 'SLAN' });
        process.stdout.write('[gh752d] site slan, stamp mlsn: ' + JSON.stringify(got) + '\n');
        expect(got.threshold).toMatch(/^SLAN: 12\.0-28\.0 ppm/);
        expect(got.annual).toBe('SLAN');
        expect(got.context).toMatch(/^SLAN/);
        expect(got.header).toBe('SLAN');
        expect(got.verdict).toBe('SLAN');
        expect(JSON.stringify(got)).not.toMatch(/MLSN/);
    });

    test('an AA site whose run was stamped mlsn is labelled AA', () => {
        const got = surfaces({ gaipConfig: { turf: { methodology: 'ammonium_acetate' } }, methodologyShort: 'AA' });
        process.stdout.write('[gh752d] site ammonium_acetate, stamp mlsn: ' + JSON.stringify(got) + '\n');
        expect(got.threshold).toMatch(/^AA: 12\.0-28\.0 ppm/);
        // The header and the verdict keep the page's own words, by the owner's decision on the page's
        // words: "leave it as it works now". The verdict prints the key in capitals.
        expect(got.header).toBe('Ammonium Acetate');
        expect(got.verdict).toBe('AMMONIUM_ACETATE');
        expect(got.annual).toBe('AA');
        expect(JSON.stringify(got)).not.toMatch(/MLSN/);
    });

    /**
     * GH-752 — THE DELIVERED WORD IS TAKEN WHERE THE WORK PUT IT. A word the list would never carry
     * is delivered, so a surface that builds its own word shows it. The threshold and the annual
     * requirements take the server's short word. The header and the verdict keep the page's own words
     * by the owner's decision ("leave it as it works now"), and this case holds that as well: they
     * print the page's word for the site's methodology, not the delivered one.
     */
    test('the threshold and the annual requirements take the delivered word; the header and verdict keep the page\'s own', () => {
        const got = surfaces({ gaipConfig: { turf: { methodology: 'slan' } }, methodologyShort: 'SLAN-X' });
        process.stdout.write('[gh752d] delivered SLAN-X for a slan site: ' + JSON.stringify(got) + '\n');
        expect(got.threshold).toMatch(/^SLAN-X: /);
        expect(got.annual).toBe('SLAN-X');
        expect(got.header).toBe('SLAN');
        expect(got.verdict).toBe('SLAN');
    });

    test('a site with no methodology is told so, and no methodology is put in its place', () => {
        const got = surfaces({ gaipConfig: { turf: {} }, methodologyShort: null });
        process.stdout.write('[gh752d] site has methodology: none, stamp mlsn: ' + JSON.stringify(got) + '\n');
        expect(got.threshold).toMatch(/^No methodology set/);
        expect(got.annual).toBe('No methodology set');
        expect(got.context).toBe('No methodology set');
        expect(got.header).toBe('No methodology set');
        expect(got.verdict).toBeNull();
        expect(JSON.stringify(got)).not.toMatch(/MLSN|SLAN|Ammonium/);
    });
});
