@extends('layouts.db-shell', ['title' => 'Plan', 'currentPage' => 'plan'])

@section('head')
<script>
    // GH-246: Plan never needs live climate normals just to
    // render on load (the saved calendar program and Seasonal N card both
    // read from persisted/cached data, not window.climateMetrics) — only a
    // "Generate Nutrition Program" click does. Skip climate-normals-service.js's
    // eager DOMContentLoaded fetch here; nutrition-calendar.js's generate()
    // calls GilbaClimateNormalsService.ensureFromPage() itself on click.
    window.GAIP_CLIMATE_NORMALS_SKIP_AUTOTRIGGER = true;

    Object.assign(window.GAIP_HUB_CONFIG, {
        turfSpecies:     @json($turfSpecies),
        turfMethodology: @json($turfMethodology),
        savedLocation:   @json($savedLocation ?? null),
        // GH-294: Site::soil_texture_override (falling back to the account's
        // soil_texture) -- lives on the Site model, not inside gaipConfig's
        // JSON blob, so it needs its own pass-through from PageController.
        soilTexture:     @json($soilTexture ?? null),
    });
    window.GAIP_SITE_CONFIG = @json($gaipConfig ?? null);

    // Bridge: populate GAIP_STATE for nutrition-calendar.js from plan page data sources.
    // nutrition-calendar.js reads from GAIP_STATE (hub format); plan page has
    // GAIP_SITE_CONFIG (raw config) and GAIP_DASHBOARD_DATA (analysis cache).
    (function () {
        var config = window.GAIP_SITE_CONFIG || {};
        var hub    = window.GAIP_HUB_CONFIG  || {};
        var dash   = window.GAIP_DASHBOARD_DATA || {};
        var comp   = dash.computed || {};
        var clim   = comp.climate  || {};
        var turf   = config.turf   || {};
        var soil   = config.soil   || {};
        // Prefer hub.savedLocation for coordinates — it comes from $activeSite->latitude/longitude (PHP)
        // which is guaranteed to have lat/lon. config.location may only have a name string.
        var loc    = hub.savedLocation || config.location || {};

        var state = window.GAIP_STATE || {};

        state.turf = Object.assign({}, state.turf || {}, {
            effectiveSpecies: turf.species || hub.turfSpecies,
            grassSpecies:     turf.species || hub.turfSpecies,
            turfType:         turf.turfType || turf.type,
            subCategory:      turf.subCategory,
            traffic:          turf.traffic || 'moderate',
            cotula:           !!(turf.cotula),
        });

        state.climate = Object.assign({}, state.climate || {}, {
            monthlyTemps: clim.monthlyTemps || state.climate && state.climate.monthlyTemps,
            latitude:     parseFloat(loc.lat) || clim.latitude,
        });

        // Detect NZ from coordinates (lat -47 to -34, lon 166 to 179)
        var _lat = parseFloat(loc.lat || 0);
        var _lon = parseFloat(loc.lon || loc.lng || 0);
        var _isNZ = (_lon >= 166 && _lon <= 179 && _lat >= -47 && _lat <= -34);
        var _isAU = (_lon >= 113 && _lon <= 154 && _lat >= -44 && _lat <= -10);

        // Set region so isNewZealand()/isAustralia() in fertiliser integrations can
        // detect the region without regional-profiles.js (not loaded on this page).
        var _region = _isNZ ? 'new_zealand' : (_isAU ? 'australia_temperate' : undefined);

        // Always set state.location so isNewZealand() can find coordinates
        state.location = Object.assign({}, state.location || {}, {
            lat: _lat || undefined,
            lon: _lon || undefined,
            lng: _lon || undefined,
            region: _region,
        });

        // Methodology: hub.turfMethodology is the authoritative value from Settings (PHP/DB).
        // It is uppercase (e.g. 'AMMONIUM_ACETATE'), so lowercase it.
        // Fall back to config values, then NZ coordinate detection.
        var _hubMeth = (hub.turfMethodology || '').toLowerCase() || null;
        var _methodology = _hubMeth || (turf.methodology || '').toLowerCase() || (soil.methodology || '').toLowerCase() || null;
        if (!_methodology || _methodology === 'mlsn') {
            _methodology = _isNZ ? 'ammonium_acetate' : (_methodology || 'mlsn');
        }

        var si = state.inputs || {};
        si.soil = Object.assign({}, si.soil || {}, {
            P: soil.P, K: soil.K, Ca: soil.Ca, Mg: soil.Mg, S: soil.S,
            Fe: soil.Fe, Mn: soil.Mn, Zn: soil.Zn, Cu: soil.Cu,
            methodology:  _methodology,
            bulkDensity:  soil.bulkDensity,
            depth:        soil.depth,
            surfaceType:  turf.subCategory || turf.turfType,
            // GH-294: from Site::soil_texture_override (PageController), not
            // gaipConfig -- the AA K-reconciliation preview's deriveCode()
            // call (GH-291) needs this to resolve a real certificate instead
            // of always seeing '' and falling back to the generic range.
            soilTexture:  hub.soilTexture || undefined,
        });
        state.inputs = si;

        window.GAIP_STATE = state;

        console.log('[GH302-DEBUG] plan.blade.php bridge | hub.soilTexture:', hub.soilTexture,
            '| si.soil.soilTexture:', si.soil.soilTexture,
            '| GAIP_STATE.inputs.soil.soilTexture:', window.GAIP_STATE.inputs && window.GAIP_STATE.inputs.soil && window.GAIP_STATE.inputs.soil.soilTexture);

        // climateMetrics is read directly by some internal helpers
        if (clim.monthlyTemps || loc.lat) {
            var cm = window.climateMetrics || {};
            if (clim.monthlyTemps) cm.monthlyTemps = clim.monthlyTemps;
            if (loc.lat) cm.latitude = parseFloat(loc.lat);
            window.climateMetrics = cm;
        }
    })();
</script>
@endsection

@section('styles')
<style>
/* Soil Sample dropdown (soil-nutrition-analysis.js) has a hardcoded 560px cap
   sized for Analysis's own narrower container — wider than that here, so it
   stops short of matching its sibling fields' width. Let it fill the column. */
#plan-nut-sample-picker .sn-drop-btn { max-width: none; }

/* ── Plan page layout ─────────────────────────────────────────────────── */
.plan-tab-body {
    padding: 16px 20px 32px;
    display: flex;
    flex-direction: column;
    gap: 16px;
}
.plan-ical-btn {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 7px 14px;
    border-radius: var(--gaip-radius-pill);
    border: 1px solid var(--gaip-border);
    background: var(--gaip-surface);
    color: var(--gaip-text-secondary);
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
    white-space: nowrap;
    transition: background 0.15s, border-color 0.15s;
    flex-shrink: 0;
}
.plan-ical-btn:hover {
    background: var(--gaip-surface-muted);
    border-color: var(--gaip-accent);
    color: var(--gaip-accent);
}

/* ── Two-column windows grid ─────────────────────────────────────────── */
.plan-windows-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 16px;
}
@media (max-width: 768px) {
    .plan-windows-grid { grid-template-columns: 1fr; }
}

/* ── Card ─────────────────────────────────────────────────────────────── */
.plan-card {
    background: var(--gaip-surface);
    border: 1px solid var(--gaip-border);
    border-radius: var(--gaip-radius);
    padding: 18px 20px 20px;
    box-shadow: var(--gaip-shadow);
}
.plan-card-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 14px;
    gap: 8px;
}
.plan-card-title {
    display: flex;
    align-items: center;
    gap: 7px;
    font-size: 13px;
    font-weight: 700;
    color: var(--gaip-text);
}

/* ── Status badges ───────────────────────────────────────────────────── */
.plan-badge {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 3px 9px;
    border-radius: var(--gaip-radius-pill);
    font-size: 11px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    white-space: nowrap;
}
.plan-badge.green  { background: var(--gaip-good-bg);     color: var(--gaip-good);     border: 1px solid var(--gaip-good-border); }
.plan-badge.amber  { background: var(--gaip-warning-bg);  color: var(--gaip-warning);  border: 1px solid var(--gaip-warning-border); }
.plan-badge.red    { background: var(--gaip-critical-bg); color: var(--gaip-critical); border: 1px solid var(--gaip-critical-border); }
.plan-badge.grey   { background: var(--gaip-surface-muted); color: var(--gaip-text-muted); border: 1px solid var(--gaip-border); }

/* ── Empty / loading states ──────────────────────────────────────────── */
.plan-empty {
    padding: 24px 0 8px;
    text-align: center;
    color: var(--gaip-text-muted);
}
.plan-empty-icon {
    font-size: 28px;
    margin-bottom: 8px;
    opacity: 0.5;
}
.plan-empty-title {
    font-size: 13px;
    font-weight: 600;
    color: var(--gaip-text-secondary);
    margin-bottom: 6px;
}
.plan-empty-body {
    font-size: 12px;
    line-height: 1.6;
    max-width: 340px;
    margin: 0 auto;
}
.plan-empty-steps {
    margin: 10px 0 0;
    padding: 0;
    list-style: none;
    text-align: left;
    display: inline-block;
}
.plan-empty-steps li {
    display: flex;
    align-items: baseline;
    gap: 6px;
    font-size: 12px;
    color: var(--gaip-text-muted);
    margin-bottom: 5px;
}
.plan-empty-steps li::before { content: '•'; color: var(--gaip-accent); }
.plan-empty-steps a { color: var(--gaip-accent); text-decoration: none; font-weight: 600; }
.plan-empty-steps a:hover { text-decoration: underline; }

/* ── Metrics grid ────────────────────────────────────────────────────── */
.plan-metrics-row {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 10px;
    margin-bottom: 16px;
}
.plan-metric {
    background: var(--gaip-surface-muted);
    border-radius: var(--gaip-radius-sm);
    padding: 10px 12px;
    text-align: center;
}
.plan-metric-value {
    font-size: 20px;
    font-weight: 800;
    color: var(--gaip-text);
    line-height: 1.1;
}
.plan-metric-value.good    { color: var(--gaip-good); }
.plan-metric-value.warning { color: var(--gaip-warning); }
.plan-metric-value.bad     { color: var(--gaip-critical); }
.plan-metric-label {
    font-size: 10px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--gaip-text-muted);
    margin-top: 2px;
}
.plan-metric-sub {
    font-size: 11px;
    color: var(--gaip-text-muted);
    margin-top: 2px;
}

/* ── Progress bar ────────────────────────────────────────────────────── */
.plan-gdd-bar-wrap {
    position: relative;
    height: 10px;
    background: var(--gaip-surface-muted);
    border-radius: 5px;
    margin: 4px 0 28px;
    overflow: visible;
}
.plan-gdd-bar-fill {
    height: 100%;
    border-radius: 5px;
    transition: width 0.4s;
}
.plan-gdd-bar-tick {
    position: absolute;
    top: -4px;
    width: 2px;
    height: 18px;
    background: var(--gaip-critical);
    border-radius: 1px;
}
.plan-gdd-bar-tick-label {
    position: absolute;
    top: 16px;
    transform: translateX(-50%);
    font-size: 9px;
    font-weight: 700;
    color: var(--gaip-critical);
    white-space: nowrap;
}

/* ── Pre-emergent species cards ──────────────────────────────────────── */
.plan-pe-list { display: flex; flex-direction: column; gap: 8px; }
.plan-pe-species {
    display: flex;
    align-items: flex-start;
    gap: 10px;
    padding: 10px 12px;
    border-radius: var(--gaip-radius-sm);
    border: 1px solid var(--gaip-border-light);
    background: var(--gaip-surface-muted);
}
.plan-pe-species.green  { border-color: var(--gaip-good-border);     background: var(--gaip-good-bg); }
.plan-pe-species.amber  { border-color: var(--gaip-warning-border);  background: var(--gaip-warning-bg); }
.plan-pe-species.red    { border-color: var(--gaip-critical-border); background: var(--gaip-critical-bg); }
.plan-pe-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    margin-top: 4px;
    flex-shrink: 0;
}
.plan-pe-dot.green  { background: var(--gaip-good); }
.plan-pe-dot.amber  { background: var(--gaip-warning); }
.plan-pe-dot.red    { background: var(--gaip-critical); }
.plan-pe-name { font-size: 12px; font-weight: 600; color: var(--gaip-text); }
.plan-pe-sci  { font-size: 11px; color: var(--gaip-text-muted); font-style: italic; }
.plan-pe-temp { font-size: 11px; color: var(--gaip-text-muted); margin-top: 2px; }
.plan-pe-action {
    font-size: 11px;
    color: var(--gaip-text-secondary);
    margin-top: 3px;
    line-height: 1.4;
}
.plan-pe-footer {
    margin-top: 12px;
    padding-top: 10px;
    border-top: 1px solid var(--gaip-border-light);
    font-size: 11px;
    color: var(--gaip-text-muted);
    display: flex;
    align-items: center;
    gap: 6px;
}

/* ── PGR section ─────────────────────────────────────────────────────── */
.plan-pgr-source {
    font-size: 11px;
    color: var(--gaip-text-muted);
    margin-bottom: 12px;
}
.plan-pgr-reapply {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 12px;
    border-radius: var(--gaip-radius-sm);
    font-size: 12px;
    font-weight: 600;
    margin-top: 12px;
}
.plan-pgr-reapply.amber { background: var(--gaip-warning-bg);  color: var(--gaip-warning);  border: 1px solid var(--gaip-warning-border); }
.plan-pgr-reapply.red   { background: var(--gaip-critical-bg); color: var(--gaip-critical); border: 1px solid var(--gaip-critical-border); }
.plan-pgr-reapply.green { background: var(--gaip-good-bg);     color: var(--gaip-good);     border: 1px solid var(--gaip-good-border); }
.plan-pgr-reapply.grey  { background: var(--gaip-surface-muted); color: var(--gaip-text-muted); border: 1px solid var(--gaip-border); }

/* ── Recovery calendar ───────────────────────────────────────────────── */
.plan-rec-metrics {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 10px;
    margin-bottom: 16px;
}
.plan-traffic-grid {
    display: grid;
    grid-template-columns: 60px repeat(7, 1fr);
    gap: 4px;
    margin-bottom: 16px;
}
.plan-traffic-header {
    font-size: 10px;
    font-weight: 700;
    text-transform: uppercase;
    color: var(--gaip-text-muted);
    text-align: center;
    padding: 4px 0;
}
.plan-traffic-week-label {
    font-size: 10px;
    font-weight: 600;
    color: var(--gaip-text-muted);
    display: flex;
    align-items: center;
    padding: 0 4px;
}
.plan-traffic-cell {
    padding: 6px 2px;
    border-radius: 4px;
    text-align: center;
    font-size: 10px;
    font-weight: 600;
}
.plan-traffic-cell.match    { background: #fca5a5; color: #7f1d1d; }
.plan-traffic-cell.training { background: var(--gaip-warning-border); color: #78350f; }
.plan-traffic-cell.rest     { background: var(--gaip-good-bg); color: #065f46; }
.plan-traffic-legend {
    display: flex;
    gap: 14px;
    font-size: 11px;
    color: var(--gaip-text-muted);
    margin-bottom: 16px;
}
.plan-traffic-legend span {
    display: flex;
    align-items: center;
    gap: 5px;
}
.plan-traffic-legend-dot {
    width: 10px;
    height: 10px;
    border-radius: 2px;
    flex-shrink: 0;
}
.plan-maint-list { display: flex; flex-direction: column; gap: 6px; margin-bottom: 16px; }
.plan-maint-item {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 10px 14px;
    border-radius: var(--gaip-radius-sm);
    border: 1px solid var(--gaip-border-light);
    background: var(--gaip-surface-muted);
}
.plan-maint-icon { font-size: 16px; flex-shrink: 0; }
.plan-maint-name { font-size: 12px; font-weight: 700; color: var(--gaip-text); min-width: 100px; }
.plan-maint-detail { font-size: 11px; color: var(--gaip-text-muted); flex: 1; }
.plan-maint-window {
    font-size: 11px;
    font-weight: 600;
    color: var(--gaip-accent);
    white-space: nowrap;
}
.plan-stress-factors {
    margin-top: 12px;
    padding: 12px 14px;
    background: var(--gaip-warning-bg);
    border: 1px solid var(--gaip-warning-border);
    border-radius: var(--gaip-radius-sm);
}
.plan-stress-title {
    font-size: 12px;
    font-weight: 700;
    color: #92400e;
    margin-bottom: 8px;
}
.plan-stress-item {
    display: flex;
    align-items: baseline;
    gap: 8px;
    font-size: 11px;
    color: var(--gaip-text);
    padding: 4px 0;
    border-bottom: 1px solid var(--gaip-warning-border);
}
.plan-stress-item:last-child { border-bottom: none; }
.plan-stress-effect { margin-left: auto; font-weight: 600; color: var(--gaip-warning); }
.plan-load-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 12px;
    margin-bottom: 14px;
}
.plan-load-table th {
    text-align: left;
    font-size: 10px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--gaip-text-muted);
    padding: 4px 8px 6px;
    border-bottom: 1px solid var(--gaip-border);
}
.plan-load-table td {
    padding: 6px 8px;
    color: var(--gaip-text);
    border-bottom: 1px solid var(--gaip-border-light);
}
.plan-load-table tr:last-child td {
    border-bottom: none;
    font-weight: 700;
    border-top: 2px solid var(--gaip-border);
}
details.plan-details { margin-top: 12px; }
details.plan-details > summary {
    cursor: pointer;
    font-size: 11px;
    font-weight: 600;
    color: var(--gaip-text-muted);
    list-style: none;
    display: flex;
    align-items: center;
    gap: 6px;
    user-select: none;
}
details.plan-details > summary::before {
    content: '▶';
    font-size: 8px;
    transition: transform 0.2s;
}
details.plan-details[open] > summary::before { transform: rotate(90deg); }
.plan-modifiers-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 6px 16px;
    margin-top: 10px;
    font-size: 11px;
    color: var(--gaip-text-muted);
}
.plan-modifiers-grid strong { color: var(--gaip-text-secondary); }

/* ── Nutrition program ────────────────────────────────────────────────── */
.plan-form { display: flex; flex-direction: column; gap: 14px; }
.plan-form-row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 14px;
}
@media (max-width: 600px) { .plan-form-row { grid-template-columns: 1fr; } }
.plan-form-group { display: flex; flex-direction: column; gap: 4px; }
.plan-form-label {
    font-size: 11px;
    font-weight: 700;
    color: var(--gaip-text-muted);
    text-transform: uppercase;
    letter-spacing: 0.05em;
    display: flex;
    align-items: center;
    gap: 5px;
}
.plan-form-input, .plan-form-select {
    padding: 8px 10px;
    border: 1px solid var(--gaip-border);
    border-radius: var(--gaip-radius-sm);
    background: var(--gaip-surface);
    color: var(--gaip-text);
    font-size: 13px;
    font-family: var(--gaip-font);
    transition: border-color 0.15s;
    -webkit-appearance: none;
    appearance: none;
}
.plan-form-select {
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%236b7280' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E");
    background-repeat: no-repeat;
    background-position: right 8px center;
    background-size: 12px 12px;
    padding-right: 28px;
}
.plan-form-input:focus, .plan-form-select:focus {
    outline: none;
    border-color: var(--gaip-accent);
    box-shadow: 0 0 0 3px rgba(45,168,94,0.15);
}
.plan-form-hint {
    font-size: 11px;
    color: var(--gaip-text-muted);
    margin-top: 1px;
}
/* ── Shared action components ─────────────────────────────────────────── */
/* Edit/settings link — used in card headers across all Plan tabs */
.plan-edit-link {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    font-size: 12px;
    color: var(--gaip-text-muted);
    text-decoration: none;
    font-weight: 500;
    transition: color .15s;
    white-space: nowrap;
}
.plan-edit-link:hover { color: var(--gaip-accent); }

/* Primary action button — used at bottom of cards across all Plan tabs */
/* Works on both <a> and <button> elements */
.plan-action-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    width: 100%;
    padding: 9px 16px;
    border-radius: var(--gaip-radius-sm);
    background: var(--gaip-accent);
    color: #fff;
    font-size: 13px;
    font-weight: 600;
    border: none;
    cursor: pointer;
    text-decoration: none;
    transition: opacity .15s;
    box-sizing: border-box;
    text-align: center;
}
.plan-action-btn:hover { opacity: .85; color: #fff; }
.plan-action-btn:disabled { opacity: .6; cursor: not-allowed; }

/* Standard card footer wrapper — border separator above action area */
.plan-card-footer {
    margin-top: 14px;
    padding-top: 12px;
    border-top: 1px solid var(--gaip-border);
}

.plan-generate-btn {
    align-self: flex-start;
    padding: 9px 20px;
    border-radius: var(--gaip-radius-sm);
    border: none;
    background: var(--gaip-accent);
    color: #fff;
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    transition: opacity 0.15s;
    width: 100%;
}
.plan-generate-btn:hover { opacity: .85; }
.plan-generate-btn:disabled { opacity: 0.6; cursor: not-allowed; }
.plan-cal-export-row {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-top: 4px;
}
.plan-btn-secondary {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 6px 14px;
    border-radius: var(--gaip-radius-pill);
    border: 1px solid var(--gaip-border);
    background: var(--gaip-surface);
    color: var(--gaip-text-secondary);
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
    transition: background 0.15s;
}
.plan-btn-secondary:hover { background: var(--gaip-surface-muted); }
.plan-form-divider {
    border: none;
    border-top: 1px solid var(--gaip-border-light);
    margin: 4px 0;
}

/* ── Seasonal N ──────────────────────────────────────────────────────── */
.plan-seasonal-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 10px;
    margin-bottom: 14px;
}
@media (max-width: 600px) { .plan-seasonal-grid { grid-template-columns: 1fr; } }
.plan-seasonal-quarter {
    padding: 14px 16px;
    border-radius: var(--gaip-radius-sm);
    border: 1px solid var(--gaip-border-light);
    background: var(--gaip-surface-muted);
}
.plan-seasonal-quarter.current {
    border-color: var(--gaip-accent);
    background: var(--gaip-accent-light);
}
.plan-seasonal-name { font-size: 12px; font-weight: 700; color: var(--gaip-text); margin-bottom: 4px; }
.plan-seasonal-temp { font-size: 11px; color: var(--gaip-text-muted); margin-bottom: 8px; }
.plan-seasonal-n { font-size: 20px; font-weight: 800; color: var(--gaip-accent); }
.plan-seasonal-n-unit { font-size: 11px; color: var(--gaip-text-muted); margin-left: 2px; }
.plan-seasonal-note { font-size: 11px; color: var(--gaip-text-secondary); margin-top: 6px; line-height: 1.4; }

/* ── Plan primary button ──────────────────────────────────────────────── */
.plan-btn-primary {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 8px 16px;
    border-radius: var(--gaip-radius-pill);
    border: none;
    background: var(--gaip-accent);
    color: #fff;
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    transition: background 0.15s;
}
.plan-btn-primary:hover { background: var(--gaip-accent-hover); }
.plan-btn-primary:disabled { opacity: 0.55; cursor: not-allowed; }

/* ── Plan collapsible (details/summary) ──────────────────────────────── */
.plan-collapsible {
    border: 1px solid var(--gaip-border);
    border-radius: var(--gaip-radius-sm);
    overflow: hidden;
    margin-top: 14px;
}
.plan-collapsible-summary {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 10px 14px;
    cursor: pointer;
    font-size: 12px;
    font-weight: 600;
    color: var(--gaip-text-secondary);
    background: var(--gaip-surface-muted);
    list-style: none;
    user-select: none;
}
.plan-collapsible-summary::-webkit-details-marker { display: none; }
.plan-collapsible-summary svg { transition: transform 0.2s; flex-shrink: 0; }
details[open] .plan-collapsible-summary svg { transform: rotate(180deg); }
.plan-collapsible-body {
    padding: 14px;
    border-top: 1px solid var(--gaip-border);
}

/* ── Traffic & Wear 4-column history grid ─────────────────────────────── */
@media (max-width: 700px) {
    .plan-form-row-4 { grid-template-columns: 1fr 1fr; }
}
.plan-form-row-4 {
    display: grid;
    grid-template-columns: 1fr 1fr 1fr 1fr;
    gap: 10px;
}
</style>
@endsection

@section('content')

    {{-- ── PAGE HEADER (rendered by plan-ui.js → renderPlanHeader) ─── --}}
    <div id="plan-header-content"></div>

    {{-- ── TABS BAR ─────────────────────────────────────────────────── --}}
    <nav class="gl-tabs-bar">
        <div class="gl-tabs-inner">
            <a href="#pre-emergent" class="gl-tab" data-tab="pre-emergent">
                <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5" style="flex-shrink:0"><path stroke-linecap="round" stroke-linejoin="round" d="M12 3c0 0-6 4-6 9a6 6 0 0012 0c0-5-6-9-6-9z"/></svg>
                Pre-emergent
                <span class="gl-tab-badge" id="gl-badge-timing"></span>
            </a>
            <a href="#pgr" class="gl-tab" data-tab="pgr">
                <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5" style="flex-shrink:0"><path stroke-linecap="round" stroke-linejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>
                PGR
                <span class="gl-tab-badge" id="gl-badge-pgr"></span>
            </a>
            @if(($gaipConfig['turf']['turfType'] ?? '') === 'sports')
            <a href="#recovery" class="gl-tab" data-tab="recovery">
                <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5" style="flex-shrink:0"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>
                Recovery
            </a>
            @endif
            <a href="#nutrition" class="gl-tab" data-tab="nutrition">
                <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5" style="flex-shrink:0"><path stroke-linecap="round" stroke-linejoin="round" d="M12 3c0 0-6 4-6 9a6 6 0 0012 0c0-5-6-9-6-9z"/></svg>
                Nutrition
            </a>
        </div>
    </nav>

    {{-- ── TAB: PRE-EMERGENT ───────────────────────────────────────── --}}
    <div id="plan-tab-pre-emergent" style="flex:1;overflow-y:auto;scrollbar-gutter:stable;display:none">
        <div class="plan-tab-body">
            <div class="plan-card" id="plan-pe-card">
                <div class="plan-card-header">
                    <div class="plan-card-title">
                        <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" style="color:var(--gaip-good)"><path stroke-linecap="round" stroke-linejoin="round" d="M12 3c0 0-6 4-6 9a6 6 0 0012 0c0-5-6-9-6-9z"/></svg>
                        Pre-emergent Timing
                        <span class="db-info-icon" data-info="pre-emergent" tabindex="0" role="button" aria-label="About Pre-emergent Timing">i</span>
                    </div>
                    <span class="plan-badge" id="plan-pe-badge" style="display:none"></span>
                </div>
                <div id="plan-pe-body">
                    <div class="plan-empty">
                        <div class="plan-empty-title">Loading…</div>
                    </div>
                </div>
            </div>
        </div>{{-- /plan-tab-body --}}
    </div>

    {{-- ── TAB: PGR ─────────────────────────────────────────────────── --}}
    <div id="plan-tab-pgr" style="flex:1;overflow-y:auto;scrollbar-gutter:stable;display:none">
        <div class="plan-tab-body">
            <div class="plan-card" id="plan-pgr-card">
                <div class="plan-card-header">
                    <div class="plan-card-title">
                        <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" style="color:var(--gaip-accent)"><path stroke-linecap="round" stroke-linejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>
                        PGR Schedule
                        <span class="db-info-icon" data-info="pgr-schedule" tabindex="0" role="button" aria-label="About PGR Schedule">i</span>
                    </div>
                    <span class="plan-badge" id="plan-pgr-badge" style="display:none"></span>
                </div>
                <div id="plan-pgr-body">
                    <div class="plan-empty">
                        <div class="plan-empty-title">Loading…</div>
                    </div>
                </div>
            </div>
        </div>{{-- /plan-tab-body --}}
    </div>

    {{-- ── TAB: RECOVERY ────────────────────────────────────────────── --}}
    <div id="plan-tab-recovery" style="flex:1;overflow-y:auto;scrollbar-gutter:stable;display:none">
        <div class="plan-tab-body">

            <div class="plan-card" id="plan-rec-card">
                <div class="plan-card-header">
                    <div class="plan-card-title">
                        <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" style="color:var(--gaip-warning)"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>
                        Recovery Calendar
                        <span class="db-info-icon" data-info="recovery-calendar" tabindex="0" role="button" aria-label="About Recovery Calendar">i</span>
                    </div>
                    <a href="/settings#traffic" class="plan-edit-link" id="plan-rec-settings-link" hidden>
                        <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/><circle cx="12" cy="12" r="3"/></svg>
                        Edit traffic schedule →
                    </a>
                </div>
                <div id="plan-rec-body">
                    <div class="plan-empty">
                        <div class="plan-empty-title">Loading…</div>
                    </div>
                </div>
            </div>
        </div>{{-- /plan-tab-body --}}
    </div>

    {{-- ── TAB: NUTRITION ───────────────────────────────────────────── --}}
    <div id="plan-tab-nutrition" style="flex:1;overflow-y:auto;scrollbar-gutter:stable;display:none">
        <div class="plan-tab-body">

            {{-- Nutrition Program --}}
            <div class="plan-card" id="plan-nut-card">
                <div class="plan-card-header">
                    <div class="plan-card-title">
                        <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" style="color:var(--gaip-accent)"><rect x="3" y="4" width="18" height="18" rx="2"/><path stroke-linecap="round" d="M16 2v4M8 2v4M3 10h18M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01"/></svg>
                        Nutrition Program
                        <span class="db-info-icon" data-info="nutrition-program" tabindex="0" role="button" aria-label="About Nutrition Program">i</span>
                    </div>
                </div>

                <div id="plan-nut-form-wrap" data-nutrition-calendar-module>
                    <form class="plan-form" id="plan-nut-form" autocomplete="off">
                        <div class="plan-form-row">
                            <div class="plan-form-group">
                                <label class="plan-form-label" for="plan-nut-annual-n">
                                    Annual N Target
                                    <span class="db-info-icon" data-info="annual-n-target" tabindex="0" role="button">i</span>
                                </label>
                                <input class="plan-form-input gaip-nutrition-annual-n" type="number" id="plan-nut-annual-n" min="0" max="600" step="1" placeholder="e.g. 120">
                                <div class="plan-form-hint">kg N/ha/yr · Greens: 80–150 · Tees: 120–180 · Sports: 180–350</div>
                            </div>
                            <div class="plan-form-group">
                                <label class="plan-form-label" for="plan-nut-max-n">
                                    Max N per Application
                                    <span class="db-info-icon" data-info="max-n-app" tabindex="0" role="button">i</span>
                                </label>
                                <input class="plan-form-input gaip-nutrition-max-n" type="number" id="plan-nut-max-n" min="0" max="50" step="0.5" placeholder="e.g. 15">
                                <div class="plan-form-hint">kg N/ha per single application</div>
                            </div>
                        </div>
                        <div class="plan-form-row">
                            <div class="plan-form-group">
                                <label class="plan-form-label" for="plan-nut-distribution">Distribution Method</label>
                                <select class="plan-form-select gaip-nutrition-distribution" id="plan-nut-distribution">
                                    <option value="gp_weighted">GP-Weighted (recommended)</option>
                                    <option value="even">Even Distribution</option>
                                    <option value="front_loaded">Front-loaded (spring emphasis)</option>
                                </select>
                            </div>
                            <div class="plan-form-group">
                                <label class="plan-form-label" for="plan-nut-clipping">Clipping Management</label>
                                <select class="plan-form-select gaip-nutrition-clipping" id="plan-nut-clipping">
                                    <option value="collected">Collected (removed)</option>
                                    <option value="returned">Returned (mulched)</option>
                                </select>
                            </div>
                        </div>
                        <div class="plan-form-row">
                            <div class="plan-form-group">
                                <label class="plan-form-label">Soil Sample</label>
                                <div id="plan-nut-sample-picker"></div>
                                <div class="plan-form-hint">Calculating for: <strong id="plan-nut-sample-label">—</strong></div>
                            </div>
                            <div class="plan-form-group">
                                <label class="plan-form-label" for="plan-nut-monthly-n">
                                    Current Monthly N Rate
                                    <span class="db-info-icon" data-info="monthly-n-rate" tabindex="0" role="button">i</span>
                                </label>
                                <input class="plan-form-input" type="number" id="plan-nut-monthly-n" min="0" max="100" step="0.1" placeholder="kg/ha/month">
                                <div class="plan-form-hint">Your actual monthly application — compared against growth-limited N uptake capacity from the analysis.</div>
                            </div>
                        </div>
                        <div>
                            <button type="button" class="plan-generate-btn" id="plan-nut-generate-btn" data-nutrition-generate>
                                Generate Nutrition Program
                            </button>
                        </div>
                    </form>

                    <div data-nutrition-results id="plan-nut-results" style="display:none">
                        <div data-nutrition-summary></div>
                        <div data-nutrition-calendar></div>
                    </div>
                </div>

            </div>{{-- /plan-nut-card --}}

            {{-- Seasonal N Plan --}}
            <div class="plan-card" id="plan-seasonal-card">
                <div class="plan-card-header">
                    <div class="plan-card-title">
                        <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" style="color:var(--gaip-info)"><path stroke-linecap="round" stroke-linejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/></svg>
                        Seasonal N Plan
                        <span class="db-info-icon" data-info="seasonal-n" tabindex="0" role="button" aria-label="About Seasonal N Plan">i</span>
                    </div>
                    <a href="/settings#turf" class="plan-edit-link" id="plan-seasonal-edit-link">
                        <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/><circle cx="12" cy="12" r="3"/></svg>
                        Edit N programme →
                    </a>
                </div>
                <div id="plan-seasonal-body">
                    <div class="plan-empty">
                        <div class="plan-empty-title">Loading…</div>
                    </div>
                </div>
            </div>

        </div>{{-- /plan-tab-body --}}
    </div>

@endsection

@section('overlays')
<div id="db-info-popover" class="db-info-popover" style="display:none" role="tooltip" aria-live="polite">
    <div class="db-info-popover-arrow" id="db-info-popover-arrow"></div>
    <button class="db-info-popover-close" id="db-info-popover-close" aria-label="Close">×</button>
    <div class="db-info-popover-title" id="db-info-popover-title"></div>
    <div class="db-info-popover-body" id="db-info-popover-body" style="white-space:pre-line"></div>
</div>
@endsection

@section('scripts')
<link rel="stylesheet" href="{{ $legacyAssetUrl('nutrition-calendar.css') }}">
<script src="{{ $legacyAssetUrl('gp-status.js') }}"></script>
<script src="{{ $legacyAssetUrl('dashboard-init.js') }}"></script>
<script src="{{ $legacyAssetUrl('gilba-pgr-module-v3.js') }}"></script>
<script src="{{ $legacyAssetUrl('pgr-forecast.js') }}"></script>
<script src="{{ $legacyAssetUrl('plan-ui.js') }}"></script>
<script src="{{ $legacyAssetUrl('growth-potential-engine.js') }}"></script>
{{-- GH-245 (Hoxton audit D01-D03): real monthly climate normals for Monthly Schedule --}}
<script src="{{ $legacyAssetUrl('climate-normals-service.js') }}"></script>
<script src="{{ $legacyAssetUrl('soil-nutrition-analysis.js') }}"></script>
{{-- GH-301: nutrition-calendar.js's AA ceiling check (GH-300) needs
     HillLabsSampleTypes.deriveCode()/getRangesPpm() -- wasn't loaded on this
     page at all (Plan is a deliberately lightweight page, doesn't pull in
     the full hub.blade.php script bundle), so the ceiling silently no-opped
     for every AA site here regardless of species/texture. Must load before
     nutrition-calendar.js. --}}
<script src="{{ $legacyAssetUrl('hill-labs-sample-types.js') }}"></script>
{{-- GH-303: deriveCode() normalises the species argument via
     SpeciesController.normalize() (e.g. "Perennial Ryegrass" -> the
     canonical 'perennialRyegrass' key it switches on) when that global is
     present, silently falling back to the raw, un-normalised string
     otherwise -- which never matches deriveCode()'s canonical-key checks.
     species-controller.js was never loaded on this page (unlike hub.blade.php
     and the 3 reports/*.blade.php views that also load nutrition-calendar.js),
     so deriveCode() always returned null here even with correct
     speciesDisplay/soilTexture inputs (GH-301/302 fixed those; this was the
     remaining gap). Must load before nutrition-calendar.js's generate(). --}}
<script src="{{ $legacyAssetUrl('species-controller.js') }}"></script>
{{-- GH-305 (D07 item 6, "correction for generic numbers too" -- user decision,
     2026-08-24): computeProgram()'s AA ceiling now also fires on the
     texture-only generic range (AmmoniumAcetateMethodology.getSufficiencyRange())
     when no Hill Labs certificate covers a nutrient -- previously an
     uncovered/uncertified nutrient could never be zeroed even when clearly
     oversupplied (e.g. Sulphur on an S277 site, whose certificate prints no
     Sulphur range at all). Wasn't loaded on this page at all (same
     deliberately-lightweight-page gap as GH-301/303). Must load before
     nutrition-calendar.js. --}}
<script src="{{ $legacyAssetUrl('ammonium-acetate-methodology.js') }}"></script>
<script src="{{ $legacyAssetUrl('nutrition-calendar.js') }}"></script>
{{-- GH-292: shared K-reconciliation decision logic, extracted from word-export.js
     so this page doesn't need to load the entire export module just for the
     Nutrient Delivery Summary's Spot-K reconciliation preview. Must load
     before nutrition-prebble-integration.js. --}}
<script src="{{ $legacyAssetUrl('k-reconciliation-decision.js') }}"></script>
<script src="{{ $legacyAssetUrl('prebbles-products.js') }}"></script>
<script src="{{ $legacyAssetUrl('nutrition-prebble-integration.js') }}"></script>
<script src="{{ $legacyAssetUrl('au-fertiliser-products.js') }}"></script>
<script src="{{ $legacyAssetUrl('nutrition-au-fertiliser-integration.js') }}"></script>
<script src="{{ $legacyAssetUrl('uk-fertiliser-products.js') }}"></script>
<script src="{{ $legacyAssetUrl('nutrition-uk-fertiliser-integration.js') }}"></script>
<script src="{{ $legacyAssetUrl('aitkens-fertiliser-products.js') }}"></script>
<script src="{{ $legacyAssetUrl('nz-fertiliser-products.js') }}"></script>
<script src="{{ $legacyAssetUrl('nutrition-nz-fertiliser-integration.js') }}"></script>
@endsection
