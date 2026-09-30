/**
 * GH-776 (queue item 3vt) — A SITE WITH NO SCHEDULE CARRIES NO WEAR LOAD, AND NOT SOMEBODY ELSE'S.
 *
 * The hidden form of the old hub hard-codes two matches of an hour and a half and three training
 * sessions of the same, and the run's wear builder fell back to reading it whenever a site had no
 * schedule of its own (`b35fix296`). Measured on the stand before the repair: TEN sites of thirteen
 * carried `wearRecovery.effectiveLoad.totalEffectiveHours` 5.25 with "Soccer (matches)" first in the
 * breakdown -- seven of them golf courses and one a lawn -- and 5.25 is those defaults exactly:
 * 2 x 1.5 = 3 for matches, 3 x 1.5 = 4.5 for training at half weight, 3 + 2.25.
 *
 * The owner's decision of 29.09.2026: "football should not be on golf", and the figures of those sites
 * change because of it. Only `Test5 - NZ` has a schedule on the server, and it says nought matches, so
 * the other nine are left with NO load rather than a smaller one. Nothing is substituted.
 *
 * THE ROOT DEPTH IS NOT PART OF THIS, and it has a case of its own below rather than a promise in a
 * comment: its default of 100 lives in the same form and stays, by her separate decision of the same
 * day. This file would redden if it went.
 */
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');

const ORCH = read('assets/hub-orchestrator.js');
const FORM_JS = read('assets/wear-recovery-integration.js');
const FORM_BLADE = read('app/resources/views/partials/legacy-hub-markup.blade.php');

/** The four fields that describe a week of traffic, and the homes that declare them. */
const WEAR_FIELDS = ['gaip-matches-week', 'gaip-match-duration', 'gaip-sessions-week', 'gaip-session-duration'];
const HOMES = [['assets/wear-recovery-integration.js', FORM_JS],
    ['app/resources/views/partials/legacy-hub-markup.blade.php', FORM_BLADE]];

describe('GH-776 — no schedule, no wear load', () => {
    test('neither home gives a week of traffic a default, and the census prints what it looked at', () => {
        const carrying = [];
        HOMES.forEach(([where, src]) => {
            WEAR_FIELDS.forEach((cls) => {
                const declared = new RegExp('class="' + cls + '"([^>]*)').exec(src);
                const has = declared ? / value="/.test(declared[1]) : null;
                process.stdout.write('[gh776] ' + where + ' | ' + cls + ' | declared '
                    + JSON.stringify(!!declared) + ' | carries a default ' + JSON.stringify(has) + '\n');
                // Declared and still carrying a value is the defect; not declared at all would mean
                // this census has stopped looking at its subject, so both are named.
                expect(declared).not.toBeNull();
                if (has) carrying.push(where + ' | ' + cls);
            });
        });

        expect(carrying).toEqual([]);
    });

    /**
     * HER SEPARATE DECISION, ITS OWN CASE. "Let the root depth keep the default it has always been
     * computed with; we will look at that separately." It sits in the same form as the four above and
     * is read with the same fallback, so nothing but a case keeps the two apart.
     */
    test('the root depth keeps its default of 100, in the form and in both readers', () => {
        const inForm = /class="gaip-root-depth"([^>]*)/.exec(FORM_JS);
        process.stdout.write('[gh776] the root depth field declares: ' + JSON.stringify(inForm && inForm[1].trim()) + '\n');

        expect(inForm).not.toBeNull();
        expect(inForm[1]).toContain('value="100"');
        /**
         * GH-787 (queue item 3vy) — THE READER THAT CARRIED THAT DEFAULT IS GONE, and the field is not.
         *
         * `safeNum(root.querySelector('.gaip-root-depth'), 100)` lived in `readWearRecoveryState`, the
         * cascade's own assembly of the wear engine's inputs. The engine has one runner now, and the
         * orchestrator's assembly reads the root depth from the site's config, at the path Settings stores it
         * under (`traffic.schedule.rootDepth`) — with no default, so a site that entered none carries none.
         *
         * The owner's decision about the FIELD's own default of 100 is untouched: the markup still declares
         * it, which the assertion above holds, and `hub-tissue-v3.js` still reads that field for the page.
         * What is asserted here instead is that the removed reader took its default with it rather than
         * leaving a second one behind.
         */
        expect(FORM_JS).not.toContain("safeNum(root.querySelector('.gaip-root-depth'), 100)");
        expect(FORM_JS).not.toContain('function readWearRecoveryState');
        expect(read('assets/hub-tissue-v3.js')).toContain('.gaip-root-depth');
        // And the assembly that survives takes it from the site, with no number of its own.
        const builderAt = ORCH.indexOf('function buildWearRecoveryInputs()');
        const builderBody = ORCH.slice(builderAt, ORCH.indexOf('\n  }', builderAt));
        expect(builderBody).toContain('cfgSchedule.rootDepth');
        expect(builderBody).not.toMatch(/rootDepth[^\n]*\|\|\s*100/);
    });

    test('the wear builder does not read the form when a site has no schedule', () => {
        const at = ORCH.indexOf('function buildWearRecoveryInputs()');
        expect(at).toBeGreaterThan(-1);
        const body = ORCH.slice(at, ORCH.indexOf('\n  }', at));
        const reads = [...body.matchAll(/gaip_read_wear_state|\.gaip-(matches|sessions|match|session)-[a-z]+/g)]
            .map((m) => m[0]);
        process.stdout.write('[gh776] what the builder reads of the form: ' + JSON.stringify(reads) + '\n');

        expect(reads).toEqual([]);
        // And the absence travels as absence rather than as an empty object.
        expect(body).toContain('schedule?.traffic || schedule || null');
    });

    /**
     * The consequence, from the engine that answers on it: a state with no traffic is nought hours and
     * an empty breakdown, which is why removing the substitution needed nothing to replace it.
     */
    test('the engine answers nought hours and no activity for a state with no traffic', () => {
        const ENGINE = read('assets/wear-recovery-engine-pure.js');
        const fromEngine = /matchesPerWeek: l\(t\.traffic\?\.matchesPerWeek, (\d+)\)/.exec(ENGINE);
        const sessions = /sessionsPerWeek: l\(t\.traffic\?\.sessionsPerWeek, (\d+)\)/.exec(ENGINE);
        process.stdout.write('[gh776] the engine on an absent traffic: matches '
            + JSON.stringify(fromEngine && fromEngine[1]) + ', sessions ' + JSON.stringify(sessions && sessions[1]) + '\n');

        expect(fromEngine).not.toBeNull();
        expect(sessions).not.toBeNull();
        expect([fromEngine[1], sessions[1]]).toEqual(['0', '0']);
    });
});
