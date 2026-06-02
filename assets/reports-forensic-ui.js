/**
 * Reports Forensic UI v1.0.0
 *
 * Reads window.FORENSIC_RECORD (populated by hub-tissue-v3.js on analysis run)
 * and renders the Forensic Decision Record panel on /reports/forensic.
 *
 * Listens for: gaip:orchestrator-complete, gaip:analysis-complete
 * Renders into: #gaip-forensic-report-panel
 */
(function (global) {
    'use strict';

    var CONTAINER_ID = 'gaip-forensic-report-panel';

    var SEVERITY_COLORS = {
        ACCEPTABLE:       { color: '#065f46', bg: 'var(--gaip-good-bg)',         border: '#10b981', dot: '#10b981' },
        NO_DATA:          { color: 'var(--gaip-text-secondary)', bg: 'var(--gaip-surface-hover)', border: 'var(--gaip-border)', dot: '#a3b8b0' },
        MONITOR:          { color: '#92400e', bg: 'var(--gaip-warning-bg)',       border: '#f59e0b', dot: '#f59e0b' },
        HIGH_RISK:        { color: '#991b1b', bg: 'var(--gaip-critical-bg)',      border: '#ef4444', dot: '#ef4444' },
        IMMINENT_FAILURE: { color: '#7f1d1d', bg: 'var(--gaip-critical-bg)',      border: '#dc2626', dot: '#dc2626' },
    };

    function severityStyle(sev) {
        return SEVERITY_COLORS[sev] || SEVERITY_COLORS.MONITOR;
    }

    function esc(v) {
        if (v == null) return '—';
        return String(v)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');
    }

    function renderNoRecord() {
        return [
            '<div class="db-empty-state">',
            '  <svg width="36" height="36" fill="none" viewBox="0 0 24 24" stroke="#c8d5cf" stroke-width="1.5">',
            '    <path stroke-linecap="round" stroke-linejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2"/>',
            '    <rect x="9" y="3" width="6" height="4" rx="1"/>',
            '    <path stroke-linecap="round" d="M9 12h6M9 16h4"/>',
            '  </svg>',
            '  <div class="db-empty-title">No forensic record yet</div>',
            '  <div class="db-empty-sub">The record is generated when an analysis runs.</div>',
            '</div>',
        ].join('\n');
    }

    function renderRecord(fr) {
        var determinations = fr.determinations || {};
        var keys = Object.keys(determinations);

        var html = [
            // ── Run header ──────────────────────────────────────────────────
            '<div style="background:var(--gaip-surface);border:1px solid var(--gaip-border);border-radius:10px;padding:20px 22px;margin-bottom:16px">',
            '  <div style="display:flex;align-items:flex-start;justify-content:space-between;flex-wrap:wrap;gap:12px">',
            '    <div>',
            '      <div style="font-size:12px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:var(--gaip-text-secondary);margin-bottom:6px">Forensic Decision Record</div>',
            '      <div style="font-size:18px;font-weight:700;color:var(--gaip-text);font-family:monospace;margin-bottom:8px">' + esc(fr.runID) + '</div>',
            '      <div style="font-size:12px;color:var(--gaip-text-secondary);line-height:1.8">',
            '        <span style="margin-right:18px"><strong>Timestamp:</strong> ' + esc(fr.timestamp ? new Date(fr.timestamp).toLocaleString() : '—') + '</span>',
            '        <span><strong>Determinations:</strong> ' + keys.length + '</span>',
            '      </div>',
            '    </div>',
            '    <div style="display:flex;gap:8px;flex-wrap:wrap">',
            '      <button type="button" onclick="if(window.GAIP_PDFExport){GAIP_PDFExport.export()}else if(window.exportForensicRecordPDF){exportForensicRecordPDF()}" ',
            '              style="display:inline-flex;align-items:center;gap:7px;padding:9px 16px;background:var(--gaip-accent);color:#fff;border:none;border-radius:7px;font-size:13px;font-weight:600;cursor:pointer">',
            '        <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/></svg>',
            '        Export PDF',
            '      </button>',
            '      <button type="button" onclick="navigator.clipboard&&navigator.clipboard.writeText(\'' + esc(fr.runID) + '\').then(function(){var b=event.target;b.textContent=\'Copied!\';setTimeout(function(){b.textContent=\'Copy Run ID\'},1500)})" ',
            '              style="display:inline-flex;align-items:center;gap:7px;padding:9px 16px;background:var(--gaip-surface-muted);color:var(--gaip-text);border:1px solid var(--gaip-border);border-radius:7px;font-size:13px;font-weight:600;cursor:pointer">',
            '        Copy Run ID',
            '      </button>',
            '    </div>',
            '  </div>',
            '</div>',
        ];

        if (keys.length === 0) {
            html.push(
                '<div style="padding:24px;text-align:center;color:var(--gaip-text-secondary);font-size:13px">',
                '  Analysis ran but no determinations were recorded yet. This may happen if analysis is still in progress.',
                '</div>'
            );
        } else {
            // ── Per-engine determination cards ───────────────────────────────
            html.push('<div style="font-size:11px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:var(--gaip-text-secondary);margin:0 0 12px">Decision Chain (' + keys.length + ' engines)</div>');

            keys.forEach(function (engineKey) {
                var det = determinations[engineKey];
                if (!det) return;

                var sev = severityStyle(det.severity);
                var isOpen = (det.severity === 'HIGH_RISK' || det.severity === 'IMMINENT_FAILURE');
                var detailId = 'frdet-' + engineKey.replace(/[^a-z0-9]/gi, '-');

                html.push(
                    '<div style="background:var(--gaip-surface);border:1px solid var(--gaip-border);border-radius:10px;margin-bottom:10px;overflow:hidden">',

                    // Header row (always visible)
                    '  <div onclick="var d=document.getElementById(\'' + detailId + '\');d.style.display=d.style.display===\'none\'?\'block\':\'none\'" ',
                    '       style="display:flex;align-items:center;gap:12px;padding:14px 18px;cursor:pointer;user-select:none">',
                    '    <span style="flex-shrink:0;width:10px;height:10px;border-radius:50%;background:' + sev.dot + ';display:inline-block;margin-top:2px"></span>',
                    '    <div style="flex:1;min-width:0">',
                    '      <span style="font-size:13px;font-weight:700;color:var(--gaip-text)">' + esc(engineKey) + '</span>',
                    '      <span style="font-size:11px;font-weight:700;padding:2px 7px;border-radius:4px;margin-left:8px;background:' + sev.bg + ';color:' + sev.color + ';border:1px solid ' + sev.border + '">' + esc(det.severity || '—') + '</span>',
                    '    </div>',
                    '    <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="var(--gaip-text-secondary)" stroke-width="2.5" style="flex-shrink:0"><path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7"/></svg>',
                    '  </div>',

                    // Expandable detail
                    '  <div id="' + detailId + '" style="display:' + (isOpen ? 'block' : 'none') + ';padding:0 18px 16px;border-top:1px solid var(--gaip-border)">',
                    '    <div style="padding-top:12px">',
                    '      <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--gaip-text-secondary);margin-bottom:6px">Decision</div>',
                    '      <div style="font-size:13px;color:var(--gaip-text);line-height:1.6;margin-bottom:12px">' + esc(det.decision) + '</div>'
                );

                if (det.actions && det.actions !== 'None required') {
                    html.push(
                        '      <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--gaip-text-secondary);margin-bottom:6px">Actions Required</div>',
                        '      <div style="font-size:13px;color:var(--gaip-text);line-height:1.6">' + esc(det.actions) + '</div>'
                    );
                }

                html.push('    </div>', '  </div>', '</div>');
            });
        }

        // ── Inputs / Assumptions (collapsible) ──────────────────────────────
        var inputKeys = Object.keys(fr.inputs || {});
        var assumptionKeys = Object.keys(fr.assumptions || {});

        if (inputKeys.length > 0 || assumptionKeys.length > 0) {
            html.push(
                '<div style="margin-top:16px;border:1px solid var(--gaip-border);border-radius:10px;overflow:hidden">',
                '  <div onclick="var d=document.getElementById(\'fr-inputs-detail\');d.style.display=d.style.display===\'none\'?\'block\':\'none\'" ',
                '       style="display:flex;align-items:center;justify-content:space-between;padding:14px 18px;cursor:pointer;background:var(--gaip-surface)">',
                '    <span style="font-size:13px;font-weight:700;color:var(--gaip-text)">Input Snapshot &amp; Assumptions</span>',
                '    <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="var(--gaip-text-secondary)" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7"/></svg>',
                '  </div>',
                '  <div id="fr-inputs-detail" style="display:none;padding:16px 18px;border-top:1px solid var(--gaip-border);background:var(--gaip-surface)">'
            );

            if (inputKeys.length > 0) {
                html.push('<div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--gaip-text-secondary);margin-bottom:8px">Inputs</div>');
                html.push('<table style="width:100%;border-collapse:collapse;font-size:12px;margin-bottom:14px">');
                inputKeys.forEach(function (engine) {
                    var engineInputs = fr.inputs[engine];
                    if (typeof engineInputs === 'object' && engineInputs !== null) {
                        Object.keys(engineInputs).forEach(function (key) {
                            html.push(
                                '<tr style="border-bottom:1px solid var(--gaip-border)">',
                                '  <td style="padding:5px 8px;color:var(--gaip-text-secondary);width:140px">' + esc(engine) + '</td>',
                                '  <td style="padding:5px 8px;color:var(--gaip-text-secondary);width:160px">' + esc(key) + '</td>',
                                '  <td style="padding:5px 8px;color:var(--gaip-text)">' + esc(engineInputs[key]) + '</td>',
                                '</tr>'
                            );
                        });
                    }
                });
                html.push('</table>');
            }

            if (assumptionKeys.length > 0) {
                html.push('<div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--gaip-text-secondary);margin-bottom:8px">Assumptions</div>');
                html.push('<table style="width:100%;border-collapse:collapse;font-size:12px">');
                assumptionKeys.forEach(function (key) {
                    html.push(
                        '<tr style="border-bottom:1px solid var(--gaip-border)">',
                        '  <td style="padding:5px 8px;color:var(--gaip-text-secondary);width:220px">' + esc(key) + '</td>',
                        '  <td style="padding:5px 8px;color:var(--gaip-text)">' + esc(fr.assumptions[key]) + '</td>',
                        '</tr>'
                    );
                });
                html.push('</table>');
            }

            html.push('  </div>', '</div>');
        }

        return html.join('\n');
    }

    function render() {
        var container = document.getElementById(CONTAINER_ID);
        if (!container) return;

        var fr = global.FORENSIC_RECORD;

        if (!fr || !fr.runID) {
            container.innerHTML = renderNoRecord();
            return;
        }

        container.innerHTML = renderRecord(fr);
    }

    function init() {
        // Render once on load in case analysis already ran (e.g. restored from cache)
        render();

        // Re-render whenever analysis completes
        document.addEventListener('gaip:orchestrator-complete', function () {
            setTimeout(render, 300);
        });
        document.addEventListener('gaip:analysis-complete', function () {
            setTimeout(render, 300);
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    global.GilbaForensicUI = { render: render };

}(window));
