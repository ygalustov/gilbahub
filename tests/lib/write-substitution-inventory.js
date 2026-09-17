/**
 * Writes tests/fixtures/substitution-inventory.json — the recorded list of
 * plausible substitutions for an empty site fact (GH-477, fifteenth
 * refinement, point 3).
 *
 * Run it only to record a list that has SHRUNK: the ratchet in
 * tests/gh477-substitution-for-emptiness.test.js allows removals and refuses
 * additions, and regenerating the file after adding one would be the guard
 * answering to itself.
 *
 *   node tests/lib/write-substitution-inventory.js
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { inventory, watchedFields } = require('./substitution-inventory');

const root = path.join(__dirname, '..', '..');
const fields = watchedFields(fs.readFileSync(path.join(root, 'assets', 'nutrition-program-inputs.js'), 'utf8'));
const found = inventory(path.join(root, 'assets'), fields);

const out = {
    _why: 'Every place where an empty site fact is replaced by a plausible value that is then printed or saved. '
        + 'Recorded, not approved: what a page should say instead of a missing name, species or variety is the owner\'s '
        + 'question (10.8(7), 10.8(10), 10.8(12)). Until she answers, this list may only shrink.',
    _generatedBy: 'node tests/lib/write-substitution-inventory.js',
    _fields: fields,
    _count: found.length,
    substitutions: found.map((f) => f.signature)
};
fs.writeFileSync(path.join(root, 'tests', 'fixtures', 'substitution-inventory.json'),
    JSON.stringify(out, null, 2) + '\n');
process.stdout.write('recorded ' + found.length + ' substitutions\n');
