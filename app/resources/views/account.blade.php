@php
    $legacyAssetUrl = function (string $asset): string {
        $path = base_path('../assets/'.$asset);
        $version = is_file($path) ? '?v='.filemtime($path) : '';
        return url('/legacy-assets/'.$asset).$version;
    };
@endphp
@extends('layouts.db-shell', ['title' => 'Account', 'currentPage' => 'account'])

@section('styles')
<link rel="stylesheet" href="{{ $legacyAssetUrl('settings-ui.css') }}">
<link rel="stylesheet" href="{{ $legacyAssetUrl('data-ui.css') }}">
@endsection

@section('content')
        <div class="db-content stg-scroll">
            <div class="stg-wrap">

                <div class="stg-page-head">
                    <h1 class="stg-page-title">Account</h1>
                </div>

                {{-- ── Tabs ──────────────────────────────────────────── --}}
                <div class="stg-tabs" role="tablist">
                    <button class="stg-tab active" role="tab" data-tab="sites"   aria-selected="true" >Sites</button>
                    @if(in_array($activeSiteRole, ['admin', 'manager']))
                    <button class="stg-tab"         role="tab" data-tab="users"   aria-selected="false">Users</button>
                    @endif
                    <button class="stg-tab"         role="tab" data-tab="profile" aria-selected="false">Profile</button>
                </div>

                {{-- ── Sites ────────────────────────────────────────── --}}
                <div class="stg-panel" id="stg-tab-sites" role="tabpanel">
                    <div class="stg-sites-head">
                        <h2 class="stg-sites-title">All sites</h2>
                        <button type="button" class="stg-btn-primary stg-sites-add-btn" id="stg-add-site-btn">
                            <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4"/></svg>
                            Add site
                        </button>
                    </div>

                    <div class="stg-add-site-form stg-hidden" id="stg-add-site-form">
                        <div class="stg-add-site-form-inner">
                            <input type="text" id="stg-new-site-name" class="stg-input" placeholder="Site name" maxlength="255">
                            <select id="stg-new-site-type" class="stg-select">
                                <option value="precinct">General</option>
                                <option value="golf">Golf</option>
                                <option value="sports">Sports</option>
                                <option value="bowls">Bowls</option>
                                <option value="lawns">Lawns</option>
                            </select>
                            <button type="button" class="stg-btn-primary" id="stg-add-site-save-btn">Create</button>
                            <button type="button" class="stg-btn-ghost" id="stg-add-site-cancel-btn">Cancel</button>
                        </div>
                    </div>

                    <div id="stg-onboard-prompt" class="stg-hidden" style="margin-bottom:12px;padding:14px 16px;background:var(--gaip-surface-muted,#f3f7f5);border:1px solid var(--gaip-border,#d1dbd6);border-radius:8px;display:flex;align-items:center;gap:12px">
                        <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="var(--gaip-accent,#2da85e)" stroke-width="2" style="flex-shrink:0"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z"/></svg>
                        <div style="flex:1;font-size:13px;color:var(--gaip-text,#17231f)">
                            Site created. Would you like to configure it now?
                        </div>
                        <button type="button" id="stg-onboard-yes" class="stg-btn-primary" style="white-space:nowrap">Quick Setup</button>
                        <button type="button" id="stg-onboard-no"  class="stg-btn-ghost"  style="white-space:nowrap">Do it later</button>
                    </div>

                    <div class="dat-table-wrap" style="padding:0;overflow-x:auto">
                        <table class="dat-table stg-sites-table" id="stg-sites-table">
                            <thead>
                                <tr>
                                    <th class="stg-st-sortable" data-col="name">Site <svg class="stg-sort-icon" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 5v14M5 12l7-7 7 7"/></svg></th>
                                    <th class="stg-st-sortable" data-col="location">Location <svg class="stg-sort-icon" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 5v14M5 12l7-7 7 7"/></svg></th>
                                    <th class="stg-st-sortable" data-col="species">Grass <svg class="stg-sort-icon" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 5v14M5 12l7-7 7 7"/></svg></th>
                                    <th class="stg-st-sortable dat-th-num" data-col="soil">Soil <svg class="stg-sort-icon" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 5v14M5 12l7-7 7 7"/></svg></th>
                                    <th class="stg-st-sortable dat-th-num" data-col="water">Water <svg class="stg-sort-icon" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 5v14M5 12l7-7 7 7"/></svg></th>
                                    <th class="stg-st-sortable" data-col="last_run">Last run <svg class="stg-sort-icon" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 5v14M5 12l7-7 7 7"/></svg></th>
                                    <th style="width:44px"></th>
                                </tr>
                            </thead>
                            <tbody id="stg-sites-tbody">
                                {{-- Rendered by JS --}}
                            </tbody>
                        </table>
                    </div>

                    <div id="stg-site-detail" class="dat-detail" style="display:none" aria-live="polite">
                        <div class="dat-detail-header">
                            <div>
                                <div class="dat-detail-title" id="stg-detail-title">—</div>
                                <div class="dat-detail-subtitle" id="stg-detail-subtitle"></div>
                            </div>
                            <div class="dat-detail-actions">
                                <button class="dat-detail-close" id="stg-detail-close" aria-label="Close">×</button>
                            </div>
                        </div>
                        <div id="stg-detail-body" class="dat-detail-body"></div>
                    </div>
                </div>

                @if(in_array($activeSiteRole, ['admin', 'manager']))
                {{-- ── Users panel ─────────────────────────────────── --}}
                <div class="stg-panel stg-hidden" id="stg-tab-users" role="tabpanel">

                    {{-- Current user card --}}
                    @php
                        $me = auth()->user();
                        $myRole = $me->is_admin ? 'Admin' : ucfirst($activeSiteRole ?? 'Viewer');
                        $initials = collect(explode(' ', trim($me->name ?? $me->email)))
                            ->take(2)->map(fn($w) => strtoupper(substr($w,0,1)))->implode('');
                    @endphp
                    <div style="display:flex;align-items:center;gap:14px;padding:16px 20px;background:#f3f7f5;border:1px solid #d4e3da;border-radius:10px;margin-bottom:24px">
                        <div style="width:40px;height:40px;border-radius:50%;background:#2da85e;display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:700;color:#fff;flex-shrink:0;font-family:'Barlow',sans-serif">
                            {{ $initials }}
                        </div>
                        <div style="flex:1;min-width:0">
                            <div style="font-weight:600;font-size:14px;color:#1a2b23">{{ $me->name ?: $me->email }}</div>
                            @if($me->name)
                            <div style="font-size:13px;color:#6b8878;margin-top:2px">{{ $me->email }}</div>
                            @endif
                        </div>
                        <span style="font-size:12px;font-weight:600;padding:3px 10px;border-radius:20px;background:{{ $me->is_admin ? '#1a2b23' : '#e4f0e9' }};color:{{ $me->is_admin ? '#fff' : '#2d7a4e' }}">
                            {{ $myRole }}
                        </span>
                        <span style="font-size:12px;color:#6b8878;flex-shrink:0">You</span>
                    </div>

                    <div id="users-root">

                        <div class="stg-sites-head" style="margin-bottom:16px">
                            <h2 class="stg-sites-title">Users</h2>
                            <button type="button" class="stg-btn-primary" id="users-invite-btn">
                                <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4"/></svg>
                                Invite
                            </button>
                        </div>
                        <div style="display:flex;gap:4px;margin-bottom:20px" id="users-admin-tabs">
                            @if($activeSiteRole === 'admin')
                            <button class="stg-tab active" data-utab="all">All</button>
                            @endif
                            <button class="stg-tab{{ $activeSiteRole !== 'admin' ? ' active' : '' }}" data-utab="active">Active</button>
                            @if($activeSiteRole === 'admin')
                            <button class="stg-tab" data-utab="requests">Requests <span id="users-requests-count" style="display:none" class="badge"></span></button>
                            @endif
                            <button class="stg-tab" data-utab="invitations">Invitations <span id="users-invitations-count" style="display:none" class="badge"></span></button>
                            <button class="stg-tab" data-utab="suspended">Suspended</button>
                        </div>

                        <div style="display:flex;gap:10px;align-items:center;margin-bottom:16px;flex-wrap:wrap" id="users-filters">
                            <input type="text" id="users-search" class="stg-input" placeholder="Search by name, email or site…" readonly onfocus="this.removeAttribute('readonly')" autocomplete="off" style="flex:1;min-width:180px;max-width:320px">
                            <select id="users-site-filter" class="stg-select" style="min-width:160px">
                                <option value="">All sites</option>
                            </select>
                            <select id="users-role-filter" class="stg-select">
                                <option value="">All roles</option>
                                <option value="manager">Manager</option>
                                <option value="editor">Editor</option>
                                <option value="viewer">Viewer</option>
                            </select>
                        </div>

                        <div id="users-active-panel">
                            <div class="dat-table-wrap" style="padding:0;overflow-x:auto">
                                <table class="dat-table" id="users-table">
                                    <thead>
                                        <tr>
                                            <th>Name</th>
                                            <th>Email</th>
                                            <th>Site</th>
                                            <th>Role</th>
                                            <th style="width:40px"></th>
                                        </tr>
                                    </thead>
                                    <tbody id="users-tbody">
                                        <tr><td colspan="5" style="text-align:center;padding:24px;color:#6b8878">Loading…</td></tr>
                                    </tbody>
                                </table>
                            </div>

                            <div id="users-empty" style="display:none;text-align:center;padding:40px 24px;color:#6b8878">
                                <svg width="32" height="32" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5" style="margin:0 auto 12px;display:block;color:#a8c4b2"><path stroke-linecap="round" stroke-linejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
                                <div style="font-weight:600;margin-bottom:6px">No other users yet.</div>
                                <div style="font-size:13px">Invite your team to access and manage sites.</div>
                                <button type="button" class="stg-btn-primary" id="users-invite-empty-btn" style="margin-top:16px">+ Invite user</button>
                            </div>
                        </div>

                        @if($activeSiteRole === 'admin')
                        {{-- Requests tab (admin only) --}}
                        <div id="users-requests-panel" style="display:none">
                            <div id="users-requests-table-wrap" class="dat-table-wrap" style="padding:0;overflow-x:auto">
                                <table class="dat-table">
                                    <thead>
                                        <tr>
                                            <th>Name</th>
                                            <th>Email</th>
                                            <th>Requested</th>
                                            <th style="width:180px"></th>
                                        </tr>
                                    </thead>
                                    <tbody id="users-pending-tbody"></tbody>
                                </table>
                            </div>
                            <div id="users-requests-empty" style="display:none;text-align:center;padding:40px 24px;color:#6b8878">
                                <svg width="32" height="32" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5" style="margin:0 auto 12px;display:block;color:#a8c4b2"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                                <div style="font-weight:600;margin-bottom:6px">No pending requests.</div>
                                <div style="font-size:13px">New access requests will appear here.</div>
                            </div>
                        </div>
                        @endif

                        {{-- Invitations tab --}}
                        <div id="users-invitations-panel" style="display:none">
                            <div id="users-invitations-table-wrap" class="dat-table-wrap" style="padding:0;overflow-x:auto">
                                <table class="dat-table">
                                    <thead>
                                        <tr>
                                            <th>Name</th>
                                            <th>Email</th>
                                            <th>Site</th>
                                            <th>Role</th>
                                            <th>Sent</th>
                                            <th style="width:80px"></th>
                                        </tr>
                                    </thead>
                                    <tbody id="users-invitations-tbody"></tbody>
                                </table>
                            </div>
                            <div id="users-invitations-empty" style="display:none;text-align:center;padding:40px 24px;color:#6b8878">
                                <svg width="32" height="32" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5" style="margin:0 auto 12px;display:block;color:#a8c4b2"><path stroke-linecap="round" stroke-linejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/></svg>
                                <div style="font-weight:600;margin-bottom:6px">No pending invitations.</div>
                                <div style="font-size:13px">Invited users who haven't signed in yet will appear here.</div>
                            </div>
                        </div>

                        {{-- Suspended tab --}}
                        <div id="users-suspended-panel" style="display:none">
                            <div id="users-suspended-table-wrap" class="dat-table-wrap" style="padding:0;overflow-x:auto">
                                <table class="dat-table">
                                    <thead>
                                        <tr><th>Name</th><th>Email</th><th style="width:120px"></th></tr>
                                    </thead>
                                    <tbody id="users-suspended-tbody"></tbody>
                                </table>
                            </div>
                            <div id="users-suspended-empty" style="display:none;text-align:center;padding:40px 24px;color:#6b8878">
                                <svg width="32" height="32" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5" style="margin:0 auto 12px;display:block;color:#a8c4b2"><path stroke-linecap="round" stroke-linejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"/></svg>
                                <div style="font-weight:600;margin-bottom:6px">No suspended accounts.</div>
                                <div style="font-size:13px">Suspended users will appear here.</div>
                            </div>
                        </div>

                        @if($activeSiteRole === 'admin')
                        {{-- All tab (admin only) --}}
                        <div id="users-all-panel" style="display:none">
                            <div id="users-all-table-wrap" class="dat-table-wrap" style="padding:0;overflow-x:auto">
                                <table class="dat-table">
                                    <thead>
                                        <tr>
                                            <th>Name</th>
                                            <th>Email</th>
                                            <th>Site</th>
                                            <th>Role</th>
                                            <th>Status</th>
                                            <th style="width:160px"></th>
                                        </tr>
                                    </thead>
                                    <tbody id="users-all-tbody">
                                        <tr><td colspan="6" style="text-align:center;padding:24px;color:#6b8878">Loading…</td></tr>
                                    </tbody>
                                </table>
                            </div>
                            <div id="users-all-empty" style="display:none;text-align:center;padding:40px 24px;color:#6b8878">
                                <svg width="32" height="32" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5" style="margin:0 auto 12px;display:block;color:#a8c4b2"><path stroke-linecap="round" stroke-linejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
                                <div style="font-weight:600;margin-bottom:6px">No other users yet.</div>
                                <div style="font-size:13px">Invite your team to access and manage sites.</div>
                                <button type="button" class="stg-btn-primary" id="users-all-invite-empty-btn" style="margin-top:16px">+ Invite user</button>
                            </div>
                        </div>
                        @endif

                    </div>{{-- /users-root --}}

                    {{-- Invite modal --}}
                    <div id="users-invite-modal" style="display:none;position:fixed;inset:0;background:rgba(0,0,0,0.4);z-index:1000;align-items:center;justify-content:center">
                        <div style="background:#fff;border-radius:12px;padding:32px;width:100%;max-width:440px;box-shadow:0 8px 32px rgba(0,0,0,0.16);font-family:'Barlow',sans-serif;font-size:14px">
                            <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:24px">
                                <h3 style="font-size:16px;font-weight:700;color:#1a2b23;margin:0">Invite user</h3>
                                <button type="button" id="invite-modal-close" style="background:none;border:none;cursor:pointer;color:#6b8878;padding:4px">
                                    <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
                                </button>
                            </div>

                            <div style="margin-bottom:16px">
                                <label style="display:block;font-size:13px;font-weight:600;color:#3d5c4a;margin-bottom:6px">Name</label>
                                <input type="text" id="invite-name" class="stg-input" style="width:100%" placeholder="Jane Smith" autocomplete="off">
                            </div>

                            <div style="margin-bottom:16px">
                                <label style="display:block;font-size:13px;font-weight:600;color:#3d5c4a;margin-bottom:6px">Email</label>
                                <input type="email" id="invite-email" class="stg-input" style="width:100%" placeholder="colleague@example.com">
                            </div>

                            @if($activeSiteRole === 'admin')
                            <div style="margin-bottom:16px">
                                <label style="display:block;font-size:13px;font-weight:600;color:#3d5c4a;margin-bottom:6px">Sites</label>
                                <div id="invite-sites-wrapper" style="position:relative">
                                    <button type="button" id="invite-sites-toggle" class="stg-select" style="width:100%;text-align:left;cursor:pointer;font-family:'Barlow',sans-serif;font-size:14px;color:#6b8878">
                                        <span id="invite-sites-label">Select sites…</span>
                                    </button>
                                    <div id="invite-sites-dropdown" style="display:none;position:absolute;top:calc(100% + 4px);left:0;right:0;background:#fff;border:1px solid #d1d5db;border-radius:8px;z-index:100;max-height:200px;overflow-y:auto;box-shadow:0 4px 12px rgba(0,0,0,.1);padding:4px 0" id="invite-sites-list">
                                    </div>
                                </div>
                            </div>
                            @endif

                            <div style="margin-bottom:24px">
                                <label style="display:block;font-size:13px;font-weight:600;color:#3d5c4a;margin-bottom:10px">Role</label>
                                <div style="display:flex;flex-direction:column;gap:8px">
                                    <label style="display:flex;align-items:center;gap:8px;cursor:pointer"><input type="radio" name="invite-role" value="manager" checked> Manager</label>
                                    <label style="display:flex;align-items:center;gap:8px;cursor:pointer"><input type="radio" name="invite-role" value="editor"> Editor</label>
                                    <label style="display:flex;align-items:center;gap:8px;cursor:pointer"><input type="radio" name="invite-role" value="viewer"> Viewer</label>
                                </div>
                            </div>

                            <div id="invite-modal-error" style="display:none;margin-bottom:12px;font-size:13px;color:#dc2626"></div>

                            <div style="display:flex;gap:10px">
                                <button type="button" id="invite-submit-btn" class="stg-btn-primary" style="flex:1">Send invitation</button>
                                <button type="button" id="invite-cancel-btn" class="stg-btn-ghost">Cancel</button>
                            </div>
                        </div>
                    </div>

                </div>{{-- /users panel --}}
                @endif

                {{-- ── Profile panel ───────────────────────────────── --}}
                <div class="stg-panel stg-hidden" id="stg-tab-profile" role="tabpanel">
                    <h2 style="font-size:16px;font-weight:700;color:#1a2b23;margin-bottom:24px">Profile</h2>

                    <div class="stg-card" style="margin-bottom:20px">
                        <h3 style="font-size:13px;font-weight:700;color:#3d5c4a;text-transform:uppercase;letter-spacing:.5px;margin-bottom:16px">Account</h3>

                        <div style="margin-bottom:16px">
                            <label class="stg-label" for="profile-name">Name</label>
                            <div style="display:flex;gap:10px;align-items:flex-start">
                                <input type="text" id="profile-name" class="stg-input" value="{{ auth()->user()->name }}" style="flex:1;max-width:320px">
                                <button type="button" id="profile-name-save" class="stg-btn-primary">Save</button>
                            </div>
                            <div id="profile-name-msg" style="font-size:12px;margin-top:6px;display:none"></div>
                        </div>

                        <div>
                            <label class="stg-label">Email</label>
                            <div style="font-size:14px;color:#1a2b23;padding:10px 0">{{ auth()->user()->email }}</div>
                        </div>
                    </div>

                    <div class="stg-card">
                        <h3 style="font-size:13px;font-weight:700;color:#3d5c4a;text-transform:uppercase;letter-spacing:.5px;margin-bottom:16px">Security</h3>

                        <div>
                            <label class="stg-label">Password</label>
                            @if(!auth()->user()->password_hash)
                            <div style="font-size:13px;color:#6b8878;margin-bottom:10px">You're signing in with Magic Link only.</div>
                            <button type="button" id="set-password-btn" class="stg-btn-primary">Set a password</button>
                            @else
                            <div style="font-size:13px;color:#6b8878;margin-bottom:10px">
                                Last changed: {{ auth()->user()->updated_at?->format('j F Y') }}
                            </div>
                            <button type="button" id="change-password-btn" class="stg-btn-primary">Change password</button>
                            @endif
                        </div>
                    </div>

                    <div id="password-modal" style="display:none;position:fixed;inset:0;background:rgba(0,0,0,0.4);z-index:1000;align-items:center;justify-content:center">
                        <div style="background:#fff;border-radius:12px;padding:32px;width:100%;max-width:420px;box-shadow:0 8px 32px rgba(0,0,0,0.16);font-family:'Barlow',sans-serif;font-size:14px">
                            <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:24px">
                                <h3 id="pw-modal-title" style="font-size:16px;font-weight:700;color:#1a2b23;margin:0">Set password</h3>
                                <button type="button" id="pw-modal-close" style="background:none;border:none;cursor:pointer;color:#6b8878;padding:4px">
                                    <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
                                </button>
                            </div>

                            <div id="pw-current-field" style="margin-bottom:16px;display:none">
                                <label style="display:block;font-size:13px;font-weight:600;color:#3d5c4a;margin-bottom:6px">Current password</label>
                                <input type="password" id="pw-current" class="stg-input" style="width:100%" autocomplete="current-password">
                                <a href="#" id="pw-forgot-link" style="font-size:12px;color:#2da85e;display:block;margin-top:6px">Forgot current password? Send Magic Link</a>
                            </div>
                            <div style="margin-bottom:16px">
                                <label style="display:block;font-size:13px;font-weight:600;color:#3d5c4a;margin-bottom:6px">New password</label>
                                <input type="password" id="pw-new" class="stg-input" style="width:100%" autocomplete="new-password">
                            </div>
                            <div style="margin-bottom:24px">
                                <label style="display:block;font-size:13px;font-weight:600;color:#3d5c4a;margin-bottom:6px">Confirm password</label>
                                <input type="password" id="pw-confirm" class="stg-input" style="width:100%" autocomplete="new-password">
                            </div>

                            <div id="pw-modal-error" style="display:none;margin-bottom:12px;font-size:13px;color:#dc2626"></div>
                            <div id="pw-modal-success" style="display:none;margin-bottom:12px;font-size:13px;color:#2da85e"></div>

                            <div style="display:flex;gap:10px">
                                <button type="button" id="pw-submit-btn" class="stg-btn-primary" style="flex:1">Save password</button>
                                <button type="button" id="pw-cancel-btn" class="stg-btn-ghost">Cancel</button>
                            </div>
                        </div>
                    </div>

                </div>{{-- /profile panel --}}

            </div>{{-- /stg-wrap --}}
        </div>{{-- /db-content --}}

@endsection

@section('scripts')
<script>
window.STG_DATA = {
    activeSiteId:      @json(auth()->user()->last_active_site_id),
    sitesTableData:    @json($sitesTableData),
    activeSiteRole:    @json($activeSiteRole),
    csrfToken:         @json(csrf_token()),
    apiBase:           @json(url('/api')),
    hasPassword:       @json(!empty(auth()->user()->password_hash)),
    openPasswordModal: @json(session('open_password_modal', false)),
    userEmail:         @json(auth()->user()->email),
};
</script>
<script src="{{ $legacyAssetUrl('account-init.js') }}"></script>
@endsection
