@extends('layouts.app', ['title' => 'Hub'])

@section('body')
    <main class="content">
        <section class="panel">
            <h1>Gilba Hub</h1>
            <p class="muted">Laravel authentication is active. WordPress hub migration will start from this protected page.</p>

            <h2 class="section-title">Sites</h2>
            <form id="site-create-form" class="site-form">
                <strong>Create Site</strong>
                <div class="form-grid">
                    <div>
                        <label for="site-name">Name</label>
                        <input id="site-name" name="name" type="text" required placeholder="e.g. Main Stadium">
                    </div>
                    <div>
                        <label for="site-location">Location</label>
                        <input id="site-location" name="location_name" type="text" placeholder="e.g. Sydney, NSW">
                    </div>
                    <div>
                        <label for="site-timezone">Timezone</label>
                        <input id="site-timezone" name="timezone" type="text" value="Australia/Sydney">
                    </div>
                    <div>
                        <label for="site-latitude">Latitude</label>
                        <input id="site-latitude" name="latitude" type="number" step="0.0000001" min="-90" max="90">
                    </div>
                    <div>
                        <label for="site-longitude">Longitude</label>
                        <input id="site-longitude" name="longitude" type="number" step="0.0000001" min="-180" max="180">
                    </div>
                </div>
                <div class="form-actions">
                    <button class="primary" type="submit">Create Site</button>
                    <span id="site-create-status" class="muted"></span>
                </div>
            </form>

            <form id="site-edit-form" class="site-form site-edit-panel" hidden>
                <strong>Edit Site</strong>
                <input name="id" type="hidden">
                <div class="form-grid">
                    <div>
                        <label for="edit-site-name">Name</label>
                        <input id="edit-site-name" name="name" type="text" required>
                    </div>
                    <div>
                        <label for="edit-site-location">Location</label>
                        <input id="edit-site-location" name="location_name" type="text">
                    </div>
                    <div>
                        <label for="edit-site-timezone">Timezone</label>
                        <input id="edit-site-timezone" name="timezone" type="text">
                    </div>
                    <div>
                        <label for="edit-site-latitude">Latitude</label>
                        <input id="edit-site-latitude" name="latitude" type="number" step="0.0000001" min="-90" max="90">
                    </div>
                    <div>
                        <label for="edit-site-longitude">Longitude</label>
                        <input id="edit-site-longitude" name="longitude" type="number" step="0.0000001" min="-180" max="180">
                    </div>
                </div>
                <div class="form-actions">
                    <button class="primary" type="submit">Save Changes</button>
                    <button id="site-edit-cancel" class="secondary" type="button">Cancel</button>
                    <span id="site-edit-status" class="muted"></span>
                </div>
            </form>

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
            var csrf = document.querySelector('meta[name="csrf-token"]').getAttribute('content');
            var status = document.getElementById('site-status');
            var list = document.getElementById('site-list');
            var createForm = document.getElementById('site-create-form');
            var createStatus = document.getElementById('site-create-status');
            var editForm = document.getElementById('site-edit-form');
            var editStatus = document.getElementById('site-edit-status');
            var editCancel = document.getElementById('site-edit-cancel');
            var sites = [];

            function text(value) {
                return value === null || value === undefined || value === '' ? 'Not set' : String(value);
            }

            function nullableValue(value) {
                return value === undefined || value === null || String(value).trim() === '' ? null : String(value).trim();
            }

            function nullableNumber(value) {
                return value === undefined || value === null || String(value).trim() === '' ? null : Number(value);
            }

            function formPayload(form) {
                var data = new FormData(form);
                return {
                    name: nullableValue(data.get('name')),
                    location_name: nullableValue(data.get('location_name')),
                    timezone: nullableValue(data.get('timezone')),
                    latitude: nullableNumber(data.get('latitude')),
                    longitude: nullableNumber(data.get('longitude'))
                };
            }

            function request(url, method, payload) {
                return fetch(url, {
                    method: method,
                    headers: {
                        'Accept': 'application/json',
                        'Content-Type': 'application/json',
                        'X-CSRF-TOKEN': csrf
                    },
                    body: JSON.stringify(payload)
                }).then(function (response) {
                    return response.json().catch(function () {
                        return {};
                    }).then(function (body) {
                        if (!response.ok) {
                            var message = body.message || 'Request failed (' + response.status + ')';
                            throw new Error(message);
                        }
                        return body;
                    });
                });
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

                var edit = document.createElement('button');
                edit.className = 'secondary compact-button';
                edit.type = 'button';
                edit.textContent = 'Edit';
                edit.addEventListener('click', function () {
                    showEdit(site);
                });

                row.appendChild(summary);
                row.appendChild(badge);
                row.appendChild(edit);

                return row;
            }

            function renderSites() {
                list.innerHTML = '';

                if (!sites.length) {
                    status.textContent = 'No sites found.';
                    return;
                }

                status.textContent = sites.length === 1 ? '1 site loaded.' : sites.length + ' sites loaded.';
                sites.forEach(function (site) {
                    list.appendChild(renderSite(site));
                });
            }

            function loadSites() {
                status.textContent = 'Loading sites...';

                return fetch('/api/sites', {
                    headers: { 'Accept': 'application/json' }
                })
                    .then(function (response) {
                        if (!response.ok) {
                            throw new Error('Could not load sites (' + response.status + ')');
                        }
                        return response.json();
                    })
                    .then(function (payload) {
                        sites = payload.data || [];
                        renderSites();
                    })
                    .catch(function (error) {
                        status.textContent = error.message;
                    });
            }

            function showEdit(site) {
                editForm.hidden = false;
                editStatus.textContent = '';
                editForm.elements.id.value = site.id;
                editForm.elements.name.value = site.name || '';
                editForm.elements.location_name.value = site.location_name || '';
                editForm.elements.timezone.value = site.timezone || '';
                editForm.elements.latitude.value = site.latitude || '';
                editForm.elements.longitude.value = site.longitude || '';
                editForm.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            }

            createForm.addEventListener('submit', function (event) {
                event.preventDefault();
                createStatus.textContent = 'Saving...';

                request('/api/sites', 'POST', formPayload(createForm))
                    .then(function () {
                        createForm.reset();
                        createForm.elements.timezone.value = 'Australia/Sydney';
                        createStatus.textContent = 'Site created.';
                        return loadSites();
                    })
                    .catch(function (error) {
                        createStatus.textContent = error.message;
                    });
            });

            editForm.addEventListener('submit', function (event) {
                event.preventDefault();
                editStatus.textContent = 'Saving...';

                request('/api/sites/' + editForm.elements.id.value, 'PATCH', formPayload(editForm))
                    .then(function () {
                        editStatus.textContent = 'Changes saved.';
                        return loadSites();
                    })
                    .catch(function (error) {
                        editStatus.textContent = error.message;
                    });
            });

            editCancel.addEventListener('click', function () {
                editForm.hidden = true;
                editStatus.textContent = '';
            });

            loadSites();
        })();
    </script>
@endsection
