/**
 * GH-521 live check — the methodology reaches the Word document, on a site
 * whose stored value is 'mlsn'.
 *
 * WHY A DOCUMENT AND NOT THE RESOLVER. `resolveExportInputs()` was already
 * measured on all five stored-mlsn sites and answers 'mlsn' sourced
 * 'site-config'. That is the value the export is BUILT from, not the value it
 * PRINTS, and this whole delivery exists because a page and a document kept
 * answering differently about the same site. Delivery A put one methodology
 * through the document end to end and it was SLAN (Federal Golf). The 'mlsn'
 * case has never travelled that path.
 *
 * WHAT THIS CAN PROVE, AND WHAT IT CANNOT — stated before the run, not after:
 *   CAN: that 'mlsn' reaches the document, and that the figures under it are
 *        built on the MLSN basis rather than an ammonium-acetate range.
 *   CANNOT: tell which SOURCE won. Burns's config and every one of its soil
 *        samples' stamps read 'mlsn', so the chain this delivery removed
 *        (`sample.methodology || turf.methodology ||
 *        GAIP_HUB_CONFIG.turfMethodology || 'mlsn'`) would have reached the
 *        same answer by any link. No site on this stand has a config and a
 *        stamp that disagree AND a sample to export.
 *   CANNOT: show the 21/30 P threshold. It lives in the Prebble context, and
 *        Prebble runs only for New Zealand sites. Burns is Australian.
 *
 * The document is built by the product's own action — the "export current
 * site" entry point a user clicks — and read back out of the .docx as text,
 * not out of the objects that fed it.
 *
 * Writes: none of its own. The active-site pointer is moved and put back; the
 * GH-519 stand guard holds anything the export page tries to save.
 *
 * Run: GILBA_E2E=1 npx jest tests/e2e/gh521-burns-document-live.test.js
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ENABLED = process.env.GILBA_E2E === '1';

let credentials = {};
try {
    credentials = JSON.parse(fs.readFileSync(
        process.env.GILBA_E2E_CREDENTIALS || path.join(__dirname, '.e2e-credentials.json'), 'utf8'));
} catch (e) { credentials = {}; }

const BASE_URL = process.env.GILBA_E2E_URL || credentials.url || 'http://127.0.0.1:8080';
const EMAIL = process.env.GILBA_E2E_EMAIL || credentials.email;
const PASSWORD = process.env.GILBA_E2E_PASSWORD || credentials.password;

// Named before the run. Stored value measured in the database.
const SITE = { name: 'Burns', id: '019e96d8-97b7-714c-9bd6-d65b16ec7f2e', stored: 'mlsn' };
const OUT_DIR = process.env.GILBA_E2E_OUT
    || '/private/tmp/claude-501/-Users-katep-Documents-Work-gilba/851f6013-c2b2-43ea-9e74-92be35e8fc2a/scratchpad';

let chromium = null;
try { ({ chromium } = require('playwright')); } catch (e) { /* reported below */ }
let guardStand = null;
try { ({ guardStand } = require('./lib/stand-guard')); } catch (e) { /* reported below */ }

/** The .docx is a zip; its text lives in word/document.xml. */
function docxText(file) {
    const xml = execFileSync('unzip', ['-p', file, 'word/document.xml'], {
        maxBuffer: 256 * 1024 * 1024, encoding: 'utf8'
    });
    return xml
        .replace(/<w:p[ >]/g, '\n<w:p ')
        .replace(/<[^>]+>/g, '')
        .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
        .replace(/&#8217;|&#x2019;/g, '’');
}

if (!ENABLED) {
    process.stdout.write('[e2e] gh521-burns-document-live skipped (needs the live stack)\n');
    test.skip('GH-521 Burns document (disabled)', () => {});
} else {
    describe('GH-521 — the stored mlsn reaches the Word document (Burns)', () => {
        let browser, page, guard, previousActiveSiteId = null;
        let docPath = null, text = '', enumerated = null, buildError = null;

        beforeAll(async () => {
            if (!chromium) throw new Error('playwright does not resolve from the repo — run `npm install`');
            if (!guardStand) throw new Error('tests/e2e/lib/stand-guard.js does not resolve');
            if (!EMAIL || !PASSWORD) throw new Error('no credentials');
            browser = await chromium.launch();
            const context = await browser.newContext({ acceptDownloads: true });
            guard = await guardStand(context);
            page = await context.newPage();
            await page.goto(BASE_URL + '/login', { waitUntil: 'domcontentloaded' });
            await page.fill('#email', EMAIL);
            await page.fill('#password', PASSWORD);
            await Promise.all([
                page.waitForNavigation({ waitUntil: 'domcontentloaded' }).catch(() => {}),
                page.click('form.login-form button[type=submit]')
            ]);
            await page.waitForTimeout(1500);
            if (/\/login/.test(page.url())) throw new Error('login refused for ' + EMAIL);

            const sites = await page.evaluate(async () => {
                const r = await fetch('/api/sites', { headers: { Accept: 'application/json' }, credentials: 'same-origin' });
                return r.json();
            });
            previousActiveSiteId = sites.active_site_id;

            await page.evaluate(async ({ id }) => {
                const t = document.querySelector('meta[name=csrf-token]');
                await fetch('/api/active-site', {
                    method: 'PATCH',
                    headers: Object.assign({ 'Content-Type': 'application/json', Accept: 'application/json' },
                        t ? { 'X-CSRF-TOKEN': t.getAttribute('content') } : {}),
                    body: JSON.stringify({ site_id: id }),
                    credentials: 'same-origin',
                });
            }, { id: SITE.id });

            await page.goto(BASE_URL + '/reports/export', { waitUntil: 'domcontentloaded' });
            await page.waitForTimeout(9000);

            // Recorded before the build: which samples the export sees, so the
            // document's contents can be read against a named list rather than
            // against whatever it happened to contain.
            enumerated = await page.evaluate(() => {
                const CE = window.GAIP_CombinedExport;
                if (!CE || typeof CE.enumerate !== 'function') return { error: 'GAIP_CombinedExport.enumerate absent' };
                try {
                    const list = CE.enumerate('current') || [];
                    return {
                        count: list.length,
                        samples: list.slice(0, 40).map((s) => ({
                            id: s.sampleId || s.id || null,
                            label: s.label || s.zoneKey || null,
                            date: s.date || null,
                        })),
                    };
                } catch (e) { return { error: String(e && e.message).slice(0, 200) }; }
            });
            process.stdout.write('[gh521-doc] enumerate(current): ' + JSON.stringify(enumerated) + '\n');

            const downloadPromise = page.waitForEvent('download', { timeout: 600000 }).catch(() => null);
            const kicked = await page.evaluate(() => {
                const CE = window.GAIP_CombinedExport;
                if (!CE || typeof CE.exportCurrentSite !== 'function') return 'exportCurrentSite absent';
                try { CE.exportCurrentSite(); return 'called'; }
                catch (e) { return 'threw: ' + String(e && e.message).slice(0, 200); }
            });
            process.stdout.write('[gh521-doc] exportCurrentSite(): ' + kicked + '\n');
            const download = await downloadPromise;
            if (!download) { buildError = 'no download event within the timeout'; return; }
            docPath = path.join(OUT_DIR, 'gh521-burns.docx');
            await download.saveAs(docPath);
            text = docxText(docPath);
            process.stdout.write('[gh521-doc] saved ' + docPath + ' — '
                + fs.statSync(docPath).size + ' bytes, ' + text.length + ' chars of text\n');
        }, 900000);

        afterAll(async () => {
            if (page && previousActiveSiteId) {
                await page.evaluate(async ({ id }) => {
                    const t = document.querySelector('meta[name=csrf-token]');
                    await fetch('/api/active-site', {
                        method: 'PATCH',
                        headers: Object.assign({ 'Content-Type': 'application/json', Accept: 'application/json' },
                            t ? { 'X-CSRF-TOKEN': t.getAttribute('content') } : {}),
                        body: JSON.stringify({ site_id: id }),
                        credentials: 'same-origin',
                    });
                }, { id: previousActiveSiteId }).catch(() => {});
            }
            if (guard) process.stdout.write('[gh521-doc] ' + guard.report() + '\n');
            if (browser) await browser.close();
        }, 180000);

        test('the document was built at all', () => {
            expect.hasAssertions();
            expect(buildError).toBeNull();
            expect(docPath).toBeTruthy();
            expect(fs.statSync(docPath).size).toBeGreaterThan(10000);
            expect(text.length).toBeGreaterThan(500);
        });

        test('it is Burns\'s document', () => {
            expect.hasAssertions();
            expect(text).toMatch(/Burns/);
        });

        test('the Annual Nutrient Requirements subtitle names MLSN', () => {
            expect.hasAssertions();
            const line = text.split('\n').filter((l) => /methodology \(Woods et al\. 2016\)|sufficiency methodology|Requirements based on/.test(l));
            process.stdout.write('[gh521-doc] methodology subtitle line(s):\n  '
                + line.map((l) => l.trim().slice(0, 240)).join('\n  ') + '\n');
            expect(text).toMatch(/MLSN methodology \(Woods et al\. 2016\)/);
        });

        test('nothing in it claims another methodology, and nothing says "not set"', () => {
            expect.hasAssertions();
            expect(text).not.toMatch(/Methodology: not set/);
            expect(text).not.toMatch(/SLAN sufficiency methodology/);
            expect(text).not.toMatch(/Requirements based on AA methodology/);
        });
    });
}
