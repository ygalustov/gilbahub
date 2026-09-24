/**
 * GH-656 (queue item 6, stage 0b, slice 1) — TEST (a) OF THE PLAN'S FOUR: EVERY
 * VALUE A CONSTRUCTION RESOLVES TO EXISTS AS A KEY IN THE TABLE OF THE CONSUMER
 * IT RESOLVES FOR.
 *
 * WHY THE TABLES ARE LOADED RATHER THAN TRANSCRIBED. This is the class the whole
 * night was about: `loi_0_20` against `LOI_0_2`, `sand_profile` against
 * `sand-profile`, `Na` against `soilNa`. Two spellings of the same thing, and the
 * miss is silent — the consumer finds nothing and substitutes. A test that holds
 * its own copy of the consumer's keys agrees with itself forever. So each table is
 * required out of the module that owns it, in this process, and a spelling that
 * drifts in either file reddens here.
 *
 * WHICH TABLES ARE REACHABLE, AND WHICH ARE NOT — stated rather than glossed:
 *   - thermalProfile      `PROFILE_THERMAL_PARAMS` (module.exports), plus the
 *                         `_`->`-` rewrite and the alias table the consumer applies;
 *   - irrigationSoilType  `IrrigationScheduler.config.soilTypes`;
 *   - structurePathway    `GAIP_SoilStructure.config.sandRootzones` — membership
 *                         decides the pathway, so the table is the list itself;
 *   - surfaceKey          NOT REACHABLE: the mapping is a literal inside
 *                         `extractSurfaceKey`, which is not exported. Named, not
 *                         skipped silently.
 *   - wearSandBased       NOT A TABLE: four values compared inline in a minified
 *                         engine. Measured by BEHAVIOUR below instead.
 *   - preEmergentTexture  NOT REACHABLE: a comparison inside the orchestrator,
 *                         which does not load on its own.
 *
 * WHAT A `null` MEANS AND WHY IT IS NOT EXEMPTED FROM ANYTHING. `null` says the
 * consumer's table does not carry the value — today it substitutes, and what it
 * should mean is an open owner decision. So a `null` is asserted to be ABSENT
 * from the consumer's table: if the table grows that key, the `null` is stale and
 * this reddens. A wrong `null` is as much a defect as a wrong name.
 */

'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const LIST = JSON.parse(fs.readFileSync(path.join(ROOT, 'assets', 'calculation-inputs.schema.json'), 'utf8'));
const ENTRY = LIST.inputs['turf.construction'];
const VALUES = ENTRY.values;

/** The consumers' own tables, out of their own modules. */
function consumerTables() {
    const out = {};

    // The engines are browser scripts: they assign onto a global and some of them
    // read a shared helper at load. `window` is made to be this process's global
    // and the helper is loaded first, the way the page loads it — otherwise the
    // module throws on require and the suite fails with "GAIP_Utils is not
    // defined", which is a red about the harness and not about the product.
    global.window = global.window || global;
    require(path.join(ROOT, 'assets', 'gaip-utils.js'));

    // The soil-temperature table, and the rewrite its consumer applies before
    // looking a construction up — `_` to `-`, then an alias if the key is absent.
    const soilTemp = require(path.join(ROOT, 'assets', 'gaip-soil-temp-integration.js'));
    out.thermalProfile = Object.keys(soilTemp.PROFILE_THERMAL_PARAMS || {});

    const irrigation = require(path.join(ROOT, 'assets', 'irrigation-scheduler.js'));
    out.irrigationSoilType = Object.keys((irrigation.config || {}).soilTypes || {});

    // The structure engine exports onto a global rather than module.exports.
    global.window = global.window || global;
    require(path.join(ROOT, 'assets', 'soil-structure-engine.js'));
    const structure = global.GAIP_SoilStructure || {};
    out.structurePathway = ((structure.config || {}).sandRootzones || []).length
        ? ['sand', 'clay']   // the pathway is one of two; membership of the list decides
        : [];
    out.sandRootzones = (structure.config || {}).sandRootzones || [];

    return out;
}

const TABLES = consumerTables();

/** What the soil-temperature consumer does to a construction before the lookup. */
const thermalLookup = (value) => {
    const aliases = {
        california: 'usga', 'sandy-loam': 'native', 'sand-capped': 'sand-carpet',
        imported: 'native', soil: 'soil-field',
    };
    const dashed = String(value).replace(/_/g, '-');
    if (TABLES.thermalProfile.includes(dashed)) return dashed;
    return aliases[dashed] || null;
};

describe('GH-656 — test (a): a construction resolves into a row its consumer actually has', () => {
    test('POSITIVE CONTROL: the tables were loaded and are the real ones', () => {
        process.stdout.write('\n[gh656] thermal profile keys (' + TABLES.thermalProfile.length + '): '
            + JSON.stringify(TABLES.thermalProfile) + '\n'
            + '[gh656] irrigation soil types (' + TABLES.irrigationSoilType.length + '): '
            + JSON.stringify(TABLES.irrigationSoilType) + '\n'
            + '[gh656] sand rootzones (' + TABLES.sandRootzones.length + '): '
            + JSON.stringify(TABLES.sandRootzones) + '\n');

        // A table that came back empty would make every claim below vacuously
        // true — which is how a test ends up green over nothing.
        expect(TABLES.thermalProfile.length).toBeGreaterThan(5);
        expect(TABLES.irrigationSoilType.length).toBeGreaterThan(5);
        expect(TABLES.sandRootzones.length).toBeGreaterThan(2);
        // and the values under test are the eleven the wizard offers
        expect(Object.keys(VALUES).length).toBe(11);
    });

    test('every named thermalProfile is a key the soil-temperature table has', () => {
        const wrong = [];
        Object.entries(VALUES).forEach(([value, v]) => {
            const named = v.resolves.thermalProfile;
            const reached = thermalLookup(value);
            if (named !== reached) wrong.push(value + ': the list says ' + JSON.stringify(named)
                + ', the consumer reaches ' + JSON.stringify(reached));
        });
        process.stdout.write('[gh656] thermalProfile disagreements: ' + JSON.stringify(wrong) + '\n');
        expect({ thermalProfileDisagreements: wrong }).toEqual({ thermalProfileDisagreements: [] });
    });

    test('every named irrigationSoilType is a key the irrigation table has, and every null is absent from it', () => {
        // The consumer's own dictionary, read where it is written: a construction
        // is looked up in `constructionMap` and the RESULT is a key of
        // `soilTypes`. Only the second half is a table; the first is a literal in
        // two files (the scheduler and the orchestrator), and the equality of
        // those two copies is the plan's test (c), not this one.
        const wrong = [];
        Object.entries(VALUES).forEach(([value, v]) => {
            const named = v.resolves.irrigationSoilType;
            const present = named !== null && TABLES.irrigationSoilType.includes(named);
            if (named === null) {
                // A `null` claims the construction has no row. If the table ever
                // grows one under this construction's own name, the claim is stale.
                if (TABLES.irrigationSoilType.includes(value)) {
                    wrong.push(value + ': declared null, but the irrigation table now has it');
                }
                return;
            }
            if (!present) wrong.push(value + ' -> ' + JSON.stringify(named) + ' is not a row of soilTypes');
        });
        process.stdout.write('[gh656] irrigationSoilType disagreements: ' + JSON.stringify(wrong) + '\n');
        expect({ irrigationSoilTypeDisagreements: wrong }).toEqual({ irrigationSoilTypeDisagreements: [] });
    });

    test('every structurePathway agrees with the engine’s own sand list', () => {
        const wrong = [];
        Object.entries(VALUES).forEach(([value, v]) => {
            const named = v.resolves.structurePathway;
            const isSand = TABLES.sandRootzones.includes(value);
            const reached = isSand ? 'sand' : 'clay';
            if (named !== reached) wrong.push(value + ': the list says ' + named + ', the engine takes ' + reached);
        });
        process.stdout.write('[gh656] structurePathway disagreements: ' + JSON.stringify(wrong) + '\n');
        expect({ structurePathwayDisagreements: wrong }).toEqual({ structurePathwayDisagreements: [] });
    });

    test('wearSandBased is measured by BEHAVIOUR, because the engine has no table to read', () => {
        // The four values are compared inline inside a minified body, so there is
        // nothing to require. What there is, is an exported function whose answer
        // changes with the construction: the organic-matter modifier takes one
        // branch for a sand-based rootzone and another for everything else.
        global.window = global.window || global;
        require(path.join(ROOT, 'assets', 'wear-recovery-engine-pure.js'));
        // The ENGINE's own entry, not the inner function: `monthIndex` reaches
        // the seasonal lookup through the entry, which is also how the run calls
        // it. Calling the inner function directly threw "monthIndex is required",
        // and that refusal is correct — a season it guessed would be a
        // substitution. So the measurement is made the way the product makes it.
        const recovery = global.gaip_wear_recovery_engine;
        expect(typeof recovery).toBe('function');

        const capacityFor = (construction) => {
            const state = {
                // `monthIndex` is required by the engine and it refuses without
                // one, which is right: a season it had to guess would be a
                // substitution. It is held the same for every construction, so
                // the only thing differing between the calls below is the value
                // under measurement.
                monthIndex: 6,
                turf: { grassSpecies: 'browntopBent', construction, rootDepth: 100 },
                soil: { LOI: 3 },
                site: { soilMoisture: 'optimal' },
            };
            const out = recovery(state, null, null, null);
            // ONLY THE DISCRIMINATING FIGURES. The first version printed the whole
            // assessment for each of eleven constructions, and a finding nobody can
            // read is a finding nobody was shown. What the construction moves is
            // the organic-matter branch of the recovery, and these two carry it.
            const rc = (out && out.recoveryCapacity) || {};
            return JSON.stringify({
                days: rc.days,
                soilHealth: rc.modifiers && rc.modifiers.soilHealth,
                // The engine's own report of which construction it used, which is
                // worth seeing beside the answer.
                engineSaysConstruction: (out && out.inputs && out.inputs.construction) || null,
            });
        };

        const measured = {};
        Object.keys(VALUES).forEach((value) => { measured[value] = capacityFor(value); });
        const carpet = capacityFor('sand_carpet');
        const native = capacityFor('native');
        process.stdout.write('[gh656] wear recovery capacity per construction: ' + JSON.stringify(measured) + '\n'
            + '[gh656] sand_carpet=' + JSON.stringify(carpet) + ' native=' + JSON.stringify(native) + '\n');

        // POSITIVE CONTROL: the construction changes the answer at all. If these
        // two agreed, the comparison below would prove nothing about any value.
        expect(carpet).not.toEqual(native);

        // And then the claim: a construction the list calls sand-based answers
        // like `sand_carpet`; one it does not answers like `native`.
        const wrong = [];
        Object.entries(VALUES).forEach(([value, v]) => {
            const expected = v.resolves.wearSandBased ? carpet : native;
            if (measured[value] !== expected) {
                wrong.push(value + ': declared sandBased=' + v.resolves.wearSandBased
                    + ' but its capacity is ' + JSON.stringify(measured[value]));
            }
        });
        expect({ wearSandBasedDisagreements: wrong }).toEqual({ wearSandBasedDisagreements: [] });
    });

    test('FOUND IN THE WORK: the wear engine reads the construction TWICE, from two places, with two different stand-ins', () => {
        // The census this slice was built from counts wear as ONE reader whose
        // stand-in is `native`. Measured, there are two reads inside the one
        // engine: the organic-matter branch takes `turf.construction || "native"`,
        // and the compaction capacity plus the engine's own report of its inputs
        // take `site.construction || "soil"`. So the same engine can be told
        // `sand_profile` and compute one half of its answer as `sand_profile` and
        // the other as `soil`.
        //
        // This is measured rather than read: the two states below differ in NOTHING
        // but which of the two fields carries the value.
        global.window = global.window || global;
        require(path.join(ROOT, 'assets', 'wear-recovery-engine-pure.js'));
        const recovery = global.gaip_wear_recovery_engine;

        const call = (where) => {
            const state = {
                monthIndex: 6,
                turf: Object.assign({ grassSpecies: 'browntopBent', rootDepth: 100 },
                    where === 'turf' || where === 'both' ? { construction: 'sand_carpet' } : {}),
                soil: { LOI: 3 },
                site: Object.assign({ soilMoisture: 'optimal' },
                    where === 'site' || where === 'both' ? { construction: 'sand_carpet' } : {}),
            };
            const out = recovery(state, null, null, null);
            return {
                recoveryDays: out.recoveryCapacity && out.recoveryCapacity.days,
                capacityUsed: out.compactionRisk && out.compactionRisk.capacityData
                    && out.compactionRisk.capacityData.construction,
                maxHours: out.compactionRisk && out.compactionRisk.maxHours,
                reported: out.inputs && out.inputs.construction,
            };
        };

        const onTurf = call('turf');
        const onSite = call('site');
        const onBoth = call('both');
        const onNeither = call('none');
        process.stdout.write('[gh656] the same construction, put in one field or the other:\n'
            + '   turf.construction only: ' + JSON.stringify(onTurf) + '\n'
            + '   site.construction only: ' + JSON.stringify(onSite) + '\n'
            + '   both:                   ' + JSON.stringify(onBoth) + '\n'
            + '   neither:                ' + JSON.stringify(onNeither) + '\n');

        // POSITIVE CONTROL: the value reaches something in each case, or the
        // comparison below would be between two absences.
        expect(typeof onTurf.recoveryDays).toBe('number');
        expect(typeof onSite.recoveryDays).toBe('number');

        // THE FINDING: the recovery side follows `turf`, the capacity side follows
        // `site`, and neither follows the other.
        expect(onTurf.recoveryDays).not.toEqual(onSite.recoveryDays);
        expect(onTurf.capacityUsed).toBe('soil');       // the stand-in, not what it was told
        expect(onSite.capacityUsed).toBe('sand_carpet');
        expect(onNeither.capacityUsed).toBe('soil');
    });

    test('the two consumers this test cannot reach are named, and the entry says so too', () => {
        // The boundary is printed rather than left to be discovered: `surfaceKey`
        // and `preEmergentTexture` are asserted by nothing here, and a reader of a
        // green run has to be able to see that.
        process.stdout.write('[gh656] NOT checked against a table: surfaceKey (literal inside '
            + 'extractSurfaceKey, not exported), preEmergentTexture (comparison inside '
            + 'hub-orchestrator, does not load standalone)\n');
        const comment = (ENTRY.$comment || []).join(' ');
        expect(comment).toMatch(/wearSandBased/);
        expect(comment).toMatch(/preEmergentTexture/);
        // Every value still declares all six, so a consumer cannot go missing.
        const six = ['surfaceKey', 'thermalProfile', 'irrigationSoilType',
            'structurePathway', 'wearSandBased', 'preEmergentTexture'];
        Object.entries(VALUES).forEach(([value, v]) => {
            expect([value, Object.keys(v.resolves).sort()]).toEqual([value, [...six].sort()]);
        });
    });

    test('the open decision travels as a decision, not as a guess', () => {
        expect(ENTRY.offeredFor).toBeNull();
        expect(typeof ENTRY.offeredForDecision).toBe('string');
        expect(ENTRY.offeredForDecision).toMatch(/owner/);
        // and no value quietly carries its own offer list instead
        Object.entries(VALUES).forEach(([value, v]) => {
            expect([value, 'offeredFor' in v]).toEqual([value, false]);
        });
    });
});
