/**
 * GH-818 (queue item "Zones") — THE DATA PAGE'S "ADD ZONE" SENDS ONE NAME, AND TAKES THE NAMES FROM THE ANSWER.
 *
 * The button sent the page's copy of the site's zone names plus the new one, and the server made a row for every
 * name in it: a zone deleted on the Zones tab while the Data page stood open came back, with no type. Now the
 * button sends the change -- `{ add_zone: name }` -- and the names the page offers afterwards are the zones the
 * server answers with, not the page's copy plus one.
 *
 * HOW IT IS RUN: the function is taken out of `data.blade.php` as it stands and executed with `fetch` and the
 * modal around it stubbed, as in `gh805-the-edit-window-sends-the-change`. The subject is what it sends and what
 * it keeps, not its source.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const BLADE = fs.readFileSync(path.join(__dirname, '../app/resources/views/data.blade.php'), 'utf8');

function theFunction() {
    const start = BLADE.indexOf('    function addZoneToSite(name) {');
    const end = BLADE.indexOf('    function wireModalBody() {');
    if (start === -1 || end === -1) throw new Error('addZoneToSite is not where it was in data.blade.php');
    return BLADE.slice(start, end);
}

function element() {
    return { value: '', textContent: '', disabled: false, options: [], appendChild(o) { this.options.push(o); } };
}

/** Runs the button with the page holding `held` and the server answering `answer`; resolves to what happened. */
async function pressAdd(held, name, answer) {
    const nodes = { 'dat-add-zone-btn': element(), 'dat-f-uid': element(), 'dat-new-zone-input': element() };
    const sent = [];
    const messages = [];
    const sandbox = {
        ZONE_NAMES: held.slice(), SITE_ID: 'site-under-test', CSRF: 't',
        document: { getElementById: (id) => nodes[id] || null, createElement: () => ({ value: '', textContent: '' }) },
        fetch: (url, init) => {
            sent.push({ url: url, method: init.method, body: JSON.parse(init.body) });
            return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(answer) });
        },
        setMsg: (text, kind) => messages.push([kind, text]),
        console: { log() {}, warn() {} },
    };
    sandbox.globalThis = sandbox;
    const ctx = vm.createContext(sandbox);
    vm.runInContext(theFunction(), ctx);
    vm.runInContext('addZoneToSite(' + JSON.stringify(name) + ')', ctx);
    for (let i = 0; i < 10; i++) await Promise.resolve();
    return {
        sent: sent,
        names: ctx.ZONE_NAMES,
        offered: nodes['dat-f-uid'].options.map((o) => o.value),
        chosen: nodes['dat-f-uid'].value,
        messages: messages,
    };
}

const zone = (name) => ({ id: 'z-' + name, name: name, zoneType: null });

describe('GH-818 — the Data page adds one zone', () => {
    test('the body is the one new name, and nothing of the page\'s list goes with it', async () => {
        const got = await pressAdd(['Green 1'], 'Green New', { data: { zones: [zone('Green 1'), zone('Green New')] } });
        process.stdout.write('[gh818] Add zone sends: ' + JSON.stringify(got.sent) + '\n');
        expect(got.sent).toEqual([{ url: '/api/sites/site-under-test', method: 'PATCH', body: { add_zone: 'Green New' } }]);
    });

    test('the names afterwards are the server\'s, not the page\'s copy plus one -- a zone deleted elsewhere does not stay', async () => {
        // The page still holds `Green X`, deleted on the Zones tab after it loaded; the server's answer does not.
        const got = await pressAdd(['Green 1', 'Green X'], 'Green New', { data: { zones: [zone('Green 1'), zone('Green New')] } });
        process.stdout.write('[gh818] after the answer: ' + JSON.stringify({ names: got.names, offered: got.offered, chosen: got.chosen, messages: got.messages }) + '\n');
        expect({ names: got.names, offered: got.offered, chosen: got.chosen, messages: got.messages })
            .toEqual({ names: ['Green 1', 'Green New'], offered: ['Green New'], chosen: 'Green New', messages: [] });
    });

    test('an answer without the zones is a failure said to the person, not the page\'s copy kept', async () => {
        const got = await pressAdd(['Green 1', 'Green X'], 'Green New', { data: {} });
        process.stdout.write('[gh818] an answer without zones: ' + JSON.stringify({ names: got.names, offered: got.offered, messages: got.messages }) + '\n');
        expect({ names: got.names, offered: got.offered, messages: got.messages })
            .toEqual({ names: ['Green 1', 'Green X'], offered: [], messages: [['err', 'Could not save zone: the server did not return the zones']] });
    });
});
