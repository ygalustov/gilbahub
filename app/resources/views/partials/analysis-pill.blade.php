{{--
    GH-548 (stage 3) — the topbar's "Analysis: <date>" pill.

    Rendered by the server from the projection, and no longer rewritten by
    JavaScript after load: `dashboard-ui.js` and `dashboard-init.js` both
    re-derived this label from `analyzedAt`, which can only say the date, so on a
    site whose last re-run failed they overwrote the mark that said so.

    Expects (all optional): $analysisCache — the projection; $activeSite — the site.
--}}
@php
    $anPillSite = $activeSite ?? auth()->user()?->activeSite;
@endphp
<span class="db-analysis-ts" id="db-analysis-ts">{{ \App\Support\AnalysisNotice::pill($analysisCache ?? null, $anPillSite?->timezone) }}</span>
<script>
    {{-- The reason map, rendered from the one place the words are written. The
         browser looks a code up in it and never composes a sentence of its own.
         It rides with the PILL rather than the panel because the pill is on every
         screen with a topbar — Settings included, where an import's re-run can
         fail on a page that prints no analysis numbers and therefore has no
         panel. --}}
    {{-- GH-640 (link 11): the projection travels too, so the server can compose
         the sentence for every empty section and the page prints it instead of
         deciding for itself why a section has nothing in it. --}}
    window.GAIP_ANALYSIS_TEXTS = @json(\App\Support\AnalysisNotice::clientTexts($analysisCache ?? null));
</script>
