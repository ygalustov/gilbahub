/**
 * Test GH-263 — the general soil-texture Settings field now actually reaches
 * mlsnEngine() (D07, found while diagnosing GH-262: a site with Settings
 * "Soil texture" = Sand still computed the generic "others" AA range).
 *
 * ROOT CAUSE: `.gaip-soil-texture` -- the DOM field mlsnEngine()'s state
 * collector reads for the general soil-texture value -- is a static "loam"
 * default baked into legacy-hub-markup.blade.php:
 *   <option value="loam" selected>Loam</option>
 * with no build-time binding and, until this fix, no JS sync path from the
 * site's real `sites.soil_texture_override` either. The server already
 * computes the correct value at sample-creation time
 * (SampleController.php: site.soil_texture_override ?: account.soil_texture,
 * same for methodology_override/methodology) and returns it on every sample
 * API response as `methodology_snapshot`/`soil_texture_snapshot` -- but
 * `sample-persistence.js`'s server-sample sync discarded both fields,
 * keeping only the lab-value payload (`values`).
 *
 * FIX (three files, one chain):
 *  1. sample-persistence.js -- carries `methodology_snapshot`/
 *     `soil_texture_snapshot` through as `methodologySnapshot`/
 *     `soilTextureSnapshot` on the client-side sample object.
 *  2. sample-manager.js -- `loadSample()` now restores `.gaip-soil-texture`'s
 *     DOM value from `sample.soilTextureSnapshot` when present, fixing the
 *     primary mlsnEngine() path (GH-260) for real sample loads.
 *  3. hub-persistence.js -- the "empty hub form" fallback (GH-262) now
 *     prefers `_smSample.methodologySnapshot`/`.soilTextureSnapshot` over
 *     its own DOM-read fallback, since that DOM field turned out to be the
 *     same always-"loam" static default.
 *
 * WHAT THIS FILE GUARDED BEFORE, AND WHAT IT GUARDS NOW. It has always had two
 * subjects, and they have taken different routes.
 *
 * SUBJECT 1 — the two snapshot fields survive the server sync (parts 1 and 2
 * above). Unchanged, and still guarded below as it was.
 *   Named plainly: `soilTextureSnapshot` still has a reader, the texture chain
 *   in hub-persistence.js. `methodologySnapshot` no longer has one anywhere in
 *   the client (checked: `assets/`, `app/` — the only remaining mentions are
 *   this carry-through itself and a comment). It is carried as a record of what
 *   was in force when the sample was taken, not as an input to anything. The
 *   assertion below therefore guards a field with no current consumer, and says
 *   so rather than reading as though it guards a calculation.
 *
 * SUBJECT 2 — which source wins in the fallback. This is the half that moved,
 * and only for methodology. For soilTexture the answer is still DOM-first over
 * the snapshot (GH-270/272/273) and the behavioural test keeps proving it. For
 * methodology, neither the page field nor the snapshot is consulted any more:
 * GH-521 reads the site's own configuration record, by the site's id. The
 * intention behind GH-265 is kept — a live value beats a frozen one — but a
 * page field is not a carrier of "live"; it carries whatever site the page last
 * painted (GH-459). The read itself is guarded in
 * gh265-methodology-dom-priority.test.js.
 */

const fs = require('fs');
const path = require('path');
const { buildContext: buildEngineContext } = require('./helpers/mlsn-engine-harness');
const { runSampleFallback } = require('./helpers/sample-fallback-harness');

describe('GH-263 — soil texture / methodology snapshot reaches mlsnEngine()', () => {
    describe('sample-persistence.js — snapshot fields carried through server sync', () => {
        let src;
        beforeAll(() => {
            src = fs.readFileSync(path.join(__dirname, '../assets/sample-persistence.js'), 'utf8');
        });

        // `soilTextureSnapshot` feeds the texture chain in hub-persistence.js.
        // `methodologySnapshot` has had no reader since GH-521 moved methodology
        // to the site's own record; it survives as the sample's record of what
        // was in force at sampling time.
        test('methodologySnapshot/soilTextureSnapshot are set from the API sample object', () => {
            expect(src).toMatch(/methodologySnapshot:\s*sample\.methodology_snapshot\s*\|\|\s*null/);
            expect(src).toMatch(/soilTextureSnapshot:\s*sample\.soil_texture_snapshot\s*\|\|\s*null/);
        });

        test('the existing values/label/date/zoneType fields are untouched (additive change only)', () => {
            const objStart = src.indexOf('serverSnap.allSites[siteId][sample.sample_type][sampleId] = {');
            const objEnd = src.indexOf('};', objStart);
            const obj = src.slice(objStart, objEnd);
            expect(obj).toMatch(/label:\s*pld\._label \|\| pld\.label \|\| sampleId/);
            expect(obj).toMatch(/date:\s*sample\.lab_date \|\| sample\.sample_date \|\| null/);
            expect(obj).toMatch(/values:\s*pld/);
        });
    });

    describe('sample-manager.js — loadSample() no longer restores .gaip-soil-texture from a per-sample snapshot (GH-272)', () => {
        let src;
        beforeAll(() => {
            src = fs.readFileSync(path.join(__dirname, '../assets/sample-manager.js'), 'utf8');
        });

        // GH-272: this restore (added here in GH-263) actively regressed
        // GH-270's fix -- it unconditionally overwrote the page's correct
        // live-initialised .gaip-soil-texture value with whichever sample's
        // (potentially stale, per GH-269) soilTextureSnapshot happened to
        // auto-load. Texture is a site property, not a sample property, so
        // restoring it per-sample was never right even before that regression.
        test('the old per-sample texture restore is gone', () => {
            expect(src).not.toMatch(/texInput\.value = sample\.soilTextureSnapshot/);
            expect(src).not.toMatch(/if \(dataType === 'soil' && sample\.soilTextureSnapshot\)/);
        });

        test('file has no syntax errors after the removal', () => {
            expect(() => new Function(src)).not.toThrow();
        });
    });

    describe('hub-persistence.js fallback — behavioural: which source each field takes', () => {
        let engineCtx;
        beforeAll(() => { engineCtx = buildEngineContext(); });

        test('soilTexture: the live page field wins over a stale soilTextureSnapshot', () => {
            // GH-273's subject, unchanged by GH-521. `.gaip-soil-texture` is live
            // (GH-270 initialises it from the site's soil_texture_override on every
            // load; GH-272 removed the per-sample overwrite), while the snapshot is
            // frozen at sample-creation time. The snapshot here says "loam" and the
            // page says "sand" — the sands bucket must be the one that is used.
            const sn = runSampleFallback(engineCtx, {
                siteId: 'site1',
                configMethodology: 'ammonium_acetate',
                textureDom: 'sand',
                textureSnapshot: 'loam',
                sampleRaw: { K_ppm: 199, P_ppm: 25, Ca_ppm: 400, Mg_ppm: 60, S_ppm: 10 },
            });
            expect(sn.methodology).toBe('ammonium_acetate');
            const k = sn.nutrients.find((n) => n.nutrient === 'K');
            expect(k.mlsn).toBe('75.0-175.0'); // sands, not the "others" range the snapshot would give
            expect(k.status).toBe('HIGH');
        });

        test('soilTexture: the snapshot is still the fallback when the page field is empty', () => {
            // The half of GH-263 that survives: a page that has not painted the
            // field yet is not a page that says "loam".
            const sn = runSampleFallback(engineCtx, {
                siteId: 'site1',
                configMethodology: 'ammonium_acetate',
                textureDom: '',
                textureSnapshot: 'sand',
                sampleRaw: { K_ppm: 199, P_ppm: 25, Ca_ppm: 400, Mg_ppm: 60, S_ppm: 10 },
            });
            const k = sn.nutrients.find((n) => n.nutrient === 'K');
            expect(k.mlsn).toBe('75.0-175.0');
        });

        test('methodology: neither the page field nor the snapshot is consulted', () => {
            // What this test used to assert was "DOM beats the stale snapshot".
            // Both of those sources are now out of the chain, so the way to show it
            // is to make them agree with each other and disagree with the site
            // record: if either were read, the answer would be AA.
            const sn = runSampleFallback(engineCtx, {
                siteId: 'site1',
                configMethodology: 'mlsn',
                domMethodology: 'ammonium_acetate',
                snapshotMethodology: 'ammonium_acetate',
                textureDom: 'sand',
                sampleRaw: { K_ppm: 199, P_ppm: 25, Ca_ppm: 400, Mg_ppm: 60, S_ppm: 10 },
            });
            expect(sn.methodology).toBe('mlsn');
            const k = sn.nutrients.find((n) => n.nutrient === 'K');
            expect(k.mlsn).toBe('37'); // the MLSN literal threshold, not an AA range
        });

        test('methodology: a sample carrying no snapshot at all changes nothing', () => {
            // Pre-GH-263 samples have no snapshot fields. That used to matter, since
            // the snapshot was in the chain. It no longer is, so the answer is the
            // site's, exactly as it is for a sample that does carry one.
            const sn = runSampleFallback(engineCtx, {
                siteId: 'site1',
                configMethodology: 'ammonium_acetate',
                textureDom: 'sand',
                sampleRaw: { K_ppm: 199, P_ppm: 25, Ca_ppm: 400, Mg_ppm: 60, S_ppm: 10 },
            });
            expect(sn.methodology).toBe('ammonium_acetate');
            const k = sn.nutrients.find((n) => n.nutrient === 'K');
            expect(k.mlsn).toBe('75.0-175.0');
            expect(k.status).toBe('HIGH');
        });
    });
});
