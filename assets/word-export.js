/**
 * Gilba Hub Word Export Module
 * Exports analysis results to .docx format
 *
 * Version 2.4.0 (b35fix302b) - Nutrition engine delegation
 *   - collectData() nutrition block now delegates to NutritionRequirementEngine_Pure
 *   - Retired the monthlyN recalc-at-export workaround (used non-canonical σ=7/7
 *     Gaussian). Engine uses canonical PACE (σ=5.5 C3, σ=7 C4 per Gelernter &
 *     Stowell 2005) — numeric output for users who previously hit the recalc
 *     path will shift, but in the direction of correctness.
 *   - Climate engine live data preferred; latitude-band fallback preserved for
 *     robustness during programmatic site-switching in combined export.
 *   - Legacy GAIP_NUTRITION_SOIL_CACHE read preserved as last-resort fallback
 *     for environments where the engine fails to load. Log line identifies
 *     which path fired: `via engine` | `via legacy cache`.
 *     b35fix329: legacy fallback removed. Engine path is mandatory; if it
 *     doesn't fire the section is dropped (hasData=false) and a warn is
 *     logged. Mirrors combined-export hard-fail rule.
 *
 * Version 2.3.0 - Nutrient Trend Analysis Section
 *   - NEW: Nutrient Trend Analysis section after N Program Validation
 *   - Collects trend data from GilbaNutrientTrend.getTrendExportData()
 *   - Per-zone summary table: latest/previous values, direction, threshold margin, crossing risk
 *   - Rows sorted by severity (declining + imminent risk first)
 *   - Sparkline PNGs generated via renderTrendChart() → svgStringToBase64Png() pipeline
 *   - Sparklines show MLSN/SLAN threshold dashed line for visual reference
 *   - Requires ≥2 soil samples per zone to generate trend data
 *   - Added TOC entry for Nutrient Trend Analysis
 *
 * Version 2.2.0 - AI-Assisted Interpretation
 *   - NEW: Includes Claude-generated soil interpretation in Word export
 *   - Reads from window.GAIP_SOIL_INTERPRETATION (cached when user clicks "Interpret")
 *   - Adds AI narrative section after standard soil interpretation
 *   - Includes citation references and disclaimer
 *   - Supports MLSN, SLAN, and Ammonium Acetate methodologies
 *
 * Version 2.1.9 - Fix Nutrition Program Export
 *   - Fixed month names (month_name vs month field)
 *   - Fixed product names in Annual Summary (nested product object)
 *   - Fixed totalKg/totalKgHa/totalLHa field access
 *   - Fixed nutrients/totalDelivered field access
 *
 * Version 2.1.8 - Species-Specific pH Tolerance
 *   - Uses SPECIES_PH_TOLERANCE data from hub-tissue-v3.js when available
 *   - pH recommendations now reference species optimal AND tolerance ranges
 *   - Shows acid-tolerant / alkaline-tolerant flags for each species
 *   - More nuanced recommendations based on species-specific thresholds
 *
 * Version 2.1.7 - Ammonium Acetate Extractant Compatibility
 *   - Skip MLSN/SLAN dual interpretation table for Ammonium Acetate methodology
 *   - MLSN guidelines are calibrated for Mehlich-3 extractant, not NH₄OAc
 *   - Shows explanatory note for NZ users using Hill Labs results
 *   - Prevents misleading comparison between incompatible extractant methods
 *
 * Version 2.1.6 - Enhanced Bentgrass Cultivar Debug Logging
 *   - Added detailed logging for varietyData structure detection
 *   - Added logging for regional traits resolution process
 *   - Added logging for disease traits detection  
 *   - Added logging for final profile content summary
 *   - Helps diagnose why NTEP bentgrass traits may not appear
 *
 * Version 2.1.5 - Nutrition Program & Cultivar Profile Improvements
 *   - NEW: Nutrition Program section with monthly product recommendations
 *   - Collects product data from GAIP_NUTRITION_PROGRAM global
 *   - Annual Product Summary table with N/K delivered
 *   - Monthly Schedule showing products, rates, and coverage
 *   - Fixed cultivar profile for NTEP varieties (Oakley, etc.) that use regionalTraits
 *   - Both collectData() and generateCultivarProfile() now resolve regionalTraits
 *   - Added debug logging for cultivar profile generation
 *
 * Version 2.1.4 - Page Break Optimization
 *   - Added page break before Annual Nutrient Requirements (keeps heading at top of page)
 *   - Added page break before Water Quality (keeps heading at top of page)
 *   - Removed unnecessary page break before Shade & Light (was causing blank page)
 *   - Added page break before Leaching Requirement (keeps table together)
 *   - Removed page break before Cultivar Performance (flows after Performance Impact Analysis)
 *   - Added page break before Report Metadata (keeps on separate page)
 *
 * Version 2.1.3 - Primary Threat Prefers Validated Diseases
 *   - Primary Threat now shows highest validated disease, not beta
 *   - If beta disease is higher risk, adds explanatory note
 *   - Overall risk score based on validated diseases when available
 *
 * Version 2.1.2 - Beta Disease Model Documentation
 *   - Chart note explains dashed lines indicate beta models
 *   - Disease Details clarifies beta = peer-reviewed but limited field calibration
 *   - Encourages outcome reporting to improve model confidence
 *
 * Version 2.1.1 - Larger Disease Forecast Chart
 *   - Increased disease chart dimensions (620x480) for better 8-day forecast readability
 *   - Disease bars and legend now render larger in Word document
 *
 * Version 2.1.0 - Expanded Moisture Management Section
 *   - NEW: Water Balance Parameters subsection (TAW, RAW, MAD, soil type, root depth)
 *   - NEW: Evapotranspiration Analysis (ET0, Kc, ETc, variety modifier)
 *   - NEW: 7-Day Irrigation Schedule table (daily ET, rain, depletion, status)
 *   - NEW: Runtime Calculations when irrigation is recommended
 *   - NEW: Leaching Requirement section when water quality requires it
 *   - NEW: Full overseed species explanation for irrigation decisions
 *   - NEW: Irrigation actions now appear in Executive Summary Priority Actions
 *   - NEW: Zone trend indicators (↓ drying, → stable, ↑ wetting) in sensor section
 *   - NEW: Zone-specific recommendations for moisture management
 *   - Enhanced: Cumulative water balance chart integration
 *   - Enhanced: Cross-references to water quality impacts on irrigation
 *
 * Version 2.0.30 - Added Phytotoxicity section
 *   - Collects GAIP_PHYTOTOXICITY_RESULT from cascade orchestrator
 *   - New section: Phytotoxicity Risk (after Water Quality, before Soil × Water Interactions)
 *   - Shows overall risk level, individual ion assessments (Na, Cl, B, HCO3)
 *   - Displays thresholds, exposure pathway, potential damage, recommendations
 *   - Priority actions summary with severity-colored bullets
 *   - Sources: Ayers & Westcot 1985 FAO 29, Carrow & Duncan 1998, Harivandi 1999
 *
 * Version 2.0.30 - Amendment engine wired into collectData + buildSections
 *   - data.amendment object populated from GilbaSoilTissueIntegration.recommendSoilAmendments()
 *   - New section: Soil Amendment Recommendations (between Soil and Water Quality)
 *   - Ca and Mg product blocks: pathway, primary product, rate, urgency, modifying factors, rationale
 *   - Ca-Mg interaction warnings rendered
 *
 * Version 2.0.29 - Fixed patch interception for collectData/buildSections
 *   - Changed internal calls to use GAIP_WordExport.collectData() instead of local function
 *   - Changed internal calls to use GAIP_WordExport.buildSections() instead of local function
 *   - This allows scenario-patch and export-metadata-patch to properly intercept calls
 *   - BUG FIX: Scenario comparison section now actually renders in Word document
 *
 * Version 2.0.28 - Exposed buildSections for patch integration
 *   - Added buildSections to GAIP_WordExport export
 *   - Enables scenario-patch to inject scenario comparison section
 *
 * Version 2.0.27 - Export metadata integration
 *   - Added data quality badge after executive summary
 *   - Added full metadata section before glossary (citations, assumptions, disclaimer)
 *   - Integrates with GilbaExportMetadata for audit-ready outputs
 *
 * Version 2.0.26 - Fixed toFixed errors on undefined values
 *   - Added safeToFixed() helper function to prevent "Cannot read properties of undefined" errors
 *   - Salinity section now handles missing/undefined values gracefully
 *   - All numeric formatting now uses safe fallbacks
 *
 * Version 2.0.25 - Fixed nutritionSummary minification bug
 *   - Added Annual Nutrient Requirements section (P, K, S with status)
 *   - Added Monthly N Distribution (GP-Weighted) table
 *   - Uses proper function names (createKeyValueRow, createTable) instead of minified names
 *   - Fixed "I is not a function" error caused by variable shadowing in minified code
 *
 * Version 2.0.11 - Evidence-based disease risk drivers
 *   - Replaced N:Fe ratio (not evidence-based) with K:N ratio
 *   - K:N ratio <0.5 increases disease risk (Carrow, PACE Turf, Turgeon)
 *   - Fixed tissue N display: now shows % not ppm
 *   - Added knStatus from tissueNutrients.modifiers.KN_ratio
 *
 * Version 2.0.10 - Disease inputs structure fix
 *   - Fixed nitrogen extraction: nitrogen is object with {status, value, ratio}
 *   - Fixed dew data path: uses dewData.leafWetness.totalWetHours
 *   - Added disease hasData flag (was missing, broke TOC and section display)
 *   - Enhanced N display: shows tissue value (ppm) and N ratio when available
 *
 * Version 2.0.8 - Complete engine wiring transparency (Tier 1 #7)
 *   - NEW: Salinity Impact section showing ECw, threshold, growth penalty, recovery extension
 *   - NEW: Disease Risk Drivers showing N status, DLI deficit, wet hours driving risk
 *   - Enhanced Traffic section with full recovery modifiers (salinity, shade, temperature, growth)
 *   - Fallback to wear-recovery engine data when orchestrator not available
 *   - Captures compound shade×traffic effects
 *   - Includes engine recommendations in export
 *
 * Version 2.0.7 - Environmental stress factors affecting recovery
 *   - Added stress impact table (shade, salinity, temperature) to Traffic & Wear section
 *   - Shows base vs adjusted recovery probability and days
 *   - Includes warning messages from orchestrator
 *
 * Version 2.0.6 - Golf turf type labels, hide traffic for golf
 *   - Fixed "Sports Field" showing for golf greens - now shows "Golf - Greens"
 *   - Combines turfType + subCategory for proper golf labels
 *   - Hides Traffic & Wear Analysis section for golf turf types
 *   - Added rawTurfType for internal type checking
 * 
 * Version 2.0.5 - Overseed transition clarity + PGR enhancements
 *   - Overseed section title changes to "Overseed Transition Status" during summer
 *   - Removed confusing "Do NOT reseed" message - now focuses on C4 recovery
 *   - Hides irrelevant fields (wear tolerance, germination) during transition
 *   - PGR surface type and threshold validation rows added
 * 
 * Version 2.0.4 - PGR surface category and threshold validation
 *   - Added Surface Type row showing mowing height category (e.g., "Athletic/Sports (20-40mm) @ 25mm HOC")
 *   - Added Threshold validation status (research-validated vs extrapolated)
 *   - Shows source citation for threshold values
 * 
 * Version 2.0.3 - Enhanced explanations and beta model labels
 *   - Expanded Water Balance section with methodology explanation
 *   - Expanded Soil Moisture Zones with VWC/TDR methodology
 *   - Expanded Traffic & Wear Analysis with comprehensive guidance
 *   - Added (BETA) labels for Bipolaris/Curvularia/Drechslera disease models
 *   - Fixed floating point precision for Boron (0.24 not 0.24000000000000002)
 *   - Fixed Bicarbonate label to include subscript (HCO₃)
 * 
 * Version 2.0.2 - SAR/RSC calculation from ion data
 *   - Added SAR calculation when waterResults doesn't provide it
 *   - Added RSC (Residual Sodium Carbonate) calculation
 *   - SAR and SARadj now appear in Water Quality section
 * 
 * Version 2.0.1 - DOM fallback data collection
 *   - Added DOM fallback for soil data when GAIP_STATE not populated
 *   - Added DOM fallback for water data when GAIP_STATE not populated  
 *   - Fixed hasData flag consistency for soil/tissue/water sections
 *   - Improved contents list conditionals
 * 
 * Version 2.0.0 - Enhanced soil, water, and tissue reporting
 *   - Dual MLSN/SLAN interpretation table for soil nutrients
 *   - SARadj (Adjusted SAR) display and explanation for high-bicarbonate waters
 *   - pH and CEC context section with species-specific interpretation
 *   - Comprehensive glossary of terms appendix
 *   - Enhanced explanatory text throughout
 * 
 * Version 1.9.3 - Added Cultivar Performance Profile section
 *   - Comprehensive cultivar trait breakdown
 *   - BSPB ratings table for UK varieties
 *   - Performance modifier cards (wear, recovery, shade, salinity, etc.)
 *   - Disease resistance profile table
 *   - Blend composition display
 *   - Regional database support (BSPB, NTEP, Scanturf, GEVES)
 */

(function(global) {
    'use strict';
    
    // Wait for docx library
    if (typeof docx === 'undefined') {
        console.error('Word Export: docx library not loaded');
        return;
    }
    
    var Document = docx.Document;
    var Packer = docx.Packer;
    var Paragraph = docx.Paragraph;
    var TextRun = docx.TextRun;
    var Table = docx.Table;
    var TableRow = docx.TableRow;
    var TableCell = docx.TableCell;
    var Header = docx.Header;
    var Footer = docx.Footer;
    var AlignmentType = docx.AlignmentType;
    var PageNumber = docx.PageNumber;
    var PageBreak = docx.PageBreak;
    var BorderStyle = docx.BorderStyle;
    var WidthType = docx.WidthType;
    var HeadingLevel = docx.HeadingLevel;
    var ShadingType = docx.ShadingType;
    var VerticalAlign = docx.VerticalAlign;
    var ImageRun = docx.ImageRun;
    var TableOfContents = docx.TableOfContents;
    var PageOrientation = docx.PageOrientation;
    
    // Chart size constraints for consistent sizing
    // Increased for better readability of water/irrigation/disease charts
    var MAX_CHART_WIDTH = 560;
    var MAX_CHART_HEIGHT = 380;
    
    // Safe toFixed helper - prevents "Cannot read properties of undefined (reading 'toFixed')"
    function safeToFixed(value, decimals, fallback) {
        if (value === undefined || value === null || isNaN(value)) {
            return fallback !== undefined ? fallback : '-';
        }
        return Number(value).toFixed(decimals);
    }
    
    // Capture SVG element as base64 PNG
    function captureSvgElement(svg) {
        return new Promise(function(resolve) {
            if (!svg || svg.tagName.toLowerCase() !== 'svg') {
                resolve(null);
                return;
            }
            
            try {
                // Clone the SVG
                var clone = svg.cloneNode(true);
                
                // Get dimensions from various sources
                var bbox = svg.getBoundingClientRect();
                var width = bbox.width || parseFloat(svg.getAttribute('width')) || 
                            parseFloat(svg.style.width) || 500;
                var height = bbox.height || parseFloat(svg.getAttribute('height')) || 
                             parseFloat(svg.style.height) || 250;
                
                // If the SVG has a viewBox, prefer its natural aspect ratio
                // and render at a minimum width of 580px for Word export quality
                var viewBox = svg.getAttribute('viewBox');
                if (viewBox) {
                    var vbParts = viewBox.split(/[\s,]+/);
                    if (vbParts.length === 4) {
                        var vbW = parseFloat(vbParts[2]);
                        var vbH = parseFloat(vbParts[3]);
                        if (vbW > 0 && vbH > 0) {
                            // Use viewBox dimensions if they're larger than rendered size
                            if (vbW > width) {
                                width = vbW;
                                height = vbH;
                            }
                        }
                    }
                }
                
                // Ensure minimum export width (580px) for charts that render small on screen
                var MIN_EXPORT_WIDTH = 580;
                if (width < MIN_EXPORT_WIDTH) {
                    var upscale = MIN_EXPORT_WIDTH / width;
                    width = MIN_EXPORT_WIDTH;
                    height = Math.round(height * upscale);
                }
                
                // Ensure SVG has explicit dimensions for rendering
                clone.setAttribute('width', width);
                clone.setAttribute('height', height);
                
                // Add xmlns if missing (required for standalone SVG)
                if (!clone.getAttribute('xmlns')) {
                    clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
                }
                
                // Inline computed styles for reliable rendering
                inlineSvgStyles(svg, clone);
                
                // Serialize
                var svgData = new XMLSerializer().serializeToString(clone);
                svgData = resolveForPrint(svgData); // b35fix275: resolve dark theme CSS vars
                
                // Create canvas
                var canvas = document.createElement('canvas');
                var scale = 2; // Retina quality
                canvas.width = width * scale;
                canvas.height = height * scale;
                var ctx = canvas.getContext('2d');
                ctx.scale(scale, scale);
                ctx.fillStyle = '#ffffff'; // b35fix275: always white for print
                ctx.fillRect(0, 0, width, height);
                
                // Create image from SVG
                var img = new Image();
                var svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
                var url = URL.createObjectURL(svgBlob);
                
                img.onload = function() {
                    ctx.drawImage(img, 0, 0, width, height);
                    URL.revokeObjectURL(url);
                    
                    var dataUrl = canvas.toDataURL('image/png');
                    var base64 = dataUrl.split(',')[1];
                    resolve({
                        base64: base64,
                        width: width,
                        height: height
                    });
                };
                
                img.onerror = function(err) {
                    console.warn('[WordExport] SVG image load failed');
                    URL.revokeObjectURL(url);
                    resolve(null);
                };
                
                img.src = url;
            } catch (err) {
                console.warn('[WordExport] SVG capture error:', err);
                resolve(null);
            }
        });
    }
    
    // Inline computed styles into cloned SVG for reliable rendering
    function inlineSvgStyles(original, clone) {
        try {
            // Key SVG style properties to inline
            var styleProps = [
                'fill', 'stroke', 'stroke-width', 'stroke-dasharray', 'opacity',
                'font-family', 'font-size', 'font-weight', 'text-anchor',
                'dominant-baseline', 'fill-opacity', 'stroke-opacity'
            ];
            
            // Get all elements in both trees
            var origElements = original.querySelectorAll('*');
            var cloneElements = clone.querySelectorAll('*');
            
            for (var i = 0; i < origElements.length && i < cloneElements.length; i++) {
                var origEl = origElements[i];
                var cloneEl = cloneElements[i];
                var computed = window.getComputedStyle(origEl);
                
                styleProps.forEach(function(prop) {
                    var value = computed.getPropertyValue(prop);
                    if (value && value !== 'none' && value !== '') {
                        cloneEl.style[prop] = value;
                    }
                });
            }
            
            // Also handle the root SVG element
            var rootComputed = window.getComputedStyle(original);
            styleProps.forEach(function(prop) {
                var value = rootComputed.getPropertyValue(prop);
                if (value && value !== 'none' && value !== '') {
                    clone.style[prop] = value;
                }
            });
        } catch (err) {
            // Style inlining is best-effort, continue without it
        }
    }
    
    // Status color helper
    function getStatusColor(status) {
        var s = (status || '').toLowerCase();
        if (s === 'high' || s === 'severe' || s === 'critical' || s === 'danger') return 'DC2626';
        if (s === 'moderate' || s === 'elevated' || s === 'warning') return 'F59E0B';
        if (s === 'low' || s === 'optimal' || s === 'adequate' || s === 'good') return '16A34A';
        return '374151';
    }
    
    // Threshold color helper for soil values
    function getThresholdColor(value, threshold) {
        if (!threshold || value === undefined || value === null) return '374151';
        // For SLAN (has max)
        if (threshold.max !== undefined) {
            if (value < threshold.min) return 'DC2626';  // Below range = red
            if (value > threshold.max) return 'F59E0B';  // Above range = amber
            return '16A34A';  // Within range = green
        }
        // For MLSN (just min)
        return value >= threshold.min ? '16A34A' : 'DC2626';
    }
    
    // Tissue range color helper
    function getTissueRangeColor(value, range) {
        if (!range || value === undefined || value === null) return '374151';
        if (value < range.lo) return 'DC2626';  // Below = red
        if (value > range.hi) return 'F59E0B';  // Above = amber
        return '16A34A';  // Within = green
    }
    
    // Water threshold color helper
    function getWaterThresholdColor(value, threshold) {
        if (!threshold || value === undefined || value === null) return '374151';
        if (value <= threshold.safe) return '16A34A';  // Safe = green
        if (value <= threshold.marginal) return 'F59E0B';  // Marginal = amber
        return 'DC2626';  // Hazard = red
    }
    
    // ========================================
    // SVG CHART GENERATION FOR WORD EXPORT
    // ========================================
    
    /**
     * Generate soil nutrients bar chart SVG
     * Shows current values vs MLSN/SLAN/Ammonium Acetate thresholds
     * Cleaner design with clear status indicators
     */
    function generateSoilChartSvg(soilData) {
        if (!soilData || !soilData.thresholds) return null;
        
        var width = 520;
        var height = 280;
        var margin = { top: 35, right: 90, bottom: 50, left: 55 };
        var chartWidth = width - margin.left - margin.right;
        var chartHeight = height - margin.top - margin.bottom;
        
        var nutrients = ['P', 'K', 'Ca', 'Mg', 'S'];
        var barHeight = 28;
        var barGap = 10;
        var isSLAN = soilData.methodology === 'SLAN';
        var isAA = soilData.methodology === 'AMMONIUM_ACETATE' || soilData.methodology === 'AMMONIUM ACETATE';
        var isRangeBased = isSLAN || isAA;
        var methodName = isAA ? 'Ammonium Acetate' : (isSLAN ? 'SLAN' : 'MLSN');
        
        var svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + width + ' ' + height + '" width="' + width + '" height="' + height + '">';
        svg += '<rect width="' + width + '" height="' + height + '" fill="var(--gaip-surface)"/>';
        
        // Title
        svg += '<text x="' + (width/2) + '" y="20" text-anchor="middle" font-family="Arial" font-size="13" font-weight="bold" fill="var(--gaip-text)">Soil Nutrient Status (' + methodName + ' Guidelines)</text>';
        // Subtitle - different explanation for range-based vs threshold
        var subtitle = isRangeBased ? 
            'Bar shows your level • Green zone = target range (min-max)' :
            'Bar shows your level • Dashed line = minimum threshold';
        svg += '<text x="' + (width/2) + '" y="33" text-anchor="middle" font-family="Arial" font-size="9" fill="var(--gaip-text-secondary)">' + subtitle + '</text>';
        
        nutrients.forEach(function(nutrient, i) {
            var y = margin.top + 10 + i * (barHeight + barGap);
            var value = soilData[nutrient] || 0;
            var threshold = soilData.thresholds[nutrient];
            if (!threshold) return;
            
            // Nutrient full names
            var fullNames = { P: 'Phosphorus', K: 'Potassium', Ca: 'Calcium', Mg: 'Magnesium', S: 'Sulphur' };
            
            // Calculate scale - normalize to show threshold at ~40% of width
            var threshMin = threshold.min || threshold;
            var maxVal = isRangeBased ? 
                Math.max(threshold.max * 1.5, value * 1.2, threshMin * 2.5) : 
                Math.max(threshMin * 2.5, value * 1.2);
            
            var scale = chartWidth / maxVal;
            var barWidth = Math.min(value * scale, chartWidth);
            var threshX = margin.left + threshMin * scale;
            
            // Determine status
            var color, statusText, statusIcon;
            if (isRangeBased) {
                if (value < threshold.min) {
                    color = '#DC2626'; statusText = 'LOW'; statusIcon = '⚠';
                } else if (threshold.max && value > threshold.max) {
                    color = '#F59E0B'; statusText = 'HIGH'; statusIcon = '△';
                } else {
                    color = '#16A34A'; statusText = 'OK'; statusIcon = '✓';
                }
            } else {
                if (value >= threshMin) {
                    color = '#16A34A'; statusText = 'OK'; statusIcon = '✓';
                } else {
                    color = '#DC2626'; statusText = 'LOW'; statusIcon = '⚠';
                }
            }
            
            // Background track
            svg += '<rect x="' + margin.left + '" y="' + y + '" width="' + chartWidth + '" height="' + barHeight + '" fill="var(--gaip-surface-hover)" rx="4"/>';
            
            // For range-based (SLAN/AA): show target zone between min and max
            if (isRangeBased && threshold.max) {
                var minX = margin.left + threshold.min * scale;
                var maxX = margin.left + Math.min(threshold.max * scale, chartWidth);
                svg += '<rect x="' + minX + '" y="' + y + '" width="' + (maxX - minX) + '" height="' + barHeight + '" fill="var(--gaip-good-bg)" rx="4"/>';
            }
            
            // Value bar
            svg += '<rect x="' + margin.left + '" y="' + y + '" width="' + barWidth + '" height="' + barHeight + '" fill="' + color + '" rx="4" opacity="0.85"/>';
            
            // Threshold marker lines
            if (isRangeBased && threshold.max) {
                // Range-based: show both min and max lines
                var minLineX = margin.left + threshold.min * scale;
                var maxLineX = margin.left + Math.min(threshold.max * scale, chartWidth);
                svg += '<line x1="' + minLineX + '" y1="' + (y - 3) + '" x2="' + minLineX + '" y2="' + (y + barHeight + 3) + '" stroke="#166534" stroke-width="2" stroke-dasharray="4,2"/>';
                svg += '<line x1="' + maxLineX + '" y1="' + (y - 3) + '" x2="' + maxLineX + '" y2="' + (y + barHeight + 3) + '" stroke="#166534" stroke-width="2" stroke-dasharray="4,2"/>';
            } else {
                // MLSN: single minimum line
                svg += '<line x1="' + threshX + '" y1="' + (y - 3) + '" x2="' + threshX + '" y2="' + (y + barHeight + 3) + '" stroke="#1e3a5f" stroke-width="2.5" stroke-dasharray="4,2"/>';
            }
            
            // Nutrient label (left)
            svg += '<text x="' + (margin.left - 8) + '" y="' + (y + barHeight/2 + 4) + '" text-anchor="end" font-family="Arial" font-size="12" font-weight="bold" fill="var(--gaip-text)">' + nutrient + '</text>';
            
            // Value and status (right side)
            svg += '<text x="' + (margin.left + chartWidth + 8) + '" y="' + (y + barHeight/2 - 2) + '" text-anchor="start" font-family="Arial" font-size="11" font-weight="bold" fill="var(--gaip-text)">' + value + '</text>';
            svg += '<text x="' + (margin.left + chartWidth + 8) + '" y="' + (y + barHeight/2 + 12) + '" text-anchor="start" font-family="Arial" font-size="10" font-weight="bold" fill="' + color + '">' + statusIcon + ' ' + statusText + '</text>';
        });
        
        // Legend - different for range-based vs MLSN
        var legendY = height - 25;
        
        if (isRangeBased) {
            // Range-based legend: target range, within range, below, above
            svg += '<rect x="' + margin.left + '" y="' + (legendY - 7) + '" width="20" height="14" fill="var(--gaip-good-bg)" stroke="#166534" stroke-width="1" rx="2"/>';
            svg += '<text x="' + (margin.left + 25) + '" y="' + (legendY + 4) + '" font-family="Arial" font-size="10" fill="var(--gaip-text)">Target range</text>';
            
            svg += '<rect x="' + (margin.left + 110) + '" y="' + (legendY - 7) + '" width="14" height="14" fill="#16A34A" rx="2"/>';
            svg += '<text x="' + (margin.left + 128) + '" y="' + (legendY + 4) + '" font-family="Arial" font-size="10" fill="var(--gaip-text)">Within range</text>';
            
            svg += '<rect x="' + (margin.left + 210) + '" y="' + (legendY - 7) + '" width="14" height="14" fill="#DC2626" rx="2"/>';
            svg += '<text x="' + (margin.left + 228) + '" y="' + (legendY + 4) + '" font-family="Arial" font-size="10" fill="var(--gaip-text)">Below min</text>';
            
            svg += '<rect x="' + (margin.left + 300) + '" y="' + (legendY - 7) + '" width="14" height="14" fill="#F59E0B" rx="2"/>';
            svg += '<text x="' + (margin.left + 318) + '" y="' + (legendY + 4) + '" font-family="Arial" font-size="10" fill="var(--gaip-text)">Above max</text>';
        } else {
            // MLSN legend: minimum threshold, adequate, below
            svg += '<line x1="' + margin.left + '" y1="' + legendY + '" x2="' + (margin.left + 20) + '" y2="' + legendY + '" stroke="#1e3a5f" stroke-width="2.5" stroke-dasharray="4,2"/>';
            svg += '<text x="' + (margin.left + 25) + '" y="' + (legendY + 4) + '" font-family="Arial" font-size="10" fill="var(--gaip-text)">MLSN minimum</text>';
            
            svg += '<rect x="' + (margin.left + 130) + '" y="' + (legendY - 7) + '" width="14" height="14" fill="#16A34A" rx="2"/>';
            svg += '<text x="' + (margin.left + 148) + '" y="' + (legendY + 4) + '" font-family="Arial" font-size="10" fill="var(--gaip-text)">Adequate</text>';
            
            svg += '<rect x="' + (margin.left + 220) + '" y="' + (legendY - 7) + '" width="14" height="14" fill="#DC2626" rx="2"/>';
            svg += '<text x="' + (margin.left + 238) + '" y="' + (legendY + 4) + '" font-family="Arial" font-size="10" fill="var(--gaip-text)">Below minimum</text>';
        }
        
        svg += '</svg>';
        return svg;
    }
    
    /**
     * Generate trace element bar chart SVG (Fe, Mn, Zn, Cu, B)
     * MLSN minimums: Fe=1, Mn=1, Zn=1, Cu=0.2, B=0.1 ppm
     * Returns null if none of the five trace values are present
     */
    /**
     * Sufficiency ranges for trace elements by extractant type.
     * Sources: Turner & Hummel (1992), Carrow et al. (2001) Turfgrass Soil Fertility,
     * Bryson et al. (2014) Plant Analysis Handbook III, Westerman (1990) Soil Testing.
     */
    var TRACE_RANGES = {
        Fe: {
            mehlich3: { deficient: 50,  low: 100, adequate: 250, excess: 500  },
            dtpa:     { deficient: 2.5, low: 4.5, adequate: 20,  excess: 50   },
            aa:       null
        },
        Mn: {
            mehlich3: { deficient: 5,   low: 15,  adequate: 100, excess: 200, toxicityPH: 5.5, toxicityPPM: 150 },
            dtpa:     { deficient: 0.5, low: 1,   adequate: 5,   excess: 15,  toxicityPH: 5.5, toxicityPPM: 10  },
            aa:       null
        },
        Zn: {
            mehlich3: { deficient: 1,   low: 2,   adequate: 20,  excess: 50   },
            dtpa:     { deficient: 0.5, low: 1,   adequate: 5,   excess: 20   },
            aa:       { deficient: 0.5, low: 1,   adequate: 5,   excess: 20   }
        },
        Cu: {
            mehlich3: { deficient: 0.2, low: 0.5, adequate: 5,   excess: 10   },
            dtpa:     { deficient: 0.1, low: 0.2, adequate: 2,   excess: 5    },
            aa:       { deficient: 0.1, low: 0.2, adequate: 2,   excess: 5    }
        },
        B: {
            mehlich3: { deficient: 0.1, low: 0.3, adequate: 1,   excess: 2    },
            hotwater: { deficient: 0.1, low: 0.3, adequate: 1,   excess: 2    },
            dtpa:     { deficient: 0.1, low: 0.3, adequate: 1,   excess: 2    },
            aa:       { deficient: 0.1, low: 0.3, adequate: 1,   excess: 2    }
        }
    };

    function _traceExtractant(soilData) {
        var ext = (soilData.extractant || '').toLowerCase();
        if (ext.indexOf('dtpa') >= 0)     return 'dtpa';
        if (ext.indexOf('hot') >= 0)      return 'hotwater';
        if (ext.indexOf('ammonium') >= 0 || ext.indexOf('\baa\b') >= 0) return 'aa';
        if (ext.indexOf('mehlich') >= 0)  return 'mehlich3';
        var meth = (soilData.methodology || '').toUpperCase();
        if (meth.indexOf('AMMONIUM') >= 0) return 'aa';
        return 'mehlich3';
    }

    function _classifyTrace(key, value, extractant, pH) {
        var ranges = TRACE_RANGES[key];
        if (!ranges) return null;
        var r = ranges[extractant] || ranges['mehlich3'];
        if (!r) return { status: 'No data', color: '9CA3AF', badge: '-', note: null };

        var status, color, badge, note = null;
        if (value < r.deficient) {
            status = 'Deficient'; color = 'DC2626'; badge = '\u2717 DEF';
        } else if (value < r.low) {
            status = 'Low';       color = 'F59E0B'; badge = '\u26A0 LOW';
        } else if (value <= r.adequate) {
            status = 'Adequate';  color = '16A34A'; badge = '\u2713 OK';
        } else if (value <= (r.excess || 99999)) {
            status = 'High';      color = 'F59E0B'; badge = '\u25B3 HIGH';
        } else {
            status = 'Excess';    color = 'DC2626'; badge = '\u2717 EXCESS';
        }
        if (pH && pH > 7.0 && (key === 'Fe' || key === 'Mn' || key === 'Zn' || key === 'Cu')) {
            if (status === 'Adequate' || status === 'High' || status === 'Excess') {
                note = 'pH ' + pH + ': plant uptake restricted despite adequate soil levels';
            }
        }
        if (pH && pH < 5.5 && key === 'Mn' && r.toxicityPH) {
            if (value > (r.toxicityPPM || 150)) {
                status = 'Toxicity risk'; color = 'DC2626'; badge = '\u2717 TOXIC';
                note = 'pH ' + pH + ' + ' + value + ' ppm Mn: phytotoxicity risk. Lime required.';
            } else if (value > r.adequate * 0.6) {
                note = 'pH ' + pH + ': Mn solubility elevated, monitor as pH falls.';
            }
        }
        return { status: status, color: color, badge: badge, note: note };
    }

    function generateTraceChartSvg(soilData) {
        var traceKeys = ['Fe', 'Mn', 'Zn', 'Cu', 'B'];
        var traceNames = { Fe: 'Iron', Mn: 'Manganese', Zn: 'Zinc', Cu: 'Copper', B: 'Boron' };
        var pH = parseFloat(soilData.pH) || null;
        var extractant = _traceExtractant(soilData);
        var extractantLabel = extractant === 'dtpa' ? 'DTPA' :
                              extractant === 'hotwater' ? 'Hot Water' :
                              extractant === 'aa' ? 'Ammonium Acetate' : 'Mehlich-3';

        var present = traceKeys.filter(function(k) {
            var r = TRACE_RANGES[k];
            if (!r || !(r[extractant] || r['mehlich3'])) return false;
            return soilData[k] !== undefined && soilData[k] !== null && soilData[k] !== '';
        });
        if (present.length === 0) return null;

        var width = 540;
        var barHeight = 28;
        var barGap = 10;
        var margin = { top: 55, right: 120, bottom: 35, left: 80 };
        var chartWidth = width - margin.left - margin.right;
        var height = margin.top + present.length * (barHeight + barGap) + margin.bottom;

        var svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + width + ' ' + height + '" width="' + width + '" height="' + height + '">';
        svg += '<rect width="' + width + '" height="' + height + '" fill="var(--gaip-surface)"/>';
        svg += '<text x="' + (width/2) + '" y="16" text-anchor="middle" font-family="Arial" font-size="13" font-weight="bold" fill="var(--gaip-text)">Trace Element Status</text>';
        svg += '<text x="' + (width/2) + '" y="29" text-anchor="middle" font-family="Arial" font-size="9" fill="var(--gaip-text-secondary)">Extractant: ' + extractantLabel + (pH ? ' • Soil pH ' + pH : '') + '</text>';
        svg += '<text x="' + (width/2) + '" y="41" text-anchor="middle" font-family="Arial" font-size="9" fill="var(--gaip-text-secondary)">Sufficiency ranges: Turner &amp; Hummel (1992), Carrow et al. (2001)</text>';

        present.forEach(function(key, i) {
            var value = parseFloat(soilData[key]);
            var r = TRACE_RANGES[key][extractant] || TRACE_RANGES[key]['mehlich3'];
            var c = _classifyTrace(key, value, extractant, pH);
            var y = margin.top + i * (barHeight + barGap);
            var scaleMax = Math.max(r.excess || r.adequate * 2, value * 1.15, r.adequate * 1.5);
            var scale = chartWidth / scaleMax;

            // Zone backgrounds
            var defW = Math.min(r.deficient * scale, chartWidth);
            var lowEnd = Math.min(r.low * scale, chartWidth);
            var adqEnd = Math.min(r.adequate * scale, chartWidth);
            svg += '<rect x="' + margin.left + '" y="' + y + '" width="' + defW + '" height="' + barHeight + '" fill="var(--gaip-critical-bg)" rx="3"/>';
            if (lowEnd > defW) svg += '<rect x="' + (margin.left + defW) + '" y="' + y + '" width="' + (lowEnd - defW) + '" height="' + barHeight + '" fill="var(--gaip-warning-bg)"/>';
            if (adqEnd > lowEnd) svg += '<rect x="' + (margin.left + lowEnd) + '" y="' + y + '" width="' + (adqEnd - lowEnd) + '" height="' + barHeight + '" fill="var(--gaip-good-bg)"/>';
            if (chartWidth > adqEnd) svg += '<rect x="' + (margin.left + adqEnd) + '" y="' + y + '" width="' + (chartWidth - adqEnd) + '" height="' + barHeight + '" fill="var(--gaip-warning-bg)" rx="3"/>';

            // Value bar
            var barW = Math.min(value * scale, chartWidth);
            svg += '<rect x="' + margin.left + '" y="' + (y+6) + '" width="' + barW + '" height="' + (barHeight-12) + '" fill="#' + c.color + '" rx="2" opacity="0.9"/>';
            svg += '<line x1="' + (margin.left + barW) + '" y1="' + y + '" x2="' + (margin.left + barW) + '" y2="' + (y+barHeight) + '" stroke="#' + c.color + '" stroke-width="2.5"/>';

            // Labels
            svg += '<text x="' + (margin.left - 5) + '" y="' + (y + barHeight/2 + 4) + '" text-anchor="end" font-family="Arial" font-size="11" font-weight="bold" fill="var(--gaip-text)">' + traceNames[key] + '</text>';
            var valDisplay = value % 1 === 0 ? value : parseFloat(value.toFixed(1));
            var valX = margin.left + barW + 4;
            svg += '<text x="' + valX + '" y="' + (y + barHeight/2 - 1) + '" font-family="Arial" font-size="9" fill="var(--gaip-text)">' + valDisplay + ' ppm</text>';
            if (c.note) {
                svg += '<text x="' + valX + '" y="' + (y + barHeight/2 + 9) + '" font-family="Arial" font-size="7.5" fill="var(--gaip-text-secondary)" font-style="italic">⚠ pH effect</text>';
            }
            svg += '<text x="' + (margin.left + chartWidth + 6) + '" y="' + (y + barHeight/2 + 4) + '" font-family="Arial" font-size="10" font-weight="bold" fill="#' + c.color + '">' + c.badge + '</text>';
        });

        // Legend
        var ly = height - 18;
        var lx = margin.left;
        svg += '<rect x="' + lx + '" y="' + ly + '" width="10" height="10" fill="var(--gaip-critical-bg)"/><text x="' + (lx+12) + '" y="' + (ly+8) + '" font-family="Arial" font-size="8" fill="var(--gaip-text-secondary)">Deficient</text>';
        lx += 58;
        svg += '<rect x="' + lx + '" y="' + ly + '" width="10" height="10" fill="var(--gaip-warning-bg)"/><text x="' + (lx+12) + '" y="' + (ly+8) + '" font-family="Arial" font-size="8" fill="var(--gaip-text-secondary)">Low / Excess</text>';
        lx += 72;
        svg += '<rect x="' + lx + '" y="' + ly + '" width="10" height="10" fill="var(--gaip-good-bg)"/><text x="' + (lx+12) + '" y="' + (ly+8) + '" font-family="Arial" font-size="8" fill="var(--gaip-text-secondary)">Adequate</text>';

        svg += '</svg>';
        return svg;
    }

    function generateTraceNarrative(soilData) {
        var traceKeys = ['Fe', 'Mn', 'Zn', 'Cu', 'B'];
        var present = traceKeys.filter(function(k) {
            return soilData[k] !== undefined && soilData[k] !== null && soilData[k] !== '';
        });
        if (present.length === 0) return [];

        var pH = parseFloat(soilData.pH) || null;
        var extractant = _traceExtractant(soilData);
        var paragraphs = [];
        var issues = [];

        present.forEach(function(key) {
            var value = parseFloat(soilData[key]);
            var c = _classifyTrace(key, value, extractant, pH);
            if (!c) return;
            if (c.status === 'Deficient') issues.push(key + ' deficient (' + value + ' ppm)');
            else if (c.status === 'Low') issues.push(key + ' low (' + value + ' ppm)');
            else if (c.status === 'Toxicity risk') issues.push('Mn toxicity risk (' + value + ' ppm at pH ' + pH + ')');
            else if (c.status === 'Excess') issues.push(key + ' excess (' + value + ' ppm)');
        });

        if (pH && pH > 7.0) {
            paragraphs.push(new Paragraph({ spacing: { before: 120, after: 80 }, children: [new TextRun({
                text: 'Soil pH ' + pH + ' reduces plant availability of iron, manganese, zinc, and copper regardless of soil ppm. ' +
                      'Foliar applications are more effective than soil applications at this pH. Use chelated iron (Fe-EDDHA or Fe-EDTA), sulphate forms precipitate rapidly above pH 6.5.',
                size: 18, color: '374151' })]}));
        } else if (pH && pH < 5.5) {
            var lowMsg = 'Soil pH ' + pH + ' increases manganese and aluminium solubility. ';
            if (soilData.Mn && parseFloat(soilData.Mn) > 100) {
                lowMsg += 'Manganese at ' + soilData.Mn + ' ppm with pH ' + pH + ' presents phytotoxicity risk, lime to pH 5.8–6.0 is the priority intervention. ';
            }
            lowMsg += 'Aluminium toxicity (Al³⁺) is not routinely measured but becomes phytotoxic below pH 5.0, disrupting root elongation and P uptake. Tissue testing recommended.';
            paragraphs.push(new Paragraph({ spacing: { before: 120, after: 80 }, children: [new TextRun({ text: lowMsg, size: 18, color: '374151' })]}));
        }

        if (soilData.Fe && soilData.Mn) {
            var fe = parseFloat(soilData.Fe), mn = parseFloat(soilData.Mn);
            var ratio = fe / mn;
            if (ratio > 50) {
                paragraphs.push(new Paragraph({ spacing: { before: 80, after: 80 }, children: [new TextRun({
                    text: 'Fe:Mn ratio ' + ratio.toFixed(0) + ':1, elevated iron relative to manganese may suppress Mn uptake through competitive inhibition.',
                    size: 18, color: '374151' })]}));
            } else if (ratio < 1.5) {
                paragraphs.push(new Paragraph({ spacing: { before: 80, after: 80 }, children: [new TextRun({
                    text: 'Fe:Mn ratio ' + ratio.toFixed(1) + ':1, high manganese relative to iron may suppress Fe uptake.',
                    size: 18, color: '374151' })]}));
            }
        }

        if (issues.length > 0) {
            paragraphs.push(new Paragraph({ spacing: { before: 80, after: 80 }, children: [new TextRun({
                text: 'Issues identified: ' + issues.join('; ') + '.', size: 18, color: '374151' })]}));
        }

        var extractantLabel = extractant === 'dtpa' ? 'DTPA' : extractant === 'hotwater' ? 'hot water' :
                              extractant === 'aa' ? 'ammonium acetate' : 'Mehlich-3';
        paragraphs.push(new Paragraph({ spacing: { before: 80, after: 120 }, children: [new TextRun({
            text: 'Sufficiency ranges based on ' + extractantLabel + ' extraction (Turner & Hummel 1992; Carrow et al. 2001). ' +
                  'Soil ppm alone does not determine plant availability, pH, organic matter, and redox conditions all modify uptake.',
            size: 16, italics: true, color: '6B7280' })]}));

        return paragraphs;
    }

    /**
     * Generate tissue analysis bar chart SVG
     * Shows current values within sufficiency ranges
     */
    function generateTissueChartSvg(tissueData) {
        if (!tissueData || !tissueData.ranges) return null;
        
        var width = 500;
        var height = 280;
        var margin = { top: 20, right: 70, bottom: 30, left: 40 };
        var chartWidth = width - margin.left - margin.right;
        var chartHeight = height - margin.top - margin.bottom;
        
        // Macros and traces separately
        var macros = ['N', 'P', 'K', 'Ca', 'Mg', 'S'];
        var traces = ['Fe', 'Mn', 'Zn', 'Cu', 'B'];
        var allNutrients = macros.concat(traces);
        
        var barHeight = Math.floor(chartHeight / allNutrients.length) - 4;
        
        var svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + width + ' ' + height + '" width="' + width + '" height="' + height + '">';
        svg += '<rect width="' + width + '" height="' + height + '" fill="var(--gaip-surface)"/>';
        
        // Title
        svg += '<text x="' + (width/2) + '" y="15" text-anchor="middle" font-family="Arial" font-size="12" font-weight="bold" fill="var(--gaip-text)">Tissue Analysis - Sufficiency Ranges</text>';
        
        allNutrients.forEach(function(nutrient, i) {
            var y = margin.top + i * (barHeight + 4);
            var value = tissueData[nutrient];
            var range = tissueData.ranges[nutrient];
            if (value === undefined || value === null || !range) return;
            
            // For display, normalize to range position (0-100%)
            var rangeSpan = range.hi - range.lo;
            var extendedLo = range.lo - rangeSpan * 0.3;
            var extendedHi = range.hi + rangeSpan * 0.5;
            var totalSpan = extendedHi - extendedLo;
            
            // Calculate positions
            var loPos = (range.lo - extendedLo) / totalSpan * chartWidth;
            var hiPos = (range.hi - extendedLo) / totalSpan * chartWidth;
            var valuePos = Math.max(0, Math.min(chartWidth, (value - extendedLo) / totalSpan * chartWidth));
            
            // Determine status
            var status, color;
            if (value < range.lo) { status = 'Low'; color = '#DC2626'; }
            else if (value > range.hi) { status = 'High'; color = '#F59E0B'; }
            else { status = 'OK'; color = '#16A34A'; }
            
            // Background (deficient zone - red tint)
            svg += '<rect x="' + margin.left + '" y="' + y + '" width="' + loPos + '" height="' + barHeight + '" fill="var(--gaip-critical-bg)" rx="2"/>';
            
            // Optimal zone (green)
            svg += '<rect x="' + (margin.left + loPos) + '" y="' + y + '" width="' + (hiPos - loPos) + '" height="' + barHeight + '" fill="var(--gaip-good-bg)" rx="0"/>';
            
            // High zone (yellow tint)
            svg += '<rect x="' + (margin.left + hiPos) + '" y="' + y + '" width="' + (chartWidth - hiPos) + '" height="' + barHeight + '" fill="var(--gaip-warning-bg)" rx="2"/>';
            
            // Value marker (vertical line with dot)
            svg += '<line x1="' + (margin.left + valuePos) + '" y1="' + y + '" x2="' + (margin.left + valuePos) + '" y2="' + (y + barHeight) + '" stroke="' + color + '" stroke-width="3"/>';
            svg += '<circle cx="' + (margin.left + valuePos) + '" cy="' + (y + barHeight/2) + '" r="4" fill="' + color + '"/>';
            
            // Label
            svg += '<text x="' + (margin.left - 5) + '" y="' + (y + barHeight/2 + 4) + '" text-anchor="end" font-family="Arial" font-size="10" fill="var(--gaip-text)">' + nutrient + '</text>';
            
            // Value and status
            var valueText = range.unit === '%' ? value.toFixed(2) + '%' : Math.round(value) + ' ppm';
            svg += '<text x="' + (margin.left + chartWidth + 5) + '" y="' + (y + barHeight/2 + 4) + '" text-anchor="start" font-family="Arial" font-size="9" fill="' + color + '">' + valueText + '</text>';
        });
        
        // Legend
        var legendY = height - 8;
        svg += '<rect x="' + margin.left + '" y="' + (legendY - 8) + '" width="12" height="8" fill="var(--gaip-critical-bg)"/>';
        svg += '<text x="' + (margin.left + 15) + '" y="' + legendY + '" font-family="Arial" font-size="8" fill="var(--gaip-text-secondary)">Low</text>';
        svg += '<rect x="' + (margin.left + 45) + '" y="' + (legendY - 8) + '" width="12" height="8" fill="var(--gaip-good-bg)"/>';
        svg += '<text x="' + (margin.left + 60) + '" y="' + legendY + '" font-family="Arial" font-size="8" fill="var(--gaip-text-secondary)">Adequate</text>';
        svg += '<rect x="' + (margin.left + 110) + '" y="' + (legendY - 8) + '" width="12" height="8" fill="var(--gaip-warning-bg)"/>';
        svg += '<text x="' + (margin.left + 125) + '" y="' + legendY + '" font-family="Arial" font-size="8" fill="var(--gaip-text-secondary)">High</text>';
        
        svg += '</svg>';
        return svg;
    }
    
    /**
     * Generate water quality bar chart SVG
     * Shows parameters against safe/marginal/hazard zones
     */
    function generateWaterChartSvg(waterData) {
        if (!waterData || !waterData.thresholds) return null;
        
        var width = 500;
        var height = 200;
        var margin = { top: 20, right: 70, bottom: 30, left: 50 };
        var chartWidth = width - margin.left - margin.right;
        var chartHeight = height - margin.top - margin.bottom;
        
        var params = [];
        if (waterData.EC !== undefined) params.push({ key: 'EC', value: waterData.EC });
        if (waterData.SAR !== undefined) params.push({ key: 'SAR', value: waterData.SAR });
        if (waterData.Na !== undefined) params.push({ key: 'Na', value: waterData.Na });
        if (waterData.Cl !== undefined) params.push({ key: 'Cl', value: waterData.Cl });
        if (waterData.HCO3 !== undefined) params.push({ key: 'HCO3', value: waterData.HCO3 });
        
        if (params.length === 0) return null;
        
        var barHeight = Math.floor(chartHeight / params.length) - 8;
        
        var svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + width + ' ' + height + '" width="' + width + '" height="' + height + '">';
        svg += '<rect width="' + width + '" height="' + height + '" fill="var(--gaip-surface)"/>';
        
        // Title
        svg += '<text x="' + (width/2) + '" y="15" text-anchor="middle" font-family="Arial" font-size="12" font-weight="bold" fill="var(--gaip-text)">Water Quality Assessment</text>';
        
        params.forEach(function(param, i) {
            var y = margin.top + i * (barHeight + 8);
            var value = param.value;
            var thresh = waterData.thresholds[param.key];
            if (!thresh) return;
            
            // Calculate scale - max is threshold max * 1.5 or value * 1.2
            var maxVal = Math.max(thresh.max * 1.3, value * 1.2);
            var scale = chartWidth / maxVal;
            
            // Zone widths
            var safeWidth = thresh.safe * scale;
            var marginalWidth = (thresh.marginal - thresh.safe) * scale;
            var hazardWidth = chartWidth - safeWidth - marginalWidth;
            
            // Zones
            svg += '<rect x="' + margin.left + '" y="' + y + '" width="' + safeWidth + '" height="' + barHeight + '" fill="var(--gaip-good-bg)" rx="3"/>';
            svg += '<rect x="' + (margin.left + safeWidth) + '" y="' + y + '" width="' + marginalWidth + '" height="' + barHeight + '" fill="var(--gaip-warning-bg)" rx="0"/>';
            svg += '<rect x="' + (margin.left + safeWidth + marginalWidth) + '" y="' + y + '" width="' + hazardWidth + '" height="' + barHeight + '" fill="var(--gaip-critical-bg)" rx="3"/>';
            
            // Value marker
            var valuePos = Math.min(value * scale, chartWidth);
            var color = value <= thresh.safe ? '#16A34A' : value <= thresh.marginal ? '#F59E0B' : '#DC2626';
            svg += '<line x1="' + (margin.left + valuePos) + '" y1="' + y + '" x2="' + (margin.left + valuePos) + '" y2="' + (y + barHeight) + '" stroke="' + color + '" stroke-width="3"/>';
            svg += '<circle cx="' + (margin.left + valuePos) + '" cy="' + (y + barHeight/2) + '" r="4" fill="' + color + '"/>';
            
            // Label
            svg += '<text x="' + (margin.left - 5) + '" y="' + (y + barHeight/2 + 4) + '" text-anchor="end" font-family="Arial" font-size="11" fill="var(--gaip-text)">' + param.key + '</text>';
            
            // Value
            var unit = thresh.unit || '';
            var valueText = (typeof value === 'number' ? value.toFixed(1) : value) + ' ' + unit;
            svg += '<text x="' + (margin.left + chartWidth + 5) + '" y="' + (y + barHeight/2 + 4) + '" text-anchor="start" font-family="Arial" font-size="9" fill="' + color + '">' + valueText + '</text>';
        });
        
        // Legend
        var legendY = height - 8;
        svg += '<rect x="' + margin.left + '" y="' + (legendY - 8) + '" width="12" height="8" fill="var(--gaip-good-bg)"/>';
        svg += '<text x="' + (margin.left + 15) + '" y="' + legendY + '" font-family="Arial" font-size="8" fill="var(--gaip-text-secondary)">Safe</text>';
        svg += '<rect x="' + (margin.left + 50) + '" y="' + (legendY - 8) + '" width="12" height="8" fill="var(--gaip-warning-bg)"/>';
        svg += '<text x="' + (margin.left + 65) + '" y="' + legendY + '" font-family="Arial" font-size="8" fill="var(--gaip-text-secondary)">Marginal</text>';
        svg += '<rect x="' + (margin.left + 115) + '" y="' + (legendY - 8) + '" width="12" height="8" fill="var(--gaip-critical-bg)"/>';
        svg += '<text x="' + (margin.left + 130) + '" y="' + legendY + '" font-family="Arial" font-size="8" fill="var(--gaip-text-secondary)">Hazard</text>';
        
        svg += '</svg>';
        return svg;
    }
    
    /**
     * Convert SVG string to base64 PNG for Word embedding
     */
    /**
     * resolveForPrint — b35fix275
     * Replace all CSS variable tokens in an SVG string with hardcoded print-safe
     * hex values. Called before every SVG→PNG conversion so Word export charts
     * render on white paper regardless of the active UI theme (dark/light).
     *
     * Colour mapping: dark theme tokens → print-safe equivalents.
     * Background tokens → white (#ffffff).
     * Text tokens → near-black (#111827).
     * Status colours kept vivid so they remain readable in print.
     */
    var PRINT_COLOUR_MAP = {
        // Backgrounds — all white for print
        'var(--gaip-surface)':              '#ffffff',
        'var(--gaip-surface-hover)':        '#f3f4f6',
        'var(--gaip-bg)':                   '#ffffff',
        'var(--gaip-card-bg)':              '#ffffff',
        // Text — dark for contrast on white
        'var(--gaip-text)':                 '#111827',
        'var(--gaip-text-secondary)':       '#374151',
        'var(--gaip-text-muted)':           '#6b7280',
        // Borders
        'var(--gaip-border)':               '#d1d5db',
        // Status backgrounds — light tints readable on white
        'var(--gaip-good-bg)':              '#dcfce7',
        'var(--gaip-warning-bg)':           '#fef9c3',
        'var(--gaip-critical-bg)':          '#fee2e2',
        'var(--gaip-info-bg)':              '#dbeafe',
        // Status text colours
        'var(--gaip-good-text)':            '#166534',
        'var(--gaip-warning-text)':         '#854d0e',
        'var(--gaip-critical-text)':        '#991b1b',
        // Accent
        'var(--gaip-accent)':               '#1e3a5f',
        'var(--gaip-accent-hover)':         '#1e40af',
    };

    function resolveForPrint(svgString) {
        var result = svgString;
        // 1. Replace all CSS variable tokens with print-safe hex
        Object.keys(PRINT_COLOUR_MAP).forEach(function(token) {
            result = result.split(token).join(PRINT_COLOUR_MAP[token]);
        });
        // 2. Inject explicit white background rect after the opening <svg ...> tag.
        //    SVGs with no background fill render transparent — when drawn via img.onload
        //    onto a canvas, the browser may apply its dark-mode background to the SVG
        //    viewport, producing a black image. The white rect forces a known background.
        result = result.replace(
            /(<svg[^>]*>)/,
            '$1<rect width="100%" height="100%" fill="#ffffff"/>'
        );
        return result;
    }

    function svgStringToBase64Png(svgString, width, height) {
        return new Promise(function(resolve) {
            try {
                var canvas = document.createElement('canvas');
                var scale = 2;
                canvas.width = width * scale;
                canvas.height = height * scale;
                var ctx = canvas.getContext('2d');
                ctx.scale(scale, scale);
                ctx.fillStyle = 'var(--gaip-surface)';
                ctx.fillRect(0, 0, width, height);
                
                var img = new Image();
                svgString = resolveForPrint(svgString); // b35fix275: resolve CSS vars to print-safe hex
                var svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
                var url = URL.createObjectURL(svgBlob);
                
                var timeout = setTimeout(function() {
                    console.warn('[WordExport] SVG→PNG timed out w=' + width + ' h=' + height);
                    URL.revokeObjectURL(url);
                    resolve(null);
                }, 5000);

                img.onload = function() {
                    clearTimeout(timeout);
                    ctx.drawImage(img, 0, 0, width, height);
                    URL.revokeObjectURL(url);
                    var dataUrl = canvas.toDataURL('image/png');
                    var base64 = dataUrl.split(',')[1];
                    resolve({ base64: base64, width: width, height: height });
                };

                img.onerror = function(e) {
                    clearTimeout(timeout);
                    console.warn('[WordExport] SVG img.onerror w=' + width + ' h=' + height + ' svgLen=' + svgString.length);
                    URL.revokeObjectURL(url);
                    resolve(null);
                };

                img.src = url;
            } catch (err) {
                console.warn('[WordExport] SVG to PNG conversion failed:', err);
                resolve(null);
            }
        });
    }
    
    // ========================================
    // NARRATIVE GENERATION FUNCTIONS
    // ========================================
    
    /**
     * Generate soil interpretation narrative and recommendations.
     *
     * b35fix320: optional `context` parameter carries non-soil signals that
     * affect product selection (overseed/seeding state, etc). Default {} for
     * backward compatibility — callers that don't pass context get the same
     * behaviour as before, except where the function defaults to seedling-
     * safe choices when ambiguity remains.
     */
    function generateSoilNarrative(soilData, nutritionProgram, context) {
        if (!soilData || !soilData.thresholds) return null;
        context = context || {};
        
        var methodology = soilData.methodology || 'MLSN';
        var isSLAN = methodology === 'SLAN';
        var isAA = methodology === 'AMMONIUM_ACETATE' || methodology === 'AMMONIUM ACETATE';
        var isRangeBased = isSLAN || isAA;  // Both use min-max ranges
        var narrative = [];
        var recommendations = [];
        var deficiencies = [];     // Moderate + Severe — "require attention"
        var marginalDeficits = []; // Marginal-band — "monitor"
        var adequate = [];
        
        // Methodology display name
        var methodDisplayName = isAA ? 'Ammonium Acetate (Hill Labs)' : methodology;
        
        // Analyze each nutrient
        var nutrients = [
            { key: 'P', name: 'Phosphorus', unit: isAA ? 'mg/L' : 'ppm' },
            { key: 'K', name: 'Potassium', unit: 'ppm' },
            { key: 'Ca', name: 'Calcium', unit: 'ppm' },
            { key: 'Mg', name: 'Magnesium', unit: 'ppm' },
            { key: 'S', name: 'Sulphur', unit: 'ppm' }
        ];
        
        // b35fix426 (C31): mirror the band logic in _computeAmendmentDecision
        // so the narrative matches the Annual Soil Amendments table. A
        // nutrient that the table flagged 'monitor' must NOT show up in the
        // "below guidelines and require attention" list — that produces the
        // internal inconsistency reported in b35fix425 production verification
        // (Rockingham 16th green: narrative said "Phosphorus, Calcium ... require
        // attention" while the table showed Ca as Monitor).
        // Constants kept in sync with _severityBand (kg/ha floor 15,
        // depth × bd × 0.1 = 1.4 conversion).
        var _MARGINAL_KG_FLOOR = 15;
        function _isMarginalDeficit(deficitPpm, refPpm) {
            if (!refPpm || refPpm <= 0) return false;
            var fraction = deficitPpm / refPpm;
            var kgPerHa = deficitPpm * 1.4;
            return fraction < 0.25 && kgPerHa < _MARGINAL_KG_FLOOR;
        }
        
        nutrients.forEach(function(n) {
            var value = soilData[n.key];
            var thresh = soilData.thresholds[n.key];
            if (!value || !thresh) return;
            
            var status;
            if (isRangeBased) {
                if (value < thresh.min) status = 'deficient';
                else if (thresh.max && value > thresh.max) status = 'high';
                else status = 'adequate';
            } else {
                status = value >= thresh.min ? 'adequate' : 'deficient';
            }
            
            if (status === 'deficient') {
                var deficit = thresh.min - value;
                if (_isMarginalDeficit(deficit, thresh.min)) {
                    marginalDeficits.push(n.name);
                    // Marginal-band nutrients do NOT generate a fertiliser
                    // recommendation here either — _computeAmendmentDecision
                    // would short-circuit them to status='monitor' anyway, so
                    // calling generateFertiliserRecommendation would produce
                    // an Apply-row recommendation that the table already
                    // suppressed. Skip it.
                } else {
                    deficiencies.push(n.name);
                    // b35fix424 (C20): hemisphere read from context for elem-S Rule 4
                    // suppression copy and dolomite spring-placement override.
                    var rec = generateFertiliserRecommendation(n.key, deficit, soilData, soilData.surfaceType || '', nutritionProgram, context, context.hemisphere);
                    if (rec) recommendations.push(rec);
                }
            } else if (status === 'adequate') {
                adequate.push(n.name);
            }
        });
        
        // Build narrative
        if (deficiencies.length === 0 && marginalDeficits.length === 0) {
            narrative.push('All measured nutrients are at or above ' + methodDisplayName + ' guideline levels. The soil fertility status is adequate for healthy turfgrass growth.');
        } else {
            // b35fix408 (C6): subject-verb agreement for single vs multi deficiency.
            // 'Phosphorus is below SLAN guidelines and requires attention.' (1 nutrient)
            // 'Phosphorus, Calcium are below SLAN guidelines and require attention.' (2+)
            if (deficiencies.length > 0) {
                var _slanIs = deficiencies.length === 1 ? ' is' : ' are';
                var _slanRequire = deficiencies.length === 1 ? ' requires' : ' require';
                narrative.push(deficiencies.join(', ') + _slanIs + ' below ' + methodDisplayName + ' guidelines and' + _slanRequire + ' attention.');
            }
            // b35fix426 (C31): Marginal-band nutrients get their own sentence
            // matching the Monitor row in the Annual Soil Amendments table. The
            // copy intentionally NOT framed as "require attention" — that
            // contradicts the table's monitor recommendation.
            if (marginalDeficits.length > 0) {
                var _margIs = marginalDeficits.length === 1 ? ' is' : ' are';
                var _margAreNarrow = marginalDeficits.length === 1 ? ' is narrow' : ' are narrow';
                narrative.push(marginalDeficits.join(', ') + _margIs + ' marginally below ' + methodDisplayName + ' guidelines but the gap' + _margAreNarrow + ' (within measurement noise and seasonal uptake variation). Monitor at next routine soil test rather than amending now; see the Annual Soil Amendments table.');
            }
            if (adequate.length > 0) {
                narrative.push(adequate.join(', ') + ' levels are adequate.');
            }
        }
        
        // Add methodology context for Ammonium Acetate
        if (isAA) {
            narrative.push('');
            narrative.push('Interpretation uses Hill Labs NZ extraction methods: Olsen phosphorus (sodium bicarbonate) and ammonium acetate (pH 8.1) for cations. Sufficiency ranges are calibrated for New Zealand soil conditions.');
            if (soilData.aaSoilTexture === 'sands') {
                narrative.push('Sand-based rootzone thresholds applied for potassium and magnesium interpretation.');
            }
        }
        
        // pH interpretation - species-specific optimal ranges
        // C4 (Couch/Bermuda/Kikuyu/Zoysia): 6.5-7.0
        // C3 (Bentgrass/Ryegrass/Fescue/Bluegrass): 6.0-6.5
        if (soilData.pH) {
            var pH = soilData.pH;
            var isC3 = soilData.isC3Species || false;
            var speciesName = soilData.speciesName || (isC3 ? 'cool-season grass' : 'warm-season grass');
            
            // Set optimal range based on species
            var optLo, optHi;
            if (isC3) {
                optLo = 6.0;
                optHi = 6.5;
            } else {
                optLo = 6.5;
                optHi = 7.0;
            }
            
            var rangeStr = optLo + '-' + optHi;

            // b35fix418 (C17): species-aware pH recommendations.
            // Resolve species pH tolerance from the SPECIES_PH_TOLERANCE map
            // (loaded from hub-tissue-v3.js as a global). Defaults preserve
            // pre-fix behaviour for the C3/C4 fallback path: cool-season is
            // not alkaline-tolerant, warm-season is. The map provides per-
            // species overrides for alkaline-tolerant species (Seashore
            // Paspalum, Couch / Bermuda, Kikuyu, Buffalo, KBG, Tall Fescue).
            // When map data is available, optimal range is also pulled from
            // the map so branch boundaries (optHi+0.5, toleranceMax) stay
            // coherent with the species ceiling. Without this, isC3=false +
            // Zoysia (which has tightly-restricted optimal 6.0-6.5) would use
            // the C4 fallback optHi=7.0 and miss its actual optimal ceiling.
            var _phTol = null;
            if (typeof SPECIES_PH_TOLERANCE !== 'undefined' && typeof normaliseSpeciesForPH === 'function') {
                var _phKey = normaliseSpeciesForPH(speciesName);
                _phTol = SPECIES_PH_TOLERANCE[_phKey] || null;
            }
            if (_phTol && _phTol.optimal) {
                optLo = _phTol.optimal[0];
                optHi = _phTol.optimal[1];
                rangeStr = optLo + '-' + optHi;
            }
            var alkalineTolerant = _phTol ? !!_phTol.alkalineTolerant : !isC3;
            var toleranceMax = _phTol && _phTol.tolerance ? _phTol.tolerance[1] : (isC3 ? 7.5 : 8.0);

            // dolomiticCorrection: true when Mg deficit + low pH -> dolomite already recommended
            // In that case dolomite handles pH correction, suppress standalone lime recommendation
            // b35fix322 Bug 2: simplified to lowpH && mgDeficit (matches updated
            // _dolomiteWillBeRecommended in _computeAmendmentDecision). Also
            // suppresses the "Light lime application" hint at slightly-acidic pH
            // when dolomite is already covering the lime job.
            var lowpH = pH < 6.0;
            var caDeficit = soilData.Ca && soilData.thresholds && soilData.thresholds.Ca ? soilData.Ca < soilData.thresholds.Ca.min : false;
            var mgDeficit = soilData.Mg && soilData.thresholds && soilData.thresholds.Mg ? soilData.Mg < soilData.thresholds.Mg.min : false;
            var dolomiticCorrection = lowpH && mgDeficit;

            // hasSpeciesPhBlock: if species tolerance data is present, the species-specific pH
            // block (further in the report) will also fire, suppress duplicate dolomite sentence here
            var hasSpeciesPhBlock = !!(soilData.speciesPhTolerance || soilData.speciesKey || soilData.speciesName);

            if (pH < 5.5) {
                if (dolomiticCorrection) {
                    // Only add dolomite narrative here if the species-specific pH block won't also add it
                    if (!hasSpeciesPhBlock) {
                        narrative.push('Soil pH is very acidic (' + pH + '). Dolomite application (see Recommendations) will correct pH while addressing Mg and Ca deficits simultaneously. Retest in 6 months to assess response.');
                    } else {
                        narrative.push('Soil pH is very acidic (' + pH + '). This severely limits phosphorus availability and may allow aluminium and manganese toxicity.');
                    }
                } else {
                    narrative.push('Soil pH is very acidic (' + pH + '). This limits nutrient availability, particularly phosphorus.');
                    recommendations.push('Apply agricultural lime at 1-2 t/ha to raise pH toward ' + rangeStr + '.');
                }
            } else if (pH < optLo - 0.5) {
                // More than 0.5 below optimal low
                narrative.push('Soil pH is moderately acidic (' + pH + '). Below optimal for ' + speciesName + ' (' + rangeStr + '). Nutrient availability may be reduced.');
                if (!dolomiticCorrection) {
                    recommendations.push('Consider lime application to raise pH toward ' + optLo + '.');
                }
            } else if (pH < optLo) {
                // Slightly below optimal
                narrative.push('Soil pH (' + pH + ') is slightly below optimal range (' + rangeStr + ') for ' + speciesName + '.');
                if (!isC3 && !dolomiticCorrection) {
                    recommendations.push('Light lime application may be beneficial to raise pH toward ' + optLo + '.');
                }
            } else if (pH > toleranceMax) {
                // b35fix418 (C17): pH exceeds species tolerance ceiling.
                // Even alkaline-tolerant species are out of range here; aggressive
                // acidification or species change is the realistic option.
                narrative.push('Soil pH (' + pH + ') exceeds tolerance for ' + speciesName + ' (ceiling ' + toleranceMax + '). Iron, manganese, zinc, and copper availability is severely restricted at this pH.');
                recommendations.push('Aggressive acidification required: elemental sulphur post-aeration in autumn, or species change. Use Fe-EDDHA chelate for iron applications. Evaluate irrigation water alkalinity contribution.');
            } else if (pH > optHi + 0.5) {
                // b35fix418 (C17): moderately alkaline but within species tolerance.
                // Branch on species alkaline tolerance. Alkaline-tolerant species
                // (Couch, Bermuda, Kikuyu, Paspalum, KBG, Buffalo, Tall Fescue)
                // get supportive copy; acid-preferring species get the existing
                // acidifying-N recommendation.
                if (alkalineTolerant) {
                    narrative.push('Soil pH (' + pH + ') is moderately alkaline, above optimal range (' + rangeStr + ') for ' + speciesName + '. ' + speciesName + ' tolerates alkaline conditions; monitor trace element availability.');
                    recommendations.push(speciesName + ' tolerates alkaline pH well, no acidification needed. Monitor for iron chlorosis and apply foliar Fe-EDDHA if symptoms appear.');
                } else {
                    narrative.push('Soil pH is moderately alkaline (' + pH + '). Above optimal range (' + rangeStr + ') for ' + speciesName + '. Iron and manganese availability may be reduced.');
                    recommendations.push('Use ammonium-based nitrogen sources to help lower pH. Consider foliar iron applications if chlorosis appears.');
                }
            } else if (pH > optHi) {
                // Slightly above optimal
                narrative.push('Soil pH (' + pH + ') is slightly above optimal range (' + rangeStr + ') for ' + speciesName + ' but generally acceptable.');
            } else {
                narrative.push('Soil pH (' + pH + ') is within the optimal range (' + rangeStr + ') for ' + speciesName + '.');
            }
        }
        
        return {
            narrative: narrative,
            recommendations: recommendations,
            deficiencies: deficiencies
        };
    }
    
    /**
     * Generate fertiliser recommendation for a specific nutrient deficiency.
     *
     * b35fix319: extended b35fix317 programme-aware S logic to P, K, Mg, Ca.
     * The core principle from b35fix317 — check what the N programme already
     * delivers before recommending a standalone amendment — applies to all
     * macronutrients. Lomandra Reserve case showed the bug class: programme
     * over-delivered K (141 vs 76 deficit) yet a full-deficit potassium
     * sulphate rec was still issued; programme under-delivered P (6 vs 22
     * deficit) yet a full-deficit MAP rec was issued instead of the residual.
     *
     * This function is now a thin string formatter wrapping the pure decision
     * function _computeAmendmentDecision(). The structured decision is also
     * consumed directly by buildAnnualSoilAmendmentsTable() (b35fix319 Phase 3
     * orphan-bug fix).
     *
     * pH-aware selection (unchanged from b35fix316/317):
     *   - Mg: dolomite when Mg+Ca deficit + low pH (covers both, raises pH)
     *          kieserite when pH >= 7 (dolomite would worsen alkalinity)
     *          Epsom salts otherwise
     *   - S: 5-rule context-aware (b35fix317)
     *   - Ca: suppressed when dolomite is already recommended (covers Ca)
     *
     * Programme-aware additions (b35fix319):
     *   - P: programme delivery → suppress or reduce to residual; pH-aware
     *        product (DAP avoided > 7.5; rock phosphate at < 5.5; MAP otherwise).
     *   - K: programme delivery → suppress or reduce to residual; chloride-free
     *        K source (potassium sulphate, also delivers S) preferred for turf.
     *   - Mg: programme delivery → suppress or reduce; pH-aware product unchanged.
     *   - Ca: programme delivery → suppress or reduce; dolomite-suppression unchanged.
     *
     * Side-fix (b35fix319): K product analysis label corrected from
     *   "0-0-42 (17% K)" to "0-0-50 (41.5% K)". The /0.415 divisor was already
     *   correct (matches AU catalogue SOL-SOP at K=41.5%); only the display
     *   string was wrong.
     *
     * b35fix400 (Shirley GC NZ regression): the b35fix319 fix retained the
     * UK-style oxide leading triple ("0-0-50") for AU/NZ users. AU/NZ
     * convention is elemental (0-0-41.5); UK/EU/Scandinavia is oxide (0-0-50
     * (as K₂O)). Display label is now region-aware via _potassiumDisplayLabel.
     * Math is unchanged: residual / 0.415 operates on elemental K regardless
     * of which leading triple shows.
     *
     * Rates expressed as elemental kg/ha (Gilba calculation convention,
     * region-invariant).
     * nutritionProgram shape: data.nutritionProgram.annualSummary.products keyed by product
     * id with { product: { analysis: {N,P,K,S,...} }, applications, totalKgHa }.
     *
     * b35fix320: `context` param carries non-soil signals — currently
     * { isOverseed, seedingActive }. When seedingActive (overseed configured
     * or explicit grow-in flag), MAP is forced for P regardless of pH band
     * because DAP volatilises NH₃ at alkaline pH which is phytotoxic to
     * juvenile seedlings (Bremner & Krogmeier 1989). Same logic also drives
     * a urea-volatilisation warning at pH > 7.5 in S Rule 4.
     */

    /**
     * b35fix403: strip terminal sentence punctuation from a clause before
     * joining a continuation tail. Used by generateFertiliserRecommendation
     * to glue "...rate text..." onto " to address <nutrient> deficiency.".
     *
     * Bug class (C9 from migration ledger): d.rate is composed at multiple
     * sites in _computeAmendmentDecision. Several branches end the rate with
     * a sentence-final '.', for example the alkaline-P branch (line ~1635)
     * ends '...banded placement improves recovery.'. The sentence builder
     * appends ' to address P deficiency.' verbatim, producing the visible
     * fragment artefact: '...recovery. to address P deficiency.'.
     *
     * This helper sits at the join site (the "assembly point") rather than
     * patching every leaf rate-composition branch. d.rate is left intact for
     * its other consumer (d.reason composition at lines 1647/1672/1717/1741/
     * 1836) where the trailing period is a legitimate sentence terminator.
     */
    function _joinRateTail(rate, tail) {
        var prefix = (rate == null) ? '' : String(rate);
        // Strip one or more trailing '.', ',' or ';' (with optional whitespace).
        prefix = prefix.replace(/[.,;]+\s*$/, '');
        return prefix + tail;
    }

    function generateFertiliserRecommendation(nutrient, deficit, soilData, surfaceType, nutritionProgram, context, hemisphere) {
        var d = _computeAmendmentDecision(nutrient, deficit, soilData, surfaceType, nutritionProgram, context, hemisphere);
        if (!d) return null;

        // Suppression cases — return the human-readable suppression message
        // verbatim. Table builder reads d.status + d.reason.
        if (d.status === 'suppressed_programme' || d.status === 'suppressed_dolomite' ||
            d.status === 'suppressed_combined' || d.status === 'no_deficit') {
            return d.reason;
        }

        // Apply case — format as "Apply <product> (<analysis>) at approximately <rate> ..."
        // b35fix403: route through _joinRateTail so any trailing '.' / ';' / ','
        // in d.rate is stripped before the continuation clause is appended.
        if (d.status === 'apply') {
            return 'Apply ' + d.product + ' (' + d.analysis + ') at approximately ' +
                   _joinRateTail(d.rate, ' to address ' + nutrient + ' deficiency.');
        }

        return null;
    }

    /**
     * b35fix319: pure decision function for soil amendment recommendation.
     *
     * Returns a structured object describing the amendment decision so the
     * Annual Soil Amendments table can render structured rows AND the legacy
     * sentence path can format strings — both reading the same SSOT.
     *
     * Returns null when nutrient is unknown or soilData is missing.
     * Otherwise:
     *   {
     *     nutrient:       'P'|'K'|'Ca'|'Mg'|'S',
     *     status:         'apply' | 'suppressed_programme' | 'suppressed_dolomite'
     *                   | 'suppressed_combined' | 'no_deficit',
     *     kgDeficit:      Number  // soil deficit in kg elemental nutrient/ha
     *     kgProgramme:    Number  // delivered by N programme
     *     kgResidual:     Number  // max(0, kgDeficit - kgProgramme), with status_dolomite caveats
     *     product:        String  // product trade name when status='apply', else null
     *     analysis:       String  // analysis label when status='apply', else null
     *     rate:           String  // formatted rate string when status='apply', else null
     *     reason:         String  // human-readable explanation (always populated)
     *     contributing:   [{ name, kgProduct, kgNutrient, pct }]  // programme contributors
     *   }
     */

    // ========================================================================
    // b35fix400 — Region-aware K product display label
    // ========================================================================
    // Potassium product analysis labels follow regional fertiliser convention:
    //   - AU / NZ:        elemental K   →  "0-0-41.5"  (matches Prebbles
    //                                       SOL-SOP, AU SOL-K2SO4 catalogue
    //                                       entries, b35fix397).
    //   - UK / EU /
    //     Scandinavia:    K₂O (oxide)   →  "0-0-50 (as K₂O)"  (matches UK
    //                                       fertiliser catalogue convention,
    //                                       see uk-fertiliser-products.js
    //                                       npk_label fields).
    //
    // The chemistry is the same product (Potassium sulphate, K₂SO₄). 41.5% K
    // elemental = 50% K₂O × 0.8302 (stoichiometric conversion). The math in
    // _synthesiseKReconDecision and _computeAmendmentDecision is invariant
    // to display: rate is computed from the elemental percentage (residual /
    // 0.415) regardless of which leading NPK triple shows on the label.
    //
    // The parenthesised analysis ALWAYS lists elemental percentages
    // ("(41.5% K, 18% S)") for two reasons:
    //   1. parseAnalysisLabel in _amendmentDecisionsToProducts reads ONLY the
    //      parenthesised pct list to build totalDelivered. If we wrote
    //      "(50% K2O, 18% S)" the regex would match K=50 and double-count K
    //      delivery (oxide-as-elemental error). Keeping elemental in the
    //      parens avoids any parser change and any rounding drift.
    //   2. Agronomically, the elemental percentage is the value used for
    //      tissue-K calculations, soil targets, and mass balance. Showing
    //      both lets a UK reader cross-check the bag label (oxide) against
    //      the agronomic chemistry (elemental).
    //
    // Pre-b35fix400 history: b35fix319 hardcoded "0-0-50 (41.5% K, 18% S)"
    // assuming AU/NZ/UK all used a single convention. They don't — UK uses
    // oxide while AU/NZ use elemental. NZ users running Prebbles saw an
    // oxide label on what should be an elemental-display product (Shirley
    // GC Christchurch reproduction). b35fix400 makes the label region-aware.
    // ========================================================================
    function _potassiumDisplayLabel(opts) {
        opts = opts || {};
        var includeS = (opts.includeS !== false); // default true (SOP delivers S)
        var region = _detectKDisplayRegion(opts.region);

        // Always include elemental percentage in parens for parser safety
        // and agronomic clarity. The leading NPK triple varies by region.
        var elementalPctText = includeS
            ? '(41.5% K, 18% S)'
            : '(41.5% K)';

        if (region === 'oxide') {
            // UK / EU / Scandinavia convention: leading triple is K₂O.
            // "(as K₂O)" annotation makes the convention explicit so the
            // reader doesn't confuse the leading 50 with elemental.
            return '0-0-50 (as K₂O) ' + elementalPctText;
        }
        // AU / NZ / default: elemental.
        return '0-0-41.5 ' + elementalPctText;
    }

    // Returns 'oxide' for UK / EU / Scandinavia, 'elemental' otherwise.
    // Region resolution order:
    //   1. explicit override passed to caller (opts.region)
    //   2. window.GAIP_STATE.location.region (canonical hub state path)
    //   3. window.GAIP_STATE.location.country (older field, sometimes present)
    //   4. fallback: 'elemental' (Gilba's primary AU/NZ territory)
    function _detectKDisplayRegion(explicit) {
        var raw = null;
        if (typeof explicit === 'string' && explicit) {
            raw = explicit;
        } else if (typeof window !== 'undefined' && window.GAIP_STATE
                && window.GAIP_STATE.location) {
            raw = window.GAIP_STATE.location.region
                  || window.GAIP_STATE.location.country
                  || null;
        }
        if (!raw) return 'elemental';
        var s = String(raw).toLowerCase();
        // Match common UK / EU / Scandinavia tokens. Inclusive on purpose —
        // any oxide-convention region falls through to oxide; everything
        // else gets elemental.
        if (s === 'uk' || s === 'gb' || s === 'united_kingdom' || s === 'britain'
                || s === 'eu' || s === 'europe'
                || s === 'scandinavia' || s === 'nordic'
                || s === 'ireland' || s === 'ie') {
            return 'oxide';
        }
        return 'elemental';
    }

    function _computeAmendmentDecision(nutrient, deficit, soilData, surfaceType, nutritionProgram, context, hemisphere) {
        if (['P','K','Ca','Mg','S'].indexOf(nutrient) === -1) return null;
        if (!soilData) return null;

        // b35fix424 (C20): hemisphere defaults to 'south' (Gilba's primary
        // territory). Used by the elemental S Rule 4 summer-suppression copy
        // and the dolomite/lime spring-placement override on close-cut surfaces.
        hemisphere = hemisphere || 'south';

        // b35fix320: context carries non-soil signals affecting product choice.
        // Default to {} for backward compat; treat seedingActive as the
        // critical gate for ammonium-source phytotoxicity decisions.
        context = context || {};
        // seedingActive is true when seedlings are in or near the soil profile.
        // Sources:
        //   1. context.seedingActive (explicit caller-provided flag, e.g. grow-in)
        //   2. context.isOverseed (overseed configured → seed will be applied
        //      this cycle; default to seedling-safe)
        //   3. soilData.seedingActive (direct stamp from upstream)
        var seedingActive = !!(context.seedingActive || context.isOverseed || soilData.seedingActive);

        // ────────────────────────────────────────────────────────────────────
        // b35fix425 (C19): deficit-magnitude banding (Marginal/Moderate/Severe)
        // ────────────────────────────────────────────────────────────────────
        // Brief: today every "below threshold" deficit emits the same
        // recommendation copy regardless of severity. A 1 ppm gap and a 30 ppm
        // gap both produce "Apply X at Y kg/ha". Production evidence:
        // Rockingham 4th green P 20 vs MLSN 21 (1 ppm gap) → "Apply MAP at
        // 98 kg product/ha" — overprescribing for a measurement-noise-level gap.
        //
        // Resolution: three-tier band keyed off deficit fraction:
        //   Marginal  fraction < 0.25  → light-touch monitor copy, status='monitor',
        //                                product/rate suppressed (the (b) extension —
        //                                Severe-vs-Apply copy alone wasn't enough,
        //                                user still sees "Apply at low rate" copy
        //                                under Marginal otherwise)
        //   Moderate  0.25 ≤ fraction < 0.50  → standard copy (existing baseline,
        //                                       no behaviour change)
        //   Severe    fraction ≥ 0.50  → aggressive copy + warnings.push(severe_deficit_attention)
        //
        // Reference value differs by methodology:
        //   MLSN: thresh.min (the floor below which deficit was computed)
        //   SLAN: rangeFloor (Carrow 2004 published floor) or pH-adjusted P floor.
        // The reference is resolved per branch (different SLAN_RANGES entries
        // per nutrient) and passed into _severityBand. The helper is methodology-
        // agnostic — it just computes deficit/reference.
        //
        // Note: status field on calculateNutrientRequirement (Very Low/Low/
        // Adequate for MLSN; Deficient/Sufficient/Excessive for SLAN) is NOT
        // plumbed through to _computeAmendmentDecision. Banding is engine-
        // local and recoverable from data the function already has (deficit
        // is the first arg; threshold object is on soilData).
        //
        // b35fix426 (C31): Marginal band requires BOTH conditions to hold:
        //   (a) deficit/reference < 0.25 (the original % rule)
        //   (b) kgPerHa < MARGINAL_KG_FLOOR (absolute kg/ha gate)
        //
        // Background — the b35fix425 production verification on Rockingham
        // 16th green surfaced a category error in the % rule alone. SLAN
        // base-cation thresholds are an order of magnitude larger than P/K/S
        // thresholds (Ca floor 500 ppm vs P floor 27 ppm). A 16% gap on Ca
        // = 81 ppm = 113 kg/ha — a substantial real-world deficit that the
        // % rule incorrectly classified Marginal. The kg/ha floor is the
        // agronomic test: is this deficit small enough to be ignorable? For
        // elemental nutrients, ~15 kg/ha is the practical noise floor below
        // which any single application is hard to distinguish from soil-test
        // measurement variance and seasonal uptake noise.
        //
        // Sources for the 15 kg/ha calibration:
        //   - Spencer 2008 Nutrition of Sports Turf in Australia, p.143:
        //     elemental S minimum-meaningful-application 25 kg S/ha; smaller
        //     deficits are within noise.
        //   - Carrow & Duncan (2011) Best Management Practices for Saline and
        //     Sodic Turfgrass Soils ch. 7: Ca/Mg amendment rates < 50 kg/ha
        //     described as "fine-tuning, not deficit correction".
        //   - Spencer (Gilba Solutions internal practice 2026): elemental P
        //     applications below 5 kg/ha rarely produce measurable response
        //     on soils with P-fixation activity; below 10 kg/ha on inert sands.
        //   - Net floor 15 kg/ha is conservative across nutrients (catches
        //     Rockingham 1-ppm-P at 1.4 kg/ha as Marginal; releases 113 kg/ha
        //     Ca to its actual band on the % test).
        //
        // The Severe band stays % only — at large-threshold nutrients a 50%
        // gap is enormous (Ca 50% = 250 ppm = 350 kg/ha) and the "investigate
        // underlying cause" copy is right regardless of absolute scale.
        var MARGINAL_KG_FLOOR = 15;
        function _severityBand(deficitPpm, referencePpm, kgPerHa) {
            if (!referencePpm || referencePpm <= 0) return 'moderate';  // defensive
            var fraction = deficitPpm / referencePpm;
            // Severe stays % only.
            if (fraction >= 0.50) return 'severe';
            // Marginal needs BOTH the % gate AND the kg/ha gate. Either a
            // wide-fraction deficit (≥ 25%) OR a large-absolute deficit
            // (≥ 15 kg/ha) elevates from Marginal to Moderate.
            if (fraction < 0.25 && (kgPerHa == null || kgPerHa < MARGINAL_KG_FLOOR)) {
                return 'marginal';
            }
            return 'moderate';
        }

        // Compute the deficit-fraction reference for the current nutrient.
        // The caller (_buildAmendmentDecisions) computed `deficit` as
        // (thresh.min - value) — i.e. ppm gap below threshold. For MLSN this
        // threshold IS the reference. For SLAN sites the threshold object is
        // built from SLAN_RANGES floor (see calculateAllRequirements in
        // nutrition-requirement-engine.js); same value.
        var _bandReference = (soilData.thresholds && soilData.thresholds[nutrient] &&
                              soilData.thresholds[nutrient].min) || 0;
        // _kgPerHa for band computation is computed below the helper (`kgPerHa`
        // var at the start of the math block) — but we need it BEFORE that
        // for the band call. Compute inline here using the same constants.
        var _kgPerHaForBand = deficit * 10 * 1.4 * 0.1;
        var _band = _severityBand(deficit, _bandReference, _kgPerHaForBand);

        // Severe-band copy + warning emission. Called from inside each per-
        // nutrient branch (P/K/Ca/Mg/S) once `d` is fully populated and just
        // before the d.reason line is assembled. Mutates d.warnings[] and
        // returns a copy fragment to be concatenated onto d.rate or d.reason.
        // The fragment is empty for non-Severe bands so callers can append
        // unconditionally.
        function _emitSevereContext(decision, nutLabelLong) {
            if (_band !== 'severe') return '';
            var gapPpm = deficit;
            var refPpm = _bandReference;
            var gapPct = (refPpm > 0) ? Math.round((gapPpm / refPpm) * 100) : null;
            decision.warnings = decision.warnings || [];
            decision.warnings.push({
                code: 'severe_deficit_attention',
                severity: 'high',
                text: nutLabelLong + ' deficit is severe' +
                      (gapPct != null ? ' (' + gapPct + '% gap below threshold)' : '') +
                      '. Site attention recommended. The amendment rate addresses the ' +
                      'numerical deficit but a deficit this large typically reflects an ' +
                      'underlying cause (drainage, leaching, prior management, parent material) ' +
                      'that should be investigated before assuming amendment alone restores ' +
                      'the system.',
                source: 'Gilba Solutions internal practice'
            });
            // b35fix427 (P3a cosmetic): rate-text fragments end variably (")",
            // ".", or no punctuation depending on whether pNote / kRouteNote /
            // mgExtra suffixes fired). Pre-fix this helper returned a string
            // that LED with ". " producing concatenations like ").. Site
            // attention" or "..  Site attention" depending on which suffix
            // fired upstream. Lead with " " and let the rendered output
            // produce a single sentence break (the existing rate text already
            // ends most paths with "." anyway).
            return ' Site attention: deficit is severe' +
                   (gapPct != null ? ' (' + gapPct + '% below threshold)' : '') +
                   '; investigate underlying cause (drainage, leaching, prior management) ' +
                   'in parallel with amendment; a single amendment cycle is unlikely to ' +
                   'restore a deficit this large without addressing the system driver';
        }

        var depth = 10; // cm sampling depth
        var bd = 1.4;   // bulk density g/cm³

        // kg elemental nutrient/ha needed (deficit in ppm × depth × BD × 0.1)
        // This is the THEORETICAL full-closure-in-1-year rate at 100% efficiency.
        // C29 (b35fix423) introduces the practical rate alongside it.
        var kgPerHa = deficit * depth * bd * 0.1;

        var pH = soilData.pH ? parseFloat(soilData.pH) : 7.0;

        var caMin = soilData.thresholds && soilData.thresholds.Ca ? soilData.thresholds.Ca.min : null;
        var mgMin = soilData.thresholds && soilData.thresholds.Mg ? soilData.thresholds.Mg.min : null;
        var caDeficit = caMin != null && (soilData.Ca || 0) < caMin;
        var mgDeficit = mgMin != null && (soilData.Mg || 0) < mgMin;
        var lowpH = pH < 6.0;

        // Fine turf surfaces require split applications to avoid smothering.
        var isFineTurf = surfaceType && /green|tee|bowl|croquet/i.test(surfaceType);
        var FINE_TURF_CAP = 400;

        // ────────────────────────────────────────────────────────────────────
        // b35fix424 (C20) — Per-nutrient × surface × delivery rate caps
        // ────────────────────────────────────────────────────────────────────
        // Surface buckets (canonical strings from au-fertiliser-products.js):
        //   greens   = greens / golf_greens / bowling_greens / cotula_bowling_green
        //              / croquet / croquet_lawn / bowls (any close-cut <8 mm HOC)
        //   tees     = tees / low_cut / cricket_wickets
        //   fairways = fairways / sports / sportsturf / athletic / sportsfield
        //
        // Caps are kg PRODUCT/ha per single application. When the practical
        // product rate exceeds the cap, formatRate emits the existing
        // "apply in N split dressings" copy.
        //
        // Sources (per-row):
        //   greens.foliar.P  15  — STRI / R&A spoonfeed; matches SOL-MAP catalogue
        //   greens.foliar.K  20  — Pinned per Spencer (b35fix424); SOP scorch envelope
        //   greens.foliar.S  20  — Pinned per Spencer (b35fix424); SOA scorch envelope
        //   greens.foliar.Mg 15  — Pinned per Spencer (b35fix424); Epsom soluble
        //   greens.granular.dolomite  200  — STRI / R&A practice; lime-class smother bound
        //   greens.granular.gypsum-Ca 250  — STRI / R&A practice; bulk amendment
        //   greens.granular.gypsum-S  250  — same as Ca path
        //   greens.granular.kieserite 300  — Spencer pin; gated post-aeration only (reason text)
        //   greens.granular.elementalSulphur 28
        //                     — Spencer (2008) Nutrition of Sports Turf in Australia, p.143:
        //                       "Sulphur should not be applied in any one application at a
        //                       rate greater than 250 g/100 m²"; 25 kg S/ha ÷ 0.90 (90% S
        //                       elemental product) ≈ 28 kg product/ha. Annual ceiling
        //                       500 kg S/ha; 3-4 week split intervals.
        //   tees.granular     400 — existing FINE_TURF_CAP, unchanged
        //   fairways.granular none — historically uncapped; surface tolerates >1000 kg/ha
        //
        // Reading: SURFACE_RATE_CAPS[bucket][delivery][amendmentKey] → kg/ha cap, or
        //          null/undefined if uncapped.
        var SURFACE_RATE_CAPS = {
            greens: {
                foliar: {
                    map: 15,
                    potassiumSulphate: 20,
                    sulphateOfAmmonia: 20,
                    epsom: 15,
                    gypsum: 20  // defensive — Ca foliar rare, follows S envelope
                },
                granular: {
                    dolomite: 200,
                    gypsum: 250,
                    kieserite: 300,
                    elementalSulphur: 28,
                    lime: 200,
                    map: 50,
                    potassiumSulphate: 50,
                    sulphateOfAmmonia: 50,
                    epsom: 50  // defensive fallback only — Mg flips foliar by default
                }
            },
            tees: {
                granular: { _default: 400 },  // existing FINE_TURF_CAP
                foliar: { _default: 25 }       // tees foliar uncommon; mirror greens.S envelope
            },
            fairways: {
                granular: { _default: null },  // uncapped (smother only at >1000 kg/ha)
                foliar: { _default: null }
            }
        };

        // Bucket the surfaceType string into one of greens/tees/fairways.
        // Returns 'fairways' as the default for unknown surfaces (historically
        // the unconstrained path; matches pre-C20 behaviour for unrecognised
        // surface keys).
        function _surfaceBucket(st) {
            var s = (st || '').toLowerCase();
            if (!s) return 'fairways';
            if (/green|bowl|croquet/.test(s)) return 'greens';
            if (/^tees$|low_cut|cricket_wicket/.test(s)) return 'tees';
            if (/fairway|sport|athletic/.test(s)) return 'fairways';
            return 'fairways';
        }
        var surfaceBucket = _surfaceBucket(surfaceType);

        // Resolve the cap for a given (amendmentKey, deliveryMethod) tuple,
        // falling through to the bucket's _default and finally to the legacy
        // FINE_TURF_CAP for fine-turf surfaces or null for unconstrained.
        function _rateCap(amendmentKey, deliveryMethod) {
            var bucket = SURFACE_RATE_CAPS[surfaceBucket];
            if (!bucket) return isFineTurf ? FINE_TURF_CAP : null;
            var deliveryTbl = bucket[deliveryMethod || 'granular'];
            if (!deliveryTbl) return isFineTurf ? FINE_TURF_CAP : null;
            if (deliveryTbl[amendmentKey] != null) return deliveryTbl[amendmentKey];
            if (deliveryTbl._default !== undefined) return deliveryTbl._default;
            return isFineTurf ? FINE_TURF_CAP : null;
        }

        // ────────────────────────────────────────────────────────────────────
        // b35fix424 (C20) — Per-nutrient × surface delivery method
        // ────────────────────────────────────────────────────────────────────
        // Default delivery method per nutrient × surface bucket.
        // - greens / bowls / croquet: P, K, S (Rule 3 SOA only), Mg → foliar
        //   - Ca stays granular (gypsum bulk; foliar Ca rare in AU practice)
        //   - S Rules 2/4/5 stay granular (gypsum is granular; elemental S
        //     can ONLY be granular — no foliar form)
        //   - Mg dolomite / kieserite stay granular
        // - tees / fairways / sportsfield: all granular
        function _resolveDelivery(amendmentKey, surfaceBkt) {
            if (surfaceBkt !== 'greens') return 'granular';
            // Greens-bucket nutrient routing
            switch (amendmentKey) {
                case 'map':
                case 'potassiumSulphate':
                case 'sulphateOfAmmonia':
                case 'epsom':
                    return 'foliar';
                case 'gypsum':
                case 'kieserite':
                case 'dolomite':
                case 'lime':
                case 'elementalSulphur':
                    return 'granular';
                default:
                    return 'granular';
            }
        }
        // Epsom is sold soluble in AU/NZ practice (Spencer pin b35fix424).
        // Scope expansion beyond greens — Epsom defaults to foliar on ALL
        // surfaces. The _resolveDelivery() path above only flips greens,
        // so override Epsom specifically here.
        function _resolveDeliveryWithEpsomExpansion(amendmentKey, surfaceBkt) {
            if (amendmentKey === 'epsom') return 'foliar';
            return _resolveDelivery(amendmentKey, surfaceBkt);
        }

        // ────────────────────────────────────────────────────────────────────
        // b35fix423 (C29) — Amendment efficiency + yearsToCorrect
        // ────────────────────────────────────────────────────────────────────
        // Practical rate = (theoretical / efficiency) / yearsToCorrect.
        // Each branch sets its amendmentKey (e.g. 'gypsum', 'map', 'lime',
        // 'sulphateOfAmmonia') and deliveryMethod. b35fix424 (C20) flips
        // deliveryMethod from 'granular' default to per-nutrient × surface.
        // The efficiency lookup runs against NutritionSummary.amendmentEfficiency
        // table; falls back to 0.60 with logged source on miss.
        // The yearsToCorrect map mirrors NUTRITION_CONFIG.yearsToCorrect.
        var YEARS_TO_CORRECT = { P: 2, K: 2, Ca: 3, Mg: 3, S: 2 };

        function _lookupAmendmentEfficiency(amendmentKey, deliveryMethod) {
            // Resolve via the public NutritionSummary API when present.
            var ns = (typeof window !== 'undefined' && window.GilbaNutritionSummary) ||
                     (typeof Gilba !== 'undefined' && Gilba.NutritionSummaryIntegration) ||
                     (typeof Gilba !== 'undefined' && Gilba.NutritionSummary) ||
                     null;
            if (ns && typeof ns.getAmendmentEfficiency === 'function') {
                try {
                    return ns.getAmendmentEfficiency(amendmentKey, deliveryMethod || 'granular', soilData);
                } catch (e) {
                    if (typeof console !== 'undefined' && console.warn) {
                        console.warn('[WordExport] getAmendmentEfficiency failed:', e && e.message);
                    }
                }
            }
            // Fallback when public API is unavailable (test harness without
            // module loaded, etc.). Returns the same default as the table.
            return { efficiency: 0.60, condition: 'unknown', source: 'default-no-api' };
        }

        function _computePracticalKg(theoreticalKg, nutrientKey, amendmentKey, deliveryMethod) {
            var eff = _lookupAmendmentEfficiency(amendmentKey, deliveryMethod);
            var years = YEARS_TO_CORRECT[nutrientKey] || 2;
            var practicalKg = (theoreticalKg / Math.max(0.01, eff.efficiency)) / years;
            return {
                practicalKg: practicalKg,
                efficiency: eff.efficiency,
                condition: eff.condition,
                source: eff.source,
                years: years
            };
        }

        // b35fix424 (C20): formatRate now consults SURFACE_RATE_CAPS via
        // _rateCap(amendmentKey, deliveryMethod). Backward-compat: if capKey
        // is omitted (legacy callers) it falls through to FINE_TURF_CAP for
        // fine turf surfaces and unconstrained otherwise — preserving
        // pre-C20 behaviour. The split-dressings copy is unchanged.
        function formatRate(kgNutrient, kgProduct, unit, amendmentKey, deliveryMethod) {
            var base = kgNutrient.toFixed(0) + ' kg ' + unit + '/ha (' + kgProduct.toFixed(0) + ' kg product/ha)';
            var cap;
            if (amendmentKey) {
                cap = _rateCap(amendmentKey, deliveryMethod);
            } else {
                // Legacy path — preserve pre-C20 behaviour for any caller that
                // didn't pass amendmentKey.
                cap = isFineTurf ? FINE_TURF_CAP : null;
            }
            if (cap != null && kgProduct > cap) {
                var apps = Math.ceil(kgProduct / cap);
                base += ', apply in ' + apps + ' split dressings of ' + Math.round(kgProduct / apps) +
                        ' kg product/ha; water in after each application';
            }
            return base;
        }

        // Programme delivery check — supports any nutrient key.
        // Returns { kgDelivered, productsContributing: [...] } or null.
        //
        // b35fix322: skip entries flagged _isAmendment. Amendment products
        // (gypsum, dolomite, kieserite, MOP/SOP/MAP/DAP, Epsom, lime) are
        // injected into nutritionProgram.annualSummary.products so that the
        // Annual Product Summary, Monthly Schedule, and Purchasing Summary
        // see them. But they MUST NOT contribute to "programme delivery"
        // calculations — that would self-suppress the very amendment that
        // produced the entry. The _isAmendment sentinel breaks the loop.
        function checkProgrammeDelivery(nut) {
            if (!nutritionProgram || !nutritionProgram.annualSummary
                    || !nutritionProgram.annualSummary.products) {
                return null;
            }
            var products = nutritionProgram.annualSummary.products;
            var kgDelivered = 0;
            var contributing = [];
            Object.keys(products).forEach(function(pid) {
                var entry = products[pid];
                if (!entry) return;
                // b35fix322: amendment self-suppression guard.
                if (entry._isAmendment) return;
                var analysis = (entry.product && entry.product.analysis)
                             || entry.nutrients || entry.totalDelivered || {};
                var pct = parseFloat(analysis[nut]);
                if (!isFinite(pct) || pct <= 0) return;
                var totalKgHa = parseFloat(entry.totalKgHa) || 0;
                if (totalKgHa <= 0) return;
                var nutKg = totalKgHa * pct / 100;
                kgDelivered += nutKg;
                contributing.push({
                    name: (entry.brandName || (entry.product && entry.product.name)) || pid,
                    kgProduct: Math.round(totalKgHa),
                    kgNutrient: +nutKg.toFixed(1),
                    pct: pct
                });
            });
            return { kgDelivered: kgDelivered, productsContributing: contributing };
        }

        // Build a "programme delivers X kg/ha" descriptor string.
        function programmeBlurb(prog, unit) {
            if (!prog || !prog.productsContributing.length) return '';
            return prog.productsContributing.map(function(p) {
                return p.name + ' (' + p.kgNutrient + ' kg ' + unit + '/ha via ' + p.kgProduct + ' kg product)';
            }).join(', ');
        }

        // Dolomite-will-be-recommended flag (used by Ca/Mg/S branches).
        // b35fix322 Bug 2a: simplified to lowpH && mgDeficit. Previously gated on
        // (caDeficit || pH < 5.5), which suppressed dolomite for moderate-acidity
        // (5.5 ≤ pH < 6.0) sites with no measured Ca deficit even when Mg was low —
        // dolomite is the correct call there because it lifts pH and supplies Mg
        // simultaneously and the Ca it adds is benign at MLSN/SLAN guideline ranges.
        var _dolomiteWillBeRecommended = (lowpH && mgDeficit);

        // Build the empty decision skeleton — populated by branches below.
        var d = {
            nutrient: nutrient,
            status: null,
            kgDeficit: +kgPerHa.toFixed(1),
            kgProgramme: 0,
            kgResidual: 0,
            product: null,
            analysis: null,
            rate: null,
            reason: null,
            contributing: [],
            // b35fix423 (C29) — efficiency / theoretical-vs-practical fields.
            // Apply branches populate these. Suppression / no-deficit branches
            // leave them null (table renderer treats null as "—").
            kgTheoretical: null,
            kgPractical: null,
            efficiency: null,
            efficiencyCondition: null,
            efficiencySource: null,
            yearsToCorrect: null,
            amendmentKey: null,
            deliveryMethod: null
        };

        // No deficit case — defensive (callers guard, but include for robustness).
        if (!(kgPerHa > 0)) {
            d.status = 'no_deficit';
            d.reason = nutrient + ' is at or above the soil threshold; no amendment required.';
            return d;
        }

        // Programme delivery (pulled once for use across status decisions).
        var prog = checkProgrammeDelivery(nutrient);
        var progKg = prog ? prog.kgDelivered : 0;
        var residual = Math.max(0, kgPerHa - progKg);
        d.kgProgramme = +progKg.toFixed(1);
        d.kgResidual = +residual.toFixed(1);
        if (prog) d.contributing = prog.productsContributing;

        // ─────────────────────────────────────────────────────────────────────
        // Rule 1 (universal): N programme covers the deficit → SUPPRESS.
        // Applies to P, K, Mg, Ca, S. Reason text names the contributors.
        // ─────────────────────────────────────────────────────────────────────
        if (prog && progKg >= kgPerHa) {
            d.status = 'suppressed_programme';
            var unit = (nutrient === 'P' ? 'P' : nutrient === 'K' ? 'K'
                     : nutrient === 'Ca' ? 'Ca' : nutrient === 'Mg' ? 'Mg' : 'S');
            var nutLabel = (nutrient === 'P' ? 'Phosphorus'
                         : nutrient === 'K' ? 'Potassium'
                         : nutrient === 'Ca' ? 'Calcium'
                         : nutrient === 'Mg' ? 'Magnesium'
                         : 'Sulphur');
            d.reason = nutLabel + ' deficit (' + kgPerHa.toFixed(1) + ' kg ' + unit +
                       '/ha) is fully met by the fertiliser programme, no standalone ' +
                       nutrient + ' amendment required. Programme ' + nutrient + ' sources: ' +
                       programmeBlurb(prog, unit) + ' delivering ' + progKg.toFixed(0) +
                       ' kg ' + unit + '/ha/yr total.';
            return d;
        }

        // ─────────────────────────────────────────────────────────────────────
        // b35fix425 (C19) — Rule 1.5 (universal): MARGINAL-band short-circuit.
        // Status flips to 'monitor' and product/rate are suppressed. Reason
        // text directs the user to monitor and re-test rather than apply.
        //
        // Order: this runs AFTER programme-suppression (a programme delivering
        // the residual is more informative than "monitor") but BEFORE per-
        // nutrient product selection (otherwise the engine emits a low rate
        // that contradicts the monitor message).
        //
        // The dolomite-suppression Ca path runs inside the Ca branch, so a
        // Ca-Marginal site that's also Mg-deficient will still hit dolomite
        // suppression because we suppress the standalone Ca rec to monitor
        // here, but the Mg branch (further down) builds dolomite if its own
        // band is Moderate/Severe. The Mg branch reads soilData.Ca for the
        // dolomite Ca-rate calculation (not the Ca decision object), so the
        // Ca decision being 'monitor' doesn't break the dolomite path.
        // ─────────────────────────────────────────────────────────────────────
        if (_band === 'marginal') {
            var _unitMarg = (nutrient === 'P' ? 'P' : nutrient === 'K' ? 'K'
                          : nutrient === 'Ca' ? 'Ca' : nutrient === 'Mg' ? 'Mg' : 'S');
            var _nutLabelMarg = (nutrient === 'P' ? 'Phosphorus'
                              : nutrient === 'K' ? 'Potassium'
                              : nutrient === 'Ca' ? 'Calcium'
                              : nutrient === 'Mg' ? 'Magnesium'
                              : 'Sulphur');
            var _gapPpm = deficit;
            var _refPpm = _bandReference;
            var _gapPct = (_refPpm > 0) ? Math.round((_gapPpm / _refPpm) * 100) : null;
            d.status = 'monitor';
            d.product = null;
            d.analysis = null;
            d.kgTheoretical = null;
            d.kgPractical = null;
            d.rate = null;
            d.amendmentKey = null;
            d.deliveryMethod = null;
            d.reason = _nutLabelMarg + ' is ' + _gapPpm.toFixed(1) + ' ppm below the soil threshold' +
                       (_gapPct != null ? ' (' + _gapPct + '% gap)' : '') +
                       '. Why this matters: a gap this size is within measurement noise for soil ' +
                       'testing and within seasonal variation in plant uptake. Applying amendment ' +
                       'on this signal alone risks oversupply without measurable agronomic benefit. ' +
                       'Action: monitor at next routine soil test (3-6 months) and re-evaluate. ' +
                       'If turf shows ' + _nutLabelMarg.toLowerCase() + ' deficiency symptoms before ' +
                       'then, retest sooner and consider tissue analysis to confirm the soil reading ' +
                       'is reflected in plant uptake.';
            return d;
        }

        // ─────────────────────────────────────────────────────────────────────
        // Per-nutrient product selection (for residual amount).
        // ─────────────────────────────────────────────────────────────────────

        if (nutrient === 'P') {
            // P product selection (b35fix321: simplified — RPR dropped):
            //
            // The AU/NZ turf supply chain doesn't stock Reactive Phosphate Rock,
            // and turf timeframes (weeks for seedling establishment, months for
            // grow-in) don't match RPR's 6-18 month release kinetics. b35fix320
            // included RPR at pH < 5.5 on chemistry grounds; b35fix321 drops it
            // because it's not a real-world option for turf. P recommendation
            // is always MAP, with pH-band-specific reason text.
            //
            // Rationale tiers (priority order):
            //
            //   1. SEEDING ACTIVE — MAP regardless of pH. DAP's alkaline granule
            //      microsite (~pH 8) drives free NH₃ formation; phytotoxic to
            //      germinating seed and emerging radicles. MAP's microsite is
            //      acidic (~pH 4) so ammonium stays as NH₄⁺.
            //      Source: Bremner & Krogmeier (1989) PNAS 86:8185.
            //
            //   2. STRONGLY ACID SOIL (pH < 5.5) — MAP, but the priority
            //      intervention is lime/dolomite to address underlying pH.
            //      Standalone P is otherwise inefficient (Fe/Al fixation
            //      continues until pH > 5.8). Sequencing matters: lime and
            //      ammoniacal P sources must be separated by 14 days.
            //
            //   3. ALKALINE SOIL (pH > 7.5) — MAP. NH₃ volatilisation from DAP
            //      at this pH band can lose 20-30% of N (Hofman & Van Cleemput
            //      2004). MAP avoids the loss path. Secondary benefit: less
            //      Ca-P fixation than DAP.
            //
            //   4. NEUTRAL/SLIGHTLY ACID (pH 5.5-7.5) — MAP, default.
            //
            // The product output is identical across all branches (MAP, 10% P,
            // 11% N) — the value of the branching is the *reason text* the
            // user reads, which differs materially across pH bands.
            // b35fix424 (C20): surface-aware product selection.
            // On greens / bowls / croquet, MAP Tech soluble (foliar) replaces
            // granular MAP. SOL-MAP catalogue: 12% N, 22% P (richer in P than
            // granular MAP); pPct flips 0.10 → 0.22 to match. Reason text
            // suffix names the foliar route.
            var pDelivery = _resolveDeliveryWithEpsomExpansion('map', surfaceBucket);
            var pName, pAnalysis, pPct;
            if (pDelivery === 'foliar') {
                pName = 'MAP Tech (soluble foliar)';
                pAnalysis = '12% N, 22% P';
                pPct = 0.22;
            } else {
                pName = 'MAP (Mono-ammonium phosphate)';
                pAnalysis = '10% P, 11% N';
                pPct = 0.10;
            }
            var pNote;

            if (seedingActive) {
                pNote = ', selected for seedling safety (overseed/establishment context). ' +
                        'Avoid DAP near germinating seed: at pH ' + pH.toFixed(1) +
                        (pH > 7.0 ? ' (alkaline)' : '') +
                        ', DAP\'s alkaline granule microsite (pH ~8.0) generates free NH₃ which is ' +
                        'phytotoxic to emerging radicles. MAP\'s acidic microsite (~pH 4) keeps ' +
                        'ammonium as NH₄⁺. Source: Bremner & Krogmeier (1989) PNAS 86:8185.';
            } else if (pH < 5.5) {
                pNote = ', at pH ' + pH.toFixed(1) + ', the priority intervention is lime/dolomite ' +
                        'to address underlying pH; without that, P uptake remains inefficient ' +
                        '(Fe/Al fixation continues until pH > 5.8). MAP is the appropriate P source ' +
                        'once pH correction is underway. See sequencing note for lime ↔ ammoniacal ' +
                        'fertiliser timing requirements.';
            } else if (pH > 7.5) {
                pNote = ', MAP preferred over DAP at pH ' + pH.toFixed(1) + '. DAP\'s alkaline ' +
                        'granule microsite combined with alkaline bulk soil drives NH₃ volatilisation ' +
                        '(20-30% N loss reported on calcareous soils, Hofman & Van Cleemput 2004); ' +
                        'MAP avoids this loss pathway. Secondary benefit: less Ca-P fixation. ' +
                        'Apply in autumn/spring when turf is actively growing';
                // b35fix445 (C20b): rate-guidance phrasing gated on surfaceBucket so
                // greens sites do not see fairway copy and vice versa. Greens/foliar
                // detail is covered by the pDelivery === 'foliar' suffix below.
                // Tees take granular MAP at moderate rates with water-in, distinct
                // from greens (foliar Tech-grade) and fairways (programme-integrated).
                if (surfaceBucket === 'greens') {
                    pNote += '; apply at low rates and water in if making a soil application.';
                } else if (surfaceBucket === 'tees') {
                    pNote += '; apply at moderate rates and water in.';
                } else {
                    pNote += ' with your regular fertiliser programme.';
                }
            } else {
                pNote = '';
            }
            // b35fix424 (C20): foliar delivery suffix appended to all reason
            // text on greens/bowls/croquet so the user sees the route choice.
            if (pDelivery === 'foliar') {
                pNote += (pNote ? ' ' : ', ') +
                         'Foliar route selected for close-cut surface (per-application cap ' +
                         '15 kg product/ha; soluble in 400-600 L water/ha).';
            }

            d.status = 'apply';
            d.product = pName;
            d.analysis = pAnalysis;
            // b35fix423 (C29): theoretical = full deficit closure in 1yr; practical = (theoretical / efficiency) / yearsToCorrect.
            // b35fix424 (C20): deliveryMethod resolved per-surface. Foliar MAP efficiency 0.65 (vs granular alkaline 0.55 / neutral 0.70).
            var pEff = _computePracticalKg(residual, 'P', 'map', pDelivery);
            var pProductPractical = (residual / pPct / Math.max(0.01, pEff.efficiency)) / pEff.years;
            d.kgTheoretical = +residual.toFixed(1);
            d.kgPractical = +(residual / Math.max(0.01, pEff.efficiency) / pEff.years).toFixed(1);
            d.efficiency = pEff.efficiency;
            d.efficiencyCondition = pEff.condition;
            d.efficiencySource = pEff.source;
            d.yearsToCorrect = pEff.years;
            d.amendmentKey = 'map';
            d.deliveryMethod = pDelivery;
            d.rate = formatRate(d.kgPractical, pProductPractical, 'P', 'map', pDelivery) +
                     (progKg > 0 ? '. Programme already delivers ' + progKg.toFixed(0) +
                      ' kg P/ha; this addresses the residual ' + residual.toFixed(1) + ' kg P/ha' : '') +
                     pNote +
                     _emitSevereContext(d, 'Phosphorus');
            d.reason = 'Apply ' + pName + ' (' + pAnalysis + ') at ' + d.rate;
            return d;
        }

        if (nutrient === 'K') {
            // Potassium sulphate (chloride-free, also delivers S). 41.5% elemental K
            // (= 50% K₂O). The catalogue SOL-SOP uses K=41.5 — this matches.
            // b35fix400: analysis label is now region-aware. AU/NZ shows
            // "0-0-41.5 (41.5% K, 18% S)"; UK/EU shows "0-0-50 (as K₂O)
            // (41.5% K, 18% S)". The /0.415 divisor stays correct (operates
            // on elemental K regardless of display).
            //
            // High-Mg flag: when soil Mg is very high relative to K, K uptake is
            // antagonised. Note this in the reason text but don't change the product —
            // the soil-level K deficit still needs filling.
            var kHighMg = soilData.Mg && soilData.K && (soilData.Mg / Math.max(1, soilData.K)) > 4;

            // b35fix424 (C20): surface-aware product / delivery selection.
            // On greens/bowls/croquet, Soluble SOP (Tech grade) replaces granular
            // SOP. Same elemental K (41.5%) and S (18%) — analysis label is
            // unchanged (region-aware via _potassiumDisplayLabel). Reason text
            // adds the foliar route note.
            var kDelivery = _resolveDeliveryWithEpsomExpansion('potassiumSulphate', surfaceBucket);
            var kName = (kDelivery === 'foliar')
                ? 'Soluble SOP (Potassium Sulphate, Tech)'
                : 'Potassium sulphate';

            d.status = 'apply';
            d.product = kName;
            d.analysis = _potassiumDisplayLabel();
            // b35fix423 (C29): efficiency-adjusted practical rate.
            // b35fix424 (C20): foliar delivery on close-cut surfaces (efficiency 0.65).
            var kEff = _computePracticalKg(residual, 'K', 'potassiumSulphate', kDelivery);
            var kProductPractical = (residual / 0.415 / Math.max(0.01, kEff.efficiency)) / kEff.years;
            d.kgTheoretical = +residual.toFixed(1);
            d.kgPractical = +(residual / Math.max(0.01, kEff.efficiency) / kEff.years).toFixed(1);
            d.efficiency = kEff.efficiency;
            d.efficiencyCondition = kEff.condition;
            d.efficiencySource = kEff.source;
            d.yearsToCorrect = kEff.years;
            d.amendmentKey = 'potassiumSulphate';
            d.deliveryMethod = kDelivery;
            var kRouteNote = (kDelivery === 'foliar')
                ? ', foliar route selected for close-cut surface (per-application cap 20 kg product/ha; soluble in 400-600 L water/ha)'
                : '';
            // b35fix425 (C19): pH-band uptake context for K. Three bands matching
            // the P branch's pH-band structure but with the K-specific antagonist
            // physiology (cation competition for root uptake sites, not Fe/Al
            // fixation as for P).
            //   pH < 6.0  — acidic soils favour Mg over K at root uptake sites
            //               via cation competition (Mengel & Kirkby 2001 ch. 11).
            //               Combined with the Mg:K wide-ratio flag (kHighMg)
            //               this is the dominant K-uptake suppressor on
            //               low-pH high-Mg sites.
            //   pH > 7.5  — alkaline soils favour Ca over K at uptake sites,
            //               same competition mechanism but with Ca as the
            //               dominant antagonist. Calcareous parent material
            //               sites typically show this.
            //   pH 6.0-7.5 — no pH-driven antagonist, default uptake.
            // Source: Mengel K. & Kirkby E.A. (2001) Principles of Plant
            //         Nutrition, 5th ed., Kluwer ch. 11 (potassium); Marschner
            //         (2012) Mineral Nutrition of Higher Plants ch. 6.
            var kPhNote = '';
            if (pH < 6.0) {
                kPhNote = ', at pH ' + pH.toFixed(1) + ' (acidic) Mg competes with K for ' +
                          'root uptake sites; cation competition continues until pH rises ' +
                          'above ~6.0. Soil K addition is correct but uptake will be partly ' +
                          'limited by the Mg antagonist; pH correction (lime/dolomite) addresses ' +
                          'the underlying limitation';
            } else if (pH > 7.5) {
                kPhNote = ', at pH ' + pH.toFixed(1) + ' (alkaline) Ca competes with K for ' +
                          'root uptake sites; cation competition is the dominant K-uptake ' +
                          'limiter on calcareous and lime-induced alkaline soils. Foliar K ' +
                          'bypasses the soil cation competition and is preferred at this pH';
            }
            d.rate = formatRate(d.kgPractical, kProductPractical, 'K', 'potassiumSulphate', kDelivery) +
                     (progKg > 0 ? '. Programme already delivers ' + progKg.toFixed(0) +
                      ' kg K/ha; this addresses the residual ' + residual.toFixed(1) + ' kg K/ha' : '') +
                     (kHighMg ? ', Mg:K ratio is wide; expect competitive uptake antagonism, ' +
                      'split applications recommended' : '') +
                     kRouteNote +
                     kPhNote +
                     _emitSevereContext(d, 'Potassium');
            d.reason = 'Apply ' + d.product + ' (' + d.analysis + ') at ' + d.rate;
            return d;
        }

        if (nutrient === 'Mg') {
            // Mg pH-aware selection. Programme check wraps it — if programme
            // covers the deficit, suppression already returned above. We get
            // here only if programme < deficit.
            //
            // b35fix322 Bug 2a: dolomite trigger simplified to `lowpH` (the
            // outer Mg branch already implies mgDeficit). Previously also
            // gated on (caDeficit || pH < 5.5); see _dolomiteWillBeRecommended
            // comment above for rationale.
            //
            // b35fix423 (C29): each sub-branch carries its own amendmentKey —
            // dolomite (acid pH < 6.0), kieserite (alkaline pH ≥ 7.0), epsom (else).
            //
            // b35fix424 (C20):
            //   - Epsom flips to FOLIAR everywhere (Spencer pin: Epsom is sold
            //     as soluble in AU/NZ practice; never granular). Cap 15 kg/ha.
            //   - Kieserite stays granular but reason text gates on hollow-tine
            //     aeration: 300 kg/ha cap is post-aeration only, not routine.
            //   - Dolomite stays granular; on greens/bowls/croquet the
            //     placement month flips from autumn to spring (Sep south /
            //     Mar north) to weather through before autumn disease pressure.
            //     Placement override is applied in _amendmentDecisionsToProducts
            //     via the d._springPlacement flag set here.
            var mgName, mgAnalysis, mgPct, mgRate, mgExtra = '';
            var mgAmendmentKey, mgEff, mgKgTheoretical, mgKgPractical, mgProductPractical;
            var mgDelivery = 'granular';
            if (lowpH) {
                // Dolomite — rate driven by max(Mg need, Ca need)
                var dolRateMg = residual / 0.12;
                var caDef = caMin != null ? Math.max(0, caMin - (soilData.Ca || 0)) : 0;
                var caDef_kg = caDef * depth * bd * 0.1;
                var dolRateCa = caDef_kg > 0 ? caDef_kg / 0.22 : 0;
                var dolProduct = Math.max(dolRateMg, dolRateCa);
                var dolMgKg = dolProduct * 0.12;
                mgAmendmentKey = 'dolomite';
                mgEff = _computePracticalKg(dolMgKg, 'Mg', mgAmendmentKey, 'granular');
                mgKgTheoretical = +dolMgKg.toFixed(1);
                mgKgPractical = +(dolMgKg / Math.max(0.01, mgEff.efficiency) / mgEff.years).toFixed(1);
                mgProductPractical = (dolProduct / Math.max(0.01, mgEff.efficiency)) / mgEff.years;
                mgName = 'Dolomite (CaMg(CO₃)₂)';
                mgAnalysis = '12% Mg, 22% Ca';
                mgRate = formatRate(mgKgPractical, mgProductPractical, 'Mg', 'dolomite', 'granular');
                mgExtra = (dolRateCa > dolRateMg ? ' (rate driven by Ca deficit; also corrects Mg and raises pH)'
                                                  : ' (rate driven by Mg deficit; also supplies Ca and raises pH)');
                // b35fix424 (C20) spring placement override on close-cut surfaces.
                // Late-summer / early-autumn lime applications carry residual surface
                // alkalinity into the cool-wet pressure window, raising autumn Fusarium
                // pressure. Spring placement so the amendment weathers through before
                // disease pressure.
                if (surfaceBucket === 'greens') {
                    d._springPlacement = true;
                    mgExtra += '. Spring placement on close-cut surface: late-summer/early-autumn lime ' +
                               'applications carry residual surface alkalinity into the cool-wet pressure ' +
                               'window, raising autumn Fusarium pressure. Apply in spring (Sep-Oct south / ' +
                               'Mar-Apr north) so the amendment weathers through before autumn disease pressure.';
                }
            } else if (pH >= 7.0) {
                mgAmendmentKey = 'kieserite';
                mgEff = _computePracticalKg(residual, 'Mg', mgAmendmentKey, 'granular');
                mgName = 'Kieserite (MgSO₄·H₂O)';
                mgAnalysis = '16% Mg, 22% S';
                mgPct = 0.16;
                mgKgTheoretical = +residual.toFixed(1);
                mgKgPractical = +(residual / Math.max(0.01, mgEff.efficiency) / mgEff.years).toFixed(1);
                mgProductPractical = (residual / mgPct / Math.max(0.01, mgEff.efficiency)) / mgEff.years;
                mgRate = formatRate(mgKgPractical, mgProductPractical, 'Mg', 'kieserite', 'granular');
                // b35fix424 (C20) post-aeration gate on close-cut surfaces.
                // 300 kg/ha cap is post-hollow-tine only — not routine surface dressing.
                if (surfaceBucket === 'greens') {
                    mgExtra = ' (apply ONLY immediately following hollow-tine aeration, worked into the holes; ' +
                              'do not apply as routine surface dressing on close-cut turf: kieserite is bulk granular ' +
                              'and the per-application cap of 300 kg/ha is conditional on aeration event)';
                }
            } else {
                // b35fix424 (C20): Epsom flips to FOLIAR. Spencer pin —
                // Epsom is sold as soluble in AU/NZ practice; the granular
                // path is retained in the table only as defensive fallback.
                mgAmendmentKey = 'epsom';
                mgDelivery = 'foliar';
                mgEff = _computePracticalKg(residual, 'Mg', mgAmendmentKey, mgDelivery);
                mgName = 'Magnesium sulphate (Epsom salts), soluble foliar';
                mgAnalysis = '10% Mg, 13% S';
                mgPct = 0.10;
                mgKgTheoretical = +residual.toFixed(1);
                mgKgPractical = +(residual / Math.max(0.01, mgEff.efficiency) / mgEff.years).toFixed(1);
                mgProductPractical = (residual / mgPct / Math.max(0.01, mgEff.efficiency)) / mgEff.years;
                mgRate = formatRate(mgKgPractical, mgProductPractical, 'Mg', 'epsom', 'foliar');
                mgExtra = ' (foliar route; Epsom is sold as soluble in AU/NZ practice: dissolve fully in ' +
                          '400-600 L water/ha; per-application cap 15 kg product/ha)';
            }
            // b35fix425 (C19): name the pH band explicitly in user copy so the
            // user sees WHY the engine picked dolomite vs kieserite vs Epsom.
            // The branching itself is unchanged (lowpH→dolomite, ≥7.0→kieserite,
            // else→Epsom) — this just labels each band in the output. Inserted
            // ahead of the existing mgExtra copy so it reads as
            // "[band reason]. [existing mgExtra]".
            var mgPhBandLabel = '';
            if (lowpH) {
                mgPhBandLabel = ' Band: acid pH (' + pH.toFixed(1) + ' < 6.0). Dolomite chosen ' +
                                'because it corrects Mg, supplies Ca, and raises pH together; ' +
                                'three benefits from one amendment when soil is acidic';
            } else if (pH >= 7.0) {
                mgPhBandLabel = ' Band: alkaline pH (' + pH.toFixed(1) + ' ≥ 7.0). Kieserite chosen ' +
                                'because it supplies Mg without further alkalising the soil ' +
                                '(unlike dolomite); Mg-sulphate chemistry is pH-neutral on ' +
                                'application';
            } else {
                mgPhBandLabel = ' Band: near-neutral pH (' + pH.toFixed(1) + ', 6.0-7.0). ' +
                                'Epsom (foliar) chosen because soil chemistry is balanced and ' +
                                'foliar Mg gives faster correction than soil-applied granular ' +
                                'on close-cut surfaces';
            }
            d.status = 'apply';
            d.product = mgName;
            d.analysis = mgAnalysis;
            d.kgTheoretical = mgKgTheoretical;
            d.kgPractical = mgKgPractical;
            d.efficiency = mgEff.efficiency;
            d.efficiencyCondition = mgEff.condition;
            d.efficiencySource = mgEff.source;
            d.yearsToCorrect = mgEff.years;
            d.amendmentKey = mgAmendmentKey;
            d.deliveryMethod = mgDelivery;
            d.rate = mgRate +
                     (progKg > 0 ? '. Programme already delivers ' + progKg.toFixed(0) +
                      ' kg Mg/ha; this addresses the residual ' + residual.toFixed(1) + ' kg Mg/ha' : '') +
                     mgExtra +
                     '.' + mgPhBandLabel +
                     _emitSevereContext(d, 'Magnesium');
            d.reason = 'Apply ' + mgName + ' (' + mgAnalysis + ') at ' + d.rate;
            return d;
        }

        if (nutrient === 'Ca') {
            // Dolomite-suppression: if dolomite is being recommended for Mg/pH,
            // it covers the Ca deficit too — suppress the standalone Ca rec.
            if (_dolomiteWillBeRecommended) {
                d.status = 'suppressed_dolomite';
                d.reason = 'Calcium deficit is addressed by dolomite (being recommended for Mg/pH). ' +
                           'No standalone Ca amendment required.';
                return d;
            }
            // Default: gypsum (also delivers S, pH-neutral). At low pH without Mg
            // co-deficit, lime (CaCO3) would address pH too — but the standard
            // recommendation here is the Ca-specific product; pH-correction lime
            // is handled in the pH narrative section, not here.
            //
            // b35fix423 (C29): efficiency lookup picks 'gypsum' / 'granular'.
            // The gypsum table branches on saline (ESP > 6 or ECe > 4) → 0.40,
            // else 'normal' → 0.60. Soil ESP/ECe come from soilData when present;
            // pH-only sites without ESP/ECe fall through to 'normal'.
            // b35fix424 (C20): Ca stays granular on all surfaces — foliar Ca on
            // greens is rare in AU practice and rates are too high to justify
            // Tech-grade pricing. Cap gates split-application copy via
            // SURFACE_RATE_CAPS[greens].granular.gypsum = 250.
            var caEff = _computePracticalKg(residual, 'Ca', 'gypsum', 'granular');
            var caProductPractical = (residual / 0.23 / Math.max(0.01, caEff.efficiency)) / caEff.years;
            d.status = 'apply';
            d.product = 'Gypsum (CaSO₄·2H₂O)';
            d.analysis = '23% Ca, 18.6% S';
            d.kgTheoretical = +residual.toFixed(1);
            d.kgPractical = +(residual / Math.max(0.01, caEff.efficiency) / caEff.years).toFixed(1);
            d.efficiency = caEff.efficiency;
            d.efficiencyCondition = caEff.condition;
            d.efficiencySource = caEff.source;
            d.yearsToCorrect = caEff.years;
            d.amendmentKey = 'gypsum';
            d.deliveryMethod = 'granular';
            // b35fix425 (C19): pH-band uptake context for Ca. Gypsum is pH-
            // neutral so the product choice doesn't change with pH, but the
            // user benefits from knowing WHY gypsum was chosen over lime even
            // at low pH (where lime would also raise pH). The answer: this
            // branch only fires when there is no Mg co-deficit (dolomite path
            // would have suppressed the Ca rec). At low pH without Mg need,
            // lime would over-correct pH; gypsum delivers Ca without the
            // alkalising effect, leaving pH management to the dedicated
            // pH-narrative section.
            var caPhNote = '';
            if (pH < 6.0) {
                caPhNote = ', at pH ' + pH.toFixed(1) + ' (acidic) lime would also raise pH ' +
                           'but is NOT chosen here because the Ca branch only fires when there ' +
                           'is no Mg co-deficit. Use lime when pH correction is the goal; use ' +
                           'gypsum when Ca supply alone is required without pH change';
            } else if (pH > 7.5) {
                caPhNote = ', at pH ' + pH.toFixed(1) + ' (alkaline) gypsum is doubly correct: ' +
                           'pH-neutral Ca delivery without further alkalising the soil, plus ' +
                           'the sulphate has a small acidifying effect through SO₄²⁻ exchange ' +
                           'with bicarbonate';
            }
            d.rate = formatRate(d.kgPractical, caProductPractical, 'Ca', 'gypsum', 'granular') +
                     (progKg > 0 ? '. Programme already delivers ' + progKg.toFixed(0) +
                      ' kg Ca/ha; this addresses the residual ' + residual.toFixed(1) + ' kg Ca/ha' : '') +
                     ', pH-neutral; gypsum also delivers S' +
                     caPhNote +
                     _emitSevereContext(d, 'Calcium');
            d.reason = 'Apply ' + d.product + ' (' + d.analysis + ') at ' + d.rate;
            return d;
        }

        if (nutrient === 'S') {
            // S logic unchanged from b35fix317 (5-rule context-aware), restructured
            // to populate the structured decision object. Rule 1 (programme covers)
            // is handled by the universal Rule 1 above — we only reach here if
            // residual > 0.
            //
            // Rule 2 — Dolomite recommended → gypsum for residual S (pH-neutral).
            // Rule 3 — pH < 6.5 → sulphate of ammonia (NOT elemental S).
            // Rule 4 — pH > 7.5 → elemental S IS correct (acidification wanted).
            // Rule 5 — pH 6.5-7.5 default → gypsum (pH-neutral S delivery).
            //
            // b35fix424 (C20):
            //   - Rule 3 on greens/bowls/croquet flips to FOLIAR (SOL-AS Tech).
            //     Cap 20 kg product/ha. Rules 2 / 5 stay granular gypsum.
            //   - Rule 4 elem-S stays granular regardless of surface (no foliar
            //     form exists). Cap 28 kg product/ha = 25 kg S/ha (Spencer 2008
            //     Nutrition of Sports Turf in Australia, p.143). Hemisphere-aware
            //     summer suppression — Thiobacillus oxidation accelerates above
            //     ~25-32°C generating sulphuric acid during heat stress.
            d.status = 'apply';
            // b35fix423 (C29): each sub-rule has its own amendmentKey:
            //   Rule 2 → 'gypsum'
            //   Rule 3 → 'sulphateOfAmmonia'
            //   Rule 4 → 'elementalSulphur'
            //   Rule 5 → 'gypsum'
            // Efficiency / yearsToCorrect / practical kg figures populated per branch.
            var sAmendmentKey, sEff, sProductPct, sProductPractical;
            var sDelivery = 'granular';
            if (_dolomiteWillBeRecommended) {
                // Rule 2 — gypsum granular regardless of surface
                if (residual <= 0) {
                    // Programme + dolomite covers everything — suppress.
                    d.status = 'suppressed_combined';
                    d.reason = 'Sulphur deficit is addressed by the fertiliser programme in combination ' +
                               'with dolomite (being recommended for Mg/pH). No standalone S amendment required.';
                    return d;
                }
                sAmendmentKey = 'gypsum';
                sProductPct = 0.186;
                sEff = _computePracticalKg(residual, 'S', sAmendmentKey, 'granular');
                sProductPractical = (residual / sProductPct / Math.max(0.01, sEff.efficiency)) / sEff.years;
                d.product = 'Gypsum (CaSO₄·2H₂O)';
                d.analysis = '18.6% S, 23% Ca';
                d.kgTheoretical = +residual.toFixed(1);
                d.kgPractical = +(residual / Math.max(0.01, sEff.efficiency) / sEff.years).toFixed(1);
                d.rate = formatRate(d.kgPractical, sProductPractical, 'S', 'gypsum', 'granular') +
                         ', pH-neutral, avoids undoing dolomite\'s liming effect' +
                         (prog ? '. Programme already delivers ' + progKg.toFixed(0) +
                          ' kg S/ha; this addresses the residual ' + residual.toFixed(1) + ' kg/ha' : '');
            } else if (pH < 6.5) {
                // Rule 3 — SOA. b35fix424 (C20): foliar Tech soluble on close-cut.
                sAmendmentKey = 'sulphateOfAmmonia';
                sProductPct = 0.24;
                sDelivery = _resolveDeliveryWithEpsomExpansion('sulphateOfAmmonia', surfaceBucket);
                sEff = _computePracticalKg(residual, 'S', sAmendmentKey, sDelivery);
                sProductPractical = (residual / sProductPct / Math.max(0.01, sEff.efficiency)) / sEff.years;
                d.product = (sDelivery === 'foliar')
                    ? 'Ammonium Sulphate Tech (soluble foliar)'
                    : 'Sulphate of ammonia ((NH₄)₂SO₄)';
                d.analysis = '21% N, 24% S';
                d.kgTheoretical = +residual.toFixed(1);
                d.kgPractical = +(residual / Math.max(0.01, sEff.efficiency) / sEff.years).toFixed(1);
                var soaRouteNote = (sDelivery === 'foliar')
                    ? ' Foliar route selected for close-cut surface (per-application cap 20 kg product/ha; ' +
                      'soluble in 400-600 L water/ha).'
                    : '';
                d.rate = formatRate(d.kgPractical, sProductPractical, 'S', 'sulphateOfAmmonia', sDelivery) +
                         ', DO NOT use elemental sulphur at pH ' + pH.toFixed(1) +
                         ' (would further acidify). Sulphate of ammonia delivers S and is the preferred ' +
                         'N source at low pH.' + soaRouteNote +
                         ' Mechanism: at pH ' + pH.toFixed(1) + ' Thiobacillus oxidation of elemental S ' +
                         'is suppressed (the bacteria need pH > 5.5 for active oxidation); the elemental-S ' +
                         'pathway is therefore slow AND would drive pH lower still as it eventually oxidises. ' +
                         'Sulphate of ammonia delivers the S as already-available SO₄²⁻ (no oxidation step ' +
                         'required) and the NH₄⁺ contributes nitrogen. Source: Janzen & Bettany (1987) ' +
                         'Soil Sci Soc Am J 51:1471 (Thiobacillus pH dependence).' +
                         (prog && progKg > 0 ? ' Programme already delivers ' + progKg.toFixed(0) +
                          ' kg S/ha; this addresses residual ' + residual.toFixed(1) + ' kg/ha.' : '');
            } else if (pH > 7.5) {
                // Rule 4 — elemental S. Granular only (no foliar form). Spencer 2008
                // Nutrition of Sports Turf in Australia, p.143 cited for cap and
                // application rules.
                sAmendmentKey = 'elementalSulphur';
                sProductPct = 0.90;
                sEff = _computePracticalKg(residual, 'S', sAmendmentKey, 'granular');
                sProductPractical = (residual / sProductPct / Math.max(0.01, sEff.efficiency)) / sEff.years;
                d.product = 'Elemental sulphur';
                d.analysis = '90% S';
                d.kgTheoretical = +residual.toFixed(1);
                d.kgPractical = +(residual / Math.max(0.01, sEff.efficiency) / sEff.years).toFixed(1);

                // b35fix320: flag urea/DAP in the programme — at pH > 7.5 these
                // N sources lose 20-40% of N to NH₃ volatilisation unless
                // immediately incorporated. Recommend switching to ammonium
                // sulphate. Detection by product-name pattern (urea, DAP,
                // di-ammonium phosphate); ammonium sulphate is fine.
                var alkalineLossSources = [];
                if (nutritionProgram && nutritionProgram.annualSummary &&
                        nutritionProgram.annualSummary.products) {
                    var _allProds = nutritionProgram.annualSummary.products;
                    Object.keys(_allProds).forEach(function(pid) {
                        var entry = _allProds[pid];
                        if (!entry) return;
                        var pname = (entry.brandName || (entry.product && entry.product.name) || pid || '').toLowerCase();
                        // Match urea (but not "ureaform" / "methylene urea" — those are
                        // controlled-release coated forms with much lower volatilisation)
                        // and DAP / di-ammonium phosphate.
                        var isUrea = /\burea\b/.test(pname) &&
                                     !/ureaform|methylene urea|coated urea|controlled.release/.test(pname);
                        var isDAP = /\bdap\b|\bdi-?ammonium\s*phosphate/.test(pname);
                        if (isUrea || isDAP) {
                            alkalineLossSources.push((entry.brandName || (entry.product && entry.product.name)) || pid);
                        }
                    });
                }

                var volatilisationWarning = '';
                if (alkalineLossSources.length > 0) {
                    volatilisationWarning = ' Note: the current programme includes ' +
                        alkalineLossSources.join(', ') + ' which will lose 20-40% of applied N ' +
                        'to NH₃ volatilisation at pH ' + pH.toFixed(1) + ' unless immediately ' +
                        'irrigated in (>5 mm within 4 hours). Strongly consider substituting ' +
                        'ammonium sulphate (21-0-0 + 24% S), acidifying, no volatilisation loss, ' +
                        'and contributes to the S deficit. Source: Hofman & Van Cleemput (2004) ' +
                        'Soil and Plant Nitrogen, IFA.';
                }

                // b35fix424 (C20) hemisphere-aware summer suppression.
                // Thiobacillus oxidation accelerates above 25-32°C generating
                // sulphuric acid; applying during heat stress drives turf damage.
                // South: suppress Nov-Mar; North: suppress May-Sep.
                // The autumn-application windows are universal: Mar-Aug south
                // and Sep-Feb north. Both labels appear in the copy so users
                // in either hemisphere see the rule for both. The copy below
                // doesn't switch on hemisphere — placement (handled in
                // _amendmentDecisionsToProducts) targets the correct autumn
                // month for the user's hemisphere by design.
                // b35fix424b: prior conditional ternary produced "Sep-Feb south"
                // on south-hem reports — corrected to static labels.
                var sulphurApplicationCopy =
                    'Apply ONLY after hollow-tine aeration, worked into the holes, heading into autumn ' +
                    '(preferred timing per Spencer 2008, Nutrition of Sports Turf in Australia, p.143). ' +
                    'Per-application cap 28 kg product/ha (= 25 kg S/ha = 250 g S/100 m², Spencer 2008 p.143); ' +
                    'if higher rates are required, split applications at 3-4 week intervals with annual total ' +
                    'not exceeding 500 kg S/ha. Use the finest product available, water in immediately to ' +
                    'remove from the surface and prevent burning. ' +
                    'DO NOT apply when soil temp >= 32 deg C: Thiobacillus oxidation accelerates and the ' +
                    'sulphuric-acid intermediate causes excessive turf damage during heat stress. ' +
                    'Defer to autumn (Mar-Aug south / Sep-Feb north), apply after hollow-tine aeration.';

                d.rate = formatRate(d.kgPractical, sProductPractical, 'S', 'elementalSulphur', 'granular') +
                         ', correct at pH ' + pH.toFixed(1) + ' (acidifying effect is desired). ' +
                         sulphurApplicationCopy +
                         volatilisationWarning;
            } else {
                // Rule 5 — gypsum granular regardless of surface
                sAmendmentKey = 'gypsum';
                sProductPct = 0.186;
                sEff = _computePracticalKg(residual, 'S', sAmendmentKey, 'granular');
                sProductPractical = (residual / sProductPct / Math.max(0.01, sEff.efficiency)) / sEff.years;
                d.product = 'Gypsum (CaSO₄·2H₂O)';
                d.analysis = '18.6% S, 23% Ca';
                d.kgTheoretical = +residual.toFixed(1);
                d.kgPractical = +(residual / Math.max(0.01, sEff.efficiency) / sEff.years).toFixed(1);
                d.rate = formatRate(d.kgPractical, sProductPractical, 'S', 'gypsum', 'granular') +
                         ', pH-neutral S delivery at pH ' + pH.toFixed(1) +
                         '. Mechanism: in the 6.5-7.5 pH band Thiobacillus oxidation of elemental S ' +
                         'IS active (pH > 5.5 threshold met) but elemental S would slowly acidify the ' +
                         'soil out of the optimal band over 6-18 months, so it is not the preferred ' +
                         'product. Gypsum delivers SO₄²⁻ directly (no oxidation step) and is pH-neutral, ' +
                         'preserving the optimal-band chemistry. Source: Janzen & Bettany (1987) ' +
                         'Soil Sci Soc Am J 51:1471.' +
                         (prog && progKg > 0 ? ' Programme already delivers ' + progKg.toFixed(0) +
                          ' kg S/ha; this addresses residual ' + residual.toFixed(1) + ' kg/ha' : '');
            }
            d.efficiency = sEff.efficiency;
            d.efficiencyCondition = sEff.condition;
            d.efficiencySource = sEff.source;
            d.yearsToCorrect = sEff.years;
            d.amendmentKey = sAmendmentKey;
            d.deliveryMethod = sDelivery;
            d.reason = 'Apply ' + d.product + ' (' + d.analysis + ') at ' + d.rate +
                       _emitSevereContext(d, 'Sulphur');
            return d;
        }

        return null;
    }

    /**
     * b35fix324a — Single source of truth for "programme K delivery".
     *
     * Sums K from CATALOGUE products only. Skips _isAmendment-flagged entries.
     * This is the canonical "how much K does the N programme deliver" number,
     * consumed by:
     *   1. The K reconciliation gate in _synthesiseKReconDecision (deciding
     *      whether to recommend spot-K)
     *   2. The K Reconciliation renderer in word-export-combined.js
     *      (displaying the balance to the user)
     *
     * Both must see the same value or the user's "balance" doesn't match what
     * justified the spot-K recommendation. Eliminating the asymmetric-engines
     * pattern (two callers computing the same conceptual quantity by
     * independent means — flagged in the gaip-hub skill).
     *
     * Accepted shapes:
     *   - annualSummary: { products: { id: entry, ... } } — auto-unwrapped
     *   - raw productUsage map: { id: entry, ... } — used as-is
     *
     * Each entry's K value is read in priority order: nutrients.K then
     * totalDelivered.K (matches existing _perSampleKDelivered convention).
     *
     * Returns:
     *   number — kg K/ha summed from catalogue products only.
     *            0 when input is null/undefined/empty or all entries are
     *            _isAmendment. The function is a sum, not a presence probe;
     *            caller decides what zero means.
     */
    function _computeProgrammeKDelivered(productMapOrSummary) {
        if (!productMapOrSummary || typeof productMapOrSummary !== 'object') return 0;

        // Auto-unwrap annualSummary shape: { products: {...} }
        var map = (productMapOrSummary.products && typeof productMapOrSummary.products === 'object')
            ? productMapOrSummary.products
            : productMapOrSummary;

        var sum = 0;
        Object.keys(map).forEach(function(id) {
            var entry = map[id];
            if (!entry) return;
            if (entry._isAmendment) return;  // catalogue-only by definition
            var n = entry.nutrients || entry.totalDelivered || {};
            var k = parseFloat(n.K);
            if (isFinite(k)) sum += k;
        });
        return sum;
    }

    /**
     * b35fix328 — Extract a complete macro-nutrient delivery vector from any
     * product entry (catalogue or amendment) for the Annual Product Summary
     * and Fertiliser Purchasing Summary tables.
     *
     * Background: catalogue products created by prebbles-products.js and
     * nutrition-au-fertiliser-integration.js only initialise
     * `nutrients = { N, P, K }`. Their `analysis` field carries the full
     * macro/micro percentage breakdown (Ca, Mg, S, Fe, ...), but the
     * accumulated `nutrients` object never gets the secondary macros baked
     * in. Amendment products created by `_amendmentDecisionsToProducts`
     * initialise the full `totalDelivered = { N, P, K, S, Ca, Mg, Fe }`.
     *
     * Pre-b35fix328 the renderer read `p.nutrients || p.totalDelivered` and
     * only displayed N and K. Result: dolomite rows showed `Total kg/ha 955,
     * N 0, K 0` — the entire reason the row exists (Ca + Mg delivery) was
     * invisible. The b35fix323 fix put dolomite into the Monthly Schedule;
     * b35fix328 makes its delivery legible in the summary tables.
     *
     * Strategy: prefer real measured/computed values. Use `nutrients` for
     * N/P/K (these are tracked through programme balancing). Use
     * `totalDelivered` for S/Ca/Mg if amendments populated it. For catalogue
     * entries with no `totalDelivered`, derive the secondary macros from
     * `analysis × totalKg` — the analysis array is preserved on every
     * catalogue entry (verified b35fix317 corrections, AU fertiliser DB
     * integration, prebbles integration).
     *
     * Returns { N, P, K, S, Ca, Mg } in kg/ha. Always returns all six keys
     * (zero for missing). Never returns undefined or NaN — caller can sum
     * blindly.
     */
    function _extractEntryNutrients(entry) {
        var out = { N: 0, P: 0, K: 0, S: 0, Ca: 0, Mg: 0 };
        if (!entry || typeof entry !== 'object') return out;

        // Prefer measured nutrients (catalogue and amendment) for N/P/K
        var nutrients = (entry.nutrients && typeof entry.nutrients === 'object') ? entry.nutrients : null;
        var delivered = (entry.totalDelivered && typeof entry.totalDelivered === 'object') ? entry.totalDelivered : null;

        function pickNum(primary, secondary) {
            var v = parseFloat(primary);
            if (isFinite(v)) return v;
            v = parseFloat(secondary);
            return isFinite(v) ? v : 0;
        }

        // N/P/K — nutrients first (catalogue path keeps these accumulated),
        // then totalDelivered (amendment path)
        if (nutrients || delivered) {
            out.N = pickNum(nutrients && nutrients.N, delivered && delivered.N);
            out.P = pickNum(nutrients && nutrients.P, delivered && delivered.P);
            out.K = pickNum(nutrients && nutrients.K, delivered && delivered.K);
        }

        // S/Ca/Mg — totalDelivered first (amendments), then nutrients (rare),
        // then derive from analysis × total mass (catalogue path).
        out.S = pickNum(delivered && delivered.S, nutrients && nutrients.S);
        out.Ca = pickNum(delivered && delivered.Ca, nutrients && nutrients.Ca);
        out.Mg = pickNum(delivered && delivered.Mg, nutrients && nutrients.Mg);

        var analysis = (entry.product && entry.product.analysis) || entry.analysis;
        if (analysis && typeof analysis === 'object') {
            // Total mass in kg/ha — granular uses totalKg/totalKgHa, liquid
            // uses totalLHa (kg-equivalent for solubles via b35fix282
            // catalogue convention). Either field is valid.
            var totalMass = parseFloat(entry.totalKg);
            if (!isFinite(totalMass) || totalMass <= 0) totalMass = parseFloat(entry.totalKgHa);
            if (!isFinite(totalMass) || totalMass <= 0) totalMass = parseFloat(entry.totalLHa);
            if (isFinite(totalMass) && totalMass > 0) {
                ['S', 'Ca', 'Mg'].forEach(function(el) {
                    if (out[el] > 0) return;  // already populated from nutrients/delivered
                    var pct = parseFloat(analysis[el]);
                    if (isFinite(pct) && pct > 0) {
                        out[el] = +(totalMass * pct / 100).toFixed(2);
                    }
                });
                // P top-up only if neither nutrients nor delivered carried it
                if (out.P === 0) {
                    var pPct = parseFloat(analysis.P);
                    if (isFinite(pPct) && pPct > 0) {
                        out.P = +(totalMass * pPct / 100).toFixed(2);
                    }
                }
            }
        }

        return out;
    }

    /**
     * b35fix328 — Decide which optional macro columns (P, Ca, Mg, S) to
     * render in the Annual Product Summary / Purchasing Summary tables.
     * N and K are always shown (existing behaviour, never optional).
     *
     * Input: array of nutrient vectors as returned by _extractEntryNutrients
     *        (one per row that will be rendered).
     * Output: { P: bool, Ca: bool, Mg: bool, S: bool } — true means
     *         render the column.
     *
     * Rule: render a column if any row delivers > 0.05 kg/ha. The 0.05
     * floor suppresses analyses that carry trace nutrients at sub-detection
     * percentages (e.g. an N-K blend listed as "Mg: 0.01%" — at 200 kg/ha
     * that's 0.02 kg/ha, agronomically meaningless and not worth a column).
     */
    function _detectActiveNutrientColumns(rowVectors) {
        var active = { P: false, Ca: false, Mg: false, S: false };
        if (!Array.isArray(rowVectors)) return active;
        var threshold = 0.05;
        rowVectors.forEach(function(v) {
            if (!v) return;
            if (v.P > threshold) active.P = true;
            if (v.Ca > threshold) active.Ca = true;
            if (v.Mg > threshold) active.Mg = true;
            if (v.S > threshold) active.S = true;
        });
        return active;
    }

    /**
     * b35fix324 — Synthesise a K-reconciliation amendment decision.
     *
     * Programme-shortfall-driven spot-K (distinct from b35fix322's soil-deficit K).
     * Fires when the per-sample N programme delivers materially less K than the
     * sample's annual K requirement, AND the soil itself is genuinely K-limited
     * (sanity gate against SLAN-midpoint inflation — Item 1a).
     *
     * Two gates — both must trip:
     *
     *   GATE 1 (programme balance):
     *     balance = kDelivered - kRequired
     *     fires when balance < BALANCE_THRESHOLD (default −20 kg K/ha).
     *     Strict <, not <=. Sites at exactly the threshold don't fire — the
     *     "20 kg K/ha" is the noise floor for in-season sampling variability;
     *     a balance of −20 is within measurement uncertainty.
     *
     *   GATE 2 (soil-K sanity):
     *     soilData.K < soilData.thresholds.K.min
     *     fires only when soil K is genuinely below the methodology floor.
     *     Defends against the SLAN single-midpoint formula (engine line 311)
     *     emitting K req values that exceed in-range soil's actual need.
     *     Without this gate, a site with soil K = 100 ppm (in 75–150 SLAN range)
     *     could trigger spot-K because the engine's midpoint-driven K req = 127
     *     exceeds programme delivery. With the gate, the site needs to be
     *     genuinely K-limited (< 75 ppm under SLAN, < 35 ppm under MLSN) before
     *     spot-K fires regardless of programme balance.
     *
     *   Both gates are intentionally independent. The balance gate addresses
     *   "did the N programme deliver enough K?" (programme integrity). The soil
     *   gate addresses "does this soil need more K?" (agronomic justification).
     *   Both questions must answer "yes" for spot-K to be the right intervention.
     *
     * Spot rate:
     *   abs(balance), capped at capKgKHa (default 60 kg K/ha). The cap defends
     *   against runaway recommendations on samples with engine-inflated K req
     *   (Item 1a-class issue) — a balance of −200 doesn't justify 200 kg K/ha
     *   spot K, that level of correction belongs in the soil-deficit pathway
     *   (b35fix322) over years, not a single-season spot programme.
     *
     * Returns: null when either gate fails or when inputs are invalid.
     *          Otherwise a decision object matching the K branch shape from
     *          _computeAmendmentDecision, with `_isKReconciliation: true`.
     *          The downstream _amendmentDecisionsToProducts helper recognises
     *          the flag and emits split-month placement instead of single-autumn.
     *
     * Inputs:
     *   soilData       per-sample soil object with K (number) and thresholds.K.min
     *   kRequired      kg K/ha annual requirement (from r._anr.K.val)
     *   kDelivered     kg K/ha delivered by the N programme
     *   opts           { balanceThreshold: -20, capKgKHa: 60 } — both optional
     */
    function _synthesiseKReconDecision(soilData, kRequired, kDelivered, opts) {
        opts = opts || {};
        var BALANCE_THRESHOLD = (typeof opts.balanceThreshold === 'number')
                              ? opts.balanceThreshold : -20;
        var CAP_KG_K_HA       = (typeof opts.capKgKHa === 'number')
                              ? opts.capKgKHa : 60;
        // b35fix326b — near-floor buffer (default 5 ppm).
        // Soil-test measurement uncertainty on Mehlich-3 K is typically ±5 ppm.
        // A sample reading within `buffer` ppm of the methodology floor could
        // genuinely be at-or-above floor. Firing 50 kg/ha spot-K on a sample
        // that's 2 ppm "below" floor over-reacts to noise. Suppress within the
        // buffer band; fire when soilK < (floor - buffer).
        // Configurable: opts.nearFloorBuffer = 0 disables (b35fix324 behaviour).
        // Negative values clamped to 0 (defensive).
        var rawBuffer = (typeof opts.nearFloorBuffer === 'number')
                      ? opts.nearFloorBuffer : 5;
        var NEAR_FLOOR_BUFFER = Math.max(0, rawBuffer);

        // Defensive: invalid inputs.
        if (!soilData) return null;
        if (typeof kRequired !== 'number' || !isFinite(kRequired) || kRequired <= 0) return null;
        if (typeof kDelivered !== 'number' || !isFinite(kDelivered)) return null;

        // Gate 1: programme balance.
        var balance = kDelivered - kRequired;
        if (!(balance < BALANCE_THRESHOLD)) return null;  // strict <

        // Gate 2: soil-K sanity (Item 1a defence).
        // b35fix326b: extended with NEAR_FLOOR_BUFFER. Effective floor for the
        // gate is (floor - buffer); samples between (floor - buffer) and floor
        // inclusive of the lower bound get suppressed alongside truly in-range
        // samples. Defends against soil-test measurement uncertainty triggering
        // spot-K on borderline samples.
        var soilK = parseFloat(soilData.K);
        if (!isFinite(soilK)) return null;
        var floor = soilData.thresholds && soilData.thresholds.K && soilData.thresholds.K.min;
        if (typeof floor !== 'number' || !isFinite(floor)) return null;
        var effectiveFloor = floor - NEAR_FLOOR_BUFFER;
        if (!(soilK < effectiveFloor)) return null;  // strict <: at-buffer-edge inclusive in suppression

        // Both gates trip. Compute spot rate (capped).
        var rawSpotK = Math.abs(balance);
        var spotKgKHa = Math.min(rawSpotK, CAP_KG_K_HA);
        spotKgKHa = Math.round(spotKgKHa);  // round to nearest 1 kg K/ha
        if (spotKgKHa <= 0) return null;

        // SOP @ 41.5% K → product rate = spot K / 0.415.
        var kgProductHa = Math.round(spotKgKHa / 0.415);

        return {
            nutrient: 'K',
            status: 'apply',
            product: 'Potassium sulphate',
            // b35fix400: region-aware analysis label. AU/NZ shows elemental
            // (0-0-41.5), UK/EU shows oxide (0-0-50 (as K₂O)). Both include
            // "(41.5% K, 18% S)" parenthesised for parser stability and
            // agronomic clarity.
            analysis: _potassiumDisplayLabel({ region: opts.region }),
            rate: spotKgKHa.toFixed(0) + ' kg K/ha (' + kgProductHa +
                  ' kg product/ha), split across 3 peak K-uptake months. ' +
                  'Programme delivers ' + kDelivered.toFixed(0) +
                  ' kg K/ha against ' + kRequired.toFixed(0) +
                  ' kg K/ha annual requirement (balance ' +
                  (balance >= 0 ? '+' : '') + balance.toFixed(0) + ').',
            reason: 'Spot K supplement, N programme delivers ' +
                    kDelivered.toFixed(0) + ' kg K/ha against K requirement ' +
                    kRequired.toFixed(0) + ' kg K/ha (balance ' + balance.toFixed(0) +
                    '). Soil K (' + soilK.toFixed(0) + ' ppm) below floor (' +
                    floor + ' ppm) confirms agronomic justification.',
            _isKReconciliation: true
        };
    }

    /**
     * b35fix326a — Classify a K Reconciliation row state.
     *
     * Pure function. Given the engine output (anrK), the spot-K decision (if
     * any), and the balance arithmetic, returns the renderer state for the
     * Spot K? cell: { state, text, color }.
     *
     * Five states:
     *
     *   'applied'   — spot-K fired (b35fix324 gates both tripped). Green.
     *                 Text echoes the applied amount + "see programme".
     *
     *   'trend'     — engine intent='removal-only' (soil in sufficiency range)
     *                 but programme delivery is shorter than removal by more
     *                 than the noise threshold. Spot-K correctly suppressed
     *                 (soil reserves cover the immediate gap), but programme
     *                 IS mining reserves over time. Amber. Text indicates
     *                 trend without alarm.
     *                 b35fix326a addition — distinguishes mining-trend from
     *                 deficit on the renderer; pre-fix collapsed both into
     *                 a single red "Advisory" state.
     *
     *   'no-need'   — engine declared zero requirement (intent='suppress-above-
     *                 ceiling' under SLAN, or simply K req=0 under
     *                 any methodology). Grey. Text: "No (soil K above
     *                 sufficiency ceiling)" when intent supplied, plain "No"
     *                 otherwise.
     *
     *   'no'        — programme delivers near or above K req. Grey. "No".
     *
     *   'advisory'  — engine intent='lift-to-floor' (deficient soil) AND
     *                 programme is short, AND spot-K did NOT fire. Indicates
     *                 something blocked the gate (missing thresholds, missing
     *                 hemisphere context). Red. Renders as "Advisory" so the
     *                 user knows to investigate.
     *
     *   'unknown'   — engine output absent. Em-dash, grey.
     *
     * Inputs:
     *   ctx.anrK            r._anr.K — engine output, can be null/missing fields
     *   ctx.kReconApplied   true if r.data._kReconDecisions has at least one
     *   ctx.kReconDecision  first kReconDecisions entry (only used when applied)
     *   ctx.kRequired       numeric K req or null
     *   ctx.kDelivered      numeric K delivered (catalogue-only)
     *   ctx.balance         numeric balance (kDelivered - kRequired) or null
     *
     * Returns: { state, text, color }
     *   color is a hex RGB string (no '#'), matching the docx renderer convention.
     */
    function _classifyKReconState(ctx) {
        ctx = ctx || {};
        var anrK = ctx.anrK || null;
        var balance = (typeof ctx.balance === 'number') ? ctx.balance : null;
        var kReq = (typeof ctx.kRequired === 'number') ? ctx.kRequired : null;
        var intent = anrK && anrK.intent;

        // 1. Engine missing → unknown.
        if (!anrK || (kReq == null && balance == null)) {
            return { state: 'unknown', text: '-', color: '6B7280' };
        }

        // 2. Spot-K applied → applied state.
        if (ctx.kReconApplied && ctx.kReconDecision) {
            var rate = ctx.kReconDecision.rate || '';
            var m = rate.match(/(\d+)\s*kg\s*K\/ha/);
            var amount = m ? m[1] : '?';
            return {
                state: 'applied',
                text: 'Applied (' + amount + ' kg K/ha, split 3), see programme',
                color: '16A34A'
            };
        }

        // 3. K req=0 → no-need. Distinguishes SLAN ceiling from generic zero.
        if (kReq === 0 || kReq == null) {
            if (intent === 'suppress-above-ceiling') {
                return {
                    state: 'no-need',
                    text: 'No (soil K above sufficiency ceiling)',
                    color: '6B7280'
                };
            }
            return { state: 'no-need', text: 'No', color: '6B7280' };
        }

        // 4. Balanced or positive → no.
        if (balance == null || balance >= -10) {
            return { state: 'no', text: 'No', color: '6B7280' };
        }

        // 5. Negative balance: distinguish trend (sufficient soil) from
        //    advisory (deficient soil, spot-K should have fired but didn't).
        var shortfallKg = Math.abs(Math.round(balance / 5) * 5);
        if (shortfallKg < 5) shortfallKg = 5;

        if (intent === 'removal-only') {
            // Sufficient soil + programme short of removal: trend, not deficit.
            // Soil reserves cover the immediate gap; programme designers should
            // know they're mining reserves but no spot intervention warranted.
            return {
                state: 'trend',
                text: 'Trend (~' + shortfallKg + ' kg/ha shortfall vs removal), ' +
                      'soil sufficient, programme replenishment recommended',
                color: 'F59E0B'  // amber
            };
        }

        // 6. intent='lift-to-floor' (or unknown intent) + neg balance + spot-K
        //    not applied. Something blocked the gate. Render advisory red so
        //    user investigates.
        return {
            state: 'advisory',
            text: 'Advisory (~' + shortfallKg + ' kg/ha), review N programme',
            color: 'DC2626'  // red
        };
    }

    /**
     * b35fix322 — Convert amendment decisions to nutrition-program product entries.
     *
     * The Annual Soil Amendments table has historically rendered standalone (gypsum,
     * dolomite, kieserite, MAP/DAP, MOP/SOP, Epsom, lime) outside the nutrition
     * programme. The Annual Product Summary, Monthly Schedule, and Purchasing Summary
     * therefore never saw amendment products and produced incomplete totals.
     *
     * This helper takes the structured decisions produced by _computeAmendmentDecision
     * and converts each `apply` decision into a product entry shaped to drop into
     * `nutritionProgram.annualSummary.products`. Entries are flagged `_isAmendment: true`
     * so checkProgrammeDelivery() skips them (preventing self-suppression — an amendment
     * cannot count itself as programme delivery for the deficit it was created to fix).
     *
     * Single autumn application is the standard practice for slow-react amendments
     * (lime/dolomite/gypsum/sulphate) — autumn placement gives time to react before
     * the next growing season. South hemisphere = April; north = October.
     *
     * b35fix323: ALSO returns `granularEntries` — granular-shaped objects ready to
     * push into `perSampleProgram.monthly[<aprilOrOctIdx>].granular`. The Monthly
     * Schedule renderer reads from `monthly[].granular`, not from
     * `annualSummary.products`, so without this push the April row stays blank
     * even though the amendment is in the Annual Product Summary table.
     *
     * Inputs:
     *   decisions     array of decisions from _computeAmendmentDecision (any status)
     *   soilData      not used directly; reserved for future per-soil rate adjustments
     *   hemisphere    'south' | 'north' (default 'south' — Gilba's primary territory)
     *
     * Returns:
     *   {
     *     products:   { id: { product: { name, analysis }, brandName, applications: 1,
     *                          totalKgHa, totalDelivered: {N,P,K,S,Ca,Mg,Fe},
     *                          _isAmendment: true, _appliedMonth: 'April'|'October',
     *                          _nutrient: 'P'|'K'|'Ca'|'Mg'|'S' }, ... },
     *     granularEntries: [
     *       { id, name, brand, npk, analysis, rateKgHa, rateGM2, release, weeks,
     *         delivers, notes, _isAmendment, _nutrient }
     *     ],
     *     monthSlot:  'April' | 'October',
     *     monthIndex: 3 | 9      // zero-based index into the monthly[] array
     *                            // (Jan=0, Apr=3, Oct=9). Caller uses this to
     *                            // locate the right slot — independent of
     *                            // whether monthly[] entries carry month_num.
     *   }
     *
     * Defensive: returns { products: {}, granularEntries: [], monthSlot, monthIndex }
     * when decisions is empty/null or when no decision is in `apply` status.
     */
    function _amendmentDecisionsToProducts(decisions, soilData, hemisphere) {
        var monthSlot  = (hemisphere === 'north') ? 'October' : 'April';
        var monthIndex = (hemisphere === 'north') ? 9 : 3;     // 0-based: Jan=0
        var out = {
            products: {},
            granularEntries: [],
            monthSlot: monthSlot,
            monthIndex: monthIndex
        };

        if (!decisions || !decisions.length) return out;

        // Parse "12% Mg, 22% Ca" → { Mg: 12, Ca: 22 }
        // Also handles a leading NPK form like "0-0-50 (41.5% K, 18% S)" by
        // ignoring the NPK triple and reading the parenthesised pct list.
        function parseAnalysisLabel(label) {
            var pcts = {};
            if (!label || typeof label !== 'string') return pcts;
            // Strip any "0-0-50 " or "10-20-0 " NPK prefix — only the % entries matter
            // for nutrient-mass accounting; the NPK form is a display label.
            var body = label.replace(/^\s*\d+\s*-\s*\d+\s*-\s*\d+\s*/, '');
            // Match "NN% Element" or "NN.NN% Element" (Element = 1-2 letters,
            // capital first, optional lower second; covers N/P/K/S/Ca/Mg/Fe/Mn/Zn/Cu/B).
            var re = /(\d+(?:\.\d+)?)\s*%\s*([A-Z][a-z]?)/g;
            var m;
            while ((m = re.exec(body)) !== null) {
                var pct = parseFloat(m[1]);
                var el  = m[2];
                if (isFinite(pct) && el) pcts[el] = pct;
            }
            return pcts;
        }

        // Parse "30 kg Mg/ha (250 kg product/ha)" → 250
        // The split-application suffix (" — apply in N split dressings of MMM kg")
        // is harmless; the parenthesised total is what matters for annual totals.
        function parseProductKgHa(rateStr) {
            if (!rateStr || typeof rateStr !== 'string') return 0;
            var m = rateStr.match(/\(\s*(\d+(?:\.\d+)?)\s*kg\s*product\s*\/\s*ha\s*\)/i);
            if (!m) return 0;
            var v = parseFloat(m[1]);
            return isFinite(v) ? v : 0;
        }

        // b35fix324: split-month placement for K-reconciliation amendments.
        //
        // Soluble K (SOP) loaded as a single-autumn application leaches before
        // the next growing season can take it up. Splitting across 2-3 peak
        // K-uptake months gives better uptake efficiency and reduces leaching
        // loss. The placement targets active-growth K demand, NOT cold-hardening
        // (those are different physiological windows).
        //
        // South hemisphere splits: Jan / Sep / Nov  (idx 0 / 8 / 10)
        // North hemisphere splits: Mar / May / Jul  (idx 2 / 4 / 6)
        //
        // FUTURE — Item 8 (pre-winter K hardening engine, queued separately):
        // when that engine lands, the SOUTH_K_RECON_MONTHS / NORTH_K_RECON_MONTHS
        // arrays are the natural redistribution point. A pre-dormancy K loading
        // window (May–early June south for cool-season; ~6 weeks pre-dormancy for
        // warm-season) would shift one of the splits toward the hardening month
        // when soil-temp-driven cold acclimation is the relevant K demand. For
        // now the splits are pure active-growth uptake — Goss & Beard 1980,
        // Webster & Ebdon 2005 (cool-season tissue K & cold tolerance);
        // Tredway et al. 2009 (warm-season K & spring dead spot).
        var SOUTH_K_RECON_MONTHS = [8, 10, 0];   // Sep, Nov, Jan
        var NORTH_K_RECON_MONTHS = [2, 4, 6];    // Mar, May, Jul
        var K_RECON_SPLIT_COUNT  = 3;

        decisions.forEach(function(d) {
            if (!d || d.status !== 'apply') return;
            if (!d.product || !d.analysis || !d.rate) return;

            var pcts = parseAnalysisLabel(d.analysis);
            var totalKgHa = parseProductKgHa(d.rate);
            if (totalKgHa <= 0) return;

            var isKRecon = !!d._isKReconciliation;

            // b35fix424 (C20): per-decision spring placement override for
            // dolomite/lime on close-cut surfaces. Computed once here so both
            // out.products[id]._appliedMonth AND the granular schedule entry
            // see the same month. d._springPlacement is set by the Mg branch
            // in _computeAmendmentDecision (lowpH dolomite path on greens
            // bucket only). Spring months — South hem September (idx 8),
            // North hem March (idx 2) — sit outside the autumn Fusarium
            // pressure window.
            var perDecisionMonthSlot  = monthSlot;
            var perDecisionMonthIndex = monthIndex;
            if (d._springPlacement) {
                if (hemisphere === 'north') {
                    perDecisionMonthSlot  = 'March';
                    perDecisionMonthIndex = 2;
                } else {
                    perDecisionMonthSlot  = 'September';
                    perDecisionMonthIndex = 8;
                }
            }

            // Build totalDelivered from the analysis (kg product × % / 100).
            // Canonical for amendment products (no release-timing discount —
            // either single-autumn placement or split application; the full
            // product mass enters the soil over the application period).
            var totalDelivered = { N: 0, P: 0, K: 0, S: 0, Ca: 0, Mg: 0, Fe: 0 };
            Object.keys(pcts).forEach(function(el) {
                if (totalDelivered.hasOwnProperty(el)) {
                    totalDelivered[el] = +(totalKgHa * pcts[el] / 100).toFixed(2);
                }
            });

            // Synthesise a stable id. Amendment ids must not collide with
            // catalogue product ids — prefix with "amendment:" + nutrient + slug.
            //
            // b35fix324: K-reconciliation uses a distinct namespace
            // ("amendment:K-recon:<slug>") so it doesn't collide with the
            // soil-deficit K amendment ("amendment:K:<slug>") from b35fix322.
            // A site can legitimately receive BOTH — soil K below SLAN floor
            // (b35fix322) AND programme delivery short of K req (b35fix324) —
            // and they need to render as separate rows in Annual Product Summary.
            var slug = d.product.toLowerCase()
                                  .replace(/\([^)]*\)/g, '')
                                  .replace(/[^a-z0-9]+/g, '-')
                                  .replace(/^-|-$/g, '');
            var idNamespace = isKRecon ? 'K-recon' : d.nutrient;
            var id = 'amendment:' + idNamespace + ':' + slug;

            out.products[id] = {
                product: {
                    id: id,
                    name: d.product,
                    // Provide the analysis as a structured object too, so any
                    // downstream code that looks up entry.product.analysis[nut]
                    // (the canonical path used by checkProgrammeDelivery for
                    // catalogue products) finds the same numbers we baked into
                    // totalDelivered. Belt-and-braces — checkProgrammeDelivery
                    // skips _isAmendment entries anyway.
                    analysis: pcts
                },
                brandName: d.product,
                applications: isKRecon ? K_RECON_SPLIT_COUNT : 1,
                totalKgHa: +totalKgHa.toFixed(1),
                totalDelivered: totalDelivered,
                _isAmendment: true,
                _appliedMonth: perDecisionMonthSlot,
                _nutrient: d.nutrient,
                _isKReconciliation: isKRecon || undefined,
                _springPlacement: d._springPlacement || undefined
            };

            // ── b35fix324: K-recon split path ─────────────────────────────
            if (isKRecon) {
                // Spread the total product mass across K_RECON_SPLIT_COUNT
                // applications. Per-split rate is total/N rounded; the last
                // split absorbs any rounding remainder so the sum still equals
                // input total to the nearest 1 kg product/ha.
                var splitMonths = (hemisphere === 'north')
                    ? NORTH_K_RECON_MONTHS
                    : SOUTH_K_RECON_MONTHS;
                var splitRate    = Math.round(totalKgHa / K_RECON_SPLIT_COUNT);
                var splitDelKper = +(splitRate * (pcts.K || 0) / 100).toFixed(2);
                var splitDelSper = +(splitRate * (pcts.S || 0) / 100).toFixed(2);

                for (var s = 0; s < K_RECON_SPLIT_COUNT; s++) {
                    // Last split takes the remainder so total reconciles.
                    var thisRate = (s === K_RECON_SPLIT_COUNT - 1)
                        ? Math.round(totalKgHa) - splitRate * (K_RECON_SPLIT_COUNT - 1)
                        : splitRate;
                    var thisDelK = (s === K_RECON_SPLIT_COUNT - 1)
                        ? +(thisRate * (pcts.K || 0) / 100).toFixed(2)
                        : splitDelKper;
                    var thisDelS = (s === K_RECON_SPLIT_COUNT - 1)
                        ? +(thisRate * (pcts.S || 0) / 100).toFixed(2)
                        : splitDelSper;

                    out.granularEntries.push({
                        id: id + ':s' + (s + 1),
                        name: d.product,
                        brand: d.product,
                        // b35fix400: NPK label region-aware. AU/NZ shows
                        // elemental "0-0-41.5", UK/EU shows oxide "0-0-50".
                        // The leading-triple regex in parseAnalysisLabel
                        // strips this whole token so it's display-only.
                        npk: (_detectKDisplayRegion() === 'oxide') ? '0-0-50' : '0-0-41.5',
                        analysis: pcts,
                        rateKgHa: thisRate,
                        rateGM2: (thisRate / 10).toFixed(1),
                        release: 'standard',
                        weeks: 1,
                        splitCount: 1,    // single application within the month
                        // K-recon DOES deliver K (unlike pH-amendments that
                        // deliver only Ca/Mg/S). The whole point of this entry
                        // is to make up programme K shortfall.
                        delivers: { N: 0, P: 0, K: thisDelK, S: thisDelS },
                        notes: 'Spot K supplement (split ' + (s + 1) + '/' +
                               K_RECON_SPLIT_COUNT + ', programme reconciliation)',
                        _isAmendment: true,
                        _isKReconciliation: true,
                        _nutrient: d.nutrient,
                        _monthIndex: splitMonths[s],
                        _appliedMonth: monthSlot   // top-level autumn slot retained
                                                    // for any caller still using it
                    });
                }
                return;
            }
            // ── end K-recon split path ────────────────────────────────────

            // b35fix323: granular entry for monthly[<idx>].granular push
            // (single-slot autumn path — pH amendments, soil-deficit K, etc.).
            // Shape mirrors monthResult.granular.push() at au-fertiliser-products.js:5414
            // (post-b35fix322 with `analysis` field). The Monthly Schedule renderer
            // at word-export.js:4030-4035 reads `g.name`, `g.rateKgHa`, `g.splitCount`.
            // delivers[N/P/K] = 0 for all amendments in this branch — they don't
            // deliver N (dolomite, lime, gypsum, kieserite, Epsom) or P/K to first
            // approximation. The Annual Product Summary draws Ca/Mg/S from
            // `analysis` × `rateKgHa` / 100 when those columns are extended; for
            // now they're invisible (Item 3 backlog — column extension).
            //
            // splitCount is set to 1 — fine-turf splitting is already handled inside
            // the rate string emitted by formatRate() (the " — apply in N split
            // dressings of MM kg" suffix). Setting splitCount > 1 would double-cite
            // the splits in the schedule cell.
            //
            // b35fix424 (C20): perDecisionMonthSlot / perDecisionMonthIndex
            // hoisted to top of forEach iteration above (lines ~2887). Spring
            // placement applies to dolomite/lime on close-cut surfaces only.

            out.granularEntries.push({
                id: id,
                name: d.product,
                brand: d.product,
                npk: '0-0-0',  // amendments deliver no N/P/K to first approximation
                analysis: pcts,
                rateKgHa: +totalKgHa.toFixed(0),
                rateGM2: (+totalKgHa.toFixed(0) / 10).toFixed(1),
                release: 'standard',
                weeks: 1,
                splitCount: 1,
                delivers: { N: 0, P: 0, K: 0 },
                notes: d._springPlacement
                    ? 'Amendment (single spring application: close-cut surface, weather through before autumn disease pressure)'
                    : 'Amendment (single autumn application)',
                _isAmendment: true,
                _nutrient: d.nutrient,
                _monthIndex: perDecisionMonthIndex,
                _appliedMonth: perDecisionMonthSlot
            });
        });

        return out;
    }

    /**
     * b35fix321 — Cross-cutting warnings collector.
     *
     * Runs ONCE over the full per-nutrient decision set after all individual
     * decisions are made. Identifies interactions that span multiple nutrients
     * or span the decision/programme boundary — things no single decision
     * branch can detect on its own.
     *
     * Each warning is a structured object pushed onto `decision.warnings[]`
     * for whichever nutrient(s) it applies to. The table builder reads
     * decision.warnings to render warning text in the table or as footnotes.
     *
     * Warning emitters (extensible — add to this list as future cross-cutting
     * issues are identified):
     *
     *   1. lime_ammoniacal_sequencing
     *      Fires when dolomite is being recommended (Mg branch + low pH +
     *      Mg/Ca co-deficit) AND any ammoniacal product is in the
     *      recommendation set or programme. 14-day separation required.
     *      Source: Black et al. (1985) NZ J Agric Res 28:553.
     *
     *   2. ca_phosphate_incompatibility
     *      Fires when calcium nitrate AND any phosphate (MAP/DAP/MKP/
     *      phosphoric acid) are both present in programme or recommendations.
     *      Standard fertigation rule: Ca²⁺ + HPO₄²⁻ → calcium phosphate
     *      precipitate. Never tank-mix; granular surface co-application
     *      reduces P availability.
     *
     *   3. ca_sulphate_incompatibility
     *      Fires when calcium nitrate AND ammonium sulphate are both present.
     *      Forms gypsum precipitate in fertigation lines. Surface co-
     *      application has secondary NH₃ loss risk in alkaline conditions.
     *
     * Inputs:
     *   decisions — array of decision objects from _computeAmendmentDecision()
     *               (one per deficient nutrient)
     *   programme — nutritionProgram (same shape as fed to decision function)
     *   soilData  — soil object (for pH, etc.)
     *   context   — context object (for seedingActive flag etc.)
     *
     * Side effect: mutates decisions[i].warnings = [...] (creates the array
     * if not present). Each warning object: { code, severity, text, source }
     */
    function _collectCrossCuttingWarnings(decisions, programme, soilData, context) {
        if (!Array.isArray(decisions) || decisions.length === 0) return;
        decisions.forEach(function(d) { if (!d.warnings) d.warnings = []; });

        // ── Helpers ────────────────────────────────────────────────────────

        // Detect ammoniacal products by name pattern. Matches urea (excluding
        // controlled-release variants), MAP, DAP, ammonium sulphate / sulphate
        // of ammonia. Returns array of names found.
        function findAmmoniacalInProgramme() {
            var found = [];
            if (!programme || !programme.annualSummary || !programme.annualSummary.products) return found;
            var prods = programme.annualSummary.products;
            Object.keys(prods).forEach(function(pid) {
                var entry = prods[pid];
                if (!entry) return;
                var pname = (entry.brandName || (entry.product && entry.product.name) || pid || '').toLowerCase();
                var isUrea = /\burea\b/.test(pname) &&
                             !/ureaform|methylene urea|coated urea|controlled.release|polymer.coated/.test(pname);
                var isMAP = /\bmap\b|\bmono-?ammonium\s*phosphate/.test(pname);
                var isDAP = /\bdap\b|\bdi-?ammonium\s*phosphate/.test(pname);
                var isAS  = /\bammonium\s*sulphate|\bsulphate\s*of\s*ammonia\b|\bAS\s*(soluble|tech)/i.test(pname);
                if (isUrea || isMAP || isDAP || isAS) {
                    found.push((entry.brandName || (entry.product && entry.product.name)) || pid);
                }
            });
            return found;
        }

        // Detect calcium nitrate in the programme.
        function findCalciumNitrateInProgramme() {
            var found = [];
            if (!programme || !programme.annualSummary || !programme.annualSummary.products) return found;
            var prods = programme.annualSummary.products;
            Object.keys(prods).forEach(function(pid) {
                var entry = prods[pid];
                if (!entry) return;
                var pname = (entry.brandName || (entry.product && entry.product.name) || pid || '').toLowerCase();
                if (/\bcalcium\s*nitrate\b|\bca\(no3\)2|\bcal-mag\s*nitrate/i.test(pname)) {
                    found.push((entry.brandName || (entry.product && entry.product.name)) || pid);
                }
            });
            return found;
        }

        // Detect phosphate sources in the programme (MAP, DAP, MKP, phosphoric
        // acid, mono-potassium phosphate).
        function findPhosphateInProgramme() {
            var found = [];
            if (!programme || !programme.annualSummary || !programme.annualSummary.products) return found;
            var prods = programme.annualSummary.products;
            Object.keys(prods).forEach(function(pid) {
                var entry = prods[pid];
                if (!entry) return;
                var pname = (entry.brandName || (entry.product && entry.product.name) || pid || '').toLowerCase();
                var isMAP = /\bmap\b|\bmono-?ammonium\s*phosphate/.test(pname);
                var isDAP = /\bdap\b|\bdi-?ammonium\s*phosphate/.test(pname);
                var isMKP = /\bmkp\b|\bmono-?potassium\s*phosphate/.test(pname);
                var isPhosAcid = /\bphosphoric\s*acid\b/.test(pname);
                if (isMAP || isDAP || isMKP || isPhosAcid) {
                    found.push((entry.brandName || (entry.product && entry.product.name)) || pid);
                }
            });
            return found;
        }

        // Detect ammonium sulphate specifically (subset of ammoniacal)
        function findAmmoniumSulphateInProgramme() {
            var found = [];
            if (!programme || !programme.annualSummary || !programme.annualSummary.products) return found;
            var prods = programme.annualSummary.products;
            Object.keys(prods).forEach(function(pid) {
                var entry = prods[pid];
                if (!entry) return;
                var pname = (entry.brandName || (entry.product && entry.product.name) || pid || '').toLowerCase();
                if (/\bammonium\s*sulphate|\bsulphate\s*of\s*ammonia\b|\bAS\s*(soluble|tech)/i.test(pname)) {
                    found.push((entry.brandName || (entry.product && entry.product.name)) || pid);
                }
            });
            return found;
        }

        // Check whether a recommended product (in a decision) is ammoniacal.
        function recIsAmmoniacal(decision) {
            if (!decision || decision.status !== 'apply' || !decision.product) return false;
            var pname = decision.product.toLowerCase();
            return /\burea\b|\bmap\b|\bdap\b|\bmono-?ammonium|\bdi-?ammonium|\bammonium\s*sulphate|\bsulphate\s*of\s*ammonia/i.test(pname) &&
                   !/ureaform|methylene urea|coated urea|polymer.coated/.test(pname);
        }

        // ── Warning 1: lime/dolomite ↔ ammoniacal sequencing ───────────────
        //
        // Fires when dolomite OR lime is being recommended (Mg/Ca decision with
        // status 'apply' and product containing "Dolomite", "Lime", or
        // "Calcium carbonate" / "CaCO") AND any ammoniacal product is in the
        // rec set or in the programme. Co-application drives 25-50% NH₃
        // volatilisation losses.
        //
        // b35fix424 (C20) latent-gap fix: regex expanded from /Dolomite/i to
        // catch lime products too. Pre-fix the warning silently skipped lime
        // recommendations because no engine path emitted lime today, but the
        // gap was a hazard for future code paths (e.g. Ca branch could pick
        // CaCO3 over gypsum at strongly acid pH). Trigger names match common
        // product strings: "Dolomite", "Lime", "Agricultural Lime",
        // "Calcium carbonate", "CaCO3", "CaCO₃".
        var dolomiteRec = decisions.find(function(d) {
            return d.status === 'apply' && d.product && /Dolomite|\bLime\b|Calcium carbonate|CaCO/i.test(d.product);
        });
        if (dolomiteRec) {
            var ammoniacalRecs = decisions.filter(recIsAmmoniacal).map(function(d) { return d.product; });
            var ammoniacalProg = findAmmoniacalInProgramme();
            var allAmmoniacal = ammoniacalRecs.concat(ammoniacalProg);
            // De-duplicate
            var seen = {};
            allAmmoniacal = allAmmoniacal.filter(function(n) {
                var key = (n || '').toLowerCase();
                if (seen[key]) return false;
                seen[key] = true;
                return true;
            });

            if (allAmmoniacal.length > 0) {
                var seqWarning = {
                    code: 'lime_ammoniacal_sequencing',
                    severity: 'high',
                    text: 'Sequencing note: apply lime/dolomite at minimum 14 days before or after ' +
                          'any ammoniacal N source (urea, MAP, DAP, ammonium sulphate). The current ' +
                          'recommendation/programme includes: ' + allAmmoniacal.join(', ') + '. ' +
                          'Co-application drives 25-50% NH₃ volatilisation losses through the ' +
                          'reaction: NH₄⁺ + CaCO₃ → CaSO₄ + (NH₄)₂CO₃ → NH₃↑.',
                    source: 'Black et al. (1985) NZ J Agric Res 28:553; Fenn & Hossner (1985)'
                };
                // Attach to dolomite decision (it's the trigger) AND to any
                // ammoniacal-rec decisions so the user sees it next to either.
                dolomiteRec.warnings.push(seqWarning);
                decisions.forEach(function(d) {
                    if (recIsAmmoniacal(d) && d !== dolomiteRec) {
                        // Avoid duplicate warning objects — push a reference
                        d.warnings.push(seqWarning);
                    }
                });
            }
        }

        // ── Warning 2: Ca(NO₃)₂ + phosphate fertigation incompatibility ────
        //
        // Calcium nitrate + any phosphate (MAP/DAP/MKP/phosphoric acid) forms
        // calcium phosphate precipitate when combined in fertigation lines.
        // Standard rule: never tank-mix Ca with phosphate. Granular surface
        // co-application reduces P availability via the same chemistry.
        var caNitrateProg = findCalciumNitrateInProgramme();
        var phosphateProg = findPhosphateInProgramme();
        // Also check decision recs for phosphate (MAP from P branch)
        var phosphateRecs = decisions.filter(function(d) {
            return d.status === 'apply' && d.product &&
                   /\bMAP\b|\bDAP\b|\bMKP\b|Mono-?ammonium\s*phosphate|Di-?ammonium\s*phosphate/i.test(d.product);
        }).map(function(d) { return d.product; });
        var allPhosphate = phosphateProg.concat(phosphateRecs);

        if (caNitrateProg.length > 0 && allPhosphate.length > 0) {
            var caPWarning = {
                code: 'ca_phosphate_incompatibility',
                severity: 'high',
                text: 'Fertigation incompatibility flag: calcium nitrate (' + caNitrateProg.join(', ') +
                      ') and phosphate sources (' + allPhosphate.join(', ') + ') form calcium phosphate ' +
                      'precipitate when tank-mixed. Apply as separate granular drops or through separate ' +
                      'fertigation events, never co-mixed. This is a standard fertigation rule.',
                source: 'Standard fertigation chemistry; AU/NZ industry consensus'
            };
            // Attach to P decision (the most relevant) and any decision whose
            // product is a phosphate
            decisions.forEach(function(d) {
                if (d.nutrient === 'P' || (d.status === 'apply' && d.product &&
                        /\bMAP\b|\bDAP\b|\bMKP\b|Mono-?ammonium\s*phosphate|Di-?ammonium\s*phosphate/i.test(d.product))) {
                    d.warnings.push(caPWarning);
                }
            });
        }

        // ── Warning 3: Ca(NO₃)₂ + (NH₄)₂SO₄ — gypsum precipitate ───────────
        //
        // Calcium nitrate + ammonium sulphate forms CaSO₄ (gypsum) precipitate
        // when tank-mixed. Surface co-application carries secondary NH₃ loss
        // risk via the same Ca²⁺ + NH₄⁺ → NH₃ pathway, more pronounced at
        // alkaline pH but present at any pH if lime is also in rotation.
        var asProg = findAmmoniumSulphateInProgramme();
        if (caNitrateProg.length > 0 && asProg.length > 0) {
            var caSWarning = {
                code: 'ca_sulphate_incompatibility',
                severity: 'medium',
                text: 'Incompatibility flag: calcium nitrate (' + caNitrateProg.join(', ') +
                      ') and ammonium sulphate (' + asProg.join(', ') + ') form gypsum (CaSO₄) ' +
                      'precipitate when combined in fertigation lines. Apply as separate granular ' +
                      'drops or through separate fertigation events. Surface co-application also ' +
                      'carries secondary NH₃ loss risk, particularly if any lime/dolomite is in ' +
                      'the rotation.',
                source: 'Standard fertigation chemistry'
            };
            // Attach to all decisions that touch S or any ammoniacal rec
            decisions.forEach(function(d) {
                if (d.nutrient === 'S' || recIsAmmoniacal(d)) {
                    d.warnings.push(caSWarning);
                }
            });
        }

        // ── (Future cross-cutting warnings: extend this list) ──────────────
        //
        // Hooks to add later when the tank-feasibility-engine ships:
        //   - SOP solubility ceiling exceeded for fertigation rate
        //   - Common-ion effect on simultaneous SOP + AS dissolution
        //   - Order-of-addition violations
    }

    /**
     * b35fix319 Phase 3 — Annual Soil Amendments table.
     *
     * Consolidates P/K/Ca/Mg/S amendment decisions into one Word table that
     * makes the programme-vs-residual relationship explicit. Replaces the
     * "orphan bullet list" of soil-narrative recommendations where
     * suppression and residual-only cases were buried in prose.
     *
     * Each row reflects one nutrient and shows:
     *   Nutrient | Soil deficit (kg/ha) | Programme delivers (kg/ha) |
     *   Residual (kg/ha) | Product | Rate | Status
     *
     * Status values:
     *   "Apply"                          — standalone amendment recommended
     *   "Suppressed (programme covers)"  — Rule 1 (universal): programme delivery >= deficit
     *   "Suppressed (dolomite covers)"   — Ca-only: dolomite already recommended for Mg/pH
     *   "Suppressed (combined)"          — S-only: programme + dolomite together cover
     *   "No deficit"                     — nutrient at/above threshold
     *
     * Returns an array of [Heading-Paragraph, intro-Paragraph, Table, footnote-Paragraph]
     * (or [Heading, fallback-Paragraph] when no deficits exist). Caller pushes
     * the array contents directly into sections[].
     *
     * Pure function: depends only on soilData + nutritionProgram + surfaceType.
     * Safe to call per-iteration in combined exports.
     */
    function buildAnnualSoilAmendmentsTable(soilData, nutritionProgram, surfaceType, context, hemisphere) {
        if (!soilData || !soilData.thresholds) return [];
        context = context || {};
        // b35fix424 (C20): hemisphere defaults to 'south' for backward compat.
        hemisphere = hemisphere || 'south';

        var methodology = soilData.methodology || 'MLSN';
        var isSLAN = methodology === 'SLAN';
        var isAA = methodology === 'AMMONIUM_ACETATE' || methodology === 'AMMONIUM ACETATE';
        var isRangeBased = isSLAN || isAA;

        var nutrients = [
            { key: 'P',  name: 'Phosphorus (P)' },
            { key: 'K',  name: 'Potassium (K)' },
            { key: 'Ca', name: 'Calcium (Ca)' },
            { key: 'Mg', name: 'Magnesium (Mg)' },
            { key: 'S',  name: 'Sulphur (S)' }
        ];

        // Compute decisions for any nutrient with a deficit (range-based or
        // MLSN min). Skip nutrients without a measured value.
        var decisions = [];
        nutrients.forEach(function(n) {
            var value = soilData[n.key];
            var thresh = soilData.thresholds[n.key];
            if (value === undefined || value === null || !thresh) return;

            var isDeficient;
            if (isRangeBased) {
                isDeficient = value < thresh.min;
            } else {
                isDeficient = value < thresh.min;
            }
            if (!isDeficient) return;

            // ────────────────────────────────────────────────────────────
            // b35fix437 (C46/C47): axis-aware deficit conversion
            // ────────────────────────────────────────────────────────────
            // Pre-fix: deficit always treated as ppm (existing MLSN/SLAN/legacy AA paths).
            // Post-fix: Hill Labs sample-type SSOT introduces two threshold axes:
            //   'absolute'   — me/100g, mg/L, mg/kg (S277 cations, Olsen P, S81 P/S)
            //   'proportion' — %BS (S81 cations: K, Ca, Mg, Na as %BS of CEC)
            // _computeAmendmentDecision expects deficit in ppm for its kg/ha math
            // (kgPerHa = deficit_ppm × depth × bd × 0.1). For proportion axis,
            // convert deficit_%BS → deficit_me/100g → deficit_ppm via CEC.
            // For absolute me/100g axis (S277 cations), convert via the same
            // me/100g × factor table (Mg×122, K×391, Ca×200, Na×230).
            // For absolute mg/L or mg/kg axis (P, S), pass through unchanged.
            //
            // CEC source: soilData.CEC populated by collectData from Hill Labs
            // certificate. If missing on a proportion-axis sample, conversion
            // returns null and the nutrient falls through (no amendment row;
            // defensive degradation).
            var deficit = thresh.min - value;
            var unit = thresh.unit;
            var axis = thresh.axis;

            if (axis === 'proportion' && unit === '%BS') {
                // ────────────────────────────────────────────────────────────
                // b35fix438 (C49): %BS amendment math rollback
                // ────────────────────────────────────────────────────────────
                // Pre-fix (b35fix437): %BS deficit converted via CEC to ppm
                // and passed to _computeAmendmentDecision, emitting an
                // amendment row keyed against the BCSR/%BS reference.
                //
                // Post-fix: refuse to compute amendments from %BS values.
                // The Basic Cation Saturation Ratio (BCSR) framework lacks
                // scientific support for predicting plant response in turf:
                //   - Kopittke & Menzies (2007) SSSAJ 71:259-265: BCSR review
                //     finds Ca:Mg:K ratio targets do not correlate with yield.
                //   - Carrow, Waddington & Rieke (2001) Turfgrass Soil
                //     Fertility & Chemical Problems: explicitly recommends
                //     SLAN/MLSN over BCSR for turf.
                //   - Stowell & Gelernter (PACE Turf): MLSN was developed
                //     because BCSR/%BS thresholds produced over-fertilisation
                //     recommendations on turf without yield response.
                //
                // The SSOT keeps the %BS thresholds because the Framework
                // Comparison block discloses what Hill Labs printed on the
                // certificate (informational fidelity), but no amendment
                // recommendations are derived from %BS. Customers needing
                // S81 cation amendment guidance should use tissue analysis
                // (PACE Turf tissue ranges already in the hub) or arrange
                // Mehlich-3 testing for MLSN/SLAN comparison.
                if (typeof console !== 'undefined' && console.info) {
                    console.info('[WordExport b35fix438] Skipping amendment for', n.key,
                        '(%BS axis): BCSR not validated for turf per Kopittke & Menzies 2007, Carrow et al. 2001.');
                }
                return;
            } else if (axis === 'absolute' && unit === 'me/100g') {
                // me/100g → ppm via cation conversion factor
                var hlSSOT2 = (typeof window !== 'undefined') ? window.HillLabsSampleTypes : null;
                var ppmDeficit2 = hlSSOT2 && typeof hlSSOT2.meq100gToPpm === 'function'
                    ? hlSSOT2.meq100gToPpm(deficit, n.key)
                    : null;
                if (ppmDeficit2 == null || isNaN(ppmDeficit2) || ppmDeficit2 <= 0) {
                    return;
                }
                deficit = ppmDeficit2;
            }
            // axis === 'absolute' && unit === 'mg/L' (Olsen P) or 'mg/kg' (sulphate-S):
            // deficit is already in the engine's native unit, pass through unchanged.
            // axis === undefined (MLSN/SLAN paths): legacy ppm assumption holds.

            var d = _computeAmendmentDecision(n.key, deficit, soilData, surfaceType, nutritionProgram, context, hemisphere);
            if (!d) return;
            d._displayName = n.name;
            decisions.push(d);
        });

        // b35fix321: run the cross-cutting warnings collector after all
        // per-nutrient decisions are built. Mutates each decision's
        // .warnings[] array. Pure function — depends only on the decision
        // set, programme, soil, and context.
        try {
            _collectCrossCuttingWarnings(decisions, nutritionProgram, soilData, context);
        } catch (e) {
            if (typeof console !== 'undefined' && console.warn) {
                console.warn('[WordExport] _collectCrossCuttingWarnings failed:', e && e.message);
            }
        }

        var sectionPieces = [];

        // Heading (always added when called — caller decides whether to call)
        sectionPieces.push(new Paragraph({
            heading: HeadingLevel.HEADING_2,
            keepNext: true,
            spacing: { before: 240, after: 80 },
            children: [new TextRun({ text: 'Annual Soil Amendments', bold: true })]
        }));

        if (decisions.length === 0) {
            sectionPieces.push(new Paragraph({
                spacing: { after: 120 },
                children: [new TextRun({
                    text: 'No standalone soil amendments required, all measured nutrients are at or ' +
                          'above ' + (isAA ? 'Ammonium Acetate (Hill Labs)' : methodology) +
                          ' guideline levels.',
                    size: 20, italics: true, color: '6B7280'
                })]
            }));
            return sectionPieces;
        }

        // Intro
        sectionPieces.push(new Paragraph({
            spacing: { after: 120 },
            children: [new TextRun({
                text: 'Soil deficits are reconciled against the nutrition programme delivery before ' +
                      'recommending standalone amendments. Where the programme already meets the deficit, ' +
                      'the standalone product is suppressed; otherwise the rate is reduced to the residual.',
                size: 18, italics: true, color: '6B7280'
            })]
        }));

        var border = { style: BorderStyle.SINGLE, size: 1, color: 'D1D5DB' };
        var borders = { top: border, bottom: border, left: border, right: border };

        function headerCell(text, width, bg) {
            return new TableCell({
                borders: borders,
                width: { size: width, type: WidthType.DXA },
                shading: { fill: bg || 'F3F4F6', type: ShadingType.CLEAR },
                children: [new Paragraph({
                    alignment: AlignmentType.CENTER,
                    children: [new TextRun({ text: text, bold: true, size: 18 })]
                })]
            });
        }

        function bodyCell(text, width, opts) {
            opts = opts || {};
            return new TableCell({
                borders: borders,
                width: { size: width, type: WidthType.DXA },
                shading: opts.shading ? { fill: opts.shading, type: ShadingType.CLEAR } : undefined,
                children: [new Paragraph({
                    alignment: opts.align || AlignmentType.LEFT,
                    children: [new TextRun({
                        text: String(text == null ? '-' : text),
                        size: 16,
                        bold: !!opts.bold,
                        color: opts.color || '1F2937'
                    })]
                })]
            });
        }

        // Column widths (DXA). Total must fit usable A4 portrait (9 746 DXA).
        // Previous total was 10 000 DXA — reduced proportionally to 9 300.
        var colW = {
            nutrient:    1100,
            deficit:      950,
            delivers:    1100,
            residual:     950,
            product:     1900,
            theoretical: 1000,
            practical:   1000,
            status:      1300
        };

        var headerRow = new TableRow({
            tableHeader: true,
            cantSplit: true,
            children: [
                headerCell('Nutrient',                       colW.nutrient),
                headerCell('Soil deficit\n(kg/ha)',          colW.deficit),
                headerCell('Programme delivers\n(kg/ha)',    colW.delivers,    'EFF6FF'),
                headerCell('Residual\n(kg/ha)',              colW.residual,    'EFF6FF'),
                headerCell('Product',                        colW.product),
                headerCell('Theoretical\n(kg/ha)',           colW.theoretical, 'FEF3C7'),
                headerCell('Practical\n(kg/ha/yr)',          colW.practical,   'DCFCE7'),
                headerCell('Status',                         colW.status)
            ]
        });

        var rows = [headerRow];

        decisions.forEach(function(d) {
            var statusLabel, statusColor, statusBg;
            switch (d.status) {
                case 'apply':
                    statusLabel = 'Apply';
                    statusColor = 'B45309';
                    statusBg = 'FEF3C7';
                    break;
                case 'suppressed_programme':
                    statusLabel = 'Suppressed (programme covers)';
                    statusColor = '15803D';
                    statusBg = 'DCFCE7';
                    break;
                case 'suppressed_dolomite':
                    statusLabel = 'Suppressed (dolomite covers)';
                    statusColor = '15803D';
                    statusBg = 'DCFCE7';
                    break;
                case 'suppressed_combined':
                    statusLabel = 'Suppressed (combined)';
                    statusColor = '15803D';
                    statusBg = 'DCFCE7';
                    break;
                case 'no_deficit':
                    statusLabel = 'No deficit';
                    statusColor = '6B7280';
                    statusBg = 'F9FAFB';
                    break;
                case 'monitor':
                    // b35fix425 (C19): Marginal-band rows (deficit < 25% of
                    // threshold) show as "Monitor" in info-blue rather than the
                    // amber "Apply" colour. Product / theoretical / practical
                    // cells render as '-' (the d.kgTheoretical/kgPractical zero
                    // condition catches the practical/theoretical cells via the
                    // existing `apply` guard below).
                    statusLabel = 'Monitor';
                    statusColor = '1D4ED8';
                    statusBg = 'DBEAFE';
                    break;
                default:
                    statusLabel = String(d.status || '-');
                    statusColor = '1F2937';
                    statusBg = null;
            }

            // For suppression rows, blank out product / theoretical / practical cells (status carries the meaning).
            var productText     = d.status === 'apply' ? d.product : '-';
            var theoreticalText = d.status === 'apply' && d.kgTheoretical != null ? d.kgTheoretical.toFixed(1) : '-';
            var practicalText   = d.status === 'apply' && d.kgPractical != null   ? d.kgPractical.toFixed(1)   : '-';

            rows.push(new TableRow({
                cantSplit: true,
                children: [
                    bodyCell(d._displayName, colW.nutrient, { bold: true }),
                    bodyCell(d.kgDeficit.toFixed(1), colW.deficit, { align: AlignmentType.CENTER }),
                    bodyCell(d.kgProgramme.toFixed(1), colW.delivers, { align: AlignmentType.CENTER, shading: 'F8FAFC' }),
                    bodyCell(d.kgResidual.toFixed(1), colW.residual, { align: AlignmentType.CENTER, shading: 'F8FAFC' }),
                    bodyCell(productText, colW.product),
                    bodyCell(theoreticalText, colW.theoretical, { align: AlignmentType.CENTER, shading: 'FEF3C7' }),
                    bodyCell(practicalText,   colW.practical,   { align: AlignmentType.CENTER, shading: 'DCFCE7', bold: true }),
                    bodyCell(statusLabel, colW.status, { bold: true, color: statusColor, shading: statusBg, align: AlignmentType.CENTER })
                ]
            }));
        });

        sectionPieces.push(new Table({
            width: { size: 9300, type: WidthType.DXA },
            columnWidths: [colW.nutrient, colW.deficit, colW.delivers, colW.residual, colW.product, colW.theoretical, colW.practical, colW.status],
            rows: rows
        }));

        // b35fix423 (C29): explainer footnote for the Theoretical / Practical
        // column pair. Always rendered when at least one apply row exists,
        // since the user needs to know what the two columns mean.
        var anyApplyRow = decisions.some(function(d) { return d.status === 'apply'; });
        if (anyApplyRow) {
            sectionPieces.push(new Paragraph({
                spacing: { before: 80, after: 60 },
                children: [new TextRun({
                    text: 'Theoretical = full deficit closure in 1 year at 100% efficiency. ' +
                          'Practical = (theoretical / amendment efficiency) / years to correct. ' +
                          'Practical figures account for fixation, leaching, and amendment-loss pathways; ' +
                          'apply the Practical column figure as the annual programme rate.',
                    size: 14, italics: true, color: '6B7280'
                })]
            }));
        }

        // Footnote — flag any rows where programme contributors exist so the
        // user can trace the programme reference.
        var contribLines = [];
        decisions.forEach(function(d) {
            if (!d.contributing || !d.contributing.length) return;
            var srcs = d.contributing.map(function(c) {
                return c.name + ' (' + c.kgNutrient + ' kg ' + d.nutrient + '/ha)';
            }).join(', ');
            contribLines.push(d._displayName + ' programme sources: ' + srcs);
        });
        if (contribLines.length > 0) {
            sectionPieces.push(new Paragraph({
                spacing: { before: 80, after: 60 },
                children: [new TextRun({
                    text: contribLines.join(' | '),
                    size: 14, italics: true, color: '6B7280'
                })]
            }));
        }

        // b35fix321: surface cross-cutting warnings (lime/ammoniacal sequencing,
        // Ca-phosphate / Ca-sulphate fertigation incompatibility). De-duplicate
        // by warning code so a warning attached to multiple decisions only
        // renders once.
        var renderedWarningCodes = {};
        var allWarnings = [];
        decisions.forEach(function(d) {
            if (!d.warnings || d.warnings.length === 0) return;
            d.warnings.forEach(function(w) {
                if (!w || !w.code || renderedWarningCodes[w.code]) return;
                renderedWarningCodes[w.code] = true;
                allWarnings.push(w);
            });
        });

        if (allWarnings.length > 0) {
            // Section heading
            sectionPieces.push(new Paragraph({
                spacing: { before: 200, after: 60 },
                keepNext: true,
                children: [new TextRun({
                    text: 'Application Warnings & Sequencing Notes',
                    bold: true, size: 20, color: 'B45309'
                })]
            }));

            allWarnings.forEach(function(w) {
                var headerColour = w.severity === 'high' ? 'B91C1C'  // red-700
                                 : w.severity === 'medium' ? 'B45309' // amber-700
                                 : '6B7280';                          // grey-500
                var bgColour = w.severity === 'high' ? 'FEF2F2'      // red-50
                             : w.severity === 'medium' ? 'FFFBEB'    // amber-50
                             : 'F9FAFB';                              // grey-50

                // Warning body paragraph (inline title + text + source)
                var titleByCode = {
                    'lime_ammoniacal_sequencing':  'Lime/dolomite ↔ ammoniacal N timing',
                    'ca_phosphate_incompatibility': 'Calcium nitrate + phosphate fertigation incompatibility',
                    'ca_sulphate_incompatibility':  'Calcium nitrate + ammonium sulphate fertigation incompatibility'
                };
                var title = titleByCode[w.code] || w.code;

                sectionPieces.push(new Paragraph({
                    spacing: { before: 80, after: 40 },
                    shading: { fill: bgColour, type: ShadingType.CLEAR },
                    children: [
                        new TextRun({ text: title + ': ', bold: true, size: 16, color: headerColour }),
                        new TextRun({ text: w.text, size: 16, color: '1F2937' })
                    ]
                }));

                if (w.source) {
                    sectionPieces.push(new Paragraph({
                        spacing: { after: 40 },
                        children: [new TextRun({
                            text: 'Source: ' + w.source,
                            size: 13, italics: true, color: '6B7280'
                        })]
                    }));
                }
            });
        }

        sectionPieces.push(new Paragraph({
            spacing: { before: 60, after: 160 },
            children: [new TextRun({
                text: 'Rates expressed as elemental kg/ha. Soil deficit = (threshold − measured) × 10 cm × 1.4 g/cm³ × 0.1. ' +
                      'Programme delivery summed across annual applications.',
                size: 14, italics: true, color: '9CA3AF'
            })]
        }));

        return sectionPieces;
    }

    /**
     * Generate tissue interpretation narrative and recommendations
     */
    function generateTissueNarrative(tissueData) {
        if (!tissueData || !tissueData.ranges) return null;
        
        var narrative = [];
        var recommendations = [];
        var low = [];
        var high = [];
        var adequate = [];
        
        var nutrients = [
            { key: 'N', name: 'Nitrogen', unit: '%', type: 'macro' },
            { key: 'P', name: 'Phosphorus', unit: '%', type: 'macro' },
            { key: 'K', name: 'Potassium', unit: '%', type: 'macro' },
            { key: 'Ca', name: 'Calcium', unit: '%', type: 'macro' },
            { key: 'Mg', name: 'Magnesium', unit: '%', type: 'macro' },
            { key: 'S', name: 'Sulphur', unit: '%', type: 'macro' },
            { key: 'Fe', name: 'Iron', unit: 'ppm', type: 'micro' },
            { key: 'Mn', name: 'Manganese', unit: 'ppm', type: 'micro' },
            { key: 'Zn', name: 'Zinc', unit: 'ppm', type: 'micro' },
            { key: 'Cu', name: 'Copper', unit: 'ppm', type: 'micro' },
            { key: 'B', name: 'Boron', unit: 'ppm', type: 'micro' }
        ];
        
        nutrients.forEach(function(n) {
            var value = tissueData[n.key];
            var range = tissueData.ranges[n.key];
            if (value === undefined || !range) return;
            
            if (value < range.lo) {
                low.push({ nutrient: n.name, value: value, target: range.lo, type: n.type });
            } else if (value > range.hi) {
                high.push({ nutrient: n.name, value: value, target: range.hi, type: n.type });
            } else {
                adequate.push(n.name);
            }
        });
        
        // Build narrative
        if (low.length === 0 && high.length === 0) {
            narrative.push('All tissue nutrient levels are within sufficiency ranges. Plant nutrition is balanced and adequate for healthy growth.');
        } else {
            if (low.length > 0) {
                var lowNames = low.map(function(l) { return l.nutrient; });
                narrative.push(lowNames.join(', ') + (low.length === 1 ? ' is' : ' are') + ' below sufficiency levels, indicating potential deficiency.');
                
                // Generate recommendations for low nutrients
                low.forEach(function(l) {
                    if (l.type === 'macro') {
                        if (l.nutrient === 'Nitrogen') {
                            recommendations.push('Increase nitrogen applications. Consider split applications of quick-release N for rapid response, followed by slow-release sources.');
                        } else if (l.nutrient === 'Potassium') {
                            recommendations.push('Apply potassium sulphate or potassium nitrate as foliar or granular. K is critical for stress tolerance and disease resistance.');
                        } else if (l.nutrient === 'Phosphorus') {
                            recommendations.push('Apply phosphorus-containing fertiliser. Consider foliar MAP or MKP for rapid uptake. Check soil P availability.');
                        } else if (l.nutrient === 'Magnesium') {
                            recommendations.push('Apply magnesium sulphate (Epsom salt) as foliar spray at 2-5 kg/ha or granular application.');
                        } else if (l.nutrient === 'Calcium') {
                            recommendations.push('Apply calcium nitrate or gypsum. Check soil Ca:Mg ratio.');
                        } else if (l.nutrient === 'Sulphur') {
                            recommendations.push('Apply sulphur-containing fertiliser such as ammonium sulphate or potassium sulphate.');
                        }
                    } else {
                        // Micronutrients - typically foliar
                        recommendations.push('Apply foliar ' + l.nutrient.toLowerCase() + ' at label rates. Micronutrient deficiencies respond quickly to foliar applications.');
                    }
                });
            }
            
            if (high.length > 0) {
                var highNames = high.map(function(h) { return h.nutrient; });
                narrative.push(highNames.join(', ') + (high.length === 1 ? ' is' : ' are') + ' above optimal levels. This may indicate luxury consumption or potential antagonism with other nutrients.');
            }
        }
        
        // Check for antagonisms
        if (tissueData.K && tissueData.Mg && tissueData.ranges.K && tissueData.ranges.Mg) {
            var kVal = tissueData.K;
            var mgVal = tissueData.Mg;
            if (kVal > tissueData.ranges.K.hi && mgVal < tissueData.ranges.Mg.lo) {
                narrative.push('High potassium with low magnesium suggests K-Mg antagonism. Reduce K applications and supplement Mg.');
            }
        }
        
        return {
            narrative: narrative,
            recommendations: recommendations,
            limiting: low.map(function(l) { return l.nutrient; })
        };
    }
    
    /**
     * Generate water quality interpretation narrative and recommendations
     * @param {Object} waterData - Water quality data
     * @param {Object} turfData - Optional turf data for species-specific impacts
     */
    function generateWaterNarrative(waterData, turfData) {
        if (!waterData) return null;
        
        var narrative = [];
        var recommendations = [];
        var concerns = [];
        
        // Get species context for recommendations
        var speciesName = 'turf';
        var isOverseedFocused = false;
        if (turfData) {
            isOverseedFocused = turfData.overseedDominant || false;
            speciesName = turfData.effectiveSpecies || turfData.species || 'turf';
        }
        
        // EC assessment
        if (waterData.EC !== undefined) {
            var ec = waterData.EC;
            if (ec < 0.5) {
                narrative.push('Electrical conductivity (EC) is very low at ' + ec.toFixed(2) + ' dS/m, indicating low salinity irrigation water with minimal salt loading risk.');
            } else if (ec < 0.75) {
                narrative.push('EC (' + ec.toFixed(2) + ' dS/m) is within the safe range for all turfgrass species.');
            } else if (ec < 1.5) {
                var marginalNote = isOverseedFocused ? 
                    speciesName + ' may show stress during hot periods as C3 grasses are generally more salt-sensitive than C4.' :
                    'Salt-sensitive species may show stress during hot periods.';
                narrative.push('EC (' + ec.toFixed(2) + ' dS/m) is in the marginal range. ' + marginalNote);
                concerns.push('Marginal salinity');
                recommendations.push('Increase leaching fraction to 15-20% above ET requirements to prevent salt accumulation.');
            } else if (ec < 3.0) {
                var elevatedNote = isOverseedFocused ?
                    speciesName + ', as a C3 grass, has lower salt tolerance than the underlying warm-season base. Growth reduction and tip burn are likely.' :
                    'Only salt-tolerant grasses should be irrigated with this water.';
                narrative.push('EC (' + ec.toFixed(2) + ' dS/m) is elevated. ' + elevatedNote);
                concerns.push('Elevated salinity');
                recommendations.push('Apply gypsum at 1-2 t/ha annually. Maintain leaching fraction of 20-25%. Monitor soil EC regularly.');
            } else {
                narrative.push('EC (' + ec.toFixed(2) + ' dS/m) exceeds safe limits for most turfgrass. Serious management required.');
                concerns.push('High salinity hazard');
                recommendations.push('CRITICAL: Consider alternative water source or blending. If unavoidable, apply heavy gypsum (2-3 t/ha) and aggressive leaching program.');
            }
        }
        
        // SAR assessment
        if (waterData.SAR !== undefined) {
            var sar = waterData.SAR;
            if (sar < 3) {
                narrative.push('SAR (' + sar.toFixed(1) + ') is excellent - no sodium hazard to soil structure.');
            } else if (sar < 6) {
                narrative.push('SAR (' + sar.toFixed(1) + ') is moderate. Monitor soil infiltration rates.');
                concerns.push('Moderate sodium');
            } else if (sar < 12) {
                narrative.push('SAR (' + sar.toFixed(1) + ') is elevated. Soil structure degradation is likely over time.');
                concerns.push('Sodium hazard');
                recommendations.push('Apply gypsum to maintain soil calcium levels and prevent dispersion. Rate: 1-2 t/ha annually.');
            } else {
                narrative.push('SAR (' + sar.toFixed(1) + ') is very high. Severe soil structure problems will occur without management.');
                concerns.push('Severe sodium hazard');
                recommendations.push('URGENT: Apply gypsum at 2-3 t/ha in split applications. Consider acidification if HCO3 is also high. Test soil ESP regularly.');
            }
        }
        
        // Chloride assessment - C3 grasses more sensitive to overhead chloride
        if (waterData.Cl !== undefined && waterData.Cl > 100) {
            var cl = waterData.Cl;
            if (cl < 200) {
                var clNote = isOverseedFocused ?
                    speciesName + ' is more susceptible to foliar chloride damage than warm-season grasses. Irrigate during cooler periods.' :
                    'Foliar damage possible during hot, dry periods with overhead irrigation.';
                narrative.push('Chloride (' + cl + ' ppm) is marginal. ' + clNote);
            } else {
                narrative.push('Chloride (' + cl + ' ppm) exceeds safe levels. Leaf scorch likely with overhead irrigation in summer.');
                concerns.push('Chloride toxicity risk');
                recommendations.push('Irrigate during cooler periods or use subsurface irrigation where possible. Increase leaching to flush chloride from rootzone.');
            }
        }
        
        // Bicarbonate assessment
        if (waterData.HCO3 !== undefined && waterData.HCO3 > 90) {
            var hco3 = waterData.HCO3;
            if (hco3 < 180) {
                narrative.push('Bicarbonate (' + hco3 + ' ppm) is marginal. Some lime precipitation may occur on leaves and emitters.');
            } else {
                narrative.push('Bicarbonate (' + hco3 + ' ppm) is high. White residue on leaves and clogged emitters likely.');
                concerns.push('High bicarbonate');
                recommendations.push('Consider acidification with sulphuric or phosphoric acid to pH 6.5-7.0. This will also improve calcium availability and reduce scaling.');
            }
        }
        
        // RSC assessment
        if (waterData.RSC !== undefined) {
            var rsc = waterData.RSC;
            if (rsc > 1.25) {
                narrative.push('Residual Sodium Carbonate (RSC ' + rsc.toFixed(1) + ' meq/L) is concerning. This water will strip calcium from soil over time.');
                concerns.push('Positive RSC');
                recommendations.push('Apply gypsum to offset calcium removal. Consider acidification to neutralize excess carbonates.');
            } else if (rsc < 0) {
                narrative.push('RSC is negative (' + rsc.toFixed(1) + ' meq/L), indicating adequate calcium and magnesium relative to carbonates. This is beneficial for soil structure.');
            }
        }
        
        // Overall summary
        if (concerns.length === 0) {
            narrative.unshift('Water quality is suitable for turfgrass irrigation with no significant concerns.');
        } else {
            narrative.unshift('Water quality analysis has identified ' + concerns.length + ' concern' + (concerns.length > 1 ? 's' : '') + ' requiring management attention.');
        }
        
        return {
            narrative: narrative,
            recommendations: recommendations,
            concerns: concerns
        };
    }
    
    /**
     * Generate Performance Impact Analysis - discusses relationships between
     * soil, water, tissue, climate, cultivar selection, and other factors affecting turf
     */
    // -------------------------------------------------------------------------
    // b35fix448 / C25 - Performance Impact narrative module-presence gating.
    //
    // Function predates the canonical `data.{module}.hasData` flag rollout
    // (introduced for soil / tissue / water / disease in the v2.0.x series;
    // changelog L17, L155, L204; data writes at L7732, L7812 soil; L8176,
    // L8207 tissue; L8344, L8376, L8403 water; L8508 disease). The four
    // local proxies declared below were the pre-canonical idiom and have
    // since fallen behind: each tests an arbitrary subset of fields and
    // misses valid module-present cases (soil pH-only, tissue Mg-only,
    // water HCO3-only, etc.). The proxies are upgraded to consume the
    // canonical flags where one exists; `hasClimateData` is retained as
    // a field-truthiness proxy because the climate module never exports
    // a hasData flag (no canonical to consume).
    //
    // Three branches were also over-gated by composing two module proxies
    // where the agronomic content of the branch only requires one:
    //   - Branch at L4326 (high-SAR water copy): water-only sufficient,
    //     was nested under hasSoilData && hasWaterData.
    //   - Branch at L4346 (high-EC water copy): water-only sufficient,
    //     was nested under hasSoilData && hasWaterData. Inner Ca:Mg /
    //     soil-K compound effects retain their soil gates.
    //   - Branch at L4399 (pH × P availability): soil-only sufficient
    //     for the relationships push, was nested under hasTissueData &&
    //     hasSoilData. The inner "tissue confirms" recommendations push
    //     retains its tissue gate.
    //
    // Compound-stress aggregator at L4602-L4604 reads raw `data.tissue.N`
    // / `data.tissue.K` numerics where the canonical flag exists and is
    // strictly safer; gated on `data.tissue.hasData` to prevent the
    // numeric-truthiness fallthrough on tissue-absent fixtures.
    //
    // Single call site: buildSections() at L13264, fed by collectData()
    // which sets all canonical flags before buildSections runs. Combined
    // export skips this section entirely (word-export-combined.js L2467
    // siteLevelHeadings deny-list). Flag propagation verified in
    // pre-estimate audit; no scope-mismatch risk per b35fix435 lesson #26.
    //
    // C25 ledger entry's source pointer was wrong (said cross-module-
    // pattern.js, actual is this function) and bug-class characterisation
    // was wrong (said config-aware-copy framework rebuild, actual is
    // mechanical proxy upgrade). The "cool-season overseed" copy noted
    // in the C25 production-evidence claim does NOT originate here; this
    // function emits no such literal. That copy lives in generatePriorityActions
    // L4647 fallback and the soil.speciesName fallback at L8125/8129, and
    // is logged as adjacent C-entries (C25a, C25b) for follow-up.
    // -------------------------------------------------------------------------
    function generatePerformanceImpactAnalysis(data) {
        if (!data) return null;
        
        var narrative = [];
        var relationships = [];
        var recommendations = [];
        var hasImpacts = false;
        
        // Use effective species/variety for overseed dominant situations
        var varietyName = (data.varietyTraits && data.varietyTraits.displayName) || 
                          (data.turf && data.turf.effectiveVariety && data.turf.effectiveVariety !== 'generic' ? data.turf.effectiveVariety : null) ||
                          (data.turf && data.turf.variety !== 'generic' ? data.turf.variety : null);
        var speciesName = data.turf ? (data.turf.effectiveSpecies || data.turf.speciesDisplay || data.turf.species || 'turf') : 'turf';
        var isOverseedFocused = data.turf && data.turf.overseedDominant;
        
        // b35fix448 / C25: module-presence proxies upgraded to canonical hasData
        // flags where one is published by the producing module. Climate has no
        // canonical flag (no producer write), retains field-truthiness proxy.
        var hasSoilData = !!(data.soil && data.soil.hasData);
        var hasTissueData = !!(data.tissue && data.tissue.hasData);
        var hasWaterData = !!(data.water && data.water.hasData);
        var hasClimateData = data.climate && (data.climate.growthPotential !== undefined || data.climate.temperature !== undefined);
        
        // Add overseed context to narrative if applicable
        if (isOverseedFocused) {
            narrative.push('With ' + Math.round(data.turf.c3Fraction * 100) + '% ' + speciesName + ' cover established, management focus is on the overseeded grass. All agronomic recommendations in this section are specific to ' + speciesName + ' requirements.');
        }
        
        // ========== SOIL × WATER INTERACTIONS ==========
        // b35fix448 / C25: Bicarbonate × Ca branch genuinely requires both soil
        // and water (Ca status comparison is core to the message). SAR and EC
        // branches split out below into water-only siblings; their primary
        // claim is about water chemistry, with soil-state compounds gated
        // inline. Pre-fix the nested structure silenced the SAR / EC narrative
        // entirely on water-only fixtures.
        if (hasSoilData && hasWaterData) {
            // High bicarbonate water affecting soil calcium availability
            if (data.water.HCO3 && data.water.HCO3 > 180 && data.soil.Ca) {
                var caStatus = data.soil.thresholds && data.soil.thresholds.Ca ? 
                    (data.soil.Ca < data.soil.thresholds.Ca.min ? 'low' : 'adequate') : 'unknown';
                
                if (caStatus === 'low' || data.soil.Ca < 400) {
                    relationships.push({
                        type: 'interaction',
                        text: 'The high bicarbonate content of the irrigation water (' + data.water.HCO3 + ' ppm) will precipitate calcium carbonate when applied, reducing plant-available calcium in the rootzone. Given that soil calcium (' + data.soil.Ca + ' ppm) is already limited, this interaction compounds the risk of calcium deficiency.'
                    });
                    recommendations.push('Consider acidifying irrigation water to pH 6.5-7.0 to improve calcium availability. Apply gypsum (calcium sulphate) as a supplemental calcium source that won\'t raise pH.');
                    hasImpacts = true;
                } else {
                    relationships.push({
                        type: 'monitoring',
                        text: 'The elevated bicarbonate level in irrigation water (' + data.water.HCO3 + ' ppm) may reduce calcium availability over time through precipitation reactions. Current soil calcium (' + data.soil.Ca + ' ppm) provides an adequate buffer, but levels should be monitored for decline.'
                    });
                    hasImpacts = true;
                }
            }
        }
        
        // High SAR water affecting soil structure and nutrient availability.
        // b35fix448 / C25: water-only sufficient for the primary SAR claim;
        // soil-state Ca:Mg compound effect gated inline on hasSoilData.
        if (hasWaterData && data.water.SAR && data.water.SAR > 6) {
            relationships.push({
                type: 'concern',
                text: 'The elevated sodium adsorption ratio (SAR ' + data.water.SAR.toFixed(1) + ') of the irrigation water promotes sodium accumulation in the soil profile. Over time, sodium displaces calcium and magnesium from soil exchange sites, degrading soil structure and reducing both infiltration rates and root penetration capacity.'
            });
            
            if (hasSoilData && data.soil.Ca && data.soil.Mg) {
                var caMgRatio = data.soil.Ca / data.soil.Mg;
                if (caMgRatio < 3) {
                    relationships.push({
                        type: 'compound',
                        text: 'This situation is exacerbated by the current Ca:Mg ratio (' + caMgRatio.toFixed(1) + ':1), which is already below optimal. Continued irrigation with high-SAR water will further displace calcium, worsening soil physical properties and potentially inducing magnesium-induced calcium deficiency in the turf.'
                    });
                }
            }
            recommendations.push('Apply gypsum at 1-2 t/ha annually to maintain calcium dominance on exchange sites. Monitor soil ESP (exchangeable sodium percentage) and infiltration rates.');
            hasImpacts = true;
        }
        
        // Saline water affecting nutrient uptake.
        // b35fix448 / C25: water-only sufficient for the primary EC claim;
        // soil-K compensation recommendation gated inline on hasSoilData.
        if (hasWaterData && data.water.EC && data.water.EC > 1.5) {
            relationships.push({
                type: 'interaction',
                text: 'The elevated salinity of the irrigation water (EC ' + data.water.EC.toFixed(2) + ' dS/m) reduces nutrient uptake efficiency across all elements. Plants must expend metabolic energy on osmotic adjustment rather than growth, and the high sodium and chloride concentrations compete directly with potassium and nitrate uptake at root membrane transport sites.'
            });
            
            if (hasSoilData && data.soil.K && data.soil.thresholds && data.soil.thresholds.K) {
                if (data.soil.K < data.soil.thresholds.K.min * 1.5) {
                    recommendations.push('Maintain soil potassium at 150% of normal MLSN target to compensate for sodium competition at uptake sites. Apply potassium sulphate rather than potassium chloride to avoid adding additional chloride load.');
                }
            }
            hasImpacts = true;
        }
        
        // ========== TISSUE × SOIL RELATIONSHIPS ==========
        // b35fix448 / C25: K-uptake-restriction and K-induced-Mg-deficiency
        // branches genuinely require both tissue and soil (the diagnostic
        // claim is "tissue X despite soil Y"). pH × P availability split
        // out below; its primary claim is about soil pH effects on P
        // availability, with tissue confirmation gated inline on the
        // recommendation push only.
        if (hasTissueData && hasSoilData) {
            // Tissue deficiency despite adequate soil levels - suggests uptake problem
            if (data.tissue.K && data.soil.K && data.tissue.ranges && data.tissue.ranges.K) {
                var tissueKLow = data.tissue.K < data.tissue.ranges.K.lo;
                var soilKAdequate = data.soil.thresholds && data.soil.thresholds.K && 
                                    data.soil.K >= data.soil.thresholds.K.min;
                
                if (tissueKLow && soilKAdequate) {
                    relationships.push({
                        type: 'diagnostic',
                        text: 'Tissue potassium (' + data.tissue.K + '%) is below the sufficiency range despite adequate soil K reserves (' + data.soil.K + ' ppm). This discrepancy suggests an uptake restriction rather than a supply problem. Potential causes include root damage, soil compaction, waterlogging, or cation antagonism from excess sodium, calcium, or magnesium competing at root uptake sites.'
                    });
                    recommendations.push('Investigate root health and soil physical conditions. Foliar potassium applications can bypass root uptake limitations for immediate response while underlying issues are addressed.');
                    hasImpacts = true;
                }
            }
            
            // Similar check for other nutrients
            if (data.tissue.Mg && data.soil.Mg && data.tissue.ranges && data.tissue.ranges.Mg) {
                var tissueMgLow = data.tissue.Mg < data.tissue.ranges.Mg.lo;
                var soilMgAdequate = data.soil.thresholds && data.soil.thresholds.Mg && 
                                     data.soil.Mg >= data.soil.thresholds.Mg.min;
                
                if (tissueMgLow && soilMgAdequate) {
                    // Check for K-induced Mg deficiency
                    if (data.tissue.K && data.tissue.ranges.K && data.tissue.K > data.tissue.ranges.K.hi) {
                        relationships.push({
                            type: 'interaction',
                            text: 'The combination of low tissue magnesium (' + data.tissue.Mg + '%) and elevated tissue potassium (' + data.tissue.K + '%) indicates potassium-magnesium antagonism. Excessive potassium uptake is suppressing magnesium absorption at the root level, despite adequate magnesium being present in the soil. This is a common issue following heavy potassium fertilisation.'
                        });
                        recommendations.push('Reduce potassium applications and apply foliar magnesium sulphate (2-5 kg/ha) until tissue Mg recovers. Avoid high-K fertilisers until cation balance is restored.');
                        hasImpacts = true;
                    }
                }
            }
        }
        
        // Phosphorus availability vs pH.
        // b35fix448 / C25: soil-only sufficient for the primary pH × P
        // availability claim; tissue P confirmation gated inline on the
        // recommendation push only. Pre-fix this branch was silenced
        // entirely on tissue-absent fixtures (e.g. soil-only quick reviews).
        if (hasSoilData && data.soil.pH && data.soil.P) {
            var pH = data.soil.pH;
            var P = data.soil.P;
            
            if ((pH < 5.5 || pH > 7.5) && P < 30) {
                var pIssue = pH < 5.5 ? 
                    'The low soil pH (' + pH + ') causes phosphorus to bind with aluminium and iron oxides' : 
                    'The elevated soil pH (' + pH + ') causes phosphorus to precipitate with calcium';
                relationships.push({
                    type: 'interaction',
                    text: pIssue + ', reducing the proportion that remains plant-available. The soil test P value (' + P + ' ppm) likely overestimates actual phosphorus availability under these pH conditions.'
                });
                
                if (hasTissueData && data.tissue.P && data.tissue.ranges && data.tissue.ranges.P) {
                    if (data.tissue.P < data.tissue.ranges.P.lo) {
                        recommendations.push('Tissue P confirms limited availability despite soil reserves. Apply phosphorus as foliar MAP or MKP for rapid uptake, and address soil pH to improve long-term phosphorus availability.');
                    }
                }
                hasImpacts = true;
            }
        }
        
        // ========== CLIMATE × RECOVERY RELATIONSHIPS ==========
        if (hasClimateData) {
            var gp = data.climate.growthPotential;
            var temp = data.climate.temperature;
            
            // Low growth potential impacts
            if (gp !== undefined && gp !== null) {
                if (gp < 20) {
                    relationships.push({
                        type: 'concern',
                        text: 'Current growth potential (' + Math.round(gp) + '%) severely restricts the turf\'s ability to recover from damage. Any injury from traffic, disease, or other stressors will persist until temperatures return to the species\' optimal growth range. Management should focus on protection rather than recovery during this period.'
                    });
                    
                    // Compound with traffic
                    if (data.traffic && data.traffic.hasData) {
                        recommendations.push('Reduce traffic load during low growth periods. Recovery from wear damage will be 3-5 times slower than during optimal growth conditions.');
                    }
                    
                    // Compound with disease
                    if (data.disease && data.disease.hasData && 
                        (data.disease.overallRisk === 'high' || data.disease.overallRisk === 'severe')) {
                        relationships.push({
                            type: 'compound',
                            text: 'The coincidence of disease pressure with low recovery capacity creates a critical situation. The turf cannot outgrow pathogen damage at current growth rates, making proactive fungicide applications essential. Curative treatments will be less effective as damaged tissue cannot be replaced quickly.'
                        });
                    }
                    hasImpacts = true;
                    
                } else if (gp < 50) {
                    relationships.push({
                        type: 'monitoring',
                        text: 'Moderate growth potential (' + Math.round(gp) + '%) allows gradual recovery but with extended healing times compared to peak growing conditions. This should be factored into scheduling of renovations, aeration, or intensive traffic periods.'
                    });
                    hasImpacts = true;
                }
                
                // High growth potential considerations
                if (gp > 80) {
                    relationships.push({
                        type: 'positive',
                        text: 'Current growth potential (' + Math.round(gp) + '%) provides excellent recovery capacity. This is the optimal window for renovation work, aggressive aeration, or recovering from previous damage. The turf can rapidly replace damaged tissue under these conditions.'
                    });
                    
                    // But check for nutrient limitations
                    if (hasTissueData && data.tissue.N && data.tissue.ranges && data.tissue.ranges.N) {
                        if (data.tissue.N < data.tissue.ranges.N.lo) {
                            relationships.push({
                                type: 'interaction',
                                text: 'Despite favourable growth conditions, tissue nitrogen (' + data.tissue.N + '%) is below sufficiency, meaning the plant cannot capitalise on the high growth potential. Growth is currently nitrogen-limited rather than temperature-limited.'
                            });
                            recommendations.push('Apply nitrogen to support current growth demand. Spoon-feeding with light, frequent applications is most efficient during rapid growth periods.');
                        }
                    }
                    hasImpacts = true;
                }
            }
            
            // Temperature stress impacts on water/nutrient relations
            if (temp !== undefined) {
                if (temp > 30) {
                    relationships.push({
                        type: 'concern',
                        text: 'Current heat stress conditions (' + temp.toFixed(1) + '°C) increase transpiration demand and can cause temporary root dysfunction. This reduces nutrient and water uptake efficiency even when soil supplies are adequate, as root membrane transport processes become less effective at elevated temperatures.'
                    });
                    
                    if (hasWaterData && data.water.EC && data.water.EC > 1.0) {
                        relationships.push({
                            type: 'compound',
                            text: 'The combination of high temperatures and elevated irrigation water salinity creates compounding stress. Increased transpiration concentrates salts in the root zone more rapidly, while heat-stressed roots are less able to exclude sodium and chloride ions, allowing greater toxic accumulation in leaf tissue.'
                        });
                        recommendations.push('Increase irrigation frequency with smaller volumes to prevent salt accumulation in the rootzone. Syringe during peak heat periods to reduce canopy temperature and transpiration demand.');
                    }
                    hasImpacts = true;
                }
            }
        }
        
        // ========== SHADE × NUTRITION × CLIMATE ==========
        if (data.shade && data.shade.currentDLI && data.shade.targetDLI) {
            var dliDeficit = data.shade.deficit || 
                ((data.shade.targetDLI - data.shade.currentDLI) / data.shade.targetDLI * 100);
            
            if (dliDeficit > 15) {
                relationships.push({
                    type: 'concern',
                    text: 'The current light limitation (' + Math.round(dliDeficit) + '% below target DLI) reduces photosynthetic capacity and carbohydrate production. This has cascading effects on the plant\'s ability to respond to all other stressors, as disease resistance, traffic tolerance, heat tolerance, and drought tolerance all depend on adequate carbohydrate reserves.'
                });
                
                // Shade + nitrogen interaction
                if (hasTissueData && data.tissue.N && data.tissue.ranges && data.tissue.ranges.N) {
                    if (data.tissue.N > data.tissue.ranges.N.hi * 0.9) {
                        relationships.push({
                            type: 'interaction',
                            text: 'The combination of shade stress and high tissue nitrogen (' + data.tissue.N + '%) promotes weak, etiolated growth with thin cell walls and elongated internodes. This tissue is structurally weaker and more susceptible to both disease infection and physical damage from traffic.'
                        });
                        recommendations.push('Reduce nitrogen application rates by 25-40% in shaded areas. Maintain potassium at or above normal levels to maximise cell wall strength and stress tolerance of shade-adapted tissue.');
                    }
                }
                
                // Shade + climate
                if (hasClimateData && data.climate.growthPotential && data.climate.growthPotential < 40) {
                    relationships.push({
                        type: 'compound',
                        text: 'Shade stress occurring during periods of low growth potential is particularly damaging. The plant cannot produce sufficient carbohydrates to maintain existing tissue, let alone recover from damage, leading to progressive thinning, root decline, and eventual loss of stand density.'
                    });
                }
                hasImpacts = true;
            }
        }
        
        // ========== CULTIVAR TRAIT IMPACTS ==========
        if (data.varietyTraits && data.varietyTraits.hasData && varietyName) {
            narrative.push(varietyName + ' has been selected for this site. Variety-specific traits modify the baseline species response to the conditions described above.');
            
            // Shade tolerance analysis
            if (data.varietyTraits.shade && data.varietyTraits.shade.modifier) {
                var shadeMod = data.varietyTraits.shade.modifier;
                if (shadeMod < 0.95) {
                    var shadeAdvantage = Math.round((1 - shadeMod) * 100);
                    relationships.push({
                        type: 'positive',
                        text: varietyName + ' demonstrates enhanced shade tolerance (can tolerate ' + shadeAdvantage + '% lower DLI than species baseline).',
                        source: data.varietyTraits.shade.source
                    });
                    hasImpacts = true;
                } else if (shadeMod > 1.05) {
                    var shadeDisadvantage = Math.round((shadeMod - 1) * 100);
                    relationships.push({
                        type: 'negative',
                        text: varietyName + ' has reduced shade tolerance (requires ' + shadeDisadvantage + '% higher DLI than species baseline).',
                        source: data.varietyTraits.shade.source
                    });
                    hasImpacts = true;
                }
            }
            
            // Salinity tolerance analysis
            if (data.varietyTraits.salinity && data.varietyTraits.salinity.multiplier) {
                var saltMod = data.varietyTraits.salinity.multiplier;
                if (saltMod < 0.95) {
                    var saltAdvantage = Math.round((1 - saltMod) * 100);
                    relationships.push({
                        type: 'positive',
                        text: varietyName + ' exhibits improved salinity tolerance (' + saltAdvantage + '% less growth reduction from salt stress).',
                        source: data.varietyTraits.salinity.source
                    });
                    hasImpacts = true;
                }
            }
            
            // Wear tolerance
            if (data.varietyTraits.wear && data.varietyTraits.wear.multiplier) {
                var wearMod = data.varietyTraits.wear.multiplier;
                if (wearMod < 0.90) {
                    var wearAdvantage = Math.round((1 - wearMod) * 100);
                    relationships.push({
                        type: 'positive',
                        text: varietyName + ' has superior traffic tolerance (' + wearAdvantage + '% less wear damage under equivalent use).',
                        source: data.varietyTraits.wear.source
                    });
                    hasImpacts = true;
                }
            }
        }
        
        // ========== COMPOUND STRESS SUMMARY ==========
        var stressors = [];
        if (data.water && data.water.EC > 1.5) stressors.push('salinity stress');
        if (data.shade && data.shade.deficit > 20) stressors.push('light limitation');
        if (data.traffic && data.traffic.status && data.traffic.status.toLowerCase().indexOf('high') > -1) stressors.push('traffic pressure');
        if (data.trajectory && data.trajectory.currentScore > 50) stressors.push('environmental stress');
        if (data.disease && data.disease.overallRisk && 
            (data.disease.overallRisk.toLowerCase() === 'high' || data.disease.overallRisk.toLowerCase() === 'severe')) {
            stressors.push('disease pressure');
        }
        if (data.climate && data.climate.growthPotential !== undefined && data.climate.growthPotential < 30) {
            stressors.push('limited growth capacity');
        }
        if (hasTissueData) {
            var deficiencies = [];
            if (data.tissue.N && data.tissue.ranges && data.tissue.ranges.N && data.tissue.N < data.tissue.ranges.N.lo) deficiencies.push('N');
            if (data.tissue.K && data.tissue.ranges && data.tissue.ranges.K && data.tissue.K < data.tissue.ranges.K.lo) deficiencies.push('K');
            if (deficiencies.length > 0) stressors.push('nutrient deficiency (' + deficiencies.join(', ') + ')');
        }
        
        if (stressors.length >= 3) {
            relationships.push({
                type: 'compound',
                text: 'The analysis has identified ' + stressors.length + ' significant concurrent limitations: ' + stressors.join(', ') + '. Under compound stress conditions, the effects are typically multiplicative rather than additive, as each stressor reduces the plant\'s capacity to cope with the others. Management should focus on addressing the most controllable factor first while avoiding any additional disturbance that could further compromise plant health.'
            });
            recommendations.push('Prioritise addressing the most controllable stressor first. Defer renovation work and aggressive cultural practices until at least one major limitation has been resolved.');
            hasImpacts = true;
        } else if (stressors.length === 2) {
            relationships.push({
                type: 'monitoring',
                text: 'Two concurrent stress factors are present: ' + stressors.join(' and ') + '. While manageable individually, the combination requires coordinated attention to prevent escalation. Monitor closely for signs of declining turf health and address both factors before the situation compounds further.'
            });
            hasImpacts = true;
        }
        
        // ========== BUILD FINAL OUTPUT ==========
        if (!hasImpacts) {
            return null; // No significant interactions to report
        }
        
        return {
            narrative: narrative,
            relationships: relationships,
            recommendations: recommendations
        };
    }
    
    /**
     * Generate Priority Action Summary
     * Collects all urgent/important actions across modules and sorts by timeframe
     * Species-aware: uses effective species tolerances for overseed scenarios
     */
    function generatePriorityActions(data) {
        var immediate = [];   // 0-7 days
        var shortTerm = [];   // 7-30 days
        var mediumTerm = [];  // 30-90 days
        
        // Determine effective species for tolerance thresholds
        var isC3Effective = data.turf && (data.turf.overseedDominant || data.soil && data.soil.isC3Species);
        var effectiveSpecies = isC3Effective ? 
            (data.turf.coolOverseed || data.turf.effectiveSpecies || 'cool-season overseed') :
            (data.turf.warmBase || data.turf.species || 'warm-season grass');
        
        // Species-specific thresholds
        var ecCritical = isC3Effective ? 2.0 : 4.0;      // C3 more sensitive
        var ecWarning = isC3Effective ? 1.5 : 2.5;
        var clThreshold = isC3Effective ? 250 : 500;     // C3 more sensitive to Cl
        var sarCritical = isC3Effective ? 6 : 9;
        var sarWarning = isC3Effective ? 4 : 6;
        
        // Water quality critical issues - SPECIES AWARE
        if (data.water) {
            if (data.water.EC > ecCritical) {
                immediate.push('CRITICAL: Water EC (' + data.water.EC + ' dS/m) exceeds ' + effectiveSpecies + ' tolerance (' + ecCritical + ' dS/m). Source blending or alternative supply required immediately.');
            } else if (data.water.EC > ecWarning) {
                shortTerm.push('Water EC (' + data.water.EC + ' dS/m) approaching ' + effectiveSpecies + ' stress threshold. Apply gypsum (2-3 t/ha) and implement leaching program.');
            }
            
            if (data.water.SAR > sarCritical) {
                immediate.push('CRITICAL: SAR (' + (typeof data.water.SAR === 'number' ? data.water.SAR.toFixed(1) : data.water.SAR) + ') indicates severe sodium hazard for ' + effectiveSpecies + '. Apply gypsum immediately.');
            } else if (data.water.SAR > sarWarning) {
                shortTerm.push('SAR elevated (' + (typeof data.water.SAR === 'number' ? data.water.SAR.toFixed(1) : data.water.SAR) + ') - apply gypsum at 1-2 t/ha to protect ' + effectiveSpecies + '.');
            }
            
            if (data.water.Cl > clThreshold) {
                var clSeverity = data.water.Cl > clThreshold * 1.5 ? immediate : shortTerm;
                clSeverity.push('Chloride (' + data.water.Cl + ' ppm) exceeds ' + effectiveSpecies + ' tolerance (' + clThreshold + ' ppm). Irrigate during cooler periods, increase leaching fraction.');
            }
        }
        
        // Soil deficiencies
        if (data.soil && data.soil.thresholds) {
            if (data.soil.K && data.soil.thresholds.K && data.soil.K < data.soil.thresholds.K.min * 0.5) {
                immediate.push('Severe K deficiency - apply potassium sulphate immediately (20-40 kg K/ha elemental, equiv. 48-96 kg product/ha).');
            }
        }
        
        // Tissue deficiencies - uses ranges which should already be species-appropriate
        if (data.tissue && data.tissue.ranges) {
            var rangeSource = data.tissue.rangeSpecies || effectiveSpecies;
            if (data.tissue.K && data.tissue.ranges.K && data.tissue.K < data.tissue.ranges.K.lo * 0.8) {
                immediate.push('Tissue K critically low (' + data.tissue.K + '%) for ' + rangeSource + ' - apply foliar potassium immediately.');
            }
            if (data.tissue.N && data.tissue.ranges.N && data.tissue.N < data.tissue.ranges.N.lo) {
                shortTerm.push('Tissue N below ' + rangeSource + ' sufficiency (' + data.tissue.N + '%) - increase N program or apply foliar N.');
            }
            if (data.tissue.P && data.tissue.ranges.P && data.tissue.P < data.tissue.ranges.P.lo) {
                shortTerm.push('Tissue P below ' + rangeSource + ' sufficiency (' + data.tissue.P + '%) - apply phosphorus fertiliser or foliar MAP/MKP.');
            }
        }
        
        // Disease risk
        if (data.disease) {
            if (data.disease.overallRisk === 'HIGH' || data.disease.overallRisk === 'SEVERE') {
                immediate.push('High disease risk for ' + effectiveSpecies + ' - implement preventive fungicide application within 48 hours.');
            } else if (data.disease.overallRisk === 'MODERATE') {
                shortTerm.push('Moderate disease risk - schedule fungicide application, increase monitoring frequency.');
            }
        }
        
        // PGR reapplication
        if (data.pgr && data.pgr.daysUntilReapply !== undefined) {
            if (data.pgr.daysUntilReapply <= 7) {
                immediate.push('PGR reapplication due within ' + data.pgr.daysUntilReapply + ' days.');
            } else if (data.pgr.daysUntilReapply <= 14) {
                shortTerm.push('Schedule PGR reapplication - due in ' + data.pgr.daysUntilReapply + ' days.');
            }
        }
        
        // Shade/light issues
        if (data.shade && data.shade.deficit > 30) {
            mediumTerm.push('Significant light deficit (' + data.shade.deficit + '%) for ' + effectiveSpecies + ' - evaluate LED supplementation or shade reduction.');
        }
        
        // Traffic management
        if (data.traffic && data.traffic.status) {
            var status = data.traffic.status.toLowerCase();
            if (status.indexOf('critical') > -1 || status.indexOf('high_risk') > -1) {
                shortTerm.push('Traffic load exceeds ' + effectiveSpecies + ' recovery capacity - reduce training frequency or add rest days.');
            }
        }
        
        // N program issues
        if (data.nProgram && data.nProgram.verdict) {
            if (data.nProgram.verdict.level === 'excessive') {
                shortTerm.push('N application exceeds uptake capacity - reduce rates by ' + Math.round(data.nProgram.difference || 0) + ' kg/ha.');
            }
        }
        
        // v2.1.0: Irrigation actions
        if (data.irrigation && data.irrigation.hasData) {
            var irrigStatus = (data.irrigation.status || '').toLowerCase();
            var depletionPct = data.irrigation.depletionPct;
            
            if (irrigStatus === 'critical' || depletionPct >= 70) {
                var refillMsg = 'CRITICAL: Soil moisture depleted to ' + (depletionPct || 'critical') + '% of available water';
                if (data.irrigation.refillDepth) {
                    refillMsg += ' - apply ' + data.irrigation.refillDepth + 'mm irrigation immediately.';
                } else {
                    refillMsg += ' - irrigate immediately to prevent turf stress.';
                }
                immediate.push(refillMsg);
            } else if (irrigStatus === 'stressed' || (depletionPct && depletionPct >= 50)) {
                var stressMsg = 'Soil moisture approaching stress threshold (' + (depletionPct || 'elevated') + '% depletion)';
                if (data.irrigation.refillDepth) {
                    stressMsg += ' - schedule ' + data.irrigation.refillDepth + 'mm irrigation within 24-48 hours.';
                } else {
                    stressMsg += ' - irrigation recommended within 24-48 hours.';
                }
                shortTerm.push(stressMsg);
            }
            
            // Leaching requirement from water quality
            if (data.irrigation.leachingRequirement && data.irrigation.leachingRequirement.fraction > 10) {
                shortTerm.push('Leaching required: Apply ' + data.irrigation.leachingRequirement.fraction + '% additional water per irrigation event to flush salts. ' + data.irrigation.leachingRequirement.reason);
            }
        }
        
        // Sensor-based irrigation (TDR zones)
        if (data.sensor && data.sensor.hasData && data.sensor.zones) {
            var criticalZones = data.sensor.zones.filter(function(z) {
                return z.irrigation && (z.irrigation.status === 'critical' || z.irrigation.mmRequired > 10);
            });
            if (criticalZones.length > 0) {
                var zoneNames = criticalZones.map(function(z) { return z.name; }).join(', ');
                var totalMm = criticalZones.reduce(function(sum, z) { return sum + (z.irrigation.mmRequired || 0); }, 0);
                immediate.push('Sensor data indicates critical moisture deficit in ' + criticalZones.length + ' zone(s): ' + zoneNames + '. Total irrigation required: ' + totalMm.toFixed(1) + 'mm.');
            }
        }
        
        var hasActions = immediate.length > 0 || shortTerm.length > 0 || mediumTerm.length > 0;
        
        return {
            hasActions: hasActions,
            immediate: immediate,
            shortTerm: shortTerm,
            mediumTerm: mediumTerm,
            effectiveSpecies: effectiveSpecies,
            isC3: isC3Effective
        };
    }
    
    /**
     * Generate Cation Balance Analysis
     * Calculates Ca:Mg, K:Mg ratios and base saturation
     */
    function generateCationBalance(data) {
        if (!data.soil || !data.soil.Ca || !data.soil.Mg || !data.soil.CEC) {
            return null;
        }
        
        var Ca = data.soil.Ca;
        var Mg = data.soil.Mg;
        var K = data.soil.K || 0;
        var Na = data.soil.Na || 0;
        var CEC = data.soil.CEC;
        
        // Convert ppm to meq/100g for base saturation
        // Ca: divide by 200, Mg: divide by 121.5, K: divide by 391, Na: divide by 230
        var Ca_meq = Ca / 200;
        var Mg_meq = Mg / 121.5;
        var K_meq = K / 391;
        var Na_meq = Na / 230;
        
        // Base saturation percentages
        var Ca_sat = (Ca_meq / CEC) * 100;
        var Mg_sat = (Mg_meq / CEC) * 100;
        var K_sat = (K_meq / CEC) * 100;
        var Na_sat = (Na_meq / CEC) * 100;
        var totalBaseSat = Ca_sat + Mg_sat + K_sat + Na_sat;
        
        // Ratios
        var CaMg = Ca / Mg;
        var KMg = (K / 39.1) / (Mg / 12.15);  // Convert to meq ratio
        
        // Status assessments
        var issues = [];
        var recommendations = [];
        
        // b35fix440 / C51: Ca:Mg ratio assessment grounded in independent Mg
        // measurement, not BCSR ratio targeting. Pre-fix this branch emitted
        // a "Ca-limits-Mg-availability" claim on Ca:Mg > 10 alone with a
        // recommendation to apply Mg sources, a BCSR-derived rule that Kopittke & Menzies (2007) SSSAJ 71:259-265 reviewed and
        // found unsupported by yield data. Same evidence chain as the
        // b35fix439 OQ-Mulder closure and the C49 BCSR rollback. The Mg < 50
        // ppm gate is a conservative Mehlich-3 sufficiency-floor proxy
        // (Woods, Stowell & Soldat 2014, MLSN); when Mg sits above the
        // floor, ratio alone is not a deficit signal regardless of how high
        // Ca:Mg climbs. The amendment recommendation is suppressed in that
        // case and the issue text instead notes that the ratio is high but
        // Mg is adequate by sufficiency interpretation.
        var isMgLow_b35fix440 = Mg < 50;
        var CaMgStatus = 'Optimal';
        if (CaMg < 3) {
            CaMgStatus = 'Low';
            issues.push('Ca:Mg ratio (' + CaMg.toFixed(1) + ':1) is below optimal. Magnesium may be antagonising calcium uptake.');
            recommendations.push('Apply gypsum or calcium nitrate to improve Ca:Mg balance.');
        } else if (CaMg > 10 && isMgLow_b35fix440) {
            CaMgStatus = 'High';
            issues.push('Ca:Mg ratio (' + CaMg.toFixed(1) + ':1) is elevated and Mg sits below the sufficiency floor. Address the Mg shortfall directly.');
            recommendations.push('Apply magnesium source: dolomite at 1-2 t/ha if pH < 6.0 (raises pH and supplies Mg + Ca), or kieserite at 200-400 kg/ha Mg if pH adequate.');
        } else if (CaMg > 10) {
            CaMgStatus = 'Optimal';
            issues.push('Ca:Mg ratio (' + CaMg.toFixed(1) + ':1) is elevated but Mg is above the sufficiency floor. Ratio alone is not a deficit signal (Kopittke & Menzies 2007); no Mg amendment indicated on this evidence.');
        }
        
        // ────────────────────────────────────────────────────────────────
        // b35fix441 / C52: K:Mg ratio gated on independent K-low evidence
        // ────────────────────────────────────────────────────────────────
        // Pre-fix the K:Mg branch returned 'High K' on KMg > 0.7 and 'Low K'
        // on KMg < 0.15 with no reference to whether K was independently
        // above or below the sufficiency floor. Same evidentiary class as
        // C50 / C51 (the b35fix440 closure of Ca:Mg display-side BCSR
        // remnants): a ratio is diagnostic only when paired with absolute
        // sufficiency evidence; ratio alone is not a deficit signal
        // (Kopittke & Menzies 2007 SSSAJ 71:259-265). Post-fix the 'Low K'
        // branch only fires when K is independently below the threshold
        // sufficiency floor; otherwise the ratio stays Optimal because the
        // K supply is adequate. The 'High K' branch is retained because
        // K-induced Mg suppression is a documented uptake-carrier
        // antagonism (Marschner 2012 *Mineral Nutrition of Higher Plants*
        // ch. 8); but an isKLow gate is added there too because if K is
        // already below floor, the ratio reading high suggests Mg is even
        // lower in absolute terms, in which case the recommendation must
        // address the Mg shortfall not reduce K applications.
        // ────────────────────────────────────────────────────────────────
        var isKLow_b35fix441 = false;
        if (data && data.soil && data.soil.thresholds && data.soil.thresholds.K &&
            data.soil.thresholds.K.axis === 'absolute' && data.soil.thresholds.K.min != null) {
            // Both K (data.soil.K) and threshold.K.min are now in ppm post
            // b35fix441 / C46; this comparison is unit-consistent.
            isKLow_b35fix441 = (data.soil.K != null && data.soil.K < data.soil.thresholds.K.min);
        }

        var KMgStatus = 'Optimal';
        if (KMg > 0.7 && !isKLow_b35fix441) {
            KMgStatus = 'High K';
            issues.push('K:Mg ratio (' + KMg.toFixed(2) + ') indicates potential K-induced Mg deficiency.');
            recommendations.push('Reduce potassium applications and supplement with foliar magnesium.');
        } else if (KMg > 0.7 && isKLow_b35fix441) {
            // Ratio is high but K is below floor → Mg must be even lower.
            // Address the absolute Mg shortfall rather than reducing K.
            KMgStatus = 'High K';
            issues.push('K:Mg ratio (' + KMg.toFixed(2) + ') is elevated and K is below the sufficiency floor; Mg supply is the limiting axis.');
            recommendations.push('Apply magnesium source (kieserite or epsom salts) to lift Mg above sufficiency floor; recheck K:Mg after correction.');
        } else if (KMg < 0.15 && isKLow_b35fix441) {
            KMgStatus = 'Low K';
            issues.push('K:Mg ratio (' + KMg.toFixed(2) + ') is low and K is below the sufficiency floor; address K supply directly.');
            recommendations.push('Apply potassium source (potassium sulphate preferred for chloride-sensitive turf) to lift K above sufficiency floor.');
        } else if (KMg < 0.15 && !isKLow_b35fix441) {
            // Low ratio but K is adequate — Mg is high in absolute terms,
            // which is not itself a deficit signal. Ratio alone is not
            // diagnostic (Kopittke & Menzies 2007).
            KMgStatus = 'Optimal';
            issues.push('K:Mg ratio (' + KMg.toFixed(2) + ') is low but K is above the sufficiency floor; ratio alone is not a deficit signal (Kopittke & Menzies 2007). No K amendment indicated on this evidence.');
        }

        // ────────────────────────────────────────────────────────────────
        // b35fix441 / C52b: Ca-base-saturation BCSR rule retired
        // ────────────────────────────────────────────────────────────────
        // Pre-fix this block fired "Calcium base saturation (X%) is low.
        // Target is 60-70%." plus a lime/gypsum recommendation when
        // Ca_sat < 50%. The 60-70% target is BCSR — Bear et al. 1945
        // ratio-balancing dogma — which Kopittke & Menzies (2007) SSSAJ
        // 71:259-265 reviewed and found unsupported by yield data, and
        // which the b35fix439 OQ-Mulder closure plus b35fix440 C50/C51
        // already retired across mulders-interaction-checker.js and the
        // Ca:Mg display-side surfaces. Carrow, Waddington & Rieke (2001)
        // explicitly recommends sufficiency-level (SLAN/MLSN) over BCSR
        // for turf. PACE Turf developed MLSN specifically because BCSR
        // saturation targets produced over-fertilisation recommendations
        // on turf without yield response. Post-fix this branch is gone;
        // the Cation Balance Analysis section's Base Saturation block is
        // already suppressed on AA samples by b35fix438 / C49, and on
        // MLSN/SLAN samples the saturation values render as informational
        // disclosure only (no amendment recommendation, no caution copy).
        // The Na-saturation rule below is preserved because the 5%
        // threshold is a sodicity proxy (Rengasamy & Olsson 1991, ESP > 6
        // = sodic), grounded in soil-physics not BCSR.
        // ────────────────────────────────────────────────────────────────
        // (former Ca-base-saturation block intentionally removed in b35fix441)
        if (Na_sat > 5) {
            issues.push('Sodium saturation (' + Na_sat.toFixed(1) + '%) exceeds 5% threshold - sodicity risk.');
            recommendations.push('Apply gypsum and implement leaching program to reduce sodium.');
        }
        
        return {
            hasData: true,
            ratios: {
                CaMg: CaMg,
                CaMgStatus: CaMgStatus,
                KMg: KMg,
                KMgStatus: KMgStatus
            },
            baseSaturation: {
                Ca: Ca_sat,
                Mg: Mg_sat,
                K: K_sat,
                Na: Na_sat,
                total: totalBaseSat
            },
            issues: issues,
            recommendations: recommendations
        };
    }
    
    /**
     * Generate Soil × Water Interaction Analysis
     * Projects long-term impacts of irrigation water on soil chemistry
     * Species-aware: uses effective species tolerances for overseed scenarios
     */
    function generateSoilWaterInteractions(data) {
        if (!data.water || !data.soil) {
            return null;
        }
        
        // Require actual water test results — not just an empty water object
        if (!(data.water.EC > 0) && !(data.water.SAR > 0)) {
            return null;
        }
        
        var interactions = [];
        var projections = [];
        var recommendations = [];
        
        // Determine effective species for tolerance thresholds
        var isC3Effective = data.turf && (data.turf.overseedDominant || data.soil.isC3Species);
        var effectiveSpecies = isC3Effective ? 
            (data.turf.coolOverseed || data.turf.effectiveSpecies || 'cool-season overseed') :
            (data.turf.warmBase || data.turf.species || 'warm-season grass');
        var c3Cover = data.turf && data.turf.c3Fraction ? Math.round(data.turf.c3Fraction * 100) : null;
        
        // Species-specific tolerance thresholds
        // C3 grasses (PRG, bentgrass, fescue) are significantly more salt-sensitive
        var tolerances = isC3Effective ? {
            ecThreshold: 3.0,        // dS/m - 50% yield reduction threshold
            ecOptimal: 1.5,          // dS/m - no yield reduction
            clFoliar: 250,           // ppm - foliar damage threshold
            clRoot: 350,             // ppm - root zone concern
            sarCritical: 6,
            sarWarning: 4,
            speciesLabel: effectiveSpecies
        } : {
            ecThreshold: 6.9,        // dS/m - bermuda 50% threshold
            ecOptimal: 3.0,          // dS/m - bermuda no reduction
            clFoliar: 500,           // ppm - C4 more tolerant
            clRoot: 700,
            sarCritical: 9,
            sarWarning: 6,
            speciesLabel: effectiveSpecies
        };
        
        var EC = data.water.EC || 0;
        var SAR = data.water.SAR || 0;
        var Na_water = data.water.Na || 0;
        var HCO3 = data.water.HCO3 || 0;
        var Cl = data.water.Cl || 0;
        
        var Ca_soil = data.soil.Ca || 0;
        var Mg_soil = data.soil.Mg || 0;
        var CEC = data.soil.CEC || 10;
        
        // Add species context note if overseed
        if (c3Cover && c3Cover >= 50) {
            interactions.push({
                type: 'info',
                title: 'Species Context',
                text: 'With ' + c3Cover + '% ' + effectiveSpecies + ' cover, all salinity thresholds are based on cool-season grass tolerances, which are significantly more stringent than warm-season grasses. This analysis reflects the limiting factor for turf performance.'
            });
        }
        
        // SAR impact on soil structure - species aware
        if (SAR > tolerances.sarWarning && EC < 1.5) {
            interactions.push({
                type: 'critical',
                title: 'Sodicity Risk (High SAR, Low EC)',
                text: 'The combination of elevated SAR (' + (typeof SAR === 'number' ? SAR.toFixed(1) : SAR) + ') with relatively low EC (' + EC.toFixed(1) + ' dS/m) creates conditions favourable for soil dispersion. For ' + tolerances.speciesLabel + ', SAR should remain below ' + tolerances.sarWarning + ' to avoid sodium stress.'
            });
            projections.push('Without intervention, expect reduced infiltration rates within 6-12 months and ' + tolerances.speciesLabel + ' decline.');
            recommendations.push('Apply gypsum at 2-4 t/ha annually. Monitor infiltration rates monthly.');
        } else if (SAR > tolerances.sarCritical) {
            interactions.push({
                type: 'critical',
                title: 'Critical Sodium Hazard',
                text: 'SAR of ' + (typeof SAR === 'number' ? SAR.toFixed(1) : SAR) + ' exceeds the critical threshold (' + tolerances.sarCritical + ') for ' + tolerances.speciesLabel + '. Sodium toxicity and soil structure degradation are likely.'
            });
            projections.push('Sodium saturation will increase by approximately ' + (Na_water * 1.0 / 230 / CEC * 100).toFixed(1) + '% per 1000mm irrigation.');
            recommendations.push('URGENT: Apply gypsum at 3-4 t/ha immediately. Consider alternative water source or blending.');
        } else if (SAR > tolerances.sarWarning) {
            interactions.push({
                type: 'warning',
                title: 'Sodium Accumulation',
                text: 'With SAR of ' + (typeof SAR === 'number' ? SAR.toFixed(1) : SAR) + ' (threshold for ' + tolerances.speciesLabel + ': ' + tolerances.sarWarning + '), continuous irrigation will progressively increase exchangeable sodium. Each 100mm of irrigation adds approximately ' + (Na_water * 0.1 / 230 / CEC * 100).toFixed(2) + '% to sodium saturation.'
            });
            projections.push('Sodium saturation will increase by approximately ' + (Na_water * 1.0 / 230 / CEC * 100).toFixed(1) + '% per 1000mm irrigation.');
            recommendations.push('Apply gypsum at 1-2 t/ha per 500mm irrigation to offset sodium loading.');
        }
        
        // Bicarbonate impacts
        if (HCO3 > 120) {
            var CaCO3_precipitated = HCO3 * 0.8;  // Approximate Ca removed as CaCO3
            interactions.push({
                type: 'warning',
                title: 'Calcium Carbonate Precipitation',
                text: 'Bicarbonate content (' + HCO3 + ' ppm) will precipitate calcium from both the irrigation water and soil solution. This reduces plant-available calcium and can lead to localised high pH zones around roots.'
            });
            projections.push('Each 100mm irrigation removes approximately ' + (CaCO3_precipitated * 0.1).toFixed(0) + ' ppm Ca equivalent through precipitation.');
            
            if (Ca_soil < 500) {
                projections.push('Given current soil Ca (' + Ca_soil + ' ppm), deficiency symptoms may appear within 12-18 months without supplementation.');
            }
            recommendations.push('Apply gypsum annually (1-2 t/ha) to replace precipitated calcium. Consider acidification to pH 6.5-7.0.');
        }
        
        // Chloride accumulation - SPECIES AWARE
        if (Cl > tolerances.clFoliar) {
            var severity = Cl > tolerances.clRoot ? 'critical' : 'warning';
            var equilibriumCl = Math.round(Cl / 0.15);
            interactions.push({
                type: severity,
                title: 'Chloride Toxicity Risk',
                text: 'Chloride (' + Cl + ' ppm) exceeds the foliar damage threshold for ' + tolerances.speciesLabel + ' (' + tolerances.clFoliar + ' ppm). With a 15% leaching fraction, equilibrium soil solution Cl will reach approximately ' + equilibriumCl + ' ppm.'
            });
            
            if (Cl > tolerances.clRoot) {
                projections.push('CRITICAL: Cl levels will cause direct root damage to ' + tolerances.speciesLabel + '. Expect thinning and reduced vigour.');
            } else {
                projections.push('Foliar Cl uptake during irrigation will cause leaf tip burn, especially in hot/dry conditions.');
            }
            
            var requiredLF = Math.min(0.35, Cl / (tolerances.clFoliar * 5));
            recommendations.push('Maintain minimum ' + Math.round(requiredLF * 100) + '% leaching fraction. Irrigate during cooler periods to reduce foliar uptake.');
        }
        
        // EC and nutrient uptake - SPECIES AWARE
        if (EC > tolerances.ecOptimal) {
            // Calculate yield reduction based on species-specific thresholds
            // Linear model: 0% at ecOptimal, ~50% at ecThreshold
            var slope = 50 / (tolerances.ecThreshold - tolerances.ecOptimal);
            var yieldReduction = Math.min(90, Math.max(0, (EC - tolerances.ecOptimal) * slope));
            
            var severity = EC > tolerances.ecThreshold ? 'critical' : 'warning';
            interactions.push({
                type: severity,
                title: 'Osmotic Stress Impact (' + tolerances.speciesLabel + ')',
                text: 'Water EC of ' + EC.toFixed(1) + ' dS/m ' + (EC > tolerances.ecThreshold ? 'exceeds' : 'approaches') + ' the ' + tolerances.speciesLabel + ' stress threshold (' + tolerances.ecThreshold + ' dS/m). Estimated growth reduction: ' + yieldReduction.toFixed(0) + '%. The plant must expend energy on osmotic adjustment rather than growth.'
            });
            
            if (EC > tolerances.ecThreshold) {
                projections.push('At current EC, expect ' + yieldReduction.toFixed(0) + '% reduction in ' + tolerances.speciesLabel + ' growth and vigour.');
                recommendations.push('PRIORITY: Reduce water EC through blending or alternative source. Current levels will cause progressive ' + tolerances.speciesLabel + ' decline.');
            }
            recommendations.push('Increase fertiliser rates by ' + Math.round(yieldReduction * 0.5) + '% to compensate for reduced uptake efficiency.');
        }
        
        // Leaching requirement calculation - SPECIES AWARE
        if (EC > 0.5) {
            var LR = EC / (5 * tolerances.ecThreshold - EC);
            LR = Math.max(0.05, Math.min(0.4, LR));
            
            interactions.push({
                type: 'info',
                title: 'Leaching Requirement (' + tolerances.speciesLabel + ')',
                text: 'To maintain rootzone salinity below the ' + tolerances.speciesLabel + ' threshold (' + tolerances.ecThreshold + ' dS/m), a leaching fraction of ' + Math.round(LR * 100) + '% is required. This is calculated using the species-specific salinity tolerance.'
            });
            recommendations.push('Apply ' + Math.round(LR * 100) + '% additional water beyond ET requirements for salt leaching.');
        }
        
        var hasInteractions = interactions.length > 0;
        
        return {
            hasData: hasInteractions,
            interactions: interactions,
            projections: projections,
            recommendations: recommendations,
            effectiveSpecies: effectiveSpecies,
            tolerances: tolerances
        };
    }
    
    // Create key-value table row
    function createKeyValueRow(key, value, valueColor) {
        var border = { style: BorderStyle.SINGLE, size: 1, color: 'E5E7EB' };
        var borders = { top: border, bottom: border, left: border, right: border };
        return new TableRow({
            cantSplit: true,  // Prevent row from breaking across pages
            children: [
                new TableCell({
                    borders: borders,
                    width: { size: 3500, type: WidthType.DXA },
                    shading: { fill: 'F9FAFB', type: ShadingType.CLEAR },
                    children: [new Paragraph({ children: [new TextRun({ text: key, bold: true, size: 22 })] })]
                }),
                new TableCell({
                    borders: borders,
                    width: { size: 5860, type: WidthType.DXA },
                    children: [new Paragraph({ children: [new TextRun({ text: String(value || '--'), size: 22, color: valueColor || '374151' })] })]
                })
            ]
        });
    }
    
    // Create table from rows
    function createTable(rows) {
        return new Table({
            width: { size: 9360, type: WidthType.DXA },
            columnWidths: [3500, 5860],
            rows: rows
        });
    }
    
    // Create section heading that stays with following content
    function createSectionHeading(text, level) {
        return new Paragraph({ 
            heading: level || HeadingLevel.HEADING_1,
            keepNext: true,  // Keep heading with next paragraph/table
            children: [new TextRun(text)] 
        });
    }
    
    // Create narrative paragraph (for interpretation text)
    function createNarrativeParagraph(text) {
        return new Paragraph({
            spacing: { after: 120 },
            children: [new TextRun({ text: text, size: 22, color: '4B5563' })]
        });
    }
    
    // Create interpretation section with heading
    function createInterpretationSection(title, narrativeData) {
        var elements = [];
        
        if (!narrativeData) return elements;
        
        // Subheading
        elements.push(new Paragraph({
            spacing: { before: 200, after: 100 },
            children: [new TextRun({ text: title, bold: true, size: 22, color: '1F2937' })]
        }));
        
        // Narrative paragraphs
        if (narrativeData.narrative && narrativeData.narrative.length > 0) {
            narrativeData.narrative.forEach(function(text) {
                elements.push(createNarrativeParagraph(text));
            });
        }
        
        // Recommendations with bullet styling
        if (narrativeData.recommendations && narrativeData.recommendations.length > 0) {
            elements.push(new Paragraph({
                spacing: { before: 150, after: 80 },
                children: [new TextRun({ text: 'Recommendations:', bold: true, size: 22, color: '1F2937' })]
            }));
            
            narrativeData.recommendations.forEach(function(rec) {
                elements.push(new Paragraph({
                    spacing: { after: 80 },
                    indent: { left: 360 },
                    children: [
                        new TextRun({ text: '• ', size: 22, color: '16A34A' }),
                        new TextRun({ text: rec, size: 22, color: '374151' })
                    ]
                }));
            });
        }
        
        return elements;
    }
    
    /**
     * Generate Glossary of Terms
     * Comprehensive glossary for export appendix
     */
    function generateGlossary() {
        var elements = [];
        
        var terms = [
            { term: 'Bicarbonate (HCO₃)', definition: 'A naturally occurring ion in water that affects calcium availability. High bicarbonate causes calcium to precipitate as lime in the soil, reducing its ability to counteract sodium. Measured in mg/L or meq/L.' },
            { term: 'Cation Exchange Capacity (CEC)', definition: 'A measure of the soil\'s ability to hold and release positively charged nutrients (cations) such as calcium, magnesium, potassium, and sodium. Expressed in meq/100g or cmol/kg. Higher CEC soils retain nutrients better but may also hold sodium more tightly.' },
            { term: 'Ammonium Acetate Extraction', definition: 'A soil testing method using neutral ammonium acetate (NH₄OAc at pH 7 or pH 8.1) to extract exchangeable cations (K, Ca, Mg, Na). Combined with Olsen phosphorus extraction, this is the standard method used by Hill Laboratories in New Zealand. The pH 8.1 variant is particularly suited to soils with higher pH. Sufficiency ranges differ from Mehlich III extractions used for MLSN/SLAN.' },
            { term: 'Deficient', definition: 'Nutrient level below the threshold required for healthy plant function. Deficiency typically produces visible symptoms and reduced turf performance.' },
            { term: 'Electrical Conductivity (EC)', definition: 'A measure of total dissolved salts in water or soil solution. Higher EC indicates higher salinity. Measured in dS/m (deciSiemens per metre) or mS/cm. Turf irrigation water should generally be below 1.5 dS/m.' },
            { term: 'Exchangeable Sodium Percentage (ESP)', definition: 'The proportion of the soil\'s cation exchange sites occupied by sodium, expressed as a percentage. ESP above 6% indicates sodic conditions that may impair soil structure and drainage.' },
            { term: 'Foliar Application', definition: 'Fertiliser applied as a liquid spray directly to leaf surfaces, where nutrients are absorbed through the cuticle and stomata. Useful for rapid correction of deficiencies or when soil chemistry limits root uptake.' },
            { term: 'Granular Application', definition: 'Fertiliser applied as dry particles to the soil surface, where nutrients dissolve and move into the root zone. Provides slower, longer-lasting nutrition than foliar methods.' },
            { term: 'Gypsum', definition: 'Calcium sulphate (CaSO₄), applied to sodic soils to displace sodium and improve structure. Also supplies calcium and sulphur as nutrients.' },
            { term: 'Leaching', definition: 'The movement of water through the soil profile, carrying dissolved substances downward. Deliberate leaching irrigation is used to flush accumulated salts below the root zone.' },
            { term: 'Macronutrient', definition: 'Nutrients required by plants in relatively large quantities: nitrogen (N), phosphorus (P), potassium (K), calcium (Ca), magnesium (Mg), and sulphur (S).' },
            { term: 'meq/L', definition: 'Milliequivalents per litre, a unit expressing ion concentration that accounts for electrical charge. Used in water quality analysis and SAR calculations.' },
            { term: 'MLSN (Minimum Level for Sustainable Nutrition)', definition: 'A soil nutrient interpretation method developed specifically for turfgrass by the Asian Turfgrass Center. MLSN establishes minimum threshold values based on analysis of soil samples from high-performing turf worldwide. Nutrient levels above the minimum are considered sustainable; no upper "excess" limits are defined for most nutrients. MLSN typically results in lower fertiliser inputs compared to traditional methods.' },
            { term: 'Muriate of Potash', definition: 'Potassium chloride (KCl), a potassium fertiliser. The chloride content makes it less suitable where salt accumulation is a concern.' },
            { term: 'Olsen Phosphorus', definition: 'A soil phosphorus extraction method using sodium bicarbonate (NaHCO₃) at pH 8.5. Developed for calcareous soils but widely used in New Zealand and Australia. Results are typically reported in mg/L. Olsen P extracts less phosphorus than Mehlich III, so sufficiency ranges are lower. A typical adequate range for turf is 12-28 mg/L.' },
            { term: 'Potassium Sulphate', definition: 'K₂SO₄, a potassium fertiliser without chloride, preferred where salt accumulation is a concern or for chloride-sensitive turf.' },
            { term: 'ppm (Parts Per Million)', definition: 'A unit of concentration equivalent to mg/kg for solids or mg/L for liquids. Used to express nutrient concentrations in soil and water tests.' },
            { term: 'SAR (Sodium Adsorption Ratio)', definition: 'A calculated value that predicts the risk of sodium accumulating in soil and degrading structure. SAR compares sodium concentration to calcium and magnesium concentrations in irrigation water. Values below 6 are generally safe; values above 9 pose significant risk.' },
            { term: 'SARadj (Adjusted SAR)', definition: 'A modified SAR calculation that accounts for the effect of bicarbonates on calcium availability. When bicarbonate levels are high, calcium precipitates as lime in the soil, leaving less calcium to counteract sodium. SARadj provides a more accurate assessment of sodium hazard in high-bicarbonate waters.' },
            { term: 'SLAN (Sufficiency Level of Available Nutrients)', definition: 'A traditional soil nutrient interpretation method derived from agricultural crop research. SLAN defines an optimal sufficiency range for each nutrient. Values below the range are deficient; values above may indicate excessive accumulation. SLAN typically recommends higher nutrient levels than MLSN.' },
            { term: 'Sodicity', definition: 'A soil condition caused by excessive sodium accumulation. Sodic soils have poor structure, reduced infiltration, and impaired drainage. Identified by ESP above 6% or SAR above 6 in soil solution.' },
            { term: 'Soil Structure', definition: 'The arrangement of soil particles into aggregates. Good structure creates pore spaces for air and water movement. Sodium disrupts structure by dispersing clay particles, causing compaction and sealing.' },
            { term: 'Sufficiency Range', definition: 'The range of nutrient concentrations considered adequate for healthy plant growth under the SLAN interpretation method. Values below the range require amendment; values above may indicate luxury consumption or potential toxicity.' },
            { term: 'Tissue Testing', definition: 'Laboratory analysis of plant material (typically leaf clippings) to determine nutrient concentrations within the plant. Tissue testing reveals what the plant has actually taken up, complementing soil testing which shows what is available.' },
            { term: 'Trace Element', definition: 'Nutrients required by plants in small quantities but essential for healthy function: iron (Fe), manganese (Mn), zinc (Zn), copper (Cu), boron (B), molybdenum (Mo), and chlorine (Cl).' }
        ];
        
        // Page break before glossary
        elements.push(new Paragraph({ children: [new PageBreak()] }));
        
        elements.push(new Paragraph({ 
            heading: HeadingLevel.HEADING_1, 
            keepNext: true,
            children: [new TextRun('Glossary of Terms')] 
        }));
        
        elements.push(new Paragraph({
            spacing: { before: 100, after: 200 },
            children: [new TextRun({ 
                text: 'Reference definitions for technical terms used in this report.',
                size: 20, italics: true, color: '6B7280'
            })]
        }));
        
        terms.forEach(function(item) {
            elements.push(new Paragraph({
                spacing: { before: 120, after: 40 },
                children: [new TextRun({ text: item.term, bold: true, size: 22, color: '1F2937' })]
            }));
            elements.push(new Paragraph({
                spacing: { after: 80 },
                indent: { left: 200 },
                children: [new TextRun({ text: item.definition, size: 20, color: '4B5563' })]
            }));
        });
        
        return elements;
    }
    
    /**
     * Generate dual MLSN/SLAN comparison table for soil nutrients
     * Shows both interpretations side by side
     */
    function generateDualSoilTable(soilData) {
        if (!soilData) return null;
        
        var border = { style: BorderStyle.SINGLE, size: 1, color: 'E5E7EB' };
        var borders = { top: border, bottom: border, left: border, right: border };
        
        // MLSN guidelines (minimum thresholds)
        var mlsnThresholds = {
            P: { min: 21 },
            K: { min: 37 },
            Ca: { min: 331 },
            Mg: { min: 47 },
            S: { min: 7 }
        };
        
        // SLAN ranges (min-max sufficiency)
        // b35fix333a: route through GilbaClassificationConstants.SLAN_RANGES SSOT.
        // Pre-b35fix333a this was hardcoded at K=75-150, Ca=500-1000, Mg=60-120,
        // S=15-30 — values that didn't match either the (post-b35fix333) Carrow
        // 2004 GCM ranges in the constants module OR any single published source.
        // The Mg 60-120 here happened to be sand-soil Carrow 2004; the K 75-150
        // was the pre-b35fix333 fabricated range. b35fix333 corrected the SSOT
        // module to Carrow 2004 "other soils" / high-CEC values but missed this
        // inline table — clients saw "75-150" in the SLAN Range column despite
        // the K-Reconciliation table caption reading "75-176" on the same export.
        // Fallback below is the Carrow 2004 "other soils" set, matching SSOT.
        //
        // b35fix427 (C33): pH-adjust the P floor here to match the b35fix426 /
        // C32 fix to the Annual Soil Amendments threshold builder. Pre-fix
        // this renderer used the static `_gccSlan.P.floor = 27` while the
        // amendments-table renderer used the pH-adjusted floor (51 at pH > 8.0
        // via `getSlanTargetP`). Same site, two SLAN range values surfaced in
        // the same export — internal inconsistency that surfaced during b35fix426
        // Rockingham 16th green production verification. Same SSOT call here
        // closes the second instance of this asymmetric-engines bug.
        // Lesson #13 from sprint summary applied: when fixing an asymmetric-
        // engines bug, grep for ALL consumers of the source-of-truth value,
        // not just the one that surfaced the bug. The C32 fix found the
        // amendments-table consumer; b35fix426 production verification found
        // the Dual Interpretation table consumer; this fix closes it.
        var _gccSlan = (typeof window !== 'undefined' &&
                        window.GilbaClassificationConstants &&
                        window.GilbaClassificationConstants.SLAN_RANGES) || null;
        var slanRanges;
        if (_gccSlan) {
            slanRanges = {
                P:  { min: _gccSlan.P.floor,  max: _gccSlan.P.ceiling  },
                K:  { min: _gccSlan.K.floor,  max: _gccSlan.K.ceiling  },
                Ca: { min: _gccSlan.Ca.floor, max: _gccSlan.Ca.ceiling },
                Mg: { min: _gccSlan.Mg.floor, max: _gccSlan.Mg.ceiling },
                S:  { min: _gccSlan.S.floor,  max: _gccSlan.S.ceiling  }
            };
        } else {
            slanRanges = {
                P:  { min: 27,  max: 54  },
                K:  { min: 75,  max: 176 },
                Ca: { min: 500, max: 750 },
                Mg: { min: 70,  max: 140 },
                S:  { min: 15,  max: 40  }
            };
        }
        // pH-adjust the P floor via the public SSOT API. Defensive — if the
        // requirements engine isn't loaded or pH isn't available, the static
        // floor (already populated above) is preserved.
        var _pHForDual = (soilData && (soilData.pH || soilData.pH_water)) || null;
        if (typeof window !== 'undefined' &&
                window.NutritionRequirementEngine_Pure &&
                typeof window.NutritionRequirementEngine_Pure._getSlanTargetP === 'function' &&
                _pHForDual != null && !isNaN(_pHForDual)) {
            slanRanges.P.min = window.NutritionRequirementEngine_Pure._getSlanTargetP(parseFloat(_pHForDual));
        }
        
        var nutrients = [
            { key: 'P', name: 'Phosphorus (P)' },
            { key: 'K', name: 'Potassium (K)' },
            { key: 'Ca', name: 'Calcium (Ca)' },
            { key: 'Mg', name: 'Magnesium (Mg)' },
            { key: 'S', name: 'Sulphur (S)' }
        ];
        
        // Header row
        var headerRow = new TableRow({
            tableHeader: true,
            children: [
                new TableCell({
                    borders: borders,
                    width: { size: 2000, type: WidthType.DXA },
                    shading: { fill: 'F3F4F6', type: ShadingType.CLEAR },
                    children: [new Paragraph({ children: [new TextRun({ text: 'Nutrient', bold: true, size: 20 })] })]
                }),
                new TableCell({
                    borders: borders,
                    width: { size: 1400, type: WidthType.DXA },
                    shading: { fill: 'F3F4F6', type: ShadingType.CLEAR },
                    children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'Measured', bold: true, size: 20 })] })]
                }),
                new TableCell({
                    borders: borders,
                    width: { size: 1400, type: WidthType.DXA },
                    shading: { fill: 'EFF6FF', type: ShadingType.CLEAR },
                    children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'MLSN Min', bold: true, size: 20, color: '1E40AF' })] })]
                }),
                new TableCell({
                    borders: borders,
                    width: { size: 1400, type: WidthType.DXA },
                    shading: { fill: 'EFF6FF', type: ShadingType.CLEAR },
                    children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'MLSN Status', bold: true, size: 20, color: '1E40AF' })] })]
                }),
                new TableCell({
                    borders: borders,
                    width: { size: 1600, type: WidthType.DXA },
                    shading: { fill: 'FEF3C7', type: ShadingType.CLEAR },
                    children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'SLAN Range', bold: true, size: 20, color: '92400E' })] })]
                }),
                new TableCell({
                    borders: borders,
                    width: { size: 1400, type: WidthType.DXA },
                    shading: { fill: 'FEF3C7', type: ShadingType.CLEAR },
                    children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'SLAN Status', bold: true, size: 20, color: '92400E' })] })]
                })
            ]
        });
        
        var rows = [headerRow];
        
        nutrients.forEach(function(n) {
            var value = soilData[n.key];
            if (value === undefined || value === null) return;
            
            var mlsn = mlsnThresholds[n.key];
            var slan = slanRanges[n.key];
            
            // MLSN status
            var mlsnStatus, mlsnColor;
            if (value >= mlsn.min) {
                mlsnStatus = 'Sufficient';
                mlsnColor = '16A34A';
            } else if (value >= mlsn.min * 0.8) {
                mlsnStatus = 'Marginal';
                mlsnColor = 'F59E0B';
            } else {
                mlsnStatus = 'Deficient';
                mlsnColor = 'DC2626';
            }
            
            // SLAN status
            var slanStatus, slanColor;
            if (value < slan.min) {
                slanStatus = 'Deficient';
                slanColor = 'DC2626';
            } else if (value > slan.max) {
                slanStatus = 'High';
                slanColor = 'F59E0B';
            } else {
                slanStatus = 'Sufficient';
                slanColor = '16A34A';
            }
            
            rows.push(new TableRow({
                children: [
                    new TableCell({
                        borders: borders,
                        width: { size: 2000, type: WidthType.DXA },
                        children: [new Paragraph({ children: [new TextRun({ text: n.name, size: 20 })] })]
                    }),
                    new TableCell({
                        borders: borders,
                        width: { size: 1400, type: WidthType.DXA },
                        children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: value + ' ppm', size: 20, bold: true })] })]
                    }),
                    new TableCell({
                        borders: borders,
                        width: { size: 1400, type: WidthType.DXA },
                        shading: { fill: 'F8FAFC', type: ShadingType.CLEAR },
                        children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: '>' + mlsn.min, size: 20, color: '64748B' })] })]
                    }),
                    new TableCell({
                        borders: borders,
                        width: { size: 1400, type: WidthType.DXA },
                        children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: mlsnStatus, size: 20, bold: true, color: mlsnColor })] })]
                    }),
                    new TableCell({
                        borders: borders,
                        width: { size: 1600, type: WidthType.DXA },
                        shading: { fill: 'FFFBEB', type: ShadingType.CLEAR },
                        children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: slan.min + '-' + slan.max, size: 20, color: '78716C' })] })]
                    }),
                    new TableCell({
                        borders: borders,
                        width: { size: 1400, type: WidthType.DXA },
                        children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: slanStatus, size: 20, bold: true, color: slanColor })] })]
                    })
                ]
            }));
        });
        
        return new Table({
            width: { size: 9200, type: WidthType.DXA },
            columnWidths: [2000, 1400, 1400, 1400, 1600, 1400],
            rows: rows
        });
    }
    
    /**
     * Generate pH and CEC context section
     * Explains what pH and CEC values mean for nutrient availability
     */
    function generatepHCECContext(soilData, turfData) {
        if (!soilData) return null;
        
        var elements = [];
        var narrative = [];
        var recommendations = [];
        
        // v2.1.8: Use species-specific pH tolerance from SPECIES_PH_TOLERANCE if available
        var speciesName = turfData ? (turfData.effectiveSpecies || turfData.grassSpecies || turfData.species || turfData.warmBase || 'turf') : 'turf';
        var optLo, optHi, tolLo, tolHi, acidTolerant, alkalineTolerant;
        
        // Try to use the global species tolerance data
        if (typeof SPECIES_PH_TOLERANCE !== 'undefined' && typeof normaliseSpeciesForPH === 'function') {
            var speciesKey = normaliseSpeciesForPH(speciesName);
            var tolerance = SPECIES_PH_TOLERANCE[speciesKey] || SPECIES_PH_TOLERANCE['default'];
            optLo = tolerance.optimal[0];
            optHi = tolerance.optimal[1];
            tolLo = tolerance.tolerance[0];
            tolHi = tolerance.tolerance[1];
            acidTolerant = tolerance.acidTolerant;
            alkalineTolerant = tolerance.alkalineTolerant;
            speciesName = speciesKey; // Use normalised name
        } else {
            // Fallback to simple C3/C4 logic
            var isC3 = turfData && (turfData.effectiveIsC4 === false || !turfData.isC4);
            optLo = isC3 ? 6.0 : 6.5;
            optHi = isC3 ? 6.5 : 7.0;
            tolLo = isC3 ? 5.5 : 5.5;
            tolHi = isC3 ? 7.5 : 8.0;
            acidTolerant = false;
            alkalineTolerant = !isC3;
        }
        
        var optRangeStr = optLo + '–' + optHi;
        var tolRangeStr = tolLo + '–' + tolHi;
        
        // pH interpretation
        if (soilData.pH !== undefined) {
            var pH = soilData.pH;
            
            elements.push(new Paragraph({
                spacing: { before: 150, after: 50 },
                children: [new TextRun({ text: 'Soil pH: ' + pH, bold: true, size: 22 })]
            }));
            
            // Add species tolerance context
            elements.push(new Paragraph({
                spacing: { after: 80 },
                indent: { left: 200 },
                children: [
                    new TextRun({ text: speciesName + ' pH requirements: ', bold: true, size: 20, color: '374151' }),
                    new TextRun({ text: 'Optimal ' + optRangeStr + ' | Tolerance ' + tolRangeStr, size: 20, color: '6B7280' }),
                    acidTolerant ? new TextRun({ text: ' | Acid-tolerant', size: 18, color: '059669' }) : new TextRun({ text: '' }),
                    alkalineTolerant ? new TextRun({ text: ' | Alkaline-tolerant', size: 18, color: '059669' }) : new TextRun({ text: '' })
                ]
            }));
            
            if (pH < tolLo) {
                // Below tolerance range
                var dolomiticCorrection2 = soilData && soilData.pH < 6.0 &&
                    soilData.Mg && soilData.thresholds && soilData.thresholds.Mg &&
                    soilData.Mg < soilData.thresholds.Mg.min &&
                    ((soilData.Ca && soilData.thresholds.Ca && soilData.Ca < soilData.thresholds.Ca.min) || soilData.pH < 5.5);
                if (dolomiticCorrection2) {
                    // Merge toxic-metals warning with dolomite correction into one sentence — avoids duplication
                    narrative.push('Soil pH (' + pH + ') is below the tolerance range for ' + speciesName + ' (' + tolRangeStr + '). At this level, aluminium and manganese can become toxic to roots and phosphorus availability is severely restricted. Dolomite application (see Soil Nutrition recommendations) will correct pH while addressing Mg and Ca deficits simultaneously, retest in 6 months.');
                } else {
                    narrative.push('Soil pH (' + pH + ') is below the tolerance range for ' + speciesName + ' (' + tolRangeStr + '). At this level, aluminium and manganese can become toxic to roots, while phosphorus availability is severely restricted. This species will experience significant stress.');
                    recommendations.push('URGENT: Apply agricultural lime to raise pH toward ' + optLo + '. Retest in 6 months to assess response.');
                }
            } else if (pH < optLo) {
                // Below optimal but within tolerance
                narrative.push('Soil pH (' + pH + ') is below the optimal range (' + optRangeStr + ') for ' + speciesName + ', but within tolerance (' + tolRangeStr + '). Phosphorus and molybdenum availability may be reduced.');
                if (acidTolerant) {
                    narrative.push(speciesName + ' has good acid tolerance, monitoring is sufficient unless deficiency symptoms appear.');
                } else {
                    recommendations.push('Consider lime application to raise pH toward ' + optLo + ' for optimal nutrient availability.');
                }
            } else if (pH > tolHi) {
                // Above tolerance range
                narrative.push('Soil pH (' + pH + ') exceeds the tolerance range for ' + speciesName + ' (' + tolRangeStr + '). Iron, manganese, zinc, and copper availability is severely restricted. Chlorosis and poor growth are likely.');
                if (alkalineTolerant) {
                    narrative.push('Although ' + speciesName + ' has some alkaline tolerance, this pH still exceeds safe limits.');
                }
                recommendations.push('URGENT: Apply elemental sulphur or ammonium sulphate to acidify the rootzone. Elemental sulphur should only be applied after hollow-tine aeration, worked into the holes, and timed heading into autumn, do NOT apply over the turf surface or heading into summer. Use Fe-EDDHA chelate for iron applications. Evaluate irrigation water for alkalinity contribution.');
            } else if (pH > optHi) {
                // Above optimal but within tolerance
                narrative.push('Soil pH (' + pH + ') is above the optimal range (' + optRangeStr + ') for ' + speciesName + ', but within tolerance (' + tolRangeStr + '). Monitor for iron chlorosis.');
                if (alkalineTolerant) {
                    narrative.push(speciesName + ' tolerates alkaline conditions, focus on trace element management rather than aggressive acidification.');
                    // b35fix418 (C17): stripped contradictory "Prefer ammonium-based nitrogen sources" clause.
                    // Recommending acidifying-N for an alkaline-tolerant species contradicts the
                    // "tolerates alkaline" sentence above. Chelated iron stays as it is purely a
                    // symptomatic response to chlorosis, not pH management.
                    recommendations.push('Use chelated iron (Fe-EDDHA) if chlorosis appears.');
                } else {
                    recommendations.push('Consider acidification to bring pH into the optimal range. Use ammonium sulphate for nitrogen applications.');
                }
            } else {
                // Within optimal range
                narrative.push('Soil pH (' + pH + ') is within the optimal range (' + optRangeStr + ') for ' + speciesName + '. Nutrient availability is maximised at this pH level.');
            }
        }
        
        // CEC interpretation
        if (soilData.CEC !== undefined) {
            var CEC = soilData.CEC;
            
            elements.push(new Paragraph({
                spacing: { before: 150, after: 50 },
                children: [new TextRun({ text: 'Cation Exchange Capacity: ' + CEC + ' meq/100g', bold: true, size: 22 })]
            }));
            
            if (CEC < 5) {
                narrative.push('CEC is low (' + CEC + ' meq/100g), indicating a sandy soil with limited nutrient-holding capacity. Nutrients applied will leach more readily, requiring smaller, more frequent applications. The benefit is that any sodium accumulation will also leach more easily.');
                recommendations.push('Apply fertilisers in split applications (little and often). Consider slow-release nitrogen sources.');
            } else if (CEC < 12) {
                narrative.push('CEC is moderate (' + CEC + ' meq/100g), typical of sandy loam rootzones common in sports turf and golf greens. This provides reasonable nutrient retention while maintaining good drainage.');
            } else if (CEC < 25) {
                narrative.push('CEC is moderately high (' + CEC + ' meq/100g), indicating good nutrient-holding capacity. The soil can buffer against rapid pH changes and retain applied nutrients effectively.');
            } else {
                narrative.push('CEC is high (' + CEC + ' meq/100g), typical of clay-rich or high organic matter soils. While nutrient retention is excellent, drainage may be impaired and sodium, if present, will be more difficult to leach.');
                if (soilData.Na && soilData.Na > 50) {
                    recommendations.push('High CEC combined with elevated sodium requires aggressive gypsum applications and patience - sodium displacement will be slower than in sandier soils.');
                }
            }
        }
        
        // Add narrative paragraphs
        narrative.forEach(function(text) {
            elements.push(new Paragraph({
                spacing: { after: 100 },
                indent: { left: 200 },
                children: [new TextRun({ text: text, size: 20, color: '4B5563' })]
            }));
        });
        
        // Add recommendations
        if (recommendations.length > 0) {
            recommendations.forEach(function(rec) {
                elements.push(new Paragraph({
                    spacing: { after: 80 },
                    indent: { left: 200 },
                    children: [
                        new TextRun({ text: rec, size: 20, color: '374151' })
                    ]
                }));
            });
        }
        
        return elements.length > 0 ? elements : null;
    }
    
    /**
     * Generate SAR vs SARadj explanation section
     * Explains the difference and why SARadj matters for high-bicarbonate waters
     */
    function generateSARadjExplanation(waterData) {
        if (!waterData || waterData.SAR === undefined) return null;
        
        var elements = [];
        var SAR = waterData.SAR;
        var SARadj = waterData.SARadj;
        var HCO3 = waterData.HCO3;
        
        // Only show detailed explanation if SARadj differs significantly from SAR
        var hasSARadj = SARadj !== undefined && SARadj !== null;
        var hasSignificantDifference = hasSARadj && Math.abs(SARadj - SAR) > 0.5;
        
        if (hasSignificantDifference && HCO3 && HCO3 > 120) {
            elements.push(new Paragraph({
                spacing: { before: 150, after: 100 },
                shading: { fill: 'FEF3C7', type: ShadingType.CLEAR },
                border: { left: { style: BorderStyle.SINGLE, size: 24, color: 'F59E0B' } },
                children: [new TextRun({ text: 'SAR vs SARadj, Important Distinction', bold: true, size: 22, color: '92400E' })]
            }));
            
            var explanationText = 'Standard SAR (' + SAR.toFixed(1) + ') assumes all measured calcium remains available to counteract sodium. However, your water contains elevated bicarbonate (' + HCO3 + ' mg/L), which causes calcium to precipitate as lime when the water enters the soil. ';
            explanationText += 'SARadj (' + SARadj.toFixed(1) + ') accounts for this precipitation effect and represents the effective sodium hazard after calcium loss. ';
            
            var percentIncrease = ((SARadj / SAR - 1) * 100).toFixed(0);
            explanationText += 'In your case, SARadj is ' + percentIncrease + '% higher than standard SAR.';
            
            elements.push(new Paragraph({
                spacing: { after: 100 },
                indent: { left: 200 },
                children: [new TextRun({ text: explanationText, size: 20, color: '4B5563' })]
            }));
            
            elements.push(new Paragraph({
                spacing: { after: 100 },
                indent: { left: 200 },
                children: [
                    new TextRun({ text: 'Management recommendation: ', bold: true, size: 20, color: '374151' }),
                    new TextRun({ text: 'Base your sodium management decisions on SARadj rather than standard SAR. Consider acidification to reduce bicarbonate levels and preserve calcium availability.', size: 20, color: '374151' })
                ]
            }));
        }
        
        return elements.length > 0 ? elements : null;
    }
    
    /**
     * Render Spray Log Section
     * Recent applications from the spray diary for the active site
     */
    function renderSprayLogSection(data) {
        var elements = [];
        
        if (!data.sprayLog || !data.sprayLog.hasData) {
            return elements;
        }
        
        var entries = data.sprayLog.entries || [];
        if (entries.length === 0) return elements;
        
        // Section heading
        elements.push(new Paragraph({ 
            heading: HeadingLevel.HEADING_1, 
            keepNext: true, 
            children: [new TextRun('Spray Application Log')] 
        }));
        
        elements.push(new Paragraph({
            spacing: { after: 200 },
            children: [new TextRun({ 
                text: 'Record of chemical and fertiliser applications for this site. ' + entries.length + ' entries.', 
                size: 22, 
                color: '4B5563' 
            })]
        }));
        
        // Table header
        var headerRow = new TableRow({
            tableHeader: true,
            children: [
                new TableCell({ shading: { fill: 'E5E7EB', type: ShadingType.CLEAR }, width: { size: 1200, type: WidthType.DXA }, children: [new Paragraph({ children: [new TextRun({ text: 'Date', bold: true, size: 20 })] })] }),
                new TableCell({ shading: { fill: 'E5E7EB', type: ShadingType.CLEAR }, width: { size: 2200, type: WidthType.DXA }, children: [new Paragraph({ children: [new TextRun({ text: 'Product', bold: true, size: 20 })] })] }),
                new TableCell({ shading: { fill: 'E5E7EB', type: ShadingType.CLEAR }, width: { size: 1600, type: WidthType.DXA }, children: [new Paragraph({ children: [new TextRun({ text: 'Active Ingredient', bold: true, size: 20 })] })] }),
                new TableCell({ shading: { fill: 'E5E7EB', type: ShadingType.CLEAR }, width: { size: 900, type: WidthType.DXA }, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'Rate', bold: true, size: 20 })] })] }),
                new TableCell({ shading: { fill: 'E5E7EB', type: ShadingType.CLEAR }, width: { size: 800, type: WidthType.DXA }, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'Zone', bold: true, size: 20 })] })] }),
                new TableCell({ shading: { fill: 'E5E7EB', type: ShadingType.CLEAR }, width: { size: 1000, type: WidthType.DXA }, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'Category', bold: true, size: 20 })] })] })
            ]
        });
        
        var rows = [headerRow];
        
        // Sort entries by date descending
        var sorted = entries.slice().sort(function(a, b) {
            return (b.application_date || '').localeCompare(a.application_date || '');
        });
        
        sorted.forEach(function(e) {
            var dateStr = e.application_date || '';
            if (dateStr.length >= 10) {
                // Format YYYY-MM-DD to DD/MM/YYYY
                var parts = dateStr.substring(0, 10).split('-');
                if (parts.length === 3) dateStr = parts[2] + '/' + parts[1] + '/' + parts[0];
            }
            var rateStr = (e.rate || '') + (e.rate_unit ? ' ' + e.rate_unit : '');
            
            rows.push(new TableRow({
                children: [
                    new TableCell({ width: { size: 1200, type: WidthType.DXA }, children: [new Paragraph({ children: [new TextRun({ text: dateStr, size: 19 })] })] }),
                    new TableCell({ width: { size: 2200, type: WidthType.DXA }, children: [new Paragraph({ children: [new TextRun({ text: e.product_name || '', size: 19 })] })] }),
                    new TableCell({ width: { size: 1600, type: WidthType.DXA }, children: [new Paragraph({ children: [new TextRun({ text: e.active_ingredient || '', size: 19 })] })] }),
                    new TableCell({ width: { size: 900, type: WidthType.DXA }, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: rateStr, size: 19 })] })] }),
                    new TableCell({ width: { size: 800, type: WidthType.DXA }, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: e.zone || '', size: 19 })] })] }),
                    new TableCell({ width: { size: 1000, type: WidthType.DXA }, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: e.category || '', size: 19 })] })] })
                ]
            }));
        });
        
        elements.push(new Table({ width: { size: 7700, type: WidthType.DXA }, columnWidths: [1200, 2200, 1600, 900, 800, 1000], rows: rows }));

        elements.push(new Paragraph({ children: [] }));

        return elements;
    }

    /**
     * Render Nutrition Program Section
     * Monthly product recommendations from Prebble or AU Fertiliser recommender
     * v10.3.38
     */
    function renderNutritionProgramSection(data) {
        var elements = [];
        
        if (!data.nutritionProgram || !data.nutritionProgram.hasData) {
            return elements;
        }
        
        var program = data.nutritionProgram;
        var monthly = program.monthly || [];
        var summary = program.annualSummary || {};
        
        if (monthly.length === 0) {
            return elements;
        }
        
        // Section heading
        elements.push(new Paragraph({ 
            heading: HeadingLevel.HEADING_1, 
            keepNext: true, 
            children: [new TextRun('Nutrition Program')] 
        }));
        
        // Intro text
        elements.push(new Paragraph({
            spacing: { after: 200 },
            children: [new TextRun({ 
                text: 'Monthly fertiliser recommendations based on growth potential, soil conditions, and nutrient requirements. Products are selected to match release characteristics with seasonal uptake patterns.', 
                size: 22, 
                color: '4B5563' 
            })]
        }));
        
        // b35fix287: Mulder's Nutrient Interactions section
        var muldersFlags = program.muldersFlags || {};
        var allMuldersFlags = [];
        Object.keys(muldersFlags).forEach(function(sym) {
            var arr = Array.isArray(muldersFlags[sym]) ? muldersFlags[sym] : [muldersFlags[sym]];
            arr.forEach(function(f) { if (f) allMuldersFlags.push(f); });
        });
        if (allMuldersFlags.length > 0) {
            elements.push(new Paragraph({
                spacing: { before: 200, after: 100 },
                children: [new TextRun({ text: 'Mulder\'s Nutrient Interactions', bold: true, size: 24, color: 'B45309' })]
            }));
            elements.push(new Paragraph({
                spacing: { after: 80 },
                children: [new TextRun({
                    text: 'The following antagonistic interactions were detected in the soil sample. Product selection has been adjusted to avoid aggravating these antagonisms.',
                    size: 20, color: '78350F', italics: true
                })]
            }));
            allMuldersFlags.forEach(function(f) {
                var pair = (f.suppressor || '') + ' → ' + (f.suppressed || '');
                var ratioText = f.ratio ? ' (' + f.ratio + ' = ' + (f.value || '') + ', threshold: ' + f.threshold + ')' : '';
                elements.push(new Paragraph({
                    spacing: { before: 60, after: 40 },
                    children: [new TextRun({ text: pair + ratioText, bold: true, size: 22, color: '374151' })]
                }));
                if (f.message) {
                    elements.push(new Paragraph({
                        spacing: { after: 40 },
                        indent: { left: 400 },
                        children: [new TextRun({ text: f.message, size: 20, color: '374151' })]
                    }));
                }
                if (f.citation) {
                    elements.push(new Paragraph({
                        spacing: { after: 80 },
                        indent: { left: 400 },
                        children: [new TextRun({ text: 'Ref: ' + f.citation, size: 18, color: '9CA3AF', italics: true })]
                    }));
                }
            });
        }

        // Annual Product Summary table
        // b35fix328: extended from N/K-only to N/P/K/Ca/Mg/S, with optional
        // macro columns (P, Ca, Mg, S) hidden when no product in the report
        // delivers them above the 0.05 kg/ha noise floor. N and K columns
        // are always shown (existing contract). Two-pass build: extract all
        // row vectors first via _extractEntryNutrients, detect active
        // optional columns via _detectActiveNutrientColumns, then render.
        // This makes amendment rows (dolomite, gypsum, SOP) legible — they
        // were the trigger case for this fix (b35fix323 dolomite row read
        // "Total 955 / N 0 / K 0" pre-fix).
        if (summary.products && Object.keys(summary.products).length > 0) {
            elements.push(new Paragraph({
                spacing: { before: 200, after: 100 },
                children: [new TextRun({ text: 'Annual Product Summary', bold: true, size: 24, color: '1F2937' })]
            }));

            // Pass 1: extract per-row nutrient vectors and metadata
            var productList = Object.values(summary.products);
            var rowsData = productList.map(function(p) {
                var vec = _extractEntryNutrients(p);
                var totalKg = parseFloat(p.totalKg);
                if (!isFinite(totalKg) || totalKg <= 0) totalKg = parseFloat(p.totalKgHa);
                if (!isFinite(totalKg) || totalKg <= 0) totalKg = parseFloat(p.totalLHa);
                if (!isFinite(totalKg)) totalKg = 0;
                return {
                    name: p.name || (p.product && p.product.name) || 'Unknown',
                    applications: p.applications || 0,
                    totalKg: totalKg,
                    nutrients: vec
                };
            });

            // Detect optional macro columns to render
            var activeCols = _detectActiveNutrientColumns(
                rowsData.map(function(r) { return r.nutrients; })
            );

            // Column widths: keep Product/Applications/Total kg/ha fixed,
            // distribute the remaining space across the active nutrient
            // columns. Existing widths (N=1200, K=1200) preserved when only
            // N(always) + K(always) + optional P/Ca/Mg/S. Distribute the
            // usable A4 width (9 400 DXA) across fixed and nutrient columns
            // so the table never overflows regardless of how many are active.
            var includeP = activeCols.P;
            var includeCa = activeCols.Ca;
            var includeMg = activeCols.Mg;
            var includeS = activeCols.S;
            var optionalCount = (includeP ? 1 : 0) + (includeCa ? 1 : 0) + (includeMg ? 1 : 0) + (includeS ? 1 : 0);
            // Shrink fixed columns when many nutrient columns are active
            var productW  = optionalCount >= 2 ? 2200 : 3000;
            var appsW     = optionalCount >= 2 ? 1100 : 1500;
            var totalKgW  = optionalCount >= 2 ? 1100 : 1500;
            var fixedTotal = productW + appsW + totalKgW;
            var totalNutCols = 2 + optionalCount; // N + K + optional
            var nutWidth = optionalCount === 0 ? 1200 : Math.floor((9400 - fixedTotal) / totalNutCols);

            // Build header
            var headerCells = [
                new TableCell({ shading: { fill: 'E5E7EB', type: ShadingType.CLEAR }, width: { size: productW, type: WidthType.DXA }, children: [new Paragraph({ children: [new TextRun({ text: 'Product', bold: true, size: 20 })] })] }),
                new TableCell({ shading: { fill: 'E5E7EB', type: ShadingType.CLEAR }, width: { size: appsW, type: WidthType.DXA }, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'Applications', bold: true, size: 20 })] })] }),
                new TableCell({ shading: { fill: 'E5E7EB', type: ShadingType.CLEAR }, width: { size: totalKgW, type: WidthType.DXA }, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'Total kg/ha', bold: true, size: 20 })] })] }),
                new TableCell({ shading: { fill: 'E5E7EB', type: ShadingType.CLEAR }, width: { size: nutWidth, type: WidthType.DXA }, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'N', bold: true, size: 20 })] })] })
            ];
            if (includeP) {
                headerCells.push(new TableCell({ shading: { fill: 'E5E7EB', type: ShadingType.CLEAR }, width: { size: nutWidth, type: WidthType.DXA }, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'P', bold: true, size: 20 })] })] }));
            }
            headerCells.push(new TableCell({ shading: { fill: 'E5E7EB', type: ShadingType.CLEAR }, width: { size: nutWidth, type: WidthType.DXA }, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'K', bold: true, size: 20 })] })] }));
            if (includeCa) {
                headerCells.push(new TableCell({ shading: { fill: 'E5E7EB', type: ShadingType.CLEAR }, width: { size: nutWidth, type: WidthType.DXA }, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'Ca', bold: true, size: 20 })] })] }));
            }
            if (includeMg) {
                headerCells.push(new TableCell({ shading: { fill: 'E5E7EB', type: ShadingType.CLEAR }, width: { size: nutWidth, type: WidthType.DXA }, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'Mg', bold: true, size: 20 })] })] }));
            }
            if (includeS) {
                headerCells.push(new TableCell({ shading: { fill: 'E5E7EB', type: ShadingType.CLEAR }, width: { size: nutWidth, type: WidthType.DXA }, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'S', bold: true, size: 20 })] })] }));
            }

            var summaryRows = [new TableRow({ tableHeader: true, children: headerCells })];

            // Pass 2: render rows
            rowsData.forEach(function(r) {
                var n = r.nutrients;
                var rowCells = [
                    new TableCell({ width: { size: productW, type: WidthType.DXA }, children: [new Paragraph({ children: [new TextRun({ text: r.name, size: 20 })] })] }),
                    new TableCell({ width: { size: appsW, type: WidthType.DXA }, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: String(r.applications), size: 20 })] })] }),
                    new TableCell({ width: { size: totalKgW, type: WidthType.DXA }, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: Math.round(r.totalKg).toString(), size: 20 })] })] }),
                    new TableCell({ width: { size: nutWidth, type: WidthType.DXA }, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: Math.round(n.N).toString(), size: 20 })] })] })
                ];
                if (includeP) {
                    rowCells.push(new TableCell({ width: { size: nutWidth, type: WidthType.DXA }, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: Math.round(n.P).toString(), size: 20 })] })] }));
                }
                rowCells.push(new TableCell({ width: { size: nutWidth, type: WidthType.DXA }, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: Math.round(n.K).toString(), size: 20 })] })] }));
                if (includeCa) {
                    rowCells.push(new TableCell({ width: { size: nutWidth, type: WidthType.DXA }, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: Math.round(n.Ca).toString(), size: 20 })] })] }));
                }
                if (includeMg) {
                    rowCells.push(new TableCell({ width: { size: nutWidth, type: WidthType.DXA }, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: Math.round(n.Mg).toString(), size: 20 })] })] }));
                }
                if (includeS) {
                    rowCells.push(new TableCell({ width: { size: nutWidth, type: WidthType.DXA }, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: Math.round(n.S).toString(), size: 20 })] })] }));
                }
                summaryRows.push(new TableRow({ children: rowCells }));
            });

            var fertColWidths = [productW, appsW, totalKgW, nutWidth];
            if (includeP) fertColWidths.push(nutWidth);
            fertColWidths.push(nutWidth); // K
            if (includeCa) fertColWidths.push(nutWidth);
            if (includeMg) fertColWidths.push(nutWidth);
            if (includeS) fertColWidths.push(nutWidth);
            var fertTableWidth = fertColWidths.reduce(function(a, b) { return a + b; }, 0);
            elements.push(new Table({ width: { size: fertTableWidth, type: WidthType.DXA }, columnWidths: fertColWidths, rows: summaryRows }));

            elements.push(new Paragraph({ children: [] }));
        }
        
        // Monthly Program table
        elements.push(new Paragraph({
            spacing: { before: 200, after: 100 },
            children: [new TextRun({ text: 'Monthly Schedule', bold: true, size: 24, color: '1F2937' })]
        }));
        
        var monthlyRows = [
            new TableRow({
                tableHeader: true,
                children: [
                    new TableCell({ shading: { fill: 'E5E7EB', type: ShadingType.CLEAR }, width: { size: 1200, type: WidthType.DXA }, children: [new Paragraph({ children: [new TextRun({ text: 'Month', bold: true, size: 20 })] })] }),
                    new TableCell({ shading: { fill: 'E5E7EB', type: ShadingType.CLEAR }, width: { size: 800, type: WidthType.DXA }, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'GP%', bold: true, size: 20 })] })] }),
                    new TableCell({ shading: { fill: 'E5E7EB', type: ShadingType.CLEAR }, width: { size: 5500, type: WidthType.DXA }, children: [new Paragraph({ children: [new TextRun({ text: 'Product Recommendations', bold: true, size: 20 })] })] })
                ]
            })
        ];
        
        monthly.forEach(function(m) {
            var gpPct = Math.round((m.gp || 0) * 100);
            var productText = '';
            
            // Build product text
            var products = [];
            if (m.granular && m.granular.length > 0) {
                m.granular.forEach(function(g) {
                    var rate = g.rateKgHa ? g.rateKgHa + ' kg/ha' : '';
                    var splits = g.splitCount > 1 ? ' ×' + g.splitCount : '';
                    products.push(g.name + (rate ? ' @ ' + rate : '') + splits);
                });
            }
            if (m.liquid && m.liquid.length > 0) {
                m.liquid.forEach(function(l) {
                    // b35fix322 Bug 2b: soluble products are dosed by mass not
                    // volume. rateLHa carries the kg/ha number for solubles
                    // (catalogue convention — see calculateLiquidApplication
                    // which keys off form). Display unit must follow form.
                    var unit = (l.form === 'soluble') ? 'kg/ha' : 'L/ha';
                    var rate = l.rateLHa ? l.rateLHa + ' ' + unit : '';
                    products.push(l.name + (rate ? ' @ ' + rate : ''));
                });
            }
            
            // Check if covered by previous application
            if (m.coveredBy) {
                productText = 'Covered by ' + m.coveredBy.product + ' (' + m.coveredBy.month + ')';
            } else if (products.length > 0) {
                productText = products.join(', ');
            } else {
                productText = '-';
            }
            
            // GP color
            var gpColor = gpPct >= 70 ? '16A34A' : gpPct >= 40 ? 'CA8A04' : '6B7280';
            
            monthlyRows.push(new TableRow({
                children: [
                    new TableCell({ width: { size: 1200, type: WidthType.DXA }, children: [new Paragraph({ children: [new TextRun({ text: m.month_name || m.month || '', size: 20 })] })] }),
                    new TableCell({ width: { size: 800, type: WidthType.DXA }, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: gpPct + '%', size: 20, color: gpColor })] })] }),
                    new TableCell({ width: { size: 5500, type: WidthType.DXA }, children: [new Paragraph({ children: [new TextRun({ text: productText, size: 20, color: m.coveredBy ? '6B7280' : '374151', italics: !!m.coveredBy })] })] })
                ]
            }));
        });
        
        elements.push(new Table({ width: { size: 7500, type: WidthType.DXA }, columnWidths: [1200, 800, 5500], rows: monthlyRows }));
        
        elements.push(new Paragraph({ children: [] }));
        
        return elements;
    }
    
    /**
     * Generate Cultivar Performance Profile
     * Comprehensive breakdown of selected variety's characteristics based on trial data
     * Includes BSPB ratings for UK, NTEP data for Australia/US, Scanturf for Nordic
     */
    function generateCultivarProfile(data) {
        var elements = [];
        
        // Get variety info
        var varietyName = null;
        var varietyData = null;
        var isBlend = false;
        var region = 'ntep';
        
        // Determine effective variety (considering overseed)
        var turf = data.turf || {};
        if (turf.overseedDominant && turf.effectiveVariety && turf.effectiveVariety !== 'generic') {
            varietyName = turf.effectiveVariety;
        } else if (turf.variety && turf.variety !== 'generic') {
            varietyName = turf.variety;
        }

        if (!varietyName) {
            return null; // No variety selected
        }
        
        // Detect region and get variety data
        if (typeof window.GAIP_VarietyTraits !== 'undefined') {
            region = window.GAIP_VarietyTraits.getCurrentRegion();
            varietyData = window.GAIP_VarietyTraits.getVarietyTraits(turf.effectiveSpecies || turf.species, varietyName, region);
        }
        
        // Check for UK blend
        if (typeof window.gaip_isUKBlend === 'function' && window.gaip_isUKBlend(varietyName)) {
            isBlend = true;
            if (typeof window.gaip_getUKBlendData === 'function') {
                varietyData = window.gaip_getUKBlendData(varietyName);
            }
        }
        
        // If still no data, try direct lookups
        if (!varietyData && typeof window.gaip_getUKVarietyData === 'function' && region === 'bspb') {
            varietyData = window.gaip_getUKVarietyData('perennialRyegrass', varietyName);
        }
        if (!varietyData && typeof window.GAIP_VARIETY_TRAITS !== 'undefined') {
            var speciesKey = (turf.effectiveSpecies || turf.species || '').toLowerCase().replace(/\s+/g, '');
            if (window.GAIP_VARIETY_TRAITS[speciesKey]) {
                varietyData = window.GAIP_VARIETY_TRAITS[speciesKey][varietyName];
            }
        }
        
        // v10.3.38: Use varietyTraits from data if already collected
        if (!varietyData && data.varietyTraits && data.varietyTraits.hasData) {
            varietyData = {
                displayName: data.varietyTraits.displayName || varietyName,
                qualityRating: data.varietyTraits.qualityRating,
                qualitySource: data.varietyTraits.qualitySource,
                traits: {
                    shade: data.varietyTraits.shade,
                    salinity: data.varietyTraits.salinity,
                    wear: data.varietyTraits.wear,
                    waterUse: data.varietyTraits.waterUse,
                    cold: data.varietyTraits.cold,
                    disease: data.varietyTraits.disease
                }
            };
        }
        
        if (!varietyData) {
            return null; // No trait data available
        }

        // v10.5.49: Resolve regionalTraits structure - MERGE across all regions
        // NTEP varieties store disease in subtropical_ntep, density in temperate_ntep, etc.
        // Must merge traits from all matching regions, not stop at first hit
        var resolvedQualityRating = varietyData.qualityRating;
        var resolvedQualitySource = varietyData.qualitySource;
        var resolvedTraits = varietyData.traits ? JSON.parse(JSON.stringify(varietyData.traits)) : null;
        
        if (varietyData.regionalTraits) {
            // Expanded region order: AU-specific first, then NTEP mapped to AU climates
            // Includes bare keys (subtropical, temperate, cold) used by bermuda/couch varieties
            var regionOrder = ['au_temperate', 'au_subtropical', 'temperate_au', 'subtropical_au',
                               'subtropical', 'temperate', 'temperate_ntep', 'subtropical_ntep',
                               'cold_ntep', 'cold', 'ntep_us',
                               'au_tropical', 'au_mediterranean',
                               'nzsti_nz', 'nzsti_auckland', 'bspb_uk'];
            
            for (var ri = 0; ri < regionOrder.length; ri++) {
                var regionKey = regionOrder[ri];
                var regionData = varietyData.regionalTraits[regionKey];
                if (regionData) {
                    // Take first quality rating found (highest priority region)
                    if (!resolvedQualityRating && regionData.qualityRating) {
                        resolvedQualityRating = regionData.qualityRating;
                        resolvedQualitySource = regionData.qualitySource || ('NTEP ' + regionKey);
                    }
                    // MERGE traits: add any trait keys not already present
                    if (regionData.traits) {
                        if (!resolvedTraits) {
                            resolvedTraits = JSON.parse(JSON.stringify(regionData.traits));
                        } else {
                            var regionTraitKeys = Object.keys(regionData.traits);
                            for (var tk = 0; tk < regionTraitKeys.length; tk++) {
                                var traitKey = regionTraitKeys[tk];
                                if (!resolvedTraits[traitKey]) {
                                    // Add missing trait category (e.g. disease, winterColor)
                                    resolvedTraits[traitKey] = JSON.parse(JSON.stringify(regionData.traits[traitKey]));
                                } else if (traitKey === 'disease' && typeof regionData.traits.disease === 'object') {
                                    // Merge individual disease entries
                                    var regionDiseases = Object.keys(regionData.traits.disease);
                                    for (var dk = 0; dk < regionDiseases.length; dk++) {
                                        var diseaseName = regionDiseases[dk];
                                        if (!resolvedTraits.disease[diseaseName]) {
                                            resolvedTraits.disease[diseaseName] = JSON.parse(JSON.stringify(regionData.traits.disease[diseaseName]));
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
        
        // Build profile content
        var profile = {
            name: varietyData.displayName || varietyName,
            type: isBlend ? 'Blend' : (varietyData.type || 'Cultivar'),
            source: varietyData.source || varietyData.dataSource || 'Trial data',
            region: region,
            hasData: true
        };
        
        // Trial ratings section (BSPB format)
        var ratings = [];
        if (varietyData.bspbRatings) {
            var bspb = varietyData.bspbRatings;
            if (bspb.mean) ratings.push({ label: 'Overall Mean', value: bspb.mean.toFixed(1), scale: '1-9' });
            if (bspb.liveGroundCover) ratings.push({ label: 'Live Ground Cover', value: bspb.liveGroundCover.toFixed(1), scale: '1-9' });
            if (bspb.visualMerit) ratings.push({ label: 'Visual Merit', value: bspb.visualMerit.toFixed(1), scale: '1-9' });
            if (bspb.recovery) ratings.push({ label: 'Recovery', value: bspb.recovery.toFixed(1), scale: '1-9' });
            if (bspb.shootDensity) ratings.push({ label: 'Shoot Density', value: bspb.shootDensity.toFixed(1), scale: '1-9' });
            if (bspb.finenessOfLeaf) ratings.push({ label: 'Fineness of Leaf', value: bspb.finenessOfLeaf.toFixed(1), scale: '1-9' });
            if (bspb.redThreadResistance) ratings.push({ label: 'Red Thread Resistance', value: bspb.redThreadResistance.toFixed(1), scale: '1-9', note: bspb.redThreadResistance < 5 ? 'Below average' : bspb.redThreadResistance > 6 ? 'Good' : 'Moderate' });
            if (bspb.winterGreenness) ratings.push({ label: 'Winter Greenness', value: bspb.winterGreenness.toFixed(1), scale: '1-9' });
            if (bspb.summerGreenness) ratings.push({ label: 'Summer Greenness', value: bspb.summerGreenness.toFixed(1), scale: '1-9' });
            profile.ratings = ratings;
            profile.ratingSource = 'BSPB Turfgrass Seed 2025 (STRI trials, Bingley)';
        }
        
        // NTEP quality rating (use resolved value)
        if (resolvedQualityRating) {
            ratings.push({ label: 'NTEP Quality Rating', value: resolvedQualityRating.toFixed(1), scale: '1-9' });
            profile.ratingSource = resolvedQualitySource || 'NTEP trials';
        }
        
        // Ensure ratings are always assigned to profile
        if (ratings.length > 0) {
            profile.ratings = ratings;
        }
        
        // Trait multipliers (use resolved traits)
        var traits = resolvedTraits || {};
        var traitCards = [];
        
        // Wear tolerance
        if (traits.wear) {
            var wearMult = traits.wear.multiplier || 1.0;
            var wearPct = Math.round((1 - wearMult) * 100);
            var wearModText = wearPct === 0 ? 'Baseline for species' :
                wearPct > 0 ? '+' + wearPct + '% traffic tolerance' : wearPct + '% traffic tolerance';
            traitCards.push({
                category: 'Wear Tolerance',
                rating: wearMult < 0.85 ? 'Excellent' : wearMult < 0.95 ? 'Good' : wearMult < 1.05 ? 'Average' : 'Below Average',
                modifier: wearModText,
                color: wearMult < 0.90 ? '16A34A' : wearMult < 1.05 ? 'CA8A04' : 'DC2626',
                confidence: traits.wear.confidence || 'medium',
                source: traits.wear.source || '',
                notes: traits.wear.notes || ''
            });
        }
        
        // Recovery
        if (traits.recovery) {
            var recMult = traits.recovery.multiplier || 1.0;
            var recPct = Math.round((1 - recMult) * 100);
            traitCards.push({
                category: 'Recovery Rate',
                rating: recMult < 0.85 ? 'Excellent' : recMult < 0.95 ? 'Good' : recMult < 1.05 ? 'Average' : 'Below Average',
                modifier: recPct > 0 ? '+' + recPct + '% faster recovery' : recPct + '% recovery rate',
                color: recMult < 0.90 ? '16A34A' : recMult < 1.05 ? 'CA8A04' : 'DC2626',
                confidence: traits.recovery.confidence || 'medium',
                source: traits.recovery.source || ''
            });
        }
        
        // Shade tolerance
        if (traits.shade && traits.shade.thresholdModifier) {
            var shadeMult = traits.shade.thresholdModifier;
            var shadePct = Math.round((1 - shadeMult) * 100);
            var shadeModText = shadePct === 0 ? 'Baseline for species' :
                shadePct > 0 ? 'Tolerates ' + shadePct + '% lower DLI' : 'Requires ' + Math.abs(shadePct) + '% more light';
            traitCards.push({
                category: 'Shade Tolerance',
                rating: shadeMult < 0.85 ? 'Excellent' : shadeMult < 0.95 ? 'Good' : shadeMult < 1.05 ? 'Average' : 'Below Average',
                modifier: shadeModText,
                color: shadeMult < 0.90 ? '16A34A' : shadeMult < 1.05 ? 'CA8A04' : 'DC2626',
                confidence: traits.shade.confidence || 'medium',
                source: traits.shade.source || '',
                notes: traits.shade.notes || ''
            });
        }
        
        // Salinity tolerance
        if (traits.salinity && traits.salinity.multiplier) {
            var saltMult = traits.salinity.multiplier;
            var saltPct = Math.round((1 - saltMult) * 100);
            traitCards.push({
                category: 'Salinity Tolerance',
                rating: saltMult < 0.85 ? 'Excellent' : saltMult < 0.95 ? 'Good' : saltMult < 1.05 ? 'Average' : 'Below Average',
                modifier: saltPct > 0 ? '+' + saltPct + '% salt tolerance' : saltPct + '% salt tolerance',
                color: saltMult < 0.90 ? '16A34A' : saltMult < 1.05 ? 'CA8A04' : 'DC2626',
                confidence: traits.salinity.confidence || 'medium',
                source: traits.salinity.source || ''
            });
        }
        
        // Water use
        if (traits.waterUse && traits.waterUse.multiplier) {
            var waterMult = traits.waterUse.multiplier;
            var waterPct = Math.round((1 - waterMult) * 100);
            traitCards.push({
                category: 'Water Use Efficiency',
                rating: waterMult < 0.85 ? 'Excellent' : waterMult < 0.95 ? 'Good' : waterMult < 1.05 ? 'Average' : 'High Water Use',
                modifier: waterPct > 0 ? waterPct + '% less water required' : Math.abs(waterPct) + '% more water required',
                color: waterMult < 0.90 ? '16A34A' : waterMult < 1.05 ? 'CA8A04' : 'DC2626',
                confidence: traits.waterUse.confidence || 'medium',
                source: traits.waterUse.source || '',
                notes: traits.waterUse.notes || ''
            });
        }
        
        // Cold tolerance
        if (traits.cold) {
            var coldRisk = traits.cold.winterkillRisk || 1.0;
            var coldPct = Math.round((1 - coldRisk) * 100);
            var coldModText = coldPct === 0 ? 'Baseline for species' :
                coldPct > 0 ? coldPct + '% lower winterkill risk' : Math.abs(coldPct) + '% higher winterkill risk';
            traitCards.push({
                category: 'Cold Tolerance',
                rating: coldRisk < 0.75 ? 'Excellent' : coldRisk < 0.90 ? 'Good' : coldRisk < 1.10 ? 'Average' : 'Below Average',
                modifier: coldModText,
                color: coldRisk < 0.80 ? '16A34A' : coldRisk < 1.05 ? 'CA8A04' : 'DC2626',
                confidence: traits.cold.confidence || 'medium',
                source: traits.cold.source || '',
                notes: traits.cold.notes || ''
            });
        }
        
        // Spring greenup
        if (traits.springGreenup && (traits.springGreenup.daysEarlier || traits.springGreenup.daysLater)) {
            var days = traits.springGreenup.daysEarlier || -(traits.springGreenup.daysLater || 0);
            traitCards.push({
                category: 'Spring Greenup',
                rating: days > 10 ? 'Excellent' : days > 5 ? 'Good' : days > 0 ? 'Slightly Early' : days > -5 ? 'Average' : 'Slow',
                modifier: days > 0 ? days + ' days earlier than standard' : days < 0 ? Math.abs(days) + ' days later than standard' : 'Standard timing',
                color: days > 7 ? '16A34A' : days > 0 ? 'CA8A04' : days >= -3 ? '6B7280' : 'DC2626',
                confidence: traits.springGreenup.confidence || 'medium',
                source: traits.springGreenup.source || ''
            });
        }
        
        profile.traitCards = traitCards;
        
        // Disease resistance
        var diseaseTraits = traits.disease || {};
        var diseaseCards = [];

        // b35fix419 (C4): use the species-aware disease label resolver from
        // disease-engine-pure.js. Falls back to a local dict if the resolver
        // isn't loaded (test contexts, race-condition load orders). Keeps the
        // canonical "Take-all Patch" label for cool-season species and swaps
        // to "Take-all Root Rot" for paspalum (var. graminis pathology).
        var _diseaseLabelFallback = {
            dollarSpot: 'Dollar Spot',
            brownPatch: 'Brown Patch',
            pythium: 'Pythium',
            pythiumRootRot: 'Pythium Root Rot',
            pythiumBlight: 'Pythium Blight',
            anthracnose: 'Anthracnose',
            grayLeafSpot: 'Gray Leaf Spot',
            springDeadSpot: 'Spring Dead Spot',
            redThread: 'Red Thread',
            fusarium: 'Fusarium (Microdochium)',
            takeAll: 'Take-all Patch',
            takeAllPatch: 'Take-all Patch'
        };
        var _resolveLabel = (typeof window !== 'undefined' &&
                             window.DiseaseEnginePure &&
                             window.DiseaseEnginePure.utils &&
                             typeof window.DiseaseEnginePure.utils.resolveDiseaseDisplayName === 'function')
            ? window.DiseaseEnginePure.utils.resolveDiseaseDisplayName
            : function(key) { return _diseaseLabelFallback[key] || key; };
        var _profileSpecies = turf.effectiveSpecies || turf.species || varietyData.species || null;

        Object.keys(diseaseTraits).forEach(function(disease) {
            var d = diseaseTraits[disease];
            if (d && d.riskMultiplier !== undefined) {
                var mult = d.riskMultiplier;
                var pct = Math.round((1 - mult) * 100);
                diseaseCards.push({
                    disease: _resolveLabel(disease, _profileSpecies),
                    multiplier: mult,
                    rating: mult < 0.80 ? 'Resistant' : mult < 0.95 ? 'Moderate Resistance' : mult < 1.10 ? 'Average' : mult < 1.30 ? 'Susceptible' : 'Highly Susceptible',
                    modifier: pct > 0 ? pct + '% lower risk' : Math.abs(pct) + '% higher risk',
                    color: mult < 0.85 ? '16A34A' : mult < 1.05 ? 'CA8A04' : 'DC2626',
                    confidence: d.confidence || 'medium',
                    source: d.source || ''
                });
            }
        });
        
        profile.diseaseCards = diseaseCards;

        // Blend composition (if applicable)
        if (isBlend && varietyData.composition) {
            profile.composition = varietyData.composition;
            profile.supplier = varietyData.supplier;
            profile.application = varietyData.application;
        }
        
        return profile;
    }
    
    /**
     * Render cultivar profile section for Word document
     */
    function renderCultivarProfileSection(profile) {
        var elements = [];
        
        if (!profile || !profile.hasData) {
            return elements;
        }
        
        // Section heading
        elements.push(new Paragraph({ 
            heading: HeadingLevel.HEADING_1, 
            keepNext: true, 
            children: [new TextRun('Cultivar Performance Profile')] 
        }));
        
        // Variety name and type
        var typeLabel = profile.type === 'Blend' ? 'Seed Blend' : 
                        profile.type === 'tetraploid' ? 'Tetraploid Cultivar' :
                        profile.type === 'diploid' ? 'Diploid Cultivar' : 'Cultivar';
        
        elements.push(new Paragraph({
            spacing: { after: 100 },
            children: [
                new TextRun({ text: profile.name, bold: true, size: 28, color: '1F2937' }),
                new TextRun({ text: '  (' + typeLabel + ')', size: 22, color: '6B7280' })
            ]
        }));
        
        // Data source
        if (profile.ratingSource) {
            elements.push(new Paragraph({
                spacing: { after: 200 },
                children: [new TextRun({ text: 'Data source: ' + profile.ratingSource, size: 20, color: '6B7280', italics: true })]
            }));
        }
        
        // Blend composition (if applicable)
        if (profile.composition && profile.composition.length > 0) {
            elements.push(new Paragraph({
                spacing: { before: 150, after: 100 },
                children: [new TextRun({ text: 'Blend Composition', bold: true, size: 22, color: '1F2937' })]
            }));
            
            if (profile.supplier) {
                elements.push(new Paragraph({
                    spacing: { after: 80 },
                    children: [new TextRun({ text: 'Supplier: ' + profile.supplier, size: 20, color: '4B5563' })]
                }));
            }
            
            if (profile.application) {
                elements.push(new Paragraph({
                    spacing: { after: 100 },
                    children: [new TextRun({ text: 'Application: ' + profile.application, size: 20, color: '4B5563' })]
                }));
            }
            
            var compText = profile.composition.map(function(c) {
                return c.cultivar + ' (' + c.percent + '%)';
            }).join(', ');
            
            elements.push(new Paragraph({
                spacing: { after: 200 },
                children: [new TextRun({ text: compText, size: 22, color: '374151' })]
            }));
        }
        
        // Trial ratings table (BSPB format)
        if (profile.ratings && profile.ratings.length > 0) {
            elements.push(new Paragraph({
                spacing: { before: 150, after: 100 },
                children: [new TextRun({ text: 'Trial Performance Ratings', bold: true, size: 22, color: '1F2937' })]
            }));
            
            var ratingRows = [
                new TableRow({
                    tableHeader: true,
                    children: [
                        new TableCell({ shading: { fill: 'E5E7EB', type: ShadingType.CLEAR }, width: { size: 3500, type: WidthType.DXA }, children: [new Paragraph({ children: [new TextRun({ text: 'Characteristic', bold: true, size: 20 })] })] }),
                        new TableCell({ shading: { fill: 'E5E7EB', type: ShadingType.CLEAR }, width: { size: 1500, type: WidthType.DXA }, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'Rating', bold: true, size: 20 })] })] }),
                        new TableCell({ shading: { fill: 'E5E7EB', type: ShadingType.CLEAR }, width: { size: 1000, type: WidthType.DXA }, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'Scale', bold: true, size: 20 })] })] }),
                        new TableCell({ shading: { fill: 'E5E7EB', type: ShadingType.CLEAR }, width: { size: 3360, type: WidthType.DXA }, children: [new Paragraph({ children: [new TextRun({ text: 'Assessment', bold: true, size: 20 })] })] })
                    ]
                })
            ];
            
            profile.ratings.forEach(function(r) {
                var val = parseFloat(r.value);
                var assessment = r.note || (val >= 7.5 ? 'Excellent' : val >= 6.5 ? 'Good' : val >= 5.5 ? 'Moderate' : val >= 4.5 ? 'Below Average' : 'Poor');
                var color = val >= 7.0 ? '16A34A' : val >= 5.5 ? 'CA8A04' : 'DC2626';
                
                ratingRows.push(new TableRow({
                    children: [
                        new TableCell({ width: { size: 3500, type: WidthType.DXA }, children: [new Paragraph({ children: [new TextRun({ text: r.label, size: 20 })] })] }),
                        new TableCell({ width: { size: 1500, type: WidthType.DXA }, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: r.value, size: 20, bold: true, color: color })] })] }),
                        new TableCell({ width: { size: 1000, type: WidthType.DXA }, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: r.scale || '1-9', size: 18, color: '6B7280' })] })] }),
                        new TableCell({ width: { size: 3360, type: WidthType.DXA }, children: [new Paragraph({ children: [new TextRun({ text: assessment, size: 20, color: color })] })] })
                    ]
                }));
            });
            
            elements.push(new Table({ width: { size: 9360, type: WidthType.DXA }, columnWidths: [3500, 1500, 1000, 3360], rows: ratingRows }));
            elements.push(new Paragraph({ spacing: { after: 200 }, children: [] }));
        }
        
        // Performance trait cards
        if (profile.traitCards && profile.traitCards.length > 0) {
            elements.push(new Paragraph({
                spacing: { before: 150, after: 100 },
                children: [new TextRun({ text: 'Performance Modifiers', bold: true, size: 22, color: '1F2937' })]
            }));
            
            elements.push(new Paragraph({
                spacing: { after: 120 },
                children: [new TextRun({ text: 'These modifiers adjust baseline species calculations in the Hub analysis:', size: 20, color: '6B7280' })]
            }));
            
            profile.traitCards.forEach(function(card) {
                elements.push(new Paragraph({
                    spacing: { after: 60 },
                    children: [
                        new TextRun({ text: card.category + ': ', bold: true, size: 20, color: '1F2937' }),
                        new TextRun({ text: card.rating, size: 20, color: card.color, bold: true }),
                        new TextRun({ text: ', ' + card.modifier, size: 20, color: '4B5563' })
                    ]
                }));
                
                if (card.source) {
                    elements.push(new Paragraph({
                        spacing: { after: 100 },
                        indent: { left: 360 },
                        children: [new TextRun({ text: card.source, size: 18, color: '9CA3AF', italics: true })]
                    }));
                }
            });
            
            elements.push(new Paragraph({ spacing: { after: 150 }, children: [] }));
        }
        
        // Disease resistance profile
        if (profile.diseaseCards && profile.diseaseCards.length > 0) {
            elements.push(new Paragraph({
                spacing: { before: 150, after: 100 },
                children: [new TextRun({ text: 'Disease Resistance Profile', bold: true, size: 22, color: '1F2937' })]
            }));
            
            var diseaseRows = [
                new TableRow({
                    tableHeader: true,
                    children: [
                        new TableCell({ shading: { fill: 'E5E7EB', type: ShadingType.CLEAR }, width: { size: 3000, type: WidthType.DXA }, children: [new Paragraph({ children: [new TextRun({ text: 'Disease', bold: true, size: 20 })] })] }),
                        new TableCell({ shading: { fill: 'E5E7EB', type: ShadingType.CLEAR }, width: { size: 2500, type: WidthType.DXA }, children: [new Paragraph({ children: [new TextRun({ text: 'Resistance', bold: true, size: 20 })] })] }),
                        new TableCell({ shading: { fill: 'E5E7EB', type: ShadingType.CLEAR }, width: { size: 2500, type: WidthType.DXA }, children: [new Paragraph({ children: [new TextRun({ text: 'Risk Modifier', bold: true, size: 20 })] })] }),
                        new TableCell({ shading: { fill: 'E5E7EB', type: ShadingType.CLEAR }, width: { size: 1360, type: WidthType.DXA }, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'Confidence', bold: true, size: 20 })] })] })
                    ]
                })
            ];
            
            profile.diseaseCards.forEach(function(d) {
                diseaseRows.push(new TableRow({
                    children: [
                        new TableCell({ width: { size: 3000, type: WidthType.DXA }, children: [new Paragraph({ children: [new TextRun({ text: d.disease, size: 20 })] })] }),
                        new TableCell({ width: { size: 2500, type: WidthType.DXA }, children: [new Paragraph({ children: [new TextRun({ text: d.rating, size: 20, color: d.color, bold: true })] })] }),
                        new TableCell({ width: { size: 2500, type: WidthType.DXA }, children: [new Paragraph({ children: [new TextRun({ text: d.modifier, size: 20, color: d.color })] })] }),
                        new TableCell({ width: { size: 1360, type: WidthType.DXA }, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: d.confidence, size: 18, color: '6B7280' })] })] })
                    ]
                }));
            });
            
            elements.push(new Table({ width: { size: 9360, type: WidthType.DXA }, columnWidths: [3000, 2500, 2500, 1360], rows: diseaseRows }));
        }
        
        return elements;
    }
    
    // =========================================================================
    // b35fix313 — Engine input assembly helper
    //
    // Consolidates the engine-input readers (species, clippings, traffic,
    // nProgram, monthly temps, hemisphere, overseed) into a single function
    // that writes its output onto data.engineInputs. Called from collectData()
    // once per export. Per-sample correctness in combined exports comes from
    // the fact that collectData() is called INSIDE the combined export loop
    // (once per site-sample iteration, with the correct site active), so
    // data.engineInputs captures that iteration's state before it's pushed
    // to collectedReports. The post-loop ANR pass then reads r.data.engineInputs
    // instead of re-reading globals which would reflect only the last site.
    //
    // Sources, in priority order:
    //   species:     GAIP_STATE.inputs.turf.species → GAIP_STATE.turf.(species|grassSpecies)
    //   clippings:   GAIP_STATE.turf.clippingsCollected
    //   traffic:     GAIP_STATE.traffic.intensity → 'moderate'
    //   nProgram:    .gaip-nutrition-annual-n DOM input → GAIP_STATE.turf.nProgramKgHaYr
    //                → GAIP_STATE.inputs.turf.nProgramKgHaYr → null (engine default)
    //   monthlyTemps: GilbaClimateEngine.getMonthlyData() → latitude-band fallback
    //   hemisphere:  lat-based from GAIP_STATE → 'south' default
    //   overseed:    GAIP_OVERSEED_STATE → default (no overseed)
    // =========================================================================
    function _buildEngineInputs(data) {
        if (!data) return;

        var _state = window.GAIP_STATE || {};
        var _stInputs = _state.inputs || {};
        var _stTurf = _state.turf || {};
        var _stTraffic = _state.traffic || {};
        var _canon = window.GAIP_CANONICAL_STATE || {};
        var _canonTurf = _canon.turf || {};

        // b35fix367 — Per-sample turf profile override (multi-site turf mode).
        //
        // For council clients with many heterogeneous samples per site, the
        // active sample may carry sample.turfProfile = {species, variety, ...}
        // that overrides the site-level identity. The override is gated on
        // GAIP_SiteConfig.isMultiSiteTurfEnabled(activeSiteId) — when off,
        // the override is ignored even if present (non-destructive).
        //
        // Read site precedence: sample override > canonical state > GAIP_STATE > DOM.
        // This is THE only engine read site that needs the override —
        // SpeciesController, hub-orchestrator, and disease engines all
        // consume the species via canonical state which is rebuilt per
        // sample-load when loadSample applies the override into
        // GaipTurfProfile.state. _buildEngineInputs is the safety net for
        // word-export's _buildEngineInputs called within combined-export
        // per-iteration (where GAIP_CANONICAL_STATE may not yet have caught
        // up to the active sample).
        var _sampleOverrideSpecies = null;
        var _sampleOverrideOverseed = null;
        var _sampleOverrideTurfType = null;
        try {
            var _SM = window.GAIP_SampleManager;
            var _SC = window.GAIP_SiteConfig;
            if (_SM && _SC && typeof _SC.isMultiSiteTurfEnabled === 'function') {
                var _activeSite = typeof _SM.getActiveSiteId === 'function'
                    ? _SM.getActiveSiteId() : null;
                if (_activeSite && _SC.isMultiSiteTurfEnabled(_activeSite)) {
                    var _activeSample = typeof _SM.getActiveSample === 'function'
                        ? _SM.getActiveSample('soil') : null;
                    if (_activeSample && _activeSample.turfProfile) {
                        var _tp = _activeSample.turfProfile;
                        if (_tp.species)          _sampleOverrideSpecies  = _tp.species;
                        if (_tp.companionSpecies) _sampleOverrideOverseed = _tp.companionSpecies;
                        if (_tp.turfType)         _sampleOverrideTurfType = _tp.turfType;
                    }
                }
            }
        } catch (e) {
            // Defensive: never let override read crash _buildEngineInputs.
            // Falls through to canonical chain on any error.
        }

        // b35fix314: species resolution with readiness guard + hard-fail.
        //
        // Problem observed in production (b35fix313 Russley log): on fresh
        // site-activation, the user clicks Export Word before the cascade
        // has fully propagated species into GAIP_STATE.turf.grassSpecies.
        // Previously the chain fell through to 'perennialRyegrass' and
        // silently produced wrong-species ANR.
        //
        // Fix priority order:
        //   0. b35fix367 sample.turfProfile.species — when multi-site turf
        //      mode is on for the active site, the per-sample override wins.
        //   1. GAIP_CANONICAL_STATE.turf.speciesKey — written at end of every
        //      computeAll by hub-orchestrator.js. If present, the orchestrator
        //      has resolved and normalised species (via SpeciesController).
        //      This is the SAME source hub-orchestrator uses to emit the
        //      disease engine's species. Most reliable readiness signal.
        //   2. GAIP_STATE.inputs.turf.species / GAIP_STATE.turf.species /
        //      GAIP_STATE.turf.grassSpecies — existing chain, left in place
        //      because some consumer code paths write here directly.
        //   3. DOM probe — .gaip-species select value. site-config-persistence
        //      restores this synchronously on site-switch before any async
        //      cascade, so it's the earliest source of truth.
        //   4. NULL — hard-fail. Caller must handle missing engineInputs
        //      rather than silently getting 'perennialRyegrass'.
        var _species =
            _sampleOverrideSpecies ||
            _canonTurf.effectiveSpeciesKey ||
            _canonTurf.speciesKey ||
            (_stInputs.turf && _stInputs.turf.species) ||
            _stTurf.species ||
            _stTurf.grassSpecies ||
            null;

        if (!_species) {
            // Last-resort DOM probe. The species <select> reflects what
            // site-config-persistence wrote during restoreConfig, which
            // happens 300ms after gaip:site-changed regardless of whether
            // the async cascade has touched GAIP_STATE yet.
            var _spEl = document.querySelector('.gaip-species');
            if (_spEl && _spEl.value) {
                var _opt = _spEl.options ? _spEl.options[_spEl.selectedIndex] : null;
                _species = (_opt && _opt.text) || _spEl.value;
            }
        }

        if (!_species) {
            // Hard-fail: readiness check failed entirely. Signal to callers
            // by nulling data.engineInputs. The single-export nutritionSummary
            // block will detect this and fall through to the legacy cache
            // path. The combined-export ANR pass will log a warning and skip
            // that report's ANR. Neither silently substitutes a species.
            console.warn('[WordExport] _buildEngineInputs: species unresolved ' +
                         '(canonical, state, and DOM all empty), ' +
                         'setting data.engineInputs=null. ' +
                         'Caller will fall back or hard-fail.');
            data.engineInputs = null;
            return;
        }

        // User-supplied N programme. b35fix312 made .gaip-nutrition-annual-n
        // (Nutrition Program panel) the primary input, with .gaip-n-program
        // (Site Settings) as fallback. Mirror that precedence here.
        var _userN = null;
        var _nEl = document.querySelector('.gaip-nutrition-annual-n');
        if (!_nEl || !_nEl.value) {
            _nEl = document.querySelector('.gaip-n-program, #n-program, [name="n-program"], .gaip-annual-n');
        }
        if (_nEl && _nEl.value) {
            var _nParsed = parseFloat(_nEl.value);
            if (isFinite(_nParsed) && _nParsed >= 0) _userN = _nParsed;
        }
        if (_userN === null) {
            _userN = (_stTurf.nProgramKgHaYr != null) ? _stTurf.nProgramKgHaYr :
                     (_stInputs.turf && _stInputs.turf.nProgramKgHaYr != null)
                         ? _stInputs.turf.nProgramKgHaYr : null;
        }

        // Monthly temps: live climate engine wins, otherwise latitude-band fallback.
        var _climateData = (window.GilbaClimateEngine &&
                            typeof window.GilbaClimateEngine.getMonthlyData === 'function')
            ? (window.GilbaClimateEngine.getMonthlyData() || {}) : {};
        var _monthlyTemps = {};
        var _climateIsLive = false;
        for (var _m = 1; _m <= 12; _m++) {
            if (_climateData[_m] && typeof _climateData[_m].temp === 'number' && !isNaN(_climateData[_m].temp)) {
                _monthlyTemps[_m] = _climateData[_m].temp;
                _climateIsLive = true;
            }
        }

        // Latitude extraction — DOM input is authoritative for the current
        // active site (site-config-persistence restores it on site-switch).
        var _latEl = document.querySelector('.gaip-lat');
        var _lat = _latEl ? parseFloat(_latEl.value) : NaN;
        if (!isFinite(_lat)) {
            _lat = (_stInputs.site && _stInputs.site.latitude) ||
                   (_state.site && _state.site.latitude) ||
                   (_state.location && _state.location.lat);
            if (typeof _lat !== 'number' || isNaN(_lat)) _lat = -33;  // Sydney-ish default
        }

        if (!_climateIsLive) {
            var _absLat = Math.abs(_lat);
            if (_absLat < 23.5) {
                _monthlyTemps = _lat >= 0
                    ? { 1:17,2:19,3:23,4:27,5:30,6:31,7:31,8:30,9:29,10:27,11:23,12:19 }
                    : { 1:30,2:30,3:29,4:28,5:26,6:24,7:23,8:25,9:28,10:30,11:31,12:31 };
            } else if (_absLat < 35) {
                _monthlyTemps = _lat >= 0
                    ? { 1:10,2:12,3:17,4:22,5:27,6:30,7:31,8:30,9:26,10:21,11:15,12:11 }
                    : { 1:26,2:26,3:24,4:21,5:17,6:14,7:13,8:15,9:18,10:21,11:24,12:26 };
            } else {
                _monthlyTemps = _lat < 0
                    ? { 1:25,2:25,3:22,4:18,5:14,6:11,7:10,8:12,9:15,10:18,11:21,12:24 }
                    : { 1: 5,2: 7,3:11,4:15,5:20,6:24,7:26,8:25,9:21,10:15,11: 9,12: 5 };
            }
        }

        var _hemisphere = (_lat < 0) ? 'south' : 'north';

        // Overseed: null GAIP_OVERSEED_STATE = pure C4 / no overseed config
        // (explicitly cleared by overseed-climate-integration v1.2.3 for pure C4).
        var _overseedConfig;
        if (window.GAIP_OVERSEED_STATE) {
            var _os = window.GAIP_OVERSEED_STATE;
            _overseedConfig = {
                isOverseed: !!(_os.isC4Base && _os.overseedSpecies),
                baseSpecies: _os.baseSpecies || null,
                overseedSpecies: _os.overseedSpecies || null,
                summerIntent: _os.summerIntent || 'transition',
                baseIsC4: !!_os.isC4Base
            };
        } else {
            _overseedConfig = {
                isOverseed: false,
                baseSpecies: null,
                overseedSpecies: null,
                summerIntent: 'transition',
                baseIsC4: false
            };
        }

        // b35fix367 — Per-sample overseed override (companionSpecies).
        // When the active sample carries a non-empty companionSpecies and
        // multi-site turf mode is on for the active site, override the
        // site-level overseed assembly. baseSpecies and baseIsC4 derive
        // from the (possibly-overridden) species above so the C3-on-C4
        // dominance check downstream still gets the right base.
        if (_sampleOverrideOverseed) {
            var _baseSp = _species || null;
            var _baseIsC4 = false;
            try {
                var _SC2 = window.SpeciesController;
                if (_SC2 && typeof _SC2.isC4Species === 'function' && _baseSp) {
                    _baseIsC4 = _SC2.isC4Species(_baseSp);
                }
            } catch (e) { /* defensive */ }
            _overseedConfig = {
                isOverseed: true,
                baseSpecies: _baseSp,
                overseedSpecies: _sampleOverrideOverseed,
                summerIntent: _overseedConfig.summerIntent || 'transition',
                baseIsC4: _baseIsC4
            };
        }

        data.engineInputs = {
            turf: {
                species: _species,
                clippingsCollected: !!_stTurf.clippingsCollected,
                trafficIntensity: _stTraffic.intensity || 'moderate',
                nProgramKgHaYr: _userN
            },
            climate: {
                monthlyTemps: _monthlyTemps,
                hemisphere: _hemisphere,
                isLive: _climateIsLive,
                latitude: _lat
            },
            overseedConfig: _overseedConfig
        };

        // b35fix370 — Propagate per-sample species override into data.turf so
        // ALL render sites (pH narrative, fertiliser recs, soil interpretation,
        // section headings, etc.) pick up the same species the engines used.
        //
        // Pre-b35fix370 the engineInputs.turf.species was correct (engines saw
        // Kikuyu when override was Kikuyu) but data.turf.species was stale
        // site-level (Couch). Result: nutrition kg/ha was right, but the
        // accompanying narrative said "Couch pH requirements" and "Soil pH is
        // above optimal range for Couch" — confusing and wrong for any client
        // report. Surfaced in production on Banksia Park (Kikuyu override on a
        // Couch-default site): metadata line correctly said Kikuyu (b35fix368
        // fix to that specific render site) but the pH narrative below it
        // still said Couch (this render site, plus several others).
        //
        // Only fires when there IS a per-sample override (_sampleOverrideSpecies
        // is non-null) — otherwise data.turf is left exactly as collectData
        // populated it from DOM. This is non-destructive: the original
        // site-level values are preserved on the rare consumer that might
        // need them (none in current code, but defensive).
        //
        // Fields rewritten:
        //   - data.turf.species         — primary read site for most narrative
        //   - data.turf.effectiveSpecies — read by overseed-aware narrative
        //   - data.turf.warmBase        — read by C3-overseed-on-C4 logic
        //   - data.turf.speciesDisplay  — formatted "X (overseeded: Y)" string
        //
        // Companion species override (_sampleOverrideOverseed) similarly
        // propagates into data.turf.coolOverseed / overseedConfig.overseedSpecies
        // so overseeded-period narratives reflect the per-sample companion.
        if (_sampleOverrideSpecies) {
            data.turf = data.turf || {};
            data.turf.species = _sampleOverrideSpecies;
            data.turf.warmBase = _sampleOverrideSpecies;
            data.turf.grassSpecies = _sampleOverrideSpecies;
            // Rebuild speciesDisplay to match. If there's also an overseed
            // override, fold it into the parenthetical the same way
            // collectData would have. Otherwise just the species name.
            if (_sampleOverrideOverseed) {
                data.turf.coolOverseed = _sampleOverrideOverseed;
                data.turf.speciesDisplay = _sampleOverrideSpecies + ' (overseeded: ' + _sampleOverrideOverseed + ')';
                // effectiveSpecies — depends on overseed status. Conservative:
                // when overseed is active for the date, effective is the cool
                // overseed; otherwise the warm base. Without per-sample-load
                // re-evaluation here, default to warm base — the existing
                // overseed-status logic in collectData populated this field
                // before _buildEngineInputs ran, so we only override when the
                // existing value was clearly site-level. Safest: leave
                // effectiveSpecies unchanged unless overseed is OFF, in which
                // case it should match the species.
                if (data.turf.overseedStatus === 'off' || data.turf.overseedStatus === 'inactive') {
                    data.turf.effectiveSpecies = _sampleOverrideSpecies;
                }
            } else {
                data.turf.speciesDisplay = _sampleOverrideSpecies;
                data.turf.effectiveSpecies = _sampleOverrideSpecies;
            }
        }
        if (_sampleOverrideOverseed && !_sampleOverrideSpecies) {
            // Companion-only override (no species override) — still propagate
            data.turf = data.turf || {};
            data.turf.coolOverseed = _sampleOverrideOverseed;
        }
    }

    // b35fix368 — Per-sample section header line.
    //
    // Format: "Site name · 1.0 ha · Species"
    //
    // Used in per-sample sections (combined exports especially) where each
    // section needs at-a-glance identity. Pulls species from
    // data.engineInputs.turf.species — the SAME field that flowed to the
    // engines for this sample's analysis (b35fix367 single-source-of-truth
    // contract). Falls back to data.turf.species when engineInputs absent.
    //
    // Pure: no DOM access, no side effects. Defensive against null/empty —
    // returns '' rather than throwing.
    //
    // Exposed as window.GAIP_WordExport._buildSectionHeaderLine for testing
    // and for combined-export module to call directly.
    function _buildSectionHeaderLine(d) {
        if (!d) return '';
        var parts = [];
        if (d.site && d.site.name && d.site.name !== 'Not specified') {
            parts.push(d.site.name);
        }
        var areaHa = d.soil && d.soil.areaHa;
        if (areaHa != null && isFinite(areaHa) && areaHa > 0) {
            // 1.0 → "1 ha", 0.85 → "0.85 ha", 12.345 → "12.34 ha"
            var n = Number(areaHa);
            var formatted;
            if (n >= 10) {
                formatted = n.toFixed(2);
            } else {
                formatted = n.toFixed(2).replace(/0+$/, '').replace(/\.$/, '');
            }
            if (!formatted) formatted = String(n);
            parts.push(formatted + ' ha');
        }
        // engineInputs.turf.species is authoritative — that's the species
        // the engines used. Fall back to data.turf.species only when
        // engineInputs absent (fresh export before analysis).
        var species = (d.engineInputs && d.engineInputs.turf && d.engineInputs.turf.species)
            || (d.turf && d.turf.species)
            || null;
        if (species) parts.push(String(species));
        return parts.join(' \u00b7 ');
    }

    // b35fix387: SSOT renderer for the Monthly N Distribution (GP-Weighted)
    // table. Pre-fix, single-export rendered a proper 12-column table with
    // colour-graded N values and GP% subscripts (word-export.js inline) while
    // combined-export rendered three plain prose paragraphs (word-export-
    // combined.js, b35fix307 simplification). Same data on `data.nutritionSummary
    // .monthlyN` / `.totalN` / `.activeMonths`, two divergent renderers — exactly
    // the asymmetric-renderer pattern.
    //
    // This helper produces a uniform docx node sequence usable by both export
    // paths. Returns an array of docx elements (Paragraph + Paragraph + Table),
    // ready to spread into a sections / allChildren array. docxRefs is required
    // because the docx library classes are local-scoped inside the export build
    // functions; the helper pulls Paragraph/TextRun/Table/TableRow/TableCell/
    // WidthType/AlignmentType from the bag.
    //
    // Args:
    //   monthlyN     — array of 12 {n, gp} objects (engine output)
    //   totalN       — annual total N kg/ha (or null/undefined)
    //   activeMonths — count of months with n > 0 (or null/undefined)
    //   docxRefs     — { Paragraph, TextRun, Table, TableRow, TableCell,
    //                    WidthType, AlignmentType }
    //   opts         — { titleSize, totalsSize, monthCellWidth,
    //                    siteUniformCaption: bool, siteUniformText: string }
    //
    // Returns: [Paragraph, Paragraph, Table, ...optionalCaption] or []
    // when monthlyN is empty/missing (no-op for the caller).
    function _buildMonthlyNDistribution(monthlyN, totalN, activeMonths, docxRefs, opts) {
        if (!monthlyN || !Array.isArray(monthlyN) || monthlyN.length === 0) {
            return [];
        }
        opts = opts || {};

        var Paragraph = docxRefs.Paragraph;
        var TextRun = docxRefs.TextRun;
        var Table = docxRefs.Table;
        var TableRow = docxRefs.TableRow;
        var TableCell = docxRefs.TableCell;
        var WidthType = docxRefs.WidthType;
        var AlignmentType = docxRefs.AlignmentType;

        var titleSize = opts.titleSize != null ? opts.titleSize : 24;
        var totalsSize = opts.totalsSize != null ? opts.totalsSize : 20;
        var cellWidth = opts.monthCellWidth != null ? opts.monthCellWidth : 750;

        var nodes = [];

        // Title
        nodes.push(new Paragraph({
            spacing: { before: 200 },
            children: [new TextRun({
                text: 'Monthly N Distribution (GP-Weighted)',
                bold: true,
                size: titleSize
            })]
        }));

        // Totals line — guarded against missing fields. Combined-export's
        // `r.data.nutritionSummary` carries totalN/activeMonths from the same
        // collectData path single-export uses (b35fix313), so both should be
        // populated; this guard is belt-and-braces for any caller that skips
        // collectData (scenario patches, future entry points).
        var totalsParts = [];
        if (totalN != null && isFinite(totalN)) {
            totalsParts.push('Total: ' + Number(totalN).toFixed(0) + ' kg N/ha/yr');
        }
        if (activeMonths != null && isFinite(activeMonths)) {
            totalsParts.push(activeMonths + ' active growing months');
        }
        if (totalsParts.length > 0) {
            nodes.push(new Paragraph({
                spacing: { before: 50, after: 100 },
                children: [new TextRun({
                    text: totalsParts.join(' | '),
                    size: totalsSize,
                    color: '6B7280'
                })]
            }));
        }

        // Header row — month labels with shaded background
        var monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                          'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        var headerCells = monthNames.map(function(month) {
            return new TableCell({
                children: [new Paragraph({
                    alignment: AlignmentType.CENTER,
                    children: [new TextRun({ text: month, bold: true, size: 18 })]
                })],
                shading: { fill: 'F3F4F6' },
                width: { size: cellWidth, type: WidthType.DXA }
            });
        });

        // Data row — N values colour-graded by magnitude, GP% subscript.
        // Colour bands match single-export's pre-b35fix387 inline render:
        //   >15 kg → green     (16A34A) — peak growing month
        //   >10 kg → lime      (65A30D) — strong growing month
        //   > 5 kg → amber     (F59E0B) — shoulder month
        //   ≤ 5 kg → grey      (9CA3AF) — minimal/dormant
        var dataCells = monthlyN.map(function(monthData) {
            var md = monthData || {};
            var n = md.n || 0;
            var gp = md.gp || 0;
            var nColor = n > 15 ? '16A34A'
                       : n > 10 ? '65A30D'
                       : n > 5  ? 'F59E0B'
                                : '9CA3AF';

            return new TableCell({
                children: [new Paragraph({
                    alignment: AlignmentType.CENTER,
                    children: [
                        new TextRun({ text: n.toFixed(0), bold: true, size: 20, color: nColor }),
                        new TextRun({ text: '\nGP ' + Math.round(gp * 100) + '%', size: 14, color: '6B7280' })
                    ]
                })],
                width: { size: cellWidth, type: WidthType.DXA }
            });
        });

        nodes.push(new Table({
            width: { size: cellWidth * monthNames.length, type: WidthType.DXA },
            columnWidths: monthNames.map(function() { return cellWidth; }),
            rows: [
                new TableRow({ children: headerCells }),
                new TableRow({ children: dataCells })
            ]
        }));

        // Optional site-uniform caption — combined-export uses this to
        // explain why every per-sample section shows the same monthly N
        // (annual N target, monthly GP, and distribution strategy are all
        // site-level inputs; soil-driven differentiation appears in P/K/S).
        // Single-export omits it — only one sample, no asymmetry to explain.
        if (opts.siteUniformCaption) {
            var captionText = opts.siteUniformText
                || 'Distribution is site-uniform, annual N target, monthly growth potential, and distribution strategy are all site-level inputs. Per-sample differentiation appears in P/K/S requirements above.';
            nodes.push(new Paragraph({
                spacing: { before: 80, after: 120 },
                children: [new TextRun({
                    text: captionText,
                    size: 16,
                    italics: true,
                    color: '6B7280'
                })]
            }));
        }

        return nodes;
    }

    // Collect data from DOM and window state
    function collectData() {
        var data = {
            site: {},
            turf: {},
            climate: {},
            soil: {},
            tissue: {},
            water: {},
            salinity: {},   // v2.0.8: Salinity penalty data
            shade: {},
            pgr: {},
            dmi: {},
            irrigation: {},
            disease: {},
            dew: {},
            traffic: {},
            trajectory: {},
            sensor: {},
            overseedClimate: {}
        };
        
        // Defensive re-check to ensure all sub-objects exist
        // (in case any code path accidentally sets them to undefined)
        var ensureObject = function(obj, key) {
            if (!obj[key] || typeof obj[key] !== 'object') {
                obj[key] = {};
            }
        };
        
        // Site info - try multiple sources in priority order
        var locationSearch = document.getElementById('gaip-location-search');
        var locationStatus = document.getElementById('gaip-location-status');
        var latInput = document.querySelector('.gaip-lat');
        var lonInput = document.querySelector('.gaip-lon');

        // Priority 1: SampleManager active site label (most reliable — site-scoped)
        var smSiteLabel = (window.GAIP_SampleManager && typeof GAIP_SampleManager.getActiveSiteLabel === 'function')
            ? GAIP_SampleManager.getActiveSiteLabel() : null;
        if (smSiteLabel && smSiteLabel !== 'default' && smSiteLabel !== 'Default Site') {
            data.site.name = smSiteLabel;
        }

        // Priority 2: saved config location name for this site (restored by site-config-persistence)
        var activeSiteId = window.GAIP_SampleManager && window.GAIP_SampleManager.getActiveSiteId
            ? window.GAIP_SampleManager.getActiveSiteId() : null;
        var savedConfig = activeSiteId && window.GAIP_SiteConfig && window.GAIP_SiteConfig.getConfig
            ? window.GAIP_SiteConfig.getConfig(activeSiteId) : null;
        var savedLocationName = savedConfig && savedConfig.location && savedConfig.location.name
            ? savedConfig.location.name : null;

        // Priority 3: gaip-location-search input (restored by site-config-persistence on site switch)
        var searchVal = locationSearch && locationSearch.value ? locationSearch.value.trim() : null;

        // Priority 4: gaip-location-status (may be stale from previous site — use last)
        var statusVal = locationStatus && locationStatus.textContent
            ? locationStatus.textContent.replace(/^✓\s*/, '').trim() : null;

        // Build location string: saved config name > search input > status > coords
        data.site.location = savedLocationName || searchVal || statusVal
            || (latInput && lonInput && latInput.value && lonInput.value
                ? latInput.value + ', ' + lonInput.value : 'Not specified');

        // Site name: SM label > saved location name > location string
        if (!data.site.name) {
            data.site.name = savedLocationName || searchVal || data.site.location;
        }
        data.site.date = new Date().toLocaleDateString();

        // b35fix311: area (ha) of the zone this sample represents.
        // Read from the soil form input. Only set when populated so downstream
        // Purchasing Summary logic can detect "missing area" reliably.
        var areaInput = document.querySelector('.gaip-soil-area-ha');
        if (areaInput && areaInput.value) {
            var areaVal = parseFloat(areaInput.value);
            if (isFinite(areaVal) && areaVal > 0) {
                data.site.areaHa = areaVal;
            }
        }
        
        // ────────────────────────────────────────────────────────────────
        // b35fix442: turf shelf read prefers GAIP_STATE.inputs.turf.
        // ────────────────────────────────────────────────────────────────
        // Pre-fix this block read window.GAIP_STATE.turf only (the flat
        // post-analysis shelf written by hub-tissue-v3.js:6966 at
        // analysis-end). On a fresh site or any state where analysis has
        // not yet run, GAIP_STATE.turf is undefined, the entire block
        // skipped, and the b35fix438 fallback chain at line ~7236 had to
        // fire to recover turfType from the canonical controller. Worse,
        // when a user activates cotula bowls AFTER having previously run
        // analysis on a non-bowls site:
        //   1. Prior site analysis: hub-tissue-v3.js:6966 sets
        //      GAIP_STATE = { turf: {turfType:'sports'}, soil:..., ... }.
        //   2. User clicks the cotula tile. cotula-bowling-green.js:571
        //      replaces window.GAIP_STATE wholesale with
        //      { inputs: { turf: { turfType:'bowls', cotula:true, ... } } }.
        //   3. User exports docx WITHOUT re-running analysis. Pre-fix
        //      this block saw GAIP_STATE.turf as undefined and fell
        //      through to the controller (correct outcome by accident).
        //   4. User re-runs analysis. b35fix391 merge writes fresh
        //      inputs.turf onto t.turf, so GAIP_STATE.turf gets the
        //      cotula keys merged in. Correct outcome (since b35fix391).
        //   5. BUT: if anything between steps 2 and 4 partially writes
        //      to GAIP_STATE.turf (e.g. a stale snapshot from a prior
        //      run), this block reads stale 'sports' while inputs.turf
        //      carries the fresh 'bowls'. That is the held-after-b35fix390
        //      regression: live UI chips/SiteSelector/Prebble preview all
        //      read TPC.state and show 'bowls' correctly, only word-export
        //      collectData reads GAIP_STATE.turf and gets the stale value.
        //
        // The canonical writers in this codebase route through
        // GAIP_STATE.inputs.turf:
        //   - cotula-bowling-green.js:571 (b35fix388 routed write)
        //   - hub-orchestrator.js:457 (orchestrator mirror)
        //   - hub-tissue-v3.js:6960 (b35fix391 fresh-merge source)
        //   - site-switch-cleanup.js:144 (b35fix401 identity clear)
        // The flat GAIP_STATE.turf shelf is only populated by
        // hub-tissue-v3.js:6966 at analysis-end.
        //
        // Fix: read priority becomes
        //   (1) GAIP_STATE.inputs.turf, canonical, all routed writers land here
        //   (2) GAIP_STATE.turf,         flat post-analysis shelf, retained
        //                                 as fallback for any read path where
        //                                 inputs.turf is unpopulated but the
        //                                 flat shelf carries data
        // matching the same fallback shape used by cotula-bowling-green.js:568-569.
        // Downstream behaviour is identical when both shelves agree (the
        // post-b35fix391 normal case). Diverges from pre-fix only when the
        // inputs.turf shelf carries fresher data than the flat shelf,
        // which is the regression class this fix closes.
        //
        // The b35fix438 (C48) fallback chain at line ~7236 stays in place
        // as defensive third-tier fallback for the case where neither
        // inputs.turf NOR the flat shelf has turfType (e.g. controller
        // populated but no analysis run AND no cotula activation, DOM-only
        // turf-type select on a fresh site).
        //
        // Turf info - try inputs.turf first, then flat .turf shelf, then DOM
        var _b35fix442_turf = (window.GAIP_STATE && window.GAIP_STATE.inputs && window.GAIP_STATE.inputs.turf)
            || (window.GAIP_STATE && window.GAIP_STATE.turf)
            || null;
        if (_b35fix442_turf) {
            var turf = _b35fix442_turf;
            data.turf.type = turf.turfType || '';
            data.turf.rawTurfType = turf.turfType || '';  // Keep raw value for internal checks
            data.turf.subCategory = turf.subCategory || '';  // golf: greens/fairways/tees
            data.turf.species = turf.grassSpecies || '';
            data.turf.variety = turf.variety || 'generic';
            data.turf.overseedVariety = turf.overseedVariety || '';
            data.turf.construction = turf.construction || '';
            data.turf.warmBase = turf.warmBase || '';
            data.turf.coolOverseed = turf.coolOverseed || '';
            data.turf.percentC3 = turf.percentC3Cover || turf.percentC3 || 0;
            data.turf.hoc = turf.hoc || turf.heightOfCut || null;  // Height of cut
            
            // Also check for overseed species from species object or direct property
            if (turf.species && typeof turf.species === 'object') {
                // species might be an object with overseed info
                if (turf.species.overseedSpecies) {
                    data.turf.coolOverseed = turf.species.overseedSpecies;
                }
                if (turf.species.overseedVariety) {
                    data.turf.overseedVariety = turf.species.overseedVariety;
                }
            }
            
            // Try to get overseed variety from the DOM dropdown if not in state
            if (!data.turf.overseedVariety || data.turf.overseedVariety === 'generic') {
                var overseedDropdown = document.querySelector('.gaip-overseed-variety, [name="overseed_variety"], #overseedVariety');
                if (overseedDropdown && overseedDropdown.value && overseedDropdown.value !== 'generic') {
                    data.turf.overseedVariety = overseedDropdown.value;
                    // Try to get display name
                    if (overseedDropdown.selectedOptions && overseedDropdown.selectedOptions[0]) {
                        data.turf.overseedVarietyDisplay = overseedDropdown.selectedOptions[0].text;
                    }
                }
            }
            
            // Access c3/c4 fractions - check multiple possible locations
            // 1. Direct on turf object
            // 2. In turf.species object (set by hub-tissue-v3.js)
            // 3. From percentC3Cover calculation
            if (typeof turf.c3Fraction === 'number') {
                data.turf.c3Fraction = turf.c3Fraction;
                data.turf.c4Fraction = turf.c4Fraction || 0;
            } else if (turf.species && typeof turf.species === 'object' && typeof turf.species.c3Fraction === 'number') {
                data.turf.c3Fraction = turf.species.c3Fraction;
                data.turf.c4Fraction = turf.species.c4Fraction || 0;
            } else if (turf.percentC3Cover > 0) {
                // Derive from percentC3Cover
                data.turf.c3Fraction = turf.percentC3Cover / 100;
                data.turf.c4Fraction = 1 - data.turf.c3Fraction;
            } else {
                data.turf.c3Fraction = 0;
                data.turf.c4Fraction = 0;
            }
            
            // Sanity check: a pure C4 species with no overseed UI active should never
            // have c3Fraction = 1.0 — that indicates stale persisted state.
            // Check actual form value as ground truth.
            var c3FormInput = document.querySelector('.gaip-c3-cover');
            var c3FormValue = c3FormInput ? (parseFloat(c3FormInput.value) || 0) / 100 : null;
            if (c3FormValue !== null && Math.abs(c3FormValue - data.turf.c3Fraction) > 0.1) {
                // Form and state disagree by more than 10% — trust the form
                console.warn('[WordExport] c3Fraction state/form mismatch, state:', data.turf.c3Fraction, 'form:', c3FormValue, ', using form value');
                data.turf.c3Fraction = c3FormValue;
                data.turf.c4Fraction = 1 - c3FormValue;
            }
        }
        
        // Fallback to DOM if state missing turf type
        if (!data.turf.type) {
            // ────────────────────────────────────────────────────────────────
            // b35fix438 (C48): turf identity read from canonical controller
            // ────────────────────────────────────────────────────────────────
            // Pre-fix: GAIP_STATE.turf.turfType was the primary read at
            // line ~7045 above, but that shelf is never written to by the
            // site-settings panel or turf-profile-controller. The canonical
            // writer is window.GaipTurfProfile.state.turfType (set by
            // TurfProfileController.selectTurfType). Live UI top chip
            // (hub-header-bar.js:188) reads from the same canonical
            // controller path, which is why the chip displays "Sports
            // Field" while the docx renders "Not specified" — two read
            // paths, one writer, only one consumer wired correctly.
            //
            // Fallback DOM selectors below were ALSO stale:
            //   - .gaip-turf-type-option.active: retired class name, no
            //     element on page emits this in current production HTML
            //   - .gaip-turf-type: legacy select element, also retired
            // Current Site Settings panel emits .gaip-sp-turf-btn.active
            // with data-type attribute (assets/site-settings-panel.js:678).
            //
            // Post-fix priority chain (most-canonical first):
            //   1. window.GaipTurfProfile.state.turfType (controller state)
            //   2. .gaip-sp-turf-btn.active data-type (current panel DOM)
            //   3. .gaip-turf-type-option.active data-type (legacy DOM,
            //      retained as defensive fallback for older skin builds)
            //   4. .gaip-turf-type select (legacy select, retained as
            //      defensive fallback)
            //
            // Also write turf.subCategory from same controller state because
            // the docx uses turfType + subCategory together for the
            // golf-class display label (line ~7172 below). Pre-fix the
            // subCategory had its own state-read path that was likely
            // also empty for non-golf surfaces; the controller is
            // authoritative for both slots.
            var tp = (typeof window !== 'undefined') ? window.GaipTurfProfile : null;
            if (tp && tp.state && tp.state.turfType) {
                data.turf.type = tp.state.turfType;
                data.turf.rawTurfType = tp.state.turfType;
                if (tp.state.subCategory && !data.turf.subCategory) {
                    data.turf.subCategory = tp.state.subCategory;
                }
            }
            // Try current panel button (b35fix438)
            if (!data.turf.type) {
                var activeSpBtn = document.querySelector('.gaip-sp-turf-btn.active');
                if (activeSpBtn && activeSpBtn.dataset.type) {
                    data.turf.type = activeSpBtn.dataset.type;
                }
            }
            // DOM fallback for subCategory (golf greens/fairways/tees) when
            // GaipTurfProfile.state was cleared during site-switch and the
            // controller restore has set the DOM button but not yet the state.
            if (data.turf.type === 'golf' && !data.turf.subCategory) {
                var activeSubBtn = document.querySelector('.gaip-subcategory-option.active');
                if (activeSubBtn) {
                    data.turf.subCategory = activeSubBtn.dataset.surface || activeSubBtn.dataset.sport || '';
                }
            }
            // Legacy panel button (defensive, older skins)
            if (!data.turf.type) {
                var activeTurfBtn = document.querySelector('.gaip-turf-type-option.active');
                if (activeTurfBtn && activeTurfBtn.dataset.type) {
                    data.turf.type = activeTurfBtn.dataset.type;
                }
            }
            // Legacy select element
            if (!data.turf.type) {
                var turfTypeEl = document.querySelector('.gaip-turf-type');
                if (turfTypeEl) {
                    var selectedOption = turfTypeEl.options ? turfTypeEl.options[turfTypeEl.selectedIndex] : null;
                    data.turf.type = selectedOption ? selectedOption.text : (turfTypeEl.value || '');
                }
            }
        }
        
        // Fallback to DOM if state missing species
        if (!data.turf.species) {
            var speciesEl = document.querySelector('.gaip-species');
            if (speciesEl) {
                var selectedOption = speciesEl.options ? speciesEl.options[speciesEl.selectedIndex] : null;
                data.turf.species = selectedOption ? selectedOption.text : (speciesEl.value || '');
            }
        }
        
        // Format turf type nicely - combine type with subCategory for golf
        if (data.turf.type) {
            var typeMap = {
                'sports': 'Sports Field',
                'golf': 'Golf Course',
                'golf_green': 'Golf - Greens',
                'golf_greens': 'Golf - Greens',
                'golf_fairway': 'Golf - Fairways',
                'golf_fairways': 'Golf - Fairways', 
                'golf_tee': 'Golf - Tees',
                'golf_tees': 'Golf - Tees',
                'golf_rough': 'Golf - Rough',
                'lawns': 'Lawns',
                'lawn': 'Lawn',
                'residential': 'Residential Lawn',
                'commercial': 'Commercial',
                // b35fix392: bowls/cotula label coverage. Pre-fix the typeMap had
                // no bowls entry, so cotula bowls reports rendered the raw lowercase
                // value `Turf Type: bowls` in Site Information. Five keys map to the
                // same display label — same coverage shape as b35fix390's
                // extractTurfIntentKey mapping (bowls / bowling / bowling_green /
                // bowling_greens — handles any writer that puts the long form into
                // turfType). 'cotula_bowling_green' is the surfaceType value emitted
                // by cotula-bowling-green.js:575; covered defensively in case a
                // future read path falls back to surfaceType through this map.
                'bowls': 'Bowling Greens',
                'bowls_': 'Bowling Greens',
                'bowling': 'Bowling Greens',
                'bowling_green': 'Bowling Greens',
                'bowling_greens': 'Bowling Greens',
                'cotula_bowling_green': 'Bowling Greens'
            };
            
            // If turfType is 'golf' and we have a subCategory, combine them
            if (data.turf.type === 'golf' && data.turf.subCategory) {
                var subCatLabel = {
                    'greens': 'Golf - Greens',
                    'green': 'Golf - Greens',
                    'fairways': 'Golf - Fairways',
                    'fairway': 'Golf - Fairways',
                    'tees': 'Golf - Tees',
                    'tee': 'Golf - Tees',
                    'rough': 'Golf - Rough'
                };
                data.turf.type = subCatLabel[data.turf.subCategory] || ('Golf - ' + data.turf.subCategory.charAt(0).toUpperCase() + data.turf.subCategory.slice(1));
            } else {
                data.turf.type = typeMap[data.turf.type] || data.turf.type;
            }
        }
        
        // Determine if C4 (warm-season) grass
        var speciesLower = (data.turf.species || '').toLowerCase();
        var isC4 = speciesLower.indexOf('couch') > -1 || 
                   speciesLower.indexOf('bermuda') > -1 ||
                   speciesLower.indexOf('kikuyu') > -1 ||
                   speciesLower.indexOf('zoysia') > -1 ||
                   speciesLower.indexOf('buffalo') > -1 ||
                   speciesLower.indexOf('paspalum') > -1 ||
                   speciesLower.indexOf('seashore') > -1;
        
        // Check for active overseed - multiple detection methods:
        // 1. Explicit warmBase/coolOverseed fields differ (both must be non-empty)
        // 2. C4 base species with significant C3 fraction (implies overseed)
        var hasExplicitOverseed = data.turf.warmBase && data.turf.warmBase.length > 0 && 
                                  data.turf.coolOverseed && data.turf.coolOverseed.length > 0 &&
                                  data.turf.warmBase !== data.turf.coolOverseed;
        // Only infer overseed if C4 base, C3 fraction is significant, AND the overseed
        // UI toggle is actually enabled — prevents stale state from triggering ryegrass fallbacks
        var overseedToggle = document.querySelector('.gaip-enable-overseed, [data-overseed-active]');
        var overseedUIActive = overseedToggle ? (overseedToggle.checked || overseedToggle.getAttribute('data-overseed-active') === 'true') : false;
        // Also check GAIP_STATE directly for overseed flag
        var overseedStateActive = !!(window.GAIP_STATE && window.GAIP_STATE.turf && 
            (window.GAIP_STATE.turf.overseedActive || window.GAIP_STATE.turf.hasOverseed));
        var hasInferredOverseed = isC4 && data.turf.c3Fraction >= 0.2 && (overseedUIActive || overseedStateActive);
        var hasOverseed = hasExplicitOverseed || hasInferredOverseed;
        
        // If we detected overseed via fraction but don't have explicit species names, infer them
        if (hasOverseed && (!data.turf.warmBase || data.turf.warmBase.length === 0)) {
            // Get the base species - use grassSpecies from state or infer from species string
            data.turf.warmBase = data.turf.species || 'Couch';
            // Include base variety if available
            if (data.turf.variety && data.turf.variety !== 'generic') {
                data.turf.warmBaseWithVariety = data.turf.warmBase + ' (' + data.turf.variety + ')';
            } else {
                data.turf.warmBaseWithVariety = data.turf.warmBase;
            }
        }
        
        if (hasOverseed && (!data.turf.coolOverseed || data.turf.coolOverseed.length === 0)) {
            // Only infer coolOverseed name when there genuinely is an overseed
            // For pure C4 with no overseed, hasInferredOverseed should be false
            data.turf.coolOverseed = hasExplicitOverseed ? 'Perennial Ryegrass' : '';
        }
        
        // Try to get overseed variety from climate module result (it shows the selected overseed)
        if (hasOverseed && (!data.turf.overseedVariety || data.turf.overseedVariety === 'generic')) {
            // Check climate module result for variety info
            var climateResult = window.GAIP_CLIMATE_V2_RESULT;
            if (climateResult && climateResult.overseedVariety) {
                data.turf.overseedVariety = climateResult.overseedVariety;
            }
            // Also try the variety dropdown directly
            var varietyDropdown = document.querySelector('.gaip-variety-select, #gaip-variety');
            if (varietyDropdown && varietyDropdown.value && varietyDropdown.value !== 'generic') {
                // This might be the overseed variety when in overseed mode
                if (isC4 && data.turf.c3Fraction >= 0.5) {
                    data.turf.overseedVariety = varietyDropdown.value;
                    if (varietyDropdown.selectedOptions && varietyDropdown.selectedOptions[0]) {
                        data.turf.overseedVarietyDisplay = varietyDropdown.selectedOptions[0].text;
                    }
                }
            }
        }
        
        // CRITICAL: When C3 overseed is dominant (>50%), treat the entire surface as C3
        // This affects ALL agronomic decisions - soil pH targets, tissue ranges, 
        // water quality impacts, shade thresholds, disease risks, etc.
        var overseedDominant = hasOverseed && data.turf.c3Fraction >= 0.5;
        var useC3Targets = hasOverseed && data.turf.c3Fraction > 0.2;

        data.turf.isC4 = isC4;
        data.turf.hasOverseed = hasOverseed;
        data.turf.useC3Targets = useC3Targets;
        data.turf.overseedDominant = overseedDominant;
        
        // Set the EFFECTIVE species for agronomic decisions
        // When overseed is dominant, all recommendations should be for the overseed species
        if (overseedDominant) {
            data.turf.effectiveSpecies = data.turf.coolOverseed || 'Perennial Ryegrass';
            data.turf.effectiveVariety = data.turf.overseedVariety || 'generic';
            data.turf.effectiveIsC4 = false; // C3 overseed is dominant
            data.turf.effectiveSpeciesNote = 'Management focus: ' + data.turf.effectiveSpecies + 
                ' (' + Math.round(data.turf.c3Fraction * 100) + '% cover)';
        } else if (hasOverseed && useC3Targets) {
            // Mixed sward - C3 needs protection but not fully dominant
            data.turf.effectiveSpecies = data.turf.coolOverseed || 'Perennial Ryegrass';
            data.turf.effectiveVariety = data.turf.overseedVariety || 'generic';
            data.turf.effectiveIsC4 = false;
            data.turf.effectiveSpeciesNote = 'Mixed sward - C3 overseed requires priority management';
        } else {
            data.turf.effectiveSpecies = data.turf.species || data.turf.warmBase || 'Not specified';
            data.turf.effectiveVariety = data.turf.variety || 'generic';
            data.turf.effectiveIsC4 = isC4;
            data.turf.effectiveSpeciesNote = null;
        }
        
        // Build species display string for site info
        if (overseedDominant) {
            // When overseed dominant, lead with the overseed species
            var overseedDisplay = data.turf.coolOverseed;
            if (data.turf.overseedVariety && data.turf.overseedVariety !== 'generic') {
                overseedDisplay += ' (' + data.turf.overseedVariety + ')';
            }
            data.turf.speciesDisplay = overseedDisplay + ' - ' + Math.round(data.turf.c3Fraction * 100) + '% cover';
            // Use warmBaseWithVariety if available, otherwise just warmBase
            var baseDisplay = data.turf.warmBaseWithVariety || data.turf.warmBase || data.turf.species || 'C4 base';
            data.turf.speciesDisplay += ' (base: ' + baseDisplay + ')';
        } else if (hasOverseed) {
            var overseedDisplay = data.turf.coolOverseed;
            if (data.turf.overseedVariety && data.turf.overseedVariety !== 'generic') {
                overseedDisplay += ' - ' + data.turf.overseedVariety;
            }
            var baseDisplay = data.turf.warmBaseWithVariety || data.turf.warmBase || data.turf.species;
            data.turf.speciesDisplay = baseDisplay + ' (overseeded: ' + overseedDisplay + ')';
            if (data.turf.percentC3 !== undefined && data.turf.percentC3 > 0) {
                data.turf.speciesDisplay += ' - ' + data.turf.percentC3 + '% C3';
            }
        } else {
            data.turf.speciesDisplay = data.turf.species || 'Not specified';
        }
        
        // Climate from window.climateMetrics or state.climateMetrics
        var cm = window.climateMetrics || (window.GAIP_STATE ? window.GAIP_STATE.climateMetrics : null);
        if (cm) {
            data.climate.temperature = cm.temperature ? cm.temperature.mean : null;
            
            // Use species-appropriate growth potential
            if (cm.growth) {
                // For overseed situations, always capture both C3 and C4 GP
                if (hasOverseed) {
                    // Mixed sward / overseed - show both values
                    data.climate.c3Growth = cm.growth.c3;
                    data.climate.c4Growth = cm.growth.c4;
                    data.climate.growthPotential = cm.growth.weighted;
                    data.climate.showBothGP = true;
                } else if (isC4) {
                    // Pure C4
                    data.climate.growthPotential = cm.growth.c4 || cm.growth.weighted;
                    data.climate.gpLabel = 'C4';
                } else {
                    // Pure C3
                    data.climate.growthPotential = cm.growth.c3 || cm.growth.weighted;
                    data.climate.gpLabel = 'C3';
                }
                data.climate.status = cm.growth.status || null;
            }
            
            if (cm.stress) {
                data.climate.heatStress = cm.stress.heatDays ? cm.stress.heatDays + ' days >30°C' : 'None';
                data.climate.coldStress = cm.stress.coldDays ? cm.stress.coldDays + ' days <10°C' : 'None';
            }
            
        }
        
        // Shade from results - use species-appropriate DLI targets
        var shadeData = (window.GAIP_STATE && window.GAIP_STATE.shadeMetrics) || 
                        window.shadeMetrics;
        if (shadeData) {
            // Current DLI
            data.shade.currentDLI = shadeData.DLI_adj || shadeData.DLI_total || shadeData.dliShaded || shadeData.currentDLI;
            
            // For overseed, use C3 targets (the overseed needs protecting)
            // For pure stands, use species-appropriate targets
            if (useC3Targets) {
                // Overseed active - use C3 targets since ryegrass needs more light protection
                data.shade.targetDLI = shadeData.c3Opt || 18;
                data.shade.minDLI = shadeData.c3Min || 12;
                data.shade.status = shadeData.c3Status || shadeData.status;
                data.shade.dliMode = 'overseed';
                // Also capture C4 targets for reference
                data.shade.c4TargetDLI = shadeData.c4Opt || 30;
                data.shade.c4MinDLI = shadeData.c4Min || 24;
            } else if (data.turf.isC4) {
                data.shade.targetDLI = shadeData.c4Opt || shadeData.targetDLI;
                data.shade.minDLI = shadeData.c4Min;
                data.shade.status = shadeData.c4Status || shadeData.status;
                data.shade.dliMode = 'c4';
            } else {
                data.shade.targetDLI = shadeData.c3Opt || shadeData.targetDLI;
                data.shade.minDLI = shadeData.c3Min;
                data.shade.status = shadeData.c3Status || shadeData.status;
                data.shade.dliMode = 'c3';
            }
            
            data.shade.transmission = shadeData.shadeFactor ? Math.round(shadeData.shadeFactor * 100) : 
                                      (shadeData.transmissionFactor ? Math.round(shadeData.transmissionFactor * 100) : 
                                      (shadeData.transmission || null));
            
            // Calculate deficit if we have current and target
            if (data.shade.currentDLI && data.shade.targetDLI) {
                var deficit = ((data.shade.targetDLI - data.shade.currentDLI) / data.shade.targetDLI * 100);
                data.shade.deficit = deficit > 0 ? Math.round(deficit) : 0;
            }
            
        }
        
        // Soil data (MLSN/SLAN results)
        if (window.GAIP_STATE) {
            ensureObject(data, 'soil');  // Ensure soil object exists
            var soilInput = window.GAIP_STATE.soil;
            var mlsnResults = window.GAIP_STATE.mlsnResults;
            
            // Capture sample identification metadata
            // Priority: SampleManager active sample > manual DOM input > empty
            var activeSoilSample = (window.GAIP_SampleManager && typeof GAIP_SampleManager.getActiveSample === 'function') 
                ? GAIP_SampleManager.getActiveSample('soil') : null;
            var soilLabelEl = document.querySelector('.gaip-soil-sample-label');
            var soilLabRefEl = document.querySelector('.gaip-soil-lab-ref');
            var soilDateEl = document.querySelector('.gaip-soil-date');
            // Prefer DOM label input (shows human zone name), fall back to sample.label
            // humanize: strip generated ID hash suffix (Soil_1_3cbn -> Soil 1)
            var _rawSoilLabel = (soilLabelEl && soilLabelEl.value && soilLabelEl.value.trim())
                ? soilLabelEl.value.trim()
                : (activeSoilSample && activeSoilSample.label) ? activeSoilSample.label : '';
            // Detect generated ID pattern: Word_N_XXXX (4-char alphanumeric suffix)
            var _soilLabelCleaned = _rawSoilLabel.replace(/^([A-Za-z]+)_(\d+)_[A-Za-z0-9]{4}$/, function(m, type, num) {
                return type.charAt(0).toUpperCase() + type.slice(1).toLowerCase() + ' ' + num;
            });
            data.soil.sampleLabel = _soilLabelCleaned || _rawSoilLabel;
            data.soil.labRef = (soilLabRefEl && soilLabRefEl.value) ? soilLabRefEl.value.trim() : '';
            data.soil.testDate = (activeSoilSample && activeSoilSample.date) ? activeSoilSample.date :
                (soilDateEl && soilDateEl.value) ? soilDateEl.value : '';


            // Capture methodology (MLSN or SLAN)
            if (soilInput && soilInput.methodology) {
                data.soil.methodology = soilInput.methodology.toUpperCase();
            } else {
                // Try to detect from DOM
                var methodEl = document.querySelector('.gaip-soil-methodology, [name="soil_methodology"]');
                if (methodEl) {
                    data.soil.methodology = (methodEl.value || 'MLSN').toUpperCase();
                } else {
                    data.soil.methodology = 'MLSN';  // Default
                }
            }
            
            // Capture extraction method
            var extractantEl = document.querySelector('.gaip-soil-extractant');
            if (extractantEl && extractantEl.value) {
                data.soil.extractant = extractantEl.value;
                data.soil.extractantLabel = extractantEl.options[extractantEl.selectedIndex]?.text || extractantEl.value;
            } else if (window.gaip_getExtractantMethod) {
                data.soil.extractant = window.gaip_getExtractantMethod();
            }
            
            // Capture extractant warning if applicable
            if (window.gaip_getExtractantWarning) {
                data.soil.extractantWarning = window.gaip_getExtractantWarning();
            }
            
            if (soilInput && soilInput.ppm) {
                data.soil.P = soilInput.ppm.P;
                data.soil.K = soilInput.ppm.K;
                data.soil.Ca = soilInput.ppm.Ca;
                data.soil.Mg = soilInput.ppm.Mg;
                data.soil.S = soilInput.ppm.S;
                data.soil.pH = soilInput.pH_water;
                data.soil.Na = soilInput.ppm.Na;

                // b35fix415: clean read of CEC/EC/OM from active sample's
                // rawData. Six builds (b35fix409-414) chasing this through
                // helpers, migrations, and proxy reads all failed in
                // production despite passing unit tests. Console probe of
                // every active sample confirms rawData carries canonical
                // CEC/EC/OM. Read directly from there with no intermediary.
                //
                // PHP parser writes both canonical short keys (CEC, EC, OM)
                // and verbose synonyms (CEC_meq100g, EC1_5, OM_Percent). Try
                // canonical first, fall back to synonyms.
                var _activeSample = (window.GAIP_SampleManager && typeof GAIP_SampleManager.getActiveSample === 'function')
                    ? GAIP_SampleManager.getActiveSample('soil') : null;
                var _raw = (_activeSample && _activeSample.rawData) || null;
                if (_raw) {
                    var _cec = _raw.CEC != null ? parseFloat(_raw.CEC)
                             : _raw.CEC_meq100g != null ? parseFloat(_raw.CEC_meq100g)
                             : null;
                    if (_cec != null && !isNaN(_cec)) data.soil.CEC = _cec;

                    var _ec = _raw.EC != null ? parseFloat(_raw.EC)
                            : _raw.EC1_5 != null ? parseFloat(_raw.EC1_5)
                            : null;
                    if (_ec != null && !isNaN(_ec)) data.soil.EC = _ec;

                    var _om = _raw.OM != null ? parseFloat(_raw.OM)
                            : _raw.OM_Percent != null ? parseFloat(_raw.OM_Percent)
                            : null;
                    if (_om != null && !isNaN(_om)) data.soil.OM = _om;

                    // b35fix427 (C34): measured ESP read from rawData if the
                    // lab returned one. Estimation from Na+CEC happens AFTER
                    // both DOM-fallback and canonical-state paths have run
                    // (see post-DOM-fallback block below) so it works on
                    // either path. Pre-fix this whole block was inside the
                    // `if (_raw)` gate which never fired on Rockingham
                    // production export — the export went through the DOM
                    // fallback path. Moved out to ensure ESP is always
                    // attempted regardless of which population path ran.
                    if (_raw.ESP != null) {
                        var _measuredESP = parseFloat(_raw.ESP);
                        if (!isNaN(_measuredESP)) {
                            data.soil.ESP = +_measuredESP.toFixed(1);
                            data.soil._espSource = 'measured';
                        }
                    }
                }

                // Final fallback: DOM input values, in case the active sample
                // has no rawData (e.g. user typed values manually without
                // saving to a sample). Only fires when rawData read above
                // didn't populate.
                if (data.soil.CEC == null) {
                    var _cecEl = document.querySelector('.gaip-cec');
                    if (_cecEl && _cecEl.value) {
                        var _cd = parseFloat(_cecEl.value);
                        if (!isNaN(_cd)) data.soil.CEC = _cd;
                    }
                }
                if (data.soil.EC == null) {
                    var _ecEl = document.querySelector('.gaip-soil-ec');
                    if (_ecEl && _ecEl.value) {
                        var _ed = parseFloat(_ecEl.value);
                        if (!isNaN(_ed)) data.soil.EC = _ed;
                    }
                }
                if (data.soil.OM == null) {
                    var _omEl = document.querySelector('.gaip-loi');
                    if (_omEl && _omEl.value) {
                        var _od = parseFloat(_omEl.value);
                        if (!isNaN(_od)) data.soil.OM = _od;
                    }
                }

                // Set hasData flag if we have any nutrient values
                if (data.soil.P || data.soil.K || data.soil.Ca || data.soil.Mg) {
                    data.soil.hasData = true;
                }
            }

            // b35fix372: read area from sample.rawData.areaHa (set by bulk area
            // modal via SampleManager.updateSample) and copy to data.soil.areaHa
            // so Zone Comparison table can access it. Without this, the bulk area
            // modal stores area values correctly but they don't flow through to
            // the combined export table — appears as em-dash in every row.
            if (activeSoilSample && activeSoilSample.rawData && activeSoilSample.rawData.areaHa != null) {
                data.soil.areaHa = activeSoilSample.rawData.areaHa;
            }

            // Always read trace elements (Fe/Mn/Zn/Cu/B) directly from DOM inputs —
            // GAIP_STATE.soil.ppm does not carry traces so they are never in canonical state.
            // This runs regardless of hasData so it works for all samples in combined export.
            var traceSelectors = { Fe: '[data-mlsn="Fe"]', Mn: '[data-mlsn="Mn"]', Zn: '[data-mlsn="Zn"]', Cu: '[data-mlsn="Cu"]', B: '[data-mlsn="B"]' };
            Object.keys(traceSelectors).forEach(function(t) {
                var el = document.querySelector(traceSelectors[t]);
                if (el && el.value && !isNaN(parseFloat(el.value))) {
                    data.soil[t] = parseFloat(el.value);
                }
            });
            
            // DOM fallback - read from input fields if GAIP_STATE didn't have ppm data
            if (!data.soil.hasData) {
                
                // Try various input field naming conventions
                var soilFieldMappings = [
                    // Format: [data property, [possible input selectors]]
                    // Primary: data-mlsn attributes (used by actual UI inputs)
                    ['P', ['[data-mlsn="P"]', '#gaip_soil_P', '#soil_P', '[name="soil_P"]', '.gaip-soil-P', '#P_ppm', '[data-nutrient="P"]']],
                    ['K', ['[data-mlsn="K"]', '#gaip_soil_K', '#soil_K', '[name="soil_K"]', '.gaip-soil-K', '#K_ppm', '[data-nutrient="K"]']],
                    ['Ca', ['[data-mlsn="Ca"]', '#gaip_soil_Ca', '#soil_Ca', '[name="soil_Ca"]', '.gaip-soil-Ca', '#Ca_ppm', '[data-nutrient="Ca"]']],
                    ['Mg', ['[data-mlsn="Mg"]', '#gaip_soil_Mg', '#soil_Mg', '[name="soil_Mg"]', '.gaip-soil-Mg', '#Mg_ppm', '[data-nutrient="Mg"]']],
                    ['S', ['[data-mlsn="S"]', '#gaip_soil_S', '#soil_S', '[name="soil_S"]', '.gaip-soil-S', '#S_ppm', '[data-nutrient="S"]']],
                    ['Fe', ['[data-mlsn="Fe"]', '#gaip_soil_Fe', '#soil_Fe', '[name="soil_Fe"]', '.gaip-soil-Fe', '#Fe_ppm', '[data-nutrient="Fe"]']],
                    ['Mn', ['[data-mlsn="Mn"]', '#gaip_soil_Mn', '#soil_Mn', '[name="soil_Mn"]', '.gaip-soil-Mn', '#Mn_ppm', '[data-nutrient="Mn"]']],
                    ['Cu', ['[data-mlsn="Cu"]', '#gaip_soil_Cu', '#soil_Cu', '[name="soil_Cu"]', '.gaip-soil-Cu', '#Cu_ppm', '[data-nutrient="Cu"]']],
                    ['Zn', ['[data-mlsn="Zn"]', '#gaip_soil_Zn', '#soil_Zn', '[name="soil_Zn"]', '.gaip-soil-Zn', '#Zn_ppm', '[data-nutrient="Zn"]']],
                    ['pH', ['.gaip-soil-ph', '#gaip_soil_pH', '#soil_pH', '[name="soil_pH"]', '.gaip-soil-pH', '#pH_water']],
                    // b35fix409 (C3+C5): added `.gaip-loi` (the actual UI
                    // selector per sample-manager.js SOIL_FIELD_MAP). The
                    // pre-fix list of `#gaip_soil_OM`, `#soil_OM`,
                    // `[name="soil_OM"]`, `.gaip-soil-OM`, `#organic_matter`
                    // does not match any element rendered by the plugin's
                    // own UI, so this DOM fallback never produced a value.
                    ['OM', ['.gaip-loi', '#gaip_soil_OM', '#soil_OM', '[name="soil_OM"]', '.gaip-soil-OM', '#organic_matter']],
                    // b35fix416: added `.gaip-cec` and `.gaip-soil-ec` to the
                    // CEC and EC entries. The pre-fix CEC list never matched
                    // the actual UI element (`.gaip-cec`); EC had no entry
                    // at all in soilFieldMappings, so the DOM fallback
                    // never produced CEC or EC values for combined export
                    // per-zone iteration. This was the root cause of the
                    // b35fix409-415 saga: `soilInput.ppm` is null during
                    // per-zone iteration in combined export (loadSample
                    // doesn't fully populate the proxy chain), so the
                    // entire `if (soilInput && soilInput.ppm)` block at
                    // line 6494 is skipped, and the DOM fallback below is
                    // the actual code path that runs. CEC and EC fields
                    // weren't covered by the right selectors.
                    ['CEC', ['.gaip-cec', '#gaip_soil_CEC', '#soil_CEC', '[name="soil_CEC"]', '.gaip-soil-CEC']],
                    ['EC', ['.gaip-soil-ec', '#gaip_soil_EC', '#soil_EC', '[name="soil_EC"]', '.gaip-soil-EC']],
                    ['Na', ['[data-mlsn="Na"]', '#gaip_soil_Na', '#soil_Na', '[name="soil_Na"]', '.gaip-soil-Na', '#Na_ppm', '[data-nutrient="Na"]']]
                ];
                
                soilFieldMappings.forEach(function(mapping) {
                    var prop = mapping[0];
                    var selectors = mapping[1];
                    for (var i = 0; i < selectors.length; i++) {
                        var el = document.querySelector(selectors[i]);
                        if (el && el.value && !isNaN(parseFloat(el.value))) {
                            data.soil[prop] = parseFloat(el.value);
                            break;
                        }
                    }
                });
                
                // Check if we got any data from DOM
                if (data.soil.P || data.soil.K || data.soil.Ca || data.soil.Mg) {
                    data.soil.hasData = true;
                }
            }

            // ────────────────────────────────────────────────────────────────
            // b35fix427b (C34 follow-up): path-independent ESP estimation.
            // ────────────────────────────────────────────────────────────────
            // Pre-b35fix427b this block lived inside the `if (_raw)` gate which
            // depends on GAIP_SampleManager.getActiveSample('soil') returning
            // a sample with rawData. On Rockingham 16th green production
            // verification (b35fix427 first deploy) the ESP block didn't fire
            // because the export went through the DOM-fallback path, not the
            // canonical-state path — `_raw` was null, the inner block was
            // skipped, `data.soil.ESP` stayed undefined, and Ca gypsum
            // practical rendered at 63 kg/ha (normal-soil 0.60) instead of
            // 94.5 kg/ha (saline 0.40). Same b35fix427 same day saw two
            // production verifications in sequence; this is the second.
            //
            // Moved out of the gate so it runs after both population paths
            // complete. Reads `data.soil.Na` and `data.soil.CEC` whichever
            // way they got there. Measured ESP from rawData (if present) was
            // already attached above and takes precedence — only estimates
            // when ESP is still null at this point.
            //
            // ESP% = (Na meq/100g) / (CEC meq/100g) × 100
            //      = (Na_ppm / 230) / CEC × 100
            //      = Na_ppm / (CEC × 2.3)
            // Sources: USDA Handbook 60 (Salinity Laboratory),
            //          Carrow & Duncan 2011 ch. 7.
            //
            // Mathematical equivalence note: this is the same value the
            // Cation Balance section computes as Na_sat (Na base saturation),
            // because ESP and Na base saturation on the CEC are the same
            // metric expressed two ways. Confirmed at Rockingham: report
            // showed Na_sat 18.8% from Cation Balance; ESP from this block
            // would compute Na_ppm / (CEC × 2.3) = same number. Both
            // displays now consistent.
            if (data.soil.ESP == null || isNaN(data.soil.ESP)) {
                var _naForESP = parseFloat(data.soil.Na);
                if (data.soil.CEC != null && !isNaN(data.soil.CEC) &&
                        _naForESP != null && !isNaN(_naForESP) && data.soil.CEC > 0) {
                    var _esp = _naForESP / (data.soil.CEC * 2.3);
                    // Clamp to physical range [0, 100].
                    if (_esp < 0) _esp = 0;
                    if (_esp > 100) _esp = 100;
                    data.soil.ESP = +_esp.toFixed(1);
                    data.soil._espSource = 'estimated-Na-CEC';
                }
            }

            // Add MLSN/SLAN/Ammonium Acetate thresholds for charting
            if (data.soil.methodology === 'SLAN') {
                // b35fix325: SLAN ranges sourced from GilbaClassificationConstants
                // .SLAN_RANGES.
                // b35fix333: source corrected from fabricated "Throssell USGA 2009"
                // to actual published Carrow et al. (2004) GCM 72(1):194-198. See
                // gaip-classification-constants.js for the full provenance trail.
                // Numbers shifted: P 25-50→27-54, K 75-150→75-176, Ca 500-1000→500-750,
                // Mg 60-200→70-140, S 12-30→15-40 (Option 1, single ranges set,
                // "other soils" / high-CEC values).
                //
                // Defensive fallback to Carrow 2004 values inline if the constants
                // module hasn't loaded — keeps the export runnable in degraded
                // environments rather than emitting a wrong-shape thresholds object.
                var _gccSlan = (typeof window !== 'undefined' &&
                                window.GilbaClassificationConstants &&
                                window.GilbaClassificationConstants.SLAN_RANGES) || null;
                var _slanRanges = _gccSlan || {
                    P:  { floor: 27,  ceiling: 54  },
                    K:  { floor: 75,  ceiling: 176 },
                    Ca: { floor: 500, ceiling: 750 },
                    Mg: { floor: 70,  ceiling: 140 },
                    S:  { floor: 15,  ceiling: 40  }
                };
                // ────────────────────────────────────────────────────────────
                // b35fix426 (C32): P pH-adjusted SLAN floor SSOT
                // ────────────────────────────────────────────────────────────
                // Pre-fix: P SLAN threshold here was the static Carrow 2004
                // floor (27 ppm). The requirements engine
                // (`nutrition-requirement-engine.js calculateNutrientRequirement`)
                // applies a pH-adjustment via `getSlanTargetP(pH)` per the
                // b35fix334 ladder (45/36/27/41/51 at pH bands), but that
                // adjustment was NOT propagated to `data.soil.thresholds.P.min`
                // here — so the amendments-table renderer and
                // `_computeAmendmentDecision` saw an unadjusted floor while
                // the requirements engine saw the pH-adjusted one. Asymmetric
                // engines.
                //
                // Production evidence (Rockingham 16th green b35fix425 verification):
                //   pH 8.5, P measured 20 ppm.
                //   Requirements engine: floor = getSlanTargetP(8.5) = 51 ppm
                //                        → status = Deficient, deficit = 31 ppm
                //   Amendments table:    floor = 27 (static)
                //                        → deficit = 7 ppm = 9.8 kg/ha → 25.9% Moderate Apply
                //   Two engines reading different P deficits at the same site.
                //   Post-fix: amendments table sees floor 51 → deficit 31 ppm =
                //   43.4 kg/ha → 60.8% Severe Apply with site-attention warning.
                //
                // Source: same b35fix334 ladder used by the requirements engine
                // (`getSlanTargetP`). The function is exposed at
                // `window.NutritionRequirementEngine_Pure._getSlanTargetP` —
                // call it if available, fall through to the static floor as
                // defensive degradation.
                var _pFloor = _slanRanges.P.floor;
                var _pHForSlanP = (soilInput && soilInput.pH_water) ||
                                  (data.soil && data.soil.pH) ||
                                  null;
                if (typeof window !== 'undefined' &&
                        window.NutritionRequirementEngine_Pure &&
                        typeof window.NutritionRequirementEngine_Pure._getSlanTargetP === 'function' &&
                        _pHForSlanP != null && !isNaN(_pHForSlanP)) {
                    _pFloor = window.NutritionRequirementEngine_Pure._getSlanTargetP(parseFloat(_pHForSlanP));
                }
                data.soil.thresholds = {
                    P:  { min: _pFloor,              max: _slanRanges.P.ceiling,
                          label: _pFloor + '-' + _slanRanges.P.ceiling +
                                 (_pFloor !== _slanRanges.P.floor ? ' (pH-adjusted)' : '') },
                    K:  { min: _slanRanges.K.floor,  max: _slanRanges.K.ceiling,
                          label: _slanRanges.K.floor + '-' + _slanRanges.K.ceiling },
                    Ca: { min: _slanRanges.Ca.floor, max: _slanRanges.Ca.ceiling,
                          label: _slanRanges.Ca.floor + '-' + _slanRanges.Ca.ceiling },
                    Mg: { min: _slanRanges.Mg.floor, max: _slanRanges.Mg.ceiling,
                          label: _slanRanges.Mg.floor + '-' + _slanRanges.Mg.ceiling },
                    S:  { min: _slanRanges.S.floor,  max: _slanRanges.S.ceiling,
                          label: _slanRanges.S.floor + '-' + _slanRanges.S.ceiling }
                };
            } else if (data.soil.methodology === 'AMMONIUM_ACETATE' || data.soil.methodology === 'AMMONIUM ACETATE') {
                // ────────────────────────────────────────────────────────────
                // b35fix437 (C46/C47): Hill Labs sample-type-conditional thresholds
                // ────────────────────────────────────────────────────────────
                // Pre-fix: texture-conditional ranges (sands/others) sourced from
                // legacy `assets/ammonium-acetate-methodology.js AMMONIUM_ACETATE_RANGES`.
                // Those ranges (e.g. Mg sands 100-200 / others 140-250 ppm) do NOT
                // match what Hill Labs prints on turf certificates. Verified against
                // Hagley Oval cert 4169173 (S277, Mg medium 0.30-0.70 me/100g =
                // 37-85 ppm, ~3× narrower than the legacy "sands" range) and Luke
                // Greenlees cert 3793159 (S81, Mg medium 4.0-15.0 %BS, different axis).
                //
                // Post-fix: read from the sample-type SSOT (`assets/hill-labs-sample-types.js`)
                // keyed on the certificate's printed sample type code. Threshold
                // schema extended with `unit` and `axis` fields per nutrient to
                // support the dual-axis reality: S277 reports cations in absolute
                // me/100g; S81 reports cations in proportion %BS. Amendment math
                // in `_computeAmendmentDecision` routes by axis (see b35fix437
                // C47 changes there for the proportion-axis CEC plumbing).
                //
                // Sample type code source priority:
                //   1. soilInput.aaSampleType (caller-provided, canonical)
                //   2. DOM .gaip-aa-sample-type input value
                //   3. Default to S277 (most-common turf code; matches sand-rootzone
                //      perennial ryegrass which dominates the GAIP NZ client base)
                //
                // Citation: each S-code entry in HillLabsSampleTypes.SAMPLE_TYPES
                // carries its sourceCitation field (certificate lab number + date).

                var aaSampleType = null;
                if (soilInput && soilInput.aaSampleType) {
                    aaSampleType = String(soilInput.aaSampleType).toUpperCase();
                } else {
                    var aaCodeEl = document.querySelector('.gaip-aa-sample-type');
                    if (aaCodeEl && aaCodeEl.value) {
                        aaSampleType = String(aaCodeEl.value).toUpperCase();
                    }
                }
                if (!aaSampleType) aaSampleType = 'S277';

                var hlSSOT = (typeof window !== 'undefined') ? window.HillLabsSampleTypes : null;
                var aaRanges = hlSSOT && typeof hlSSOT.getRanges === 'function'
                    ? hlSSOT.getRanges(aaSampleType)
                    : null;

                // Defensive fallback for cotula (S78 delegates to cotula module)
                // and unknown codes (warn and fall back to S277).
                if (!aaRanges || !aaRanges.thresholds) {
                    if (aaRanges && aaRanges.delegatedTo) {
                        // S78 cotula path: cotula module owns thresholds for v1.
                        // Don't overwrite — cotula-bowling-green.js sets them.
                    } else {
                        if (typeof console !== 'undefined' && console.warn) {
                            console.warn('[WordExport b35fix437] Unknown Hill Labs sample type:',
                                aaSampleType, ', falling back to S277. Add code to assets/hill-labs-sample-types.js.');
                        }
                        aaRanges = hlSSOT ? hlSSOT.getRanges('S277') : null;
                        aaSampleType = 'S277';
                    }
                }

                // Preserve legacy aaSoilTexture metadata for backward compat
                // (downstream readers may still consult it; the SSOT supersedes
                // it as the threshold-selection axis but the texture hint is
                // still useful diagnostic info).
                var aaSoilTexture = 'others';
                var aaTextureEl = document.querySelector('.gaip-aa-soil-texture');
                if (aaTextureEl && aaTextureEl.value) {
                    aaSoilTexture = aaTextureEl.value;
                } else if (soilInput && soilInput.aaSoilTexture) {
                    aaSoilTexture = soilInput.aaSoilTexture;
                }

                data.soil.extractant = 'Olsen P + NH₄OAc (pH 8.1)';
                data.soil.extractantLabel = 'Hill Labs NZ Method';
                data.soil.aaSoilTexture = aaSoilTexture;
                data.soil.aaSampleType = aaSampleType;
                data.soil.aaSampleTypeLabel = aaRanges ? aaRanges.label : aaSampleType;

                if (aaRanges && aaRanges.thresholds) {
                    // Shallow-clone the SSOT thresholds into data.soil.thresholds.
                    // Renderer + amendment math read from this object; SSOT is the
                    // authority but we don't want downstream mutation to leak back.
                    //
                    // ────────────────────────────────────────────────────────────
                    // b35fix441 / C46: cation threshold unit normalization
                    // ────────────────────────────────────────────────────────────
                    // Pre-fix the SSOT thresholds were cloned verbatim. K, Ca, Mg
                    // (and Na where present) ship with unit='me/100g' on the
                    // S277 axis (Hill Labs cert-native units). Downstream
                    // amendment math at _buildAmendmentDecisions / _computeDeficits
                    // / buildAnnualSoilAmendmentsTable reads `data.soil.K` etc.
                    // which are stored in PPM (see line ~7521, soilInput.ppm.K
                    // → data.soil.K). The comparison `value < thresh.min` was
                    // therefore `58.7 < 0.20` and silently returned false, so
                    // the K-deficit branch never fired even when K sat below
                    // the S277 sufficiency floor. Production verification at
                    // Hagley Oval (sample 1 "Oval", S277, K=0.15 me/100g →
                    // 58.7 ppm, below 0.20 me/100g floor → 78.2 ppm floor,
                    // genuinely deficient) shipped a docx with no K-deficit
                    // callout, while Hill Labs' own bench correctly flagged
                    // K below medium range.
                    //
                    // Fix: convert me/100g cation thresholds to ppm at clone-
                    // time using the SSOT meq100gToPpm helper so the amendment
                    // math sees matching units. Preserve the original me/100g
                    // label as labelMeq for any future trend-column display
                    // surface that wants to show cert-native units.
                    //
                    // Proportion-axis (%BS) thresholds (S81 K/Ca/Mg/Na) stay
                    // unchanged: the b35fix438 C49 BCSR rollback already added
                    // an early-return at the proportion-axis branch in
                    // _computeDeficits, so amendment math never sees those
                    // values. Physical-axis (CEC, TBS, VW, OM) and pH/ratio
                    // thresholds are not consumed by cation amendment math
                    // and stay unchanged.
                    // ────────────────────────────────────────────────────────────
                    data.soil.thresholds = {};
                    var nutrientKeys = Object.keys(aaRanges.thresholds);
                    for (var nki = 0; nki < nutrientKeys.length; nki++) {
                        var nk = nutrientKeys[nki];
                        var src = aaRanges.thresholds[nk];
                        var cloned = {
                            min: src.min,
                            max: src.max,
                            unit: src.unit,
                            axis: src.axis,
                            label: src.label
                        };
                        if (src.extractant) cloned.extractant = src.extractant;

                        // C46: cation me/100g → ppm conversion for absolute-axis
                        // thresholds where the soil value is stored in ppm.
                        var isCation_b35fix441 = (nk === 'K' || nk === 'Ca' || nk === 'Mg' || nk === 'Na');
                        if (isCation_b35fix441 && src.axis === 'absolute' && src.unit === 'me/100g') {
                            var minPpm = hlSSOT.meq100gToPpm(src.min, nk);
                            var maxPpm = hlSSOT.meq100gToPpm(src.max, nk);
                            if (minPpm != null && maxPpm != null) {
                                cloned.labelMeq = src.label;       // preserve cert-native label
                                cloned.minMeq = src.min;            // preserve cert-native min
                                cloned.maxMeq = src.max;            // preserve cert-native max
                                cloned.min = Math.round(minPpm * 10) / 10;  // 1 dp ppm
                                cloned.max = Math.round(maxPpm * 10) / 10;
                                cloned.unit = 'ppm';
                                cloned.label = cloned.min + '-' + cloned.max + ' ppm';
                                cloned.unitConvertedB35fix441 = true;  // diagnostic flag
                            }
                        }
                        data.soil.thresholds[nk] = cloned;
                    }
                }
                // If aaRanges missing entirely (no SSOT loaded, S78 path), leave
                // thresholds null/preserved for the cotula module to populate.
            } else {
                // MLSN minimums
                var pThreshold = 21;
                if (soilInput && soilInput.pH_water) {
                    var pH = soilInput.pH_water;
                    if (pH < 5.5) pThreshold = 35;
                    else if (pH < 6.0) pThreshold = 28;
                    else if (pH > 8.0) pThreshold = 40;
                    else if (pH > 7.5) pThreshold = 32;
                }
                data.soil.thresholds = {
                    P: { min: pThreshold, label: pThreshold + '' },
                    K: { min: 37, label: '37' },
                    Ca: { min: 331, label: '331' },
                    Mg: { min: 47, label: '47' },
                    S: { min: 7, label: '7' }
                };
            }
            
            // Extract status from results if available
            if (mlsnResults && typeof mlsnResults === 'string') {
                // Check for deficiency indicators
                data.soil.hasResults = true;
                data.soil.summary = mlsnResults.indexOf('Deficient') > -1 ? 'Deficiencies detected' :
                                   mlsnResults.indexOf('Low') > -1 ? 'Some nutrients low' : 'Adequate';
            }
            
            // Add species info for pH interpretation
            // When overseed is dominant (>50%), treat as C3 surface
            // For mixed stands with significant C3 (>20%), use C3 targets
            // Pure C4 stands: use C4 targets
            //
            // b35fix451 / C25b: chain-completion close. Pre-fix the isC4
            // and pure-C3 branches fell through to literal defaults
            // (warm-season default and cool-season default respectively)
            // when both warmBase and grassSpecies were empty. Both fields
            // are unreliably populated: warmBase is only set at L7493 when
            // hasOverseed fires, and grassSpecies is not written by
            // collectData at L7275 (only data.turf.species is, sourced
            // from turf.grassSpecies in the input state). Result: any
            // pure-C4 no-overseed site emitted the warm-season literal
            // default in generateSoilNarrative pH-interpretation copy
            // regardless of declared species, while generatepHCECContext
            // at L5569 read directly from turfData.species and emitted
            // the correct declared species. Read-shelf asymmetry: same
            // logical state, two consumers, two divergent answers.
            //
            // Surgical fix: insert data.turf.species as penultimate
            // fallback in the isC4 and pure-C3 chains. The overseed
            // branches (overseedDominant, useC3Targets) intentionally
            // retain their existing literal default because for an
            // overseed-dominant site data.turf.species is the warm-season
            // base, which is wrong narrative for a cover-dominant scenario.
            // Mirrors generatepHCECContext at L5569 priority chain:
            // effectiveSpecies, grassSpecies, species, warmBase, turf.
            //
            // Production evidence: Rockingham GC Combined Report
            // 2026-05-08 declared species Seashore Paspalum but emitted
            // warm-season literal default in generateSoilNarrative pH
            // copy on multiple zones (4th Green, 5th Green pH-interpretation
            // emitted incorrect species). generatepHCECContext on the
            // same docx correctly emitted Seashore Paspalum.
            //
            // NOT closed in this build: structural read-shelf asymmetry
            // closure that would route generateSoilNarrative through
            // turfData directly. Logged as C25c candidate, scheduled
            // when the bug class recurs or a 4-arg signature change is
            // worth the broader test surface.
            if (data.turf.overseedDominant) {
                // Overseed dominant - full focus on C3 overseed species
                data.soil.isC3Species = true;
                data.soil.speciesName = data.turf.coolOverseed || data.turf.effectiveSpecies || 'cool-season overseed';
            } else if (useC3Targets) {
                // Significant C3 cover but not dominant
                data.soil.isC3Species = true;
                data.soil.speciesName = data.turf.coolOverseed || data.turf.effectiveSpecies || 'cool-season overseed';
            } else if (isC4) {
                data.soil.isC3Species = false;
                data.soil.speciesName = data.turf.warmBase || data.turf.grassSpecies || data.turf.species || 'Couch';
            } else {
                // Pure C3 (bent, ryegrass, fescue, bluegrass)
                data.soil.isC3Species = true;
                data.soil.speciesName = data.turf.grassSpecies || data.turf.species || 'cool-season grass';
            }
            
        }
        
        // Tissue data
        if (window.GAIP_STATE) {
            ensureObject(data, 'tissue');  // Ensure tissue object exists
            var tissueState = window.GAIP_STATE.tissue;
            var tissueResults = window.GAIP_STATE.tissueResults;
            
            // Capture tissue sample identification metadata
            // Priority: SampleManager active sample > manual DOM input > empty
            var activeTissueSample = (window.GAIP_SampleManager && typeof GAIP_SampleManager.getActiveSample === 'function') 
                ? GAIP_SampleManager.getActiveSample('tissue') : null;
            var tissueLabelEl = document.querySelector('.gaip-tissue-sample-label');
            var tissueDateEl = document.querySelector('.gaip-tissue-date');
            data.tissue.sampleLabel = (activeTissueSample && activeTissueSample.label) ? activeTissueSample.label :
                (tissueLabelEl && tissueLabelEl.value) ? tissueLabelEl.value.trim() : '';
            data.tissue.testDate = (activeTissueSample && activeTissueSample.date) ? activeTissueSample.date :
                (tissueDateEl && tissueDateEl.value) ? tissueDateEl.value : '';

            // Tissue values are nested: state.tissue.tissue contains the actual values
            var tissueInput = tissueState && tissueState.tissue ? tissueState.tissue : tissueState;
            
            if (tissueInput) {
                data.tissue.N = tissueInput.N;
                data.tissue.P = tissueInput.P;
                data.tissue.K = tissueInput.K;
                data.tissue.Ca = tissueInput.Ca;
                data.tissue.Mg = tissueInput.Mg;
                data.tissue.S = tissueInput.S;
                data.tissue.Fe = tissueInput.Fe;
                data.tissue.Mn = tissueInput.Mn;
                data.tissue.Zn = tissueInput.Zn;
                data.tissue.Cu = tissueInput.Cu;
                data.tissue.B = tissueInput.B;
                
                // Set hasData flag
                if (data.tissue.N || data.tissue.K || data.tissue.P) {
                    data.tissue.hasData = true;
                }
            }
            
            // Fallback: read tissue values directly from DOM inputs if not in state
            if (!data.tissue.N && !data.tissue.K) {
                var tissueModule = document.querySelector('#gaipTissueModule, .gaip-tissue-module');
                if (tissueModule) {
                    var tissueInputs = tissueModule.querySelectorAll('input[data-val]');
                    tissueInputs.forEach(function(input) {
                        var nutrient = input.dataset.val;
                        var value = parseFloat(input.value);
                        if (nutrient && !isNaN(value) && value > 0) {
                            data.tissue[nutrient] = value;
                        }
                    });
                }
            }
            
            // Also check __GAIP_TISSUE_LAST__ for computed results
            if (window.__GAIP_TISSUE_LAST__ && window.__GAIP_TISSUE_LAST__.values) {
                var lastValues = window.__GAIP_TISSUE_LAST__.values;
                ['N', 'P', 'K', 'Ca', 'Mg', 'S', 'Fe', 'Mn', 'Zn', 'Cu', 'B'].forEach(function(n) {
                    if (!data.tissue[n] && lastValues[n] !== undefined) {
                        data.tissue[n] = lastValues[n];
                    }
                });
            }
            
            // Set hasData flag if we have tissue data from any source
            if (data.tissue.N || data.tissue.K || data.tissue.P) {
                data.tissue.hasData = true;
            }
            
            // Add sufficiency ranges based on EFFECTIVE species
            // When overseed is dominant, use C3 ranges since that's what we're managing
            var speciesLower = (data.turf.effectiveSpecies || data.turf.species || '').toLowerCase();
            var isC4Species = !data.turf.overseedDominant && (
                             speciesLower.indexOf('couch') > -1 || speciesLower.indexOf('bermuda') > -1 ||
                             speciesLower.indexOf('kikuyu') > -1 || speciesLower.indexOf('zoysia') > -1);
            
            // Store which ranges we're using for clarity
            data.tissue.rangeSpecies = data.turf.overseedDominant ? 
                (data.turf.coolOverseed || 'Perennial Ryegrass') : 
                (data.turf.species || 'turf');
            
            // Sufficiency ranges (lo-hi)
            if (isC4Species) {
                // Couch/Bermudagrass ranges
                data.tissue.ranges = {
                    N:  { lo: 3.00, hi: 4.30, unit: '%' },
                    P:  { lo: 0.20, hi: 0.40, unit: '%' },
                    K:  { lo: 1.60, hi: 2.25, unit: '%' },
                    Ca: { lo: 0.25, hi: 0.50, unit: '%' },
                    Mg: { lo: 0.15, hi: 0.30, unit: '%' },
                    S:  { lo: 0.15, hi: 0.65, unit: '%' },
                    Fe: { lo: 50,  hi: 500, unit: 'ppm' },
                    Mn: { lo: 20,  hi: 300, unit: 'ppm' },
                    Zn: { lo: 15,  hi: 200, unit: 'ppm' },
                    Cu: { lo: 5,   hi: 20,  unit: 'ppm' },
                    B:  { lo: 5,   hi: 60,  unit: 'ppm' }
                };
            } else {
                // C3 (Ryegrass/Bentgrass) ranges - used for overseed dominant too
                data.tissue.ranges = {
                    N:  { lo: 3.34, hi: 5.10, unit: '%' },
                    P:  { lo: 0.33, hi: 0.55, unit: '%' },
                    K:  { lo: 2.00, hi: 3.42, unit: '%' },
                    Ca: { lo: 0.25, hi: 0.51, unit: '%' },
                    Mg: { lo: 0.16, hi: 0.32, unit: '%' },
                    S:  { lo: 0.27, hi: 0.56, unit: '%' },
                    Fe: { lo: 97,  hi: 934, unit: 'ppm' },
                    Mn: { lo: 30,  hi: 73,  unit: 'ppm' },
                    Zn: { lo: 14,  hi: 64,  unit: 'ppm' },
                    Cu: { lo: 6,   hi: 38,  unit: 'ppm' },
                    B:  { lo: 9,   hi: 17,  unit: 'ppm' }
                };
            }
            
            if (tissueResults) {
                if (!data.tissue) data.tissue = {};  // Defensive init
                data.tissue.hasResults = true;
                data.tissue.status = tissueResults.status || {};
                data.tissue.limitingNutrients = tissueResults.limitingNutrients || [];
            }
        }
        
        // Water data
        if (window.GAIP_STATE) {
            ensureObject(data, 'water');  // Ensure water object exists

            // b35fix139: read water from hub store directly (GAIP_STATE is a defineProperty getter
            // in gilba-hub-v2.js — writing .water on the returned object has no effect)
            // Priority: GilbaHub store → blender live state → GAIP_STATE legacy field
            var waterInput = null;
            try {
                // Try hub store first (authoritative)
                if (window.GilbaHub && window.GilbaHub.get) {
                    waterInput = window.GilbaHub.get('inputs.water');
                }
                // If store has no water data, try blender
                if ((!waterInput || !waterInput.ecw) && window.GAIP_WaterBlenderUI &&
                    window.GAIP_WaterBlenderUI.getState) {
                    var _bs2 = window.GAIP_WaterBlenderUI.getState();
                    if (_bs2 && _bs2.blendResult && typeof GAIP_WaterBlender !== 'undefined') {
                        waterInput = GAIP_WaterBlender.toHubWaterState(_bs2.blendResult);
                        // Write into hub store so downstream reads also get it
                        if (waterInput && window.GilbaHub && window.GilbaHub.set) {
                            window.GilbaHub.set('inputs.water', waterInput);
                        }
                    }
                }
                // Last resort: pre-captured value stored on export object
                if ((!waterInput || !waterInput.ecw) && window._GAIP_EXPORT_BLEND_WATER) {
                    waterInput = window._GAIP_EXPORT_BLEND_WATER;
                }
            } catch(_we) {}
            // Final fallback: legacy GAIP_STATE path
            if (!waterInput) waterInput = window.GAIP_STATE ? window.GAIP_STATE.water : null;
            var waterResults = window.GAIP_STATE ? window.GAIP_STATE.waterResults : null;
            
            // Capture water sample identification metadata
            // Priority: SampleManager active sample > manual DOM input > empty
            var activeWaterSample = (window.GAIP_SampleManager && typeof GAIP_SampleManager.getActiveSample === 'function') 
                ? GAIP_SampleManager.getActiveSample('water') : null;
            var waterSourceEl = document.querySelector('.gaip-water-source-label');
            var waterLabRefEl = document.querySelector('.gaip-water-lab-ref');
            var waterDateEl = document.querySelector('.gaip-water-date');
            data.water.sourceLabel = (activeWaterSample && activeWaterSample.label) ? activeWaterSample.label :
                (waterSourceEl && waterSourceEl.value) ? waterSourceEl.value.trim() : '';
            data.water.labRef = (waterLabRefEl && waterLabRefEl.value) ? waterLabRefEl.value.trim() : '';
            data.water.testDate = (activeWaterSample && activeWaterSample.date) ? activeWaterSample.date :
                (waterDateEl && waterDateEl.value) ? waterDateEl.value : '';

            if (waterInput) {
                data.water.EC = waterInput.ecw;
                // b35fix434 / C43: pH writer is conditional. Pre-fix, pH=7 (or any other
                // stale value retained in the bleed-through hub-store inputs.water slot)
                // leaked into renderers as partial state. The C43 hub-orchestrator
                // site-clear hook + clearWaterForm metadata clear close the bleed paths
                // upstream; this gate is the renderer-side belt-and-braces.
                if (waterInput.pH && waterInput.pH > 0) {
                    data.water.pH = waterInput.pH;
                }
                // Check if this is blended water
                data.water.isBlended = waterInput.isBlended || false;
                data.water.sourceCount = waterInput.sourceCount || 1;
                // Ion values are in the ions sub-object
                var ions = waterInput.ions || {};
                data.water.Na = ions.Na;
                data.water.Ca = ions.Ca;
                data.water.Mg = ions.Mg;
                data.water.Cl = ions.Cl;
                data.water.HCO3 = ions.HCO3;
                data.water.B = ions.B;
                data.water.K = ions.K;
                data.water.SO4 = ions.SO4;
                // Blend-specific fields for word export (b35fix139)
                data.water.ccpi = waterInput.ccpi !== undefined ? waterInput.ccpi : null;
                data.water.ccpiClassification = waterInput.ccpiClassification || null;
                data.water.optimiserResult = waterInput.optimiserResult || null;
                data.water.salinityClass = waterInput.salinityClass || null;
                data.water.sodicityClass = waterInput.sodicityClass || null;
                data.water.infiltrationClass = waterInput.infiltrationClass || null;
                data.water.bicarbonateClass = waterInput.bicarbonateClass || null;
                
                // Set hasData flag
                if (data.water.EC || data.water.Na || data.water.Ca) {
                    data.water.hasData = true;
                }
            }
            
            // DOM fallback for water if GAIP_STATE didn't have it
            if (!data.water.hasData) {
                
                var waterFieldMappings = [
                    ['EC', ['#gaip_water_EC', '#water_EC', '[name="water_EC"]', '.gaip-water-EC', '#ECw']],
                    ['pH', ['#gaip_water_pH', '#water_pH', '[name="water_pH"]', '.gaip-water-pH']],
                    ['Na', ['#gaip_water_Na', '#water_Na', '[name="water_Na"]', '.gaip-water-Na']],
                    ['Ca', ['#gaip_water_Ca', '#water_Ca', '[name="water_Ca"]', '.gaip-water-Ca']],
                    ['Mg', ['#gaip_water_Mg', '#water_Mg', '[name="water_Mg"]', '.gaip-water-Mg']],
                    ['Cl', ['#gaip_water_Cl', '#water_Cl', '[name="water_Cl"]', '.gaip-water-Cl']],
                    ['HCO3', ['#gaip_water_HCO3', '#water_HCO3', '[name="water_HCO3"]', '.gaip-water-HCO3', '#water_bicarb']],
                    ['B', ['#gaip_water_B', '#water_B', '[name="water_B"]', '.gaip-water-B']],
                    ['SO4', ['#gaip_water_SO4', '#water_SO4', '[name="water_SO4"]', '.gaip-water-SO4']]
                ];
                
                waterFieldMappings.forEach(function(mapping) {
                    var prop = mapping[0];
                    var selectors = mapping[1];
                    for (var i = 0; i < selectors.length; i++) {
                        var el = document.querySelector(selectors[i]);
                        if (el && el.value && !isNaN(parseFloat(el.value))) {
                            data.water[prop] = parseFloat(el.value);
                            break;
                        }
                    }
                });
                
                if (data.water.EC || data.water.Na || data.water.Ca) {
                    data.water.hasData = true;
                }
            }
            
            // Water quality thresholds for charting
            data.water.thresholds = {
                EC: { safe: 0.75, marginal: 1.5, max: 3.0, unit: 'dS/m' },
                SAR: { safe: 3, marginal: 6, max: 12 },
                Na: { safe: 70, marginal: 150, max: 200, unit: 'ppm' },
                Cl: { safe: 100, marginal: 200, max: 350, unit: 'ppm' },
                HCO3: { safe: 90, marginal: 180, max: 300, unit: 'ppm' },
                B: { safe: 0.5, marginal: 1.0, max: 2.0, unit: 'ppm' },
                pH: { min: 6.0, optLo: 6.5, optHi: 7.5, max: 8.5 }
            };
            
            if (waterResults) {
                if (!data.water) data.water = {};  // Defensive init
                data.water.hasResults = true;
                data.water.SAR = waterResults.SAR;
                data.water.SARadj = waterResults.SARadj;  // Adjusted SAR for bicarbonate effect
                data.water.RSC = waterResults.RSC;
                data.water.classification = waterResults.classification || waterResults.category;
                data.water.sodiumHazard = waterResults.sodiumHazard;
                data.water.salinityHazard = waterResults.salinityHazard;
                // If engine ran and produced results, water data is present — ensure hasData reflects this
                // (GAIP_STATE.water input may be absent during combined export even when engine has results)
                if (!data.water.hasData && (waterResults.SAR || waterResults.EC)) {
                    data.water.hasData = true;
                }
            }
            
            // Calculate SAR if not provided but we have the necessary ion data
            if (!data.water.SAR && data.water.Na && data.water.Ca && data.water.Mg) {
                var Na_meq = data.water.Na / 23;
                var Ca_meq = data.water.Ca / 20;
                var Mg_meq = data.water.Mg / 12.15;
                
                if (Ca_meq + Mg_meq > 0) {
                    data.water.SAR = Na_meq / Math.sqrt((Ca_meq + Mg_meq) / 2);
                }
            }
            
            // Calculate SARadj if not provided but we have the necessary data
            if (data.water.SAR && !data.water.SARadj && data.water.HCO3 && data.water.Ca && data.water.Mg) {
                // Convert to meq/L for calculation
                var Na_meq = (data.water.Na || 0) / 23;
                var Ca_meq = (data.water.Ca || 0) / 20;
                var Mg_meq = (data.water.Mg || 0) / 12.15;
                var HCO3_meq = (data.water.HCO3 || 0) / 61;
                var CO3_meq = (data.water.CO3 || 0) / 30;
                
                // Suarez (1981) adjustment - Ca precipitation due to bicarbonates
                var totalCarbonates = HCO3_meq + CO3_meq;
                var CaMg_effective = Ca_meq + Mg_meq;
                
                if (totalCarbonates > CaMg_effective * 0.5) {
                    // Significant bicarbonate - calculate adjusted SAR
                    var Ca_precipitated = Math.min(Ca_meq, totalCarbonates * 0.7);
                    var CaMg_remaining = Math.max(0.1, CaMg_effective - Ca_precipitated);
                    data.water.SARadj = Na_meq / Math.sqrt(CaMg_remaining / 2);
                } else {
                    data.water.SARadj = data.water.SAR;
                }
            }
            
            // Calculate RSC if not provided
            if (!data.water.RSC && data.water.HCO3 && data.water.Ca && data.water.Mg) {
                var HCO3_meq = data.water.HCO3 / 61;
                var CO3_meq = (data.water.CO3 || 0) / 30;
                var Ca_meq = data.water.Ca / 20;
                var Mg_meq = data.water.Mg / 12.15;
                data.water.RSC = (HCO3_meq + CO3_meq) - (Ca_meq + Mg_meq);
            }
            
            // b35fix434 / C43: phytotox/salinity last-resort hasData fallback REMOVED.
            // The original fallback claimed GAIP_PHYTOTOXICITY_RESULT / GAIP_SALINITY_RESULT
            // were a "reliable proxy for water data presence". They are not. Both globals
            // are populated by ANY site's water engine run and have no clear hook on
            // gaip:site-changed (now addressed by hub-orchestrator.js b35fix434 site-clear),
            // so they bleed across site-switch and flipped data.water.hasData true on
            // sites with zero water samples. Symptom: Shirley_Combined_Report_2026-05-04.docx
            // rendered a Water Quality section sourced from prior-site (Rockingham) data.
            // The proper writers at 7953/7985/8012 are reliable; this belt-and-braces
            // fallback was hiding the bleed-through.
            //
            // Banked pattern: "Belt-and-braces fallback outliving its purpose"
            // (bug-patterns.md). Same disposition as b35fix329 GAIP_NUTRITION_SOIL_CACHE
            // engine-output fallback removal.

            }
        
        // =====================================================================
        // SALINITY PENALTY DATA (v2.0.8)
        // Captures salinity → growth potential → recovery chain
        // =====================================================================
        if (window.GAIP_SALINITY_RESULT) {
            var sp = window.GAIP_SALINITY_RESULT;
            data.salinity.hasData = true;
            data.salinity.ecwInput = sp.ecwInput;
            data.salinity.species = sp.species;
            data.salinity.threshold = sp.thresholdECw || sp.threshold;  // engine returns thresholdECw
            data.salinity.slope = sp.slope;
            data.salinity.toleranceClass = sp.toleranceClass;
            data.salinity.relativeYieldPct = sp.relativeYieldPct;
            data.salinity.growthPenaltyPct = sp.growthPenaltyPct;
            data.salinity.status = sp.status;
            data.salinity.safetyMargin = sp.safetyMargin;
            
            // Recovery impact calculation
            if (sp.growthPenaltyPct > 0) {
                var yieldMod = sp.relativeYieldPct / 100;
                data.salinity.recoveryExtension = Math.round((1 / yieldMod - 1) * 100);
            }
            
        }
        // Fallback: check orchestrator computed values
        else if (window.GaipOrchestrator && window.GaipOrchestrator.getComputed) {
            var orchSalinity = window.GaipOrchestrator.getComputed('salinity');
            if (orchSalinity && orchSalinity.growthPenaltyPct > 0) {
                data.salinity.hasData = true;
                data.salinity.ecwInput = orchSalinity.ecwInput;
                data.salinity.threshold = orchSalinity.thresholdECw || orchSalinity.threshold;  // engine returns thresholdECw
                data.salinity.growthPenaltyPct = orchSalinity.growthPenaltyPct;
                data.salinity.relativeYieldPct = orchSalinity.relativeYieldPct;
                data.salinity.status = orchSalinity.status;
                data.salinity.recoveryExtension = Math.round((100 / orchSalinity.relativeYieldPct - 1) * 100);
            }
        }
        
        // Disease from window
        if (window.GAIP_DISEASE_RESULT) {
            var dr = window.GAIP_DISEASE_RESULT;
            data.disease.hasData = true;  // v2.0.10: Set hasData flag
            data.disease.overallRisk = dr.overallRisk;
            data.disease.overallScore = dr.overallScore;
            data.disease.diseases = dr.diseases || [];
            // b35fix420 (C23): pass through species-applicability metadata so
            // the Disease Risk Assessment renderer can emit the
            // "Showing N of M, suppressed: X, Y" footnote. The engine computes
            // these from SPECIES_SUSCEPTIBILITY at the dispatcher gate, so
            // copying them here is a no-op contract; the engine is the SSOT.
            data.disease.suppressedDiseases = Array.isArray(dr.suppressedDiseases) ? dr.suppressedDiseases : [];
            data.disease.applicableDiseaseCount = (typeof dr.applicableDiseaseCount === 'number')
                ? dr.applicableDiseaseCount
                : (data.disease.diseases.length);
            data.disease.species = dr.species || null;

            // b35fix419 (C4): apply species-aware displayName resolver to every
            // disease object before downstream rendering. The disease engine
            // returns canonical "Take-all Patch" for the takeAll model
            // regardless of species; for paspalum this is taxonomically wrong
            // (the pathogen is var. graminis, the disease is "Take-all Root
            // Rot"). The resolver swaps the label per effective species. Other
            // diseases pass through unchanged.
            var _diseaseSpecies = (data.turf && (data.turf.effectiveSpecies || data.turf.species || data.turf.grassSpecies))
                || (data.soil && data.soil.speciesName)
                || null;
            var _resolveDiseaseLabel = (window.DiseaseEnginePure &&
                                        window.DiseaseEnginePure.utils &&
                                        typeof window.DiseaseEnginePure.utils.resolveDiseaseDisplayName === 'function')
                ? window.DiseaseEnginePure.utils.resolveDiseaseDisplayName
                : null;
            if (_resolveDiseaseLabel && Array.isArray(data.disease.diseases)) {
                data.disease.diseases.forEach(function(d) {
                    if (d && d.disease) {
                        var resolved = _resolveDiseaseLabel(d.disease, _diseaseSpecies);
                        // Only overwrite if resolver returns a non-empty result.
                        // Preserves any pre-set displayName for diseases the
                        // resolver doesn't know about.
                        if (resolved) d.displayName = resolved;
                    }
                });
            }

            // Find primary threat - prefer validated diseases over beta
            if (dr.diseases && dr.diseases.length > 0) {
                var sorted = dr.diseases.slice().sort(function(a, b) {
                    return (b.adjustedRisk || 0) - (a.adjustedRisk || 0);
                });
                
                // Check if disease is beta (by validationStatus or name matching)
                // b35fix462 (C59g): Drechslera Melting-Out removed from name array
                // following promotion to validated. Model emits
                // validationStatus: 'validated' from DRECHSLERA_POAE_VALIDATION_STATUS
                // (bipolaris-curvularia-models.js:176) after b35fix362 Tier 2 audit
                // and b35fix461 CABI 2024 Box 7.7 curve lock. The validationStatus
                // check on line below is sufficient if reverted.
                function isBetaDisease(d) {
                    if (d.validationStatus === 'beta') return true;
                    var name = (d.displayName || d.name || '').toLowerCase();
                    return name.indexOf('bipolaris') !== -1 || 
                           name.indexOf('curvularia') !== -1 || 
                           name.indexOf('waitea') !== -1 ||
                           name.indexOf('helminthosporium') !== -1;
                }
                
                // Find highest validated disease
                var validatedDiseases = sorted.filter(function(d) { return !isBetaDisease(d); });
                var betaDiseases = sorted.filter(function(d) { return isBetaDisease(d); });
                
                if (validatedDiseases.length > 0) {
                    // Primary threat is highest validated disease
                    data.disease.primaryThreat = validatedDiseases[0].displayName || validatedDiseases[0].name;
                    data.disease.primaryThreatRisk = validatedDiseases[0].adjustedRisk || 0;
                    
                    // Note if a beta disease is actually higher risk
                    if (betaDiseases.length > 0 && (betaDiseases[0].adjustedRisk || 0) > (validatedDiseases[0].adjustedRisk || 0)) {
                        data.disease.betaThreatNote = (betaDiseases[0].displayName || betaDiseases[0].name) + 
                            ' (BETA) shows higher risk (' + Math.round(betaDiseases[0].adjustedRisk) + 
                            '%) but requires field validation';
                    }
                } else if (betaDiseases.length > 0) {
                    // Only beta diseases present - use with caveat
                    data.disease.primaryThreat = (betaDiseases[0].displayName || betaDiseases[0].name) + ' (BETA)';
                    data.disease.primaryThreatRisk = betaDiseases[0].adjustedRisk || 0;
                    data.disease.betaThreatNote = 'Primary threat is a beta model - verify with visual scouting';
                }
                
                // Overall risk score should be based on validated diseases if available
                if (validatedDiseases.length > 0) {
                    data.disease.overallScore = validatedDiseases[0].adjustedRisk || data.disease.overallScore;
                }
            }
            
            // v2.0.11: Capture disease engine inputs for transparency
            // Shows WHY disease risk is elevated/reduced
            if (dr.inputs) {
                // Nitrogen is stored as object with status/value/ratio
                var nData = dr.inputs.nitrogen || {};
                var nStatus = typeof nData === 'string' ? nData : (nData.status || null);
                var nValue = typeof nData === 'object' ? nData.value : null;  // Tissue N in %
                
                // K:N ratio from tissueNutrients (evidence-based disease predictor)
                var knRatio = null;
                var knStatus = null;
                if (dr.inputs.tissueNutrients && dr.inputs.tissueNutrients.modifiers && 
                    dr.inputs.tissueNutrients.modifiers.KN_ratio) {
                    var knData = dr.inputs.tissueNutrients.modifiers.KN_ratio;
                    knRatio = knData.value;
                    knStatus = knData.status;  // 'poor', 'low', 'optimal', 'high'
                }
                
                data.disease.inputs = {
                    hasInputs: true,
                    nitrogen: nStatus,              // 'high', 'moderate', 'low', etc.
                    tissueN: nValue,                // Tissue N in % (e.g., 3.4)
                    knRatio: knRatio,               // K:N ratio (e.g., 0.54) - evidence-based
                    knStatus: knStatus,             // 'poor', 'low', 'optimal', 'high'
                    shade: null,
                    dew: null
                };
                
                // Shade inputs - structure: { dliDeficit: { percentage, value }, stressIndex, status, ... }
                if (dr.inputs.shade) {
                    data.disease.inputs.shade = {
                        dliDeficitPct: dr.inputs.shade.dliDeficit?.percentage || dr.inputs.shade.deficitPct,
                        stressIndex: dr.inputs.shade.stressIndex,
                        status: dr.inputs.shade.status || dr.inputs.shade.stressClass
                    };
                }
                
                // Dew/leaf wetness inputs - stored as "dewData" not "dew"
                var dewInfo = dr.inputs.dewData || dr.inputs.dew;
                if (dewInfo) {
                    data.disease.inputs.dew = {
                        totalWetHours: dewInfo.leafWetness?.totalWetHours || dewInfo.totalWetHours || dewInfo.wetHours,
                        dewRisk: dewInfo.dewRisk || dewInfo.risk
                    };
                }
                
                // Soil temperature inputs
                if (dr.inputs.soilTemp) {
                    data.disease.inputs.soilTemp = dr.inputs.soilTemp;
                } else if (dr.inputs.climate?.soilTemp) {
                    data.disease.inputs.soilTemp = dr.inputs.climate.soilTemp;
                }
                
            }
        }

        // Companion surface disease (golf greens only — fairway/tee parallel assessment)
        if (window.GAIP_COMPANION_DISEASE_RESULT && window.GAIP_COMPANION_DISEASE_RESULT._companionSurface) {
            var cr = window.GAIP_COMPANION_DISEASE_RESULT;
            data.companionDisease = {
                hasData: true,
                speciesKey:   cr._companionSpecies || '',
                speciesLabel: cr._companionDisplayName || cr._companionSpecies || 'Fairway/Tee',
                overallRisk:  cr.overallRisk || 'low',
                overallScore: cr.overallScore || 0,
                diseases:     (cr.diseases || []).filter(function(d) {
                    return (d.adjustedRisk || d.riskScore || 0) > 0 ||
                           (d.treatmentWindow && d.treatmentWindow.inWindow);
                }),
                note: 'Greens soil/tissue data not applied. Weather inputs identical to greens assessment.'
            };
        }


        // PGR from window - check both possible names
        var pgrResult = window.GAIP_PGR_RESULT || window.GAIP_PGR_STATUS;
        if (pgrResult && pgrResult.product) {
            // Handle both old and new structure
            var productName = pgrResult.product.name || pgrResult.product;
            data.pgr.product = productName;
            data.pgr.applicationDate = pgrResult.application ? pgrResult.application.date : null;
            
            // GDD data
            if (pgrResult.gdd) {
                data.pgr.gddAccumulated = pgrResult.gdd.accumulated;
                data.pgr.gddThreshold = pgrResult.gdd.threshold;
                data.pgr.gddProgress = pgrResult.gdd.progressPct || pgrResult.gdd.progress;
            }
            
            // Surface category from mowingHeight or thresholdConfig (v2.4.0+)
            if (pgrResult.mowingHeight) {
                data.pgr.surfaceCategory = pgrResult.mowingHeight.categoryLabel || pgrResult.mowingHeight.category;
                data.pgr.mowingHeightMM = pgrResult.mowingHeight.inputMM;
            }
            
            // Threshold validation status (v2.3.0+)
            if (pgrResult.thresholdConfig) {
                data.pgr.thresholdValidated = pgrResult.thresholdConfig.validated;
                data.pgr.thresholdSource = pgrResult.thresholdConfig.source;
                // Use surfaceKey as fallback for surfaceCategory
                if (!data.pgr.surfaceCategory) {
                    data.pgr.surfaceCategory = pgrResult.thresholdConfig.surfaceKey;
                }
            }
            
            // Effect/suppression data
            if (pgrResult.effect) {
                data.pgr.suppression = pgrResult.effect.suppressionPct || pgrResult.effect.suppression;
                data.pgr.status = pgrResult.effect.reapplicationStatus;
            }
            
            // Projection data
            if (pgrResult.projection) {
                data.pgr.reapplyDate = pgrResult.projection.reapplyDate || pgrResult.projection.date;
                data.pgr.daysUntilReapply = pgrResult.projection.daysUntil;
            }
            
            // Shade warning
            if (pgrResult.shade && pgrResult.shade.warning) {
                data.pgr.shadeWarning = pgrResult.shade.warning.status !== 'ok' ? pgrResult.shade.warning.action : null;
            }
            
        }
        
        // DMI Fungicide Tracking from window (v2.0 - evidence-based)
        var dmiResult = window.GAIP_DMI_RESULT;
        if (!dmiResult && typeof window.gaip_dmi_calculate === 'function' && window.GAIP_CURRENT_STATE) {
            // Try to calculate if not cached
            dmiResult = window.gaip_dmi_calculate(window.GAIP_CURRENT_STATE);
        }
        if (dmiResult && !dmiResult.error && dmiResult.product && dmiResult.hasActiveApplication) {
            data.dmi.product = dmiResult.product.name;
            data.dmi.activeIngredient = dmiResult.product.activeIngredient;
            data.dmi.diseases = dmiResult.product.diseases;
            data.dmi.riskCategory = dmiResult.product.riskCategory;
            
            // Risk assessment (not suppression % - that's not supported by research)
            if (dmiResult.risk) {
                data.dmi.overallRisk = dmiResult.risk.overall;
                data.dmi.speciesSensitivity = dmiResult.risk.species;
                data.dmi.productWarning = dmiResult.risk.warning;
            }
            
            if (dmiResult.gdd) {
                data.dmi.gddAccumulated = dmiResult.gdd.accumulated;
                data.dmi.gddTypicalDuration = dmiResult.gdd.typicalDuration;
                data.dmi.gddProgress = dmiResult.gdd.progress;
                data.dmi.baseTemp = dmiResult.gdd.baseTemp;
                data.dmi.estimated = dmiResult.gdd.estimated;
            }
            
            if (dmiResult.status) {
                data.dmi.isActive = dmiResult.status.isActive;
                data.dmi.daysRemaining = dmiResult.status.daysRemaining;
                data.dmi.effectEndsDate = dmiResult.status.effectEndsDate;
            }
            
        }
        
        // Combined PGR + DMI risk assessment from window
        var combinedRisk = window.GAIP_COMBINED_SUPPRESSION;
        if (combinedRisk && combinedRisk.hasCombinedRisk) {
            data.dmi.combinedRisk = true;
            data.dmi.combinedWarningLevel = combinedRisk.warningLevel;
            data.dmi.combinedMessage = combinedRisk.message;
            data.dmi.combinedRecommendation = combinedRisk.recommendation;
            data.dmi.pgrSuppression = combinedRisk.pgrSuppression;
        }
        
        // Trajectory from window
        if (window.GAIP_TRAJECTORY_RESULT) {
            var tr = window.GAIP_TRAJECTORY_RESULT;
            var summary = tr.summary || {};
            data.trajectory.currentScore = summary.current ? summary.current.score : null;
            data.trajectory.peakScore = summary.peak ? summary.peak.score : null;
            data.trajectory.trend = summary.trend;
            data.trajectory.criticalPoints = summary.criticalPoints || 0;
        }
        
        // N Program Validation from window or state
        ensureObject(data, 'nProgram');
        var nResult = window.GAIP_N_VALIDATION_RESULT;
        if (!nResult && window.GAIP_STATE && window.GAIP_STATE.fertility && window.GAIP_STATE.fertility.monthlyN) {
            // Try to calculate it if we have the data
            if (typeof window.gaip_validateNProgram === 'function') {
                var effectiveSpecies = data.turf.effectiveSpecies || data.turf.species || 'Couch';
                var gp = data.climate.growthPotential || 50;
                nResult = window.gaip_validateNProgram(window.GAIP_STATE.fertility.monthlyN, effectiveSpecies, gp);
            }
        }
        
        if (nResult) {
            data.nProgram.hasData = true;
            data.nProgram.appliedN = nResult.appliedNKgHa;
            data.nProgram.uptakeCapacity = nResult.uptakeCapacity;
            data.nProgram.effectiveCapacity = nResult.effectiveCapacity;
            data.nProgram.difference = nResult.difference;
            data.nProgram.utilizationPct = nResult.utilizationPct;
            data.nProgram.verdict = nResult.verdict;
            data.nProgram.recommendations = nResult.recommendations;
        }
        
        // Irrigation from window
        if (window.GAIP_IRRIGATION_RESULT) {
            var ir = window.GAIP_IRRIGATION_RESULT;
            data.irrigation.etDeficit = ir.waterBalance ? ir.waterBalance.currentDepletion : null;
            data.irrigation.strategy = ir.summary ? ir.summary.strategy : null;
            data.irrigation.status = ir.summary ? ir.summary.status : null;
            data.irrigation.nextIrrigation = ir.summary ? ir.summary.nextIrrigation : null;
            data.irrigation.weeklyTotal = ir.summary ? ir.summary.weeklyTotal : null;
            
            // Water balance details
            if (ir.waterBalance) {
                data.irrigation.taw = ir.waterBalance.taw;
                data.irrigation.raw = ir.waterBalance.raw;
                data.irrigation.depletionPct = ir.waterBalance.currentDepletion && ir.waterBalance.taw ? 
                    Math.round((ir.waterBalance.currentDepletion / ir.waterBalance.taw) * 100) : null;
                
                // v2.1.0: Extended water balance data
                data.irrigation.mad = ir.waterBalance.mad;
                data.irrigation.soilType = ir.waterBalance.soilType;
                data.irrigation.soilProps = ir.waterBalance.soilProps;
                data.irrigation.rootDepth = ir.waterBalance.rootDepth;
                data.irrigation.currentDepletion = ir.waterBalance.currentDepletion;
                data.irrigation.depletionSource = ir.waterBalance.depletionSource;
                data.irrigation.needsIrrigation = ir.waterBalance.needsIrrigation;
                data.irrigation.refillDepth = ir.waterBalance.refillDepth;
                data.irrigation.omEffect = ir.waterBalance.omEffect;
            }
            
            // v2.1.0: Daily schedule for 7-day forecast table
            if (ir.schedule && ir.schedule.length > 0) {
                data.irrigation.schedule = ir.schedule.slice(0, 7); // 7 days only
                data.irrigation.hasSchedule = true;
            }
            
            // v2.1.0: Species/overseed information
            if (ir.species) {
                data.irrigation.species = ir.species;
            }
            if (ir.overseed) {
                data.irrigation.overseed = ir.overseed;
                // Sanitise: engine may carry stale isOverseed from a prior site session.
                // Trust hasOverseed (derived from per-sample turf state) as the authority.
                if (!hasOverseed && data.irrigation.overseed) {
                    data.irrigation.overseed = Object.assign({}, data.irrigation.overseed, { isOverseed: false });
                }
            }
            
            // v2.1.0: Leaching requirement
            if (ir.leachingRequirement) {
                data.irrigation.leachingRequirement = ir.leachingRequirement;
            }
            
            // v2.1.0: System configuration for runtime calculations
            if (ir.system) {
                data.irrigation.system = ir.system;
            }
            
            // v2.1.0: Summary statistics
            if (ir.summary) {
                data.irrigation.summary = ir.summary;
            }
            
            // v2.1.0: Flag for expanded section
            data.irrigation.hasData = true;
            
        }
        
        // Sensor data (TDR zones for golf)
        if (window.GAIP_Sensor) {
        }
        
        if (window.GAIP_Sensor && GAIP_Sensor.hasData()) {
            var selectedZone = GAIP_Sensor.getSelectedZone();
            data.sensor.hasData = true;
            data.sensor.selectedZone = selectedZone.name || null;
            data.sensor.selectedZoneData = selectedZone.data || null;
            
            // Get zone summaries with irrigation calculations (if available)
            var zoneSummaries = GAIP_Sensor.getZoneSummaries();
            if (zoneSummaries && zoneSummaries.length > 0) {
                data.sensor.zones = zoneSummaries;
                data.sensor.totalReadings = 0;
                zoneSummaries.forEach(function(z) {
                    data.sensor.totalReadings += z.count || 0;
                });
                
                // Check if this is golf (has labelled zones)
                var labelledZones = zoneSummaries.filter(function(z) { return z.name !== 'Unlabelled'; });
                data.sensor.isGolf = labelledZones.length > 0;
            } else {
                // Fall back to calculating from readings
                var readings = GAIP_Sensor.getReadings();
                if (readings && readings.length > 0) {
                    var zones = {};
                    readings.forEach(function(r) {
                        var zone = r.zoneName || 'Unlabelled';
                        if (!zones[zone]) {
                            zones[zone] = { vwcSum: 0, ecSum: 0, tempSum: 0, vwcCount: 0, ecCount: 0, tempCount: 0, readings: [] };
                        }
                        zones[zone].readings.push(r);
                        if (r.vwc !== null) { zones[zone].vwcSum += r.vwc; zones[zone].vwcCount++; }
                        if (r.ec !== null) { zones[zone].ecSum += r.ec; zones[zone].ecCount++; }
                        if (r.temp !== null) { zones[zone].tempSum += r.temp; zones[zone].tempCount++; }
                    });
                    
                    var fallbackSummaries = [];
                    for (var zoneName in zones) {
                        var z = zones[zoneName];
                        var vwcs = z.readings.filter(function(r) { return r.vwc !== null; }).map(function(r) { return r.vwc; });
                        fallbackSummaries.push({
                            name: zoneName,
                            count: z.readings.length,
                            avg: z.vwcCount > 0 ? z.vwcSum / z.vwcCount : null,
                            min: vwcs.length > 0 ? Math.min.apply(null, vwcs) : null,
                            max: vwcs.length > 0 ? Math.max.apply(null, vwcs) : null
                        });
                    }
                    
                    fallbackSummaries.sort(function(a, b) {
                        if (a.name === 'Unlabelled') return 1;
                        if (b.name === 'Unlabelled') return -1;
                        return a.name.localeCompare(b.name);
                    });
                    
                    data.sensor.zones = fallbackSummaries;
                    data.sensor.totalReadings = readings.length;
                    
                    var labelledZones = fallbackSummaries.filter(function(z) { return z.name !== 'Unlabelled'; });
                    data.sensor.isGolf = labelledZones.length > 0;
                }
            }
            
        }
        
        // b35fix433 (C42): Dew Forecast & Match Conditions section emit removed
        // (forecast staleness on a Word doc dated weeks ago caused client confusion;
        // live dew prediction available in the hub dashboard). Collector deleted in
        // lockstep with the section emit, exec-summary dew flag, and TOC entry. The
        // upstream `window.GAIP_DEW_RESULT` continues to populate `state.computed.dew.leafWetness`,
        // which engine-confidence.js and disease-engine inputs still consume directly,
        // independent of `data.dew`.
        
        // Phytotoxicity data (v2.0.30) - direct plant damage from irrigation water ions
        if (window.GAIP_PHYTOTOXICITY_RESULT && window.GAIP_PHYTOTOXICITY_RESULT.assessments) {
            var phyto = window.GAIP_PHYTOTOXICITY_RESULT;
            data.phytotoxicity = {
                hasData: true,
                species: phyto.species,
                sensitivityClass: phyto.sensitivityClass,
                irrigationMethod: phyto.irrigationMethod,
                varietyModifier: phyto.varietyModifier,
                overallRisk: phyto.overallRisk,
                assessments: phyto.assessments || [],
                priorityActions: phyto.priorityActions || []
            };
        }
        
        // Overseed Climate data (for C4 with overseed)
        if (window.GAIP_OVERSEED_CLIMATE_RESULT && !window.GAIP_OVERSEED_CLIMATE_RESULT.error) {
            var osc = window.GAIP_OVERSEED_CLIMATE_RESULT;
            data.overseedClimate = {
                hasData: true,
                stage: osc.stage || 'unknown',
                adjustedMultiplier: osc.adjustedMultiplier,
                baseMultiplier: osc.baseMultiplier,
                temperatureCoefficient: osc.temperatureCoefficient,
                temperatureStress: osc.temperatureStress,
                temperatureNote: osc.temperatureNote,
                airTemp: osc.airTemp,
                soilTemp: osc.soilTemp,
                soilTempSource: osc.soilTempSource,
                germination: osc.germination || {},
                overseedWindow: osc.overseedWindow || {},
                recommendations: osc.recommendation || [],
                weatherStatus: osc.weatherStatus || {}
            };
        }
        
        // Traffic/Wear data - only for sports turf, not golf
        var rawTurfType = (data.turf.rawTurfType || '').toLowerCase();
        var isGolfType = rawTurfType === 'golf' || rawTurfType.indexOf('golf_') === 0;
        if (!isGolfType && window.GAIP_STATE && window.GAIP_STATE.wearMetrics) {
            var wm = window.GAIP_STATE.wearMetrics;
            // Extract recovery days from recoveryCapacity object
            var recoveryDays = wm.recoveryCapacity;
            var recoveryCapacity = null;
            if (typeof recoveryDays === 'object' && recoveryDays !== null) {
                recoveryCapacity = recoveryDays;  // Keep full object
                recoveryDays = recoveryDays.days || recoveryDays.value || null;
            }
            data.traffic = {
                hasData: true,
                sport: wm.sport,
                matchesPerWeek: wm.matchesPerWeek,
                sessionsPerWeek: wm.sessionsPerWeek,
                weeklyLoad: wm.weeklyLoad,
                wearIndex: wm.wearIndex,
                recoveryDays: recoveryDays,
                recoveryWindow: wm.recoveryWindow,
                status: wm.status,
                wearZone: wm.wearZone,
                canSustain: wm.canSustain
            };
            
            // v2.0.8: Capture full recovery modifiers for transparency
            // Shows what factors are extending recovery time
            if (recoveryCapacity && recoveryCapacity.modifiers) {
                var mods = recoveryCapacity.modifiers;
                data.traffic.recoveryModifiers = {
                    baseDays: recoveryCapacity.baseDays,
                    adjustedDays: recoveryCapacity.days,
                    growth: mods.growth,
                    shade: mods.shade,
                    moisture: mods.moisture,
                    rootDepth: mods.rootDepth,
                    soilHealth: mods.soilHealth,
                    nitrogen: mods.nitrogen,
                    salinity: mods.salinity,
                    temperatureStress: mods.temperatureStress
                };
            }
            
            // Capture compaction risk details
            if (wm.compactionRisk) {
                data.traffic.compaction = {
                    riskPercent: wm.compactionRisk.riskPercent,
                    usageRatio: wm.compactionRisk.usageRatio,
                    maxHours: wm.compactionRisk.maxHours,
                    construction: wm.compactionRisk.construction,
                    moistureLevel: wm.compactionRisk.moisture?.level
                };
            }
            
            // Capture shade-traffic compound effect
            if (wm.shadeTrafficCompound && wm.shadeTrafficCompound.isCompounding) {
                data.traffic.compoundEffect = {
                    isCompounding: true,
                    factor: wm.shadeTrafficCompound.compoundFactor,
                    shadeContribution: wm.shadeTrafficCompound.shadeContribution,
                    trafficContribution: wm.shadeTrafficCompound.trafficContribution,
                    synergy: wm.shadeTrafficCompound.synergy
                };
            }
            
            // Capture engine recommendations
            if (wm.recommendations && wm.recommendations.length > 0) {
                data.traffic.recommendations = wm.recommendations;
            }
            
        } else if (isGolfType) {
        }
        
        // Variety traits data - collect for Performance Impact Analysis
        ensureObject(data, 'varietyTraits');
        // CRITICAL: Use effective species/variety for variety traits lookup
        // When overseed is dominant, we want traits for the overseed cultivar, not the base
        var species = data.turf.effectiveSpecies || data.turf.species || '';
        var variety = data.turf.effectiveVariety || data.turf.variety || 'generic';
        
        // Normalize species name for trait lookup
        var speciesKey = species.toLowerCase()
            .replace(/couch/gi, 'bermuda')
            .replace(/\s+/g, '')
            .replace(/perennialryegrass/gi, 'perennialRyegrass')
            .replace(/kentuckybluegrass/gi, 'kentuckyBluegrass')
            .replace(/creepingbentgrass/gi, 'creepingBentgrass')
            .replace(/tallfescue/gi, 'tallFescue')
            .replace(/finefescue/gi, 'fineFescue')
            .replace(/chewingsfescue/gi, 'fineFescue')
            .replace(/seashorepaspalum/gi, 'seashorePaspalum');
        
        // Store what species we're looking up traits for
        data.varietyTraits.lookupSpecies = species;
        data.varietyTraits.lookupVariety = variety;
        data.varietyTraits.isOverseedFocus = data.turf.overseedDominant || false;
        
        // Try to get variety traits from global functions
        if (typeof window.gaip_getVarietyTraits === 'function' && variety !== 'generic') {
            var vt = window.gaip_getVarietyTraits(speciesKey, variety);
            if (vt) {
                data.varietyTraits.hasData = true;
                data.varietyTraits.variety = variety;
                data.varietyTraits.displayName = vt.displayName || variety;
                
                // v10.3.39: Handle regionalTraits structure (NTEP format)
                // Oakley and other NTEP varieties store data in regionalTraits.{region}
                var resolvedTraits = null;
                var resolvedQualityRating = vt.qualityRating;
                var resolvedQualitySource = vt.qualitySource;
                
                if (vt.regionalTraits) {
                    // Priority order for Australian users: temperate regions first
                    var regionOrder = ['temperate_ntep', 'temperate_au', 'cold_ntep', 'subtropical', 'subtropical_au'];
                    for (var ri = 0; ri < regionOrder.length; ri++) {
                        var regionKey = regionOrder[ri];
                        var regionData = vt.regionalTraits[regionKey];
                        if (regionData) {
                            if (!resolvedQualityRating && regionData.qualityRating) {
                                resolvedQualityRating = regionData.qualityRating;
                                resolvedQualitySource = regionData.qualitySource || ('NTEP ' + regionKey);
                            }
                            if (!resolvedTraits && regionData.traits) {
                                resolvedTraits = regionData.traits;
                            }
                            // Found data, can stop looking
                            if (resolvedQualityRating && resolvedTraits) break;
                        }
                    }
                }
                
                // Use resolved values or fall back to top-level
                data.varietyTraits.qualityRating = resolvedQualityRating;
                data.varietyTraits.qualitySource = resolvedQualitySource;
                
                // Use resolved traits or top-level traits
                var traits = resolvedTraits || vt.traits;
                
                if (traits) {
                    // Shade tolerance
                    if (traits.shade) {
                        data.varietyTraits.shade = {
                            modifier: traits.shade.thresholdModifier,
                            confidence: traits.shade.confidence,
                            source: traits.shade.source,
                            notes: traits.shade.notes
                        };
                    }
                    
                    // Salinity tolerance
                    if (traits.salinity) {
                        data.varietyTraits.salinity = {
                            multiplier: traits.salinity.multiplier,
                            confidence: traits.salinity.confidence,
                            source: traits.salinity.source,
                            notes: traits.salinity.notes
                        };
                    }
                    
                    // Wear tolerance
                    if (traits.wear) {
                        data.varietyTraits.wear = {
                            multiplier: traits.wear.multiplier,
                            confidence: traits.wear.confidence,
                            source: traits.wear.source,
                            notes: traits.wear.notes
                        };
                    }
                    
                    // Water use
                    if (traits.waterUse) {
                        data.varietyTraits.waterUse = {
                            multiplier: traits.waterUse.multiplier,
                            confidence: traits.waterUse.confidence,
                            source: traits.waterUse.source,
                            notes: traits.waterUse.notes
                        };
                    }
                    
                    // Cold tolerance
                    if (traits.cold) {
                        data.varietyTraits.cold = {
                            dormancyModifier: traits.cold.dormancyThresholdModifier,
                            winterkillRisk: traits.cold.winterkillRisk,
                            confidence: traits.cold.confidence,
                            source: traits.cold.source,
                            notes: traits.cold.notes
                        };
                    }
                    
                    // Disease susceptibility
                    if (traits.disease) {
                        data.varietyTraits.disease = traits.disease;
                    }
                }
                
            }
        }
        
        // Also check selectedVarietyTraits global
        if (!data.varietyTraits.hasData && window.selectedVarietyTraits) {
            var svt = window.selectedVarietyTraits;
            data.varietyTraits.hasData = true;
            data.varietyTraits.variety = variety;
            if (svt.shade) data.varietyTraits.shade = svt.shade;
            if (svt.salinity) data.varietyTraits.salinity = svt.salinity;
            if (svt.wear) data.varietyTraits.wear = svt.wear;
        }
        
        // Nutrition Summary (Annual P/K/S requirements + Monthly N Distribution)
        //
        // b35fix302b: delegates to NutritionRequirementEngine_Pure.compute() for
        // the current site's values. This replaces:
        //   (a) the stale GAIP_NUTRITION_SOIL_CACHE read, and
        //   (b) the monthlyN recalc-at-export workaround (previously lines 5261–5331)
        //       which used an unpublished σ=7/7 Gaussian — NOT PACE.
        // The recalc block existed because combined export switched samples
        // programmatically without re-rendering the nutrition panel (stale
        // cache). Task 11 (word-export-combined) rewires the combined loop to
        // call the engine per-sample directly, so this recalc is no longer
        // necessary. For single-sample export here, the current-site cache is
        // fresh anyway; engine call is canonical PACE methodology.
        //
        // b35fix329: legacy GAIP_NUTRITION_SOIL_CACHE fallback removed. Engine
        // path is now mandatory — if engineInputs is missing or compute throws,
        // the section is dropped (hasData = false) and a warn line is logged.
        // Mirrors the combined-export hard-fail pattern. The legacy cache was
        // belt-and-braces during the b35fix313 rollout; production has been
        // exclusively engine-driven for many builds (Kew Combined 2026-04-25
        // run shows engine line for every site, no fallback). Silent fallback
        // is worse than a missing section — same logic that motivated the
        // species hard-fail in combined export (b35fix313).
        ensureObject(data, 'nutritionSummary');

        var _engineReady = window.NutritionRequirementEngine_Pure &&
                           typeof window.NutritionRequirementEngine_Pure.compute === 'function';
        var _nutComputedViaEngine = false;

        // b35fix313 — Structural fix for handoff doc Item 7.
        //
        // The turf/climate/overseed/userN context that the nutrition engine
        // needs is assembled ONCE here and stored on data.engineInputs.
        // Two consumers read from it:
        //   1. The nutritionSummary engine call a few lines below (single
        //      export + per-iteration in combined export's collection loop).
        //   2. The combined export's post-loop ANR pass in
        //      word-export-combined.js (previously hardcoded hemisphere='south',
        //      overseed=false, species-fallback='bentgrass' — all wrong for a
        //      multi-site export spanning varied species/latitudes/overseed
        //      scenarios).
        //
        // Before: word-export-combined read globals at render time (post-loop),
        // which reflected only the last sample's site. Every prior report got
        // the last site's context. Now each report carries its own context
        // baked in during the loop iteration when its site was active.
        _buildEngineInputs(data);
        // b35fix314: _buildEngineInputs hard-fails to null when species can't
        // be resolved (readiness race). Gate the engine call on presence —
        // null means fall through to the legacy cache, not a null-deref crash.
        if (_engineReady && data.soil && data.engineInputs) {
            try {
                var _inputs = data.engineInputs;  // baked above by _buildEngineInputs

                var _engineResult = window.NutritionRequirementEngine_Pure.compute({
                    soil: data.soil,
                    turf: _inputs.turf,
                    climate: _inputs.climate,
                    overseedConfig: _inputs.overseedConfig
                });

                data.nutritionSummary.hasData = true;
                data.nutritionSummary.annualP = (_engineResult.perSample.P && _engineResult.perSample.P.annualRequirement) ?? null;
                data.nutritionSummary.annualK = (_engineResult.perSample.K && _engineResult.perSample.K.annualRequirement) ?? null;
                data.nutritionSummary.annualS = (_engineResult.perSample.S && _engineResult.perSample.S.annualRequirement) ?? null;
                data.nutritionSummary.pStatus = (_engineResult.perSample.P && _engineResult.perSample.P.status) || 'Unknown';
                data.nutritionSummary.kStatus = (_engineResult.perSample.K && _engineResult.perSample.K.status) || 'Unknown';
                data.nutritionSummary.sStatus = (_engineResult.perSample.S && _engineResult.perSample.S.status) || 'Unknown';
                data.nutritionSummary.monthlyN = _engineResult.facility.monthlyN;
                data.nutritionSummary.totalN = _engineResult.facility.totalN;
                data.nutritionSummary.activeMonths = _engineResult.facility.activeMonths;

                // b35fix327: expose structured per-sample ANR shape on data._anr,
                // mirroring the combined-export `r._anr` shape produced by the
                // post-loop ANR pass. This is what the K-reconciliation merge
                // (and any future intent-aware single-export renderer) reads
                // from. Pre-b35fix327 single export discarded `intent`,
                // `methodology`, `floor`, `ceiling`, `citation` etc. — only
                // four scalars survived onto data.nutritionSummary. That made
                // K-reconciliation classification (b35fix326a) impossible in
                // the single-export path because the trend-vs-advisory split
                // depends on `intent`. Symmetric assembly with combined export
                // means single-export Annual Product Summary now carries the
                // same amendment/K-recon entries combined-export does.
                function _shapeAnrSingle(perSampleNut) {
                    if (!perSampleNut) return null;
                    return {
                        // Legacy fields (backward compat with any pre-b35fix325 reader)
                        val: perSampleNut.annualRequirement,
                        status: perSampleNut.status,
                        // Structured fields (b35fix325 — SLAN methodology; source Carrow 2004 per b35fix333)
                        annual: perSampleNut.annualRequirement,
                        intent: perSampleNut.intent || null,
                        methodology: perSampleNut.methodology || null,
                        citation: perSampleNut.citation || null,
                        floor: perSampleNut.floor != null ? perSampleNut.floor : null,
                        ceiling: perSampleNut.ceiling != null ? perSampleNut.ceiling : null,
                        removal: perSampleNut.removal != null ? perSampleNut.removal : null,
                        correctionRequired: perSampleNut.correctionRequired != null
                                          ? perSampleNut.correctionRequired : 0,
                        currentLevel: perSampleNut.currentLevel != null
                                    ? perSampleNut.currentLevel : null
                    };
                }
                data._anr = {
                    P: _shapeAnrSingle(_engineResult.perSample.P),
                    K: _shapeAnrSingle(_engineResult.perSample.K),
                    S: _shapeAnrSingle(_engineResult.perSample.S)
                };

                _nutComputedViaEngine = true;
                console.log('[WordExport] nutritionSummary via engine:',
                    'P=' + data.nutritionSummary.annualP,
                    'K=' + data.nutritionSummary.annualK,
                    'S=' + data.nutritionSummary.annualS,
                    'totalN=' + data.nutritionSummary.totalN,
                    'species=' + _inputs.turf.species,
                    'hem=' + _inputs.climate.hemisphere,
                    'climateLive=' + _inputs.climate.isLive,
                    'overseed=' + !!_inputs.overseedConfig.isOverseed);
            } catch (_engineErr) {
                console.warn('[WordExport] Engine compute failed, falling back to cache:', _engineErr.message);
                _nutComputedViaEngine = false;
            }
        }

        // b35fix329: legacy fallback read removed. If the engine path didn't
        // fire (missing engineInputs, soil missing, or compute threw), the
        // section is dropped rather than rendered from a stale global. Mirrors
        // the combined-export "skip ANR — no silent fallback" rule.
        if (!_nutComputedViaEngine) {
            data.nutritionSummary.hasData = false;
            console.warn('[WordExport] b35fix329 nutritionSummary section dropped, ' +
                         'engine path did not fire (engineReady=' + _engineReady +
                         ', soilPresent=' + !!data.soil +
                         ', engineInputsPresent=' + !!data.engineInputs + '). ' +
                         'No legacy GAIP_NUTRITION_SOIL_CACHE fallback applied.');
        }

        // b35fix329a: upstream-writer detector. Fires whenever the legacy
        // global is being populated with engine-output keys, regardless of
        // whether the engine path itself succeeded. The detector's job is
        // independent of the section-drop diagnostic — chasing the upstream
        // writer doesn't require the engine to fail. Pre-b35fix329a this
        // detector was nested inside the !_nutComputedViaEngine block and
        // only fired on engine failure, which made it useless on healthy
        // exports (the case where polluting writers most often go unnoticed).
        // Read-side ignores the global either way; this is pure telemetry.
        if (window.GAIP_NUTRITION_SOIL_CACHE &&
            (window.GAIP_NUTRITION_SOIL_CACHE.annualP != null ||
             window.GAIP_NUTRITION_SOIL_CACHE.annualK != null ||
             window.GAIP_NUTRITION_SOIL_CACHE.totalN != null)) {
            console.warn('[WordExport] b35fix329 legacy cache still being written to ' +
                         'GAIP_NUTRITION_SOIL_CACHE, investigate upstream writer (read-side ignores it).');
        }
        
        // v10.3.38: Collect nutrition program (product recommendations)
        // Only include if generated for the current site (prevents stale cross-site data)
        ensureObject(data, 'nutritionProgram');
        if (window.GAIP_NUTRITION_PROGRAM) {
            var prog = window.GAIP_NUTRITION_PROGRAM;
            var currentSiteId = (window.GAIP_SampleManager && window.GAIP_SampleManager.getActiveSiteId) 
                ? window.GAIP_SampleManager.getActiveSiteId() : null;
            var progSiteId = prog._generatedForSite || null;
            
            // Accept if: no site tagging yet (legacy), or site matches
            if (!progSiteId || !currentSiteId || progSiteId === currentSiteId) {
                data.nutritionProgram.hasData = true;
                data.nutritionProgram.monthly = prog.monthly || [];
                data.nutritionProgram.annualSummary = prog.annualSummary || {};
                data.nutritionProgram.strategy = prog.strategy || {};
                // b35fix287: include Mulder's flags for Word export section
                data.nutritionProgram.muldersFlags = prog.muldersFlags || {};
            } else {
                console.warn('[WordExport] Skipping stale nutrition program, generated for', progSiteId, 'but current site is', currentSiteId);
            }
        }

        // ───────── b35fix327: amendment merge in single-export ─────────
        // Symmetric port of the combined-export merge block (word-export-
        // combined.js b35fix322/323/324). Closes the asymmetry that single-
        // export Annual Product Summary previously omitted soil-deficit
        // amendments and programme-shortfall spot-K, while combined export
        // included both. The narrative-only Annual Soil Amendments table
        // (buildAnnualSoilAmendmentsTable, called later in buildSections)
        // remains in place; this block adds the *product* entries to
        // annualSummary.products and the Monthly Schedule.
        //
        // Order constraints (same as combined):
        //   1. Decisions computed against the catalogue-only programme — the
        //      amendments themselves must not be visible to the programme-
        //      delivery probe inside _computeAmendmentDecision (the
        //      _isAmendment guard handles the case where a prior run already
        //      merged into the global GAIP_NUTRITION_PROGRAM).
        //   2. K-recon runs after the soil-deficit merge, but the SSOT helper
        //      _computeProgrammeKDelivered skips _isAmendment entries, so
        //      ordering is invariant for the K math.
        //
        // Belt-and-braces: if a previous combined-then-single workflow left
        // _isAmendment entries in the programme already, skip the merge
        // entirely (avoids duplicate amendment rows in Annual Product Summary).
        // The skill calls this out as Item 4 explicitly.
        try {
            var _wxA = window.GAIP_WordExport;
            if (data.nutritionProgram && data.nutritionProgram.hasData
                    && data.nutritionProgram.annualSummary
                    && data.nutritionProgram.annualSummary.products
                    && _wxA
                    && typeof _wxA._computeAmendmentDecision === 'function'
                    && typeof _wxA._amendmentDecisionsToProducts === 'function'
                    && data.soil && data.soil.thresholds) {

                var _productUsageA = data.nutritionProgram.annualSummary.products;

                // Defence: if any _isAmendment entry already present, the
                // programme has been amendment-merged before. Skip to avoid
                // double-injection. This protects the combined-then-single
                // workflow (user runs combined export first, then single
                // export of one of the same samples in the same browser
                // session — GAIP_NUTRITION_PROGRAM persists across exports).
                var _alreadyMerged = false;
                Object.keys(_productUsageA).forEach(function(pid) {
                    if (_productUsageA[pid] && _productUsageA[pid]._isAmendment) {
                        _alreadyMerged = true;
                    }
                });

                if (_alreadyMerged) {
                    console.log('[WordExport] b35fix327 amendment merge skipped, ' +
                                'programme already contains _isAmendment entries ' +
                                '(combined-then-single workflow)');
                } else {
                    var _soilForAmendA = data.soil;
                    var _surfaceTypeA = (data.soil.surfaceType) ||
                                        ((data.turf && (data.turf.subCategory || data.turf.type)) || '').toLowerCase();
                    var _hemA = (data.engineInputs && data.engineInputs.climate
                                 && data.engineInputs.climate.hemisphere) || 'south';
                    var _ocA = data.engineInputs && data.engineInputs.overseedConfig;
                    var _amendCtxA = {
                        isOverseed: !!(_ocA && _ocA.isOverseed),
                        seedingActive: !!(_ocA && _ocA.isOverseed)
                    };

                    // Build decisions for any nutrient with measured deficit.
                    var _amendNutrientsA = ['P','K','Ca','Mg','S'];
                    var _amendDecisionsA = [];
                    _amendNutrientsA.forEach(function(n) {
                        var v = _soilForAmendA[n];
                        var th = _soilForAmendA.thresholds[n];
                        if (v === undefined || v === null || !th) return;
                        if (!(v < th.min)) return;
                        var deficit = th.min - v;
                        // b35fix424 (C20): hemisphere threaded through for elem-S
                        // Rule 4 summer-suppression and dolomite spring-placement.
                        var d = _wxA._computeAmendmentDecision(
                            n, deficit, _soilForAmendA, _surfaceTypeA,
                            data.nutritionProgram, _amendCtxA, _hemA
                        );
                        if (d) _amendDecisionsA.push(d);
                    });

                    // Convert apply-decisions to product entries.
                    var _amendOutA = _wxA._amendmentDecisionsToProducts(
                        _amendDecisionsA, _soilForAmendA, _hemA
                    );

                    var _amendIdsA = Object.keys(_amendOutA.products);
                    if (_amendIdsA.length > 0) {
                        _amendIdsA.forEach(function(pid) {
                            // Namespace check (same as combined-export logic)
                            if (!_productUsageA[pid]) {
                                _productUsageA[pid] = _amendOutA.products[pid];
                            }
                        });

                        // Monthly Schedule injection (mirrors b35fix323).
                        var _monthlyA = data.nutritionProgram.monthly || [];
                        var _slotAbbrevA = (_amendOutA.monthSlot || '').slice(0, 3);
                        var _idxA = -1;
                        for (var _miA = 0; _miA < _monthlyA.length; _miA++) {
                            var _mnA = (_monthlyA[_miA] && _monthlyA[_miA].month_name) || '';
                            if (_mnA && _slotAbbrevA &&
                                _mnA.toLowerCase().indexOf(_slotAbbrevA.toLowerCase()) === 0) {
                                _idxA = _miA;
                                break;
                            }
                        }
                        if (_idxA === -1 && _monthlyA.length > _amendOutA.monthIndex) {
                            _idxA = _amendOutA.monthIndex;
                        }

                        var _granEntriesA = _amendOutA.granularEntries || [];
                        if (_idxA >= 0 && _granEntriesA.length > 0) {
                            if (!Array.isArray(_monthlyA[_idxA].granular)) {
                                _monthlyA[_idxA].granular = [];
                            }
                            _granEntriesA.forEach(function(g) {
                                var alreadyThere = _monthlyA[_idxA].granular.some(function(x) {
                                    return x && x.id === g.id;
                                });
                                if (!alreadyThere) _monthlyA[_idxA].granular.push(g);
                            });
                            console.log('[WordExport] b35fix327 amendment scheduled: ' +
                                        _granEntriesA.length + ' entry/entries → monthly[' +
                                        _idxA + '] (' +
                                        (_monthlyA[_idxA].month_name || 'unknown') + ')');
                        } else if (_granEntriesA.length > 0) {
                            console.warn('[WordExport] b35fix327 amendment NOT scheduled: ' +
                                         'could not resolve monthly slot ' +
                                         _amendOutA.monthSlot +
                                         ' (monthly.length=' + _monthlyA.length + ')');
                        }

                        console.log('[WordExport] b35fix327 amendments merged: ' +
                                    _amendIdsA.length + ' product(s), slot=' +
                                    _amendOutA.monthSlot + ' hem=' + _hemA);
                    }

                    // Expose structured decisions on data so the existing
                    // narrative renderer (buildAnnualSoilAmendmentsTable)
                    // and any future single-export consumer can read them
                    // without re-computing. Mirrors r.data._amendmentDecisions
                    // in combined.
                    data._amendmentDecisions = _amendDecisionsA;
                    data._amendmentMonthSlot = _amendOutA.monthSlot;

                    // ───────── K reconciliation merge (mirrors b35fix324) ─────────
                    // Programme-shortfall-driven spot-K. Reads K req from
                    // data._anr.K.val (set above in the engine block, b35fix327
                    // step 1). Falls back to data.nutritionSummary.annualK if
                    // _anr is absent (engine path failed, legacy cache fallback
                    // active — K-recon won't have intent fields anyway, so the
                    // renderer will treat it as legacy MLSN-style without
                    // distinguishing trend from advisory).
                    try {
                        var _kReq = (data._anr && data._anr.K && data._anr.K.val != null)
                                  ? parseFloat(data._anr.K.val)
                                  : (data.nutritionSummary && data.nutritionSummary.annualK != null
                                     ? parseFloat(data.nutritionSummary.annualK) : null);
                        if (typeof _wxA._synthesiseKReconDecision === 'function'
                                && typeof _wxA._computeProgrammeKDelivered === 'function'
                                && _kReq != null && isFinite(_kReq)) {
                            // SSOT: catalogue-only K — same function combined uses.
                            var _catalogueKA = _wxA._computeProgrammeKDelivered(_productUsageA);
                            data._programmeKDelivered = _catalogueKA;

                            var _kReconDecisionA = _wxA._synthesiseKReconDecision(
                                _soilForAmendA, _kReq, _catalogueKA
                            );

                            if (_kReconDecisionA) {
                                var _kReconOutA = _wxA._amendmentDecisionsToProducts(
                                    [_kReconDecisionA], _soilForAmendA, _hemA
                                );

                                Object.keys(_kReconOutA.products).forEach(function(pid) {
                                    if (!_productUsageA[pid]) {
                                        _productUsageA[pid] = _kReconOutA.products[pid];
                                    }
                                });

                                // Split granular entries placed by _monthIndex
                                // (Sep/Nov/Jan south, Mar/May/Jul north).
                                var _monthAbbrevsA = ['Jan','Feb','Mar','Apr','May','Jun',
                                                      'Jul','Aug','Sep','Oct','Nov','Dec'];
                                var _placedCountA = 0, _missedCountA = 0;
                                (_kReconOutA.granularEntries || []).forEach(function(g) {
                                    var targetIdx = g._monthIndex;
                                    var resolvedIdx = -1;
                                    if (typeof targetIdx === 'number' &&
                                            targetIdx >= 0 && targetIdx < 12) {
                                        var targetAbbrev = _monthAbbrevsA[targetIdx];
                                        for (var _kiA = 0; _kiA < _monthlyA.length; _kiA++) {
                                            var _kmnA = (_monthlyA[_kiA] && _monthlyA[_kiA].month_name) || '';
                                            if (_kmnA && targetAbbrev &&
                                                    _kmnA.toLowerCase().indexOf(targetAbbrev.toLowerCase()) === 0) {
                                                resolvedIdx = _kiA;
                                                break;
                                            }
                                        }
                                        if (resolvedIdx === -1 && _monthlyA.length > targetIdx) {
                                            resolvedIdx = targetIdx;
                                        }
                                    }
                                    if (resolvedIdx >= 0) {
                                        if (!Array.isArray(_monthlyA[resolvedIdx].granular)) {
                                            _monthlyA[resolvedIdx].granular = [];
                                        }
                                        var alreadyThere = _monthlyA[resolvedIdx].granular.some(function(x) {
                                            return x && x.id === g.id;
                                        });
                                        if (!alreadyThere) {
                                            _monthlyA[resolvedIdx].granular.push(g);
                                            _placedCountA++;
                                        }
                                    } else {
                                        _missedCountA++;
                                    }
                                });

                                console.log('[WordExport] b35fix327 K-recon spot-K: ' +
                                            _placedCountA + ' split(s) placed' +
                                            (_missedCountA > 0 ? ', ' + _missedCountA + ' unresolved' : '') +
                                            ' (kReq=' + _kReq.toFixed(0) +
                                            ', kDel=' + _catalogueKA.toFixed(0) +
                                            ', balance=' + (_catalogueKA - _kReq).toFixed(0) +
                                            ', soilK=' + (_soilForAmendA.K || '?') +
                                            ', floor=' + ((_soilForAmendA.thresholds && _soilForAmendA.thresholds.K && _soilForAmendA.thresholds.K.min) || '?') + ')');

                                if (!Array.isArray(data._kReconDecisions)) {
                                    data._kReconDecisions = [];
                                }
                                data._kReconDecisions.push(_kReconDecisionA);
                            }
                        }
                    } catch (_kReconErrA) {
                        console.warn('[WordExport] b35fix327 K-recon merge failed: ' +
                                     (_kReconErrA && _kReconErrA.message));
                    }
                    // ───────── end K-recon merge ─────────
                }
            }
        } catch (_amendErrA) {
            console.warn('[WordExport] b35fix327 amendment merge failed: ' +
                         (_amendErrA && _amendErrA.message));
        }
        // ───────── end b35fix327 amendment merge ─────────

        // Collect spray log entries for current site
        // b35fix436 / C45 (revised): the b35fix435 filter at this scope was a
        // no-op in the combined-export path because data.turf.subCategory does
        // not vary per-sample inside collectData (the per-sample loop in
        // word-export-combined.js doesn't call setActiveSample per iteration,
        // so getActiveSample('soil') and the DOM read both return the same
        // last-active-sample value across iterations). The correct scope for
        // per-sample spray-log filtering is word-export-combined.js, where
        // entry.sampleLabel is in scope per-iteration. The single-export path
        // here writes the unfiltered cache; word-export-combined.js applies
        // the surface-aware filter after this collectData call returns.
        // For a single-sample export the unfiltered write is correct (one
        // section, one surface, all entries shown).
        ensureObject(data, 'sprayLog');
        try {
            var slUI = window.GAIP_SprayLogUI;
            if (slUI && typeof slUI.getEntries === 'function') {
                var slEntries = slUI.getEntries();
                if (slEntries && slEntries.length > 0) {
                    data.sprayLog.entries = slEntries;
                    data.sprayLog.hasData = true;
                }
            }
        } catch (slErr) {
            console.warn('[WordExport] Could not collect spray log:', slErr);
        }
        
        // v2.0.28: Collect export metadata (confidence/data quality) from GilbaExportMetadata
        try {
            if (typeof GilbaExportMetadata !== 'undefined' && typeof GilbaExportMetadata.harvestEngineConfidence === 'function') {
                var confidence = GilbaExportMetadata.harvestEngineConfidence();
                if (confidence && confidence.count > 0) {
                    data._exportMetadata = {
                        confidence: confidence,
                        hasData: true,
                        average: Math.round(confidence.average),
                        lowest: confidence.lowest,
                        lowestEngine: confidence.lowestEngine,
                        count: confidence.count,
                        engines: confidence.engines || {},
                        level: confidence.average >= 80 ? 'HIGH' : confidence.average >= 60 ? 'MODERATE' : 'LOW',
                        generatedAt: new Date().toISOString()
                    };
                } else {
                }
            } else {
            }
        } catch (metaErr) {
            console.warn('[WordExport] Could not collect export metadata:', metaErr);
        }
        
        // Nutrient Trend data from GilbaNutrientTrend (soil, tissue, water)
        ensureObject(data, 'nutrientTrend');
        try {
            if (window.GilbaNutrientTrend && typeof window.GilbaNutrientTrend.getTrendExportData === 'function') {
                var trendTypes = ['soil', 'tissue', 'water'];
                var totalZones = 0;
                data.nutrientTrend.types = {};
                
                for (var tt = 0; tt < trendTypes.length; tt++) {
                    var tType = trendTypes[tt];
                    var trendExport = window.GilbaNutrientTrend.getTrendExportData(tType);
                    if (trendExport && Object.keys(trendExport).length > 0) {
                        data.nutrientTrend.types[tType] = trendExport;
                        totalZones += Object.keys(trendExport).length;
                    }
                }
                
                data.nutrientTrend.hasData = totalZones > 0;
                if (!data.nutrientTrend.hasData) {
                }
            } else {
                data.nutrientTrend.hasData = false;
            }
        } catch (trendErr) {
            console.warn('[WordExport] Could not collect nutrient trend data:', trendErr);
            data.nutrientTrend.hasData = false;
        }
        
        // Amendment engine — runs if soil-tissue integration is loaded and we have soil data
        ensureObject(data, 'amendment');
        try {
            var amendFn = window.GilbaSoilTissueIntegration && 
                          window.GilbaSoilTissueIntegration.recommendSoilAmendments;
            if (amendFn && data.soil && data.soil.hasData) {
                // b35fix311: gate by sample freshness. Amendment recommendations
                // must come from current soil chemistry — computing lime/gypsum
                // kg/ha from a 2-year-old sample is worse than silence.
                // Respects the per-site `allowStaleRecommendations` opt-out.
                var _amendSample = null;
                var _amendSiteId = null;
                var _amendFresh = true;
                try {
                    var _sm = window.GAIP_SampleManager;
                    if (_sm && typeof _sm.getActiveSample === 'function') {
                        _amendSample = _sm.getActiveSample('soil');
                    }
                    if (_sm && typeof _sm.getAllSamples === 'function') {
                        var _all = _sm.getAllSamples();
                        // Derive current site id if possible (used by canDriveRecommendations
                        // to check per-site opt-out)
                        _amendSiteId = _all && _all.currentSite;
                    }
                    if (_sm && typeof _sm.canDriveRecommendations === 'function' && _amendSample) {
                        _amendFresh = _sm.canDriveRecommendations(_amendSample, _amendSiteId);
                    }
                } catch (_gateErr) { /* best-effort; stay fresh=true if anything fails */ }

                if (!_amendFresh) {
                    // Stale: suppress recommendations, leave a marker for the renderer
                    data.amendment.hasData = false;
                    data.amendment.suppressedForStaleness = true;
                    data.amendment.sampleDate = _amendSample && _amendSample.date;
                    data.amendment.thresholdMonths = (window.GAIP_SampleManager &&
                        window.GAIP_SampleManager.STALENESS_CONFIG &&
                        window.GAIP_SampleManager.STALENESS_CONFIG.thresholdMonths) || 18;
                } else {
                // Build soilState from collected data
                var soilState = {
                    pH_cacl2:    data.soil.pH_cacl2 || (data.soil.pH ? data.soil.pH - 0.5 : null),
                    pH_water:    data.soil.pH || null,
                    Ca:          data.soil.Ca  || null,
                    Mg:          data.soil.Mg  || null,
                    K:           data.soil.K   || null,
                    Na:          data.soil.Na  || null,
                    CEC:         data.soil.CEC || null,
                    LOI:         data.soil.OM  || null,
                    construction: (window.GAIP_STATE && window.GAIP_STATE.turf && 
                                   window.GAIP_STATE.turf.construction) || null
                };
                // Build mlsnResults from state
                var mlsnRes = (window.GAIP_STATE && window.GAIP_STATE.mlsnResults) || {};
                // Build waterQuality from collected water data
                var wq = {
                    EC:  data.water && data.water.EC  || null,
                    SAR: data.water && data.water.SAR || null,
                    Na:  data.water && data.water.Na  || null,
                    SO4: data.water && data.water.SO4 || null
                };
                // Weather context
                var wx = {
                    annualRainfall: (window.climateMetrics && window.climateMetrics.rainfall) || null,
                    soilTemp:       (window.climateMetrics && window.climateMetrics.temperature && 
                                     window.climateMetrics.temperature.mean) || null
                };
                var amendResult = amendFn(soilState, mlsnRes, wq, wx, {});
                if (amendResult) {
                    data.amendment.hasData    = true;
                    data.amendment.Ca         = amendResult.Ca   || null;
                    data.amendment.Mg         = amendResult.Mg   || null;
                    data.amendment.interactions = amendResult.interactions || [];
                    data.amendment.summary    = amendResult.summary || [];
                }
                }   // end fresh branch
            }
        } catch (amendErr) {
            console.warn('[WordExport] Amendment engine error:', amendErr);
            data.amendment.hasData = false;
        }
        
        return data;
    }
    
    // Generate executive summary based on collected data
    function generateExecutiveSummary(data) {
        var flags = [];
        var status = 'good';
        
        // Check disease risk
        if (data.disease && data.disease.overallRisk) {
            var risk = data.disease.overallRisk.toLowerCase();
            if (risk === 'high' || risk === 'severe' || risk === 'critical') {
                flags.push('HIGH disease risk (' + (data.disease.primaryThreat || 'multiple pathogens') + ')');
                status = 'critical';
            } else if (risk === 'moderate' || risk === 'elevated') {
                flags.push('Elevated disease pressure');
                if (status !== 'critical') status = 'warning';
            }
        }
        
        // Check stress trajectory
        if (data.trajectory && data.trajectory.currentScore !== null) {
            if (data.trajectory.currentScore >= 70) {
                flags.push('HIGH stress score (' + data.trajectory.currentScore + ')');
                status = 'critical';
            } else if (data.trajectory.currentScore >= 50) {
                flags.push('Elevated stress (' + data.trajectory.currentScore + ')');
                if (status !== 'critical') status = 'warning';
            }
            if (data.trajectory.criticalPoints > 0) {
                flags.push(data.trajectory.criticalPoints + ' critical point(s) in 14-day forecast');
            }
        }
        
        // Check shade/DLI deficit
        if (data.shade && data.shade.deficit && data.shade.deficit > 20) {
            flags.push('Light deficit: ' + data.shade.deficit + '% below target DLI');
            if (status !== 'critical') status = 'warning';
        }
        
        // Check irrigation status
        if (data.irrigation && data.irrigation.status) {
            var irrStatus = data.irrigation.status.toLowerCase();
            if (irrStatus.indexOf('stress') > -1 || irrStatus.indexOf('critical') > -1) {
                flags.push('Irrigation: ' + data.irrigation.status);
                if (status !== 'critical') status = 'warning';
            }
        }
        
        // Check water quality
        if (data.water && data.water.sodiumHazard && data.water.sodiumHazard.toLowerCase() !== 'low') {
            flags.push('Water sodium hazard: ' + data.water.sodiumHazard);
            if (status !== 'critical') status = 'warning';
        }
        
        // b35fix433 (C42): exec-summary dew flag removed in lockstep with the
        // Dew Forecast & Match Conditions section emit. Dew forecast severity is
        // surfaced live in the hub dashboard, not in the static export.
        
        // Check traffic/wear
        if (data.traffic && data.traffic.status) {
            var wearStatus = data.traffic.status.toLowerCase();
            if (wearStatus.indexOf('high') > -1 || wearStatus.indexOf('excessive') > -1) {
                flags.push('High wear load');
                if (status !== 'critical') status = 'warning';
            }
        }
        
        // Build summary text
        var summaryText;
        if (flags.length === 0) {
            summaryText = 'All parameters within acceptable ranges. No immediate action required.';
        } else if (status === 'critical') {
            summaryText = 'ATTENTION REQUIRED: ' + flags.join('. ') + '.';
        } else {
            summaryText = 'Items to monitor: ' + flags.join('. ') + '.';
        }
        
        return { text: summaryText, status: status, flags: flags };
    }
    
    // Build document sections
    function buildSections(data, charts) {
        charts = charts || {};
        var sections = [];
        
        // Get branding info
        var logo = typeof GAIP_getReportLogo === 'function' ? GAIP_getReportLogo() : null;
        var orgName = typeof GAIP_getOrgName === 'function' ? GAIP_getOrgName() : '';
        console.log('[WordExport] Logo check: ' + (logo ? 'found (w=' + logo.width + ' h=' + logo.height + ' type=' + logo.type + ')' : 'not found'));
        
        // Logo (if uploaded)
        if (logo && logo.base64) {
            try {
                // Extract base64 data (remove data URL prefix)
                var base64Data = logo.base64.split(',')[1] || logo.base64;
                
                // Scale logo to reasonable size (max 180px wide, 80px tall)
                var maxW = 180, maxH = 80;
                var scale = Math.min(maxW / logo.width, maxH / logo.height, 1);
                var w = Math.round(logo.width * scale);
                var h = Math.round(logo.height * scale);
                
                sections.push(new Paragraph({
                    alignment: AlignmentType.CENTER,
                    spacing: { after: 120 },
                    children: [new ImageRun({
                        type: logo.type.includes('png') ? 'png' : 'jpg',
                        data: Uint8Array.from(atob(base64Data), function(c) { return c.charCodeAt(0); }),
                        transformation: { width: w, height: h },
                        altText: {
                            title: 'Organisation Logo',
                            description: 'Custom logo for report header',
                            name: 'logo_header'
                        }
                    })]
                }));
            } catch (e) {
                console.warn('[WordExport] Error adding logo:', e);
            }
        }
        
        // Organisation name (if provided)
        if (orgName) {
            sections.push(new Paragraph({
                alignment: AlignmentType.CENTER,
                spacing: { after: 60 },
                children: [new TextRun({ text: orgName, bold: true, size: 26, color: '374151' })]
            }));
        }
        
        // Title
        sections.push(new Paragraph({ 
            heading: HeadingLevel.TITLE, 
            children: [new TextRun('Gilba Agronomic Intelligence Hub')] 
        }));
        sections.push(new Paragraph({ 
            alignment: AlignmentType.CENTER,
            spacing: { after: 200 },
            children: [new TextRun({ text: 'Comprehensive Analysis Report', size: 28, color: '6B7280' })] 
        }));
        
        // Executive Summary — suppressed in combined export (site-level, shown once separately)
        var summary = generateExecutiveSummary(data);
        if (!window.GAIP_COMBINED_EXPORT_ACTIVE) {
            var summaryColor = summary.status === 'critical' ? 'DC2626' : 
                              summary.status === 'warning' ? 'F59E0B' : '16A34A';
            var summaryBg = summary.status === 'critical' ? 'FEF2F2' : 
                            summary.status === 'warning' ? 'FFFBEB' : 'F0FDF4';
            
            sections.push(new Paragraph({
                spacing: { before: 200, after: 100 },
                shading: { fill: summaryBg, type: ShadingType.CLEAR },
                border: {
                    top: { style: BorderStyle.SINGLE, size: 1, color: summaryColor },
                    bottom: { style: BorderStyle.SINGLE, size: 1, color: summaryColor },
                    left: { style: BorderStyle.SINGLE, size: 24, color: summaryColor },
                    right: { style: BorderStyle.SINGLE, size: 1, color: summaryColor }
                },
                children: [
                    new TextRun({ text: 'EXECUTIVE SUMMARY: ', bold: true, size: 24, color: summaryColor }),
                    new TextRun({ text: summary.text, size: 22, color: '374151' })
                ]
            }));
            sections.push(new Paragraph({ children: [] }));
            
            // Data quality badge (compact metadata indicator)
            if (data._exportMetadata && typeof GilbaExportMetadata !== 'undefined') {
                var badgeElements = GilbaExportMetadata.createMetadataBadge(data._exportMetadata);
                if (badgeElements && badgeElements.length > 0) {
                    badgeElements.forEach(function(el) { sections.push(el); });
                }
            }
        }
        
        // Generate priority actions early
        var priorityActions = generatePriorityActions(data);
        
        // Priority Actions Section (if there are any)
        if (priorityActions.hasActions) {
            sections.push(new Paragraph({ 
                heading: HeadingLevel.HEADING_1, keepNext: true,
                children: [new TextRun('Priority Actions')] 
            }));
            
            // Add species context note if overseed
            if (priorityActions.isC3 && data.turf && data.turf.c3Fraction >= 0.5) {
                sections.push(new Paragraph({
                    spacing: { before: 50, after: 100 },
                    children: [new TextRun({ 
                        text: 'Thresholds based on ' + priorityActions.effectiveSpecies + ' tolerances (' + Math.round(data.turf.c3Fraction * 100) + '% cover)',
                        size: 20, italics: true, color: '6B7280'
                    })]
                }));
            }
            
            // Immediate Actions (0-7 days) - RED
            if (priorityActions.immediate.length > 0) {
                sections.push(new Paragraph({
                    spacing: { before: 100, after: 50 },
                    shading: { fill: 'FEF2F2', type: ShadingType.CLEAR },
                    border: { left: { style: BorderStyle.SINGLE, size: 24, color: 'DC2626' } },
                    children: [new TextRun({ text: '⚠️ IMMEDIATE (0-7 days)', bold: true, size: 22, color: 'DC2626' })]
                }));
                priorityActions.immediate.forEach(function(action) {
                    sections.push(new Paragraph({
                        spacing: { before: 50, after: 50 },
                        indent: { left: 400 },
                        children: [new TextRun({ text: '• ' + action, size: 20 })]
                    }));
                });
            }
            
            // Short-term Actions (7-30 days) - AMBER
            if (priorityActions.shortTerm.length > 0) {
                sections.push(new Paragraph({
                    spacing: { before: 100, after: 50 },
                    shading: { fill: 'FFFBEB', type: ShadingType.CLEAR },
                    border: { left: { style: BorderStyle.SINGLE, size: 24, color: 'F59E0B' } },
                    children: [new TextRun({ text: '⏰ SHORT-TERM (7-30 days)', bold: true, size: 22, color: 'F59E0B' })]
                }));
                priorityActions.shortTerm.forEach(function(action) {
                    sections.push(new Paragraph({
                        spacing: { before: 50, after: 50 },
                        indent: { left: 400 },
                        children: [new TextRun({ text: '• ' + action, size: 20 })]
                    }));
                });
            }
            
            // Medium-term Actions (30-90 days) - BLUE
            if (priorityActions.mediumTerm.length > 0) {
                sections.push(new Paragraph({
                    spacing: { before: 100, after: 50 },
                    shading: { fill: 'EFF6FF', type: ShadingType.CLEAR },
                    border: { left: { style: BorderStyle.SINGLE, size: 24, color: '3B82F6' } },
                    children: [new TextRun({ text: '📋 MEDIUM-TERM (30-90 days)', bold: true, size: 22, color: '3B82F6' })]
                }));
                priorityActions.mediumTerm.forEach(function(action) {
                    sections.push(new Paragraph({
                        spacing: { before: 50, after: 50 },
                        indent: { left: 400 },
                        children: [new TextRun({ text: '• ' + action, size: 20 })]
                    }));
                });
            }
            
            sections.push(new Paragraph({ children: [] }));
        }
        
        // Static Contents List (avoids ToC update issues with page breaks)
        // Contents — suppressed in combined export (each green is a section, no per-green TOC needed)
        // Helper: build section context from explicit label or site+turf fallback
        // Declared here (outside Contents block) so it's available throughout buildSections.
        function getSectionContext(explicitLabel) {
            if (explicitLabel) return explicitLabel;
            var parts = [];
            if (data.site && data.site.name && data.site.name !== 'Not specified') {
                parts.push(data.site.name);
            }
            var tt = (data.turf.type || '').replace(/^Golf\s*-\s*/i, '').replace(/^Sports\s*-\s*/i, '').trim();
            if (tt) parts.push(tt);
            return parts.length > 0 ? parts.join(', ') : '';
        }

        if (!window.GAIP_COMBINED_EXPORT_ACTIVE) {
            sections.push(new Paragraph({ 
                heading: HeadingLevel.HEADING_2, keepNext: true,
                children: [new TextRun('Contents')] 
            }));
        
            // Build static contents based on what sections exist
            var contentItems = [];
        
        // Check if priority actions exist for contents
        if (priorityActions.hasActions) {
            contentItems.push('• Priority Actions');
        }
        
        if (window.GAIP_SYNTHESIS_INTERPRETATION && window.GAIP_SYNTHESIS_INTERPRETATION.narrative && !window.GAIP_COMBINED_EXPORT_ACTIVE) {
            contentItems.push('• Cross-Module Pattern Analysis');
        }
        
        contentItems.push('• Site Information');
        if (data.soil && (data.soil.hasData || data.soil.hasResults || data.soil.P || data.soil.K || data.soil.Ca)) {
            var soilTocCtx = getSectionContext(data.soil.sampleLabel);
            var soilTocLabel = '• Soil Nutrition (' + (data.soil.methodology || 'MLSN') + ')';
            if (soilTocCtx) soilTocLabel += ', ' + soilTocCtx;
            contentItems.push(soilTocLabel);
            if (data.climate && (data.climate.temperature || data.climate.growthPotential)) {
                contentItems.push('• Climate & Growth Conditions');
            }
            
            // Check for cation balance data
            var cationBalance = generateCationBalance(data);
            if (cationBalance && cationBalance.hasData) {
                contentItems.push('• Cation Balance Analysis');
            }
            
            // Check for nutrition summary data
            if (data.nutritionSummary && data.nutritionSummary.hasData && !window.GAIP_COMBINED_EXPORT_ACTIVE) {
                contentItems.push('• Annual Nutrient Requirements');
            }
            // Amendment recommendations
            if (data.amendment && data.amendment.hasData) {
                contentItems.push('• Soil Amendment Recommendations');
            }
        }
        if (data.tissue && (data.tissue.N || data.tissue.K) && (data.tissue.N > 0 || data.tissue.K > 0)) {
            var tissueTocCtx = getSectionContext(data.tissue.sampleLabel);
            var tissueTocLabel = '• Tissue Analysis';
            if (tissueTocCtx) tissueTocLabel += ', ' + tissueTocCtx;
            contentItems.push(tissueTocLabel);
        }
        if (data.nProgram && data.nProgram.hasData) {
            contentItems.push('• N Program Validation');
        }
        if (data.nutrientTrend && data.nutrientTrend.hasData) {
            contentItems.push('• Nutrient Trend Analysis');
        }
        if (data.water && (data.water.EC > 0 || data.water.SAR > 0)) {
            var waterTocCtx = getSectionContext(data.water.sourceLabel);
            var waterTocLabel = '• Water Quality';
            if (waterTocCtx) waterTocLabel += ', ' + waterTocCtx;
            contentItems.push(waterTocLabel);
            
            // Check for soil×water interactions
            var soilWaterInteractions = generateSoilWaterInteractions(data);
            if (soilWaterInteractions && soilWaterInteractions.hasData) {
                contentItems.push('• Soil × Water Interactions');
            }
            
            // v2.0.8: Salinity Impact section
            if (data.salinity && data.salinity.hasData && data.salinity.growthPenaltyPct > 0 && !window.GAIP_COMBINED_EXPORT_ACTIVE) {
                contentItems.push('• Salinity Stress Impact');
            }
        }
        if (data.shade && data.shade.currentDLI) {
            contentItems.push('• Light & Shade Analysis');
        }
        if (data.pgr && data.pgr.product && !window.GAIP_COMBINED_EXPORT_ACTIVE) {
            contentItems.push('• PGR Program Status');
        }
        if (data.dmi && data.dmi.product) {
            contentItems.push('• DMI Fungicide Growth Effect');
        }
        // b35fix429 (C30): Moisture Management and Disease Risk Assessment
        // section emits removed; TOC entries removed in lockstep. Hub-redirect
        // stub at top of report directs readers to the live hub dashboard.
        if (data.trajectory && data.trajectory.currentScore) {
            contentItems.push('• Stress Trajectory');
        }
        // b35fix433 (C42): Dew Prediction TOC entry removed in lockstep with section emit.
        if (data.traffic && data.traffic.hasData) {
            contentItems.push('• Traffic & Wear Analysis');
        }
        if (data.overseedClimate && data.overseedClimate.hasData) {
            var oscStage = (data.overseedClimate.stage || '').toLowerCase();
            var isOscTransition = (oscStage === 'transitioning' || oscStage === 'fading' || oscStage === 'dying');
            contentItems.push(isOscTransition ? '• Overseed Transition Status' : '• Overseed Climate Assessment');
        }
        // Check if Performance Impact Analysis will be generated - 
        // covers soil/water/tissue/climate interactions and variety traits
        // b35fix448 / C25: TOC predictor upgraded in lockstep with the
        // generatePerformanceImpactAnalysis proxies above (L4344-L4348).
        // Same pre-canonical defect, same fix: read the canonical hasData
        // flag where producers publish one. Climate and shade retain their
        // field-truthiness proxies because their producers don't write
        // canonical flags. hasShadeData stays as-is (separate threshold,
        // separate semantic; not a hasData proxy).
        var hasSoilData = !!(data.soil && data.soil.hasData);
        var hasTissueData = !!(data.tissue && data.tissue.hasData);
        var hasWaterData = !!(data.water && data.water.hasData);
        var hasClimateData = data.climate && data.climate.growthPotential !== undefined;
        var hasShadeData = data.shade && data.shade.deficit > 10;
        var hasVarietyData = data.varietyTraits && data.varietyTraits.hasData;
        
        var willHaveImpacts = hasVarietyData ||
                              (hasWaterData && hasSoilData) ||
                              (hasTissueData && hasSoilData) ||
                              (hasClimateData && (hasTissueData || data.traffic)) ||
                              hasShadeData ||
                              (data.water && data.water.EC > 0.75);
        if (willHaveImpacts) {
            contentItems.push('• Performance Impact Analysis');
        }
        
        // v10.3.38: Add Nutrition Program if generated
        if (data.nutritionProgram && data.nutritionProgram.hasData) {
            contentItems.push('• Nutrition Program');
        }
        
        // Add Spray Application Log if entries exist
        if (data.sprayLog && data.sprayLog.hasData) {
            contentItems.push('• Spray Application Log');
        }
        
        // Add cultivar profile if variety selected
        var hasVarietyData = (data.turf && data.turf.variety && data.turf.variety !== 'generic') ||
                             (data.turf && data.turf.effectiveVariety && data.turf.effectiveVariety !== 'generic');
        if (hasVarietyData) {
            contentItems.push('• Cultivar Performance Profile');
        }
        
        contentItems.push('• References & Methodology');
        if (data._exportMetadata) {
            contentItems.push('• Report Metadata & Data Quality');
        }
        contentItems.push('• Glossary of Terms');
        
        sections.push(new Paragraph({
            spacing: { before: 100, after: 200 },
            children: [new TextRun({ text: contentItems.join('\n'), size: 22 })]
        }));
        sections.push(new Paragraph({ children: [] }));
        } // end !GAIP_COMBINED_EXPORT_ACTIVE (Contents block)
        
        // ========================================
        // CROSS-MODULE SYNTHESIS INTERPRETATION v1.0.0
        // Moved to front of report — synthesis before detail.
        // AI-generated pattern analysis across soil, water, and tissue.
        // Suppressed in combined export (injected once at document level).
        // ========================================
        var synthesisInterpretation = window.GAIP_SYNTHESIS_INTERPRETATION;
        if (synthesisInterpretation && synthesisInterpretation.narrative && !window.GAIP_COMBINED_EXPORT_ACTIVE) {
            sections.push(new Paragraph({
                pageBreakBefore: true,
                heading: HeadingLevel.HEADING_1,
                keepNext: true,
                children: [new TextRun('Cross-Module Pattern Analysis')]
            }));
            
            sections.push(new Paragraph({
                spacing: { before: 50, after: 150 },
                children: [new TextRun({
                    text: 'AI-assisted analysis identifying interactions and anomalies across soil, water, and tissue data.',
                    size: 20, italics: true, color: '6B7280'
                })]
            }));
            
            // Process narrative - handle bold markers and headers
            var synthNarrative = synthesisInterpretation.narrative;
            
            // Remove markdown headers (we'll handle structure manually)
            synthNarrative = synthNarrative.replace(/^##+ /gm, '');
            
            // Convert bold markers
            synthNarrative = synthNarrative.replace(/\*\*(.+?)\*\*/g, '<<BOLD>>$1<</BOLD>>');
            
            // Split into paragraphs
            var synthParagraphs = synthNarrative.split(/\n\n+/);
            synthParagraphs.forEach(function(para) {
                if (!para.trim()) return;
                
                // Check if this is a header line (Key Findings, Pattern Analysis, etc)
                var isHeader = /^(Key Findings|Pattern Analysis|Recommended Actions|Monitoring Priority)/i.test(para.trim());
                
                if (isHeader) {
                    var headerText = para.trim().split('\n')[0].replace(/<<BOLD>>|<<\/BOLD>>/g, '');
                    sections.push(new Paragraph({
                        spacing: { before: 200, after: 80 },
                        children: [new TextRun({
                            text: headerText,
                            bold: true,
                            size: 22,
                            color: '1F2937'
                        })]
                    }));
                    para = para.split('\n').slice(1).join('\n');
                    if (!para.trim()) return;
                }
                
                // Handle bullet points
                if (para.trim().startsWith('-') || para.trim().startsWith('•')) {
                    var bulletLines = para.split('\n').filter(function(l) { return l.trim(); });
                    bulletLines.forEach(function(line) {
                        line = line.replace(/^[-•]\s*/, '');
                        var bulletChildren = [];
                        var bParts = line.split(/<<BOLD>>|<<\/BOLD>>/);
                        var isBoldB = false;
                        bParts.forEach(function(part) {
                            if (part) {
                                bulletChildren.push(new TextRun({
                                    text: part, bold: isBoldB, size: 20,
                                    color: isBoldB ? '374151' : '374151'
                                }));
                            }
                            isBoldB = !isBoldB;
                        });
                        sections.push(new Paragraph({
                            spacing: { before: 40, after: 40 },
                            indent: { left: 300 },
                            bullet: { level: 0 },
                            children: bulletChildren
                        }));
                    });
                    return;
                }
                
                // Regular paragraph with bold handling
                var synChildren = [];
                var sParts = para.split(/<<BOLD>>|<<\/BOLD>>/);
                var isBoldS = false;
                sParts.forEach(function(part) {
                    if (part) {
                        synChildren.push(new TextRun({
                            text: part, bold: isBoldS, size: 20,
                            color: isBoldS ? '374151' : '374151'
                        }));
                    }
                    isBoldS = !isBoldS;
                });
                sections.push(new Paragraph({ spacing: { after: 100 }, children: synChildren }));
            });
            
            if (synthesisInterpretation.cached) {
                sections.push(new Paragraph({
                    spacing: { before: 50, after: 100 },
                    children: [new TextRun({ text: '(Cached analysis)', size: 14, italics: true, color: '9CA3AF' })]
                }));
            }
            sections.push(new Paragraph({ children: [] }));
        }

        // ─────────────────────────────────────────────────────────────────
        // b35fix429 (C30): Hub-redirect stub
        //
        // Pre-Emergent Herbicide Timing, Disease Risk Assessment, and
        // Moisture Management section emits were removed because each is
        // weather-driven and the hub dashboard updates them live. A static
        // export captures point-in-time values that drift the moment the
        // docx is generated. The stub below replaces all three sections
        // with a single banner directing readers to the live dashboard.
        //
        // Disease and Irrigation data-prep is preserved (consumed by
        // Performance Impact Analysis and Active Alerts banner cross-section
        // readers); Pre-Emergent data-prep was deleted because it had no
        // cross-section consumers.
        // ─────────────────────────────────────────────────────────────────
        sections.push(new Paragraph({
            spacing: { before: 200, after: 200 },
            children: [new TextRun({
                text: 'Live disease pressure, irrigation status, and pre-emergent timing update against current weather in the GAIP Hub dashboard. This export captures soil chemistry and recommendations only.',
                size: 20,
                italics: true,
                color: '4B5563'
            })]
        }));

        // Site info section
        sections.push(new Paragraph({ 
            heading: HeadingLevel.HEADING_1, keepNext: true, pageBreakBefore: true,
            children: [new TextRun('Site Information')] 
        }));
        
        var siteRows = [];
        siteRows.push(createKeyValueRow('Site', data.site.name));
        siteRows.push(createKeyValueRow('Location', data.site.location));
        siteRows.push(createKeyValueRow('Analysis Date', data.site.date));
        siteRows.push(createKeyValueRow('Turf Type', data.turf.type || 'Not specified'));
        siteRows.push(createKeyValueRow('Species', data.turf.speciesDisplay || data.turf.species || 'Not specified'));
        
        // Show variety - use effective variety for overseed dominant
        var displayVariety = data.turf.overseedDominant ? data.turf.effectiveVariety : data.turf.variety;
        if (displayVariety && displayVariety !== 'generic') {
            siteRows.push(createKeyValueRow('Variety', displayVariety));
        }
        
        // Add management focus note for overseed situations
        if (data.turf.effectiveSpeciesNote) {
            siteRows.push(createKeyValueRow('Management Focus', data.turf.effectiveSpeciesNote));
        }
        
        sections.push(createTable(siteRows));
        sections.push(new Paragraph({ children: [] }));
        
        // Soil Nutrition section - use correct methodology label
        if (data.soil && (data.soil.P || data.soil.K || data.soil.Ca || data.soil.Mg)) {
            var soilMethodLabel = data.soil.methodology || 'MLSN';
            
            // Build heading with sample context (explicit label or auto from site+turf)
            var soilHeading = 'Soil Nutrition (' + soilMethodLabel + ')';
            var soilContext = getSectionContext(data.soil.sampleLabel);
            if (soilContext) {
                soilHeading += ', ' + soilContext;
            }
            
            sections.push(new Paragraph({ 
                heading: HeadingLevel.HEADING_1, keepNext: true, 
                children: [new TextRun(soilHeading)] 
            }));
            
            // Show sample metadata line (date, lab ref, area, species)
            var soilMetaParts = [];
            if (data.soil.testDate) {
                var soilDate = new Date(data.soil.testDate);
                soilMetaParts.push('Sampled: ' + soilDate.toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' }));
            }
            if (data.soil.labRef) {
                soilMetaParts.push('Lab ref: ' + data.soil.labRef);
            }
            // b35fix368: include per-sample area in the metadata line (for
            // council multi-site reports where the area varies per zone).
            var areaHa = data.soil && data.soil.areaHa;
            if (areaHa != null && isFinite(areaHa) && areaHa > 0) {
                var n = Number(areaHa);
                var formattedArea;
                if (n >= 10) {
                    formattedArea = n.toFixed(2);
                } else {
                    formattedArea = n.toFixed(2).replace(/0+$/, '').replace(/\.$/, '');
                }
                if (!formattedArea) formattedArea = String(n);
                soilMetaParts.push('Area: ' + formattedArea + ' ha');
            }
            // b35fix368: prefer engineInputs.turf.species over data.turf.species
            // when the per-sample override is in play. data.turf.species is the
            // site-level value; engineInputs.turf.species is the value that
            // actually flowed to the engines for this sample (b35fix367
            // single-source-of-truth contract).
            var speciesName = (data.engineInputs && data.engineInputs.turf && data.engineInputs.turf.species)
                || data.turf.speciesDisplay
                || data.turf.species
                || '';
            if (speciesName) soilMetaParts.push(speciesName);
            if (soilMetaParts.length > 0) {
                sections.push(new Paragraph({
                    spacing: { after: 60 },
                    children: [
                        new TextRun({ text: soilMetaParts.join('  •  '), size: 20, color: '6B7280', italics: true })
                    ]
                }));
            }
            
            // Show extraction method if specified
            if (data.soil.extractantLabel) {
                // ────────────────────────────────────────────────────────
                // b35fix441 / C46b: surface Hill Labs sample-type code
                // ────────────────────────────────────────────────────────
                // For AA-extracted Hill Labs samples, append the sample-type
                // code (S277, S81, S78) and human-readable label so the
                // audit trail at the rendered docx makes the threshold-set
                // selection visible. Pre-fix the line read just "Hill Labs
                // NZ Method", which left the reader unable to verify which
                // S-code drove the deficit math without inspecting the
                // cert separately.
                // ────────────────────────────────────────────────────────
                var _b35fix441_extractDisplay = data.soil.extractantLabel;
                if (data.soil.aaSampleType && data.soil.aaSampleTypeLabel) {
                    _b35fix441_extractDisplay = _b35fix441_extractDisplay + ' \u2013 ' + data.soil.aaSampleTypeLabel;
                }
                sections.push(new Paragraph({
                    spacing: { after: 60 },
                    children: [
                        new TextRun({ text: 'Extraction Method: ', bold: true, size: 22, color: '6B7280' }),
                        new TextRun({ text: _b35fix441_extractDisplay, size: 22, color: '374151' })
                    ]
                }));
            }
            
            // Show methodology warning if applicable
            if (data.soil.extractantWarning) {
                sections.push(new Paragraph({
                    spacing: { after: 100 },
                    shading: { fill: 'FEF3C7', type: ShadingType.CLEAR },
                    children: [
                        new TextRun({ text: '', size: 22 }),
                        new TextRun({ text: data.soil.extractantWarning, size: 18, color: 'B45309', italics: true })
                    ]
                }));
            } else if (!data.soil.extractant || data.soil.extractant === '') {
                // Warn if extraction method not specified
                sections.push(new Paragraph({
                    spacing: { after: 100 },
                    shading: { fill: 'FEF3C7', type: ShadingType.CLEAR },
                    children: [
                        new TextRun({ text: '', size: 22 }),
                        new TextRun({ text: 'Extraction method not specified. MLSN guidelines require Mehlich 3 data. Please verify your lab methodology.', size: 18, color: 'B45309', italics: true })
                    ]
                }));
            }
            
            var soilRows = [];
            if (data.soil.pH) soilRows.push(createKeyValueRow('pH', data.soil.pH));
            if (data.soil.P) soilRows.push(createKeyValueRow('Phosphorus (P)', data.soil.P + ' ppm', getThresholdColor(data.soil.P, data.soil.thresholds?.P)));
            if (data.soil.K) soilRows.push(createKeyValueRow('Potassium (K)', data.soil.K + ' ppm', getThresholdColor(data.soil.K, data.soil.thresholds?.K)));
            if (data.soil.Ca) soilRows.push(createKeyValueRow('Calcium (Ca)', data.soil.Ca + ' ppm', getThresholdColor(data.soil.Ca, data.soil.thresholds?.Ca)));
            if (data.soil.Mg) soilRows.push(createKeyValueRow('Magnesium (Mg)', data.soil.Mg + ' ppm', getThresholdColor(data.soil.Mg, data.soil.thresholds?.Mg)));
            if (data.soil.S) soilRows.push(createKeyValueRow('Sulphur (S)', data.soil.S + ' ppm', getThresholdColor(data.soil.S, data.soil.thresholds?.S)));
            // Trace elements — MLSN minimums: Fe=1, Mn=1, Zn=1, Cu=0.2, B=0.1 ppm
            var traceMLSN = { Fe: 1, Mn: 1, Zn: 1, Cu: 0.2, B: 0.1 };
            var traceLabels = { Fe: 'Iron (Fe)', Mn: 'Manganese (Mn)', Zn: 'Zinc (Zn)', Cu: 'Copper (Cu)', B: 'Boron (B)' };
            ['Fe', 'Mn', 'Zn', 'Cu', 'B'].forEach(function(t) {
                if (data.soil[t] !== undefined && data.soil[t] !== null && data.soil[t] !== '') {
                    var col = data.soil[t] >= traceMLSN[t] ? '16A34A' : 'DC2626';
                    soilRows.push(createKeyValueRow(traceLabels[t], data.soil[t] + ' ppm', col));
                }
            });
            if (data.soil.OM) soilRows.push(createKeyValueRow('Organic Matter', data.soil.OM + '%'));
            if (data.soil.CEC) soilRows.push(createKeyValueRow('CEC', data.soil.CEC + ' meq/100g'));
            if (data.soil.summary) soilRows.push(createKeyValueRow('Status', data.soil.summary, getStatusColor(data.soil.summary)));
            
            sections.push(createTable(soilRows));
            
            // Add dual MLSN/SLAN comparison table
            // Skip for Ammonium Acetate methodology - MLSN uses Mehlich-3 extractant,
            // which is incompatible with Ammonium Acetate (NH₄OAc) extraction
            var isAmmoniumAcetate = data.soil.methodology && 
                (data.soil.methodology === 'AMMONIUM_ACETATE' || 
                 data.soil.methodology === 'AMMONIUM ACETATE' ||
                 data.soil.methodology.indexOf('AMMONIUM') >= 0);
            
            if (!isAmmoniumAcetate) {
                var dualTable = generateDualSoilTable(data.soil);
                if (dualTable) {
                    sections.push(new Paragraph({
                        spacing: { before: 200, after: 100 },
                        children: [new TextRun({ text: 'Dual Interpretation: MLSN vs SLAN', bold: true, size: 22 })]
                    }));
                    sections.push(new Paragraph({
                        spacing: { after: 100 },
                        children: [new TextRun({ 
                            text: 'This table shows how your soil nutrient levels are interpreted under both MLSN (Minimum Level for Sustainable Nutrition) and SLAN (Sufficiency Level of Available Nutrients) guidelines.',
                            size: 18, italics: true, color: '6B7280'
                        })]
                    }));
                    sections.push(dualTable);
                }
            } else {
                // Ammonium Acetate extraction — show methodology comparison table
                // so the reader understands why MLSN/SLAN values differ and cannot be
                // directly applied to AA-extracted data
                var aaBorder = { style: BorderStyle.SINGLE, size: 1, color: 'E5E7EB' };
                var aaBorders = { top: aaBorder, bottom: aaBorder, left: aaBorder, right: aaBorder };

                sections.push(new Paragraph({
                    spacing: { before: 300, after: 100 },
                    children: [new TextRun({ text: 'Interpretation Framework Comparison', bold: true, size: 22 })]
                }));
                sections.push(new Paragraph({
                    spacing: { after: 150 },
                    children: [new TextRun({
                        text: 'This sample was extracted using the Ammonium Acetate (NH\u2084OAc pH 8.1) + Olsen P method (Hill Laboratories NZ). ' +
                              'MLSN and SLAN guidelines are calibrated for Mehlich-3 extraction and cannot be directly applied to Ammonium Acetate results. ' +
                              'The table below shows the three frameworks side by side so you can see how they differ in philosophy and threshold basis.',
                        size: 18, italics: true, color: '4B5563'
                    })]
                }));

                // Build comparison table: Framework | Extractant | Basis | AU/NZ/UK status | Typical threshold basis
                var aaCompRows = [];
                var aaHdrRow = new TableRow({
                    tableHeader: true,
                    children: [
                        new TableCell({ borders: aaBorders, width: { size: 1800, type: WidthType.DXA },
                            shading: { fill: 'F3F4F6', type: ShadingType.CLEAR },
                            children: [new Paragraph({ children: [new TextRun({ text: 'Framework', bold: true, size: 18 })] })] }),
                        new TableCell({ borders: aaBorders, width: { size: 2000, type: WidthType.DXA },
                            shading: { fill: 'F3F4F6', type: ShadingType.CLEAR },
                            children: [new Paragraph({ children: [new TextRun({ text: 'Extractant', bold: true, size: 18 })] })] }),
                        new TableCell({ borders: aaBorders, width: { size: 2400, type: WidthType.DXA },
                            shading: { fill: 'F3F4F6', type: ShadingType.CLEAR },
                            children: [new Paragraph({ children: [new TextRun({ text: 'Philosophy', bold: true, size: 18 })] })] }),
                        new TableCell({ borders: aaBorders, width: { size: 1400, type: WidthType.DXA },
                            shading: { fill: 'F3F4F6', type: ShadingType.CLEAR },
                            children: [new Paragraph({ children: [new TextRun({ text: 'AU/NZ/UK use', bold: true, size: 18 })] })] }),
                        new TableCell({ borders: aaBorders, width: { size: 1600, type: WidthType.DXA },
                            shading: { fill: 'F3F4F6', type: ShadingType.CLEAR },
                            children: [new Paragraph({ children: [new TextRun({ text: 'Compatible with this sample?', bold: true, size: 18 })] })] })
                    ]
                });
                aaCompRows.push(aaHdrRow);

                var aaFrameworks = [
                    {
                        name: 'Ammonium Acetate (Hill Labs NZ)',
                        extractant: 'NH\u2084OAc pH 8.1 (cations) + Olsen P (NaHCO\u2083)',
                        philosophy: 'Exchangeable cation pool. Sufficiency ranges calibrated for NZ soils. Industry standard in NZ and widely used in Australia.',
                        regional: 'Standard in NZ; common in AU',
                        compatible: '\u2705 Yes, this report',
                        fill: 'F0FDF4', textColor: '166534'
                    },
                    {
                        name: 'MLSN (Woods et al. 2016)',
                        extractant: 'Mehlich-3',
                        philosophy: 'Minimum threshold below which deficiency becomes likely. Conservative, avoids over-fertilisation. Used globally in precision turf management. First introduced 2012; canonical published guidelines Woods, Stowell & Gelernter (2016) PeerJ Preprints 4:e2144v1.',
                        regional: 'AU/NZ: values not directly applicable to AA data',
                        compatible: '\u274C No, extractant mismatch',
                        fill: 'FEF2F2', textColor: 'DC2626'
                    },
                    {
                        name: 'SLAN (Carrow et al. 2004)',
                        extractant: 'Mehlich-3',
                        philosophy: 'Sufficiency range, target band above minimum. Higher thresholds than MLSN. Based on agronomic optimum rather than minimum viable level. Canonical published ranges Carrow, Stowell, Gelernter, Davis, Duncan & Skorulski (2004) GCM 72(1):194-198.',
                        regional: 'AU/NZ: values not directly applicable to AA data',
                        compatible: '\u274C No, extractant mismatch',
                        fill: 'FFFBEB', textColor: '92400E'
                    }
                ];

                aaFrameworks.forEach(function(fw) {
                    aaCompRows.push(new TableRow({
                        children: [
                            new TableCell({ borders: aaBorders, width: { size: 1800, type: WidthType.DXA },
                                shading: { fill: fw.fill, type: ShadingType.CLEAR },
                                children: [new Paragraph({ children: [new TextRun({ text: fw.name, bold: true, size: 18, color: fw.textColor })] })] }),
                            new TableCell({ borders: aaBorders, width: { size: 2000, type: WidthType.DXA },
                                shading: { fill: fw.fill, type: ShadingType.CLEAR },
                                children: [new Paragraph({ children: [new TextRun({ text: fw.extractant, size: 18 })] })] }),
                            new TableCell({ borders: aaBorders, width: { size: 2400, type: WidthType.DXA },
                                shading: { fill: fw.fill, type: ShadingType.CLEAR },
                                children: [new Paragraph({ children: [new TextRun({ text: fw.philosophy, size: 18 })] })] }),
                            new TableCell({ borders: aaBorders, width: { size: 1400, type: WidthType.DXA },
                                shading: { fill: fw.fill, type: ShadingType.CLEAR },
                                children: [new Paragraph({ children: [new TextRun({ text: fw.regional, size: 18 })] })] }),
                            new TableCell({ borders: aaBorders, width: { size: 1600, type: WidthType.DXA },
                                shading: { fill: fw.fill, type: ShadingType.CLEAR },
                                children: [new Paragraph({ children: [new TextRun({ text: fw.compatible, size: 18, bold: true })] })] })
                        ]
                    }));
                });

                sections.push(new Table({
                    width: { size: 9200, type: WidthType.DXA },
                    columnWidths: [1800, 2000, 2400, 1400, 1600],
                    rows: aaCompRows
                }));

                sections.push(new Paragraph({
                    spacing: { before: 120, after: 80 },
                    children: [new TextRun({
                        text: 'Note: If Mehlich-3 results are available for this site, contact your agronomist to run the full MLSN/SLAN dual comparison. ' +
                              'Approximate conversion factors exist (e.g. Mehlich-3 K \u2248 1.1\u00D7 AA K) but introduce error and are not recommended for formal recommendations.',
                        size: 16, italics: true, color: '6B7280'
                    })]
                }));
            }
            
            // Add soil chart if generated
            if (charts.soil) {
                sections.push(new Paragraph({ children: [] }));
                sections.push(createImageParagraph(charts.soil, 'soil'));
            }

            // Add trace element chart if generated
            if (charts.trace) {
                sections.push(new Paragraph({ children: [] }));
                sections.push(createImageParagraph(charts.trace, 'trace'));
                // Trace element narrative (pH context, antagonism, issues, extractant caveat)
                var traceNarrative = generateTraceNarrative(data.soil);
                traceNarrative.forEach(function(p) { sections.push(p); });
            }
            
            // Add pH and CEC context section
            var phCecContext = generatepHCECContext(data.soil, data.turf);
            if (phCecContext && phCecContext.length > 0) {
                sections.push(new Paragraph({
                    spacing: { before: 200, after: 100 },
                    children: [new TextRun({ text: 'pH and CEC Context', bold: true, size: 22 })]
                }));
                phCecContext.forEach(function(el) { sections.push(el); });
            }
            
            // Add soil interpretation and recommendations
            // Inject surface context so generateFertiliserRecommendation can apply rate caps
            if (data.soil && data.turf) {
                data.soil.surfaceType = (data.turf.subCategory || data.turf.type || '').toLowerCase();
            }

            // b35fix320: build amendmentContext from engineInputs.overseedConfig.
            // Drives seedling-safe product selection (MAP-not-DAP for P, urea/DAP
            // volatilisation warnings at high pH for S Rule 4).
            // b35fix424 (C20): also carry hemisphere through for elem-S Rule 4
            // summer-suppression copy and dolomite spring-placement override.
            var amendmentContext = {};
            try {
                var _oc = data.engineInputs && data.engineInputs.overseedConfig;
                amendmentContext.isOverseed = !!(_oc && _oc.isOverseed);
                // Carry overseed species through for any downstream rec text
                amendmentContext.overseedSpecies = _oc ? _oc.overseedSpecies : null;
                // Allow explicit caller override (e.g. grow-in flag set elsewhere)
                if (data.turf && data.turf.establishmentMode) {
                    amendmentContext.seedingActive = true;
                }
                // b35fix424 (C20): hemisphere from climate engine; defaults to 'south'.
                amendmentContext.hemisphere = (data.engineInputs && data.engineInputs.climate &&
                                               data.engineInputs.climate.hemisphere) || 'south';
            } catch (_e) { amendmentContext = {}; }

            var soilNarrative = generateSoilNarrative(data.soil, data.nutritionProgram, amendmentContext);
            if (soilNarrative) {
                var soilInterpretation = createInterpretationSection('Interpretation', soilNarrative);
                soilInterpretation.forEach(function(el) { sections.push(el); });
            }

            // ========================================
            // b35fix319 Phase 3 — Annual Soil Amendments table
            // b35fix320 — context threaded through for seedling-safe product
            //   selection and pH-aware N-source volatilisation warnings.
            // b35fix424 (C20) — hemisphere threaded through for elem-S Rule 4
            //   summer-suppression and dolomite spring-placement override.
            // Pure function — depends only on soil + nutritionProgram + surface
            //   + context; safe to call per-iteration in combined exports.
            // ========================================
            try {
                var amendmentSurface = (data.soil && data.soil.surfaceType) ||
                                       ((data.turf && (data.turf.subCategory || data.turf.type)) || '').toLowerCase();
                var amendmentPieces = buildAnnualSoilAmendmentsTable(
                    data.soil, data.nutritionProgram, amendmentSurface, amendmentContext, amendmentContext.hemisphere
                );
                amendmentPieces.forEach(function(el) { sections.push(el); });
            } catch (e) {
                if (typeof console !== 'undefined' && console.warn) {
                    console.warn('[WordExport] buildAnnualSoilAmendmentsTable failed:', e && e.message);
                }
            }

            // ========================================
            // AI INTERPRETATION v1.0.0
            // Adds Claude-generated narrative if user clicked "Interpret results"
            // b35fix313: suppressed in combined export — GAIP_SOIL_INTERPRETATION
            // is a single-sample global (populated when the user clicked
            // Interpret on whichever sample was active). Rendering it per-report
            // in a combined export would paste the same narrative on every
            // site's soil section. No per-sample AI narrative is available
            // today, so the combined export just omits the section entirely.
            // ========================================
            var aiInterpretation = window.GAIP_SOIL_INTERPRETATION;
            if (aiInterpretation && aiInterpretation.narrative && !window.GAIP_COMBINED_EXPORT_ACTIVE) {
                sections.push(new Paragraph({
                    spacing: { before: 300, after: 100 },
                    children: [new TextRun({ 
                        text: 'Soil Interpretation', 
                        bold: true, 
                        size: 22,
                        color: '166534'
                    })]
                }));
                
                // Process narrative - handle bold markers and split into paragraphs
                var aiNarrative = aiInterpretation.narrative;
                aiNarrative = aiNarrative.replace(/\*\*(.+?)\*\*/g, '<<BOLD>>$1<</BOLD>>');
                
                var aiParagraphs = aiNarrative.split(/\n\n+/);
                aiParagraphs.forEach(function(para) {
                    if (!para.trim()) return;
                    
                    // Process bold markers within paragraph
                    var children = [];
                    var parts = para.split(/<<BOLD>>|<<\/BOLD>>/);
                    var isBold = false;
                    
                    parts.forEach(function(part) {
                        if (part) {
                            children.push(new TextRun({
                                text: part,
                                bold: isBold,
                                size: 20,
                                color: isBold ? '166534' : '1F2937'
                            }));
                        }
                        isBold = !isBold;
                    });
                    
                    sections.push(new Paragraph({
                        spacing: { after: 120 },
                        children: children
                    }));
                });
                
                // Add citations if present
                if (aiInterpretation.citations && Object.keys(aiInterpretation.citations).length > 0) {
                    var citationText = 'Sources: ' + Object.keys(aiInterpretation.citations).map(function(key) {
                        var cite = aiInterpretation.citations[key];
                        return cite.authors ? cite.authors + ' (' + cite.year + ')' : key;
                    }).join(', ');
                    
                    sections.push(new Paragraph({
                        spacing: { before: 80, after: 100 },
                        children: [new TextRun({
                            text: citationText,
                            size: 16,
                            italics: true,
                            color: '6B7280'
                        })]
                    }));
                }
                
                // Disclaimer
                sections.push(new Paragraph({
                    spacing: { before: 100, after: 150 },
                    children: [new TextRun({
                        text: 'Note: This interpretation is AI-generated based on your soil analysis data. Always verify recommendations with local agronomic expertise and site-specific conditions.',
                        size: 16,
                        italics: true,
                        color: '92400E'
                    })]
                }));
                
            }
            // ========================================

            // ========================================
            // MULDER'S NUTRIENT INTERACTIONS
            // Runs GilbaMulders.analyse() on the same soil data used for
            // MLSN/SLAN/AA sufficiency — methodology-aware unit conversion.
            // Only renders if interactions are detected.
            // ========================================
            if (window.GilbaMulders && data.soil) {
                try {
                    // Build a minimal nutrients array from the soil data object
                    var _mNutrients = [];
                    var _mNutrientKeys = ['K','Ca','Mg','P','Fe','Mn','Zn','Cu','B','S','N'];
                    _mNutrientKeys.forEach(function(sym) {
                        var val = data.soil[sym] || (data.soil.nutrients && data.soil.nutrients[sym]);
                        if (val != null && parseFloat(val) > 0) {
                            _mNutrients.push({ nutrient: sym, actual: parseFloat(val) });
                        }
                    });

                    var _mContext = {
                        methodology: (data.soil.methodology || 'mlsn'),
                        soilPH: data.soil.pH_water || data.soil.pH_cacl2 || data.soil.pH || null,
                        turfType: (data.turf && data.turf.warmBase) ? 'warm-season' : 'cool-season',
                        nProgram: (data.turf && data.turf.nProgramKgHaYr) || 0,
                        // b35fix267: extractant for P-ratio incompatibility check
                        extractant: data.soil.extractant || data.soil.methodology || null,
                    };

                    var _mResult = window.GilbaMulders.analyse(_mNutrients, _mContext);
                    var _mFlags = _mResult.flags;
                    var _mEntries = [];
                    Object.keys(_mFlags).forEach(function(sym) {
                        _mFlags[sym].forEach(function(f) { _mEntries.push(f); });
                    });

                    if (_mEntries.length > 0) {
                        // Section heading
                        sections.push(new Paragraph({
                            spacing: { before: 300, after: 120 },
                            children: [new TextRun({
                                text: 'Mulder\'s Nutrient Interactions',
                                bold: true, size: 24, color: 'B45309'
                            })]
                        }));
                        sections.push(new Paragraph({
                            spacing: { after: 100 },
                            children: [new TextRun({
                                text: 'The following antagonistic interactions were detected. These affect nutrient '
                                    + 'availability independently of absolute soil levels, a nutrient above its '
                                    + 'sufficiency threshold may still be functionally deficient if a competing '
                                    + 'element is elevated.',
                                size: 18, color: '6B7280'
                            })]
                        }));

                        // b35fix267: Cross-panel extractant consistency note
                        // Ratio checks assume all nutrients were extracted with the same method.
                        // Mixed-extractant panels (e.g. switching labs mid-season) invalidate ratios.
                        var _extractantNote = 'Ratio checks assume all nutrients were extracted using the same method (' +
                            (data.soil.extractant || data.soil.methodology || 'extractant not specified') +
                            '). Results from mixed-extractant panels will produce unreliable ratios.';
                        // Add pH-incompatibility warning if applicable
                        var _hasExtractantCaveat = _mEntries.some(function(f) { return f.extractantCaveat; });
                        if (_hasExtractantCaveat) {
                            _extractantNote += ' Note: one or more P-based interactions have been downgraded to advisory ' +
                                'because the extractant used (' + (data.soil.extractant || 'Mehlich-3/Bray') +
                                ') over-extracts phosphorus at pH ≥ 7.5. Olsen-P is the recommended extractant ' +
                                'above this pH. Source: Havlin et al. (2014) Soil Fertility and Fertilizers, 8th ed.';
                        }
                        sections.push(new Paragraph({
                            spacing: { after: 160 },
                            shading: { fill: 'F9FAFB', type: ShadingType.CLEAR },
                            children: [new TextRun({ text: _extractantNote, size: 16, italics: true, color: '6B7280' })]
                        }));

                        // One paragraph block per interaction
                        _mEntries.forEach(function(f) {
                            var ratioStr = f.value != null
                                ? ' (' + f.ratio + ' = ' + f.value + ', threshold: ' + f.threshold + ')'
                                : '';

                            sections.push(new Paragraph({
                                spacing: { before: 160, after: 60 },
                                children: [new TextRun({
                                    text: f.suppressor + ' suppresses ' + f.suppressed + ratioStr,
                                    bold: true, size: 20, color: '374151'
                                })]
                            }));
                            sections.push(new Paragraph({
                                spacing: { after: 60 },
                                children: [new TextRun({ text: f.message, size: 20, color: '1F2937' })]
                            }));
                            sections.push(new Paragraph({
                                spacing: { after: 60 },
                                children: [new TextRun({ text: f.detail, size: 18, color: '374151' })]
                            }));
                            sections.push(new Paragraph({
                                spacing: { after: 120 },
                                children: [new TextRun({
                                    text: f.citation,
                                    size: 16, italics: true, color: '9CA3AF'
                                })]
                            }));
                        });
                    }
                } catch(e) {
                    // Mulder's section is non-critical — swallow errors silently
                }
            }
            // ========================================
            
            
            sections.push(new Paragraph({ children: [] }));
        }
        
        // Cation Balance Analysis section
        var cationBalanceData = generateCationBalance(data);
        if (cationBalanceData && cationBalanceData.hasData) {
            sections.push(new Paragraph({ 
                heading: HeadingLevel.HEADING_1, keepNext: true, 
                children: [new TextRun('Cation Balance Analysis')] 
            }));
            
            // Ratios table
            var cationRows = [];
            if (cationBalanceData.ratios.CaMg) {
                var caMgColor = cationBalanceData.ratios.CaMgStatus === 'Optimal' ? '16A34A' : 
                               cationBalanceData.ratios.CaMgStatus === 'Low' ? 'DC2626' : 'F59E0B';
                cationRows.push(createKeyValueRow('Ca:Mg Ratio', 
                    cationBalanceData.ratios.CaMg.toFixed(1) + ':1 (' + cationBalanceData.ratios.CaMgStatus + ')', caMgColor));
            }
            if (cationBalanceData.ratios.KMg) {
                var kMgColor = cationBalanceData.ratios.KMgStatus === 'Optimal' ? '16A34A' : 
                              cationBalanceData.ratios.KMgStatus === 'High K' ? 'F59E0B' : '3B82F6';
                cationRows.push(createKeyValueRow('K:Mg Ratio (meq)', 
                    cationBalanceData.ratios.KMg.toFixed(2) + ' (' + cationBalanceData.ratios.KMgStatus + ')', kMgColor));
            }
            
            // Base saturation
            sections.push(new Paragraph({
                spacing: { before: 100, after: 50 },
                children: [new TextRun({ text: 'Cation Ratios', bold: true, size: 22 })]
            }));
            sections.push(createTable(cationRows));
            
            // Base saturation percentages
            // ────────────────────────────────────────────────────────────────
            // b35fix438 (C49): Suppress Base Saturation block on AA samples
            // ────────────────────────────────────────────────────────────────
            // The %BS / BCSR (Basic Cation Saturation Ratio) sufficiency
            // framework is not validated for turfgrass. Kopittke & Menzies
            // (2007) SSSAJ 71:259-265 reviewed BCSR and found it lacks
            // scientific basis for predicting plant response. Carrow,
            // Waddington & Rieke (2001) Turfgrass Soil Fertility & Chemical
            // Problems explicitly recommends sufficiency-level (SLAN/MLSN)
            // over BCSR for turf. Hill Labs prints %BS values on S81
            // certificates as the primary cation reference, but printing
            // them does not validate the framework as a sufficiency
            // interpretation tool for turf.
            //
            // Pre-fix: AA samples emitted a Base Saturation block in Cation
            // Balance Analysis with %BS rows for Ca/Mg/K/Na and a Total
            // Base Saturation row. The values were calculated internally
            // from converted ppm (introducing computation drift, e.g. the
            // Hagley docx 2026-05-04 displayed TBS 115% which is
            // mathematically impossible) and presented %BS as if it were
            // a credible interpretation framework.
            //
            // Post-fix: skip the Base Saturation block entirely for AA
            // samples. Cation Ratios block (Ca:Mg, K:Mg mass-based ratios)
            // still emits because those are NOT BCSR-derived. Mulder's Ca:Mg
            // warning audit closed in b35fix439 (mulders-interaction-checker.js
            // v1.1.0): rule retired on the same Kopittke & Menzies / Leiva Soto
            // evidence chain. Carrow & Duncan 1998 was a misattribution
            // (salinity reference). K:Mg, K:Ca, Mg:K rules remain (Marschner).
            //
            // MLSN/SLAN samples: Base Saturation block was previously also
            // suppressed for non-AA pathways via the cationBalanceData
            // generator's hasBS check; carry-through unchanged for them.
            var soilMethodologyForBS = (data.soil && data.soil.methodology) ? String(data.soil.methodology).toUpperCase() : '';
            var suppressBaseSaturation = (soilMethodologyForBS === 'AMMONIUM_ACETATE' || soilMethodologyForBS === 'AMMONIUM ACETATE');

            if (cationBalanceData.baseSaturation && !suppressBaseSaturation) {
                var bs = cationBalanceData.baseSaturation;
                sections.push(new Paragraph({
                    spacing: { before: 150, after: 50 },
                    children: [new TextRun({ text: 'Base Saturation', bold: true, size: 22 })]
                }));
                
                var bsRows = [];
                var caColor = bs.Ca < 50 ? 'F59E0B' : bs.Ca > 75 ? '3B82F6' : '16A34A';
                bsRows.push(createKeyValueRow('Calcium (Ca)', bs.Ca.toFixed(1) + '%', caColor));
                bsRows.push(createKeyValueRow('Magnesium (Mg)', bs.Mg.toFixed(1) + '%'));
                bsRows.push(createKeyValueRow('Potassium (K)', bs.K.toFixed(1) + '%'));
                if (bs.Na > 1) {
                    var naColor = bs.Na > 5 ? 'DC2626' : bs.Na > 3 ? 'F59E0B' : '16A34A';
                    bsRows.push(createKeyValueRow('Sodium (Na)', bs.Na.toFixed(1) + '%', naColor));
                }
                bsRows.push(createKeyValueRow('Total Base Saturation', bs.total.toFixed(1) + '%'));
                sections.push(createTable(bsRows));
            }
            
            // Issues and recommendations
            if (cationBalanceData.issues.length > 0 || cationBalanceData.recommendations.length > 0) {
                var cationNarrative = {
                    narrative: cationBalanceData.issues,
                    recommendations: cationBalanceData.recommendations
                };
                var cationInterpretation = createInterpretationSection('Interpretation', cationNarrative);
                cationInterpretation.forEach(function(el) { sections.push(el); });
            }
            
            sections.push(new Paragraph({ children: [] }));
        }
        
        // Climate & Growth Conditions section (after soil — groups site/soil/climate together)
        if (data.climate && (data.climate.temperature || data.climate.growthPotential)) {
            sections.push(new Paragraph({ 
                heading: HeadingLevel.HEADING_1, keepNext: true, 
                children: [new TextRun('Climate & Growth Conditions')] 
            }));
            
            var climateRows = [];
            if (data.climate.temperature) climateRows.push(createKeyValueRow('Temperature', data.climate.temperature.toFixed(1) + '°C'));
            
            // Show growth potential - for overseed show both C3 and C4
            if (data.climate.showBothGP && data.climate.c3Growth !== undefined && data.climate.c4Growth !== undefined) {
                climateRows.push(createKeyValueRow('Growth Potential (C3 Overseed)', Math.round(data.climate.c3Growth) + '%'));
                climateRows.push(createKeyValueRow('Growth Potential (C4 Base)', Math.round(data.climate.c4Growth) + '%'));
            } else if (data.climate.growthPotential !== null && data.climate.growthPotential !== undefined) {
                var gpLabel = 'Growth Potential';
                if (data.climate.gpLabel) {
                    gpLabel = 'Growth Potential (' + data.climate.gpLabel + ')';
                } else if (data.turf.isC4) {
                    gpLabel = 'Growth Potential (C4)';
                } else {
                    gpLabel = 'Growth Potential (C3)';
                }
                climateRows.push(createKeyValueRow(gpLabel, Math.round(data.climate.growthPotential) + '%'));
            }
            
            if (data.climate.heatStress) climateRows.push(createKeyValueRow('Heat Stress', data.climate.heatStress));
            if (data.climate.coldStress) climateRows.push(createKeyValueRow('Cold Stress', data.climate.coldStress));
            if (data.climate.status) climateRows.push(createKeyValueRow('Status', data.climate.status, getStatusColor(data.climate.status)));
            
            sections.push(createTable(climateRows));
            
            if (charts.climate) {
                sections.push(createImageParagraph(charts.climate, 'climate'));
            }
            
            sections.push(new Paragraph({ children: [] }));
        }

        // Annual Nutrient Requirements section (from MLSN calculations)
        // Suppressed in combined export — consolidated ANR table in buildCombinedDocument covers all greens
        if (data.nutritionSummary && data.nutritionSummary.hasData && !window.GAIP_COMBINED_EXPORT_ACTIVE) {
            // Page break to ensure heading starts at top of new page
            sections.push(new Paragraph({ children: [new PageBreak()] }));
            
            sections.push(new Paragraph({ 
                heading: HeadingLevel.HEADING_1, keepNext: true, 
                children: [new TextRun('Annual Nutrient Requirements')] 
            }));
            // b35fix331 — Item 1a residual closure (single-export ANR caption).
            //
            // Pre-fix caption: "Based on SLAN methodology with removal + deficit
            //   correction" — actively wrong for SLAN. Under SLAN sufficiency-band
            //   methodology (Carrow 2004 per b35fix333; previously mis-cited as
            //   Throssell 2009), in-range samples receive removal-only (no deficit
            //   correction); only sub-floor samples receive removal + lift-to-floor.
            //
            // Post-fix: methodology-specific captions matching engine behaviour.
            // Same framing as the combined-export caption (b35fix331 sister
            // change in word-export-combined.js): "removal-rate (replacement
            // target)" with explicit cross-reference to soil sufficiency.
            var _b35fix331_methStr = data.soil && data.soil.methodology;
            var _b35fix331_isAA = _b35fix331_methStr === 'AMMONIUM_ACETATE' || _b35fix331_methStr === 'AMMONIUM ACETATE';
            var _b35fix331_isSLAN = _b35fix331_methStr === 'SLAN';
            var _b35fix331_caption;
            if (_b35fix331_isAA) {
                // ────────────────────────────────────────────────────────────
                // b35fix441 / C47: AA caption reanchor
                // ────────────────────────────────────────────────────────────
                // Pre-fix copy: "MLSN/SLAN sufficiency thresholds not
                // applicable to AA-extracted data." This was misleading. The
                // engine IS applying sufficiency thresholds to AA-extracted
                // data — Hill Labs sample-type-specific ranges (S277, S81,
                // S78), the same thresholds that drive the deficit math in
                // the Soil Amendment table on the same page. The disclaimer
                // gave the impression that sufficiency interpretation was
                // unavailable, when in fact it was being applied (correctly
                // post-b35fix441 / C46) on the cert-native sample-type axis.
                // Post-fix copy makes the framework framing accurate and
                // surfaces the active sample-type code so the audit trail
                // is visible at the call site.
                // ────────────────────────────────────────────────────────────
                var _b35fix441_sampleTypeCode = (data.soil && data.soil.aaSampleType) ? data.soil.aaSampleType : 'S277';
                var _b35fix441_sampleTypeLabel = (data.soil && data.soil.aaSampleTypeLabel) ? data.soil.aaSampleTypeLabel : 'TURF Ryegrass, Sand (S277)';
                _b35fix331_caption = 'Hill Labs ' + _b35fix441_sampleTypeCode + ' sample-type sufficiency thresholds applied (' +
                                     _b35fix441_sampleTypeLabel + '). Cation values converted from cert-native ' +
                                     'me/100g to ppm for amendment-math comparison; cation deficit-correction ' +
                                     'recommendations appear in the Soil Amendment table above. The figures ' +
                                     'below are annual removal-replacement estimates (clipping uptake), not ' +
                                     'deficit-closure rates. All rates kg/ha/yr.';
            } else if (_b35fix331_isSLAN) {
                _b35fix331_caption = 'SLAN sufficiency methodology (Carrow et al. 2004, GCM 72(1):194-198): ' +
                                     'K/P/S figures are removal-rate (replacement target), with P pH-adjusted ' +
                                     'where pH is available. Within the sufficiency range, requirement = removal ' +
                                     'only (soil reserves cover the agronomic requirement); below floor, ' +
                                     'requirement = removal + lift correction over years-to-correct; above ' +
                                     'ceiling, requirement = 0. Sufficiency-as-floor framing per Carrow, ' +
                                     'Waddington & Rieke (2001). All rates kg/ha/yr.';
            } else {
                _b35fix331_caption = 'MLSN methodology (Woods et al. 2016): K/P/S figures are removal-rate ' +
                                     '(replacement target). Below the MLSN floor, requirement = removal + ' +
                                     'deficit correction; at or above the floor, requirement = removal only, ' +
                                     'soil reserves are agronomically sufficient and the figure indicates the ' +
                                     'rate at which clippings are removing the nutrient, not a per-year ' +
                                     'application target. All rates kg/ha/yr.';
            }
            sections.push(new Paragraph({
                spacing: { before: 50, after: 100 },
                children: [new TextRun({
                    text: _b35fix331_caption,
                    size: 20, italics: true, color: '6B7280'
                })]
            }));
            
            // Create nutrient requirement rows
            var nutRows = [];
            if (data.nutritionSummary.annualP) {
                var pColor = data.nutritionSummary.pStatus === 'Low' ? 'DC2626' : '16A34A';
                nutRows.push(createKeyValueRow('Phosphorus (P)', data.nutritionSummary.annualP.toFixed(1) + ' kg/ha/yr', pColor));
            }
            if (data.nutritionSummary.annualK) {
                var kColor = data.nutritionSummary.kStatus === 'Low' ? 'DC2626' : '16A34A';
                nutRows.push(createKeyValueRow('Potassium (K)', data.nutritionSummary.annualK.toFixed(1) + ' kg/ha/yr', kColor));
            }
            if (data.nutritionSummary.annualS) {
                var sColor = data.nutritionSummary.sStatus === 'Low' ? 'DC2626' : '16A34A';
                nutRows.push(createKeyValueRow('Sulphur (S)', data.nutritionSummary.annualS.toFixed(1) + ' kg/ha/yr', sColor));
            }
            
            if (nutRows.length > 0) {
                sections.push(createTable(nutRows));
            }
            
            // Monthly N Distribution (GP-Weighted) table — b35fix387: routed
            // through _buildMonthlyNDistribution helper, shared with combined-
            // export (word-export-combined.js). Single-export does NOT pass
            // siteUniformCaption (only one sample, no asymmetry to explain).
            if (data.nutritionSummary.monthlyN && data.nutritionSummary.monthlyN.length > 0) {
                var _mnDocxRefs = {
                    Paragraph: Paragraph, TextRun: TextRun, Table: Table,
                    TableRow: TableRow, TableCell: TableCell,
                    WidthType: WidthType, AlignmentType: AlignmentType
                };
                var _mnNodes = _buildMonthlyNDistribution(
                    data.nutritionSummary.monthlyN,
                    data.nutritionSummary.totalN,
                    data.nutritionSummary.activeMonths,
                    _mnDocxRefs,
                    { siteUniformCaption: false }
                );
                _mnNodes.forEach(function(node) { sections.push(node); });
            }
            
            sections.push(new Paragraph({ children: [] }));
        }
        
        // Tissue Analysis section
        if (data.tissue && (data.tissue.N > 0 || data.tissue.K > 0)) {
            // Build tissue header - indicate which species ranges are being used
            var tissueTitle = 'Tissue Analysis';
            if (data.turf.overseedDominant && data.tissue.rangeSpecies) {
                tissueTitle = 'Tissue Analysis (' + data.tissue.rangeSpecies + ' sufficiency ranges)';
            }
            var tissueContext = getSectionContext(data.tissue.sampleLabel);
            if (tissueContext) {
                tissueTitle += ', ' + tissueContext;
            }
            
            sections.push(new Paragraph({ 
                heading: HeadingLevel.HEADING_1, keepNext: true, 
                children: [new TextRun(tissueTitle)] 
            }));
            
            // Show tissue sample metadata line (date, species)
            var tissueMetaParts = [];
            if (data.tissue.testDate) {
                var tissueDate = new Date(data.tissue.testDate);
                tissueMetaParts.push('Sampled: ' + tissueDate.toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' }));
            }
            var tissueSpecies = data.turf.speciesDisplay || data.turf.species || '';
            if (tissueSpecies) tissueMetaParts.push(tissueSpecies);
            if (tissueMetaParts.length > 0) {
                sections.push(new Paragraph({
                    spacing: { after: 60 },
                    children: [
                        new TextRun({ text: tissueMetaParts.join('  •  '), size: 20, color: '6B7280', italics: true })
                    ]
                }));
            }
            
            var ranges = data.tissue.ranges || {};
            var tissueRows = [];
            
            // Macronutrients
            if (data.tissue.N) tissueRows.push(createKeyValueRow('Nitrogen (N)', data.tissue.N + '%', getTissueRangeColor(data.tissue.N, ranges.N)));
            if (data.tissue.P) tissueRows.push(createKeyValueRow('Phosphorus (P)', data.tissue.P + '%', getTissueRangeColor(data.tissue.P, ranges.P)));
            if (data.tissue.K) tissueRows.push(createKeyValueRow('Potassium (K)', data.tissue.K + '%', getTissueRangeColor(data.tissue.K, ranges.K)));
            if (data.tissue.Ca) tissueRows.push(createKeyValueRow('Calcium (Ca)', data.tissue.Ca + '%', getTissueRangeColor(data.tissue.Ca, ranges.Ca)));
            if (data.tissue.Mg) tissueRows.push(createKeyValueRow('Magnesium (Mg)', data.tissue.Mg + '%', getTissueRangeColor(data.tissue.Mg, ranges.Mg)));
            if (data.tissue.S) tissueRows.push(createKeyValueRow('Sulphur (S)', data.tissue.S + '%', getTissueRangeColor(data.tissue.S, ranges.S)));
            
            // Micronutrients (trace elements)
            if (data.tissue.Fe) tissueRows.push(createKeyValueRow('Iron (Fe)', data.tissue.Fe + ' ppm', getTissueRangeColor(data.tissue.Fe, ranges.Fe)));
            if (data.tissue.Mn) tissueRows.push(createKeyValueRow('Manganese (Mn)', data.tissue.Mn + ' ppm', getTissueRangeColor(data.tissue.Mn, ranges.Mn)));
            if (data.tissue.Zn) tissueRows.push(createKeyValueRow('Zinc (Zn)', data.tissue.Zn + ' ppm', getTissueRangeColor(data.tissue.Zn, ranges.Zn)));
            if (data.tissue.Cu) tissueRows.push(createKeyValueRow('Copper (Cu)', data.tissue.Cu + ' ppm', getTissueRangeColor(data.tissue.Cu, ranges.Cu)));
            if (data.tissue.B) tissueRows.push(createKeyValueRow('Boron (B)', data.tissue.B + ' ppm', getTissueRangeColor(data.tissue.B, ranges.B)));
            
            // Show limiting nutrients if available
            if (data.tissue.limitingNutrients && data.tissue.limitingNutrients.length > 0) {
                var limiting = data.tissue.limitingNutrients.map(function(n) { return n.nutrient || n; }).join(', ');
                tissueRows.push(createKeyValueRow('Limiting Nutrients', limiting, 'F59E0B'));
            }
            
            sections.push(createTable(tissueRows));
            
            // Add tissue chart if generated
            if (charts.tissue) {
                sections.push(new Paragraph({ children: [] }));
                sections.push(createImageParagraph(charts.tissue, 'tissue'));
            }
            
            // Add tissue interpretation and recommendations
            var tissueNarrative = generateTissueNarrative(data.tissue);
            if (tissueNarrative) {
                var tissueInterpretation = createInterpretationSection('Interpretation', tissueNarrative);
                tissueInterpretation.forEach(function(el) { sections.push(el); });
            }
            
            sections.push(new Paragraph({ children: [] }));
        }
        
        // N Program Validation section
        if (data.nProgram && data.nProgram.hasData) {
            sections.push(new Paragraph({ 
                heading: HeadingLevel.HEADING_1, keepNext: true, 
                children: [new TextRun('N Program Validation')] 
            }));
            
            var nRows = [];
            if (data.nProgram.appliedN !== undefined) {
                nRows.push(createKeyValueRow('Applied N', data.nProgram.appliedN + ' kg/ha/month'));
            }
            if (data.nProgram.effectiveCapacity !== undefined) {
                nRows.push(createKeyValueRow('Uptake Capacity', data.nProgram.effectiveCapacity.toFixed(1) + ' kg/ha/month'));
            }
            if (data.nProgram.utilizationPct !== undefined) {
                var utilColor = data.nProgram.utilizationPct > 100 ? 'DC2626' : 
                               data.nProgram.utilizationPct > 80 ? '16A34A' : 'F59E0B';
                nRows.push(createKeyValueRow('Utilisation', Math.round(data.nProgram.utilizationPct) + '% of capacity', utilColor));
            }
            if (data.nProgram.verdict) {
                var verdictColor = data.nProgram.verdict.level === 'optimal' ? '16A34A' :
                                   data.nProgram.verdict.level === 'suboptimal' ? 'F59E0B' : 'DC2626';
                nRows.push(createKeyValueRow('Status', data.nProgram.verdict.label || data.nProgram.verdict.level, verdictColor));
            }
            if (data.nProgram.difference !== undefined && data.nProgram.difference > 0) {
                nRows.push(createKeyValueRow('Wasted N', data.nProgram.difference.toFixed(1) + ' kg/ha', 'DC2626'));
            }
            
            sections.push(createTable(nRows));
            
            // Add recommendations
            if (data.nProgram.recommendations && data.nProgram.recommendations.length > 0) {
                var nNarrative = {
                    narrative: [data.nProgram.verdict ? data.nProgram.verdict.message : 'N program assessment complete.'],
                    recommendations: data.nProgram.recommendations
                };
                var nInterpretation = createInterpretationSection('Interpretation', nNarrative);
                nInterpretation.forEach(function(el) { sections.push(el); });
            }
            
            sections.push(new Paragraph({ children: [] }));
        }
        
        // =====================================================================
        // NUTRIENT TREND ANALYSIS
        // =====================================================================
        if (data.nutrientTrend && data.nutrientTrend.hasData && data.nutrientTrend.types) {
            sections.push(new Paragraph({ children: [new PageBreak()] }));
            sections.push(new Paragraph({ 
                heading: HeadingLevel.HEADING_1, keepNext: true, 
                children: [new TextRun('Nutrient Trend Analysis')] 
            }));
            
            // Water parameters where INCREASING is bad (upper-limit parameters)
            var waterUpperLimit = { SAR: true, SARadj: true, EC: true, Na: true, Cl: true, HCO3: true, B: true, Fe: true, pH: true };
            
            // ────────────────────────────────────────────────────────────────
            // b35fix437 (C46): methodology-aware soil threshold label
            // ────────────────────────────────────────────────────────────────
            // Pre-fix: hardcoded 'MLSN/SLAN' regardless of `data.soil.methodology`.
            // Hill Labs AA samples emitted column header "MLSN/SLAN Margin"
            // against AA-anchored thresholds — Framework Comparison block
            // declares the methodology mismatch but the trend column header
            // contradicts it. Pre-Hagley fixture: Mg 67 ppm flagged as "52
            // BELOW" against MLSN floor 47 (wrong reference).
            //
            // Post-fix: branch the soil thresholdLabel on
            // `data.soil.methodology` + `data.soil.aaSampleType`. AA samples
            // emit "Hill Labs <CODE>" (e.g. "Hill Labs S277", "Hill Labs S81")
            // — explicit about which reference set is in play. MLSN/SLAN
            // sites carry through unchanged.
            var soilMethodology = (data.soil && data.soil.methodology) ? String(data.soil.methodology).toUpperCase() : '';
            var soilThresholdLabel = 'MLSN/SLAN';
            var soilUnit = 'ppm';
            if (soilMethodology === 'AMMONIUM_ACETATE' || soilMethodology === 'AMMONIUM ACETATE') {
                var aaCode = (data.soil && data.soil.aaSampleType) ? data.soil.aaSampleType : '';
                soilThresholdLabel = aaCode ? ('Hill Labs ' + aaCode) : 'Hill Labs AA';
                // Unit varies per nutrient under AA (me/100g vs %BS vs mg/L).
                // Header column shows just the threshold label; per-nutrient
                // unit is in the threshold object's `label` field if needed.
                soilUnit = 'various';
            }

            var typeLabels = {
                soil: { heading: 'Soil Nutrient Trends', unit: soilUnit, thresholdLabel: soilThresholdLabel, marginGood: 'above min', marginBad: 'BELOW min' },
                tissue: { heading: 'Tissue Analysis Trends', unit: '% DW / mg/kg', thresholdLabel: 'Sufficiency', marginGood: 'above min', marginBad: 'BELOW min' },
                water: { heading: 'Water Quality Trends', unit: 'various', thresholdLabel: 'Guideline', marginGood: 'below limit', marginBad: 'OVER limit' }
            };
            var typeOrder = ['soil', 'tissue', 'water'];
            
            for (var toi = 0; toi < typeOrder.length; toi++) {
                var dataType = typeOrder[toi];
                var typeData = data.nutrientTrend.types[dataType];
                if (!typeData || Object.keys(typeData).length === 0) continue;
                
                var tLabel = typeLabels[dataType] || typeLabels.soil;
                var isWaterType = (dataType === 'water');
                
                // Data type heading
                sections.push(new Paragraph({
                    heading: HeadingLevel.HEADING_2, keepNext: true,
                    spacing: { before: 240, after: 100 },
                    children: [new TextRun(tLabel.heading)]
                }));
            
                var trendZoneKeys = Object.keys(typeData);
            
                for (var tz = 0; tz < trendZoneKeys.length; tz++) {
                    var zoneKey = trendZoneKeys[tz];
                    var zoneData = typeData[zoneKey];
                
                    if (!zoneData || !zoneData.nutrients || Object.keys(zoneData.nutrients).length === 0) continue;
                
                    // Zone subheading
                    var zoneLabel = zoneData.zone || zoneKey;
                    sections.push(new Paragraph({
                        spacing: { before: 160, after: 60 },
                        children: [new TextRun({ text: zoneLabel, bold: true, size: 22, color: '1F2937' })]
                    }));
                
                    // Zone metadata line
                    sections.push(new Paragraph({
                        spacing: { after: 100 },
                        children: [
                            new TextRun({ text: zoneData.sampleCount + ' samples', bold: true, size: 20, color: '374151' }),
                            new TextRun({ text: '  |  ', size: 20, color: '9CA3AF' }),
                            new TextRun({ text: zoneData.dateRange, size: 20, color: '6B7280' })
                        ]
                    }));
                
                    // Summary table
                    var trendBorder = { style: BorderStyle.SINGLE, size: 1, color: 'E5E7EB' };
                    var trendBorders = { top: trendBorder, bottom: trendBorder, left: trendBorder, right: trendBorder };
                    var trendCellMargins = { top: 60, bottom: 60, left: 100, right: 100 };
                
                    var headerCells = [
                        { text: 'Parameter', width: 1200 },
                        { text: 'Latest', width: 1100 },
                        { text: 'Previous', width: 1100 },
                        { text: 'Change', width: 1200 },
                        { text: 'Direction', width: 1260 },
                        { text: tLabel.thresholdLabel + ' Margin', width: 1700 },
                        { text: 'Risk', width: 1800 }
                    ];
                
                    var trendHeaderRow = new TableRow({
                        tableHeader: true,
                        cantSplit: true,
                        children: headerCells.map(function(cell) {
                            return new TableCell({
                                borders: trendBorders,
                                width: { size: cell.width, type: WidthType.DXA },
                                shading: { fill: '1F2937', type: ShadingType.CLEAR },
                                margins: trendCellMargins,
                                verticalAlign: VerticalAlign.CENTER,
                                children: [new Paragraph({ 
                                    alignment: AlignmentType.CENTER,
                                    children: [new TextRun({ text: cell.text, bold: true, size: 18, color: 'FFFFFF' })] 
                                })]
                            });
                        })
                    });
                
                    var trendTableRows = [trendHeaderRow];
                    var nutrientKeys = Object.keys(zoneData.nutrients);
                
                    // Sort: problematic trends first
                    // For water: increasing toward upper limit is bad
                    // For soil/tissue: decreasing toward lower limit is bad
                    var riskOrder = { above: 0, below: 0, warning: 1, watch: 2, ok: 3 };
                    nutrientKeys.sort(function(a, b) {
                        var na = zoneData.nutrients[a];
                        var nb = zoneData.nutrients[b];
                        // Is this nutrient moving in the bad direction?
                        var badA = isWaterType ? (waterUpperLimit[a] && na.direction === 'increasing') : (na.direction === 'decreasing');
                        var badB = isWaterType ? (waterUpperLimit[b] && nb.direction === 'increasing') : (nb.direction === 'decreasing');
                        if (badA !== badB) return badA ? -1 : 1;
                        var rA = na.crossingRisk ? (riskOrder[na.crossingRisk.status] !== undefined ? riskOrder[na.crossingRisk.status] : 3) : 3;
                        var rB = nb.crossingRisk ? (riskOrder[nb.crossingRisk.status] !== undefined ? riskOrder[nb.crossingRisk.status] : 3) : 3;
                        return rA - rB;
                    });
                
                    for (var ni = 0; ni < nutrientKeys.length; ni++) {
                        var nKey = nutrientKeys[ni];
                        var nData = zoneData.nutrients[nKey];
                    
                        // Determine if this parameter's increase is bad (water upper-limit params)
                        var increaseIsBad = isWaterType && waterUpperLimit[nKey];
                        
                        // Direction arrow and colour - context-aware
                        var dirArrow, dirColor;
                        if (nData.direction === 'increasing') {
                            dirArrow = '\u2191 Increasing';
                            dirColor = increaseIsBad ? 'DC2626' : '2563EB';
                        } else if (nData.direction === 'decreasing') {
                            dirArrow = '\u2193 Decreasing';
                            dirColor = increaseIsBad ? '16A34A' : 'DC2626';
                        } else {
                            dirArrow = '\u2192 Stable'; dirColor = '6B7280';
                        }
                    
                        // Change text
                        var changeText = '';
                        if (nData.change !== undefined && nData.change !== null) {
                            changeText = (nData.change > 0 ? '+' : '') + safeToFixed(nData.change, 1);
                            if (nData.percentChange !== undefined && nData.percentChange !== null) {
                                changeText += ' (' + (nData.percentChange > 0 ? '+' : '') + safeToFixed(nData.percentChange, 1) + '%)';
                            }
                        }
                    
                        // Margin text
                        var marginText = '-';
                        var marginColor = '374151';
                        if (nData.mlsnMargin !== undefined && nData.mlsnMargin !== null) {
                            if (nData.mlsnMargin > 0) {
                                marginText = '+' + safeToFixed(nData.mlsnMargin, 1) + ' ' + tLabel.marginGood;
                                marginColor = '16A34A';
                            } else if (nData.mlsnMargin < 0) {
                                marginText = safeToFixed(Math.abs(nData.mlsnMargin), 1) + ' ' + tLabel.marginBad;
                                marginColor = 'DC2626';
                            } else {
                                marginText = 'At threshold';
                                marginColor = 'F59E0B';
                            }
                        }
                    
                        // Crossing risk - use correct field names: .status and .monthsUntilCrossing
                        var riskText = 'None';
                        var riskColor = '16A34A';
                        var riskFill = 'F0FFF4';
                        if (nData.crossingRisk) {
                            var crStatus = nData.crossingRisk.status;
                            if (crStatus === 'below' || crStatus === 'above') {
                                riskText = '\u26A0 ' + (crStatus === 'above' ? 'Over limit' : 'Below threshold');
                                riskColor = 'DC2626'; riskFill = 'FEF2F2';
                            } else if (crStatus === 'warning') {
                                riskText = 'Warning';
                                if (nData.crossingRisk.monthsUntilCrossing !== undefined) riskText += ' (~' + nData.crossingRisk.monthsUntilCrossing + ' mo)';
                                riskColor = 'F59E0B'; riskFill = 'FFFBEB';
                            } else if (crStatus === 'watch') {
                                riskText = 'Watch';
                                if (nData.crossingRisk.monthsUntilCrossing !== undefined) riskText += ' (~' + nData.crossingRisk.monthsUntilCrossing + ' mo)';
                                riskColor = '6B7280'; riskFill = 'F9FAFB';
                            }
                        }
                    
                        // Row shading
                        var isBadTrend = increaseIsBad ? (nData.direction === 'increasing') : (nData.direction === 'decreasing');
                        var rowFill = ni % 2 === 0 ? 'FFFFFF' : 'F9FAFB';
                        if (isBadTrend && nData.crossingRisk && 
                            (nData.crossingRisk.status === 'below' || nData.crossingRisk.status === 'above' || nData.crossingRisk.status === 'warning')) {
                            rowFill = 'FEF2F2';
                        }
                    
                        var cellData = [
                            { text: nKey, color: '1F2937', bold: true, width: 1200 },
                            { text: safeToFixed(nData.latest, 1, '-'), color: '374151', width: 1100 },
                            { text: safeToFixed(nData.previous, 1, '-'), color: '6B7280', width: 1100 },
                            { text: changeText || '-', color: nData.change < 0 ? (increaseIsBad ? '16A34A' : 'DC2626') : nData.change > 0 ? (increaseIsBad ? 'DC2626' : '2563EB') : '374151', width: 1200 },
                            { text: dirArrow, color: dirColor, width: 1260 },
                            { text: marginText, color: marginColor, width: 1700 },
                            { text: riskText, color: riskColor, width: 1800, fill: riskFill }
                        ];
                    
                        trendTableRows.push(new TableRow({
                            cantSplit: true,
                            children: cellData.map(function(cell) {
                                return new TableCell({
                                    borders: trendBorders,
                                    width: { size: cell.width, type: WidthType.DXA },
                                    shading: { fill: cell.fill || rowFill, type: ShadingType.CLEAR },
                                    margins: trendCellMargins,
                                    verticalAlign: VerticalAlign.CENTER,
                                    children: [new Paragraph({ 
                                        alignment: AlignmentType.CENTER,
                                        children: [new TextRun({ 
                                            text: cell.text, 
                                            size: 18, 
                                            color: cell.color || '374151',
                                            bold: cell.bold || false
                                        })] 
                                    })]
                                });
                            })
                        }));
                    }
                
                    sections.push(new Table({
                        width: { size: 9360, type: WidthType.DXA },
                        columnWidths: [1200, 1100, 1100, 1200, 1260, 1700, 1800],
                        rows: trendTableRows
                    }));
                
                    // Sparkline charts
                    var zoneCharts = charts.nutrientTrends ? charts.nutrientTrends[zoneKey] : null;
                    if (zoneCharts && Object.keys(zoneCharts).length > 0) {
                        sections.push(new Paragraph({
                            spacing: { before: 200, after: 80 },
                            children: [new TextRun({ text: 'Trends', bold: true, size: 22, color: '1F2937' })]
                        }));
                    
                        sections.push(new Paragraph({
                            spacing: { after: 100 },
                            children: [new TextRun({ 
                                text: 'Dashed line indicates the ' + tLabel.thresholdLabel + ' threshold guideline.',
                                size: 18, color: '9CA3AF', italics: true 
                            })]
                        }));
                    
                        // Two sparklines per row to halve page count
                        var sparkNutrients = Object.keys(zoneCharts);
                        var sparkBorder = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' };
                        var sparkBorders = { top: sparkBorder, bottom: sparkBorder, left: sparkBorder, right: sparkBorder };
                        var colW = 4680; // half page width in DXA
                        for (var si = 0; si < sparkNutrients.length; si += 2) {
                            var sparkCells = [];
                            for (var sj = si; sj < Math.min(si + 2, sparkNutrients.length); sj++) {
                                var sparkNutrient = sparkNutrients[sj];
                                var sparkChart = zoneCharts[sparkNutrient];
                                imageIdCounter++;
                                var sparkCellChildren = [
                                    new Paragraph({
                                        alignment: AlignmentType.CENTER,
                                        spacing: { before: 60, after: 20 },
                                        children: [new TextRun({ text: sparkNutrient, bold: true, size: 18, color: '374151' })]
                                    })
                                ];
                                if (sparkChart && sparkChart.base64) {
                                    sparkCellChildren.push(new Paragraph({
                                        alignment: AlignmentType.CENTER,
                                        spacing: { after: 40 },
                                        children: [new ImageRun({
                                            type: 'png',
                                            data: Uint8Array.from(atob(sparkChart.base64), function(c) { return c.charCodeAt(0); }),
                                            transformation: { width: 300, height: 82 },
                                            altText: {
                                                title: sparkNutrient + ' Trend',
                                                description: sparkNutrient + ' ' + dataType + ' trend over time',
                                                name: 'trend_sparkline_' + dataType + '_' + sparkNutrient + '_' + imageIdCounter
                                            }
                                        })]
                                    }));
                                }
                                sparkCells.push(new TableCell({
                                    borders: sparkBorders,
                                    width: { size: colW, type: WidthType.DXA },
                                    children: sparkCellChildren
                                }));
                            }
                            // Pad to 2 cells if odd number of nutrients
                            if (sparkCells.length < 2) {
                                sparkCells.push(new TableCell({
                                    borders: sparkBorders,
                                    width: { size: colW, type: WidthType.DXA },
                                    children: [new Paragraph({ children: [] })]
                                }));
                            }
                            sections.push(new Table({
                                width: { size: 9360, type: WidthType.DXA },
                                columnWidths: [colW, colW],
                                rows: [new TableRow({ children: sparkCells })]
                            }));
                        }
                    }
                
                    sections.push(new Paragraph({ children: [] }));
                }
            }
        }
        
        // Soil Amendment Recommendations section
        if (data.amendment && data.amendment.hasData) {
            sections.push(new Paragraph({ children: [new PageBreak()] }));
            sections.push(new Paragraph({
                heading: HeadingLevel.HEADING_1,
                spacing: { before: 240, after: 120 },
                children: [new TextRun({ text: 'Soil Amendment Recommendations', bold: true })]
            }));

            var amendIntro = 'Amendment product selection is based on soil pH, CEC, organic matter content, ' +
                'construction type, and water quality. Products are chosen to address deficits without ' +
                'compounding existing imbalances (e.g. avoiding carbonates at high pH, avoiding sulphates ' +
                'where irrigation water SO₄ is already elevated).';
            sections.push(new Paragraph({
                spacing: { after: 160 },
                children: [new TextRun({ text: amendIntro, size: 20, color: '374151' })]
            }));

            // Helper to build a product detail block
            function buildProductBlock(label, decision, accentColor) {
                if (!decision) return;
                accentColor = accentColor || '1D4ED8';
                var bgColor = 'F8FAFF';

                // Heading row
                sections.push(new Paragraph({
                    spacing: { before: 200, after: 60 },
                    children: [new TextRun({ text: label, bold: true, size: 22, color: accentColor })]
                }));

                // Pathway tag + primary product
                var primary = decision.primaryProduct || {};
                var pathwayLabel = {
                    HIGH_PH_INDUCED:       'High pH / Calcareous pathway',
                    LOW_CEC_SAND:          'Low CEC sand rootzone pathway',
                    LOW_PH_AL_MG_ANTAGONISM: 'Low pH / Al-Mg antagonism pathway',
                    HIGH_OM:               'High organic matter pathway',
                    GENERAL:               'General pathway',
                    HIGH_PH:               'High pH pathway',
                    SODIC:                 'Sodic soil pathway',
                    LOW_PH_CORRECTION:     'Low pH correction pathway',
                    ADEQUATE_PH:           'Adequate pH pathway'
                }[decision.pathway] || decision.pathway || '';

                sections.push(new Paragraph({
                    spacing: { before: 60, after: 40 },
                    shading: { fill: bgColor, type: ShadingType.CLEAR },
                    border: { left: { style: BorderStyle.SINGLE, size: 18, color: accentColor } },
                    indent: { left: 180 },
                    children: [
                        new TextRun({ text: 'Pathway:  ', bold: true, size: 20 }),
                        new TextRun({ text: pathwayLabel, size: 20, color: '374151' })
                    ]
                }));

                if (primary.name) {
                    var primaryText = primary.name;
                    if (primary.analysis) primaryText += '  (' + primary.analysis + ')';
                    sections.push(new Paragraph({
                        spacing: { before: 40, after: 40 },
                        indent: { left: 180 },
                        children: [
                            new TextRun({ text: 'Primary product:  ', bold: true, size: 20 }),
                            new TextRun({ text: primaryText, size: 20 })
                        ]
                    }));
                    if (primary.rate) {
                        sections.push(new Paragraph({
                            spacing: { before: 20, after: 40 },
                            indent: { left: 180 },
                            children: [
                                new TextRun({ text: 'Indicative rate:  ', bold: true, size: 20 }),
                                new TextRun({ text: primary.rate, size: 20 })
                            ]
                        }));
                    }
                    if (primary.notes) {
                        sections.push(new Paragraph({
                            spacing: { before: 20, after: 60 },
                            indent: { left: 180 },
                            children: [new TextRun({ text: primary.notes, size: 19, color: '6B7280', italics: true })]
                        }));
                    }
                }

                // Alternative product
                var alt = decision.alternativeProduct || {};
                if (alt && alt.name) {
                    sections.push(new Paragraph({
                        spacing: { before: 40, after: 40 },
                        indent: { left: 180 },
                        children: [
                            new TextRun({ text: 'Alternative:  ', bold: true, size: 20 }),
                            new TextRun({ text: alt.name + (alt.analysis ? '  (' + alt.analysis + ')' : ''), size: 20, color: '6B7280' })
                        ]
                    }));
                }

                // Urgency
                if (decision.urgency) {
                    var urgencyColor = decision.urgency === 'IMMEDIATE' ? 'DC2626' :
                                       decision.urgency === 'SHORT-TERM' ? 'D97706' : '16A34A';
                    sections.push(new Paragraph({
                        spacing: { before: 40, after: 40 },
                        indent: { left: 180 },
                        children: [
                            new TextRun({ text: 'Urgency:  ', bold: true, size: 20 }),
                            new TextRun({ text: decision.urgency, bold: true, size: 20, color: urgencyColor })
                        ]
                    }));
                }

                // Lime required flag
                if (decision.limeRequired) {
                    sections.push(new Paragraph({
                        spacing: { before: 40, after: 40 },
                        indent: { left: 180 },
                        children: [new TextRun({
                            text: '⚠️  Lime application required, pH correction is the primary intervention for this pathway.',
                            bold: true, size: 20, color: 'D97706'
                        })]
                    }));
                }

                // Foliar bridge
                if (decision.foliarBridge) {
                    sections.push(new Paragraph({
                        spacing: { before: 40, after: 40 },
                        indent: { left: 180 },
                        children: [new TextRun({
                            text: 'Foliar bridge recommended while soil amendment takes effect.',
                            size: 20, italics: true, color: '374151'
                        })]
                    }));
                }

                // Modifying factors
                if (decision.modifyingFactors && decision.modifyingFactors.length > 0) {
                    sections.push(new Paragraph({
                        spacing: { before: 80, after: 40 },
                        indent: { left: 180 },
                        children: [new TextRun({ text: 'Modifying factors:', bold: true, size: 20 })]
                    }));
                    decision.modifyingFactors.forEach(function(factor) {
                        sections.push(new Paragraph({
                            spacing: { before: 20, after: 20 },
                            indent: { left: 360 },
                            bullet: { level: 0 },
                            children: [new TextRun({ text: factor, size: 19, color: '374151' })]
                        }));
                    });
                }

                // Rationale
                if (decision.rationale) {
                    sections.push(new Paragraph({
                        spacing: { before: 80, after: 120 },
                        shading: { fill: 'F9FAFB', type: ShadingType.CLEAR },
                        indent: { left: 180 },
                        children: [new TextRun({ text: decision.rationale, size: 19, italics: true, color: '4B5563' })]
                    }));
                }
            }

            // Ca amendment block
            if (data.amendment.Ca && data.amendment.Ca.primaryProduct) {
                buildProductBlock('Calcium (Ca) Amendment', data.amendment.Ca, '065F46');
            }

            // Mg amendment block
            if (data.amendment.Mg && data.amendment.Mg.primaryProduct) {
                buildProductBlock('Magnesium (Mg) Amendment', data.amendment.Mg, '1E3A8A');
            }

            // Cross-product interaction warnings
            if (data.amendment.interactions && data.amendment.interactions.length > 0) {
                sections.push(new Paragraph({
                    spacing: { before: 200, after: 80 },
                    children: [new TextRun({ text: 'Ca–Mg Interaction Notes', bold: true, size: 22, color: '92400E' })]
                }));
                data.amendment.interactions.forEach(function(note) {
                    sections.push(new Paragraph({
                        spacing: { before: 40, after: 40 },
                        shading: { fill: 'FFFBEB', type: ShadingType.CLEAR },
                        border: { left: { style: BorderStyle.SINGLE, size: 18, color: 'F59E0B' } },
                        indent: { left: 180 },
                        children: [new TextRun({ text: note, size: 20, color: '374151' })]
                    }));
                });
            }

            // Disclaimer
            sections.push(new Paragraph({
                spacing: { before: 200, after: 60 },
                children: [new TextRun({
                    text: 'Note: Indicative rates require adjustment for actual soil deficit, bulk density, and rootzone depth. ' +
                          'Split applications are recommended for all soluble products (kieserite, Epsom salts) at rates exceeding 20 kg Mg/ha. ' +
                          'Confirm product availability and pricing with your supplier before ordering.',
                    size: 18, italics: true, color: '9CA3AF'
                })]
            }));

            sections.push(new Paragraph({ children: [] }));
        }

        // Water Quality section
        // b35fix434 / C43: gate tightened to measurement-based. Pre-fix the gate
        // included `data.water.hasData` which had too many writers (the proper
        // writers at 7953/7985/8012 plus the now-removed phytotox/salinity
        // last-resort fallback at 8063-8067). With phytotox/salinity globals
        // bleeding across site-switch and flipping hasData true on sites with
        // zero water samples, the gate fired on stale state. Post-fix gate
        // reads only real measurements: EC, SAR, Na, Ca. Na and Ca additions
        // cover ion-only lab panels with no EC reported (rare but legitimate).
        if (data.water && (data.water.EC > 0 || data.water.SAR > 0 || data.water.Na > 0 || data.water.Ca > 0)) {
            // Page break to ensure heading starts at top of new page
            sections.push(new Paragraph({ children: [new PageBreak()] }));
            
            var waterTitle = 'Water Quality';
            if (data.water.isBlended) {
                waterTitle = 'Water Quality (Blended - ' + data.water.sourceCount + ' sources)';
            }
            var waterContext = getSectionContext(data.water.sourceLabel);
            if (waterContext) {
                waterTitle += ', ' + waterContext;
            }
            sections.push(new Paragraph({ 
                heading: HeadingLevel.HEADING_1, keepNext: true, 
                children: [new TextRun(waterTitle)] 
            }));
            
            // Show water sample metadata line (date, lab ref, species)
            var waterMetaParts = [];
            if (data.water.testDate) {
                var waterDate = new Date(data.water.testDate);
                waterMetaParts.push('Sampled: ' + waterDate.toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' }));
            }
            if (data.water.labRef) {
                waterMetaParts.push('Lab ref: ' + data.water.labRef);
            }
            var waterSpecies = data.turf.speciesDisplay || data.turf.species || '';
            if (waterSpecies) waterMetaParts.push(waterSpecies);
            if (waterMetaParts.length > 0) {
                sections.push(new Paragraph({
                    spacing: { after: 60 },
                    children: [
                        new TextRun({ text: waterMetaParts.join('  •  '), size: 20, color: '6B7280', italics: true })
                    ]
                }));
            }
            
            var waterThresh = data.water.thresholds || {};
            var waterRows = [];
            if (data.water.isBlended) {
                waterRows.push(createKeyValueRow('Source Type', 'Blended (' + data.water.sourceCount + ' sources)', '2563eb'));
            }
            if (data.water.EC) waterRows.push(createKeyValueRow('EC', data.water.EC + ' dS/m', getWaterThresholdColor(data.water.EC, waterThresh.EC)));
            if (data.water.pH) waterRows.push(createKeyValueRow('pH', data.water.pH));
            if (data.water.SAR) waterRows.push(createKeyValueRow('SAR', typeof data.water.SAR === 'number' ? data.water.SAR.toFixed(1) : data.water.SAR, getWaterThresholdColor(data.water.SAR, waterThresh.SAR)));
            // Add SARadj if significantly different from SAR
            if (data.water.SARadj && data.water.SAR && Math.abs(data.water.SARadj - data.water.SAR) > 0.3) {
                var saradjColor = data.water.SARadj > 9 ? 'DC2626' : data.water.SARadj > 6 ? 'F59E0B' : '16A34A';
                waterRows.push(createKeyValueRow('SARadj (Adjusted)', typeof data.water.SARadj === 'number' ? data.water.SARadj.toFixed(1) : data.water.SARadj, saradjColor));
            }
            if (data.water.RSC) waterRows.push(createKeyValueRow('RSC', typeof data.water.RSC === 'number' ? data.water.RSC.toFixed(1) + ' meq/L' : data.water.RSC));
            if (data.water.Na) waterRows.push(createKeyValueRow('Sodium (Na)', (typeof data.water.Na === 'number' ? data.water.Na.toFixed(0) : data.water.Na) + ' ppm', getWaterThresholdColor(data.water.Na, waterThresh.Na)));
            if (data.water.Cl) waterRows.push(createKeyValueRow('Chloride (Cl)', (typeof data.water.Cl === 'number' ? data.water.Cl.toFixed(0) : data.water.Cl) + ' ppm', getWaterThresholdColor(data.water.Cl, waterThresh.Cl)));
            if (data.water.HCO3) waterRows.push(createKeyValueRow('Bicarbonate (HCO₃)', (typeof data.water.HCO3 === 'number' ? data.water.HCO3.toFixed(0) : data.water.HCO3) + ' ppm', getWaterThresholdColor(data.water.HCO3, waterThresh.HCO3)));
            if (data.water.B) waterRows.push(createKeyValueRow('Boron (B)', (typeof data.water.B === 'number' ? data.water.B.toFixed(2) : data.water.B) + ' ppm', getWaterThresholdColor(data.water.B, waterThresh.B)));
            if (data.water.classification) waterRows.push(createKeyValueRow('Classification', data.water.classification));
            if (data.water.sodiumHazard) waterRows.push(createKeyValueRow('Sodium Hazard', data.water.sodiumHazard, getStatusColor(data.water.sodiumHazard)));
            if (data.water.salinityHazard) waterRows.push(createKeyValueRow('Salinity Hazard', data.water.salinityHazard, getStatusColor(data.water.salinityHazard)));
            
            sections.push(createTable(waterRows));

            // ── BLENDED WATER DETAIL BLOCK (b35fix139) ──────────────────────────
            if (data.water.isBlended) {

                // CCPI row
                if (data.water.ccpi !== null && data.water.ccpi !== undefined) {
                    var ccpiVal = typeof data.water.ccpi === 'number' ? data.water.ccpi.toFixed(2) : data.water.ccpi;
                    var ccpiLabel = data.water.ccpiClassification ? data.water.ccpiClassification.label : '';
                    var ccpiDesc  = data.water.ccpiClassification ? data.water.ccpiClassification.desc  : '';
                    var ccpiColor = data.water.ccpiClassification ? (
                        data.water.ccpiClassification.class === 'status-deficient' ? 'DC2626' :
                        data.water.ccpiClassification.class === 'status-caution'   ? 'D97706' : '16A34A'
                    ) : '374151';
                    sections.push(new Paragraph({
                        spacing: { before: 200, after: 80 },
                        children: [new TextRun({ text: 'Carbonate Scaling (CCPI)', bold: true, size: 22, color: '1e3a5f' })]
                    }));
                    var ccpiRows = [];
                    ccpiRows.push(createKeyValueRow('CCPI', ccpiVal, ccpiColor));
                    if (ccpiLabel) ccpiRows.push(createKeyValueRow('Assessment', ccpiLabel, ccpiColor));
                    sections.push(createTable(ccpiRows));
                    if (ccpiDesc) {
                        sections.push(new Paragraph({
                            spacing: { before: 80, after: 80 },
                            children: [new TextRun({ text: ccpiDesc, size: 19, color: '374151', italics: true })]
                        }));
                    }
                }

                // Blend classifications summary
                var blendClassRows = [];
                if (data.water.salinityClass)    blendClassRows.push(createKeyValueRow('Salinity',    data.water.salinityClass.code    + ', ' + data.water.salinityClass.desc,    getStatusColor(data.water.salinityClass.code)));
                if (data.water.sodicityClass)    blendClassRows.push(createKeyValueRow('Sodicity',    data.water.sodicityClass.code    + ', ' + data.water.sodicityClass.desc,    getStatusColor(data.water.sodicityClass.code)));
                if (data.water.infiltrationClass) blendClassRows.push(createKeyValueRow('Infiltration', data.water.infiltrationClass.code + ', ' + data.water.infiltrationClass.desc, getStatusColor(data.water.infiltrationClass.code)));
                if (data.water.bicarbonateClass) blendClassRows.push(createKeyValueRow('Bicarbonate', data.water.bicarbonateClass.code  + ', ' + data.water.bicarbonateClass.desc, getStatusColor(data.water.bicarbonateClass.code)));
                if (blendClassRows.length > 0) {
                    sections.push(new Paragraph({
                        spacing: { before: 200, after: 80 },
                        children: [new TextRun({ text: 'Blended Water Risk Classifications', bold: true, size: 22, color: '1e3a5f' })]
                    }));
                    sections.push(createTable(blendClassRows));
                }

                // Optimiser result
                var opt = data.water.optimiserResult;
                if (opt && opt.found) {
                    sections.push(new Paragraph({
                        spacing: { before: 200, after: 80 },
                        children: [new TextRun({ text: 'Recommended Blend Ratio', bold: true, size: 22, color: '1e3a5f' })]
                    }));
                    var optRows = [];
                    for (var oi = 0; oi < opt.fractionsPercent.length; oi++) {
                        var srcLabel = (opt.result && opt.result._sources && opt.result._sources[oi] && opt.result._sources[oi].label)
                            ? opt.result._sources[oi].label : ('Source ' + (oi + 1));
                        optRows.push(createKeyValueRow(srcLabel, opt.fractionsPercent[oi], oi === opt.primaryIndex ? '16A34A' : '374151'));
                    }
                    var ob = opt.result.blendedMgL;
                    var od = opt.result.derived;
                    if (ob && od) {
                        optRows.push(createKeyValueRow('Blended EC',  (ob.EC_dSm || 0).toFixed(2) + ' dS/m'));
                        optRows.push(createKeyValueRow('Blended SAR', (od.SAR    || 0).toFixed(1)));
                        optRows.push(createKeyValueRow('Blended RSC', (od.RSC    || 0).toFixed(2) + ' meq/L'));
                        optRows.push(createKeyValueRow('Blended LSI', (od.LSI    || 0).toFixed(2)));
                    }
                    sections.push(createTable(optRows));
                    sections.push(new Paragraph({
                        spacing: { before: 80, after: 80 },
                        children: [new TextRun({ text: 'Maximises proportion of ' + opt.primaryLabel + ' (lowest EC×SAR) within safe thresholds (Ayers & Westcot 1985).', size: 19, color: '374151', italics: true })]
                    }));
                } else if (opt && !opt.found) {
                    sections.push(new Paragraph({
                        spacing: { before: 160, after: 80 },
                        children: [new TextRun({ text: 'Blend Optimisation: ' + opt.message, size: 19, color: 'D97706', italics: true })]
                    }));
                }
            }
            // ── END BLENDED WATER DETAIL ─────────────────────────────────────────

            // Add water chart if generated
            if (charts.water) {
                sections.push(new Paragraph({ children: [] }));
                sections.push(createImageParagraph(charts.water, 'water'));
            }
            
            // Multi-source water comparison charts
            if (charts.multiSource && charts.multiSource.water && Object.keys(charts.multiSource.water).length > 0) {
                sections.push(new Paragraph({
                    spacing: { before: 280, after: 80 },
                    children: [new TextRun({ text: 'Source Comparison', bold: true, size: 24, color: '1e3a5f' })]
                }));
                sections.push(new Paragraph({
                    spacing: { after: 120 },
                    children: [new TextRun({
                        text: 'Each chart shows all water sources plotted against the same axis. Dashed amber line indicates threshold guideline where applicable.',
                        size: 18, color: '6B7280', italics: true
                    })]
                }));
                var msoWaterNuts = Object.keys(charts.multiSource.water);
                for (var mwn = 0; mwn < msoWaterNuts.length; mwn++) {
                    var mwNut = msoWaterNuts[mwn];
                    var mwChart = charts.multiSource.water[mwNut];
                    if (!mwChart || !mwChart.base64) continue;
                    var msoDisplayNames = { SAR:'SAR', SARadj:'SAR adj', EC:'EC', pH:'pH', Na:'Na', Cl:'Cl', HCO3:'HCO₃', B:'B', Fe:'Fe', Ca:'Ca', Mg:'Mg', K:'K', SO4:'SO₄' };
                    sections.push(new Paragraph({
                        alignment: AlignmentType.CENTER,
                        spacing: { before: 80, after: 40 },
                        children: [new TextRun({ text: msoDisplayNames[mwNut] || mwNut, bold: true, size: 20, color: '374151' })]
                    }));
                    imageIdCounter++;
                    sections.push(new Paragraph({
                        alignment: AlignmentType.CENTER,
                        spacing: { after: 80 },
                        children: [new ImageRun({
                            type: 'png',
                            data: Uint8Array.from(atob(mwChart.base64), function(c) { return c.charCodeAt(0); }),
                            transformation: { width: 440, height: 194 },
                            altText: { title: mwNut + ' Source Comparison', description: 'Water source comparison chart for ' + mwNut, name: 'mso_water_' + mwNut + '_' + imageIdCounter }
                        })]
                    }));
                }
            }

            // Add SARadj explanation if applicable
            var saradjExplanation = generateSARadjExplanation(data.water);
            if (saradjExplanation) {
                saradjExplanation.forEach(function(el) { sections.push(el); });
            }
            
            // Add water interpretation and recommendations
            var waterNarrative = generateWaterNarrative(data.water, data.turf);
            if (waterNarrative) {
                var waterInterpretation = createInterpretationSection('Interpretation', waterNarrative);
                waterInterpretation.forEach(function(el) { sections.push(el); });
            }
            
            // ========================================
            // AI WATER INTERPRETATION v1.0.0
            // Adds Claude-generated narrative if user clicked "Interpret Water Quality"
            // b35fix313: suppressed in combined export — see soil interpretation
            // comment above. Same single-sample-global issue.
            // ========================================
            var aiWaterInterpretation = window.GAIP_WATER_INTERPRETATION;
            if (aiWaterInterpretation && aiWaterInterpretation.narrative && !window.GAIP_COMBINED_EXPORT_ACTIVE) {
                sections.push(new Paragraph({
                    spacing: { before: 300, after: 100 },
                    children: [new TextRun({ 
                        text: 'Water Quality Interpretation', 
                        bold: true, 
                        size: 22,
                        color: '1E40AF'  // Blue for water
                    })]
                }));
                
                // Process narrative - handle bold markers and split into paragraphs
                var aiWaterNarrative = aiWaterInterpretation.narrative;
                aiWaterNarrative = aiWaterNarrative.replace(/\*\*(.+?)\*\*/g, '<<BOLD>>$1<</BOLD>>');
                
                var aiWaterParagraphs = aiWaterNarrative.split(/\n\n+/);
                aiWaterParagraphs.forEach(function(para) {
                    if (!para.trim()) return;
                    
                    // Process bold markers within paragraph
                    var children = [];
                    var parts = para.split(/<<BOLD>>|<<\/BOLD>>/);
                    var isBold = false;
                    
                    parts.forEach(function(part) {
                        if (part) {
                            children.push(new TextRun({
                                text: part,
                                bold: isBold,
                                size: 20,
                                color: isBold ? '1E40AF' : '1F2937'  // Blue for bold
                            }));
                        }
                        isBold = !isBold;
                    });
                    
                    sections.push(new Paragraph({
                        spacing: { after: 120 },
                        children: children
                    }));
                });
                
                // Add citations if present
                if (aiWaterInterpretation.citations && Object.keys(aiWaterInterpretation.citations).length > 0) {
                    var waterCitationText = 'Sources: ' + Object.keys(aiWaterInterpretation.citations).map(function(key) {
                        var cite = aiWaterInterpretation.citations[key];
                        return cite.authors ? cite.authors + ' (' + cite.year + ')' : key;
                    }).join(', ');
                    
                    sections.push(new Paragraph({
                        spacing: { before: 80, after: 100 },
                        children: [new TextRun({
                            text: waterCitationText,
                            size: 16,
                            italics: true,
                            color: '6B7280'
                        })]
                    }));
                }
                
                // Add cached indicator
                if (aiWaterInterpretation.cached) {
                    sections.push(new Paragraph({
                        spacing: { before: 50, after: 100 },
                        children: [new TextRun({
                            text: '(Cached interpretation)',
                            size: 14,
                            italics: true,
                            color: '9CA3AF'
                        })]
                    }));
                }
            }
            
            sections.push(new Paragraph({ children: [] }));
        }
        
        // =====================================================================
        // PHYTOTOXICITY SECTION (v2.0.30)
        // Direct plant damage from irrigation water ions (separate from soil chemistry)
        // Sources: Ayers & Westcot 1985 FAO 29, Carrow & Duncan 1998, Harivandi 1999
        // =====================================================================
        if (data.phytotoxicity && data.phytotoxicity.assessments && data.phytotoxicity.assessments.length > 0) {
            var phytoRisk = data.phytotoxicity.overallRisk || 'unknown';
            var riskColor = phytoRisk === 'high' ? 'DC2626' : phytoRisk === 'moderate' ? 'F59E0B' : '16A34A';
            var riskBg = phytoRisk === 'high' ? 'FEF2F2' : phytoRisk === 'moderate' ? 'FFFBEB' : 'F0FDF4';
            
            sections.push(new Paragraph({ 
                heading: HeadingLevel.HEADING_1, keepNext: true, 
                children: [new TextRun('Phytotoxicity Risk')] 
            }));
            
            // Intro paragraph explaining what this section covers
            sections.push(new Paragraph({
                spacing: { before: 50, after: 100 },
                children: [new TextRun({ 
                    text: 'Direct plant damage from irrigation water ions applied via ' + (data.phytotoxicity.irrigationMethod || 'sprinkler') + ' irrigation. This assessment is separate from soil chemistry impacts (SAR, structure degradation).',
                    size: 20, italics: true, color: '6B7280'
                })]
            }));
            
            // Overall risk banner
            sections.push(new Paragraph({
                spacing: { before: 100, after: 100 },
                shading: { fill: riskBg, type: ShadingType.CLEAR },
                border: {
                    top: { style: BorderStyle.SINGLE, size: 1, color: riskColor },
                    bottom: { style: BorderStyle.SINGLE, size: 1, color: riskColor },
                    left: { style: BorderStyle.SINGLE, size: 24, color: riskColor },
                    right: { style: BorderStyle.SINGLE, size: 1, color: riskColor }
                },
                children: [
                    new TextRun({ text: 'Overall Phytotoxicity Risk: ', bold: true, size: 22, color: '374151' }),
                    new TextRun({ text: phytoRisk.toUpperCase(), bold: true, size: 22, color: riskColor }),
                    new TextRun({ text: ' for ' + (data.phytotoxicity.species || 'turfgrass'), size: 22, color: '374151' }),
                    new TextRun({ text: ' (' + (data.phytotoxicity.sensitivityClass || 'unknown') + ' sensitivity)', size: 20, italics: true, color: '6B7280' })
                ]
            }));
            
            // Individual ion assessments
            data.phytotoxicity.assessments.forEach(function(assessment) {
                var statusColor = assessment.status === 'high' ? 'DC2626' : 
                                 assessment.status === 'moderate' ? 'F59E0B' : '16A34A';
                var statusBg = assessment.status === 'high' ? 'FEF2F2' : 
                              assessment.status === 'moderate' ? 'FFFBEB' : 'F0FDF4';
                
                // Assessment header with parameter and value
                sections.push(new Paragraph({
                    spacing: { before: 120, after: 50 },
                    shading: { fill: statusBg, type: ShadingType.CLEAR },
                    border: { left: { style: BorderStyle.SINGLE, size: 16, color: statusColor } },
                    children: [
                        new TextRun({ text: assessment.parameter + ': ', bold: true, size: 22, color: '374151' }),
                        new TextRun({ text: assessment.value + ' ' + (assessment.unit || 'mg/L'), bold: true, size: 22, color: statusColor }),
                        new TextRun({ text: ', ' + (assessment.status || 'unknown').toUpperCase() + ' RISK', size: 20, color: statusColor })
                    ]
                }));
                
                // Pathway info
                if (assessment.pathway) {
                    sections.push(new Paragraph({
                        spacing: { before: 30, after: 30 },
                        indent: { left: 200 },
                        children: [
                            new TextRun({ text: 'Exposure pathway: ', size: 20, color: '6B7280' }),
                            new TextRun({ text: assessment.pathway, size: 20, color: '374151' })
                        ]
                    }));
                }
                
                // Thresholds
                if (assessment.thresholds) {
                    var threshText = [];
                    if (assessment.thresholds.foliar) threshText.push('Foliar: ' + assessment.thresholds.foliar + ' mg/L');
                    if (assessment.thresholds.root) threshText.push('Root: ' + assessment.thresholds.root + ' mg/L');
                    if (threshText.length > 0) {
                        sections.push(new Paragraph({
                            spacing: { before: 30, after: 30 },
                            indent: { left: 200 },
                            children: [
                                new TextRun({ text: 'Thresholds: ', size: 20, color: '6B7280' }),
                                new TextRun({ text: threshText.join(' | '), size: 20, color: '374151' })
                            ]
                        }));
                    }
                }
                
                // Risks
                if (assessment.risks && assessment.risks.length > 0) {
                    sections.push(new Paragraph({
                        spacing: { before: 30, after: 30 },
                        indent: { left: 200 },
                        children: [
                            new TextRun({ text: 'Potential damage: ', size: 20, color: '6B7280' }),
                            new TextRun({ text: assessment.risks.join(', '), size: 20, color: '374151' })
                        ]
                    }));
                }
                
                // Recommendation
                if (assessment.recommendation) {
                    sections.push(new Paragraph({
                        spacing: { before: 30, after: 50 },
                        indent: { left: 200 },
                        children: [
                            new TextRun({ text: assessment.recommendation, size: 20, bold: true, color: '374151' })
                        ]
                    }));
                }
            });
            
            // Priority actions summary
            if (data.phytotoxicity.priorityActions && data.phytotoxicity.priorityActions.length > 0) {
                sections.push(new Paragraph({
                    spacing: { before: 150, after: 50 },
                    children: [new TextRun({ text: 'Priority Actions', bold: true, size: 22 })]
                }));
                
                data.phytotoxicity.priorityActions.forEach(function(action) {
                    var actionColor = action.priority === 'high' ? 'DC2626' : 
                                     action.priority === 'medium' ? 'F59E0B' : '16A34A';
                    sections.push(new Paragraph({
                        spacing: { before: 50, after: 50 },
                        indent: { left: 200 },
                        children: [
                            new TextRun({ text: '• ', size: 20, color: actionColor }),
                            new TextRun({ text: action.action || action.text || action, size: 20, color: '374151' })
                        ]
                    }));
                });
            }
            
            sections.push(new Paragraph({ children: [] }));
        }
        
        // Soil × Water Interactions section
        var soilWaterData = generateSoilWaterInteractions(data);
        if (soilWaterData && soilWaterData.hasData) {
            sections.push(new Paragraph({ 
                heading: HeadingLevel.HEADING_1, keepNext: true, 
                children: [new TextRun('Soil × Water Interactions')] 
            }));
            
            sections.push(new Paragraph({
                spacing: { before: 50, after: 100 },
                children: [new TextRun({ 
                    text: 'Long-term impacts of irrigation water chemistry on soil conditions and turf performance.',
                    size: 20, italics: true, color: '6B7280'
                })]
            }));
            
            // Interaction cards
            soilWaterData.interactions.forEach(function(interaction) {
                var bgColor = interaction.type === 'critical' ? 'FEF2F2' : 
                             interaction.type === 'warning' ? 'FFFBEB' : 'F0F9FF';
                var borderColor = interaction.type === 'critical' ? 'DC2626' : 
                                 interaction.type === 'warning' ? 'F59E0B' : '3B82F6';
                
                sections.push(new Paragraph({
                    spacing: { before: 100, after: 50 },
                    shading: { fill: bgColor, type: ShadingType.CLEAR },
                    border: { left: { style: BorderStyle.SINGLE, size: 24, color: borderColor } },
                    children: [new TextRun({ text: interaction.title, bold: true, size: 22, color: borderColor })]
                }));
                sections.push(new Paragraph({
                    spacing: { before: 50, after: 100 },
                    indent: { left: 200 },
                    children: [new TextRun({ text: interaction.text, size: 20 })]
                }));
            });
            
            // Projections
            if (soilWaterData.projections.length > 0) {
                sections.push(new Paragraph({
                    spacing: { before: 150, after: 50 },
                    children: [new TextRun({ text: 'Projected Impacts', bold: true, size: 22 })]
                }));
                soilWaterData.projections.forEach(function(projection) {
                    sections.push(new Paragraph({
                        spacing: { before: 50, after: 50 },
                        indent: { left: 200 },
                        children: [new TextRun({ text: '• ' + projection, size: 20 })]
                    }));
                });
            }
            
            // Recommendations
            if (soilWaterData.recommendations.length > 0) {
                sections.push(new Paragraph({
                    spacing: { before: 150, after: 50 },
                    children: [new TextRun({ text: 'Management Recommendations', bold: true, size: 22 })]
                }));
                soilWaterData.recommendations.forEach(function(rec) {
                    sections.push(new Paragraph({
                        spacing: { before: 50, after: 50 },
                        indent: { left: 200 },
                        children: [new TextRun({ text: '• ' + rec, size: 20 })]
                    }));
                });
            }
            
            sections.push(new Paragraph({ children: [] }));
        }
        
        // SALINITY IMPACT SECTION (v2.0.8)
        // Shows salinity penalty and its effects on growth/recovery
        // Suppressed in combined export — water source is site-level, same for all greens.
        // =====================================================================
        if (data.salinity && data.salinity.hasData && data.salinity.growthPenaltyPct > 0 && !window.GAIP_COMBINED_EXPORT_ACTIVE) {
            sections.push(new Paragraph({ 
                heading: HeadingLevel.HEADING_1, keepNext: true, 
                children: [new TextRun('Salinity Stress Impact')] 
            }));
            
            // Explanation paragraph
            var salinityExplanation = 'Irrigation water electrical conductivity (ECw ' + 
                safeToFixed(data.salinity.ecwInput, 1, '?') + ' dS/m) exceeds the ' + 
                (data.salinity.toleranceClass || 'species') + ' tolerance threshold (' + 
                safeToFixed(data.salinity.threshold, 1, '?') + ' dS/m). ';
            salinityExplanation += 'Using the Maas-Hoffman salinity response model, this results in a ' + 
                safeToFixed(data.salinity.growthPenaltyPct, 1, '0') + '% reduction in growth potential. ';
            salinityExplanation += 'Salt-stressed turf diverts metabolic energy from growth to osmotic adjustment, ';
            salinityExplanation += 'reducing both wear tolerance and recovery capacity.';
            
            sections.push(new Paragraph({
                spacing: { after: 150 },
                children: [new TextRun({ text: salinityExplanation, size: 22 })]
            }));
            
            // Salinity data table
            var salinityRows = [];
            salinityRows.push(createKeyValueRow('Water ECw', safeToFixed(data.salinity.ecwInput, 2, '0.00') + ' dS/m'));
            salinityRows.push(createKeyValueRow('Species Threshold', safeToFixed(data.salinity.threshold, 1, '?') + ' dS/m'));
            salinityRows.push(createKeyValueRow('Tolerance Class', (data.salinity.toleranceClass || 'moderate').charAt(0).toUpperCase() + (data.salinity.toleranceClass || 'moderate').slice(1)));
            salinityRows.push(createKeyValueRow('Growth Reduction', safeToFixed(data.salinity.growthPenaltyPct, 1, '0') + '%', 'DC2626'));
            salinityRows.push(createKeyValueRow('Relative Yield', safeToFixed(data.salinity.relativeYieldPct, 1, '100') + '%'));
            
            if (data.salinity.recoveryExtension) {
                salinityRows.push(createKeyValueRow('Recovery Time Extension', '+' + data.salinity.recoveryExtension + '%', 'B45309'));
            }
            
            var statusColor = data.salinity.status === 'optimal' ? '16A34A' : 
                             data.salinity.status === 'threshold' ? 'CA8A04' : 
                             data.salinity.status === 'stressed' ? 'F59E0B' : 'DC2626';
            salinityRows.push(createKeyValueRow('Status', (data.salinity.status || 'stressed').charAt(0).toUpperCase() + (data.salinity.status || 'stressed').slice(1), statusColor));
            
            sections.push(createTable(salinityRows));
            
            // Management recommendations
            sections.push(new Paragraph({
                spacing: { before: 150, after: 50 },
                children: [new TextRun({ text: 'Management Recommendations', bold: true, size: 22 })]
            }));
            
            var salinityRecs = [];
            if (data.salinity.growthPenaltyPct > 20) {
                salinityRecs.push('Critical: Consider alternative water source or implement leaching program');
                salinityRecs.push('Apply extra irrigation (leaching fraction) to flush accumulated salts from rootzone');
            }
            if (data.salinity.growthPenaltyPct > 10) {
                salinityRecs.push('Monitor soil EC regularly - rootzone accumulation may exceed irrigation water EC');
                salinityRecs.push('Avoid allowing soil to dry excessively, which concentrates salts');
            }
            salinityRecs.push('Schedule traffic during periods of active growth to offset slower recovery');
            if (data.salinity.safetyMargin !== undefined && data.salinity.safetyMargin < 0) {
                salinityRecs.push('Consider more salt-tolerant varieties for future renovation');
            }
            
            salinityRecs.forEach(function(rec) {
                sections.push(new Paragraph({
                    spacing: { before: 50, after: 50 },
                    indent: { left: 200 },
                    children: [new TextRun({ text: '• ' + rec, size: 20 })]
                }));
            });
            
            sections.push(new Paragraph({ children: [] }));
        }
        
        // Shade section - no page break needed, flows naturally from salinity
        if (data.shade && data.shade.currentDLI) {
            // Build appropriate header based on effective species
            var dliLabel = 'Shade & Light (DLI)';
            if (data.turf.overseedDominant || data.shade.dliMode === 'overseed') {
                // Overseed dominant - label as C3 with species name
                var overseedName = data.turf.coolOverseed || 'Perennial Ryegrass';
                dliLabel = 'Shade & Light (DLI - ' + overseedName + ')';
            } else if (data.turf.useC3Targets) {
                dliLabel = 'Shade & Light (DLI - C3 Overseed)';
            } else if (data.turf.effectiveIsC4 || data.shade.dliMode === 'c4' || data.turf.isC4) {
                dliLabel = 'Shade & Light (DLI - C4)';
            } else {
                dliLabel = 'Shade & Light (DLI - C3)';
            }
            
            sections.push(new Paragraph({ 
                heading: HeadingLevel.HEADING_1, keepNext: true, 
                children: [new TextRun(dliLabel)] 
            }));
            
            var shadeRows = [];
            shadeRows.push(createKeyValueRow('Current DLI', (typeof data.shade.currentDLI === 'number' ? data.shade.currentDLI.toFixed(1) : data.shade.currentDLI) + ' mol/m²/d'));
            
            // For overseed dominant, show C3 targets as primary
            if (data.turf.overseedDominant || data.shade.dliMode === 'overseed') {
                var targetLabel = 'Target DLI (' + (data.turf.coolOverseed || 'C3') + ')';
                var minLabel = 'Minimum DLI (' + (data.turf.coolOverseed || 'C3') + ')';
                if (data.shade.targetDLI) shadeRows.push(createKeyValueRow(targetLabel, (typeof data.shade.targetDLI === 'number' ? data.shade.targetDLI.toFixed(1) : data.shade.targetDLI) + ' mol/m²/d'));
                if (data.shade.minDLI) shadeRows.push(createKeyValueRow(minLabel, (typeof data.shade.minDLI === 'number' ? data.shade.minDLI.toFixed(1) : data.shade.minDLI) + ' mol/m²/d'));
            } else {
                if (data.shade.targetDLI) shadeRows.push(createKeyValueRow('Target DLI (Optimal)', (typeof data.shade.targetDLI === 'number' ? data.shade.targetDLI.toFixed(1) : data.shade.targetDLI) + ' mol/m²/d'));
                if (data.shade.minDLI) shadeRows.push(createKeyValueRow('Minimum DLI', (typeof data.shade.minDLI === 'number' ? data.shade.minDLI.toFixed(1) : data.shade.minDLI) + ' mol/m²/d'));
            }
            
            if (data.shade.deficit !== undefined && data.shade.deficit > 0) shadeRows.push(createKeyValueRow('Deficit', data.shade.deficit + '%', 'F59E0B'));
            if (data.shade.status) shadeRows.push(createKeyValueRow('Status', data.shade.status, getStatusColor(data.shade.status)));
            if (data.shade.transmission) shadeRows.push(createKeyValueRow('Light Transmission', data.shade.transmission + '%'));
            
            sections.push(createTable(shadeRows));
            sections.push(new Paragraph({ children: [] }));
            
            // Shade chart
            if (charts.shade) {
                sections.push(createImageParagraph(charts.shade, 'shade'));
                sections.push(new Paragraph({ children: [] }));
            }
        }
        
        // PGR section — suppressed in combined export (site-level, same for all greens)
        if (data.pgr && data.pgr.product && !window.GAIP_COMBINED_EXPORT_ACTIVE) {
            // When overseed is dominant, PGR is managing the overseed species
            var pgrSpeciesLabel = 'PGR Program Status';
            var pgrTargetSpecies = '';
            
            if (data.turf.overseedDominant) {
                // Overseed dominant - PGR is regulating the overseed
                pgrTargetSpecies = data.turf.coolOverseed || 'Perennial Ryegrass';
                pgrSpeciesLabel = 'PGR Program Status (' + pgrTargetSpecies + ')';
            } else if (data.turf.hasOverseed) {
                if (data.turf.useC3Targets) {
                    pgrTargetSpecies = data.turf.coolOverseed || 'Perennial Ryegrass';
                    pgrSpeciesLabel = 'PGR Program Status (' + pgrTargetSpecies + ')';
                } else {
                    pgrTargetSpecies = data.turf.warmBase || 'Couch';
                    pgrSpeciesLabel = 'PGR Program Status (' + pgrTargetSpecies + ')';
                }
            } else if (data.turf.grassSpecies) {
                pgrTargetSpecies = data.turf.grassSpecies;
                pgrSpeciesLabel = 'PGR Program Status (' + pgrTargetSpecies + ')';
            }
            
            sections.push(new Paragraph({ 
                heading: HeadingLevel.HEADING_1, keepNext: true, 
                children: [new TextRun(pgrSpeciesLabel)] 
            }));
            
            var pgrRows = [];
            pgrRows.push(createKeyValueRow('Product', data.pgr.product));
            
            if (data.pgr.applicationDate) pgrRows.push(createKeyValueRow('Applied', data.pgr.applicationDate));
            
            // GDD progress with surface category for clarity
            if (data.pgr.gddAccumulated !== null && data.pgr.gddAccumulated !== undefined) {
                var gddText = data.pgr.gddAccumulated + ' / ' + (data.pgr.gddThreshold || 200) + ' GDD';
                if (data.pgr.gddProgress) {
                    gddText += ' (' + Math.round(data.pgr.gddProgress) + '%)';
                }
                pgrRows.push(createKeyValueRow('GDD Progress', gddText));
                
                // Show surface category if available (v2.4.0+)
                if (data.pgr.surfaceCategory) {
                    var surfaceText = data.pgr.surfaceCategory;
                    if (data.pgr.mowingHeightMM) {
                        surfaceText += ' @ ' + data.pgr.mowingHeightMM + 'mm HOC';
                    }
                    pgrRows.push(createKeyValueRow('Surface Type', surfaceText));
                }
                
                // Show validation warning if extrapolated (v2.3.0+)
                if (data.pgr.thresholdValidated === false && data.pgr.thresholdSource) {
                    pgrRows.push(createKeyValueRow('⚠️ Threshold', 'Extrapolated: ' + data.pgr.thresholdSource, '#F59E0B'));
                } else if (data.pgr.thresholdValidated === true && data.pgr.thresholdSource) {
                    pgrRows.push(createKeyValueRow('✓ Threshold', 'Research-validated: ' + data.pgr.thresholdSource, '#16A34A'));
                }
            }
            
            if (data.pgr.suppression) pgrRows.push(createKeyValueRow('Current Suppression', Math.round(data.pgr.suppression) + '%'));
            
            // Status with appropriate color
            if (data.pgr.status) {
                var statusColor = data.pgr.status === 'due' ? '#DC2626' : 
                                  data.pgr.status === 'approaching' ? '#F59E0B' : '#16A34A';
                var statusText = data.pgr.status.charAt(0).toUpperCase() + data.pgr.status.slice(1);
                pgrRows.push(createKeyValueRow('Reapplication Status', statusText, statusColor));
            }
            
            if (data.pgr.reapplyDate) pgrRows.push(createKeyValueRow('Reapply By', data.pgr.reapplyDate));
            if (data.pgr.daysUntilReapply) pgrRows.push(createKeyValueRow('Days Until Reapply', data.pgr.daysUntilReapply));
            
            // Shade warning if present
            if (data.pgr.shadeWarning) {
                pgrRows.push(createKeyValueRow('⚠️ Shade Warning', data.pgr.shadeWarning, '#DC2626'));
            }
            
            sections.push(createTable(pgrRows));
            sections.push(new Paragraph({ children: [] }));
            
            // PGR chart
            if (charts.pgr) {
                sections.push(createImageParagraph(charts.pgr, 'pgr'));
                sections.push(new Paragraph({ children: [] }));
            }
        }
        
        // DMI Fungicide Tracking section (v2.0 - evidence-based)
        if (data.dmi && data.dmi.product && data.dmi.isActive) {
            sections.push(new Paragraph({ 
                heading: HeadingLevel.HEADING_2, keepNext: true, 
                children: [new TextRun('Active DMI Fungicide')] 
            }));
            
            // Evidence-based intro
            sections.push(new Paragraph({ 
                children: [new TextRun({ 
                    text: 'DMI (demethylation inhibitor) fungicides are tracked for potential interactions with PGR programs. Research shows DMIs alone have minimal effect on clipping yield, but when combined with PGRs can cause elevated suppression and phytotoxicity.', 
                    size: 20 
                })]
            }));
            sections.push(new Paragraph({ children: [] }));
            
            var dmiRows = [];
            dmiRows.push(createKeyValueRow('Product', data.dmi.product));
            if (data.dmi.activeIngredient) dmiRows.push(createKeyValueRow('Active Ingredient', data.dmi.activeIngredient));
            
            // Risk category
            if (data.dmi.riskCategory) {
                var riskColor = data.dmi.riskCategory === 'high' ? '#DC2626' : 
                               data.dmi.riskCategory === 'moderate' ? '#F59E0B' : '#16A34A';
                dmiRows.push(createKeyValueRow('PGR Interaction Risk', data.dmi.riskCategory.toUpperCase(), riskColor));
            }
            
            // Species sensitivity
            if (data.dmi.speciesSensitivity) {
                var sensColor = data.dmi.speciesSensitivity === 'high' ? '#DC2626' : 
                               data.dmi.speciesSensitivity === 'moderate' ? '#F59E0B' : '#16A34A';
                dmiRows.push(createKeyValueRow('Species Sensitivity', data.dmi.speciesSensitivity.toUpperCase(), sensColor));
            }
            
            // GDD progress
            if (data.dmi.gddAccumulated !== null && data.dmi.gddAccumulated !== undefined) {
                var baseLabel = data.dmi.baseTemp > 0 ? ' (base ' + data.dmi.baseTemp + '°C)' : ' (base 0°C)';
                var dmiGddText = data.dmi.gddAccumulated + ' / ' + data.dmi.gddTypicalDuration + ' GDD' + baseLabel;
                if (data.dmi.gddProgress) {
                    dmiGddText += ' (' + data.dmi.gddProgress + '%)';
                }
                if (data.dmi.estimated) {
                    dmiGddText += ' [estimated]';
                }
                dmiRows.push(createKeyValueRow('GDD Progress', dmiGddText));
            }
            
            if (data.dmi.effectEndsDate && data.dmi.daysRemaining) {
                dmiRows.push(createKeyValueRow('Estimated Duration', '~' + data.dmi.daysRemaining + ' days remaining (until ' + data.dmi.effectEndsDate + ')'));
            }
            
            // Product-specific warning
            if (data.dmi.productWarning) {
                dmiRows.push(createKeyValueRow('Product Note', data.dmi.productWarning));
            }
            
            // Combined risk warning (evidence-based)
            if (data.dmi.combinedRisk && data.pgr && data.pgr.product) {
                var combColor = data.dmi.combinedWarningLevel === 'danger' ? '#DC2626' : 
                               data.dmi.combinedWarningLevel === 'warning' ? '#F59E0B' : '#EAB308';
                dmiRows.push(createKeyValueRow('⚠️ PGR + DMI Risk', data.dmi.combinedWarningLevel.toUpperCase(), combColor));
                
                if (data.dmi.combinedMessage) {
                    dmiRows.push(createKeyValueRow('Assessment', data.dmi.combinedMessage));
                }
                if (data.dmi.combinedRecommendation) {
                    dmiRows.push(createKeyValueRow('Recommendation', data.dmi.combinedRecommendation));
                }
            }
            
            sections.push(createTable(dmiRows));
            
            // Research note
            sections.push(new Paragraph({ 
                children: [new TextRun({ 
                    text: 'Note: This assessment is based on peer-reviewed research (Mitkowski & Chaves 2013, Penn State 2025, GreenKeeper/Kreuser). DMI standalone growth effects are minimal on most turfgrass species.', 
                    size: 18,
                    italics: true,
                    color: '666666'
                })]
            }));
            sections.push(new Paragraph({ children: [] }));
        }
        
        
        // =====================================================================
        // v2.1.0: ENHANCED SENSOR ZONE SECTION
        // =====================================================================
        if (data.sensor && data.sensor.hasData && data.sensor.zones && data.sensor.zones.length > 0) {
            sections.push(new Paragraph({ 
                heading: HeadingLevel.HEADING_1, keepNext: true, 
                children: [new TextRun('Soil Moisture Zones')] 
            }));
            
            // Count zones by status
            var zonesNeedingWater = 0;
            var totalIrrigation = 0;
            var wetZones = 0;
            var dryZones = 0;
            var criticalZones = [];
            var stressedZones = [];
            
            data.sensor.zones.forEach(function(z) {
                if (z.irrigation) {
                    if (z.irrigation.mmRequired > 0) {
                        zonesNeedingWater++;
                        totalIrrigation += z.irrigation.mmRequired;
                    }
                    if (z.irrigation.status === 'wet') wetZones++;
                    if (z.irrigation.status === 'critical') {
                        dryZones++;
                        criticalZones.push(z);
                    }
                    if (z.irrigation.status === 'stressed') {
                        stressedZones.push(z);
                    }
                }
            });
            
            // Methodology paragraph with optimal ranges
            sections.push(new Paragraph({
                spacing: { after: 150 },
                children: [new TextRun({ 
                    text: 'Volumetric Water Content (VWC) is measured using Time Domain Reflectometry (TDR) sensors, which determine soil moisture by measuring the dielectric constant of the soil. VWC represents the percentage of soil volume occupied by water. For sand-based rootzones, optimal VWC typically ranges from 18-28%, with field capacity around 30-35% and permanent wilting point near 8-12%. Trend indicators show 7-day moisture movement: ↑ wetting, → stable, ↓ drying, ↓↓ rapid drying.', 
                    size: 22 
                })]
            }));
            
            // Summary paragraph
            var introText = 'Soil moisture data collected from ' + data.sensor.totalReadings + ' TDR sensor readings across ' + data.sensor.zones.length + ' zone' + (data.sensor.zones.length > 1 ? 's' : '') + '. ';
            if (zonesNeedingWater > 0) {
                introText += zonesNeedingWater + ' zone' + (zonesNeedingWater > 1 ? 's require' : ' requires') + ' irrigation (total ' + totalIrrigation.toFixed(1) + ' mm). ';
            } else if (wetZones > 0) {
                introText += 'All zones are currently at adequate moisture levels' + (wetZones === data.sensor.zones.length ? ' (trending wet)' : '') + '. ';
            } else {
                introText += 'All zones are currently at adequate moisture levels. ';
            }
            if (data.sensor.selectedZone) {
                introText += 'Primary analysis zone: ' + data.sensor.selectedZone + '.';
            }
            
            sections.push(new Paragraph({
                spacing: { after: 200 },
                children: [new TextRun({ text: introText, size: 22 })]
            }));
            
            // v2.1.0: Enhanced zone summary table with trends and ranges
            var zoneTableRows = [];
            
            // Header row - added Range and Trend columns
            zoneTableRows.push(new TableRow({
                tableHeader: true,
                children: [
                    new TableCell({ 
                        shading: { fill: 'f3f4f6', type: ShadingType.CLEAR },
                        width: { size: 2000, type: WidthType.DXA },
                        children: [new Paragraph({ children: [new TextRun({ text: 'Zone', bold: true, size: 20 })] })]
                    }),
                    new TableCell({ 
                        shading: { fill: 'f3f4f6', type: ShadingType.CLEAR },
                        width: { size: 900, type: WidthType.DXA },
                        children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'N', bold: true, size: 20 })] })]
                    }),
                    new TableCell({ 
                        shading: { fill: 'f3f4f6', type: ShadingType.CLEAR },
                        width: { size: 1100, type: WidthType.DXA },
                        children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'Avg VWC', bold: true, size: 20 })] })]
                    }),
                    new TableCell({ 
                        shading: { fill: 'f3f4f6', type: ShadingType.CLEAR },
                        width: { size: 1200, type: WidthType.DXA },
                        children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'Range', bold: true, size: 20 })] })]
                    }),
                    new TableCell({ 
                        shading: { fill: 'f3f4f6', type: ShadingType.CLEAR },
                        width: { size: 800, type: WidthType.DXA },
                        children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'Trend', bold: true, size: 20 })] })]
                    }),
                    new TableCell({ 
                        shading: { fill: 'f3f4f6', type: ShadingType.CLEAR },
                        width: { size: 1000, type: WidthType.DXA },
                        children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'Status', bold: true, size: 20 })] })]
                    }),
                    new TableCell({ 
                        shading: { fill: 'f3f4f6', type: ShadingType.CLEAR },
                        width: { size: 1300, type: WidthType.DXA },
                        children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'Irrigation', bold: true, size: 20 })] })]
                    })
                ]
            }));
            
            // Data rows
            data.sensor.zones.forEach(function(zone) {
                var avgVwc = zone.avg !== undefined ? zone.avg : zone.avgVwc;
                
                // Range display (min-max)
                var rangeText = '-';
                if (zone.min !== undefined && zone.max !== undefined && zone.min !== null && zone.max !== null) {
                    rangeText = zone.min.toFixed(0) + '-' + zone.max.toFixed(0) + '%';
                }
                
                // v2.1.0: Trend indicator based on 7-day movement
                var trendText = '→';  // Default stable
                var trendColor = '666666';
                if (zone.trend !== undefined) {
                    if (zone.trend < -3) {
                        trendText = '↓↓';  // Rapid drying
                        trendColor = 'DC2626';
                    } else if (zone.trend < -1) {
                        trendText = '↓';   // Drying
                        trendColor = 'D97706';
                    } else if (zone.trend > 3) {
                        trendText = '↑↑';  // Rapid wetting
                        trendColor = '0369A1';
                    } else if (zone.trend > 1) {
                        trendText = '↑';   // Wetting
                        trendColor = '059669';
                    }
                } else if (zone.irrigation) {
                    // Infer trend from status if not explicitly provided
                    if (zone.irrigation.status === 'critical') {
                        trendText = '↓↓';
                        trendColor = 'DC2626';
                    } else if (zone.irrigation.status === 'stressed') {
                        trendText = '↓';
                        trendColor = 'D97706';
                    } else if (zone.irrigation.status === 'wet') {
                        trendText = '↑';
                        trendColor = '0369A1';
                    }
                }
                
                // Status display
                var statusText = '-';
                var statusColor = '374151';
                if (zone.irrigation && zone.irrigation.status) {
                    statusText = zone.irrigation.status.charAt(0).toUpperCase() + zone.irrigation.status.slice(1);
                    statusColor = zone.irrigation.status === 'critical' ? 'DC2626' :
                                 zone.irrigation.status === 'stressed' ? 'D97706' :
                                 zone.irrigation.status === 'wet' ? '0369A1' : '166534';
                }
                
                // Irrigation display
                var irrigText = '-';
                var irrigColor = '374151';
                if (zone.irrigation) {
                    if (zone.irrigation.mmRequired > 0) {
                        irrigText = zone.irrigation.mmRequired + ' mm';
                        irrigColor = zone.irrigation.status === 'critical' ? 'DC2626' : 'D97706';
                    } else {
                        irrigText = 'None';
                        irrigColor = '166534';
                    }
                }
                
                var isSelected = zone.name === data.sensor.selectedZone;
                var rowShading = isSelected ? { fill: 'ecfdf5', type: ShadingType.CLEAR } : 
                                zone.irrigation && zone.irrigation.status === 'critical' ? { fill: 'FEE2E2', type: ShadingType.CLEAR } : null;
                
                zoneTableRows.push(new TableRow({
                    children: [
                        new TableCell({ 
                            shading: rowShading,
                            children: [new Paragraph({ children: [new TextRun({ text: zone.name, bold: isSelected, size: 20 })] })]
                        }),
                        new TableCell({ 
                            shading: rowShading,
                            children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: String(zone.count), size: 20 })] })]
                        }),
                        new TableCell({ 
                            shading: rowShading,
                            children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: avgVwc !== null && avgVwc !== undefined ? avgVwc.toFixed(1) + '%' : '-', size: 20 })] })]
                        }),
                        new TableCell({ 
                            shading: rowShading,
                            children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: rangeText, size: 20 })] })]
                        }),
                        new TableCell({ 
                            shading: rowShading,
                            children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: trendText, size: 20, color: trendColor })] })]
                        }),
                        new TableCell({ 
                            shading: rowShading,
                            children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: statusText, size: 20, color: statusColor })] })]
                        }),
                        new TableCell({ 
                            shading: rowShading,
                            children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: irrigText, size: 20, bold: irrigText !== '-' && irrigText !== 'None', color: irrigColor })] })]
                        })
                    ]
                }));
            });
            
            sections.push(new Table({ width: { size: 8300, type: WidthType.DXA }, columnWidths: [2000, 900, 1100, 1200, 800, 1000, 1300], rows: zoneTableRows }));
            sections.push(new Paragraph({ children: [] }));
            
            // v2.1.0: Zone-Specific Recommendations
            if (criticalZones.length > 0 || stressedZones.length > 0) {
                sections.push(new Paragraph({ 
                    heading: HeadingLevel.HEADING_2, keepNext: true, 
                    children: [new TextRun('Zone-Specific Recommendations')] 
                }));
                
                // Critical zones first
                criticalZones.forEach(function(zone) {
                    var avgVwc = zone.avg !== undefined ? zone.avg : zone.avgVwc;
                    var recText = zone.name + ': VWC ' + (avgVwc ? avgVwc.toFixed(1) : '?') + '% is critically low. ';
                    recText += 'Apply ' + (zone.irrigation.mmRequired || '?') + 'mm irrigation immediately to prevent turf stress. ';
                    if (zone.max && zone.min && (zone.max - zone.min) > 10) {
                        recText += 'High spatial variability (' + zone.min.toFixed(0) + '-' + zone.max.toFixed(0) + '%) suggests possible localized dry spots - inspect for hydrophobic conditions or irrigation coverage issues.';
                    }
                    
                    sections.push(new Paragraph({
                        spacing: { after: 100 },
                        children: [
                            new TextRun({ text: recText, size: 22 })
                        ]
                    }));
                });
                
                // Stressed zones
                stressedZones.forEach(function(zone) {
                    var avgVwc = zone.avg !== undefined ? zone.avg : zone.avgVwc;
                    var recText = zone.name + ': VWC ' + (avgVwc ? avgVwc.toFixed(1) : '?') + '% is approaching stress threshold. ';
                    recText += 'Schedule irrigation within 24-48 hours';
                    if (zone.irrigation.mmRequired) {
                        recText += ' (' + zone.irrigation.mmRequired + 'mm recommended)';
                    }
                    recText += '.';
                    
                    sections.push(new Paragraph({
                        spacing: { after: 100 },
                        children: [
                            new TextRun({ text: recText, size: 22 })
                        ]
                    }));
                });
                
                sections.push(new Paragraph({ children: [] }));
            }
        }
        
        
        // Page break before Trajectory section
        var hasTrajectory = data.trajectory && data.trajectory.currentScore !== null;
        if (hasTrajectory) {
            sections.push(new Paragraph({ children: [new PageBreak()] }));
        }
        
        // Trajectory section
        if (data.trajectory && data.trajectory.currentScore !== null) {
            sections.push(new Paragraph({ 
                heading: HeadingLevel.HEADING_1, keepNext: true, 
                children: [new TextRun('14-Day Stress Trajectory')] 
            }));
            
            // Introductory text
            var trajIntro = 'Forecast stress trajectory based on predicted weather conditions over the next 14 days. ';
            if (data.trajectory.criticalPoints > 0) {
                trajIntro += data.trajectory.criticalPoints + ' day' + (data.trajectory.criticalPoints > 1 ? 's' : '') + ' of elevated stress predicted - plan management interventions accordingly.';
            } else if (data.trajectory.trend && data.trajectory.trend.toLowerCase().indexOf('increas') !== -1) {
                trajIntro += 'Stress levels trending upward - monitor conditions closely.';
            } else {
                trajIntro += 'Conditions are favourable for turf health over the forecast period.';
            }
            sections.push(new Paragraph({
                spacing: { after: 200 },
                children: [new TextRun({ text: trajIntro, size: 22 })]
            }));
            
            var trajRows = [];
            trajRows.push(createKeyValueRow('Current Score', data.trajectory.currentScore));
            if (data.trajectory.peakScore) trajRows.push(createKeyValueRow('Peak Score', data.trajectory.peakScore));
            if (data.trajectory.trend) trajRows.push(createKeyValueRow('Trend', data.trajectory.trend));
            trajRows.push(createKeyValueRow('Critical Points', data.trajectory.criticalPoints || 0));
            
            sections.push(createTable(trajRows));
            sections.push(new Paragraph({ children: [] }));
            
            // Trajectory chart
            if (charts.trajectory) {
                sections.push(createImageParagraph(charts.trajectory, 'trajectory'));
                sections.push(new Paragraph({ children: [] }));
            }
        }
        
        // b35fix433 (C42): Dew Forecast & Match Conditions section emit removed.
        // Tonight-only and 7-day dew forecast aged badly on a Word doc dated weeks
        // ago; live dew prediction with current weather is in the hub dashboard.
        // Collector + exec-summary flag + TOC entry removed in lockstep. Combined
        // export `siteLevelHeadings` filter and heading classifier dead entries
        // pruned in word-export-combined.js. The dew-prediction-engine itself is
        // unaffected: it continues to populate `state.computed.dew.leafWetness`
        // for engine-confidence + disease integration.
        
        // Traffic/Wear section
        if (data.traffic && data.traffic.hasData) {
            sections.push(new Paragraph({ 
                heading: HeadingLevel.HEADING_1, keepNext: true, 
                children: [new TextRun('Traffic & Wear Analysis')] 
            }));
            
            // Methodology explanation
            sections.push(new Paragraph({
                spacing: { after: 150 },
                children: [new TextRun({ 
                    text: 'Traffic analysis quantifies wear pressure using sport-specific impact factors that account for player density, movement patterns, and cleat damage. Weekly traffic load is calculated from scheduled matches and training sessions, with each activity type weighted by its relative impact on turf surfaces. The wear index combines traffic load with current growth conditions to predict turf sustainability.', 
                    size: 22 
                })]
            }));
            
            // Recovery window explanation
            var recoveryExplanation = '';
            if (data.traffic.recoveryDays) {
                recoveryExplanation = 'The recovery window (' + data.traffic.recoveryDays + ' days) represents the minimum rest period between high-intensity use required for the turf to recover adequate wear tolerance. ';
                if (data.traffic.recoveryDays <= 3) {
                    recoveryExplanation += 'This short recovery period is typical of warm-season grasses during peak growing conditions, where rapid cell division and leaf replacement occur.';
                } else if (data.traffic.recoveryDays <= 7) {
                    recoveryExplanation += 'This moderate recovery period reflects current growth rates - sufficient for most scheduling scenarios but may require adjustment during fixture congestion.';
                } else {
                    recoveryExplanation += 'This extended recovery period indicates slower growth conditions. Consider reducing training intensity or redistributing traffic to auxiliary areas during this period.';
                }
                sections.push(new Paragraph({
                    spacing: { after: 150 },
                    children: [new TextRun({ text: recoveryExplanation, size: 22 })]
                }));
            }
            
            // Status-specific guidance
            var trafficIntro = '';
            if (data.traffic.status) {
                var statusLower = data.traffic.status.toLowerCase();
                if (statusLower.indexOf('high') !== -1 || statusLower.indexOf('excessive') !== -1) {
                    trafficIntro = 'Current analysis indicates high wear pressure relative to recovery capacity. Management options include: reducing training session frequency, relocating training to secondary areas, implementing rest/rotation zones, or adjusting match scheduling where possible.';
                } else if (statusLower.indexOf('moderate') !== -1) {
                    trafficIntro = 'Wear levels are moderate and manageable with current recovery protocols. Continue monitoring and maintain flexibility to adjust if fixture density increases.';
                } else {
                    trafficIntro = 'Current wear levels are within the sustainable range for this turf type under prevailing growth conditions. Recovery capacity exceeds wear pressure.';
                }
                sections.push(new Paragraph({
                    spacing: { after: 200 },
                    children: [new TextRun({ text: trafficIntro, size: 22 })]
                }));
            }
            
            var trafficRows = [];
            var sportNames = { soccer: 'Soccer/Football', afl: 'AFL', rugby_union: 'Rugby Union', rugby_league: 'Rugby League', cricket: 'Cricket', nfl: 'American Football', baseball: 'Baseball' };
            if (data.traffic.sport) trafficRows.push(createKeyValueRow('Sport', sportNames[data.traffic.sport] || data.traffic.sport));
            if (data.traffic.matchesPerWeek) trafficRows.push(createKeyValueRow('Matches per Week', data.traffic.matchesPerWeek));
            if (data.traffic.sessionsPerWeek) trafficRows.push(createKeyValueRow('Training Sessions per Week', data.traffic.sessionsPerWeek));
            if (data.traffic.weeklyLoad) trafficRows.push(createKeyValueRow('Weekly Traffic Load', Math.round(data.traffic.weeklyLoad) + ' units'));
            if (data.traffic.wearIndex) trafficRows.push(createKeyValueRow('Wear Index', Math.round(data.traffic.wearIndex * 100) / 100));
            if (data.traffic.recoveryDays) trafficRows.push(createKeyValueRow('Recovery Window', data.traffic.recoveryDays + ' days'));
            if (data.traffic.wearZone) trafficRows.push(createKeyValueRow('Primary Wear Zone', data.traffic.wearZone));
            if (data.traffic.canSustain !== undefined) {
                var sustainColor = data.traffic.canSustain ? '166534' : 'dc2626';
                trafficRows.push(createKeyValueRow('Sustainable at Current Load', data.traffic.canSustain ? 'Yes' : 'No - reduce load or allow recovery', sustainColor));
            }
            if (data.traffic.status) trafficRows.push(createKeyValueRow('Overall Status', data.traffic.status, getStatusColor(data.traffic.status)));
            
            if (trafficRows.length > 0) {
                sections.push(createTable(trafficRows));
                sections.push(new Paragraph({ children: [] }));
            }
            
            // Add stress factors affecting recovery from orchestrator
            var orchestratorWear = window.GaipOrchestrator && window.GaipOrchestrator.getComputed ? 
                                   window.GaipOrchestrator.getComputed('wear') : null;
            var adjustedRecovery = orchestratorWear ? orchestratorWear.adjustedRecovery : null;
            
            if (adjustedRecovery && adjustedRecovery.adjustments && adjustedRecovery.adjustments.length > 0) {
                sections.push(new Paragraph({
                    heading: HeadingLevel.HEADING_2,
                    keepNext: true,
                    children: [new TextRun('Environmental Stress Factors Affecting Recovery')]
                }));
                
                // Summary paragraph
                var baseProb = adjustedRecovery.baseProbability || 80;
                var adjProb = adjustedRecovery.adjustedProbability || baseProb;
                var baseDays = adjustedRecovery.baseDays || 5;
                var adjDays = adjustedRecovery.adjustedDays || baseDays;
                
                var summaryText = 'Current environmental conditions are reducing recovery capacity. ';
                summaryText += 'Base recovery probability of ' + baseProb + '% has been reduced to ' + adjProb + '%. ';
                summaryText += 'Recovery window has extended from ' + baseDays + ' days to ' + adjDays + ' days. ';
                summaryText += 'The following stress factors are contributing to this reduction:';
                
                sections.push(new Paragraph({
                    spacing: { after: 150 },
                    children: [new TextRun({ text: summaryText, size: 22 })]
                }));
                
                // Stress factors table
                var stressRows = [];
                adjustedRecovery.adjustments.forEach(function(adj) {
                    var factorName = adj.factor.charAt(0).toUpperCase() + adj.factor.slice(1);
                    var modification = adj.modification || adj.factor;
                    var effect = adj.effect || '';
                    
                    // Color based on severity
                    var color = '000000';
                    if (adj.factor === 'shade') color = '6366F1';
                    else if (adj.factor === 'salinity') color = '0891B2';
                    else if (adj.factor === 'temperature') color = 'DC2626';
                    else if (adj.factor === 'compound') color = '7C3AED';
                    
                    stressRows.push(new TableRow({
                        children: [
                            new TableCell({
                                width: { size: 2000, type: WidthType.DXA },
                                children: [new Paragraph({ 
                                    children: [new TextRun({ text: factorName, bold: true, size: 22, color: color })] 
                                })]
                            }),
                            new TableCell({
                                width: { size: 4500, type: WidthType.DXA },
                                children: [new Paragraph({ 
                                    children: [new TextRun({ text: modification, size: 22 })] 
                                })]
                            }),
                            new TableCell({
                                width: { size: 3000, type: WidthType.DXA },
                                children: [new Paragraph({ 
                                    children: [new TextRun({ text: effect, size: 22, color: 'B45309' })] 
                                })]
                            })
                        ]
                    }));
                });
                
                if (stressRows.length > 0) {
                    // Header row
                    var headerRow = new TableRow({
                        children: [
                            new TableCell({
                                width: { size: 2000, type: WidthType.DXA },
                                shading: { fill: 'E5E7EB' },
                                children: [new Paragraph({ 
                                    children: [new TextRun({ text: 'Stress Factor', bold: true, size: 22 })] 
                                })]
                            }),
                            new TableCell({
                                width: { size: 4500, type: WidthType.DXA },
                                shading: { fill: 'E5E7EB' },
                                children: [new Paragraph({ 
                                    children: [new TextRun({ text: 'Condition', bold: true, size: 22 })] 
                                })]
                            }),
                            new TableCell({
                                width: { size: 3000, type: WidthType.DXA },
                                shading: { fill: 'E5E7EB' },
                                children: [new Paragraph({ 
                                    children: [new TextRun({ text: 'Recovery Impact', bold: true, size: 22 })] 
                                })]
                            })
                        ]
                    });
                    
                    sections.push(new Table({ width: { size: 9500, type: WidthType.DXA }, columnWidths: [2000, 4500, 3000], rows: [headerRow].concat(stressRows) }));
                    sections.push(new Paragraph({ children: [] }));
                }
                
                // Warning if present
                if (adjustedRecovery.warning) {
                    sections.push(new Paragraph({
                        spacing: { before: 100, after: 150 },
                        shading: { fill: 'FEF2F2' },
                        border: { left: { color: 'DC2626', size: 24, style: BorderStyle.SINGLE } },
                        children: [
                            new TextRun({ text: '⚠ Warning: ', bold: true, size: 22, color: 'DC2626' }),
                            new TextRun({ text: adjustedRecovery.warning, size: 22 })
                        ]
                    }));
                }
            }
            // v2.0.8: Fallback - use recovery modifiers from wear-recovery engine
            else if (data.traffic.recoveryModifiers) {
                var rm = data.traffic.recoveryModifiers;
                var hasStressFactors = (rm.salinity && rm.salinity.factor > 1) || 
                                      (rm.shade && rm.shade > 1) || 
                                      (rm.temperatureStress && rm.temperatureStress.factor > 1);
                
                if (hasStressFactors) {
                    sections.push(new Paragraph({
                        heading: HeadingLevel.HEADING_2,
                        keepNext: true,
                        children: [new TextRun('Environmental Stress Factors Affecting Recovery')]
                    }));
                    
                    // Summary
                    var modSummary = 'Environmental stress factors are extending the recovery window from ' + 
                        rm.baseDays + ' to ' + rm.adjustedDays + ' days.';
                    sections.push(new Paragraph({
                        spacing: { after: 150 },
                        children: [new TextRun({ text: modSummary, size: 22 })]
                    }));
                    
                    // Build modifier rows
                    var modRows = [];
                    
                    if (rm.salinity && rm.salinity.factor > 1) {
                        var salEffect = '+' + Math.round((rm.salinity.factor - 1) * 100) + '% recovery time';
                        modRows.push(new TableRow({
                            children: [
                                new TableCell({ width: { size: 2000, type: WidthType.DXA },
                                    children: [new Paragraph({ children: [new TextRun({ text: 'Salinity', bold: true, size: 22, color: '0891B2' })] })] }),
                                new TableCell({ width: { size: 4500, type: WidthType.DXA },
                                    children: [new Paragraph({ children: [new TextRun({ text: rm.salinity.note || 'Elevated water EC', size: 22 })] })] }),
                                new TableCell({ width: { size: 3000, type: WidthType.DXA },
                                    children: [new Paragraph({ children: [new TextRun({ text: salEffect, size: 22, color: 'B45309' })] })] })
                            ]
                        }));
                    }
                    
                    if (rm.shade && rm.shade > 1) {
                        var shadeEffect = '+' + Math.round((rm.shade - 1) * 100) + '% recovery time';
                        modRows.push(new TableRow({
                            children: [
                                new TableCell({ width: { size: 2000, type: WidthType.DXA },
                                    children: [new Paragraph({ children: [new TextRun({ text: 'Shade', bold: true, size: 22, color: '6366F1' })] })] }),
                                new TableCell({ width: { size: 4500, type: WidthType.DXA },
                                    children: [new Paragraph({ children: [new TextRun({ text: 'DLI deficit reducing photosynthesis', size: 22 })] })] }),
                                new TableCell({ width: { size: 3000, type: WidthType.DXA },
                                    children: [new Paragraph({ children: [new TextRun({ text: shadeEffect, size: 22, color: 'B45309' })] })] })
                            ]
                        }));
                    }
                    
                    if (rm.temperatureStress && rm.temperatureStress.factor > 1) {
                        var tempEffect = '+' + Math.round((rm.temperatureStress.factor - 1) * 100) + '% recovery time';
                        modRows.push(new TableRow({
                            children: [
                                new TableCell({ width: { size: 2000, type: WidthType.DXA },
                                    children: [new Paragraph({ children: [new TextRun({ text: 'Temperature', bold: true, size: 22, color: 'DC2626' })] })] }),
                                new TableCell({ width: { size: 4500, type: WidthType.DXA },
                                    children: [new Paragraph({ children: [new TextRun({ text: 'ESI ' + (rm.temperatureStress.esi || '?') + '/100', size: 22 })] })] }),
                                new TableCell({ width: { size: 3000, type: WidthType.DXA },
                                    children: [new Paragraph({ children: [new TextRun({ text: tempEffect, size: 22, color: 'B45309' })] })] })
                            ]
                        }));
                    }
                    
                    if (rm.growth && rm.growth < 0.8) {
                        var growthEffect = '+' + Math.round((1/rm.growth - 1) * 100) + '% recovery time';
                        modRows.push(new TableRow({
                            children: [
                                new TableCell({ width: { size: 2000, type: WidthType.DXA },
                                    children: [new Paragraph({ children: [new TextRun({ text: 'Growth Rate', bold: true, size: 22, color: '059669' })] })] }),
                                new TableCell({ width: { size: 4500, type: WidthType.DXA },
                                    children: [new Paragraph({ children: [new TextRun({ text: 'Low growth potential (' + Math.round(rm.growth * 100) + '%)', size: 22 })] })] }),
                                new TableCell({ width: { size: 3000, type: WidthType.DXA },
                                    children: [new Paragraph({ children: [new TextRun({ text: growthEffect, size: 22, color: 'B45309' })] })] })
                            ]
                        }));
                    }
                    
                    if (modRows.length > 0) {
                        var modHeaderRow = new TableRow({
                            children: [
                                new TableCell({ width: { size: 2000, type: WidthType.DXA }, shading: { fill: 'E5E7EB' },
                                    children: [new Paragraph({ children: [new TextRun({ text: 'Stress Factor', bold: true, size: 22 })] })] }),
                                new TableCell({ width: { size: 4500, type: WidthType.DXA }, shading: { fill: 'E5E7EB' },
                                    children: [new Paragraph({ children: [new TextRun({ text: 'Condition', bold: true, size: 22 })] })] }),
                                new TableCell({ width: { size: 3000, type: WidthType.DXA }, shading: { fill: 'E5E7EB' },
                                    children: [new Paragraph({ children: [new TextRun({ text: 'Recovery Impact', bold: true, size: 22 })] })] })
                            ]
                        });
                        
                        sections.push(new Table({ width: { size: 9500, type: WidthType.DXA }, columnWidths: [2000, 4500, 3000], rows: [modHeaderRow].concat(modRows) }));
                        sections.push(new Paragraph({ children: [] }));
                    }
                }
            }
            
            // Add traffic chart if generated
            if (charts.traffic) {
                sections.push(createImageParagraph(charts.traffic, 'traffic'));
                sections.push(new Paragraph({ children: [] }));
            }
        }
        
        // Overseed Climate Assessment section
        if (data.overseedClimate && data.overseedClimate.hasData) {
            var osc = data.overseedClimate;
            var stageLower = (osc.stage || '').toLowerCase();
            var isTransitionStage = (stageLower === 'transitioning' || stageLower === 'fading' || stageLower === 'dying');
            
            // Use appropriate title based on stage
            var sectionTitle = isTransitionStage ? 'Overseed Transition Status' : 'Overseed Climate Assessment';
            
            sections.push(new Paragraph({ 
                heading: HeadingLevel.HEADING_1, keepNext: true, 
                children: [new TextRun(sectionTitle)] 
            }));
            
            // Stage-appropriate introductory text
            var overseedIntro;
            if (isTransitionStage) {
                overseedIntro = 'Summer transition assessment for overseeded turf. ';
                overseedIntro += 'The cool-season ryegrass overseed is declining as expected for this season, allowing the warm-season base grass to recover.';
            } else {
                overseedIntro = 'Climate-enhanced assessment of overseed establishment conditions. ';
                if (osc.temperatureStress === 'none' || osc.temperatureStress === 'mild') {
                    overseedIntro += 'Temperature conditions are suitable for overseed maintenance.';
                } else if (osc.temperatureStress === 'moderate') {
                    overseedIntro += 'Moderate temperature stress may affect overseed performance.';
                } else {
                    overseedIntro += 'Temperature conditions are challenging for overseed - monitor closely.';
                }
            }
            sections.push(new Paragraph({
                spacing: { after: 200 },
                children: [new TextRun({ text: overseedIntro, size: 22 })]
            }));
            
            // Status rows - use appropriate label for stage
            var overseedRows = [];
            var stageLabel = isTransitionStage ? 'Transition Stage' : 'Overseed Stage';
            overseedRows.push(createKeyValueRow(stageLabel, osc.stage.charAt(0).toUpperCase() + osc.stage.slice(1)));
            
            // Only show wear tolerance for non-transition stages (it's not relevant during summer)
            if (!isTransitionStage) {
                overseedRows.push(createKeyValueRow('Wear Tolerance', Math.round(osc.adjustedMultiplier * 100) + '%'));
            }
            
            if (osc.temperatureNote) overseedRows.push(createKeyValueRow('Temperature Effect', osc.temperatureNote));
            if (osc.airTemp !== null) overseedRows.push(createKeyValueRow('Air Temperature', osc.airTemp.toFixed(1) + '°C'));
            if (osc.soilTemp !== null) overseedRows.push(createKeyValueRow('Soil Temperature', osc.soilTemp.toFixed(1) + '°C (' + osc.soilTempSource + ')'));
            
            // Only show germination for establishment stages
            if (!isTransitionStage && osc.germination && osc.germination.days) {
                overseedRows.push(createKeyValueRow('Germination Time', '~' + osc.germination.days + ' days at current temps'));
            }
            if (!isTransitionStage && osc.overseedWindow && osc.overseedWindow.score) {
                overseedRows.push(createKeyValueRow('Window Score', osc.overseedWindow.score + '/100'));
            }
            if (osc.weatherStatus && osc.weatherStatus.status) overseedRows.push(createKeyValueRow('Weather Data', osc.weatherStatus.status.charAt(0).toUpperCase() + osc.weatherStatus.status.slice(1)));
            
            if (overseedRows.length > 0) {
                sections.push(createTable(overseedRows));
            }
            
            // Recommendations
            if (osc.recommendations && osc.recommendations.length > 0) {
                sections.push(new Paragraph({ 
                    spacing: { before: 200, after: 80 },
                    children: [new TextRun({ text: 'Recommendations:', bold: true, size: 22 })] 
                }));
                osc.recommendations.forEach(function(rec) {
                    sections.push(new Paragraph({
                        bullet: { level: 0 },
                        spacing: { after: 60 },
                        children: [new TextRun({ text: rec, size: 22 })]
                    }));
                });
            }
            
            sections.push(new Paragraph({ children: [] }));
        }
        
        // Performance Impact Analysis section - discusses relationships between factors
        var impactAnalysis = generatePerformanceImpactAnalysis(data);
        if (impactAnalysis) {
            sections.push(new Paragraph({ children: [new PageBreak()] }));
            
            sections.push(new Paragraph({ 
                heading: HeadingLevel.HEADING_1, keepNext: true, 
                children: [new TextRun('Performance Impact Analysis')] 
            }));
            
            // Introductory paragraph
            sections.push(new Paragraph({
                spacing: { after: 200 },
                children: [new TextRun({ 
                    text: 'This section examines how site-specific factors interact to affect turf performance. Understanding these relationships helps prioritise management interventions.', 
                    size: 22, 
                    color: '4B5563' 
                })]
            }));
            
            // Narrative paragraphs (cultivar overview)
            if (impactAnalysis.narrative && impactAnalysis.narrative.length > 0) {
                impactAnalysis.narrative.forEach(function(text) {
                    sections.push(new Paragraph({
                        spacing: { after: 120 },
                        children: [new TextRun({ text: text, size: 22, color: '374151' })]
                    }));
                });
            }
            
            // Relationships and interactions - rendered as professional prose paragraphs
            if (impactAnalysis.relationships && impactAnalysis.relationships.length > 0) {
                impactAnalysis.relationships.forEach(function(rel) {
                    // Main text as a paragraph
                    sections.push(new Paragraph({
                        spacing: { after: 120 },
                        children: [new TextRun({ text: rel.text, size: 22, color: '374151' })]
                    }));
                    
                    // Source citation if available - inline italics
                    if (rel.source) {
                        sections.push(new Paragraph({
                            spacing: { after: 160 },
                            children: [new TextRun({ 
                                text: 'Reference: ' + rel.source, 
                                size: 18, 
                                color: '6B7280',
                                italics: true
                            })]
                        }));
                    }
                });
            }
            
            // Recommendations - as numbered prose, not bullet points
            if (impactAnalysis.recommendations && impactAnalysis.recommendations.length > 0) {
                sections.push(new Paragraph({
                    spacing: { before: 200, after: 100 },
                    children: [new TextRun({ text: 'Management Recommendations', bold: true, size: 22, color: '1F2937' })]
                }));
                
                impactAnalysis.recommendations.forEach(function(rec, index) {
                    sections.push(new Paragraph({
                        spacing: { after: 100 },
                        children: [new TextRun({ text: (index + 1) + '. ' + rec, size: 22, color: '374151' })]
                    }));
                });
            }
            
            sections.push(new Paragraph({ children: [] }));
        }
        
        // v10.3.38: Nutrition Program section - page break before for clean separation
        if (data.nutritionProgram && data.nutritionProgram.hasData) {
            sections.push(new Paragraph({ children: [new PageBreak()] }));
            
            var nutritionElements = renderNutritionProgramSection(data);
            nutritionElements.forEach(function(el) {
                sections.push(el);
            });
        }
        
        // Spray Application Log section
        if (data.sprayLog && data.sprayLog.hasData) {
            sections.push(new Paragraph({ children: [new PageBreak()] }));
            
            var sprayElements = renderSprayLogSection(data);
            sprayElements.forEach(function(el) {
                sections.push(el);
            });
        }
        
        // Cultivar Performance Profile section - flows directly after Performance Impact Analysis
        var cultivarProfile = generateCultivarProfile(data);
        if (cultivarProfile && cultivarProfile.hasData) {
            // No page break - cultivar profile flows naturally after performance impact
            var profileElements = renderCultivarProfileSection(cultivarProfile);
            profileElements.forEach(function(el) {
                sections.push(el);
            });
            
            sections.push(new Paragraph({ children: [] }));
        }
        
        // Companion surface disease section (golf greens only)
        if (data.companionDisease && data.companionDisease.hasData) {
            var cd = data.companionDisease;
            sections.push(new Paragraph({
                heading: HeadingLevel.HEADING_1, keepNext: true,
                children: [new TextRun(cd.speciesLabel + ' Fairway/Tee, Disease Assessment')]
            }));
            sections.push(new Paragraph({
                spacing: { after: 200 },
                children: [new TextRun(
                    'Parallel disease assessment for ' + cd.speciesLabel + ' using the same weather conditions as the greens assessment. ' +
                    cd.note
                )]
            }));
            if (cd.diseases && cd.diseases.length > 0) {
                var cdRows = [
                    new TableRow({
                        tableHeader: true,
                        children: [
                            new TableCell({ shading: { fill: '1E3A5F', type: ShadingType.CLEAR }, children: [new Paragraph({ children: [new TextRun({ text: 'Disease', bold: true, color: 'FFFFFF', size: 20 })] })] }),
                            new TableCell({ shading: { fill: '1E3A5F', type: ShadingType.CLEAR }, children: [new Paragraph({ children: [new TextRun({ text: 'Risk', bold: true, color: 'FFFFFF', size: 20 })] })] }),
                            new TableCell({ shading: { fill: '1E3A5F', type: ShadingType.CLEAR }, children: [new Paragraph({ children: [new TextRun({ text: 'Level', bold: true, color: 'FFFFFF', size: 20 })] })] }),
                        ]
                    })
                ];
                cd.diseases.forEach(function(d) {
                    var risk = Math.round(d.adjustedRisk || d.riskScore || 0);
                    var level = risk >= 70 ? 'Severe' : risk >= 50 ? 'High' : risk >= 30 ? 'Moderate' : 'Low';
                    cdRows.push(new TableRow({ children: [
                        new TableCell({ width: { size: 4500, type: WidthType.DXA }, children: [new Paragraph({ children: [new TextRun({ text: d.displayName || d.disease || '', size: 20 })] })] }),
                        new TableCell({ width: { size: 1500, type: WidthType.DXA }, children: [new Paragraph({ children: [new TextRun({ text: risk + '%', size: 20 })] })] }),
                        new TableCell({ width: { size: 3000, type: WidthType.DXA }, children: [new Paragraph({ children: [new TextRun({ text: level, size: 20 })] })] }),
                    ]}));
                });
                sections.push(new Table({ columnWidths: [4500, 1500, 3000], rows: cdRows, width: { size: 9000, type: WidthType.DXA } }));
            }
            sections.push(new Paragraph({ spacing: { after: 300 }, children: [] }));
        }


        // Page break before References section - always on its own page
        sections.push(new Paragraph({ children: [new PageBreak()] }));
        
        // References section
        sections.push(new Paragraph({ 
            heading: HeadingLevel.HEADING_1, keepNext: true, 
            children: [new TextRun('References & Methodology')] 
        }));
        
        // Add methodology note
        sections.push(new Paragraph({
            spacing: { after: 200 },
            children: [new TextRun({ 
                text: 'This report represents a point-in-time analysis based on the soil, tissue, and water quality data provided. Turf conditions are dynamic, and the relationships identified in this report may change as environmental conditions, management practices, and plant development progress. For comprehensive trend analysis and to track the effectiveness of management interventions, periodic re-testing is recommended, with soil analysis annually, tissue testing during active growth periods, and water quality assessment when source conditions change.', 
                size: 22, 
                color: '4B5563' 
            })]
        }));
        
        sections.push(new Paragraph({
            spacing: { after: 120 },
            children: [new TextRun({ 
                text: 'The analysis and recommendations in this report are based on peer-reviewed methodologies and evidence-based guidelines. The following sources underpin the interpretations provided:', 
                size: 22, 
                color: '4B5563' 
            })]
        }));
        
        // Reference list
        var references = [
            { category: 'Soil Nutrition', refs: [
                'Woods, M.S., Stowell, L.J. & Gelernter, W.D. (2014). Minimum Levels for Sustainable Nutrition (MLSN) guidelines. PACE Turf.',
                'Carrow, R.N., Waddington, D.V. & Rieke, P.E. (2001). Turfgrass Soil Fertility and Chemical Problems: Assessment and Management. John Wiley & Sons.',
                'Kreuser, W.C. (2015). Sufficiency Level of Available Nutrients (SLAN) guidelines for turfgrass. University of Nebraska-Lincoln.'
            ]},
            { category: 'Tissue Analysis', refs: [
                'Jones, J.B., Wolf, B. & Mills, H.A. (1991). Plant Analysis Handbook. Micro-Macro Publishing.',
                'Turner, T.R. & Hummel, N.W. (1992). Nutritional requirements and fertilisation. In: Waddington et al. (eds) Turfgrass. ASA-CSSA-SSSA.',
                'Christians, N.E., Patton, A.J. & Law, Q.D. (2016). Fundamentals of Turfgrass Management, 5th ed. John Wiley & Sons.'
            ]},
            { category: 'Water Quality', refs: [
                'Ayers, R.S. & Westcot, D.W. (1985). Water Quality for Agriculture. FAO Irrigation and Drainage Paper 29.',
                'Carrow, R.N. & Duncan, R.R. (2012). Best Management Practices for Saline and Sodic Turfgrass Soils. CRC Press.',
                'Harivandi, M.A. (1999). Interpreting Turfgrass Irrigation Water Test Results. University of California ANR Publication 8009.'
            ]},
            { category: 'Growth Potential & Climate', refs: [
                'Kreuser, W.C. & Soldat, D.J. (2011). A growing degree day model to schedule trinexapac-ethyl applications on Agrostis stolonifera golf putting greens. Crop Science 51:2228-2236.',
                'Beard, J.B. (1973). Turfgrass: Science and Culture. Prentice-Hall.'
            ]},
            { category: 'Disease Risk', refs: [
                'Smiley, R.W., Dernoeden, P.H. & Clarke, B.B. (2005). Compendium of Turfgrass Diseases, 3rd ed. APS Press.',
                'Fidanza, M.A. & Dernoeden, P.H. (1996). Brown patch and dollar spot model development. HortScience 31:1006-1009.',
                'Smith, J.D., Jackson, N. & Woolhouse, A.R. (1989). Fungal Diseases of Amenity Turf Grasses. E. & F.N. Spon.'
            ]},
            // b35fix429 (C30): 'Pre-Emergent Herbicide Timing' references entry removed —
            // section pruned from word-export.js.
            { category: 'Variety Traits & Performance', refs: [
                'National Turfgrass Evaluation Program (NTEP). Multi-year variety trial data. ntep.org.',
                'Wu, Y., Taliaferro, C.M. & Martin, D.L. (2011). Bermudagrass shade tolerance research. Oklahoma State University.',
                'Amgain, N.R. et al. (2018). Evapotranspiration rates of bermudagrass cultivars. Crop Science 58:1409-1421.'
            ]},
            { category: 'Salinity & Stress Interactions', refs: [
                'Maas, E.V. & Hoffman, G.J. (1977). Crop salt tolerance - current assessment. J. Irrig. Drain. Div. 103:115-134.',
                'Harivandi, M.A. et al. (1992). Turfgrass salinity tolerance. California Turfgrass Culture 42:1-4.',
                'Carrow, R.N. & Duncan, R.R. (1998). Salt-affected turfgrass sites: Assessment and management. Ann Arbor Press.'
            ]}
        ];
        
        references.forEach(function(refGroup) {
            // Category heading
            sections.push(new Paragraph({
                spacing: { before: 150, after: 60 },
                children: [new TextRun({ text: refGroup.category, bold: true, size: 22, color: '374151' })]
            }));
            
            // Individual references
            refGroup.refs.forEach(function(ref) {
                sections.push(new Paragraph({
                    spacing: { after: 40 },
                    indent: { left: 360 },
                    children: [new TextRun({ text: '• ' + ref, size: 18, color: '6B7280' })]
                }));
            });
        });
        
        sections.push(new Paragraph({ children: [] }));
        
        // Export metadata section (data quality, citations, disclaimer)
        if (data._exportMetadata && typeof GilbaExportMetadata !== 'undefined') {
            // Page break to keep metadata on its own page
            sections.push(new Paragraph({ children: [new PageBreak()] }));
            
            var metadataElements = GilbaExportMetadata.createMetadataSection(data._exportMetadata);
            if (metadataElements && metadataElements.length > 0) {
                metadataElements.forEach(function(el) { sections.push(el); });
            }
            sections.push(new Paragraph({ children: [] }));
        }
        
        // Glossary section
        var glossaryElements = generateGlossary();
        if (glossaryElements && glossaryElements.length > 0) {
            glossaryElements.forEach(function(el) { sections.push(el); });
        }
        
        // Footer note
        sections.push(new Paragraph({ 
            spacing: { before: 400 },
            children: [new TextRun({ 
                text: 'Generated by Gilba Agronomic Intelligence Hub • ' + new Date().toLocaleString(), 
                size: 18, 
                color: '9CA3AF',
                italics: true
            })] 
        }));
        
        return sections;
    }
    
    // Helper to create image paragraph
    // Global image counter for unique IDs
    var imageIdCounter = 0;
    
    function createImageParagraph(chartData, chartType) {
        // Increment counter for unique ID
        imageIdCounter++;
        var uniqueId = imageIdCounter;
        
        // Chart-specific sizing - some charts need more space for readability
        // Disease chart made larger (v2.1.1) for 8-day forecast readability
        // Disease forecast has wide aspect ratio (~3.5:1), needs more width allowance
        // NOTE: A4 page with 1080 twip margins = ~6.5" usable width = ~624px max
        // For taller disease chart, modify the disease-forecast module SVG height
        var chartSizes = {
            irrigation: { maxWidth: 580, maxHeight: 400 },
            disease: { maxWidth: 624, maxHeight: 300 },  // Max practical width for A4
            water: { maxWidth: 560, maxHeight: 380 },
            trajectory: { maxWidth: 580, maxHeight: 400 },
            default: { maxWidth: MAX_CHART_WIDTH || 560, maxHeight: MAX_CHART_HEIGHT || 380 }
        };
        
        var sizes = chartSizes[chartType] || chartSizes.default;
        var maxWidth = sizes.maxWidth;
        var maxHeight = sizes.maxHeight;
        
        // Scale to fit: scale UP to fill width, then constrain by max height
        // Previous logic only scaled down (Math.min(1,...)) which left small SVGs tiny
        var scaleW = maxWidth / chartData.width;
        var scaleH = maxHeight / chartData.height;
        var scale = Math.min(scaleW, scaleH);
        
        var width = Math.round(chartData.width * scale);
        var height = Math.round(chartData.height * scale);
        
        return new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { before: 120, after: 120 },
            children: [new ImageRun({
                type: 'png',
                data: Uint8Array.from(atob(chartData.base64), function(c) { return c.charCodeAt(0); }),
                transformation: { width: width, height: height },
                altText: {
                    title: chartType + ' Chart ' + uniqueId,
                    description: 'GAIP ' + chartType + ' analysis chart',
                    name: 'chart_' + chartType + '_' + uniqueId
                }
            })]
        });
    }
    
    // Capture all charts
    async function captureCharts(data) {
        var charts = {};
        
        // Chart selectors - look for container first, then find SVG inside
        var chartSelectors = {
            irrigation: ['.gaip-irrigation-forecast-chart', '.gaip-irrigation-chart', '.gaip-irrigation-body'],
            disease: ['.gaip-disease-forecast-chart', '.gaip-disease-chart', '.gaip-disease-body'],
            shade: ['.gaip-shade-forecast', '.gaip-shade-chart', '.gaip-shade-body'],
            pgr: ['.gaip-pgr-forecast', '.gaip-pgr-chart', '.gaip-pgr-body'],
            trajectory: ['.gaip-trajectory-chart', '#gaip-trajectory-container', '.gaip-trajectory-module'],
            climate: ['.gaip-climate-chart', '.gaip-gp-chart', '.gaip-climate-body']
        };
        
        // Capture on-screen SVG charts
        for (var key in chartSelectors) {
            var selectors = chartSelectors[key];
            var captured = false;
            
            for (var i = 0; i < selectors.length && !captured; i++) {
                var element = document.querySelector(selectors[i]);
                if (!element) continue;
                
                // Find SVG - either the element itself or inside it
                var svg = element.tagName.toLowerCase() === 'svg' 
                    ? element 
                    : element.querySelector('svg');
                
                if (svg) {
                    var result = await captureSvgElement(svg);
                    if (result && result.base64) {
                        charts[key] = result;
                        captured = true;
                    }
                }
            }
            
            if (!captured) {
            }
        }
        
        // Generate soil/tissue/water charts from data
        if (data) {
            // Soil chart (macros)
            if (data.soil && data.soil.thresholds && (data.soil.P || data.soil.K)) {
                var soilSvg = generateSoilChartSvg(data.soil);
                if (soilSvg) {
                    var soilChart = await svgStringToBase64Png(soilSvg, 500, 200);
                    if (soilChart) {
                        charts.soil = soilChart;
                    }
                }
            }
            // Trace element chart (Fe, Mn, Zn, Cu, B)
            if (data.soil && (data.soil.Fe || data.soil.Mn || data.soil.Zn || data.soil.Cu || data.soil.B)) {
                var traceSvg = generateTraceChartSvg(data.soil);
                if (traceSvg) {
                    // Parse actual height from SVG viewBox to ensure canvas matches exactly
                    var traceHMatch = traceSvg.match(/viewBox="0 0 \d+ (\d+)"/);
                    var traceH = traceHMatch ? parseInt(traceHMatch[1]) : 280;
                    var traceChart = await svgStringToBase64Png(traceSvg, 500, traceH);
                    if (traceChart) {
                        charts.trace = traceChart;
                    }
                }
            } else {
                console.log('[WordExport] No trace data, skipping trace chart. Fe:', data.soil && data.soil.Fe, 'Mn:', data.soil && data.soil.Mn);
            }
            
            // Tissue chart
            if (data.tissue && data.tissue.ranges && (data.tissue.N || data.tissue.K)) {
                var tissueSvg = generateTissueChartSvg(data.tissue);
                if (tissueSvg) {
                    var tissueChart = await svgStringToBase64Png(tissueSvg, 500, 280);
                    if (tissueChart) {
                        charts.tissue = tissueChart;
                    }
                }
            }
            
            // Water chart
            if (data.water && data.water.thresholds && (data.water.EC || data.water.SAR)) {
                var waterSvg = generateWaterChartSvg(data.water);
                if (waterSvg) {
                    var waterChart = await svgStringToBase64Png(waterSvg, 500, 200);
                    if (waterChart) {
                        charts.water = waterChart;
                    }
                }
            }
        }
        
        // Nutrient trend sparklines - generate from GilbaNutrientTrend (soil, tissue, water)
        if (data && data.nutrientTrend && data.nutrientTrend.hasData &&
            window.GilbaNutrientTrend && typeof window.GilbaNutrientTrend.calculateNutrientTrend === 'function') {
            try {
                charts.nutrientTrends = {};
                var sparkTypes = [
                    { type: 'soil',   nutrients: ['K', 'P', 'Ca', 'Mg', 'S', 'Fe', 'Mn'] },
                    { type: 'tissue', nutrients: ['N', 'P', 'K', 'Ca', 'Mg', 'S', 'Fe', 'Mn'] },
                    { type: 'water',  nutrients: ['SAR', 'EC', 'Na', 'Cl', 'HCO3', 'B'] }
                ];
                
                for (var st = 0; st < sparkTypes.length; st++) {
                    var sparkType = sparkTypes[st].type;
                    var sparkNuts = sparkTypes[st].nutrients;
                    var trendIndex = window.GilbaNutrientTrend.buildTemporalIndex(sparkType);
                    var trendKeys = Object.keys(trendIndex);
                    
                    for (var tk = 0; tk < trendKeys.length; tk++) {
                        var group = trendIndex[trendKeys[tk]];
                        if (group.length < 2) continue;
                        
                        if (!charts.nutrientTrends[trendKeys[tk]]) {
                            charts.nutrientTrends[trendKeys[tk]] = {};
                        }
                        
                        for (var tn = 0; tn < sparkNuts.length; tn++) {
                            var trendResult = window.GilbaNutrientTrend.calculateNutrientTrend(group, sparkNuts[tn], sparkType);
                            if (trendResult && trendResult.points && trendResult.points.length >= 2) {
                                var sparkSvg = window.GilbaNutrientTrend.renderTrendChart(trendResult, {
                                    width: 360,
                                    height: 100,
                                    showThreshold: true,
                                    showLabels: true
                                });
                                if (sparkSvg) {
                                    var sparkPng = await svgStringToBase64Png(sparkSvg, 360, 100);
                                    if (sparkPng) {
                                        charts.nutrientTrends[trendKeys[tk]][sparkNuts[tn]] = sparkPng;
                                    }
                                }
                            }
                        }
                        
                        var capturedCount = Object.keys(charts.nutrientTrends[trendKeys[tk]]).length;
                        if (capturedCount > 0) {
                        }
                    }
                }
            } catch (trendChartErr) {
                console.warn('[WordExport] Error capturing trend sparklines:', trendChartErr);
            }
        }

        // Multi-source overlay charts (all sources on one chart per nutrient)
        if (window.GilbaNutrientTrend &&
            typeof window.GilbaNutrientTrend.buildMultiSourceIndex === 'function' &&
            typeof window.GilbaNutrientTrend.renderMultiSourceChart === 'function') {
            try {
                charts.multiSource = {};
                var msoTypes = ['water', 'soil', 'tissue'];
                var msoNutrients = {
                    water:   ['SAR', 'SARadj', 'EC', 'pH', 'Na', 'Cl', 'HCO3', 'B', 'Fe', 'Ca', 'Mg', 'K', 'SO4'],
                    soil:    ['K', 'P', 'Ca', 'Mg', 'S', 'Fe', 'Mn', 'Na', 'pH'],
                    tissue:  ['N', 'P', 'K', 'Ca', 'Mg', 'S', 'Fe', 'Mn']
                };
                for (var mt = 0; mt < msoTypes.length; mt++) {
                    var mType = msoTypes[mt];
                    var mIndex = window.GilbaNutrientTrend.buildMultiSourceIndex(mType);
                    var mKeys = Object.keys(mIndex);
                    if (mKeys.length < 2) continue; // need 2+ sources

                    charts.multiSource[mType] = {};
                    var mNuts = msoNutrients[mType];
                    for (var mn = 0; mn < mNuts.length; mn++) {
                        var mNut = mNuts[mn];
                        // Use export-sized chart: 500x220
                        var mSvg = window.GilbaNutrientTrend.renderMultiSourceChart(
                            mIndex, mNut, mType,
                            ['#2563eb','#dc2626','#16a34a','#d97706','#7c3aed','#0891b2','#db2777','#65a30d','#ea580c','#0284c7'],
                            500, 220, { t: 20, r: 16, b: 36, l: 52 }
                        );
                        if (!mSvg) continue;
                        var mPng = await svgStringToBase64Png(mSvg, 500, 220);
                        if (mPng) charts.multiSource[mType][mNut] = mPng;
                    }
                }
            } catch (msoErr) {
                console.warn('[WordExport] Error capturing multi-source charts:', msoErr);
            }
        }
        
        return charts;
    }
    
    /**
     * Fix duplicate image IDs in docx file
     * Word requires unique IDs for wp:docPr and pic:cNvPr elements
     * docx.js library reuses the same IDs which causes Word to reject the file
     */
    async function fixDuplicateImageIds(blob) {
        // Check if JSZip is available
        if (typeof JSZip === 'undefined') {
            console.warn('[WordExport] JSZip not available, skipping ID fix');
            return blob;
        }
        
        try {
            var zip = new JSZip();
            var zipContents = await zip.loadAsync(blob);
            
            // Get document.xml
            var docXmlFile = zipContents.file('word/document.xml');
            if (!docXmlFile) {
                console.warn('[WordExport] document.xml not found in zip');
                return blob;
            }
            
            var docXml = await docXmlFile.async('string');
            
            // Count how many docPr elements exist
            var docPrMatches = docXml.match(/<wp:docPr\s+id="[^"]*"/g) || [];
            var imageCount = docPrMatches.length;
            
            // Only fix if there are multiple images (duplicate IDs are only a problem with >1 image)
            if (imageCount <= 1) {
                return blob;
            }
            
            // Fix duplicate wp:docPr ids
            var docPrId = 1;
            docXml = docXml.replace(/<wp:docPr\s+id="[^"]*"/g, function() {
                return '<wp:docPr id="' + (docPrId++) + '"';
            });
            
            // Fix duplicate pic:cNvPr ids  
            var cNvPrId = 1;
            docXml = docXml.replace(/<pic:cNvPr\s+id="[^"]*"/g, function() {
                return '<pic:cNvPr id="' + (cNvPrId++) + '"';
            });
            
            
            // Create a new zip preserving original structure
            var newZip = new JSZip();
            
            // Copy all files preserving their properties
            var files = Object.keys(zipContents.files);
            for (var i = 0; i < files.length; i++) {
                var filename = files[i];
                var file = zipContents.files[filename];
                
                if (file.dir) {
                    // Directory entry
                    newZip.folder(filename);
                } else if (filename === 'word/document.xml') {
                    // Use our modified document.xml
                    newZip.file(filename, docXml);
                } else {
                    // Copy file as-is (binary)
                    var content = await file.async('uint8array');
                    newZip.file(filename, content);
                }
            }
            
            // Generate with same settings docx.js uses
            var fixedBlob = await newZip.generateAsync({
                type: 'blob',
                mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
            });
            
            return fixedBlob;
        } catch (err) {
            console.error('[WordExport] Error in fixDuplicateImageIds:', err);
            return blob; // Return original on error
        }
    }
    
    // Generate and download Word document
    async function exportToWord() {
        
        // Reset image ID counter for each export
        imageIdCounter = 0;
        
        // Show loading indicator
        var loadingDiv = document.createElement('div');
        loadingDiv.id = 'word-export-loading';
        loadingDiv.style.cssText = 'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);background:var(--gaip-surface);padding:20px 40px;border-radius:8px;box-shadow:0 4px 20px rgba(0,0,0,0.3);z-index:10000;font-family:Arial;';
        loadingDiv.innerHTML = '📝 Generating Word document...<br><small>Capturing charts...</small>';
        document.body.appendChild(loadingDiv);
        
        try {
            
            // Collect data - use GAIP_WordExport.collectData() to allow patch interception
            var data = GAIP_WordExport.collectData();
            
            // Capture charts (pass data for generating soil/tissue/water charts)
            var charts = await captureCharts(data);
            
            // Build sections with charts - use GAIP_WordExport.buildSections() to allow patch interception
            var sections = GAIP_WordExport.buildSections(data, charts);
            
            var doc = new Document({
                features: { updateFields: true },
                styles: {
                default: { document: { run: { font: 'Calibri', size: 22 } } },
                paragraphStyles: [
                    { id: 'Title', name: 'Title', basedOn: 'Normal',
                      run: { size: 48, bold: true, color: '1F2937', font: 'Calibri' },
                      paragraph: { spacing: { before: 0, after: 60 }, alignment: AlignmentType.CENTER } },
                    { id: 'Heading1', name: 'Heading 1', basedOn: 'Normal', next: 'Normal', quickFormat: true,
                      run: { size: 28, bold: true, color: '1F2937', font: 'Calibri' },
                      paragraph: { spacing: { before: 300, after: 120 }, outlineLevel: 0 } },
                    { id: 'Heading2', name: 'Heading 2', basedOn: 'Normal', next: 'Normal', quickFormat: true,
                      run: { size: 24, bold: true, color: '374151', font: 'Calibri' },
                      paragraph: { spacing: { before: 200, after: 100 }, outlineLevel: 1 } }
                ]
            },
            sections: [{
                properties: {
                    page: {
                        // Explicit A4 portrait size. Without this, Word on mobile
                        // does not know the intended page dimensions and squeezes
                        // all table columns to near-zero width.
                        size: { width: 11906, height: 16838, orientation: PageOrientation.PORTRAIT },
                        margin: { top: 1080, right: 1080, bottom: 1080, left: 1080 }
                    }
                },
                headers: {
                    default: new Header({ children: [new Paragraph({
                        alignment: AlignmentType.RIGHT,
                        children: [new TextRun({ text: 'GAIP Analysis Report', size: 18, color: '9CA3AF' })]
                    })] })
                },
                footers: {
                    default: new Footer({ children: [new Paragraph({ 
                        alignment: AlignmentType.CENTER,
                        children: [
                            new TextRun({ text: 'Page ', size: 18, color: '9CA3AF' }), 
                            new TextRun({ children: [PageNumber.CURRENT], size: 18, color: '9CA3AF' }), 
                            new TextRun({ text: ' of ', size: 18, color: '9CA3AF' }), 
                            new TextRun({ children: [PageNumber.TOTAL_PAGES], size: 18, color: '9CA3AF' })
                        ]
                    })] })
                },
                children: sections
            }]
        });
        
        // Generate and download
        Packer.toBlob(doc).then(async function(blob) {
            var filename = 'GAIP_Report_' + new Date().toISOString().split('T')[0] + '.docx';
            
            // Post-process to fix duplicate image IDs (Word requirement)
            // docx.js generates all images with id="1" which Word may reject with multiple images
            try {
                var fixedBlob = await fixDuplicateImageIds(blob);
                blob = fixedBlob;
            } catch (fixErr) {
                console.warn('[WordExport] Could not fix image IDs:', fixErr);
                // Continue with original blob
            }
            
            // Create download link
            var url = URL.createObjectURL(blob);
            var a = document.createElement('a');
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            
            
            // Remove loading indicator
            var loading = document.getElementById('word-export-loading');
            if (loading) loading.remove();
            
        }).catch(function(err) {
            console.error('[WordExport] Error generating document:', err);
            var loading = document.getElementById('word-export-loading');
            if (loading) loading.remove();
            alert('Error generating Word document: ' + err.message);
        });
        
        } catch (err) {
            console.error('[WordExport] Export failed:', err);
            var loading = document.getElementById('word-export-loading');
            if (loading) loading.remove();
            alert('Error generating Word document: ' + err.message);
        }
    }
    
    // ============================================
    // ============================================
    // LOGO MANAGEMENT — server-backed dropdown
    // ============================================

    var LOGO_STORAGE_KEY = 'gaip_report_logos';
    var LOGO_SELECTED_KEY = 'gaip_selected_logo_id';
    var ORG_NAME_STORAGE_KEY = 'gaip_org_name';

    // In-memory cache: array of {id, name, base64, width, height, type}
    var _logoCache = [];
    // Currently active logo object (null = none)
    var _selectedLogo = null;

    function _readStoredLogos() {
        try {
            var raw = localStorage.getItem(LOGO_STORAGE_KEY);
            var parsed = raw ? JSON.parse(raw) : [];
            return Array.isArray(parsed) ? parsed : [];
        } catch (_err) {
            return [];
        }
    }

    function _writeStoredLogos(logos) {
        try {
            localStorage.setItem(LOGO_STORAGE_KEY, JSON.stringify(logos || []));
        } catch (_err) {
            // Ignore quota/storage failures; export can still proceed without a logo.
        }
    }

    function _buildLogoId() {
        return 'logo_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
    }

    function _populateDropdown(logos, selectedId) {
        var sel = document.getElementById('gaip-logo-select');
        var delBtn = document.getElementById('gaip-logo-delete-btn');
        var status = document.getElementById('gaip-logo-status');
        if (!sel) return;

        // Rebuild options
        sel.innerHTML = '<option value="">, None,</option>';
        logos.forEach(function(logo) {
            var opt = document.createElement('option');
            opt.value = logo.id;
            opt.textContent = logo.name;
            if (logo.id === selectedId) opt.selected = true;
            sel.appendChild(opt);
        });

        // Resolve selected logo object
        var currentId = sel.value;
        _selectedLogo = logos.find(function(l) { return l.id === currentId; }) || null;

        if (delBtn) delBtn.style.display = (currentId && currentId !== '') ? 'inline-block' : 'none';
        if (status) status.textContent = _selectedLogo ? ('✓ ' + _selectedLogo.name) : '';
    }

    function _loadLogos() {
        _logoCache = _readStoredLogos();

        var savedId = localStorage.getItem(LOGO_SELECTED_KEY) || '';
        var ids = _logoCache.map(function(l) { return l.id; });
        if (savedId && ids.indexOf(savedId) === -1) savedId = '';
        if (!savedId && _logoCache.length) savedId = _logoCache[0].id;

        _populateDropdown(_logoCache, savedId);
    }

    function initLogoUpload() {
        var uploadInput = document.getElementById('gaip-logo-upload');
        var addBtn      = document.getElementById('gaip-logo-add-btn');
        var delBtn      = document.getElementById('gaip-logo-delete-btn');
        var sel         = document.getElementById('gaip-logo-select');
        var status      = document.getElementById('gaip-logo-status');
        var exportBtn   = document.getElementById('gaip-export-word');
        var orgInput    = document.getElementById('gaip-org-name');

        if (exportBtn) {
            exportBtn.addEventListener('click', function() { exportToWord(); });
        }

        if (orgInput) {
            orgInput.value = localStorage.getItem(ORG_NAME_STORAGE_KEY) || '';
            orgInput.addEventListener('input', function() {
                localStorage.setItem(ORG_NAME_STORAGE_KEY, orgInput.value || '');
            });
        }

        // Add button triggers hidden file input
        if (addBtn && uploadInput) {
            addBtn.addEventListener('click', function() { uploadInput.click(); });
        }

        // File chosen — upload to server
        if (uploadInput) {
            uploadInput.addEventListener('change', function(e) {
                var file = e.target.files[0];
                if (!file) return;
                if (!file.type.match(/image\/(png|jpeg|gif|webp)/)) {
                    if (status) status.textContent = '❌ Use PNG, JPG, GIF or WebP';
                    return;
                }
                if (file.size > 500 * 1024) {
                    if (status) status.textContent = '❌ Max 500KB';
                    return;
                }
                if (status) status.textContent = 'Uploading…';

                var reader = new FileReader();
                reader.onload = function(ev) {
                    var base64 = ev.target.result;
                    var img = new Image();
                    img.onload = function() {
                        var name = file.name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ');
                        var logo = {
                            id: _buildLogoId(),
                            name:   name,
                            base64: base64,
                            width:  img.width,
                            height: img.height,
                            type:   file.type
                        };

                        uploadInput.value = '';
                        _logoCache.push(logo);
                        _writeStoredLogos(_logoCache);
                        localStorage.setItem(LOGO_SELECTED_KEY, logo.id);
                        _populateDropdown(_logoCache, logo.id);
                    };
                    img.src = base64;
                };
                reader.readAsDataURL(file);
            });
        }

        // Dropdown change — save selection to localStorage (no round-trip needed)
        if (sel) {
            sel.addEventListener('change', function() {
                var id = sel.value;
                _selectedLogo = _logoCache.find(function(l) { return l.id === id; }) || null;
                localStorage.setItem(LOGO_SELECTED_KEY, id || '');
                if (delBtn) delBtn.style.display = (id && id !== '') ? 'inline-block' : 'none';
                if (status) status.textContent = _selectedLogo ? ('✓ ' + _selectedLogo.name) : '';
            });
        }

        // Delete selected logo
        if (delBtn) {
            delBtn.addEventListener('click', function() {
                var id = sel ? sel.value : '';
                if (!id) return;
                var logo = _logoCache.find(function(l) { return l.id === id; });
                if (!confirm('Delete logo "' + (logo ? logo.name : id) + '"?')) return;
                _logoCache = _logoCache.filter(function(l) { return l.id !== id; });
                _writeStoredLogos(_logoCache);
                localStorage.removeItem(LOGO_SELECTED_KEY);
                _selectedLogo = null;
                _populateDropdown(_logoCache, '');
            });
        }

        // Load logos from server
        _loadLogos();
    }

    function getStoredLogo() {
        return _selectedLogo || null;
    }

    function getOrgName() {
        var input = document.getElementById('gaip-org-name');
        return input ? input.value.trim() : (localStorage.getItem(ORG_NAME_STORAGE_KEY) || '');
    }

    // Expose logo functions
    global.GAIP_getReportLogo = getStoredLogo;
    global.GAIP_getOrgName = getOrgName;

    // Init on DOM ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initLogoUpload);
    } else {
        initLogoUpload();
    }
    
    // Export to global
    global.GAIP_WordExport = {
        version: '2.3.0',
        export: exportToWord,
        collectData: collectData,
        buildSections: buildSections,  // Exposed for scenario patch integration

        // b35fix322: expose pure decision/conversion helpers so combined-export
        // can compute amendment products per-sample (during the loop iteration
        // where the correct site is active) and merge them into
        // r.data.nutritionProgram.annualSummary.products. Without this exposure,
        // amendments only appeared in the per-sample Annual Soil Amendments
        // narrative and were invisible to Annual Product Summary, Monthly
        // Schedule, and Purchasing Summary.
        _computeAmendmentDecision: _computeAmendmentDecision,
        _amendmentDecisionsToProducts: _amendmentDecisionsToProducts,
        _synthesiseKReconDecision: _synthesiseKReconDecision,
        _computeProgrammeKDelivered: _computeProgrammeKDelivered,
        _classifyKReconState: _classifyKReconState,

        // b35fix400: region-aware K display label helpers. Exposed so
        // live-preview integrations (Prebbles, AU, UK) can render the same
        // labels the export will produce. Math is region-invariant; only
        // the display string varies (AU/NZ elemental "0-0-41.5" vs UK/EU
        // oxide "0-0-50 (as K₂O)").
        _potassiumDisplayLabel: _potassiumDisplayLabel,
        _detectKDisplayRegion: _detectKDisplayRegion,

        // b35fix328: nutrient-extraction helpers exposed so word-export-combined
        // can render the same Ca/Mg/S column logic in the Fertiliser Purchasing
        // Summary aggregator. Single-export and combined-export must produce
        // tables with the same active-column set when given the same product
        // mix — that symmetry is the renderer-level corollary of the
        // amendment-as-product contract.
        _extractEntryNutrients: _extractEntryNutrients,
        _detectActiveNutrientColumns: _detectActiveNutrientColumns,

        // b35fix368: per-sample section header line. Pure helper that takes a
        // collectData()-shaped object and returns "Site · area · species".
        // Combined export calls this once per per-sample section to render
        // a consistent at-a-glance identity line. Reads species from
        // engineInputs.turf.species (b35fix367 authoritative source) so the
        // header reflects the per-sample override when one is set.
        _buildSectionHeaderLine: _buildSectionHeaderLine,

        // b35fix387: SSOT renderer for the Monthly N Distribution table.
        // Used by both single-export (word-export.js) and combined-export
        // (word-export-combined.js) to produce a uniform 12-column docx
        // table with header row, colour-graded N values, GP% subscript, and
        // optional site-uniform caption (combined-export only). Returns an
        // array of docx nodes; caller pushes them onto its sections list.
        // See helper definition for opts contract.
        _buildMonthlyNDistribution: _buildMonthlyNDistribution,

        // b35fix423 (C29): expose Annual Soil Amendments table builder for
        // regression testing of the dual-rate column structure (Theoretical /
        // Practical kg/ha). Renderer is pure given soilData + nutritionProgram
        // + surfaceType + context; safe to call from a node test harness.
        _buildAnnualSoilAmendmentsTable: buildAnnualSoilAmendmentsTable,

        // b35fix448 (C25): expose Performance Impact Analysis narrative
        // generator for regression testing of the module-presence gating
        // upgrade. Pure given the collectData()-shaped data object; returns
        // either null (no impacts) or { narrative, relationships,
        // recommendations }. Safe to call from a node test harness without
        // DOM or browser globals beyond the test scaffolding stubs.
        _generatePerformanceImpactAnalysis: generatePerformanceImpactAnalysis
    };

    // Expose internal functions for combined export module
    global.GAIP_WordExport_captureCharts = captureCharts;
    global.GAIP_WordExport_fixDuplicateImageIds = fixDuplicateImageIds;
    
    
})(window);
