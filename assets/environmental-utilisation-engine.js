/**
 * Environmental Utilisation Efficiency (EUE) Engine v1.0.0
 * 
 * Models the Liebig's Law limiting factor principle for LED turf systems.
 * Photon delivery ≠ photon conversion. Environmental co-factors determine
 * what fraction of delivered PPFD is actually utilisable by the plant.
 * 
 * The engine computes an EUE coefficient (0.0–1.0) that multiplies against
 * theoretical DLI delivery to produce effective DLI.
 * 
 * Scientific basis:
 *   - Liebig's Law of the Minimum (1840)
 *   - Principality Stadium field data (2017): 450 µmol worst turf, 120 µmol best turf
 *   - Sodick Growth Equation Framework (2026)
 *   - "Lawn Growth Under Artificial Light" comprehensive technical document
 *   - Tifton Artificial Light Technical Document (bilingual reference)
 * 
 * Environmental factors modelled (Growth Environment Stack order):
 *   1. Root-zone temperature    → enzyme function gate
 *   2. Leaf/air temperature     → Calvin cycle rate gate  
 *   3. VPD / moisture           → stomatal conductance gate
 *   4. Airflow                  → CO₂ replenishment / leaf temp regulation
 *   5. CO₂ concentration        → substrate availability gate
 *   6. Rhizosphere Eh (redox)   → root function / nutrient uptake gate
 * 
 * Each factor produces a utilisation coefficient (0.0–1.0).
 * The composite EUE = minimum of all factors (Liebig's Law).
 * 
 * @requires climate-engine.js (for weather data)
 * @provides GSSH_EUE.calculate(params) → eueResult
 */

(function(global) {
    'use strict';

    /* ============================================================
       CONSTANTS — PHYSIOLOGICAL THRESHOLDS
       Sources cited inline. All thresholds from reviewed documents.
    ============================================================ */

    /**
     * Root-zone temperature thresholds by photosynthetic pathway.
     * 
     * C4 (Tifton, bermuda, couch, kikuyu, zoysia):
     *   Optimal: 22–28°C (Tifton bilingual doc Section 3)
     *   Below 15°C: growth greatly reduced (Lawn Growth doc Section 5)
     *   Below 10°C: near-dormant, LED essentially wasted
     * 
     * C3 (ryegrass, fescue, bentgrass, poa):
     *   Optimal: 10–20°C (Lawn Growth doc Section 5)
     *   Below 4°C: minimal metabolic activity
     *   Above 25°C: heat stress, declining efficiency
     */
    var ROOT_ZONE_TEMP = {
        c4: {
            dead:    5,    // Below this: no metabolic activity
            minimum: 10,   // Severe suppression
            reduced: 15,   // Growth greatly reduced
            optLow:  22,   // Optimal range start
            optHigh: 28,   // Optimal range end
            stressHigh: 35 // Heat stress onset
        },
        c3: {
            dead:    -2,   // Below this: frost damage
            minimum: 4,    // Minimal activity
            reduced: 7,    // Reduced but functional
            optLow:  10,   // Optimal range start
            optHigh: 20,   // Optimal range end
            stressHigh: 28 // Heat stress, declining
        }
    };

    /**
     * Leaf/air temperature thresholds.
     * LED systems produce minimal radiant heat (unlike HPS),
     * so leaf temp ≈ air temp under LED illumination.
     * 
     * C4: Optimal 20–30°C leaf temp (Tifton bilingual doc Section 3)
     * C3: Optimal 10–20°C leaf temp (Lawn Growth doc Section 4)
     */
    var LEAF_TEMP = {
        c4: {
            dead:    5,
            minimum: 12,
            optLow:  20,
            optHigh: 30,
            stressHigh: 38
        },
        c3: {
            dead:    -2,
            minimum: 5,
            optLow:  10,
            optHigh: 20,
            stressHigh: 30
        }
    };

    /**
     * VPD (Vapour Pressure Deficit) thresholds.
     * 
     * Stable zone: 0.5–1.2 kPa (Lawn Growth doc Section 10)
     * Below 0.5: excessive humidity, disease risk, poor transpiration
     * Above 1.2: stomatal closure onset
     * Above 2.0: severe stomatal closure, LED photons wasted
     * Above 3.0: acute moisture stress
     * 
     * Guard cell turgor pressure directly controls stomatal aperture.
     * Without open stomata, CO₂ cannot enter → Calvin cycle stalls
     * → ATP/NADPH accumulate unused → photooxidative stress.
     */
    var VPD_THRESHOLDS = {
        tooLow:     0.3,   // Stagnant, disease risk
        optLow:     0.5,   // Optimal range start
        optHigh:    1.2,   // Optimal range end
        closureOnset: 1.8, // Partial stomatal closure
        closureSevere: 2.5,// Severe closure
        acute:      3.5    // Acute moisture stress
    };

    /**
     * Airflow thresholds.
     * 
     * Optimal: 0.3–1.0 m/s (Tifton bilingual doc Section 3)
     * Functions: CO₂ replenishment, leaf temp regulation,
     *           transpiration promotion, foliar drying (disease control)
     * 
     * Stagnant air → CO₂ depletion around leaves → photosynthesis
     * plateaus early (Lawn Growth doc Section 6)
     */
    var AIRFLOW_THRESHOLDS = {
        stagnant:   0.1,   // CO₂ boundary layer builds up
        minimum:    0.3,   // Minimum functional airflow
        optLow:     0.3,   // Optimal start
        optHigh:    1.0,   // Optimal end
        excessive:  3.0    // Desiccation / lodging risk
    };

    /**
     * CO₂ concentration thresholds.
     * 
     * Atmospheric: ~420 ppm
     * Optimal under LED: 600–800 ppm (Lawn Growth doc Section 7)
     * 
     * In enclosed/semi-enclosed stadiums, plant metabolic activity
     * depletes CO₂ faster than natural replenishment.
     * "Confined space + no fan" = CO₂ depletion environment.
     */
    var CO2_THRESHOLDS = {
        depleted:   250,   // Severe limitation
        subOptimal: 350,   // Below ambient — enclosed depletion
        ambient:    420,   // Normal atmospheric
        enhanced:   600,   // Enhanced range start
        optimal:    800,   // Enhanced range end
        excessive:  1200   // Diminishing returns / safety
    };

    /**
     * Rhizosphere Eh (redox potential) thresholds.
     * 
     * Oxidising environment required for root function.
     * When Eh drops (reduced state):
     *   - Root respiration inhibited
     *   - Root growth/branching inhibited  
     *   - Water and nutrient absorption decreases
     *   - Downstream photosynthesis bottleneck
     * 
     * Tifton particularly vulnerable to Eh drop (Lawn Growth doc Section 12).
     * Proxy: soil moisture / drainage status.
     */
    var RHIZOSPHERE = {
        anaerobic:    0.2,   // Waterlogged — severe root suppression
        reducing:     0.4,   // Poor aeration
        transitional: 0.6,   // Marginal
        oxidising:    0.8,   // Good aeration
        optimal:      1.0    // Well-drained, healthy rhizosphere
    };

    /* ============================================================
       SPECIES CLASSIFICATION
    ============================================================ */

    var C4_SPECIES = [
        'couch', 'bermuda', 'kikuyu', 'zoysia', 'buffalo',
        'staugustine', 'paspalum', 'tifton', 'tifdwarf',
        'tifeagle', 'tifway', 'tifgrand', 'latitude36'
    ];

    var C3_SPECIES = [
        'ryegrass', 'prg', 'fescue', 'tfescue', 'bentgrass',
        'creepingbentgrass', 'browntopbent', 'colonialbentgrass',
        'poa', 'bluegrass'
    ];

    function getPathway(speciesKey) {
        if (!speciesKey) return 'c4'; // Default for stadium turf
        var key = speciesKey.toLowerCase();
        for (var i = 0; i < C3_SPECIES.length; i++) {
            if (key.indexOf(C3_SPECIES[i]) >= 0) return 'c3';
        }
        return 'c4';
    }

    /* ============================================================
       VPD CALCULATION
       Standard Tetens equation for saturation vapour pressure
    ============================================================ */

    /**
     * Calculate VPD from air temperature and relative humidity.
     * @param {number} tempC - Air temperature in °C
     * @param {number} rhPct - Relative humidity in % (0-100)
     * @returns {number} VPD in kPa
     */
    function calculateVPD(tempC, rhPct) {
        // Tetens equation: saturation vapour pressure (kPa)
        var es = 0.6108 * Math.exp((17.27 * tempC) / (tempC + 237.3));
        // Actual vapour pressure
        var ea = es * (rhPct / 100);
        // VPD = saturation - actual
        return Math.max(0, es - ea);
    }

    /* ============================================================
       INDIVIDUAL FACTOR EFFICIENCY FUNCTIONS
       Each returns 0.0–1.0 representing utilisation fraction
    ============================================================ */

    /**
     * Root-zone temperature efficiency.
     * Uses trapezoidal response curve with species-specific thresholds.
     */
    function rootZoneTempEfficiency(soilTempC, pathway) {
        var t = ROOT_ZONE_TEMP[pathway];
        if (soilTempC === null || soilTempC === undefined || isNaN(soilTempC)) {
            return { efficiency: 0.85, source: 'no_data', confidence: 0.3 };
        }

        var eff;
        if (soilTempC <= t.dead) {
            eff = 0.0;
        } else if (soilTempC <= t.minimum) {
            eff = 0.1 * (soilTempC - t.dead) / (t.minimum - t.dead);
        } else if (soilTempC <= t.reduced) {
            eff = 0.1 + 0.5 * (soilTempC - t.minimum) / (t.reduced - t.minimum);
        } else if (soilTempC <= t.optLow) {
            eff = 0.6 + 0.4 * (soilTempC - t.reduced) / (t.optLow - t.reduced);
        } else if (soilTempC <= t.optHigh) {
            eff = 1.0;
        } else if (soilTempC <= t.stressHigh) {
            eff = 1.0 - 0.5 * (soilTempC - t.optHigh) / (t.stressHigh - t.optHigh);
        } else {
            eff = Math.max(0.1, 0.5 - 0.3 * (soilTempC - t.stressHigh) / 10);
        }

        return {
            efficiency: Math.max(0, Math.min(1, eff)),
            value: soilTempC,
            unit: '°C',
            optimalRange: t.optLow + '–' + t.optHigh + '°C',
            source: 'measured',
            confidence: 0.9,
            limiting: eff < 0.6,
            severity: eff < 0.3 ? 'critical' : eff < 0.6 ? 'significant' : eff < 0.85 ? 'moderate' : 'none'
        };
    }

    /**
     * Leaf/air temperature efficiency.
     */
    function leafTempEfficiency(airTempC, pathway) {
        var t = LEAF_TEMP[pathway];
        if (airTempC === null || airTempC === undefined || isNaN(airTempC)) {
            return { efficiency: 0.85, source: 'no_data', confidence: 0.3 };
        }

        var eff;
        if (airTempC <= t.dead) {
            eff = 0.0;
        } else if (airTempC <= t.minimum) {
            eff = 0.15 * (airTempC - t.dead) / (t.minimum - t.dead);
        } else if (airTempC <= t.optLow) {
            eff = 0.15 + 0.85 * (airTempC - t.minimum) / (t.optLow - t.minimum);
        } else if (airTempC <= t.optHigh) {
            eff = 1.0;
        } else if (airTempC <= t.stressHigh) {
            eff = 1.0 - 0.6 * (airTempC - t.optHigh) / (t.stressHigh - t.optHigh);
        } else {
            eff = Math.max(0.05, 0.4 - 0.3 * (airTempC - t.stressHigh) / 10);
        }

        return {
            efficiency: Math.max(0, Math.min(1, eff)),
            value: airTempC,
            unit: '°C',
            optimalRange: t.optLow + '–' + t.optHigh + '°C',
            source: 'measured',
            confidence: 0.85,
            limiting: eff < 0.6,
            severity: eff < 0.3 ? 'critical' : eff < 0.6 ? 'significant' : eff < 0.85 ? 'moderate' : 'none'
        };
    }

    /**
     * VPD / moisture efficiency.
     * Models stomatal conductance response to vapour pressure deficit.
     */
    function vpdEfficiency(vpd) {
        if (vpd === null || vpd === undefined || isNaN(vpd)) {
            return { efficiency: 0.85, source: 'no_data', confidence: 0.3 };
        }

        var t = VPD_THRESHOLDS;
        var eff;

        if (vpd < t.tooLow) {
            // Too humid — reduced transpiration, disease risk, but stomata open
            eff = 0.7 + 0.3 * (vpd / t.tooLow);
        } else if (vpd < t.optLow) {
            eff = 0.85 + 0.15 * (vpd - t.tooLow) / (t.optLow - t.tooLow);
        } else if (vpd <= t.optHigh) {
            eff = 1.0;
        } else if (vpd <= t.closureOnset) {
            eff = 1.0 - 0.3 * (vpd - t.optHigh) / (t.closureOnset - t.optHigh);
        } else if (vpd <= t.closureSevere) {
            eff = 0.7 - 0.4 * (vpd - t.closureOnset) / (t.closureSevere - t.closureOnset);
        } else if (vpd <= t.acute) {
            eff = 0.3 - 0.2 * (vpd - t.closureSevere) / (t.acute - t.closureSevere);
        } else {
            eff = 0.1;
        }

        return {
            efficiency: Math.max(0, Math.min(1, eff)),
            value: +vpd.toFixed(2),
            unit: 'kPa',
            optimalRange: t.optLow + '–' + t.optHigh + ' kPa',
            source: 'calculated',
            confidence: 0.8,
            limiting: eff < 0.6,
            severity: eff < 0.3 ? 'critical' : eff < 0.6 ? 'significant' : eff < 0.85 ? 'moderate' : 'none'
        };
    }

    /**
     * Airflow efficiency.
     * Models CO₂ boundary layer replenishment and leaf temp regulation.
     */
    function airflowEfficiency(windSpeedMs, venueEnclosure) {
        if (windSpeedMs === null || windSpeedMs === undefined || isNaN(windSpeedMs)) {
            // Open/partial venues: assume adequate outdoor airflow when no measurement
            var enc = venueEnclosure || 'open';
            if (enc === 'open' || enc === 'partial' || enc === 'retractable_open') {
                return { efficiency: 1.0, source: 'no_data', confidence: 0.4,
                         note: 'Assumed adequate, open venue, no wind measurement' };
            }
            return { efficiency: 0.80, source: 'no_data', confidence: 0.3 };
        }

        var t = AIRFLOW_THRESHOLDS;
        var eff;

        if (windSpeedMs < t.stagnant) {
            // Stagnant: CO₂ depletion, uneven microclimate
            eff = 0.4 + 0.3 * (windSpeedMs / t.stagnant);
        } else if (windSpeedMs < t.minimum) {
            eff = 0.7 + 0.3 * (windSpeedMs - t.stagnant) / (t.minimum - t.stagnant);
        } else if (windSpeedMs <= t.optHigh) {
            eff = 1.0;
        } else if (windSpeedMs <= t.excessive) {
            eff = 1.0 - 0.3 * (windSpeedMs - t.optHigh) / (t.excessive - t.optHigh);
        } else {
            eff = 0.6; // Strong wind — desiccation but still CO₂ available
        }

        return {
            efficiency: Math.max(0, Math.min(1, eff)),
            value: +windSpeedMs.toFixed(1),
            unit: 'm/s',
            optimalRange: t.optLow + '–' + t.optHigh + ' m/s',
            source: 'measured',
            confidence: 0.7,
            limiting: eff < 0.6,
            severity: eff < 0.5 ? 'significant' : eff < 0.75 ? 'moderate' : 'none'
        };
    }

    /**
     * CO₂ concentration efficiency.
     * 
     * Most stadium environments don't measure CO₂ directly.
     * We estimate based on venue enclosure type and airflow:
     *   - Open air: ambient (~420 ppm) — not limiting
     *   - Retractable roof open: ambient
     *   - Retractable roof closed: reduced (depends on airflow)
     *   - Fixed roof / enclosed: potentially depleted
     *   - Enclosed with CO₂ enrichment (SeeGrow): enhanced
     */
    function co2Efficiency(co2ppm, venueEnclosure, airflowMs) {
        // If direct CO₂ measurement available, use it
        if (co2ppm !== null && co2ppm !== undefined && co2ppm > 0) {
            var t = CO2_THRESHOLDS;
            var eff;

            if (co2ppm < t.depleted) {
                eff = 0.3;
            } else if (co2ppm < t.subOptimal) {
                eff = 0.3 + 0.4 * (co2ppm - t.depleted) / (t.subOptimal - t.depleted);
            } else if (co2ppm < t.ambient) {
                eff = 0.7 + 0.3 * (co2ppm - t.subOptimal) / (t.ambient - t.subOptimal);
            } else if (co2ppm <= t.enhanced) {
                eff = 1.0;
            } else if (co2ppm <= t.optimal) {
                eff = 1.0; // Enhanced is at least as good as ambient
            } else {
                eff = 1.0; // Diminishing returns but not harmful
            }

            return {
                efficiency: Math.max(0, Math.min(1, eff)),
                value: co2ppm,
                unit: 'ppm',
                optimalRange: '400–800 ppm',
                source: 'measured',
                confidence: 0.9,
                limiting: eff < 0.7,
                severity: eff < 0.5 ? 'significant' : eff < 0.75 ? 'moderate' : 'none'
            };
        }

        // Estimate from venue type
        var estimated = estimateCO2(venueEnclosure, airflowMs);
        return estimated;
    }

    /**
     * Estimate CO₂ availability from venue configuration.
     */
    function estimateCO2(venueEnclosure, airflowMs) {
        var enclosure = (venueEnclosure || 'open').toLowerCase();
        var baseEff = 1.0;
        var estimatedPPM = 420;
        var conf = 0.4; // Low confidence for estimates

        if (enclosure === 'open' || enclosure === 'none') {
            baseEff = 1.0;
            estimatedPPM = 420;
        } else if (enclosure === 'retractable_open' || enclosure === 'partial') {
            baseEff = 0.95;
            estimatedPPM = 410;
        } else if (enclosure === 'retractable_closed') {
            baseEff = 0.80;
            estimatedPPM = 380;
            // Airflow compensates partially
            if (airflowMs && airflowMs > 0.5) {
                baseEff = Math.min(1.0, baseEff + 0.1);
                estimatedPPM = 400;
            }
        } else if (enclosure === 'fixed_roof' || enclosure === 'enclosed') {
            baseEff = 0.65;
            estimatedPPM = 340;
            if (airflowMs && airflowMs > 0.5) {
                baseEff = Math.min(0.85, baseEff + 0.15);
                estimatedPPM = 380;
            }
        } else if (enclosure === 'enclosed_enriched') {
            // SeeGrow-style CO₂ enrichment
            baseEff = 1.0;
            estimatedPPM = 700;
            conf = 0.7;
        }

        return {
            efficiency: baseEff,
            value: estimatedPPM,
            unit: 'ppm (est.)',
            optimalRange: '400–800 ppm',
            source: 'estimated_from_venue',
            confidence: conf,
            limiting: baseEff < 0.7,
            severity: baseEff < 0.5 ? 'significant' : baseEff < 0.75 ? 'moderate' : 'none',
            venueType: enclosure
        };
    }

    /**
     * Rhizosphere health efficiency.
     * 
     * Proxy: drainage rating + soil moisture level.
     * Direct Eh measurement rare in practice.
     */
    function rhizosphereEfficiency(drainageRating, soilMoisturePct) {
        // If drainage rating provided (0-1 scale)
        if (drainageRating !== null && drainageRating !== undefined) {
            var eff = drainageRating; // Direct mapping

            // Soil moisture modifies: waterlogged = reduced Eh
            if (soilMoisturePct !== null && soilMoisturePct !== undefined) {
                if (soilMoisturePct > 90) {
                    eff = Math.min(eff, 0.4); // Waterlogged override
                } else if (soilMoisturePct > 80) {
                    eff = Math.min(eff, 0.6);
                } else if (soilMoisturePct < 20) {
                    eff = Math.min(eff, 0.7); // Too dry — root stress
                }
            }

            return {
                efficiency: Math.max(0, Math.min(1, eff)),
                value: drainageRating,
                unit: 'rating',
                optimalRange: 'Well-drained (>0.8)',
                source: 'configured',
                confidence: 0.6,
                limiting: eff < 0.6,
                severity: eff < 0.4 ? 'significant' : eff < 0.65 ? 'moderate' : 'none'
            };
        }

        // Default: assume reasonable drainage for a professional venue
        return {
            efficiency: 0.85,
            source: 'default',
            confidence: 0.3,
            limiting: false,
            severity: 'none'
        };
    }

    /* ============================================================
       CHEMISTRY COUPLING — G7
       
       Two pathways:
         A: Rhizosphere efficiency modifier (root function, osmotic, ion toxicity)
            Sources: soil ECe (converted from 1:5, sensor bulk EC, or manual entry),
                     water EC (frequency-weighted accumulation), soil Na/SARadj, soil K
         B: Photosynthetic efficiency modifier (chlorophyll, electron transport)
            Source: TISSUE TEST ONLY. MLSN soil data is NOT used for Pathway B
                    on stadium surfaces. No tissue = unknown flag, not a fallback penalty.
       
       Both produce a modifier 0-1. Applied multiplicatively to EUE composite.
       
       Citations:
         Carrow & Duncan 1998, Marcum & Pessarakli 2010, Marcum 2008 (EC/salinity)
         Carrow, Waddington & Rieke 2001, UF/IFAS EP539 (tissue sufficiency)
         Hilhorst 2000 (bulk EC conversion)
    ============================================================ */

    /**
     * EC source priority chain.
     * Returns ECe equivalent from the highest-confidence available source.
     * @param {object} chemInputs - Chemistry inputs object
     * @returns {object} { ece, source, confidence }
     */
    function resolveECe(chemInputs) {
        // 1. Sensor bulk EC via Hilhorst: ECe = bulkEC / (VWC * 0.7)
        if (chemInputs.sensorBulkEC != null && chemInputs.sensorVWC != null && chemInputs.sensorVWC > 0) {
            var ece = chemInputs.sensorBulkEC / (chemInputs.sensorVWC * 0.7);
            return { ece: ece, source: 'sensor_hilhorst', confidence: 0.90 };
        }
        // 2. Manual ECe entry (user override)
        if (chemInputs.manualECe != null) {
            return { ece: chemInputs.manualECe, source: 'manual', confidence: 0.85 };
        }
        // 3. Soil 1:5 EC converted by construction type
        if (chemInputs.soil1to5EC != null) {
            var factors = { usga_sand: 11, sand_carpet: 11, sand_soil_blend: 7, native: 5 };
            var factor = factors[chemInputs.constructionType] || 9; // conservative default
            return { ece: chemInputs.soil1to5EC * factor, source: 'lab_1to5', confidence: 0.75 };
        }
        return null; // No soil EC available
    }

    /**
     * Pathway A: Rhizosphere efficiency modifier.
     * Accounts for osmotic stress, ion toxicity, K root function.
     */
    function pathwayAModifier(chemInputs, pathway, isJuvenile) {
        var mod = 1.0;
        var warnings = [];
        var sources = [];
        var confidence = 0;

        // --- A1: Soil ECe (species-specific thresholds) ---
        var eceResult = resolveECe(chemInputs);
        if (eceResult) {
            var ece = eceResult.ece;
            confidence = Math.max(confidence, eceResult.confidence);
            sources.push(eceResult.source);
            var eceMod = 1.0;

            if (pathway === 'c4') {
                // Couch/bermudagrass: threshold 6.9 dS/m (Carrow & Duncan 1998, Marcum 2008)
                if (ece < 6.9)       eceMod = 1.00;
                else if (ece < 10)   eceMod = 0.90;
                else if (ece < 14)   eceMod = 0.75;
                else                 eceMod = 0.55;
            } else {
                // Perennial ryegrass: threshold 5.6 dS/m (Marcum & Pessarakli 2010)
                if (ece < 5.6)       eceMod = 1.00;
                else if (ece < 8)    eceMod = 0.88;
                else if (ece < 12)   eceMod = 0.70;
                else                 eceMod = 0.50;
            }

            if (isJuvenile && eceMod < 1.0) {
                eceMod = Math.max(0.30, eceMod - (1.0 - eceMod) * 0.5); // juvenile: 1.5x penalty
                warnings.push('Juvenile overseed detected, EC stress penalty elevated (28-day establishment window).');
            }
            if (eceMod < 0.88) {
                warnings.push('Root-zone ECe ' + ece.toFixed(1) + ' dS/m exceeds ' +
                    (pathway === 'c4' ? 'couch (6.9' : 'ryegrass (5.6') + ' dS/m) threshold. ' +
                    'Osmotic stress limiting water and nutrient uptake.');
            }
            mod *= eceMod;
        }

        // --- A2: Water EC frequency-weighted accumulation risk ---
        if (chemInputs.waterEC != null && chemInputs.irrigationsPerWeek != null) {
            var wEC = chemInputs.waterEC;
            var freqNorm = Math.min(1, chemInputs.irrigationsPerWeek / 7);
            var baseRisk = 0;
            if (wEC >= 3.0)      baseRisk = 0.30;
            else if (wEC >= 1.5) baseRisk = 0.15;
            else if (wEC >= 0.7) baseRisk = 0.05;

            var waterPenalty = baseRisk * freqNorm;
            if (isJuvenile) waterPenalty = Math.min(0.45, waterPenalty * 1.5);

            if (waterPenalty > 0) {
                mod *= (1 - waterPenalty);
                sources.push('water_ec');
                confidence = Math.max(confidence, 0.55);
                if (wEC >= 1.5) {
                    warnings.push('Water EC ' + wEC.toFixed(2) + ' dS/m, salt accumulation risk ' +
                        'elevated under LED-driven irrigation frequency (' +
                        chemInputs.irrigationsPerWeek + ' irrigations/week).');
                }
            }

            // Warning: LED irrigation not recalibrated but water EC is elevated
            if (chemInputs.irrigationAdjustedForLED === false && wEC >= 0.7) {
                warnings.push('⚠ Irrigation schedule has not been recalibrated for LED operation ' +
                    '(Water EC ' + wEC.toFixed(2) + ' dS/m). Increased irrigation frequency under LED ' +
                    'will accelerate salt accumulation in the root zone. Recalibrate before scaling LED hours.');
            }
        }

        // --- A3: Soil Na / SARadj ---
        var saradj = chemInputs.waterSARadj || chemInputs.soilNa || null;
        if (saradj != null) {
            var naMod = 1.0;
            if (saradj < 3)      naMod = 1.00;
            else if (saradj < 6) naMod = 0.93;
            else if (saradj < 9) naMod = 0.82;
            else                 naMod = 0.70;
            if (isJuvenile && naMod < 1.0) naMod = Math.max(0.50, naMod - (1.0 - naMod) * 0.5);
            mod *= naMod;
            if (naMod < 0.93) {
                warnings.push('Elevated Na/SARadj (' + saradj.toFixed(1) + '). ' +
                    'Ion toxicity and osmotic stress at root surface. ' +
                    'Sand construction: drainage unaffected but root physiology impaired.');
            }
            confidence = Math.max(confidence, 0.70);
            sources.push('na_saradj');
        }

        // --- A4: Soil K deficiency (MLSN status — acceptable for Pathway A) ---
        if (chemInputs.soilKStatus != null) {
            var kMod = 1.0;
            if (chemInputs.soilKStatus === 'deficient')       kMod = 0.80;
            else if (chemInputs.soilKStatus === 'marginal')   kMod = 0.90;
            mod *= kMod;
            if (kMod < 1.0) {
                warnings.push('Soil K ' + chemInputs.soilKStatus + '. ' +
                    'Potassium deficiency impairs stomatal regulation and root membrane integrity.');
            }
            confidence = Math.max(confidence, 0.70);
            sources.push('soil_k');
        }

        return {
            modifier: Math.max(0.2, Math.min(1.0, mod)),
            warnings: warnings,
            sources: sources,
            confidence: confidence || 0.3
        };
    }

    /**
     * Pathway B: Photosynthetic efficiency modifier.
     * TISSUE TEST ONLY. No MLSN fallback on stadium surfaces.
     * No tissue = unknown flag with advisory, not a numeric penalty.
     */
    function pathwayBModifier(chemInputs) {
        var hasTissue = chemInputs.tissueAvailable === true;

        if (!hasTissue) {
            return {
                modifier: null,
                unknown: true,
                confidence: 0,
                flag: 'tissue_test_recommended',
                message: 'Photosynthetic efficiency cannot be assessed, tissue test required. ' +
                    'MLSN soil data is not used for EUE assessment on stadium surfaces. ' +
                    'Mg, Fe and Mn status directly affect chlorophyll synthesis and electron transport efficiency under LED operation.'
            };
        }

        var mod = 1.0;
        var warnings = [];

        // B1: Magnesium — central chlorophyll atom
        // Sufficiency: ≥ 0.20% DW (Carrow et al. 2001)
        if (chemInputs.tissueMgPct != null) {
            var mg = chemInputs.tissueMgPct;
            var mgMod = 1.0;
            if (mg >= 0.20)      mgMod = 1.00;
            else if (mg >= 0.15) mgMod = 0.88;
            else if (mg >= 0.10) mgMod = 0.72;
            else                 mgMod = 0.55;
            mod *= mgMod;
            if (mgMod < 0.88) {
                warnings.push('Tissue Mg ' + mg.toFixed(3) + '% DW, below sufficiency (0.20%). ' +
                    'Mg is the central atom in every chlorophyll molecule. Deficiency directly ' +
                    'reduces chlorophyll synthesis, delivered LED photons cannot be captured efficiently.');
            }
        }

        // B2: Iron — chlorophyll synthesis + ferredoxin (PSI electron transport)
        // Sufficiency: ≥ 50 mg/kg DW (Carrow et al. 2001)
        if (chemInputs.tissueFeMgkg != null) {
            var fe = chemInputs.tissueFeMgkg;
            var feMod = 1.0;
            if (fe >= 50)      feMod = 1.00;
            else if (fe >= 35) feMod = 0.90;
            else if (fe >= 20) feMod = 0.78;
            else               feMod = 0.62;
            mod *= feMod;
            if (feMod < 0.90) {
                warnings.push('Tissue Fe ' + fe.toFixed(0) + ' mg/kg, below sufficiency (50 mg/kg). ' +
                    'Iron is required for chlorophyll synthesis and ferredoxin in the PSI electron transport chain.');
            }
            // Flag HCO3 as Fe availability risk
            if (chemInputs.waterHCO3 != null && chemInputs.waterHCO3 > 180) {
                warnings.push('Water HCO3 ' + chemInputs.waterHCO3.toFixed(0) + ' mg/L exceeds 180 mg/L, ' +
                    'elevated bicarbonate induces alkalinity-driven Fe and Mn chlorosis. Monitor tissue Fe and Mn closely.');
            }
        }

        // B3: Manganese — oxygen-evolving complex of Photosystem II
        // Sufficiency: ≥ 25 mg/kg DW (Carrow et al. 2001)
        // Note: reduced UV under LED suppresses Mn mobilisation in sand rootzones
        if (chemInputs.tissueMnMgkg != null) {
            var mn = chemInputs.tissueMnMgkg;
            var mnMod = 1.0;
            if (mn >= 25)      mnMod = 1.00;
            else if (mn >= 15) mnMod = 0.92;
            else if (mn >= 8)  mnMod = 0.80;
            else               mnMod = 0.65;
            mod *= mnMod;
            if (mnMod < 0.92) {
                warnings.push('Tissue Mn ' + mn.toFixed(0) + ' mg/kg, below sufficiency (25 mg/kg). ' +
                    'Mn is essential at the oxygen-evolving complex of Photosystem II. ' +
                    'Reduced UV output under LED operation may suppress Mn mobilisation in sand rootzones.');
            }
        }

        // B4: Calcium — membrane integrity (secondary)
        // Sufficiency: ≥ 0.50% DW (Carrow et al. 2001)
        if (chemInputs.tissueCaPct != null) {
            var ca = chemInputs.tissueCaPct;
            var caMod = 1.0;
            if (ca >= 0.50)      caMod = 1.00;
            else if (ca >= 0.35) caMod = 0.95;
            else                 caMod = 0.88;
            mod *= caMod;
            if (caMod < 1.0) {
                warnings.push('Tissue Ca ' + ca.toFixed(3) + '% DW, below sufficiency (0.50%). ' +
                    'Ca deficiency impairs membrane integrity and cell division.');
            }
        }

        return {
            modifier: Math.max(0.3, Math.min(1.0, mod)),
            unknown: false,
            confidence: 0.85,
            warnings: warnings
        };
    }

    /**
     * Assemble chemistry inputs from available global GAIP result objects.
     * Reads only — no writes to any GAIP global.
     * Priority: sensor > lab > water quality > manual venue config.
     */
    function assembleChemInputs(params, venueConfig) {
        var inputs = {
            // EC sources
            sensorBulkEC:   null,
            sensorVWC:      null,
            manualECe:      null,
            soil1to5EC:     null,
            constructionType: null,
            waterEC:        null,
            // Na
            waterSARadj:    null,
            soilNa:         null,
            // K
            soilKStatus:    null,
            // Water
            waterHCO3:      null,
            irrigationsPerWeek: null,
            irrigationAdjustedForLED: null,
            // Overseed
            isJuvenile:     false,
            // Tissue (Pathway B)
            tissueAvailable: false,
            tissueMgPct:    null,
            tissueFeMgkg:   null,
            tissueMnMgkg:   null,
            tissueCaPct:    null
        };

        // Sensor bulk EC + VWC from Hydrosight
        var sensor = global.GAIP_SENSOR_DATA || (global.GAIP_Sensor && global.GAIP_Sensor.getLatestData && global.GAIP_Sensor.getLatestData());
        if (sensor) {
            inputs.sensorBulkEC = sensor.ec != null ? sensor.ec : null;
            inputs.sensorVWC = sensor.vwc != null ? sensor.vwc / 100 : null; // convert % to fraction
        }

        // Manual ECe from venue config
        if (venueConfig && venueConfig.manualECe != null) {
            inputs.manualECe = venueConfig.manualECe;
        }

        // Construction type for 1:5 EC conversion factor
        var canonical = global.GAIP_CANONICAL_STATE || global.GSSH_CANONICAL_STATE || {};
        if (canonical.turf && canonical.turf.construction) {
            inputs.constructionType = canonical.turf.construction;
        }

        // MLSN / soil test results
        var mlsn = global.GAIP_MLSN_RESULT;
        if (mlsn) {
            // Soil 1:5 EC
            if (mlsn.raw && mlsn.raw.ec != null) inputs.soil1to5EC = mlsn.raw.ec;
            // K status for Pathway A
            if (mlsn.nutrients && mlsn.nutrients.K) {
                var kDelta = mlsn.nutrients.K.delta;
                if (kDelta != null) {
                    inputs.soilKStatus = kDelta < 0 ? 'deficient' : (kDelta < 20 ? 'marginal' : 'sufficient');
                }
            }
        }

        // Water quality results
        var water = global.GAIP_WATER_RESULT || global.GAIP_SALINITY_RESULT;
        if (water) {
            if (water.ec != null)     inputs.waterEC = water.ec;
            if (water.saradj != null) inputs.waterSARadj = water.saradj;
            if (water.hco3 != null)   inputs.waterHCO3 = water.hco3;
        }

        // Irrigation frequency from irrigation result
        var irr = global.GAIP_IRRIGATION_RESULT;
        if (irr && irr.schedule) {
            var irrDays = irr.schedule.filter(function(d) { return d.irrigate; }).length;
            inputs.irrigationsPerWeek = irrDays;
        }

        // irrigationAdjustedForLED from venue config
        if (venueConfig) {
            inputs.irrigationAdjustedForLED = venueConfig.irrigationAdjustedForLED || false;
        }

        // Overseed juvenile window (28 days from application date)
        if (venueConfig && venueConfig.overseedApplicationDate) {
            var appDate = new Date(venueConfig.overseedApplicationDate);
            var daysSince = (Date.now() - appDate.getTime()) / (1000 * 60 * 60 * 24);
            inputs.isJuvenile = daysSince >= 0 && daysSince <= 28;
        } else if (params && params.isOverseedSeason) {
            inputs.isJuvenile = true; // monthly flag fallback — treat whole season as elevated
        }

        // Tissue test results (Pathway B)
        var tissue = global.GAIP_TISSUE_RESULT || global.GAIP_TISSUE_RESULTS;
        if (tissue && tissue.nutrients) {
            inputs.tissueAvailable = true;
            var tn = tissue.nutrients;
            // Mg — stored as % DW
            if (tn.Mg != null) inputs.tissueMgPct = typeof tn.Mg === 'object' ? tn.Mg.value : tn.Mg;
            // Fe — stored as mg/kg
            if (tn.Fe != null) inputs.tissueFeMgkg = typeof tn.Fe === 'object' ? tn.Fe.value : tn.Fe;
            // Mn — stored as mg/kg
            if (tn.Mn != null) inputs.tissueMnMgkg = typeof tn.Mn === 'object' ? tn.Mn.value : tn.Mn;
            // Ca — stored as % DW
            if (tn.Ca != null) inputs.tissueCaPct = typeof tn.Ca === 'object' ? tn.Ca.value : tn.Ca;
        }

        return inputs;
    }

    /**
     * Master chemistry coupling entry point.
     * Returns combined modifier and all warnings/flags.
     */
    function chemistryCoupling(params, venueConfig) {
        var inputs = assembleChemInputs(params, venueConfig);
        var pathway = getPathway(params ? params.species : null);
        var isJuvenile = inputs.isJuvenile;

        var pathA = pathwayAModifier(inputs, pathway, isJuvenile);
        var pathB = pathwayBModifier(inputs);

        // Combined modifier — pathB unknown means we use pathA only and flag it
        var combinedModifier = pathA.modifier;
        if (pathB.unknown === false && pathB.modifier != null) {
            combinedModifier *= pathB.modifier;
        }
        combinedModifier = Math.max(0.15, Math.min(1.0, combinedModifier));

        var allWarnings = pathA.warnings.concat(pathB.warnings || []);

        return {
            modifier: combinedModifier,
            pathwayA: pathA,
            pathwayB: pathB,
            warnings: allWarnings,
            isJuvenile: isJuvenile,
            tissueAvailable: inputs.tissueAvailable,
            confidence: Math.min(pathA.confidence, pathB.unknown ? 0.3 : pathB.confidence)
        };
    }

    /* ============================================================
       COMPOSITE EUE CALCULATION
    ============================================================ */

    /**
     * Calculate composite Environmental Utilisation Efficiency.
     * 
     * @param {object} params
     * @param {string} params.species - Turf species key
     * @param {number} params.soilTempC - Root-zone temperature (°C)
     * @param {number} params.airTempC - Air/leaf temperature (°C)
     * @param {number} params.humidityPct - Relative humidity (%)
     * @param {number} params.windSpeedMs - Wind speed (m/s)
     * @param {number} [params.co2ppm] - CO₂ concentration (ppm), null if unknown
     * @param {string} [params.venueEnclosure] - Venue enclosure type
     * @param {number} [params.drainageRating] - Drainage quality 0-1
     * @param {number} [params.soilMoisturePct] - Soil moisture %
     * @param {object} [params.equipmentFeatures] - Equipment features array
     * @returns {object} EUE result
     */
    function calculate(params) {
        var pathway = getPathway(params.species);

        // Calculate VPD if we have temp and humidity
        var vpd = null;
        if (params.airTempC != null && params.humidityPct != null) {
            vpd = calculateVPD(params.airTempC, params.humidityPct);
        }

        // Check if equipment has CO₂ enrichment
        var venueEnclosure = params.venueEnclosure || 'open';
        if (params.equipmentFeatures && Array.isArray(params.equipmentFeatures)) {
            if (params.equipmentFeatures.indexOf('co2_enrichment') >= 0) {
                venueEnclosure = 'enclosed_enriched';
            }
        }

        // Chemistry coupling — reads GAIP globals, returns pathway A+B modifiers
        var chemistry = chemistryCoupling(params, params.venueConfig || null);

        // Calculate individual factors
        var factors = {
            rootZoneTemp: rootZoneTempEfficiency(params.soilTempC, pathway),
            leafTemp:     leafTempEfficiency(params.airTempC, pathway),
            vpd:          vpdEfficiency(vpd),
            airflow:      airflowEfficiency(params.windSpeedMs, venueEnclosure),
            co2:          co2Efficiency(params.co2ppm || null, venueEnclosure, params.windSpeedMs),
            rhizosphere:  rhizosphereEfficiency(params.drainageRating || null, params.soilMoisturePct || null)
        };

        // Liebig's Law: composite = minimum of all factors
        var efficiencies = [];
        var limitingFactors = [];
        var factorKeys = Object.keys(factors);

        for (var i = 0; i < factorKeys.length; i++) {
            var key = factorKeys[i];
            var factor = factors[key];
            efficiencies.push(factor.efficiency);

            if (factor.limiting) {
                limitingFactors.push({
                    factor: key,
                    efficiency: factor.efficiency,
                    severity: factor.severity,
                    value: factor.value,
                    unit: factor.unit,
                    optimalRange: factor.optimalRange
                });
            }
        }

        // Sort limiting factors by severity (worst first)
        var severityOrder = { critical: 0, significant: 1, moderate: 2, none: 3 };
        limitingFactors.sort(function(a, b) {
            return (severityOrder[a.severity] || 3) - (severityOrder[b.severity] || 3);
        });

        // Composite EUE: Liebig's minimum
        // Filter out any NaN values that might slip through from bad climate data
        var cleanEfficiencies = efficiencies.filter(function(e) { return !isNaN(e); });
        var compositeEUE = cleanEfficiencies.length > 0 
            ? Math.min.apply(null, cleanEfficiencies) 
            : 0.85;  // All NaN → no-data default

        // Apply chemistry coupling modifier (Pathway A × Pathway B)
        // Modifier represents the plant's actual capacity to convert delivered photons,
        // given root zone chemistry and photosynthetic machinery status.
        var chemModifier = chemistry.modifier;
        compositeEUE = +(compositeEUE * chemModifier).toFixed(3);
        compositeEUE = Math.max(0.05, Math.min(1.0, compositeEUE));

        // Weighted average as secondary metric (less conservative than Liebig)
        var weightedSum = 0;
        var weightTotal = 0;
        var weights = {
            rootZoneTemp: 0.25,  // Highest weight — seasonal nullifier
            leafTemp:     0.20,
            vpd:          0.25,  // Most commonly overlooked
            airflow:      0.10,
            co2:          0.10,
            rhizosphere:  0.10
        };

        for (var j = 0; j < factorKeys.length; j++) {
            var k = factorKeys[j];
            var w = weights[k] || 0.15;
            var eff = factors[k].efficiency;
            if (!isNaN(eff)) {
                weightedSum += eff * w;
                weightTotal += w;
            }
        }
        var weightedEUE = weightTotal > 0 ? weightedSum / weightTotal : 0.85;

        // Confidence: average of individual confidences
        var confSum = 0;
        for (var m = 0; m < factorKeys.length; m++) {
            confSum += factors[factorKeys[m]].confidence || 0.5;
        }
        var avgConfidence = confSum / factorKeys.length;

        // Generate advisory text
        var advisory = generateAdvisory(factors, limitingFactors, compositeEUE, pathway);

        return {
            // Primary output — use this to discount LED prescriptions
            compositeEUE: +compositeEUE.toFixed(3),
            
            // Secondary (less conservative) metric
            weightedEUE: +weightedEUE.toFixed(3),
            
            // Individual factors for progressive disclosure
            factors: factors,
            
            // What's holding performance back?
            limitingFactors: limitingFactors,
            primaryLimitingFactor: limitingFactors.length > 0 ? limitingFactors[0] : null,
            
            // Derived metrics
            effectivePPFDFraction: +compositeEUE.toFixed(2),
            wastedPhotonPct: +((1 - compositeEUE) * 100).toFixed(0),
            
            // Advisory
            advisory: advisory,
            
            // Chemistry coupling results (Pathway A + B)
            chemistry: chemistry,
            chemistryWarnings: chemistry.warnings,
            
            // Venue readiness assessment
            venueReadiness: classifyReadiness(compositeEUE, limitingFactors),
            
            // Metadata
            pathway: pathway,
            species: params.species,
            confidence: +avgConfidence.toFixed(2),
            calculatedAt: new Date().toISOString(),
            version: '1.0.0'
        };
    }

    /* ============================================================
       ADVISORY GENERATION
    ============================================================ */

    var FACTOR_LABELS = {
        rootZoneTemp: 'Root-zone temperature',
        leafTemp:     'Leaf/air temperature',
        vpd:          'VPD (moisture balance)',
        airflow:      'Airflow',
        co2:          'CO₂ concentration',
        rhizosphere:  'Rhizosphere health'
    };

    var FACTOR_REMEDIATION = {
        rootZoneTemp: {
            c4: 'C4 root-zone temp below functional range. Consider under-soil heating or delaying LED operation until soil warms above 15°C. LED photons delivered below this threshold produce minimal growth response.',
            c3: 'Root-zone temperature outside C3 optimal range. Current conditions reduce enzymatic efficiency of the Calvin cycle.'
        },
        leafTemp: {
            c4: 'Air temperature below C4 photosynthetic optimum (20–30°C). LED systems (unlike HPS) produce minimal radiant heat. Consider supplemental heating or enclosed growing environment.',
            c3: 'Air temperature outside C3 photosynthetic optimum (10–20°C). Photosynthetic rate limited by enzyme kinetics.'
        },
        vpd: {
            // Table 4 — four-band graduated messaging (grow light management reference)
            optimal:          'VPD 0.5–0.8 kPa, optimal. Stomata fully open, CO₂ flux and transpiration balanced. Maintain current conditions.',
            acceptable:       'VPD 0.8–1.5 kPa, acceptable. Mild stomatal throttling begins above 1.2 kPa; monitor closely and target return to 0.5–0.8 kPa range via irrigation or misting.',
            decliningIR:      'VPD 1.5–2.0 kPa, declining efficiency. Stomatal aperture significantly reduced. LED photon utilisation impaired. Reduce or suspend IR heater operation to limit further vapour pressure increase. Increase irrigation frequency.',
            nearClosure:      'VPD >2.0 kPa, near stomatal closure. Photosynthesis is stalling regardless of PPFD delivered. Suspend IR heating immediately. Emergency irrigation or misting required. Do not increase light hours until VPD is corrected.',
            low:              'VPD below 0.5 kPa, excessive humidity. Transpiration suppressed, disease risk elevated. Improve air circulation to raise VPD into 0.5–0.8 kPa optimal range.'
        },
        airflow: {
            low: 'Insufficient airflow (<0.3 m/s). CO₂ boundary layer builds around leaves, causing localised depletion. Photosynthesis plateaus early. Deploy fans for 0.3–1.0 m/s gentle circulation.'
        },
        co2: {
            depleted: 'CO₂ likely depleted in enclosed venue. Plant metabolic activity under LED consumes CO₂ faster than replenishment in restricted airflow conditions. Consider ventilation schedule or CO₂ supplementation.'
        },
        rhizosphere: {
            poor: 'Root-zone drainage compromised. Anaerobic conditions suppress root respiration, limiting water/nutrient uptake. Even with adequate light, downstream photosynthetic processes are bottlenecked. Verify drainage capacity matches increased irrigation demand under LED.'
        }
    };

    function generateAdvisory(factors, limitingFactors, compositeEUE, pathway) {
        if (limitingFactors.length === 0 && compositeEUE > 0.85) {
            return {
                summary: 'Environmental conditions support efficient LED utilisation.',
                level: 'good',
                actions: []
            };
        }

        var actions = [];
        for (var i = 0; i < limitingFactors.length; i++) {
            var lf = limitingFactors[i];
            var remediation = getRemediation(lf.factor, lf, pathway, factors);
            if (remediation) {
                actions.push({
                    factor: FACTOR_LABELS[lf.factor] || lf.factor,
                    severity: lf.severity,
                    current: lf.value + ' ' + (lf.unit || ''),
                    optimal: lf.optimalRange || '',
                    action: remediation,
                    efficiencyLoss: +((1 - lf.efficiency) * 100).toFixed(0) + '%'
                });
            }
        }

        var summary;
        if (compositeEUE < 0.3) {
            summary = 'Environmental conditions severely limit LED effectiveness. ' +
                      'Estimated ' + Math.round((1 - compositeEUE) * 100) + '% of delivered photons cannot be converted to growth. ' +
                      'Address environmental prerequisites before increasing light hours.';
        } else if (compositeEUE < 0.6) {
            summary = 'Significant environmental constraints reduce LED utilisation to ~' + Math.round(compositeEUE * 100) + '%. ' +
                      'Remediate limiting factors for proportional improvement in light response.';
        } else if (compositeEUE < 0.85) {
            summary = 'Moderate environmental constraints. LED utilisation estimated at ' + Math.round(compositeEUE * 100) + '%. ' +
                      'Addressing identified factors would improve return on light investment.';
        } else {
            summary = 'Environmental conditions are largely supportive. Minor optimisation opportunities identified.';
        }

        return {
            summary: summary,
            level: compositeEUE < 0.3 ? 'critical' : compositeEUE < 0.6 ? 'concern' : compositeEUE < 0.85 ? 'watch' : 'good',
            actions: actions,
            photoinhibitionRisk: (function() {
                // Flag when EUE is poor but the constraint is CO₂ or temperature, not light.
                // In this state, PPFD continues to drive electron transport while the Calvin
                // cycle is biochemically blocked — sustained delivery risks photooxidative damage.
                if (compositeEUE >= 0.5) return null;
                var nonLightLimiters = ['co2', 'rootZoneTemp', 'leafTemp'];
                var primaryIsNonLight = limitingFactors.length > 0 &&
                    nonLightLimiters.indexOf(limitingFactors[0].factor) >= 0;
                if (!primaryIsNonLight) return null;
                var primaryLabel = FACTOR_LABELS[limitingFactors[0].factor] || limitingFactors[0].factor;
                return {
                    risk: true,
                    severity: compositeEUE < 0.3 ? 'high' : 'moderate',
                    primaryConstraint: limitingFactors[0].factor,
                    message: 'Photoinhibition risk: ' + primaryLabel + ' is the primary constraint, ' +
                        'yet PPFD delivery continues. When the Calvin cycle is biochemically limited, ' +
                        'absorbed photons drive excess electron transport that cannot be quenched productively. ' +
                        'Sustained delivery at current PPFD may exceed the effective light saturation point ' +
                        'and risk photooxidative damage (reactive oxygen species accumulation). ' +
                        'Consider reducing PPFD or temporarily suspending the session until ' +
                        primaryLabel.toLowerCase() + ' is corrected.'
                };
            })()
        };
    }

    function getRemediation(factorKey, limitingFactor, pathway, allFactors) {
        var remediation = FACTOR_REMEDIATION[factorKey];
        if (!remediation) return null;

        if (factorKey === 'rootZoneTemp' || factorKey === 'leafTemp') {
            return remediation[pathway] || remediation.c4;
        }
        if (factorKey === 'vpd') {
            var vpd = allFactors.vpd ? allFactors.vpd.value : null;
            if (vpd === null || vpd === undefined) return null;
            // Four-band graduated messaging — grow light management reference, Table 4
            if (vpd < VPD_THRESHOLDS.optLow) {
                // Below 0.5 kPa
                return remediation.low;
            } else if (vpd <= 0.8) {
                // 0.5–0.8 kPa — optimal band
                return remediation.optimal;
            } else if (vpd <= 1.5) {
                // 0.8–1.5 kPa — acceptable but monitor
                return remediation.acceptable;
            } else if (vpd <= 2.0) {
                // 1.5–2.0 kPa — declining efficiency, reduce IR heater
                return remediation.decliningIR;
            } else {
                // >2.0 kPa — near closure, suspend IR heating
                return remediation.nearClosure;
            }
        }
        if (factorKey === 'airflow') return remediation.low;
        if (factorKey === 'co2') return remediation.depleted;
        if (factorKey === 'rhizosphere') return remediation.poor;

        return null;
    }

    /* ============================================================
       VENUE READINESS CLASSIFICATION
    ============================================================ */

    function classifyReadiness(compositeEUE, limitingFactors) {
        var criticalCount = 0;
        var significantCount = 0;

        for (var i = 0; i < limitingFactors.length; i++) {
            if (limitingFactors[i].severity === 'critical') criticalCount++;
            if (limitingFactors[i].severity === 'significant') significantCount++;
        }

        if (criticalCount > 0) {
            return {
                status: 'NOT_READY',
                label: 'Environmental conditions limit LED photon utilisation',
                colour: 'critical',
                recommendation: 'Address critical environmental factors before operating LED system. ' +
                               'Current conditions will waste majority of delivered light energy.',
                score: Math.round(compositeEUE * 100)
            };
        }

        if (significantCount > 0 || compositeEUE < 0.6) {
            return {
                status: 'PARTIALLY_READY',
                label: 'Environmental constraints limit LED effectiveness',
                colour: 'concern',
                recommendation: 'LED operation will produce below-specification results. ' +
                               'Remediate identified factors for improved light utilisation.',
                score: Math.round(compositeEUE * 100)
            };
        }

        if (compositeEUE < 0.85) {
            return {
                status: 'READY_WITH_NOTES',
                label: 'Environment supports LED operation with minor constraints',
                colour: 'watch',
                recommendation: 'LED system can operate effectively. Minor environmental optimisations available.',
                score: Math.round(compositeEUE * 100)
            };
        }

        return {
            status: 'READY',
            label: 'Environment fully supports LED operation',
            colour: 'good',
            recommendation: 'All environmental co-factors within functional range. ' +
                           'LED system expected to deliver specified performance.',
            score: Math.round(compositeEUE * 100)
        };
    }

    /* ============================================================
       CONVENIENCE: EXTRACT PARAMS FROM CLIMATE METRICS
       Bridges climate-engine.js output to EUE input
    ============================================================ */

    /**
     * Build EUE params from climate metrics (from calculateClimateMetrics)
     * and hub state.
     * 
     * @param {object} climateMetrics - Output of calculateClimateMetrics()
     * @param {object} state - Hub state object
     * @param {object} [venueConfig] - Optional stadium venue config
     * @returns {object} params suitable for calculate()
     */
    function fromClimateMetrics(climateMetrics, state, venueConfig) {
        var params = {
            species: null,
            soilTempC: null,
            airTempC: null,
            humidityPct: null,
            windSpeedMs: null,
            co2ppm: null,
            venueEnclosure: 'open',
            drainageRating: null,
            soilMoisturePct: null,
            equipmentFeatures: null
        };

        // Species from state
        if (state && state.turf) {
            params.species = state.turf.species || state.turf.effectiveSpecies || 'couch';
        }

        if (climateMetrics) {
            // Air temperature — use today's mean if available, else period mean
            if (climateMetrics.temperature) {
                params.airTempC = climateMetrics.temperature.todayMean != null
                    ? climateMetrics.temperature.todayMean
                    : climateMetrics.temperature.mean;

                // Soil temperature
                if (climateMetrics.temperature.soil && climateMetrics.temperature.soil.mean != null) {
                    params.soilTempC = climateMetrics.temperature.soil.mean;
                }
            }

            // Humidity
            if (climateMetrics.moisture && climateMetrics.moisture.humidity) {
                params.humidityPct = climateMetrics.moisture.humidity.mean;
            }

            // Wind — climate data provides 10m reference height (standard met station).
            // EUE airflow thresholds are for canopy-level airflow (~3cm for mown turf).
            // Apply log wind profile correction: u(canopy) ≈ u(10m) × 0.28
            // In enclosed/retractable stadiums, shelter further reduces wind.
            if (climateMetrics.wind && climateMetrics.wind.mean != null) {
                var heightCorrectionFactor = 0.28;  // ln(0.03/0.003) / ln(10/0.003)
                params.windSpeedMs = climateMetrics.wind.mean * heightCorrectionFactor;
            }

            // Soil moisture (as percentage)
            if (climateMetrics.moisture && climateMetrics.moisture.soilMoisture) {
                params.soilMoisturePct = climateMetrics.moisture.soilMoisture.percentFC;
            }
        }

        // Venue configuration
        if (venueConfig) {
            params.venueEnclosure = venueConfig.enclosureType || venueConfig.roofType || 'open';
            params.drainageRating = venueConfig.drainageRating || null;

            // Equipment features
            if (venueConfig.equipment && Array.isArray(venueConfig.equipment)) {
                var allFeatures = [];
                for (var i = 0; i < venueConfig.equipment.length; i++) {
                    var eq = venueConfig.equipment[i];
                    if (eq.features && Array.isArray(eq.features)) {
                        allFeatures = allFeatures.concat(eq.features);
                    }
                }
                params.equipmentFeatures = allFeatures;
            }
        }

        return params;
    }

    /* ============================================================
       DLI-BY-HOC MATRIX
       
       DLI requirements vary significantly with mowing height.
       Lower HOC = less leaf area = higher DLI requirement per unit.
       
       Source: "Lawn Growth Under Artificial Light" Section 14
       Additional: Bunnell et al. 2005, Wherley & Chen (USGA 2019)
    ============================================================ */

    /**
     * DLI requirements by species group and mowing height.
     * Structure: { maintenance: [min, max], strengthening: [min, max] }
     * 
     * 'maintenance' = sustain current quality
     * 'strengthening' = build density/recovery/competition readiness
     */
    var DLI_BY_HOC = {
        // Tifton / bermuda / couch (C4)
        c4: [
            { label: 'Ultra-low (10–12mm)', hocMin: 10, hocMax: 12,
              maintenance: [22, 26], strengthening: [28, 32] },
            { label: 'Match (13–17mm)', hocMin: 13, hocMax: 17,
              maintenance: [18, 22], strengthening: [22, 28] },
            { label: 'Maintenance (18–20mm)', hocMin: 18, hocMax: 20,
              maintenance: [16, 20], strengthening: [20, 25] },
            { label: 'Standard (21–30mm)', hocMin: 21, hocMax: 30,
              maintenance: [14, 18], strengthening: [18, 22] },
            { label: 'High (31–50mm)', hocMin: 31, hocMax: 50,
              maintenance: [12, 16], strengthening: [16, 20] }
        ],
        // Ryegrass / C3 cool-season
        c3: [
            { label: 'Low (15–19mm)', hocMin: 15, hocMax: 19,
              maintenance: [14, 17], strengthening: [20, 24] },
            { label: 'Match (20–25mm)', hocMin: 20, hocMax: 25,
              maintenance: [12, 13], strengthening: [18, 20] },
            { label: 'Maintenance (26–30mm)', hocMin: 26, hocMax: 30,
              maintenance: [10, 12], strengthening: [14, 16] },
            { label: 'High (31–45mm)', hocMin: 31, hocMax: 45,
              maintenance: [8, 10], strengthening: [12, 14] }
        ]
    };

    /**
     * Get DLI requirement for a given species and mowing height.
     * 
     * @param {string} speciesKey - Species identifier
     * @param {number} hocMM - Height of cut in mm
     * @param {string} [goal] - 'maintenance' or 'strengthening'
     * @returns {object} DLI requirement with range and label
     */
    function getDLIForHOC(speciesKey, hocMM, goal) {
        var pathway = getPathway(speciesKey);
        var bands = DLI_BY_HOC[pathway];
        goal = goal || 'maintenance';

        if (!hocMM || hocMM <= 0) {
            // No HOC specified — return middle band
            var mid = Math.floor(bands.length / 2);
            var midBand = bands[mid];
            var range = midBand[goal];
            return {
                min: range[0],
                max: range[1],
                midpoint: (range[0] + range[1]) / 2,
                band: midBand.label,
                source: 'default_band',
                hocProvided: false
            };
        }

        // Find matching band
        for (var i = 0; i < bands.length; i++) {
            if (hocMM >= bands[i].hocMin && hocMM <= bands[i].hocMax) {
                var range = bands[i][goal];
                return {
                    min: range[0],
                    max: range[1],
                    midpoint: (range[0] + range[1]) / 2,
                    band: bands[i].label,
                    source: 'hoc_matched',
                    hocProvided: true
                };
            }
        }

        // HOC outside defined bands — extrapolate from nearest
        if (hocMM < bands[0].hocMin) {
            // Below lowest band — extrapolate upward
            var lowest = bands[0][goal];
            var extrapolated = [lowest[0] + 2, lowest[1] + 2]; // +2 mol for sub-minimum HOC
            return {
                min: extrapolated[0],
                max: extrapolated[1],
                midpoint: (extrapolated[0] + extrapolated[1]) / 2,
                band: 'Below minimum (' + hocMM + 'mm)',
                source: 'extrapolated',
                hocProvided: true,
                warning: 'HOC below documented range. DLI requirement extrapolated, verify with local trial data.'
            };
        }

        // Above highest band
        var highest = bands[bands.length - 1][goal];
        return {
            min: Math.max(6, highest[0] - 2),
            max: highest[1] - 2,
            midpoint: (Math.max(6, highest[0] - 2) + highest[1] - 2) / 2,
            band: 'Above standard (' + hocMM + 'mm)',
            source: 'extrapolated',
            hocProvided: true
        };
    }

    /* ============================================================
       SPECTRAL PRESCRIPTION
       
       Species-specific LED spectrum recommendations.
       Source: Doc1 (PPFD350 Japanese Optimized Spectrum)
              LED Wavelengths Turf Performance presentation
    ============================================================ */

    /**
     * Spectral prescriptions by species group and management goal.
     * Percentages = proportion of total LED output in each waveband.
     */
    var SPECTRAL_PRESCRIPTIONS = {
        // C4 (Tifton/bermuda/couch) — higher blue tolerance, need dense growth
        c4: {
            standard: {
                label: 'Standard C4 growth',
                red660: 60, blue450: 25, green520: 10, farRed730: 5,
                notes: 'Balanced ratio for C4. Higher blue than SGL spec to maintain density and cell wall strength in Japanese/Australian conditions.'
            },
            recovery: {
                label: 'Post-event recovery',
                red660: 70, blue450: 20, green520: 8, farRed730: 2,
                notes: 'Red-dominant for maximum biomass recovery. Minimise far-red to avoid shade escape elongation during stress recovery.'
            },
            establishment: {
                label: 'Establishment / renovation',
                red660: 50, blue450: 35, green520: 12, farRed730: 3,
                notes: 'High blue for root mass development, stolon/rhizome density, and compact habit during establishment.'
            },
            winterSurvival: {
                label: 'Winter survival / TNC accumulation',
                red660: 80, blue450: 12, green520: 5, farRed730: 3,
                notes: 'Maximum photosynthetic efficiency per watt. Prioritise carbohydrate storage over structural growth. Similar to SGL cold-climate approach.'
            }
        },
        // C3 (Ryegrass/fescue/bent) — efficient at lower PPFD, different blue:red balance
        c3: {
            standard: {
                label: 'Standard C3 growth',
                red660: 50, blue450: 30, green520: 15, farRed730: 5,
                notes: 'C3 has high photosynthetic efficiency in blue light. Higher green proportion supports lower leaf layers in dense sward.'
            },
            recovery: {
                label: 'Post-event recovery',
                red660: 65, blue450: 22, green520: 10, farRed730: 3,
                notes: 'Red-dominant for biomass accumulation. Maintain some blue for structural integrity.'
            },
            establishment: {
                label: 'Establishment / overseeding',
                red660: 45, blue450: 35, green520: 15, farRed730: 5,
                notes: 'High blue for tiller density and compact habit. 5% far-red can accelerate germination.'
            },
            density: {
                label: 'Density maintenance',
                red660: 50, blue450: 30, green520: 18, farRed730: 2,
                notes: 'Elevated green light penetrates upper leaf canopy to support lower leaves. Maintains layer structure and prevents thinning at base.'
            }
        }
    };

    /**
     * Get spectral prescription for species and management goal.
     * 
     * @param {string} speciesKey - Species identifier
     * @param {string} [goal] - Management goal: standard, recovery, establishment, winterSurvival, density
     * @param {object} [equipment] - Equipment spec with features array
     * @returns {object} Spectral prescription or null if equipment doesn't support it
     */
    function getSpectralPrescription(speciesKey, goal, equipment, environment, c3Fraction) {
        var pathway = getPathway(speciesKey);
        goal = goal || 'standard';

        var prescriptions = SPECTRAL_PRESCRIPTIONS[pathway];
        if (!prescriptions) return null;

        var prescription = prescriptions[goal] || prescriptions.standard;

        // Overseed blend — when c3Fraction is in transition range (0.1–0.9),
        // interpolate between C4 and C3 standard prescriptions.
        // Below 0.1: pure C4. Above 0.9: pure C3. Between: weighted blend.
        var blendNote = null;
        if (typeof c3Fraction === 'number' && c3Fraction > 0.1 && c3Fraction < 0.9) {
            var c4Pres = (SPECTRAL_PRESCRIPTIONS.c4[goal] || SPECTRAL_PRESCRIPTIONS.c4.standard);
            var c3Pres = (SPECTRAL_PRESCRIPTIONS.c3[goal] || SPECTRAL_PRESCRIPTIONS.c3.standard);
            var c3w = c3Fraction;
            var c4w = 1 - c3Fraction;
            prescription = {
                label: 'Blended C4/C3 (overseed transition)',
                red660:    Math.round(c4w * c4Pres.red660    + c3w * c3Pres.red660),
                blue450:   Math.round(c4w * c4Pres.blue450   + c3w * c3Pres.blue450),
                green520:  Math.round(c4w * c4Pres.green520  + c3w * c3Pres.green520),
                farRed730: Math.round(c4w * c4Pres.farRed730 + c3w * c3Pres.farRed730),
                notes: 'Blended spectrum for mixed C4/C3 stand (' +
                       Math.round(c3Fraction * 100) + '% C3 ryegrass, ' +
                       Math.round((1 - c3Fraction) * 100) + '% C4 base). ' +
                       'Weighted interpolation between C4 (' + c4Pres.red660 + 'R/' +
                       c4Pres.blue450 + 'B) and C3 (' + c3Pres.red660 + 'R/' +
                       c3Pres.blue450 + 'B) targets.'
            };
            blendNote = Math.round(c3Fraction * 100) + '% ryegrass dominant, spectrum blended toward C3 requirements.';
        }

        // Start with base prescription values
        var adjusted = {
            red660: prescription.red660,
            blue450: prescription.blue450,
            green520: prescription.green520,
            farRed730: prescription.farRed730
        };

        // Seasonal / environmental adjustment
        var seasonalNote = null;
        var adjustmentApplied = false;

        if (environment && typeof environment.airTempC === 'number') {
            var temp = environment.airTempC;
            var isC3 = (pathway === 'c3');

            // Cold stress — shift towards red for max photosynthetic efficiency per photon
            // C3: below 12°C, C4: below 18°C
            var coldThreshold = isC3 ? 12 : 18;
            if (temp < coldThreshold) {
                // Scale adjustment: stronger as it gets colder
                // At threshold: 0% shift. At 0°C (C3) or 8°C (C4): full shift
                var coldFloor = isC3 ? 0 : 8;
                var coldFactor = Math.min(1, Math.max(0, (coldThreshold - temp) / (coldThreshold - coldFloor)));
                // Shift: +10 red, -5 blue, -3 green, -2 far-red (at full factor)
                adjusted.red660  += Math.round(10 * coldFactor);
                adjusted.blue450 -= Math.round(5 * coldFactor);
                adjusted.green520 -= Math.round(3 * coldFactor);
                adjusted.farRed730 -= Math.round(2 * coldFactor);
                if (coldFactor > 0.2) {
                    seasonalNote = 'Cold-adjusted (' + Math.round(temp) + '°C): increased red proportion for maximum photosynthetic efficiency at low metabolic rates.';
                    adjustmentApplied = true;
                }
            }

            // Heat stress — increase blue for stomatal regulation
            // C3: above 28°C, C4: above 38°C
            var heatThreshold = isC3 ? 28 : 38;
            var heatCeiling = isC3 ? 38 : 45;
            if (temp > heatThreshold) {
                var heatFactor = Math.min(1, Math.max(0, (temp - heatThreshold) / (heatCeiling - heatThreshold)));
                // Shift: +8 blue, -5 red, -2 green, -1 far-red
                adjusted.blue450 += Math.round(8 * heatFactor);
                adjusted.red660  -= Math.round(5 * heatFactor);
                adjusted.green520 -= Math.round(2 * heatFactor);
                adjusted.farRed730 -= Math.round(1 * heatFactor);
                if (heatFactor > 0.2) {
                    seasonalNote = 'Heat-adjusted (' + Math.round(temp) + '°C): increased blue for stomatal regulation and cell wall integrity under thermal stress.';
                    adjustmentApplied = true;
                }
            }
        }

        // Low light adjustment — maximise efficiency, suppress elongation
        if (environment && typeof environment.dliMol === 'number') {
            var dli = environment.dliMol;
            if (dli < 15 && dli > 0) {
                var lowLightFactor = Math.min(1, Math.max(0, (15 - dli) / 10));
                // Reduce far-red to prevent shade-escape elongation
                adjusted.farRed730 -= Math.round(2 * lowLightFactor);
                adjusted.red660 += Math.round(2 * lowLightFactor);
                if (lowLightFactor > 0.3 && !adjustmentApplied) {
                    seasonalNote = 'Low-light adjusted (DLI ' + dli.toFixed(1) + ' mol/m\u00b2/day): reduced far-red to suppress elongation, increased red efficiency.';
                    adjustmentApplied = true;
                } else if (lowLightFactor > 0.3 && seasonalNote) {
                    seasonalNote += ' Also reduced far-red for low-light conditions.';
                }
            }
        }

        // Overnight / low natural light session — increase blue fraction (Lauria et al. 2024)
        // When artificial light is the dominant or sole source, higher blue promotes
        // compact growth, stomatal regulation, and chlorophyll synthesis.
        var overnightBlueNote = null;
        if (environment && environment.isDaytimeSession === false) {
            adjusted.blue450  += 8;
            adjusted.red660   -= 5;
            adjusted.green520 -= 2;
            adjusted.farRed730 -= 1;
            overnightBlueNote = 'Overnight session detected (artificial light dominant): blue fraction ' +
                'increased by ~8pp. Blue light requirement is elevated when solar contribution is ' +
                'absent or negligible, supporting stomatal aperture, chloroplast movement, and ' +
                'stem compactness (Lauria et al. 2024).';
        }

        // Clamp all values to sane range and re-normalise to 100%
        adjusted.red660 = Math.max(5, adjusted.red660);
        adjusted.blue450 = Math.max(5, adjusted.blue450);
        adjusted.green520 = Math.max(2, adjusted.green520);
        adjusted.farRed730 = Math.max(0, adjusted.farRed730);

        var total = adjusted.red660 + adjusted.blue450 + adjusted.green520 + adjusted.farRed730;
        if (total > 0 && total !== 100) {
            var scale = 100 / total;
            adjusted.red660 = Math.round(adjusted.red660 * scale);
            adjusted.blue450 = Math.round(adjusted.blue450 * scale);
            adjusted.green520 = Math.round(adjusted.green520 * scale);
            adjusted.farRed730 = 100 - adjusted.red660 - adjusted.blue450 - adjusted.green520;
        }

        // Check if equipment supports multi-channel
        var multiChannel = false;
        var channelNote = '';
        if (equipment && equipment.features && Array.isArray(equipment.features)) {
            var features = equipment.features;
            if (features.indexOf('dls_4channel') >= 0 ||
                features.indexOf('cls_full_spectrum') >= 0) {
                multiChannel = true;
            }
        }

        if (equipment && !multiChannel) {
            channelNote = 'Equipment uses fixed spectrum (' + (equipment.spectrum || 'unknown') + '). ' +
                         'Spectral prescription shown for reference, adjustable only on multi-channel systems.';
        }

        // Phytochrome guidance (from adjusted values)
        var redFarRedRatio = adjusted.red660 / Math.max(1, adjusted.farRed730);
        var phytochromeNote = '';
        if (redFarRedRatio > 4) {
            phytochromeNote = 'Red:far-red ratio ' + redFarRedRatio.toFixed(1) + ':1, promotes compact, wear-tolerant sward (high Pfr form).';
        } else {
            phytochromeNote = 'Red:far-red ratio ' + redFarRedRatio.toFixed(1) + ':1, moderate shade response stimulation. Monitor for elongation.';
        }

        // Build label
        var label = prescription.label;
        if (adjustmentApplied) {
            label += ' (seasonally adjusted)';
        }

        return {
            spectrum: adjusted,
            label: label,
            notes: prescription.notes,
            seasonalNote: seasonalNote,
            pathway: pathway,
            goal: goal,
            adjustmentApplied: adjustmentApplied,
            baseSpectrum: {
                red660: prescription.red660,
                blue450: prescription.blue450,
                green520: prescription.green520,
                farRed730: prescription.farRed730
            },
            redFarRedRatio: +redFarRedRatio.toFixed(1),
            phytochromeNote: phytochromeNote,
            multiChannelRequired: true,
            equipmentCapable: multiChannel,
            equipmentNote: channelNote,
            blendNote: blendNote,
            isOverseedBlend: blendNote !== null,
            c3Fraction: (typeof c3Fraction === 'number') ? c3Fraction : null,
            maxFarRedWarning: adjusted.farRed730 > 15 ? 'Far-red exceeds 15% safety limit' : null,
            overnightBlueNote: overnightBlueNote,
            isDaytimeSession: (environment && typeof environment.isDaytimeSession === 'boolean')
                ? environment.isDaytimeSession : null
        };
    }

    /* ============================================================
       EXPORTS
    ============================================================ */

    global.GSSH_EUE = {
        // Core calculation
        calculate: calculate,
        calculateVPD: calculateVPD,
        
        // DLI-by-HOC
        getDLIForHOC: getDLIForHOC,
        DLI_BY_HOC: DLI_BY_HOC,
        
        // Spectral prescriptions
        // Chemistry coupling
        chemistryCoupling: chemistryCoupling,
        assembleChemInputs: assembleChemInputs,
        
        getSpectralPrescription: getSpectralPrescription,
        SPECTRAL_PRESCRIPTIONS: SPECTRAL_PRESCRIPTIONS,
        
        // Bridge from climate engine
        fromClimateMetrics: fromClimateMetrics,
        
        // Individual factor functions (for testing)
        rootZoneTempEfficiency: rootZoneTempEfficiency,
        leafTempEfficiency: leafTempEfficiency,
        vpdEfficiency: vpdEfficiency,
        airflowEfficiency: airflowEfficiency,
        co2Efficiency: co2Efficiency,
        rhizosphereEfficiency: rhizosphereEfficiency,
        
        // Constants
        ROOT_ZONE_TEMP: ROOT_ZONE_TEMP,
        LEAF_TEMP: LEAF_TEMP,
        VPD_THRESHOLDS: VPD_THRESHOLDS,
        AIRFLOW_THRESHOLDS: AIRFLOW_THRESHOLDS,
        CO2_THRESHOLDS: CO2_THRESHOLDS,
        
        // Utilities
        getPathway: getPathway,
        classifyReadiness: classifyReadiness,
        FACTOR_LABELS: FACTOR_LABELS,
        
        // Version
        version: '1.0.0'
    };

})(typeof window !== 'undefined' ? window : this);
