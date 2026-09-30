'use strict';

/**
 * GH-789 (queue item 7) — THE SETUP WIZARD ASKS A SPORTS FIELD FOR ITS SCHEDULE, AND NOUGHT IS AN
 * ANSWER.
 *
 * WHY THIS EXISTS. The list requires `traffic.schedule` of a sports surface and no wizard step
 * collected it, so the obligation had nowhere to be met: the lock could not hold it (a question nobody
 * can be asked makes the product unreachable), and Settings was the only place it could be entered.
 * The owner's decision of 30.09.2026 put it in the wizard -- "let us add it to the wizard for sports"
 * -- which is what these cases are about.
 *
 * THE THREE OUTCOMES, on the client this time, and they are three rather than two verdicts and a
 * repetition (the server's half is `Gh789NoughtIsAValueAndAnAbsentKeyIsNotTest`):
 *
 *   a typed `0`       -> an answer. The gate opens and the number travels to the server as `0`.
 *   an empty field    -> not an answer. `null`, never `0`: `parseFloat('') || 0` is the whole defect
 *                        of this queue item in one expression.
 *   a cleared field   -> not an answer, and the value in the draft goes back to `null` rather than
 *                        staying at whatever was typed before.
 *
 * WHAT IS ASSERTED IS THE CONSEQUENCE: what the step DRAWS, what the gate ANSWERS and what the
 * request CARRIES. Nothing here asserts that one function calls another.
 */

const { wizardSandbox } = require('./lib/wizard-sandbox');

/** The step map the server sends, for every turf type, as `DashboardController` builds it. */
const BY_TYPE = {
    '': { 1: ['location.lat', 'location.lon'], 2: ['turf.turfType'],
        3: ['turf.species', 'turf.variety', 'turf.construction', 'turf.methodology'] },
    golf: { 1: ['location.lat', 'location.lon'], 2: ['turf.turfType', 'turf.subCategory'],
        3: ['turf.species', 'turf.variety', 'turf.construction', 'turf.methodology'] },
    sports: { 1: ['location.lat', 'location.lon'], 2: ['turf.turfType', 'traffic.schedule'],
        3: ['turf.species', 'turf.variety', 'turf.construction', 'turf.methodology'] },
    lawns: { 1: ['location.lat', 'location.lon'], 2: ['turf.turfType'],
        3: ['turf.species', 'turf.variety', 'turf.construction', 'turf.methodology'] },
};
const LABELS = {
    'turf.subCategory': 'the surface or area',
    'traffic.schedule': 'the match and training schedule',
    'turf.turfType': 'the turf type',
};

/** The wizard as a page has it, with the draft set and rendering into an element we can read. */
function wizardOn(draft) {
    const box = wizardSandbox({ hubConfig: { setup: {
        missing: ['turf.turfType'], byStepByTurfType: BY_TYPE, labels: LABELS, answers: {},
        constructionValues: [{ id: 'sand_profile', label: 'Sand profile (USGA-style)' }],
    } } });
    const W = box.ctx.GilbaWizard;
    W._render = () => {};
    W.modal = box.ctx.document.createElement('div');
    Object.assign(W.d, draft || {});

    return { W, box };
}

/** Step 2 drawn for this draft, and the markup it produced. */
function step2(draft) {
    const { W, box } = wizardOn(draft);
    const c = box.ctx.document.createElement('div');
    W._step2_TurfType(c);

    return { W, box, html: c.innerHTML };
}

describe('GH-789 — the schedule block on step 2', () => {
    test('a sports field is drawn two number fields, a golf site its surface, a lawn neither', () => {
        const drawn = {};
        ['sports', 'golf', 'lawns'].forEach((turfType) => {
            const { html } = step2({ turfType });
            drawn[turfType] = {
                matches: /id="wiz-matches"/.test(html),
                sessions: /id="wiz-sessions"/.test(html),
                surface: /data-sub="greens"/.test(html),
                boundToTheInput: (html.match(/data-input="traffic\.schedule"/g) || []).length,
            };
        });
        process.stdout.write('[gh789] what step 2 draws:\n'
            + Object.entries(drawn).map(([t, d]) => '[gh789]   ' + t + ': ' + JSON.stringify(d)).join('\n') + '\n');

        expect(drawn.sports).toEqual({ matches: true, sessions: true, surface: false, boundToTheInput: 2 });
        // The other two directions, which are what make the first mean anything.
        expect(drawn.golf).toEqual({ matches: false, sessions: false, surface: true, boundToTheInput: 0 });
        expect(drawn.lawns).toEqual({ matches: false, sessions: false, surface: false, boundToTheInput: 0 });
    });

    test('the two fields carry no placeholder, so a figure in an empty box is never a value', () => {
        const { html } = step2({ turfType: 'sports' });
        const fields = html.slice(html.indexOf('Match and training schedule'));
        process.stdout.write('[gh789] the schedule block: ' + fields.replace(/\s+/g, ' ').slice(0, 300) + '\n');

        expect(/placeholder/.test(fields)).toBe(false);
        // Settings' own words, so a person finds the same two fields there later.
        expect(fields).toContain('Matches per week');
        expect(fields).toContain('Sessions per week');
    });

    test('a value already answered is shown, and nought is shown as nought rather than as empty', () => {
        const withNought = step2({ turfType: 'sports', matchesPerWeek: 0, sessionsPerWeek: 0 }).html;
        const withTwo = step2({ turfType: 'sports', matchesPerWeek: 2, sessionsPerWeek: 3 }).html;
        const withNone = step2({ turfType: 'sports' }).html;
        const valuesIn = (html) => (html.match(/id="wiz-(?:matches|sessions)"[^>]*?value="([^"]*)"/g) || [])
            .map((m) => /value="([^"]*)"/.exec(m)[1]);
        process.stdout.write('[gh789] values drawn — nought: ' + JSON.stringify(valuesIn(withNought))
            + ' | two and three: ' + JSON.stringify(valuesIn(withTwo))
            + ' | nothing: ' + JSON.stringify(valuesIn(withNone)) + '\n');

        expect(valuesIn(withNought)).toEqual(['0', '0']);
        expect(valuesIn(withTwo)).toEqual(['2', '3']);
        expect(valuesIn(withNone)).toEqual(['', '']);
    });
});

describe('GH-789 — the gate on step 2, and nought passes it', () => {
    const gateFor = (draft) => {
        const { W } = wizardOn(draft);
        W.step = 2;

        return { canProceed: W._canProceed(), short: W._missingOfStep(2) };
    };

    test('nought is an answer, an empty field is not, and neither is an object of other fields', () => {
        const cases = {
            'nought matches, nothing else': { turfType: 'sports', matchesPerWeek: 0 },
            'nought of both': { turfType: 'sports', matchesPerWeek: 0, sessionsPerWeek: 0 },
            'two and three': { turfType: 'sports', matchesPerWeek: 2, sessionsPerWeek: 3 },
            'both fields empty': { turfType: 'sports' },
            'both fields cleared': { turfType: 'sports', matchesPerWeek: null, sessionsPerWeek: null },
        };
        const report = {};
        Object.entries(cases).forEach(([what, draft]) => { report[what] = gateFor(draft); });
        process.stdout.write('[gh789] the gate on step 2:\n'
            + Object.entries(report).map(([w, r]) => '[gh789]   ' + w.padEnd(28)
                + ' -> may proceed: ' + r.canProceed
                + (r.short.length ? ' (short of ' + r.short.join(', ') + ')' : '')).join('\n') + '\n');

        expect(report['nought matches, nothing else'].canProceed).toBe(true);
        expect(report['nought of both'].canProceed).toBe(true);
        expect(report['two and three'].canProceed).toBe(true);
        expect(report['both fields empty']).toEqual({ canProceed: false, short: ['traffic.schedule'] });
        expect(report['both fields cleared']).toEqual({ canProceed: false, short: ['traffic.schedule'] });
    });

    test('a golf site is short of its surface, and a lawn of nothing', () => {
        expect(gateFor({ turfType: 'golf' })).toEqual({ canProceed: false, short: ['turf.subCategory'] });
        expect(gateFor({ turfType: 'golf', subCategory: 'greens' }).canProceed).toBe(true);
        expect(gateFor({ turfType: 'lawns' }).canProceed).toBe(true);
        // And no type chosen at all is short of the type itself, from the empty branch.
        expect(gateFor({}).short).toEqual(['turf.turfType']);
    });

    test('an empty box reads as nothing and a typed nought as nought — the input handler, fired', () => {
        const { W, box } = wizardOn({ turfType: 'sports' });
        const c = box.ctx.document.createElement('div');
        // The handler is installed on the elements the step finds, so the step is drawn for real and
        // the two boxes are handed back by the container's own lookup.
        const boxes = [
            Object.assign(box.ctx.document.createElement('input'), { id: 'wiz-matches', value: '' }),
            Object.assign(box.ctx.document.createElement('input'), { id: 'wiz-sessions', value: '' }),
        ];
        c.querySelectorAll = (sel) => (sel === '.wiz-number' ? boxes : []);
        W._step2_TurfType(c);
        const fire = (el, value) => {
            el.value = value;
            el.listeners.filter((l) => l.type === 'input').forEach((l) => l.fn.call(el));
        };

        const seen = [];
        fire(boxes[0], '0');
        seen.push(['a typed 0', W.d.matchesPerWeek]);
        fire(boxes[0], '');
        seen.push(['the box emptied', W.d.matchesPerWeek]);
        fire(boxes[0], '3');
        seen.push(['a typed 3', W.d.matchesPerWeek]);
        fire(boxes[1], 'abc');
        seen.push(['nonsense typed', W.d.sessionsPerWeek]);
        process.stdout.write('[gh789] what the draft holds after each keystroke:\n'
            + seen.map((s) => '[gh789]   ' + s[0].padEnd(18) + ' -> ' + JSON.stringify(s[1])).join('\n') + '\n');

        expect(seen).toEqual([
            ['a typed 0', 0],
            ['the box emptied', null],
            ['a typed 3', 3],
            ['nonsense typed', null],
        ]);
    });

    test('changing the type away from sports takes the schedule with it, as it takes the golf surface', () => {
        const { W, box } = wizardOn({ turfType: 'sports', matchesPerWeek: 0, sessionsPerWeek: 4 });
        const c = box.ctx.document.createElement('div');
        const tiles = ['sports', 'golf', 'lawns'].map((t) => Object.assign(
            box.ctx.document.createElement('div'), { dataset: { type: t } }));
        c.querySelectorAll = (sel) => (sel === '.wiz-type-btn' ? tiles : []);
        W._step2_TurfType(c);
        const click = (tile) => tile.listeners.filter((l) => l.type === 'click')
            .forEach((l) => l.fn.call(tile));

        click(tiles[1]);
        const afterGolf = [W.d.turfType, W.d.matchesPerWeek, W.d.sessionsPerWeek];
        process.stdout.write('[gh789] after clicking Golf: ' + JSON.stringify(afterGolf) + '\n');

        expect(afterGolf).toEqual(['golf', null, null]);
    });
});

describe('GH-789 — what the request carries', () => {
    /** `_save()` run for real, with the request intercepted at `fetch`. */
    const saveWith = (draft) => {
        const { W, box } = wizardOn(draft);

        return W._save().then(() => {
            const patch = box.sent.filter((r) => /config\/gaip/.test(r.url))
                .map((r) => r.body && r.body.patch)[0] || null;

            return patch;
        });
    };

    test('a sports field sends exactly the two keys it asked for, and no other field of a schedule', async () => {
        const patch = await saveWith({
            turfType: 'sports', species: 'Perennial Ryegrass', methodology: 'slan',
            matchesPerWeek: 0, sessionsPerWeek: 0,
        });
        process.stdout.write('[gh789] the body a sports field sends: ' + JSON.stringify(patch.traffic) + '\n');

        expect(patch.traffic).toEqual({ schedule: { matchesPerWeek: 0, sessionsPerWeek: 0 } });
        // Named, because this is what a default would look like: five selects of the Settings form
        // travel with whatever they show, and the wizard must not start doing the same.
        ['sport', 'ageGroup', 'squadSize', 'trainingType', 'moisture'].forEach((field) => {
            expect(Object.keys(patch.traffic.schedule)).not.toContain(field);
        });
    });

    test('an answer of one number sends one key, and no schedule at all sends no traffic section', async () => {
        const one = await saveWith({
            turfType: 'sports', species: 'Perennial Ryegrass', methodology: 'slan', sessionsPerWeek: 0,
        });
        const none = await saveWith({
            turfType: 'sports', species: 'Perennial Ryegrass', methodology: 'slan',
        });
        process.stdout.write('[gh789] one number -> ' + JSON.stringify(one.traffic)
            + ' | no number -> ' + JSON.stringify(none.traffic || null) + '\n');

        expect(one.traffic).toEqual({ schedule: { sessionsPerWeek: 0 } });
        // A field nobody filled is not a change, which is the rule GH-630 restored for the surface.
        expect('traffic' in none).toBe(false);
    });

    test('golf and lawns send no schedule, whatever is left in the draft', async () => {
        const golf = await saveWith({
            turfType: 'golf', subCategory: 'greens', species: 'Creeping Bentgrass',
            methodology: 'mlsn', matchesPerWeek: 2,
        });
        const lawns = await saveWith({
            turfType: 'lawns', species: 'Tall Fescue', methodology: 'slan', matchesPerWeek: 2,
        });
        process.stdout.write('[gh789] golf -> ' + JSON.stringify(golf.traffic || null)
            + ' | lawns -> ' + JSON.stringify(lawns.traffic || null) + '\n');

        expect('traffic' in golf).toBe(false);
        expect('traffic' in lawns).toBe(false);
    });
});

/**
 * GH-789 — THE SHARED MARKER, asked directly.
 *
 * The wizard and the four Settings forms answer an empty required field the same way because they call
 * one function for it. What it returns is the sentence a person reads, and what it leaves behind is the
 * mark on the field -- so both are asserted here, on the function itself, rather than inferred from a
 * page that happens to call it.
 */
describe('GH-789 — one way of saying "this field is required"', () => {
    const rootWith = (keys) => {
        const { stubElement } = require('./lib/wizard-sandbox');
        const fields = keys.map((key) => {
            const el = stubElement('input');
            el.getAttribute = (name) => (name === 'data-input' ? key : null);
            el.__key = key;
            el.parentNode = { insertBefore() {}, removeChild() {} };

            return el;
        });

        return {
            querySelectorAll: (sel) => {
                const m = /^\[data-input="(.+)"\]$/.exec(sel);
                if (m) return fields.filter((f) => f.__key === m[1]);

                return sel === '[data-input]' ? fields : [];
            },
            fields,
        };
    };

    test('it names the field in the list\'s own words and marks exactly that field', () => {
        const box = wizardSandbox();
        const marker = box.ctx.window.GilbaRequiredFields;
        const root = rootWith(['traffic.schedule', 'turf.species']);
        box.ctx.document.createElement = (tag) => require('./lib/wizard-sandbox').stubElement(tag);

        const sentence = marker.mark(root, [
            { input: 'traffic.schedule', label: 'the match and training schedule' },
        ]);
        const marked = root.fields.filter((f) => f.style.outline).map((f) => f.__key);
        process.stdout.write('[gh789] the sentence: "' + sentence + '" | marked: '
            + JSON.stringify(marked) + '\n');

        expect(sentence).toBe('Not saved: fill in the match and training schedule.');
        // Only the field the refusal named, or the mark would say nothing about which one.
        expect(marked).toEqual(['traffic.schedule']);
    });

    test('two fields read as one sentence, and nothing missing says nothing at all', () => {
        const box = wizardSandbox();
        const marker = box.ctx.window.GilbaRequiredFields;
        box.ctx.document.createElement = (tag) => require('./lib/wizard-sandbox').stubElement(tag);
        const root = rootWith(['turf.variety', 'turf.construction']);

        const two = marker.mark(root, [
            { input: 'turf.variety', label: 'the cultivar or variety' },
            { input: 'turf.construction', label: 'the construction type' },
        ]);
        const none = marker.mark(root, []);
        process.stdout.write('[gh789] two fields: "' + two + '" | none: "' + none + '"\n');

        expect(two).toBe('Not saved: fill in the cultivar or variety and the construction type.');
        expect(none).toBe('');
        // And the second call took the first call's marks off, so a later attempt does not show them.
        expect(root.fields.filter((f) => f.style.outline)).toEqual([]);
    });
});
