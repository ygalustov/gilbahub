/**
 * ============================================================================
 * TEMPORARY — GH-425. "How this was calculated", under the Plan page's
 * Nutrient Delivery Summary. DELETE WHEN THE FIGURES ARE SIGNED OFF.
 * ============================================================================
 *
 * HOW TO REMOVE IT, completely, in two steps:
 *
 *   1. delete this file (assets/plan-calc-trace.js)
 *   2. delete the single <script> tag in app/resources/views/plan.blade.php
 *      marked "GH-425 TEMPORARY"
 *
 * Nothing else in the codebase references this module, and it writes nothing:
 * no state, no persistence, no events, no changes to any figure on the page.
 * It is one enclosing component with one entry point, deliberately.
 *
 * The additive fields it reads DO NOT need removing with it, and should not be:
 * `program.requirement_detail` (nutrition-calendar.js), the `branch`/`unit`/
 * `balanceKgHa` terms on `GAIP_NutrientBalanceStatus.classify()`, the core's
 * `ppmToKgHaFactor` / `yearsToCorrect` / `liftPpmGap` / `headroomKgHa`, and the
 * delivery ledger's `analysisPct` are each an engine describing its own result.
 * They exist so that this panel does not have to own a second copy of the
 * arithmetic — which is the one way a block like this can do harm.
 *
 * WHY IT EXISTS. The client sets the agronomic rules this product implements
 * and cannot judge a figure whose derivation he cannot see. This shows the
 * derivation for N, P and K during the verification period, so that a wrong
 * answer can be pointed at by line — "that input is wrong", "that is not the
 * rule" — rather than reported as "the phosphorus looks odd".
 *
 * THE ONE RULE THIS FILE OBEYS. It reads what the engines produced. It
 * recomputes nothing. Every number printed below is a field on
 * `NutritionCalendar.computeProgram()`'s output, on the shared delivery
 * accumulator's ledger (assets/nutrition-delivery-core.js), or on the shared
 * Balance/Status classifier's own return (assets/nutrient-balance-status.js) —
 * the same three objects the summary table above it renders from. The two
 * shared modules are CALLED here, over the very programme object the panel was
 * drawn from, rather than reimplemented; both are pure functions of that
 * object, so they cannot answer differently. And the block checks itself: every
 * headline figure is compared against the cell of the rendered summary it
 * claims to explain, and a disagreement is printed in the block rather than
 * left for a reader to notice.
 *
 * Plan page only. Not in the Word export — the owner's decision.
 *
 * @provides window.GAIP_PlanCalcTrace
 */

(function (root) {
    'use strict';

    var TICKET = 'GH-425';
    var NUTRIENTS = ['N', 'P', 'K'];

    // ========================================================================
    // Display helpers. These format; they never calculate.
    // ========================================================================

    /** A number as the engine holds it, trimmed of trailing zeros. '—' when
     *  there is no value — never 0, which is a different answer. */
    function fmt(v, dp) {
        if (v === null || v === undefined || v === '') return '—';
        var n = (typeof v === 'number') ? v : parseFloat(v);
        if (!isFinite(n)) return '—';
        var d = (typeof dp === 'number') ? dp : 4;
        var s = n.toFixed(d);
        if (s.indexOf('.') >= 0) s = s.replace(/0+$/, '').replace(/\.$/, '');
        return s;
    }

    function txt(v) {
        return (v === null || v === undefined || v === '') ? '—' : String(v);
    }

    function esc(s) {
        return String(s === null || s === undefined ? '' : s)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    /** Where a value came from, in the words the shared input adapter stamps. */
    var SOURCE_WORDS = {
        'plan': 'the form on this page',
        'plan-persisted': 'this site\'s last saved programme',
        'settings-turf': 'Settings > Turf',
        'species-default': 'the species removal table (no target was entered)',
        'site-config': 'this site\'s configuration',
        'hub-config': 'this site\'s configuration',
        // The shared input adapter stamps 'sample' for anything the CALLER
        // handed it as a per-sample override, and the Plan page resolves
        // methodology, species and surface type before it calls the adapter. So
        // this stamp means "this page decided it", not "it was read off the
        // certificate" — said plainly rather than glossed into something
        // friendlier and wrong.
        'sample': 'handed to the resolver by this page as a per-sample value',
        'sample-snapshot': 'the selected soil sample',
        'sample-soil': 'the selected soil sample',
        'site-override': 'the site\'s soil texture override',
        'turf-construction': 'the turf construction type',
        'schedule': 'the traffic schedule in Settings',
        'not-sports': 'not applied — traffic scales nitrogen on sports turf only',
        'no-schedule': 'no traffic schedule is set for this site',
        'default': 'the default (nothing set it)',
        'unresolved': 'nothing resolved it',
        'nasa-power': 'NASA POWER 20-year monthly normals',
        'open-meteo-fallback': 'Open-Meteo monthly normals (NASA POWER did not answer)',
        'unavailable': 'no provider answered'
    };

    function sourceWords(key) {
        if (!key) return '—';
        return SOURCE_WORDS[key] || String(key);
    }

    /**
     * Where a sufficiency range came from. `annual_totals_range_source` reads
     * 'certificate' on MLSN and SLAN too — deliberately, so that the Ammonium
     * Acetate "Generic" badge cannot fire on them (see resolveSufficiencyRanges()
     * in nutrition-program-inputs.js) — so the flag only means what it says
     * under AA, and this says so rather than reporting a Hill Labs certificate
     * for a site that has none.
     */
    function rangeSourceWords(key, methodology) {
        var aa = /AMMONIUM_ACETATE|COTULA/i.test(String(methodology || ''));
        if (!aa) return 'the published range for this methodology';
        if (key === 'certificate') return 'a Hill Labs certificate for this species and texture';
        if (key === 'texture-fallback') return 'the generic band for this soil texture';
        return key ? String(key) : '—';
    }

    var INTENT_WORDS = {
        'lift-to-floor': 'below the floor — removal plus a lift',
        'maintain-floor': 'at or above the ceiling — removal beyond what the soil can spare',
        'suppress-above-ceiling': 'at or above the ceiling — nothing to apply',
        'removal-only': 'inside the range — removal only',
        'removal-only-unverified': 'no sufficiency range resolved — removal only',
        'removal-only-no-soil-data': 'no soil reading — removal only'
    };

    // ========================================================================
    // The model. Pure: every module it needs is injected, so jest builds the
    // same object the browser does.
    // ========================================================================

    /**
     * @param {object} o
     *   o.calendar        NutritionCalendar.computeProgram() output
     *   o.program         the regional recommender's programme (has `monthly`)
     *   o.context         the recommender's own context, off its
     *                     `gaip:*-program-generated` event (optional)
     *   o.deliveryModule  window.GAIP_NutritionDelivery
     *   o.balanceModule   window.GAIP_NutrientBalanceStatus
     *   o.panelRows       what the rendered summary table prints, for the
     *                     self-check (optional)
     */
    function buildTrace(o) {
        o = o || {};
        var calendar = o.calendar || null;
        var program = o.program || null;
        var context = o.context || null;
        var D = o.deliveryModule || null;
        var B = o.balanceModule || null;

        if (!calendar || !calendar.annual_totals) {
            return { available: false, reason: 'No generated programme is on this page yet.' };
        }
        if (!D || !B) {
            return {
                available: false,
                reason: 'nutrition-delivery-core.js or nutrient-balance-status.js is not loaded, ' +
                        'so the figures this block reports cannot be read from the engines that made them.'
            };
        }

        var meta = calendar.meta || {};
        var soil = calendar.soil || {};
        var adj = calendar.adjustments || {};
        var srcs = meta.inputSources || {};
        var detail = calendar.requirement_detail || null;
        var rangeSrc = calendar.annual_totals_range_source || {};
        var monthly = (calendar.program && calendar.program.monthly) || [];

        // The delivery ledger — the shared accumulator, over the very
        // application list the Monthly Program table above prints.
        var delivery = D.accumulate((program && program.monthly) || []);

        // The verdicts — the shared classifier, handed exactly what the panel
        // hands it (soil ppm, removal, range, bulk density, depth all off the
        // programme; delivered off the ledger above).
        var soilPpm = soil.ppm || {};
        var removalMap = calendar.annual_removal || {};
        var rangeMap = calendar.annual_totals_range || {};
        var missingMap = calendar.missing_soil_data || {};
        var required = calendar.annual_totals || {};

        var balances = {};
        NUTRIENTS.forEach(function (n) {
            balances[n] = B.classify({
                nutrient: n,
                required: required[n],
                delivered: delivery.totals[n],
                currentPpm: soilPpm[n],
                removal: removalMap[n],
                range: rangeMap[n],
                bulkDensity: soil.bulkDensity,
                soilDepth: soil.soilDepth,
                missingSoilData: !!missingMap[n]
            });
        });

        return {
            available: true,
            ticket: TICKET,
            inputs: buildInputRows(calendar, program, context, detail),
            nutrients: NUTRIENTS.map(function (n) {
                return buildNutrientTrace(n, {
                    calendar: calendar, detail: detail ? detail[n] : null,
                    adj: adj, meta: meta, soil: soil, srcs: srcs,
                    rangeSourceKey: rangeSrc[n], required: required[n],
                    delivery: delivery, balance: balances[n], D: D
                });
            }),
            detailAvailable: !!detail,
            checks: buildChecks(o.panelRows, required, delivery, balances, removalMap, D),
            monthlyCount: monthly.length
        };
    }

    // ------------------------------------------------------------------ inputs

    function buildInputRows(calendar, program, context, detail) {
        var meta = calendar.meta || {};
        var soil = calendar.soil || {};
        var adj = calendar.adjustments || {};
        var srcs = meta.inputSources || {};
        var clip = adj.clipping_factors || {};
        var monthly = (calendar.program && calendar.program.monthly) || [];
        var tissue = calendar.tissue_percent || null;
        var pDetail = detail && detail.P;

        var rows = [];
        function row(label, value, source, note) {
            rows.push({ label: label, value: value, source: source || '—', note: note || null });
        }

        row('Programme generated', txt(meta.generated), 'this programme');
        row('Methodology', txt(meta.methodology), sourceWords(srcs.methodology));
        row('Species', txt(meta.speciesDisplay || meta.species),
            sourceWords(srcs.species),
            meta.species ? ('engine key: ' + meta.species) : null);
        row('Surface type', txt(meta.surfaceType), sourceWords(srcs.surfaceType));
        row('Hemisphere', txt(meta.hemisphere), 'the site\'s latitude');
        row('Coordinates',
            (meta.lat === null || meta.lat === undefined) ? '—' : (fmt(meta.lat, 4) + ', ' + fmt(meta.lon, 4)),
            'the site, as it stood when this programme was generated');

        row('Annual N target (as entered)', fmt(meta.annualNBase) + ' kg N/ha/yr', sourceWords(srcs.annualN));
        row('Traffic intensity', txt(meta.trafficIntensity) + ' (x ' + fmt(adj.traffic_modifier) + ')',
            sourceWords(meta.trafficSource || srcs.trafficIntensity),
            'applied to nitrogen only, and on sports turf only');
        row('Annual N after traffic', fmt(adj.target_n) + ' kg N/ha/yr', 'this programme');
        row('Clipping management', txt(adj.clipping_management || meta.clippingManagement),
            sourceWords(srcs.clippingManagement),
            'factors N x ' + fmt(clip.nFactor) + ', P x ' + fmt(clip.pFactor) + ', K x ' + fmt(clip.kFactor));
        row('Monthly N cap', (meta.maxNPerMonth === null || meta.maxNPerMonth === undefined)
                ? '—' : (fmt(meta.maxNPerMonth) + ' kg N/ha/month'),
            sourceWords(srcs.maxNPerMonth),
            adj.n_cap_applied ? 'the cap fired on this programme' : 'the cap did not fire on this programme');
        row('Distribution mode', txt(meta.distribution), sourceWords(srcs.distributionMode));

        var isAA = /AMMONIUM_ACETATE|COTULA/i.test(String(meta.methodology || ''));
        row('Soil texture', txt(soil.soilTexture), sourceWords(srcs.soilTexture),
            isAA ? 'selects which Hill Labs sufficiency certificate applies'
                 : 'only selects a range under Ammonium Acetate, so it does not affect this programme');
        row('Sample pH', fmt(soil.pH),
            (soil.pH === null || soil.pH === undefined) ? 'no reading on this sample' : 'the selected soil sample',
            'selects the phosphorus floor on the MLSN and SLAN ladders');
        row('Sample CEC', (soil.CEC === null || soil.CEC === undefined)
                ? 'no reading on this sample' : (fmt(soil.CEC) + ' meq/100g'),
            (soil.CEC === null || soil.CEC === undefined) ? '—' : 'the selected soil sample');
        row('Bulk density / soil depth', fmt(soil.bulkDensity) + ' g/cm3 / ' + fmt(soil.soilDepth) + ' cm',
            'the selected soil sample, or the engine default where it carries none',
            pDetail ? ('1 ppm = ' + fmt(pDetail.ppmToKgHaFactor) + ' kg/ha in this rootzone') : null);

        var hasTissue = !!(tissue && (typeof tissue.N === 'number' || typeof tissue.P === 'number' ||
            typeof tissue.K === 'number'));
        row('Tissue analysis',
            hasTissue ? ('N ' + fmt(tissue.N) + '%, P ' + fmt(tissue.P) + '%, K ' + fmt(tissue.K) + '%')
                      : 'no tissue analysis for this zone',
            hasTissue ? 'the tissue sample matched to this zone' : '—',
            calendar.tissue_gate_applied
                ? 'the plant\'s own P:N and K:N ratios governed P and K removal'
                : 'the species removal table governed P and K removal');

        row('Years to correct a deficit',
            detail ? ('P ' + fmt(detail.P && detail.P.yearsToCorrect) + ' yr, K ' +
                      fmt(detail.K && detail.K.yearsToCorrect) + ' yr')
                   : '—',
            'the requirement engine');

        row('Monthly temperature normals',
            monthly.length === 12 ? monthly.map(function (m) { return fmt(m.temp, 1); }).join(' / ') + ' degC' : '—',
            sourceWords(meta.monthlyTempsSource),
            meta.monthlyTempsPeriod ? ('period: ' + meta.monthlyTempsPeriod) : null);
        row('Growth potential series',
            monthly.length === 12
                ? monthly.map(function (m) { return Math.round(m.gp * 100) + '%'; }).join(' / ')
                : '—',
            'computed from the normals above and the ' +
                (meta.species ? meta.species : 'species') + ' growth-potential curve',
            'this is what weights the twelve monthly rates');

        var hasSoilTemp = !!(context && context.soilTemp !== undefined && context.soilTemp !== null &&
            isFinite(parseFloat(context.soilTemp)));
        row('Soil temperature (product selection)',
            hasSoilTemp ? (fmt(context.soilTemp) + ' degC')
                        : 'this region\'s recommender takes no soil temperature',
            hasSoilTemp
                ? ('SOURCE NOT AVAILABLE — the recommender resolves it internally and publishes only ' +
                   'the value, not which of its sources answered')
                : '—',
            'feeds the slow-release efficiency curve, not the requirement figures');
        // Only the New Zealand recommender scores on a CEC, and only it carries
        // the field. An absent key and a null reading are different answers.
        var cecTaken = !!(program && Object.prototype.hasOwnProperty.call(program, 'soilCEC'));
        row('CEC (product selection)',
            (program && program.soilCEC !== undefined && program.soilCEC !== null)
                ? (fmt(program.soilCEC) + ' meq/100g')
                : (cecTaken ? 'no reading — the recommender used its own assumption'
                            : 'this region\'s recommender takes no CEC input'),
            cecTaken ? 'the programme\'s own soil.CEC' : '—');

        var rs = calendar.annual_totals_range_source || {};
        row('Sufficiency range source',
            'P: ' + rangeSourceWords(rs.P, meta.methodology) +
                ' | K: ' + rangeSourceWords(rs.K, meta.methodology),
            'the shared range resolver',
            'nitrogen has no soil sufficiency range at all');

        return rows;
    }

    // --------------------------------------------------------------- nutrient

    function buildNutrientTrace(n, c) {
        var steps = [];
        function step(label, working, result, note) {
            var s = { label: label, working: working || null, result: result || null,
                      note: note || null, lines: null };
            steps.push(s);
            return s;
        }

        if (n === 'N') {
            buildNitrogenSteps(step, c);
        } else {
            buildRequirementSteps(step, n, c);
        }
        buildDeliveredStep(step, n, c);
        buildBalanceStep(step, n, c);

        return { nutrient: n, steps: steps };
    }

    function buildNitrogenSteps(step, c) {
        var meta = c.meta, adj = c.adj, srcs = c.srcs;
        var clip = adj.clipping_factors || {};
        step('Annual N target',
            'entered as ' + fmt(meta.annualNBase) + ' kg N/ha/yr',
            fmt(meta.annualNBase) + ' kg/ha',
            'from ' + sourceWords(srcs.annualN));
        step('Traffic',
            fmt(meta.annualNBase) + ' x ' + fmt(adj.traffic_modifier) +
                ' (' + txt(meta.trafficIntensity) + ')',
            fmt(adj.target_n) + ' kg/ha',
            'the modifier is 1.0 on anything but sports turf, and is applied to nitrogen only — ' +
            'P and K removal already scales with N');
        step('Clipping management',
            fmt(adj.target_n) + ' x ' + fmt(clip.nFactor) + ' (' + txt(adj.clipping_management) + ')',
            fmt(adj.applied_n) + ' kg/ha',
            'the N factor is 1.0 in both modes: returning clippings does not reduce the target the user set');
        step('Required (N)',
            'the figure the Required column prints',
            fmt(c.required) + ' kg/ha',
            'nitrogen has no soil sufficiency range, so there is no floor, ceiling or lift term');
        step('Spread over twelve months',
            txt(meta.distribution) + ', cap ' +
                ((meta.maxNPerMonth === null || meta.maxNPerMonth === undefined)
                    ? 'none' : fmt(meta.maxNPerMonth) + ' kg N/ha/month'),
            adj.n_cap_applied
                ? (fmt(adj.original_n_total) + ' wanted, ' + fmt(adj.scheduled_n_total) + ' scheduled')
                : (fmt(adj.scheduled_n_total) + ' scheduled, uncapped'),
            adj.n_cap_applied
                ? ('the cap fired: ' + fmt(adj.n_redistributed) + ' kg/ha moved into other months, ' +
                   fmt(adj.n_unschedulable) + ' kg/ha could not be placed at all')
                : 'no month wanted more than the cap');
    }

    function buildRequirementSteps(step, n, c) {
        var d = c.detail;
        if (!d) {
            step('Requirement working',
                null,
                'not available',
                'this programme was generated before the engine published its per-nutrient working. ' +
                'Press Generate Nutrition Program again to see it. It is deliberately not reconstructed here.');
            return;
        }

        // 1 — the reading
        if (d.missingSoilData) {
            step('Soil reading',
                null, 'no reading for ' + n + ' on this sample',
                'no floor, ceiling or lift is computable, so Required is removal only');
        } else {
            step('Soil reading',
                fmt(d.currentLevel) + ' ppm, converted at ' + fmt(d.bulkDensityUsed) + ' g/cm3 x ' +
                    fmt(d.soilDepthUsed) + ' cm x 0.1 = ' + fmt(d.ppmToKgHaFactor) + ' kg/ha per ppm',
                fmt(d.currentLevel) + ' ppm' +
                    (c.balance && typeof c.balance.currentKgHa === 'number'
                        ? ' = ' + fmt(c.balance.currentKgHa) + ' kg/ha' : ''),
                'the reading on the selected soil sample');
        }

        // 2 — the range
        if (d.rangeResolved) {
            step('Sufficiency range',
                'floor ' + fmt(d.floor) + ' ppm, ceiling ' + fmt(d.ceiling) + ' ppm',
                fmt(d.floor) + '–' + fmt(d.ceiling) + ' ppm',
                txt(d.methodology) + (d.citation ? (' — ' + d.citation) : '') +
                    ' (' + rangeSourceWords(c.rangeSourceKey, c.meta && c.meta.methodology) + ')' +
                    (d.missingSoilData
                        ? '. The range resolved, but nothing was compared against it: this sample ' +
                          'carries no reading for ' + n + '.' : ''));
        } else {
            step('Sufficiency range', null, 'none resolved for ' + n,
                'nothing in the resolved methodology covers this nutrient for this species and texture');
        }

        // 3 — removal
        step('Removal — what the season takes out',
            fmt(d.annualNUsed) + ' kg N/ha x ' + fmt(d.removalRatio) + ' = ' + fmt(d.removalBase) +
                ', then x ' + fmt(d.clippingFactor) + ' (' + txt(d.clippingManagement) + ')',
            fmt(d.removal) + ' kg/ha',
            d.removalRatioSource === 'tissue'
                ? ('the ' + n + ':N ratio measured in this site\'s own tissue analysis')
                : ('the ' + n + ':N ratio for ' + txt(d.speciesKeyUsed) + ' in the species removal table ' +
                   '(Carrow, Waddington & Rieke 2001; Christians, Patton & Law 2017)'));

        // 4 — the branch
        var branchNote = INTENT_WORDS[d.intent] || d.intent;
        if (d.intent === 'lift-to-floor') {
            step('Requirement — branch: lift to floor',
                'lift = (' + fmt(d.floor) + ' − ' + fmt(d.currentLevel) + ') ppm x ' +
                    fmt(d.ppmToKgHaFactor) + ' kg/ha per ppm = ' + fmt(d.liftKgHaBeforeSpread) +
                    ' kg/ha, spread over ' + fmt(d.yearsToCorrect) + ' years = ' + fmt(d.correctionRequired) +
                    ' kg/ha/yr; Required = removal ' + fmt(d.removal) + ' + lift ' + fmt(d.correctionRequired),
                fmt(d.annualRequirement) + ' kg/ha',
                branchNote + '. The lift target is the floor itself.');
        } else if (d.intent === 'maintain-floor' || d.intent === 'suppress-above-ceiling') {
            step('Requirement — branch: at or above the ceiling',
                'Required = max(0, removal ' + fmt(d.removal) + ' − (' + fmt(d.currentLevel) + ' − ' +
                    fmt(d.floor) + ') ppm x ' + fmt(d.ppmToKgHaFactor) + ') = max(0, ' + fmt(d.removal) +
                    ' − ' + fmt(d.headroomKgHa) + ') = ' + fmt(d.maintainRaw),
                fmt(d.annualRequirement) + ' kg/ha',
                branchNote + '. ' + (d.intent === 'maintain-floor'
                    ? 'The soil can spare what is above its own floor and no more, so a range narrower ' +
                      'in kg/ha than the season\'s removal still asks for fertiliser.'
                    : 'The soil can spare the whole of the season\'s removal and still finish above ' +
                      'its own floor, so nothing is applied.'));
        } else {
            step('Requirement — branch: removal only',
                'Required = removal ' + fmt(d.removal) + ', no lift and no suppression',
                fmt(d.annualRequirement) + ' kg/ha',
                branchNote);
        }
    }

    function buildDeliveredStep(step, n, c) {
        var lines = [];
        var counted = 0;
        (c.delivery.applications || []).forEach(function (a) {
            var v = a.nutrients ? a.nutrients[n] : 0;
            if (!v) return;
            var pct = a.analysisPct ? a.analysisPct[n] : null;
            lines.push({
                month: txt(a.month),
                name: txt(a.name || a.id),
                rate: fmt(a.rate) + ' ' + txt(a.rateUnit) + ' x ' + fmt(a.count) + ' = ' + fmt(a.mass),
                how: (a.source && a.source[n] === 'declared')
                    ? ('declared by the recommender: ' + fmt(v))
                    : (fmt(a.mass) + ' x ' + fmt(pct) + '% = ' + fmt(v)),
                value: fmt(v),
                excluded: !!a.isAmendment
            });
            if (!a.isAmendment) counted++;
        });
        var s = step('Delivered — product by product',
            lines.length
                ? (counted + (counted === 1 ? ' application carries ' : ' applications carry ') + n)
                : 'no application in this programme carries ' + n,
            fmt(c.delivery.totals[n]) + ' kg/ha',
            'these lines add up to the total; an amendment line is listed and marked, and is not counted, ' +
            'because it is added at export rather than by the programme');
        s.lines = lines;
    }

    function buildBalanceStep(step, n, c) {
        var b = c.balance || {};
        if (b.branch === 'missing-soil-data') {
            step('Balance and status', null, txt(b.statusLabel),
                'there is no soil reading for ' + n + ', so the projected end-of-season level cannot be ' +
                'computed and no verdict is offered');
            return;
        }
        if (b.branch === 'no-range-nothing-required') {
            step('Balance and status', 'Required is 0', txt(b.statusLabel),
                'nothing is being asked for, so there is nothing to fall short of');
            return;
        }
        if (b.branch === 'no-range-delivery-ratio') {
            step('Balance and status',
                'delivered ' + fmt(b.delivered) + ' / required ' + fmt(b.required) + ' = ' + fmt(b.pct) + '%',
                txt(b.statusLabel),
                'no sufficiency range applies to ' + n + ' here, so the verdict is the share of the ' +
                'requirement the programme delivers — 90% and above On Track, 70% and above Monitor, ' +
                'below that Deficit');
            return;
        }
        step('Balance and status',
            'Balance = current ' + fmt(b.currentKgHa) + ' + delivered ' + fmt(b.delivered) +
                ' − removal ' + fmt(b.removal) + ' = ' + fmt(b.balanceKgHa) + ' kg/ha, against ' +
                fmt(b.floorKgHa) + '–' + fmt(b.ceilingKgHa) + ' kg/ha (the range above x ' +
                fmt(b.unit) + ' kg/ha per ppm)',
            txt(b.statusLabel),
            b.branch === 'above-ceiling'
                ? 'the projected level finishes above the ceiling'
                : (b.branch === 'below-floor'
                    ? 'the projected level finishes below the floor'
                    : 'the projected level finishes inside the range'));
    }

    // ---------------------------------------------------------------- checks

    /**
     * Every headline figure, against the cell of the rendered summary above it
     * that it claims to explain. This is the block checking that it is reading
     * what the product printed, not a parallel universe of its own.
     */
    function buildChecks(panelRows, required, delivery, balances, removalMap, D) {
        if (!panelRows) return { ran: false, rows: [] };
        var rows = [];
        NUTRIENTS.forEach(function (n) {
            var cells = panelRows[n];
            if (!cells) {
                rows.push({ nutrient: n, column: '(row)', mine: 'present', panel: 'missing', ok: false });
                return;
            }
            var b = balances[n] || {};
            function check(column, mine) {
                var panel = (cells[column] === undefined || cells[column] === null) ? '' : String(cells[column]).trim();
                rows.push({ nutrient: n, column: column, mine: mine, panel: panel, ok: panel === mine });
            }
            // The panel prints the classifier's own `currentDisplay` verbatim.
            check('Current', String(b.currentDisplay));
            check('Removal', (typeof removalMap[n] === 'number') ? String(removalMap[n]) : '—');
            check('Required', D.roundAtOutput(required[n], 1).toFixed(1));
            check('Delivered', D.roundAtOutput(delivery.totals[n], 1).toFixed(1));
            check('Range', String(b.rangeDisplay));
            check('Balance', (typeof b.diff === 'number') ? b.diff.toFixed(1) : '—');
            check('Status', String(b.statusLabel));
        });
        return { ran: true, rows: rows, allOk: rows.every(function (r) { return r.ok; }) };
    }

    // ========================================================================
    // Rendering
    // ========================================================================

    var STYLE_ID = 'gaip-calc-trace-style';
    var CSS = [
        '.gaip-ctrace{font-family:var(--gaip-font,system-ui,sans-serif);background:var(--gaip-surface,#fff);',
        'border:1px dashed var(--gaip-warning,#d97706);border-radius:var(--gaip-radius,10px);',
        'padding:16px 18px 18px;margin:14px 0 0;color:var(--gaip-text,#1a2b22);font-size:12px;line-height:1.55}',
        '.gaip-ctrace h4{margin:0 0 4px;font-size:13px;font-weight:700;color:var(--gaip-text,#1a2b22)}',
        '.gaip-ctrace-temp{background:var(--gaip-warning-bg,#fffbeb);border:1px solid var(--gaip-warning-border,#fde68a);',
        'border-radius:var(--gaip-radius-sm,6px);padding:9px 11px;margin:8px 0 14px;color:var(--gaip-text,#1a2b22)}',
        '.gaip-ctrace-temp strong{display:block;font-size:12px;margin-bottom:2px}',
        '.gaip-ctrace-sec{margin-top:16px;border-top:1px solid var(--gaip-border-light,#dde7e2);padding-top:12px}',
        '.gaip-ctrace-sec>h5{margin:0 0 8px;font-size:12px;font-weight:700;letter-spacing:.04em;',
        'text-transform:uppercase;color:var(--gaip-text-muted,#6b8878)}',
        '.gaip-ctrace table{width:100%;border-collapse:collapse;font-size:11.5px}',
        '.gaip-ctrace th{text-align:left;font-size:10px;text-transform:uppercase;letter-spacing:.05em;',
        'color:var(--gaip-text-muted,#6b8878);border-bottom:1px solid var(--gaip-border,#c9d8d0);padding:4px 8px 5px;font-weight:700}',
        '.gaip-ctrace td{padding:5px 8px;border-bottom:1px solid var(--gaip-border-light,#dde7e2);vertical-align:top}',
        '.gaip-ctrace-num{font-family:var(--gaip-font-mono,monospace)}',
        '.gaip-ctrace-step{display:grid;grid-template-columns:190px 1fr 130px;gap:10px;padding:7px 0;',
        'border-bottom:1px solid var(--gaip-border-light,#dde7e2)}',
        '@media(max-width:760px){.gaip-ctrace-step{grid-template-columns:1fr}}',
        '.gaip-ctrace-step-label{font-weight:700}',
        '.gaip-ctrace-step-work{font-family:var(--gaip-font-mono,monospace);white-space:normal;word-break:break-word}',
        '.gaip-ctrace-step-res{font-family:var(--gaip-font-mono,monospace);font-weight:700;text-align:right}',
        '@media(max-width:760px){.gaip-ctrace-step-res{text-align:left}}',
        '.gaip-ctrace-note{color:var(--gaip-text-muted,#6b8878);margin-top:2px}',
        '.gaip-ctrace-nut{margin-top:14px}',
        '.gaip-ctrace-nut>h5{margin:0 0 4px;font-size:12px;font-weight:800;color:var(--gaip-text,#1a2b22)}',
        '.gaip-ctrace-led{margin:4px 0 0;padding:0;list-style:none}',
        '.gaip-ctrace-led li{display:grid;grid-template-columns:60px 1fr 1fr 90px;gap:8px;padding:3px 0;',
        'border-bottom:1px dotted var(--gaip-border-light,#dde7e2);font-size:11px}',
        '@media(max-width:760px){.gaip-ctrace-led li{grid-template-columns:1fr}}',
        '.gaip-ctrace-led .m{color:var(--gaip-text-muted,#6b8878)}',
        '.gaip-ctrace-led .h,.gaip-ctrace-led .v{font-family:var(--gaip-font-mono,monospace)}',
        '.gaip-ctrace-led .v{text-align:right;font-weight:700}',
        '@media(max-width:760px){.gaip-ctrace-led .v{text-align:left}}',
        '.gaip-ctrace-ok{color:var(--gaip-good,#16a34a);font-weight:700}',
        '.gaip-ctrace-bad{background:var(--gaip-critical-bg,#fef2f2);border:1px solid var(--gaip-critical,#dc2626);',
        'border-radius:var(--gaip-radius-sm,6px);padding:9px 11px;color:var(--gaip-critical,#dc2626);font-weight:700}',
        '.gaip-ctrace-unavail{color:var(--gaip-text-muted,#6b8878)}'
    ].join('');

    function ensureStyle(doc) {
        if (doc.getElementById(STYLE_ID)) return;
        var s = doc.createElement('style');
        s.id = STYLE_ID;
        s.textContent = CSS;
        (doc.head || doc.documentElement).appendChild(s);
    }

    var TEMP_NOTICE =
        '<div class="gaip-ctrace-temp"><strong>Temporary — this panel will be removed.</strong>' +
        'It is a verification aid, shown while the agronomy rules are being checked, so that every ' +
        'figure in the Nutrient Delivery Summary above can be traced back to the input it came from. ' +
        'It reads the values the calculation engines produced and works nothing out for itself. ' +
        'It is not part of the report and does not appear in the Word document.</div>';

    function renderHtml(trace) {
        if (!trace || !trace.available) {
            return '<div class="gaip-ctrace"><h4>How this was calculated</h4>' + TEMP_NOTICE +
                '<div class="gaip-ctrace-unavail">' + esc((trace && trace.reason) || 'Not available.') +
                '</div></div>';
        }

        var h = ['<div class="gaip-ctrace" data-gaip-calc-trace><h4>How this was calculated</h4>', TEMP_NOTICE];

        h.push('<div class="gaip-ctrace-sec"><h5>Inputs this programme was computed from</h5>');
        h.push('<table><thead><tr><th>Input</th><th>Value</th><th>Where it came from</th></tr></thead><tbody>');
        trace.inputs.forEach(function (r) {
            h.push('<tr><td>' + esc(r.label) + '</td><td class="gaip-ctrace-num">' + esc(r.value) +
                (r.note ? '<div class="gaip-ctrace-note">' + esc(r.note) + '</div>' : '') +
                '</td><td>' + esc(r.source) + '</td></tr>');
        });
        h.push('</tbody></table></div>');

        if (!trace.detailAvailable) {
            h.push('<div class="gaip-ctrace-sec"><div class="gaip-ctrace-unavail">' +
                'This programme was restored from the copy saved for this site, and that copy predates the ' +
                'per-nutrient working. Press <strong>Generate Nutrition Program</strong> to recompute it and ' +
                'see the phosphorus and potassium steps.</div></div>');
        }

        trace.nutrients.forEach(function (nt) {
            h.push('<div class="gaip-ctrace-sec gaip-ctrace-nut"><h5>' + esc(nt.nutrient) + '</h5>');
            nt.steps.forEach(function (s) {
                h.push('<div class="gaip-ctrace-step"><div class="gaip-ctrace-step-label">' + esc(s.label) + '</div>' +
                    '<div class="gaip-ctrace-step-work">' + esc(s.working || '') +
                    (s.note ? '<div class="gaip-ctrace-note">' + esc(s.note) + '</div>' : '') + '</div>' +
                    '<div class="gaip-ctrace-step-res">' + esc(s.result || '') + '</div></div>');
                if (s.lines && s.lines.length) {
                    h.push('<ul class="gaip-ctrace-led">');
                    s.lines.forEach(function (l) {
                        h.push('<li><span class="m">' + esc(l.month) + '</span><span>' + esc(l.name) +
                            (l.excluded ? ' <em>(amendment — not in the total)</em>' : '') +
                            '<div class="gaip-ctrace-note gaip-ctrace-num">' + esc(l.rate) + '</div></span>' +
                            '<span class="h">' + esc(l.how) + '</span><span class="v">' + esc(l.value) + '</span></li>');
                    });
                    h.push('</ul>');
                }
            });
            h.push('</div>');
        });

        h.push('<div class="gaip-ctrace-sec"><h5>Checked against the summary above</h5>');
        if (!trace.checks.ran) {
            h.push('<div class="gaip-ctrace-unavail">The summary table could not be read, so the figures ' +
                'above were not cross-checked against it.</div>');
        } else if (trace.checks.allOk) {
            h.push('<div class="gaip-ctrace-ok">All ' + trace.checks.rows.length +
                ' figures match the Nutrient Delivery Summary cell they explain.</div>');
        } else {
            h.push('<div class="gaip-ctrace-bad">These figures do NOT match the summary above. ' +
                'Trust the summary, not this block, and report the difference.</div>');
            h.push('<table><thead><tr><th>Nutrient</th><th>Column</th><th>Here</th><th>Summary</th></tr></thead><tbody>');
            trace.checks.rows.filter(function (r) { return !r.ok; }).forEach(function (r) {
                h.push('<tr><td>' + esc(r.nutrient) + '</td><td>' + esc(r.column) +
                    '</td><td class="gaip-ctrace-num">' + esc(r.mine) +
                    '</td><td class="gaip-ctrace-num">' + esc(r.panel) + '</td></tr>');
            });
            h.push('</tbody></table>');
        }
        h.push('</div>');

        h.push('</div>');
        return h.join('');
    }

    // ========================================================================
    // Browser wiring — the only impure part, and the only entry point.
    // ========================================================================

    var lastContext = null;
    var mountTimer = null;

    function findSummaryCard(doc) {
        var heads = doc.querySelectorAll('h4');
        for (var i = 0; i < heads.length; i++) {
            if (/Nutrient Delivery Summary/i.test(heads[i].textContent || '')) {
                var card = heads[i].parentElement;
                if (card && card.querySelector('table')) return card;
            }
        }
        return null;
    }

    /** What the rendered summary prints, keyed by nutrient then column name. */
    function readPanelRows(card) {
        if (!card) return null;
        var table = card.querySelector('table');
        if (!table) return null;
        var ths = Array.prototype.slice.call(table.querySelectorAll('thead th'));
        if (!ths.length) return null;
        var cols = ths.map(function (th) {
            return String(th.textContent || '').replace(/\s*\(.*$/, '').trim();
        });
        var out = {};
        Array.prototype.slice.call(table.querySelectorAll('tbody tr')).forEach(function (tr) {
            var tds = Array.prototype.slice.call(tr.children);
            if (!tds.length) return;
            var key = String(tds[0].textContent || '').trim();
            if (NUTRIENTS.indexOf(key) < 0) return;
            var row = {};
            cols.forEach(function (name, i) {
                if (!name || i === 0 || !tds[i]) return;
                row[name] = String(tds[i].textContent || '').replace(/\s+/g, ' ').trim();
            });
            out[key] = row;
        });
        return Object.keys(out).length ? out : null;
    }

    function build(doc) {
        var card = findSummaryCard(doc || root.document);
        var calendar = (root.GilbaNutritionCalendar && root.GilbaNutritionCalendar.program) || null;
        var program = root.GAIP_NUTRITION_PROGRAM || null;
        var trace = buildTrace({
            calendar: calendar,
            program: program,
            context: lastContext,
            deliveryModule: root.GAIP_NutritionDelivery,
            balanceModule: root.GAIP_NutrientBalanceStatus,
            panelRows: readPanelRows(card)
        });
        return { card: card, trace: trace };
    }

    function mount() {
        var doc = root.document;
        if (!doc) return;
        var built = build(doc);
        if (!built.card) return;
        ensureStyle(doc);
        var existing = built.card.parentElement
            ? built.card.parentElement.querySelector('[data-gaip-calc-trace-host]') : null;
        var host = existing;
        if (!host) {
            host = doc.createElement('div');
            host.setAttribute('data-gaip-calc-trace-host', TICKET);
        }
        host.innerHTML = renderHtml(built.trace);
        if (built.card.nextSibling !== host) {
            built.card.parentNode.insertBefore(host, built.card.nextSibling);
        }
    }

    function schedule() {
        if (mountTimer) clearTimeout(mountTimer);
        mountTimer = setTimeout(function () { mountTimer = null; try { mount(); } catch (e) {
            if (root.console && console.warn) console.warn('[' + TICKET + '] calc trace failed:', e && e.message);
        } }, 60);
    }

    function init() {
        var doc = root.document;
        if (!doc) return;
        ['gaip:prebble-program-generated', 'gaip:au-fertiliser-program-generated',
         'gaip:uk-fertiliser-program-generated', 'gaip:nz-fertiliser-program-generated'
        ].forEach(function (evt) {
            doc.addEventListener(evt, function (e) {
                lastContext = (e && e.detail && e.detail.context) || lastContext;
                schedule();
            });
        });
        doc.addEventListener('gaip:nutrition-calendar-generated', schedule);

        // The regional panels rebuild their whole innerHTML on every render, so
        // the host is thrown away with it. Put it back when that happens.
        var results = doc.querySelector('[data-nutrition-results]');
        if (results && root.MutationObserver) {
            new root.MutationObserver(function () {
                if (!doc.querySelector('[data-gaip-calc-trace-host]')) schedule();
            }).observe(results, { childList: true, subtree: true });
        }
        schedule();
    }

    var API = {
        TICKET: TICKET,
        buildTrace: buildTrace,
        renderHtml: renderHtml,
        readPanelRows: readPanelRows,
        mount: mount,
        init: init,
        _fmt: fmt
    };

    if (typeof window !== 'undefined') {
        window.GAIP_PlanCalcTrace = API;
        if (window.document) {
            if (window.document.readyState === 'loading') {
                window.document.addEventListener('DOMContentLoaded', init);
            } else {
                init();
            }
        }
    }
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = API;
    }
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this));
