/**
 * ┌──────────────────────────────────────────────────────────────────────────┐
 * │ THIS FILE IS RED ON PURPOSE. Read this before "fixing" it.               │
 * └──────────────────────────────────────────────────────────────────────────┘
 *
 * ONE test fails: "the normals that entered the calculation are the site's own
 * normals" (GH-522). It fails because of a defect in the PRODUCT, not in the
 * test, and it was left failing by decision (GH-523, the owner's coordinator,
 * 18.09.2026): "a red test with its reason named is more honest than a green
 * one with a caveat in a comment".
 *
 * WHAT IS WRONG. `resolveExportInputs()` resolves NO coordinates on the Plan
 * page, for every site, and therefore no climate normals — `climateNormals`
 * null, `climateReason` 'no-coordinates'. Measured on Test5 - NZ, whose
 * coordinates are right there on the page:
 *     askedFor / stamped site id  019e96f3-…   (the right site)
 *     resolvedLat / resolvedLon   null / null
 *     GAIP_SITE_CONFIG.location   { lat: -36.8508827, lon: 174.7644881 }
 *     GAIP_SITE_CONFIG.latitude   null
 *     GAIP_SiteConfig store        absent on this page
 * `FIELD_PATHS.lat` is `['site-row', 'latitude']`
 * (nutrition-program-inputs.js:682): GH-473 decided the site ROW owns the
 * coordinates and that the `config.location` copy — reached by one write path
 * of three — must not be read. The row is served by the `GAIP_SiteConfig`
 * store, and plan.blade.php does not load site-config-persistence.js, so on
 * that page there is no store to ask. reports/export.blade.php does load it,
 * which is why the same resolver answers there.
 *
 * OLDER THAN THE WORK THAT FOUND IT. Against the 08:51 copy of
 * nutrition-program-inputs.js (commit 39ac6ee, before 18.09's methodology
 * delivery): the coordinate path, FIELD_PATHS, getSiteConfig and the whole
 * climate block are identical, and the day's only change to that file is the
 * methodology block. plan.blade.php has never loaded the store.
 *
 * HOW NOT TO MAKE IT GREEN — both of these were considered and refused:
 *   1. Reading `config.location.lat` in the resolver, or in this test. That is
 *      the copy GH-473 deliberately stopped reading; re-reading it here would
 *      quietly reverse a recorded decision in the one place nobody would look.
 *   2. Dropping or weakening the assertion. Then the row graded `entered` goes
 *      back to being checked against `p.in.monthlyTemps` — what computeProgram
 *      was handed — which is the row checked against itself-as-received, and is
 *      exactly the blindness M3 exposed.
 *
 * WHAT WILL MAKE IT GREEN: a product decision about where the Plan page gets a
 * site's coordinates — the store loaded there too, the server-rendered config
 * carrying `latitude`/`longitude` as the row does, or the resolver given a
 * second sanctioned source. Any of those, and this test passes unchanged. It is
 * with the analyst; it is not a test problem and must not be closed here.
 */

/**
 * GH-428 — the calculation-trace block against what actually entered the
 * calculation, not against what the page displays.
 *
 * ============================================================================
 * LIFETIME. This file belongs to the GH-425 block and MUST BE DELETED WITH IT.
 * It is listed in the removal instructions at the top of
 * assets/plan-calc-trace.js as step 3. It asserts things about rows that only
 * exist while the block does; there is no version of it that outlives the
 * block. The part of GH-428 that IS durable — that the recommender publishes
 * the temperatures it ran on, and that no context carries a dead one — lives in
 * tests/gh428-outer-soil-temp.test.js, which survives.
 * ============================================================================
 *
 * WHY IT EXISTS. The block already checks itself: it compares its headline
 * figures against the Nutrient Delivery Summary table it sits under. That is
 * DISPLAYED against DISPLAYED. It cannot catch the defect this ticket fixed,
 * and did not: the block printed "Soil temperature (product selection) 13 degC",
 * which was a real number, present in the object it read, resolved from a real
 * source — and discarded by the recommender before any product was chosen. The
 * summary table says nothing about soil temperature, so the self-check was
 * green throughout.
 *
 * WHAT THIS DOES INSTEAD. Before Generate is pressed it wraps the engines in
 * the live page — `GilbaNutritionCalendar.computeProgram`, the regional
 * recommender's `generateProgram`, and the functions inside the recommender
 * that CONSUME a soil temperature or a CEC — and records, per call, the
 * arguments they received and a deep clone of what they returned. Then it reads
 * the rendered block and asserts every row against those recordings.
 *
 * THE THREE GRADES OF PROVENANCE, named per row, because they are not equally
 * strong:
 *
 *   consumed  the value was recorded at the moment a calculation consumed it
 *             (`getReleaseTechEfficiency(tech, soilTemp)`, `getReleasePreference
 *             (context)`). This is the only grade that can catch a figure which
 *             is in the object but drives nothing — i.e. this ticket's defect.
 *   entered   the value was recorded as an argument to `computeProgram()`, so
 *             it is what went IN, captured from a different object than the one
 *             the block reads (which is the return).
 *   produced  the value exists only as engine output (a generation timestamp,
 *             a post-traffic target, the growth-potential series). The
 *             recording is the returned object deep-cloned AT RETURN TIME, so a
 *             later mutation of the live object — the block reading something
 *             that no longer is what the engine produced — still fails.
 *
 * THE TRAP THIS AVOIDS. A comparison that holds the same object on both sides
 * agrees forever. Nothing below reads `GilbaNutritionCalendar.program` or
 * `GAIP_NUTRITION_PROGRAM` — the two objects the block reads. Every expected
 * value comes from the wrapper recordings. That is why the drift test below can
 * fail at all.
 *
 * AND IT IS PROVEN TO FAIL. After the clean pass, the test mutates the live
 * objects the block reads — a plausible soil-temperature series, a plausible
 * annual N — remounts the block, and asserts that the SAME checker now names
 * exactly those rows, while the block's own self-check does not notice. That is
 * the observed failure, not an argument that one would occur.
 *
 * Run: GILBA_E2E=1 npx jest tests/e2e/gh428-calc-trace-provenance-live.test.js \
 *          --runInBand --testTimeout=900000
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { guardStand, fillOwnAnnualN } = require('./lib/stand-guard');
let standGuard = null;

const ENABLED = process.env.GILBA_E2E === '1';

let credentials = {};
try {
    credentials = JSON.parse(fs.readFileSync(
        process.env.GILBA_E2E_CREDENTIALS || path.join(__dirname, '.e2e-credentials.json'), 'utf8'));
} catch (e) { credentials = {}; }

const BASE_URL = process.env.GILBA_E2E_URL || credentials.url || 'http://127.0.0.1:8080';
const EMAIL = process.env.GILBA_E2E_EMAIL || credentials.email;
const PASSWORD = process.env.GILBA_E2E_PASSWORD || credentials.password;

let chromium = null;
try { ({ chromium } = require('playwright')); } catch (e) { /* reported below */ }

// One New Zealand site (the only region whose recommender consumes a soil
// temperature and a CEC at all) and one Australian one (whose recommender
// consumes neither, so the two "this region takes no ..." rows are exercised
// as themselves rather than assumed).
const CASES = [
    { key: 'test5', name: 'Test5 - NZ', pick: 'Soccer', region: 'nz' },
    { key: 'burns', name: 'Burns', pick: 'Putter Green', region: 'au' },
];

const out = (s) => process.stdout.write('[gh428-prov] ' + s + '\n');

// ===========================================================================
// Page-side: wrap the engines. Installed before Generate, removed by nothing —
// the wrappers are transparent and return exactly what they wrapped.
// ===========================================================================

/* istanbul ignore next — evaluated in the page, not in node */
function installProbes() {
    if (window.__gh428prov && window.__gh428prov.installed) {
        // Reset the recordings for the next site, keep the wrappers.
        window.__gh428prov.computeProgram = [];
        window.__gh428prov.recommender = [];
        window.__gh428prov.consumedSoilTemp = [];
        window.__gh428prov.consumedCEC = [];
        return 'reset';
    }
    var rec = window.__gh428prov = {
        installed: true,
        computeProgram: [], recommender: [], consumedSoilTemp: [], consumedCEC: [],
    };
    function clone(o) { try { return JSON.parse(JSON.stringify(o)); } catch (e) { return null; } }

    var C = window.GilbaNutritionCalendar;
    if (C && typeof C.computeProgram === 'function') {
        var origCompute = C.computeProgram;
        C.computeProgram = function (inputs) {
            var snapIn = clone(inputs);            // before, in case the engine mutates it
            var outv = origCompute.apply(this, arguments);
            rec.computeProgram.push({ inputs: snapIn, output: clone(outv) });
            return outv;
        };
    }

    ['PrebbleRecommender', 'AuFertiliserRecommender', 'UkFertiliserRecommender'].forEach(function (n) {
        var R = window[n];
        if (!R) return;
        ['generateProgram', 'generateAnnualProgram'].forEach(function (fnName) {
            if (typeof R[fnName] !== 'function') return;
            var g = R[fnName];
            R[fnName] = function (cal, ctx) {
                var snapCal = clone(cal), snapCtx = clone(ctx);
                var outv = g.apply(this, arguments);
                rec.recommender.push({ name: n + '.' + fnName, calendar: snapCal, context: snapCtx, output: clone(outv) });
                return outv;
            };
        });
        // The points at which a temperature is actually consumed: the
        // release-efficiency curve, and the two product choosers that read
        // `context.soilTemp` off whatever context they are handed.
        if (typeof R.getReleaseTechEfficiency === 'function') {
            var e = R.getReleaseTechEfficiency;
            R.getReleaseTechEfficiency = function (tech, soilTemp) {
                rec.consumedSoilTemp.push(soilTemp);
                return e.apply(this, arguments);
            };
        }
        ['selectNitrogenSource', 'selectFoliarNitrogen'].forEach(function (fnName) {
            if (typeof R[fnName] !== 'function') return;
            var sel = R[fnName];
            R[fnName] = function (products, monthData, ctx) {
                if (ctx && typeof ctx === 'object') rec.consumedSoilTemp.push(ctx.soilTemp);
                return sel.apply(this, arguments);
            };
        });
        ['getReleasePreference', 'estimateLongevity'].forEach(function (fnName) {
            if (typeof R[fnName] !== 'function') return;
            var f = R[fnName];
            var ctxArg = (fnName === 'getReleasePreference') ? 0 : 1;
            R[fnName] = function () {
                var ctx = arguments[ctxArg];
                if (ctx && typeof ctx === 'object') rec.consumedCEC.push(ctx.soilCEC);
                return f.apply(this, arguments);
            };
        });
    });
    return 'installed';
}

/* istanbul ignore next — evaluated in the page, not in node */
function readBlockAndProvenance() {
    function txt(el) { return el ? (el.textContent || '').replace(/\s+/g, ' ').trim() : ''; }

    var host = document.querySelector('[data-gaip-calc-trace-host]');
    var rows = {};
    var sections = {};
    var selfCheck = { count: 0, allGood: false };
    if (host) {
        var secs = Array.prototype.slice.call(host.querySelectorAll('.gaip-ctrace-sec'));
        var inputTable = secs.length ? secs[0].querySelector('table') : null;
        if (inputTable) {
            Array.prototype.slice.call(inputTable.querySelectorAll('tbody tr')).forEach(function (tr) {
                var tds = tr.children;
                if (!tds || tds.length < 2) return;
                // The note is a child div of the value cell; split it off so the
                // value read here is the value the row states.
                var cell = tds[1].cloneNode(true);
                var noteEl = cell.querySelector('.gaip-ctrace-note');
                var note = noteEl ? txt(noteEl) : null;
                if (noteEl && noteEl.parentNode) noteEl.parentNode.removeChild(noteEl);
                rows[txt(tds[0])] = { value: txt(cell), note: note, source: tds[2] ? txt(tds[2]) : null };
            });
        }
        secs.forEach(function (s) {
            var h5 = s.querySelector('h5');
            var name = h5 ? txt(h5) : '';
            if (['N', 'P', 'K'].indexOf(name) < 0) return;
            sections[name] = {
                steps: Array.prototype.slice.call(s.querySelectorAll('.gaip-ctrace-step')).map(function (st) {
                    return { label: txt(st.children[0]), working: txt(st.children[1]), result: txt(st.children[2]) };
                }),
                ledger: Array.prototype.slice.call(s.querySelectorAll('.gaip-ctrace-led li')).map(function (li) {
                    return txt(li);
                }),
            };
        });
        var m = txt(host).match(/All (\d+) figures match/);
        selfCheck = { count: m ? parseInt(m[1], 10) : 0, allGood: !!host.querySelector('.gaip-ctrace-ok') };
    }

    var prov = window.__gh428prov || null;
    // The ledger the block itself would build, but over the RECORDED recommender
    // output rather than the live one — same module, different object, which is
    // what makes "the block accumulated a different programme" visible.
    var recordedLedger = null;
    if (prov && prov.recommender.length && window.GAIP_NutritionDelivery) {
        var last = prov.recommender[prov.recommender.length - 1];
        if (last.output && last.output.monthly) {
            recordedLedger = window.GAIP_NutritionDelivery.accumulate(last.output.monthly);
        }
    }

    return {
        found: !!host,
        rows: rows,
        sections: sections,
        selfCheck: selfCheck,
        prov: prov ? {
            computeProgram: prov.computeProgram,
            recommender: prov.recommender,
            consumedSoilTemp: prov.consumedSoilTemp,
            consumedCEC: prov.consumedCEC,
        } : null,
        recordedLedger: recordedLedger,
        // GH-522: the site's monthly normals as the CLIMATE SERVICE holds them,
        // read here rather than taken from the calculation. Every other figure
        // in this file is checked against what the engines received or produced;
        // this is the one source outside them, and the reason is in the test
        // that uses it.
        siteNormals: (function () {
            try {
                const NPI = window.GAIP_NutritionProgramInputs;
                const id = NPI && typeof NPI.getActiveSiteId === 'function' ? NPI.getActiveSiteId() : null;
                if (!id) return { error: 'no active site id' };
                const r = NPI.resolveExportInputs({ siteId: id });
                const cn = r ? r.climateNormals : null;
                if (!cn) {
                    // The reason, not just the absence: `climateReason` is
                    // resolved beside the normals and says whether the site has
                    // no coordinates, the service is unavailable, or it simply
                    // has not resolved yet. "Not observed" would otherwise be a
                    // statement about the probe.
                    // What the resolver was looking at, so "no-coordinates" can
                    // be told apart from "the probe asked the wrong object".
                    const site = r ? r.site : null;
                    const gsc = window.GAIP_SITE_CONFIG || null;
                    return { error: 'no climateNormals on the resolved inputs',
                        reason: r ? r.climateReason : 'no resolved inputs at all',
                        resolvedSiteId: site ? site.id : null,
                        resolvedLat: site ? site.location && site.location.lat : null,
                        resolvedLon: site ? site.location && site.location.lon : null,
                        askedFor: id,
                        stampedSiteId: window.GAIP_SITE_CONFIG_SITE_ID || null,
                        siteConfigStoreHasGetSite: !!(window.GAIP_SiteConfig
                            && typeof window.GAIP_SiteConfig.getSite === 'function'),
                        pageConfigLocation: gsc ? (gsc.location || null) : null,
                        pageConfigLatLon: gsc ? [gsc.latitude, gsc.longitude] : null };
                }
                const t = cn.monthlyTemps || cn.temps || cn;
                const twelve = [];
                for (let m = 0; m < 12; m++) {
                    const v = (t && (t[m] != null ? t[m] : t[m + 1]));
                    twelve.push(v == null ? null : Number(v));
                }
                return { temps: twelve };
            } catch (e) { return { error: String(e && e.message).slice(0, 160) }; }
        })(),
    };
}

// ===========================================================================
// Node-side: the checker. Pure — it is handed the rendered rows and the
// recordings and returns the mismatches, so the drift test can run it twice.
// ===========================================================================

const EPS = 1e-4;

/**
 * Every number a rendered cell states, in order. Unit tokens that contain their
 * own digits are removed first — "meq/100g" and "g/cm3" would otherwise
 * contribute a 100 and a 3 that no engine ever produced.
 */
function numbersIn(s) {
    const cleaned = String(s === null || s === undefined ? '' : s)
        .replace(/meq\s*\/\s*100\s*g/gi, ' ')
        .replace(/g\s*\/\s*cm3/gi, ' ')
        .replace(/cm3/gi, ' ');
    return (cleaned.match(/-?\d+(?:\.\d+)?/g) || []).map(Number);
}
function sameNumbers(a, b) {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) if (Math.abs(a[i] - b[i]) > EPS) return false;
    return true;
}
function norm(s) { return String(s === null || s === undefined ? '' : s).replace(/\s+/g, ' ').trim().toLowerCase(); }

/**
 * The row map. Each entry says where the printed value must come from, and at
 * which grade. `expect` returns either {numbers: [...]} — the numbers the cell
 * must state, in order — or {text: '...'} — what the cell must say.
 *
 * Rows an engine recording cannot reach are listed in UNTIED with the reason;
 * the coverage test asserts UNTIED plus these labels is every row on screen.
 */
/** A text expectation; an absent value prints as the block's em dash. */
function t(v) { return { text: (v === null || v === undefined || v === '') ? '—' : String(v) }; }

/**
 * What the sufficiency-range row must SAY for a given resolver key. This is a
 * restatement of the specification, not a copy of the renderer: under Ammonium
 * Acetate the key names a real Hill Labs certificate or the generic texture
 * band, and under MLSN/SLAN the flag is stamped 'certificate' by design and
 * must NOT be reported as a certificate (see resolveSufficiencyRanges()).
 */
function rangeWordsMustMention(key, methodology) {
    var aa = /AMMONIUM_ACETATE|COTULA/i.test(String(methodology || ''));
    if (!aa) return 'published range';
    if (key === 'certificate') return 'hill labs';
    if (key === 'texture-fallback') return 'soil texture';
    return String(key || '');
}

const ROW_CHECKS = {
    'Programme generated': { grade: 'produced', expect: (p) => ({ text: p.out.meta.generated }) },
    'Methodology': { grade: 'entered', expect: (p) => ({ text: String(p.in.methodology || '').toUpperCase() }) },
    'Species': { grade: 'entered', expect: (p) => t(p.in.speciesDisplay || p.in.species) },
    'Surface type': { grade: 'entered', expect: (p) => t(p.in.surfaceType) },
    'Hemisphere': { grade: 'entered', expect: (p) => t(p.in.hemisphere) },
    'Coordinates': {
        grade: 'entered',
        expect: (p) => (typeof p.in.latitude === 'number'
            ? { numbers: [p.in.latitude, p.in.longitude] } : { text: '—' })
    },
    'Annual N target (as entered)': { grade: 'entered', expect: (p) => ({ numbers: [p.in.annualNOverride] }) },
    'Traffic intensity': {
        grade: 'entered',
        // "moderate (x 1)": the label entered, and the modifier entered beside it.
        expect: (p) => ({ numbers: [p.out.adjustments.traffic_modifier],
                          contains: String(p.in.traffic || 'moderate') })
    },
    'Annual N after traffic': { grade: 'produced', expect: (p) => ({ numbers: [p.out.adjustments.target_n] }) },
    'Clipping management': { grade: 'entered', expect: (p) => t(p.in.clippingManagement) },
    'Monthly N cap': {
        grade: 'entered',
        expect: (p) => ((p.in.maxNPerMonth === null || p.in.maxNPerMonth === undefined)
            ? { text: '—' } : { numbers: [p.in.maxNPerMonth] })
    },
    'Distribution mode': { grade: 'entered', expect: (p) => t(p.in.distribution) },
    'Soil texture': { grade: 'entered', expect: (p) => t(p.in.soilTexture) },
    'Sample pH': {
        grade: 'entered',
        expect: (p) => ((p.in.pH === null || p.in.pH === undefined) ? { text: '—' } : { numbers: [p.in.pH] })
    },
    'Sample CEC': {
        grade: 'entered',
        expect: (p) => ((p.in.CEC === null || p.in.CEC === undefined)
            ? { text: 'no reading on this sample' } : { numbers: [p.in.CEC] })
    },
    'Bulk density / soil depth': {
        // Entered where the sample carries them; the engine's own default where
        // it does not, which is a produced value and is named as one on screen.
        grade: 'entered where the sample carries them, produced where it does not',
        expect: (p) => ({ numbers: [
            typeof p.in.bulkDensity === 'number' ? p.in.bulkDensity : p.out.soil.bulkDensity,
            typeof p.in.soilDepth === 'number' ? p.in.soilDepth : p.out.soil.soilDepth,
        ] })
    },
    'Tissue analysis': {
        grade: 'entered',
        expect: (p) => {
            const t = p.in.tissuePercent || null;
            const has = !!(t && (typeof t.N === 'number' || typeof t.P === 'number' || typeof t.K === 'number'));
            return has ? { numbers: [t.N, t.P, t.K].filter((v) => typeof v === 'number') }
                       : { text: 'no tissue analysis for this zone' };
        }
    },
    'Years to correct a deficit': {
        grade: 'produced',
        expect: (p) => {
            const d = p.out.requirement_detail;
            if (!d) return { text: '—' };
            return { numbers: [d.P && d.P.yearsToCorrect, d.K && d.K.yearsToCorrect]
                .filter((v) => typeof v === 'number') };
        }
    },
    'Monthly temperature normals': {
        grade: 'entered',
        expect: (p) => {
            const t = p.in.monthlyTemps;
            if (!t) return { text: '—' };
            const twelve = [];
            for (let m = 0; m < 12; m++) twelve.push(Math.round(t[m] * 10) / 10);
            return { numbers: twelve };
        }
    },
    'Growth potential series': {
        grade: 'produced',
        expect: (p) => ({ numbers: p.out.program.monthly.map((m) => Math.round(m.gp * 100)) })
    },
    'Soil temperature (product selection)': {
        grade: 'consumed',
        // THE ROW THIS TICKET IS ABOUT. Checked against the temperatures
        // `getReleaseTechEfficiency()` was actually called with, not against
        // any field of any object the block can see.
        expect: (p) => {
            const consumed = Array.from(new Set(p.consumedSoilTemp.filter((v) => typeof v === 'number')))
                .sort((a, b) => a - b);
            if (!consumed.length) return { text: 'this region\'s recommender takes no soil temperature' };
            return { superset: consumed };
        }
    },
    'CEC (product selection)': {
        grade: 'consumed',
        expect: (p) => {
            const consumed = Array.from(new Set(p.consumedCEC.filter((v) => typeof v === 'number')));
            if (!p.consumedCEC.length) return { text: 'this region\'s recommender takes no CEC input' };
            if (!consumed.length) return { text: 'no reading — the recommender used its own assumption' };
            return { numbers: consumed };
        }
    },
    'Sufficiency range source': {
        grade: 'entered',
        // The resolver's own per-nutrient keys, as they entered computeProgram(),
        // turned into what the row must say by the rule above.
        expect: (p) => ({ mentions: ['P', 'K'].map(function (n) {
            return rangeWordsMustMention((p.in.rangeSources || {})[n], p.out.meta.methodology);
        }).filter(function (w) { return !!w; }) })
    },
};

/** Rows the block prints that no engine recording can stand behind. */
const UNTIED = {};

function checkRows(rows, p) {
    const bad = [];
    Object.keys(ROW_CHECKS).forEach((label) => {
        const spec = ROW_CHECKS[label];
        const row = rows[label];
        if (!row) { bad.push({ label: label, why: 'row absent from the rendered block' }); return; }
        let want;
        try { want = spec.expect(p); } catch (e) {
            bad.push({ label: label, why: 'provenance unavailable: ' + (e && e.message) });
            return;
        }
        if (want.text !== undefined && want.text !== null) {
            if (norm(row.value).indexOf(norm(want.text)) < 0) {
                bad.push({ label: label, grade: spec.grade, printed: row.value, fromEngine: String(want.text) });
            }
            return;
        }
        if (want.contains && norm(row.value).indexOf(norm(want.contains)) < 0) {
            bad.push({ label: label, grade: spec.grade, printed: row.value, fromEngine: want.contains });
            return;
        }
        if (want.numbers) {
            const got = numbersIn(row.value);
            if (!sameNumbers(got, want.numbers.map(Number))) {
                bad.push({ label: label, grade: spec.grade, printed: row.value, fromEngine: want.numbers.join(' / ') });
            }
            return;
        }
        if (want.superset) {
            // Every value the calculation consumed must appear in the row. This
            // is the assertion the old block failed: it printed one number the
            // selection never saw, while the twelve it did see appeared nowhere.
            const got = numbersIn(row.value);
            const missing = want.superset.filter((v) => !got.some((g) => Math.abs(g - v) <= EPS));
            if (missing.length) {
                bad.push({ label: label, grade: spec.grade, printed: row.value,
                           fromEngine: 'consumed but not printed: ' + missing.join(' / ') });
            }
            return;
        }
        if (want.mentions) {
            const missing = want.mentions.filter((w) => norm(row.value).indexOf(norm(w)) < 0);
            if (missing.length) {
                bad.push({ label: label, grade: spec.grade, printed: row.value,
                           fromEngine: 'must mention: ' + missing.join(' / ') });
            }
        }
    });
    return bad;
}

/** The per-nutrient headline figures, against the recordings rather than the page. */
function checkNutrients(sections, p, recordedLedger) {
    const bad = [];
    ['N', 'P', 'K'].forEach((n) => {
        const sec = sections[n];
        if (!sec) { bad.push({ label: n, why: 'nutrient section absent' }); return; }
        const req = p.out.annual_totals[n];
        // Nitrogen's step is "Required (N)"; phosphorus and potassium reach the
        // same figure through whichever requirement branch ran, and the step is
        // named for the branch.
        const reqStep = sec.steps.filter((s) => /^Required|^Requirement/.test(s.label)).slice(-1)[0];
        if (!reqStep) bad.push({ label: n + ' / Required', why: 'step absent' });
        else {
            const got = numbersIn(reqStep.result);
            if (!got.length || Math.abs(got[0] - req) > 1e-3) {
                bad.push({ label: n + ' / Required', grade: 'produced',
                           printed: reqStep.result, fromEngine: String(req) });
            }
        }
        if (recordedLedger) {
            const del = recordedLedger.totals[n];
            const delStep = sec.steps.filter((s) => /^Delivered/.test(s.label))[0];
            if (!delStep) bad.push({ label: n + ' / Delivered', why: 'step absent' });
            else {
                const got = numbersIn(delStep.result);
                if (!got.length || Math.abs(got[0] - del) > 0.05) {
                    bad.push({ label: n + ' / Delivered', grade: 'produced',
                               printed: delStep.result, fromEngine: String(del) });
                }
            }
            // Every application the recommender put in its programme must appear
            // as a ledger line, and no line may appear that it did not.
            const wanted = (recordedLedger.applications || [])
                .filter((a) => a.nutrients && a.nutrients[n]).length;
            if (sec.ledger.length !== wanted) {
                bad.push({ label: n + ' / delivery ledger lines', grade: 'produced',
                           printed: String(sec.ledger.length), fromEngine: String(wanted) });
            }
        }
    });
    return bad;
}

if (!ENABLED) {
    process.stdout.write('[e2e] gh428-calc-trace-provenance-live skipped (needs the live stack)\n');
    test.skip('GH-428 calc-trace provenance (disabled)', () => {});
} else {

let browser = null;
let page = null;
let previousActiveSiteId = null;
const CLEAN = {};
const DRIFT = {};

async function setActiveSite(id) {
    await page.evaluate(async ({ id }) => {
        const t = document.querySelector('meta[name=csrf-token]');
        await fetch('/api/active-site', {
            method: 'PATCH',
            headers: Object.assign({ 'Content-Type': 'application/json', Accept: 'application/json' },
                t ? { 'X-CSRF-TOKEN': t.getAttribute('content') } : {}),
            body: JSON.stringify({ site_id: id }), credentials: 'same-origin'
        });
    }, { id });
}

async function generateOn(site) {
    await page.goto(BASE_URL + '/plan', { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => !!window.GilbaNutritionCalendar, null, { timeout: 30000 });
    await page.waitForTimeout(2500);
    await page.click('a[data-tab="nutrition"]');
    await page.waitForTimeout(1200);
    await page.waitForSelector('#plan-nut-sample-picker .sn-drop-btn', { timeout: 20000 });
    const picked = await page.evaluate((needle) => {
        const btn = document.querySelector('#plan-nut-sample-picker .sn-drop-btn');
        if (!btn) return { ok: false, reason: 'no picker' };
        btn.click();
        const rows = Array.from(document.querySelectorAll('#plan-nut-sample-picker .sn-drop-row[data-sn-idx]'));
        const zones = rows.map((r) => ((r.querySelector('.sn-drop-cell-zone') || {}).textContent || '')
            .replace(/^●\s*/, '').trim());
        const i = zones.indexOf(needle);
        if (i < 0) { btn.click(); return { ok: false, reason: 'zone not in picker', zones: zones }; }
        rows[i].click();
        return { ok: true };
    }, site.pick);
    if (!picked.ok) throw new Error('could not pin "' + site.pick + '" on ' + site.name + ': ' + JSON.stringify(picked));
    await page.waitForTimeout(1200);

    // The probes go on BEFORE Generate, so the recordings are of the run that
    // produced what the block then renders.
    const mode = await page.evaluate(installProbes);
    out(site.key + ': probes ' + mode);

    await page.evaluate(() => {
        window.__gen428 = 0;
        document.addEventListener('gaip:nutrition-calendar-generated', () => { window.__gen428++; });
    });
    // GH-519: the target comes from the site's own config, not from a
    // programme an earlier run of this suite left behind.
    await fillOwnAnnualN(page);
    await page.click('#plan-nut-generate-btn');
    await page.waitForFunction(() => window.__gen428 > 0
        && document.querySelectorAll('tr.gilba-nut-row').length === 12, null, { timeout: 90000 });
    await page.waitForTimeout(3500);
}

function lastProv(snap) {
    const cp = snap.prov.computeProgram;
    if (!cp.length) throw new Error('computeProgram() was never called — the probes did not take');
    const last = cp[cp.length - 1];
    return {
        in: last.inputs, out: last.output,
        consumedSoilTemp: snap.prov.consumedSoilTemp,
        consumedCEC: snap.prov.consumedCEC,
    };
}

describe('GH-428 — the trace block against what entered the calculation', () => {
    beforeAll(async () => {
        if (!chromium) throw new Error('playwright does not resolve from the repo — run `npm install`');
        if (!EMAIL || !PASSWORD) throw new Error('no credentials — see tests/e2e/.e2e-credentials.json');

        browser = await chromium.launch();
        page = await browser.newPage();
        // GH-519: nothing this run writes reaches an existing site. See
        // tests/e2e/lib/stand-guard.js for what is held and what is not.
        standGuard = await guardStand(page);
        page.on('pageerror', (e) => out('pageerror: ' + (e && e.message)));

        await page.goto(BASE_URL + '/login', { waitUntil: 'domcontentloaded' });
        await page.fill('#email', EMAIL);
        await page.fill('#password', PASSWORD);
        await Promise.all([
            page.waitForNavigation({ waitUntil: 'domcontentloaded' }).catch(() => {}),
            page.click('form.login-form button[type=submit]')
        ]);
        await page.waitForTimeout(1500);
        if (/\/login/.test(page.url())) throw new Error('login refused for ' + EMAIL);

        const sites = await page.evaluate(async () =>
            (await fetch('/api/sites', { headers: { Accept: 'application/json' }, credentials: 'same-origin' })).json());
        previousActiveSiteId = sites.active_site_id;
        const byName = {};
        (sites.data || sites.sites || []).forEach((s) => { byName[s.name] = s.id; });

        for (const site of CASES) {
            const id = byName[site.name];
            if (!id) throw new Error('site not on this database: ' + site.name);
            await setActiveSite(id);
            await generateOn(site);
            // GH-522: warm the climate-normals service for THIS site before the
            // snapshot reads it. `getResolvedSync()` is synchronous and answers
            // null until the coordinates have been resolved once, so the first
            // draft of the anchor below read "no climateNormals on the resolved
            // inputs" — which is the harness's shape, not the product's, and is
            // the same warming gh492-anr-whose-numbers-live already does for the
            // same reason. If this ever fails to warm, the reason is recorded in
            // the snapshot rather than inferred.
            await page.evaluate(async () => {
                try {
                    const NPI = window.GAIP_NutritionProgramInputs;
                    const CN = window.GilbaClimateNormalsService;
                    const sid = NPI && typeof NPI.getActiveSiteId === 'function' ? NPI.getActiveSiteId() : null;
                    const SC = window.GAIP_SiteConfig;
                    const row = (sid && SC && SC.getSite) ? SC.getSite(sid) : null;
                    const lat = row && parseFloat(row.latitude);
                    const lon = row && parseFloat(row.longitude);
                    if (CN && typeof CN.resolveFor === 'function' && isFinite(lat) && isFinite(lon)) {
                        await CN.resolveFor(lat, lon);
                    }
                } catch (e) { /* recorded as a reason in the snapshot below */ }
            });
            CLEAN[site.key] = await page.evaluate(readBlockAndProvenance);

            const snap = CLEAN[site.key];
            out('');
            out('=== ' + site.name + ' / ' + site.pick);
            out('  computeProgram calls recorded:      ' + snap.prov.computeProgram.length);
            out('  recommender calls recorded:         '
                + snap.prov.recommender.map((r) => r.name).join(', '));
            out('  soil temperatures CONSUMED:         '
                + JSON.stringify(Array.from(new Set(snap.prov.consumedSoilTemp)).sort((a, b) => a - b)));
            out('  CECs CONSUMED:                      '
                + JSON.stringify(Array.from(new Set(snap.prov.consumedCEC))));
            out('  block rows rendered:                ' + Object.keys(snap.rows).length);
            out('  block self-check:                   '
                + (snap.selfCheck.allGood ? ('all ' + snap.selfCheck.count + ' figures match') : 'DISAGREEMENT'));

            // ---- the drift demonstration, on the New Zealand site only -----
            // Both mutations are of the LIVE objects the block reads, after the
            // engines have run: exactly the shape of this ticket's defect — a
            // plausible figure, present in the object, that nothing computed.
            if (site.region === 'nz') {
                const drifted = await page.evaluate(() => {
                    const prog = window.GAIP_NUTRITION_PROGRAM;
                    const cal = window.GilbaNutritionCalendar.program;
                    const before = {
                        series: prog.soilTempSeries ? JSON.parse(JSON.stringify(prog.soilTempSeries)) : null,
                        targetN: cal.adjustments.target_n,
                    };
                    // A plausible series: every month 1.0 degC warmer than the
                    // one selection actually ran on. Nothing on screen looks wrong.
                    if (prog.soilTempSeries) {
                        prog.soilTempSeries = prog.soilTempSeries.map((e) => ({
                            month: e.month, month_num: e.month_num, temp: Math.round((e.temp + 1) * 10) / 10
                        }));
                    }
                    cal.adjustments.target_n = Math.round((cal.adjustments.target_n + 7) * 10) / 10;
                    window.GAIP_PlanCalcTrace.mount();
                    return before;
                });
                await page.waitForTimeout(400);
                DRIFT[site.key] = await page.evaluate(readBlockAndProvenance);
                DRIFT[site.key]._before = drifted;
                // Put the page back the way the engines left it.
                await page.evaluate((before) => {
                    const prog = window.GAIP_NUTRITION_PROGRAM;
                    const cal = window.GilbaNutritionCalendar.program;
                    if (before.series) prog.soilTempSeries = before.series;
                    cal.adjustments.target_n = before.targetN;
                    window.GAIP_PlanCalcTrace.mount();
                }, drifted);
                await page.waitForTimeout(400);
            }
        }
    }, 1800000);

    afterAll(async () => {
        if (page && previousActiveSiteId) {
            try { await setActiveSite(previousActiveSiteId); } catch (e) { /* */ }
        }
        if (browser) await browser.close();
    }, 120000);

    test('the probes actually recorded a run — otherwise everything below is vacuous', () => {
        CASES.forEach((c) => {
            const s = CLEAN[c.key];
            expect(s.found).toBe(true);
            expect(s.prov).not.toBeNull();
            expect(s.prov.computeProgram.length).toBeGreaterThan(0);
            expect(s.prov.recommender.length).toBeGreaterThan(0);
            // The recording must be of a real programme, not an error object.
            const last = s.prov.computeProgram[s.prov.computeProgram.length - 1];
            expect(last.output && last.output.annual_totals).toBeTruthy();
        });
    });

    test('every row the block prints is covered by this file', () => {
        // The guard against "covered a sample of them": if the block grows a row,
        // this goes red until the row has a provenance or an explicit reason.
        CASES.forEach((c) => {
            const printed = Object.keys(CLEAN[c.key].rows).sort();
            const covered = Object.keys(ROW_CHECKS).concat(Object.keys(UNTIED)).sort();
            expect(printed).toEqual(covered);
        });
    });

    test('the New Zealand recommender really did consume a soil temperature', () => {
        // Premise for the row below. If nothing consumed one, the assertion
        // there would pass on an empty set and prove nothing.
        const s = CLEAN.test5;
        const consumed = s.prov.consumedSoilTemp.filter((v) => typeof v === 'number');
        expect(consumed.length).toBeGreaterThan(0);
        const distinct = Array.from(new Set(consumed));
        expect(distinct.length).toBeGreaterThan(1);
    });

    test('the Australian recommender consumes neither a temperature nor a CEC', () => {
        const s = CLEAN.burns;
        expect(s.prov.consumedSoilTemp.filter((v) => typeof v === 'number')).toEqual([]);
        expect(s.prov.consumedCEC.filter((v) => typeof v === 'number')).toEqual([]);
    });

    test('every input row equals what the engines received or produced', () => {
        CASES.forEach((c) => {
            const s = CLEAN[c.key];
            const bad = checkRows(s.rows, lastProv(s));
            bad.forEach((b) => out('MISMATCH ' + c.key + ' / ' + b.label + ': printed "' + b.printed
                + '" vs engine "' + b.fromEngine + '" (' + (b.why || b.grade) + ')'));
            expect(bad).toEqual([]);
        });
    });

    test('every nutrient headline and ledger line equals what the engines produced', () => {
        CASES.forEach((c) => {
            const s = CLEAN[c.key];
            const bad = checkNutrients(s.sections, lastProv(s), s.recordedLedger);
            bad.forEach((b) => out('MISMATCH ' + c.key + ' / ' + b.label + ': printed "' + b.printed
                + '" vs engine "' + b.fromEngine + '" (' + (b.why || b.grade) + ')'));
            expect(bad).toEqual([]);
        });
    });

    // ── GH-522: the one source outside the calculation ──────────────────────
    //
    // WHAT THIS FILE PROMISED BY ITS NAME AND TEXT: that every figure the
    // calculation-trace block prints is the figure that entered or left the
    // calculation — provenance, checked row by row.
    //
    // WHAT IT ACTUALLY ASSERTED: printed == what the engines received or
    // produced. Both halves of every comparison are read from the same run. The
    // row "Monthly temperature normals", graded `entered`, is checked against
    // `p.in.monthlyTemps` — which is what computeProgram() was handed, so the
    // row is checked against itself-as-received.
    //
    // WHAT WAS MISSING, and what the reviewer's M3 proved: raise the series by
    // 2 °C where the calendar re-indexes it (nutrition-calendar.js:1495) and the
    // printed row moves, `p.in.monthlyTemps` moves with it, and they still
    // agree. Every row passes. The file's own drift control does not help: it
    // injects drift by changing the OBJECT THE BLOCK READS, which proves the
    // checker works and says nothing about the chain feeding both sides.
    //
    // "Entered" has to mean entered FROM somewhere. The site's climate normals
    // are that somewhere, and they are resolved by a different module the
    // mutation does not touch.
    test('the normals that entered the calculation are the site\'s own normals', () => {
        CASES.forEach((c) => {
            const s = CLEAN[c.key];
            const sn = s.siteNormals;
            if (!sn || sn.error) {
                out('NO ANCHOR ' + c.key + ': ' + JSON.stringify(sn));
                // Named for the reviewer's open question: if the reason is
                // 'no-coordinates' or 'service-unavailable' this is the
                // PRODUCT, not the harness, and the finding stops here rather
                // than being worked around in the test.
                if (sn && /no-coordinates|service-unavailable/.test(String(sn.reason))) {
                    out('THIS IS A PRODUCT ANSWER, NOT A HARNESS ONE: ' + sn.reason
                        + ' — the site resolves no climate, and no test change can supply one.');
                    out('MEASURED, GH-522: resolveExportInputs() resolves NO coordinates on the Plan '
                        + 'page. FIELD_PATHS.lat is [\'site-row\', \'latitude\'] '
                        + '(nutrition-program-inputs.js:682) — by GH-473\'s decision the site ROW owns '
                        + 'the coordinates and the config.location copy is deliberately not read. The '
                        + 'Plan page carries no GAIP_SiteConfig store to serve that row (measured: '
                        + 'siteConfigStoreHasGetSite false); it has only the server-rendered '
                        + 'GAIP_SITE_CONFIG, whose latitude/longitude are null while location.lat / '
                        + 'location.lon hold -36.85 / 174.76. So climateNormals is null and '
                        + 'climateReason is no-coordinates for every site on this page.');
                    out('THIS TEST IS LEFT RED ON PURPOSE. Making it pass would mean either reading '
                        + 'the copy GH-473 decided not to read, or asserting nothing — and a green '
                        + 'test over a hole is the defect this whole delivery is about. The fix is a '
                        + 'product decision and has been handed back, not taken here.');
                }
                // Said rather than skipped: without the anchor this case is
                // back to checking the calculation against itself.
                expect(sn && sn.error).toBeUndefined();
                return;
            }
            const entered = lastProv(s).in.monthlyTemps;
            expect(entered).toBeTruthy();
            const off = [];
            for (let m = 0; m < 12; m++) {
                const a = Number(entered[m]);
                const b = sn.temps[m];
                if (b == null) continue;
                // Half a degree: both sides round, and they are rounded at
                // different points. Far too narrow to absorb a 2 °C shift.
                if (!(Math.abs(a - b) <= 0.5)) off.push({ month: m + 1, entered: a, siteNormal: b });
            }
            off.forEach((o) => out('OFF NORMAL ' + c.key + ' ' + JSON.stringify(o)));
            expect(off).toEqual([]);
        });
    });

    test('drift is detected: the same checker goes red when the block reads a changed object', () => {
        const s = DRIFT.test5;
        expect(s).toBeDefined();
        const bad = checkRows(s.rows, lastProv(s));
        const labels = bad.map((b) => b.label).sort();
        bad.forEach((b) => out('drift caught ' + b.label + ': printed "' + b.printed
            + '" vs engine "' + b.fromEngine + '"'));
        // Exactly the two rows that were made to drift, and no others.
        expect(labels).toEqual(['Annual N after traffic', 'Soil temperature (product selection)']);
        // And the point of the whole file: the block's OWN self-check does not
        // see the soil-temperature drift at all, because the summary table it
        // compares against says nothing about soil temperature.
        out('block self-check while drifted: '
            + (s.selfCheck.allGood ? ('still reports all ' + s.selfCheck.count + ' figures match')
                                   : 'reports a disagreement'));
        expect(s.selfCheck.count).toBeGreaterThan(0);
    });
});

}
