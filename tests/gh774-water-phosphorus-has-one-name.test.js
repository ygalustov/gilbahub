/**
 * GH-774 — WATER PHOSPHORUS IS CALLED PHOSPHORUS, IN EVERY PLACE THAT NAMES IT.
 *
 * The owner's decision of 29.09.2026: the reading is `P`, phosphorus as the laboratory reports it.
 * The form field has said so since it was written -- "Phosphorus as reported by lab" -- while the key
 * beside it was `PO4` and three screens printed "Phosphate". Phosphate is a different quantity, and
 * the factor between them is in no formula here: SAR, RSC and LSI are computed from eight ions and
 * phosphorus is not among them. So the number was never wrong; the word over it was.
 *
 * FIVE PLACES NAME IT, and this file holds all five. A census rather than one assertion, because the
 * fault was exactly that one of them said something the others did not.
 *
 * AND THE KEYS ARE ASSERTED BESIDE THE WORDS. Renaming a label is safe only while the code still
 * reads the same keys: the screens take the value from `P` or `PO4`, the blender sums `PO4`, and six
 * of the nine water samples on the stand hold their phosphorus under `PO4` today. If a key moved with
 * a label, a screen would go blank rather than say a new word, so each case asserts both.
 */
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');

const SWITCHER = read('assets/sample-switcher-ui.js');
const BLENDER_UI = read('assets/water-blender-ui.js');
const BLENDER = read('assets/water-blender.js');
const DATA = read('app/resources/views/data.blade.php');

const WORD = 'Phosphorus (P)';

describe('GH-774 — the word over water phosphorus', () => {
    test('all five places that name it say the same thing, and the census prints them', () => {
        const places = [
            { where: 'assets/sample-switcher-ui.js', says: /PO4:\s*'([^']+)'/.exec(SWITCHER) },
            { where: 'assets/water-blender-ui.js', says: /PO4:\s*'([^']+)'/.exec(BLENDER_UI) },
            { where: 'assets/water-blender.js', says: /<span>([^<]*[Pp]hosph[^<]*)<\/span>/.exec(BLENDER) },
            // Anchored on the WATER row's own key list, not on the first phosphorus label in the
            // file: the soil tables name phosphorus too, and the first draft of this census read one
            // of them and reported the water screens as already right.
            { where: 'app/resources/views/data.blade.php (water list)',
                says: /keys:\['P','p','phosphate','Phosphate','PO4','phosphorus'\],\s*name:'([^']+)'/.exec(DATA) },
            { where: 'app/resources/views/data.blade.php (water table)',
                says: /keys:\['P','p','phosphate','Phosphate','PO4','phosphorus'\],\s*label:'([^']+)'/.exec(DATA) },
        ];
        places.forEach((p) => process.stdout.write('[gh774] ' + p.where + ' says '
            + JSON.stringify(p.says && p.says[1]) + '\n'));

        expect(places.map((p) => p.says && p.says[1])).toEqual([WORD, WORD, WORD, WORD, WORD]);
    });

    test('and no place still calls it phosphate', () => {
        const left = [];
        [['assets/sample-switcher-ui.js', SWITCHER], ['assets/water-blender-ui.js', BLENDER_UI],
            ['assets/water-blender.js', BLENDER], ['app/resources/views/data.blade.php', DATA]]
            .forEach(([where, src]) => {
                src.split('\n').forEach((line, i) => {
                    // The spellings a lab file may use are not labels: they stay, and they are why the
                    // six samples already stored under `PO4` keep being read.
                    // A LABEL, not a spelling: the map of spellings a lab file may use keeps
                    // `phosphate` and `Phosphate`, and that is why samples already stored under `PO4`
                    // go on being read. Only what a person sees is compared here.
                    if (/(name|label):'[^']*[Pp]hosphate|PO4:\s*'[^']*[Pp]hosphate|<span>[^<]*[Pp]hosphate/.test(line)) {
                        left.push(where + ':' + (i + 1) + ' ' + line.trim().slice(0, 80));
                    }
                });
            });
        left.forEach((l) => process.stdout.write('[gh774] still phosphate: ' + l + '\n'));

        expect(left).toEqual([]);
    });

    test('the keys the screens read are untouched, so no value moves with the word', () => {
        const keyLists = [...DATA.matchAll(/keys:\[([^\]]*'PO4'[^\]]*)\]/g)].map((m) => m[1]);
        process.stdout.write('[gh774] the key lists that mention PO4: ' + JSON.stringify(keyLists) + '\n');

        expect(keyLists.length).toBeGreaterThan(1);
        keyLists.forEach((list) => {
            expect(list).toContain("'P'");
            expect(list).toContain("'PO4'");
        });
        // The blender still sums the key it always summed, and the switcher still asks for it.
        expect(BLENDER).toContain('b.PO4.toFixed(1)');
        expect(/ionFields:\s*\[[^\]]*'PO4'/.test(BLENDER_UI)).toBe(true);
        expect(/'NO3',\s*'PO4'\]/.test(SWITCHER)).toBe(true);
    });
});
