#!/usr/bin/env node
/**
 * verify-leafwetness-divergence-b35fix496.js
 *
 * Measurement gate for SaaS NZ pilot — run AFTER b35fix496 is merged.
 * Spec: files/fixes/26-07-17-89-verification-leafwetness/
 *       GAIP_SaaS_Verification_LeafWetness_Divergence_b35fix496.md
 *
 * Reports three numbers from the spec §3:
 *   1. Max riskScore delta between dew path and hourly path
 *   2. Count of days where the two paths land in different risk bands
 *   3. Count of knee-straddle days (one path >= 10 h, the other < 10 h)
 *
 * Method: synthetic pairing on representative NZ autumn dew patterns.
 * Dew path  — dewData.leafWetness.averageWetHours supplied directly (total 24h wet hours).
 * Hourly path — hourlyData.relative_humidity_2m built with totalWet hours at RH≥95 in overnight-
 *               dominant order (20:00→05:59→daytime), representing the same total wetness as dew.
 *               Post-fix B: getLeafWetnessHours counts all RH>=90 hours × 0.5 (no daytime window).
 *
 * Run: node verify-leafwetness-divergence-b35fix496.js
 */

'use strict';

// Save raw stdout before any console mock
const write = (s) => process.stdout.write(s + '\n');

// Silence disease engine console groups (diagnostics would flood the output)
global.window   = {};
global.document = { addEventListener: () => {}, documentElement: {}, querySelector: () => null };
global.console  = {
    group: () => {}, groupEnd: () => {}, groupCollapsed: () => {},
    log: () => {}, warn: () => {}, info: () => {}, error: () => {},
};

const eng                           = require('./assets/disease-engine-pure.js');
const FM                            = eng.models.fusarium;
const { getLeafWetnessHours,
        classifyRisk }              = eng.utils;
const { DISEASE_CONFIG }            = eng;

// ─── synthetic hourly RH array ───────────────────────────────────────────────
// Post-fix (Trap6): place totalWet hours at RH=95 in overnight-dominant order
// (starting 20:00, cycling through midnight, then daytime) so that the hourly
// array represents the same total wetness the dew engine reports.
// After fix B, getLeafWetnessHours counts all RH>=90 hours × 0.5 (no window),
// matching the dew path: round(averageWetHours * 0.5).
const OVERNIGHT_FIRST = [20,21,22,23,0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19];
function makeHourlyClimate(totalWet, temp) {
    const time = Array.from({ length: 24 }, (_, h) =>
        `2024-06-01T${String(h).padStart(2, '0')}:00`);
    const rh = new Array(24).fill(50);   // baseline: non-wet
    for (let i = 0; i < Math.min(totalWet, 24); i++) rh[OVERNIGHT_FIRST[i]] = 95;
    return {
        temperature: { mean: temp, min: temp - 4, max: temp + 4 },
        moisture:    { humidity: { mean: 75 } },
        precipitation: { total: 2 },
        hourlyData:  { relative_humidity_2m: rh, time },
    };
}

// ─── scenarios ───────────────────────────────────────────────────────────────
// NZ cool-season dew patterns (overnight-dominant and mixed).
// totalWet  → averageWetHours the dew engine would report (all 24h count)
// daytime   → hours at RH≥90 inside 06:00–20:00 (what the hourly path counts)
const SCENARIOS = [
    { label: 'Spec §2 example: overnight-dominant',        totalWet: 16, daytime: 4,  temp: 8 },
    { label: 'Heavy overnight dew, no daytime',            totalWet: 14, daytime: 0,  temp: 8 },
    { label: 'Heavy overnight, 2h daytime',                totalWet: 14, daytime: 2,  temp: 8 },
    { label: 'Moderate overnight skew: 10h total, 2h day', totalWet: 10, daytime: 2,  temp: 8 },
    { label: 'Near-knee: dew>=10, hourly<10',              totalWet: 20, daytime: 9,  temp: 6 },
    { label: 'Knee straddle: dew saturated, hourly<10',    totalWet: 22, daytime: 6,  temp: 6 },
    { label: 'Even distribution: 12h total, 6h daytime',   totalWet: 12, daytime: 6,  temp: 8 },
    { label: 'Both saturated: 20h total, 10h daytime',     totalWet: 20, daytime: 10, temp: 8 },
    { label: 'Both below knee: 8h total, 4h daytime',      totalWet:  8, daytime: 4,  temp: 8 },
    { label: 'Cold NZ (2C): overnight-dominant',           totalWet: 16, daytime: 4,  temp: 2 },
    { label: 'Marginal dew: 6h total, 1h daytime',         totalWet:  6, daytime: 1,  temp: 8 },
    { label: 'Dry day: no wetness',                        totalWet:  0, daytime: 0,  temp: 8 },
];

// ─── run measurement ─────────────────────────────────────────────────────────
write('');
write('=== LeafWetness Path Divergence — b35fix496 NZ Pilot Gate ===');
write('Spec: GAIP_SaaS_Verification_LeafWetness_Divergence_b35fix496.md');
write('');
write('  Dew path:    round(averageWetHours × 0.5)    →  moistureFactor = min(1, h/10)');
write('  Hourly path: round(allRH>=90 hours × 0.5)  →  moistureFactor = min(1, h/10)  [post-fix B: no daytime window]');
write('');
write('  Bands: low<50 | moderate>=50 | high>=70 | severe>=85  (DISEASE_CONFIG.thresholds)');
write('');

const COL = [45, 4, 7, 5, 6, 6, 9, 8, 6, 9, 9, 8, 7];
function pad(s, n) { return String(s).padEnd(n); }
function padL(s, n) { return String(s).padStart(n); }
function row(...cells) { return cells.map((c, i) => pad(c, COL[i])).join('  '); }

write(row(
    'Scenario', 'T°C', 'TotalWt', 'DayWt', 'LW-dew', 'LW-hr',
    'Score-dew', 'Score-hr', 'Delta', 'Band-dew', 'Band-hr', 'BandDiff', 'KneeStr',
));
write('─'.repeat(130));

let maxDelta        = 0;
let bandDiffCount   = 0;
let kneeStraddleCount = 0;
const rows = [];

for (const s of SCENARIOS) {
    const { totalWet, daytime, temp } = s;
    const climateHourly = makeHourlyClimate(totalWet, temp);
    const climatePlain  = {
        temperature: { mean: temp, min: temp - 4, max: temp + 4 },
        moisture:    { humidity: { mean: 75 } },
        precipitation: { total: 2 },
    };
    const dewData = totalWet > 0
        ? { leafWetness: { averageWetHours: totalWet } }
        : undefined;

    // Dew path: dewData supplied → getLeafWetnessHours takes dew branch
    const lwDew   = getLeafWetnessHours(climatePlain, dewData);
    const rDew    = FM.calculate(climatePlain, { status: 'adequate' }, {}, dewData);

    // Hourly path: no dewData, climate has hourlyData
    const lwHr    = getLeafWetnessHours(climateHourly, undefined);
    const rHr     = FM.calculate(climateHourly, { status: 'adequate' }, {}, undefined);

    const delta      = rDew.riskScore - rHr.riskScore;
    const absDelta   = Math.abs(delta);
    const bandDiff   = rDew.riskLevel !== rHr.riskLevel;
    const kneeStr    = (lwDew >= 10) !== (lwHr >= 10);

    if (absDelta > maxDelta) maxDelta = absDelta;
    if (bandDiff) bandDiffCount++;
    if (kneeStr)  kneeStraddleCount++;

    const deltaStr = delta > 0 ? `+${delta}` : String(delta);
    write(row(
        s.label.substring(0, 44), temp, totalWet, daytime,
        lwDew, lwHr, rDew.riskScore, rHr.riskScore, deltaStr,
        rDew.riskLevel, rHr.riskLevel,
        bandDiff ? 'YES' : '-',
        kneeStr  ? 'YES' : '-',
    ));

    rows.push({ ...s, lwDew, lwHr, scoreDew: rDew.riskScore, scoreHr: rHr.riskScore,
                delta, bandDiff, kneeStr, bandDew: rDew.riskLevel, bandHr: rHr.riskLevel });
}

// ─── worked example verification ─────────────────────────────────────────────
write('');
write('─── Spec §2 Worked Example Check ──────────────────────────────────────');
const ex = rows.find(r => r.totalWet === 16 && r.daytime === 4 && r.temp === 8);
if (ex) {
    const dewOK  = ex.scoreDew === 84 || Math.abs(ex.scoreDew - 84) <= 2;
    // Post-fix B: hourly path now uses same 0.5 convention as dew → both score ~84 (not pre-fix ~60).
    const hrOK   = Math.abs(ex.scoreHr - ex.scoreDew) <= 2;
    const agree  = ex.bandDew === ex.bandHr;
    write(`  Dew path score:    ${ex.scoreDew}  (spec pre-fix ~84, band ${ex.bandDew})  ${dewOK ? 'OK' : 'MISMATCH'}`);
    write(`  Hourly path score: ${ex.scoreHr}  (post-fix should match dew ~${ex.scoreDew}, band ${ex.bandHr})  ${hrOK ? 'OK' : 'MISMATCH'}`);
    write(`  Paths agree:       ${agree ? 'YES — fix B aligned both paths' : 'NO — unexpected divergence'}`);
}

// ─── three metric summary (spec §3) ──────────────────────────────────────────
write('');
write('─── Measurement Results (spec §3) ─────────────────────────────────────');
write(`  1. Max riskScore delta:       ${maxDelta} points`);
write(`  2. Days with band difference: ${bandDiffCount} / ${SCENARIOS.length}`);
write(`  3. Knee-straddle days:        ${kneeStraddleCount} / ${SCENARIOS.length}`);

// ─── pass / fail (spec §4) ───────────────────────────────────────────────────
write('');
write('─── Pass / Fail (spec §4) ─────────────────────────────────────────────');
if (bandDiffCount === 0) {
    write('  PASS — no band crossings on synthetic NZ patterns.');
    write('  Action: verify all pilot sites are on the same feed (§3 step 1).');
    write('          If they share a feed, the cross-site inconsistency cannot occur.');
} else {
    write(`  FAIL — ${bandDiffCount} scenario(s) land in different risk bands.`);
    write('  NZ pilot sites on mixed feeds will report different Fusarium risk');
    write('  for the same weather. Resolve before any rep sees a read-out.');
    write('');
    write('  Fix options (spec §5 — not part of this measurement):');
    write('    1. Standardise pilot sites to one feed (operational, no code change).');
    write('    2. Align both paths to the same daytime convention in getLeafWetnessHours().');
    write('    3. Fix in the SaaS engine during the port (preferred if schedule allows).');
    write('');
    write('  Band-crossing days:');
    rows.filter(r => r.bandDiff).forEach(r => {
        write(`    • ${r.label.padEnd(50)}  dew=${r.bandDew}(${r.scoreDew})  hourly=${r.bandHr}(${r.scoreHr})  Δ${r.delta > 0 ? '+' : ''}${r.delta}`);
    });
}
write('');
write('  NOTE: This measures synthetic patterns. Run Step 1 (feed-mix map)');
write('  on actual pilot sites to confirm which path each site uses in production.');
write('');
