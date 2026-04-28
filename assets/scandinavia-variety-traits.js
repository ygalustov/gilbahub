/**
 * Scandinavia Variety Traits Database
 * ====================================
 * 
 * Source: SCANTURF & SCANGREEN 2024-2025
 * PDF: https://sterf.org/wp-content/uploads/2025/11/Turfgrass-seeds-for-the-Nordic-Countries-2025.pdf
 * 
 * Trial Sites:
 * - SCANTURF: 3 sites across Nordic countries (mowing 10-40mm)
 * - SCANGREEN: 4 sites split into North/South zones (mowing 3-5mm)
 * 
 * Scale: 1-9 (higher = better) for all traits
 * 
 * Nordic-Specific Traits NOT in BSPB:
 * - Gray snow mold (Typhula incarnata) resistance
 * - Pink snow mold / Microdochium patch resistance
 * - Winter hardiness (critical for continental Nordic climate)
 * 
 * Version: 1.0.0
 * Last Updated: 2026-01-04
 * Data Verified: Direct extraction from Scanturf 2024-2025 PDF
 */

const ScandinaviaVarietyTraits = {
    
    version: '1.0.0',
    source: 'SCANTURF/SCANGREEN 2024-2025',
    dataVerified: true,
    
    // ═══════════════════════════════════════════════════════════════════════════
    // PERENNIAL RYEGRASS (Lolium perenne)
    // Source: SCANTURF Table b - Lawn and sports turf mown at 10-40mm
    // ═══════════════════════════════════════════════════════════════════════════
    
    perennialRyegrass: {
        
        'Eventus': {
            species: 'perennialRyegrass',
            displayName: 'Eventus',
            region: 'Scandinavia',
            type: 'diploid',
            owner: 'DSV',
            testPeriod: 'SCANTURF 2017-2020',
            
            scanturfRatings: {
                generalImpression: 6.3,
                wearTolerance: 6.9,
                recovery: 4.0,
                density: 6.4,
                leafFineness: 6.2,
                color: 4.8,
                winterColor: 5.7,
                winterHardiness: 5.2,
                relativeGrowthRate: 98
            },
            
            diseaseResistance: {
                graySnowMold: { rating: 5.0, confidence: 'high', source: 'SCANTURF 2017-2020' },
                microdochiumPatch: { rating: 5.0, confidence: 'high', source: 'SCANTURF 2017-2020' },
                rust: { rating: 4.9, confidence: 'high', source: 'SCANTURF 2017-2020' },
                redThread: { rating: 3.4, confidence: 'high', source: 'SCANTURF 2017-2020' }
            },
            
            traits: {
                wear: {
                    multiplier: 0.86,
                    confidence: 'high',
                    source: 'SCANTURF - Wear tolerance 6.9, top performer'
                },
                disease: {
                    redThread: {
                        riskMultiplier: 1.18,
                        confidence: 'high',
                        source: 'SCANTURF - Red thread 3.4 (poor in Nordic conditions)'
                    },
                    graySnowMold: {
                        riskMultiplier: 1.00,
                        confidence: 'high',
                        source: 'SCANTURF - Gray snow mold 5.0 (average)'
                    },
                    microdochiumPatch: {
                        riskMultiplier: 1.00,
                        confidence: 'high',
                        source: 'SCANTURF - Microdochium 5.0 (average)'
                    }
                }
            }
        },
        
        'Monroe': {
            species: 'perennialRyegrass',
            displayName: 'Monroe',
            region: 'Scandinavia',
            type: 'diploid',
            owner: 'DLF',
            testPeriod: 'SCANTURF 2015-2018',
            
            scanturfRatings: {
                generalImpression: 6.1,
                wearTolerance: 7.2,
                recovery: 3.1,
                density: 6.2,
                leafFineness: 5.7,
                color: 5.3,
                winterColor: 6.0,
                winterHardiness: 4.8,
                relativeGrowthRate: 100
            },
            
            diseaseResistance: {
                microdochiumPatch: { rating: 4.8, confidence: 'high', source: 'SCANTURF 2015-2018' },
                rust: { rating: 4.9, confidence: 'high', source: 'SCANTURF 2015-2018' },
                redThread: { rating: 3.3, confidence: 'high', source: 'SCANTURF 2015-2018' }
            },
            
            traits: {
                wear: {
                    multiplier: 0.84,
                    confidence: 'high',
                    source: 'SCANTURF - Wear tolerance 7.2, excellent'
                },
                disease: {
                    redThread: {
                        riskMultiplier: 1.20,
                        confidence: 'high',
                        source: 'SCANTURF - Red thread 3.3 (poor)'
                    }
                }
            }
        },
        
        'Annecy': {
            species: 'perennialRyegrass',
            displayName: 'Annecy',
            region: 'Scandinavia',
            type: 'diploid',
            owner: 'DLF',
            testPeriod: 'SCANTURF 2015-2018',
            
            scanturfRatings: {
                generalImpression: 6.1,
                wearTolerance: 7.3,
                recovery: 3.5,
                density: 5.9,
                leafFineness: 6.0,
                color: 4.8,
                winterColor: 5.4,
                winterHardiness: 5.0,
                relativeGrowthRate: 95
            },
            
            diseaseResistance: {
                microdochiumPatch: { rating: 5.1, confidence: 'high', source: 'SCANTURF 2015-2018' },
                rust: { rating: 5.0, confidence: 'high', source: 'SCANTURF 2015-2018' },
                redThread: { rating: 3.3, confidence: 'high', source: 'SCANTURF 2015-2018' }
            },
            
            traits: {
                wear: {
                    multiplier: 0.85,
                    confidence: 'high',
                    source: 'SCANTURF - Wear tolerance 7.3, excellent'
                },
                disease: {
                    redThread: {
                        riskMultiplier: 1.20,
                        confidence: 'high',
                        source: 'SCANTURF - Red thread 3.3 (poor - matches BSPB 4.0)'
                    }
                }
            }
        },
        
        'Clementine': {
            species: 'perennialRyegrass',
            displayName: 'Clementine',
            region: 'Scandinavia',
            type: 'diploid',
            owner: 'DLF',
            testPeriod: 'SCANTURF south 2011-2014',
            
            scanturfRatings: {
                generalImpression: 6.1,
                density: 6.4,
                leafFineness: 6.1,
                color: 4.7,
                winterColor: 5.7,
                winterHardiness: 5.0,
                relativeGrowthRate: 100
            },
            
            diseaseResistance: {
                graySnowMold: { rating: 5.0, confidence: 'high', source: 'SCANTURF 2011-2014' },
                microdochiumPatch: { rating: 5.1, confidence: 'high', source: 'SCANTURF 2011-2014' },
                rust: { rating: 2.5, confidence: 'high', source: 'SCANTURF 2011-2014' },
                redThread: { rating: 3.5, confidence: 'high', source: 'SCANTURF 2011-2014' }
            },
            
            traits: {
                wear: {
                    multiplier: 0.92,
                    confidence: 'high',
                    source: 'SCANTURF - General impression 6.1'
                },
                disease: {
                    redThread: {
                        riskMultiplier: 1.15,
                        confidence: 'high',
                        source: 'SCANTURF - Red thread 3.5 (below average)'
                    },
                    rust: {
                        riskMultiplier: 1.30,
                        confidence: 'high',
                        source: 'SCANTURF - Rust 2.5 (poor)'
                    }
                }
            }
        },
        
        'Gildara': {
            species: 'perennialRyegrass',
            displayName: 'Gildara',
            region: 'Scandinavia',
            type: 'diploid',
            owner: 'DLF',
            testPeriod: 'SCANTURF 2021-2024',
            
            scanturfRatings: {
                generalImpression: 6.0,
                wearTolerance: 5.6,
                recovery: 4.0,
                density: 6.1,
                leafFineness: 6.1,
                color: 4.8,
                winterColor: 5.6,
                winterHardiness: 4.9,
                relativeGrowthRate: 101
            },
            
            diseaseResistance: {
                microdochiumPatch: { rating: 4.9, confidence: 'high', source: 'SCANTURF 2021-2024' },
                redThread: { rating: 3.3, confidence: 'high', source: 'SCANTURF 2021-2024' }
            },
            
            traits: {
                wear: {
                    multiplier: 0.96,
                    confidence: 'high',
                    source: 'SCANTURF - Wear tolerance 5.6 (moderate)'
                },
                disease: {
                    redThread: {
                        riskMultiplier: 1.20,
                        confidence: 'high',
                        source: 'SCANTURF - Red thread 3.3 (poor - matches BSPB 4.5)'
                    }
                }
            }
        },
        
        'Columbine': {
            species: 'perennialRyegrass',
            displayName: 'Columbine',
            region: 'Scandinavia',
            type: 'diploid',
            owner: 'DLF',
            testPeriod: 'SCANTURF 2013-2016',
            
            scanturfRatings: {
                generalImpression: 5.7,
                wearTolerance: 6.9,
                density: 6.2,
                leafFineness: 5.7,
                color: 4.8,
                winterColor: 5.5,
                winterHardiness: 4.9,
                relativeGrowthRate: 103
            },
            
            diseaseResistance: {
                microdochiumPatch: { rating: 5.1, confidence: 'high', source: 'SCANTURF 2013-2016' },
                drechsleraLeafSpot: { rating: 6.0, confidence: 'high', source: 'SCANTURF 2013-2016' },
                redThread: { rating: 3.5, confidence: 'high', source: 'SCANTURF 2013-2016' }
            },
            
            traits: {
                wear: {
                    multiplier: 0.86,
                    confidence: 'high',
                    source: 'SCANTURF - Wear tolerance 6.9'
                },
                disease: {
                    redThread: {
                        riskMultiplier: 1.15,
                        confidence: 'high',
                        source: 'SCANTURF - Red thread 3.5'
                    }
                }
            }
        },
        
        'Saila': {
            species: 'perennialRyegrass',
            displayName: 'Saila',
            region: 'Scandinavia',
            type: 'diploid',
            owner: 'DLF',
            testPeriod: 'SCANTURF 2023-2026 (New)',
            
            scanturfRatings: {
                generalImpression: 6.3,
                wearTolerance: 7.8,
                recovery: 3.8,
                density: 6.4,
                leafFineness: 5.7,
                color: 4.5,
                winterColor: 5.3,
                winterHardiness: 5.1,
                relativeGrowthRate: 107
            },
            
            diseaseResistance: {
                redThread: { rating: 3.7, confidence: 'medium', source: 'SCANTURF 2023-2026 (preliminary)' }
            },
            
            traits: {
                wear: {
                    multiplier: 0.80,
                    confidence: 'high',
                    source: 'SCANTURF - Wear tolerance 7.8, top performer in new trials'
                },
                disease: {
                    redThread: {
                        riskMultiplier: 1.12,
                        confidence: 'medium',
                        source: 'SCANTURF - Red thread 3.7 (preliminary)'
                    }
                }
            }
        },
        
        'Eurocordus': {
            species: 'perennialRyegrass',
            displayName: 'Eurocordus',
            region: 'Scandinavia',
            type: 'diploid',
            owner: 'DSV',
            testPeriod: 'SCANTURF 2013-2016',
            
            scanturfRatings: {
                generalImpression: 5.9,
                wearTolerance: 7.1,
                density: 6.1,
                leafFineness: 5.7,
                color: 4.7,
                winterColor: 5.2,
                winterHardiness: 4.9,
                relativeGrowthRate: 107
            },
            
            diseaseResistance: {
                microdochiumPatch: { rating: 5.1, confidence: 'high', source: 'SCANTURF 2013-2016' },
                drechsleraLeafSpot: { rating: 5.7, confidence: 'high', source: 'SCANTURF 2013-2016' },
                redThread: { rating: 3.3, confidence: 'high', source: 'SCANTURF 2013-2016' }
            },
            
            traits: {
                wear: {
                    multiplier: 0.85,
                    confidence: 'high',
                    source: 'SCANTURF - Wear tolerance 7.1'
                },
                disease: {
                    redThread: {
                        riskMultiplier: 1.20,
                        confidence: 'high',
                        source: 'SCANTURF - Red thread 3.3 (poor)'
                    }
                }
            }
        },
        
        'Eurodiamond': {
            species: 'perennialRyegrass',
            displayName: 'Eurodiamond',
            region: 'Scandinavia',
            type: 'diploid',
            owner: 'DSV',
            // Note: Not found in Scanturf tables - BSPB only
            scanturfRatings: null,
            
            traits: {
                disease: {
                    redThread: {
                        riskMultiplier: 1.25,
                        confidence: 'high',
                        source: 'BSPB 2025 - Red thread 3.7 (poor) - no Scanturf data'
                    }
                }
            }
        },
        
        'Dickens': {
            species: 'perennialRyegrass',
            displayName: 'Dickens',
            region: 'Scandinavia',
            type: 'diploid',
            owner: 'DLF',
            testPeriod: 'SCANTURF 2007-2010',
            
            scanturfRatings: {
                generalImpression: 5.3,
                wearTolerance: 7.6,
                density: 5.7,
                leafFineness: 5.2,
                color: 4.7,
                winterColor: 5.3,
                winterHardiness: 4.6,
                relativeGrowthRate: 117
            },
            
            diseaseResistance: {
                microdochiumPatch: { rating: 5.6, confidence: 'high', source: 'SCANTURF 2007-2010' }
            },
            
            traits: {
                wear: {
                    multiplier: 0.82,
                    confidence: 'high',
                    source: 'SCANTURF - Wear tolerance 7.6, excellent'
                }
            }
        },
        
        // ═══════════════════════════════════════════════════════════════════════
        // TETRAPLOID RYEGRASSES
        // ═══════════════════════════════════════════════════════════════════════
        
        'Tetrastar': {
            species: 'perennialRyegrass',
            displayName: 'Tetrastar 4turf',
            region: 'Scandinavia',
            type: 'tetraploid',
            owner: 'DLF',
            testPeriod: 'SCANTURF 2015-2018',
            
            scanturfRatings: {
                generalImpression: 6.3,
                density: 6.3,
                leafFineness: 5.2,
                color: 6.8,
                winterColor: 6.8,
                winterHardiness: 5.1,
                relativeGrowthRate: 112
            },
            
            diseaseResistance: {
                microdochiumPatch: { rating: 5.2, confidence: 'high', source: 'SCANTURF 2015-2018' },
                rust: { rating: 5.0, confidence: 'high', source: 'SCANTURF 2015-2018' },
                redThread: { rating: 3.3, confidence: 'high', source: 'SCANTURF 2015-2018' }
            },
            
            traits: {
                wear: {
                    multiplier: 0.92,
                    confidence: 'high',
                    source: 'SCANTURF - Tetraploid, good general impression'
                },
                disease: {
                    redThread: {
                        riskMultiplier: 1.20,
                        confidence: 'high',
                        source: 'SCANTURF - Red thread 3.3 (typical tetraploid weakness)'
                    }
                }
            }
        },
        
        'Fabian': {
            species: 'perennialRyegrass',
            displayName: 'Fabian 4turf',
            region: 'Scandinavia',
            type: 'tetraploid',
            owner: 'DLF',
            testPeriod: 'SCANTURF 2013-2016',
            
            scanturfRatings: {
                generalImpression: 6.1,
                wearTolerance: 6.2,
                density: 6.0,
                leafFineness: 5.2,
                color: 5.8,
                winterColor: 6.1,
                winterHardiness: 5.5,
                relativeGrowthRate: 101
            },
            
            diseaseResistance: {
                microdochiumPatch: { rating: 5.2, confidence: 'high', source: 'SCANTURF 2013-2016' },
                drechsleraLeafSpot: { rating: 5.0, confidence: 'high', source: 'SCANTURF 2013-2016' },
                redThread: { rating: 3.5, confidence: 'high', source: 'SCANTURF 2013-2016' }
            },
            
            traits: {
                wear: {
                    multiplier: 0.90,
                    confidence: 'high',
                    source: 'SCANTURF - Wear tolerance 6.2'
                },
                disease: {
                    redThread: {
                        riskMultiplier: 1.15,
                        confidence: 'high',
                        source: 'SCANTURF - Red thread 3.5'
                    }
                }
            }
        },
        
        'Double': {
            species: 'perennialRyegrass',
            displayName: 'Double 4turf',
            region: 'Scandinavia',
            type: 'tetraploid',
            owner: 'DLF',
            testPeriod: 'SCANTURF south 2011-2014',
            
            scanturfRatings: {
                generalImpression: 5.6,
                density: 5.5,
                leafFineness: 4.5,
                color: 6.1,
                winterColor: 6.0,
                winterHardiness: 5.8,
                relativeGrowthRate: 121
            },
            
            diseaseResistance: {
                graySnowMold: { rating: 6.2, confidence: 'high', source: 'SCANTURF 2011-2014' },
                microdochiumPatch: { rating: 5.0, confidence: 'high', source: 'SCANTURF 2011-2014' },
                rust: { rating: 4.5, confidence: 'high', source: 'SCANTURF 2011-2014' },
                redThread: { rating: 4.6, confidence: 'high', source: 'SCANTURF 2011-2014' }
            },
            
            traits: {
                wear: {
                    multiplier: 0.97,
                    confidence: 'medium',
                    source: 'SCANTURF - General impression 5.6'
                },
                disease: {
                    redThread: {
                        riskMultiplier: 1.02,
                        confidence: 'high',
                        source: 'SCANTURF - Red thread 4.6 (better than most tetraploids)'
                    },
                    graySnowMold: {
                        riskMultiplier: 0.88,
                        confidence: 'high',
                        source: 'SCANTURF - Gray snow mold 6.2 (good resistance)'
                    }
                }
            }
        }
    },
    
    // ═══════════════════════════════════════════════════════════════════════════
    // SMOOTH MEADOW GRASS / KENTUCKY BLUEGRASS (Poa pratensis)
    // Source: SCANTURF Table a
    // ═══════════════════════════════════════════════════════════════════════════
    
    kentuckyBluegrass: {
        
        'Becca': {
            species: 'kentuckyBluegrass',
            displayName: 'Becca',
            region: 'Scandinavia',
            owner: 'DLF',
            testPeriod: 'SCANTURF 2015-2018',
            
            scanturfRatings: {
                generalImpression: 6.1,
                wearTolerance: 5.2,
                recovery: 2.8,
                density: 6.2,
                leafFineness: 5.6,
                color: 6.0,
                winterColor: 5.0,
                winterHardiness: 8.0,
                relativeGrowthRate: 95
            },
            
            diseaseResistance: {
                microdochiumPatch: { rating: 6.0, confidence: 'high', source: 'SCANTURF 2015-2018' },
                rust: { rating: 4.6, confidence: 'high', source: 'SCANTURF 2015-2018' },
                redThread: { rating: 5.0, confidence: 'high', source: 'SCANTURF 2015-2018' }
            },
            
            traits: {
                wear: {
                    multiplier: 0.97,
                    confidence: 'high',
                    source: 'SCANTURF - Wear tolerance 5.2'
                },
                winterHardiness: {
                    multiplier: 0.80,
                    confidence: 'high',
                    source: 'SCANTURF - Winter hardiness 8.0, excellent'
                }
            }
        },
        
        'Limousine': {
            species: 'kentuckyBluegrass',
            displayName: 'Limousine',
            region: 'Scandinavia',
            owner: 'DSV',
            testPeriod: 'Multiple: Norway 1990-2001, SCANTURF 2005-2016',
            
            scanturfRatings: {
                generalImpression: 6.0,
                wearTolerance: 5.6,
                recovery: 4.0,
                density: 6.1,
                leafFineness: 5.4,
                color: 6.0,
                winterColor: 4.9,
                winterHardiness: 8.0,
                relativeGrowthRate: 96
            },
            
            diseaseResistance: {
                graySnowMold: { rating: 7.0, confidence: 'high', source: 'SCANTURF multiple periods' },
                microdochiumPatch: { rating: 6.0, confidence: 'high', source: 'SCANTURF multiple periods' },
                rust: { rating: 4.0, confidence: 'high', source: 'SCANTURF multiple periods' },
                drechsleraLeafSpot: { rating: 5.5, confidence: 'high', source: 'SCANTURF multiple periods' },
                redThread: { rating: 5.0, confidence: 'high', source: 'SCANTURF multiple periods' },
                dollarSpot: { rating: 5.0, confidence: 'high', source: 'SCANTURF multiple periods' }
            },
            
            traits: {
                wear: {
                    multiplier: 0.95,
                    confidence: 'high',
                    source: 'SCANTURF - Wear tolerance 5.6'
                },
                winterHardiness: {
                    multiplier: 0.80,
                    confidence: 'high',
                    source: 'SCANTURF - Winter hardiness 8.0, proven Nordic cultivar'
                },
                disease: {
                    graySnowMold: {
                        riskMultiplier: 0.85,
                        confidence: 'high',
                        source: 'SCANTURF - Gray snow mold 7.0 (good resistance)'
                    }
                }
            }
        },
        
        'Traction': {
            species: 'kentuckyBluegrass',
            displayName: 'Traction',
            region: 'Scandinavia',
            owner: 'Everris/ICL',
            testPeriod: 'SCANTURF 2015-2018',
            
            scanturfRatings: {
                generalImpression: 6.0,
                wearTolerance: 5.4,
                recovery: 7.2,
                density: 6.1,
                leafFineness: 5.7,
                color: 6.0,
                winterColor: 4.9,
                winterHardiness: 8.0,
                relativeGrowthRate: 96
            },
            
            diseaseResistance: {
                microdochiumPatch: { rating: 6.0, confidence: 'high', source: 'SCANTURF 2015-2018' },
                rust: { rating: 4.4, confidence: 'high', source: 'SCANTURF 2015-2018' },
                redThread: { rating: 5.0, confidence: 'high', source: 'SCANTURF 2015-2018' }
            },
            
            traits: {
                wear: {
                    multiplier: 0.95,
                    confidence: 'high',
                    source: 'SCANTURF - Wear tolerance 5.4'
                },
                recovery: {
                    multiplier: 0.83,
                    confidence: 'high',
                    source: 'SCANTURF - Recovery 7.2, excellent'
                },
                winterHardiness: {
                    multiplier: 0.80,
                    confidence: 'high',
                    source: 'SCANTURF - Winter hardiness 8.0'
                }
            }
        },
        
        'Julius': {
            species: 'kentuckyBluegrass',
            displayName: 'Julius',
            region: 'Scandinavia',
            owner: 'DLF',
            testPeriod: 'SCANTURF 2021-2024',
            
            scanturfRatings: {
                generalImpression: 6.1,
                density: 6.0,
                leafFineness: 5.3,
                color: 5.4,
                winterColor: 4.8,
                winterHardiness: 7.8,
                relativeGrowthRate: 94
            },
            
            diseaseResistance: {
                microdochiumPatch: { rating: 5.8, confidence: 'high', source: 'SCANTURF 2021-2024' },
                redThread: { rating: 4.8, confidence: 'high', source: 'SCANTURF 2021-2024' }
            },
            
            traits: {
                winterHardiness: {
                    multiplier: 0.82,
                    confidence: 'high',
                    source: 'SCANTURF - Winter hardiness 7.8'
                }
            }
        }
    },
    
    // ═══════════════════════════════════════════════════════════════════════════
    // CHEWINGS FESCUE (Festuca rubra ssp. commutata)
    // Source: SCANTURF Table c
    // ═══════════════════════════════════════════════════════════════════════════
    
    chewingsFescue: {
        
        'Barlineus': {
            species: 'chewingsFescue',
            displayName: 'Barlineus',
            region: 'Scandinavia',
            owner: 'Barenbrug',
            testPeriod: 'SCANTURF 2007-2016',
            
            scanturfRatings: {
                generalImpression: 6.4,
                density: 7.2,
                leafFineness: 7.7,
                color: 6.3,
                winterColor: 5.9,
                winterHardiness: 5.6,
                relativeGrowthRate: 91
            },
            
            diseaseResistance: {
                microdochiumPatch: { rating: 6.1, confidence: 'high', source: 'SCANTURF' },
                drechsleraLeafSpot: { rating: 6.0, confidence: 'high', source: 'SCANTURF' },
                redThread: { rating: 5.1, confidence: 'high', source: 'SCANTURF' }
            },
            
            traits: {
                disease: {
                    redThread: {
                        riskMultiplier: 1.00,
                        confidence: 'high',
                        source: 'SCANTURF - Red thread 5.1 (average)'
                    },
                    microdochiumPatch: {
                        riskMultiplier: 0.90,
                        confidence: 'high',
                        source: 'SCANTURF - Microdochium 6.1 (good)'
                    }
                }
            }
        },
        
        'Greensleeves': {
            species: 'chewingsFescue',
            displayName: 'Greensleeves',
            region: 'Scandinavia',
            owner: 'DLF',
            testPeriod: 'SCANTURF 2005-2008',
            
            scanturfRatings: {
                generalImpression: 6.6,
                density: 7.0,
                leafFineness: 7.5,
                color: 6.5,
                winterColor: 6.4,
                winterHardiness: 5.7,
                relativeGrowthRate: 94
            },
            
            diseaseResistance: {
                microdochiumPatch: { rating: 4.8, confidence: 'high', source: 'SCANTURF 2005-2008' },
                redThread: { rating: 3.8, confidence: 'high', source: 'SCANTURF 2005-2008' }
            },
            
            traits: {
                disease: {
                    redThread: {
                        riskMultiplier: 1.14,
                        confidence: 'high',
                        source: 'SCANTURF - Red thread 3.8 (below average)'
                    }
                }
            }
        },
        
        'Lystig': {
            species: 'chewingsFescue',
            displayName: 'Lystig',
            region: 'Scandinavia',
            owner: 'Graminor',
            testPeriod: 'SCANTURF 2015-2018',
            
            scanturfRatings: {
                generalImpression: 6.6,
                density: 7.0,
                leafFineness: 7.5,
                color: 6.1,
                winterColor: 5.7,
                winterHardiness: 6.0,
                relativeGrowthRate: 98
            },
            
            diseaseResistance: {
                microdochiumPatch: { rating: 5.8, confidence: 'high', source: 'SCANTURF 2015-2018' },
                redThread: { rating: 4.9, confidence: 'high', source: 'SCANTURF 2015-2018' }
            },
            
            traits: {
                winterHardiness: {
                    multiplier: 0.92,
                    confidence: 'high',
                    source: 'SCANTURF - Winter hardiness 6.0 (good for fescue)'
                },
                disease: {
                    redThread: {
                        riskMultiplier: 1.03,
                        confidence: 'high',
                        source: 'SCANTURF - Red thread 4.9 (average)'
                    }
                }
            }
        },
        
        'Barpatria': {
            species: 'chewingsFescue',
            displayName: 'Barpatria',
            region: 'Scandinavia',
            owner: 'Barenbrug',
            testPeriod: 'SCANTURF 2023-2026 (New)',
            
            scanturfRatings: {
                generalImpression: 6.9,
                density: 7.4,
                leafFineness: 7.6,
                color: 5.7,
                winterColor: 6.9,
                winterHardiness: 5.8,
                relativeGrowthRate: 93
            },
            
            diseaseResistance: {
                microdochiumPatch: { rating: 6.4, confidence: 'medium', source: 'SCANTURF 2023-2026 (preliminary)' },
                redThread: { rating: 6.5, confidence: 'medium', source: 'SCANTURF 2023-2026 (preliminary)' }
            },
            
            traits: {
                disease: {
                    redThread: {
                        riskMultiplier: 0.87,
                        confidence: 'medium',
                        source: 'SCANTURF - Red thread 6.5 (good resistance, preliminary)'
                    }
                }
            }
        }
    },
    
    // ═══════════════════════════════════════════════════════════════════════════
    // CREEPING BENTGRASS (Agrostis stolonifera)
    // Source: SCANGREEN Table c (South) and Table c (North)
    // ═══════════════════════════════════════════════════════════════════════════
    
    creepingBentgrass: {
        
        '777 Triple Seven': {
            species: 'creepingBentgrass',
            displayName: '777 Triple Seven',
            region: 'Scandinavia',
            owner: 'DLF',
            testPeriod: 'SCANGREEN 2019-2022, 2023-2026',
            
            scangreenRatings: {
                south: {
                    generalImpression: 6.3,
                    density: 7.4,
                    leafFineness: 6.3,
                    color: 5.8,
                    winterColor: 5.1,
                    winterHardiness: 6.6,
                    relativeGrowthRate: 98
                },
                north: {
                    generalImpression: 6.2,
                    density: 7.3,
                    leafFineness: 6.3,
                    color: 5.8,
                    winterColor: 5.1,
                    winterHardiness: 4.7
                }
            },
            
            diseaseResistance: {
                pinkSnowMold: { rating: 6.1, confidence: 'high', source: 'SCANGREEN' },
                overallInSeason: { rating: 6.4, confidence: 'high', source: 'SCANGREEN' },
                microdochiumPatch: { rating: 6.0, confidence: 'high', source: 'SCANGREEN' },
                redThread: { rating: 5.9, confidence: 'high', source: 'SCANGREEN' },
                dollarSpot: { rating: 5.9, confidence: 'high', source: 'SCANGREEN' }
            },
            
            traits: {
                disease: {
                    dollarSpot: {
                        riskMultiplier: 0.93,
                        confidence: 'high',
                        source: 'SCANGREEN - Dollar spot 5.9 (above average)'
                    }
                }
            }
        },
        
        'Piranha': {
            species: 'creepingBentgrass',
            displayName: 'Piranha',
            region: 'Scandinavia',
            owner: 'ICL/Everris',
            testPeriod: 'SCANGREEN 2019-2022, 2023-2026',
            
            scangreenRatings: {
                south: {
                    generalImpression: 6.5,
                    density: 7.5,
                    leafFineness: 6.2,
                    color: 5.8,
                    winterColor: 5.3,
                    winterHardiness: 6.6,
                    relativeGrowthRate: 94
                },
                north: {
                    generalImpression: 6.1,
                    density: 7.1,
                    leafFineness: 6.1,
                    color: 5.7,
                    winterColor: 5.0,
                    winterHardiness: 4.8
                }
            },
            
            diseaseResistance: {
                pinkSnowMold: { rating: 6.0, confidence: 'high', source: 'SCANGREEN' },
                overallInSeason: { rating: 6.4, confidence: 'high', source: 'SCANGREEN' },
                microdochiumPatch: { rating: 5.9, confidence: 'high', source: 'SCANGREEN' },
                redThread: { rating: 6.0, confidence: 'high', source: 'SCANGREEN' },
                dollarSpot: { rating: 6.0, confidence: 'high', source: 'SCANGREEN' }
            },
            
            traits: {
                disease: {
                    dollarSpot: {
                        riskMultiplier: 0.92,
                        confidence: 'high',
                        source: 'SCANGREEN - Dollar spot 6.0 (good resistance)'
                    }
                }
            }
        },
        
        'Independence': {
            species: 'creepingBentgrass',
            displayName: 'Independence',
            region: 'Scandinavia',
            owner: 'DLF',
            testPeriod: 'SCANGREEN 2003-2026 (multiple)',
            
            scangreenRatings: {
                south: {
                    generalImpression: 5.9,
                    density: 7.1,
                    leafFineness: 5.9,
                    color: 6.0,
                    winterColor: 5.1,
                    winterHardiness: 6.6,
                    relativeGrowthRate: 100
                },
                north: {
                    generalImpression: 6.0,
                    density: 7.0,
                    leafFineness: 6.0,
                    color: 6.0,
                    winterColor: 5.0,
                    winterHardiness: 4.8
                }
            },
            
            diseaseResistance: {
                pinkSnowMold: { rating: 6.0, confidence: 'high', source: 'SCANGREEN multiple periods' },
                graySnowMold: { rating: 6.0, confidence: 'high', source: 'SCANGREEN multiple periods' },
                overallInSeason: { rating: 6.4, confidence: 'high', source: 'SCANGREEN multiple periods' },
                microdochiumPatch: { rating: 6.0, confidence: 'high', source: 'SCANGREEN multiple periods' },
                redThread: { rating: 6.0, confidence: 'high', source: 'SCANGREEN multiple periods' },
                dollarSpot: { rating: 6.0, confidence: 'high', source: 'SCANGREEN multiple periods' }
            },
            
            traits: {
                disease: {
                    dollarSpot: {
                        riskMultiplier: 0.92,
                        confidence: 'high',
                        source: 'SCANGREEN - Long-term reference variety, consistent performance'
                    }
                }
            }
        }
    }
};

// ═══════════════════════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Get variety data from Scandinavia database
 */
function getScandinaviaVarietyData(varietyName) {
    const normalizedName = varietyName.trim();
    
    // Search all species categories
    for (const speciesKey of Object.keys(ScandinaviaVarietyTraits)) {
        if (speciesKey === 'version' || speciesKey === 'source' || speciesKey === 'dataVerified') continue;
        
        const speciesData = ScandinaviaVarietyTraits[speciesKey];
        if (speciesData && speciesData[normalizedName]) {
            return {
                ...speciesData[normalizedName],
                speciesCategory: speciesKey
            };
        }
    }
    
    return null;
}

/**
 * Get Scandinavia-specific disease modifier
 * @param {string} varietyName - Variety name
 * @param {string} diseaseName - Disease type (redThread, graySnowMold, microdochiumPatch, dollarSpot, rust)
 * @returns {object} - { multiplier, confidence, source }
 */
function getScandinaviaDiseaseModifier(varietyName, diseaseName) {
    const variety = getScandinaviaVarietyData(varietyName);
    
    if (!variety) {
        return { multiplier: 1.0, confidence: 'none', source: 'Variety not in Scandinavia database' };
    }
    
    // Check disease resistance ratings first
    if (variety.diseaseResistance && variety.diseaseResistance[diseaseName]) {
        const rating = variety.diseaseResistance[diseaseName].rating;
        // Convert 1-9 scale to multiplier (5.5 = 1.0 baseline)
        const multiplier = 1.0 + ((5.5 - rating) * 0.06);
        return {
            multiplier: Math.round(multiplier * 100) / 100,
            confidence: variety.diseaseResistance[diseaseName].confidence,
            source: variety.diseaseResistance[diseaseName].source
        };
    }
    
    // Check traits.disease
    if (variety.traits && variety.traits.disease && variety.traits.disease[diseaseName]) {
        return variety.traits.disease[diseaseName];
    }
    
    return { multiplier: 1.0, confidence: 'none', source: 'No disease data for this variety' };
}

/**
 * Get winter hardiness modifier (Nordic-specific)
 */
function getWinterHardinessModifier(varietyName) {
    const variety = getScandinaviaVarietyData(varietyName);
    
    if (!variety) {
        return { multiplier: 1.0, confidence: 'none', source: 'Variety not in Scandinavia database' };
    }
    
    // Check ratings
    const ratings = variety.scanturfRatings || variety.scangreenRatings?.north || variety.scangreenRatings?.south;
    if (ratings && ratings.winterHardiness) {
        // Convert 1-9 scale: 8.0 = excellent (0.80), 5.0 = average (1.0), 2.0 = poor (1.20)
        const multiplier = 1.0 + ((5.0 - ratings.winterHardiness) * 0.067);
        return {
            multiplier: Math.round(multiplier * 100) / 100,
            confidence: 'high',
            source: `SCANTURF - Winter hardiness ${ratings.winterHardiness}`
        };
    }
    
    if (variety.traits && variety.traits.winterHardiness) {
        return variety.traits.winterHardiness;
    }
    
    return { multiplier: 1.0, confidence: 'none', source: 'No winter hardiness data' };
}

/**
 * List all varieties in Scandinavia database
 */
function listScandinaviaVarieties(speciesFilter = null) {
    const results = [];
    
    for (const speciesKey of Object.keys(ScandinaviaVarietyTraits)) {
        if (speciesKey === 'version' || speciesKey === 'source' || speciesKey === 'dataVerified') continue;
        
        if (speciesFilter && speciesKey !== speciesFilter) continue;
        
        const speciesData = ScandinaviaVarietyTraits[speciesKey];
        for (const varietyName of Object.keys(speciesData)) {
            results.push({
                name: varietyName,
                species: speciesKey,
                displayName: speciesData[varietyName].displayName || varietyName
            });
        }
    }
    
    return results;
}

/**
 * Check if variety exists in Scandinavia database
 */
function isScandinaviaVariety(varietyName) {
    return getScandinaviaVarietyData(varietyName) !== null;
}

// Export for Node.js
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        ScandinaviaVarietyTraits,
        getScandinaviaVarietyData,
        getScandinaviaDiseaseModifier,
        getWinterHardinessModifier,
        listScandinaviaVarieties,
        isScandinaviaVariety
    };
}

// Browser/WordPress global
if (typeof window !== 'undefined') {
    window.ScandinaviaVarietyTraits = ScandinaviaVarietyTraits;
    window.getScandinaviaVarietyData = getScandinaviaVarietyData;
    window.getScandinaviaDiseaseModifier = getScandinaviaDiseaseModifier;
    window.getWinterHardinessModifier = getWinterHardinessModifier;
    window.listScandinaviaVarieties = listScandinaviaVarieties;
    window.isScandinaviaVariety = isScandinaviaVariety;
}

// Log on load
if (typeof console !== 'undefined') {
}
