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
 * Triggered by: gaip:orchestrator-complete, gaip:site-changed
 * Container:    #gaip-evidence-panel (PHP shortcode)
 */
;(function (global) {
  'use strict';

  var _activePane = 'soil';

  // ── Helpers ──────────────────────────────────────────────────────────────

  function _esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g,'&amp;').replace(/</g,'&lt;')
      .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  function _chain(nodes) {
    return nodes.map(function(n, i) {
      var arrow = i < nodes.length - 1
        ? '<span class="gev-chain-arr">&#8594;</span>' : '';
      return '<span class="gev-chain-node ' + (n.cls||'') + '">'
        + _esc(n.text) + '</span>' + arrow;
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
    var grid = fields.map(function(f) {
      return '<div class="gev-rec-field">'
        + '<div class="gev-rec-lbl">' + _esc(f.label) + '</div>'
        + '<div class="gev-rec-val ' + (f.cls||'') + '">' + _esc(f.value) + '</div>'
        + '</div>';
    }).join('');
    return '<div class="gev-rec">'
      + '<div class="gev-rec-hd">'
      + '<div class="gev-rec-title">' + _esc(title) + '</div>'
      + (sub ? '<div class="gev-rec-sub">' + _esc(sub) + '</div>' : '')
      + '</div>'
      + '<div class="gev-rec-body"><div class="gev-rec-grid">' + grid + '</div></div>'
      + '</div>';
  }

  // ── Data readers ─────────────────────────────────────────────────────────

  function _getSoilData() {
    // b35fix229b: Read from GAIP_STATE.mlsnResults — methodology-correct
    // engine output (SLAN/MLSN/AA). No threshold recalculation here.
    var state     = global.GAIP_STATE || {};
    var SM        = global.GAIP_SampleManager;
    var results   = state.mlsnResults;
    var stateSoil = state.soil || {};
    // Read methodology from rendered cards first (most reliable after render),
    // then fall back to DOM selector, then GAIP_STATE
    var firstCard = document.querySelector('.gaip-diagnostic-card.mlsn-card');
    var cardMeth = firstCard ? firstCard.getAttribute('data-methodology') : null;
    var methodEl = document.querySelector('.gaip-soil-methodology');
    var methodRaw = cardMeth || (methodEl ? methodEl.value : (stateSoil.methodology || 'mlsn'));
    var METH_LABELS = { slan:'SLAN', mlsn:'MLSN', ammonium_acetate:'Ammonium Acetate',
      SLAN:'SLAN', MLSN:'MLSN' };
    var methodology = METH_LABELS[methodRaw] || methodRaw.toUpperCase();
    var allSamples  = SM && typeof SM.getSamples === 'function'
      ? SM.getSamples('soil') : {};
    var sampleCount = Object.keys(allSamples || {}).length;
    var active = SM && typeof SM.getActiveSample === 'function'
      ? SM.getActiveSample('soil') : null;
    var hasSamples  = sampleCount > 0 || active != null ||
      document.querySelector('.gaip-mlsn-table') != null;
    // Read from rendered MLSN/SLAN table in DOM — mlsnEngine renders HTML,
    // no structured array is exported globally. Table rows have status- classes.
    var fields = [];
    var anyDeficient = false;
    // Read from progressive disclosure cards (.gaip-diagnostic-card.mlsn-card)
    // Each card: data-nutrient="K", .gaip-value spans (first=actual, second=range),
    // .gaip-status-badge with class status-deficient|adequate|high
    var cards = document.querySelectorAll('.gaip-diagnostic-card.mlsn-card');
    if (!cards || cards.length === 0) {
      // Fallback: legacy table (non-progressive-disclosure render)
      var mlsnTable = document.querySelector('.gaip-mlsn-body table, .gaip-mlsn-table');
      if (mlsnTable) {
        var rows = mlsnTable.querySelectorAll('tr[class*="status-"], tbody tr');
        rows.forEach(function(row) {
          var cells = row.querySelectorAll('td');
          if (cells.length < 2) return;
          var nutrient = cells[0] ? cells[0].textContent.trim() : '';
          var actual   = cells[1] ? cells[1].textContent.trim() : '';
          var range    = cells[2] ? cells[2].textContent.trim() : '';
          if (!nutrient || !actual || actual === '0' || actual === '0.0') return;
          var badge = row.querySelector('.status-badge,.gaip-status-badge');
          var cls = row.classList.contains('status-deficient') ? 'act'
                  : row.classList.contains('status-high')      ? 'warn'
                  : row.classList.contains('status-adequate')  ? 'ok' : 'n';
          if (cls === 'n' && badge) {
            var st = badge.textContent.trim().toLowerCase();
            cls = (st==='low'||st==='deficient') ? 'act' : st==='high' ? 'warn' : st==='sufficient'||st==='adequate' ? 'ok' : 'n';
          }
          if (cls === 'act') anyDeficient = true;
          fields.push({ label: nutrient + (range ? ' \u2022 ' + range : ''), value: actual, cls: cls });
        });
      }
    } else {
      cards.forEach(function(card) {
        var nutrient = card.getAttribute('data-nutrient') || '';
        var vals = card.querySelectorAll('.gaip-value');
        var actual = vals[0] ? vals[0].textContent.replace('ppm','').trim() : '';
        var range  = vals[1] ? vals[1].textContent.replace('ppm','').trim() : '';
        if (!nutrient || !actual || actual === '0' || actual === '0.0') return;
        var badge = card.querySelector('.gaip-status-badge');
        var cls = 'n';
        if (badge) {
          if (badge.classList.contains('status-deficient')) { cls = 'act'; anyDeficient = true; }
          else if (badge.classList.contains('status-high'))     { cls = 'warn'; }
          else if (badge.classList.contains('status-adequate')) { cls = 'ok'; }
        }
        fields.push({ label: nutrient + (range ? ' \u2022 ' + range : ''), value: actual, cls: cls });
      });
    }
    return {
      labName:      active ? (active.label || active.id) : null,
      sampleDate:   active ? active.date : null,
      sampleCount:  sampleCount,
      methodology:  methodology,
      fields:       fields,
      anyDeficient: anyDeficient,
      hasSamples:   hasSamples
    };
  }

  function _getWaterData() {
    // b35fix229b: Use salinityPenalty (engine output) for status and ECw.
    // Use active water sample normalized data for raw ion values.
    // GAIP_STATE.water.SAR/EC are unreliable — prefer sample.normalized.
    var SM = global.GAIP_SampleManager;
    var sample = SM && typeof SM.getActiveSample === 'function'
      ? SM.getActiveSample('water') : null;
    var norm   = (sample && sample.normalized) ? sample.normalized : {};
    var state  = global.GAIP_STATE || {};
    var water  = state.water || {};
    var sp     = state.salinityPenalty || null; // engine-computed salinity status
    // EC: salinityPenalty.ecw is most reliable (from water engine)
    var EC   = sp && sp.ecw != null ? parseFloat(sp.ecw)
             : (norm.EC != null ? parseFloat(norm.EC) : (water.ecw || water.EC || null));
    // SAR: from sample normalized (computed by water engine and written to sample)
    var SAR  = norm.SAR  != null ? parseFloat(norm.SAR)
             : (water.SAR != null ? parseFloat(water.SAR) : null);
    var pH   = norm.pH   != null ? parseFloat(norm.pH)
             : (water.pH  != null ? parseFloat(water.pH)  : null);
    var Na   = norm.Na   != null ? parseFloat(norm.Na)   : null;
    var HCO3 = norm.HCO3 != null ? parseFloat(norm.HCO3) : null;
    // Salinity status from engine — authoritative classification
    var salinityStatus = sp ? (sp.status || '') : '';
    if (!salinityStatus) {
      // Read from water progressive disclosure card — more reliable than legacy DOM text
      // Card: .gaip-diagnostic-card.water-card with .gaip-parameter "Salinity (ECw)"
      var waterCards = document.querySelectorAll('.gaip-diagnostic-card.water-card');
      for (var wci = 0; wci < waterCards.length; wci++) {
        var wcard = waterCards[wci];
        var paramEl = wcard.querySelector('.gaip-parameter');
        if (paramEl && paramEl.textContent.indexOf('Salinity') >= 0 && paramEl.textContent.indexOf('ECw') >= 0) {
          var badge = wcard.querySelector('.gaip-status-badge');
          var statusLabel = wcard.querySelector('.gaip-status-label');
          if (statusLabel) salinityStatus = statusLabel.textContent.trim();
          // Map progressive disclosure labels to salinity risk strings
          if (!salinityStatus && badge) {
            if (badge.classList.contains('status-deficient')) salinityStatus = 'High salinity risk';
            else if (badge.classList.contains('status-borderline')) salinityStatus = 'Medium salinity risk';
            else if (badge.classList.contains('status-adequate')) salinityStatus = 'Low salinity risk';
          }
          break;
        }
      }
      // Fallback: legacy <strong>Salinity class:</strong> text in water body
      if (!salinityStatus) {
        var waterBody = document.querySelector('.gaip-water-body');
        if (waterBody) {
          var scMatch = waterBody.innerHTML.match(/Salinity class:<\/strong>\s*([^<\n]+)/);
          if (scMatch) salinityStatus = scMatch[1].trim();
        }
      }
    }
    // Thresholds: Carrow et al. 2001 irrigation water quality for turf
    var ecCls  = EC  == null ? 'n' : EC  < 1.5 ? 'ok' : EC  < 3.0 ? 'warn' : 'act';
    var sarCls = SAR == null ? 'n' : SAR < 10  ? 'ok' : SAR < 15  ? 'warn' : 'act';
    var phCls  = pH  == null ? 'n' : (pH >= 6.5 && pH <= 8.0) ? 'ok' : 'warn';
    // Use engine salinityStatus as override — it has access to all ions and blended water
    // 'Medium Risk' from progressive disclosure, 'Medium salinity risk' from legacy
    var salinityIssue = /high.*risk|very high|critical/i.test(salinityStatus)
      || ecCls === 'act' || sarCls === 'act';
    var salinityWarn  = /medium/i.test(salinityStatus)
      || (!salinityIssue && (ecCls === 'warn' || sarCls === 'warn'));
    var fields = [];
    if (EC   != null) fields.push({ label:'EC (dS/m)', value:EC.toFixed(2),   cls:ecCls });
    if (SAR  != null) fields.push({ label:'SAR',        value:SAR.toFixed(1),  cls:sarCls });
    if (pH   != null) fields.push({ label:'pH',         value:pH.toFixed(1),   cls:phCls });
    if (Na   != null) fields.push({ label:'Na (ppm)',    value:Na,              cls:'n' });
    if (HCO3 != null) fields.push({ label:'HCO\u2083',  value:HCO3,            cls:'n' });
    return {
      labName:       water.labName || null,
      sampleDate:    water.sampleDate || null,
      EC:EC, SAR:SAR, fields:fields,
      salinityIssue: salinityIssue,
      salinityWarn:  salinityWarn,
      hasSamples:    sample != null || fields.length > 0 || sp != null,
      sampleDate:    sample ? sample.date : (water.sampleDate || null),
      labName:       sample ? (sample.label || sample.id || null) : (water.labName || null),
      salinityStatus: salinityStatus
    };
  }

  function _getTissueData() {
    // b35fix229a: Use sample manager as primary source for tissue data
    var SM = global.GAIP_SampleManager;
    var sample = SM && typeof SM.getActiveSample === 'function'
      ? SM.getActiveSample('tissue') : null;
    var ct = (global.GAIP_CANONICAL_STATE || {}).tissue || {};
    var state = global.GAIP_STATE || {};
    var tissue = ct || state.tissue || {};
    var normalized = (sample && sample.normalized) ? sample.normalized : {};
    var dr = global.GAIP_DISEASE_RESULT || {};
    var nStatus    = dr.nStatus || tissue.nitrogenStatus || 'unknown';
    var nEstimated = sample == null && !tissue.sampleDate && !ct.sampleDate;
    var nDeficient = nStatus === 'deficient';
    var nAdequate  = nStatus === 'adequate' || nStatus === 'high';
    var N  = normalized.N  != null ? normalized.N  : (tissue.N  != null ? parseFloat(tissue.N)  : null);
    var P  = normalized.P  != null ? normalized.P  : (tissue.P  != null ? parseFloat(tissue.P)  : null);
    var K  = normalized.K  != null ? normalized.K  : (tissue.K  != null ? parseFloat(tissue.K)  : null);
    var Ca = normalized.Ca != null ? normalized.Ca : (tissue.Ca != null ? parseFloat(tissue.Ca) : null);
    var fields = [];
    if (N  != null) fields.push({ label:'N (%)',  value:N.toFixed(2),
      cls: nDeficient ? 'act' : nAdequate ? 'ok' : 'warn' });
    if (P  != null) fields.push({ label:'P (%)',  value:P.toFixed(2),  cls:'n' });
    if (K  != null) fields.push({ label:'K (%)',  value:K.toFixed(2),  cls:'n' });
    if (Ca != null) fields.push({ label:'Ca (%)', value:Ca.toFixed(2), cls:'n' });
    return {
      sampleDate:  sample ? sample.date : (tissue.sampleDate || ct.sampleDate || null),
      labName:     sample ? (sample.label || sample.id || null) : (tissue.labName || ct.labName || null),
      nStatus:nStatus, nEstimated:nEstimated,
      nDeficient:nDeficient, nAdequate:nAdequate,
      fields:fields, hasSamples: sample != null || fields.length > 0
    };
  }

  function _getSprayData() {
    var state = global.GAIP_STATE || {};
    var ctx = state.sprayContext || null;
    if (!ctx) return { hasEntries:false, warnings:[], entries:[], consecutiveFrac:[], hasFracAlert:false };
    var warnings = ctx.fracWarnings || ctx.warnings || [];  // b35fix237c: cascade uses fracWarnings not warnings
    var entries  = ctx.entries  || ctx.recentApplications || (ctx.history ? ctx.history : []);  // b35fix237: cascade uses recentApplications
    var consecutive = warnings.filter(function(w) { return w.type === 'consecutive_frac'; });
    return {
      hasEntries:     entries.length > 0,
      entries:        entries,
      warnings:       warnings,
      consecutiveFrac: consecutive,
      hasFracAlert:   consecutive.length > 0
    };
  }

  // ── Nav summary items ─────────────────────────────────────────────────────

  function _navItems() {
    var soil   = _getSoilData();
    var water  = _getWaterData();
    var tissue = _getTissueData();
    var spray  = _getSprayData();

    return [
      {
        id:'soil', label:'Soil',
        cls: soil.anyDeficient ? 'act' : soil.hasSamples ? 'ok' : '',
        txt: soil.anyDeficient ? 'Deficiency flagged'
           : soil.hasSamples  ? 'Not limiting' : 'No soil data'
      },
      {
        id:'water', label:'Water',
        cls: water.salinityIssue ? 'act' : water.salinityWarn ? 'warn' : water.hasSamples ? 'ok' : '',
        txt: water.salinityIssue ? 'Salinity \u2014 check programme'
           : water.salinityWarn  ? 'Salinity borderline'
           : water.hasSamples    ? 'Not limiting' : 'No water data'
      },
      {
        id:'tissue', label:'Tissue',
        cls: (tissue.nEstimated && !tissue.hasSamples) ? '' : tissue.nEstimated ? 'warn' : tissue.nDeficient ? 'act' : tissue.hasSamples ? 'ok' : '',
        txt: (tissue.nEstimated && !tissue.hasSamples) ? 'No tissue data'
           : tissue.nEstimated ? 'N estimated \u2192 confidence limited'
           : tissue.nDeficient ? 'N deficient \u2192 disease risk elevated'
           : tissue.hasSamples ? 'N adequate' : 'No tissue data'
      },
      {
        id:'spray', label:'Spray log',
        cls: spray.hasFracAlert ? 'act' : spray.hasEntries ? 'ok' : '',
        txt: spray.hasFracAlert
          ? 'FRAC ' + spray.consecutiveFrac[0].fracGroup + ' \u00d7' +
            spray.consecutiveFrac[0].count + ' \u2192 rotation required'
          : spray.hasEntries ? 'Rotation on track' : 'No spray entries'
      }
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
      + badges + '</div></div>';
  }

  // ── Pane builders ─────────────────────────────────────────────────────────

  function _buildSoilPane() {
    var d = _getSoilData();
    var countStr = d.sampleCount > 1 ? d.sampleCount + ' samples' : (d.sampleCount === 1 ? '1 sample' : '');
    var dateLine = [countStr, d.labName, d.sampleDate, d.methodology].filter(Boolean).join(' \u2022 ');
    var callout, card = '';
    if (!d.hasSamples) {
      callout = _callout('warn','?','No soil test loaded',[
        {text:'No data',cls:'warn'},{text:'soil constraint unknown',cls:'warn'},
        {text:'import a result to improve confidence',cls:'warn'}]);
    } else if (d.anyDeficient) {
      var defMeth = d.methodology || 'MLSN';
      callout = _callout('act','!','Nutrient deficiency flagged',[
        {text:'Below ' + defMeth + ' minimum',cls:'act'},{text:'growth constraint possible',cls:'warn'},
        {text:'review fertiliser programme',cls:'act'}]);
      card = _recCard('Nutrients (ppm)', dateLine, d.fields);
    } else {
      var methLabel = d.methodology || 'MLSN';
      callout = _callout('ok','OK','Soil is fine \u2014 nothing to act on',[
        {text:'All nutrients within ' + methLabel + ' range',cls:'ok'},
        {text:'no soil constraint',cls:''},
        {text:'Decisions unaffected',cls:'ok'}]);
      card = _recCard('Nutrients (ppm)', dateLine, d.fields);
    }
    return _pane('soil', 'Soil test', dateLine, callout + card);
  }

  function _buildWaterPane() {
    var d = _getWaterData();
    var dateLine = [d.labName, d.sampleDate].filter(Boolean).join(' \u2022 ');
    var callout, card = '';
    if (!d.hasSamples) {
      callout = _callout('warn','?','No water test loaded',[
        {text:'No data',cls:'warn'},{text:'salinity unknown',cls:'warn'},
        {text:'import a result',cls:'warn'}]);
    } else if (d.salinityIssue) {
      var issTitle = d.salinityStatus || 'Salinity — review irrigation programme';
      callout = _callout('act','!',issTitle,[
        {text:'EC or SAR above threshold',cls:'act'},{text:'soil structure risk',cls:'act'},
        {text:'leaching fraction required',cls:'act'}]);
      card = _recCard('Salinity & sodicity', dateLine, d.fields);
    } else if (d.salinityWarn) {
      var warnTitle = d.salinityStatus || 'Salinity borderline — monitor';
      callout = _callout('warn','!',warnTitle,[
        {text:'EC/SAR approaching limits',cls:'warn'},{text:'watch trend',cls:'warn'},
        {text:'no immediate action',cls:''}]);
      card = _recCard('Salinity & sodicity', dateLine, d.fields);
    } else {
      var ecStr = d.EC != null ? 'SAR ' + (d.SAR||'?') + ', EC ' + d.EC : 'Salinity checked';
      callout = _callout('ok','OK','Water quality fine',[
        {text:ecStr,cls:'ok'},{text:'no salinity penalty',cls:''},
        {text:'Decisions unaffected',cls:'ok'}]);
      card = _recCard('Salinity & sodicity', dateLine, d.fields);
    }
    return _pane('water', 'Water test', dateLine, callout + card);
  }

  function _buildTissuePane() {
    var d = _getTissueData();
    var dateLine = [d.labName, d.sampleDate].filter(Boolean).join(' \u2022 ');
    var callout, card = '';
    if (d.nEstimated && !d.hasSamples) {
      // b35fix235: no sample ever loaded — don't say overdue
      callout = _callout('warn','?','No tissue data loaded',[
        {text:'N estimated from growth programme',cls:'warn'},
        {text:'host susceptibility uncertain',cls:'warn'},
        {text:'disease confidence: Usable only',cls:'warn'}]);
    } else if (d.nEstimated) {
      // had data previously but not current
      callout = _callout('warn','!','Tissue test overdue',[
        {text:'N estimated from programme',cls:'warn'},
        {text:'host susceptibility uncertain',cls:'warn'},
        {text:'disease confidence: Usable only',cls:'warn'}]);
    } else if (d.nDeficient) {
      callout = _callout('act','!','N deficiency \u2014 disease risk elevated',[
        {text:'Tissue N below adequate',cls:'act'},
        {text:'host susceptibility higher',cls:'act'},
        {text:'disease risk modifier applied',cls:'act'}]);
      card = _recCard('Macronutrients (% DW)', dateLine, d.fields);
    } else {
      callout = _callout('ok','OK','Tissue N adequate',[
        {text:'N status confirmed',cls:'ok'},
        {text:'disease susceptibility normal',cls:''},
        {text:'Decisions unaffected',cls:'ok'}]);
      if (d.hasSamples) card = _recCard('Macronutrients (% DW)', dateLine, d.fields);
    }
    return _pane('tissue', 'Tissue test', dateLine || 'No data loaded', callout + card);
  }

  function _buildSprayPane() {
    var d = _getSprayData();
    var callout, tableHtml = '';
    if (!d.hasEntries) {
      callout = _callout('warn','?','No spray entries logged',[
        {text:'No fungicide history',cls:'warn'},
        {text:'FRAC rotation unknown',cls:'warn'},
        {text:'log applications to track resistance risk',cls:'warn'}]);
    } else if (d.hasFracAlert) {
      var cf = d.consecutiveFrac[0];
      callout = _callout('act','!','FRAC ' + cf.fracGroup + ' used ' + cf.count + ' times in a row',[
        {text:'FRAC '+cf.fracGroup+' \u00d7'+cf.count+' consecutive',cls:'act'},
        {text:'rotation rule triggered',cls:'act'},
        {text:'Disease is top priority today',cls:'act'}]);
    } else {
      callout = _callout('ok','OK','Rotation on track',[
        {text:'No consecutive FRAC issues',cls:'ok'},
        {text:'resistance risk low',cls:''},
        {text:'continue programme',cls:'ok'}]);
    }
    if (d.hasEntries) {
      var rows = d.entries.slice(0,10).map(function(e) {
        var isFungicide = (e.product_category === 'fungicide');
        var fg = isFungicide ? String(e.frac_group||'?') : null;
        var fracCls = fg && d.consecutiveFrac.some(function(c){
          return fg.indexOf(c.fracGroup) >= 0 && c.count >= 2;
        }) ? 'act' : 'ok';
        var rate = (e.rate||'') + (e.rate_unit ? ' '+e.rate_unit : '');
        var fracCell = fg
          ? '<td><span class="gev-frac-badge '+fracCls+'">FRAC '+_esc(fg)+'</span></td>'
          : '<td></td>'; // b35fix238: no FRAC badge for non-fungicide entries (PGR, etc)
        return '<tr>'
          +'<td>'+_esc(e.application_date||'')+'</td>'
          +'<td>'+_esc(e.product_name||e.product||'')+'</td>'
          +'<td>'+_esc(e.zone||'')+'</td>'
          +'<td>'+_esc(rate)+'</td>'
          +fracCell
          +'</tr>';
      }).join('');
      tableHtml = '<div class="gev-rec">'
        +'<div class="gev-rec-hd">'
        +'<div class="gev-rec-title">Application history</div>'
        +'<div class="gev-rec-sub">'+d.entries.length+' entries</div>'
        +'</div><div class="gev-rec-body" style="padding:0">'
        +'<table class="gev-spray-tbl"><thead><tr>'
        +'<th>Date</th><th>Product</th><th>Zone</th><th>Rate</th><th>Group</th>'
        +'</tr></thead><tbody>'+rows+'</tbody></table>'
        +'</div></div>';
    }
    return _pane('spray', 'Spray log', 'Last 90 days', callout + tableHtml);
  }

  function _pane(id, title, sub, body) {
    return '<div class="gev-pane' + (id===_activePane?' on':'') + '" data-gev-pane="'+id+'">'
      +'<div class="gev-dp-head"><div>'
      +'<div class="gev-dp-title">'+_esc(title)+'</div>'
      +'<div class="gev-dp-sub">'+_esc(sub)+'</div>'
      +'</div></div>'
      +'<div class="gev-dp-body">'+body+'</div>'
      +'</div>';
  }

  // ── Full render ───────────────────────────────────────────────────────────

  function _render() {
    var panel = document.getElementById('gaip-evidence-panel');
    if (!panel) return;

    var navItems = _navItems();

    var navHtml = navItems.map(function(n) {
      return '<div class="gev-dni'+(n.id===_activePane?' on':'')+'" data-gev-nav="'+n.id+'">'
        +'<div class="gev-dni-label">'+_esc(n.label)+'</div>'
        +'<div class="gev-dni-evidence '+n.cls+'">'+_esc(n.txt)+'</div>'
        +'</div>';
    }).join('');

    panel.innerHTML = _buildStatusBar(navItems)
      +'<div class="gev-inner">'
      +'<div class="gev-nav">'+navHtml+'</div>'
      +'<div class="gev-main">'
      +_buildSoilPane()
      +_buildWaterPane()
      +_buildTissuePane()
      +_buildSprayPane()
      +'</div></div>';

    // Wire nav clicks — delegated on panel container
    panel.addEventListener('click', function(e) {
      var navEl = e.target.closest('[data-gev-nav]');
      if (navEl) {
        _activePane = navEl.getAttribute('data-gev-nav');
        _render();
      }
    }, { once: true });  // re-added each render, so use once
  }

  // Fix: delegated listener needs to persist, not once
  function _wireNav(panel) {
    panel.addEventListener('click', function(e) {
      var navEl = e.target.closest('[data-gev-nav]');
      if (navEl) {
        _activePane = navEl.getAttribute('data-gev-nav');
        _render();
      }
    });
  }

  var _wired = false;
  function _renderAndWire() {
    _render();
    if (!_wired) {
      var panel = document.getElementById('gaip-evidence-panel');
      if (panel) { _wireNav(panel); _wired = true; }
    }
  }

  // ── Init ─────────────────────────────────────────────────────────────────

  function init() {
    // gaip:analysis-complete fires from hub-tissue after salinity/water engines complete
    // gaip:orchestrator-complete fires after disease/pre-emergent engines
    // Listen to both — analysis-complete fires first and has salinity data
    document.addEventListener('gaip:analysis-complete', function() {
      setTimeout(_renderAndWire, 800); // 800ms — MLSN cards need cascade to finish rendering
    });
    document.addEventListener('gaip:orchestrator-complete', function() {
      setTimeout(_renderAndWire, 300);
    });
    document.addEventListener('gaip:site-changed', function() {
      _wired = false;
      setTimeout(_renderAndWire, 400);
    });
    // b35fix237: re-render when cascade async fetch completes — spray pane
    // shows stale/empty otherwise because sprayContext arrives after orchestrator-complete.
    document.addEventListener('gaip:spray-context-loaded', function() {
      setTimeout(_renderAndWire, 100);
    });
    if (global.GAIP_STATE) setTimeout(_renderAndWire, 800);
  }

  console.log('[GilbaEvidence] v1.0.0 loaded — container:', !!document.getElementById('gaip-evidence-panel'));

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() {
      console.log('[GilbaEvidence] DOMContentLoaded — container:', !!document.getElementById('gaip-evidence-panel'));
      init();
    });
  } else {
    init();
  }

  global.GilbaEvidenceUI = { refresh: _renderAndWire };

})(window);
