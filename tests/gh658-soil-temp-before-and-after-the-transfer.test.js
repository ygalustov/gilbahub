/**
 * GH-658 (queue item 3az, the analyst's section 24.4) — HOW MUCH THE NUMBERS
 * MOVE, PER SITE, IF THE SOIL TEMPERATURE IS COMPUTED IN THE RUN INSTEAD OF IN
 * THE PANEL.
 *
 * WHY IT EXISTS. The owner agreed to the transfer on being told "the numbers
 * will change a little". Nobody has shown her the numbers. This is them, site by
 * site, before the change is written — so she sees the difference from us rather
 * than from a client.
 *
 * THE FORM IS THE ANALYST'S, section 24.4: for each of the twelve sites, in one
 * frame, on ONE set of weather, three calculations —
 *
 *   A  the panel as it is today: profile `turf.construction || 'sand-carpet'`,
 *      moisture = the mean of the hourly `soil_moisture_0_to_7cm` series,
 *      CEC and OM from the site's own soil sample;
 *   B  the canon as it is today: profile `turf.construction || turf.profileType
 *      || 'usga'`, moisture 0.25, no CEC and no OM;
 *   V  after the transfer: profile = the `thermalProfile` the inputs list
 *      resolves the construction to, with NO stand-in; moisture = the mean of the
 *      non-empty values of the SAME series; CEC and OM from the sample. An
 *      absent construction is an outcome, not a substitution.
 *
 * ONE SET OF WEATHER PER SITE. The stored rows do not carry the hourly series —
 * measured: `inputs.weather` holds `source`, `status` and `readyAt` and nothing
 * else — so it is fetched once per site and all three calculations are given
 * that same series. Within a site the comparison is therefore exact; between
 * sites it is not a comparison at all.
 *
 * BOTH OUTCOMES ARE NAMED BEFORE THE RUN, for each of the three things it can
 * show, because whichever way it comes out must not read as the expected one:
 *
 *   1. A against V, the Growth & Light profile. The analyst's reading says these
 *      barely differ on the eleven sites that have a construction, because both
 *      take the moisture from the same series. If they differ anyway, the cause
 *      is in the printed inputs — the moisture means, or the profile — and the
 *      transfer changes what a person reads on Growth & Light after all.
 *   2. B against V, the one canonical number that disease, stress and
 *      pre-emergent read. Her reading says this is where the change is, because
 *      B uses 0.25 and `usga` while V uses the real series and the real profile.
 *      If B and V agree, the price she accepted was smaller than stated.
 *   3. `Westview`. Its construction is empty, so V is "not computed" rather than
 *      a different profile. If V produces a number for it, the removal of the
 *      stand-in is not doing what the owner's 22.09 decision says it should.
 *
 * WHAT THIS MEASUREMENT DOES NOT COVER, said plainly rather than left to be
 * discovered: `diseaseRisk`, `topDisease` and `stressIndex` — the third row of
 * the analyst's print. They need the disease and stress engines driven on a
 * whole run's state, which is a separate frame and not a temperature
 * calculation. This prints the input those three read and the delta in it.
 *
 * IT CHANGES NOTHING AND WRITES NOTHING. It reads the database, fetches weather,
 * and runs the model in this process. It is behind `GILBA_SOILTEMP_MEASURE=1` so
 * that it does not join an ordinary suite run and does not reach the network
 * while somebody else's review is in progress.
 *
 * Run: GILBA_SOILTEMP_MEASURE=1 npx jest tests/gh658-soil-temp-before-and-after-the-transfer.test.js --runInBand
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ENABLED = process.env.GILBA_SOILTEMP_MEASURE === '1';

const ROOT = path.join(__dirname, '..');
const LIST = JSON.parse(fs.readFileSync(path.join(ROOT, 'assets', 'calculation-inputs.schema.json'), 'utf8'));
const CONSTRUCTION = LIST.inputs['turf.construction'].values;

/** The model, out of the module that owns it. */
global.window = global.window || global;
const SOIL_TEMP = require(path.join(ROOT, 'assets', 'gaip-soil-temp-integration.js'));

/** One read of the stand, through the container, read-only. */
function query(sql) {
    const out = execFileSync('docker', ['exec', 'gilba_mysql', 'mysql', '-ugilba', '-pgilba_secret',
        'gilba', '-N', '-e', sql], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
    return out.split('\n').map((l) => l.trim()).filter((l) => l);
}

function sites() {
    const rows = query(
        "SELECT CONCAT(s.name,'|',IFNULL(s.latitude,''),'|',IFNULL(s.longitude,''),'|',"
        + "IFNULL(JSON_UNQUOTE(JSON_EXTRACT(c.config,'$.turf.construction')),''),'|',"
        + "IFNULL(JSON_UNQUOTE(JSON_EXTRACT(c.config,'$.turf.profileType')),'')) "
        + 'FROM site_configs c JOIN sites s ON s.id=c.site_id ORDER BY s.name');
    return rows.map((r) => {
        const [name, lat, lon, construction, profileType] = r.split('|');
        return { name, lat, lon, construction, profileType };
    });
}

/** The CEC and organic matter the panel would take off the page, from the sample. */
function sampleReadings() {
    const rows = query(
        "SELECT CONCAT(si.name,'|',IFNULL(JSON_UNQUOTE(JSON_EXTRACT(s.payload,'$.CEC')),"
        + "IFNULL(JSON_UNQUOTE(JSON_EXTRACT(s.payload,'$.CEC_meq100g')),'')),'|',"
        + "IFNULL(JSON_UNQUOTE(JSON_EXTRACT(s.payload,'$.LOI')),"
        + "IFNULL(JSON_UNQUOTE(JSON_EXTRACT(s.payload,'$.OM')),''))) "
        + "FROM samples s JOIN sites si ON si.id=s.site_id "
        + "WHERE s.sample_type='soil' AND s.deleted_at IS NULL "
        + 'AND s.sample_date = (SELECT MAX(s2.sample_date) FROM samples s2 '
        + "WHERE s2.site_id=s.site_id AND s2.sample_type='soil' AND s2.deleted_at IS NULL) "
        + 'ORDER BY si.name, s.id');
    const out = {};
    rows.forEach((r) => {
        const [name, cec, om] = r.split('|');
        if (!out[name]) out[name] = { cec: cec ? Number(cec) : null, om: om ? Number(om) : null };
    });
    return out;
}

/** The product's own hourly request, same fields. */
async function weatherFor(site) {
    const p = new URLSearchParams({
        latitude: site.lat, longitude: site.lon, timezone: 'auto',
        hourly: ['temperature_2m', 'soil_moisture_0_to_7cm', 'shortwave_radiation'].join(','),
        forecast_days: '7',
    });
    const res = await fetch('https://api.open-meteo.com/v1/forecast?' + p.toString());
    if (!res.ok) throw new Error(site.name + ': weather ' + res.status);
    const body = await res.json();
    return body.hourly || null;
}

const mean = (a) => (a && a.length ? a.reduce((x, y) => x + y, 0) / a.length : null);
const r1 = (v) => (typeof v === 'number' ? Math.round(v * 10) / 10 : v);
const r3 = (v) => (typeof v === 'number' ? Math.round(v * 1000) / 1000 : v);

/** The panel's moisture: the mean of the series, with its own stand-in of 0.25. */
function panelMoisture(hourly) {
    const arr = hourly.soil_moisture_0_to_7cm;
    if (!arr) return { value: 0.25, from: 'stand-in 0.25 (no series)' };
    const denom = arr.filter((x) => x !== null && x !== undefined).length;
    const value = arr.reduce((a, b) => a + (b || 0), 0) / denom;
    return { value, from: 'mean of the series, empty values counted as 0 in the sum' };
}

/** The transfer's moisture: the mean of the NON-EMPTY values of the same series. */
function transferMoisture(hourly) {
    const arr = hourly.soil_moisture_0_to_7cm;
    const real = (arr || []).filter((x) => x !== null && x !== undefined);
    if (!real.length) return { value: null, from: 'not computed — no moisture in the series' };
    return { value: mean(real), from: 'mean of the non-empty values of the same series' };
}

function runModel(hourly, moisture, profileType, cec, om) {
    if (moisture === null || !profileType) return null;
    const raw = SOIL_TEMP.gaip_enhanced_soil_temp
        ? SOIL_TEMP.gaip_enhanced_soil_temp(hourly.temperature_2m, hourly.shortwave_radiation, moisture,
            { profileType, cec, om })
        : SOIL_TEMP.enhancedSoilTemperature(hourly.temperature_2m, hourly.shortwave_radiation, moisture,
            { profileType, cec, om });
    if (!raw) return null;
    const summary = SOIL_TEMP.getSoilTempSummary
        ? SOIL_TEMP.getSoilTempSummary(raw) : null;
    return {
        profileUsed: raw.profileType,
        lambda: raw.thermalProps && raw.thermalProps.lambda,
        d20: mean(raw.T_20mm), d50: mean(raw.T_50mm),
        d100: mean(raw.T_100mm), d200: mean(raw.T_200mm),
        summaryMean: summary && summary.mean,
        summaryCurrent: summary && summary.current,
    };
}

if (!ENABLED) {
    process.stdout.write('[gh658] skipped — needs the stand and the network (GILBA_SOILTEMP_MEASURE=1)\n');
    test.skip('GH-658 soil temperature before and after the transfer (disabled)', () => {});
} else {
    describe('GH-658 — the soil temperature, three ways, per site', () => {
        jest.setTimeout(300000);
        const results = [];

        beforeAll(async () => {
            const all = sites();
            const readings = sampleReadings();
            // POSITIVE CONTROL, printed before anything is claimed: the model is
            // loaded and the stand answered. A run over zero sites, or with a
            // model that did not load, would otherwise print "no differences".
            process.stdout.write('\n[gh658] sites with a config row: ' + all.length
                + ' | model loaded: ' + (typeof (SOIL_TEMP.gaip_enhanced_soil_temp
                    || SOIL_TEMP.enhancedSoilTemperature) === 'function')
                + ' | thermal table keys: ' + Object.keys(SOIL_TEMP.PROFILE_THERMAL_PARAMS || {}).length + '\n');

            for (const site of all) {
                const row = { site: site.name, construction: site.construction || '(empty)' };
                if (!site.lat || !site.lon) { row.skipped = 'no coordinates'; results.push(row); continue; }
                let hourly;
                try { hourly = await weatherFor(site); } catch (e) { row.skipped = e.message; results.push(row); continue; }
                if (!hourly || !hourly.temperature_2m) { row.skipped = 'no hourly series'; results.push(row); continue; }

                const s = readings[site.name] || { cec: null, om: null };
                const pm = panelMoisture(hourly);
                const tm = transferMoisture(hourly);

                // A — the panel today, stand-in and all.
                const profileA = site.construction || 'sand-carpet';
                // B — the canon today: 0.25 and `usga`, no sample readings.
                const profileB = site.construction || site.profileType || 'usga';
                // V — after the transfer: the resolved thermal profile, no stand-in.
                const entry = CONSTRUCTION[site.construction];
                const profileV = entry ? entry.resolves.thermalProfile : null;

                row.inputs = {
                    A: { profile: profileA, moisture: r3(pm.value), moistureFrom: pm.from, cec: s.cec, om: s.om },
                    B: { profile: profileB, moisture: 0.25, moistureFrom: 'stand-in in the canon step', cec: null, om: null },
                    V: { profile: profileV || '(not computed — no construction)',
                        moisture: r3(tm.value), moistureFrom: tm.from, cec: s.cec, om: s.om },
                };
                row.A = runModel(hourly, pm.value, profileA, s.cec, s.om);
                row.B = runModel(hourly, 0.25, profileB, null, null);
                row.V = profileV ? runModel(hourly, tm.value, profileV, s.cec, s.om) : null;
                row.airMean = r1(mean(hourly.temperature_2m));
                // GH-659: the SHAPE of the moisture series, per site, because
                // "no moisture" has three states and only one of them is what
                // `test4 - USA` turned out to be. A site whose series is absent,
                // one whose series is present and entirely empty, and one with
                // gaps are three different prices for the transfer.
                const marr = hourly.soil_moisture_0_to_7cm;
                row.moistureSeries = {
                    seriesPresent: Array.isArray(marr),
                    hours: Array.isArray(marr) ? marr.length : 0,
                    withAValue: Array.isArray(marr)
                        ? marr.filter((x) => x !== null && x !== undefined).length : 0,
                    airHours: (hourly.temperature_2m || []).length,
                };
                results.push(row);
            }
        });

        test('THE PRINT the owner asked for: per site, A against V and B against V', () => {
            const lines = [];
            results.forEach((row) => {
                if (row.skipped) { lines.push(row.site + ': NOT MEASURED — ' + row.skipped); return; }
                const d = (x, k) => (x ? r1(x[k]) : 'not computed');
                lines.push(row.site + '  [construction ' + row.construction + ', air mean ' + row.airMean + '°C]');
                lines.push('   profile 20/50/100/200mm   A: ' + [d(row.A, 'd20'), d(row.A, 'd50'), d(row.A, 'd100'), d(row.A, 'd200')].join(' / ')
                    + '   V: ' + [d(row.V, 'd20'), d(row.V, 'd50'), d(row.V, 'd100'), d(row.V, 'd200')].join(' / '));
                lines.push('   the one canon number       B: ' + d(row.B, 'summaryMean')
                    + '   V: ' + d(row.V, 'summaryMean')
                    + (row.B && row.V ? '   difference: ' + r1(row.V.summaryMean - row.B.summaryMean) + '°C' : ''));
                lines.push('   inputs  A: ' + JSON.stringify(row.inputs.A));
                lines.push('   inputs  B: ' + JSON.stringify(row.inputs.B));
                lines.push('   inputs  V: ' + JSON.stringify(row.inputs.V));
                lines.push('   profile actually used      A: ' + (row.A ? row.A.profileUsed : '-')
                    + '   B: ' + (row.B ? row.B.profileUsed : '-')
                    + '   V: ' + (row.V ? row.V.profileUsed : '-'));
            });
            process.stdout.write('[gh658] ' + lines.join('\n[gh658] ') + '\n');

            // The measurement happened at all, on more than a couple of sites.
            const measured = results.filter((r) => !r.skipped);
            expect(measured.length).toBeGreaterThan(8);
            // And the model produced numbers for the sites that have a construction.
            const withConstruction = measured.filter((r) => r.construction !== '(empty)');
            withConstruction.forEach((r) => {
                expect([r.site, typeof (r.A && r.A.d50)]).toEqual([r.site, 'number']);
                expect([r.site, typeof (r.B && r.B.summaryMean)]).toEqual([r.site, 'number']);
            });
        });

        test('OUTCOME 3 — an absent construction yields no number, and whether any live site is in that state', () => {
            // THE UNIVERSE MOVED UNDER THIS CASE AND THE CASE SAID SO. It asserted
            // that a site with no construction exists, and on the first run
            // `Westview` was one: A computed 18.5 °C through the stand-in
            // `sand-carpet`, B computed 18.5 °C through `usga`, V computed nothing.
            // The owner then filled the field — `turf.construction = "soil"`,
            // 24.09.2026 — and the case went red on its own positive control,
            // which is what that control is for. It is not weakened: the PROPERTY
            // is asserted on an absent construction directly, and whether a live
            // site is in that state is printed rather than assumed.
            const empty = results.filter((r) => !r.skipped && r.construction === '(empty)');
            process.stdout.write('[gh658] live sites with no construction: '
                + JSON.stringify(empty.map((r) => r.site)) + '\n');

            // The property, on the list rather than on a site: an absent
            // construction resolves to no thermal profile, so the transfer has
            // nothing to compute with and says so.
            expect(CONSTRUCTION['']).toBeUndefined();
            expect(CONSTRUCTION[undefined]).toBeUndefined();

            empty.forEach((r) => {
                process.stdout.write('[gh658] ' + r.site + ' today: A=' + (r.A ? r1(r.A.summaryMean) : 'none')
                    + ' B=' + (r.B ? r1(r.B.summaryMean) : 'none') + ' | after the transfer: '
                    + (r.V ? r1(r.V.summaryMean) : 'not computed') + '\n');
                expect(r.V).toBeNull();
            });
        });

        test('GH-659 — is `test4 - USA` the only site whose weather carries no soil moisture', () => {
            // THE QUESTION, ASKED BECAUSE THE PRICE DEPENDS ON THE COUNT. One site
            // losing its soil temperature is a line in the owner's decision; three
            // is a different decision. Both outcomes are named before the print:
            // if it is alone, the price stands as reported; if it is not, every
            // other site is named here and the price changes.
            const lines = [];
            const barren = [];
            results.filter((r) => !r.skipped).forEach((r) => {
                const m = r.moistureSeries;
                const state = !m.seriesPresent ? 'NO SERIES AT ALL'
                    : m.withAValue === 0 ? 'SERIES PRESENT, EVERY VALUE EMPTY'
                        : m.withAValue < m.hours ? 'PARTLY EMPTY (' + m.withAValue + ' of ' + m.hours + ')'
                            : 'full (' + m.withAValue + ' of ' + m.hours + ')';
                lines.push(r.site + ': ' + state + ' | air hours: ' + m.airHours);
                if (!m.seriesPresent || m.withAValue === 0) barren.push(r.site);
            });
            process.stdout.write('[gh659] ' + lines.join('\n[gh659] ') + '\n');
            process.stdout.write('[gh659] sites that would lose the soil temperature after the transfer: '
                + JSON.stringify(barren) + '\n');

            // POSITIVE CONTROL: the series was actually looked at. Every site must
            // have an air series, or "no moisture" would be a fetch that failed
            // rather than a source that has none.
            results.filter((r) => !r.skipped).forEach((r) => {
                expect([r.site, r.moistureSeries.airHours > 0]).toEqual([r.site, true]);
            });
            // And at least one site HAS moisture, or the whole fetch is suspect.
            expect(results.filter((r) => !r.skipped && r.moistureSeries.withAValue > 0).length)
                .toBeGreaterThan(0);
        });

        test('GH-659 — and it is not the site’s coordinates: the source has no soil moisture over the United States', () => {
            // WHY THIS IS ASKED SEPARATELY. "One site loses the number" invites the
            // remedy "fix that site's coordinates". Measured, that remedy would do
            // nothing: the field is missing for the whole of the United States, so
            // the price is regional and not per-site. Four probes, one of them a
            // CONTROL that must come back full — without it, "nothing anywhere"
            // and "the fetch is broken" are the same output.
            const probes = [
                ['the site as stored (San Francisco Bay)', 37.6191145, -122.3816274, false],
                ['inland of it, elevation 143 m', 37.57, -122.40, false],
                ['mid-continent United States', 38.5, -98.0, false],
                ['London — THE CONTROL, must be full', 51.5, -0.12, true],
            ];
            const seen = [];
            return (async () => {
                for (const [label, lat, lon, mustHave] of probes) {
                    const q = new URLSearchParams({ latitude: lat, longitude: lon, timezone: 'auto',
                        hourly: 'temperature_2m,soil_moisture_0_to_7cm', forecast_days: '2' });
                    const res = await fetch('https://api.open-meteo.com/v1/forecast?' + q.toString());
                    const body = await res.json();
                    const arr = (body.hourly || {}).soil_moisture_0_to_7cm;
                    const real = (arr || []).filter((x) => x !== null && x !== undefined);
                    seen.push({ label, values: real.length, of: (arr || []).length,
                        elevation: body.elevation, mustHave });
                    process.stdout.write('[gh659] ' + label + ': moisture ' + real.length
                        + ' of ' + (arr || []).length + ' | elevation ' + body.elevation + '\n');
                }
                // The control answered, so an empty American series is the source
                // and not the request.
                const control = seen.find((x) => x.mustHave);
                expect(control.values).toBeGreaterThan(0);
                // And moving the site inland changes nothing.
                seen.filter((x) => !x.mustHave).forEach((x) => {
                    expect([x.label, x.values]).toEqual([x.label, 0]);
                });
            })();
        });

        test('OUTCOME 3b — the profile a refinable construction reaches, and what refines it', () => {
            // NAMED BECAUSE THE COORDINATOR ASKED FOR THE THIRD OUTCOME RATHER THAN
            // A FIT TO THE FORM. `soil` reaches `soil-field`, which carries
            // `cecRefinable: true`, and the analyst's caveat — "no site has that
            // flag, so the missing CEC changes nothing" — stopped being true when
            // the field was filled. Measured here: whether it changes anything YET.
            const refinable = Object.entries(SOIL_TEMP.PROFILE_THERMAL_PARAMS || {})
                .filter(([, p]) => p && p.cecRefinable).map(([k]) => k);
            const reaching = Object.entries(CONSTRUCTION)
                .filter(([, v]) => refinable.includes(v.resolves.thermalProfile))
                .map(([k]) => k);
            process.stdout.write('[gh658] thermal profiles refinable by CEC: ' + JSON.stringify(refinable)
                + '\n[gh658] constructions that reach one: ' + JSON.stringify(reaching) + '\n');

            // Positive control: the flag exists on something, or the claim is vacuous.
            expect(refinable.length).toBeGreaterThan(0);
            expect(reaching.length).toBeGreaterThan(0);

            // And the sites now standing on such a construction, with the CEC each
            // one actually has — which is what decides whether the flag bites.
            const standing = results.filter((r) => !r.skipped && reaching.includes(r.construction));
            standing.forEach((r) => {
                process.stdout.write('[gh658] ' + r.site + ' stands on ' + r.construction
                    + ' -> ' + (r.inputs.V.profile) + ', CEC it carries: '
                    + JSON.stringify(r.inputs.A.cec)
                    + ' | A=' + (r.A ? r1(r.A.summaryMean) : 'none')
                    + ' V=' + (r.V ? r1(r.V.summaryMean) : 'none') + '\n');
            });
        });
    });
}
