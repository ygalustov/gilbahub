/**
 * GH-769 (queue item 3vs, position 1) — DOES THE CONSTRUCTION CHOSEN IN THE WIZARD REACH THE
 * DATABASE? Measured by walking the wizard, not by reading it.
 *
 * THE REPORT. The owner set up a new site, chose the construction in the wizard, and found the field
 * empty in Settings afterwards. Reading the wizard does not settle it: it DOES send the value --
 * `if (self.d.construction) { turfSection.construction = self.d.construction; }` -- and the change
 * listener is attached after the markup is already in the document, so the first guess (a silent
 * `getElementById`) was wrong. What was not established is whether the value is in `self.d` by the
 * time the wizard saves, and whether what is sent is what lands.
 *
 * WHY THE ONE WIZARD-MADE SITE ON THE STAND PROVES NOTHING: `GH-671 wizard press 022408` carries no
 * construction, and its own test never touches `#wiz-construction` -- it picks a species, clicks a
 * methodology and presses Next. An absence nobody chose is not an absence that was dropped.
 *
 * SO THIS PRESSES IT THE WAY A PERSON DOES: a new site through the product's own Add site form, the
 * wizard walked to the end, and the construction CHOSEN on the species step with a change event.
 * Three things are recorded apart, because the answer differs by which one fails: what the select
 * held after the choice, what the PATCH body carried, and what the database holds.
 *
 * IT CREATES ONE NEW SITE AND WRITES TO IT. That is the subject -- the stand guard would hold the
 * very save under measurement, which is why this file is exempt from it like the wizard test it is
 * modelled on. It touches no site it did not create.
 *
 * Run: GILBA_E2E=1 GILBA_E2E_GH769_WIZARD=1 npx jest tests/e2e/gh769-the-wizard-saves-the-construction-live.test.js
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

let chromium = null;
try { ({ chromium } = require('playwright')); } catch (e) { /* reported below */ }

const ENABLED = process.env.GILBA_E2E === '1' && process.env.GILBA_E2E_GH769_WIZARD === '1' && !!chromium;
const CREDENTIALS_PATH = process.env.GILBA_E2E_CREDENTIALS || path.join(__dirname, '.e2e-credentials.json');
const credentials = fs.existsSync(CREDENTIALS_PATH) ? JSON.parse(fs.readFileSync(CREDENTIALS_PATH, 'utf8')) : {};
const BASE_URL = process.env.GILBA_E2E_URL || credentials.url || 'http://127.0.0.1:8080';
const EMAIL = process.env.GILBA_E2E_EMAIL || credentials.email;
const PASSWORD = process.env.GILBA_E2E_PASSWORD || credentials.password;
const SITE_NAME = process.env.GILBA_GH769_SITE || 'GH-769 construction press';
/**
 * Which construction to choose. The wizard offers the declared list (eleven values); the Settings
 * form offers five of its own. Naming one lets this file ask the second question the report needs:
 * is a value the database HOLDS shown by Settings, or does a form that never learned the value
 * render its field empty and read as "it did not save"?
 */
const WANT_CONSTRUCTION = process.env.GILBA_GH769_CONSTRUCTION || '';

function query(sql) {
    return execFileSync('docker', ['exec', 'gilba_mysql', 'mysql', '-ugilba', '-pgilba_secret',
        'gilba', '-N', '-e', sql], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })
        .split('\n').map((l) => l.trim()).filter((l) => l);
}

(ENABLED ? describe : describe.skip)('GH-769 position 1 — the construction chosen in the wizard', () => {
    let browser, page;
    const patches = [];
    const dialogs = [];
    let chosen = null, selectAfter = null, siteId = null, inDatabase = null, screenAfter = null;
    let speciesPick = null, speciesAfterPick = null, speciesAfterConstruction = null, varietyPick = null;
    let inSettings = null;

    beforeAll(async () => {
        browser = await chromium.launch();
        page = await browser.newPage();
        page.on('dialog', async (d) => { dialogs.push(d.type() + ': ' + d.message()); await d.dismiss().catch(() => {}); });
        page.on('request', (r) => {
            if (r.method() === 'GET') return;
            let body = null;
            try { body = r.postData(); } catch (e) { body = null; }
            patches.push({ method: r.method(), url: r.url().replace(BASE_URL, ''), body: body });
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

        // A fresh site of my own, through the product's own form.
        await page.goto(BASE_URL + '/account', { waitUntil: 'domcontentloaded' });
        await page.waitForTimeout(2500);
        await page.evaluate(() => {
            const tab = document.querySelector('[data-tab="sites"], #stg-tab-sites-btn');
            if (tab) tab.click();
            const add = document.getElementById('stg-add-site-btn');
            if (add) add.click();
        });
        await page.waitForTimeout(800);
        await page.fill('#stg-new-site-name', SITE_NAME);
        await page.selectOption('#stg-new-site-type', 'sports');
        await page.click('#stg-add-site-save-btn');
        await page.waitForTimeout(4000);
        siteId = (query("SELECT id FROM sites WHERE name='" + SITE_NAME + "' ORDER BY created_at DESC LIMIT 1")[0] || null);
        if (!siteId) throw new Error('the Add site form created nothing named ' + SITE_NAME);
        process.stdout.write('[gh769w] site created: ' + siteId + '\n');

        // Switch to it and walk the wizard.
        await page.goto(BASE_URL + '/dashboard?setup=1&site=' + siteId, { waitUntil: 'domcontentloaded' });
        await page.waitForTimeout(4000);
        const nextButton = async () => {
            await page.evaluate(() => {
                const btns = Array.from(document.querySelectorAll('button'));
                const next = btns.reverse().find((b) => /Next|Go to Dashboard/i.test(b.textContent || ''));
                if (next) next.click();
            });
            await page.waitForTimeout(2500);
        };
        await nextButton();
        await page.evaluate(() => {
            const lat = document.getElementById('wiz-lat');
            const lon = document.getElementById('wiz-lon');
            if (lat && lon) {
                lat.value = '-37.8136'; lon.value = '144.9631';
                lat.dispatchEvent(new Event('change', { bubbles: true }));
                lon.dispatchEvent(new Event('change', { bubbles: true }));
            }
        });
        await page.waitForTimeout(500);
        await nextButton();
        await page.evaluate(() => { const el = document.querySelector('[data-type="sports"]'); if (el) el.click(); });
        await page.waitForTimeout(800);
        await nextButton();

        // The species step: species, THEN the construction, then the methodology — the order a
        // person takes down the form.
        speciesPick = await page.evaluate(() => {
            const sel = document.getElementById('wiz-species');
            if (!sel) return { picked: 'NO SPECIES SELECT', options: 0 };
            const option = Array.from(sel.options).find((o) => o.value);
            if (!option) return { picked: 'NO SPECIES OFFERED', options: sel.options.length };
            sel.value = option.value;
            sel.dispatchEvent(new Event('change', { bubbles: true }));
            return { picked: option.value, options: sel.options.length };
        });
        await page.waitForTimeout(800);
        speciesAfterPick = await page.evaluate(() => {
            const sel = document.getElementById('wiz-species');
            return sel ? sel.value : 'GONE';
        });
        chosen = await page.evaluate((want) => {
            const sel = document.getElementById('wiz-construction');
            if (!sel) return 'NO CONSTRUCTION SELECT ON THE STEP';
            const option = want
                ? Array.from(sel.options).find((o) => o.value === want)
                : Array.from(sel.options).find((o) => o.value);
            if (!option) return 'NOT OFFERED: ' + want;
            sel.value = option.value;
            sel.dispatchEvent(new Event('change', { bubbles: true }));
            return option.value;
        }, WANT_CONSTRUCTION);
        await page.waitForTimeout(800);
        // The cultivar, because the step's gate requires it too (GH-684) and a walk that skips it
        // stops here with the construction already chosen -- which is what the first two runs of
        // this file measured: the wizard stayed on the species step and never saved at all.
        varietyPick = await page.evaluate(() => {
            const sel = document.getElementById('wiz-variety');
            if (!sel) return 'NO CULTIVAR SELECT';
            const option = Array.from(sel.options).find((o) => o.value);
            if (!option) return 'NO CULTIVAR OFFERED';
            sel.value = option.value;
            sel.dispatchEvent(new Event('change', { bubbles: true }));
            return option.value;
        });
        await page.waitForTimeout(800);
        const bothAfter = await page.evaluate(() => ({
            construction: (document.getElementById('wiz-construction') || {}).value || 'GONE FROM THE STEP',
            species: (document.getElementById('wiz-species') || {}).value || '(empty)',
        }));
        selectAfter = bothAfter.construction;
        speciesAfterConstruction = bothAfter.species;
        await page.evaluate(() => { const m = document.querySelector('.wiz-method-btn'); if (m) m.click(); });
        await page.waitForTimeout(800);
        await nextButton();
        await nextButton();
        await page.waitForTimeout(8000);

        // What the wizard says at the end, because a save that never fired says why on the screen:
        // the step gate names what is missing (GH-583/GH-684), and a silent walk past it would look
        // the same as a dropped field.
        screenAfter = await page.evaluate(() => {
            const step = document.querySelector('#wiz-loc-search, .wiz-type-btn, #wiz-species, #wiz-construction');
            const overlay = document.querySelector('.gaip-wizard, [class*="wizard"]');
            const text = (document.body.innerText || '');
            return {
                url: location.pathname + location.search,
                wizardStillOpen: !!step,
                whichStepElement: step ? step.id || step.className : null,
                nextButton: (() => {
                    const b = Array.from(document.querySelectorAll('button')).reverse()
                        .find((x) => /Next|Go to Dashboard/i.test(x.textContent || ''));
                    return b ? { label: (b.textContent || '').trim(), disabled: !!b.disabled } : null;
                })(),
                gateNote: (Array.from(document.querySelectorAll('[class*="wiz"]'))
                    .map((e) => (e.textContent || '').trim())
                    .filter((t) => /still needs|missing|required/i.test(t))[0] || null),
                lastButtons: Array.from(document.querySelectorAll('button')).map((b) => (b.textContent || '').trim())
                    .filter((t) => t).slice(-6),
            };
        });
        // And what SETTINGS shows for the same site, which is where the report was read from.
        await page.goto(BASE_URL + '/settings?site=' + siteId, { waitUntil: 'domcontentloaded' });
        await page.waitForTimeout(3500);
        inSettings = await page.evaluate(() => {
            const sel = document.getElementById('stg-turf-construction');
            if (!sel) return { field: 'NO CONSTRUCTION FIELD ON SETTINGS' };
            return {
                value: sel.value,
                selectedLabel: (sel.options[sel.selectedIndex] || {}).text || null,
                offers: Array.from(sel.options).map((o) => o.value).filter((v) => v),
            };
        });
        inDatabase = query("SELECT IFNULL(JSON_UNQUOTE(JSON_EXTRACT(config,'$.turf.construction')),'(no key)') "
            + "FROM site_configs WHERE namespace='gaip' AND site_id='" + siteId + "'")[0] || '(no config row)';
    }, 300000);

    afterAll(async () => { if (browser) await browser.close(); });

    /**
     * GH-769 position 1, the second half — AND SETTINGS SHOWS WHAT THE SITE HOLDS.
     *
     * Measured before the repair: a site whose stored construction is one the Settings form does not
     * offer rendered `value: ""` and the label "— select —", while the database held `push_up`. That
     * is what "it did not save" was read from. The form offers five; the declared list carries eleven
     * with their labels, and which five are OFFERED is the owner's decision and another position's
     * work. This case is about the stored value being visible either way.
     */
    test('Settings shows the construction the database holds, even one it does not offer', () => {
        process.stdout.write('[gh769w] database ' + JSON.stringify(inDatabase)
            + ' | Settings ' + JSON.stringify(inSettings) + '\n');

        expect(inSettings.value).toBe(inDatabase);
    });

    test('the construction chosen on the step is the one the database holds', () => {
        const gaipPatch = patches.filter((p) => /\/config\/gaip$/.test(p.url)).slice(-1)[0] || null;
        let sentTurf = null;
        try { sentTurf = gaipPatch ? (JSON.parse(gaipPatch.body).patch || {}).turf : null; } catch (e) { sentTurf = 'unparsable'; }

        process.stdout.write('[gh769w] cultivar picked: ' + JSON.stringify(varietyPick) + '\n'
            + '[gh769w] species: picked ' + JSON.stringify(speciesPick)
            + ', the select held ' + JSON.stringify(speciesAfterPick)
            + ', and after the construction was chosen ' + JSON.stringify(speciesAfterConstruction) + '\n'
            + '[gh769w] chosen on the step: ' + JSON.stringify(chosen) + '\n'
            + '[gh769w] the select held afterwards: ' + JSON.stringify(selectAfter) + '\n'
            + '[gh769w] the config PATCH carried turf: ' + JSON.stringify(sentTurf) + '\n'
            + '[gh769w] the database holds: ' + JSON.stringify(inDatabase) + '\n'
            + '[gh769w] Settings shows: ' + JSON.stringify(inSettings) + '\n'
            + '[gh769w] non-GET requests: ' + JSON.stringify(patches.map((p) => p.method + ' ' + p.url)) + '\n'
            + '[gh769w] native dialogs: ' + JSON.stringify(dialogs) + '\n'
            + '[gh769w] the screen at the end: ' + JSON.stringify(screenAfter) + '\n');

        // Three separate claims, so a failure names which link broke rather than "it did not save".
        expect(selectAfter).toBe(chosen);
        expect(sentTurf && sentTurf.construction).toBe(chosen);
        expect(inDatabase).toBe(chosen);
    });
});
