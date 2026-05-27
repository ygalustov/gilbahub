@extends('layouts.db-shell', ['title' => 'Plan', 'currentPage' => 'plan'])

@section('head')
<script>
    Object.assign(window.GAIP_HUB_CONFIG, {
        turfSpecies:     @json($turfSpecies),
        turfMethodology: @json($turfMethodology),
        savedLocation:   @json($savedLocation ?? null),
    });
    window.GAIP_SITE_CONFIG = @json($gaipConfig ?? null);
</script>
@endsection

@section('styles')
<style>
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
    margin: 4px 0 12px;
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
.plan-generate-btn {
    align-self: flex-start;
    padding: 9px 20px;
    border-radius: var(--gaip-radius-pill);
    border: none;
    background: var(--gaip-accent);
    color: #fff;
    font-size: 13px;
    font-weight: 700;
    cursor: pointer;
    transition: background 0.15s;
}
.plan-generate-btn:hover { background: var(--gaip-accent-hover); }
.plan-generate-btn:disabled { opacity: 0.6; cursor: not-allowed; }
.plan-nutrition-summary {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 10px;
    margin-bottom: 16px;
    padding: 14px;
    background: var(--gaip-surface-muted);
    border-radius: var(--gaip-radius-sm);
}
@media (max-width: 600px) { .plan-nutrition-summary { grid-template-columns: 1fr 1fr; } }
.plan-nutrition-summary-item { display: flex; flex-direction: column; gap: 2px; }
.plan-nutrition-summary-key { font-size: 10px; font-weight: 700; text-transform: uppercase; color: var(--gaip-text-muted); letter-spacing: 0.05em; }
.plan-nutrition-summary-val { font-size: 13px; font-weight: 700; color: var(--gaip-text); }
.plan-nutrition-totals {
    display: grid;
    grid-template-columns: repeat(6, 1fr);
    gap: 6px;
    margin-bottom: 16px;
}
@media (max-width: 600px) { .plan-nutrition-totals { grid-template-columns: repeat(3, 1fr); } }
.plan-nut-total {
    background: var(--gaip-surface-muted);
    border-radius: var(--gaip-radius-sm);
    padding: 10px 8px;
    text-align: center;
}
.plan-nut-total-val { font-size: 18px; font-weight: 800; color: var(--gaip-accent); }
.plan-nut-total-label { font-size: 10px; font-weight: 700; color: var(--gaip-text-muted); text-transform: uppercase; margin-top: 2px; }
.plan-nut-total-unit { font-size: 9px; color: var(--gaip-text-muted); }
.plan-cal-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 12px;
    margin-bottom: 14px;
}
.plan-cal-table th {
    text-align: right;
    font-size: 10px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: var(--gaip-text-muted);
    padding: 5px 8px;
    border-bottom: 2px solid var(--gaip-border);
}
.plan-cal-table th:first-child, .plan-cal-table th:nth-child(2) { text-align: left; }
.plan-cal-table td {
    text-align: right;
    padding: 6px 8px;
    color: var(--gaip-text);
    border-bottom: 1px solid var(--gaip-border-light);
}
.plan-cal-table td:first-child { text-align: left; font-weight: 600; }
.plan-cal-table td:nth-child(2) { text-align: left; color: var(--gaip-text-muted); }
.plan-cal-table tr.current-month td { background: var(--gaip-accent-light); font-weight: 700; }
.plan-cal-table tfoot td { font-weight: 700; border-top: 2px solid var(--gaip-border); border-bottom: none; background: var(--gaip-surface-muted); }
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
</style>
@endsection

@section('content')

    {{-- ── PAGE HEADER (rendered by plan-ui.js → renderPlanHeader) ─── --}}
    <div id="plan-header-content"></div>

    {{-- ── TABS BAR ─────────────────────────────────────────────────── --}}
    <nav class="gl-tabs-bar">
        <div class="gl-tabs-inner">
            <a href="#timing" class="gl-tab" data-tab="timing">
                <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5" style="flex-shrink:0"><circle cx="12" cy="12" r="10"/><path stroke-linecap="round" d="M12 6v6l4 2"/></svg>
                Timing
                <span class="gl-tab-badge" id="gl-badge-timing"></span>
            </a>
            <a href="#recovery" class="gl-tab" data-tab="recovery">
                <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5" style="flex-shrink:0"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>
                Recovery
            </a>
            <a href="#nutrition" class="gl-tab" data-tab="nutrition">
                <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5" style="flex-shrink:0"><path stroke-linecap="round" stroke-linejoin="round" d="M12 3c0 0-6 4-6 9a6 6 0 0012 0c0-5-6-9-6-9z"/></svg>
                Nutrition
            </a>
        </div>
    </nav>

    {{-- ── TAB: TIMING ─────────────────────────────────────────────── --}}
    <div id="plan-tab-timing" style="flex:1;overflow-y:auto;scrollbar-gutter:stable;display:none">
        <div class="plan-tab-body">
            <div class="plan-windows-grid">

                {{-- Pre-emergent Timing --}}
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

                {{-- PGR Schedule --}}
                <div class="plan-card" id="plan-pgr-card">
                    <div class="plan-card-header">
                        <div class="plan-card-title">
                            <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" style="color:var(--gaip-info)"><circle cx="12" cy="12" r="10"/><path stroke-linecap="round" d="M9 9h1.5a1.5 1.5 0 010 3H9m0 3h4"/></svg>
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

            </div>{{-- /plan-windows-grid --}}
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
                    <a href="{{ route('settings') }}" style="font-size:11px;color:var(--gaip-text-muted);text-decoration:none" id="plan-rec-settings-link" hidden>
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
                    <button class="plan-btn-secondary" id="plan-nut-csv-btn" style="display:none" title="Export nutrition program as CSV">
                        <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/></svg>
                        Export CSV
                    </button>
                </div>

                <div id="plan-nut-form-wrap">
                    <form class="plan-form" id="plan-nut-form" autocomplete="off">
                        <div class="plan-form-row">
                            <div class="plan-form-group">
                                <label class="plan-form-label" for="plan-nut-annual-n">
                                    Annual N Target
                                    <span class="db-info-icon" data-info="annual-n-target" tabindex="0" role="button">i</span>
                                </label>
                                <input class="plan-form-input" type="number" id="plan-nut-annual-n" min="0" max="600" step="1" placeholder="e.g. 120">
                                <div class="plan-form-hint">kg N/ha/yr · Greens: 80–150 · Tees: 120–180 · Sports: 180–350</div>
                            </div>
                            <div class="plan-form-group">
                                <label class="plan-form-label" for="plan-nut-max-n">
                                    Max N per Application
                                    <span class="db-info-icon" data-info="max-n-app" tabindex="0" role="button">i</span>
                                </label>
                                <input class="plan-form-input" type="number" id="plan-nut-max-n" min="0" max="50" step="0.5" placeholder="e.g. 15">
                                <div class="plan-form-hint">kg N/ha per single application</div>
                            </div>
                        </div>
                        <div class="plan-form-row">
                            <div class="plan-form-group">
                                <label class="plan-form-label" for="plan-nut-distribution">Distribution Method</label>
                                <select class="plan-form-select" id="plan-nut-distribution">
                                    <option value="gp">GP-Weighted (recommended)</option>
                                    <option value="even">Even Distribution</option>
                                    <option value="front">Front-loaded (spring emphasis)</option>
                                </select>
                            </div>
                            <div class="plan-form-group">
                                <label class="plan-form-label" for="plan-nut-clipping">Clipping Management</label>
                                <select class="plan-form-select" id="plan-nut-clipping">
                                    <option value="collected">Collected (removed)</option>
                                    <option value="returned">Returned (mulched)</option>
                                </select>
                            </div>
                        </div>
                        <div>
                            <button type="submit" class="plan-generate-btn" id="plan-nut-generate-btn">
                                Generate Nutrition Program
                            </button>
                        </div>
                    </form>
                </div>

                <hr class="plan-form-divider" id="plan-nut-divider" style="display:none">
                <div id="plan-nut-results" style="display:none"></div>

            </div>{{-- /plan-nut-card --}}

            {{-- Seasonal N Plan --}}
            <div class="plan-card" id="plan-seasonal-card">
                <div class="plan-card-header">
                    <div class="plan-card-title">
                        <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" style="color:var(--gaip-info)"><path stroke-linecap="round" stroke-linejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/></svg>
                        Seasonal N Plan
                        <span class="db-info-icon" data-info="seasonal-n" tabindex="0" role="button" aria-label="About Seasonal N Plan">i</span>
                    </div>
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
<script src="{{ $legacyAssetUrl('dashboard-init.js') }}"></script>
<script src="{{ $legacyAssetUrl('plan-ui.js') }}"></script>
@endsection
