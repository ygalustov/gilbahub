/**
 * =============================================================================
 * GILBA HUB SENSOR INTEGRATION UI v1.0.0
 * =============================================================================
 *
 * User interface for sensor management:
 * - API credentials per vendor
 * - Site-to-sensor mapping
 * - Live sensor status display
 * - Integration with Site Selector
 *
 * Dependencies:
 *   - sensor-integration-manager.js (GAIP_SensorManager)
 *   - sensor-api-hydrosight.js (vendor adapter)
 *   - sample-manager.js (site list)
 *
 * @author Gilba Solutions
 * @version 1.0.0
 * =============================================================================
 */

(function(global) {
    'use strict';

    var VERSION = '1.0.1';
    var DEBUG = false;

    // =========================================================================
    // LOGGING
    // =========================================================================

    function log() {
        if (!DEBUG) return;
        var args = ['[SensorUI]'].concat(Array.prototype.slice.call(arguments));
        console.log.apply(console, args);
    }

    // =========================================================================
    // MAIN SETTINGS PANEL
    // =========================================================================

    function renderSettingsPanel() {
        var SM = global.GAIP_SensorManager;
        if (!SM) {
            return '<div class="gaip-sensor-settings"><p>Sensor manager not loaded</p></div>';
        }

        var vendors = SM.getVendorList();
        var html = '<div class="gaip-sensor-settings" style="padding: 15px; background: var(--gaip-surface-muted); border-radius: 8px; margin: 10px 0;">';

        html += '<h4 style="margin: 0 0 15px 0; display: flex; align-items: center; gap: 8px;">' +
            '<span style="font-size: 1.2em;">📡</span> Live Sensor Integration</h4>';

        html += '<p style="color: var(--gaip-text-secondary); font-size: 0.9em; margin-bottom: 15px;">' +
            'Connect wireless soil sensors for real-time VWC, EC, and soil temperature data.</p>';

        // Render each vendor section
        vendors.forEach(function(vendor) {
            html += renderVendorSection(vendor);
        });

        // If no vendors registered yet
        if (vendors.length === 0) {
            html += '<p style="color: var(--gaip-text-muted); font-style: italic;">No sensor vendors available. Vendor modules loading...</p>';
        }

        // Sensor mapping section
        html += '<div id="gaip-sensor-mapping-section" style="margin-top: 20px; padding-top: 15px; border-top: 1px solid var(--gaip-border); display: none;">';
        html += '<h5 style="margin: 0 0 10px 0;">📍 Site-Sensor Mapping</h5>';
        html += '<p style="color: var(--gaip-text-secondary); font-size: 0.85em; margin-bottom: 10px;">' +
            'Assign sensors to sites. Sensors can only belong to one site.</p>';
        html += '<div id="gaip-sensor-mapping-content"></div>';
        html += '<button type="button" id="gaip-sensor-mapping-save" class="gaip-btn" ' +
            'style="margin-top: 10px; padding: 8px 16px; background: #28a745; color: var(--gaip-surface); border: none; border-radius: 4px; cursor: pointer;">' +
            'Save Mappings</button>';
        html += '</div>';

        // Status summary
        html += '<div id="gaip-sensor-status-summary" style="margin-top: 15px; padding: 10px; background: #e9ecef; border-radius: 4px;"></div>';

        html += '</div>';

        return html;
    }

    function renderVendorSection(vendor) {
        var SM = global.GAIP_SensorManager;
        var isConnected = vendor.isConnected;
        var hasKey = vendor.hasCredentials;

        var html = '<div class="gaip-vendor-section" data-vendor="' + vendor.id + '" ' +
            'style="margin-bottom: 15px; padding: 12px; background: var(--gaip-surface); border: 1px solid var(--gaip-border); border-radius: 6px;">';

        // Header with vendor name and status
        html += '<div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">';
        html += '<span style="font-weight: 600;">' + getVendorIcon(vendor.id) + ' ' + vendor.name + '</span>';

        if (isConnected) {
            html += '<span style="background: #28a745; color: var(--gaip-surface); padding: 2px 8px; border-radius: 10px; font-size: 0.75em;">Connected</span>';
        } else if (hasKey) {
            html += '<span style="background: #ffc107; color: var(--gaip-text); padding: 2px 8px; border-radius: 10px; font-size: 0.75em;">Not Connected</span>';
        } else {
            html += '<span style="background: var(--gaip-text-secondary); color: var(--gaip-surface); padding: 2px 8px; border-radius: 10px; font-size: 0.75em;">Not Configured</span>';
        }
        html += '</div>';

        // API Key input
        html += '<div style="margin-bottom: 10px;">';
        html += '<label style="display: block; font-size: 0.85em; margin-bottom: 4px;">API Key</label>';
        html += '<input type="password" class="gaip-vendor-api-key" data-vendor="' + vendor.id + '" ' +
            'placeholder="Enter your ' + vendor.name + ' API key" ' +
            'style="width: 100%; padding: 8px; border: 1px solid var(--gaip-border); border-radius: 4px; font-size: 0.9em;" />';
        html += '</div>';

        // Vendor-specific extra fields (e.g. SpecConnect collection name)
        var vendorObj = SM.getVendor(vendor.id);
        if (vendorObj && typeof vendorObj.renderExtraFields === 'function') {
            html += vendorObj.renderExtraFields();
        }

        // Action buttons
        html += '<div style="display: flex; gap: 8px;">';
        html += '<button type="button" class="gaip-vendor-test" data-vendor="' + vendor.id + '" ' +
            'style="padding: 6px 12px; background: #007bff; color: var(--gaip-surface); border: none; border-radius: 4px; cursor: pointer; font-size: 0.85em;">' +
            'Test Connection</button>';
        html += '<button type="button" class="gaip-vendor-save" data-vendor="' + vendor.id + '" ' +
            'style="padding: 6px 12px; background: #28a745; color: var(--gaip-surface); border: none; border-radius: 4px; cursor: pointer; font-size: 0.85em;">' +
            'Save</button>';
        html += '</div>';

        // Status message area
        html += '<div class="gaip-vendor-status" data-vendor="' + vendor.id + '" style="margin-top: 8px; font-size: 0.85em;"></div>';

        html += '</div>';

        return html;
    }

    function getVendorIcon(vendorId) {
        var icons = {
            'hydrosight': '🛰️',
            'soilscout': '📡',
            'specconnect': '🌡️'
        };
        return icons[vendorId] || '📊';
    }

    // =========================================================================
    // SITE-SENSOR MAPPING UI
    // =========================================================================

    function renderMappingContent() {
        var SM = global.GAIP_SensorManager;
        var SampleMgr = global.GAIP_SampleManager;

        if (!SM || !SampleMgr) {
            return '<p style="color: var(--gaip-text-muted);">Loading...</p>';
        }

        var allSensors = SM.getAllSensors();
        var sites = SampleMgr.getSiteList();

        if (allSensors.length === 0) {
            return '<p style="color: var(--gaip-text-muted); font-style: italic;">No sensors discovered. Connect a sensor vendor first.</p>';
        }

        var html = '<table style="width: 100%; border-collapse: collapse; font-size: 0.9em;">';
        html += '<thead><tr style="background: #e9ecef;">';
        html += '<th style="padding: 8px; text-align: left;">Sensor</th>';
        html += '<th style="padding: 8px; text-align: left;">Vendor</th>';
        html += '<th style="padding: 8px; text-align: left;">Assign to Site</th>';
        html += '<th style="padding: 8px; text-align: right;">Last Reading</th>';
        html += '</tr></thead><tbody>';

        allSensors.forEach(function(sensor) {
            var currentSite = SM.getSiteForSensor(sensor.vendorId, sensor.sensorId);
            var lastReading = formatLastReading(sensor.lastReading);

            html += '<tr style="border-bottom: 1px solid var(--gaip-border);">';
            html += '<td style="padding: 8px;">' + escapeHtml(sensor.name) + '</td>';
            html += '<td style="padding: 8px;">' + escapeHtml(sensor.vendorName) + '</td>';
            html += '<td style="padding: 8px;">';
            html += '<select class="gaip-sensor-site-select" data-vendor="' + sensor.vendorId + '" data-sensor="' + sensor.sensorId + '" ' +
                'style="width: 100%; padding: 4px 8px; border: 1px solid var(--gaip-border); border-radius: 4px;">';
            html += '<option value="">-- Unassigned --</option>';

            sites.forEach(function(site) {
                var selected = (site.id === currentSite) ? ' selected' : '';
                html += '<option value="' + site.id + '"' + selected + '>' + escapeHtml(site.label) + '</option>';
            });

            html += '</select>';
            html += '</td>';
            html += '<td style="padding: 8px; text-align: right;">' + lastReading + '</td>';
            html += '</tr>';
        });

        html += '</tbody></table>';

        return html;
    }

    function formatLastReading(reading) {
        if (!reading) return '<span style="color: var(--gaip-text-muted);">No data</span>';

        var parts = [];
        if (reading.moisture !== undefined) {
            parts.push(parseFloat(reading.moisture).toFixed(1) + '% VWC');
        }
        if (reading.temperature !== undefined) {
            parts.push(parseFloat(reading.temperature).toFixed(1) + '°C');
        }
        if (reading.salinity !== undefined) {
            parts.push(parseFloat(reading.salinity).toFixed(2) + ' dS/m');
        }

        return parts.length > 0 ? parts.join(', ') : '<span style="color: var(--gaip-text-muted);">No data</span>';
    }

    function escapeHtml(str) {
        if (!str) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    // =========================================================================
    // STATUS SUMMARY
    // =========================================================================

    function updateStatusSummary() {
        var SM = global.GAIP_SensorManager;
        var summaryDiv = document.getElementById('gaip-sensor-status-summary');
        if (!summaryDiv || !SM) return;

        var allSensors = SM.getAllSensors();
        var unmapped = SM.getUnmappedSensors();
        var sitesWithSensors = SM.getSitesWithSensors();

        var html = '';

        if (allSensors.length === 0) {
            html = '<span style="color: var(--gaip-text-secondary);">No sensors connected. Configure a sensor vendor above.</span>';
        } else {
            html = '<strong>' + allSensors.length + ' sensor(s)</strong> discovered';

            if (unmapped.length > 0) {
                html += ' • <span style="color: #dc3545;">' + unmapped.length + ' unmapped</span>';
            }

            if (sitesWithSensors.length > 0) {
                html += ' • ' + (sitesWithSensors.length - 1) + ' site(s) with sensors'; // -1 for "All Sites"
            }
        }

        summaryDiv.innerHTML = html;
    }

    // =========================================================================
    // EVENT HANDLERS
    // =========================================================================

    function attachEventHandlers() {
        // Test connection buttons
        document.addEventListener('click', function(e) {
            if (e.target.classList.contains('gaip-vendor-test')) {
                var vendorId = e.target.dataset.vendor;
                handleTestConnection(vendorId);
            }

            if (e.target.classList.contains('gaip-vendor-save')) {
                var vendorId = e.target.dataset.vendor;
                handleSaveCredentials(vendorId);
            }

            if (e.target.id === 'gaip-sensor-mapping-save') {
                handleSaveMappings();
            }
        });

        // Site selection changes
        document.addEventListener('change', function(e) {
            if (e.target.classList.contains('gaip-sensor-site-select')) {
                // Mapping changed - visual feedback
                e.target.style.borderColor = '#ffc107';
            }
        });

        // Listen for sensor discovery
        document.addEventListener('gaip:sensors:discovered', function() {
            refreshMappingUI();
            updateStatusSummary();
        });

        // Re-render mapping dropdowns after site list is fully loaded from persistence.
        // SensorManager fires gaip:sensors:discovered before sample-persistence has
        // recovered all sites into SampleManager, so the site dropdowns are empty on
        // first render. gaip:site-config-applied fires once site configs are fully
        // restored — at that point getSiteList() returns the complete list.
        document.addEventListener('gaip:site-config-applied', function() {
            refreshMappingUI();
            updateStatusSummary();
        });
    }

    async function handleTestConnection(vendorId) {
        var SM = global.GAIP_SensorManager;
        var statusDiv = document.querySelector('.gaip-vendor-status[data-vendor="' + vendorId + '"]');
        var apiKeyInput = document.querySelector('.gaip-vendor-api-key[data-vendor="' + vendorId + '"]');

        if (!statusDiv || !apiKeyInput) return;

        var apiKey = apiKeyInput.value.trim();
        if (!apiKey) {
            statusDiv.innerHTML = '<span style="color: #dc3545;">❌ Please enter an API key</span>';
            return;
        }

        statusDiv.innerHTML = '<span style="color: var(--gaip-text-secondary);">⏳ Testing connection...</span>';

        // Temporarily set credentials for test
        var vendor = SM.getVendor(vendorId);
        if (vendor && vendor.setCredentials) {
            vendor.setCredentials(apiKey);
        }

        try {
            var result = await vendor.testConnection();

            if (result.success) {
                var sensorCount = result.sensors ? result.sensors.length : 0;
                statusDiv.innerHTML = '<span style="color: #28a745;">✅ Connected! Found ' + sensorCount + ' sensor(s)</span>';

                // Discover sensors and refresh UI
                if (sensorCount > 0) {
                    await SM.discoverAllSensors();
                    refreshMappingUI();
                    updateStatusSummary();
                    
                    // Show mapping section
                    var mappingSection = document.getElementById('gaip-sensor-mapping-section');
                    if (mappingSection) {
                        mappingSection.style.display = 'block';
                    }
                }
            } else {
                statusDiv.innerHTML = '<span style="color: #dc3545;">❌ ' + (result.error || 'Connection failed') + '</span>';
            }
        } catch (e) {
            statusDiv.innerHTML = '<span style="color: #dc3545;">❌ Error: ' + e.message + '</span>';
        }
    }

    async function handleSaveCredentials(vendorId) {
        var SM = global.GAIP_SensorManager;
        var statusDiv = document.querySelector('.gaip-vendor-status[data-vendor="' + vendorId + '"]');
        var apiKeyInput = document.querySelector('.gaip-vendor-api-key[data-vendor="' + vendorId + '"]');

        if (!statusDiv || !apiKeyInput) return;

        var apiKey = apiKeyInput.value.trim();

        statusDiv.innerHTML = '<span style="color: var(--gaip-text-secondary);">⏳ Saving...</span>';

        var result = await SM.saveCredentials(vendorId, apiKey);

        if (result.success) {
            // Allow vendor to persist any extra fields (e.g. SpecConnect collection name)
            var vendorObj = SM.getVendor(vendorId);
            if (vendorObj && typeof vendorObj.saveExtraFields === 'function') {
                vendorObj.saveExtraFields();
            }
            statusDiv.innerHTML = '<span style="color: #28a745;">✅ Saved! Discovering sensors...</span>';

            // Discover sensors with new credentials
            await SM.discoverAllSensors();
            refreshMappingUI();
            updateStatusSummary();

            statusDiv.innerHTML = '<span style="color: #28a745;">✅ Saved and connected</span>';
        } else {
            statusDiv.innerHTML = '<span style="color: #dc3545;">❌ ' + (result.error || 'Save failed') + '</span>';
        }
    }

    async function handleSaveMappings() {
        var SM = global.GAIP_SensorManager;
        var selects = document.querySelectorAll('.gaip-sensor-site-select');

        selects.forEach(function(select) {
            var vendorId = select.dataset.vendor;
            var sensorId = select.dataset.sensor;
            var siteId = select.value;

            if (siteId) {
                SM.mapSensorToSite(siteId, vendorId, sensorId);
            } else {
                SM.unmapSensor(vendorId, sensorId);
            }

            // Reset visual feedback
            select.style.borderColor = 'var(--gaip-border)';
        });

        await SM.saveSiteMappings();

        updateStatusSummary();

        // Show feedback
        var saveBtn = document.getElementById('gaip-sensor-mapping-save');
        if (saveBtn) {
            var originalText = saveBtn.textContent;
            saveBtn.textContent = '✓ Saved!';
            saveBtn.style.background = '#28a745';
            setTimeout(function() {
                saveBtn.textContent = originalText;
            }, 2000);
        }
    }

    function refreshMappingUI() {
        var contentDiv = document.getElementById('gaip-sensor-mapping-content');
        if (contentDiv) {
            contentDiv.innerHTML = renderMappingContent();
        }

        var mappingSection = document.getElementById('gaip-sensor-mapping-section');
        var SM = global.GAIP_SensorManager;
        if (mappingSection && SM) {
            var allSensors = SM.getAllSensors();
            mappingSection.style.display = allSensors.length > 0 ? 'block' : 'none';
        }
    }

    // =========================================================================
    // INJECT INTO SENSOR IMPORT UI
    // =========================================================================

    function injectIntoSensorSection() {
        // Try multiple anchor points in order of preference
        var anchorPoints = [
            'gaip-sensor-summary-container',
            'gaip-sensor-result',
            'gaip-sensor-upload-area'
        ];
        
        var anchor = null;
        for (var i = 0; i < anchorPoints.length; i++) {
            anchor = document.getElementById(anchorPoints[i]);
            if (anchor) break;
        }
        
        if (!anchor) {
            // No sensor section found - might not be on the right tab
            // Try again later, but limit retries
            if (!injectIntoSensorSection.retries) {
                injectIntoSensorSection.retries = 0;
            }
            injectIntoSensorSection.retries++;
            
            if (injectIntoSensorSection.retries < 20) {
                setTimeout(injectIntoSensorSection, 500);
            } else {
                log('Could not find sensor section anchor after 20 retries');
            }
            return;
        }

        // Check if already injected
        if (document.getElementById('gaip-sensor-manager-panel')) return;

        var panel = document.createElement('div');
        panel.id = 'gaip-sensor-manager-panel';
        panel.innerHTML = renderSettingsPanel();

        // Insert after the anchor element
        if (anchor.nextSibling) {
            anchor.parentNode.insertBefore(panel, anchor.nextSibling);
        } else {
            anchor.parentNode.appendChild(panel);
        }

        attachEventHandlers();
        updateStatusSummary();

        log('Injected sensor settings panel after', anchor.id);
    }

    // =========================================================================
    // INITIALIZATION
    // =========================================================================

    function init() {
        log('Initializing v' + VERSION);

        // Wait for SensorManager to be ready
        if (global.GAIP_SensorManager) {
            injectIntoSensorSection();
        } else {
            document.addEventListener('gaip:sensorManager:ready', function() {
                injectIntoSensorSection();
            });
        }
    }

    // Auto-init
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function() {
            setTimeout(init, 200);
        });
    } else {
        setTimeout(init, 200);
    }

    // =========================================================================
    // EXPORTS
    // =========================================================================

    global.GAIP_SensorUI = {
        VERSION: VERSION,
        renderSettingsPanel: renderSettingsPanel,
        renderMappingContent: renderMappingContent,
        refreshMappingUI: refreshMappingUI,
        updateStatusSummary: updateStatusSummary
    };

    log('Module loaded');

})(window);
