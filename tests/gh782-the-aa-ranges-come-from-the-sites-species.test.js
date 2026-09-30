'use strict';

/**
 * GH-782 (queue item 3ga) — THE CERTIFICATE RANGES OF AN AMMONIUM-ACETATE SITE COME FROM THE SITE'S SPECIES.
 *
 * WHAT WAS WRONG, measured on the stand: all five sites set to ammonium acetate carry their species in the
 * site's config under `turf.species` — "Perennial Ryegrass", "Browntop Bent (Greens)", "Couch", "Creeping
 * Bentgrass (Greens)" — and `turf.grassSpecies` is empty in every one of them. The AA range overlay read
 * `state.turf.grassSpecies`, assembled from the `/hub` form field `.gaip-species`, so `deriveCode` resolved no
 * certificate and potassium on sand stood at 50.0-116.0 ppm where Hill Labs says 78.2-195.5. Measured in the
 * latest stored row of `Hoxton` (id 116, K `50.0-116.0`, actual 58.7) and of `Russley` (id 110, the same band,
 * actual 156.4). This is the class of GH-459: what a document prints taken from the state of a page.
 *
 * THE RANGE VALIDATOR was right in the same run, and that is why the fix is ONE FUNCTION rather than a copy of
 * its path: it reads the published page state, where the correct species arrives only because a merge lets the
 * store's keys win. Right by coincidence beside a calculation that was wrong.
 *
 * AND WHAT THE CODE HISTORY SAYS, because the owner asked why an older version was right: the line reading the
 * form has been there since the initial commit, the certificate overlay landed on 20.08 and `rangeSource` on
 * 24.08, and no commit between 19.09 and 22.09 touches any of them. So the difference between those rows is not
 * a code change — it is what the form happened to hold when the run went.
 */

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ASSETS = path.join(__dirname, '..', 'assets');

/** The Hill Labs service, as a page has it. */
function service() {
    const sandbox = { console: { log() {}, warn() {}, error() {} }, Math, JSON, Object, Array, String, Number,
        parseFloat, parseInt, isNaN, isFinite,
        // The species controller wires itself to the page at the end of its file; a stub document is enough,
        // and it is the page's own file rather than a second spelling of the certificate's keys.
        document: { readyState: 'complete', addEventListener() {}, querySelector: () => null,
            querySelectorAll: () => [], getElementById: () => null },
        setTimeout: () => 0, clearTimeout() {} };
    sandbox.window = sandbox;
    sandbox.global = sandbox;
    sandbox.globalThis = sandbox;
    vm.createContext(sandbox);
    /**
     * THE NORMALISER A PAGE HAS. `deriveCode` spells the certificate's species keys (`perennialRyegrass`) and
     * turns a settings value ("Perennial Ryegrass") into one through `SpeciesController.normalize`. A sandbox
     * without it measures its own absence: the first form of this file did, and read `code: null` for a species
     * the product resolves. Loaded, not stubbed - a stub would spell the keys a second time.
     */
    vm.runInContext(fs.readFileSync(path.join(ASSETS, 'species-controller.js'), 'utf8'), sandbox,
        { filename: 'species-controller.js' });
    vm.runInContext(fs.readFileSync(path.join(ASSETS, 'hill-labs-sample-types.js'), 'utf8'), sandbox,
        { filename: 'hill-labs-sample-types.js' });
    expect(typeof sandbox.SpeciesController.normalize).toBe('function');

    return sandbox;
}

/** The converter's own soil section, lifted from the product by name. */
function converterSoilOf(domState) {
    const src = fs.readFileSync(path.join(ASSETS, 'hub-tissue-v3.js'), 'utf8');
    const at = src.indexOf('function gaip_transformToCascadeFormat(');
    expect(at).toBeGreaterThan(-1);
    let depth = 0;
    let end = -1;
    for (let i = src.indexOf('{', at); i < src.length; i += 1) {
        if (src[i] === '{') depth += 1;
        else if (src[i] === '}') {
            depth -= 1;
            if (!depth) { end = i + 1; break; }
        }
    }
    const sandbox = { window: {}, console: { log() {}, warn() {} }, Math, JSON, Object, Array, String, Number,
        parseFloat, parseInt, isNaN, isFinite };
    sandbox.global = sandbox;
    sandbox.globalThis = sandbox;
    vm.createContext(sandbox);
    vm.runInContext(src.slice(at, end), sandbox, { filename: 'converter' });

    return sandbox.gaip_transformToCascadeFormat(domState, null).inputs.soil;
}

describe('GH-782 — what the converter carries to the engine', () => {
    test('the three fields the engine reads arrive, instead of being dropped on the way', () => {
        /**
         * THE DEFECT THIS ITEM TURNED OUT TO BE. The converter rewrote `inputs.soil` as a hand-written list and
         * carried none of `methodology`, `soilTexture`, `depthCm` - all three of which the engine reads. So every
         * site set to ammonium acetate was computed by the SLAN table while the row still declared AA: measured,
         * 43 rows of such sites since 23.09 and 41 of them declaring AA with no `rangeSource` at all.
         */
        const soil = converterSoilOf({
            soil: { methodology: 'ammonium_acetate', soilTexture: 'sand', depthCm: 75, ppm: { K: 58.7 } },
            turf: {}, climate: {}, water: {}, tissue: {},
        });
        process.stdout.write('\n[gh782] the converter carried: '
            + JSON.stringify({ methodology: soil.methodology, soilTexture: soil.soilTexture,
                depthCm: soil.depthCm }) + '\n');

        expect(soil.methodology).toBe('ammonium_acetate');
        expect(soil.soilTexture).toBe('sand');
        expect(soil.depthCm).toBe(75);
    });

    test('and absence travels as absence: nothing is substituted for the three', () => {
        const soil = converterSoilOf({ soil: { ppm: {} }, turf: {}, climate: {}, water: {}, tissue: {} });
        process.stdout.write('[gh782] with nothing entered: '
            + JSON.stringify({ methodology: soil.methodology, soilTexture: soil.soilTexture,
                depthCm: soil.depthCm }) + '\n');

        expect(soil.methodology).toBeNull();
        expect(soil.soilTexture).toBeNull();
        expect(soil.depthCm).toBeNull();
    });
});

describe('GH-782 — a site with no methodology is not computed by a substituted one', () => {
    test('the engine computes nothing and says so, rather than falling into the SLAN table', () => {
        /**
         * `|| "slan"` stood in the engine and is what hid the defect: with the field dropped, every AA site fell
         * into SLAN silently. Methodology is a required input (the owner, 24.09.2026) and nothing may fill it, so
         * a run without one produces nothing in the shape the cascade recognises - which is what puts a cause in
         * the row instead of an empty section.
         */
        const { buildContext, run } = require('./helpers/mlsn-engine-harness');
        const ctx = buildContext();
        const out = ctx.mlsnEngine({
            soil: { ppm: { K: 58.7 }, methodology: null, soilTexture: 'sand' },
            turf: { turfType: 'green' }, fertility: {},
        }, null);
        process.stdout.write('[gh782] no methodology -> ' + JSON.stringify({ status: out && out.status,
            nutrients: out && out.nutrients, html: out && out.html ? 'some' : (out && out.html) }) + '\n');

        expect(out.status).toBe('Not available');
        expect(out.nutrients).toBeNull();
        expect(out.html).toBe('');
        // CONTROL from the same harness: with a methodology it does compute, so this is about the absence.
        const computed = run(ctx, { methodology: 'ammonium_acetate', species: 'perennialRyegrass',
            construction: 'sand_profile', soilTexture: 'sand', cec: 5, ppm: { K: 199 } });
        expect(computed.row('K')).toBeTruthy();
    });
});

describe('GH-782 — the species for AA ranges is the site\'s, and one function answers it', () => {
    test('the site\'s config answers, and the page\'s form field is not consulted at all', () => {
        const s = service();
        // The stand's shape: the species in the config, and the key the calculation used to read left empty.
        s.GAIP_HUB_CONFIG = { gaipConfig: { turf: { species: 'Perennial Ryegrass', grassSpecies: null } } };
        // The page's own state, carrying something else entirely - it must not win.
        const pageState = { turf: { grassSpecies: 'Couch', warmBase: 'Couch' } };
        const answer = s.HillLabsSampleTypes.speciesOfTheSite(pageState);

        process.stdout.write('\n[gh782] config says "' + answer + '", the page said "'
            + pageState.turf.grassSpecies + '"\n');

        expect(answer).toBe('Perennial Ryegrass');
        expect(answer).not.toBe('Couch');
    });

    test('and it resolves the certificate the stand\'s sites should get', () => {
        /**
         * The consequence, against Hill Labs' own numbers rather than against another surface of ours: a
         * ryegrass site on sand resolves a code, and its potassium band is the certificate's.
         */
        const s = service();
        s.GAIP_HUB_CONFIG = { gaipConfig: { turf: { species: 'Perennial Ryegrass' } } };
        const species = s.HillLabsSampleTypes.speciesOfTheSite({ turf: {} });
        const code = s.HillLabsSampleTypes.deriveCode(species, 'sand');
        // The range is asked PER NUTRIENT - the second argument - which is how the overlay asks for it.
        const k = code ? s.HillLabsSampleTypes.getRangesPpm(code, 'K') : null;

        process.stdout.write('[gh782] species "' + species + '" + sand -> code ' + JSON.stringify(code)
            + ' | potassium ' + JSON.stringify(k) + '\n');

        expect(code).toBe('S277');
        expect(k).toBeTruthy();
        // THE CERTIFICATE'S OWN FIGURES, which the stand's rows do not have today.
        expect(Number(k.min)).toBeCloseTo(78.2, 1);
        expect(Number(k.max)).toBeCloseTo(195.5, 1);
    });

    test('no config on the page is an OUTCOME: no species, no code, and the form is still not read', () => {
        const s = service();
        s.GAIP_HUB_CONFIG = null;
        const answer = s.HillLabsSampleTypes.speciesOfTheSite({ turf: { grassSpecies: 'Couch' } });
        process.stdout.write('[gh782] no config -> ' + JSON.stringify(answer) + '\n');

        // Not the form's value, and not a substitution: the texture-only ranges stay, which is what they are for.
        expect(answer).toBeNull();
        expect(s.HillLabsSampleTypes.deriveCode(answer, 'sand')).toBeNull();
    });

    test('BOTH READERS ask the one function, and neither keeps its own path', () => {
        /**
         * The reason this is one function: the validator was right by coincidence while the calculation beside it
         * was wrong. Read off the two files, because the claim is about who asks whom.
         */
        const engine = fs.readFileSync(path.join(ASSETS, 'hub-tissue-v3.js'), 'utf8');
        const validator = fs.readFileSync(path.join(ASSETS, 'input-range-validator.js'), 'utf8');

        expect(engine).toContain('speciesOfTheSite(state)');
        expect(validator).toContain('speciesOfTheSite(state)');
        // And the code the overlay resolves is built from that answer, not from the form's species.
        expect(engine).toContain('deriveCode(aaSpecies, generalSoilTexture)');
        process.stdout.write('[gh782] both readers call `speciesOfTheSite`, and the overlay derives from it\n');
    });
});
