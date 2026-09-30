'use strict';

/**
 * GH-781 (delivery 7, the analyst's amendments (14)-(16) and the reviewer's conditions) — THE ROW TAKES THE
 * ACCEPTED PASS, AND NOT THE LAST ATTEMPT.
 *
 * WHAT WAS WRONG: four fields of a row were read off `GAIP_LAST_CASCADE_PASS`, and the last attempt is a
 * different thing from the accepted one. A repeat that failed became the last, so the row carried that pass's
 * mark and its fingerprint of samples beside the records and numbers of the pass before it — one thing printed,
 * another explaining it, which is the class of GH-459.
 *
 * THE FOUR FIELDS, by name rather than as a number (the reviewer's condition, and his own lesson about counting
 * files): `detail.journal.cascadePass`, `detail.journal.cascadeSampleIds`, `detail.journal.orchestratorPass`,
 * and the row's tissue block through `_cascadeTissueOfThisRun`. A fifth field cannot fail to appear in a list.
 *
 * WHY A SEQUENCE AND NOT AN AGREEMENT: two places written by one branch agree in any test that runs that
 * branch — the reviewer named this as "two surfaces that moved together". They are told apart only by
 * "accepted, then not accepted": one must change and the other must stay.
 */

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const parser = require('@babel/parser');
const traverse = require('@babel/traverse').default;
const { makeSandbox, hubScripts, withSamples } = require('./lib/orchestrator-bench');

const ROOT = path.join(__dirname, '..');
const ASSETS = path.join(ROOT, 'assets');
const CLIMATE = { current: { airTemp: 18, soilTemp: 16 } };
const HUB_ROOT = { querySelector: () => null, querySelectorAll: () => [] };
const LAST = 'GAIP_LAST_CASCADE_PASS';
const ACCEPTED = 'GAIP_ACCEPTED_CASCADE_PASS';

/** The page, with the producer's own body assembly and tissue reader reachable. */
function page(store, search) {
    const sandbox = makeSandbox();
    const failed = [];
    const ctx = vm.createContext(sandbox);
    hubScripts().forEach((name) => {
        const file = path.join(ASSETS, name);
        if (!fs.existsSync(file)) { failed.push(name + ': missing'); return; }
        let src = fs.readFileSync(file, 'utf8');
        if (name === 'hub-persistence.js') {
            src = src.replace('global.GilbaPersistence = GilbaPersistence;',
                'global.GilbaPersistence = GilbaPersistence;'
                + '\n    global.__test_journalAtWrite = _journalAtWrite;'
                + '\n    global.__test_tissueOfThisRun = _cascadeTissueOfThisRun;');
        }
        try { vm.runInContext(src, ctx, { filename: name }); }
        catch (e) { failed.push(name + ': ' + String(e && e.message).slice(0, 120)); }
    });
    expect(failed).toEqual([]);
    ctx.location = { search: search };
    ctx.GAIP_HUB_CONFIG = Object.assign({}, ctx.GAIP_HUB_CONFIG || {}, { activeSiteId: 'site-1' });
    withSamples({ ctx: ctx }, store);

    return ctx;
}

/** The four fields of the body, by name, as the producer would fill them for a row. */
function fourFields(ctx) {
    const marks = ctx.__test_journalAtWrite().marks;

    return {
        'detail.journal.cascadePass': marks.cascadePass,
        'detail.journal.cascadeSampleIds': marks.cascadeSampleIds,
        'detail.journal.orchestratorPass': marks.orchestratorPass,
        'the tissue block': ctx.__test_tissueOfThisRun(),
    };
}

describe('GH-781 delivery 7 — the accepted pass, and the last attempt kept apart', () => {
    jest.setTimeout(300000);

    test('ACCEPTED, THEN NOT ACCEPTED: no value of the refused pass is anywhere in the serialised body', () => {
        /**
         * GH-781 (the analyst's amendment (17)) - THE CLAIM DOES NOT DEPEND ON A LIST OF FIELDS.
         *
         * Her own claim that "a fifth field would appear in the list by itself" was withdrawn: it holds only for
         * a field that names the forbidden global directly, and a read through a computed key would pass
         * unnoticed - the reviewer measured that. So the table of four fields below stays as a DESCRIPTION, and
         * the test prints it as one; what holds the door is a MARK.
         *
         * Every value of the refused pass that could reach a row is marked - unique numbers, `soil:MARK-N1`, a
         * field `__mark` - and the assertion is over the body AS IT WOULD BE SERIALISED: not one mark of the
         * refused pass in it, and the accepted pass's marks present in the same string. The second half is the
         * positive control inside the same claim, so an empty body, a throw during assembly or a null cannot
         * pass as success.
         *
         * THE BOUNDARY, printed by the case: a COPIED value carries its mark; a derived one - a boolean, a sum -
         * does not. For the four fields known today there are no derived ones.
         */
        const ctx = page({ soil: { id: 'uid-a', serverId: 103, rawData: { pH_Water: '6.2', K: '40' } } },
            '?rerun=r1&site=site-1&soil=103&water=none&tissue=none');

        const accepted = ctx.gaip_runCascadePass('run-button', HUB_ROOT, CLIMATE, null);
        expect(accepted.result.success).toBe(true);
        const acceptedMarks = [String(accepted.passStartedAt), 'soil:103'];

        /**
         * The refused pass, with every value it could hand over marked. The numbers are unique, the fingerprint
         * carries its own word, and the result object carries a field no product code writes.
         */
        const N1 = 777000111222;
        const refusedMarks = [String(N1), 'MARK-N1', '__mark'];
        // ... and the mark the WRAPPER stamps, which the adapter's stub cannot: the reviewer measured that a
        // fifth field reading the refused pass's own start time slipped through without this, because every mark
        // in the list came from the stubbed result. His fix, in his own words, and it is one line.
        // (pushed below, once the refused pass exists and its time is known)
        const realRun = ctx.GilbaCascadeOrchestrator.runCascade;
        ctx.GilbaCascadeOrchestrator.runCascade = () => ({
            success: false, error: 'refused, from this test', passStartedAt: N1,
            state: { inputs: {}, computed: { tissue: { __mark: 'MARK-N1', value: N1 } } },
        });
        const refused = ctx.gaip_runCascadePass('samples-arrived', HUB_ROOT, CLIMATE, null);
        // The refused pass's own fingerprint is marked too, in the shape the body would carry.
        refused.sampleIds = 'soil:MARK-N1|water:none|tissue:none|pgr:unanswered';
        refusedMarks.push(String(refused.passStartedAt));
        ctx.GilbaCascadeOrchestrator.runCascade = realRun;

        // THE BODY AS IT WOULD BE SENT, and the four fields printed beside it as the description they are.
        const marks = ctx.__test_journalAtWrite().marks;
        const body = JSON.stringify({
            detail: { journal: marks, skipped: ctx.__test_journalAtWrite().skipped },
            tissue: ctx.__test_tissueOfThisRun(),
            fields: fourFields(ctx),
        });
        const foundRefused = refusedMarks.filter((m) => body.indexOf(m) >= 0);
        const foundAccepted = acceptedMarks.filter((m) => body.indexOf(m) >= 0);

        process.stdout.write('\n[gh781] marks planted on the refused pass: ' + refusedMarks.length
            + ', found in the body: ' + foundRefused.length + ' ' + JSON.stringify(foundRefused)
            + '\n[gh781] marks of the accepted pass: ' + acceptedMarks.length
            + ', found in the body: ' + foundAccepted.length + ' ' + JSON.stringify(foundAccepted)
            + '\n[gh781] THE FOUR FIELDS ARE A DESCRIPTION, kept by hand and printed as such: '
            + JSON.stringify(Object.keys(fourFields(ctx)))
            + '\n[gh781] BOUNDARY: a COPIED value carries its mark; a derived one - a boolean, a sum - does'
            + ' not. For the four fields known today there are no derived ones.\n');

        /**
         * The control, from the same run: the last ATTEMPT did move, so there was something to leak. Its mark is
         * the WRAPPER's own start time rather than the number the stubbed adapter returned - measured, and this
         * assertion first expected the wrong one of the two.
         */
        expect(ctx.GAIP_LAST_CASCADE_PASS.passStartedAt).toBe(refused.passStartedAt);
        expect(refused.passStartedAt).not.toBe(accepted.passStartedAt);
        // NOT ONE MARK of the refused pass, wherever a field might read from.
        expect(foundRefused).toEqual([]);
        // AND THE ACCEPTED PASS'S MARKS ARE THERE, in the same string: an empty body cannot pass as success.
        expect(foundAccepted).toEqual(acceptedMarks);
    });

    /**
     * WRITE OR READ, decided by the PARSE TREE and not by the look of a line (the analyst's amendment (16)).
     *
     * `window.X = pass` is a write wherever it stands; `var p = window.X` is a read; `x = window.X = pass` is
     * both. And a name in the position of a key or of somebody else's property - `{ X: 1 }`, `data.X` - is
     * neither, which is the false red nobody had checked. The object matters: `window.X` is this global,
     * `data.X` is a field of something else.
     */
    function usesOf(name, src) {
        const found = { writes: [], reads: [] };
        const ast = parser.parse(src, { sourceType: 'script', errorRecovery: true,
            plugins: ['optionalChaining', 'nullishCoalescingOperator', 'classProperties'] });
        const isThisGlobal = (node) => {
            if (node.type === 'Identifier') return node.name === name;
            if (node.type !== 'MemberExpression' || node.computed) return false;
            const obj = node.object;
            const holder = obj && obj.type === 'Identifier' ? obj.name : null;

            return node.property && node.property.name === name
                && ['window', 'global', 'globalThis', 'self'].indexOf(holder) >= 0;
        };
        const line = (node) => (node.loc ? node.loc.start.line : '?');
        traverse(ast, {
            AssignmentExpression(p2) {
                if (isThisGlobal(p2.node.left)) found.writes.push(line(p2.node));
            },
            VariableDeclarator(p2) {
                if (p2.node.id && isThisGlobal(p2.node.id)) found.writes.push(line(p2.node));
            },
            MemberExpression(p2) {
                if (!isThisGlobal(p2.node)) return;
                // A write is the left of an assignment; everything else is a read.
                const parent = p2.parent;
                const isTarget = parent && parent.type === 'AssignmentExpression' && parent.left === p2.node;
                if (!isTarget) found.reads.push(line(p2.node));
            },
        });

        return found;
    }

    test('WRITE AND READ ARE TOLD APART BY THE TREE, on four samples including the false-red one', () => {
        const samples = [
            { name: 'a write, whatever the line looks like', src: 'window.' + LAST + ' = pass;',
                writes: 1, reads: 0 },
            { name: 'a read', src: 'var p = window.' + LAST + ';', writes: 0, reads: 1 },
            { name: 'both, in one chain', src: 'x = window.' + LAST + ' = pass;', writes: 1, reads: 0 },
            /**
             * THE FALSE RED, which nothing checked: the name in the position of a key, and as somebody else's
             * property. A guard counting identifiers without asking where they stand would report two more
             * readers here and redden a healthy tree.
             */
            { name: 'a key and another object\'s property are neither', writes: 0, reads: 0,
                src: 'var o = { ' + LAST + ': 1 }; var v = data.' + LAST + '; o.' + LAST + ' = 2;' },
        ];
        const seen = samples.map((sp) => {
            const u = usesOf(LAST, sp.src);

            return { name: sp.name, writes: u.writes.length, reads: u.reads.length,
                want: sp.writes + 'w/' + sp.reads + 'r' };
        });
        process.stdout.write('[gh781] the four samples: '
            + seen.map((x) => x.name + ' -> ' + x.writes + 'w/' + x.reads + 'r (want ' + x.want + ')')
                .join('\n[gh781]   ') + '\n');

        samples.forEach((sp, i) => {
            expect([seen[i].writes, seen[i].reads]).toEqual([sp.writes, sp.reads]);
        });
    });

    test('ONE READER of the last attempt in all of `assets`, and it is the repeat', () => {
        /**
         * The analyst's amendment (15), wider than the condition asked for: not "the name is absent from
         * `hub-persistence.js`" but "in all of `assets` it has exactly one reader - the repeat". A reading moved
         * to another file then reddens this with its address instead of passing quietly.
         *
         * THE NUMBER OF FILES PARSED IS PRINTED, because the reviewer measured that a parser refuses 21 of 270
         * live files elsewhere: without that line "one reader" and "never reached the files" read the same.
         */
        const files = fs.readdirSync(ASSETS).filter((f) => f.endsWith('.js'));
        const readers = [];
        const writers = [];
        const parsed = [];
        const trulyParsed = [];
        const notParsed = [];
        files.forEach((f) => {
            const src = fs.readFileSync(path.join(ASSETS, f), 'utf8');
            if (src.indexOf(LAST) < 0) { parsed.push(f); return; }
            let u = null;
            try { u = usesOf(LAST, src); }
            catch (e) { notParsed.push(f + ': ' + String(e.message).slice(0, 60)); return; }
            parsed.push(f);
            trulyParsed.push(f);
            u.reads.forEach((ln) => readers.push(f + ':' + ln));
            u.writes.forEach((ln) => writers.push(f + ':' + ln));
        });

        /**
         * TWO NUMBERS, NOT ONE, and the reviewer was right to ask: `assets` holds 237 `.js` files and the name is
         * in one of them, so a single figure called "parsed" was satisfied by files that were never given to the
         * parser. Looked at, and parsed, are printed apart.
         */
        process.stdout.write('[gh781] looked at: ' + files.length + ' files | actually parsed: '
            + trulyParsed.length + ' | refused by the parser: ' + notParsed.length
            + (notParsed.length ? ' (' + notParsed.join('; ') + ')' : '')
            + '\n[gh781] readers of ' + LAST + ': ' + JSON.stringify(readers)
            + '\n[gh781] writers of ' + LAST + ': ' + JSON.stringify(writers)
            + '\n[gh781] BOUNDARY: this sees the name as written. A read through a reference passed elsewhere,'
            + ' or through a computed key, it does not see - that one is caught by the case above,'
            + ' "accepted, then not accepted".\n');

        // The LIST with addresses, and it is the repeat.
        expect(readers).toHaveLength(1);
        expect(readers[0]).toMatch(/^hub-tissue-v3\.js:\d+$/);
        // The producer of the row does not read it at all any more.
        expect(readers.concat(writers).filter((r) => /hub-persistence/.test(r))).toEqual([]);
        // The walk reached the files, and the PARSER reached the ones that carry the name.
        expect(parsed.length).toBeGreaterThan(50);
        expect(trulyParsed.length).toBeGreaterThan(0);
        expect(notParsed).toEqual([]);
    });

    test('ONE WRITER of the accepted pass, and it is the accepting branch', () => {
        /**
         * The reviewer's second condition: a second place publishing this name would undo the words "only on
         * success" without touching a case. Counted by writing position over the parse tree, and printed with
         * its address.
         */
        const writers = [];
        const files = fs.readdirSync(ASSETS).filter((f) => f.endsWith('.js'));
        const parsed = [];
        const trulyParsed = [];
        const notParsed = [];
        files.forEach((f) => {
            const src = fs.readFileSync(path.join(ASSETS, f), 'utf8');
            if (src.indexOf(ACCEPTED) < 0) { parsed.push(f); return; }
            let ast = null;
            try {
                ast = parser.parse(src, { sourceType: 'script', errorRecovery: true,
                    plugins: ['optionalChaining', 'nullishCoalescingOperator', 'classProperties'] });
            } catch (e) { notParsed.push(f + ': ' + String(e.message).slice(0, 60)); return; }
            parsed.push(f);
            trulyParsed.push(f);
            traverse(ast, {
                AssignmentExpression(p2) {
                    const left = p2.node.left;
                    const names = [];
                    if (left.type === 'Identifier') names.push(left.name);
                    if (left.type === 'MemberExpression' && left.property && left.property.name) {
                        names.push(left.property.name);
                    }
                    if (names.indexOf(ACCEPTED) >= 0) {
                        writers.push(f + ':' + (p2.node.loc ? p2.node.loc.start.line : '?'));
                    }
                },
            });
        });

        process.stdout.write('[gh781] looked at: ' + files.length + ' files | actually parsed: '
            + trulyParsed.length + ' | refused by the parser: ' + notParsed.length
            + (notParsed.length ? ' (' + notParsed.join('; ') + ')' : '')
            + '\n[gh781] writers of ' + ACCEPTED + ': ' + JSON.stringify(writers) + '\n');

        // The LIST, with its address: a second writer is printed rather than turning a 1 into a 2.
        expect(writers).toHaveLength(1);
        expect(writers[0]).toMatch(/^hub-tissue-v3\.js:\d+$/);
        // The walk reached the files, and the PARSER reached the one that carries the name.
        expect(parsed.length).toBeGreaterThan(50);
        expect(trulyParsed.length).toBeGreaterThan(0);
        expect(notParsed).toEqual([]);
    });
});
