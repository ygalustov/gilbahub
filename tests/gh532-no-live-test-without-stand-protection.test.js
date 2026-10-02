'use strict';

/**
 * GH-532 — a live test may not exist without a remedy against moving the stand.
 *
 * WHY THIS EXISTS. GH-519 fitted seventeen live tests with one, and the same
 * day a new one was written without any — `gh530-uk-caption-measure-live`,
 * which presses Generate on a real site, so the programme persisted itself and
 * Test6 - UK's configuration had to be put back by hand. The remedies existed;
 * nothing REQUIRED them. One file put right returns us here on the next new
 * test, which is the whole reason this is a guard and not a correction.
 *
 * WHAT IT CLAIMS, and deliberately no more: every file in the live universe
 * either names one of the GH-519 remedies, or stands in EXEMPT with a reason
 * and a date by which the reason is revisited.
 *
 * WHAT IT DOES NOT CLAIM, said here because the first two drafts tried it and
 * failed: it does not decide for itself whether a file writes. A text predicate
 * for "makes a write" was written twice and was wrong twice — the first counted
 * the login click and flagged all 35 files, the second missed
 * `gh526-stage1-routes-live`, whose writes go through a `call(method, ...)`
 * helper rather than a literal `method: 'POST'`. A guard whose predicate is
 * unreliable would hand out false exemptions with its own authority. So the
 * question it asks is the one it can answer: is a remedy named here, yes or no.
 *
 * THE UNIVERSE COMES FROM THE TREE. `fs.readdirSync` over tests/e2e, not a list
 * in this file: a new live test is in the universe the moment it exists, which
 * is the only arrangement a new file cannot slip past.
 *
 * EXEMPTION KEYS ARE FILENAMES AND MUST MATCH EXACTLY ONE FILE. The GH-517
 * rule: a key matching nothing is a stale exemption still holding a door open,
 * and a key matching several is one reason standing in for several cases. Both
 * are red.
 */

const fs = require('fs');
const path = require('path');

const E2E_DIR = path.join(__dirname, 'e2e');

/** The GH-519 remedies, by the name a file would call them under. */
const REMEDIES = ['guardStand', 'captureConfigsOnce', 'restoreConfigs', 'fillOwnAnnualN'];

/**
 * Files in the live universe that carry no remedy, each with why and until.
 *
 * `until` is a date, not a mood: an exemption with no expiry is a decision
 * disguised as a delay. These thirteen predate this guard; they are a named
 * backlog, not an argument that they are safe.
 */
const EXEMPT = {
    'gh789-the-zero-schedule-goes-in-by-the-product-live.test.js': {
        why: 'ITS SUBJECT IS THE WRITE, and the write is a CONFIG the owner asked for. Queue item 7 puts the '
            + 'match and training schedule into the setup wizard, so the lock holds every page of a sports site '
            + 'that has none -- Settings, Data, /plan, the reports and the run frame, which means no Re-run and '
            + 'no export. Six sports sites of the stand had no schedule at all, and her decision of 30.09.2026 '
            + 'is that they receive nought matches and nought sessions BY THE PRODUCT\'S OWN ROUTE rather than '
            + 'by a write to the database -- "so that I have definitely not touched anything". `guardStand` '
            + 'holding the PATCH would hold the very thing she asked for. It touches only the sites handed in '
            + 'through `GILBA_E2E_GH789_SITES`, sends the same request Settings sends, and carries its own '
            + 'protection instead of the remedy: it refuses to overwrite a site that already holds a schedule, '
            + 'stops at the FIRST site both when the route refuses and when it accepts while storing nothing, '
            + 'and reads the last row id of every site before and after so a site outside the window that moved '
            + 'is red. Measured on 30.09.2026: six requests, six 200s, six configs holding exactly two keys, '
            + 'and no row anywhere on the stand moved.',
        until: '2026-10-15',
    },
    'gh787-wear-one-figure-on-the-stand-live.test.js': {
        why: 'ITS SUBJECT IS THE WRITE, and the write is a stored row. One engine had two runners with two '
            + 'assemblies of its inputs, and the recovery window they produced differed at 10 of 10 sites '
            + 'carrying both figures -- 17 days against 7 at one, 28 against 12 at another. Whether a REAL run '
            + 'now produces ONE window, and whether it is the figure the disagreement pointed at rather than a '
            + 'third one, can only be answered by a run whose row lands, so `guardStand` holding every POST to '
            + '`/api/analysis-cache` would hold the measurement itself. It presses Re-run on the two sites the '
            + 'window was opened for and on no other, exports through the product\'s own picker with ONE '
            + 'sample of one site ticked, and carries its own protection instead of the remedy: its last case '
            + 'reads the last row id of EVERY site with a stored row, reddens if one outside that list moved, '
            + 'and requires the two named sites to have GAINED a row rather than had one rewritten. It writes '
            + 'no data of its own and edits nothing -- it presses the product\'s buttons and reads.',
        until: '2026-10-15',
    },
    'gh782-the-aa-ranges-on-the-stand-live.test.js': {
        why: 'ITS SUBJECT IS THE WRITE, for the same reason as the file below. Every site set to ammonium '
            + 'acetate stored its nutrient bands from the texture-only fallback instead of the Hill Labs '
            + 'certificate -- potassium 50.0-116.0 where the certificate says 78.2-195.5 -- because the range '
            + 'overlay read the species off the `/hub` form rather than off the site. Whether a REAL run now '
            + 'resolves the code from the site\'s settings can only be answered by a run whose row lands, and '
            + '`guardStand` holds every POST to `/api/analysis-cache`, which is the measurement itself. It '
            + 'presses Re-run ONLY on the site handed in through `GILBA_E2E_GH782_SITES`, and it carries its '
            + 'own protection instead of the remedy: its last case reads the last row id of EVERY site with a '
            + 'stored row, reddens if one outside that list moved, and asserts that the pressed site GAINED a '
            + 'row rather than having one rewritten. It writes no data of its own and edits nothing.',
        until: '2026-10-15',
    },
    'gh777-the-tissue-and-the-screen-live.test.js': {
        why: 'ITS SUBJECT IS THE WRITE, and the write is a stored row. The tissue section was empty in 13 '
            + 'of 13 rows with no cause recorded; queue item 4 declares the requirement and gates the '
            + 'cascade on the sample the run was given, and whether a REAL run names its sample and whether '
            + 'the sentence reaches a card can only be answered by a run whose row lands -- `guardStand` '
            + 'holds every POST to `/api/analysis-cache`, which is the measurement itself. It presses '
            + 'Re-run ONLY on the sites handed in through `GILBA_E2E_GH777_SITES`, so it reaches no site '
            + 'the window was not opened for, and it carries its own protection instead of the remedy: its '
            + 'last case reads the last row id of EVERY site with a stored row and reddens if one outside '
            + 'that list moved. It writes no data of its own and edits nothing: it presses the product\'s '
            + 'own button and reads.',
        until: '2026-10-15',
    },
    'gh727-the-weed-set-on-the-stand-live.test.js': {
        why: 'ITS SUBJECT IS THE WRITE, and the write is a stored row. `/plan` draws the row, so '
            + 'whether a client still sees the old set of weeds after the repair can only be answered '
            + 'by a run whose row lands -- `guardStand` holds every POST to `/api/analysis-cache`, '
            + 'which is the one thing under measurement here. It presses Re-run ONLY on the sites '
            + 'handed in through `GILBA_E2E_GH727_SITES`, so a run reaches no site the window was not '
            + 'opened for, and it carries its own protection instead of the remedy: its last case '
            + 'reads the last row id of EVERY site with a stored row and reddens if one outside that '
            + 'list moved. Measured that way on 29.09.2026 -- eight sites named, seven rows written, '
            + 'and the snapshot of the rest identical before and after.',
        until: '2026-10-15',
    },
    'gh769-the-wizard-saves-the-construction-live.test.js': {
        why: 'ITS SUBJECT IS THE WRITE, and the write is the setup wizard saving a construction. The '
            + 'report it answers is that the value chosen in the wizard was not in the database '
            + 'afterwards, so holding the save would hold the very thing under measurement -- the '
            + 'same reason the wizard test beside it is exempt. It CREATES ITS OWN SITE through the '
            + 'product\'s Add site form and walks the wizard on that site alone; it edits no site it '
            + 'did not create, and the protected sites are not touched. What it found is recorded '
            + 'rather than left in the run: the wizard does save the construction, and Settings '
            + 'rendered the stored value as an empty field because its own list does not offer it.',
        until: '2026-10-15',
    },
    'gh671-the-wizard-saves-a-sports-site-live.test.js': {
        why: 'ITS PURPOSE IS THE WRITE, and the write is a client setting up a site. The item it '
            + 'closes is about a person walking the onboarding wizard and the site not being '
            + 'saved, and its own record carries the gap verbatim: what the person sees was '
            + 'confirmed only by the code of the `alert`, never by observation. `guardStand` '
            + 'would hold the very save under measurement. It CREATES ONE NEW SITE through the '
            + 'product\'s own Add site form and runs the wizard on it, so nothing existing is '
            + 'edited -- the wizard patches the ACTIVE site, and the eight live provisional '
            + 'sites would have had real configs overwritten. The press was authorised and '
            + 'announced, both outcomes were named in the file first, and every native dialog is '
            + 'captured rather than auto-dismissed, because a silent failure is the subject.',
        until: '2026-10-15',
    },
    'gh661-the-held-write-names-its-site-live.test.js': {
        why: 'IT HOLDS EVERY WRITE ITSELF, not only the patterns this guard knows. It presses '
            + 'Re-run once in a frame whose `?site=` names one site while the user\'s pointer '
            + 'stands on another, to read the ADDRESS and the CONTENTS out of a request that is '
            + 'captured and answered locally instead of being sent. `guardStand` does not cover '
            + '`/api/analysis-cache`, which is the one request this exists to read, so a route of '
            + 'its own holds every non-GET and the row count is asserted unchanged on both sides '
            + 'before anything else is claimed. The press was authorised and announced, both '
            + 'outcomes were named in the file first, and no sample, config or row is edited.',
        until: '2026-10-15',
    },
    'gh655-the-water-sample-list-on-screen-live.test.js': {
        why: 'ITS PURPOSE IS THE PRESS. It answers the owner\'s question about what a person sees '
            + 'when another water sample is chosen on the water balance page, and choosing one is '
            + 'not a display change: the page turns the selection into a Re-run by itself. '
            + '`guardStand` would hold the very write the measurement is about, and a green run '
            + 'would mean the selection never reached the calculation. The press was authorised and '
            + 'announced, both outcomes were named in the file before it ran, and the row count was '
            + 'snapshotted in the database on both sides. It edits no sample and deletes none; it '
            + 'touches the active-site pointer through the product\'s own switcher and nothing else.',
        until: '2026-10-15',
    },
    'gh591-restore-a-row-live.test.js': {
        why: 'ITS PURPOSE IS THE WRITE. It presses Re-run once, for one named site, to restore a '
            + 'stored row whose numbers were computed before the sample arrived (GH-532, item 2) — so '
            + '`guardStand` would hold back the only POST the file exists to make, and a green run '
            + 'would mean nothing happened. It is not a regression test and it is never run '
            + 'unannounced: every press is put to the coordinator beforehand, one at a time, with '
            + 'both outcomes named first and the row snapshotted before and after in the database. '
            + 'Bounded by GILBA_E2E and GILBA_RESTORE_SITE; it touches no configuration and no '
            + 'sample, only the active-site pointer through the product\'s own switcher.',
        until: '2026-10-15',
    },
    'gh395-nz-methodology-gate-live.test.js': {
        why: 'Reads the rendered Settings options and switches the active site, restoring the '
            + 'pointer in afterAll. Not assessed against the GH-519 remedies.',
        until: '2026-10-15',
    },
    'gh404-settings-location-required-live.test.js': {
        why: 'Drives the Settings location form. Writes, and carries no remedy.',
        until: '2026-10-15',
    },
    'gh407-wizard-nz-live.test.js': {
        why: 'Renders a wizard step into a detached host; touches no site by design.',
        until: '2026-10-15',
    },
    'gh430-samples-sync-no-snapshot-delete-live.test.js': {
        why: 'Not assessed. Its subject is what the server does with a push.',
        until: '2026-10-15',
    },
    'gh433-glossary-live.test.js': {
        why: 'Reads the glossary of a rendered document. No assessed write path.',
        until: '2026-10-15',
    },
    'gh439-config-reset-live.test.js': {
        why: 'Creates and removes its OWN site — the GH-519 remedy of first resort, predating '
            + 'the helpers and not expressed through them.',
        until: '2026-10-15',
    },
    'gh807-the-stored-name-after-a-run-live.test.js': {
        why: 'Creates its OWN site and removes it again -- the remedy of first resort of GH-519, and here '
            + 'the only road: the site that holds the application the owner reported is on the protected '
            + 'list, and a run writes an analysis row, which is a change to her data (the coordinator\'s '
            + 'refusal of 02.10.2026). The case IS a run, so `guardStand` -- which holds every site-state '
            + 'write and answers 200 -- would leave it asserting nothing.',
        until: '2026-10-15',
    },
    'gh805-a-sample-for-the-live-edit-live.test.js': {
        why: 'Creates its OWN site and removes it again -- the remedy of first resort of GH-519, and here '
            + 'it is also the only road there is: the two stand sites that hold the samples this check '
            + 'needs are both held shut by the setup lock for want of a soil texture, and giving one a '
            + 'texture is a change to a stand site that belongs to the owner. The site is made by one run '
            + 'and taken away by a second (`GH805_REMOVE=<id>`), because the coordinator\'s own edit in the '
            + 'Edit window happens between them; `guardStand` would hold the very writes the fixture is.',
        until: '2026-10-15',
    },
    'gh801-the-zone-type-is-required-live.test.js': {
        why: 'Creates and removes its OWN site, the same remedy of first resort as gh439 and gh797 above, '
            + 'and here it is also the coordinator\'s decision of 01.10.2026 about which site to use: the '
            + 'stand site with sixteen zones is on the protected list, and typing its zones to watch the '
            + 'tab unlock would be doing the owner\'s own manual work on her data. The case IS the writes '
            + '— zones created from the Data road, a save refused, one save that types them all — so '
            + '`guardStand` would leave it asserting nothing. Its site is made in `beforeAll` and deleted '
            + 'in `afterAll`, and the account pointer is put back.',
        until: '2026-10-15',
    },
    'gh797-the-texture-is-required-live.test.js': {
        why: 'Creates and removes its OWN site, the same remedy of first resort as gh439 above, and for '
            + 'the same reason it is not expressed through the helpers: the case IS the writes — the setup '
            + 'wizard saving a texture and a Settings save being refused — so `guardStand`, which holds '
            + 'every site-state write and answers 200, would leave it asserting nothing. Its site is made '
            + 'in `beforeAll` and deleted in `afterAll`, and the account pointer is put back.',
        until: '2026-10-15',
    },
    'gh458-gp-palette-live.test.js': {
        why: 'Reads colours off rendered pages. No assessed write path.',
        until: '2026-10-15',
    },
    'gh459-cross-site-inputs-live.test.js': {
        why: 'Twelve control presses and five non-GET calls. Writes, and carries no remedy.',
        until: '2026-10-15',
    },
    'gh490-soil-by-id-live.test.js': {
        why: 'Not assessed. Reads a resolver by id.',
        until: '2026-10-15',
    },
    'gh492-anr-whose-numbers-live.test.js': {
        why: 'Warms climate and reads per-site numbers; three control presses. Not assessed.',
        until: '2026-10-15',
    },
    'gh505-the-press-answers-live.test.js': {
        why: 'Carries a narrow interception of its own (GH-518, page.route) rather than the '
            + 'shared helpers. The remedy is there; the name is not.',
        until: '2026-10-15',
    },
    'gh526-stage1-routes-live.test.js': {
        why: 'Creates one sample and deletes it through the product\'s own route. It leaves the '
            + 'soft-deleted row behind, which is a trace, and that is not yet remedied.',
        until: '2026-10-15',
    },
    'review-sample-delete-resurrection-live.test.js': {
        why: 'Not assessed. A review probe kept for its record.',
        until: '2026-10-15',
    },
    'store-shapes-live.test.js': {
        why: 'Compares store shapes against API responses. No assessed write path.',
        until: '2026-10-15',
    },
};

/** Every live file in the tree, found rather than listed. */
function liveFiles() {
    return fs.readdirSync(E2E_DIR)
        .filter((f) => /live.*\.test\.js$/.test(f) || /-live\.test\.js$/.test(f))
        .sort();
}

/** What is actually in a file: which remedies it names, and how many routes it intercepts. */
function inspect(file) {
    const src = fs.readFileSync(path.join(E2E_DIR, file), 'utf8');
    const code = src.split('\n').filter((l) => !/^\s*(\*|\/\/|\/\*)/.test(l)).join('\n');
    const named = REMEDIES.filter((r) => new RegExp('\\b' + r + '\\s*\\(').test(code));
    const intercepts = (code.match(/\.route\(/g) || []).length;
    return { file, named, intercepts, protectedByName: named.length > 0 };
}

describe('GH-532 — no live test without a remedy against moving the stand', () => {
    const files = liveFiles();
    const seen = files.map(inspect);

    test('the census: what the walk found, file by file', () => {
        expect.hasAssertions();
        // Printed from what the walk OBSERVED, not from the lists above: a
        // census that cannot differ between runs is a print-out of the
        // configuration, not an observation of the tree.
        const withRemedy = seen.filter((s) => s.protectedByName);
        const without = seen.filter((s) => !s.protectedByName);
        const out = [''];
        out.push('  live files found in tests/e2e: ' + files.length);
        out.push('  carrying a named remedy:       ' + withRemedy.length);
        out.push('  without one:                   ' + without.length
            + ' (exempted: ' + Object.keys(EXEMPT).length + ')');
        out.push('');
        seen.forEach((s) => {
            out.push('   ' + (s.protectedByName ? '+' : ' ') + ' ' + s.file
                + (s.named.length ? '  [' + s.named.join(', ') + ']' : '  [none]')
                + (s.intercepts ? '  route() x' + s.intercepts : ''));
        });
        process.stdout.write(out.join('\n') + '\n');
        expect(files.length).toBeGreaterThan(0);
        expect(withRemedy.length + without.length).toBe(files.length);
    });

    test('every live file either names a remedy or is exempted', () => {
        expect.hasAssertions();
        const naked = seen
            .filter((s) => !s.protectedByName)
            .filter((s) => !Object.prototype.hasOwnProperty.call(EXEMPT, s.file))
            .map((s) => s.file);
        naked.forEach((f) => process.stdout.write('[gh532] NO REMEDY, NO EXEMPTION: ' + f + '\n'));
        expect(naked).toEqual([]);
    });

    test('every exemption key matches exactly one file in the tree', () => {
        expect.hasAssertions();
        const bad = [];
        Object.keys(EXEMPT).forEach((key) => {
            const hits = files.filter((f) => f === key);
            if (hits.length !== 1) bad.push({ key: key, matched: hits.length });
        });
        bad.forEach((b) => process.stdout.write('[gh532] EXEMPTION KEY ' + JSON.stringify(b) + '\n'));
        expect(bad).toEqual([]);
    });

    test('no exemption is held by a file that has since gained a remedy', () => {
        // The other direction: an exemption outliving its reason is a door left
        // open, and nothing else would notice it closing.
        expect.hasAssertions();
        const stale = seen
            .filter((s) => s.protectedByName)
            .filter((s) => Object.prototype.hasOwnProperty.call(EXEMPT, s.file))
            .map((s) => s.file);
        stale.forEach((f) => process.stdout.write('[gh532] EXEMPTION NO LONGER NEEDED: ' + f + '\n'));
        expect(stale).toEqual([]);
    });

    test('every exemption carries a reason and a date to revisit it', () => {
        expect.hasAssertions();
        const bad = [];
        Object.entries(EXEMPT).forEach(([key, e]) => {
            if (!e.why || e.why.length < 20) bad.push({ key, what: 'no usable reason' });
            if (!/^\d{4}-\d{2}-\d{2}$/.test(e.until || '')) bad.push({ key, what: 'no until date' });
        });
        expect(bad).toEqual([]);
    });

    test('positive control: a file known to carry a remedy is found to carry one', () => {
        // If this stops being found, the detector has stopped detecting,
        // whatever the counts above say.
        expect.hasAssertions();
        const member = seen.filter((s) => s.file === 'gh401-delivery-volumes-live.test.js')[0];
        expect(member).toBeDefined();
        process.stdout.write('[gh532] positive control gh401: ' + JSON.stringify(member.named) + '\n');
        expect(member.protectedByName).toBe(true);
        expect(member.named).toEqual(expect.arrayContaining(['captureConfigsOnce', 'restoreConfigs']));
    });

    test('negative control: a file known to carry none is found to carry none', () => {
        expect.hasAssertions();
        const nonMember = seen.filter((s) => s.file === 'gh433-glossary-live.test.js')[0];
        expect(nonMember).toBeDefined();
        process.stdout.write('[gh532] negative control gh433: ' + JSON.stringify(nonMember.named) + '\n');
        expect(nonMember.protectedByName).toBe(false);
        expect(nonMember.named).toEqual([]);
    });

    test('the file this guard was written for now carries a remedy', () => {
        // gh530 is the case that produced this guard. It is asserted by name so
        // that "the guard is green" cannot mean "the guard stopped looking at
        // the file it exists because of".
        expect.hasAssertions();
        const subject = seen.filter((s) => s.file === 'gh530-uk-caption-measure-live.test.js')[0];
        expect(subject).toBeDefined();
        process.stdout.write('[gh532] subject gh530: ' + JSON.stringify(subject.named) + '\n');
        expect(subject.protectedByName).toBe(true);
        expect(Object.prototype.hasOwnProperty.call(EXEMPT, subject.file)).toBe(false);
    });
});
