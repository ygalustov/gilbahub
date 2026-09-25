/**
 * GH-734 (queue item 3az, the order guard delivery 3 needs before it may remove the global) —
 * EVERY NAME THE SITE SWITCH CLEANS MUST EXIST IN THE CODE.
 *
 * WHY IT EXISTS, and it is my own failure rather than a general precaution. Delivery 3 removes
 * `GAIP_SOIL_TEMP`, and I told the coordinator twice that the order was held by a guard: that
 * `GH-606`'s census would redden if the cleanup entry went before the global. Measured: it does not.
 * Removing `['GAIP_SOIL_TEMP', null]` from the cleanup list while the global still exists leaves
 * `gh606` at six green — because delivery 1 had already taken that global out of the row's
 * construction, which is the only universe that census has. The protection was real when I named it
 * and my own first delivery removed it. So the order was resting on my carefulness, and a rule filled
 * by the author's carefulness is an appeal rather than a mechanism.
 *
 * WHAT IS HELD, one direction, and it is the one that leaves a permanently wrong tree: a name the
 * switch cleans that no code assigns. Remove a global and leave its cleanup entry, and this reddens
 * by name. The enforced order for delivery 3 is therefore: the entry goes FIRST, the global after —
 * and the reverse is impossible rather than discouraged.
 *
 * WHAT IS NOT HELD, named with the number that makes it a measurement rather than an excuse: the
 * other direction — a live per-site global that nothing cleans — has no derivable universe at this
 * cost. Measured: 193 globals of the `GAIP`/`__GAIP`/`Gaip` family are assigned in `assets`, 16 of
 * them are in the cleanup list, and nothing in a name separates a per-site result from a module
 * namespace or a product table. A hand-written list of the other 177 would be the blanket this
 * project rejects, so the gap is stated instead of papered over. `GH-606` holds the part of it that
 * matters for the stored row: a global the row is BUILT from and not cleaned is red there.
 */

'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const ASSETS = path.join(ROOT, 'assets');

/** The names the site switch cleans, out of the cleanup file's own list. */
function cleanedNames() {
    const src = fs.readFileSync(path.join(ASSETS, 'site-switch-cleanup.js'), 'utf8');
    const at = src.indexOf('const SITE_SCOPED_GLOBALS = [');
    if (at < 0) return { names: [], found: false };
    const end = src.indexOf('];', at);
    const body = src.slice(at, end);
    // Comment lines are dropped, so a name switched off with `//` is not counted as cleaned —
    // which is the shape `gh606` measured on this same file.
    const code = body.split('\n').filter((l) => !/^\s*\/\//.test(l)).join('\n');

    return { names: [...new Set([...code.matchAll(/\['([\w$]+)',/g)].map((m) => m[1]))].sort(), found: true };
}

/** Every global name the scripts assign, and where. */
function assignedGlobals() {
    const out = {};
    fs.readdirSync(ASSETS).filter((f) => f.endsWith('.js')).forEach((f) => {
        let src;
        try {
            src = fs.readFileSync(path.join(ASSETS, f), 'utf8');
        } catch (err) {
            if (err && err.code === 'ENOENT') return;   // GH-712: a file that vanished is not a crash
            throw err;
        }
        for (const m of src.matchAll(/\b(?:global|window|globalThis)\.([\w$]+)\s*=(?!=)/g)) {
            (out[m.group ? m.group(1) : m[1]] = out[m[1]] || []).push(f);
        }
        // `climateMetrics = …` and friends are assigned bare at top level in some files.
        for (const m of src.matchAll(/^\s*(?:var|let|const)?\s*([\w$]+)\s*=\s*(?!=)/gm)) {
            if (/^(climateMetrics|rawWeatherData)$/.test(m[1])) (out[m[1]] = out[m[1]] || []).push(f);
        }
    });

    return out;
}

describe('GH-734 — the cleanup list names only globals that exist', () => {
    const cleaned = cleanedNames();
    const assigned = assignedGlobals();

    test('POSITIVE CONTROL: both lists were found and are not empty', () => {
        process.stdout.write('\n[gh734/order] cleaned on a site switch: ' + cleaned.names.length
            + ' | globals assigned in assets: ' + Object.keys(assigned).length + '\n');
        expect(cleaned.found).toBe(true);
        expect(cleaned.names.length).toBeGreaterThan(10);
        expect(Object.keys(assigned).length).toBeGreaterThan(50);
        /**
         * AND THE GUARD CAN SEE AN ORPHAN AT ALL, shown by planting one in the parsed list rather
         * than by relying on what the tree happens to hold. The first version of this control
         * asserted that `GAIP_SOIL_TEMP` was still in the list -- true when it was written and false
         * an hour later, when the same delivery removed the entry. A control that depends on the
         * tree's current contents expires with them; this one does not.
         */
        const planted = cleaned.names.concat(['GAIP_A_NAME_NOTHING_ASSIGNS']);
        expect(planted.filter((n) => !assigned[n])).toEqual(['GAIP_A_NAME_NOTHING_ASSIGNS']);
    });

    test('a name the switch cleans that nothing assigns is named', () => {
        const orphans = cleaned.names.filter((n) => !assigned[n]);
        process.stdout.write('[gh734/order] cleaned but assigned nowhere: ' + JSON.stringify(orphans) + '\n');
        expect({ cleanedButAssignedNowhere: orphans }).toEqual({ cleanedButAssignedNowhere: [] });
    });

    test('THE BOUNDARY, as a number rather than a promise', () => {
        // The other direction is not held, and this prints the measurement that says why, so a
        // reader does not take the file for more than it is.
        const family = Object.keys(assigned).filter((n) => /^(GAIP|__GAIP|Gaip)/.test(n));
        const listed = family.filter((n) => cleaned.names.includes(n));
        process.stdout.write('[gh734/order] family assigned: ' + family.length
            + ' | of those cleaned: ' + listed.length
            + ' | not cleaned: ' + (family.length - listed.length)
            + ' — no derivable separator, so this direction is NOT held\n');
        expect(family.length).toBeGreaterThan(listed.length);
    });
});
