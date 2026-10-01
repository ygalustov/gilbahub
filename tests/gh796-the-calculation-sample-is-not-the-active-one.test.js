'use strict';

/**
 * GH-796 (queue item 3vyu) — THE SAMPLE A CALCULATION IS ABOUT IS THE ONE THE SERVER NAMED, AND THE PAGE'S
 * OWN SELECTION IS LEFT ALONE.
 *
 * TWO QUESTIONS THAT LOOKED LIKE ONE. "Which sample has this visitor selected" is a fact about the screen in
 * front of them -- the switcher's caption, the tick in its list. "Which sample is this programme computed
 * from" is a fact about the SITE, and the answer belongs to the server: the latest by lab date, then sample
 * date, then row id. Eight places asked the first question where they needed the second: the nutrition
 * programme's tissue percentages and soil ppm, the Mulders ratios that choose products in the UK and in
 * Australia, the turf profile the Word document hands its engines, the run frame's own chooser when its
 * address named nothing, and -- by a second road -- the date stamped on the soil state, which comes from a
 * form the page fills from its active sample.
 *
 * THE OWNER'S CONDITION, in her words: "fix them all, only make sure that at that moment it is the sample
 * that goes into the calculation that is needed, and not the one active on the page, so that nothing on the
 * page breaks." So this set asserts BOTH halves: the calculation follows the server, and the page's own
 * answer is unchanged.
 *
 * MEASURED ON THE STAND BEFORE THE CHANGE, 21 sites: wherever a sample exists, the active one and the one
 * the server names are the SAME row -- soil on 10 sites, tissue on 4, and no site where they differ. So no
 * screen is expected to change, and the live comparison is what shows it. That agreement is also why a case
 * is needed here rather than there: a stand where the two never differ cannot tell the two questions apart.
 */

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { codeOf, lineOfIndex } = require('./lib/source-without-comments');
const { loadManager } = require('./lib/sample-form-bench');
const { giveItTheChooser } = require('./lib/sample-chooser');

const ROOT = path.join(__dirname, '..');
const ASSETS = path.join(ROOT, 'assets');

/**
 * THE PLACES THAT MAY STILL READ THE PAGE'S SELECTION, BY ADDRESS AND NOT BY COUNT.
 *
 * Twelve reads of the active sample are the visitor's own business: the switcher's caption and the tick in
 * its list, the selector's dropdown labels and what it loads into the form of `/hub`, the sample a lab
 * import opens, the zone a trend chart is attached to, and the three cards of the evidence panel. The owner's
 * condition was that these keep working, so they are listed here by FILE AND LINE: a calculation moved back
 * onto the page's selection adds an entry, and an interface place quietly moved off it takes one away. A
 * count would notice neither if they happened together.
 *
 * A LINE NUMBER AGES, and this case is what keeps it current: the first run of it reported
 * `nutrition-calendar.js:2550` declared and gone and `:2557` found and not declared -- the same read, moved
 * seven lines by this item's own edits to that file. That is the failure a count could not have shown.
 *
 * Three more reads are console lines and are listed with them, marked as such: the plan proposes writing the
 * calculation's sample into those too, and that is the coordinator's to decide -- so they are declared as
 * they stand rather than silently changed.
 */
const THE_PAGE_MAY_ASK = [
    'gaip-evidence-ui.js:84', 'gaip-evidence-ui.js:153', 'gaip-evidence-ui.js:232',
    'lab-report-parser.js:663',
    'nutrient-trend.js:1138',
    'nutrition-au-fertiliser-integration.js:608 (a console line)',
    'nutrition-calendar.js:850 (a console line)',
    'nutrition-calendar.js:2557 (a console line)',
    'sample-switcher-ui.js:315', 'sample-switcher-ui.js:364', 'sample-switcher-ui.js:490',
    'sample-switcher-ui.js:849',
    'site-selector-ui.js:181', 'site-selector-ui.js:240', 'site-selector-ui.js:346',
    /**
     * AND THE READS OF THE POINTER UNDER ITS SECOND NAME, each with what it does with it.
     *
     * `nutrition-program-inputs.js:1327` is the one calculation read still standing, and it is standing by a
     * question put to the owner rather than by oversight: the report has a third state, "records on file
     * that nobody selected", and that read is what decides it. With the server's answer in its place the
     * state cannot arise, so the report would compute where it used to say so -- a change to a sentence a
     * client reads. Measured: two cases in two suites turn on it.
     *
     * The other three carry the pointer as DATA: a site's own export, the whole-store transfer and the
     * settings backup all copy `allActive` into a file so that a restore can put a visitor back where they
     * were. Nothing is computed from it there.
     */
    'nutrition-program-inputs.js:1327 (a calculation read, held for the owner\'s answer)',
    'site-dashboard.js:181 (carried as data, a site export)',
    'site-data-transfer.js:111 (carried as data, the store transfer)',
    'site-data-transfer.js:111 (carried as data, the store transfer)',
    'site-data-transfer.js:111 (carried as data, the store transfer)',
];

/**
 * THE POINTER HAS A SECOND NAME, and the census looks for both.
 *
 * `getActiveSample`/`getActiveSampleId` is one way to ask which sample the visitor has open. The other is
 * `getAllSamples().allActive[siteId]`, and the item was measured with a search for the first name only --
 * by the analyst and then by me. A calculation read hiding under the second name was found by a case going
 * red rather than by either census: the water balance of the stored row took `allActive[site].water`, and
 * failing that sorted the browser's own copy of the store by date and took the newest, which is the
 * server's rule re-implemented where the database cannot be seen. So both names are counted here.
 *
 * The three places that carry the pointer as DATA -- a site's export, the whole-store transfer, the settings
 * backup -- are declared with the rest: they copy it, they do not compute from it.
 */
const POINTER_NAMES = [/getActiveSample(Id)?\s*\(/g, /allActive\s*\[/g];

/** Every read of the page's selection in `assets`, read as code and not as prose. */
function everyReadOfTheActiveSample() {
    const found = [];
    fs.readdirSync(ASSETS).filter((f) => f.endsWith('.js'))
        .filter((f) => !f.startsWith('gssh-') && f !== 'sample-manager.js')
        .forEach((f) => {
            const src = fs.readFileSync(path.join(ASSETS, f), 'utf8');
            let code;
            try { code = codeOf(src); } catch (e) { found.push(f + ': WOULD NOT PARSE'); return; }
            POINTER_NAMES.forEach((name) => {
                const re = new RegExp(name.source, 'g');
                let m;
                while ((m = re.exec(code)) !== null) found.push(f + ':' + lineOfIndex(src, m.index));
            });
        });

    return found.sort();
}

const SITE_LABEL = 'Site under test';
const SITE_A_ID = 'site_a';
const SITE_B_ID = 'site_b';
const SAMPLE_OF_A = { id: 'sample_910', serverId: 910, label: 'A\u2019s own record',
    rawData: { K: 40, Ca: 803, CEC: 5.9, pH: 6 } };
const SAMPLE_OF_B = { id: 'sample_911', serverId: 911, label: 'B\u2019s own record',
    rawData: { K: 88, Ca: 1200, CEC: 7.7, pH: 6.4 } };

const SAMPLE_THE_PAGE_HAS_OPEN = { id: 'sample_900', serverId: 900, label: 'The one on the screen',
    rawData: { K: 40, Ca: 803, CEC: 5.9, pH: 6 } };
const SAMPLE_THE_SERVER_NAMES = { id: 'sample_901', serverId: 901, label: 'The latest one',
    rawData: { K: 88, Ca: 1200, CEC: 7.7, pH: 6.4 } };

/** The sample manager, loaded the way a page loads it, with the store and the server it would find. */
function managerWith({ named, chooser }) {
    const asked = [];
    const sandbox = {
        console: { log() {}, warn() {}, error() {}, info() {}, debug() {} },
        setTimeout, clearTimeout, Date, Math, JSON, Object, Array, String, Number, Boolean, RegExp, Error,
        Map, Set, parseFloat, parseInt, isNaN, isFinite, Promise, encodeURIComponent, decodeURIComponent,
        localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
        CustomEvent: class { constructor(t, i) { this.type = t; this.detail = i && i.detail; } },
        fetch: (url) => {
            asked.push(String(url));

            return Promise.resolve({
                ok: true,
                json: () => Promise.resolve({ data: named === 'none' ? []
                    : [{ id: named, sample_type: 'soil' }] }),
            });
        },
    };
    sandbox.document = {
        readyState: 'complete',
        addEventListener() {}, removeEventListener() {}, dispatchEvent() { return true; },
        getElementById: () => null, querySelector: () => null, querySelectorAll: () => [],
        createElement: () => ({ style: {}, classList: { add() {}, remove() {} }, appendChild() {} }),
        body: { appendChild() {} },
    };
    sandbox.window = sandbox; sandbox.global = sandbox; sandbox.globalThis = sandbox; sandbox.self = sandbox;
    if (chooser) sandbox.gaip_namedSample = chooser;
    const ctx = vm.createContext(sandbox);
    ['sample-manager.js'].forEach((f) => {
        vm.runInContext(fs.readFileSync(path.join(ROOT, 'assets', f), 'utf8'), ctx, { filename: f });
    });
    const SM = ctx.GAIP_SampleManager;
    if (!SM) throw new Error('the sample manager did not load');
    /**
     * THE SITE IS CREATED BEFORE IT IS MADE CURRENT. Measured: `setActiveSite` refuses a site it does not
     * hold ("Site not found") and returns false, so a harness that only names one leaves the manager on
     * `default` -- where `calculationSample` asks the server nothing, because a default site is not a site.
     * Nothing failed loudly; the request simply never went out.
     */
    const siteId = SM.addSite(SITE_LABEL);
    if (!SM.setActiveSite(siteId)) throw new Error('the manager would not take the site ' + siteId);
    /**
     * AND THE ROW ID IS STAMPED THE WAY THE SERVER'S RESTORE STAMPS IT. Measured: `addSample` keeps `id`,
     * `label` and `values` and carries no `serverId` -- a sample added in the browser has no server identity
     * until it is saved and read back. So the identity is put on afterwards here, which is what the restore
     * path does, rather than pretending `addSample` does it.
     */
    [SAMPLE_THE_PAGE_HAS_OPEN, SAMPLE_THE_SERVER_NAMES].forEach((smp) => {
        SM.addSample('soil', { id: smp.id, label: smp.label, values: smp.rawData });
        const stored = SM.getSample('soil', smp.id);
        if (!stored) throw new Error('the store did not take ' + smp.id);
        stored.serverId = smp.serverId;
    });
    // The page's own act of opening a sample, through the manager's own door.
    SM.loadSample('soil', 'sample_900');

    return { SM, ctx, asked, siteId };
}

/** One turn of the event loop, so a request the function sent can answer. */
const letTheServerAnswer = () => new Promise((resolve) => setTimeout(resolve, 0));

/**
 * TWO SITES, EACH WITH ITS OWN SAMPLE, AND THE PAGE'S POINTER ON THE FIRST.
 *
 * This is the shape in which four suites failed while the site was not a parameter: a REPORT ABOUT SITE B
 * assembled while the page points at site A. The pointer never moves here -- that is the difference from the
 * case about switching sites, which measures the pointer being moved and the question being asked again.
 */
function twoSites({ named }) {
    const asked = [];
    const sandbox = {
        console: { log() {}, warn() {}, error() {}, info() {}, debug() {} },
        setTimeout, clearTimeout, Date, Math, JSON, Object, Array, String, Number, Boolean, RegExp, Error,
        Map, Set, parseFloat, parseInt, isNaN, isFinite, Promise, encodeURIComponent, decodeURIComponent,
        localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
        CustomEvent: class { constructor(t, i) { this.type = t; this.detail = i && i.detail; } },
        fetch: (url) => {
            asked.push(String(url));
            const forB = String(url).indexOf('site_id=' + SITE_B_ID) > -1;

            return Promise.resolve({
                ok: true,
                json: () => Promise.resolve({ data: [{ id: forB ? named.b : named.a, sample_type: 'soil' }] }),
            });
        },
    };
    sandbox.document = {
        readyState: 'complete',
        addEventListener() {}, removeEventListener() {}, dispatchEvent() { return true; },
        getElementById: () => null, querySelector: () => null, querySelectorAll: () => [],
        createElement: () => ({ style: {}, classList: { add() {}, remove() {} }, appendChild() {} }),
        body: { appendChild() {} },
    };
    sandbox.window = sandbox; sandbox.global = sandbox; sandbox.globalThis = sandbox; sandbox.self = sandbox;
    const ctx = vm.createContext(sandbox);
    vm.runInContext(fs.readFileSync(path.join(ASSETS, 'sample-manager.js'), 'utf8'), ctx,
        { filename: 'sample-manager.js' });
    const SM = ctx.GAIP_SampleManager;
    const a = SM.addSite('Site A');
    const b = SM.addSite('Site B');
    if (a !== SITE_A_ID || b !== SITE_B_ID) throw new Error('the manager keyed the sites as ' + a + '/' + b);
    [[a, SAMPLE_OF_A], [b, SAMPLE_OF_B]].forEach(([site, smp]) => {
        SM.setActiveSite(site);
        SM.addSample('soil', { id: smp.id, label: smp.label, values: smp.rawData });
        SM.getSample('soil', smp.id).serverId = smp.serverId;
    });
    // The page ends on A, with A's sample open: the pointer stays there for the whole case.
    SM.setActiveSite(a);
    SM.loadSample('soil', SAMPLE_OF_A.id);

    return { SM, asked };
}

/** Two water samples with different conductivities, so the row's own number says which one it read. */
const WATER_OF_A = { id: 'water_920', serverId: 920, rawData: { _label: 'A\u2019s tank', EC: '0.4', pH: '7.1' } };
const WATER_OF_B = { id: 'water_921', serverId: 921, rawData: { _label: 'B\u2019s bore', EC: '2.6', pH: '7.4' } };

/**
 * THE STORED ROW OF A RUN ABOUT SITE B, ASSEMBLED WHILE THE PAGE POINTS AT SITE A.
 *
 * The runner is loaded the way `tests/gh731` loads it, and the run is about `GAIP_HUB_CONFIG.activeSiteId`
 * -- site B -- while the sample manager stands on site A. The stub answers the calculation's question PER
 * SITE, so the row's conductivity says which sample the door actually read: B's 2.6 or A's 0.4. This is the
 * claim by VALUE that the census of place-names cannot make.
 */
function rowOfARunAboutB({ askedSite }) {
    const SRC = fs.readFileSync(path.join(ASSETS, 'hub-persistence.js'), 'utf8');
    const exportLine = 'global.GilbaPersistence = GilbaPersistence;';
    if (SRC.indexOf(exportLine) < 0) throw new Error('hub-persistence.js no longer exports the way this bench expects');
    const testSrc = SRC.replace(exportLine, exportLine
        + '\n    global.__test_cacheAnalysisResults = cacheAnalysisResults;');
    const sandbox = {
        console: { log() {}, warn() {}, error() {} },
        setTimeout: () => 0, clearTimeout() {}, setInterval: () => 0, clearInterval() {},
        document: {
            readyState: 'complete', addEventListener() {},
            getElementById: () => null, querySelector: () => null, querySelectorAll: () => [],
            body: { appendChild() {}, removeChild() {} },
        },
        location: { search: '?rerun=r&site=' + SITE_B_ID },
        URLSearchParams, Date, JSON, Math, Object, Array, String, Number,
        parseFloat, parseInt, isNaN, Promise,
        fetch: () => Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({}) }),
    };
    sandbox.window = sandbox; sandbox.global = sandbox; sandbox.globalThis = sandbox;
    // The run is about site B. The page's pointer is on site A and stays there.
    sandbox.GAIP_HUB_CONFIG = { activeSiteId: SITE_B_ID };
    sandbox.GAIP_STATE = { inputs: { soil: {}, water: {} }, computed: {} };
    // The product's own readers need the declared lab-reading names, exactly as `tests/gh731` gives them:
    // without the map every reading answers null, and the row would describe the bench, not the run.
    const { sm } = loadManager(JSON.parse(fs.readFileSync(path.join(ASSETS, 'lab-reading-names.json'), 'utf8')));
    const byKind = { [SITE_A_ID]: { water: WATER_OF_A }, [SITE_B_ID]: { water: WATER_OF_B } };
    const answered = [];
    sandbox.GAIP_SampleManager = {
        readingsOf: sm.readingsOf,
        labReadingOf: sm.labReadingOf,
        getActiveSiteId: () => SITE_A_ID,
        getActiveSample: (kind) => (byKind[SITE_A_ID][kind] || null),
        getSamples: (kind) => Object.values(byKind[SITE_A_ID][kind] ? { x: byKind[SITE_A_ID][kind] } : {}),
        calculationSample: (kind, siteId) => {
            answered.push(kind + '@' + String(siteId));

            return (byKind[siteId || SITE_A_ID] || {})[kind] || null;
        },
        getAllSamples: () => ({
            allSites: { [SITE_A_ID]: { water: { w: WATER_OF_A } }, [SITE_B_ID]: { water: { w: WATER_OF_B } } },
            allActive: { [SITE_A_ID]: { water: 'w' } }, allMeta: {}, sites: {},
        }),
    };
    sandbox.GaipOrchestrator = { noteSkipped() {}, recordProblem() {}, note() {}, getState: () => ({ computed: {} }) };
    const ctx = vm.createContext(sandbox);
    giveItTheChooser(ctx);
    vm.runInContext(testSrc, ctx, { filename: 'hub-persistence.js' });
    const snap = ctx.__test_cacheAnalysisResults();

    return { wb: (snap.computed && snap.computed.waterBalance) || null, answered, askedSite };
}

describe('GH-796 — the calculation\'s sample and the page\'s sample are different questions', () => {
    test('THE PLACES THAT ASK THE PAGE are exactly the declared ones, both ways', () => {
        const found = everyReadOfTheActiveSample();
        const declared = THE_PAGE_MAY_ASK.map((e) => e.replace(/ \(.*$/, '')).sort();
        const newOnes = found.filter((f) => declared.indexOf(f) < 0);
        const gone = declared.filter((d) => found.indexOf(d) < 0);

        process.stdout.write('[gh796] reads of the page\'s selection, found: ' + found.length
            + '\n[gh796]   ' + JSON.stringify(found)
            + (newOnes.length ? '\n[gh796]   NOT DECLARED: ' + JSON.stringify(newOnes) : '')
            + (gone.length ? '\n[gh796]   DECLARED AND GONE: ' + JSON.stringify(gone) : '') + '\n');

        expect({ notDeclared: newOnes, declaredAndGone: gone })
            .toEqual({ notDeclared: [], declaredAndGone: [] });
    });

    test('POSITIVE CONTROL: the page has one sample open, and the store holds the other', () => {
        const { SM } = managerWith({ named: 901 });
        const open = SM.getActiveSample('soil');

        process.stdout.write('[gh796] the page has open: ' + JSON.stringify(open && open.id)
            + ' | the store holds: ' + JSON.stringify(SM.getSamples('soil').map((s) => s.serverId)) + '\n');

        // Without this the claims below could be true of a store with one sample in it.
        expect(open && open.serverId).toBe(900);
        expect(SM.getSamples('soil').map((s) => s.serverId).sort()).toEqual([900, 901]);
    });

    test('THE CALCULATION follows the server, not the screen', async () => {
        const { SM, asked } = managerWith({ named: 901 });

        // Before the answer is back there is NO sample -- never the one on the screen.
        const atOnce = SM.calculationSample('soil');
        await letTheServerAnswer();
        const afterwards = SM.calculationSample('soil');

        process.stdout.write('[gh796] asked the server: ' + JSON.stringify(asked)
            + '\n[gh796]   before the answer: ' + JSON.stringify(atOnce && atOnce.id)
            + ' | after it: ' + JSON.stringify(afterwards && afterwards.id)
            + ' | the page still has: ' + JSON.stringify(SM.getActiveSample('soil').id) + '\n');

        expect(atOnce).toBeNull();
        expect(afterwards && afterwards.serverId).toBe(901);
        // The LIST of what was asked, not how long it is: two calls to one endpoint and one call to two
        // different ones are different facts, and a count cannot tell them apart (GH-746).
        expect(asked).toEqual(['/api/samples?sample_type=soil&site_id=site_under_test&limit=1']);
        // THE OWNER'S OTHER HALF: the page's own answer did not move.
        expect(SM.getActiveSample('soil').serverId).toBe(900);
    });

    test('THE SERVER SAYS THERE IS NONE: no sample, and still not the one on the screen', async () => {
        const { SM } = managerWith({ named: 'none' });
        SM.calculationSample('soil');
        await letTheServerAnswer();

        expect(SM.calculationSample('soil')).toBeNull();
        expect(SM.getActiveSample('soil').serverId).toBe(900);
    });

    test('IN A RUN FRAME the address answers, and the frame\'s three answers are honoured', () => {
        const rowItself = { id: 'sample_901', serverId: 901 };
        const cases = {
            'a row': () => rowItself,
            none: () => 'none',
            unknown: () => 'unknown',
            'not-found': () => 'not-found',
        };
        const answered = {};
        Object.keys(cases).forEach((name) => {
            const { SM, asked } = managerWith({ named: 901, chooser: cases[name] });
            const got = SM.calculationSample('soil');
            answered[name] = { sample: got ? got.id : null, askedTheServer: asked.length };
        });

        process.stdout.write('[gh796] in a run frame: ' + JSON.stringify(answered) + '\n');

        // Told a sample, that is the sample, and no request is made -- the address already answered.
        expect(answered['a row']).toEqual({ sample: 'sample_901', askedTheServer: 0 });
        // The other three are all "no sample for this run", and none of them is the active one.
        expect(answered.none.sample).toBeNull();
        expect(answered.unknown.sample).toBeNull();
        expect(answered['not-found'].sample).toBeNull();
    });

    test('A REPORT ABOUT SITE B, WITH THE PAGE POINTING AT SITE A, gets B\'s sample', async () => {
        const { SM, asked } = twoSites({ named: { a: 910, b: 911 } });

        // Asked about B while the manager stands on A -- the pointer is not moved anywhere in this case.
        SM.calculationSample('soil', SITE_B_ID);
        await letTheServerAnswer();
        const forB = SM.calculationSample('soil', SITE_B_ID);
        const openOnThePage = SM.getActiveSample('soil');

        process.stdout.write('[gh796] the page points at ' + JSON.stringify(SM.getActiveSiteId())
            + ' and has ' + JSON.stringify(openOnThePage && openOnThePage.id) + ' open'
            + '\n[gh796]   asked about ' + SITE_B_ID + ': ' + JSON.stringify(asked)
            + '\n[gh796]   answered with: ' + JSON.stringify(forB && { id: forB.id, serverId: forB.serverId })
            + '\n');

        // The site asked about is the site answered about.
        expect(forB && forB.serverId).toBe(911);
        expect(forB && forB.id).toBe(SAMPLE_OF_B.id);
        // And not the sample of the site the page happens to be on, which is the shape GH-459 takes here.
        expect(forB && forB.serverId).not.toBe(SAMPLE_OF_A.serverId);
        // The question went to the server about B, not about A.
        expect(asked.every((u) => u.indexOf('site_id=' + SITE_B_ID) > -1)).toBe(true);
        // The page keeps its own answer, which is the owner's other half.
        expect(SM.getActiveSiteId()).toBe(SITE_A_ID);
        expect(openOnThePage && openOnThePage.serverId).toBe(910);
    });

    test('THE ROW OF A RUN ABOUT B carries B\'s water, by its own number', () => {
        const { wb, answered } = rowOfARunAboutB({ askedSite: SITE_B_ID });

        process.stdout.write('[gh796] the run is about ' + SITE_B_ID + ', the page points at ' + SITE_A_ID
            + '\n[gh796]   the door asked: ' + JSON.stringify(answered)
            + '\n[gh796]   the row says: ' + JSON.stringify(wb && { ecw: wb.ecw, source: wb.source }) + '\n');

        expect(wb).not.toBeNull();
        // B's bore is 2.6 dS/m and A's tank is 0.4. The number is the claim: it says which sample was read.
        expect(wb.ecw).toBe(parseFloat(WATER_OF_B.rawData.EC));
        expect(wb.ecw).not.toBe(parseFloat(WATER_OF_A.rawData.EC));
        // And the door named the site it was about, rather than letting the answer come from the pointer.
        expect(answered).toContain('water@' + SITE_B_ID);
    });

    test('THE ANSWER BELONGS TO A SITE: switching sites forgets it', async () => {
        const { SM, asked } = managerWith({ named: 901 });
        SM.calculationSample('soil');
        await letTheServerAnswer();
        expect(SM.calculationSample('soil').serverId).toBe(901);

        SM.setActiveSite(SM.addSite('Another site'));
        const rightAfter = SM.calculationSample('soil');
        await letTheServerAnswer();

        process.stdout.write('[gh796] after switching sites the server was asked: '
            + JSON.stringify(asked) + '\n');

        // Nothing is carried over from the site before it: the question is asked again, and about the new
        // site. Asserted as the list of what was asked, so a second question about the OLD site would show.
        expect(rightAfter).toBeNull();
        expect(asked).toEqual([
            '/api/samples?sample_type=soil&site_id=site_under_test&limit=1',
            '/api/samples?sample_type=soil&site_id=another_site&limit=1',
        ]);
    });
});
