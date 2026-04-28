/**
 * ============================================================================
 * AUSTRALIAN VARIETY TRAITS DATABASE v1.0.0
 * ============================================================================
 * 
 * Region-aware wrapper around GAIP VARIETY_TRAITS data.
 * Prioritises Australian trial data (HAL, DPI, state research stations)
 * over US NTEP data when both exist for the same variety.
 * 
 * DATA SOURCES (by priority):
 *   1. Australian field trials (HAL TU04013, DPI, Keysborough GC, QSAC)
 *   2. NTEP data from climate-matched US locations
 *   3. Supplier specifications (PGG Wrightson, Barenbrug, Lawn Solutions)
 * 
 * SPECIES COVERED:
 *   - Couch/Bermuda (Cynodon dactylon) — primary warm-season turf
 *   - Kikuyu (Pennisetum clandestinum) — sports turf, fairways
 *   - Buffalo/St. Augustine (Stenotaphrum secundatum) — lawns, shade
 *   - Zoysia (Zoysia japonica/matrella) — emerging market
 *   - Perennial Ryegrass (Lolium perenne) — overseed, cool-season sports
 *   - Tall Fescue (Festuca arundinacea) — warm-dry adapted C3
 *   - Bentgrass (Agrostis stolonifera/capillaris) — greens, fine turf
 *   - Kentucky Bluegrass (Poa pratensis) — cool-season blends
 * 
 * CLIMATE ZONES:
 *   - au_subtropical: Brisbane, Gold Coast, Northern NSW
 *   - au_temperate: Sydney, Melbourne, Canberra, Hobart
 *   - au_mediterranean: Perth, Adelaide
 *   - au_tropical: Darwin, Cairns, Townsville
 * 
 * @author Gilba Solutions
 * @version 1.0.0
 */

(function(global) {
    'use strict';


    // ═══════════════════════════════════════════════════════════════════════════
    // AU REGION PRIORITY ORDERS
    // When looking up traits, try AU-specific data first, then fall back to NTEP
    // ═══════════════════════════════════════════════════════════════════════════

    var AU_REGION_PRIORITY = {
        // For subtropical locations (Brisbane, Gold Coast)
        subtropical: [
            'subtropical_au', 'subtropical', 'subtropical_ntep',
            'temperate_au', 'temperate_ntep', 'ntep_us'
        ],
        // For temperate locations (Sydney, Melbourne, Canberra)
        temperate: [
            'temperate_au', 'au_temperate', 'temperate', 'temperate_ntep',
            'subtropical_au', 'cold_ntep', 'ntep_us'
        ],
        // For mediterranean locations (Perth, Adelaide)
        mediterranean: [
            'mediterranean_au', 'temperate_au', 'au_temperate',
            'subtropical_au', 'temperate_ntep', 'ntep_us'
        ],
        // For tropical locations (Darwin, Cairns)
        tropical: [
            'subtropical_au', 'subtropical', 'subtropical_ntep',
            'temperate_au', 'ntep_us'
        ],
        // Default fallback
        default: [
            'temperate_au', 'au_temperate', 'subtropical_au',
            'temperate_ntep', 'subtropical_ntep', 'cold_ntep', 'ntep_us',
            'subtropical', 'temperate', 'cold'
        ]
    };

    // ═══════════════════════════════════════════════════════════════════════════
    // CLIMATE ZONE DETECTION
    // ═══════════════════════════════════════════════════════════════════════════

    function detectAUClimateZone(lat, lon) {
        if (!lat || !lon) return 'default';
        var absLat = Math.abs(lat);

        // Tropical: north of ~20°S
        if (absLat < 20) return 'tropical';

        // Subtropical: ~20-30°S, east coast
        if (absLat < 30 && lon > 145) return 'subtropical';

        // Mediterranean: WA (west of 130°E) or SA (134-140°E, below 30°S)
        if (lon < 130) return 'mediterranean';
        if (lon >= 134 && lon <= 140 && absLat > 30) return 'mediterranean';

        // Temperate: everything else south of 30°S
        if (absLat >= 30) return 'temperate';

        return 'default';
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // VARIETY LOOKUP HELPERS
    // ═══════════════════════════════════════════════════════════════════════════

    function getVARIETY_TRAITS() {
        return global.GAIP_VARIETY_TRAITS || global.VARIETY_TRAITS || null;
    }

    function normalizeSpecies(species) {
        if (!species) return '';
        // Use SpeciesController if available
        if (global.SpeciesController && typeof global.SpeciesController.normalizeKey === 'function') {
            return global.SpeciesController.normalizeKey(species);
        }
        var s = species.toLowerCase().replace(/\s+/g, '');
        var map = {
            'couch': 'bermuda', 'bermudagrass': 'bermuda', 'cynodon': 'bermuda',
            'buffalo': 'buffalo', 'staugustine': 'buffalo', 'stenotaphrum': 'buffalo',
            'perennialryegrass': 'perennialRyegrass', 'prg': 'perennialRyegrass',
            'ryegrass': 'perennialRyegrass',
            'tallfescue': 'tallFescue', 'fescue': 'fineFescue', 'finefescue': 'fineFescue', 'chewings': 'fineFescue', 'chewingsfescue': 'fineFescue',
            'bentgrass': 'bentgrass', 'creepingbent': 'bentgrass',
            'browntopbent': 'browntopBent', 'browntop': 'browntopBent',
            'kentuckybluegrass': 'kentuckyBluegrass', 'kbg': 'kentuckyBluegrass',
            'kikuyu': 'kikuyu', 'pennisetum': 'kikuyu',
            'zoysia': 'zoysia', 'zoysiagrass': 'zoysia'
        };
        return map[s] || species;
    }

    function getVarietyData(species, variety) {
        var db = getVARIETY_TRAITS();
        if (!db) return null;
        var speciesKey = normalizeSpecies(species);
        var speciesData = db[speciesKey] || db[species];
        if (!speciesData) return null;
        return speciesData[variety] || null;
    }

    function getRegionOrder(climateZone) {
        return AU_REGION_PRIORITY[climateZone] || AU_REGION_PRIORITY['default'];
    }

    function getCurrentAUClimateZone() {
        var lat = parseFloat((document.querySelector('.gaip-lat') || {}).value);
        var lon = parseFloat((document.querySelector('.gaip-lon') || {}).value);
        if (!isNaN(lat) && !isNaN(lon)) {
            return detectAUClimateZone(lat, lon);
        }
        return 'default';
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // TRAIT GETTERS — AU-prioritised
    // ═══════════════════════════════════════════════════════════════════════════

    /**
     * Get wear modifier with AU region priority
     */
    function getAUWearModifier(species, variety) {
        var data = getVarietyData(species, variety);
        if (!data) return { multiplier: 1.0, confidence: 'none', source: 'No AU data', region: 'australia' };

        // Check flat traits first
        if (data.traits && data.traits.wear) {
            return {
                multiplier: data.traits.wear.multiplier || 1.0,
                confidence: data.traits.wear.confidence || 'medium',
                source: data.traits.wear.source || 'AU variety data',
                recoveryMultiplier: (data.traits.recovery && data.traits.recovery.rateMultiplier) || 
                                    (data.traits.recovery && data.traits.recovery.multiplier) || 1.0,
                region: 'australia',
                _auClimateZone: getCurrentAUClimateZone()
            };
        }

        // Check regionalTraits with AU priority
        if (data.regionalTraits) {
            var zones = getRegionOrder(getCurrentAUClimateZone());
            for (var i = 0; i < zones.length; i++) {
                var regionData = data.regionalTraits[zones[i]];
                if (regionData && regionData.traits && regionData.traits.wear) {
                    return {
                        multiplier: regionData.traits.wear.multiplier || 1.0,
                        confidence: regionData.traits.wear.confidence || 'medium',
                        source: regionData.traits.wear.source || 'AU region data',
                        recoveryMultiplier: (regionData.traits.recovery && regionData.traits.recovery.rateMultiplier) || 1.0,
                        region: 'australia',
                        _auClimateZone: getCurrentAUClimateZone(),
                        _dataRegion: zones[i]
                    };
                }
            }
        }

        return { multiplier: 1.0, confidence: 'none', source: 'No AU wear data', region: 'australia' };
    }

    /**
     * Get disease modifier with AU region priority
     */
    function getAUDiseaseModifier(species, variety, disease) {
        var data = getVarietyData(species, variety);
        if (!data) return { riskMultiplier: 1.0, confidence: 'none', source: 'No AU data', region: 'australia' };

        // Check flat traits
        if (data.traits && data.traits.disease && data.traits.disease[disease]) {
            return {
                riskMultiplier: data.traits.disease[disease].riskMultiplier || 1.0,
                confidence: data.traits.disease[disease].confidence || 'medium',
                source: data.traits.disease[disease].source || 'AU variety data',
                region: 'australia'
            };
        }

        // Check regionalTraits with AU priority
        if (data.regionalTraits) {
            var zones = getRegionOrder(getCurrentAUClimateZone());
            for (var i = 0; i < zones.length; i++) {
                var regionData = data.regionalTraits[zones[i]];
                if (regionData && regionData.traits && regionData.traits.disease && regionData.traits.disease[disease]) {
                    return {
                        riskMultiplier: regionData.traits.disease[disease].riskMultiplier || 1.0,
                        confidence: regionData.traits.disease[disease].confidence || 'medium',
                        source: regionData.traits.disease[disease].source || 'AU region data',
                        region: 'australia',
                        _dataRegion: zones[i]
                    };
                }
            }
        }

        return { riskMultiplier: 1.0, confidence: 'none', source: 'No AU disease data for ' + disease, region: 'australia' };
    }

    /**
     * Get water use modifier with AU data priority
     */
    function getAUWaterUseModifier(species, variety) {
        var data = getVarietyData(species, variety);
        if (!data) return { multiplier: 1.0, confidence: 'none', source: 'No AU data', region: 'australia' };

        // Check flat traits - accept both 'waterUse' and 'water' keys
        var waterTrait = (data.traits && data.traits.waterUse) || (data.traits && data.traits.water);
        if (waterTrait) {
            return {
                multiplier: waterTrait.multiplier || 1.0,
                confidence: waterTrait.confidence || 'medium',
                source: waterTrait.source || 'AU variety data',
                region: 'australia'
            };
        }

        // Check regionalTraits
        if (data.regionalTraits) {
            var zones = getRegionOrder(getCurrentAUClimateZone());
            for (var i = 0; i < zones.length; i++) {
                var regionData = data.regionalTraits[zones[i]];
                if (regionData && regionData.traits) {
                    var rWater = regionData.traits.waterUse || regionData.traits.water;
                    if (rWater) {
                        return {
                            multiplier: rWater.multiplier || 1.0,
                            confidence: rWater.confidence || 'medium',
                            source: rWater.source || 'AU region data',
                            region: 'australia',
                            _dataRegion: zones[i]
                        };
                    }
                }
            }
        }

        return { multiplier: 1.0, confidence: 'none', source: 'No AU water use data', region: 'australia' };
    }

    /**
     * Get cold tolerance modifier
     */
    function getAUColdModifier(species, variety) {
        var data = getVarietyData(species, variety);
        if (!data) return { dormancyThresholdModifier: 1.0, winterkillRisk: 1.0, confidence: 'none', source: 'No AU data', region: 'australia' };

        if (data.traits && data.traits.cold) {
            return {
                dormancyThresholdModifier: data.traits.cold.dormancyThresholdModifier || 1.0,
                winterkillRisk: data.traits.cold.winterkillRisk || 1.0,
                winterHardiness: data.traits.cold.winterHardiness || 1.0,
                confidence: data.traits.cold.confidence || 'medium',
                source: data.traits.cold.source || 'AU variety data',
                region: 'australia'
            };
        }

        // Check regionalTraits with AU priority fallback
        if (data.regionalTraits) {
            var zones = getRegionOrder(getCurrentAUClimateZone());
            for (var i = 0; i < zones.length; i++) {
                var regionData = data.regionalTraits[zones[i]];
                if (regionData && regionData.traits && regionData.traits.cold) {
                    return {
                        dormancyThresholdModifier: regionData.traits.cold.dormancyThresholdModifier || 1.0,
                        winterkillRisk: regionData.traits.cold.winterkillRisk || 1.0,
                        winterHardiness: regionData.traits.cold.winterHardiness || 1.0,
                        confidence: regionData.traits.cold.confidence || 'medium',
                        source: regionData.traits.cold.source || 'NTEP region data',
                        region: 'australia',
                        _dataRegion: zones[i]
                    };
                }
            }
        }

        return { dormancyThresholdModifier: 1.0, winterkillRisk: 1.0, confidence: 'none', source: 'No AU cold data', region: 'australia' };
    }

    /**
     * Get heat/drought modifier — particularly relevant for AU
     */
    function getAUHeatDroughtModifier(species, variety) {
        var data = getVarietyData(species, variety);
        if (!data) return { multiplier: 1.0, confidence: 'none', source: 'No AU data', region: 'australia' };

        if (data.traits && data.traits.heatDrought) {
            return {
                multiplier: data.traits.heatDrought.multiplier || 1.0,
                confidence: data.traits.heatDrought.confidence || 'medium',
                source: data.traits.heatDrought.source || 'AU variety data',
                region: 'australia'
            };
        }

        // Check regionalTraits
        if (data.regionalTraits) {
            var zones = getRegionOrder(getCurrentAUClimateZone());
            for (var i = 0; i < zones.length; i++) {
                var regionData = data.regionalTraits[zones[i]];
                if (regionData && regionData.traits && regionData.traits.heatDrought) {
                    return {
                        multiplier: regionData.traits.heatDrought.multiplier || 1.0,
                        confidence: regionData.traits.heatDrought.confidence || 'medium',
                        source: regionData.traits.heatDrought.source || 'AU region data',
                        region: 'australia',
                        _dataRegion: zones[i]
                    };
                }
            }
        }

        return { multiplier: 1.0, confidence: 'none', source: 'No AU heat/drought data', region: 'australia' };
    }

    /**
     * Get shade modifier
     */
    function getAUShadeModifier(species, variety) {
        var data = getVarietyData(species, variety);
        if (!data) return { thresholdModifier: 1.0, confidence: 'none', source: 'No AU data', region: 'australia' };

        if (data.traits && data.traits.shade) {
            return {
                thresholdModifier: data.traits.shade.thresholdModifier || 1.0,
                confidence: data.traits.shade.confidence || 'medium',
                source: data.traits.shade.source || 'AU variety data',
                region: 'australia'
            };
        }

        // Check regionalTraits with AU priority fallback
        if (data.regionalTraits) {
            var zones = getRegionOrder(getCurrentAUClimateZone());
            for (var i = 0; i < zones.length; i++) {
                var regionData = data.regionalTraits[zones[i]];
                if (regionData && regionData.traits && regionData.traits.shade) {
                    return {
                        thresholdModifier: regionData.traits.shade.thresholdModifier || 1.0,
                        confidence: regionData.traits.shade.confidence || 'medium',
                        source: regionData.traits.shade.source || 'NTEP region data',
                        region: 'australia',
                        _dataRegion: zones[i]
                    };
                }
            }
        }

        return { thresholdModifier: 1.0, confidence: 'none', source: 'No AU shade data', region: 'australia' };
    }

    /**
     * Get full variety traits object
     */
    function getAUVarietyTraits(species, variety) {
        return getVarietyData(species, variety);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // EXPORTS
    // ═══════════════════════════════════════════════════════════════════════════

    global.GAIP_AU_VARIETY_TRAITS = {
        version: '1.0.1',
        regionPriority: AU_REGION_PRIORITY,
        detectClimateZone: detectAUClimateZone
    };

    global.gaip_getAUWearModifier = getAUWearModifier;
    global.gaip_getAUDiseaseModifier = getAUDiseaseModifier;
    global.gaip_getAUWaterUseModifier = getAUWaterUseModifier;
    global.gaip_getAUColdModifier = getAUColdModifier;
    global.gaip_getAUHeatDroughtModifier = getAUHeatDroughtModifier;
    global.gaip_getAUShadeModifier = getAUShadeModifier;
    global.gaip_getAUVarietyTraits = getAUVarietyTraits;

})(window);
