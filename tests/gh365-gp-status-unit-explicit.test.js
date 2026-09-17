/**
 * GH-365 (Hoxton audit follow-up) — GAIP_GPStatus.toPct() guesses the caller's
 * unit: `gp <= 1 ? gp * 100 : gp`. That guess is unavoidably wrong for exactly
 * one input. A GP of `1` means 100% to a fraction-caller (the recommender
 * engines, whose m.gp is 0-1) and 1% to a percentage-caller (the dashboards,
 * whose own fallbacks compare against 70/40) — and the heuristic answers 100%
 * for both, so a genuinely near-dormant surface at 1% GP rendered green
 * "High".
 *
 * GH-346 and GH-350 each patched one call site of this; the ambiguity itself
 * stayed. GH-365 adds unit-explicit entry points (…Pct / …Frac) and moves every
 * call site onto the one that matches its own unit, so the exactly-1 case no
 * longer depends on which module is asking.
 */

'use strict';

const fs = require('fs');
const path = require('path');

// The module attaches to `window` when one exists, otherwise to its own
// `this` — which under CommonJS is module.exports, not the global. Give it a
// window to attach to so the test reads the same object a browser would.
global.window = global.window || global;
require('../assets/gp-status.js');
const GP = global.window.GAIP_GPStatus;

describe('GH-365 — unit-explicit GP status entry points', () => {
    test('the ambiguous input: 1% is low, 100% is high, and each API says so', () => {
        expect(GP.getLevelPct(1)).toBe('low');
        expect(GP.getLevelFrac(1)).toBe('high');
    });

    test('toPct()\'s old heuristic is what made those two indistinguishable', () => {
        // Documents the behaviour that is being moved away from: the legacy
        // entry point still answers 'high' for a 1% percentage caller.
        expect(GP.getLevel(1)).toBe('high');
    });

    test('0 is low on both APIs (it was never the broken case, despite the GH-350 note)', () => {
        expect(GP.getLevelPct(0)).toBe('low');
        expect(GP.getLevelFrac(0)).toBe('low');
    });

    test('canonical thresholds hold on the percentage API', () => {
        expect(GP.getLevelPct(70)).toBe('high');
        expect(GP.getLevelPct(69.9)).toBe('moderate');
        expect(GP.getLevelPct(40)).toBe('moderate');
        expect(GP.getLevelPct(39.9)).toBe('low');
    });

    test('the fraction API is the percentage API scaled, thresholds included', () => {
        expect(GP.getLevelFrac(0.7)).toBe('high');
        expect(GP.getLevelFrac(0.699)).toBe('moderate');
        expect(GP.getLevelFrac(0.4)).toBe('moderate');
        expect(GP.getLevelFrac(0.399)).toBe('low');
    });

    test('colours and labels come from the same canonical palette on both APIs', () => {
        expect(GP.getColorPct(80)).toBe(GP.COLORS.high);
        expect(GP.getColorFrac(0.8)).toBe(GP.COLORS.high);
        expect(GP.getColorDocxPct(80)).toBe('16A34A');
        expect(GP.getColorDocxFrac(0.8)).toBe('16A34A');
        expect(GP.getLabelPct(50)).toBe('Moderate');
        expect(GP.getLabelFrac(0.5)).toBe('Moderate');
    });

    test('null/undefined/non-numeric stay unknown rather than defaulting to a band', () => {
        expect(GP.getLevelPct(null)).toBeNull();
        expect(GP.getLevelFrac(undefined)).toBeNull();
        expect(GP.getLevelPct('not a number')).toBeNull();
        expect(GP.getColorPct(null)).toBe(GP.COLORS.unknown);
        expect(GP.getLabelFrac(null)).toBeNull();
    });
});

describe('GH-365 — call sites use the entry point matching their own unit', () => {
    function read(f) {
        return fs.readFileSync(path.join(__dirname, '../assets/', f), 'utf8');
    }

    // These modules hold GP as a 0-100 percentage — their own inline fallbacks
    // compare against 70/40, which is the tell.
    const percentCallers = [
        'daily-dashboard.js',
        'dashboard-init.js',
        'gaip-morning-briefing.js',
        'growth-light-analysis.js',
        'gssh-led-export.js',
    ];

    // These hold the recommender engines' 0-1 fraction (m.gp) — their fallbacks
    // compare against 0.7/0.4.
    const fractionCallers = [
        'nutrition-au-fertiliser-integration.js',
        'nutrition-prebble-integration.js',
        'nutrition-calendar.js',
        'word-export.js',
    ];

    // GH-436: these two tests were BOTH negative — "does not call the legacy
    // API" and "does not call the other unit's API". A file that stopped
    // calling GAIP_GPStatus altogether and inlined its own thresholds and
    // colours satisfied both, which is exactly what CLAUDE.md forbids
    // ("Never hardcode a separate GP threshold/palette ... load gp-status.js
    // and call it"). Proven by mutation: replacing daily-dashboard.js's
    // GAIP_GPStatus.getLevelPct( call with an inline
    // `v>=65?'high':v>=45?'moderate':'low'` left both green. Each list now
    // asserts the positive too.
    const CANON = { high: 70, moderate: 40 };

    /**
     * GH-457: files whose GAIP_GPStatus lines carry no fallback this scanner
     * can read, each with the reason — measured, not assumed. Named for what it
     * means now that colour ternaries are read too: not "no level fallback",
     * but "nothing this reader can see".
     *
     * Empty, and that is the point: word-export.js stood here reading "no
     * fallback", which was false. It has one — `gpPct >= 70 ? '16A34A' : …`
     * (word-export.js:6445) — and it decides a docx colour rather than a level
     * string, so the scanner could not see it and the list said there was
     * nothing to see. An exemption with a wrong reason is worse than a
     * forgotten file: the file at least looks unexplained, while this one
     * looked settled. The scanner reads colour ternaries now and the entry is
     * gone.
     *
     * Kept as an empty list rather than deleted, because the assertion below
     * needs somewhere to point when a file yields nothing — and because a name
     * appearing here again is a change a reader can argue with.
     */
    const NO_READABLE_FALLBACK = {
        // GH-458: it has no GP fallback at all any more. The docx colour comes
        // from GAIP_GPStatus.getColorDocxFrac(), and a missing module is
        // reported and painted with this document's own "no reading" grey,
        // which is not a growth-potential band. Nothing here for the reader
        // below to check, and that is the better state rather than an excuse.
        'word-export.js': 'no GP fallback: the module decides, a missing module is reported and rendered as "no reading"'
    };

    /**
     * One answer, in the form both sides compare: no hash, upper case. It
     * covers all four spellings at once — '#16a34a' and '16A34A' are the same
     * colour, 'high' and 'High' the same band.
     */
    const asHex = (a) => String(a).replace('#', '').toUpperCase();

    const asPercent = (v) => (v <= 1 ? Math.round(v * 1000) / 10 : v);

    /**
     * GH-457: every GP fallback in a file, as { line, subject, value, quoted }.
     *
     * Three readers stood here before this one, and each was defeated by a
     * shape rather than by a value:
     *
     *   - line-based: blind to a fallback written over several lines;
     *   - statement-based: blind to a fallback that is not in the call's own
     *     statement — an assignment patched below, a fallback computed BEFORE
     *     the call, one lifted into a helper, one further off than the window
     *     was wide;
     *   - and both recognised a ternary by its VALUES, which let a disease
     *     scale at 70 or a DLI scale at #16a34a be claimed as growth potential.
     *
     * The root was the same each time: the reader was tied to where the
     * fallback sits relative to the call. Position is the wrong question.
     *
     * What actually marks a fallback is the VARIABLE: the module is called
     * with one, and the fallback decides the same band for the same value. So
     * the window is the enclosing FUNCTION, and inside it only the ternaries
     * comparing the call's own argument — or a variable derived from it, since
     * `gpPct = Math.round(m.gp * 100)` is the same number in the other unit —
     * are read. A foreign scale in the same statement is dropped because its
     * variable is not the one the module was given.
     *
     * Not read, and recorded rather than chased: a fallback in another
     * function that this one does not call by name, and one reached through a
     * variable this reader does not connect to the argument (an object field
     * assigned elsewhere, a value round-tripped through an array). The corpus
     * has neither today.
     */
    function enclosingFunction(src, idx) {
        let i = idx, depth = 0;
        while (i > 0) {
            const ch = src[i];
            if (ch === '}') depth++;
            else if (ch === '{') {
                if (depth === 0) {
                    const head = src.slice(Math.max(0, i - 300), i);
                    if (/function\b[^{}]*$|=>\s*$/.test(head)) {
                        let j = i + 1, d = 1;
                        while (j < src.length && d > 0) {
                            if (src[j] === '{') d++;
                            else if (src[j] === '}') d--;
                            j++;
                        }
                        return { start: i, end: j };
                    }
                } else depth--;
            }
            i--;
        }
        return { start: 0, end: src.length };
    }

    /**
     * The argument, the source it was read from, and every variable in this
     * function assigned from either.
     *
     * The one step BACKWARDS is what connects a sibling reading of the same
     * quantity. growth-light-analysis.js takes `gp = growth.weighted` and, a
     * hundred lines further on, `normalVal` out of `growth.monthlyNormal` —
     * the same site's growth potential for the month instead of for today,
     * with its own fallback at the same thresholds, three lines under a
     * comment that says it mirrors the guarded one. Forward-only expansion
     * never reached it, so the file was read as covered in four places and
     * blind in the fifth, which is worse than not being checked at all.
     */
    const BUILTIN_ROOTS = new Set(['Math', 'Object', 'Array', 'JSON', 'Number', 'String',
        'Date', 'window', 'document', 'console']);

    function subjectsFor(text, arg) {
        const set = new Set([arg]);
        // The FIELD the argument was read from. `gp = growth.weighted` and
        // `normalVal` out of `monthlyNormal.c3` are two readings of the same
        // quantity on the same object, and that is the connection — not the
        // object itself. Admitting the object pulled in everything else on it:
        // dashboard-init.js reaches its GP through `m`, and `m` also carries
        // the stress index and the forecast peak, whose own scales promptly
        // arrived as growth potential.
        const fields = new Set();
        let pending = [arg], seenName = {};
        while (pending.length) {
            const name = pending.shift();
            if (seenName[name]) continue;
            seenName[name] = true;
            const re = new RegExp('(?:var|let|const)?\\s*' + name.replace('.', '\\.') + '\\s*=\\s*([^;\\n]+)', 'g');
            let a;
            while ((a = re.exec(text))) {
                // A field read off a real object, not off a built-in: without
                // this, `Math.round(...)` contributes `round`, and then every
                // rounded number in the function is "the same quantity" —
                // which is how a stress index and a forecast peak arrived as
                // growth potential. `length` is an array's size, not a reading.
                const member = /([A-Za-z_$][\w$]*)\s*(?:\[[^\]]*\])?\s*\.\s*([A-Za-z_$][\w$]*)/g;
                let f;
                while ((f = member.exec(a[1]))) {
                    if (BUILTIN_ROOTS.has(f[1]) || f[2] === 'length') continue;
                    fields.add(f[2]);
                }
                (a[1].match(/(^|[^\w$.])([A-Za-z_$][\w$]*)(?![\w$(])/g) || [])
                    .forEach((id) => pending.push(id.replace(/^[^\w$]/, '')));
            }
        }
        if (arg.indexOf('.') > 0) fields.add(arg.split('.').pop());
        // A variable that reads one of those fields is another reading of the
        // same quantity, wherever in the function it sits.
        const assign = /(?:var|let|const)?\s*([A-Za-z_$][\w$]*)\s*=\s*([^;\n]+)/g;
        let b;
        while ((b = assign.exec(text))) {
            const members = b[2].match(/([A-Za-z_$][\w$]*)\s*(?:\[[^\]]*\])?\s*\.\s*([A-Za-z_$][\w$]*)/g) || [];
            const readsSameField = members.some((mm) => {
                const parts = /([A-Za-z_$][\w$]*)\s*(?:\[[^\]]*\])?\s*\.\s*([A-Za-z_$][\w$]*)/.exec(mm);
                return parts && !BUILTIN_ROOTS.has(parts[1]) && fields.has(parts[2]);
            });
            if (readsSameField) set.add(b[1]);
        }
        let grew = true;
        while (grew) {
            grew = false;
            const re = /(?:var|let|const)?\s*([A-Za-z_$][\w$]*)\s*=\s*([^;\n]+)/g;
            let m;
            while ((m = re.exec(text))) {
                if (set.has(m[1])) continue;
                // A DIFFERENCE of two readings is not a reading: `delta =
                // Math.round(forecastAvg - todayGP)` carries the same unit but
                // answers "how much did it move", and its own scale (15 points
                // of change) has nothing to do with the module's bands. Scaling
                // by a literal stays in — `gpPct = Math.round(m.gp * 100)` is
                // the same number in the other unit, and dropping it would lose
                // two of the files this test guards.
                if (/[A-Za-z_$][\w$.]*\s*-\s*[A-Za-z_$]/.test(m[2])) continue;
                // GH-458: `growth.anything` does NOT count as a mention of
                // `growth`. Reading a FIELD off a variable is reading something
                // else that happens to live on it, and letting it through kept
                // the connection by object alive through the back door — the
                // very thing the field rule was written to replace. Isolated
                // with a band built on a field name that appears nowhere else
                // in the codebase: it was claimed as growth potential.
                const mentionsSubject = Array.from(set).some((sub) =>
                    new RegExp('(^|[^\\w$.])' + sub.replace('.', '\\.') + '($|[^\\w$.])').test(m[2]));
                if (mentionsSubject) { set.add(m[1]); grew = true; }
            }
        }
        return set;
    }

    /** A fallback lifted into a helper: `: gpLevel(gp)` — read that helper too. */
    function liftedHelper(src, afterCall) {
        const m = /^\s*:\s*([A-Za-z_$][\w$]*)\s*\(/.exec(src.slice(afterCall, afterCall + 120));
        if (!m) return null;
        const decl = new RegExp('function\\s+' + m[1] + '\\s*\\(\\s*([A-Za-z_$][\\w$]*)').exec(src);
        if (!decl) return null;
        const body = enclosingFunction(src, decl.index + decl[0].length + 1);
        return { text: src.slice(body.start, body.end), subject: decl[1] };
    }

    function gpFallbacks(src) {
        const seen = {};
        const out = [];
        const call = /GAIP_GPStatus\.\w+\s*\(\s*([A-Za-z_$][\w$.]*)\s*\)/g;
        let m;
        while ((m = call.exec(src))) {
            const fn = enclosingFunction(src, m.index);
            const scopes = [{ text: src.slice(fn.start, fn.end), offset: fn.start,
                              subjects: subjectsFor(src.slice(fn.start, fn.end), m[1]) }];
            const lifted = liftedHelper(src, m.index + m[0].length);
            if (lifted) scopes.push({ text: lifted.text, offset: src.indexOf(lifted.text),
                                      subjects: new Set([lifted.subject]) });
            scopes.forEach((scope) => {
                const bySubject = {};
                const re = /([A-Za-z_$][\w$.]*)\s*>=\s*([0-9.]+)\s*\?\s*['"]([^'"]+)['"]/g;
                let t;
                while ((t = re.exec(scope.text))) {
                    if (!scope.subjects.has(t[1])) continue;
                    const at = scope.offset + t.index;
                    if (seen[at]) continue;
                    seen[at] = true;
                    (bySubject[t[1]] = bySubject[t[1]] || []).push({ at: at, value: parseFloat(t[2]), quoted: t[3] });
                }
                Object.keys(bySubject).forEach((subject) => {
                    // One function may hold several fallbacks on the same
                    // variable — dashboard-init.js decides a level and a colour
                    // from `gp` two lines apart. They are separate chains, and
                    // the band comes from position WITHIN a chain, so the run
                    // is cut wherever a statement ends between two comparisons.
                    let ordinal = 0, previousEnd = null;
                    bySubject[subject].forEach((e) => {
                        if (previousEnd !== null && /[;}]/.test(src.slice(previousEnd, e.at))) ordinal = 0;
                        out.push({ line: src.slice(0, e.at).split('\n').length, subject: subject,
                            value: e.value, quoted: e.quoted,
                            level: ordinal === 0 ? 'high' : ordinal === 1 ? 'moderate' : 'unexpected' });
                        previousEnd = e.at;
                        ordinal++;
                    });
                });
            });
        }
        return out;
    }

    /**
     * Every spelling the module itself gives for a band: the level key, the
     * label, the page colour and the document colour. A fallback may answer in
     * any of them, and each is read back from gp-status.js so that changing one
     * there changes this test with it.
     */
    const moduleAnswers = (level) => {
        const pct = CANON[level];
        return [GP.getLevelPct(pct), GP.getLabelPct(pct), GP.getColorPct(pct), GP.getColorDocxPct(pct)];
    };

    test.each(percentCallers)('%s uses the percentage API, and only that', (file) => {
        const src = read(file);
        // positive: it really does route through the shared module
        expect(src).toMatch(/GAIP_GPStatus\.(getLevelPct|getColorPct|getColorDocxPct|getLabelPct)\(/);
        expect(src).not.toMatch(/GAIP_GPStatus\.(getLevel|getColor|getColorDocx|getLabel)\(/);
        expect(src).not.toMatch(/GAIP_GPStatus\.(getLevelFrac|getColorFrac|getColorDocxFrac|getLabelFrac)\(/);
    });

    test.each(fractionCallers)('%s uses the fraction API, and only that', (file) => {
        const src = read(file);
        expect(src).toMatch(/GAIP_GPStatus\.(getLevelFrac|getColorFrac|getColorDocxFrac|getLabelFrac)\(/);
        expect(src).not.toMatch(/GAIP_GPStatus\.(getLevel|getColor|getColorDocx|getLabel)\(/);
        expect(src).not.toMatch(/GAIP_GPStatus\.(getLevelPct|getColorPct|getColorDocxPct|getLabelPct)\(/);
    });

    test.each(percentCallers.concat(fractionCallers))(
        '%s inline fallback, where it has one, quotes the module\'s own thresholds', (file) => {
            const src = read(file);
            // Several call sites keep a literal ternary beside the module call
            // for the case where gp-status.js has not loaded. That is allowed;
            // a fallback that has DRIFTED is not, because it is then a second
            // palette wearing the module's name. Only ternaries that decide a
            // GP level are looked at — the files also colour disease severity
            // and DLI suitability on their own scales, which is out of scope by
            // design and is why a blanket hex search is the wrong test here.
            // Only the lines that ALSO name GAIP_GPStatus: these files score
            // disease, stress, irrigation and VWC on their own scales with the
            // same ternary shape, and none of those are growth potential.
            // GH-457: read the FALLBACK EXPRESSION, and bind to the variable
            // it compares.
            //
            // This was a line-based scan with two faults that came from the same
            // root — it decided what to read by pattern-matching values instead
            // of by structure:
            //
            //   - it could not see a fallback written over several lines, so
            //     growth-light-analysis.js:49-53 was unchecked even with a
            //     single drift (threshold moved, colour left canonical, 27 of 27
            //     green). That file is also one of the three carrying a
            //     hardcoded GP palette, so the place a ticket is being prepared
            //     for was guarded in neither direction;
            //   - and the rule that recognised a ternary by "canonical colour OR
            //     canonical threshold" reached over into other scales: a disease
            //     scale at 70 would be claimed by the threshold key and then
            //     fail on its colour, a DLI scale at #16a34a claimed by the
            //     colour key and failed on its threshold. #16a34a is Tailwind's
            //     green-600, so that collision is ordinary, not exotic.
            //
            // Both go away together. A fallback is the expression that follows
            // the module call, to the end of that statement — not a window of N
            // lines, which is what dragged the neighbouring scales in — and
            // inside it the ternaries are grouped by the variable they compare.
            // Everything in such a group is a GP decision by construction, so
            // nothing has to be recognised by its value, and a drift in the
            // threshold, in the colour, or in both is equally visible.
            const quoted = gpFallbacks(src);
            // GH-457: a file that yields nothing now has to say why.
            // "The scanner found no thresholds" and "the file has no inline
            // fallback" are different statements, and reading the first as the
            // second is what hid the capitalised fallbacks above. A file yields
            // at least one threshold, or it is named with a reason someone can
            // check.
            if (!quoted.length) {
                expect({ file: file, listed: Object.prototype.hasOwnProperty.call(NO_READABLE_FALLBACK, file) })
                    .toEqual({ file: file, listed: true });
                expect(NO_READABLE_FALLBACK[file].length).toBeGreaterThan(20);
            }
            // Both halves of the project rule are checked: the threshold AND
            // the answer the fallback gives at it. "Never hardcode a separate
            // GP threshold/palette" — the palette half went unguarded while the
            // colour was only ever used to decide whether to look.
            const drifted = quoted.filter((q) => {
                if (q.level === 'unexpected') return true;
                if (asPercent(q.value) !== CANON[q.level]) return true;
                return !moduleAnswers(q.level).some((a) => asHex(a) === asHex(q.quoted));
            }).map((q) => ({
                file: file, line: q.line, subject: q.subject, level: q.level,
                quoted: q.value, module: CANON[q.level] === undefined ? null : CANON[q.level],
                quotedAnswer: q.quoted, moduleAnswers: moduleAnswers(q.level)
            }));
            expect(drifted).toEqual([]);
        });

    test('an exemption without a reason is not an exemption', () => {
        // GH-457: the list is empty today, and the way it stops being empty
        // matters more than its contents. word-export.js sat in it under a
        // reason that was false; the next step down is an entry with no reason
        // at all, which nobody can argue with because there is nothing to
        // argue with. A name goes in with a sentence a reader can check, or it
        // does not go in.
        //
        // Asserted over the whole list rather than per file, so it holds for
        // an entry whose file still yields thresholds and never reaches the
        // check inside the test above.
        const withoutReason = Object.keys(NO_READABLE_FALLBACK).filter((f) => {
            const reason = NO_READABLE_FALLBACK[f];
            return typeof reason !== 'string' || reason.trim().length <= 20;
        });
        expect(withoutReason).toEqual([]);
    });

    test('CANON is the module\'s own pair, not two numbers typed twice', () => {
        // Everything above is measured against CANON, so CANON has to be the
        // module's. Read back through the module's own behaviour: moving the
        // threshold in gp-status.js fails this line rather than leaving the
        // assertions above pinned to a stale 70/40.
        expect(GP.HIGH_THRESHOLD).toBe(CANON.high);
        expect(GP.MODERATE_THRESHOLD).toBe(CANON.moderate);
        expect(GP.getLevelPct(CANON.high)).toBe('high');
        expect(GP.getLevelPct(CANON.high - 0.1)).toBe('moderate');
        expect(GP.getLevelPct(CANON.moderate)).toBe('moderate');
        expect(GP.getLevelPct(CANON.moderate - 0.1)).toBe('low');
    });
});
