/**
 * b35fix504 / b35fix504b — site-config-persistence: _last update on site switch
 *
 * BUG CLASS: stale TurfProfile._last across site switches
 *
 * PROBLEM:
 * localStorage["gilba_turf_profiles_last"] (_last) stores the name of the
 * profile to auto-load on the next page load.  After switching to Russley,
 * _last still pointed to "Burns GC" (or "__site__019e96d8", the Canberra
 * site), so every page reload started with the wrong species.
 *
 * ROOT CAUSE — four iterations:
 *
 *   Part 1 — cascade guard bug (b35fix504):
 *     The 500ms cascade-end timeout cleared _isSiteSwitch = false BEFORE
 *     checking if (!_isSiteSwitch).  The guard always evaluated true, causing
 *     the page-load sync branch to run on site-switch and corrupt the previous
 *     site's saved profile with the new site's species.
 *     Fixed: capture _wasSiteSwitch = _isSiteSwitch BEFORE clearing.
 *
 *   Part 2 — wrong species at write time (b35fix504):
 *     Writing _last in restoreNewSiteConfig() (start of cascade) read
 *     config.turf.species (stored value, potentially stale Creeping Bentgrass).
 *     Moved write to cascade end (500ms) where tp.state.species is correct.
 *
 *   Part 3 — _restoringSiteId silently skipped (b35fix504):
 *     Relied on _restoringSiteId (set in restoreNewSiteConfig) being picked up
 *     at cascade end.  But if gaip:site-changed fires AFTER the 800ms page-load
 *     timer, the timer has already set _previousSiteId = Russley, causing the
 *     duplicate-event guard to skip restoreNewSiteConfig — _restoringSiteId null.
 *
 *   Part 4 — SM lag + page-load cascade race (b35fix504b):
 *     SM.getActiveSiteId() can still show the old site at cascade-end time
 *     (GAIP queues site switches), causing the cascade end to write the wrong
 *     _last.  Separately, the page-load cascade (800ms) could end AFTER the
 *     site-switch cascade and overwrite _last with the server-initial site.
 *
 *     Fix: write _last IMMEDIATELY in restoreNewSiteConfig (we KNOW the target
 *     site from the event), track _lastSwitchedToSiteId, and prevent the
 *     page-load cascade from overwriting _last when a switch already happened.
 *
 * Spec: tests/site-config-persistence-last-update-b35fix504.test.js
 */

'use strict';

const fs   = require('fs');
const path = require('path');

const src = fs.readFileSync(
    path.join(__dirname, '../assets/site-config-persistence.js'),
    'utf8'
);

// ─────────────────────────────────────────────────────────────────────────────
// A. Source structure (8 tests)
// ─────────────────────────────────────────────────────────────────────────────

describe('b35fix504 — source structure', () => {
    test('b35fix504 comment block is present in source', () => {
        expect(src).toContain('b35fix504');
    });

    // Part 1 — guard capture
    test('_wasSiteSwitch is captured from _isSiteSwitch before clearing', () => {
        const capturePos = src.indexOf('var _wasSiteSwitch = _isSiteSwitch');
        const clearPos   = src.indexOf('_isSiteSwitch = false');
        expect(capturePos).toBeGreaterThan(-1);
        expect(clearPos).toBeGreaterThan(-1);
        expect(capturePos).toBeLessThan(clearPos);
    });

    test('guard uses _wasSiteSwitch, not _isSiteSwitch', () => {
        expect(src).toContain('if (!_wasSiteSwitch)');
    });

    // Part 4 (b35fix504b) — immediate write + _lastSwitchedToSiteId
    test('b35fix504b: _lastSwitchedToSiteId module variable declared', () => {
        expect(src).toContain('var _lastSwitchedToSiteId = null');
    });

    test('b35fix504b: gaip:site-changed sets _lastSwitchedToSiteId = newSiteId', () => {
        expect(src).toContain('_lastSwitchedToSiteId = newSiteId');
    });

    test('b35fix504b: restoreNewSiteConfig writes _last immediately before cascade', () => {
        // The immediate _last write must appear in restoreNewSiteConfig BEFORE the
        // "var config = _configs[newSiteId]" line (cascade setup).
        const immWritePos = src.indexOf('b35fix504b: write _last immediately on site switch');
        const cascadePos  = src.indexOf("var config = _configs[newSiteId]");
        expect(immWritePos).toBeGreaterThan(-1);
        expect(cascadePos).toBeGreaterThan(-1);
        expect(immWritePos).toBeLessThan(cascadePos);
    });

    test('b35fix504b: cascade end site-switch path uses _lastSwitchedToSiteId', () => {
        expect(src).toContain('_lastSwitchedToSiteId || _sid504');
    });

    test('b35fix504b: cascade end page-load path skips _last write when switch happened', () => {
        // "else if (!_lastSwitchedToSiteId)" means page-load only writes _last
        // when no site switch has occurred this session.
        expect(src).toContain('else if (!_lastSwitchedToSiteId)');
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// B. Guard logic: Part 1 — _wasSiteSwitch captures correctly (3 tests)
// ─────────────────────────────────────────────────────────────────────────────

describe('b35fix504 — guard logic (Part 1)', () => {
    function runGuardOld(isSiteSwitch) {
        var _isSiteSwitch = isSiteSwitch;
        _isSiteSwitch = false;
        return !_isSiteSwitch;  // always true — BUG
    }

    function runGuardFixed(isSiteSwitch) {
        var _isSiteSwitch = isSiteSwitch;
        var _wasSiteSwitch = _isSiteSwitch;
        _isSiteSwitch = false;
        return !_wasSiteSwitch;
    }

    test('old guard always ran sync block on site-switch (confirms bug was real)', () => {
        expect(runGuardOld(true)).toBe(true);
        expect(runGuardOld(false)).toBe(true);
    });

    test('fixed guard blocks sync block on site-switch', () => {
        expect(runGuardFixed(true)).toBe(false);
    });

    test('fixed guard still allows sync block on page-load', () => {
        expect(runGuardFixed(false)).toBe(true);
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// C. Immediate write logic (b35fix504b Part 4) — 4 tests
// ─────────────────────────────────────────────────────────────────────────────

describe('b35fix504b — immediate _last write on site switch', () => {
    function makeStorage() {
        var store = {};
        return {
            getItem:  function(k) { return Object.prototype.hasOwnProperty.call(store, k) ? store[k] : null; },
            setItem:  function(k, v) { store[k] = String(v); },
            _store:   store
        };
    }

    // Simulates the immediate _last write in restoreNewSiteConfig(newSiteId).
    function runImmediateWrite(newSiteId, existingProfiles, ls) {
        var PROFILES_KEY = 'gilba_turf_profiles';
        var LAST_KEY     = PROFILES_KEY + '_last';
        var keyName      = '__site__' + newSiteId;
        ls.setItem(LAST_KEY, keyName);
        var profs = JSON.parse(ls.getItem(PROFILES_KEY) || '{}');
        if (!profs[keyName]) {
            profs[keyName] = { _siteId: newSiteId, _auto: true, species: null };
            if (existingProfiles) Object.assign(profs, existingProfiles);
            ls.setItem(PROFILES_KEY, JSON.stringify(profs));
        }
    }

    test('_last is written immediately to "__site__<newSiteId>"', () => {
        var ls = makeStorage();
        ls.setItem('gilba_turf_profiles_last', '__site__burnsGC');
        runImmediateWrite('019f35f0-russley', null, ls);
        expect(ls.getItem('gilba_turf_profiles_last')).toBe('__site__019f35f0-russley');
    });

    test('existing auto-profile is NOT overwritten by the stub', () => {
        var ls = makeStorage();
        var existing = { '__site__019f35f0': { species: 'Browntop Bent (Greens)', _auto: true } };
        ls.setItem('gilba_turf_profiles', JSON.stringify(existing));
        runImmediateWrite('019f35f0', existing, ls);
        // Profile already existed — stub should not overwrite species
        var profs = JSON.parse(ls.getItem('gilba_turf_profiles'));
        expect(profs['__site__019f35f0'].species).toBe('Browntop Bent (Greens)');
    });

    test('stub is created if profile absent', () => {
        var ls = makeStorage();
        runImmediateWrite('019f35f0', null, ls);
        var profs = JSON.parse(ls.getItem('gilba_turf_profiles'));
        expect(profs['__site__019f35f0']).toBeDefined();
        expect(profs['__site__019f35f0']._auto).toBe(true);
    });

    test('Burns→Russley sequence: immediate write survives a later Burns cascade end', () => {
        // Simulates the main race condition:
        //   1. User switches to Russley → immediate write → _last = __site__russley
        //   2. Page-load Burns cascade ends LATER → must NOT overwrite _last
        var ls = makeStorage();

        // Step 1: immediate write on switch to Russley
        runImmediateWrite('russley', null, ls);
        expect(ls.getItem('gilba_turf_profiles_last')).toBe('__site__russley');

        // Step 2: page-load cascade end for Burns GC, WITH a site switch in progress
        // (_lastSwitchedToSiteId = 'russley', _wasSiteSwitch = false for page-load)
        // → must skip _last write
        var PROFILES_KEY = 'gilba_turf_profiles';
        var LAST_KEY     = PROFILES_KEY + '_last';
        var wasSiteSwitch = false;
        var lastSwitchedToSiteId = 'russley'; // set by gaip:site-changed
        var smSiteId = 'burns'; // SM still shows Burns at page-load cascade end

        // Simulate the cascade-end _last write guard
        if (wasSiteSwitch) {
            var lastSite504 = lastSwitchedToSiteId || smSiteId;
            ls.setItem(LAST_KEY, '__site__' + lastSite504);
        } else if (!lastSwitchedToSiteId) {
            ls.setItem(LAST_KEY, '__site__' + smSiteId);
        }
        // else: page-load with switch → skip

        // _last should still be Russley
        expect(ls.getItem('gilba_turf_profiles_last')).toBe('__site__russley');
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// D. Cascade-end _last write guard (b35fix504b) — 5 tests
// ─────────────────────────────────────────────────────────────────────────────

describe('b35fix504b — cascade-end _last write guard', () => {
    function makeStorage() {
        var store = {};
        return {
            getItem:  function(k) { return Object.prototype.hasOwnProperty.call(store, k) ? store[k] : null; },
            setItem:  function(k, v) { store[k] = String(v); },
            _store:   store
        };
    }

    // Simulates the cascade-end _last decision (b35fix504b).
    // Returns the siteKey that was written, or null if skipped.
    function runCascadeEndGuard(opts) {
        var wasSiteSwitch        = opts.wasSiteSwitch;
        var lastSwitchedToSiteId = opts.lastSwitchedToSiteId;
        var smSiteId             = opts.smSiteId;
        var ls                   = opts.ls;
        var LAST_KEY             = 'gilba_turf_profiles_last';

        var written = null;
        if (wasSiteSwitch) {
            var lastSite504 = lastSwitchedToSiteId || smSiteId;
            ls.setItem(LAST_KEY, '__site__' + lastSite504);
            written = '__site__' + lastSite504;
        } else if (!lastSwitchedToSiteId) {
            ls.setItem(LAST_KEY, '__site__' + smSiteId);
            written = '__site__' + smSiteId;
        }
        // else: page-load + switch happened → skip
        return written;
    }

    test('site-switch cascade writes __site__<_lastSwitchedToSiteId>', () => {
        var ls = makeStorage();
        var written = runCascadeEndGuard({
            wasSiteSwitch: true, lastSwitchedToSiteId: 'russley', smSiteId: 'burns', ls
        });
        expect(written).toBe('__site__russley');
        expect(ls.getItem('gilba_turf_profiles_last')).toBe('__site__russley');
    });

    test('site-switch cascade falls back to SM when _lastSwitchedToSiteId is null', () => {
        var ls = makeStorage();
        var written = runCascadeEndGuard({
            wasSiteSwitch: true, lastSwitchedToSiteId: null, smSiteId: 'russley', ls
        });
        expect(written).toBe('__site__russley');
    });

    test('page-load cascade with no prior switch writes __site__<SM>', () => {
        var ls = makeStorage();
        var written = runCascadeEndGuard({
            wasSiteSwitch: false, lastSwitchedToSiteId: null, smSiteId: 'burns', ls
        });
        expect(written).toBe('__site__burns');
    });

    test('page-load cascade skips _last write when site switch already happened', () => {
        var ls = makeStorage();
        ls.setItem('gilba_turf_profiles_last', '__site__russley');  // set by immediate write
        var written = runCascadeEndGuard({
            wasSiteSwitch: false, lastSwitchedToSiteId: 'russley', smSiteId: 'burns', ls
        });
        expect(written).toBeNull();
        // _last unchanged — still points to russley
        expect(ls.getItem('gilba_turf_profiles_last')).toBe('__site__russley');
    });

    test('full scenario: Burns→Russley — immediate write + cascades all produce Russley', () => {
        var ls = makeStorage();
        // 1. Page loads with Burns GC as server-initial site
        ls.setItem('gilba_turf_profiles_last', '__site__burns');

        // 2. gaip:site-changed for Russley fires → _lastSwitchedToSiteId = russley
        var lastSwitchedToSiteId = 'russley';

        // 3. restoreNewSiteConfig: immediate write
        ls.setItem('gilba_turf_profiles_last', '__site__' + lastSwitchedToSiteId);
        expect(ls.getItem('gilba_turf_profiles_last')).toBe('__site__russley');

        // 4. Russley site-switch cascade ends: wasSiteSwitch=true, SM=russley
        runCascadeEndGuard({
            wasSiteSwitch: true, lastSwitchedToSiteId, smSiteId: 'russley', ls
        });
        expect(ls.getItem('gilba_turf_profiles_last')).toBe('__site__russley');

        // 5. Burns page-load cascade ends LATER: wasSiteSwitch=false, SM=burns
        //    Must be skipped because lastSwitchedToSiteId is set
        runCascadeEndGuard({
            wasSiteSwitch: false, lastSwitchedToSiteId, smSiteId: 'burns', ls
        });
        expect(ls.getItem('gilba_turf_profiles_last')).toBe('__site__russley');
    });
});
