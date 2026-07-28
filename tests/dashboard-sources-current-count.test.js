/**
 * Data Sources widget — "N sources current" / "N needs update" counts
 *
 * Two related bugs, fixed together:
 *
 * 1. updateSourcesBadge() in assets/dashboard-init.js computed `ok = 6 - warnings`,
 *    assuming every dot that isn't flagged .warning must be .ok (current).
 *    Fix: derive `ok` and `total` directly from the DOM (.db-source-dot.ok /
 *    .db-source-dot) instead of the `6 - warnings` shortcut.
 *
 * 2. dashboard.blade.php's $ageClass() had a third, neutral 'none' class for
 *    sources that were NEVER tested (no date at all) — distinct from 'warning'
 *    (tested, but >30 days stale). Because $labIssues and updateSourcesBadge()
 *    only count '.warning', a source that was never imported (Tissue/Water/
 *    Spray Log) silently vanished from both the "current" and "needs update"
 *    buckets instead of showing up as needing attention.
 *
 * Reported scenario: a site with only Weather (live) and Soil Test (tested
 * today) filled in, Sensors not connected, and Tissue/Water/Spray Log never
 * imported. Expected: 2 sources current, 4 needing update (Sensors + the 3
 * never-imported lab sources) — not "1 needs update" with the other 3 simply
 * missing from the count.
 *
 * Fix: $ageClass() now returns 'warning' (not 'none') when there is no date —
 * "never tested" is treated the same as "stale", so there are only two states
 * left (ok / warning) and every non-current source is counted.
 */

// Mirrors dashboard.blade.php's $ageClass() after the fix (tests/gh90-style mirror,
// since jest.config.js runs testEnvironment: 'node' with no DOM/blade available).
function ageClassFixed(dateStr, daysAgo) {
    if (!dateStr) return 'warning'; // never tested — same bucket as stale
    return daysAgo > 30 ? 'warning' : 'ok';
}

// Pre-fix behaviour, for contrast.
function ageClassBuggy(dateStr, daysAgo) {
    if (!dateStr) return 'none';
    return daysAgo > 30 ? 'warning' : 'ok';
}

// Mirrors the fixed updateSourcesBadge() counting logic (dashboard-init.js, post-fix)
function summarize(dotClasses) {
    var total    = dotClasses.length;
    var warnings = dotClasses.filter(function (c) { return c === 'warning'; }).length;
    var ok       = dotClasses.filter(function (c) { return c === 'ok'; }).length;
    return { total: total, warnings: warnings, ok: ok };
}

// Mirrors the original buggy counting logic (ok = 6 - warnings, total hardcoded to 6)
function summarizeBuggy(dotClasses) {
    var warnings = dotClasses.filter(function (c) { return c === 'warning'; }).length;
    return { total: 6, warnings: warnings, ok: 6 - warnings };
}

describe('$ageClass — never-tested sources are treated as needing attention', function () {
    test('no date at all → warning, not a neutral third state', function () {
        expect(ageClassFixed(null, null)).toBe('warning');
    });

    test('tested today → ok', function () {
        expect(ageClassFixed('2026-07-27', 0)).toBe('ok');
    });

    test('tested 45 days ago → warning (stale)', function () {
        expect(ageClassFixed('2026-06-12', 45)).toBe('warning');
    });

    test('pre-fix behaviour reproduces the missing "none" bucket', function () {
        expect(ageClassBuggy(null, null)).toBe('none');
    });
});

describe('Data Sources widget — reported scenario (Weather + Soil filled in, everything else empty)', function () {
    // Row order matches dashboard.blade.php: Weather, Soil, Tissue, Sensors, Water, Spray Log
    var SCENARIO = [
        'ok',                       // Weather — always live
        ageClassFixed('2026-07-27', 0), // Soil Test — tested today
        ageClassFixed(null, null), // Tissue Test — never imported
        'warning',                 // Sensors — not connected (already binary ok/warning)
        ageClassFixed(null, null), // Water Test — never imported
        ageClassFixed(null, null), // Spray Log — never logged
    ];

    test('exactly 2 sources are current', function () {
        expect(summarize(SCENARIO).ok).toBe(2);
    });

    test('exactly 4 sources need update (Sensors + 3 never-imported lab sources)', function () {
        expect(summarize(SCENARIO).warnings).toBe(4);
    });

    test('footer reads "2/6 sources", not the pre-fix "5/6"', function () {
        var s = summarize(SCENARIO);
        expect(s.ok + '/' + s.total + ' sources').toBe('2/6 sources');
    });

    test('pre-fix formula reproduces the original defect ("5 current · 1 needs update")', function () {
        var buggyScenario = [
            'ok',
            ageClassBuggy('2026-07-27', 0),
            ageClassBuggy(null, null), // 'none' — falls out of the warning count
            'warning',
            ageClassBuggy(null, null),
            ageClassBuggy(null, null),
        ];
        var s = summarizeBuggy(buggyScenario);
        expect(s.warnings).toBe(1); // only Sensors — the 3 "none" rows are invisible to this formula
        expect(s.ok).toBe(5);       // 6 - 1, wrongly counting the 3 never-tested rows as current
    });
});

describe('Data Sources widget — edge cases', function () {
    test('no source rows rendered: 0/0, no divide-by-zero garbage in the progress bar', function () {
        var s = summarize([]);
        expect(s.total).toBe(0);
        var pct = s.total ? Math.round(s.ok / s.total * 100) : 0;
        expect(pct).toBe(0);
    });

    test('fully current site: all 6 sources ok, 0 issues', function () {
        var s = summarize(['ok', 'ok', 'ok', 'ok', 'ok', 'ok']);
        expect(s.ok).toBe(6);
        expect(s.warnings).toBe(0);
    });

    test('brand-new site: nothing configured yet — all 6 count as needing update, not as current', function () {
        var s = summarize(['warning', 'warning', 'warning', 'warning', 'warning', 'warning']);
        expect(s.ok).toBe(0);
        expect(s.warnings).toBe(6);
    });
});
