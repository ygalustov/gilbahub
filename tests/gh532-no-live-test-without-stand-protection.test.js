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
