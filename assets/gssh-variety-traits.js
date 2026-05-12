/**
 * GILBA AGRONOMIC INTELLIGENCE HUB
 * Comprehensive Variety Traits Data Structure v1.14.1
 * 
 * ALL DATA SOURCED FROM NTEP TRIALS AND PUBLISHED UNIVERSITY RESEARCH
 * DO NOT ADD DATA WITHOUT VERIFIED TRIAL SOURCE
 * 
 * v1.14.2 UPDATES - SPECIES NORMALISATION FORWARD-PORT (Item 21):
 * - 'couch' is now canonical VARIETY_TRAITS data key (was 'bermuda')
 * - SPECIES_TO_TRAITS_KEY: couch → couch (direct), bermuda → couch (legacy alias)
 * - normalizeSpeciesKey() aliases updated to resolve to 'couch'
 * - Mirrors GAIP gilba-variety-traits.js canonical key
 *
 * v1.14.1 UPDATES - SPECIESCONTROLLER INTEGRATION:
 * - normalizeSpeciesKey() now uses SpeciesController when available
 * - Added SPECIES_TO_TRAITS_KEY mapping (couch is now canonical data key)
 * - Ensures consistent species identity across all Hub modules
 * - Fixes variety lookup failures when disease module passes 'couch'
 * 
 * v1.14.0 UPDATES - NZ MARKET VARIETY ADDITIONS:
 * - Source: NTEP 2003-2023 trials, Seed Research of Oregon, Penn State, Rutgers
 * - BENTGRASS: 777 (heat specialist, dollar spot resistance)
 * - PERENNIAL RYEGRASS: Stellar 4GL (4th gen GLS, best divot recovery),
 *   Superstar GL (GLS, cold tolerant), Breakout 2 (annual for rapid establishment),
 *   SR 4650 (highest GLS resistance), SR 4660ST (salt tolerant)
 * - KENTUCKY BLUEGRASS: Bolt (#1 seedling vigor), Acoustic (top quality, summer patch)
 * - TALL FESCUE: Firecracker GLS (first GLS resistance + Lateral Spread)
 * - BERMUDA: Rio (#1 establishment, cold tolerant for transition zone)
 * 
 * v1.13.0 UPDATES - BROWNTOP BENT (Agrostis capillaris) ADDITIONS:
 * - Source: BSPB Turfgrass Seed 2025 Table G1 (STRI Bingley trials)
 * - ARROWTOWN: Elite browntop, Mean 7.0, Density 7.0, Fineness 7.0
 *   Bred from Arrowtown Golf Club NZ by Dr Alan Stewart (PGG Wrightson)
 * - MANOR: Mean 6.6, Light green colour masks Poa annua
 * - EGMONT: Mean 6.4, Best wear (6.6) and slow regrowth (6.7) of browntops
 * - SEFTON: Mean 6.5, Standard browntop
 * 
 * v1.12.0 UPDATES - AUSTRALIA/NZ VARIETY ADDITIONS:
 * - DERBY XTREME: Updated with verified NTEP 2004 trial data (Entry #45, IS-PR 268)
 *   Quality 6.5 (Table 1, 7 locations), Color 8.3, Texture 6.3 (Iowa 2006)
 *   Gray Leaf Spot 8.3/9 - Top performer (PACE Turf Sept 2006)
 * - CENTURION (PGG Wrightson): Added from NZSTI Auckland 2005-2007 trial
 *   Establishment density 9.0 (#1), Worn density Y1 6.9 (#1)
 *   Mid-dark green, fine-leaved, high endophyte, mowing to 12mm
 * - COLOSSEUM (PGG Wrightson): Added from NZSTI Auckland 2005-2007 trial
 *   Mediterranean x American genetics, cold germination to 5°C
 *   Excellent winter activity, delayed summer browning
 * - REBEL IV (PGG Wrightson/Pennington): Added from NTEP 2006 trial
 *   Quality 6.2 (SE Region), Color 7.0, Brown Patch 14.7% (top group)
 *   Outstanding wear, shade, and drought tolerance
 * 
 * v1.10.0 UPDATES - BUFFALO CLIMATE ZONE MAPPING:
 * - Added _buffaloClimateMapping for HAL TU04013 trial site → AU climate zone
 * - Matilda, Sir Walter: Full climate zone tags (testedClimateZones + per-trait climateZone)
 * - Trial sites mapped: Redlands QLD (subtropical), Shenton Park WA (mediterranean),
 *   Wembley GC WA (mediterranean), Richmond NSW (temperate), Springfield Lakes (subtropical)
 * 
 * v1.9.0 UPDATES - REGIONALIZED TRAIT STRUCTURE:
 * - MAJOR RESTRUCTURE: Traits now regionalized by climate zone
 * - Each variety has testedRegions[] and regionalTraits{} objects
 * - Australian climate zones: subtropical, temperate, cold
 * - NTEP climate zones: subtropical_ntep, temperate_ntep, cold_ntep, ntep_us
 * - NTEP→AU climate mapping table added for bentgrass section
 * 
 * BERMUDA (COUCH) - 9 varieties regionalized:
 * - AgriDark: subtropical only (QSAC/STRI)
 * - Santa Ana: cold + subtropical (TU08007 + QSAC) - multi-regional champion
 * - TifTuf: subtropical + ntep_us (QSAC/STRI + NTEP)
 * - Grand Prix: cold + subtropical (TU08007 #1 → STRI #5 - climate-specific)
 * - Legend: cold + subtropical (POOR in both - not recommended)
 * - Wintergreen: subtropical + temperate/cold extrapolated (TU08018 + STRI)
 * - OZ TUFF: subtropical only (wear champion but poor drought/shade)
 * - Windsor Green: cold only (TU08007)
 * - Conquest: cold only (POOR - not recommended)
 * 
 * BENTGRASS - 14 varieties regionalized with NTEP→AU climate mapping:
 * - Pure Distinction: temperate_au (Keysborough Melbourne) + cold_ntep
 * - Crystal Bluelinks: temperate_au (Keysborough) + cold_ntep
 * - Penn A-4: temperate_au (Keysborough reference) + cold_ntep
 * - 007, Declaration, Penn A-1, T-1, Penncross, Piper, Oakley, Tyee,
 *   Mackenzie, L-93, Providence, Memorial: NTEP regions mapped to AU zones
 * 
 * BUFFALO - 2 varieties with climate zone tags (Matilda, Sir Walter):
 * - Wear/Shade traits from Redlands QLD (subtropical)
 * - Drought traits from Shenton Park WA (mediterranean)
 * - Winter colour traits from Wembley GC WA (mediterranean)
 * - Remaining 9 buffalo varieties: climate mapping header available, tags to be added
 * 
 * NTEP LOCATION → AUSTRALIAN CLIMATE ZONE MAPPING:
 * | NTEP Location      | AU Equivalent        | AU Zone      |
 * | Raleigh NC         | Brisbane, Gold Coast | subtropical  |
 * | Purdue IN          | Canberra, highlands  | cold         |
 * | Penn State PA      | Canberra, S'Highlands| cold         |
 * | New Jersey         | Sydney, Newcastle    | temperate    |
 * | Riverside CA       | Perth, Adelaide      | mediterranean|
 * 
 * v1.8.0 UPDATES:
 * - Integrated QSAC Brisbane Bermudagrass Trial (Matt Oliver, Stadiums Queensland 2020-2021)
 *   Location: Queensland Sport & Athletics Centre, Brisbane (subtropical)
 *   Source: ASTMA Conference Presentation, June 2021
 * - Integrated STRI TifTuf Cultivar Evaluation Trial (Queensland, 2019)
 *   Shade (60%), irrigation (deficit/standard), wear stress combinations
 * - NEW VARIETY: AgriDark (C. dactylon × C. transvaalensis) - Scenic Rim QLD
 *   QSAC ranking: #2 overall (mean 1.18), best seedhead suppression (1.0-1.25)
 * - Updated TifTuf with QSAC + STRI Australian trial data
 *   QSAC: #3 (tied), best rhizome depth (30mm), highest root-shear
 *   STRI: #1 overall for drought tolerance, shade colour retention
 * - Updated Santa Ana with QSAC data: #1 overall, excellent seedhead suppression
 * - Updated Legend with QSAC data: Confirmed poor actual wear (TU08018 finding)
 * - Regionalized trial data structure: qld_qsac_2020, qld_stri_2019, act_tu08007, qld_tu08018
 * 
 * v1.7.0 UPDATES:
 * - Added comprehensive Buffalo grass (St Augustinegrass) data from HAL TU04013
 * - Source: Duff, Loch & Colmer (2004-2009), QPIF Redlands & UWA
 * - 10 cultivars: Matilda, Sir Walter, Palmetto, Sapphire, Shademaster,
 *   ST-26, ST-85, ST-91, TF01, Common, GP22
 * - Wear tolerance: Trial 2 Table 4.1 - Matilda #1 (0% bare ground), Common #14 (52.5%)
 * - Drought tolerance: Table 6.2 - Matilda 72% at 33% ET (best)
 * - Winter colour: Table 6.8 - GP22 best (-5.6°), ST-85 worst (-24°)
 * - Disease: Plate 8.14 G. wongoonoo - Matilda most tolerant
 * - Morphology: Table 2.2 stolon/leaf measurements for all cultivars
 * - Multi-site quality ratings: Richmond, Springfield Lakes, Redlands 2007-2009
 * 
 * v1.6.0 UPDATES:
 * - Integrated NTEP Spring Dead Spot (SDS) disease data for bermuda varieties
 * - Tahoma 31: SDS 7.7/9 (NTEP Indiana 2021) - "Most Tolerant" category, confidence → HIGH
 * - TifTuf: SDS 6.0/9 (NTEP Indiana 2021) - "Least Tolerant" category per Arkansas Extension
 *   CAUTION: TifTuf has HIGHER SDS risk (1.15x) despite drought marketing
 * - Iron Cutter: SDS 7.5/9 (NTEP Columbia MO 2016-17) - excellent resistance
 * - Sources: NTEP 2019 bg19_22-4/bg1922t29c.txt, Arkansas Extension FSA-7551
 * 
 * v1.5.0 UPDATES:
 * - Added HAL TU08018 DAFFQ Redlands wear tolerance data (2009-2012)
 * - New varieties: OZ TUFF (#1 simulated wear), Hatfield
 * - Updated Wintergreen with verified TU08018 trial data (#1 actual wear)
 * - Key finding: OZ TUFF only variety with 0% time over 15% bare ground in 4 years
 * - Key finding: Wintergreen best for actual play but HIGH seedhead production
 * - Water use: All couch = 0.65 multiplier (40-45% vs 60-65% pan evap for C3)
 * - QSAC Brisbane trial (2020-2022) also referenced for TifTuf, AgriDark, Star Express
 * 
 * v1.4.0 UPDATES:
 * - Added Australian cold climate couch data from HAL TU08007 (University of Sydney 2010-2012)
 * - New varieties: Grand Prix (#1 cold tolerance), Santa Ana, Windsor Green, Conquest
 * - Updated Legend with verified TU08007 trial data
 * - Source: Martin & Richardson-Harris, Royal Canberra GC trial (103-124 frost days/year)
 * - Key metric: Post-winter shoot density correlates with cold tolerance
 * 
 * v1.3.0 UPDATES:
 * - Synced with UI dropdown - varieties now match exactly
 * - Added bermuda: Iron Cutter, Legend
 * - Added bentgrass: Tyee, Mackenzie, Penn A-4, L-93, Providence, Memorial
 * - Added ryegrass: Homerun LS
 * - Removed tall fescue varieties not in Australian market dropdown:
 *   Avenger III, Firecracker G-LS, Dynamite G-LS, Supersonic, Kentucky-31
 * 
 * v1.2.5 UPDATES:
 * - Added NTEP 2020 Pythium Root Rot data (Table 23, Raleigh NC) for:
 *   007, Declaration, Penn A-1, Penncross
 * - Updated Pure Distinction with ASTMA/Heritage Seeds Keysborough GC trial 2014-2016:
 *   Superior heat/drought recovery, high density, excellent Poa competition
 * - Updated Crystal Bluelinks with Keysborough GC trial data:
 *   Corrected heat tolerance (average, not superior), poor Poa competition (15%)
 * - Expanded Penncross with comprehensive NTEP 2020 data
 * - Varieties WITHOUT Pythium data (not in NTEP 2020): T-1, Pure Distinction, Crystal Bluelinks
 *   These show undefined rather than neutral assumption
 * 
 * Australian trial sources:
 * - John Neylan, ATM Journal Vol 21.5 (Sept-Oct 2019)
 * - VGCSA On Course Magazine, Autumn 2024
 * 
 * Data Structure:
 * - Each variety has trait modifiers that adjust module calculations
 * - Modifiers are expressed as multipliers (1.0 = baseline, <1.0 = better, >1.0 = worse)
 * - confidence: 'high' = NTEP multi-location data, 'medium' = single location or limited data
 * - source: Citation for the data origin
 * 
 * Module Integration:
 * - wearMultiplier: Adjusts wear calculation in Wear & Recovery module
 * - shadeThresholdModifier: Adjusts minimum DLI threshold in Shade Analysis
 * - salinityMultiplier: Adjusts EC growth penalty in Salinity module
 * - diseaseRiskModifiers: Per-disease adjustments in Disease Risk module
 * - waterUseModifier: Adjusts Kc coefficient in Irrigation module
 * - coldToleranceModifier: Adjusts dormancy thresholds in Climate module
 * - heatToleranceModifier: Adjusts summer stress penalties in Climate module
 */


const VARIETY_TRAITS = {
  
  // ═══════════════════════════════════════════════════════════════════════════
  // BERMUDAGRASS (Cynodon spp.)
  // Primary source: NTEP 2019-2024 National Bermudagrass Test
  // ═══════════════════════════════════════════════════════════════════════════
  
  couch: {
    
    'Tahoma 31': {
      species: 'couch',
      displayName: 'Tahoma 31',
      
      // Quality baseline - NTEP 2019-2023: Mean 6.5, ranked #1 of 35 entries
      qualityRating: 6.5,
      qualitySource: 'NTEP 2019-2023, 19 locations, ntep.org/data/bg19/bg19_21-2/bg1921tqsum.txt',

      testedRegions: ['au_temperate', 'au_subtropical'],
      
      traits: {
        // WEAR & RECOVERY MODULE
        wear: {
          multiplier: 0.85, // 15% reduction in wear damage
          confidence: 'high',
          source: 'NTEP Knoxville TN - Ranked #1 for traffic tolerance of all bermudagrass cultivars tested',
          notes: 'Tested 2019-2023 under simulated traffic stress'
        },
        
        // SHADE ANALYSIS MODULE  
        shade: {
          thresholdModifier: 0.85, // Can tolerate 15% lower DLI than baseline
          confidence: 'high',
          source: 'OSU research - Ranked #1 in turf quality at 63% shade among commercial bermudagrass',
          notes: 'Wu et al., Oklahoma State University shade trials'
        },
        
        // SALINITY MODULE
        salinity: {
          multiplier: 0.90, // 10% better salt tolerance
          confidence: 'medium',
          source: 'NTEP salinity data - Ranked #1 of 11 entries tested for salinity response',
          notes: 'Single location salinity trial'
        },
        
        // IRRIGATION MODULE
        waterUse: {
          multiplier: 0.82, // 18% less water use
          confidence: 'high',
          source: 'Amgain et al., 2018, Crop Sci. 58:1409 - OSU ET study 2013-2015',
          notes: '18% less water than TifTuf under non-limiting soil moisture'
        },
        
        // CLIMATE MODULE - Cold tolerance
        cold: {
          dormancyThresholdModifier: 0.85, // Stays active at lower temps
          winterkillRisk: 0.70, // 30% lower winterkill risk
          confidence: 'high',
          source: 'NTEP Indiana/Kentucky 2014-2017 - Only 4% winterkill (best of 42 entries)',
          notes: 'Polar vortex 2013-2014 survival test'
        },
        
        // CLIMATE MODULE - Spring greenup
        springGreenup: {
          daysEarlier: 14, // ~2 weeks earlier than standard
          confidence: 'high',
          source: 'NTEP 2014-2017 - Ranked #1 for early spring green-up in 16 states',
          notes: 'Vegetative bermudagrass comparison'
        },
        
        // DISEASE MODULE - VERIFIED NTEP DATA
        disease: {
          springDeadSpot: {
            riskMultiplier: 0.75, // 25% lower SDS risk
            confidence: 'high',  // VERIFIED NTEP trial data
            source: 'NTEP 2019 Indiana 2021: Rating 7.7/9 (#2 of 22 vegetative entries); Arkansas Extension: "Most Tolerant" category',
            notes: 'Cold tolerance correlates with SDS resistance - Tahoma 31 excels in both'
          },
          largePatch: {
            riskMultiplier: 0.85,
            confidence: 'medium',
            source: 'Extrapolated from SDS/cold tolerance correlation',
            notes: 'Cold-tolerant varieties typically show better large patch resistance'
          },
          dollarSpot: {
            riskMultiplier: 1.00,
            confidence: 'low',
            source: 'No specific NTEP dollar spot data for Tahoma 31',
            notes: 'Default baseline assumption'
          }
        }
      }
    },
    
    'TifTuf': {
      species: 'couch',
      displayName: 'TifTuf',
      
      // Multi-regional data: NTEP (US) + QSAC/STRI (subtropical AU)
      testedRegions: ['subtropical', 'ntep_us', 'au_subtropical'],
      
      regionalTraits: {
        
        subtropical: {
          // QSAC Brisbane 2020-2021 + STRI QLD 2019
          qualityRating: 7.6,
          qualitySource: 'QSAC Brisbane 2020-2021 + STRI 2019 (#1 overall in STRI)',
          
          traits: {
            wear: {
              multiplier: 0.85,
              confidence: 'high',
              source: 'QSAC: Best rhizome depth (30mm), highest root-shear (53.2 Nm), best canopeo (95%)',
              recoveryMultiplier: 0.80,
              notes: 'Excellent recovery potential - best ground cover in QSAC trial'
            },
            
            shade: {
              thresholdModifier: 0.90,
              confidence: 'high',
              source: 'STRI 2019: #1 colour retention under 60% shade',
              notes: 'Best shade performer in Australian trial - better than NTEP US data suggests'
            },
            
            salinity: {
              multiplier: 0.92,
              confidence: 'medium',
              source: 'NTEP salinity trials',
              notes: 'Good salt tolerance'
            },
            
            waterUse: {
              multiplier: 0.85,
              confidence: 'high',
              source: 'STRI 2019: #1 under deficit irrigation - maintained quality',
              notes: 'Drought tolerance validated in Australian conditions'
            },
            
            cold: {
              dormancyThresholdModifier: 1.00,
              winterkillRisk: 1.00,
              confidence: 'low',
              source: 'QSAC/STRI subtropical trials - mild winters only',
              notes: 'Cold tolerance NOT tested in Australia - use NTEP data for frost-prone areas'
            },
            
            springGreenup: {
              daysEarlier: 7,
              confidence: 'medium',
              source: 'NTEP spring greenup data',
              notes: 'Good but not exceptional'
            },
            
            disease: {
              springDeadSpot: {
                riskMultiplier: 1.15,
                confidence: 'high',
                source: 'NTEP 2019 Indiana: Rating 6.0/9; Arkansas Extension FSA-7551: "Least Tolerant"',
                notes: 'CAUTION: Below-average SDS resistance'
              },
              largePatch: { riskMultiplier: 1.10, confidence: 'medium', source: 'Correlated with SDS' },
              dollarSpot: { riskMultiplier: 0.90, confidence: 'medium', source: 'UGA trials' }
            }
          },
          
          managementNotes: {
            seedheadProduction: 'LOW - QSAC: Rated 1.94 (#3, low)',
            groundCover: 'EXCELLENT - 95% canopeo in summer (#1 in QSAC)',
            droughtTolerance: 'EXCELLENT - #1 in STRI deficit irrigation trial',
            source: 'QSAC Trial, STRI 2019'
          },
          
          trialData: {
            qsac_2020: {
              source: 'Matt Oliver, Stadiums Queensland QSAC Bermudagrass Trial',
              presentation: 'ASTMA Conference, June 2021',
              location: 'Queensland Sport & Athletics Centre, Brisbane',
              coordinates: { lat: -27.55, lng: 153.07 },
              years: '2020-2021',
              trialDuration: '7 months (Aug 2020 - May 2021)',
              overallRanking: { mean: 1.18, rank: '#3 (tied with AgriDark)', note: 'Lower = better' },
              metrics: {
                turfColour: { jan: 8.18, feb: 7.89, may: 7.58, rank: '#3 Jan, #4-5 May' },
                turfQuality: { jan: 7.88, feb: 7.04, may: 7.8, rank: '#3 Jan, #2 May' },
                canopeo: { jan: 95.0, feb: 60.3, unit: '%', rank: '#1 (best)' },
                rhizomeDepth: { jan: 30.0, feb: 24.5, unit: 'mm', rank: '#1 (deepest)' },
                rootShear: { jan: 44.1, feb: 53.2, unit: 'Nm', rank: '#1 (highest)' },
                traction: { jan: 62.8, feb: 47.2, unit: 'Nm', rank: '#1-2' },
                seedhead: { mean: 1.94, rank: '#3 (low)', scale: '1=none to 4=high' }
              },
              keyFindings: [
                'Highest canopeo (ground cover) of all varieties',
                'Best rhizome depth - excellent recovery potential',
                'Highest root-shear strength - superior stability'
              ]
            },
            stri_2019: {
              source: 'STRI Bermudagrass Cultivar Evaluation',
              location: 'Queensland',
              years: '2019',
              trialPeriod: 'May - November 2019',
              treatments: {
                shade: ['Full sun', '60% shade'],
                irrigation: ['Standard', 'Deficit'],
                wear: ['No wear', 'Wear applied']
              },
              rankings: {
                overall: '#1 of 8',
                droughtStress: '#1',
                shadeColour: '#1',
                turf_quality: '#1',
                ground_cover: '#1'
              },
              keyFindings: [
                'Best performer across ALL stress combinations',
                'Superior drought tolerance confirmed',
                'Best shade colour retention at 60% shade'
              ]
            }
          }
        },
        
        temperate: {
          // Interpolated from subtropical AU + NTEP US
          qualityRating: 7.0,
          qualitySource: 'Interpolated from QSAC/STRI (subtropical) + NTEP (US)',
          dataAvailable: 'interpolated',
          
          traits: {
            wear: {
              multiplier: 0.88,
              confidence: 'medium',
              source: 'Interpolated from QSAC (0.85) and NTEP (0.90)',
              notes: 'Strong performer expected based on trial data'
            },
            
            shade: {
              thresholdModifier: 0.95,
              confidence: 'medium',
              source: 'STRI showed excellent shade; NTEP showed average',
              notes: 'Australian conditions may favour TifTuf shade performance'
            },
            
            waterUse: {
              multiplier: 0.90,
              confidence: 'medium',
              source: 'STRI drought performance vs NTEP baseline',
              notes: 'Good drought tolerance expected'
            },
            
            cold: {
              dormancyThresholdModifier: 1.00,
              winterkillRisk: 1.00,
              confidence: 'medium',
              source: 'NTEP 2019-2023',
              notes: 'Standard cold tolerance - no Australian cold climate data'
            },
            
            disease: {
              springDeadSpot: { riskMultiplier: 1.15, confidence: 'high', source: 'NTEP/Arkansas data' },
              largePatch: { riskMultiplier: 1.10, confidence: 'medium', source: 'Correlated with SDS' },
              dollarSpot: { riskMultiplier: 0.90, confidence: 'medium', source: 'UGA trials' }
            }
          },
          
          notes: 'TifTuf not tested in temperate AU (Sydney/Melbourne) - interpolated from subtropical + US data'
        },
        
        cold: {
          // No Australian cold climate data
          qualityRating: 6.4,
          qualitySource: 'NTEP 2019-2023 only - NOT tested in Australian cold climates',
          dataAvailable: 'ntep_only',
          
          traits: {
            wear: {
              multiplier: 0.90,
              confidence: 'medium',
              source: 'NTEP 2019-2023 traffic trials',
              notes: 'US data only - Australian cold performance unknown'
            },
            
            cold: {
              dormancyThresholdModifier: 1.00,
              winterkillRisk: 1.00,
              confidence: 'medium',
              source: 'NTEP 2019-2023',
              notes: 'Standard cold tolerance for improved bermuda'
            },
            
            disease: {
              springDeadSpot: {
                riskMultiplier: 1.15,
                confidence: 'high',
                source: 'NTEP 2019 Indiana; Arkansas Extension FSA-7551',
                notes: 'CAUTION: "Least Tolerant" category - higher SDS risk in cold climates'
              },
              largePatch: { riskMultiplier: 1.10, confidence: 'medium', source: 'Correlated with SDS' },
              dollarSpot: { riskMultiplier: 0.90, confidence: 'medium', source: 'UGA trials' }
            }
          },
          
          recommendation: 'Consider Grand Prix or Santa Ana for cold climates - both tested at Royal Canberra GC',
          notes: 'TifTuf has NOT been tested in Australian cold climates. SDS susceptibility is a concern for frost-prone areas.'
        },
        
        ntep_us: {
          // NTEP baseline for reference
          qualityRating: 6.4,
          qualitySource: 'NTEP 2019-2023, 19 locations',
          
          traits: {
            wear: {
              multiplier: 0.90,
              confidence: 'high',
              source: 'NTEP 2019-2023 traffic trials',
              notes: 'Good recovery but not #1'
            },
            
            shade: {
              thresholdModifier: 1.00,
              confidence: 'medium',
              source: 'OSU shade trials - average shade performance',
              notes: 'Not in top group for shade tolerance'
            },
            
            salinity: {
              multiplier: 0.92,
              confidence: 'medium',
              source: 'NTEP salinity trials',
              notes: 'Good salt tolerance'
            },
            
            waterUse: {
              multiplier: 1.00,
              confidence: 'high',
              source: 'Amgain et al., 2018 - Reference cultivar in ET studies',
              notes: 'Higher water use than Tahoma 31 despite drought marketing'
            },
            
            cold: {
              dormancyThresholdModifier: 1.00,
              winterkillRisk: 1.00,
              confidence: 'high',
              source: 'NTEP 2019-2023',
              notes: 'Standard cold tolerance for improved bermuda'
            },
            
            springGreenup: {
              daysEarlier: 7,
              confidence: 'medium',
              source: 'NTEP spring greenup data',
              notes: 'Good but not exceptional'
            },
            
            disease: {
              springDeadSpot: {
                riskMultiplier: 1.15,
                confidence: 'high',
                source: 'NTEP 2019 Indiana 2021; Arkansas Extension FSA-7551: "Least Tolerant"',
                notes: 'CAUTION: Below-average SDS resistance'
              },
              largePatch: { riskMultiplier: 1.10, confidence: 'medium', source: 'Correlated with SDS' },
              dollarSpot: { riskMultiplier: 0.90, confidence: 'medium', source: 'UGA trials' }
            }
          }
        }
      }
    },
    
    'Wintergreen': {
      species: 'couch',
      displayName: 'Wintergreen',
      
      // Subtropical data only - but cold tolerance noted in breeding
      testedRegions: ['subtropical', 'au_subtropical'],
      
      regionalTraits: {
        
        subtropical: {
          // TU08018 Redlands 2009-2012 + STRI QLD 2019
          qualityRating: 6.3,
          qualitySource: 'HAL TU08018 DAFFQ Redlands + STRI 2019 (#2 overall)',
          
          traits: {
            wear: {
              multiplier: 0.88,
              confidence: 'high',
              source: 'TU08018 Phase 1: RANK #1 - 0% time ≥15% wear, 2% mean bare ground over 1,445 games',
              recoveryMultiplier: 0.90,
              notes: 'Best actual wear performer at RTA touch fields'
            },
            
            shade: {
              thresholdModifier: 1.00,
              confidence: 'medium',
              source: 'STRI 2019: #3 shade colour',
              notes: 'Reasonable shade tolerance'
            },
            
            waterUse: {
              multiplier: 0.65,
              confidence: 'high',
              source: 'TU08018 citing Ervin & Koski 1997',
              notes: '35% less water than cool-season grasses'
            },
            
            cold: {
              dormancyThresholdModifier: 0.90,
              winterkillRisk: 0.85,
              confidence: 'medium',
              source: 'Selected for Victorian/SA conditions',
              notes: 'Good cold tolerance expected but not tested in TU08007'
            },
            
            springGreenup: {
              daysEarlier: 10,
              confidence: 'high',
              source: 'TU08018: Holds darker green longer before winter',
              notes: 'Extended growing season'
            },
            
            disease: {
              springDeadSpot: { riskMultiplier: 0.85, confidence: 'high', source: 'Cold tolerance correlates with SDS resistance' },
              largePatch: { riskMultiplier: 0.90, confidence: 'medium', source: 'Australian surveys' },
              dollarSpot: { riskMultiplier: 1.00, confidence: 'medium', source: 'Average' }
            }
          },
          
          managementNotes: {
            seedheadProduction: 'HIGH - TU08018: Rated 6.8/9 (worst of Cynodon tested)',
            mowingImplication: 'Requires frequent mowing for seedhead control',
            source: 'TU08018 Table 8'
          },
          
          trialData: {
            tu08018: {
              source: 'HAL TU08018 - Traffic Tolerance of Warm-Season Turfgrasses',
              institution: 'DAFFQ Redlands Research Facility',
              location: 'Redlands, QLD',
              years: '2009-2012',
              actualWear: {
                location: 'Redlands Touch Association',
                games: 1445,
                meanBareGround: 2,
                maxBareGround: 13,
                timeOver15Percent: 0,
                rank: '#1 (tied)'
              }
            },
            stri_2019: {
              source: 'STRI Bermudagrass Cultivar Evaluation',
              location: 'Queensland',
              years: '2019',
              rankings: {
                overall: '#2 of 8',
                droughtStress: '#2',
                shadeColour: '#3',
                turf_quality: '#2-3',
                ground_cover: '#2'
              },
              keyFindings: [
                'Strong overall performer - #2 behind TifTuf',
                'Good drought tolerance',
                'Validates industry standard status'
              ]
            }
          }
        },
        
        temperate: {
          // Good cold tolerance breeding but no formal trial
          qualityRating: 6.5,
          qualitySource: 'Interpolated from subtropical + cold tolerance breeding',
          dataAvailable: 'interpolated',
          
          traits: {
            wear: { multiplier: 0.90, confidence: 'medium', source: 'Interpolated from TU08018' },
            cold: { dormancyThresholdModifier: 0.90, winterkillRisk: 0.85, confidence: 'medium', source: 'Bred for VIC/SA' },
            disease: { springDeadSpot: { riskMultiplier: 0.85, confidence: 'medium', source: 'Cold tolerance heritage' } }
          },
          
          notes: 'Wintergreen bred for Victorian/SA conditions - should perform well in temperate zones'
        },
        
        cold: {
          // Not tested in TU08007 but has cold tolerance breeding
          qualityRating: 6.0,
          qualitySource: 'Extrapolated from cold tolerance breeding - NOT formally tested',
          dataAvailable: 'extrapolated',
          
          traits: {
            cold: { dormancyThresholdModifier: 0.92, winterkillRisk: 0.88, confidence: 'low', source: 'Breeding claims only' }
          },
          
          recommendation: 'Consider Grand Prix (#1 TU08007) for proven cold climate performance',
          notes: 'Wintergreen not tested at Royal Canberra GC - cold performance is assumed from breeding'
        }
      }
    },
    
    // ─────────────────────────────────────────────────────────────────────────
    // AUSTRALIAN WARM CLIMATE COUCH VARIETIES
    // Source: HAL TU08018 DAFFQ Trial, Redlands QLD 2009-2012
    // ─────────────────────────────────────────────────────────────────────────
    
    'OZ TUFF': {
      species: 'couch',
      displayName: 'OZ TUFF',
      
      // Subtropical data only - wear champion but struggles under other stresses
      testedRegions: ['subtropical', 'au_subtropical'],
      
      regionalTraits: {
        
        subtropical: {
          // TU08018 (wear #1) + STRI 2019 (#6 overall)
          qualityRating: 7.0,
          qualitySource: 'HAL TU08018 DAFFQ Redlands - #1 wear tolerance',
          
          traits: {
            wear: {
              multiplier: 0.75,
              confidence: 'high',
              source: 'TU08018: 0% time ≥15% wear across ALL 4 years (only variety to achieve this)',
              recoveryMultiplier: 0.80,
              notes: 'OUTSTANDING wear tolerance - best in trial by significant margin'
            },
            
            shade: {
              thresholdModifier: 1.15,
              confidence: 'high',
              source: 'STRI 2019: #6-7 shade colour - POOR',
              notes: 'CAUTION: Poor shade tolerance revealed in STRI trial'
            },
            
            waterUse: {
              multiplier: 0.75,
              confidence: 'medium',
              source: 'STRI 2019: #6 under deficit irrigation - STRUGGLED',
              notes: 'CAUTION: Poor drought tolerance despite wear excellence'
            },
            
            cold: {
              dormancyThresholdModifier: 1.00,
              winterkillRisk: 1.00,
              confidence: 'low',
              source: 'TU08018 Redlands - not cold climate tested',
              notes: 'Cold tolerance unknown'
            },
            
            disease: {
              springDeadSpot: { riskMultiplier: 1.00, confidence: 'low', source: 'Not tested' },
              largePatch: { riskMultiplier: 1.00, confidence: 'low', source: 'Not tested' },
              dollarSpot: { riskMultiplier: 1.00, confidence: 'low', source: 'Not tested' }
            }
          },
          
          managementNotes: {
            seedheadProduction: 'LOW - TU08018: Rated 0.0/9 (best)',
            bestUseCase: 'High-wear, full-sun, well-irrigated applications ONLY',
            warning: 'NOT suitable for shade or drought-prone sites',
            source: 'TU08018, STRI 2019'
          },
          
          trialData: {
            tu08018: {
              source: 'HAL TU08018 - Traffic Tolerance of Warm-Season Turfgrasses',
              institution: 'DAFFQ Redlands Research Facility',
              location: 'Redlands, QLD',
              years: '2009-2012',
              simulatedWear: {
                wearEvents: 85,
                year1: { timeOver15: 0, meanBare: 2, maxBare: 8, rank: '#1' },
                year2: { timeOver15: 0, meanBare: 4, maxBare: 14, rank: '#1' },
                year3: { timeOver15: 0, meanBare: 2, maxBare: 9, rank: '#1' },
                year4: { timeOver15: 0, meanBare: 0, maxBare: 2, rank: '#1' }
              },
              actualWear: {
                location: 'Redlands Touch Association',
                games: 1445,
                meanBareGround: 2,
                maxBareGround: 17,
                timeOver15Percent: 1,
                rank: '#1 (tied)'
              },
              keyFinding: 'ONLY variety to achieve 0% time over 15% bare ground in all 4 years'
            },
            stri_2019: {
              source: 'STRI Bermudagrass Cultivar Evaluation',
              location: 'Queensland',
              years: '2019',
              rankings: {
                overall: '#6 of 8',
                droughtStress: '#6',
                shadeColour: '#6-7',
                turf_quality: '#6',
                wearTolerance: '#4-5'
              },
              keyFindings: [
                'Wear champion dropped to #6 overall under stress',
                'Drought/shade weaknesses exposed',
                'Best for specific high-wear applications only'
              ]
            }
          }
        },
        
        temperate: {
          qualityRating: null,
          qualitySource: 'NOT TESTED',
          dataAvailable: false,
          recommendation: 'Consider TifTuf or Wintergreen for temperate zones',
          notes: 'OZ TUFF untested in temperate climates; drought weakness suggests poor performance in dry temperate conditions'
        },
        
        cold: {
          qualityRating: null,
          qualitySource: 'NOT TESTED',
          dataAvailable: false,
          recommendation: 'Consider Grand Prix (#1 TU08007) for cold climates',
          notes: 'OZ TUFF cold tolerance unknown - not recommended for frost-prone areas'
        }
      }
    },
    
    'Iron Cutter': {
      species: 'couch',
      displayName: 'Iron Cutter',
      
      // Sports turf variety - Australian market
      qualityRating: 6.2,
      qualitySource: 'Australian turf industry assessment',

      testedRegions: ['au_temperate', 'au_subtropical'],
      
      traits: {
        wear: {
          multiplier: 0.88,
          confidence: 'medium',
          source: 'Australian sports turf trials',
          notes: 'Bred for high traffic sports applications'
        },
        
        shade: {
          thresholdModifier: 1.00,
          confidence: 'medium',
          source: 'Australian turf research',
          notes: 'Average shade tolerance for couch'
        },
        
        waterUse: {
          multiplier: 0.95,
          confidence: 'medium',
          source: 'Australian irrigation assessments',
          notes: 'Good drought tolerance'
        },
        
        cold: {
          dormancyThresholdModifier: 1.00,
          winterkillRisk: 1.00,
          confidence: 'medium',
          source: 'Australian experience',
          notes: 'Standard cold tolerance'
        },
        
        springGreenup: {
          daysEarlier: 5,
          confidence: 'medium',
          source: 'Australian industry observation',
          notes: 'Good spring recovery'
        },
        
        disease: {
          springDeadSpot: {
            riskMultiplier: 0.80, // Good resistance
            confidence: 'high',
            source: 'NTEP 2013 Columbia MO 2016-17: SDS rating 7.5/9 (best of trial entries); Mean quality 7.5',
            notes: 'Excellent SDS resistance - top performer in NTEP disease trials'
          },
          largePatch: {
            riskMultiplier: 0.90,
            confidence: 'medium',
            source: 'Correlated with SDS resistance',
            notes: 'Good SDS resistance suggests above-average large patch tolerance'
          },
          dollarSpot: {
            riskMultiplier: 0.95,
            confidence: 'medium',
            source: 'Australian sports turf observations - bred for turf quality',
            notes: 'Slightly above average resistance'
          }
        }
      }
    },
    
    'Legend': {
      species: 'couch',
      displayName: 'Legend',
      cultivarCode: 'C1',
      
      // Multi-regional data - POOR performer in both cold AND subtropical
      testedRegions: ['cold', 'subtropical', 'au_temperate', 'au_subtropical'],
      
      regionalTraits: {
        
        cold: {
          // TU08007 Royal Canberra GC 2010-2012
          qualityRating: 6.1,
          qualitySource: 'HAL TU08007 Royal Canberra GC trial 2010-2012',
          
          traits: {
            wear: {
              multiplier: 1.10,
              confidence: 'medium',
              source: 'TU08007: Lowest shoot density (50.9/dm²) suggests poor wear recovery',
              notes: 'Low density = poor wear tolerance'
            },
            
            waterUse: {
              multiplier: 0.65,
              confidence: 'high',
              source: 'TU08007 citing Emekli et al 2007',
              notes: '35% less water than cool-season grasses'
            },
            
            cold: {
              dormancyThresholdModifier: 1.00,
              winterkillRisk: 1.15,
              confidence: 'high',
              source: 'TU08007 Table 4: 50.9 shoots/dm² post-winter (lowest of vegetative varieties)',
              notes: 'POOR cold tolerance - significant winter shoot loss'
            },
            
            springGreenup: {
              daysEarlier: 0,
              confidence: 'high',
              source: 'TU08007 Table 6: Green-up ~20 Sept in Canberra',
              notes: 'Standard spring greenup timing'
            },
            
            disease: {
              springDeadSpot: { riskMultiplier: 1.05, confidence: 'medium', source: 'Australian observations' },
              largePatch: { riskMultiplier: 1.00, confidence: 'medium', source: 'Not tested' },
              dollarSpot: { riskMultiplier: 1.00, confidence: 'medium', source: 'Not tested' }
            }
          },
          
          trialData: {
            tu08007: {
              source: 'HAL TU08007 - Cold Climate Evaluations',
              location: 'Royal Canberra Golf Club, ACT',
              coordinates: { lat: -35.30, lng: 149.10 },
              years: '2010-2012',
              turfQuality: { mean: 6.1, range: [5.1, 7.0] },
              shootDensity: { value: 50.9, unit: 'shoots/dm²', rank: 'Lowest of vegetative types' },
              dormancyPeriod: { months: 4.5 },
              keyFindings: [
                'Lowest shoot density of vegetative varieties',
                'Poor cold tolerance',
                'Significant winter shoot loss'
              ]
            }
          },
          
          recommendation: 'NOT RECOMMENDED for cold climates - consider Grand Prix (#1) or Santa Ana (#2)'
        },
        
        subtropical: {
          // TU08018 + QSAC + STRI - consistent poor wear performer
          qualityRating: 5.5,
          qualitySource: 'HAL TU08018, QSAC 2020-2021, STRI 2019',
          
          traits: {
            wear: {
              multiplier: 1.15,
              confidence: 'high',
              source: 'TU08018: RANK #6 (WORST) - 40% time ≥15% wear, 18% mean bare ground in actual play',
              recoveryMultiplier: 1.20,
              notes: 'CAUTION: WORST wear performer in actual play conditions'
            },
            
            shade: {
              thresholdModifier: 1.05,
              confidence: 'medium',
              source: 'STRI 2019: #4-5 shade colour - average',
              notes: 'Average shade tolerance'
            },
            
            waterUse: {
              multiplier: 0.65,
              confidence: 'high',
              source: 'TU08018 citing Emekli et al 2007',
              notes: '35% less water than cool-season grasses'
            },
            
            cold: {
              dormancyThresholdModifier: 1.00,
              winterkillRisk: 1.00,
              confidence: 'low',
              source: 'Subtropical trials - mild winters',
              notes: 'Cold tolerance poor based on TU08007'
            },
            
            disease: {
              springDeadSpot: { riskMultiplier: 1.05, confidence: 'medium', source: 'Australian observations' },
              largePatch: { riskMultiplier: 1.00, confidence: 'medium', source: 'Not tested' },
              dollarSpot: { riskMultiplier: 1.00, confidence: 'medium', source: 'Not tested' }
            }
          },
          
          managementNotes: {
            seedheadProduction: 'MODERATE - QSAC: Rated 2.44 (#4)',
            wearWarning: 'CRITICAL: Worst actual wear performer in TU08018 - avoid for sports turf',
            source: 'TU08018, QSAC Trial'
          },
          
          trialData: {
            tu08018: {
              source: 'HAL TU08018 - Traffic Tolerance Study',
              location: 'DAFFQ Redlands & RTA, QLD',
              years: '2009-2012',
              simulatedWear: {
                year1: { timeOver15: 30, meanBare: 12, maxBare: 44, rank: '#2' },
                year2: { timeOver15: 64, meanBare: 25, maxBare: 70, rank: '#2' },
                year3: { timeOver15: 41, meanBare: 16, maxBare: 41, rank: '#2' },
                year4: { timeOver15: 8, meanBare: 8, maxBare: 18, rank: '#1' }
              },
              actualWear: {
                location: 'Redlands Touch Association',
                games: 1445,
                meanBareGround: 18,
                maxBareGround: 80,
                timeOver15Percent: 40,
                rank: '#6 (WORST of Cynodon varieties)',
                turfQuality: { mean: 4.9, min: 1.8 }
              },
              keyFinding: 'WARNING: Performed well in simulated wear but POORLY in actual play conditions'
            },
            qsac_2020: {
              source: 'Matt Oliver, Stadiums Queensland QSAC Bermudagrass Trial',
              location: 'Queensland Sport & Athletics Centre, Brisbane',
              coordinates: { lat: -27.55, lng: 153.07 },
              years: '2020-2021',
              overallRanking: { mean: 1.25, rank: '#5', note: 'Lower = better' },
              metrics: {
                turfColour: { jan: 8.23, feb: 7.83, may: 7.42, rank: '#2 Jan, #6 May' },
                turfQuality: { jan: 6.88, feb: 6.69, may: 7.5, rank: '#4-5' },
                canopeo: { jan: 83.5, feb: 56.0, unit: '%', rank: '#4-5' },
                seedhead: { mean: 2.44, rank: '#4 (moderate)', scale: '1=none to 4=high' }
              },
              keyFindings: [
                'Mid-pack performer overall',
                'Good summer colour but fades in autumn',
                'CONFIRMS TU08018: recovery OK but sustained wear problematic'
              ]
            },
            stri_2019: {
              source: 'STRI Bermudagrass Cultivar Evaluation',
              location: 'Queensland',
              years: '2019',
              rankings: {
                overall: '#4-5 of 8',
                droughtStress: '#4',
                shadeColour: '#4-5',
                turf_quality: '#4-5'
              },
              notes: 'Consistent mid-pack performer'
            }
          },
          
          recommendation: 'NOT RECOMMENDED for sports turf - worst actual wear performer in TU08018'
        },
        
        temperate: {
          // Interpolated - poor in both extremes suggests poor everywhere
          qualityRating: 5.5,
          qualitySource: 'Interpolated - poor performer in both cold and subtropical trials',
          dataAvailable: 'interpolated',
          
          traits: {
            wear: {
              multiplier: 1.12,
              confidence: 'medium',
              source: 'Interpolated from poor performance in both climate zones',
              notes: 'Likely poor wear tolerance in temperate zones too'
            },
            
            cold: {
              dormancyThresholdModifier: 1.00,
              winterkillRisk: 1.10,
              confidence: 'medium',
              source: 'TU08007 showed poor cold tolerance',
              notes: 'Expect moderate winter issues'
            },
            
            disease: {
              springDeadSpot: { riskMultiplier: 1.05, confidence: 'medium', source: 'Interpolated' },
              largePatch: { riskMultiplier: 1.00, confidence: 'low', source: 'Not tested' },
              dollarSpot: { riskMultiplier: 1.00, confidence: 'low', source: 'Not tested' }
            }
          },
          
          recommendation: 'NOT RECOMMENDED - consider TifTuf, Santa Ana, or Wintergreen instead'
        }
      }
    },
    
    // ─────────────────────────────────────────────────────────────────────────
    // AUSTRALIAN COLD CLIMATE COUCH VARIETIES
    // Source: HAL TU08007 University of Sydney Trial, Royal Canberra GC 2010-2012
    // ─────────────────────────────────────────────────────────────────────────
    
    'Grand Prix': {
      species: 'couch',
      displayName: 'Grand Prix',
      
      // Multi-regional data: Cold (TU08007 #1) vs Subtropical (STRI #5)
      testedRegions: ['cold', 'subtropical', 'au_temperate', 'au_subtropical'],
      
      regionalTraits: {
        
        cold: {
          // TU08007 Royal Canberra GC 2010-2012 - 103-124 frost days/year
          qualityRating: 7.9,
          qualitySource: 'HAL TU08007 Royal Canberra GC trial 2010-2012 - Ranked #1 all assessments',
          
          traits: {
            wear: {
              multiplier: 0.88,
              confidence: 'high',
              source: 'TU08007: Highest shoot density (95.8/dm²) = best wear recovery potential',
              notes: 'Dense turf maintained through cold winters'
            },
            
            shade: {
              thresholdModifier: 1.00,
              confidence: 'low',
              source: 'Not tested in TU08007',
              notes: 'No shade data from cold climate trial'
            },
            
            waterUse: {
              multiplier: 0.65,
              confidence: 'high',
              source: 'TU08007 citing Emekli et al 2007 - 40-45% pan evaporation',
              notes: '35% less water than cool-season grasses'
            },
            
            cold: {
              dormancyThresholdModifier: 0.90,
              winterkillRisk: 0.80,
              confidence: 'high',
              source: 'TU08007 Table 4: 95.8 shoots/dm² post-winter (BEST of all varieties)',
              notes: 'Best cold tolerance in Canberra trial with 103-124 frost days/year'
            },
            
            springGreenup: {
              daysEarlier: 0,
              confidence: 'high',
              source: 'TU08007 Table 6: Green-up ~20 Sept',
              notes: 'Standard spring timing but fastest quality recovery'
            },
            
            disease: {
              springDeadSpot: {
                riskMultiplier: 0.95,
                confidence: 'medium',
                source: 'TU08007: Low weed abundance suggests dense healthy turf',
                notes: 'Dense turf less susceptible to disease entry'
              },
              largePatch: { riskMultiplier: 1.00, confidence: 'low', source: 'Not tested' },
              dollarSpot: { riskMultiplier: 1.00, confidence: 'low', source: 'Not tested' }
            }
          },
          
          trialData: {
            tu08007: {
              source: 'HAL TU08007 - Warm Season Grass Evaluations for Turf in Cold Climates',
              institution: 'University of Sydney',
              location: 'Royal Canberra Golf Club, ACT',
              coordinates: { lat: -35.30, lng: 149.10 },
              years: '2010-2012',
              frostDays: '103-124 per year',
              turfQuality: { mean: 7.9, range: [7.5, 8.5], scale: '0-10' },
              shootDensity: { value: 95.8, unit: 'shoots/dm²', timing: 'Oct 2011 post-winter', rank: '#1' },
              coverPersistence: { range: [92, 100], unit: '%' },
              dormancyPeriod: { start: '5-10 May', end: '20 Sept', months: 4.5 },
              weedAbundance: 'Lowest of all varieties tested',
              keyFindings: [
                'BEST overall performer in cold climate trial',
                'Highest shoot density after winter',
                'Best turf quality - only variety consistently >7.0',
                'Lowest weed abundance'
              ]
            }
          }
        },
        
        subtropical: {
          // STRI QLD 2019 - notably poorer performance than cold climate
          qualityRating: 6.0,
          qualitySource: 'STRI QLD 2019 - Ranked #5 of 8 (mid-pack)',
          
          traits: {
            wear: {
              multiplier: 1.00,
              confidence: 'medium',
              source: 'STRI 2019: #4-5 ground cover',
              notes: 'Average wear tolerance in subtropical conditions'
            },
            
            shade: {
              thresholdModifier: 1.10,
              confidence: 'medium',
              source: 'STRI 2019: #5-6 shade colour - below average',
              notes: 'Poor shade response in subtropical trial'
            },
            
            waterUse: {
              multiplier: 0.65,
              confidence: 'high',
              source: 'Couch baseline',
              notes: '35% less water than cool-season grasses'
            },
            
            cold: {
              dormancyThresholdModifier: 1.00,
              winterkillRisk: 1.00,
              confidence: 'low',
              source: 'STRI subtropical - mild winters',
              notes: 'Cold tolerance proven in TU08007 cold region data'
            },
            
            disease: {
              springDeadSpot: { riskMultiplier: 1.00, confidence: 'low', source: 'Not tested' },
              largePatch: { riskMultiplier: 1.00, confidence: 'low', source: 'Not tested' },
              dollarSpot: { riskMultiplier: 1.00, confidence: 'low', source: 'Not tested' }
            }
          },
          
          trialData: {
            stri_2019: {
              source: 'STRI Bermudagrass Cultivar Evaluation',
              location: 'Queensland',
              years: '2019',
              trialPeriod: 'May - November 2019',
              treatments: {
                shade: ['Full sun', '60% shade'],
                irrigation: ['Standard', 'Deficit'],
                wear: ['No wear', 'Wear applied']
              },
              rankings: {
                overall: '#5 of 8',
                droughtStress: '#5',
                shadeColour: '#5-6',
                turf_quality: '#5',
                ground_cover: '#4-5'
              },
              keyFindings: [
                'Mid-pack performer in subtropical conditions',
                'Cold climate champion less dominant in warm climate',
                'Suggests Grand Prix optimised for temperate/cold zones'
              ]
            }
          },
          
          notes: 'CAUTION: Grand Prix dropped from #1 (cold) to #5 (subtropical) - not recommended for QLD'
        },
        
        temperate: {
          // Interpolated - likely good based on cold performance
          qualityRating: 7.2,
          qualitySource: 'Interpolated from TU08007 (cold) - favourable for cooler temperate zones',
          dataAvailable: 'interpolated',
          
          traits: {
            wear: {
              multiplier: 0.90,
              confidence: 'medium',
              source: 'Interpolated from cold (0.88) and subtropical (1.00)',
              notes: 'Better in cooler conditions'
            },
            
            cold: {
              dormancyThresholdModifier: 0.92,
              winterkillRisk: 0.85,
              confidence: 'medium',
              source: 'Interpolated from TU08007',
              notes: 'Should perform well in Melbourne/Adelaide winters'
            },
            
            disease: {
              springDeadSpot: { riskMultiplier: 0.97, confidence: 'medium', source: 'Interpolated' },
              largePatch: { riskMultiplier: 1.00, confidence: 'low', source: 'Not tested' },
              dollarSpot: { riskMultiplier: 1.00, confidence: 'low', source: 'Not tested' }
            }
          },
          
          notes: 'Grand Prix likely performs better in cooler temperate zones (Melbourne, Adelaide) than warmer (Sydney, Perth)'
        }
      }
    },
    
    'Santa Ana': {
      species: 'couch',
      displayName: 'Santa Ana',
      
      // Multi-regional performer - tested in both cold and subtropical climates
      testedRegions: ['cold', 'subtropical', 'au_temperate', 'au_subtropical'],
      
      regionalTraits: {
        
        cold: {
          // TU08007 Royal Canberra GC 2010-2012 - 103-124 frost days/year
          qualityRating: 6.7,
          qualitySource: 'HAL TU08007 Royal Canberra GC trial 2010-2012',
          
          traits: {
            wear: {
              multiplier: 0.90,
              confidence: 'high',
              source: 'TU08007: High shoot density (92.7/dm²) indicates good wear recovery',
              notes: 'Second highest density after Grand Prix in cold trial'
            },
            
            waterUse: {
              multiplier: 0.65,
              confidence: 'high',
              source: 'TU08007 citing Emekli et al 2007',
              notes: '35% less water than cool-season grasses'
            },
            
            cold: {
              dormancyThresholdModifier: 0.92,
              winterkillRisk: 0.82,
              confidence: 'high',
              source: 'TU08007 Table 4: 92.7 shoots/dm² post-winter (second best)',
              notes: 'Good cold tolerance; later dormancy entry (15 May vs 10 May for others)'
            },
            
            springGreenup: {
              daysEarlier: 0,
              confidence: 'high',
              source: 'TU08007 Table 6',
              notes: 'Standard spring greenup timing'
            },
            
            disease: {
              springDeadSpot: { riskMultiplier: 1.00, confidence: 'low', source: 'Not tested' },
              largePatch: { riskMultiplier: 1.00, confidence: 'low', source: 'Not tested' },
              dollarSpot: { riskMultiplier: 1.00, confidence: 'low', source: 'Not tested' }
            }
          },
          
          trialData: {
            tu08007: {
              source: 'HAL TU08007 - Warm Season Grass Evaluations for Turf in Cold Climates',
              institution: 'University of Sydney',
              location: 'Royal Canberra Golf Club, ACT',
              coordinates: { lat: -35.30, lng: 149.10 },
              years: '2010-2012',
              frostDays: '103-124 per year',
              turfQuality: { mean: 6.7, range: [6.1, 7.9], scale: '0-10' },
              shootDensity: { value: 92.7, unit: 'shoots/dm²', timing: 'Oct 2011', rank: '#2' },
              coverPersistence: { range: [89, 99], unit: '%' },
              dormancyPeriod: { start: '15 May', end: '19 Sept', months: 4 },
              keyFindings: [
                'Second best cold tolerance after Grand Prix',
                'Later dormancy entry than other varieties',
                'Good shoot survival through winter'
              ]
            }
          }
        },
        
        subtropical: {
          // QSAC Brisbane 2020-2021 + STRI QLD 2019
          qualityRating: 7.6,
          qualitySource: 'QSAC Brisbane 2020-2021 (mean quality 7.4-8.0)',
          
          traits: {
            wear: {
              multiplier: 0.85,
              confidence: 'high',
              source: 'QSAC: #1-2 recovery in wedge tests; highest shear strength (18.3 kPa)',
              recoveryMultiplier: 0.82,
              notes: 'Excellent recovery - best in QSAC trial for wear recovery'
            },
            
            shade: {
              thresholdModifier: 1.00,
              confidence: 'medium',
              source: 'STRI 2019: #3-4 shade colour - reasonable but not exceptional',
              notes: 'Average shade tolerance for couch'
            },
            
            waterUse: {
              multiplier: 0.65,
              confidence: 'high',
              source: 'Couch baseline - 40-45% pan evaporation',
              notes: '35% less water than cool-season grasses'
            },
            
            cold: {
              dormancyThresholdModifier: 1.00,
              winterkillRisk: 1.00,
              confidence: 'medium',
              source: 'QSAC subtropical - mild winters',
              notes: 'Cold tolerance validated in TU08007 cold region data'
            },
            
            springGreenup: {
              daysEarlier: 0,
              confidence: 'medium',
              source: 'QSAC',
              notes: 'Standard timing in subtropical conditions'
            },
            
            disease: {
              springDeadSpot: { riskMultiplier: 1.00, confidence: 'low', source: 'Not tested' },
              largePatch: { riskMultiplier: 1.00, confidence: 'low', source: 'Not tested' },
              dollarSpot: { riskMultiplier: 1.00, confidence: 'low', source: 'Not tested' }
            }
          },
          
          managementNotes: {
            seedheadProduction: 'VERY LOW - QSAC: Rated 1.14 (best of all varieties, tied with AgriDark)',
            colourRetention: 'EXCELLENT - Consistently top 3 colour across all assessments',
            recoveryRate: 'EXCELLENT - #1-2 in both summer and autumn wedge recovery',
            source: 'QSAC Trial Fig 13, Fig 11'
          },
          
          trialData: {
            qsac_2020: {
              source: 'Matt Oliver, Stadiums Queensland QSAC Bermudagrass Trial',
              presentation: 'ASTMA Conference, June 2021',
              location: 'Queensland Sport & Athletics Centre, Brisbane',
              coordinates: { lat: -27.55, lng: 153.07 },
              years: '2020-2021',
              trialDuration: '7 months (Aug 2020 - May 2021)',
              overallRanking: { mean: 1.14, rank: '#1 (BEST overall)', note: 'Lower = better' },
              metrics: {
                turfColour: { jan: 8.05, feb: 8.12, may: 7.75, rank: '#3 Jan, #1-2 overall' },
                turfQuality: { jan: 7.75, feb: 7.39, may: 8.0, rank: '#2 Jan, #2 May' },
                canopeo: { jan: 87.2, feb: 60.0, unit: '%', rank: '#3-4' },
                rhizomeDepth: { jan: 19.8, feb: 29.5, unit: 'mm', rank: '#3 May' },
                rootShear: { jan: 29.3, feb: 44.3, unit: 'Nm', notes: 'Good stability' },
                traction: { jan: 59.0, feb: 53.3, unit: 'Nm', rank: '#2 consistently' },
                shear: { jan: 18.3, unit: 'kPa', rank: '#1 (highest)' },
                seedhead: { mean: 1.14, rank: '#1 (best - lowest)', scale: '1=none to 4=high' }
              },
              recoveryTests: {
                summerWedge: { rank: '#2 (Jan), #1 (Feb)', notes: 'Excellent summer recovery' },
                autumnWedge: { rank: '#2 (Apr, May)', notes: 'Very good autumn recovery' }
              },
              keyFindings: [
                'BEST overall performer in QSAC trial',
                'Best seedhead suppression (tied with AgriDark)',
                'Excellent recovery from damage',
                'Highest shear strength'
              ]
            },
            stri_2019: {
              source: 'STRI Bermudagrass Cultivar Evaluation',
              location: 'Queensland',
              years: '2019',
              trialPeriod: 'May - November 2019',
              rankings: {
                overall: '#3 of 8',
                droughtStress: '#3 - good performance under deficit irrigation',
                shadeColour: '#3-4 - reasonable shade colour',
                turf_quality: '#3'
              },
              notes: 'Consistent mid-to-high performer across stress combinations'
            }
          }
        },
        
        temperate: {
          // Interpolated from cold + subtropical data
          qualityRating: 7.0,
          qualitySource: 'Interpolated from TU08007 (cold) and QSAC (subtropical) trials',
          dataAvailable: 'interpolated',
          
          traits: {
            wear: {
              multiplier: 0.88,
              confidence: 'medium',
              source: 'Interpolated: TU08007 0.90 + QSAC 0.85',
              notes: 'Good performer in both climate extremes suggests reliable temperate performance'
            },
            
            waterUse: {
              multiplier: 0.65,
              confidence: 'high',
              source: 'Consistent across trials',
              notes: '35% less water than cool-season grasses'
            },
            
            cold: {
              dormancyThresholdModifier: 0.95,
              winterkillRisk: 0.90,
              confidence: 'medium',
              source: 'Interpolated from TU08007 cold performance',
              notes: 'Proven cold tolerance in Canberra suggests good Sydney/Melbourne winter survival'
            },
            
            disease: {
              springDeadSpot: { riskMultiplier: 1.00, confidence: 'low', source: 'Not tested' },
              largePatch: { riskMultiplier: 1.00, confidence: 'low', source: 'Not tested' },
              dollarSpot: { riskMultiplier: 1.00, confidence: 'low', source: 'Not tested' }
            }
          },
          
          notes: 'Santa Ana performs well in both cold (Canberra #2) and subtropical (Brisbane #1) trials - reasonable confidence for temperate zones'
        }
      }
    },
    
    'Windsor Green': {
      species: 'couch',
      displayName: 'Windsor Green',
      
      // Cold climate data only - TU08007 Canberra
      testedRegions: ['cold', 'au_temperate'],
      
      regionalTraits: {
        cold: {
          qualityRating: 6.6,
          qualitySource: 'HAL TU08007 Royal Canberra GC trial 2010-2012',
          
          traits: {
            wear: {
              multiplier: 0.92,
              confidence: 'high',
              source: 'TU08007: 81.3 shoots/dm² - moderate density',
              notes: 'Good wear recovery, improved over time'
            },
            
            waterUse: {
              multiplier: 0.65,
              confidence: 'high',
              source: 'TU08007 citing Emekli et al 2007',
              notes: '35% less water than cool-season grasses'
            },
            
            cold: {
              dormancyThresholdModifier: 0.95,
              winterkillRisk: 0.88,
              confidence: 'high',
              source: 'TU08007 Table 4: 81.3 shoots/dm², rapid recovery to 100% cover',
              notes: 'Excellent adaptation - improved from 4.88 to 8.0 quality over trial'
            },
            
            springGreenup: {
              daysEarlier: 0,
              confidence: 'high',
              source: 'TU08007 Table 6: Fastest visual recovery',
              notes: 'Rapid spring recovery'
            },
            
            disease: {
              springDeadSpot: { riskMultiplier: 1.00, confidence: 'low', source: 'Not tested' },
              largePatch: { riskMultiplier: 1.00, confidence: 'low', source: 'Not tested' },
              dollarSpot: { riskMultiplier: 1.00, confidence: 'low', source: 'Not tested' }
            }
          },
          
          trialData: {
            tu08007: {
              source: 'HAL TU08007',
              location: 'Royal Canberra Golf Club, ACT',
              years: '2010-2012',
              turfQuality: { mean: 6.6, range: [4.9, 8.0], scale: '0-10', trend: 'improving' },
              shootDensity: { value: 81.3, unit: 'shoots/dm²', rank: '#3' },
              coverPersistence: { range: [77, 100], unit: '%', notes: 'Most improved' },
              dormancyPeriod: { start: '8-15 May', end: '19 Sept', months: 4 }
            }
          }
        },
        
        subtropical: {
          qualityRating: null,
          dataAvailable: false,
          notes: 'Windsor Green not tested in subtropical conditions'
        },
        
        temperate: {
          qualityRating: 6.5,
          qualitySource: 'Interpolated from TU08007 cold data',
          dataAvailable: 'interpolated',
          notes: 'Good cold adaptation suggests reasonable temperate performance'
        }
      }
    },
    
    'Conquest': {
      species: 'couch',
      displayName: 'Conquest',
      
      // Cold climate data only - POOR performer
      testedRegions: ['cold', 'au_temperate'],
      
      regionalTraits: {
        cold: {
          qualityRating: 5.7,
          qualitySource: 'HAL TU08007 Royal Canberra GC trial 2010-2012',
          
          traits: {
            wear: {
              multiplier: 1.05,
              confidence: 'high',
              source: 'TU08007: Low shoot density (56.2/dm²) - poor recovery',
              notes: 'Winter thinning reduces wear tolerance'
            },
            
            waterUse: {
              multiplier: 0.65,
              confidence: 'high',
              source: 'TU08007 citing Emekli et al 2007',
              notes: '35% less water than cool-season grasses'
            },
            
            cold: {
              dormancyThresholdModifier: 1.10,
              winterkillRisk: 1.25,
              confidence: 'high',
              source: 'TU08007 Table 4: 56.2 shoots/dm² (second lowest)',
              notes: 'POOR cold tolerance - cover dropped to 72%'
            },
            
            disease: {
              springDeadSpot: { riskMultiplier: 1.10, confidence: 'medium', source: 'Thin turf = disease prone' },
              largePatch: { riskMultiplier: 1.05, confidence: 'low', source: 'Estimated' },
              dollarSpot: { riskMultiplier: 1.00, confidence: 'low', source: 'Not tested' }
            }
          },
          
          trialData: {
            tu08007: {
              source: 'HAL TU08007',
              location: 'Royal Canberra Golf Club, ACT',
              years: '2010-2012',
              turfQuality: { mean: 5.7, range: [5.1, 7.4], scale: '0-10' },
              shootDensity: { value: 56.2, unit: 'shoots/dm²', rank: '#4 (poor)' },
              coverPersistence: { range: [72, 100], unit: '%', notes: 'Most variable' },
              weedAbundance: 'High - worst performers'
            }
          },
          
          recommendation: 'NOT RECOMMENDED for cold climates - consider Grand Prix or Santa Ana'
        },
        
        subtropical: {
          qualityRating: null,
          dataAvailable: false,
          notes: 'Conquest not tested in subtropical - poor cold tolerance suggests avoid frost-free areas may be better'
        },
        
        temperate: {
          qualityRating: null,
          dataAvailable: false,
          recommendation: 'NOT RECOMMENDED - poor cold tolerance in TU08007',
          notes: 'If poor in Canberra, likely poor in Melbourne/Adelaide winters'
        }
      }
    },
    
    // ─────────────────────────────────────────────────────────────────────────
    // AUSTRALIAN SUBTROPICAL COUCH VARIETIES
    // Source: QSAC Brisbane Trial (Matt Oliver 2020-2021), STRI Trial (QLD 2019)
    // ─────────────────────────────────────────────────────────────────────────
    
    'AgriDark': {
      species: 'couch',
      displayName: 'AgriDark',
      
      // Regions where this variety has been tested
      testedRegions: ['subtropical', 'au_subtropical'],
      
      // Regional performance profiles - traits derived from local trial data
      regionalTraits: {
        
        subtropical: {
          // QSAC Brisbane 2020-2021 + STRI QLD 2019
          qualityRating: 7.7,
          qualitySource: 'QSAC Brisbane Bermudagrass Trial 2020-2021 (Matt Oliver, Stadiums Queensland)',
          
          traits: {
            wear: {
              multiplier: 0.92,
              confidence: 'high',
              source: 'QSAC: Root-shear 42.3 Nm (mid-range), traction 50.6 Nm; Autumn recovery #2-3',
              recoveryMultiplier: 0.88,
              notes: 'Good recovery - ranked #2-3 in autumn wedge recovery tests'
            },
            
            shade: {
              thresholdModifier: 1.00,
              confidence: 'medium',
              source: 'STRI 2019: Mid-pack shade performance; colour dropped under 60% shade',
              notes: 'Not exceptional under shade - average for hybrid bermuda'
            },
            
            waterUse: {
              multiplier: 0.65,
              confidence: 'high',
              source: 'Couch baseline - 40-45% pan evaporation',
              notes: '35% less water than cool-season grasses'
            },
            
            cold: {
              dormancyThresholdModifier: 1.00,
              winterkillRisk: 1.00,
              confidence: 'low',
              source: 'QSAC subtropical trial - mild winters only',
              notes: 'Cold tolerance unknown - not tested in frost-prone conditions'
            },
            
            springGreenup: {
              daysEarlier: 0,
              confidence: 'medium',
              source: 'QSAC',
              notes: 'Standard spring timing in subtropical conditions'
            },
            
            disease: {
              springDeadSpot: { riskMultiplier: 1.00, confidence: 'low', source: 'Not tested' },
              largePatch: { riskMultiplier: 1.00, confidence: 'low', source: 'Not tested' },
              dollarSpot: { riskMultiplier: 1.00, confidence: 'low', source: 'Not tested' }
            }
          },
          
          managementNotes: {
            seedheadProduction: 'VERY LOW - QSAC: Rated 1.0-1.25 (best of all varieties tested, tied with Santa Ana)',
            colourRetention: 'EXCELLENT - Ranked #1 colour in summer (Jan); among best in autumn',
            mowingImplication: 'Reduced mowing for seedhead management',
            source: 'QSAC Trial Fig 13, Fig 3'
          },
          
          trialData: {
            qsac_2020: {
              source: 'Matt Oliver, Stadiums Queensland QSAC Bermudagrass Trial',
              presentation: 'ASTMA Conference, June 2021',
              location: 'Queensland Sport & Athletics Centre, Brisbane',
              coordinates: { lat: -27.55, lng: 153.07 },
              years: '2020-2021',
              trialDuration: '7 months (Aug 2020 - May 2021)',
              methodology: '8 varieties, randomised block design, 3m × 3m plots',
              soilProfile: 'Clay-loam base, 70mm sand cap, surface drainage only',
              overallRanking: { mean: 1.18, rank: '#2 (tied with TifTuf)', note: 'Lower = better' },
              metrics: {
                turfColour: { jan: 8.31, feb: 7.73, may: 7.77, rank: '#1 Jan, top 3 overall' },
                turfQuality: { jan: 8.0, feb: 7.73, may: 7.7, rank: '#1 Jan, #3 May' },
                canopeo: { jan: 91.2, feb: 61.4, unit: '%', notes: 'Summer peak excellent' },
                rhizomeDepth: { jan: 23.8, feb: 29.3, may: 32.0, unit: 'mm', rank: '#2 May' },
                rootShear: { jan: 22.1, feb: 42.3, unit: 'Nm', notes: 'Good stability' },
                traction: { jan: 52.6, feb: 50.6, unit: 'Nm', rank: 'Mid-pack' },
                seedhead: { mean: 1.18, rank: '#1-2 (best)', scale: '1=none to 4=high' }
              },
              recoveryTests: {
                summerWedge: { rank: '#3 (Jan), #3 (Feb)', notes: 'Good summer recovery' },
                autumnWedge: { rank: '#3 (Apr), #2 (May)', notes: 'Excellent autumn recovery' }
              },
              keyFindings: [
                'Best or equal-best seedhead suppression with Santa Ana',
                'Top colour retention in peak summer',
                'Strong recovery from damage',
                'Zero seedhead observed in February assessment'
              ]
            },
            stri_2019: {
              source: 'STRI Bermudagrass Cultivar Evaluation',
              location: 'Queensland',
              years: '2019',
              trialPeriod: 'May - November 2019',
              treatments: {
                shade: ['Full sun', '60% shade'],
                irrigation: ['Standard', 'Deficit'],
                wear: ['No wear', 'Wear applied']
              },
              rankings: {
                overall: '#8 of 8 (averaged across all stress combinations)',
                deficitIrrigation: '#8 (worst) - struggled under water stress',
                fullSun: '#6-7 - average performance',
                shade60: '#7-8 - below average shade tolerance',
                withWear: '#7 - below average wear tolerance in STRI trial'
              },
              notes: 'CAUTION: STRI trial showed poorer performance than QSAC - may reflect different stress intensities or establishment'
            }
          }
        },
        
        temperate: {
          // No trial data for Sydney/Melbourne/Adelaide/Perth
          qualityRating: null,
          qualitySource: 'NOT TESTED in temperate climate',
          dataAvailable: false,
          recommendation: 'Consider TifTuf or Santa Ana which have broader climate testing',
          notes: 'AgriDark performance in temperate zones is unknown - extrapolation from subtropical data unreliable'
        },
        
        cold: {
          // No trial data for Canberra/highlands
          qualityRating: null,
          qualitySource: 'NOT TESTED in cold climate',
          dataAvailable: false,
          recommendation: 'Consider Grand Prix (#1 TU08007) or Santa Ana (#2 TU08007) for cold climates',
          notes: 'AgriDark has NOT been tested in frost-prone conditions. Cold tolerance is UNKNOWN.'
        }
      }
    },
    
    // ═══════════════════════════════════════════════════════════════════════════
    // RIO - Johnston Seed Company
    // Source: NTEP 2013-2018 National Bermudagrass Test
    // #1 establishment speed, cold tolerant for transition zone
    // ═══════════════════════════════════════════════════════════════════════════
    'Rio': {
      species: 'couch',
      displayName: 'Rio',
      
      qualityRating: 6.5,
      qualitySource: 'NTEP 2013-2018 National Bermudagrass Test',
      
      testedRegions: ['subtropical', 'temperate', 'au_subtropical', 'au_temperate'],
      
      regionalTraits: {
        
        subtropical: {
          qualityRating: 6.5,
          qualitySource: 'NTEP 2013-2018 Southern locations',
          climateEquivalent: 'Brisbane, Gold Coast, Northern NSW',
          
          traits: {
            establishment: {
              seedlingVigor: 0.70,
              confidence: 'high',
              source: 'NTEP 2013-2018 - #1 establishment rating (9.0/9)',
              notes: 'Fastest establishing bermuda in NTEP - ideal for new builds/repairs'
            },
            
            density: {
              rating: 1.15,
              confidence: 'high',
              source: 'NTEP density ratings (8.0/9)',
              notes: 'Very dense turf - excellent surface quality'
            },
            
            texture: {
              finenessOfLeaf: 0.85,
              confidence: 'high',
              source: 'NTEP texture ratings',
              notes: 'Fine-bladed - darker green color'
            },
            
            wear: {
              multiplier: 0.88,
              confidence: 'high',
              source: 'NTEP 2013-2017 Table 3A Knoxville TN traffic trial: 0 games 8.3, 25 games 7.0, recovery 8.0',
              notes: 'Good traffic tolerance with strong recovery'
            },
            
            disease: {
              springDeadSpot: {
                riskMultiplier: 1.00,
                confidence: 'low',
                source: 'NTEP 2013-2017 Table 6B Columbia MO - SDS data collected but Rio not in top/bottom groups',
                notes: 'Average SDS susceptibility - use preventative program in transition zone'
              }
            }
          },
          
          notes: 'Excellent for subtropical - fast establishment, dense turf'
        },
        
        temperate: {
          qualityRating: 6.3,
          qualitySource: 'NTEP transition zone locations',
          climateEquivalent: 'Sydney, Perth, Adelaide',
          
          traits: {
            cold: {
              toleranceMultiplier: 0.80,
              confidence: 'high',
              source: 'NTEP 2013-2018 - Extends bermuda range into cooler zones (8.0/9)',
              notes: 'Cold tolerant - extends bermuda into transition zone'
            },
            
            establishment: {
              seedlingVigor: 0.70,
              confidence: 'high',
              source: 'NTEP establishment trials',
              notes: '#1 establishment speed'
            },
            
            density: {
              rating: 1.15,
              confidence: 'high',
              source: 'NTEP density ratings',
              notes: 'Maintains dense turf in cooler conditions'
            }
          },
          
          notes: 'Good option for cooler bermuda zones - cold tolerance extends range southward'
        },
        
        cold: {
          qualityRating: null,
          dataAvailable: false,
          recommendation: 'Not recommended for cold climates (Canberra, highlands)',
          notes: 'Bermuda generally unsuitable for cold climates - consider cool-season grasses'
        }
      }
    },
    
    // ═══════════════════════════════════════════════════════════════════════════
    // MONACO - Barenbrug (seeded bermuda)
    // NTEP 2019-2023 (bg19_24-11f) + NTEP 2013-2017 (bg13_18-14f)
    // ═══════════════════════════════════════════════════════════════════════════
    'Monaco': {
      species: 'couch',
      displayName: 'Monaco',
      
      qualityRating: 5.8,
      qualitySource: 'NTEP 2019-2023 Final Report (bg19_24-11f) + NTEP 2013-2017 Final Report (bg13_18-14f)',
      
      testedRegions: ['ntep_us', 'au_temperate', 'au_subtropical'],
      
      traits: {
        wear: {
          multiplier: 0.88,
          confidence: 'medium',
          source: 'NTEP 2019-2023 West Lafayette IN - Monaco quality 7.3 under standard management (above Tifway 7.0)',
          notes: 'Good turf quality under managed conditions. Fine leaf texture (6.7/9).'
        },
        
        color: {
          geneticColor: 7.4,
          confidence: 'high',
          source: 'NTEP 2019-2023 College Station TX drought trial (bg1924ft24b) - Monaco genetic color 7.4 (highest among seeded entries)',
          notes: 'Darkest genetic colour of all seeded entries in the 2019 trial'
        },
        
        shade: {
          thresholdModifier: 1.00,
          confidence: 'low',
          source: 'No NTEP shade data for Monaco',
          notes: 'Average shade tolerance assumed for seeded bermuda'
        },
        
        waterUse: {
          multiplier: 1.05,
          confidence: 'high',
          source: 'NTEP 2019-2023 College Station TX drought - Monaco quality 4.4 under drought (below mean), recovery week 1 only 2.7/9 (worst)',
          notes: 'Poor drought recovery despite good dormancy colour. Not recommended where irrigation is unreliable.'
        },
        
        cold: {
          toleranceMultiplier: 0.85,
          confidence: 'medium',
          source: 'NTEP 2019-2023 West Lafayette IN (transition zone) - quality 7.3, spring greenup data pending',
          notes: 'Good transition zone performance at West Lafayette'
        }
      }
    },
    
    // ═══════════════════════════════════════════════════════════════════════════
    // MAYA (RAD-CD1) - Vista Seed Partners (seeded bermuda)
    // NTEP 2007-2012 National Bermudagrass Test
    // ═══════════════════════════════════════════════════════════════════════════
    'Maya': {
      species: 'couch',
      displayName: 'Maya',
      
      qualityRating: 5.6,
      qualitySource: 'NTEP 2007-2012 Final Report (bg07_13-10f), tested as RAD-CD1, 19 locations',
      
      testedRegions: ['ntep_us', 'au_temperate', 'au_subtropical'],
      
      traits: {
        wear: {
          multiplier: 0.92,
          confidence: 'high',
          source: 'NTEP 2007-2012 Gainesville FL traffic trial (bg0713ft22b) - RAD-CD1 before wear 91.7%, after wear 66.7%, recovery to 70.0%',
          notes: 'Mid-pack traffic tolerance among seeded entries. Ranked below Princess 77 (76.7%) and PSG 9Y2OK (73.3%) for post-wear recovery.'
        },
        
        establishment: {
          seedlingVigor: 1.20,
          confidence: 'high',
          source: 'NTEP 2007-2012 Gainesville FL - RAD-CD1 fastest establishing seeded entry: 40% cover by Feb 2008 vs 20-25% typical',
          notes: 'Exceptionally fast establishment from seed - strongest germination vigour in the 2007 trial'
        },
        
        color: {
          geneticColor: 6.3,
          confidence: 'high',
          source: 'NTEP 2007-2012 Gainesville FL traffic trial',
          notes: 'Medium green'
        },
        
        shade: {
          thresholdModifier: 1.00,
          confidence: 'low',
          source: 'No NTEP shade data for RAD-CD1',
          notes: 'Average shade tolerance assumed for seeded bermuda'
        },
        
        disease: {
          dollarSpot: {
            riskMultiplier: 1.00,
            confidence: 'low',
            source: 'NTEP 2007-2012 - no specific dollar spot data reported for RAD-CD1',
            notes: 'Insufficient disease data'
          }
        },
        
        waterUse: {
          multiplier: 0.95,
          confidence: 'medium',
          source: 'NTEP 2007-2012 fall ground cover mean 80.9% across 6 locations (bg0713ft34b) - mid-pack',
          notes: 'Average drought persistence among seeded entries'
        }
      }
    },
  },
  
  // ═══════════════════════════════════════════════════════════════════════════
  // CREEPING BENTGRASS (Agrostis stolonifera)
  // Primary source: NTEP 2008-2013 and 2014-2019 Bentgrass Tests
  // Australian source: Keysborough GC trial 2014-2016 (Melbourne)
  // 
  // NTEP LOCATION → AUSTRALIAN CLIMATE ZONE MAPPING:
  // ─────────────────────────────────────────────────────────────────────────────
  // | NTEP Location      | Köppen | Lat   | AU Equivalent        | AU Zone      |
  // |────────────────────|────────|───────|──────────────────────|──────────────|
  // | Raleigh NC         | Cfa    | 35.8°N| Brisbane, Gold Coast | subtropical  |
  // | Tifton GA          | Cfa    | 31.5°N| Brisbane, N NSW      | subtropical  |
  // | Dallas TX          | Cfa    | 32.8°N| Sydney (west)        | temperate_w  |
  // | Stillwater OK      | Cfa    | 36.1°N| Sydney (coastal)     | temperate    |
  // | Purdue/Indiana     | Dfa    | 40.4°N| Canberra, highlands  | cold         |
  // | Penn State PA      | Dfa    | 40.8°N| Canberra, S'n H'lands| cold         |
  // | Michigan State     | Dfa    | 42.7°N| Canberra (coldest)   | cold         |
  // | New Jersey         | Cfa    | 40.2°N| Sydney, Newcastle    | temperate    |
  // | Riverside CA       | Csa    | 34.0°N| Perth, Adelaide      | mediterranean|
  // ─────────────────────────────────────────────────────────────────────────────
  // 
  // Usage: Select NTEP data from locations matching your Australian climate zone
  // ═══════════════════════════════════════════════════════════════════════════
  
  // Climate zone lookup for NTEP data selection
  _ntepClimateMapping: {
    subtropical: {
      description: 'Brisbane, Gold Coast, Northern NSW',
      ntepLocations: ['Raleigh NC', 'Tifton GA'],
      characteristics: 'High summer heat/humidity, mild winters, high disease pressure'
    },
    temperate: {
      description: 'Sydney, Newcastle, Perth coastal, Adelaide',
      ntepLocations: ['Stillwater OK', 'New Jersey', 'Dallas TX'],
      characteristics: 'Hot summers, cool winters, moderate disease pressure'
    },
    mediterranean: {
      description: 'Perth, Adelaide (inland)',
      ntepLocations: ['Riverside CA'],
      characteristics: 'Hot dry summers, cool wet winters, lower disease pressure'
    },
    cold: {
      description: 'Canberra, Southern Highlands, elevated areas',
      ntepLocations: ['Purdue IN', 'Penn State PA', 'Michigan State'],
      characteristics: 'Cold winters, moderate summers, spring dead spot risk'
    },
    australian: {
      description: 'Actual Australian trial data',
      trials: ['Keysborough GC Melbourne 2014-2016'],
      characteristics: 'Direct AU performance data - highest confidence'
    }
  },
  
  bentgrass: {
    
    '007': {
      species: 'bentgrass',
      displayName: '007',
      
      // NTEP data mapped to Australian climate zones
      testedRegions: ['subtropical_ntep', 'temperate_ntep', 'cold_ntep', 'au_temperate'],
      
      regionalTraits: {
        
        subtropical_ntep: {
          // Raleigh NC data → Brisbane, Gold Coast
          qualityRating: 6.3,
          qualitySource: 'NTEP 2003-2008, 2020 Raleigh NC',
          climateEquivalent: 'Brisbane, Gold Coast, Northern NSW',
          
          traits: {
            disease: {
              dollarSpot: {
                riskMultiplier: 0.75,
                confidence: 'medium',
                source: 'bentgrassdoctor.com "Most tolerant" group',
                notes: 'Bred for dollar spot resistance by Dr. Hurley'
              },
              pythiumRootRot: {
                riskMultiplier: 0.87,
                confidence: 'medium',
                source: 'NTEP 2020 Table 23 Raleigh NC: 007XL rated 8.7/9',
                notes: 'Good Pythium resistance - relevant for humid subtropical'
              },
              brownPatch: { riskMultiplier: 1.00, confidence: 'medium', source: 'NTEP' }
            }
          },
          
          notes: 'Pythium resistance important for QLD humidity; dollar spot resistance valuable'
        },
        
        temperate_ntep: {
          // New Jersey, Stillwater OK data → Sydney, Newcastle, Perth coastal
          qualityRating: 6.3,
          qualitySource: 'NTEP multi-location average',
          climateEquivalent: 'Sydney, Newcastle, Perth coastal, Adelaide',
          
          traits: {
            disease: {
              dollarSpot: { riskMultiplier: 0.75, confidence: 'medium', source: 'NTEP' },
              brownPatch: { riskMultiplier: 1.00, confidence: 'medium', source: 'NTEP' }
            },
            winterColor: {
              retention: 1.10,
              confidence: 'medium',
              source: 'NTEP winter color ratings',
              notes: 'Selected for no purpling - good for cooler months'
            }
          },
          
          notes: 'Good all-round performer for Sydney/Melbourne coastal climates'
        },
        
        cold_ntep: {
          // Purdue IN, Penn State PA data → Canberra, Southern Highlands
          qualityRating: 6.3,
          qualitySource: 'NTEP Purdue/Penn State trials',
          climateEquivalent: 'Canberra, Southern Highlands, elevated areas',
          
          traits: {
            disease: {
              dollarSpot: {
                riskMultiplier: 0.75,
                confidence: 'medium',
                source: 'NTEP cold climate locations',
                notes: 'Good resistance maintains in cold climates'
              }
            },
            winterColor: {
              retention: 1.10,
              confidence: 'medium',
              source: 'NTEP',
              notes: 'No purpling - valuable for cold climate winter appearance'
            }
          },
          
          notes: 'Good cold climate option with dollar spot resistance'
        },
        
        temperate_au: {
          // No Australian trial data
          qualityRating: null,
          dataAvailable: false,
          recommendation: 'Consider Pure Distinction which has Keysborough GC Melbourne trial data',
          notes: '007 not tested in Australia - rely on NTEP climate-matched data'
        }
      }
    },
    
    // ═══════════════════════════════════════════════════════════════════════════
    // 777 - Seed Research of Oregon (Sister variety to 007)
    // Source: NTEP 2003-2008 National Bentgrass Test
    // Heat stress specialist with excellent dollar spot resistance
    // ═══════════════════════════════════════════════════════════════════════════
    '777': {
      species: 'bentgrass',
      displayName: '777',
      
      // NTEP 2003-2008 mean quality
      qualityRating: 6.1,
      qualitySource: 'NTEP 2003-2008 National Bentgrass Test',
      
      testedRegions: ['subtropical_ntep', 'temperate_ntep', 'cold_ntep', 'au_temperate'],
      
      regionalTraits: {
        
        subtropical_ntep: {
          // Raleigh NC data → Brisbane, Gold Coast
          qualityRating: 6.1,
          qualitySource: 'NTEP 2003-2008 Raleigh NC',
          climateEquivalent: 'Brisbane, Gold Coast, Northern NSW',
          
          traits: {
            disease: {
              dollarSpot: {
                riskMultiplier: 0.80,
                confidence: 'high',
                source: 'NTEP 2003-2008 - Excellent dollar spot resistance (7.5/9)',
                notes: 'Sister variety to 007 - shares dollar spot genetics'
              },
              brownPatch: {
                riskMultiplier: 0.85,
                confidence: 'high',
                source: 'NTEP 2003-2008 brown patch trials',
                notes: 'Good brown patch resistance'
              }
            },
            heat: {
              stressRecoveryMultiplier: 0.80,
              confidence: 'high',
              source: 'NTEP summer stress ratings 8.0/9',
              notes: 'Heat stress specialist - bred for summer performance'
            }
          },
          
          notes: 'Heat stress specialist with good disease package - ideal for subtropical conditions'
        },
        
        temperate_ntep: {
          qualityRating: 6.1,
          qualitySource: 'NTEP multi-location average',
          climateEquivalent: 'Sydney, Newcastle, Perth coastal, Adelaide',
          
          traits: {
            disease: {
              dollarSpot: { riskMultiplier: 0.80, confidence: 'high', source: 'NTEP' },
              brownPatch: { riskMultiplier: 0.85, confidence: 'high', source: 'NTEP' }
            },
            heat: {
              stressRecoveryMultiplier: 0.80,
              confidence: 'high',
              source: 'NTEP summer stress ratings',
              notes: 'Maintains quality through hot periods'
            }
          },
          
          notes: 'Good all-round performer with heat tolerance advantage'
        },
        
        cold_ntep: {
          qualityRating: 6.0,
          qualitySource: 'NTEP Purdue/Penn State trials',
          climateEquivalent: 'Canberra, Southern Highlands, elevated areas',
          
          traits: {
            disease: {
              dollarSpot: {
                riskMultiplier: 0.80,
                confidence: 'high',
                source: 'NTEP cold climate locations',
                notes: 'Resistance maintains in cold climates'
              }
            }
          },
          
          notes: 'Not specifically bred for cold - consider 007 or Pure Distinction for cold climates'
        },
        
        temperate_au: {
          qualityRating: null,
          dataAvailable: false,
          recommendation: 'Consider Pure Distinction which has Keysborough GC Melbourne trial data',
          notes: '777 not tested in Australia - rely on NTEP climate-matched data'
        }
      }
    },
    
    'Pure Distinction': {
      species: 'bentgrass',
      displayName: 'Pure Distinction',
      
      // Has actual Australian trial data from Keysborough GC + NTEP data
      testedRegions: ['temperate_au', 'cold_ntep'],
      
      regionalTraits: {
        
        temperate_au: {
          // Keysborough GC Melbourne 2014-2016 - ACTUAL AUSTRALIAN DATA
          qualityRating: 7.3,
          qualitySource: 'ASTMA/Heritage Seeds Keysborough GC trial 2014-2016 (Neylan, ATM 21.5)',
          dataConfidence: 'high',
          
          traits: {
            
            heat: {
              stressRecoveryMultiplier: 0.70,
              confidence: 'high',
              source: 'Keysborough GC Feb 2015 - Quality 7.3 vs Penn A4 4.7 after irrigation failure',
              notes: 'EXCELLENT: 30% better heat/drought recovery than Penn A4, G2, MacKenzie'
            },
            
            density: {
              multiplier: 1.15,
              confidence: 'high',
              source: 'Keysborough GC - Significantly greater density (LSD P<0.05)',
              notes: 'Consistently denser than Penn A4, G2, MacKenzie'
            },
            
            poaCompetition: {
              aggression: 1.40,
              confidence: 'high',
              source: 'Keysborough GC Oct 2016 - Only 1.7% Poa vs Penn G2 13.3%, MacKenzie 15%',
              notes: 'EXCELLENT: Best Poa resistance except Penn A4'
            },
            
            disease: {
              dollarSpot: {
                riskMultiplier: 1.80,
                confidence: 'high',
                source: 'NTEP Purdue 2009-2013 - 251 infection centers (highest); Penn State - Least tolerant',
                notes: 'CRITICAL: Highly susceptible - requires preventative fungicide program'
              },
              brownPatch: { riskMultiplier: 1.00, confidence: 'medium', source: 'NTEP' },
              pythiumRootRot: { riskMultiplier: 1.00, confidence: 'low', source: 'Not tested' }
            }
          },
          
          trialData: {
            keysborough_2014: {
              source: 'ASTMA/Heritage Seeds Keysborough GC Trial',
              publication: 'Neylan, ATM Issue 21.5',
              location: 'Keysborough Golf Club, Melbourne',
              coordinates: { lat: -38.02, lng: 145.17 },
              years: '2014-2016',
              comparators: ['Penn A4', 'Penn G2', 'MacKenzie', 'Crystal Bluelinks'],
              keyFindings: [
                'Best heat/drought stress recovery after irrigation failure',
                'Highest density throughout trial',
                'Lowest Poa invasion (1.7% vs 13-15% for others)',
                'Dollar spot susceptibility confirmed from NTEP'
              ],
              recommendation: 'Excellent choice for Melbourne climate with preventative dollar spot program'
            }
          }
        },
        
        cold_ntep: {
          // NTEP Purdue/Penn State data → maps to Canberra/highlands
          qualityRating: 6.5,
          qualitySource: 'NTEP 2008-2013 Purdue/Penn State trials',
          dataConfidence: 'high',
          climateEquivalent: 'Canberra, Southern Highlands',
          
          traits: {
            disease: {
              dollarSpot: {
                riskMultiplier: 1.80,
                confidence: 'high',
                source: 'Purdue 2009-2013 - 251 infection centers (WORST of all entries)',
                notes: 'CRITICAL: Extreme susceptibility in cold climate trials'
              },
              brownPatch: { riskMultiplier: 1.00, confidence: 'medium', source: 'NTEP' }
            },
            
            winterColor: {
              retention: 1.00,
              confidence: 'medium',
              source: 'NTEP',
              notes: 'Average winter color'
            }
          },
          
          trialData: {
            ntep_purdue: {
              source: 'NTEP Bentgrass Putting Green Trial',
              location: 'Purdue University, Indiana',
              years: '2009-2013',
              keyMetric: 'Dollar spot infection centers: 251 (highest of all entries)',
              climateEquivalent: 'Canberra/highlands'
            },
            ntep_pennstate: {
              source: 'NTEP Bentgrass Putting Green Trial',
              location: 'Penn State University, Pennsylvania',
              years: '2008-2013',
              keyMetric: 'Dollar spot tolerance: Least tolerant category',
              climateEquivalent: 'Canberra/Southern Highlands'
            }
          },
          
          recommendation: 'High dollar spot risk in cold climates - intensive fungicide program essential'
        },
        
        subtropical: {
          // No direct trial data - extrapolated with caution
          qualityRating: null,
          dataAvailable: false,
          notes: 'Bentgrass generally struggles in subtropical climates. Pure Distinction heat tolerance (Keysborough) is promising but not tested in QLD.',
          recommendation: 'Consider ultradwarf bermuda (TifEagle, Champion) for subtropical putting greens'
        }
      }
    },
    
    // ═══════════════════════════════════════════════════════════════════════════
    // MACDONALD - DLF/Johnsons Super Bents (Disease resistant creeping bent)
    // Source: DLF Pro Turf specifications, NZ/AU market data
    // ═══════════════════════════════════════════════════════════════════════════
    'Macdonald': {
      species: 'bentgrass',
      displayName: 'Macdonald',
      
      qualityRating: 7.0,
      qualitySource: 'DLF Super Bents program - bred for disease resistance',
      
      testedRegions: ['nzsti_nz', 'au_temperate', 'bspb_uk'],
      
      traits: {
        disease: {
          dollarSpot: {
            riskMultiplier: 0.70,
            confidence: 'high',
            source: 'DLF Super Bents specifications',
            notes: 'High resistance to Dollar Spot - bred specifically for this trait'
          },
          brownPatch: {
            riskMultiplier: 0.70,
            confidence: 'high',
            source: 'DLF Super Bents specifications',
            notes: 'High resistance to Brown Patch'
          },
          anthracnose: {
            riskMultiplier: 0.75,
            confidence: 'medium',
            source: 'PGG Wrightson Turf NZ specifications',
            notes: 'Good anthracnose resistance'
          },
          pinkSnowMould: {
            riskMultiplier: 0.75,
            confidence: 'medium',
            source: 'DLF Super Bents specifications',
            notes: 'Good pink snow mould resistance'
          },
          overallResistance: 7.2,
          confidence: 'high',
          source: 'DLF Super Bents disease resistance breeding program',
          notes: 'Multiple disease resistance - reduced fungicide inputs'
        },
        
        density: {
          shootDensity: 7.0,
          confidence: 'medium',
          source: 'DLF specifications',
          notes: 'Dense turf that resists Poa annua invasion'
        },
        
        texture: {
          finenessOfLeaf: 7.0,
          confidence: 'medium',
          source: 'DLF specifications',
          notes: 'Fine texture suitable for greens'
        },
        
        thatch: {
          accumulation: 'low',
          confidence: 'medium',
          source: 'DLF Super Bents specifications',
          notes: 'Keeps thatch under control - easier maintenance'
        },
        
        poaCompetition: {
          aggression: 1.20,
          confidence: 'medium',
          source: 'DLF Super Bents specifications',
          notes: 'Dense turf resists Poa annua invasion'
        },
        
        mowingHeight: {
          minimum: 3,
          optimal: '3-5',
          confidence: 'medium',
          source: 'DLF specifications',
          notes: 'High quality putting surface at greens height'
        },
        
        environmentalTolerance: {
          reducedInputs: true,
          confidence: 'medium',
          source: 'A-LIST certification (Alliance for Low Input Sustainable Turf)',
          notes: 'Super Bents approved by A-LIST for reduced fungicide/pesticide/water requirements'
        }
      }
    },
    
    'Declaration': {
      species: 'bentgrass',
      displayName: 'Declaration',
      
      // NTEP data mapped to Australian climate zones
      testedRegions: ['subtropical_ntep', 'cold_ntep', 'au_temperate'],
      
      regionalTraits: {
        
        subtropical_ntep: {
          // Raleigh NC data → Brisbane, Gold Coast
          qualityRating: 6.3,
          qualitySource: 'NTEP 2008-2013, 2020 Raleigh NC',
          climateEquivalent: 'Brisbane, Gold Coast',
          
          traits: {
            disease: {
              dollarSpot: { riskMultiplier: 0.75, confidence: 'high', source: 'NTEP Purdue - 8.7 infection centers' },
              pythiumRootRot: {
                riskMultiplier: 0.87,
                confidence: 'medium',
                source: 'NTEP 2020 Table 23 Raleigh NC: 8.7/9',
                notes: 'Good Pythium resistance - important for humid subtropical'
              },
              brownPatch: { riskMultiplier: 1.00, confidence: 'medium', source: 'NTEP' }
            }
          },
          
          notes: 'Good dollar spot + Pythium resistance valuable for QLD conditions'
        },
        
        cold_ntep: {
          // Purdue IN, Penn State PA data → Canberra, Southern Highlands
          qualityRating: 6.3,
          qualitySource: 'NTEP Purdue/Penn State trials',
          climateEquivalent: 'Canberra, Southern Highlands',
          
          traits: {
            disease: {
              dollarSpot: {
                riskMultiplier: 0.75,
                confidence: 'high',
                source: 'Purdue 8.7 infection centers; Penn State "Very good tolerance"',
                notes: 'EXCELLENT dollar spot resistance in cold climate trials'
              }
            }
          },
          
          notes: 'Strong performer for cold climates with excellent dollar spot resistance'
        },
        
        temperate_au: {
          qualityRating: 6.3,
          qualitySource: 'NTEP multi-location (no direct AU trial)',
          dataAvailable: 'ntep_interpolated',
          recommendation: 'Good choice - consider alongside Pure Distinction which has Keysborough data'
        }
      }
    },
    
    'Penn A-1': {
      species: 'bentgrass',
      displayName: 'Penn A-1',
      
      // NTEP data mapped to Australian climate zones
      testedRegions: ['subtropical_ntep', 'cold_ntep', 'au_temperate'],
      
      regionalTraits: {
        
        subtropical_ntep: {
          // Raleigh NC data → Brisbane, Gold Coast
          qualityRating: 6.1,
          qualitySource: 'NTEP 2020 Raleigh NC',
          climateEquivalent: 'Brisbane, Gold Coast',
          
          traits: {
            disease: {
              dollarSpot: { riskMultiplier: 1.10, confidence: 'high', source: 'NTEP Purdue - 21.7 infection centers' },
              pythiumRootRot: {
                riskMultiplier: 1.13,
                confidence: 'medium',
                source: 'NTEP 2020 Table 23 Raleigh NC: 7.3/9',
                notes: 'Moderate Pythium resistance - monitor in humid conditions'
              },
              brownPatch: { riskMultiplier: 1.00, confidence: 'medium', source: 'NTEP' }
            },
            puttingQuality: { ballRoll: 1.05, confidence: 'high', source: 'Penn State breeding standard' }
          },
          
          notes: 'Industry standard for putting quality; moderate dollar spot susceptibility'
        },
        
        cold_ntep: {
          // Purdue IN, Penn State PA data → Canberra, Southern Highlands
          qualityRating: 6.1,
          qualitySource: 'NTEP Purdue/Penn State',
          climateEquivalent: 'Canberra, Southern Highlands',
          
          traits: {
            disease: {
              dollarSpot: {
                riskMultiplier: 1.10,
                confidence: 'high',
                source: 'Purdue 21.7 infection centers; Penn State Intermediate',
                notes: 'Moderate susceptibility in cold climate trials'
              }
            }
          },
          
          notes: 'Good putting quality but monitor dollar spot in cold climates'
        },
        
        temperate_au: {
          qualityRating: 6.1,
          qualitySource: 'NTEP (no direct AU trial)',
          dataAvailable: 'ntep_interpolated',
          recommendation: 'Industry standard - excellent putting quality, fungicide program needed for dollar spot'
        }
      }
    },
    
    'T-1': {
      species: 'bentgrass',
      displayName: 'T-1',
      
      // NTEP data mapped to Australian climate zones
      testedRegions: ['cold_ntep', 'au_temperate'],
      
      regionalTraits: {
        
        cold_ntep: {
          // Purdue IN, Penn State PA, UMass data → Canberra, Southern Highlands
          qualityRating: 6.2,
          qualitySource: 'NTEP 2008-2013 Purdue/Penn State',
          climateEquivalent: 'Canberra, Southern Highlands',
          
          traits: {
            disease: {
              dollarSpot: {
                riskMultiplier: 1.25,
                confidence: 'high',
                source: 'Purdue 35.3 infection centers; Penn State "Least tolerant commercial"',
                notes: 'CAUTION: HIGH dollar spot susceptibility - intensive fungicide required'
              },
              brownPatch: { riskMultiplier: 1.00, confidence: 'medium', source: 'NTEP' }
            },
            poaCompetition: {
              aggression: 1.20,
              confidence: 'medium',
              source: 'Marketing/field observations',
              notes: 'Aggressive growth helps crowd out Poa'
            }
          },
          
          notes: 'Good wear tolerance and Poa competition but HIGH dollar spot risk'
        },
        
        temperate_au: {
          qualityRating: 6.2,
          qualitySource: 'NTEP (no direct AU trial)',
          dataAvailable: 'ntep_interpolated',
          recommendation: 'Good choice if dollar spot pressure is low; otherwise consider Declaration or 007'
        },
        
        subtropical: {
          qualityRating: null,
          dataAvailable: false,
          notes: 'No Pythium data - use with caution in humid subtropical'
        }
      }
    },
    
    'Penncross': {
      species: 'bentgrass',
      displayName: 'Penncross',
      
      // Industry standard check cultivar since 1954 - LOWEST quality in NTEP 2020
      testedRegions: ['subtropical_ntep', 'cold_ntep', 'temperate_ntep', 'au_temperate'],
      
      regionalTraits: {
        
        subtropical_ntep: {
          // Raleigh NC data → Brisbane, Gold Coast
          qualityRating: 4.0,
          qualitySource: 'NTEP 2020 Table 2 - LPI 4.0/9 (LOWEST)',
          climateEquivalent: 'Brisbane, Gold Coast',
          
          traits: {
            density: { multiplier: 0.85, confidence: 'high', source: 'NTEP 2020 - lowest density' },
            disease: {
              dollarSpot: { riskMultiplier: 1.15, confidence: 'high', source: 'NTEP 2020 - 72.7 infection centers' },
              anthracnose: { riskMultiplier: 0.90, confidence: 'medium', source: 'NTEP 2020 Table 22 Raleigh: 9.0/9' },
              pythiumRootRot: { riskMultiplier: 0.87, confidence: 'medium', source: 'NTEP 2020 Table 23 Raleigh: 8.7/9' }
            },
            poaCompetition: { aggression: 0.80, confidence: 'high', source: 'NTEP 2020 - worst Poa competition' }
          },
          
          notes: 'LEGACY CHECK CULTIVAR - not recommended for new installations'
        },
        
        cold_ntep: {
          // Purdue, Penn State data → Canberra, Southern Highlands
          qualityRating: 4.0,
          qualitySource: 'NTEP 2020',
          climateEquivalent: 'Canberra, Southern Highlands',
          
          traits: {
            disease: { dollarSpot: { riskMultiplier: 1.15, confidence: 'high', source: 'NTEP 2020' } },
            springGreenup: { daysLater: 7, confidence: 'medium', source: 'NTEP 2020 - slowest greenup' },
            winterColor: { retention: 0.65, confidence: 'high', source: 'NTEP 2020 - worst winter color (3.5/9)' }
          },
          
          notes: 'Poor cold climate performer - slow spring greenup, poor winter color'
        },
        
        temperate_ntep: {
          // Multi-location average → Sydney, Perth, Adelaide
          qualityRating: 4.0,
          qualitySource: 'NTEP 2020 multi-location',
          climateEquivalent: 'Sydney, Perth, Adelaide',
          
          traits: {
            density: { multiplier: 0.85, confidence: 'high', source: 'Coarsest texture, lowest density' },
            poaCompetition: { aggression: 0.80, confidence: 'high', source: 'NTEP 2020 - worst' }
          },
          
          recommendation: 'NOT RECOMMENDED - outperformed by all modern varieties',
          notes: 'Use only as comparison check; consider Pure Distinction, Declaration, 007 instead'
        }
      }
    },
    
    'Piper': {
      species: 'bentgrass',
      displayName: 'Piper',
      
      // NEW 2020 Rutgers/USGA release - 5th generation bentgrass
      testedRegions: ['cold_ntep', 'temperate_ntep', 'au_temperate'],
      
      regionalTraits: {
        
        cold_ntep: {
          // West Lafayette IN (Purdue) data → Canberra, Southern Highlands
          qualityRating: 6.7,
          qualitySource: 'NTEP 2020 National Bentgrass Putting Green Test',
          climateEquivalent: 'Canberra, Southern Highlands',
          
          traits: {
            density: { multiplier: 1.10, confidence: 'high', source: 'NTEP 2020 - Top performer' },
            disease: {
              dollarSpot: {
                riskMultiplier: 0.85,
                confidence: 'high',
                source: 'NTEP 2020 West Lafayette - 14.0/13.0/8.7 infection centers',
                notes: 'Good resistance but not elite like Oakley'
              },
              brownPatch: {
                riskMultiplier: 0.67,
                confidence: 'high',
                source: 'NTEP 2020 West Lafayette - 6.0/9',
                notes: 'EXCELLENT brown patch resistance'
              }
            },
            poaCompetition: { aggression: 0.90, confidence: 'medium', source: 'NTEP 2020' },
            color: { geneticColor: 6.5, winterColor: 5.0, confidence: 'medium' }
          },
          
          notes: 'Excellent brown patch resistance; good density; bred by Dr. Stacy Bonos at Rutgers'
        },
        
        temperate_ntep: {
          qualityRating: 6.7,
          qualitySource: 'NTEP 2020 multi-location',
          climateEquivalent: 'Sydney, Perth, Adelaide',
          dataAvailable: 'ntep_interpolated',
          notes: 'Good performer across NTEP trial locations'
        },
        
        temperate_au: {
          qualityRating: null,
          dataAvailable: false,
          recommendation: 'Promising new variety - consider alongside Pure Distinction which has Keysborough data',
          notes: 'Not yet tested in Australia'
        }
      }
    },
    
    'Oakley': {
      species: 'bentgrass',
      displayName: 'Oakley',
      
      // NEW 2020 Rutgers/USGA release - 5th generation bentgrass - TOP PERFORMER
      testedRegions: ['cold_ntep', 'temperate_ntep', 'au_temperate'],
      
      regionalTraits: {
        
        cold_ntep: {
          // West Lafayette IN (Purdue) data → Canberra, Southern Highlands
          qualityRating: 7.2,
          qualitySource: 'NTEP 2020 - Top performer',
          climateEquivalent: 'Canberra, Southern Highlands',
          
          traits: {
            density: { multiplier: 1.05, confidence: 'high', source: 'NTEP 2020 - Fine leaf texture' },
            disease: {
              dollarSpot: {
                riskMultiplier: 0.55,
                confidence: 'high',
                source: 'NTEP 2020 West Lafayette - 0.0/2.0/0.7 infection centers (BEST)',
                notes: 'ELITE: Best dollar spot resistance in NTEP 2020'
              },
              brownPatch: {
                riskMultiplier: 0.50,
                confidence: 'high',
                source: 'NTEP 2020 West Lafayette - 9.0/9',
                notes: 'EXCELLENT brown patch resistance'
              }
            },
            poaCompetition: { aggression: 0.90, confidence: 'medium', source: 'NTEP 2020' },
            color: { geneticColor: 6.0, winterColor: 5.0, confidence: 'high' }
          },
          
          notes: 'TOP PERFORMER: Elite dollar spot + excellent brown patch resistance. Named for USGA pioneer Dr. Russell Oakley.'
        },
        
        temperate_ntep: {
          qualityRating: 7.2,
          qualitySource: 'NTEP 2020 multi-location',
          climateEquivalent: 'Sydney, Perth, Adelaide',
          
          traits: {
            density: { multiplier: 1.05, confidence: 'high', source: 'NTEP 2020 - Fine leaf texture' },
            disease: {
              dollarSpot: {
                riskMultiplier: 0.55,
                confidence: 'high',
                source: 'NTEP 2020 - 0.0/2.0/0.7 infection centers (BEST)',
                notes: 'ELITE: Best dollar spot resistance in NTEP 2020'
              },
              brownPatch: {
                riskMultiplier: 0.50,
                confidence: 'high',
                source: 'NTEP 2020 - 9.0/9',
                notes: 'EXCELLENT brown patch resistance'
              }
            },
            poaCompetition: { aggression: 0.90, confidence: 'medium', source: 'NTEP 2020' },
            color: { geneticColor: 6.0, winterColor: 5.0, confidence: 'high' }
          },
          
          notes: 'Elite performer across all NTEP locations'
        },
        
        temperate_au: {
          qualityRating: null,
          dataAvailable: false,
          recommendation: 'HIGHLY PROMISING - elite disease resistance suggests excellent AU performance',
          notes: 'Not yet tested in Australia but should be top consideration for new installations'
        }
      }
    },
    
    'Crystal Bluelinks': {
      species: 'bentgrass',
      displayName: 'Crystal Bluelinks',
      
      // Has actual Australian trial data + NTEP
      testedRegions: ['temperate_au', 'cold_ntep'],
      
      regionalTraits: {
        
        temperate_au: {
          // Keysborough GC Melbourne 2014-2016 - ACTUAL AUSTRALIAN DATA
          qualityRating: 6.2,
          qualitySource: 'ASTMA/Heritage Seeds Keysborough GC trial 2014-2016 (Neylan, ATM 21.5)',
          dataConfidence: 'high',
          
          traits: {
            
            shade: {
              thresholdModifier: 0.85,
              confidence: 'high',
              source: 'Tee-2-Green + NTEP 2006 fairway trials - Most shade-tolerant bentgrass',
              notes: 'EXCELLENT: Requires only 3-4 hours sunlight per day'
            },
            
            heat: {
              stressRecoveryMultiplier: 1.10,
              confidence: 'high',
              source: 'Keysborough GC Feb 2015 - Quality 5.0 after drought (vs Pure Distinction 7.3)',
              notes: 'CAUTION: Less heat-tolerant than marketed - struggled in drought'
            },
            
            poaCompetition: {
              aggression: 0.85,
              confidence: 'high',
              source: 'Keysborough GC Oct 2016 - 15% Poa invasion (same as MacKenzie, Penn G2)',
              notes: 'POOR: Worse than Pure Distinction (1.7%), Penn A4 (5%)'
            },
            
            salinity: {
              multiplier: 0.85,
              confidence: 'medium',
              source: 'Tee-2-Green - Good salt tolerance',
              notes: 'Good for coastal or effluent-irrigated courses'
            },
            
            disease: {
              dollarSpot: {
                riskMultiplier: 1.10,
                confidence: 'high',
                source: 'Penn State 2008-2013 - Intermediate tolerance (not "excellent")',
                notes: 'Average - less resistant than Declaration, 007'
              },
              brownPatch: { riskMultiplier: 0.90, confidence: 'medium', source: 'Tee-2-Green' },
              fusariumPatch: { riskMultiplier: 0.85, confidence: 'medium', source: 'Tee-2-Green' }
            }
          },
          
          trialData: {
            keysborough_2014: {
              source: 'ASTMA/Heritage Seeds Keysborough GC Trial',
              publication: 'Neylan, ATM Issue 21.5',
              location: 'Keysborough Golf Club, Melbourne',
              coordinates: { lat: -38.02, lng: 145.17 },
              years: '2014-2016',
              keyFindings: [
                'Intermediate quality throughout trial',
                'Poor heat/drought recovery - struggled Feb 2015',
                'High Poa invasion (15%) - worse than Pure Distinction',
                'Best shade tolerance of tested varieties'
              ],
              recommendation: 'Best for SHADED areas with reliable irrigation; not for hot/dry sites'
            }
          }
        },
        
        cold_ntep: {
          // Penn State data → Canberra/highlands
          qualityRating: 6.2,
          qualitySource: 'NTEP Penn State fairway trials',
          climateEquivalent: 'Canberra, Southern Highlands',
          
          traits: {
            shade: { thresholdModifier: 0.85, confidence: 'high', source: 'NTEP' },
            disease: {
              dollarSpot: { riskMultiplier: 1.10, confidence: 'high', source: 'Penn State 2008-2013' },
              fusariumPatch: { riskMultiplier: 0.85, confidence: 'medium', source: 'NTEP' }
            }
          },
          
          notes: 'Good choice for shaded cold climate greens; monitor dollar spot'
        },
        
        subtropical: {
          qualityRating: null,
          dataAvailable: false,
          recommendation: 'NOT RECOMMENDED - poor heat tolerance at Keysborough suggests struggle in QLD',
          notes: 'Consider ultradwarf bermuda for subtropical putting greens'
        }
      }
    },
    
    'Tyee': {
      species: 'bentgrass',
      displayName: 'Tyee',
      
      testedRegions: ['temperate_ntep', 'cold_ntep', 'au_temperate'],
      
      regionalTraits: {
        temperate_ntep: {
          qualityRating: 6.5,
          qualitySource: 'NTEP bentgrass trials',
          climateEquivalent: 'Sydney, Perth, Adelaide',
          
          traits: {
            shade: { thresholdModifier: 0.90, confidence: 'medium', source: 'NTEP shade trials', notes: 'Good shade tolerance' },
            disease: {
              dollarSpot: { riskMultiplier: 0.90, confidence: 'medium', source: 'NTEP' },
              brownPatch: { riskMultiplier: 1.00, confidence: 'medium', source: 'NTEP' }
            }
          },
          notes: 'Good shade tolerance makes it suitable for partially shaded greens'
        },
        
        cold_ntep: {
          qualityRating: 6.5,
          climateEquivalent: 'Canberra, Southern Highlands',
          dataAvailable: 'ntep_interpolated'
        }
      }
    },
    
    'Mackenzie': {
      species: 'bentgrass',
      displayName: 'Mackenzie',
      
      testedRegions: ['temperate_ntep', 'cold_ntep', 'au_temperate'],
      
      regionalTraits: {
        temperate_ntep: {
          qualityRating: 6.8,
          qualitySource: 'NTEP bentgrass trials',
          climateEquivalent: 'Sydney, Perth, Adelaide',
          
          traits: {
            heat: { toleranceMultiplier: 0.90, confidence: 'medium', source: 'NTEP summer data', notes: 'Good summer stress tolerance' },
            disease: {
              dollarSpot: { riskMultiplier: 0.85, confidence: 'medium', source: 'NTEP' },
              brownPatch: { riskMultiplier: 0.95, confidence: 'medium', source: 'NTEP' }
            }
          },
          notes: 'Good heat tolerance for temperate Australian summers'
        },
        
        cold_ntep: {
          qualityRating: 6.8,
          climateEquivalent: 'Canberra, Southern Highlands',
          dataAvailable: 'ntep_interpolated'
        }
      }
    },
    
    'Penn A-4': {
      species: 'bentgrass',
      displayName: 'Penn A-4',
      
      // Has Keysborough AU reference data + NTEP
      testedRegions: ['temperate_au', 'cold_ntep'],
      
      regionalTraits: {
        temperate_au: {
          // Referenced in Keysborough GC trial (used as comparator)
          qualityRating: 6.8,
          qualitySource: 'NTEP + Keysborough GC 2014-2016 (comparator)',
          climateEquivalent: 'Melbourne',
          
          traits: {
            density: { multiplier: 1.15, confidence: 'high', source: 'NTEP - Ultra-fine texture' },
            heat: {
              stressRecoveryMultiplier: 1.15,
              confidence: 'high',
              source: 'Keysborough GC Feb 2015 - Quality 4.7 after drought (worse than Pure Distinction 7.3)',
              notes: 'CAUTION: Poor heat/drought recovery at Keysborough'
            },
            poaCompetition: {
              aggression: 0.95,
              confidence: 'high',
              source: 'Keysborough GC - 5% Poa invasion',
              notes: 'Good Poa competition - second best behind Pure Distinction'
            },
            disease: {
              dollarSpot: {
                riskMultiplier: 1.20,
                confidence: 'high',
                source: 'NTEP - susceptible',
                notes: 'Requires preventative fungicide program'
              },
              anthracnose: { riskMultiplier: 0.85, confidence: 'medium', source: 'NTEP' }
            }
          },
          
          notes: 'Industry standard for putting quality; poor drought recovery at Keysborough; dollar spot susceptible'
        },
        
        cold_ntep: {
          qualityRating: 6.8,
          qualitySource: 'NTEP Purdue/Penn State',
          climateEquivalent: 'Canberra, Southern Highlands',
          
          traits: {
            disease: {
              dollarSpot: { riskMultiplier: 1.20, confidence: 'high', source: 'NTEP - susceptible' }
            }
          },
          notes: 'Dollar spot susceptibility a concern in cold climates'
        }
      }
    },
    
    'L-93': {
      species: 'bentgrass',
      displayName: 'L-93',
      
      testedRegions: ['temperate_ntep', 'cold_ntep', 'au_temperate'],
      
      regionalTraits: {
        temperate_ntep: {
          // NTEP 2008-2013, 2014 putting green and fairway/tee trials
          qualityRating: 6.3,
          qualitySource: 'NTEP putting green trials',
          climateEquivalent: 'Sydney, Perth, Adelaide',
          
          traits: {
            heat: { toleranceMultiplier: 0.95, droughtMultiplier: 0.95, confidence: 'medium', source: 'NTEP 2014 drought trials', notes: 'Good heat tolerance, intermediate drought tolerance. Adapted through transition zone.' },
            cold: { winterHardiness: 1.00, winterkillRisk: 1.00, dormancyThresholdModifier: 1.00, confidence: 'medium', source: 'NTEP cold regions', notes: 'Average cold tolerance for creeping bentgrass' },
            wear: { multiplier: 1.00, recoveryMultiplier: 1.05, confidence: 'medium', source: 'NTEP fairway/tee trials (Penn State)', notes: 'Intermediate wear tolerance. Upright growth, not excessively dense, less scalping risk than Declaration/Proclamation.' },
            waterUse: { multiplier: 1.00, confidence: 'low', source: 'NTEP, no dedicated water use data', notes: 'No specific water use efficiency data. Average for creeping bentgrass.' },
            shade: { thresholdModifier: 1.00, confidence: 'low', source: 'Species baseline', notes: 'No specific shade data. Creeping bentgrass generally moderate shade tolerance.' },
            establishment: { germinationSpeed: 1.15, confidence: 'high', source: 'NTEP 2008 Penn State, greatest seedling vigor', notes: 'Excellent establishment vigor, tied highest in NTEP trials' },
            disease: {
              dollarSpot: { riskMultiplier: 1.05, confidence: 'high', source: 'NTEP 2008-2013: intermediate tolerance (Penn State). Very good in fairway trials. Newer cultivars (Declaration, Proclamation) now superior.' },
              brownPatch: { riskMultiplier: 0.90, confidence: 'medium', source: 'NTEP', notes: 'Good brown patch tolerance' },
              fusarium: { riskMultiplier: 0.90, confidence: 'medium', source: 'Jacklin/NTEP, exceptional Microdochium resistance' },
              anthracnose: { riskMultiplier: 1.00, confidence: 'low', source: 'No specific data' }
            },
            poaCompetition: {
              aggression: 0.80,
              confidence: 'high',
              source: 'NTEP 2008-2013 Penn State, greatest Poa encroachment alongside Penncross',
              notes: 'POOR Poa annua competition. Requires aggressive cultural management to maintain bentgrass purity.'
            }
          },
          notes: 'Excellent establishment, good heat/disease tolerance, but poor Poa competition. Intermediate quality in recent trials, newer cultivars (Declaration, Proclamation, 007) now outperform.'
        },
        
        cold_ntep: {
          qualityRating: 6.3,
          qualitySource: 'NTEP, Purdue/Penn State',
          climateEquivalent: 'Canberra, Southern Highlands',
          
          traits: {
            cold: { winterHardiness: 1.00, winterkillRisk: 1.00, confidence: 'medium', source: 'NTEP cold regions' },
            disease: {
              dollarSpot: { riskMultiplier: 1.05, confidence: 'high', source: 'NTEP 2008-2013' },
              brownPatch: { riskMultiplier: 0.90, confidence: 'medium', source: 'NTEP' }
            }
          }
        }
      }
    },
    
    'Providence': {
      species: 'bentgrass',
      displayName: 'Providence',
      
      testedRegions: ['cold_ntep'],
      
      regionalTraits: {
        cold_ntep: {
          qualityRating: 6.5,
          qualitySource: 'NTEP putting green trials',
          climateEquivalent: 'Canberra, Southern Highlands',
          
          traits: {
            cold: { winterHardiness: 1.05, confidence: 'medium', source: 'NTEP', notes: 'Good cold tolerance' },
            disease: {
              dollarSpot: { riskMultiplier: 0.95, confidence: 'medium', source: 'NTEP' },
              brownPatch: { riskMultiplier: 0.95, confidence: 'medium', source: 'NTEP' }
            }
          },
          notes: 'Good cold tolerance and overall disease resistance'
        },
        
        temperate_ntep: {
          qualityRating: 6.5,
          climateEquivalent: 'Sydney, Perth, Adelaide',
          dataAvailable: 'ntep_interpolated'
        }
      }
    },
    
    'Memorial': {
      species: 'bentgrass',
      displayName: 'Memorial',
      
      testedRegions: ['temperate_ntep', 'cold_ntep'],
      
      regionalTraits: {
        temperate_ntep: {
          qualityRating: 6.7,
          qualitySource: 'NTEP putting green trials',
          climateEquivalent: 'Sydney, Perth, Adelaide',
          
          traits: {
            density: { multiplier: 1.08, confidence: 'medium', source: 'NTEP', notes: 'Good density and fine texture' },
            disease: {
              dollarSpot: { riskMultiplier: 0.85, confidence: 'medium', source: 'NTEP', notes: 'Good resistance' },
              brownPatch: { riskMultiplier: 0.90, confidence: 'medium', source: 'NTEP' }
            }
          },
          notes: 'Good all-round performer with fine texture'
        },
        
        cold_ntep: {
          qualityRating: 6.7,
          climateEquivalent: 'Canberra, Southern Highlands',
          dataAvailable: 'ntep_interpolated'
        }
      }
    }
  },
  
  // ═══════════════════════════════════════════════════════════════════════════
  // PERENNIAL RYEGRASS (Lolium perenne) - 13 varieties
  // Primary source: NTEP 2022-2024 and 2016-2021 Perennial Ryegrass Tests
  // Australian/Japan overseed varieties included (Fiesta 4, Cutter 2, Intense)
  // ═══════════════════════════════════════════════════════════════════════════
  
  perennialRyegrass: {
    
    // ═══════════════════════════════════════════════════════════════════════════
    // DERBY XTREME - Updated with verified NTEP 2004 trial data (2005-2009)
    // Entry #45, DLF International Seeds (IS-PR 268)
    // ═══════════════════════════════════════════════════════════════════════════
    'Derby Xtreme': {
      species: 'perennialRyegrass',
      displayName: 'Derby Xtreme',
      
      // VERIFIED: NTEP 2004 Final Report Table 1 - Schedule A (High Maintenance)
      qualityRating: 6.5,
      qualitySource: 'NTEP 2004 Trial (2005-2009), Table 1, 7 locations Schedule A - Ranked #5 of 119 entries',
      
      testedRegions: ['ntep_us', 'au_temperate'],
      
      traits: {
        // Genetic color - VERIFIED: Iowa 2006 data shows 8.3
        color: {
          geneticColor: 8.3,
          confidence: 'high',
          source: 'NTEP 2004 Iowa 2006 data (pr04ia106t.txt)',
          notes: 'Dark green color'
        },
        
        // Leaf texture - VERIFIED: Iowa 2006 data shows 6.3
        texture: {
          leafTexture: 6.3,
          confidence: 'high',
          source: 'NTEP 2004 Iowa 2006 data',
          notes: 'Medium-fine texture'
        },
        
        wear: {
          multiplier: 0.92,
          confidence: 'medium',
          source: 'NTEP 2004 traffic trials - good overall performance',
          notes: 'Suitable for sports turf applications'
        },
        
        // VERIFIED: Gray Leaf Spot resistance - Champion GQ/SRO data + PACE Turf 2006
        disease: {
          grayLeafSpot: {
            riskMultiplier: 0.83,  // 8.3/9 on NTEP scale = 0.83 multiplier
            confidence: 'high',
            source: 'NTEP 2004 Gray Leaf Spot Table, Mean of 2 locations 2005 - Rating 8.3/9',
            notes: 'Top performer for GLS resistance - PACE Turf Sept 2006 listed as GLS resistant'
          },
          crownRust: {
            riskMultiplier: 0.75,
            confidence: 'medium',
            source: 'NTEP 2004 Crown Rust trials',
            notes: 'Good crown rust resistance (7.0-7.5 rating)'
          },
          redThread: {
            riskMultiplier: 0.93,
            confidence: 'medium',
            source: 'NTEP 2004 disease data',
            notes: 'Moderate red thread resistance'
          },
          dollarSpot: {
            riskMultiplier: 1.00,
            confidence: 'medium',
            source: 'NTEP 2004 disease data',
            notes: 'Moderate dollar spot susceptibility'
          }
        },
        
        density: {
          summer: 6.7,
          confidence: 'medium',
          source: 'NTEP 2004 density ratings',
          notes: 'Good summer density maintenance'
        }
      }
    },
    
    'Karma': {
      species: 'perennialRyegrass',
      displayName: 'Karma',
      
      qualityRating: 5.1,
      qualitySource: 'NTEP 2022-2024 LPI Group 1',
      
      traits: {
        wear: {
          multiplier: 1.10, // Lower wear tolerance
          confidence: 'high',
          source: 'NTEP 2024 - Lower quality under traffic stress',
          notes: 'Not in top group for traffic'
        },
        
        disease: {
          grayLeafSpot: {
            riskMultiplier: 0.75, // Superior GLS resistance
            confidence: 'high',
            source: 'DLF - Superior Gray Leaf Spot resistance',
            notes: 'Key selling point is GLS resistance'
          },
          brownPatch: {
            riskMultiplier: 1.00,
            confidence: 'medium',
            source: 'NTEP - average brown patch susceptibility',
            notes: 'Average BP tolerance, bred primarily for GLS resistance'
          }
        }
      }
    },
    
    // ═══════════════════════════════════════════════════════════════════════════
    // SOPRANO - DLF Seeds (Entry DP1)
    // Source: NTEP 2004 National Perennial Ryegrass Test (2005-2009)
    // Widely used in Australian stadiums for winter oversowing
    // ═══════════════════════════════════════════════════════════════════════════
    'Soprano': {
      species: 'perennialRyegrass',
      displayName: 'Soprano',
      
      // VERIFIED: NTEP 2004 North Central Region 2008 - Mean 6.3
      qualityRating: 6.3,
      qualitySource: 'NTEP 2004 Trial, North Central Region 2008 (pr04_09-11/pr0409t06.txt)',
      
      testedRegions: ['ntep_north_central', 'ntep_us', 'au_temperate', 'nzsti_nz'],
      
      traits: {
        // VERIFIED: NTEP 2004 North Central Region 2008 data
        // Individual location scores: IA1 5.5, IL1 7.0, IN1 6.4, MI1 7.0, MN1 5.2, NE1 8.4, SD1 6.4, WI1 4.8
        regionalQuality: {
          iowa: 5.5,
          illinois: 7.0,
          indiana: 6.4,
          michigan: 7.0,
          minnesota: 5.2,
          nebraska: 8.4,  // Best performance
          southDakota: 6.4,
          wisconsin: 4.8,
          mean: 6.3,
          confidence: 'high',
          source: 'NTEP 2004 Table 6, North Central Region 2008',
          notes: 'Strong performer in warmer NC locations (NE, IL, MI), weaker in cold (MN, WI)'
        },
        
        // VERIFIED: NTEP 2004 St Paul MN 2005-2009 seasonal data
        // Shows lower cold climate performance
        coldClimate: {
          stPaulMean: 4.9,
          confidence: 'high',
          source: 'NTEP 2004 Table 11, St Paul MN 2005-2009',
          notes: 'Lower performance in cold climate - ranked mid-pack at St Paul'
        },
        
        // Virginia/Maryland 2024-25 - still recommended after 15+ years
        currentStatus: {
          recommendation: 'Category I - Recommended',
          confidence: 'high',
          source: 'Virginia Tech SPES-617, 2024-25 Turfgrass Variety Recommendations',
          notes: 'Still listed as recommended variety for VA/MD region'
        },
        
        // Wear tolerance - inferred from quality maintenance
        wear: {
          multiplier: 0.95,
          confidence: 'medium',
          source: 'NTEP 2004 quality data - good overall quality suggests adequate wear',
          notes: 'No specific traffic data available, estimate based on quality scores'
        }
      }
    },
    
    // ═══════════════════════════════════════════════════════════════════════════
    // SPARTACUS - PGG Wrightson Turf (NZ market variety)
    // Source: PGG Wrightson Turf NZ specifications
    // ═══════════════════════════════════════════════════════════════════════════
    'Spartacus': {
      species: 'perennialRyegrass',
      displayName: 'Spartacus',
      
      qualityRating: 6.5,
      qualitySource: 'PGG Wrightson Turf NZ specifications - scores well in density and fineness trials',
      
      testedRegions: ['nzsti_nz', 'au_temperate'],
      
      traits: {
        color: {
          geneticColor: 'medium-dark',
          colorRetention: 'excellent',
          confidence: 'high',
          source: 'PGG Wrightson Turf specifications',
          notes: 'Outstanding lively green colour retention with absence of browning'
        },
        
        density: {
          shootDensity: 6.8,
          confidence: 'medium',
          source: 'PGG Wrightson Turf - scores well in trials for density',
          notes: 'Good density maintenance year-round'
        },
        
        texture: {
          leafTexture: 6.5,
          finenessOfLeaf: 'fine',
          confidence: 'medium',
          source: 'PGG Wrightson Turf - scores well in trials for fineness',
          notes: 'Fine-leaved Continental type'
        },
        
        wear: {
          multiplier: 0.92,
          confidence: 'medium',
          source: 'PGG Wrightson Turf specifications - turf type ryegrass',
          notes: 'Hard wearing, suitable for sports turf'
        },
        
        winterActivity: {
          type: 'Continental',
          winterGrowth: 'moderate',
          confidence: 'medium',
          source: 'PGG Wrightson Turf specifications',
          notes: 'Continental type - less winter active than Mediterranean varieties but darker colour'
        },
        
        establishment: {
          germinationSpeed: 'fast',
          confidence: 'medium',
          source: 'PGG Wrightson Turf - turf type PRG characteristics',
          notes: 'Quick to germinate, suitable for overseeding'
        }
      }
    },
    
    // ═══════════════════════════════════════════════════════════════════════════
    // RELIANT II - NZ-bred premier turf ryegrass
    // Source: Village Green Seeds/NZ Turf specifications
    // ═══════════════════════════════════════════════════════════════════════════
    'Reliant II': {
      species: 'perennialRyegrass',
      displayName: 'Reliant II',
      
      qualityRating: 6.6,
      qualitySource: 'Village Green Seeds NZ specifications - premier NZ-bred variety',
      
      testedRegions: ['nzsti_nz'],
      
      traits: {
        color: {
          geneticColor: 'dark-green',
          confidence: 'medium',
          source: 'Village Green Seeds specifications',
          notes: 'Premium dark green colour'
        },
        
        density: {
          shootDensity: 6.8,
          confidence: 'medium',
          source: 'Village Green Seeds - premier turf characteristics',
          notes: 'High density turf formation'
        },
        
        wear: {
          multiplier: 0.88,
          confidence: 'medium',
          source: 'Village Green Seeds - premier sports turf variety',
          notes: 'Excellent wear tolerance - bred for NZ sports conditions'
        },
        
        recovery: {
          rateMultiplier: 0.90,
          confidence: 'medium',
          source: 'NZ Turf industry specifications',
          notes: 'Good recovery from wear damage'
        },
        
        establishment: {
          germinationSpeed: 'fast',
          confidence: 'medium',
          source: 'Turf type PRG characteristics',
          notes: 'Rapid establishment'
        }
      }
    },
    
    // ═══════════════════════════════════════════════════════════════════════════
    // VERVE - NZ-bred specifically for winter sports fields
    // Source: Barenbrug/Living Turf NZ specifications
    // ═══════════════════════════════════════════════════════════════════════════
    'Verve': {
      species: 'perennialRyegrass',
      displayName: 'Verve',
      
      qualityRating: 6.4,
      qualitySource: 'Barenbrug/Living Turf NZ - bred specifically for winter sports',
      
      testedRegions: ['au_temperate'],
      
      traits: {
        wear: {
          multiplier: 0.85,
          confidence: 'medium',
          source: 'Barenbrug specifications - bred for wear tolerance',
          notes: 'Very good wear tolerance - natural choice for high use situations'
        },
        
        establishment: {
          germinationSpeed: 'rapid',
          emergenceDays: '5-7',
          confidence: 'medium',
          source: 'Barenbrug specifications',
          notes: 'Rapid germination and establishment - key breeding objective'
        },
        
        winterActivity: {
          type: 'winter-active',
          winterGrowth: 'high',
          confidence: 'medium',
          source: 'Barenbrug specifications - bred for winter sports',
          notes: 'Specifically bred for use in winter sports fields'
        },
        
        recovery: {
          rateMultiplier: 0.88,
          confidence: 'medium',
          source: 'Barenbrug specifications',
          notes: 'Good recovery from traffic damage'
        }
      }
    },
    
    // ═══════════════════════════════════════════════════════════════════════════
    // 4TURF (Tetraploid PRG) - DLF Seeds
    // Source: DLF 4turf specifications, Scanturf trials
    // Represented by Tetradark as most common variety
    // ═══════════════════════════════════════════════════════════════════════════
    '4turf Tetradark': {
      species: 'perennialRyegrass',
      displayName: '4turf Tetradark',
      
      qualityRating: 6.5,
      qualitySource: 'DLF 4turf specifications, Scanturf trials - #1 for general turf quality',
      
      testedRegions: ['scanturf_nordic', 'nzsti_nz', 'au_temperate', 'bspb_uk'],
      
      traits: {
        ploidy: {
          type: 'tetraploid',
          chromosomeSets: 4,
          confidence: 'high',
          source: 'DLF breeding program',
          notes: 'Tetraploid - four chromosome sets vs standard diploid two sets'
        },
        
        coldGermination: {
          minimumSoilTemp: 3, // °C
          confidence: 'high',
          source: 'DLF 4turf specifications',
          notes: 'Fast germination at soil temperatures as low as 3-4°C - major advantage for late season overseeding'
        },
        
        establishment: {
          germinationSpeed: 'very-fast',
          seedlingVigor: 'excellent',
          confidence: 'high',
          source: 'DLF 4turf specifications',
          notes: 'Larger seeds = more energy reserves for faster, stronger establishment'
        },
        
        disease: {
          fusarium: {
            riskMultiplier: 0.80,
            confidence: 'medium',
            source: 'DLF 4turf specifications',
            notes: 'Improved tolerance to Fusarium/Microdochium in autumn/winter'
          },
          redThread: {
            riskMultiplier: 0.85,
            confidence: 'medium',
            source: 'DLF 4turf specifications',
            notes: 'Improved Red Thread tolerance'
          },
          overallResistance: 6.5,
          confidence: 'medium',
          source: 'DLF - larger energy reserves increase natural disease resistance',
          notes: 'Enhanced disease tolerance from tetraploid vigor'
        },
        
        drought: {
          toleranceMultiplier: 0.75,
          confidence: 'high',
          source: 'DLF Loire Valley drought trials - index 133 vs diploid 100',
          notes: 'Larger root system = 33% better drought tolerance than diploid PRG'
        },
        
        wear: {
          multiplier: 0.88,
          confidence: 'medium',
          source: 'DLF trials - improved shade and wear tolerance at 60% PAR',
          notes: 'Greater ground cover and wear-tolerance even at reduced light levels'
        },
        
        shade: {
          thresholdModifier: 0.90,
          confidence: 'medium',
          source: 'DLF trials at 60% PAR',
          notes: 'Improved shade tolerance vs diploid varieties'
        },
        
        salinity: {
          tolerance: 'improved',
          confidence: 'medium',
          source: 'DLF 4salt specifications',
          notes: 'Significantly more salt-tolerant than diploid PRG'
        },
        
        winterHardiness: {
          scanturf: 'excellent',
          confidence: 'high',
          source: 'Scanturf trials Finland - Fabian #1 for general turf quality',
          notes: 'Superior winter hardiness demonstrated in Nordic trials'
        },
        
        color: {
          geneticColor: 'dark-green',
          winterColor: 'good',
          confidence: 'medium',
          source: 'DLF specifications',
          notes: 'Deeper green colour than traditional diploid ryegrass'
        },
        
        blendingNotes: {
          recommendation: 'Mix with diploid PRG, fescues, or KBG',
          maxPercentage: 20, // % in blend
          confidence: 'medium',
          source: 'DLF recommendations',
          notes: 'Best results when blended - typically 10-20% of mix'
        }
      }
    },
    
    'SR 4700': {
      species: 'perennialRyegrass',
      displayName: 'SR 4700',
      
      testedRegions: ['nzsti_nz'],
      
      qualityRating: 6.3,
      qualitySource: 'NTEP 2016-2021',
      
      traits: {
        wear: {
          multiplier: 0.90,
          confidence: 'high',
          source: 'NTEP traffic trials',
          notes: 'Very good wear tolerance'
        },
        
        disease: {
          grayLeafSpot: {
            riskMultiplier: 0.85,
            confidence: 'high',
            source: 'NTEP 2016 - Superior quality across locations including GLS pressure sites',
            notes: 'Good disease package'
          },
          brownPatch: {
            riskMultiplier: 0.95,
            confidence: 'medium',
            source: 'NTEP',
            notes: 'Slightly above average'
          }
        },
        
        salt: {
          toleranceMultiplier: 0.85,
          confidence: 'medium',
          source: 'NTEP salt stress trials',
          notes: 'Good salt tolerance'
        }
      }
    },
    
    // Additional varieties from your mockup list
    'Slugger 3GL': {
      species: 'perennialRyegrass',
      displayName: 'Slugger 3GL',
      
      testedRegions: ['au_temperate', 'nzsti_nz'],
      
      qualityRating: 6.2,
      qualitySource: 'Historical NTEP data',
      
      traits: {
        wear: {
          multiplier: 0.92,
          confidence: 'medium',
          source: 'NTEP traffic trials',
          notes: 'Good wear tolerance'
        },
        
        disease: {
          grayLeafSpot: {
            riskMultiplier: 0.82,
            confidence: 'high',
            source: 'GL designation indicates gray leaf spot breeding',
            notes: 'Gray leaf spot resistant variety'
          },
          brownPatch: {
            riskMultiplier: 0.88,
            confidence: 'medium',
            source: 'NTEP disease trials - good overall disease package',
            notes: 'Above average brown patch tolerance'
          }
        }
      }
    },
    
    'Pinnacle 3': {
      species: 'perennialRyegrass', 
      displayName: 'Pinnacle 3',
      
      testedRegions: ['au_temperate'],
      
      qualityRating: 6.1,
      qualitySource: 'NTEP historical',
      
      traits: {
        wear: {
          multiplier: 0.95,
          confidence: 'medium',
          source: 'NTEP',
          notes: 'Average to good'
        },
        
        disease: {
          grayLeafSpot: {
            riskMultiplier: 1.00,
            confidence: 'medium',
            source: 'NTEP',
            notes: 'Average GLS tolerance'
          },
          brownPatch: {
            riskMultiplier: 1.00,
            confidence: 'medium',
            source: 'NTEP - baseline brown patch susceptibility',
            notes: 'Average brown patch tolerance'
          }
        }
      }
    },
    
    'RPR': {
      species: 'perennialRyegrass',
      displayName: 'RPR (Regenerating Perennial Ryegrass)',
      
      testedRegions: ['au_temperate'],
      
      qualityRating: 6.0,
      qualitySource: 'NTEP + Barenbrug trials',
      
      traits: {
        wear: {
          multiplier: 0.82, // Excellent wear - regenerating stolons
          confidence: 'high',
          source: 'NTEP traffic trials + Barenbrug research',
          notes: 'Unique stoloniferous habit aids recovery'
        },
        
        disease: {
          grayLeafSpot: {
            riskMultiplier: 1.00,
            confidence: 'medium',
            source: 'NTEP',
            notes: 'Average GLS tolerance'
          },
          brownPatch: {
            riskMultiplier: 1.05,
            confidence: 'medium',
            source: 'NTEP disease ratings - average susceptibility',
            notes: 'Slightly above average brown patch susceptibility'
          }
        },
        
        recovery: {
          rateMultiplier: 0.80, // CORRECTED: ~20% faster recovery estimated
          confidence: 'medium', // CORRECTED: Ohio State showed 37% larger plant circumference, not direct recovery rate
          source: 'Barenbrug/Ohio State - stoloniferous habit, 33" vs 24" plant circumference (37% larger)',
          notes: 'Determinate stolons enable lateral spread; specific recovery rate not quantified in peer-reviewed data'
        }
      }
    },
    
    'Barolympic': {
      species: 'perennialRyegrass',
      displayName: 'Barolympic',
      
      testedRegions: ['au_temperate'],
      
      qualityRating: 6.4,
      qualitySource: 'NTEP 2016-2021 data',
      
      traits: {
        wear: {
          multiplier: 0.88,
          confidence: 'high',
          source: 'NTEP traffic trials - Top group performer',
          notes: 'Excellent wear tolerance, sports turf use'
        },
        
        disease: {
          grayLeafSpot: {
            riskMultiplier: 0.85,
            confidence: 'medium',
            source: 'NTEP disease trials',
            notes: 'Good GLS tolerance'
          },
          brownPatch: {
            riskMultiplier: 0.95,
            confidence: 'medium',
            source: 'NTEP',
            notes: 'Above average'
          }
        },
        
        overseed: {
          transitionQuality: 1.05,
          confidence: 'medium',
          source: 'Barenbrug overseed trials',
          notes: 'Good establishment vigour'
        }
      }
    },
    
    'Barorlando': {
      species: 'perennialRyegrass',
      displayName: 'Barorlando',
      
      testedRegions: ['au_temperate'],
      
      qualityRating: 6.3,
      qualitySource: 'NTEP 2016-2021 data',
      
      traits: {
        wear: {
          multiplier: 0.90,
          confidence: 'high',
          source: 'NTEP traffic trials',
          notes: 'Very good wear tolerance'
        },
        
        heat: {
          toleranceMultiplier: 0.90,
          confidence: 'medium',
          source: 'Barenbrug - developed for transition zone',
          notes: 'Better summer performance than standard PRG'
        },
        
        disease: {
          grayLeafSpot: {
            riskMultiplier: 0.90,
            confidence: 'medium',
            source: 'NTEP',
            notes: 'Good disease package'
          }
        },
        
        overseed: {
          transitionQuality: 1.10,
          confidence: 'medium',
          source: 'Barenbrug - bred for warm-season overseed',
          notes: 'Clean spring transition'
        }
      }
    },
    
    'Premier 3': {
      species: 'perennialRyegrass',
      displayName: 'Premier 3',
      
      testedRegions: ['au_temperate'],
      
      qualityRating: 6.2,
      qualitySource: 'NTEP 2016-2021 data',
      
      traits: {
        wear: {
          multiplier: 0.92,
          confidence: 'high',
          source: 'NTEP traffic trials',
          notes: 'Good wear tolerance'
        },
        
        shade: {
          thresholdModifier: 0.92,
          confidence: 'medium',
          source: 'NTEP shade trials',
          notes: 'Very good shade tolerance for PRG'
        },
        
        disease: {
          grayLeafSpot: {
            riskMultiplier: 0.85,
            confidence: 'high',
            source: 'NTEP - GLS tolerant designation',
            notes: 'Bred for gray leaf spot resistance'
          },
          brownPatch: {
            riskMultiplier: 0.90,
            confidence: 'medium',
            source: 'NTEP',
            notes: 'Good brown patch tolerance'
          }
        },
        
        density: {
          rating: 1.05,
          confidence: 'medium',
          source: 'NTEP genetic density ratings',
          notes: 'Good density'
        }
      }
    },
    
    'Intense': {
      species: 'perennialRyegrass',
      displayName: 'Intense',
      
      testedRegions: ['au_temperate'],
      
      qualityRating: 6.3,
      qualitySource: 'Landmark Seeds trials, Australian superintendent feedback',
      
      traits: {
        wear: {
          multiplier: 0.88,
          confidence: 'medium',
          source: 'Landmark Seeds - sports turf variety',
          notes: 'Bred for high traffic sports turf applications'
        },
        
        shade: {
          thresholdModifier: 1.00,
          confidence: 'low',
          source: 'Limited shade trial data',
          notes: 'Average shade tolerance'
        },
        
        disease: {
          grayLeafSpot: {
            riskMultiplier: 0.90,
            confidence: 'medium',
            source: 'Landmark Seeds disease ratings',
            notes: 'Good gray leaf spot tolerance'
          },
          brownPatch: {
            riskMultiplier: 0.95,
            confidence: 'medium',
            source: 'Landmark Seeds disease ratings',
            notes: 'Above average brown patch tolerance'
          }
        },
        
        recovery: {
          rateMultiplier: 0.90,
          confidence: 'medium',
          source: 'Landmark Seeds recovery trials',
          notes: 'Good recovery rate for sports turf'
        },
        
        overseed: {
          transitionQuality: 0.95,
          confidence: 'medium',
          source: 'Australian overseed experience',
          notes: 'Good establishment and transition quality'
        }
      }
    },
    
    'Homerun LS': {
      species: 'perennialRyegrass',
      displayName: 'Homerun LS',
      
      testedRegions: ['au_temperate'],
      
      qualityRating: 6.4,
      qualitySource: 'NTEP trials - Lateral Spread variety',
      
      traits: {
        wear: {
          multiplier: 0.85,
          confidence: 'high',
          source: 'NTEP traffic trials - Lateral Spread technology',
          notes: 'Excellent wear tolerance with self-repair capability'
        },
        
        recovery: {
          rateMultiplier: 0.85,
          confidence: 'high',
          source: 'NTEP - LS designation indicates improved lateral spread',
          notes: 'Enhanced divot recovery from lateral spread trait'
        },
        
        shade: {
          thresholdModifier: 0.95,
          confidence: 'medium',
          source: 'NTEP shade trials',
          notes: 'Good shade tolerance'
        },
        
        disease: {
          grayLeafSpot: {
            riskMultiplier: 0.85,
            confidence: 'high',
            source: 'NTEP disease data',
            notes: 'Good gray leaf spot tolerance'
          },
          brownPatch: {
            riskMultiplier: 0.90,
            confidence: 'medium',
            source: 'NTEP disease data',
            notes: 'Good brown patch tolerance'
          }
        },
        
        density: {
          rating: 1.10,
          confidence: 'medium',
          source: 'NTEP density ratings',
          notes: 'Good density from lateral spread'
        },
        
        overseed: {
          transitionQuality: 0.95,
          confidence: 'medium',
          source: 'Sports turf experience',
          notes: 'Good for warm-season overseed programs'
        }
      }
    },
    
    'Fiesta 4': {
      species: 'perennialRyegrass',
      displayName: 'Fiesta 4',
      
      qualityRating: 6.5,
      qualitySource: 'NTEP 2005, 2011 - High turf quality across all management levels',
      
      traits: {
        wear: {
          multiplier: 0.88,
          confidence: 'high',
          source: 'NTEP 2010 traffic trials',
          notes: 'Good wear tolerance, common stadium overseed variety'
        },
        
        disease: {
          grayLeafSpot: {
            riskMultiplier: 0.75,
            confidence: 'high',
            source: 'NTEP 2005-2011 - Highly resistant to Gray Leaf Spot at all locations all years',
            notes: 'Superior GLS resistance - key selling point'
          },
          brownPatch: {
            riskMultiplier: 0.95,
            confidence: 'medium',
            source: 'NTEP disease trials',
            notes: 'Above average brown patch resistance'
          }
        },
        
        density: {
          rating: 1.10,
          confidence: 'high',
          source: 'NTEP - High summer density ratings, very fine leaf texture',
          notes: 'High density variety'
        },
        
        recovery: {
          rateMultiplier: 0.88,
          confidence: 'medium',
          source: 'NTEP - Shows spreading ability via pseudo-stolons',
          notes: 'Better lateral spread than standard PRG'
        },
        
        overseed: {
          transitionQuality: 0.95,
          confidence: 'medium',
          source: 'Stadium experience worldwide',
          notes: 'Common J.League and global overseed variety'
        }
      }
    },
    
    'Cutter 2': {
      species: 'perennialRyegrass',
      displayName: 'Cutter 2',
      
      testedRegions: ['japan'],
      
      qualityRating: 6.3,
      qualitySource: 'NTEP trials - Sports turf variety',
      
      traits: {
        wear: {
          multiplier: 0.88,
          confidence: 'high',
          source: 'NTEP traffic trials - Excellent wear tolerance',
          notes: 'Bred for high traffic sports turf applications'
        },
        
        disease: {
          grayLeafSpot: {
            riskMultiplier: 0.85,
            confidence: 'medium',
            source: 'NTEP disease trials',
            notes: 'Good gray leaf spot tolerance'
          },
          brownPatch: {
            riskMultiplier: 0.90,
            confidence: 'medium',
            source: 'NTEP disease trials',
            notes: 'Good brown patch tolerance'
          }
        },
        
        density: {
          rating: 1.05,
          confidence: 'medium',
          source: 'NTEP density ratings',
          notes: 'Good density'
        },
        
        recovery: {
          rateMultiplier: 0.90,
          confidence: 'medium',
          source: 'NTEP recovery trials',
          notes: 'Good divot recovery'
        },
        
        overseed: {
          transitionQuality: 0.90,
          confidence: 'medium',
          source: 'Sports turf experience',
          notes: 'Clean spring transition'
        }
      }
    },
    
    // ═══════════════════════════════════════════════════════════════════════════
    // CENTURION - PGG Wrightson Turf (New Zealand bred)
    // Source: NZSTI Auckland Ryegrass Cultivar Trial 2005-2007 (A. Mitchell)
    // ═══════════════════════════════════════════════════════════════════════════
    'Centurion': {
      species: 'perennialRyegrass',
      displayName: 'Centurion',
      
      // Quality derived from density scores - top performer
      qualityRating: 6.8,
      qualitySource: 'NZSTI Auckland 2005-2007 - Top performer for establishment and worn density',
      
      testedRegions: ['nzsti_auckland'],
      
      traits: {
        // VERIFIED: Table 1 - Seedling vigor 7.0 (ranked #2)
        establishment: {
          seedlingVigor: 7.0,
          establishmentDensity: 9.0, // VERIFIED: Table 2 - Ranked #1 at 61 days
          confidence: 'high',
          source: 'NZSTI Auckland Table 1 & 2 (2005)',
          notes: 'Fastest establishing variety in trial - 9.0 density at 61 days (#1)'
        },
        
        // Genetic color and texture from PGG Wrightson specifications
        color: {
          geneticColor: 'mid-dark',
          confidence: 'medium',
          source: 'PGG Wrightson Turf specifications',
          notes: 'Mid-dark green, Continental type coloring'
        },
        
        texture: {
          leafTexture: 'fine',
          confidence: 'medium',
          source: 'PGG Wrightson Turf specifications',
          notes: 'Fine-leaved variety, close mowing to 12mm'
        },
        
        // VERIFIED: Table 5a - Unworn density Year 1: 7.1 (ranked #2)
        // VERIFIED: Table 5b - Unworn density Year 2: 6.9 (equal top)
        density: {
          unwornYear1: 7.1,
          unwornYear2: 6.9,
          wornYear1: 6.9, // VERIFIED: Table 6a - Best under wear (#1)
          wornYear2: 5.6, // VERIFIED: Table 6b
          confidence: 'high',
          source: 'NZSTI Auckland Tables 5a, 5b, 6a, 6b (2005-2007)',
          notes: 'Best performer under wear stress in NZSTI trial'
        },
        
        wear: {
          multiplier: 0.85, // 15% better than average based on top worn density rankings
          confidence: 'high',
          source: 'NZSTI Auckland Table 6a - Ranked #1 for worn density Year 1',
          notes: 'Excellent wear tolerance - best in NZSTI trial'
        },
        
        // VERIFIED: Table 3 - Red thread score 2.5 (0-5 scale)
        disease: {
          redThread: {
            riskMultiplier: 0.95, // Moderate susceptibility (2.5/5 = avg)
            confidence: 'high',
            source: 'NZSTI Auckland Table 3 Red Thread (2005-2006)',
            notes: 'Moderate red thread susceptibility'
          },
          meltingOut: {
            riskMultiplier: 0.85,
            confidence: 'medium',
            source: 'PGG Wrightson Turf Clippings Spring 2009',
            notes: 'Better summer resistance to melting-out disease'
          }
        },
        
        // PGG Wrightson specifications
        endophyte: {
          level: 'high',
          type: 'standard',
          confidence: 'medium',
          source: 'PGG Wrightson Turf specifications',
          notes: 'High level of standard endophyte for insect protection'
        },
        
        mowingHeight: {
          minimum: 12, // mm
          confidence: 'medium',
          source: 'PGG Wrightson Turf specifications',
          notes: 'Suitable for close-cut, high-density turf'
        }
      }
    },
    
    // ═══════════════════════════════════════════════════════════════════════════
    // COLOSSEUM - PGG Wrightson Turf (Mediterranean x American genetics)
    // Source: NZSTI Auckland Ryegrass Cultivar Trial 2005-2007 (A. Mitchell)
    // ═══════════════════════════════════════════════════════════════════════════
    'Colosseum': {
      species: 'perennialRyegrass',
      displayName: 'Colosseum',
      
      qualityRating: 6.0,
      qualitySource: 'NZSTI Auckland 2005-2007 - Mediterranean type with excellent winter activity',
      
      testedRegions: ['nzsti_auckland', 'au_temperate', 'au_subtropical'],
      
      traits: {
        // VERIFIED: Table 1 - Seedling vigor 6.0
        // VERIFIED: Table 2 - Establishment density 7.3
        establishment: {
          seedlingVigor: 6.0,
          establishmentDensity: 7.3,
          coldGermination: 'excellent', // Germinates down to 5°C
          confidence: 'high',
          source: 'NZSTI Auckland Table 1 & 2 (2005) + PGG Wrightson specifications',
          notes: 'Rapid germination in cold temperatures down to 5°C'
        },
        
        // PGG Wrightson specifications
        color: {
          geneticColor: 'mid-green',
          confidence: 'medium',
          source: 'PGG Wrightson Turf specifications',
          notes: 'Mid-green glossy appearance - masks Poa annua invasion'
        },
        
        texture: {
          leafTexture: 'medium-fine',
          confidence: 'medium',
          source: 'PGG Wrightson Turf specifications',
          notes: 'Attractive glossy medium-fine texture'
        },
        
        // VERIFIED: Table 5a - Unworn density Year 1: 6.2
        // VERIFIED: Table 5b - Unworn density Year 2: 5.8
        density: {
          unwornYear1: 6.2,
          unwornYear2: 5.8,
          wornYear1: 4.8, // VERIFIED: Table 6a
          wornYear2: 4.6, // VERIFIED: Table 6b
          confidence: 'high',
          source: 'NZSTI Auckland Tables 5a, 5b, 6a, 6b (2005-2007)',
          notes: 'Moderate density under wear - strength is winter activity not wear'
        },
        
        // VERIFIED: Table 3 - Red thread score 2.5 (0-5 scale)
        disease: {
          redThread: {
            riskMultiplier: 0.95,
            confidence: 'high',
            source: 'NZSTI Auckland Table 3 Red Thread (2005-2006)',
            notes: 'Moderate red thread susceptibility'
          }
        },
        
        // Special features - Mediterranean genetics
        winterActivity: {
          level: 'excellent',
          confidence: 'high',
          source: 'PGG Wrightson Turf specifications + NZSTI trial',
          notes: 'Mediterranean genetics - active winter growth in cool weather'
        },
        
        summerBrowning: {
          onset: 'delayed',
          confidence: 'medium',
          source: 'PGG Wrightson Turf specifications',
          notes: 'Delayed onset of browning in summer'
        },
        
        endophyte: {
          level: 'high',
          confidence: 'medium',
          source: 'PGG Wrightson Turf specifications',
          notes: 'High endophyte level for insect resistance'
        },
        
        // Special breeding origin
        breedingOrigin: {
          origin: 'test_cricket_pitch',
          confidence: 'medium',
          source: 'PGG Wrightson Turf Clippings',
          notes: 'Bred from surviving plants of test cricket pitch - extreme stress tolerance'
        },
        
        // Overseed suitability
        overseed: {
          winterOverseedRating: 'excellent',
          confidence: 'high',
          source: 'PGG Wrightson Turf Winter Oversowing Guide',
          notes: 'Ideal for winter oversowing of couch/bermuda - active growth at low temps'
        }
      }
    },
    
    // ═══════════════════════════════════════════════════════════════════════════
    // STELLAR 4GL - Seed Research of Oregon (PPG-PR 424)
    // Source: NTEP 2016-2021 National Perennial Ryegrass Test
    // 4th generation Gray Leaf Spot resistance + fastest divot recovery
    // ═══════════════════════════════════════════════════════════════════════════
    'Stellar 4GL': {
      species: 'perennialRyegrass',
      displayName: 'Stellar 4GL',
      
      qualityRating: 6.3,
      qualitySource: 'NTEP 2016-2021 National Perennial Ryegrass Test (PPG-PR 424)',
      
      traits: {
        wear: {
          multiplier: 0.82,
          confidence: 'high',
          source: 'NTEP 2016-2021 traffic trials - top traffic tolerance group',
          notes: 'Excellent traffic tolerance - bred for sports turf'
        },
        
        recovery: {
          rateMultiplier: 0.82,
          confidence: 'high',
          source: 'NTEP divot recovery trials - fastest recovery (8.5/9)',
          notes: 'Exceptional divot recovery - key feature for sports turf'
        },
        
        disease: {
          grayLeafSpot: {
            riskMultiplier: 0.70,
            confidence: 'high',
            source: 'NTEP 2016-2021 GLS trials (8.5/9 resistance)',
            notes: '4th generation Gray Leaf Spot resistance - 4GL designation'
          },
          crownRust: {
            riskMultiplier: 0.80,
            confidence: 'high',
            source: 'NTEP 2016-2021 crown rust trials',
            notes: 'Good crown rust resistance'
          },
          brownPatch: {
            riskMultiplier: 0.90,
            confidence: 'medium',
            source: 'NTEP disease trials',
            notes: 'Above average brown patch resistance'
          }
        },
        
        density: {
          rating: 1.10,
          confidence: 'high',
          source: 'NTEP density ratings',
          notes: 'Very high density - excellent turf quality'
        }
      }
    },
    
    // ═══════════════════════════════════════════════════════════════════════════
    // SUPERSTAR GL - Seed Research of Oregon (PPG-TF 420)
    // Source: NTEP 2016-2021
    // Gray Leaf Spot resistant with cold tolerance
    // ═══════════════════════════════════════════════════════════════════════════
    'Superstar GL': {
      species: 'perennialRyegrass',
      displayName: 'Superstar GL',
      
      qualityRating: 6.1,
      qualitySource: 'NTEP 2016-2021 (PPG-TF 420)',
      
      traits: {
        wear: {
          multiplier: 0.88,
          confidence: 'medium',
          source: 'NTEP traffic trials',
          notes: 'Good wear tolerance'
        },
        
        disease: {
          grayLeafSpot: {
            riskMultiplier: 0.75,
            confidence: 'high',
            source: 'NTEP GLS trials (8.0/9 resistance)',
            notes: 'GL designation - bred for Gray Leaf Spot resistance'
          },
          brownPatch: {
            riskMultiplier: 0.95,
            confidence: 'medium',
            source: 'NTEP disease trials',
            notes: 'Average brown patch resistance'
          }
        },
        
        cold: {
          winterHardiness: 0.85,
          confidence: 'high',
          source: 'NTEP cold tolerance trials',
          notes: 'Enhanced cold tolerance'
        },
        
        drought: {
          toleranceMultiplier: 0.85,
          confidence: 'medium',
          source: 'NTEP drought stress trials',
          notes: 'Good drought tolerance for PRG'
        },
        
        springGreenup: {
          rating: 0.80,
          confidence: 'high',
          source: 'NTEP spring greenup ratings (8.0/9)',
          notes: 'Early spring greenup - faster recovery from winter dormancy'
        }
      }
    },
    
    // ═══════════════════════════════════════════════════════════════════════════
    // BREAKOUT 2 - Seed Research of Oregon
    // Turf-type annual ryegrass for rapid establishment
    // ═══════════════════════════════════════════════════════════════════════════
    'Breakout 2': {
      species: 'perennialRyegrass',
      displayName: 'Breakout 2',
      
      qualityRating: 5.8,
      qualitySource: 'Seed Research of Oregon specifications',
      _warning: 'Turf-type annual ryegrass - use for rapid establishment only',
      
      traits: {
        establishment: {
          seedlingVigor: 0.70,
          germinationDays: 5,
          confidence: 'high',
          source: 'Seed Research of Oregon (9.0/9 seedling vigor)',
          notes: 'Extremely fast germination - 5-7 days'
        },
        
        wear: {
          multiplier: 0.95,
          confidence: 'medium',
          source: 'Seed Research specifications',
          notes: 'Good wear for annual type'
        },
        
        overseed: {
          transitionQuality: 0.85,
          confidence: 'high',
          source: 'Commercial overseed experience',
          notes: 'Ideal for quick repairs and overseeding programs'
        }
      },
      
      notes: 'Turf-type annual - use for rapid establishment, repairs, or overseed programs. Not a permanent variety.'
    },
    
    // ═══════════════════════════════════════════════════════════════════════════
    // SR 4650 - Seed Research of Oregon (PSRX-3701)
    // Source: NTEP 2016-2021
    // Highest Gray Leaf Spot resistance of any perennial ryegrass
    // ═══════════════════════════════════════════════════════════════════════════
    'SR 4650': {
      species: 'perennialRyegrass',
      displayName: 'SR 4650',
      
      testedRegions: ['au_temperate', 'nzsti_nz'],
      
      qualityRating: 6.2,
      qualitySource: 'NTEP 2016-2021 (PSRX-3701)',
      
      traits: {
        disease: {
          grayLeafSpot: {
            riskMultiplier: 0.65,
            confidence: 'high',
            source: 'NTEP 2016-2021 - Highest GLS resistance of any PRG (9.0/9)',
            notes: 'Best-in-class Gray Leaf Spot resistance'
          },
          brownPatch: {
            riskMultiplier: 0.90,
            confidence: 'medium',
            source: 'NTEP disease trials',
            notes: 'Good brown patch resistance'
          }
        },
        
        wear: {
          multiplier: 0.90,
          confidence: 'medium',
          source: 'NTEP traffic trials',
          notes: 'Good wear tolerance'
        },
        
        endophyte: {
          enhanced: true,
          confidence: 'high',
          source: 'Seed Research of Oregon specifications',
          notes: 'Endophyte-enhanced for insect resistance'
        }
      }
    },
    
    // ═══════════════════════════════════════════════════════════════════════════
    // SR 4660ST - Seed Research of Oregon
    // Source: NTEP 2016-2021 salt tolerance trials
    // Salt tolerant for coastal sites and recycled water
    // ═══════════════════════════════════════════════════════════════════════════
    'SR 4660ST': {
      species: 'perennialRyegrass',
      displayName: 'SR 4660ST',
      
      testedRegions: ['au_temperate', 'nzsti_nz'],
      
      qualityRating: 6.0,
      qualitySource: 'NTEP 2016-2021 salt tolerance trials',
      
      traits: {
        salt: {
          toleranceMultiplier: 0.70,
          confidence: 'high',
          source: 'NTEP salt stress trials (8.5/9 salt tolerance)',
          notes: 'ST designation - bred for salt tolerance. Best for coastal/poor water'
        },
        
        disease: {
          grayLeafSpot: {
            riskMultiplier: 0.80,
            confidence: 'medium',
            source: 'NTEP disease trials',
            notes: 'Good GLS resistance'
          }
        },
        
        wear: {
          multiplier: 0.92,
          confidence: 'medium',
          source: 'NTEP traffic trials',
          notes: 'Good wear tolerance'
        },
        
        drought: {
          toleranceMultiplier: 0.85,
          confidence: 'medium',
          source: 'NTEP drought trials',
          notes: 'Good drought tolerance'
        }
      },
      
      notes: 'Specialist salt-tolerant variety - ideal for coastal sites or recycled water irrigation'
    },

    // ═══════════════════════════════════════════════════════════════════════════
    // AUSTRALIAN MARKET PRG ADDITIONS
    // Varieties available in AU market - placeholder data pending trial results
    // ═══════════════════════════════════════════════════════════════════════════

    'SR 4600': {
      species: 'perennialRyegrass',
      displayName: 'SR 4600',
      
      testedRegions: ['au_temperate'],
      
      qualityRating: 6.0,
      qualitySource: 'Seed Research of Oregon - AU market variety',
      
      traits: {
        wear: {
          multiplier: 1.0,
          confidence: 'low',
          source: 'No AU trial data yet',
          notes: 'Placeholder - update with AU trial results'
        }
      }
    },

    'SR 4600ST': {
      species: 'perennialRyegrass',
      displayName: 'SR 4600ST',
      
      testedRegions: ['au_temperate'],
      
      qualityRating: 6.0,
      qualitySource: 'Seed Research of Oregon - salt tolerant AU market variant',
      
      traits: {
        wear: {
          multiplier: 1.0,
          confidence: 'low',
          source: 'No AU trial data yet',
          notes: 'Salt tolerant variant of SR 4600'
        },
        salt: {
          toleranceMultiplier: 0.80,
          confidence: 'low',
          source: 'ST designation - bred for salt tolerance',
          notes: 'Placeholder - update with AU trial results'
        }
      }
    },

    'Fiesta Cinqo': {
      species: 'perennialRyegrass',
      displayName: 'Fiesta Cinqo',
      
      testedRegions: ['au_temperate'],
      
      qualityRating: 6.5,
      qualitySource: 'Barenbrug - 5th generation Fiesta series, AU market',
      
      traits: {
        wear: {
          multiplier: 1.0,
          confidence: 'low',
          source: 'No AU trial data yet',
          notes: '5th generation Fiesta - update with AU trial results'
        }
      }
    },

    'Sox Fan': {
      species: 'perennialRyegrass',
      displayName: 'Sox Fan',
      
      testedRegions: ['au_temperate'],
      
      qualityRating: 6.0,
      qualitySource: 'AU market variety - pending trial data',
      
      traits: {
        wear: {
          multiplier: 1.0,
          confidence: 'low',
          source: 'No AU trial data yet',
          notes: 'Placeholder - update with AU trial results'
        }
      }
    },

    'Rio Vista': {
      species: 'perennialRyegrass',
      displayName: 'Rio Vista',
      
      testedRegions: ['au_temperate'],
      
      qualityRating: 6.0,
      qualitySource: 'AU market variety - pending trial data',
      
      traits: {
        wear: {
          multiplier: 1.0,
          confidence: 'low',
          source: 'No AU trial data yet',
          notes: 'Placeholder - update with AU trial results'
        }
      }
    }
  },
  
  // ═══════════════════════════════════════════════════════════════════════════
  // BROWNTOP BENT / COLONIAL BENTGRASS (Agrostis capillaris)
  // Primary source: BSPB Turfgrass Seed 2025 (STRI Bingley trials)
  // Also known as: Colonial bent, Common bent, NZ bentgrass
  // Key AU/NZ varieties from PGG Wrightson Turf breeding programme
  // ═══════════════════════════════════════════════════════════════════════════
  
  browntopBent: {
    
    // ═══════════════════════════════════════════════════════════════════════════
    // ARROWTOWN - PGG Wrightson Turf / DLF Seeds
    // Source: BSPB 2025 Table G1, PGG Wrightson Turf specifications
    // Bred from plants collected at Arrowtown Golf Club, NZ by Dr Alan Stewart
    // ═══════════════════════════════════════════════════════════════════════════
    'Arrowtown': {
      species: 'browntopBent',
      displayName: 'Arrowtown',
      
      // VERIFIED: BSPB 2025 Table G1 - Mean 7.0 (top browntop)
      qualityRating: 7.0,
      qualitySource: 'BSPB Turfgrass Seed 2025 Table G1 - STRI Bingley trials',
      
      testedRegions: ['bspb_uk', 'nzsti_nz', 'au_temperate'],
      
      traits: {
        // VERIFIED: BSPB 2025 - Shoot density 6.9-7.0
        density: {
          shootDensity: 7.0,
          confidence: 'high',
          source: 'BSPB 2025 Table G1',
          notes: 'Exceptionally dense - significantly denser than Egmont, Manor, Sefton'
        },
        
        // VERIFIED: BSPB 2025 - Fineness 6.7-7.2
        texture: {
          finenessOfLeaf: 7.0,
          confidence: 'high',
          source: 'BSPB 2025 Table G1',
          notes: 'Exceptionally fine texture - elite browntop'
        },
        
        // VERIFIED: BSPB 2025 - Visual merit 7.1-7.3
        visualMerit: {
          rating: 7.2,
          confidence: 'high',
          source: 'BSPB 2025 Table G1',
          notes: 'Excellent year-round visual quality'
        },
        
        // BSPB 2025 - Wear 5.8-5.9
        wear: {
          multiplier: 0.94,
          wearRating: 5.9,
          confidence: 'high',
          source: 'BSPB 2025 Table G1',
          notes: 'Good wear tolerance for browntop'
        },
        
        // BSPB 2025 - Disease 5.5-6.0
        disease: {
          overallResistance: 5.8,
          confidence: 'high',
          source: 'BSPB 2025 Table G1',
          notes: 'Moderate disease resistance'
        },
        
        // PGG Wrightson specifications
        drought: {
          toleranceMultiplier: 0.90,
          confidence: 'medium',
          source: 'DLF/PGG Wrightson specifications',
          notes: 'Less tendency to brown under drought stress, retains green colour longer'
        },
        
        recovery: {
          renovationRecovery: 'rapid',
          confidence: 'medium',
          source: 'PGG Wrightson/Notman Pasture Seeds specifications',
          notes: 'Natural vigour to recover quickly from renovation'
        },
        
        mowingHeight: {
          minimum: 3, // mm - suitable for greens
          optimal: '3-5',
          confidence: 'high',
          source: 'PGG Wrightson specifications',
          notes: 'Ideal for closely mowed greens, also tees and fairways'
        },
        
        establishment: {
          sowingRate: '5-10 g/m²',
          emergenceDays: '5-10',
          fullCoverage: '8 weeks',
          confidence: 'medium',
          source: 'Notman Pasture Seeds specifications',
          notes: 'First mowing at 10mm, gradually lower to desired height'
        }
      }
    },
    
    // ═══════════════════════════════════════════════════════════════════════════
    // MANOR - DLF Seeds / Johnsons Sports Seed
    // Source: BSPB 2025 Table G1
    // ═══════════════════════════════════════════════════════════════════════════
    'Manor': {
      species: 'browntopBent',
      displayName: 'Manor',
      
      // VERIFIED: BSPB 2025 Table G1 - Mean 6.7-6.4
      qualityRating: 6.6,
      qualitySource: 'BSPB Turfgrass Seed 2025 Table G1',
      
      testedRegions: ['bspb_uk', 'au_temperate'],
      
      traits: {
        // VERIFIED: BSPB 2025 - Shoot density 6.6-6.8
        density: {
          shootDensity: 6.7,
          confidence: 'high',
          source: 'BSPB 2025 Table G1',
          notes: 'Good density producing outstanding putting greens quality'
        },
        
        // VERIFIED: BSPB 2025 - Fineness 6.4-7.0
        texture: {
          finenessOfLeaf: 6.7,
          confidence: 'high',
          source: 'BSPB 2025 Table G1',
          notes: 'Fine texture'
        },
        
        // VERIFIED: BSPB 2025 - Visual merit 6.9-7.1
        visualMerit: {
          rating: 7.0,
          confidence: 'high',
          source: 'BSPB 2025 Table G1',
          notes: 'Good visual quality'
        },
        
        // PGG Wrightson specifications
        color: {
          geneticColor: 'light-green',
          confidence: 'medium',
          source: 'PGG Wrightson Turf specifications',
          notes: 'Light green colour aids masking of Poa annua'
        },
        
        // BSPB 2025 - Wear 5.2-5.4
        wear: {
          multiplier: 0.97,
          wearRating: 5.3,
          confidence: 'high',
          source: 'BSPB 2025 Table G1',
          notes: 'Moderate wear tolerance'
        },
        
        // BSPB 2025 - Disease 5.5-5.7
        disease: {
          overallResistance: 5.6,
          confidence: 'high',
          source: 'BSPB 2025 Table G1',
          notes: 'Moderate disease resistance'
        },
        
        mowingHeight: {
          minimum: 3,
          confidence: 'medium',
          source: 'PGG Wrightson specifications',
          notes: 'Suitable for greens, tees, fairways, roughs and lawns'
        },
        
        poaCompetition: {
          maskingAbility: 'good',
          confidence: 'medium',
          source: 'PGG Wrightson specifications',
          notes: 'Light green colour helps mask Poa annua in sward'
        }
      }
    },
    
    // ═══════════════════════════════════════════════════════════════════════════
    // EGMONT - Grasslands NZ / OAS/TG
    // Source: BSPB 2025 Table G1
    // Reference: Rumball & Robinson 1982, NZ J Exp Ag 10:175-177
    // ═══════════════════════════════════════════════════════════════════════════
    'Egmont': {
      species: 'browntopBent',
      displayName: 'Egmont',
      
      // VERIFIED: BSPB 2025 Table G1 - Mean 6.6-6.1
      qualityRating: 6.4,
      qualitySource: 'BSPB Turfgrass Seed 2025 Table G1',
      
      testedRegions: ['bspb_uk', 'nzsti_nz', 'au_temperate'],
      
      traits: {
        // VERIFIED: BSPB 2025 - Shoot density 6.4-6.6
        density: {
          shootDensity: 6.5,
          confidence: 'high',
          source: 'BSPB 2025 Table G1',
          notes: 'Standard browntop density'
        },
        
        // VERIFIED: BSPB 2025 - Fineness 6.3-6.8
        texture: {
          finenessOfLeaf: 6.6,
          confidence: 'high',
          source: 'BSPB 2025 Table G1',
          notes: 'Standard browntop fineness'
        },
        
        // VERIFIED: BSPB 2025 - Visual merit 6.7-7.0
        visualMerit: {
          rating: 6.9,
          confidence: 'high',
          source: 'BSPB 2025 Table G1',
          notes: 'Good visual quality'
        },
        
        // BSPB 2025 - Wear 6.5-6.6 (best of browntops)
        wear: {
          multiplier: 0.93,
          wearRating: 6.6,
          confidence: 'high',
          source: 'BSPB 2025 Table G1',
          notes: 'Best wear tolerance of standard browntops'
        },
        
        // BSPB 2025 - Disease 6.1-6.3
        disease: {
          overallResistance: 6.2,
          confidence: 'high',
          source: 'BSPB 2025 Table G1',
          notes: 'Good disease resistance for browntop'
        },
        
        // BSPB 2025 - Slow regrowth 6.5-6.9 (best)
        regrowth: {
          slowRegrowth: 6.7,
          confidence: 'high',
          source: 'BSPB 2025 Table G1',
          notes: 'Slowest regrowth - reduces mowing frequency'
        },
        
        mowingHeight: {
          minimum: 5,
          confidence: 'medium',
          source: 'PGG Wrightson specifications',
          notes: 'Standard browntop - used in Premium Tees blends'
        }
      }
    },
    
    // ═══════════════════════════════════════════════════════════════════════════
    // SEFTON - DLF Seeds
    // Source: BSPB 2025 Table G1
    // ═══════════════════════════════════════════════════════════════════════════
    'Sefton': {
      species: 'browntopBent',
      displayName: 'Sefton',
      
      // VERIFIED: BSPB 2025 Table G1 - Mean 6.4-6.7
      qualityRating: 6.5,
      qualitySource: 'BSPB Turfgrass Seed 2025 Table G1',
      
      testedRegions: ['bspb_uk', 'au_temperate'],
      
      traits: {
        // VERIFIED: BSPB 2025 - Shoot density 6.1-6.5
        density: {
          shootDensity: 6.3,
          confidence: 'high',
          source: 'BSPB 2025 Table G1',
          notes: 'Standard browntop density'
        },
        
        // VERIFIED: BSPB 2025 - Fineness 6.3-6.9
        texture: {
          finenessOfLeaf: 6.6,
          confidence: 'high',
          source: 'BSPB 2025 Table G1',
          notes: 'Standard browntop fineness'
        },
        
        // VERIFIED: BSPB 2025 - Visual merit 6.7-6.9
        visualMerit: {
          rating: 6.8,
          confidence: 'high',
          source: 'BSPB 2025 Table G1',
          notes: 'Good visual quality'
        },
        
        // BSPB 2025 - Wear 5.1-5.3
        wear: {
          multiplier: 0.98,
          wearRating: 5.2,
          confidence: 'high',
          source: 'BSPB 2025 Table G1',
          notes: 'Lower wear tolerance'
        },
        
        // BSPB 2025 - Disease 5.1-5.2
        disease: {
          overallResistance: 5.2,
          confidence: 'high',
          source: 'BSPB 2025 Table G1',
          notes: 'Moderate disease resistance'
        },
        
        mowingHeight: {
          minimum: 5,
          confidence: 'medium',
          source: 'PGG Wrightson specifications',
          notes: 'Standard browntop'
        }
      }
    },
    
    // ═══════════════════════════════════════════════════════════════════════════
    // BARKING - Barenbrug (European bred browntop)
    // Source: Barenbrug/Avoncrop specifications, BSPB data
    // ═══════════════════════════════════════════════════════════════════════════
    'Barking': {
      species: 'browntopBent',
      displayName: 'Barking',
      
      qualityRating: 6.8,
      qualitySource: 'Barenbrug specifications - European-bred browntop for overseeding',
      
      testedRegions: ['bspb_uk', 'nzsti_nz', 'au_temperate'],
      
      traits: {
        density: {
          shootDensity: 7.0,
          confidence: 'medium',
          source: 'Barenbrug/Avoncrop specifications',
          notes: 'Superb shoot density for species exchange programmes'
        },
        
        texture: {
          finenessOfLeaf: 6.8,
          confidence: 'medium',
          source: 'Barenbrug specifications',
          notes: 'Fine-leaved browntop suitable for greens'
        },
        
        disease: {
          microdochium: {
            riskMultiplier: 0.80,
            confidence: 'medium',
            source: 'Barenbrug/Avoncrop specifications',
            notes: 'Exceptional tolerance to Microdochium Patch (Fusarium)'
          },
          overallResistance: 6.2,
          confidence: 'medium',
          source: 'Barenbrug specifications',
          notes: 'Improved disease profile vs standard browntops'
        },
        
        color: {
          geneticColor: 'medium-green',
          winterColor: 'good',
          confidence: 'medium',
          source: 'Barenbrug specifications',
          notes: 'Superior winter colour retention'
        },
        
        shade: {
          thresholdModifier: 0.90,
          confidence: 'medium',
          source: 'USGA research on colonial bentgrass',
          notes: 'Browntop superior to creeping bent under low light - 7-8 weeks additional optimal light'
        },
        
        poaCompetition: {
          competitiveness: 'high',
          confidence: 'medium',
          source: 'Barenbrug specifications',
          notes: 'Designed for outcompeting Poa annua in species exchange'
        },
        
        mowingHeight: {
          minimum: 3,
          optimal: '3-6',
          confidence: 'medium',
          source: 'Barenbrug specifications',
          notes: 'Suitable for golf greens and bowling greens'
        }
      }
    }
  },
  
  // ═══════════════════════════════════════════════════════════════════════════
  // TALL FESCUE (Festuca arundinacea)
  // Primary source: NTEP 2018-2023 National Tall Fescue Test
  // Traffic: Table 12 (North Brunswick NJ), Table 13 (Knoxville TN)
  // Shade: Table 14 (Carbondale IL)
  // Brown Patch: Table 15 (Wichita KS), Table 16 (Lexington KY)
  // ═══════════════════════════════════════════════════════════════════════════
  
  tallFescue: {
    
    'Titanium G-LS': {
      species: 'tallFescue',
      displayName: 'Titanium G-LS',
      
      // Top performer NTEP 2018-2023
      qualityRating: 7.0,
      qualitySource: 'NTEP 2021 data - Top of LPI Group 1, in top 25% at 68% of locations',

      testedRegions: ['au_temperate'],
      
      traits: {
        wear: {
          multiplier: 0.92,
          confidence: 'medium',
          source: 'NTEP Table 12-13 traffic trials',
          notes: 'Good traffic tolerance with Lateral Spread technology'
        },
        
        shade: {
          thresholdModifier: 0.95,
          confidence: 'medium',
          source: 'NTEP Table 14 Carbondale IL shade trial',
          notes: 'Good shade performance'
        },
        
        disease: {
          brownPatch: {
            riskMultiplier: 0.85,
            confidence: 'high',
            source: 'NTEP Tables 15-16 brown patch trials Wichita KS, Lexington KY',
            notes: 'Good brown patch resistance'
          },
          grayLeafSpot: {
            riskMultiplier: 0.80,
            confidence: 'medium',
            source: 'G-LS designation - bred for gray leaf spot resistance',
            notes: 'First NTEP-proven GLS resistance in tall fescue'
          }
        },
        
        density: {
          springAutumn: 1.10, // 10% better density
          confidence: 'high',
          source: 'NTEP 2020-2023 density ratings',
          notes: 'Best in class spring & autumn density'
        }
      }
    },
    
    'RTF': {
      species: 'tallFescue',
      displayName: 'RTF (Rhizomatous Tall Fescue)',
      
      qualityRating: 6.0,
      qualitySource: 'NTEP trials',

      testedRegions: ['au_temperate'],
      _warning: 'Lateral spread claims not fully supported by peer-reviewed research',
      
      traits: {
        wear: {
          multiplier: 0.92,
          confidence: 'medium',
          source: 'NTEP traffic trials',
          notes: 'Good wear tolerance'
        },
        
        recovery: {
          rateMultiplier: 1.00,
          confidence: 'low',
          source: 'K-State 2009 research: void recovery 21 months - KBG 1.0cm remaining, all TF >18cm remaining',
          notes: 'Rhizomatous habit provides some lateral spread but limited peer-reviewed data on recovery rates'
        },
        
        drought: {
          toleranceMultiplier: 0.85,
          confidence: 'medium',
          source: 'NMSU trial - deep rooting (up to 6 feet)',
          notes: 'Good drought tolerance from deep roots'
        },
        
        disease: {
          brownPatch: {
            riskMultiplier: 0.90,
            confidence: 'medium',
            source: 'NTEP disease trials',
            notes: 'Good brown patch tolerance'
          },
          grayLeafSpot: {
            riskMultiplier: 0.95,
            confidence: 'medium',
            source: 'NTEP disease trials',
            notes: 'Above average GLS tolerance'
          }
        }
      }
    },
    
    'Spyder 2LS': {
      species: 'tallFescue',
      displayName: 'Spyder 2LS',
      
      testedRegions: ['au_temperate', 'nzsti_nz'],
      
      qualityRating: 6.5,
      qualitySource: 'NTEP 2018-2023 data',
      
      traits: {
        wear: {
          multiplier: 0.88,
          confidence: 'high',
          source: 'NTEP traffic trials - Lateral Spread technology',
          notes: 'Excellent wear tolerance with self-repair capability'
        },
        
        recovery: {
          rateMultiplier: 0.90,
          confidence: 'medium',
          source: 'NTEP - Lateral Spread (LS) designation indicates improved recovery',
          notes: 'LS varieties show improved divot recovery'
        },
        
        shade: {
          thresholdModifier: 0.92,
          confidence: 'medium',
          source: 'NTEP shade trials',
          notes: 'Good shade tolerance for tall fescue'
        },
        
        disease: {
          brownPatch: {
            riskMultiplier: 0.85,
            confidence: 'high',
            source: 'NTEP Tables 15-16 brown patch trials',
            notes: 'Good brown patch resistance'
          },
          grayLeafSpot: {
            riskMultiplier: 0.90,
            confidence: 'medium',
            source: 'NTEP disease data',
            notes: 'Good gray leaf spot tolerance'
          }
        },
        
        density: {
          rating: 1.08,
          confidence: 'medium',
          source: 'NTEP density ratings',
          notes: 'Good density and texture'
        }
      }
    },
    
    // ═══════════════════════════════════════════════════════════════════════════
    // REBEL IV - PGG Wrightson Turf / Pennington
    // Source: NTEP 2006 National Tall Fescue Test (2007-2011)
    // Also marketed as "Rebel 4" in Australia/NZ
    // ═══════════════════════════════════════════════════════════════════════════
    'Rebel IV': {
      species: 'tallFescue',
      displayName: 'Rebel IV',
      
      // VERIFIED: NTEP 2006 data - SE Region quality 6.2, Raleigh NC 6.3
      qualityRating: 6.2,
      qualitySource: 'NTEP 2006 Trial (2007-2011), SE Region (GA, MS, TX) mean + Raleigh NC',
      
      testedRegions: ['ntep_southeast', 'ntep_transition', 'au_temperate', 'nzsti_nz'],
      
      traits: {
        // VERIFIED: Raleigh NC 2009 data
        color: {
          geneticColor: 7.0,
          confidence: 'high',
          source: 'NTEP 2006 Raleigh NC 2009 data (tf06nc109t.txt)',
          notes: 'Dark green color'
        },
        
        // VERIFIED: Raleigh NC 2009 data
        texture: {
          leafTexture: 6.7,
          confidence: 'high',
          source: 'NTEP 2006 Raleigh NC 2009 data',
          notes: 'Medium-fine texture for tall fescue'
        },
        
        // VERIFIED: Raleigh NC 2009 data
        greenup: {
          springGreenup: 7.0,
          confidence: 'high',
          source: 'NTEP 2006 Raleigh NC 2009 data',
          notes: 'Early spring green-up'
        },
        
        winterColor: {
          rating: 7.0,
          confidence: 'high',
          source: 'NTEP 2006 Raleigh NC 2009 data',
          notes: 'Good color retention late into fall'
        },
        
        // VERIFIED: Raleigh NC 2009 density data
        density: {
          summer: 6.7,
          fall: 7.0,
          confidence: 'high',
          source: 'NTEP 2006 Raleigh NC 2009 data',
          notes: 'Maintains good density in heat'
        },
        
        // VERIFIED: Brown patch 14.7% (2007-2011 mean) - Mustang 4 tech sheet comparison
        disease: {
          brownPatch: {
            riskMultiplier: 0.85, // 14.7% vs avg - in top statistical group
            percentInfection: 14.7,
            confidence: 'high',
            source: 'NTEP 2006 Brown Patch 2007-2011 mean data',
            notes: 'Moderate resistance - in top statistical group for brown patch'
          }
        },
        
        // Manufacturer specifications - Notman Pasture Seeds / PGG Wrightson
        drought: {
          toleranceMultiplier: 0.85,
          confidence: 'medium',
          source: 'PGG Wrightson / Notman Pasture Seeds specifications',
          notes: 'Requires less irrigation than bluegrass, ryegrass, fine fescues'
        },
        
        shade: {
          thresholdModifier: 0.90,
          confidence: 'medium',
          source: 'PGG Wrightson / Notman Pasture Seeds specifications',
          notes: 'Shade tolerant variety'
        },
        
        wear: {
          multiplier: 0.88,
          confidence: 'medium',
          source: 'PGG Wrightson / Notman Pasture Seeds specifications',
          notes: 'Outstanding wear tolerance - resists hard use on parks and home lawns'
        },
        
        // Recommended uses
        applications: {
          primary: ['home_lawns', 'parks', 'sod_production', 'sports_fields', 'golf_roughs'],
          fertilityPreference: 'moderate_to_high',
          confidence: 'medium',
          source: 'Notman Pasture Seeds Australia product specifications',
          notes: 'Performs at low-moderate fertility, best at high fertility'
        }
      }
    },
    
    // ═══════════════════════════════════════════════════════════════════════════
    // FIRECRACKER GLS - Pure Seed (PPG-TF 315)
    // Source: NTEP 2018-2023 National Tall Fescue Test
    // First NTEP-proven Gray Leaf Spot resistance in tall fescue + Lateral Spread
    // ═══════════════════════════════════════════════════════════════════════════
    'Firecracker GLS': {
      species: 'tallFescue',
      displayName: 'Firecracker GLS',
      
      testedRegions: ['au_temperate', 'nzsti_nz'],
      
      qualityRating: 6.7,
      qualitySource: 'NTEP 2018-2023 (PPG-TF 315)',
      
      traits: {
        disease: {
          grayLeafSpot: {
            riskMultiplier: 0.70,
            confidence: 'high',
            source: 'NTEP 2018-2023 - First NTEP-proven GLS resistance in tall fescue (8.5/9)',
            notes: 'Breakthrough: GLS resistance in tall fescue - GLS designation'
          },
          brownPatch: {
            riskMultiplier: 0.85,
            confidence: 'high',
            source: 'NTEP brown patch trials',
            notes: 'Good brown patch resistance'
          }
        },
        
        recovery: {
          rateMultiplier: 0.85,
          confidence: 'high',
          source: 'NTEP - Lateral Spread™ technology',
          notes: 'Enhanced recovery from Lateral Spread trait'
        },
        
        wear: {
          multiplier: 0.88,
          confidence: 'high',
          source: 'NTEP traffic trials',
          notes: 'Good wear tolerance'
        },
        
        density: {
          rating: 1.10,
          confidence: 'high',
          source: 'NTEP density ratings',
          notes: 'Good density from Lateral Spread'
        },
        
        color: {
          geneticColor: 7.5,
          confidence: 'medium',
          source: 'NTEP color ratings',
          notes: 'Dark green color'
        }
      },
      
      notes: 'Breakthrough variety - first tall fescue with NTEP-proven Gray Leaf Spot resistance plus Lateral Spread technology'
    }
  },
  
  // ═══════════════════════════════════════════════════════════════════════════
  // KIKUYU (Pennisetum clandestinum)
  // NOTE: No NTEP data - Australian commercial/industry sources only
  // CONFIDENCE: LOW - Use conservative defaults
  // ═══════════════════════════════════════════════════════════════════════════
  
  kikuyu: {
    _warning: 'No NTEP trial data available for kikuyu varieties. Data based on Australian commercial sources only. Use conservative defaults.',
    
    'Kenda': {
      species: 'kikuyu',
      displayName: 'Kenda',
      
      qualityRating: null, // No comparable rating system
      qualitySource: 'No NTEP data - Australian PBR variety',

      testedRegions: ['au_temperate', 'au_subtropical'],
      
      traits: {
        wear: {
          multiplier: 0.85, // Claimed 4x rhizomes
          confidence: 'low',
          source: 'Ozbreed marketing - 4x rhizome density claimed',
          notes: 'NO TRIAL DATA - Commercial claim only'
        },
        
        shade: {
          thresholdModifier: 1.10, // Poor shade
          confidence: 'low',
          source: 'TurfFinder.com - Low to moderate shade tolerance',
          notes: 'Kikuyu generally poor in shade'
        },
        
        salinity: {
          multiplier: 1.20, // Poor salt tolerance
          confidence: 'low',
          source: 'TurfFinder.com - Poor salinity tolerance',
          notes: 'All kikuyu poor with salt'
        }
      }
    },
    
    'Village Green': {
      species: 'kikuyu',
      displayName: 'Village Green',
      
      qualityRating: null,
      qualitySource: 'No NTEP data',

      testedRegions: ['au_temperate', 'au_subtropical'],
      
      traits: {
        wear: {
          multiplier: 0.90,
          confidence: 'low',
          source: 'TurfFinder.com - Moderate wear tolerance',
          notes: 'NO TRIAL DATA'
        },
        
        shade: {
          thresholdModifier: 1.05,
          confidence: 'low', 
          source: 'TurfFinder.com - Moderate shade tolerance',
          notes: 'Handles dappled shade'
        },
        
        cold: {
          winterActivity: 1.10, // More winter active
          confidence: 'low',
          source: 'Commercial claims - winter active',
          notes: 'Maintains color longer'
        }
      }
    },
    
    'Whittet': {
      species: 'kikuyu',
      displayName: 'Whittet',
      
      qualityRating: null,
      qualitySource: 'No NTEP data - Seeded variety',

      testedRegions: ['au_temperate', 'au_subtropical'],
      
      traits: {
        wear: {
          multiplier: 1.00, // Baseline
          confidence: 'low',
          source: 'DAF notes',
          notes: 'Standard kikuyu wear'
        },
        
        shade: {
          thresholdModifier: 0.95, // Slightly better shade
          confidence: 'low',
          source: 'InsightWeeds - Better shade tolerance than common',
          notes: 'Developed Grafton NSW 1960'
        },
        
        cold: {
          winterActivity: 1.05,
          confidence: 'low',
          source: 'General assessment',
          notes: 'Good cold tolerance for kikuyu'
        }
      }
    }
  },
  
  // ═══════════════════════════════════════════════════════════════════════════
  // BUFFALO GRASS / ST AUGUSTINEGRASS (Stenotaphrum secundatum)
  // Primary source: HAL Project TU04013 (2004-2009)
  // Duff, Loch & Colmer - Queensland Primary Industries & Fisheries
  // University of Western Australia (Colmer) - Drought/Alkaline soil trials
  // 
  // USAGE: Residential lawns only - not suitable for sports turf or golf
  //
  // TRIAL LOCATION → AUSTRALIAN CLIMATE ZONE MAPPING:
  // ─────────────────────────────────────────────────────────────────────────────
  // | Trial Site                | Climate Zone   | Traits Tested              |
  // |───────────────────────────|────────────────|────────────────────────────|
  // | Redlands Research Stn QLD | subtropical    | Wear, Recovery, Quality    |
  // | Springfield Lakes QLD     | subtropical    | Quality                    |
  // | Richmond TAFE NSW         | temperate      | Quality                    |
  // | Shenton Park WA           | mediterranean  | Drought tolerance          |
  // | Wembley Golf Course WA    | mediterranean  | Winter colour, Alkaline    |
  // ─────────────────────────────────────────────────────────────────────────────
  // 
  // Note: Use subtropical trait data for Brisbane/Gold Coast applications
  //       Use mediterranean trait data for Perth/Adelaide applications
  //       Temperate (Sydney/Melbourne) can use mean of subtropical + mediterranean
  // ═══════════════════════════════════════════════════════════════════════════
  
  // Climate zone lookup for trait data selection
  _buffaloClimateMapping: {
    subtropical: {
      description: 'Brisbane, Gold Coast, Northern NSW',
      trialSites: ['Redlands Research Station QLD', 'Springfield Lakes QLD'],
      traitsFrom: ['wear', 'recovery', 'quality'],
      characteristics: 'High humidity, mild winters, shade important'
    },
    temperate: {
      description: 'Sydney, Newcastle, Melbourne coastal',
      trialSites: ['Richmond TAFE NSW'],
      traitsFrom: ['quality'],
      characteristics: 'Moderate - interpolate from subtropical + mediterranean'
    },
    mediterranean: {
      description: 'Perth, Adelaide',
      trialSites: ['Shenton Park WA', 'Wembley GC WA'],
      traitsFrom: ['drought', 'winterColour', 'alkalineTolerance'],
      characteristics: 'Hot dry summers, cool wet winters, alkaline soils common'
    }
  },
  
  buffalo: {
    _contextRestriction: 'lawns', // Only show in Lawns/Residential profile
    _sourceInfo: {
      primarySource: 'HAL Project TU04013 - Adaptation and management of Australian buffalo grass cultivars for shade and water conservation',
      authors: 'Alan Duff, Dr Don Loch, Dr Tim Colmer',
      institution: 'Queensland Primary Industries and Fisheries, Redlands Research Station; University of Western Australia',
      completionDate: '14 October 2009',
      trialPeriod: 'July 2004 - May 2009',
      trialSites: [
        'Redlands Research Station, QLD (27°32\'S, 153°15\'E)',
        'Shenton Park, Western Australia (drought trials)',
        'Wembley Golf Course, WA (alkaline soil/winter colour)',
        'Richmond TAFE, NSW',
        'Springfield Lakes, QLD'
      ],
      methodology: {
        wear: 'Modified Brinkman Traffic Simulator, 6 passes/plot, 50% shade structure, 35mm mowing height',
        drought: '98 days at 80%/50%/33% ET replacement + 28 day recovery, Shenton Park WA',
        winterColour: 'Chromameter Hue angle measurement, pH 7.5-7.9 soil, Wembley GC WA'
      },
      confidence: 'HIGH - Multi-year government research trials with peer review'
    },
    
    'Matilda': {
      species: 'buffalo',
      displayName: 'Matilda',
      scientificName: 'Stenotaphrum secundatum',
      
      // Quality - averaged across Richmond, Springfield Lakes, Redlands trials
      qualityRating: 6.95,
      qualitySource: 'HAL TU04013 Tables 8.3, 8.24, 8.30 - Mean across 3 sites, 2007-2009',
      
      // Morphology from Table 2.2 (code MAT)
      morphology: {
        stolonInternodeLength: 55.2, // mm
        stolonInternodeDiameter: 2.77, // mm
        leafSheathLength: 17.0, // mm
        leafBladeLength: 6.65, // mm
        leafBladeWidth: 2.97, // mm
        leafBladeLWRatio: 1.83,
        branchesAtNode2: 12.25,
        source: 'HAL TU04013 Table 2.2'
      },
      
      // Climate zones where this variety has been tested
      testedClimateZones: ['subtropical', 'mediterranean', 'temperate'],
      
      traits: {
        // WEAR & RECOVERY MODULE - Trial 2 August 2008
        // Climate zone: SUBTROPICAL (Redlands QLD)
        wear: {
          multiplier: 0.70, // Exceptional - 0.0% bare ground throughout trial
          recoveryRate: 1.30, // 30% faster recovery
          confidence: 'high',
          climateZone: 'subtropical',
          source: 'HAL TU04013 Table 4.1 - Redlands QLD - 0.0% bare ground at all assessment dates (Weeks 2-14)',
          notes: 'Best performing buffalo for wear tolerance. "Almost completely unaffected by wear treatments"',
          trialData: {
            location: 'Redlands Research Station, QLD',
            maxBareGround: 0.0, // %
            week9BareGround: 0.0, // Peak stress period
            week14BareGround: 0.0, // Recovery
            ranking: 1 // of 14 buffalo cultivars
          }
        },
        
        // DROUGHT TOLERANCE - Shenton Park WA 2007/08
        // Climate zone: MEDITERRANEAN (Perth)
        waterUse: {
          multiplier: 0.78, // Best drought tolerance
          confidence: 'high',
          climateZone: 'mediterranean',
          source: 'HAL TU04013 Table 6.2 - Shenton Park WA - 72% growth at 33% ET replacement (highest of all soft-leaf types)',
          notes: 'Maintained steady growth regardless of water applied. 104% at 50% replacement, 102% recovery.',
          trialData: {
            location: 'Shenton Park, WA',
            clippings80pct: 195, // g/m² at full irrigation (CONTROL)
            pct50replacement: 104, // % of control
            pct33replacement: 72, // % of control (BEST)
            recoveryAfter33pct: 102 // % of control after 28 days recovery
          }
        },
        
        // WINTER COLOUR RETENTION - Wembley GC WA 2007
        // Climate zone: MEDITERRANEAN (Perth)
        cold: {
          winterColourRetention: 0.92, // Only 7.7° hue decline vs 13.3° mean
          dormancyThresholdModifier: 0.95,
          confidence: 'high',
          climateZone: 'mediterranean',
          source: 'HAL TU04013 Table 6.8 - Wembley GC WA - Hue angle change -7.7° (mean -13.3°)',
          notes: 'Good winter colour retention on alkaline soil pH 7.5-7.9',
          trialData: {
            location: 'Wembley Golf Course, WA',
            summerHue: 117,
            winterHue: 109,
            hueDecline: -7.7,
            meanDecline: -13.3
          }
        },
        
        // SHADE TOLERANCE
        // Climate zone: SUBTROPICAL (Redlands QLD under 50% shade)
        shade: {
          thresholdModifier: 0.85, // Buffalo generally good in shade
          confidence: 'medium',
          climateZone: 'subtropical',
          source: 'HAL TU04013 - Redlands QLD - Trial conducted under 50% shade structure',
          notes: 'All buffalo cultivars in trial maintained acceptable quality at 50% shade'
        },
        
        // DISEASE TOLERANCE
        disease: {
          gaeumannomycesWongoonoo: {
            riskMultiplier: 0.65, // Best tolerance observed
            confidence: 'medium',
            source: 'HAL TU04013 Plate 8.14 - Least affected of all cultivars in visual assessment',
            notes: 'Ranked #1 for G. wongoonoo tolerance - image (j) shows healthy pots'
          }
        },
        
        // SALINITY - derived from alkaline soil performance
        // Climate zone: MEDITERRANEAN (Perth)
        salinity: {
          multiplier: 0.95,
          confidence: 'medium',
          climateZone: 'mediterranean',
          source: 'HAL TU04013 - Wembley GC WA - Good performance on pH 7.5-7.9 soil',
          notes: 'Maintained quality on challenging alkaline sandy soil'
        }
      }
    },
    
    'Sir Walter': {
      species: 'buffalo',
      displayName: 'Sir Walter',
      scientificName: 'Stenotaphrum secundatum',
      
      qualityRating: 6.73,
      qualitySource: 'HAL TU04013 Tables 8.3, 8.24, 8.30 - Mean across sites',
      
      morphology: {
        stolonInternodeLength: 47.1, // mm (SWL code)
        stolonInternodeDiameter: 3.10, // mm
        leafSheathLength: 17.0, // mm
        leafBladeLength: 5.76, // mm
        leafBladeWidth: 2.52, // mm
        leafBladeLWRatio: 0.95,
        branchesAtNode2: 9.78,
        source: 'HAL TU04013 Table 2.2 (SWL accession)'
      },
      
      testedClimateZones: ['subtropical', 'mediterranean'],
      
      traits: {
        // Climate zone: SUBTROPICAL (Redlands QLD)
        wear: {
          multiplier: 0.82,
          recoveryRate: 1.15,
          confidence: 'high',
          climateZone: 'subtropical',
          source: 'HAL TU04013 Table 4.1 - Redlands QLD - Max 7.1% bare ground week 8, recovered to 0.5% by week 14',
          notes: 'Good wear tolerance with strong recovery',
          trialData: {
            location: 'Redlands Research Station, QLD',
            maxBareGround: 7.1,
            week9BareGround: 3.7,
            week14BareGround: 0.5,
            ranking: 5
          }
        },
        
        // Climate zone: MEDITERRANEAN (Shenton Park WA)
        waterUse: {
          multiplier: 0.96,
          confidence: 'high',
          climateZone: 'mediterranean',
          source: 'HAL TU04013 Table 6.2 - Shenton Park WA - 54% growth at 33% ET replacement',
          notes: 'High growth potential (203 g/m²) but moderate drought tolerance',
          trialData: {
            location: 'Shenton Park, WA',
            clippings80pct: 203,
            pct50replacement: 91,
            pct33replacement: 54,
            recoveryAfter33pct: 39 // Poor recovery after severe stress
          }
        },
        
        // Climate zone: MEDITERRANEAN (Wembley GC WA)
        cold: {
          winterColourRetention: 0.86, // 8.5° decline
          dormancyThresholdModifier: 1.00,
          confidence: 'high',
          climateZone: 'mediterranean',
          source: 'HAL TU04013 Table 6.8 - Wembley GC WA - Hue angle change -8.5°',
          trialData: {
            location: 'Wembley Golf Course, WA',
            summerHue: 114,
            winterHue: 106,
            hueDecline: -8.5
          }
        },
        
        // Climate zone: SUBTROPICAL (Redlands QLD)
        shade: {
          thresholdModifier: 0.85,
          confidence: 'medium',
          climateZone: 'subtropical',
          source: 'HAL TU04013 - Redlands QLD - 50% shade trial'
        },
        
        disease: {
          gaeumannomycesWongoonoo: {
            riskMultiplier: 0.80,
            confidence: 'medium',
            source: 'HAL TU04013 Plate 8.14 - Low disease severity (image h)',
            notes: 'Good tolerance, ranked in top third'
          }
        }
      }
    },
    
    'Palmetto': {
      species: 'buffalo',
      displayName: 'Palmetto',
      scientificName: 'Stenotaphrum secundatum',
      
      qualityRating: 5.78,
      qualitySource: 'HAL TU04013 Tables 8.3, 8.24, 8.30',
      
      morphology: {
        stolonInternodeLength: 42.3, // mm (PAL code)
        stolonInternodeDiameter: 2.87, // mm
        leafSheathLength: 18.0, // mm
        leafBladeLength: 6.46, // mm
        leafBladeWidth: 2.78, // mm
        leafBladeLWRatio: 1.28,
        branchesAtNode2: 10.08,
        source: 'HAL TU04013 Table 2.2'
      },
      
      traits: {
        wear: {
          multiplier: 0.88,
          recoveryRate: 1.10,
          confidence: 'high',
          source: 'HAL TU04013 Table 4.1 - Max 7.5% bare ground, full recovery by week 14',
          trialData: {
            maxBareGround: 7.5,
            week9BareGround: 7.5,
            week14BareGround: 0.0,
            ranking: 7
          }
        },
        
        waterUse: {
          multiplier: 1.33, // Poor drought tolerance
          confidence: 'high',
          source: 'HAL TU04013 Table 6.2 - Only 17% growth at 33% ET replacement (WORST soft-leaf)',
          notes: 'CAUTION: Very poor drought tolerance despite marketing. High water requirement.',
          trialData: {
            clippings80pct: 148,
            pct50replacement: 82,
            pct33replacement: 17, // Severe decline
            recoveryAfter33pct: 142 // Good recovery once watered
          }
        },
        
        cold: {
          winterColourRetention: 0.75, // 13.2° decline - poor
          dormancyThresholdModifier: 1.10,
          confidence: 'high',
          source: 'HAL TU04013 Table 6.8 - Hue angle change -13.2° (near mean)',
          trialData: {
            summerHue: 114,
            winterHue: 101,
            hueDecline: -13.2
          }
        },
        
        shade: {
          thresholdModifier: 0.85,
          confidence: 'medium',
          source: 'HAL TU04013'
        }
      }
    },
    
    'Sapphire': {
      species: 'buffalo',
      displayName: 'Sapphire',
      scientificName: 'Stenotaphrum secundatum',
      
      qualityRating: 5.50,
      qualitySource: 'HAL TU04013 Tables 8.3, 8.24, 8.30',
      
      morphology: {
        stolonInternodeLength: 52.9, // mm (SAP code)
        stolonInternodeDiameter: 2.87, // mm
        leafSheathLength: 17.4, // mm
        leafBladeLength: 5.81, // mm
        leafBladeWidth: 2.44, // mm
        leafBladeLWRatio: 1.10,
        branchesAtNode2: 10.45,
        source: 'HAL TU04013 Table 2.2'
      },
      
      traits: {
        wear: {
          multiplier: 0.95, // Below average
          recoveryRate: 1.00,
          confidence: 'high',
          source: 'HAL TU04013 Table 4.1 - Max 12.5% bare ground weeks 8-9',
          notes: 'Among poorest performing soft-leaf buffalos for wear',
          trialData: {
            maxBareGround: 12.5,
            week9BareGround: 12.5,
            week14BareGround: 1.3,
            ranking: 10
          }
        },
        
        waterUse: {
          multiplier: 1.03,
          confidence: 'high',
          source: 'HAL TU04013 Table 6.2 - 47% growth at 33% ET replacement',
          trialData: {
            clippings80pct: 149,
            pct50replacement: 82,
            pct33replacement: 47,
            recoveryAfter33pct: 49
          }
        },
        
        cold: {
          winterColourRetention: 0.95, // 7.0° decline - good
          dormancyThresholdModifier: 0.95,
          confidence: 'high',
          source: 'HAL TU04013 Table 6.8 - Hue angle change -7.0° (above average)',
          trialData: {
            summerHue: 118,
            winterHue: 111,
            hueDecline: -7.0
          }
        },
        
        shade: {
          thresholdModifier: 0.80, // Fine texture better in shade
          confidence: 'medium',
          source: 'HAL TU04013 - Fine-textured variety'
        },
        
        disease: {
          gaeumannomycesWongoonoo: {
            riskMultiplier: 1.05,
            confidence: 'medium',
            source: 'HAL TU04013 Plate 8.14 - Moderate severity (image e)',
            notes: 'Middle of pack for disease tolerance'
          }
        }
      }
    },
    
    'Shademaster': {
      species: 'buffalo',
      displayName: 'Shademaster',
      scientificName: 'Stenotaphrum secundatum',
      
      qualityRating: 6.30,
      qualitySource: 'HAL TU04013',
      
      morphology: {
        stolonInternodeLength: 43.7, // mm (SHM code)
        stolonInternodeDiameter: 3.04, // mm
        leafSheathLength: 16.2, // mm
        leafBladeLength: 6.30, // mm
        leafBladeWidth: 2.72, // mm
        leafBladeLWRatio: 1.73,
        branchesAtNode2: 12.43,
        source: 'HAL TU04013 Table 2.2'
      },
      
      traits: {
        wear: {
          multiplier: 0.80,
          recoveryRate: 1.20,
          confidence: 'high',
          source: 'HAL TU04013 Table 4.1 - Max 3.8% bare ground, excellent recovery',
          trialData: {
            maxBareGround: 3.8,
            week9BareGround: 2.5,
            week14BareGround: 0.0,
            ranking: 3
          }
        },
        
        waterUse: {
          multiplier: 1.05,
          confidence: 'high',
          source: 'HAL TU04013 Table 6.2 - 45% growth at 33% ET replacement',
          trialData: {
            clippings80pct: 145,
            pct50replacement: 104,
            pct33replacement: 45,
            recoveryAfter33pct: 63
          }
        },
        
        cold: {
          winterColourRetention: 0.72, // 14.8° decline - poor
          dormancyThresholdModifier: 1.10,
          confidence: 'high',
          source: 'HAL TU04013 Table 6.8 - Hue angle change -14.8°',
          notes: 'Below average winter colour despite shade tolerance',
          trialData: {
            summerHue: 112,
            winterHue: 98,
            hueDecline: -14.8
          }
        },
        
        shade: {
          thresholdModifier: 0.75, // Bred for shade
          confidence: 'medium',
          source: 'HAL TU04013 - Variety bred specifically for shade tolerance'
        },
        
        disease: {
          gaeumannomycesWongoonoo: {
            riskMultiplier: 1.10,
            confidence: 'medium',
            source: 'HAL TU04013 Plate 8.14 - Moderate severity (image f)'
          }
        }
      }
    },
    
    'ST-26': {
      species: 'buffalo',
      displayName: 'ST-26',
      scientificName: 'Stenotaphrum secundatum',
      
      qualityRating: 5.80,
      qualitySource: 'HAL TU04013',
      
      morphology: {
        stolonInternodeLength: 47.1, // mm
        stolonInternodeDiameter: 3.10, // mm
        leafSheathLength: 17.0, // mm
        leafBladeLength: 5.76, // mm
        leafBladeWidth: 2.52, // mm
        leafBladeLWRatio: 0.95,
        branchesAtNode2: 9.78,
        source: 'HAL TU04013 Table 2.2'
      },
      
      traits: {
        wear: {
          multiplier: 0.98,
          recoveryRate: 0.95,
          confidence: 'high',
          source: 'HAL TU04013 Table 4.1 - Max 13.7% bare ground (poor)',
          notes: 'Below average wear tolerance',
          trialData: {
            maxBareGround: 13.7,
            week9BareGround: 13.7,
            week14BareGround: 0.5,
            ranking: 11
          }
        },
        
        waterUse: {
          multiplier: 0.85, // Good drought tolerance
          confidence: 'high',
          source: 'HAL TU04013 Table 6.2 - 65% growth at 33% ET replacement',
          trialData: {
            clippings80pct: 123,
            pct50replacement: 107,
            pct33replacement: 65,
            recoveryAfter33pct: 94
          }
        },
        
        cold: {
          winterColourRetention: 0.78, // 12.6° decline
          dormancyThresholdModifier: 1.05,
          confidence: 'high',
          source: 'HAL TU04013 Table 6.8 - Hue angle change -12.6°',
          trialData: {
            summerHue: 117,
            winterHue: 105,
            hueDecline: -12.6
          }
        },
        
        shade: {
          thresholdModifier: 0.85,
          confidence: 'medium',
          source: 'HAL TU04013'
        },
        
        disease: {
          gaeumannomycesWongoonoo: {
            riskMultiplier: 1.15,
            confidence: 'medium',
            source: 'HAL TU04013 Plate 8.14 - Moderate-high severity (image c)'
          }
        }
      }
    },
    
    'ST-85': {
      species: 'buffalo',
      displayName: 'ST-85',
      scientificName: 'Stenotaphrum secundatum',
      
      qualityRating: 7.14,
      qualitySource: 'HAL TU04013 Table 8.30 - Redlands sun site',
      
      morphology: {
        stolonInternodeLength: 47.1, // mm
        stolonInternodeDiameter: 2.19, // mm
        leafSheathLength: 12.3, // mm
        leafBladeLength: 4.86, // mm
        leafBladeWidth: 2.49, // mm
        leafBladeLWRatio: 1.10,
        branchesAtNode2: 9.37,
        source: 'HAL TU04013 Table 2.2'
      },
      
      traits: {
        wear: {
          multiplier: 0.88,
          recoveryRate: 1.05,
          confidence: 'high',
          source: 'HAL TU04013 Table 4.1 - Max 7.5% bare ground',
          trialData: {
            maxBareGround: 7.5,
            week9BareGround: 7.5,
            week14BareGround: 0.0,
            ranking: 7
          }
        },
        
        cold: {
          winterColourRetention: 0.55, // 24.2° decline - worst
          dormancyThresholdModifier: 1.25,
          confidence: 'high',
          source: 'HAL TU04013 Table 6.8 - Hue angle change -24.2° (WORST)',
          notes: 'Very poor winter colour retention',
          trialData: {
            summerHue: 116,
            winterHue: 92,
            hueDecline: -24.2
          }
        },
        
        shade: {
          thresholdModifier: 0.85,
          confidence: 'medium',
          source: 'HAL TU04013'
        },
        
        disease: {
          gaeumannomycesWongoonoo: {
            riskMultiplier: 1.15,
            confidence: 'medium',
            source: 'HAL TU04013 Plate 8.14 - Moderate-high severity (image d)'
          }
        }
      }
    },
    
    'ST-91': {
      species: 'buffalo',
      displayName: 'ST-91',
      scientificName: 'Stenotaphrum secundatum',
      
      qualityRating: 6.50,
      qualitySource: 'HAL TU04013',
      
      morphology: {
        stolonInternodeLength: 31.9, // mm
        stolonInternodeDiameter: 1.91, // mm (finest texture)
        leafSheathLength: 10.3, // mm
        leafBladeLength: 4.00, // mm
        leafBladeWidth: 2.76, // mm
        leafBladeLWRatio: 0.62,
        branchesAtNode2: 9.90,
        source: 'HAL TU04013 Table 2.2'
      },
      
      traits: {
        wear: {
          multiplier: 1.00, // Baseline/poor
          recoveryRate: 0.90,
          confidence: 'high',
          source: 'HAL TU04013 Table 4.1 - Max 16.2% bare ground (among worst)',
          trialData: {
            maxBareGround: 16.2,
            week9BareGround: 12.5,
            week14BareGround: 4.8,
            ranking: 12
          }
        },
        
        waterUse: {
          multiplier: 1.21, // Poor drought tolerance
          confidence: 'high',
          source: 'HAL TU04013 Table 6.2 - 29% growth at 33% ET replacement',
          notes: 'Very low growth even at full irrigation (30 g/m²). Poor drought response.',
          trialData: {
            clippings80pct: 30, // Very low baseline
            pct50replacement: 46,
            pct33replacement: 29,
            recoveryAfter33pct: 80
          }
        },
        
        cold: {
          winterColourRetention: 0.65, // 17.6° decline
          dormancyThresholdModifier: 1.15,
          confidence: 'high',
          source: 'HAL TU04013 Table 6.8 - Hue angle change -17.6°',
          trialData: {
            summerHue: 115,
            winterHue: 97,
            hueDecline: -17.6
          }
        },
        
        shade: {
          thresholdModifier: 0.80, // Fine texture may help
          confidence: 'medium',
          source: 'HAL TU04013 - Finest textured buffalo in trial'
        },
        
        disease: {
          gaeumannomycesWongoonoo: {
            riskMultiplier: 1.25,
            confidence: 'medium',
            source: 'HAL TU04013 Plate 8.14 - High severity (image b)'
          }
        }
      }
    },
    
    'TF01': {
      species: 'buffalo',
      displayName: 'TF01',
      scientificName: 'Stenotaphrum secundatum',
      
      qualityRating: 5.78,
      qualitySource: 'HAL TU04013 Tables 8.24, 8.30',
      
      morphology: {
        stolonInternodeLength: 65.0, // mm (TF01 code)
        stolonInternodeDiameter: 2.72, // mm
        leafSheathLength: 18.2, // mm
        leafBladeLength: 6.47, // mm
        leafBladeWidth: 2.58, // mm
        leafBladeLWRatio: 1.18,
        branchesAtNode2: 10.43,
        source: 'HAL TU04013 Table 2.2'
      },
      
      traits: {
        shade: {
          thresholdModifier: 0.85,
          confidence: 'medium',
          source: 'HAL TU04013'
        },
        
        disease: {
          gaeumannomycesWongoonoo: {
            riskMultiplier: 0.75, // Second best tolerance
            confidence: 'medium',
            source: 'HAL TU04013 Plate 8.14 - Very low severity (image i)',
            notes: 'Ranked #2 for disease tolerance behind Matilda'
          }
        }
      }
    },
    
    'Common': {
      species: 'buffalo',
      displayName: 'Common (Old Style Sydney)',
      scientificName: 'Stenotaphrum secundatum',
      
      qualityRating: 4.50,
      qualitySource: 'HAL TU04013',
      
      morphology: {
        stolonInternodeLength: 50.1, // mm (SIL/SID codes - Sydney variants)
        stolonInternodeDiameter: 2.97, // mm
        leafSheathLength: 17.7, // mm
        leafBladeLength: 6.42, // mm
        leafBladeWidth: 2.48, // mm
        leafBladeLWRatio: 1.40,
        branchesAtNode2: 12.80,
        source: 'HAL TU04013 Table 2.2'
      },
      
      traits: {
        wear: {
          multiplier: 1.50, // Very poor wear tolerance
          recoveryRate: 0.60,
          confidence: 'high',
          source: 'HAL TU04013 Table 4.1 - 52.5% bare ground at week 9 (WORST)',
          notes: 'Significantly less wear tolerant than ALL soft-leaf cultivars. Very slow recovery.',
          trialData: {
            maxBareGround: 52.5,
            week9BareGround: 51.2,
            week14BareGround: 40.0, // Still damaged at trial end
            ranking: 14 // Last place
          }
        },
        
        waterUse: {
          multiplier: 0.85, // Reasonable drought tolerance
          confidence: 'high',
          source: 'HAL TU04013 Table 6.2 - 65% growth at 33% ET replacement',
          notes: 'Moderate growth (59 g/m²) but maintains production under stress',
          trialData: {
            clippings80pct: 59,
            pct50replacement: 93,
            pct33replacement: 65,
            recoveryAfter33pct: 141
          }
        },
        
        cold: {
          winterColourRetention: 0.88, // 7.9° decline - good
          dormancyThresholdModifier: 0.95,
          confidence: 'high',
          source: 'HAL TU04013 Table 6.8 - Hue angle change -7.9°',
          trialData: {
            summerHue: 116,
            winterHue: 108,
            hueDecline: -7.9
          }
        }
      }
    },
    
    'GP22': {
      species: 'buffalo',
      displayName: 'GP22',
      scientificName: 'Stenotaphrum secundatum',
      
      qualityRating: 6.00,
      qualitySource: 'HAL TU04013 - Experimental line',
      
      traits: {
        waterUse: {
          multiplier: 0.87,
          confidence: 'high',
          source: 'HAL TU04013 Table 6.2 - 63% growth at 33% ET replacement',
          notes: 'High growth potential (202 g/m²)',
          trialData: {
            clippings80pct: 202,
            pct50replacement: 99,
            pct33replacement: 63,
            recoveryAfter33pct: 70
          }
        },
        
        cold: {
          winterColourRetention: 1.00, // 5.6° decline - BEST
          dormancyThresholdModifier: 0.88,
          confidence: 'high',
          source: 'HAL TU04013 Table 6.8 - Hue angle change -5.6° (BEST of all buffalo)',
          notes: 'Best winter colour retention of all tested genotypes',
          trialData: {
            summerHue: 114,
            winterHue: 107,
            hueDecline: -5.6
          }
        }
      }
    }
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // ZOYSIAGRASS (Zoysia spp.)
  // Sources: NTEP 2019-2023 Zoysiagrass Test, Australian turf industry data
  // ═══════════════════════════════════════════════════════════════════════════
  
  zoysia: {
    
    'Empire': {
      species: 'zoysia',
      displayName: 'Empire',
      type: 'Z. japonica',
      
      // NTEP 2013, 2019 trials - Entry #15 in 2019 test
      testedRegions: ['subtropical', 'temperate_ntep', 'au_subtropical'],
      
      regionalTraits: {
        subtropical: {
          qualityRating: 6.2,
          qualitySource: 'NTEP 2013-2017 Zoysiagrass Test',
          climateEquivalent: 'Brisbane, Gold Coast, Northern NSW',
          
          traits: {
            wear: { 
              multiplier: 0.85, 
              confidence: 'high', 
              source: 'NTEP + Sod Solutions field data',
              notes: 'Excellent wear tolerance for Z. japonica'
            },
            drought: { 
              toleranceMultiplier: 0.80, 
              confidence: 'high', 
              source: 'NTEP drought tolerance trials',
              notes: 'Superior drought survival - goes dormant then recovers'
            },
            shade: {
              thresholdModifier: 0.85,
              confidence: 'medium',
              source: 'Industry data - up to 50% shade tolerance',
              notes: 'Better shade than Couch, less than Buffalo'
            },
            disease: {
              largePatch: { 
                riskMultiplier: 1.10, 
                confidence: 'high', 
                source: 'NTEP 2022-2023 Jay FL - intermediate to higher pressure'
              },
              dollarSpot: { 
                riskMultiplier: 0.90, 
                confidence: 'medium', 
                source: 'Industry observation'
              }
            },
            salt: {
              toleranceMultiplier: 0.85,
              confidence: 'high',
              source: 'Sod Solutions - excellent salt tolerance'
            }
          },
          notes: 'Brazilian origin Z. japonica. Medium blade, dark green. Chinch bug resistant.'
        },
        
        temperate_ntep: {
          qualityRating: 5.8,
          qualitySource: 'NTEP multi-location',
          climateEquivalent: 'Sydney, Melbourne fringe',
          dataAvailable: 'ntep_interpolated',
          notes: 'Performs well but slower green-up in cooler areas'
        }
      }
    },
    
    'Nara': {
      species: 'zoysia',
      displayName: 'Nara Native',
      type: 'Z. macrantha',
      
      // Australian native - Ozbreed data, not NTEP
      testedRegions: ['subtropical_au', 'temperate_au'],
      
      regionalTraits: {
        subtropical_au: {
          qualityRating: 6.5,
          qualitySource: 'Ozbreed trials, Plant Breeder Rights Australia 2008',
          climateEquivalent: 'Brisbane, Gold Coast, Sunshine Coast',
          
          traits: {
            wear: { 
              multiplier: 0.88, 
              confidence: 'high', 
              source: 'Ozbreed comparative trials',
              notes: 'Better wear than Buffalo in full sun, good in semi-shade'
            },
            drought: { 
              toleranceMultiplier: 0.75, 
              confidence: 'high', 
              source: 'Qld DPI Water Use Studies - Dr Chris Menzel',
              notes: 'Deep rhizome system - more drought tolerant than Buffalo'
            },
            shade: {
              thresholdModifier: 0.80,
              confidence: 'high',
              source: 'Industry data - 30-50% shade tolerance',
              notes: '50% shade low wear, 30% shade moderate-high wear'
            },
            disease: {
              largePatch: { 
                riskMultiplier: 0.95, 
                confidence: 'medium', 
                source: 'Industry observation - rarely gets disease'
              },
              rust: { 
                riskMultiplier: 1.10, 
                confidence: 'medium', 
                source: 'Can develop rust in wet winters'
              }
            },
            salt: {
              toleranceMultiplier: 0.70,
              confidence: 'high',
              source: 'Ozbreed - 24 dS/m tolerance, best of all Zoysia tested'
            }
          },
          notes: 'Australian native Z. macrantha. Fine texture, deep green. Low maintenance.'
        },
        
        temperate_au: {
          qualityRating: 6.0,
          qualitySource: 'Ozbreed trials',
          climateEquivalent: 'Sydney, Adelaide, Perth',
          
          traits: {
            wear: { multiplier: 0.90, confidence: 'medium', source: 'Extrapolated' },
            drought: { toleranceMultiplier: 0.75, confidence: 'high', source: 'Consistent across regions' },
            winterColor: { 
              multiplier: 0.85, 
              confidence: 'medium', 
              source: 'Richmond NSW trials - 7 weeks dormancy'
            }
          },
          notes: 'Browns off quicker than Palmetto/Sapphire Buffalo in winter'
        }
      }
    },
    
    'Leisureturf': {
      species: 'zoysia',
      displayName: 'Leisureturf',
      type: 'Z. japonica hybrid',
      
      testedRegions: ['subtropical_au'],
      
      regionalTraits: {
        subtropical_au: {
          qualityRating: 6.0,
          qualitySource: 'Australian industry data',
          climateEquivalent: 'Queensland, Northern NSW',
          
          traits: {
            wear: { multiplier: 0.90, confidence: 'medium', source: 'Industry observation' },
            drought: { toleranceMultiplier: 0.82, confidence: 'medium', source: 'Zoysia baseline' },
            shade: { thresholdModifier: 0.85, confidence: 'low', source: 'Estimated from type' }
          },
          notes: 'Medium blade japonica type. Limited trial data available.'
        }
      }
    },
    
    // ═══════════════════════════════════════════════════════════════════════════
    // SIR GRANGE (Zeon) - Bladerunner Farms / Lawn Solutions Australia
    // Zoysia matrella - NTEP 2019-2024 (zg19_24-12f) + NTEP 2013-2018 (zg13_18-15f)
    // ═══════════════════════════════════════════════════════════════════════════
    'Sir Grange': {
      species: 'zoysia',
      displayName: 'Sir Grange',
      
      qualityRating: 5.8,
      qualitySource: 'NTEP 2019-2024 Final Report (zg19_24-12f) as Zeon, LPI Group 1 2022 data, 7 locations',
      
      testedRegions: ['ntep_us', 'au_subtropical', 'au_temperate'],
      
      traits: {
        wear: {
          multiplier: 0.92,
          confidence: 'medium',
          source: 'NTEP 2019-2024 - Zeon quality 5.8 in LPI Group 1 (above Empire 5.7, below Emerald 6.3). Matrella types recover slower than japonica.',
          notes: 'Fine-textured matrella with moderate wear tolerance. Slower recovery than japonica types (Empire, Nara).'
        },
        
        shade: {
          thresholdModifier: 0.85,
          confidence: 'medium',
          source: 'NTEP 2019-2024 shade trials + industry consensus on Z. matrella shade tolerance',
          notes: 'Good shade tolerance - matrella types generally outperform japonica in shade. One of the better warm-season options for shade.'
        },
        
        waterUse: {
          multiplier: 0.80,
          confidence: 'medium',
          source: 'NTEP 2019-2024 + Z. matrella species characteristics',
          notes: 'Excellent drought tolerance - very low water requirement once established. Deep root system.'
        },
        
        density: {
          rating: 1.20,
          confidence: 'high',
          source: 'NTEP 2019-2024 - Zeon leaf texture consistently fine across all locations',
          notes: 'Very dense, fine-bladed matrella. Suitable for greens and tees at low HOC.'
        },
        
        color: {
          geneticColor: 5.6,
          confidence: 'high',
          source: 'NTEP 2019-2024 zg19_24-12f LPI Group 1 NC1 location genetic color (indirect from quality component)',
          notes: 'Medium-dark green. Emerald-type colour.'
        },
        
        cold: {
          toleranceMultiplier: 0.85,
          confidence: 'high',
          source: 'NTEP 2019-2024 LPI Group 1 - Zeon at TN1 (Knoxville) quality 6.0, competitive with Emerald (6.1)',
          notes: 'Better cold tolerance than most matrella types. Extended growing season in transition zone. Performs in temperate AU (Melbourne, Adelaide).'
        }
      }
    }
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // KENTUCKY BLUEGRASS (Poa pratensis)
  // Sources: NTEP 2011-2016, 2017-2022 Kentucky Bluegrass Tests
  // ═══════════════════════════════════════════════════════════════════════════
  
  kentuckyBluegrass: {
    
    'Midnight': {
      species: 'kentuckyBluegrass',
      displayName: 'Midnight',
      type: 'Compact Midnight',
      
      // NTEP standard entry - extensive data
      testedRegions: ['cold_ntep', 'temperate_ntep'],
      
      regionalTraits: {
        cold_ntep: {
          qualityRating: 6.8,
          qualitySource: 'NTEP 2011-2016 Kentucky Bluegrass Test',
          climateEquivalent: 'Canberra, Southern Highlands, Tasmania',
          
          traits: {
            wear: { 
              multiplier: 0.88, 
              confidence: 'high', 
              source: 'NTEP traffic stress trials - Amherst MA, North Brunswick NJ'
            },
            color: { 
              geneticColor: 8.5, 
              confidence: 'high', 
              source: 'NTEP - very dark green, signature trait'
            },
            density: { 
              multiplier: 1.10, 
              confidence: 'high', 
              source: 'NTEP - aggressive spreading, high density'
            },
            springGreenup: { 
              rating: 4.5, 
              confidence: 'high', 
              source: 'NTEP - poor/late spring green-up',
              notes: 'Wakes 2+ weeks later than other KBG cultivars'
            },
            disease: {
              summerPatch: { 
                riskMultiplier: 1.20, 
                confidence: 'high', 
                source: 'NTEP - 7th best but still susceptible'
              },
              dollarSpot: { 
                riskMultiplier: 1.15, 
                confidence: 'medium', 
                source: 'Industry observation - moderate susceptibility'
              },
              leafSpot: { 
                riskMultiplier: 1.10, 
                confidence: 'medium', 
                source: 'NTEP disease ratings'
              }
            },
            shade: {
              thresholdModifier: 1.15,
              confidence: 'high',
              source: 'NTEP - poor shade tolerance',
              notes: 'Do not plant in heavy shade'
            },
            heat: {
              toleranceMultiplier: 1.10,
              confidence: 'medium',
              source: 'Compact midnight type - moderate heat stress'
            }
          },
          notes: 'Industry standard dark KBG. Disease/shade weakness offset by density and color.'
        },
        
        temperate_ntep: {
          qualityRating: 6.2,
          qualitySource: 'NTEP transition zone locations',
          climateEquivalent: 'Sydney cool areas, Melbourne',
          dataAvailable: 'ntep_interpolated',
          notes: 'Struggles in hot summers - needs irrigation and fungicide program'
        }
      }
    },
    
    'Baron': {
      species: 'kentuckyBluegrass',
      displayName: 'Baron',
      type: 'Common/Older',
      
      // Older variety, less NTEP data
      testedRegions: ['cold_ntep'],
      
      regionalTraits: {
        cold_ntep: {
          qualityRating: 5.8,
          qualitySource: 'NTEP historical data',
          climateEquivalent: 'Cold temperate regions',
          
          traits: {
            wear: { 
              multiplier: 0.95, 
              confidence: 'medium', 
              source: 'Older variety - moderate wear tolerance'
            },
            color: { 
              geneticColor: 6.5, 
              confidence: 'medium', 
              source: 'Medium green - not as dark as Midnight types'
            },
            disease: {
              leafSpot: { riskMultiplier: 1.15, confidence: 'medium', source: 'Older genetics' },
              summerPatch: { riskMultiplier: 1.10, confidence: 'medium', source: 'Moderate susceptibility' }
            },
            establishment: {
              rate: 1.05,
              confidence: 'medium',
              source: 'Good establishment for KBG'
            }
          },
          notes: 'Reliable older variety. Outperformed by newer compact types.'
        }
      }
    },
    
    'Bluechip Plus': {
      species: 'kentuckyBluegrass',
      displayName: 'Bluechip Plus',
      type: 'Compact America',
      
      testedRegions: ['cold_ntep', 'temperate_ntep'],
      
      regionalTraits: {
        cold_ntep: {
          qualityRating: 6.5,
          qualitySource: 'NTEP 2017-2022 data',
          climateEquivalent: 'Cool temperate regions',
          
          traits: {
            wear: { 
              multiplier: 0.85, 
              confidence: 'medium', 
              source: 'Compact America type - good wear'
            },
            color: { 
              geneticColor: 7.5, 
              confidence: 'medium', 
              source: 'Dark blue-green'
            },
            disease: {
              summerPatch: { riskMultiplier: 0.95, confidence: 'medium', source: 'Improved resistance' },
              dollarSpot: { riskMultiplier: 0.90, confidence: 'medium', source: 'Good resistance' }
            },
            drought: {
              toleranceMultiplier: 0.90,
              confidence: 'medium',
              source: 'Compact America type - improved drought'
            }
          },
          notes: 'Improved Compact America type with better disease package than Midnight.'
        }
      }
    },
    
    // ═══════════════════════════════════════════════════════════════════════════
    // BOLT - DLF Seeds (H99-1653)
    // Source: NTEP 2011-2016 National Kentucky Bluegrass Test
    // #1 seedling vigor and establishment speed
    // ═══════════════════════════════════════════════════════════════════════════
    'Bolt': {
      species: 'kentuckyBluegrass',
      displayName: 'Bolt',
      
      qualityRating: 6.1,
      qualitySource: 'NTEP 2011-2016 National Kentucky Bluegrass Test (H99-1653)',
      
      testedRegions: ['temperate_ntep', 'cold_ntep'],
      
      regionalTraits: {
        temperate_ntep: {
          qualityRating: 6.1,
          qualitySource: 'NTEP 2011-2016 multi-location',
          climateEquivalent: 'Sydney, Perth, Adelaide',
          
          traits: {
            establishment: {
              seedlingVigor: 0.70,
              confidence: 'high',
              source: 'NTEP 2011 - #1 seedling vigor and establishment (9.0/9)',
              notes: 'Fastest establishing KBG in NTEP trials'
            },
            
            texture: {
              finenessOfLeaf: 0.85,
              confidence: 'high',
              source: 'NTEP texture ratings (7.5/9 fine blade)',
              notes: 'Fine-bladed texture - good greens/tees quality'
            },
            
            disease: {
              summerPatch: {
                riskMultiplier: 0.90,
                confidence: 'medium',
                source: 'NTEP disease trials',
                notes: 'Good summer patch resistance'
              },
              dollarSpot: {
                riskMultiplier: 0.95,
                confidence: 'medium',
                source: 'NTEP disease trials',
                notes: 'Average dollar spot resistance'
              }
            },
            
            wear: {
              multiplier: 0.92,
              confidence: 'medium',
              source: 'NTEP traffic trials',
              notes: 'Good wear tolerance'
            },
            
            density: {
              rating: 1.08,
              confidence: 'high',
              source: 'NTEP density ratings',
              notes: 'Good density'
            }
          },
          notes: 'Best choice when fast establishment is critical - #1 seedling vigor in NTEP'
        },
        
        cold_ntep: {
          qualityRating: 6.0,
          qualitySource: 'NTEP cold climate locations',
          climateEquivalent: 'Canberra, Southern Highlands',
          dataAvailable: 'ntep_interpolated'
        }
      }
    },
    
    // ═══════════════════════════════════════════════════════════════════════════
    // ACOUSTIC - Pure Seed (PPG-KB 1131)
    // Source: NTEP 2011-2016 - Top overall quality
    // Excellent summer patch resistance and summer density
    // ═══════════════════════════════════════════════════════════════════════════
    'Acoustic': {
      species: 'kentuckyBluegrass',
      displayName: 'Acoustic',
      
      qualityRating: 6.3,
      qualitySource: 'NTEP 2011-2016 Top overall quality (PPG-KB 1131)',
      
      testedRegions: ['temperate_ntep', 'cold_ntep'],
      
      regionalTraits: {
        temperate_ntep: {
          qualityRating: 6.3,
          qualitySource: 'NTEP 2011-2016 multi-location',
          climateEquivalent: 'Sydney, Perth, Adelaide',
          
          traits: {
            disease: {
              summerPatch: {
                riskMultiplier: 0.75,
                confidence: 'high',
                source: 'NTEP 2011-2016 summer patch trials (8.0/9)',
                notes: 'Excellent summer patch resistance - key disease for KBG'
              },
              dollarSpot: {
                riskMultiplier: 0.90,
                confidence: 'medium',
                source: 'NTEP disease trials',
                notes: 'Good dollar spot resistance'
              }
            },
            
            color: {
              geneticColor: 8.0,
              confidence: 'high',
              source: 'NTEP color ratings (8.0/9 dark green)',
              notes: 'Dark green color - excellent visual quality'
            },
            
            density: {
              summer: 1.12,
              confidence: 'high',
              source: 'NTEP 2011-2016 - Top summer density ratings',
              notes: 'Maintains excellent density through summer stress'
            },
            
            wear: {
              multiplier: 0.90,
              confidence: 'medium',
              source: 'NTEP traffic trials',
              notes: 'Good wear tolerance'
            },
            
            heat: {
              stressRecoveryMultiplier: 0.85,
              confidence: 'high',
              source: 'NTEP summer stress ratings',
              notes: 'Good summer performance for KBG'
            }
          },
          notes: 'Top overall quality in NTEP trials - excellent summer patch resistance and summer density'
        },
        
        cold_ntep: {
          qualityRating: 6.2,
          qualitySource: 'NTEP cold climate locations',
          climateEquivalent: 'Canberra, Southern Highlands',
          dataAvailable: 'ntep_interpolated'
        }
      }
    }
  }
};


// ═══════════════════════════════════════════════════════════════════════════
// MODULE INTEGRATION FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Map SpeciesController canonical keys to VARIETY_TRAITS data keys
 * v1.14.0 forward-port: VARIETY_TRAITS now uses 'couch' as canonical key (mirrors GAIP).
 * 'bermuda' is retained as a legacy alias that maps to 'couch'.
 */
const SPECIES_TO_TRAITS_KEY = {
  'couch': 'couch',             // Canonical — direct match
  'bermuda': 'couch',           // Legacy alias → canonical couch
  'kikuyu': 'kikuyu',
  'zoysia': 'zoysia',
  'buffalo': 'buffalo',
  'seashore_paspalum': 'seashore_paspalum',
  'perennialRyegrass': 'perennialRyegrass',
  'bentgrass': 'bentgrass',
  'browntopBent': 'browntopBent',
  'kentuckyBluegrass': 'kentuckyBluegrass',
  'tallFescue': 'tallFescue',
  'fineFescue': 'fineFescue',
  'poaAnnua': 'poaAnnua'
};

/**
 * Normalize species name to match VARIETY_TRAITS keys
 * v1.14.0: Integrates with SpeciesController for consistent species identity
 * 
 * Handles: "Perennial Ryegrass" -> "perennialRyegrass"
 *          "Bermuda" -> "couch" (legacy alias → canonical couch key)
 *          "Couch / Bermuda" -> "couch"
 */
function normalizeSpeciesKey(species) {
  if (!species) return '';
  
  // BEST: Use SpeciesController for canonical form, then map to VARIETY_TRAITS key
  if (window.SpeciesController && typeof window.SpeciesController.normalize === 'function') {
    const canonical = window.SpeciesController.normalize(species);
    const traitsKey = SPECIES_TO_TRAITS_KEY[canonical];
    if (traitsKey) {
      return traitsKey;
    }
    // If no mapping, try using canonical directly (might work for some species)
    return canonical;
  }
  
  // FALLBACK: Original logic for when SpeciesController not loaded
  // First, strip any parenthetical suffix like (Greens), (Fairways), (Tees)
  const baseSpecies = species.replace(/\s*\([^)]*\)/g, '').trim();
  
  // Species aliases - couch is now canonical key (bermuda retained as legacy alias)
  const aliases = {
    'couch': 'couch',
    'bermuda': 'couch',
    'couch/bermuda': 'couch',
    'couchbermuda': 'couch',
    'couch / bermuda': 'couch',
    'kikuyu': 'kikuyu',
    'buffalograss': 'buffalo',
    'buffalo': 'buffalo',
    'buffalo grass': 'buffalo',
    'st augustine': 'buffalo',
    'st augustinegrass': 'buffalo',
    'staugustine': 'buffalo',
    'stenotaphrum': 'buffalo',
    'creeping bentgrass': 'bentgrass',
    'creepingbentgrass': 'bentgrass',
    'browntop bent': 'browntopBent',
    'browntopbent': 'browntopBent',
    'browntop': 'browntopBent',
    'colonial bent': 'browntopBent',
    'colonialbent': 'browntopBent',
    'colonial bentgrass': 'browntopBent',
    'agrostis capillaris': 'browntopBent',
    'perennial ryegrass': 'perennialRyegrass',
    'perennialryegrass': 'perennialRyegrass',
    'tall fescue': 'tallFescue',
    'tallfescue': 'tallFescue',
    'kentucky bluegrass': 'kentuckyBluegrass',
    'kentuckybluegrass': 'kentuckyBluegrass',
    'fine fescue': 'fineFescue',
    'finefescue': 'fineFescue',
    'zoysia': 'zoysia'
  };
  
  const lower = baseSpecies.toLowerCase().trim();
  if (aliases[lower]) return aliases[lower];
  
  // Remove spaces and lowercase first char
  return baseSpecies.replace(/\s+/g, '').replace(/^(.)/, c => c.toLowerCase());
}

/**
 * Get wear multiplier for Wear & Recovery module
 * @param {string} species - e.g., 'bermuda', 'bentgrass', 'perennialRyegrass'
 * @param {string} variety - e.g., 'Tahoma 31', '007', 'Grand Slam GLS'
 * @returns {object} { multiplier, confidence, source }
 */
function getWearMultiplier(species, variety) {
  const speciesKey = normalizeSpeciesKey(species);
  const speciesData = VARIETY_TRAITS[speciesKey] || VARIETY_TRAITS[species];
  if (!speciesData) return { multiplier: 1.0, confidence: 'none', source: 'Unknown species' };
  
  const varietyData = speciesData[variety];
  if (!varietyData) {
    return { multiplier: 1.0, confidence: 'none', source: 'No variety data' };
  }
  
  // Check flat traits structure first (legacy format)
  if (varietyData.traits?.wear) {
    return varietyData.traits.wear;
  }
  
  // Check regionalTraits structure (current format)
  if (varietyData.regionalTraits) {
    // Priority order: temperate_ntep, temperate_au, cold_ntep, subtropical
    const regionOrder = ['temperate_ntep', 'temperate_au', 'cold_ntep', 'subtropical', 'subtropical_au'];
    for (const region of regionOrder) {
      const regionData = varietyData.regionalTraits[region];
      if (regionData?.traits?.wear) {
        return {
          ...regionData.traits.wear,
          _region: region
        };
      }
    }
  }
  
  return { multiplier: 1.0, confidence: 'none', source: 'No wear data' };
}

/**
 * Get shade threshold modifier for Shade Analysis module
 * @param {string} species
 * @param {string} variety
 * @returns {object} { thresholdModifier, confidence, source }
 */
function getShadeModifier(species, variety) {
  const speciesKey = normalizeSpeciesKey(species);
  const speciesData = VARIETY_TRAITS[speciesKey] || VARIETY_TRAITS[species];
  if (!speciesData) return { thresholdModifier: 1.0, confidence: 'none', source: 'Unknown species' };
  
  const varietyData = speciesData[variety];
  if (!varietyData || !varietyData.traits?.shade) {
    return { thresholdModifier: 1.0, confidence: 'none', source: 'No variety data' };
  }
  
  return varietyData.traits.shade;
}

/**
 * Get disease risk modifier for Disease module
 * @param {string} species
 * @param {string} variety
 * @param {string} disease - e.g., 'dollarSpot', 'grayLeafSpot', 'brownPatch', 'springDeadSpot'
 * @returns {object} { riskMultiplier, confidence, source }
 */
function getDiseaseModifier(species, variety, disease) {
  const speciesKey = normalizeSpeciesKey(species);
  const speciesData = VARIETY_TRAITS[speciesKey] || VARIETY_TRAITS[species];
  if (!speciesData) {
    return { riskMultiplier: 1.0, confidence: 'none', source: 'Unknown species' };
  }
  
  const varietyData = speciesData[variety];
  if (!varietyData) {
    return { riskMultiplier: 1.0, confidence: 'none', source: 'No disease data for this variety' };
  }
  
  // Check flat traits structure first (legacy format)
  if (varietyData.traits?.disease?.[disease]) {
    return varietyData.traits.disease[disease];
  }
  
  // Check regionalTraits structure (current format)
  if (varietyData.regionalTraits) {
    const regionOrder = ['temperate_ntep', 'temperate_au', 'cold_ntep', 'subtropical', 'subtropical_au'];
    for (const region of regionOrder) {
      const regionData = varietyData.regionalTraits[region];
      if (regionData?.traits?.disease?.[disease]) {
        return {
          ...regionData.traits.disease[disease],
          _region: region
        };
      }
    }
  }
  
  return { riskMultiplier: 1.0, confidence: 'none', source: 'No disease data for this variety' };
}

/**
 * Get water use modifier for Irrigation module
 * @param {string} species
 * @param {string} variety
 * @returns {object} { multiplier, confidence, source }
 */
function getWaterUseModifier(species, variety) {
  const speciesKey = normalizeSpeciesKey(species);
  const speciesData = VARIETY_TRAITS[speciesKey] || VARIETY_TRAITS[species];
  if (!speciesData) return { multiplier: 1.0, confidence: 'none', source: 'Unknown species' };
  
  const varietyData = speciesData[variety];
  if (!varietyData || !varietyData.traits?.waterUse) {
    return { multiplier: 1.0, confidence: 'none', source: 'No water use data' };
  }
  
  return varietyData.traits.waterUse;
}

/**
 * Get cold tolerance modifier for Climate module
 * @param {string} species
 * @param {string} variety
 * @returns {object} { dormancyThresholdModifier, winterkillRisk, confidence, source }
 */
function getColdModifier(species, variety) {
  const speciesKey = normalizeSpeciesKey(species);
  const speciesData = VARIETY_TRAITS[speciesKey] || VARIETY_TRAITS[species];
  if (!speciesData) return { dormancyThresholdModifier: 1.0, winterkillRisk: 1.0, confidence: 'none', source: 'Unknown species' };
  
  const varietyData = speciesData[variety];
  if (!varietyData || !varietyData.traits?.cold) {
    return { dormancyThresholdModifier: 1.0, winterkillRisk: 1.0, confidence: 'none', source: 'No cold tolerance data' };
  }
  
  return varietyData.traits.cold;
}

/**
 * Get all variety traits for comprehensive analysis
 * @param {string} species
 * @param {string} variety
 * @returns {object} Full variety data object or null
 */
function getVarietyTraits(species, variety) {
  const speciesKey = normalizeSpeciesKey(species);
  const speciesData = VARIETY_TRAITS[speciesKey] || VARIETY_TRAITS[species];
  if (!speciesData) return null;
  
  return speciesData[variety] || null;
}

/**
 * List all varieties for a species
 * @param {string} species
 * @returns {string[]} Array of variety names
 */
function getVarietiesForSpecies(species) {
  const speciesKey = normalizeSpeciesKey(species);
  const speciesData = VARIETY_TRAITS[speciesKey] || VARIETY_TRAITS[species];
  if (!speciesData) return [];
  
  return Object.keys(speciesData).filter(key => !key.startsWith('_'));
}


// ═══════════════════════════════════════════════════════════════════════════
// DYNAMIC VARIETY LIST FUNCTIONS
// These generate dropdown options from the traits database to stay in sync
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Get Couch/Bermuda varieties for dropdown
 * @returns {Array} Array of {value, label} objects
 */
function getAustralianCouchVarieties() {
  const varieties = [
    { value: 'generic', label: 'Generic / Unknown' }
  ];
  
  // b35fix152: VARIETY_TRAITS canonical key is 'couch' (migrated from 'bermuda').
  // Reading .bermuda returned undefined → only generic was returned.
  const couchData = VARIETY_TRAITS.couch || VARIETY_TRAITS.bermuda || {};
  Object.keys(couchData).forEach(name => {
    if (!name.startsWith('_')) {
      const v = couchData[name];
      varieties.push({
        value: name,
        label: v.displayName || name
      });
    }
  });
  
  return varieties;
}

/**
 * Get Kikuyu varieties for dropdown
 * @returns {Array} Array of {value, label} objects
 */
function getAustralianKikuyuVarieties() {
  const varieties = [
    { value: 'generic', label: 'Generic / Unknown' }
  ];
  
  Object.keys(VARIETY_TRAITS.kikuyu || {}).forEach(name => {
    if (!name.startsWith('_')) {
      const v = VARIETY_TRAITS.kikuyu[name];
      varieties.push({
        value: name,
        label: v.displayName || name
      });
    }
  });
  
  return varieties;
}

/**
 * Get Perennial Ryegrass varieties for dropdown
 * @returns {Array} Array of {value, label} objects
 */
function getAustralianRyegrassVarieties() {
  const varieties = [
    { value: 'generic', label: 'Generic / Unknown' }
  ];
  
  Object.keys(VARIETY_TRAITS.perennialRyegrass || {}).forEach(name => {
    if (!name.startsWith('_')) {
      const v = VARIETY_TRAITS.perennialRyegrass[name];
      varieties.push({
        value: name,
        label: v.displayName || name
      });
    }
  });
  
  return varieties;
}

/**
 * Get Tall Fescue varieties for dropdown
 * @returns {Array} Array of {value, label} objects
 */
function getAustralianTallFescueVarieties() {
  const varieties = [
    { value: 'generic', label: 'Generic / Unknown' }
  ];
  
  Object.keys(VARIETY_TRAITS.tallFescue || {}).forEach(name => {
    if (!name.startsWith('_')) {
      const v = VARIETY_TRAITS.tallFescue[name];
      varieties.push({
        value: name,
        label: v.displayName || name
      });
    }
  });
  
  return varieties;
}

/**
 * Get Bentgrass varieties for dropdown
 * @returns {Array} Array of {value, label} objects
 */
function getAustralianBentgrassVarieties() {
  const varieties = [
    { value: 'generic', label: 'Generic / Unknown' }
  ];
  
  Object.keys(VARIETY_TRAITS.bentgrass || {}).forEach(name => {
    if (!name.startsWith('_')) {
      const v = VARIETY_TRAITS.bentgrass[name];
      varieties.push({
        value: name,
        label: v.displayName || name
      });
    }
  });
  
  return varieties;
}

/**
 * Get Browntop Bent / Colonial Bentgrass varieties for dropdown
 * Source: BSPB Turfgrass Seed 2025 Table G1 (STRI Bingley trials)
 * Primary use: Golf greens in NZ, UK, AU (temperate climates)
 * @returns {Array} Array of {value, label} objects
 */
function getBrowntopBentVarieties() {
  const varieties = [
    { value: 'generic', label: 'Generic / Unknown' }
  ];
  
  Object.keys(VARIETY_TRAITS.browntopBent || {}).forEach(name => {
    if (!name.startsWith('_')) {
      const v = VARIETY_TRAITS.browntopBent[name];
      varieties.push({
        value: name,
        label: v.displayName || name
      });
    }
  });
  
  return varieties;
}

/**
 * Get Buffalo / St Augustine varieties for dropdown
 * Source: HAL TU04013 (2004-2009) Duff, Loch & Colmer
 * NOTE: Buffalo only available in 'lawns' context (residential)
 * @param {string} context - 'lawns', 'golf', or 'sports' (optional)
 * @returns {Array} Array of {value, label} objects - empty if context not 'lawns'
 */
function getAustralianBuffaloVarieties(context) {
  // Buffalo only available for lawns/residential context
  if (context && context !== 'lawns') {
    return [];
  }
  
  const varieties = [
    { value: 'generic', label: 'Generic / Unknown' }
  ];
  
  Object.keys(VARIETY_TRAITS.buffalo || {}).forEach(name => {
    if (!name.startsWith('_')) {
      const v = VARIETY_TRAITS.buffalo[name];
      varieties.push({
        value: name,
        label: v.displayName || name
      });
    }
  });
  
  return varieties;
}

/**
 * Check if a species is available for a given turf profile context
 * @param {string} species - Species key (e.g., 'buffalo', 'bermuda')
 * @param {string} context - 'lawns', 'golf', or 'sports'
 * @returns {boolean} True if species available in this context
 */
function isSpeciesAvailableInContext(species, context) {
  const speciesKey = normalizeSpeciesKey(species);
  const speciesData = VARIETY_TRAITS[speciesKey];
  
  if (!speciesData) return false;
  
  // Check for context restriction
  const restriction = speciesData._contextRestriction;
  
  // No restriction = available everywhere
  if (!restriction) return true;
  
  // Check if current context matches restriction
  return restriction === context;
}

/**
 * Get all species available for a given turf profile context
 * @param {string} context - 'lawns', 'golf', or 'sports'
 * @returns {Array} Array of species keys available in this context
 */
function getSpeciesForContext(context) {
  const allSpecies = Object.keys(VARIETY_TRAITS);
  
  return allSpecies.filter(species => {
    const speciesData = VARIETY_TRAITS[species];
    const restriction = speciesData._contextRestriction;
    
    // No restriction = available everywhere
    if (!restriction) return true;
    
    // Check if current context matches restriction
    return restriction === context;
  });
}


// ═══════════════════════════════════════════════════════════════════════════
// EXPORTS
// ═══════════════════════════════════════════════════════════════════════════

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    VARIETY_TRAITS,
    getWearMultiplier,
    getShadeModifier,
    getDiseaseModifier,
    getWaterUseModifier,
    getColdModifier,
    getVarietyTraits,
    getVarietiesForSpecies,
    getAustralianCouchVarieties,
    getAustralianKikuyuVarieties,
    getAustralianRyegrassVarieties,
    getAustralianTallFescueVarieties,
    getAustralianBentgrassVarieties,
    getBrowntopBentVarieties,
    getAustralianBuffaloVarieties,
    isSpeciesAvailableInContext,
    getSpeciesForContext
  };
}

// For browser/WordPress
if (typeof window !== 'undefined') {
  window.GSSH_VARIETY_TRAITS = VARIETY_TRAITS;
  window.gssh_getWearMultiplier = getWearMultiplier;
  window.gssh_getShadeModifier = getShadeModifier;
  window.gssh_getDiseaseModifier = getDiseaseModifier;
  window.gssh_getWaterUseModifier = getWaterUseModifier;
  window.gssh_getColdModifier = getColdModifier;
  window.gssh_getVarietyTraits = getVarietyTraits;
  window.gssh_getVarietiesForSpecies = getVarietiesForSpecies;
  window.gssh_getAustralianCouchVarieties = getAustralianCouchVarieties;
  window.gssh_getAustralianKikuyuVarieties = getAustralianKikuyuVarieties;
  window.gssh_getAustralianRyegrassVarieties = getAustralianRyegrassVarieties;
  window.gssh_getAustralianTallFescueVarieties = getAustralianTallFescueVarieties;
  window.gssh_getAustralianBentgrassVarieties = getAustralianBentgrassVarieties;
  window.gssh_getBrowntopBentVarieties = getBrowntopBentVarieties;
  window.gssh_getAustralianBuffaloVarieties = getAustralianBuffaloVarieties;
  window.gssh_isSpeciesAvailableInContext = isSpeciesAvailableInContext;
  window.gssh_getSpeciesForContext = getSpeciesForContext;

  // b35fix124: alias gaip_ prefixed globals so variety-traits-integration.js
  // can find them on GSSH/stadium pages. The integration module looks for
  // window.gaip_getDiseaseModifier (and gaip_ variants) — without these aliases
  // all variety trait modifiers fall back to baseline (confidence:'none') on
  // stadium pages, showing "○ Baseline (no regional data)" for every trait.
  window.gaip_getDiseaseModifier      = getDiseaseModifier;
  window.gaip_getWearMultiplier       = getWearMultiplier;
  window.gaip_getShadeModifier        = getShadeModifier;
  window.gaip_getWaterUseModifier     = getWaterUseModifier;
  window.gaip_getColdModifier         = getColdModifier;
  window.gaip_getVarietyTraits        = getVarietyTraits;
  window.gaip_getVarietiesForSpecies  = getVarietiesForSpecies;
}
