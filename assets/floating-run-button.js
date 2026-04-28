/**
 * Gilba Hub Floating Run Button v1.0.0
 * 
 * Adds a fixed-position "Update" button in the bottom-right corner
 * that triggers the same action as the main Run Analysis button.
 * 
 * Features:
 * - Always visible floating action button (FAB)
 * - Keyboard shortcut: Ctrl+Enter (Cmd+Enter on Mac)
 * - Auto-hides when original button is visible in viewport
 * - Loading state during analysis
 */

(function() {
  'use strict';

  const VERSION = '1.0.0';
  const BUTTON_ID = 'gaip-floating-run-btn';

  // Prevent double-initialization
  if (document.getElementById(BUTTON_ID)) {
    return;
  }

  /**
   * Create and inject the floating button
   */
  function createFloatingButton() {
    const btn = document.createElement('button');
    btn.id = BUTTON_ID;
    btn.className = 'gaip-floating-run-btn';
    btn.innerHTML = `
      <svg class="gaip-floating-run-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <polygon points="5 3 19 12 5 21 5 3"></polygon>
      </svg>
      <span class="gaip-floating-run-label">Update</span>
    `;
    btn.title = 'Run Analysis (Ctrl+Enter)';
    btn.setAttribute('aria-label', 'Run Analysis');

    document.body.appendChild(btn);
    return btn;
  }

  /**
   * Inject styles for the floating button
   */
  function injectStyles() {
    const styleId = 'gaip-floating-run-styles';
    if (document.getElementById(styleId)) return;

    const styles = document.createElement('style');
    styles.id = styleId;
    styles.textContent = `
      .gaip-floating-run-btn {
        position: fixed;
        bottom: 24px;
        right: 24px; /* Default fallback, JS will override */
        z-index: 9999;
        
        display: flex;
        align-items: center;
        gap: 8px;
        
        padding: 12px 20px;
        border: none;
        border-radius: 50px;
        
        background: linear-gradient(135deg, #059669 0%, #047857 100%);
        color: var(--gaip-surface);
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        font-size: 14px;
        font-weight: 600;
        
        cursor: pointer;
        box-shadow: 0 4px 14px rgba(5, 150, 105, 0.4), 0 2px 6px rgba(0, 0, 0, 0.1);
        
        transition: all 0.2s ease;
        transform: translateY(0);
      }

      .gaip-floating-run-btn:hover {
        background: linear-gradient(135deg, #047857 0%, #065f46 100%);
        box-shadow: 0 6px 20px rgba(5, 150, 105, 0.5), 0 3px 8px rgba(0, 0, 0, 0.15);
        transform: translateY(-2px);
      }

      .gaip-floating-run-btn:active {
        transform: translateY(0);
        box-shadow: 0 2px 8px rgba(5, 150, 105, 0.3);
      }

      .gaip-floating-run-btn:focus {
        outline: none;
        box-shadow: 0 0 0 3px rgba(5, 150, 105, 0.3), 0 4px 14px rgba(5, 150, 105, 0.4);
      }

      .gaip-floating-run-btn.is-hidden {
        opacity: 0;
        pointer-events: none;
        transform: translateY(20px);
      }

      .gaip-floating-run-btn.is-loading {
        pointer-events: none;
        opacity: 0.8;
      }

      .gaip-floating-run-btn.is-loading .gaip-floating-run-icon {
        animation: gaip-spin 1s linear infinite;
      }

      .gaip-floating-run-icon {
        width: 16px;
        height: 16px;
        flex-shrink: 0;
      }

      .gaip-floating-run-label {
        white-space: nowrap;
      }

      @keyframes gaip-spin {
        from { transform: rotate(0deg); }
        to { transform: rotate(360deg); }
      }

      /* Responsive: fall back to viewport edge on narrower screens */
      @media (max-width: 900px) {
        .gaip-floating-run-btn {
          right: 16px;
        }
      }

      /* Smaller button on mobile */
      @media (max-width: 640px) {
        .gaip-floating-run-btn {
          bottom: 16px;
          right: 16px;
          padding: 10px 16px;
          font-size: 13px;
        }
      }

      /* Keyboard shortcut tooltip on hover */
      .gaip-floating-run-btn::after {
        content: 'Ctrl+Enter';
        position: absolute;
        bottom: 100%;
        right: 0;
        margin-bottom: 8px;
        padding: 4px 8px;
        
        background: rgba(0, 0, 0, 0.8);
        color: var(--gaip-surface);
        font-size: 11px;
        font-weight: 500;
        border-radius: 4px;
        white-space: nowrap;
        
        opacity: 0;
        transform: translateY(4px);
        transition: all 0.2s ease;
        pointer-events: none;
      }

      .gaip-floating-run-btn:hover::after {
        opacity: 1;
        transform: translateY(0);
      }

      /* Mac-specific shortcut */
      @supports (-webkit-touch-callout: none) {
        .gaip-floating-run-btn::after {
          content: '⌘+Enter';
        }
      }
    `;

    document.head.appendChild(styles);
  }

  /**
   * Find the original run button
   */
  function getOriginalButton() {
    return document.querySelector('.gaip-run-btn');
  }

  /**
   * Check if element is visible in viewport
   */
  function isInViewport(el) {
    if (!el) return false;
    const rect = el.getBoundingClientRect();
    return (
      rect.top >= 0 &&
      rect.bottom <= (window.innerHeight || document.documentElement.clientHeight)
    );
  }

  /**
   * Trigger the analysis
   */
  function triggerAnalysis(floatingBtn) {
    const originalBtn = getOriginalButton();
    if (!originalBtn) {
      console.warn('[FloatingRun] Original run button not found');
      return;
    }

    // Set loading state
    floatingBtn.classList.add('is-loading');

    // Click the original button
    originalBtn.click();

    // Remove loading state after analysis completes
    const onComplete = () => {
      floatingBtn.classList.remove('is-loading');
      document.removeEventListener('gaip:analysis-complete', onComplete);
    };
    document.addEventListener('gaip:analysis-complete', onComplete);

    // Fallback timeout in case event doesn't fire
    setTimeout(() => {
      floatingBtn.classList.remove('is-loading');
    }, 10000);
  }

  /**
   * Position button relative to Hub container
   */
  function updateButtonPosition(floatingBtn) {
    const hub = document.getElementById('gaip-hub');
    if (!hub) return;

    const hubRect = hub.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    
    // Calculate right position to align with Hub's right edge
    const rightOffset = viewportWidth - hubRect.right;
    
    // Minimum 16px from viewport edge
    const finalRight = Math.max(16, rightOffset);
    
    floatingBtn.style.right = finalRight + 'px';
  }

  /**
   * Setup visibility toggle based on original button visibility
   */
  function setupVisibilityToggle(floatingBtn) {
    const originalBtn = getOriginalButton();
    if (!originalBtn) return;

    let ticking = false;

    const checkVisibility = () => {
      // v1.1.0: Tab-aware visibility
      // On 'today' tab: show when dashboard scrolled out of view
      // On 'analysis' tab: show when original run button scrolled out of view
      // On all other tabs: always show (no run button or dashboard visible)
      const activeTab = document.querySelector('.gaip-tab.active');
      const tabId = activeTab ? activeTab.getAttribute('data-tab') : null;

      let shouldHide = false;

      if (tabId === 'today') {
        // Today tab: hide when dashboard is visible at top
        const dashboard = document.getElementById('gaip-daily-dashboard');
        if (dashboard && isInViewport(dashboard)) {
          shouldHide = true;
        }
      } else if (tabId === 'analysis') {
        // Analysis tab: hide when original run button is visible
        if (isInViewport(originalBtn)) {
          shouldHide = true;
        }
      }
      // programmes & reports: never hide (always show floating button)

      if (shouldHide) {
        floatingBtn.classList.add('is-hidden');
      } else {
        floatingBtn.classList.remove('is-hidden');
      }

      updateButtonPosition(floatingBtn);
      ticking = false;
    };

    window.addEventListener('scroll', () => {
      if (!ticking) {
        requestAnimationFrame(checkVisibility);
        ticking = true;
      }
    }, { passive: true });

    // Update position on resize
    window.addEventListener('resize', () => {
      updateButtonPosition(floatingBtn);
    }, { passive: true });

    // Re-check visibility when tabs change
    document.addEventListener('click', (e) => {
      if (e.target.closest('.gaip-tab')) {
        // Small delay to let tab switch complete
        setTimeout(checkVisibility, 50);
      }
    });

    // Initial check
    checkVisibility();
    updateButtonPosition(floatingBtn);
  }

  /**
   * Setup keyboard shortcut
   */
  function setupKeyboardShortcut(floatingBtn) {
    document.addEventListener('keydown', (e) => {
      // Ctrl+Enter or Cmd+Enter
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        // Don't trigger if user is typing in an input/textarea
        const activeEl = document.activeElement;
        const isTyping = activeEl && (
          activeEl.tagName === 'INPUT' || 
          activeEl.tagName === 'TEXTAREA' ||
          activeEl.isContentEditable
        );

        if (!isTyping) {
          e.preventDefault();
          triggerAnalysis(floatingBtn);
        }
      }
    });
  }

  /**
   * Initialize
   */
  function init() {
    // Wait for DOM ready
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', init);
      return;
    }

    // Wait for original button to exist
    const originalBtn = getOriginalButton();
    if (!originalBtn) {
      // Retry in 500ms
      setTimeout(init, 500);
      return;
    }

    injectStyles();
    const floatingBtn = createFloatingButton();

    // Wire up click handler
    floatingBtn.addEventListener('click', () => {
      triggerAnalysis(floatingBtn);
    });

    // Setup features
    setupVisibilityToggle(floatingBtn);
    setupKeyboardShortcut(floatingBtn);

  }

  init();
})();
