{{-- Reports sub-navigation tabs --}}
<nav class="gl-tabs-bar" style="border-bottom:1px solid var(--gaip-border);background:var(--gaip-surface)">
    <div class="gl-tabs-inner">

        <a href="{{ route('reports.export') }}"
           class="gl-tab{{ $tab === 'export' ? ' active' : '' }}">
            <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5" style="flex-shrink:0">
                <path stroke-linecap="round" stroke-linejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3M3 17V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z"/>
            </svg>
            Export
        </a>

        <a href="{{ route('reports.forensic') }}"
           class="gl-tab{{ $tab === 'forensic' ? ' active' : '' }}">
            <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5" style="flex-shrink:0">
                <path stroke-linecap="round" stroke-linejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2"/>
                <rect x="9" y="3" width="6" height="4" rx="1"/>
                <path stroke-linecap="round" d="M9 12h6M9 16h4"/>
            </svg>
            Forensic Record
        </a>

        <a href="{{ route('reports.scenarios') }}"
           class="gl-tab{{ $tab === 'scenarios' ? ' active' : '' }}">
            <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5" style="flex-shrink:0">
                <path stroke-linecap="round" stroke-linejoin="round" d="M8 7h12m0 0l-4-4m4 4l-4 4M4 17H0m0 0l4 4m-4-4l4-4"/>
            </svg>
            Scenarios
        </a>

        <a href="{{ route('reports.accuracy') }}"
           class="gl-tab{{ $tab === 'accuracy' ? ' active' : '' }}">
            <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5" style="flex-shrink:0">
                <path stroke-linecap="round" stroke-linejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/>
            </svg>
            Accuracy
        </a>

    </div>
</nav>
