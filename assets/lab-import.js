/**
 * Gilba Hub Lab Data Import Module
 * Parses CSV/XLSX uploads and populates form fields
 * Version 1.1.0 - Added schema validation
 */

(function(global) {
    'use strict';
    
    var VERSION = '1.2.0';
    
    // ============================================
    // FIELD MAPPINGS
    // ============================================
    
    // Maps CSV column headers to form field selectors
    // Multiple aliases for flexibility with different lab formats
    var SOIL_FIELD_MAP = {
        // pH
        'pH_Water': '.gaip-soil-ph',
        'pH': '.gaip-soil-ph',
        'ph': '.gaip-soil-ph',
        // EC (1:5 extract - new standard)
        'EC_1_5': '.gaip-soil-ec',
        'EC1:5': '.gaip-soil-ec',
        'EC_1:5': '.gaip-soil-ec',
        'EC1_5': '.gaip-soil-ec',
        'EC_dSm': '.gaip-soil-ec',
        'EC': '.gaip-soil-ec',
        'ec': '.gaip-soil-ec',
        // Soil texture (for EC conversion)
        'Texture': '.gaip-soil-texture',
        'texture': '.gaip-soil-texture',
        'Soil_Texture': '.gaip-soil-texture',
        // CEC
        'CEC_meq100g': '.gaip-cec',
        'CEC': '.gaip-cec',
        'cec': '.gaip-cec',
        // Organic Matter
        'OM_Percent': '.gaip-loi',
        'Organic Matter': '.gaip-loi',
        'OM': '.gaip-loi',
        'LOI': '.gaip-loi',
        // Nutrients - with units and without
        'K_ppm': '[data-mlsn="K"]',
        'K': '[data-mlsn="K"]',
        'P_ppm': '[data-mlsn="P"]',
        'P': '[data-mlsn="P"]',
        'Ca_ppm': '[data-mlsn="Ca"]',
        'Ca': '[data-mlsn="Ca"]',
        'Mg_ppm': '[data-mlsn="Mg"]',
        'Mg': '[data-mlsn="Mg"]',
        'S_ppm': '[data-mlsn="S"]',
        'S': '[data-mlsn="S"]',
        'Fe_ppm': '[data-mlsn="Fe"]',
        'Fe': '[data-mlsn="Fe"]',
        'Mn_ppm': '[data-mlsn="Mn"]',
        'Mn': '[data-mlsn="Mn"]',
        'Cu_ppm': '[data-mlsn="Cu"]',
        'Cu': '[data-mlsn="Cu"]',
        'Zn_ppm': '[data-mlsn="Zn"]',
        'Zn': '[data-mlsn="Zn"]',
        'B_ppm': '[data-mlsn="B"]',
        'B': '[data-mlsn="B"]',
        'Na_ppm': '[data-mlsn="Na"]',
        'Na': '[data-mlsn="Na"]'
    };
    
    var WATER_FIELD_MAP = {
        // pH
        'pH': '.gaip-water-ph',
        'ph': '.gaip-water-ph',
        // EC
        'EC_dSm': '.gaip-ecw',
        'EC': '.gaip-ecw',
        'ec': '.gaip-ecw',
        // Ions - with units and without
        'Ca_mgL': '[data-ion="Ca"]',
        'Ca': '[data-ion="Ca"]',
        'Mg_mgL': '[data-ion="Mg"]',
        'Mg': '[data-ion="Mg"]',
        'Na_mgL': '[data-ion="Na"]',
        'Na': '[data-ion="Na"]',
        'K_mgL': '[data-ion="K"]',
        'K': '[data-ion="K"]',
        'Cl_mgL': '[data-ion="Cl"]',
        'Cl': '[data-ion="Cl"]',
        'SO4_mgL': '[data-ion="SO4"]',
        'SO4': '[data-ion="SO4"]',
        'HCO3_mgL': '[data-ion="HCO3"]',
        'HCO3': '[data-ion="HCO3"]',
        'CO3_mgL': '[data-ion="CO3"]',
        'CO3': '[data-ion="CO3"]',
        'B_mgL': '[data-ion="B"]',
        'B': '[data-ion="B"]',
        'Fe_mgL': '[data-ion="Fe"]',
        'Fe': '[data-ion="Fe"]',
        'NO3_mgL': '[data-ion="NO3"]',
        'NO3': '[data-ion="NO3"]',
        'PO4_mgL': '[data-ion="PO4"]',
        'PO4': '[data-ion="PO4"]',
        'P_mgL': '[data-ion="PO4"]',
        'P': '[data-ion="PO4"]',
        'Mn_mgL': '[data-ion="Mn"]',
        'Mn': '[data-ion="Mn"]'
    };
    
    var TISSUE_FIELD_MAP = {
        // With units
        'N_Percent': 'N',
        'P_Percent': 'P',
        'K_Percent': 'K',
        'Ca_Percent': 'Ca',
        'Mg_Percent': 'Mg',
        'S_Percent': 'S',
        'Fe_mgkg': 'Fe',
        'Mn_mgkg': 'Mn',
        'Zn_mgkg': 'Zn',
        'Cu_mgkg': 'Cu',
        'B_mgkg': 'B',
        'Na_mgkg': 'Na',
        'Mo_mgkg': 'Mo',
        'Cl_Percent': 'Cl',
        // Without units (simple headers)
        'N': 'N',
        'P': 'P',
        'K': 'K',
        'Ca': 'Ca',
        'Mg': 'Mg',
        'S': 'S',
        'Fe': 'Fe',
        'Mn': 'Mn',
        'Zn': 'Zn',
        'Cu': 'Cu',
        'B': 'B',
        'Na': 'Na',
        'Mo': 'Mo',
        'Cl': 'Cl'
    };
    
    // Sample depth mapping
    var DEPTH_MAP = {
        '0-2': '0-2',
        '0-2cm': '0-2',
        '2-4': '2-4',
        '2-4cm': '2-4',
        '4-6': '4-6',
        '4-6cm': '4-6',
        '0-10': '0-10',
        '0-10cm': '0-10'
    };
    
    // ============================================
    // SCHEMA VALIDATION (v1.1.0)
    // ============================================
    
    /**
     * Expected schemas for each data type
     * - required: columns that MUST be present (at least one alias)
     * - recommended: columns that SHOULD be present (warnings if missing)
     * - ranges: valid numeric ranges with units
     */
    var VALIDATION_SCHEMAS = {
        soil: {
            name: 'Soil Test',
            requiredOneOf: [
                // Must have at least one of these nutrient columns
                ['P', 'P_ppm', 'Phosphorus'],
                ['K', 'K_ppm', 'Potassium'],
                ['Ca', 'Ca_ppm', 'Calcium'],
                ['Mg', 'Mg_ppm', 'Magnesium']
            ],
            recommended: ['pH', 'pH_Water', 'CEC', 'EC', 'EC_1_5'],
            ranges: {
                P: { min: 0, max: 500, unit: 'ppm' },
                K: { min: 0, max: 1500, unit: 'ppm' },
                Ca: { min: 0, max: 15000, unit: 'ppm' },
                Mg: { min: 0, max: 3000, unit: 'ppm' },
                S: { min: 0, max: 500, unit: 'ppm' },
                Na: { min: 0, max: 5000, unit: 'ppm' },
                Fe: { min: 0, max: 1000, unit: 'ppm' },
                Mn: { min: 0, max: 500, unit: 'ppm' },
                Zn: { min: 0, max: 100, unit: 'ppm' },
                Cu: { min: 0, max: 50, unit: 'ppm' },
                B: { min: 0, max: 20, unit: 'ppm' },
                pH: { min: 3, max: 11, unit: '' },
                pH_Water: { min: 3, max: 11, unit: '' },
                CEC: { min: 0, max: 100, unit: 'meq/100g' },
                EC: { min: 0, max: 20, unit: 'dS/m' },
                EC_1_5: { min: 0, max: 10, unit: 'dS/m' },
                OM: { min: 0, max: 100, unit: '%' },
                LOI: { min: 0, max: 100, unit: '%' }
            },
            unitHints: {
                'meq/100g': ['CEC'],
                'ppm': ['P', 'K', 'Ca', 'Mg', 'S', 'Na', 'Fe', 'Mn', 'Zn', 'Cu', 'B'],
                'dS/m': ['EC', 'EC_1_5', 'ECe'],
                '%': ['OM', 'LOI', 'Sand', 'Clay', 'Silt']
            }
        },
        water: {
            name: 'Water Quality',
            requiredOneOf: [
                ['EC', 'EC_dSm', 'ECw', 'TDS'],
                ['Na', 'Na_mgL', 'Sodium'],
                ['Ca', 'Ca_mgL', 'Calcium']
            ],
            recommended: ['pH', 'Mg', 'Cl', 'HCO3', 'SAR'],
            ranges: {
                pH: { min: 4, max: 11, unit: '' },
                EC: { min: 0, max: 20, unit: 'dS/m' },
                EC_dSm: { min: 0, max: 20, unit: 'dS/m' },
                ECw: { min: 0, max: 20, unit: 'dS/m' },
                TDS: { min: 0, max: 15000, unit: 'mg/L' },
                Ca: { min: 0, max: 1000, unit: 'mg/L' },
                Mg: { min: 0, max: 500, unit: 'mg/L' },
                Na: { min: 0, max: 3000, unit: 'mg/L' },
                K: { min: 0, max: 200, unit: 'mg/L' },
                Cl: { min: 0, max: 3000, unit: 'mg/L' },
                HCO3: { min: 0, max: 1500, unit: 'mg/L' },
                CO3: { min: 0, max: 200, unit: 'mg/L' },
                SO4: { min: 0, max: 2000, unit: 'mg/L' },
                B: { min: 0, max: 15, unit: 'mg/L' },
                SAR: { min: 0, max: 100, unit: '' }
            },
            unitHints: {
                'mg/L': ['Ca', 'Mg', 'Na', 'K', 'Cl', 'HCO3', 'CO3', 'SO4', 'B', 'Fe', 'NO3'],
                'dS/m': ['EC', 'ECw'],
                'meq/L': ['Ca_meq', 'Mg_meq', 'Na_meq']
            }
        },
        tissue: {
            name: 'Tissue Analysis',
            requiredOneOf: [
                ['N', 'N_Percent', 'Nitrogen'],
                ['K', 'K_Percent', 'Potassium']
            ],
            recommended: ['P', 'Ca', 'Mg', 'S', 'Fe', 'Mn', 'Zn'],
            ranges: {
                N: { min: 0, max: 10, unit: '%' },
                P: { min: 0, max: 2, unit: '%' },
                K: { min: 0, max: 8, unit: '%' },
                Ca: { min: 0, max: 5, unit: '%' },
                Mg: { min: 0, max: 2, unit: '%' },
                S: { min: 0, max: 2, unit: '%' },
                Fe: { min: 0, max: 2000, unit: 'ppm' },
                Mn: { min: 0, max: 1000, unit: 'ppm' },
                Zn: { min: 0, max: 500, unit: 'ppm' },
                Cu: { min: 0, max: 100, unit: 'ppm' },
                B: { min: 0, max: 200, unit: 'ppm' },
                Na: { min: 0, max: 30000, unit: 'ppm' }
            },
            unitHints: {
                '%': ['N', 'P', 'K', 'Ca', 'Mg', 'S'],
                'ppm': ['Fe', 'Mn', 'Zn', 'Cu', 'B', 'Mo', 'Na']
            }
        }
    };

    /**
     * Validate CSV data against schema
     * @param {object} parsed - Result from parseCSV() with headers and rows
     * @param {string} dataType - 'soil', 'water', or 'tissue'
     * @returns {object} { valid: boolean, errors: [], warnings: [], valueIssues: [] }
     */
    function validateSchema(parsed, dataType) {
        var schema = VALIDATION_SCHEMAS[dataType];
        if (!schema) {
            return { valid: true, errors: [], warnings: [], valueIssues: [] };
        }

        var errors = [];
        var warnings = [];
        var valueIssues = [];
        var headers = parsed.headers.map(function(h) { return h.trim(); });
        var headersLower = headers.map(function(h) { return h.toLowerCase(); });

        // Check required columns (must have at least one from each group)
        if (schema.requiredOneOf) {
            schema.requiredOneOf.forEach(function(group) {
                var found = group.some(function(col) {
                    return headers.indexOf(col) !== -1 || 
                           headersLower.indexOf(col.toLowerCase()) !== -1;
                });
                if (!found) {
                    errors.push('Missing required column: need one of [' + group.join(', ') + ']');
                }
            });
        }

        // Check recommended columns
        if (schema.recommended) {
            schema.recommended.forEach(function(col) {
                var found = headers.indexOf(col) !== -1 || 
                           headersLower.indexOf(col.toLowerCase()) !== -1;
                if (!found) {
                    warnings.push('Recommended column missing: ' + col);
                }
            });
        }

        // Validate value ranges for each row
        if (schema.ranges && parsed.rows.length > 0) {
            parsed.rows.forEach(function(row, rowIndex) {
                Object.keys(row).forEach(function(col) {
                    var value = row[col];
                    if (value === '' || value === null || value === undefined) return;

                    // Find matching range (handle aliases)
                    var baseCol = col.replace(/_ppm|_mgL|_Percent|_meq/gi, '');
                    var range = schema.ranges[col] || schema.ranges[baseCol];
                    
                    if (range) {
                        var num = parseFloat(value);
                        if (isNaN(num)) {
                            valueIssues.push({
                                row: rowIndex + 1,
                                column: col,
                                value: value,
                                issue: 'Not a valid number'
                            });
                        } else if (num < range.min) {
                            valueIssues.push({
                                row: rowIndex + 1,
                                column: col,
                                value: num,
                                issue: 'Below minimum (' + range.min + (range.unit ? ' ' + range.unit : '') + ')'
                            });
                        } else if (num > range.max) {
                            valueIssues.push({
                                row: rowIndex + 1,
                                column: col,
                                value: num,
                                issue: 'Above maximum (' + range.max + (range.unit ? ' ' + range.unit : '') + ') - verify units'
                            });
                        }
                    }
                });
            });
        }

        // Check for unit confusion indicators
        var unitWarnings = detectUnitConfusion(parsed, schema);
        warnings = warnings.concat(unitWarnings);

        return {
            valid: errors.length === 0,
            errors: errors,
            warnings: warnings,
            valueIssues: valueIssues,
            schema: schema.name
        };
    }

    /**
     * Detect common unit confusion patterns
     * e.g., Water Ca in ppm (soil units) instead of mg/L
     */
    function detectUnitConfusion(parsed, schema) {
        var warnings = [];
        if (!parsed.rows.length) return warnings;

        var row = parsed.rows[0];

        // Check for soil ppm values appearing in water data (they should be mg/L but similar range)
        // Water mg/L and soil ppm are numerically similar, so check for telltale signs

        // If water Ca > 500, user may have entered soil Ca in ppm
        if (schema === VALIDATION_SCHEMAS.water) {
            var ca = parseFloat(row.Ca || row.Ca_mgL || 0);
            if (ca > 800) {
                warnings.push('Ca (' + ca + ') is very high for water - verify units are mg/L not ppm');
            }
        }

        // If tissue values are > 10 for macros, likely ppm not %
        if (schema === VALIDATION_SCHEMAS.tissue) {
            ['N', 'P', 'K', 'Ca', 'Mg', 'S'].forEach(function(nutrient) {
                var val = parseFloat(row[nutrient] || row[nutrient + '_Percent'] || 0);
                if (val > 10) {
                    warnings.push(nutrient + ' (' + val + ') > 10% is unusual - verify units (should be % not ppm)');
                }
            });
        }

        return warnings;
    }

    /**
     * Format validation result as HTML for display
     * @param {object} validation - Result from validateSchema()
     * @returns {string} HTML
     */
    function formatValidationResult(validation) {
        if (validation.valid && validation.warnings.length === 0 && validation.valueIssues.length === 0) {
            return '<div style="color: #059669; padding: 8px; background: var(--gaip-good-bg); border-radius: 4px; margin-bottom: 8px;">' +
                   '✅ ' + validation.schema + ' data validated successfully</div>';
        }

        var html = '<div style="padding: 12px; border-radius: 6px; margin-bottom: 8px; ';
        
        if (validation.errors.length > 0) {
            html += 'background: var(--gaip-critical-bg); border: 1px solid #fca5a5;">';
            html += '<div style="font-weight: 600; color: #dc2626; margin-bottom: 8px;">❌ Import Validation Failed</div>';
        } else {
            html += 'background: var(--gaip-warning-bg); border: 1px solid var(--gaip-warning-border);">';
            html += '<div style="font-weight: 600; color: #92400e; margin-bottom: 8px;">⚠️ Import Warnings</div>';
        }

        // Errors
        if (validation.errors.length > 0) {
            validation.errors.forEach(function(err) {
                html += '<div style="color: #dc2626; font-size: 13px; margin: 4px 0;">🔴 ' + err + '</div>';
            });
        }

        // Warnings
        if (validation.warnings.length > 0) {
            validation.warnings.slice(0, 5).forEach(function(warn) {
                html += '<div style="color: #92400e; font-size: 13px; margin: 4px 0;">🟡 ' + warn + '</div>';
            });
            if (validation.warnings.length > 5) {
                html += '<div style="color: var(--gaip-text); font-size: 12px;">...and ' + 
                        (validation.warnings.length - 5) + ' more warnings</div>';
            }
        }

        // Value issues
        if (validation.valueIssues.length > 0) {
            html += '<div style="margin-top: 8px; font-weight: 500; color: var(--gaip-text); font-size: 12px;">Value Issues:</div>';
            validation.valueIssues.slice(0, 5).forEach(function(issue) {
                html += '<div style="color: var(--gaip-text); font-size: 12px; margin: 2px 0; padding-left: 12px;">';
                html += 'Row ' + issue.row + ', ' + issue.column + ' = ' + issue.value + ': ' + issue.issue;
                html += '</div>';
            });
            if (validation.valueIssues.length > 5) {
                html += '<div style="color: var(--gaip-text); font-size: 12px; padding-left: 12px;">...and ' + 
                        (validation.valueIssues.length - 5) + ' more value issues</div>';
            }
        }

        html += '</div>';
        return html;
    }

    // ============================================
    // CSV PARSER
    // ============================================
    
    function parseCSV(text) {
        var lines = text.trim().split(/\r?\n/);
        if (lines.length < 2) {
            throw new Error('CSV must have header row and at least one data row');
        }
        
        var headers = parseCSVLine(lines[0]);
        var rows = [];
        
        for (var i = 1; i < lines.length; i++) {
            if (!lines[i].trim()) continue;
            
            var values = parseCSVLine(lines[i]);
            var row = {};
            
            for (var j = 0; j < headers.length; j++) {
                row[headers[j].trim()] = values[j] ? values[j].trim() : '';
            }
            rows.push(row);
        }
        
        return { headers: headers, rows: rows };
    }
    
    function parseCSVLine(line) {
        var result = [];
        var current = '';
        var inQuotes = false;
        
        for (var i = 0; i < line.length; i++) {
            var char = line[i];
            
            if (char === '"') {
                inQuotes = !inQuotes;
            } else if (char === ',' && !inQuotes) {
                result.push(current);
                current = '';
            } else {
                current += char;
            }
        }
        result.push(current);
        
        return result;
    }
    
    // ============================================
    // DETECT DATA TYPE
    // ============================================
    
    function detectDataType(headers) {
        var headerStr = headers.join(',').toLowerCase();
        var headerList = headers.map(function(h) { return h.toLowerCase().trim(); });
        
        // Check for tissue-specific columns
        // Tissue has N (nitrogen) as a major element - soil doesn't track total N in MLSN
        if (headerStr.includes('n_percent') || headerStr.includes('tissue') || 
            headerStr.includes('_mgkg') || headerStr.includes('clippings')) {
            return 'tissue';
        }
        
        // Simple tissue detection: has N column but no CEC (soil) or HCO3/SAR (water)
        if (headerList.indexOf('n') !== -1 && 
            headerList.indexOf('cec') === -1 && 
            headerList.indexOf('hco3') === -1 &&
            headerList.indexOf('sar') === -1) {
            return 'tissue';
        }
        
        // Check for water-specific columns
        if (headerStr.includes('_mgl') || headerStr.includes('hco3') || 
            headerStr.includes('source') || headerStr.includes('bore') ||
            headerStr.includes('sar') || headerStr.includes('rsc') ||
            headerStr.includes('tds')) {
            return 'water';
        }
        
        // Check for soil-specific columns
        if (headerStr.includes('cec') || headerStr.includes('_ppm') || 
            headerStr.includes('extraction') || headerStr.includes('sand_percent') ||
            headerStr.includes('om_percent') || headerStr.includes('organic matter')) {
            return 'soil';
        }
        
        return 'unknown';
    }
    
    // ============================================
    // POPULATE FORM FIELDS
    // ============================================
    
    function populateSoilFields(row) {
        var populated = [];
        var container = document.querySelector('.gaip-hub-container') || document;
        
        
        // Auto-set Mehlich 3 extraction method (Westgate Labs standard for turf)
        var methodSelect = container.querySelector('.gaip-soil-extractant');
        if (methodSelect) {
            methodSelect.value = 'mehlich3';
            methodSelect.dispatchEvent(new Event('change', { bubbles: true }));
            populated.push('Extraction Method (Mehlich 3)');
        }
        
        // Set sampling depth if present
        var depthKey = row['Sample_Depth_cm'] || row['Depth'] || row['Sample Depth'];
        if (depthKey) {
            var depthSelect = container.querySelector('.gaip-sampling-depth');
            if (depthSelect) {
                var depthVal = String(depthKey).replace('cm', '').trim();
                var opts = depthSelect.options;
                for (var i = 0; i < opts.length; i++) {
                    if (opts[i].value === depthVal || opts[i].value.includes(depthVal)) {
                        depthSelect.value = opts[i].value;
                        populated.push('Sampling Depth');
                        break;
                    }
                }
            }
        }
        
        // Populate numeric fields
        for (var col in SOIL_FIELD_MAP) {
            if (row[col] !== undefined && row[col] !== '') {
                var selector = SOIL_FIELD_MAP[col];
                var input = container.querySelector(selector);
                
                // Try document-wide if not found in container
                if (!input) {
                    input = document.querySelector(selector);
                }
                
                if (input) {
                    input.value = parseFloat(row[col]) || row[col];
                    input.dispatchEvent(new Event('input', { bubbles: true }));
                    input.dispatchEvent(new Event('change', { bubbles: true }));
                    populated.push(col);
                } else {
                }
            }
        }
        
        return populated;
    }
    
    function populateWaterFields(row) {
        var populated = [];
        var container = document.querySelector('.gaip-hub-container') || document;
        
        
        for (var col in WATER_FIELD_MAP) {
            if (row[col] !== undefined && row[col] !== '') {
                var selector = WATER_FIELD_MAP[col];
                var input = container.querySelector(selector);
                
                // Try document-wide if not found in container
                if (!input) {
                    input = document.querySelector(selector);
                }
                
                if (input) {
                    input.value = parseFloat(row[col]) || row[col];
                    input.dispatchEvent(new Event('input', { bubbles: true }));
                    input.dispatchEvent(new Event('change', { bubbles: true }));
                    populated.push(col);
                } else {
                }
            }
        }
        
        return populated;
    }
    
    function populateTissueFields(row) {
        var populated = [];
        var container = document.querySelector('#gaipTissueModule') || document.querySelector('.gaip-tissue-module') || document;
        
        // Build a map of nutrient symbol -> value from the row
        var nutrientValues = {};
        for (var col in TISSUE_FIELD_MAP) {
            if (row[col] !== undefined && row[col] !== '') {
                var nutrientSymbol = TISSUE_FIELD_MAP[col]; // e.g., 'N', 'P', 'K'
                nutrientValues[nutrientSymbol] = parseFloat(row[col]);
            }
        }
        
        
        // Find the tissue rows table
        var tissueRows = container.querySelector('#gaipTissueRows');
        if (tissueRows) {
        }
        
        // Find tissue input fields - try multiple selectors
        var tissueInputs = container.querySelectorAll('input[data-val]');
        
        // If no inputs found, try alternative selectors
        if (tissueInputs.length === 0) {
            tissueInputs = container.querySelectorAll('.gaip-inp[inputmode="decimal"]');
        }
        
        // Still no inputs? Try looking in table rows
        if (tissueInputs.length === 0) {
            tissueInputs = container.querySelectorAll('tr[data-el] input');
        }
        
        tissueInputs.forEach(function(input) {
            // Get nutrient from data-val attribute
            var nutrient = input.dataset.val || input.getAttribute('data-val');
            
            // Fallback: get from parent row's data-el attribute
            if (!nutrient) {
                var tr = input.closest('tr');
                if (tr && tr.dataset.el) {
                    nutrient = tr.dataset.el;
                }
            }
            
            
            // If we identified the nutrient and have a value for it, populate
            if (nutrient && nutrientValues[nutrient] !== undefined) {
                input.value = nutrientValues[nutrient];
                input.dispatchEvent(new Event('input', { bubbles: true }));
                input.dispatchEvent(new Event('change', { bubbles: true }));
                populated.push(nutrient);
            }
        });
        
        return populated;
    }
    
    // ============================================
    // FILE HANDLER
    // ============================================
    
    // ============================================
    // UK LAB PRESET PARSERS
    // NRM (Agri-Food & Biosciences), Lancrop Laboratories, Eurofins Agro
    //
    // Each parser:
    //  1. Detects format from CSV fingerprint
    //  2. Normalises to a flat row object with SOIL_FIELD_MAP keys
    //  3. Returns null if format not recognised (fall through to standard parse)
    // ============================================

    /**
     * Detect which UK lab format this CSV belongs to.
     * Returns 'nrm' | 'lancrop' | 'eurofins' | null
     */
    function detectUKLabFormat(csvText) {
        var first2k = csvText.substring(0, 2000).toLowerCase();
        // NRM: header line contains "nrm" or "nitrogen reactive management" or specific NRM columns
        if (first2k.indexOf('nrm laboratory') !== -1 ||
            first2k.indexOf('nrm soil') !== -1 ||
            first2k.indexOf('nrm agri') !== -1 ||
            (first2k.indexOf('nitrate-n') !== -1 && first2k.indexOf('p (bicarb)') !== -1)) {
            return 'nrm';
        }
        // Lancrop: "lancrop" in header block or characteristic column names
        if (first2k.indexOf('lancrop') !== -1 ||
            first2k.indexOf('available phosphorus (olsen)') !== -1 ||
            (first2k.indexOf('smb') !== -1 && first2k.indexOf('p index') !== -1)) {
            return 'lancrop';
        }
        // Eurofins: "eurofins" in header block or characteristic structure
        if (first2k.indexOf('eurofins') !== -1 ||
            first2k.indexOf('eurofins agro') !== -1 ||
            (first2k.indexOf('p-al') !== -1 && first2k.indexOf('k-al') !== -1)) {
            return 'eurofins';
        }
        return null;
    }

    /**
     * Parse NRM (UK) soil report CSV.
     *
     * NRM exports a single-header row CSV. Common column names:
     *   Sample ID, pH, P (Bicarb) mg/kg, K mg/kg, Ca mg/kg, Mg mg/kg,
     *   S mg/kg, Na mg/kg, Mn mg/kg, Fe mg/kg, Cu mg/kg, Zn mg/kg, B mg/kg,
     *   CEC meq/100g, OM %, EC dS/m, Nitrate-N mg/kg, Amm-N mg/kg
     *
     * Returns array of normalised row objects keyed to SOIL_FIELD_MAP.
     */
    function parseNRMFormat(csvText) {
        var parsed = parseCSV(csvText);
        if (!parsed.rows.length) return null;

        // Column alias map – NRM label → SOIL_FIELD_MAP key
        var colMap = {
            'ph':                     'pH',
            'ph (water)':             'pH',
            'p (bicarb) mg/kg':       'P_ppm',
            'p mg/kg':                'P_ppm',
            'phosphorus mg/kg':       'P_ppm',
            'k mg/kg':                'K_ppm',
            'potassium mg/kg':        'K_ppm',
            'ca mg/kg':               'Ca_ppm',
            'calcium mg/kg':          'Ca_ppm',
            'mg mg/kg':               'Mg_ppm',
            'magnesium mg/kg':        'Mg_ppm',
            's mg/kg':                'S_ppm',
            'sulphur mg/kg':          'S_ppm',
            'sulfur mg/kg':           'S_ppm',
            'na mg/kg':               'Na_ppm',
            'sodium mg/kg':           'Na_ppm',
            'fe mg/kg':               'Fe_ppm',
            'iron mg/kg':             'Fe_ppm',
            'mn mg/kg':               'Mn_ppm',
            'manganese mg/kg':        'Mn_ppm',
            'cu mg/kg':               'Cu_ppm',
            'copper mg/kg':           'Cu_ppm',
            'zn mg/kg':               'Zn_ppm',
            'zinc mg/kg':             'Zn_ppm',
            'b mg/kg':                'B_ppm',
            'boron mg/kg':            'B_ppm',
            'cec meq/100g':           'CEC',
            'cec':                    'CEC',
            'om %':                   'OM_Percent',
            'organic matter %':       'OM_Percent',
            'loss on ignition %':     'OM_Percent',
            'ec ds/m':                'EC_dSm',
            'ec (1:5)':               'EC_1_5',
            'nitrate-n mg/kg':        'NO3_N',
            'sample id':              'Sample_ID',
            'sample':                 'Sample_ID'
        };

        return parsed.rows.map(function(row) {
            var normalised = {};
            Object.keys(row).forEach(function(col) {
                var key = (col || '').toLowerCase().trim();
                var mappedKey = colMap[key];
                if (mappedKey && row[col] !== '' && row[col] !== null && row[col] !== undefined) {
                    normalised[mappedKey] = row[col];
                } else {
                    // Pass through unrecognised columns so nothing is lost
                    normalised[col] = row[col];
                }
            });
            normalised._labFormat = 'NRM';
            normalised._extraction = 'bicarb'; // NRM uses Modified Olsen/Bicarb for P
            return normalised;
        });
    }

    /**
     * Parse Lancrop Laboratories (UK) soil report CSV.
     *
     * Lancrop exports a single-header row CSV. Common column names:
     *   Sample No., pH, Available Phosphorus (Olsen) (mg/kg),
     *   Available Potassium (mg/kg), Exchangeable Calcium (mg/kg),
     *   Exchangeable Magnesium (mg/kg), Available Sulphur (mg/kg),
     *   Sodium (mg/kg), Copper (mg/kg), Zinc (mg/kg), Manganese (mg/kg),
     *   Iron (mg/kg), Boron (mg/kg), CEC (meq/100g), OM (%), SMB
     *
     * Returns array of normalised row objects.
     */
    function parseLancropFormat(csvText) {
        var parsed = parseCSV(csvText);
        if (!parsed.rows.length) return null;

        var colMap = {
            'sample no.':                         'Sample_ID',
            'sample no':                          'Sample_ID',
            'sample id':                          'Sample_ID',
            'ph':                                 'pH',
            'available phosphorus (olsen) (mg/kg)': 'P_ppm',
            'available phosphorus (mg/kg)':       'P_ppm',
            'olsen p (mg/kg)':                    'P_ppm',
            'phosphorus (mg/kg)':                 'P_ppm',
            'available potassium (mg/kg)':        'K_ppm',
            'potassium (mg/kg)':                  'K_ppm',
            'exchangeable calcium (mg/kg)':       'Ca_ppm',
            'calcium (mg/kg)':                    'Ca_ppm',
            'exchangeable magnesium (mg/kg)':     'Mg_ppm',
            'magnesium (mg/kg)':                  'Mg_ppm',
            'available sulphur (mg/kg)':          'S_ppm',
            'sulphur (mg/kg)':                    'S_ppm',
            'sulfur (mg/kg)':                     'S_ppm',
            'sodium (mg/kg)':                     'Na_ppm',
            'iron (mg/kg)':                       'Fe_ppm',
            'manganese (mg/kg)':                  'Mn_ppm',
            'copper (mg/kg)':                     'Cu_ppm',
            'zinc (mg/kg)':                       'Zn_ppm',
            'boron (mg/kg)':                      'B_ppm',
            'cec (meq/100g)':                     'CEC',
            'cec':                                'CEC',
            'om (%)':                             'OM_Percent',
            'organic matter (%)':                 'OM_Percent',
            'loss on ignition (%)':               'OM_Percent'
        };

        return parsed.rows.map(function(row) {
            var normalised = {};
            Object.keys(row).forEach(function(col) {
                var key = (col || '').toLowerCase().trim();
                var mappedKey = colMap[key];
                if (mappedKey && row[col] !== '' && row[col] !== null && row[col] !== undefined) {
                    normalised[mappedKey] = row[col];
                } else {
                    normalised[col] = row[col];
                }
            });
            normalised._labFormat = 'Lancrop';
            normalised._extraction = 'olsen'; // Lancrop uses Olsen for P
            return normalised;
        });
    }

    /**
     * Parse Eurofins Agro (UK) soil report CSV.
     *
     * Eurofins UK uses a European-style format with P-AL, K-AL notation
     * from ammonium acetate-lactate extraction (common in continental Europe)
     * but UK branch reports may use either Olsen or M3.
     *
     * Common columns:
     *   Sample, pH (CaCl2) or pH (H2O), P-AL (mg/kg) or P (Olsen) mg/kg,
     *   K-AL (mg/kg) or K (mg/kg), Ca (mg/kg), Mg (mg/kg), S (mg/kg),
     *   Na (mg/kg), Fe (mg/kg), Mn (mg/kg), Cu (mg/kg), Zn (mg/kg),
     *   B (mg/kg), CEC (cmol/kg), SOM (%), EC (dS/m)
     *
     * Returns array of normalised row objects.
     */
    function parseEurofinsSoilFormat(csvText) {
        var parsed = parseCSV(csvText);
        if (!parsed.rows.length) return null;

        var colMap = {
            'sample':                     'Sample_ID',
            'sample id':                  'Sample_ID',
            'sample no':                  'Sample_ID',
            'ph (h2o)':                   'pH',
            'ph (water)':                 'pH',
            'ph (cacl2)':                 'pH',
            'ph':                         'pH',
            'p-al (mg/kg)':               'P_ppm',
            'p-al':                       'P_ppm',
            'p (olsen) mg/kg':            'P_ppm',
            'p (olsen)':                  'P_ppm',
            'phosphorus (mg/kg)':         'P_ppm',
            'p (mg/kg)':                  'P_ppm',
            'k-al (mg/kg)':               'K_ppm',
            'k-al':                       'K_ppm',
            'potassium (mg/kg)':          'K_ppm',
            'k (mg/kg)':                  'K_ppm',
            'ca (mg/kg)':                 'Ca_ppm',
            'calcium (mg/kg)':            'Ca_ppm',
            'mg (mg/kg)':                 'Mg_ppm',
            'magnesium (mg/kg)':          'Mg_ppm',
            's (mg/kg)':                  'S_ppm',
            'sulphur (mg/kg)':            'S_ppm',
            'sulfur (mg/kg)':             'S_ppm',
            'na (mg/kg)':                 'Na_ppm',
            'sodium (mg/kg)':             'Na_ppm',
            'fe (mg/kg)':                 'Fe_ppm',
            'iron (mg/kg)':               'Fe_ppm',
            'mn (mg/kg)':                 'Mn_ppm',
            'manganese (mg/kg)':          'Mn_ppm',
            'cu (mg/kg)':                 'Cu_ppm',
            'copper (mg/kg)':             'Cu_ppm',
            'zn (mg/kg)':                 'Zn_ppm',
            'zinc (mg/kg)':               'Zn_ppm',
            'b (mg/kg)':                  'B_ppm',
            'boron (mg/kg)':              'B_ppm',
            'cec (cmol/kg)':              'CEC',
            'cec':                        'CEC',
            'som (%)':                    'OM_Percent',
            'organic matter (%)':         'OM_Percent',
            'som':                        'OM_Percent',
            'ec (ds/m)':                  'EC_dSm',
            'ec':                         'EC_dSm'
        };

        // Detect extraction method from column headers
        var headersLower = parsed.headers.map(function(h) { return h.toLowerCase(); });
        var hasPAL = headersLower.some(function(h) { return h.indexOf('p-al') !== -1; });
        var hasOlsen = headersLower.some(function(h) { return h.indexOf('olsen') !== -1; });
        var extractionMethod = hasPAL ? 'mehlich3' : (hasOlsen ? 'olsen' : 'mehlich3');

        return parsed.rows.map(function(row) {
            var normalised = {};
            Object.keys(row).forEach(function(col) {
                var key = (col || '').toLowerCase().trim();
                var mappedKey = colMap[key];
                if (mappedKey && row[col] !== '' && row[col] !== null && row[col] !== undefined) {
                    normalised[mappedKey] = row[col];
                } else {
                    normalised[col] = row[col];
                }
            });
            normalised._labFormat = 'Eurofins';
            normalised._extraction = extractionMethod;
            return normalised;
        });
    }

    /**
     * Attempt UK lab preset detection before standard CSV parsing.
     * Returns { rows, labFormat, extraction } or null if not a UK preset format.
     *
     * @param {string} csvText
     * @returns {object|null}
     */
    function tryUKLabPreset(csvText) {
        var fmt = detectUKLabFormat(csvText);
        if (!fmt) return null;

        var rows = null;
        if (fmt === 'nrm')      rows = parseNRMFormat(csvText);
        if (fmt === 'lancrop')  rows = parseLancropFormat(csvText);
        if (fmt === 'eurofins') rows = parseEurofinsSoilFormat(csvText);

        if (!rows || !rows.length) return null;
        return { rows: rows, labFormat: fmt, extraction: rows[0]._extraction || 'unknown' };
    }


    function handleFileUpload(file, options) {
        options = options || {};
        
        return new Promise(function(resolve, reject) {
            if (!file) {
                reject(new Error('No file provided'));
                return;
            }
            
            var ext = file.name.split('.').pop().toLowerCase();
            
            if (ext === 'csv') {
                var reader = new FileReader();
                reader.onload = function(e) {
                    try {
                        var result = processCSVData(e.target.result, options);
                        resolve(result);
                    } catch (err) {
                        reject(err);
                    }
                };
                reader.onerror = function() {
                    reject(new Error('Failed to read file'));
                };
                reader.readAsText(file);
            } else if (ext === 'xlsx' || ext === 'xls') {
                // For Excel files, we'd need SheetJS library
                // Check if it's available
                if (typeof XLSX === 'undefined') {
                    reject(new Error('Excel support requires SheetJS library. Please use CSV format.'));
                    return;
                }
                
                var reader = new FileReader();
                reader.onload = function(e) {
                    try {
                        var workbook = XLSX.read(e.target.result, { type: 'array' });
                        var firstSheet = workbook.Sheets[workbook.SheetNames[0]];
                        var csv = XLSX.utils.sheet_to_csv(firstSheet);
                        var result = processCSVData(csv, options);
                        resolve(result);
                    } catch (err) {
                        reject(err);
                    }
                };
                reader.onerror = function() {
                    reject(new Error('Failed to read file'));
                };
                reader.readAsArrayBuffer(file);
            } else {
                reject(new Error('Unsupported file type. Please use CSV or XLSX.'));
            }
        });
    }
    
    function processCSVData(csvText, options) {
        // ── UK lab preset detection ──
        // Try NRM / Lancrop / Eurofins format first before standard column parse
        var ukPreset = tryUKLabPreset(csvText);
        if (ukPreset) {
            var presetRow = ukPreset.rows[(options && options.rowIndex) || 0];
            if (!presetRow) {
                throw new Error('Row index not found in UK lab preset data.');
            }
            // Auto-set extraction method if the UI supports it
            var container = document.querySelector('.gaip-hub-container') || document;
            var methodSelect = container.querySelector('.gaip-soil-extractant');
            if (methodSelect && ukPreset.extraction) {
                methodSelect.value = ukPreset.extraction;
                methodSelect.dispatchEvent(new Event('change', { bubbles: true }));
            }
            var populated = populateSoilFields(presetRow);
            return {
                dataType: 'soil',
                rowCount: ukPreset.rows.length,
                selectedRow: (options && options.rowIndex) || 0,
                sampleId: presetRow.Sample_ID || 'Unknown',
                populated: populated,
                row: presetRow,
                labFormat: ukPreset.labFormat,
                validation: { valid: true, errors: [], warnings: [], valueIssues: [] },
                validationHtml: '<p class="gaip-import-ok">✓ ' + ukPreset.labFormat + ' format detected</p>'
            };
        }

        var parsed = parseCSV(csvText);
        var dataType = options.dataType || detectDataType(parsed.headers);
        var rowIndex = options.rowIndex || 0; // Which row to use (0 = first data row)
        var skipValidation = options.skipValidation || false;
        
        if (rowIndex >= parsed.rows.length) {
            throw new Error('Row index ' + rowIndex + ' not found. File has ' + parsed.rows.length + ' data rows.');
        }
        
        // Run schema validation (v1.1.0)
        var validation = { valid: true, errors: [], warnings: [], valueIssues: [] };
        if (!skipValidation && dataType !== 'unknown') {
            validation = validateSchema(parsed, dataType);
            
            // Log validation results
            if (validation.errors.length > 0) {
                console.warn('[LabImport] Schema validation errors:', validation.errors);
            }
            if (validation.warnings.length > 0) {
            }
            if (validation.valueIssues.length > 0) {
            }
            
            // Block import if critical errors (missing required columns)
            if (validation.errors.length > 0 && !options.forceImport) {
                var error = new Error('Import validation failed: ' + validation.errors.join('; '));
                error.validation = validation;
                error.validationHtml = formatValidationResult(validation);
                throw error;
            }
        }
        
        var row = parsed.rows[rowIndex];
        var populated = [];
        
        switch (dataType) {
            case 'soil':
                populated = populateSoilFields(row);
                break;
            case 'water':
                populated = populateWaterFields(row);
                break;
            case 'tissue':
                populated = populateTissueFields(row);
                break;
            default:
                throw new Error('Could not detect data type. Please ensure CSV headers match template format.');
        }
        
        return {
            dataType: dataType,
            rowCount: parsed.rows.length,
            selectedRow: rowIndex,
            sampleId: row.Sample_ID || row.SampleID || 'Unknown',
            populated: populated,
            row: row,
            validation: validation,
            validationHtml: formatValidationResult(validation)
        };
    }
    
    // ============================================
    // UI INTEGRATION
    // ============================================
    
    function createImportButton(container, dataType) {
        var wrapper = document.createElement('div');
        wrapper.className = 'gaip-import-wrapper';
        wrapper.style.cssText = 'margin: 10px 0; display: flex; gap: 8px; align-items: center;';
        
        var input = document.createElement('input');
        input.type = 'file';
        input.accept = '.csv,.xlsx,.xls';
        input.style.display = 'none';
        input.id = 'gaip-import-' + dataType;
        
        var btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'gaip-import-btn';
        btn.innerHTML = 'Import ' + dataType.charAt(0).toUpperCase() + dataType.slice(1) + ' Data';
        btn.style.cssText = 'padding: 6px 12px; background: var(--gaip-info-bg); border: 1px solid #0ea5e9; border-radius: 4px; cursor: pointer; font-size: 12px; color: #0369a1;';
        
        var status = document.createElement('span');
        status.className = 'gaip-import-status';
        status.style.cssText = 'font-size: 11px; color: var(--gaip-text);';
        
        btn.onclick = function() { input.click(); };
        
        input.onchange = function(e) {
            var file = e.target.files[0];
            if (!file) return;
            
            status.textContent = 'Importing...';
            status.style.color = 'var(--gaip-text-secondary)';
            
            handleFileUpload(file, { dataType: dataType })
                .then(function(result) {
                    status.textContent = 'Imported ' + result.populated.length + ' fields from ' + result.sampleId;
                    status.style.color = '#16a34a';
                    
                    // Dispatch event for other modules to know data was imported
                    document.dispatchEvent(new CustomEvent('gaip:data-imported', {
                        detail: result
                    }));
                })
                .catch(function(err) {
                    status.textContent = 'Error: ' + err.message;
                    status.style.color = '#dc2626';
                });
            
            // Reset input so same file can be selected again
            input.value = '';
        };
        
        wrapper.appendChild(input);
        wrapper.appendChild(btn);
        wrapper.appendChild(status);
        
        if (container) {
            container.appendChild(wrapper);
        }
        
        return wrapper;
    }
    
    // Auto-inject import buttons when DOM ready
    function init() {
        // Skip if Sample Manager is present (it provides better import functionality)
        if (typeof GAIP_SampleManager !== 'undefined') {
            return;
        }
        
        // Add import button to Soil & Water section
        var soilHeader = document.querySelector('.gaip-card-header h3');
        document.querySelectorAll('.gaip-card-header h3').forEach(function(h3) {
            if (h3.textContent.includes('Soil') && h3.textContent.includes('Water')) {
                var cardBody = h3.closest('.gaip-card').querySelector('.gaip-card-body');
                if (cardBody) {
                    // Insert at top of card body
                    var importWrapper = document.createElement('div');
                    importWrapper.style.cssText = 'display: flex; gap: 12px; margin-bottom: 12px; padding-bottom: 12px; border-bottom: 1px solid var(--gaip-border);';
                    
                    createImportButton(importWrapper, 'soil');
                    createImportButton(importWrapper, 'water');
                    
                    cardBody.insertBefore(importWrapper, cardBody.firstChild);
                }
            }
        });
        
        // Add import button to Tissue section
        var tissueModule = document.querySelector('#gaipTissueModule');
        if (tissueModule) {
            // Wait for tissue UI to render
            setTimeout(function() {
                var tissueCard = tissueModule.querySelector('.gaip-card-head');
                if (tissueCard) {
                    var importWrapper = document.createElement('div');
                    importWrapper.style.cssText = 'margin-top: 8px;';
                    createImportButton(importWrapper, 'tissue');
                    tissueCard.appendChild(importWrapper);
                }
            }, 500);
        }
        
    }
    
    // Init on DOM ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function() {
            setTimeout(init, 400); // Delay to allow Sample Manager to load first
        });
    } else {
        setTimeout(init, 400); // Delay to allow Sample Manager to load first
    }
    
    // ============================================
    // EXPORTS
    // ============================================
    
    global.GAIP_LabImport = {
        version: VERSION,
        parseCSV: parseCSV,
        detectDataType: detectDataType,
        importFile: handleFileUpload,
        populateSoil: populateSoilFields,
        populateWater: populateWaterFields,
        populateTissue: populateTissueFields,
        createButton: createImportButton,
        // Schema validation (v1.1.0)
        validateSchema: validateSchema,
        formatValidationResult: formatValidationResult,
        VALIDATION_SCHEMAS: VALIDATION_SCHEMAS,
        // UK lab presets (v1.2.0)
        detectUKLabFormat: detectUKLabFormat,
        parseNRMFormat: parseNRMFormat,
        parseLancropFormat: parseLancropFormat,
        parseEurofinsSoilFormat: parseEurofinsSoilFormat,
        tryUKLabPreset: tryUKLabPreset
    };
    
})(window);
