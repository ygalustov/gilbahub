/**
 * GAIP Decision UI v1.0.0
 *
 * Render layer for the Decision State Machine.
 * Injects scaffold into #gaip-decision-panel, re-renders on gaip:orchestrator-complete.
 *
 * Depends on: gaip-decision-engine.js (GilbaDSM)
 *
 * @author Gilba Solutions
 * @version 1.0.0
 */
(function (global) {
  'use strict';

  // =========================================================================
  // STATE
  // =========================================================================

  var _items  = {};
  var _sc     = {};
  var _curSel = '';
  var _deferHorizon   = 'today';
  var _pendingCommit  = false;
  var _scenarioKey    = null;
  var _collapsed      = false;
  var _scaffoldBuilt  = false;

  // Panel root — cached after scaffold built
  var _panel = null;

  // =========================================================================
  // DOM HELPERS
  // All IDs are prefixed 'gdp-' to avoid collisions with existing hub elements
  // =========================================================================

  function _el(id) {
    return document.getElementById('gdp-' + id);
  }

  function _esc(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  // =========================================================================
  // VISUAL BUILDERS (one per engine type)
  // =========================================================================

  function _buildVisual(item) {
    var d = item.visualData || {};

    if (item.id === 'disease') {
      var risk  = d.risk || 0;
      var thr   = d.threshold || 20;
      var peak  = d.peakRisk;
      var pd    = d.peakDay || 'day 4';
      var vc    = risk >= thr ? 'act' : risk >= 10 ? 'warn' : 'ok';
      // b35fix223: viewBox height 44 gives room for threshold text above the line
      var svgH  = 44;
      var yMax  = svgH - 6; // bottom padding
      var yMin  = 8;        // top padding
      var thrY  = Math.round(yMin + (100 - thr) / 100 * (yMax - yMin));
      var nowY  = Math.round(yMin + (100 - risk) / 100 * (yMax - yMin));
      var peakY = peak != null ? Math.round(yMin + (100 - peak) / 100 * (yMax - yMin)) : nowY;
      var peakColor = risk >= thr ? '#dc2626' : '#d97706';
      var scoreColor = vc === 'act' ? '#dc2626' : vc === 'warn' ? '#d97706' : '#2d7a4f';
      return '<div class="gdp-risk-arc">'
        + '<div class="gdp-risk-score-block">'
        + '<div class="gdp-risk-score-lbl">Current risk</div>'
        + '<div class="gdp-risk-score-val" style="color:' + scoreColor + ' !important">' + risk + '%</div>'
        + '<div class="gdp-risk-threshold">Spray above ' + thr + '%</div>'
        + '</div>'
        + '<div class="gdp-risk-spark">'
        + '<div class="gdp-spark-lbl">'
        + '<span style="color:var(--gaip-text-secondary)">7-day forecast</span>'
        + (peak != null
            ? '<span style="color:' + peakColor + ' !important">peak ' + peak + '% ' + _esc(pd) + '</span>'
            : '<span style="color:var(--gaip-text-muted)">stable</span>')
        + '</div>'
        + '<svg class="gdp-spark-svg" viewBox="0 0 200 ' + svgH + '" preserveAspectRatio="none">'
        + '<line x1="0" y1="' + thrY + '" x2="200" y2="' + thrY + '" stroke="var(--gaip-border)" stroke-width="1" stroke-dasharray="3,3"/>'
        + '<polyline points="0,' + nowY + ' 56,' + Math.round((nowY + peakY) / 2) + ' 112,' + peakY + ' 200,' + Math.min(yMax, peakY + 4) + '" fill="none" stroke="' + peakColor + '" stroke-width="2" opacity=".9"/>'
        + '<circle cx="0" cy="' + nowY + '" r="3" fill="' + peakColor + '"/>'
        + '</svg>'
        + '</div></div>';
    }

    if (item.id === 'pgr') {
      var acc  = d.accumulated || 0;
      var thr2 = d.threshold || 280;
      var sup  = d.suppression || 0;
      var days = d.daysRemaining;
      var pct  = Math.min(100, Math.round((acc / thr2) * 100));
      return '<div>'
        + '<div class="gdp-pgr-bar-lbl">'
        + '<span>Suppression remaining</span>'
        + '<span style="color:#d97706 !important">' + sup + '%, reapply below 40%</span>'
        + '</div>'
        + '<div class="gdp-pgr-bar-track"><div class="gdp-pgr-bar-fill" style="width:' + sup + '%;background:linear-gradient(90deg,#2d7a4f,#d97706)"></div></div>'
        + '<div class="gdp-pgr-bar-ticks"><span>0%</span><span>40% reapply</span><span>100%</span></div>'
        + '<div class="gdp-pgr-stats">'
        + '<div class="gdp-pgr-stat"><div class="gdp-pgr-stat-lbl">GDD so far</div><div class="gdp-pgr-stat-val">' + Math.round(acc) + '</div></div>'
        + '<div class="gdp-pgr-stat"><div class="gdp-pgr-stat-lbl">Target</div><div class="gdp-pgr-stat-val">~' + thr2 + '</div></div>'
        + (days != null ? '<div class="gdp-pgr-stat"><div class="gdp-pgr-stat-lbl">Days left</div><div class="gdp-pgr-stat-val" style="color:#d97706 !important">' + days + 'd</div></div>' : '')
        + '</div></div>';
    }

    if (item.id === 'irrigation') {
      var vwc    = d.vwc;
      var target = d.target || [15, 25];
      var next   = d.nextEvent;
      var def    = d.deficit;
      var vStr   = vwc != null ? vwc.toFixed(1) + '%' : '-';
      // b35fix238: bar shows VWC as % of 0-40 range (field capacity scale), not position within target band
      // At VWC=15 (lower target) bar shows 37.5%, at VWC=25 (upper) shows 62.5%
      var fcMax  = 40;
      var fp     = vwc != null ? Math.max(2, Math.min(100, Math.round((vwc / fcMax) * 100))) : 50;
      // Target band markers as % of fcMax
      var tLo    = Math.round((target[0] / fcMax) * 100);
      var tHi    = Math.round((target[1] / fcMax) * 100);
      return '<div>'
        + '<div class="gdp-irr-stats">'
        + '<div class="gdp-irr-stat"><div class="gdp-irr-stat-lbl">VWC</div><div class="gdp-irr-stat-val" style="color:#2d7a4f !important">' + vStr + '</div></div>'
        + '<div class="gdp-irr-stat"><div class="gdp-irr-stat-lbl">Target</div><div class="gdp-irr-stat-val">' + target[0] + '\u2013' + target[1] + '%</div></div>'
        + (def != null ? '<div class="gdp-irr-stat"><div class="gdp-irr-stat-lbl">Deficit</div><div class="gdp-irr-stat-val">' + def + 'mm</div></div>' : '')
        + (next != null ? '<div class="gdp-irr-stat"><div class="gdp-irr-stat-lbl">Scheduled</div><div class="gdp-irr-stat-val" style="font-size:13px;color:#2d7a4f !important">' + Math.round(next) + 'mm</div></div>' : '')
        + '</div>'
        + '<div class="gdp-irr-bar-track" style="position:relative;">'
        + '<div style="position:absolute;left:' + tLo + '%;width:' + (tHi-tLo) + '%;height:100%;background:rgba(45,122,79,0.15);border-left:1px solid #2d7a4f;border-right:1px solid #2d7a4f;"></div>'
        + '<div class="gdp-irr-bar-fill" style="width:' + fp + '%;position:relative;z-index:1;"></div>'
        + '</div>'
        + '<div class="gdp-irr-bar-lbl"><span>0%</span><span>' + target[0] + '\u2013' + target[1] + '% target</span><span>FC ~40%</span></div>'
        + '</div>';
    }

    if (item.id === 'preemergent') {
      // b35fix226: Replace SVG (unreadable at full width) with bar+stats.
      var st   = d.soilTemp;
      var at   = d.applyAt || 15;
      var dtw  = d.daysToWindow;
      var sStr = st != null ? st.toFixed(1) + '\u00b0C' : '-';

      // Bar: 0% = soil at applyAt+15°C (start monitoring), 100% = at applyAt (window open)
      var barRange = 15;
      var barPct = st != null
        ? Math.max(0, Math.min(100, Math.round(((barRange - (st - at)) / barRange) * 100)))
        : 0;
      var windowOpen = st != null && st <= at;
      var barColor = windowOpen
        ? 'linear-gradient(90deg,#2d7a4f,#2d7a4f)'
        : (barPct >= 60 ? 'linear-gradient(90deg,#2d7a4f,#d97706)' : 'linear-gradient(90deg,var(--gaip-border),#d97706)');
      var windowLabel = windowOpen
        ? 'Window open, apply now'
        : (dtw != null ? '~' + dtw + 'd to window' : 'Monitor soil temp');
      var windowColor = windowOpen ? '#2d7a4f' : '#d97706';

      return '<div>'
        + '<div class="gdp-pgr-bar-lbl">'
        + '<span>Soil temp, 50mm depth</span>'
        + '<span style="color:' + windowColor + ' !important">' + windowLabel + '</span>'
        + '</div>'
        + '<div class="gdp-pgr-bar-track"><div class="gdp-pgr-bar-fill" style="width:' + barPct + '%;background:' + barColor + '"></div></div>'
        + '<div class="gdp-pgr-bar-ticks"><span>' + (at + barRange) + '\u00b0C</span><span>apply at ' + at + '\u00b0C</span><span>window</span></div>'
        + '<div class="gdp-pgr-stats">'
        + '<div class="gdp-pgr-stat"><div class="gdp-pgr-stat-lbl">Soil now</div><div class="gdp-pgr-stat-val" style="color:#d97706 !important">' + sStr + '</div></div>'
        + '<div class="gdp-pgr-stat"><div class="gdp-pgr-stat-lbl">Apply at</div><div class="gdp-pgr-stat-val">' + at + '\u00b0C</div></div>'
        + (dtw != null ? '<div class="gdp-pgr-stat"><div class="gdp-pgr-stat-lbl">About</div><div class="gdp-pgr-stat-val" style="color:#d97706 !important">~' + dtw + 'd</div></div>' : '')
        + '</div></div>';
    }

    return '<div style="color:var(--gaip-text-secondary);font-size:10px;padding:8px 0;">,</div>';
  }

  // =========================================================================
  // SUPPORT CHAIN BLOCK
  // =========================================================================

  function _buildSVBlock(item) {
    return '<div class="gdp-sv-chain-row">'
      + '<span class="gdp-sv-now">' + _esc(item.svNow || '') + '</span>'
      + '<span class="gdp-sv-arr">\u2192</span>'
      + '<span class="gdp-sv-proj" style="' + (item.svProjColor || '') + '">' + _esc(item.svProj || '') + '</span>'
      + '<span class="gdp-sv-arr">\u2192</span>'
      + '<span class="gdp-sv-conseq">' + _esc(item.svConseq || '') + '</span>'
      + '</div>';
  }

  // =========================================================================
  // RENDER — LEFT PANEL
  // =========================================================================

  function _renderLeft(k) {
    var item = _items[k];
    if (!item) return;
    var disp = global.GilbaDSM.DISPOSITION[k] || { state: 'pending', horizon: null, ts: null };

    // Left urgency class
    var leftCls = disp.state === 'pending' ? item.leftUrg : disp.state;
    var leftEl = _el('left');
    if (leftEl) leftEl.className = 'gdp-left ' + leftCls;

    var modEl = _el('pb-mod');
    if (modEl) modEl.textContent = item.pbMod;

    var actionEl = _el('pb-action');
    if (actionEl) {
      actionEl.textContent = disp.state === 'committed' && item.commitConsequence
        ? item.commitConsequence
        : item.pbAction;
      actionEl.className = 'gdp-pb-action'
        + (disp.state === 'committed' ? ' conf-committed'
           : item.confKey !== 'high' ? ' conf-' + item.confKey : '');
    }

    var trigEl = _el('pb-trigger');
    if (trigEl) {
      trigEl.innerHTML =
        '<span class="sig ' + (item.sigClass || '') + '">' + _esc(item.sig) + '</span>'
        + '<span class="sep">/</span>'
        + '<span class="thr">' + _esc(item.thr) + '</span>'
        + (item.thrNote ? '<span style="color:var(--gaip-text-secondary)">, ' + _esc(item.thrNote) + '</span>' : '');
    }

    var pressEl = _el('pb-pressure');
    if (pressEl) {
      pressEl.textContent = item.pressure || '';
      pressEl.className = 'gdp-pb-pressure ' + (item.pressureClass || '');
    }

    var visEl = _el('pb-visual');
    if (visEl) visEl.innerHTML = _buildVisual(item);

    // Secondary: cost + confidence badge
    var sbEl = _el('sb');
    if (sbEl) {
      var bgBit = item.confKey === 'high'
        ? 'background:var(--gaip-accent-light);color:var(--gaip-accent-dark)'
        : item.confKey === 'usable'
          ? 'background:var(--gaip-warning-bg);color:#d97706'
          : 'background:var(--gaip-critical-bg);color:#dc2626';
      sbEl.innerHTML =
        '<div class="gdp-cost-block">'
        + '<div class="gdp-cp"><div class="gdp-cp-lbl">' + _esc(item.cALbl) + '</div><div class="gdp-cp-val ' + item.cAC + '">' + _esc(item.cA) + '</div></div>'
        + '<div class="gdp-cp"><div class="gdp-cp-lbl">' + _esc(item.cRLbl) + '</div><div class="gdp-cp-val ' + item.cRC + '">' + _esc(item.cRisk) + '</div>'
        + '<div class="gdp-cp-slope ' + (item.cSlopeClass || '') + '">' + _esc(item.cSlope) + '</div></div>'
        + '</div>'
        + '<div class="gdp-conf-block">'
        + '<span class="gdp-conf-badge ' + item.confKey + '" style="' + bgBit + '">' + _esc(item.confLabel) + '</span>'
        + '<span class="gdp-conf-impl">' + _esc(item.confImplication) + '</span>'
        + '</div>';
    }

    // Support card: show sv block for selected item
    // b35fix222: classList.toggle with a space-separated string throws DOMException.
    // Use className assignment only — it's the correct single-operation path.
    Object.keys(_items).forEach(function (id) {
      var svEl = _el('sv-' + id);
      if (svEl) svEl.className = 'gdp-sv' + (id === k ? ' on' : '');
    });
    var shEl = _el('support-hdr-label');
    if (shEl) shEl.textContent = item.supHdr || 'If you delay:';

    _renderFork(k);
  }

  // =========================================================================
  // RENDER — FORK
  // =========================================================================

  function _renderFork(k) {
    var item = _items[k];
    if (!item) return;
    var disp = global.GilbaDSM.DISPOSITION[k] || { state: 'pending', horizon: null, ts: null };

    var pendingEl = _el('fork-pending');
    if (pendingEl) {
      pendingEl.style.display = disp.state === 'pending' ? 'flex' : 'none';
      pendingEl.style.flexDirection = 'column';
    }

    var committedEl = _el('fork-committed');
    if (committedEl) committedEl.className = 'gdp-fork-committed' + (disp.state === 'committed' ? ' on' : '');

    var deferredEl = _el('fork-deferred');
    if (deferredEl) deferredEl.className = 'gdp-fork-deferred' + (disp.state === 'deferred' ? ' on' : '');

    var clearedEl = _el('fork-cleared');
    if (clearedEl) clearedEl.className = 'gdp-fork-cleared' + (disp.state === 'cleared' ? ' on' : '');

    // Reset sub-panels
    var cfEl = _el('fork-confirm');
    if (cfEl) cfEl.classList.remove('on');
    var dpEl = _el('fork-defer-panel');
    if (dpEl) dpEl.classList.remove('on');
    _pendingCommit = false;

    if (disp.state === 'pending') {
      var actBtn = _el('fork-act-btn');
      if (actBtn) actBtn.className = 'gdp-fork-act ' + item.confKey;

      var actLbl = (_scenarioKey && item.forkActDyn && item.forkActDyn[_scenarioKey])
        ? item.forkActDyn[_scenarioKey]
        : (item.forkActDyn && item.forkActDyn['default']) || item.forkActLbl || 'Commit to this decision';
      var actLblEl = _el('fork-act-lbl');
      if (actLblEl) actLblEl.textContent = actLbl;

      var deferLblEl = _el('fork-defer-lbl');
      if (deferLblEl) deferLblEl.textContent = item.forkDeferLbl || 'Defer';
      var deferSubEl = _el('fork-defer-sub');
      if (deferSubEl) deferSubEl.textContent = item.forkDeferSub || 'choose when';

      var fdpLblEl = _el('fdp-lbl');
      if (fdpLblEl) fdpLblEl.textContent = item.tier === 'act-on' ? 'Defer until (confirm reason)' : 'Defer until';

      // Scenario divergence
      var showDiv = global.GilbaDSM.checkDivergence(_scenarioKey, k, item);
      var divEl = _el('fork-diverge');
      if (divEl) divEl.className = 'gdp-fork-diverge' + (showDiv ? ' on' : '');
    }

    if (disp.state === 'committed') {
      var fcTxt = _el('fc-txt');
      if (fcTxt) fcTxt.textContent = 'Decision recorded, ' + (disp.ts || '');
      var fcSub = _el('fc-sub');
      if (fcSub) fcSub.textContent = item.commitConsequence || '';
    }

    if (disp.state === 'deferred') {
      var fdTxt = _el('fd-txt');
      if (fdTxt) fdTxt.textContent = 'Deferred to ' + (disp.horizon || 'later');
      var fdSub = _el('fd-sub');
      if (fdSub) fdSub.textContent = disp.ts || '';
    }

    if (disp.state === 'cleared') {
      var fclrEl = _el('fclr-txt');
      if (fclrEl) fclrEl.textContent = item.clearedMsg || 'No action required';
    }

    var forkEl = _el('fork');
    if (forkEl) forkEl.className = 'gdp-fork' + (disp.state === 'cleared' ? ' hidden' : '');
  }

  // =========================================================================
  // RENDER — QUEUE RAIL
  // =========================================================================

  function _renderQueue(sc) {
    var qEl = _el('qlist');
    if (!qEl) return;
    var html = '';
    var n = 1;

    (sc.aKeys || []).forEach(function (k) {
      var item = _items[k];
      if (!item) return;
      var disp   = global.GilbaDSM.DISPOSITION[k] || { state: 'pending' };
      var selCls = k === _curSel ? ' sel' : '';
      var stCls  = disp.state !== 'pending' ? ' ' + disp.state : '';
      html += '<div class="gdp-qi' + selCls + stCls + '" id="gdp-qi-' + k + '" data-item="' + k + '">'
        + '<div class="gdp-qi-row">'
        + '<div class="gdp-qi-rk"><div class="gdp-rn ' + (item.rnCls || '') + '">' + (n++) + '</div></div>'
        + '<div class="gdp-qi-body"><div class="gdp-qi-act">' + _esc(item.act) + '</div><div class="gdp-qi-sup">' + _esc(item.sup) + '</div></div>'
        + '<div class="gdp-qi-right"><div class="gdp-qi-m ' + (item.mc || '') + '">' + _esc(item.metric) + '</div></div>'
        + '</div></div>';
    });

    var wKeys = sc.wKeys || [];
    if ((sc.aKeys || []).length && wKeys.length) {
      html += '<div class="gdp-qdiv"><div class="gdp-qdiv-l"></div><div class="gdp-qdiv-t">Watching</div><div class="gdp-qdiv-l"></div></div>';
    }
    wKeys.forEach(function (k) {
      var item = _items[k];
      if (!item) return;
      var selCls = k === _curSel ? ' sel' : '';
      html += '<div class="gdp-qw' + selCls + '" id="gdp-qi-' + k + '" data-item="' + k + '">'
        + '<div class="gdp-qw-act">' + _esc(item.act) + '</div>'
        + '<div class="gdp-qw-m">' + _esc(item.metric) + '</div>'
        + '</div>';
    });

    qEl.innerHTML = html;

    // Delegated click — one listener, survives re-renders
    qEl.onclick = function (e) {
      var el = e.target.closest('[data-item]');
      if (el) _selItem(el.getAttribute('data-item'));
    };

    // Update rail label
    var railEl = _el('rail-lbl');
    if (railEl) {
      var actNames = (sc.aKeys || []).map(function (k) { return _items[k] ? _items[k].act.split(' ')[0] : ''; }).filter(Boolean);
      railEl.textContent = actNames.length > 0 ? actNames.join(' + ') : 'All clear';
    }
  }

  // =========================================================================
  // RENDER — CTX BAR
  // =========================================================================

  function _renderCounts(sc) {
    var hlEl = _el('ctx-hl');
    if (hlEl) { hlEl.className = 'gdp-ctx-hl ' + (sc.hlC || 'ok'); hlEl.textContent = sc.hl || ''; }

    var countsEl = _el('ctx-counts');
    if (countsEl) {
      countsEl.innerHTML = (sc.counts || []).map(function (c) {
        var selCls  = c.id && c.id === _curSel ? ' on' : '';
        var dataId  = c.id ? ' data-item="' + c.id + '"' : '';
        return '<div class="gdp-ctc' + selCls + '"' + dataId + '>'
          + '<div class="gdp-ctc-n ' + (c.nc || 'd') + '">' + c.n + '</div>'
          + '<div class="gdp-ctc-w' + (c.nc === 'd' ? ' dim' : '') + '">' + _esc(c.w) + '</div>'
          + '</div>';
      }).join('');
      countsEl.onclick = function (e) {
        var el = e.target.closest('[data-item]');
        if (el) _selItem(el.getAttribute('data-item'));
      };
    }
  }

  // =========================================================================
  // RENDER — SUPPORT CARD (sv blocks)
  // =========================================================================

  function _buildAllSVBlocks() {
    var bodyEl = _el('sv-body');
    if (!bodyEl) return;
    var html = '';
    Object.keys(_items).forEach(function (k) {
      html += '<div class="gdp-sv" id="gdp-sv-' + k + '">' + _buildSVBlock(_items[k]) + '</div>';
    });
    bodyEl.innerHTML = html;
  }

  // =========================================================================
  // RESOLUTION PRESSURE
  // =========================================================================

  function _updatePressure(sc) {
    var pending = global.GilbaDSM.resolutionPressure(sc);
    var ctxBar = _el('ctx-bar');
    if (ctxBar) ctxBar.classList.toggle('pressure', pending > 1);

    var hlEl = _el('ctx-hl');
    if (hlEl && pending === 0 && (sc.aKeys || []).length > 0) {
      hlEl.className = 'gdp-ctx-hl ok';
      hlEl.textContent = 'All decisions made';
    }

    var stateEl = _el('header-state');
    if (stateEl) {
      var total = (sc.aKeys || []).length;
      var done  = total - pending;
      stateEl.textContent = total > 0 ? done + '/' + total + ' resolved' : 'watching';
    }
  }

  // =========================================================================
  // SELECTION
  // =========================================================================

  function _selItem(k) {
    if (!_items[k] || k === _curSel) return;
    _curSel = k;
    _renderLeft(k);
    // Queue highlight
    document.querySelectorAll('#gaip-decision-panel .gdp-qi, #gaip-decision-panel .gdp-qw').forEach(function (el) {
      el.classList.toggle('sel', el.id === 'gdp-qi-' + k);
    });
    // Ctx count highlight
    document.querySelectorAll('#gaip-decision-panel .gdp-ctc').forEach(function (el) {
      var id = el.getAttribute('data-item');
      if (id) el.classList.toggle('on', id === k);
    });
  }

  // =========================================================================
  // FORK ACTIONS
  // =========================================================================

  function _onAct() {
    var item = _items[_curSel];
    if (!item) return;
    if (item.confKey !== 'high' && item.confConfirmTxt) {
      var ctEl = _el('fork-confirm-txt');
      if (ctEl) ctEl.textContent = item.confConfirmTxt;
      var cfEl = _el('fork-confirm');
      if (cfEl) cfEl.classList.add('on');
      _pendingCommit = true;
      return;
    }
    _commitItem();
  }

  function _cancelConfirm() {
    var cfEl = _el('fork-confirm');
    if (cfEl) cfEl.classList.remove('on');
    _pendingCommit = false;
  }

  function _commitItem() {
    var cfEl = _el('fork-confirm');
    if (cfEl) cfEl.classList.remove('on');

    global.GilbaDSM.commit(_curSel);
    if (_scenarioKey) global.GilbaDSM.setScenarioLock(_scenarioKey);

    _renderLeft(_curSel);
    _updateQueueItemState(_curSel);
    var sc = _sc;
    _updatePressure(sc);
    setTimeout(function () { _advanceToNextPending(sc); }, 400);
  }

  function _onDefer() {
    var item = _items[_curSel];
    if (!item) return;
    // Friction inversion for act-on items: flash the defer button
    if (item.tier === 'act-on') {
      var deferBtn = _el('fork-defer-btn');
      if (deferBtn) {
        deferBtn.style.background = 'var(--gaip-warning-bg)';
        setTimeout(function () { deferBtn.style.background = ''; }, 600);
      }
    }
    var dpEl = _el('fork-defer-panel');
    if (dpEl) {
      dpEl.classList.toggle('on');
      if (dpEl.classList.contains('on')) _updateDeferPenalty('today');
    }
  }

  function _setDefer(btn, horizon) {
    document.querySelectorAll('#gaip-decision-panel .gdp-fdp-opt').forEach(function (b) { b.classList.remove('on'); });
    btn.classList.add('on');
    _deferHorizon = horizon;
    _updateDeferPenalty(horizon);
  }

  function _updateDeferPenalty(horizon) {
    var item = _items[_curSel];
    var p = (item && item.deferPenalties && item.deferPenalties[horizon]) || '';
    var el = _el('fdp-penalty');
    if (el) {
      el.textContent = p;
      el.className = 'gdp-fdp-penalty' + (p && (p.toLowerCase().indexOf('risk') !== -1 || p.toLowerCase().indexOf('serious') !== -1) ? ' hi' : '');
    }
  }

  function _confirmDefer() {
    global.GilbaDSM.defer(_curSel, _deferHorizon);
    var dpEl = _el('fork-defer-panel');
    if (dpEl) dpEl.classList.remove('on');
    _renderLeft(_curSel);
    _updateQueueItemState(_curSel);
    var sc = _sc;
    _updatePressure(sc);
    setTimeout(function () { _advanceToNextPending(sc); }, 300);
  }

  function _undoDisposition() {
    global.GilbaDSM.undo(_curSel, _items);
    _renderLeft(_curSel);
    _updateQueueItemState(_curSel);
    _updatePressure(_sc);
  }

  function _updateQueueItemState(k) {
    var el = document.getElementById('gdp-qi-' + k);
    if (!el) return;
    var disp = global.GilbaDSM.DISPOSITION[k] || { state: 'pending' };
    el.classList.remove('committed', 'deferred');
    if (disp.state === 'committed') el.classList.add('committed');
    if (disp.state === 'deferred')  el.classList.add('deferred');
  }

  function _advanceToNextPending(sc) {
    var keys = (sc.aKeys || []).concat(sc.wKeys || []);
    var next = null;
    for (var i = 0; i < keys.length; i++) {
      var k = keys[i];
      if (k !== _curSel && global.GilbaDSM.DISPOSITION[k] && global.GilbaDSM.DISPOSITION[k].state === 'pending') {
        next = k; break;
      }
    }
    if (next) _selItem(next);
  }

  // =========================================================================
  // FULL RENDER
  // =========================================================================

  function _fullRender() {
    if (!_scaffoldBuilt) return; // scaffold not ready yet
    if (!global.GilbaDSM) return;

    var built = global.GilbaDSM.buildFromEngines();
    _items = built.items;
    _sc    = built.sc;

    var hasItems = Object.keys(_items).length > 0;

    // Placeholder / body visibility
    var phEl   = _el('placeholder');
    var bodyEl = _el('body-inner');
    if (phEl)   phEl.style.display   = hasItems ? 'none' : 'flex';
    if (bodyEl) bodyEl.style.display = hasItems && !_collapsed ? 'flex' : 'none';

    if (!hasItems) return;

    // Seed curSel
    if (!_curSel || !_items[_curSel]) {
      _curSel = _sc.defSel || Object.keys(_items)[0] || '';
    }

    _renderCounts(_sc);
    _renderQueue(_sc);
    _buildAllSVBlocks();
    if (_curSel) _renderLeft(_curSel);
    _updatePressure(_sc);
  }

  // =========================================================================
  // DOM SCAFFOLD
  // =========================================================================

  function _buildScaffold() {
    _panel = document.getElementById('gaip-decision-panel');
    if (!_panel) return; // container not in page — skip silently

    _panel.innerHTML =
      // Header
      '<div class="gdp-header" id="gdp-header-toggle">'
        + '<div class="gdp-header-lbl">Decision Engine</div>'
        + '<div class="gdp-header-state" id="gdp-header-state"></div>'
        + '<div class="gdp-header-chevron">&#9660;</div>'
      + '</div>'

      // Ctx bar
      + '<div class="gdp-ctx-bar" id="gdp-ctx-bar">'
        + '<div class="gdp-ctx-state"><div class="gdp-ctx-hl ok" id="gdp-ctx-hl">Run analysis to begin</div></div>'
        + '<div class="gdp-ctx-counts" id="gdp-ctx-counts"></div>'
      + '</div>'

      // Body wrapper (flex row inside)
      + '<div class="gdp-body" id="gdp-body">'
        + '<div class="gdp-body-inner" id="gdp-body-inner">'

          // Left panel
          + '<div class="gdp-left" id="gdp-left">'
            + '<div class="gdp-pb">'
              + '<div class="gdp-pb-mod" id="gdp-pb-mod"></div>'
              + '<div class="gdp-pb-action" id="gdp-pb-action"></div>'
            + '</div>'
            + '<div class="gdp-pb-trigger" id="gdp-pb-trigger"></div>'
            + '<div class="gdp-pb-pressure" id="gdp-pb-pressure"></div>'
            + '<div class="gdp-pb-visual" id="gdp-pb-visual"></div>'
            + '<div class="gdp-pb-divider"></div>'
            + '<div class="gdp-sb" id="gdp-sb"></div>'

            // Fork
            + '<div class="gdp-fork" id="gdp-fork">'
              + '<div class="gdp-fork-pending" id="gdp-fork-pending">'
                + '<div class="gdp-fork-confirm" id="gdp-fork-confirm">'
                  + '<div class="gdp-fork-confirm-txt" id="gdp-fork-confirm-txt"></div>'
                  + '<div class="gdp-fork-confirm-btns">'
                    + '<button class="gdp-fork-confirm-ok" id="gdp-fork-confirm-ok">Confirm and act</button>'
                    + '<button class="gdp-fork-confirm-cancel" id="gdp-fork-confirm-cancel">Cancel</button>'
                  + '</div>'
                + '</div>'
                + '<div class="gdp-fork-diverge" id="gdp-fork-diverge">Scenario projects a different outcome. Confirm you are acting on current conditions.</div>'
                + '<div class="gdp-fork-actions">'
                  + '<button class="gdp-fork-act high" id="gdp-fork-act-btn"><span id="gdp-fork-act-lbl">Act today</span><span>&#8594;</span></button>'
                  + '<button class="gdp-fork-defer" id="gdp-fork-defer-btn"><div><div id="gdp-fork-defer-lbl">Defer</div><div class="gdp-fork-defer-sub" id="gdp-fork-defer-sub">choose when</div></div><span style="color:var(--gaip-text-muted)">&#8595;</span></button>'
                + '</div>'
                + '<div class="gdp-fork-defer-panel" id="gdp-fork-defer-panel">'
                  + '<div class="gdp-fdp-lbl" id="gdp-fdp-lbl">Defer until</div>'
                  + '<div class="gdp-fdp-options" id="gdp-fdp-options">'
                    + '<button class="gdp-fdp-opt on" data-defer="today">Later today</button>'
                    + '<button class="gdp-fdp-opt" data-defer="tomorrow">Tomorrow</button>'
                    + '<button class="gdp-fdp-opt" data-defer="week">This week</button>'
                  + '</div>'
                  + '<div class="gdp-fdp-penalty" id="gdp-fdp-penalty"></div>'
                  + '<button class="gdp-fdp-confirm" id="gdp-fdp-confirm">Confirm deferral</button>'
                + '</div>'
              + '</div>'
              + '<div class="gdp-fork-committed" id="gdp-fork-committed">'
                + '<div style="flex:1;">'
                  + '<div class="gdp-fc-txt" id="gdp-fc-txt">Decision recorded</div>'
                  + '<div class="gdp-fc-sub" id="gdp-fc-sub"></div>'
                + '</div>'
                + '<button class="gdp-fc-undo" id="gdp-fc-undo">Undo</button>'
              + '</div>'
              + '<div class="gdp-fork-deferred" id="gdp-fork-deferred">'
                + '<div><div class="gdp-fd-txt" id="gdp-fd-txt">Deferred</div><div class="gdp-fd-sub" id="gdp-fd-sub"></div></div>'
                + '<button class="gdp-fd-undo" id="gdp-fd-undo">Undo</button>'
              + '</div>'
              + '<div class="gdp-fork-cleared" id="gdp-fork-cleared">'
                + '<div class="gdp-fclr-txt" id="gdp-fclr-txt">Monitoring, no action required</div>'
              + '</div>'
            + '</div>'
          + '</div>' // end left

          // Right panel
          + '<div class="gdp-right">'
            + '<div class="gdp-rail-hdr"><div class="gdp-rail-lbl" id="gdp-rail-lbl">Actions</div></div>'
            + '<div class="gdp-qlist" id="gdp-qlist"></div>'
            + '<div class="gdp-sup-card" id="gdp-support-card">'
              + '<div class="gdp-sup-hdr"><div class="gdp-sup-hdr-lbl" id="gdp-support-hdr-label">If you delay:</div></div>'
              + '<div id="gdp-sv-body"></div>'
            + '</div>'
          + '</div>'

        + '</div>' // end body-inner

        // Placeholder
        + '<div class="gdp-placeholder" id="gdp-placeholder">Run analysis to generate decisions</div>'

      + '</div>'; // end body

    _scaffoldBuilt = true;
    _wireEvents();
  }

  function _wireEvents() {
    // Header collapse
    var hdr = _el('header-toggle');
    if (hdr) {
      hdr.addEventListener('click', function () {
        _collapsed = !_collapsed;
        _panel.classList.toggle('gdp-collapsed', _collapsed);
        var bi = _el('body-inner');
        if (bi) bi.style.display = _collapsed ? 'none' : 'flex';
        var ph = _el('placeholder');
        if (ph && !_collapsed && Object.keys(_items).length === 0) ph.style.display = 'flex';
      });
    }

    // Fork buttons
    var actBtn = _el('fork-act-btn');
    if (actBtn) actBtn.addEventListener('click', _onAct);

    var deferBtn = _el('fork-defer-btn');
    if (deferBtn) deferBtn.addEventListener('click', _onDefer);

    var confirmOk = _el('fork-confirm-ok');
    if (confirmOk) confirmOk.addEventListener('click', _commitItem);

    var confirmCancel = _el('fork-confirm-cancel');
    if (confirmCancel) confirmCancel.addEventListener('click', _cancelConfirm);

    var fdpConfirm = _el('fdp-confirm');
    if (fdpConfirm) fdpConfirm.addEventListener('click', _confirmDefer);

    var fcUndo = _el('fc-undo');
    if (fcUndo) fcUndo.addEventListener('click', _undoDisposition);

    var fdUndo = _el('fd-undo');
    if (fdUndo) fdUndo.addEventListener('click', _undoDisposition);

    // Defer horizon (delegated)
    var fdpOpts = _el('fdp-options');
    if (fdpOpts) {
      fdpOpts.addEventListener('click', function (e) {
        var btn = e.target.closest('[data-defer]');
        if (btn) _setDefer(btn, btn.getAttribute('data-defer'));
      });
    }
  }

  // =========================================================================
  // PUBLIC — ENGINE UPDATE HOOK (called by GilbaDSM._ui)
  // =========================================================================

  function onEngineUpdate() { _fullRender(); }

  // =========================================================================
  // INIT
  // =========================================================================

  function init() {
    _buildScaffold();

    document.addEventListener('gaip:orchestrator-complete', function () {
      _fullRender();
    });
    document.addEventListener('gaip:site-changed', function () { _fullRender(); });
    document.addEventListener('gaip:site-switch',  function () { _fullRender(); });
    // b35fix237: re-render when cascade async fetch completes so spray FRAC
    // warnings populate in the decision panel.
    document.addEventListener('gaip:spray-context-loaded', function () { _fullRender(); });

    // Attach UI hook to engine
    if (global.GilbaDSM) {
      global.GilbaDSM._ui = { onEngineUpdate: onEngineUpdate };
    }

    // Render immediately if engine globals already populated (late-load)
    if (global.GAIP_DISEASE_RESULT || global.GAIP_PGR_RESULT || global.GAIP_IrrigationResults) {
      _fullRender();
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // =========================================================================
  // EXPORT — scenario panel wiring
  // =========================================================================

  global.GilbaDSMUI = {
    /**
     * Called by gaip-whatif-ui.js when a preset is loaded or reset.
     * @param {string|null} key - preset key ('hot', 'drought', etc.) or null to reset
     */
    setScenarioKey: function (key) {
      _scenarioKey = key || null;
      if (_curSel && _items[_curSel]) _renderFork(_curSel);
    },
    refresh: _fullRender
  };

}(window));
