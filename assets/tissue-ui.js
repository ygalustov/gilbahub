/* =========================================================================
   Gilba Tissue Testing Module — UI (standalone)
   Depends on: tissue-engine.js, tissue-interpretation.js
   Renders into: #gaipTissueModule
   Exports last run contract to: window.__GAIP_TISSUE_LAST__
   ========================================================================= */

(function(){
  "use strict";

  function ready(fn){
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", fn);
    else fn();
  }

  var ELEMENTS = [
    { k:"N",  unit:"%",    macro:true },
    { k:"P",  unit:"%",    macro:true },
    { k:"K",  unit:"%",    macro:true },
    { k:"Ca", unit:"%",    macro:true },
    { k:"Mg", unit:"%",    macro:true },
    { k:"S",  unit:"%",    macro:true },
    { k:"Fe", unit:"mgkg", macro:false },
    { k:"Mn", unit:"mgkg", macro:false },
    { k:"Zn", unit:"mgkg", macro:false },
    { k:"Cu", unit:"mgkg", macro:false },
    { k:"B",  unit:"mgkg", macro:false },
    { k:"Na", unit:"mgkg", macro:false }
  ];

  function renderShell(root){
    root.innerHTML =
      '<div class="gaip-card">' +
        '<div class="gaip-card-head">' +
          '<div class="gaip-title">Tissue Testing</div>' +
          '<div class="gaip-sub">Validate plant uptake to complement soil MLSN.</div>' +
        '</div>' +

        '<div style="margin-bottom: 8px; display: flex; align-items: center; gap: 10px; padding: 0 12px; flex-wrap: wrap;">' +
          '<label style="margin: 0; min-width: fit-content; font-weight: 600; color: var(--gaip-text-secondary); font-size: 12px;">Sample ID:</label>' +
          '<input type="text" class="gaip-tissue-sample-label" placeholder="e.g. Green 1, Fairway 7" style="padding: 4px 8px; border: 1px solid var(--gaip-border); border-radius: 4px; font-size: 13px; color: var(--gaip-text); max-width: 220px; flex: 1;">' +
        '</div>' +

        '<div style="margin-bottom: 12px; display: flex; align-items: center; gap: 10px; padding: 0 12px;">' +
          '<label style="margin: 0; min-width: fit-content; font-weight: 600; color: var(--gaip-text-secondary); font-size: 12px;">Tissue test date:</label>' +
          '<input type="date" class="gaip-tissue-date" style="padding: 4px 8px; border: 1px solid var(--gaip-border); border-radius: 4px; font-size: 13px; color: var(--gaip-text); max-width: 160px;">' +
          '<small style="color: var(--gaip-text-muted); font-size: 11px;">Collection date from lab report</small>' +
        '</div>' +

        '<div class="gaip-grid">' +

          '<label>Species' +
            '<select class="gaip-inp" data-tissue="speciesGroup">' +
              '<option value="bentgrass">Bentgrass (C3)</option>' +
              '<option value="perennialRyegrass">Perennial Ryegrass (C3)</option>' +
              '<option value="fineFescue">Fine Fescue (C3)</option>' +
              '<option value="poaAnnua">Poa annua (C3)</option>' +
              '<option value="couch">Couch / Bermuda (C4)</option>' +
            '</select>' +
          '</label>' +

          '<label>Growth State' +
            '<select class="gaip-inp" data-tissue="growthState">' +
              '<option value="active">Active growth</option>' +
              '<option value="establishment">Establishment</option>' +
              '<option value="stress">Stress / suppression</option>' +
            '</select>' +
          '</label>' +

          '<label>Sample Type' +
            '<select class="gaip-inp" data-tissue="sampleType">' +
              '<option value="whole-leaf">Whole leaf</option>' +
              '<option value="yfel">Youngest fully expanded leaf</option>' +
            '</select>' +
          '</label>' +

          '<label>PGR Applied' +
            '<select class="gaip-inp" data-tissue="pgr">' +
              '<option value="">No</option>' +
              '<option value="TE">Trinexapac-ethyl</option>' +
              '<option value="PBZ">Paclobutrazol</option>' +
              '<option value="MH">Maleic hydrazide</option>' +
            '</select>' +
          '</label>' +

        '</div>' +

        '<div class="gaip-divider"></div>' +

        '<div class="gaip-tablewrap">' +
          '<table class="gaip-table">' +
            '<thead>' +
              '<tr>' +
                '<th>Element</th>' +
                '<th>Value</th>' +
                '<th>Unit</th>' +
                '<th>Range</th>' +
                '<th>Status</th>' +
              '</tr>' +
            '</thead>' +
            '<tbody id="gaipTissueRows"></tbody>' +
          '</table>' +
        '</div>' +

        '<div class="gaip-actions">' +
          '<button class="gaip-btn" id="gaipTissueRun" type="button">Run Tissue Interpretation</button>' +
        '</div>' +

        '<div class="gaip-divider"></div>' +

        '<div class="gaip-out">' +
          '<div class="gaip-out-title">Interpretation</div>' +
          '<div class="gaip-out-body" id="gaipTissueOut">' +
            '<div style="padding:15px; background:var(--gaip-info-bg); border-left:3px solid var(--gaip-info); border-radius:4px; color:var(--gaip-text);">' +
              '<p style="margin:0 0 10px 0;"><strong>Ready to interpret tissue test results</strong></p>' +
              '<p style="margin:0; font-size:13px;">Enter your tissue test values in the table above, then click "Run Tissue Interpretation" to see:</p>' +
              '<ul style="margin:5px 0; padding-left:20px; font-size:13px;">' +
                '<li>Sufficiency status for each nutrient (Deficient, Marginal, Sufficient, High)</li>' +
                '<li>Most likely limiting nutrients</li>' +
                '<li>Antagonism warnings (K-Mg, P-Zn, etc.)</li>' +
                '<li>Growth dilution patterns</li>' +
                '<li>Recommended correction strategy</li>' +
              '</ul>' +
            '</div>' +
          '</div>' +
        '</div>' +
      '</div>';
  }

  function buildRows(rowsEl){
    var html = "";
    for (var i=0;i<ELEMENTS.length;i++){
      var e = ELEMENTS[i];
      html += '<tr data-el="'+e.k+'">' +
        '<td>'+e.k+'</td>' +
        '<td><input class="gaip-inp" style="width:120px" data-val="'+e.k+'" inputmode="decimal" placeholder=""></td>' +
        '<td><select class="gaip-inp" style="width:110px" data-unit="'+e.k+'">' +
          (e.macro
            ? '<option value="%">%</option><option value="mgkg">mg/kg</option>'
            : '<option value="mgkg">mg/kg</option><option value="%">%</option>') +
        '</select></td>' +
        '<td data-range="'+e.k+'">—</td>' +
        '<td data-band="'+e.k+'">—</td>' +
      '</tr>';
    }
    rowsEl.innerHTML = html;
  }

  function getMeta(root){
    var sel = root.querySelectorAll("[data-tissue]");
    var m = { context:{} };
    for (var i=0;i<sel.length;i++){
      var el = sel[i];
      var key = el.getAttribute("data-tissue");
      var val = (el.value || "").trim();
      if (key === "pgr") { if (val) m.context.pgr = val; }
      else m[key] = val;
    }
    return m;
  }

  function getInputs(root){
    var t = {}, u = {};
    for (var i=0;i<ELEMENTS.length;i++){
      var k = ELEMENTS[i].k;
      var vEl = root.querySelector('[data-val="'+k+'"]');
      var uEl = root.querySelector('[data-unit="'+k+'"]');
      var n = vEl ? parseFloat(vEl.value) : NaN;
      if (!isFinite(n)) continue;
      t[k] = n;
      u[k] = uEl ? uEl.value : (ELEMENTS[i].macro ? "%" : "mgkg");
    }
    return { tissue:t, units:u };
  }

  function fmtRange(r, isMacro){
    if (!r) return "—";
    if (isMacro) {
      function tidy(x){ return (Math.round(x*100)/100).toString().replace(/\.00$/,""); }
      return tidy(r.lo) + "–" + tidy(r.hi) + " %";
    }
    return r.lo + "–" + r.hi + " mg/kg";
  }

  function renderRanges(root, res){
    var ranges = res.ranges;
    for (var i=0;i<ELEMENTS.length;i++){
      var e = ELEMENTS[i];
      var r = e.macro ? ranges.macros[e.k] : ranges.traces[e.k];  // Changed from .micros to .traces
      var cell = root.querySelector('[data-range="'+e.k+'"]');
      if (cell) cell.textContent = fmtRange(r, e.macro);
    }
  }

  function renderBands(root, res){
    var st = res.status || {};
    for (var i=0;i<ELEMENTS.length;i++){
      var k = ELEMENTS[i].k;
      var b = (st[k] && st[k].band) ? st[k].band : "Missing";
      var cell = root.querySelector('[data-band="'+k+'"]');
      if (cell) {
        cell.textContent = b;
        cell.className = "band-" + b;
      }
    }
  }

  function renderInterpretation(outEl, intp){
    var html = "";
    html += "<div><strong>"+intp.headline+"</strong></div>";
    html += "<ul>";
    for (var i=0;i<intp.summary.length;i++) html += "<li>"+intp.summary[i]+"</li>";
    html += "</ul>";
    html += "<div><strong>Decision bias</strong></div><ul>";
    for (var j=0;j<intp.decisionBias.length;j++) html += "<li>"+intp.decisionBias[j]+"</li>";
    html += "</ul>";
    outEl.innerHTML = html;
  }

  function run(root, outEl){
    if (!window.GilbaTissueEngine || !window.GilbaTissueInterpretation) {
      outEl.innerHTML = '<div style="padding:15px; background:#fee; border-left:3px solid #f00; border-radius:4px;">' +
        '<strong>Error:</strong> Missing required files (tissue-engine.js and tissue-interpretation.js).' +
        '<br><br>Please verify plugin files are uploaded correctly.</div>';
      return;
    }

    var meta = getMeta(root);
    var io = getInputs(root);

    // Validate that at least some values are entered
    var nutrientCount = Object.keys(io.tissue).length;
    if (nutrientCount === 0) {
      outEl.innerHTML = '<div style="padding:15px; background:var(--gaip-warning-bg); border-left:3px solid #f59e0b; border-radius:4px;">' +
        '<strong>No values entered</strong>' +
        '<p style="margin:10px 0 0 0;">Please enter tissue test results in the table above. At minimum, provide values for:</p>' +
        '<ul style="margin:5px 0; padding-left:20px;">' +
        '<li><strong>N</strong> (Nitrogen %)</li>' +
        '<li><strong>P</strong> (Phosphorus %)</li>' +
        '<li><strong>K</strong> (Potassium %)</li>' +
        '</ul>' +
        '<p style="margin:5px 0 0 0; font-size:12px; color:#92400e;">Example: N = 4.5, P = 0.40, K = 2.5</p>' +
        '</div>';
      return;
    }

    // Check if minimum nutrients provided
    var hasMinimum = io.tissue.N !== undefined || io.tissue.P !== undefined || io.tissue.K !== undefined;
    if (!hasMinimum) {
      outEl.innerHTML = '<div style="padding:15px; background:var(--gaip-warning-bg); border-left:3px solid #f59e0b; border-radius:4px;">' +
        '<strong>Insufficient data</strong>' +
        '<p style="margin:10px 0 0 0;">You entered ' + nutrientCount + ' nutrient(s), but interpretation requires at least one primary nutrient (N, P, or K).</p>' +
        '</div>';
      return;
    }

    var res = window.GilbaTissueEngine.compute({
      speciesGroup: meta.speciesGroup,
      growthState: meta.growthState,
      sampleType: meta.sampleType,
      tissue: io.tissue,
      units: io.units,
      context: meta.context
    });

    renderRanges(root, res);
    renderBands(root, res);

    var intp = window.GilbaTissueInterpretation.interpret(res);
    renderInterpretation(outEl, intp);

    // Integration contract: Export for hub integration
    // Format expected by soil-tissue-integration.js
    window.__GAIP_TISSUE_LAST__ = {
      testDate: root.querySelector(".gaip-tissue-date")?.value || null,
      status: res.status,  // Full status objects with {band, value}
      normalized: res.normalized,  // Actual nutrient values
      meta: {
        speciesGroup: res.meta.speciesGroup,
        growthState: res.meta.growthState,
        sampleType: res.meta.sampleType
      },
      context: res.context,
      summary: intp.summary,  // Array of interpretation messages
      headline: intp.headline,
      decisionBias: intp.decisionBias,
      limitingNutrients: res.limitingNutrients,
      antagonisms: res.antagonisms,
      dilutionFlags: res.dilutionFlags,
      stressSignal: !!res.stressSignal,
      naFlag: res.naFlag || null
    };
  }

  ready(function(){
    var root = document.getElementById("gaipTissueModule");
    if (!root) return; // shortcode not present on page

    renderShell(root);
    var rowsEl = root.querySelector("#gaipTissueRows");
    var outEl  = root.querySelector("#gaipTissueOut");
    var btn    = root.querySelector("#gaipTissueRun");

    buildRows(rowsEl);
    btn.addEventListener("click", function(){ run(root, outEl); });
  });

})();
