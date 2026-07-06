@php
    $legacyAssetUrl = function (string $asset): string {
        $path = base_path('../assets/'.$asset);
        $version = is_file($path) ? '?v='.filemtime($path) : '';
        return url('/legacy-assets/'.$asset).$version;
    };

    // Age label (e.g. "12d ago")
    $ageLabel = function(?string $dateStr): string {
        if (!$dateStr) return '—';
        $days = (int) now()->diffInDays($dateStr, false) * -1;
        if ($days <= 0)  return 'Today';
        if ($days === 1) return '1d ago';
        return $days . 'd ago';
    };

    // Status label from age
    $statusLabel = function(?string $dateStr): string {
        if (!$dateStr) return '—';
        $days = (int) now()->diffInDays($dateStr, false) * -1;
        if ($days <= 30) return 'Current';
        if ($days <= 60) return 'Aging';
        return 'Outdated';
    };

    // Status CSS class from age
    $statusCls = function(?string $dateStr): string {
        if (!$dateStr) return 'unknown';
        $days = (int) now()->diffInDays($dateStr, false) * -1;
        if ($days <= 30) return 'current';
        if ($days <= 60) return 'aging';
        return 'outdated';
    };

    // Zone CSS class
    $zoneClass = function(?string $zone): string {
        if (!$zone || $zone === '—') return 'zone-default';
        return match(strtolower(substr(trim($zone), 0, 1))) {
            'g' => 'zone-greens',
            'f' => 'zone-fairways',
            't' => 'zone-tees',
            'r' => 'zone-roughs',
            default => 'zone-other',
        };
    };

    // Extract a value from payload trying multiple key variants
    $pVal = function($payload, ...$keys): ?string {
        if (!is_array($payload)) return null;
        foreach ($keys as $key) {
            if (isset($payload[$key]) && $payload[$key] !== '' && $payload[$key] !== null) {
                return (string) $payload[$key];
            }
        }
        return null;
    };

    $sectionTitles = [
        'soil'      => 'Soil Samples',
        'tissue'    => 'Tissue Samples',
        'water'     => 'Water Tests',
        'loi'       => 'LOI / OM Tests',
        'sensors'   => 'Sensor Data',
        'spray-log' => 'Spray Log',
    ];
@endphp
@extends('layouts.db-shell', ['title' => $sectionTitles[$section] ?? 'Data', 'currentPage' => 'data'])

@section('styles')
<link rel="stylesheet" href="{{ $legacyAssetUrl('data-ui.css') }}">
<style>
.dat-area-btn {
    display: inline-flex; align-items: center; gap: 5px;
    padding: 5px 11px; font-size: 12px; font-weight: 500;
    border: 1px solid var(--gaip-border, #d1ddd8); border-radius: var(--gaip-radius-sm, 6px);
    background: var(--gaip-surface, #fff); color: var(--gaip-text, #1a2b23);
    cursor: pointer; transition: background 0.15s;
}
.dat-area-btn:hover:not(:disabled) { background: var(--gaip-surface-muted, #eef2f0); }
.dat-area-btn:disabled { opacity: 0.4; cursor: not-allowed; }
.dat-area-modal-inner { max-width: 600px; }
.dat-area-group { margin-bottom: 24px; }
.dat-area-group-hd {
    display: flex; align-items: center; gap: 12px;
    margin-bottom: 10px; padding-bottom: 8px;
    border-bottom: 1px solid var(--gaip-border, #d1ddd8);
}
.dat-area-group-name { font-weight: 600; font-size: 13px; color: var(--gaip-text, #1a2b23); }
.dat-area-group-count { font-size: 11px; color: var(--gaip-text-secondary, #5a7a6a); }
.dat-area-bulk {
    display: flex; align-items: center; gap: 6px;
    margin-left: auto; font-size: 12px; color: var(--gaip-text-secondary, #5a7a6a);
}
.dat-area-bulk-input {
    width: 72px; padding: 3px 7px; font-size: 12px;
    border: 1px solid var(--gaip-border, #d1ddd8); border-radius: 4px;
    background: var(--gaip-surface, #fff); color: var(--gaip-text, #1a2b23);
    font-family: inherit;
}
.dat-area-bulk-input:focus { outline: none; border-color: var(--gaip-accent, #2d9b5a); }
.dat-area-bulk-hint { font-size: 11px; color: var(--gaip-text-muted, #8aaa98); white-space: nowrap; }
.dat-area-col-hd {
    display: flex; align-items: center; gap: 10px;
    padding: 4px 0 6px; margin-bottom: 2px;
    font-size: 11px; font-weight: 600; text-transform: uppercase;
    letter-spacing: 0.04em; color: var(--gaip-text-muted, #8aaa98);
}
.dat-area-override-label { width: 72px; }
.dat-area-row {
    display: flex; align-items: center; gap: 10px;
    padding: 6px 0; border-bottom: 1px solid var(--gaip-surface-muted, #eef2f0);
    font-size: 12px;
}
.dat-area-row:last-child { border-bottom: none; }
.dat-area-row-name { flex: 1; min-width: 0; color: var(--gaip-text, #1a2b23); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.dat-area-row-current { width: 70px; text-align: right; margin-right: 16px; color: var(--gaip-text-secondary, #5a7a6a); font-size: 11px; }
.dat-area-row-input {
    width: 72px; padding: 3px 7px; font-size: 12px;
    border: 1px solid var(--gaip-border, #d1ddd8); border-radius: 4px;
    background: var(--gaip-surface, #fff); color: var(--gaip-text, #1a2b23);
    font-family: inherit;
}
.dat-area-row-input:focus { outline: none; border-color: var(--gaip-accent, #2d9b5a); }
.dat-area-row-unit { width: 20px; flex-shrink: 0; color: var(--gaip-text-muted, #8aaa98); font-size: 11px; }
.dat-td-area { color: var(--gaip-text-secondary, #5a7a6a); }
.dat-td-source {
    max-width: 140px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
    font-size: 11px; color: var(--gaip-text-secondary, #5a7a6a);
}
.dat-area-intro {
    padding: 10px 14px; margin-bottom: 8px;
    background: var(--gaip-surface-muted, #f4f7f5); border-radius: 6px;
    font-size: 12px; line-height: 1.5; color: var(--gaip-text-secondary, #5a7a6a);
}
.dat-area-intro strong { color: var(--gaip-text, #1a2b23); }
.dat-area-badge {
    display: inline-block; font-size: 10px; font-weight: 600; padding: 1px 5px;
    border-radius: 3px; margin-left: 4px; text-transform: uppercase; letter-spacing: 0.03em;
    vertical-align: middle;
}
.dat-area-badge-set { background: #d4edda; color: #1a6630; }
.dat-area-badge-missing { background: #fce8e6; color: #a33; }
.dat-area-row-check { width: 16px; height: 16px; cursor: pointer; flex-shrink: 0; accent-color: var(--gaip-accent, #2d6a4f); }
.dat-area-row.skipped { opacity: 0.4; }
.dat-area-col-hd-check { width: 16px; height: 16px; flex-shrink: 0; }
.dat-area-col-hd-unit { width: 20px; flex-shrink: 0; }
</style>
@endsection

@section('content')

        {{-- DATA SUB-NAVIGATION --}}
        @php
            $tabs = [
                [
                    'key'   => 'soil',
                    'label' => 'Soil',
                    'icon'  => '<path stroke-linecap="round" stroke-linejoin="round" d="M3 7c0-1.1 4.03-2 9-2s9 .9 9 2v10c0 1.1-4.03 2-9 2s-9-.9-9-2V7z"/><path stroke-linecap="round" d="M3 12c0 1.1 4.03 2 9 2s9-.9 9-2"/>',
                ],
                [
                    'key'   => 'water',
                    'label' => 'Water',
                    'icon'  => '<path stroke-linecap="round" stroke-linejoin="round" d="M12 2C12 2 5 10 5 14a7 7 0 0014 0c0-4-7-12-7-12z"/>',
                ],
                [
                    'key'   => 'tissue',
                    'label' => 'Tissue',
                    'icon'  => '<path stroke-linecap="round" stroke-linejoin="round" d="M12 2C8 6 5 10 5 14a7 7 0 0014 0c0-4-3-8-7-12z"/><path stroke-linecap="round" d="M12 14v6"/>',
                ],
                [
                    'key'   => 'loi',
                    'label' => 'LOI / OM',
                    'icon'  => '<path stroke-linecap="round" stroke-linejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2"/><rect x="9" y="3" width="6" height="4" rx="1"/><path stroke-linecap="round" d="M9 12h6M9 16h4"/>',
                ],
                [
                    'key'   => 'sensors',
                    'label' => 'Sensors',
                    'icon'  => '<path stroke-linecap="round" d="M1.42 9a16 16 0 0 1 21.16 0"/><path stroke-linecap="round" d="M5 12.55a11 11 0 0 1 14.08 0"/><path stroke-linecap="round" d="M8.53 16.11a6 6 0 0 1 6.95 0"/><circle cx="12" cy="20" r="1.5" fill="currentColor" stroke="none"/>',
                ],
                [
                    'key'   => 'spray-log',
                    'label' => 'Spray Log',
                    'icon'  => '<path stroke-linecap="round" stroke-linejoin="round" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z"/>',
                ],
            ];
        @endphp
        <nav class="dat-subnav">
            @foreach($tabs as $tab)
            @php
                $isActive  = $tab['key'] === $section;
                $dateStr   = $tabDates[$tab['key']] ?? null;
                $dateLabel = $tab['key'] === 'sensors' ? null : ($dateStr ? $ageLabel($dateStr) : null);
                $isWarn    = $dateStr ? ((int) now()->diffInDays($dateStr, false) * -1 > 30) : false;
            @endphp
            <a href="{{ route('data.section', $tab['key']) }}" class="dat-tab{{ $isActive ? ' active' : '' }}">
                <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">{!! $tab['icon'] !!}</svg>
                <span>{{ $tab['label'] }}</span>
                @if($tab['key'] === 'sensors')
                    <span class="dat-tab-date live">Live</span>
                @elseif($dateLabel)
                    <span class="dat-tab-date{{ $isWarn ? ' warn' : '' }}">{{ $dateLabel }}</span>
                @endif
            </a>
            @endforeach
        </nav>

        {{-- PAGE BODY --}}
        <div class="dat-body">

            {{-- TABLE HEADER --}}
            <div class="dat-table-head">
                <div class="dat-table-title">
                    <span class="dat-section-name">{{ $sectionTitles[$section] }}</span>
                    @if($section === 'spray-log')
                        <span class="dat-section-sub">Fungicides · PGR · Wetting Agents · Pre-emergent · Insecticides</span>
                    @elseif($total > 0)
                        <span class="dat-count">{{ $total }} {{ $total === 1 ? 'record' : 'records' }}</span>
                    @endif
                </div>
                <div class="dat-table-actions">
                    @if($section === 'soil')
                    <button class="dat-area-btn" id="dat-area-btn" @if(!$total) disabled @endif>
                        <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                            <path stroke-linecap="round" stroke-linejoin="round" d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5v-4m0 4h-4m4 0l-5-5"/>
                        </svg>
                        Set Area
                    </button>
                    @endif
                    @if(!in_array($section, ['sensors', 'spray-log']))
                    <button class="dat-compare-btn" id="dat-compare-btn" disabled>
                        <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                            <path stroke-linecap="round" stroke-linejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"/>
                        </svg>
                        Compare
                    </button>
                    @endif
                    @if($section !== 'sensors')
                    <button class="dat-delete-bulk-btn" id="dat-delete-bulk-btn" disabled>
                        <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                            <path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
                        </svg>
                        Delete
                    </button>
                    @endif
                    @if($section !== 'sensors')
                    <button type="button" class="dat-add-btn" id="dat-add-btn"
                        @if(!$activeSite) disabled title="No active site selected" @endif>
                        <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
                            <path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4"/>
                        </svg>
                        Add Data
                    </button>
                    @endif
                </div>
            </div>

            {{-- ── SENSORS ── --}}
            @if($section === 'sensors')
            <div class="sens-wrap" id="sens-wrap">

                {{-- Provider status bar --}}
                <div class="sens-provider-status" id="sens-provider-status">
                    <div class="sens-pstatus-item">
                        <span class="sens-pstatus-dot" id="dat-hs-dot"></span>
                        <span class="sens-pstatus-name">Hydrosight</span>
                        <span class="sens-pstatus-val" id="dat-hs-status">Not configured</span>
                    </div>
                    <div class="sens-pstatus-sep"></div>
                    <div class="sens-pstatus-item">
                        <span class="sens-pstatus-dot" id="dat-sc-dot"></span>
                        <span class="sens-pstatus-name">SpecConnect</span>
                        <span class="sens-pstatus-val" id="dat-sc-status">Not configured</span>
                    </div>
                    <div class="sens-pstatus-sep"></div>
                    <div class="sens-pstatus-item">
                        <span class="sens-pstatus-dot" id="dat-tdr-dot"></span>
                        <span class="sens-pstatus-name">FieldScout</span>
                        <span class="sens-pstatus-val" id="dat-tdr-status">No import</span>
                    </div>
                    <a class="sens-pstatus-link" href="{{ route('settings') }}#integrations">Manage in Settings</a>
                </div>

                {{-- Empty state: no providers configured --}}
                <div class="sens-no-integration" id="sens-no-integration" style="display:none">
                    <svg width="36" height="36" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="color:var(--gaip-border,#ccd9d2)">
                        <path d="M1.42 9a16 16 0 0 1 21.16 0"/>
                        <path d="M5 12.55a11 11 0 0 1 14.08 0"/>
                        <path d="M8.53 16.11a6 6 0 0 1 6.95 0"/>
                        <circle cx="12" cy="20" r="1.5" fill="currentColor" stroke="none"/>
                    </svg>
                    <div class="sens-no-integration-title">No sensor integrations configured</div>
                    <div class="sens-no-integration-sub">Connect your sensor provider in <a href="{{ route('settings') }}#integrations">Settings → Integrations</a> to enable live readings.</div>
                </div>

                {{-- Live readings --}}
                <div class="sens-readings-section" id="sens-readings" style="display:none">
                    <div class="sens-readings-head">
                        <div>
                            <span class="sens-readings-title">Real-time Data</span>
                            <span class="sens-last-updated" id="sens-last-updated"></span>
                        </div>
                        <button class="sens-refresh-btn" id="sens-refresh-btn" type="button">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="display:inline;vertical-align:-1px;margin-right:4px"><path d="M23 4v6h-6"/><path d="M1 20v-6h6"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>
                            Refresh
                        </button>
                    </div>
                    <div class="sens-zone-grid" id="sens-zone-grid">
                        <div class="sens-no-readings">No readings cached yet — click Refresh to fetch live data.</div>
                    </div>
                </div>

                {{-- FieldScout sensor data import --}}
                <div class="sens-tdr-section" id="sens-tdr-section">
                    <div class="sens-readings-head">
                        <div>
                            <span class="sens-readings-title">Manual Import</span>
                            <span class="sens-last-updated" id="tdr-last-updated"></span>
                        </div>
                        <div style="display:flex;gap:8px;align-items:center">
                            <button type="button" class="sens-refresh-btn" id="tdr-clear-btn" style="display:none;color:#c0392b;border-color:#f5c6c6">Clear</button>
                            <label class="sens-refresh-btn" for="tdr-file-input" style="cursor:pointer">Upload CSV</label>
                            <input type="file" id="tdr-file-input" accept=".csv" style="display:none">
                        </div>
                    </div>
                    <div id="tdr-drop-zone" class="tdr-drop-zone">
                        <svg width="26" height="26" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="color:var(--gaip-border,#ccd9d2)">
                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                            <polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
                        </svg>
                        <div class="tdr-drop-title">Drop CSV here or click Upload CSV</div>
                        <div class="tdr-drop-hint">Supports FieldScout TDR 350/300 exports and compatible formats</div>
                    </div>
                    <div id="tdr-results" style="display:none">
                        <div id="tdr-device-header" class="tdr-device-header"></div>
                        <div class="dat-table-wrap" style="margin:0">
                            <table class="dat-table" id="tdr-zone-table" style="table-layout:fixed">
                                <colgroup>
                                    <col style="width:35%">
                                    <col style="width:90px">
                                    <col style="width:110px">
                                    <col style="width:90px">
                                    <col style="width:120px">
                                    <col style="width:110px">
                                </colgroup>
                                <thead><tr>
                                    <th>Zone</th>
                                    <th class="dat-th-num">VWC %</th>
                                    <th class="dat-th-num">EC</th>
                                    <th class="dat-th-num">Soil °C</th>
                                    <th>Status <span class="db-info-icon" data-info="tdr-status" tabindex="0" role="button" aria-label="About Status">i</span></th>
                                    <th class="dat-th-num">Required <span class="db-info-icon" data-info="tdr-required" tabindex="0" role="button" aria-label="About Required">i</span></th>
                                </tr></thead>
                                <tbody id="tdr-zone-tbody"></tbody>
                            </table>
                        </div>
                    </div>
                </div>

            </div>{{-- /sens-wrap --}}

            {{-- ── EMPTY STATE ── --}}
            @elseif($rows->isEmpty())
            @php
                $emptyHints = [
                    'soil'      => 'Upload a soil test report — click <strong>+ Add Data</strong> above and select your lab file (CSV, Excel or PDF).',
                    'tissue'    => 'Upload a tissue test report — click <strong>+ Add Data</strong> above and select your lab file.',
                    'water'     => 'Upload a water test report — click <strong>+ Add Data</strong> above and select your lab file.',
                    'loi'       => 'Upload an LOI / organic matter test — click <strong>+ Add Data</strong> above and select your lab file.',
                    'spray-log' => 'Log your first spray application — click <strong>+ Add Data</strong> above and fill in the product, rate and zone.',
                ];
            @endphp
            <div class="dat-empty-state">
                <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"
                     stroke-linecap="round" stroke-linejoin="round" style="color:var(--gaip-border,#ccd9d2)">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                    <polyline points="14 2 14 8 20 8"/>
                    <line x1="12" y1="18" x2="12" y2="12"/><line x1="9" y1="15" x2="15" y2="15"/>
                </svg>
                <div class="dat-empty-title">No {{ strtolower($sectionTitles[$section]) }} yet</div>
                <div class="dat-empty-sub">{!! $emptyHints[$section] ?? 'Click <strong>+ Add Data</strong> above to get started.' !!}</div>
            </div>

            @else

            {{-- ── SOIL TABLE ── --}}
            @if($section === 'soil')
            <div class="dat-table-wrap">
                <table class="dat-table" id="dat-table">
                    <thead><tr>
                        <th class="dat-th-check"><input type="checkbox" id="dat-check-all" aria-label="Select all"></th>
                        <th>Zone name</th>
                        <th>Zone type</th>
                        <th>File</th>
                        <th>Date Collected</th>
                        <th>Status</th>
                        <th class="dat-th-num">pH</th>
                        <th class="dat-th-num">K (ppm)</th>
                        <th class="dat-th-num">P (ppm)</th>
                        <th class="dat-th-num">Area (ha)</th>
                        <th>Actions</th>
                    </tr></thead>
                    <tbody>
                    @foreach($rows as $row)
                    @php
                        $pl     = $row->payload ?? [];
                        $zone   = $pVal($pl, 'zone', 'Zone') ?? '—';
                        $name   = $pVal($pl, '_label') ?: $row->client_uid ?: $row->lab_ref ?: '—';
                        $source = $pVal($pl, '_source');
                        $labId  = $row->lab_ref ?: null;
                        $date   = $row->lab_date?->toDateString() ?? $row->sample_date?->toDateString();
                        $ph     = $pVal($pl, 'pH', 'ph', 'PH');
                        $k      = $pVal($pl, 'K', 'k', 'potassium', 'Potassium');
                        $p      = $pVal($pl, 'P', 'p', 'phosphorus', 'Phosphorus');
                        $rowData = ['id'=>$row->id,'section'=>'soil','name'=>$name,'source'=>$source,'client_uid'=>$row->client_uid,'lab_name'=>$row->lab_name,'lab_ref'=>$row->lab_ref,'labId'=>$labId,'zone'=>$zone,'date'=>$date,'payload'=>$pl,'notes'=>$row->notes];
                    @endphp
                    <tr class="dat-row" data-id="{{ $row->id }}" data-section="soil"
                        data-row="{{ json_encode($rowData) }}">
                        <td class="dat-td-check"><input type="checkbox" class="dat-row-check" data-id="{{ $row->id }}"></td>
                        <td>
                            <div class="dat-sample-name">{{ $name }}</div>
                            @if($labId)<div class="dat-lab-id">Lab ID: {{ $labId }}</div>@endif
                        </td>
                        <td><span class="dat-zone-tag {{ $zoneClass($zone) }}">{{ $zone }}</span></td>
                        <td class="dat-td-source">{{ $source ?? '—' }}</td>
                        <td>
                            <div>{{ $date ? date('M j, Y', strtotime($date)) : '—' }}</div>
                            @if($date)<div class="dat-date-age">{{ $ageLabel($date) }}</div>@endif
                        </td>
                        <td><span class="dat-status dat-status-{{ $statusCls($date) }}">{{ $statusLabel($date) }}</span></td>
                        <td class="dat-td-num">{{ $ph ?? '—' }}</td>
                        <td class="dat-td-num">{{ $k ?? '—' }}</td>
                        <td class="dat-td-num">{{ $p ?? '—' }}</td>
                        <td class="dat-td-num dat-td-area">{{ isset($pl['areaHa']) && $pl['areaHa'] > 0 ? number_format((float)$pl['areaHa'], 2) : '—' }}</td>
                        <td class="dat-td-actions">
                            <button class="dat-view-btn" type="button">View Details</button>
                            <button class="dat-edit-row-btn" type="button">Edit</button>
                            <button class="dat-del-row-btn" type="button" data-id="{{ $row->id }}" data-section="soil">Delete</button>
                        </td>
                    </tr>
                    @endforeach
                    </tbody>
                </table>
            </div>

            {{-- ── TISSUE TABLE ── --}}
            @elseif($section === 'tissue')
            <div class="dat-table-wrap">
                <table class="dat-table" id="dat-table">
                    <thead><tr>
                        <th class="dat-th-check"><input type="checkbox" id="dat-check-all" aria-label="Select all"></th>
                        <th>Zone name</th>
                        <th>Zone type</th>
                        <th>File</th>
                        <th>Date Collected</th>
                        <th>Status</th>
                        <th class="dat-th-num">N (%)</th>
                        <th class="dat-th-num">K (%)</th>
                        <th class="dat-th-num">P (%)</th>
                        <th>Actions</th>
                    </tr></thead>
                    <tbody>
                    @foreach($rows as $row)
                    @php
                        $pl     = $row->payload ?? [];
                        $zone   = $pVal($pl, 'zone', 'Zone') ?? '—';
                        $name   = $pVal($pl, '_label') ?: $row->client_uid ?: $row->lab_ref ?: '—';
                        $source = $pVal($pl, '_source');
                        $labId  = $row->lab_ref ?: null;
                        $date   = $row->lab_date?->toDateString() ?? $row->sample_date?->toDateString();
                        $n      = $pVal($pl, 'N', 'n', 'nitrogen', 'Nitrogen', 'N_total');
                        $k      = $pVal($pl, 'K', 'k', 'potassium', 'Potassium');
                        $p      = $pVal($pl, 'P', 'p', 'phosphorus', 'Phosphorus');
                        $rowData = ['id'=>$row->id,'section'=>'tissue','name'=>$name,'source'=>$source,'client_uid'=>$row->client_uid,'lab_name'=>$row->lab_name,'lab_ref'=>$row->lab_ref,'labId'=>$labId,'zone'=>$zone,'date'=>$date,'payload'=>$pl,'notes'=>$row->notes];
                    @endphp
                    <tr class="dat-row" data-id="{{ $row->id }}" data-section="tissue"
                        data-row="{{ json_encode($rowData) }}">
                        <td class="dat-td-check"><input type="checkbox" class="dat-row-check" data-id="{{ $row->id }}"></td>
                        <td>
                            <div class="dat-sample-name">{{ $name }}</div>
                            @if($labId)<div class="dat-lab-id">Lab ID: {{ $labId }}</div>@endif
                        </td>
                        <td><span class="dat-zone-tag {{ $zoneClass($zone) }}">{{ $zone }}</span></td>
                        <td class="dat-td-source">{{ $source ?? '—' }}</td>
                        <td>
                            <div>{{ $date ? date('M j, Y', strtotime($date)) : '—' }}</div>
                            @if($date)<div class="dat-date-age">{{ $ageLabel($date) }}</div>@endif
                        </td>
                        <td><span class="dat-status dat-status-{{ $statusCls($date) }}">{{ $statusLabel($date) }}</span></td>
                        <td class="dat-td-num">{{ $n ?? '—' }}</td>
                        <td class="dat-td-num">{{ $k ?? '—' }}</td>
                        <td class="dat-td-num">{{ $p ?? '—' }}</td>
                        <td class="dat-td-actions">
                            <button class="dat-view-btn" type="button">View Details</button>
                            <button class="dat-edit-row-btn" type="button">Edit</button>
                            <button class="dat-del-row-btn" type="button" data-id="{{ $row->id }}" data-section="tissue">Delete</button>
                        </td>
                    </tr>
                    @endforeach
                    </tbody>
                </table>
            </div>

            {{-- ── WATER TABLE ── --}}
            @elseif($section === 'water')
            <div class="dat-table-wrap">
                <table class="dat-table" id="dat-table">
                    <thead><tr>
                        <th class="dat-th-check"><input type="checkbox" id="dat-check-all" aria-label="Select all"></th>
                        <th>Name</th>
                        <th>File</th>
                        <th>Date Collected</th>
                        <th>Status</th>
                        <th class="dat-th-num">pH</th>
                        <th class="dat-th-num">EC (dS/m)</th>
                        <th class="dat-th-num">HCO3 (ppm)</th>
                        <th>Actions</th>
                    </tr></thead>
                    <tbody>
                    @foreach($rows as $row)
                    @php
                        $pl     = $row->payload ?? [];
                        $name   = $pVal($pl, '_label') ?: $row->client_uid ?: $row->lab_ref ?: '—';
                        $source = $pVal($pl, '_source');
                        $labId  = $row->lab_ref ?: null;
                        $date   = $row->lab_date?->toDateString() ?? $row->sample_date?->toDateString();
                        $ph     = $pVal($pl, 'pH', 'ph', 'PH');
                        $ec     = $pVal($pl, 'EC', 'ec', 'EC_dSm', 'Salinity', 'salinity');
                        $hco3   = $pVal($pl, 'HCO3', 'hco3', 'bicarbonate', 'Bicarbonate');
                        $rowData = ['id'=>$row->id,'section'=>'water','name'=>$name,'source'=>$source,'client_uid'=>$row->client_uid,'lab_name'=>$row->lab_name,'lab_ref'=>$row->lab_ref,'labId'=>$labId,'zone'=>null,'date'=>$date,'payload'=>$pl,'notes'=>$row->notes];
                    @endphp
                    <tr class="dat-row" data-id="{{ $row->id }}" data-section="water"
                        data-row="{{ json_encode($rowData) }}">
                        <td class="dat-td-check"><input type="checkbox" class="dat-row-check" data-id="{{ $row->id }}"></td>
                        <td>
                            <div class="dat-sample-name">{{ $name }}</div>
                            @if($labId)<div class="dat-lab-id">Lab ID: {{ $labId }}</div>@endif
                        </td>
                        <td class="dat-td-source">{{ $source ?? '—' }}</td>
                        <td>
                            <div>{{ $date ? date('M j, Y', strtotime($date)) : '—' }}</div>
                            @if($date)<div class="dat-date-age">{{ $ageLabel($date) }}</div>@endif
                        </td>
                        <td><span class="dat-status dat-status-{{ $statusCls($date) }}">{{ $statusLabel($date) }}</span></td>
                        <td class="dat-td-num">{{ $ph ?? '—' }}</td>
                        <td class="dat-td-num">{{ $ec ?? '—' }}</td>
                        <td class="dat-td-num">{{ $hco3 ?? '—' }}</td>
                        <td class="dat-td-actions">
                            <button class="dat-view-btn" type="button">View Details</button>
                            <button class="dat-edit-row-btn" type="button">Edit</button>
                            <button class="dat-del-row-btn" type="button" data-id="{{ $row->id }}" data-section="water">Delete</button>
                        </td>
                    </tr>
                    @endforeach
                    </tbody>
                </table>
            </div>

            {{-- ── LOI TABLE ── --}}
            @elseif($section === 'loi')
            <div class="dat-table-wrap">
                <table class="dat-table" id="dat-table">
                    <thead><tr>
                        <th class="dat-th-check"><input type="checkbox" id="dat-check-all" aria-label="Select all"></th>
                        <th>Zone name</th>
                        <th>Zone type</th>
                        <th>File</th>
                        <th>Date Collected</th>
                        <th>Status</th>
                        <th class="dat-th-num">OM (%)</th>
                        <th class="dat-th-num">Thatch (%)</th>
                        <th>Actions</th>
                    </tr></thead>
                    <tbody>
                    @foreach($rows as $row)
                    @php
                        $pl     = $row->payload ?? [];
                        $zone   = $pVal($pl, 'zone', 'Zone') ?? '—';
                        $name   = $pVal($pl, '_label') ?: $row->client_uid ?: $row->lab_ref ?: '—';
                        $source = $pVal($pl, '_source');
                        $labId  = $row->lab_ref ?: null;
                        $date   = $row->lab_date?->toDateString() ?? $row->sample_date?->toDateString();
                        $om     = $pVal($pl, 'OM', 'om', 'organic_matter', 'OrganicMatter', 'LOI');
                        $thatch = $pVal($pl, 'thatch', 'Thatch', 'THATCH');
                        $rowData = ['id'=>$row->id,'section'=>'loi','name'=>$name,'source'=>$source,'client_uid'=>$row->client_uid,'lab_name'=>$row->lab_name,'lab_ref'=>$row->lab_ref,'labId'=>$labId,'zone'=>$zone,'date'=>$date,'payload'=>$pl,'notes'=>$row->notes];
                    @endphp
                    <tr class="dat-row" data-id="{{ $row->id }}" data-section="loi"
                        data-row="{{ json_encode($rowData) }}">
                        <td class="dat-td-check"><input type="checkbox" class="dat-row-check" data-id="{{ $row->id }}"></td>
                        <td>
                            <div class="dat-sample-name">{{ $name }}</div>
                            @if($labId)<div class="dat-lab-id">Lab ID: {{ $labId }}</div>@endif
                        </td>
                        <td><span class="dat-zone-tag {{ $zoneClass($zone) }}">{{ $zone }}</span></td>
                        <td class="dat-td-source">{{ $source ?? '—' }}</td>
                        <td>
                            <div>{{ $date ? date('M j, Y', strtotime($date)) : '—' }}</div>
                            @if($date)<div class="dat-date-age">{{ $ageLabel($date) }}</div>@endif
                        </td>
                        <td><span class="dat-status dat-status-{{ $statusCls($date) }}">{{ $statusLabel($date) }}</span></td>
                        <td class="dat-td-num">{{ $om ?? '—' }}</td>
                        <td class="dat-td-num">{{ $thatch ?? '—' }}</td>
                        <td class="dat-td-actions">
                            <button class="dat-view-btn" type="button">View Details</button>
                            <button class="dat-edit-row-btn" type="button">Edit</button>
                            <button class="dat-del-row-btn" type="button" data-id="{{ $row->id }}" data-section="loi">Delete</button>
                        </td>
                    </tr>
                    @endforeach
                    </tbody>
                </table>
            </div>

            {{-- ── SPRAY LOG TABLE ── --}}
            @elseif($section === 'spray-log')
            <div class="dat-table-wrap">
                <table class="dat-table" id="dat-table">
                    <thead><tr>
                        <th>Date</th>
                        <th>Zone type</th>
                        <th>Product</th>
                        <th>Category</th>
                        <th class="dat-th-num">Rate</th>
                        <th>Target</th>
                        <th>Actions</th>
                    </tr></thead>
                    <tbody>
                    @foreach($rows as $row)
                    @php
                        $date = $row->event_date ?? null;
                        $zone = $row->zone ? ucfirst($row->zone) : '—';
                        $catCls = match(strtolower($row->product_type ?? '')) {
                            'fungicide'            => 'cat-fungicide',
                            'pgr'                  => 'cat-pgr',
                            'fertiliser','fertilizer' => 'cat-fertiliser',
                            'herbicide'            => 'cat-herbicide',
                            default                => 'cat-other',
                        };
                        $rowData = [
                            'id' => $row->id, 'section' => 'spray-log',
                            'date' => $date, 'zone' => $zone,
                            'product' => $row->product_name ?? '—',
                            'category' => $row->product_type ?? '—',
                            'active_ingredient' => $row->active_ingredient ?? null,
                            'rate' => $row->rate_value ?? null,
                            'rate_unit' => $row->rate_unit ?? null,
                            'target' => $row->target ?? null,
                            'notes' => $row->notes ?? null,
                            'source' => $row->source ?? 'manual',
                        ];
                    @endphp
                    <tr class="dat-row" data-id="{{ $row->id }}" data-section="spray-log"
                        data-row="{{ json_encode($rowData) }}">
                        <td>
                            <div>{{ $date ? date('M j, Y', strtotime($date)) : '—' }}</div>
                            @if($date)<div class="dat-date-age">{{ $ageLabel($date) }}</div>@endif
                        </td>
                        <td><span class="dat-zone-tag {{ $zoneClass($zone) }}">{{ $zone }}</span></td>
                        <td>
                            <div class="dat-sample-name">{{ $row->product_name ?? '—' }}</div>
                            @if(!empty($row->active_ingredient))<div class="dat-lab-id">{{ $row->active_ingredient }}</div>@endif
                        </td>
                        <td><span class="dat-cat-tag {{ $catCls }}">{{ ucfirst($row->product_type ?? 'other') }}</span></td>
                        <td class="dat-td-num">
                            @if(!is_null($row->rate_value))
                                {{ $row->rate_value }}{{ $row->rate_unit ? ' '.$row->rate_unit : '' }}
                            @else —
                            @endif
                        </td>
                        <td style="color:var(--gaip-text-muted,#6b8878);font-size:12px">{{ $row->target ?? '—' }}</td>
                        <td class="dat-td-actions">
                            <button class="dat-view-btn" type="button">View Details</button>
                            <button class="dat-edit-row-btn" type="button">Edit</button>
                            <button class="dat-del-row-btn" type="button" data-id="{{ $row->id }}" data-section="spray-log">Delete</button>
                        </td>
                    </tr>
                    @endforeach
                    </tbody>
                </table>
            </div>
            @endif

            {{-- DETAIL PANEL --}}
            <div id="dat-detail" class="dat-detail" style="display:none" aria-live="polite">
                <div class="dat-detail-header">
                    <div>
                        <div class="dat-detail-title" id="dat-detail-title">—</div>
                        <div class="dat-detail-subtitle" id="dat-detail-subtitle"></div>
                    </div>
                    <div class="dat-detail-actions">
                        <button class="dat-detail-edit" id="dat-detail-edit" type="button">
                            <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M15.232 5.232l3.536 3.536M9 13l6.5-6.5a2.121 2.121 0 013 3L12 16H9v-3z"/></svg>
                            Edit
                        </button>
                        <button class="dat-detail-close" id="dat-detail-close" aria-label="Close detail panel">×</button>
                    </div>
                </div>
                <div id="dat-detail-body" class="dat-detail-body"></div>
            </div>

            @endif {{-- /rows or sensors --}}

        </div>{{-- /dat-body --}}

        {{-- SET AREA MODAL --}}
        @if($section === 'soil')
        <div id="dat-area-modal" class="dat-modal-overlay" style="display:none" aria-modal="true" role="dialog">
            <div class="dat-modal dat-area-modal-inner">
                <div class="dat-modal-hd">
                    <div class="dat-modal-title">Set area (ha) per sample</div>
                    <button class="dat-modal-x" id="dat-area-modal-close" aria-label="Close">×</button>
                </div>
                <div class="dat-modal-bd" id="dat-area-modal-body"></div>
                <div class="dat-modal-ft">
                    <span class="dat-modal-msg" id="dat-area-modal-msg"></span>
                    <button type="button" class="dat-modal-cancel" id="dat-area-modal-cancel">Cancel</button>
                    <button type="button" class="dat-modal-save" id="dat-area-modal-apply">Apply</button>
                </div>
            </div>
        </div>
        @endif

        {{-- ADD DATA MODAL --}}
        @if($section !== 'sensors')
        <div id="dat-add-modal" class="dat-modal-overlay" style="display:none" aria-modal="true" role="dialog">
            <div class="dat-modal">
                <div class="dat-modal-hd">
                    <div class="dat-modal-title" id="dat-modal-title">Add {{ $sectionTitles[$section] ?? 'Data' }}</div>
                    <button class="dat-modal-x" id="dat-modal-close" aria-label="Close">×</button>
                </div>
                <div id="dat-modal-body" class="dat-modal-bd">
                    {{-- Filled by JS --}}
                </div>
                <div class="dat-modal-ft">
                    <span class="dat-modal-msg" id="dat-modal-msg"></span>
                    <button type="button" class="dat-modal-cancel" id="dat-modal-cancel">Cancel</button>
                    <button type="button" class="dat-modal-save" id="dat-modal-save">Save</button>
                </div>
            </div>
        </div>
        @endif

@endsection

@section('scripts')
{{-- Fungicide databases for spray log product dropdown --}}
@if($section === 'spray-log')
<script src="{{ $legacyAssetUrl('au-fungicides.js') }}"></script>
<script src="{{ $legacyAssetUrl('nz-fungicides.js') }}"></script>
<script src="{{ $legacyAssetUrl('uk-fungicides.js') }}"></script>
@endif
{{-- Data table interaction --}}
<script>
(function () {
    'use strict';

    var table    = document.getElementById('dat-table');
    var detail   = document.getElementById('dat-detail');
    var detTitle = document.getElementById('dat-detail-title');
    var detSub   = document.getElementById('dat-detail-subtitle');
    var detBody  = document.getElementById('dat-detail-body');
    var detClose = document.getElementById('dat-detail-close');
    var currentId = null;
    var currentDetailData = null;

    // ── Row click / view-btn click ────────────────────────────────────────
    function openDetail(row) {
        var data;
        try { data = JSON.parse(row.dataset.row); } catch (e) { return; }
        if (!data) return;

        var parts = [];
        if (data.name) parts.push(data.name);
        if (data.zone && data.zone !== '—') parts.push(data.zone);
        if (data.date) parts.push(fmtDate(data.date));
        if (detTitle) detTitle.textContent = parts.join(' · ');
        if (detSub) detSub.textContent = (data.labId && data.labId !== data.name) ? 'Lab ID: ' + data.labId : '';

        if (detBody) detBody.innerHTML = buildDetail(data.section, data);

        if (detail) { detail.style.display = ''; detail.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); }
        if (table) table.querySelectorAll('.dat-row.selected').forEach(function (r) { r.classList.remove('selected'); });
        row.classList.add('selected');
        currentId = String(data.id);
        currentDetailData = data;
    }

    function closeDetail() {
        if (detail) detail.style.display = 'none';
        if (table) table.querySelectorAll('.dat-row.selected').forEach(function (r) { r.classList.remove('selected'); });
        currentId = null;
        currentDetailData = null;
    }

    if (table) {
        table.addEventListener('click', function (e) {
            if (e.target.matches('input[type="checkbox"]')) return;
            if (e.target.closest('.dat-del-row-btn')) return;
            if (e.target.closest('.dat-edit-row-btn')) {
                var editRow = e.target.closest('.dat-row');
                if (editRow && typeof window.datOpenEditModal === 'function') {
                    var editData;
                    try { editData = JSON.parse(editRow.dataset.row); } catch (_) {}
                    if (editData) window.datOpenEditModal(editData);
                }
                return;
            }
            var btn = e.target.closest('.dat-view-btn');
            var row = e.target.closest('.dat-row');
            if (!row) return;
            if (String(row.dataset.id) === currentId && !btn) { closeDetail(); return; }
            openDetail(row);
        });
    }
    if (detClose) detClose.addEventListener('click', closeDetail);

    var detEditBtn = document.getElementById('dat-detail-edit');
    if (detEditBtn) {
        detEditBtn.addEventListener('click', function () {
            if (currentDetailData && typeof window.datOpenEditModal === 'function') {
                window.datOpenEditModal(currentDetailData);
            }
        });
    }
    document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape' && detail && detail.style.display !== 'none') closeDetail();
    });

    // ── Detail body builders ──────────────────────────────────────────────
    function buildDetail(section, data) {
        var p = data.payload || {};
        switch (section) {
            case 'soil':      return buildSoil(p, data);
            case 'tissue':    return buildTissue(p, data);
            case 'water':     return buildWater(p, data);
            case 'loi':       return buildLoi(p, data);
            case 'spray-log': return buildSpray(data);
            default: return '<p style="color:var(--gaip-text-muted)">No detail available.</p>';
        }
    }

    // Field sets with threshold ranges
    var SOIL_KEY = [
        { keys:['pH','ph','PH'],                            name:'pH',              unit:'',       opt:[6.0,7.0],  max:9 },
        { keys:['P','p','phosphorus','Phosphorus'],          name:'Phosphorus (P)',  unit:'ppm',    opt:[50,200],   max:300 },
        { keys:['K','k','potassium','Potassium'],            name:'Potassium (K)',   unit:'ppm',    opt:[120,300],  max:400 },
        { keys:['OM','om','organic_matter','OrganicMatter'], name:'Organic Matter',  unit:'%',      opt:[3,6],      max:10 },
    ];
    var SOIL_FULL = [
        { keys:['N','n','nitrogen','Nitrogen'],        name:'Nitrogen (N)',        unit:'ppm' },
        { keys:['Ca','ca','calcium','Calcium'],        name:'Calcium (Ca)',        unit:'ppm' },
        { keys:['Mg','mg','magnesium','Magnesium'],    name:'Magnesium (Mg)',      unit:'ppm' },
        { keys:['S','s','sulfur','Sulfur'],            name:'Sulfur (S)',          unit:'ppm' },
        { keys:['Fe','fe','iron','Iron'],              name:'Iron (Fe)',           unit:'ppm' },
        { keys:['Mn','mn','manganese','Manganese'],    name:'Manganese (Mn)',      unit:'ppm' },
        { keys:['Zn','zn','zinc','Zinc'],              name:'Zinc (Zn)',           unit:'ppm' },
        { keys:['Cu','cu','copper','Copper'],          name:'Copper (Cu)',         unit:'ppm' },
        { keys:['B','b','boron','Boron'],              name:'Boron (B)',           unit:'ppm' },
        { keys:['CEC','cec'],                          name:'CEC',                unit:'meq/100g' },
        { keys:['BS','base_saturation','BaseSaturation','base_sat'], name:'Base Saturation', unit:'%' },
        { keys:['EC','ec','Salinity','salinity'],      name:'Salinity (EC)',       unit:'dS/m' },
    ];
    var TISSUE_KEY = [
        { keys:['N','n','nitrogen'],  name:'Nitrogen (N)',    unit:'%',  opt:[3.5,5.0], max:7 },
        { keys:['P','p','phosphorus'],name:'Phosphorus (P)',  unit:'%',  opt:[0.3,0.6], max:1 },
        { keys:['K','k','potassium'], name:'Potassium (K)',   unit:'%',  opt:[1.5,3.0], max:5 },
        { keys:['Ca','ca','calcium'], name:'Calcium (Ca)',    unit:'%',  opt:[0.3,0.8], max:1.5 },
        { keys:['Mg','mg','magnesium'],name:'Magnesium (Mg)',unit:'%',   opt:[0.15,0.4],max:0.8 },
        { keys:['S','s','sulfur'],    name:'Sulfur (S)',      unit:'%',  opt:[0.2,0.5], max:1 },
    ];
    var WATER_KEY = [
        { keys:['pH','ph','PH'],                          name:'pH',             unit:'',      opt:[6.5,7.5], max:10 },
        { keys:['EC','ec','Salinity','salinity'],          name:'EC / Salinity',  unit:'dS/m',  opt:[0,1.5],   max:5 },
        { keys:['HCO3','hco3','bicarbonate','Bicarbonate'],name:'Bicarbonate',   unit:'ppm',   opt:[0,120],   max:400 },
        { keys:['SAR','sar'],                              name:'SAR',            unit:'',      opt:[0,6],     max:20 },
    ];
    var WATER_FULL = [
        { keys:['Ca','ca','calcium'],  name:'Calcium',   unit:'ppm' },
        { keys:['Mg','mg','magnesium'],name:'Magnesium', unit:'ppm' },
        { keys:['Na','na','sodium'],   name:'Sodium',    unit:'ppm' },
        { keys:['Cl','cl','chloride'], name:'Chloride',  unit:'ppm' },
        { keys:['SO4','so4','sulfate'],name:'Sulfate',   unit:'ppm' },
        { keys:['Hardness','hardness'],name:'Hardness',  unit:'ppm' },
    ];

    function gv(p, keys) {
        for (var i = 0; i < keys.length; i++) {
            var v = p[keys[i]];
            if (v !== undefined && v !== null && v !== '') return v;
        }
        return null;
    }

    function statusOf(val, opt) {
        var v = parseFloat(val);
        if (isNaN(v) || !opt) return { label: '', cls: '' };
        if (v >= opt[0] && v <= opt[1]) return { label: 'Optimal', cls: 'optimal' };
        var m = (opt[1] - opt[0]) * 0.35;
        if (v >= opt[0] - m && v <= opt[1] + m) return { label: 'Good', cls: 'good' };
        return { label: v < opt[0] ? 'Low' : 'High', cls: 'low' };
    }

    function metricCard(name, val, unit, opt, maxVal) {
        if (val === null) return '';
        var st  = statusOf(val, opt);
        var pct = (opt && maxVal) ? Math.min(parseFloat(val) / maxVal * 100, 100) : 0;
        var bar = st.cls === 'optimal' ? '#16a34a' : (st.cls === 'good' ? '#d97706' : '#dc2626');
        var barRow = opt
            ? '<div class="dat-metric-bar-row">' +
                '<div class="dat-metric-bar-wrap"><div class="dat-metric-bar" style="width:' + pct.toFixed(1) + '%;background:' + bar + '"></div></div>' +
                (st.label ? '<span class="dat-metric-status ' + st.cls + '">' + st.label + '</span>' : '') +
              '</div>'
            : '';
        return '<div class="dat-metric-card">' +
            '<div class="dat-metric-name">' + esc(name) + '</div>' +
            '<div class="dat-metric-value">' + val + (unit ? '<span class="dat-metric-unit"> ' + esc(unit) + '</span>' : '') + '</div>' +
            barRow +
            '</div>';
    }

    function specGrid(items, p) {
        var cells = '';
        items.forEach(function (f) {
            var v = gv(p, f.keys);
            if (v !== null) {
                cells += '<div class="dat-spec-cell"><div class="dat-spec-label">' + esc(f.name) + '</div>' +
                    '<div class="dat-spec-value">' + v + (f.unit ? ' ' + f.unit : '') + '</div></div>';
            }
        });
        return cells ? '<div class="dat-spectrum"><div class="dat-spectrum-title">Full Spectrum Analysis</div><div class="dat-spec-grid">' + cells + '</div></div>' : '';
    }

    function notesHtml(notes) {
        return notes ? '<div class="dat-detail-notes"><strong>Notes:</strong> ' + esc(notes) + '</div>' : '';
    }

    function metaHeader(data, opts) {
        opts = opts || {};
        var pairs = [];
        if (!opts.noName && data.name && data.name !== '—') pairs.push(['Zone name', data.name, false]);
        if (!opts.noZone && data.zone && data.zone !== '—') pairs.push(['Zone type', data.zone, false]);
        if (data.date)                                       pairs.push(['Date',      fmtDate(data.date), false]);
        if (data.source && data.source !== 'manual')        pairs.push(['File',      data.source.replace(/\.json$/i, ''), false]);
        if (data.lab_name && data.lab_name !== '')          pairs.push(['Lab',       data.lab_name, false]);
        if (data.labId)                                     pairs.push(['Lab ref',   data.labId, false]);
        if (!pairs.length) return '';
        var cells = pairs.map(function(p) {
            return '<div class="dat-spec-cell">'
                + '<div class="dat-spec-label">' + esc(p[0]) + '</div>'
                + '<div class="dat-spec-value" style="word-break:break-word">' + esc(String(p[1])) + '</div>'
                + '</div>';
        }).join('');
        return '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:8px 16px;padding:12px 16px;background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;margin-bottom:16px">'
            + cells
            + '</div>';
    }

    function buildSoil(p, data) {
        var keyHtml = SOIL_KEY.map(function (f) { return metricCard(f.name, gv(p, f.keys), f.unit, f.opt, f.max); }).join('');
        return metaHeader(data) +
               (keyHtml ? '<div class="dat-metric-grid">' + keyHtml + '</div>' : '') +
               specGrid(SOIL_FULL, p) + notesHtml(data.notes);
    }

    function buildTissue(p, data) {
        var keyHtml = TISSUE_KEY.map(function (f) { return metricCard(f.name, gv(p, f.keys), f.unit, f.opt, f.max); }).join('');
        return metaHeader(data) +
               (keyHtml ? '<div class="dat-metric-grid" style="grid-template-columns:repeat(3,1fr)">' + keyHtml + '</div>' : '') +
               notesHtml(data.notes);
    }

    function buildWater(p, data) {
        var keyHtml = WATER_KEY.map(function (f) { return metricCard(f.name, gv(p, f.keys), f.unit, f.opt, f.max); }).join('');
        return metaHeader(data, { noZone: true }) +
               (keyHtml ? '<div class="dat-metric-grid">' + keyHtml + '</div>' : '') +
               specGrid(WATER_FULL, p) + notesHtml(data.notes);
    }

    function buildLoi(p, data) {
        var fields = [
            { keys:['OM','om','organic_matter','OrganicMatter','LOI'], name:'Organic Matter', unit:'%', opt:[2.5,5], max:10 },
            { keys:['thatch','Thatch','THATCH'],                        name:'Thatch',         unit:'%', opt:[0,10],  max:30 },
            { keys:['moisture','Moisture'],                             name:'Moisture',       unit:'%', opt:[15,25], max:50 },
        ];
        var keyHtml = fields.map(function (f) { return metricCard(f.name, gv(p, f.keys), f.unit, f.opt, f.max); }).join('');
        return metaHeader(data) +
               (keyHtml ? '<div class="dat-metric-grid" style="grid-template-columns:repeat(3,1fr)">' + keyHtml + '</div>' : '') +
               notesHtml(data.notes);
    }

    function buildSpray(data) {
        var pairs = [
            ['Date',              data.date ? fmtDate(data.date) : null],
            ['Zone type',         data.zone && data.zone !== '—' ? data.zone : null],
            ['Product',           data.product && data.product !== '—' ? data.product : null],
            ['Category',          data.category && data.category !== '—' ? data.category.charAt(0).toUpperCase() + data.category.slice(1) : null],
            ['Active Ingredient', data.active_ingredient || null],
            ['Rate',              (data.rate !== null && data.rate !== undefined) ? String(data.rate) + (data.rate_unit ? ' ' + data.rate_unit : '') : null],
            ['Target',            data.target && data.target !== '—' ? data.target : null],
            ['Source',            data.source || 'manual'],
        ];
        var cells = pairs
            .filter(function (p) { return p[1]; })
            .map(function (p) {
                return '<div class="dat-spec-cell">'
                    + '<div class="dat-spec-label">' + esc(p[0]) + '</div>'
                    + '<div class="dat-spec-value">' + esc(String(p[1])) + '</div>'
                    + '</div>';
            }).join('');
        var html = cells
            ? '<div class="dat-spectrum">'
                + '<div class="dat-spectrum-title">Application Details</div>'
                + '<div class="dat-spec-grid" style="grid-template-columns:repeat(auto-fill,minmax(190px,1fr))">' + cells + '</div>'
              + '</div>'
            : '';
        return html + notesHtml(data.notes);
    }

    // ── Select-all & compare button ───────────────────────────────────────
    var checkAll = document.getElementById('dat-check-all');
    if (checkAll) {
        checkAll.addEventListener('change', function () {
            document.querySelectorAll('.dat-row-check').forEach(function (cb) { cb.checked = checkAll.checked; });
            syncCompare();
        });
    }
    document.querySelectorAll('.dat-row-check').forEach(function (cb) {
        cb.addEventListener('change', function () {
            var all = document.querySelectorAll('.dat-row-check');
            var checked = [...all].filter(function (c) { return c.checked; });
            if (checkAll) {
                checkAll.indeterminate = checked.length > 0 && checked.length < all.length;
                checkAll.checked = checked.length === all.length;
            }
            syncCompare();
        });
    });
    function syncCompare() {
        var btn = document.getElementById('dat-compare-btn');
        var delBtn = document.getElementById('dat-delete-bulk-btn');
        var n = document.querySelectorAll('.dat-row-check:checked').length;
        if (btn) {
            btn.disabled = n < 2;
            btn.textContent = '';
            btn.innerHTML = n >= 2
                ? '<svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"/></svg> Compare (' + n + ')'
                : '<svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"/></svg> Compare';
        }
        if (delBtn) {
            delBtn.disabled = n < 1;
            delBtn.innerHTML = n >= 1
                ? '<svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg> Delete (' + n + ')'
                : '<svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg> Delete';
        }
    }

    // ── Compare ───────────────────────────────────────────────────────────
    var compareBtn = document.getElementById('dat-compare-btn');
    if (compareBtn) {
        compareBtn.addEventListener('click', function () {
            var rows = [];
            document.querySelectorAll('.dat-row-check:checked').forEach(function (cb) {
                var tr = cb.closest('.dat-row');
                if (!tr) return;
                try { rows.push(JSON.parse(tr.dataset.row)); } catch (e) {}
            });
            if (rows.length < 2) return;
            openCompare(rows);
        });
    }

    // ── Delete ────────────────────────────────────────────────────────────
    var CSRF_DELETE = (document.querySelector('meta[name="csrf-token"]') || {}).content || '';

    var countEl = document.querySelector('.dat-count');

    function updateCount(delta) {
        if (!countEl) return;
        var n = parseInt(countEl.textContent, 10);
        if (isNaN(n)) return;
        n = Math.max(0, n + delta);
        countEl.textContent = n + ' ' + (n === 1 ? 'record' : 'records');
    }

    function deleteEntry(id, section, trEl) {
        var url;
        if (section === 'spray-log') {
            url = '{{ url("/api/spray-log") }}/' + id;
        } else {
            url = '{{ url("/api/data/entry") }}/' + id;
        }
        return fetch(url, {
            method: 'DELETE',
            headers: { 'X-CSRF-TOKEN': CSRF_DELETE, 'Accept': 'application/json' }
        }).then(function (r) {
            if (!r.ok) throw new Error('HTTP ' + r.status);
            if (trEl) trEl.remove();
            updateCount(-1);
            syncCompare();
        });
    }

    document.querySelectorAll('.dat-del-row-btn').forEach(function (btn) {
        btn.addEventListener('click', function () {
            var id      = btn.dataset.id;
            var section = btn.dataset.section;
            var tr      = btn.closest('.dat-row');
            if (!window.confirm('Delete this record? This cannot be undone.')) return;
            btn.disabled = true;
            deleteEntry(id, section, tr).catch(function () {
                btn.disabled = false;
                alert('Failed to delete. Please try again.');
            });
        });
    });

    var deleteBulkBtn = document.getElementById('dat-delete-bulk-btn');
    if (deleteBulkBtn) {
        deleteBulkBtn.addEventListener('click', function () {
            var checked = document.querySelectorAll('.dat-row-check:checked');
            if (!checked.length) return;
            var n = checked.length;
            if (!window.confirm('Delete ' + n + ' selected record' + (n > 1 ? 's' : '') + '? This cannot be undone.')) return;
            deleteBulkBtn.disabled = true;
            var promises = [];
            checked.forEach(function (cb) {
                var tr      = cb.closest('.dat-row');
                var id      = tr ? tr.dataset.id : null;
                var section = tr ? tr.dataset.section : null;
                if (id && section) promises.push(deleteEntry(id, section, tr));
            });
            Promise.all(promises).then(function () {
                syncCompare();
            }).catch(function () {
                syncCompare();
                alert('Some records could not be deleted.');
            });
        });
    }

    var CMP_FIELDS = {
        soil: [
            { keys:['pH','ph','PH'],                                          label:'pH',              unit:'' },
            { keys:['EC','ec','Salinity','salinity'],                          label:'EC',              unit:'dS/m' },
            { keys:['CEC','cec'],                                              label:'CEC',             unit:'meq/100g' },
            { keys:['OM','om','organic_matter','OrganicMatter','LOI'],         label:'Organic Matter',  unit:'%' },
            { keys:['K','k','potassium','Potassium'],                          label:'Potassium (K)',   unit:'ppm' },
            { keys:['P','p','phosphorus','Phosphorus'],                        label:'Phosphorus (P)',  unit:'ppm' },
            { keys:['Ca','ca','calcium','Calcium'],                            label:'Calcium (Ca)',    unit:'ppm' },
            { keys:['Mg','mg','magnesium','Magnesium'],                        label:'Magnesium (Mg)', unit:'ppm' },
            { keys:['S','s','sulfur','Sulfur','sulphur'],                      label:'Sulfur (S)',      unit:'ppm' },
            { keys:['Fe','fe','iron','Iron'],                                  label:'Iron (Fe)',       unit:'ppm' },
            { keys:['Mn','mn','manganese','Manganese'],                        label:'Manganese (Mn)', unit:'ppm' },
            { keys:['Cu','cu','copper','Copper'],                              label:'Copper (Cu)',     unit:'ppm' },
            { keys:['Zn','zn','zinc','Zinc'],                                  label:'Zinc (Zn)',       unit:'ppm' },
            { keys:['B','b','boron','Boron'],                                  label:'Boron (B)',       unit:'ppm' },
            { keys:['Na','na','sodium','Sodium'],                              label:'Sodium (Na)',     unit:'ppm' },
            { keys:['N','n','nitrogen','Nitrogen'],                            label:'Nitrogen (N)',    unit:'ppm' },
            { keys:['BS','base_saturation','BaseSaturation','base_sat'],       label:'Base Saturation', unit:'%' },
        ],
        tissue: [
            { keys:['N','n','nitrogen','Nitrogen','N_total'],   label:'Nitrogen (N)',    unit:'%' },
            { keys:['P','p','phosphorus','Phosphorus'],          label:'Phosphorus (P)',  unit:'%' },
            { keys:['K','k','potassium','Potassium'],            label:'Potassium (K)',   unit:'%' },
            { keys:['Ca','ca','calcium','Calcium'],              label:'Calcium (Ca)',    unit:'%' },
            { keys:['Mg','mg','magnesium','Magnesium'],          label:'Magnesium (Mg)', unit:'%' },
            { keys:['S','s','sulfur','Sulfur'],                  label:'Sulfur (S)',      unit:'%' },
            { keys:['Fe','fe','iron','Iron'],                    label:'Iron (Fe)',       unit:'mg/kg' },
            { keys:['Mn','mn','manganese','Manganese'],          label:'Manganese (Mn)', unit:'mg/kg' },
            { keys:['Zn','zn','zinc','Zinc'],                    label:'Zinc (Zn)',       unit:'mg/kg' },
            { keys:['Cu','cu','copper','Copper'],                label:'Copper (Cu)',     unit:'mg/kg' },
            { keys:['B','b','boron','Boron'],                    label:'Boron (B)',       unit:'mg/kg' },
            { keys:['Mo','mo','molybdenum','Molybdenum'],        label:'Molybdenum (Mo)',unit:'mg/kg' },
            { keys:['Na','na','sodium','Sodium'],                label:'Sodium (Na)',     unit:'%' },
            { keys:['Cl','cl','chloride','Chloride'],            label:'Chloride (Cl)',   unit:'%' },
        ],
        water: [
            { keys:['pH','ph','PH'],                                   label:'pH',              unit:'' },
            { keys:['EC','ec','Salinity','salinity','ecw','EC_dSm'],    label:'EC / Salinity',   unit:'dS/m' },
            { keys:['Ca','ca','calcium','Calcium'],                     label:'Calcium (Ca)',    unit:'ppm' },
            { keys:['Mg','mg','magnesium','Magnesium'],                 label:'Magnesium (Mg)', unit:'ppm' },
            { keys:['Na','na','sodium','Sodium'],                       label:'Sodium (Na)',     unit:'ppm' },
            { keys:['K','k','potassium','Potassium'],                   label:'Potassium (K)',   unit:'ppm' },
            { keys:['Cl','cl','chloride','Chloride'],                   label:'Chloride (Cl)',   unit:'ppm' },
            { keys:['SO4','so4','sulfate','Sulfate'],                   label:'Sulfate (SO4)',   unit:'ppm' },
            { keys:['HCO3','hco3','bicarbonate','Bicarbonate'],         label:'Bicarbonate',     unit:'ppm' },
            { keys:['CO3','co3','carbonate','Carbonate'],               label:'Carbonate',       unit:'ppm' },
            { keys:['B','b','boron','Boron'],                           label:'Boron (B)',       unit:'ppm' },
            { keys:['Fe','fe','iron','Iron'],                           label:'Iron (Fe)',       unit:'ppm' },
            { keys:['Mn','mn','manganese','Manganese'],                 label:'Manganese (Mn)', unit:'ppm' },
            { keys:['SAR','sar'],                                       label:'SAR',             unit:'' },
            { keys:['Hardness','hardness'],                             label:'Hardness',        unit:'ppm' },
        ],
        loi: [
            { keys:['OM','om','organic_matter','OrganicMatter','LOI'],  label:'Organic Matter',  unit:'%' },
            { keys:['loi_0_2','LOI_0_2','OM_0_2'],                      label:'OM 0–2 cm',       unit:'%' },
            { keys:['loi_2_4','LOI_2_4','OM_2_4'],                      label:'OM 2–4 cm',       unit:'%' },
            { keys:['loi_4_6','LOI_4_6','OM_4_6'],                      label:'OM 4–6 cm',       unit:'%' },
            { keys:['thatch','Thatch','THATCH'],                         label:'Thatch',          unit:'%' },
            { keys:['moisture','Moisture'],                              label:'Moisture',        unit:'%' },
        ],
    };

    function openCompare(rows) {
        var section = rows[0].section;
        var fields  = CMP_FIELDS[section] || [];

        // Build comparison matrix — one entry per field, skip fields with no data
        var matrix = fields.map(function (f) {
            var vals = rows.map(function (row) {
                var v = gv(row.payload || {}, f.keys);
                if (v === null) return null;
                var n = parseFloat(v);
                return isNaN(n) ? null : n;
            });
            var nums = vals.filter(function (v) { return v !== null; });
            var mn   = nums.length ? Math.min.apply(null, nums) : null;
            var mx   = nums.length ? Math.max.apply(null, nums) : null;
            var avg  = nums.length ? nums.reduce(function (a, b) { return a + b; }, 0) / nums.length : null;
            var cv   = null;
            if (nums.length > 1 && avg && avg > 0) {
                var variance = nums.reduce(function (s, v) { return s + Math.pow(v - avg, 2); }, 0) / nums.length;
                cv = Math.sqrt(variance) / avg * 100;
            }
            return { f: f, vals: vals, min: mn, max: mx, avg: avg, cv: cv };
        }).filter(function (m) {
            return m.vals.some(function (v) { return v !== null; });
        });

        if (!matrix.length) {
            alert('No comparable numeric data found in the selected samples.');
            return;
        }

        var sectionNames = { soil: 'Soil', tissue: 'Tissue', water: 'Water', loi: 'LOI / OM' };
        var title = 'Compare ' + (sectionNames[section] || section) + ' Samples';

        // Table header — one column per sample
        var headCells = rows.map(function (r) {
            return '<th class="dat-cmp-th-sample">'
                + '<div class="dat-cmp-sample-name">' + esc(r.name || 'Sample') + '</div>'
                + (r.date ? '<div class="dat-cmp-sample-date">' + esc(fmtDate(r.date)) + '</div>' : '')
                + '</th>';
        }).join('');

        // Table body — one row per field
        var bodyRows = matrix.map(function (m) {
            var singleVal = m.min !== null && m.max !== null && m.min === m.max;
            var cells = m.vals.map(function (v) {
                if (v === null) return '<td class="dat-cmp-td dat-cmp-na">—</td>';
                var cls = '';
                if (!singleVal) {
                    if (v === m.min) cls = ' dat-cmp-cell-min';
                    else if (v === m.max) cls = ' dat-cmp-cell-max';
                }
                var unit = m.f.unit ? ' <span class="dat-cmp-unit">' + esc(m.f.unit) + '</span>' : '';
                return '<td class="dat-cmp-td' + cls + '">' + fmtNum(v) + unit + '</td>';
            }).join('');

            var cvCls = m.cv === null ? '' : m.cv < 10 ? ' dat-cmp-cv-low' : m.cv < 25 ? ' dat-cmp-cv-med' : ' dat-cmp-cv-high';
            var unitTag = m.f.unit ? '<span class="dat-cmp-param-unit"> (' + esc(m.f.unit) + ')</span>' : '';

            return '<tr>'
                + '<td class="dat-cmp-td-param">' + esc(m.f.label) + unitTag + '</td>'
                + cells
                + '<td class="dat-cmp-td-stat">' + (m.min !== null ? fmtNum(m.min) : '—') + '</td>'
                + '<td class="dat-cmp-td-stat">' + (m.max !== null ? fmtNum(m.max) : '—') + '</td>'
                + '<td class="dat-cmp-td-stat">' + (m.avg !== null ? fmtNum(m.avg) : '—') + '</td>'
                + '<td class="dat-cmp-td-stat dat-cmp-td-cv' + cvCls + '">' + (m.cv !== null ? m.cv.toFixed(1) + '%' : '—') + '</td>'
                + '</tr>';
        }).join('');

        var html = '<div class="dat-cmp-overlay" id="dat-cmp-overlay">'
            + '<div class="dat-cmp-modal">'
            + '<div class="dat-cmp-hd">'
            + '<div class="dat-cmp-title">' + esc(title) + '</div>'
            + '<button class="dat-cmp-close" id="dat-cmp-close" aria-label="Close">×</button>'
            + '</div>'
            + '<div class="dat-cmp-body">'
            + '<div class="dat-cmp-table-card">'
            + '<div class="dat-cmp-table-wrap">'
            + '<table class="dat-cmp-table">'
            + '<thead><tr>'
            + '<th class="dat-cmp-th-param">Parameter</th>'
            + headCells
            + '<th class="dat-cmp-th-stat">Min</th>'
            + '<th class="dat-cmp-th-stat">Max</th>'
            + '<th class="dat-cmp-th-stat">Avg</th>'
            + '<th class="dat-cmp-th-stat">CV%</th>'
            + '</tr></thead>'
            + '<tbody>' + bodyRows + '</tbody>'
            + '</table>'
            + '</div>'
            + '</div>'
            + '<div class="dat-cmp-legend">'
            + '<span class="dat-cmp-legend-item"><span class="dat-cmp-leg-min"></span> Lowest value</span>'
            + '<span class="dat-cmp-legend-item"><span class="dat-cmp-leg-max"></span> Highest value</span>'
            + '<span class="dat-cmp-legend-item">CV% — coefficient of variation: how much samples differ from each other</span>'
            + '</div>'
            + '</div>'
            + '</div>'
            + '</div>';

        var wrapper = document.createElement('div');
        wrapper.innerHTML = html;
        var overlay = wrapper.firstChild;

        overlay.querySelector('#dat-cmp-close').addEventListener('click', function () { overlay.remove(); });
        overlay.addEventListener('click', function (e) { if (e.target === overlay) overlay.remove(); });

        function onEsc(e) {
            if (e.key === 'Escape' && document.getElementById('dat-cmp-overlay')) {
                overlay.remove();
                document.removeEventListener('keydown', onEsc);
            }
        }
        document.addEventListener('keydown', onEsc);

        document.body.appendChild(overlay);
    }

    // ── Helpers ──────────────────────────────────────────────────────────
    function fmtDate(str) {
        if (!str) return '—';
        var d = new Date(str + 'T12:00:00');
        return isNaN(d.getTime()) ? str : d.toLocaleDateString('en', { year:'numeric', month:'short', day:'numeric' });
    }
    function esc(s) {
        return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
    }
    function fmtNum(v) {
        if (v === null || v === undefined) return '—';
        if (v >= 100) return v.toFixed(0);
        if (v >= 10)  return v.toFixed(1);
        return v.toFixed(2);
    }

}());
</script>

{{-- ── ADD DATA MODAL JS ────────────────────────────────────────── --}}
@if($section !== 'sensors')
<script>
(function () {
    'use strict';

    var SECTION       = '{{ $section }}';
    var SECTION_TITLE = '{{ $sectionTitles[$section] ?? "Data" }}';
    var SITE_ID  = '{{ $activeSite?->id ?? '' }}';
    var SITE_LAT = {{ $activeSite?->latitude ?? 'null' }};
    var SITE_LNG = {{ $activeSite?->longitude ?? 'null' }};
    var CSRF     = (document.querySelector('meta[name="csrf-token"]') || {}).content || '';

    var _editingId = null;

    // ── CSV field mappings (column header → payload key) ─────────
    var CSV_MAPS = {
        soil: {
            'pH': 'pH', 'ph': 'pH', 'pH_Water': 'pH',
            'K': 'K', 'K_ppm': 'K', 'potassium': 'K', 'Potassium': 'K',
            'P': 'P', 'P_ppm': 'P', 'phosphorus': 'P', 'Phosphorus': 'P',
            'Ca': 'Ca', 'Ca_ppm': 'Ca', 'calcium': 'Ca', 'Calcium': 'Ca',
            'Mg': 'Mg', 'Mg_ppm': 'Mg', 'magnesium': 'Mg', 'Magnesium': 'Mg',
            'S': 'S', 'S_ppm': 'S', 'sulfur': 'S', 'sulphur': 'S',
            'Fe': 'Fe', 'Fe_ppm': 'Fe', 'iron': 'Fe', 'Iron': 'Fe',
            'Mn': 'Mn', 'Mn_ppm': 'Mn', 'manganese': 'Mn',
            'Zn': 'Zn', 'Zn_ppm': 'Zn', 'zinc': 'Zn',
            'Cu': 'Cu', 'Cu_ppm': 'Cu', 'copper': 'Cu',
            'B': 'B', 'B_ppm': 'B', 'boron': 'B',
            'Na': 'Na', 'Na_ppm': 'Na', 'sodium': 'Na',
            'CEC': 'CEC', 'cec': 'CEC', 'CEC_meq100g': 'CEC',
            'EC': 'EC', 'ec': 'EC', 'EC_dSm': 'EC', 'EC_1_5': 'EC',
            'OM': 'OM', 'om': 'OM', 'OM_Percent': 'OM', 'LOI': 'LOI',
            'organic_matter': 'OM', 'Organic Matter': 'OM',
            'Zone': 'zone', 'zone': 'zone',
            'Sample_ID': '__uid', 'SampleID': '__uid', 'Sample ID': '__uid', 'Sample': '__uid', 'sample_id': '__uid',
            'Date': '__date', 'date': '__date', 'Sample_Date': '__date',
            'Lab': '__lab', 'lab': '__lab', 'Lab_Name': '__lab',
        },
        tissue: {
            'N': 'N', 'N_Percent': 'N', 'nitrogen': 'N', 'Nitrogen': 'N',
            'P': 'P', 'P_Percent': 'P', 'phosphorus': 'P',
            'K': 'K', 'K_Percent': 'K', 'potassium': 'K',
            'Ca': 'Ca', 'Ca_Percent': 'Ca', 'calcium': 'Ca',
            'Mg': 'Mg', 'Mg_Percent': 'Mg', 'magnesium': 'Mg',
            'S': 'S', 'S_Percent': 'S', 'sulfur': 'S',
            'Fe': 'Fe', 'Fe_mgkg': 'Fe', 'iron': 'Fe',
            'Mn': 'Mn', 'Mn_mgkg': 'Mn', 'manganese': 'Mn',
            'Zn': 'Zn', 'Zn_mgkg': 'Zn', 'zinc': 'Zn',
            'Cu': 'Cu', 'Cu_mgkg': 'Cu', 'copper': 'Cu',
            'B': 'B', 'B_mgkg': 'B', 'boron': 'B',
            'Zone': 'zone', 'zone': 'zone',
            'Sample_ID': '__uid', 'SampleID': '__uid', 'Sample ID': '__uid', 'Sample': '__uid',
            'Date': '__date', 'date': '__date',
            'Lab': '__lab', 'Lab_Name': '__lab',
        },
        water: {
            'pH': 'pH', 'ph': 'pH',
            'EC': 'EC', 'ec': 'EC', 'EC_dSm': 'EC', 'ECw': 'EC',
            'HCO3': 'HCO3', 'hco3': 'HCO3', 'bicarbonate': 'HCO3', 'Bicarbonate': 'HCO3',
            'Ca': 'Ca', 'Ca_mgL': 'Ca', 'calcium': 'Ca',
            'Mg': 'Mg', 'Mg_mgL': 'Mg', 'magnesium': 'Mg',
            'Na': 'Na', 'Na_mgL': 'Na', 'sodium': 'Na',
            'K': 'K', 'K_mgL': 'K', 'potassium': 'K',
            'Cl': 'Cl', 'Cl_mgL': 'Cl', 'chloride': 'Cl',
            'SO4': 'SO4', 'SO4_mgL': 'SO4', 'sulfate': 'SO4',
            'SAR': 'SAR', 'sar': 'SAR',
            'Sample_ID': '__uid', 'SampleID': '__uid', 'Sample ID': '__uid', 'Sample': '__uid',
            'Date': '__date', 'date': '__date',
            'Lab': '__lab', 'Lab_Name': '__lab',
        },
        loi: {
            'OM': 'OM', 'om': 'OM', 'OM_Percent': 'OM', 'LOI': 'OM', 'organic_matter': 'OM',
            'OrganicMatter': 'OM', 'Organic Matter': 'OM',
            'thatch': 'thatch', 'Thatch': 'thatch', 'THATCH': 'thatch',
            'moisture': 'moisture', 'Moisture': 'moisture',
            'Zone': 'zone', 'zone': 'zone',
            'Sample_ID': '__uid', 'SampleID': '__uid', 'Sample ID': '__uid', 'Sample': '__uid',
            'Date': '__date', 'date': '__date',
            'Lab': '__lab', 'Lab_Name': '__lab',
        },
    };

    // ── Manual form field definitions ─────────────────────────────
    var MANUAL_FORMS = {
        soil: {
            meta: [
                { id: 'uid',    label: 'Zone name', type: 'zone-name', placeholder: 'e.g. Green 1' },
                { id: 'zone',   label: 'Zone type',        type: 'zone' },
                { id: 'date',   label: 'Date Collected',   type: 'date' },
                { id: 'lab',    label: 'Lab Name',         placeholder: 'Optional' },
                { id: 'labref', label: 'Lab Reference',    placeholder: 'Optional' },
            ],
            nutrients: [
                { id: 'pH', label: 'pH',          unit: '',       placeholder: '6.5' },
                { id: 'K',  label: 'K',           unit: 'ppm',    placeholder: '' },
                { id: 'P',  label: 'P',           unit: 'ppm',    placeholder: '' },
                { id: 'Ca', label: 'Ca',          unit: 'ppm',    placeholder: '' },
                { id: 'Mg', label: 'Mg',          unit: 'ppm',    placeholder: '' },
                { id: 'S',  label: 'S',           unit: 'ppm',    placeholder: '' },
                { id: 'Na', label: 'Na',          unit: 'ppm',    placeholder: '' },
                { id: 'Fe', label: 'Fe',          unit: 'ppm',    placeholder: '' },
                { id: 'Mn', label: 'Mn',          unit: 'ppm',    placeholder: '' },
                { id: 'Zn', label: 'Zn',          unit: 'ppm',    placeholder: '' },
                { id: 'Cu', label: 'Cu',          unit: 'ppm',    placeholder: '' },
                { id: 'B',  label: 'B',           unit: 'ppm',    placeholder: '' },
                { id: 'CEC',label: 'CEC',         unit: 'meq/100g', placeholder: '' },
                { id: 'EC', label: 'EC',          unit: 'dS/m',   placeholder: '' },
                { id: 'OM', label: 'OM / LOI',    unit: '%',      placeholder: '' },
            ],
        },
        tissue: {
            meta: [
                { id: 'uid',  label: 'Zone name', type: 'zone-name', placeholder: 'e.g. Greens clipping' },
                { id: 'zone', label: 'Zone type',        type: 'zone' },
                { id: 'date', label: 'Date Collected',   type: 'date' },
                { id: 'lab',  label: 'Lab Name',         placeholder: 'Optional' },
            ],
            nutrients: [
                { id: 'N',  label: 'N',  unit: '%',   placeholder: '' },
                { id: 'P',  label: 'P',  unit: '%',   placeholder: '' },
                { id: 'K',  label: 'K',  unit: '%',   placeholder: '' },
                { id: 'Ca', label: 'Ca', unit: '%',   placeholder: '' },
                { id: 'Mg', label: 'Mg', unit: '%',   placeholder: '' },
                { id: 'S',  label: 'S',  unit: '%',   placeholder: '' },
                { id: 'Fe', label: 'Fe', unit: 'ppm', placeholder: '' },
                { id: 'Mn', label: 'Mn', unit: 'ppm', placeholder: '' },
                { id: 'Zn', label: 'Zn', unit: 'ppm', placeholder: '' },
                { id: 'Cu', label: 'Cu', unit: 'ppm', placeholder: '' },
            ],
        },
        water: {
            meta: [
                { id: 'uid',  label: 'Name', placeholder: 'e.g. Bore water' },
                { id: 'date', label: 'Date Collected',   type: 'date' },
                { id: 'lab',  label: 'Lab Name',         placeholder: 'Optional' },
            ],
            nutrients: [
                { id: 'pH',   label: 'pH',          unit: '',      placeholder: '' },
                { id: 'EC',   label: 'EC',          unit: 'dS/m', placeholder: '' },
                { id: 'HCO3', label: 'HCO3',        unit: 'ppm',  placeholder: '' },
                { id: 'Ca',   label: 'Ca',          unit: 'ppm',  placeholder: '' },
                { id: 'Mg',   label: 'Mg',          unit: 'ppm',  placeholder: '' },
                { id: 'Na',   label: 'Na',          unit: 'ppm',  placeholder: '' },
                { id: 'K',    label: 'K',           unit: 'ppm',  placeholder: '' },
                { id: 'Cl',   label: 'Cl',          unit: 'ppm',  placeholder: '' },
                { id: 'SO4',  label: 'SO4',         unit: 'ppm',  placeholder: '' },
                { id: 'SAR',  label: 'SAR',         unit: '',     placeholder: '' },
            ],
        },
        loi: {
            meta: [
                { id: 'uid',  label: 'Zone name', type: 'zone-name', placeholder: 'e.g. Green centre' },
                { id: 'zone', label: 'Zone type',        type: 'zone' },
                { id: 'date', label: 'Date Collected',   type: 'date' },
                { id: 'lab',  label: 'Lab Name',         placeholder: 'Optional' },
            ],
            nutrients: [
                { id: 'OM',       label: 'OM / LOI',  unit: '%', placeholder: '' },
                { id: 'thatch',   label: 'Thatch',    unit: '%', placeholder: '' },
                { id: 'moisture', label: 'Moisture',  unit: '%', placeholder: '' },
            ],
        },
    };

    var ZONES      = ['Greens','Tees','Fairways','Surrounds','Roughs','Other'];
    var ZONE_NAMES = @json($activeSite->attributes_json['zones'] ?? []);
    var SPRAY_CATS = [
        { id: 'fungicide',    label: 'Fungicide' },
        { id: 'pgr',          label: 'PGR' },
        { id: 'nutrition',    label: 'Nutrition / Fertiliser' },
        { id: 'wetting_agent',label: 'Wetting Agent' },
        { id: 'pre_emergent', label: 'Pre-emergent' },
        { id: 'insecticide',  label: 'Insecticide' },
        { id: 'herbicide',    label: 'Herbicide' },
        { id: 'other',        label: 'Other' },
    ];
    var RATE_UNITS = ['L/ha','kg/ha','mL/100m²','g/100m²','mL/ha','g/ha'];

    var SPRAY_PRODUCT_PRESETS = {
        // Names must match keys in spray-log-cascade.js PGR_PRODUCT_MAP (lowercase lookup)
        pgr: [
            { name: 'Primo 250EC',          ai: 'Trinexapac-ethyl', rate: 0.4, unit: 'L/ha' },
            { name: 'Primo Maxx 120',       ai: 'Trinexapac-ethyl', rate: 0.5, unit: 'L/ha' },
            { name: 'Amigo 175',            ai: 'Trinexapac-ethyl', rate: 0.5, unit: 'L/ha' },
            { name: 'Marvel 175',           ai: 'Trinexapac-ethyl', rate: 0.5, unit: 'L/ha' },
            { name: 'Paclobutrazol 200g/L', ai: 'Paclobutrazol',    rate: 1.0, unit: 'L/ha' },
            { name: 'Paclobutrazol 250g/L', ai: 'Paclobutrazol',    rate: 0.8, unit: 'L/ha' },
            { name: 'Ethephon 480g/L',      ai: 'Ethephon',         rate: 1.0, unit: 'L/ha' },
        ],
    };

    function _detectRegion(lat, lng) {
        if (lat == null || lng == null) return 'au';
        // Southern hemisphere
        if (lat < 0 && lng > 165 && lng < 180) return 'nz';
        if (lat < 0 && lng > 110 && lng <= 165) return 'au';
        // Japan
        if (lat > 24 && lat < 46 && lng > 123 && lng < 146) return 'japan';
        // Europe
        if (lat > 35 && lat < 72 && lng > -12 && lng < 45) {
            if (lng > -11 && lng < 2 && lat > 49.9 && lat < 61.1) return 'uk';
            if (lat > 55 && lng > 4 && lng < 32) return 'scandinavia';
            return 'eu';
        }
        // USA
        if (lat > 24 && lat < 72 && lng > -170 && lng < -50) return 'us';
        return 'au';
    }

    function buildFungicideOpts() {
        var region = _detectRegion(SITE_LAT, SITE_LNG);
        var db;
        if (region === 'nz') db = window.GAIP_NZ_FUNGICIDES && window.GAIP_NZ_FUNGICIDES.db;
        if (!db && (region === 'uk' || region === 'eu')) db = window.GAIP_UK_FUNGICIDES && window.GAIP_UK_FUNGICIDES.db;
        if (!db) db = window.GAIP_AU_FUNGICIDES && window.GAIP_AU_FUNGICIDES.db;
        if (!db) return null;
        var opts = [];
        Object.keys(db).forEach(function(aiKey) {
            var entry = db[aiKey];
            if (!entry.products || !entry.products.length) return;
            entry.products.forEach(function(p) {
                var rateNum = String(p.rate || '').match(/[\d.]+/);
                opts.push({ label: p.trade, ai: aiKey, frac: String(entry.frac || ''), rate: rateNum ? rateNum[0] : '' });
            });
        });
        opts.sort(function(a, b) { return a.label.localeCompare(b.label); });
        return opts;
    }

    function renderSlProductField(cat) {
        if (cat === 'fungicide') {
            var fopts = buildFungicideOpts();
            if (fopts && fopts.length) {
                var fOptHtml = '<option value="">— Select product —</option>'
                    + fopts.map(function(p) {
                        return '<option value="' + esc(p.label) + '" data-ai="' + esc(p.ai) + '" data-rate="' + esc(p.rate) + '" data-unit="L/ha">' + esc(p.label) + '</option>';
                    }).join('')
                    + '<option value="__other__">— Enter manually —</option>';
                return '<select class="dat-mf-select" id="dat-sl-product" style="width:100%">' + fOptHtml + '</select>'
                    + '<input type="text" class="dat-mf-input" id="dat-sl-product-custom" placeholder="Product name" style="display:none;margin-top:6px">';
            }
            return '<input type="text" class="dat-mf-input" id="dat-sl-product" placeholder="e.g. Heritage Maxx">';
        }
        var presets = SPRAY_PRODUCT_PRESETS[cat];
        if (presets && presets.length) {
            var opts = '<option value="">— Select product —</option>'
                + presets.map(function(p) {
                    return '<option value="' + esc(p.name) + '" data-ai="' + esc(p.ai) + '" data-rate="' + p.rate + '" data-unit="' + esc(p.unit) + '">' + esc(p.name) + '</option>';
                }).join('')
                + '<option value="__other__">— Enter manually —</option>';
            return '<select class="dat-mf-select" id="dat-sl-product" style="width:100%">' + opts + '</select>'
                + '<input type="text" class="dat-mf-input" id="dat-sl-product-custom" placeholder="Product name" style="display:none;margin-top:6px">';
        }
        return '<input type="text" class="dat-mf-input" id="dat-sl-product" placeholder="e.g. product name">';
    }

    function updateSlProductField(cat) {
        var wrap = document.getElementById('dat-sl-product-wrap');
        if (!wrap) return;
        wrap.innerHTML = renderSlProductField(cat);
        var sel = document.getElementById('dat-sl-product');
        if (sel && sel.tagName === 'SELECT') {
            sel.addEventListener('change', function() {
                var opt = this.options[this.selectedIndex];
                var customEl = document.getElementById('dat-sl-product-custom');
                if (this.value === '__other__') {
                    if (customEl) { customEl.style.display = ''; customEl.focus(); }
                    return;
                }
                if (customEl) customEl.style.display = 'none';
                var aiEl   = document.getElementById('dat-sl-ai');
                var rateEl = document.getElementById('dat-sl-rate');
                var unitEl = document.getElementById('dat-sl-unit');
                if (aiEl   && opt.dataset.ai)   aiEl.value = opt.dataset.ai;
                if (rateEl && opt.dataset.rate)  rateEl.value = opt.dataset.rate;
                if (unitEl && opt.dataset.unit) {
                    for (var i = 0; i < unitEl.options.length; i++) {
                        if (unitEl.options[i].value === opt.dataset.unit) { unitEl.selectedIndex = i; break; }
                    }
                }
            });
        }
    }

    // ── Modal state ───────────────────────────────────────────────
    var _parsedCSV = null; // { payload, uid, date, lab }
    var _activeTab = 'upload';

    // ── Helpers ───────────────────────────────────────────────────
    function q(id) { return document.getElementById(id); }
    function esc(s) { return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
    function setMsg(text, cls) {
        var el = q('dat-modal-msg');
        if (!el) return;
        el.textContent = text;
        el.className = 'dat-modal-msg' + (cls ? ' ' + cls : '');
    }
    function todayISO() { return new Date().toISOString().split('T')[0]; }

    // ── CSV parser (no dependencies) ──────────────────────────────
    function parseCSVLine(line) {
        var result = [], cur = '', inQ = false;
        for (var i = 0; i < line.length; i++) {
            var c = line[i];
            if (c === '"') { inQ = !inQ; }
            else if (c === ',' && !inQ) { result.push(cur); cur = ''; }
            else { cur += c; }
        }
        result.push(cur);
        return result;
    }

    function parseCSV(text) {
        var lines = text.trim().split(/\r?\n/);
        if (lines.length < 2) return null;
        var headers = parseCSVLine(lines[0]).map(function(h) { return h.trim(); });
        var rows = [];
        for (var i = 1; i < lines.length; i++) {
            if (!lines[i].trim()) continue;
            var vals = parseCSVLine(lines[i]);
            var row = {};
            for (var j = 0; j < headers.length; j++) {
                row[headers[j]] = (vals[j] || '').trim();
            }
            rows.push(row);
        }
        return { headers: headers, rows: rows };
    }

    function csvToPayload(section, row) {
        var map = CSV_MAPS[section];
        if (!map) return null;
        var payload = {}, uid = '', date = '', lab = '';
        Object.keys(row).forEach(function(col) {
            var val = row[col];
            if (!val || val === '') return;
            var key = map[col];
            if (!key) {
                // Try case-insensitive fallback
                var colL = col.toLowerCase();
                Object.keys(map).forEach(function(mk) {
                    if (mk.toLowerCase() === colL) key = map[mk];
                });
            }
            if (!key) return;
            if (key === '__uid')  { uid  = val; return; }
            if (key === '__date') { date = val; return; }
            if (key === '__lab')  { lab  = val; return; }
            payload[key] = val;
        });
        // Store zone name in _label and auto-detect zone type from it
        if (uid && ['soil','tissue','loi'].indexOf(section) !== -1) {
            payload['_label'] = uid;
            if (!payload['zone']) {
                var u = uid.toLowerCase();
                var zoneType = u.indexOf('green')   !== -1 ? 'Greens'
                             : u.indexOf('fairway') !== -1 ? 'Fairways'
                             : u.indexOf('tee')     !== -1 ? 'Tees'
                             : u.indexOf('rough')   !== -1 ? 'Roughs'
                             : u.indexOf('surround')!== -1 ? 'Surrounds'
                             : null;
                if (zoneType) payload['zone'] = zoneType;
            }
        }
        return { payload: payload, uid: uid, date: date, lab: lab };
    }

    // ── Open / close ──────────────────────────────────────────────
    function openModal() {
        _editingId = null;
        var modal = q('dat-add-modal');
        if (!modal) return;
        _parsedCSV = null;
        _activeTab = SECTION === 'spray-log' ? 'manual' : 'upload';
        var titleEl = q('dat-modal-title');
        if (titleEl) titleEl.textContent = 'Add ' + SECTION_TITLE;
        q('dat-modal-body').innerHTML = SECTION === 'spray-log' ? buildSprayBody() : buildLabBody();
        setMsg('');
        modal.style.display = 'flex';
        document.body.style.overflow = 'hidden';
        wireModalBody();
    }

    function closeModal() {
        _editingId = null;
        var modal = q('dat-add-modal');
        if (modal) modal.style.display = 'none';
        document.body.style.overflow = '';
        _parsedCSV = null;
    }

    window.datOpenEditModal = function (data) {
        _editingId = data.id;
        var modal = q('dat-add-modal');
        if (!modal) return;
        _parsedCSV = null;
        _activeTab = 'manual';
        var titleEl = q('dat-modal-title');
        if (titleEl) titleEl.textContent = 'Edit ' + SECTION_TITLE;
        q('dat-modal-body').innerHTML = SECTION === 'spray-log' ? buildSprayBody() : buildLabBody();
        setMsg('');
        wireModalBody();
        if (SECTION === 'spray-log') {
            prefillSprayForm(data);
        } else {
            prefillManualForm(data);
        }
        modal.style.display = 'flex';
        document.body.style.overflow = 'hidden';
    };

    // ── Lab form builder ──────────────────────────────────────────
    function buildLabBody() {
        var def = MANUAL_FORMS[SECTION];
        if (!def) return '<p>No form available for this section.</p>';

        if (_editingId) {
            _activeTab = 'manual';
            return buildManualTab(def);
        }

        var html = '<div class="dat-modal-tabs">'
            + '<button class="dat-modal-tab' + (_activeTab==='upload'?' active':'') + '" data-tab="upload">Upload CSV</button>'
            + '<button class="dat-modal-tab' + (_activeTab==='manual'?' active':'') + '" data-tab="manual">Enter Manually</button>'
            + '</div>';

        if (_activeTab === 'upload') {
            html += buildUploadTab();
        } else {
            html += buildManualTab(def);
        }
        return html;
    }

    function prefillManualForm(data) {
        var sourceEl = q('dat-f-source');
        if (sourceEl) sourceEl.value = data.source || '';

        var uidEl = q('dat-f-uid');
        if (uidEl) uidEl.value = (data.name && data.name !== '—') ? data.name : (data.client_uid || '');

        var zoneEl = q('dat-f-zone');
        if (zoneEl && data.zone && data.zone !== '—') zoneEl.value = data.zone;

        var dateEl = q('dat-f-date');
        if (dateEl && data.date) dateEl.value = data.date;

        var labEl = q('dat-f-lab');
        if (labEl) labEl.value = data.lab_name || '';

        var labRefEl = q('dat-f-labref');
        if (labRefEl) labRefEl.value = data.lab_ref || '';

        var notesEl = q('dat-f-notes');
        if (notesEl) notesEl.value = data.notes || '';

        var def = MANUAL_FORMS[SECTION];
        if (def && data.payload) {
            def.nutrients.forEach(function (f) {
                var el = q('dat-n-' + f.id);
                if (el && data.payload[f.id] != null) el.value = data.payload[f.id];
            });
        }
    }

    function prefillSprayForm(data) {
        var dateEl = q('dat-sl-date');
        if (dateEl && data.date) dateEl.value = data.date;

        var catEl = q('dat-sl-cat');
        if (catEl && data.category && data.category !== '—') {
            catEl.value = data.category;
            updateSlProductField(data.category);
        }

        var productEl = q('dat-sl-product');
        if (productEl && data.product && data.product !== '—') {
            if (productEl.tagName === 'SELECT') {
                productEl.value = data.product;
                if (productEl.value !== data.product) {
                    productEl.value = '__other__';
                    var customEl = q('dat-sl-product-custom');
                    if (customEl) { customEl.value = data.product; customEl.style.display = ''; }
                }
            } else {
                productEl.value = data.product;
            }
        }

        var aiEl = q('dat-sl-ai');
        if (aiEl) aiEl.value = data.active_ingredient || '';

        var rateEl = q('dat-sl-rate');
        if (rateEl && data.rate != null) rateEl.value = data.rate;

        var unitEl = q('dat-sl-unit');
        if (unitEl && data.rate_unit) unitEl.value = data.rate_unit;

        var targetEl = q('dat-sl-target');
        if (targetEl) targetEl.value = data.target || '';

        var notesEl = q('dat-sl-notes');
        if (notesEl) notesEl.value = data.notes || '';

        if (data.zone && data.zone !== '—') {
            document.querySelectorAll('.dat-zone-pill').forEach(function (pill) {
                if (pill.dataset.zone === data.zone.toLowerCase()) pill.classList.add('sel');
            });
        }
    }

    function buildUploadTab() {
        var html = '<div class="dat-upload-zone" id="dat-drop-zone">'
            + '<div class="dat-upload-zone-icon"><svg width="32" height="32" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5"/></svg></div>'
            + '<div class="dat-upload-zone-text">Drop your CSV file here or click to browse</div>'
            + '<div class="dat-upload-zone-sub">Supports CSV format from any lab</div>'
            + '</div>'
            + '<input type="file" id="dat-csv-file" accept=".csv" style="display:none">'
            + '<div id="dat-upload-result"></div>';
        return html;
    }

    function buildManualTab(def) {
        var zoneOpts = ZONES.map(function(z) {
            return '<option value="' + z + '">' + z + '</option>';
        }).join('');

        // Meta fields
        var metaHTML = '<div class="dat-mf-grid">';
        def.meta.forEach(function(f) {
            metaHTML += '<div class="dat-mf-field">';
            metaHTML += '<label class="dat-mf-label">' + esc(f.label) + '</label>';
            if (f.type === 'zone') {
                metaHTML += '<select class="dat-mf-select" id="dat-f-' + f.id + '"><option value="">— Select zone type —</option>' + zoneOpts + '</select>';
            } else if (f.type === 'zone-name') {
                if (ZONE_NAMES.length) {
                    var znOpts = ZONE_NAMES.map(function(n) { return '<option value="' + esc(n) + '">' + esc(n) + '</option>'; }).join('');
                    metaHTML += '<select class="dat-mf-select" id="dat-f-' + f.id + '"><option value="">— Select zone name —</option>' + znOpts + '</select>';
                    metaHTML += '<div style="margin-top:6px;display:flex;gap:6px;align-items:center">'
                        + '<input type="text" class="dat-mf-input" id="dat-new-zone-input" placeholder="Or add new zone…" style="flex:1;margin:0;font-size:12px">'
                        + '<button type="button" id="dat-add-zone-btn" style="flex-shrink:0;padding:6px 10px;background:var(--gaip-accent,#2d6a4f);color:#fff;border:none;border-radius:6px;cursor:pointer;font-size:12px">Add</button>'
                        + '</div>';
                } else {
                    metaHTML += '<input type="text" class="dat-mf-input" id="dat-f-' + f.id + '" placeholder="' + esc(f.placeholder||'') + '">';
                }
            } else if (f.type === 'date') {
                metaHTML += '<input type="date" class="dat-mf-input" id="dat-f-' + f.id + '" value="' + todayISO() + '">';
            } else {
                metaHTML += '<input type="text" class="dat-mf-input" id="dat-f-' + f.id + '" placeholder="' + esc(f.placeholder||'') + '">';
            }
            metaHTML += '</div>';
        });
        metaHTML += '</div>';

        // Nutrient fields
        var nutHTML = '<div class="dat-mf-grid g3">';
        nutHTML += '<div class="dat-mf-sec">Measurements</div>';
        def.nutrients.forEach(function(f) {
            nutHTML += '<div class="dat-mf-field">';
            var lbl = esc(f.label) + (f.unit ? ' <span style="font-weight:400;text-transform:none">(' + esc(f.unit) + ')</span>' : '');
            nutHTML += '<label class="dat-mf-label">' + lbl + '</label>';
            nutHTML += '<input type="number" step="any" class="dat-mf-input" id="dat-n-' + f.id + '" placeholder="' + esc(f.placeholder||'') + '">';
            nutHTML += '</div>';
        });
        nutHTML += '</div>';

        // Notes
        var notesHTML = '<div class="dat-mf-field"><label class="dat-mf-label">Notes</label><textarea class="dat-mf-textarea" id="dat-f-notes" rows="2"></textarea></div>';

        return metaHTML + nutHTML + notesHTML;
    }

    // ── Spray log form builder ────────────────────────────────────
    function buildSprayBody() {
        var catOpts = SPRAY_CATS.map(function(c) {
            return '<option value="' + c.id + '">' + esc(c.label) + '</option>';
        }).join('');
        var unitOpts = RATE_UNITS.map(function(u) {
            return '<option value="' + u + '">' + esc(u) + '</option>';
        }).join('');
        var zonePills = ZONES.map(function(z) {
            return '<span class="dat-zone-pill" data-zone="' + z.toLowerCase() + '">' + esc(z) + '</span>';
        }).join('');

        return '<div class="dat-mf-grid">'
            + '<div class="dat-mf-field"><label class="dat-mf-label">Date</label><input type="date" class="dat-mf-input" id="dat-sl-date" value="' + todayISO() + '"></div>'
            + '<div class="dat-mf-field"><label class="dat-mf-label">Category</label><select class="dat-mf-select" id="dat-sl-cat">' + catOpts + '</select></div>'
            + '<div class="dat-mf-field dat-mf-full"><label class="dat-mf-label">Product</label><div id="dat-sl-product-wrap">' + renderSlProductField('fungicide') + '</div></div>'
            + '<div class="dat-mf-field dat-mf-full"><label class="dat-mf-label">Active Ingredient</label><input type="text" class="dat-mf-input" id="dat-sl-ai" placeholder="e.g. azoxystrobin"></div>'
            + '<div class="dat-mf-field"><label class="dat-mf-label">Rate</label><input type="number" step="any" class="dat-mf-input" id="dat-sl-rate" placeholder="0.0"></div>'
            + '<div class="dat-mf-field"><label class="dat-mf-label">Unit</label><select class="dat-mf-select" id="dat-sl-unit">' + unitOpts + '</select></div>'
            + '<div class="dat-mf-field dat-mf-full"><label class="dat-mf-label">Target (pest / disease)</label><input type="text" class="dat-mf-input" id="dat-sl-target" placeholder="e.g. Dollar Spot"></div>'
            + '</div>'
            + '<div class="dat-mf-field" style="margin-bottom:12px"><label class="dat-mf-label">Zone type</label><div class="dat-zone-pills" id="dat-sl-zones">' + zonePills + '</div></div>'
            + '<div class="dat-mf-field"><label class="dat-mf-label">Notes</label><textarea class="dat-mf-textarea" id="dat-sl-notes" rows="2"></textarea></div>';
    }

    // ── Wire modal events ─────────────────────────────────────────
    function addZoneToSite(name) {
        name = (name || '').trim();
        if (!name) return;
        var btn = document.getElementById('dat-add-zone-btn');
        var sel = document.getElementById('dat-f-uid');

        var lowerName = name.toLowerCase();
        var exists = ZONE_NAMES.some(function(z) { return z.toLowerCase() === lowerName; });
        if (exists) {
            if (sel) {
                for (var i = 0; i < sel.options.length; i++) {
                    if (sel.options[i].value.toLowerCase() === lowerName) { sel.value = sel.options[i].value; break; }
                }
            }
            var inp0 = document.getElementById('dat-new-zone-input');
            if (inp0) inp0.value = '';
            return;
        }

        if (btn) { btn.disabled = true; btn.textContent = 'Saving…'; }
        var updated = ZONE_NAMES.concat([name]);
        fetch('/api/sites/' + SITE_ID, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json', 'Accept': 'application/json', 'X-CSRF-TOKEN': CSRF },
            body: JSON.stringify({ attributes_json: { zones: updated } })
        }).then(function(res) {
            if (!res.ok) throw new Error('HTTP ' + res.status);
            ZONE_NAMES = updated;
            if (sel) {
                var opt = document.createElement('option');
                opt.value = name;
                opt.textContent = name;
                sel.appendChild(opt);
                sel.value = name;
            }
            var inp = document.getElementById('dat-new-zone-input');
            if (inp) inp.value = '';
            if (btn) { btn.disabled = false; btn.textContent = 'Add'; }
        }).catch(function(e) {
            if (btn) { btn.disabled = false; btn.textContent = 'Add'; }
            setMsg('Could not save zone: ' + e.message, 'err');
        });
    }

    function wireModalBody() {
        // Tabs
        document.querySelectorAll('.dat-modal-tab').forEach(function(btn) {
            btn.addEventListener('click', function() {
                _activeTab = this.dataset.tab;
                _parsedCSV = null;
                q('dat-modal-body').innerHTML = buildLabBody();
                wireModalBody();
            });
        });

        // Category change → update product field
        var slCat = document.getElementById('dat-sl-cat');
        if (slCat) {
            slCat.addEventListener('change', function() { updateSlProductField(this.value); });
        }

        // Zone pills (spray log)
        document.querySelectorAll('.dat-zone-pill').forEach(function(pill) {
            pill.addEventListener('click', function() { this.classList.toggle('sel'); });
        });

        // Add new zone button
        var addZoneBtn = document.getElementById('dat-add-zone-btn');
        if (addZoneBtn) {
            addZoneBtn.addEventListener('click', function() {
                var inp = document.getElementById('dat-new-zone-input');
                if (inp) addZoneToSite(inp.value);
            });
        }
        var newZoneInput = document.getElementById('dat-new-zone-input');
        if (newZoneInput) {
            newZoneInput.addEventListener('keydown', function(e) {
                if (e.key === 'Enter') { e.preventDefault(); addZoneToSite(this.value); }
            });
        }

        // CSV drop zone
        var dropZone = q('dat-drop-zone');
        var fileInput = q('dat-csv-file');
        if (dropZone && fileInput) {
            dropZone.addEventListener('click', function() { fileInput.click(); });
            dropZone.addEventListener('dragover', function(e) { e.preventDefault(); this.classList.add('drag'); });
            dropZone.addEventListener('dragleave', function() { this.classList.remove('drag'); });
            dropZone.addEventListener('drop', function(e) {
                e.preventDefault(); this.classList.remove('drag');
                var file = e.dataTransfer.files[0];
                if (file) handleCSVFile(file);
            });
            fileInput.addEventListener('change', function() {
                if (this.files[0]) handleCSVFile(this.files[0]);
            });
        }
    }

    // ── Handle CSV file ───────────────────────────────────────────
    function handleCSVFile(file) {
        var resultEl = q('dat-upload-result');
        if (!resultEl) return;
        if (!file.name.toLowerCase().endsWith('.csv')) {
            resultEl.innerHTML = '<div class="dat-upload-msg err">Only CSV files are supported. Please save your spreadsheet as CSV and try again.</div>';
            return;
        }
        var reader = new FileReader();
        reader.onload = function(e) {
            try {
                var parsed = parseCSV(e.target.result);
                if (!parsed || !parsed.rows.length) {
                    resultEl.innerHTML = '<div class="dat-upload-msg err">CSV is empty or could not be parsed. Check the file and try again.</div>';
                    return;
                }
                var extracted = csvToPayload(SECTION, parsed.rows[0]);
                if (!extracted) {
                    resultEl.innerHTML = '<div class="dat-upload-msg err">No recognisable columns found. Check the file matches the expected format.</div>';
                    return;
                }
                extracted.payload['_source'] = file.name;
                _parsedCSV = extracted;
                var metaKeys = { '_label': true, '_source': true, '_zone': true, 'zone': true };
                var fieldCount = Object.keys(extracted.payload).filter(function(k) { return !metaKeys[k]; }).length;
                if (!fieldCount) {
                    resultEl.innerHTML = '<div class="dat-upload-msg err">No nutrient/measurement columns matched. Check column headers match the expected format.</div>';
                    return;
                }

                var previewRows = '';
                if (extracted.uid)  previewRows += '<div class="dat-upload-prev-row"><span class="dat-upload-prev-name">Zone name</span><span class="dat-upload-prev-val">' + esc(extracted.uid) + '</span></div>';
                if (extracted.date) previewRows += '<div class="dat-upload-prev-row"><span class="dat-upload-prev-name">Date</span><span class="dat-upload-prev-val">' + esc(extracted.date) + '</span></div>';
                if (extracted.lab)  previewRows += '<div class="dat-upload-prev-row"><span class="dat-upload-prev-name">Lab</span><span class="dat-upload-prev-val">' + esc(extracted.lab) + '</span></div>';
                Object.keys(extracted.payload).filter(function(k) { return !metaKeys[k]; }).slice(0, 12).forEach(function(key) {
                    previewRows += '<div class="dat-upload-prev-row"><span class="dat-upload-prev-name">' + esc(key) + '</span><span class="dat-upload-prev-val">' + esc(extracted.payload[key]) + '</span></div>';
                });
                var extraCount = Object.keys(extracted.payload).filter(function(k) { return !metaKeys[k]; }).length - 12;
                if (extraCount > 0) {
                    previewRows += '<div class="dat-upload-prev-row"><span class="dat-upload-prev-name" style="color:var(--gaip-text-muted)">+ ' + extraCount + ' more fields…</span></div>';
                }
                var rowLabel = parsed.rows.length > 1 ? (parsed.rows.length + ' rows — using row 1') : '1 row';
                resultEl.innerHTML = '<div class="dat-upload-msg ok">✓ Parsed successfully · ' + fieldCount + ' fields · ' + rowLabel + '</div>'
                    + '<div class="dat-mf-field" style="margin:10px 0 4px"><label class="dat-mf-label">Source file name</label>'
                    + '<input type="text" class="dat-mf-input" id="dat-upload-source" value="' + esc(file.name) + '"></div>'
                    + '<div class="dat-upload-preview"><div class="dat-upload-prev-title">Preview — Row 1</div>' + previewRows + '</div>';
            } catch(err) {
                resultEl.innerHTML = '<div class="dat-upload-msg err">Parse error: ' + esc(err.message) + '</div>';
            }
        };
        reader.readAsText(file);
    }

    // ── Collect form data ─────────────────────────────────────────
    function collectLabData() {
        if (_activeTab === 'upload') {
            if (!_parsedCSV) { setMsg('Please upload and parse a CSV file first.', 'err'); return null; }
            var sourceInput = document.getElementById('dat-upload-source');
            if (sourceInput && sourceInput.value.trim()) {
                _parsedCSV.payload['_source'] = sourceInput.value.trim();
            }
            return {
                sample_type: SECTION,
                site_id: SITE_ID,
                client_uid: _parsedCSV.uid || null,
                lab_name:   _parsedCSV.lab || null,
                lab_date:   _parsedCSV.date || null,
                payload:    _parsedCSV.payload,
            };
        }
        // Manual tab
        var def = MANUAL_FORMS[SECTION];
        var payload = {};
        def.nutrients.forEach(function(f) {
            var el = q('dat-n-' + f.id);
            if (el && el.value.trim() !== '') payload[f.id] = el.value.trim();
        });
        var zoneEl = q('dat-f-zone');
        if (zoneEl && zoneEl.value) payload.zone = zoneEl.value;

        var source= (q('dat-f-source') || {}).value || null;
        var uid   = (q('dat-f-uid')    || {}).value || '';
        var date  = (q('dat-f-date')   || {}).value || null;
        var lab   = (q('dat-f-lab')    || {}).value || null;
        var labRef= (q('dat-f-labref') || {}).value || null;
        var notes = (q('dat-f-notes')  || {}).value || null;

        if (source) payload['_source'] = source;
        if (uid) {
            payload['_label'] = uid;
        }

        if (!uid && !Object.keys(payload).length) {
            setMsg('Please enter at least a zone name or some measurements.', 'err');
            return null;
        }

        return {
            sample_type: SECTION,
            site_id: SITE_ID,
            client_uid: null,
            lab_name:   lab  || null,
            lab_ref:    labRef || null,
            lab_date:   date || null,
            sample_date:date || null,
            payload:    payload,
            notes:      notes,
        };
    }

    function collectSprayData() {
        var productEl  = q('dat-sl-product');
        var customEl   = q('dat-sl-product-custom');
        var product    = productEl ? productEl.value : '';
        if (product === '__other__') product = customEl ? customEl.value : '';
        var date    = (q('dat-sl-date') || {}).value || '';
        if (!product.trim()) { setMsg('Product name is required.', 'err'); return null; }
        if (!date)           { setMsg('Date is required.', 'err'); return null; }

        var selectedZones = [];
        document.querySelectorAll('.dat-zone-pill.sel').forEach(function(pill) {
            selectedZones.push(pill.dataset.zone);
        });
        if (!selectedZones.length) { setMsg('Please select at least one zone.', 'err'); return null; }

        var rate = (q('dat-sl-rate') || {}).value;

        return {
            site_id:           SITE_ID,
            application_date:  date,
            product_name:      product.trim(),
            product_category:  (q('dat-sl-cat')    || {}).value || 'other',
            active_ingredient: ((q('dat-sl-ai')     || {}).value || '').trim() || null,
            rate:              rate ? parseFloat(rate) : null,
            rate_unit:         (q('dat-sl-unit')   || {}).value || null,
            target:            ((q('dat-sl-target') || {}).value || '').trim() || null,
            notes:             ((q('dat-sl-notes')  || {}).value || '').trim() || null,
            source: 'manual',
            zones: selectedZones,
        };
    }

    // ── Submit ────────────────────────────────────────────────────
    async function handleSave() {
        setMsg('');
        var saveBtn = q('dat-modal-save');
        if (saveBtn) { saveBtn.disabled = true; saveBtn.textContent = 'Saving…'; }

        try {
            var data, url, method;
            if (_editingId) {
                if (SECTION === 'spray-log') {
                    var raw = collectSprayData();
                    if (!raw) {
                        if (saveBtn) { saveBtn.disabled = false; saveBtn.textContent = 'Save'; }
                        return;
                    }
                    data = {
                        application_date:  raw.application_date,
                        product_name:      raw.product_name,
                        product_category:  raw.product_category,
                        active_ingredient: raw.active_ingredient,
                        rate:              raw.rate,
                        rate_unit:         raw.rate_unit,
                        target:            raw.target,
                        notes:             raw.notes,
                        zone:              (raw.zones && raw.zones[0]) || null,
                    };
                    url    = '/api/spray-log/' + _editingId;
                    method = 'PUT';
                } else {
                    data = collectLabData();
                    if (!data) {
                        if (saveBtn) { saveBtn.disabled = false; saveBtn.textContent = 'Save'; }
                        return;
                    }
                    url    = '/api/samples/' + _editingId;
                    method = 'PATCH';
                }
            } else {
                if (SECTION === 'spray-log') {
                    data = collectSprayData();
                    url  = '/api/spray-log';
                } else {
                    data = collectLabData();
                    url  = '/api/samples';
                }
                method = 'POST';
                if (!data) {
                    if (saveBtn) { saveBtn.disabled = false; saveBtn.textContent = 'Save'; }
                    return;
                }
            }

            var r = await fetch(url, {
                method: method,
                credentials: 'same-origin',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                    'X-CSRF-TOKEN': CSRF,
                },
                body: JSON.stringify(data),
            });

            var json;
            try { json = await r.json(); } catch(_) { json = {}; }

            if (r.ok) {
                closeModal();
                window.location.reload();
            } else {
                var errMsg = json.message || json.error || (json.errors ? Object.values(json.errors).flat().join('; ') : 'Save failed (HTTP ' + r.status + ')');
                setMsg(errMsg, 'err');
                if (saveBtn) { saveBtn.disabled = false; saveBtn.textContent = 'Save'; }
            }
        } catch(err) {
            setMsg('Network error: ' + err.message, 'err');
            if (saveBtn) { saveBtn.disabled = false; saveBtn.textContent = 'Save'; }
        }
    }

    // ── Bootstrap ─────────────────────────────────────────────────
    function init() {
        var addBtn    = q('dat-add-btn');
        var closeBtn  = q('dat-modal-close');
        var cancelBtn = q('dat-modal-cancel');
        var saveBtn   = q('dat-modal-save');
        var overlay   = q('dat-add-modal');

        if (addBtn)    addBtn.addEventListener('click', openModal);
        if (closeBtn)  closeBtn.addEventListener('click', closeModal);
        if (cancelBtn) cancelBtn.addEventListener('click', closeModal);
        if (saveBtn)   saveBtn.addEventListener('click', handleSave);
        if (overlay)   overlay.addEventListener('click', function(e) {
            if (e.target === overlay) closeModal();
        });
        document.addEventListener('keydown', function(e) {
            if (e.key === 'Escape' && overlay && overlay.style.display !== 'none') closeModal();
        });

        // Auto-open modal with pre-selected category from query param (?category=pgr)
        if (SECTION === 'spray-log') {
            var _qs = new URLSearchParams(window.location.search);
            var _cat = _qs.get('category');
            if (_cat) {
                // Remove ?category= from URL so page reload after save doesn't re-open modal
                _qs.delete('category');
                var _newUrl = window.location.pathname + (_qs.toString() ? '?' + _qs.toString() : '');
                window.history.replaceState(null, '', _newUrl);

                openModal();
                var _catEl = document.getElementById('dat-sl-cat');
                if (_catEl) {
                    _catEl.value = _cat;
                    updateSlProductField(_cat);
                }
            }
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
}());
</script>
@endif

@if($section === 'sensors')
<script>
(function () {
    'use strict';

    var CSRF    = (document.querySelector('meta[name="csrf-token"]') || {}).content || '';
    var SITE_ID = '{{ $activeSite?->id ?? 'default' }}';

    // ── localStorage helpers ─────────────────────────────────────────────
    function lsGet(key) { try { return localStorage.getItem(key); } catch (e) { return null; } }
    function lsSet(key, val) { try { localStorage.setItem(key, val); return true; } catch (e) { return false; } }
    function lsJson(key) { var raw = lsGet(key); if (!raw) return null; try { return JSON.parse(raw); } catch (e) { return null; } }

    function hsKey() { return 'gaip_hydrosight_config_' + SITE_ID; }
    function scKey() { return 'gilba_specconnect_config'; }
    function hsLoad() { return lsJson(hsKey()) || {}; }
    function scLoad() { return lsJson(scKey()) || {}; }

    // ── Proxy call ───────────────────────────────────────────────────────
    async function proxyCall(provider, endpoint, apiKey) {
        var url = '/api/sensors/' + provider + '/proxy';
        var r;
        try {
            r = await fetch(url, {
                method: 'POST',
                credentials: 'same-origin',
                headers: { 'Content-Type': 'application/json', 'Accept': 'application/json', 'X-CSRF-TOKEN': CSRF },
                body: JSON.stringify({ endpoint: endpoint, api_key: apiKey }),
            });
        } catch (networkErr) {
            throw new Error('Network error — check your connection.');
        }
        if (r.status === 419) throw new Error('Session expired — please refresh the page.');
        if (r.status === 401) throw new Error('Not authenticated — please log in again.');
        if (r.status === 403) throw new Error('Request blocked (403) — please refresh the page and try again.');
        var text = await r.text();
        var json;
        try { json = JSON.parse(text); } catch (_) {
            throw new Error('Unexpected response (HTTP ' + r.status + ') — please refresh the page.');
        }
        if (!json.success) {
            var errMsg = (json.data && json.data.message) ? json.data.message : ('HTTP ' + r.status);
            throw new Error(errMsg);
        }
        return json.data;
    }

    // ── Time ago helper ──────────────────────────────────────────────────
    function timeAgo(ts) {
        if (!ts) return '';
        var mins = Math.round((Date.now() - ts) / 60000);
        if (mins < 1)  return 'just now';
        if (mins < 60) return mins + 'm ago';
        var hrs = Math.round(mins / 60);
        if (hrs < 24)  return hrs + 'h ago';
        return Math.round(hrs / 24) + 'd ago';
    }

    function esc(s) {
        return String(s == null ? '' : s)
            .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
    }

    // ── Provider status bar ──────────────────────────────────────────────
    function updateProviderStatus() {
        var hsCfg = hsLoad();
        var scCfg = scLoad();
        var hsOn  = !!(hsCfg.keyConfigured || hsCfg.apiKey);
        var scOn  = !!(scCfg.apiKey);

        var hsDot    = document.getElementById('dat-hs-dot');
        var hsStatus = document.getElementById('dat-hs-status');
        var scDot    = document.getElementById('dat-sc-dot');
        var scStatus = document.getElementById('dat-sc-status');

        if (hsDot)    hsDot.className      = 'sens-pstatus-dot' + (hsOn ? ' active' : '');
        if (hsStatus) hsStatus.textContent = hsOn ? 'Connected' : 'Not configured';
        if (scDot)    scDot.className      = 'sens-pstatus-dot' + (scOn ? ' active' : '');
        if (scStatus) scStatus.textContent = scOn ? 'Connected' : 'Not configured';

        return hsOn || scOn;
    }

    // ── Live Readings ────────────────────────────────────────────────────
    function updateReadingsSection() {
        var hasAny  = updateProviderStatus();
        var section = document.getElementById('sens-readings');
        var empty   = document.getElementById('sens-no-integration');
        if (section) section.style.display = hasAny ? '' : 'none';
        if (empty)   empty.style.display   = hasAny ? 'none' : '';
        if (hasAny) renderZoneGrid();
    }

    function renderZoneGrid() {
        var grid    = document.getElementById('sens-zone-grid');
        var updated = document.getElementById('sens-last-updated');
        if (!grid) return;

        var hsCfg    = hsLoad();
        var zoneMap  = hsCfg.sensorZoneMapping || {};
        var excluded = hsCfg.excludedSensors   || {};

        var readingsCache = lsJson('gaip_hydrosight_readings_cache_' + SITE_ID) || {};
        var readings = readingsCache.data || [];
        var lastFetch = lsJson('gilba_sensor_last_fetch');
        var ts = readingsCache.timestamp || (lastFetch && lastFetch.fetchedAt ? new Date(lastFetch.fetchedAt).getTime() : 0);
        if (updated) updated.textContent = ts ? '— ' + timeAgo(ts) : '';

        var zones = {};
        readings.forEach(function (r) {
            if (excluded[r.sensorId]) return;
            var z = zoneMap[r.sensorId] || r.zone || 'Other';
            if (!zones[z]) zones[z] = { sensors: [], vwcVals: [], ecVals: [], tmpVals: [] };
            zones[z].sensors.push(r);
            if (r.vwc      != null) zones[z].vwcVals.push(r.vwc);
            if (r.ec       != null) zones[z].ecVals.push(r.ec);
            if (r.soilTemp != null) zones[z].tmpVals.push(r.soilTemp);
        });

        var avg = function (arr) { return arr.length ? arr.reduce(function (a, b) { return a + b; }, 0) / arr.length : null; };

        var zoneOrder = ['Greens','Fairways','Tees','Roughs','Other'];
        var rendered  = zoneOrder.filter(function (z) { return zones[z] && zones[z].vwcVals.length; });

        if (!rendered.length) {
            grid.innerHTML = '<div class="sens-no-readings">No readings cached yet — click Refresh to fetch live data.</div>';
            return;
        }

        grid.innerHTML = rendered.map(function (z) {
            var zd       = zones[z];
            var vwc      = avg(zd.vwcVals);
            var ec       = avg(zd.ecVals);
            var tmp      = avg(zd.tmpVals);
            var sorted = zd.sensors.slice().sort(function (a, b) {
                return (a.name || a.sensorId || '').localeCompare(b.name || b.sensorId || '');
            });

            var sensorRows = sorted.map(function (r) {
                var sVwc   = r.vwc      != null ? r.vwc.toFixed(1)     : '—';
                var sTmp   = r.soilTemp != null ? r.soilTemp.toFixed(1) : '—';
                var dotCls = r.vwc != null ? ' live' : '';
                return '<div class="sens-zone-sensor">'
                    + '<span class="sens-sensor-dot' + dotCls + '"></span>'
                    + '<span class="sens-zone-sensor-name">' + esc(r.name || r.sensorId || '—') + '</span>'
                    + '<span class="sens-zone-sensor-vwc">' + sVwc + '%</span>'
                    + '<span class="sens-zone-sensor-tmp">' + sTmp + '°C</span>'
                    + '</div>';
            }).join('');

            var avgMeta = '<span class="sens-zone-avg-vwc">'
                + (vwc != null ? vwc.toFixed(1) + '%' : '—') + '</span>'
                + (tmp != null ? '<span class="sens-zone-avg-tmp">' + tmp.toFixed(1) + '°C</span>' : '');

            var colHeads = '<div class="sens-zone-col-heads">'
                + '<span></span>'
                + '<span class="sens-zone-col-sensor">Sensor</span>'
                + '<span>VWC</span>'
                + '<span>Temp</span>'
                + '</div>';

            return '<div class="sens-zone-card">'
                + '<div class="sens-zone-header">'
                + '<div class="sens-zone-label">' + esc(z) + ' <span class="sens-zone-count">(' + zd.sensors.length + ' sensor' + (zd.sensors.length !== 1 ? 's' : '') + ')</span></div>'
                + '<div class="sens-zone-avg">' + avgMeta + '<span class="sens-zone-avg-tag">avg</span></div>'
                + '</div>'
                + colHeads
                + '<div class="sens-zone-sensors">' + sensorRows + '</div>'
                + '</div>';
        }).join('');
    }

    async function refreshReadings() {
        var btn    = document.getElementById('sens-refresh-btn');
        var hsCfg  = hsLoad();
        var apiKey = hsCfg.apiKey;

        if (btn) { btn.disabled = true; btn.querySelector('svg') && (btn.style.opacity = '0.5'); }

        if (apiKey) {
            try {
                var listData = await proxyCall('hydrosight', '/sensors', apiKey);
                var sensors  = (listData && listData.items) || [];
                var readings = [];
                for (var i = 0; i < sensors.length; i++) {
                    var s = sensors[i];
                    try {
                        var detail = await proxyCall('hydrosight', '/sensors/' + encodeURIComponent(s.sensorId), apiKey);
                        var lr  = detail.lastReadings || {};
                        var vwc = parseFloat(lr.moisture);
                        var ec  = parseFloat(lr.ec);
                        var tmp = parseFloat(lr.temperature);
                        console.log('[Hydrosight] sensor', detail.sensorId || s.sensorId, '| raw lastReadings:', lr, '| parsed vwc:', vwc);
                        readings.push({
                            sensorId: detail.sensorId || s.sensorId,
                            name:     detail.name || s.name || s.sensorId,
                            vwc:      isNaN(vwc) ? null : vwc,
                            ec:       isNaN(ec)  ? null : ec,
                            soilTemp: isNaN(tmp) ? null : tmp,
                            zone:     (hsCfg.sensorZoneMapping || {})[s.sensorId] || null,
                        });
                    } catch (_) {
                        readings.push({ sensorId: s.sensorId, name: s.name || s.sensorId, vwc: null, ec: null, soilTemp: null });
                    }
                }
                lsSet('gaip_hydrosight_readings_cache_' + SITE_ID, JSON.stringify({ timestamp: Date.now(), data: readings }));
                lsSet('gilba_sensor_last_fetch', JSON.stringify({
                    fetchedAt: new Date().toISOString(), provider: 'Hydrosight', locations: readings
                }));
            } catch (e) {
                console.warn('[Sensors] Hydrosight refresh failed:', e.message);
            }
        }

        renderZoneGrid();
        if (btn) { btn.disabled = false; btn.style.opacity = ''; }
    }

    // ── TDR glossary entries ─────────────────────────────────────────────
    window.GAIP_GLOSSARY = window.GAIP_GLOSSARY || {};
    window.GAIP_GLOSSARY['tdr-status']   = { title: 'Irrigation Status', body: 'Urgency based on measured VWC:\n\nCritical — below 14% (near wilting point, irrigate immediately)\nNeeded — 14–20% (below trigger threshold)\nSoon — 20–28% (approaching trigger)\nOK — 28–40% (adequate moisture)\nWet — above 40% (at or above field capacity)' };
    window.GAIP_GLOSSARY['tdr-required'] = { title: 'Required (mm)', body: 'Estimated millimetres of water needed to return to field capacity (30% VWC).\n\nAssumes 100mm root depth. Formula: (30% − current VWC) × root depth.' };

    // ── TDR 350/300 ──────────────────────────────────────────────────────
    function tdrKey() { return 'gaip_tdr_session_' + SITE_ID; }
    function tdrLoad() { return lsJson(tdrKey()); }

    function splitCsvRow(line) {
        var cols = [], cur = '', inQ = false;
        for (var i = 0; i < line.length; i++) {
            var c = line[i];
            if (c === '"') { inQ = !inQ; }
            else if (c === ',' && !inQ) { cols.push(cur.trim()); cur = ''; }
            else { cur += c; }
        }
        cols.push(cur.trim());
        return cols;
    }

    function parseTdrCsv(text) {
        var lines = text.trim().split(/\r?\n/);
        if (lines.length < 2) return null;
        var headers = lines[0].split(',').map(function (h) { return h.trim().replace(/^"|"$/g, '').toLowerCase(); });
        var isFieldScout = headers.some(function (h) { return h === 'vwc%' || h === 'temp_soil'; });

        function findCol() {
            var terms = Array.prototype.slice.call(arguments);
            return headers.findIndex(function (h) { return terms.some(function (t) { return h.indexOf(t) !== -1; }); });
        }

        var idxVwc  = isFieldScout ? headers.indexOf('vwc%')     : findCol('vwc', 'moisture');
        var idxEc   = findCol('ec');
        var idxTemp = isFieldScout ? findCol('temp_soil')        : findCol('temp');
        var idxZone = isFieldScout ? -1                          : findCol('zone', 'location', 'area', 'section');
        if (idxVwc === -1) return null;

        var zones = {}, rowCount = 0;
        var avg   = function (arr) { return arr.length ? arr.reduce(function (a, b) { return a + b; }, 0) / arr.length : null; };

        for (var i = 1; i < lines.length; i++) {
            var line = lines[i].trim();
            if (!line) continue;
            var cols = splitCsvRow(line);
            var vwc  = parseFloat(cols[idxVwc]);
            if (isNaN(vwc) || vwc < 0 || vwc > 100) continue;
            var ec   = idxEc   >= 0 ? parseFloat(cols[idxEc])   : NaN;
            var temp = idxTemp >= 0 ? parseFloat(cols[idxTemp]) : NaN;
            var zone = (idxZone >= 0 && cols[idxZone] ? cols[idxZone].trim() : '') || 'All zones';
            if (!isNaN(ec) && ec > 10) ec = ec / 10;
            if (!zones[zone]) zones[zone] = { vwcVals: [], ecVals: [], tmpVals: [] };
            zones[zone].vwcVals.push(vwc);
            if (!isNaN(ec))   zones[zone].ecVals.push(ec);
            if (!isNaN(temp)) zones[zone].tmpVals.push(temp);
            rowCount++;
        }
        if (!rowCount) return null;

        return {
            source:     isFieldScout ? 'FieldScout' : 'TDR 350/300',
            importedAt: Date.now(),
            rowCount:   rowCount,
            zones: Object.keys(zones).map(function (name) {
                var z = zones[name];
                return { name: name, vwc: avg(z.vwcVals), vwcMin: Math.min.apply(null, z.vwcVals), vwcMax: Math.max.apply(null, z.vwcVals), ec: avg(z.ecVals), temp: avg(z.tmpVals), count: z.vwcVals.length };
            }),
        };
    }

    function tdrIrrigationStatus(vwc) {
        if (vwc === null) return { text: '—', cls: '' };
        if (vwc >= 40)  return { text: 'Wet',      cls: 'tdr-status-wet' };
        if (vwc >= 28)  return { text: 'OK',        cls: 'tdr-status-ok' };
        if (vwc >= 20)  return { text: 'Soon',      cls: 'tdr-status-soon' };
        if (vwc >= 14)  return { text: 'Needed',    cls: 'tdr-status-needed' };
        return                 { text: 'Critical',  cls: 'tdr-status-critical' };
    }

    function tdrRequiredMm(vwc) {
        if (vwc === null || vwc >= 30) return '—';
        var mm = Math.round((30 - vwc) * 10) / 10;
        return mm > 0 ? mm + ' mm' : '—';
    }

    function renderTdrSection(data) {
        var dot      = document.getElementById('dat-tdr-dot');
        var statusEl = document.getElementById('dat-tdr-status');
        var dropZone = document.getElementById('tdr-drop-zone');
        var results  = document.getElementById('tdr-results');
        var clearBtn = document.getElementById('tdr-clear-btn');
        var lastEl   = document.getElementById('tdr-last-updated');

        if (!data) {
            if (dot)      dot.className         = 'sens-pstatus-dot';
            if (statusEl) statusEl.textContent  = 'No import';
            if (dropZone) dropZone.style.display = '';
            if (results)  results.style.display  = 'none';
            if (clearBtn) clearBtn.style.display  = 'none';
            if (lastEl)   lastEl.textContent     = '';
            return;
        }

        if (dot)      dot.className        = 'sens-pstatus-dot active';
        if (statusEl) statusEl.textContent = data.rowCount + ' readings · ' + data.zones.length + ' zone' + (data.zones.length !== 1 ? 's' : '');
        if (lastEl)   lastEl.textContent   = '— ' + timeAgo(data.importedAt);
        if (dropZone) dropZone.style.display = 'none';
        if (clearBtn) clearBtn.style.display = '';
        if (!results) return;
        results.style.display = '';

        var devHeader = document.getElementById('tdr-device-header');
        if (devHeader) devHeader.innerHTML = '<span class="tdr-device-badge">' + esc(data.source) + '</span>';

        var tbody = document.getElementById('tdr-zone-tbody');
        if (!tbody) return;
        tbody.innerHTML = data.zones.map(function (z) {
            var st  = tdrIrrigationStatus(z.vwc);
            var req = tdrRequiredMm(z.vwc);
            var badge = st.cls ? '<span class="tdr-status-badge ' + st.cls + '">' + st.text + '</span>' : st.text;
            return '<tr>'
                + '<td><strong>' + esc(z.name) + '</strong><br><span style="font-size:11px;color:var(--gaip-text-muted)">' + z.count + ' reading' + (z.count !== 1 ? 's' : '') + '</span></td>'
                + '<td class="dat-td-num">' + (z.vwc  != null ? z.vwc.toFixed(1) + '%'   : '—') + '</td>'
                + '<td class="dat-td-num">' + (z.ec   != null ? z.ec.toFixed(2) + ' dS/m' : '—') + '</td>'
                + '<td class="dat-td-num">' + (z.temp != null ? z.temp.toFixed(1) + '°'   : '—') + '</td>'
                + '<td>' + badge + '</td>'
                + '<td class="dat-td-num">' + req + '</td>'
                + '</tr>';
        }).join('');
    }

    function handleTdrFile(file) {
        if (!file || !file.name.toLowerCase().endsWith('.csv')) {
            alert('Please select a CSV file exported from FieldScout TDR 350/300 or compatible device.');
            return;
        }
        var reader = new FileReader();
        reader.onload = function (e) {
            var data = parseTdrCsv(e.target.result);
            if (!data || !data.zones.length) {
                alert('Could not parse sensor data. Make sure this is a FieldScout TDR 350/300 CSV export with a VWC column.');
                return;
            }
            lsSet(tdrKey(), JSON.stringify(data));
            renderTdrSection(data);
        };
        reader.readAsText(file);
    }

    // ── Init ─────────────────────────────────────────────────────────────
    function init() {
        updateReadingsSection();
        var refresh = document.getElementById('sens-refresh-btn');
        if (refresh) refresh.addEventListener('click', refreshReadings);

        // TDR
        renderTdrSection(tdrLoad());
        var fileInput = document.getElementById('tdr-file-input');
        var dropZone  = document.getElementById('tdr-drop-zone');
        var clearBtn  = document.getElementById('tdr-clear-btn');

        if (fileInput) fileInput.addEventListener('change', function () {
            if (fileInput.files[0]) handleTdrFile(fileInput.files[0]);
            fileInput.value = '';
        });
        if (dropZone) {
            dropZone.addEventListener('click',     function ()  { if (fileInput) fileInput.click(); });
            dropZone.addEventListener('dragover',  function (e) { e.preventDefault(); dropZone.classList.add('drag-over'); });
            dropZone.addEventListener('dragleave', function ()  { dropZone.classList.remove('drag-over'); });
            dropZone.addEventListener('drop',      function (e) {
                e.preventDefault(); dropZone.classList.remove('drag-over');
                var f = e.dataTransfer && e.dataTransfer.files[0];
                if (f) handleTdrFile(f);
            });
        }
        if (clearBtn) clearBtn.addEventListener('click', function () {
            if (!confirm('Clear TDR session data?')) return;
            try { localStorage.removeItem(tdrKey()); } catch (_) {}
            renderTdrSection(null);
        });

    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
}());
</script>
@endif

@if($section === 'soil')
<script>
(function () {
    var CSRF = (document.querySelector('meta[name="csrf-token"]') || {}).content || '';

    var areaBtn    = document.getElementById('dat-area-btn');
    var modal      = document.getElementById('dat-area-modal');
    var modalBody  = document.getElementById('dat-area-modal-body');
    var modalMsg   = document.getElementById('dat-area-modal-msg');
    var closeBtn   = document.getElementById('dat-area-modal-close');
    var cancelBtn  = document.getElementById('dat-area-modal-cancel');
    var applyBtn   = document.getElementById('dat-area-modal-apply');

    if (!areaBtn || !modal) return;

    var GROUP_LABELS = {
        green: 'Greens', fairway: 'Fairways', tee: 'Tees', rough: 'Rough',
        approach: 'Approaches', collar: 'Collars', bunker: 'Bunkers',
        sports_pitch: 'Sports Pitches', goal_area: 'Goal Areas', other: 'Other'
    };
    var GROUP_HINTS = {
        green: '0.04–0.09 ha typical per green',
        fairway: '1.5–5 ha typical per fairway',
        tee: '0.02–0.1 ha typical',
        rough: '1–10 ha typical',
        other: '0.5 ha default'
    };

    function collectRows() {
        var rows = [];
        document.querySelectorAll('#dat-table .dat-row').forEach(function (tr) {
            var d = {};
            try { d = JSON.parse(tr.dataset.row || '{}'); } catch (_) {}
            if (!d.id) return;
            var pl = d.payload || {};
            // Use zone name as display label (e.g. "Green 4"), fall back to client_uid
            var displayName = (d.zone && d.zone !== '—') ? d.zone : (d.name || '—');
            // Zone type: prefer payload._zone, then detect from zone string
            var zt = (pl._zone || pl.zoneType || '').toLowerCase();
            if (!zt) {
                var zl = (d.zone || '').toLowerCase();
                zt = zl.startsWith('green') ? 'green'
                   : zl.startsWith('fair')  ? 'fairway'
                   : zl.startsWith('tee')   ? 'tee'
                   : zl.startsWith('rough') ? 'rough'
                   : zl.startsWith('approach') ? 'approach'
                   : zl.startsWith('collar')   ? 'collar'
                   : zl.startsWith('bunker')   ? 'bunker'
                   : 'other';
            }
            rows.push({
                id: d.id,
                name: displayName,
                zone: d.zone || '—',
                zoneType: zt,
                payload: pl,
                currentArea: parseFloat(pl.areaHa) || null,
            });
        });
        return rows;
    }

    function renderModal(rows) {
        var grouped = {};
        rows.forEach(function (r) {
            if (!grouped[r.zoneType]) grouped[r.zoneType] = [];
            grouped[r.zoneType].push(r);
        });
        var zoneTypes = Object.keys(grouped);
        var missing = rows.filter(function (r) { return !r.currentArea; }).length;

        // Intro text
        var introText = rows.length + ' soil sample' + (rows.length === 1 ? '' : 's') + ' across '
            + zoneTypes.length + ' zone type' + (zoneTypes.length === 1 ? '' : 's') + '. '
            + (missing > 0
                ? '<strong>' + missing + ' missing area data.</strong> '
                : 'All samples have area set. ')
            + 'Set a value for an entire group, or override specific samples. Uncheck any sample to skip it.';
        var html = '<div class="dat-area-intro">' + introText + '</div>';

        zoneTypes.forEach(function (zt) {
            var group = grouped[zt];
            var label = GROUP_LABELS[zt] || zt;
            var hint  = GROUP_HINTS[zt] || '';
            html += '<div class="dat-area-group" data-zone-type="' + zt + '">';
            html += '<div class="dat-area-group-hd">';
            html += '<input type="checkbox" class="dat-area-group-check dat-area-row-check" checked title="Select all in group">';
            html += '<span class="dat-area-group-name">' + label + '</span>';
            html += '<span class="dat-area-group-count">(' + group.length + ')</span>';
            html += '<div class="dat-area-bulk">';
            html += '<span>Apply to all in group:</span>';
            html += '<input type="number" class="dat-area-bulk-input" min="0.001" max="100" step="0.01" placeholder="e.g. 0.05">';
            html += '<span>ha</span>';
            if (hint) html += '<span class="dat-area-bulk-hint">' + hint + '</span>';
            html += '</div></div>';

            html += '<div class="dat-area-col-hd">';
            html += '<span class="dat-area-col-hd-check"></span>';
            html += '<span class="dat-area-row-name">Sample</span>';
            html += '<span class="dat-area-row-current">Current</span>';
            html += '<span class="dat-area-override-label">Override (optional)</span>';
            html += '<span class="dat-area-col-hd-unit"></span>';
            html += '</div>';

            group.forEach(function (r) {
                var cur = r.currentArea ? r.currentArea.toFixed(2) : '';
                var badge = r.currentArea
                    ? '<span class="dat-area-badge dat-area-badge-set">set</span>'
                    : '<span class="dat-area-badge dat-area-badge-missing">missing</span>';
                html += '<div class="dat-area-row" data-id="' + r.id + '">';
                html += '<input type="checkbox" class="dat-area-row-check" checked aria-label="Include this sample">';
                html += '<span class="dat-area-row-name" title="' + r.name + '">' + r.name + badge + '</span>';
                html += '<span class="dat-area-row-current">' + (cur ? cur + ' ha' : '—') + '</span>';
                html += '<input type="number" class="dat-area-row-input" min="0.001" max="100" step="0.01" placeholder="per-sample override" value="' + cur + '">';
                html += '<span class="dat-area-row-unit">ha</span>';
                html += '</div>';
            });
            html += '</div>';
        });

        modalBody.innerHTML = html;

        modalBody.querySelectorAll('.dat-area-group').forEach(function (grp) {
            var groupCheck = grp.querySelector('.dat-area-group-check');
            var bulkInput  = grp.querySelector('.dat-area-bulk-input');

            // Group checkbox toggles all row checkboxes
            if (groupCheck) {
                groupCheck.addEventListener('change', function () {
                    grp.querySelectorAll('.dat-area-row-check').forEach(function (c) {
                        c.checked = groupCheck.checked;
                    });
                    grp.querySelectorAll('.dat-area-row').forEach(function (row) {
                        row.classList.toggle('skipped', !groupCheck.checked);
                    });
                    updateApplyLabel();
                });
            }

            // Row checkboxes update skipped state
            grp.querySelectorAll('.dat-area-row-check').forEach(function (c) {
                c.addEventListener('change', function () {
                    var row = c.closest('.dat-area-row');
                    if (row) row.classList.toggle('skipped', !c.checked);
                    updateApplyLabel();
                });
            });

            // Bulk input fills all checked rows
            bulkInput.addEventListener('input', function () {
                var v = bulkInput.value;
                grp.querySelectorAll('.dat-area-row').forEach(function (row) {
                    var check = row.querySelector('.dat-area-row-check');
                    if (check && check.checked) {
                        row.querySelector('.dat-area-row-input').value = v;
                    }
                });
            });
        });

        updateApplyLabel();
    }

    function updateApplyLabel() {
        var checked = modalBody.querySelectorAll('.dat-area-row .dat-area-row-check:checked').length;
        applyBtn.textContent = checked > 0 ? 'Apply to ' + checked + ' sample' + (checked === 1 ? '' : 's') : 'Apply';
    }

    function openModal() {
        renderModal(collectRows());
        modalMsg.textContent = '';
        modalMsg.className = 'dat-modal-msg';
        applyBtn.disabled = false;
        applyBtn.textContent = 'Apply';
        modal.style.display = 'flex';
    }

    function closeModal() { modal.style.display = 'none'; }

    areaBtn.addEventListener('click', openModal);
    closeBtn.addEventListener('click', closeModal);
    cancelBtn.addEventListener('click', closeModal);
    modal.addEventListener('click', function (e) { if (e.target === modal) closeModal(); });
    document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape' && modal.style.display !== 'none') closeModal();
    });

    applyBtn.addEventListener('click', async function () {
        var rows = [];
        modalBody.querySelectorAll('.dat-area-row').forEach(function (row) {
            var check = row.querySelector('.dat-area-row-check');
            if (check && !check.checked) return;  // skipped by user
            var id  = row.dataset.id;
            var val = parseFloat(row.querySelector('.dat-area-row-input').value);
            if (id && !isNaN(val) && val > 0) rows.push({ id: id, areaHa: val });
        });

        if (!rows.length) {
            modalMsg.textContent = 'Nothing to apply — enter a value or uncheck fewer samples.';
            modalMsg.className = 'dat-modal-msg err';
            return;
        }

        applyBtn.disabled = true;
        applyBtn.textContent = 'Saving…';

        var payloadMap = {};
        document.querySelectorAll('#dat-table .dat-row').forEach(function (tr) {
            var d = {};
            try { d = JSON.parse(tr.dataset.row || '{}'); } catch (_) {}
            if (d.id) payloadMap[String(d.id)] = d.payload || {};
        });

        var errors = 0;
        for (var i = 0; i < rows.length; i++) {
            var item = rows[i];
            var payload = Object.assign({}, payloadMap[item.id] || {}, { areaHa: item.areaHa });
            try {
                var res = await fetch('/api/samples/' + item.id, {
                    method: 'PATCH',
                    credentials: 'same-origin',
                    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json', 'X-CSRF-TOKEN': CSRF },
                    body: JSON.stringify({ payload: payload })
                });
                if (!res.ok) errors++;
            } catch (_) { errors++; }
        }

        if (errors) {
            modalMsg.textContent = errors + ' error(s). Some areas may not have saved.';
            modalMsg.className = 'dat-modal-msg err';
            applyBtn.disabled = false;
            applyBtn.textContent = 'Apply';
        } else {
            modalMsg.textContent = rows.length + ' sample(s) updated.';
            modalMsg.className = 'dat-modal-msg ok';
            setTimeout(function () { closeModal(); location.reload(); }, 800);
        }
    });
}());
</script>
@endif

@endsection
