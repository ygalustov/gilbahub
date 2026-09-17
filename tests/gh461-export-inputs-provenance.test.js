/**
 * GH-461 (PLAN-GH439 sections 10.6 and 10.9) — layer I, checked by PROVENANCE.
 *
 * The guarantee, stated as a claim about values rather than about text: no
 * value the document prints as site X's identity or inputs comes from the
 * page's state.
 *
 * Four guards were written in this work that checked WHERE a read is written
 * or WHAT a variable is called, and all four were walked past by a regression
 * that moved the read or renamed the variable — including the previous version
 * of this file, whose own mutation left seven of eight tests green. So this one
 * asks the only question that is indifferent to both: what reached the output.
 *
 * The page is poisoned. Every known shape of page state is filled with values
 * belonging to site B — `GAIP_STATE.inputs.turf`, `GAIP_STATE.turf`,
 * `GAIP_CANONICAL_STATE`, `GAIP_OVERSEED_STATE`, `GaipTurfProfile.state`,
 * `SpeciesController`, `GAIP_CLIMATE_V2_RESULT`, every `.gaip-*` field and
 * `#gaip-*` element, `window.climateMetrics` — each carrying a sentinel. The
 * resolver's object is site A's. If a sentinel appears anywhere in what
 * collectData() built, some value came from the page, and it does not matter
 * which line read it, what the variable was called, or whether the read sits in
 * a helper one line above the function.
 */
'use strict';

const { loadPage, POISON_SENTINEL, poisonPage } = require('./helpers/export-page-sandbox');

// The poisoning itself lives beside the loader, because the empty-inputs
// run in gh461-export-turf-keys.test.js needs the same page and the same
// inverted booleans.
const SENTINEL = POISON_SENTINEL;
const s = (field) => SENTINEL + field;

const poison = poisonPage;

/** Site A, the shape resolveExportInputs() returns. */
const INPUTS_A = Object.freeze({
    site: Object.freeze({
        id: 'site-a', name: 'Site A',
        location: Object.freeze({ name: 'Auckland', lat: -36.85, lon: 174.76 }),
        timezone: 'Pacific/Auckland', areaHa: null
    }),
    turf: Object.freeze({
        type: 'sports', subCategory: '', species: 'Perennial Ryegrass',
        speciesKey: 'perennialRyegrass', speciesDisplay: 'Perennial Ryegrass',
        variety: 'generic-a', construction: 'native-a', hoc: 25, percentC3: 100,
        warmBase: '', coolOverseed: '', overseedSpecies: '', overseedVariety: '',
        summerIntent: '', isC4: false
    }),
    program: null,
    samples: Object.freeze({ soil: null, tissue: null, water: null }),
    climateNormals: null, climateReason: 'no-coordinates',
    sources: Object.freeze({ species: 'site-config' })
});

/**
 * Every sentinel found anywhere in a structure, with the path to it.
 *
 * GH-475: the `function` branch is why this file has been asserting nothing.
 *
 * A poisoned value is a Proxy whose TARGET IS A FUNCTION — the sandbox says so
 * in its own comment, because a String wrapper's indexed properties are
 * read-only and non-configurable and a proxy over one throws before the value
 * reaches the document. So `typeof leaked` is 'function', the walker's
 * `typeof value !== 'object'` line returned at the first poisoned value it
 * met, and every assertion of the form "no sentinel reached here" passed on a
 * walker that never looked.
 *
 * The positive control below is the other half of the fix and is not optional:
 * a check that something is absent has to show, in the same file, that it can
 * see the thing when it is present.
 */
function sentinelsIn(value, at, found) {
    at = at || '';
    found = found || [];
    if (value === null || value === undefined) return found;
    if (typeof value === 'string') {
        if (value.indexOf(SENTINEL) >= 0) found.push({ at: at, value: value });
        return found;
    }
    if (typeof value === 'number') {
        // 99 and 77 are the numeric markers for percentC3 and hoc.
        if (value === 99 || value === 77) found.push({ at: at, value: value });
        return found;
    }
    if (typeof value === 'boolean') {
        // GH-475: the poisoning inverts booleans — every one of them answers
        // `true`, and in the identity sections under INPUTS_A the truth for
        // every boolean is `false`. So `true` here is a marker exactly like 99
        // and 77 are for the two numbers, and without this branch a leak into
        // `isC4`, `effectiveIsC4`, `useC3Targets` or `hasOverseed` — the four
        // that choose the growth curve — carries no sentinel to find and this
        // half of the guard cannot see it at all.
        if (value === true) found.push({ at: at, value: 'true (the poisoning inverts booleans)' });
        return found;
    }
    if (typeof value === 'function') {
        // A poisoned value: it prints as its own sentinel.
        const text = String(value);
        if (text.indexOf(SENTINEL) >= 0) found.push({ at: at, value: text });
        return found;
    }
    if (typeof value !== 'object') return found;
    Object.keys(value).forEach((k) => {
        try { sentinelsIn(value[k], at ? at + '.' + k : k, found); } catch (e) { /* getters */ }
    });
    return found;
}

describe('GH-461 — no value in the document comes from the page\'s state', () => {
    let sandbox, data;

    beforeAll(() => {
        const record = { errors: [], warnings: [], alerts: [] };
        const page = loadPage(record);
        expect(page.failures).toEqual([]);
        sandbox = page.sandbox;
        poison(sandbox);
        data = sandbox.GAIP_WordExport.collectData(INPUTS_A);
    });

    test('collectData runs to completion on a poisoned page', () => {
        // It did not, once: a block left behind referring to variables the
        // resolver replaced threw `_collectSiteCfg is not defined` out of this
        // function, and no document was produced at all — while the whole Jest
        // suite stayed green, because nothing in it ran collectData.
        expect(data).toBeTruthy();
        expect(data.site).toBeTruthy();
        expect(data.turf).toBeTruthy();
    });

    test('the site section carries nothing from the page', () => {
        expect(sentinelsIn(data.site, 'site')).toEqual([]);
    });

    test('the turf identity carries nothing from the page', () => {
        expect(sentinelsIn(data.turf, 'turf')).toEqual([]);
    });

    test('the site and turf identity are exactly what the resolver gave', () => {
        expect(data.site.name).toBe(INPUTS_A.site.name);
        expect(data.site.location).toBe(INPUTS_A.site.location.name);
        expect(data.turf.species).toBe(INPUTS_A.turf.species);
        // `type` is the display label the document prints ("Sports Field");
        // the key it was built from is kept beside it.
        expect(data.turf.rawTurfType).toBe(INPUTS_A.turf.type);
        expect(String(data.turf.type).toLowerCase()).toContain('sports');
        expect(data.turf.variety).toBe(INPUTS_A.turf.variety);
        expect(data.turf.construction).toBe(INPUTS_A.turf.construction);
        expect(data.turf.percentC3).toBe(INPUTS_A.turf.percentC3);
        expect(data.turf.hoc).toBe(INPUTS_A.turf.hoc);
        // Absent in the resolver stays absent: no default name, and nothing
        // borrowed from the page to fill the gap.
        expect(data.turf.warmBase).toBe('');
        expect(data.turf.coolOverseed).toBe('');
        expect(data.site.areaHa === undefined || data.site.areaHa === null).toBe(true);
    });

    /**
     * GH-475 — the positive control, required beside every assertion of
     * absence.
     *
     * The three tests above say "no sentinel reached here". For weeks they
     * said it while the walker returned at the first poisoned value it met,
     * because a poisoned value is a Proxy over a FUNCTION and the walker only
     * knew strings, numbers and objects. A check of absence that has never
     * been shown to see the thing present is not a check.
     *
     * So: a sentinel is planted, and the same walker that says "none" has to
     * name it — in `data`, and in the document the export actually writes.
     */
    describe('GH-475 — the walker sees a sentinel when there is one', () => {
        const PLANTED = SENTINEL + 'planted-by-the-positive-control';

        test('a sentinel planted in data.site is named, with its path', () => {
            const probe = { site: { name: PLANTED }, turf: {} };
            const found = sentinelsIn(probe, 'data');
            expect(found.map((f) => f.at)).toEqual(['data.site.name']);
            expect(found[0].value).toContain(SENTINEL);
        });

        test('a sentinel that arrives as a poisoned PROXY is named too', () => {
            // The shape the walker was blind to, and the only shape a real
            // leak has: `typeof` says 'function', not 'string'.
            const leaked = sandbox.GAIP_STATE.turf.species;
            expect(typeof leaked).not.toBe('string');
            expect(String(leaked)).toContain(SENTINEL);
            const found = sentinelsIn({ turf: { species: leaked } }, 'data');
            expect(found.map((f) => f.at)).toEqual(['data.turf.species']);
        });

        test('a planted sentinel reaches the document, and is found there', async () => {
            // The other half of the same control: what the walker sees in
            // `data` is what a reader of the .docx would see.
            const record = { errors: [], warnings: [], alerts: [] };
            const page = loadPage(record);
            expect(page.failures).toEqual([]);
            const planted = Object.assign({}, INPUTS_A, {
                site: Object.assign({}, INPUTS_A.site, { name: PLANTED })
            });
            const built = page.sandbox.GAIP_WordExport.collectData(planted);
            expect(sentinelsIn(built.site, 'site').map((f) => f.at)).toContain('site.name');

            const sections = page.sandbox.GAIP_WordExport.buildSections(built, {});
            const doc = new page.sandbox.docx.Document({
                sections: [{ properties: {}, children: sections }]
            });
            const blob = await page.sandbox.docx.Packer.toBlob(doc);
            const zip = await page.sandbox.JSZip.loadAsync(Buffer.from(await blob.arrayBuffer()));
            const xml = await zip.file('word/document.xml').async('string');
            expect(xml).toContain(PLANTED);
        });

        test('and with nothing planted the same three checks find nothing', () => {
            // Stated here so the pair reads as one measurement rather than two
            // unrelated tests: the walker looked, and there was nothing.
            expect(sentinelsIn(data.site, 'site')).toEqual([]);
            expect(sentinelsIn(data.turf, 'turf')).toEqual([]);
            expect(sentinelsIn(data, 'data').filter((f) => /^data\.(site|turf)\b/.test(f.at))).toEqual([]);
        });
    });

    /**
     * GH-475 (PLAN-GH439 section 10.6, third refinement) — the sentinel check
     * over the WHOLE finished document, which was specified and never written.
     *
     * The other checks in this file read `data`. This one reads what a client
     * would open: the export is run on a poisoned page and the finished
     * `word/document.xml` is searched for sentinels. It is the only assertion
     * that does not depend on knowing which field to look at.
     *
     * It cannot be "none" today, and pretending otherwise would be asserting a
     * state the product has not reached. Measured: 31 distinct sentinels reach
     * the document, from eleven roots, and every one of them is a view II
     * result or a layer I remainder of section 10.5 — the soil readings, the
     * wear and shade metrics, the water results, the trajectory, the companion
     * disease run, the climate slot. So the allowed roots are NAMED, each with
     * what it is, and a sentinel from anywhere else fails. The list can only
     * shrink: it is the work of layers II and of 10.5, counted.
     */
    describe('GH-475 — what reaches the finished document, on a poisoned page', () => {
        /** Roots still able to reach the document, and what each one is. */
        const ALLOWED_IN_DOCUMENT = {
            // GH-480: the methodology left this list — it comes from the site
            // config that owns it now, by id — and with it the upper-cased
            // form `GAIP_STATE.SOIL` that the printing block produced.
            // GH-490: and the readings block left it too, which empties the
            // name. The soil readings come from `inputs.samples.soil` by id,
            // like tissue and water before them. `GAIP_STATE.soil` is still
            // READ in two places — the MLSN phosphorus ladder's pH, and
            // `mlsnResults` — and neither reaches the document: the object is
            // undefined throughout a real export (measured), and on a poisoned
            // page the sentinel fails every comparison those two make of it.
            // They are named in the GH-490 report as what is left, not fixed
            // here: moving the ladder onto the sample's pH would move printed
            // phosphorus thresholds for MLSN sites, which is the owner's call.
            // GH-484: the water run left this list with the rest of the page's
            // water reading. What it supplied that this file can derive — SAR,
            // SARadj, RSC — is computed from the sample's own ions; what it
            // cannot — classification and the hazard ratings — is not printed,
            // because a run carries no stamp saying whose it is.
            'GAIP_STATE.shadeMetrics': 'the shade run — view II',
            'GAIP_STATE.wearMetrics': 'the wear run — view II',
            'GAIP_STATE.fertility': 'the fertility figures the page holds — view II',
            'GAIP_TRAJECTORY_RESULT': 'the stress trajectory the page computed — view II',
            'GAIP_COMPANION_DISEASE_RESULT': 'the companion-surface disease run — view II',
            climateMetrics: 'the single climate slot — view II, the block GH-245 left printing',
            // DOM reads, each already named field by field in the empty-inputs
            // run. Section 10.5's remaining inventory, seen from the document
            // end — one name now.
            // GH-480: `.gaip-soil-extractant` left this list because the read
            // left the product — no page renders that element, so it answered
            // nothing on every export.
            // GH-490: `.gaip-soil-sample-label` and `.gaip-soil-lab-ref` left
            // it because the reads left the product. The label is the record's
            // own, by id; the client record carries no laboratory reference,
            // so the document prints none.
            'dom-gaip-org-name': 'the organisation name in the header, off the page — section 10.5'
        };

        let xml = null;

        beforeAll(async () => {
            const page = loadPage({ errors: [], warnings: [], alerts: [] });
            expect(page.failures).toEqual([]);
            poison(page.sandbox);
            const built = page.sandbox.GAIP_WordExport.collectData(INPUTS_A);
            const sections = page.sandbox.GAIP_WordExport.buildSections(built, {});
            const doc = new page.sandbox.docx.Document({
                sections: [{ properties: {}, children: sections }]
            });
            const blob = await page.sandbox.docx.Packer.toBlob(doc);
            const zip = await page.sandbox.JSZip.loadAsync(Buffer.from(await blob.arrayBuffer()));
            xml = await zip.file('word/document.xml').async('string');
        });

        test('every sentinel in the document comes from a root that is named here', () => {
            const hits = xml.match(new RegExp(SENTINEL + '[A-Za-z0-9_.\\[\\]()-]*', 'g')) || [];
            const roots = Array.from(new Set(hits.map((h) => h.slice(SENTINEL.length))));
            const unexplained = roots
                .filter((r) => !Object.keys(ALLOWED_IN_DOCUMENT).some((a) => r.indexOf(a) === 0))
                .sort();
            expect({ unexplained: unexplained }).toEqual({ unexplained: [] });
        });

        test('every named root still reaches it — a name that stopped is deleted, not kept', () => {
            const idle = Object.keys(ALLOWED_IN_DOCUMENT)
                .filter((a) => xml.indexOf(SENTINEL + a) < 0);
            expect({ idle: idle }).toEqual({ idle: [] });
        });

        test('every name says what it is', () => {
            const thin = Object.keys(ALLOWED_IN_DOCUMENT)
                .filter((a) => String(ALLOWED_IN_DOCUMENT[a]).length < 20);
            expect({ thin: thin }).toEqual({ thin: [] });
        });

        test('the site and the turf identity are not among them', () => {
            // The whole point of layer I, asserted where the client reads it.
            expect(xml).toContain(INPUTS_A.site.name);
            expect(xml).toContain(INPUTS_A.turf.species);
            expect(xml).not.toContain(SENTINEL + 'GAIP_STATE.turf');
            expect(xml).not.toContain(SENTINEL + 'GAIP_CANONICAL_STATE');
            expect(xml).not.toContain(SENTINEL + 'GaipTurfProfile');
        });
    });
});