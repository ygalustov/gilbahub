/**
 * JAPAN VARIETY TRAITS DATABASE v1.1.0
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * Regional variety data for Japan (J.League stadiums, golf courses)
 * 
 * Primary species:
 * - Zoysia japonica (Noshiba/野芝) - Native, cold-tolerant, coarse texture
 * - Zoysia matrella (Korai/高麗芝) - Finer texture, less cold tolerant
 * - Zoysia pacifica (Himeshiba) - Very fine, ornamental
 * - Perennial Ryegrass - Winter overseed (14 NTEP varieties)
 * - Creeping Bentgrass - Golf greens
 * 
 * Sources:
 * - Japan Turf Grass Association (日本芝草学会)
 * - J.League stadium turf management reports
 * - Japanese Golf Course Superintendents Association
 * - NTEP trial data (same varieties available in Australia/Japan)
 * 
 * Perennial Ryegrass varieties (NTEP source):
 * - Fiesta 4 (Superior GLS resistance)
 * - Cutter 2 (Sports turf wear tolerance)
 * - Derby Xtreme, Karma, SR 4700, Slugger 3GL, Pinnacle 3
 * - RPR, Barolympic, Barorlando, Premier 3, Intense, Homerun LS
 * - Transeze (Japanese transition variety)
 * 
 * Disease focus:
 * - Large Patch (Rhizoctonia solani) - Major zoysia disease in Japan
 * - Gray Leaf Spot (PRG overseed)
 * - Dollar Spot
 * - Rust (on zoysia)
 * - Fairy Ring
 * - Spring Dead Spot (cooler regions)
 */

(function(global) {
    'use strict';
    
    
    // ═══════════════════════════════════════════════════════════════════════════
    // JAPAN VARIETY DATABASE
    // ═══════════════════════════════════════════════════════════════════════════
    
    const JAPAN_VARIETY_TRAITS = {
        
        // ───────────────────────────────────────────────────────────────────────
        // ZOYSIA JAPONICA (Noshiba/野芝)
        // Native Japanese lawn grass, cold tolerant, coarse texture
        // Common on sports fields, parks, roadsides
        // ───────────────────────────────────────────────────────────────────────
        
        zoysiaJaponica: {
            
            'Noshiba': {
                species: 'zoysiaJaponica',
                displayName: '野芝 (Noshiba)',
                region: 'Japan',
                type: 'native',
                
                traits: {
                    wear: {
                        multiplier: 0.90,
                        confidence: 'high',
                        source: 'Japan Turf Grass Association - excellent wear tolerance',
                        notes: 'Traditional sports turf variety'
                    },
                    shade: {
                        thresholdModifier: 1.10,
                        confidence: 'medium',
                        source: 'Japanese turf research',
                        notes: 'Prefers full sun, limited shade tolerance'
                    },
                    cold: {
                        dormancyThresholdModifier: 0.85,
                        winterkillRisk: 0.80,
                        confidence: 'high',
                        source: 'Native adaptation - Hokkaido to Kyushu',
                        notes: 'Best cold tolerance among zoysias'
                    },
                    disease: {
                        largePatch: {
                            riskMultiplier: 1.00,
                            confidence: 'high',
                            source: 'Japanese turf pathology baseline',
                            notes: 'Baseline susceptibility for zoysia'
                        },
                        dollarSpot: {
                            riskMultiplier: 0.85,
                            confidence: 'medium',
                            source: 'Japan Turf Grass Association',
                            notes: 'Good dollar spot resistance'
                        },
                        rust: {
                            riskMultiplier: 1.10,
                            confidence: 'medium',
                            source: 'Japanese observations',
                            notes: 'Moderate rust susceptibility'
                        }
                    }
                }
            },
            
            'Meyer': {
                species: 'zoysiaJaponica',
                displayName: 'Meyer (Z-52)',
                region: 'Japan/USA',
                type: 'improved',
                
                traits: {
                    wear: {
                        multiplier: 0.88,
                        confidence: 'high',
                        source: 'NTEP trials - excellent traffic tolerance',
                        notes: 'Industry standard improved zoysia'
                    },
                    shade: {
                        thresholdModifier: 1.05,
                        confidence: 'medium',
                        source: 'NTEP shade trials',
                        notes: 'Moderate shade tolerance'
                    },
                    cold: {
                        dormancyThresholdModifier: 0.90,
                        winterkillRisk: 0.85,
                        confidence: 'high',
                        source: 'NTEP cold tolerance data',
                        notes: 'Good cold hardiness'
                    },
                    disease: {
                        largePatch: {
                            riskMultiplier: 0.90,
                            confidence: 'high',
                            source: 'NTEP disease trials',
                            notes: 'Above average large patch resistance'
                        },
                        dollarSpot: {
                            riskMultiplier: 0.90,
                            confidence: 'medium',
                            source: 'NTEP observations',
                            notes: 'Good resistance'
                        },
                        rust: {
                            riskMultiplier: 1.00,
                            confidence: 'medium',
                            source: 'NTEP disease data',
                            notes: 'Average rust susceptibility'
                        }
                    }
                }
            },
            
            'Zenith': {
                species: 'zoysiaJaponica',
                displayName: 'Zenith',
                region: 'Japan/USA',
                type: 'seeded',
                
                traits: {
                    wear: {
                        multiplier: 0.95,
                        confidence: 'medium',
                        source: 'NTEP trials - good for seeded variety',
                        notes: 'First commercially viable seeded zoysia'
                    },
                    shade: {
                        thresholdModifier: 1.10,
                        confidence: 'medium',
                        source: 'NTEP shade trials',
                        notes: 'Less shade tolerant than vegetative types'
                    },
                    cold: {
                        dormancyThresholdModifier: 0.92,
                        winterkillRisk: 0.90,
                        confidence: 'medium',
                        source: 'NTEP cold tolerance data',
                        notes: 'Moderate cold hardiness'
                    },
                    disease: {
                        largePatch: {
                            riskMultiplier: 1.05,
                            confidence: 'medium',
                            source: 'NTEP disease observations',
                            notes: 'Slightly more susceptible than vegetative types'
                        },
                        dollarSpot: {
                            riskMultiplier: 1.00,
                            confidence: 'medium',
                            source: 'NTEP observations',
                            notes: 'Average resistance'
                        },
                        rust: {
                            riskMultiplier: 1.05,
                            confidence: 'medium',
                            source: 'NTEP disease data',
                            notes: 'Slightly elevated rust susceptibility'
                        }
                    }
                }
            },
            
            'El Toro': {
                species: 'zoysiaJaponica',
                displayName: 'El Toro',
                region: 'Japan/USA',
                type: 'improved',
                
                traits: {
                    wear: {
                        multiplier: 0.85,
                        confidence: 'high',
                        source: 'UC Riverside breeding - selected for traffic tolerance',
                        notes: 'Excellent wear recovery'
                    },
                    shade: {
                        thresholdModifier: 1.00,
                        confidence: 'medium',
                        source: 'California turf trials',
                        notes: 'Average shade tolerance'
                    },
                    cold: {
                        dormancyThresholdModifier: 0.95,
                        winterkillRisk: 0.95,
                        confidence: 'medium',
                        source: 'California selection - moderate cold tolerance',
                        notes: 'Less cold hardy than Meyer'
                    },
                    disease: {
                        largePatch: {
                            riskMultiplier: 0.95,
                            confidence: 'medium',
                            source: 'California turf disease observations',
                            notes: 'Good large patch resistance'
                        },
                        dollarSpot: {
                            riskMultiplier: 0.95,
                            confidence: 'medium',
                            source: 'UC Riverside trials',
                            notes: 'Good resistance'
                        },
                        rust: {
                            riskMultiplier: 0.95,
                            confidence: 'medium',
                            source: 'California observations',
                            notes: 'Good rust resistance'
                        }
                    }
                }
            }
        },
        
        // ───────────────────────────────────────────────────────────────────────
        // ZOYSIA MATRELLA (Korai/高麗芝)
        // Finer texture, premium quality, less cold tolerant
        // Common on golf courses, high-end sports facilities
        // ───────────────────────────────────────────────────────────────────────
        
        zoysiaMatrella: {
            
            'Korai': {
                species: 'zoysiaMatrella',
                displayName: '高麗芝 (Korai)',
                region: 'Japan',
                type: 'native',
                
                traits: {
                    wear: {
                        multiplier: 0.95,
                        confidence: 'high',
                        source: 'Japanese golf course experience',
                        notes: 'Good wear but slower recovery than japonica'
                    },
                    shade: {
                        thresholdModifier: 0.95,
                        confidence: 'medium',
                        source: 'Japanese turf research',
                        notes: 'Better shade tolerance than japonica'
                    },
                    cold: {
                        dormancyThresholdModifier: 1.00,
                        winterkillRisk: 1.10,
                        confidence: 'high',
                        source: 'Japanese experience - struggles in Tohoku/Hokkaido',
                        notes: 'Less cold tolerant than japonica'
                    },
                    disease: {
                        largePatch: {
                            riskMultiplier: 1.10,
                            confidence: 'high',
                            source: 'Japanese turf pathology - more susceptible than japonica',
                            notes: 'Higher large patch risk, especially in humid conditions'
                        },
                        dollarSpot: {
                            riskMultiplier: 0.90,
                            confidence: 'medium',
                            source: 'Japanese golf course observations',
                            notes: 'Good dollar spot resistance'
                        },
                        rust: {
                            riskMultiplier: 1.00,
                            confidence: 'medium',
                            source: 'Japanese observations',
                            notes: 'Average rust susceptibility'
                        }
                    }
                }
            },
            
            'Diamond': {
                species: 'zoysiaMatrella',
                displayName: 'Diamond',
                region: 'Japan/USA',
                type: 'improved',
                
                traits: {
                    wear: {
                        multiplier: 0.92,
                        confidence: 'high',
                        source: 'Texas A&M breeding - traffic studies',
                        notes: 'Good wear for fine-textured zoysia'
                    },
                    shade: {
                        thresholdModifier: 0.90,
                        confidence: 'high',
                        source: 'Texas A&M shade trials',
                        notes: 'Excellent shade tolerance for zoysia'
                    },
                    cold: {
                        dormancyThresholdModifier: 1.05,
                        winterkillRisk: 1.15,
                        confidence: 'medium',
                        source: 'NTEP cold tolerance data',
                        notes: 'Marginal in cold climates'
                    },
                    disease: {
                        largePatch: {
                            riskMultiplier: 1.00,
                            confidence: 'medium',
                            source: 'Texas A&M disease trials',
                            notes: 'Average large patch susceptibility'
                        },
                        dollarSpot: {
                            riskMultiplier: 0.85,
                            confidence: 'medium',
                            source: 'NTEP disease observations',
                            notes: 'Good dollar spot resistance'
                        },
                        rust: {
                            riskMultiplier: 0.95,
                            confidence: 'medium',
                            source: 'NTEP disease data',
                            notes: 'Good rust resistance'
                        }
                    }
                }
            },
            
            'Zeon': {
                species: 'zoysiaMatrella',
                displayName: 'Zeon',
                region: 'Japan/USA',
                type: 'improved',
                
                traits: {
                    wear: {
                        multiplier: 0.90,
                        confidence: 'high',
                        source: 'Bladerunner Farms development',
                        notes: 'Excellent wear tolerance for matrella type'
                    },
                    shade: {
                        thresholdModifier: 0.88,
                        confidence: 'high',
                        source: 'Industry shade trials',
                        notes: 'Best-in-class shade tolerance'
                    },
                    cold: {
                        dormancyThresholdModifier: 1.00,
                        winterkillRisk: 1.10,
                        confidence: 'medium',
                        source: 'Industry experience',
                        notes: 'Standard matrella cold tolerance'
                    },
                    disease: {
                        largePatch: {
                            riskMultiplier: 0.90,
                            confidence: 'medium',
                            source: 'Industry disease observations',
                            notes: 'Above average large patch resistance'
                        },
                        dollarSpot: {
                            riskMultiplier: 0.88,
                            confidence: 'medium',
                            source: 'Bladerunner disease data',
                            notes: 'Good dollar spot resistance'
                        },
                        rust: {
                            riskMultiplier: 0.92,
                            confidence: 'medium',
                            source: 'Industry observations',
                            notes: 'Good rust resistance'
                        }
                    }
                }
            }
        },
        
        // ───────────────────────────────────────────────────────────────────────
        // CREEPING BENTGRASS (Agrostis stolonifera)
        // Golf greens in Japan
        // ───────────────────────────────────────────────────────────────────────
        
        bentgrass: {
            
            'Penncross': {
                species: 'bentgrass',
                displayName: 'Penncross',
                region: 'Global',
                type: 'established',
                
                traits: {
                    wear: {
                        multiplier: 1.00,
                        confidence: 'high',
                        source: 'Industry standard reference',
                        notes: 'Baseline bentgrass variety'
                    },
                    shade: {
                        thresholdModifier: 1.05,
                        confidence: 'medium',
                        source: 'Global experience',
                        notes: 'Average shade tolerance'
                    },
                    disease: {
                        dollarSpot: {
                            riskMultiplier: 1.10,
                            confidence: 'high',
                            source: 'NTEP disease trials - susceptible',
                            notes: 'Above average dollar spot susceptibility'
                        },
                        brownPatch: {
                            riskMultiplier: 1.05,
                            confidence: 'medium',
                            source: 'NTEP observations',
                            notes: 'Slightly susceptible'
                        },
                        pythium: {
                            riskMultiplier: 1.00,
                            confidence: 'medium',
                            source: 'Industry experience',
                            notes: 'Average pythium susceptibility'
                        }
                    }
                }
            },
            
            'Penn A-1': {
                species: 'bentgrass',
                displayName: 'Penn A-1',
                region: 'Global',
                type: 'improved',
                
                traits: {
                    wear: {
                        multiplier: 0.95,
                        confidence: 'high',
                        source: 'Penn State breeding',
                        notes: 'Good density and wear tolerance'
                    },
                    shade: {
                        thresholdModifier: 1.00,
                        confidence: 'medium',
                        source: 'Industry experience',
                        notes: 'Average shade tolerance'
                    },
                    disease: {
                        dollarSpot: {
                            riskMultiplier: 0.85,
                            confidence: 'high',
                            source: 'NTEP disease trials',
                            notes: 'Good dollar spot resistance'
                        },
                        brownPatch: {
                            riskMultiplier: 0.95,
                            confidence: 'medium',
                            source: 'NTEP observations',
                            notes: 'Above average resistance'
                        },
                        pythium: {
                            riskMultiplier: 1.00,
                            confidence: 'medium',
                            source: 'Industry experience',
                            notes: 'Average pythium susceptibility'
                        }
                    }
                }
            },
            
            'T-1': {
                species: 'bentgrass',
                displayName: 'T-1',
                region: 'Global',
                type: 'improved',
                
                traits: {
                    wear: {
                        multiplier: 0.92,
                        confidence: 'high',
                        source: 'Jacklin Seed development',
                        notes: 'Excellent density'
                    },
                    shade: {
                        thresholdModifier: 0.95,
                        confidence: 'medium',
                        source: 'Industry trials',
                        notes: 'Good shade tolerance'
                    },
                    disease: {
                        dollarSpot: {
                            riskMultiplier: 0.80,
                            confidence: 'high',
                            source: 'NTEP disease trials',
                            notes: 'Excellent dollar spot resistance'
                        },
                        brownPatch: {
                            riskMultiplier: 1.00,
                            confidence: 'medium',
                            source: 'NTEP observations',
                            notes: 'Average brown patch susceptibility'
                        },
                        pythium: {
                            riskMultiplier: 0.95,
                            confidence: 'medium',
                            source: 'Industry experience',
                            notes: 'Good pythium resistance'
                        }
                    }
                }
            }
        },
        
        // ───────────────────────────────────────────────────────────────────────
        // PERENNIAL RYEGRASS (Winter overseed)
        // Used for winter color on zoysia sports fields
        // Source: NTEP trial data (same varieties available in Australia/Japan)
        // ───────────────────────────────────────────────────────────────────────
        
        perennialRyegrass: {
            
            'Fiesta 4': {
                species: 'perennialRyegrass',
                displayName: 'Fiesta 4',
                region: 'Japan/Global',
                type: 'overseed',
                
                qualityRating: 6.5,
                qualitySource: 'NTEP 2005, 2011 - High turf quality across management levels',
                
                traits: {
                    wear: {
                        multiplier: 0.88,
                        confidence: 'high',
                        source: 'NTEP traffic trials - Good wear tolerance',
                        notes: 'Common J.League overseed variety'
                    },
                    germination: {
                        daysToGermination: 5,
                        confidence: 'high',
                        source: 'Japanese conditions',
                        notes: 'Fast establishment'
                    },
                    transition: {
                        springTransitionEase: 0.90,
                        confidence: 'medium',
                        source: 'Japanese superintendent feedback',
                        notes: 'Good spring transition'
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
                            notes: 'Above average resistance'
                        }
                    },
                    density: {
                        rating: 1.10,
                        confidence: 'high',
                        source: 'NTEP - High summer density ratings',
                        notes: 'Very fine leaf texture, high density'
                    },
                    recovery: {
                        rateMultiplier: 0.88,
                        confidence: 'medium',
                        source: 'NTEP - Shows spreading ability via pseudo-stolons',
                        notes: 'Better lateral spread than standard PRG'
                    }
                }
            },
            
            'Cutter 2': {
                species: 'perennialRyegrass',
                displayName: 'Cutter 2',
                region: 'Japan/Global',
                type: 'overseed',
                
                qualityRating: 6.3,
                qualitySource: 'NTEP trials - Sports turf variety',
                
                traits: {
                    wear: {
                        multiplier: 0.88,
                        confidence: 'high',
                        source: 'NTEP traffic trials - Excellent wear tolerance',
                        notes: 'Bred for high traffic sports turf'
                    },
                    germination: {
                        daysToGermination: 5,
                        confidence: 'medium',
                        source: 'Standard PRG germination',
                        notes: 'Rapid establishment'
                    },
                    transition: {
                        springTransitionEase: 0.85,
                        confidence: 'medium',
                        source: 'Industry feedback',
                        notes: 'Clean spring transition'
                    },
                    disease: {
                        grayLeafSpot: {
                            riskMultiplier: 0.85,
                            confidence: 'medium',
                            source: 'NTEP disease trials',
                            notes: 'Good GLS tolerance'
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
                    }
                }
            },
            
            'Derby Xtreme': {
                species: 'perennialRyegrass',
                displayName: 'Derby Xtreme',
                region: 'Japan/Global',
                type: 'overseed',
                
                qualityRating: 6.2,
                qualitySource: 'NTEP historical + Penn State reference',
                
                traits: {
                    wear: {
                        multiplier: 0.92,
                        confidence: 'medium',
                        source: 'NTEP traffic data',
                        notes: 'Good wear tolerance'
                    },
                    disease: {
                        grayLeafSpot: {
                            riskMultiplier: 0.85,
                            confidence: 'high',
                            source: 'Penn State 2005-2009 NTEP reference',
                            notes: 'Established gray leaf spot tolerance'
                        },
                        brownPatch: {
                            riskMultiplier: 0.90,
                            confidence: 'medium',
                            source: 'NTEP disease trials',
                            notes: 'Good overall disease package'
                        }
                    }
                }
            },
            
            'Karma': {
                species: 'perennialRyegrass',
                displayName: 'Karma',
                region: 'Japan/Global',
                type: 'overseed',
                
                qualityRating: 5.1,
                qualitySource: 'NTEP 2022-2024 LPI Group 1',
                
                traits: {
                    wear: {
                        multiplier: 1.10,
                        confidence: 'high',
                        source: 'NTEP 2024 - Lower quality under traffic stress',
                        notes: 'Not in top group for traffic'
                    },
                    disease: {
                        grayLeafSpot: {
                            riskMultiplier: 0.75,
                            confidence: 'high',
                            source: 'DLF - Superior Gray Leaf Spot resistance',
                            notes: 'Key selling point is GLS resistance'
                        },
                        brownPatch: {
                            riskMultiplier: 1.00,
                            confidence: 'medium',
                            source: 'NTEP - average brown patch susceptibility',
                            notes: 'Bred primarily for GLS resistance'
                        }
                    }
                }
            },
            
            'SR 4700': {
                species: 'perennialRyegrass',
                displayName: 'SR 4700',
                region: 'Japan/Global',
                type: 'overseed',
                
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
                            source: 'NTEP 2016 - Superior quality across GLS pressure sites',
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
            
            'Slugger 3GL': {
                species: 'perennialRyegrass',
                displayName: 'Slugger 3GL',
                region: 'Japan/Global',
                type: 'overseed',
                
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
                            source: 'NTEP disease trials',
                            notes: 'Above average brown patch tolerance'
                        }
                    }
                }
            },
            
            'Pinnacle 3': {
                species: 'perennialRyegrass',
                displayName: 'Pinnacle 3',
                region: 'Japan/Global',
                type: 'overseed',
                
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
                            source: 'NTEP',
                            notes: 'Average brown patch tolerance'
                        }
                    }
                }
            },
            
            'RPR': {
                species: 'perennialRyegrass',
                displayName: 'RPR (Regenerating Perennial Ryegrass)',
                region: 'Japan/Global',
                type: 'overseed',
                
                qualityRating: 6.0,
                qualitySource: 'NTEP + Barenbrug trials',
                
                traits: {
                    wear: {
                        multiplier: 0.82,
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
                            source: 'NTEP disease ratings',
                            notes: 'Slightly above average brown patch susceptibility'
                        }
                    },
                    recovery: {
                        rateMultiplier: 0.80,
                        confidence: 'medium',
                        source: 'Barenbrug/Ohio State - stoloniferous habit',
                        notes: 'Determinate stolons enable lateral spread'
                    }
                }
            },
            
            'Barolympic': {
                species: 'perennialRyegrass',
                displayName: 'Barolympic',
                region: 'Japan/Global',
                type: 'overseed',
                
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
                region: 'Japan/Global',
                type: 'overseed',
                
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
                region: 'Japan/Global',
                type: 'overseed',
                
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
                region: 'Japan/Australia',
                type: 'overseed',
                
                qualityRating: 6.3,
                qualitySource: 'Landmark Seeds trials, Australian superintendent feedback',
                
                traits: {
                    wear: {
                        multiplier: 0.88,
                        confidence: 'medium',
                        source: 'Landmark Seeds - sports turf variety',
                        notes: 'Bred for high traffic sports turf applications'
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
                region: 'Japan/Global',
                type: 'overseed',
                
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
                        confidence: 'high',
                        source: 'NTEP density ratings - high',
                        notes: 'High density variety'
                    }
                }
            },
            
            'Transeze': {
                species: 'perennialRyegrass',
                displayName: 'Transeze',
                region: 'Japan/Global',
                type: 'overseed',
                
                qualityRating: 5.8,
                qualitySource: 'Japanese stadium trials',
                
                traits: {
                    wear: {
                        multiplier: 0.90,
                        confidence: 'medium',
                        source: 'Japanese stadium trials',
                        notes: 'Bred for easy spring transition'
                    },
                    germination: {
                        daysToGermination: 5,
                        confidence: 'medium',
                        source: 'Japanese conditions',
                        notes: 'Fast establishment'
                    },
                    transition: {
                        springTransitionEase: 0.80,
                        confidence: 'high',
                        source: 'Japanese superintendent feedback - easy removal',
                        notes: 'Designed for clean spring transition'
                    },
                    disease: {
                        grayLeafSpot: {
                            riskMultiplier: 0.95,
                            confidence: 'medium',
                            source: 'Industry observations',
                            notes: 'Good GLS resistance'
                        },
                        brownPatch: {
                            riskMultiplier: 1.05,
                            confidence: 'medium',
                            source: 'Industry observations',
                            notes: 'Slightly susceptible'
                        }
                    }
                }
            }
        }
    };
    
    // ═══════════════════════════════════════════════════════════════════════════
    // HELPER FUNCTIONS
    // ═══════════════════════════════════════════════════════════════════════════
    
    /**
     * Get variety data for Japan region
     */
    function getJapanVarietyData(species, variety) {
        // Normalize species name
        const speciesMap = {
            'zoysia': 'zoysiaJaponica',
            'zoysiaJaponica': 'zoysiaJaponica',
            'zoysia_japonica': 'zoysiaJaponica',
            'noshiba': 'zoysiaJaponica',
            'zoysiaMatrella': 'zoysiaMatrella',
            'zoysia_matrella': 'zoysiaMatrella',
            'korai': 'zoysiaMatrella',
            'bentgrass': 'bentgrass',
            'creepingBentgrass': 'bentgrass',
            'perennialRyegrass': 'perennialRyegrass',
            'perennial_ryegrass': 'perennialRyegrass',
            'ryegrass': 'perennialRyegrass'
        };
        
        const normalizedSpecies = speciesMap[species] || species;
        
        if (!JAPAN_VARIETY_TRAITS[normalizedSpecies]) {
            return null;
        }
        
        // Try exact match first
        if (JAPAN_VARIETY_TRAITS[normalizedSpecies][variety]) {
            return JAPAN_VARIETY_TRAITS[normalizedSpecies][variety];
        }
        
        // Try case-insensitive match
        const varietyLower = variety.toLowerCase();
        for (const [name, data] of Object.entries(JAPAN_VARIETY_TRAITS[normalizedSpecies])) {
            if (name.toLowerCase() === varietyLower || 
                data.displayName?.toLowerCase() === varietyLower) {
                return data;
            }
        }
        
        return null;
    }
    
    /**
     * Get wear modifier for Japan variety
     */
    function getJapanWearModifier(species, variety) {
        const varietyData = getJapanVarietyData(species, variety);
        if (!varietyData?.traits?.wear) {
            return { multiplier: 1.0, confidence: 'none' };
        }
        return varietyData.traits.wear;
    }
    
    /**
     * Get disease modifier for Japan variety
     */
    function getJapanDiseaseModifier(species, variety, disease) {
        const varietyData = getJapanVarietyData(species, variety);
        if (!varietyData?.traits?.disease?.[disease]) {
            return { riskMultiplier: 1.0, confidence: 'none' };
        }
        return varietyData.traits.disease[disease];
    }
    
    /**
     * Get shade modifier for Japan variety
     */
    function getJapanShadeModifier(species, variety) {
        const varietyData = getJapanVarietyData(species, variety);
        if (!varietyData?.traits?.shade) {
            return { thresholdModifier: 1.0, confidence: 'none' };
        }
        return varietyData.traits.shade;
    }
    
    /**
     * Get cold tolerance for Japan variety
     */
    function getJapanColdModifier(species, variety) {
        const varietyData = getJapanVarietyData(species, variety);
        if (!varietyData?.traits?.cold) {
            return { dormancyThresholdModifier: 1.0, winterkillRisk: 1.0, confidence: 'none' };
        }
        return varietyData.traits.cold;
    }
    
    /**
     * List all varieties for a species in Japan database
     */
    function listJapanVarieties(species) {
        const speciesMap = {
            'zoysia': ['zoysiaJaponica', 'zoysiaMatrella'],
            'zoysiaJaponica': ['zoysiaJaponica'],
            'zoysiaMatrella': ['zoysiaMatrella'],
            'bentgrass': ['bentgrass'],
            'perennialRyegrass': ['perennialRyegrass']
        };
        
        const speciesKeys = speciesMap[species] || [species];
        const varieties = [];
        
        for (const key of speciesKeys) {
            if (JAPAN_VARIETY_TRAITS[key]) {
                for (const [name, data] of Object.entries(JAPAN_VARIETY_TRAITS[key])) {
                    varieties.push({
                        name: name,
                        displayName: data.displayName,
                        species: data.species,
                        type: data.type
                    });
                }
            }
        }
        
        return varieties;
    }
    
    /**
     * Check if variety exists in Japan database
     */
    function isJapanVariety(species, variety) {
        return getJapanVarietyData(species, variety) !== null;
    }
    
    // ═══════════════════════════════════════════════════════════════════════════
    // EXPORTS
    // ═══════════════════════════════════════════════════════════════════════════
    
    global.JAPAN_VARIETY_TRAITS = JAPAN_VARIETY_TRAITS;
    global.getJapanVarietyData = getJapanVarietyData;
    global.getJapanWearModifier = getJapanWearModifier;
    global.getJapanDiseaseModifier = getJapanDiseaseModifier;
    global.getJapanShadeModifier = getJapanShadeModifier;
    global.getJapanColdModifier = getJapanColdModifier;
    global.listJapanVarieties = listJapanVarieties;
    global.isJapanVariety = isJapanVariety;
    
})(typeof window !== 'undefined' ? window : global);
