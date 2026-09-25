/**
 * GH-752 (queue item 3bl, part B) — THE SLAN RANGES HAVE ONE FILE, AND THE PAGES THAT RUN THE ENGINE
 * RECEIVE IT.
 *
 * The SLAN ranges by soil type lived only as a literal inside `mlsnEngine` (`hub-tissue-v3.js`), so
 * the server's analysis of a sample had nothing to judge a SLAN site with and used MLSN's thresholds
 * instead. They move to `assets/slan-ranges.json`, read by the server alone (`App\Support\SlanRanges`)
 * and handed to the pages in the layout, as `analysis-result.schema.json` is. No JavaScript copy.
 *
 * 1. The file carries exactly what the literal carries: the two soil types, and the pH-adjusted
 *    Fe/Mn ranges at every pH the literal clamps between. This is the transfer's insurance and goes
 *    when the literal goes (part E).
 * 2. Every view whose own script list loads `hub-tissue-v3.js` is on a layout that hands the ranges
 *    over. The views are found in the views, not listed here. The app layout is part E: its views are
 *    printed as waiting for it rather than passed.
 */
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const HUB = fs.readFileSync(path.join(ROOT, 'assets', 'hub-tissue-v3.js'), 'utf8');
const FILE = path.join(ROOT, 'assets', 'slan-ranges.json');
const VIEWS = path.join(ROOT, 'app', 'resources', 'views');

/** The expression that follows `const <name> =` in the engine, up to its own semicolon. */
function literal(name) {
    const head = 'const ' + name + ' =';
    const at = HUB.indexOf(head);
    expect(HUB.indexOf(head, at + 1)).toBe(-1);
    let depth = 0;
    for (let j = at + head.length; j < HUB.length; j++) {
        const c = HUB[j];
        if (c === '{' || c === '(') depth++;
        else if (c === '}' || c === ')') depth--;
        else if (c === ';' && depth === 0) return HUB.slice(at + head.length, j);
    }
    throw new Error('no end for ' + name);
}

const engineRanges = (soilType) => new Function('soilType', 'return (' + literal('slanRanges') + ');')(soilType);
const engineFeMn = (soilPH) => new Function('soilPH',
    'const phFactor = ' + literal('phFactor') + '; return (' + literal('feMnRanges') + ');')(soilPH);

function viewsUnder(dir) {
    const out = [];
    fs.readdirSync(dir, { withFileTypes: true }).forEach((d) => {
        const p = path.join(dir, d.name);
        if (d.isDirectory()) out.push(...viewsUnder(p));
        else if (d.name.endsWith('.blade.php')) out.push(p);
    });
    return out;
}

describe('GH-752 part B — the SLAN ranges have one file', () => {
    test('the file carries what the engine literal carries, for both soil types', () => {
        expect(fs.existsSync(FILE)).toBe(true);
        const file = JSON.parse(fs.readFileSync(FILE, 'utf8'));
        const got = {};
        ['sands', 'others'].forEach((t) => {
            got[t] = { engine: engineRanges(t), file: file.bySoilType && file.bySoilType[t] };
        });
        process.stdout.write('[gh752b] SLAN ranges, engine literal vs file: ' + JSON.stringify(got) + '\n');
        expect(Object.keys(file.bySoilType).sort()).toEqual(['others', 'sands']);
        ['sands', 'others'].forEach((t) => expect(got[t].file).toEqual(got[t].engine));
    });

    test('the file\'s pH adjustment gives the engine\'s Fe and Mn ranges at every pH', () => {
        const file = JSON.parse(fs.readFileSync(FILE, 'utf8'));
        const adj = file.phAdjusted;
        const fromFile = (pH) => {
            const f = (Math.max(adj.phFrom, Math.min(adj.phTo, pH)) - adj.phFrom) / (adj.phTo - adj.phFrom);
            const out = {};
            Object.keys(adj.nutrients).forEach((n) => {
                const x = adj.nutrients[n];
                out[n] = { lo: x.base + x.span * f * adj.loFactor, hi: x.base + x.span * f * adj.hiFactor };
            });
            return out;
        };
        const rows = [5, 6, 6.9, 7.4, 8.5, 9].map((pH) => ({ pH, engine: engineFeMn(pH), file: fromFile(pH) }));
        process.stdout.write('[gh752b] Fe/Mn by pH, engine vs file: ' + JSON.stringify(rows) + '\n');
        rows.forEach((r) => expect(r.file).toEqual(r.engine));
    });

    /**
     * The soil type is a property of the construction, and the construction dictionary is where a
     * construction's meaning lives (GH-664): each value resolves `slanSoilType`. It is compared with
     * the rule the engine applies today, run on the value itself, and with the file's keys, so a type
     * the file does not carry cannot be declared.
     */
    test('every construction resolves the soil type the engine would choose', () => {
        const LISTFILE = 'assets/calculation-inputs.schema.json';
        const raw = fs.readFileSync(path.join(ROOT, LISTFILE), 'utf8');
        const LIST = JSON.parse(raw);
        const values = LIST.inputs['turf.construction'].values;
        /**
         * GH-760 (queue item 3vn) — AND THE RED CARRIES AN ADDRESS.
         *
         * The failure named the construction and stopped there, so whoever read it went looking for
         * the key by hand. The project's rule asks for the file AND the line; a construction is a
         * key in the list file, and its line is where that key is declared.
         */
        const lineOfKey = (key) => {
            const at = raw.indexOf('"' + key + '"');

            return at < 0 ? null : raw.slice(0, at).split('\n').length;
        };
        const rule = new Function('construction', 'return (' + literal('soilType') + ');');
        const rows = Object.keys(values).map((k) => ({
            construction: k,
            dictionary: (values[k].resolves || {}).slanSoilType,
            engine: rule(k.toLowerCase()),
        }));
        process.stdout.write('[gh752b] construction -> soil type, dictionary vs engine rule: ' + JSON.stringify(rows) + '\n');
        const differs = rows.filter((r) => r.dictionary !== r.engine)
            .map((r) => LISTFILE + ':' + lineOfKey(r.construction) + ' ' + r.construction
                + ': dictionary ' + JSON.stringify(r.dictionary) + ', engine ' + JSON.stringify(r.engine));
        // That each type is one the file carries is gh656's claim, with the other consumers' tables.
        expect({ differs }).toEqual({ differs: [] });
    });

    test('every view that loads the engine is on a layout that hands the ranges over', () => {
        const rows = viewsUnder(VIEWS)
            .filter((v) => /['"]hub-tissue-v3\.js['"]/.test(fs.readFileSync(v, 'utf8')))
            .map((v) => {
                const src = fs.readFileSync(v, 'utf8');
                const m = /@extends\(\s*'([^']+)'/.exec(src);
                const layout = m ? m[1] : null;
                const lf = layout ? path.join(VIEWS, layout.replace(/\./g, '/') + '.blade.php') : null;
                const carries = !!(lf && fs.existsSync(lf) && /window\.GAIP_SLAN_RANGES\s*=/.test(fs.readFileSync(lf, 'utf8')));
                return { view: path.relative(VIEWS, v), layout, carries };
            });
        const waiting = rows.filter((r) => r.layout === 'layouts.app' && !r.carries).map((r) => r.view);
        const missing = rows.filter((r) => r.layout !== 'layouts.app' && !r.carries).map((r) => r.view);
        process.stdout.write('[gh752b] views loading hub-tissue-v3.js: ' + JSON.stringify(rows) + '\n'
            + '[gh752b] on layouts.app, waiting for part E: ' + JSON.stringify(waiting) + '\n');
        expect(rows.some((r) => r.layout === 'layouts.db-shell')).toBe(true);
        expect(missing).toEqual([]);
    });
});
