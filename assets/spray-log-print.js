/**
 * =============================================================================
 * GILBA SPRAY LOG — Print Export Module v1.0.0
 * =============================================================================
 *
 * Generates a printable spray log report from existing spray log entries.
 * Designed for turf managers who need printed records for:
 *   - BASIS/NRoSO CPD audits (UK)
 *   - APVMA record-keeping obligations (AU)
 *   - Council/venue compliance reporting
 *   - Insurance and duty-of-care documentation
 *
 * Uses browser window.print() on a formatted HTML view. No server dependency.
 *
 * DEPENDENCIES:
 *   - spray-log.js (GAIP_SprayLog.list, GAIP_SprayLog.formatDate)
 *   - GAIP_SampleManager.getActiveSiteId() — for site context
 *   - GAIP_HUB_CONFIG — for site name
 *
 * @package Gilba_Hub
 * @version 1.0.0
 * @since b35fix294
 * =============================================================================
 */
(function(global) {
    'use strict';

    var LOG_PREFIX = '[SprayLogPrint]';

    // =========================================================================
    // CONFIGURATION
    // =========================================================================

    var CATEGORY_LABELS = {
        'fungicide':    'Fungicide',
        'pgr':          'PGR',
        'nutrition':    'Nutrition',
        'wetting_agent':'Wetting Agent',
        'pre_emergent': 'Pre-Emergent Herbicide',
        'insecticide':  'Insecticide',
        'other':        'Other'
    };

    var ZONE_LABELS = {
        'greens':   'Greens',
        'tees':     'Tees',
        'fairways': 'Fairways',
        'sports':   'Sports Pitch',
        'surrounds':'Surrounds',
        'all':      'All Areas'
    };

    // =========================================================================
    // SITE CONTEXT
    // =========================================================================

    function getSiteName() {
        // Try site config first
        try {
            var SC = global.GAIP_SiteConfig || global.GAIP_SiteContext;
            var siteId = global.GAIP_SiteContext ? global.GAIP_SiteContext.getSiteId() : null;
            if (SC && siteId && typeof SC.getConfig === 'function') {
                var cfg = SC.getConfig(siteId);
                if (cfg && cfg.name) return cfg.name;
            }
        } catch(e) {}

        // Fallback to hub config
        if (global.GAIP_HUB_CONFIG && global.GAIP_HUB_CONFIG.siteName) {
            return global.GAIP_HUB_CONFIG.siteName;
        }

        // Fallback to header element
        var header = document.querySelector('.gaip-site-name, .gilba-hub-site-name, [data-site-name]');
        if (header) return header.textContent.trim();

        return 'Site';
    }

    function getSiteId() {
        if (global.GAIP_SiteContext && typeof global.GAIP_SiteContext.getSiteId === 'function') {
            return global.GAIP_SiteContext.getSiteId();
        }
        if (global.GAIP_SampleManager && typeof global.GAIP_SampleManager.getActiveSiteId === 'function') {
            return global.GAIP_SampleManager.getActiveSiteId();
        }
        return null;
    }

    // =========================================================================
    // DATA FETCH
    // =========================================================================

    async function fetchEntries(filters) {
        var SL = global.GAIP_SprayLog;
        if (!SL || typeof SL.list !== 'function') {
            console.error(LOG_PREFIX, 'GAIP_SprayLog not available');
            return [];
        }

        var siteId = getSiteId();
        if (!siteId) {
            console.error(LOG_PREFIX, 'No active site');
            return [];
        }

        var params = Object.assign({ site_id: siteId, limit: 500 }, filters || {});
        var result = await SL.list(params);
        return (result.success && result.entries) ? result.entries : [];
    }

    // =========================================================================
    // DATE HELPERS
    // =========================================================================

    function formatDate(isoStr) {
        if (!isoStr) return '';
        var SL = global.GAIP_SprayLog;
        if (SL && typeof SL.formatDate === 'function') return SL.formatDate(isoStr);
        try {
            var d = new Date(isoStr);
            return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
        } catch(e) {
            return isoStr;
        }
    }

    function formatDateRange(entries) {
        if (!entries || entries.length === 0) return '';
        var dates = entries.map(function(e) { return e.application_date || ''; }).filter(Boolean).sort();
        if (dates.length === 0) return '';
        return formatDate(dates[0]) + ' to ' + formatDate(dates[dates.length - 1]);
    }

    // =========================================================================
    // HTML GENERATION
    // =========================================================================

    function escHtml(str) {
        if (!str) return '';
        var div = document.createElement('div');
        div.textContent = String(str);
        return div.innerHTML;
    }

    function buildPrintHTML(entries, options) {
        options = options || {};
        var siteName = options.siteName || getSiteName();
        var dateRange = formatDateRange(entries);
        var generatedDate = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
        var filterCategory = options.category || 'All Categories';

        // Sort by date descending (most recent first)
        entries.sort(function(a, b) {
            return (b.application_date || '').localeCompare(a.application_date || '');
        });

        // Summary stats
        var categoryCounts = {};
        entries.forEach(function(e) {
            var cat = e.product_category || 'other';
            categoryCounts[cat] = (categoryCounts[cat] || 0) + 1;
        });

        var summaryRows = Object.keys(categoryCounts).sort().map(function(cat) {
            return '<tr><td style="padding:4px 12px;">' + escHtml(CATEGORY_LABELS[cat] || cat) + '</td>' +
                   '<td style="padding:4px 12px;text-align:right;font-weight:600;">' + categoryCounts[cat] + '</td></tr>';
        }).join('');

        // Main table rows
        var tableRows = entries.map(function(e, idx) {
            var dateStr = formatDate(e.application_date);
            var zone = ZONE_LABELS[e.zone] || e.zone || '';
            var product = escHtml(e.product_name || '');
            var ai = escHtml(e.active_ingredient || '');
            var category = CATEGORY_LABELS[e.product_category] || e.product_category || '';
            var frac = e.frac_group ? 'FRAC ' + e.frac_group : '';
            var rate = e.rate ? e.rate + ' ' + (e.rate_unit || '') : '';
            var target = escHtml(e.target || '');
            var notes = escHtml(e.notes || '');
            var source = e.source || '';
            var operator = escHtml(e.operator || e.user_display_name || '');
            var bgColor = idx % 2 === 0 ? '#ffffff' : '#f9fafb';

            return '<tr style="background:' + bgColor + ';">' +
                '<td style="padding:6px 8px;border:1px solid #d1d5db;white-space:nowrap;">' + dateStr + '</td>' +
                '<td style="padding:6px 8px;border:1px solid #d1d5db;">' + zone + '</td>' +
                '<td style="padding:6px 8px;border:1px solid #d1d5db;"><strong>' + product + '</strong>' +
                    (frac ? '<br><span style="font-size:10px;color:#6b7280;">' + frac + '</span>' : '') +
                    (ai ? '<br><span style="font-size:10px;color:#6b7280;">' + ai + '</span>' : '') + '</td>' +
                '<td style="padding:6px 8px;border:1px solid #d1d5db;">' + category + '</td>' +
                '<td style="padding:6px 8px;border:1px solid #d1d5db;">' + rate + '</td>' +
                '<td style="padding:6px 8px;border:1px solid #d1d5db;">' + target + '</td>' +
                '<td style="padding:6px 8px;border:1px solid #d1d5db;font-size:11px;">' + notes + '</td>' +
                '<td style="padding:6px 8px;border:1px solid #d1d5db;">' + operator + '</td>' +
            '</tr>';
        }).join('');

        return '<!DOCTYPE html><html><head><meta charset="utf-8">' +
            '<title>Spray Log, ' + escHtml(siteName) + '</title>' +
            '<style>' +
                '@page { size: A4 landscape; margin: 15mm; }' +
                '@media print {' +
                    'body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }' +
                    '.no-print { display: none !important; }' +
                    'table { page-break-inside: auto; }' +
                    'tr { page-break-inside: avoid; page-break-after: auto; }' +
                    'thead { display: table-header-group; }' +
                '}' +
                'body { font-family: Arial, Helvetica, sans-serif; font-size: 12px; color: #111827; margin: 0; padding: 20px; }' +
                'h1 { font-size: 18px; margin: 0 0 4px 0; }' +
                'h2 { font-size: 14px; margin: 16px 0 8px 0; color: #374151; }' +
                '.header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #111827; padding-bottom: 8px; margin-bottom: 12px; }' +
                '.header-right { text-align: right; font-size: 11px; color: #6b7280; }' +
                '.summary-table { border-collapse: collapse; font-size: 12px; margin-bottom: 16px; }' +
                '.summary-table td { border: 1px solid #e5e7eb; }' +
                '.main-table { width: 100%; border-collapse: collapse; font-size: 11px; }' +
                '.main-table th { padding: 6px 8px; border: 1px solid #9ca3af; background: #f3f4f6; text-align: left; font-weight: 600; font-size: 11px; }' +
                '.signature-block { margin-top: 24px; display: flex; gap: 40px; }' +
                '.sig-line { border-top: 1px solid #9ca3af; width: 200px; padding-top: 4px; font-size: 11px; color: #6b7280; }' +
                '.footer { margin-top: 16px; font-size: 10px; color: #9ca3af; border-top: 1px solid #e5e7eb; padding-top: 8px; }' +
            '</style></head><body>' +

            '<div class="no-print" style="padding:12px;background:#059669;color:white;text-align:center;margin-bottom:16px;border-radius:6px;cursor:pointer;" onclick="window.print()">' +
                '<strong>Print this report</strong> (Ctrl+P / Cmd+P) or save as PDF' +
            '</div>' +

            '<div class="header">' +
                '<div>' +
                    '<h1>Chemical Application Record</h1>' +
                    '<div style="font-size:13px;font-weight:600;color:#374151;">' + escHtml(siteName) + '</div>' +
                    (dateRange ? '<div style="font-size:11px;color:#6b7280;">Period: ' + dateRange + '</div>' : '') +
                '</div>' +
                '<div class="header-right">' +
                    '<div>Generated: ' + generatedDate + '</div>' +
                    '<div>' + entries.length + ' application' + (entries.length !== 1 ? 's' : '') + '</div>' +
                    '<div style="margin-top:4px;"><img src="" onerror="this.style.display=\'none\'" style="height:24px;" alt=""></div>' +
                '</div>' +
            '</div>' +

            '<h2>Application Summary</h2>' +
            '<table class="summary-table"><tbody>' + summaryRows + '</tbody></table>' +

            '<h2>Application Details</h2>' +
            '<table class="main-table"><thead><tr>' +
                '<th>Date</th>' +
                '<th>Zone</th>' +
                '<th>Product / AI</th>' +
                '<th>Category</th>' +
                '<th>Rate</th>' +
                '<th>Target</th>' +
                '<th>Notes</th>' +
                '<th>Operator</th>' +
            '</tr></thead><tbody>' + tableRows + '</tbody></table>' +

            '<div class="signature-block">' +
                '<div><div class="sig-line">Prepared by</div></div>' +
                '<div><div class="sig-line">Date</div></div>' +
                '<div><div class="sig-line">Verified by (Supervisor)</div></div>' +
                '<div><div class="sig-line">Date</div></div>' +
            '</div>' +

            '<div class="footer">' +
                '<div>This report was generated by GAIP Hub (Gilba Agronomic Intelligence Platform). ' +
                'Chemical application records should be retained for a minimum of 3 years as per regulatory requirements. ' +
                'Verify all entries against original product labels and safety data sheets.</div>' +
                '<div style="margin-top:4px;">gilbasolutions.com | GAIP Hub v' + (global.GAIP_HUB_CONFIG && global.GAIP_HUB_CONFIG.version || '') + '</div>' +
            '</div>' +

        '</body></html>';
    }

    // =========================================================================
    // PRINT EXECUTION
    // =========================================================================

    /**
     * Open printable spray log in a new window
     * @param {Object} [filters] - Optional filters (category, date_from, date_to)
     */
    async function printSprayLog(filters) {
        console.log(LOG_PREFIX, 'Generating print report...');

        var entries = await fetchEntries(filters);
        if (!entries || entries.length === 0) {
            alert('No spray log entries found for the current site. Log some applications first.');
            return;
        }

        var html = buildPrintHTML(entries, {
            siteName: getSiteName(),
            category: (filters && filters.category) ? (CATEGORY_LABELS[filters.category] || filters.category) : 'All Categories'
        });

        // Open in new window for clean print
        var printWindow = window.open('', '_blank', 'width=1100,height=800');
        if (!printWindow) {
            alert('Pop-up blocked. Please allow pop-ups for this site to print the spray log.');
            return;
        }
        printWindow.document.write(html);
        printWindow.document.close();

        console.log(LOG_PREFIX, 'Print report opened with', entries.length, 'entries');
    }

    // =========================================================================
    // UI INTEGRATION
    // =========================================================================

    /**
     * Inject print button into spray log UI
     * Called after spray log table renders
     */
    function injectPrintButton() {
        // Don't inject twice
        if (document.getElementById('gaip-sl-print-btn')) return;

        // Target the spray log toolbar (contains filters + "Log Application" button)
        var toolbar = document.querySelector('.gaip-sl-toolbar');
        if (!toolbar) return;

        var btn = document.createElement('button');
        btn.id = 'gaip-sl-print-btn';
        btn.className = 'gaip-btn gaip-btn-secondary';
        btn.innerHTML = '\uD83D\uDDA8\uFE0F Print Log';
        btn.title = 'Print spray log for audit/reporting';
        btn.style.cssText = 'padding:6px 12px;font-size:13px;cursor:pointer;border:1px solid var(--gaip-border,#d1d5db);border-radius:4px;background:var(--gaip-surface,#fff);color:var(--gaip-text,#111);white-space:nowrap;';

        btn.addEventListener('click', function() {
            printSprayLog();
        });

        // Insert next to the "Log Application" button
        var addBtn = toolbar.querySelector('.gaip-sl-add-btn, #gaip-sl-add-btn');
        if (addBtn) {
            addBtn.parentNode.insertBefore(btn, addBtn);
        } else {
            toolbar.appendChild(btn);
        }
        console.log(LOG_PREFIX, 'Print button injected');
    }

    // Auto-inject when spray log table renders
    function initPrintButton() {
        // Try immediate injection
        injectPrintButton();

        // If toolbar doesn't exist yet, retry with increasing delays
        if (!document.querySelector('.gaip-sl-toolbar')) {
            var retries = 0;
            var retryInterval = setInterval(function() {
                retries++;
                if (document.querySelector('.gaip-sl-toolbar')) {
                    injectPrintButton();
                    clearInterval(retryInterval);
                } else if (retries > 20) {
                    clearInterval(retryInterval);
                }
            }, 500);
        }

        // Also observe for dynamic rebuilds (site-switch etc)
        var observer = new MutationObserver(function() {
            if (document.querySelector('.gaip-sl-toolbar') && !document.getElementById('gaip-sl-print-btn')) {
                injectPrintButton();
            }
        });

        // Watch the main hub container for spray log section insertion
        var hubContainer = document.getElementById('gaip-sl-body') ||
                           document.querySelector('.gaip-spray-log') ||
                           document.querySelector('.gilba-hub-content') ||
                           document.body;
        observer.observe(hubContainer, { childList: true, subtree: true });
    }

    // =========================================================================
    // BOOTSTRAP
    // =========================================================================

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initPrintButton);
    } else {
        // Delay slightly to let spray log UI render first
        setTimeout(initPrintButton, 500);
    }

    // Export
    global.GAIP_SprayLogPrint = {
        print: printSprayLog,
        injectButton: injectPrintButton
    };

})(typeof window !== 'undefined' ? window : this);
