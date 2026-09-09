/**
 * GH-375 (review fix 1) -- the exact null-`lab_date` tie case from the
 * review, exercised through the REAL client-side coalescing code, not the
 * pre-coalesced `.date` shortcut every existing GH-372 test uses (see
 * tests/gh372-tissue-sample-selection-consistency.test.js's own
 * seedSite()/OLDER/NEWER fixtures -- they set `.date` directly, bypassing
 * sample-persistence.js's `sample.lab_date || sample.sample_date || null`
 * coalescing entirely).
 *
 * Background: PageController::topbarData() resolves its own tissue-sample
 * choice with `orderByRaw('COALESCE(lab_date, sample_date) DESC')
 * ->orderByDesc('id')`. SampleController::index() (the endpoint
 * assets/sample-persistence.js's fetchSamplesFromServer() and
 * site-selector-ui.js's reloadActiveSample() fallback both ultimately
 * consume) pre-fix sorted on the RAW `lab_date` column instead
 * (`orderByDesc('lab_date')->orderByDesc('id')`) -- MySQL sorts NULLs last
 * on DESC, so a sample with only a `sample_date` landed behind every sample
 * carrying any `lab_date`, regardless of true chronological order. On a
 * genuine tie (same effective date, one sample via `lab_date`, the other
 * via `sample_date` only), that flipped the array order `index()` returned
 * relative to `topbarData()`'s own `id DESC` tiebreak --
 * `reloadActiveSample()`'s exact-date-tie fallback (GH-372) trusts array
 * order on a tie, so it could disagree with what Plan itself resolved.
 *
 * See app/tests/Feature/GH375SampleOrderingTest.php for the same tie
 * pinned server-side (index() vs topbarData() directly). This file pins the
 * client side: given the array order the NOW-FIXED index() actually
 * returns for this tie, does the real sample-persistence.js sync code
 * (coalescing raw lab_date/sample_date into `.date`) plus the real
 * site-selector-ui.js fallback land on the same sample topbarData() would?
 */

'use strict';

const vm = require('vm');
const fs = require('fs');
const path = require('path');

// ---------------------------------------------------------------------------
// Real sample-persistence.js sync-loop extraction -- same technique as
// tests/gh264-sample-snapshot-backfill.test.js's own extractSyncBlock()/
// runSync(), reused here rather than reimplemented so this test exercises
// the actual coalescing statement (`sample.lab_date || sample.sample_date
// || null`), not a copy of it that could silently drift from the real code.
// ---------------------------------------------------------------------------
function extractSyncBlock() {
    const src = fs.readFileSync(path.join(__dirname, '../assets/sample-persistence.js'), 'utf8');
    const start = src.indexOf('var restored = 0;');
    const callPos = src.indexOf('SM.restoreFromPersistence(serverSnap);', start);
    const closeBrace = src.indexOf('}', callPos); // closes `if (restored > 0) {`
    return src.slice(start, closeBrace + 1);
}

function runRealSync(samples) {
    const block = extractSyncBlock();
    let restoredPayload = null;
    const sandbox = {
        SM: {
            getAllSamples: () => ({ allSites: {}, sites: {} }),
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

// ---------------------------------------------------------------------------
// Real sample-manager.js + site-selector-ui.js, loaded the same DOM-stubbed
// way tests/gh372-tissue-sample-selection-consistency.test.js's own
// loadModules()/loadWithSiteSelector() do (see that file's header comment
// for the fake-timers/DOM-stub rationale -- identical convention, repeated
// here per that file's own note that this pattern is per-file, not shared).
// ---------------------------------------------------------------------------
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

function loadWithSiteSelector() {
    jest.useFakeTimers();
    jest.resetModules();
    stubDom();
    require('../assets/zone-key.js');
    require('../assets/sample-manager.js');
    require('../assets/site-selector-ui.js');
    return { SM: global.window.GAIP_SampleManager, SS: global.window.GilbaSiteSelector };
}

afterEach(() => {
    jest.useRealTimers();
});

const SITE_ID = 'gh375-null-lab-date-site';

describe('GH-375 -- null-lab_date exact tie, through the real coalescing code and the real client fallback', () => {
    // Sample X: a real lab_date. Sample Y: the SAME effective date, but only
    // via sample_date (lab_date NULL) -- a genuine tie once coalesced.
    // Y's id (200) is deliberately higher than X's (100), matching
    // PageController::topbarData()'s `id DESC` tiebreak on this tie (see
    // GH375SampleOrderingTest::test_null_lab_date_exact_tie_breaks_on_id_desc_same_as_topbar_data()
    // for the same scenario pinned server-side).
    const sampleX = {
        site_id: SITE_ID, sample_type: 'tissue', id: 100, client_uid: null,
        lab_date: '2026-01-15', sample_date: '2026-01-15',
        payload: { N: '3.00', P: '0.30', K: '2.00' }, notes: '',
    };
    const sampleY = {
        site_id: SITE_ID, sample_type: 'tissue', id: 200, client_uid: null,
        lab_date: null, sample_date: '2026-01-15',
        payload: { N: '4.57', P: '0.62', K: '1.05' }, notes: '',
    };

    test('sample-persistence.js\'s real sync coalesces both to the SAME .date, regardless of which column supplied it', () => {
        const restored = runRealSync([sampleY, sampleX]);
        const tissue = restored.allSites[SITE_ID].tissue;
        expect(tissue.sample_200.date).toBe('2026-01-15'); // from sample_date (lab_date null)
        expect(tissue.sample_100.date).toBe('2026-01-15'); // from lab_date
    });

    test('given the FIXED index() array order (id DESC on the tie -- Y before X), the real client fallback lands on Y, the same sample topbarData() picks', () => {
        // This is the array order SampleController::index() now returns
        // (GH-375): COALESCE(lab_date, sample_date) DESC, id DESC -- on this
        // exact tie, the higher-id sample (Y, 200) sorts first.
        const restored = runRealSync([sampleY, sampleX]);

        const { SM, SS } = loadWithSiteSelector();
        SM.restoreFromPersistence(Object.assign({}, restored, {
            currentSite: SITE_ID, allActive: {}, allMeta: {},
        }));

        expect(SM.getActiveSampleId('tissue')).toBeNull();
        SS.reloadActiveSample();
        expect(SM.getActiveSampleId('tissue')).toBe('sample_200');
    });

    test('documented pre-fix divergence: the OLD raw-lab_date-DESC order (NULLs last, X before Y) would have made the client fallback disagree with topbarData()', () => {
        // Pre-fix, orderByDesc('lab_date') put Y (lab_date NULL) behind X
        // (a real lab_date) regardless of true chronological order -- MySQL
        // sorts NULLs last on DESC. This is the array order that old query
        // would have produced for this exact tie.
        const restored = runRealSync([sampleX, sampleY]);

        const { SM, SS } = loadWithSiteSelector();
        SM.restoreFromPersistence(Object.assign({}, restored, {
            currentSite: SITE_ID, allActive: {}, allMeta: {},
        }));

        SS.reloadActiveSample();
        // The client fallback's exact-date-tie rule keeps whichever
        // candidate it encounters FIRST in the array -- with the old order,
        // that's X, disagreeing with topbarData()'s id-DESC choice of Y.
        // This is exactly the divergence GH-375 closes by fixing index()'s
        // sort at the root, not on the client.
        expect(SM.getActiveSampleId('tissue')).toBe('sample_100');
    });
});
