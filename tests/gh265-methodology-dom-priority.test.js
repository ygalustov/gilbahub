/**
 * Test GH-265 / GH-521 — the methodology this fallback computes with comes
 * from the site's OWN configuration record, read by the site's id; not from
 * a field on the page, and not from the sample's creation-time stamp.
 *
 * WHAT THIS FILE GUARDED BEFORE (GH-265, 2026): `.gaip-soil-methodology` on
 * the page had to win over the sample's `methodologySnapshot`. The intention
 * was that a LIVE value must beat a STALE one: the snapshot is frozen at
 * sample-creation time and goes wrong the moment the site's methodology is
 * changed afterwards. That intention was right and is kept here unchanged.
 *
 * WHAT CHANGED (GH-521): the page field is not a reliable carrier of "live".
 * It carries whatever site the page last painted. When a document or a card
 * is rendered for one site while the page's fields still describe another,
 * the page field is not stale — it is someone else's. That is GH-459: the
 * Word export read `.gaip-lat` / `.gaip-species` off the page and printed one
 * site's climate under another site's name, with every annual total still
 * matching because the annual figure is normalised to its target. The rule
 * that came out of it is in CLAUDE.md: what a document or a screen prints is
 * taken from the data of the object it is about, not from the state of the
 * page it is drawn on.
 *
 * So the source moves and the intention does not: live still beats stale, but
 * "live" now means the site's own `turf.methodology` in `GAIP_SiteConfig`,
 * fetched with the same site id the sample on this path was picked by
 * (`GAIP_HUB_CONFIG.activeSiteId`). Reading it from any other id source would
 * reproduce the defect in a new place — one site's setting against another
 * site's sample.
 *
 * Measured on the stand before the change (GH-512): on Re-run the DOM read
 * won every time, and it carried 'ammonium_acetate' while the sample being
 * computed — sample_105 — was stamped 'mlsn' and its site was set to 'mlsn'.
 *
 * THE RED THIS FILE OWES: if the read goes back to `.gaip-soil-methodology`,
 * or to the sample's stamp, the behavioural test below fails — it puts a
 * different answer in each of the three places at once, so only the config
 * source produces the expected number. Proved by restoring the DOM read and
 * watching it go red; see the report for GH-521.
 */

const vm = require('vm');
const fs = require('fs');
const path = require('path');
const { buildContext: buildEngineContext } = require('./helpers/mlsn-engine-harness');
const { runSampleFallback, stripLineComments } = require('./helpers/sample-fallback-harness');

describe('GH-265/521 — methodology comes from the site config, by site id', () => {
    let src;     // the real file
    let code;    // the same file with whole-line comments dropped
    beforeAll(() => {
        src = fs.readFileSync(path.join(__dirname, '../assets/hub-persistence.js'), 'utf8');
        code = stripLineComments(src);
    });

    describe('structural — the source, and the id it is read by', () => {
        // Measured on the code, not on the prose around it: the comment above the
        // resolver names `.gaip-soil-methodology` on purpose, to say why it is no
        // longer read, and an assertion that could be satisfied by deleting that
        // sentence would be guarding the wrong thing.
        test('the page field `.gaip-soil-methodology` is not read on this path at all', () => {
            const start = code.indexOf('if (!cache.computed.soilNutrition && global.GAIP_SampleManager');
            expect(start).toBeGreaterThan(-1);
            const end = code.indexOf('var _smHtml = global.mlsnEngine', start);
            expect(end).toBeGreaterThan(start);
            expect(code.slice(start, end)).not.toMatch(/gaip-soil-methodology/);
            expect(code).not.toMatch(/_smMethodDom/);
        });

        test('methodology is assigned from the config resolver, not from a DOM/snapshot chain', () => {
            expect(code).toMatch(/methodology:\s*_smConfigMethodology,/);
            expect(code).not.toMatch(/methodology:\s*_smMethodDom/);
            expect(code).not.toMatch(/methodology:\s*_smSample\.methodologySnapshot/);
        });

        test('the resolver reads turf.methodology out of GAIP_SiteConfig', () => {
            expect(code).toMatch(/var _smConfigMethodology = \(function \(\) \{/);
            expect(code).toMatch(/global\.GAIP_SiteConfig\.getConfig\(_sid\)/);
            expect(code).toMatch(/_cfg && _cfg\.turf \? _cfg\.turf\.methodology : null/);
        });

        test('the id it resolves by is the same one the sample was picked by', () => {
            // The sample on this path is chosen by GAIP_HUB_CONFIG.activeSiteId,
            // deliberately (the comment above it says why: the other active-site
            // sources can have been switched to 'default'). The methodology must
            // therefore be fetched for that same id, or it answers for a site the
            // sample does not belong to.
            expect(code).toMatch(/var _smHubSiteId = \(window\.GAIP_HUB_CONFIG && window\.GAIP_HUB_CONFIG\.activeSiteId\) \|\| null;/);
            expect(code).toMatch(/var _sid = _smHubSiteId;/);
            const resolverStart = code.indexOf('var _smConfigMethodology');
            const resolverEnd = code.indexOf('})();', resolverStart);
            const resolver = code.slice(resolverStart, resolverEnd);
            expect(resolver).not.toMatch(/GAIP_SiteContext|getActiveSiteId/);
        });

        test('no methodology default is baked in anywhere along the chain', () => {
            expect(code).not.toMatch(/methodology:[^\n]*'mlsn'/);
        });

        test('file has no syntax errors', () => {
            expect(() => new Function(src)).not.toThrow();
        });
    });

    describe('behavioural — three sources, three different answers, one winner', () => {
        let engineCtx;
        beforeAll(() => { engineCtx = buildEngineContext(); });

        test('config says mlsn while page field and sample stamp both say AA: mlsn wins', () => {
            // Every source carries a DIFFERENT answer on purpose. Reading the page
            // field or the stamp gives 'ammonium_acetate' and a certificate range;
            // only reading the config gives 'mlsn' and the MLSN literal threshold.
            const sn = runSampleFallback(engineCtx, {
                siteId: 'site1',
                configMethodology: 'mlsn',
                domMethodology: 'ammonium_acetate',
                snapshotMethodology: 'ammonium_acetate',
                rawMethodology: 'ammonium_acetate',
                textureDom: 'sand',
                sampleRaw: { K_ppm: 199, P_ppm: 25, Ca_ppm: 400, Mg_ppm: 60, S_ppm: 10 },
            });
            expect(sn).toBeDefined();
            expect(sn.methodology).toBe('mlsn');
            const k = sn.nutrients.find((n) => n.nutrient === 'K');
            expect(k.mlsn).toBe('37'); // the MLSN literal, not an AA range
            expect(k.rangeMin).toBeUndefined();
        });

        test('config says AA while page field and sample stamp both say mlsn: AA wins', () => {
            // The mirror of the case above, so that "config wins" cannot be passed
            // by a resolver that simply returns a constant or always returns null.
            const sn = runSampleFallback(engineCtx, {
                siteId: 'site1',
                configMethodology: 'ammonium_acetate',
                domMethodology: 'mlsn',
                snapshotMethodology: 'mlsn',
                rawMethodology: 'mlsn',
                textureDom: 'sand',
                sampleRaw: { K_ppm: 199, P_ppm: 25, Ca_ppm: 400, Mg_ppm: 60, S_ppm: 10 },
            });
            expect(sn.methodology).toBe('ammonium_acetate');
            const k = sn.nutrients.find((n) => n.nutrient === 'K');
            expect(k.mlsn).toBe('75.0-175.0'); // AA "sands" range
            expect(k.status).toBe('HIGH');
        });

        test('the config of ANOTHER site is not what gets read', () => {
            // The page is standing on site2 and site2 is AA; the sample belongs to
            // site1, which is mlsn. This is the GH-459 shape, applied to
            // methodology: the answer must come from the sample's own site.
            const sn = runSampleFallback(engineCtx, {
                siteId: 'site1',
                configMethodology: 'mlsn',
                otherSiteId: 'site2',
                otherSiteMethodology: 'ammonium_acetate',
                domMethodology: 'ammonium_acetate',
                snapshotMethodology: 'ammonium_acetate',
                textureDom: 'sand',
                sampleRaw: { K_ppm: 199, P_ppm: 25, Ca_ppm: 400, Mg_ppm: 60, S_ppm: 10 },
            });
            expect(sn.methodology).toBe('mlsn');
        });

        test('site has no methodology set: the result carries null, and nothing is substituted', () => {
            const sn = runSampleFallback(engineCtx, {
                siteId: 'site1',
                configMethodology: null,
                domMethodology: 'ammonium_acetate',
                snapshotMethodology: 'ammonium_acetate',
                rawMethodology: 'ammonium_acetate',
                textureDom: 'sand',
                sampleRaw: { K_ppm: 50, P_ppm: 25 },
            });
            expect(sn).toBeDefined();
            expect(sn.methodology).toBeNull();
        });

        test('an empty string in the config is not a methodology either', () => {
            const sn = runSampleFallback(engineCtx, {
                siteId: 'site1',
                configMethodology: '',
                domMethodology: 'ammonium_acetate',
                textureDom: 'sand',
                sampleRaw: { K_ppm: 50, P_ppm: 25 },
            });
            expect(sn.methodology).toBeNull();
        });

        test('GAIP_SiteConfig absent entirely: null, no crash', () => {
            const sn = runSampleFallback(engineCtx, {
                siteId: 'site1',
                noSiteConfig: true,
                domMethodology: 'ammonium_acetate',
                textureDom: 'sand',
                sampleRaw: { K_ppm: 50, P_ppm: 25 },
            });
            expect(sn).toBeDefined();
            expect(sn.methodology).toBeNull();
        });
    });
});
