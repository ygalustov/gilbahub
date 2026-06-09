<header class="db-topbar">
    {{-- Site switcher --}}
    <div class="db-site-switcher-wrap" id="db-site-switcher-wrap" style="position:relative">
        @php $activeSiteStatus = ($siteStatusMap ?? [])[ ($activeSite ?? null)?->id ?? '' ] ?? null; @endphp
        <button class="db-site-switcher" id="db-site-switcher-btn" type="button"
                aria-haspopup="listbox" aria-expanded="false">
            <span class="db-site-status-dot{{ $activeSiteStatus ? ' db-site-status-dot--'.$activeSiteStatus : '' }}" id="db-site-status-dot"></span>
            <span id="db-site-name">{{ ($activeSite ?? null)?->name ?? 'Select site' }}</span>
            <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
                <path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7"/>
            </svg>
        </button>
        <div class="db-site-dropdown" id="db-site-dropdown" hidden
             style="position:absolute;top:calc(100% + 6px);left:0;z-index:200;min-width:200px;background:#fff;border:1px solid #d8e0dc;border-radius:8px;box-shadow:0 4px 16px rgba(0,0,0,.12);overflow:hidden">
            @foreach($allSites ?? [] as $site)
            @php $siteStatus = ($siteStatusMap ?? [])[$site->id] ?? null; @endphp
            <button type="button"
                    class="db-site-option{{ $site->id === ($activeSite ?? null)?->id ? ' active' : '' }}"
                    data-site-id="{{ $site->id }}"
                    style="display:flex;align-items:center;gap:8px;width:100%;padding:10px 16px;border:0;background:{{ $site->id === ($activeSite ?? null)?->id ? '#e8f3ed' : 'transparent' }};text-align:left;cursor:pointer;font:inherit;font-size:14px;color:#17231f">
                <span class="db-site-status-dot{{ $siteStatus ? ' db-site-status-dot--'.$siteStatus : '' }}" style="background:{{ $siteStatus === 'green' ? '#16a34a' : ($siteStatus === 'amber' ? '#d97706' : ($siteStatus === 'red' ? '#dc2626' : '#d1d5db')) }}"></span>
                {{ $site->name }}
            </button>
            @endforeach
        </div>
    </div>

    {{-- Context pills --}}
    <div class="db-context-pills" id="db-context-pills">
        @if($turfMethodology ?? null)
            <span class="db-pill">{{ $turfMethodology }}</span>
        @endif
        <span class="db-pill" id="db-pill-species">{{ $turfSpecies ?? '' }}</span>
        <span class="db-pill" id="db-pill-region">{{ $locationName ?? '' }}</span>
    </div>

    <div class="db-topbar-right">
        <span class="db-analysis-ts" id="db-analysis-ts">{{ $analysisTs ? 'Analysis: '.$analysisTs : 'Analysis: —' }}</span>
        <button class="db-rerun-btn" id="db-rerun-btn" type="button">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                <polygon points="5,3 19,12 5,21"/>
            </svg>
            Re-run
        </button>
    </div>

    {{-- Mobile-only: account + settings icons --}}
    <div class="db-topbar-mobile">
        <a href="{{ route('account') }}"
           style="display:flex;align-items:center;justify-content:center;width:34px;height:34px;border-radius:8px;color:rgba(255,255,255,0.55);text-decoration:none;position:relative;transition:color .15s"
           title="Account">
            <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/>
            </svg>
            @if(($pendingRequestsCount ?? 0) > 0)
                <span style="position:absolute;top:3px;right:3px;width:8px;height:8px;background:#ef4444;border-radius:50%"></span>
            @endif
        </a>
        <a href="{{ route('settings') }}"
           style="display:flex;align-items:center;justify-content:center;width:34px;height:34px;border-radius:8px;color:rgba(255,255,255,0.55);text-decoration:none;transition:color .15s"
           title="Settings">
            <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/>
                <circle cx="12" cy="12" r="3"/>
            </svg>
        </a>
    </div>
</header>
