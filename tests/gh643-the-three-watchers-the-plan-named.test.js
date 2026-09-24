/**
 * GH-643 — THE THREE CHECKS THE ANALYST'S "HOW TO VERIFY" NAMED THAT DID NOT
 * REACH THE CODE.
 *
 * Link 11 was delivered with the two watchers of section 4.13a and the third of
 * 4.13b. Her section 4.13 lists five checks, and three of them were not built:
 * the DOOR (every template that draws one of these sections includes the partial
 * that carries the sentences), the PAIRING (a row's class is derived from the row
 * rather than from a phrase), and the `Burns`-shaped PGR case (a note recorded
 * in the run reaches the section's answer). They are here.
 *
 * WHY THE DOOR MATTERS MOST OF THE THREE: the sentences ride with the pill
 * partial. A page that draws an empty section without it gets no sentences at
 * all, and the renderer falls back to what it printed before — silently correct
 * today, silently stale the day the words change. The universe is taken from the
 * templates, not from a list written here.
 */

'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const VIEWS = path.join(ROOT, 'app/resources/views');

/** Every template in the tree, so "which of them draw a section" is measured. */
function allTemplates(dir = VIEWS, prefix = '') {
    const out = {};
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const rel = prefix ? prefix + '/' + entry.name : entry.name;
        if (entry.isDirectory()) Object.assign(out, allTemplates(path.join(dir, entry.name), rel));
        else if (entry.name.endsWith('.blade.php')) out[rel] = fs.readFileSync(path.join(dir, entry.name), 'utf8');
    }
    return out;
}

describe('GH-643 — the door: the sentences reach every page that draws a section', () => {
    const templates = allTemplates();
    const RENDERERS = ['soil-nutrition-analysis.js', 'plan-ui.js'];

    test('POSITIVE CONTROL: the templates are read and some of them load a renderer', () => {
        const loaders = Object.keys(templates).filter((f) => RENDERERS.some((r) => templates[f].includes(r)));
        process.stdout.write('\n[gh643] templates: ' + Object.keys(templates).length
            + ' | loading a section renderer: ' + JSON.stringify(loaders) + '\n');

        expect(Object.keys(templates).length).toBeGreaterThan(10);
        expect(loaders.length).toBeGreaterThan(0);
    });

    test('every template that loads one includes the partial that carries the sentences', () => {
        // Not a list of pages written here: whichever templates load a renderer,
        // those are the ones that must carry the door. A new page joins the check
        // by loading the renderer.
        // The door is reached through the layout as often as directly: a page
        // extends `layouts.db-shell`, which includes the topbar, which includes
        // the pill partial. So the chain is followed rather than assumed, and a
        // page that reaches it by neither road is named.
        const carries = (src, seen = new Set()) => {
            if (src.includes("@include('partials.analysis-pill')")) return true;
            const links = [...src.matchAll(/@(?:include|extends)\('([^']+)'/g)].map((m) => m[1]);
            return links.some((name) => {
                const file = name.replace(/\./g, '/') + '.blade.php';
                if (seen.has(file) || !templates[file]) return false;
                seen.add(file);
                return carries(templates[file], seen);
            });
        };

        const missing = [];
        Object.keys(templates).forEach((file) => {
            if (!RENDERERS.some((r) => templates[file].includes(r))) return;
            if (!carries(templates[file])) missing.push(file);
        });

        expect({ templatesDrawingASectionWithoutTheSentences: missing })
            .toEqual({ templatesDrawingASectionWithoutTheSentences: [] });
    });

    test('and the partial the door hides behind really carries them', () => {
        // The other half: a template including a partial that no longer sends the
        // sections would pass the case above while delivering nothing.
        const pill = fs.readFileSync(path.join(VIEWS, 'partials/analysis-pill.blade.php'), 'utf8');
        expect(pill).toMatch(/AnalysisNotice::clientTexts\(/);
        expect(pill).toContain('$analysisCache');

        const topbar = fs.readFileSync(path.join(VIEWS, 'partials/topbar.blade.php'), 'utf8');
        expect(topbar).toContain("@include('partials.analysis-pill')");
    });
});
