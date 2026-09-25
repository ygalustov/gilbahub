/**
 * GH-722 — THE RUNNER READS EACH ROW OF THE RECOGNITION CONTRACT AS RECORDED.
 *
 * Two implementations decide what a sample row carries: the runner's resolver in
 * `sample-manager.js` (what the calculation reads) and `App\Support\LabReadingNames::recognise`
 * on the server (what an upload or import accepts). Both are held to one recorded contract,
 * `app/tests/fixtures/gh722-recognition-contract.json` — this file for the runner,
 * `Gh722LabReadingNamesTest` for the server — so they cannot drift apart without one of the two
 * reddening, and neither is compared with itself.
 *
 * It also answers for the real site files: every sample in the six files under `files/` must carry
 * at least one reading the runner reads, or a real import would be refused. Printed per file.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { loadManager } = require('./lib/sample-form-bench');

const ROOT = path.join(__dirname, '..');
const MAP = JSON.parse(fs.readFileSync(path.join(ROOT, 'assets', 'lab-reading-names.json'), 'utf8'));
const CONTRACT = JSON.parse(fs.readFileSync(path.join(ROOT, 'app', 'tests', 'fixtures', 'gh722-recognition-contract.json'), 'utf8'));

describe('GH-722 — one recognition contract for the runner and the server', () => {
    const { sm } = loadManager(MAP);

    test('the runner reads every contract row as recorded', () => {
        const differ = CONTRACT.cases.filter((c) => JSON.stringify(sm.readingsOf(c.kind, { values: c.row })) !== JSON.stringify(c.readings))
            .map((c) => c.name + ' was ' + JSON.stringify(c.readings) + ' now ' + JSON.stringify(sm.readingsOf(c.kind, { values: c.row })));
        process.stdout.write('[gh722] contract rows: ' + CONTRACT.cases.length + '; differ ' + differ.length + '\n');
        expect(CONTRACT.cases.length).toBeGreaterThan(300);
        expect(differ).toEqual([]);
    });

    test('every sample in the real site files carries a reading the runner reads', () => {
        const dir = path.join(ROOT, 'files');
        const files = fs.readdirSync(dir).filter((f) => /_gilba_.*\.json$/.test(f)).sort();
        const unread = [];
        const counts = {};
        files.forEach((f) => {
            const all = (JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')).samples || {}).allSites || {};
            counts[f] = 0;
            Object.keys(all).forEach((sid) => ['soil', 'water', 'tissue'].forEach((t) => Object.keys(all[sid][t] || {}).forEach((k) => {
                counts[f] += 1;
                const r = sm.readingsOf(t, { values: (all[sid][t][k] || {}).rawData || {} }) || {};
                if (!Object.keys(r).length) unread.push(f + ' ' + t + ' ' + k);
            })));
        });
        process.stdout.write('[gh722] real site files, samples per file: ' + JSON.stringify(counts) + '\n');
        expect(files.length).toBeGreaterThan(0);
        expect(unread).toEqual([]);
    });
});
