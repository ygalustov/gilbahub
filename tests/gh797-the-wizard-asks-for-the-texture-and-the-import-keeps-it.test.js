/**
 * GH-797 (queue item 3ashch, stages 2 and 3) — THE SOIL TEXTURE IS ASKED FOR WHERE A SITE IS MADE,
 * AND NO WRITE TAKES IT AWAY BEHIND ANYBODY'S BACK.
 *
 * The owner made the field required on 01.10.2026: "if a field is required for us, then it is
 * required. Let's add it in the wizard too. And in the settings this field should be required as
 * well." Three browser-side consequences, one case each:
 *
 *   - the setup wizard asks for it on step 3 and sends it as its own request, because the list keeps
 *     it in a column of `sites` and not in the config;
 *   - the Settings Turf tab sends the column FIRST and the config only if that was accepted, or a
 *     refusal over the texture would arrive with half the tab already saved;
 *   - the import no longer clears it. It used to send `soil_texture_override: null` because the
 *     bundle carries no texture, and with the field required that write is refused -- with the
 *     samples already replaced. The owner's answer: "then if the import fails now, okay, then during
 *     an import just do not delete that field for now."
 *
 * WHAT THESE CASES DO NOT DO: they say nothing about the server's own refusal, which is held by
 * `Gh797TheTextureIsHeldByTheSiteRowTest`. Here the subject is what the browser SENDS.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const { wizardSandbox } = require('./lib/wizard-sandbox');

const ASSETS = path.join(__dirname, '..', 'assets');
const SCHEMA = JSON.parse(fs.readFileSync(path.join(ASSETS, 'calculation-inputs.schema.json'), 'utf8'));
const TEXTURE = 'sites.soil_texture_override';

/** The six the list declares, which is where both surfaces read them from. */
const textureValues = () => Object.entries(SCHEMA.inputs[TEXTURE].values || {})
    .map(([id, v]) => ({ id, label: v.label }));

/** The steps the server derives from the list, for the type a draft holds. */
const byStepFromTheList = (turfType) => {
    const byStep = {};
    Object.entries(SCHEMA.inputs).forEach(([key, entry]) => {
        const required = entry.required === true
            || (Array.isArray(entry.requiredFor) && entry.requiredFor.indexOf(turfType) !== -1);
        if (!required) return;
        (entry.filledIn || []).forEach((place) => {
            const m = /^wizard\.step(\d+)$/.exec(place);
            if (m) (byStep[Number(m[1])] = byStep[Number(m[1])] || []).push(key);
        });
        const branch = ((entry.byTurfType || {})[turfType] || {}).wizard;
        if (branch && typeof branch.step === 'number') {
            (byStep[branch.step] = byStep[branch.step] || []).push(key);
        }
    });

    return byStep;
};

const openWizard = (draft, answers) => {
    const byStep = byStepFromTheList(String((answers || {})['turf.turfType'] || ''));
    const missing = [];
    [].concat(...Object.values(byStep)).forEach((k) => {
        if ((!answers || !(k in answers)) && missing.indexOf(k) === -1) missing.push(k);
    });
    const box = wizardSandbox({ hubConfig: {
        setup: {
            missing,
            byStepByTurfType: { '': byStep, sports: byStep, golf: byStep, lawns: byStep },
            answers: answers || {},
            constructionValues: [{ id: 'sand_profile', label: 'Sand profile (USGA-style)' }],
            soilTextureValues: textureValues(),
        },
        savedLocation: { name: 'Somewhere', lat: -37.8, lon: 144.9 },
    } });
    const W = box.ctx.GilbaWizard;
    W._render = () => {};
    Object.assign(W.d, draft || {});

    return { W, box };
};

describe('GH-797 — the wizard asks for the soil texture', () => {
    test('step 3 draws the six the LIST declares, bound to the input by name', () => {
        const { W } = openWizard({ turfType: 'sports', species: 'Perennial Ryegrass' });
        const box = { innerHTML: '', querySelector: () => null, querySelectorAll: () => [] };
        W._step3_Species(box);

        const ids = (box.innerHTML.match(/<option value="([^"]*)"[^>]*>/g) || []);
        process.stdout.write('[gh797] the list declares: ' + JSON.stringify(textureValues().map((v) => v.id))
            + '\n[gh797] step 3 carries a texture select: ' + /id="wiz-soil-texture"/.test(box.innerHTML)
            + ' with data-input=' + /data-input="sites\.soil_texture_override"/.test(box.innerHTML) + '\n');

        expect(box.innerHTML).toMatch(/id="wiz-soil-texture"/);
        expect(box.innerHTML).toMatch(/data-input="sites\.soil_texture_override"/);
        // Every declared value is offered, and the labels are the list's own words.
        textureValues().forEach((v) => {
            expect(box.innerHTML).toContain('<option value="' + v.id + '"');
            expect(box.innerHTML).toContain(v.label.replace(/&/g, '&amp;'));
        });
        // And it opens on nothing chosen, like the cultivar and the construction beside it.
        expect(box.innerHTML).toMatch(/— Select soil texture —/);
        expect(ids.length).toBeGreaterThan(6);
    });

    test('the step does not let you pass without it, and does with it', () => {
        const answered = {
            'location.lat': -37.8, 'location.lon': 144.9, 'turf.turfType': 'sports',
            'turf.species': 'Perennial Ryegrass', 'turf.variety': 'generic',
            'turf.construction': 'sand_profile', 'turf.methodology': 'slan',
            'traffic.schedule': { matchesPerWeek: 0, sessionsPerWeek: 0 },
        };
        const without = openWizard(null, answered);
        without.W.step = 3;
        const withIt = openWizard(null, Object.assign({}, answered, { [TEXTURE]: 'sand' }));
        withIt.W.step = 3;

        process.stdout.write('[gh797] step 3 may proceed without the texture: ' + without.W._canProceed()
            + ' | names: ' + JSON.stringify(without.W._missingOfStep(3))
            + ' | with it: ' + withIt.W._canProceed() + '\n');

        expect(without.W._canProceed()).toBe(false);
        expect(without.W._missingOfStep(3)).toContain(TEXTURE);
        expect(withIt.W._canProceed()).toBe(true);
    });

    /**
     * GH-797 (the reviewer's return, point 2) — THE PATH FROM THE PERSON'S CHOICE TO THE DRAFT.
     *
     * Every other case here puts the answer into the draft itself (`openWizard({ … soilTexture: … })`)
     * or hands it in as the server's answers, so not one of them touches the listener that turns a
     * choice into a draft field. His mutation M11 — `self.d.soilTexture = null` in the step's own change
     * handler — left the whole set green on both sides: the field is drawn, a person picks `Sand`, the
     * wizard finishes, and NOTHING reaches the column, so the lock closes the site again. That is the
     * defect this item exists against, and it would have shipped under a green set.
     *
     * So this case does what the browser does: it finds the control the step drew, fires the `change`
     * event the step is listening for, and then reads the draft and the request. The listener is wired
     * by `_step3_Species` through `document.getElementById`, so the document has to answer with the
     * control the step drew — which the shared sandbox deliberately does not do (its `getElementById`
     * answers null for everything). That one method is replaced here, and nothing else.
     */
    test('a change on the step\'s own control reaches the draft, and then the request', async () => {
        const { W, box } = openWizard({
            turfType: 'sports', species: 'Perennial Ryegrass', variety: 'generic',
            construction: 'sand_profile', methodology: 'slan', location: null,
        });

        // The controls the step draws, found by id the way the step finds them.
        const controls = {};
        box.ctx.document.getElementById = (id) => controls[id] || null;
        ['wiz-variety', 'wiz-construction', 'wiz-soil-texture', 'wiz-species'].forEach((id) => {
            const el = { id, value: '', listeners: [], addEventListener(t, fn) { this.listeners.push({ t, fn }); } };
            controls[id] = el;
        });

        const host = { innerHTML: '', querySelector: () => null, querySelectorAll: () => [] };
        W._step3_Species(host);

        const control = controls['wiz-soil-texture'];
        const wired = control.listeners.map((l) => l.t);
        process.stdout.write('[gh797] the step wired these events on its texture control: '
            + JSON.stringify(wired) + '\n[gh797] the draft before the change: '
            + JSON.stringify(W.d.soilTexture) + '\n');

        // A person picks Clay Loam: the value lands on the control and the control fires `change`.
        expect(wired).toContain('change');
        control.value = 'clay_loam';
        control.listeners.filter((l) => l.t === 'change')
            .forEach((l) => l.fn.call(control, { type: 'change' }));

        process.stdout.write('[gh797] the draft after the change: ' + JSON.stringify(W.d.soilTexture) + '\n');
        expect(W.d.soilTexture).toBe('clay_loam');

        // And it travels: the same choice, through the wizard's own save, to the site route.
        await W._save();
        const siteWrites = box.sent.filter((r) => /\/api\/sites\/site-1$/.test(r.url));
        process.stdout.write('[gh797] what the choice became on the wire: '
            + JSON.stringify(siteWrites.map((r) => r.method + ' ' + JSON.stringify(r.body))) + '\n');
        expect(siteWrites.map((r) => r.method + ' ' + JSON.stringify(r.body)))
            .toEqual(['PATCH {"soil_texture_override":"clay_loam"}']);

        // The neighbours are wired by the same loop, so a change that broke one of them would be
        // caught by its own case rather than by this one: named, not assumed.
        expect(controls['wiz-construction'].listeners.map((l) => l.t)).toContain('change');
    });

    test('_save sends the chosen texture as its own request to the site route', async () => {
        const { W, box } = openWizard({
            turfType: 'sports', species: 'Perennial Ryegrass', variety: 'generic',
            construction: 'sand_profile', methodology: 'slan', soilTexture: 'loamy_sand',
            location: null,
        });
        await W._save();

        const siteWrites = box.sent.filter((r) => /\/api\/sites\/site-1$/.test(r.url));
        process.stdout.write('[gh797] what _save sent: '
            + JSON.stringify(box.sent.map((r) => r.method + ' ' + r.url + ' ' + JSON.stringify(r.body))) + '\n');

        // The LIST, not its length: what was sent to the site route, whole.
        expect(siteWrites.map((r) => r.method + ' ' + JSON.stringify(r.body)))
            .toEqual(['PATCH {"soil_texture_override":"loamy_sand"}']);
        // A draft with no location sends no location request at all, which is why the texture is not
        // attached to one.
        expect(box.sent.filter((r) => r.body && 'latitude' in r.body)).toEqual([]);
    });

    test('and a draft that never answered it sends nothing about it, so a stored texture survives', async () => {
        const { W, box } = openWizard({
            turfType: 'sports', species: 'Perennial Ryegrass', variety: 'generic',
            construction: 'sand_profile', methodology: 'slan', location: null,
        });
        await W._save();

        const mentions = box.sent.filter((r) => r.body && JSON.stringify(r.body).indexOf('soil_texture') !== -1);
        process.stdout.write('[gh797] requests mentioning the texture when none was chosen: '
            + JSON.stringify(mentions) + '\n');

        expect(mentions).toEqual([]);
    });
});

// ─────────────────────────────────────────────────────────────────────────────────────────────────
// Settings: the import, and the order of the Turf tab's two writes.
// ─────────────────────────────────────────────────────────────────────────────────────────────────

const SETTINGS_SRC = fs.readFileSync(path.join(ASSETS, 'settings-init.js'), 'utf8');

const BUNDLE_WITH_A_CONFIG = {
    version: 1,
    site: { label: 'Old portal site' },
    siteConfig: {
        location: { name: 'Auckland', lat: -36.85, lon: 174.76 },
        turf: { species: 'Perennial Ryegrass', methodology: 'ammonium_acetate', turfType: 'sports' },
        pgr: {},
    },
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
        appendChild() {}, removeChild() {}, setAttribute() {}, getAttribute: () => null,
        querySelector: () => null, querySelectorAll: () => [],
        // The Turf tab reads `options` when it repopulates the companion-species list.
        options: [], remove() {}, add() {},
    };
}

/** Settings, loaded as a page loads it, with every request and its body recorded. */
function settingsPage(answerFor) {
    const ids = new Map();
    const get = (id) => {
        if (!ids.has(id)) ids.set(id, element(id));

        return ids.get(id);
    };
    const requests = [];
    const sandbox = {
        console: { log() {}, warn() {}, error() {}, info() {} },
        setTimeout: () => 0, clearTimeout() {}, setInterval: () => 0, clearInterval() {},
        JSON, Object, Array, String, Number, Math, Date, RegExp, Error, Promise, encodeURIComponent,
        parseFloat, parseInt, isNaN, isFinite,
        STG_DATA: { activeSiteId: 'site-1', apiBase: '/api', csrfToken: 't', zones: [] },
        localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
        FileReader: class { readAsText() { this.onload({ target: { result: JSON.stringify(BUNDLE_WITH_A_CONFIG) } }); } },
        fetch: (url, opts) => {
            const body = opts && opts.body ? JSON.parse(opts.body) : null;
            requests.push({ method: opts.method, url, body });
            const answer = (answerFor && answerFor(url, body)) || { ok: true, status: 200, data: {} };

            return Promise.resolve({
                ok: answer.ok, status: answer.status,
                json: () => Promise.resolve(answer.data || {}),
            });
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
    vm.runInContext(SETTINGS_SRC, vm.createContext(sandbox), { filename: 'settings-init.js' });

    return { get, requests };
}

describe('GH-797 — the import keeps the texture, and the Turf tab writes the column first', () => {
    test('an import says nothing at all about the soil texture', async () => {
        const page = settingsPage();
        page.get('imp-file-input').fire('change');
        page.get('imp-run-btn').fire('click');
        for (let i = 0; i < 40; i++) await Promise.resolve();

        const siteWrites = page.requests.filter((r) => /\/api\/sites\/site-1$/.test(r.url));
        const mentions = page.requests.filter((r) => r.body && JSON.stringify(r.body).indexOf('soil_texture') !== -1);
        process.stdout.write('[gh797] the import sent: '
            + JSON.stringify(page.requests.map((r) => r.method + ' ' + r.url)) + '\n'
            + '[gh797] its site writes: ' + JSON.stringify(siteWrites.map((r) => r.body)) + '\n');

        // The subject: not one request carries the key, so whatever the site holds it keeps.
        expect(mentions).toEqual([]);
        // And the import still did its two jobs, or the case above would pass on an import that
        // never ran.
        expect(page.requests.some((r) => /\/samples\/sync$/.test(r.url))).toBe(true);
        expect(page.requests.some((r) => /\/config\/gaip$/.test(r.url))).toBe(true);
    });

    test('the Turf tab writes the column BEFORE the config, and a refusal of it leaves the config alone', async () => {
        const refuseTheColumn = (url) => (/\/api\/sites\/site-1$/.test(url)
            ? { ok: false, status: 422, data: { message: 'Not saved: fill in the soil texture.', missing: [{ input: TEXTURE, label: 'the soil texture' }] } }
            : { ok: true, status: 200, data: {} });

        const refused = settingsPage(refuseTheColumn);
        refused.get('stg-turf-form').fire('submit');
        for (let i = 0; i < 40; i++) await Promise.resolve();

        const order = refused.requests.map((r) => r.method + ' ' + r.url);
        process.stdout.write('[gh797] with the column refused, Settings sent: ' + JSON.stringify(order) + '\n');

        // Again the list: one write, to the site route, and the config never reached.
        expect(order.filter((u) => /\/api\/sites\/site-1$/.test(u)))
            .toEqual(['PATCH /api/sites/site-1']);
        expect(order.filter((u) => /\/config\/gaip$/.test(u))).toEqual([]);

        const accepted = settingsPage();
        accepted.get('stg-turf-form').fire('submit');
        for (let i = 0; i < 40; i++) await Promise.resolve();

        const acceptedOrder = accepted.requests.map((r) => r.url);
        process.stdout.write('[gh797] with the column accepted, Settings sent: '
            + JSON.stringify(acceptedOrder) + '\n');

        // The positive control: accepted, both go, and the column is first.
        const site = acceptedOrder.findIndex((u) => /\/api\/sites\/site-1$/.test(u));
        const config = acceptedOrder.findIndex((u) => /\/config\/gaip$/.test(u));
        expect(site).toBeGreaterThan(-1);
        expect(config).toBeGreaterThan(site);
    });
});
