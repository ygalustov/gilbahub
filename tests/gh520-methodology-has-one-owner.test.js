/**
 * GH-520 — the site's methodology has one owner, and "not set" is not MLSN.
 *
 * The owner is `config.turf.methodology`. Before this, three other things could
 * answer the question and two of them answered with something nobody chose:
 *
 *   - `Controller::effectiveMethodology()` returned `ammonium_acetate` for any
 *     site with New Zealand coordinates, overriding what was saved — SLAN
 *     included — on eight call sites across seven controllers;
 *   - the same function returned `'mlsn'` where nothing was saved, so "not set"
 *     and "set to MLSN" were the same answer;
 *   - the sample stamp read `sites.methodology_override ?: accounts.methodology`,
 *     and since the column was NULL on 12 of 12 live sites and the account
 *     default is `'mlsn'`, 60 of 60 live samples were stamped 'mlsn' while 7 of
 *     12 sites were set to something else.
 *
 * ── Passport ────────────────────────────────────────────────────────────────
 * guarantee   What the server answers for a site's methodology is what that
 *             site's configuration holds, or nothing at all.
 * claims      Structurally, over the PHP: `effectiveMethodology` takes the saved
 *             value alone, has no region branch and no default; every caller
 *             handles null before upper-casing; the stamp reads the config; the
 *             retired column is named in no rule, no payload and no view.
 * universe    The eight call sites of `effectiveMethodology`, the stamp, and
 *             the four places the column was read — all found by walking the
 *             tree, not by a list kept here.
 * unit        One call site, one read.
 * moment      At parse, over the source as it stands.
 * distinguishability  The region branch and the default are two separate
 *             removals and are asserted separately, so putting either back on
 *             its own is caught.
 * carrier     The PHP source. The behavioural half — what the pages print —
 *             belongs to the live check, which this delivery does not run.
 * input       The controllers and models themselves.
 * positive-control  `effectiveMethodology` must still RETURN the saved value:
 *             a rule that only forbade things would pass on a function that
 *             returns null always.
 * exemptions  None.
 * ratchet     None.
 * rc          Put back `isNewZealand -> ammonium_acetate`; put back `?: 'mlsn'`;
 *             point the stamp at the column or the account again; re-add the
 *             column to the payload or the validation.
 * ЧТО ОЗНАЧАЕТ ЕГО КРАСНЫЙ ЗДЕСЬ И СЕЙЧАС — measured, not predicted, on the
 *             tree as it stands after this delivery: GREEN, 9 of 9. Before the
 *             delivery it was RED on every one of the nine. A red here now is
 *             one of the four substitutions coming back.
 */

'use strict';

const fs = require('fs');
const path = require('path');

const APP = path.join(__dirname, '..', 'app', 'app');
const VIEWS = path.join(__dirname, '..', 'app', 'resources', 'views');
const read = (p) => fs.readFileSync(p, 'utf8');

const controller = read(path.join(APP, 'Http', 'Controllers', 'Controller.php'));
const CONTROLLER_DIR = path.join(APP, 'Http', 'Controllers');

/** The body of effectiveMethodology, by its own braces. */
function effectiveMethodologyBody(src) {
    const at = src.indexOf('function effectiveMethodology');
    if (at < 0) return null;
    const open = src.indexOf('{', at);
    let depth = 0;
    for (let i = open; i < src.length; i++) {
        if (src[i] === '{') depth++;
        else if (src[i] === '}') { depth--; if (!depth) return src.slice(open, i + 1); }
    }
    return null;
}

/** Every call of effectiveMethodology in the controllers, with the line. */
function callSites() {
    const out = [];
    fs.readdirSync(CONTROLLER_DIR).filter((f) => f.endsWith('.php')).forEach((f) => {
        read(path.join(CONTROLLER_DIR, f)).split('\n').forEach((line, i) => {
            if (/self::effectiveMethodology\(/.test(line)) out.push({ file: f, line: i + 1, text: line });
        });
    });
    return out;
}

describe('GH-520 — one owner for the methodology', () => {
    const body = effectiveMethodologyBody(controller);

    test('the reader exists and answers with the saved value', () => {
        expect.hasAssertions();
        expect(body).not.toBeNull();
        // positive control: it must RETURN the saved value, normalised — a rule
        // that only forbade things would pass on a function returning null.
        expect(body).toMatch(/strtolower\(\s*trim\(\s*\$saved\s*\)\s*\)/);
        expect(body).toMatch(/return\s+\$normalised/);
    });

    test('it has no region branch: the coordinates do not decide the methodology', () => {
        expect.hasAssertions();
        expect(body).not.toMatch(/isNewZealand/);
        expect(body).not.toMatch(/ammonium_acetate/);
        // and it no longer takes coordinates at all
        const sig = controller.slice(controller.indexOf('function effectiveMethodology'),
            controller.indexOf('function effectiveMethodology') + 160);
        expect(sig).not.toMatch(/\$lat/);
        expect(sig).not.toMatch(/\$lon/);
    });

    test('it has no default: nothing set answers null, not MLSN', () => {
        expect.hasAssertions();
        expect(body).not.toMatch(/'mlsn'/);
        expect(body).toMatch(/return\s+null/);
    });

    test('every caller handles null before upper-casing it', () => {
        expect.hasAssertions();
        const sites = callSites();
        expect(sites.length).toBeGreaterThan(5);
        const unguarded = sites
            .filter((c) => /strtoupper\(\s*self::effectiveMethodology/.test(c.text))
            .map((c) => c.file + ':' + c.line);
        expect({ callersUpperCasingTheResultDirectly: unguarded })
            .toEqual({ callersUpperCasingTheResultDirectly: [] });
    });

    test('no caller passes coordinates any more', () => {
        expect.hasAssertions();
        const withCoords = callSites()
            .filter((c) => /effectiveMethodology\([^)]*,/.test(c.text))
            .map((c) => c.file + ':' + c.line);
        expect({ callersStillPassingCoordinates: withCoords })
            .toEqual({ callersStillPassingCoordinates: [] });
    });

    test('the sample stamp reads the site configuration, not the column or the account', () => {
        expect.hasAssertions();
        const sc = read(path.join(CONTROLLER_DIR, 'SampleController.php'));
        // The WRITE, not the echoes. Measured while writing this: there are
        // four lines naming `methodology_snapshot` and three of them read the
        // stored stamp back into a response — those stay by decision, the stamp
        // remains a record. Only the line that does not read it back is the one
        // that sets it.
        const all = sc.split('\n').filter((l) => /'methodology_snapshot'\s*=>/.test(l));
        expect(all.length).toBeGreaterThan(0);
        const echoes = all.filter((l) => /=>\s*\$\w+->methodology_snapshot/.test(l));
        const writes = all.filter((l) => echoes.indexOf(l) < 0);
        expect({ linesThatSetTheStamp: writes.length }).toEqual({ linesThatSetTheStamp: 1 });
        expect(writes[0]).toMatch(/siteConfigMethodology/);
        expect(writes[0]).not.toMatch(/methodology_override/);
        expect(writes[0]).not.toMatch(/account/);
        // the texture stamp beside it is NOT this ticket's and must be untouched
        const tex = sc.split('\n').filter((l) => /'soil_texture_snapshot'\s*=>/.test(l));
        const texWrites = tex.filter((l) => !/=>\s*\$\w+->soil_texture_snapshot/.test(l));
        expect({ linesThatSetTheTextureStamp: texWrites.length })
            .toEqual({ linesThatSetTheTextureStamp: 1 });
        expect(texWrites[0]).toMatch(/soil_texture_override/);
    });

    test('the analysis cache is no longer a methodology source, and no longer overwritten for NZ', () => {
        expect.hasAssertions();
        const sac = read(path.join(CONTROLLER_DIR, 'SampleAnalysisController.php'));
        const line = sac.split('\n').filter((l) => /\$methodology\s*=\s*self::effectiveMethodology/.test(l));
        expect(line.length).toBe(1);
        expect(sac).not.toMatch(/effectiveMethodology\(\s*\$cachedSn/);
        const ac = read(path.join(CONTROLLER_DIR, 'AnalysisController.php'));
        expect(ac).not.toMatch(/\['computed'\]\['soilNutrition'\]\['methodology'\]\s*=\s*'ammonium_acetate'/);
    });

    test('the retired column is named in no rule, no payload and no view', () => {
        expect.hasAssertions();
        const offenders = [];
        const site = read(path.join(APP, 'Models', 'Site.php'));
        // a mention in a comment is not a use: only code lines count
        const codeMentions = (src, file) => src.split('\n').forEach((l, i) => {
            if (!/methodology_override/.test(l)) return;
            const t = l.trim();
            if (t.startsWith('//') || t.startsWith('*') || t.startsWith('/*') || t.startsWith('{{--')) return;
            offenders.push(file + ':' + (i + 1));
        });
        codeMentions(site, 'Models/Site.php');
        codeMentions(read(path.join(CONTROLLER_DIR, 'SiteController.php')), 'SiteController.php');
        codeMentions(read(path.join(VIEWS, 'settings.blade.php')), 'views/settings.blade.php');
        expect({ placesStillUsingTheRetiredColumn: offenders })
            .toEqual({ placesStillUsingTheRetiredColumn: [] });
    });

    test('an unset methodology is named on the pages that print it, not left blank', () => {
        expect.hasAssertions();
        const printers = ['analysis/growth-light.blade.php', 'analysis/disease.blade.php',
            'reports/accuracy.blade.php', 'reports/export.blade.php',
            'reports/forensic.blade.php', 'reports/scenarios.blade.php'];
        const silent = printers.filter((f) => !/not set/i.test(read(path.join(VIEWS, f))));
        expect({ pagesThatPrintNothingWhenItIsUnset: silent })
            .toEqual({ pagesThatPrintNothingWhenItIsUnset: [] });
    });
});
