/**
 * Gilba Hub Sensor Import Module v1.0.1
 * Supports TDR 350 (including FieldScout native format) and POGO soil moisture sensors
 * Version 3.0.0
 * 
 * TDR 350: Variable tine lengths (38mm, 76mm, 127mm)
 * - FieldScout native CSV format auto-detected
 * - Rod length codes: S=38mm, T=76mm, L=127mm
 * POGO: Fixed 5cm (50mm) measurement depth
 */

(function(global) {
    'use strict';
    // b35fix272: namespaced storage — prevents cross-mode key bleed
    var _ls = window.GilbaStorageNS ? window.GilbaStorageNS.get() : localStorage;

    
    // ============================================
    // SENSOR DEVICE CONFIGURATION
    // ============================================
    
    var DEVICE_CONFIG = {
        TDR350: {
            name: 'TDR 350',
            manufacturer: 'Spectrum Technologies',
            defaultDepth: 76,
            depthOptions: [38, 76, 127],
            ecUnit: 'mS/cm',
            features: ['vwc', 'ec', 'soilTemp'],
            description: 'Handheld TDR with variable tine depths'
        },
        TDR350_FIELDSCOUT: {
            name: 'TDR 350 (FieldScout)',
            manufacturer: 'Spectrum Technologies',
            defaultDepth: 76,
            depthOptions: [38, 76, 127],
            rodLengthCodes: { 'S': 38, 'T': 76, 'L': 127 },
            ecUnit: 'mS/cm',
            features: ['vwc', 'ec', 'soilTemp', 'surfaceTemp', 'gps'],
            description: 'FieldScout TDR 350 native CSV format'
        },
        POGO: {
            name: 'POGO',
            manufacturer: 'Stevens Water',
            defaultDepth: 50,
            depthOptions: [50],
            ecUnit: 'dS/m',
            features: ['vwc', 'ec', 'soilTemp', 'surfaceTemp', 'salinityIndex'],
            description: 'Portable soil sensor with fixed 5cm depth'
        }
    };
    
    // ============================================
    // SENSOR DATA STORE
    // ============================================
    
    var sensorData = {
        readings: [],
        zones: {},
        latest: null,
        summary: null,
        importDate: null,
        deviceType: null,
        deviceConfig: null,
        measurementDepth: null,
        siteId: null
    };
    
    var ZONE_TOLERANCE = 0.0001;
    
    // ============================================
    // DEVICE DETECTION
    // ============================================
    
    function detectDeviceType(csvText, headers) {
        // POGO detection
        if (csvText.startsWith('sep=') || 
            headers.includes('sample date') ||
            headers.includes('salinity index') ||
            headers.includes('soil temperature depth')) {
            return 'POGO';
        }
        
        // FieldScout TDR 350 native format detection
        // Headers: Time,VWC%,Period,EC,Temp_Soil,Temp_Soil(F),Temp_IR,Temp_IR(F),Latitude,Longitude,Satellites,Fix,Rod Length,Soil Type,VWC Mode[,HDoP]
        if (headers.includes('vwc%') || 
            (headers.includes('time') && headers.includes('period') && headers.includes('rod length'))) {
            return 'TDR350_FIELDSCOUT';
        }
        
        // Generic TDR format
        if (headers.includes('vwc (%)') || headers.includes('vwc') ||
            (headers.includes('date') && headers.includes('time') && !headers.includes('sample date'))) {
            return 'TDR350';
        }
        if (headers.some(function(h) { return h.includes('moisture') || h.includes('vwc'); })) {
            return 'TDR350';
        }
        return null;
    }
    
    // ============================================
    // CSV PARSING - COMMON
    // ============================================
    
    function parseCSVLine(line) {
        var result = [];
        var current = '';
        var inQuotes = false;
        
        for (var i = 0; i < line.length; i++) {
            var char = line[i];
            if (char === '"') {
                inQuotes = !inQuotes;
            } else if (char === ',' && !inQuotes) {
                result.push(current.trim());
                current = '';
            } else {
                current += char;
            }
        }
        result.push(current.trim());
        return result;
    }
    
    function parseTimestamp(str) {
        if (!str) return null;
        str = str.replace(/"/g, '').trim();
        
        var d = new Date(str);
        if (!isNaN(d.getTime())) return d;
        
        var match = str.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})\s*(\d{1,2})?:?(\d{2})?:?(\d{2})?/);
        if (match) {
            var day = parseInt(match[1]);
            var month = parseInt(match[2]) - 1;
            var year = parseInt(match[3]);
            if (year < 100) year += 2000;
            var hour = match[4] ? parseInt(match[4]) : 12;
            var min = match[5] ? parseInt(match[5]) : 0;
            var sec = match[6] ? parseInt(match[6]) : 0;
            
            if (day > 12) {
                return new Date(year, month, day, hour, min, sec);
            } else if (month > 11) {
                return new Date(year, day - 1, month, hour, min, sec);
            } else {
                return new Date(year, month, day, hour, min, sec);
            }
        }
        return null;
    }
    
    // ============================================
    // TDR 350 CSV PARSER
    // ============================================
    
    function detectTDRColumns(headers) {
        var map = { date: -1, time: -1, datetime: -1, lat: -1, lon: -1, vwc: -1, ec: -1, temp: -1, depth: -1, notes: -1, id: -1, zone: -1 };
        
        headers.forEach(function(h, i) {
            if (h.includes('date') && h.includes('time')) map.datetime = i;
            else if (h === 'date' || h.startsWith('date')) map.date = i;
            else if ((h === 'time' || h.startsWith('time')) && !h.includes('stamp')) map.time = i;
            else if (h.includes('timestamp')) map.datetime = i;
            
            if (h.includes('lat')) map.lat = i;
            if (h.includes('lon') || h.includes('lng')) map.lon = i;
            if (h.includes('vwc') || (h.includes('moisture') && !h.includes('soil moisture'))) map.vwc = i;
            if ((h.includes('ec') && !h.includes('sec')) || h.includes('conductivity')) map.ec = i;
            if (h.includes('temp') && !h.includes('template') && !h.includes('soil temp')) map.temp = i;
            if (h.includes('depth') && !h.includes('soil')) map.depth = i;
            if (h.includes('note') || h.includes('comment')) map.notes = i;
            if (h === 'id' || h.includes('sample')) map.id = i;
            if (h.includes('zone') || h.includes('area') || h.includes('location')) map.zone = i;
        });
        return map;
    }
    
    function parseTDR350CSV(csvText, options) {
        options = options || {};
        var measurementDepth = options.depth || DEVICE_CONFIG.TDR350.defaultDepth;
        
        var lines = csvText.trim().split(/\r?\n/);
        if (lines.length < 2) throw new Error('CSV file is empty or has no data rows');
        
        var headers = parseCSVLine(lines[0]).map(function(h) { return h.toLowerCase().trim(); });
        var colMap = detectTDRColumns(headers);
        
        if (colMap.vwc === -1) {
            throw new Error('Could not find VWC column. Headers: ' + headers.join(', '));
        }
        
        var readings = [];
        var parseErrors = [];
        
        for (var i = 1; i < lines.length; i++) {
            if (!lines[i].trim()) continue;
            try {
                var values = parseCSVLine(lines[i]);
                var reading = parseTDRReading(values, colMap, i + 1, measurementDepth);
                if (reading) readings.push(reading);
            } catch (e) {
                parseErrors.push('Row ' + (i + 1) + ': ' + e.message);
            }
        }
        
        if (readings.length === 0) {
            throw new Error('No valid readings found. ' + (parseErrors.length > 0 ? parseErrors.slice(0, 3).join('; ') : ''));
        }
        
        return { deviceType: 'TDR350', readings: readings, errors: parseErrors, rowCount: lines.length - 1, successCount: readings.length, measurementDepth: measurementDepth };
    }
    
    function parseTDRReading(values, colMap, rowNum, measurementDepth) {
        var vwcRaw = values[colMap.vwc];
        var vwc = parseFloat(vwcRaw);
        if (isNaN(vwc)) throw new Error('Invalid VWC: ' + vwcRaw);
        if (vwc >= 0 && vwc <= 1) vwc = vwc * 100;
        if (vwc < 0 || vwc > 100) throw new Error('VWC out of range: ' + vwc);
        
        var timestamp = null;
        if (colMap.datetime !== -1) {
            timestamp = parseTimestamp(values[colMap.datetime]);
        } else if (colMap.date !== -1) {
            var dateStr = values[colMap.date];
            var timeStr = colMap.time !== -1 ? values[colMap.time] : '12:00:00';
            timestamp = parseTimestamp(dateStr + ' ' + timeStr);
        }
        
        var lat = colMap.lat !== -1 ? parseFloat(values[colMap.lat]) : null;
        var lon = colMap.lon !== -1 ? parseFloat(values[colMap.lon]) : null;
        if (lat !== null && (isNaN(lat) || lat < -90 || lat > 90)) lat = null;
        if (lon !== null && (isNaN(lon) || lon < -180 || lon > 180)) lon = null;
        
        var ec = colMap.ec !== -1 ? parseFloat(values[colMap.ec]) : null;
        var temp = colMap.temp !== -1 ? parseFloat(values[colMap.temp]) : null;
        var depth = colMap.depth !== -1 ? values[colMap.depth] : measurementDepth;
        var notes = colMap.notes !== -1 ? values[colMap.notes] : '';
        var id = colMap.id !== -1 ? values[colMap.id] : 'TDR-' + rowNum;
        var zoneName = colMap.zone !== -1 ? values[colMap.zone] : null;
        
        // TDR EC in mS/cm = dS/m, but handle µS/cm
        if (ec !== null && !isNaN(ec)) {
            if (ec > 50) ec = ec / 1000;
        } else {
            ec = null;
        }
        if (temp !== null && isNaN(temp)) temp = null;
        
        return {
            id: id, deviceType: 'TDR350', timestamp: timestamp, lat: lat, lon: lon,
            vwc: Math.round(vwc * 10) / 10,
            ec: ec !== null ? Math.round(ec * 100) / 100 : null,
            soilTemp: temp !== null ? Math.round(temp * 10) / 10 : null,
            surfaceTemp: null, salinityIndex: null,
            depth: typeof depth === 'string' ? parseFloat(depth) || measurementDepth : depth,
            notes: notes, zoneName: zoneName, rowNum: rowNum
        };
    }
    
    // ============================================
    // FIELDSCOUT TDR 350 NATIVE FORMAT PARSER
    // ============================================
    // Handles native CSV export from FieldScout TDR 350 devices
    // Format: Time,VWC%,Period,EC,Temp_Soil,Temp_Soil(F),Temp_IR,Temp_IR(F),
    //         Latitude,Longitude,Satellites,Fix,Rod Length,Soil Type,VWC Mode[,HDoP]
    
    // Rod length codes: S=Short(38mm/1.5"), T=Standard(76mm/3"), L=Long(127mm/5")
    var FIELDSCOUT_ROD_LENGTHS = {
        'S': 38,  // Short tines - 1.5"
        'T': 76,  // Standard tines - 3" (most common for greens)
        'L': 127  // Long tines - 5"
    };
    
    function parseFieldScoutTDR350CSV(csvText, options) {
        options = options || {};
        var defaultDepth = options.depth || DEVICE_CONFIG.TDR350.defaultDepth;
        
        var lines = csvText.trim().split(/\r?\n/);
        if (lines.length < 2) throw new Error('CSV file is empty or has no data rows');
        
        // Parse headers - handle both 15 and 16 column variants
        var headers = parseCSVLine(lines[0]).map(function(h) { 
            return h.toLowerCase().trim().replace(/"/g, ''); 
        });
        
        // Build column map for FieldScout format
        var colMap = {
            time: -1,
            vwc: -1,
            period: -1,
            ec: -1,
            tempSoil: -1,
            tempSoilF: -1,
            tempIR: -1,
            tempIRF: -1,
            latitude: -1,
            longitude: -1,
            satellites: -1,
            fix: -1,
            rodLength: -1,
            soilType: -1,
            vwcMode: -1,
            hdop: -1
        };
        
        headers.forEach(function(h, i) {
            if (h === 'time') colMap.time = i;
            else if (h === 'vwc%' || h === 'vwc') colMap.vwc = i;
            else if (h === 'period') colMap.period = i;
            else if (h === 'ec') colMap.ec = i;
            else if (h === 'temp_soil') colMap.tempSoil = i;
            else if (h === 'temp_soil(f)') colMap.tempSoilF = i;
            else if (h === 'temp_ir') colMap.tempIR = i;
            else if (h === 'temp_ir(f)') colMap.tempIRF = i;
            else if (h === 'latitude') colMap.latitude = i;
            else if (h === 'longitude') colMap.longitude = i;
            else if (h === 'satellites') colMap.satellites = i;
            else if (h === 'fix') colMap.fix = i;
            else if (h === 'rod length') colMap.rodLength = i;
            else if (h === 'soil type') colMap.soilType = i;
            else if (h === 'vwc mode') colMap.vwcMode = i;
            else if (h === 'hdop') colMap.hdop = i;
        });
        
        if (colMap.vwc === -1) {
            throw new Error('Could not find VWC% column in FieldScout format. Headers: ' + headers.join(', '));
        }
        
        var readings = [];
        var parseErrors = [];
        var rodLengthsUsed = {};
        
        for (var i = 1; i < lines.length; i++) {
            if (!lines[i].trim()) continue;
            try {
                var values = parseCSVLine(lines[i]);
                var reading = parseFieldScoutReading(values, colMap, i + 1, defaultDepth);
                if (reading) {
                    readings.push(reading);
                    // Track rod lengths used
                    if (reading.rodLengthCode) {
                        rodLengthsUsed[reading.rodLengthCode] = (rodLengthsUsed[reading.rodLengthCode] || 0) + 1;
                    }
                }
            } catch (e) {
                parseErrors.push('Row ' + (i + 1) + ': ' + e.message);
            }
        }
        
        if (readings.length === 0) {
            throw new Error('No valid readings found. ' + (parseErrors.length > 0 ? parseErrors.slice(0, 3).join('; ') : ''));
        }
        
        // Determine most common rod length for summary
        var primaryRodLength = defaultDepth;
        var maxCount = 0;
        for (var code in rodLengthsUsed) {
            if (rodLengthsUsed[code] > maxCount) {
                maxCount = rodLengthsUsed[code];
                primaryRodLength = FIELDSCOUT_ROD_LENGTHS[code] || defaultDepth;
            }
        }
        
        
        return {
            deviceType: 'TDR350',
            subType: 'FieldScout',
            readings: readings,
            errors: parseErrors,
            rowCount: lines.length - 1,
            successCount: readings.length,
            measurementDepth: primaryRodLength,
            rodLengthsUsed: rodLengthsUsed
        };
    }
    
    function parseFieldScoutReading(values, colMap, rowNum, defaultDepth) {
        // Parse VWC
        var vwcRaw = values[colMap.vwc];
        var vwc = parseFloat(vwcRaw);
        if (isNaN(vwc)) throw new Error('Invalid VWC: ' + vwcRaw);
        if (vwc < 0 || vwc > 100) throw new Error('VWC out of range: ' + vwc);
        
        // Parse timestamp (format: 2023-10-31 07:41:46)
        var timestamp = null;
        if (colMap.time !== -1) {
            timestamp = parseTimestamp(values[colMap.time]);
        }
        
        // Parse GPS coordinates - handle multiple formats:
        // Newer: 0,0 or -33.123,151.456
        // Older: "00.000000 N","000.000000 W" or "0000.0000 N","00000.0000 W"
        var lat = null;
        var lon = null;
        if (colMap.latitude !== -1 && colMap.longitude !== -1) {
            var latRaw = values[colMap.latitude];
            var lonRaw = values[colMap.longitude];
            
            if (latRaw && lonRaw) {
                // Check for string format with N/S/E/W
                var latMatch = latRaw.match(/^([\d.]+)\s*([NS])?$/i);
                var lonMatch = lonRaw.match(/^([\d.]+)\s*([EW])?$/i);
                
                if (latMatch && lonMatch) {
                    lat = parseFloat(latMatch[1]);
                    lon = parseFloat(lonMatch[1]);
                    
                    // Apply hemisphere signs
                    if (latMatch[2] && latMatch[2].toUpperCase() === 'S') lat = -lat;
                    if (lonMatch[2] && lonMatch[2].toUpperCase() === 'W') lon = -lon;
                    
                    // Handle NMEA-style coordinates (DDMM.MMMM)
                    if (lat > 90) {
                        // Convert DDMM.MMMM to DD.DDDDDD
                        var latDeg = Math.floor(lat / 100);
                        var latMin = lat % 100;
                        lat = latDeg + (latMin / 60);
                        if (latMatch[2] && latMatch[2].toUpperCase() === 'S') lat = -lat;
                    }
                    if (Math.abs(lon) > 180) {
                        var lonDeg = Math.floor(Math.abs(lon) / 100);
                        var lonMin = Math.abs(lon) % 100;
                        lon = lonDeg + (lonMin / 60);
                        if (lonMatch[2] && lonMatch[2].toUpperCase() === 'W') lon = -lon;
                    }
                } else {
                    // Simple numeric format
                    lat = parseFloat(latRaw);
                    lon = parseFloat(lonRaw);
                }
                
                // Validate coordinates - treat 0,0 as no GPS fix
                if (lat === 0 && lon === 0) {
                    lat = null;
                    lon = null;
                } else if (isNaN(lat) || isNaN(lon) || lat < -90 || lat > 90 || lon < -180 || lon > 180) {
                    lat = null;
                    lon = null;
                }
            }
        }
        
        // Parse EC (mS/cm in TDR 350)
        var ec = null;
        if (colMap.ec !== -1) {
            ec = parseFloat(values[colMap.ec]);
            if (isNaN(ec)) ec = null;
            // EC is already in mS/cm which equals dS/m - no conversion needed
        }
        
        // Parse soil temperature (Celsius)
        var soilTemp = null;
        if (colMap.tempSoil !== -1) {
            soilTemp = parseFloat(values[colMap.tempSoil]);
            if (isNaN(soilTemp)) soilTemp = null;
        }
        
        // Parse IR/surface temperature (may be "--.-" for no reading)
        var surfaceTemp = null;
        if (colMap.tempIR !== -1) {
            var irRaw = values[colMap.tempIR];
            if (irRaw && !irRaw.includes('--.') && !irRaw.includes('----')) {
                surfaceTemp = parseFloat(irRaw);
                if (isNaN(surfaceTemp)) surfaceTemp = null;
            }
        }
        
        // Parse rod length code and convert to mm
        var rodLengthCode = null;
        var depth = defaultDepth;
        if (colMap.rodLength !== -1) {
            rodLengthCode = values[colMap.rodLength];
            if (rodLengthCode && FIELDSCOUT_ROD_LENGTHS[rodLengthCode]) {
                depth = FIELDSCOUT_ROD_LENGTHS[rodLengthCode];
            }
        }
        
        // Parse soil type (S = Sand, C = Clay, etc.)
        var soilType = null;
        if (colMap.soilType !== -1) {
            soilType = values[colMap.soilType];
        }
        
        // Parse VWC mode (V = Volumetric, etc.)
        var vwcMode = null;
        if (colMap.vwcMode !== -1) {
            vwcMode = values[colMap.vwcMode];
        }
        
        // Parse Period (raw TDR period value - useful for diagnostics)
        var period = null;
        if (colMap.period !== -1) {
            period = parseInt(values[colMap.period]);
            if (isNaN(period)) period = null;
        }
        
        // GPS quality info
        var satellites = null;
        var gpsFix = null;
        var hdop = null;
        if (colMap.satellites !== -1) {
            satellites = parseInt(values[colMap.satellites]);
            if (isNaN(satellites)) satellites = null;
        }
        if (colMap.fix !== -1) {
            gpsFix = parseInt(values[colMap.fix]);
            if (isNaN(gpsFix)) gpsFix = null;
        }
        if (colMap.hdop !== -1) {
            var hdopRaw = values[colMap.hdop];
            if (hdopRaw && hdopRaw.trim()) {
                hdop = parseFloat(hdopRaw);
                if (isNaN(hdop)) hdop = null;
            }
        }
        
        return {
            id: 'TDR-' + rowNum,
            deviceType: 'TDR350',
            subType: 'FieldScout',
            timestamp: timestamp,
            lat: lat,
            lon: lon,
            vwc: Math.round(vwc * 10) / 10,
            ec: ec !== null ? Math.round(ec * 100) / 100 : null,
            soilTemp: soilTemp !== null ? Math.round(soilTemp * 10) / 10 : null,
            surfaceTemp: surfaceTemp !== null ? Math.round(surfaceTemp * 10) / 10 : null,
            salinityIndex: null,
            depth: depth,
            rodLengthCode: rodLengthCode,
            soilType: soilType,
            vwcMode: vwcMode,
            period: period,
            satellites: satellites,
            gpsFix: gpsFix,
            hdop: hdop,
            notes: '',
            zoneName: null,
            rowNum: rowNum
        };
    }
    
    // ============================================
    // POGO CSV PARSER
    // ============================================
    
    function detectPOGOColumns(headers) {
        var map = { datetime: -1, dataset: -1, moisture: -1, ec: -1, surfaceTemp: -1, soilTemp: -1, soilTempDepth: -1, salinityIndex: -1, notes: -1 };
        
        headers.forEach(function(h, i) {
            if (h.includes('sample date') || h === 'datetime' || h === 'timestamp') map.datetime = i;
            if (h === 'dataset' || h === 'zone' || h === 'area') map.dataset = i;
            if (h.includes('moisture') && h.includes('%')) map.moisture = i;
            if (h.includes('ec') && h.includes('ds')) map.ec = i;
            if (h === 'temperature (°c)' || h === 'temperature' || h === 'surface temp') map.surfaceTemp = i;
            if (h.includes('soil temperature') && h.includes('°c') && !h.includes('depth')) map.soilTemp = i;
            if (h.includes('soil temperature depth')) map.soilTempDepth = i;
            if (h.includes('salinity index')) map.salinityIndex = i;
            if (h === 'note' || h === 'notes' || h === 'comment') map.notes = i;
        });
        return map;
    }
    
    function parsePOGOCSV(csvText, options) {
        var cleanedText = csvText
            .replace(/^sep=.*[\r\n]+/i, '')
            .replace(/\r\r\n/g, '\n')
            .replace(/\r\n/g, '\n')
            .replace(/\r/g, '\n');
        
        var lines = cleanedText.trim().split('\n');
        if (lines.length < 2) throw new Error('CSV file is empty or has no data rows');
        
        var headers = parseCSVLine(lines[0]).map(function(h) { return h.toLowerCase().trim().replace(/"/g, ''); });
        var colMap = detectPOGOColumns(headers);
        
        if (colMap.moisture === -1) {
            throw new Error('Could not find Moisture column. Headers: ' + headers.join(', '));
        }
        
        var readings = [];
        var parseErrors = [];
        
        for (var i = 1; i < lines.length; i++) {
            if (!lines[i].trim()) continue;
            try {
                var values = parseCSVLine(lines[i]);
                var reading = parsePOGOReading(values, colMap, i + 1);
                if (reading) readings.push(reading);
            } catch (e) {
                parseErrors.push('Row ' + (i + 1) + ': ' + e.message);
            }
        }
        
        if (readings.length === 0) {
            throw new Error('No valid readings found. ' + (parseErrors.length > 0 ? parseErrors.slice(0, 3).join('; ') : ''));
        }
        
        return { deviceType: 'POGO', readings: readings, errors: parseErrors, rowCount: lines.length - 1, successCount: readings.length, measurementDepth: DEVICE_CONFIG.POGO.defaultDepth };
    }
    
    function parsePOGOReading(values, colMap, rowNum) {
        var moistureRaw = values[colMap.moisture];
        if (moistureRaw) moistureRaw = moistureRaw.replace(/"/g, '');
        var moisture = parseFloat(moistureRaw);
        if (isNaN(moisture)) throw new Error('Invalid Moisture: ' + moistureRaw);
        if (moisture < 0 || moisture > 100) throw new Error('Moisture out of range: ' + moisture);
        
        var timestamp = null;
        if (colMap.datetime !== -1) {
            var dtRaw = values[colMap.datetime];
            if (dtRaw) dtRaw = dtRaw.replace(/"/g, '');
            timestamp = parseTimestamp(dtRaw);
        }
        
        var dataset = colMap.dataset !== -1 ? values[colMap.dataset] : null;
        if (dataset) dataset = dataset.replace(/"/g, '').trim();
        // Use dataset value directly as zone name (user can rename via UI)
        // If dataset is just a number, prefix it; otherwise use as-is
        var zoneName = null;
        if (dataset) {
            zoneName = /^\d+$/.test(dataset) ? 'Zone ' + dataset : dataset;
        }
        
        var ec = null;
        if (colMap.ec !== -1) {
            var ecRaw = values[colMap.ec];
            if (ecRaw) ecRaw = ecRaw.replace(/"/g, '');
            ec = parseFloat(ecRaw);
            if (isNaN(ec)) ec = null;
        }
        
        var surfaceTemp = null;
        if (colMap.surfaceTemp !== -1) {
            var stRaw = values[colMap.surfaceTemp];
            if (stRaw) stRaw = stRaw.replace(/"/g, '');
            surfaceTemp = parseFloat(stRaw);
            if (isNaN(surfaceTemp)) surfaceTemp = null;
        }
        
        var soilTemp = null;
        if (colMap.soilTemp !== -1) {
            var soilTRaw = values[colMap.soilTemp];
            if (soilTRaw) soilTRaw = soilTRaw.replace(/"/g, '');
            soilTemp = parseFloat(soilTRaw);
            if (isNaN(soilTemp)) soilTemp = null;
        }
        
        var salinityIndex = null;
        if (colMap.salinityIndex !== -1) {
            var siRaw = values[colMap.salinityIndex];
            if (siRaw) siRaw = siRaw.replace(/"/g, '');
            salinityIndex = parseFloat(siRaw);
            if (isNaN(salinityIndex)) salinityIndex = null;
        }
        
        var notes = '';
        if (colMap.notes !== -1) {
            notes = values[colMap.notes] || '';
            notes = notes.replace(/"/g, '').trim();
        }
        
        return {
            id: 'POGO-' + rowNum, deviceType: 'POGO', timestamp: timestamp, lat: null, lon: null,
            vwc: Math.round(moisture * 10) / 10,
            ec: ec !== null ? Math.round(ec * 100) / 100 : null,
            soilTemp: soilTemp !== null ? Math.round(soilTemp * 10) / 10 : null,
            surfaceTemp: surfaceTemp !== null ? Math.round(surfaceTemp * 10) / 10 : null,
            salinityIndex: salinityIndex !== null ? Math.round(salinityIndex * 100) / 100 : null,
            depth: DEVICE_CONFIG.POGO.defaultDepth,
            notes: notes, zoneName: zoneName, rowNum: rowNum
        };
    }
    
    // ============================================
    // UNIFIED PARSER
    // ============================================
    
    function parseSensorCSV(csvText, options) {
        options = options || {};
        
        var firstLine = csvText.trim().split(/[\r\n]+/)[0];
        if (firstLine.toLowerCase().startsWith('sep=')) {
            firstLine = csvText.trim().split(/[\r\n]+/)[1] || '';
        }
        var headers = parseCSVLine(firstLine).map(function(h) { return h.toLowerCase().trim().replace(/"/g, ''); });
        
        var deviceType = options.deviceType || detectDeviceType(csvText, headers);
        if (!deviceType) throw new Error('Could not detect sensor type. Please specify TDR350 or POGO.');
        
        
        if (deviceType === 'POGO') {
            return parsePOGOCSV(csvText, options);
        } else if (deviceType === 'TDR350_FIELDSCOUT') {
            return parseFieldScoutTDR350CSV(csvText, options);
        } else {
            return parseTDR350CSV(csvText, options);
        }
    }
    
    // ============================================
    // ZONE CLUSTERING & STATS
    // ============================================
    
    function clusterIntoZones(readings) {
        var zones = {};
        var zoneCounter = 1;
        
        readings.forEach(function(reading) {
            if (reading.zoneName) {
                var zoneName = reading.zoneName.trim();
                if (!zones[zoneName]) {
                    zones[zoneName] = { name: zoneName, readings: [], centroid: null };
                }
                zones[zoneName].readings.push(reading);
                return;
            }
            
            if (reading.lat === null || reading.lon === null) {
                if (!zones['Unknown']) {
                    zones['Unknown'] = { name: 'Unknown', readings: [], centroid: null };
                }
                zones['Unknown'].readings.push(reading);
                return;
            }
            
            var foundZone = null;
            for (var zoneId in zones) {
                var zone = zones[zoneId];
                if (zone.centroid && 
                    Math.abs(zone.centroid.lat - reading.lat) < ZONE_TOLERANCE &&
                    Math.abs(zone.centroid.lon - reading.lon) < ZONE_TOLERANCE) {
                    foundZone = zoneId;
                    break;
                }
            }
            
            if (foundZone) {
                zones[foundZone].readings.push(reading);
                var z = zones[foundZone];
                var n = z.readings.length;
                z.centroid.lat = ((z.centroid.lat * (n - 1)) + reading.lat) / n;
                z.centroid.lon = ((z.centroid.lon * (n - 1)) + reading.lon) / n;
            } else {
                var newZoneName = 'Zone ' + zoneCounter++;
                zones[newZoneName] = { name: newZoneName, readings: [reading], centroid: { lat: reading.lat, lon: reading.lon } };
            }
        });
        
        for (var zId in zones) {
            zones[zId].stats = calculateZoneStats(zones[zId].readings);
        }
        return zones;
    }
    
    function calculateZoneStats(readings) {
        if (!readings || readings.length === 0) return { count: 0 };
        
        function calcStats(values) {
            var filtered = values.filter(function(v) { return v !== null && !isNaN(v); });
            if (filtered.length === 0) return null;
            
            var sum = filtered.reduce(function(a, b) { return a + b; }, 0);
            var mean = sum / filtered.length;
            var min = Math.min.apply(null, filtered);
            var max = Math.max.apply(null, filtered);
            var sqDiffs = filtered.map(function(v) { return Math.pow(v - mean, 2); });
            var stdDev = Math.sqrt(sqDiffs.reduce(function(a, b) { return a + b; }, 0) / filtered.length);
            
            return { mean: mean, min: min, max: max, stdDev: stdDev, count: filtered.length };
        }
        
        var stats = { count: readings.length };
        stats.vwc = calcStats(readings.map(function(r) { return r.vwc; }));
        stats.ec = calcStats(readings.map(function(r) { return r.ec; }));
        stats.soilTemp = calcStats(readings.map(function(r) { return r.soilTemp; }));
        stats.surfaceTemp = calcStats(readings.map(function(r) { return r.surfaceTemp; }));
        stats.salinityIndex = calcStats(readings.map(function(r) { return r.salinityIndex; }));
        stats.temp = stats.soilTemp; // Backwards compat
        
        return stats;
    }
    
    // ============================================
    // INTEGRATION DATA
    // ============================================
    
    function getIrrigationData() {
        if (!sensorData.summary) return null;
        
        var stats = sensorData.summary;
        var config = sensorData.deviceConfig || DEVICE_CONFIG.TDR350;
        
        return {
            source: sensorData.deviceType || 'Unknown',
            deviceName: config.name,
            importDate: sensorData.importDate,
            measurementDepth: sensorData.measurementDepth,
            vwc: stats.vwc ? stats.vwc.mean : null,
            vwcMin: stats.vwc ? stats.vwc.min : null,
            vwcMax: stats.vwc ? stats.vwc.max : null,
            vwcStdDev: stats.vwc ? stats.vwc.stdDev : null,
            ec: stats.ec ? stats.ec.mean : null,
            ecMin: stats.ec ? stats.ec.min : null,
            ecMax: stats.ec ? stats.ec.max : null,
            soilTemp: stats.soilTemp ? stats.soilTemp.mean : null,
            surfaceTemp: stats.surfaceTemp ? stats.surfaceTemp.mean : null,
            salinityIndex: stats.salinityIndex ? stats.salinityIndex.mean : null,
            zoneCount: Object.keys(sensorData.zones).length,
            readingCount: sensorData.readings.length,
            zones: Object.keys(sensorData.zones).map(function(zId) {
                var z = sensorData.zones[zId];
                return {
                    name: z.name,
                    vwc: z.stats.vwc ? z.stats.vwc.mean : null,
                    vwcStdDev: z.stats.vwc ? z.stats.vwc.stdDev : null,
                    ec: z.stats.ec ? z.stats.ec.mean : null,
                    soilTemp: z.stats.soilTemp ? z.stats.soilTemp.mean : null,
                    salinityIndex: z.stats.salinityIndex ? z.stats.salinityIndex.mean : null,
                    count: z.stats.count
                };
            })
        };
    }
    
    function getWaterQualityData() {
        if (!sensorData.summary || !sensorData.summary.ec) return null;
        
        return {
            source: sensorData.deviceType || 'Unknown',
            soilEC: sensorData.summary.ec.mean,
            soilECMin: sensorData.summary.ec.min,
            soilECMax: sensorData.summary.ec.max,
            soilECStdDev: sensorData.summary.ec.stdDev,
            salinityIndex: sensorData.summary.salinityIndex ? sensorData.summary.salinityIndex.mean : null,
            readingCount: sensorData.readings.filter(function(r) { return r.ec !== null; }).length
        };
    }
    
    function getProblemZones() {
        var problems = [];
        
        for (var zId in sensorData.zones) {
            var zone = sensorData.zones[zId];
            var stats = zone.stats;
            
            if (stats.vwc && stats.vwc.mean < 15) {
                problems.push({ zone: zone.name, type: 'dry', severity: stats.vwc.mean < 10 ? 'critical' : 'warning', value: stats.vwc.mean, message: 'Low soil moisture (' + stats.vwc.mean.toFixed(1) + '% VWC)' });
            }
            if (stats.vwc && stats.vwc.mean > 45) {
                problems.push({ zone: zone.name, type: 'wet', severity: stats.vwc.mean > 55 ? 'critical' : 'warning', value: stats.vwc.mean, message: 'High soil moisture (' + stats.vwc.mean.toFixed(1) + '% VWC)' });
            }
            if (stats.ec && stats.ec.mean > 3) {
                problems.push({ zone: zone.name, type: 'salinity', severity: stats.ec.mean > 5 ? 'critical' : 'warning', value: stats.ec.mean, message: 'Elevated salinity (' + stats.ec.mean.toFixed(2) + ' dS/m)' });
            }
            if (stats.vwc && stats.vwc.count >= 3) {
                var cv = (stats.vwc.stdDev / stats.vwc.mean) * 100;
                if (cv > 30) {
                    problems.push({ zone: zone.name, type: 'variability', severity: cv > 50 ? 'warning' : 'info', value: cv, message: 'High variability (CV ' + cv.toFixed(0) + '%)' });
                }
            }
            if (stats.salinityIndex && stats.salinityIndex.mean > 1.5) {
                problems.push({ zone: zone.name, type: 'salinityIndex', severity: stats.salinityIndex.mean > 2 ? 'warning' : 'info', value: stats.salinityIndex.mean, message: 'Elevated salinity index (' + stats.salinityIndex.mean.toFixed(2) + ')' });
            }
        }
        return problems;
    }
    
    // ============================================
    // FILE HANDLING
    // ============================================
    
    function handleFileUpload(file, options) {
        options = options || {};
        
        return new Promise(function(resolve, reject) {
            if (!file) { reject(new Error('No file provided')); return; }
            
            var reader = new FileReader();
            
            reader.onload = function(e) {
                try {
                    var csvText = e.target.result;
                    var result = parseSensorCSV(csvText, options);
                    
                    sensorData.readings = result.readings;
                    sensorData.zones = clusterIntoZones(result.readings);
                    sensorData.summary = calculateZoneStats(result.readings);
                    sensorData.importDate = new Date();
                    sensorData.deviceType = result.deviceType;
                    sensorData.deviceConfig = DEVICE_CONFIG[result.deviceType];
                    sensorData.measurementDepth = result.measurementDepth;
                    
                    sensorData.latest = result.readings.reduce(function(latest, r) {
                        if (!r.timestamp) return latest;
                        if (!latest || r.timestamp > latest.timestamp) return r;
                        return latest;
                    }, null);
                    
                    saveSensorData();
                    
                    document.dispatchEvent(new CustomEvent('gaip:sensor-data-imported', {
                        detail: { deviceType: result.deviceType, readings: result.readings.length, zones: Object.keys(sensorData.zones).length, summary: sensorData.summary, measurementDepth: result.measurementDepth }
                    }));
                    
                    resolve({
                        success: true, deviceType: result.deviceType, deviceName: DEVICE_CONFIG[result.deviceType].name,
                        readings: result.successCount, errors: result.errors, zones: Object.keys(sensorData.zones).length,
                        summary: sensorData.summary, measurementDepth: result.measurementDepth, problems: getProblemZones()
                    });
                } catch (err) {
                    reject(err);
                }
            };
            
            reader.onerror = function() { reject(new Error('Failed to read file')); };
            reader.readAsText(file);
        });
    }
    
    // ============================================
    // SITE-SCOPED STORAGE HELPERS (b35fix109)
    // TDR/CSV import data is site-specific — a Duntry reading should not
    // feed into Elanora's irrigation calculation.
    // Storage key: gaip_sensor_data_{siteId}
    // Falls back to 'gaip_sensor_data' (legacy key) if no site is active.
    // ============================================

    function getActiveSiteId() {
        try {
            if (window.GAIP_SampleManager && typeof GAIP_SampleManager.getActiveSiteId === 'function') {
                var id = GAIP_SampleManager.getActiveSiteId();
                return (id && id !== 'default') ? id : null;
            }
        } catch (e) {}
        return null;
    }

    function storageKey() {
        var siteId = getActiveSiteId();
        return siteId ? 'gaip_sensor_data_' + siteId : 'gaip_sensor_data';
    }

    function saveSensorData() {
        try {
            var siteId = getActiveSiteId();
            var toSave = { readings: sensorData.readings, importDate: sensorData.importDate ? sensorData.importDate.toISOString() : null, deviceType: sensorData.deviceType, measurementDepth: sensorData.measurementDepth, siteId: siteId };
            _ls.setItem(storageKey(), JSON.stringify(toSave));
        } catch (e) { console.warn('[Sensor] Could not save:', e); }
    }
    
    function loadSensorData() {
        try {
            var siteId = getActiveSiteId();
            // Try site-specific key first
            var saved = _ls.getItem(storageKey());
            // Fall back to legacy global key only for pre-b35fix109 untagged data
            if (!saved) {
                var legacy = _ls.getItem('gaip_sensor_data');
                if (legacy) {
                    try {
                        var legacyData = JSON.parse(legacy);
                        if (!legacyData.siteId) saved = legacy; // only accept untagged legacy
                    } catch(e) {}
                }
            }
            if (!saved) return false;
            
            var data = JSON.parse(saved);
            if (!data.readings || data.readings.length === 0) return false;

            // b35fix110: reject data tagged to a different site
            if (data.siteId && siteId && data.siteId !== siteId) {
                console.log('[Sensor] Skipping data from site', data.siteId, '— active site is', siteId);
                return false;
            }
            
            sensorData.readings = data.readings;
            sensorData.zones = clusterIntoZones(data.readings);
            sensorData.importDate = data.importDate ? new Date(data.importDate) : null;
            sensorData.deviceType = data.deviceType || 'TDR350';
            sensorData.deviceConfig = DEVICE_CONFIG[sensorData.deviceType];
            sensorData.measurementDepth = data.measurementDepth || DEVICE_CONFIG[sensorData.deviceType].defaultDepth;
            sensorData.summary = calculateZoneStats(data.readings);
            sensorData.siteId = data.siteId || siteId || null;
            sensorData.latest = data.readings.reduce(function(latest, r) {
                if (!r.timestamp) return latest;
                var ts = new Date(r.timestamp);
                if (!latest || ts > new Date(latest.timestamp)) { r.timestamp = ts; return r; }
                return latest;
            }, null);
            
            return true;
        } catch (e) { console.warn('[Sensor] Could not load:', e); return false; }
    }
    
    function clearSensorData() {
        sensorData.readings = [];
        sensorData.zones = {};
        sensorData.latest = null;
        sensorData.summary = null;
        sensorData.importDate = null;
        sensorData.deviceType = null;
        sensorData.deviceConfig = null;
        sensorData.siteId = null;
        sensorData.measurementDepth = null;
        _ls.removeItem(storageKey());
        document.dispatchEvent(new CustomEvent('gaip:sensor-data-cleared'));
    }

    // On site switch: unload current site's data from memory and load the new site's data.
    // b35fix111: debounced — gaip:site-changed fires twice on site switch (sample-manager +
    // sensor-integration-manager both dispatch it). Without debounce the second fire clears
    // memory immediately after the first 300ms reload, leaving hasData() false.
    var _siteChangedTimer = null;
    var _pendingSiteId = null;
    document.addEventListener('gaip:site-changed', function(e) {
        // b35fix115: capture the new site ID from the event detail NOW — before the
        // 150ms delay. GAIP_SampleManager.getActiveSiteId() hasn't settled by 150ms,
        // so storageKey() would return the OUTGOING site's key, loading the wrong data.
        var newSiteId = (e.detail && e.detail.siteId) || null;
        if (newSiteId) _pendingSiteId = newSiteId;

        // Clear immediately so stale data doesn't feed engines during transition
        sensorData.readings = [];
        sensorData.zones = {};
        sensorData.summary = null;
        sensorData.latest = null;
        sensorData.siteId = null;

        clearTimeout(_siteChangedTimer);
        _siteChangedTimer = setTimeout(function() {
            // Use the captured site ID to build the correct storage key
            var targetSiteId = _pendingSiteId;
            var key = targetSiteId ? 'gaip_sensor_data_' + targetSiteId : 'gaip_sensor_data';
            var loaded = false;
            try {
                var raw = _ls.getItem(key);
                if (!raw && targetSiteId) raw = _ls.getItem('gaip_sensor_data'); // legacy fallback
                if (raw) {
                    var data = JSON.parse(raw);
                    if (data.readings && data.readings.length > 0) {
                        // Reject if tagged to a different site
                        if (data.siteId && targetSiteId && data.siteId !== targetSiteId) {
                            console.log('[Sensor] Site changed — rejecting data tagged to', data.siteId, 'for target site', targetSiteId);
                        } else {
                            sensorData.readings = data.readings;
                            sensorData.zones = clusterIntoZones(data.readings);
                            sensorData.importDate = data.importDate ? new Date(data.importDate) : null;
                            sensorData.deviceType = data.deviceType || 'TDR350';
                            sensorData.deviceConfig = DEVICE_CONFIG[sensorData.deviceType];
                            sensorData.measurementDepth = data.measurementDepth || DEVICE_CONFIG[sensorData.deviceType].defaultDepth;
                            sensorData.summary = calculateZoneStats(data.readings);
                            sensorData.siteId = data.siteId || targetSiteId;
                            sensorData.latest = data.readings.reduce(function(latest, r) {
                                if (!r.timestamp) return latest;
                                var ts = new Date(r.timestamp);
                                if (!latest || ts > new Date(latest.timestamp)) { r.timestamp = ts; return r; }
                                return latest;
                            }, null);
                            loaded = true;
                        }
                    }
                }
            } catch(err) { console.warn('[Sensor] Site-switch restore failed:', err); }

            console.log('[Sensor] Site changed — sensor data for', targetSiteId + ':', loaded ? (sensorData.readings.length + ' readings') : 'none');
            if (loaded) {
                document.dispatchEvent(new CustomEvent('gaip:sensor-data-imported', {
                    detail: { source: 'site-switch-restore', readings: sensorData.readings.length }
                }));
            }
        }, 150);
    });
    
    // ============================================
    // UI RENDERING
    // ============================================
    
    function renderSensorSummary() {
        if (!sensorData.summary) return '<div class="gaip-sensor-empty">No sensor data imported</div>';
        
        var stats = sensorData.summary;
        var problems = getProblemZones();
        var config = sensorData.deviceConfig || DEVICE_CONFIG.TDR350;
        var importAge = sensorData.importDate ? Math.round((Date.now() - sensorData.importDate.getTime()) / (1000 * 60 * 60)) : null;
        
        var html = '<div class="gaip-sensor-summary">';
        html += '<div class="gaip-sensor-header">';
        html += '<span class="gaip-sensor-device">📡 ' + config.name + '</span>';
        if (sensorData.measurementDepth) html += '<span class="gaip-sensor-depth">' + sensorData.measurementDepth + 'mm</span>';
        if (importAge !== null) {
            var ageText = importAge < 1 ? 'Just now' : importAge < 24 ? importAge + 'h ago' : Math.round(importAge / 24) + 'd ago';
            html += '<span class="gaip-sensor-age">' + ageText + '</span>';
        }
        html += '</div>';
        
        html += '<div class="gaip-sensor-metrics">';
        if (stats.vwc) {
            var vwcStatus = stats.vwc.mean < 15 ? 'low' : stats.vwc.mean > 45 ? 'high' : 'ok';
            html += '<div class="gaip-sensor-metric gaip-status-' + vwcStatus + '"><div class="gaip-sensor-value">' + stats.vwc.mean.toFixed(1) + '%</div><div class="gaip-sensor-label">Soil Moisture</div><div class="gaip-sensor-range">' + stats.vwc.min.toFixed(0) + '-' + stats.vwc.max.toFixed(0) + '%</div></div>';
        }
        if (stats.ec) {
            var ecStatus = stats.ec.mean > 4 ? 'high' : stats.ec.mean > 2 ? 'warning' : 'ok';
            html += '<div class="gaip-sensor-metric gaip-status-' + ecStatus + '"><div class="gaip-sensor-value">' + stats.ec.mean.toFixed(2) + '</div><div class="gaip-sensor-label">EC (dS/m)</div></div>';
        }
        if (stats.soilTemp) {
            html += '<div class="gaip-sensor-metric"><div class="gaip-sensor-value">' + stats.soilTemp.mean.toFixed(1) + '°C</div><div class="gaip-sensor-label">Soil Temp</div></div>';
        }
        if (stats.surfaceTemp && sensorData.deviceType === 'POGO') {
            html += '<div class="gaip-sensor-metric"><div class="gaip-sensor-value">' + stats.surfaceTemp.mean.toFixed(1) + '°C</div><div class="gaip-sensor-label">Surface Temp</div></div>';
        }
        if (stats.salinityIndex && sensorData.deviceType === 'POGO') {
            var siStatus = stats.salinityIndex.mean > 2 ? 'warning' : 'ok';
            html += '<div class="gaip-sensor-metric gaip-status-' + siStatus + '"><div class="gaip-sensor-value">' + stats.salinityIndex.mean.toFixed(2) + '</div><div class="gaip-sensor-label">Salinity Index</div></div>';
        }
        html += '<div class="gaip-sensor-metric"><div class="gaip-sensor-value">' + Object.keys(sensorData.zones).length + '</div><div class="gaip-sensor-label">Zones</div></div>';
        html += '<div class="gaip-sensor-metric"><div class="gaip-sensor-value">' + sensorData.readings.length + '</div><div class="gaip-sensor-label">Readings</div></div>';
        html += '</div>';
        
        if (problems.length > 0) {
            html += '<div class="gaip-sensor-problems"><div class="gaip-sensor-problems-header">Issues Detected</div>';
            problems.forEach(function(p) { html += '<div class="gaip-sensor-problem gaip-severity-' + p.severity + '"><strong>' + p.zone + ':</strong> ' + p.message + '</div>'; });
            html += '</div>';
        }
        html += '</div>';
        return html;
    }
    
    function renderZoneTable() {
        if (Object.keys(sensorData.zones).length === 0) return '';
        
        var hasSI = sensorData.deviceType === 'POGO';
        var html = '<table class="gaip-sensor-zones-table"><thead><tr><th>Zone</th><th>VWC %</th><th>EC</th><th>Soil Temp</th>';
        if (hasSI) html += '<th>Salinity Idx</th>';
        html += '<th>Readings</th><th></th></tr></thead><tbody>';
        
        for (var zId in sensorData.zones) {
            var zone = sensorData.zones[zId];
            var stats = zone.stats;
            var escapedId = zId.replace(/'/g, "\\'");
            html += '<tr data-zone-id="' + zId + '">';
            html += '<td><span class="zone-name-display">' + zone.name + '</span>';
            html += '<input type="text" class="zone-name-input" value="' + zone.name + '" style="display:none;width:100px;padding:2px 4px;font-size:12px;border:1px solid var(--gaip-border);border-radius:4px;"></td>';
            html += '<td>' + (stats.vwc ? stats.vwc.mean.toFixed(1) : '--') + '</td>';
            html += '<td>' + (stats.ec ? stats.ec.mean.toFixed(2) : '--') + '</td>';
            html += '<td>' + (stats.soilTemp ? stats.soilTemp.mean.toFixed(1) + '°C' : '--') + '</td>';
            if (hasSI) html += '<td>' + (stats.salinityIndex ? stats.salinityIndex.mean.toFixed(2) : '--') + '</td>';
            html += '<td>' + stats.count + '</td>';
            html += '<td><button type="button" class="zone-edit-btn" onclick="GAIP_Sensor.editZoneName(\'' + escapedId + '\')" style="padding:2px 6px;font-size:11px;cursor:pointer;background:var(--gaip-surface-hover);border:1px solid var(--gaip-border);border-radius:4px;">✏️</button></td>';
            html += '</tr>';
        }
        html += '</tbody></table>';
        html += '<div style="margin-top:8px;font-size:11px;color:var(--gaip-text);">💡 Click ✏️ to rename zones (e.g., "Green 1", "Fairway 3")</div>';
        return html;
    }
    
    /**
     * Edit zone name - toggle input visibility
     */
    function editZoneName(zoneId) {
        var row = document.querySelector('tr[data-zone-id="' + zoneId + '"]');
        if (!row) return;
        
        var display = row.querySelector('.zone-name-display');
        var input = row.querySelector('.zone-name-input');
        var btn = row.querySelector('.zone-edit-btn');
        
        if (input.style.display === 'none') {
            // Show input
            display.style.display = 'none';
            input.style.display = 'inline-block';
            input.focus();
            input.select();
            btn.textContent = '✓';
            btn.onclick = function() { saveZoneName(zoneId); };
            
            // Save on Enter key
            input.onkeydown = function(e) {
                if (e.key === 'Enter') saveZoneName(zoneId);
                if (e.key === 'Escape') cancelZoneEdit(zoneId);
            };
        }
    }
    
    /**
     * Save renamed zone
     */
    function saveZoneName(oldZoneId) {
        var row = document.querySelector('tr[data-zone-id="' + oldZoneId + '"]');
        if (!row) return;
        
        var input = row.querySelector('.zone-name-input');
        var newName = input.value.trim();
        
        if (!newName || newName === oldZoneId) {
            cancelZoneEdit(oldZoneId);
            return;
        }
        
        // Check for duplicate name
        if (sensorData.zones[newName] && newName !== oldZoneId) {
            alert('Zone name "' + newName + '" already exists. Please use a different name.');
            return;
        }
        
        // Update zone data
        var zoneData = sensorData.zones[oldZoneId];
        zoneData.name = newName;
        
        // Update readings
        sensorData.readings.forEach(function(r) {
            if (r.zoneName === oldZoneId) {
                r.zoneName = newName;
            }
        });
        
        // Re-key the zones object
        delete sensorData.zones[oldZoneId];
        sensorData.zones[newName] = zoneData;
        
        // Save and re-render
        saveSensorData();
        
        // Re-render zone table
        var container = document.querySelector('.gaip-sensor-zones');
        if (container) {
            container.innerHTML = renderZoneTable();
        }
        
    }
    
    /**
     * Cancel zone edit
     */
    function cancelZoneEdit(zoneId) {
        var row = document.querySelector('tr[data-zone-id="' + zoneId + '"]');
        if (!row) return;
        
        var display = row.querySelector('.zone-name-display');
        var input = row.querySelector('.zone-name-input');
        var btn = row.querySelector('.zone-edit-btn');
        
        display.style.display = 'inline';
        input.style.display = 'none';
        input.value = sensorData.zones[zoneId].name;
        btn.textContent = '✏️';
        btn.onclick = function() { editZoneName(zoneId); };
    }
    
    // ============================================
    // INIT
    // ============================================
    
    function init() {
        // b35fix114: GAIP_SampleManager may not be ready at DOMContentLoaded, so
        // getActiveSiteId() returns null and storageKey() falls back to the legacy
        // global key — missing site-specific data saved under gaip_sensor_data_{siteId}.
        // Defer load until gaip:site-config-applied which guarantees the active site is known.
        // Also attempt immediately as a fallback (covers legacy untagged data).
        var loaded = loadSensorData();
        if (!loaded) {
            document.addEventListener('gaip:site-config-applied', function _initLoad() {
                var loaded2 = loadSensorData();
                if (loaded2) {
                    console.log('[Sensor] Deferred page-load restore: ' + sensorData.readings.length + ' readings for site ' + (sensorData.siteId || 'unknown'));
                    document.dispatchEvent(new CustomEvent('gaip:sensor-data-imported', {
                        detail: { source: 'page-load-deferred', readings: sensorData.readings.length }
                    }));
                }
                document.removeEventListener('gaip:site-config-applied', _initLoad);
            });
        }
    }
    
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
    
    var selectedZoneData = { name: null, data: null };
    var calculatedZoneSummaries = null;
    
    // ============================================
    // EXPORTS
    // ============================================
    
    global.GAIP_Sensor = {
        DEVICES: DEVICE_CONFIG,
        import: handleFileUpload,
        clear: clearSensorData,
        getData: function() { return sensorData; },
        getSummary: function() { return sensorData.summary; },
        getZones: function() { return sensorData.zones; },
        getLatest: function() { return sensorData.latest; },
        getDeviceType: function() { return sensorData.deviceType; },
        getDeviceConfig: function() { return sensorData.deviceConfig; },
        getMeasurementDepth: function() { return sensorData.measurementDepth; },
        getProblems: getProblemZones,
        getReadings: function() { return sensorData.readings.slice(); },
        updateReadings: function(readings) { sensorData.readings = readings; sensorData.zones = clusterIntoZones(readings); sensorData.summary = calculateZoneStats(readings); saveSensorData(); },
        setSelectedZone: function(name, data) { selectedZoneData.name = name; selectedZoneData.data = data; },
        getSelectedZone: function() { return selectedZoneData; },
        setZoneSummaries: function(summaries) { calculatedZoneSummaries = summaries; },
        getZoneSummaries: function() { return calculatedZoneSummaries; },
        getIrrigationData: getIrrigationData,
        getWaterQualityData: getWaterQualityData,
        renderSummary: renderSensorSummary,
        renderZoneTable: renderZoneTable,
        editZoneName: editZoneName,
        saveZoneName: saveZoneName,
        cancelZoneEdit: cancelZoneEdit,
        hasData: function() { return sensorData.readings.length > 0; },
        getSiteId: function() { return sensorData.siteId || null; },
        getSensorInfo: function() { 
            return { 
                deviceType: sensorData.deviceType, 
                measurementDepth: sensorData.measurementDepth,
                deviceConfig: sensorData.deviceConfig
            }; 
        },
        parseCSV: parseSensorCSV,
        detectDevice: function(csvText) {
            var firstLine = csvText.trim().split(/[\r\n]+/)[0];
            if (firstLine.toLowerCase().startsWith('sep=')) firstLine = csvText.trim().split(/[\r\n]+/)[1] || '';
            var headers = parseCSVLine(firstLine).map(function(h) { return h.toLowerCase().trim().replace(/"/g, ''); });
            return detectDeviceType(csvText, headers);
        }
    };
    
    
})(window);
