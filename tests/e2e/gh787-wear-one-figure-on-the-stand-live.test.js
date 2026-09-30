/**
 * GH-787 (queue item 3vy) — ONE RECOVERY WINDOW, ON THE STAND.
 *
 * WHAT NO OFFLINE CASE CAN SETTLE: whether a real run of a real site now produces one recovery window, whether
 * it is the figure the two paths' disagreement pointed at rather than a third one, and whether the figures the
 * two paths already agreed on stayed where they were.
 *
 * MEASURED BEFORE THIS WINDOW, from the last stored row of every site, in both directions — the sites are NOT
 * named here, because a live file that names one joins the inventory of GH-703 and that inventory never grows;
 * this one takes its sites from the window that opened it:
 *   - the two paths disagreed about `recoveryCapacity.days` at 10 of 10 sites carrying both figures
 *     (17 days against 7 at one, 18 against 8 at another, 28 against 12 at a third), about
 *     `recoveryProbability` at 9 of those 10, and about the species and variety they were given at all 10;
 *   - they AGREED on 43 paths at all ten sites, among them `compactionRisk.riskPercent`, `usageRatio`, the
 *     moisture block, `actionPriority` entire, `aerationSchedule`, `cumulativeStress`,
 *     `effectiveLoad.totalEffectiveHours` and every `inputs.schedule.*`. Those must not move;
 *   - three sites had no second figure to compare at all; they are found in the database rather than listed.
 *
 * THE REVIEWER'S CONDITION, AND WHY THE ORDER OF THIS WINDOW IS WHAT IT IS. "The screen and the document name
 * one figure" can happen two ways: because both ask one calculation, or because both read one stored row. The
 * second says nothing about the calculation, and the owner decided about the calculation. So the document is
 * exported BEFORE the site is re-run: at that moment the stored row still carries the old figure, and if the
 * two surfaces differ there, the document is computing rather than reading. Then the site is re-run and they
 * are read again, in the same hour, and agreement then is agreement about the calculation.
 *
 * Every figure below is printed with WHERE IT CAME FROM, which is the other half of that condition.
 *
 * Run: GILBA_E2E=1 GILBA_E2E_GH787=1 GILBA_E2E_GH787_SITES='<sports site>;<other site>' \
 *      npx jest tests/e2e/gh787-wear-one-figure-on-the-stand-live.test.js --runInBand --testTimeout=900000
 *
 * The FIRST name is the one the two surfaces are compared on and must be a sports site: the export prints its
 * traffic and recovery-stress sections only for a non-golf surface (measured in this window — a golf site's
 * document carried neither heading while its own pass had computed the figure).
 */
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

let chromium = null;
try { ({ chromium } = require('playwright')); } catch (e) { /* reported below */ }

const ENABLED = process.env.GILBA_E2E === '1' && process.env.GILBA_E2E_GH787 === '1' && !!chromium;
const CREDENTIALS_PATH = process.env.GILBA_E2E_CREDENTIALS || path.join(__dirname, '.e2e-credentials.json');
const credentials = fs.existsSync(CREDENTIALS_PATH) ? JSON.parse(fs.readFileSync(CREDENTIALS_PATH, 'utf8')) : {};
const BASE_URL = process.env.GILBA_E2E_URL || credentials.url || 'http://127.0.0.1:8080';
const EMAIL = process.env.GILBA_E2E_EMAIL || credentials.email;
const PASSWORD = process.env.GILBA_E2E_PASSWORD || credentials.password;

/** The sites this window was opened for, by name from the environment. With none it presses nothing. */
const RERUN = String(process.env.GILBA_E2E_GH787_SITES || '').split(';')
    .map((n) => n.trim()).filter((n) => n);
/** The first of them is where the two surfaces are compared, and it must be a sports site — see the header. */
const SPORTS = RERUN[0] || null;

function query(sql) {
    return execFileSync('docker', ['exec', 'gilba_mysql', 'mysql', '-ugilba', '-pgilba_secret',
        'gilba', '-N', '-e', sql], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })
        .split('\n').map((l) => l.trim()).filter((l) => l);
}

/** Every site's latest row id, so a site outside this window is seen if it moves. */
function standNow() {
    const out = {};
    query("SELECT CONCAT_WS('|', s.name, ar.id) FROM sites s JOIN analysis_results ar "
        + 'ON ar.id = (SELECT MAX(id) FROM analysis_results WHERE site_id = s.id)').forEach((line) => {
        const cut = line.split('|');
        out[cut[0]] = cut[1];
    });

    return out;
}

/** The wear figures of one stored row: the two that disagreed, the ones that agreed, and the two keys removed. */
function wearOf(rowId) {
    const one = (p) => {
        const out = query("SELECT COALESCE(JSON_UNQUOTE(JSON_EXTRACT(computed,'$." + p + "')),'(absent)') "
            + 'FROM analysis_results WHERE id = ' + Number(rowId));

        return out.join('');
    };

    return {
        days: one('wear.recoveryCapacity.days'),
        probability: one('wear.recoveryProbability'),
        growthModifier: one('wear.recoveryCapacity.modifiers.growth'),
        species: one('wear.inputs.species'),
        variety: one('wear.inputs.variety'),
        construction: one('wear.inputs.construction'),
        season: one('wear.compactionRisk.capacityData.season'),
        // the ones both paths already agreed on — they must not move
        riskPercent: one('compactionRisk.riskPercent') === '(absent)' ? one('wear.compactionRisk.riskPercent') : one('wear.compactionRisk.riskPercent'),
        usageRatio: one('wear.compactionRisk.usageRatio'),
        load: one('wear.effectiveLoad.totalEffectiveHours'),
        priority: one('wear.actionPriority.priority'),
        stressStatus: one('wear.cumulativeStress.status'),
        aeration: one('wear.aerationSchedule.recommendedWeeks'),
        // and the two keys this item removed
        cascadeAlias: one('wearRecovery.recoveryCapacity.days'),
        secondPass: one('wear.adjustedRecovery.adjustedDays'),
    };
}

function decodeEntities(s) {
    return String(s).replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"').replace(/&apos;/g, "'");
}
function docxText(xml) {
    return decodeEntities(xml.replace(/<\/w:p>/g, '\n').replace(/<\/w:tc>/g, '\t').replace(/<[^>]+>/g, ''))
        .replace(/[ \t]+\n/g, '\n');
}
/** The document's own Recovery Window, from the traffic block's key/value row. */
function recoveryWindowIn(text) {
    const m = /Recovery Window\s*\t?\s*(\d+(?:\.\d+)?)\s*days/i.exec(text);

    return m ? Number(m[1]) : null;
}

(ENABLED ? describe : describe.skip)('GH-787 — one recovery window, measured on the stand', () => {
    if (!ENABLED) {
        process.stdout.write('[e2e] gh787 skipped (presses Re-run and exports on the stand — announce first,'
            + ' then GILBA_E2E=1 GILBA_E2E_GH787=1)\n');
    }

    const say = (s) => process.stdout.write('[gh787-live] ' + s + '\n');
    const seen = { beforeRerun: {}, afterRerun: {}, plan: {}, docx: {}, provenance: {}, noSecond: {} };
    let moved = null;

    test('the screen and the document name one figure, and it is the calculation that makes them agree',
        async () => {
            expect(EMAIL && PASSWORD).toBeTruthy();
            expect(RERUN.length).toBeGreaterThan(0);
            const before = standNow();
            RERUN.forEach((n) => { seen.beforeRerun[n] = wearOf(before[n]); });
            /**
             * The sites with nothing to compare are FOUND, not listed: a stored row that carries the wear key
             * and not the cascade's alias had only one figure in it to begin with. Listing them here would put
             * three more stand identities in a file, and the inventory of GH-703 does not grow.
             */
            Object.keys(before).forEach((name) => {
                if (RERUN.indexOf(name) >= 0) return;
                const w = wearOf(before[name]);
                if (w.days !== '(absent)' && w.cascadeAlias === '(absent)') seen.noSecond[name] = w;
            });
            say('rows before: ' + JSON.stringify(RERUN.map((n) => n + '=' + before[n])));
            RERUN.forEach((n) => say('  BEFORE ' + n + ': ' + JSON.stringify(seen.beforeRerun[n])));

            const browser = await chromium.launch({ headless: true });
            const context = await browser.newContext({ acceptDownloads: true });
            const page = await context.newPage();
            page.on('console', (m) => {
                const t = m.text();
                if (/wear|Wear|Step 7/.test(t)) say('  console: ' + t.slice(0, 160));
            });

            /**
             * WHERE EACH SURFACE TOOK ITS FIGURE FROM, recorded in the page rather than reasoned about: every
             * call of the orchestrator's `getComputed('wear')` — which is what the export asks — and whether
             * the Plan page had a stored row to read.
             */
            await page.addInitScript(() => {
                window.__gh787 = { getComputed: [], planRow: null };
                const watch = () => {
                    try {
                        const o = window.GaipOrchestrator;
                        if (o && typeof o.getComputed === 'function' && !o.__gh787wrapped) {
                            const original = o.getComputed.bind(o);
                            o.getComputed = function (key) {
                                const answer = original(key);
                                if (key === 'wear') {
                                    window.__gh787.getComputed.push({
                                        at: Date.now(),
                                        days: answer && answer.recoveryCapacity ? answer.recoveryCapacity.days : null,
                                        hasSecondPass: !!(answer && answer.adjustedRecovery),
                                    });
                                }

                                return answer;
                            };
                            o.__gh787wrapped = true;
                        }
                    } catch (e) { /* the page may not have it yet */ }
                };
                watch();
                setInterval(watch, 50);
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

            /**
             * A navigation that the page itself interrupts is retried, not a failure of the measurement.
             * Measured in this window: switching sites makes the dashboard navigate to itself, and a `goto`
             * arriving in that moment threw "interrupted by another navigation" — the run died between two
             * sites with the first one's figures already taken.
             */
            const goTo = async (url) => {
                for (let attempt = 0; attempt < 3; attempt += 1) {
                    try {
                        await page.goto(url, { waitUntil: 'domcontentloaded' });

                        return;
                    } catch (e) {
                        if (!/interrupted by another navigation/.test(String(e && e.message))) throw e;
                        await page.waitForTimeout(2000);
                    }
                }
                await page.waitForTimeout(2000);
            };

            const standOn = async (name) => {
                await goTo(BASE_URL + '/dashboard?setup=0');
                await page.waitForTimeout(2500);
                let label = await page.evaluate(() => ((document.getElementById('db-site-switcher-btn') || {})
                    .textContent || '').trim());
                if (label !== name) {
                    await page.click('#db-site-switcher-btn');
                    await page.waitForTimeout(800);
                    await page.evaluate((wanted) => {
                        const dd = document.getElementById('db-site-dropdown');
                        if (!dd) return;
                        const items = Array.from(dd.querySelectorAll('a,button,[data-site-id],li'));
                        const hit = items.find((el) => (el.textContent || '').trim() === wanted)
                            || items.find((el) => (el.textContent || '').trim().includes(wanted));
                        if (hit) hit.click();
                    }, name);
                    await page.waitForTimeout(4000);
                    await goTo(BASE_URL + '/dashboard?setup=0');
                    await page.waitForTimeout(2500);
                    label = await page.evaluate(() => ((document.getElementById('db-site-switcher-btn') || {})
                        .textContent || '').trim());
                }

                return label;
            };

            /** The Plan page's own Recovery Window, and the row it read it from. */
            const planFigure = async () => {
                // The recovery card lives on its own tab, and the tab is what draws it.
                await goTo(BASE_URL + '/plan#recovery');
                await page.waitForTimeout(9000);

                return page.evaluate(() => {
                    /** The figure printed under the card's own label, taken through the DOM, not by a regex. */
                    const labelled = (want) => {
                        const label = Array.from(document.querySelectorAll('.plan-metric-label'))
                            .find((el) => (el.textContent || '').trim() === want);
                        if (!label) return null;
                        const card = label.parentElement;
                        const value = card ? card.querySelector('.plan-metric-value, .plan-metric-num') : null;
                        const text = value ? (value.textContent || '') : (card ? card.textContent || '' : '');
                        const m = /(\d+(?:\.\d+)?)/.exec(text.replace((want || ''), ''));

                        return m ? Number(m[1]) : null;
                    };
                    const data = window.GAIP_DASHBOARD_DATA || {};
                    const stored = data.computed && data.computed.wear;
                    const stress = document.querySelector('.plan-stress-factors');

                    return {
                        printed: labelled('Recovery Window'),
                        // WHERE IT CAME FROM: the stored row this page was given, or nothing.
                        source: stored ? 'the stored row (GAIP_DASHBOARD_DATA.computed.wear)' : 'no stored wear on this page',
                        storedDays: stored && stored.recoveryCapacity ? stored.recoveryCapacity.days : null,
                        storedHasSecondPass: !!(stored && stored.adjustedRecovery),
                        stressBlock: stress ? (stress.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 220) : null,
                        saysArrow: /Recovery probability:\s*\d+%\s*→/.test(document.body.innerText || ''),
                    };
                });
            };

            /** The document's own Recovery Window, from a real export of this site. */
            const docxFigure = async (label) => {
                await goTo(BASE_URL + '/reports/export');
                await page.waitForTimeout(12000);
                /**
                 * The samples are chosen in the product's own picker, which the page's button opens — the
                 * checkboxes do not exist until it does. Everything selected, so the document is the one a
                 * person would get.
                 */
                await page.locator('button:has-text("Generate & Download Word")').first().click();
                await page.waitForSelector('#csp-export', { timeout: 60000 });
                /**
                 * ONE SITE'S SAMPLE, not every sample the account has.
                 *
                 * The picker offers all of them and starts with all ticked, so the first export of this window
                 * was a combined document of 36 samples — and reading "Recovery Window" out of it took the
                 * FIRST occurrence, which belonged to another site. The figure was about somebody else's site,
                 * which is the same class as reading a page global: an answer about the wrong subject.
                 */
                const pick = await page.evaluate((siteName) => {
                    const none = document.getElementById('csp-none');
                    if (none) none.click();
                    const boxes = Array.from(document.querySelectorAll('input[data-sample-uid]'));
                    const mine = boxes.filter((b) => String(b.getAttribute('data-sample-uid') || '')
                        .indexOf(siteName) === 0
                        || (b.closest('.gaip-bulk-group') || { textContent: '' }).textContent.indexOf(siteName) >= 0);
                    const target = mine[0] || null;
                    if (target) { target.checked = true; target.dispatchEvent(new Event('change', { bubbles: true })); }

                    return {
                        offered: boxes.length,
                        mine: mine.length,
                        checked: document.querySelectorAll('input[data-sample-uid]:checked').length,
                        uid: target ? target.getAttribute('data-sample-uid') : null,
                    };
                }, label);
                if (!pick.offered) return { error: 'the picker offered no samples' };
                if (pick.checked !== 1) return { error: 'wanted one sample of the site, got ' + JSON.stringify(pick) };
                const [download] = await Promise.all([
                    page.waitForEvent('download', { timeout: 300000 }),
                    page.click('#csp-export'),
                ]);
                const file = path.join(os.tmpdir(), 'gh787-' + label + '-' + Date.now() + '.docx');
                await download.saveAs(file);
                const xml = execFileSync('unzip', ['-p', file, 'word/document.xml'],
                    { maxBuffer: 64 * 1024 * 1024 }).toString();
                try { fs.unlinkSync(file); } catch (e) { /* */ }
                const text = docxText(xml);
                const calls = await page.evaluate(() => (window.__gh787 || {}).getComputed || []);

                return {
                    offered: pick.offered,
                    mine: pick.mine,
                    uid: pick.uid,
                    checked: pick.checked,
                    days: recoveryWindowIn(text),
                    // WHERE IT CAME FROM: the pass this page made itself, which is what these calls record.
                    source: calls.length ? 'this page\'s own pass, through GaipOrchestrator.getComputed("wear") ('
                        + calls.length + ' call(s), last days=' + JSON.stringify(calls[calls.length - 1].days) + ')'
                        : 'no getComputed("wear") call was recorded',
                    secondPassSeen: calls.some((c) => c.hasSecondPass),
                    stressHeading: /Environmental Stress Factors Affecting Recovery/.test(text),
                    hasSecondPassSentence: /Recovery window has extended from/.test(text),
                };
            };

            /**
             * ── 1. THE DOCUMENT BEFORE THE ROW MOVES: if it differs from the screen here, it is computing.
             *
             * ON A SPORTS SITE, and that is not a detail. The export prints its traffic and its recovery-stress
             * sections only for a non-golf surface — measured in this window: a single-sample document for a
             * golf site carried neither heading, while the page's own pass had computed the figure all the same
             * (one `getComputed("wear")` call answering 11). So the comparison of the two surfaces is made where
             * both of them print, which is a sports site.
             */
            const stoodSports = await standOn(SPORTS);
            say('--- ' + SPORTS + ', BEFORE any re-run (standing on "' + stoodSports + '")');
            expect(stoodSports).toBe(SPORTS);
            seen.plan[SPORTS + ' before'] = await planFigure();
            say('  /plan reads: ' + JSON.stringify(seen.plan[SPORTS + ' before']));
            seen.docx[SPORTS + ' before'] = await docxFigure(SPORTS);
            say('  the document says: ' + JSON.stringify(seen.docx[SPORTS + ' before']));

            // ── 2. RE-RUN BOTH SITES, then read the screen and the document again in the same hour.
            for (const name of RERUN) {
                const wasRow = before[name];
                const label = await standOn(name);
                say('--- ' + name + ': standing on "' + label + '", pressing Re-run');
                expect(label).toBe(name);
                await page.click('#db-rerun-btn', { timeout: 30000 });
                say('  pressed at ' + new Date().toISOString());
                let landed = null;
                for (let i = 0; i < 80 && !landed; i += 1) {
                    await page.waitForTimeout(3000);
                    const now = standNow()[name];
                    if (now && Number(now) > Number(wasRow)) landed = now;
                }
                if (!landed) { say('  NO NEW ROW within 240s'); continue; }
                seen.afterRerun[name] = wearOf(landed);
                say('  row ' + wasRow + ' -> ' + landed);
                say('  AFTER ' + name + ': ' + JSON.stringify(seen.afterRerun[name]));
            }

            await standOn(SPORTS);
            seen.plan[SPORTS + ' after'] = await planFigure();
            say('--- ' + SPORTS + ', AFTER the re-run');
            say('  /plan reads: ' + JSON.stringify(seen.plan[SPORTS + ' after']));
            seen.docx[SPORTS + ' after'] = await docxFigure(SPORTS);
            say('  the document says: ' + JSON.stringify(seen.docx[SPORTS + ' after']));

            seen.provenance = await page.evaluate(() => (window.__gh787 || null));
            moved = standNow();
            await browser.close();

            // ── WHAT THE WINDOW SHOWS ────────────────────────────────────────────────────────────────────
            process.stdout.write('\n[gh787-live] ==== the two halves ====\n');
            RERUN.forEach((n) => {
                const b = seen.beforeRerun[n], a = seen.afterRerun[n] || {};
                process.stdout.write('[gh787-live] ' + n + ': days ' + b.days + ' -> ' + a.days
                    + ' | probability ' + b.probability + ' -> ' + a.probability
                    + ' | growth modifier ' + b.growthModifier + ' -> ' + a.growthModifier
                    + '\n[gh787-live]     the cascade alias: ' + b.cascadeAlias + ' -> ' + a.cascadeAlias
                    + ' | the second pass: ' + b.secondPass + ' -> ' + a.secondPass
                    + '\n[gh787-live]     WHAT AGREED BEFORE, after: load ' + b.load + ' -> ' + a.load
                    + ' | usage ' + b.usageRatio + ' -> ' + a.usageRatio
                    + ' | priority ' + b.priority + ' -> ' + a.priority
                    + ' | stress ' + b.stressStatus + ' -> ' + a.stressStatus
                    + ' | aeration ' + b.aeration + ' -> ' + a.aeration + '\n');
            });
            process.stdout.write('[gh787-live] rows with a wear figure and no second one (' 
                + Object.keys(seen.noSecond).length + '): '
                + Object.keys(seen.noSecond).map((n) => n + ' days=' + seen.noSecond[n].days).join(' | ') + '\n');
            process.stdout.write('[gh787-live] ==== where each surface took its figure ====\n'
                + '[gh787-live]   /plan  before: ' + seen.plan[SPORTS + ' before'].printed
                + ' from ' + seen.plan[SPORTS + ' before'].source + '\n'
                + '[gh787-live]   docx   before: ' + seen.docx[SPORTS + ' before'].days
                + ' from ' + seen.docx[SPORTS + ' before'].source + '\n'
                + '[gh787-live]   /plan  after:  ' + seen.plan[SPORTS + ' after'].printed
                + ' from ' + seen.plan[SPORTS + ' after'].source + '\n'
                + '[gh787-live]   docx   after:  ' + seen.docx[SPORTS + ' after'].days
                + ' from ' + seen.docx[SPORTS + ' after'].source + '\n');

            // 1. The figure the disagreement pointed at, not a third one.
            // The site the surfaces are compared on ran, and its window is shorter than the row it replaced —
            // which is the direction the defect had: an absent growth figure took the worst band, 2.5.
            expect(seen.afterRerun[SPORTS]).toBeTruthy();
            expect(Number(seen.afterRerun[SPORTS].days))
                .toBeLessThanOrEqual(Number(seen.beforeRerun[SPORTS].days));
            // 2. One figure: neither removed key is in the new row.
            RERUN.forEach((n) => {
                if (!seen.afterRerun[n]) return;
                expect(seen.afterRerun[n].cascadeAlias).toBe('(absent)');
                expect(seen.afterRerun[n].secondPass).toBe('(absent)');
            });
            // 3. The screen and the document agree AFTER, and the document was computing rather than reading:
            //    before the row moved it already differed from the screen.
            expect(seen.docx[SPORTS + ' after'].days).toBe(seen.plan[SPORTS + ' after'].printed);
            expect(seen.docx[SPORTS + ' before'].days).not.toBe(seen.plan[SPORTS + ' before'].printed);
            // 4. And the second pass is nowhere in the document.
            expect(seen.docx[SPORTS + ' after'].hasSecondPassSentence).toBe(false);

            /**
             * 5. THIS FILE'S OWN PROTECTION, in place of the general remedy (GH-532, GH-519): the last row id
             * of EVERY site with a stored row, before and after. A site the window was not opened for must not
             * have moved, and the two it was opened for must have GAINED a row rather than had one rewritten.
             * Without this the file would be pressing the product's Re-run on a shared stand with nothing
             * saying what else it touched.
             */
            const wandered = Object.keys(before)
                .filter((name) => RERUN.indexOf(name) < 0)
                .filter((name) => String(before[name]) !== String((moved || {})[name]))
                .map((name) => name + ': ' + before[name] + ' -> ' + (moved || {})[name]);
            process.stdout.write('[gh787-live] sites outside this window that moved: '
                + JSON.stringify(wandered) + '\n[gh787-live] sites the window was opened for: '
                + JSON.stringify(RERUN.map((n) => n + ': ' + before[n] + ' -> ' + (moved || {})[n])) + '\n');
            expect({ sitesOutsideTheWindowThatMoved: wandered })
                .toEqual({ sitesOutsideTheWindowThatMoved: [] });
            RERUN.forEach((n) => {
                if (!seen.afterRerun[n]) return;
                expect(Number((moved || {})[n])).toBeGreaterThan(Number(before[n]));
            });
        });
});
