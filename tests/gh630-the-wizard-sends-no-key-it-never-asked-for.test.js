/**
 * GH-629 (the measurement, part B of the analyst's section 11) and GH-630 (the
 * repair) — THE WIZARD DOES NOT SEND A KEY IT NEVER ASKED FOR.
 *
 * WHAT WAS MEASURED, AND IT IS KEPT HERE BECAUSE IT IS THE REASON FOR THE
 * REPAIR. `_save()` wrote `subCategory: self.d.subCategory || ''`, and the
 * wizard nulls that field for anything but golf, so the PATCH body carried
 * `turf.subCategory: ''` for every sports and lawns site. Executed, not read:
 *
 *   sports body.turf: {"turfType":"sports","subCategory":"", …}
 *   lawns  body.turf: {"turfType":"lawns","subCategory":"", …}
 *
 * The server half (`app/tests/Feature/Gh629WizardSubCategoryPatchTest.php`)
 * answered 422 to exactly that body — `{"invalid_keys":["turf.subCategory"]}` —
 * 200 to the same body without the key, and 200 to `golf`/`greens`. So no
 * sports or lawns site created by the wizard could be saved at all.
 *
 * GH-630 sends the key for golf only, which is the only type the wizard asks
 * it of. The cases below state that, by running `_save()` and intercepting the
 * request.
 *
 * THE INTERCEPT IS AT `fetch`, not at `_api`: the body is built on the way
 * through, and replacing the layer that builds it would measure the test.
 *
 * WHAT A SILENT RUN WOULD MEAN, said in advance: if nothing is intercepted, the
 * sandbox did not reach `_save()` — that is "the measurement did not arrive at
 * its subject", not "the wizard sends nothing". The positive control below
 * separates the two.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const SRC = fs.readFileSync(path.join(__dirname, '../assets/onboarding-wizard.js'), 'utf8');

function stubElement() {
    const el = {
        style: {}, dataset: {}, textContent: '', innerHTML: '', value: '',
        classList: { add() {}, remove() {}, contains: () => false, toggle() {} },
        addEventListener() {}, removeEventListener() {}, appendChild() {}, removeChild() {},
        setAttribute() {}, getAttribute: () => null, insertAdjacentHTML() {},
        querySelector: () => stubElement(), querySelectorAll: () => [],
        parentNode: null, disabled: false,
    };
    return el;
}

/** The wizard, loaded the way a page loads it, with every request captured. */
function wizardSandbox() {
    const sent = [];
    const sandbox = {
        console: { log() {}, warn() {}, error() {}, info() {} },
        Date, Math, JSON, Object, Array, String, Number, Boolean, RegExp, Error, Promise,
        parseFloat, parseInt, isNaN, isFinite, setTimeout: (f) => { f(); return 0; }, clearTimeout() {},
        encodeURIComponent, decodeURIComponent,
        URLSearchParams: require('url').URLSearchParams,
        localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
        fetch: (url, opts) => {
            sent.push({ url, method: opts && opts.method, body: opts && opts.body ? JSON.parse(opts.body) : null });
            return Promise.resolve({
                ok: true,
                status: 200,
                json: () => Promise.resolve({ data: { id: 'site-1' } }),
            });
        },
    };
    sandbox.window = sandbox;
    sandbox.global = sandbox;
    sandbox.globalThis = sandbox;
    sandbox.document = {
        readyState: 'complete',
        addEventListener() {}, removeEventListener() {},
        querySelector: () => null, querySelectorAll: () => [],
        createElement: stubElement,
        body: stubElement(),
    };
    sandbox.location = { search: '', pathname: '/dashboard', hash: '', href: '' };
    sandbox.history = { replaceState() {} };
    // An active site, so `_ensureSite()` does not create one — the subject is
    // the config PATCH, and a site creation in between would only add noise.
    sandbox.GAIP_HUB_CONFIG = { activeSiteId: 'site-1', restUrl: '/api/', csrfToken: 't' };

    const ctx = vm.createContext(sandbox);
    vm.runInContext(SRC, ctx, { filename: 'onboarding-wizard.js' });
    return { ctx, sent };
}

function saveWith(draft) {
    const { ctx, sent } = wizardSandbox();
    const W = ctx.GilbaWizard;
    expect(W).toBeTruthy();
    Object.assign(W.d, draft);
    return W._save().then(() => {
        const config = sent.find((r) => String(r.url).indexOf('/config/gaip') !== -1);
        return { config, sent };
    });
}

describe('GH-630 — the body the wizard sends, and the key it no longer sends', () => {
    test('POSITIVE CONTROL: golf/greens reaches the config route and carries its sub-category', async () => {
        // Without this, a silent run below would be unreadable: "the wizard
        // sends no sub-category" and "the sandbox never got as far as `_save()`"
        // look the same from outside.
        const { config, sent } = await saveWith({
            location: { name: 'Christchurch', lat: -43.5, lon: 172.6 },
            turfType: 'golf', subCategory: 'greens', species: 'Bentgrass', methodology: 'mlsn',
        });

        process.stdout.write('[gh630-B] requests intercepted: '
            + JSON.stringify(sent.map((r) => r.method + ' ' + r.url)) + '\n');
        expect(config).toBeTruthy();
        process.stdout.write('[gh630-B] golf body.turf: ' + JSON.stringify(config.body.patch.turf) + '\n');
        expect(config.body.patch.turf.subCategory).toBe('greens');
    });

    test('a sports site: the key is NOT in the body at all', async () => {
        const { config } = await saveWith({
            location: { name: 'Christchurch', lat: -43.5, lon: 172.6 },
            turfType: 'sports', subCategory: null, species: 'Perennial Ryegrass', methodology: 'slan',
        });

        expect(config).toBeTruthy();
        const turf = config.body.patch.turf;
        process.stdout.write('[gh630-B] sports body.turf: ' + JSON.stringify(turf) + '\n');
        process.stdout.write('[gh630-B] `subCategory` present in the body: '
            + ('subCategory' in turf) + '\n');

        // ABSENT, not empty. An empty string becomes `null` in the middleware
        // and a null inside a section is refused — which is how this defect
        // worked. And absence is what the PATCH contract means by "untouched",
        // so a site that already has a sub-category does not lose it either.
        expect('subCategory' in turf).toBe(false);
        // The rest of the section still travels, or "no sub-category" would be
        // true of a wizard that had stopped sending anything.
        expect(turf.turfType).toBe('sports');
        expect(turf.species).toBe('Perennial Ryegrass');
        expect(turf.methodology).toBe('slan');
    });

    test('lawns behaves the same as sports', async () => {
        const { config } = await saveWith({
            location: { name: 'Christchurch', lat: -43.5, lon: 172.6 },
            turfType: 'lawns', subCategory: null, species: 'Tall Fescue', methodology: 'slan',
        });

        process.stdout.write('[gh630-B] lawns body.turf: ' + JSON.stringify(config.body.patch.turf) + '\n');
        expect('subCategory' in config.body.patch.turf).toBe(false);
    });

    test('a golf site whose sub-category was never chosen sends no key either', async () => {
        // The other side of the repair: the key travels because it was ANSWERED,
        // not because the type is golf. A golf draft that never reached step 2
        // would otherwise send an empty string again.
        const { config } = await saveWith({
            location: { name: 'Christchurch', lat: -43.5, lon: 172.6 },
            turfType: 'golf', subCategory: null, species: 'Bentgrass', methodology: 'mlsn',
        });

        process.stdout.write('[gh630-B] golf without an answer: '
            + JSON.stringify(config.body.patch.turf) + '\n');
        expect('subCategory' in config.body.patch.turf).toBe(false);
    });
});

describe('GH-637 — what the Settings Turf tab sends: the change, and nothing else', () => {
    // WHY THIS EXISTS AND WHAT IT HAS MEASURED SO FAR. Reading the assembly said
    // Settings sends `subCategory: ''`; executing the sender said otherwise —
    // `patchGaipConfig` filters the section, and the wizard was wrong because it
    // does not use this helper (GH-631). Then the reviewer showed the guard could
    // not tell "the key is not sent" from "the key is sent empty and therefore
    // cleared", which for this form IS the subject, since `clear` is what empties
    // the stored value; the lists are compared whole now (GH-632).
    //
    // GH-637 (stage 3a) changes what the form sends: only fields that differ
    // from WHAT THE SERVER GAVE THE PAGE. So the outcomes below are three, not
    // two, and the third is the one stage 3a adds — a field nobody touched
    // travels nowhere at all.
    //
    // MEASURED ON THE SERVER, and it is why an empty field matters at all
    // (`Gh629WizardSubCategoryPatchTest`): a Turf save carrying nine empty
    // fields answers 422 naming all nine, `clear` on ordinary fields answers 200
    // and removes them, `clear` on an identity field answers 422.

    const SETTINGS = fs.readFileSync(path.join(__dirname, '../assets/settings-init.js'), 'utf8');

    /** The real sender, lifted out of its module and run. */
    function senderSandbox(savedConfig) {
        const sent = [];
        const ctx = vm.createContext({
            console: { log() {}, warn() {} },
            JSON, Object, Array, String, Number, Boolean, Promise, isNaN,
            encodeURIComponent,
            siteId: 'site-1',
            // What the server rendered into the page, which is the baseline the
            // form compares against — not the form's own state after autofill.
            D: { gaipConfig: savedConfig || {} },
            apiFetch: (method, url, body) => {
                sent.push({ method, url, body });
                return Promise.resolve({ data: { config: {} } });
            },
        });

        const idx = SETTINGS.indexOf("var GAIP_IDENTITY_FIELDS = [");
        expect(idx).toBeGreaterThan(-1);
        vm.runInContext(SETTINGS.slice(idx, SETTINGS.indexOf(';', idx) + 1), ctx, { filename: 'identity-fields' });

        const at = SETTINGS.indexOf('function patchGaipConfig(sections) {');
        expect(at).toBeGreaterThan(-1);
        let depth = 0, end = -1;
        for (let i = SETTINGS.indexOf('{', at); i < SETTINGS.length; i++) {
            if (SETTINGS[i] === '{') depth++;
            else if (SETTINGS[i] === '}') { depth--; if (!depth) { end = i + 1; break; } }
        }
        expect(end).toBeGreaterThan(at);
        vm.runInContext(SETTINGS.slice(at, end), ctx, { filename: 'patchGaipConfig' });
        expect(typeof ctx.patchGaipConfig).toBe('function');

        return { ctx, sent };
    }

    /** What the server gave the page. */
    const SAVED = {
        turf: {
            species: 'Perennial Ryegrass', turfType: 'sports', methodology: 'slan',
            construction: 'sand_profile', hoc: 25, companionSpecies: 'White Clover',
        },
    };

    /** The section as the Turf form hands it over, with one field changed. */
    const SUBMITTED = {
        species: 'Perennial Ryegrass', turfType: 'sports', methodology: 'slan',
        construction: 'sand_profile', hoc: '12', companionSpecies: 'White Clover',
        variety: '', subCategory: '', drainage: '', nProgram: '', overseedSpecies: '',
    };

    test('POSITIVE CONTROL: the sender runs and reaches the config route', async () => {
        const { ctx, sent } = senderSandbox(SAVED);
        await ctx.patchGaipConfig({ turf: SUBMITTED });

        process.stdout.write('[gh637] request: ' + JSON.stringify(sent[0] && sent[0].url) + '\n');
        expect(sent).toHaveLength(1);
        expect(sent[0].url).toContain('/config/gaip');
    });

    test('EVERY field of the section has exactly one outcome, and both whole lists are compared', () => {
        // Derived from the input and the baseline, never written out here: a
        // field added to the tab joins the comparison by itself. Three outcomes
        // now — changed, emptied, untouched — and the third is stage 3a's whole
        // point: a field nobody touched travels nowhere, so it cannot undo
        // anybody's edit.
        const { ctx, sent } = senderSandbox(SAVED);
        const identity = ctx.GAIP_IDENTITY_FIELDS;
        expect(identity).toContain('turf.species');

        return ctx.patchGaipConfig({ turf: SUBMITTED }).then(() => {
            const body = sent[0].body;
            const patched = Object.keys(body.patch && body.patch.turf ? body.patch.turf : {}).sort();
            const cleared = (body.clear || []).slice().sort();

            const expectPatched = [];
            const expectCleared = [];
            const expectNeither = [];
            Object.keys(SUBMITTED).forEach((field) => {
                const now = SUBMITTED[field];
                const was = SAVED.turf[field];
                const nowEmpty = String(now ?? '').trim() === '';
                const wasEmpty = was === undefined || was === null || String(was).trim() === '';
                if (!nowEmpty) {
                    if (!wasEmpty && String(was).trim() === String(now).trim()) { expectNeither.push(field); return; }
                    if (!wasEmpty && Number(was) === Number(now)) { expectNeither.push(field); return; }
                    expectPatched.push(field);
                    return;
                }
                if (identity.indexOf('turf.' + field) !== -1) { expectNeither.push(field); return; }
                if (wasEmpty) { expectNeither.push(field); return; }
                expectCleared.push('turf.' + field);
            });

            process.stdout.write('[gh637] patched: ' + JSON.stringify(patched) + '\n');
            process.stdout.write('[gh637] cleared: ' + JSON.stringify(cleared) + '\n');
            process.stdout.write('[gh637] travelling nowhere: ' + JSON.stringify(expectNeither.sort()) + '\n');

            expect(patched).toEqual(expectPatched.sort());
            expect(cleared).toEqual(expectCleared.sort());
            expect(expectNeither.length).toBeGreaterThan(3); // or this compares nothing
            patched.forEach((field) => {
                expect(String(body.patch.turf[field])).toBe(String(SUBMITTED[field]));
            });
        });
    });

    test('a field the person did not touch is absent from both halves — the loss stage 1 measured cannot happen through it', () => {
        const { ctx, sent } = senderSandbox(SAVED);

        return ctx.patchGaipConfig({ turf: SUBMITTED }).then(() => {
            const body = sent[0].body;
            // `construction` is what tab B changed in the measurement; A's form
            // still shows the old value and no longer sends it.
            expect(body.patch.turf.construction).toBeUndefined();
            expect(body.clear || []).not.toContain('turf.construction');
            // and the field the person DID change travels
            expect(body.patch.turf.hoc).toBe('12');
        });
    });

    test('an empty control whose stored value was also empty is not a clear', () => {
        // Case 4 of the plan, and it needed no race at all: the form was asking
        // to empty something nobody had touched, and on five of the twelve stand
        // sites the companion species had a value to lose.
        const { ctx, sent } = senderSandbox({ turf: { species: 'Ryegrass', turfType: 'sports', methodology: 'slan' } });

        return ctx.patchGaipConfig({ turf: { species: 'Ryegrass', turfType: 'sports', methodology: 'slan', subCategory: '', variety: '' } })
            .then(() => {
                process.stdout.write('[gh637] nothing stored, nothing emptied: '
                    + JSON.stringify(sent.length ? sent[0].body : null) + '\n');
                expect(sent).toHaveLength(0); // nothing changed at all, so nothing was sent
            });
    });

    test('a field the person really did empty still travels as `clear`', () => {
        const { ctx, sent } = senderSandbox(SAVED);

        return ctx.patchGaipConfig({ turf: Object.assign({}, SUBMITTED, { companionSpecies: '' }) }).then(() => {
            process.stdout.write('[gh637] emptied on purpose: ' + JSON.stringify(sent[0].body.clear) + '\n');
            expect(sent[0].body.clear).toContain('turf.companionSpecies');
        });
    });

    test('an identity field that arrives empty is left out of the request entirely', () => {
        // Neither patched nor cleared: a form whose control had nothing in it is
        // not a person erasing the site's species, and the server refuses to
        // empty these at all.
        const { ctx, sent } = senderSandbox(SAVED);

        return ctx.patchGaipConfig({ turf: Object.assign({}, SUBMITTED, { species: '', methodology: '' }) }).then(() => {
            const body = sent[0].body;
            process.stdout.write('[gh637] identity empty -> patch.turf: ' + JSON.stringify(body.patch.turf)
                + ' clear: ' + JSON.stringify(body.clear) + '\n');
            expect(body.patch.turf.species).toBeUndefined();
            expect(body.clear || []).not.toContain('turf.species');
            expect(body.clear || []).not.toContain('turf.methodology');
        });
    });

    test('nothing changed means nothing is sent, and the caller still resolves', async () => {
        const { ctx, sent } = senderSandbox(SAVED);

        const answer = await ctx.patchGaipConfig({ turf: {
            species: 'Perennial Ryegrass', turfType: 'sports', methodology: 'slan',
            construction: 'sand_profile', hoc: 25, companionSpecies: 'White Clover',
        } });

        process.stdout.write('[gh637] no change -> requests: ' + sent.length + ', answer: ' + JSON.stringify(answer) + '\n');
        expect(sent).toHaveLength(0);
        expect(answer).toBeNull();
    });

    test('with no server config on the page, every field reads as changed — the fallback, named', () => {
        // The safe half: a page that never received a config sends what it
        // always sent rather than deciding it has nothing to say.
        const { ctx, sent } = senderSandbox(undefined);

        return ctx.patchGaipConfig({ turf: SUBMITTED }).then(() => {
            const patched = Object.keys(sent[0].body.patch.turf).sort();
            process.stdout.write('[gh637] no baseline -> patched: ' + JSON.stringify(patched) + '\n');
            expect(patched).toContain('construction');
            expect(patched).toContain('hoc');
        });
    });
});
