/**
 * GH-477 (PLAN-GH439 section 10.6, fifteenth refinement, point 2) — a store
 * the sandbox is asked to choose from by key holds at least two records, and
 * they differ everywhere.
 *
 * What this answers, measured: the sandbox's config store held one record.
 * With one record "the config for this site" and "the first config there is"
 * are the same object, so the mutation `getConfig(id)` -> `first config`
 * changes nothing a test can see — the whole set stayed green under it. The
 * site rows and the samples had already been given a second record by hand,
 * one at a time, as each defect made it necessary; the config store was the
 * one nobody got to. A rule fixed by hand three times is not a rule, so it is
 * one here: every site-keyed store is declared in the sandbox, and this file
 * refuses any of them with fewer than two records, or with two records that
 * agree anywhere.
 *
 * "Differ everywhere" is what makes the second record work. A decoy that
 * shares a field with the real record cannot show a read that took it: the
 * wrong record answers the right value at that field, and the document looks
 * correct. The one exception is a field the live recorder only ever saw as
 * null — there is no second value to give it that the store has ever held.
 */

'use strict';

const { loadPage, SITE_ID, OTHER_SITE_ID, keyedStores } = require('./helpers/export-page-sandbox');

/**
 * The two records compared field by field, down to the leaves, returning the
 * paths where they AGREE.
 *
 * The pair is walked together rather than flattened apart, because a decoy's
 * filler for an object-typed field is a non-empty object where the real
 * record's is `{}`: flattened separately the two produce different path sets
 * and the comparison has nothing to line up. Walked together, that field is
 * one leaf on both sides and it differs, which is what it is there to do.
 */
function agreements(a, b, prefix, out) {
    out = out || [];
    prefix = prefix || '';
    const plain = (v) => v && typeof v === 'object' && Object.keys(v).length > 0;
    if (plain(a) && plain(b)) {
        const ka = Object.keys(a).sort();
        const kb = Object.keys(b).sort();
        if (JSON.stringify(ka) === JSON.stringify(kb)) {
            ka.forEach((k) => agreements(a[k], b[k], prefix ? prefix + '.' + k : k, out));
            return out;
        }
    }
    if (JSON.stringify(a === undefined ? null : a) === JSON.stringify(b === undefined ? null : b)) {
        out.push({ path: prefix, value: JSON.stringify(a === undefined ? null : a) });
    }
    return out;
}

describe('GH-477 — no sandbox store answers by key from a single record', () => {
    let stores;

    beforeAll(() => {
        const page = loadPage({ errors: [], warnings: [], alerts: [] });
        expect(page.failures).toEqual([]);
        stores = keyedStores();
    });

    test('the keyed stores are the five the sandbox declares', () => {
        // Named, so that a sixth store cannot quietly be added as a
        // single-record one: adding it means adding it here.
        expect(stores.map((s) => s.name)).toEqual([
            'GAIP_SiteConfig.getConfig(id)',
            'GAIP_SiteConfig.getSite(id)',
            'GAIP_SampleManager.getSiteList()',
            'GAIP_SampleManager.getAllSamples().allSites',
            // GH-478: keyed by a pair of coordinates rather than by a site id,
            // which is why every store names its own two keys below.
            'GilbaClimateNormalsService.getResolvedSync(lat, lon)'
        ]);
    });

    test('each of them holds at least two records', () => {
        expect.hasAssertions();
        stores.forEach((store) => {
            expect([store.name, store.keys.length >= 2]).toEqual([store.name, true]);
        });
    });

    test('the record under the fixture\'s key is NOT the first one', () => {
        // The point of the second record. Where the decoy stands first, a read
        // that walks the store instead of asking for a key lands on it.
        expect.hasAssertions();
        stores.forEach((store) => {
            expect([store.name, store.keys[0]]).toEqual([store.name, store.decoyKey]);
            expect(store.keys).toContain(store.fixtureKey);
        });
    });

    test('each key answers with its own record, and the two records share no field', () => {
        expect.hasAssertions();
        stores.forEach((store) => {
            const mine = store.byKey(store.fixtureKey);
            const other = store.byKey(store.decoyKey);
            expect([store.name, mine == null, other == null]).toEqual([store.name, false, false]);
            expect(mine).not.toBe(other);

            // A record that names its key must name the one it was asked for.
            if (store.recordKey) {
                expect([store.name, store.recordKey(mine)]).toEqual([store.name, store.fixtureKey]);
                expect([store.name, store.recordKey(other)]).toEqual([store.name, store.decoyKey]);
            }

            // The decoy is marked in every field it was not given a value for,
            // so a record answered out of it is recognisable on sight. The
            // fixture's record carries none of those marks.
            expect([store.name, JSON.stringify(mine).indexOf('decoy')]).toEqual([store.name, -1]);
            expect([store.name, JSON.stringify(other).indexOf('decoy') > -1]).toEqual([store.name, true]);

            // Both records come out of one recorded shape, so their own key
            // sets match; below that the walk compares them together.
            expect([store.name, Object.keys(mine).sort()]).toEqual([store.name, Object.keys(other).sort()]);

            // Every leaf differs, except those the live store only holds as
            // null. The agreeing ones are listed by name when this fails, so
            // the report says which field a decoy is failing to decoy.
            const shared = agreements(mine, other).filter((f) => f.value !== 'null').map((f) => f.path);
            expect([store.name, shared]).toEqual([store.name, []]);
        });
    });

    test('a record the live recorder saw as null is null in both, and is the only agreement allowed', () => {
        const config = keyedStores()[0];
        const agreed = agreements(config.byKey(config.fixtureKey), config.byKey(config.decoyKey));
        expect(agreed.length).toBeGreaterThan(0);
        agreed.forEach((f) => expect([f.path, f.value]).toEqual([f.path, 'null']));
    });
});

/**
 * The second half of the rule: the assertion about a CHOICE names the value it
 * expects, and names the rival it must not get.
 *
 * Measured, which is why it is worth writing: with the one-record config store
 * the mutation "take the first config instead of the config for this id"
 * reddened three tests, all of them about a site id that does not exist — the
 * mutation's fallback, not its choice. Nothing said the species in the document
 * was the wrong site's, because there was no other site to be wrong about. With
 * the decoy in place the same mutation reddens the choice itself, here and in
 * five more places.
 *
 * The site-list store has no reader on the export page — nothing loaded here
 * calls getSiteList() — so its choice is held only by the structural test
 * above.
 */
describe('GH-477 — the resolver answers from the site it was asked for, not from the first record', () => {
    let resolved;

    beforeAll(() => {
        const page = loadPage({ errors: [], warnings: [], alerts: [] });
        expect(page.failures).toEqual([]);
        resolved = page.sandbox.GAIP_NutritionProgramInputs.resolveExportInputs({ siteId: SITE_ID });
    });

    test('the site facts are the fixture site\'s, not the decoy row\'s', () => {
        expect(resolved.site.location.name).toBe('Auckland');
        expect(resolved.site.location.lat).toBe(-36.8508827);
        expect(resolved.site.timezone).toBe('Pacific/Auckland');
        // the rival, stated so that the assertion is about the choice
        expect(resolved.site.location.name).not.toBe('Elsewhere');
        expect(resolved.site.timezone).not.toBe('Australia/Sydney');
    });

    test('the turf is the fixture config\'s, not the decoy config\'s', () => {
        expect(resolved.program.speciesKey).toBe('perennialRyegrass');
        expect(resolved.program.methodology).toBe('ammonium_acetate');
        expect(resolved.program.speciesKey).not.toBe('kikuyu');
        expect(resolved.program.methodology).not.toBe('mlsn');
    });

    test('the soil sample is the fixture site\'s, not the decoy site\'s', () => {
        expect(resolved.samples.soil.label).toBe('Soccer');
        expect(resolved.samples.soil.label).not.toBe('Elsewhere soil');
        // the decoy's readings are all -1, a value no fixture reading holds
        const values = resolved.samples.soil.values || {};
        expect(Object.keys(values).length).toBeGreaterThan(0);
        expect(Object.keys(values).filter((k) => values[k] === -1)).toEqual([]);
    });
});
