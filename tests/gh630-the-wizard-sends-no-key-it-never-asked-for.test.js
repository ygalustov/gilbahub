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
// Still used by the Settings sender's own sandbox further down, which is a different subject.
const vm = require('vm');

// GH-789 (queue item 7): the sandbox moved to `tests/lib/` when a second guard needed the same one.
// Every reason for every stub in it moved with it.
const { wizardSandbox, stubElement, wizardSource } = require('./lib/wizard-sandbox');
// GH-789: the case below counted `_close()` in a text with its comments stripped by regular
// expression. GH-788 built the reader for that, because a regex takes `/*` inside a string or a
// regular-expression literal for the start of a comment, and this file's own note says a sentence
// about the code was once counted as the code.
const { codeOf } = require('./lib/source-without-comments');

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

        /**
         * GH-789 (queue item 7): `GAIP_IDENTITY_FIELDS` no longer stands in this file to be lifted out. It
         * was five field names the browser refused to send empty, and a person who cleared their species
         * read "Saved." about a value the server had kept. An empty required field travels as a `clear`
         * now and the server refuses it, naming the field.
         */
        const at = SETTINGS.indexOf('function patchGaipConfig(sections, place) {');
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
                // GH-789: no field is held back for being on a list any more. What decides is whether
                // the page ARRIVED with a value: nothing stored and nothing now is nothing to empty.
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

    /**
     * GH-789 (queue item 7) — TURNED, AND THE TURN IS THE SUBJECT.
     *
     * This asserted that an empty required field is left out of the request entirely: neither patched nor
     * cleared, "a form whose control had nothing in it is not a person erasing the site's species". The
     * cost of that reading was measured on the tree: the form then reported "Saved." while the server kept
     * the old value, so a person who deliberately cleared their species was told the opposite of what
     * happened, three fields over (species, methodology, turf type).
     *
     * The owner's decision of 29.09.2026 settles it the other way: a required field is not saved empty and
     * is marked red. So an empty required field is STATED, the server refuses it and names it, and the tab
     * shows the field. Which is what the earlier reading could never do -- it had nothing to show.
     */
    test('an empty required field is stated, so the server can refuse it and the tab can show it', () => {
        const { ctx, sent } = senderSandbox(SAVED);

        return ctx.patchGaipConfig({ turf: Object.assign({}, SUBMITTED, { species: '', methodology: '' }) }).then(() => {
            const body = sent[0].body;
            process.stdout.write('[gh637] a required field emptied -> patch.turf: ' + JSON.stringify(body.patch.turf)
                + ' clear: ' + JSON.stringify(body.clear) + '\n');
            expect(body.patch.turf.species).toBeUndefined();
            expect(body.clear || []).toContain('turf.species');
            expect(body.clear || []).toContain('turf.methodology');
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

describe('GH-684 — there is no way out of the wizard but through it', () => {
    /**
     * The owner's decision, 24.09.2026: the wizard cannot be left until what is required has been
     * entered, and reopening the page brings it back while it has not been. The first step used to
     * offer `Skip Setup`, which closed the wizard on a site carrying none of those fields.
     *
     * WHAT IS ASSERTED IS THE CONSEQUENCE, not the absence of a word: the nav is BUILT on the first
     * step and every click handler it installed is FIRED, and the wizard must not close. A test
     * that only grepped for the string would pass on a button relabelled `Later`.
     */
    const navAt = (step) => {
        // GH-684: the nav's `Next` asks `_canProceed()`, which is now derived from the steps the
        // server sends. Without them every gate stands open, `Next` advances, and this case would
        // measure a wizard nobody is using. The payload is the product's own, from the list.
        // GH-789 (queue item 7): the server sends the map FOR EVERY TURF TYPE, because the type is
        // chosen on step 2 and a new site has none when the page loads. The empty key is that site.
        const box = wizardSandbox({ hubConfig: { setup: {
            missing: ['turf.turfType'],
            byStepByTurfType: { '': { 1: ['location.lat', 'location.lon'], 2: ['turf.turfType'],
                3: ['turf.species', 'turf.variety', 'turf.construction', 'turf.methodology'] } },
            answers: {},
        } } });
        const W = box.ctx.GilbaWizard;
        W.step = step;
        W._render = () => {};
        let closed = 0;
        W._close = () => { closed++; };
        W._finish = () => {};
        const before = box.created.length;
        W._buildNav();
        const madeForTheNav = box.created.slice(before);

        return { W, madeForTheNav, fireAll: () => {
            madeForTheNav.forEach((el) => el.listeners
                .filter((l) => l.type === 'click')
                .forEach((l) => l.fn.call(el)));

            return closed;
        } };
    };

    test('on the first step, nothing that can be clicked closes the wizard', () => {
        const nav = navAt(0);
        const clickable = nav.madeForTheNav.filter((el) => el.listeners.some((l) => l.type === 'click'));
        process.stdout.write('[gh684] step 0 nav built ' + nav.madeForTheNav.length
            + ' elements, of which clickable: '
            + JSON.stringify(clickable.map((el) => el.tag + ':' + (el.textContent || '<no text>'))) + '\n');

        // POSITIVE CONTROL: the nav was really built, and it does have a control on it. Without
        // this, "nothing closed the wizard" and "nothing was built" are the same green.
        expect(nav.madeForTheNav.length).toBeGreaterThan(0);
        expect(clickable.length).toBeGreaterThan(0);

        expect(nav.fireAll()).toBe(0);
    });

    test('on a later step the same control goes BACK, so the nav is not simply inert', () => {
        const nav = navAt(2);
        const closed = nav.fireAll();
        process.stdout.write('[gh684] from step 2, firing every click left the step at '
            + nav.W.step + ' and closed the wizard ' + closed + ' times\n');

        expect(closed).toBe(0);
        // It moved: the control exists and does its own job.
        expect(nav.W.step).toBe(1);
    });

    test('the ways out are ENUMERATED, and there is one: finishing', () => {
        // The point of naming them: a removed button proves nothing if Escape or a click on the
        // backdrop still closes it. Each is looked for and the result is printed, so "none found"
        // cannot be read as "none looked for".
        //
        // AND THE LIMIT OF THE LISTENER HALF, found by the mutation that was supposed to prove it:
        // an Escape handler added in a method that nothing calls yet leaves `documentListeners`
        // EMPTY, because only what the wizard installs at load time appears there. What caught that
        // mutation was the count of places calling `_close()`. So the two halves are not
        // interchangeable: the listener list sees what is installed on load, the count sees every
        // exit written into the file whether it is wired up yet or not.
        const box = wizardSandbox();
        // COMMENTS FIRST, everywhere. The count came out as two on the first run and the second
        // one was this repair's own comment saying `_close()` is reached from one place -- a
        // sentence about the code counted as the code. Same treatment as the removed label below.
        const code = codeOf(wizardSource, 'onboarding-wizard.js');
        const callsToClose = (code.match(/_close\(\)/g) || []).length;
        // The anchor is `_save()` itself, not the `gilba_getting_started` flag it used to sit next
        // to: that flag was a browser copy with no reader and was removed with this same work, and
        // an anchor on a line that no longer exists answers `false` about a path that is fine.
        const closeInSave = /_save\(\)[\s\S]{0,900}?_close\(\)/.test(code);
        process.stdout.write('[gh684] exits searched — calls to _close(): ' + callsToClose
            + '; one of them in the save path: ' + closeInSave
            + '; listeners the wizard put on the document: ' + JSON.stringify(box.documentListeners)
            + '; the string `Skip Setup`: ' + /Skip Setup/.test(code)
            + '; a `_skip` method: ' + /_skip\s*:/.test(code) + '\n');

        expect(callsToClose).toBe(1);
        expect(closeInSave).toBe(true);
        expect(/_skip\s*:/.test(code)).toBe(false);
        // Comments are stripped first: this file explains what was removed, and the explanation
        // naming it must not count as the control coming back.
        expect(/Skip Setup/.test(code)).toBe(false);
        expect(box.documentListeners).not.toContain('keydown');
    });
});

/**
 * GH-684 (item 3bk, part 1) — WHAT THE WIZARD ASKS, WHAT IT REFUSES TO PASS, AND WHAT IT NO LONGER
 * DECIDES FOR ANYONE.
 *
 * THE EXPECTATIONS COME FROM THE DECLARED SOURCE. The cases below are generated from
 * `assets/calculation-inputs.schema.json` -- every input that is required and names a `wizard.stepN`
 * in its own `filledIn` -- rather than from a list written here. An input added to the list with a
 * wizard step brings its own case with it; a list typed into a test would go stale the day the list
 * changes, which is the failure this whole item is about.
 *
 * THE BOUNDARY, named: this derives the step map the same way the server does, from the same file.
 * It does not prove the server's own derivation, which is asserted against the file in
 * `Gh684TheServerDecidesWhenTheWizardOpensTest`. What both are pinned to is the file.
 */
describe('GH-684 — the wizard asks for everything the list requires of it', () => {
    const SCHEMA = JSON.parse(fs.readFileSync(
        path.join(__dirname, '../assets/calculation-inputs.schema.json'), 'utf8'));

    /**
     * GH-789 (queue item 7) — DERIVED PER TURF TYPE, as the server derives it.
     *
     * Two obligations of this list are conditional on the type, and the type is chosen INSIDE the
     * wizard: a golf site must state its surface, a sports field its match and training schedule. So
     * one type's step map cannot answer for the wizard, and the branch is where such an obligation is
     * declared -- `byTurfType.<type>.required`, with its own `wizard.step`.
     */
    const byStepFromTheList = (turfType) => {
        const out = {};
        const put = (step, key) => {
            (out[step] = out[step] || []);
            if (out[step].indexOf(key) === -1) out[step].push(key);
        };
        Object.entries(SCHEMA.inputs).forEach(([key, entry]) => {
            if (!entry) return;
            /**
             * The list spells a conditional obligation two ways, and `isRequired` on the server reads
             * both: a `byTurfType.<type>` branch, and `requiredFor: [types]`. The golf surface uses the
             * first, the sports schedule the second. A derivation that knew only one of them would
             * report the other as an input nobody requires — which is how it read before this.
             */
            const branch = (entry.byTurfType || {})[turfType];
            const required = branch && Object.prototype.hasOwnProperty.call(branch, 'required')
                ? branch.required === true
                : (entry.required === true
                    || (Array.isArray(entry.requiredFor) && entry.requiredFor.indexOf(turfType) !== -1));
            if (!required) return;
            (entry.filledIn || []).forEach((place) => {
                const m = /^wizard\.step(\d+)$/.exec(String(place));
                if (m) put(m[1], key);
            });
            if (branch && branch.wizard && typeof branch.wizard.step === 'number') {
                put(String(branch.wizard.step), key);
            }
        });

        return out;
    };

    /** The whole map the server sends: one branch per declared type, plus a site with no type yet. */
    const byTypeFromTheList = () => {
        const out = { '': byStepFromTheList('') };
        (SCHEMA.turfTypes || []).forEach((t) => { out[t] = byStepFromTheList(t); });

        return out;
    };

    /** Every input any branch puts on a step — what the wizard must be able to ask for. */
    const everyInputOnAStep = () => {
        const all = [];
        Object.values(byTypeFromTheList()).forEach((byStep) => {
            Object.values(byStep).forEach((keys) => keys.forEach((k) => {
                if (all.indexOf(k) === -1) all.push(k);
            }));
        });

        return all.sort();
    };

    const openWith = (draft, answers) => {
        const byStep = byStepFromTheList(String((answers || {})['turf.turfType'] || ''));
        /**
         * `missing` is what the SERVER answers about this site, and the server computes it for the type
         * the site holds — so a lawn is never told it lacks a golf surface or a match schedule. Taking
         * the union of every type here would open the wizard on a complete lawn, which is a wizard no
         * client has.
         */
        const missing = [];
        [].concat(...Object.values(byStep)).forEach((k) => {
            if ((!answers || !(k in answers)) && missing.indexOf(k) === -1) missing.push(k);
        });
        const box = wizardSandbox({ hubConfig: {
            setup: {
                missing, byStepByTurfType: byTypeFromTheList(), answers: answers || {},
                constructionValues: [{ id: 'sand_profile', label: 'Sand profile (USGA-style)' }],
            },
            savedLocation: { name: 'Somewhere', lat: -37.8, lon: 144.9 },
        } });
        const W = box.ctx.GilbaWizard;
        W._render = () => {};
        Object.assign(W.d, draft || {});

        return { W, box, missing };
    };

    test('every input the list puts on a wizard step is BOUND to a draft field, both ways', () => {
        const { W } = openWith();
        const fromTheList = everyInputOnAStep();
        const bound = Object.keys(W._answers).sort();
        process.stdout.write('[gh684] the list puts these on wizard steps: ' + JSON.stringify(fromTheList)
            + '\n[gh684] the wizard binds: ' + JSON.stringify(bound) + '\n');

        expect(fromTheList.filter((k) => bound.indexOf(k) === -1)).toEqual([]);
        expect(bound.filter((k) => fromTheList.indexOf(k) === -1)).toEqual([]);
    });

    test('a step does not let you pass while ONE of its inputs is unanswered — one case per input', () => {
        /**
         * GH-789 (queue item 7): one case per input PER TYPE, because two of these obligations belong
         * to a type — the golf surface and the sports schedule — and a loop over one type's branch
         * passes over both while looking complete.
         */
        const answeredFor = (turfType) => Object.assign({
            'location.lat': -37.8, 'location.lon': 144.9, 'turf.turfType': turfType,
            'turf.species': 'Perennial Ryegrass', 'turf.variety': 'generic',
            'turf.construction': 'sand_profile', 'turf.methodology': 'slan',
        }, turfType === 'golf' ? { 'turf.subCategory': 'greens' } : {},
            turfType === 'sports' ? { 'traffic.schedule': { matchesPerWeek: 0, sessionsPerWeek: 0 } } : {});

        const report = [];
        (SCHEMA.turfTypes || []).forEach((turfType) => {
        const answered = answeredFor(turfType);
        Object.entries(byStepFromTheList(turfType)).forEach(([step, keys]) => {
            keys.forEach((key) => {
                const short = Object.assign({}, answered);
                delete short[key];
                const withoutIt = openWith(null, short);
                withoutIt.W.step = Number(step);
                // NAMED FOR WHAT IT HOLDS. The first version of this line called the value
                // `shutWithout` while storing `_canProceed()`, which is true when the gate is OPEN,
                // and the assertion below then demanded the opposite of the thing it meant. The
                // printed report read `shut: false` on a gate that was correctly shut.
                const canProceedWithout = withoutIt.W._canProceed();

                const whole = openWith(null, answered);
                whole.W.step = Number(step);
                const canProceedWithAll = whole.W._canProceed();

                report.push({ turfType, step: Number(step), key, canProceedWithout, canProceedWithAll });
            });
        });
        });
        process.stdout.write('[gh684] one case per input per turf type, from the list:\n'
            + report.map((r) => '[gh684]   ' + r.turfType + ' step ' + r.step + ' without ' + r.key
                + ' -> may proceed: ' + r.canProceedWithout
                + ' | with everything -> may proceed: ' + r.canProceedWithAll).join('\n') + '\n');

        // POSITIVE CONTROL first: the cases exist and the gate DOES open when everything is there.
        // Without it, "shut" would also be the answer of a gate that never opens.
        expect(report.length).toBeGreaterThan(0);
        expect(report.filter((r) => !r.canProceedWithAll)).toEqual([]);
        expect(report.filter((r) => r.canProceedWithout)).toEqual([]);
    });

    /**
     * GH-684 — NOTHING FILLS THE METHODOLOGY IN, AND THE REPORT NAMES WHICH PLACE WOULD HAVE.
     *
     * THE REVIEWER'S CONDITIONS, all four, and the first two were holes in the earlier version:
     *
     * 1. THERE ARE TWO PLACES, not one: the suggestion at the top of the step (New Zealand, golf
     *    greens, otherwise SLAN) and the pre-selection of New Zealand's single option after the
     *    narrowing has cleared a value. A row printing only the VALUE cannot tell them apart -- on
     *    a New Zealand draft both write `ammonium_acetate` -- so each draft below is built so that
     *    only ONE of them could have written anything, and the row says which.
     * 2. THE DRAFTS COME FROM THE BRANCHES, not from a guess. The first place branches on New
     *    Zealand and on golf-greens; the second on New Zealand; the narrowing on New Zealand plus a
     *    value that is not ammonium acetate. So: New Zealand with nothing, with each of the three
     *    methodologies pre-set, and not-New-Zealand as golf greens, golf fairways, sports and
     *    lawns, plus a non-NZ draft whose value was already chosen and must survive.
     * 3. AN EMPTY SPECIES LIST REDDENS instead of counting. `options` is the step's subject; a draft
     *    that renders none was never drawn, and "empty, as required" would be the answer of a case
     *    that did not arrive.
     * 4. THE GATE IS NOT ASSERTED HERE. `_canProceed()` on step 3 reads the same field these places
     *    write, so a red about the gate could come from a change in the emptiness. The gate is
     *    asserted in the case above, where every value is set EXPLICITLY by the draft.
     */
    test('the methodology is NOT chosen for the person, and the report names the place that would have', () => {
        const drafts = [
            { place: 'either — NZ with nothing set', nz: true, d: { turfType: 'sports' }, expect: null },
            { place: 'pre-selection of the single NZ option (the suggestion cannot: a value is set)',
              nz: true, d: { turfType: 'sports', methodology: 'mlsn' }, expect: null },
            { place: 'pre-selection of the single NZ option (SLAN cleared)',
              nz: true, d: { turfType: 'sports', methodology: 'slan' }, expect: null },
            { place: 'neither — NZ with ammonium acetate already chosen, nothing to clear or fill',
              nz: true, d: { turfType: 'sports', methodology: 'ammonium_acetate' }, expect: 'ammonium_acetate' },
            { place: 'the suggestion, golf-greens branch', nz: false,
              d: { turfType: 'golf', subCategory: 'greens' }, expect: null },
            /**
             * THE CROSSING, asked for by the reviewer: New Zealand AND golf greens together. Each
             * substitution had its own branch for this draft and they disagreed -- the suggestion
             * tests New Zealand FIRST, so it would write ammonium acetate where the golf-greens
             * branch alone would have written MLSN, and the pre-selection applies too. Neither of
             * the single-condition drafts covers it: one exercises New Zealand with sports, the
             * other golf greens outside New Zealand, and a rule that got the ORDER of the two
             * conditions wrong would pass both of them.
             *
             * It does not tell the two PLACES apart (both write the same value here) and it is
             * labelled so; what it covers is the crossing.
             */
            { place: 'either — NZ crossed with golf greens, where the two branches disagree',
              nz: true, d: { turfType: 'golf', subCategory: 'greens' }, expect: null },
            { place: 'the suggestion, otherwise branch (golf, not greens)', nz: false,
              d: { turfType: 'golf', subCategory: 'fairways' }, expect: null },
            { place: 'the suggestion, otherwise branch (sports)', nz: false,
              d: { turfType: 'sports' }, expect: null },
            { place: 'the suggestion, otherwise branch (lawns)', nz: false,
              d: { turfType: 'lawns' }, expect: null },
            { place: 'neither — not NZ and already chosen, it must survive untouched', nz: false,
              d: { turfType: 'sports', methodology: 'mlsn' }, expect: 'mlsn' },
        ];

        const rows = drafts.map((row) => {
            const location = row.nz
                ? { lat: -41.29, lon: 174.78, name: 'Wellington' }
                : { lat: -37.8, lon: 144.9, name: 'Melbourne' };
            const { W } = openWith(Object.assign({ location }, row.d));
            W.step = 3;
            const c = stubElement('div');
            const optionsCount = W._speciesOptions().length;
            // BEFORE, or "the step filled it" and "it was already there" are the same reading.
            const before = W.d.methodology;
            W._step3_Species(c);

            return {
                place: row.place, optionsCount, before,
                methodologyAfterTheStepWasDrawn: W.d.methodology,
                expected: row.expect,
                cleared: W._methodClearedForNZ || null,
            };
        });
        process.stdout.write('[gh684] what could have filled the methodology, and what did:\n'
            + rows.map((r) => '[gh684]   ' + r.place + '\n[gh684]      species offered: ' + r.optionsCount
                + ' | before the step: ' + JSON.stringify(r.before)
                + ' | after the step: ' + JSON.stringify(r.methodologyAfterTheStepWasDrawn)
                + ' | expected: ' + JSON.stringify(r.expected)
                + ' | cleared: ' + JSON.stringify(r.cleared)).join('\n') + '\n');

        // THE SUBJECT WAS DRAWN. A draft with no species on offer rendered nothing, and every claim
        // below about it would be a claim about a step that never happened.
        expect(rows.filter((r) => r.optionsCount === 0).map((r) => r.place)).toEqual([]);

        rows.forEach((r) => {
            expect(r.methodologyAfterTheStepWasDrawn).toBe(r.expected);
        });

        // And the narrowing still does its own job, or "nothing was filled in" could be the answer
        // of a step that stopped looking at the place altogether.
        const clearedOnNz = rows.filter((r) => /cleared/.test(r.place));
        expect(clearedOnNz.length).toBeGreaterThan(0);
        clearedOnNz.forEach((r) => expect(r.cleared).not.toBeNull());
    });

    test('the cultivar and the construction open EMPTY, and the cultivar list offers Generic', () => {
        const { W } = openWith({
            location: { lat: -37.8, lon: 144.9, name: 'Melbourne' },
            turfType: 'sports', species: 'Perennial Ryegrass',
        });
        W.step = 3;
        const c = stubElement('div');
        W._step3_Species(c);
        process.stdout.write('[gh684] at open: variety=' + JSON.stringify(W.d.variety)
            + ' construction=' + JSON.stringify(W.d.construction) + '\n');

        expect(W.d.variety).toBeNull();
        expect(W.d.construction).toBeNull();

        // The markup offers them, or "empty at open" would be satisfied by a step with no fields.
        expect(c.innerHTML).toContain('id="wiz-variety"');
        expect(c.innerHTML).toContain('id="wiz-construction"');
        expect(c.innerHTML).toContain('value="generic"');
        expect(c.innerHTML).toContain('Colosseum');
        expect(c.innerHTML).toContain('Sand profile (USGA-style)');
        // Nothing is pre-selected in either.
        expect(c.innerHTML).not.toContain('value="generic" selected');
        expect(c.innerHTML).not.toContain('value="sand_profile" selected');
    });

    test('with no setup state from the server the wizard does not open at all', () => {
        const box = wizardSandbox();
        const W = box.ctx.GilbaWizard;
        let shown = 0;
        W.show = () => { shown++; };
        W.init();
        process.stdout.write('[gh684] with no setup state, the wizard opened ' + shown + ' times\n');

        expect(shown).toBe(0);
    });

    test('it opens at the first step short of an answer, and `?setup` has nothing to do with it', () => {
        /**
         * GH-789 (queue item 7): the schedule is answered here BECAUSE the site is a sports field, and
         * without it the first step short of an answer is step 2, not step 3 — which is the case
         * below. The claim of this one is about the step that collects species and the rest.
         */
        const { W } = openWith(null, {
            'location.lat': -37.8, 'location.lon': 144.9, 'turf.turfType': 'sports',
            'traffic.schedule': { matchesPerWeek: 2, sessionsPerWeek: 3 },
        });
        let shown = 0;
        W.show = () => { shown++; };
        W.init();
        process.stdout.write('[gh684] place, type and schedule answered -> opened ' + shown
            + ' times at step ' + W.step + '\n');

        expect(shown).toBe(1);
        // Step 3 is where species, cultivar, construction and methodology are collected.
        expect(W.step).toBe(3);
        // And what was already answered is in the draft, not asked again.
        expect(W.d.turfType).toBe('sports');
        expect(W.d.location).toEqual({ lat: -37.8, lon: 144.9, name: 'Somewhere' });
        expect([W.d.matchesPerWeek, W.d.sessionsPerWeek]).toEqual([2, 3]);
    });

    /**
     * GH-789 (queue item 7) — AND A SPORTS FIELD WITH NO SCHEDULE OPENS AT THE STEP THAT ASKS FOR ONE.
     *
     * The other half of the same fact, and the one that is new: the step the wizard opens at is derived
     * for the type the site HOLDS, so an input required of sports alone brings it back to step 2 rather
     * than being passed over on the way to step 3.
     */
    test('a sports field with no schedule opens at step 2, and a lawn with the same answers does not open', () => {
        const sports = openWith(null, {
            'location.lat': -37.8, 'location.lon': 144.9, 'turf.turfType': 'sports',
            'turf.species': 'Perennial Ryegrass', 'turf.variety': 'generic',
            'turf.construction': 'sand_profile', 'turf.methodology': 'slan',
        });
        let shownForSports = 0;
        sports.W.show = () => { shownForSports++; };
        sports.W.init();

        const lawn = openWith(null, {
            'location.lat': -37.8, 'location.lon': 144.9, 'turf.turfType': 'lawns',
            'turf.species': 'Tall Fescue', 'turf.variety': 'generic',
            'turf.construction': 'sand_profile', 'turf.methodology': 'slan',
        });
        let shownForLawn = 0;
        lawn.W.show = () => { shownForLawn++; };
        lawn.W.init();

        process.stdout.write('[gh789] sports, everything but the schedule -> opened ' + shownForSports
            + ' times at step ' + sports.W.step
            + ' | the same answers on a lawn -> opened ' + shownForLawn + ' times\n');

        expect(shownForSports).toBe(1);
        expect(sports.W.step).toBe(2);
        // THE OTHER DIRECTION, and it is what makes the first mean anything: the schedule is asked of
        // sports and of nothing else, so the same answers on a lawn complete the site.
        expect(shownForLawn).toBe(0);
    });
});

/**
 * GH-684 — THE ONE PRODUCER OF THE CULTIVAR LIST, ASKED DIRECTLY.
 *
 * WHY THIS EXISTS, and it is a hole a mutation found rather than a tidy extra: the claim "a site
 * with no cultivar is not shown Generic" was asserted by searching `settings-init.js` for the line
 * that adds the empty prompt. Killing the CONDITION around that line -- `if (!selectedValue)` ->
 * `if (false)` -- left the line exactly where it was, and the check stayed green over dead code.
 * The rule now lives in one function that returns data, so the cases below ask it and read the
 * answer. Text about behaviour is not behaviour.
 */
describe('GH-684 — the cultivar list: Generic is offered, and Generic is not the default', () => {
    const optionsFor = (species, selected) => {
        const box = wizardSandbox();

        return box.ctx.GAIP_CultivarOptions(species, selected);
    };

    test('a site with NOTHING chosen gets an empty prompt, selected, and Generic merely offered', () => {
        const list = optionsFor('Perennial Ryegrass', '');
        process.stdout.write('[gh684] nothing chosen -> ' + JSON.stringify(list) + '\n');

        // The subject exists: the species' cultivars are on the list at all.
        expect(list.map((o) => o.value)).toContain('colosseum');

        expect(list[0]).toEqual({ value: '', label: '— select —', selected: true });
        expect(list.find((o) => o.value === 'generic').selected).toBe(false);
        // Exactly one thing is selected, or "selected" says nothing about what a browser shows.
        expect(list.filter((o) => o.selected).map((o) => o.value)).toEqual(['']);
    });

    test('`null` — the form the server sends for a site with no cultivar — behaves as nothing chosen', () => {
        /**
         * GH-687 (the reviewer's return) — THE ABSENT FORM WAS THE ONE THE PRODUCT ACTUALLY SENDS.
         *
         * The cases here asked with `''`, with `generic`, with a real cultivar and with an unknown
         * one. None asked with `null`, and `null` is what the server supplies for a site whose config
         * has no cultivar at all — two of the fourteen sites on the stand. So the one form that
         * arrives from the product was the one form nothing held, and a producer that treated `null`
         * as a value would have shown those two sites a selected cultivar with every case green.
         *
         * It is asserted to behave AS NOTHING CHOSEN rather than "not to crash": an empty prompt,
         * selected, and Generic offered but not selected.
         */
        const list = optionsFor('Perennial Ryegrass', null);
        process.stdout.write('[gh687] null chosen -> ' + JSON.stringify(list) + '\n');

        // The subject is there: the species' cultivars are on the list at all.
        expect(list.map((o) => o.value)).toContain('colosseum');

        expect(list[0]).toEqual({ value: '', label: '— select —', selected: true });
        expect(list.find((o) => o.value === 'generic').selected).toBe(false);
        expect(list.filter((o) => o.selected).map((o) => o.value)).toEqual(['']);
        // And `null` and `''` are the same question, which is the claim that lets one case stand for
        // both roads into the screen.
        expect(list).toEqual(optionsFor('Perennial Ryegrass', ''));
        // `undefined` arrives the same way when a key is missing rather than null.
        expect(optionsFor('Perennial Ryegrass', undefined)).toEqual(list);
    });

    test('a site carrying `generic` is shown Generic / Unknown as its choice', () => {
        const list = optionsFor('Perennial Ryegrass', 'generic');
        process.stdout.write('[gh684] generic chosen -> ' + JSON.stringify(list) + '\n');

        expect(list.filter((o) => o.selected).map((o) => o.value)).toEqual(['generic']);
        // And no empty prompt is added, because there is nothing to prompt for.
        expect(list.some((o) => o.value === '')).toBe(false);
    });

    test('a real cultivar is shown as the choice, and Generic stays on the list', () => {
        const list = optionsFor('Perennial Ryegrass', 'colosseum');
        process.stdout.write('[gh684] a real cultivar -> ' + JSON.stringify(list) + '\n');

        expect(list.filter((o) => o.selected).map((o) => o.value)).toEqual(['colosseum']);
        expect(list.map((o) => o.value)).toContain('generic');
    });

    test('a stored cultivar the table does not know still shows, and shows as chosen', () => {
        // The table is ours, the value is the site's. An unknown name is a gap in our table, not a
        // reason to make the site look unanswered — which would invite someone to "fix" it by
        // choosing something else.
        const list = optionsFor('Perennial Ryegrass', 'Barenbrug Bar Extreme');
        process.stdout.write('[gh684] an unknown cultivar -> ' + JSON.stringify(list) + '\n');

        expect(list.filter((o) => o.selected).map((o) => o.value)).toEqual(['Barenbrug Bar Extreme']);
    });

    test('with no species chosen there is still a prompt and Generic, so the field is never empty', () => {
        const list = optionsFor('', '');
        process.stdout.write('[gh684] no species -> ' + JSON.stringify(list) + '\n');

        expect(list.map((o) => o.value)).toEqual(['', 'generic']);
    });
});
