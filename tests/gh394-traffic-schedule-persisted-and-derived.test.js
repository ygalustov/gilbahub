/**
 * GH-394 — D31 stage 3: the traffic modifier stops being inert.
 *
 * Two links were missing and this ticket adds both:
 *
 *   1. PERSISTENCE. Settings > Traffic & Wear collected the match and training
 *      schedule and wrote it to localStorage['gilba_traffic_state_<siteId>']
 *      and nowhere else, so nothing reached the server, the Word export, or a
 *      second browser. It is now saved in the site's gaip config as
 *      `config.traffic = { schedule, savedAt }` — and, because
 *      site-config-persistence.js's snapshotConfig() rebuilds a config from a
 *      fixed list of keys, `traffic` had to join that list or the first site
 *      switch on any hub page would PUT a snapshot without it.
 *
 *   2. DERIVATION. deriveTrafficIntensity() in the shared input adapter turns
 *      that schedule into a level, so the Plan page and the export cannot
 *      derive it differently — the input-divergence class the adapter exists
 *      to close.
 *
 * The settled decisions, each pinned below:
 *   rule (D-10)  matches/week > 3 -> extreme, > 1 -> high, else moderate;
 *                an empty or unsaved schedule -> moderate, so no existing site
 *                moves until someone saves a schedule.
 *   table (D-2)  { low 0.85, moderate 1.0, high 1.15, extreme 1.3 }.
 *   scope (D-3)  turf.turfType === 'sports' only. NOT surfaceType — GH-387 was
 *                caused by exactly that mix-up.
 *   point        the modifier scales the ANNUAL N once, upstream, before the
 *                other nutrients are derived from it. Applying it per nutrient
 *                as well would give 1.3225x instead of 1.15x.
 *
 * Runs the real adapter and the real computeProgram(), so the "applied once"
 * assertions are measured, not asserted about the source text.
 */

'use strict';

const fs = require('fs');
const path = require('path');

global.window = global.window || {};
global.document = global.document || {
    readyState: 'complete',
    addEventListener: function () {},
    getElementById: function () { return null; },
    querySelector: function () { return null; },
    querySelectorAll: function () { return []; }
};
global.console = { log: function () {}, warn: function () {}, error: function () {}, info: function () {} };
global.localStorage = { getItem: function () { return null; }, setItem: function () {} };

const Core = require('../assets/nutrition-requirement-core.js');
global.window.NutritionRequirementCore = Core;
const Inputs = require('../assets/nutrition-program-inputs.js');
global.window.GAIP_NutritionProgramInputs = Inputs;
global.window.GilbaGrowthPotentialEngine = require('../assets/growth-potential-engine.js');
require('../assets/nutrition-calendar.js');
const Calendar = global.window.GilbaNutritionCalendar;

function read(f) { return fs.readFileSync(path.join(__dirname, '../assets/', f), 'utf8'); }

// ─────────────────────────── the rule (decision D-10) ───────────────────────

describe('GH-394 — deriveTrafficIntensity(): decision D-10, rung by rung', () => {
    const t = (matches, turfType) => Inputs.deriveTrafficIntensity({ matchesPerWeek: matches }, turfType || 'sports');

    test('> 3 matches/week is extreme (x1.3)', () => {
        expect(t(4)).toMatchObject({ level: 'extreme', modifier: 1.3, source: 'schedule' });
        expect(t(3.5).level).toBe('extreme');
        expect(t(7).level).toBe('extreme');
    });

    test('exactly 3 is HIGH, not extreme — the rule is strictly greater than 3', () => {
        expect(t(3)).toMatchObject({ level: 'high', modifier: 1.15 });
    });

    test('> 1 matches/week is high (x1.15)', () => {
        expect(t(2)).toMatchObject({ level: 'high', modifier: 1.15, source: 'schedule' });
        expect(t(1.5).level).toBe('high');
    });

    test('exactly 1 is MODERATE, not high — the rule is strictly greater than 1', () => {
        expect(t(1)).toMatchObject({ level: 'moderate', modifier: 1.0 });
    });

    test('a deliberately saved zero is still an answer: moderate, sourced from the schedule', () => {
        expect(t(0)).toMatchObject({ level: 'moderate', modifier: 1.0, source: 'schedule', matchesPerWeek: 0 });
    });

    test('an empty or unsaved schedule is moderate — no site moves until someone saves one', () => {
        [null, undefined, {}, { matchesPerWeek: null }, { matchesPerWeek: '' },
            { sessionsPerWeek: 4 }].forEach((schedule) => {
            expect(Inputs.deriveTrafficIntensity(schedule, 'sports'))
                .toMatchObject({ level: 'moderate', modifier: 1.0, source: 'no-schedule' });
        });
    });

    test('every level it can return takes its modifier from the one shared table (decision D-2)', () => {
        expect(Inputs.TRAFFIC_MODIFIERS).toEqual({ low: 0.85, moderate: 1.0, high: 1.15, extreme: 1.3 });
        [0, 1, 2, 4].forEach((m) => {
            const r = t(m);
            expect(r.modifier).toBe(Inputs.TRAFFIC_MODIFIERS[r.level]);
        });
    });
});

describe('GH-394 — the sports-only gate (decision D-3)', () => {
    test('golf, lawns, an absent type and an unrecognised one are all x1.0 whatever the schedule says', () => {
        ['golf', 'lawns', 'bowling', undefined, null, ''].forEach((turfType) => {
            expect(Inputs.deriveTrafficIntensity({ matchesPerWeek: 7 }, turfType))
                .toMatchObject({ level: 'moderate', modifier: 1.0, source: 'not-sports' });
        });
    });

    test('the gate reads turfType, NOT surfaceType — GH-387 was that exact mix-up', () => {
        // 'greens' / 'fairways' / 'tees' / 'soccer' are surfaceType values. A
        // surfaceType of 'sports' arriving where turfType belongs must not be
        // what opens the gate, and a real sports site whose surface happens to
        // be called 'soccer' must not be closed out by it.
        ['greens', 'fairways', 'tees', 'soccer'].forEach((surfaceType) => {
            expect(Inputs.deriveTrafficIntensity({ matchesPerWeek: 7 }, surfaceType).source).toBe('not-sports');
        });
        expect(Inputs.deriveTrafficIntensity({ matchesPerWeek: 7 }, 'sports').level).toBe('extreme');
    });
});

describe('GH-394 — placeholder immunity: the derivation reads the SAVED schedule and nothing else', () => {
    const src = read('nutrition-program-inputs.js');

    test('the legacy DOM input .gaip-matches-week (value="2") is never read here', () => {
        // legacy-hub-markup.blade.php hard-codes value="2" on it, which under
        // the "> 1" rule would silently make every sports site `high`. The
        // name appears in this file's docblock as the warning it is; what must
        // not exist is a DOM read of it, or of the Settings form field.
        expect(src).not.toMatch(/querySelector[^\n]*gaip-matches-week/);
        expect(src).not.toMatch(/getElementById[^\n]*matches/);
        expect(src).not.toMatch(/stg-tw-matches/);
    });

    test('no default of 2 is substituted for a missing matches count', () => {
        expect(Inputs.deriveTrafficIntensity({}, 'sports').matchesPerWeek).toBeNull();
        expect(Inputs.deriveTrafficIntensity({ matchesPerWeek: null }, 'sports').level).toBe('moderate');
    });

    test('the whole schedule is read from the site config, not from any DOM or storage key', () => {
        expect(src).toMatch(/cfg\.traffic && cfg\.traffic\.schedule/);
        expect(src).not.toMatch(/localStorage\.getItem\(\s*['"]gilba_traffic_state/);
    });
});

// ──────────────────── the resolved contract on a real config ────────────────

const SITE = 'site-test1-sports';
const CFG_SPORTS = {
    turf: { species: 'Perennial Ryegrass', methodology: 'mlsn', turfType: 'sports', subCategory: 'soccer', nProgram: 250 },
    traffic: { schedule: { matchesPerWeek: 2, sessionsPerWeek: 3 }, savedAt: '2026-09-10T00:00:00.000Z' },
    nutritionCalendarProgram: {
        meta: { clippingManagement: 'collected', annualNBase: 120 },
        adjustments: { target_n: 120, traffic_modifier: 1 }
    }
};

function resolve(cfg, extra) {
    const savedHub = global.GAIP_HUB_CONFIG;
    global.GAIP_HUB_CONFIG = { activeSiteId: SITE, soilTexture: 'sand' };
    try {
        return Inputs.resolveSiteProgramInputs(Object.assign({
            siteId: SITE, siteConfig: cfg, planForm: null
        }, extra || {}));
    } finally {
        if (savedHub === undefined) delete global.GAIP_HUB_CONFIG; else global.GAIP_HUB_CONFIG = savedHub;
    }
}

describe('GH-394 — resolveSiteProgramInputs() scales the annual N once, upstream', () => {
    test('a sports site with 2 matches/week: base 120 -> 138, stamped "schedule"', () => {
        const r = resolve(CFG_SPORTS);
        expect(r.trafficIntensity).toBe('high');
        expect(r.trafficModifier).toBe(1.15);
        expect(r.annualNBase).toBe(120);
        expect(r.annualN).toBe(138);          // Math.round(120 * 1.15)
        expect(r.sources.trafficIntensity).toBe('schedule');
    });

    test('4 matches/week takes the same site to extreme: 120 -> 156', () => {
        const cfg = JSON.parse(JSON.stringify(CFG_SPORTS));
        cfg.traffic.schedule.matchesPerWeek = 4;
        const r = resolve(cfg);
        expect(r.trafficIntensity).toBe('extreme');
        expect(r.annualN).toBe(156);          // Math.round(120 * 1.3)
    });

    test('the golf control: identical schedule, no movement at all', () => {
        const cfg = JSON.parse(JSON.stringify(CFG_SPORTS));
        cfg.turf.turfType = 'golf';
        const r = resolve(cfg);
        expect(r.trafficIntensity).toBe('moderate');
        expect(r.trafficModifier).toBe(1.0);
        expect(r.annualN).toBe(120);
        expect(r.sources.trafficIntensity).toBe('not-sports');
    });

    test('a sports site with no saved schedule is unchanged — the no-movement guarantee', () => {
        const cfg = JSON.parse(JSON.stringify(CFG_SPORTS));
        delete cfg.traffic;
        const r = resolve(cfg);
        expect(r.annualN).toBe(120);
        expect(r.annualNBase).toBe(120);
        expect(r.sources.trafficIntensity).toBe('no-schedule');
    });

    test('the live Plan form supplies the BASE, and traffic scales that base', () => {
        const r = resolve(CFG_SPORTS, { planForm: { annualN: 200, clippingManagement: 'collected' } });
        expect(r.annualNBase).toBe(200);
        expect(r.annualN).toBe(230);          // Math.round(200 * 1.15)
        expect(r.sources.annualN).toBe('plan');
    });

    test('resolveAnnualN() rounds to a whole kg (287.5 -> 288), in one place', () => {
        expect(Inputs.resolveAnnualN({ base: 250, trafficModifier: 1.15 })).toBe(288);
        expect(Inputs.resolveAnnualN({ base: 250, trafficModifier: 1.3 })).toBe(325);
        expect(Inputs.resolveAnnualN({ base: 120, trafficModifier: 1.15 })).toBe(138);
    });
});

// ─────────────── applied once, and never compounding across saves ───────────

const MONTHLY_TEMPS_0_11 = [20, 20, 18, 15, 12, 9, 8, 9, 11, 14, 17, 19];

function planInputs(overrides) {
    return Object.assign({
        annualNOverride: 120,
        traffic: 'moderate',
        trafficModifier: 1.0,
        clippingManagement: 'collected',
        bulkDensity: 1.4,
        soilDepth: 10,
        methodology: 'mlsn',
        species: 'perennialRyegrass',
        speciesDisplay: 'Perennial Ryegrass',
        soilTexture: 'loam',
        isC4: false,
        distribution: 'gp_weighted',
        monthlyTemps: MONTHLY_TEMPS_0_11,
        soilPpm: { P: 25, K: 45, Ca: 400, Mg: 60, S: 20 },
        tissuePercent: null
    }, overrides);
}

describe('GH-394 — the modifier scales the annual N and NOTHING else', () => {
    const neutral = Calendar.computeProgram(planInputs());
    const high = Calendar.computeProgram(planInputs({ traffic: 'high', trafficModifier: 1.15 }));

    test('the annual N target moves by exactly the modifier', () => {
        expect(neutral.adjustments.target_n).toBe(120);
        expect(high.adjustments.target_n).toBe(138);
        expect(high.adjustments.traffic_modifier).toBe(1.15);
    });

    test('removal follows the scaled N once — every figure derived by hand from the ratio table', () => {
        // Perennial ryegrass REMOVAL_RATES (nutrition-requirement-core.js):
        // N 180, P 18, K 100, Ca 30, Mg 15, S 10 -> ratios to N of 0.10,
        // 0.5556, 0.1667, 0.08333, 0.05556. Removal is rounded to whole kg.
        //   at N 120: 12.0, 66.67, 20.0, 10.0, 6.67   -> 12, 67, 20, 10, 7
        //   at N 138: 13.8, 76.67, 23.0, 11.5,  7.67  -> 14, 77, 23, 12, 8
        expect(neutral.annual_removal).toMatchObject({ N: 120, P: 12, K: 67, Ca: 20, Mg: 10, S: 7 });
        expect(high.annual_removal).toMatchObject({ N: 138, P: 14, K: 77, Ca: 23, Mg: 12, S: 8 });
    });

    test('a SECOND, per-nutrient application would print these instead — and does not', () => {
        // 120 x 1.15 x 1.15 = 158.7 -> 159, whose removal is 16, 88, 27, 13, 9.
        const doubled = Calendar.computeProgram(planInputs({
            annualNOverride: high.adjustments.target_n, traffic: 'high', trafficModifier: 1.15
        }));
        expect(doubled.annual_removal).toMatchObject({ N: 159, P: 16, K: 88, Ca: 27, Mg: 13, S: 9 });
        expect(high.annual_removal.K).not.toBe(doubled.annual_removal.K);
    });

    test('the PRE-traffic base is what is persisted, so a regenerate cannot compound it', () => {
        expect(high.meta.annualNBase).toBe(120);
        expect(high.adjustments.target_n).toBe(138);
        // Restoring feeds meta.annualNBase back into the Annual N input
        // (nutrition-calendar.js restoreFromPersisted()). Regenerating from it
        // must land on the same target, not on 138 x 1.15 = 159.
        const again = Calendar.computeProgram(planInputs({
            annualNOverride: high.meta.annualNBase, traffic: 'high', trafficModifier: 1.15
        }));
        expect(again.adjustments.target_n).toBe(138);
        expect(again.meta.annualNBase).toBe(120);
    });

    test('the restore path reads meta.annualNBase, not the adjusted target_n', () => {
        const cal = read('nutrition-calendar.js');
        expect(cal).toMatch(/_meta\.annualNBase > 0/);
        expect(cal).not.toMatch(/annualNInput\.value = Math\.round\(program\.adjustments\.target_n\)/);
    });
});

describe('GH-394 — the Combined export applies it once too', () => {
    // Source-driven rather than hand-copied: whichever `_siteInputs.<field>`
    // word-export-combined.js actually assigns to annualNOverride is the field
    // this test then feeds computeProgram(). Hand-copying the wiring would let
    // the file drift back to the already-scaled N with this test still green.
    const combined = read('word-export-combined.js');
    const nField = (combined.match(/perSampleInputs\.annualNOverride = _siteInputs\.(\w+);/) || [])[1];
    const modField = (combined.match(/perSampleInputs\.trafficModifier = _siteInputs\.(\w+);/) || [])[1];

    test('driving computeProgram() with the fields that file really passes lands on the adapter\'s own annualN', () => {
        expect(nField).toBeDefined();
        const r = resolve(CFG_SPORTS);
        const prog = Calendar.computeProgram(planInputs({
            annualNOverride: r[nField],
            traffic: r.trafficIntensity,
            trafficModifier: modField ? r[modField] : undefined
        }));
        expect(prog.adjustments.target_n).toBe(r.annualN);
        expect(prog.adjustments.target_n).toBe(138);
    });

    test('the pre-GH-394 wiring (handing it the already-scaled N) is what 1.3225 looks like', () => {
        const r = resolve(CFG_SPORTS);
        const doubled = Calendar.computeProgram(planInputs({
            annualNOverride: r.annualN,               // the bug: already x1.15
            traffic: r.trafficIntensity,
            trafficModifier: r.trafficModifier
        }));
        expect(doubled.adjustments.target_n).toBe(159);   // Math.round(138 * 1.15)
        expect(doubled.adjustments.target_n).not.toBe(r.annualN);
    });
});

// ───────────────────────────── persistence wiring ───────────────────────────

describe('GH-394 — the schedule reaches the server and survives a site switch', () => {
    test('Settings > Traffic & Wear PUTs config.traffic and keeps the localStorage mirror', () => {
        const s = read('settings-init.js');
        expect(s).toMatch(/_tcfg\.traffic = \{ schedule: state, savedAt: new Date\(\)\.toISOString\(\) \};/);
        expect(s).toMatch(/apiFetch\('PUT', '\/sites\/' \+ encodeURIComponent\(siteId\) \+ '\/config\/gaip', \{ config: _tcfg \}\)/);
        expect(s).toMatch(/localStorage\.setItem\(getTrafficStateKey\(\), JSON\.stringify\(state\)\)/);
        // the three programme keys must not ride along on a possibly-stale clone
        expect(s).toMatch(/delete _tcfg\.nutritionCalendarProgram;/);
    });

    test('the form reloads from the config first, so a second device sees the schedule', () => {
        const s = read('settings-init.js');
        expect(s).toMatch(/cfg\.traffic && cfg\.traffic\.schedule\) return cfg\.traffic\.schedule/);
        expect(s).toMatch(/var saved = getTrafficSchedule\(\) \|\| \{\};/);
    });

    test('`traffic` is in snapshotConfig()\'s carry-forward list — without it the first site switch wipes it', () => {
        const p = read('site-config-persistence.js');
        const carry = p.match(/\['nutritionProgram', 'nutritionCalendarProgram', 'appliedMonthlyN', 'maxNPerMonth', 'nzDistributor', 'traffic'\]/g);
        // one in the server-pull merge, one in snapshotConfig()
        expect(carry).not.toBeNull();
        expect(carry.length).toBe(2);
    });

    test('a coordinate or species drift drops the cached programmes but NOT the schedule', () => {
        const p = read('site-config-persistence.js');
        // isProgram gates the drop and is false for 'traffic'
        expect(p).toMatch(/var isProgram = \(key === 'nutritionProgram' \|\| key === 'nutritionCalendarProgram'\);/);
    });

    test('the Plan page\'s Recovery section reads the persisted schedule, not only localStorage', () => {
        const u = read('plan-ui.js');
        expect(u).toMatch(/siteConfig && siteConfig\.traffic && siteConfig\.traffic\.schedule/);
    });

    test('the Clegg readings restored into the legacy DOM come from the same record', () => {
        const p = read('site-config-persistence.js');
        expect(p).toMatch(/\(config\.traffic && config\.traffic\.schedule\) \|\|/);
    });
});
