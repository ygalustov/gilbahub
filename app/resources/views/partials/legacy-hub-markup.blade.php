<div id="gaip-hub">
        <div style="margin-bottom: 8px;">
            <a href="/dashboard" style="
                display: inline-block;
                padding: 6px 14px;
                border: 1px solid #2c5f2d;
                border-radius: 6px;
                background: #2c5f2d;
                color: white;
                font-size: 13px;
                font-weight: 600;
                text-decoration: none;
            ">New Hub →</a>
        </div>
        <h2>Gilba Agronomic Intelligence Hub</h2>

        <!-- Decision State Machine — b35fix219 -->
        <!-- Scaffold injected by gaip-decision-ui.js on DOMContentLoaded -->
        <!-- Renders above hub grid; re-renders on gaip:orchestrator-complete -->
        <div id="gaip-decision-panel"></div>

        <!-- Evidence View — b35fix229 -->
        <!-- Soil / Water / Tissue / Spray log with chain-of-confidence callouts -->
        <div id="gaip-evidence-panel"></div>

        <div class="gaip-grid">

            <!-- ═══════════════════════════════════════════════════════════════════ -->
            <!-- SITE SELECTOR - Choose which site to work with -->
            <!-- ═══════════════════════════════════════════════════════════════════ -->
            <div id="gaip-site-selector-top" style="
                background: #f8f9fa;
                border: 1px solid #dee2e6;
                border-radius: 8px;
                padding: 12px 16px;
                margin-bottom: 16px;
                display: flex;
                align-items: center;
                gap: 10px;
                flex-wrap: wrap;
            ">
                <span style="font-weight: 600; color: #2c5f2d; font-size: 14px;">🏌️ Site:</span>
                <select id="gaip-site-select-top" style="
                    flex: 1;
                    min-width: 200px;
                    max-width: 400px;
                    padding: 8px 12px;
                    border: 1px solid #ced4da;
                    border-radius: 6px;
                    font-size: 14px;
                    background: white;
                ">
                    <option value="default">Loading sites...</option>
                </select>
                <button type="button" id="gaip-site-add-top" title="Add new site" style="
                    padding: 6px 12px; border: 1px solid #ced4da; border-radius: 6px;
                    background: white; cursor: pointer; font-size: 16px;
                ">+</button>
                <button type="button" id="gaip-site-rename-top" title="Rename site" style="
                    padding: 6px 12px; border: 1px solid #ced4da; border-radius: 6px;
                    background: white; cursor: pointer; font-size: 14px;
                ">✎</button>
                <button type="button" id="gaip-site-save-top" title="Save current site configuration" style="
                    padding: 6px 12px; border: 1px solid #28a745; border-radius: 6px;
                    background: #28a745; color: white; cursor: pointer; font-size: 13px; font-weight: 600;
                ">💾 Save Site</button>
                <button type="button" id="gaip-site-delete-top" title="Delete site" style="
                    padding: 6px 12px; border: 1px solid #dc3545; border-radius: 6px;
                    background: white; color: #dc3545; cursor: pointer; font-size: 14px;
                    display: none;
                ">✕</button>
                <span id="gaip-site-status-top" style="font-size: 12px; color: #666;"></span>
            </div>

            <!-- ═══════════════════════════════════════════════════════════════════ -->
            <!-- TURF PROFILE - Foundational Context (must be first) -->
            <!-- Everything cascades from this selection -->
            <!-- ═══════════════════════════════════════════════════════════════════ -->
            <section class="gaip-card gaip-turf-profile-card">
                <div class="gaip-card-header">
                    <h3>Turf Profile <span class="gaip-profile-badge">Sets All Downstream Context</span></h3>
                    <span class="gaip-card-toggle">▼</span>
                </div>
                <div class="gaip-card-body">
                    
                    <!-- Turf Type Selection - Big Buttons -->
                    <div class="gaip-turf-type-grid">
                        <div class="gaip-turf-type-option" data-type="sports">
                            <h4>Sports Field</h4>
                            <p>Soccer, AFL, Rugby</p>
                        </div>
                        <div class="gaip-turf-type-option" data-type="golf">
                            <h4>Golf</h4>
                            <p>Greens, Fairways, Tees</p>
                        </div>
                        <div class="gaip-turf-type-option" data-type="lawns">
                            <h4>Lawns</h4>
                            <p>Residential</p>
                        </div>
                    </div>
                    
                    <!-- Golf Sub-category -->
                    <div class="gaip-subcategory-section" id="gaip-golf-subcategory" style="display: none;">
                        <label>Surface Type</label>
                        <div class="gaip-subcategory-grid">
                            <div class="gaip-subcategory-option" data-surface="greens">Greens</div>
                            <div class="gaip-subcategory-option" data-surface="fairways">Fairways</div>
                            <div class="gaip-subcategory-option" data-surface="tees">Tees</div>
                            <div class="gaip-subcategory-option" data-surface="surrounds">Surrounds</div>
                        </div>
                    </div>
                    
                    <!-- Sports Sub-category -->
                    <div class="gaip-subcategory-section" id="gaip-sports-subcategory" style="display: none;">
                        <label>Sport</label>
                        <div class="gaip-subcategory-grid">
                            <div class="gaip-subcategory-option" data-sport="soccer">Soccer</div>
                            <div class="gaip-subcategory-option" data-sport="afl">AFL</div>
                            <div class="gaip-subcategory-option" data-sport="rugby_union">Rugby Union</div>
                            <div class="gaip-subcategory-option" data-sport="rugby_league">Rugby League</div>
                        </div>
                    </div>
                    
                    <!-- Species & Variety -->
                    <div class="gaip-form-row-grid">
                        <div>
                            <label>Species</label>
                            <select class="gaip-species" id="gaip-species-select">
                                <!-- Populated dynamically by turf-profile-controller.js -->
                                <option value="">Select turf type first</option>
                            </select>
                        </div>
                        <div>
                            <label>Variety</label>
                            <select class="gaip-variety" id="gaip-variety-select">
                                <option value="generic">Generic / Unknown</option>
                            </select>
                        </div>
                    </div>
                    
                    <!-- Construction & Drainage -->
                    <div class="gaip-form-row-grid">
                        <div>
                            <label>Construction</label>
                            <select class="gaip-construction">
                                <option value="sand_carpet">Sand carpet</option>
                                <option value="sand_profile">Sand profile (USGA-style)</option>
                                <option value="pipe_drained">Pipe drained + slit drained</option>
                                <option value="soil">Soil field</option>
                                <option value="hybrid">Hybrid reinforced</option>
                            </select>
                        </div>
                        <div>
                            <label>Drainage</label>
                            <select class="gaip-drainage">
                                <option value="excellent">Excellent (&gt;150 mm/hr)</option>
                                <option value="good">Good (100-150 mm/hr)</option>
                                <option value="moderate">Moderate (50-100 mm/hr)</option>
                                <option value="poor">Poor (&lt;50 mm/hr)</option>
                            </select>
                        </div>
                    </div>
                    
                    <!-- HOC & N Program -->
                    <div class="gaip-form-row-grid">
                        <div>
                            <label>Height of Cut (mm)</label>
                            <input type="number" class="gaip-hoc" value="25" step="0.5" min="1" max="100">
                        </div>
                        <div>
                            <label>N Program (kg/ha/yr)</label>
                            <input type="number" class="gaip-n-program" value="200" step="10" min="0" max="500">
                        </div>
                    </div>
                    
                    <!-- Overseed Section (C4 only - controlled by JS) -->
                    <div class="gaip-overseed-section" style="display: none; margin-top: 15px; padding: 12px; background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 6px;">
                        <div style="font-weight: 600; color: #166534; margin-bottom: 10px;">Winter Overseed Program</div>
                        
                        <label>Overseed Species</label>
                        <select class="gaip-cool-overseed">
                            <option value="">None / No overseed</option>
                            <option value="Perennial Ryegrass">Perennial Ryegrass</option>
                        </select>
                        
                        <label>Overseed Variety</label>
                        <select class="gaip-overseed-variety">
                            <option value="generic">Generic / Unknown</option>
                            <option value="RPR">RPR (Regenerating)</option>
                            <option value="Slugger 3GL">Slugger 3GL</option>
                            <option value="Derby Xtreme">Derby Xtreme</option>
                            <option value="SR 4700">SR 4700</option>
                            <option value="Karma">Karma</option>
                            <option value="Barolympic">Barolympic</option>
                            <option value="Barorlando">Barorlando</option>
                            <option value="Pinnacle 3">Pinnacle 3</option>
                            <option value="Premier 3">Premier 3</option>
                            <option value="Intense">Intense</option>
                            <option value="Grand Slam GLS">Grand Slam GLS</option>
                            <option value="APS">APS</option>
                        </select>
                        
                        <label>Summer Management Intent</label>
                        <select class="gaip-overseed-summer-intent">
                            <option value="transition">Transition — let ryegrass fade, support couch recovery</option>
                            <option value="maintain">Maintain — keep ryegrass through summer (poor couch base)</option>
                        </select>
                        <small style="color:#666; font-size:10px;">Choose 'Maintain' if underlying couch coverage is poor and surface needs ryegrass for playability</small>
                        
                        <div class="gaip-note" style="margin-top: 8px; font-size: 11px; color: #166534;">
                            Overseed active during winter months (May-Sep in Australia).
                        </div>
                    </div>
                    
                    <!-- Site History (for disease risk calculation) -->
                    <div class="gaip-site-history-section" style="margin-top: 15px; padding: 12px; background: #fef3c7; border: 1px solid #fcd34d; border-radius: 6px;">
                        <div style="font-weight: 600; color: #92400e; margin-bottom: 10px;">Site History <span style="font-weight: normal; font-size: 11px;">(for disease risk)</span></div>
                        
                        <div class="gaip-form-row-grid" style="grid-template-columns: 1fr 1fr 1fr; gap: 12px;">
                            <div>
                                <label>Years Established</label>
                                <input type="number" class="gaip-years-established" placeholder="e.g. 5" step="1" min="0" max="50">
                                <small style="color:#666; font-size:10px;">SDS peak risk: 3-7 years</small>
                            </div>
                            <div>
                                <label>Thatch Depth (mm)</label>
                                <input type="number" class="gaip-thatch-depth" placeholder="e.g. 12" step="1" min="0" max="50">
                                <small style="color:#666; font-size:10px;">Target: &lt;12mm</small>
                            </div>
                            <div>
                                <label>Winter Min Temp (°C)</label>
                                <input type="number" class="gaip-winter-min-temp" placeholder="e.g. -2" step="0.5" min="-20" max="15">
                                <small style="color:#666; font-size:10px;">Coldest last winter</small>
                            </div>
                        </div>
                    </div>
                    
                    <!-- Profile Save/Load -->
                    <div class="gaip-profile-controls">
                        <select id="gaip-profile-select">
                            <option value="">-- Saved Profiles --</option>
                        </select>
                        <button type="button" id="gaip-save-profile" class="gaip-save-btn">Save Profile</button>
                        <button type="button" id="gaip-delete-profile" class="gaip-delete-btn">Delete</button>
                    </div>
                    
                    <!-- Profile Summary -->
                    <div class="gaip-profile-summary" id="gaip-profile-summary"></div>
                    
                </div>
            </section>

            <section class="gaip-card">
                <div class="gaip-card-header">
                    <h3>Site &amp; Climate</h3>
                    <span class="gaip-card-toggle">▼</span>
                </div>
                <div class="gaip-card-body">
                    <label>Location (for live weather)</label>
                    <div style="position: relative;">
                        <input type="text" 
                               id="gaip-location-search" 
                               placeholder="Search suburb, city, or stadium..." 
                               autocomplete="off"
                               value="{{ $savedLocation['name'] }}"
                               style="width: 100%; padding: 8px 10px; border: 1px solid #ccc; border-radius: 4px;">
                        <div id="gaip-location-results" style="
                            position: absolute;
                            top: 100%;
                            left: 0;
                            right: 0;
                            background: white;
                            border: 1px solid #ddd;
                            border-radius: 4px;
                            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
                            z-index: 1000;
                            max-height: 250px;
                            overflow-y: auto;
                            display: none;
                        "></div>
                    </div>
                    <div id="gaip-location-status" style="font-size: 11px; margin-top: 4px; color: #666;"></div>
                    
                    <div class="gaip-form-row-grid" style="margin-top: 10px;">
                        <div>
                            <label>Latitude</label>
                            <input type="number" step="0.0001" class="gaip-lat" value="{{ $savedLocation['lat'] }}">
                        </div>
                        <div>
                            <label>Longitude</label>
                            <input type="number" step="0.0001" class="gaip-lon" value="{{ $savedLocation['lon'] }}">
                        </div>
                    </div>

                    <!-- Map picker: click or drag to set exact location -->
                    <div id="gaip-location-map" style="
                        width: 100%; 
                        height: 220px; 
                        margin-top: 10px; 
                        border-radius: 6px; 
                        border: 1px solid #ccc;
                        background: #eee;
                        cursor: crosshair;
                    "></div>
                    <div style="display:flex;align-items:center;justify-content:space-between;margin-top:4px;">
                        <div style="font-size:11px;color:#888;">Click map or drag pin to set exact location</div>
                        <button id="gaip-map-scroll-lock" type="button" onclick="(function(){
                            var m = window.GAIP_LocationMap;
                            if (!m) return;
                            var locked = !m.scrollWheelZoom.enabled();
                            if (locked) { m.scrollWheelZoom.disable(); document.getElementById('gaip-map-scroll-lock').textContent = '🔓 Unlock scroll zoom'; }
                            else        { m.scrollWheelZoom.enable();  document.getElementById('gaip-map-scroll-lock').textContent = '🔒 Lock scroll zoom'; }
                        })()" style="font-size:11px;padding:3px 8px;border:1px solid #d1d5db;border-radius:4px;background:white;cursor:pointer;color:#6b7280;">🔓 Unlock scroll zoom</button>
                    </div>

                    <label>Hemisphere</label>
                    <select class="gaip-hemi">
                        <option value="southern" selected>Southern</option>
                        <option value="northern">Northern</option>
                    </select>
                    
                    <div class="gaip-form-row-grid" style="margin-top: 10px;">
                        <div>
                            <label>Analysis start date</label>
                            <input type="date" class="gaip-start-date">
                        </div>
                        <div>
                            <label>Analysis end date</label>
                            <input type="date" class="gaip-end-date">
                        </div>
                    </div>
                    <p style="font-size: 11px; color: #666; margin-top: 4px;">Leave blank for 7-day forecast from today. Max 14 days ahead for live weather.</p>

                    <label>Elevation (m)</label>
                    <input type="number" class="gaip-elev" value="50">

                    <label class="gaip-module-toggle" style="margin-top: 10px; display: flex; align-items: center; gap: 8px;">
                        <input type="checkbox" class="gaip-use-live-weather" checked>
                        <span>Use live weather data (Open-Meteo)</span>
                    </label>
                    
                    <div style="margin-top: 8px; display: flex; align-items: center; gap: 10px;">
                        <button type="button" id="gaip-refresh-weather" onclick="if(window.GAIP_WeatherResilience){GAIP_WeatherResilience.clearCache();this.textContent='✓ Cache cleared - run analysis';this.style.background='#dcfce7';}" style="padding: 6px 12px; font-size: 12px; background: #f3f4f6; border: 1px solid #d1d5db; border-radius: 6px; cursor: pointer;">
                            🔄 Refresh Weather Cache
                        </button>
                        <span id="gaip-weather-status-inline" style="font-size: 11px; color: #6b7280;"></span>
                    </div>

                    <div class="gaip-manual-weather" style="display:none; margin-top:10px; padding: 10px; background: #f5f5f5; border-radius: 6px;">
                        <p style="font-size: 11px; color: #666; margin: 0 0 10px 0;">Enter weather conditions for growth potential and stress calculations.</p>
                        
                        <div class="gaip-form-row-grid">
                            <div>
                                <label>Min air temp (°C)</label>
                                <input type="number" step="0.1" class="gaip-manual-tmin" value="12" placeholder="e.g. 12">
                            </div>
                            <div>
                                <label>Max air temp (°C)</label>
                                <input type="number" step="0.1" class="gaip-manual-tmax" value="24" placeholder="e.g. 24">
                            </div>
                        </div>

                        <div class="gaip-form-row-grid" style="margin-top: 10px;">
                            <div>
                                <label>Humidity (%)</label>
                                <input type="number" step="1" class="gaip-manual-humidity" value="65" min="0" max="100">
                            </div>
                            <div>
                                <label>Rainfall (mm/week)</label>
                                <input type="number" step="0.1" class="gaip-manual-rain" value="0" min="0">
                            </div>
                        </div>

                        <div class="gaip-form-row-grid" style="margin-top: 10px;">
                            <div>
                                <label>Soil temp @ 10cm (°C)</label>
                                <input type="number" step="0.1" class="gaip-manual-soil-temp" value="" placeholder="auto">
                            </div>
                            <div>
                                <label>ET₀ (mm/day) <span style="font-weight: normal; color: #999;">(optional)</span></label>
                                <input type="number" step="0.1" class="gaip-manual-eto" value="" placeholder="e.g. 4.5">
                            </div>
                        </div>
                    </div>
                    
                    <div style="margin-top: 15px; padding-top: 15px; border-top: 1px solid #e0e0e0;">
                        <label>Monthly N Rate (kg/ha) <span style="font-weight: normal; color: #666; font-size: 11px;">— for N program validation</span></label>
                        <input type="number" step="1" class="gaip-monthly-n-rate" value="" placeholder="e.g. 25" min="0" max="100">
                        <p style="font-size: 11px; color: #666; margin-top: 4px;">Enter your current monthly nitrogen application rate to compare against growth-limited uptake capacity.</p>
                    </div>
                </div>
            </section>

            <!-- =====================================================
                 SOIL DATA CARD (redesigned v2)
                 ===================================================== -->
            <section class="gaip-card gaip-soil-card">
                <div class="gaip-card-header">
                    <h3>Soil Test Data</h3>
                    <div class="gaip-header-controls">
                        <label class="gaip-module-toggle">
                            <input type="checkbox" class="gaip-enable-soil-water" checked>
                            <span>Enable Analysis</span>
                        </label>
                        <span class="gaip-card-toggle">▼</span>
                    </div>
                </div>
                <div class="gaip-card-body">

                    <!-- Context indicator -->
                    <div class="gaip-context-indicator" data-section="mlsn">
                        Select turf type above to set interpretation thresholds
                    </div>

                    <!-- ── SAMPLE MANAGEMENT BAR (injected by sample-switcher-ui.js) ── -->
                    <!-- Switcher mounts here via data-switcher-target="soil" -->
                    <div class="gaip-soil-switcher-mount"></div>

                    <!-- ── IMPORT STRIP ── -->
                    <div class="gaip-import-strip">
                        <button type="button" class="gaip-import-btn gaip-import-primary" id="gaip-soil-pdf-import-btn">
                            <span class="gaip-import-icon">📄</span>
                            <span>Import from PDF / CSV</span>
                        </button>
                        <span class="gaip-import-or">or enter manually below</span>
                    </div>

                    <!-- ── SAMPLE IDENTITY ── -->
                    <div class="gaip-field-group">
                        <div class="gaip-field-group-title">Sample identity</div>
                        <div class="gaip-field-row-3">
                            <div class="gaip-field">
                                <label>Sample name</label>
                                <input type="text" class="gaip-soil-sample-label" placeholder="e.g. Green 1, Fairway 7">
                            </div>
                            <div class="gaip-field">
                                <label>Lab reference</label>
                                <input type="text" class="gaip-soil-lab-ref" placeholder="e.g. ARL-24-1234">
                            </div>
                            <div class="gaip-field">
                                <label>Collection date</label>
                                <input type="date" class="gaip-soil-date">
                            </div>
                        </div>
                    </div>

                    <!-- ── METHODOLOGY ── -->
                    <div class="gaip-field-group">
                        <div class="gaip-field-group-title">Interpretation method</div>
                        <select class="gaip-soil-methodology">
                            <option value="slan">SLAN — Sufficiency Level of Available Nutrients</option>
                            <option value="mlsn">MLSN — Minimum Levels for Sustainable Nutrition</option>
                        </select>
                        <div class="gaip-method-notes" style="color:#666; font-size: 12px; margin-top: 6px; line-height: 1.5;">
                            <span class="gaip-method-note-slan"><strong>SLAN:</strong> Traditional sufficiency-range approach — widely used across all turf types</span>
                            <span class="gaip-method-note-mlsn" style="display:none;"><strong>MLSN:</strong> Threshold-based approach — validated primarily on golf putting greens</span>
                            <span class="gaip-method-note-aa gaip-aa-method-note" style="display:none;"><strong>Ammonium Acetate:</strong> Hill Labs NZ method (Olsen P + NH₄OAc)</span>
                        </div>
                        <div class="gaip-aa-soil-texture-container" style="display: none; margin-top: 8px;"></div>
                        <div class="gaip-soil-method-warning" style="display: none; margin-top: 8px;"></div>
                    </div>

                    <!-- ── NUTRIENTS ── -->
                    <div class="gaip-field-group">
                        <div class="gaip-field-group-title">
                            <span class="gaip-soil-method-label">Soil test values (ppm)</span>
                            <span class="gaip-soil-method-note" style="font-weight:normal; color:#888; font-size:11px; margin-left:6px;">Mehlich 3 (Olsen for P)</span>
                        </div>
                        <div class="gaip-nutrient-grid gaip-soil-grid">
                            <div class="gaip-nutrient-cell"><span class="gaip-nutrient-symbol">K</span><input type="number" step="1" data-mlsn="K" placeholder="ppm"></div>
                            <div class="gaip-nutrient-cell"><span class="gaip-nutrient-symbol">P</span><input type="number" step="1" data-mlsn="P" placeholder="ppm"></div>
                            <div class="gaip-nutrient-cell"><span class="gaip-nutrient-symbol">Ca</span><input type="number" step="1" data-mlsn="Ca" placeholder="ppm"></div>
                            <div class="gaip-nutrient-cell"><span class="gaip-nutrient-symbol">Mg</span><input type="number" step="1" data-mlsn="Mg" placeholder="ppm"></div>
                            <div class="gaip-nutrient-cell"><span class="gaip-nutrient-symbol">S</span><input type="number" step="1" data-mlsn="S" placeholder="ppm"></div>
                            <div class="gaip-nutrient-cell"><span class="gaip-nutrient-symbol">Fe</span><input type="number" step="0.1" data-mlsn="Fe" placeholder="ppm"></div>
                            <div class="gaip-nutrient-cell"><span class="gaip-nutrient-symbol">Mn</span><input type="number" step="0.1" data-mlsn="Mn" placeholder="ppm"></div>
                            <div class="gaip-nutrient-cell"><span class="gaip-nutrient-symbol">Cu</span><input type="number" step="0.01" data-mlsn="Cu" placeholder="ppm"></div>
                            <div class="gaip-nutrient-cell"><span class="gaip-nutrient-symbol">Zn</span><input type="number" step="0.01" data-mlsn="Zn" placeholder="ppm"></div>
                            <div class="gaip-nutrient-cell"><span class="gaip-nutrient-symbol">B</span><input type="number" step="0.01" data-mlsn="B" title="Boron — hot water or Mehlich 3 extractable" placeholder="ppm"></div>
                            <div class="gaip-nutrient-cell gaip-nutrient-cell--secondary" title="Sodium — for ESP/sodicity, not an MLSN target"><span class="gaip-nutrient-symbol">Na</span><input type="number" step="1" data-mlsn="Na" placeholder="ppm"></div>
                        </div>
                        <small style="color:#aaa; font-size:11px; margin-top:4px; display:block;">Na: sodicity assessment only, not an MLSN target</small>
                    </div>

                    <!-- ── PHYSICAL PROPERTIES ── -->
                    <div class="gaip-field-group">
                        <div class="gaip-field-group-title">Physical properties</div>
                        <div class="gaip-field-row-3">
                            <div class="gaip-field">
                                <label>Soil pH</label>
                                <input type="number" step="0.1" class="gaip-soil-ph" placeholder="e.g. 6.2">
                            </div>
                            <div class="gaip-field">
                                <label>CEC (cmol/kg)</label>
                                <input type="number" step="0.1" class="gaip-cec" placeholder="e.g. 8.5">
                            </div>
                            <div class="gaip-field">
                                <label>EC<sub>1:5</sub> (dS/m)</label>
                                <input type="number" step="0.01" class="gaip-soil-ec" placeholder="e.g. 0.15">
                            </div>
                        </div>
                        <div class="gaip-field-row-2" style="margin-top:8px;">
                            @php
                                // GH-269: initial value now reflects the site's real
                                // soil_texture_override/account.soil_texture (passed in
                                // by hub.blade.php / stadium.blade.php) instead of a
                                // static "Loam" default with no live data behind it.
                                // Unrecognised/unset values fall back to Loam, same as
                                // the previous static default.
                                $__validTextures = ['sand', 'loamy_sand', 'sandy_loam', 'loam', 'clay_loam', 'clay'];
                                $__soilTexture = in_array($soilTexture ?? null, $__validTextures, true) ? $soilTexture : 'loam';
                            @endphp
                            <div class="gaip-field">
                                <label>Soil texture</label>
                                <select class="gaip-soil-texture">
                                    <option value="sand" @selected($__soilTexture === 'sand')>Sand / Sand rootzone</option>
                                    <option value="loamy_sand" @selected($__soilTexture === 'loamy_sand')>Loamy Sand</option>
                                    <option value="sandy_loam" @selected($__soilTexture === 'sandy_loam')>Sandy Loam</option>
                                    <option value="loam" @selected($__soilTexture === 'loam')>Loam</option>
                                    <option value="clay_loam" @selected($__soilTexture === 'clay_loam')>Clay Loam</option>
                                    <option value="clay" @selected($__soilTexture === 'clay')>Clay</option>
                                </select>
                            </div>
                            <div class="gaip-field">
                                <label>Sampling depth</label>
                                <select class="gaip-sampling-depth">
                                    <option value="">Not specified</option>
                                    <option value="0-2">0–2 cm (surface)</option>
                                    <option value="2-4">2–4 cm (shallow rootzone)</option>
                                    <option value="4-6">4–6 cm (rootzone)</option>
                                    <option value="0-10">0–10 cm (standard)</option>
                                </select>
                            </div>
                        </div>
                        <div class="gaip-field" style="margin-top:8px;">
                            <label>Organic Matter / LOI (%)</label>
                            <input type="number" step="0.1" class="gaip-loi" placeholder="e.g. 2.5" min="0" max="30">
                        </div>
                    </div>

                    <!-- ── STRATIFIED OM (golf greens — shown/hidden by JS) ── -->
                    <div class="gaip-stratified-om-section gaip-collapsible-section" style="display: none;">
                        <div class="gaip-collapsible-header" data-target="gaip-strat-om-body">
                            <span>⛳ Stratified OM Analysis <small style="font-weight:normal; color:#888;">(Golf Greens)</small></span>
                            <span class="gaip-collapsible-toggle">▶</span>
                        </div>
                        <div class="gaip-collapsible-body" id="gaip-strat-om-body" style="display:none;">
                            <small style="color:#666; display:block; margin-bottom:8px;">LOI % at each depth — detects layering issues</small>
                            <div class="gaip-nutrient-grid" style="grid-template-columns: repeat(3, 1fr);">
                                <div class="gaip-nutrient-cell"><span class="gaip-nutrient-symbol" style="font-size:10px;">0–2cm</span><input type="number" step="0.1" class="gaip-loi-0-2" placeholder="%" min="0" max="30"></div>
                                <div class="gaip-nutrient-cell"><span class="gaip-nutrient-symbol" style="font-size:10px;">2–4cm</span><input type="number" step="0.1" class="gaip-loi-2-4" placeholder="%" min="0" max="30"></div>
                                <div class="gaip-nutrient-cell"><span class="gaip-nutrient-symbol" style="font-size:10px;">4–6cm</span><input type="number" step="0.1" class="gaip-loi-4-6" placeholder="%" min="0" max="30"></div>
                            </div>
                            <small style="color:#888; margin-top:6px; display:block;">USGA spec: 2–4% optimal. Stratification = thatch/layering risk.</small>
                        </div>
                    </div>

                </div>
            </section>

            <!-- =====================================================
                 WATER QUALITY CARD (redesigned v2)
                 ===================================================== -->
            <section class="gaip-card gaip-water-card">
                <div class="gaip-card-header">
                    <h3>Water Quality</h3>
                    <div class="gaip-header-controls">
                        <span class="gaip-card-toggle">▼</span>
                    </div>
                </div>
                <div class="gaip-card-body">

                    <!-- ── SAMPLE MANAGEMENT BAR (injected by sample-switcher-ui.js) ── -->
                    <div class="gaip-water-switcher-mount"></div>

                    <!-- ── IMPORT STRIP ── -->
                    <div class="gaip-import-strip">
                        <button type="button" class="gaip-import-btn gaip-import-primary" id="gaip-water-pdf-import-btn">
                            <span class="gaip-import-icon">📄</span>
                            <span>Import from PDF / CSV</span>
                        </button>
                        <span class="gaip-import-or">or enter manually below</span>
                    </div>

                    <!-- ── SAMPLE IDENTITY ── -->
                    <div class="gaip-field-group">
                        <div class="gaip-field-group-title">Sample identity</div>
                        <div class="gaip-field-row-3">
                            <div class="gaip-field">
                                <label>Water source</label>
                                <input type="text" class="gaip-water-source-label" placeholder="e.g. Bore, Dam, Recycled">
                            </div>
                            <div class="gaip-field">
                                <label>Lab reference</label>
                                <input type="text" class="gaip-water-lab-ref" placeholder="e.g. ARL-24-5678">
                            </div>
                            <div class="gaip-field">
                                <label>Collection date</label>
                                <input type="date" class="gaip-water-date">
                            </div>
                        </div>
                    </div>

                    <!-- ── RECYCLED WATER TOGGLE ── -->
                    <div class="gaip-field-group gaip-recycled-water-toggle-group">
                        <label class="gaip-recycled-water-label">
                            <input type="checkbox" class="gaip-recycled-water-flag" id="gaip-recycled-water-flag">
                            <span>Recycled / reclaimed water</span>
                        </label>
                        <p class="gaip-recycled-water-hint">Enables salt-driven nutrient interaction advisory (N-form, micronutrient suppression, cation ratio disturbance)</p>
                    </div>

                    <!-- ── KEY PARAMETERS ── -->
                    <div class="gaip-field-group">
                        <div class="gaip-field-group-title">Key parameters</div>
                        <div class="gaip-field-row-2">
                            <div class="gaip-field">
                                <label>EC<sub>w</sub> (dS/m)</label>
                                <input type="number" step="0.01" class="gaip-ecw" placeholder="Electrical conductivity">
                            </div>
                            <div class="gaip-field">
                                <label>pH</label>
                                <input type="number" step="0.1" class="gaip-water-ph" placeholder="e.g. 7.5">
                            </div>
                        </div>
                    </div>

                    <!-- ── ION COMPOSITION ── -->
                    <div class="gaip-field-group">
                        <div class="gaip-field-group-title">Ion composition (mg/L)</div>
                        <div class="gaip-nutrient-grid gaip-water-grid">
                            <div class="gaip-nutrient-cell"><span class="gaip-nutrient-symbol">Ca</span><input type="number" step="0.1" data-ion="Ca" placeholder="mg/L"></div>
                            <div class="gaip-nutrient-cell"><span class="gaip-nutrient-symbol">Mg</span><input type="number" step="0.1" data-ion="Mg" placeholder="mg/L"></div>
                            <div class="gaip-nutrient-cell"><span class="gaip-nutrient-symbol">Na</span><input type="number" step="0.1" data-ion="Na" placeholder="mg/L"></div>
                            <div class="gaip-nutrient-cell"><span class="gaip-nutrient-symbol">K</span><input type="number" step="0.1" data-ion="K" placeholder="mg/L"></div>
                            <div class="gaip-nutrient-cell"><span class="gaip-nutrient-symbol">Cl</span><input type="number" step="0.1" data-ion="Cl" placeholder="mg/L"></div>
                            <div class="gaip-nutrient-cell"><span class="gaip-nutrient-symbol">SO₄</span><input type="number" step="0.1" data-ion="SO4" placeholder="mg/L"></div>
                            <div class="gaip-nutrient-cell"><span class="gaip-nutrient-symbol">HCO₃</span><input type="number" step="0.1" data-ion="HCO3" placeholder="mg/L"></div>
                            <div class="gaip-nutrient-cell"><span class="gaip-nutrient-symbol">CO₃</span><input type="number" step="0.1" data-ion="CO3" placeholder="mg/L"></div>
                            <div class="gaip-nutrient-cell"><span class="gaip-nutrient-symbol">B</span><input type="number" step="0.1" data-ion="B" placeholder="mg/L"></div>
                            <div class="gaip-nutrient-cell"><span class="gaip-nutrient-symbol">Fe</span><input type="number" step="0.01" data-ion="Fe" placeholder="mg/L"></div>
                            <div class="gaip-nutrient-cell"><span class="gaip-nutrient-symbol">Mn</span><input type="number" step="0.01" data-ion="Mn" placeholder="mg/L"></div>
                            <div class="gaip-nutrient-cell"><span class="gaip-nutrient-symbol">NO₃</span><input type="number" step="0.1" data-ion="NO3" placeholder="mg/L"></div>
                            <div class="gaip-nutrient-cell"><span class="gaip-nutrient-symbol" title="Phosphorus as reported by lab">P</span><input type="number" step="0.1" data-ion="PO4" placeholder="mg/L"></div>
                        </div>
                    </div>

                    <!-- ── IRRIGATION SYSTEM (collapsed by default) ── -->
                    <div class="gaip-collapsible-section">
                        <div class="gaip-collapsible-header" data-target="gaip-irr-system-body">
                            <span>Irrigation system <small style="font-weight:normal; color:#888;">(optional)</small></span>
                            <span class="gaip-collapsible-toggle">▶</span>
                        </div>
                        <div class="gaip-collapsible-body" id="gaip-irr-system-body" style="display:none;">
                            <div class="gaip-field-row-2">
                                <div class="gaip-field">
                                    <label>Irrigation method</label>
                                    <select class="gaip-irr-method">
                                        <option value="">Not specified</option>
                                        <option value="sprinkler">Sprinkler / Overhead</option>
                                        <option value="drip">Drip / Sub-surface</option>
                                        <option value="mixed">Mixed system</option>
                                    </select>
                                    <small>Affects foliar phytotoxicity risk</small>
                                </div>
                                <div class="gaip-field">
                                    <label>System efficiency (%)</label>
                                    <input type="number" class="gaip-irr-efficiency" value="75" min="40" max="95">
                                    <small>Sprinklers 70–80%, Drip 85–95%</small>
                                </div>
                            </div>
                            <div class="gaip-field-row-2" style="margin-top:8px;">
                                <div class="gaip-field">
                                    <label>Effective rainfall (%)</label>
                                    <input type="number" class="gaip-irr-rain-eff" value="80" min="0" max="100">
                                    <small>Fraction infiltrating (not runoff)</small>
                                </div>
                                <div class="gaip-field">
                                    <label>Cost per kL ($/kL)</label>
                                    <input type="number" class="gaip-irr-cost" value="3.00" step="0.10" min="0">
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- ── SOIL WATER STATUS (collapsed by default) ── -->
                    <div class="gaip-collapsible-section">
                        <div class="gaip-collapsible-header" data-target="gaip-soil-water-body">
                            <span>Soil water status <small style="font-weight:normal; color:#888;">(optional)</small></span>
                            <span class="gaip-collapsible-toggle">▶</span>
                        </div>
                        <div class="gaip-collapsible-body" id="gaip-soil-water-body" style="display:none;">
                            <div class="gaip-field-row-2">
                                <div class="gaip-field">
                                    <label>Days since last irrigation</label>
                                    <input type="number" class="gaip-days-since-irrigation" value="1" min="0" max="30" step="1">
                                    <small>0 = irrigated today</small>
                                </div>
                                <div class="gaip-field">
                                    <label>Soil moisture (%VWC) <span class="gaip-tooltip" title="Volumetric water content from TDR/capacitance probe. Leave blank to estimate from days since irrigation.">ⓘ</span></label>
                                    <input type="number" class="gaip-soil-vwc" placeholder="e.g. 18" min="0" max="60" step="1">
                                    <small>Optional — from sensor reading</small>
                                </div>
                            </div>
                            <div class="gaip-field" style="margin-top:8px;">
                                <label>Effective root depth (mm)</label>
                                <input type="number" class="gaip-root-depth" value="100" min="25" max="300" step="5">
                                <small>Greens: 75–100mm · Fairways: 100–150mm · Sports: 100–200mm</small>
                            </div>
                        </div>
                    </div>

                    <!-- ── SENSOR IMPORT (collapsed by default) ── -->
                    <div class="gaip-collapsible-section">
                        <div class="gaip-collapsible-header" data-target="gaip-sensor-import-body">
                            <span>📡 Sensor data import <small style="font-weight:normal; color:#888;">(TDR 350 / compatible)</small></span>
                            <span class="gaip-collapsible-toggle">▶</span>
                        </div>
                        <div class="gaip-collapsible-body" id="gaip-sensor-import-body" style="display:none;">
                            <div id="gaip-sensor-upload-area" class="gaip-sensor-upload">
                                <div class="gaip-sensor-upload-icon">📁</div>
                                <div class="gaip-sensor-upload-text">Drop CSV file here or click to browse</div>
                                <div class="gaip-sensor-upload-hint">Supports TDR 350/300 exports and compatible formats</div>
                                <input type="file" id="gaip-sensor-file" accept=".csv" style="display: none;">
                            </div>
                            <div id="gaip-sensor-result"></div>
                            <div id="gaip-sensor-summary-container"></div>
                        </div>
                    </div>

                </div>
            </section>

            <section class="gaip-card" style="grid-column: 1 / -1;">
                <div class="gaip-card-header">
                    <h3>Tissue Testing</h3>
                    <div class="gaip-header-controls">
                        <label class="gaip-module-toggle">
                            <input type="checkbox" class="gaip-enable-tissue" checked>
                            <span>Enable Analysis</span>
                        </label>
                        <span class="gaip-card-toggle">▼</span>
                    </div>
                </div>
                <div class="gaip-card-body">
                    <!-- Context indicator - set by Turf Profile -->
                    <div class="gaip-context-indicator" data-section="tissue">
                        Select turf type above to set tissue interpretation ranges
                    </div>
                    <div id="gaipTissueModule" class="gaip-tissue-module"></div>
                </div>
            </section>

            <section class="gaip-card" style="grid-column: 1 / -1;">
                <div class="gaip-card-header">
                    <h3>PGR &amp; Light Conditions</h3>
                    <div class="gaip-header-controls">
                        <label class="gaip-module-toggle">
                            <input type="checkbox" class="gaip-enable-turf-system" checked>
                            <span>Enable Analysis</span>
                        </label>
                        <span class="gaip-card-toggle">▼</span>
                    </div>
                </div>
                <div class="gaip-card-body">
                    <!-- Context indicator - set by Turf Profile -->
                    <div class="gaip-context-indicator" data-section="shade">
                        Select turf type above to set DLI thresholds
                    </div>

                    <!-- Poa annua Contamination Section (Golf Greens only) -->
                    <div class="gaip-poa-section" style="margin-top: 0; margin-bottom: 15px; padding: 12px; background: #fef3c7; border: 1px solid #fcd34d; border-radius: 6px; display: none;">
                        <div style="font-weight: 600; color: #92400e; margin-bottom: 10px;">Poa annua Population</div>
                        
                        <label>Poa annua %</label>
                        <input type="number" class="gaip-poa-percent" value="0" min="0" max="100" step="5">
                        
                        <div class="gaip-note" style="margin-top: 8px; font-size: 11px; color: #92400e;">
                            Poa contamination affects disease risk (Anthracnose, Pythium) and irrigation 
                            requirements (shallow roots need more frequent watering).
                        </div>
                    </div>

                    <label>% C3 cover (transition periods)</label>
                    <input type="number" class="gaip-c3-cover" value="0">
                    <small style="color:#666;">For warm-season turf with cool-season overseed during transition</small>
                    
                    <!-- PGR application inputs -->
                    <div style="margin-top:14px;padding:12px;background:#f5f3ff;border:1px solid #ddd6fe;border-radius:8px;">
                        <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px;">
                            <label class="gaip-module-toggle" style="margin:0">
                                <input type="checkbox" class="gaip-enable-pgr">
                                <span style="font-weight:600;color:#6d28d9">PGR Application</span>
                            </label>
                        </div>
                        <div class="gaip-pgr-inputs" style="display:none">
                            <label style="font-size:12px;color:#4b5563">Product</label>
                            <select class="gaip-pgr-product" style="width:100%;margin-bottom:8px;padding:5px 8px;border:1px solid #d1d5db;border-radius:4px;font-size:13px">
                                <option value="">-- Select product --</option>
                                <optgroup label="Trinexapac-ethyl">
                                    <option value="TE250">TE 250g/L (Primo)</option>
                                    <option value="TE175">TE 175g/L (Amigo 175 / Marvel 175)</option>
                                    <option value="TE120">TE 120g/L (Amigo 120 / Primo Maxx 120)</option>
                                </optgroup>
                                <optgroup label="Paclobutrazol">
                                    <option value="PBZ200">Paclobutrazol 200g/L</option>
                                    <option value="PBZ250">Paclobutrazol 250g/L</option>
                                </optgroup>
                                <optgroup label="Ethephon">
                                    <option value="ETH">Ethephon 480g/L</option>
                                </optgroup>
                            </select>
                            <label style="font-size:12px;color:#4b5563">Last application date</label>
                            <input type="date" class="gaip-pgr-date" style="width:100%;margin-bottom:8px;padding:5px 8px;border:1px solid #d1d5db;border-radius:4px;font-size:13px">
                            <label style="font-size:12px;color:#4b5563">Rate (L/ha)</label>
                            <input type="number" step="0.1" class="gaip-pgr-rate" placeholder="e.g. 0.4" style="width:100%;padding:5px 8px;border:1px solid #d1d5db;border-radius:4px;font-size:13px">
                        </div>
                    </div>
                    <script>
                    (function(){
                        var cb = document.querySelector('.gaip-enable-pgr');
                        var inputs = document.querySelector('.gaip-pgr-inputs');
                        if (!cb || !inputs) return;
                        cb.addEventListener('change', function(){ inputs.style.display = cb.checked ? 'block' : 'none'; });
                        if (cb.checked) inputs.style.display = 'block';
                    })();
                    </script>


                    <div class="gaip-note" style="margin-top:12px; padding-top:8px; border-top:1px solid #ddd;">
                        <strong>Optional surface hardness (Clegg hammer):</strong>
                    </div>
                    <label>Clegg value - Mean (Gmax)</label>
                    <input type="number" step="1" class="gaip-clegg-hammer" placeholder="e.g. 75 (leave blank to estimate)">
                    
                    <div class="gaip-clegg-range-fields" style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-top: 8px;">
                        <div>
                            <label style="font-size: 12px;">Hardest zone (Gmax)</label>
                            <input type="number" step="1" class="gaip-clegg-max" placeholder="e.g. goalmouth">
                        </div>
                        <div>
                            <label style="font-size: 12px;">Softest zone (Gmax)</label>
                            <input type="number" step="1" class="gaip-clegg-min" placeholder="e.g. wing area">
                        </div>
                    </div>
                    <div class="gaip-note" style="font-size:11px; color:#666; margin-top:4px;">
                        Standard 2.25kg Clegg @ 450mm. Typical: 60-90 Gmax. &lt;60=soft, 60-90=ideal, &gt;100=too hard.<br>
                        <em>For sports fields: record readings from goalmouth (hardest) and wing (softest) to assess uniformity.</em>
                    </div>

                    <label>Daily light integral (mol/m²/day)</label>
                    <input type="number" step="0.5" class="gaip-dli" placeholder="Leave blank for API calculation">
                    
                    <div class="gaip-note" style="margin-top:8px;">
                        <strong>Optional LED supplementation data:</strong>
                    </div>
                    <label>LED PPFD (µmol/m²/s)</label>
                    <input type="number" step="10" class="gaip-led-ppfd" placeholder="e.g. 800, 1000, 1200">
                    
                    <label>LED hours per day</label>
                    <input type="number" step="0.5" class="gaip-led-hours" placeholder="e.g. 8">

                    <div class="gaip-note" style="margin-top:8px;">
                        <strong>Optional shade/obstruction data:</strong>
                        <label class="gaip-module-toggle" style="display:inline-block; margin-left:15px;">
                            <input type="checkbox" class="gaip-enable-shade" checked>
                            <span>Enable Shade Analysis</span>
                        </label>
                    </div>
                    <label>Sky View Factor (0–1)
                        <span class="gaip-tooltip" title="Fraction of sky visible from turf surface. 1.0 = open field, 0.5 = half sky blocked. Stand at centre and estimate % of hemisphere that is open sky.">ⓘ</span>
                    </label>
                    <input type="number" step="0.01" class="gaip-svf-input" value="1" min="0" max="1">

                    <label>Facade obstruction angle (°)
                        <span class="gaip-tooltip" title="Angle from horizontal to top of nearest building/stand. 0° = no obstruction, 45° = building as tall as it is distant, 90° = vertical wall adjacent. Calculate: angle = arctan(height ÷ distance)">ⓘ</span>
                    </label>
                    <input type="number" step="1" class="gaip-facade-angle" value="0" min="0" max="90">

                    <label>Tree / structural occlusion (%)
                        <span class="gaip-tooltip" title="Percentage of remaining direct sunlight blocked by trees, mesh, or structures. 0% = no trees, 50% = moderate canopy, 80%+ = dense shade.">ⓘ</span>
                    </label>
                    <input type="number" step="1" class="gaip-tree-occlusion" value="0" min="0" max="100">
                </div>
            </section>

            <!-- ═══════════════════════════════════════════════════════════════════ -->
            <!-- TRAFFIC & WEAR INPUTS - Enhanced v1.1 (Baker/Gibbs/Adams STRI) -->
            <!-- Only visible for Sports Field turf type -->
            <!-- ═══════════════════════════════════════════════════════════════════ -->
            <section class="gaip-card" data-card="traffic" style="display: none;">
                <div class="gaip-card-header">
                    <h3>Traffic &amp; Wear</h3>
                    <div class="gaip-header-controls">
                        <label class="gaip-module-toggle">
                            <input type="checkbox" class="gaip-enable-turf-traffic" checked>
                            <span>Enable Analysis</span>
                        </label>
                        <span class="gaip-card-toggle">▼</span>
                    </div>
                </div>
                <div class="gaip-card-body">
                    <!-- Context indicator - set by Turf Profile -->
                    <div class="gaip-context-indicator" data-section="wear">
                        Wear recovery engine active for sports fields
                    </div>
                    
                    <!-- Current Soil Moisture -->
                    <div class="gaip-form-row">
                        <label>Current Soil Moisture</label>
                        <select class="gaip-soil-moisture">
                            <option value="dry">Dry</option>
                            <option value="slightly_dry">Slightly Dry</option>
                            <option value="optimal" selected>Optimal</option>
                            <option value="moist">Moist</option>
                            <option value="wet">Wet</option>
                            <option value="saturated">Saturated</option>
                        </select>
                    </div>

                    <!-- Match Schedule -->
                    <div style="margin-top: 16px; padding-top: 12px; border-top: 1px solid #e0e0e0;">
                        <strong style="color: #2c5f2d;">Match Schedule</strong>
                    </div>
                    
                    <div class="gaip-form-row-grid">
                        <div>
                            <label>Sport</label>
                            <select class="gaip-match-sport">
                                <option value="soccer">Soccer</option>
                                <option value="afl">AFL</option>
                                <option value="rugby_union">Rugby Union</option>
                                <option value="rugby_league">Rugby League</option>
                            </select>
                        </div>
                        <div>
                            <label>Matches/Week</label>
                            <input type="number" class="gaip-matches-week" value="2" min="0" max="14" step="1">
                        </div>
                    </div>
                    
                    <div class="gaip-form-row-grid">
                        <div>
                            <label>Match Duration (hrs)</label>
                            <input type="number" class="gaip-match-duration" value="1.5" min="0.5" max="3" step="0.5">
                        </div>
                        <div>
                            <label>Player Age Group</label>
                            <select class="gaip-age-group">
                                <option value="junior">Junior (U12)</option>
                                <option value="youth">Youth (12-17)</option>
                                <option value="adult" selected>Adult (18-35)</option>
                                <option value="masters">Masters (35+)</option>
                            </select>
                        </div>
                    </div>
                    
                    <div class="gaip-form-row">
                        <label>Typical Squad Size</label>
                        <select class="gaip-team-size">
                            <option value="small">Small (&lt;15 players)</option>
                            <option value="medium" selected>Medium (15-30 players)</option>
                            <option value="large">Large (30+ players)</option>
                        </select>
                    </div>

                    <!-- Training Schedule -->
                    <div style="margin-top: 16px; padding-top: 12px; border-top: 1px solid #e0e0e0;">
                        <strong style="color: #2c5f2d;">Training Schedule</strong>
                    </div>
                    
                    <div class="gaip-form-row-grid">
                        <div>
                            <label>Training Type</label>
                            <select class="gaip-training-type">
                                <option value="training_full">Full Training (match sim)</option>
                                <option value="training_drills" selected>Skills & Drills</option>
                                <option value="training_light">Light Training</option>
                            </select>
                        </div>
                        <div>
                            <label>Sessions/Week</label>
                            <input type="number" class="gaip-sessions-week" value="3" min="0" max="14" step="1">
                        </div>
                    </div>
                    
                    <div class="gaip-form-row-grid">
                        <div>
                            <label>Session Duration (hrs)</label>
                            <input type="number" class="gaip-session-duration" value="1.5" min="0.5" max="3" step="0.5">
                        </div>
                        <div>
                            <label>Training Area Used (%)</label>
                            <input type="number" class="gaip-training-rotation" value="100" min="10" max="100" step="5"
                                   title="100% = full pitch used with rotation. 50% = half pitch, concentrated wear on same areas.">
                        </div>
                    </div>
                    
                    <div class="gaip-form-row">
                        <label>Rest Days per Week</label>
                        <input type="number" class="gaip-rest-days" value="2" min="0" max="7" step="1">
                    </div>

                    <!-- Cumulative Stress History -->
                    <div style="margin-top: 16px; padding-top: 12px; border-top: 1px solid #e0e0e0;">
                        <strong style="color: #2c5f2d;">Prior Usage History</strong>
                        <span style="font-size: 11px; color: #666; display: block; margin-top: 4px;">
                            Enter training + match hours from recent weeks to calculate cumulative wear
                        </span>
                    </div>
                    
                    <div class="gaip-form-row-grid gaip-prior-weeks">
                        <div>
                            <label>Last week (hrs)</label>
                            <input type="number" class="gaip-prior-week-1" value="" min="0" max="50" step="0.5" placeholder="—">
                        </div>
                        <div>
                            <label>2 weeks ago (hrs)</label>
                            <input type="number" class="gaip-prior-week-2" value="" min="0" max="50" step="0.5" placeholder="—">
                        </div>
                    </div>
                    <div class="gaip-form-row-grid gaip-prior-weeks">
                        <div>
                            <label>3 weeks ago (hrs)</label>
                            <input type="number" class="gaip-prior-week-3" value="" min="0" max="50" step="0.5" placeholder="—">
                        </div>
                        <div>
                            <label>4 weeks ago (hrs)</label>
                            <input type="number" class="gaip-prior-week-4" value="" min="0" max="50" step="0.5" placeholder="—">
                        </div>
                    </div>

                    <!-- Turf Condition Factors -->
                    <div style="margin-top: 16px; padding-top: 12px; border-top: 1px solid #e0e0e0;">
                        <strong style="color: #2c5f2d;">Turf Condition Factors</strong>
                    </div>
                    
                    <div class="gaip-form-row-grid">
                        <div>
                            <label>Est. Root Depth (mm)</label>
                            <input type="number" class="gaip-root-depth" value="100" min="10" max="300" step="10">
                        </div>
                        <div>
                            <label>Overseed Status</label>
                            <select class="gaip-overseed-status">
                                <option value="none" selected>None / Pure Stand</option>
                                <option value="pre_seed">Pre-seed (planning)</option>
                                <option value="germinating">Germinating (0-2 weeks)</option>
                                <option value="establishing">Establishing (2-4 weeks)</option>
                                <option value="immature">Immature (4-8 weeks)</option>
                                <option value="maturing">Maturing (8-12 weeks)</option>
                                <option value="mature">Mature (12+ weeks)</option>
                                <option value="transitioning">Transitioning (spring)</option>
                                <option value="fading">Fading</option>
                                <option value="dead">Dead (warm-season only)</option>
                            </select>
                        </div>
                    </div>
                    
                </div>
            </section>

        </div>

        <button type="button" class="gaip-run-btn">Run Integrated Analysis</button>
        
        <!-- Export Controls -->
        <div class="gaip-export-controls" style="margin-top: 12px; display: flex; gap: 12px; align-items: center; flex-wrap: wrap;">
            <button type="button" id="gaip-export-word" class="gaip-export-btn" style="background: #2563eb; color: white; border: none; padding: 10px 20px; border-radius: 6px; cursor: pointer; font-weight: 500; display: flex; align-items: center; gap: 8px;">
                📄 Export to Word
            </button>
            
            <button type="button" id="gaip-whatif-btn" onclick="GilbaScenarioUI.showWhatIfPanel()" style="background: #7c3aed; color: white; border: none; padding: 10px 20px; border-radius: 6px; cursor: pointer; font-weight: 500; display: flex; align-items: center; gap: 8px;">
                ⚡ What-If Analysis
            </button>
            
            <div class="gaip-logo-upload" style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
                <label style="font-size: 13px; color: #4b5563;">Report Logo:</label>
                <select id="gaip-logo-select" style="font-size: 13px; padding: 4px 8px; border: 1px solid #d1d5db; border-radius: 4px; max-width: 180px;">
                    <option value="">— None —</option>
                </select>
                <button type="button" id="gaip-logo-add-btn" style="font-size: 12px; padding: 4px 10px; background: #2563eb; color: white; border: none; border-radius: 4px; cursor: pointer;">+ Add</button>
                <button type="button" id="gaip-logo-delete-btn" style="font-size: 12px; padding: 4px 10px; background: #dc2626; color: white; border: none; border-radius: 4px; cursor: pointer; display: none;">Delete</button>
                <input type="file" id="gaip-logo-upload" accept="image/png,image/jpeg,image/gif" style="display: none;">
                <span id="gaip-logo-status" style="font-size: 12px; color: #6b7280;"></span>
            </div>
            
            <div style="display: flex; align-items: center; gap: 6px;">
                <label for="gaip-org-name" style="font-size: 13px; color: #4b5563;">Organisation:</label>
                <input type="text" id="gaip-org-name" placeholder="Your organisation name" style="padding: 6px 10px; border: 1px solid #d1d5db; border-radius: 4px; font-size: 13px; width: 180px;">
            </div>
        </div>
        
        <div class="gaip-status" style="margin: 10px 0; padding: 10px; display: none; border-radius: 4px;"></div>

        <div class="gaip-results" style="display:none;">
            <h3>Integrated Interpretation</h3>
            
            <!-- Climate Status Summary Banner -->
            <div id="gaip-climate-status-banner" class="gaip-climate-banner" style="display:none; margin: 10px 0 20px; padding: 12px 16px; background: linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%); border-radius: 8px; border-left: 4px solid #0ea5e9;">
                <div style="display: flex; align-items: center; gap: 12px;">
                    <span id="gaip-climate-icon" style="font-size: 24px;">🌤️</span>
                    <div>
                        <div style="font-weight: 600; color: #0c4a6e; font-size: 14px;">Climate Conditions</div>
                        <div id="gaip-climate-summary" style="color: #0369a1; font-size: 13px;">Loading...</div>
                    </div>
                </div>
            </div>

            <!-- ═══════════════════════════════════════════ -->
            <!-- AGRONOMIC FOUNDATIONS -->
            <!-- ═══════════════════════════════════════════ -->
            <div style="margin: 20px 0 10px; padding: 8px 0; border-bottom: 2px solid #3b82f6;">
                <h3 style="margin: 0; color: #1e40af; font-size: 15px; font-weight: 600;">
                    AGRONOMIC FOUNDATIONS
                </h3>
            </div>

            <div class="gaip-result-block" data-section="mlsn">
                <h4 class="gaip-soil-result-title">Soil nutrient sufficiency</h4>
                <div class="gaip-result-body gaip-mlsn-body"></div>
            </div>

            <div class="gaip-result-block" data-section="nutrient-demand">
                <h4>N-linked nutrient demand</h4>
                <div class="gaip-result-body gaip-nutrient-demand-body"></div>
            </div>

            <div class="gaip-result-block" data-section="tissue">
                <h4>Tissue nutrient interpretation</h4>
                <div class="gaip-result-body gaip-tissue-body"></div>
            </div>

            <div class="gaip-result-block" data-section="water">
                <h4>Irrigation water quality → comprehensive analysis</h4>
                <div class="gaip-result-body gaip-water-body"></div>
            </div>
            
            <!-- ═══════════════════════════════════════════ -->
            <!-- NUTRITION PROGRAM -->
            <!-- GP-weighted calendar + product recommendations -->
            <!-- ═══════════════════════════════════════════ -->
            <div style="margin: 20px 0 10px; padding: 8px 0; border-bottom: 2px solid #16a34a;">
                <h3 style="margin: 0; color: #15803d; font-size: 15px; font-weight: 600;">
                    NUTRITION PROGRAM
                </h3>
            </div>
            
            <div class="gaip-result-block" data-section="nutrition-program">
                <h4>Annual nutrition calendar</h4>
                <div class="gaip-result-body gaip-nutrition-program-body">
                    <!-- Nutrition Calendar Module Container -->
                    <div data-nutrition-calendar-module class="gaip-nutrition-calendar-module">
                        <div class="gaip-nutrition-calendar-intro" style="padding: 16px; background: #f0fdf4; border-radius: 8px; margin-bottom: 16px;">
                            <p style="margin: 0 0 12px 0; color: #166534;">
                                <strong>📅 Generate your annual nutrition program</strong><br>
                                Enter your annual N target - the calculator distributes across the year by growth potential, applies clipping return factors, and calculates P/K/Ca/Mg from research-based ratios.
                            </p>
                            
                            <!-- Primary N Input - Prominent -->
                            <div style="background: white; border: 2px solid #16a34a; border-radius: 8px; padding: 16px; margin-bottom: 16px;">
                                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px;">
                                    <div>
                                        <label style="display: block; font-size: 13px; font-weight: 600; color: #166534; margin-bottom: 6px;">
                                            Annual N Target (kg/ha) <span style="color: #dc2626;">*</span>
                                        </label>
                                        <input type="number" name="annual_n" class="gaip-nutrition-annual-n" placeholder="e.g. 180" min="50" max="500" required style="width: 100%; padding: 10px; border: 2px solid #16a34a; border-radius: 6px; font-size: 16px; font-weight: 600;">
                                        <p style="margin: 6px 0 0; font-size: 11px; color: #666;">
                                            Typical ranges: Greens 80-150 | Tees 120-180 | Sports 180-350
                                        </p>
                                    </div>
                                    <div>
                                        <label style="display: block; font-size: 13px; font-weight: 600; color: #166534; margin-bottom: 6px;">
                                            Max N per Application (kg/ha)
                                        </label>
                                        <input type="number" name="max_n_per_month" class="gaip-nutrition-max-n" value="50" min="10" max="100" style="width: 100%; padding: 10px; border: 1px solid #d1d5db; border-radius: 6px; font-size: 16px;">
                                        <p style="margin: 6px 0 0; font-size: 11px; color: #666;">
                                            Per month cap. Lower for fine turf, higher for sports.
                                        </p>
                                    </div>
                                </div>
                            </div>
                            
                            <!-- Secondary Options -->
                            <div class="gaip-nutrition-config" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 12px; margin-bottom: 16px;">
                                <div>
                                    <label style="display: block; font-size: 12px; color: #666; margin-bottom: 4px;">Distribution Method</label>
                                    <select name="distribution_method" class="gaip-nutrition-distribution" style="width: 100%; padding: 8px; border: 1px solid #d1d5db; border-radius: 4px;">
                                        <option value="gp_weighted">GP-Weighted (recommended)</option>
                                        <option value="even">Even monthly distribution</option>
                                        <option value="front_loaded">Front-loaded (spring emphasis)</option>
                                    </select>
                                </div>
                                <div>
                                    <label style="display: block; font-size: 12px; color: #666; margin-bottom: 4px;">Clipping Management</label>
                                    <select name="clipping_management" class="gaip-nutrition-clipping" style="width: 100%; padding: 8px; border: 1px solid #d1d5db; border-radius: 4px;">
                                        <option value="">Auto (based on surface)</option>
                                        <option value="collected">Collected (greens, tees)</option>
                                        <option value="returned">Returned (fairways, sports)</option>
                                    </select>
                                </div>
                            </div>
                            <button type="button" data-nutrition-generate class="gaip-btn gaip-btn-primary" style="background: #16a34a; color: white; padding: 10px 20px; border: none; border-radius: 6px; cursor: pointer; font-weight: 600;">
                                Generate Nutrition Program
                            </button>
                        </div>
                        
                        <!-- Results container (populated by JS) -->
                        <div data-nutrition-results style="display: none;">
                            <div data-nutrition-summary></div>
                            <div data-nutrition-calendar></div>
                            <!-- Prebble recommendations injected here for NZ -->
                        </div>
                    </div>
                </div>
            </div>
            
            <!-- ═══════════════════════════════════════════ -->
            <!-- PERFORMANCE & WEAR -->
            <!-- ═══════════════════════════════════════════ -->
            <div style="margin: 20px 0 10px; padding: 8px 0; border-bottom: 2px solid #10b981;">
                <h3 style="margin: 0; color: #047857; font-size: 15px; font-weight: 600;">
                    PERFORMANCE & WEAR
                </h3>
            </div>

            <div class="gaip-result-block" data-section="traffic">
                <h4>Traffic load vs recovery probability</h4>
                <div class="gaip-result-body gaip-traffic-body"></div>
            </div>
            
            <!-- ═══════════════════════════════════════════ -->
            <!-- GROWTH CONDITIONS -->
            <!-- ═══════════════════════════════════════════ -->
            <div style="margin: 20px 0 10px; padding: 8px 0; border-bottom: 2px solid #8b5cf6;">
                <h3 style="margin: 0; color: #6d28d9; font-size: 15px; font-weight: 600;">
                    GROWTH CONDITIONS
                </h3>
            </div>
            
            <div class="gaip-result-block" data-section="growth">
                <h4>Growth potential analysis</h4>
                <div class="gaip-result-body gaip-growth-body"></div>
            </div>

            <div class="gaip-result-block" data-section="shade">
                <h4>Shade stress + microclimate constraints</h4>
                <div class="gaip-result-body gaip-shade-body"></div>
            </div>
            
            <!-- ═══════════════════════════════════════════ -->
            <!-- PGR & IRRIGATION -->
            <!-- ═══════════════════════════════════════════ -->
            <div style="margin: 20px 0 10px; padding: 8px 0; border-bottom: 2px solid #7c3aed;">
                <h3 style="margin: 0; color: #6d28d9; font-size: 15px; font-weight: 600;">
                    PGR & IRRIGATION
                </h3>
            </div>
            
            <div class="gaip-result-block" data-section="pgr">
                <h4>PGR program status (GDD-based)</h4>
                <div class="gaip-result-body gaip-pgr-body"></div>
            </div>
            
            <div class="gaip-result-block" data-section="sensor" id="gaip-sensor-results-section" style="display: none;">
                <h4>📡 Soil Moisture Sensor Data (TDR)</h4>
                <div class="gaip-result-body gaip-sensor-body"></div>
            </div>
            
            <div class="gaip-result-block" data-section="irrigation">
                <h4>Irrigation scheduling</h4>
                <div class="gaip-result-body gaip-irrigation-body"></div>
            </div>
            
            <!-- ═══════════════════════════════════════════ -->
            <!-- CLIMATE ANALYSIS -->
            <!-- ═══════════════════════════════════════════ -->
            <div style="margin: 20px 0 10px; padding: 8px 0; border-bottom: 2px solid #0ea5e9;">
                <h3 style="margin: 0; color: #0284c7; font-size: 15px; font-weight: 600;">
                    CLIMATE ANALYSIS
                </h3>
            </div>
            
            <div class="gaip-result-block" data-section="climate">
                <h4>Climate conditions & alerts</h4>
                <div class="gaip-result-body gaip-climate-body"></div>
            </div>
            
            <!-- Dew Prediction (Sports Turf Only) -->
            <div class="gaip-result-block gaip-sports-only" data-section="dew" id="gaip-dew-section" style="display: none;">
                <h4>Dew forecast & match conditions</h4>
                <div class="gaip-result-body" id="gaip-dew-output"></div>
            </div>
            
            <!-- ═══════════════════════════════════════════ -->
            <!-- DISEASE RISK -->
            <!-- ═══════════════════════════════════════════ -->
            <div style="margin: 20px 0 10px; padding: 8px 0; border-bottom: 2px solid #ef4444;">
                <h3 style="margin: 0; color: #dc2626; font-size: 15px; font-weight: 600;">
                    DISEASE RISK
                </h3>
            </div>
            
            <div class="gaip-result-block" data-section="disease">
                <h4>Disease pressure & intervention timing</h4>
                <div class="gaip-result-body gaip-disease-body" id="gaip-disease-output"></div>
            </div>
            
            <div class="gaip-result-block" data-section="cultivar">
                <h4>Cultivar performance profile</h4>
                <div class="gaip-result-body gaip-cultivar-body"></div>
            </div>
            
            <!-- ═══════════════════════════════════════════ -->
            <!-- PLANNING TOOLS -->
            <!-- ═══════════════════════════════════════════ -->
            <div style="margin: 20px 0 10px; padding: 8px 0; border-bottom: 2px solid #f59e0b;">
                <h3 style="margin: 0; color: #d97706; font-size: 15px; font-weight: 600;">
                    PLANNING TOOLS
                </h3>
            </div>
            
            <div class="gaip-result-block" data-section="seasonal">
                <h4>Seasonal N planning tool</h4>
                <div class="gaip-result-body gaip-seasonal-body"></div>
            </div>
            
            <div class="gaip-result-block" data-section="calendar">
                <h4>Recovery window calendar</h4>
                <div class="gaip-result-body gaip-calendar-body"></div>
            </div>
            
            <div class="gaip-result-block" data-section="pests">
                <h4>GDD-based pest timing (armyworm, ground pearl)</h4>
                <div class="gaip-result-body gaip-pest-body">Pest timing module not yet active. Link to dedicated GDD calculators.</div>
            </div>
        </div>
    </div>
    
