'use strict';

/** GH-716 — printed before the first case, and remembered for the teardown. */
const tree = require('./tree-fingerprint');

module.exports = async () => {
    const fp = tree.fingerprint();
    process.stdout.write('\n' + tree.line('start', fp) + '\n');
    // Read back by the teardown in the SAME process; workers never need it.
    globalThis.__GH716_TREE_AT_START__ = fp;
    process.env.GH716_TREE_START = JSON.stringify(fp);
};
