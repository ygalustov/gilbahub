'use strict';

/**
 * THE PRODUCT'S PGR ENGINE, for benches that need its two answers.
 *
 * GH-780. The engine owns "is this site using a PGR" and the ninety-day window behind it
 * (`GAIP_PGR.isInUse`, `historyWindowDays`), and the run's state assembly, the orchestrator's note and the
 * morning briefing all ask it. A bench that stubs those answers is testing the stub — and the switch this
 * work removed was exactly a second opinion about the same question.
 */

const fs = require('fs');
const path = require('path');
const vm = require('vm');

let cached = null;

function engine() {
    if (cached) return cached;
    const src = fs.readFileSync(
        path.join(__dirname, '..', '..', 'assets', 'gilba-pgr-module-v3.js'), 'utf8');
    const box = {
        console: { log() {}, warn() {}, error() {} },
        Date, Math, JSON, Object, Array, String, Number, Boolean, RegExp,
        parseFloat, parseInt, isNaN, isFinite,
    };
    box.window = box;
    box.global = box;
    box.globalThis = box;
    vm.createContext(box);
    vm.runInContext(src, box, { filename: 'gilba-pgr-module-v3.js' });
    cached = box.GAIP_PGR;

    return cached;
}

module.exports = { engine };
