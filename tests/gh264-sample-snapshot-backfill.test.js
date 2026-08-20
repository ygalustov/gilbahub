/**
 * Test GH-264 — backfill methodologySnapshot/soilTextureSnapshot onto
 * samples that were already synced to the client before GH-263 landed
 * (D07, found by re-testing GH-263 live: a site already tested earlier in
 * this session still showed "AA: 37 ppm" after GH-263 shipped).
 *
 * ROOT CAUSE: GH-263 added `methodologySnapshot`/`soilTextureSnapshot` to
 * the object built when syncing a NEW sample from the server into
 * `GAIP_SampleManager`'s client-side store — but the sync loop has an
 * "already present" early-return (`if (serverSnap.allSites[siteId]
 * [sample.sample_type][sampleId]) return;`) for samples already cached
 * client-side (e.g. from an earlier page load, before GH-263 shipped, or
 * from earlier testing in the same session). That early-return skips the
 * whole object-literal build — including the two new fields — every single
 * sync, forever, for any sample that was ever cached before this fix
 * landed. GH-263 was correct for brand-new samples but silently inert for
 * every sample a real tester (or real user) had already touched.
 *
 * FIX: when a sample is already present, backfill just the two new fields
 * in place (never touch label/date/notes/zoneType/values — those may carry
 * local edits since the last full sync) and count it toward `restored` so
 * `SM.restoreFromPersistence(serverSnap)` actually runs. `getAllSamples()`
 * returns a deep clone (`JSON.parse(JSON.stringify(...))`), so mutating the
 * snapshot object without triggering `restoreFromPersistence` would never
 * reach the live store — this is why `restored` has to count backfills too.
 */

const vm = require('vm');
const fs = require('fs');
const path = require('path');

function extractSyncBlock() {
    const src = fs.readFileSync(path.join(__dirname, '../assets/sample-persistence.js'), 'utf8');
    const start = src.indexOf('var restored = 0;');
    const callPos = src.indexOf('SM.restoreFromPersistence(serverSnap);', start);
    const closeBrace = src.indexOf('}', callPos); // closes `if (restored > 0) {`
    return src.slice(start, closeBrace + 1);
}

function runSync({ samples, existingSample }) {
    const block = extractSyncBlock();
    let restoredPayload = null;
    const store = existingSample
        ? { allSites: { site1: { soil: { sample_1: existingSample } } }, sites: { site1: { label: 'Site 1' } } }
        : { allSites: {}, sites: {} };
    const sandbox = {
        SM: {
            getAllSamples: () => JSON.parse(JSON.stringify(store)),
            restoreFromPersistence: (snap) => { restoredPayload = snap; },
        },
        samples: samples,
        console: { log: () => {}, warn: () => {} },
    };
    sandbox.globalThis = sandbox;
    const ctx = vm.createContext(sandbox);
    vm.runInContext(block, ctx);
    return restoredPayload;
}

describe('GH-264 — backfill snapshot fields onto already-synced samples', () => {
    test('structural: sync loop backfills existing entries instead of skipping them outright', () => {
        const src = fs.readFileSync(path.join(__dirname, '../assets/sample-persistence.js'), 'utf8');
        expect(src).toMatch(/if \(_existingSample263\) \{/);
        expect(src).toMatch(/_existingSample263\.methodologySnapshot = sample\.methodology_snapshot/);
        expect(src).toMatch(/_existingSample263\.soilTextureSnapshot = sample\.soil_texture_snapshot/);
        expect(src).toMatch(/if \(_backfilled263\) restored\+\+;/);
        // Old unconditional early-return is gone (would've been a bare `return;` with no backfill).
        expect(src).not.toMatch(/if \(serverSnap\.allSites\[siteId\]\[sample\.sample_type\]\[sampleId\]\) return; {2}\/\/ already present/);
    });

    test('behavioural: an already-synced sample missing snapshot fields gets backfilled and persisted', () => {
        const existingSample = {
            id: 'sample_1', label: 'Sample 1', date: '2026-01-01', notes: '', zoneType: 'other',
            values: { K_ppm: 199, someLocalEdit: 'kept' },
            // No methodologySnapshot/soilTextureSnapshot yet -- pre-GH-263 shape.
        };
        const serverSample = {
            site_id: 'site1', sample_type: 'soil', id: 1, client_uid: 'sample_1',
            payload: { K_ppm: 199, someLocalEdit: 'kept' },
            methodology_snapshot: 'ammonium_acetate',
            soil_texture_snapshot: 'sand',
        };
        const restored = runSync({ samples: [serverSample], existingSample });
        expect(restored).not.toBeNull();
        const patched = restored.allSites.site1.soil.sample_1;
        expect(patched.methodologySnapshot).toBe('ammonium_acetate');
        expect(patched.soilTextureSnapshot).toBe('sand');
        // Local edit to values must survive the backfill untouched.
        expect(patched.values.someLocalEdit).toBe('kept');
        expect(patched.label).toBe('Sample 1');
    });

    test('behavioural: an already-synced sample that ALREADY has snapshot fields is left alone (no restoreFromPersistence noise)', () => {
        const existingSample = {
            id: 'sample_1', label: 'Sample 1', date: '2026-01-01', notes: '', zoneType: 'other',
            values: { K_ppm: 199 },
            methodologySnapshot: 'ammonium_acetate',
            soilTextureSnapshot: 'sand',
        };
        const serverSample = {
            site_id: 'site1', sample_type: 'soil', id: 1, client_uid: 'sample_1',
            payload: { K_ppm: 199 },
            methodology_snapshot: 'ammonium_acetate',
            soil_texture_snapshot: 'sand',
        };
        const restored = runSync({ samples: [serverSample], existingSample });
        // Nothing to backfill -> restored stays 0 -> restoreFromPersistence never called.
        expect(restored).toBeNull();
    });

    test('behavioural: a brand-new sample (not previously cached) still gets the full object built, unaffected by the backfill branch', () => {
        const serverSample = {
            site_id: 'site1', sample_type: 'soil', id: 1, client_uid: 'sample_new',
            payload: { K_ppm: 199 },
            methodology_snapshot: 'ammonium_acetate',
            soil_texture_snapshot: 'sand',
        };
        const restored = runSync({ samples: [serverSample], existingSample: null });
        expect(restored).not.toBeNull();
        const created = restored.allSites.site1.soil.sample_new;
        expect(created.methodologySnapshot).toBe('ammonium_acetate');
        expect(created.soilTextureSnapshot).toBe('sand');
        expect(created.values.K_ppm).toBe(199);
    });
});
