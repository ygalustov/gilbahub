@extends('layouts.app', ['title' => 'Hub'])

@section('body')
    <main class="content">
        <section class="panel">
            <h1>Gilba Hub</h1>
            <p class="muted">Laravel authentication is active. WordPress hub migration will start from this protected page.</p>

            <h2 class="section-title">Sites</h2>
            <p id="site-status" class="status-line">Loading sites...</p>
            <div id="site-list" class="site-list" aria-live="polite"></div>

            <h2 class="section-title">Modules</h2>
            <div class="grid">
                <a class="card" href="{{ route('field-log') }}">
                    <strong>Field Log</strong>
                    <span class="muted">Placeholder route for observations.</span>
                </a>
                <a class="card" href="{{ route('morning-briefing') }}">
                    <strong>Morning Briefing</strong>
                    <span class="muted">Placeholder route for daily summaries.</span>
                </a>
                <a class="card" href="{{ route('stadium') }}">
                    <strong>Stadium</strong>
                    <span class="muted">Placeholder route for GSSH mode.</span>
                </a>
                <a class="card" href="{{ route('settings') }}">
                    <strong>Settings</strong>
                    <span class="muted">Placeholder route for account and site settings.</span>
                </a>
            </div>
        </section>
    </main>

    <script>
        (function () {
            var status = document.getElementById('site-status');
            var list = document.getElementById('site-list');

            function text(value) {
                return value === null || value === undefined || value === '' ? 'Not set' : String(value);
            }

            function renderSite(site) {
                var row = document.createElement('div');
                row.className = 'site-row';

                var summary = document.createElement('div');

                var name = document.createElement('strong');
                name.textContent = site.name;
                summary.appendChild(name);

                var meta = document.createElement('div');
                meta.className = 'site-meta';
                meta.textContent = [
                    'Location: ' + text(site.location_name),
                    'Timezone: ' + text(site.timezone),
                    'GAIP config: ' + (site.configs && site.configs.gaip ? 'ready' : 'missing')
                ].join(' | ');
                summary.appendChild(meta);

                var badge = document.createElement('span');
                badge.className = 'pill';
                badge.textContent = site.slug || 'site';

                row.appendChild(summary);
                row.appendChild(badge);

                return row;
            }

            fetch('/api/sites', {
                headers: {
                    'Accept': 'application/json'
                }
            })
                .then(function (response) {
                    if (!response.ok) {
                        throw new Error('Could not load sites (' + response.status + ')');
                    }
                    return response.json();
                })
                .then(function (payload) {
                    var sites = payload.data || [];
                    list.innerHTML = '';

                    if (!sites.length) {
                        status.textContent = 'No sites found.';
                        return;
                    }

                    status.textContent = sites.length === 1 ? '1 site loaded.' : sites.length + ' sites loaded.';
                    sites.forEach(function (site) {
                        list.appendChild(renderSite(site));
                    });
                })
                .catch(function (error) {
                    status.textContent = error.message;
                });
        })();
    </script>
@endsection
