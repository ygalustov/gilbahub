@extends('layouts.app', ['title' => 'Field Log'])

@section('body')
    <link rel="stylesheet" href="{{ url('/legacy-assets/gaip-field-log.css') }}">

    <main class="content">
        <div id="gaip-field-log">
            <div class="gaip-fl-header">
                <span class="gaip-fl-header__title">Field Log</span>
                <span class="gaip-fl-header__logo">Gilba Solutions</span>
            </div>

            <div class="gaip-fl-site-bar" id="gaip-fl-site-bar"></div>
            <div class="gaip-fl-badge-bar" id="gaip-fl-badge-bar"></div>
            <div class="gaip-fl-tiles" id="gaip-fl-tiles"></div>

            <div class="gaip-fl-type-nav" id="gaip-fl-type-nav" role="tablist" aria-label="Observation type"></div>

            <div class="gaip-fl-form-section">
                <div class="gaip-fl-section-title">New observation</div>
                <div id="gaip-fl-form"></div>
            </div>

            <div class="gaip-fl-recent-section">
                <div class="gaip-fl-section-title">Recent - this site</div>
                <div id="gaip-fl-recent"></div>
            </div>

            <div class="gaip-fl-save-bar">
                <button id="gaip-fl-save" type="button">Save</button>
            </div>
        </div>
    </main>

    <script src="{{ url('/legacy-assets/disease-engine-pure.js') }}" defer></script>
    <script src="{{ url('/legacy-assets/gilba-pgr-module-v3.js') }}" defer></script>
    <script src="{{ url('/legacy-assets/sample-manager.js') }}" defer></script>
    <script src="{{ url('/legacy-assets/sample-persistence.js') }}" defer></script>
    <script src="{{ url('/legacy-assets/gaip-field-log-analysis.js') }}" defer></script>
    <script src="{{ url('/legacy-assets/gaip-field-log.js') }}" defer></script>
@endsection
