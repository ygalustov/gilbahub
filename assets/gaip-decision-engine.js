/**
 * GAIP Decision Engine v1.0.0
 *
 * Decision State Machine — state, item building, commit/defer, persistence.
 * Zero DOM reads. All data from engine globals.
 *
 * Globals consumed (read-only):
 *   window.GAIP_DISEASE_RESULT / window.GAIP_DiseaseResults
 *   window.GAIP_DISEASE_FORECAST / window._diseaseForecastData
 *   window.GAIP_PGR_RESULT / window.lastPGRStatus
 *   window.GAIP_IrrigationResults
 *   window.GAIP_PRE_EMERGENT_RESULT  (set by hub-orchestrator.js step 8b)
 *   window.GAIP_SENSOR_DATA
 *   window.GAIP_CANONICAL_STATE / window.GAIP_STATE
 *
 * StorageAdapter key pattern (site-scoped):
 *   dsm_disposition   → JSON of DISPOSITION map
 *   dsm_scenario_lock → active scenario key string
 *
 * @author Gilba Solutions
 * @version 1.0.0
 */
(function (global) {
  'use strict';

  var VERSION = '1.0.0';

  // =========================================================================
  // CONSTANTS
  // =========================================================================

  // engine-confidence.js levels → v21 fork rendering classes
  var CONF_KEY_MAP = {
    high:        'high',
    medium:      'usable',
    low:         'estimate',
    indicative:  'estimate'
  };

  // Confidence rating letter → confKey (pre-emergent engine uses H/M/L)
  var CONF_LETTER_MAP = { H: 'high', M: 'usable', L: 'estimate' };

  // Beta disease keys (mirrors priority-action-queue.js and daily-dashboard.js)
  var BETA_KEYS = ['bipolaris', 'curvularia', 'drechslera', 'waitea'];

  var STORAGE_KEY_DISPOSITION = 'dsm_disposition';
  var STORAGE_KEY_SCENARIO    = 'dsm_scenario_lock';

  // =========================================================================
  // STATE
  // =========================================================================

  var DISPOSITION = {};
  var _siteId = null;

  // =========================================================================
  // STORAGE HELPERS
  // =========================================================================

  function _sa() {
    return global.GilbaStorageAdapter || global.StorageAdapter || null;
  }

  function _getSiteId() {
    if (_siteId) return _siteId;
    var state = global.GAIP_CANONICAL_STATE || global.GAIP_STATE || {};
    _siteId = state.siteId ||
      (global.GilbaSampleManager &&
       global.GilbaSampleManager.getCurrentSiteId &&
       global.GilbaSampleManager.getCurrentSiteId()) ||
      'default';
    return _siteId;
  }

  function _now() {
    return new Date().toTimeString().slice(0, 5) + ' today';
  }

  // =========================================================================
  // PERSISTENCE
  // =========================================================================

  function saveDisposition() {
    var sa = _sa();
    if (!sa) return;
    try { sa.setItem(STORAGE_KEY_DISPOSITION, JSON.stringify(DISPOSITION), _getSiteId()); }
    catch (e) { /* silent */ }
  }

  function loadDisposition() {
    var sa = _sa();
    if (!sa) return;
    try {
      var raw = sa.getItem(STORAGE_KEY_DISPOSITION, _getSiteId());
      if (raw) {
        var parsed = JSON.parse(raw);
        Object.keys(parsed).forEach(function (k) { DISPOSITION[k] = parsed[k]; });
      }
    } catch (e) { /* silent */ }
  }

  // =========================================================================
  // SITE SWITCH
  // =========================================================================

  function onSiteSwitch() {
    _siteId = null;
    // b35fix238: mutate instead of reassign — export reference stays valid
    Object.keys(DISPOSITION).forEach(function(k) { delete DISPOSITION[k]; });
    loadDisposition();
    if (global.GilbaDSM && global.GilbaDSM._ui && global.GilbaDSM._ui.onEngineUpdate) {
      global.GilbaDSM._ui.onEngineUpdate();
    }
  }

  // =========================================================================
  // CONFIDENCE HELPERS
  // =========================================================================

  function _confKey(confidence) {
    if (!confidence) return 'estimate';
    if (typeof confidence === 'object') {
      var lvl = confidence.level || '';
      return CONF_KEY_MAP[lvl] || 'estimate';
    }
    // String: 'high', 'medium', 'low', 'indicative', or letter 'H','M','L'
    return CONF_LETTER_MAP[confidence] || CONF_KEY_MAP[confidence] || 'estimate';
  }

  function _confLabel(confKey) {
    return confKey === 'high' ? 'High confidence'
         : confKey === 'usable' ? 'Usable'
         : 'Estimate only';
  }

  // =========================================================================
  // BETA DISEASE FILTER
  // =========================================================================

  function _isBeta(d) {
    if (d.beta === true || d.validationStatus === 'beta') return true;
    var k = (d.key || d.id || d.disease || '').toLowerCase();
    var n = (d.displayName || d.name || '').toLowerCase();
    return BETA_KEYS.some(function (b) { return k.indexOf(b) !== -1 || n.indexOf(b) !== -1; });
  }

  // =========================================================================
  // ITEM BUILDERS
  // =========================================================================

  function _buildDiseaseItem() {
    var result = global.GAIP_DISEASE_RESULT || global.GAIP_DiseaseResults;
    if (!result || !Array.isArray(result.diseases)) return null;

    var validated = result.diseases.filter(function (d) { return !_isBeta(d); });
    if (!validated.length) return null;

    var top = validated.reduce(function (best, d) {
      var r = d.adjustedRisk || d.riskScore || d.risk || d.riskPercent || d.pressure || 0;
      var br = best ? (best.adjustedRisk || best.riskScore || best.risk || best.pressure || 0) : -1;
      return r > br ? d : best;
    }, null);
    if (!top) return null;

    var risk = Math.round(top.adjustedRisk || top.riskScore || top.risk || top.riskPercent || top.pressure || 0);
    var name = top.displayName || top.name || top.disease || 'Disease';
    var threshold = top.threshold != null ? Math.round(top.threshold) : 20;
    var confK = _confKey(top.confidence || result.confidence);

    var forecast = global.GAIP_DISEASE_FORECAST || global._diseaseForecastData;
    var peakRisk = (forecast && forecast.peakRisk) ? Math.round(forecast.peakRisk) : null;
    var peakDay  = (forecast && forecast.peakDay)  ? forecast.peakDay : null;

    var tier = risk >= threshold ? 'act-on' : risk >= 10 ? 'plan-on' : 'watch';
    var urgency = tier === 'act-on' ? 'act' : tier === 'plan-on' ? 'warn' : 'ok';

    var actionText = risk >= threshold
      ? 'Apply fungicide today'
      : risk >= 10
        ? 'Monitor ' + name + ', approaching threshold'
        : 'Disease risk below threshold';

    var confirmTxt = confK !== 'high'
      ? (top.confidence && top.confidence.implication
          ? top.confidence.implication
          : 'Spray trigger is valid but data confidence is reduced. Confirm before applying.')
      : '';

    return {
      id: 'disease',
      tier: tier,
      rnCls: urgency === 'act' ? 'r' : urgency === 'warn' ? 'a' : '',
      leftUrg: urgency,
      pbMod: 'Disease, ' + name,
      pbAction: actionText,
      sig: risk + '%',
      sigClass: risk >= threshold ? 'breach' : '',
      thr: 'spray at ' + threshold + '%',
      thrNote: top.fracGroup ? 'FRAC ' + top.fracGroup : '',
      pressure: peakRisk && peakRisk > risk
        ? 'Delay cost rises, risk peaks at ' + peakRisk + '% ' + (peakDay || '')
        : 'Monitor conditions',
      pressureClass: (peakRisk && peakRisk > 70) ? 'hi' : '',
      visual: 'disease',
      visualData: { risk: risk, threshold: threshold, peakRisk: peakRisk, peakDay: peakDay },
      cALbl: 'Act now',
      cA: risk >= threshold ? 'Fungicide application' : 'Monitor',
      cAC: 'g',
      cRLbl: 'If delayed',
      cRisk: peakRisk && peakRisk > risk ? 'Risk rises to ' + peakRisk + '% by ' + (peakDay || 'day 4') : 'Surface at risk',
      cRC: 'r',
      cSlope: peakRisk && peakRisk > risk ? 'Risk doubles within 48h' : 'Risk holding',
      cSlopeClass: (peakRisk && peakRisk > risk) ? 'hi' : 'lo',
      confKey: confK,
      confLabel: _confLabel(confK),
      confImplication: top.confidence && top.confidence.implication ? top.confidence.implication : '',
      confConfirmTxt: confirmTxt,
      act: risk >= threshold ? 'Fungicide today' : ('Monitor ' + name),
      sup: name + ' ' + risk + '%',
      metric: risk + '%',
      mc: risk >= threshold ? 'r' : risk >= 10 ? 'a' : 'd',
      supHdr: 'If you delay:',
      supSev: risk >= 70 ? 'sev-high' : risk >= 40 ? 'sev-med' : 'sev-low',
      forkActLbl: 'Commit to fungicide application today',
      forkDeferLbl: 'Defer application',
      forkDeferSub: peakRisk ? 'risk peaks at ' + peakRisk + '%' : 'review conditions',
      forkActDyn: { 'default': risk >= threshold ? 'Commit, spray today' : 'Commit to monitoring' },
      forkDeferDyn: { 'default': 'Defer (check forecast)' },
      deferPenalties: {
        today:    'Later today, risk manageable if applied this afternoon',
        tomorrow: 'Tomorrow, risk may rise significantly',
        week:     'This week, surface at serious risk if deferred more than 48h'
      },
      commitConsequence: 'Fungicide committed. Risk projected to drop below threshold post-application.',
      clearedMsg: 'Disease risk below threshold, no action required.',
      svNow: risk + '% now',
      svProj: peakRisk ? peakRisk + '% ' + (peakDay || 'day 4') : 'holding',
      svProjColor: peakRisk && peakRisk > risk ? 'color:var(--red)' : 'color:var(--ink3)',
      svConseq: risk >= threshold ? 'spray cost doubles' : 'monitor closely'
    };
  }

  function _buildPGRItem() {
    var result = global.GAIP_PGR_RESULT || global.lastPGRStatus;
    if (!result || result.success === false) return null;
    if (result.status === 'No application') return null;

    var gddData     = result.gdd || {};
    var effectData  = result.effect || {};
    var accumulated = gddData.accumulated != null ? gddData.accumulated : (result.gddAccumulated || 0);
    var threshold   = gddData.threshold || result.gddThreshold || 280;
    var remaining   = gddData.remaining != null ? gddData.remaining : (threshold - accumulated);
    var avgDaily    = result.avgDailyGDD || gddData.avgDaily || 15;
    var suppression = effectData.suppressionPct != null
      ? effectData.suppressionPct
      : Math.round((effectData.suppression || 0) * 100);

    var pgrState = (global.GAIP_STATE && global.GAIP_STATE.pgr) ? global.GAIP_STATE.pgr : {};
    var product  = pgrState.productType ||
      (result.product && typeof result.product === 'object'
        ? (result.product.name || result.product.code || 'PGR')
        : result.product) ||
      'PGR';

    var pctComplete   = Math.min(100, Math.round((accumulated / threshold) * 100));
    var daysRemaining = avgDaily > 0 ? Math.ceil(remaining / avgDaily) : null;
    var reappStatus   = effectData.reapplicationStatus || '';

    var tier, urgency;
    if (reappStatus === 'expired' || pctComplete >= 100) {
      tier = 'act-on'; urgency = 'act';
    } else if (pctComplete >= 80 || (daysRemaining !== null && daysRemaining <= 2)) {
      tier = 'plan-on'; urgency = 'warn';
    } else if (pctComplete >= 60) {
      tier = 'plan-on'; urgency = 'warn';
    } else {
      tier = 'watch'; urgency = 'ok';
    }

    var confK = _confKey(result.confidence || 'high');

    var actionText = reappStatus === 'expired'
      ? product + ' has expired, reapply now'
      : 'Schedule ' + product + ' reapplication' + (daysRemaining ? ' in ' + daysRemaining + 'd' : '');

    return {
      id: 'pgr',
      tier: tier,
      rnCls: urgency === 'act' ? 'r' : 'a',
      leftUrg: urgency,
      pbMod: 'PGR, ' + product,
      pbAction: actionText,
      sig: suppression + '% suppression',
      sigClass: pctComplete >= 80 ? 'breach' : '',
      thr: 'reapply below 40%',
      thrNote: Math.round(accumulated) + ' of ~' + threshold + ' GDD',
      pressure: daysRemaining
        ? 'Reapplication window closes in ~' + daysRemaining + ' days'
        : 'Monitor GDD accumulation',
      pressureClass: (daysRemaining !== null && daysRemaining <= 2) ? 'hi' : '',
      visual: 'pgr',
      visualData: { accumulated: Math.round(accumulated), threshold: threshold, suppression: suppression, daysRemaining: daysRemaining },
      cALbl: 'Schedule now',
      cA: product + ' application',
      cAC: 'g',
      cRLbl: 'If missed',
      cRisk: 'Growth surge risk',
      cRC: 'a',
      cSlope: (daysRemaining !== null && daysRemaining <= 3) ? 'Cost accrues from missed window' : 'No immediate cost',
      cSlopeClass: 'lo',
      confKey: confK,
      confLabel: _confLabel(confK),
      confImplication: 'Window and rate are confirmed. Schedule on time.',
      confConfirmTxt: '',
      act: product + (daysRemaining ? ', ' + daysRemaining + 'd' : ''),
      sup: suppression + '% suppression' + (daysRemaining ? ', ' + daysRemaining + 'd' : ''),
      metric: daysRemaining ? daysRemaining + 'd' : pctComplete + '%',
      mc: urgency === 'act' ? 'r' : urgency === 'warn' ? 'a' : 'd',
      supHdr: 'Reapply by:',
      supSev: urgency === 'act' ? 'sev-high' : 'sev-med',
      forkActLbl: 'Commit to reapplication',
      forkDeferLbl: 'Defer scheduling',
      forkDeferSub: daysRemaining ? 'window closes in ' + daysRemaining + 'd' : 'growth surge risk',
      forkActDyn: { 'default': 'Commit, window closes ' + (daysRemaining ? 'in ' + daysRemaining + 'd' : 'soon') },
      forkDeferDyn: { 'default': 'Defer (growth surge risk)' },
      deferPenalties: {
        today:    'Later today, window still intact',
        tomorrow: 'Tomorrow, no significant penalty if >2 days remaining',
        week:     'This week, if deferred past window, growth surge likely'
      },
      commitConsequence: 'Suppression maintained. Next reapplication window preserved.',
      clearedMsg: 'PGR programme on track, no reapplication yet needed.',
      svNow: suppression + '% suppression',
      svProj: daysRemaining ? '~' + Math.max(0, suppression - 15) + '% in ' + daysRemaining + 'd' : 'declining',
      svProjColor: urgency !== 'ok' ? 'color:var(--amber)' : 'color:var(--green)',
      svConseq: 'below reapply threshold'
    };
  }

  function _buildIrrigationItem() {
    var result = global.GAIP_IrrigationResults;
    var vwc       = null;
    var nextEvent = null;
    var deficit   = null;

    if (result) {
      vwc       = result.currentVWC || result.vwc || null;
      nextEvent = result.nextIrrigationDepth || result.scheduled || null;
      deficit   = result.deficit || null;
    }
    // Sensor VWC takes priority
    if (global.GAIP_SENSOR_DATA && global.GAIP_SENSOR_DATA.vwc != null) {
      vwc = global.GAIP_SENSOR_DATA.vwc;
    } else if (global.GAIP_Sensor && typeof global.GAIP_Sensor.hasData === 'function' && global.GAIP_Sensor.hasData()) {
      // b35fix237d: GAIP_Sensor (bridge) is the live source — GAIP_SENSOR_DATA is not populated
      var _sd = global.GAIP_Sensor.getIrrigationData();
      if (_sd && _sd.vwc != null) vwc = _sd.vwc;
    }

    var vwcMin = 15, vwcMax = 25;
    var onTrack = vwc != null ? (vwc >= vwcMin && vwc <= vwcMax) : true;
    var tier    = onTrack ? 'watch' : 'plan-on';
    var urgency = tier === 'watch' ? 'ok' : 'warn';
    var vwcStr  = vwc != null ? vwc.toFixed(1) + '%' : '-';

    return {
      id: 'irrigation',
      tier: tier,
      rnCls: '',
      leftUrg: urgency,
      pbMod: 'Irrigation',
      pbAction: onTrack ? 'Programme on track' : 'Review irrigation schedule',
      sig: '',
      sigClass: '',
      thr: '',
      thrNote: '',
      pressure: '',
      pressureClass: 'lo',
      visual: 'irrigation',
      visualData: { vwc: vwc, target: [vwcMin, vwcMax], nextEvent: nextEvent, deficit: deficit },
      cALbl: 'Scheduled',
      cA: nextEvent ? Math.round(nextEvent) + 'mm' : 'On track',
      cAC: 'g',
      cRLbl: 'If off-track',
      cRisk: 'Stress risk: low',
      cRC: 'g',
      cSlope: 'No slope, deficit risk low',
      cSlopeClass: 'lo',
      confKey: vwc != null ? 'usable' : 'estimate',
      confLabel: vwc != null ? 'Usable' : 'Estimate only',
      confImplication: vwc != null ? 'Live VWC from sensor.' : 'No sensor data, add a sensor to improve confidence.',
      confConfirmTxt: '',
      act: onTrack ? 'Irrigation on track' : 'Review schedule',
      sup: 'VWC ' + vwcStr + (nextEvent ? ', ' + Math.round(nextEvent) + 'mm scheduled' : ''),
      metric: nextEvent ? Math.round(nextEvent) + 'mm' : vwcStr,
      mc: onTrack ? 'g' : 'a',
      supHdr: 'Next 3 days:',
      supSev: 'sev-low',
      forkActLbl: '', forkDeferLbl: '',
      deferPenalties: {},
      commitConsequence: 'Programme on track.',
      clearedMsg: 'Irrigation programme on track, no action required.',
      svNow: 'VWC ' + vwcStr,
      svProj: onTrack ? 'on track 3 days' : 'deficit risk',
      svProjColor: onTrack ? 'color:var(--green)' : 'color:var(--amber)',
      svConseq: onTrack ? 'no action needed' : 'review schedule'
    };
  }

  function _buildPreEmergentItem() {
    var result = global.GAIP_PRE_EMERGENT_RESULT;
    if (!result || !result.success) return null;

    // Engine schema:
    //   result.summary.soilTemp5cm — current soil temp
    //   result.results[]  — per-species alerts with:
    //     .alertStatus, .daysToThreshold, .applyAt, .applicationWindowOpen,
    //     .commonName, .confidenceRating, .germinationThreshold, .currentSoilTemp
    var summary = result.summary || {};
    var results = result.results || [];

    // Filter errors and beta-style advisory-only items that don't need herbicide
    var active = results.filter(function (r) {
      return !r.error && r.alertStatus !== 'GREEN' && r.alertStatus !== 'ADVISORY_ONLY';
    });

    // Use highest-priority alert to drive the decision item
    var top = active.length > 0 ? active[0] : null; // sorted by priority in engine

    var soilTemp   = summary.soilTemp5cm != null ? summary.soilTemp5cm : (top && top.currentSoilTemp != null ? top.currentSoilTemp : null);
    var applyAt    = top ? (top.applyAt != null ? top.applyAt : top.germinationThreshold) : 15;
    var daysToWin  = top ? top.daysToThreshold : null;
    var weed       = top ? top.commonName : 'Poa annua';
    var windowOpen = top ? !!top.applicationWindowOpen : false;
    var leadTime   = 5; // standard herbicide lead time (days)

    // Confidence: use per-species rating from highest-priority alert
    var confK = top ? _confKey(top.confidenceRating || 'M') : 'estimate';
    // Downgrade to estimate if soil temp is modelled (not measured)
    if (summary.soilTempSource && summary.soilTempSource !== 'sensor' && summary.soilTempSource !== 'measured') {
      confK = 'estimate';
    }

    var tier, urgency;
    if (windowOpen && active.length > 0) {
      tier = 'act-on'; urgency = 'act';
    } else if (daysToWin != null && daysToWin <= (leadTime + 3)) {
      tier = 'plan-on'; urgency = 'warn';
    } else if (active.length > 0) {
      tier = 'plan-on'; urgency = 'warn';
    } else {
      tier = 'watch'; urgency = 'ok';
    }

    // If no active alerts at all, item is not useful
    if (!top && result.aggregateStatus === 'GREEN') {
      return {
        id: 'preemergent',
        tier: 'watch',
        rnCls: '',
        leftUrg: 'ok',
        pbMod: 'Pre-emergent',
        pbAction: 'All species below threshold, no action required',
        sig: soilTemp != null ? soilTemp.toFixed(1) + '\u00b0C soil' : '-',
        sigClass: 'ok-val',
        thr: 'monitor soil temperature',
        thrNote: '',
        pressure: 'No action needed this period',
        pressureClass: 'lo',
        visual: 'preemergent',
        visualData: { soilTemp: soilTemp, applyAt: 15, daysToWindow: null },
        cALbl: 'Monitoring', cA: 'No action', cAC: 'g',
        cRLbl: 'If missed', cRisk: 'Rescue cost higher', cRC: 'a',
        cSlope: 'Window opens once per season', cSlopeClass: 'lo',
        confKey: confK, confLabel: _confLabel(confK),
        confImplication: 'Conditions not yet at threshold.',
        confConfirmTxt: '',
        act: 'Pre-emergent: clear',
        sup: soilTemp != null ? 'Soil ' + soilTemp.toFixed(1) + '\u00b0C' : 'No alerts',
        metric: soilTemp != null ? soilTemp.toFixed(0) + '\u00b0C' : '-',
        mc: 'd',
        supHdr: 'Application window:',
        supSev: 'sev-low',
        forkActLbl: '', forkDeferLbl: '',
        deferPenalties: {},
        commitConsequence: 'Monitoring continued.',
        clearedMsg: 'All species below threshold, no pre-emergent action required.',
        svNow: soilTemp != null ? soilTemp.toFixed(1) + '\u00b0C' : '-',
        svProj: 'below threshold',
        svProjColor: 'color:var(--green)',
        svConseq: 'no action needed'
      };
    }

    var tempStr = soilTemp != null ? soilTemp.toFixed(1) + '\u00b0C' : '-';

    var actionText = windowOpen
      ? 'Apply pre-emergent now, threshold reached'
      : (daysToWin != null
          ? 'Order product, window in ~' + daysToWin + ' days'
          : 'Monitor soil temperature');

    var confirmTxt = confK === 'estimate'
      ? 'Soil temperature is modelled, not measured. Application window estimate has \u00b11.5\u00b0C uncertainty. Confirm with a physical probe before applying product.'
      : '';

    return {
      id: 'preemergent',
      tier: tier,
      rnCls: urgency === 'act' ? 'r' : '',
      leftUrg: urgency,
      pbMod: 'Pre-emergent, ' + weed,
      pbAction: actionText,
      sig: tempStr + ' soil',
      sigClass: windowOpen ? 'breach' : '',
      thr: 'apply at ' + applyAt + '\u00b0C',
      thrNote: daysToWin != null ? '~' + daysToWin + ' days' : '',
      pressure: daysToWin != null && daysToWin <= (leadTime + 3)
        ? 'Order by ' + leadTime + '-day lead time required'
        : 'Monitor soil temperature',
      pressureClass: tier === 'act-on' ? 'hi' : '',
      visual: 'preemergent',
      visualData: { soilTemp: soilTemp, applyAt: applyAt, daysToWindow: daysToWin },
      cALbl: 'Order now',
      cA: 'Pre-emergent herbicide',
      cAC: 'g',
      cRLbl: 'If window missed',
      cRisk: 'Rescue cost significantly higher',
      cRC: 'a',
      cSlope: 'Window opens once, no second chance this season',
      cSlopeClass: 'hi',
      confKey: confK,
      confLabel: _confLabel(confK),
      confImplication: confK === 'estimate'
        ? 'Soil temp is modelled. Confirm with probe before applying.'
        : 'Soil temp validated. Apply at ' + applyAt + '\u00b0C.',
      confConfirmTxt: confirmTxt,
      act: windowOpen ? 'Apply pre-emergent now' : 'Order pre-emergent',
      sup: 'Soil ' + tempStr + (daysToWin ? ', window ~' + daysToWin + 'd' : ''),
      metric: daysToWin != null ? daysToWin + 'd' : tempStr,
      mc: urgency === 'act' ? 'r' : 'd',
      supHdr: 'Application window:',
      supSev: urgency === 'act' ? 'sev-high' : 'sev-low',
      forkActLbl: 'Commit to ordering pre-emergent',
      forkDeferLbl: 'Defer order',
      forkDeferSub: 'one application window per season',
      forkActDyn: { 'default': 'Commit, one window this season' },
      forkDeferDyn: { 'default': 'Defer (risk: no second window)' },
      deferPenalties: {
        today:    'Later today, no penalty',
        tomorrow: 'Tomorrow, still fine if window > 2 days away',
        week:     'This week, risky if deferred given ' + leadTime + '-day lead time'
      },
      commitConsequence: 'Order committed. Application window secured.',
      clearedMsg: 'Soil temperature below threshold, pre-emergent not yet needed.',
      svNow: tempStr + ' now',
      svProj: daysToWin != null ? applyAt + '\u00b0C in ~' + daysToWin + 'd' : '-',
      svProjColor: tier !== 'watch' ? 'color:var(--amber)' : 'color:var(--ink3)',
      svConseq: 'application window opens'
    };
  }

  // =========================================================================
  // BUILD FROM ENGINES
  // =========================================================================

  function buildFromEngines() {
    var builders = [_buildDiseaseItem, _buildPGRItem, _buildIrrigationItem, _buildPreEmergentItem];
    var items = {};

    builders.forEach(function (fn) {
      var item = fn();
      if (!item) return;
      items[item.id] = item;
      // Seed DISPOSITION only for new keys — never overwrite persisted state
      if (!DISPOSITION[item.id]) {
        DISPOSITION[item.id] = {
          state: item.tier === 'watch' ? 'cleared' : 'pending',
          horizon: null,
          ts: null
        };
      }
    });

    // Scenario counts
    var aKeys = Object.keys(items).filter(function (k) {
      return items[k].tier === 'act-on' || items[k].tier === 'plan-on';
    });
    var wKeys = Object.keys(items).filter(function (k) {
      return items[k].tier === 'watch';
    });

    var actCount  = aKeys.filter(function (k) { return items[k].leftUrg === 'act'; }).length;
    var planCount = aKeys.filter(function (k) { return items[k].leftUrg === 'warn'; }).length;

    var sc = {
      hl:  actCount > 0 ? 'Act on this today' : planCount > 0 ? 'Plan this week' : 'All clear',
      hlC: actCount > 0 ? 'act' : planCount > 0 ? 'warn' : 'ok',
      counts: [
        { n: String(actCount),      nc: actCount > 0 ? 'r' : 'd',  w: 'Today',      id: aKeys.find(function (k) { return items[k].leftUrg === 'act'; }) || null },
        { n: String(planCount),     nc: planCount > 0 ? 'a' : 'd', w: 'This week',  id: aKeys.find(function (k) { return items[k].leftUrg === 'warn'; }) || null },
        { n: String(wKeys.length),  nc: 'd',                       w: 'Watching',   id: null }
      ],
      defSel: aKeys[0] || wKeys[0] || '',
      aKeys: aKeys,
      wKeys: wKeys
    };

    return { items: items, sc: sc };
  }

  // =========================================================================
  // COMMIT / DEFER / UNDO
  // =========================================================================

  function commit(itemId) {
    if (!DISPOSITION[itemId]) return;
    DISPOSITION[itemId].state   = 'committed';
    DISPOSITION[itemId].horizon = null;
    DISPOSITION[itemId].ts      = _now();
    saveDisposition();
  }

  function defer(itemId, horizon) {
    if (!DISPOSITION[itemId]) return;
    DISPOSITION[itemId].state   = 'deferred';
    DISPOSITION[itemId].horizon = horizon;
    DISPOSITION[itemId].ts      = 'deferred ' + horizon + ' at ' + new Date().toTimeString().slice(0, 5);
    saveDisposition();
  }

  function undo(itemId, items) {
    if (!DISPOSITION[itemId]) return;
    var item = items && items[itemId];
    DISPOSITION[itemId].state   = (item && item.tier === 'watch') ? 'cleared' : 'pending';
    DISPOSITION[itemId].horizon = null;
    DISPOSITION[itemId].ts      = null;
    saveDisposition();
  }

  // =========================================================================
  // SCENARIO LOCK
  // =========================================================================

  function getScenarioLock() {
    var sa = _sa();
    if (!sa) return null;
    try { return sa.getItem(STORAGE_KEY_SCENARIO, _getSiteId()); } catch (e) { return null; }
  }

  function setScenarioLock(key) {
    var sa = _sa();
    if (!sa) return;
    try { sa.setItem(STORAGE_KEY_SCENARIO, key, _getSiteId()); } catch (e) { /* silent */ }
  }

  function clearScenarioLock() {
    var sa = _sa();
    if (!sa) return;
    try { sa.removeItem(STORAGE_KEY_SCENARIO, _getSiteId()); } catch (e) { /* silent */ }
  }

  // Returns true when scenario diverges from committed lock for this item
  function checkDivergence(currentScenarioKey, itemId, item) {
    if (!currentScenarioKey || !item) return false;
    var locked = getScenarioLock();
    if (!locked) return false;
    var actDyn      = item.forkActDyn || {};
    var scenarioLbl = actDyn[currentScenarioKey];
    var defaultLbl  = actDyn['default'];
    return !!(scenarioLbl && defaultLbl && scenarioLbl !== defaultLbl);
  }

  // =========================================================================
  // RESOLUTION PRESSURE
  // =========================================================================

  function resolutionPressure(sc) {
    if (!sc) return 0;
    return (sc.aKeys || []).filter(function (k) {
      return DISPOSITION[k] && DISPOSITION[k].state === 'pending';
    }).length;
  }

  // =========================================================================
  // INIT
  // =========================================================================

  function init() {
    loadDisposition();
    document.addEventListener('gaip:site-changed', onSiteSwitch);
    document.addEventListener('gaip:site-switch',  onSiteSwitch);
  }

  // =========================================================================
  // EXPORT
  // =========================================================================

  global.GilbaDSM = {
    VERSION: VERSION,
    get DISPOSITION() { return DISPOSITION; },
    init: init,
    buildFromEngines: buildFromEngines,
    commit: commit,
    defer: defer,
    undo: undo,
    resolutionPressure: resolutionPressure,
    checkDivergence: checkDivergence,
    setScenarioLock: setScenarioLock,
    clearScenarioLock: clearScenarioLock,
    onSiteSwitch: onSiteSwitch,
    // Slot for UI to attach onEngineUpdate callback
    _ui: null
  };

  // Auto-init on DOMContentLoaded
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

}(window));
