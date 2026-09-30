/**
 * GH-725 (queue item 3bo, the reviewer's return) — A CONFIG FIELD THE RUN READS IS DECLARED IN THE
 * INPUTS LIST, AND THE UNIVERSE IS THE CODE'S READS RATHER THAN THE LIST'S CLAIMS.
 *
 * Her position, and it is the eighth of one night's class: the guards of the inputs list see the
 * reads that are DECLARED, so the repair of this very item added a read of `config.pgr.enabled` in
 * the converter and all forty-four of them stayed green. A list can only be wrong about itself in
 * one direction that nobody was watching — a field the run takes and the list never heard of.
 *
 * SO THE UNIVERSE IS TAKEN FROM THE CODE: every path read off the site's config in the two files
 * that assemble the run's state, found by scanning them with comments dropped, resolved through one
 * level of variable indirection (`var cfg = …gaipConfig; cfg.pgr.enabled`) because that is how the
 * read that escaped was written.
 *
 * THE BOUNDARY, printed as a number rather than described: the same scan over the REST of `assets`
 * finds reads too — the Settings form reading back what it saves, an interpretation panel, the
 * weather override page — and those are not the run's inputs. This case covers the run's own
 * assembly and says how much it leaves outside.
 */

'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const ASSETS = path.join(ROOT, 'assets');
const LIST = JSON.parse(fs.readFileSync(path.join(ASSETS, 'calculation-inputs.schema.json'), 'utf8'));

/** The files that assemble the state the run hands its modules. */
const RUN_ASSEMBLY = ['hub-tissue-v3.js', 'hub-orchestrator.js'];

/**
 * The file with its comments removed — and with its LINE NUMBERS intact.
 *
 * GH-760: a block comment used to collapse to a single space, so every line below it moved up and
 * the address printed beside a read pointed at some other statement — measured, `turf.methodology`
 * came out as line 1306, where the file actually has `r.moisture.humidity`. Each removed line is
 * replaced by an empty one, so what is counted here is the line the file really has.
 */
const code = (file) => fs.readFileSync(path.join(ASSETS, file), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
    .replace(/^[ \t]*\/\/.*$/gm, '');

/**
 * Every path read off the site's config in one file, with one level of indirection resolved —
 * AND THE LINE IT IS READ ON.
 *
 * GH-760 (queue item 3vn): the red used to name the field and the file and stop there, so whoever
 * read it went looking through eight thousand lines by hand. The project's rule asks for the file
 * AND the line; the line is the one the match sits on, counted from the start of the file, and the
 * FIRST read of a path is the one carried — a path read twice is one subject, and the second
 * address would be noise in the failure.
 */
function configReadsIn(file) {
    const src = code(file);
    const found = new Map();
    const lineOf = (at) => src.slice(0, at).split('\n').length;
    const take = (chain, at) => {
        const p = chain.replace(/\s+/g, '').replace(/^\./, '');
        if (p && !found.has(p)) found.set(p, lineOf(at));
    };
    for (const m of src.matchAll(/gaipConfig((?:\s*\.\s*[A-Za-z_$][\w$]*)+)/g)) take(m[1], m.index);
    for (const m of src.matchAll(/(?:var|let|const)\s+([A-Za-z_$][\w$]*)\s*=\s*[^;\n]*gaipConfig[^;\n]*/g)) {
        const v = m[1].replace('$', '\\$');
        const re = new RegExp('(?<![\\w$.])' + v + '((?:\\s*\\.\\s*[A-Za-z_$][\\w$]*)+)', 'g');
        for (const r of src.matchAll(re)) take(r[1], r.index);
    }

    return [...found.keys()].sort().map((p) => ({ path: p, line: found.get(p) }));
}

/** Where the list declares a path, or nothing. */
function declaredAs(p) {
    const where = [];
    if (LIST.inputs[p]) where.push('input');
    if (LIST.derived[p]) where.push('derived');
    if (LIST.notInputs[p]) where.push('notInput');
    Object.entries(LIST.inputs).forEach(([k, v]) => {
        if (v && Array.isArray(v.readAs) && v.readAs.includes(p)) where.push('readAs of ' + k);
        /**
         * GH-779 — AND `storedAs` COUNTS, because a run may read a value where it is STORED.
         *
         * `readAs` is how a path is spelled in the run's own state; `storedAs` is where the value sits in the
         * site's config. The irrigation efficiency is read straight out of the config now -- the field of the
         * old hub's form that used to supply it had `75` hardcoded in its markup -- so the path the run reads
         * is the stored one. Both are declarations in the same list, by the same entry.
         */
        if (v && Array.isArray(v.storedAs) && v.storedAs.includes(p)) where.push('storedAs of ' + k);
    });

    return where;
}

describe('GH-725 — every config field the run reads is declared in the inputs list', () => {
    test('the scan finds the reads it is about, so an empty scan cannot pass', () => {
        const all = {};
        RUN_ASSEMBLY.forEach((f) => { all[f] = configReadsIn(f); });
        process.stdout.write('[gh725] config paths read by the run assembly:\n'
            + Object.entries(all).map(([f, ps]) => '[gh725]    ' + f + ': '
                + JSON.stringify(ps.map((r) => r.path + '@' + r.line))).join('\n') + '\n');

        const flat = Object.values(all).flat().map((r) => r.path);
        /**
         * GH-780: this named `pgr.enabled`, and that read is gone — the owner removed the PGR switch, and the
         * run asks the spray journal through the PGR engine instead. The control keeps its job with a read
         * that exists: `irrigation.efficiency`, which GH-779 moved off a form field of the old hub and into
         * the site's own config, and which is reached through a local variable exactly as the old one was.
         */
        expect(flat).toContain('irrigation.efficiency');
        expect(flat).toContain('turf.methodology');
        // The read that escaped the guards was written through a local variable; if the indirection
        // stopped being resolved this case would quietly cover less than it says.
        expect(configReadsIn('hub-tissue-v3.js').map((r) => r.path)).toContain('irrigation.efficiency');
    });

    test('and every field among them is declared — a section on its own is a container, not a field', () => {
        const rows = [];
        RUN_ASSEMBLY.forEach((file) => {
            configReadsIn(file).forEach(({ path: p, line }) => {
                if (!p.includes('.')) { rows.push({ file, p, line, kind: 'container', where: [] }); return; }
                rows.push({ file, p, line, kind: 'field', where: declaredAs(p) });
            });
        });
        process.stdout.write('[gh725] each read, and where the list declares it:\n'
            + rows.map((r) => '[gh725]    ' + ('assets/' + r.file + ':' + r.line + ' ' + r.p).padEnd(56)
                + (r.kind === 'container' ? 'a section reached into, not a field'
                    : (r.where.length ? r.where.join(', ') : 'NOT DECLARED'))).join('\n') + '\n');

        const undeclared = rows.filter((r) => r.kind === 'field' && !r.where.length)
            // GH-760: the address, not just the subject — `assets/<file>:<line>` is what a
            // person needs to open the place the red is about.
            .map((r) => r.p + ' <- assets/' + r.file + ':' + r.line);
        expect(rows.filter((r) => r.kind === 'field').length).toBeGreaterThan(2);
        expect(undeclared).toEqual([]);
    });

    test('the boundary is a number: how many config reads this case leaves outside', () => {
        const outside = {};
        fs.readdirSync(ASSETS).filter((f) => f.endsWith('.js') && !RUN_ASSEMBLY.includes(f)).forEach((f) => {
            const ps = configReadsIn(f).filter((r) => r.path.includes('.')).map((r) => r.path);
            if (ps.length) outside[f] = ps;
        });
        const count = Object.values(outside).reduce((a, ps) => a + ps.length, 0);
        process.stdout.write('[gh725] config field reads OUTSIDE the run assembly: ' + count
            + ' across ' + Object.keys(outside).length + ' files — the Settings form reading back what it'
            + ' saves, an interpretation panel, the weather override page. Not the run\'s inputs, and not'
            + ' judged here:\n'
            + Object.entries(outside).map(([f, ps]) => '[gh725]    ' + f + ': ' + JSON.stringify(ps)).join('\n') + '\n');

        // The boundary is real rather than rhetorical: there IS something outside, and it is counted.
        expect(count).toBeGreaterThan(0);
    });
});
