@php
    $legacyAssetUrl = function (string $asset): string {
        $path = base_path('../assets/'.$asset);
        $version = is_file($path) ? '?v='.filemtime($path) : '';
        return url('/legacy-assets/'.$asset).$version;
    };
@endphp
@extends('layouts.db-shell', ['title' => 'Settings', 'currentPage' => 'settings'])

@section('styles')
<link rel="stylesheet" href="{{ $legacyAssetUrl('settings-ui.css') }}">
@endsection

@section('content')
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
                        // coolOverseed (settings key) and overseedSpecies (hub key) are synonyms — accept either.
                        $turfVal = function(string $k, $fallback = '') use ($turf) {
                            if (isset($turf[$k]) && $turf[$k] !== '') return $turf[$k];
                            if ($k === 'coolOverseed' && isset($turf['overseedSpecies']) && $turf['overseedSpecies'] !== '') return $turf['overseedSpecies'];
                            if ($k === 'overseedSpecies' && isset($turf['coolOverseed']) && $turf['coolOverseed'] !== '') return $turf['coolOverseed'];
                            return $fallback;
                        };

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
                                <div class="stg-card-desc">Only needed for mixed or overseeded stands. For a pure monoculture leave Overseed blank and set C3 cover to 0 or 100.</div>
                            </div>
                            <div class="stg-form-grid">
                                <div class="stg-field">
                                    <label for="stg-turf-cool-overseed">Overseed species</label>
                                    <select id="stg-turf-cool-overseed" name="overseedSpecies">
                                        <option value="">— none —</option>
                                        @foreach([
                                            'Warm-season (C4)' => ['Couch', 'Bermuda', 'Kikuyu', 'Zoysia', 'Seashore Paspalum', 'Buffalo'],
                                            'Cool-season (C3)' => ['Perennial Ryegrass', 'Annual Ryegrass', 'Tall Fescue', 'Fine Fescue', 'Kentucky Bluegrass', 'Creeping Bentgrass'],
                                        ] as $overseedGroup => $overseedSpecies)
                                        <optgroup label="{{ $overseedGroup }}">
                                            @foreach($overseedSpecies as $sp)
                                            <option value="{{ $sp }}" {{ $turfVal('overseedSpecies') === $sp ? 'selected' : '' }}>{{ $sp }}</option>
                                            @endforeach
                                        </optgroup>
                                        @endforeach
                                    </select>
                                    <p class="stg-field-hint">The grass species overseeded onto the base. Typically cool-season (C3) overseeded onto warm-season (C4) for winter play.</p>
                                </div>
                                <div class="stg-field">
                                    <label for="stg-turf-overseed-status">Overseed status</label>
                                    <select id="stg-turf-overseed-status" name="overseedStatus">
                                        @foreach(['none' => 'None / not overseeded', 'establishing' => 'Establishing', 'established' => 'Established', 'dominant' => 'Dominant'] as $v => $l)
                                        <option value="{{ $v }}" {{ $turfVal('overseedStatus', 'none') === $v ? 'selected' : '' }}>{{ $l }}</option>
                                        @endforeach
                                    </select>
                                    <p class="stg-field-hint">Current state of the overseed component.</p>
                                </div>
                                <div class="stg-field">
                                    <label for="stg-turf-c3">C3 cover (%)</label>
                                    <input type="number" id="stg-turf-c3" name="c3Cover"
                                           value="{{ $turfVal('c3Cover', '0') }}" min="0" max="100" step="1" placeholder="0">
                                    <p class="stg-field-hint">Percentage of surface covered by cool-season (C3) grass. 0 = pure C4, 100 = pure C3.</p>
                                </div>
                                <div class="stg-field">
                                    <label for="stg-turf-poa">Poa annua content (%)</label>
                                    <input type="number" id="stg-turf-poa" name="poaPercent"
                                           value="{{ $turfVal('poaPercent', '0') }}" min="0" max="100" step="1" placeholder="0">
                                    <p class="stg-field-hint">Estimated Poa annua percentage in the stand.</p>
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

@endsection

@section('scripts')
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

@endsection
