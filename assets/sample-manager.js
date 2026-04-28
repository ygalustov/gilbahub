/**
 * =============================================================================
 * GILBA HUB SAMPLE MANAGER v1.0.0
 * =============================================================================
 * 
 * Multi-sample management for soil, water, and tissue testing.
 * Enables import and analysis of multiple zones (greens, fairways, tees, etc.)
 * from a single lab report.
 * 
 * FEATURES:
 * - Import multiple samples from CSV/XLSX files
 * - Store samples with zone identifiers
 * - Quick-switch between samples for analysis
 * - Comparison view across multiple samples
 * - Batch export with all samples in report
 * 
 * USAGE:
 * - SampleManager.importFile(file, type) - Import CSV/XLSX with multiple samples
 * - SampleManager.loadSample(type, id) - Load a sample into the active form
 * - SampleManager.getSamples(type) - Get all samples of a type
 * - SampleManager.compare(type, ids) - Compare multiple samples
 * 
 * @author Gilba Solutions
 * @version 1.0.0
 * =============================================================================
 */

(function(global) {
    'use strict';

    // =========================================================================
    // CONFIGURATION
    // =========================================================================

    const CONFIG = {
        version: '1.0.0',
        debug: false,
        maxSamples: 50,  // Maximum samples per type
        storageKey: 'gilba_samples'
    };

    // =========================================================================
    // SAMPLE STORAGE (site-scoped)
    // =========================================================================

    /**
     * Site registry: { siteId: { label: string, createdAt: string } }
     */
    let _sites = {
        'default': { label: 'My Site', createdAt: new Date().toISOString() }
    };

    /**
     * Current active site
     */
    let _currentSite = 'default';

    /**
     * Site-scoped sample store
     * Structure: { siteId: { soil: {id: sampleData}, water: {}, tissue: {}, loi: {} } }
     */
    let _allSiteStores = {
        'default': { soil: {}, water: {}, tissue: {}, loi: {} }
    };

    /**
     * Site-scoped active sample IDs
     * Structure: { siteId: { soil: null, water: null, tissue: null, loi: null } }
     */
    let _allSiteActive = {
        'default': { soil: null, water: null, tissue: null, loi: null }
    };

    /**
     * Site-scoped import metadata
     * Structure: { siteId: { soil: null, water: null, tissue: null, loi: null } }
     */
    let _allSiteMeta = {
        'default': { soil: null, water: null, tissue: null, loi: null }
    };

    // ── Convenience accessors to the current site's data ──
    // These are used throughout the module so existing code doesn't change

    function _sampleStoreRef() {
        if (!_allSiteStores[_currentSite]) _initSite(_currentSite);
        return _allSiteStores[_currentSite];
    }

    function _activeSamplesRef() {
        if (!_allSiteActive[_currentSite]) _initSite(_currentSite);
        return _allSiteActive[_currentSite];
    }

    function _importMetaRef() {
        if (!_allSiteMeta[_currentSite]) _initSite(_currentSite);
        return _allSiteMeta[_currentSite];
    }

    function _initSite(siteId) {
        if (!_allSiteStores[siteId]) {
            _allSiteStores[siteId] = { soil: {}, water: {}, tissue: {}, loi: {} };
        }
        if (!_allSiteActive[siteId]) {
            _allSiteActive[siteId] = { soil: null, water: null, tissue: null, loi: null };
        }
        if (!_allSiteMeta[siteId]) {
            _allSiteMeta[siteId] = { soil: null, water: null, tissue: null, loi: null };
        }
        if (!_sites[siteId]) {
            _sites[siteId] = { label: siteId, createdAt: new Date().toISOString() };
        }
    }

    // ── Legacy aliases (used by existing code throughout the module) ──
    // These are getter proxies so all existing _sampleStore[dataType] calls work

    let _sampleStore = new Proxy({}, {
        get: function(_, prop) { return _sampleStoreRef()[prop]; },
        set: function(_, prop, val) { _sampleStoreRef()[prop] = val; return true; }
    });

    let _activeSamples = new Proxy({}, {
        get: function(_, prop) { return _activeSamplesRef()[prop]; },
        set: function(_, prop, val) { _activeSamplesRef()[prop] = val; return true; }
    });

    let _importMeta = new Proxy({}, {
        get: function(_, prop) { return _importMetaRef()[prop]; },
        set: function(_, prop, val) { _importMetaRef()[prop] = val; return true; }
    });

    // =========================================================================
    // LOGGING
    // =========================================================================

    function log(message, data) {
        if (!CONFIG.debug) return;
        if (data !== undefined) {
        } else {
        }
    }

    function warn(message, data) {
        if (data !== undefined) {
            console.warn('[SampleManager]', message, data);
        } else {
            console.warn('[SampleManager]', message);
        }
    }

    // =========================================================================
    // FIELD MAPPINGS (from lab-import.js, extended)
    // =========================================================================

    const SOIL_FIELD_MAP = {
        'pH_Water': '.gaip-soil-ph', 'pH': '.gaip-soil-ph', 'ph': '.gaip-soil-ph',
        'EC_1_5': '.gaip-soil-ec', 'EC1:5': '.gaip-soil-ec', 'EC_1:5': '.gaip-soil-ec',
        'EC1_5': '.gaip-soil-ec', 'EC_dSm': '.gaip-soil-ec', 'EC': '.gaip-soil-ec', 'ec': '.gaip-soil-ec',
        'Texture': '.gaip-soil-texture', 'texture': '.gaip-soil-texture', 'Soil_Texture': '.gaip-soil-texture',
        'CEC_meq100g': '.gaip-cec', 'CEC': '.gaip-cec', 'cec': '.gaip-cec',
        'OM_Percent': '.gaip-loi', 'Organic Matter': '.gaip-loi', 'OM': '.gaip-loi', 'LOI': '.gaip-loi',
        // Stratified OM fields (Golf Greens)
        'LOI_0_2': '.gaip-loi-0-2', 'OM_0_2': '.gaip-loi-0-2', 'LOI_0-2': '.gaip-loi-0-2', 'OM_0-2cm': '.gaip-loi-0-2',
        'LOI_2_4': '.gaip-loi-2-4', 'OM_2_4': '.gaip-loi-2-4', 'LOI_2-4': '.gaip-loi-2-4', 'OM_2-4cm': '.gaip-loi-2-4',
        'LOI_4_6': '.gaip-loi-4-6', 'OM_4_6': '.gaip-loi-4-6', 'LOI_4-6': '.gaip-loi-4-6', 'OM_4-6cm': '.gaip-loi-4-6',
        // Nutrient fields
        'K_ppm': '[data-mlsn="K"]', 'K': '[data-mlsn="K"]',
        'P_ppm': '[data-mlsn="P"]', 'P': '[data-mlsn="P"]',
        'Ca_ppm': '[data-mlsn="Ca"]', 'Ca': '[data-mlsn="Ca"]',
        'Mg_ppm': '[data-mlsn="Mg"]', 'Mg': '[data-mlsn="Mg"]',
        'S_ppm': '[data-mlsn="S"]', 'S': '[data-mlsn="S"]',
        'Fe_ppm': '[data-mlsn="Fe"]', 'Fe': '[data-mlsn="Fe"]',
        'Mn_ppm': '[data-mlsn="Mn"]', 'Mn': '[data-mlsn="Mn"]',
        'Cu_ppm': '[data-mlsn="Cu"]', 'Cu': '[data-mlsn="Cu"]',
        'Zn_ppm': '[data-mlsn="Zn"]', 'Zn': '[data-mlsn="Zn"]',
        'B_ppm': '[data-mlsn="B"]', 'B': '[data-mlsn="B"]',
        'Na_ppm': '[data-mlsn="Na"]', 'Na': '[data-mlsn="Na"]'
    };

    const WATER_FIELD_MAP = {
        'pH': '.gaip-water-ph', 'ph': '.gaip-water-ph',
        'EC_dSm': '.gaip-ecw', 'EC': '.gaip-ecw', 'ec': '.gaip-ecw',
        'Ca_mgL': '[data-ion="Ca"]', 'Ca': '[data-ion="Ca"]',
        'Mg_mgL': '[data-ion="Mg"]', 'Mg': '[data-ion="Mg"]',
        'Na_mgL': '[data-ion="Na"]', 'Na': '[data-ion="Na"]',
        'K_mgL': '[data-ion="K"]', 'K': '[data-ion="K"]',
        'Cl_mgL': '[data-ion="Cl"]', 'Cl': '[data-ion="Cl"]',
        'SO4_mgL': '[data-ion="SO4"]', 'SO4': '[data-ion="SO4"]',
        'HCO3_mgL': '[data-ion="HCO3"]', 'HCO3': '[data-ion="HCO3"]',
        'CO3_mgL': '[data-ion="CO3"]', 'CO3': '[data-ion="CO3"]',
        'B_mgL': '[data-ion="B"]', 'B': '[data-ion="B"]',
        'Fe_mgL': '[data-ion="Fe"]', 'Fe': '[data-ion="Fe"]',
        'NO3_mgL': '[data-ion="NO3"]', 'NO3': '[data-ion="NO3"]',
        'PO4_mgL': '[data-ion="PO4"]', 'PO4': '[data-ion="PO4"]', 'P_mgL': '[data-ion="PO4"]', 'P': '[data-ion="PO4"]',
        'Mn_mgL': '[data-ion="Mn"]', 'Mn': '[data-ion="Mn"]'
    };

    const TISSUE_FIELD_MAP = {
        'N_Percent': 'N', 'N': 'N',
        'P_Percent': 'P', 'P': 'P',
        'K_Percent': 'K', 'K': 'K',
        'Ca_Percent': 'Ca', 'Ca': 'Ca',
        'Mg_Percent': 'Mg', 'Mg': 'Mg',
        'S_Percent': 'S', 'S': 'S',
        'Fe_mgkg': 'Fe', 'Fe': 'Fe',
        'Mn_mgkg': 'Mn', 'Mn': 'Mn',
        'Zn_mgkg': 'Zn', 'Zn': 'Zn',
        'Cu_mgkg': 'Cu', 'Cu': 'Cu',
        'B_mgkg': 'B', 'B': 'B',
        'Na_mgkg': 'Na', 'Na': 'Na',
        'Mo_mgkg': 'Mo', 'Mo': 'Mo',
        'Cl_Percent': 'Cl', 'Cl': 'Cl'
    };

    // LOI/Stratified OM field map (separate from soil for dedicated LOI testing)
    const LOI_FIELD_MAP = {
        // Depth-based LOI (various lab formats)
        'LOI_0_2': '.gaip-loi-0-2', 'OM_0_2': '.gaip-loi-0-2', 'LOI_0-2': '.gaip-loi-0-2', 
        'OM_0-2cm': '.gaip-loi-0-2', '0-2cm': '.gaip-loi-0-2', '0-20mm': '.gaip-loi-0-2',
        'LOI_2_4': '.gaip-loi-2-4', 'OM_2_4': '.gaip-loi-2-4', 'LOI_2-4': '.gaip-loi-2-4', 
        'OM_2-4cm': '.gaip-loi-2-4', '2-4cm': '.gaip-loi-2-4', '20-40mm': '.gaip-loi-2-4',
        'LOI_4_6': '.gaip-loi-4-6', 'OM_4_6': '.gaip-loi-4-6', 'LOI_4-6': '.gaip-loi-4-6', 
        'OM_4-6cm': '.gaip-loi-4-6', '4-6cm': '.gaip-loi-4-6', '40-60mm': '.gaip-loi-4-6',
        // Overall OM (some labs report this too)
        'OM_Percent': '.gaip-loi', 'Organic Matter': '.gaip-loi', 'OM': '.gaip-loi', 'LOI': '.gaip-loi', 'Total_OM': '.gaip-loi'
    };

    // =========================================================================
    // CSV PARSER
    // =========================================================================

    function parseCSV(text) {
        const lines = text.trim().split(/\r?\n/);
        if (lines.length < 2) {
            throw new Error('CSV must have header row and at least one data row');
        }

        const headers = parseCSVLine(lines[0]);
        const rows = [];

        for (let i = 1; i < lines.length; i++) {
            if (!lines[i].trim()) continue;

            const values = parseCSVLine(lines[i]);
            const row = {};

            for (let j = 0; j < headers.length; j++) {
                row[headers[j].trim()] = values[j] ? values[j].trim() : '';
            }
            rows.push(row);
        }

        return { headers, rows };
    }

    function parseCSVLine(line) {
        const result = [];
        let current = '';
        let inQuotes = false;

        for (let i = 0; i < line.length; i++) {
            const char = line[i];
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

    // =========================================================================
    // DATA TYPE DETECTION
    // =========================================================================

    function detectDataType(headers) {
        const headerStr = headers.join(',').toLowerCase();
        const headerList = headers.map(h => h.toLowerCase().trim());

        // LOI/Stratified OM: has depth-based LOI columns without full soil nutrients
        // Check for LOI-specific patterns first (more specific than soil)
        const hasDepthLOI = headerStr.includes('loi_0') || headerStr.includes('om_0') || 
                           headerStr.includes('0-2') || headerStr.includes('0-20mm') ||
                           headerStr.includes('2-4') || headerStr.includes('20-40mm');
        const hasFullSoilNutrients = headerStr.includes('_ppm') || headerStr.includes('cec') ||
                                     (headerList.includes('k') && headerList.includes('p') && headerList.includes('ca'));
        
        if (hasDepthLOI && !hasFullSoilNutrients) {
            return 'loi';
        }

        // Tissue: has N as major element, no CEC or water indicators
        if (headerStr.includes('n_percent') || headerStr.includes('tissue') ||
            headerStr.includes('_mgkg') || headerStr.includes('clippings')) {
            return 'tissue';
        }
        if (headerList.includes('n') && !headerList.includes('cec') &&
            !headerList.includes('hco3') && !headerList.includes('sar')) {
            return 'tissue';
        }

        // Water: has water-specific columns
        if (headerStr.includes('_mgl') || headerStr.includes('hco3') ||
            headerStr.includes('source') || headerStr.includes('bore') ||
            headerStr.includes('sar') || headerStr.includes('rsc') ||
            headerStr.includes('tds')) {
            return 'water';
        }

        // Soil: has soil-specific columns
        if (headerStr.includes('cec') || headerStr.includes('_ppm') ||
            headerStr.includes('extraction') || headerStr.includes('sand_percent') ||
            headerStr.includes('om_percent') || headerStr.includes('organic matter')) {
            return 'soil';
        }

        return 'unknown';
    }

    // =========================================================================
    // SAMPLE ID GENERATION
    // =========================================================================

    function extractSampleId(row) {
        // Try various common column names for sample ID
        return row['Sample ID'] || row['Sample_ID'] || row['SampleID'] ||
               row['Sample'] || row['ID'] || row['Name'] ||
               row['Location'] || row['Zone'] || row['Area'] ||
               'Sample_' + Date.now();
    }

    function extractSampleDate(row) {
        const dateStr = row['Date'] || row['Sample_Date'] || row['SampleDate'] ||
                       row['Collection_Date'] || row['Collected'];
        if (dateStr) {
            const parsed = new Date(dateStr);
            if (!isNaN(parsed.getTime())) {
                return parsed.toISOString().split('T')[0];
            }
        }
        return new Date().toISOString().split('T')[0];
    }

    function extractNotes(row) {
        return row['Notes'] || row['Comment'] || row['Comments'] ||
               row['Description'] || '';
    }

    // =========================================================================
    // ZONE TYPE DETECTION
    // =========================================================================

    function detectZoneType(sampleId) {
        const id = sampleId.toLowerCase();
        
        if (id.includes('green') || id.includes('putting')) return 'green';
        if (id.includes('fairway') || id.includes('fwy')) return 'fairway';
        if (id.includes('tee')) return 'tee';
        if (id.includes('rough')) return 'rough';
        if (id.includes('approach')) return 'approach';
        if (id.includes('collar')) return 'collar';
        if (id.includes('bunker')) return 'bunker';
        if (id.includes('pitch') || id.includes('field')) return 'sports_pitch';
        if (id.includes('goal') || id.includes('wing')) return 'goal_area';
        if (id.includes('centre') || id.includes('center') || id.includes('midfield')) return 'centre';
        if (id.includes('bore') || id.includes('well')) return 'bore';
        if (id.includes('recycl') || id.includes('effluent')) return 'recycled';
        if (id.includes('town') || id.includes('mains') || id.includes('potable')) return 'potable';
        if (id.includes('dam') || id.includes('pond') || id.includes('lake')) return 'surface';
        
        return 'other';
    }

    // =========================================================================
    // SAMPLE IMPORT
    // =========================================================================

    /**
     * Import multiple samples from a file
     * @param {File} file - CSV or XLSX file
     * @param {Object} options - { dataType: 'soil'|'water'|'tissue'|'auto' }
     * @returns {Promise<Object>} Import result with sample count and IDs
     */
    function importFile(file, options = {}) {
        return new Promise((resolve, reject) => {
            if (!file) {
                reject(new Error('No file provided'));
                return;
            }

            const ext = file.name.split('.').pop().toLowerCase();

            if (ext === 'csv') {
                const reader = new FileReader();
                reader.onload = function(e) {
                    try {
                        const result = processImportData(e.target.result, options, file.name);
                        resolve(result);
                    } catch (err) {
                        reject(err);
                    }
                };
                reader.onerror = () => reject(new Error('Failed to read file'));
                reader.readAsText(file);
            } else if (ext === 'xlsx' || ext === 'xls') {
                if (typeof XLSX === 'undefined') {
                    reject(new Error('Excel support requires SheetJS library. Please use CSV format.'));
                    return;
                }

                const reader = new FileReader();
                reader.onload = function(e) {
                    try {
                        const workbook = XLSX.read(e.target.result, { type: 'array' });
                        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
                        const csv = XLSX.utils.sheet_to_csv(firstSheet);
                        const result = processImportData(csv, options, file.name);
                        resolve(result);
                    } catch (err) {
                        reject(err);
                    }
                };
                reader.onerror = () => reject(new Error('Failed to read file'));
                reader.readAsArrayBuffer(file);
            } else {
                reject(new Error('Unsupported file type. Please use CSV or XLSX.'));
            }
        });
    }

    // =========================================================================
    // HILL LABS CR3 FORMAT PARSER
    // =========================================================================

    /**
     * me/100g → ppm conversion factors
     * ppm (mg/kg) = me/100g × equivalent_weight × 10
     * where equivalent_weight = atomic_weight / valence
     */
    const ME_TO_PPM = {
        K:  391,    // 39.1 / 1 × 10
        Ca: 200.4,  // 40.08 / 2 × 10
        Mg: 121.55, // 24.31 / 2 × 10
        Na: 230     // 23.0 / 1 × 10
    };

    /**
     * Parse Hill Labs CR3 format CSV.
     *
     * Structure:
     *   Lines 1-28ish: metadata (lab name, job number, contacts, disclaimers)
     *   "Test Name:" row: column headers for the data
     *   "Test Code:" row: machine-readable column codes
     *   "Sample Fraction:" row: extraction method codes
     *   "Test Unit:" row: units for each column
     *   "Sample Number","Sample Name",... row: marks start of data
     *   Data rows: one per sample
     *
     * We parse Test Code row to map columns, then read data rows.
     */
    function processHillLabsCR3(csvText, options, fileName) {
        var lines = csvText.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');

        // Find the key rows by scanning for markers
        var testNameRow = null;
        var testCodeRow = null;
        var testUnitRow = null;
        var sampleHeaderRow = null;
        var dataStartRow = null;
        var jobNumber = '';
        var clientRef = '';
        var dateRegistered = '';

        for (var i = 0; i < lines.length; i++) {
            var line = lines[i];
            if (line.indexOf('"Laboratory Job Number:"') !== -1) {
                jobNumber = line.split(',')[1] ? line.split(',')[1].replace(/"/g, '').trim() : '';
            }
            if (line.indexOf('"Client Reference:"') !== -1) {
                clientRef = line.split(',')[1] ? line.split(',')[1].replace(/"/g, '').trim() : '';
            }
            if (line.indexOf('"Date Registered:"') !== -1) {
                var parts = line.split(',');
                dateRegistered = parts.slice(1).join(',').replace(/"/g, '').trim();
            }
            if (line.indexOf('"Test Name:"') !== -1) testNameRow = i;
            if (line.indexOf('"Test Code:"') !== -1) testCodeRow = i;
            if (line.indexOf('"Test Unit:"') !== -1) testUnitRow = i;
            if (line.indexOf('"Sample Number"') !== -1) {
                sampleHeaderRow = i;
                dataStartRow = i + 1;
            }
        }

        if (!testCodeRow || !dataStartRow) {
            throw new Error('Could not parse Hill Labs CR3 format: missing Test Code or Sample rows');
        }

        // Parse the Test Code row to get column codes
        var codeCols = parseCSVLine(lines[testCodeRow]);
        // Parse the Test Unit row for reference
        var unitCols = testUnitRow ? parseCSVLine(lines[testUnitRow]) : [];
        // Parse the Test Name row for human-readable names
        var nameCols = testNameRow ? parseCSVLine(lines[testNameRow]) : [];

        // Build code-to-column-index map (skip first 4 metadata columns)
        var codeIndex = {};
        for (var c = 0; c < codeCols.length; c++) {
            var code = codeCols[c].trim();
            if (code && code !== 'Test Code:') {
                codeIndex[code] = c;
            }
        }

        log('Hill Labs codes found:', Object.keys(codeIndex).join(', '));

        // Process data rows
        var importedIds = [];
        var samples = {};

        for (var r = dataStartRow; r < lines.length; r++) {
            if (!lines[r].trim()) continue;
            var vals = parseCSVLine(lines[r]);
            if (vals.length < 5) continue;

            var sampleNum = vals[0] ? vals[0].replace(/"/g, '').trim() : '';
            var sampleName = vals[1] ? vals[1].replace(/"/g, '').trim() : '';
            if (!sampleName) continue;

            // Extract values by test code
            function getVal(code) {
                if (codeIndex[code] === undefined) return null;
                var v = vals[codeIndex[code]];
                if (!v) return null;
                v = v.replace(/"/g, '').trim();
                if (v === '' || v === '-') return null;
                var num = parseFloat(v);
                return isNaN(num) ? v : num;
            }

            // Get me/100g values (preferred for ppm conversion)
            var K_me = getVal('K_me/100g');
            var Ca_me = getVal('Ca_me/100g');
            var Mg_me = getVal('Mg_me/100g');
            var Na_me = getVal('Na_me/100g');

            // Convert me/100g → ppm
            var K_ppm = K_me !== null ? Math.round(K_me * ME_TO_PPM.K) : null;
            var Ca_ppm = Ca_me !== null ? Math.round(Ca_me * ME_TO_PPM.Ca) : null;
            var Mg_ppm = Mg_me !== null ? Math.round(Mg_me * ME_TO_PPM.Mg) : null;
            var Na_ppm = Na_me !== null ? Math.round(Na_me * ME_TO_PPM.Na) : null;

            // Build a rawData object matching SOIL_FIELD_MAP keys
            var rawData = {};

            // pH
            var ph = getVal('pH');
            if (ph !== null) rawData['pH'] = ph;

            // Olsen P (mg/L) - store as P for the [data-mlsn="P"] field
            var olsenP = getVal('OP_mg/L');
            if (olsenP !== null) rawData['P'] = olsenP;

            // Sulphate S (mg/kg = ppm)
            var so4 = getVal('SO4_mg/kg');
            if (so4 !== null) rawData['S'] = so4;

            // Cations in ppm (converted from me/100g)
            if (K_ppm !== null) rawData['K'] = K_ppm;
            if (Ca_ppm !== null) rawData['Ca'] = Ca_ppm;
            if (Mg_ppm !== null) rawData['Mg'] = Mg_ppm;
            if (Na_ppm !== null) rawData['Na'] = Na_ppm;

            // CEC
            var cec = getVal('CEC');
            if (cec !== null) rawData['CEC'] = cec;

            // Volume weight (closest to bulk density)
            var vw = getVal('VW_g/mL');
            if (vw !== null) rawData['VolumeWeight'] = vw;

            // Sampling depth
            var depth = getVal('Depth');
            if (depth !== null) rawData['SamplingDepth'] = depth;

            // Base saturation
            var kSat = getVal('KSat');
            var caSat = getVal('CaSat');
            var mgSat = getVal('MgSat');
            var naSat = getVal('NaSat');
            var tBS = getVal('tBS');

            // Extractable Organic S
            var orgS = getVal('OS_mg/kg');

            // Store Hill Labs specific data for AA module reference
            rawData['_hillLabs'] = {
                jobNumber: jobNumber,
                sampleName: sampleName,
                clientRef: clientRef,
                dateRegistered: dateRegistered,
                maf: {
                    K: getVal('KMAF'),
                    Ca: getVal('CaMAF'),
                    Mg: getVal('MgMAF'),
                    Na: getVal('NaMAF')
                },
                meq: { K: K_me, Ca: Ca_me, Mg: Mg_me, Na: Na_me },
                baseSat: { K: kSat, Ca: caSat, Mg: mgSat, Na: naSat, total: tBS },
                volumeWeight: vw,
                organicS: orgS,
                kMgRatio: getVal('K/Mg')
            };

            var sampleId = sampleName || ('Sample_' + sampleNum);

            samples[sampleId] = {
                id: sampleId,
                date: dateRegistered || new Date().toISOString(),
                notes: 'Hill Labs Job ' + jobNumber + (clientRef ? ' — ' + clientRef : ''),
                zoneType: 'turf',
                rawData: rawData,
                normalized: {}
            };

            // Build normalized values
            var norm = {};
            for (var key in rawData) {
                if (key.startsWith('_')) continue;
                var val = parseFloat(rawData[key]);
                if (!isNaN(val)) norm[key] = val;
            }
            samples[sampleId].normalized = norm;

            importedIds.push(sampleId);
            log('Hill Labs sample imported:', sampleId, rawData);
        }

        if (importedIds.length === 0) {
            throw new Error('No sample data found in Hill Labs CSV');
        }

        // Store as soil type
        var dataType = 'soil';
        _importMeta[dataType] = {
            fileName: fileName,
            importDate: new Date().toISOString(),
            rowCount: importedIds.length,
            labFormat: 'Hill Labs CR3 v3.1',
            jobNumber: jobNumber
        };

        // Merge new samples into existing store (supports incremental imports)
        if (!_sampleStore[dataType]) {
            _sampleStore[dataType] = {};
        }
        var cr3Keys = Object.keys(samples);
        for (var ck = 0; ck < cr3Keys.length; ck++) {
            _sampleStore[dataType][cr3Keys[ck]] = samples[cr3Keys[ck]];
        }
        _activeSamples[dataType] = null;
        
        log('Merged ' + cr3Keys.length + ' Hill Labs samples into ' + dataType + ' store (total: ' + Object.keys(_sampleStore[dataType]).length + ')');

        // Auto-load first sample
        if (importedIds.length > 0) {
            loadSample(dataType, importedIds[0]);
        }

        // Also auto-select Ammonium Acetate methodology if available
        var methodSelect = document.querySelector('.gaip-soil-methodology');
        if (methodSelect) {
            var aaOpt = methodSelect.querySelector('option[value="ammonium_acetate"]');
            if (aaOpt && aaOpt.style.display !== 'none') {
                methodSelect.value = 'ammonium_acetate';
                methodSelect.dispatchEvent(new Event('change', { bubbles: true }));
                log('Auto-selected Ammonium Acetate methodology for Hill Labs data');
            }
        }

        document.dispatchEvent(new CustomEvent('gaip:samples-imported', {
            detail: {
                dataType: dataType,
                sampleCount: importedIds.length,
                sampleIds: importedIds,
                meta: _importMeta[dataType],
                labFormat: 'hillLabs_CR3'
            }
        }));

        return {
            dataType: dataType,
            sampleCount: importedIds.length,
            sampleIds: importedIds,
            samples: samples,
            meta: _importMeta[dataType]
        };
    }

    /**
     * Process imported CSV data into samples
     */
    function processImportData(csvText, options, fileName) {
        // ── Hill Labs CR3 format detection ──
        // Hill Labs CSVs start with "R J Hill Laboratories Ltd" and have
        // a metadata header block before the actual data rows.
        if (csvText.indexOf('R J Hill Laboratories') !== -1 ||
            csvText.indexOf('Hill Laboratories') !== -1) {
            log('Hill Labs CR3 format detected');
            return processHillLabsCR3(csvText, options, fileName);
        }

        const parsed = parseCSV(csvText);
        const dataType = options.dataType === 'auto' ? detectDataType(parsed.headers) : options.dataType;

        if (dataType === 'unknown') {
            throw new Error('Could not detect data type. Please ensure CSV headers match template format.');
        }

        // Store import metadata
        _importMeta[dataType] = {
            fileName: fileName,
            importDate: new Date().toISOString(),
            rowCount: parsed.rows.length
        };

        // Process each row as a sample
        const importedIds = [];
        const samples = {};

        for (const row of parsed.rows) {
            const sampleId = extractSampleId(row);
            const sampleDate = extractSampleDate(row);
            const notes = extractNotes(row);
            const zoneType = detectZoneType(sampleId);

            // Create normalized sample object
            const sample = {
                id: sampleId,
                label: sampleId,
                date: sampleDate,
                notes: notes,
                zoneType: zoneType,
                rawData: row,
                normalized: normalizeValues(row, dataType)
            };

            // Auto-dedup: if key already exists (e.g., same name different date), append date
            if (samples[sampleId]) {
                const dedupId = sampleId + ' (' + sampleDate + ')';
                if (samples[dedupId]) {
                    sample.id = sampleId + ' (' + sampleDate + ' ' + Date.now().toString(36).slice(-3) + ')';
                } else {
                    sample.id = dedupId;
                }
                log('Auto-dedup on import: "' + sampleId + '" → "' + sample.id + '"');
            }

            samples[sample.id] = sample;
            importedIds.push(sample.id);
            log('Imported sample:', sampleId);
        }

        // Merge new samples into existing store (supports incremental imports)
        // Samples with the same ID will be overwritten (re-import updates)
        if (!_sampleStore[dataType]) {
            _sampleStore[dataType] = {};
        }
        var sampleKeys = Object.keys(samples);
        for (var sk = 0; sk < sampleKeys.length; sk++) {
            _sampleStore[dataType][sampleKeys[sk]] = samples[sampleKeys[sk]];
        }
        
        log('Merged ' + sampleKeys.length + ' samples into ' + dataType + ' store (total: ' + Object.keys(_sampleStore[dataType]).length + ')');
        
        // Store new samples
        // (already merged above)

        // Auto-load first sample if none active
        if (!_activeSamples[dataType] && importedIds.length > 0) {
            loadSample(dataType, importedIds[0]);
        }

        // Dispatch event for UI update
        document.dispatchEvent(new CustomEvent('gaip:samples-imported', {
            detail: {
                dataType,
                sampleCount: importedIds.length,
                sampleIds: importedIds,
                meta: _importMeta[dataType]
            }
        }));

        return {
            dataType,
            sampleCount: importedIds.length,
            sampleIds: importedIds,
            samples,
            meta: _importMeta[dataType]
        };
    }

    /**
     * Normalize raw row values into consistent format
     */
    function normalizeValues(row, dataType) {
        const normalized = {};
        let fieldMap;

        switch (dataType) {
            case 'soil': fieldMap = SOIL_FIELD_MAP; break;
            case 'water': fieldMap = WATER_FIELD_MAP; break;
            case 'tissue': fieldMap = TISSUE_FIELD_MAP; break;
            case 'loi': fieldMap = LOI_FIELD_MAP; break;
            default: return normalized;
        }

        // Track which normalized keys we've already set
        const setKeys = new Set();

        for (const col in fieldMap) {
            if (row[col] !== undefined && row[col] !== '') {
                const selector = fieldMap[col];
                // Extract key from selector (e.g., '[data-mlsn="K"]' -> 'K')
                let key = selector;
                const match = selector.match(/\[data-(?:mlsn|ion|val)="(\w+)"\]/);
                if (match) {
                    key = match[1];
                } else if (selector.startsWith('.gaip-')) {
                    key = selector.replace('.gaip-', '').replace(/-/g, '_');
                }

                // Only set if we haven't already (prefer specific column names like K_ppm over K)
                if (!setKeys.has(key)) {
                    const val = parseFloat(row[col]);
                    if (!isNaN(val)) {
                        normalized[key] = val;
                        setKeys.add(key);
                    }
                }
            }
        }

        return normalized;
    }

    // =========================================================================
    // SAMPLE LOADING
    // =========================================================================

    /**
     * Load a sample into the active form fields
     * @param {string} dataType - 'soil', 'water', or 'tissue'
     * @param {string} sampleId - Sample identifier
     * @returns {Object} Load result
     */
    function loadSample(dataType, sampleId) {
        const sample = _sampleStore[dataType]?.[sampleId];
        if (!sample) {
            warn('Sample not found:', { dataType, sampleId });
            return { success: false, error: 'Sample not found' };
        }

        const populated = [];
        const container = document.querySelector('.gaip-hub-container') || document;
        let fieldMap;

        switch (dataType) {
            case 'soil': fieldMap = SOIL_FIELD_MAP; break;
            case 'water': fieldMap = WATER_FIELD_MAP; break;
            case 'tissue': fieldMap = TISSUE_FIELD_MAP; break;
            case 'loi': fieldMap = LOI_FIELD_MAP; break;
            default: return { success: false, error: 'Invalid data type' };
        }

        // Populate form fields
        if (dataType === 'tissue') {
            populated.push(...populateTissueFields(sample.rawData));
        } else {
            for (const col in fieldMap) {
                if (sample.rawData[col] !== undefined && sample.rawData[col] !== '') {
                    const selector = fieldMap[col];
                    let input = container.querySelector(selector);
                    if (!input) input = document.querySelector(selector);

                    if (input) {
                        input.value = parseFloat(sample.rawData[col]) || sample.rawData[col];
                        input.dispatchEvent(new Event('input', { bubbles: true }));
                        input.dispatchEvent(new Event('change', { bubbles: true }));
                        populated.push(col);
                    }
                }
            }
        }

        // For LOI samples, ensure the stratified OM section is visible
        if (dataType === 'loi') {
            const stratifiedSection = document.querySelector('.gaip-stratified-om-section');
            if (stratifiedSection) {
                stratifiedSection.style.display = 'block';
            }
        }

        // Set as active
        _activeSamples[dataType] = sampleId;

        // Restore the sample's date into the form date field
        // (date is stored on sample.date, not in rawData/fieldMap)
        const dateSelectors = { soil: '.gaip-soil-date', water: '.gaip-water-date', tissue: '.gaip-tissue-date' };
        const dateSelector = dateSelectors[dataType];
        if (dateSelector && sample.date) {
            const dateInput = container.querySelector(dateSelector) || document.querySelector(dateSelector);
            if (dateInput) {
                // sample.date may be full ISO string — extract YYYY-MM-DD for date input
                const dateVal = sample.date.length > 10 ? sample.date.substring(0, 10) : sample.date;
                dateInput.value = dateVal;
            }
        }

        // Dispatch event
        document.dispatchEvent(new CustomEvent('gaip:sample-loaded', {
            detail: { dataType, sampleId, sample, populated }
        }));

        log('Loaded sample:', { dataType, sampleId, fieldCount: populated.length });

        return {
            success: true,
            dataType,
            sampleId,
            sample,
            populatedFields: populated
        };
    }

    /**
     * Populate tissue fields (special handling for tissue UI)
     */
    function populateTissueFields(row) {
        const populated = [];
        const container = document.querySelector('#gaipTissueModule') ||
                         document.querySelector('.gaip-tissue-module') || document;

        // Build nutrient map
        const nutrientValues = {};
        for (const col in TISSUE_FIELD_MAP) {
            if (row[col] !== undefined && row[col] !== '') {
                const nutrient = TISSUE_FIELD_MAP[col];
                nutrientValues[nutrient] = parseFloat(row[col]);
            }
        }

        // Find and populate tissue inputs
        const tissueInputs = container.querySelectorAll('input[data-val]') ||
                            container.querySelectorAll('.gaip-inp[inputmode="decimal"]') ||
                            container.querySelectorAll('tr[data-el] input');

        tissueInputs.forEach(input => {
            let nutrient = input.dataset.val || input.getAttribute('data-val');
            if (!nutrient) {
                const tr = input.closest('tr');
                if (tr && tr.dataset.el) nutrient = tr.dataset.el;
            }

            if (nutrient && nutrientValues[nutrient] !== undefined) {
                input.value = nutrientValues[nutrient];
                input.dispatchEvent(new Event('input', { bubbles: true }));
                input.dispatchEvent(new Event('change', { bubbles: true }));
                populated.push(nutrient);
            }
        });

        return populated;
    }

    // =========================================================================
    // SAMPLE RETRIEVAL
    // =========================================================================

    /**
     * Get all samples of a given type
     */
    function getSamples(dataType) {
        return Object.values(_sampleStore[dataType] || {});
    }

    /**
     * Get sample by ID
     */
    function getSample(dataType, sampleId) {
        return _sampleStore[dataType]?.[sampleId] || null;
    }

    /**
     * Get active sample
     */
    function getActiveSample(dataType) {
        const id = _activeSamples[dataType];
        return id ? _sampleStore[dataType]?.[id] : null;
    }

    /**
     * Get active sample ID
     */
    function getActiveSampleId(dataType) {
        return _activeSamples[dataType];
    }

    /**
     * Get sample count
     */
    function getSampleCount(dataType) {
        return Object.keys(_sampleStore[dataType] || {}).length;
    }

    // =========================================================================
    // SAMPLE COMPARISON
    // =========================================================================

    /**
     * Compare multiple samples
     * @param {string} dataType - 'soil', 'water', or 'tissue'
     * @param {string[]} sampleIds - Array of sample IDs to compare
     * @returns {Object} Comparison data
     */
    function compareSamples(dataType, sampleIds) {
        const samples = sampleIds
            .map(id => _sampleStore[dataType]?.[id])
            .filter(s => s);

        if (samples.length < 2) {
            return { error: 'Need at least 2 samples to compare' };
        }

        // Get all parameter keys
        const allKeys = new Set();
        samples.forEach(s => {
            Object.keys(s.normalized).forEach(k => allKeys.add(k));
        });

        // Build comparison matrix
        const comparison = {};
        allKeys.forEach(key => {
            const values = samples.map(s => s.normalized[key] ?? null);
            const validValues = values.filter(v => v !== null);

            comparison[key] = {
                values: samples.map(s => ({
                    sampleId: s.id,
                    value: s.normalized[key] ?? null
                })),
                min: validValues.length ? Math.min(...validValues) : null,
                max: validValues.length ? Math.max(...validValues) : null,
                avg: validValues.length ? validValues.reduce((a, b) => a + b, 0) / validValues.length : null,
                range: validValues.length ? Math.max(...validValues) - Math.min(...validValues) : null,
                cv: null  // Coefficient of variation
            };

            if (validValues.length > 1 && comparison[key].avg > 0) {
                const variance = validValues.reduce((sum, v) => sum + Math.pow(v - comparison[key].avg, 2), 0) / validValues.length;
                comparison[key].cv = Math.sqrt(variance) / comparison[key].avg * 100;
            }
        });

        return {
            dataType,
            sampleIds,
            samples: samples.map(s => ({ id: s.id, date: s.date, zoneType: s.zoneType })),
            parameters: comparison
        };
    }

    // =========================================================================
    // MANUAL SAMPLE ENTRY
    // =========================================================================

    /**
     * Add a sample manually (from form data or programmatically)
     * @param {string} dataType - 'soil', 'water', or 'tissue'
     * @param {Object} sampleData - { id, date, notes, zoneType, values: {nutrient: value} }
     * @returns {Object} The created sample
     */
    function addSample(dataType, sampleData) {
        if (!dataType || !_sampleStore[dataType]) {
            throw new Error('Invalid data type: ' + dataType);
        }

        const count = getSampleCount(dataType);
        if (count >= CONFIG.maxSamples) {
            throw new Error('Maximum sample limit reached (' + CONFIG.maxSamples + ')');
        }

        // If an explicit id is provided, use it.
        // If only a label is provided (e.g. "Green 1"), derive a clean slug from it
        // so the storage key is readable ("green_1") rather than an opaque timestamp.
        // Fall back to generateSampleId only when there is nothing to work from.
        let sampleId;
        if (sampleData.id) {
            sampleId = sampleData.id;
        } else if (sampleData.label) {
            const slug = sampleData.label.toLowerCase()
                .replace(/[^a-z0-9]+/g, '_')
                .replace(/^_|_$/g, '');
            sampleId = slug || generateSampleId(dataType);
        } else {
            sampleId = generateSampleId(dataType);
        }

        const sample = {
            id: sampleId,
            label: sampleData.label || sampleId,
            date: sampleData.date || new Date().toISOString().split('T')[0],
            notes: sampleData.notes || '',
            zoneType: sampleData.zoneType || detectZoneType(sampleId),
            rawData: sampleData.values || {},
            normalized: normalizeValues(sampleData.values || {}, dataType),
            source: 'manual'
        };

        // Auto-dedup: if key already exists, append date to make unique
        if (_sampleStore[dataType][sampleId]) {
            const dateStr = sample.date || new Date().toISOString().split('T')[0];
            const dedupId = sampleId + ' (' + dateStr + ')';
            // If date-appended also exists, add time
            if (_sampleStore[dataType][dedupId]) {
                sample.id = sampleId + ' (' + dateStr + ' ' + new Date().toISOString().split('T')[1].slice(0,5) + ')';
            } else {
                sample.id = dedupId;
            }
            log('Auto-dedup: "' + sampleId + '" → "' + sample.id + '"');
        }

        _sampleStore[dataType][sample.id] = sample;
        _activeSamples[dataType] = sample.id;

        log('Added manual sample:', sampleId);

        document.dispatchEvent(new CustomEvent('gaip:sample-added', {
            detail: { dataType, sampleId, sample }
        }));

        return sample;
    }

    /**
     * Generate a unique sample ID
     */
    function generateSampleId(dataType) {
        const prefix = dataType.charAt(0).toUpperCase() + dataType.slice(1);
        const count = getSampleCount(dataType) + 1;
        const timestamp = Date.now().toString(36).slice(-4);
        return `${prefix}_${count}_${timestamp}`;
    }

    /**
     * Capture current form values as a new sample
     * @param {string} dataType - 'soil', 'water', 'tissue', or 'loi'
     * @param {string} sampleId - Optional sample ID (auto-generated if not provided)
     * @returns {Object} The created sample
     */
    function captureFromForm(dataType, sampleId = null) {
        let values = {};

        if (dataType === 'soil') {
            values = captureSoilForm();
        } else if (dataType === 'water') {
            values = captureWaterForm();
        } else if (dataType === 'tissue') {
            values = captureTissueForm();
        } else if (dataType === 'loi') {
            values = captureLOIForm();
        }

        // Check if we have any values
        const hasValues = Object.values(values).some(v => v !== null && v !== '' && v !== undefined);
        if (!hasValues) {
            throw new Error('No values found in form. Please enter data first.');
        }

        // Read date from the manual date picker if available
        const dateSelectors = {
            'soil': '.gaip-soil-date',
            'water': '.gaip-water-date',
            'tissue': '.gaip-tissue-date'
        };
        const dateInput = dateSelectors[dataType] 
            ? document.querySelector(dateSelectors[dataType]) 
            : null;
        const testDate = dateInput?.value || null;

        return addSample(dataType, {
            id: sampleId,
            date: testDate,
            values: values
        });
    }

    /**
     * Capture LOI/Stratified OM form values
     */
    function captureLOIForm() {
        const values = {};
        
        // Overall OM
        const omInput = document.querySelector('.gaip-loi');
        if (omInput?.value) values.OM = parseFloat(omInput.value);

        // Stratified OM fields
        const loi02Input = document.querySelector('.gaip-loi-0-2');
        const loi24Input = document.querySelector('.gaip-loi-2-4');
        const loi46Input = document.querySelector('.gaip-loi-4-6');
        
        if (loi02Input?.value) values.LOI_0_2 = parseFloat(loi02Input.value);
        if (loi24Input?.value) values.LOI_2_4 = parseFloat(loi24Input.value);
        if (loi46Input?.value) values.LOI_4_6 = parseFloat(loi46Input.value);

        return values;
    }

    /**
     * Capture soil form values
     */
    function captureSoilForm() {
        const values = {};
        
        // pH, EC, CEC, OM
        const phInput = document.querySelector('.gaip-soil-ph');
        const ecInput = document.querySelector('.gaip-soil-ec');
        const cecInput = document.querySelector('.gaip-cec');
        const omInput = document.querySelector('.gaip-loi');
        
        if (phInput?.value) values.pH = parseFloat(phInput.value);
        if (ecInput?.value) values.EC = parseFloat(ecInput.value);
        if (cecInput?.value) values.CEC = parseFloat(cecInput.value);
        if (omInput?.value) values.OM = parseFloat(omInput.value);

        // Stratified OM fields (Golf Greens)
        const loi02Input = document.querySelector('.gaip-loi-0-2');
        const loi24Input = document.querySelector('.gaip-loi-2-4');
        const loi46Input = document.querySelector('.gaip-loi-4-6');
        
        if (loi02Input?.value) values.LOI_0_2 = parseFloat(loi02Input.value);
        if (loi24Input?.value) values.LOI_2_4 = parseFloat(loi24Input.value);
        if (loi46Input?.value) values.LOI_4_6 = parseFloat(loi46Input.value);

        // MLSN nutrients
        document.querySelectorAll('[data-mlsn]').forEach(input => {
            const nutrient = input.dataset.mlsn;
            if (input.value) {
                values[nutrient] = parseFloat(input.value);
            }
        });

        return values;
    }

    /**
     * Capture water form values
     */
    function captureWaterForm() {
        const values = {};
        
        // pH, EC
        const phInput = document.querySelector('.gaip-water-ph');
        const ecInput = document.querySelector('.gaip-ecw');
        
        if (phInput?.value) values.pH = parseFloat(phInput.value);
        if (ecInput?.value) values.EC = parseFloat(ecInput.value);

        // Ion values
        document.querySelectorAll('[data-ion]').forEach(input => {
            const ion = input.dataset.ion;
            if (input.value) {
                values[ion] = parseFloat(input.value);
            }
        });

        return values;
    }

    /**
     * Capture tissue form values
     */
    function captureTissueForm() {
        const values = {};
        
        // Tissue inputs have data-val attribute or are in rows with data-el
        document.querySelectorAll('.gaip-tissue-input, [data-val]').forEach(input => {
            let nutrient = input.dataset.val || input.getAttribute('data-val');
            if (!nutrient) {
                const tr = input.closest('tr');
                if (tr?.dataset.el) nutrient = tr.dataset.el;
            }
            
            if (nutrient && input.value) {
                values[nutrient] = parseFloat(input.value);
            }
        });

        return values;
    }

    /**
     * Update an existing sample with new values
     * @param {string} dataType - 'soil', 'water', or 'tissue'
     * @param {string} sampleId - Sample ID to update
     * @param {Object} newValues - Values to merge/update
     */
    function updateSample(dataType, sampleId, newValues) {
        const sample = _sampleStore[dataType]?.[sampleId];
        if (!sample) {
            throw new Error('Sample not found: ' + sampleId);
        }

        // Extract _capturedDate before merging (don't pollute rawData with it)
        const capturedDate = newValues._capturedDate || null;
        const cleanValues = Object.assign({}, newValues);
        delete cleanValues._capturedDate;

        // Merge raw data
        sample.rawData = { ...sample.rawData, ...cleanValues };
        sample.normalized = normalizeValues(sample.rawData, dataType);
        // Only update date if one was explicitly captured from the form
        if (capturedDate) sample.date = capturedDate;
        sample.updatedAt = new Date().toISOString();

        log('Updated sample:', sampleId);

        document.dispatchEvent(new CustomEvent('gaip:sample-updated', {
            detail: { dataType, sampleId, sample }
        }));

        return sample;
    }

    // =========================================================================
    // SAMPLE MANAGEMENT
    // =========================================================================

    /**
     * Delete a sample
     */
    function deleteSample(dataType, sampleId) {
        if (_sampleStore[dataType]?.[sampleId]) {
            delete _sampleStore[dataType][sampleId];
            if (_activeSamples[dataType] === sampleId) {
                _activeSamples[dataType] = null;
            }
            document.dispatchEvent(new CustomEvent('gaip:sample-deleted', {
                detail: { dataType, sampleId }
            }));
            return true;
        }
        return false;
    }

    /**
     * Rename a sample (change its ID/label).
     * Creates a new entry under the new ID, copies all data, and removes the old one.
     * @param {string} dataType - 'soil', 'water', 'tissue', or 'loi'
     * @param {string} oldId - Current sample ID
     * @param {string} newId - New sample ID/name
     * @returns {Object|null} The renamed sample, or null if failed
     */
    function renameSample(dataType, oldId, newName) {
        if (!_sampleStore[dataType]?.[oldId]) {
            log('Rename failed: sample not found:', oldId);
            return null;
        }
        if (!newName || !newName.trim()) {
            log('Rename failed: empty new name');
            return null;
        }
        newName = newName.trim();

        const sample = _sampleStore[dataType][oldId];
        sample.label = newName;
        sample.renamedAt = new Date().toISOString();

        log('Renamed sample label:', oldId, '→', newName);

        document.dispatchEvent(new CustomEvent('gaip:sample-renamed', {
            detail: { dataType, sampleId: oldId, oldLabel: oldId, newLabel: newName, sample }
        }));

        return sample;
    }

    /**
     * Clear all samples of a type
     */
    function clearSamples(dataType) {
        _sampleStore[dataType] = {};
        _activeSamples[dataType] = null;
        _importMeta[dataType] = null;
        document.dispatchEvent(new CustomEvent('gaip:samples-cleared', {
            detail: { dataType }
        }));
    }

    /**
     * Clear all samples (current site only)
     */
    function clearAllSamples() {
        var store = _sampleStoreRef();
        var active = _activeSamplesRef();
        var meta = _importMetaRef();
        var types = ['soil', 'water', 'tissue', 'loi'];
        for (var i = 0; i < types.length; i++) {
            store[types[i]] = {};
            active[types[i]] = null;
            meta[types[i]] = null;
        }
        document.dispatchEvent(new CustomEvent('gaip:all-samples-cleared'));
    }

    // =========================================================================
    // EXPORT FOR WORD DOCUMENT
    // =========================================================================

    /**
     * Get all samples formatted for Word export
     */
    function getExportData() {
        return {
            soil: {
                samples: getSamples('soil'),
                active: getActiveSample('soil'),
                meta: _importMeta.soil
            },
            water: {
                samples: getSamples('water'),
                active: getActiveSample('water'),
                meta: _importMeta.water
            },
            tissue: {
                samples: getSamples('tissue'),
                active: getActiveSample('tissue'),
                meta: _importMeta.tissue
            }
        };
    }

    /**
     * Get summary statistics for all samples of a type
     */
    function getSummaryStats(dataType) {
        const samples = getSamples(dataType);
        if (samples.length === 0) return null;

        const allKeys = new Set();
        samples.forEach(s => Object.keys(s.normalized).forEach(k => allKeys.add(k)));

        const stats = {};
        allKeys.forEach(key => {
            const values = samples.map(s => s.normalized[key]).filter(v => v !== undefined && v !== null);
            if (values.length > 0) {
                stats[key] = {
                    count: values.length,
                    min: Math.min(...values),
                    max: Math.max(...values),
                    avg: values.reduce((a, b) => a + b, 0) / values.length,
                    median: getMedian(values)
                };
            }
        });

        return {
            sampleCount: samples.length,
            zoneTypes: [...new Set(samples.map(s => s.zoneType))],
            parameters: stats
        };
    }

    function getMedian(arr) {
        const sorted = [...arr].sort((a, b) => a - b);
        const mid = Math.floor(sorted.length / 2);
        return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
    }

    // =========================================================================
    // INITIALIZATION
    // =========================================================================

    function init() {
        log('Sample Manager v' + CONFIG.version + ' initialized');

        // b35fix268: one-time correction for known brentford_fc label corruption.
        // Root cause: a prior session stored "Campbelltown Sports Stadium" as the
        // label for the brentford_fc site key, likely via an interrupted save during
        // a site switch. Correct and re-persist if detected.
        (function _fixBrentfordFcLabel() {
            var cleanupKey = 'gilba_site_label_fix_b35fix268';
            try {
                if (localStorage.getItem(cleanupKey)) return;
                // Read from namespaced storage — key is gilba_gaip_gilba_samples
                var nsPrefix = (window.GILBA_PLUGIN_NS ? 'gilba_' + window.GILBA_PLUGIN_NS + '_' : '');
                var rawKey = nsPrefix + 'gilba_samples';
                var raw = localStorage.getItem(rawKey);
                if (!raw) { localStorage.setItem(cleanupKey, '1'); return; }
                var data = JSON.parse(raw);
                if (data && data.sites && data.sites['brentford_fc'] &&
                    data.sites['brentford_fc'].label === 'Campbelltown Sports Stadium') {
                    data.sites['brentford_fc'].label = 'Brentford FC';
                    localStorage.setItem(rawKey, JSON.stringify(data));
                    log('b35fix268: corrected brentford_fc label from "Campbelltown Sports Stadium" to "Brentford FC"');
                }
                localStorage.setItem(cleanupKey, '1');
            } catch(e) { /* non-critical — ignore */ }
        })();

        // Listen for legacy lab import events and add to store
        document.addEventListener('gaip:dataImported', function(e) {
            const { dataType, sampleId, row } = e.detail;
            if (dataType && sampleId && row) {
                const sample = {
                    id: sampleId,
                    date: extractSampleDate(row),
                    notes: extractNotes(row),
                    zoneType: detectZoneType(sampleId),
                    rawData: row,
                    normalized: normalizeValues(row, dataType)
                };
                _sampleStore[dataType][sampleId] = sample;
                _activeSamples[dataType] = sampleId;
                log('Added sample from legacy import:', sampleId);
            }
        });
    }

    // Initialize on DOM ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        setTimeout(init, 100);
    }

    // =========================================================================
    // EXPORTS
    // =========================================================================

    global.GAIP_SampleManager = {
        // Core operations
        importFile,
        loadSample,
        getSamples,
        getSample,
        getActiveSample,
        getActiveSampleId,
        getSampleCount,
        
        // Manual entry
        addSample,
        setZoneType: function(dataType, sampleId, newZoneType) {
            const sample = _sampleStore[dataType]?.[sampleId];
            if (!sample) throw new Error('Sample not found: ' + sampleId);
            sample.zoneType = newZoneType;
            document.dispatchEvent(new CustomEvent('gaip:sample-updated', {
                detail: { dataType, sampleId, sample }
            }));
            return sample;
        },
        captureFromForm,
        // Returns raw form values for a given dataType without creating a new sample.
        // Used by the Update button to overwrite an existing sample in-place.
        captureRawForm: function(dataType) {
            let values = null;
            if (dataType === 'soil') values = captureSoilForm();
            else if (dataType === 'water') values = captureWaterForm();
            else if (dataType === 'tissue') values = captureTissueForm();
            else if (dataType === 'loi') values = captureLOIForm();
            if (!values) return null;
            // Also capture the date field so Update preserves it per-sample
            const dateSelectors = { soil: '.gaip-soil-date', water: '.gaip-water-date', tissue: '.gaip-tissue-date' };
            const dateInput = dateSelectors[dataType] ? document.querySelector(dateSelectors[dataType]) : null;
            if (dateInput && dateInput.value) values._capturedDate = dateInput.value;
            return values;
        },
        updateSample,
        
        // Comparison
        compareSamples,
        getSummaryStats,
        
        // Management
        deleteSample,
        renameSample,
        clearSamples,
        clearAllSamples,
        
        // Export
        getExportData,
        
        // Persistence support (all sites)
        getAllSamples: function() {
            return {
                allSites: JSON.parse(JSON.stringify(_allSiteStores)),
                allActive: JSON.parse(JSON.stringify(_allSiteActive)),
                allMeta: JSON.parse(JSON.stringify(_allSiteMeta)),
                sites: JSON.parse(JSON.stringify(_sites)),
                currentSite: _currentSite
            };
        },
        
        restoreFromPersistence: function(data) {
            var restoredCount = 0;

            // v2: site-aware format
            if (data && data.allSites) {
                _sites = data.sites || { 'default': { label: 'My Site', createdAt: new Date().toISOString() } };
                _allSiteStores = data.allSites;
                _allSiteActive = data.allActive || {};
                _allSiteMeta = data.allMeta || {};
                _currentSite = data.currentSite || 'default';
                _initSite(_currentSite);

                var siteKeys = Object.keys(_allSiteStores);
                for (var s = 0; s < siteKeys.length; s++) {
                    var siteStore = _allSiteStores[siteKeys[s]];
                    var types = ['soil', 'water', 'tissue', 'loi'];
                    for (var t = 0; t < types.length; t++) {
                        if (siteStore[types[t]]) {
                            restoredCount += Object.keys(siteStore[types[t]]).length;
                        }
                    }
                }
                log('Restored ' + restoredCount + ' samples across ' + siteKeys.length + ' sites (active: ' + _currentSite + ')');
            }
            // v1: legacy flat format (backwards compatible)
            else if (data && data.store) {
                _initSite('default');
                var types = ['soil', 'water', 'tissue', 'loi'];
                for (var i = 0; i < types.length; i++) {
                    var dt = types[i];
                    if (data.store[dt] && Object.keys(data.store[dt]).length > 0) {
                        _allSiteStores['default'][dt] = data.store[dt];
                        restoredCount += Object.keys(data.store[dt]).length;
                    }
                    if (data.active && data.active[dt]) {
                        _allSiteActive['default'][dt] = data.active[dt];
                    }
                    if (data.meta && data.meta[dt]) {
                        _allSiteMeta['default'][dt] = data.meta[dt];
                    }
                }
                _currentSite = 'default';
                log('Restored ' + restoredCount + ' samples from legacy format into default site');
            }
            
            if (restoredCount > 0) {
                document.dispatchEvent(new CustomEvent('gaip:samples-restored', {
                    detail: { count: restoredCount, site: _currentSite }
                }));
            }
            return restoredCount > 0;
        },
        
        // Site management
        getActiveSiteId: function() { return _currentSite; },
        getActiveSiteLabel: function() { return (_sites[_currentSite] || {}).label || _currentSite; },
        getSiteList: function() {
            var list = [];
            var keys = Object.keys(_sites);
            for (var i = 0; i < keys.length; i++) {
                list.push({ id: keys[i], label: _sites[keys[i]].label, createdAt: _sites[keys[i]].createdAt });
            }
            return list;
        },
        
        setActiveSite: function(siteId) {
            if (!_sites[siteId]) {
                warn('Site not found: ' + siteId);
                return false;
            }
            _currentSite = siteId;
            _initSite(siteId);
            log('Switched to site: ' + siteId + ' (' + (_sites[siteId].label || siteId) + ')');

            var cfg = global.GAIP_HUB_CONFIG || {};
            if (/^\d+$/.test(String(siteId)) && typeof fetch === 'function' && cfg.csrfToken) {
                fetch((cfg.restUrl || '/api/') + 'active-site', {
                    method: 'PATCH',
                    credentials: 'same-origin',
                    headers: {
                        'Accept': 'application/json',
                        'Content-Type': 'application/json',
                        'X-CSRF-TOKEN': cfg.csrfToken
                    },
                    body: JSON.stringify({ site_id: Number(siteId) })
                }).catch(function(err) {
                    warn('Failed to sync active site to backend', err);
                });
            }

            document.dispatchEvent(new CustomEvent('gaip:site-changed', {
                detail: { siteId: siteId, label: _sites[siteId].label }
            }));
            return true;
        },
        
        addSite: function(label) {
            var id = label.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '') || 'site_' + Date.now();
            // Ensure unique
            if (_sites[id]) {
                id = id + '_' + Date.now();
            }
            _sites[id] = { label: label, createdAt: new Date().toISOString() };
            _initSite(id);
            log('Added site: ' + id + ' (' + label + ')');
            document.dispatchEvent(new CustomEvent('gaip:site-added', {
                detail: { siteId: id, label: label }
            }));
            return id;
        },

        // Recovery path: add a site with a specific known ID (used when reconstructing
        // from gilba_hub_site_configs after gilba_samples is wiped)
        addSiteWithId: function(id, label) {
            if (_sites[id]) return id; // already exists
            _sites[id] = { label: label, createdAt: new Date().toISOString(), recovered: true };
            _initSite(id);
            log('Recovered site: ' + id + ' (' + label + ')');
            document.dispatchEvent(new CustomEvent('gaip:site-added', {
                detail: { siteId: id, label: label }
            }));
            return id;
        },
        
        renameSite: function(siteId, newLabel) {
            if (!_sites[siteId]) return false;
            _sites[siteId].label = newLabel;
            document.dispatchEvent(new CustomEvent('gaip:site-renamed', {
                detail: { siteId: siteId, label: newLabel }
            }));
            return true;
        },

        // Migrate a site to a new ID (e.g. promote 'default' to a real slug).
        // Copies all samples, meta, and active pointers then resets the old ID.
        migrateSiteId: function(oldId, newLabel) {
            if (!_sites[oldId]) { warn('migrateSiteId: source not found:', oldId); return null; }
            var newId = newLabel.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '') || 'site_' + Date.now();
            if (_sites[newId]) newId = newId + '_' + Date.now();

            // Copy site record
            _sites[newId] = Object.assign({}, _sites[oldId], { label: newLabel });
            _initSite(newId);

            // Copy sample stores
            if (_allSiteStores[oldId]) {
                _allSiteStores[newId] = JSON.parse(JSON.stringify(_allSiteStores[oldId]));
            }
            if (_allSiteActive[oldId]) {
                _allSiteActive[newId] = Object.assign({}, _allSiteActive[oldId]);
            }
            if (_allSiteMeta[oldId]) {
                _allSiteMeta[newId] = Object.assign({}, _allSiteMeta[oldId]);
            }

            // If old site was current, switch to new
            if (_currentSite === oldId) {
                _currentSite = newId;
            }

            // Reset old site to blank (if it's 'default', keep it but clear data)
            if (oldId === 'default') {
                _sites['default'] = { label: 'Default Site', createdAt: new Date().toISOString() };
                _initSite('default');
                _allSiteStores['default'] = {};
                _allSiteActive['default'] = {};
            } else {
                delete _sites[oldId];
                delete _allSiteStores[oldId];
                delete _allSiteActive[oldId];
                delete _allSiteMeta[oldId];
            }

            log('Migrated site', oldId, '->', newId, '(' + newLabel + ')');
            document.dispatchEvent(new CustomEvent('gaip:site-added', {
                detail: { siteId: newId, label: newLabel }
            }));
            return newId;
        },
        
        removeSite: function(siteId) {
            if (siteId === 'default') { warn('Cannot remove default site'); return false; }
            if (!_sites[siteId]) return false;
            delete _sites[siteId];
            delete _allSiteStores[siteId];
            delete _allSiteActive[siteId];
            delete _allSiteMeta[siteId];
            if (_currentSite === siteId) {
                _currentSite = 'default';
                _initSite('default');
            }
            log('Removed site: ' + siteId);
            document.dispatchEvent(new CustomEvent('gaip:site-removed', {
                detail: { siteId: siteId }
            }));
            return true;
        },
        
        // Utilities
        detectDataType,
        detectZoneType,
        normalizeValues,
        
        // Version
        version: CONFIG.version
    };

})(window);
