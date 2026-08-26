/**
 * GH-339 — live Westview logs showed selectFoliarNitrogen() picking a
 * low-N%/off-purpose liquid (Hi Start Turf, N=10%, P=13%) over a
 * purpose-built high-N liquid (Greenmaster Liquid High N, N=25%) for a
 * month needing a large N amount, purely on pScore (P-delivery-accuracy)
 * -- nothing in totalScore scored the candidate's own N-delivery capacity.
 * Confirmed via au-fertiliser-products.js: the sibling granular selector,
 * selectNitrogenSource(), already has this exact check (nScore, commented
 * "THE MOST IMPORTANT SCORE") -- selectFoliarNitrogen() never had an
 * equivalent, so a product capping out at 8.0kg N after 4 applications
 * could still win against a 16.7kg requirement.
 *
 * FIX: added nScore to selectFoliarNitrogen() (SCORE 1.5), mirroring the
 * granular selector's delivery-ratio bands plus a new "< 0.3" severe
 * under-capacity band (liquids have a hard label-rate/4-application
 * ceiling that granular batches don't), weighted the same as kScore/pScore
 * (×0.25).
 */

'use strict';

const fs = require('fs');
const path = require('path');

describe('GH-339 — selectFoliarNitrogen() N-delivery-accuracy score', () => {
    let src;
    beforeAll(() => {
        src = fs.readFileSync(path.join(__dirname, '../assets/au-fertiliser-products.js'), 'utf8');
    });

    test('nScore is computed from estimatedRate/nPct against nRequired, mirroring the granular selector\'s bands', () => {
        const idx = src.indexOf('// SCORE 1.5: N Delivery Accuracy (GH-339)');
        expect(idx).toBeGreaterThan(-1);
        const block = src.slice(idx, idx + 1900);
        expect(block).toMatch(/const nAtRate = estimatedRate \* \(nPct \/ 100\);/);
        expect(block).toMatch(/const nDeliveryRatio = nRequired > 0 \? nAtRate \/ nRequired : 1;/);
        expect(block).toMatch(/nDeliveryRatio >= 0\.85 && nDeliveryRatio <= 1\.15\) \{\s*\n\s*nScore = 50;/);
        expect(block).toMatch(/nScore = -40; \/\/ Structurally can't fill this month's N gap/);
    });

    test('nScore is included in totalScore at the same weight as kScore/pScore (×0.25)', () => {
        const idx = src.indexOf('// SCORE 1.5 above for why this was missing.');
        expect(idx).toBeGreaterThan(-1);
        const block = src.slice(idx, idx + 700);
        expect(block).toMatch(/\(pScore \* 0\.25\) \+\s*\n\s*\(nScore \* 0\.25\) \+/);
    });

    test('debug log includes nScore and nDeliveryRatio for live verification', () => {
        expect(src).toMatch(/liquid candidate score'.*\| nScore:.*\| nDeliveryRatio:/);
    });
});

describe('GH-339 — standalone reimplementation: nScore banding against real Westview numbers', () => {
    function nScoreFor(estimatedRate, nPct, nRequired) {
        const nAtRate = estimatedRate * (nPct / 100);
        const nDeliveryRatio = nRequired > 0 ? nAtRate / nRequired : 1;
        if (nDeliveryRatio >= 0.85 && nDeliveryRatio <= 1.15) return 50;
        if (nDeliveryRatio >= 0.7 && nDeliveryRatio <= 1.3) return 35;
        if (nDeliveryRatio >= 0.5 && nDeliveryRatio <= 1.5) return 20;
        if (nDeliveryRatio > 1.5) return -20;
        if (nDeliveryRatio >= 0.3) return -10;
        return -40;
    }

    test('Hi Start Turf, Feb (N=10%, maxRate=20 L/ha, remainingN=16.7kg): estimatedRate capped at 2x maxRate=40L/ha -> nAtRate=4.0kg -> severe shortfall band', () => {
        const estimatedRate = Math.min(16.7 / (10 / 100), 20 * 2); // = min(167, 40) = 40
        expect(estimatedRate).toBe(40);
        expect(nScoreFor(estimatedRate, 10, 16.7)).toBe(-40);
    });

    test('Greenmaster Liquid High N, Feb (N=25%, fits within one application): estimatedRate = rateForN -> nAtRate ~= nRequired -> excellent band', () => {
        const rateForN = 16.7 / (25 / 100); // 66.8 L/ha
        const estimatedRate = Math.min(rateForN, 999 * 2); // maxRate large enough to not cap
        expect(nScoreFor(estimatedRate, 25, 16.7)).toBe(50);
    });

    test('recomputing Feb totals with nScore added flips the winner from Hi Start Turf to Greenmaster Liquid High N', () => {
        // Weighted contributions from the pre-GH-339 components, taken verbatim from the live log.
        const hiStartTurfBase = 40.6; // kScore30*.25 + releaseScore45*.18 + pScore100*.25
        const greenmasterBase = 36.6; // kScore80*.25 + releaseScore45*.18 + rateScore20*.10 + positionScore9*.03 + pScore25*.25

        const hiStartTurfNScore = nScoreFor(40, 10, 16.7); // -40
        const greenmasterNScore = nScoreFor(Math.min(16.7 / 0.25, 999 * 2), 25, 16.7); // 50

        const hiStartTurfTotal = hiStartTurfBase + hiStartTurfNScore * 0.25;
        const greenmasterTotal = greenmasterBase + greenmasterNScore * 0.25;

        expect(Math.round(hiStartTurfTotal * 10) / 10).toBe(30.6);
        expect(Math.round(greenmasterTotal * 10) / 10).toBe(49.1);
        expect(greenmasterTotal).toBeGreaterThan(hiStartTurfTotal);
    });
});
