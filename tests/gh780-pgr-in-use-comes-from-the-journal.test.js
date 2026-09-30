'use strict';

/**
 * GH-780 — "IS THIS SITE USING A PGR" IS ANSWERED BY THE SPRAY JOURNAL, AND THERE IS NO SWITCH.
 *
 * THE OWNER'S DECISION, 29.09.2026: the PGR checkbox is not coming back; a site is using a plant growth
 * regulator when its journal holds an application within the last ninety days; the shade module and the
 * morning briefing take that, and the date of the last application, from the journal.
 *
 * WHAT WAS WRONG, measured on the stand: the answer came from `config.pgr.enabled` — `false` on twelve of
 * the twenty-one configured sites and absent on the other nine, so the product answered "no PGR" for
 * everybody. Meanwhile three sites had applied one: `Hoxton` four days earlier, `Russley` seventy-one,
 * `Test5 - NZ` a hundred and five. Nothing has written that switch since it was removed from Settings, and
 * the briefing's "PGR overdue" score, which sat behind it, could therefore never fire.
 *
 * WHAT IS ASSERTED: the engine owns the question and the window; three answers, not two; and the config's
 * old switch cannot bring the old behaviour back.
 */

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const { engine } = require('./lib/pgr-engine');

const ROOT = path.join(__dirname, '..');
const BRIEFING = fs.readFileSync(path.join(ROOT, 'assets', 'gaip-morning-briefing.js'), 'utf8');

/** A date this many whole days before the fixed 'now' below. */
const NOW = new Date('2026-09-29T09:00:00Z');
const daysAgo = (n) => new Date(Date.UTC(2026, 8, 29 - n)).toISOString().slice(0, 10);

/** The briefing's score function, lifted with the engine and the journal beside it. */
function briefingScore({ lastPgr, metrics }) {
    const at = BRIEFING.indexOf('function computePriorityScore(');
    expect(at).toBeGreaterThan(-1);
    let depth = 0;
    let body = null;
    for (let i = BRIEFING.indexOf('{', at); i < BRIEFING.length; i += 1) {
        if (BRIEFING[i] === '{') depth += 1;
        else if (BRIEFING[i] === '}') {
            depth -= 1;
            if (!depth) { body = BRIEFING.slice(at, i + 1); break; }
        }
    }
    expect(body).not.toBeNull();

    const box = { Math, JSON, Date, Object, Number, isNaN, parseFloat, console: { log() {}, warn() {} } };
    box.window = box;
    box.global = box;
    vm.createContext(box);
    box.GAIP_PGR = engine();
    vm.runInContext(body, box, { filename: 'computePriorityScore' });

    return vm.runInContext('computePriorityScore(' + JSON.stringify(metrics || null)
        + ', ' + JSON.stringify({ pgr: { enabled: true, applicationDate: daysAgo(71) } })
        + ', ' + JSON.stringify(lastPgr === undefined ? undefined : lastPgr) + ')', box);
}

describe('GH-780 — the journal answers, and the PGR engine owns both rules', () => {
    test('POSITIVE CONTROL: the engine declares the window, and one number only', () => {
        const P = engine();
        const declared = (fs.readFileSync(path.join(ROOT, 'assets', 'gilba-pgr-module-v3.js'), 'utf8')
            .match(/historyWindowDays:\s*(\d+)/) || [])[1];
        process.stdout.write('\n[gh780] the engine declares a window of ' + declared + ' days\n');

        expect(Number(declared)).toBe(90);
        expect(P.historyWindowDays).toBe(90);
        expect(typeof P.isInUse).toBe('function');
        expect(typeof P.daysSinceApplication).toBe('function');
    });

    test('THE THREE ANSWERS, on the stand’s own three sites and on silence', () => {
        const P = engine();
        const answers = {
            'Hoxton, 4 days': P.isInUse(daysAgo(4), NOW),
            'Russley, 71 days': P.isInUse(daysAgo(71), NOW),
            'Test5 - NZ, 105 days': P.isInUse(daysAgo(105), NOW),
            'journal answered, no application': P.isInUse(null, NOW),
            'journal not answered': P.isInUse(undefined, NOW),
        };
        process.stdout.write('[gh780] ' + JSON.stringify(answers) + '\n');

        expect(answers['Hoxton, 4 days']).toBe(true);
        expect(answers['Russley, 71 days']).toBe(true);
        // Outside the window is a measured `false`, not an absence: the journal is the complete record.
        expect(answers['Test5 - NZ, 105 days']).toBe(false);
        expect(answers['journal answered, no application']).toBe(false);
        // No answer at all is the one case where nothing is claimed either way.
        expect(answers['journal not answered']).toBeNull();
    });

    test('the edge of the window is the day itself, counted between UTC midnights', () => {
        const P = engine();
        process.stdout.write('[gh780] 90 days -> ' + JSON.stringify(P.isInUse(daysAgo(90), NOW))
            + ' | 91 days -> ' + JSON.stringify(P.isInUse(daysAgo(91), NOW))
            + ' | days for 71 -> ' + P.daysSinceApplication(daysAgo(71), NOW) + '\n');

        expect(P.isInUse(daysAgo(90), NOW)).toBe(true);
        expect(P.isInUse(daysAgo(91), NOW)).toBe(false);
        // The count is the orchestrator's own: whole days between UTC midnights, so a ninety-nine-day-old
        // application is not reported as a hundred.
        expect(P.daysSinceApplication(daysAgo(71), NOW)).toBe(71);
    });

    test('an application object from the journal answers as well as a bare date', () => {
        // `/api/spray-log/context` hands back a row, and the run passes the row itself.
        const P = engine();
        expect(P.isInUse({ application_date: daysAgo(71) }, NOW)).toBe(true);
        expect(P.isInUse({ application_date: daysAgo(105) }, NOW)).toBe(false);
        expect(P.isInUse({ application_date: null }, NOW)).toBe(false);
    });

    test('THE BRIEFING scores "PGR overdue" off the journal, and the old switch cannot revive it', () => {
        /**
         * The score used to sit behind `config.pgr.enabled` with a date beside it, so it never fired. The
         * config handed to the function below still carries a switch set to `true` and a date seventy-one
         * days old — and it is the JOURNAL argument that decides.
         */
        const overdue = briefingScore({ lastPgr: { application_date: daysAgo(71) } });
        const recent = briefingScore({ lastPgr: { application_date: daysAgo(4) } });
        const beyond = briefingScore({ lastPgr: { application_date: daysAgo(105) } });
        const noneInJournal = briefingScore({ lastPgr: null });
        const notAnswered = briefingScore({ lastPgr: undefined });
        process.stdout.write('[gh780] briefing score — 71d: ' + overdue + ' | 4d: ' + recent
            + ' | 105d: ' + beyond + ' | journal says none: ' + noneInJournal
            + ' | journal not answered: ' + notAnswered + '\n');

        // Seventy-one days is past twenty-eight: the full fifteen points.
        expect(overdue).toBe(15);
        // Four days is not overdue at all, and beyond the window the site is not using one.
        expect(recent).toBe(0);
        expect(beyond).toBe(0);
        expect(noneInJournal).toBe(0);
        // And with no answer from the journal nothing is scored — the config's `true` is not consulted.
        expect(notAnswered).toBe(0);
    });

    test('and no reader of the removed switch is left in the run or on a client page', () => {
        /**
         * The list, not the count. The `/hub` markup's checkbox and its restorer went with the switch, so the
         * only mentions left are prose. A reader added tomorrow reddens this the day it is written.
         */
        const files = fs.readdirSync(path.join(ROOT, 'assets'))
            .filter((f) => f.endsWith('.js') && !f.endsWith('.min.js'));
        const readers = [];
        files.forEach((f) => {
            const src = fs.readFileSync(path.join(ROOT, 'assets', f), 'utf8')
                .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
                .split('\n').map((l) => l.replace(/(^|[^:])\/\/.*$/, '$1')).join('\n');
            src.split('\n').forEach((line, i) => {
                if (/pgr\s*(\?\.|\.)\s*enabled|\.gaip-enable-pgr/.test(line)) {
                    readers.push(f + ':' + (i + 1) + ' ' + line.trim().slice(0, 80));
                }
            });
        });
        const markup = fs.readFileSync(
            path.join(ROOT, 'app', 'resources', 'views', 'partials', 'legacy-hub-markup.blade.php'), 'utf8');
        process.stdout.write('[gh780] readers of the removed switch (' + readers.length + '): '
            + JSON.stringify(readers) + '\n');

        expect({ readersOfTheRemovedSwitch: readers }).toEqual({ readersOfTheRemovedSwitch: [] });
        expect(markup).not.toContain('gaip-enable-pgr');
    });

    test('the inputs list no longer declares the switch, and says where the answer comes from', () => {
        const list = JSON.parse(fs.readFileSync(
            path.join(ROOT, 'assets', 'calculation-inputs.schema.json'), 'utf8'));
        process.stdout.write('[gh780] pgr.enabled in the list: '
            + JSON.stringify(Object.prototype.hasOwnProperty.call(list.inputs, 'pgr.enabled'))
            + '\n[gh780] derived turf.pgrActive: ' + JSON.stringify(list.derived['turf.pgrActive'].slice(0, 90))
            + '\n');

        expect(Object.prototype.hasOwnProperty.call(list.inputs, 'pgr.enabled')).toBe(false);
        expect(list.derived['turf.pgrActive']).toMatch(/spray journal/);
        expect(list.derived['turf.pgrActive']).not.toMatch(/switch in Settings/);
    });
});
