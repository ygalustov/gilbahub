/**
 * GH-801 (queue item "Zones", stage C2) live check — THE TWO THINGS ONLY A SCREEN CAN ANSWER.
 *
 * The structural cases next door (`app/tests/Feature/Gh801TheZoneTypeIsRequiredOnTheZonesTabTest.php`)
 * hold the server's half: what it refuses, what it accepts, that one save types every zone, and that the
 * zones, the dictionary and the obligation reach the page. They cannot see the half the reviewer named
 * as the live part of this stage:
 *
 *   1. that the tab REALLY UNLOCKS IN ONE SAVE on a site with sixteen untyped zones, in a browser, with
 *      the selects a person uses rather than a request built in a test;
 *   2. that a person READS THE NAMES in the refusal — the sentence reaches the screen, with the zones
 *      listed, which is the whole reason the refusal names them.
 *
 * WHICH SITE, and this is the coordinator's decision of 01.10.2026 rather than a convenience. The stand
 * does have a site with sixteen zones, and it is on the protected list; using it would mean typing its
 * zones for good — doing the owner's own manual work for her, on her data. (That site is not named here
 * on purpose: a live file that names a stand site is declared in the inventory of
 * `gh703-live-tests-name-stand-sites-only-where-listed`, and this one does not use one.) So it MAKES ITS OWN
 * SITE through the product's own routes, gives it sixteen zones THE WAY THE PRODUCT MAKES THEM (by saving
 * samples from the Data road, which is what leaves a zone with no type), walks the screen on it, and
 * removes it again. Nothing of the stand is touched and no zone of anybody's site is typed.
 *
 * Run: GILBA_E2E=1 npx jest tests/e2e/gh801-the-zone-type-is-required-live.test.js --runInBand
 */

'use strict';

const fs = require('fs');
const path = require('path');

const ENABLED = process.env.GILBA_E2E === '1';

let credentials = {};
try {
    credentials = JSON.parse(fs.readFileSync(
        process.env.GILBA_E2E_CREDENTIALS || path.join(__dirname, '.e2e-credentials.json'), 'utf8'));
} catch (e) { credentials = {}; }

const BASE_URL = process.env.GILBA_E2E_URL || credentials.url || 'http://127.0.0.1:8080';
const EMAIL = process.env.GILBA_E2E_EMAIL || credentials.email;
const PASSWORD = process.env.GILBA_E2E_PASSWORD || credentials.password;

/** The shape of the live site this check builds: sixteen zones, none of them typed. */
const SIXTEEN = [
    'Green 1', 'Green 2', 'Green 3', 'Green 4', 'Green 5', 'Green 6', 'Green 7', 'Green 8',
    'Fairway 1', 'Fairway 2', 'Tee 1', 'Tee 2', 'Rough west', 'Approach 9', 'Practice', 'test',
];
const ADDED = 'Green 99';

let chromium = null;
try { ({ chromium } = require('playwright')); } catch (e) { /* reported below */ }

if (!ENABLED) {
    process.stdout.write('[e2e] gh801-the-zone-type-is-required-live skipped (needs the live stack)\n');
    test.skip('GH-801 live sign of delivery (disabled)', () => {});
} else {
    describe('GH-801 — the Zones tab asks for a type, and one save opens it again', () => {
        let browser, page, previousActiveSiteId = null, siteId = null;

        const api = (method, path, body) => page.evaluate(async ({ method, path, body }) => {
            const t = document.querySelector('meta[name=csrf-token]');
            const r = await fetch(path, {
                method,
                headers: Object.assign({ Accept: 'application/json' },
                    body ? { 'Content-Type': 'application/json' } : {},
                    t ? { 'X-CSRF-TOKEN': t.getAttribute('content') } : {}),
                body: body ? JSON.stringify(body) : undefined,
                credentials: 'same-origin',
            });

            return { status: r.status, body: await r.json().catch(() => null) };
        }, { method, path, body: body || null });

        const openTheZonesTab = async () => {
            await page.goto(BASE_URL + '/settings', { waitUntil: 'domcontentloaded' });
            await page.click('.stg-tab[data-tab=zones]');
            await page.waitForSelector('#stg-zone-list .stg-zone-item, #stg-zone-list .stg-zone-empty',
                { state: 'visible', timeout: 30000 });
        };

        /** What a person sees in the list: every row's name, its type and whether it is marked. */
        const theRowsOnScreen = () => page.evaluate(() => Array.from(
            document.querySelectorAll('#stg-zone-list .stg-zone-item')
        ).map((row) => {
            const name = row.querySelector('.stg-zone-name');
            const select = row.querySelector('.stg-zone-type');
            const note = row.querySelector('.gilba-required-note');

            return {
                name: name ? name.value : null,
                type: select ? select.value : null,
                boundTo: select ? select.getAttribute('data-input') : null,
                marked: note ? note.textContent.trim() : null,
                outlined: select ? /solid/.test(select.style.outline || '') : null,
            };
        }));

        beforeAll(async () => {
            if (!chromium) throw new Error('playwright does not resolve from the repo — run `npm install`');
            if (!EMAIL || !PASSWORD) throw new Error('no credentials — see tests/e2e/.e2e-credentials.example.json');
            browser = await chromium.launch();
            page = await browser.newPage();
            await page.goto(BASE_URL + '/login', { waitUntil: 'domcontentloaded' });
            await page.fill('#email', EMAIL);
            await page.fill('#password', PASSWORD);
            await Promise.all([
                page.waitForNavigation({ waitUntil: 'domcontentloaded' }).catch(() => {}),
                page.click('form.login-form button[type=submit]'),
            ]);
            await page.waitForTimeout(1500);
            if (/\/login/.test(page.url())) throw new Error('login refused for ' + EMAIL);

            const sites = await api('GET', '/api/sites');
            previousActiveSiteId = sites.body && sites.body.active_site_id;

            const made = await api('POST', '/api/sites', {
                name: 'GH-801 zones live check ' + Date.now(),
                location_name: 'Auckland, New Zealand',
                latitude: -36.8508827,
                longitude: 174.7644881,
                site_type: 'sports',
            });
            siteId = made.body && made.body.data && made.body.data.id;
            if (!siteId) throw new Error('could not make a site for this check: ' + JSON.stringify(made));
            await api('PATCH', '/api/active-site', { site_id: siteId });

            // The setup the page lock asks for, through the product's own wizard: without it Settings
            // does not open at all (GH-797), and this check is about the Zones tab, not the lock.
            await page.goto(BASE_URL + '/dashboard', { waitUntil: 'domcontentloaded' });
            await page.waitForTimeout(2500);
            const setup = await page.evaluate(async () => {
                const W = window.GilbaWizard;
                if (!W) return { error: 'GilbaWizard is not on this page' };
                W.d.location = { lat: -36.8508827, lon: 174.7644881, name: 'Auckland, New Zealand' };
                W.d.turfType = 'sports';
                W.d.species = 'Perennial Ryegrass';
                W.d.variety = 'generic';
                W.d.construction = 'sand_profile';
                W.d.methodology = 'ammonium_acetate';
                W.d.matchesPerWeek = 0;
                W.d.sessionsPerWeek = 0;
                W.d.soilTexture = 'sand';
                try { await W._save(); } catch (e) { return { error: e.message }; }

                return { ok: true };
            });
            if (setup.error) throw new Error('could not set the site up: ' + setup.error);
            await page.waitForTimeout(1500);

            // Sixteen zones, made the way the product makes them: a sample saved for a name the site
            // does not have yet. This is the state the transfer left on all thirteen stand sites.
            for (const name of SIXTEEN) {
                const saved = await api('POST', '/api/samples', {
                    site_id: siteId,
                    sample_type: 'soil',
                    payload: { _label: name, K: 120, P: 30, pH: 6.2 },
                });
                if (saved.status !== 201) throw new Error('could not make the zone ' + name + ': ' + JSON.stringify(saved));
            }
            const row = await api('GET', '/api/sites/' + siteId);
            const zones = (row.body && row.body.data && row.body.data.zones) || [];
            process.stdout.write('[gh801-live] made the site ' + siteId + ' with ' + zones.length
                + ' zones, types ' + JSON.stringify(zones.map((z) => z.zoneType))
                + ', previous active site ' + previousActiveSiteId + '\n');
            if (zones.length !== SIXTEEN.length) {
                throw new Error('the site did not end up with sixteen zones: ' + JSON.stringify(zones));
            }
        }, 600000);

        /**
         * GH-802 — THE RUN TAKES ITS ZONES AND SAMPLES AWAY, NOT ONLY ITS SITE.
         *
         * WHY THIS IS HERE. `DELETE /api/sites/{id}` is a SOFT delete: the site row stays with a
         * `deleted_at`, and everything hanging off it stays alive. For a site that is only a site that
         * costs nothing — every live file of this repository leaves one. For THIS file it cost something
         * measurable: two runs left 36 zone rows and 34 samples behind, and a zone row is not a private
         * matter — it is what the owner is about to be handed as a list to set types on by hand, and it
         * is what made a count of "zones on the stand" read 109 instead of 73 until somebody noticed.
         * Measured, coordinator's window of 01.10.2026: 73/69 with a filter for live sites, 109/103
         * without, and the whole difference was this file's two runs.
         *
         * SO IT CLEANS UP THROUGH THE PRODUCT'S OWN ROADS, in this order:
         *   1. the zones, in ONE save on the zones route with every id in `deleted` — the resulting set
         *      is empty, so it holds no zone without a type and the obligation does not stand in the way
         *      (which is the same rule stage C2 ships, used rather than worked around). Zone rows have no
         *      soft delete, so they are really gone;
         *   2. the samples, one `DELETE` each — soft, like everywhere else;
         *   3. the site itself, as before.
         * It prints what it removed, so a run that cleaned up nothing is not mistaken for one that had
         * nothing to clean.
         *
         * WHAT IT STILL LEAVES, said rather than left to be discovered: the soft-deleted site row and
         * its soft-deleted samples. That is what every live file here leaves and what the product's own
         * routes do; no zone row and no live sample remain.
         *
         * AND IT FAILS LOUDLY — four assertions, one per step and one on the state afterwards. The
         * reviewer's measurement of 01.10.2026 is why they are not optional: with the steps only
         * PRINTED, a cleanup that left a real zone row behind (`zones=74`, one row under a deleted site)
         * passed green. A silent cleanup cannot be told from one that did not happen, and the count it
         * spoils is the one this whole fixture exists to keep.
         *   1. the zones save answered 200 — a refusal means the save was not applied at all;
         *   2. every sample delete answered 200;
         *   3. NO ZONE ROW IS LEFT ON THE SITE, which is the one that catches a save accepted for a
         *      smaller set than it was given;
         *   4. the site delete answered 200.
         * Its own border: a run that made no zones at all would satisfy all four. That is what the line
         * it prints is for — it names what it removed, so "cleaned up nothing" reads differently from
         * "had nothing to clean".
         */
        afterAll(async () => {
            const problems = [];
            if (page && siteId) {
                /**
                 * GH-804 (part 1) — SAMPLES FIRST, THEN ZONES, THEN THE SITE.
                 *
                 * The order was zones first, and from this hand-in that gets a refusal on the very first
                 * step: a zone with samples pointing at it is not deleted any more, and every zone this
                 * run makes has samples (it makes them BY saving samples). So the samples go first, and
                 * the zones they held are free by the time the zones are asked for. The four assertions
                 * below are what would have caught the old order rather than letting the cleanup fail
                 * quietly — and that is the reviewer's mutation E9: put the two steps back the old way
                 * round and the first one answers 422.
                 */
                const list = await api('GET', '/api/samples?site_id=' + siteId + '&limit=2000');
                const sampleIds = ((list.body && list.body.data) || []).map((row) => row.id);
                const samplesGone = [];
                for (const id of sampleIds) {
                    const answer = await api('DELETE', '/api/samples/' + id);
                    samplesGone.push(answer.status);
                }

                const before = await api('GET', '/api/sites/' + siteId);
                const zoneIds = ((before.body && before.body.data && before.body.data.zones) || [])
                    .map((z) => z.id);
                const zonesGone = zoneIds.length
                    ? await api('PATCH', '/api/sites/' + siteId + '/zones', { deleted: zoneIds })
                    : { status: 200, body: { message: 'the run made no zones' } };

                const left = await api('GET', '/api/sites/' + siteId);
                const zonesLeft = ((left.body && left.body.data && left.body.data.zones) || []).length;
                if (previousActiveSiteId) await api('PATCH', '/api/active-site', { site_id: previousActiveSiteId });
                const gone = await api('DELETE', '/api/sites/' + siteId);
                process.stdout.write('[gh801-live] cleaned up after itself: '
                    + sampleIds.length + ' samples -> ' + JSON.stringify(
                        Array.from(new Set(samplesGone)))
                    + ', then ' + zoneIds.length + ' zones -> ' + zonesGone.status
                    + ', zones left on the site: ' + zonesLeft
                    + ', removed the site: ' + gone.status + '\n');

                // The four, each naming the number it saw.
                if (zonesGone.status !== 200) {
                    problems.push('the zones were not removed: the route answered ' + zonesGone.status
                        + ' ' + JSON.stringify(zonesGone.body && zonesGone.body.message)
                        + ' to a save deleting ' + zoneIds.length + ' of them');
                }
                const refusedSamples = samplesGone.filter((status) => status !== 200);
                if (refusedSamples.length) {
                    problems.push(refusedSamples.length + ' of ' + sampleIds.length
                        + ' samples were not removed: ' + JSON.stringify(refusedSamples));
                }
                if (zonesLeft !== 0) {
                    problems.push(zonesLeft + ' zone row(s) left on the site, which is what spoils the '
                        + 'count of zones on the stand and the list the owner sets types on');
                }
                if (gone.status !== 200) {
                    problems.push('the site was not removed: ' + gone.status);
                }
            }
            if (browser) await browser.close();
            if (problems.length) {
                throw new Error('[gh802] the cleanup did not finish: ' + problems.join('; '));
            }
        }, 300000);

        test('SIGN 1 — every zone opens marked Required, and the description no longer promises spray', async () => {
            await openTheZonesTab();
            const rows = await theRowsOnScreen();
            const tab = await page.evaluate(() => {
                const desc = document.querySelector('#stg-zones-form .stg-card-desc');
                const select = document.getElementById('stg-zone-type-input');

                return {
                    description: desc ? desc.textContent.trim() : null,
                    addOffers: select ? Array.from(select.options).map((o) => o.value) : null,
                };
            });
            process.stdout.write('[gh801-live] the rows as the tab opens: ' + JSON.stringify(rows)
                + '\n[gh801-live] the tab itself: ' + JSON.stringify(tab) + '\n');

            expect(rows.map((r) => r.name).sort()).toEqual(SIXTEEN.slice().sort());
            // Every one of them: no type, and the person is told so before pressing anything.
            expect(rows.map((r) => r.type)).toEqual(SIXTEEN.map(() => ''));
            expect(rows.map((r) => r.marked)).toEqual(SIXTEEN.map(() => 'Required'));
            expect(tab.description).not.toMatch(/spray/i);
            expect(tab.addOffers).toContain('green');
        }, 300000);

        test('SIGN 2 — a save is refused on screen, the zones are named in the sentence, and nothing changes', async () => {
            await openTheZonesTab();
            const before = await api('GET', '/api/sites/' + siteId);

            await page.fill('#stg-zone-input', ADDED);
            await page.selectOption('#stg-zone-type-input', 'green');
            await page.click('#stg-zone-add-btn');
            await page.click('#stg-zones-save');
            await page.waitForTimeout(2500);

            const shown = await page.evaluate(() => {
                const box = document.getElementById('stg-zones-msg');

                return { message: box ? (box.textContent || '').trim() : null, hidden: box ? box.hidden : null };
            });
            const rows = await theRowsOnScreen();
            const after = await api('GET', '/api/sites/' + siteId);
            process.stdout.write('[gh801-live] what the person reads: ' + JSON.stringify(shown)
                + '\n[gh801-live] rows outlined after the refusal: '
                + JSON.stringify(rows.filter((r) => r.outlined).map((r) => r.name))
                + '\n[gh801-live] the zones of the site before and after: '
                + JSON.stringify([(before.body.data.zones || []).length, (after.body.data.zones || []).length]) + '\n');

            expect(shown.hidden).toBe(false);
            // The sentence, and the names in it: the person is told WHICH zones hold the save up.
            expect(shown.message).toMatch(/^Not saved: fill in the zone type for /);
            SIXTEEN.forEach((name) => expect(shown.message).toContain(name));
            // The zone being added is typed, so it is not among them.
            expect(shown.message).not.toContain(ADDED);
            // And the rows a person has to look at are the ones outlined.
            expect(rows.filter((r) => r.outlined).map((r) => r.name).sort())
                .toEqual(SIXTEEN.slice().sort());
            // NOTHING WAS WRITTEN: the same sixteen zones, with the same (absent) types.
            expect((after.body.data.zones || []).map((z) => [z.name, z.zoneType]))
                .toEqual((before.body.data.zones || []).map((z) => [z.name, z.zoneType]));
        }, 300000);

        test('SIGN 3 — ONE save types every zone and the tab is open again', async () => {
            await openTheZonesTab();

            // The way out the owner was promised, done the way she will do it: choose a type in every
            // row, add the new zone, press Save once. (Deleting a spare zone in the SAME save is the
            // other half of her path and is held by the case next door, which can read the rows the
            // save left; here the subject is that one save opens the tab again.)
            const chosen = await page.evaluate(() => {
                const picked = {};
                Array.from(document.querySelectorAll('#stg-zone-list .stg-zone-item')).forEach((row) => {
                    const name = row.querySelector('.stg-zone-name').value;
                    const select = row.querySelector('.stg-zone-type');
                    const type = /^Green/.test(name) ? 'green'
                        : /^Fairway/.test(name) ? 'fairway'
                            : /^Tee/.test(name) ? 'tee'
                                : /^Rough/.test(name) ? 'rough'
                                    : /^Approach/.test(name) ? 'approach' : 'other';
                    select.value = type;
                    select.dispatchEvent(new Event('change', { bubbles: true }));
                    picked[name] = type;
                });

                return picked;
            });
            await page.fill('#stg-zone-input', ADDED);
            await page.selectOption('#stg-zone-type-input', 'green');
            await page.click('#stg-zone-add-btn');
            await page.click('#stg-zones-save');
            await page.waitForTimeout(3000);

            const shown = await page.evaluate(() => {
                const box = document.getElementById('stg-zones-msg');

                return { message: box ? (box.textContent || '').trim() : null };
            });
            // Reloaded, because "it saved" is a claim about the database and not about the page.
            await openTheZonesTab();
            const rows = await theRowsOnScreen();
            const stored = await api('GET', '/api/sites/' + siteId);
            process.stdout.write('[gh801-live] the one save: ' + JSON.stringify(shown)
                + '\n[gh801-live] the types chosen: ' + JSON.stringify(chosen)
                + '\n[gh801-live] the rows after a reload: ' + JSON.stringify(rows) + '\n');

            expect(shown.message).toBe('Zones saved.');
            // Seventeen zones, every one of them typed, and not a single Required note left.
            expect(rows.length).toBe(SIXTEEN.length + 1);
            expect(rows.filter((r) => !r.type)).toEqual([]);
            expect(rows.filter((r) => r.marked)).toEqual([]);
            expect((stored.body.data.zones || []).filter((z) => !z.zoneType)).toEqual([]);
            // And the change that was refused a moment ago is now in: the tab works again.
            expect(rows.map((r) => r.name)).toContain(ADDED);
        }, 300000);

        test('SIGN 4 — the Data road still makes a zone with no type, and the tab then names it', async () => {
            const saved = await api('POST', '/api/samples', {
                site_id: siteId,
                sample_type: 'soil',
                payload: { _label: 'Green 100', K: 120 },
            });
            await openTheZonesTab();
            const rows = await theRowsOnScreen();
            const untyped = rows.filter((r) => !r.type).map((r) => r.name);

            await page.fill('#stg-zone-input', 'Green 101');
            await page.selectOption('#stg-zone-type-input', 'green');
            await page.click('#stg-zone-add-btn');
            await page.click('#stg-zones-save');
            await page.waitForTimeout(2500);
            const shown = await page.evaluate(() => {
                const box = document.getElementById('stg-zones-msg');

                return { message: box ? (box.textContent || '').trim() : null };
            });
            process.stdout.write('[gh801-live] the sample the Data road saved: ' + saved.status
                + '\n[gh801-live] zones with no type after it: ' + JSON.stringify(untyped)
                + '\n[gh801-live] and the tab: ' + JSON.stringify(shown) + '\n');

            // Her decision: the add interface is not changed, so this is accepted and gets no type.
            expect(saved.status).toBe(201);
            expect(untyped).toEqual(['Green 100']);
            // The tab is closed again over a zone the person never touched, and it is named.
            expect(shown.message).toBe('Not saved: fill in the zone type for Green 100.');
        }, 300000);
    });
}
