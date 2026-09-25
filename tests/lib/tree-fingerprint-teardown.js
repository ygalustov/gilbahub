'use strict';

/**
 * GH-716 — the last line of a run, and the exit code that goes with it.
 *
 * Jest prints `Tests: N passed` before this hook, so a verdict printed here is the LAST line a
 * reader sees; and a run whose tree moved must not leave a zero exit code behind it.
 */
const tree = require('./tree-fingerprint');

module.exports = async () => {
    const start = globalThis.__GH716_TREE_AT_START__
        || (process.env.GH716_TREE_START ? JSON.parse(process.env.GH716_TREE_START) : null);
    const end = tree.fingerprint();
    process.stdout.write(tree.line('end', end) + '\n');
    if (!start) {
        process.stdout.write('[tree] NO START READING — this run cannot say which tree it saw\n');
        process.exitCode = 1;

        return;
    }
    const said = tree.verdict(start, end);
    if (said) {
        process.stdout.write(said + '\n');
        process.exitCode = 1;
    }
};
