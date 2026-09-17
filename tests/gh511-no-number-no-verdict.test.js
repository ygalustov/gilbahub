/**
 * GH-511 — where nothing was computed, nothing is asserted about the turf.
 *
 * GH-510 stopped the number. The reviewer found that the same producer carries
 * a second answer built from the same value: `status`, a sentence. Every
 * comparison against null is false, so its ladder fell through to the last
 * rung and said "Minimal/dormant - temperature limiting" — a verdict about the
 * client's turf, produced where there was no growth potential to judge.
 *
 * His second finding is the one this file is shaped by: the GH-510 fixture was
 * `{ c3: null, c4: null, weighted: null }` — hand-written to the assertion, a
 * form the producer does not emit. So here the fixture is PRODUCED BY THE
 * PRODUCER: the three real functions are lifted out of hub-tissue-v3.js by
 * their AST and executed against the real growth-potential engine, and
 * whatever they return is what the export is fed. A key the producer adds
 * tomorrow arrives in this test without anyone remembering to add it.
 *
 * ── Passport ────────────────────────────────────────────────────────────────
 * guarantee   Where the growth potential could not be computed, the document
 *             prints neither a number nor a verdict about growth.
 * claims      By EFFECT, over `word/document.xml`: fed the object the producer
 *             really returns for an uncomputable temperature, the climate
 *             section carries no "Growth Potential" row and no "Status" row;
 *             fed the object it returns for a real temperature, it carries
 *             both. Structurally, over the AST of hub-tissue-v3.js: every
 *             property of that object whose value is derived from the combined
 *             `weighted` value refuses a null first.
 * universe    The properties of `calcMixedGrowthPotential`'s returned object,
 *             derived by walking the object literal — not a list of names
 *             written here. `weighted` and `status` are what that walk finds
 *             today; a third one added later is measured by the same walk.
 * unit        One property of the returned object (the ObjectProperty node),
 *             and one row of the printed climate table.
 * moment      The effect half at collection and printing, on the object the
 *             producer returned in this run; the structural half at parse.
 * distinguishability  Two runs differing only in the temperature handed to the
 *             producer — one the engine can compute, one it cannot. The
 *             positive control is the computable one, and it must print both
 *             rows, so "no rows" cannot pass by the section vanishing.
 * carrier     The text of `word/document.xml` for the client's half; the
 *             syntax tree for the structural half.
 * ПОТРЕБИТЕЛЬ  `word-export.js:8529` copies `cm.growth.status` and
 *             `word-export.js:12474` prints it as the "Status" row with a
 *             colour. `:8518-8527` and `:12469` do the same for the number.
 * input       The producer's own output, obtained by executing the producer.
 *             Its limit, named rather than implied: on every page that can
 *             produce a document, this producer is shadowed — see the
 *             "shadowed" test below, which measures that and keeps it honest.
 * positive-control  The computable temperature: both rows ARE printed, with
 *             the number and with the sentence.
 * exemptions  None.
 * ratchet     None.
 * rc          The reviewer's mutation: return `status` from the ladder without
 *             the null guard. Measured red on the effect half and on the
 *             structural half.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const parser = require('@babel/parser');
const traverse = require('@babel/traverse').default;
const { loadPage, SITE_ID } = require('./helpers/export-page-sandbox');

const ASSETS = path.join(__dirname, '..', 'assets');
const HUB = path.join(ASSETS, 'hub-tissue-v3.js');
const ENGINE = path.join(ASSETS, 'growth-potential-engine.js');
const PRODUCER = 'calcMixedGrowthPotential';
const LEAVES = ['calcC3GrowthPotential', 'calcC4GrowthPotential'];

const hubSource = fs.readFileSync(HUB, 'utf8');

/** The three declarations, lifted out of the file by their own source range. */
function lift(src, names) {
    const ast = parser.parse(src, { sourceType: 'script' });
    const out = {};
    traverse(ast, {
        FunctionDeclaration(p) {
            const name = p.node.id && p.node.id.name;
            if (names.indexOf(name) < 0) return;
            // The LAST declaration of a name is the one a classic script leaves
            // standing, so overwriting here matches the page's own rule.
            out[name] = src.slice(p.node.start, p.node.end);
        }
    });
    return out;
}

/**
 * The producer, running. The real engine is loaded first, because the leaves
 * read it off `window` — swapping in a stub here would make the fixture as
 * hand-made as the one this file exists to replace.
 */
function runProducer(tempC, c3frac, c4frac) {
    const lifted = lift(hubSource, [PRODUCER].concat(LEAVES));
    const missing = [PRODUCER].concat(LEAVES).filter((n) => !lifted[n]);
    if (missing.length) throw new Error('not found in hub-tissue-v3.js: ' + missing.join(', '));
    const sandbox = { console: console };
    sandbox.window = sandbox;
    sandbox.global = sandbox;
    vm.createContext(sandbox);
    vm.runInContext(fs.readFileSync(ENGINE, 'utf8'), sandbox, { filename: 'growth-potential-engine.js' });
    vm.runInContext(Object.keys(lifted).map((n) => lifted[n]).join('\n\n'), sandbox, { filename: 'hub-tissue-v3.js (lifted)' });
    return vm.runInContext(PRODUCER + '(' + JSON.stringify(tempC) + ', ' + c3frac + ', ' + c4frac + ')', sandbox);
}

/** Does this expression mention the named identifier anywhere inside it? */
function mentions(node, name) {
    let hit = false;
    (function walk(n) {
        if (hit || !n || typeof n !== 'object') return;
        if (Array.isArray(n)) return n.forEach(walk);
        if (n.type === 'Identifier' && n.name === name) { hit = true; return; }
        Object.keys(n).forEach((k) => {
            if (k === 'loc' || k === 'start' || k === 'end' || k === 'leadingComments'
                || k === 'trailingComments' || k === 'innerComments') return;
            walk(n[k]);
        });
    })(node);
    return hit;
}

/** Does it decide on a null before it decides anything else? */
function refusesNull(node) {
    if (!node || node.type !== 'ConditionalExpression') return false;
    const t = node.test;
    if (!t) return false;
    if (t.type === 'BinaryExpression' && (t.operator === '==' || t.operator === '==='
        || t.operator === '!=' || t.operator === '!==')) {
        const isNull = (s) => s && (s.type === 'NullLiteral' || (s.type === 'Identifier' && s.name === 'undefined'));
        if (isNull(t.left) || isNull(t.right)) return true;
    }
    return mentionsNullLiteral(t);
}

function mentionsNullLiteral(node) {
    let hit = false;
    (function walk(n) {
        if (hit || !n || typeof n !== 'object') return;
        if (Array.isArray(n)) return n.forEach(walk);
        if (n.type === 'NullLiteral') { hit = true; return; }
        Object.keys(n).forEach((k) => {
            if (k === 'loc' || k === 'start' || k === 'end') return;
            walk(n[k]);
        });
    })(node);
    return hit;
}

/** Every property of the producer's returned object, and what it is built from. */
function returnedProperties(src) {
    const ast = parser.parse(src, { sourceType: 'script' });
    let found = null;
    traverse(ast, {
        FunctionDeclaration(p) {
            if (!p.node.id || p.node.id.name !== PRODUCER) return;
            // The combined value: the one declarator in this function whose
            // initialiser refuses a null before combining the two leaves. Its
            // name is read off the source, not spelled here, because it is a
            // minified single letter and letters move.
            let combined = null;
            p.traverse({
                VariableDeclarator(d) {
                    const init = d.node.init;
                    if (!init || init.type !== 'ConditionalExpression') return;
                    if (!/"NullLiteral"|"value":null/.test(JSON.stringify(init.test))) return;
                    combined = d.node.id.name;
                }
            });
            p.traverse({
                ReturnStatement(r) {
                    const arg = r.node.argument;
                    if (!arg || arg.type !== 'ObjectExpression') return;
                    found = { combined: combined, properties: arg.properties.map((prop) => {
                        const key = prop.key && (prop.key.name || prop.key.value);
                        // Read off the nodes, not off the JSON text: a node's
                        // own keys come out in whatever order babel built them,
                        // and a regex over that text found nothing while the
                        // identifier was there. Measured while writing this —
                        // the walk reported an empty universe, which is the
                        // failure mode this file exists to refuse.
                        const derived = combined != null && mentions(prop.value, combined);
                        // A bare identifier IS the combined value and carries
                        // the null onward, so it needs no ladder of its own.
                        const isBare = prop.value.type === 'Identifier' && prop.value.name === combined;
                        return { key: key, derived: derived, guarded: isBare || refusesNull(prop.value) };
                    }) };
                }
            });
        }
    });
    return found;
}

function climateSection(text) {
    const needle = 'Climate & Growth Conditions';
    for (let i = text.indexOf(needle); i >= 0; i = text.indexOf(needle, i + 1)) {
        if (text.slice(Math.max(0, i - 2), i) !== '• ') return text.slice(i, i + 600);
    }
    return '';
}

async function documentText(sandbox, data) {
    const sections = sandbox.GAIP_WordExport.buildSections(data, {});
    const doc = new sandbox.docx.Document({ sections: [{ properties: {}, children: sections }] });
    const blob = await sandbox.docx.Packer.toBlob(doc);
    const zip = await sandbox.JSZip.loadAsync(Buffer.from(await blob.arrayBuffer()));
    const xml = await zip.file('word/document.xml').async('string');
    return xml.replace(/<\/w:p>/g, '\n').replace(/<\/w:tc>/g, '\t').replace(/<[^>]+>/g, '')
        .replace(/&amp;/g, '&');
}

/**
 * The export reads `growth.c3` / `growth.c4` / `growth.weighted` / `growth.status`;
 * the producer names its leaves `c3potential` / `c4potential`. The object is
 * passed through as it comes and the two leaf names are ALSO offered under the
 * export's spelling, so that the positive control can print the number. Nothing
 * is invented: the values are the producer's own.
 */
function asPublished(produced) {
    return Object.assign({}, produced, { c3: produced.c3potential, c4: produced.c4potential });
}

describe('GH-511 — no number, no verdict', () => {
    jest.setTimeout(120000);

    test('the producer is executed, and it is the producer that supplies the fixture', () => {
        expect.hasAssertions();
        const uncomputable = runProducer(null, 0.2, 0.8);
        const computable = runProducer(22, 0.5, 0.5);
        // Named so a reader of the output can see the shape this file is built
        // on, rather than a shape this file asserts.
        expect(Object.keys(uncomputable).sort())
            .toEqual(['c3potential', 'c4potential', 'dominant', 'status', 'temperature', 'weighted']);
        expect(uncomputable.weighted).toBeNull();
        expect(typeof computable.weighted).toBe('number');
    });

    test('every property built from the combined value refuses a null first', () => {
        expect.hasAssertions();
        const found = returnedProperties(hubSource);
        expect(found).not.toBeNull();
        expect(found.combined).not.toBeNull();
        const derived = found.properties.filter((p) => p.derived).map((p) => p.key);
        // The universe is what the walk finds, printed, so a property added
        // later shows up here instead of being silently outside the claim.
        expect(derived.sort()).toEqual(['status', 'weighted']);
        const unguarded = found.properties.filter((p) => p.derived && !p.guarded).map((p) => p.key);
        expect({ propertiesThatWouldSpeakWithoutANumber: unguarded })
            .toEqual({ propertiesThatWouldSpeakWithoutANumber: [] });
    });

    test('fed what the producer returns for an uncomputable temperature, the document says nothing', async () => {
        expect.hasAssertions();
        const page = loadPage({ errors: [], warnings: [], alerts: [] });
        expect(page.failures).toEqual([]);
        const produced = runProducer(null, 0.2, 0.8);
        page.sandbox.climateMetrics = {
            // The temperature is kept: it is a separate reading, and with it the
            // section is still printed — so "no rows" cannot pass by the whole
            // section vanishing for another reason.
            temperature: { mean: 8.5, max: 17.8, min: 0.2, current: 5.6 },
            growth: asPublished(produced)
        };
        const data = page.sandbox.GAIP_WordExport.collectData(
            page.sandbox.GAIP_NutritionProgramInputs.resolveExportInputs({ siteId: SITE_ID }));
        const climate = climateSection(await documentText(page.sandbox, data));
        expect({
            growthPotential: data.climate.growthPotential,
            status: data.climate.status,
            sectionFound: climate.length > 0,
            temperatureRow: /Temperature/.test(climate),
            growthPotentialRow: /Growth Potential/.test(climate),
            statusRow: /Status/.test(climate),
            verdict: /Minimal\/dormant/.test(climate)
        }).toEqual({
            growthPotential: null, status: null,
            sectionFound: true, temperatureRow: true,
            growthPotentialRow: false, statusRow: false, verdict: false
        });
    });

    test('positive control: fed a temperature it can compute, the document prints both', async () => {
        expect.hasAssertions();
        const page = loadPage({ errors: [], warnings: [], alerts: [] });
        const produced = runProducer(22, 0.5, 0.5);
        page.sandbox.climateMetrics = {
            temperature: { mean: 22, max: 27, min: 17, current: 23 },
            growth: asPublished(produced)
        };
        const data = page.sandbox.GAIP_WordExport.collectData(
            page.sandbox.GAIP_NutritionProgramInputs.resolveExportInputs({ siteId: SITE_ID }));
        const climate = climateSection(await documentText(page.sandbox, data));
        expect({
            growthPotential: Math.round(data.climate.growthPotential),
            status: data.climate.status,
            growthPotentialRow: /Growth Potential/.test(climate),
            number: new RegExp(Math.round(produced.weighted) + '%').test(climate),
            statusRow: /Status/.test(climate)
        }).toEqual({
            growthPotential: Math.round(produced.weighted),
            status: produced.status,
            growthPotentialRow: true, number: true, statusRow: true
        });
    });

    /**
     * The boundary of the claim above, measured rather than assumed.
     *
     * `mlsn-progressive-disclosure.js` declares a second top-level
     * `calcMixedGrowthPotential`, and both files are classic scripts, so on
     * every page that loads both the later declaration owns the global name —
     * including for hub-tissue-v3.js's own call sites. Measured live on
     * /reports/export and on /hub: the winning copy is the mlsn one, which
     * emits no `status` at all. Every page that loads word-export.js also
     * loads mlsn-progressive-disclosure.js after hub-tissue-v3.js.
     *
     * So the effect tested above is today reachable only through the object,
     * not through the page. This test holds that fact still: if the shadowing
     * is removed, or a page loads them the other way round, the producer above
     * becomes the one that runs and this test says so.
     */
    test('the boundary: which copy of the producer a page would get', () => {
        expect.hasAssertions();
        const views = path.join(__dirname, '..', 'app', 'resources', 'views');
        const pages = [];
        (function walk(dir) {
            fs.readdirSync(dir, { withFileTypes: true }).forEach((e) => {
                const full = path.join(dir, e.name);
                if (e.isDirectory()) return walk(full);
                if (!/\.blade\.php$/.test(e.name)) return;
                const src = fs.readFileSync(full, 'utf8');
                if (!/word-export\.js/.test(src)) return;
                const hub = src.indexOf('hub-tissue-v3.js');
                const mlsn = src.indexOf('mlsn-progressive-disclosure.js');
                pages.push({
                    page: path.relative(views, full),
                    producerThatWins: hub < 0 ? 'neither is loaded'
                        : (mlsn < 0 ? 'hub-tissue-v3.js' : (mlsn > hub ? 'mlsn-progressive-disclosure.js' : 'hub-tissue-v3.js'))
                });
            });
        })(views);
        expect(pages.length).toBeGreaterThan(0);
        // Printed, not asserted away: this is the measured state of the tree,
        // and the reviewer's report of a Status row in a document cannot have
        // come from any page listed here as shadowed.
        expect(pages.filter((p) => p.producerThatWins === 'hub-tissue-v3.js')).toEqual([]);
    });
});
