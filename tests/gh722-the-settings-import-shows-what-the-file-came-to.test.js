/**
 * GH-722 (delivery 3) — THE SETTINGS IMPORT SHOWS WHAT THE FILE CAME TO, BY ITS CLASS,
 * AND TOUCHES NOTHING BEFORE THE SERVER HAS ANSWERED.
 *
 * The server decides the class and the numbers (`SampleUploadOutcome`, held by
 * `Gh722SettingsImportTest`). This holds the page to what it does with them, by running the real
 * `settings-init.js` on a stub page: the file is chosen, Import is pressed, and the server answers
 * `saved`, `partial` or a refusal.
 *   - `partial` is never drawn as a success: no check mark, the warning style;
 *   - a refusal leaves the browser's conveniences for the site in place — the server cleared
 *     nothing, and this page used to clear its own copies BEFORE it sent the request.
 * The sentences are the server's and are compared only as "the page printed what it was given".
 */

'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const SRC = fs.readFileSync(path.join(__dirname, '..', 'assets', 'settings-init.js'), 'utf8');
const BUNDLE = {
    version: 1, site: { label: 'Old portal site' },
    samples: { allSites: { old: { soil: { g1: { label: 'Green 1', rawData: { K: 120 } } } } } },
};

function element(id) {
    const classes = new Set(id === 'imp-step-preview' || id === 'imp-step-done' ? ['stg-hidden'] : []);
    const handlers = {};
    return {
        id, innerHTML: '', textContent: '', value: '', hidden: false, disabled: false, style: {}, dataset: {},
        files: id === 'imp-file-input' ? [{ name: 'site.json' }] : null,
        className: '',
        classList: {
            add: (c) => classes.add(c), remove: (c) => classes.delete(c), contains: (c) => classes.has(c),
            toggle: (c, on) => { if (on === undefined ? !classes.has(c) : on) classes.add(c); else classes.delete(c); },
        },
        addEventListener: (t, f) => { (handlers[t] = handlers[t] || []).push(f); },
        fire: (t) => (handlers[t] || []).forEach((f) => f({ preventDefault() {}, target: {} })),
        appendChild() {}, removeChild() {}, setAttribute() {}, querySelector: () => null, querySelectorAll: () => [],
    };
}

function page(answer) {
    const ids = new Map();
    const get = (id) => {
        if (!/^imp-/.test(id)) return null;
        if (!ids.has(id)) ids.set(id, element(id));
        return ids.get(id);
    };
    const storage = { removed: [], set: [] };
    const requests = [];
    const sandbox = {
        console: { log() {}, warn() {}, error() {}, info() {} },
        setTimeout: () => 0, clearTimeout() {}, setInterval: () => 0, clearInterval() {},
        JSON, Object, Array, String, Number, Math, Date, RegExp, Error, Promise, encodeURIComponent,
        STG_DATA: { activeSiteId: 'site-1', apiBase: '/api', csrfToken: 't', zones: [] },
        localStorage: {
            getItem: () => null,
            setItem: (k) => storage.set.push(k),
            removeItem: (k) => storage.removed.push(k),
        },
        FileReader: class { readAsText() { this.onload({ target: { result: JSON.stringify(BUNDLE) } }); } },
        fetch: (url, opts) => {
            requests.push(opts.method + ' ' + url);
            if (/\/samples\/sync$/.test(url)) {
                return Promise.resolve({ ok: answer.status === 200, status: answer.status, json: () => Promise.resolve(answer.body) });
            }
            return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({}) });
        },
        location: { href: '/settings', search: '' },
        addEventListener() {},
    };
    sandbox.document = {
        getElementById: get,
        querySelector: () => null, querySelectorAll: () => [],
        createElement: () => element('created'),
        addEventListener() {}, body: element('body'),
    };
    sandbox.window = sandbox;
    vm.runInContext(SRC, vm.createContext(sandbox), { filename: 'settings-init.js' });

    return { get, storage, requests };
}

async function importWith(answer) {
    const p = page(answer);
    p.get('imp-file-input').fire('change');
    p.get('imp-run-btn').fire('click');
    for (let i = 0; i < 20; i++) await Promise.resolve();

    return p;
}

const SVG = /<svg/;

describe('GH-722 — the Settings import shows what the file came to, and clears nothing before the answer', () => {
    test('saved: drawn as a success, with the server\'s sentence', async () => {
        const p = await importWith({ status: 200, body: { data: { synced: 2, outcome: { outcome: 'saved', rowsRead: 2, rowsSaved: 2, notSaved: [], message: '2 of 2 samples uploaded.' } } } });
        const box = p.get('imp-success-msg');
        process.stdout.write('[gh722] saved -> ' + JSON.stringify({ html: box.innerHTML.slice(0, 120), partial: box.classList.contains('partial') }) + '\n');
        expect(p.requests).toContain('POST /api/samples/sync');
        expect(box.innerHTML).toMatch('2 of 2 samples uploaded.');
        expect(box.innerHTML).toMatch(SVG);
        expect(box.classList.contains('partial')).toBe(false);
    });

    test('partial: never drawn as a success — no check mark, the warning style', async () => {
        const p = await importWith({ status: 200, body: { data: { synced: 1, outcome: { outcome: 'partial', rowsRead: 2, rowsSaved: 1, notSaved: [{ type: 'soil', label: 'Green 2', reason: 'no-reading-recognised' }], message: '1 of 2 samples uploaded. Not uploaded, no readings recognised: Green 2.' } } } });
        const box = p.get('imp-success-msg');
        process.stdout.write('[gh722] partial -> ' + JSON.stringify({ html: box.innerHTML.slice(0, 120), partial: box.classList.contains('partial') }) + '\n');
        expect(box.innerHTML).toMatch('1 of 2 samples uploaded.');
        expect(box.innerHTML).not.toMatch(SVG);
        expect(box.classList.contains('partial')).toBe(true);
    });

    test('refused: the server\'s sentence is printed and nothing the page holds for the site is cleared', async () => {
        const message = 'Invalid file format. The file was not uploaded. Please check the file format and try again. No readings were recognised in any of the 1 sample in the file.';
        const p = await importWith({ status: 422, body: { outcome: 'rejected', rowsRead: 1, rowsSaved: 0, message } });
        process.stdout.write('[gh722] refused -> ' + JSON.stringify({ msg: p.get('imp-msg').textContent, removed: p.storage.removed, set: p.storage.set }) + '\n');
        expect(p.requests).toContain('POST /api/samples/sync');
        expect(p.get('imp-msg').textContent).toMatch(message);
        expect(p.get('imp-success-msg').innerHTML).toBe('');
        expect({ removed: p.storage.removed, set: p.storage.set }).toEqual({ removed: [], set: [] });
    });

    test('and after a real answer the conveniences are cleared, so the refusal case is not vacuous', async () => {
        const p = await importWith({ status: 200, body: { data: { synced: 1, outcome: { outcome: 'saved', rowsRead: 1, rowsSaved: 1, notSaved: [], message: '1 of 1 sample uploaded.' } } } });
        expect(p.storage.removed).toContain('gilba_last_pgr_site-1');
    });
});
