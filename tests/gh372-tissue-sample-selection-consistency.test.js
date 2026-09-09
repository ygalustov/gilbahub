/**
 * GH-372 — tissue-sample SELECTION consistency between the Plan page and the
 * Combined Word export, on a site carrying more than one tissue sample.
 *
 * Background: GH-366 made the Plan page resolve tissue server-side —
 * PageController::topbarData() queries the site's tissue samples with
 * `orderByRaw('COALESCE(lab_date, sample_date) DESC')->orderByDesc('id')`
 * (see app/tests/Feature/PlanPageTissuePercentTest.php's own
 * test_the_most_recent_tissue_sample_wins()). The Combined export resolves
 * tissue client-side, per PHYSICAL ZONE, via word-export-combined.js's
 * enumerateSamples()/buildZoneMap() ("b35fix_greentissue"): for each zone it
 * keeps whichever tissue sample has the latest `date` field, then explicitly
 * calls GAIP_SampleManager.loadSample('tissue', <that id>) immediately before
 * the per-sample data collection reads GAIP_STATE.tissue back — a pattern
 * that force-overwrites whatever GAIP_SampleManager's own generic
 * getActiveSample('tissue') pointer held beforehand.
 *
 * A prior code-only review worried these two, structurally independent
 * mechanisms might disagree on a site with more than one tissue sample on
 * file. Live-verified against the real dev stack first (Playwright, real DB
 * rows, real Plan-page console/screen text, real generated .docx text — see
 * this ticket's changelog entry for the exact numbers): on every scenario
 * tried, they agree. This file pins that agreement at the unit level by
 * calling each side's REAL selection code (not a re-implementation of
 * either), so a future change to either mechanism's logic is caught here
 * instead of only being noticed as a live UI-vs-export divergence.
 *
 * Loading convention: word-export-combined.js and sample-manager.js are the
 * same DOM-heavy, hard-to-sandbox modules gh369/gh371's test files already
 * load this way (manual `global.window`/`global.document` stubs, matching
 * this repo's testEnvironment:'node' jest config) — see those files' own
 * header comments for the established rationale.
 */

'use strict';

function stubDom() {
    global.window = {};
    global.document = {
        readyState: 'complete',
        addEventListener: function () {},
        removeEventListener: function () {},
        dispatchEvent: function () { return true; },
        querySelector: function () { return null; },
        querySelectorAll: function () { return []; },
        createElement: function () {
            return {
                style: {}, addEventListener: function () {}, setAttribute: function () {},
                appendChild: function () {}, classList: { add: function () {}, remove: function () {} },
            };
        },
        body: { appendChild: function () {}, contains: function () { return false; } },
        getElementById: function () { return null; },
    };
    global.localStorage = {
        getItem: function () { return null; }, setItem: function () {}, removeItem: function () {},
    };
}

/**
 * sample-manager.js, word-export-combined.js and site-selector-ui.js all
 * schedule real setTimeout retries at module-load time (DOMContentLoaded
 * fallbacks, UI-anchor injection polling) -- none of it relevant to what's
 * under test here, but real timers left pending make Jest warn about not
 * exiting cleanly once these modules are actually require()'d (as opposed to
 * only string-matched, this repo's more common convention for this file --
 * see gh362/gh367's header comments). Fake timers keep every load's require()
 * side effects inert without changing any of the three modules themselves.
 */
function loadModules() {
    jest.useFakeTimers();
    jest.resetModules();
    stubDom();
    require('../assets/zone-key.js');
    require('../assets/sample-manager.js');
    require('../assets/word-export-combined.js');
    return {
        SM: global.window.GAIP_SampleManager,
        CE: global.window.GAIP_CombinedExport,
    };
}

function loadWithSiteSelector() {
    const mods = loadModules();
    require('../assets/site-selector-ui.js');
    return Object.assign(mods, { SS: global.window.GilbaSiteSelector });
}

afterEach(() => {
    jest.useRealTimers();
});

const SITE_ID = 'gh372-test-site';

/** Seeds one site's client-side sample store via the real restoreFromPersistence(),
 *  the same v2 shape sample-persistence.js's server sync produces. */
function seedSite(SM, storeOverrides) {
    SM.restoreFromPersistence({
        sites: { [SITE_ID]: { label: 'GH-372 Test Site', createdAt: '' } },
        currentSite: SITE_ID,
        allSites: { [SITE_ID]: Object.assign({ soil: {}, water: {}, tissue: {}, loi: {} }, storeOverrides) },
        allActive: {},
        allMeta: {},
    });
}

describe('GH-372 — Combined export tissue selection agrees with Plan\'s DB rule (single zone)', () => {
    // Same literal N/P/K/dates as PlanPageTissuePercentTest.php's
    // test_the_most_recent_tissue_sample_wins() — deliberately mirrored so a
    // human reading both files side by side can see they exercise the same
    // scenario through each side's own real mechanism.
    const OLDER = { id: 'sample_older', label: 'Green 1', date: '2025-01-01', notes: '', zoneType: 'Greens', values: { N: '3.00', P: '0.30', K: '2.00' } };
    const NEWER = { id: 'sample_newer', label: 'Green 1', date: '2026-08-08', notes: '', zoneType: 'Greens', values: { N: '4.57', P: '0.62', K: '1.05' } };
    const SOIL_GREEN1 = { id: 'Green 1', label: 'Green 1', date: '2025-01-15', notes: '', zoneType: 'Greens', values: { N: '150', P: '40', K: '200' } };

    test('the zone\'s soil-primary entry picks the chronologically-later tissue sample, matching Plan\'s COALESCE(lab_date,sample_date) DESC rule', () => {
        const { SM, CE } = loadModules();
        seedSite(SM, { soil: { 'Green 1': SOIL_GREEN1 }, tissue: { sample_older: OLDER, sample_newer: NEWER } });

        const entries = CE.enumerate('current');
        expect(entries).toHaveLength(1);
        expect(entries[0].primaryType).toBe('soil');
        expect(entries[0].tissueSampleId).toBe('sample_newer');
    });

    test('the winner does not depend on which sample was inserted into the store first', () => {
        const { SM, CE } = loadModules();
        // Deliberately reversed insertion order versus the test above.
        seedSite(SM, { soil: { 'Green 1': SOIL_GREEN1 }, tissue: { sample_newer: NEWER, sample_older: OLDER } });

        const entries = CE.enumerate('current');
        expect(entries[0].tissueSampleId).toBe('sample_newer');
    });

    test('a tissue-only zone (no soil sample) resolves the same way', () => {
        const { SM, CE } = loadModules();
        seedSite(SM, { tissue: { sample_older: OLDER, sample_newer: NEWER } });

        const entries = CE.enumerate('current');
        expect(entries).toHaveLength(1);
        expect(entries[0].primaryType).toBe('tissue');
        expect(entries[0].tissueSampleId).toBe('sample_newer');
    });
});

describe('GH-372 — same-zone EXACT DATE tie: agrees today, but only because both sides borrow the server\'s own order', () => {
    // Live-verified against the real dev stack (Federal Golf, samples 147/148,
    // both lab_date 2026-01-15): Plan's `orderByDesc('id')` tiebreak picked
    // the higher-id sample (148), and the Combined export's Green 1 zone
    // independently picked the SAME sample. This test pins that agreement —
    // it is not a coincidence PHP and JS both happen to share a hardcoded
    // rule; the JS side (buildZoneMap's `date > current.date`, strict
    // greater-than) has no id-awareness of its own at all. On an exact date
    // tie it simply keeps whichever candidate it encountered FIRST while
    // iterating the tissue store — correct today only because the array
    // arrives from the server already sorted `lab_date DESC, id DESC`
    // (SampleController::index()), so the higher-id sample is already first.
    // A change to fetch/merge order (pagination, multiple requests, a
    // different sort) could silently flip this with no guard, exactly the
    // fragility class GH-372 identified and fixed for
    // site-selector-ui.js's OWN fallback below — this describe block exists
    // so the SAME risk in buildZoneMap doesn't go unpinned just because it
    // isn't the one this ticket's fix targeted.
    test('when the array already arrives id-DESC-on-ties (the real sync order), the higher-id/later-inserted sample wins the tie', () => {
        const { SM, CE } = loadModules();
        const soil = { id: 'Green 1', label: 'Green 1', date: '2025-01-15', notes: '', zoneType: 'Greens', values: { N: '150', P: '40', K: '200' } };
        // Insertion order matches what a real server response (id DESC on a
        // tie) would produce once synced into the store: higher id first.
        const higherId = { id: 'sample_148', label: 'Green 1', date: '2026-01-15', notes: '', zoneType: 'Greens', values: { N: '5.00', P: '0.75', K: '1.20' } };
        const lowerId = { id: 'sample_147', label: 'Green 1', date: '2026-01-15', notes: '', zoneType: 'Greens', values: { N: '4.57', P: '0.62', K: '1.05' } };
        seedSite(SM, { soil: { 'Green 1': soil }, tissue: { sample_148: higherId, sample_147: lowerId } });

        const entries = CE.enumerate('current');
        expect(entries[0].tissueSampleId).toBe('sample_148');
    });

    test('documented fragility: reverse the array order (lower id first) and the tie flips — buildZoneMap has no id-tiebreak of its own', () => {
        const { SM, CE } = loadModules();
        const soil = { id: 'Green 1', label: 'Green 1', date: '2025-01-15', notes: '', zoneType: 'Greens', values: { N: '150', P: '40', K: '200' } };
        const higherId = { id: 'sample_148', label: 'Green 1', date: '2026-01-15', notes: '', zoneType: 'Greens', values: { N: '5.00', P: '0.75', K: '1.20' } };
        const lowerId = { id: 'sample_147', label: 'Green 1', date: '2026-01-15', notes: '', zoneType: 'Greens', values: { N: '4.57', P: '0.62', K: '1.05' } };
        // Reversed vs. the test above: if the store ever received these out
        // of the server's own order, buildZoneMap would pick the FIRST one
        // encountered on the tie, not the higher id.
        seedSite(SM, { soil: { 'Green 1': soil }, tissue: { sample_147: lowerId, sample_148: higherId } });

        const entries = CE.enumerate('current');
        expect(entries[0].tissueSampleId).toBe('sample_147');
    });
});

describe('GH-372 — multi-zone sites: the export is zone-aware, Plan is not (documented scope difference, not a bug)', () => {
    // Live-verified against the real dev stack (Burns golf course, real zones
    // Green 1/Green 12/Green 15, one real fixture tissue sample added to
    // Green 1 dated earlier than the two real ones already on Green 12/
    // Green 15 — see this ticket's changelog entry for the exact rendered
    // numbers from both surfaces). Plan has no per-zone concept at all: it
    // resolves ONE tissue sample for the whole site and applies it to its one
    // site-wide programme. The Combined export resolves tissue independently
    // per zone. This is a real, structural scope difference that predates
    // GH-372 and is deliberately NOT changed here (see this ticket's
    // changelog/REVIEW-GH349-onward.md entries) — pinned as a description of
    // current, intended behaviour, not a regression guard against a bug.
    test('each zone gets its own tissue sample even though the zones carry different dates', () => {
        const { SM, CE } = loadModules();
        const soilGreen1 = { id: 'Green 1', label: 'Green 1', date: '2025-01-01', notes: '', zoneType: 'Greens', values: { N: '150', P: '40', K: '200' } };
        const soilGreen12 = { id: 'Green 12', label: 'Green 12', date: '2025-01-01', notes: '', zoneType: 'Greens', values: { N: '150', P: '40', K: '200' } };
        const tissueGreen1 = { id: 'sample_149', label: 'Green 1', date: '2025-03-01', notes: '', zoneType: 'Greens', values: { N: '3.80', P: '0.35', K: '1.60' } };
        const tissueGreen12 = { id: 'sample_120', label: 'Green 12', date: '2026-08-06', notes: '', zoneType: 'Greens', values: { N: '12', P: '12', K: '12' } };
        seedSite(SM, {
            soil: { 'Green 1': soilGreen1, 'Green 12': soilGreen12 },
            tissue: { sample_149: tissueGreen1, sample_120: tissueGreen12 },
        });

        const entries = CE.enumerate('current');
        const byLabel = {};
        entries.forEach((e) => { byLabel[e.sampleLabel] = e.tissueSampleId; });

        // Green 12's later date does NOT leak into Green 1's own entry, and
        // vice versa — each zone is self-contained.
        expect(byLabel['Green 1']).toBe('sample_149');
        expect(byLabel['Green 12']).toBe('sample_120');
    });
});

describe('GH-372 — site-selector-ui.js\'s auto-load fallback is now date-aware (regression for the position-based bug)', () => {
    // Pre-fix, reloadActiveSample()'s no-active-sample branch took
    // getSamples(dt)[0] -- plain array position, no date comparison at all.
    // It happened to behave correctly only because the server-sync path
    // always delivers samples pre-sorted lab_date DESC (SampleController::
    // index()) and the client store preserves that insertion order -- not
    // because this function itself was date-aware. This test constructs the
    // exact case that assumption doesn't cover (samples merged out of
    // date order) and would have failed against the pre-fix code (it would
    // have picked "sample_mid", the literal first key inserted).
    test('samples arriving in a deliberately non-date-sorted order still result in the chronologically-latest one becoming active', () => {
        const { SM, SS } = loadWithSiteSelector();
        seedSite(SM, {
            tissue: {
                sample_mid: { id: 'sample_mid', label: 'Green 1', date: '2025-06-01', notes: '', zoneType: 'Greens', values: { N: '3.50', P: '0.30', K: '1.90' } },
                sample_oldest: { id: 'sample_oldest', label: 'Green 1', date: '2024-01-01', notes: '', zoneType: 'Greens', values: { N: '2.00', P: '0.20', K: '1.00' } },
                sample_newest: { id: 'sample_newest', label: 'Green 1', date: '2026-01-15', notes: '', zoneType: 'Greens', values: { N: '4.57', P: '0.62', K: '1.05' } },
            },
        });

        expect(SM.getActiveSampleId('tissue')).toBeNull();
        SS.reloadActiveSample();
        expect(SM.getActiveSampleId('tissue')).toBe('sample_newest');
    });

    test('a genuine tie (equal dates) keeps whichever candidate the array holds first, same documented tiebreak shape as buildZoneMap', () => {
        const { SM, SS } = loadWithSiteSelector();
        seedSite(SM, {
            tissue: {
                sample_a: { id: 'sample_a', label: 'Green 1', date: '2026-01-15', notes: '', zoneType: 'Greens', values: { N: '4.57', P: '0.62', K: '1.05' } },
                sample_b: { id: 'sample_b', label: 'Green 1', date: '2026-01-15', notes: '', zoneType: 'Greens', values: { N: '5.00', P: '0.75', K: '1.20' } },
            },
        });
        SS.reloadActiveSample();
        expect(SM.getActiveSampleId('tissue')).toBe('sample_a');
    });

    test('single sample, no tie, no ordering question: still loads correctly (guards against an off-by-one in the new comparison loop)', () => {
        const { SM, SS } = loadWithSiteSelector();
        seedSite(SM, {
            tissue: { only_one: { id: 'only_one', label: 'Green 1', date: '2025-01-01', notes: '', zoneType: 'Greens', values: { N: '4.00', P: '0.40', K: '2.00' } } },
        });
        SS.reloadActiveSample();
        expect(SM.getActiveSampleId('tissue')).toBe('only_one');
    });
});
