{{--
    GH-548 (stage 3) — THE PANEL THAT SAYS WHAT THE NUMBERS ON THIS PAGE ARE.

    One markup, one text source, six screens. Before this it existed on three of
    them (analysis, growth-light, disease) as three copies of the same block,
    and the text was built twice in JavaScript out of `analyzedAt` — so the only
    thing it could ever say was how old the data was. A re-run that did not
    complete said nothing at all, anywhere.

    The text comes from `App\Support\AnalysisNotice`, which is a function of the
    projection (`AnalysisResults::forSite`) and the site's own timezone: not of
    this page, not of a global, not of a browser copy.

    The element is always rendered, hidden when there is nothing to say, because
    the opener fills it the moment a re-run fails — the page does not reload on a
    failure, and the person who pressed the button is the one who most needs to
    know why nothing happened.

    Expects (all optional): $analysisCache — the projection; $activeSite — the site.
--}}
@php
    $anSite   = $activeSite ?? auth()->user()?->activeSite;
    $anNotice = \App\Support\AnalysisNotice::panel($analysisCache ?? null, $anSite?->timezone);
    // GH-581 (stage 2): what the run went ahead on in place of something it
    // was not given. Its own element, because it must appear on a run that went
    // perfectly — that is the case it exists for — and because an assumption is
    // not a gap and must not be printed as one.
    $anAssumed = \App\Support\AnalysisNotice::assumptions($analysisCache ?? null);
@endphp
<div id="db-analysis-notice"
     class="db-verdict {{ $anNotice['level'] ?? 'warning' }}"
     style="{{ $anNotice ? '' : 'display:none' }}">
    <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5" style="flex-shrink:0">
        <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
    </svg>
    <span id="db-analysis-notice-text">{{ $anNotice['text'] ?? '' }}</span>
    {{-- GH-557: everything the run said while it ran. Seven explanations per run
         used to reach a console nobody had open; they belong under the sentence
         that says something is missing, folded away until asked for.
         GH-743: for an administrator only, the owner's decision. The run's own records are for
         diagnosis; a client gets the sentence above and not the lines, which are not rendered
         for them at all. The admin type in this product is `users.is_admin`. --}}
    @if(!empty($anNotice['details']) && auth()->user()?->is_admin)
        <details id="db-analysis-notice-details" style="margin-left:12px;font-size:12px">
            <summary style="cursor:pointer;opacity:.8">Details ({{ count($anNotice['details']) }})</summary>
            <ul style="margin:6px 0 0;padding-left:18px;line-height:1.5">
                @foreach($anNotice['details'] as $line)
                    <li>{{ $line }}</li>
                @endforeach
            </ul>
        </details>
    @endif
    <button id="db-analysis-notice-dismiss" type="button"
            style="margin-left:auto;background:none;border:none;color:inherit;opacity:.75;cursor:pointer;font-size:13px;padding:0 4px">
        Dismiss ✕
    </button>
</div>

<div id="db-analysis-assumptions"
     class="db-verdict info"
     style="{{ $anAssumed ? '' : 'display:none' }}">
    <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5" style="flex-shrink:0">
        <path stroke-linecap="round" stroke-linejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
    </svg>
    <span id="db-analysis-assumptions-text">
        @if(count($anAssumed) === 1)
            {{ $anAssumed[0] }}
        @else
            The analysis ran on {{ count($anAssumed) }} settings that are not filled in.
        @endif
    </span>
    @if(count($anAssumed) > 1)
        <details id="db-analysis-assumptions-details" style="margin-left:12px;font-size:12px">
            <summary style="cursor:pointer;opacity:.8">Which ones</summary>
            <ul style="margin:6px 0 0;padding-left:18px;line-height:1.5">
                @foreach($anAssumed as $line)
                    <li>{{ $line }}</li>
                @endforeach
            </ul>
        </details>
    @endif
</div>
