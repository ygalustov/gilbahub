/**
 * GH-433 — the Nutrient Delivery Summary legend exists once.
 *
 * THE DEFECT. nutrition-prebble-integration.js and
 * nutrition-au-fertiliser-integration.js each registered the glossary key
 * 'prebble-nutrient-delivery-summary' with
 * `window.GAIP_GLOSSARY = Object.assign(window.GAIP_GLOSSARY || {}, { ... })`.
 * The Australian file carried a comment stating the duplicate was harmless
 * because the two were "byte-identical twins". Object.assign REPLACES a key
 * rather than merging into it, so that only held while the bodies matched.
 * GH-415 changed the meaning of Required above the sufficiency ceiling and
 * rewrote the New Zealand copy alone; the Australian file is loaded second in
 * every blade that loads either, so from then on the popover said
 *
 *     "Required — Removal + Lift; 0 once soil >= ceiling."
 *
 * on EVERY page, New Zealand included, directly above the non-zero Required
 * figures GH-415 had just introduced. The legend contradicted the table it
 * explained, which is the exact defect GH-415 existed to close.
 *
 * WHAT THESE PIN.
 *   1. The entry is registered by nutrient-balance-status.js, the module that
 *      computes the quantities the legend describes, and says what GH-415 says.
 *   2. Neither integration registers that key any more, so there is no twin to
 *      drift. This is the assertion that fails if someone pastes a copy back.
 *   3. Every blade that loads an integration loads nutrient-balance-status.js
 *      BEFORE it — the load-order precondition that makes one registration
 *      enough.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ASSETS = path.join(__dirname, '../assets');
const VIEWS = path.join(__dirname, '../app/resources/views');

const KEY = 'prebble-nutrient-delivery-summary';
const GH415_SENTENCE = 'above the ceiling, only what keeps the';
const STALE_SENTENCE = '0 once soil ≥ ceiling';

function loadBalanceStatusInVm() {
    const src = fs.readFileSync(path.join(ASSETS, 'nutrient-balance-status.js'), 'utf8');
    const win = {};
    const sandbox = { window: win, module: undefined, console: console };
    sandbox.globalThis = sandbox;
    vm.createContext(sandbox);
    vm.runInContext(src, sandbox);
    return win;
}

describe('GH-433 — one owner for the legend', () => {
    test('nutrient-balance-status.js registers it, and it says what GH-415 says', () => {
        const win = loadBalanceStatusInVm();
        expect(win.GAIP_GLOSSARY).toBeDefined();
        const entry = win.GAIP_GLOSSARY[KEY];
        expect(entry).toBeDefined();
        expect(entry.title).toBe('Nutrient Delivery Summary');
        expect(entry.body).toContain(GH415_SENTENCE);
        expect(entry.body).not.toContain(STALE_SENTENCE);
        // The module also publishes it, so a caller can read the entry without
        // going through the global.
        expect(win.GAIP_NutrientBalanceStatus.GLOSSARY_KEY).toBe(KEY);
        expect(win.GAIP_NutrientBalanceStatus.GLOSSARY_ENTRY.body).toBe(entry.body);
    });

    test('no other asset registers that key — there is no twin left to drift', () => {
        const offenders = [];
        fs.readdirSync(ASSETS).forEach((name) => {
            if (!/\.js$/.test(name) || name === 'nutrient-balance-status.js') return;
            const src = fs.readFileSync(path.join(ASSETS, name), 'utf8');
            // A mention in a comment is fine; an assignment into GAIP_GLOSSARY
            // carrying the key is what puts a second body in play.
            src.split('\n').forEach((line, i) => {
                if (/^\s*(\/\/|\*|\/\*)/.test(line)) return;
                if (line.indexOf(KEY) === -1) return;
                if (/GAIP_GLOSSARY/.test(src.slice(Math.max(0, src.indexOf(line) - 400), src.indexOf(line)))) {
                    offenders.push(name + ':' + (i + 1) + ' ' + line.trim().slice(0, 80));
                }
            });
        });
        expect(offenders).toEqual([]);
    });

    test('the two files that used to own it still read the summary they describe', () => {
        // Guards against "deleted the duplicate and the panel with it": both
        // panels must still render the table and its info button.
        ['nutrition-prebble-integration.js', 'nutrition-au-fertiliser-integration.js'].forEach((f) => {
            const src = fs.readFileSync(path.join(ASSETS, f), 'utf8');
            expect(src).toContain('data-info="' + KEY + '"');
            expect(src).toMatch(/GAIP_NutrientBalanceStatus/);
        });
    });

    test('every view that loads an integration loads the owner first', () => {
        // Position of the LOADED file, not of any mention: plan.blade.php's
        // comment above the owner's own tag names the panel ("Must load before
        // nutrition-prebble-integration.js"), so a plain indexOf reports the
        // order backwards. Both spellings a view can use are matched -- the
        // direct tag and the $hubScripts array the reports and the old hub
        // build their tags from.
        const loadedAt = (src, file) => {
            const re = new RegExp("'" + file.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + "'", 'g');
            const m = re.exec(src);
            return m ? m.index : -1;
        };
        const checked = [];
        (function walk(dir) {
            fs.readdirSync(dir, { withFileTypes: true }).forEach((e) => {
                const full = path.join(dir, e.name);
                if (e.isDirectory()) return walk(full);
                if (!/\.blade\.php$/.test(e.name)) return;
                const src = fs.readFileSync(full, 'utf8');
                const owner = loadedAt(src, 'nutrient-balance-status.js');
                ['nutrition-prebble-integration.js', 'nutrition-au-fertiliser-integration.js',
                 'nutrition-uk-fertiliser-integration.js'].forEach((panel) => {
                    const at = loadedAt(src, panel);
                    if (at === -1) return;
                    checked.push(e.name + ' / ' + panel + ' (owner@' + owner + ', panel@' + at + ')');
                    expect(owner).toBeGreaterThan(-1);
                    expect(owner).toBeLessThan(at);
                });
            });
        })(VIEWS);
        // If this list is empty the assertions above ran on nothing.
        expect(checked.length).toBeGreaterThan(0);
        process.stdout.write('[gh433] load order checked:\n      ' + checked.join('\n      ') + '\n');
    });
});
