/**
 * GH-722 — EVERY PLACE THAT READS A LAB SAMPLE BY COLUMN NAME ITSELF IS LISTED, AND A NEW ONE REDDENS.
 *
 * The lab reading names map is meant to be the one rule for how a sample's columns are spelled. The
 * equality test (`gh722-one-map-of-lab-reading-names`) holds the map against the runner; it cannot
 * see code that reads a sample's `payload` or `rawData` by name past both. This census finds that
 * code by what it does (`tests/lib/sample-payload-reads.js`) and holds it against
 * `tests/fixtures/gh722-direct-sample-reads.json` both ways, by list and never by count:
 *   - a read that is not listed reddens, naming file, function, variable and column — the sixth
 *     place is found on the day it is written;
 *   - a listed read that is gone reddens too, so the list shrinks as places move onto the map and
 *     cannot keep an excuse for code that no longer exists.
 * Every read carries a state, and every place with a lab reading in it says what it is and what
 * happens to it next.
 *
 * WHAT IT DOES NOT SEE — the census's own boundary, printed by its module: views, a sample passed
 * through a function parameter under another name in JavaScript, and what a computed column name
 * resolves to.
 */

'use strict';

const { directReads, jsReads, phpReads } = require('./lib/sample-payload-reads');
const RECORDED = require('./fixtures/gh722-direct-sample-reads.json');

const READING_STATES = ['reading-off-the-map', 'ph-rule-open', 'cec', 'not-in-the-map'];

describe('GH-722 — the direct readers of a lab sample are listed, and a new one reddens', () => {
    const now = directReads();

    test('positive control: a planted reader is found, by binding and not by name', () => {
        const js = jsReads('planted.js', [
            'function a(sample) { var pl = sample.payload || {}; return pl.K_ppm || pl.K; }',
            'function b(state) { var pl = state.soil; return pl.K_ppm; }',
        ].join('\n'));
        expect(js).toEqual(['planted.js | a | pl | K_ppm', 'planted.js | a | pl | K']);
        const php = phpReads('Planted.php', "function run($s) { $p = $s->payload; return $p['pH_Water'] ?? $p['pH']; }");
        expect(php).toEqual(['Planted.php | run | $p | pH_Water', 'Planted.php | run | $p | pH']);
    });

    test('the census reaches the tree: files scanned and the places it must know are in it', () => {
        process.stdout.write('[gh722] direct sample reads: files scanned ' + now.filesScanned + ', reads ' + now.reads.length + '\n');
        expect(now.filesScanned).toBeGreaterThan(300);
        // Witnesses, one per language and one per way of holding a sample.
        expect(now.reads).toContain('app/app/Http/Controllers/SampleAnalysisController.php | run | $payload | pH');
        expect(now.reads).toContain('assets/nutrition-calendar.js | applySample | pl | CEC');
        expect(now.reads).toContain('assets/nutrient-trend.js | calculateNutrientTrend | .rawData | pH');
    });

    test('what is read now is exactly what is listed, both ways', () => {
        const listed = Object.keys(RECORDED.reads);
        const unlisted = now.reads.filter((r) => !listed.includes(r));
        const gone = listed.filter((r) => !now.reads.includes(r));
        const byState = {};
        now.reads.forEach((r) => { const s = RECORDED.reads[r] || 'UNLISTED'; byState[s] = (byState[s] || 0) + 1; });
        process.stdout.write('[gh722] reads by state: ' + JSON.stringify(byState) + '\n');
        unlisted.forEach((r) => process.stdout.write('[gh722]    NOT LISTED: ' + r + '\n'));
        gone.forEach((r) => process.stdout.write('[gh722]    LISTED, GONE: ' + r + '\n'));
        expect({ unlisted, gone }).toEqual({ unlisted: [], gone: [] });
    });

    test('every read has a known state, and every place reading a lab reading says what it is and what is next', () => {
        const badState = Object.entries(RECORDED.reads).filter(([, s]) => !(s in RECORDED.states)).map(([r]) => r);
        const places = new Set(Object.entries(RECORDED.reads).filter(([, s]) => READING_STATES.includes(s))
            .map(([r]) => r.split(' | ').slice(0, 3).join(' | ')));
        const undescribed = Array.from(places).filter((p) => {
            const d = RECORDED.places[p];
            return !Array.isArray(d) || d.length !== 2 || !d[0] || !d[1];
        });
        const describedButClean = Object.keys(RECORDED.places).filter((p) => !places.has(p));
        process.stdout.write('[gh722] places reading a lab reading past the map: ' + places.size + '\n');
        Array.from(places).sort().forEach((p) => process.stdout.write('[gh722]    ' + p + ' — next: ' + RECORDED.places[p][1] + '\n'));
        expect({ badState, undescribed, describedButClean }).toEqual({ badState: [], undescribed: [], describedButClean: [] });
    });
});
