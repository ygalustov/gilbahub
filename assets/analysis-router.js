/* Analysis SPA Router
 * Must be loaded BEFORE disease-analysis.js and growth-light-analysis.js.
 * Sets GAIP_ANALYSIS_ROUTER = true so individual page scripts skip auto-init.
 */

// Signal to page scripts: we are in SPA mode, don't self-initialise.
window.GAIP_ANALYSIS_ROUTER = true;

(function (global) {
    'use strict';

    var TAB_IDS = ['disease', 'growth-light', 'soil-nutrition', 'water-balance', 'stress', 'pgr-irrigation'];
    var rendered = {};
    var currentTab = null;

    function getTabFromHash() {
        var hash = (global.location.hash || '').slice(1);
        return TAB_IDS.indexOf(hash) !== -1 ? hash : 'disease';
    }

    function showTab(tabId) {
        if (TAB_IDS.indexOf(tabId) === -1) tabId = 'disease';
        if (tabId === currentTab) return;
        currentTab = tabId;

        // Update URL hash without triggering a page reload
        if (global.location.hash !== '#' + tabId) {
            global.history.pushState(null, '', '#' + tabId);
        }

        // Update active class on tab links
        document.querySelectorAll('.gl-tab[data-tab]').forEach(function (el) {
            el.classList.toggle('active', el.dataset.tab === tabId);
        });

        // Show the active wrapper, hide all others
        TAB_IDS.forEach(function (id) {
            var wrapper = document.getElementById('analysis-tab-' + id);
            if (!wrapper) return;
            wrapper.style.display = id === tabId ? 'block' : 'none';
        });

        // Render tab content on first visit
        if (!rendered[tabId]) {
            rendered[tabId] = true;
            if (tabId === 'disease' && global.GAIP_DiseaseAnalysis) {
                global.GAIP_DiseaseAnalysis.boot();
            } else if (tabId === 'growth-light' && global.GAIP_GrowthLightAnalysis) {
                global.GAIP_GrowthLightAnalysis.init();
            } else if (tabId === 'soil-nutrition' && global.GAIP_SoilNutritionAnalysis) {
                global.GAIP_SoilNutritionAnalysis.init();
            } else if (tabId === 'water-balance' && global.GAIP_WaterBalanceAnalysis) {
                global.GAIP_WaterBalanceAnalysis.init();
            } else if (tabId === 'stress' && global.GAIP_StressAnalysis) {
                global.GAIP_StressAnalysis.init();
            } else if (tabId === 'pgr-irrigation' && global.GAIP_PGRIrrigationAnalysis) {
                global.GAIP_PGRIrrigationAnalysis.init();
            }
        }
    }

    document.addEventListener('DOMContentLoaded', function () {
        // Intercept tab link clicks
        document.addEventListener('click', function (e) {
            var tab = e.target.closest('.gl-tab[data-tab]');
            if (!tab) return;
            var tabId = tab.dataset.tab;
            if (!tabId) return;
            e.preventDefault();
            showTab(tabId);
        });

        // Browser back / forward
        global.addEventListener('popstate', function () {
            showTab(getTabFromHash());
        });

        // Initial render
        showTab(getTabFromHash());
    });

}(window));
