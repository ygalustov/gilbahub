/**
 * GH-804 (queue item "Zones", part 1) — A PAGE THAT WAS NOT TOLD WHETHER A TYPE IS REQUIRED DOES NOT
 * DECIDE THAT IT IS NOT.
 *
 * WHAT WAS THERE. The Zones tab read `D.zoneTypeField || { label: 'the zone type', required: false }`.
 * Two substitutions in one line: a word where a declaration is missing, and -- the one that costs
 * something -- "not required" where the answer is UNKNOWN. A page served without that field drew no
 * `Required` mark anywhere and let a person fill the tab in and press Save; only the server's refusal
 * would have told them, after the fact, that every zone needs a type.
 *
 * WHAT IS THERE NOW: the field or nothing, and when it is nothing the tab says so where the person is
 * looking. The obligation itself is declared once, in the inputs list (`calculation-inputs.schema.json`,
 * `zones.zoneType`), and the server answers for it on every render.
 *
 * HOW IT IS RUN. The tab's own block is taken out of `settings-init.js` and run as it stands, with the
 * page around it stubbed down to what it touches -- the convention of the other offline cases for that
 * file, which read its source rather than loading the whole page. Here the behaviour is the subject, so
 * the block is executed and what it draws is read back.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const SRC = fs.readFileSync(path.join(__dirname, '../assets/settings-init.js'), 'utf8');

function zonesBlock() {
    const start = SRC.indexOf('    /* ── Zones ─');
    const end = SRC.indexOf('    /* ── Sensor integrations');
    if (start === -1 || end === -1) throw new Error('the Zones block moved in settings-init.js');

    /**
     * `var zones = …` stands above the block, where the page reads `STG_DATA` once, and the block uses
     * it. The line is taken FROM THE FILE rather than written out here: a copy of it in a test is a
     * second reading of the server's answer, which is the very thing this case is about.
     */
    const declaration = SRC.match(/^ {4}var zones .*$/m);
    if (!declaration) throw new Error('settings-init.js no longer declares `zones` from STG_DATA');

    return declaration[0] + '\n' + SRC.slice(start, end);
}

/** An element stub that remembers what was written into it. */
function element(id) {
    return {
        id: id, innerHTML: '', textContent: '', className: '', hidden: true, value: '',
        style: {}, dataset: {}, children: [],
        appendChild(child) { this.children.push(child); },
        removeChild() {}, setAttribute() {}, getAttribute: () => null,
        addEventListener() {}, querySelector: () => null, querySelectorAll: () => [],
        classList: { add() {}, remove() {} }, focus() {}, click() {},
    };
}

/** Runs the tab's block with this `STG_DATA` and returns what it drew. */
function drawTheTab(data) {
    const nodes = {};
    ['stg-zone-list', 'stg-zone-input', 'stg-zone-type-input', 'stg-zone-add-btn',
        'stg-zones-save', 'stg-zones-msg', 'stg-zones-form'].forEach((id) => { nodes[id] = element(id); });

    const sandbox = {
        D: data,
        siteId: 'site-under-test',
        document: {
            getElementById: (id) => nodes[id] || null,
            createElement: (tag) => element(tag),
            addEventListener() {},
        },
        // The helpers the block closes over in the real file, behaving as they do there.
        setMsg: (el, text, type) => { if (el) { el.textContent = text; el.hidden = !text; el.className = type; } },
        setSaving() {}, markDirty() {}, _checkAfterSave() {},
        apiFetch: () => Promise.resolve({}),
        console: { log() {}, warn() {} },
    };
    sandbox.window = sandbox;
    sandbox.global = sandbox;
    sandbox.globalThis = sandbox;
    vm.runInContext('(function(){' + zonesBlock() + '})()', vm.createContext(sandbox));

    return {
        drawn: nodes['stg-zone-list'].children.map((c) => c.innerHTML).join('\n')
            + nodes['stg-zone-list'].innerHTML,
        message: nodes['stg-zones-msg'].textContent,
        messageShown: !nodes['stg-zones-msg'].hidden,
    };
}

const ONE_UNTYPED_ZONE = [{ id: 'z1', name: 'Green 1', zoneType: null, zoneTypeLabel: null }];
const TYPES = [{ id: 'green', label: 'Green' }, { id: 'other', label: 'Other' }];

describe('GH-804 — the Zones tab and the obligation it was told about', () => {
    test('told that a type is required, it marks every zone that has none', () => {
        const drawn = drawTheTab({
            zones: ONE_UNTYPED_ZONE, zoneTypes: TYPES,
            zoneTypeField: { label: 'the zone type', required: true, place: 'Settings -> Zones' },
        });
        process.stdout.write('[gh804] told it is required: ' + JSON.stringify({
            marked: /gilba-required-note/.test(drawn.drawn), message: drawn.message }) + '\n');

        expect(drawn.drawn).toMatch(/gilba-required-note/);
        expect(drawn.drawn).toMatch(/Required/);
        // Nothing to say: the page knows the answer and shows it in the rows.
        expect(drawn.messageShown).toBe(false);
    });

    test('NOT told at all, it says so and marks nothing', () => {
        const drawn = drawTheTab({ zones: ONE_UNTYPED_ZONE, zoneTypes: TYPES });
        process.stdout.write('[gh804] not told: ' + JSON.stringify({
            marked: /gilba-required-note/.test(drawn.drawn),
            message: drawn.message, shown: drawn.messageShown }) + '\n');

        // The sentence a person reads, where they are looking.
        expect(drawn.messageShown).toBe(true);
        expect(drawn.message).toBe('The server did not say whether a zone type is required. Reload the page.');
        // And no mark either way: an unknown obligation is not drawn as an absent one...
        expect(drawn.drawn).not.toMatch(/gilba-required-note/);
        // ...and the rows are still drawn, with their selects, so the tab is not blank.
        expect(drawn.drawn).toMatch(/stg-zone-type/);
        expect(drawn.drawn).toMatch(/Green 1/);
    });

    test('told that it is NOT required here, it marks nothing and says nothing', () => {
        const drawn = drawTheTab({
            zones: ONE_UNTYPED_ZONE, zoneTypes: TYPES,
            zoneTypeField: { label: 'the zone type', required: false, place: 'Settings -> Zones' },
        });
        process.stdout.write('[gh804] told it is not required: ' + JSON.stringify({
            marked: /gilba-required-note/.test(drawn.drawn), shown: drawn.messageShown }) + '\n');

        expect(drawn.drawn).not.toMatch(/gilba-required-note/);
        expect(drawn.messageShown).toBe(false);
    });
});
