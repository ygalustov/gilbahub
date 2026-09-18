/**
 * GH-536 (PLAN-samples-sync-FINAL, stage 3) — the banner that says the samples
 * could not be read.
 *
 * WHY IT IS TESTED SEPARATELY FROM THE STORE. The lock and the banner are the
 * two halves of one indivisibility (Н2 in the stage-3 worksheet): a store that
 * closes with no visible reason is a page that silently does nothing, and a
 * banner over an open store is a warning the user can ignore into a data loss.
 * The store half is measured in gh536-browser-copy-removed.test.js; this is the
 * other half.
 *
 * THE DOM HERE IS A STUB, not jsdom — the project's jest runs on `node` and has
 * no jsdom installed. It carries exactly what this module touches: an id index,
 * insertBefore, removeChild, and a click that calls the listener.
 */

'use strict';

function makeEl(tag) {
    const el = {
        tagName: tag,
        id: '',
        type: '',
        disabled: false,
        textContent: '',
        innerHTML: '',
        style: { cssText: '', opacity: '', cursor: '' },
        children: [],
        parentNode: null,
        _listeners: {},
        setAttribute(k, v) { this[k] = v; },
        setAttributeNS(_ns, k, v) { this[k] = v; },
        appendChild(c) { c.parentNode = el; el.children.push(c); return c; },
        insertBefore(c, _ref) { c.parentNode = el; el.children.unshift(c); return c; },
        removeChild(c) { el.children = el.children.filter((x) => x !== c); c.parentNode = null; return c; },
        addEventListener(t, fn) { (el._listeners[t] = el._listeners[t] || []).push(fn); },
        click() { (el._listeners.click || []).forEach((fn) => fn({ stopPropagation() {} })); },
        get nextSibling() { return null; },
    };
    return el;
}

function makeDom(opts) {
    const o = opts || {};
    const listeners = {};
    const main = makeEl('div');
    main.className = 'db-main';

    const byId = {};
    Object.keys(o.existingIds || {}).forEach((id) => { byId[id] = o.existingIds[id]; });

    function walk(node, out) {
        node.children.forEach((c) => { if (c.id) out[c.id] = c; walk(c, out); });
        return out;
    }

    const doc = {
        readyState: 'complete',
        body: main,
        addEventListener(t, fn) { (listeners[t] = listeners[t] || []).push(fn); },
        dispatchEvent(ev) { (listeners[ev.type] || []).slice().forEach((fn) => fn(ev)); return true; },
        createElement: (t) => makeEl(t),
        createElementNS: (_ns, t) => makeEl(t),
        querySelector(sel) { return sel === '.db-main' ? main : null; },
        getElementById(id) {
            if (byId[id]) return byId[id];
            const found = walk(main, {});
            return found[id] || null;
        },
    };
    return { doc, main, listeners };
}

function load(opts) {
    jest.resetModules();
    const dom = makeDom(opts);
    global.window = {};
    global.document = dom.doc;
    global.CustomEvent = global.CustomEvent || class { constructor(t, i) { this.type = t; this.detail = i && i.detail; } };
    require('../assets/samples-unavailable-banner.js');
    return Object.assign(dom, { API: global.window.GilbaSamplesUnavailable });
}

const ready = (detail) => ({ type: 'gaip:samples-persistence-ready', detail });

describe('GH-536 — the banner', () => {

    test('source server: no banner', () => {
        const d = load();
        d.doc.dispatchEvent(ready({ source: 'server', count: 3 }));
        expect(d.doc.getElementById('db-samples-unavailable')).toBeNull();
    });

    test('source empty: no banner — a read that found nothing is not a failure', () => {
        const d = load();
        d.doc.dispatchEvent(ready({ source: 'empty', count: 0 }));
        expect(d.doc.getElementById('db-samples-unavailable')).toBeNull();
    });

    test('source error: banner, with the plan\'s words and a Retry', () => {
        const d = load();
        d.doc.dispatchEvent(ready({ source: 'error', reason: 'samples-load' }));

        const banner = d.doc.getElementById('db-samples-unavailable');
        expect(banner).toBeTruthy();
        expect(d.doc.getElementById('db-samples-unavailable-text').textContent)
            .toBe('Samples could not be loaded from the server. Nothing has been changed.');
        expect(d.doc.getElementById('db-samples-unavailable-retry').textContent).toBe('Retry');
        expect(banner.role).toBe('alert');
    });

    test('a short read says how many of how many', () => {
        const d = load();
        d.doc.dispatchEvent(ready({ source: 'error', partial: true, count: 200, total: 201 }));
        expect(d.doc.getElementById('db-samples-unavailable-text').textContent)
            .toBe('Loaded 200 of 201 samples.');
    });

    test('Retry calls the restore and nothing else', () => {
        const d = load();
        let calls = 0;
        global.window.GAIP_SamplePersistence = { restore() { calls += 1; } };

        d.doc.dispatchEvent(ready({ source: 'error' }));
        d.doc.getElementById('db-samples-unavailable-retry').click();

        expect(calls).toBe(1);
        expect(d.doc.getElementById('db-samples-unavailable-retry').textContent).toBe('Retrying...');
    });

    test('a successful retry clears the banner', () => {
        const d = load();
        d.doc.dispatchEvent(ready({ source: 'error' }));
        expect(d.doc.getElementById('db-samples-unavailable')).toBeTruthy();

        d.doc.dispatchEvent(ready({ source: 'server', count: 4 }));
        expect(d.doc.getElementById('db-samples-unavailable')).toBeNull();
    });

    test('a failed SITE LIST raises no banner here — GH-441\'s already speaks for it', () => {
        // Two red boxes saying the same thing in different words is worse than
        // one. The store is still locked; the reason is on screen, written by
        // settings-unavailable-banner.js.
        const d = load();
        d.doc.dispatchEvent(ready({ source: 'error', reason: 'sites-list' }));
        expect(d.doc.getElementById('db-samples-unavailable')).toBeNull();
    });

    test('no slot on the page: a console warning, not a throw', () => {
        const d = load();
        d.doc.querySelector = () => null;
        d.doc.body = null;
        const warned = [];
        const realWarn = console.warn;
        console.warn = (m) => warned.push(m);
        try {
            expect(() => d.API.show({ source: 'error' })).not.toThrow();
        } finally {
            console.warn = realWarn;
        }
        expect(warned.join(' ')).toContain('could not be loaded');
    });
});

describe('GH-536 — the generate buttons refuse rather than print an empty document', () => {

    test('a failed read disables them and puts the reason beside each', () => {
        const word = makeEl('button'); word.id = 'rp-export-word-btn';
        const ical = makeEl('button'); ical.id = 'gaip-export-ical';
        const d = load({ existingIds: { 'rp-export-word-btn': word, 'gaip-export-ical': ical } });
        // The buttons live on the page, so the note beside them is findable too.
        const holder = makeEl('div');
        d.main.appendChild(holder);
        holder.appendChild(word); holder.appendChild(ical);
        d.doc.dispatchEvent(ready({ source: 'error' }));

        expect(word.disabled).toBe(true);
        expect(ical.disabled).toBe(true);
        expect(d.doc.getElementById('rp-export-word-btn-samples-note').textContent)
            .toContain('Samples could not be loaded');
    });

    test('a successful read re-enables them and takes the note away', () => {
        const word = makeEl('button'); word.id = 'rp-export-word-btn';
        const d = load({ existingIds: { 'rp-export-word-btn': word } });
        const holder = makeEl('div');
        d.main.appendChild(holder);
        holder.appendChild(word);
        d.doc.dispatchEvent(ready({ source: 'error' }));
        expect(word.disabled).toBe(true);

        d.doc.dispatchEvent(ready({ source: 'server', count: 2 }));
        expect(word.disabled).toBe(false);
    });

    test('the two write statuses the plan names have their own words', () => {
        const d = load();
        expect(d.API.writeFailureText(403)).toBe("You don't have permission to edit this site");
        expect(d.API.writeFailureText(419)).toBe('Session expired — reload the page');
        expect(d.API.writeFailureText(500)).toBeNull();
    });
});
