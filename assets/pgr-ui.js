/**
 * ============================================================================
 * GILBA PGR UI v2.0.0
 * ============================================================================
 *
 * Progressive disclosure UI for PGR module.
 *
 * v2.0.0 (b35fix178):
 *   - Split into initPGRPanel() + updatePGRPanel() to eliminate innerHTML
 *     clobber of input values on every cascade cycle.
 *   - Colocated inputs (PGR + DMI) rendered once in initPGRPanel(); never
 *     touched again by updatePGRPanel().
 *   - Input fields carry data-autofilled attribute managed by spray-log-cascade
 *     autofill. Cleared to "false" on first user keystroke so cascade will not
 *     overwrite manual entries on subsequent site-switches.
 *   - Reapplication window corrected: 'approaching' at 60% GDD, 'due' at 75%
 *     (Kreuser & Soldat 2011). GDD bar tick marks 75% window opener.
 *   - DMI combined suppression warning appears inline in projection footer
 *     when adjustedSuppression.addedPct > 0.
 *   - renderPGRStatus() retained as backward-compatible alias for hub-tissue-v3.
 *
 * ============================================================================
 */

(function(global) {
    'use strict';

    // =========================================================================
    // CSS
    // =========================================================================

    const PGR_UI_CSS = `
        .pgr-module {
            margin: 16px 0;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        }

        .pgr-card {
            background: linear-gradient(135deg, var(--gaip-info-bg) 0%, var(--gaip-info-bg) 100%);
            border-radius: 12px;
            border: 1px solid var(--gaip-info-bg);
            overflow: hidden;
        }

        .pgr-card.due {
            background: linear-gradient(135deg, var(--gaip-warning-bg) 0%, var(--gaip-warning-border) 100%);
            border-color: #fbbf24;
        }

        .pgr-card.suspended {
            background: linear-gradient(135deg, var(--gaip-critical-bg) 0%, var(--gaip-critical-border) 100%);
            border-color: #f87171;
        }

        /* ── Header ── */
        .pgr-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 12px 16px;
            border-bottom: 1px solid rgba(0,0,0,0.06);
        }

        .pgr-title {
            font-weight: 600;
            color: #581c87;
            display: flex;
            align-items: center;
            gap: 8px;
        }

        .pgr-product-badge {
            font-size: 11px;
            padding: 2px 8px;
            border-radius: 10px;
            background: #a855f7;
            color: var(--gaip-surface);
        }

        .pgr-status-badge {
            font-size: 12px;
            padding: 4px 10px;
            border-radius: 12px;
            font-weight: 500;
        }

        .pgr-status-badge.recent     { background: var(--gaip-good-bg); color: #166534; }
        .pgr-status-badge.active     { background: var(--gaip-info-bg); color: #1e40af; }
        .pgr-status-badge.approaching{ background: var(--gaip-warning-bg); color: #92400e; }
        .pgr-status-badge.due        { background: var(--gaip-critical-bg); color: #991b1b; }

        /* ── GDD strip ── */
        .pgr-gdd-section {
            padding: 12px 16px;
            border-bottom: 1px solid rgba(0,0,0,0.06);
        }

        .pgr-gdd-header {
            display: flex;
            justify-content: space-between;
            align-items: baseline;
            margin-bottom: 8px;
        }

        .pgr-gdd-label { font-size: 13px; color: var(--gaip-text); }

        .pgr-gdd-value {
            font-size: 18px;
            font-weight: 700;
            color: #7c3aed;
        }

        .pgr-gdd-bar {
            height: 16px;
            background: var(--gaip-border);
            border-radius: 8px;
            overflow: visible;
            position: relative;
        }

        .pgr-gdd-fill {
            height: 100%;
            border-radius: 8px;
            transition: width 0.3s ease;
            background: linear-gradient(90deg, #a855f7, #7c3aed);
        }

        .pgr-gdd-fill.approaching { background: linear-gradient(90deg, #fbbf24, #f59e0b); }
        .pgr-gdd-fill.due         { background: linear-gradient(90deg, #f87171, #ef4444); }

        /* Reapplication window tick — amber line at 75% */
        .pgr-reapply-tick {
            position: absolute;
            top: -3px;
            left: 75%;
            width: 2px;
            height: 22px;
            background: #f59e0b;
            border-radius: 1px;
            pointer-events: none;
        }

        .pgr-gdd-markers {
            display: flex;
            justify-content: space-between;
            margin-top: 4px;
            font-size: 10px;
            color: var(--gaip-text);
            position: relative;
        }

        /* ── Metrics ── */
        .pgr-metrics {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(80px, 1fr));
            gap: 0;
            border-bottom: 1px solid rgba(0,0,0,0.06);
        }

        .pgr-metric {
            text-align: center;
            padding: 10px 8px;
            border-right: 1px solid rgba(0,0,0,0.06);
        }
        .pgr-metric:last-child { border-right: none; }

        .pgr-metric-value {
            font-size: 20px;
            font-weight: 700;
            color: var(--gaip-text);
        }

        .pgr-metric-label {
            font-size: 10px;
            color: var(--gaip-text);
            text-transform: uppercase;
            letter-spacing: 0.04em;
            margin-top: 2px;
        }

        /* ── Projection footer ── */
        .pgr-projection {
            padding: 8px 16px;
            border-bottom: 1px solid rgba(0,0,0,0.06);
        }

        /* ── Shade warning ── */
        .pgr-shade-warning {
            margin: 8px 16px;
            padding: 8px 12px;
            border-radius: 8px;
            display: flex;
            align-items: center;
            gap: 8px;
            font-size: 13px;
        }

        .pgr-shade-warning.suspend { background:var(--gaip-critical-bg); color:#991b1b; border:1px solid var(--gaip-critical-border); }
        .pgr-shade-warning.reduce  { background:var(--gaip-warning-bg); color:#92400e; border:1px solid var(--gaip-warning-border); }
        .pgr-shade-warning.caution { background:var(--gaip-warning-bg); color:#9a3412; border:1px solid var(--gaip-warning-border); }

        /* ── Colocated body: inputs left, chart right ── */
        .pgr-colocation-body {
            display: grid;
            grid-template-columns: 272px 1fr;
            border-top: 1px solid rgba(0,0,0,0.06);
        }

        @media (max-width: 600px) {
            .pgr-colocation-body { grid-template-columns: 1fr; }
            .pgr-inputs-panel { border-right: none !important; border-bottom: 1px solid rgba(0,0,0,0.06); }
        }

        /* ── Inputs panel ── */
        .pgr-inputs-panel {
            padding: 14px 16px;
            border-right: 1px solid rgba(0,0,0,0.06);
            display: flex;
            flex-direction: column;
            gap: 10px;
        }

        .pgr-inputs-section-label {
            font-size: 10px;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 0.08em;
            color: var(--gaip-text-muted);
        }

        .pgr-field { display: flex; flex-direction: column; gap: 3px; }

        .pgr-field label {
            font-size: 11px;
            font-weight: 600;
            color: var(--gaip-text-secondary);
            text-transform: uppercase;
            letter-spacing: 0.05em;
        }

        .pgr-field input,
        .pgr-field select {
            width: 100%;
            padding: 6px 8px;
            border: 1px solid var(--gaip-border);
            border-radius: 6px;
            font-size: 13px;
            color: var(--gaip-text);
            background: var(--gaip-surface);
            outline: none;
            transition: border-color 0.15s;
        }

        .pgr-field input:focus,
        .pgr-field select:focus {
            border-color: #7c3aed;
            box-shadow: 0 0 0 2px var(--gaip-info-bg);
        }

        .pgr-field-row {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 8px;
        }

        .pgr-dmi-divider {
            border: none;
            border-top: 1px dashed var(--gaip-border);
            margin: 2px 0;
        }

        /* "From spray log" autofill badge */
        .pgr-autofill-badge {
            font-size: 10px;
            color: #7c3aed;
            margin-top: 2px;
            display: none;
        }
        .pgr-autofill-badge.visible { display: block; }

        .pgr-spray-link {
            font-size: 11px;
            color: #7c3aed;
            text-align: center;
            text-decoration: none;
            display: block;
            margin-top: 2px;
        }

        /* Log buttons — b35fix232 */
        .pgr-log-actions { display:flex; gap:8px; margin-top:10px; padding-top:8px; border-top:1px solid rgba(0,0,0,0.06); }
        .pgr-log-btn { flex:1; padding:5px 10px; border-radius:4px; font-size:11px; font-weight:500; cursor:pointer; border:none; transition:background .15s; }
        .pgr-log-btn-pgr { background:#4f46e5; color:var(--gaip-surface); }
        .pgr-log-btn-pgr:hover { background:#4338ca; }
        .pgr-log-btn-dmi { background:#0891b2; color:var(--gaip-surface); }
        .pgr-log-btn-dmi:hover { background:#0e7490; }
        .pgr-log-btn:disabled { opacity:.5; cursor:not-allowed; }

        /* ── Chart panel ── */
        .pgr-chart-panel {
            padding: 14px 16px;
            display: flex;
            flex-direction: column;
            gap: 6px;
            min-height: 180px;
        }

        .pgr-chart-title {
            font-size: 12px;
            font-weight: 600;
            color: var(--gaip-text-secondary);
        }

        /* ── Source footer ── */
        .pgr-source {
            padding: 8px 16px;
            font-size: 11px;
            color: var(--gaip-text-secondary);
            border-top: 1px solid rgba(0,0,0,0.06);
        }

        /* DMI inline block (appended by hub-tissue) */
        .pgr-dmi-block {
            margin: 0 16px 12px;
            border-radius: 8px;
            overflow: hidden;
        }
    `;

    // =========================================================================
    // HELPERS
    // =========================================================================

    function injectCSS() {
        if (document.getElementById('pgr-ui-styles')) return;
        const style = document.createElement('style');
        style.id = 'pgr-ui-styles';
        style.textContent = PGR_UI_CSS;
        document.head.appendChild(style);
    }

    function getStatusText(status) {
        switch (status) {
            case 'recent':     return 'Recently Applied';
            case 'active':     return 'Active';
            case 'approaching':return 'Approaching Window';
            case 'due':        return 'Reapply Now';
            default:           return status;
        }
    }

    function setText(el, val) {
        if (el && el.textContent !== String(val)) el.textContent = val;
    }

    function setAttr(el, attr, val) {
        if (el) el.setAttribute(attr, val);
    }

    function setStyle(el, prop, val) {
        if (el) el.style[prop] = val;
    }

    // =========================================================================
    // INIT — write skeleton HTML once, attach input listeners
    // =========================================================================

    /**
     * Write the full card skeleton into container.
     * Called ONCE: on first render, and again on site-switch (container cleared
     * by hub-tissue). Never called during normal cascade updates.
     *
     * All input fields are written here and never touched by updatePGRPanel().
     * Spray-log-cascade autofill writes to these fields via CSS class selectors
     * (.gaip-pgr-date, .gaip-pgr-product, .gaip-pgr-rate, .gaip-pgr-gdd,
     *  .gaip-dmi-date, .gaip-dmi-product, .gaip-dmi-rate) — same selectors
     * read by hub-tissue-v3.js lines 978-987. No additional wiring needed.
     */
    function initPGRPanel(container, pgrStatus) {
        injectCSS();

        const status = pgrStatus.effect.reapplicationStatus;
        const shadeStatus = pgrStatus.shade.warning.status;
        const isSuspended = shadeStatus === 'suspend';
        const threshold = pgrStatus.gdd.threshold;
        const reapplyGDD = Math.round(threshold * 0.75);

        // b35fix215: build dynamic HTML fragments before the template literal.
        // IIFEs inside template literals caused escaped \${ rendering as literal
        // text. Pre-compute here and interpolate as plain variables instead.
        const _pgrCur = pgrStatus.product.name || pgrStatus.product.type || '';
        const _pgrLastPGR = (typeof global !== 'undefined' ? global : window).GAIP_LAST_PGR;
        const _pgrLabelRates = {TE250:0.4,TE175:0.5,TE120:0.7,PBZ200:1.0,PBZ250:0.8,ANUEW:1.5,ETH:2.0};

        // Build product select with correct option pre-selected
        const _pgrSelectHTML = (function() {
            const opts = [
                ['TE250',  'TE 250g/L (Primo)'],
                ['TE175',  'TE 175g/L (Amigo 175 / Marvel 175)'],
                ['TE120',  'TE 120g/L (Amigo 120 / Primo Maxx 120)'],
                ['PBZ200', 'Paclobutrazol 200g/L'],
                ['PBZ250', 'Paclobutrazol 250g/L'],
                ['ANUEW',  'Prohexadione-Ca 27.5%'],
                ['ETH',    'Ethephon 480g/L']
            ];
            const groups = [
                { label: 'Trinexapac-ethyl', keys: ['TE250','TE175','TE120'] },
                { label: 'Paclobutrazol',    keys: ['PBZ200','PBZ250'] },
                { label: 'Prohexadione-Ca',  keys: ['ANUEW'] },
                { label: 'Ethephon',         keys: ['ETH'] }
            ];
            const optMap = Object.fromEntries(opts);
            let html = `<select class="gaip-pgr-product" data-autofilled="${_pgrCur ? 'true' : 'false'}">`;
            groups.forEach(g => {
                html += `<optgroup label="${g.label}">`;
                g.keys.forEach(k => {
                    html += `<option value="${k}"${k === _pgrCur ? ' selected' : ''}>${optMap[k]}</option>`;
                });
                html += '</optgroup>';
            });
            html += '</select>';
            return html;
        })();

        // Build rate input with pre-filled value and label-rate placeholder
        const _pgrRateVal  = _pgrLastPGR && _pgrLastPGR.rate != null ? _pgrLastPGR.rate : '';
        const _pgrRatePH   = _pgrCur && _pgrLabelRates[_pgrCur] ? 'e.g. ' + _pgrLabelRates[_pgrCur] : '0.0';
        const _pgrRateHTML = `<input type="number" class="gaip-pgr-rate" ` +
            `data-autofilled="${_pgrRateVal ? 'true' : 'false'}" min="0" step="0.05" ` +
            `placeholder="${_pgrRatePH}"${_pgrRateVal ? ` value="${_pgrRateVal}"` : ''}>`;

        container.innerHTML = `
<div class="pgr-module">
  <div class="pgr-card ${status === 'due' ? 'due' : ''} ${isSuspended ? 'suspended' : ''}" id="pgr-card-inner">

    <!-- Header: static except status badge text/class -->
    <div class="pgr-header">
      <div class="pgr-title">
        <span>🌱</span>
        <span>PGR Program</span>
        <span class="pgr-product-badge" id="pgr-ai-badge">${pgrStatus.product.activeIngredient}</span>
      </div>
      <span class="pgr-status-badge ${status}" id="pgr-status-badge">${getStatusText(status)}</span>
    </div>

    <!-- GDD strip: bar fill, value, markers updated by updatePGRPanel -->
    <div class="pgr-gdd-section">
      <div class="pgr-gdd-header">
        <span class="pgr-gdd-label" id="pgr-gdd-label">GDD Progress (base ${pgrStatus.gdd.baseTemp}°C)</span>
        <span class="pgr-gdd-value" id="pgr-gdd-value">${pgrStatus.gdd.accumulated} / ${threshold}</span>
      </div>
      <div class="pgr-gdd-bar">
        <div class="pgr-gdd-fill" id="pgr-gdd-fill" style="width:${Math.min(100, pgrStatus.gdd.progressPct)}%"></div>
        <!-- Amber tick at 75% = reapplication window (Kreuser & Soldat 2011) -->
        <div class="pgr-reapply-tick" title="Reapplication window opens (${reapplyGDD} GDD)"></div>
      </div>
      <div class="pgr-gdd-markers">
        <span>0</span>
        <span style="position:absolute;left:75%;transform:translateX(-50%);color:#d97706;font-weight:600;"
              title="Reapplication window">${reapplyGDD} ⬆</span>
        <span>${threshold}</span>
      </div>
      <div id="pgr-gdd-notices"></div>
    </div>

    <!-- Metrics: values updated by updatePGRPanel -->
    <div class="pgr-metrics">
      <div class="pgr-metric">
        <div class="pgr-metric-value" id="pgr-m-gdd">—</div>
        <div class="pgr-metric-label" id="pgr-m-gdd-label">GDD to Window</div>
      </div>
      <div class="pgr-metric">
        <div class="pgr-metric-value" id="pgr-m-supp">—</div>
        <div class="pgr-metric-label">Suppression</div>
      </div>
      <div class="pgr-metric" id="pgr-m-combined-cell" style="display:none;">
        <div class="pgr-metric-value" id="pgr-m-combined" style="color:#d97706;">—</div>
        <div class="pgr-metric-label">Combined Est. ⚠️</div>
      </div>
      <div class="pgr-metric">
        <div class="pgr-metric-value" id="pgr-m-days">—</div>
        <div class="pgr-metric-label">Days Since</div>
      </div>
    </div>

    <!-- Projection: updated by updatePGRPanel -->
    <div class="pgr-projection" id="pgr-projection"></div>

    <!-- Shade warning: updated by updatePGRPanel -->
    <div id="pgr-shade-slot"></div>

    <!-- Colocated body: inputs (left) + chart (right). NEVER rewritten. -->
    <div class="pgr-colocation-body">

      <!-- Inputs panel -->
      <div class="pgr-inputs-panel">

        <div class="pgr-inputs-section-label">PGR Application</div>

        <div class="pgr-field">
          <label>Product</label>
          ${_pgrSelectHTML}
        </div>

        <div class="pgr-field-row">
          <div class="pgr-field">
            <label>Applied</label>
            <input type="date" class="gaip-pgr-date" data-autofilled="false">
            <div class="pgr-autofill-badge" id="pgr-date-badge"></div>
          </div>
          <div class="pgr-field">
            <label>Rate (L/ha)</label>
            ${_pgrRateHTML}
          </div>
        </div>

        <div class="pgr-field-row">
          <div class="pgr-field">
            <label>GDD Threshold</label>
            <input type="number" class="gaip-pgr-gdd" data-autofilled="false"
                   value="${threshold}" min="100" max="500" step="10">
          </div>
          <div class="pgr-field">
            <label>Base Temp (°C)</label>
            <input type="number" id="pgr-base-temp" data-autofilled="false"
                   value="${pgrStatus.gdd.baseTemp}" min="-5" max="15" step="1">
          </div>
        </div>

        <hr class="pgr-dmi-divider">

        <div class="pgr-inputs-section-label">DMI Fungicide</div>

        <div id="pgr-dmi-combined-notice"></div>

        <div class="pgr-field">
          <label>Product / AI</label>
          ${(function() {
            if (window.GAIP_DMI && window.GAIP_DMI.products) {
              var opts = Object.entries(window.GAIP_DMI.products)
                .map(function(kv) { return { key: kv[0], name: kv[1].name }; })
                .sort(function(a, b) { return a.name.localeCompare(b.name); })
                .map(function(p) { return '<option value="' + p.key + '">' + p.name + '</option>'; })
                .join('');
              return '<select class="gaip-dmi-product" data-autofilled="false"><option value="">-- Select DMI product --</option>' + opts + '</select>';
            }
            return '<input type="text" class="gaip-dmi-product" data-autofilled="false" placeholder="e.g. Propiconazole 250EC">';
          })()}
        </div>

        <div class="pgr-field-row">
          <div class="pgr-field">
            <label>Applied</label>
            <input type="date" class="gaip-dmi-date" data-autofilled="false">
            <div class="pgr-autofill-badge" id="dmi-date-badge"></div>
          </div>
          <div class="pgr-field">
            <label>Rate (L/ha)</label>
            <input type="number" class="gaip-dmi-rate" data-autofilled="false" min="0" step="0.05">
          </div>
        </div>

        <a href="#spray-log" class="pgr-spray-link">View full spray log →</a>

        <div class="pgr-log-actions">
          <button class="pgr-log-btn pgr-log-btn-pgr" id="pgr-log-pgr-btn">Log PGR application</button>
          <button class="pgr-log-btn pgr-log-btn-dmi" id="pgr-log-dmi-btn">Log DMI application</button>
        </div>

      </div><!-- /.pgr-inputs-panel -->

      <!-- Chart panel: PGRForecast renders here, including its own title -->
      <div class="pgr-chart-panel">
        <div id="gaip-pgr-forecast-chart"></div>
      </div>

    </div><!-- /.pgr-colocation-body -->

    <!-- Source footer: updated by updatePGRPanel -->
    <div class="pgr-source" id="pgr-source-footer"></div>

  </div><!-- /.pgr-card -->
</div><!-- /.pgr-module -->
        `;

        // b35fix208: populate inputs from authoritative sources after skeleton write.
        // Use pgrStatus (engine result) and GAIP_STATE.pgr (DOM-read state) — both
        // are populated before initPGRPanel is called by hub-tissue-v3.
        // data-autofilled="true" keeps them eligible for spray-log-cascade updates.
        (function() {
            var state = (typeof global !== 'undefined' ? global : window);
            var pgrState = state.GAIP_STATE && state.GAIP_STATE.pgr || {};
            // Product: pgrStatus.product.name is set to e.pgr.productType by hub-tissue-v3
            var product = pgrStatus.product.name || pgrStatus.product.type || pgrState.productType || '';
            // Date: pgrStatus.applicationDate is set directly by hub-tissue-v3
            var date    = pgrStatus.applicationDate || pgrState.applicationDate || '';
            // Rate: only in pgrState (read from DOM by hub-tissue-v3 before this runs)
            var rate    = pgrState.rateLperHa != null && pgrState.rateLperHa > 0
                          ? String(pgrState.rateLperHa) : '';
            // DMI is a top-level field in GAIP_STATE (not nested under pgr)
            var dmiState   = state.GAIP_STATE && state.GAIP_STATE.dmi || {};
            var dmiProduct = dmiState.product || '';
            var dmiDate    = dmiState.applicationDate || '';
            var dmiRate    = dmiState.rateLperHa > 0 ? String(dmiState.rateLperHa) : '';

            var pd  = container.querySelector('.gaip-pgr-product');
            var di  = container.querySelector('.gaip-pgr-date');
            var ri  = container.querySelector('.gaip-pgr-rate');
            var dmp = container.querySelector('.gaip-dmi-product');
            var dmd = container.querySelector('.gaip-dmi-date');
            var dmr = container.querySelector('.gaip-dmi-rate');

            if (pd  && product)    {
                pd.value  = product;
                pd.setAttribute('data-autofilled', 'true');
                // b35fix212: dispatch change event so select displays the selected option text
                pd.dispatchEvent(new Event('change', { bubbles: false }));
            }
            if (di  && date)       { di.value  = date;       di.setAttribute('data-autofilled',  'true'); }
            if (ri  && rate)       { ri.value  = rate;       ri.setAttribute('data-autofilled',  'true'); }
            if (dmp && dmiProduct) { dmp.value = dmiProduct; dmp.setAttribute('data-autofilled', 'true'); }
            if (dmd && dmiDate)    { dmd.value = dmiDate;    dmd.setAttribute('data-autofilled', 'true'); }
            if (dmr && dmiRate)    { dmr.value = dmiRate;    dmr.setAttribute('data-autofilled', 'true'); }
        })();

        // ── Attach input listeners ──────────────────────────────────────────
        // Any field the user types in gets data-autofilled="false" locked so
        // spray-log-cascade won't overwrite it on site-switch or cascade re-run.
        container.querySelectorAll(
            '.gaip-pgr-date, .gaip-pgr-product, .gaip-pgr-rate, .gaip-pgr-gdd, ' +
            '.gaip-dmi-date, .gaip-dmi-product, .gaip-dmi-rate, #pgr-base-temp'
        ).forEach(function(el) {
            el.addEventListener('input', function() {
                this.setAttribute('data-autofilled', 'false');
                // Clear the autofill badge on the paired badge slot
                const badge = this.parentNode.querySelector('.pgr-autofill-badge');
                if (badge) badge.classList.remove('visible');
            });
        });

        // ── Log PGR / Log DMI buttons — b35fix232 ──────────────────────
        (function() {
            var PROD_INFO = {
                TE120:{name:'Primo Maxx (TE 120g/L)',ai:'trinexapac-ethyl'},
                TE175:{name:'TE 175g/L (Amigo 175)',ai:'trinexapac-ethyl'},
                TE250:{name:'Primo 250EC (TE 250g/L)',ai:'trinexapac-ethyl'},
                PRIMO250:{name:'Primo 250EC',ai:'trinexapac-ethyl'},
                PRIMO_MAXX:{name:'Primo Maxx',ai:'trinexapac-ethyl'},
                PBZ200:{name:'Paclobutrazol 200g/L',ai:'paclobutrazol'},
                PBZ250:{name:'Paclobutrazol 250g/L',ai:'paclobutrazol'},
                ANUEW:{name:'Anuew (Prohexadione-Ca)',ai:'prohexadione-calcium'},
                ETH:{name:'Ethephon 480g/L',ai:'ethephon'},
                INCOGNITO:{name:'Indigo Incognito (Ethephon)',ai:'ethephon'}
            };

            function getSiteId() {
                var SM = window.GAIP_SampleManager;
                return SM && typeof SM.getActiveSiteId === 'function' ? SM.getActiveSiteId() : null;
            }

            function logToSprayLog(entry, btn, successMsg) {
                var SL = window.GAIP_SprayLog;
                var siteId = getSiteId();
                if (!SL || !siteId) { alert('Spray log not available'); return; }
                entry.site_id = siteId;
                entry.source  = 'manual';
                btn.disabled  = true;
                btn.textContent = 'Logging...';
                SL.create(entry).then(function(result) {
                    if (result && (result.success || result.count > 0)) {
                        btn.textContent = successMsg;
                        // Refresh cascade so card updates
                        document.dispatchEvent(new CustomEvent('gaip:spray-log-updated'));
                    } else {
                        btn.textContent = 'Log failed';
                        btn.disabled = false;
                    }
                }).catch(function(e) {
                    btn.textContent = 'Error';
                    btn.disabled = false;
                });
            }

            // Log PGR button
            var pgrBtn = container.querySelector('#pgr-log-pgr-btn');
            if (pgrBtn) {
                pgrBtn.addEventListener('click', function() {
                    var prodEl = container.querySelector('.gaip-pgr-product');
                    var dateEl = container.querySelector('.gaip-pgr-date');
                    var rateEl = container.querySelector('.gaip-pgr-rate');
                    var prod = prodEl ? prodEl.value : '';
                    var date = dateEl ? dateEl.value : '';
                    var rate = rateEl ? parseFloat(rateEl.value) : null;
                    if (!prod || !date) { alert('Select a product and application date first'); return; }
                    var info = PROD_INFO[prod] || {name:prod, ai:'trinexapac-ethyl'};
                    logToSprayLog({
                        application_date: date,
                        product_name:     info.name,
                        product_key:      prod,
                        product_category: 'pgr',
                        active_ingredient: info.ai,
                        frac_group:       null,
                        rate:             rate,
                        rate_unit:        'L/ha',
                        zone:             'greens',
                        notes:            'Logged from PGR Programme status card'
                    }, pgrBtn, '✓ PGR logged');
                });
            }

            // Log DMI button
            var dmiBtn = container.querySelector('#pgr-log-dmi-btn');
            if (dmiBtn) {
                dmiBtn.addEventListener('click', function() {
                    var prodEl = container.querySelector('.gaip-dmi-product');
                    var dateEl = container.querySelector('.gaip-dmi-date');
                    var rateEl = container.querySelector('.gaip-dmi-rate');
                    var prod = prodEl ? prodEl.value : '';
                    var date = dateEl ? dateEl.value : '';
                    var rate = rateEl ? parseFloat(rateEl.value) : null;
                    if (!prod || !date) { alert('Select a DMI product and application date first'); return; }
                    // b35fix234: look up activeIngredient from GAIP_DMI by matching product name
                    var ai = prod; // fallback: use name if lookup fails
                    if (window.GAIP_DMI && window.GAIP_DMI.products) {
                        var match = Object.values(window.GAIP_DMI.products).find(function(p) { return p.name === prod; });
                        if (match && match.activeIngredient) ai = match.activeIngredient;
                    }
                    logToSprayLog({
                        application_date: date,
                        product_name:     prod,
                        product_category: 'fungicide',
                        frac_group:       '3',
                        active_ingredient: ai,
                        rate:             rate,
                        rate_unit:        'L/ha',
                        zone:             'greens',
                        target:           'disease',
                        notes:            'Logged from PGR Programme status card (DMI)'
                    }, dmiBtn, '✓ DMI logged');
                });
            }
        })();
    }

    // =========================================================================
    // UPDATE — targeted DOM writes only, never touches input values
    // =========================================================================

    /**
     * Update all dynamic display elements from fresh pgrStatus.
     * Called every cascade cycle. Does NOT touch input fields.
     */
    function updatePGRPanel(container, pgrStatus) {
        const status      = pgrStatus.effect.reapplicationStatus;
        const shadeStatus = pgrStatus.shade.warning.status;
        const isSuspended = shadeStatus === 'suspend';
        const threshold   = pgrStatus.gdd.threshold;
        const reapplyGDD  = Math.round(threshold * 0.75);

        // Card class
        const card = container.querySelector('#pgr-card-inner');
        if (card) {
            card.className = 'pgr-card' +
                (status === 'due'    ? ' due'       : '') +
                (isSuspended        ? ' suspended'  : '');
        }

        // Status badge
        const badge = container.querySelector('#pgr-status-badge');
        if (badge) {
            badge.className = 'pgr-status-badge ' + status;
            badge.textContent = getStatusText(status);
        }

        // AI badge
        setText(container.querySelector('#pgr-ai-badge'), pgrStatus.product.activeIngredient);

        // GDD label (base temp can change)
        const gddLabel = container.querySelector('#pgr-gdd-label');
        if (gddLabel) {
            let labelHTML = `GDD Progress (base ${pgrStatus.gdd.baseTemp}°C)`;
            if (pgrStatus.gdd.estimated) {
                labelHTML += ' <span style="color:#f59e0b;font-size:11px;">⚠ Estimated</span>';
            }
            if (pgrStatus.thresholdConfig && !pgrStatus.thresholdConfig.validated) {
                labelHTML += ' <span style="color:#f59e0b;font-size:11px;">⚠ Extrapolated</span>';
            }
            gddLabel.innerHTML = labelHTML;
        }

        // GDD value
        setText(container.querySelector('#pgr-gdd-value'),
            pgrStatus.gdd.accumulated + ' / ' + threshold);

        // GDD bar fill
        const fill = container.querySelector('#pgr-gdd-fill');
        if (fill) {
            fill.style.width = Math.min(100, pgrStatus.gdd.progressPct) + '%';
            fill.className = 'pgr-gdd-fill' +
                (status === 'due'        ? ' due'        : '') +
                (status === 'approaching'? ' approaching': '');
        }

        // GDD notices (estimated / extrapolated / validated)
        const notices = container.querySelector('#pgr-gdd-notices');
        if (notices) {
            let noticeHTML = '';
            if (pgrStatus.gdd.estimated) {
                noticeHTML += `<div style="font-size:11px;color:var(--gaip-text);margin-top:6px;padding:6px 8px;background:var(--gaip-warning-bg);border-radius:4px;">
                    📊 GDD estimated from avg temp (${pgrStatus.gdd.avgTemp?.toFixed(1) || '20'}°C). Enter manual min/max temps in Site &amp; Climate for better accuracy, or wait for live weather data.
                </div>`;
            }
            if (pgrStatus.thresholdConfig && !pgrStatus.thresholdConfig.validated) {
                noticeHTML += `<div style="font-size:11px;color:var(--gaip-text);margin-top:6px;padding:6px 8px;background:var(--gaip-warning-bg);border-radius:4px;">
                    ⚠️ <strong>Extrapolated threshold:</strong> No peer-reviewed research for
                    ${pgrStatus.species?.key || pgrStatus.species?.input || 'this species'}/${pgrStatus.thresholdConfig.surfaceKey || 'this surface'}.
                    Using ${pgrStatus.thresholdConfig.gddThreshold} GDD based on ${pgrStatus.thresholdConfig.source || 'related species'}.
                    Monitor actual response and adjust if needed.
                </div>`;
            }
            if (pgrStatus.thresholdConfig && pgrStatus.thresholdConfig.validated) {
                noticeHTML += `<div style="font-size:10px;color:#16a34a;margin-top:4px;">
                    ✓ Research-validated threshold (${pgrStatus.thresholdConfig.source})
                </div>`;
            }
            notices.innerHTML = noticeHTML;
        }

        // Metrics
        // GDD to window (not GDD remaining — user needs to know when window opens)
        const gddToWindow = Math.max(0, reapplyGDD - pgrStatus.gdd.accumulated);
        const mGdd = container.querySelector('#pgr-m-gdd');
        const mGddLabel = container.querySelector('#pgr-m-gdd-label');
        if (mGdd) {
            if (pgrStatus.gdd.isOverdue || pgrStatus.gdd.accumulated >= reapplyGDD) {
                mGdd.textContent = '+' + Math.round(pgrStatus.gdd.accumulated - reapplyGDD);
                mGdd.style.color = '#dc2626';
                if (mGddLabel) mGddLabel.textContent = 'GDD Past Window';
            } else {
                mGdd.textContent = gddToWindow;
                mGdd.style.color = '';
                if (mGddLabel) mGddLabel.textContent = 'GDD to Window';
            }
        }

        const mSupp = container.querySelector('#pgr-m-supp');
        if (mSupp) {
            mSupp.textContent = pgrStatus.effect.suppressionPct + '%';
            mSupp.style.color = pgrStatus.effect.suppressionPct < 20 ? '#dc2626' : '';
        }

        // Combined suppression (DMI)
        const combinedCell = container.querySelector('#pgr-m-combined-cell');
        const combinedVal  = container.querySelector('#pgr-m-combined');
        const adjSupp = pgrStatus.effect?.adjustedSuppression;
        if (combinedCell) {
            if (adjSupp && adjSupp.addedPct > 0) {
                combinedCell.style.display = '';
                setText(combinedVal, adjSupp.adjustedPct + '%');
                if (combinedVal) combinedVal.title = adjSupp.basis || 'Combined PGR + DMI estimate';
            } else {
                combinedCell.style.display = 'none';
            }
        }

        setText(container.querySelector('#pgr-m-days'), pgrStatus.gdd.days ?? '—');

        // Projection
        const projEl = container.querySelector('#pgr-projection');
        if (projEl) {
            // b35fix179b: hub-tissue only sets projection.dailyGDDRate and
            // projection.daysToThreshold — it never sets dateFormatted or daysUntil.
            // Compute them here from what we have, using the 75% reapplication
            // window (not the 100% expiry threshold) as the target date.
            let projection = pgrStatus.projection || {};
            // b35fix179b: clamp dailyGDDRate — negative/NaN values arrive when
            // hub-tissue computes ut from NaN weather array mean. Math.max(0,NaN)=NaN
            // which propagates to display as garbage. Floor at 0.5, cap at 50.
            const rawRate = projection.dailyGDDRate;
            const dailyRate = (rawRate != null && isFinite(rawRate) && rawRate > 0)
                ? Math.min(50, rawRate)
                : 10;

            // Days until reapplication window (75% GDD), not expiry
            const gddToWindow = Math.max(0, reapplyGDD - pgrStatus.gdd.accumulated);
            const daysToWindow = dailyRate > 0 ? Math.ceil(gddToWindow / dailyRate) : null;
            const overdue = pgrStatus.gdd.isOverdue;
            const inWindow = pgrStatus.gdd.accumulated >= reapplyGDD;

            // Build dateFormatted from daysToWindow
            let dateFormatted = projection.dateFormatted || null;
            let daysUntil = projection.daysUntil != null ? projection.daysUntil : daysToWindow;
            if (!dateFormatted && daysToWindow != null) {
                const d = new Date();
                d.setDate(d.getDate() + daysToWindow);
                dateFormatted = d.toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' });
            }

            if (dateFormatted || overdue || inWindow) {
                const bg     = overdue ? 'var(--gaip-critical-bg)' : 'var(--gaip-warning-bg)';
                const border = overdue ? 'var(--gaip-critical-border)' : 'var(--gaip-warning-border)';
                const label  = overdue
                    ? '⏰ Overdue'
                    : (inWindow ? '⏳ Reapply Now' : '⏳ Reapply by');
                const labelColor = overdue ? '#dc2626' : '#b45309';
                const timing = overdue
                    ? (projection.daysAgo != null ? projection.daysAgo + ' days ago' : 'past threshold')
                    : (daysUntil != null ? daysUntil + ' days' : '');

                let dmiNote = '';
                if (adjSupp && adjSupp.addedPct > 0) {
                    dmiNote = `<div style="font-size:10px;color:#92400e;margin-top:3px;">
                        ⚠️ DMI active: combined est. ${adjSupp.adjustedPct}% suppression — consider extending interval
                    </div>`;
                }

                projEl.style.cssText = `background:${bg};border-bottom:1px solid ${border};padding:8px 16px;`;
                projEl.innerHTML = `
                    <div style="display:flex;justify-content:space-between;align-items:flex-start;">
                        <div>
                            <span style="font-size:12px;font-weight:600;color:${labelColor};">${label}</span>
                            ${dateFormatted ? `<span style="font-size:13px;font-weight:700;color:var(--gaip-text);margin-left:6px;">${dateFormatted}</span>` : ''}
                            ${timing ? `<span style="font-size:11px;color:var(--gaip-text);margin-left:4px;">(${timing})</span>` : ''}
                            ${!overdue ? '<div style="font-size:10px;color:#92400e;margin-top:2px;">Before suppression drops below 20% — do not wait until GDD threshold</div>' : ''}
                            ${dmiNote}
                        </div>
                        <div style="font-size:10px;color:var(--gaip-text);white-space:nowrap;margin-left:8px;">~${dailyRate.toFixed(1)} GDD/day</div>
                    </div>`;
            } else {
                projEl.innerHTML = '';
                projEl.style.cssText = '';
            }
        }

        // Shade warning
        const shadeSlot = container.querySelector('#pgr-shade-slot');
        if (shadeSlot) {
            if (shadeStatus !== 'ok' && shadeStatus !== 'unknown') {
                shadeSlot.innerHTML = `
                    <div class="pgr-shade-warning ${shadeStatus}" style="margin:8px 16px;">
                        <span>${shadeStatus === 'suspend' ? '⛔' : '⚠️'}</span>
                        <span>${pgrStatus.shade.warning.action}</span>
                    </div>`;
            } else {
                shadeSlot.innerHTML = '';
            }
        }

        // DMI combined suppression notice in inputs panel
        const dmiNotice = container.querySelector('#pgr-dmi-combined-notice');
        if (dmiNotice) {
            if (adjSupp && adjSupp.addedPct > 0) {
                dmiNotice.innerHTML = `
                    <div style="font-size:11px;padding:6px 8px;background:var(--gaip-warning-bg);border-left:3px solid #f59e0b;border-radius:4px;color:#92400e;">
                        ⚠️ Combined suppression est. <strong>${adjSupp.adjustedPct}%</strong>
                        <span style="font-size:10px;display:block;margin-top:1px;opacity:0.85;">${adjSupp.basis || 'PGR + DMI interaction'}</span>
                    </div>`;
            } else {
                dmiNotice.innerHTML = '';
            }
        }

        // Source footer
        const sourceFooter = container.querySelector('#pgr-source-footer');
        if (sourceFooter) {
            let src = (pgrStatus.product.name || pgrStatus.product.type || 'PGR') +
                ' • Applied: ' + (pgrStatus.application?.date || pgrStatus.applicationDate || 'Not set');
            if (pgrStatus.application?.productRateLperHa) {
                src += ' @ ' + pgrStatus.application.productRateLperHa + ' L/ha';
            }
            if (pgrStatus.mowingHeight && pgrStatus.mowingHeight.thresholdMultiplier !== 1) {
                src += ' • ' + pgrStatus.mowingHeight.categoryLabel;
            }
            src += pgrStatus.config?.isUserOverride
                ? ' • Custom GDD settings'
                : ' • ' + threshold + ' GDD (' + (pgrStatus.mowingHeight?.categoryLabel || pgrStatus.surface?.type || 'greens') + ')';
            src += ' • Reapplication window: 75% GDD (Kreuser &amp; Soldat 2011)';
            sourceFooter.innerHTML = src;
        }

        // Render/update chart — PGRForecast.render handles its own idempotency
        if (typeof global.PGRForecast !== 'undefined') {
            setTimeout(function() {
                const chartContainer = container.querySelector('#gaip-pgr-forecast-chart');
                if (chartContainer) {
                    try {
                        global.PGRForecast.render(chartContainer, pgrStatus, global.currentState || {});
                    } catch(e) {
                        console.error('GAIP PGR-UI: chart render error:', e);
                    }
                }
            }, 100);
        }
    }

    // =========================================================================
    // PANEL SENTINEL — decide init vs update
    // =========================================================================

    /**
     * Check whether the container already has a live panel skeleton.
     * We look for the inputs panel — if it's present the skeleton is intact
     * and we only need to update dynamic values.
     */
    function hasPanelSkeleton(container) {
        return !!(container && container.querySelector('.pgr-colocation-body'));
    }

    // =========================================================================
    // PUBLIC API
    // =========================================================================

    /**
     * Main entry point — called by hub-tissue-v3.js as:
     *   GAIP_PGRUI.render(container, pgrStatus, { showConfig: false })
     *
     * On first call (or after site-switch clears the container): runs initPGRPanel
     * to write the skeleton, then updatePGRPanel to populate dynamic values.
     *
     * On subsequent cascade calls with skeleton intact: runs updatePGRPanel only.
     * Input field values are never touched.
     */
    function renderPGRStatus(container, pgrStatus, options) {
        if (!container) return;
        if (!pgrStatus || pgrStatus.error) {
            container.innerHTML = `<div class="pgr-module"><div class="pgr-card">
                <div style="color:#dc2626;padding:16px;">${pgrStatus?.message || 'PGR calculation error'}</div>
            </div></div>`;
            return;
        }

        injectCSS();

        if (!hasPanelSkeleton(container)) {
            initPGRPanel(container, pgrStatus);
        }

        updatePGRPanel(container, pgrStatus);
    }

    /**
     * Render compact PGR indicator (summary views — unchanged)
     */
    function renderPGRCompact(container, pgrStatus) {
        if (!container || !pgrStatus || pgrStatus.error) return;
        injectCSS();
        const status = pgrStatus.effect.reapplicationStatus;
        const icon = status === 'due' ? '🔴' : status === 'approaching' ? '🟡' : '🟢';
        container.innerHTML = `
            <div style="display:flex;align-items:center;gap:8px;padding:8px 12px;background:var(--gaip-info-bg);border-radius:8px;">
                <span>${icon}</span>
                <span style="font-weight:500;">PGR: ${pgrStatus.gdd.accumulated}/${pgrStatus.gdd.threshold} GDD</span>
                <span style="color:var(--gaip-text);">(${pgrStatus.gdd.remaining} remaining)</span>
            </div>`;
    }

    // =========================================================================
    // EXPORTS
    // =========================================================================

    global.GAIP_PGRUI = {
        render:        renderPGRStatus,    // backward-compatible
        init:          initPGRPanel,       // explicit init (site-switch callers)
        update:        updatePGRPanel,     // explicit update
        renderCompact: renderPGRCompact,
        injectCSS:     injectCSS
    };

})(typeof window !== 'undefined' ? window : this);
