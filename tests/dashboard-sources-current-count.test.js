/**
 * Data Sources widget — "N sources current" overcounts untested sources
 *
 * Root cause: updateSourcesBadge() in assets/dashboard-init.js computed
 *   ok = 6 - warnings
 * assuming every dot that isn't flagged .warning must be .ok (current). But a
 * source that was NEVER tested gets the neutral "none" class — see
 * dashboard.blade.php's $ageClass(), which returns 'none' (not 'ok' or
 * 'warning') when there is no date at all. "none" dots have no CSS color rule
 * (assets/dashboard-ui.css only styles .db-source-dot.ok/.warning), so they
 * render as neutral/blank — they are neither current nor overdue.
 *
 * Reported scenario: a site with only Weather (ok, live) and Soil Test
 * (ok, tested today) filled in, Sensors not connected (warning), and
 * Tissue Test / Water Test / Spray Log never imported (none) still showed
 * "5 sources current · 1 needs update" / "5/6 sources" — only 2 sources are
 * actually current; the 3 "none" rows were silently counted as current too.
 *
 * Fix (assets/dashboard-init.js updateSourcesBadge): derive `ok` and `total`
 * directly from the DOM (.db-source-dot.ok / .db-source-dot) instead of the
 * `6 - warnings` shortcut.
 */

// Mirrors the fixed updateSourcesBadge() counting logic (dashboard-init.js, post-fix)
function summarizeFixed(dotClasses) {
    var total    = dotClasses.length;
    var warnings = dotClasses.filter(function (c) { return c.indexOf('warning') !== -1; }).length;
    var ok       = dotClasses.filter(function (c) { return c.indexOf('ok') !== -1; }).length;
    return { total: total, warnings: warnings, ok: ok };
}

// Mirrors the pre-fix buggy counting logic (ok = 6 - warnings, total hardcoded to 6)
function summarizeBuggy(dotClasses) {
    var warnings = dotClasses.filter(function (c) { return c.indexOf('warning') !== -1; }).length;
    return { total: 6, warnings: warnings, ok: 6 - warnings };
}

// Reported scenario, in dashboard.blade.php row order:
// Weather(ok), Soil Test(ok), Tissue Test(none), Sensors(warning), Water Test(none), Spray Log(none)
var REPORTED_SCENARIO = ['ok', 'ok', 'none', 'warning', 'none', 'none'];

describe('Data Sources widget — current-source count (site with only Weather + Soil filled in)', function () {

    test('fixed formula: only the 2 sources with fresh data count as current', function () {
        var s = summarizeFixed(REPORTED_SCENARIO);
        expect(s.ok).toBe(2);
        expect(s.warnings).toBe(1);
        expect(s.total).toBe(6);
    });

    test('fixed formula: score reads "2/6 sources", not the reported "5/6"', function () {
        var s = summarizeFixed(REPORTED_SCENARIO);
        expect(s.ok + '/' + s.total + ' sources').toBe('2/6 sources');
    });

    test('buggy formula reproduces the reported defect: untested sources counted as current', function () {
        var s = summarizeBuggy(REPORTED_SCENARIO);
        expect(s.ok).toBe(5); // the bug: 6 - 1 warning = 5, ignoring the 3 never-tested "none" sources
        expect(s.ok + '/' + s.total + ' sources').toBe('5/6 sources');
    });

    test('"needs update" issue count was already correct and is unaffected by the fix', function () {
        expect(summarizeFixed(REPORTED_SCENARIO).warnings).toBe(1);
        expect(summarizeBuggy(REPORTED_SCENARIO).warnings).toBe(1);
    });
});

describe('Data Sources widget — edge cases for the fixed formula', function () {

    test('no source rows rendered: 0/0, no divide-by-zero garbage in the progress bar', function () {
        var s = summarizeFixed([]);
        expect(s.total).toBe(0);
        var pct = s.total ? Math.round(s.ok / s.total * 100) : 0;
        expect(pct).toBe(0);
    });

    test('fully current site: all 6 sources ok, 0 issues', function () {
        var s = summarizeFixed(['ok', 'ok', 'ok', 'ok', 'ok', 'ok']);
        expect(s.ok).toBe(6);
        expect(s.warnings).toBe(0);
    });

    test('fully stale site: all 6 sources warning, 0 current', function () {
        var s = summarizeFixed(['warning', 'warning', 'warning', 'warning', 'warning', 'warning']);
        expect(s.ok).toBe(0);
        expect(s.warnings).toBe(6);
    });

    test('brand-new site: all 6 sources never tested (none), 0 current, 0 issues', function () {
        var s = summarizeFixed(['none', 'none', 'none', 'none', 'none', 'none']);
        expect(s.ok).toBe(0);
        expect(s.warnings).toBe(0);
        expect(s.total).toBe(6);
    });
});
