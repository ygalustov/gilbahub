'use strict';

/**
 * THE PRODUCT'S OWN CHOOSER OF A SAMPLE, for benches that execute only the row producer.
 *
 * GH-778. The server decides which sample a run computes on and names it on the frame's address; in the
 * frame one function reads that answer — `gaip_sampleInHand` — and the four places of the write path ask it
 * instead of asking the manager for whatever the page has selected. Those places live in
 * `hub-persistence.js`, and the chooser lives in `hub-tissue-v3.js`, so a bench that runs the producer alone
 * has no chooser at all and every one of them answers `null`.
 *
 * The functions are LIFTED FROM THE PRODUCT rather than stubbed: a bench's own idea of "which sample" is
 * exactly the second rule this repair removes.
 */

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const HUB = path.join(__dirname, '..', '..', 'assets', 'hub-tissue-v3.js');

/** One function of `hub-tissue-v3.js`, by name, with its braces balanced. */
function sourceOf(name) {
    const src = fs.readFileSync(HUB, 'utf8');
    const at = src.indexOf('function ' + name + '(');
    if (at < 0) throw new Error('hub-tissue-v3.js no longer declares ' + name);
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
 * Put the chooser into a prepared context.
 *
 * @param {object} ctx  a vm context that already carries `window`/`location` and `GAIP_SampleManager`
 */
function giveItTheChooser(ctx) {
    const names = ['gaip_namedSample', 'gaip_sampleInHand'];
    if (vm.isContext(ctx)) {
        names.forEach((name) => vm.runInContext(sourceOf(name), ctx, { filename: name }));

        return ctx;
    }
    /**
     * A bench that runs the producer in THIS realm rather than in a `vm` context — the runner's own bench
     * does that, because the producer is `require`d. The same product source is evaluated once and the
     * functions are put where the producer looks for them: `global` and `window`, which that bench aliases.
     */
    names.forEach((name) => {
        const made = new Function(sourceOf(name) + '\nreturn ' + name + ';')();
        ctx[name] = made;
        if (typeof global !== 'undefined') global[name] = made;
        if (typeof global !== 'undefined' && global.window) global.window[name] = made;
    });

    return ctx;
}

module.exports = { giveItTheChooser, sourceOf };
