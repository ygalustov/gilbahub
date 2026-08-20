/**
 * Test GH-267 — the "Growth Potential" info tooltip on the Soil & Nutrition
 * page said "MLSN targets are adjusted proportionally [with GP]" even on AA
 * sites, where that's factually wrong: mlsnEngine()'s AA branch (GH-260)
 * classifies LOW/SUFFICIENT/HIGH by comparing soil ppm directly against
 * fixed Hill Labs NZ sufficiency ranges — growth potential has no role in
 * that comparison, unlike MLSN's GP-scaled uptake target.
 *
 * Found by inspecting a live AA site's page header — the info icon next to
 * "Hill Labs NZ Method 38%" opened a tooltip describing MLSN's GP-scaling
 * mechanic verbatim.
 */

const fs = require('fs');
const path = require('path');

describe('GH-267 — methodology-aware Growth Potential tooltip', () => {
    let src;
    beforeAll(() => {
        src = fs.readFileSync(path.join(__dirname, '../assets/soil-nutrition-analysis.js'), 'utf8');
    });

    test('a separate AA glossary entry exists and does not claim GP scales AA classification', () => {
        const start = src.indexOf("'sn-compliance-aa': {");
        expect(start).toBeGreaterThan(-1);
        const end = src.indexOf('},', start);
        const entry = src.slice(start, end);
        expect(entry).not.toMatch(/MLSN targets are adjusted/);
        expect(entry).toMatch(/does not scale with GP/);
        expect(entry).toMatch(/Hill Labs NZ sufficiency ranges/);
    });

    test('the original MLSN/SLAN glossary entry is untouched (still describes real MLSN behaviour)', () => {
        const start = src.indexOf("'sn-compliance': {");
        const end = src.indexOf('},', start);
        const entry = src.slice(start, end);
        expect(entry).toMatch(/MLSN targets are adjusted proportionally/);
    });

    test('renderPageHeader picks the AA-specific info key only for ammonium_acetate', () => {
        expect(src).toMatch(/var complianceInfoKey = m === 'ammonium_acetate' \? 'sn-compliance-aa' : 'sn-compliance';/);
        expect(src).toMatch(/data-info="'\s*\+\s*complianceInfoKey\s*\+\s*'"/);
    });

    test('sn-status tooltip mentions AA alongside MLSN/SLAN', () => {
        const start = src.indexOf("'sn-status': {");
        const end = src.indexOf('},', start);
        const entry = src.slice(start, end);
        expect(entry).toMatch(/MLSN\/SLAN\/AA/);
    });

    describe('behavioural — renderPageHeader chooses the right info key per methodology', () => {
        function extractRenderPageHeader() {
            const start = src.indexOf('function renderPageHeader(sn) {');
            let depth = 0;
            let i = src.indexOf('{', start);
            const bodyStart = i;
            for (; i < src.length; i++) {
                if (src[i] === '{') depth++;
                else if (src[i] === '}') { depth--; if (depth === 0) break; }
            }
            return src.slice(start, i + 1);
        }

        function renderHeaderHtml(methodology, gpWeighted) {
            const vm = require('vm');
            const fnSrc = extractRenderPageHeader();
            const sandbox = {
                global: {
                    GAIP_DASHBOARD_DATA: { computed: { climate: { growth: { weighted: gpWeighted } } } },
                },
                esc: (s) => String(s),
                renderKpiCards: () => '',
            };
            sandbox.globalThis = sandbox;
            const ctx = vm.createContext(sandbox);
            vm.runInContext(fnSrc + '\nvar __result = renderPageHeader({ methodology: ' + JSON.stringify(methodology) + ' });', ctx);
            return ctx.__result;
        }

        test('AA site renders the AA-specific info key', () => {
            const html = renderHeaderHtml('ammonium_acetate', 38);
            expect(html).toContain('data-info="sn-compliance-aa"');
            expect(html).not.toContain('data-info="sn-compliance"');
        });

        test('MLSN site renders the generic info key', () => {
            const html = renderHeaderHtml('mlsn', 38);
            expect(html).toContain('data-info="sn-compliance"');
            expect(html).not.toContain('sn-compliance-aa');
        });

        test('SLAN site renders the generic info key too (unaffected by this fix)', () => {
            const html = renderHeaderHtml('slan', 38);
            expect(html).toContain('data-info="sn-compliance"');
            expect(html).not.toContain('sn-compliance-aa');
        });
    });
});
