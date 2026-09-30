/**
 * GH-782 (queue item 3ga) — THE CERTIFICATE RANGES OF AN AMMONIUM-ACETATE SITE, ON THE STAND.
 *
 * WHAT NO OFFLINE CASE CAN SETTLE: whether a real run of a real site now resolves the Hill Labs code from the
 * site's own settings and stores the certificate band. Measured before this window, in the latest rows of the
 * five sites set to ammonium acetate: potassium `50.0-116.0` in every one of them, and `rangeSource` in none of
 * the eight rows of the site this window is for. The sites are NOT named here — a live file that names one
 * belongs in the inventory of GH-703, and this one takes its site from the window that opened it.
 *
 * WHAT IT PRESSES: the one site the window was opened for, by name from the environment. With none it refuses
 * rather than pressing anything.
 *
 * Run: GILBA_E2E=1 GILBA_E2E_GH782=1 GILBA_E2E_GH782_SITES='<name>' \
 *      npx jest tests/e2e/gh782-the-aa-ranges-on-the-stand-live.test.js
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

let chromium = null;
try { ({ chromium } = require('playwright')); } catch (e) { /* reported below */ }
const { openTranscript } = require('./lib/transcript');

const ENABLED = process.env.GILBA_E2E === '1' && process.env.GILBA_E2E_GH782 === '1' && !!chromium;
const CREDENTIALS_PATH = process.env.GILBA_E2E_CREDENTIALS || path.join(__dirname, '.e2e-credentials.json');
const credentials = fs.existsSync(CREDENTIALS_PATH) ? JSON.parse(fs.readFileSync(CREDENTIALS_PATH, 'utf8')) : {};
const BASE_URL = process.env.GILBA_E2E_URL || credentials.url || 'http://127.0.0.1:8080';
const EMAIL = process.env.GILBA_E2E_EMAIL || credentials.email;
const PASSWORD = process.env.GILBA_E2E_PASSWORD || credentials.password;
const PRESSING = String(process.env.GILBA_E2E_GH782_SITES || '').split(';')
    .map((n) => n.trim()).filter((n) => n);

function query(sql) {
    return execFileSync('docker', ['exec', 'gilba_mysql', 'mysql', '-ugilba', '-pgilba_secret',
        'gilba', '-N', '-e', sql], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })
        .split('\n').map((l) => l.trim()).filter((l) => l);
}

/** Every site's last row, so a site outside the window is seen if it moves. */
function standNow() {
    const out = {};
    query("SELECT CONCAT_WS('|', s.name, ar.id) FROM sites s JOIN analysis_results ar "
        + "ON ar.id = (SELECT MAX(id) FROM analysis_results WHERE site_id = s.id)").forEach((line) => {
        const cut = line.split('|');
        out[cut[0]] = cut[1];
    });

    return out;
}

/** The nutrient bands of one row, by nutrient, with the source each one was given. */
function bandsOf(rowId) {
    const raw = query("SELECT COALESCE(JSON_EXTRACT(computed,'$.mlsnRows'),'[]') FROM analysis_results "
        + 'WHERE id = ' + Number(rowId));
    let rows = [];
    try { rows = JSON.parse(raw.join('')); } catch (e) { rows = []; }

    return (Array.isArray(rows) ? rows : []).map((r) => ({
        nutrient: r.nutrient,
        band: r.mlsn || null,
        source: r.rangeSource || null,
        actual: r.actual,
    }));
}

if (!ENABLED) {
    process.stdout.write('[e2e] gh782-the-aa-ranges skipped (presses Re-run on the stand — announce first,'
        + ' GILBA_E2E_GH782=1 and the site list)\n');
    test.skip('GH-782 on the stand (disabled)', () => {});
} else {
    describe('GH-782 — the AA certificate ranges of a real site', () => {
        jest.setTimeout(1200000);
        let browser, page;
        const transcript = openTranscript('gh782-aa-ranges');
        const say = (line) => transcript.say(line);
        let before = {};
        let after = {};
        const pressed = [];
        let refused = null;
        const bandsBefore = {};
        const bandsAfter = {};

        beforeAll(async () => {
            if (!EMAIL || !PASSWORD) throw new Error('no credentials — see tests/e2e/.e2e-credentials.example.json');
            before = standNow();
            say('BEFORE — last row of every site:');
            Object.keys(before).sort().forEach((k) => say('  BEFORE  ' + k + ' · row ' + before[k]));

            if (!PRESSING.length) {
                refused = 'no site list: set GILBA_E2E_GH782_SITES to the site the window was opened for';
                say('REFUSED — ' + refused);
                after = before;

                return;
            }
            const missing = PRESSING.filter((n) => !before[n]);
            if (missing.length) {
                refused = 'named sites with no stored row to compare: ' + missing.join(', ');
                say('REFUSED — ' + refused);
                after = before;

                return;
            }
            PRESSING.forEach((n) => {
                bandsBefore[n] = bandsOf(before[n]);
                say('  BANDS BEFORE ' + n + ' (row ' + before[n] + '): '
                    + JSON.stringify(bandsBefore[n]));
            });

            browser = await chromium.launch();
            page = await browser.newPage();
            page.on('console', (m) => {
                const t = m.text();
                if (/S27|S28|Hill|certificate|rangeSource|species/i.test(t)) say('console: ' + t.slice(0, 200));
            });
            /**
             * WHAT THE FRAME SEES, AND WHEN. The row came out with the texture-only bands, so the question is no
             * longer whether the service resolves a certificate - it does, offline - but what the species
             * function is handed at the moment it is called, and whether the site's config is on the page by
             * then. Both are recorded in the TOP window, which outlives the run frame, and the OBJECTS are kept
             * rather than a verdict about them.
             */
            await page.addInitScript(() => {
                try {
                    const top = window.top || window;
                    if (!top.__gh782) {
                        top.__gh782 = { calls: [], engine: [], configAt: null, firstSeen: null, t0: Date.now() };
                    }
                    const bin = top.__gh782;
                    const look = () => {
                        try {
                            /**
                             * DID THE ENGINE WE EDITED RUN IN THIS FRAME AT ALL, and what did it hand back.
                             *
                             * `rangeSource` is set by that engine for EVERY nutrient, by default, and the stored
                             * row carries it for none of the ten - so the row may have been assembled by another
                             * producer entirely. This wraps the engine itself: how many times it ran, whether the
                             * service was on the page at that moment, and the first nutrient of its own answer.
                             */
                            if (typeof window.mlsnEngine === 'function' && !window.mlsnEngine.__gh782) {
                                const realEngine = window.mlsnEngine;
                                const wrapped = function () {
                                    const out = realEngine.apply(this, arguments);
                                    try {
                                        const nuts = (out && out.nutrients) || [];
                                        bin.engine.push({
                                            at: Date.now() - bin.t0,
                                            serviceThen: typeof window.HillLabsSampleTypes,
                                            speciesFn: window.HillLabsSampleTypes
                                                ? typeof window.HillLabsSampleTypes.speciesOfTheSite : 'no service',
                                            methodology: arguments[0] && arguments[0].soil
                                                ? arguments[0].soil.methodology : null,
                                            firstNutrient: nuts[0]
                                                ? { nutrient: nuts[0].nutrient, mlsn: nuts[0].mlsn,
                                                    rangeSource: nuts[0].rangeSource === undefined
                                                        ? 'absent' : nuts[0].rangeSource }
                                                : 'no nutrients',
                                            count: nuts.length,
                                        });
                                    } catch (e) { /* watching must not break the run */ }

                                    return out;
                                };
                                wrapped.__gh782 = true;
                                window.mlsnEngine = wrapped;
                            }
                        } catch (e) { /* as above */ }
                        try {
                            const cfg = window.GAIP_HUB_CONFIG && (window.GAIP_HUB_CONFIG.gaipConfig
                                || window.GAIP_HUB_CONFIG.siteConfig);
                            if (cfg && bin.configAt === null) {
                                bin.configAt = Date.now() - bin.t0;
                                bin.firstSeen = {
                                    species: cfg.turf && cfg.turf.species,
                                    grassSpecies: cfg.turf && cfg.turf.grassSpecies,
                                    keys: cfg.turf ? Object.keys(cfg.turf).slice(0, 12) : null,
                                };
                            }
                            const svc = window.HillLabsSampleTypes;
                            if (svc && typeof svc.speciesOfTheSite === 'function' && !svc.__wrapped) {
                                const real = svc.speciesOfTheSite;
                                svc.speciesOfTheSite = function (state) {
                                    const answer = real.apply(this, arguments);
                                    try {
                                        const c = window.GAIP_HUB_CONFIG
                                            && (window.GAIP_HUB_CONFIG.gaipConfig
                                                || window.GAIP_HUB_CONFIG.siteConfig);
                                        bin.calls.push({
                                            at: Date.now() - bin.t0,
                                            answer: answer === undefined ? 'undefined' : answer,
                                            hubConfig: typeof window.GAIP_HUB_CONFIG,
                                            gaipConfig: c ? 'object' : String(c),
                                            configTurf: c && c.turf
                                                ? { species: c.turf.species, grassSpecies: c.turf.grassSpecies }
                                                : null,
                                            stateTurf: state && state.turf
                                                ? { grassSpecies: state.turf.grassSpecies,
                                                    warmBase: state.turf.warmBase }
                                                : null,
                                        });
                                    } catch (e) { /* watching must not break the run */ }

                                    return answer;
                                };
                                svc.__wrapped = true;
                            }
                        } catch (e) { /* as above */ }
                    };
                    look();
                    setInterval(look, 50);
                } catch (e) { /* as above */ }
            });

            await page.goto(BASE_URL + '/login', { waitUntil: 'domcontentloaded' });
            await page.fill('#email', EMAIL);
            await page.fill('#password', PASSWORD);
            await Promise.all([
                page.waitForNavigation({ waitUntil: 'domcontentloaded' }).catch(() => {}),
                page.click('form.login-form button[type=submit]'),
            ]);
            await page.waitForTimeout(1500);
            if (/\/login/.test(page.url())) throw new Error('login refused for ' + EMAIL);
            say('logged in as ' + EMAIL);

            for (const name of PRESSING) {
                const wasRow = before[name];
                say('--- ' + name + ': switching through the product’s own switcher');
                await page.goto(BASE_URL + '/dashboard?setup=0', { waitUntil: 'domcontentloaded' });
                await page.waitForTimeout(2500);
                let standing = await page.evaluate(() => ({
                    label: ((document.getElementById('db-site-switcher-btn') || {}).textContent || '').trim(),
                    species: (((window.GAIP_HUB_CONFIG || {}).gaipConfig || {}).turf || {}).species || null,
                }));
                if (standing.label !== name) {
                    await page.click('#db-site-switcher-btn');
                    await page.waitForTimeout(800);
                    const clicked = await page.evaluate((wanted) => {
                        const dd = document.getElementById('db-site-dropdown');
                        if (!dd) return 'no dropdown';
                        const items = Array.from(dd.querySelectorAll('a,button,[data-site-id],li'));
                        const hit = items.find((el) => (el.textContent || '').trim() === wanted)
                            || items.find((el) => (el.textContent || '').trim().includes(wanted));
                        if (!hit) return 'not in the list';
                        hit.click();
                        return 'clicked';
                    }, name);
                    say('  switcher: ' + clicked);
                    await page.waitForTimeout(4000);
                    await page.goto(BASE_URL + '/dashboard?setup=0', { waitUntil: 'domcontentloaded' });
                    await page.waitForTimeout(2500);
                    standing = await page.evaluate(() => ({
                        label: ((document.getElementById('db-site-switcher-btn') || {}).textContent || '').trim(),
                        species: (((window.GAIP_HUB_CONFIG || {}).gaipConfig || {}).turf || {}).species || null,
                    }));
                }
                say('  standing on "' + standing.label + '" · the site\'s own species: '
                    + JSON.stringify(standing.species));
                if (standing.label !== name) {
                    pressed.push({ site: name, pressed: false, why: 'the page stood on ' + standing.label });
                    continue;
                }
                try {
                    await page.click('#db-rerun-btn', { timeout: 20000 });
                } catch (e) {
                    pressed.push({ site: name, pressed: false, why: String(e.message).split('\n')[0] });
                    say('  NOT PRESSED — ' + String(e.message).split('\n')[0]);
                    continue;
                }
                say('  pressed Re-run at ' + new Date().toISOString());

                let landed = null;
                for (let i = 0; i < 60 && !landed; i += 1) {
                    await page.waitForTimeout(3000);
                    const now = standNow()[name];
                    if (now && Number(now) > Number(wasRow)) landed = now;
                }
                if (!landed) {
                    say('  NO NEW ROW within 180s');
                    pressed.push({ site: name, pressed: true, row: null });
                    continue;
                }
                const seen = await page.evaluate(() => (window.__gh782 || null));
                say('  WHAT THE FRAME SAW: ' + JSON.stringify(seen));
                process.stdout.write('\n[gh782] the engine ran ' + (((seen || {}).engine) || []).length
                    + ' time(s) in the frame:\n'
                    + (((seen || {}).engine) || []).map((e) => '[gh782]   ' + JSON.stringify(e)).join('\n')
                    + '\n[gh782] the config first appeared at +' + ((seen || {}).configAt)
                    + ' ms, as ' + JSON.stringify((seen || {}).firstSeen)
                    + '\n[gh782] calls of the species function (' + (((seen || {}).calls) || []).length + '):\n'
                    + (((seen || {}).calls) || []).map((c) => '[gh782]   ' + JSON.stringify(c)).join('\n')
                    + '\n');
                bandsAfter[name] = bandsOf(landed);
                say('  row ' + wasRow + ' -> ' + landed);
                say('  BANDS AFTER ' + name + ': ' + JSON.stringify(bandsAfter[name]));
                pressed.push({ site: name, pressed: true, row: landed });
            }
            after = standNow();
            if (browser) await browser.close();
        });

        afterAll(() => transcript.close());

        test('THE CERTIFICATE BAND IS IN THE ROW, nutrient by nutrient, with its source', () => {
            expect(refused).toBeNull();
            const landedSites = pressed.filter((p) => p.pressed && p.row).map((p) => p.site);
            expect(landedSites.length).toBeGreaterThan(0);

            landedSites.forEach((site) => {
                const was = bandsBefore[site] || [];
                const now = bandsAfter[site] || [];
                const byNutrient = {};
                was.forEach((r) => { byNutrient[r.nutrient] = { before: r.band, beforeSource: r.source }; });
                now.forEach((r) => {
                    byNutrient[r.nutrient] = Object.assign(byNutrient[r.nutrient] || {},
                        { after: r.band, afterSource: r.source, actual: r.actual });
                });
                process.stdout.write('\n[gh782] ' + site + ', nutrient by nutrient:\n'
                    + Object.keys(byNutrient).map((n) => '[gh782]   ' + n + ': '
                        + JSON.stringify(byNutrient[n])).join('\n') + '\n');
                Object.keys(byNutrient).forEach((n) => say('  ' + site + ' ' + n + ' '
                    + JSON.stringify(byNutrient[n])));

                const certified = now.filter((r) => r.source === 'certificate').map((r) => r.nutrient);
                const fallback = now.filter((r) => r.source === 'texture-fallback').map((r) => r.nutrient);
                process.stdout.write('[gh782] certificate: ' + JSON.stringify(certified)
                    + ' | texture-fallback: ' + JSON.stringify(fallback) + '\n');

                // THE SUBJECT OF THE ITEM: potassium carries the certificate band and says where it came from.
                const k = now.filter((r) => r.nutrient === 'K')[0];
                expect(k).toBeTruthy();
                expect(k.band).toBe('78.2-195.5');
                expect(k.source).toBe('certificate');
                // And it was not that before, in this site's own previous row.
                const kBefore = was.filter((r) => r.nutrient === 'K')[0];
                expect(kBefore && kBefore.band).toBe('50.0-116.0');
            });
        });

        test('NO SITE OUTSIDE THE WINDOW HAS A NEW LAST ROW, and the previous rows of this one still stand', () => {
            const moved = Object.keys(before).filter((n) => PRESSING.indexOf(n) < 0)
                .filter((n) => before[n] !== after[n])
                .map((n) => n + ': ' + before[n] + ' -> ' + after[n]);
            say('sites outside the window whose last row moved: ' + JSON.stringify(moved));
            expect(moved).toEqual([]);
            // The pressed site GAINED a row rather than having one rewritten.
            PRESSING.forEach((n) => {
                expect(Number(after[n])).toBeGreaterThan(Number(before[n]));
                const stillThere = query('SELECT COUNT(*) FROM analysis_results WHERE id = ' + Number(before[n]));
                expect(stillThere.join('')).toBe('1');
            });
        });
    });
}
