/**
 * GH-393 / GH-521 — the Prebble recommender's methodology: the divergence this
 * file was written to pin, and which half of it has closed.
 *
 * WHAT THIS FILE GUARDED BEFORE. It fixed nothing. It PINNED three different
 * rules for resolving one value, so that the day any of them moved the suite
 * would say so instead of the surfaces drifting apart in silence:
 *
 *   1. nutrition-calendar.js -- started at `soil.methodology`, but treated a
 *      bare 'mlsn' as the hub store's PLACEHOLDER rather than an answer
 *      (GH-377's `_methodologyResolved`), then fell through to the
 *      `.gaip-soil-methodology` DOM select and `GAIP_HUB_CONFIG.turfMethodology`.
 *   2. nutrition-program-inputs.js `resolveSiteProgramInputs()`, what the
 *      Combined export calls -- `sample.methodology || turf.methodology ||
 *      GAIP_HUB_CONFIG.turfMethodology`, first non-empty wins, no placeholder
 *      concept, a raw 'mlsn' beating the site config outright.
 *   3. `NutritionPrebbleIntegration.getMethodology()`, what the live NZ panels
 *      call -- read ONLY `GAIP_HUB_CONFIG.turfMethodology` and folded everything
 *      except 'slan' to 'ammonium_acetate', so it could never return 'mlsn' and
 *      the live P threshold was always 30.
 *
 * The consequence was the threshold `methodology === 'mlsn' ? 21 : 30`, written
 * out in three files and fed by rule 2 in the export and rule 3 on screen: an
 * NZ site whose stamp genuinely read MLSN would get 21 in the document and 30
 * on the page for the same sample.
 *
 * The file also recorded why nothing was aligned. Underneath all three rules was
 * a question the data could not answer: this hub could not tell a GENUINE MLSN
 * choice from the hub store's default, because 'mlsn' was both. All 109 soil
 * samples in the dev database were stamped `methodology_snapshot = 'mlsn'`,
 * plainly a default and not 109 deliberate choices -- which is exactly why
 * nutrition-calendar.js grew `_methodologyResolved` in the first place. Deciding
 * what an NZ site with a genuine MLSN stamp should use meant first deciding how
 * a genuine choice is recorded at all. That was named a product call and handed
 * back.
 *
 * WHAT THIS FILE GUARDS NOW. The product call was made (GH-520/521): the
 * methodology has ONE owner, `config.turf.methodology`, there is no default, and
 * an unset site produces nothing rather than 'mlsn'. That answers the question
 * the divergence rested on, and the three rules collapse:
 *
 *   - Rule 3 is gone as a rule of its own. `getMethodology()` no longer reads
 *     `GAIP_HUB_CONFIG` and no longer folds; it calls `resolveExportInputs()`
 *     for the active site and returns what the owner says, or null. The live
 *     panel and the exported document now run the SAME rule -- the divergence
 *     this file exists for, closed.
 *   - Rule 2 lost its first and third links: no `sample.methodology`, which is
 *     how a report for one site was built on another site's answer, and no
 *     `GAIP_HUB_CONFIG.turfMethodology`, which answers for whichever site the
 *     page is standing on. What is left is `turf.methodology`, by site id.
 *   - Rule 1 lost its placeholder heuristic. 'mlsn' is an answer like any other
 *     now, because the store no longer seeds it.
 *
 * WHAT IS NOT CLOSED, and is still pinned below: the 21/30 threshold is still
 * written out in three separate files. Unifying it was not part of this
 * delivery, so until it is, an edit to one copy must fail here rather than pass.
 *
 * Rule 1 is also still a separate expression from rule 2 -- the calendar reads
 * `soil.methodology` off the state it was handed, the resolver reads the config
 * by id. They agree on every case tested today; that they agree in general is
 * not something this file measures. Said plainly rather than left to read as
 * though the collapse were total.
 */

'use strict';

const fs = require('fs');
const path = require('path');

const read = (rel) => fs.readFileSync(path.join(__dirname, '..', rel), 'utf8');
const NPI = require('../assets/nutrition-program-inputs.js');

describe('GH-393 — the canonical resolver preserves mlsn (rule 2)', () => {
    test('normalizeMethodology folds case, spacing and cotula, but never mlsn', () => {
        expect(NPI.normalizeMethodology('mlsn')).toBe('mlsn');
        expect(NPI.normalizeMethodology('MLSN')).toBe('mlsn');
        expect(NPI.normalizeMethodology('slan')).toBe('slan');
        expect(NPI.normalizeMethodology('AMMONIUM ACETATE')).toBe('ammonium_acetate');
        expect(NPI.normalizeMethodology('cotula_s78')).toBe('ammonium_acetate');
        expect(NPI.normalizeMethodology('')).toBe('');
        expect(NPI.normalizeMethodology(null)).toBe('');
    });

    test('its source chain is the site config alone, by site id', () => {
        // This assertion used to REQUIRE the three-link chain
        //   sample.methodology || turf.methodology || GAIP_HUB_CONFIG.turfMethodology
        // and called it "sample-first". Two of those three links answer for
        // something other than the site being asked about, which is the defect
        // GH-520/521 removed; `turf` comes from getSiteConfig(siteId).
        const src = read('assets/nutrition-program-inputs.js');
        expect(src).toMatch(/const rawMethodology = turf\.methodology \|\| null;/);
        expect(src).toMatch(/sources\.methodology = turf\.methodology \? 'site-config' : 'empty';/);
        expect(src).not.toMatch(/rawMethodology = sample\.methodology/);
        const start = src.indexOf('const rawMethodology = turf.methodology');
        const body = src.slice(start, start + 400);
        expect(body).not.toMatch(/GAIP_HUB_CONFIG/);
        expect(body).not.toMatch(/'mlsn'/);
        // And no placeholder heuristic came the other way across the gap either.
        expect(body).not.toMatch(/_methodologyResolved|placeholder/);
    });
});

describe('GH-393/521 — the live Prebble panel no longer has a rule of its own', () => {
    const src = read('assets/nutrition-prebble-integration.js');
    const bodyOf = () => {
        const start = src.indexOf('getMethodology: function()');
        expect(start).toBeGreaterThan(-1);
        return src.slice(start, src.indexOf('\n        },', start));
    };

    test('getMethodology() asks the shared resolver, for the active site by id', () => {
        const body = bodyOf();
        expect(body).toMatch(/const _npi = window\.GAIP_NutritionProgramInputs;/);
        expect(body).toMatch(/const _sid = _npi\.getActiveSiteId\(\);/);
        expect(body).toMatch(/_npi\.resolveExportInputs\(\{ siteId: _sid \}\)/);
        expect(body).toMatch(/r && r\.program \? \(r\.program\.methodology \|\| null\) : null/);
    });

    test('every function it depends on is one the adapter actually exports', () => {
        // THE SECOND DEFECT, same shape as the first and found the same way.
        // The first draft guarded on `typeof
        // window.GAIP_SampleManager.getActiveSiteId === 'function'` and called
        // it directly. sample-manager.js is not loaded on the Plan page, so the
        // guard was false, the ternary short-circuited, and this function
        // answered null on every site including the New Zealand ones it exists
        // for — measured live on six sites. A guard that turns a missing
        // dependency into a quiet null is a guard that hides the wiring.
        //
        // The adapter exports its own `getActiveSiteId()`, which tries the
        // sample manager first and falls back to GAIP_HUB_CONFIG.activeSiteId.
        // Asserted against the MODULE, so a rename there brings this down.
        const NPI = require('../assets/nutrition-program-inputs.js');
        const code = bodyOf().split('\n').filter((l) => !/^\s*\/\//.test(l)).join('\n');
        const called = Array.from(new Set(
            (code.match(/\b_npi\.([A-Za-z_$][\w$]*)/g) || []).map((m) => m.slice(5))));
        expect(called).toEqual(expect.arrayContaining(['getActiveSiteId', 'resolveExportInputs']));
        called.forEach((fn) => expect(typeof NPI[fn]).toBe('function'));
        // and it no longer reaches for a global this page does not carry
        expect(code).not.toMatch(/GAIP_SampleManager/);
    });

    test('the key it reads is a key the resolver actually returns', () => {
        // THE DEFECT THIS EXISTS BECAUSE OF. The first draft of the read above
        // asked for `r.soil.methodology`. `resolveExportInputs` returns no
        // `soil` key — its keys are site, turf, program, samples,
        // climateNormals, climateReason, sources, provenance — so `r && r.soil
        // ? ... : null` was a guard that swallowed the mistake, and the function
        // answered null on every site. Measured live on Burns, whose config
        // stores 'mlsn': layers 1 and 2 said MLSN, this one said null.
        //
        // The same class is already recorded in nutrition-program-inputs.js
        // (GH-471, `cfg.locationName` — a key no site config has; the name
        // lives at `location.name`), and it cost a printed line then too. A
        // source-text assertion cannot catch it: the text is well-formed. So
        // this one asks the MODULE what it returns.
        const NPI = require('../assets/nutrition-program-inputs.js');
        const shape = NPI.resolveExportInputs({ siteId: 'no-such-site' });
        const keys = Object.keys(shape);
        expect(keys).toContain('program');
        expect(keys).not.toContain('soil');
        // and every dotted path getMethodology reads off the result is one of
        // those keys, found in the source rather than restated here
        // Comments stripped first: the comment above the read names `r.soil` on
        // purpose, to say why it is wrong, and an assertion a comment can fail
        // is an assertion about prose.
        const code = bodyOf().split('\n').filter((l) => !/^\s*\/\//.test(l)).join('\n');
        const reads = Array.from(new Set(
            (code.match(/\br\.([A-Za-z_$][\w$]*)/g) || []).map((m) => m.slice(2))));
        expect(reads.length).toBeGreaterThan(0);
        reads.forEach((k) => expect(keys).toContain(k));
    });

    test('it no longer reads the page-level global the server injected', () => {
        // `GAIP_HUB_CONFIG.turfMethodology` answers for whichever site the page
        // is standing on, and that is what this function used to read. It is
        // still named in the comment above the id resolution — the adapter's
        // `getActiveSiteId()` falls back to `GAIP_HUB_CONFIG.activeSiteId`, an
        // id rather than a methodology — so the match is against the code.
        const code = bodyOf().split('\n').filter((l) => !/^\s*\/\//.test(l)).join('\n');
        expect(code).not.toMatch(/GAIP_HUB_CONFIG/);
        expect(code).not.toMatch(/turfMethodology/);
    });

    test('the fold is gone: mlsn survives, and nothing is invented for an unset site', () => {
        // This test used to assert the OPPOSITE — that the function folded
        // everything except slan to ammonium_acetate and therefore could never
        // return 'mlsn'. That fold is what made the live panel and the exported
        // document disagree about the same sample, and it is also what GH-395's
        // NZ gate was originally justified by.
        const body = bodyOf();
        expect(body).not.toMatch(/if \(_hubMeth === 'slan'\) return 'slan';/);
        expect(body).not.toMatch(/return 'ammonium_acetate';/);
        // The only thing it returns literally is the absence.
        expect(body.match(/return '[a-z_]+';/g) || []).toEqual([]);
        expect(body).toMatch(/return _resolved \|\| null;/);
    });
});

describe('GH-393 — the P threshold is one rule written in three places', () => {
    // Duplicated constants are how the two surfaces came to disagree without
    // anyone noticing. Until they are unified, at least make an edit to one
    // copy fail here rather than pass silently.
    const copies = [
        ['assets/nutrition-prebble-integration.js', /const pThreshold = methodology === 'mlsn' \? 21 : 30;/],
        ['assets/nutrition-nz-fertiliser-integration.js', /var pThreshold\s+= methodology === 'mlsn' \? 21 : 30;/],
        ['assets/word-export-combined.js', /var _pThreshold = \(perSampleInputs\.methodology === 'mlsn'\) \? 21 : 30;/]
    ];

    test.each(copies.map(([f]) => [f]))('%s still carries the 21/30 threshold', (file) => {
        const [, re] = copies.find(([f]) => f === file);
        expect(read(file)).toMatch(re);
    });

    test('the export copy is fed from the sample-derived inputs, the page copies from getMethodology()', () => {
        expect(read('assets/word-export-combined.js')).toMatch(/methodology: perSampleInputs\.methodology,/);
        expect(read('assets/nutrition-prebble-integration.js')).toMatch(/const methodology = this\.getMethodology\(\);/);
        expect(read('assets/nutrition-nz-fertiliser-integration.js')).toMatch(/pi\.getMethodology\(\)/);
    });
});

describe('GH-393/521 — the recommender below both surfaces takes the setting and nothing else', () => {
    function metaBody() {
        const src = read('assets/prebbles-products.js');
        const start = src.indexOf('generateProgram: function(calendar, context) {');
        expect(start).toBeGreaterThan(-1);
        // Bounded by the meta block's own end rather than a character count.
        const end = src.indexOf('surfaceType: context.surfaceType,', start);
        expect(end).toBeGreaterThan(start);
        return src.slice(start, end);
    }
    const codeOf = (t) => t.split('\n').filter((l) => !/^\s*\/\//.test(l)).join('\n');

    test('an mlsn setting still reaches the recommender as mlsn', () => {
        // Unchanged, and the reason this file has always asserted it: a blanket
        // fold here would have contradicted normalizeMethodology() next door.
        expect(codeOf(metaBody())).toMatch(/return raw \|\| null;/);
    });

    test('the VALUE cotula_s78/cotula is still normalised to ammonium_acetate', () => {
        // A saved setting written in a Hill Labs sample-type spelling. The
        // setting answering for itself, which the owner's rule permits.
        expect(codeOf(metaBody())).toMatch(
            /if \(raw === 'cotula_s78' \|\| raw === 'cotula'\) return 'ammonium_acetate';/);
    });

    test('GH-521: the SURFACE no longer answers for the setting', () => {
        // WHAT THIS USED TO REQUIRE: `if (_isCotula) return 'ammonium_acetate'`,
        // where `_isCotula` was read from `context.surfaceType`,
        // `GAIP_STATE.turf.cotula` and two turf-profile globals. It returned AA
        // whatever the site was set to. The owner settled it on 18.09.2026: the
        // methodology comes only from the site's settings, with no other
        // dependencies — so a bowls surface is a surface, not an answer to this
        // question. Narrowing the fold was not enough and was not what was
        // asked; it is removed.
        const code = codeOf(metaBody());
        expect(code).not.toMatch(/_isCotula/);
        expect(code).not.toMatch(/surfaceType === 'bowling_greens'/);
        expect(code).not.toMatch(/turfType === 'bowls'/);
        expect(code).not.toMatch(/GAIP_STATE\?\.turf\?\.cotula/);
    });

    test('GH-521: no methodology is stamped onto a programme for a site that has none', () => {
        // The `|| 'mlsn'` tail. It mattered more than it looks: the stamp it
        // wrote is what the staleness check compares a restored programme
        // against, so an invented methodology came back as a fact later.
        const code = codeOf(metaBody());
        expect(code).toMatch(/const raw = context\.methodology \|\| calendar\.soil\?\.methodology \|\| null;/);
        expect(code).not.toMatch(/\|\| 'mlsn'/);
    });
});
