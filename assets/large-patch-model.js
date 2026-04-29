/**
 * Large Patch Model v1.0.0
 * 
 * Rhizoctonia solani AG 2-2 LP
 * Warm-season turfgrass disease (C4 only - C3 species immune)
 * 
 * KEY DISTINCTION FROM BROWN PATCH:
 * - Brown Patch: warm weather disease on ACTIVELY GROWING turf (optimum ~28°C)
 * - Large Patch: cool weather disease on DORMANT/TRANSITIONING warm-season turf (optimum 21-27°C)
 * 
 * Research basis:
 * - Kerns JP, Tredway LP. 2013. NC State Extension - Large Patch
 * - Envu Australia. 2023. Large Patch - A New Turf Disease
 * - Penn State Turfgrass Pest Diagnostic Lab. Large Patch Profile
 * - Kreinberg et al. 2025. Review of the biology and management of large patch. Crop Science.
 * 
 * Temperature parameters:
 * - Active range: 10-30°C (pathogen growth)
 * - Optimal infection: 21-27°C air temperature
 * - Soil temp trigger for preventive: 21-24°C at 50mm depth
 * - Inactive above 30°C (summer suppression)
 * - Symptoms most visible: 20-25°C (spring/autumn transitions)
 * 
 * Host specificity (C4 warm-season only):
 * - Most susceptible: Centipedegrass, Seashore paspalum, Zoysiagrass
 * - Moderately susceptible: St. Augustinegrass (Buffalo), Kikuyu
 * - Least susceptible: Bermudagrass/Couch (recovers quickly)
 * - Immune: All C3 grasses (bentgrass, ryegrass, fescue, bluegrass)
 * 
 * Australian context:
 * - Confirmed in SA, WA on kikuyu (DNA testing pending for AG 2-2 LP confirmation)
 * - Name: "Large Patch" (adopted from US terminology)
 * - Affects: Couch, Zoysia, Kikuyu, Buffalo
 * 
 * @author Gilba Solutions
 * @version 1.0.0
 */

const LargePatchModel = {
    name: 'Large Patch',
    pathogen: 'Rhizoctonia solani AG 2-2 LP',
    
    // Species susceptibility modifiers (C4 only - C3 return 0 = immune)
    speciesSusceptibility: {
        // Warm-season (C4) - susceptible
        zoysia: 1.3,              // High susceptibility, slow recovery
        seashore_paspalum: 1.4,   // Very high susceptibility
        seashorePaspalum: 1.4,    // Alias
        kikuyu: 1.2,              // Confirmed in AU (SA, WA)
        couch: 0.7,               // Lower susceptibility, rapid recovery
        bermuda: 0.7,             // Same as couch
        buffalo: 0.9,             // St. Augustine equivalent
        buffalograss: 0.9,        // Alias
        centipede: 1.5,           // Highest susceptibility (not common in AU)
        
        // Cool-season (C3) - immune
        bentgrass: 0,
        perennialRyegrass: 0,
        kentuckyBluegrass: 0,
        tallFescue: 0,
        fineFescue: 0,
        poaAnnua: 0,
    },
    
    /**
     * Calculate Large Patch risk
     * @param {Object} climate - Climate data with temperature, humidity, precipitation
     * @param {Object} nitrogen - Nitrogen status object
     * @param {Object} variety - Variety traits including disease resistance
     * @param {Object} soil - Soil data including pH
     * @param {Object} dormancy - Dormancy status from climate module
     * @param {string} normalizedSpecies - Canonical species name
     * @returns {Object|null} Risk result or null if species not applicable
     */
    calculate(climate, nitrogen, variety, soil, dormancy, normalizedSpecies) {
        // b35fix345: null-passthrough on temperature and humidity. Pre-fix
        // meanTemp `|| 20` and humidity `|| 70` planted fabricated values.
        // Large patch is C4-only (Rhizoctonia solani AG 2-2 LP) and requires
        // soil-temp signal to drive timing; without meanTemp we degrade.
        const meanTemp = climate?.temperature?.mean ?? null;
        const humidity = climate?.moisture?.humidity?.mean ?? null;
        if (meanTemp == null) {
            return {
                disease: 'largePatch',
                displayName: 'Large Patch',
                riskScore: 0, rawRisk: 0, riskLevel: 'low',
                confidence: 'low', confidenceScore: 30, degraded: true,
                source: 'LargePatchModel — degraded: temperature missing (b35fix345)',
                drivers: { temperature: { value: null, status: 'missing' },
                           humidity:    { value: humidity, status: humidity == null ? 'missing' : 'available' } },
            };
        }
        const minTemp = climate?.temperature?.min ?? (meanTemp - 5);
        const maxTemp = climate?.temperature?.max ?? (meanTemp + 5);
        const precip = climate?.precipitation?.total || 0;
        const nStatus = nitrogen?.status || 'adequate';
        
        // Get soil temperature - prefer 50mm depth for this disease
        let soilTemp = meanTemp; // Fallback
        let soilTempSource = 'estimated';
        
        // Priority 1: GAIP physics-based soil temp model (50mm depth)
        if (typeof window !== 'undefined' && 
            window.GAIP_SOIL_TEMP?.summary?.depths?.['50mm']?.mean) {
            soilTemp = window.GAIP_SOIL_TEMP.summary.depths['50mm'].mean;
            soilTempSource = 'physics_model_50mm';
        }
        // Priority 2: 100mm depth (close enough)
        else if (typeof window !== 'undefined' && 
                 window.GAIP_SOIL_TEMP?.summary?.depths?.['100mm']?.mean) {
            soilTemp = window.GAIP_SOIL_TEMP.summary.depths['100mm'].mean;
            soilTempSource = 'physics_model_100mm';
        }
        // Priority 3: Sensor data
        else if (typeof window !== 'undefined' && 
                 window.GAIP_Sensor?.hasData?.()) {
            const sensorData = window.GAIP_Sensor.getIrrigationData?.();
            if (sensorData?.soilTemp != null) {
                soilTemp = sensorData.soilTemp;
                soilTempSource = 'sensor:' + (sensorData.source || 'TDR');
            }
        }
        // Priority 4: Climate data soil temp
        else if (climate?.temperature?.soil) {
            soilTemp = typeof climate.temperature.soil === 'object' ? 
                       climate.temperature.soil.mean : climate.temperature.soil;
            soilTempSource = 'climate';
        }
        
        // Get species susceptibility
        const species = normalizedSpecies || variety?.species || 'couch';
        const susceptibility = this.speciesSusceptibility[species];
        
        // Exit if cool-season grass (immune) or species not in list
        if (susceptibility === 0 || susceptibility === undefined) {
            return null; // Don't display for C3 species
        }
        
        // Exit if too warm - disease inactive in summer
        if (meanTemp > 30) {
            return {
                disease: 'largePatch',
                displayName: 'Large Patch',
                riskScore: 0,
                adjustedRisk: 0,
                riskLevel: 'minimal',
                confidence: 'high',
                confidenceScore: 90,
                validationStatus: 'production',
                validationBadge: 'VALIDATED',
                drivers: {
                    temperature: {
                        air: meanTemp,
                        soil: soilTemp,
                        soilSource: soilTempSource,
                        optimalRange: '10-30°C air (21-27°C optimal)',
                        contribution: 0,
                        note: 'Too warm - pathogen inactive above 30°C'
                    }
                },
                interventions: {
                    timing: 'Monitor soil temperatures',
                    chemical: [],
                    cultural: [
                        'Begin preventive program when soil temp at 50mm drops to 21-24°C in autumn'
                    ]
                },
                source: 'Kerns & Tredway 2013, Envu AU 2023'
            };
        }
        
        // Exit if too cold - minimal activity
        if (meanTemp < 10) {
            return {
                disease: 'largePatch',
                displayName: 'Large Patch',
                riskScore: 5,
                adjustedRisk: Math.round(5 * susceptibility),
                riskLevel: 'minimal',
                confidence: 'medium',
                confidenceScore: 75,
                validationStatus: 'production',
                validationBadge: 'VALIDATED',
                drivers: {
                    temperature: {
                        air: meanTemp,
                        soil: soilTemp,
                        soilSource: soilTempSource,
                        contribution: 5,
                        note: 'Below optimal temperature range - limited pathogen activity'
                    }
                },
                source: 'Kerns & Tredway 2013'
            };
        }
        
        // === TEMPERATURE RISK ===
        // Optimal infection: 21-27°C air temp
        // Use asymmetric curve - more active in the 20-25°C range
        let tempRisk = 0;
        if (meanTemp >= 21 && meanTemp <= 27) {
            // Peak risk zone - maximum at 24°C
            tempRisk = 100 - Math.abs(meanTemp - 24) * 8;
        } else if (meanTemp >= 15 && meanTemp < 21) {
            // Rising risk (spring or cooling autumn)
            tempRisk = 40 + (meanTemp - 15) * 10;
        } else if (meanTemp > 27 && meanTemp <= 30) {
            // Declining risk (warming)
            tempRisk = 100 - (meanTemp - 27) * 25;
        } else if (meanTemp >= 10 && meanTemp < 15) {
            // Low risk - cool but pathogen still present
            tempRisk = 20 + (meanTemp - 10) * 4;
        }
        
        // === SOIL TEMPERATURE TRIGGER ===
        // Key preventive timing: soil temp at 50mm depth = 21-24°C
        let soilTempRisk = 0;
        let applicationWindow = false;
        let applicationNote = null;
        
        if (soilTemp >= 21 && soilTemp <= 24) {
            soilTempRisk = 30; // Bonus risk - this is the critical window
            applicationWindow = true;
            applicationNote = `Soil temperature at ${Math.round(soilTemp * 10) / 10}°C - optimal preventive application window`;
        } else if (soilTemp >= 18 && soilTemp < 21) {
            soilTempRisk = 15;
            applicationNote = 'Soil temperature approaching preventive window (21-24°C)';
        } else if (soilTemp > 24 && soilTemp <= 27) {
            soilTempRisk = 20;
        }
        
        // === MOISTURE RISK ===
        // Saturated soils and high humidity exacerbate disease
        let moistureRisk = 0;
        let moistureNote = null;
        
        // b35fix345: null-guard. When humidity null, moistureRisk is 0
        // (no fabricated risk from default 70%).
        if (humidity != null) {
            if (humidity > 90) {
                moistureRisk = 30;
                moistureNote = 'Very high humidity favouring disease';
            } else if (humidity > 80) {
                moistureRisk = 20;
            } else if (humidity > 70) {
                moistureRisk = 10;
            }
        }
        
        // Precipitation bonus
        if (precip > 20) {
            moistureRisk += 20;
            moistureNote = (moistureNote ? moistureNote + '. ' : '') + 'Heavy rainfall saturating soil';
        } else if (precip > 10) {
            moistureRisk += 10;
        }
        
        // === NITROGEN RISK ===
        // Late summer/autumn N applications increase severity
        let nModifier = 1.0;
        let nRisk = 0;
        let nNote = null;
        
        if (nStatus === 'excessive') {
            nModifier = 1.35;
            nRisk = 20;
            nNote = 'Excessive nitrogen significantly elevating risk';
        } else if (nStatus === 'high') {
            nModifier = 1.2;
            nRisk = 10;
            nNote = 'High nitrogen increasing susceptibility';
        } else if (nStatus === 'adequate') {
            nModifier = 1.0;
            nRisk = 0;
        } else if (nStatus === 'low' || nStatus === 'deficient') {
            nModifier = 0.9;
            nRisk = -5;
        }
        
        // === DORMANCY/TRANSITION STATUS ===
        // Disease is most severe during transitions
        let transitionRisk = 0;
        let transitionNote = null;
        const dormancyStatus = dormancy?.status || 'active';
        
        if (dormancyStatus === 'transitional' || 
            dormancyStatus === 'entering_dormancy' || 
            dormancyStatus === 'breaking_dormancy') {
            transitionRisk = 25; // Peak vulnerability
            transitionNote = 'Turf transitioning - peak vulnerability to Large Patch';
        } else if (dormancyStatus === 'dormant') {
            transitionRisk = 15; // Infection can occur but symptoms not visible until spring
            transitionNote = 'Dormant turf - infection may occur but symptoms delayed until greenup';
        } else if (dormancyStatus === 'active') {
            transitionRisk = 0; // Active growth = rapid recovery
        }
        
        // === CALCULATE BASE RISK ===
        const baseRisk = (
            tempRisk * 0.35 +
            soilTempRisk +
            moistureRisk * 0.25 +
            nRisk +
            transitionRisk
        );
        
        // Apply species susceptibility modifier
        const speciesAdjusted = baseRisk * susceptibility;
        
        // Apply variety resistance if available
        const varietyModifier = variety?.disease?.largePatch?.riskMultiplier || 1.0;
        const adjustedRisk = Math.min(100, Math.max(0, Math.round(speciesAdjusted * varietyModifier * nModifier)));
        
        // Determine primary driver
        let primaryDriver = 'temperature';
        if (transitionRisk > tempRisk * 0.35 && transitionRisk > moistureRisk * 0.25) {
            primaryDriver = 'dormancy_transition';
        } else if (moistureRisk * 0.25 > tempRisk * 0.35) {
            primaryDriver = 'moisture';
        } else if (nModifier > 1.2) {
            primaryDriver = 'excess_nitrogen';
        }
        
        // Build result
        const riskLevel = this.classifyRisk(adjustedRisk);
        const interventions = this.getInterventions(riskLevel, {
            applicationWindow,
            soilTemp,
            species,
            nStatus,
            region: typeof window !== 'undefined' ? window.GAIP_STATE?.location?.country : 'AU'
        });
        
        return {
            disease: 'largePatch',
            displayName: 'Large Patch',
            riskScore: Math.round(baseRisk),
            adjustedRisk: adjustedRisk,
            riskLevel: riskLevel,
            confidence: soilTempSource !== 'estimated' ? 'high' : 'medium',
            confidenceScore: soilTempSource !== 'estimated' ? 85 : 70,
            primaryDriver: primaryDriver,
            modelVersion: '1.0',
            validationStatus: 'production',
            validationBadge: 'VALIDATED',
            drivers: {
                temperature: {
                    air: meanTemp,
                    soil: Math.round(soilTemp * 10) / 10,
                    soilSource: soilTempSource,
                    optimalRange: '21-27°C air, 21-24°C soil trigger',
                    contribution: Math.round(tempRisk * 0.35 + soilTempRisk)
                },
                moisture: {
                    humidity: humidity,
                    precipitation: precip,
                    contribution: Math.round(moistureRisk * 0.25),
                    note: moistureNote
                },
                nitrogen: {
                    status: nStatus,
                    modifier: nModifier,
                    contribution: nRisk,
                    note: nNote
                },
                species: {
                    name: species,
                    susceptibility: susceptibility,
                    note: susceptibility >= 1.3 ? 'High susceptibility species - expect slow recovery' : 
                          susceptibility <= 0.7 ? 'Lower susceptibility - expect rapid summer recovery' : null
                },
                dormancy: {
                    status: dormancyStatus,
                    contribution: transitionRisk,
                    note: transitionNote
                }
            },
            applicationWindow: applicationWindow,
            applicationNote: applicationNote,
            interventions: interventions,
            source: 'Kerns & Tredway 2013, Envu AU 2023, Penn State'
        };
    },
    
    classifyRisk(risk) {
        if (risk >= 70) return 'high';
        if (risk >= 50) return 'moderate';
        if (risk >= 25) return 'low';
        return 'minimal';
    },
    
    getInterventions(riskLevel, context) {
        const interventions = {
            timing: '',
            chemical: [],
            cultural: []
        };
        const region = (context.region || 'AU').toUpperCase();
        
        // Application window advice
        if (context.applicationWindow) {
            interventions.timing = `PREVENTIVE WINDOW: Soil at ${Math.round(context.soilTemp)}°C - apply now, repeat in 28 days`;
            
            // Region-specific products
            if (region === 'AU' || region === 'NZ') {
                interventions.chemical = [
                    'Dedicate Forte (propiconazole + fludioxonil) - registered for Large Patch AU',
                    'Banner Maxx (propiconazole) 5-10 L/ha',
                    'Heritage Maxx (azoxystrobin) + DMI partner',
                    'Apply in 2-4 gal/1000 sq ft, irrigate 3-6mm after application'
                ];
            } else {
                interventions.chemical = [
                    'Propiconazole 5-10 L/ha',
                    'Azoxystrobin + propiconazole premix',
                    'Flutolanil (where registered)',
                    'Apply in high water volume, irrigate into rootzone'
                ];
            }
        }
        
        // Risk-level specific advice
        if (riskLevel === 'high' || riskLevel === 'severe') {
            interventions.timing = interventions.timing || 'HIGH RISK: Apply fungicide within 48 hours';
            interventions.cultural.push('Reduce irrigation immediately - avoid soil saturation');
            interventions.cultural.push('Scout for orange firing at patch margins (active infection sign)');
        } else if (riskLevel === 'moderate') {
            interventions.timing = interventions.timing || 'MODERATE RISK: Scout for symptoms, prepare preventive program';
            interventions.cultural.push('Check for orange firing at patch margins');
            if (!context.applicationWindow) {
                interventions.cultural.push('Monitor soil temps - begin applications when 50mm depth reaches 21-24°C');
            }
        } else if (riskLevel === 'low') {
            interventions.timing = 'LOW RISK: Monitor conditions';
        } else {
            interventions.timing = 'MINIMAL RISK: No action required';
        }
        
        // Nitrogen advice
        if (context.nStatus === 'excessive' || context.nStatus === 'high') {
            interventions.cultural.unshift('PRIORITY: Avoid autumn nitrogen - significantly increases Large Patch severity');
        }
        
        // Cultural practices (always applicable)
        interventions.cultural.push('Improve drainage where possible - saturated soils worsen disease');
        interventions.cultural.push('Reduce thatch if >12mm - aerate in summer when actively growing');
        interventions.cultural.push('Avoid evening irrigation during risk periods');
        
        // Species-specific recovery advice
        if (context.species === 'couch' || context.species === 'bermuda') {
            interventions.cultural.push('Recovery note: Couch typically recovers rapidly in summer warmth');
            interventions.cultural.push('Late spring N can help turf outgrow damage once soil temps exceed 24°C');
        } else if (context.species === 'zoysia') {
            interventions.cultural.push('Recovery note: Zoysia recovery is slow - multiple seasons may be needed');
            interventions.cultural.push('Consider spring fungicide re-treatment if wet weather forecast');
        } else if (context.species === 'kikuyu') {
            interventions.cultural.push('Recovery note: Kikuyu aggressive growth aids recovery once conditions improve');
        }
        
        return interventions;
    }
};

// Export for integration
if (typeof window !== 'undefined') {
    window.LargePatchModel = LargePatchModel;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = LargePatchModel;
}
