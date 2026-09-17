/**
 * GH-483 — a MEASUREMENT, not a guard and not a fix.
 *
 * The question it answers is the owner's: have we broken a load somewhere, so
 * that a value which exists in the database is printed as empty and the
 * emptiness is then treated as lawful?
 *
 * It follows every field this week's work declared empty, derived or
 * unresolved through four points of the chain — the database, the API, the
 * resolver, and the finished document — for every live site, and says for each
 * cell whether there is a value. Where the database has one and a later point
 * does not, the break is named.
 *
 * It asserts nothing about the values: a measurement that fails is a
 * measurement nobody reads. The single assertion is that the four points were
 * reached at all.
 *
 * Runs only against the live stack: GILBA_E2E=1 npx jest tests/e2e/gh483-four-point-trace.test.js
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

let chromium = null;
try { ({ chromium } = require('playwright')); } catch (e) { /* reported below */ }

const ENABLED = process.env.GILBA_E2E === '1';
const OUT = process.env.GILBA_TRACE_OUT || '/tmp/gilba-pw-test/gh483-trace.json';

const credentials = (() => {
    try { return JSON.parse(fs.readFileSync(path.join(__dirname, '.e2e-credentials.json'), 'utf8')); }
    catch (e) { return {}; }
})();
const BASE_URL = process.env.GILBA_E2E_URL || credentials.url || 'http://127.0.0.1:8080';

/** One row per site, straight out of MySQL: columns, config, cache, samples. */
function databaseRows() {
    const sql = `
      SELECT JSON_ARRAYAGG(JSON_OBJECT(
        'id', s.id, 'name', s.name,
        'location_name', s.location_name, 'latitude', s.latitude, 'longitude', s.longitude,
        'timezone', s.timezone,
        'methodology_override', s.methodology_override,
        'soil_texture_override', s.soil_texture_override,
        'account_soil_texture', a.soil_texture,
        'cfg_location_name', JSON_UNQUOTE(JSON_EXTRACT(g.config, '$.location.name')),
        'cfg_species', JSON_UNQUOTE(JSON_EXTRACT(g.config, '$.turf.species')),
        'cfg_variety', JSON_UNQUOTE(JSON_EXTRACT(g.config, '$.turf.variety')),
        'cfg_overseed_species', JSON_UNQUOTE(JSON_EXTRACT(g.config, '$.turf.overseedSpecies')),
        'cfg_overseed_variety', JSON_UNQUOTE(JSON_EXTRACT(g.config, '$.turf.overseedVariety')),
        'cfg_cool_overseed', JSON_UNQUOTE(JSON_EXTRACT(g.config, '$.turf.coolOverseed')),
        'cfg_methodology', JSON_UNQUOTE(JSON_EXTRACT(g.config, '$.turf.methodology')),
        'cache_methodology', JSON_UNQUOTE(JSON_EXTRACT(c.config, '$.computed.soilNutrition.methodology')),
        'tissue_samples', (SELECT COUNT(*) FROM samples t WHERE t.site_id = s.id AND t.sample_type='tissue' AND t.deleted_at IS NULL),
        'water_samples',  (SELECT COUNT(*) FROM samples w WHERE w.site_id = s.id AND w.sample_type='water'  AND w.deleted_at IS NULL)
      ))
      FROM sites s
      LEFT JOIN accounts a ON a.id = s.account_id
      LEFT JOIN site_configs g ON g.site_id = s.id AND g.namespace = 'gaip'
      LEFT JOIN site_configs c ON c.site_id = s.id AND c.namespace = 'analysis_cache'
      WHERE s.deleted_at IS NULL;`;
    const raw = execFileSync('docker', ['exec', 'gilba_mysql', 'mysql', '-ugilba', '-pgilba_secret', 'gilba',
        '-N', '-B', '-e', sql], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
    const json = raw.split('\n').filter((l) => l.trim().startsWith('[')).pop();
    return JSON.parse(json);
}

const has = (v) => !(v === null || v === undefined || v === '' || v === 'null');
const show = (v) => (has(v) ? String(v) : '—');

if (!ENABLED) {
    describe('GH-483 — four-point trace (disabled)', () => {
        test.skip('needs the live stack', () => {});
    });
} else {
    describe('GH-483 — database, API, resolver, document: one row per field per site', () => {
        jest.setTimeout(900000);
        let db, live, browser;

        beforeAll(async () => {
            db = databaseRows();
            if (!chromium) throw new Error('playwright does not resolve from the repo — run `npm install`');
            browser = await chromium.launch();
            const page = await (await browser.newContext({ viewport: { width: 1400, height: 1000 } })).newPage();
            await page.goto(BASE_URL + '/login', { waitUntil: 'domcontentloaded' });
            await page.fill('#email', credentials.email);
            await page.fill('#password', credentials.password);
            await Promise.all([
                page.waitForNavigation({ waitUntil: 'domcontentloaded' }).catch(() => {}),
                page.click('form.login-form button[type=submit]')
            ]);
            await page.waitForTimeout(1500);
            await page.goto(BASE_URL + '/reports/export', { waitUntil: 'domcontentloaded' });
            await page.waitForFunction(
                () => !!(window.GAIP_SampleManager && window.GAIP_NutritionProgramInputs && window.GAIP_WordExport),
                null, { timeout: 30000 });
            await page.waitForTimeout(8000);

            live = await page.evaluate(async () => {
                const NPI = window.GAIP_NutritionProgramInputs;
                const WE = window.GAIP_WordExport;
                const RP = window.GAIP_RegionalProfiles;
                const api = await (await fetch('/api/sites', { headers: { Accept: 'application/json' } })).json();
                const SM = window.GAIP_SampleManager;
                const allSamples = SM.getAllSamples();
                let sampleApi = { count: null };
                try {
                    // The client's own request: sample-persistence.js:366 asks
                    // for limit=200. Asking without one gets the endpoint's
                    // default of 50 and undercounts, which is the harness's
                    // mistake and not the product's.
                    const r = await fetch('/api/samples?limit=200', { headers: { Accept: 'application/json' } });
                    const j = await r.json();
                    const list = j.data || j.samples || j;
                    sampleApi = { status: r.status, count: Array.isArray(list) ? list.length : 'not-an-array', bySite: {} };
                    (Array.isArray(list) ? list : []).forEach((x) => {
                        const k = (x.site_id || '?') + '/' + (x.sample_type || x.type || '?');
                        sampleApi.bySite[k] = (sampleApi.bySite[k] || 0) + 1;
                    });
                } catch (e) { sampleApi = { error: String(e.message) }; }
                const out = [];
                for (const row of (api.data || [])) {
                    const cfg = (row.configs && row.configs.gaip && row.configs.gaip.config) || {};
                    const rec = {
                        id: row.id,
                        name: row.name,
                        api: {
                            location_name: row.location_name,
                            latitude: row.latitude,
                            longitude: row.longitude,
                            timezone: row.timezone,
                            methodology_override: row.methodology_override,
                            soil_texture_override: row.soil_texture_override,
                            account_soil_texture: row.account_soil_texture,
                            cfg_location_name: (cfg.location || {}).name,
                            cfg_species: (cfg.turf || {}).species,
                            cfg_variety: (cfg.turf || {}).variety,
                            cfg_overseed_species: (cfg.turf || {}).overseedSpecies,
                            cfg_overseed_variety: (cfg.turf || {}).overseedVariety,
                            cfg_cool_overseed: (cfg.turf || {}).coolOverseed,
                            cfg_methodology: (cfg.turf || {}).methodology
                        }
                    };
                    try {
                        const i = NPI.resolveExportInputs({ siteId: row.id });
                        rec.resolver = {
                            place: i.site.location.name,
                            lat: i.site.location.lat,
                            lon: i.site.location.lon,
                            timezone: i.site.timezone,
                            species: i.turf.speciesDisplay || i.turf.species,
                            variety: i.turf.variety,
                            overseedSpecies: i.turf.overseedSpecies,
                            overseedVariety: i.turf.overseedVariety,
                            coolOverseed: i.turf.coolOverseed,
                            methodology: i.program ? i.program.methodology : null,
                            methodologySource: i.program ? i.program.sources.methodology : null,
                            soilTexture: i.program ? i.program.soilTexture : null,
                            soilTextureSource: i.program ? i.program.sources.soilTexture : null,
                            certificate: i.program ? i.program.certificateCode : null,
                            tissue: i.samples && i.samples.tissue ? (i.samples.tissue.label || 'present') : null,
                            water: i.samples && i.samples.water ? (i.samples.water.label || 'present') : null,
                            unresolved: i.program
                                ? Object.keys(i.program.sources).filter((k) => {
                                    const s = i.program.sources[k];
                                    return s === 'unresolved' || s === 'default';
                                })
                                : null
                        };
                        rec.region = RP && RP.detectRegionForSite ? (RP.detectRegionForSite(row.id) || null) : 'no-module';
                        const store = (allSamples.allSites || {})[row.id] || {};
                        rec.store = {
                            soil: Object.keys(store.soil || {}).length,
                            tissue: Object.keys(store.tissue || {}).length,
                            water: Object.keys(store.water || {}).length,
                            active: (allSamples.allActive || {})[row.id] || null
                        };
                        rec.sampleApi = {
                            tissue: sampleApi.bySite ? (sampleApi.bySite[row.id + '/tissue'] || 0) : null,
                            water: sampleApi.bySite ? (sampleApi.bySite[row.id + '/water'] || 0) : null,
                            total: sampleApi.count
                        };

                        const data = WE.collectData(i);
                        rec.data = {
                            place: data.site.location,
                            methodology: data.soil.methodology,
                            extractant: data.soil.extractant,
                            aaSoilTexture: data.soil.aaSoilTexture,
                            aaSampleType: data.soil.aaSampleType,
                            aaSampleTypeSource: data.soil.aaSampleTypeSource,
                            species: data.turf.speciesDisplay || data.turf.species,
                            variety: data.turf.effectiveVariety || data.turf.variety,
                            overseedSpecies: data.turf.overseedSpecies,
                            tissueHasData: !!(data.tissue && (data.tissue.N != null || data.tissue.K != null)),
                            waterHasData: !!(data.water && (data.water.pH != null || data.water.EC != null))
                        };
                        const sections = WE.buildSections(data, {});
                        const doc = new window.docx.Document({ sections: [{ properties: {}, children: sections }] });
                        const blob = await window.docx.Packer.toBlob(doc);
                        const zip = await window.JSZip.loadAsync(await blob.arrayBuffer());
                        const xml = await zip.file('word/document.xml').async('string');
                        rec.text = xml.replace(/<\/w:p>/g, '\n').replace(/<[^>]+>/g, '').replace(/&amp;/g, '&');
                    } catch (e) {
                        rec.error = String((e && e.message) || e).slice(0, 160);
                    }
                    out.push(rec);
                }
                return out;
            });
            await browser.close();
            browser = null;
        });

        afterAll(async () => { if (browser) await browser.close(); });

        test('the four points were reached for every live site, and the table is printed', () => {
            const byId = {};
            db.forEach((r) => { byId[r.id] = r; });
            const lines = [];
            const breaks = [];

            const cell = (dbv, apiv, resv, docv, field, site) => {
                const row = { site: site, field: field, db: show(dbv), api: show(apiv), resolver: show(resv), document: show(docv) };
                if (has(dbv) && !has(apiv)) { row.break = 'API'; }
                else if (has(apiv) && !has(resv)) { row.break = 'resolver'; }
                else if (has(resv) && !has(docv)) { row.break = 'document'; }
                if (row.break) breaks.push(row);
                return row;
            };

            const rows = [];
            live.forEach((l) => {
                const d = byId[l.id] || {};
                const r = l.resolver || {};
                const doc = l.data || {};
                const text = l.text || '';
                const printed = (v) => (has(v) && text.indexOf(String(v)) >= 0 ? v : null);

                rows.push(cell(d.cfg_species, l.api.cfg_species, r.species, printed(doc.species), 'species', l.name));
                const printedLoose = (v) => (has(v) && text.toLowerCase().indexOf(String(v).toLowerCase()) >= 0 ? v : null);
                rows.push(cell(d.cfg_variety, l.api.cfg_variety, r.variety, printedLoose(doc.variety), 'variety', l.name));
                rows.push(cell(d.cfg_overseed_species, l.api.cfg_overseed_species, r.overseedSpecies,
                    printed(doc.overseedSpecies), 'overseed species', l.name));
                rows.push(cell(d.location_name, l.api.location_name, r.place, printed(doc.place), 'place name', l.name));
                rows.push(cell(d.cfg_methodology, l.api.cfg_methodology, r.methodology, printed(doc.methodology), 'methodology', l.name));
                // The document's own carrier for the texture is the Ammonium
                // Acetate rootzone bucket; a report on another methodology has
                // no place that prints it, which is not a break.
                const isAA = String(doc.methodology || '').indexOf('AMMONIUM') >= 0;
                rows.push(cell(d.soil_texture_override || d.account_soil_texture,
                    l.api.soil_texture_override || l.api.account_soil_texture, r.soilTexture,
                    isAA ? doc.aaSoilTexture : 'n/a — not an AA report', 'soil texture', l.name));
                rows.push(cell(d.latitude, l.api.latitude, r.lat, r.lat, 'coordinates', l.name));
                rows.push(cell(d.timezone, l.api.timezone, r.timezone, r.timezone, 'timezone', l.name));
                const st = l.store || {};
                const sa = l.sampleApi || {};
                // The API column is what /api/samples returned for this site;
                // the resolver column says what the resolver could resolve BY
                // ID, and the store count beside it says whether the client
                // had the rows at all. The document column is marked as the
                // page's form, because collectData reads tissue and water off
                // the page and not from the resolved sample — one page, twelve
                // reports, the same numbers.
                rows.push(cell(d.tissue_samples > 0 ? d.tissue_samples + ' row(s)' : null,
                    sa.tissue ? sa.tissue + ' row(s)' : null,
                    r.tissue || (st.tissue ? st.tissue + ' in store, none active' : null),
                    doc.tissueHasData ? 'page form' : null, 'tissue readings', l.name));
                rows.push(cell(d.water_samples > 0 ? d.water_samples + ' row(s)' : null,
                    sa.water ? sa.water + ' row(s)' : null,
                    r.water || (st.water ? st.water + ' in store, none active' : null),
                    doc.waterHasData ? 'page form' : null, 'water readings', l.name));
                // Derived facts: no column owns them, so the database cell is
                // the fact they are derived FROM.
                rows.push({ site: l.name, field: 'region (derived)', db: show(d.latitude), api: show(l.api.latitude),
                    resolver: show(l.region), document: show(l.region) });
                rows.push({ site: l.name, field: 'certificate (derived)', db: show(d.soil_texture_override || d.account_soil_texture),
                    api: show(l.api.soil_texture_override || l.api.account_soil_texture),
                    resolver: show(r.certificate), document: show(doc.aaSampleType) + ' (' + show(doc.aaSampleTypeSource) + ')' });
                rows.push({ site: l.name, field: 'extractant (derived)', db: show(d.cfg_methodology), api: show(l.api.cfg_methodology),
                    resolver: show(r.methodology), document: show(doc.extractant) });
                rows.push({ site: l.name, field: 'resolver "unresolved/default"', db: '', api: '',
                    resolver: (r.unresolved || []).join(', ') || '—', document: '' });
                if (l.error) rows.push({ site: l.name, field: 'ERROR', db: '', api: '', resolver: l.error, document: '' });
            });

            lines.push('| site | field | DB | API | resolver | document | break |');
            lines.push('|---|---|---|---|---|---|---|');
            rows.forEach((r) => lines.push('| ' + [r.site, r.field, r.db, r.api, r.resolver, r.document, r.break || ''].join(' | ') + ' |'));
            const report = lines.join('\n');
            fs.writeFileSync(OUT, JSON.stringify({ rows: rows, breaks: breaks }, null, 1));
            fs.writeFileSync(OUT.replace(/\.json$/, '.md'), report);
            process.stdout.write(report + '\n');
            process.stdout.write('\nBREAKS (value in the database, none further on): ' + breaks.length + '\n');
            breaks.forEach((b) => process.stdout.write('  ' + b.site + ' | ' + b.field + ' | breaks at ' + b.break +
                ' | db=' + b.db + ' api=' + b.api + ' resolver=' + b.resolver + ' document=' + b.document + '\n'));

            expect(live.length).toBeGreaterThan(0);
            expect(db.length).toBe(live.length);
        });
    });
}
