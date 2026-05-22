{{-- Suppress all hub-injected UI elements that auto-insert into document.body --}}
{{-- These elements are created by hub scripts that run inside the hidden #rp-hub-runner div --}}
#gaip-floating-run-btn,
#gaip-quick-jump-nav,
#gaip-whatif-btn,
#gaip-weather-status-container,
#gaip-hub-header-bar,
.gaip-header-bar,
#gaip-confidence-details-panel,
#gaip-confidence-toast,
#gaip-confidence-indicator,
#gaip-confidence-indicator-disease,
#gaip-mobile-turf-fab,
.gilba-synthesis-floater,
#gaip-tab-navigation,
#gaip-reports-container {
    display: none !important;
}
