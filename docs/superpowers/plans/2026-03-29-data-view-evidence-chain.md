# Data View Evidence Chain — Implementation Plan

**Goal:** Add a tabbed Evidence view to the decision panel showing Soil / Water / Tissue / Spray log panels with chain-of-confidence callouts that explain how data quality affects decision confidence.

**Architecture:** New file `gaip-evidence-ui.js` reads from existing globals (`GAIP_STATE`, `GAIP_CANONICAL_STATE`, sprayContext). New file `gaip-evidence.css` provides styles matching v21 spec. PHP injects a `#gaip-evidence-panel` container div and enqueues both files. No changes to engines or orchestrator.

**Tech Stack:** Vanilla JS, CSS, existing StorageAdapter for no new storage needs.

---

## Data Sources (read-only)

| Panel | Global | Key fields |
|-------|--------|-----------|
| Soil | `GAIP_STATE.soil` | `ppm{}`, `methodology`, `labName`, `sampleDate` |
| Soil result | `GAIP_CANONICAL_STATE` cascade output | parsed from DOM `.gaip-mlsn-body` |
| Water | `GAIP_STATE.water` | `EC`, `SAR`, `pH`, `Na`, `HCO3`, `labName`, `sampleDate` |
| Tissue | `GAIP_CANONICAL_STATE.tissue` | `N`, `P`, `K`, `Ca`, `nitrogenStatus`, `sampleDate` |
| Spray | `GAIP_STATE.sprayContext` | `warnings[]`, `entries[]`, `lastFungicide{}`, `fracGroup` |
| Confidence | `GAIP_CANONICAL_STATE.quality` | `overall`, `issues[]` |

---

## Task 1: CSS — gaip-evidence.css

**Files:**
- Create: `assets/gaip-evidence.css`

- [ ] **Step 1: Create CSS file with v21 tokens**

```css
/* gaip-evidence.css — b35fix229 */
/* Uses hub palette vars — no dark-mode vars */

#gaip-evidence-panel {
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 6px;
  margin-bottom: 16px;
  overflow: hidden;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
}

/* ── Status bar ── */
.gev-status { display:flex; align-items:center; justify-content:space-between;
  padding:6px 14px; border-bottom:1px solid #e5e7eb; background:#f9fafb;
  flex-shrink:0; font-size:11px; }
.gev-status-left { display:flex; align-items:center; gap:6px; }
.gev-status-title { font-weight:600; color:#111; }
.gev-badge { padding:1px 7px; border-radius:3px; font-size:10px; font-weight:500; }
.gev-badge.ok   { background:#e8f5ee; color:#1d5535; }
.gev-badge.warn { background:#fffbeb; color:#d97706; }
.gev-badge.act  { background:#fef2f2; color:#dc2626; }
.gev-status-right { font-size:10px; color:#9ca3af; }

/* ── Inner layout ── */
.gev-inner { display:flex; min-height:280px; }

/* ── Nav ── */
.gev-nav { width:160px; border-right:1px solid #e5e7eb; flex-shrink:0;
  display:flex; flex-direction:column; padding:6px; gap:2px; background:#f9fafb; }
.gev-dni { padding:7px 10px; border-radius:4px; cursor:pointer;
  border:1px solid transparent; transition:background .1s; }
.gev-dni:hover { background:#f3f4f6; }
.gev-dni.on { background:#fff; border-color:#e5e7eb; }
.gev-dni-label { font-size:11px; font-weight:500; color:#374151; margin-bottom:3px; }
.gev-dni.on .gev-dni-label { color:#111; }
.gev-dni-evidence { font-size:10px; font-weight:300; line-height:1.3; color:#9ca3af; }
.gev-dni-evidence.ok   { color:#2d7a4f; }
.gev-dni-evidence.warn { color:#d97706; }
.gev-dni-evidence.act  { color:#dc2626; }

/* ── Pane ── */
.gev-pane { display:none; flex:1; flex-direction:column; overflow:hidden; }
.gev-pane.on { display:flex; }
.gev-dp-head { padding:10px 16px 8px; border-bottom:1px solid #e5e7eb;
  flex-shrink:0; display:flex; align-items:flex-end; justify-content:space-between; }
.gev-dp-title { font-size:14px; font-weight:300; color:#111; }
.gev-dp-sub { font-size:10px; color:#9ca3af; margin-top:2px; }
.gev-dp-body { flex:1; overflow-y:auto; padding:12px 16px; }

/* ── Callout ── */
.gev-callout { background:#f9fafb; border:1px solid #e5e7eb; border-radius:4px;
  padding:9px 11px; margin-bottom:12px; display:flex; align-items:center; gap:9px; }
.gev-callout-icon { width:26px; height:26px; border-radius:3px; flex-shrink:0;
  display:flex; align-items:center; justify-content:center; font-size:10px; font-weight:600; }
.gev-callout-icon.ok   { background:#e8f5ee; color:#2d7a4f; }
.gev-callout-icon.warn { background:#fffbeb; color:#d97706; }
.gev-callout-icon.act  { background:#fef2f2; color:#dc2626; }
.gev-callout-title { font-size:11px; font-weight:500; color:#111; margin-bottom:4px; }
.gev-chain { display:flex; align-items:center; gap:5px; font-size:10px; flex-wrap:wrap; }
.gev-chain-node { color:#6b7280; }
.gev-chain-node.ok   { color:#2d7a4f; }
.gev-chain-node.warn { color:#d97706; }
.gev-chain-node.act  { color:#dc2626; }
.gev-chain-arr { color:#d1d5db; font-size:10px; }

/* ── Record card ── */
.gev-rec { background:#f9fafb; border:1px solid #e5e7eb; border-radius:4px;
  overflow:hidden; margin-bottom:8px; }
.gev-rec-hd { padding:6px 11px; border-bottom:1px solid #e5e7eb;
  display:flex; align-items:center; justify-content:space-between; gap:8px; background:#f3f4f6; }
.gev-rec-title { font-size:11px; font-weight:500; color:#374151; }
.gev-rec-sub { font-size:10px; color:#9ca3af; }
.gev-rec-body { padding:10px 12px; }
.gev-rec-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(80px,1fr)); gap:8px; }
.gev-rec-field { }
.gev-rec-lbl { font-size:9px; color:#9ca3af; margin-bottom:2px; }
.gev-rec-val { font-size:13px; font-weight:500; color:#111; font-family:ui-monospace,monospace; }
.gev-rec-val.ok   { color:#2d7a4f; }
.gev-rec-val.warn { color:#d97706; }
.gev-rec-val.act  { color:#dc2626; }
.gev-rec-val.n    { color:#9ca3af; }

/* ── Spray table ── */
.gev-spray-tbl { width:100%; border-collapse:collapse; font-size:11px; }
.gev-spray-tbl th { padding:5px 8px; text-align:left; color:#9ca3af;
  border-bottom:1px solid #e5e7eb; font-weight:400; font-size:10px; }
.gev-spray-tbl td { padding:5px 8px; border-bottom:1px solid #f3f4f6; color:#374151; }
.gev-frac-badge { display:inline-block; padding:1px 5px; border-radius:2px;
  font-size:9px; font-weight:500; }
.gev-frac-badge.ok   { background:#e8f5ee; color:#2d7a4f; }
.gev-frac-badge.warn { background:#fffbeb; color:#d97706; }
.gev-frac-badge.act  { background:#fef2f2; color:#dc2626; }

/* ── No data state ── */
.gev-empty { padding:24px 16px; text-align:center; color:#9ca3af; font-size:11px; }
```

---

## Task 2: JS — gaip-evidence-ui.js

**Files:**
- Create: `assets/gaip-evidence-ui.js`

- [ ] **Step 1: Create the file with IIFE, globals, and scaffold builder**

```javascript
/**
 * gaip-evidence-ui.js — GAIP Evidence View
 * b35fix229
 *
 * Renders the Evidence panel: Soil / Water / Tissue / Spray log
 * with chain-of-confidence callouts linking data quality to decisions.
 *
 * Reads from (all read-only):
 *   window.GAIP_STATE           — soil, water, tissue, sprayContext
 *   window.GAIP_CANONICAL_STATE — tissue, quality
 *   window.GAIP_DISEASE_RESULT  — nStatus (N modifier used by disease engine)
 *
 * Triggered by: gaip:orchestrator-complete event
 * Container:    #gaip-evidence-panel (injected by PHP shortcode)
 */
;(function (global) {
  'use strict';

  var _container = null;
  var _activePane = 'soil';

  // ── Helpers ──────────────────────────────────────────────────────────────

  function _esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g,'&amp;').replace(/</g,'&lt;')
      .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  function _chain(nodes) {
    // nodes: [{text, cls}]
    return nodes.map(function(n, i) {
      var arrow = i < nodes.length - 1
        ? '<span class="gev-chain-arr">&#8594;</span>' : '';
      return '<span class="gev-chain-node ' + (n.cls||'') + '">' +
        _esc(n.text) + '</span>' + arrow;
    }).join('');
  }

  function _callout(cls, iconText, title, chainNodes) {
    return '<div class="gev-callout">'
      + '<div class="gev-callout-icon ' + cls + '">' + _esc(iconText) + '</div>'
      + '<div><div class="gev-callout-title">' + _esc(title) + '</div>'
      + '<div class="gev-chain">' + _chain(chainNodes) + '</div>'
      + '</div></div>';
  }

  function _recCard(title, sub, fields) {
    // fields: [{label, value, cls}]
    var grid = fields.map(function(f) {
      return '<div class="gev-rec-field">'
        + '<div class="gev-rec-lbl">' + _esc(f.label) + '</div>'
        + '<div class="gev-rec-val ' + (f.cls||'') + '">' + _esc(f.value) + '</div>'
        + '</div>';
    }).join('');
    return '<div class="gev-rec">'
      + '<div class="gev-rec-hd"><div class="gev-rec-title">' + _esc(title) + '</div>'
      + (sub ? '<div class="gev-rec-sub">' + _esc(sub) + '</div>' : '')
      + '</div>'
      + '<div class="gev-rec-body"><div class="gev-rec-grid">' + grid + '</div></div>'
      + '</div>';
  }

  // ── Data readers ─────────────────────────────────────────────────────────

  function _getSoilData() {
    var state = global.GAIP_STATE || {};
    var soil = state.soil || {};
    var ppm = soil.ppm || {};
    // MLSN minimums (standard turf greens, g/kg soil converted to ppm)
    var MLSN = { K:37, P:6, Ca:331, Mg:47, S:6.9, Fe:0, Mn:0, Zn:0, Cu:0, B:0 };
    var nutrients = ['K','P','Ca','Mg','S','Fe','Mn','Zn','Cu','B'];
    var fields = [];
    var anyDeficient = false;
    nutrients.forEach(function(n) {
      var val = ppm[n];
      if (val == null) return;
      var min = MLSN[n] || 0;
      var cls = min > 0 ? (val >= min ? 'ok' : 'act') : 'n';
      if (cls === 'act') anyDeficient = true;
      fields.push({ label: n + (min ? ' \u2022 min ' + min : ''), value: val, cls: cls });
    });
    return {
      labName:    soil.labName || null,
      sampleDate: soil.sampleDate || null,
      fields:     fields,
      anyDeficient: anyDeficient,
      hasSamples: fields.length > 0
    };
  }

  function _getWaterData() {
    var state = global.GAIP_STATE || {};
    var water = state.water || {};
    // Salinity thresholds: EC <1.5 ok, SAR <10 ok
    var EC  = water.EC  != null ? parseFloat(water.EC)  : null;
    var SAR = water.SAR != null ? parseFloat(water.SAR) : null;
    var pH  = water.pH  != null ? parseFloat(water.pH)  : null;
    var Na  = water.Na  != null ? parseFloat(water.Na)  : null;
    var HCO3 = water.HCO3 != null ? parseFloat(water.HCO3) : null;
    var ecCls  = EC  == null ? 'n' : EC  < 1.5 ? 'ok' : EC  < 3.0 ? 'warn' : 'act';
    var sarCls = SAR == null ? 'n' : SAR < 10  ? 'ok' : SAR < 15  ? 'warn' : 'act';
    var salinityIssue = ecCls === 'act' || sarCls === 'act';
    var salinityWarn  = ecCls === 'warn' || sarCls === 'warn';
    var fields = [];
    if (EC  != null) fields.push({ label:'EC (dS/m)', value:EC.toFixed(2),  cls:ecCls });
    if (SAR != null) fields.push({ label:'SAR',        value:SAR.toFixed(1), cls:sarCls });
    if (pH  != null) fields.push({ label:'pH',         value:pH.toFixed(1),  cls:'n' });
    if (Na  != null) fields.push({ label:'Na (ppm)',    value:Na,             cls:'n' });
    if (HCO3!= null) fields.push({ label:'HCO\u2083 (ppm)', value:HCO3,     cls:'n' });
    return {
      labName: water.labName || null,
      sampleDate: water.sampleDate || null,
      EC:EC, SAR:SAR, fields:fields,
      salinityIssue:salinityIssue, salinityWarn:salinityWarn,
      hasSamples: fields.length > 0
    };
  }

  function _getTissueData() {
    var ct = (global.GAIP_CANONICAL_STATE || {}).tissue || {};
    var state = global.GAIP_STATE || {};
    var tissue = ct || state.tissue || {};
    // N status from disease engine (most authoritative)
    var diseaseResult = global.GAIP_DISEASE_RESULT || {};
    var nStatus = diseaseResult.nStatus || tissue.nitrogenStatus || 'unknown';
    var nDeficient  = nStatus === 'deficient';
    var nAdequate   = nStatus === 'adequate' || nStatus === 'high';
    var nEstimated  = !tissue.sampleDate;
    var N  = tissue.N  != null ? parseFloat(tissue.N)  : null;
    var P  = tissue.P  != null ? parseFloat(tissue.P)  : null;
    var K  = tissue.K  != null ? parseFloat(tissue.K)  : null;
    var Ca = tissue.Ca != null ? parseFloat(tissue.Ca) : null;
    var fields = [];
    if (N  != null) fields.push({ label:'N (%)',  value:N.toFixed(2),  cls: nDeficient ? 'act' : nAdequate ? 'ok' : 'warn' });
    if (P  != null) fields.push({ label:'P (%)',  value:P.toFixed(2),  cls:'n' });
    if (K  != null) fields.push({ label:'K (%)',  value:K.toFixed(2),  cls:'n' });
    if (Ca != null) fields.push({ label:'Ca (%)', value:Ca.toFixed(2), cls:'n' });
    return {
      sampleDate: tissue.sampleDate || null,
      labName: tissue.labName || null,
      nStatus:nStatus, nEstimated:nEstimated,
      nDeficient:nDeficient, nAdequate:nAdequate,
      fields:fields, hasSamples: fields.length > 0
    };
  }

  function _getSprayData() {
    var state = global.GAIP_STATE || {};
    var ctx = state.sprayContext || null;
    if (!ctx) return { hasEntries:false, warnings:[], entries:[] };
    var warnings = ctx.warnings || [];
    var entries  = ctx.entries  || [];
    var consecutive = warnings.filter(function(w) {
      return w.type === 'consecutive_frac';
    });
    return {
      hasEntries: entries.length > 0,
      entries: entries,
      warnings: warnings,
      consecutiveFrac: consecutive,
      hasFracAlert: consecutive.length > 0
    };
  }

  // ── Nav item evidence summary ─────────────────────────────────────────────

  function _navItems() {
    var soil    = _getSoilData();
    var water   = _getWaterData();
    var tissue  = _getTissueData();
    var spray   = _getSprayData();

    var soilCls = soil.anyDeficient ? 'act' : soil.hasSamples ? 'ok' : '';
    var soilTxt = soil.anyDeficient ? 'Deficiency flagged'
                : soil.hasSamples  ? 'Not limiting' : 'No soil data';

    var waterCls = water.salinityIssue ? 'act'
                 : water.salinityWarn  ? 'warn'
                 : water.hasSamples    ? 'ok' : '';
    var waterTxt = water.salinityIssue ? 'Salinity \u2014 check programme'
                 : water.salinityWarn  ? 'Salinity borderline'
                 : water.hasSamples    ? 'Not limiting' : 'No water data';

    var tissueCls = tissue.nEstimated ? 'warn'
                  : tissue.nDeficient ? 'act'
                  : tissue.hasSamples ? 'ok' : '';
    var tissueTxt = tissue.nEstimated ? 'N estimated \u2192 confidence limited'
                  : tissue.nDeficient ? 'N deficient \u2192 disease risk elevated'
                  : tissue.hasSamples ? 'N adequate' : 'No tissue data';

    var sprayCls = spray.hasFracAlert ? 'act' : spray.hasEntries ? 'ok' : '';
    var sprayTxt = spray.hasFracAlert
      ? 'FRAC ' + spray.consecutiveFrac[0].fracGroup + ' \u00d7' +
        spray.consecutiveFrac[0].count + ' \u2192 rotation required'
      : spray.hasEntries ? 'Rotation on track' : 'No spray entries';

    return [
      { id:'soil',    label:'Soil',      cls:soilCls,    txt:soilTxt },
      { id:'water',   label:'Water',     cls:waterCls,   txt:waterTxt },
      { id:'tissue',  label:'Tissue',    cls:tissueCls,  txt:tissueTxt },
      { id:'spray',   label:'Spray log', cls:sprayCls,   txt:sprayTxt },
    ];
  }

  // ── Status bar ────────────────────────────────────────────────────────────

  function _buildStatusBar(navItems) {
    var badges = navItems.filter(function(n) {
      return n.cls === 'warn' || n.cls === 'act';
    }).map(function(n) {
      return '<span class="gev-badge ' + n.cls + '">' + _esc(n.txt) + '</span>';
    }).join('');
    if (!badges) badges = '<span class="gev-badge ok">All data OK</span>';
    return '<div class="gev-status">'
      + '<div class="gev-status-left"><span class="gev-status-title">Evidence</span>'
      + badges + '</div>'
      + '</div>';
  }

  // ── Pane builders ─────────────────────────────────────────────────────────

  function _buildSoilPane() {
    var d = _getSoilData();
    var dateLine = d.labName && d.sampleDate
      ? d.labName + ' \u2022 ' + d.sampleDate + ' \u2022 MLSN' : '';
    var callout;
    if (!d.hasSamples) {
      callout = _callout('warn', '?', 'No soil test loaded',
        [{text:'No data',cls:'warn'},{text:'soil constraint unknown',cls:'warn'},
         {text:'import a result to improve confidence',cls:'warn'}]);
    } else if (d.anyDeficient) {
      callout = _callout('act', '!', 'Nutrient deficiency flagged',
        [{text:'Below MLSN minimum',cls:'act'},{text:'growth constraint possible',cls:'warn'},
         {text:'review fertiliser programme',cls:'act'}]);
    } else {
      callout = _callout('ok', 'OK', 'Soil is fine \u2014 nothing to act on',
        [{text:'All nutrients within MLSN range',cls:'ok'},
         {text:'no soil constraint',cls:''},
         {text:'Decisions unaffected',cls:'ok'}]);
    }
    var card = d.hasSamples
      ? _recCard('Nutrients (ppm)', d.sampleDate || '', d.fields) : '';
    return '<div class="gev-pane' + (_activePane==='soil'?' on':'') + '" data-gev-pane="soil">'
      + '<div class="gev-dp-head"><div>'
      + '<div class="gev-dp-title">Soil test</div>'
      + '<div class="gev-dp-sub">' + _esc(dateLine) + '</div>'
      + '</div></div>'
      + '<div class="gev-dp-body">' + callout + card + '</div>'
      + '</div>';
  }

  function _buildWaterPane() {
    var d = _getWaterData();
    var dateLine = d.labName && d.sampleDate ? d.labName + ' \u2022 ' + d.sampleDate : '';
    var callout;
    if (!d.hasSamples) {
      callout = _callout('warn','?','No water test loaded',
        [{text:'No data',cls:'warn'},{text:'salinity unknown',cls:'warn'},
         {text:'import a result',cls:'warn'}]);
    } else if (d.salinityIssue) {
      callout = _callout('act','!','Salinity \u2014 review irrigation programme',
        [{text:'EC or SAR above threshold',cls:'act'},{text:'soil structure risk',cls:'act'},
         {text:'leaching fraction required',cls:'act'}]);
    } else if (d.salinityWarn) {
      callout = _callout('warn','!','Salinity borderline \u2014 monitor',
        [{text:'EC/SAR approaching limits',cls:'warn'},{text:'watch trend',cls:'warn'},
         {text:'no immediate action',cls:''}]);
    } else {
      callout = _callout('ok','OK','Water quality fine',
        [{text: d.EC!=null?'SAR '+d.SAR+', EC '+d.EC:'Salinity checked',cls:'ok'},
         {text:'no salinity penalty',cls:''},
         {text:'Decisions unaffected',cls:'ok'}]);
    }
    var card = d.hasSamples
      ? _recCard('Salinity & sodicity', dateLine, d.fields) : '';
    return '<div class="gev-pane' + (_activePane==='water'?' on':'') + '" data-gev-pane="water">'
      + '<div class="gev-dp-head"><div>'
      + '<div class="gev-dp-title">Water test</div>'
      + '<div class="gev-dp-sub">' + _esc(dateLine) + '</div>'
      + '</div></div>'
      + '<div class="gev-dp-body">' + callout + card + '</div>'
      + '</div>';
  }

  function _buildTissuePane() {
    var d = _getTissueData();
    var dateLine = d.labName && d.sampleDate ? d.labName + ' \u2022 ' + d.sampleDate : '';
    var callout;
    if (d.nEstimated) {
      callout = _callout('warn','!','Tissue test overdue',
        [{text:'N estimated from programme',cls:'warn'},
         {text:'host susceptibility uncertain',cls:'warn'},
         {text:'disease confidence: Usable only',cls:'warn'}]);
    } else if (d.nDeficient) {
      callout = _callout('act','!','N deficiency \u2014 disease risk elevated',
        [{text:'Tissue N below adequate',cls:'act'},
         {text:'host susceptibility higher',cls:'act'},
         {text:'disease risk modifier applied',cls:'act'}]);
    } else {
      callout = _callout('ok','OK','Tissue N adequate',
        [{text:'N status confirmed',cls:'ok'},
         {text:'disease susceptibility normal',cls:''},
         {text:'Decisions unaffected',cls:'ok'}]);
    }
    var card = d.hasSamples
      ? _recCard('Macronutrients (% DW)', dateLine, d.fields) : '';
    return '<div class="gev-pane' + (_activePane==='tissue'?' on':'') + '" data-gev-pane="tissue">'
      + '<div class="gev-dp-head"><div>'
      + '<div class="gev-dp-title">Tissue test</div>'
      + '<div class="gev-dp-sub">' + _esc(dateLine) + '</div>'
      + '</div></div>'
      + '<div class="gev-dp-body">' + callout + card + '</div>'
      + '</div>';
  }

  function _buildSprayPane() {
    var d = _getSprayData();
    var callout;
    if (!d.hasEntries) {
      callout = _callout('warn','?','No spray entries logged',
        [{text:'No fungicide history',cls:'warn'},
         {text:'FRAC rotation unknown',cls:'warn'},
         {text:'log applications to track resistance risk',cls:'warn'}]);
    } else if (d.hasFracAlert) {
      var cf = d.consecutiveFrac[0];
      callout = _callout('act','!','FRAC ' + cf.fracGroup + ' used ' + cf.count + ' times in a row',
        [{text:'FRAC '+cf.fracGroup+' \u00d7'+cf.count+' consecutive',cls:'act'},
         {text:'rotation rule triggered',cls:'act'},
         {text:'Disease is top priority today',cls:'act'}]);
    } else {
      callout = _callout('ok','OK','Rotation on track',
        [{text:'No consecutive FRAC issues',cls:'ok'},
         {text:'resistance risk low',cls:''},
         {text:'continue programme',cls:'ok'}]);
    }
    // Spray table
    var tableHtml = '';
    if (d.hasEntries) {
      var rows = d.entries.slice(0,10).map(function(e) {
        var fracCls = d.consecutiveFrac.some(function(c){
          return String(e.frac_group||'').indexOf(c.fracGroup) >= 0 && c.count >= 2;
        }) ? 'act' : '';
        return '<tr>'
          + '<td>' + _esc(e.application_date||'') + '</td>'
          + '<td>' + _esc(e.product_name||'') + '</td>'
          + '<td>' + _esc(e.zone||'') + '</td>'
          + '<td>' + _esc((e.rate||'') + (e.rate_unit?' '+e.rate_unit:'')) + '</td>'
          + '<td><span class="gev-frac-badge ' + fracCls + '">FRAC ' + _esc(e.frac_group||'?') + '</span></td>'
          + '</tr>';
      }).join('');
      tableHtml = '<div class="gev-rec"><div class="gev-rec-hd">'
        + '<div class="gev-rec-title">Application history</div>'
        + '<div class="gev-rec-sub">' + d.entries.length + ' entries</div>'
        + '</div><div class="gev-rec-body" style="padding:0">'
        + '<table class="gev-spray-tbl"><thead><tr>'
        + '<th>Date</th><th>Product</th><th>Zone</th><th>Rate</th><th>Group</th>'
        + '</tr></thead><tbody>' + rows + '</tbody></table>'
        + '</div></div>';
    }
    return '<div class="gev-pane' + (_activePane==='spray'?' on':'') + '" data-gev-pane="spray">'
      + '<div class="gev-dp-head"><div>'
      + '<div class="gev-dp-title">Spray log</div>'
      + '<div class="gev-dp-sub">Last 90 days</div>'
      + '</div></div>'
      + '<div class="gev-dp-body">' + callout + tableHtml + '</div>'
      + '</div>';
  }

  // ── Full render ───────────────────────────────────────────────────────────

  function _render() {
    var panel = document.getElementById('gaip-evidence-panel');
    if (!panel) return;

    var navItems = _navItems();

    var navHtml = navItems.map(function(n) {
      var sel = n.id === _activePane ? ' on' : '';
      return '<div class="gev-dni' + sel + '" data-gev-nav="' + n.id + '">'
        + '<div class="gev-dni-label">' + _esc(n.label) + '</div>'
        + '<div class="gev-dni-evidence ' + n.cls + '">' + _esc(n.txt) + '</div>'
        + '</div>';
    }).join('');

    var html = _buildStatusBar(navItems)
      + '<div class="gev-inner">'
      + '<div class="gev-nav">' + navHtml + '</div>'
      + '<div class="gev-main">'
      + _buildSoilPane()
      + _buildWaterPane()
      + _buildTissuePane()
      + _buildSprayPane()
      + '</div></div>';

    panel.innerHTML = html;

    // Wire nav clicks
    panel.querySelectorAll('[data-gev-nav]').forEach(function(el) {
      el.addEventListener('click', function() {
        _activePane = el.getAttribute('data-gev-nav');
        _render();
      });
    });
  }

  // ── Init ─────────────────────────────────────────────────────────────────

  function init() {
    document.addEventListener('gaip:orchestrator-complete', function() {
      setTimeout(_render, 150);
    });
    document.addEventListener('gaip:site-changed', function() {
      setTimeout(_render, 300);
    });
    // Render immediately if already populated
    if (global.GAIP_STATE) setTimeout(_render, 200);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  global.GilbaEvidenceUI = { refresh: _render };

})(window);
```

---

## Task 3: PHP — inject container + enqueue

**Files:**
- Modify: `gilba-agronomic-intelligence-hub.php`

- [ ] **Step 1: Add container div to shortcode output**

Find the existing `#gaip-decision-panel` injection and add evidence panel after it:

```php
// After: echo '<div id="gaip-decision-panel"></div>';
echo '<div id="gaip-evidence-panel"></div>';
```

- [ ] **Step 2: Enqueue CSS and JS**

In the GAIP enqueue block (after `gaip-decision-ui`):

```php
wp_enqueue_style(
    'gaip-evidence-css',
    plugin_dir_url(__FILE__) . 'assets/gaip-evidence.css',
    ['gaip-hub-css'],
    GILBA_HUB_VERSION
);
wp_enqueue_script(
    'gaip-evidence-ui',
    plugin_dir_url(__FILE__) . 'assets/gaip-evidence-ui.js',
    ['gaip-hub-js', 'gaip-decision-engine'],
    GILBA_HUB_VERSION,
    true
);
```

---

## Task 4: Confirm in production log

After deploy:
- No JS errors from `gaip-evidence-ui.js`
- Evidence panel renders below decision panel on Federal Golf Club
- Nav switches between Soil / Water / Tissue / Spray panes
- Callout status matches engine output (soil OK, tissue N status, FRAC warnings)
