# [gaip_decisions] Full-Screen Shortcode — Implementation Plan

**Goal:** Add a `[gaip_decisions]` WordPress shortcode that renders the v21 full-screen decision UI (nav bar, ctx bar, left/right split, mode tabs) as a standalone page, reading from cache written by `[gaip_hub]`.

**Architecture:** Three new files added to b35fix244 — `gaip-decisions-layout.css` (full-screen chrome), `gaip-decisions-page.js` (scaffold + mode wiring + cache bootstrap), and a PHP enqueue/shortcode block in `gilba-agronomic-intelligence-hub.php`. The existing `GilbaDSM`, `GilbaDecisionUI`, and `GilbaEvidenceUI` modules are reused verbatim — no changes to engines or orchestrator. The page reads from StorageAdapter cache (written by `[gaip_hub]` on last run); it does not re-run the full engine stack.

**Tech Stack:** Vanilla JS (IIFE), CSS custom properties (reuses hub palette vars), PHP WordPress shortcode API, StorageAdapter for cache reads.

---

## File Map

| Action | File | Responsibility |
|--------|------|----------------|
| Create | `assets/gaip-decisions-layout.css` | Full-screen chrome: nav bar, ctx bar, view switcher, left/right split, mode tab CSS |
| Create | `assets/gaip-decisions-page.js` | Scaffold injector, mode tab wiring, cache bootstrap, site selector, triggers GilbaDSM + GilbaDecisionUI |
| Modify | `gilba-agronomic-intelligence-hub.php` | `gaip_decisions_enqueue_assets()`, `gaip_decisions_render_shortcode()`, `add_shortcode` |

No other files touched.

---

## Task 1: CSS — gaip-decisions-layout.css

**Files:**
- Create: `assets/gaip-decisions-layout.css`

- [ ] **Step 1: Create full-screen layout CSS**

```css
/* gaip-decisions-layout.css — b35fix244
 * Full-screen chrome for [gaip_decisions] shortcode.
 * Reuses hub CSS custom property palette.
 * All selectors scoped to #gaip-decisions-page to avoid collision with [gaip_hub].
 */

/* ── Reset & root ── */
#gaip-decisions-page *,
#gaip-decisions-page *::before,
#gaip-decisions-page *::after { box-sizing: border-box; margin: 0; padding: 0; }

#gaip-decisions-page button,
#gaip-decisions-page select,
#gaip-decisions-page input { font-family: inherit; }

#gaip-decisions-page button { cursor: pointer; border: none; background: none; }

#gaip-decisions-page {
  --g0: #0b1210; --g1: #111a16; --g2: #192320; --g3: #202d28;
  --g4: #293c33; --g5: #364f43; --g6: #445e52;
  --ink0: #ecf2ed; --ink1: #adc0b4; --ink2: #6b8878; --ink3: #3e5448; --ink4: #253630;
  --green: #35ae62; --green-d: #1b643a;
  --red: #d14b4b; --red-d: #5a1414; --red-bg: #150b0b;
  --amber: #c46c04; --amber-d: #5a2b04; --amber-bg: #150d03;
  --blue: #4a90d9; --blue-d: #1a3a5c;
  --mono: 'DM Mono', monospace;
  --body: 'Barlow', sans-serif;
  --disp: 'Fraunces', serif;
  font-family: var(--body);
  background: var(--g0);
  color: var(--ink0);
  -webkit-font-smoothing: antialiased;
  display: flex;
  flex-direction: column;
  height: 100vh;
  overflow: hidden;
  position: fixed;
  inset: 0;
  z-index: 9000;
}

/* ── Nav bar ── */
#gaip-decisions-page .gd-nav {
  height: 44px; display: flex; align-items: stretch;
  background: var(--g1); border-bottom: 1px solid var(--g4); flex-shrink: 0;
}
#gaip-decisions-page .gd-brand {
  display: flex; align-items: center; padding: 0 16px;
  font-family: var(--mono); font-size: 12px; letter-spacing: .22em;
  text-transform: uppercase; color: var(--green);
  border-right: 1px solid var(--g4); flex-shrink: 0;
}
#gaip-decisions-page .gd-site {
  display: flex; align-items: center; padding: 0 14px;
  border-right: 1px solid var(--g4); cursor: pointer; flex-shrink: 0;
  gap: 9px; transition: background .1s;
}
#gaip-decisions-page .gd-site:hover { background: var(--g2); }
#gaip-decisions-page .gd-live {
  width: 6px; height: 6px; border-radius: 50%;
  background: var(--green); flex-shrink: 0;
}
#gaip-decisions-page .gd-site-name { font-size: 12px; font-weight: 600; color: var(--ink0); }
#gaip-decisions-page .gd-site-sub  { font-size: 9px; color: var(--ink3); font-family: var(--mono); }
#gaip-decisions-page .gd-modesw {
  display: flex; align-items: center; padding: 0 8px; gap: 2px;
}
#gaip-decisions-page .gd-mb {
  padding: 4px 11px; font-size: 10px; font-weight: 500; color: var(--ink3);
  background: transparent; border-radius: 3px; transition: all .1s;
  text-transform: uppercase; letter-spacing: .05em;
}
#gaip-decisions-page .gd-mb.on { background: var(--green); color: #fff; }
#gaip-decisions-page .gd-mb:hover:not(.on) { background: var(--g3); color: var(--ink1); }
#gaip-decisions-page .gd-space { flex: 1; }
#gaip-decisions-page .gd-run {
  display: flex; align-items: center; padding: 0 22px;
  background: var(--green); color: var(--g0); font-size: 12px; font-weight: 600;
  letter-spacing: .04em; transition: background .1s; white-space: nowrap;
  border-left: 1px solid var(--green-d);
}
#gaip-decisions-page .gd-run:hover { background: #42cc76; }
#gaip-decisions-page .gd-run.busy { background: var(--g4); color: var(--ink3); cursor: not-allowed; }

/* ── Ctx bar ── */
#gaip-decisions-page .gd-ctx {
  height: 28px; display: flex; align-items: stretch;
  background: var(--g0); border-top: 1px solid var(--g4);
  border-bottom: 1px solid var(--g5); flex-shrink: 0;
}
#gaip-decisions-page .gd-ctx.hidden { display: none; }
#gaip-decisions-page .gd-ctx-state {
  display: flex; align-items: center; padding: 0 14px;
  border-right: 1px solid var(--g4); flex-shrink: 0;
}
#gaip-decisions-page .gd-ctx-hl {
  font-family: var(--disp); font-size: 11px; font-weight: 400; white-space: nowrap;
}
#gaip-decisions-page .gd-ctx-hl.act  { color: var(--red); }
#gaip-decisions-page .gd-ctx-hl.warn { color: var(--amber); }
#gaip-decisions-page .gd-ctx-hl.ok   { color: var(--green); }
#gaip-decisions-page .gd-ctx-counts  { display: flex; align-items: stretch; }
#gaip-decisions-page .gd-ctc {
  display: flex; align-items: center; gap: 5px; padding: 0 11px;
  border-right: 1px solid var(--g4); cursor: pointer;
  transition: background .1s; flex-shrink: 0;
}
#gaip-decisions-page .gd-ctc:hover { background: var(--g2); }
#gaip-decisions-page .gd-ctc.on    { background: var(--g3); }
#gaip-decisions-page .gd-ctc-n { font-family: var(--mono); font-size: 14px; font-weight: 300; line-height: 1; }
#gaip-decisions-page .gd-ctc-n.r { color: var(--red); }
#gaip-decisions-page .gd-ctc-n.a { color: var(--amber); }
#gaip-decisions-page .gd-ctc-n.d { color: var(--ink4); }
#gaip-decisions-page .gd-ctc-w     { font-size: 10px; font-weight: 400; white-space: nowrap; }
#gaip-decisions-page .gd-ctc-w.dim { color: var(--ink3); }

/* ── Views ── */
#gaip-decisions-page .gd-view { display: none; flex: 1; overflow: hidden; min-height: 0; }
#gaip-decisions-page .gd-view.on { display: flex; }
#gaip-decisions-page #gdp-dec-view { flex-direction: row; }

/* Decision view reuses gdp- classes from gaip-decision-ui — just ensure it fills */
#gaip-decisions-page #gaip-decision-panel {
  flex: 1; display: flex; flex-direction: row; overflow: hidden; min-height: 0;
  /* Remove the panel chrome (header/collapse) used in hub embedded mode */
}
#gaip-decisions-page .gdp-header { display: none !important; } /* hide collapse header */
#gaip-decisions-page .gdp-body   { flex: 1; display: flex; overflow: hidden; min-height: 0; }
#gaip-decisions-page .gdp-body-inner {
  flex: 1; display: flex; flex-direction: row; overflow: hidden; min-height: 0;
}
#gaip-decisions-page .gdp-left  {
  flex: 1; max-width: 760px; border-right: 1px solid var(--g4);
  display: flex; flex-direction: column; overflow: hidden;
}
#gaip-decisions-page .gdp-right {
  width: 280px; flex-shrink: 0; display: flex; flex-direction: column; overflow: hidden;
}
#gaip-decisions-page .gdp-placeholder { display: none; }

/* Data view reuses gev- classes from gaip-evidence-ui */
#gaip-decisions-page #gaip-evidence-panel {
  flex: 1; overflow: hidden; display: flex; flex-direction: column;
}

/* Scenarios placeholder */
#gaip-decisions-page .gd-scen-ph {
  flex: 1; display: flex; align-items: center; justify-content: center;
  flex-direction: column; gap: 8px;
}
#gaip-decisions-page .gd-scen-ph-txt {
  font-size: 12px; color: var(--ink3); text-align: center; line-height: 1.6;
}

/* Configure placeholder */
#gaip-decisions-page .gd-cfg-ph {
  flex: 1; display: flex; align-items: center; justify-content: center;
  flex-direction: column; gap: 8px;
}
#gaip-decisions-page .gd-cfg-ph-txt {
  font-size: 12px; color: var(--ink3); text-align: center; line-height: 1.6;
}
#gaip-decisions-page .gd-cfg-link {
  font-family: var(--mono); font-size: 10px; color: var(--green);
  border: 1px solid var(--green-d); border-radius: 3px; padding: 4px 12px;
  transition: all .1s; text-decoration: none; display: inline-block; margin-top: 4px;
}
#gaip-decisions-page .gd-cfg-link:hover { background: var(--green-d); }

/* ── No-data state ── */
#gaip-decisions-page .gd-nodata {
  flex: 1; display: flex; align-items: center; justify-content: center;
  flex-direction: column; gap: 8px; padding: 40px;
}
#gaip-decisions-page .gd-nodata-icon { font-family: var(--mono); font-size: 28px; color: var(--ink4); }
#gaip-decisions-page .gd-nodata-txt  { font-size: 12px; color: var(--ink3); text-align: center; line-height: 1.6; }
#gaip-decisions-page .gd-nodata-link {
  font-family: var(--mono); font-size: 10px; color: var(--green);
  border: 1px solid var(--green-d); border-radius: 3px; padding: 4px 14px;
  text-decoration: none; display: inline-block; margin-top: 4px; transition: all .1s;
}
#gaip-decisions-page .gd-nodata-link:hover { background: var(--green-d); }

/* ── Mobile ── */
@media (max-width: 600px) {
  #gaip-decisions-page .gdp-right { display: none; }
  #gaip-decisions-page .gdp-left  { max-width: 100%; border-right: none; }
  #gaip-decisions-page .gd-run    { padding: 0 14px; font-size: 11px; }
  #gaip-decisions-page .gd-brand  { display: none; }
}
```

---

## Task 2: JS — gaip-decisions-page.js

**Files:**
- Create: `assets/gaip-decisions-page.js`

- [ ] **Step 1: Create IIFE with scaffold builder and mode tab wiring**

```javascript
/**
 * gaip-decisions-page.js — Full-screen [gaip_decisions] shortcode controller
 * b35fix244
 *
 * Responsibilities:
 *   1. Build the nav bar + view scaffold inside #gaip-decisions-page
 *   2. Wire mode tabs (Decisions / Data / Scenarios / Configure)
 *   3. Bootstrap GilbaDSM + GilbaDecisionUI from StorageAdapter cache
 *   4. Populate site name/species in nav bar from GilbaSampleManager
 *   5. Handle the Run button (re-reads cache, re-renders decision UI)
 *
 * Reads from (cache, written by [gaip_hub]):
 *   StorageAdapter keys: gaip_hub_cache, gaip_state, gaip_canonical_state
 *   window.GAIP_DECISIONS_CONFIG — injected by PHP (hubUrl, userId)
 *
 * Does NOT re-run the full engine stack.
 *
 * @version 1.0.0
 */
;(function (global) {
  'use strict';

  var _root    = null;   // #gaip-decisions-page
  var _curView = 'dec';
  var _hubUrl  = (global.GAIP_DECISIONS_CONFIG && global.GAIP_DECISIONS_CONFIG.hubUrl) || '#';

  // ── Helpers ──────────────────────────────────────────────────────────────

  function _el(id) { return _root ? _root.querySelector('#' + id) : null; }
  function _esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g,'&amp;').replace(/</g,'&lt;')
      .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  // ── Site info from SampleManager ─────────────────────────────────────────

  function _getSiteInfo() {
    var sm = global.GilbaSampleManager;
    if (!sm) return { name: 'No site', sub: 'run [gaip_hub] first' };
    var siteId = sm.getActiveSiteId && sm.getActiveSiteId();
    if (!siteId) return { name: 'No site', sub: 'run [gaip_hub] first' };
    var sites   = sm.getSiteList && sm.getSiteList();
    var site    = sites && sites.find(function(s){ return s.id === siteId; });
    var name    = (site && site.name) || siteId;
    var species = (site && site.species) || '';
    var zone    = (site && site.zone) || '';
    var sub     = [species, zone].filter(Boolean).join(' \u00b7 ');
    return { name: name, sub: sub || 'run [gaip_hub] first' };
  }

  // ── Cache check ───────────────────────────────────────────────────────────

  function _hasCachedData() {
    var sa = global.GilbaStorageAdapter || global.StorageAdapter;
    if (!sa) return false;
    var sm = global.GilbaSampleManager;
    var siteId = sm && sm.getActiveSiteId && sm.getActiveSiteId();
    if (!siteId) return false;
    try {
      var cache = sa.getItem('gaip_hub_cache', siteId);
      return !!cache;
    } catch(e) { return false; }
  }

  // ── Scaffold ──────────────────────────────────────────────────────────────

  function _buildScaffold() {
    _root = document.getElementById('gaip-decisions-page');
    if (!_root) return;

    var info = _getSiteInfo();

    _root.innerHTML =
      // Nav bar
      '<div class="gd-nav">'
        + '<div class="gd-brand">GAIP</div>'
        + '<div class="gd-site" id="gd-site">'
          + '<div class="gd-live"></div>'
          + '<div>'
            + '<div class="gd-site-name" id="gd-site-name">' + _esc(info.name) + '</div>'
            + '<div class="gd-site-sub"  id="gd-site-sub">'  + _esc(info.sub)  + '</div>'
          + '</div>'
        + '</div>'
        + '<div class="gd-modesw">'
          + '<button class="gd-mb on"  data-view="dec"  >Decisions</button>'
          + '<button class="gd-mb"     data-view="data" >Data</button>'
          + '<button class="gd-mb"     data-view="scen" >Scenarios</button>'
          + '<button class="gd-mb"     data-view="cfg"  >Configure</button>'
        + '</div>'
        + '<div class="gd-space"></div>'
        + '<button class="gd-run" id="gd-run">Run</button>'
      + '</div>'

      // Ctx bar (populated by GilbaDecisionUI)
      + '<div class="gd-ctx" id="gd-ctx">'
        + '<div class="gd-ctx-state"><div class="gd-ctx-hl ok" id="gd-ctx-hl">Loading\u2026</div></div>'
        + '<div class="gd-ctx-counts" id="gd-ctx-counts"></div>'
      + '</div>'

      // Decisions view — reuses #gaip-decision-panel injected by GilbaDecisionUI
      + '<div class="gd-view on" id="gdp-dec-view">'
        + '<div id="gaip-decision-panel"></div>'
      + '</div>'

      // Data view — reuses #gaip-evidence-panel injected by GilbaEvidenceUI
      + '<div class="gd-view" id="gdp-data-view">'
        + '<div id="gaip-evidence-panel"></div>'
      + '</div>'

      // Scenarios view — placeholder pointing to hub
      + '<div class="gd-view" id="gdp-scen-view">'
        + '<div class="gd-scen-ph">'
          + '<div style="font-family:var(--mono);font-size:22px;color:var(--ink4)">~</div>'
          + '<div class="gd-scen-ph-txt">Scenario modelling is available in the full hub.<br>'
            + '<a href="' + _esc(_hubUrl) + '" class="gd-cfg-link" style="margin-top:8px;">Open hub \u2192</a>'
          + '</div>'
        + '</div>'
      + '</div>'

      // Configure view — placeholder pointing to hub
      + '<div class="gd-view" id="gdp-cfg-view">'
        + '<div class="gd-cfg-ph">'
          + '<div style="font-family:var(--mono);font-size:22px;color:var(--ink4)">\u2699</div>'
          + '<div class="gd-cfg-ph-txt">Site configuration is managed in the full hub.<br>'
            + '<a href="' + _esc(_hubUrl) + '" class="gd-cfg-link" style="margin-top:8px;">Open hub \u2192</a>'
          + '</div>'
        + '</div>'
      + '</div>';

    _wireEvents();
  }

  // ── View switching ────────────────────────────────────────────────────────

  function _setView(v) {
    _curView = v;
    _root.querySelectorAll('.gd-mb').forEach(function(b){
      b.classList.toggle('on', b.getAttribute('data-view') === v);
    });
    ['dec','data','scen','cfg'].forEach(function(id){
      var el = _root.querySelector('#gdp-' + id + '-view');
      if (el) el.classList.toggle('on', id === v);
    });
    // Ctx bar only shown on decisions view
    var ctx = _el('gd-ctx');
    if (ctx) ctx.classList.toggle('hidden', v !== 'dec');
    // Trigger evidence render when switching to data
    if (v === 'data' && global.GilbaEvidenceUI && global.GilbaEvidenceUI.refresh) {
      setTimeout(global.GilbaEvidenceUI.refresh, 50);
    }
  }

  // ── Event wiring ──────────────────────────────────────────────────────────

  function _wireEvents() {
    // Mode tabs
    _root.querySelectorAll('.gd-mb').forEach(function(b){
      b.addEventListener('click', function(){
        _setView(b.getAttribute('data-view'));
      });
    });

    // Run button — re-reads cache and fires gaip:orchestrator-complete
    // so GilbaDecisionUI + GilbaEvidenceUI both re-render
    var runBtn = _el('gd-run');
    if (runBtn) {
      runBtn.addEventListener('click', function(){
        if (runBtn.classList.contains('busy')) return;
        runBtn.classList.add('busy');
        runBtn.textContent = '\u2026';
        setTimeout(function(){
          _populateFromCache();
          runBtn.classList.remove('busy');
          runBtn.textContent = 'Run';
        }, 1200);
      });
    }
  }

  // ── Cache bootstrap ───────────────────────────────────────────────────────
  // Reads GAIP_STATE + GAIP_CANONICAL_STATE from StorageAdapter cache and
  // restores them to window globals, then fires gaip:orchestrator-complete
  // so GilbaDecisionUI and GilbaEvidenceUI re-render from the cached data.

  function _populateFromCache() {
    var sa = global.GilbaStorageAdapter || global.StorageAdapter;
    var sm = global.GilbaSampleManager;
    if (!sa || !sm) return;

    var siteId = sm.getActiveSiteId && sm.getActiveSiteId();
    if (!siteId) return;

    try {
      var raw = sa.getItem('gaip_hub_cache', siteId);
      if (!raw) return;
      var cache = typeof raw === 'string' ? JSON.parse(raw) : raw;
      if (cache.GAIP_STATE)          global.GAIP_STATE          = cache.GAIP_STATE;
      if (cache.GAIP_CANONICAL_STATE) global.GAIP_CANONICAL_STATE = cache.GAIP_CANONICAL_STATE;
      if (cache.GAIP_DISEASE_RESULT)  global.GAIP_DISEASE_RESULT  = cache.GAIP_DISEASE_RESULT;
      if (cache.GAIP_PGR_RESULT)      global.GAIP_PGR_RESULT      = cache.GAIP_PGR_RESULT;
      if (cache.GAIP_IrrigationResults) global.GAIP_IrrigationResults = cache.GAIP_IrrigationResults;
      if (cache.GAIP_PRE_EMERGENT_RESULT) global.GAIP_PRE_EMERGENT_RESULT = cache.GAIP_PRE_EMERGENT_RESULT;
    } catch(e) {
      // Cache read failed — show no-data state, do not crash
      _showNoData();
      return;
    }

    // Fire event so GilbaDecisionUI + GilbaEvidenceUI re-render
    document.dispatchEvent(new CustomEvent('gaip:orchestrator-complete', { detail: { source: 'decisions_cache' } }));
    // Update site name in case it changed
    _updateSiteInfo();
  }

  function _updateSiteInfo() {
    var info = _getSiteInfo();
    var nameEl = _el('gd-site-name');
    var subEl  = _el('gd-site-sub');
    if (nameEl) nameEl.textContent = info.name;
    if (subEl)  subEl.textContent  = info.sub;
  }

  function _showNoData() {
    var decView = _root ? _root.querySelector('#gdp-dec-view') : null;
    if (!decView) return;
    decView.innerHTML =
      '<div class="gd-nodata">'
        + '<div class="gd-nodata-icon">~</div>'
        + '<div class="gd-nodata-txt">No analysis data found for this site.<br>Run an analysis in the hub first.</div>'
        + '<a href="' + _esc(_hubUrl) + '" class="gd-nodata-link">Open hub \u2192</a>'
      + '</div>';
  }

  // ── Init ─────────────────────────────────────────────────────────────────

  function init() {
    _buildScaffold();

    if (!_hasCachedData()) {
      _showNoData();
      return;
    }

    // Small delay to allow GilbaDecisionUI to wire its own scaffold first
    setTimeout(_populateFromCache, 100);

    // Re-render when hub fires an update (e.g. user opened hub in another tab)
    document.addEventListener('gaip:site-changed', function(){
      setTimeout(function(){
        _updateSiteInfo();
        _populateFromCache();
      }, 300);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  global.GilbaDecisionsPage = { refresh: _populateFromCache };

})(window);
```

---

## Task 3: PHP — enqueue function + shortcode

**Files:**
- Modify: `gilba-agronomic-intelligence-hub.php`

- [ ] **Step 1: Add enqueue function after the morning briefing block (~line 8960)**

Find the line:
```php
add_shortcode( 'gaip_morning_briefing', 'gaip_morning_briefing_render_shortcode' );
```

Add after it:

```php
// ============================================================
// [gaip_decisions] FULL-SCREEN DECISION UI — b35fix244
// Standalone page shortcode. Reads from [gaip_hub] cache.
// ============================================================

/**
 * Enqueue assets for [gaip_decisions] shortcode pages.
 */
function gaip_decisions_enqueue_assets() {
    global $post;
    if ( ! is_a( $post, 'WP_Post' ) ) return;

    $has_sc = has_shortcode( $post->post_content, 'gaip_decisions' )
           || ( strpos( $post->post_content, 'gaip_decisions' ) !== false );
    if ( ! $has_sc ) return;

    $plugin_url = plugins_url( '', __FILE__ );

    // Storage shim — must be first
    wp_enqueue_script(
        'gilba-storage-ns',
        $plugin_url . '/assets/gilba-storage-ns.js',
        array(),
        gilba_asset_version( 'assets/gilba-storage-ns.js' ),
        true
    );
    wp_add_inline_script( 'gilba-storage-ns', 'window.GILBA_PLUGIN_NS = "gaip";', 'before' );

    // Sample manager
    if ( ! wp_script_is( 'gaip-sample-manager', 'enqueued' ) ) {
        wp_enqueue_script(
            'gaip-sample-manager',
            $plugin_url . '/assets/sample-manager.js',
            array( 'gilba-storage-ns' ),
            gilba_asset_version( 'assets/sample-manager.js' ),
            true
        );
    }

    // Priority queue (dependency of decision engine)
    if ( ! wp_script_is( 'gaip-priority-queue', 'enqueued' ) ) {
        wp_enqueue_script(
            'gaip-priority-queue',
            $plugin_url . '/assets/priority-action-queue.js',
            array( 'gilba-storage-ns' ),
            gilba_asset_version( 'assets/priority-action-queue.js' ),
            true
        );
    }

    // Decision engine + UI
    wp_enqueue_style(
        'gaip-decision-css',
        $plugin_url . '/assets/gaip-decision.css',
        array(),
        gilba_asset_version( 'assets/gaip-decision.css' )
    );
    wp_enqueue_script(
        'gaip-decision-engine',
        $plugin_url . '/assets/gaip-decision-engine.js',
        array( 'gilba-storage-ns', 'gaip-sample-manager', 'gaip-priority-queue' ),
        gilba_asset_version( 'assets/gaip-decision-engine.js' ),
        true
    );
    wp_enqueue_script(
        'gaip-decision-ui',
        $plugin_url . '/assets/gaip-decision-ui.js',
        array( 'gaip-decision-engine' ),
        gilba_asset_version( 'assets/gaip-decision-ui.js' ),
        true
    );

    // Evidence UI
    wp_enqueue_style(
        'gaip-evidence-css',
        $plugin_url . '/assets/gaip-evidence.css',
        array(),
        gilba_asset_version( 'assets/gaip-evidence.css' )
    );
    wp_enqueue_script(
        'gaip-evidence-ui',
        $plugin_url . '/assets/gaip-evidence-ui.js',
        array( 'gaip-decision-engine' ),
        gilba_asset_version( 'assets/gaip-evidence-ui.js' ),
        true
    );

    // Full-screen layout + page controller
    wp_enqueue_style(
        'gaip-decisions-layout-css',
        $plugin_url . '/assets/gaip-decisions-layout.css',
        array( 'gaip-decision-css', 'gaip-evidence-css' ),
        gilba_asset_version( 'assets/gaip-decisions-layout.css' )
    );
    wp_enqueue_script(
        'gaip-decisions-page',
        $plugin_url . '/assets/gaip-decisions-page.js',
        array( 'gaip-decision-ui', 'gaip-evidence-ui', 'gaip-sample-manager' ),
        gilba_asset_version( 'assets/gaip-decisions-page.js' ),
        true
    );

    // Config: hub URL + user ID
    $hub_url = '';
    $hub_pages = get_posts( array(
        'post_type'   => array( 'page', 'post' ),
        'post_status' => 'publish',
        'numberposts' => 5,
    ) );
    foreach ( $hub_pages as $hp ) {
        if ( has_shortcode( $hp->post_content, 'gaip_hub' ) ) {
            $hub_url = get_permalink( $hp->ID );
            break;
        }
    }

    wp_add_inline_script( 'gaip-decisions-page',
        'window.GAIP_DECISIONS_CONFIG = {'
        . '"hubUrl":' . wp_json_encode( $hub_url ) . ','
        . '"userId":' . (int) get_current_user_id()
        . '};',
        'before'
    );
}
add_action( 'wp_enqueue_scripts', 'gaip_decisions_enqueue_assets' );

/**
 * Render [gaip_decisions] shortcode.
 * All content populated by gaip-decisions-page.js.
 */
function gaip_decisions_render_shortcode( $atts ) {
    if ( ! is_user_logged_in() ) {
        return '<div style="padding:20px;text-align:center;">'
             . '<p>Please <a href="' . esc_url( wp_login_url( get_permalink() ) ) . '">log in</a> to view decisions.</p>'
             . '</div>';
    }
    ob_start();
    ?>
    <div id="gaip-decisions-page">
        <!-- Populated by gaip-decisions-page.js -->
    </div>
    <?php
    return ob_get_clean();
}
add_shortcode( 'gaip_decisions', 'gaip_decisions_render_shortcode' );

// Prevent wptexturize inside [gaip_decisions] output
add_filter( 'no_texturize_shortcodes', function( $shortcodes ) {
    $shortcodes[] = 'gaip_decisions';
    return $shortcodes;
} );
```

---

## Task 4: Build zip

- [ ] **Step 1: Copy working tree to b35fix244, zip**

```bash
cp -r /tmp/gilba_b35fix243_work/gilba_hub_b35fix243 /tmp/gilba_b35fix244_work/gilba_hub_b35fix244
# Add three new files, apply PHP patch, then:
cd /tmp/gilba_b35fix244_work
zip -r gilba_hub_b35fix244.zip gilba_hub_b35fix244/
```

---

## Task 5: WordPress setup

- [ ] **Step 1: Create a new WordPress page**
  - Title: `Decisions` (or `Daily Decisions`)
  - Content: `[gaip_decisions]`
  - Publish

- [ ] **Step 2: WordPress admin — Reading Settings**
  - Optionally set this page as a menu item for quick mobile access

- [ ] **Step 3: On mobile, add to home screen** via browser share menu

---

## Confirm in production

After deploy:
- `[gaip_decisions]` page loads with dark full-screen layout (no WP header/footer interference — may need a blank page template)
- Nav bar shows active site name and species
- Decisions view shows queue and left panel with live data from last hub run
- Data tab shows Evidence panel (Soil/Water/Tissue/Spray)
- Scenarios and Configure tabs show "Open hub →" links
- Run button re-reads cache and re-renders without page reload
- Mobile: right rail hidden, left panel full-width

---

## Known Risk: WordPress theme interference

The `position: fixed; inset: 0` on `#gaip-decisions-page` will fight with WP admin bar and theme headers. If the theme wraps page content in a container, the fixed positioning may be clipped.

**Mitigation:** Assign a blank page template (no header/footer) to the decisions page. Most themes support this via Page Attributes → Template. If not, add this to the shortcode render output:

```php
// Hide WP admin bar on decisions page
add_action( 'wp_head', function() {
    if ( is_page() && has_shortcode( get_post()->post_content, 'gaip_decisions' ) ) {
        echo '<style>body { margin-top: 0 !important; } #wpadminbar { display: none !important; }</style>';
    }
} );
```

This is already a known pattern from the hub — include it in the PHP block.

---

## Self-Review

**Spec coverage:**
- Full-screen chrome CSS ✓
- Nav bar (brand, site name, mode tabs, run button) ✓
- Ctx bar ✓
- Decisions view wired to existing GilbaDecisionUI ✓
- Data view wired to existing GilbaEvidenceUI ✓
- Scenarios + Configure as hub links ✓
- Cache bootstrap from StorageAdapter ✓
- No-data state ✓
- PHP enqueue (standalone, guards against double-enqueue) ✓
- PHP shortcode render ✓
- Login gate ✓
- Mobile responsive ✓
- WP admin bar / theme interference mitigation ✓

**Placeholder scan:** None found.

**Type consistency:** `_populateFromCache` fires `gaip:orchestrator-complete` — matches what `GilbaDecisionUI` listens for (confirmed line 600 of gaip-decision-ui.js). `GilbaEvidenceUI.refresh` called directly on tab switch — matches exported API (confirmed last line of gaip-evidence-ui.js).
