/**
 * GH-722 (delivery 4, part 2) — THE READERS MOVED ONTO THE MAP TAKE THE SAME COLUMN THEY TOOK BEFORE,
 * FROM EVERY SAMPLE THE STAND HOLDS.
 *
 * Each place moved onto the lab reading names map used to read a reading by its own chain of
 * spellings. Those chains are recorded below AS THEY WERE IN THE CODE BEFORE THE MOVE — the removed
 * code, kept as a record, not as a second rule — with the way each chain decided "absent": `??` and
 * `!= null` take a key that is present, `||` takes a value that is truthy.
 *
 * Against them, every sample the stand holds, live and deleted, WITH ITS STORED VALUES
 * (`tests/fixtures/gh722-stand-sample-readings.json`, reading columns only) is read through the map
 * with the runner's `readingsOf`, and the value the map gives must be the value the old chain gave,
 * for every place, reading and sample. Real values and not synthetic ones, because where a sample
 * carries two spellings of one reading (`EC` and `EC1_5`) the order of the chain only matters if
 * the two values differ — and whether they do is a fact about the data, not about the code. Zero,
 * where `||` and the map part, is covered the same way: the stored zeros are in the rows.
 *
 * NOT MOVED, because the stored values say it would move a number: the second door of the soil
 * nutrition row reads EC for ECe as `EC || EC_1_5 || EC_dSm` and falls back to the page field; three
 * live samples of one site carry only `EC1_5`, so through the map their ECe would come from the
 * sample instead of the field. It stays listed in the direct-read census, held with the CEC readers.
 *
 * The server's resolution (`LabReadingNames::recognise`) is held to `readingsOf` by the recognition
 * contract; so a server place proved here through `readingsOf` is proved for the server too.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { loadManager } = require('./lib/sample-form-bench');

const ROOT = path.join(__dirname, '..');
const MAP = JSON.parse(fs.readFileSync(path.join(ROOT, 'assets', 'lab-reading-names.json'), 'utf8'));
const STAND = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'gh722-stand-sample-readings.json'), 'utf8'));

const TEN = ['K', 'P', 'Ca', 'Mg', 'S', 'Fe', 'Mn', 'Zn', 'Cu', 'B'];
const ZONE = ['K', 'P', 'Ca', 'Mg', 'S', 'Fe', 'Mn', 'Zn', 'Cu', 'B', 'Na'];
const exact = (keys) => keys.map((k) => [k, [k]]);

// place -> { kind, how: '??' | '||', chains: [[reading, [spelling, ...]], ...] }
const OLD = {
    'PageController::topbarData (tissue topbar)': { kind: 'tissue', how: '??', chains: exact(['N', 'P', 'K']) },
    'SampleAnalysisController::computeEce (EC for ECe)': { kind: 'soil', how: '??', chains: [['EC', ['EC', 'ec', 'EC1_5', 'EC_1_5', 'EC1:5', 'EC_1:5', 'EC_dSm']]] },
    'SampleAnalysisController::run (soilNa)': { kind: 'soil', how: '??', chains: [['Na', ['Na', 'Na_ppm']]] },
    'SampleAnalysisController::computeNutrients / validatePayload': { kind: 'soil', how: '??', chains: exact(TEN) },
    'hub-persistence.js zone table': { kind: 'soil', how: '??', chains: ZONE.map((n) => [n, [n + '_ppm', n]]) },
    'hub-persistence.js second door, soilNa': { kind: 'soil', how: '||', chains: [['Na', ['Na']]] },
    'nutrient-trend.js water EC, both charts': { kind: 'water', how: '||', chains: [['EC', ['EC', 'ECw', 'EC_dSm']]] },
    'nutrition-calendar.js Plan soil ppm': { kind: 'soil', how: '??', chains: exact(['P', 'K', 'Ca', 'Mg', 'S', 'Fe', 'Mn', 'Zn', 'Cu']) },
    'nutrition-calendar.js Plan tissue N/P/K': { kind: 'tissue', how: '??', chains: exact(['N', 'P', 'K']) },
    'nutrition-calendar.js active tissue N/P/K': { kind: 'tissue', how: '||', chains: exact(['N', 'P', 'K']) },
    // `src = activeSoil.normalized || activeSoil.rawData`: a sample in the store carries `normalized`,
    // so the old read was the normaliser's `OM`, modelled as such.
    'nutrition-calendar.js syncSoilFromDOM OM': { kind: 'soil', how: 'normalized', chains: [['OM', ['OM']]] },
};

function oldPick(row, how, spellings, sm, kind) {
    if (how === 'normalized') {
        const n = sm.normalizeValues(row, kind) || {};
        return n[spellings[0]] === undefined ? null : n[spellings[0]];
    }
    for (const s of spellings) {
        const v = row[s];
        if (how === '??' ? (v !== undefined && v !== null) : Boolean(v)) return typeof v === 'number' ? v : parseFloat(v);
    }

    return null;
}

describe('GH-722 — the readers moved onto the map take the same column from every stored sample', () => {
    const { sm } = loadManager(MAP);
    const stored = STAND.samples.map((x) => ({ name: 'sample ' + x.id + (x.live ? '' : ' (deleted)'), kind: x.kind, row: x.row }));

    test('every place, reading and stored row: the map picks what the old chain picked', () => {
        const differ = [];
        let compared = 0;
        Object.entries(OLD).forEach(([place, o]) => {
            stored.filter((c) => c.kind === o.kind).forEach((c) => {
                const now = sm.readingsOf(o.kind, { values: c.row }) || {};
                o.chains.forEach(([reading, spellings]) => {
                    compared += 1;
                    const was = oldPick(c.row, o.how, spellings, sm, o.kind);
                    const is = now[reading] === undefined ? null : now[reading];
                    if (was !== is) differ.push(place + ' ' + reading + ' on ' + c.name + ': was ' + was + ', map ' + is);
                });
            });
        });
        process.stdout.write('[gh722] stored rows ' + stored.length + ' (' + JSON.stringify(countBy(stored)) + '); comparisons ' + compared + '; differ ' + differ.length + '\n');
        differ.forEach((d) => process.stdout.write('[gh722]    ' + d + '\n'));
        expect(stored.length).toBeGreaterThan(100);
        expect(differ).toEqual([]);
    });

    test('the readings no form field takes (water SAR, TDS), read by name through the map, match too', () => {
        // GH-722, delivery 5: the lab SAR and TDS readers moved onto `labReadingOf`. Their old
        // chains, as they were; `SAR_ppm` is in the old chain and declared nowhere.
        const BY_NAME = {
            'hub-persistence.js water chosen on the page, TDS': ['TDS', ['TDS']],
            'hub-persistence.js water chosen on the page, SAR': ['SAR', ['SAR', 'sar']],
            'hub-persistence.js lab SAR fallback': ['SAR', ['SAR', 'sar', 'SAR_ppm']],
        };
        const water = stored.filter((c) => c.kind === 'water');
        const differ = [];
        Object.entries(BY_NAME).forEach(([place, [reading, chain]]) => water.forEach((c) => {
            const was = oldPick(c.row, '||', chain, sm, 'water');
            const is = sm.labReadingOf('water', { values: c.row }, reading);
            if ((was || null) !== (is || null)) differ.push(place + ' on ' + c.name + ': was ' + was + ', map ' + is);
        }));
        const carrying = water.filter((c) => Object.keys(c.row).some((k) => /^(sar|tds|sar_ppm)$/i.test(k))).length;
        process.stdout.write('[gh722] water rows ' + water.length + ', carrying SAR or TDS ' + carrying + '; differ ' + differ.length + '\n');
        expect(water.length).toBeGreaterThan(10);
        expect(differ).toEqual([]);
        // The accessor reads what it is asked for, so the comparison above can see a value.
        expect(sm.labReadingOf('water', { values: { sar: 4.2, Na: 30 } }, 'SAR')).toBe(4.2);
        expect(sm.readingsOf('water', { values: { SAR: 4.2, Na: 30 } })).toEqual({ Na: 30 });
    });

    test('positive control: a chain the map does not reproduce is caught', () => {
        // `CEC || cec` against the map's CEC, which also knows `CEC_meq100g`: the four stored
        // samples that carry only `CEC_meq100g` must show up as a difference, or the comparison
        // above is not looking.
        const soil = stored.filter((c) => c.kind === 'soil');
        const moved = soil.filter((c) => oldPick(c.row, '??', ['CEC', 'cec']) !== ((sm.readingsOf('soil', { values: c.row }) || {}).CEC ?? null));
        process.stdout.write('[gh722] control, CEC by its old chain differs on: ' + JSON.stringify(moved.map((c) => c.name)) + '\n');
        expect(moved.length).toBeGreaterThan(0);
    });
});

function countBy(list) {
    const o = {};
    list.forEach((x) => { o[x.kind] = (o[x.kind] || 0) + 1; });

    return o;
}
