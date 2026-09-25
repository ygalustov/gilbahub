/**
 * GH-719 (queue item 3au) — THE FIELDS OF THE INVISIBLE WEAR FORM, AND EVERY PLACE THAT READS THEM.
 *
 * THE UNIT IS THE BLOCK, NOT THE FIELD, and that is the reviewer's condition (M4) rather than a
 * preference: the item is reported as "the wear load is a markup default", and the block holds
 * fifteen fields. A guard written about the matches-per-week field alone stays green the week the
 * same defect arrives through `matchDuration` or `trainingRotation`.
 *
 * WHERE THE UNIVERSE COMES FROM, both halves, and neither is a list written here:
 *
 *   - the FIELDS are read out of the runner's own markup — the `data-card="traffic"` section of
 *     `legacy-hub-markup.blade.php` — so a field added to the card brings itself into the census,
 *     and the default it carries is taken from the markup rather than restated;
 *   - the READERS are searched for across `assets/*.js` by directory listing. The reviewer named
 *     a second reader of the same key himself (`dew-prediction-integration.js`) and said plainly
 *     that a list in the task would hide a third; the directory cannot.
 *
 * WHAT A READER IS: a place naming the field's class. That is a form, not behaviour, and the
 * boundary is stated here rather than discovered later — a read through a computed class name, or
 * through a variable holding it, is invisible to this census. What the census IS for is that the
 * set of places cannot grow or shrink in silence.
 */

'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const MARKUP = path.join(ROOT, 'app/resources/views/partials/legacy-hub-markup.blade.php');

/** The wear card's own source, cut from the markup by its declared attribute. */
function wearCardSource() {
    const src = fs.readFileSync(MARKUP, 'utf8');
    const at = src.indexOf('data-card="traffic"');
    if (at < 0) return { src: '', found: false };
    // From the section that carries the attribute to the matching close, counted rather than
    // guessed at by indentation: the card holds nested sections.
    const start = src.lastIndexOf('<section', at);
    let depth = 0;
    let i = start;
    while (i < src.length) {
        const nextOpen = src.indexOf('<section', i + 1);
        const nextClose = src.indexOf('</section>', i + 1);
        if (nextClose < 0) break;
        if (nextOpen > -1 && nextOpen < nextClose) { depth++; i = nextOpen; continue; }
        if (depth === 0) return { src: src.slice(start, nextClose + 10), found: true };
        depth--;
        i = nextClose;
    }

    return { src: src.slice(start), found: true };
}

/** Every `gaip-…` control in the card, with the value the markup gives it. */
function fieldsOfTheCard(cardSrc) {
    const out = {};
    for (const m of cardSrc.matchAll(/<(input|select|textarea)\b[^>]*class="([^"]*gaip-[^"]*)"[^>]*>/g)) {
        const tag = m[1];
        const cls = m[2].split(/\s+/).find((c) => c.indexOf('gaip-') === 0);
        if (!cls) continue;
        const valueAttr = /value="([^"]*)"/.exec(m[0]);
        const checked = /\bchecked\b/.test(m[0]);
        let markupDefault = null;
        if (tag === 'input') markupDefault = checked ? 'checked' : (valueAttr ? valueAttr[1] : null);
        out[cls] = { tag, markupDefault };
    }
    // A `<select>`'s default is the option the markup marks `selected`, which is the same kind of
    // fact as an input's `value` and is missed entirely if only inputs are looked at.
    for (const m of cardSrc.matchAll(/<select\b[^>]*class="([^"]*gaip-[^"]*)"[^>]*>([\s\S]*?)<\/select>/g)) {
        const cls = m[1].split(/\s+/).find((c) => c.indexOf('gaip-') === 0);
        if (!cls || !out[cls]) continue;
        const sel = /<option value="([^"]*)"[^>]*\bselected\b/.exec(m[2]);
        out[cls].markupDefault = sel ? sel[1] : null;
    }

    return out;
}

/**
 * Every place that DECLARES one of these fields together with a default, across the view
 * templates and `assets`, by directory listing in both.
 *
 * FOUND WHILE MEASURING THIS ITEM, and it is why the census could not stop at the card: the same
 * form is also built by a script — `wear-recovery-integration.js` carries its own copy of the
 * markup with the same `value="2"`, the same `1.5`, the same `selected` options. A guard that
 * knows only the blade card calls that file a reader and never sees that it is a second home for
 * the very default the item is about, so repairing the card alone would move nothing.
 *
 * The file is recorded without a line number on purpose: a line moves on the next edit and a
 * census pinned to one goes stale silently. What is recorded is WHERE and WHAT, which is the pair
 * the item is about.
 */
function defaultDeclarations(fields) {
    const places = [];
    const walk = (dir, rel) => {
        fs.readdirSync(dir, { withFileTypes: true }).forEach((e) => {
            const full = path.join(dir, e.name);
            if (e.isDirectory()) return walk(full, rel + e.name + '/');
            if (!/\.(js|php)$/.test(e.name)) return;
            try {
                places.push({ file: rel + e.name, src: fs.readFileSync(full, 'utf8') });
            } catch (err) {
                if (!err || err.code !== 'ENOENT') throw err;
            }
        });
    };
    walk(path.join(ROOT, 'assets'), 'assets/');
    walk(path.join(ROOT, 'app/resources/views'), 'app/resources/views/');

    const out = {};
    Object.keys(fields).forEach((cls) => {
        out[cls] = [];
        places.forEach((place) => {
            let declared = null;
            const input = new RegExp('<input[^>]*class="[^"]*' + cls + '[^"]*"[^>]*>', 'g');
            for (const m of place.src.matchAll(input)) {
                const v = /value="([^"]*)"/.exec(m[0]);
                if (v) declared = v[1];
                else if (/\bchecked\b/.test(m[0])) declared = 'checked';
            }
            const select = new RegExp('<select[^>]*class="[^"]*' + cls
                + '[^"]*"[^>]*>([\\s\\S]*?)<\\/select>', 'g');
            for (const m of place.src.matchAll(select)) {
                const sel = /<option value="([^"]*)"[^>]*\bselected\b/.exec(m[1]);
                if (sel) declared = sel[1];
            }
            if (declared !== null) out[cls].push(place.file + ' = ' + JSON.stringify(declared));
        });
        out[cls].sort();
    });

    return out;
}

/** Every script in `assets` that names each class, by directory listing. */
function readersOf(fields) {
    const files = fs.readdirSync(path.join(ROOT, 'assets')).filter((f) => f.endsWith('.js'));
    const out = {};
    Object.keys(fields).forEach((cls) => { out[cls] = []; });
    files.forEach((f) => {
        let src;
        try {
            src = fs.readFileSync(path.join(ROOT, 'assets', f), 'utf8');
        } catch (err) {
            // GH-712's lesson: a file that vanishes between the listing and the read is named, not
            // a crash that takes the whole suite with it.
            if (err && err.code === 'ENOENT') return;
            throw err;
        }
        Object.keys(fields).forEach((cls) => {
            if (src.indexOf(cls) > -1) out[cls].push(f);
        });
    });

    return out;
}

describe('GH-719 — the wear block as a whole, and who reads it', () => {
    const card = wearCardSource();
    const fields = fieldsOfTheCard(card.src);
    const readers = readersOf(fields);
    const declarations = defaultDeclarations(fields);

    test('POSITIVE CONTROL: the card was found, it is the hidden one, and it holds fields', () => {
        process.stdout.write('\n[gh719] the wear card: found=' + card.found
            + ' | ' + card.src.length + ' characters | fields: ' + Object.keys(fields).length + '\n');
        Object.entries(fields).forEach(([cls, f]) => {
            process.stdout.write('[gh719]   ' + cls.padEnd(28) + f.tag.padEnd(9)
                + ' markup default ' + JSON.stringify(f.markupDefault)
                + ' | named in: ' + JSON.stringify(readers[cls]) + '\n');
        });

        expect(card.found).toBe(true);
        // It is the hidden form, and that is the whole reason a markup default is not data.
        expect(card.src).toMatch(/data-card="traffic"[^>]*style="display: none;"/);
        expect(Object.keys(fields).length).toBeGreaterThan(10);
        // Both roads of the derivation reached something: an input's `value` and a select's
        // `selected` option are different reads, and only one of them failing is invisible in a
        // count of fields.
        expect(fields['gaip-matches-week'].markupDefault).toBe('2');
        expect(fields['gaip-training-type'].markupDefault).toBe('training_drills');
        // And the census found readers at all, or every comparison below is between two empties.
        expect(readers['gaip-matches-week'].length).toBeGreaterThan(1);
    });

    test('THE BLOCK AND ITS READERS EQUAL THE RECORDED CENSUS, BOTH WAYS', () => {
        /**
         * The ratchet, and it is the reviewer's M4 made checkable: the claim of this item is about
         * the BLOCK, so the comparison is over every field of the card and every file that names
         * it. A field returned to its markup default one at a time is red by name; a reader
         * appearing in a file nobody listed is red by file; a field or a reader that disappears is
         * red until the census is changed on purpose.
         */
        const census = {};
        Object.keys(fields).sort().forEach((cls) => {
            census[cls] = { markupDefault: fields[cls].markupDefault, namedIn: readers[cls].slice().sort() };
        });
        Object.keys(census).forEach((cls) => { census[cls].declaredWithADefaultIn = declarations[cls]; });
        if (process.env.GH719_PRINT) process.stdout.write(JSON.stringify(census, null, 2) + '\n');

        const recorded = JSON.parse(fs.readFileSync(
            path.join(__dirname, 'fixtures', 'gh719-wear-block-census.json'), 'utf8')).fields;

        const nowKeys = Object.keys(census).sort();
        const wasKeys = Object.keys(recorded).sort();
        process.stdout.write('[gh719] fields now ' + nowKeys.length + ', recorded ' + wasKeys.length + '\n');

        expect({
            fieldsAppeared: nowKeys.filter((k) => !wasKeys.includes(k)),
            fieldsGone: wasKeys.filter((k) => !nowKeys.includes(k)),
        }).toEqual({ fieldsAppeared: [], fieldsGone: [] });

        // The lists are compared, not their lengths: a reader moving from one file to another keeps
        // the count and changes the answer.
        const defaultsChanged = [];
        const readersChanged = [];
        const declarationsChanged = [];
        nowKeys.forEach((k) => {
            if (!recorded[k]) return;
            if (census[k].markupDefault !== recorded[k].markupDefault) {
                defaultsChanged.push(k + ': recorded ' + JSON.stringify(recorded[k].markupDefault)
                    + ', now ' + JSON.stringify(census[k].markupDefault));
            }
            const a = census[k].namedIn.join(' ');
            const b = (recorded[k].namedIn || []).join(' ');
            if (a !== b) {
                readersChanged.push(k + ': recorded [' + b + '], now [' + a + ']');
            }
            const da = census[k].declaredWithADefaultIn.join(' | ');
            const db = (recorded[k].declaredWithADefaultIn || []).join(' | ');
            if (da !== db) {
                declarationsChanged.push(k + ': recorded [' + db + '], now [' + da + ']');
            }
        });
        expect({ markupDefaultsChanged: defaultsChanged, readersChanged, declarationsChanged }).toEqual({
            markupDefaultsChanged: [], readersChanged: [], declarationsChanged: [],
        });
    });

    test('POSITIVE CONTROL for the wider census: the second home of the default was found', () => {
        /**
         * Without this the case above is satisfied by a census that looked in one place. The claim
         * is not that two homes are correct — it is that BOTH are seen, so the repair cannot leave
         * one standing.
         */
        const both = declarations['gaip-matches-week'];
        process.stdout.write('[gh719] `gaip-matches-week` is declared with a default in: '
            + JSON.stringify(both) + '\n');
        expect(both.some((d) => d.indexOf('legacy-hub-markup.blade.php') > -1)).toBe(true);
        expect(both.some((d) => d.indexOf('assets/wear-recovery-integration.js') > -1)).toBe(true);
        expect(both.length).toBeGreaterThanOrEqual(2);
    });
});
