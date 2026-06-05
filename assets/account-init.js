/* account-init.js — Account page logic (Sites / Users / Profile) */
(function () {
    'use strict';

    var D       = window.STG_DATA || {};
    var siteId  = D.activeSiteId || null;
    var apiBase = (D.apiBase || '').replace(/\/$/, '');
    var csrf    = D.csrfToken || '';

    /* ── Tab switching ───────────────────────────────────────── */
    function activateTab(tabKey) {
        if (!tabKey) return;
        document.querySelectorAll('.stg-tab[data-tab]').forEach(function (t) {
            t.classList.remove('active');
            t.setAttribute('aria-selected', 'false');
        });
        document.querySelectorAll('.stg-panel').forEach(function (p) {
            p.classList.add('stg-hidden');
        });
        var tab = document.querySelector('.stg-tab[data-tab="' + tabKey + '"]');
        if (tab) { tab.classList.add('active'); tab.setAttribute('aria-selected', 'true'); }
        var panel = document.getElementById('stg-tab-' + tabKey);
        if (panel) panel.classList.remove('stg-hidden');
    }

    document.querySelectorAll('.stg-tab[data-tab]').forEach(function (tab) {
        tab.addEventListener('click', function () { activateTab(tab.dataset.tab); });
    });

    if (location.hash) {
        var hashKey = location.hash.slice(1);
        if (document.querySelector('.stg-tab[data-tab="' + hashKey + '"]')) {
            activateTab(hashKey);
        }
    }

    /* ── Helpers ─────────────────────────────────────────────── */
    function apiFetch(method, path, body) {
        return fetch(apiBase + path, {
            method: method,
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                'X-CSRF-TOKEN': csrf,
            },
            body: body ? JSON.stringify(body) : undefined,
        }).then(function (r) {
            return r.text().then(function (text) {
                var data;
                try { data = JSON.parse(text); } catch (e) { data = {}; }
                if (!r.ok) return Promise.reject({ _status: r.status, message: data.message || '' });
                return data;
            });
        });
    }

    function escHtml(str) {
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    /* ── Sites tab ───────────────────────────────────────────── */
    (function initSitesTab() {
        var sitesData    = (D.sitesTableData && Array.isArray(D.sitesTableData)) ? D.sitesTableData.slice() : [];
        var tbody        = document.getElementById('stg-sites-tbody');
        var detailPanel  = document.getElementById('stg-site-detail');
        var detailTitle  = document.getElementById('stg-detail-title');
        var detailSub    = document.getElementById('stg-detail-subtitle');
        var detailBody   = document.getElementById('stg-detail-body');
        var detailClose  = document.getElementById('stg-detail-close');
        var addBtn       = document.getElementById('stg-add-site-btn');
        var addForm      = document.getElementById('stg-add-site-form');
        var addNameEl    = document.getElementById('stg-new-site-name');
        var addTypeEl    = document.getElementById('stg-new-site-type');
        var addSaveBtn   = document.getElementById('stg-add-site-save-btn');
        var addCancelBtn = document.getElementById('stg-add-site-cancel-btn');

        if (!tbody) return;

        var sortCol = 'name', sortDir = 1;
        var openSiteId = null;

        var TYPE_LABELS = { golf: 'Golf', sports: 'Sports', bowls: 'Bowls', lawns: 'Lawns', precinct: 'General' };

        function esc(s) {
            return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
        }

        function fmtLastRun(iso) {
            if (!iso) return '<span class="stg-st-muted">Never</span>';
            var d = new Date(iso), now = new Date();
            var diff = Math.floor((now - d) / 1000);
            var str = diff < 60 ? diff + 's ago' : diff < 3600 ? Math.floor(diff/60) + 'm ago' : diff < 86400 ? Math.floor(diff/3600) + 'h ago' : Math.floor(diff/86400) + 'd ago';
            return '<span title="' + d.toLocaleString() + '">' + str + '</span>';
        }

        function sortData() {
            sitesData.sort(function (a, b) {
                var av = a[sortCol] != null ? a[sortCol] : '', bv = b[sortCol] != null ? b[sortCol] : '';
                if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * sortDir;
                return String(av).localeCompare(String(bv)) * sortDir;
            });
        }

        function openDetail(s) {
            openSiteId = s.id;
            if (detailTitle) detailTitle.textContent = s.name;
            if (detailSub)   detailSub.textContent   = (TYPE_LABELS[s.site_type] || s.site_type || 'General') + (s.location ? ' · ' + s.location : '');
            var lastRunFull = s.last_run ? new Date(s.last_run).toLocaleString() : 'Never';

            var users = s.users || [];
            var ROLE_LABELS = { manager: 'Manager', editor: 'Editor', viewer: 'Viewer' };
            var STATUS_STYLES = {
                active:  'background:#e4f0e9;color:#2d7a4e',
                invited: 'background:#e8f4fd;color:#2563eb',
            };
            function userInitials(u) {
                var parts = (u.name || u.email || '').trim().split(/\s+/);
                return parts.slice(0,2).map(function(p){ return p[0] ? p[0].toUpperCase() : ''; }).join('');
            }
            function avatarBg(status) {
                return status === 'invited' ? '#dbeafe' : '#d4e8dc';
            }
            function avatarColor(status) {
                return status === 'invited' ? '#2563eb' : '#2d7a4e';
            }
            var usersHtml = '<div style="border-top:1px solid #e8efeb;margin-top:16px;padding-top:16px;margin-bottom:24px">' +
                '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">' +
                '<div style="font-size:12px;font-weight:700;color:#3d5c4a;text-transform:uppercase;letter-spacing:.5px">Users' + (users.length ? ' <span style="font-weight:400;color:#6b8878;text-transform:none;letter-spacing:0">(' + users.length + ')</span>' : '') + '</div>' +
                '<button type="button" class="stg-site-invite-btn" data-site-id="' + esc(s.id) + '" style="display:inline-flex;align-items:center;gap:5px;font-size:12px;padding:4px 12px;font-family:\'Barlow\',sans-serif;font-weight:600;background:#2da85e;color:#fff;border:none;border-radius:6px;cursor:pointer">' +
                '<svg width="11" height="11" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4"/></svg>Invite</button>' +
                '</div>';
            if (users.length) {
                usersHtml += '<div style="display:flex;flex-direction:column;gap:4px">' +
                    users.map(function (u) {
                        var initials = userInitials(u);
                        var st = u.status || 'active';
                        var statusLabel = st.charAt(0).toUpperCase() + st.slice(1);
                        return '<div style="display:flex;align-items:center;gap:10px;padding:8px 10px;border-radius:8px;background:#f8fbf9">' +
                            '<div style="width:28px;height:28px;border-radius:50%;background:' + avatarBg(st) + ';display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:700;color:' + avatarColor(st) + ';flex-shrink:0;font-family:\'Barlow\',sans-serif">' + esc(initials) + '</div>' +
                            '<div style="flex:1;min-width:0">' +
                                '<div style="font-size:13px;font-weight:600;color:#1a2b23;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + esc(u.name || u.email) + '</div>' +
                                (u.name ? '<div style="font-size:11px;color:#6b8878;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + esc(u.email) + '</div>' : '') +
                            '</div>' +
                            '<span style="font-size:11px;font-weight:600;padding:2px 7px;border-radius:20px;flex-shrink:0;' + (STATUS_STYLES[st] || STATUS_STYLES.active) + '">' + statusLabel + '</span>' +
                            '<span style="font-size:11px;color:#6b8878;flex-shrink:0">' + esc(ROLE_LABELS[u.role] || u.role) + '</span>' +
                            '</div>';
                    }).join('') + '</div>';
            } else {
                usersHtml += '<div style="font-size:13px;color:#6b8878;padding:8px 0">No users yet. Invite someone to get started.</div>';
            }
            usersHtml += '</div>';

            if (detailBody) detailBody.innerHTML =
                '<div class="dat-metric-grid">' +
                '<div class="dat-metric-card"><div class="stg-detail-label">Location</div><div class="stg-detail-value">' + (s.location ? esc(s.location) : '—') + '</div></div>' +
                '<div class="dat-metric-card"><div class="stg-detail-label">Grass</div><div class="stg-detail-value">' + (s.species ? esc(s.species) : '—') + '</div>' + (s.hoc != null ? '<div class="stg-detail-sub">HOC ' + s.hoc + ' mm</div>' : '') + '</div>' +
                '<div class="dat-metric-card"><div class="stg-detail-label">Soil samples</div><div class="stg-detail-value">' + (s.soil || 0) + '</div></div>' +
                '<div class="dat-metric-card"><div class="stg-detail-label">Water samples</div><div class="stg-detail-value">' + (s.water || 0) + '</div></div>' +
                '</div>' +
                '<div style="font-size:12px;color:var(--gaip-text-muted);margin-bottom:16px">Last analysis run: ' + esc(lastRunFull) + '</div>' +
                usersHtml +
                '<div style="border-top:1px solid #e8efeb;padding-top:16px">' +
                (sitesData.length > 1
                    ? '<button type="button" class="stg-detail-delete-btn" data-site-id="' + esc(s.id) + '" style="padding:6px 14px;font-size:12px;font:inherit;font-weight:500;background:transparent;border:1px solid #f5c6c6;border-radius:7px;color:#c0392b;cursor:pointer">Delete this site</button>'
                    : '<span style="font-size:12px;color:var(--gaip-text-muted)">Cannot delete the only site.</span>') +
                '</div>';
            if (detailPanel) { detailPanel.style.display = ''; detailPanel.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); }
            tbody.querySelectorAll('tr.stg-row-main').forEach(function (r) { r.classList.toggle('stg-row-expanded', r.dataset.siteId === s.id); });
        }

        function closeDetail() {
            openSiteId = null;
            if (detailPanel) detailPanel.style.display = 'none';
            tbody.querySelectorAll('tr.stg-row-main').forEach(function (r) { r.classList.remove('stg-row-expanded'); });
        }

        if (detailClose) detailClose.addEventListener('click', closeDetail);

        if (detailBody) detailBody.addEventListener('click', function (e) {
            var inviteBtn = e.target.closest('.stg-site-invite-btn');
            if (inviteBtn) {
                document.dispatchEvent(new CustomEvent('open-invite-for-site', { detail: { siteId: inviteBtn.dataset.siteId } }));
                return;
            }
            var btn = e.target.closest('.stg-detail-delete-btn');
            if (!btn) return;
            var id = btn.dataset.siteId;
            if (!id) return;
            var site = sitesData.find(function (s) { return s.id === id; });
            if (!confirm('Delete site "' + (site ? site.name : id) + '"? This cannot be undone.')) return;
            fetch(apiBase + '/sites/' + id, {
                method: 'DELETE',
                headers: { 'Accept': 'application/json', 'X-CSRF-TOKEN': csrf },
            }).then(function (r) { return r.ok ? r.json() : r.json().then(function (d) { return Promise.reject(d); }); })
              .then(function () {
                  sitesData = sitesData.filter(function (s) { return s.id !== id; });
                  closeDetail();
                  renderTable();
              }).catch(function (d) { alert((d && d.message) || 'Failed to delete site.'); });
        });

        var STATUS_COLORS = { green: '#16a34a', amber: '#d97706', red: '#dc2626' };

        function statusDotHtml(status) {
            var bg = status ? (STATUS_COLORS[status] || '#9ca3af') : '#d1d5db';
            return '<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:' + bg + ';flex-shrink:0"></span>';
        }

        function renderTable() {
            sortData();
            if (!sitesData.length) {
                tbody.innerHTML = '<tr><td colspan="7" style="padding:20px;text-align:center;color:var(--gaip-text-muted)">No sites yet</td></tr>';
                return;
            }
            tbody.innerHTML = sitesData.map(function (s) {
                var typeLabel  = TYPE_LABELS[s.site_type] || s.site_type || 'General';
                var speciesStr = s.species ? esc(s.species) + (s.hoc != null ? ' <span class="stg-st-muted">· ' + s.hoc + ' mm</span>' : '') : '<span class="stg-st-muted">—</span>';
                var isSelected = openSiteId === s.id;
                var sep = '<span class="sens-pstatus-sep"></span>';
                var inviteRowBtn = '<button type="button" class="stg-btn-ghost stg-site-row-invite-btn" data-site-id="' + esc(s.id) + '" style="font-size:12px;padding:3px 10px">Invite</button>';
                var activeBtn = '<button disabled class="stg-btn-ghost" style="font-size:12px;padding:3px 0;width:76px;display:inline-flex;align-items:center;justify-content:center;color:#2da85e;border-color:#a8d9bc;cursor:default;opacity:1">Active</button>';
                var setActiveBtn = '<button type="button" class="stg-btn-ghost stg-set-active-btn" data-site-id="' + esc(s.id) + '" style="font-size:12px;padding:3px 0;width:76px;display:inline-flex;align-items:center;justify-content:center">Set active</button>';
                var actionCell = s.is_active
                    ? '<td><div style="display:flex;align-items:center;gap:6px">' + activeBtn + sep + inviteRowBtn + '</div></td>'
                    : '<td><div style="display:flex;align-items:center;gap:6px">' + setActiveBtn + sep + inviteRowBtn + '</div></td>';
                return '<tr class="stg-row-main' + (isSelected ? ' stg-row-expanded' : '') + '" data-site-id="' + esc(s.id) + '">' +
                    '<td><div class="stg-st-name-wrap">' + statusDotHtml(s.status) + '<span class="stg-st-name">' + esc(s.name) + '</span><span class="stg-st-type-badge">' + esc(typeLabel) + '</span></div></td>' +
                    '<td>' + (s.location ? esc(s.location) : '<span class="stg-st-muted">—</span>') + '</td>' +
                    '<td>' + speciesStr + '</td>' +
                    '<td class="dat-td-num">' + (s.soil || 0) + '</td>' +
                    '<td class="dat-td-num">' + (s.water || 0) + '</td>' +
                    '<td>' + fmtLastRun(s.last_run) + '</td>' +
                    '<td class="dat-td-num">' + (s.user_count || 0) + '</td>' +
                    actionCell + '</tr>';
            }).join('');
        }

        document.querySelectorAll('.stg-st-sortable').forEach(function (th) {
            th.addEventListener('click', function () {
                var col = th.dataset.col;
                if (sortCol === col) { sortDir = -sortDir; } else { sortCol = col; sortDir = 1; }
                document.querySelectorAll('.stg-st-sortable').forEach(function (h) { h.classList.remove('sort-asc', 'sort-desc'); });
                th.classList.add(sortDir === 1 ? 'sort-asc' : 'sort-desc');
                renderTable();
            });
        });

        tbody.addEventListener('click', function (e) {
            var inviteRowBtn = e.target.closest('.stg-site-row-invite-btn');
            if (inviteRowBtn) {
                e.stopPropagation();
                document.dispatchEvent(new CustomEvent('open-invite-for-site', { detail: { siteId: inviteRowBtn.dataset.siteId } }));
                return;
            }
            var setActiveBtn = e.target.closest('.stg-set-active-btn');
            if (setActiveBtn) {
                e.stopPropagation();
                var id = setActiveBtn.dataset.siteId;
                fetch(apiBase + '/active-site', {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json', 'X-CSRF-TOKEN': csrf },
                    body: JSON.stringify({ site_id: id }),
                }).then(function (r) { return r.ok ? r.json() : Promise.reject(r); })
                  .then(function () { window.location.reload(); })
                  .catch(function () { alert('Failed to set active site.'); });
                return;
            }
            var row = e.target.closest('tr.stg-row-main');
            if (!row) return;
            var id = row.dataset.siteId;
            var site = sitesData.find(function (s) { return s.id === id; });
            if (!site) return;
            if (openSiteId === id) { closeDetail(); } else { openDetail(site); }
        });

        if (addBtn) addBtn.addEventListener('click', function () { addForm.classList.remove('stg-hidden'); if (addNameEl) addNameEl.focus(); });
        if (addCancelBtn) addCancelBtn.addEventListener('click', function () { addForm.classList.add('stg-hidden'); if (addNameEl) addNameEl.value = ''; });
        if (addSaveBtn) addSaveBtn.addEventListener('click', function () {
            var name = addNameEl ? addNameEl.value.trim() : '';
            var type = addTypeEl ? addTypeEl.value : 'precinct';
            if (!name) { if (addNameEl) addNameEl.focus(); return; }
            addSaveBtn.disabled = true;
            fetch(apiBase + '/sites', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Accept': 'application/json', 'X-CSRF-TOKEN': csrf },
                body: JSON.stringify({ name: name, site_type: type }),
            }).then(function (r) { return r.ok ? r.json() : Promise.reject(r); })
              .then(function (resp) {
                  var s = resp.data;
                  sitesData.forEach(function (site) { site.is_active = false; });
                  sitesData.push({ id: s.id, name: s.name, site_type: s.site_type, location: null, species: null, hoc: null, soil: 0, water: 0, last_run: null, is_active: true });
                  addForm.classList.add('stg-hidden');
                  if (addNameEl) addNameEl.value = '';
                  addSaveBtn.disabled = false;
                  renderTable();

                  // Update topbar site name
                  var topbarName = document.getElementById('db-site-name');
                  if (topbarName) topbarName.textContent = s.name;

                  // Update topbar dropdown: deactivate old, add new site
                  var dropdown = document.getElementById('db-site-dropdown');
                  if (dropdown) {
                      dropdown.querySelectorAll('[data-site-id]').forEach(function (opt) {
                          opt.classList.remove('active');
                          opt.style.background = 'transparent';
                      });
                      var newOpt = document.createElement('button');
                      newOpt.type = 'button';
                      newOpt.className = 'db-site-option active';
                      newOpt.dataset.siteId = s.id;
                      newOpt.dataset.siteName = s.name;
                      newOpt.style.cssText = 'display:flex;align-items:center;gap:8px;width:100%;padding:10px 16px;border:0;background:#e8f3ed;text-align:left;cursor:pointer;font:inherit;font-size:14px;color:#17231f';
                      var dot = document.createElement('span');
                      dot.className = 'db-site-status-dot';
                      newOpt.appendChild(dot);
                      newOpt.appendChild(document.createTextNode(s.name));
                      dropdown.appendChild(newOpt);
                  }

                  // Update GAIP_HUB_CONFIG so other scripts know the active site changed
                  if (window.GAIP_HUB_CONFIG) window.GAIP_HUB_CONFIG.activeSiteId = s.id;

                  var prompt = document.getElementById('stg-onboard-prompt');
                  var yesBtn = document.getElementById('stg-onboard-yes');
                  var noBtn  = document.getElementById('stg-onboard-no');
                  if (prompt) { prompt.classList.remove('stg-hidden'); prompt.style.display = 'flex'; }
                  if (yesBtn) { yesBtn.onclick = function () { window.location.href = '/dashboard?setup=1'; }; }
                  if (noBtn)  { noBtn.onclick  = function () { if (prompt) prompt.style.display = 'none'; }; }
              }).catch(function () { addSaveBtn.disabled = false; alert('Failed to create site.'); });
        });

        renderTable();
    }());

    /* ── Users tab ───────────────────────────────────────────────── */
    (function initUsersTab() {
        var isAdmin = D.activeSiteRole === 'admin' || D.activeSiteRole === 'manager';

        var utabBtns           = document.querySelectorAll('[data-utab]');
        var tbody              = document.getElementById('users-tbody');
        var requestsCountEl    = document.getElementById('users-requests-count');
        var invitationsCountEl = document.getElementById('users-invitations-count');
        var activeEmptyState      = document.getElementById('users-active-empty');
        var requestsEmptyState    = document.getElementById('users-requests-empty');
        var invitationsEmptyState = document.getElementById('users-invitations-empty');
        var allEmptyState         = document.getElementById('users-all-empty');
        var inviteBtn              = document.getElementById('users-invite-btn');
        var inviteEmptyBtn         = document.getElementById('users-invite-empty-btn');
        var inviteEmptyBtnInv      = document.getElementById('users-invite-empty-btn-inv');
        var allInviteEmptyBtn      = document.getElementById('users-all-invite-empty-btn');
        var inviteModal    = document.getElementById('users-invite-modal');
        if (inviteModal) document.body.appendChild(inviteModal);
        var inviteClose    = document.getElementById('invite-modal-close');
        var inviteCancelBtn = document.getElementById('invite-cancel-btn');
        var inviteSubmitBtn = document.getElementById('invite-submit-btn');
        var inviteError    = document.getElementById('invite-modal-error');
        var inviteNameInput  = document.getElementById('invite-name');
        var inviteEmailInput = document.getElementById('invite-email');
        var inviteSitesToggle   = document.getElementById('invite-sites-toggle');
        var inviteSitesDropdown = document.getElementById('invite-sites-dropdown');
        var inviteSitesLabel    = document.getElementById('invite-sites-label');
        var searchInput    = document.getElementById('users-search');
        var siteFilter     = document.getElementById('users-site-filter');
        var roleFilter     = document.getElementById('users-role-filter');
        var pendingCountEl = document.getElementById('users-pending-count');

        if (searchInput) { searchInput.value = ''; }

        var _members = [], _pending = [], _invitations = [];

        function showInviteError(msg) {
            if (!inviteError) return;
            inviteError.textContent = msg;
            inviteError.style.display = msg ? '' : 'none';
        }

        var currentTab = 'active';

        function hideAllEmpty() {
            [activeEmptyState, requestsEmptyState, invitationsEmptyState, allEmptyState].forEach(function (el) {
                if (el) el.style.display = 'none';
            });
        }

        function switchUtab(tab) {
            currentTab = tab;
            utabBtns.forEach(function (b) {
                b.classList.toggle('active', b.dataset.utab === tab);
            });
            hideAllEmpty();
            if (tab === 'active')      renderMembers();
            else if (tab === 'requests')    renderPending();
            else if (tab === 'invitations') renderInvitations();
            else if (tab === 'all')         renderAll();
        }

        utabBtns.forEach(function (b) {
            b.addEventListener('click', function () { switchUtab(b.dataset.utab); });
        });

        function roleLabel(role) {
            var map = { manager: 'Manager', editor: 'Editor', viewer: 'Viewer' };
            return map[role] || role;
        }

        function getSearchQuery() {
            var q  = searchInput ? searchInput.value.toLowerCase() : '';
            var rf = roleFilter  ? roleFilter.value  : '';
            var sf = siteFilter  ? siteFilter.value  : '';
            return { q: q, role: rf, site: sf };
        }

        function renderMemberRow(u) {
            var isSelf = u.email === D.userEmail;
            var actions = !isSelf && u.site_id
                ? '<button class="stg-btn-ghost remove-site-btn" style="font-size:12px;padding:3px 8px;color:#dc2626;border-color:#fca5a5" data-site-id="' + u.site_id + '">Remove</button>'
                : '';
            return '<tr data-user-id="' + u.id + '">' +
                '<td>' + escHtml(u.name || '') + '</td>' +
                '<td>' + escHtml(u.email) + '</td>' +
                '<td>' + escHtml(u.site_name || '—') + '</td>' +
                '<td>' + roleLabel(u.role) + '</td>' +
                '<td>' + STATUS_BADGE.active + '</td>' +
                '<td style="white-space:nowrap">' + actions + '</td>' +
                '</tr>';
        }

        function applyFilters(list) {
            var f = getSearchQuery();
            return list.filter(function (u) {
                if (f.q && !(u.name || '').toLowerCase().includes(f.q) && !u.email.toLowerCase().includes(f.q) && !(u.site_name || '').toLowerCase().includes(f.q)) return false;
                if (f.role && u.role !== f.role) return false;
                if (f.site && u.site_id !== f.site) return false;
                return true;
            });
        }

        function renderMembers() {
            if (!tbody) return;
            var filtered = applyFilters(_members).filter(function (u) { return u.email !== D.userEmail; });
            var othersExist = _members.some(function (u) { return u.email !== D.userEmail; });
            if (activeEmptyState) activeEmptyState.style.display = (!othersExist) ? '' : 'none';
            tbody.innerHTML = filtered.map(renderMemberRow).join('');
        }

        var STATUS_BADGE = {
            active:    '<span style="font-size:11px;font-weight:600;padding:2px 8px;border-radius:20px;background:#e4f0e9;color:#2d7a4e">Active</span>',
            invited:   '<span style="font-size:11px;font-weight:600;padding:2px 8px;border-radius:20px;background:#e8f4fd;color:#2563eb">Invited</span>',
            requested: '<span style="font-size:11px;font-weight:600;padding:2px 8px;border-radius:20px;background:#fef3c7;color:#92400e">Requested</span>',
        };

        function renderPending() {
            if (!tbody) return;
            var filtered = applyFilters(_pending);
            var isEmpty = _pending.length === 0;
            if (requestsEmptyState) requestsEmptyState.style.display = isEmpty ? '' : 'none';
            tbody.innerHTML = filtered.map(function (u) {
                return '<tr data-user-id="' + u.id + '">' +
                    '<td>' + escHtml(u.name || '—') + '</td>' +
                    '<td>' + escHtml(u.email) + '</td>' +
                    '<td>—</td>' +
                    '<td>—</td>' +
                    '<td>' + STATUS_BADGE.requested + '</td>' +
                    '<td style="white-space:nowrap">' +
                        '<button class="stg-btn-primary approve-btn" style="font-size:12px;padding:3px 10px;margin-right:6px">Approve</button>' +
                        '<button class="stg-btn-ghost delete-btn" style="font-size:12px;padding:3px 10px;color:#dc2626;border-color:#fca5a5">Decline</button>' +
                    '</td>' +
                    '</tr>';
            }).join('');
        }

        function renderInvitations() {
            if (!tbody) return;
            var filtered = applyFilters(_invitations);
            var isEmpty = _invitations.length === 0;
            if (invitationsEmptyState) invitationsEmptyState.style.display = isEmpty ? '' : 'none';
            tbody.innerHTML = filtered.map(function (i) {
                return '<tr data-inv-id="' + i.id + '">' +
                    '<td>' + escHtml(i.name || '—') + '</td>' +
                    '<td>' + escHtml(i.email) + '</td>' +
                    '<td>' + escHtml(i.site_name || '—') + '</td>' +
                    '<td>' + roleLabel(i.role) + '</td>' +
                    '<td>' + STATUS_BADGE.invited + '</td>' +
                    '<td style="white-space:nowrap"><button class="stg-btn-ghost cancel-invite-btn" style="font-size:12px;padding:3px 10px;color:#dc2626;border-color:#fca5a5">Cancel</button></td>' +
                    '</tr>';
            }).join('');
        }

        function renderAll() {
            if (!tbody) return;
            var filteredMembers  = applyFilters(_members.filter(function (u) { return u.email !== D.userEmail; }));
            var filteredInvites  = applyFilters(_invitations);
            var filteredPending  = applyFilters(_pending);
            var rows = [];
            filteredMembers.forEach(function (u) {
                rows.push('<tr data-user-id="' + u.id + '">' +
                    '<td>' + escHtml(u.name || '—') + '</td>' +
                    '<td>' + escHtml(u.email) + '</td>' +
                    '<td>' + escHtml(u.site_name || '—') + '</td>' +
                    '<td>' + roleLabel(u.role) + '</td>' +
                    '<td>' + STATUS_BADGE.active + '</td>' +
                    '<td style="white-space:nowrap">' +
                        (u.site_id ? '<button class="stg-btn-ghost remove-site-btn" style="font-size:12px;padding:3px 8px;color:#dc2626;border-color:#fca5a5" data-site-id="' + u.site_id + '">Remove</button>' : '') +
                    '</td>' +
                    '</tr>');
            });
            filteredInvites.forEach(function (i) {
                rows.push('<tr data-inv-id="' + i.id + '">' +
                    '<td>' + escHtml(i.name || '—') + '</td>' +
                    '<td>' + escHtml(i.email) + '</td>' +
                    '<td>' + escHtml(i.site_name || '—') + '</td>' +
                    '<td>' + roleLabel(i.role) + '</td>' +
                    '<td>' + STATUS_BADGE.invited + '</td>' +
                    '<td style="white-space:nowrap"><button class="stg-btn-ghost cancel-invite-btn" style="font-size:12px;padding:3px 10px;color:#dc2626;border-color:#fca5a5">Cancel</button></td>' +
                    '</tr>');
            });
            filteredPending.forEach(function (u) {
                rows.push('<tr data-user-id="' + u.id + '">' +
                    '<td>' + escHtml(u.name || '—') + '</td>' +
                    '<td>' + escHtml(u.email) + '</td>' +
                    '<td>—</td>' +
                    '<td>—</td>' +
                    '<td>' + STATUS_BADGE.requested + '</td>' +
                    '<td style="white-space:nowrap">' +
                        '<button class="stg-btn-primary approve-btn" style="font-size:12px;padding:3px 10px;margin-right:4px">Approve</button>' +
                        '<button class="stg-btn-ghost delete-btn" style="font-size:12px;padding:3px 10px;color:#dc2626;border-color:#fca5a5">Decline</button>' +
                    '</td>' +
                    '</tr>');
            });
            var hasAll = (_members.filter(function (u) { return u.email !== D.userEmail; }).length + _invitations.length + _pending.length) === 0;
            if (allEmptyState) allEmptyState.style.display = hasAll ? '' : 'none';
            tbody.innerHTML = rows.join('');
        }

        function getCheckedSiteIds() {
            if (!inviteSitesDropdown) return [];
            return Array.from(inviteSitesDropdown.querySelectorAll('input[type="checkbox"]:checked')).map(function (cb) { return cb.value; });
        }

        function updateSitesLabel() {
            if (!inviteSitesToggle || !inviteSitesLabel) return;
            var checked = getCheckedSiteIds();
            if (checked.length === 0) {
                inviteSitesLabel.textContent = 'Select sites…';
                inviteSitesToggle.style.color = '#6b8878';
            } else {
                inviteSitesLabel.textContent = checked.length === 1
                    ? inviteSitesDropdown.querySelector('input[value="' + checked[0] + '"]').dataset.name
                    : checked.length + ' sites selected';
                inviteSitesToggle.style.color = '#1a2b23';
            }
        }

        function populateSiteFilterAndSelect(sites) {
            if (siteFilter) {
                siteFilter.innerHTML = '<option value="">All sites</option>' +
                    sites.map(function (s) { return '<option value="' + s.id + '">' + escHtml(s.name) + '</option>'; }).join('');
            }
            if (inviteSitesDropdown) {
                inviteSitesDropdown.innerHTML = sites.map(function (s) {
                    return '<label style="display:flex;align-items:center;gap:10px;padding:8px 14px;cursor:pointer;font-family:\'Barlow\',sans-serif;font-size:14px;color:#1a2b23" class="invite-site-option">' +
                        '<input type="checkbox" value="' + s.id + '" data-name="' + escHtml(s.name) + '" style="width:15px;height:15px;accent-color:#2e6b45;cursor:pointer"> ' +
                        escHtml(s.name) + '</label>';
                }).join('');
                inviteSitesDropdown.querySelectorAll('input[type="checkbox"]').forEach(function (cb) {
                    cb.addEventListener('change', updateSitesLabel);
                });
            }
        }

        if (inviteSitesToggle) {
            inviteSitesToggle.addEventListener('click', function (e) {
                e.stopPropagation();
                var open = inviteSitesDropdown.style.display !== 'none';
                inviteSitesDropdown.style.display = open ? 'none' : '';
            });
        }
        document.addEventListener('click', function (e) {
            if (inviteSitesDropdown && !inviteSitesDropdown.contains(e.target) && e.target !== inviteSitesToggle) {
                inviteSitesDropdown.style.display = 'none';
            }
        });

        function loadUsers() {
            apiFetch('GET', '/users').then(function (data) {
                _members     = (data && data.members)     || [];
                _pending     = (data && data.pending)     || [];
                _invitations = (data && data.invitations) || [];

                if (data && data.all_sites) populateSiteFilterAndSelect(data.all_sites);

                switchUtab(currentTab);

                if (requestsCountEl) {
                    requestsCountEl.textContent = _pending.length;
                    requestsCountEl.style.display = _pending.length ? '' : 'none';
                }
                if (invitationsCountEl) {
                    invitationsCountEl.textContent = _invitations.length;
                    invitationsCountEl.style.display = _invitations.length ? '' : 'none';
                }
            }).catch(function () {});
        }

        function renderCurrentTab() { switchUtab(currentTab); }

        if (searchInput) searchInput.addEventListener('input', renderCurrentTab);
        if (roleFilter)  roleFilter.addEventListener('change', renderCurrentTab);
        if (siteFilter)  siteFilter.addEventListener('change', renderCurrentTab);

        if (tbody) {
            tbody.addEventListener('click', function (e) {
                // Invitation row actions
                var invRow = e.target.closest('tr[data-inv-id]');
                if (invRow && e.target.classList.contains('cancel-invite-btn')) {
                    apiFetch('DELETE', '/invitations/' + invRow.dataset.invId)
                        .then(loadUsers).catch(function () { alert('Failed to cancel invitation.'); });
                    return;
                }
                // User row actions
                var row = e.target.closest('tr[data-user-id]');
                if (!row) return;
                var userId = row.dataset.userId;
                if (e.target.classList.contains('remove-site-btn')) {
                    var sid = e.target.dataset.siteId;
                    if (!sid) return;
                    if (!confirm('Remove this user from the site?')) return;
                    apiFetch('DELETE', '/users/' + userId + '/site/' + sid)
                        .then(loadUsers).catch(function () { alert('Failed to remove user.'); });
                } else if (e.target.classList.contains('approve-btn')) {
                    apiFetch('PATCH', '/users/' + userId + '/approve')
                        .then(loadUsers).catch(function () { alert('Failed to approve user.'); });
                } else if (e.target.classList.contains('delete-btn')) {
                    if (!confirm('Decline and remove this request?')) return;
                    apiFetch('DELETE', '/users/' + userId)
                        .then(loadUsers).catch(function () { alert('Failed to remove user.'); });
                }
            });
        }

        function openInviteModal(preselectedSiteId) {
            if (!inviteModal) return;
            if (inviteNameInput)  inviteNameInput.value  = '';
            if (inviteEmailInput) inviteEmailInput.value = '';
            var defaultRole = inviteModal.querySelector('[name="invite-role"][value="manager"]');
            if (defaultRole) defaultRole.checked = true;
            if (inviteSitesDropdown) {
                var preselectId = preselectedSiteId || (siteFilter ? siteFilter.value : '');
                inviteSitesDropdown.querySelectorAll('input[type="checkbox"]').forEach(function (cb) {
                    cb.checked = preselectId ? cb.value === preselectId : false;
                });
                inviteSitesDropdown.style.display = 'none';
            }
            updateSitesLabel();
            showInviteError('');
            inviteModal.style.display = 'flex';
        }

        document.addEventListener('open-invite-for-site', function (e) {
            var siteId = e.detail && e.detail.siteId;
            openInviteModal(siteId);
        });
        function closeInviteModal() {
            if (inviteModal) inviteModal.style.display = 'none';
        }

        if (inviteBtn)             inviteBtn.addEventListener('click', openInviteModal);
        if (inviteEmptyBtn)        inviteEmptyBtn.addEventListener('click', openInviteModal);
        if (inviteEmptyBtnInv)     inviteEmptyBtnInv.addEventListener('click', openInviteModal);
        if (allInviteEmptyBtn)     allInviteEmptyBtn.addEventListener('click', openInviteModal);
        if (inviteClose)    inviteClose.addEventListener('click', closeInviteModal);
        if (inviteCancelBtn) inviteCancelBtn.addEventListener('click', closeInviteModal);
        if (inviteModal) {
            inviteModal.addEventListener('click', function (e) {
                if (e.target === inviteModal) closeInviteModal();
            });
        }

        if (inviteSubmitBtn) {
            inviteSubmitBtn.addEventListener('click', function () {
                var name   = inviteNameInput  ? inviteNameInput.value.trim()  : '';
                var email  = inviteEmailInput ? inviteEmailInput.value.trim() : '';
                var roleEl = inviteModal ? inviteModal.querySelector('[name="invite-role"]:checked') : null;
                var role   = roleEl ? roleEl.value : 'manager';
                var siteIds = inviteSitesDropdown ? getCheckedSiteIds() : (D.activeSiteId ? [D.activeSiteId] : []);

                if (!email) { showInviteError('Email is required.'); return; }
                if (inviteSitesDropdown && siteIds.length === 0) { showInviteError('Please select at least one site.'); return; }

                inviteSubmitBtn.disabled = true;
                showInviteError('');

                apiFetch('POST', '/invitations', { name: name || null, email: email, role: role, site_ids: siteIds })
                    .then(function () { loadUsers(); closeInviteModal(); })
                    .catch(function (err) {
                        var status = err && err._status;
                        var msg = (status >= 400 && status < 500 && err.message)
                            ? err.message
                            : 'Something went wrong. Please try again.';
                        showInviteError(msg);
                    })
                    .finally(function () { inviteSubmitBtn.disabled = false; });
            });
        }

        var usersTabTrigger = document.querySelector('[data-tab="users"]');
        if (usersTabTrigger) {
            usersTabTrigger.addEventListener('click', loadUsers);
        }
        // Start on whichever tab is marked active in the DOM
        var firstActiveUtab = document.querySelector('#users-admin-tabs .stg-tab.active');
        switchUtab(firstActiveUtab ? firstActiveUtab.dataset.utab : 'all');

        // Always load so invite modal sites dropdown is ready regardless of active tab
        loadUsers();
    }());

    /* ── Profile tab ─────────────────────────────────────────────── */
    (function initProfileTab() {
        var profileNameInput = document.getElementById('profile-name');
        var profileNameSave  = document.getElementById('profile-name-save');
        var profileNameMsg   = document.getElementById('profile-name-msg');

        var pwdModal        = document.getElementById('password-modal');
        var pwdModalClose   = document.getElementById('pw-modal-close');
        var pwdCancelBtn    = document.getElementById('pw-cancel-btn');
        var pwdSubmitBtn    = document.getElementById('pw-submit-btn');
        var pwdCurrentField = document.getElementById('pw-current-field');
        var pwdCurrentInput = document.getElementById('pw-current');
        var pwdNewInput     = document.getElementById('pw-new');
        var pwdConfirmInput = document.getElementById('pw-confirm');
        var pwdError        = document.getElementById('pw-modal-error');
        var pwdSuccess      = document.getElementById('pw-modal-success');
        var pwdTitle        = document.getElementById('pw-modal-title');
        var pwdForgotLink   = document.getElementById('pw-forgot-link');
        var setPwdBtn       = document.getElementById('set-password-btn');
        var changePwdBtn    = document.getElementById('change-password-btn');

        function showNameMsg(text, ok) {
            if (!profileNameMsg) return;
            profileNameMsg.textContent = text;
            profileNameMsg.style.color = ok ? '#2da85e' : '#dc2626';
            profileNameMsg.style.display = text ? '' : 'none';
        }

        function showPwdMsg(errText, okText) {
            if (pwdError)   { pwdError.textContent = errText || ''; pwdError.style.display = errText ? '' : 'none'; }
            if (pwdSuccess) { pwdSuccess.textContent = okText || ''; pwdSuccess.style.display = okText ? '' : 'none'; }
        }

        if (profileNameSave) {
            profileNameSave.addEventListener('click', function () {
                var name = profileNameInput ? profileNameInput.value.trim() : '';
                if (!name) { showNameMsg('Name cannot be empty.', false); return; }
                profileNameSave.disabled = true;
                showNameMsg('', false);
                apiFetch('PATCH', '/profile', { name: name })
                    .then(function () { showNameMsg('Saved.', true); })
                    .catch(function (err) { showNameMsg((err && err.message) || 'Failed to save.', false); })
                    .finally(function () { profileNameSave.disabled = false; });
            });
        }

        function openPwdModal(hasPassword) {
            if (!pwdModal) return;
            if (pwdCurrentInput) pwdCurrentInput.value = '';
            if (pwdNewInput)     pwdNewInput.value     = '';
            if (pwdConfirmInput) pwdConfirmInput.value = '';
            showPwdMsg('', '');
            if (pwdCurrentField) pwdCurrentField.style.display = hasPassword ? '' : 'none';
            if (pwdTitle) pwdTitle.textContent = hasPassword ? 'Change password' : 'Set password';
            pwdModal.style.display = 'flex';
        }
        function closePwdModal() {
            if (pwdModal) pwdModal.style.display = 'none';
        }

        if (setPwdBtn)    setPwdBtn.addEventListener('click',    function () { openPwdModal(false); });
        if (changePwdBtn) changePwdBtn.addEventListener('click', function () { openPwdModal(true); });
        if (pwdModalClose) pwdModalClose.addEventListener('click', closePwdModal);
        if (pwdCancelBtn)  pwdCancelBtn.addEventListener('click', closePwdModal);
        if (pwdModal) {
            pwdModal.addEventListener('click', function (e) {
                if (e.target === pwdModal) closePwdModal();
            });
        }

        if (pwdSubmitBtn) {
            pwdSubmitBtn.addEventListener('click', function () {
                var current = pwdCurrentInput ? pwdCurrentInput.value : '';
                var newPwd  = pwdNewInput     ? pwdNewInput.value     : '';
                var confirm = pwdConfirmInput ? pwdConfirmInput.value : '';

                if (newPwd.length < 8) { showPwdMsg('Password must be at least 8 characters.', ''); return; }
                if (newPwd !== confirm) { showPwdMsg('Passwords do not match.', ''); return; }

                pwdSubmitBtn.disabled = true;
                showPwdMsg('', '');

                apiFetch('POST', '/profile/password', { current_password: current || null, password: newPwd, password_confirmation: confirm })
                    .then(function () {
                        showPwdMsg('', 'Password saved successfully.');
                        setTimeout(closePwdModal, 1400);
                    })
                    .catch(function (err) { showPwdMsg((err && err.message) || 'Failed to set password.', ''); })
                    .finally(function () { pwdSubmitBtn.disabled = false; });
            });
        }

        if (pwdForgotLink) {
            pwdForgotLink.addEventListener('click', function (e) {
                e.preventDefault();
                var email = D.userEmail || '';
                if (!email) return;
                apiFetch('POST', '/login/magic', { email: email, password_reset: true })
                    .then(function () { showPwdMsg('', 'Magic link sent to ' + email + '. Check your inbox.'); })
                    .catch(function () { showPwdMsg('Failed to send link.', ''); });
            });
        }

        if (D.openPasswordModal) {
            openPwdModal(D.hasPassword);
        }
    }());

})();
