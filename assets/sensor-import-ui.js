/**
 * Gilba Hub Sensor Import UI Handler
 * v3.1.0 - Added live sensor API integration panel (Hydrosight)
 * 
 * Supports:
 * - TDR 350 with variable tine lengths (38mm, 76mm, 127mm)
 * - POGO with fixed 50mm depth
 * - Auto-detection or manual device selection
 * - Live sensor APIs (Hydrosight, future: Soil Scout, SpecConnect)
 */

(function() {
    'use strict';
    
    // Common golf zone presets
    var GOLF_ZONE_PRESETS = [
        'Green 1', 'Green 2', 'Green 3', 'Green 4', 'Green 5', 'Green 6',
        'Green 7', 'Green 8', 'Green 9', 'Green 10', 'Green 11', 'Green 12',
        'Green 13', 'Green 14', 'Green 15', 'Green 16', 'Green 17', 'Green 18',
        'Fairway 1', 'Fairway 2', 'Fairway 3', 'Fairway 4', 'Fairway 5',
        'Tee 1', 'Tee 10', 'Practice Green', 'Nursery'
    ];
    
    var pendingReadings = [];
    var zoneSummaries = [];
    var selectedZone = null;
    var selectedDeviceType = null;  // null = auto-detect
    var selectedTDRDepth = 76;      // Default TDR tine length
    
    var _uiInitialised = false;
    var _rerunDataDisplay = false;

    function initSensorUI() {
        var uploadArea = document.getElementById('gaip-sensor-upload-area');
        var fileInput = document.getElementById('gaip-sensor-file');
        var resultDiv = document.getElementById('gaip-sensor-result');
        var summaryContainer = document.getElementById('gaip-sensor-summary-container');

        if (!uploadArea || !fileInput) {
            return;
        }

        // Insert device selector before upload area (guarded internally against duplicates)
        insertDeviceSelector(uploadArea);
        
        // Note: Live sensor settings now handled by sensor-integration-ui.js
        // which injects after the summary container

        // b35fix111: track first init. On re-runs skip event binding — already attached.
        var _isRerun = _uiInitialised;
        if (!_uiInitialised) _uiInitialised = true;

        if (!_isRerun) {

        // Click to browse
        uploadArea.addEventListener('click', function(e) {
            // Don't trigger if clicking on device selector
            if (e.target.closest('.gaip-device-selector')) return;
            fileInput.click();
        });
        
        // Drag and drop
        uploadArea.addEventListener('dragover', function(e) {
            e.preventDefault();
            e.stopPropagation();
            uploadArea.classList.add('dragging');
        });
        
        uploadArea.addEventListener('dragleave', function(e) {
            e.preventDefault();
            e.stopPropagation();
            uploadArea.classList.remove('dragging');
        });
        
        uploadArea.addEventListener('drop', function(e) {
            e.preventDefault();
            e.stopPropagation();
            uploadArea.classList.remove('dragging');
            
            var files = e.dataTransfer.files;
            if (files.length > 0) {
                handleFile(files[0]);
            }
        });
        
        // File input change
        fileInput.addEventListener('change', function(e) {
            if (e.target.files.length > 0) {
                handleFile(e.target.files[0]);
            }
        });

        } // end if (!_isRerun) — event binding only on first init

        function handleFile(file) {
            if (!window.GAIP_Sensor) {
                showError('Sensor module not loaded');
                return;
            }
            
            resultDiv.innerHTML = '<div style="padding: 10px; text-align: center; color: var(--gaip-text);">Processing...</div>';
            
            // Build import options
            var importOptions = {};
            if (selectedDeviceType) {
                importOptions.deviceType = selectedDeviceType;
            }
            if (selectedDeviceType === 'TDR350' || !selectedDeviceType) {
                importOptions.depth = selectedTDRDepth;
            }
            
            GAIP_Sensor.import(file, importOptions)
                .then(function(result) {
                    showSuccess(result);
                    
                    // Check if zones are pre-labelled in the CSV
                    var readings = GAIP_Sensor.getReadings() || [];
                    var hasLabelledZones = readings.some(function(r) { 
                        return r.zoneName && r.zoneName !== 'Unlabelled' && !r.zoneName.startsWith('Dataset '); 
                    });
                    
                    if (hasLabelledZones) {
                        // Pre-labelled zones - calculate automatically
                        updateSummary();
                        updateVWCInput(result);
                    } else if (isGolfSurface()) {
                        // Golf surface with unlabelled zones - show manual labelling UI
                        pendingReadings = readings;
                        showLabellingUI();
                    } else {
                        // Non-golf with unlabelled zones - show labelling option
                        pendingReadings = readings;
                        showLabellingOption();
                        updateVWCInput(result);
                    }
                })
                .catch(function(err) {
                    showError(err.message);
                });
        }
        
        function insertDeviceSelector(uploadArea) {
            // b35fix108b guard: only inject once — re-runs of initSensorUI on site
            // switch must not add another selector widget to the DOM
            if (uploadArea.parentNode.querySelector('.gaip-device-selector')) return;

            var selectorDiv = document.createElement('div');
            selectorDiv.className = 'gaip-device-selector';
            selectorDiv.innerHTML = buildDeviceSelectorHTML();
            
            // Insert before upload area
            uploadArea.parentNode.insertBefore(selectorDiv, uploadArea);
            
            // Wire up device selector events
            wireDeviceSelectorEvents();
        }
        
        // Note: Live sensor panel functions removed - now handled by sensor-integration-ui.js
        
        function buildDeviceSelectorHTML() {
            var html = '<div class="gaip-device-selector-row">';
            html += '<label class="gaip-device-label">Sensor Device:</label>';
            html += '<select id="gaip-device-type" class="gaip-device-select">';
            html += '<option value="">Auto-detect</option>';
            html += '<option value="TDR350">TDR 350 (Spectrum)</option>';
            html += '<option value="POGO">POGO (Stevens)</option>';
            html += '</select>';
            
            // TDR depth selector (hidden by default, shown when TDR selected)
            html += '<div id="gaip-tdr-depth-container" class="gaip-tdr-depth-container" style="display: none;">';
            html += '<label class="gaip-device-label">Tine Length:</label>';
            html += '<select id="gaip-tdr-depth" class="gaip-tdr-depth-select">';
            html += '<option value="38">38mm (1.5")</option>';
            html += '<option value="76" selected>76mm (3")</option>';
            html += '<option value="127">127mm (5")</option>';
            html += '</select>';
            html += '</div>';
            
            html += '</div>';
            
            // Device info panel
            html += '<div id="gaip-device-info" class="gaip-device-info"></div>';
            
            return html;
        }
        
        function wireDeviceSelectorEvents() {
            var deviceSelect = document.getElementById('gaip-device-type');
            var depthContainer = document.getElementById('gaip-tdr-depth-container');
            var depthSelect = document.getElementById('gaip-tdr-depth');
            var deviceInfo = document.getElementById('gaip-device-info');
            
            if (deviceSelect) {
                deviceSelect.addEventListener('change', function() {
                    selectedDeviceType = this.value || null;
                    
                    // Show/hide TDR depth selector
                    if (depthContainer) {
                        depthContainer.style.display = (selectedDeviceType === 'TDR350') ? 'inline-flex' : 'none';
                    }
                    
                    // Update device info panel
                    updateDeviceInfo(selectedDeviceType, deviceInfo);
                });
            }
            
            if (depthSelect) {
                depthSelect.addEventListener('change', function() {
                    selectedTDRDepth = parseInt(this.value) || 76;
                });
            }
        }
        
        function updateDeviceInfo(deviceType, infoDiv) {
            if (!infoDiv) return;
            
            if (!deviceType) {
                infoDiv.innerHTML = '<span class="gaip-device-info-text">📡 Device will be auto-detected from CSV format</span>';
                return;
            }
            
            var config = window.GAIP_Sensor && GAIP_Sensor.DEVICES ? GAIP_Sensor.DEVICES[deviceType] : null;
            if (!config) {
                infoDiv.innerHTML = '';
                return;
            }
            
            var html = '<span class="gaip-device-info-text">';
            html += '📡 <strong>' + config.name + '</strong>';
            if (deviceType === 'TDR350') {
                html += ', Variable depth TDR, EC in ' + config.ecUnit;
            } else if (deviceType === 'POGO') {
                html += ', Fixed 5cm depth, includes surface temp & salinity index';
            }
            html += '</span>';
            
            infoDiv.innerHTML = html;
        }
        
        // Show option to label zones for non-golf surfaces
        function showLabellingOption() {
            if (!summaryContainer) return;
            
            var readings = GAIP_Sensor.getReadings() || [];
            
            var html = GAIP_Sensor.renderSummary();
            html += '<div class="gaip-sensor-labelling-prompt">';
            html += '<p>Readings imported without zone labels. You can:</p>';
            html += '<button type="button" id="gaip-show-labelling" class="gaip-btn">Label zones manually</button>';
            html += '<button type="button" id="gaip-skip-labelling" class="gaip-btn-secondary">Use as single zone</button>';
            html += '</div>';
            html += '<button type="button" class="gaip-sensor-clear-btn" id="gaip-sensor-clear">Clear sensor data</button>';
            
            summaryContainer.innerHTML = html;
            
            document.getElementById('gaip-show-labelling').addEventListener('click', function() {
                pendingReadings = readings;
                showLabellingUI();
            });
            
            document.getElementById('gaip-skip-labelling').addEventListener('click', function() {
                // Treat all readings as single unlabelled zone
                zoneSummaries = calculateZoneSummariesFromReadings(readings);
                calculateZoneIrrigation();
                if (GAIP_Sensor.setZoneSummaries) {
                    GAIP_Sensor.setZoneSummaries(zoneSummaries);
                }
                summaryContainer.innerHTML = renderZoneSummary(zoneSummaries);
                wireZoneSelectorEvents();
            });
            
            var clearBtn = document.getElementById('gaip-sensor-clear');
            if (clearBtn) {
                clearBtn.addEventListener('click', function() {
                    if (confirm('Clear all sensor data?')) {
                        GAIP_Sensor.clear();
                        summaryContainer.innerHTML = '';
                        resultDiv.innerHTML = '';
                        clearVWCInput();
                    }
                });
            }
        }
        
        function isGolfSurface() {
            var surfaceSelect = document.querySelector('.gaip-surface-type');
            if (!surfaceSelect) return false;
            var value = surfaceSelect.value || '';
            return value.toLowerCase().indexOf('golf') !== -1;
        }
        
        function showSuccess(result) {
            var deviceName = result.deviceName || result.deviceType || 'Unknown';
            var depthInfo = result.measurementDepth ? ' @ ' + result.measurementDepth + 'mm' : '';
            
            var html = '<div class="gaip-sensor-import-result success">';
            html += '<strong>Import successful</strong>';
            html += '<div class="gaip-sensor-import-stats">';
            html += '<span>📡 ' + deviceName + depthInfo + '</span>';
            html += '<span>' + result.readings + ' readings</span>';
            html += '<span>' + result.zones + ' zones</span>';
            if (result.errors && result.errors.length > 0) {
                html += '<span class="gaip-warnings">' + result.errors.length + ' warnings</span>';
            }
            html += '</div>';
            
            // Show POGO-specific data if available
            if (result.deviceType === 'POGO' && result.summary) {
                var s = result.summary;
                if (s.salinityIndex || s.surfaceTemp) {
                    html += '<div class="gaip-sensor-pogo-extras">';
                    if (s.surfaceTemp && s.surfaceTemp.mean !== undefined) {
                        html += '<span>Surface: ' + s.surfaceTemp.mean.toFixed(1) + '°C</span>';
                    }
                    if (s.salinityIndex && s.salinityIndex.mean !== undefined) {
                        html += '<span>Salinity Idx: ' + s.salinityIndex.mean.toFixed(2) + '</span>';
                    }
                    html += '</div>';
                }
            }
            
            html += '</div>';
            
            resultDiv.innerHTML = html;
        }
        
        function showError(message) {
            resultDiv.innerHTML = '<div class="gaip-sensor-import-result error">' +
                '<strong>Import failed:</strong> ' + message + '</div>';
        }
        
        function showLabellingUI() {
            if (!summaryContainer || pendingReadings.length === 0) return;
            
            var html = '<div class="gaip-sensor-labelling">';
            html += '<div class="gaip-section-title">Assign Zones to Readings</div>';
            
            // Bulk assign controls
            html += '<div class="gaip-sensor-bulk-controls">';
            html += '<select id="gaip-bulk-zone-select" class="gaip-bulk-zone-select">';
            html += '<option value="">-- Select zone --</option>';
            GOLF_ZONE_PRESETS.forEach(function(zone) {
                html += '<option value="' + zone + '">' + zone + '</option>';
            });
            html += '<option value="__custom__">Custom...</option>';
            html += '</select>';
            html += '<button type="button" id="gaip-bulk-assign" class="gaip-btn-secondary">Assign to selected</button>';
            html += '<button type="button" id="gaip-select-all" class="gaip-btn-secondary">Select all</button>';
            html += '<button type="button" id="gaip-select-none" class="gaip-btn-secondary">Select none</button>';
            html += '</div>';
            
            // Quick block assignment controls
            html += '<div class="gaip-sensor-block-controls" style="margin-top: 8px; padding: 12px; background: var(--gaip-info-bg); border-radius: 6px; border: 1px solid #bae6fd;">';
            html += '<div style="font-weight: 600; color: #0369a1; margin-bottom: 6px;">📊 Quick Block Assignment</div>';
            html += '<div style="font-size: 11px; color: var(--gaip-text); margin-bottom: 10px; line-height: 1.5;">';
            html += '① Enter row range (e.g. 1-5) → <strong>Select</strong><br>';
            html += '② Pick zone from dropdown → <strong>Assign & Next</strong><br>';
            html += '<span style="color: #0369a1;">Range auto-advances after each assignment</span>';
            html += '</div>';
            
            // Row 1: Range selection
            html += '<div style="display: flex; gap: 8px; flex-wrap: wrap; align-items: center; margin-bottom: 8px;">';
            html += '<label style="font-size: 12px; min-width: 50px;">Range:</label>';
            html += '<input type="number" id="gaip-block-start" placeholder="From" min="1" value="1" style="width: 55px; padding: 4px;">';
            html += '<span style="color: var(--gaip-text);">to</span>';
            html += '<input type="number" id="gaip-block-end" placeholder="To" min="1" style="width: 55px; padding: 4px;">';
            html += '<button type="button" id="gaip-select-range" class="gaip-btn-secondary" style="padding: 4px 10px;">Select</button>';
            html += '</div>';
            
            // Row 2: Zone assignment with "Assign & Next"
            html += '<div style="display: flex; gap: 8px; flex-wrap: wrap; align-items: center;">';
            html += '<label style="font-size: 12px; min-width: 50px;">Zone:</label>';
            html += '<select id="gaip-quick-zone-select" style="padding: 4px; min-width: 120px;">';
            html += '<option value="">-- Select --</option>';
            GOLF_ZONE_PRESETS.forEach(function(zone) {
                html += '<option value="' + zone + '">' + zone + '</option>';
            });
            html += '<option value="__custom__">Custom...</option>';
            html += '</select>';
            html += '<button type="button" id="gaip-assign-next" class="gaip-btn" style="padding: 4px 12px; background: #10b981; color: var(--gaip-surface);">Assign & Next →</button>';
            html += '</div>';
            
            // Progress indicator
            html += '<div id="gaip-block-progress" style="font-size: 11px; color: var(--gaip-text); margin-top: 8px;"></div>';
            html += '</div>';
            
            // Readings table - now with device-specific columns
            var deviceType = GAIP_Sensor.getDeviceType ? GAIP_Sensor.getDeviceType() : 'TDR350';
            var showSalinityIndex = deviceType === 'POGO';
            
            html += '<div class="gaip-sensor-table-wrapper">';
            html += '<table class="gaip-table gaip-sensor-readings-table">';
            html += '<thead><tr>';
            html += '<th style="width:30px;"><input type="checkbox" id="gaip-select-all-cb"></th>';
            html += '<th style="width:40px;">#</th>';
            html += '<th>Time</th>';
            html += '<th>VWC %</th>';
            html += '<th>EC</th>';
            html += '<th>Soil °C</th>';
            if (showSalinityIndex) {
                html += '<th>Sal Idx</th>';
            }
            html += '<th style="min-width:140px;">Zone</th>';
            html += '</tr></thead>';
            html += '<tbody>';
            
            pendingReadings.forEach(function(reading, idx) {
                html += '<tr data-idx="' + idx + '">';
                html += '<td><input type="checkbox" class="gaip-reading-cb" data-idx="' + idx + '"></td>';
                html += '<td style="color: var(--gaip-text); font-size: 11px;">' + (idx + 1) + '</td>';
                html += '<td>' + formatTime(reading.timestamp) + '</td>';
                html += '<td>' + (reading.vwc !== null ? reading.vwc.toFixed(1) : '-') + '</td>';
                html += '<td>' + (reading.ec !== null ? reading.ec.toFixed(2) : '-') + '</td>';
                html += '<td>' + (reading.soilTemp !== null ? reading.soilTemp.toFixed(1) + '°' : '-') + '</td>';
                if (showSalinityIndex) {
                    html += '<td>' + (reading.salinityIndex !== null ? reading.salinityIndex.toFixed(2) : '-') + '</td>';
                }
                html += '<td>';
                html += '<select class="gaip-zone-select" data-idx="' + idx + '">';
                html += '<option value="">Unlabelled</option>';
                
                // Check if reading has a custom zone not in presets
                var zn = reading.zoneName || '';
                var hasCustomZone = zn && GOLF_ZONE_PRESETS.indexOf(zn) === -1 && !zn.startsWith('Dataset ');
                
                GOLF_ZONE_PRESETS.forEach(function(zone) {
                    var selected = zn === zone ? ' selected' : '';
                    html += '<option value="' + zone + '"' + selected + '>' + zone + '</option>';
                });
                
                // Add custom zone if it exists and isn't in presets
                if (hasCustomZone) {
                    html += '<option value="' + zn + '" selected>' + zn + '</option>';
                }
                
                html += '<option value="__custom__">Custom...</option>';
                html += '</select>';
                html += '</td>';
                html += '</tr>';
            });
            
            html += '</tbody></table>';
            html += '</div>';
            
            // Action buttons
            html += '<div class="gaip-sensor-actions">';
            html += '<button type="button" id="gaip-apply-zones" class="gaip-btn">Apply zones and calculate</button>';
            html += '<button type="button" id="gaip-sensor-clear" class="gaip-btn-secondary">Clear all</button>';
            html += '</div>';
            
            // Summary placeholder
            html += '<div id="gaip-sensor-zone-summary"></div>';
            
            html += '</div>';
            
            summaryContainer.innerHTML = html;
            wireLabellingEvents();
        }
        
        function wireLabellingEvents() {
            var selectAllCb = document.getElementById('gaip-select-all-cb');
            if (selectAllCb) {
                selectAllCb.addEventListener('change', function() {
                    document.querySelectorAll('.gaip-reading-cb').forEach(function(cb) {
                        cb.checked = selectAllCb.checked;
                    });
                });
            }
            
            var selectAllBtn = document.getElementById('gaip-select-all');
            if (selectAllBtn) {
                selectAllBtn.addEventListener('click', function() {
                    document.querySelectorAll('.gaip-reading-cb').forEach(function(cb) {
                        cb.checked = true;
                    });
                    if (selectAllCb) selectAllCb.checked = true;
                });
            }
            
            var selectNoneBtn = document.getElementById('gaip-select-none');
            if (selectNoneBtn) {
                selectNoneBtn.addEventListener('click', function() {
                    document.querySelectorAll('.gaip-reading-cb').forEach(function(cb) {
                        cb.checked = false;
                    });
                    if (selectAllCb) selectAllCb.checked = false;
                });
            }
            
            // Range selection for blocks
            var selectRangeBtn = document.getElementById('gaip-select-range');
            if (selectRangeBtn) {
                selectRangeBtn.addEventListener('click', function() {
                    var startInput = document.getElementById('gaip-block-start');
                    var endInput = document.getElementById('gaip-block-end');
                    var start = parseInt(startInput.value) - 1;
                    var end = parseInt(endInput.value) - 1;
                    
                    if (isNaN(start) || isNaN(end)) {
                        alert('Please enter both start and end row numbers');
                        return;
                    }
                    
                    if (start < 0) start = 0;
                    if (end >= pendingReadings.length) end = pendingReadings.length - 1;
                    if (start > end) { var t = start; start = end; end = t; }
                    
                    // Uncheck all first
                    document.querySelectorAll('.gaip-reading-cb').forEach(function(cb) {
                        cb.checked = false;
                    });
                    
                    // Check range
                    for (var i = start; i <= end; i++) {
                        var cb = document.querySelector('.gaip-reading-cb[data-idx="' + i + '"]');
                        if (cb) cb.checked = true;
                    }
                    
                    updateBlockProgress();
                });
            }
            
            // Assign & Next button
            var assignNextBtn = document.getElementById('gaip-assign-next');
            if (assignNextBtn) {
                assignNextBtn.addEventListener('click', function() {
                    var quickZoneSelect = document.getElementById('gaip-quick-zone-select');
                    var zone = quickZoneSelect ? quickZoneSelect.value : '';
                    
                    if (!zone) {
                        alert('Please select a zone');
                        return;
                    }
                    
                    if (zone === '__custom__') {
                        zone = prompt('Enter custom zone name:');
                        if (!zone) return;
                    }
                    
                    // Get selected checkboxes
                    var selected = document.querySelectorAll('.gaip-reading-cb:checked');
                    if (selected.length === 0) {
                        alert('Please select some readings first');
                        return;
                    }
                    
                    var maxIdx = -1;
                    selected.forEach(function(cb) {
                        var idx = parseInt(cb.dataset.idx);
                        var zoneSelect = document.querySelector('.gaip-zone-select[data-idx="' + idx + '"]');
                        if (zoneSelect) {
                            // Add option if custom
                            if (!Array.from(zoneSelect.options).some(function(o) { return o.value === zone; })) {
                                var opt = document.createElement('option');
                                opt.value = zone;
                                opt.textContent = zone;
                                zoneSelect.insertBefore(opt, zoneSelect.querySelector('option[value="__custom__"]'));
                            }
                            zoneSelect.value = zone;
                        }
                        if (idx > maxIdx) maxIdx = idx;
                    });
                    
                    // Auto-advance range
                    var startInput = document.getElementById('gaip-block-start');
                    var endInput = document.getElementById('gaip-block-end');
                    var rangeSize = selected.length;
                    
                    var newStart = maxIdx + 2; // +2 because maxIdx is 0-indexed, UI is 1-indexed
                    var newEnd = newStart + rangeSize - 1;
                    
                    if (newStart <= pendingReadings.length) {
                        startInput.value = newStart;
                        endInput.value = Math.min(newEnd, pendingReadings.length);
                        
                        // Auto-select new range
                        document.querySelectorAll('.gaip-reading-cb').forEach(function(cb) {
                            cb.checked = false;
                        });
                        for (var i = newStart - 1; i < Math.min(newEnd, pendingReadings.length); i++) {
                            var cb = document.querySelector('.gaip-reading-cb[data-idx="' + i + '"]');
                            if (cb) cb.checked = true;
                        }
                    } else {
                        // All done
                        document.querySelectorAll('.gaip-reading-cb').forEach(function(cb) {
                            cb.checked = false;
                        });
                    }
                    
                    updateBlockProgress();
                });
            }
            
            // Bulk assign button
            var bulkAssignBtn = document.getElementById('gaip-bulk-assign');
            if (bulkAssignBtn) {
                bulkAssignBtn.addEventListener('click', function() {
                    var bulkSelect = document.getElementById('gaip-bulk-zone-select');
                    var zone = bulkSelect ? bulkSelect.value : '';
                    
                    if (!zone) {
                        alert('Please select a zone');
                        return;
                    }
                    
                    if (zone === '__custom__') {
                        zone = prompt('Enter custom zone name:');
                        if (!zone) return;
                    }
                    
                    document.querySelectorAll('.gaip-reading-cb:checked').forEach(function(cb) {
                        var idx = cb.dataset.idx;
                        var zoneSelect = document.querySelector('.gaip-zone-select[data-idx="' + idx + '"]');
                        if (zoneSelect) {
                            if (!Array.from(zoneSelect.options).some(function(o) { return o.value === zone; })) {
                                var opt = document.createElement('option');
                                opt.value = zone;
                                opt.textContent = zone;
                                zoneSelect.insertBefore(opt, zoneSelect.querySelector('option[value="__custom__"]'));
                            }
                            zoneSelect.value = zone;
                        }
                    });
                });
            }
            
            // Custom zone handling for individual selects
            document.querySelectorAll('.gaip-zone-select').forEach(function(select) {
                select.addEventListener('change', function() {
                    if (this.value === '__custom__') {
                        var customZone = prompt('Enter custom zone name:');
                        if (customZone) {
                            var opt = document.createElement('option');
                            opt.value = customZone;
                            opt.textContent = customZone;
                            this.insertBefore(opt, this.querySelector('option[value="__custom__"]'));
                            this.value = customZone;
                        } else {
                            this.value = '';
                        }
                    }
                });
            });
            
            // Apply zones button
            var applyBtn = document.getElementById('gaip-apply-zones');
            if (applyBtn) {
                applyBtn.addEventListener('click', function() {
                    // Collect zone assignments
                    document.querySelectorAll('.gaip-zone-select').forEach(function(select) {
                        var idx = parseInt(select.dataset.idx);
                        var zone = select.value || 'Unlabelled';
                        if (pendingReadings[idx]) {
                            pendingReadings[idx].zoneName = zone;
                        }
                    });
                    
                    // Update sensor module
                    GAIP_Sensor.updateReadings(pendingReadings);
                    
                    // Calculate zone summaries with irrigation
                    zoneSummaries = calculateZoneSummariesFromReadings(pendingReadings);
                    calculateZoneIrrigation();
                    
                    // Store summaries for export
                    if (GAIP_Sensor.setZoneSummaries) {
                        GAIP_Sensor.setZoneSummaries(zoneSummaries);
                    }
                    
                    // Show zone summary
                    summaryContainer.innerHTML = renderZoneSummary(zoneSummaries);
                    wireZoneSelectorEvents();
                });
            }
            
            // Clear button
            var clearBtn = document.getElementById('gaip-sensor-clear');
            if (clearBtn) {
                clearBtn.addEventListener('click', function() {
                    if (confirm('Clear all sensor data?')) {
                        GAIP_Sensor.clear();
                        pendingReadings = [];
                        zoneSummaries = [];
                        summaryContainer.innerHTML = '';
                        resultDiv.innerHTML = '';
                        clearVWCInput();
                    }
                });
            }
        }
        
        function updateBlockProgress() {
            var progressDiv = document.getElementById('gaip-block-progress');
            if (!progressDiv) return;
            
            var labelled = 0;
            document.querySelectorAll('.gaip-zone-select').forEach(function(sel) {
                if (sel.value && sel.value !== '__custom__') labelled++;
            });
            
            var pct = Math.round((labelled / pendingReadings.length) * 100);
            progressDiv.innerHTML = '✓ ' + labelled + '/' + pendingReadings.length + ' readings labelled (' + pct + '%)';
        }
        
        function calculateZoneSummariesFromReadings(readings) {
            var zones = {};
            readings.forEach(function(r) {
                var zone = r.zoneName || 'Unlabelled';
                if (!zones[zone]) {
                    zones[zone] = { 
                        vwcSum: 0, ecSum: 0, soilTempSum: 0, surfaceTempSum: 0, salinitySum: 0,
                        vwcCount: 0, ecCount: 0, soilTempCount: 0, surfaceTempCount: 0, salinityCount: 0,
                        readings: [] 
                    };
                }
                zones[zone].readings.push(r);
                if (r.vwc !== null && !isNaN(r.vwc)) { zones[zone].vwcSum += r.vwc; zones[zone].vwcCount++; }
                if (r.ec !== null && !isNaN(r.ec)) { zones[zone].ecSum += r.ec; zones[zone].ecCount++; }
                if (r.soilTemp !== null && !isNaN(r.soilTemp)) { zones[zone].soilTempSum += r.soilTemp; zones[zone].soilTempCount++; }
                if (r.surfaceTemp !== null && !isNaN(r.surfaceTemp)) { zones[zone].surfaceTempSum += r.surfaceTemp; zones[zone].surfaceTempCount++; }
                if (r.salinityIndex !== null && !isNaN(r.salinityIndex)) { zones[zone].salinitySum += r.salinityIndex; zones[zone].salinityCount++; }
            });
            
            var summaries = [];
            for (var zoneName in zones) {
                var z = zones[zoneName];
                var vwcs = z.readings.filter(function(r) { return r.vwc !== null; }).map(function(r) { return r.vwc; });
                summaries.push({
                    name: zoneName,
                    count: z.readings.length,
                    avg: z.vwcCount > 0 ? z.vwcSum / z.vwcCount : null,
                    min: vwcs.length > 0 ? Math.min.apply(null, vwcs) : null,
                    max: vwcs.length > 0 ? Math.max.apply(null, vwcs) : null,
                    ec: z.ecCount > 0 ? z.ecSum / z.ecCount : null,
                    soilTemp: z.soilTempCount > 0 ? z.soilTempSum / z.soilTempCount : null,
                    surfaceTemp: z.surfaceTempCount > 0 ? z.surfaceTempSum / z.surfaceTempCount : null,
                    salinityIndex: z.salinityCount > 0 ? z.salinitySum / z.salinityCount : null,
                    irrigation: null
                });
            }
            
            // Sort: labelled zones first (alphabetically), then Unlabelled
            summaries.sort(function(a, b) {
                if (a.name === 'Unlabelled') return 1;
                if (b.name === 'Unlabelled') return -1;
                return a.name.localeCompare(b.name);
            });
            
            return summaries;
        }
        
        function calculateZoneIrrigation() {
            if (!window.GAIP_IrrigationScheduler) {
                return;
            }
            
            zoneSummaries.forEach(function(zone) {
                if (zone.avg === null) return;
                
                try {
                    var result = GAIP_IrrigationScheduler.calculateForVWC(zone.avg);
                    zone.irrigation = result;
                } catch (e) {
                    console.warn('[SensorUI] Irrigation calc failed for zone ' + zone.name + ':', e);
                }
            });
        }
        
        function renderZoneSummary(summaries) {
            var deviceType = GAIP_Sensor.getDeviceType ? GAIP_Sensor.getDeviceType() : 'TDR350';
            var deviceConfig = GAIP_Sensor.getDeviceConfig ? GAIP_Sensor.getDeviceConfig() : null;
            var measurementDepth = GAIP_Sensor.getMeasurementDepth ? GAIP_Sensor.getMeasurementDepth() : null;
            var showSalinityIndex = deviceType === 'POGO';
            
            var html = '<div class="gaip-sensor-zone-results">';
            
            // Device info header
            html += '<div class="gaip-sensor-device-header">';
            html += '<span class="gaip-device-badge">📡 ' + (deviceConfig ? deviceConfig.name : deviceType) + '</span>';
            if (measurementDepth) {
                html += '<span class="gaip-depth-badge">' + measurementDepth + 'mm depth</span>';
            }
            html += '</div>';
            
            html += '<div class="gaip-section-title">Zone Irrigation Summary</div>';
            
            html += '<table class="gaip-table gaip-sensor-zone-table">';
            html += '<thead><tr>';
            html += '<th>Zone</th>';
            html += '<th>VWC %</th>';
            html += '<th>EC</th>';
            html += '<th>Soil °C</th>';
            if (showSalinityIndex) {
                html += '<th>Sal Idx</th>';
            }
            html += '<th>Status</th>';
            html += '<th>Required</th>';
            html += '<th>Action</th>';
            html += '</tr></thead>';
            html += '<tbody>';
            
            summaries.forEach(function(zone) {
                var statusClass = '';
                var statusText = '-';
                var mmRequired = '-';
                
                if (zone.irrigation) {
                    if (zone.irrigation.status === 'critical') {
                        statusClass = 'gaip-status-critical';
                        statusText = 'Critical';
                    } else if (zone.irrigation.status === 'needed') {
                        statusClass = 'gaip-status-warning';
                        statusText = 'Needed';
                    } else if (zone.irrigation.status === 'soon') {
                        statusClass = 'gaip-status-info';
                        statusText = 'Soon';
                    } else if (zone.irrigation.status === 'wet') {
                        statusClass = 'gaip-status-wet';
                        statusText = 'Wet';
                    } else {
                        statusClass = 'gaip-status-ok';
                        statusText = 'OK';
                    }
                    mmRequired = zone.irrigation.mmRequired ? zone.irrigation.mmRequired + 'mm' : '-';
                }
                
                html += '<tr data-zone="' + zone.name + '">';
                html += '<td><strong>' + zone.name + '</strong><br><span style="font-size:11px;color:var(--gaip-text);">' + zone.count + ' readings</span></td>';
                html += '<td>' + (zone.avg !== null ? zone.avg.toFixed(1) + '%' : '-') + '</td>';
                html += '<td>' + (zone.ec !== null ? zone.ec.toFixed(2) : '-') + '</td>';
                html += '<td>' + (zone.soilTemp !== null ? zone.soilTemp.toFixed(1) + '°' : '-') + '</td>';
                if (showSalinityIndex) {
                    html += '<td>' + (zone.salinityIndex !== null ? zone.salinityIndex.toFixed(2) : '-') + '</td>';
                }
                html += '<td><span class="gaip-status-badge ' + statusClass + '">' + statusText + '</span></td>';
                html += '<td>' + mmRequired + '</td>';
                html += '<td><button type="button" class="gaip-zone-select-btn gaip-btn-sm" data-zone="' + zone.name + '">Select</button></td>';
                html += '</tr>';
            });
            
            html += '</tbody></table>';
            
            // Selected zone indicator
            html += '<div class="gaip-selected-zone-indicator" id="gaip-selected-zone-indicator">';
            html += '<span class="gaip-zone-indicator"></span>';
            html += '<span class="gaip-zone-name">No zone selected</span>';
            html += '</div>';
            
            // Action buttons
            html += '<div class="gaip-sensor-actions">';
            html += '<button type="button" id="gaip-relabel-zones" class="gaip-btn-secondary">Relabel zones</button>';
            html += '<button type="button" id="gaip-sensor-clear" class="gaip-btn-secondary">Clear all</button>';
            html += '</div>';
            
            html += '</div>';
            
            return html;
        }
        
        function wireZoneSelectorEvents() {
            // Zone select buttons
            document.querySelectorAll('.gaip-zone-select-btn').forEach(function(btn) {
                btn.addEventListener('click', function() {
                    var zoneName = this.dataset.zone;
                    selectZone(zoneName);
                });
            });
            
            // Row click to select
            document.querySelectorAll('.gaip-sensor-zone-table tbody tr').forEach(function(row) {
                row.addEventListener('click', function(e) {
                    if (e.target.tagName === 'BUTTON') return;
                    var zoneName = this.dataset.zone;
                    if (zoneName) selectZone(zoneName);
                });
            });
            
            // Relabel button
            var relabelBtn = document.getElementById('gaip-relabel-zones');
            if (relabelBtn) {
                relabelBtn.addEventListener('click', function() {
                    showLabellingUI();
                });
            }
            
            // Clear button
            var clearBtn = document.getElementById('gaip-sensor-clear');
            if (clearBtn) {
                clearBtn.addEventListener('click', function() {
                    if (confirm('Clear all sensor data?')) {
                        GAIP_Sensor.clear();
                        pendingReadings = [];
                        zoneSummaries = [];
                        summaryContainer.innerHTML = '';
                        resultDiv.innerHTML = '';
                        clearVWCInput();
                    }
                });
            }
        }
        
        function selectZone(zoneName) {
            selectedZone = zoneName;
            var zone = zoneSummaries.find(function(z) { return z.name === zoneName; });
            
            // Update VWC input
            var vwcInput = document.querySelector('.gaip-soil-vwc');
            if (vwcInput && zone && zone.avg !== null) {
                vwcInput.value = zone.avg.toFixed(1);
                vwcInput.style.borderColor = '#10b981';
                
                // Trigger recalculation
                var event = new Event('change', { bubbles: true });
                vwcInput.dispatchEvent(event);
            }
            
            // Update selected zone indicator
            var indicator = document.querySelector('#gaip-selected-zone-indicator .gaip-zone-indicator');
            var nameSpan = document.querySelector('#gaip-selected-zone-indicator .gaip-zone-name');
            
            if (nameSpan) {
                nameSpan.textContent = zoneName;
            }
            
            if (indicator && zone) {
                var statusClass = 'gaip-status-ok';
                var statusText = 'OK';
                
                if (zone.irrigation) {
                    if (zone.irrigation.status === 'critical') {
                        statusClass = 'gaip-status-critical';
                        statusText = zone.irrigation.mmRequired + 'mm';
                    } else if (zone.irrigation.status === 'needed' || zone.irrigation.status === 'soon') {
                        statusClass = 'gaip-status-warning';
                        statusText = zone.irrigation.mmRequired + 'mm';
                    } else if (zone.irrigation.status === 'wet') {
                        statusClass = 'gaip-status-info';
                        statusText = 'Wet';
                    }
                }
                
                indicator.className = 'gaip-zone-indicator ' + statusClass;
                indicator.textContent = statusText;
            }
            
            // Highlight selected row
            document.querySelectorAll('.gaip-sensor-zone-table tbody tr').forEach(function(row) {
                row.classList.remove('gaip-zone-selected-row');
                if (row.dataset.zone === zoneName) {
                    row.classList.add('gaip-zone-selected-row');
                }
            });
            
            // Store in sensor module
            if (window.GAIP_Sensor) {
                GAIP_Sensor.setSelectedZone(zoneName, zone);
            }
            
        }
        
        function clearVWCInput() {
            var vwcInput = document.querySelector('.gaip-soil-vwc');
            if (vwcInput) {
                vwcInput.value = '';
                vwcInput.style.borderColor = '';
                
                var label = vwcInput.closest('div');
                if (label) {
                    var badge = label.querySelector('.gaip-sensor-badge');
                    if (badge) badge.remove();
                }
            }
        }
        
        function formatTime(timestamp) {
            if (!timestamp) return '-';
            var d = new Date(timestamp);
            if (isNaN(d.getTime())) return '-';
            return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        }
        
        // Sports field summary (non-golf)
        function updateSummary() {
            if (!summaryContainer) return;
            
            // Check if zones are pre-labelled (from CSV)
            var readings = GAIP_Sensor.getReadings() || [];
            var hasLabelledZones = readings.some(function(r) { 
                return r.zoneName && r.zoneName !== 'Unlabelled' && !r.zoneName.startsWith('Dataset '); 
            });
            
            if (hasLabelledZones) {
                // Pre-labelled zones - calculate zone summaries with irrigation
                
                pendingReadings = readings;
                zoneSummaries = calculateZoneSummariesFromReadings(readings);
                calculateZoneIrrigation();
                
                if (GAIP_Sensor.setZoneSummaries) {
                    GAIP_Sensor.setZoneSummaries(zoneSummaries);
                }
                
                var html = renderZoneSummary(zoneSummaries);
                summaryContainer.innerHTML = html;
                wireZoneSelectorEvents();
            } else {
                // No zones - just show basic summary
                var html = GAIP_Sensor.renderSummary();
                html += GAIP_Sensor.renderZoneTable();
                html += '<button type="button" class="gaip-sensor-clear-btn" id="gaip-sensor-clear">Clear sensor data</button>';
                
                summaryContainer.innerHTML = html;
                
                var clearBtn = document.getElementById('gaip-sensor-clear');
                if (clearBtn) {
                    clearBtn.addEventListener('click', function() {
                        if (confirm('Clear all sensor data?')) {
                            GAIP_Sensor.clear();
                            summaryContainer.innerHTML = '';
                            resultDiv.innerHTML = '';
                            clearVWCInput();
                        }
                    });
                }
            }
        }
        
        function updateVWCInput(result) {
            var vwcInput = document.querySelector('.gaip-soil-vwc');
            if (vwcInput && result.summary && result.summary.vwc && result.summary.vwc.mean !== undefined) {
                vwcInput.value = result.summary.vwc.mean.toFixed(1);
                vwcInput.style.borderColor = '#10b981';
                
                var container = vwcInput.closest('div');
                var label = container ? container.querySelector('label') : null;
                if (label && !label.querySelector('.gaip-sensor-badge')) {
                    var badge = document.createElement('span');
                    badge.className = 'gaip-sensor-badge';
                    badge.textContent = result.deviceType === 'POGO' ? 'POGO' : 'TDR';
                    label.appendChild(badge);
                }
            }
        }

        // Check for existing data (runs on first load and on site-switch re-render)
        if (window.GAIP_Sensor && GAIP_Sensor.hasData()) {
            if (isGolfSurface()) {
                pendingReadings = GAIP_Sensor.getReadings() || [];
                if (pendingReadings.length > 0) {
                    showLabellingUI();
                }
            } else {
                updateSummary();
            }
            
            var summary = GAIP_Sensor.getSummary();
            if (summary && summary.vwc && summary.vwc.mean !== undefined) {
                var vwcInput = document.querySelector('.gaip-soil-vwc');
                if (vwcInput && !vwcInput.value) {
                    vwcInput.value = summary.vwc.mean.toFixed(1);
                    vwcInput.style.borderColor = '#10b981';
                }
            }
        }

    }
    
    // Init on DOM ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initSensorUI);
    } else {
        setTimeout(initSensorUI, 100);
    }

    // b35fix108b / b35fix111: Re-render sensor UI after site switch.
    // gaip-clear-data.js wipes the sensor DOM containers on every gaip:site-changed.
    // sensor-import.js dispatches gaip:sensor-data-imported once the reload is complete —
    // listen for that instead of guessing timing with a setTimeout.
    document.addEventListener('gaip:sensor-data-imported', function(e) {
        var source = e.detail && e.detail.source;
        if (source === 'site-switch-restore' || source === 'page-load-deferred') {
            // b35fix113: sensor reload now 150ms, UI re-render at 350ms gives safe margin
            setTimeout(function() { initSensorUI(); }, 350);
        }
    });
    
})();
