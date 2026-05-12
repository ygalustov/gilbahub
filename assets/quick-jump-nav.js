/**
 * =============================================================================
 * GILBA HUB QUICK-JUMP NAV v1.0.1 (b35fix358)
 * =============================================================================
 *
 * Floating compact tab nav that appears when the main #gaip-tab-navigation
 * bar scrolls out of viewport. Bottom-left placement mirrors the bottom-right
 * floating-run-button.js so the two FABs do not collide.
 *
 * b35fix358: icons retained (deliberate decision per user — top-bar text-only,
 * FAB icon-only). No behavioural change from b35fix357 v1.0.0.
 *
 * Behaviour:
 *   - Hidden by default (and when the main tab bar is in viewport)
 *   - Appears as an icon-pill row when the user has scrolled past the tab bar
 *   - Click jumps to that tab via window.GilbaTabNav.switchTab(id) and scrolls
 *     to top of the hub container
 *   - Active tab synced from gaip:tab-change events
 *   - Stadium tab only rendered when GAIP_HUB_CONFIG.hubMode === 'stadium'
 *
 * Dependencies: tab-navigation.js (window.GilbaTabNav, #gaip-tab-navigation)
 * @version 1.0.1
 * =============================================================================
 */

(function() {
  'use strict';

  var VERSION = '1.0.1';
  var FAB_ID = 'gaip-quick-jump-nav';
  var STYLE_ID = 'gaip-quick-jump-nav-styles';

  // Prevent double-init
  if (document.getElementById(FAB_ID)) return;

  // Mirror the canonical TABS list from tab-navigation.js. Kept in sync by
  // matching the data-tab id; label/icon are local concerns for the FAB.
  var TABS = [
    { id: 'today',      label: 'Today',      icon: '📊' },
    { id: 'analysis',   label: 'Run',        icon: '🔬' },
    { id: 'programmes', label: 'Programmes', icon: '📋' },
    { id: 'reports',    label: 'Reports',    icon: '📄' },
    { id: 'stadium',    label: 'Stadium',    icon: '🏟️' }
  ];

  var _stadiumMode = (typeof GAIP_HUB_CONFIG !== 'undefined' && GAIP_HUB_CONFIG.hubMode === 'stadium');

  // ===========================================================================
  // STYLES
  // ===========================================================================

  function injectStyles() {
    if (document.getElementById(STYLE_ID)) return;

    var css = [
      '.gaip-quick-jump-nav {',
      '  position: fixed; bottom: 24px; left: 24px;',
      '  z-index: 9998;',
      '  display: flex; gap: 4px;',
      '  padding: 6px;',
      '  background: var(--gaip-surface, #1f2937);',
      '  border: 1px solid var(--gaip-border, rgba(255,255,255,0.08));',
      '  border-radius: 999px;',
      '  box-shadow: 0 4px 14px rgba(0,0,0,0.3), 0 2px 6px rgba(0,0,0,0.15);',
      '  opacity: 0; pointer-events: none;',
      '  transform: translateY(20px);',
      '  transition: opacity 0.2s ease, transform 0.2s ease;',
      '}',
      '.gaip-quick-jump-nav.is-visible {',
      '  opacity: 1; pointer-events: auto;',
      '  transform: translateY(0);',
      '}',
      '',
      '.gaip-qj-btn {',
      '  display: flex; align-items: center; justify-content: center;',
      '  width: 40px; height: 40px;',
      '  padding: 0; border: none; background: transparent;',
      '  border-radius: 999px;',
      '  font-size: 18px; line-height: 1;',
      '  color: var(--gaip-text-secondary, #9ca3af);',
      '  cursor: pointer;',
      '  transition: background 0.15s, color 0.15s, transform 0.1s;',
      '  position: relative;',
      '}',
      '.gaip-qj-btn:hover {',
      '  background: var(--gaip-surface-hover, rgba(255,255,255,0.08));',
      '  color: var(--gaip-text, #f3f4f6);',
      '  transform: scale(1.08);',
      '}',
      '.gaip-qj-btn:focus-visible {',
      '  outline: none;',
      '  box-shadow: 0 0 0 2px var(--gaip-accent, #2d7a4f);',
      '}',
      '.gaip-qj-btn.active {',
      '  background: var(--gaip-accent, #2d7a4f);',
      '  color: #ffffff;',
      '}',
      '.gaip-qj-btn.active:hover {',
      '  background: var(--gaip-accent, #2d7a4f);',
      '  color: #ffffff;',
      '  filter: brightness(1.08);',
      '}',
      '',
      '/* Tooltip on hover, label appears above the button */',
      '.gaip-qj-btn::after {',
      '  content: attr(data-label);',
      '  position: absolute; bottom: calc(100% + 6px); left: 50%;',
      '  transform: translateX(-50%) translateY(4px);',
      '  padding: 4px 8px;',
      '  background: rgba(0,0,0,0.85); color: #ffffff;',
      '  font-size: 11px; font-weight: 600;',
      '  border-radius: 4px; white-space: nowrap;',
      '  opacity: 0; pointer-events: none;',
      '  transition: opacity 0.15s, transform 0.15s;',
      '}',
      '.gaip-qj-btn:hover::after {',
      '  opacity: 1;',
      '  transform: translateX(-50%) translateY(0);',
      '}',
      '',
      '/* Mobile: shrink slightly and bring in from edge */',
      '@media (max-width: 640px) {',
      '  .gaip-quick-jump-nav { bottom: 16px; left: 16px; padding: 4px; }',
      '  .gaip-qj-btn { width: 36px; height: 36px; font-size: 16px; }',
      '}',
      ''
    ].join('\n');

    var style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = css;
    document.head.appendChild(style);
  }

  // ===========================================================================
  // BUILD
  // ===========================================================================

  function buildNav() {
    var nav = document.createElement('div');
    nav.id = FAB_ID;
    nav.className = 'gaip-quick-jump-nav';
    nav.setAttribute('role', 'navigation');
    nav.setAttribute('aria-label', 'Quick jump to tab');

    TABS.forEach(function(tab) {
      if (tab.id === 'stadium' && !_stadiumMode) return;

      var btn = document.createElement('button');
      btn.className = 'gaip-qj-btn';
      btn.setAttribute('data-tab', tab.id);
      btn.setAttribute('data-label', tab.label);
      btn.setAttribute('aria-label', 'Jump to ' + tab.label);
      btn.setAttribute('title', tab.label);
      btn.innerHTML = '<span aria-hidden="true">' + tab.icon + '</span>';

      btn.addEventListener('click', function() {
        jumpToTab(tab.id);
      });

      nav.appendChild(btn);
    });

    document.body.appendChild(nav);
    return nav;
  }

  // ===========================================================================
  // BEHAVIOUR
  // ===========================================================================

  function jumpToTab(tabId) {
    if (window.GilbaTabNav && typeof window.GilbaTabNav.switchTab === 'function') {
      window.GilbaTabNav.switchTab(tabId);
    }
    // Scroll to the hub container top so the user lands on the tab's content
    var hub = document.getElementById('gaip-hub');
    var target = hub || document.querySelector('.gaip-header-bar') || document.body;
    var rect = target.getBoundingClientRect();
    var top = rect.top + window.pageYOffset - 16;
    window.scrollTo({ top: top, behavior: 'smooth' });
  }

  function setActive(nav, tabId) {
    var btns = nav.querySelectorAll('.gaip-qj-btn');
    btns.forEach(function(b) {
      b.classList.toggle('active', b.getAttribute('data-tab') === tabId);
    });
  }

  function getActiveTabId() {
    if (window.GilbaTabNav && typeof window.GilbaTabNav.getActiveTab === 'function') {
      return window.GilbaTabNav.getActiveTab();
    }
    var active = document.querySelector('#gaip-tab-navigation .gaip-tab.active');
    return active ? active.getAttribute('data-tab') : 'today';
  }

  function setupVisibility(nav) {
    var mainBar = document.getElementById('gaip-tab-navigation');
    if (!mainBar) {
      // Tab nav not ready yet — defer
      setTimeout(function() { setupVisibility(nav); }, 500);
      return;
    }

    // Hide by default; show when the main bar leaves the viewport
    var io = new IntersectionObserver(function(entries) {
      entries.forEach(function(entry) {
        if (entry.isIntersecting) {
          nav.classList.remove('is-visible');
        } else {
          nav.classList.add('is-visible');
        }
      });
    }, { threshold: 0, rootMargin: '0px 0px -20px 0px' });

    io.observe(mainBar);

    // Fallback: also re-check on scroll for browsers / odd layout cases
    // where the IntersectionObserver doesn't fire promptly
    var scrollTicking = false;
    function onScroll() {
      if (scrollTicking) return;
      scrollTicking = true;
      window.requestAnimationFrame(function() {
        var rect = mainBar.getBoundingClientRect();
        var visible = rect.bottom > 0 && rect.top < window.innerHeight;
        nav.classList.toggle('is-visible', !visible);
        scrollTicking = false;
      });
    }
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });
  }

  // ===========================================================================
  // INIT
  // ===========================================================================

  function init() {
    var hub = document.getElementById('gaip-hub');
    if (!hub) { setTimeout(init, 500); return; }

    injectStyles();
    var nav = buildNav();

    // Sync active state on tab changes
    document.addEventListener('gaip:tab-change', function(e) {
      var tabId = (e.detail && e.detail.tab) || getActiveTabId();
      setActive(nav, tabId);
    });

    // Initial active state once GilbaTabNav has restored the saved tab
    setTimeout(function() {
      setActive(nav, getActiveTabId());
    }, 800);

    setupVisibility(nav);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() {
      setTimeout(init, 700);
    });
  } else {
    setTimeout(init, 700);
  }

  // Public API
  window.GilbaQuickJumpNav = {
    version: VERSION,
    jumpTo: function(tabId) { jumpToTab(tabId); }
  };

})();
