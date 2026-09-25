/**
 * GH-768 (queue item 3vm) — THE AMMONIUM ACETATE RANGES HAVE ONE FILE, AND IT CARRIES WHAT THE
 * ENGINE CARRIES.
 *
 * The server's AA table held five nutrients of ten, so Fe, Mn, Zn, Cu and B on an AA site were
 * judged by MLSN's single thresholds instead — a second copy of the engine's literal, copied in
 * part. The ten move to `assets/aa-ranges.json`, read by the server alone (`App\Support\AaRanges`).
 *
 * THIS FILE IS THE TRANSFER'S INSURANCE, and it is needed precisely because the copy stays: the
 * engine keeps its literal until the run itself is moved off the browser, which is a separate
 * decision of the owner's. So the two are held equal here, by both soil types and all ten
 * nutrients, and the certificate's own list is read out of the engine rather than retyped.
 *
 * The literal is EXECUTED, not parsed: the engine chooses between two objects by soil texture, and
 * a reader that only matched braces would compare one of the two branches against both.
 */
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const HUB = fs.readFileSync(path.join(ROOT, 'assets', 'hub-tissue-v3.js'), 'utf8');
const FILE = path.join(ROOT, 'assets', 'aa-ranges.json');

/** The expression that follows `const <name> =` in the engine, up to its own semicolon. */
function literal(name) {
    const head = 'const ' + name + ' =';
    const at = HUB.indexOf(head);
    expect(at).toBeGreaterThan(-1);
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

const engineRanges = (aaSoilTexture) =>
    new Function('aaSoilTexture', 'return (' + literal('aaRanges') + ');')(aaSoilTexture);

describe('GH-768 — the AA ranges have one file', () => {
    test('the file carries what the engine literal carries, both soil types and all ten nutrients', () => {
        expect(fs.existsSync(FILE)).toBe(true);
        const file = JSON.parse(fs.readFileSync(FILE, 'utf8'));
        const got = {};
        ['sands', 'others'].forEach((t) => {
            got[t] = { engine: engineRanges(t), file: file.bySoilType && file.bySoilType[t] };
        });
        process.stdout.write('[gh768] AA ranges, engine literal vs file: ' + JSON.stringify(got) + '\n');

        expect(Object.keys(file.bySoilType).sort()).toEqual(['others', 'sands']);
        // The NAMES, not their number: ten of the wrong ten would count the same.
        ['sands', 'others'].forEach((t) => {
            expect(Object.keys(got[t].file).sort()).toEqual(Object.keys(got[t].engine).sort());
            expect(got[t].file).toEqual(got[t].engine);
        });
    });

    /**
     * The certificate overlay is five of the ten in the engine, by an explicit list. The server now
     * judges all ten, so if it overlaid everything the certificate answered for, a certificate
     * carrying Fe would part the two without anyone editing either side. The list travels in the
     * file, and it is compared with the engine's own.
     */
    test('the file names the same five the certificate may override', () => {
        const file = JSON.parse(fs.readFileSync(FILE, 'utf8'));
        const m = /\[((?:\s*"[A-Za-z]+"\s*,?)+)\]\.forEach\(\(nut\) => \{\s*const certRange = _hlst\.getRangesPpm\(aaSampleTypeCode/
            .exec(HUB);
        expect(m).not.toBeNull();
        const inEngine = JSON.parse('[' + m[1] + ']');
        process.stdout.write('[gh768] certificate may override, engine ' + JSON.stringify(inEngine)
            + ' | file ' + JSON.stringify(file.certificateOverridable) + '\n');

        expect(file.certificateOverridable).toEqual(inEngine);
    });
});
