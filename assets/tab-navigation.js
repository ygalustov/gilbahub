/**
 * =============================================================================
 * GILBA HUB TAB NAVIGATION v1.1.0
 * =============================================================================
 *
 * Phase 4 of the progressive UI redesign.
 *
 * Adds Today / Analysis / Programmes / Reports tabs below the header bar.
 * Each tab shows/hides groups of existing elements using display toggling.
 * No DOM destruction, no reparenting — purely visibility control.
 *
 * Tab groupings:
 *   - Today:      Dashboard widgets + Disease Risk + Climate & Weather + Growth & Light
 *   - Analysis:   All result cards (full post-analysis output)
 *   - Programmes: Nutrition Program + PGR & Irrigation + Planning Tools
 *   - Reports:    Export controls (Word export, What-If, logo, org name)
 *
 * Dependencies: hub-header-bar.js, daily-dashboard.js, card-layout-redesign.js
 * @version 1.1.0
 * =============================================================================
 */

(function() {
    'use strict';

    var VERSION = '1.1.0';
    var TAB_BAR_ID = 'gaip-tab-navigation';
    var STORAGE_KEY = 'gaip-active-tab';

    function log(msg, data) {
        if (data !== undefined) {
        } else {
        }
    }

    // =========================================================================
    // TAB DEFINITIONS
    // =========================================================================

    var TABS = [
        { id: 'today',      label: 'Today',      icon: '📊', description: 'Dashboard overview with current conditions' },
        { id: 'analysis',   label: 'Analysis',   icon: '🔬', description: 'Full analysis results across all modules' },
        { id: 'programmes', label: 'Programmes', icon: '📋', description: 'Nutrition, PGR & irrigation programmes' },
        { id: 'reports',    label: 'Reports',    icon: '📄', description: 'Export reports and run What-If scenarios' },
        { id: 'stadium',    label: 'Stadium',    icon: '🏟️', description: 'Stadium shade analysis and rig calculator' }
    ];

    // Stadium tab only shown when page uses [gaip_hub mode="stadium"]
    var _stadiumMode = (typeof GAIP_HUB_CONFIG !== 'undefined' && GAIP_HUB_CONFIG.hubMode === 'stadium');

    // =========================================================================
    // ELEMENT MAPPINGS
    // =========================================================================

    var TAB_CARDS = {
        today:      ['disease-risk', 'climate-analysis', 'growth-conditions'],
        analysis:   ['disease-risk', 'climate-analysis', 'growth-conditions',
                     'lab-results', 'performance-wear'],
        programmes: ['nutrition-program', 'pgr-irrigation', 'planning-tools', 'spray-log'],
        reports:    ['cultivar-profile'],
        stadium:    []
    };

    var TAB_SHOW_DASHBOARD = { today: true,  analysis: false, programmes: false, reports: false, stadium: false };
    var TAB_SHOW_INPUTS    = { today: false, analysis: true,  programmes: true,  reports: false, stadium: false };
    var TAB_SHOW_EXPORTS   = { today: false, analysis: false, programmes: false, reports: true,  stadium: false };
    var TAB_SHOW_RUN_BTN   = { today: true,  analysis: true,  programmes: false, reports: false, stadium: false };

    // =========================================================================
    // STATE
    // =========================================================================

    var _activeTab = 'today';

    // =========================================================================
    // CSS
    // =========================================================================

    function injectStyles() {
        if (document.getElementById('gaip-tab-nav-styles')) return;

        var css = [
            '/* PHASE 4: TAB NAVIGATION */',
            '',
            '#' + TAB_BAR_ID + ' {',
            '  display: flex; align-items: center; gap: 4px;',
            '  padding: 8px 16px; background: var(--gaip-surface);',
            '  border-bottom: 1px solid var(--gaip-border);',
            '  margin: 0 -16px 16px; position: relative; z-index: 50;',
            '}',
            '',
            '.gaip-tab {',
            '  display: flex; align-items: center; gap: 6px;',
            '  padding: 8px 16px; border: none; background: none;',
            '  font-size: 14px; font-weight: 500; color: var(--gaip-text-secondary);',
            '  cursor: pointer; border-radius: 8px;',
            '  transition: all 0.15s; white-space: nowrap;',
            '}',
            '.gaip-tab:hover { background: var(--gaip-surface-hover); color: var(--gaip-text); }',
            '.gaip-tab.active {',
            '  background: var(--gaip-accent-light, var(--gaip-good-bg));',
            '  color: var(--gaip-accent, #2d7a4f); font-weight: 600;',
            '}',
            '.gaip-tab-icon { font-size: 15px; }',
            '',
            '.gaip-tab-badge {',
            '  display: none; min-width: 18px; height: 18px;',
            '  padding: 0 5px; border-radius: 10px;',
            '  background: #ef4444; color: var(--gaip-surface);',
            '  font-size: 11px; font-weight: 600;',
            '  line-height: 18px; text-align: center;',
            '}',
            '.gaip-tab-badge.visible { display: inline-block; }',
            '',
            '@media (max-width: 640px) {',
            '  #' + TAB_BAR_ID + ' { overflow-x: auto; -webkit-overflow-scrolling: touch; padding: 6px 12px; }',
            '  .gaip-tab { padding: 6px 12px; font-size: 13px; }',
            '  .gaip-tab-icon { font-size: 13px; }',
            '}',
            '',
            '/* ---- Tab visibility: high-specificity selectors ---- */',
            '/* These MUST override any module display rules */',
            'div.gaip-tab-hidden,',
            'button.gaip-tab-hidden,',
            'section.gaip-tab-hidden,',
            '.gaip-rc.gaip-tab-hidden,',
            '.gaip-dashboard.gaip-tab-hidden,',
            '.gaip-inputs-section.gaip-tab-hidden,',
            '.gaip-result-cards.gaip-tab-hidden,',
            '.gaip-reports-container.gaip-tab-hidden,',
            '.gaip-results.gaip-tab-hidden,',
            '.gaip-run-btn.gaip-tab-hidden,',
            '.gaip-status.gaip-tab-hidden,',
            '.gaip-export-controls.gaip-tab-hidden,',
            '.gilba-synthesis-wrapper.gaip-tab-hidden,',
            '.gaip-grid.gaip-tab-hidden,',
            '#gaip-hub .gaip-tab-hidden {',
            '  display: none !important;',
            '}',
            '',
            '/* Reports container */',
            '.gaip-reports-container {',
            '  background: var(--gaip-surface); border: 1px solid var(--gaip-border);',
            '  border-radius: 10px; padding: 24px; margin-bottom: 16px;',
            '}',
            '.gaip-reports-container h3 {',
            '  font-size: 16px; font-weight: 600; color: var(--gaip-text);',
            '  margin: 0 0 8px; display: block !important;',
            '}',
            '.gaip-reports-container p {',
            '  font-size: 13px; color: var(--gaip-text-secondary); margin: 0 0 16px;',
            '}',
            '.gaip-reports-actions { display: flex; gap: 12px; flex-wrap: wrap; margin-bottom: 20px; }',
            '.gaip-reports-settings {',
            '  display: flex; gap: 16px; flex-wrap: wrap;',
            '  padding-top: 16px; border-top: 1px solid var(--gaip-border);',
            '}',
            ''
        ].join('\n');

        var style = document.createElement('style');
        style.id = 'gaip-tab-nav-styles';
        style.textContent = css;
        document.head.appendChild(style);
        log('Styles injected');
    }

    // =========================================================================
    // BUILD TAB BAR
    // =========================================================================

    function buildTabBar() {
        var bar = document.createElement('div');
        bar.id = TAB_BAR_ID;

        TABS.forEach(function(tab) {
            // Only show stadium tab on stadium-mode pages
            if (tab.id === 'stadium' && !_stadiumMode) return;

            var btn = document.createElement('button');
            btn.className = 'gaip-tab';
            btn.id = 'gaip-tab-' + tab.id;
            btn.setAttribute('data-tab', tab.id);
            btn.setAttribute('title', tab.description);
            btn.innerHTML =
                '<span class="gaip-tab-icon">' + tab.icon + '</span>' +
                '<span class="gaip-tab-label">' + tab.label + '</span>' +
                '<span class="gaip-tab-badge" id="gaip-tab-badge-' + tab.id + '"></span>';
            btn.addEventListener('click', function() { switchTab(tab.id); });
            bar.appendChild(btn);
        });

        return bar;
    }

    // =========================================================================
    // REPORTS CONTAINER
    // =========================================================================

    function buildReportsContainer() {
        var existing = document.getElementById('gaip-reports-container');
        if (existing) return existing;

        var container = document.createElement('div');
        container.id = 'gaip-reports-container';
        container.className = 'gaip-reports-container gaip-tab-hidden';
        container.innerHTML =
            '<h3>📄 Reports & Scenarios</h3>' +
            '<p>Export your analysis as a Word document or run What-If scenarios to compare management strategies.</p>' +
            '<div class="gaip-reports-actions" id="gaip-reports-actions"></div>' +
            '<div class="gaip-reports-settings" id="gaip-reports-settings"></div>';
        return container;
    }

    function wireReportsContainer() {
        var actionsDiv = document.getElementById('gaip-reports-actions');
        var settingsDiv = document.getElementById('gaip-reports-settings');
        if (!actionsDiv || !settingsDiv) return;

        var wordBtn = document.getElementById('gaip-export-word');
        if (wordBtn && !wordBtn.closest('.gaip-reports-container')) actionsDiv.appendChild(wordBtn);

        var whatifBtn = document.getElementById('gaip-whatif-btn');
        if (whatifBtn && !whatifBtn.closest('.gaip-reports-container')) actionsDiv.appendChild(whatifBtn);

        var logoUpload = document.querySelector('.gaip-logo-upload');
        if (logoUpload && !logoUpload.closest('.gaip-reports-container')) settingsDiv.appendChild(logoUpload);

        var orgField = document.querySelector('[for="gaip-org-name"]');
        if (orgField) {
            var orgWrapper = orgField.parentElement;
            if (orgWrapper && !orgWrapper.closest('.gaip-reports-container')) settingsDiv.appendChild(orgWrapper);
        }

        var origControls = document.querySelector('.gaip-export-controls');
        if (origControls) origControls.style.display = 'none';

        log('Reports container wired');
    }

    // =========================================================================
    // TOGGLE HELPER
    // =========================================================================

    function setVisible(el, visible) {
        if (!el) return false;
        if (visible) {
            el.classList.remove('gaip-tab-hidden');
            // Remove any inline hide we applied
            if (el.dataset.gaipTabOrigDisplay !== undefined) {
                el.style.display = el.dataset.gaipTabOrigDisplay || '';
                delete el.dataset.gaipTabOrigDisplay;
            }
        } else {
            el.classList.add('gaip-tab-hidden');
            // Force inline display:none as nuclear option
            // Save original display value first
            if (el.dataset.gaipTabOrigDisplay === undefined) {
                el.dataset.gaipTabOrigDisplay = el.style.display || '';
            }
            el.style.display = 'none';
        }
        return true;
    }

    // =========================================================================
    // TAB SWITCHING
    // =========================================================================

    function switchTab(tabId) {
        if (!TAB_CARDS[tabId]) {
            log('Unknown tab: ' + tabId);
            return;
        }

        _activeTab = tabId;
        log('Switching to tab: ' + tabId);

        // ---- Gather all elements fresh each switch ----
        var dashboard      = document.getElementById('gaip-daily-dashboard');
        var resultCardsGrid = document.querySelector('.gaip-result-cards');
        var inputs         = document.querySelector('.gaip-inputs-section');
        var runBtn         = document.querySelector('.gaip-run-btn');
        var reports        = document.getElementById('gaip-reports-container');
        var statusBar      = document.querySelector('.gaip-status');
        var resultsWrapper = document.querySelector('.gaip-results');
        var allCards       = document.querySelectorAll('.gaip-rc');

        // ---- Tab button active states ----
        var buttons = document.querySelectorAll('#' + TAB_BAR_ID + ' .gaip-tab');
        buttons.forEach(function(btn) {
            btn.classList.toggle('active', btn.getAttribute('data-tab') === tabId);
        });

        // ---- Toggle elements ----
        setVisible(dashboard, TAB_SHOW_DASHBOARD[tabId]);

        var visibleIds = TAB_CARDS[tabId];
        var hiddenCount = 0, shownCount = 0;
        allCards.forEach(function(card) {
            var groupId = card.getAttribute('data-group');
            var show = visibleIds.indexOf(groupId) !== -1;
            setVisible(card, show);
            if (show) shownCount++; else hiddenCount++;
        });

        setVisible(resultCardsGrid, visibleIds.length > 0);
        setVisible(inputs, TAB_SHOW_INPUTS[tabId]);
        // Also toggle .gaip-grid
        var gaipGrid = document.querySelector('.gaip-grid');
        if (gaipGrid) {
            if (TAB_SHOW_INPUTS[tabId]) {
                gaipGrid.style.display = '';
            } else {
                gaipGrid.style.display = 'none';
            }
        }
        // Hide ALL section.gaip-card and .gaip-card elements that are NOT inside
        // a .gaip-rc (result card). These are input cards — some may be orphaned
        // outside .gaip-inputs-section due to other modules moving them.
        var allGaipCards = document.querySelectorAll('section.gaip-card, div.gaip-card');
        allGaipCards.forEach(function(card) {
            // Skip if it's inside a result card (.gaip-rc)
            if (card.closest('.gaip-rc')) return;
            if (TAB_SHOW_INPUTS[tabId]) {
                card.style.removeProperty('display');
            } else {
                card.style.display = 'none';
            }
        });
        setVisible(runBtn, TAB_SHOW_RUN_BTN[tabId]);
        setVisible(reports, TAB_SHOW_EXPORTS[tabId]);
        setVisible(statusBar, tabId === 'analysis');

        // ---- Stadium tab wrapper ----
        var stadiumWrapper = document.getElementById('gssh-stadium-tab-wrapper');
        if (stadiumWrapper) {
            setVisible(stadiumWrapper, tabId === 'stadium');
            // gssh-tab-hidden is a legacy class not managed by setVisible — clear it when showing
            if (tabId === 'stadium') {
                stadiumWrapper.classList.remove('gssh-tab-hidden');
            }
        }

        // -- Synthesis wrapper now lives inside reports container, no separate toggle needed --

        // -- Show .gaip-results wrapper when tab has result cards to display --
        if (resultsWrapper) {
            setVisible(resultsWrapper, visibleIds.length > 0);
        }

        // Persist
        try { localStorage.setItem(STORAGE_KEY, tabId); } catch (e) {}

        // Fire event
        document.dispatchEvent(new CustomEvent('gaip:tab-change', {
            detail: { tab: tabId }
        }));

        // ---- Debug ----
        log('Result cards: ' + allCards.length + ' total, ' + shownCount + ' shown, ' + hiddenCount + ' hidden');
        log('Input .gaip-card elements toggled: ' + allGaipCards.length);
        log('Found: dashboard=' + !!dashboard + ' inputs=' + !!inputs +
            ' runBtn=' + !!runBtn + ' reports=' + !!reports +
            ' grid=' + !!resultCardsGrid + ' results=' + !!resultsWrapper);

        if (!inputs) log('⚠ .gaip-inputs-section NOT FOUND — input cards will always show');
        if (!runBtn) log('⚠ .gaip-run-btn NOT FOUND — run button will always show');
    }

    // =========================================================================
    // BADGE UPDATES
    // =========================================================================

    function updateTodayBadge() {
        var badge = document.getElementById('gaip-tab-badge-today');
        if (!badge) return;
        var count = document.querySelectorAll('.gaip-widget-actions .gaip-action-item').length;
        if (count > 0) { badge.textContent = count; badge.classList.add('visible'); }
        else { badge.classList.remove('visible'); }
    }

    function updateAnalysisBadge() {
        var badge = document.getElementById('gaip-tab-badge-analysis');
        if (!badge) return;
        if (_activeTab !== 'analysis') {
            badge.textContent = '●';
            badge.style.cssText = 'background:#10b981;min-width:12px;height:12px;padding:0;border-radius:50%;';
            badge.classList.add('visible');
        }
    }

    function clearAnalysisBadge() {
        var badge = document.getElementById('gaip-tab-badge-analysis');
        if (badge) badge.classList.remove('visible');
    }

    // =========================================================================
    // INIT
    // =========================================================================

    function init() {
        var hub = document.getElementById('gaip-hub');
        if (!hub) { setTimeout(init, 500); return; }

        var headerBar = document.querySelector('.gaip-header-bar');
        var dashboard = document.getElementById('gaip-daily-dashboard');
        if (!headerBar || !dashboard) {
            log('Header bar or dashboard not ready — deferring');
            setTimeout(init, 500);
            return;
        }

        var resultCards = document.querySelector('.gaip-result-cards');
        if (!resultCards) {
            log('Card layout not ready — deferring');
            setTimeout(init, 500);
            return;
        }

        log('Initializing v' + VERSION);

        injectStyles();

        // Insert tab bar
        var tabBar = buildTabBar();
        headerBar.parentNode.insertBefore(tabBar, headerBar.nextSibling);

        // Build and insert reports container
        var reportsContainer = buildReportsContainer();
        var results = hub.querySelector('.gaip-results') || document.querySelector('.gaip-results');
        if (results) {
            results.parentNode.insertBefore(reportsContainer, results);
        } else {
            dashboard.parentNode.insertBefore(reportsContainer, dashboard.nextSibling);
        }
        wireReportsContainer();

        // Restore saved tab
        var savedTab = 'today';
        try { savedTab = localStorage.getItem(STORAGE_KEY) || 'today'; } catch (e) {}
        if (!TAB_CARDS[savedTab]) savedTab = 'today';

        switchTab(savedTab);

        // Event listeners
        document.addEventListener('gaip:analysis-complete', function() {
            updateTodayBadge();
            updateAnalysisBadge();
        });
        document.addEventListener('gaip:hub-state-update', function() {
            setTimeout(updateTodayBadge, 500);
        });
        document.addEventListener('gaip:tab-change', function(e) {
            if (e.detail && e.detail.tab === 'analysis') clearAnalysisBadge();
        });

        log('Ready — active tab: ' + savedTab);
    }

    // =========================================================================
    // PUBLIC API
    // =========================================================================

    window.GilbaTabNav = {
        version: VERSION,
        switchTab: switchTab,
        getActiveTab: function() { return _activeTab; },
        updateBadge: function(tabId, text, color) {
            var badge = document.getElementById('gaip-tab-badge-' + tabId);
            if (!badge) return;
            if (text) {
                badge.textContent = text;
                if (color) badge.style.background = color;
                badge.classList.add('visible');
            } else {
                badge.classList.remove('visible');
            }
        }
    };

    // =========================================================================
    // BOOTSTRAP
    // =========================================================================

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function() {
            setTimeout(init, 600);
        });
    } else {
        setTimeout(init, 600);
    }

})();
