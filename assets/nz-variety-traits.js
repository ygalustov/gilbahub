/**
 * ============================================================================
 * NEW ZEALAND VARIETY TRAITS DATABASE v1.0.0
 * ============================================================================
 * 
 * Region-aware wrapper around GAIP VARIETY_TRAITS data.
 * Prioritises NZ trial data (NZSTI Auckland, PGG Wrightson trials)
 * over US NTEP data when both exist for the same variety.
 * 
 * DATA SOURCES (by priority):
 *   1. NZSTI trials (Auckland 2005-2007, ongoing)
 *   2. PGG Wrightson Turf NZ field data / specifications
 *   3. BSPB data (UK climate is closest analogue for southern NZ)
 *   4. NTEP data from climate-matched US locations
 * 
 * SPECIES COVERED:
 *   - Perennial Ryegrass (Lolium perenne) — primary sports turf
 *   - Browntop Bent (Agrostis capillaris) — greens, fine turf
 *   - Creeping Bentgrass (Agrostis stolonifera) — greens
 *   - Fine Fescue (Festuca rubra spp.) — via nz-fine-fescue-traits.js
 *   - Tall Fescue (Festuca arundinacea) — warm-dry areas
 *   - Kentucky Bluegrass (Poa pratensis) — blends
 *   - Couch/Bermuda (Cynodon dactylon) — northern NZ only
 * 
 * CLIMATE ZONES:
 *   - nz_subtropical: Northland, Auckland, Bay of Plenty
 *   - nz_temperate: Waikato, Wellington, Canterbury, Otago
 *   - nz_maritime: Coastal areas with high rainfall, mild winters
 * 
 * NOTE: NZ fine fescue data is in nz-fine-fescue-traits.js (separate file).
 * This file handles all other species.
 * 
 * @author Gilba Solutions
 * @version 1.0.0
 */

(function(global) {
    'use strict';


    // ═══════════════════════════════════════════════════════════════════════════
    // NZ REGION PRIORITY ORDERS
    // NZ climate is closest to UK (BSPB) and temperate AU, so those come
    // before US NTEP data in fallback order.
    // ═══════════════════════════════════════════════════════════════════════════

    var NZ_REGION_PRIORITY = {
        // Northern NZ (Auckland, Northland) — mild, humid
        subtropical: [
            'nzsti_auckland', 'nzsti_nz', 'au_temperate', 'temperate_au',
            'subtropical_au', 'bspb_uk', 'temperate_ntep', 'ntep_us'
        ],
        // Southern/central NZ (Canterbury, Otago, Wellington)
        temperate: [
            'nzsti_nz', 'nzsti_auckland', 'bspb_uk', 'au_temperate',
            'temperate_au', 'temperate_ntep', 'cold_ntep', 'ntep_us'
        ],
        // Coastal maritime
        maritime: [
            'nzsti_nz', 'bspb_uk', 'nzsti_auckland', 'au_temperate',
            'temperate_ntep', 'ntep_us'
        ],
        // Default fallback
        default: [
            'nzsti_nz', 'nzsti_auckland', 'bspb_uk', 'au_temperate',
            'temperate_au', 'subtropical_au', 'temperate_ntep',
            'cold_ntep', 'ntep_us', 'subtropical', 'temperate', 'cold'
        ]
    };

    // ═══════════════════════════════════════════════════════════════════════════
    // CLIMATE ZONE DETECTION
    // ═══════════════════════════════════════════════════════════════════════════

    function detectNZClimateZone(lat, lon) {
        if (!lat || !lon) return 'default';
        var absLat = Math.abs(lat);

        // Subtropical: north of ~38°S (Auckland, Northland, Bay of Plenty)
        if (absLat < 38) return 'subtropical';

        // Maritime: west coast (lon < 172) and high rainfall areas
        if (lon < 172 && absLat > 38 && absLat < 46) return 'maritime';

        // Temperate: everything else (Canterbury, Otago, Southland)
        return 'temperate';
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // VARIETY LOOKUP HELPERS
    // ═══════════════════════════════════════════════════════════════════════════

    function getVARIETY_TRAITS() {
        return global.GAIP_VARIETY_TRAITS || global.VARIETY_TRAITS || null;
    }

    function normalizeSpecies(species) {
        if (!species) return '';
        if (global.SpeciesController && typeof global.SpeciesController.normalizeKey === 'function') {
            return global.SpeciesController.normalizeKey(species);
        }
        var s = species.toLowerCase().replace(/\s+/g, '');
        var map = {
            'couch': 'bermuda', 'bermudagrass': 'bermuda', 'cynodon': 'bermuda',
            'perennialryegrass': 'perennialRyegrass', 'prg': 'perennialRyegrass',
            'ryegrass': 'perennialRyegrass',
            'tallfescue': 'tallFescue', 'fescue': 'fineFescue', 'finefescue': 'fineFescue', 'chewings': 'fineFescue', 'chewingsfescue': 'fineFescue',
            'bentgrass': 'bentgrass', 'creepingbent': 'bentgrass',
            'cotula': 'cotula', 'leptinella': 'cotula', 'cotula_bowling_green': 'cotula',
            'grasslandspahia': 'cotula', 'maniototo': 'cotula',
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
        return NZ_REGION_PRIORITY[climateZone] || NZ_REGION_PRIORITY['default'];
    }

    function getCurrentNZClimateZone() {
        var lat = parseFloat((document.querySelector('.gaip-lat') || {}).value);
        var lon = parseFloat((document.querySelector('.gaip-lon') || {}).value);
        if (!isNaN(lat) && !isNaN(lon)) {
            return detectNZClimateZone(lat, lon);
        }
        return 'default';
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // TRAIT GETTERS — NZ-prioritised
    // ═══════════════════════════════════════════════════════════════════════════

    function getNZWearModifier(species, variety) {
        var data = getVarietyData(species, variety);
        if (!data) return { multiplier: 1.0, confidence: 'none', source: 'No NZ data', region: 'new_zealand' };

        if (data.traits && data.traits.wear) {
            return {
                multiplier: data.traits.wear.multiplier || 1.0,
                confidence: data.traits.wear.confidence || 'medium',
                source: data.traits.wear.source || 'NZ variety data',
                recoveryMultiplier: (data.traits.recovery && data.traits.recovery.rateMultiplier) ||
                                    (data.traits.recovery && data.traits.recovery.multiplier) || 1.0,
                region: 'new_zealand',
                _nzClimateZone: getCurrentNZClimateZone()
            };
        }

        if (data.regionalTraits) {
            var zones = getRegionOrder(getCurrentNZClimateZone());
            for (var i = 0; i < zones.length; i++) {
                var regionData = data.regionalTraits[zones[i]];
                if (regionData && regionData.traits && regionData.traits.wear) {
                    return {
                        multiplier: regionData.traits.wear.multiplier || 1.0,
                        confidence: regionData.traits.wear.confidence || 'medium',
                        source: regionData.traits.wear.source || 'NZ region data',
                        recoveryMultiplier: (regionData.traits.recovery && regionData.traits.recovery.rateMultiplier) || 1.0,
                        region: 'new_zealand',
                        _nzClimateZone: getCurrentNZClimateZone(),
                        _dataRegion: zones[i]
                    };
                }
            }
        }

        return { multiplier: 1.0, confidence: 'none', source: 'No NZ wear data', region: 'new_zealand' };
    }

    function getNZDiseaseModifier(species, variety, disease) {
        var data = getVarietyData(species, variety);
        if (!data) return { riskMultiplier: 1.0, confidence: 'none', source: 'No NZ data', region: 'new_zealand' };

        if (data.traits && data.traits.disease && data.traits.disease[disease]) {
            return {
                riskMultiplier: data.traits.disease[disease].riskMultiplier || 1.0,
                confidence: data.traits.disease[disease].confidence || 'medium',
                source: data.traits.disease[disease].source || 'NZ variety data',
                region: 'new_zealand'
            };
        }

        if (data.regionalTraits) {
            var zones = getRegionOrder(getCurrentNZClimateZone());
            for (var i = 0; i < zones.length; i++) {
                var regionData = data.regionalTraits[zones[i]];
                if (regionData && regionData.traits && regionData.traits.disease && regionData.traits.disease[disease]) {
                    return {
                        riskMultiplier: regionData.traits.disease[disease].riskMultiplier || 1.0,
                        confidence: regionData.traits.disease[disease].confidence || 'medium',
                        source: regionData.traits.disease[disease].source || 'NZ region data',
                        region: 'new_zealand',
                        _dataRegion: zones[i]
                    };
                }
            }
        }

        return { riskMultiplier: 1.0, confidence: 'none', source: 'No NZ disease data for ' + disease, region: 'new_zealand' };
    }

    function getNZWaterUseModifier(species, variety) {
        var data = getVarietyData(species, variety);
        if (!data) return { multiplier: 1.0, confidence: 'none', source: 'No NZ data', region: 'new_zealand' };

        if (data.traits && data.traits.waterUse) {
            return {
                multiplier: data.traits.waterUse.multiplier || 1.0,
                confidence: data.traits.waterUse.confidence || 'medium',
                source: data.traits.waterUse.source || 'NZ variety data',
                region: 'new_zealand'
            };
        }

        return { multiplier: 1.0, confidence: 'none', source: 'No NZ water use data', region: 'new_zealand' };
    }

    function getNZColdModifier(species, variety) {
        var data = getVarietyData(species, variety);
        if (!data) return { dormancyThresholdModifier: 1.0, winterkillRisk: 1.0, confidence: 'none', source: 'No NZ data', region: 'new_zealand' };

        if (data.traits && data.traits.cold) {
            return {
                dormancyThresholdModifier: data.traits.cold.dormancyThresholdModifier || 1.0,
                winterkillRisk: data.traits.cold.winterkillRisk || 1.0,
                confidence: data.traits.cold.confidence || 'medium',
                source: data.traits.cold.source || 'NZ variety data',
                region: 'new_zealand'
            };
        }

        return { dormancyThresholdModifier: 1.0, winterkillRisk: 1.0, confidence: 'none', source: 'No NZ cold data', region: 'new_zealand' };
    }

    function getNZShadeModifier(species, variety) {
        var data = getVarietyData(species, variety);
        if (!data) return { thresholdModifier: 1.0, confidence: 'none', source: 'No NZ data', region: 'new_zealand' };

        if (data.traits && data.traits.shade) {
            return {
                thresholdModifier: data.traits.shade.thresholdModifier || 1.0,
                confidence: data.traits.shade.confidence || 'medium',
                source: data.traits.shade.source || 'NZ variety data',
                region: 'new_zealand'
            };
        }

        return { thresholdModifier: 1.0, confidence: 'none', source: 'No NZ shade data', region: 'new_zealand' };
    }

    function getNZVarietyTraits(species, variety) {
        return getVarietyData(species, variety);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // EXPORTS
    // ═══════════════════════════════════════════════════════════════════════════

    global.GAIP_NZ_VARIETY_TRAITS = {
        version: '1.0.1',
        regionPriority: NZ_REGION_PRIORITY,
        detectClimateZone: detectNZClimateZone
    };

    global.gaip_getNZWearModifier = getNZWearModifier;
    global.gaip_getNZDiseaseModifier = getNZDiseaseModifier;
    global.gaip_getNZWaterUseModifier = getNZWaterUseModifier;
    global.gaip_getNZColdModifier = getNZColdModifier;
    global.gaip_getNZShadeModifier = getNZShadeModifier;
    global.gaip_getNZVarietyTraits = getNZVarietyTraits;

})(window);
