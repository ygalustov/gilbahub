/**
 * GH-676 (queue item 6, remainder of stage 0b; the analyst's 59.4) — THE GRAPH
 * AGAINST THE CODE AND AGAINST THE INPUTS LIST, WITH THE HOLES PRINTED.
 *
 * WHAT THIS RUN IS FOR. The graph data file has just been transformed out of the
 * definitions that lived in `dependency-graph.js`, and three of its fields are
 * deliberately empty: `runner`, `handle`, and the split of the old `inputs` into
 * `requires` and `uses`. That split is a JUDGEMENT about what a module does without
 * an input — not compute at all, or compute differently — and a machine cannot make
 * it. So THIS TEST'S FIRST RUN IS THE WORK ITEM: it prints every hole with its node
 * and field, and the data is filled from that list, one line at a time, instead of
 * from a table retyped by hand. The two tables in the analyst's own plan have
 * already drifted from each other — seven records against eighty-six — which is why
 * neither of them is the source.
 *
 * THE UNIVERSES ARE THE CODE AND THE DATA, NEVER A LIST WRITTEN HERE:
 *   (a) what a real pass WROTE — the `computed` roots of the rows on the stand —
 *       against the nodes that declare them;
 *   (b) every `handle` must resolve to a function that exists;
 *   (c) what a module's body READS against what its node declares;
 *   (d) the graph against the inputs list, in both directions.
 *
 * WHAT THIS DEVICE DOES NOT GUARD — written as UNCOVERED rather than as a property of
 * the subject, which is return 4, and the difference matters. "The split is a judgement"
 * reads as a fact about inputs; "the split is not guarded" reads as a hole in this file,
 * which is what it is:
 *
 *   - WHICH SIDE a read falls on, `requires` or `uses`, is NOT GUARDED. The evidence
 *     case prints the line it stands on and whether that line substitutes, and the split
 *     was made from that -- but nothing here reddens if a `uses` should have been a
 *     `requires`. The one exception is the single `requires` in the graph, which is
 *     EXECUTED rather than declared.
 *   - READS THROUGH AN ALIAS are not extracted. They are allowed by name with a reason
 *     and a new one reddens, which bounds the hole without closing it.
 *   - READS THROUGH A COMPUTED NAME (`e[section][key]`) are not extracted at all, and
 *     unlike the aliases they cannot even be listed: nothing in the text says which
 *     section.
 *   - KIND 3 of the analyst's 59.7 -- a fallback chain across two stores of one input,
 *     and state derived from an input -- is outside every claim here.
 *
 * WHAT IS ASSERTED TODAY AND WHAT IS PRINTED. Asserted: the facts that must hold
 * whatever the data is — the file loads, every node declares outputs, no two nodes
 * claim the same output, and no module known to be absent has appeared beyond the
 * three the analyst already named. Printed: the holes, so the next step has its
 * list. A test that asserted the finished state would be red on the day the file
 * was created and would say nothing about progress.
 *
 * THE BOUNDARY OF UNIVERSE (a), named rather than discovered: the roots come from
 * the rows a real pass wrote ON THE STAND, not from a fixture. A module that has
 * never run there is invisible to it — which is why the other direction, a node
 * that never produced, is printed too.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const GRAPH = JSON.parse(fs.readFileSync(path.join(ROOT, 'assets', 'dependency-graph.json'), 'utf8'));
const LIST = JSON.parse(fs.readFileSync(path.join(ROOT, 'assets', 'calculation-inputs.schema.json'), 'utf8'));
const NODES = GRAPH.nodes;

/** The `computed` roots a real pass wrote, read from the stand. */
function rootsWrittenOnTheStand() {
    try {
        const out = execFileSync('docker', ['exec', 'gilba_mysql', 'mysql', '-ugilba', '-pgilba_secret',
            'gilba', '-N', '-e',
            "SELECT DISTINCT JSON_KEYS(computed) FROM analysis_results WHERE computed IS NOT NULL"],
        { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
        const keys = new Set();
        out.split('\n').filter((l) => l.trim()).forEach((line) => {
            try { JSON.parse(line).forEach((k) => keys.add(k)); } catch (e) { /* not a row */ }
        });

        return { keys: [...keys].sort() };
    } catch (e) {
        // RETURN 8 — AN UNREACHABLE STAND IS A FAILURE, NEVER A PASS.
        //
        // This returned `null` and the cases below asserted the null, so with no
        // database the whole of universe (a) reported success while checking nothing.
        // Three tools were found doing that today; the reviewer's reason for fixing it
        // here and now rather than in the general item: in a week it becomes "that is
        // how ours work". The message carries what failed, so a reader does not have
        // to guess whether it is the stand or the query.
        return { unreachable: (e && e.message ? String(e.message).split('\n')[0] : String(e)) };
    }
}

/**
 * Every output any node declares, AS A ROOT — and the rooting is the repair of my
 * own first comparison. A row writes `computed.firmness`; the node declares
 * `firmness.FI`, `firmness.softnessRisk` and three more. Comparing those as written
 * made sixteen modules look like orphans when each has a node: the two sides simply
 * speak at different depths. Roots on both sides, and the sub-keys stay in the file
 * where they say what the module fills in.
 */
const declaredOutputs = () => {
    const out = new Map();
    Object.entries(NODES).forEach(([id, node]) => {
        (node.outputs || []).forEach((o) => {
            const root = o.replace(/^computed\./, '').replace(/^window\./, '').split('.')[0];
            if (!out.has(root)) out.set(root, []);
            if (!out.get(root).includes(id)) out.get(root).push(id);
        });
    });

    return out;
};

/**
 * The pass's own bookkeeping, which is not a module's output and never had a node.
 * Named rather than filtered by a rule, so a real module cannot hide behind the
 * exception.
 */
const PASS_ACCOUNT = {
    attempted: 'what the pass tried, written by the pass itself',
    skipped: 'the pass\'s own list of steps it did not run',
    warnings: 'the pass journal',
    passInputs: 'what the pass was handed, recorded by the pass',
    passStartedAt: 'the pass clock',
    // GH-777 (queue item 4, slice 2): the pass's THIRD account of itself, beside what it tried and what
    // it skipped — the modules this site is not a case for, each with the inputs whose absence made it
    // so. Not a result an engine produced, so a node for it would say the opposite of what it is.
    notApplicable: 'the pass\'s own list of modules this site is not a case for',
    // MOVED HERE BY ITEM 6a, and the reason was measured rather than preferred:
    // `GilbaEngineConfidence.getConfidenceSummary(_hubState)` is handed the PASS, not
    // an input. It reads no key of the inputs list, and its `after` would have to name
    // every node in the graph. A summary OF the graph is not a node IN it.
    //
    // GH-777 (queue item 4, slice 2) — AND THAT IS NO LONGER WHERE IT LIVES. The walk that replaced the
    // pass's hand-written declarations reads the graph to know who runs, so a member with no node would
    // have lost its account of itself; the analyst's answer of 29.09.2026 was to declare it, `after`
    // naming every other node of the pass, which is exactly what "it can only be last" means. It is a
    // node now, so it is not listed here — the line stays as the record of why it was.
};

/**
 * SECTIONS THE ROW PRODUCER ASSEMBLES — a fifth class, and the last two roots of
 * universe (a) are in it.
 *
 * `hub-persistence.js` builds the stored row, and on the way it writes two `computed`
 * sections of its own out of results other modules produced: the MLSN nutrients and
 * the soil sample become `soilNutrition`, the irrigation result and the water sample
 * become `waterBalance`. Neither is a module: no engine is called, no input is read
 * that its sources did not already read. Giving them nodes would put two modules in
 * the graph that do not exist, and every `requires` written on them would be a copy of
 * another node's.
 *
 * They are named here so that a real module cannot arrive under cover of the
 * exception: a SIXTH root with no node still reddens.
 */
const ROW_SECTIONS = {
    soilNutrition: 'assembled by the row producer from the MLSN engine\'s nutrients and the soil sample (`hub-persistence.js`, `cache.computed.soilNutrition`)',
    waterBalance: 'assembled by the row producer from the irrigation result and the water sample (`hub-persistence.js`, `cache.computed.waterBalance`)',
};

/**
 * Modules known to have no node, named by the analyst with the reason. A FOURTH
 * appearing here is the thing this direction exists to catch.
 */
/**
 * Modules that were written by a pass with no node to declare them. ITEM 6a EMPTIED
 * THIS LIST, and what emptied each one is written beside it rather than deleted:
 *
 *   soilStructure    -> a node of its own, `soil-structure-engine`, the cascade's
 *                       `executeSoilStructureEngine`. The only one of the three the
 *                       plan named that was genuinely missing.
 *   water            -> the node existed under another id. `water-blender` IS the
 *                       water engine (`executeWaterEngine` -> `global.waterEngine`),
 *                       and `computed.water` is now declared beside `computed.waterBlend`.
 *                       Same class as `mlsn-engine` <-> `mlsn-calculator`.
 *   soilTempPhysics  -> a node of its own, `soil-temp-physics`. Its call lives in the
 *                       orchestrator's `populateCanonicalState`; moving it into the
 *                       pass proper is item 3az.
 *   mlsnRows         -> declared by `mlsn-calculator`, which writes it beside `mlsn`.
 *   salinityPenalty  -> declared by `salinity-penalty-engine`. ONE module, TWO
 *                       spellings by the two passes: the cascade writes
 *                       `computed.salinityPenalty`, the orchestrator `computed.salinity`.
 *   wearRecovery     -> declared by `wear-recovery-engine`; the cascade writes it as an
 *                       alias of `computed.wear`.
 *   forecast         -> declared by `disease-forecast`, whose output was MISNAMED
 *                       `computed.diseaseForecast` — a key no pass has ever written.
 *   confidence       -> the pass account, above.
 *   soilNutrition,
 *   waterBalance     -> `ROW_SECTIONS`, above.
 *
 * An eleventh appearing here is what this direction exists to catch, and the list
 * being empty is the claim now rather than a hope.
 */
const KNOWN_ABSENT = {
    /**
     * GH-787 (queue item 3vy) — A KEY THE PASSES OF THE PAST WROTE, and the past is what this universe reads.
     *
     * `wearRecovery` was the cascade's alias of its own wear result: the wear engine ran twice per pass, once
     * per runner, each with its own assembly of its inputs, and the second figure was stored beside the shown
     * one. Measured on the stand, last row of every site: the two disagreed about the recovery window at 10 of
     * 10 sites (`Test5 - NZ` 17 days against 7) and about the species they were given at all 10. The graph
     * names one runner now and no code writes this key.
     *
     * It is declared here rather than removed, because this universe is `SELECT DISTINCT JSON_KEYS(computed)`
     * over EVERY row ever stored, and the rows of the past are data we do not edit. It disappears from the
     * census on its own once no stored row is old enough to carry it.
     */
    wearRecovery: 'the cascade\'s second wear result, removed by GH-787; still present in rows written before it',
};


/**
 * UNIVERSE (c) — WHAT A MODULE'S BODY READS, WITH THE RECEIVER TAKEN FROM THE
 * FUNCTION'S OWN SIGNATURE.
 *
 * The sign is the first PARAMETER, not a list of names, and that is the analyst's
 * requirement: a delegate written `function gaip_firmness_engine(e, t)` reads
 * `e.turf.drainage`, and a census looking for `state.` or `turf.` walks straight
 * past it. A parameter survives renaming; a list of names does not.
 *
 * THE UNIVERSE OF FILES IS EVERY SCRIPT IN `assets`, so the ORCHESTRATOR is in it by
 * construction — the reviewer's condition. `GH-644` looks only inside the cascade's
 * engines, which is why `drainage` was invisible to it, and the orchestrator's own
 * `build…Inputs` builders were in no universe at all.
 */
function scriptFiles() {
    return fs.readdirSync(path.join(ROOT, 'assets'))
        .filter((f) => f.endsWith('.js') && !f.endsWith('.min.js'))
        .sort()
        .map((f) => path.join(ROOT, 'assets', f));
}


/**
 * A WRITE IS NOT A READ, and the sign could not tell them apart.
 *
 * `irrigationConfig.soil.moisture = sensorVWC` was reported as the irrigation node
 * reading `soil.moisture`; it is the builder WRITING the sensor's value. A node that
 * declares an input it only writes would then require a value from the client that the
 * run produces itself. Found, like the four faults before it, by this test's own
 * output rather than by re-reading the sign.
 */
function isAssignmentTo(body, index, length) {
    const after = body.slice(index + length, index + length + 4);

    return /^\s*=[^=]/.test(after);
}

/**
 * A function's signature and body, found by name across the universe.
 *
 * THE NAME MAY BE QUALIFIED `file:function`, and it has to be allowed to be:
 * `generateForecast` is declared in BOTH `disease-forecast.js` and `pgr-forecast.js`,
 * so a bare name would resolve to whichever file this listing reached first. That is
 * the silent first match, and it is the class the substring row matcher and the
 * line-anchored changelog reading both belonged to. `handlesThatDoNotResolve` below
 * reddens on an ambiguous bare name rather than choosing one.
 */
function filesDeclaring(name) {
    return scriptFiles().filter((f) => fs.readFileSync(f, 'utf8').indexOf('function ' + name + '(') !== -1)
        .map((f) => path.relative(ROOT, f));
}

function functionNamed(handle) {
    if (!handle) return null;
    const qualified = handle.indexOf(':') !== -1;
    const name = qualified ? handle.slice(handle.indexOf(':') + 1) : handle;
    const wanted = qualified ? handle.slice(0, handle.indexOf(':')) : null;
    for (const file of scriptFiles()) {
        if (wanted && path.relative(ROOT, file) !== wanted) continue;
        const src = fs.readFileSync(file, 'utf8');
        const at = src.indexOf('function ' + name + '(');
        if (at === -1) continue;
        const open = src.indexOf('(', at);
        const close = src.indexOf(')', open);
        const params = src.slice(open + 1, close).split(',').map((x) => x.trim()).filter((x) => x);
        let depth = 0;
        for (let j = src.indexOf('{', close); j < src.length; j++) {
            if (src[j] === '{') depth++;
            else if (src[j] === '}') {
                depth--;
                if (!depth) {
                    // COMMENTS ARE NOT CODE. The reads are extracted from the body, and
                    // a docblock inside it naming `soil.pH` and `soil.Mn_ppm` made this
                    // census report six reads `buildDiseaseInputs` does not make — the
                    // same mistake census 1 of GH-674 made on the same kind of prose.
                    // Stripped here, at the one place a body is produced, so no caller
                    // can forget: line breaks are kept so a line is still a line.
                    const body = src.slice(close, j + 1)
                        .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
                        .split('\n')
                        .map((l) => l.replace(/(^|[^:])\/\/.*$/, '$1'))
                        .join('\n');

                    return { file: path.relative(ROOT, file), name, params, body, source: src.slice(close, j + 1) };
                }
            }
        }
    }

    return null;
}

/**
 * Every `<receiver>.<section>.<field>` a body reads, plus the delegates it reaches
 * through a global — the wrapper's reads and its delegate's are one module's reads.
 */
function readsOf(handle, seen = new Set()) {
    const fn = functionNamed(handle);
    const name = handle && handle.indexOf(':') !== -1 ? handle.slice(handle.indexOf(':') + 1) : handle;
    if (!fn || seen.has(name)) return { found: [], bodies: [], aliases: [], stopped: [] };
    seen.add(name);
    /**
     * THE RECEIVER, AND IT HAS TWO FORMS — found by the positive control failing.
     *
     * A cascade delegate takes the state as its FIRST PARAMETER
     * (`gaip_firmness_engine(e, t)` reads `e.turf.drainage`). An orchestrator builder
     * takes NO parameter at all: `buildWearRecoveryInputs()` reads the module-scope
     * `_hubState`, and it reads it through LOCAL ALIASES —
     * `const turf = _hubState.inputs.turf` and then `turf.construction`. The
     * parameter sign alone found nothing there and reported zero reads, which is
     * exactly what a census must not do silently.
     *
     * So: the receiver is the first parameter when there is one, and the module's own
     * state name when there is not; and ONE HOP of aliasing is followed, declared
     * here rather than assumed. Deeper aliasing is still outside the sign and is
     * printed, not swallowed.
     */
    const STATE_NAMES = ['_hubState', 'GAIP_STATE', '__GAIP_STATE__'];
    let receiver = fn.params[0];
    let stateReceiver = null;
    if (!receiver) {
        stateReceiver = STATE_NAMES.find((n) => fn.body.includes(n + '.')) || null;
        receiver = stateReceiver;
    }
    const out = [];
    const aliases = [];
    if (stateReceiver) {
        // `const turf = _hubState.inputs.turf` -> every `turf.field` becomes
        // `turf.field`; `const shade = _hubState.computed.shade` is a RESULT, not an
        // input, and is skipped — it belongs to `after`, not to `requires`.
        const hop = new RegExp('(?:var|let|const)\\s+(\\w+)\\s*=\\s*'
            + stateReceiver + '\\s*(?:\\?\\.|\\.)\\s*(inputs|computed)\\s*(?:\\?\\.|\\.)\\s*(\\w+)', 'g');
        let h;
        const sections = [];
        while ((h = hop.exec(fn.body)) !== null) {
            if (h[2] === 'inputs') sections.push({ local: h[1], section: h[3] });
        }
        sections.forEach(({ local, section }) => {
            // THE ALIAS MUST STAND AT THE HEAD OF THE CHAIN, not inside one. Without
            // this, `climate?.temperature?.soil?.mean` matched the alias `soil` in the
            // middle of somebody else's path and reported a read `soil.mean` that the
            // module does not make — the sign inventing a subject out of a substring,
            // which is the same fault as the row matcher that pressed nothing.
            const re = new RegExp('(?<![.\\w])' + local + '\\s*(?:\\?\\.|\\.)\\s*([a-zA-Z_]\\w*)', 'g');
            let m;
            while ((m = re.exec(fn.body)) !== null) {
                if (isAssignmentTo(fn.body, m.index, m[0].length)) continue;
                const pth = section + '.' + m[1];
                if (!out.includes(pth)) out.push(pth);
            }
        });
    }
    /**
     * GH-787 (queue item 3vy) — THE SECOND SOURCE OF AN INPUT: THE SITE'S OWN CONFIG.
     *
     * A builder used to reach every input through `_hubState.inputs`, which is the page's assembled state,
     * and the block above follows exactly that. Since GH-787 the wear builder reads the inputs the list
     * declares from the config of the site the run is about — `siteConfigOfThisRun()` — because the state it
     * used to read was the page's and carried substitutions (`"native"`, `25`, `"optimal"`). The reads did not
     * stop; they changed owner, and a census that followed only the old owner reported them gone. That is the
     * fault this file exists to prevent, so the sign follows the new owner too.
     *
     * TWO HOPS, both declared: `const c = siteConfigOfThisRun()` and then
     * `const cTurf = (c && c.turf) || {}`, after which `cTurf.construction` is a read of `turf.construction`.
     * The section names are the config's own, which is what the inputs list spells.
     */
    const cfgRoots = [];
    const cfgRootRe = /(?:var|let|const)\s+(\w+)\s*=\s*siteConfigOfThisRun\s*\(\s*\)/g;
    let cr;
    while ((cr = cfgRootRe.exec(fn.body)) !== null) cfgRoots.push(cr[1]);
    cfgRoots.forEach((root) => {
        /**
         * THE PATH IS KEPT WHOLE, from the config's root down — `traffic.schedule.rootDepth`, not
         * `schedule.rootDepth`. Written first as "the last hop is the section", it reported
         * `schedule.schedule`: a path invented out of the tail of somebody else's chain, which is the same
         * fault as a matcher reading a substring for a subject. The whole path is what the inputs list
         * spells under `storedAs`, so it is comparable to a declaration.
         */
        /**
         * THE WHOLE ASSIGNMENT IS READ, then the DEEPEST path of the config inside it.
         *
         * `(c && c.traffic && c.traffic.schedule) || {}` mentions the root three times, and a regex that
         * stops at the first mention yields `traffic` — so a read of `traffic.schedule.rootDepth` was
         * reported as `traffic.rootDepth`, a path that exists nowhere. Found by this very case: the census
         * named a path the config does not have, which is the sign inventing a subject.
         */
        const assignRe = new RegExp('(?:var|let|const)\\s+(\\w+)\\s*=\\s*([^;\\n]*)', 'g');
        let am;
        const deepest = {};
        while ((am = assignRe.exec(fn.body)) !== null) {
            const local = am[1];
            const expr = am[2];
            const pathRe = new RegExp('(?<![.\\w])' + root + '((?:\\s*(?:\\?\\.|\\.)\\s*\\w+)+)', 'g');
            let pm;
            while ((pm = pathRe.exec(expr)) !== null) {
                const path = pm[1].replace(/[\s?]/g, '').replace(/^\./, '');
                if (path && (!deepest[local] || path.length > deepest[local].length)) deepest[local] = path;
            }
        }
        Object.entries(deepest).forEach(([local, base]) => {
            const fieldRe = new RegExp('(?<![.\\w])' + local + '\\s*(?:\\?\\.|\\.)\\s*([a-zA-Z_]\\w*)', 'g');
            let fm;
            while ((fm = fieldRe.exec(fn.body)) !== null) {
                if (isAssignmentTo(fn.body, fm.index, fm[0].length)) continue;
                const pth = base + '.' + fm[1];
                if (!out.includes(pth)) out.push(pth);
            }
        });
        // And a direct read of the config itself: `cfg.location.lat`. Note that this also picks up the
        // CONTAINER of a deeper alias (`cfg.traffic.schedule`), which the filter after this loop drops.
        const directRe = new RegExp('(?<![.\\w])' + root
            + '\\s*(?:\\?\\.|\\.)\\s*([a-zA-Z_]\\w*)\\s*(?:\\?\\.|\\.)\\s*([a-zA-Z_]\\w*)', 'g');
        let dm;
        while ((dm = directRe.exec(fn.body)) !== null) {
            if (isAssignmentTo(fn.body, dm.index, dm[0].length)) continue;
            const pth = dm[1] + '.' + dm[2];
            if (!out.includes(pth)) out.push(pth);
        }
    });
    if (receiver) {
        const re = new RegExp('\\b' + receiver + '\\s*(?:\\?\\.|\\.)\\s*([a-zA-Z_]\\w*)\\s*(?:\\?\\.|\\.)\\s*([a-zA-Z_]\\w*)', 'g');
        let m;
        while ((m = re.exec(fn.body)) !== null) {
            if (isAssignmentTo(fn.body, m.index, m[0].length)) continue;
            const p = m[1] + '.' + m[2];
            if (!out.includes(p)) out.push(p);
        }
        // Reads through an alias are NOT extracted, and are printed rather than
        // passed over: `var t = e.turf; t.drainage` is invisible to the sign above.
        /**
         * ONLY THE ALIASES THE SIGN CANNOT FOLLOW, which is the whole point of the list.
         *
         * The first form recorded EVERY alias of the receiver, so all thirty-one came
         * back — including the twenty-odd one-hop `const turf = _hubState.inputs.turf`
         * the sign follows perfectly well, and the `_hubState.computed.X` locals that
         * are RESULTS and belong to `after`. A list of holes that includes what is not a
         * hole cannot be held to a claim: the real holes hide among them.
         */
        const aliasRe = new RegExp('(?:var|let|const)\\s+(\\w+)\\s*=\\s*' + receiver + '\\s*(?:\\?\\.|\\.)\\s*(\\w+)', 'g');
        let a;
        while ((a = aliasRe.exec(fn.body)) !== null) {
            // A METHOD CALL IS NOT A FIELD. `const weatherData = airTemps.map(...)` is
            // the receiver being iterated, not a section being aliased, and counting it
            // as a hole would put three non-holes in a list whose whole value is that
            // everything in it is one.
            const after = fn.body.slice(a.index + a[0].length);
            if (/^\s*\(/.test(after)) continue;
            // Followed: the module-state hop into `inputs`, which the block above walks.
            if (stateReceiver && a[2] === 'inputs') continue;
            // A result, not an input: `computed.*` belongs to `after`.
            if (a[2] === 'computed' || a[2] === 'derived') continue;
            aliases.push(a[1] + ' = ' + receiver + '.' + a[2]);
        }
    }
    /**
     * GH-787 (queue item 3vy) — A CONTAINER IS NOT A READ.
     *
     * `const cfgSchedule = (cfg && cfg.traffic && cfg.traffic.schedule) || {}` makes the census see both
     * `traffic.schedule` and, through it, `traffic.schedule.rootDepth`. The first is the object the fields
     * live in, not a value anything reads — and the cascade's section rename then turned it into
     * `schedule.schedule`, a path no config and no list has. A path that is a strict prefix of another path
     * in the same census is that other path's container, and is dropped.
     */
    for (let i = out.length - 1; i >= 0; i--) {
        if (out.some((other) => other !== out[i] && other.indexOf(out[i] + '.') === 0)) out.splice(i, 1);
    }
    const bodies = [{ name, file: fn.file, receiver: receiver || null, reads: out.length }];
    const stopped = [];
    /**
     * GH-690 (the reviewer's second return on item 6) — WHERE THIS STOPS, RECORDED RATHER THAN LEFT
     * TO BE DISCOVERED.
     *
     * Delegates reached through a GLOBAL are followed -- `global.gaip_firmness_engine(e, t)` -- so
     * the wrapper and the delegate count as one module. A call through a MEMBER OF A GLOBAL
     * PROPERTY, `window.GAIP_Thing.run(state)`, is NOT followed: the member's body is not found by
     * name, so whatever it reads is invisible to this census.
     *
     * THE BOUNDARY IS DECLARED, NOT CLOSED. Extending the walk to members belongs to item 3bj, by
     * the reviewer's decision, because it needs the resolution of an object's methods rather than a
     * regular expression. What this does is make the edge VISIBLE: every such call site is collected
     * and printed, and a case below holds the list in both directions. An unprinted boundary and a
     * boundary that does not exist read the same in a green run.
     */
    const mre = /(?:global|window)\.(\w+)\.(\w+)\s*\(/g;
    let m2;
    while ((m2 = mre.exec(fn.body)) !== null) {
        const at = m2[1] + '.' + m2[2];
        if (!stopped.includes(at)) stopped.push(at);
    }
    /**
     * GH-777 (queue item 4, slice 3) — A CALL TO THE SAMPLE READER IS A READ OF THAT SAMPLE.
     *
     * A requirement of the "sample key" kind (`samples.tissue`) is satisfied by asking the one reader,
     * `gaip_sampleReadings("tissue")` -- which is what the tissue body does, through
     * `gaip_read_tissue_data`. The census read `<section>.<field>` only, so it could not see that call at
     * all and every such declaration would have been reported unread. The kind is taken from the LITERAL
     * argument: a call whose argument is computed is not counted and is printed below instead, because a
     * census that guesses the kind invents a subject.
     */
    const sampleRe = /(?<![.\w])(?:gaip_sampleReadings|getActiveSample)\s*\(\s*(['"])([\w-]+)\1\s*\)/g;
    let s;
    while ((s = sampleRe.exec(fn.body)) !== null) {
        const pth = 'samples.' + s[2];
        if (!out.includes(pth)) out.push(pth);
    }
    const computedKindRe = /(?<![.\w])(?:gaip_sampleReadings|getActiveSample)\s*\(\s*(?!['"])([^)]*)\)/g;
    let c;
    while ((c = computedKindRe.exec(fn.body)) !== null) {
        const at = fn.name + ': sample reader called with ' + c[1].trim();
        if (!stopped.includes(at)) stopped.push(at);
    }
    // Delegates reached through a global: the wrapper and the delegate are one module.
    const dre = /(?:global|window)\.(\w+)\s*\(/g;
    let d;
    while ((d = dre.exec(fn.body)) !== null) {
        const inner = readsOf(d[1], seen);
        inner.found.forEach((x) => { if (!out.includes(x)) out.push(x); });
        bodies.push(...inner.bodies);
        aliases.push(...inner.aliases);
        (inner.stopped || []).forEach((x) => { if (!stopped.includes(x)) stopped.push(x); });
    }

    // Two kinds of noise the generic pass picks up on a state receiver, removed with
    // a reason rather than left to be argued about in the output: `computed.x` is a
    // RESULT another module wrote — it belongs to `after`, not to `requires` — and
    // `inputs.x` is the state's own section name, not a path to an input.
    const cleaned = out.filter((pth) => !pth.startsWith('computed.') && !pth.startsWith('inputs.'));

    return {
        found: cleaned, bodies, aliases, stopped,
        results: out.filter((p2) => p2.startsWith('computed.')),
    };
}


/**
 * THE SECTION A LOCAL NAME STANDS FOR, TAKEN FROM THE CASCADE'S OWN ASSEMBLY.
 *
 * The cascade hands its engines a state whose sections are RENAMED: it builds
 * `traffic: cascadeState.inputs?.schedule` and `shade: cascadeState.inputs?.site`. So
 * `state.traffic.matchesPerWeek` inside an engine IS `schedule.matchesPerWeek` in the
 * inputs list, and a census reporting the local name invents two inputs that do not
 * exist and misses the one that does. Parsed out of that assembly, never typed here:
 * a rename added tomorrow travels with the code.
 */
/** The `computed` roots the nodes a given node declares in `after` write. */
function upstreamOutputRoots(id) {
    const out = new Set();
    ((NODES[id] || {}).after || []).forEach((up) => {
        ((NODES[up] || {}).outputs || []).forEach((o) => {
            // GH-777 (queue item 4, slice 2): `derived.` too. A read of an upstream node's DERIVED
            // output is as much a result as a read of its `computed` one — the ambient DLI engine's
            // number is the case: it never becomes a row key, it goes onto the state for the shade
            // engine, and the graph says so with `derived.ambientDLI`. Leaving the prefix out would
            // have made shade's read of it look undeclared.
            out.add(o.replace(/^computed\./, '').replace(/^window\./, '')
                .replace(/^derived\./, '').split('.')[0]);
        });
    });

    return out;
}

function cascadeSectionAliases() {
    const src = fs.readFileSync(path.join(ROOT, 'assets', 'cascade-orchestrator.js'), 'utf8');
    const at = src.indexOf('const state = {');
    if (at === -1) return {};
    const body = src.slice(at, src.indexOf('};', at));
    const out = {};
    const re = /(\w+)\s*:\s*cascadeState\.inputs\?\.(\w+)/g;
    let m;
    while ((m = re.exec(body)) !== null) {
        if (m[1] !== m[2]) out[m[1]] = m[2];
    }

    return out;
}

describe('GH-676 — the graph file itself', () => {
    test('POSITIVE CONTROL: the file loaded and its nodes are the ones the tree had', () => {
        const ids = Object.keys(NODES);
        process.stdout.write('\n[gh676] nodes in the graph: ' + ids.length + '\n'
            + '[gh676] first five: ' + JSON.stringify(ids.slice(0, 5)) + '\n');
        expect(ids.length).toBeGreaterThan(20);
        // Every node declares what it writes, or universe (a) below is comparing
        // against nothing.
        const withoutOutputs = ids.filter((id) => !(NODES[id].outputs || []).length);
        expect({ nodesDeclaringNoOutput: withoutOutputs }).toEqual({ nodesDeclaringNoOutput: [] });
    });

    test('no two nodes claim the same exact output — one key, one author', () => {
        // Asked of the EXACT output, not of the root: several nodes may legitimately
        // fill different fields of one block, and rooting the comparison here would
        // turn that into a false accusation.
        const byExact = new Map();
        Object.entries(NODES).forEach(([id, node]) => {
            (node.outputs || []).forEach((o) => {
                if (!byExact.has(o)) byExact.set(o, []);
                byExact.get(o).push(id);
            });
        });
        const shared = [...byExact.entries()].filter(([, ids]) => ids.length > 1)
            .map(([key, ids]) => key + ' <- ' + JSON.stringify(ids));
        process.stdout.write('[gh676] outputs claimed by more than one node: ' + JSON.stringify(shared) + '\n');
        expect({ outputsWithTwoAuthors: shared }).toEqual({ outputsWithTwoAuthors: [] });
    });
});

describe('GH-676 — (a) what a real pass wrote against what the graph declares', () => {
    const read = rootsWrittenOnTheStand();
    const written = read.keys || [];
    const declared = declaredOutputs();

    /** Return 8: the one place that decides what an unreachable stand means. */
    const standIsThere = () => {
        if (read.unreachable) {
            throw new Error('universe (a) could not be read: the stand did not answer — '
                + read.unreachable + '. This test FAILS rather than passing over an'
                + ' unread universe: a green here would mean nothing was compared.');
        }
    };

    test('the roots are printed before anything is claimed about them', () => {
        standIsThere();
        process.stdout.write('[gh676] `computed` roots real passes wrote (' + written.length + '): '
            + JSON.stringify(written) + '\n');
        expect(written.length).toBeGreaterThan(5);
    });

    test('a key a pass wrote with no node to declare it is NAMED, and only the three known ones stand', () => {
        standIsThere();
        const orphans = written.filter((k) => !declared.has(k)
            && !Object.prototype.hasOwnProperty.call(PASS_ACCOUNT, k)
            && !Object.prototype.hasOwnProperty.call(ROW_SECTIONS, k));
        const unexpected = orphans.filter((k) => !Object.prototype.hasOwnProperty.call(KNOWN_ABSENT, k));
        process.stdout.write('[gh676] written but declared by no node (' + orphans.length + '): '
            + JSON.stringify(orphans) + '\n'
            + '[gh676]    the pass account: ' + JSON.stringify(Object.keys(PASS_ACCOUNT)) + '\n'
            + '[gh676]    sections the row producer assembles: ' + JSON.stringify(Object.keys(ROW_SECTIONS)) + '\n'
            + '[gh676]    still unexplained: ' + JSON.stringify(Object.keys(KNOWN_ABSENT)) + '\n');

        expect({ modulesWritingWithNoNode: unexpected }).toEqual({ modulesWritingWithNoNode: [] });
    });

    test('and a node that no pass on the stand ever produced is printed too', () => {
        standIsThere();
        const seen = new Set(written);
        const silent = [...declared.entries()].filter(([key]) => !seen.has(key)).map(([key]) => key);
        /**
         * RETURN 1 — THIS WAS A PRINT AND THE PROMISE SAID RED.
         *
         * The promise was "a node that no pass ever produced reddens"; the case printed
         * a list and asserted that it was a list. The two drifted apart, and the
         * reconciliation table caught it after the review had passed — so the weakening
         * was invisible to both of us.
         *
         * It is a claim now, in the shape the rest of this repository uses: allowed BY
         * NAME WITH A REASON, and the reverse direction too. A node that stops producing
         * reddens here; an allowance whose node has started producing, or has gone from
         * the graph, reddens as well, so the list cannot outlive its reasons.
         */
        const NEVER_PRODUCED = {
            derived: 'not a `computed` root at all: the state\'s own derived section, which several nodes write into beside their result',
            // GH-777 (queue item 4, slice 2): the `ambientDLI` allowance is GONE, and it went the way this
            // list's own rule says — the node stopped declaring a root no pass produces. It declared
            // `computed.ambientDLI`; measured, absent from all 14 stored rows since 25.09 and written by
            // neither pass. It declares `derived.ambientDLI` now, which is what the value is: work
            // carried on the state for the shade engine. An allowance whose reason has been repaired is
            // an allowance that must go, or the list outlives its reasons.
            nutrientDemand: 'no pass writes it — the file is used as a LIBRARY from inside the tissue engine (see the node\'s `noRunnerBecause`)',
            soilTissueIntegration: 'computes on a page, not in a pass; waits for item 3ayu',
            irrigationForecast: 'the orchestrator has a comment where the call would be — "Irrigation scheduler would be called here"; it renders on a page',
            pgrForecast: 'renders on a page, not in a pass; waits for item 3ayu',
            GAIP_PRE_EMERGENT_RESULT: 'a `window.*` global, not a `computed` root — the pre-emergent engine publishes it for the page beside the result it does write',
            // THE THREE NODES ITEM 6a ADDED, and none of them can appear in universe (a) by
            // construction: (a) reads the `computed` roots of rows a RUN wrote, and these
            // three do not run in a pass. The page modules need tier 1 of item 3ashch (a
            // sandbox for a page calculation) before anything can see them produce; the
            // producer writes into the row the runner assembles rather than into the pass's
            // own `computed`. Named here rather than left to look like silence.
            nutritionCalendar: 'a page module: it computes on `/plan` and in the run frames, and no pass writes this root',
            nutritionSummary: 'the producer calls it before the one write; its result reaches the row, not the pass state',
            scenario: 'a page module on `reports/scenarios`, run by a human action through `gaip-whatif-ui.js`',
        };
        const unexpected = silent.filter((k) => !Object.prototype.hasOwnProperty.call(NEVER_PRODUCED, k));
        const stale = Object.keys(NEVER_PRODUCED).filter((k) => !silent.includes(k));
        process.stdout.write('[gh676] declared but never produced on the stand (' + silent.length + '): '
            + JSON.stringify(silent) + '\n');
        Object.entries(NEVER_PRODUCED).forEach(([k, why]) =>
            process.stdout.write('[gh677]    ' + k + ' — ' + why + '\n'));

        expect({ declaredAndNeverProduced: unexpected, allowancesNoLongerTrue: stale })
            .toEqual({ declaredAndNeverProduced: [], allowancesNoLongerTrue: [] });
    });
});

describe('GH-676 — (b) and (c): the holes the next step fills', () => {
    test('nodes with no `handle` are listed — this is the work item, printed', () => {
        const noHandle = Object.keys(NODES).filter((id) => !NODES[id].handle);
        process.stdout.write('[gh676] nodes with no `handle` yet (' + noHandle.length + '): '
            + JSON.stringify(noHandle) + '\n');
        // Asserted as a state, not as a target: while a node has no handle its body
        // cannot be read, and (c) cannot speak about it. The day they are filled this
        // count goes to zero and the case below starts doing the work.
        expect(Array.isArray(noHandle)).toBe(true);
    });

    test('nodes with no `requires`/`uses` split are listed, with the old inputs they came from', () => {
        const unsplit = Object.entries(NODES)
            .filter(([, n]) => !(n.requires || []).length && !(n.uses || []).length)
            .map(([id, n]) => id + ' <- ' + JSON.stringify(n._inputsBeforeTheSplit || []));
        process.stdout.write('[gh676] nodes whose inputs are not split yet (' + unsplit.length + '):\n');
        unsplit.forEach((u) => process.stdout.write('[gh676]    ' + u + '\n'));
        expect(Array.isArray(unsplit)).toBe(true);
    });
});

describe('GH-676 — (d) the graph against the inputs list, both directions', () => {
    const known = () => {
        const out = new Set();
        Object.entries(LIST.inputs).forEach(([key, entry]) => {
            out.add(key);
            (entry.readAs || []).forEach((a) => out.add(a));
        });

        return out;
    };

    test('every input a node declares exists in the inputs list', () => {
        const vocabulary = known();
        const strangers = [];
        Object.entries(NODES).forEach(([id, n]) => {
            [...(n.requires || []), ...(n.uses || [])].forEach((input) => {
                if (!vocabulary.has(input)) strangers.push(id + ' declares ' + JSON.stringify(input));
            });
        });
        process.stdout.write('[gh676] inputs declared by a node and absent from the list: '
            + JSON.stringify(strangers) + '\n');

        expect({ graphNamesAnInputTheListDoesNotHave: strangers })
            .toEqual({ graphNamesAnInputTheListDoesNotHave: [] });
    });

    test('inputs the list carries that no node reads are printed — the other direction', () => {
        const readByANode = new Set();
        Object.values(NODES).forEach((n) => {
            [...(n.requires || []), ...(n.uses || [])].forEach((i) => readByANode.add(i));
        });
        const unread = Object.keys(LIST.inputs).filter((key) => {
            if (readByANode.has(key)) return false;
            const aliases = LIST.inputs[key].readAs || [];

            return !aliases.some((a) => readByANode.has(a));
        });
        /**
         * NOW A CLAIM, because the split is filled: an input the list carries that no
         * node reads is a spare, and the analyst asked for this direction by name. It
         * went from 34 of 34 to three, and the three are allowed BY NAME with what each
         * one is — not by a rule, which would also excuse the next real omission.
         */
        const SPARE = {
            'location.lon': 'read by the weather fetch (`climate.lon || climate.longitude || canon.lon`, '
                + '`hub-orchestrator.js`), which runs before any module and is not a node. No engine '
                + 'reads a longitude; the latitude they do read is declared.',
            'turf.companionSpecies': 'written and re-read by the daily dashboard form '
                + '(`daily-dashboard.js`), and read by no module of the run.',
            'soil.clay': 'added to the list by the analyst as a sample reading in its own right; '
                + 'no module reads it yet, and it is the one entry here that is expected to gain a '
                + 'reader rather than lose its row.',
            // GH-780 (queue item 3vc): the allowance for `pgr.enabled` is gone with the entry it
            // allowed. The owner removed the PGR switch on 29.09.2026 -- a site is using a PGR when its
            // spray journal holds an application within the engine's ninety-day window -- so nothing
            // reads the config field, the list no longer declares it, and an allowance for an input that
            // does not exist is a permission nobody needs.
            /**
             * GH-755 (queue item 3bz) — TEN INPUTS WHOSE ONLY READER WAS A REMOVED BUILDER.
             *
             * `buildIrrigationInputs` and `buildPGRInputs` were called from `executeEngine`, an export
             * with no caller, and went with it. Their nodes remain as declarations of an output with
             * `runner: null`, `handle: null` and the reason at the node, so these inputs are declared
             * and read by nobody — named here one by one rather than excused by a rule, and each will
             * lose its row here on the day the owner decides whether either engine runs in the pass.
             */
            'turf.overseedSpecies': 'read by `buildPGRInputs`, removed with `executeEngine` under GH-755; the `pgr-module` node stays with no runner.',
            'turf.overseedVariety': 'read by `buildPGRInputs`, removed with `executeEngine` under GH-755.',
            'turf.summerIntent': 'read by `buildPGRInputs`, removed with `executeEngine` under GH-755.',
            'turf.poaPercent': 'read by `buildPGRInputs`, removed with `executeEngine` under GH-755.',
            'turf.percentC3Cover': 'read by `buildPGRInputs`, removed with `executeEngine` under GH-755.',
            'pgr.productType': 'read by `buildPGRInputs`, removed with `executeEngine` under GH-755; the PGR settings are still written by a person in Settings.',
            'pgr.applicationDate': 'read by `buildPGRInputs`, removed with `executeEngine` under GH-755; still written by a person in Settings.',
            'schedule.efficiency': 'read by `buildIrrigationInputs`, removed with `executeEngine` under GH-755; the `irrigation-scheduler` node stays with no runner.',
            'schedule.uniformity': 'read by `buildIrrigationInputs`, removed with `executeEngine` under GH-755.',
            'schedule.precipRate': 'read by `buildIrrigationInputs`, removed with `executeEngine` under GH-755.',
        };
        const unexpectedSpare = unread.filter((k) => !Object.prototype.hasOwnProperty.call(SPARE, k));
        const staleSpare = Object.keys(SPARE).filter((k) => !unread.includes(k));
        process.stdout.write('[gh676] inputs in the list that no node declares (' + unread.length
            + ' of ' + Object.keys(LIST.inputs).length + '): ' + JSON.stringify(unread) + '\n');
        Object.entries(SPARE).forEach(([k, why]) => process.stdout.write('[gh677]    ' + k + ' — ' + why + '\n'));

        // Both directions: a NEW spare reddens, and an allowance that has stopped being
        // true reddens too — otherwise the list of exceptions outlives its reasons.
        expect({ spareInputsNobodyNamed: unexpectedSpare, allowancesNoLongerTrue: staleSpare })
            .toEqual({ spareInputsNobodyNamed: [], allowancesNoLongerTrue: [] });
    });
});

describe('GH-676 — (c) what a body reads, with the receiver from its own signature', () => {
    test('POSITIVE CONTROL: the universe reaches the ORCHESTRATOR, not only the cascade', () => {
        // The reviewer's condition, measured rather than asserted in prose: one of
        // the orchestrator's own builders is read and its reads are printed. GH-644
        // looks only inside the cascade's engines, so these were in no universe.
        const builder = readsOf('buildWearRecoveryInputs');
        process.stdout.write('[gh676] (c) orchestrator builder `buildWearRecoveryInputs`: '
            + JSON.stringify(builder.bodies) + '\n'
            + '[gh676]    it reads (inputs): ' + JSON.stringify(builder.found) + '\n'
            + '[gh676]    and results of other modules, which belong to `after`: '
            + JSON.stringify(builder.results) + '\n');
        expect(builder.bodies.length).toBeGreaterThan(0);
        expect(builder.found.length).toBeGreaterThan(0);
        // Named, not counted: the construction the wear engine reads is in there, and
        // it is the very read `GH-644` could not see.
        expect(builder.found).toContain('turf.construction');
    });

    test('POSITIVE CONTROL: a delegate whose receiver is `e` is read — the `drainage` case', () => {
        // The analyst's own example: `gaip_firmness_engine(e, t)` reads `e.turf.drainage`,
        // and a sign looking for `state.` or `turf.` walks past it.
        const delegate = readsOf('gaip_firmness_engine');
        process.stdout.write('[gh676] (c) delegate `gaip_firmness_engine` receiver + reads: '
            + JSON.stringify({ bodies: delegate.bodies, reads: delegate.found }) + '\n');
        expect(delegate.bodies[0].receiver).toBe('e');
        expect(delegate.found).toContain('turf.drainage');
    });

    test('reads through an alias are ALLOWED BY NAME, both directions — return 3', () => {
        /**
         * RETURN 3 — THIS WAS A PRINT TOO, and it is the same class as return 1.
         *
         * An alias the extraction sign cannot follow (`var t = e.turf; t.drainage`) is a
         * read this census does not see, so each one is a hole of known size. Printing
         * them said so; asserting that the list is a list said nothing. Now every alias
         * in every node's handle is allowed BY NAME WITH A REASON, and a NEW one reddens
         * — which is the only way a hole of this kind can be kept from growing.
         *
         * The reverse direction is asserted as well: an allowance whose alias has gone
         * from the code reddens, so the list cannot outlive the bodies it describes.
         */
        const WEATHER_LOCAL = 'a local for the WEATHER payload, which is fetched rather than entered and has no row in the inputs list; reads through it are not inputs';
        const RESULT_LOCAL = 'a local for ANOTHER MODULE\'s result, which belongs to `after` rather than to `requires`/`uses`';
        const SECTION_LOCAL = 'a local for a state SECTION: a field read only through it is a read this sign does not see. The hole is one section per entry, and it is written here so it cannot grow unnoticed';
        const ALIASES_ALLOWED = {
            'sums = climateData.daily': WEATHER_LOCAL,
            'hourly = climateData.hourly': WEATHER_LOCAL,
            'cloudCover = climateData.hourly': WEATHER_LOCAL,
            '_cmDiag = state.climateMetrics': RESULT_LOCAL,
            'climateMetrics = state.climateMetrics': RESULT_LOCAL,
            '_sm = state.shadeMetrics': RESULT_LOCAL,
            '_variety = state.varietyTraits': RESULT_LOCAL,
            'ions = state.water': SECTION_LOCAL,
            'species = state.turf': SECTION_LOCAL,
            'variety = state.turf': SECTION_LOCAL,
            'turfProfile = state.turf': SECTION_LOCAL,
            'turf = state.turf': SECTION_LOCAL,
            'irrigationMethod = state.irrigation': SECTION_LOCAL,
            'r = e.soil': 'the firmness delegate\'s local for the soil section — the hole named by name in GH-676, and the one this list was built around',
        };
        const handlesOf = (n) => (Array.isArray(n.handle) ? n.handle : (n.handle ? [n.handle] : []));
        const found = new Set();
        Object.values(NODES).forEach((n) => handlesOf(n).forEach((h) => {
            readsOf(h).aliases.forEach((a) => found.add(a));
        }));
        const unexpected = [...found].filter((a) => !Object.prototype.hasOwnProperty.call(ALIASES_ALLOWED, a));
        const stale = Object.keys(ALIASES_ALLOWED).filter((a) => !found.has(a));
        process.stdout.write('[gh677] aliases the sign cannot follow, across every handle ('
            + found.size + '): ' + JSON.stringify([...found]) + '\n');

        expect({ aliasesNobodyNamed: unexpected, allowancesNoLongerTrue: stale })
            .toEqual({ aliasesNobodyNamed: [], allowancesNoLongerTrue: [] });
    });

    test('RETURN 5: the ONE `requires` is a measured fact, not a declaration', () => {
        /**
         * The graph carries exactly one `requires`: the salinity engine's `water.ecw`,
         * put there because the evidence showed a GATE rather than a substitution. A
         * gate is a claim about behaviour, so it is executed here instead of being
         * believed: the cascade adapter runs that engine alone, once with the reading
         * and once without, and the two answers are different in the way `requires`
         * says they are.
         *
         * Without this the field was the last unmeasured promise in the file — the
         * reviewer's point, and it cost a minute.
         */
        const requiring = Object.entries(NODES)
            .filter(([, n]) => (n.requires || []).length)
            .map(([id, n]) => id + ' requires ' + JSON.stringify(n.requires));
        process.stdout.write('[gh677] nodes with a `requires`: ' + JSON.stringify(requiring) + '\n');
        expect(NODES['salinity-penalty-engine'].requires).toEqual(['water.ecw']);

        const run = (water) => {
            const sb = {
                console: { log() {}, warn() {}, error() {} },
                document: { dispatchEvent() {}, addEventListener() {} },
                CustomEvent: function () {},
                Date,
                JSON,
                Math,
                Object,
                Array,
                parseFloat,
                isNaN,
            };
            sb.window = sb; sb.global = sb; sb.globalThis = sb;
            // GH-681: the adapter takes its engine list from the injected graph and refuses
            // the pass without one, so a sandbox standing in for the page gives what the page
            // gives. Otherwise this case would measure the refusal instead of the gate.
            sb.GAIP_DEPENDENCY_GRAPH = GRAPH;
            // The engine itself is a stub that always answers, so that a null result can
            // only come from the gate and not from the engine declining.
            sb.gaip_salinity_penalty = () => ({ growthPenaltyPct: 12, stub: true });
            vm.runInNewContext(fs.readFileSync(path.join(ROOT, 'assets/cascade-orchestrator.js'), 'utf8'),
                sb, { filename: 'cascade-orchestrator.js' });
            const out = sb.GilbaCascadeOrchestrator.runCascade(
                { inputs: { water: water, turf: { grassSpecies: 'ryegrass' } } },
                { includeEngines: ['salinity-penalty-engine'] });

            return out.state.computed.salinityPenalty;
        };

        const withReading = run({ ecw: 1.4 });
        const without = run({});
        process.stdout.write('[gh677]    with `water.ecw` 1.4: ' + JSON.stringify(withReading) + '\n'
            + '[gh677]    with the reading absent: ' + JSON.stringify(without) + '\n');

        expect(withReading).toEqual({ growthPenaltyPct: 12, stub: true });
        expect(without).toBeNull();
    });

    /**
     * THE SECTION A LOCAL NAME STANDS FOR, TAKEN FROM THE CASCADE'S OWN ASSEMBLY.
     *
     * The cascade hands its engines a state whose sections are RENAMED: it builds
     * `traffic: cascadeState.inputs?.schedule` and `shade: cascadeState.inputs?.site`.
     * So `state.traffic.matchesPerWeek` inside an engine IS `schedule.matchesPerWeek`
     * in the inputs list, and a census that reported the local name would invent two
     * inputs that do not exist and miss the one that does.
     *
     * The map is PARSED out of that assembly, never typed here: a rename added
     * tomorrow travels with the code. Found by the first run of the split, where
     * `traffic.matchesPerWeek` and `traffic.restDays` appeared as inputs no list has.
     */
    function sectionAliasesUnused() {
        const src = fs.readFileSync(path.join(ROOT, 'assets', 'cascade-orchestrator.js'), 'utf8');
        const at = src.indexOf('const state = {');
        if (at === -1) return {};
        const body = src.slice(at, src.indexOf('};', at));
        const out = {};
        const re = /(\w+)\s*:\s*cascadeState\.inputs\?\.(\w+)/g;
        let m;
        while ((m = re.exec(body)) !== null) {
            if (m[1] !== m[2]) out[m[1]] = m[2];
        }

        return out;
    }

    /** Every handle a node declares, whether it declares one or two. */
    const handlesOf = (n) => (Array.isArray(n.handle) ? n.handle : (n.handle ? [n.handle] : []));

    test('POSITIVE CONTROL: a node run by TWO passes is read through BOTH handles', () => {
        // Found by this run: (c) took `n.handle` as a string, and for the four nodes
        // that declare two it coerced the array to one name that matches nothing —
        // so four nodes reported no reads at all and nothing said so. A count of
        // handles is what tells the two apart.
        const dual = Object.entries(NODES).filter(([, n]) => handlesOf(n).length > 1);
        const seen = dual.map(([id, n]) => ({
            id,
            bodies: handlesOf(n).map((h) => (readsOf(h).bodies[0] || {}).name || null),
            reads: handlesOf(n).map((h) => readsOf(h).found.length),
        }));
        process.stdout.write('[gh677] (c) nodes run by two passes: ' + JSON.stringify(seen) + '\n');
        expect(dual.length).toBeGreaterThan(0);
        seen.forEach((x) => {
            // Both bodies must be FOUND. Both reading something is NOT claimed, and
            // this run is why: `executeWearEngine` reads nothing of its own — it hands
            // the state straight to the engine — so the wear node's input reads all
            // come from the builder. Asserting "each handle reads at least one field"
            // would have been a claim about the world that the world does not make.
            expect(x.bodies.filter((b) => b)).toHaveLength(handlesOf(NODES[x.id]).length);
            expect(new Set(x.bodies).size).toBe(x.bodies.length);
        });
        expect(seen.some((x) => x.reads.every((c) => c > 0))).toBe(true);
    });

    test('every node with a handle is compared; the ones without are named', () => {
        const withHandle = Object.entries(NODES).filter(([, n]) => handlesOf(n).length);
        const aliases = cascadeSectionAliases();
        const undeclared = [];
        const byNode = {};
        const unrecordedPlaceless = [];
        /**
         * THE FOUR PLACES A READ MAY HAVE, and the analyst's 59.4 (c) names three of
         * them: the node's `requires`/`uses`, or the list's `notInputs`/`derived`. The
         * fourth is this work item's finding and it is recorded ON THE NODE:
         * `readsWithNoPlaceInTheList` — an input read with a substitution that NO
         * surface fills, so the substitution is always the value. Where such an input
         * belongs in the list is the analyst's decision; until it is made, the read is
         * accounted for by being written down against its node with the measurement,
         * and a read accounted for NOWHERE still reddens.
         *
         * The weather payload is the one thing outside all four: it is fetched, not
         * entered, and has no row in a list of what the client fills in.
         */
        const excused = new Set([...Object.keys(LIST.notInputs), ...Object.keys(LIST.derived)]
            .filter((k) => k !== '$comment'));
        const WEATHER = new Set(['daily', 'hourly', 'forecast', 'climateMetrics']);
        withHandle.forEach(([id, n]) => {
            const declared = new Set([...(n.requires || []), ...(n.uses || [])]);
            const placeless = new Set((n.readsWithNoPlaceInTheList || {}).names || []);
            handlesOf(n).forEach((h) => {
                readsOf(h).found.forEach((raw) => {
                    /**
                     * GH-787 (queue item 3vy) — THE WHOLE PATH IS COMPARED, and a path of three segments is
                     * one of them.
                     *
                     * This took `raw.split('.')` and kept the first two segments, so a read of
                     * `traffic.schedule.rootDepth` — where Settings actually stores the root depth — was
                     * compared as `traffic.schedule`, and the section rename turned that into
                     * `schedule.schedule`: a path that exists in no config and in no list. The census was
                     * naming a subject it had built out of a substring.
                     *
                     * AND A DECLARATION MAY BE THE INPUT'S KEY while the read is at its STORAGE path: the
                     * inputs list is the one place that says the two are the same thing (`storedAs`,
                     * `readAs`), which is how `gh725` already matches them. A node declaring `turf.rootDepth`
                     * therefore accounts for a read of `traffic.schedule.rootDepth`.
                     */
                    const segments = raw.split('.');
                    const section = segments[0];
                    const field = segments[segments.length - 1];
                    const p = (aliases[section] || section) + '.' + segments.slice(1).join('.');
                    const declaredThroughTheList = [...declared].some((key) => {
                        const entry = LIST.inputs[key];
                        if (!entry) return false;
                        const spellings = [...(entry.storedAs || []), ...(entry.readAs || [])];

                        return spellings.includes(raw) || spellings.includes(p);
                    });
                    if (declared.has(p) || declared.has(raw) || declaredThroughTheList) return;
                    if (WEATHER.has(section)) return;
                    if (excused.has(p) || excused.has(raw) || excused.has(field)) return;
                    if (placeless.has(p) || placeless.has(raw)) return;
                    // A READ OF AN UPSTREAM NODE'S OUTPUT IS A RESULT, and `after` is
                    // what says so. `shade-engine` reads `ambientDLI.current`; the
                    // ambient DLI engine declares `derived.ambientDLI` (GH-777: it was
                    // `computed.ambientDLI`, a row key no pass writes) and stands in
                    // shade's `after`. Deriving this from the graph rather than listing
                    // the spelling means `after` earns its place instead of being
                    // decoration, and a result read from a node NOT declared upstream
                    // still reddens — which is the dependency the graph exists to state.
                    if (upstreamOutputRoots(id).has(section)) return;
                    if (!byNode[id]) byNode[id] = [];
                    if (!byNode[id].includes(p)) byNode[id].push(p);
                    undeclared.push(id + ' reads ' + p + ' (via ' + h + ')');
                });
            });
            // And a node cannot record a placeless read without saying why: the block
            // carries the measurement, or it is just a second allowance list.
            if (placeless.size && !(n.readsWithNoPlaceInTheList || {}).why) {
                unrecordedPlaceless.push(id);
            }
        });
        process.stdout.write('[gh677] (c) section renames the cascade makes: '
            + JSON.stringify(aliases) + '\n'
            + '[gh677] (c) nodes with a handle: ' + withHandle.length
            + ' | reads no node declares: ' + undeclared.length + '\n');
        Object.keys(byNode).forEach((id) => process.stdout.write('[gh677]    ' + id + ': '
            + JSON.stringify(byNode[id]) + '\n'));

        const placelessTotal = Object.values(NODES)
            .reduce((a, x) => a + (((x.readsWithNoPlaceInTheList || {}).names || []).length), 0);
        process.stdout.write('[gh677] (c) reads recorded as having NO PLACE in the list: '
            + placelessTotal + ' on '
            + Object.values(NODES).filter((x) => x.readsWithNoPlaceInTheList).length + ' nodes\n');

        expect({ readsNoNodeDeclares: undeclared, placelessWithoutAReason: unrecordedPlaceless })
            .toEqual({ readsNoNodeDeclares: [], placelessWithoutAReason: [] });
    });

    test('and the other side: every input a node with a handle declares is still read by its bodies', () => {
        // GH-706 — THE CASE ABOVE COMPARES ONE WAY ONLY, AND IT WAS BLIND THE OTHER WAY. It
        // reddens on a read that nothing declares; it cannot redden on a declaration that the
        // extractor no longer sees. The declarations were split by reading this very
        // extractor's output, and the extractor changed three times in one day — once it
        // took `handle` as a string and saw nothing on four nodes. An extractor that narrows
        // finds FEWER reads, the list of undeclared reads shrinks, and everything stays green
        // over declarations made under the wider one. So the relation is asserted both ways:
        // a declaration the current extractor cannot find in the node's own bodies is named.
        const aliases = cascadeSectionAliases();
        const unread = [];
        const viaTheSection = [];
        let compared = 0;
        Object.entries(NODES).filter(([, n]) => handlesOf(n).length).forEach(([id, n]) => {
            const seen = new Set();
            handlesOf(n).forEach((h) => readsOf(h).found.forEach((raw) => {
                const [section, field] = raw.split('.');
                seen.add(raw);
                seen.add((aliases[section] || section) + '.' + field);
            }));
            [...(n.requires || []), ...(n.uses || [])].forEach((d) => {
                compared += 1;
                if (seen.has(d)) return;
                /**
                 * GH-787 (queue item 3vy) — THE SAME MATCHING AS THE OTHER DIRECTION: a node may declare an
                 * input by its KEY while its body reads the PATH THE VALUE IS STORED AT. The inputs list is
                 * the one owner of that equivalence (`storedAs`, `readAs`), and since GH-787 the wear
                 * assembly reads `soil.moisture` and `turf.rootDepth` where Settings writes them, under
                 * `traffic.schedule.*`, instead of off the old hub's form.
                 */
                const entry = LIST.inputs[d];
                if (entry) {
                    const spellings = [...(entry.storedAs || []), ...(entry.readAs || [])];
                    if (spellings.some((sp) => seen.has(sp))) return;
                }
                /**
                 * GH-777 (slice 3) — A SAMPLE IS READ IN ONE OF TWO SHAPES, and both are derived from the
                 * code rather than allowed by name.
                 *
                 * The tissue body asks the reader itself (`gaip_sampleReadings("tissue")`), which the
                 * extractor above now sees. The MLSN body does not: the run's state carries a `soil` block
                 * assembled from the soil sample (`gaip_soilFromActiveSample`) and the engine reads
                 * `soil.CEC`, `soil.ppm` and the rest out of it. So reading `<kind>.<field>` IS reading
                 * that sample -- there is nowhere else a `soil` block comes from -- and a declaration of
                 * `samples.<kind>` is satisfied by either shape. What is not satisfied by either is still
                 * named: a `samples.x` whose body reads neither the reader nor one `x.` field.
                 */
                if (d.indexOf('samples.') === 0) {
                    const kind = d.slice('samples.'.length);
                    const viaTheState = [...seen].filter((r) => r.indexOf(kind + '.') === 0);
                    if (viaTheState.length) {
                        viaTheSection.push(id + ' reads ' + d + ' as ' + JSON.stringify(viaTheState.sort()));

                        return;
                    }
                }
                unread.push(id + ' declares ' + d);
            });
        });
        process.stdout.write('[gh676] declarations compared against the reads of their own bodies: '
            + compared + '\n[gh676] sample keys read through the state block they assemble ('
            + viaTheSection.length + '): ' + JSON.stringify(viaTheSection)
            + '\n[gh676] declared but not read by the current extractor ('
            + unread.length + '): ' + JSON.stringify(unread) + '\n');

        expect({ declaredButNotRead: unread }).toEqual({ declaredButNotRead: [] });
    });
});

describe('GH-680 — no `page` root of the graph falls on a block the parse cannot read', () => {
    /**
     * THE CONDITION FOR SUBMITTING THE PAGE NODES AT ALL, and it could not be written before
     * them: with no `page` node declared it would have run over an EMPTY SET and been green by
     * emptiness — the "green that never reached its subject" this repository spent the day
     * removing. It is written now, with two nodes declaring an address.
     *
     * THE UNIVERSE IS THE DECLARED ROOTS IN THE DATA, not a list written here: a list would
     * age the moment the data changes, and this mechanism was taken out of the item for that
     * exact reason.
     *
     * WHAT IT GUARDS. A view's inline `<script>` that carries Blade cannot be parsed as
     * JavaScript, so a root living there is invisible to the walk — and the branch would come
     * back `unresolved` for a reason that has nothing to do with the code. Today the roots the
     * graph relies on come from `assets` module loads and from readable blocks, and that is
     * asserted rather than believed.
     */
    const walk = require('./helpers/gh678-caller-walk');
    const REG = {
        'assets/cascade-orchestrator.js:runCascade': 'cascade',
        'assets/hub-orchestrator.js:runComputePass': 'orchestrator',
        'assets/hub-orchestrator.js:computeAll': 'orchestrator',
        'assets/hub-persistence.js:_writeResult': 'producer',
        'assets/hub-persistence.js:cacheAnalysisResults': 'producer',
    };

    test('the evidence, printed whole — what each view with an unreadable block still yields', () => {
        /**
         * KEPT AS PRINTED EVIDENCE rather than as a verdict, including the ZEROS: when the
         * claim below starts failing there has to be something to compare with. "No loss" with
         * these lines missing is indistinguishable from "nobody looked" a week later.
         */
        const scripts = walk.viewScripts();
        const byView = {};
        scripts.forEach((v, i) => {
            const a = walk.analyse(v.view + '#script' + i, v.body);
            const rec = byView[v.view] = byView[v.view] || { ok: 0, bad: 0, fns: 0, calls: 0 };
            if (a.failed.length) rec.bad++;
            else {
                rec.ok++;
                rec.fns += a.declares.length;
                rec.calls += a.uses.filter((u) => u.how !== 'named').length;
            }
        });
        const rows = Object.entries(byView).filter(([, r]) => r.bad)
            .map(([view, r]) => view + ': readable ' + r.ok + '/' + (r.ok + r.bad)
                + ', functions ' + r.fns + ', calls ' + r.calls)
            .sort();
        rows.forEach((r) => process.stdout.write('[gh680]    ' + r + '\n'));
        process.stdout.write('[gh680] views with an unreadable block: ' + rows.length + '\n');

        // Printed, and the fact that there ARE such views is the claim: a run where every view
        // parsed would mean the measurement stopped matching the tree.
        expect(rows.length).toBeGreaterThan(0);
    });

    test('every DECLARED page pair is either found through a readable place, or explained', () => {
        const DIVERGENCES = JSON.parse(fs.readFileSync(
            path.join(ROOT, 'tests', 'fixtures', 'gh680-page-divergences.json'), 'utf8'));
        const files = walk.universe();
        const unreadable = new Set(files.filter((f) => f.failed.length).map((f) => f.rel));
        const nodeHandles = {};
        Object.entries(NODES).forEach(([id, n]) => {
            (Array.isArray(n.handle) ? n.handle : (n.handle ? [n.handle] : [])).forEach((h) => {
                nodeHandles[h.indexOf(':') !== -1 ? h.slice(h.indexOf(':') + 1) : h] = id;
            });
        });
        const fp = walk.rootsByFixpoint({ files, registries: REG, handles: nodeHandles });
        fp.files = files;
        const found = walk.pagePairsFound(fp, GRAPH);

        const declared = [];
        Object.entries(NODES).forEach(([id, n]) => (n.page || []).forEach((v) => declared.push(id + ' : ' + v)));
        expect(declared.length).toBeGreaterThan(0);          // not green by emptiness

        const onAnUnreadableBlock = [];
        const neitherFoundNorExplained = [];
        declared.sort().forEach((pair) => {
            const hit = [...found.entries()].find(([k]) => k.startsWith(pair + ' : '));
            if (!hit) {
                if (!Object.prototype.hasOwnProperty.call(DIVERGENCES.declaredNotConfirmed || {}, pair)) {
                    neitherFoundNorExplained.push(pair);
                }

                return;
            }
            if (unreadable.has(hit[1].via)) onAnUnreadableBlock.push(pair + ' via ' + hit[1].via);
        });
        process.stdout.write('[gh680] declared page pairs: ' + JSON.stringify(declared.sort()) + '\n'
            + '[gh680] of those, resting on a block the parse cannot read: '
            + JSON.stringify(onAnUnreadableBlock) + '\n');

        expect({ pageRootsOnAnUnreadableBlock: onAnUnreadableBlock,
            declaredPairsNeitherFoundNorExplained: neitherFoundNorExplained })
            .toEqual({ pageRootsOnAnUnreadableBlock: [], declaredPairsNeitherFoundNorExplained: [] });
    });
});

describe('GH-676 — the probe is planted in a NEW file, through the parameter `e`', () => {
    const probe = path.join(ROOT, 'assets', '__gh676_probe_delete_me.js');

    afterEach(() => { if (fs.existsSync(probe)) fs.unlinkSync(probe); });

    test('a delegate in a file that did not exist is found, and its read is named', () => {
        // The reviewer's condition: planting it in a file the universe already names
        // would show only that the universe re-reads what it knows.
        fs.writeFileSync(probe, [
            '// GH-676 probe. Created and deleted by the test that plants it.',
            'function gh676ProbeDelegate(e, t) {',
            '    return e.turf.newFieldNobodyDeclared + e.soil.alsoNew;',
            '}',
            'function gh676ProbeWrapper(state) {',
            '    return global.gh676ProbeDelegate(state, null);',
            '}',
            '',
        ].join('\n'), 'utf8');

        const viaWrapper = readsOf('gh676ProbeWrapper');
        process.stdout.write('[gh676] the planted probe, read through its wrapper: '
            + JSON.stringify({ bodies: viaWrapper.bodies, reads: viaWrapper.found }) + '\n');

        // The wrapper's own receiver is `state`; the delegate's is `e`, and its reads
        // are the module's reads. Both roads in one claim.
        expect(viaWrapper.found).toContain('turf.newFieldNobodyDeclared');
        expect(viaWrapper.found).toContain('soil.alsoNew');
        expect(viaWrapper.bodies.map((b) => b.file))
            .toContain('assets/__gh676_probe_delete_me.js');
    });

    test('and with the probe gone the universe no longer names it', () => {
        expect(fs.existsSync(probe)).toBe(false);
        expect(readsOf('gh676ProbeWrapper').bodies).toEqual([]);
    });
});

describe('GH-677 (item 6a) — (b) the handle resolves, and an ambiguous one is a RED, not a choice', () => {
    /** Every (pass, handle) pair a node declares, flattened, with the node it came from. */
    const pairs = () => {
        const out = [];
        Object.entries(NODES).forEach(([id, n]) => {
            const runners = Array.isArray(n.runner) ? n.runner : (n.runner ? [n.runner] : []);
            const handles = Array.isArray(n.handle) ? n.handle : (n.handle ? [n.handle] : []);
            // ONE HANDLE MAY SERVE SEVERAL PASSES — the pairwise assumption lived on here
            // after being taken out of the claim, and it reported "declares a pass with no
            // handle" for two nodes that have exactly one function run by both passes.
            runners.forEach((r, i) => out.push({
                id, pass: r, handle: handles.length === 1 ? handles[0] : handles[i],
            }));
        });

        return out;
    };

    test('the pass/handle pairs are printed before anything is claimed', () => {
        const mismatched = Object.entries(NODES).filter(([, n]) => {
            const r = Array.isArray(n.runner) ? n.runner.length : (n.runner ? 1 : 0);
            const h = Array.isArray(n.handle) ? n.handle.length : (n.handle ? 1 : 0);

            return r !== h;
        }).map(([id]) => id);
        const all = pairs();
        process.stdout.write('[gh677] (b) pass/handle pairs (' + all.length + '):\n');
        all.forEach((x) => process.stdout.write('[gh677]    ' + x.id + ' <- ' + x.pass + ' ' + x.handle + '\n'));

        /**
         * PAIRWISE IS SUPERSEDED, and the reason is a case that could only be satisfied by a
         * lie: `climate-engine` is run by BOTH passes through ONE function, so a second
         * handle would have to be invented. I duplicated the handle once to keep the counts
         * equal and then took it out — data written to satisfy a rule is worse than the rule
         * being wrong.
         *
         * What holds instead, and it contains the old rule as a special case: every handle
         * resolves to a function (the case below), and the set of declared runners equals the
         * set the caller fixpoint finds (the invariant). A node that loses one of two
         * executors is caught by the equality, which is what pairwise was protecting.
         */
        const runnerList = (n) => (Array.isArray(n.runner) ? n.runner : (n.runner ? [n.runner] : []));
        const handleList = (n) => (Array.isArray(n.handle) ? n.handle : (n.handle ? [n.handle] : []));
        const counts = Object.entries(NODES).map(([id, n]) => id + ': ' + runnerList(n).length
            + ' runner(s), ' + handleList(n).length + ' handle(s)');
        process.stdout.write('[gh677] runners and handles, by node: ' + JSON.stringify(counts) + '\n');
        expect(mismatched.length).toBeGreaterThanOrEqual(0);
    });

    test('every handle resolves to exactly one function — this is universe (b)', () => {
        const broken = [];
        const ambiguous = [];
        pairs().forEach(({ id, handle }) => {
            if (!handle) { broken.push(id + ' declares a pass with no handle'); return; }
            if (handle.indexOf(':') === -1) {
                const where = filesDeclaring(handle);
                if (!where.length) broken.push(id + ' -> ' + handle + ' (declared in no file)');
                else if (where.length > 1) {
                    ambiguous.push(id + ' -> ' + handle + ' declared in ' + JSON.stringify(where));
                }

                return;
            }
            if (!functionNamed(handle)) broken.push(id + ' -> ' + handle + ' (qualified, and not there)');
        });
        process.stdout.write('[gh677] (b) handles that do not resolve: ' + JSON.stringify(broken) + '\n'
            + '[gh677] (b) bare handles declared in more than one file: ' + JSON.stringify(ambiguous) + '\n');

        expect({ handlesThatDoNotResolve: broken, ambiguousBareHandles: ambiguous })
            .toEqual({ handlesThatDoNotResolve: [], ambiguousBareHandles: [] });
    });

    test('POSITIVE CONTROL: the ambiguity is real, and the qualified form is what cures it', () => {
        // Measured rather than asserted in prose: `generateForecast` IS declared twice,
        // so a bare handle here would be a silent first match. The disease forecast
        // node carries the qualified form, and it lands in the intended file.
        const where = filesDeclaring('generateForecast');
        process.stdout.write('[gh677] `generateForecast` is declared in: ' + JSON.stringify(where) + '\n');
        expect(where.length).toBeGreaterThan(1);
        expect(functionNamed('assets/disease-forecast.js:generateForecast').file)
            .toBe('assets/disease-forecast.js');
        expect(functionNamed('assets/pgr-forecast.js:generateForecast').file)
            .toBe('assets/pgr-forecast.js');
    });

    test('a node with no runner says WHY, in the data, and the reasons are printed', () => {
        const silent = [];
        const stated = [];
        Object.entries(NODES).forEach(([id, n]) => {
            const hasRunner = Array.isArray(n.runner) ? n.runner.length : !!n.runner;
            if (hasRunner) return;
            if (n.noRunnerBecause) stated.push(id);
            else silent.push(id);
        });
        stated.forEach((id) => process.stdout.write('[gh677] no runner, and the reason: ' + id
            + ' — ' + NODES[id].noRunnerBecause + '\n'));

        // An empty field and a field nobody has filled in yet are the same thing on
        // the screen. A reason makes them different.
        expect({ nodesWithNeitherRunnerNorReason: silent })
            .toEqual({ nodesWithNeitherRunnerNorReason: [] });
    });
});

/**
 * GH-677 (item 6a) — THE EVIDENCE FOR THE SPLIT, PRINTED PER READ.
 *
 * `requires` or `uses` is a judgement about what the module does without the input,
 * and the analyst named the sign to look for: a SUBSTITUTION at the read site
 * (`|| 0`, `?? ''`, `safeNum(…, 7)`) means the module computes DIFFERENTLY without
 * it, which is `uses`; a read with no substitution, or one standing in a guard that
 * returns early, is a candidate for `requires`.
 *
 * So this case prints, for every read (c) found, the line it stands on and whether
 * that line substitutes. The split is then filled from THIS output rather than from
 * the plan's tables — which had already drifted from each other, seven against
 * eighty-six — and each row carries the evidence it was decided on.
 *
 * It asserts nothing about the verdict. It asserts that the evidence exists: a read
 * whose line cannot be found is a read this device cannot judge, and that is printed
 * as a hole of its own rather than defaulted to either side.
 */
describe('GH-677 — the evidence each split row is decided on', () => {
    const SUBSTITUTES = /\|\||\?\?|safeNum\s*\(|parseFloat\s*\([^)]*\)\s*\|\||Number\s*\([^)]*\)\s*\|\|/;

    test('every read (c) found is printed with its line and whether that line substitutes', () => {
        const handlesOf = (n) => (Array.isArray(n.handle) ? n.handle : (n.handle ? [n.handle] : []));
        const aliases = cascadeSectionAliases();
        const rows = [];
        const unlocatable = [];
        const notInputs = [];
        /**
         * WHAT IS NOT AN INPUT AT ALL — and the FIRST version of this was too wide,
         * which is worth keeping written down because it is the trap itself.
         *
         * I took the result roots from the graph's own outputs, on the reasoning that
         * a root some node writes is a result. But the state's INPUT sections and the
         * result roots share their names: a module writes `computed.water`, and the
         * state carries an input section `water` holding the sample. So the wide form
         * swallowed `water.ecw`, `pgr.applicationDate`, `tissue.N` and thirty more
         * REAL inputs and reported them as results — a census that loses its subject
         * and stays green.
         *
         * What separates them is not the name, it is the ROAD: a result is read
         * through `computed.` or `derived.`, and everything else on the state came out
         * of `inputs`. So the set is those two, plus the local names under which
         * another module's result travels on the state — each named, with what it is.
         */
        const resultRoots = new Set(['computed', 'derived']);
        const RESULT_ALIASES = {
            ambientDLI: 'the ambient DLI engine\'s result, carried on the state by the run (GH-589)',
            climateMetrics: 'the climate engine\'s result under its local name',
        };
        const WEATHER = new Set(['daily', 'hourly', 'forecast']);
        Object.entries(NODES).forEach(([id, n]) => {
            handlesOf(n).forEach((h) => {
                const fn = functionNamed(h);
                if (!fn) return;
                const reads = readsOf(h);
                const bodies = reads.bodies.map((b) => functionNamed(b.file + ':' + b.name) || fn);
                reads.found.forEach((raw) => {
                    const [rawSection, field] = raw.split('.');
                    // The cascade's rename is undone FIRST: `state.traffic.restDays`
                    // inside an engine is `schedule.restDays` in the inputs list, and
                    // classifying before un-renaming judged the local name.
                    const section = aliases[rawSection] || rawSection;
                    if (resultRoots.has(section) || WEATHER.has(section) || RESULT_ALIASES[section]) {
                        notInputs.push(id + ' reads ' + section + '.' + field + ' — '
                            + (WEATHER.has(section) ? 'the weather payload, fetched rather than entered'
                                : (RESULT_ALIASES[section] || 'another module\'s result'))
                            + ', so it belongs to `after`, not to `requires`/`uses`');

                        return;
                    }
                    const raw2 = section + '.' + field;
                    let line = null;
                    let onlyProse = false;
                    for (const b of bodies) {
                        // PROSE IS NOT CODE, and this is the second time in two days it
                        // had to be said: the first run of this printer decided
                        // `soil.LOI` was a bare read on the strength of the comment
                        // `// Get OM% - soil.LOI and soil.OM_pct are the same field`,
                        // and `disease-engine` read five fields whose only line was a
                        // docblock naming them. A comment is evidence of nothing, and a
                        // debug print is evidence about the log, not about the module.
                        // Searched by the LOCAL section name — `traffic.restDays` is
                        // what the line says; `schedule.restDays` is what it MEANS, and
                        // searching for the meaning found nothing in eight rows.
                        const lines = (b.body || '').split('\n').map((l) => l.trim());
                        const withField = lines.filter((l) => new RegExp('\\.\\s*' + field + '\\b').test(l));
                        // Preferred: the line names the section too. Accepted: the line
                        // names only the field, because a read through a LOCAL ALIAS
                        // says `raw.pH`, not `soil.pH` — eight rows of `buildDiseaseInputs`
                        // had no locatable line for exactly that reason, and dropping
                        // them would have been the census losing its own subject.
                        const matches = withField.filter((l) => new RegExp('(?:\\.|\\b)' + rawSection + '\\b').test(l))
                            .concat(withField);
                        const code = matches.filter((l) => !/^(?:\/\/|\/\*|\*)/.test(l)
                            && !/^console\.(?:log|warn|error)\s*\(/.test(l));
                        if (code.length) { line = code[0]; break; }
                        if (matches.length) onlyProse = true;
                    }
                    if (!line) {
                        unlocatable.push(id + ' ' + raw + ' (via ' + h + ')'
                            + (onlyProse ? ' — ONLY IN A COMMENT OR A DEBUG PRINT' : ''));

                        return;
                    }
                    rows.push({ id, read: raw2, via: h, substitutes: SUBSTITUTES.test(line), line: line.slice(0, 160) });
                });
            });
        });
        rows.forEach((r) => process.stdout.write('[gh677ev] ' + r.id + ' | ' + r.read
            + ' | ' + (r.substitutes ? 'SUBSTITUTES' : 'bare') + ' | ' + r.line + '\n'));
        notInputs.forEach((x) => process.stdout.write('[gh677ev] NOT AN INPUT: ' + x + '\n'));
        process.stdout.write('[gh677ev] reads with evidence: ' + rows.length
            + ' | substituting: ' + rows.filter((r) => r.substitutes).length
            + ' | bare: ' + rows.filter((r) => !r.substitutes).length + '\n'
            + '[gh677ev] reads whose line could not be found: ' + JSON.stringify(unlocatable) + '\n');

        expect(rows.length).toBeGreaterThan(100);
    });
});

describe('GH-677 — `notInputs` and `derived` are checked over the WIDER universe', () => {
    /**
     * The side of GH-644 that its own universe could not answer (59.5 item 7). Every
     * name the list excuses as "not an input" must be READ by something — otherwise the
     * block grows on its own and becomes a permission list. The universe here is every
     * script in `assets`, through both passes, so a name read only by an orchestrator
     * builder is seen.
     */
    test('every name the list excuses is actually read by some module', () => {
        const handlesOf = (n) => (Array.isArray(n.handle) ? n.handle : (n.handle ? [n.handle] : []));
        const aliases = cascadeSectionAliases();
        const read = new Set();
        Object.values(NODES).forEach((n) => handlesOf(n).forEach((h) => {
            readsOf(h).found.forEach((raw) => {
                const [sec, field] = raw.split('.');
                read.add(raw);
                read.add((aliases[sec] || sec) + '.' + field);
                read.add(field);
            });
        }));
        const excused = Object.keys(LIST.notInputs).filter((k) => k !== '$comment')
            .concat(Object.keys(LIST.derived).filter((k) => k !== '$comment'));
        const byTheNodes = excused.filter((k) => read.has(k) || read.has(k.split('.').pop()));
        const notByTheNodes = excused.filter((k) => !byTheNodes.includes(k));
        /**
         * THE CLAIM IS NARROWED TO ITS UNIVERSE, and narrowing it is the point.
         *
         * My first form asserted that every excused name is read by one of the nodes'
         * handles, and fourteen names failed it — `effectiveSpecies`, `climateRegime`,
         * `soil.ESP` and more. They are not dead: they are read by page modules and by
         * functions that are not a node's handle, and the graph has no page nodes until
         * item 3ayu. So the strong form was exactly the fault I had just repaired in
         * `gh644` — a check asking a question its universe cannot answer — pointed the
         * other way.
         *
         * What CAN be claimed over a complete universe: a name the list excuses that
         * appears in no script at all. That is a list growing on its own, and the
         * universe for it is every file, textually, not the handles.
         */
        const everyScript = scriptFiles().map((f) => fs.readFileSync(f, 'utf8')).join('\n');
        const nowhere = notByTheNodes.filter((k) => {
            const field = k.split('.').pop();

            return !new RegExp('\\b' + field + '\\b').test(everyScript);
        });
        process.stdout.write('[gh677] names excused by the list: ' + excused.length
            + ' | read by a node\'s handle: ' + byTheNodes.length + '\n'
            + '[gh677]    excused, and read only outside the nodes (page modules, item 3ayu): '
            + JSON.stringify(notByTheNodes) + '\n'
            + '[gh677]    excused and present in NO script at all: ' + JSON.stringify(nowhere) + '\n');

        expect(byTheNodes.length).toBeGreaterThan(0);
        expect({ excusedAndNowhereInTheCode: nowhere }).toEqual({ excusedAndNowhereInTheCode: [] });
    });
});

/**
 * GH-678 (returns 7 and 9) — A NODE IS EXECUTED BY WHOEVER ITS `runner` NAMES, AND BY
 * NOBODY ELSE.
 *
 * The reviewer's invariant, one claim with a parameter instead of a pair of assertions
 * per runner kind. The pair could not be written: a producer node may have no view at
 * all, so "its view does not load the file" would be an assertion about nothing, and the
 * mirror would have to be invented.
 *
 * THE UNIVERSE IS CALL SITES, NOT LISTS. Every script in `assets` is scanned for calls
 * of each handle. A list would be the graph checking itself the moment the run's own
 * lists are derived from the graph, which is the next step of this very item.
 *
 * THE KIND OF A CALL SITE COMES FROM THE FILE THAT MAKES IT, and the four files are
 * named here with what each one is. A call from any other file is UNCLASSIFIED and
 * reddens: that is the whole point — an execution by somebody the node does not name.
 *
 * `self` IS NOT A RUNNER. A call inside the file that declares the handle is the module
 * starting itself when a view loads it, or its own internal wiring; neither is another
 * runner executing it. Counted, printed, and excluded from the comparison — and the
 * boundary is named: this device does not separate a top-level self-start from a call
 * inside another function of the same module. Both happen only when a view loads that
 * file, which is what the `page` address is about.
 */
describe('GH-678 — the node is executed by whoever is declared, and by nobody else', () => {
    const EXECUTOR_OF = {
        'assets/cascade-orchestrator.js': 'cascade',
        'assets/hub-orchestrator.js': 'orchestrator',
        'assets/hub-persistence.js': 'producer',
    };
    const WHY = {
        cascade: 'the cascade adapter\'s run loop, which calls its engines by name',
        orchestrator: 'the orchestrator\'s two pass bodies',
        producer: 'the row producer, which calls a module before the one write',
    };

    const handlesOf = (n) => (Array.isArray(n.handle) ? n.handle : (n.handle ? [n.handle] : []));
    const runnersOf = (n) => (Array.isArray(n.runner) ? n.runner : (n.runner ? [n.runner] : []));

    /** Every call of `name` across the universe, with the file and line, declaration excluded. */
    const declaresOwn = (rel, bare) => new RegExp('function\\s+' + bare + '\\s*\\(')
        .test(fs.readFileSync(path.join(ROOT, rel), 'utf8'));

    /**
     * THE NAMES A FUNCTION IS CALLED BY, taken from its own file's exports.
     *
     * Found by this device's first run, and it is three of the twenty-three nodes: a
     * module is not called by the name it is declared under. The orchestrator calls
     * `global.gaip_enhanced_soil_temp(...)`, `global.AmbientDLIEngine.calculate(...)`
     * and `global.DiseaseForecast.generateForecast(...)` — the export names. Searching
     * for the declared name alone reported "nobody calls this handle" for all three,
     * which is a census losing its subject and stating the loss as a finding.
     *
     * The aliases are read out of the DECLARING FILE's export statements, so a renamed
     * export travels with the code instead of with a list written here.
     */
    function exportNamesOf(rel, bare) {
        const src = fs.readFileSync(path.join(ROOT, rel), 'utf8');
        const names = new Set([bare]);
        const direct = new RegExp('(?:global|window|exportTarget|module\\.exports)\\s*\\.\\s*(\\w+)\\s*=\\s*'
            + bare + '\\b', 'g');
        let m;
        while ((m = direct.exec(src)) !== null) names.add(m[1]);
        // `{ calculate: calculateAmbientDLI }` in an export object: the key is the name
        // callers use — BUT ONLY THROUGH THE OBJECT. Taking the bare key was this
        // device's third fault and the widest: `calculate` matched `.calculate(` in
        // forty-six places across eleven files, and the invariant reported the ambient
        // DLI node as executed by everything that has a method of that name. So an
        // object key is carried WITH the object names this file exports, and a call
        // through it counts only on a line that names one of them.
        const objects = new Set();
        const exported = /(?:global|window|exportTarget)\s*\.\s*(\w+)\s*=/g;
        while ((m = exported.exec(src)) !== null) objects.add(m[1]);
        const keys = new Set();
        const inObject = new RegExp('(\\w+)\\s*:\\s*' + bare + '\\b', 'g');
        while ((m = inObject.exec(src)) !== null) keys.add(m[1]);

        return { names: [...names], keys: [...keys], objects: [...objects] };
    }

    function callSitesOf(handle) {
        const bare = handle.indexOf(':') !== -1 ? handle.slice(handle.indexOf(':') + 1) : handle;
        const ownFile = (functionNamed(handle) || {}).file || null;
        const exports_ = ownFile ? exportNamesOf(ownFile, bare) : { names: [bare], keys: [], objects: [] };
        const names = exports_.names;
        const viaObject = exports_.keys.filter((k) => k !== bare);
        const out = [];
        scriptFiles().forEach((file) => {
            const rel = path.relative(ROOT, file);
            fs.readFileSync(file, 'utf8').split('\n').forEach((line, i) => {
                // Three roads to the same function, and each is matched for what it is:
                // the declared name UNDOTTED (a same-named method on somebody else's
                // object is not this function); a direct export name, dotted or not
                // (`global.gaip_enhanced_soil_temp(...)`); and an object key, which
                // counts only on a line that also names an object this file exports.
                const byName = names.some((n) => new RegExp(
                    n === bare ? '(?<![\\w.])' + n + '\\s*\\(' : '(?:(?<![\\w])|\\.)\\s*' + n + '\\s*\\(').test(line));
                const byObject = viaObject.length
                    && exports_.objects.some((o) => new RegExp('\\b' + o + '\\b').test(line))
                    && viaObject.some((k) => new RegExp('\\.\\s*' + k + '\\s*\\(').test(line));
                if (!byName && !byObject) return;
                // The declaration is not a call, and neither is a comment.
                if (new RegExp('function\\s+' + bare + '\\s*\\(').test(line)) return;
                if (/^\s*(?:\/\/|\*|\/\*)/.test(line.trim())) return;
                // A FILE THAT DECLARES ITS OWN FUNCTION OF THIS NAME IS CALLING ITS OWN.
                // `generateForecast` exists in three files, and without this the disease
                // forecast node was reported as executed from `pgr-forecast.js` and
                // `shade-forecast.js` — the same-name trap the qualified handle exists to
                // avoid, arriving from the call side instead of the declaration side.
                if (rel !== ownFile && declaresOwn(rel, bare)) return;
                out.push({ file: rel, line: i + 1, text: line.trim().slice(0, 100) });
            });
        });

        return out;
    }

    test('POSITIVE CONTROL: the two kinds that must exist are found, by file and line', () => {
        const cascade = callSitesOf('executeFirmnessEngine')
            .filter((c) => EXECUTOR_OF[c.file] === 'cascade');
        /**
         * GH-755 (queue item 3bz): THE SPECIMEN CHANGED, THE CLAIM DID NOT. This control used
         * `buildIrrigationInputs`, whose only call site was inside `executeEngine` — an export with
         * no caller, removed with its body — so the specimen stopped existing and the control would
         * have reported "no orchestrator call sites found" as if the census had gone blind.
         * `buildDiseaseInputs` is a live one: four call sites, none of them in the removed body.
         */
        const orchestrator = callSitesOf('buildDiseaseInputs')
            .filter((c) => EXECUTOR_OF[c.file] === 'orchestrator');
        process.stdout.write('[gh678] control — `executeFirmnessEngine` cascade call sites: '
            + JSON.stringify(cascade) + '\n'
            + '[gh678] control — `buildDiseaseInputs` orchestrator call sites: '
            + JSON.stringify(orchestrator) + '\n');
        expect(cascade.length).toBeGreaterThan(0);
        expect(orchestrator.length).toBeGreaterThan(0);
    });

    test('a handle with no caller AND no unresolved edge is a node that never runs', () => {
        /**
         * The two are not the same statement, and the case used to conflate them. "Nobody
         * calls it" is a FACT when every road to a function can be seen; where a road exists
         * but the resolver is blind on it — a call through a local alias of an exported
         * object — the honest answer is "not confirmed", and it belongs in the list with its
         * count rather than in a red that says the declaration is wrong.
         */
        const walk = require('./helpers/gh678-caller-walk');
        const files = walk.universe();
        const nodeHandles = {};
        Object.entries(NODES).forEach(([id, n]) => handlesOf(n).forEach((h) => {
            nodeHandles[h.indexOf(':') !== -1 ? h.slice(h.indexOf(':') + 1) : h] = id;
        }));
        const REG = {
            'assets/cascade-orchestrator.js:runCascade': 'cascade',
            'assets/hub-orchestrator.js:runComputePass': 'orchestrator',
            'assets/hub-orchestrator.js:computeAll': 'orchestrator',
            'assets/hub-persistence.js:_writeResult': 'producer',
            'assets/hub-persistence.js:cacheAnalysisResults': 'producer',
        };
        const fp = walk.rootsByFixpoint({ files, registries: REG, handles: nodeHandles });
        const never = [];
        const blind = [];
        Object.entries(NODES).forEach(([id, n]) => handlesOf(n).forEach((h) => {
            const bare = h.indexOf(':') !== -1 ? h.slice(h.indexOf(':') + 1) : h;
            const pref = h.indexOf(':') !== -1 ? h.slice(0, h.indexOf(':')) : null;
            const key = [...fp.value.keys()].find((k) => k.endsWith(':' + bare)
                && (!pref || k.startsWith(pref)));
            if (!key) { never.push(id + ' -> ' + h + ' (the handle resolves to no function)'); return; }
            const callers = fp.callersByKey.get(key) || [];
            const resolved = callers.filter((c) => c.terminal !== 'unresolved');
            if (resolved.length) return;
            if (callers.length) blind.push(id + ' -> ' + h + ': ' + callers.length
                + ' caller(s), none of them resolved');
            else never.push(id + ' -> ' + h + ' (no caller at all)');
        }));
        process.stdout.write('[gh678] handles with no resolved caller, and no unresolved edge either: '
            + JSON.stringify(never) + '\n'
            + '[gh678] handles whose only callers are unresolved — NOT the same claim: '
            + JSON.stringify(blind) + '\n');

        expect({ handlesNobodyReaches: never }).toEqual({ handlesNobodyReaches: [] });
    });

    test('THE INVARIANT: a node is executed by whoever its `runner` names, and by nobody else', () => {
        /**
         * ONE CLAIM WITH A PARAMETER, over the CALLER FIXPOINT rather than over lists. A value
         * is the union of its callers' values, iterated to convergence, so the answer does not
         * depend on the order anything was visited — the earlier form collected roots along
         * paths and gave a different answer for the same node depending on how it was reached.
         *
         * THE KIND OF A CALL SITE COMES FROM THE FUNCTION IT SITS IN, not from the file. The example
         * this was written on: the call to `buildIrrigationInputs` sat inside `executeEngine`, which
         * lives in the orchestrator's file and was reached only from a dead export, so deciding by
         * FILE said `orchestrator` — coherent, and false. GH-755 removed both, so the example is
         * history and the rule is not: a call site's kind is still read from its enclosing function.
         *
         * `page` IS NOT COMPARED AS A KIND. Its address is a VIEW (77.22), so it is compared as
         * node x view PAIRS: what the walk finds must equal what the graph declares as INTENT
         * plus the divergences already named in the GH-680 list. Writing what the walk found
         * into the graph would make the graph check itself.
         *
         * A DECLARED KIND THAT IS NOT FOUND is split in two, because the two say different
         * things: with no unresolved edge it is `never calls it` — the declaration is wrong or
         * the path is dead; with an unresolved edge it is `not confirmed` — the walk is blind
         * there, and that goes to the list with the count rather than reading as a wrong
         * declaration.
         */
        const REGISTRIES = {
            'assets/cascade-orchestrator.js:runCascade': 'cascade',
            'assets/hub-orchestrator.js:runComputePass': 'orchestrator',
            'assets/hub-orchestrator.js:computeAll': 'orchestrator',
            'assets/hub-persistence.js:_writeResult': 'producer',
            'assets/hub-persistence.js:cacheAnalysisResults': 'producer',
        };
        const walk = require('./helpers/gh678-caller-walk');
        const DIVERGENCES = JSON.parse(fs.readFileSync(
            path.join(ROOT, 'tests', 'fixtures', 'gh680-page-divergences.json'), 'utf8'));
        const files = walk.universe();
        const nodeHandles = {};
        Object.entries(NODES).forEach(([id, n]) => handlesOf(n).forEach((h) => {
            nodeHandles[h.indexOf(':') !== -1 ? h.slice(h.indexOf(':') + 1) : h] = id;
        }));
        const fp = walk.rootsByFixpoint({ files, registries: REGISTRIES, handles: nodeHandles });
        fp.files = files;
        process.stdout.write('[gh678] the fixpoint settled in ' + fp.iterations + ' passes, '
            + fp.additions + ' element additions against a limit of ' + fp.updateLimit
            + ' (' + fp.functions + ' functions x lattice height ' + fp.latticeHeight + ').'
            + ' THE NUMBER OF PASSES DEPENDS ON THE ORDER OF TRAVERSAL; the VALUES do not.\n');

        const keyFor = (h) => {
            const bare = h.indexOf(':') !== -1 ? h.slice(h.indexOf(':') + 1) : h;
            const pref = h.indexOf(':') !== -1 ? h.slice(0, h.indexOf(':')) : null;

            return [...fp.value.keys()].find((k) => k.endsWith(':' + bare)
                && (!pref || k.startsWith(pref))) || null;
        };

        const undeclaredRunner = [];
        const neverCallsIt = [];
        const notConfirmed = [];
        const account = [];
        Object.entries(NODES).forEach(([id, n]) => {
            const handles = handlesOf(n);
            if (!handles.length) return;
            const declared = new Set(runnersOf(n).filter((r) => r !== 'page'));
            const found = new Set();
            let unresolvedHere = 0;
            handles.forEach((h) => {
                const key = keyFor(h);
                if (!key) { unresolvedHere++; return; }
                const e = walk.executorsOfHandle(fp, key, { graph: GRAPH });
                // A page kind arrives as `page|<file>`; comparing it as a bare kind was the
                // mistake this separation exists to remove, and the filter has to match the
                // shape rather than the word.
                e.kinds.forEach((k) => { if (!String(k).startsWith('page')) found.add(k); });
                unresolvedHere += e.unresolved.size;
            });
            account.push(id + ' declares {' + [...declared].sort().join(',')
                + '} and is executed by {' + [...found].sort().join(',') + '}'
                + (unresolvedHere ? ' + ' + unresolvedHere + ' unresolved edge(s)' : ''));
            [...found].sort().filter((k) => !declared.has(k)).forEach((k) => undeclaredRunner.push(
                id + ' is executed by `' + k + '` and does not declare it'));
            [...declared].sort().filter((k) => !found.has(k)).forEach((k) => {
                const line = id + ': declared `' + k + '`';
                if (unresolvedHere) notConfirmed.push(line + ' not confirmed — ' + unresolvedHere
                    + ' unresolved edge(s) here');
                else neverCallsIt.push(line + ' never calls it');
            });
        });
        account.sort().forEach((a) => process.stdout.write('[gh678]    ' + a + '\n'));

        /**
         * THE STATES OF A NODE, ENUMERATED IN FULL WITH EXPLICIT ZEROS — the reviewer's condition,
         * and it exists because `not confirmed` stopped being a KIND and became a STATE. The
         * universe of states is now exactly where the universe of kinds was yesterday, when a
         * kind that did not occur was simply absent from the summary and I read the absence as a
         * zero. Moving a hole is not closing it.
         */
        const STATES = ['executed-as-declared', 'executed-by-an-undeclared-runner',
            'declared-never-calls-it', 'not-confirmed', 'declares-no-runner'];
        const states = {};
        STATES.forEach((k) => { states[k] = 0; });
        Object.entries(NODES).forEach(([id, n]) => {
            if (!handlesOf(n).length) { states['declares-no-runner']++; return; }
            const undeclared = undeclaredRunner.some((x) => x.startsWith(id + ' '));
            const never = neverCallsIt.some((x) => x.startsWith(id + ':'));
            const unconfirmed = notConfirmed.some((x) => x.startsWith(id + ':'));
            if (undeclared) states['executed-by-an-undeclared-runner']++;
            else if (never) states['declared-never-calls-it']++;
            else if (unconfirmed) states['not-confirmed']++;
            else states['executed-as-declared']++;
        });
        process.stdout.write('[gh678] node states, the DECLARED universe with explicit zeros: '
            + JSON.stringify(states) + '\n');
        STATES.forEach((k) => expect(states).toHaveProperty(k));

        // ---- `page`, as pairs against intent plus the named divergences.
        const foundPairs = walk.pagePairsFound(fp, GRAPH);
        const declaredPairs = new Set();
        Object.entries(NODES).forEach(([id, n]) => (n.page || []).forEach((v) => declaredPairs.add(id + ' : ' + v)));
        const listed = Object.keys(DIVERGENCES.entries);
        const foundKeys = [...foundPairs.keys()].sort();
        const newDivergences = foundKeys.filter((k) => {
            const [node, view] = k.split(' : ');

            return !declaredPairs.has(node + ' : ' + view) && !listed.includes(k);
        });
        const goneDivergences = listed.filter((k) => {
            const [node, view] = k.split(' : ');

            return !foundKeys.includes(k) || declaredPairs.has(node + ' : ' + view);
        });
        const declaredNotFound = [...declaredPairs].sort()
            .filter((d) => !foundKeys.some((k) => k.startsWith(d + ' : ')));
        const unexplained = declaredNotFound
            .filter((d) => !Object.prototype.hasOwnProperty.call(DIVERGENCES.declaredNotConfirmed || {}, d));
        const byEntry = {};
        foundKeys.forEach((k) => { const e = k.split(' : ')[2]; byEntry[e] = (byEntry[e] || 0) + 1; });
        process.stdout.write('[gh680] page pairs FOUND (' + foundKeys.length + ', by entry '
            + JSON.stringify(byEntry) + '): ' + JSON.stringify(foundKeys) + '\n'
            + '[gh680] page pairs DECLARED as intent: ' + JSON.stringify([...declaredPairs].sort()) + '\n'
            + '[gh680] divergences listed under GH-680: ' + listed.length
            + ' | declared but not confirmed: '
            + JSON.stringify(Object.keys(DIVERGENCES.declaredNotConfirmed || {})) + '\n');

        /**
         * GH-723 (item 3bi) — THE PAIRS THE NARROWED DEFINITION DROPPED, PRINTED RATHER THAN
         * SWALLOWED, and each pair's own facts printed beside it.
         *
         * A pair leaves because the view loads the ROOT's file and not the HANDLE's, which means
         * the walk reported an edge the page cannot have: a defect of the walk, and it needs a
         * ticket of its own rather than silence. Printing it is what keeps the narrowing from
         * being a filter over the symptom.
         */
        process.stdout.write('[gh723] pairs dropped by the narrowed reachability ('
            + (foundPairs.falseEdges || []).length + '):\n'
            + (foundPairs.falseEdges || []).map((l) => '[gh723]    ' + l).join('\n') + '\n'
            + '[gh723] pairs that remain, with the facts their reasons rest on:\n'
            + [...foundPairs.entries()].sort().map(([k, v]) => '[gh723]    ' + k
                + ' | root ' + v.via + ' | handle file ' + v.handleFile).join('\n') + '\n');

        expect({
            executedByAnUndeclaredRunner: undeclaredRunner,
            declaredRunnerNeverCallsIt: neverCallsIt,
            newPageDivergences: newDivergences,
            divergencesResolvedRemoveFromTheList: goneDivergences,
            declaredPagePairsNeitherFoundNorExplained: unexplained,
        }).toEqual({
            executedByAnUndeclaredRunner: [],
            declaredRunnerNeverCallsIt: neverCallsIt,
            newPageDivergences: [],
            divergencesResolvedRemoveFromTheList: [],
            declaredPagePairsNeitherFoundNorExplained: [],
        });

        // The dead branch stays red BY DECISION until the dead exports are settled, and it is
        // named here rather than hidden in an allowance: these three declare a runner whose
        // only path is through `computeIsolated`/`computeSelective`, which nothing reaches.
        process.stdout.write('[gh678] declared runner never calls it (red by decision, item 3bz): '
            + JSON.stringify(neverCallsIt) + '\n'
            + '[gh678] declared but not confirmed: ' + JSON.stringify(notConfirmed) + '\n');
        /**
         * THE DEAD BRANCH IS NOT RED HERE, AND THAT IS THE ANALYST'S RULE RATHER THAN MY
         * CHOICE: `no-caller` neither reddens a node nor gives it a kind, because a dead
         * export is a fact about the code and not a wrong declaration. The three nodes whose
         * only orchestrator path runs through `computeIsolated`/`computeSelective` therefore
         * arrive as `not confirmed` with their counts, and the dead call sites themselves are
         * held by their own ratcheted list — where a NEW dead place reddens by name and a
         * place that came alive reddens as `resolved, remove from the list`.
         *
         * The tension with "leave them red until the dead exports are settled" is named
         * rather than resolved by me: under her rule they are not red anywhere except as
         * ratcheted entries, and which of the two holds is a decision, not a detail.
         */
        expect(Array.isArray(notConfirmed)).toBe(true);
    });

    /**
     * GH-723 (item 3bi) — THE SHAPE OF AN ENTRY IS HELD BY SOMETHING, NOT BY WHOEVER WROTE IT.
     *
     * Found by the reviewer of GH-723, and found the way we ask findings to be found: she took the
     * `why` and the `state` off all twenty-two entries and put the batch ticket back, and the suite
     * gave 31 green. So the defect the item exists to remove — one reason standing for a whole
     * batch — could come back without a single red, which is what happened.
     *
     * WHAT IS ASSERTED, per entry rather than as a count: `why` exists and is DIFFERENT from every
     * other entry's, so a reason copied across the batch is red; `state` is one of the declared
     * ones, so a new word cannot be invented in passing; `ticket` is present. Her exception is
     * kept in her words: `ticket` need NOT be distinct — several entries may honestly close under
     * one ticket, and it is the REASON that has to answer for the entry, not the number.
     */
    /**
     * GH-726 (item 3bp) — WHAT MAKES THE DROPPED PAIRS HARMLESS, ASSERTED INSTEAD OF ASSUMED.
     *
     * GH-723 narrowed `reachable on a view` to "the view loads the handle's file too", and 32
     * pairs left. Measured then: the call chains from the root to those handles DO exist, so the
     * graph was not lying — what was wrong was the pair. The pairs are harmless for one reason and
     * one only: every caller on the way to such a handle stands behind a check that the global is
     * there, so on a view without the file the path simply does not run.
     *
     * NOTHING HELD THAT REASON. Measured before writing this: removing the check at
     * `ambient-dli-integration.js:36` left four suites and 42 cases green. Take a check away and
     * the pair we declared impossible becomes a crash on a live view, and the narrowing turns out
     * to have been right by coincidence.
     *
     * BOUNDARY, and it is the item's: only the `page` kind. Whether other kinds of accounting rest
     * on the same widened answer is out of scope here and carried by the defects document, which
     * is where a question's number lives; this file names tickets only.
     *
     * SECOND BOUNDARY, OF THE METHOD, and it is stated as the code behaves rather than as an
     * earlier draft of it did. The guard is looked for in the text of EVERY function enclosing the
     * call, each from its own start down to the call — a check standing further up the stack IS
     * seen, which is what `disease-ui.js:33` needs: it calls inside `setTimeout(function () { … })`
     * while its guard sits in the function around that one. What remains outside the method is
     * narrower and belongs to the language: a SISTER function declared above the call inside the
     * same enclosing one falls in that window, so a guard written there would count.
     */
    test('GH-726: every call that can reach a dropped handle stands behind a presence check', () => {
        const walk = require('./helpers/gh678-caller-walk');
        const files = walk.universe();
        const byRel = {};
        files.forEach((f) => { byRel[f.rel] = f; });

        // The handle files come from the walk's own dropped edges, not from a list written here.
        const graph = GRAPH;
        const REGISTRIES = {
            'assets/cascade-orchestrator.js:runCascade': 'cascade',
            'assets/hub-orchestrator.js:runComputePass': 'orchestrator',
            'assets/hub-orchestrator.js:computeAll': 'orchestrator',
            'assets/hub-persistence.js:_writeResult': 'producer',
            'assets/hub-persistence.js:cacheAnalysisResults': 'producer',
        };
        const nodeHandles = {};
        Object.entries(graph.nodes).forEach(([id, n]) => handlesOf(n).forEach((h) => {
            nodeHandles[h.indexOf(':') !== -1 ? h.slice(h.indexOf(':') + 1) : h] = id;
        }));
        const fp = walk.rootsByFixpoint({ files, registries: REGISTRIES, handles: nodeHandles });
        fp.files = files;
        const pairs = walk.pagePairsFound(fp, graph);
        const handleFiles = Array.from(new Set((pairs.falseEdges || [])
            .map((l) => (/handle file (\S+) is not/.exec(l) || [])[1]).filter(Boolean)));

        // The name each of those files publishes itself under, read from the file.
        const globalsOf = (rel) => {
            const src = fs.readFileSync(path.join(ROOT, rel), 'utf8');
            return Array.from(new Set(Array.from(
                src.matchAll(/(?:global|window|exportTarget)\.([A-Za-z_$][\w$]*)\s*=/g), (m) => m[1])));
        };
        const names = {};
        handleFiles.forEach((rel) => { names[rel] = globalsOf(rel); });

        const unguarded = [];
        const guarded = [];
        /**
         * GH-726, second pass — THE WINDOW IS THE ENCLOSING FUNCTION, because that is what the
         * sentence above promises and what the language means.
         *
         * The first pass took 120 lines above the call. The reviewer of this item showed what that
         * buys: remove the guard and leave a `typeof AmbientDLIEngine` standing anywhere in those
         * 120 lines — in a neighbouring function, in a comment — and the call reads as guarded. It
         * is the same shape as `gh580`'s text window between two anchors, which grew to the end of
         * the file the day the anchors went. A window with no meaning in the language cannot say
         * whether a guard protects a call.
         *
         * So the functions containing the call are found by parsing, and the guard is looked for
         * in the text of EACH of them, from its own start down to the call. A call at the top
         * level has no enclosing function; there the window is the file above it, the same scope
         * by another name. THE BOUNDARY THAT REMAINS, and it is a boundary of the language rather
         * than of the window: a sister function declared above the call inside the same enclosing
         * one is in that window, so a guard written there would count.
         */
        const parser = require('@babel/parser');
        const traverse = require('@babel/traverse').default;
        const fnCache = new Map();
        const functionsOf = (src, relPath) => {
            if (fnCache.has(relPath)) return fnCache.get(relPath);
            let out = [];
            try {
                const ast = parser.parse(src, {
                    sourceType: 'script', errorRecovery: true,
                    plugins: ['classProperties', 'optionalChaining', 'nullishCoalescingOperator'],
                });
                traverse(ast, {
                    Function(p) {
                        if (!p.node.loc) return;
                        out.push({ from: p.node.loc.start.line, to: p.node.loc.end.line });
                    },
                });
            } catch (e) {
                out = null;   // named below rather than silently treated as "no functions"
            }
            fnCache.set(relPath, out);

            return out;
        };
        const unparsed = [];
        // A view's inline script is a member of the universe under `<view>#scriptN` and has no
        // file of its own; the view it came from is read once, which covers it.
        const paths = Array.from(new Set(files.map((f) => f.rel.split('#')[0])));
        handleFiles.forEach((rel) => {
            names[rel].forEach((name) => {
                paths.forEach((relPath) => {
                    if (relPath === rel) return;
                    const f = { rel: relPath };
                    const src = fs.readFileSync(path.join(ROOT, relPath), 'utf8');
                    const lines = src.split('\n');
                    lines.forEach((text, i) => {
                        // A CALL through the global, not a mention of the name — and prose is not
                        // a call: `@param … From DiseaseForecast.generateForecast()` in a docblock
                        // read as an unguarded call on the first run. Comment lines are dropped by
                        // their opening, which leaves a call sharing a line with a trailing comment
                        // visible and a call written inside prose at some other indent invisible.
                        if (/^\s*(\*|\/\/|\/\*)/.test(text)) return;
                        if (!new RegExp('\\b' + name + '\\s*\\.\\s*\\w+\\s*\\(').test(text)) return;
                        const fns = functionsOf(src, relPath);
                        if (fns === null) {
                            unparsed.push(relPath);

                            return;
                        }
                        /**
                         * EVERY ENCLOSING FUNCTION, not only the innermost — measured, not assumed.
                         * `disease-ui.js:33` calls inside `setTimeout(function () { … })` while the
                         * `typeof DiseaseForecast` that protects it stands in the function around
                         * that one. Asking only the innermost called it unguarded, which is a false
                         * finding: the guard is on the path to the call. So each enclosing function
                         * is asked in turn, from its own start down to the call.
                         */
                        /**
                         * GH-726, THIRD PASS — THE WINDOW MINUS WHAT IT ONLY CONTAINS.
                         *
                         * The second pass said "every enclosing function" and then added the whole
                         * file above the call as one more window. In a wrapped module — an IIFE
                         * around the file, which is most of `assets` — the outermost enclosing
                         * function IS the wrapper, so the window became the file from its first
                         * line down to the call: WIDER than the 120 lines the narrowing replaced.
                         * A repair that made its own class worse, and the reviewer's mutation
                         * showed it by staying green before and after.
                         *
                         * So a window is an enclosing function's own text MINUS the text of the
                         * functions that merely sit inside it and are already finished before the
                         * call. A guard written in a sister function no longer counts; a guard in
                         * the body of an enclosing function still does, which is what keeps
                         * `disease-ui.js:33` — called inside `setTimeout(function () { … })` with
                         * the check in the function around it — correctly guarded.
                         *
                         * The whole file is a window ONLY for a call at the top level, where there
                         * is no enclosing function and the file IS the scope.
                         *
                         * THE BOUNDARY THAT REMAINS, written rather than left to be found: a check
                         * counts as a check by its TEXT. `if (typeof X === 'undefined')` that logs
                         * and does not return reads the same here as one that returns. This asks
                         * whether the call was thought about, not whether the thought stops it.
                         */
                        const holders = fns.filter((fn) => fn.from <= i + 1 && fn.to >= i + 1)
                            .sort((a, b) => (b.from - a.from));
                        const starts = holders.length ? holders.map((h) => h.from - 1) : [0];
                        // Lines belonging to a function that opened and closed before the call:
                        // inside the window by position, out of reach of the call by scope.
                        const finishedBefore = fns.filter((fn) => fn.to < i + 1
                            && !holders.some((h) => h.from === fn.from && h.to === fn.to));
                        const inNested = new Set();
                        finishedBefore.forEach((fn) => {
                            for (let ln = fn.from; ln <= fn.to; ln++) inNested.add(ln);
                        });
                        const guard = new RegExp('(if\\s*\\([^)]*\\b' + name + '\\b)'
                            + '|(\\b' + name + '\\s*&&)|(typeof\\s+[\\w.]*\\b' + name + '\\b)'
                            + '|(!\\s*(?:global|window|self)?\\.?' + name + '\\b)');
                        /**
                         * AND PROSE IS NOT A GUARD EITHER. Measured: delete the check and leave the
                         * words `typeof AmbientDLIEngine` behind in a comment, and the call read as
                         * guarded — the comment lines were dropped when LOOKING FOR THE CALL but not
                         * when looking for what protects it. Both sides are code now.
                         */
                        const code = (text2) => text2
                            .replace(/\/\*[\s\S]*?\*\//g, '')
                            .replace(/^\s*\/\/.*$/gm, '');
                        const windowText = (from) => lines.slice(from, i + 1)
                            .map((ln, k) => (inNested.has(from + k + 1) ? '' : ln)).join('\n');
                        const checked = starts.some((from) => guard.test(code(windowText(from))));
                        (checked ? guarded : unguarded).push(f.rel + ':' + (i + 1) + ' ' + name);
                    });
                });
            });
        });

        process.stdout.write('[gh726] handle files the narrowing dropped pairs for: '
            + JSON.stringify(handleFiles) + '\n'
            + '[gh726] the names they publish: ' + JSON.stringify(names) + '\n'
            + '[gh726] calls through those names — guarded ' + guarded.length
            + ', unguarded ' + unguarded.length
            + ' | files the parse could not read: ' + JSON.stringify(Array.from(new Set(unparsed))) + '\n'
            + guarded.map((g) => '[gh726]    guarded   ' + g).join('\n') + '\n');

        // Positive controls: the dropped edges exist at all, and calls were actually found.
        expect(handleFiles.length).toBeGreaterThan(0);
        expect(guarded.length + unguarded.length).toBeGreaterThan(0);
        expect({ callsThatCanReachADroppedHandleWithNoPresenceCheck: unguarded })
            .toEqual({ callsThatCanReachADroppedHandleWithNoPresenceCheck: [] });
    });

    test('GH-723: every divergence carries its own reason, a declared state and a ticket', () => {
        const DIVERGENCES = JSON.parse(fs.readFileSync(
            path.join(ROOT, 'tests', 'fixtures', 'gh680-page-divergences.json'), 'utf8'));
        const STATES = ['internal-accounting', 'candidate-not-established'];
        const entries = Object.entries(DIVERGENCES.entries);

        const noWhy = entries.filter(([, v]) => typeof v.why !== 'string' || !v.why.trim()).map(([k]) => k);
        const noTicket = entries.filter(([, v]) => typeof v.ticket !== 'string' || !v.ticket.trim()).map(([k]) => k);
        const badState = entries.filter(([, v]) => !STATES.includes(v.state)).map(([k, v]) => k + ' -> ' + v.state);
        const seen = new Map();
        entries.forEach(([k, v]) => {
            const key = String(v.why);
            seen.set(key, (seen.get(key) || []).concat(k));
        });
        const sharedWhy = [...seen.values()].filter((ks) => ks.length > 1).map((ks) => ks.join(' == '));

        process.stdout.write('[gh723] entries: ' + entries.length
            + ' | distinct reasons: ' + seen.size
            + ' | states seen: ' + JSON.stringify([...new Set(entries.map(([, v]) => v.state))])
            + ' | tickets seen: ' + JSON.stringify([...new Set(entries.map(([, v]) => v.ticket))]) + '\n');

        // A positive control first: an empty list of entries would satisfy every filter below.
        expect(entries.length).toBeGreaterThan(0);
        expect({
            entriesWithNoReasonOfTheirOwn: noWhy,
            entriesSharingOneReason: sharedWhy,
            entriesWithAnUndeclaredState: badState,
            entriesWithNoTicket: noTicket,
        }).toEqual({
            entriesWithNoReasonOfTheirOwn: [],
            entriesSharingOneReason: [],
            entriesWithAnUndeclaredState: [],
            entriesWithNoTicket: [],
        });
    });
});

/**
 * GH-690 (queue item 6, the reviewer's second return) — THE CENSUS PRINTS THE AREA IT COVERED AND
 * WHERE IT STOPPED.
 *
 * His finding: the census does not follow a call through a MEMBER OF A GLOBAL PROPERTY —
 * `window.GAIP_SoilStructure.analyze(state)` — so whatever that body reads is invisible to it, and
 * a green run said nothing about the difference between "walked it and found nothing" and "never
 * got there". A boundary nobody prints and a boundary that does not exist look the same.
 *
 * HIS DECISION, taken and not re-opened: the boundary is DECLARED here, and extending the walk to
 * members goes to item 3bj, because it needs an object's methods resolved rather than matched by a
 * regular expression.
 *
 * SO THIS CASE PRINTS TWO THINGS AND HOLDS ONE. It prints every body the census walked — name, file,
 * receiver, how many reads it found — and every place it stopped. It holds the stopping places in
 * BOTH directions against a list of names with reasons: a new one reddens, and an allowance that no
 * longer occurs reddens too, so the list cannot rot into a blanket.
 *
 * WHAT THE REASONS CLAIM, exactly: that the census cannot follow the call, which is the same reason
 * for all twenty-three. The GROUPING is a reading of the names, offered so the list can be scanned,
 * and it is not a measurement of those bodies — this census never entered them, which is the point.
 */
describe('GH-690 — the area the reads census covered, and its edge', () => {
    const ALLOWED_TO_STOP = {
        // A module whose entry point is a method on an object rather than a bare global.
        'AmbientDLIEngine.calculate': 'engine reached as an object method',
        'GAIP_SoilStructure.analyze': 'engine reached as an object method',
        'GilbaTissueEngine.compute': 'engine reached as an object method',
        'GAIP_StressTrajectory.project': 'engine reached as an object method',
        'GAIP_DiseaseStressCoupling.applyForecast': 'engine reached as an object method',
        'GilbaNutrientDemandEngine.estimateClippingYieldFromN': 'engine reached as an object method',
        'GilbaNutrientDemandEngine.getSpeciesTissueConcentrations': 'engine reached as an object method',
        'GAIP_CotulaBowling.calcCotulActivityFraction': 'engine reached as an object method',
        'GAIP_CotulaBowling.calcCotulaMonthlyN': 'engine reached as an object method',
        'GAIP_VarietyTraits.getShadeModifier': 'table lookup reached as an object method',
        'GaipOrchestrator.getAuthoritativeClimate': 'orchestrator reached as an object method',
        // Device adapters: what they answer comes from a sensor account, not from the site's inputs.
        'GAIP_Hydrosight.getIrrigationData': 'sensor adapter',
        'GAIP_Hydrosight.hasData': 'sensor adapter',
        'GAIP_Sensor.getIrrigationData': 'sensor adapter',
        'GAIP_Sensor.hasData': 'sensor adapter',
        'GAIP_SoilTempLogger.daysStored': 'sensor adapter',
        'GAIP_SoilTempLogger.getHistory': 'sensor adapter',
        // Which site and which species the page is about, rather than a value of the site.
        // GH-787 (queue item 3vy): the wear assembly folds the site's own `turf.species` to a canonical key
        // through this normaliser — the same one the canonical state uses — instead of taking the species off
        // the canonical state, which is assembled from five sources of the PAGE. It is a spelling of a value,
        // not a value: the value itself is read from the config and is declared by the node.
        'SpeciesController.normalize': 'canonical spelling of a species name, not a value of the site',
        'GAIP_SiteContext.getSiteId': 'page and site identity',
        'GAIP_SampleManager.getActiveSiteId': 'page and site identity',
        'TurfProfileController.getState': 'page and site identity',
        'SpeciesController.getBaseSpecies': 'page and site identity',
        'SpeciesController.getEffectiveSpecies': 'page and site identity',
        'GilbaIdentityEnforcement.canEngineRun': 'page and site identity',
    };

    const area = () => {
        const walked = [];
        const stopped = new Set();
        Object.values(GRAPH.nodes).forEach((n) => {
            (Array.isArray(n.handle) ? n.handle : (n.handle ? [n.handle] : [])).forEach((h) => {
                const r = readsOf(h);
                r.bodies.forEach((b) => walked.push(b));
                (r.stopped || []).forEach((x) => stopped.add(x));
            });
        });

        return { walked, stopped: [...stopped].sort() };
    };

    test('it says whose bodies it walked, and how many reads each one gave', () => {
        const { walked } = area();
        process.stdout.write('[gh690] bodies walked (' + walked.length + '):\n'
            + walked.map((b) => '[gh690]   ' + b.name + ' @ ' + b.file
                + '  receiver=' + b.receiver + '  reads=' + b.reads).join('\n') + '\n');

        // The area is real: a census that walked nothing would satisfy every claim about what it
        // did not find.
        expect(walked.length).toBeGreaterThan(20);
        // And the receiver was found for most of them, or the walk reached bodies without reading
        // them, which is the silent-zero this census was repaired for once already.
        expect(walked.filter((b) => b.receiver !== null && b.reads > 0).length).toBeGreaterThan(10);
    });

    test('every place it STOPPED is a declared one, and every declaration still occurs', () => {
        const { stopped } = area();
        process.stdout.write('[gh690] stopped at a member of a global property (' + stopped.length + '):\n'
            + stopped.map((x) => '[gh690]   ' + x + '  — ' + (ALLOWED_TO_STOP[x] || 'NOT DECLARED')).join('\n') + '\n');

        const undeclared = stopped.filter((x) => !Object.prototype.hasOwnProperty.call(ALLOWED_TO_STOP, x));
        const goneFromTheTree = Object.keys(ALLOWED_TO_STOP).filter((x) => stopped.indexOf(x) === -1);

        expect({ stoppedSomewhereUndeclared: undeclared, declaredButNoLongerThere: goneFromTheTree })
            .toEqual({ stoppedSomewhereUndeclared: [], declaredButNoLongerThere: [] });
    });
});
