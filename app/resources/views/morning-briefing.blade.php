@extends('layouts.app', ['title' => 'Morning Briefing'])

@section('body')
    <main class="content">
        <div id="gaip-morning-briefing" style="font-family:system-ui,sans-serif;padding:0;">
            <div style="padding:20px;color:#94a3b8;font-size:0.9em;">Loading briefing...</div>
        </div>
    </main>
@endsection

@section('scripts')
    <script>
        window.GILBA_PLUGIN_NS = 'gaip';
    </script>
    <script src="{{ url('/legacy-assets/gilba-storage-ns.js') }}"></script>
    <script src="{{ url('/legacy-assets/sample-manager.js') }}" defer></script>
    <script src="{{ url('/legacy-assets/gilba-pgr-module-v3.js') }}" defer></script>
    <script src="{{ url('/legacy-assets/site-config-persistence.js') }}" defer></script>
    <script src="{{ url('/legacy-assets/gaip-morning-briefing.js') }}" defer></script>
@endsection
