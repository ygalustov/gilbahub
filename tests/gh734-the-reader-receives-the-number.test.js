/**
 * GH-734 (queue item 3az) — A READER OF THE RUN'S SOIL TEMPERATURE RECEIVES A NUMBER.
 *
 * THE REVIEWER'S RETURN, and the hole it named: "six readers take the run's result" was held by the
 * TEXT of the call — `GaipOrchestrator.getComputed('soilTempPhysics')` — and by nothing else. Her
 * mutation proved it: change a reader's field from `raw.T_50mm` to `raw.T_5mm` and every test stays
 * green, because a reader that asks the run and is handed `undefined` looks exactly like a reader
 * that takes the run's number.
 *
 * TWO HALVES, and the first is why the second is possible at all:
 *   1. THE SHAPE IS MEASURED, not restated. The producer is run — `gaip_enhanced_soil_temp` for
 *      `raw`, `gaip_soil_temp_summary` for `summary` — and the top level of the result is read off
 *      the orchestrator's own assignment. Every field every reader reads is then held against that.
 *   2. THE NUMBER IS FOLLOWED IN, for each reader reachable through an exported entry point: the
 *      result goes in through the accessor and the reader's own answer has to carry the value that
 *      was put there, by the depth it claims to read.
 *
 * WHAT IT FOUND ON THE FIRST RUN, which is why it exists rather than confirming what was already
 * believed: `soil-temp-logger.js` read `depths.d50mm`, `d100mm` and `d10mm` — the CANONICAL STATE's
 * spelling of the depths, not the producer's — so its "priority 2: the run's physics result" was
 * `undefined` on every run and it fell through to the canonical state, logging `source: 'canonical'`
 * for a number the run had computed. The reviewer's class, with a live case inside it.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');
/**
 * The same file with its comments taken out. Every place in this file that asks "who reads the run's
 * result" asks it of CODE: this census went red on its own first full run because a comment written
 * the same hour quoted the accessor call, and a file that only mentions the call in prose was
 * counted as a reader. The class is a known one here — an assertion about absence, made over text
 * that includes the explanations of what was removed.
 */
const code = (p) => read(p).replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/^[ \t]*\/\/.*$/gm, ' ');
const ORCH = read('assets/hub-orchestrator.js');

/** A synthetic hourly series long enough for the model, and not flat. */
function hours(n, f) {
    return Array.from({ length: n }, (_, i) => f(i));
}

/**
 * THE RESULT OF A RUN, built by running the producer rather than by writing a shape here.
 * The top level is the orchestrator's own `_hubState.computed.soilTempPhysics = { … }`.
 */
function runResult() {
    const m = require(path.join(ROOT, 'assets/gaip-soil-temp-integration.js'));
    const raw = m.enhancedSoilTemperature(
        hours(96, (i) => 15 + 6 * Math.sin(i / 4)),
        hours(96, (i) => Math.max(0, 320 * Math.sin(i / 4))),
        0.22,
        { profileType: 'usga' },
    );
    const summary = m.getSoilTempSummary(raw);

    return {
        raw,
        summary,
        profileType: 'usga',
        inputs: { moisture: 0.22, profile: 'usga', cec: null, om: null, hourlySource: 'climateMetrics.hourly' },
    };
}

/** The top-level keys of the result, read off the assignment that writes it. */
function topLevelKeys() {
    const at = ORCH.indexOf('_hubState.computed.soilTempPhysics = {');
    expect(at).toBeGreaterThan(-1);
    const open = ORCH.indexOf('{', at);
    let depth = 0, end = -1;
    for (let i = open; i < ORCH.length; i++) {
        if (ORCH[i] === '{') depth++;
        else if (ORCH[i] === '}') { depth--; if (!depth) { end = i; break; } }
    }
    expect(end).toBeGreaterThan(open);
    const body = ORCH.slice(open + 1, end);
    // Top-level `name:` of the literal — depth zero only.
    const keys = [];
    let d = 0;
    for (const line of body.split('\n')) {
        const m = d === 0 ? /^\s*([A-Za-z_][\w]*)\s*:/.exec(line) : null;
        if (m) keys.push(m[1]);
        for (const ch of line) {
            if (ch === '{' || ch === '(' || ch === '[') d++;
            else if (ch === '}' || ch === ')' || ch === ']') d--;
        }
    }

    return keys;
}

/**
 * Every property path a file reads off the run's result, by scanning forward from each occurrence
 * of the variable the accessor's answer is put in. `?.`, `.`, `['x']` and `["x"]` all count; a call
 * or an index by number ends the path, because what follows is no longer a field of the result.
 */
function pathsReadOff(src, varName) {
    const out = [];
    const re = new RegExp('(?<![\\w$])' + varName.replace('$', '\\$') + '(?![\\w$])', 'g');
    let m;
    while ((m = re.exec(src)) !== null) {
        let i = m.index + varName.length;
        const segs = [];
        for (;;) {
            if (src.startsWith('?.[', i)) i += 3;
            else if (src.startsWith('?.', i)) i += 2;
            else if (src[i] === '.') i += 1;
            else if (src[i] === '[') i += 1;
            else break;
            const q = /^\s*(['"])([^'"]+)\1\s*\]/.exec(src.slice(i));
            const w = /^\s*([A-Za-z_$][\w$]*)/.exec(src.slice(i));
            if (q) { segs.push(q[2]); i += q[0].length; }
            else if (w) { segs.push(w[1]); i += w[0].length; }
            else break;
            if (src[i] === '(') break; // a method call, not a field of the result
        }
        if (segs.length) out.push(segs.join('.'));
    }

    return [...new Set(out)].sort();
}

/** The files that take the run's result, and the variable each one puts it in. */
const READERS = [
    { file: 'assets/disease-forecast.js', v: '_runPhysics' },
    { file: 'assets/overseed-climate-integration.js', v: '_runPhysics' },
    { file: 'assets/disease-engine-pure.js', v: '_runPhysics' },
    { file: 'assets/large-patch-model.js', v: '_runPhysics' },
    { file: 'assets/soil-temp-logger.js', v: 'gst' },
    { file: 'assets/hub-persistence.js', v: '_stp' },
];
/**
 * SIX, and the sixth is not `climate-module-v2-ui.js`. The panel names this accessor only in the
 * comment that explains what it used to publish; in code it computes the model itself, which is the
 * second calculation item 3az still carries as a remainder. Counting prose as a reader is what the
 * comment-stripping above prevents.
 */

describe('GH-734 — the reader receives the number, and not only the call', () => {
    test('the universe is the files that ask the run for it, and the list is taken from them', () => {
        const found = fs.readdirSync(path.join(ROOT, 'assets'))
            .filter((f) => f.endsWith('.js'))
            .filter((f) => code('assets/' + f).includes("getComputed('soilTempPhysics')"))
            .map((f) => 'assets/' + f)
            .sort();
        process.stdout.write('[gh734] files asking the run for the soil temperature: '
            + JSON.stringify(found) + '\n');
        // Compared as a LIST: a file that starts asking and a file that stops are each red by name.
        expect(found).toEqual(READERS.map((r) => r.file).sort());
    });

    test('the shape of the result is measured by running its producer', () => {
        const res = runResult();
        const top = topLevelKeys();
        process.stdout.write('[gh734] the result, top level (from the orchestrator): ' + JSON.stringify(top) + '\n'
            + '[gh734] raw: ' + JSON.stringify(Object.keys(res.raw)) + '\n'
            + '[gh734] summary: ' + JSON.stringify(Object.keys(res.summary)) + '\n'
            + '[gh734] summary.depths: ' + JSON.stringify(Object.keys(res.summary.depths)) + '\n');

        // Positive control: an empty shape agrees with every reader.
        expect(top.sort()).toEqual(['inputs', 'profileType', 'raw', 'summary']);
        expect(Object.keys(res.summary.depths).length).toBeGreaterThan(3);
        expect(res.summary.depths['50mm'].mean).toBeGreaterThan(0);
    });

    test('the census by text is printed, and its blindness is printed beside it', () => {
        const res = runResult();
        const top = topLevelKeys();
        const missing = [];
        const seen = {};

        const exists = (segs) => {
            let node = res;
            for (const s of segs) {
                if (node === null || typeof node !== 'object') return false;
                if (!(s in node)) return false;
                node = node[s];
            }
            return true;
        };

        READERS.forEach(({ file, v }) => {
            const paths = pathsReadOff(code(file), v);
            seen[file] = paths;
            paths.forEach((p) => {
                const segs = p.split('.');
                if (!top.includes(segs[0])) { missing.push(file + ' -> ' + p + ' (not a field of the result)'); return; }
                if (!exists(segs)) missing.push(file + ' -> ' + p);
            });
        });

        process.stdout.write('[gh734] what each reader reads off it:\n'
            + Object.entries(seen).map(([f, p]) => '   ' + f + ': ' + JSON.stringify(p)).join('\n') + '\n'
            + '[gh734] fields read that the result does not carry: ' + JSON.stringify(missing) + '\n');

        /**
         * WHAT THIS HALF CANNOT SEE, and it is said here rather than left to be assumed: a reader
         * that puts the result in one variable and its depths in another is read only as far as the
         * first. `soil-temp-logger.js` shows `summary` and `summary.depths` and not the three depth
         * names it actually reads, which is exactly where its defect was. So this case does not
         * assert coverage; it prints what was inspected, and the executed cases below are what hold
         * the claim.
         */
        expect(Object.values(seen).flat().length).toBeGreaterThan(8);
        expect(missing).toEqual([]);
    });
});

/**
 * THE EXECUTED HALF. Each reader is given the run's result through the accessor and asked its own
 * question, twice, on two results that differ ONLY in the physics numbers. A reader that receives
 * the number answers differently; a reader handed `undefined` falls through to its own estimate and
 * answers the same both times, which is the reviewer's mutation seen from the other side.
 */
const COLD = 4, WARM = 26;

/** A result of the shape the run writes, with a 50mm/100mm series held at one value. */
function resultHeldAt(degrees) {
    const m = require(path.join(ROOT, 'assets/gaip-soil-temp-integration.js'));
    const raw = m.enhancedSoilTemperature(hours(96, () => degrees), hours(96, () => 0), 0.22,
        { profileType: 'usga' });
    const summary = m.getSoilTempSummary(raw);

    return { raw, summary, profileType: 'usga',
        inputs: { moisture: 0.22, profile: 'usga', cec: null, om: null, hourlySource: 'test' } };
}

/** A sandbox that looks enough like a page, with the run's result behind the accessor. */
function pageWith(result, extras) {
    const sb = { console: { log() {}, warn() {}, error() {}, info() {}, debug() {} },
        Math, JSON, Date, Array, Object, String, Number, isNaN, parseFloat, parseInt,
        setTimeout: () => 0, clearTimeout: () => 0,
        GaipOrchestrator: { getComputed: (k) => (k === 'soilTempPhysics' ? result : null) } };
    Object.assign(sb, extras || {});
    sb.window = sb; sb.global = sb; sb.globalThis = sb; sb.self = sb;
    sb.document = sb.document || { addEventListener() {}, querySelector: () => null,
        querySelectorAll: () => [], getElementById: () => null, createElement: () => ({ style: {} }) };
    sb.addEventListener = sb.addEventListener || (() => {});
    vm.createContext(sb);

    return sb;
}

/** A file's own source, run in that sandbox. */
function runIn(sb, file) {
    vm.runInContext(read(file), sb, { filename: file });

    return sb;
}

/** One function lifted out of a file and run as the function it is. */
function liftFunction(file, signature) {
    const src = read(file);
    const at = src.indexOf(signature);
    expect(at).toBeGreaterThan(-1);
    let depth = 0, end = -1;
    for (let i = src.indexOf('{', at); i < src.length; i++) {
        if (src[i] === '{') depth++;
        else if (src[i] === '}') { depth--; if (!depth) { end = i; break; } }
    }
    expect(end).toBeGreaterThan(at);

    return src.slice(at, end + 1);
}

/**
 * WHICH READERS ARE FOLLOWED IN AND WHICH ARE NOT, by name. A reader added to the census above is
 * red here until it is put in one of these two lists, so coverage is a decision somebody made
 * rather than a silence.
 */
const FOLLOWED_IN = [
    'assets/disease-forecast.js',
    'assets/large-patch-model.js',
    'assets/overseed-climate-integration.js',
    'assets/soil-temp-logger.js',
];
const NOT_FOLLOWED_IN = {
    'assets/disease-engine-pure.js':
        'its soil pathway needs a whole disease run to answer; the field it reads is covered by the'
        + ' census above and its arrival is not measured here',
    'assets/hub-persistence.js':
        'the producer, whose reading goes through `soilTempAt100mm` and accepts both spellings of a'
        + ' depth; what the row carries is measured in gh734-the-run-computes-the-soil-temperature',
};

describe('GH-734 — followed in: the number the run computed reaches each reader', () => {
    test('every reader is either followed in below or named as not followed in', () => {
        const all = READERS.map((r) => r.file).sort();
        const classified = [...FOLLOWED_IN, ...Object.keys(NOT_FOLLOWED_IN)].sort();
        process.stdout.write('[gh734] followed in: ' + JSON.stringify(FOLLOWED_IN.sort()) + '\n'
            + Object.entries(NOT_FOLLOWED_IN).map(([f, why]) => '[gh734] not followed in: ' + f + ' — ' + why).join('\n') + '\n');
        expect(classified).toEqual(all);
    });

    test('disease-forecast builds its daily soil temperatures out of the run result', () => {
        /**
         * THE REVIEWER'S OWN CASE. Her mutation was `raw.T_50mm` -> `raw.T_5mm` in this file, and
         * every test stayed green. `buildDailyClimate` is lifted and run as the function it is: its
         * soil temperatures come from the run's 50mm series, or, with nothing there, from a
         * three-day rolling average of the AIR temperature — which is the same for both results.
         */
        const body = liftFunction('assets/disease-forecast.js', 'function buildDailyClimate(');
        const pattern = hours(4, (i) => ({ mean: 18 + i, min: 12 + i, max: 24 + i, date: '2026-09-0' + (i + 1) }));
        const climate = { moisture: { humidity: { mean: 70 } } };

        const answer = (degrees) => {
            const sb = pageWith(resultHeldAt(degrees));
            vm.runInContext(body + '\nthis.fn = buildDailyClimate;', sb);

            return sb.fn(pattern, climate).map((d) => d.soilTemp);
        };
        const cold = answer(COLD), warm = answer(WARM);
        process.stdout.write('[gh734] disease-forecast daily soil temps, run held at ' + COLD + ': '
            + JSON.stringify(cold) + '\n[gh734]   and held at ' + WARM + ': ' + JSON.stringify(warm) + '\n');

        expect(cold.length).toBe(pattern.length);
        expect(cold).not.toEqual(warm);
        // and it is the RUN's number, not an air-temperature estimate of it
        expect(cold[0]).toBeCloseTo(COLD, 0);
        expect(warm[0]).toBeCloseTo(WARM, 0);
    });

    test('large-patch-model takes the 50mm depth of the run result and says so', () => {
        const answer = (degrees) => {
            const sb = runIn(pageWith(resultHeldAt(degrees)), 'assets/large-patch-model.js');
            const out = sb.LargePatchModel.calculate(
                { temperature: { mean: 20, min: 14, max: 26 }, moisture: { humidity: { mean: 80 } },
                    precipitation: { total: 10 } },
                { status: 'adequate' }, null, {}, null, 'zoysia');

            return out;
        };
        const cold = answer(COLD), warm = answer(WARM);
        process.stdout.write('[gh734] large-patch soil source: ' + JSON.stringify(cold.drivers?.soilTemperature
            || cold.drivers) + '\n[gh734]   risk cold/warm: ' + cold.riskScore + ' / ' + warm.riskScore + '\n');

        expect(JSON.stringify(cold)).toContain('physics_model_50mm');
        expect(cold.riskScore).not.toBe(warm.riskScore);
    });

    test('the overseed reader answers with the run result and not with an air estimate', () => {
        const answer = (degrees) => {
            const sb = runIn(pageWith(resultHeldAt(degrees)), 'assets/overseed-climate-integration.js');
            expect(typeof sb.gaip_overseed_climate?.estimateSoilTemp).toBe('function');

            return sb.gaip_overseed_climate.estimateSoilTemp([18, 19, 20]);
        };
        const cold = answer(COLD), warm = answer(WARM);
        process.stdout.write('[gh734] overseed estimateSoilTemp, cold/warm: ' + cold + ' / ' + warm + '\n');

        expect(cold).not.toBe(warm);
        expect(cold).toBeCloseTo(COLD, 0);
    });

    test('the soil temperature logger reads the run result, and its caller throws it away', () => {
        /**
         * THE CASE THIS FILE FOUND, and it is two facts rather than one.
         *
         * FIRST, the read was impossible: priority 2 of this reader is "the run's physics result"
         * and it asked for `depths.d50mm`, `d100mm`, `d10mm` — the canonical state's spelling of the
         * depths. The producer's keys are `'50mm'` and the like, measured above, so the branch
         * answered `undefined` on every run and the reader fell through to the canonical state. It
         * asked the run and took a copy. The canonical state below carries a number no run could
         * produce from a flat series, so falling through is visible rather than hidden behind two
         * paths to one value.
         *
         * SECOND, AND IT IS THE HONEST BOUNDARY: the only caller of this reader is `logReading`,
         * which persists SENSOR sources only and discards everything else by name — so no person
         * sees a number that came through here today, and the repair above is a trap closed rather
         * than a screen corrected. That refusal is asserted below, so this case cannot be read as
         * "the log holds the run's number".
         */
        const body = liftFunction('assets/soil-temp-logger.js', 'function readCurrentSoilTemp(');
        const answer = (degrees) => {
            const sb = pageWith(resultHeldAt(degrees), {
                GAIP_CANONICAL_STATE: { soilTemp: { depths: { d50mm: 55.5 }, source: 'canonical' } },
            });
            vm.runInContext(body + '\nthis.fn = readCurrentSoilTemp;', sb);

            return sb.fn();
        };
        const cold = answer(COLD), warm = answer(WARM);
        process.stdout.write('[gh734] the logger reads, run held at ' + COLD + ': ' + JSON.stringify(cold)
            + '\n[gh734]   and held at ' + WARM + ': ' + JSON.stringify(warm) + '\n');

        expect(cold).not.toBeNull();
        expect(cold.source).toBe('physics_model');
        expect(cold.temp).toBeCloseTo(COLD, 0);
        expect(warm.temp).toBeCloseTo(WARM, 0);

        // The boundary, asserted rather than described: the caller keeps sensor sources only.
        const caller = liftFunction('assets/soil-temp-logger.js', 'function logReading(');
        expect(caller).toContain("var sensorSources = ['sensor', 'hydrosight', 'tdr', 'pogo']");
        expect(caller).toMatch(/if \(!isSensorSource\) \{[\s\S]*?return;/);
        process.stdout.write('[gh734] and its only caller persists sensor sources only, so nothing a'
            + ' person sees depends on this read today\n');
    });
});