'use strict';

/**
 * GH-779 — THE IRRIGATION EFFICIENCY OF A RUN IS THE SITE'S OWN SETTING, AND WITHOUT ONE THERE ARE NO
 * MINUTES.
 *
 * WHAT WAS WRONG, measured by the analyst and confirmed by the source: Settings writes
 * `config.irrigation.efficiency` as a percentage, and the run read a field of the old hub's form instead —
 * `.gaip-irr-efficiency`, whose markup carries `value="75"` and which nothing fills from the config. So the
 * figure that reached the calculation was always 75 %, whatever a site had entered: not a stale value but a
 * literal in a form nobody sees. Below that, the scheduler had a default of its own in four places, so a
 * site with no value received minutes as confident as a site with one.
 *
 * WHAT IS ASSERTED: the value comes from the config, the form is not consulted at all, and an absent value
 * produces no runtime rather than minutes computed on a figure nobody chose.
 *
 * WHAT DOES NOT CHANGE, and it is the reason this is safe to do at once: of the twenty-one live sites on the
 * stand three carry a value and all three carry exactly 75, so no number already computed from a site's own
 * setting moves. What goes are the minutes of the sites that never had a value.
 */

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const HUB = fs.readFileSync(path.join(ROOT, 'assets', 'hub-tissue-v3.js'), 'utf8');

/** One function of the product, by name, with its braces balanced. */
function sourceOf(src, name) {
    const at = src.indexOf('function ' + name + '(');
    expect(at).toBeGreaterThan(-1);
    let depth = 0;
    for (let i = src.indexOf('{', at); i < src.length; i += 1) {
        if (src[i] === '{') depth += 1;
        else if (src[i] === '}') {
            depth -= 1;
            if (!depth) return src.slice(at, i + 1);
        }
    }
    throw new Error(name + ' never closes');
}

/**
 * The irrigation block of the run's state, built out of the product's own expression.
 *
 * `gaip_build_state` is two thousand lines of DOM reading, so what is lifted here is the ONE expression that
 * computes the efficiency — cut out of the file by its anchor, not retyped — together with the page field
 * that used to supply it. A bench that retyped the expression would agree with itself.
 */
function efficiencyOf({ config, fieldValue }) {
    const anchor = 'efficiency: (function () {';
    const at = HUB.indexOf(anchor);
    expect(at).toBeGreaterThan(-1);
    const end = HUB.indexOf('})(),', at);
    expect(end).toBeGreaterThan(at);
    const expression = HUB.slice(at + 'efficiency: '.length, end + '})('.length + 1);

    const sandbox = {
        parseFloat, isNaN, JSON, Object, Math, Number, String,
        console: { warn() {}, log() {} },
    };
    sandbox.window = sandbox;
    sandbox.global = sandbox;
    sandbox.GAIP_HUB_CONFIG = { gaipConfig: config };
    // The form of `/hub`, with its hardcoded 75 still in it: nothing may read this any more.
    sandbox.e = {
        querySelector: (sel) => (sel === '.gaip-irr-efficiency' && fieldValue !== undefined
            ? { value: fieldValue } : null),
    };
    vm.createContext(sandbox);
    vm.runInContext(sourceOf(HUB, 'safeNum'), sandbox, { filename: 'safeNum' });

    return vm.runInContext('(' + expression + ')', sandbox, { filename: 'the efficiency expression' });
}

/** The scheduler, loaded the way its own guards load it. */
function scheduler() {
    const box = { module: { exports: {} }, console: { log() {}, warn() {}, error() {} }, Math, Date, JSON,
        Object, Array, String, Number, parseFloat, parseInt, isNaN, isFinite };
    box.window = box;
    box.global = box;
    box.globalThis = box;
    vm.createContext(box);
    ['gaip-utils.js', 'irrigation-scheduler.js'].forEach((f) => {
        vm.runInContext(fs.readFileSync(path.join(ROOT, 'assets', f), 'utf8'), box, { filename: f });
    });

    return box.GAIP_IrrigationScheduler;
}

describe('GH-779 — the efficiency of a run comes from the site, not from a form', () => {
    test('POSITIVE CONTROL: the expression under test is the product’s, and it answers at all', () => {
        const eighty5 = efficiencyOf({ config: { irrigation: { efficiency: 85 } } });
        process.stdout.write('\n[gh779] config 85 -> ' + JSON.stringify(eighty5) + '\n');

        expect(eighty5).toBe(0.85);
    });

    test('the site’s own value wins, and the form’s hardcoded 75 is not consulted', () => {
        // The exact shape of the defect: the config says 85 and the form still says 75.
        const both = efficiencyOf({ config: { irrigation: { efficiency: 85 } }, fieldValue: '75' });
        process.stdout.write('[gh779] config 85 with the form still at 75 -> ' + JSON.stringify(both) + '\n');

        expect(both).toBe(0.85);
    });

    test('no value in the config is NO VALUE — not 75, and not a percentage of anything', () => {
        const none = efficiencyOf({ config: { irrigation: {} }, fieldValue: '75' });
        const noBlock = efficiencyOf({ config: {} , fieldValue: '75' });
        const noConfig = efficiencyOf({ config: null, fieldValue: '75' });
        process.stdout.write('[gh779] no value / no block / no config -> '
            + JSON.stringify([none, noBlock, noConfig]) + '\n');

        expect(none).toBeNull();
        expect(noBlock).toBeNull();
        expect(noConfig).toBeNull();
    });

    test('THE SCHEDULER has no efficiency of its own: without one there is no runtime and no gross depth', () => {
        const S = scheduler();
        expect(typeof S.calculateRuntime).toBe('function');
        const withValue = S.calculateRuntime(10, { precipRate: 12, uniformity: 0.8, efficiency: 0.85 });
        const without = S.calculateRuntime(10, { precipRate: 12, uniformity: 0.8, efficiency: null });
        process.stdout.write('[gh779] runtime with 0.85 -> ' + JSON.stringify(withValue)
            + '\n[gh779] runtime with no efficiency -> ' + JSON.stringify(without) + '\n');

        // With a value the arithmetic is the declared one: gross = depth / (uniformity × efficiency).
        expect(withValue.totalRuntime).toBe(Math.round((10 / (0.8 * 0.85) / 12) * 60));
        // Without one, nothing is reported rather than minutes computed on 0.75.
        expect(without.totalRuntime).toBeNull();
        expect(without.grossDepth).toBeNull();
    });

    test('and the file itself keeps no substitute for it — the list, not the count', () => {
        /**
         * Four places had `|| CONFIG.sprinklerDefaults.efficiency` or `|| 0.75`, and the declared default
         * itself is gone with them: an unread default is the next literal 75 waiting for a caller. Held over
         * the source so that a fifth one added later reddens the day it is written.
         */
        const src = fs.readFileSync(path.join(ROOT, 'assets', 'irrigation-scheduler.js'), 'utf8')
            .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
            .split('\n').map((l) => l.replace(/(^|[^:])\/\/.*$/, '$1')).join('\n');
        const substitutes = [];
        src.split('\n').forEach((line, i) => {
            // A SUBSTITUTION, not a check: `|| <a number or a default>` beside the efficiency. The first form
            // matched `if (efficiency === null || …)` — the guard that REPLACED the substitution — so the
            // case reported the repair itself as the fault it was written to find.
            const mentionsIt = /efficiency/.test(line);
            const substitutes = /\|\|\s*(CONFIG\.sprinklerDefaults|0\.\d+)/.test(line)
                || /efficiency:\s*0\.\d+/.test(line);
            if (mentionsIt && substitutes) {
                substitutes.push((i + 1) + ': ' + line.trim().slice(0, 90));
            }
        });
        const inTheHub = fs.readFileSync(path.join(ROOT, 'assets', 'hub-tissue-v3.js'), 'utf8')
            .split('\n').filter((l) => /gaip-irr-efficiency/.test(l) && !/^\s*(\*|\/\/)/.test(l));
        process.stdout.write('[gh779] substitutes left in the scheduler: ' + JSON.stringify(substitutes)
            + '\n[gh779] reads of the form field left in the run: ' + JSON.stringify(inTheHub) + '\n');

        expect({ substitutesForTheEfficiency: substitutes }).toEqual({ substitutesForTheEfficiency: [] });
        expect({ readsOfTheHubsOwnField: inTheHub }).toEqual({ readsOfTheHubsOwnField: [] });
    });

    test('the list says where a person enters it, and that is where the field is', () => {
        // The entry promised `settings.turf`; the field is in the irrigation block of Site settings, and a
        // sentence with a wrong address is worse than none — which is why its message was switched off.
        const list = JSON.parse(fs.readFileSync(path.join(ROOT, 'assets', 'calculation-inputs.schema.json'), 'utf8'));
        const entry = list.inputs['schedule.efficiency'];
        process.stdout.write('[gh779] the list says: ' + JSON.stringify({
            filledIn: entry.filledIn, storedAs: entry.storedAs, explainToClient: entry.explainToClient }) + '\n');

        expect(entry.filledIn).toEqual(['settings.irrigation']);
        expect(list.places['settings.irrigation']).toBeTruthy();
        expect(entry.storedAs).toEqual(['irrigation.efficiency']);
    });
});
