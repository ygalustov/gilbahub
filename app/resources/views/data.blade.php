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
<!doctype html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="csrf-token" content="{{ csrf_token() }}">
    <title>{{ $sectionTitles[$section] ?? 'Data' }} — {{ config('app.name') }}</title>
    <script>
        window.GAIP_HUB_CONFIG = Object.assign({}, window.GAIP_HUB_CONFIG || {}, {
            nonce:         "{{ csrf_token() }}",
            csrfToken:     "{{ csrf_token() }}",
            restUrl:       "{{ url('/api') }}/",
            userId:        {{ auth()->id() ?? 0 }},
            activeSiteId:  @json($activeSite?->id),
            siteUrl:       "{{ url('/') }}",
            hubUrl:        "{{ route('hub') }}",
        });
    </script>
    <link rel="stylesheet" href="{{ $legacyAssetUrl('gaip-design-system.css') }}">
    <link rel="stylesheet" href="{{ $legacyAssetUrl('dashboard-ui.css') }}">
    <link rel="stylesheet" href="{{ $legacyAssetUrl('data-ui.css') }}">
</head>
<body>
<div class="db-shell">

    {{-- ============================================================
         LEFT SIDEBAR
    ============================================================ --}}
    <nav class="db-sidebar">
        <div class="db-sidebar-logo">
            <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
                <path stroke-linecap="round" stroke-linejoin="round" d="M12 3c0 0-6 4-6 9a6 6 0 0012 0c0-5-6-9-6-9z"/>
            </svg>
        </div>

        <a href="{{ route('dashboard') }}" class="db-nav-item" title="Dashboard">
            <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <rect x="3" y="3" width="7" height="7" rx="1.5"/>
                <rect x="14" y="3" width="7" height="7" rx="1.5"/>
                <rect x="3" y="14" width="7" height="7" rx="1.5"/>
                <rect x="14" y="14" width="7" height="7" rx="1.5"/>
            </svg>
        </a>

        <a href="{{ route('data') }}" class="db-nav-item active" title="Data">
            <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <ellipse cx="12" cy="5" rx="9" ry="3"/>
                <path stroke-linecap="round" stroke-linejoin="round" d="M3 5v6c0 1.66 4.03 3 9 3s9-1.34 9-3V5"/>
                <path stroke-linecap="round" stroke-linejoin="round" d="M3 11v6c0 1.66 4.03 3 9 3s9-1.34 9-3v-6"/>
            </svg>
        </a>

        <a href="#" class="db-nav-item" title="Analysis">
            <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M3 17l4-4 4 3 4-6 4-2"/>
                <path stroke-linecap="round" stroke-linejoin="round" d="M3 21h18"/>
            </svg>
        </a>

        <a href="#" class="db-nav-item" title="Reports">
            <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2"/>
                <rect x="9" y="3" width="6" height="4" rx="1"/>
                <path stroke-linecap="round" d="M9 12h6M9 16h4"/>
            </svg>
        </a>

        <div class="db-sidebar-bottom">
            <a href="{{ route('settings') }}" class="db-nav-item" title="Settings">
                <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/>
                    <circle cx="12" cy="12" r="3"/>
                </svg>
            </a>
        </div>
    </nav>

    {{-- ============================================================
         MAIN
    ============================================================ --}}
    <div class="db-main">

        {{-- TOP BAR --}}
        <header class="db-topbar">
            <div class="db-site-switcher-wrap" id="db-site-switcher-wrap" style="position:relative">
                <button class="db-site-switcher" id="db-site-switcher-btn" type="button"
                        aria-haspopup="listbox" aria-expanded="false">
                    <span id="db-site-name">{{ $activeSite?->name ?? 'Select site' }}</span>
                    <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7"/>
                    </svg>
                </button>
                <div class="db-site-dropdown" id="db-site-dropdown" hidden
                     style="position:absolute;top:calc(100% + 6px);left:0;z-index:200;min-width:200px;background:#fff;border:1px solid #d8e0dc;border-radius:8px;box-shadow:0 4px 16px rgba(0,0,0,.12);overflow:hidden">
                    @foreach($allSites as $site)
                    <button type="button"
                            class="db-site-option{{ $site->id === $activeSite?->id ? ' active' : '' }}"
                            data-site-id="{{ $site->id }}"
                            style="display:block;width:100%;padding:10px 16px;border:0;background:{{ $site->id === $activeSite?->id ? '#e8f3ed' : 'transparent' }};text-align:left;cursor:pointer;font:inherit;font-size:14px;color:#17231f">
                        {{ $site->name }}
                    </button>
                    @endforeach
                </div>
            </div>

            <div style="margin-left:auto;display:flex;align-items:center;gap:12px">
                <a href="{{ route('settings') }}" class="db-settings-btn" title="Settings">
                    <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/>
                        <circle cx="12" cy="12" r="3"/>
                    </svg>
                </a>
            </div>
        </header>

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
                    'icon'  => '<path stroke-linecap="round" stroke-linejoin="round" d="M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-2.667-5.596a3 3 0 014.334 0M5.636 12.364a9.5 9.5 0 0112.728 0"/>',
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
                    @if($total > 0)
                        <span class="dat-count">{{ $total }} {{ $total === 1 ? 'record' : 'records' }}</span>
                    @endif
                </div>
                <div class="dat-table-actions">
                    @if(!in_array($section, ['sensors', 'spray-log']))
                    <button class="dat-compare-btn" id="dat-compare-btn" disabled>
                        <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                            <path stroke-linecap="round" stroke-linejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"/>
                        </svg>
                        Compare
                    </button>
                    @endif
                    @if($section !== 'sensors')
                    <a href="{{ route('hub') }}" class="dat-add-btn">
                        <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
                            <path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4"/>
                        </svg>
                        Add Data
                    </a>
                    @endif
                </div>
            </div>

            {{-- ── SENSORS: configuration UI ── --}}
            @if($section === 'sensors')
            <div class="sens-wrap" id="sens-wrap">

                <div class="sens-section-head">
                    <div class="sens-section-name">Sensor Integrations</div>
                    <div class="sens-section-sub">Connect your soil sensor provider to feed live VWC, EC and soil temperature into GAIP engines.</div>
                </div>

                <div class="sens-providers">

                    {{-- Hydrosight --}}
                    <div class="sens-provider-card">
                        <div class="sens-provider-header">
                            <div class="sens-provider-icon">
                                <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                                    <path stroke-linecap="round" stroke-linejoin="round" d="M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-2.667-5.596a3 3 0 014.334 0M5.636 12.364a9.5 9.5 0 0112.728 0"/>
                                </svg>
                            </div>
                            <div class="sens-provider-info">
                                <div class="sens-provider-name">Hydrosight</div>
                                <div class="sens-provider-desc">Wireless buried TDR sensors. Reads VWC, EC and soil temperature per zone.</div>
                            </div>
                            <span class="sens-status-badge" id="sens-hs-badge">Not configured</span>
                        </div>
                        <div class="sens-provider-body" id="sens-hs-body">
                            <label class="sens-label" for="sens-hs-key">API Key</label>
                            <div class="sens-key-row">
                                <input type="password" class="sens-input" id="sens-hs-key" placeholder="Enter your Hydrosight API key" autocomplete="new-password" spellcheck="false">
                                <button class="sens-test-btn" id="sens-hs-test" type="button">Test &amp; Save</button>
                            </div>
                            <div class="sens-field-msg" id="sens-hs-msg"></div>
                            <button class="sens-disconnect-btn" id="sens-hs-disconnect" type="button" style="display:none">Disconnect</button>
                        </div>
                        <div class="sens-sensor-list" id="sens-hs-list" style="display:none">
                            <div class="sens-sensor-list-head">Connected Sensors</div>
                        </div>
                    </div>

                    {{-- SpecConnect --}}
                    <div class="sens-provider-card">
                        <div class="sens-provider-header">
                            <div class="sens-provider-icon">
                                <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                                    <path stroke-linecap="round" stroke-linejoin="round" d="M9 3H5a2 2 0 0 0-2 2v4m6-6h10a2 2 0 0 1 2 2v4M9 3v18m0 0h10a2 2 0 0 0 2-2v-4M9 21H5a2 2 0 0 1-2-2v-4m0 0h18"/>
                                </svg>
                            </div>
                            <div class="sens-provider-info">
                                <div class="sens-provider-name">SpecConnect</div>
                                <div class="sens-provider-desc">TDR 350/300 FieldScout spatial readings. Session-based soil scanning via portable probe.</div>
                            </div>
                            <span class="sens-status-badge" id="sens-sc-badge">Not configured</span>
                        </div>
                        <div class="sens-provider-body" id="sens-sc-body">
                            <label class="sens-label" for="sens-sc-key">API Key</label>
                            <div class="sens-key-row">
                                <input type="password" class="sens-input" id="sens-sc-key" placeholder="Enter your SpecConnect API key" autocomplete="new-password" spellcheck="false">
                                <button class="sens-test-btn" id="sens-sc-test" type="button">Test &amp; Save</button>
                            </div>
                            <div class="sens-field-msg" id="sens-sc-msg"></div>
                            <button class="sens-disconnect-btn" id="sens-sc-disconnect" type="button" style="display:none">Disconnect</button>
                        </div>
                        <div class="sens-sensor-list" id="sens-sc-list" style="display:none">
                            <div class="sens-sensor-list-head">Connected Equipment</div>
                        </div>
                    </div>

                </div>{{-- /sens-providers --}}

                {{-- Live readings --}}
                <div class="sens-readings-section" id="sens-readings" style="display:none">
                    <div class="sens-readings-head">
                        <div>
                            <span class="sens-readings-title">Live Readings</span>
                            <span class="sens-last-updated" id="sens-last-updated"></span>
                        </div>
                        <button class="sens-refresh-btn" id="sens-refresh-btn" type="button">↻ Refresh</button>
                    </div>
                    <div class="sens-zone-grid" id="sens-zone-grid">
                        <div class="sens-no-readings">No readings cached yet — refresh to fetch live data.</div>
                    </div>
                </div>

            </div>{{-- /sens-wrap --}}

            {{-- ── EMPTY STATE ── --}}
            @elseif($rows->isEmpty())
            <div class="dat-empty-state">
                <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"
                     stroke-linecap="round" stroke-linejoin="round" style="color:var(--gaip-border,#ccd9d2)">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                    <polyline points="14 2 14 8 20 8"/>
                </svg>
                <div class="dat-empty-title">No {{ strtolower($sectionTitles[$section]) }} yet</div>
                <div class="dat-empty-sub">Import data from Hub to populate this page.</div>
                <a href="{{ route('hub') }}" class="dat-import-btn">Import Data →</a>
            </div>

            @else

            {{-- ── SOIL TABLE ── --}}
            @if($section === 'soil')
            <div class="dat-table-wrap">
                <table class="dat-table" id="dat-table">
                    <thead><tr>
                        <th class="dat-th-check"><input type="checkbox" id="dat-check-all" aria-label="Select all"></th>
                        <th>Zone</th>
                        <th>Sample Name</th>
                        <th>Date Collected</th>
                        <th>Status</th>
                        <th class="dat-th-num">pH</th>
                        <th class="dat-th-num">K (ppm)</th>
                        <th class="dat-th-num">P (ppm)</th>
                        <th>Actions</th>
                    </tr></thead>
                    <tbody>
                    @foreach($rows as $row)
                    @php
                        $pl    = $row->payload ?? [];
                        $zone  = $pVal($pl, 'zone', 'Zone') ?? '—';
                        $name  = $row->client_uid ?: ($row->lab_ref ?: "Sample #{$row->id}");
                        $labId = $row->lab_ref ?: $row->client_uid;
                        $date  = $row->lab_date?->toDateString() ?? $row->sample_date?->toDateString();
                        $ph    = $pVal($pl, 'pH', 'ph', 'PH');
                        $k     = $pVal($pl, 'K', 'k', 'potassium', 'Potassium');
                        $p     = $pVal($pl, 'P', 'p', 'phosphorus', 'Phosphorus');
                        $rowData = ['id'=>$row->id,'section'=>'soil','name'=>$name,'labId'=>$labId,'zone'=>$zone,'date'=>$date,'payload'=>$pl,'notes'=>$row->notes];
                    @endphp
                    <tr class="dat-row" data-id="{{ $row->id }}" data-section="soil"
                        data-row="{{ htmlspecialchars(json_encode($rowData), ENT_QUOTES, 'UTF-8') }}">
                        <td class="dat-td-check"><input type="checkbox" class="dat-row-check" data-id="{{ $row->id }}"></td>
                        <td><span class="dat-zone-tag {{ $zoneClass($zone) }}">{{ $zone }}</span></td>
                        <td>
                            <div class="dat-sample-name">{{ $name }}</div>
                            @if($labId && $labId !== $name)<div class="dat-lab-id">Lab ID: {{ $labId }}</div>@endif
                        </td>
                        <td>
                            <div>{{ $date ? date('M j, Y', strtotime($date)) : '—' }}</div>
                            @if($date)<div class="dat-date-age">{{ $ageLabel($date) }}</div>@endif
                        </td>
                        <td><span class="dat-status dat-status-{{ $statusCls($date) }}">{{ $statusLabel($date) }}</span></td>
                        <td class="dat-td-num">{{ $ph ?? '—' }}</td>
                        <td class="dat-td-num">{{ $k ?? '—' }}</td>
                        <td class="dat-td-num">{{ $p ?? '—' }}</td>
                        <td><button class="dat-view-btn" type="button">View Details</button></td>
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
                        <th>Zone</th>
                        <th>Sample Name</th>
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
                        $pl    = $row->payload ?? [];
                        $zone  = $pVal($pl, 'zone', 'Zone') ?? '—';
                        $name  = $row->client_uid ?: ($row->lab_ref ?: "Sample #{$row->id}");
                        $labId = $row->lab_ref ?: $row->client_uid;
                        $date  = $row->lab_date?->toDateString() ?? $row->sample_date?->toDateString();
                        $n     = $pVal($pl, 'N', 'n', 'nitrogen', 'Nitrogen', 'N_total');
                        $k     = $pVal($pl, 'K', 'k', 'potassium', 'Potassium');
                        $p     = $pVal($pl, 'P', 'p', 'phosphorus', 'Phosphorus');
                        $rowData = ['id'=>$row->id,'section'=>'tissue','name'=>$name,'labId'=>$labId,'zone'=>$zone,'date'=>$date,'payload'=>$pl,'notes'=>$row->notes];
                    @endphp
                    <tr class="dat-row" data-id="{{ $row->id }}" data-section="tissue"
                        data-row="{{ htmlspecialchars(json_encode($rowData), ENT_QUOTES, 'UTF-8') }}">
                        <td class="dat-td-check"><input type="checkbox" class="dat-row-check" data-id="{{ $row->id }}"></td>
                        <td><span class="dat-zone-tag {{ $zoneClass($zone) }}">{{ $zone }}</span></td>
                        <td>
                            <div class="dat-sample-name">{{ $name }}</div>
                            @if($labId && $labId !== $name)<div class="dat-lab-id">Lab ID: {{ $labId }}</div>@endif
                        </td>
                        <td>
                            <div>{{ $date ? date('M j, Y', strtotime($date)) : '—' }}</div>
                            @if($date)<div class="dat-date-age">{{ $ageLabel($date) }}</div>@endif
                        </td>
                        <td><span class="dat-status dat-status-{{ $statusCls($date) }}">{{ $statusLabel($date) }}</span></td>
                        <td class="dat-td-num">{{ $n ?? '—' }}</td>
                        <td class="dat-td-num">{{ $k ?? '—' }}</td>
                        <td class="dat-td-num">{{ $p ?? '—' }}</td>
                        <td><button class="dat-view-btn" type="button">View Details</button></td>
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
                        <th>Sample Name</th>
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
                        $pl    = $row->payload ?? [];
                        $name  = $row->client_uid ?: ($row->lab_ref ?: "Sample #{$row->id}");
                        $labId = $row->lab_ref ?: $row->client_uid;
                        $date  = $row->lab_date?->toDateString() ?? $row->sample_date?->toDateString();
                        $ph    = $pVal($pl, 'pH', 'ph', 'PH');
                        $ec    = $pVal($pl, 'EC', 'ec', 'EC_dSm', 'Salinity', 'salinity');
                        $hco3  = $pVal($pl, 'HCO3', 'hco3', 'bicarbonate', 'Bicarbonate');
                        $rowData = ['id'=>$row->id,'section'=>'water','name'=>$name,'labId'=>$labId,'zone'=>null,'date'=>$date,'payload'=>$pl,'notes'=>$row->notes];
                    @endphp
                    <tr class="dat-row" data-id="{{ $row->id }}" data-section="water"
                        data-row="{{ htmlspecialchars(json_encode($rowData), ENT_QUOTES, 'UTF-8') }}">
                        <td class="dat-td-check"><input type="checkbox" class="dat-row-check" data-id="{{ $row->id }}"></td>
                        <td>
                            <div class="dat-sample-name">{{ $name }}</div>
                            @if($labId && $labId !== $name)<div class="dat-lab-id">Lab ID: {{ $labId }}</div>@endif
                        </td>
                        <td>
                            <div>{{ $date ? date('M j, Y', strtotime($date)) : '—' }}</div>
                            @if($date)<div class="dat-date-age">{{ $ageLabel($date) }}</div>@endif
                        </td>
                        <td><span class="dat-status dat-status-{{ $statusCls($date) }}">{{ $statusLabel($date) }}</span></td>
                        <td class="dat-td-num">{{ $ph ?? '—' }}</td>
                        <td class="dat-td-num">{{ $ec ?? '—' }}</td>
                        <td class="dat-td-num">{{ $hco3 ?? '—' }}</td>
                        <td><button class="dat-view-btn" type="button">View Details</button></td>
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
                        <th>Zone</th>
                        <th>Sample Name</th>
                        <th>Date Collected</th>
                        <th>Status</th>
                        <th class="dat-th-num">OM (%)</th>
                        <th class="dat-th-num">Thatch (%)</th>
                        <th>Actions</th>
                    </tr></thead>
                    <tbody>
                    @foreach($rows as $row)
                    @php
                        $pl    = $row->payload ?? [];
                        $zone  = $pVal($pl, 'zone', 'Zone') ?? '—';
                        $name  = $row->client_uid ?: ($row->lab_ref ?: "Sample #{$row->id}");
                        $labId = $row->lab_ref ?: $row->client_uid;
                        $date  = $row->lab_date?->toDateString() ?? $row->sample_date?->toDateString();
                        $om     = $pVal($pl, 'OM', 'om', 'organic_matter', 'OrganicMatter', 'LOI');
                        $thatch = $pVal($pl, 'thatch', 'Thatch', 'THATCH');
                        $rowData = ['id'=>$row->id,'section'=>'loi','name'=>$name,'labId'=>$labId,'zone'=>$zone,'date'=>$date,'payload'=>$pl,'notes'=>$row->notes];
                    @endphp
                    <tr class="dat-row" data-id="{{ $row->id }}" data-section="loi"
                        data-row="{{ htmlspecialchars(json_encode($rowData), ENT_QUOTES, 'UTF-8') }}">
                        <td class="dat-td-check"><input type="checkbox" class="dat-row-check" data-id="{{ $row->id }}"></td>
                        <td><span class="dat-zone-tag {{ $zoneClass($zone) }}">{{ $zone }}</span></td>
                        <td>
                            <div class="dat-sample-name">{{ $name }}</div>
                            @if($labId && $labId !== $name)<div class="dat-lab-id">Lab ID: {{ $labId }}</div>@endif
                        </td>
                        <td>
                            <div>{{ $date ? date('M j, Y', strtotime($date)) : '—' }}</div>
                            @if($date)<div class="dat-date-age">{{ $ageLabel($date) }}</div>@endif
                        </td>
                        <td><span class="dat-status dat-status-{{ $statusCls($date) }}">{{ $statusLabel($date) }}</span></td>
                        <td class="dat-td-num">{{ $om ?? '—' }}</td>
                        <td class="dat-td-num">{{ $thatch ?? '—' }}</td>
                        <td><button class="dat-view-btn" type="button">View Details</button></td>
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
                        <th>Zone</th>
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
                        $zone = $row->zone ?? '—';
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
                        data-row="{{ htmlspecialchars(json_encode($rowData), ENT_QUOTES, 'UTF-8') }}">
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
                        <td><button class="dat-view-btn" type="button">View</button></td>
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
                        <a href="{{ route('hub') }}" class="dat-full-report-btn" target="_blank">Full Report</a>
                        <button class="dat-detail-close" id="dat-detail-close" aria-label="Close detail panel">×</button>
                    </div>
                </div>
                <div id="dat-detail-body" class="dat-detail-body"></div>
            </div>

            @endif {{-- /rows or sensors --}}

        </div>{{-- /dat-body --}}
    </div>{{-- /db-main --}}
</div>{{-- /db-shell --}}

{{-- Site switcher --}}
<script>
(function () {
    var btn      = document.getElementById('db-site-switcher-btn');
    var dropdown = document.getElementById('db-site-dropdown');
    if (!btn || !dropdown) return;
    btn.addEventListener('click', function (e) {
        e.stopPropagation();
        var open = !dropdown.hidden;
        dropdown.hidden = open;
        btn.setAttribute('aria-expanded', String(!open));
    });
    document.addEventListener('click', function () {
        dropdown.hidden = true;
        btn.setAttribute('aria-expanded', 'false');
    });
    dropdown.addEventListener('click', function (e) {
        e.stopPropagation();
        var target = e.target.closest('[data-site-id]');
        if (!target) return;
        var csrfToken = document.querySelector('meta[name="csrf-token"]')?.content || '';
        target.disabled = true;
        target.textContent = '…';
        fetch('/api/active-site', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json', 'X-CSRF-TOKEN': csrfToken, 'Accept': 'application/json' },
            body: JSON.stringify({ site_id: target.dataset.siteId }),
        })
        .then(function (r) { return r.ok ? r.json() : Promise.reject(r.status); })
        .then(function () { window.location.reload(); })
        .catch(function () { target.disabled = false; target.textContent = target.dataset.siteName || 'Error'; });
    });
    dropdown.querySelectorAll('[data-site-id]').forEach(function (el) { el.dataset.siteName = el.textContent.trim(); });
}());
</script>

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
    }

    function closeDetail() {
        if (detail) detail.style.display = 'none';
        if (table) table.querySelectorAll('.dat-row.selected').forEach(function (r) { r.classList.remove('selected'); });
        currentId = null;
    }

    if (table) {
        table.addEventListener('click', function (e) {
            if (e.target.matches('input[type="checkbox"]')) return;
            var btn = e.target.closest('.dat-view-btn');
            var row = e.target.closest('.dat-row');
            if (!row) return;
            if (String(row.dataset.id) === currentId && !btn) { closeDetail(); return; }
            openDetail(row);
        });
    }
    if (detClose) detClose.addEventListener('click', closeDetail);
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
        return '<div class="dat-metric-card">' +
            '<div class="dat-metric-name">' + esc(name) + '</div>' +
            '<div class="dat-metric-value">' + val + (unit ? '<span class="dat-metric-unit"> ' + esc(unit) + '</span>' : '') + '</div>' +
            (opt ? '<div class="dat-metric-bar-wrap"><div class="dat-metric-bar" style="width:' + pct.toFixed(1) + '%;background:' + bar + '"></div></div>' : '') +
            (st.label ? '<div class="dat-metric-status ' + st.cls + '">' + st.label + '</div>' : '') +
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

    function buildSoil(p, data) {
        var keyHtml = SOIL_KEY.map(function (f) { return metricCard(f.name, gv(p, f.keys), f.unit, f.opt, f.max); }).join('');
        return (keyHtml ? '<div class="dat-metric-grid">' + keyHtml + '</div>' : '') +
               specGrid(SOIL_FULL, p) + notesHtml(data.notes);
    }

    function buildTissue(p, data) {
        var keyHtml = TISSUE_KEY.map(function (f) { return metricCard(f.name, gv(p, f.keys), f.unit, f.opt, f.max); }).join('');
        return (keyHtml ? '<div class="dat-metric-grid" style="grid-template-columns:repeat(3,1fr)">' + keyHtml + '</div>' : '') + notesHtml(data.notes);
    }

    function buildWater(p, data) {
        var keyHtml = WATER_KEY.map(function (f) { return metricCard(f.name, gv(p, f.keys), f.unit, f.opt, f.max); }).join('');
        return (keyHtml ? '<div class="dat-metric-grid">' + keyHtml + '</div>' : '') +
               specGrid(WATER_FULL, p) + notesHtml(data.notes);
    }

    function buildLoi(p, data) {
        var fields = [
            { keys:['OM','om','organic_matter','OrganicMatter','LOI'], name:'Organic Matter', unit:'%', opt:[2.5,5], max:10 },
            { keys:['thatch','Thatch','THATCH'],                        name:'Thatch',         unit:'%', opt:[0,10],  max:30 },
            { keys:['moisture','Moisture'],                             name:'Moisture',       unit:'%', opt:[15,25], max:50 },
        ];
        var keyHtml = fields.map(function (f) { return metricCard(f.name, gv(p, f.keys), f.unit, f.opt, f.max); }).join('');
        return (keyHtml ? '<div class="dat-metric-grid" style="grid-template-columns:repeat(3,1fr)">' + keyHtml + '</div>' : '') + notesHtml(data.notes);
    }

    function buildSpray(data) {
        var rows = [
            ['Date',              data.date ? fmtDate(data.date) : '—'],
            ['Zone',              data.zone || '—'],
            ['Product',           data.product || '—'],
            ['Category',          data.category ? data.category.charAt(0).toUpperCase() + data.category.slice(1) : '—'],
            ['Active Ingredient', data.active_ingredient || '—'],
            ['Rate',              data.rate !== null && data.rate !== undefined ? data.rate + (data.rate_unit ? ' ' + data.rate_unit : '') : '—'],
            ['Target',            data.target || '—'],
            ['Source',            data.source || 'manual'],
        ];
        var html = '<div class="dat-spray-grid">' +
            rows.map(function (r) {
                return '<div class="dat-spray-row"><span class="dat-spray-label">' + r[0] + '</span><span class="dat-spray-value">' + esc(String(r[1])) + '</span></div>';
            }).join('') + '</div>';
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
        if (!btn) return;
        var n = document.querySelectorAll('.dat-row-check:checked').length;
        btn.disabled = n < 2;
        btn.querySelector('svg + *') || btn.lastChild;
        btn.textContent = '';
        btn.innerHTML = n >= 2
            ? '<svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"/></svg> Compare (' + n + ')'
            : '<svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"/></svg> Compare';
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

}());
</script>

@if($section === 'sensors')
<script>
(function () {
    'use strict';

    var CSRF    = (document.querySelector('meta[name="csrf-token"]') || {}).content || '';
    var SITE_ID = '{{ $activeSite?->id ?? 'default' }}';

    // ── localStorage helpers ─────────────────────────────────────────────
    function lsGet(key) {
        try { return localStorage.getItem(key); } catch (e) { return null; }
    }
    function lsSet(key, val) {
        try { localStorage.setItem(key, val); return true; } catch (e) { return false; }
    }
    function lsDel(key) {
        try { localStorage.removeItem(key); } catch (e) {}
    }
    function lsJson(key) {
        var raw = lsGet(key); if (!raw) return null;
        try { return JSON.parse(raw); } catch (e) { return null; }
    }

    // ── Hydrosight storage key (site-scoped) ─────────────────────────────
    function hsKey() { return 'gaip_hydrosight_config_' + SITE_ID; }
    function scKey() { return 'gilba_specconnect_config'; }

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

        // Handle auth/CSRF failures from Laravel before the controller runs
        if (r.status === 419) throw new Error('Session expired — please refresh the page.');
        if (r.status === 401) throw new Error('Not authenticated — please log in again.');
        if (r.status === 403) throw new Error('Request blocked (403) — please refresh the page and try again.');

        var text = await r.text();
        var json;
        try { json = JSON.parse(text); } catch (_) {
            throw new Error('Unexpected response (HTTP ' + r.status + ') — please refresh the page.');
        }

        if (!json.success) {
            var msg = (json.data && json.data.message) ? json.data.message : ('HTTP ' + r.status);
            throw new Error(msg);
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

    // ────────────────────────────────────────────────────────────────────
    // HYDROSIGHT
    // ────────────────────────────────────────────────────────────────────
    var _hsCfg = null;

    function hsLoad() {
        _hsCfg = lsJson(hsKey()) || {};
        return _hsCfg;
    }

    function hsSave(cfg) {
        _hsCfg = Object.assign(_hsCfg || {}, cfg);
        lsSet(hsKey(), JSON.stringify(_hsCfg));
    }

    function hsRender() {
        var cfg    = hsLoad();
        var badge  = document.getElementById('sens-hs-badge');
        var keyIn  = document.getElementById('sens-hs-key');
        var disc   = document.getElementById('sens-hs-disconnect');
        var list   = document.getElementById('sens-hs-list');

        if (cfg.keyConfigured || cfg.apiKey) {
            badge.textContent = 'Connected';
            badge.className   = 'sens-status-badge connected';
            if (keyIn) keyIn.placeholder = '••••••••••••••••';
            if (disc) disc.style.display = '';
            hsRenderSensors(cfg, list);
        } else {
            badge.textContent = 'Not configured';
            badge.className   = 'sens-status-badge';
            if (disc) disc.style.display = 'none';
            if (list) list.style.display = 'none';
        }
    }

    function hsRenderSensors(cfg, list) {
        if (!list) return;
        var cache = lsJson('gilba_sensor_last_fetch');
        var locations = (cache && cache.provider === 'Hydrosight' && cache.locations) || [];

        // Try loading from the hydrosight readings cache
        var readingsCache = lsJson('gaip_hydrosight_readings_cache_' + SITE_ID) || {};
        var readings = readingsCache.data || [];

        var html = '<div class="sens-sensor-list-head">Connected Sensors</div>';
        if (!readings.length && !locations.length) {
            html += '<div style="padding:10px 0;font-size:12px;color:var(--gaip-text-muted,#6b8878)">No readings cached. Use Refresh to fetch live data.</div>';
        } else {
            var zones = ['Greens','Fairways','Tees','Roughs','Other'];
            var items = readings.length ? readings : locations;
            items.slice(0, 12).forEach(function (item) {
                var name = item.name || item.sensorId || item.id || '—';
                var vwc  = item.vwc != null ? item.vwc.toFixed(1) : null;
                var ec   = item.ec  != null ? item.ec.toFixed(2)  : null;
                var tmp  = item.soilTemp != null ? item.soilTemp.toFixed(1) : null;
                var mapping = (cfg.sensorZoneMapping || {})[item.sensorId || item.id] || '';
                html += '<div class="sens-sensor-row">'
                    + '<span class="sens-sensor-dot' + (vwc ? ' live' : '') + '"></span>'
                    + '<span class="sens-sensor-name">' + esc(name) + '</span>'
                    + '<span class="sens-sensor-readings">'
                    + (vwc ? '<span class="sens-sensor-val"><span>' + vwc + '%</span> VWC</span>' : '')
                    + (ec  ? '<span class="sens-sensor-val"><span>' + ec  + '</span> EC</span>' : '')
                    + (tmp ? '<span class="sens-sensor-val"><span>' + tmp + '°C</span></span>' : '')
                    + '</span>'
                    + '<select class="sens-zone-select" data-sensor-id="' + esc(item.sensorId || item.id) + '">'
                    + '<option value="">Zone…</option>'
                    + zones.map(function (z) { return '<option value="' + z + '"' + (mapping === z ? ' selected' : '') + '>' + z + '</option>'; }).join('')
                    + '</select>'
                    + '</div>';
            });
        }
        list.innerHTML = html;
        list.style.display = '';

        // Zone mapping change handler
        list.querySelectorAll('.sens-zone-select').forEach(function (sel) {
            sel.addEventListener('change', function () {
                var sensorId = sel.dataset.sensorId;
                var cfg2 = hsLoad();
                cfg2.sensorZoneMapping = cfg2.sensorZoneMapping || {};
                if (sel.value) cfg2.sensorZoneMapping[sensorId] = sel.value;
                else delete cfg2.sensorZoneMapping[sensorId];
                hsSave(cfg2);
            });
        });
    }

    async function hsTestAndSave() {
        var keyIn  = document.getElementById('sens-hs-key');
        var msg    = document.getElementById('sens-hs-msg');
        var badge  = document.getElementById('sens-hs-badge');
        var btn    = document.getElementById('sens-hs-test');
        var apiKey = (keyIn && keyIn.value.trim()) || (_hsCfg && _hsCfg.apiKey) || '';

        if (!apiKey) { setMsg(msg, 'Enter an API key first.', 'err'); return; }

        btn.disabled = true; btn.textContent = 'Testing…';
        badge.textContent = 'Testing…'; badge.className = 'sens-status-badge testing';
        setMsg(msg, 'Connecting to Hydrosight…', 'info');

        try {
            // Verify connectivity via /locations
            var locData  = await proxyCall('hydrosight', '/locations', apiKey);
            var locCount = (locData && locData.items) ? locData.items.length : 0;

            // Fetch sensor list so the UI populates immediately
            var senData  = await proxyCall('hydrosight', '/sensors', apiKey);
            var sensors  = (senData && senData.items) || [];
            var sensorStubs = sensors.map(function (s) {
                return { sensorId: s.sensorId, name: s.name || s.sensorId, vwc: null, ec: null, soilTemp: null };
            });
            lsSet('gilba_sensor_last_fetch', JSON.stringify({
                fetchedAt: new Date().toISOString(), provider: 'Hydrosight', locations: sensorStubs
            }));

            hsSave({ apiKey: apiKey, keyConfigured: true, enabled: true });
            setMsg(msg, 'Connected — ' + locCount + ' location' + (locCount === 1 ? '' : 's') + ', ' + sensors.length + ' sensor' + (sensors.length === 1 ? '' : 's') + ' found.', 'ok');
            hsRender();
            updateReadingsSection();
        } catch (e) {
            setMsg(msg, 'Failed: ' + e.message, 'err');
            badge.textContent = 'Error'; badge.className = 'sens-status-badge error';
        } finally {
            btn.disabled = false; btn.textContent = 'Test & Save';
        }
    }

    function hsDisconnect() {
        lsDel(hsKey());
        _hsCfg = null;
        var msg = document.getElementById('sens-hs-msg');
        var keyIn = document.getElementById('sens-hs-key');
        setMsg(msg, 'Disconnected.', 'info');
        if (keyIn) keyIn.value = '';
        hsRender();
        updateReadingsSection();
    }

    // ────────────────────────────────────────────────────────────────────
    // SPECCONNECT
    // ────────────────────────────────────────────────────────────────────
    var _scCfg = null;

    function scLoad() {
        _scCfg = lsJson(scKey()) || {};
        return _scCfg;
    }

    function scSave(cfg) {
        _scCfg = Object.assign(_scCfg || {}, cfg);
        lsSet(scKey(), JSON.stringify(_scCfg));
    }

    function scRender() {
        var cfg   = scLoad();
        var badge = document.getElementById('sens-sc-badge');
        var keyIn = document.getElementById('sens-sc-key');
        var disc  = document.getElementById('sens-sc-disconnect');
        var list  = document.getElementById('sens-sc-list');

        if (cfg.apiKey) {
            badge.textContent = 'Connected';
            badge.className   = 'sens-status-badge connected';
            if (keyIn) keyIn.placeholder = '••••••••••••••••';
            if (disc) disc.style.display = '';
            scRenderEquipment(cfg, list);
        } else {
            badge.textContent = 'Not configured';
            badge.className   = 'sens-status-badge';
            if (disc) disc.style.display = 'none';
            if (list) list.style.display = 'none';
        }
    }

    function scRenderEquipment(cfg, list) {
        if (!list) return;
        var cache = lsJson('gilba_specconnect_cache_' + SITE_ID);
        var items = (cache && cache.data) ? cache.data : [];

        var html = '<div class="sens-sensor-list-head">Connected Equipment</div>';
        if (!items.length) {
            html += '<div style="padding:10px 0;font-size:12px;color:var(--gaip-text-muted,#6b8878)">No readings cached. Use Refresh to fetch live data.</div>';
        } else {
            items.slice(0, 12).forEach(function (item) {
                var name = item.surfaceName || item.collectionName || item.SerialNumber || '—';
                var vwc  = item.vwc  != null ? item.vwc.toFixed(1)  : null;
                var tmp  = item.soilTemp != null ? item.soilTemp.toFixed(1) : null;
                html += '<div class="sens-sensor-row">'
                    + '<span class="sens-sensor-dot' + (vwc ? ' live' : '') + '"></span>'
                    + '<span class="sens-sensor-name">' + esc(name) + '</span>'
                    + '<span class="sens-sensor-readings">'
                    + (vwc ? '<span class="sens-sensor-val"><span>' + vwc + '%</span> VWC</span>' : '')
                    + (tmp ? '<span class="sens-sensor-val"><span>' + tmp + '°C</span></span>' : '')
                    + '</span>'
                    + '</div>';
            });
        }
        list.innerHTML = html;
        list.style.display = '';
    }

    async function scTestAndSave() {
        var keyIn  = document.getElementById('sens-sc-key');
        var msg    = document.getElementById('sens-sc-msg');
        var badge  = document.getElementById('sens-sc-badge');
        var btn    = document.getElementById('sens-sc-test');
        var apiKey = (keyIn && keyIn.value.trim()) || (_scCfg && _scCfg.apiKey) || '';

        if (!apiKey) { setMsg(msg, 'Enter an API key first.', 'err'); return; }

        btn.disabled = true; btn.textContent = 'Testing…';
        badge.textContent = 'Testing…'; badge.className = 'sens-status-badge testing';
        setMsg(msg, 'Connecting to SpecConnect…', 'info');

        try {
            var ep  = '/api/Customer/GetCustomerEquipment?customerApiKey={key}&optUnits=1';
            var data = await proxyCall('specconnect', ep, apiKey);
            var count = Array.isArray(data) ? data.length : 0;
            scSave({ apiKey: apiKey, enabled: true });
            setMsg(msg, 'Connected — ' + count + ' device' + (count === 1 ? '' : 's') + ' found.', 'ok');
            scRender();
            updateReadingsSection();
        } catch (e) {
            setMsg(msg, 'Failed: ' + e.message, 'err');
            badge.textContent = 'Error'; badge.className = 'sens-status-badge error';
        } finally {
            btn.disabled = false; btn.textContent = 'Test & Save';
        }
    }

    function scDisconnect() {
        lsDel(scKey());
        _scCfg = null;
        var msg   = document.getElementById('sens-sc-msg');
        var keyIn = document.getElementById('sens-sc-key');
        setMsg(msg, 'Disconnected.', 'info');
        if (keyIn) keyIn.value = '';
        scRender();
        updateReadingsSection();
    }

    // ────────────────────────────────────────────────────────────────────
    // LIVE READINGS
    // ────────────────────────────────────────────────────────────────────
    function updateReadingsSection() {
        var hsCfg = hsLoad();
        var scCfg = scLoad();
        var hasAny = !!(hsCfg.keyConfigured || hsCfg.apiKey || scCfg.apiKey);
        var section = document.getElementById('sens-readings');
        if (!section) return;
        if (!hasAny) { section.style.display = 'none'; return; }
        section.style.display = '';
        renderZoneGrid();
    }

    function renderZoneGrid() {
        var grid    = document.getElementById('sens-zone-grid');
        var updated = document.getElementById('sens-last-updated');
        if (!grid) return;

        // Aggregate zone readings from both providers
        var hsCfg  = hsLoad();
        var zoneMap = hsCfg.sensorZoneMapping || {};

        var readingsCache = lsJson('gaip_hydrosight_readings_cache_' + SITE_ID) || {};
        var readings = readingsCache.data || [];

        // Also try last fetch
        var lastFetch = lsJson('gilba_sensor_last_fetch');

        var ts = readingsCache.timestamp || (lastFetch && lastFetch.fetchedAt ? new Date(lastFetch.fetchedAt).getTime() : 0);
        if (updated) updated.textContent = ts ? '— ' + timeAgo(ts) : '';

        // Build zone aggregates
        var zones = {};
        readings.forEach(function (r) {
            var z = zoneMap[r.sensorId] || r.zone || 'Other';
            if (!zones[z]) zones[z] = { vwcVals: [], ecVals: [], tmpVals: [] };
            if (r.vwc  != null) zones[z].vwcVals.push(r.vwc);
            if (r.ec   != null) zones[z].ecVals.push(r.ec);
            if (r.soilTemp != null) zones[z].tmpVals.push(r.soilTemp);
        });

        var zoneOrder = ['Greens','Fairways','Tees','Roughs','Other'];
        var rendered = zoneOrder.filter(function (z) { return zones[z] && zones[z].vwcVals.length; });

        if (!rendered.length) {
            grid.innerHTML = '<div class="sens-no-readings">No readings cached yet — click Refresh to fetch live data.</div>';
            return;
        }

        grid.innerHTML = rendered.map(function (z) {
            var zd  = zones[z];
            var avg = function (arr) { return arr.length ? arr.reduce(function (a, b) { return a + b; }, 0) / arr.length : null; };
            var vwc = avg(zd.vwcVals);
            var ec  = avg(zd.ecVals);
            var tmp = avg(zd.tmpVals);
            var pct = Math.min(100, Math.max(0, (vwc || 0) / 60 * 100));
            var barColor = vwc == null ? '#ccd9d2' : (vwc < 20 ? '#dc2626' : vwc < 30 ? '#f59e0b' : '#2da85e');
            return '<div class="sens-zone-card">'
                + '<div class="sens-zone-label">' + esc(z) + '</div>'
                + '<div class="sens-zone-vwc">' + (vwc != null ? vwc.toFixed(1) : '—') + '<span class="sens-zone-vwc-unit">%</span></div>'
                + '<div class="sens-zone-vwc-bar"><div class="sens-zone-vwc-fill" style="width:' + pct.toFixed(1) + '%;background:' + barColor + '"></div></div>'
                + '<div class="sens-zone-meta">'
                + (ec  != null ? '<span>' + ec.toFixed(2) + ' dS/m</span>' : '')
                + (tmp != null ? '<span>' + tmp.toFixed(1) + '°C</span>' : '')
                + '</div>'
                + '</div>';
        }).join('');
    }

    async function refreshReadings() {
        var btn = document.getElementById('sens-refresh-btn');
        if (btn) { btn.disabled = true; btn.textContent = '↻ Fetching…'; }

        var hsCfg  = hsLoad();
        var apiKey = hsCfg.apiKey;

        if (apiKey) {
            try {
                // 1. Get full sensor list
                var listData = await proxyCall('hydrosight', '/sensors', apiKey);
                var sensors  = (listData && listData.items) || [];

                // 2. Fetch each sensor individually to get lastReadings
                if (btn) btn.textContent = '↻ Fetching ' + sensors.length + ' sensors…';
                var readings = [];
                for (var i = 0; i < sensors.length; i++) {
                    var s = sensors[i];
                    try {
                        var detail = await proxyCall('hydrosight', '/sensors/' + encodeURIComponent(s.sensorId), apiKey);
                        var lr  = detail.lastReadings || {};
                        var vwc = parseFloat(lr.moisture);
                        var ec  = parseFloat(lr.ec);
                        var tmp = parseFloat(lr.temperature);
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
                hsRenderSensors(hsCfg, document.getElementById('sens-hs-list'));
            } catch (e) {
                console.warn('[Sensors] Hydrosight refresh failed:', e.message);
            }
        }

        renderZoneGrid();
        if (btn) { btn.disabled = false; btn.textContent = '↻ Refresh'; }
    }

    // ── Utility ──────────────────────────────────────────────────────────
    function setMsg(el, text, cls) {
        if (!el) return;
        el.textContent = text;
        el.className   = 'sens-field-msg' + (cls ? ' ' + cls : '');
    }

    // ── Init ─────────────────────────────────────────────────────────────
    function init() {
        hsRender();
        scRender();
        updateReadingsSection();

        var hsTest = document.getElementById('sens-hs-test');
        if (hsTest) hsTest.addEventListener('click', hsTestAndSave);

        var hsDisc = document.getElementById('sens-hs-disconnect');
        if (hsDisc) hsDisc.addEventListener('click', hsDisconnect);

        var scTest = document.getElementById('sens-sc-test');
        if (scTest) scTest.addEventListener('click', scTestAndSave);

        var scDisc = document.getElementById('sens-sc-disconnect');
        if (scDisc) scDisc.addEventListener('click', scDisconnect);

        var refresh = document.getElementById('sens-refresh-btn');
        if (refresh) refresh.addEventListener('click', refreshReadings);

        // Allow Enter in key inputs to trigger test
        ['sens-hs-key', 'sens-sc-key'].forEach(function (id) {
            var el = document.getElementById(id);
            if (el) el.addEventListener('keydown', function (e) {
                if (e.key === 'Enter') {
                    var btn = document.getElementById(id === 'sens-hs-key' ? 'sens-hs-test' : 'sens-sc-test');
                    if (btn) btn.click();
                }
            });
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
</body>
</html>
