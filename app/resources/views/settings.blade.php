@php
    $legacyAssetUrl = function (string $asset): string {
        $path = base_path('../assets/'.$asset);
        $version = is_file($path) ? '?v='.filemtime($path) : '';
        return url('/legacy-assets/'.$asset).$version;
    };
@endphp
<!doctype html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="csrf-token" content="{{ csrf_token() }}">
    <title>Settings — {{ config('app.name') }}</title>
    <script>
        window.GAIP_HUB_CONFIG = Object.assign({}, window.GAIP_HUB_CONFIG || {}, {
            nonce:        "{{ csrf_token() }}",
            csrfToken:    "{{ csrf_token() }}",
            restUrl:      "{{ url('/api') }}/",
            userId:       {{ auth()->id() ?? 0 }},
            activeSiteId: @json($activeSite?->id),
            siteUrl:      "{{ url('/') }}",
        });
    </script>
    <link rel="stylesheet" href="{{ $legacyAssetUrl('gaip-design-system.css') }}">
    <link rel="stylesheet" href="{{ $legacyAssetUrl('dashboard-ui.css') }}">
    <link rel="stylesheet" href="{{ $legacyAssetUrl('settings-ui.css') }}">
</head>
<body>
<div class="db-shell">

    {{-- ── Sidebar ─────────────────────────────────────────────── --}}
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

        <a href="{{ route('data') }}" class="db-nav-item" title="Data">
            <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <ellipse cx="12" cy="5" rx="9" ry="3"/>
                <path stroke-linecap="round" stroke-linejoin="round" d="M3 5v6c0 1.66 4.03 3 9 3s9-1.34 9-3V5"/>
                <path stroke-linecap="round" stroke-linejoin="round" d="M3 11v6c0 1.66 4.03 3 9 3s9-1.34 9-3v-6"/>
            </svg>
        </a>

        <a href="{{ route('analysis.growth-light') }}" class="db-nav-item" title="Analysis">
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
            <a href="{{ route('settings') }}" class="db-nav-item active" title="Settings">
                <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/>
                    <circle cx="12" cy="12" r="3"/>
                </svg>
            </a>
        </div>
    </nav>

    {{-- ── Main ─────────────────────────────────────────────────── --}}
    <div class="db-main">

        {{-- Topbar --}}
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

            <div style="margin-left:auto;display:flex;align-items:center;gap:10px">
                <form method="POST" action="{{ route('logout') }}" style="margin:0">
                    @csrf
                    <button type="submit" class="stg-logout-btn">Logout</button>
                </form>
            </div>
        </header>

        {{-- Scrollable content --}}
        <div class="db-content stg-scroll">
            <div class="stg-wrap">

                {{-- Page heading --}}
                <div class="stg-page-head">
                    <h1 class="stg-page-title">Settings</h1>
                </div>

                @if(!$activeSite)
                <div class="stg-card stg-no-site">
                    <p>No active site configured. Create a site from the Dashboard to get started.</p>
                </div>
                @else

                {{-- ── Tabs ──────────────────────────────────────────── --}}
                <div class="stg-tabs" role="tablist">
                    <button class="stg-tab active" role="tab" data-tab="site"         aria-selected="true" >Site</button>
                    <button class="stg-tab"         role="tab" data-tab="turf"         aria-selected="false">Turf profile</button>
                    <button class="stg-tab"         role="tab" data-tab="zones"        aria-selected="false">Zones</button>
                    <button class="stg-tab"         role="tab" data-tab="import"       aria-selected="false">Import</button>
                    <button class="stg-tab"         role="tab" data-tab="integrations" aria-selected="false">Integrations</button>
                </div>

                {{-- ── Site ─────────────────────────────────────────── --}}
                <div class="stg-panel" id="stg-tab-site" role="tabpanel">
                    <div class="stg-card">
                        <div class="stg-card-head">
                            <div class="stg-card-title">Site details</div>
                            <div class="stg-card-desc">Basic information about this location.</div>
                        </div>

                        <form id="stg-site-form" class="stg-form" novalidate>
                            <div class="stg-form-grid">
                                <div class="stg-field">
                                    <label for="stg-name">Site name</label>
                                    <input type="text" id="stg-name" name="name"
                                           value="{{ $activeSite->name }}" required maxlength="255">
                                </div>
                                <div class="stg-field">
                                    <label for="stg-site-type">Site type</label>
                                    <select id="stg-site-type" name="site_type">
                                        @php
                                            $siteType = $activeSite->site_type ?? '';
                                            $siteTypes = [
                                                'golf'       => 'Golf',
                                                'sports'     => 'Sports (football / cricket / rugby)',
                                                'bowling'    => 'Bowling green',
                                                'racecourse' => 'Racecourse',
                                                'precinct'   => 'Other / precinct',
                                            ];
                                        @endphp
                                        @foreach($siteTypes as $val => $label)
                                        <option value="{{ $val }}" {{ $siteType === $val ? 'selected' : '' }}>{{ $label }}</option>
                                        @endforeach
                                    </select>
                                </div>
                                <div class="stg-field">
                                    <label for="stg-timezone">Timezone</label>
                                    <select id="stg-timezone" name="timezone">
                                        @php
                                            $tz = $activeSite->timezone ?? '';
                                            $tzOptions = [
                                                'Australia/Sydney'    => 'Australia — Sydney / Melbourne',
                                                'Australia/Brisbane'  => 'Australia — Brisbane',
                                                'Australia/Adelaide'  => 'Australia — Adelaide',
                                                'Australia/Perth'     => 'Australia — Perth',
                                                'Australia/Darwin'    => 'Australia — Darwin',
                                                'Pacific/Auckland'    => 'New Zealand — Auckland',
                                                'Asia/Singapore'      => 'Singapore',
                                                'Asia/Tokyo'          => 'Japan — Tokyo',
                                                'Europe/London'       => 'UK — London',
                                                'Europe/Paris'        => 'Europe — Paris / Berlin',
                                                'America/New_York'    => 'USA — Eastern',
                                                'America/Chicago'     => 'USA — Central',
                                                'America/Denver'      => 'USA — Mountain',
                                                'America/Los_Angeles' => 'USA — Pacific',
                                                'UTC'                 => 'UTC',
                                            ];
                                        @endphp
                                        @foreach($tzOptions as $val => $label)
                                        <option value="{{ $val }}" {{ $tz === $val ? 'selected' : '' }}>{{ $label }}</option>
                                        @endforeach
                                    </select>
                                </div>
                                {{-- Location search spans full width, coordinates follow in the same grid --}}
                                <div class="stg-field" style="grid-column:1/-1;position:relative;">
                                    <label for="stg-location-name">Location (for live weather)</label>
                                    <input type="text" id="stg-location-name" name="location_name"
                                           value="{{ $activeSite->location_name ?? '' }}"
                                           maxlength="255" placeholder="Search suburb, city, or venue…"
                                           autocomplete="off">
                                    <div id="stg-location-results"
                                         style="display:none;position:absolute;left:0;right:0;top:100%;margin-top:2px;
                                                background:#fff;border:1px solid #d8e0dc;border-radius:6px;
                                                box-shadow:0 4px 12px rgba(0,0,0,.15);z-index:1000;
                                                max-height:220px;overflow-y:auto;"></div>
                                </div>
                                <div class="stg-field">
                                    <label for="stg-latitude">Latitude</label>
                                    <input type="number" id="stg-latitude" name="latitude"
                                           value="{{ $activeSite->latitude ?? '' }}"
                                           step="0.0000001" min="-90" max="90" placeholder="-33.8688">
                                </div>
                                <div class="stg-field">
                                    <label for="stg-longitude">Longitude</label>
                                    <input type="number" id="stg-longitude" name="longitude"
                                           value="{{ $activeSite->longitude ?? '' }}"
                                           step="0.0000001" min="-180" max="180" placeholder="151.2093">
                                </div>
                                <div class="stg-field">
                                    <label>Hemisphere</label>
                                    <input type="text" id="stg-hemisphere" readonly
                                           value="{{ isset($activeSite->latitude) ? ($activeSite->latitude < 0 ? 'Southern' : 'Northern') : '' }}"
                                           style="background:#f5f7f6;color:#6b7f76;cursor:default;">
                                </div>
                            </div>

                            <div class="stg-actions">
                                <button type="submit" class="stg-btn-primary" id="stg-site-save">Save changes</button>
                                <span class="stg-msg" id="stg-site-msg" hidden></span>
                            </div>
                        </form>
                    </div>
                </div>

                {{-- ── Turf profile ────────────────────────────────── --}}
                <div class="stg-panel stg-hidden" id="stg-tab-turf" role="tabpanel">
                    @php
                        $turf = is_array($activeGaipConfig['turf'] ?? null) ? $activeGaipConfig['turf'] : [];
                        $turfVal = fn(string $k, $fallback = '') => $turf[$k] ?? $fallback;

                        $speciesGroups = [
                            'Warm-season (C4)' => [
                                'Couch', 'Bermuda', 'Kikuyu', 'Zoysia', 'Seashore Paspalum', 'Buffalo',
                            ],
                            'Cool-season (C3)' => [
                                'Creeping Bentgrass (Greens)', 'Creeping Bentgrass (Fairway)',
                                'Creeping Bentgrass', 'Colonial Bentgrass', 'Browntop Bent',
                                'Perennial Ryegrass', 'Kentucky Bluegrass', 'Tall Fescue',
                                'Fine Fescue', 'Chewings Fescue', 'Chewings Fescue (Greens)',
                                'Slender Creeping Red Fescue', 'Strong Creeping Red Fescue',
                                'Poa annua',
                            ],
                        ];
                    @endphp

                    <form id="stg-turf-form" class="stg-form" novalidate>

                        {{-- Block 1: Identity --}}
                        <div class="stg-card" style="margin-bottom:16px">
                            <div class="stg-card-head">
                                <div class="stg-card-title">Turf identity</div>
                                <div class="stg-card-desc">Species and surface type — drives growth potential, disease risk, and nutrition targets.</div>
                            </div>
                            <div class="stg-form-grid" style="grid-template-columns:repeat(2,1fr)">
                                <div class="stg-field">
                                    <label for="stg-turf-type">Turf type</label>
                                    <select id="stg-turf-type" name="turfType">
                                        <option value="">— select —</option>
                                        @foreach(['golf' => 'Golf', 'sports' => 'Sports Field', 'lawns' => 'Lawns'] as $v => $l)
                                        <option value="{{ $v }}" {{ $turfVal('turfType') === $v ? 'selected' : '' }}>{{ $l }}</option>
                                        @endforeach
                                    </select>
                                </div>
                                <div class="stg-field">
                                    <label for="stg-turf-subcategory">Surface / area</label>
                                    <select id="stg-turf-subcategory" name="subCategory">
                                        <option value="">— select —</option>
                                    </select>
                                </div>
                                <div class="stg-field">
                                    <label for="stg-turf-species">Species</label>
                                    <select id="stg-turf-species" name="species">
                                        <option value="">— select —</option>
                                        @foreach($speciesGroups as $groupLabel => $options)
                                        <optgroup label="{{ $groupLabel }}">
                                            @foreach($options as $sp)
                                            <option value="{{ $sp }}" {{ $turfVal('species') === $sp ? 'selected' : '' }}>{{ $sp }}</option>
                                            @endforeach
                                        </optgroup>
                                        @endforeach
                                    </select>
                                </div>
                                <div class="stg-field">
                                    <label for="stg-turf-variety">Cultivar / variety</label>
                                    <select id="stg-turf-variety" name="variety">
                                        <option value="generic">Generic / Unknown</option>
                                        @if($turfVal('variety') && $turfVal('variety') !== 'generic')
                                        <option value="{{ $turfVal('variety') }}" selected>{{ $turfVal('variety') }}</option>
                                        @endif
                                    </select>
                                </div>
                            </div>
                        </div>

                        {{-- Block 2: Construction --}}
                        <div class="stg-card" style="margin-bottom:16px">
                            <div class="stg-card-head">
                                <div class="stg-card-title">Construction & conditions</div>
                                <div class="stg-card-desc">Rootzone profile and maintenance parameters — affects irrigation scheduling and nutrient interpretation.</div>
                            </div>
                            <div class="stg-form-grid">
                                <div class="stg-field">
                                    <label for="stg-turf-construction">Construction type</label>
                                    <select id="stg-turf-construction" name="construction">
                                        <option value="">— select —</option>
                                        @foreach([
                                            'sand_carpet'  => 'Sand carpet',
                                            'sand_profile' => 'Sand profile (USGA-style)',
                                            'pipe_drained' => 'Pipe drained + slit drained',
                                            'soil'         => 'Soil field',
                                            'hybrid'       => 'Hybrid reinforced',
                                        ] as $v => $l)
                                        <option value="{{ $v }}" {{ $turfVal('construction') === $v ? 'selected' : '' }}>{{ $l }}</option>
                                        @endforeach
                                    </select>
                                </div>
                                <div class="stg-field">
                                    <label for="stg-turf-soil-texture">Soil texture</label>
                                    <select id="stg-turf-soil-texture" name="soilTexture">
                                        @php $tex = $activeSite->soil_texture_override ?? ''; @endphp
                                        <option value="" {{ $tex === '' ? 'selected' : '' }}>— select —</option>
                                        @foreach([
                                            'sand'       => 'Sand / Sand rootzone',
                                            'loamy_sand' => 'Loamy Sand',
                                            'sandy_loam' => 'Sandy Loam',
                                            'loam'       => 'Loam',
                                            'clay_loam'  => 'Clay Loam',
                                            'clay'       => 'Clay',
                                        ] as $v => $l)
                                        <option value="{{ $v }}" {{ $tex === $v ? 'selected' : '' }}>{{ $l }}</option>
                                        @endforeach
                                    </select>
                                </div>
                                <div class="stg-field">
                                    <label for="stg-turf-drainage">Drainage</label>
                                    <select id="stg-turf-drainage" name="drainage">
                                        <option value="">— select —</option>
                                        @foreach([
                                            'excellent' => 'Excellent (>150 mm/hr)',
                                            'good'      => 'Good (100–150 mm/hr)',
                                            'moderate'  => 'Moderate (50–100 mm/hr)',
                                            'poor'      => 'Poor (<50 mm/hr)',
                                        ] as $v => $l)
                                        <option value="{{ $v }}" {{ $turfVal('drainage') === $v ? 'selected' : '' }}>{{ $l }}</option>
                                        @endforeach
                                    </select>
                                </div>
                                <div class="stg-field">
                                    <label for="stg-turf-hoc">Height of cut (mm)</label>
                                    <input type="number" id="stg-turf-hoc" name="hoc"
                                           value="{{ $turfVal('hoc') }}" min="1" max="150" step="0.5" placeholder="e.g. 3">
                                </div>
                            </div>
                        </div>

                        {{-- Block 3: Agronomic program --}}
                        <div class="stg-card" style="margin-bottom:16px">
                            <div class="stg-card-head">
                                <div class="stg-card-title">Soil interpretation & program</div>
                                <div class="stg-card-desc">How soil test results are interpreted and the annual nitrogen budget.</div>
                            </div>
                            <div class="stg-form-grid">
                                <div class="stg-field">
                                    <label for="stg-turf-methodology">Soil test methodology</label>
                                    <select id="stg-turf-methodology" name="methodology">
                                        <option value="">— select —</option>
                                        @php
                                            $methOptions = [
                                                'mlsn'             => 'MLSN — Minimum Levels for Sustainable Nutrition',
                                                'slan'             => 'SLAN — Sufficiency Level of Available Nutrients',
                                                'ammonium_acetate' => 'Ammonium Acetate (Hill Labs NZ)',
                                            ];
                                            $curMeth = $turfVal('methodology');
                                            // Also check site-level override as fallback
                                            if (!$curMeth) $curMeth = $activeSite->methodology_override ?? '';
                                        @endphp
                                        @foreach($methOptions as $v => $l)
                                        <option value="{{ $v }}" {{ $curMeth === $v ? 'selected' : '' }}>{{ $l }}</option>
                                        @endforeach
                                    </select>
                                    <p class="stg-field-hint">MLSN: validated for sand-based greens. SLAN: standard for sports fields, fairways, and lawns.</p>
                                </div>
                                <div class="stg-field">
                                    <label for="stg-turf-n">Annual nitrogen (kg/ha)</label>
                                    <input type="number" id="stg-turf-n" name="nProgram"
                                           value="{{ $turfVal('nProgram') }}" min="0" max="1000" step="1" placeholder="e.g. 150">
                                </div>
                            </div>
                        </div>

                        {{-- Block 4: Composition --}}
                        <div class="stg-card" style="margin-bottom:24px">
                            <div class="stg-card-head">
                                <div class="stg-card-title">Stand composition</div>
                                <div class="stg-card-desc">For mixed or blended stands only. Leave at 0 for pure monocultures.</div>
                            </div>
                            <div class="stg-form-grid">
                                <div class="stg-field">
                                    <label for="stg-turf-poa">Poa annua content (%)</label>
                                    <input type="number" id="stg-turf-poa" name="poaPercent"
                                           value="{{ $turfVal('poaPercent', '0') }}" min="0" max="100" step="1" placeholder="0">
                                    <p class="stg-field-hint">Estimated Poa annua percentage in the stand.</p>
                                </div>
                                <div class="stg-field">
                                    <label for="stg-turf-c3">C3 cover (%)</label>
                                    <input type="number" id="stg-turf-c3" name="c3Cover"
                                           value="{{ $turfVal('c3Cover', '0') }}" min="0" max="100" step="1" placeholder="0">
                                    <p class="stg-field-hint">For overseed or mixed C3/C4 stands — percentage of C3 grass.</p>
                                </div>
                            </div>
                        </div>

                        <div class="stg-actions">
                            <button type="submit" class="stg-btn-primary" id="stg-turf-save">Save turf profile</button>
                            <span class="stg-msg" id="stg-turf-msg" hidden></span>
                        </div>

                    </form>
                </div>

                {{-- ── Zones ────────────────────────────────────────── --}}
                <div class="stg-panel stg-hidden" id="stg-tab-zones" role="tabpanel">
                    <div class="stg-card">
                        <div class="stg-card-head">
                            <div class="stg-card-title">Zones</div>
                            <div class="stg-card-desc">Named areas on this site — used when logging soil, tissue, and spray data.</div>
                        </div>

                        <div class="stg-zone-list" id="stg-zone-list">
                            {{-- populated by JS --}}
                        </div>

                        <div class="stg-zone-add">
                            <input type="text" id="stg-zone-input"
                                   placeholder="New zone name (e.g. Greens)"
                                   maxlength="60" class="stg-zone-input">
                            <button type="button" class="stg-btn-secondary" id="stg-zone-add-btn">Add</button>
                        </div>

                        <div class="stg-actions" style="margin-top:24px">
                            <button type="button" class="stg-btn-primary" id="stg-zones-save">Save zones</button>
                            <span class="stg-msg" id="stg-zones-msg" hidden></span>
                        </div>
                    </div>
                </div>

                {{-- ── Import ───────────────────────────────────────── --}}
                <div class="stg-panel stg-hidden" id="stg-tab-import" role="tabpanel">
                    <div class="stg-card">
                        <div class="stg-card-head">
                            <div class="stg-card-title">Import from old portal</div>
                            <div class="stg-card-desc">
                                Upload the <code>.json</code> file you exported from the previous GAIP Hub
                                (use the <strong>Export</strong> button on the old portal to get the file).
                            </div>
                        </div>

                        {{-- Step 1: file picker --}}
                        <div id="imp-step-idle">
                            <label class="imp-file-label" id="imp-file-label" for="imp-file-input">
                                <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" style="flex-shrink:0">
                                    <path stroke-linecap="round" stroke-linejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5"/>
                                </svg>
                                <span id="imp-file-name">Choose .json file…</span>
                            </label>
                            <input type="file" id="imp-file-input" accept=".json" style="display:none">
                        </div>

                        {{-- Step 2: preview (hidden until file chosen) --}}
                        <div id="imp-step-preview" class="stg-hidden">
                            <div class="imp-found-table" id="imp-found-table"></div>
                            <div class="imp-target-note" id="imp-target-note"></div>
                            <div class="stg-actions" style="margin-top:20px">
                                <button type="button" class="stg-btn-primary" id="imp-run-btn">Import to this site</button>
                                <button type="button" class="stg-btn-secondary" id="imp-cancel-btn">Choose a different file</button>
                                <span class="stg-msg" id="imp-msg" hidden></span>
                            </div>
                        </div>

                        {{-- Step 3: done --}}
                        <div id="imp-step-done" class="stg-hidden">
                            <div class="imp-success" id="imp-success-msg"></div>
                            <div class="stg-actions" style="margin-top:16px">
                                <button type="button" class="stg-btn-secondary" id="imp-again-btn">Import another file</button>
                            </div>
                        </div>
                    </div>
                </div>

                {{-- ── Integrations ─────────────────────────────────── --}}
                <div class="stg-panel stg-hidden" id="stg-tab-integrations" role="tabpanel">

                    {{-- Hydrosight --}}
                    <div class="stg-card" style="margin-bottom:16px">
                        <div class="stg-card-head stg-card-head-row">
                            <div>
                                <div class="stg-card-title">Hydrosight</div>
                                <div class="stg-card-desc">Connect your Hydrosight account to pull live soil moisture readings into the dashboard.</div>
                            </div>
                            <span class="stg-integration-badge" id="stg-hs-badge" hidden>Connected</span>
                        </div>
                        <form id="stg-hydrosight-form" class="stg-form" novalidate>
                            <div class="stg-field stg-field-narrow">
                                <label for="stg-hs-key">API key</label>
                                <input type="password" id="stg-hs-key" name="apiKey"
                                       autocomplete="off" placeholder="Paste your Hydrosight API key">
                                <p class="stg-field-hint">Find your API key in the Hydrosight portal under Account → API.</p>
                            </div>
                            <div class="stg-actions">
                                <button type="submit" class="stg-btn-primary" id="stg-hs-save">Save key</button>
                                <button type="button" class="stg-btn-secondary" id="stg-hs-test">Test connection</button>
                                <span class="stg-msg" id="stg-hs-msg" hidden></span>
                            </div>
                        </form>
                    </div>

                    {{-- SpecConnect --}}
                    <div class="stg-card">
                        <div class="stg-card-head">
                            <div class="stg-card-title">SpecConnect</div>
                            <div class="stg-card-desc">Connect SpecConnect for additional sensor data.</div>
                        </div>
                        <form id="stg-specconnect-form" class="stg-form" novalidate>
                            <div class="stg-field stg-field-narrow">
                                <label for="stg-sc-key">API key</label>
                                <input type="password" id="stg-sc-key" name="apiKey"
                                       autocomplete="off" placeholder="Paste your SpecConnect API key">
                            </div>
                            <div class="stg-actions">
                                <button type="submit" class="stg-btn-primary" id="stg-sc-save">Save key</button>
                                <span class="stg-msg" id="stg-sc-msg" hidden></span>
                            </div>
                        </form>
                    </div>

                </div>{{-- /integrations panel --}}

                @endif

            </div>{{-- /stg-wrap --}}
        </div>{{-- /db-content --}}

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

@if($activeSite)
<script>
window.STG_DATA = {
    activeSiteId: @json($activeSite->id),
    zones:        @json($activeSite->attributes_json['zones'] ?? []),
    csrfToken:    @json(csrf_token()),
    apiBase:      @json(url('/api')),
    gaipConfig:   @json($activeGaipConfig),
};
</script>
<script src="{{ $legacyAssetUrl('gilba-variety-traits.js') }}"></script>
<script src="{{ $legacyAssetUrl('settings-init.js') }}"></script>
@endif

</body>
</html>
