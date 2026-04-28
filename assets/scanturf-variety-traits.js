/**
 * SCANTURF VARIETY TRAITS DATABASE v1.0.0
 * 
 * Data sourced from Scanturf/Scangreen official variety guide
 * URL: https://www.scanturf.org
 * Testing: NIBIO Turfgrass Research Group (Norway), Nordic trial network
 * 
 * Rating Scale: 1-9 where higher = better (except relative growth rate)
 * Mowing height: 10-40mm (lawn/sports turf)
 * 
 * Key traits for Nordic conditions:
 * - Winter hardiness (critical)
 * - Gray snow mold resistance (Typhula)
 * - Microdochium patch resistance (Fusarium)
 * - Wear tolerance under cold conditions
 * 
 * @author Gilba Solutions
 * @version 1.0.0
 * @source Scanturf variety guide, updated April 2025
 */

(function(global) {
    'use strict';


    const SCANTURF_VARIETIES = {
        
        perennialRyegrass: {
            
            // ═══════════════════════════════════════════════════════════════════
            // TOP RATED VARIETIES (General impression ≥ 6.0)
            // ═══════════════════════════════════════════════════════════════════
            
            'Saila': {
                species: 'perennialRyegrass',
                displayName: 'Saila',
                region: 'Scandinavia',
                status: 'new',
                
                scanturfRatings: {
                    generalImpression: 6.3,
                    generalImpression10_20mm: 6.3,
                    wearTolerance: 7.8,          // Excellent
                    recovery: 3.8,
                    density: 6.4,
                    leafFineness: 5.7,
                    color: 4.5,
                    winterColor: 5.3,
                    winterHardiness: 5.1,
                    redThreadResistance: 3.7,
                    relativeGrowthRate: 107
                },
                source: 'Scanturf April 2025',
                
                traits: {
                    wear: {
                        multiplier: 0.78,        // 7.8/10 scale converted
                        confidence: 'high',
                        source: 'Scanturf - Wear tolerance 7.8'
                    },
                    recovery: {
                        multiplier: 1.15,        // Below average
                        confidence: 'high',
                        source: 'Scanturf - Recovery 3.8'
                    },
                    cold: {
                        winterHardiness: 5.1,
                        confidence: 'high',
                        source: 'Scanturf Nordic trials'
                    },
                    disease: {
                        redThread: {
                            riskMultiplier: 1.20,
                            confidence: 'high',
                            source: 'Scanturf - Red thread resistance 3.7'
                        }
                    }
                }
            },
            
            'Eventus': {
                species: 'perennialRyegrass',
                displayName: 'Eventus',
                region: 'Scandinavia',
                
                scanturfRatings: {
                    generalImpression: 6.3,
                    wearTolerance: 6.9,
                    recovery: 4.0,
                    density: 6.4,
                    leafFineness: 6.2,
                    color: 4.8,
                    winterColor: 5.7,
                    winterHardiness: 5.2,
                    graySnowMoldResistance: 5.0,
                    microdochiumResistance: 5.0,
                    rustResistance: 4.9,
                    redThreadResistance: 3.4,
                    relativeGrowthRate: 98
                },
                source: 'Scanturf April 2025',
                
                traits: {
                    wear: {
                        multiplier: 0.83,
                        confidence: 'high',
                        source: 'Scanturf - Wear tolerance 6.9'
                    },
                    cold: {
                        winterHardiness: 5.2,
                        confidence: 'high'
                    },
                    disease: {
                        snowMould: {
                            riskMultiplier: 1.0,
                            confidence: 'high',
                            source: 'Gray snow mold 5.0'
                        },
                        fusarium: {
                            riskMultiplier: 1.0,
                            confidence: 'high',
                            source: 'Microdochium 5.0'
                        },
                        redThread: {
                            riskMultiplier: 1.25,
                            confidence: 'high'
                        }
                    }
                }
            },
            
            'Tetrastar': {
                species: 'perennialRyegrass',
                displayName: 'Tetrastar (4x)',
                region: 'Scandinavia',
                type: 'tetraploid',
                
                scanturfRatings: {
                    generalImpression: 6.3,
                    density: 6.3,
                    leafFineness: 5.2,
                    color: 6.8,
                    winterColor: 6.8,
                    winterHardiness: 5.1,
                    microdochiumResistance: 5.2,
                    rustResistance: 5.0,
                    redThreadResistance: 3.3,
                    relativeGrowthRate: 112
                },
                source: 'Scanturf April 2025',
                
                traits: {
                    wear: {
                        multiplier: 0.90,
                        confidence: 'medium',
                        source: 'Tetraploid - wear data limited'
                    },
                    cold: {
                        winterHardiness: 5.1,
                        confidence: 'high'
                    },
                    establishment: {
                        speed: 'fast',
                        lowTempGermination: true,
                        source: '4turf tetraploid'
                    }
                }
            },
            
            'Roseanne': {
                species: 'perennialRyegrass',
                displayName: 'Roseanne',
                region: 'Scandinavia',
                status: 'new',
                
                scanturfRatings: {
                    generalImpression: 6.2,
                    wearTolerance: 7.1,
                    recovery: 5.8,               // Good recovery
                    density: 6.6,
                    leafFineness: 5.8,
                    color: 4.7,
                    winterColor: 4.9,
                    winterHardiness: 5.0,
                    redThreadResistance: 3.3,
                    relativeGrowthRate: 96
                },
                source: 'Scanturf April 2025',
                
                traits: {
                    wear: {
                        multiplier: 0.82,
                        confidence: 'high',
                        source: 'Scanturf - Wear 7.1, Recovery 5.8'
                    },
                    recovery: {
                        multiplier: 0.88,        // Good
                        confidence: 'high'
                    }
                }
            },
            
            'Monroe': {
                species: 'perennialRyegrass',
                displayName: 'Monroe',
                region: 'Scandinavia',
                
                scanturfRatings: {
                    generalImpression: 6.1,
                    wearTolerance: 7.2,
                    recovery: 3.1,
                    density: 6.2,
                    leafFineness: 5.7,
                    color: 5.3,
                    winterColor: 6.0,
                    winterHardiness: 4.8,
                    microdochiumResistance: 4.8,
                    rustResistance: 4.9,
                    redThreadResistance: 3.3,
                    relativeGrowthRate: 100
                },
                source: 'Scanturf April 2025',
                
                traits: {
                    wear: {
                        multiplier: 0.81,
                        confidence: 'high',
                        source: 'Scanturf - Wear 7.2'
                    },
                    recovery: {
                        multiplier: 1.25,        // Poor recovery
                        confidence: 'high'
                    }
                }
            },
            
            'Annecy': {
                species: 'perennialRyegrass',
                displayName: 'Annecy',
                region: 'Scandinavia',
                
                scanturfRatings: {
                    generalImpression: 6.1,
                    wearTolerance: 7.3,
                    recovery: 3.5,
                    density: 5.9,
                    leafFineness: 6.0,
                    color: 4.8,
                    winterColor: 5.4,
                    winterHardiness: 5.0,
                    microdochiumResistance: 5.1,
                    rustResistance: 5.0,
                    redThreadResistance: 3.3,
                    relativeGrowthRate: 95
                },
                source: 'Scanturf April 2025',
                
                traits: {
                    wear: {
                        multiplier: 0.80,
                        confidence: 'high',
                        source: 'Scanturf - Wear 7.3'
                    }
                }
            },
            
            'Mandalay': {
                species: 'perennialRyegrass',
                displayName: 'Mandalay',
                region: 'Scandinavia',
                
                scanturfRatings: {
                    generalImpression: 6.1,
                    density: 6.3,
                    leafFineness: 5.5,
                    color: 4.7,
                    winterColor: 5.7,
                    winterHardiness: 4.9,
                    graySnowMoldResistance: 3.3,
                    microdochiumResistance: 5.1,
                    rustResistance: 5.1,
                    redThreadResistance: 3.9,
                    relativeGrowthRate: 96
                },
                source: 'Scanturf April 2025',
                
                traits: {
                    disease: {
                        snowMould: {
                            riskMultiplier: 1.30,
                            confidence: 'high',
                            source: 'Gray snow mold 3.3 - susceptible'
                        }
                    }
                }
            },
            
            'Fabian': {
                species: 'perennialRyegrass',
                displayName: 'Fabian (4x)',
                region: 'Scandinavia',
                type: 'tetraploid',
                
                scanturfRatings: {
                    generalImpression: 6.1,
                    wearTolerance: 6.2,
                    density: 6.0,
                    leafFineness: 5.2,
                    color: 5.8,
                    winterColor: 6.1,
                    winterHardiness: 5.5,        // Good for tetraploid
                    microdochiumResistance: 5.2,
                    drechsleraResistance: 5.0,
                    redThreadResistance: 3.5,
                    relativeGrowthRate: 101
                },
                source: 'Scanturf April 2025',
                
                traits: {
                    wear: {
                        multiplier: 0.87,
                        confidence: 'high',
                        source: 'Scanturf - Wear 6.2 (tetraploid)'
                    },
                    cold: {
                        winterHardiness: 5.5,
                        confidence: 'high',
                        source: 'Best winter hardiness among tetraploids'
                    },
                    establishment: {
                        speed: 'very fast',
                        lowTempGermination: true
                    }
                }
            },
            
            'Clementine': {
                species: 'perennialRyegrass',
                displayName: 'Clementine',
                region: 'Scandinavia',
                
                scanturfRatings: {
                    generalImpression: 6.1,
                    density: 6.4,
                    leafFineness: 6.1,
                    color: 4.7,
                    winterColor: 5.7,
                    winterHardiness: 5.0,
                    graySnowMoldResistance: 5.0,
                    microdochiumResistance: 5.1,
                    rustResistance: 2.5,         // Poor rust resistance
                    redThreadResistance: 3.5,
                    relativeGrowthRate: 100
                },
                source: 'Scanturf April 2025',
                
                traits: {
                    disease: {
                        rust: {
                            riskMultiplier: 1.60,
                            confidence: 'high',
                            source: 'Rust resistance 2.5 - very susceptible'
                        }
                    }
                }
            },
            
            'Amie': {
                species: 'perennialRyegrass',
                displayName: 'Amie',
                region: 'Scandinavia',
                status: 'new',
                
                scanturfRatings: {
                    generalImpression: 6.0,
                    wearTolerance: 6.9,
                    recovery: 5.9,               // Good recovery
                    density: 6.6,
                    leafFineness: 6.2,
                    color: 4.6,
                    winterColor: 5.3,
                    winterHardiness: 4.9,
                    redThreadResistance: 3.4,
                    relativeGrowthRate: 100
                },
                source: 'Scanturf April 2025 - New varieties',
                
                traits: {
                    wear: {
                        multiplier: 0.83,
                        confidence: 'high'
                    },
                    recovery: {
                        multiplier: 0.87,
                        confidence: 'high',
                        source: 'Recovery 5.9 - good'
                    }
                }
            },
            
            'Bargold': {
                species: 'perennialRyegrass',
                displayName: 'Bargold',
                region: 'Scandinavia',
                
                scanturfRatings: {
                    generalImpression: 6.0,
                    wearTolerance: 6.6,
                    recovery: 5.6,               // Good recovery
                    density: 6.3,
                    leafFineness: 6.0,
                    color: 4.8,
                    winterColor: 5.6,
                    winterHardiness: 4.9,
                    graySnowMoldResistance: 4.5,
                    microdochiumResistance: 5.0,
                    rustResistance: 5.0,
                    drechsleraResistance: 6.0,
                    redThreadResistance: 3.5,
                    relativeGrowthRate: 100
                },
                source: 'Scanturf April 2025',
                
                traits: {
                    wear: {
                        multiplier: 0.85,
                        confidence: 'high'
                    },
                    recovery: {
                        multiplier: 0.90,
                        confidence: 'high'
                    },
                    disease: {
                        drechslera: {
                            riskMultiplier: 0.85,
                            confidence: 'high',
                            source: 'Drechslera resistance 6.0 - good'
                        }
                    }
                }
            },
            
            'Gildara': {
                species: 'perennialRyegrass',
                displayName: 'Gildara',
                region: 'Scandinavia',
                
                scanturfRatings: {
                    generalImpression: 6.0,
                    wearTolerance: 5.6,
                    recovery: 4.0,
                    density: 6.1,
                    leafFineness: 6.1,
                    color: 4.8,
                    winterColor: 5.6,
                    winterHardiness: 4.9,
                    microdochiumResistance: 4.9,
                    redThreadResistance: 3.3,
                    relativeGrowthRate: 101
                },
                source: 'Scanturf April 2025',
                
                traits: {
                    wear: {
                        multiplier: 0.92,
                        confidence: 'high',
                        source: 'Scanturf - Wear 5.6 (below average)'
                    }
                }
            },
            
            // ═══════════════════════════════════════════════════════════════════
            // MID-RATED VARIETIES (5.0-5.9)
            // ═══════════════════════════════════════════════════════════════════
            
            'Acapulco': {
                species: 'perennialRyegrass',
                displayName: 'Acapulco',
                region: 'Scandinavia',
                status: 'new',
                
                scanturfRatings: {
                    generalImpression: 5.9,
                    wearTolerance: 7.0,
                    recovery: 2.2,               // Poor recovery
                    density: 6.5,
                    leafFineness: 5.9,
                    color: 4.8,
                    winterColor: 5.3,
                    winterHardiness: 4.9,
                    graySnowMoldResistance: 4.5,
                    microdochiumResistance: 5.0,
                    rustResistance: 5.0,
                    drechsleraResistance: 6.0,
                    redThreadResistance: 3.2,
                    relativeGrowthRate: 90
                },
                source: 'Scanturf April 2025',
                
                traits: {
                    wear: {
                        multiplier: 0.82,
                        confidence: 'high'
                    },
                    recovery: {
                        multiplier: 1.40,        // Very poor
                        confidence: 'high',
                        source: 'Recovery 2.2 - poor'
                    }
                }
            },
            
            'Eurocordus': {
                species: 'perennialRyegrass',
                displayName: 'Eurocordus',
                region: 'Scandinavia',
                
                scanturfRatings: {
                    generalImpression: 5.9,
                    wearTolerance: 7.1,
                    density: 6.1,
                    leafFineness: 5.7,
                    color: 4.7,
                    winterColor: 5.2,
                    winterHardiness: 4.9,
                    microdochiumResistance: 5.1,
                    drechsleraResistance: 5.7,
                    redThreadResistance: 3.3,
                    relativeGrowthRate: 107
                },
                source: 'Scanturf April 2025',
                
                traits: {
                    wear: {
                        multiplier: 0.82,
                        confidence: 'high'
                    }
                }
            },
            
            'Eurocool': {
                species: 'perennialRyegrass',
                displayName: 'Eurocool',
                region: 'Scandinavia',
                
                scanturfRatings: {
                    generalImpression: 5.9,
                    wearTolerance: 7.0,
                    recovery: 3.5,
                    density: 6.0,
                    leafFineness: 5.3,
                    color: 4.8,
                    winterColor: 4.9,
                    winterHardiness: 4.9,
                    microdochiumResistance: 5.0,
                    redThreadResistance: 3.3,
                    relativeGrowthRate: 100
                },
                source: 'Scanturf April 2025',
                
                traits: {
                    wear: {
                        multiplier: 0.82,
                        confidence: 'high'
                    }
                }
            },
            
            'Double': {
                species: 'perennialRyegrass',
                displayName: 'Double (4x)',
                region: 'Scandinavia',
                type: 'tetraploid',
                
                scanturfRatings: {
                    generalImpression: 5.6,
                    density: 5.5,
                    leafFineness: 4.5,
                    color: 6.1,
                    winterColor: 6.0,
                    winterHardiness: 5.8,        // Best winter hardiness
                    graySnowMoldResistance: 6.2, // Excellent
                    microdochiumResistance: 5.0,
                    rustResistance: 4.5,
                    redThreadResistance: 4.6,
                    relativeGrowthRate: 121
                },
                source: 'Scanturf April 2025',
                
                traits: {
                    cold: {
                        winterHardiness: 5.8,
                        confidence: 'high',
                        source: 'Best winter hardiness of all varieties'
                    },
                    disease: {
                        snowMould: {
                            riskMultiplier: 0.70,
                            confidence: 'high',
                            source: 'Gray snow mold 6.2 - excellent resistance'
                        },
                        redThread: {
                            riskMultiplier: 0.90,
                            confidence: 'high',
                            source: 'Red thread 4.6 - best among tested'
                        }
                    }
                }
            },
            
            'Columbine': {
                species: 'perennialRyegrass',
                displayName: 'Columbine',
                region: 'Scandinavia',
                
                scanturfRatings: {
                    generalImpression: 5.7,
                    wearTolerance: 6.9,
                    density: 6.2,
                    leafFineness: 5.7,
                    color: 4.8,
                    winterColor: 5.5,
                    winterHardiness: 4.9,
                    microdochiumResistance: 5.1,
                    drechsleraResistance: 6.0,
                    redThreadResistance: 3.5,
                    relativeGrowthRate: 103
                },
                source: 'Scanturf April 2025',
                
                traits: {
                    wear: {
                        multiplier: 0.83,
                        confidence: 'high'
                    }
                }
            },
            
            'Zurich': {
                species: 'perennialRyegrass',
                displayName: 'Zurich',
                region: 'Scandinavia',
                
                scanturfRatings: {
                    generalImpression: 5.4,
                    wearTolerance: 7.4,          // Excellent
                    recovery: 3.6,
                    density: 5.7,
                    leafFineness: 4.9,
                    color: 4.9,
                    winterColor: 5.7,
                    winterHardiness: 4.9,
                    graySnowMoldResistance: 5.0,
                    microdochiumResistance: 4.6,
                    rustResistance: 5.1,
                    redThreadResistance: 3.7,
                    relativeGrowthRate: 96
                },
                source: 'Scanturf April 2025',
                
                traits: {
                    wear: {
                        multiplier: 0.79,
                        confidence: 'high',
                        source: 'Wear 7.4 - excellent'
                    }
                }
            },
            
            'Mumbai': {
                species: 'perennialRyegrass',
                displayName: 'Mumbai',
                region: 'Scandinavia',
                
                scanturfRatings: {
                    generalImpression: 6.1,
                    wearTolerance: 7.7,          // Best wear
                    recovery: 3.2,
                    density: 6.7,
                    leafFineness: 6.3,
                    color: 4.7,
                    winterColor: 5.4,
                    winterHardiness: 4.9,
                    microdochiumResistance: 4.9,
                    redThreadResistance: 3.2,
                    relativeGrowthRate: 91.6
                },
                source: 'Scanturf April 2025',
                
                traits: {
                    wear: {
                        multiplier: 0.77,
                        confidence: 'high',
                        source: 'Wear 7.7 - top rated'
                    }
                }
            },
            
            'Dickens': {
                species: 'perennialRyegrass',
                displayName: 'Dickens',
                region: 'Scandinavia',
                
                scanturfRatings: {
                    generalImpression: 5.3,
                    wearTolerance: 7.6,          // Excellent
                    density: 5.7,
                    leafFineness: 5.2,
                    color: 4.7,
                    winterColor: 5.3,
                    winterHardiness: 4.6,
                    microdochiumResistance: 5.6,
                    relativeGrowthRate: 117
                },
                source: 'Scanturf April 2025',
                
                traits: {
                    wear: {
                        multiplier: 0.78,
                        confidence: 'high',
                        source: 'Wear 7.6 - excellent for cricket'
                    },
                    disease: {
                        fusarium: {
                            riskMultiplier: 0.88,
                            confidence: 'high',
                            source: 'Microdochium 5.6 - good'
                        }
                    }
                }
            },
            
            'Promotor': {
                species: 'perennialRyegrass',
                displayName: 'Promotor',
                region: 'Scandinavia',
                
                scanturfRatings: {
                    generalImpression: 5.3,
                    wearTolerance: 7.3,
                    density: 5.8,
                    leafFineness: 5.2,
                    color: 5.1,
                    winterColor: 5.3,
                    winterHardiness: 5.0,
                    microdochiumResistance: 5.2,
                    relativeGrowthRate: 98
                },
                source: 'Scanturf April 2025',
                
                traits: {
                    wear: {
                        multiplier: 0.80,
                        confidence: 'high'
                    }
                }
            },
            
            // ═══════════════════════════════════════════════════════════════════
            // TETRAPLOID RECOVERY SPECIALISTS
            // ═══════════════════════════════════════════════════════════════════
            
            'Double Time': {
                species: 'perennialRyegrass',
                displayName: 'Double Time (4x)',
                region: 'Scandinavia',
                type: 'tetraploid',
                
                scanturfRatings: {
                    generalImpression: 3.5,
                    wearTolerance: 4.6,
                    recovery: 7.2,               // Best recovery
                    density: 2.9,
                    leafFineness: 3.0,
                    color: 6.6,
                    winterColor: 5.9,
                    winterHardiness: 5.2,
                    microdochiumResistance: 5.3,
                    redThreadResistance: 4.2,
                    relativeGrowthRate: 97.2
                },
                source: 'Scanturf April 2025',
                
                traits: {
                    wear: {
                        multiplier: 1.10,        // Poor wear
                        confidence: 'high'
                    },
                    recovery: {
                        multiplier: 0.70,        // Excellent recovery
                        confidence: 'high',
                        source: 'Recovery 7.2 - best of all varieties'
                    }
                }
            },
            
            'Tetrasun': {
                species: 'perennialRyegrass',
                displayName: 'Tetrasun (4x)',
                region: 'Scandinavia',
                type: 'tetraploid',
                status: 'new',
                
                scanturfRatings: {
                    generalImpression: 5.8,
                    wearTolerance: 6.5,
                    recovery: 6.9,               // Excellent recovery
                    density: 5.6,
                    leafFineness: 5.1,
                    color: 6.2,
                    winterColor: 5.5,
                    winterHardiness: 5.0,
                    redThreadResistance: 3.8,
                    relativeGrowthRate: 100
                },
                source: 'Scanturf April 2025',
                
                traits: {
                    wear: {
                        multiplier: 0.86,
                        confidence: 'high'
                    },
                    recovery: {
                        multiplier: 0.75,        // Very good
                        confidence: 'high'
                    }
                }
            },
            
            'Top Gun': {
                species: 'perennialRyegrass',
                displayName: 'Top Gun',
                region: 'Scandinavia',
                
                scanturfRatings: {
                    generalImpression: 4.5,
                    wearTolerance: 6.0,
                    recovery: 6.4,               // Good recovery
                    density: 4.2,
                    leafFineness: 3.9,
                    color: 5.1,
                    winterColor: 5.9,
                    winterHardiness: 4.8,
                    microdochiumResistance: 5.0,
                    redThreadResistance: 4.0,
                    relativeGrowthRate: 107.5
                },
                source: 'Scanturf April 2025',
                
                traits: {
                    recovery: {
                        multiplier: 0.80,
                        confidence: 'high',
                        source: 'Recovery 6.4 - good'
                    }
                }
            },
            
            'Confidence': {
                species: 'perennialRyegrass',
                displayName: 'Confidence',
                region: 'Scandinavia',
                
                scanturfRatings: {
                    generalImpression: 5.0,
                    wearTolerance: 6.6,
                    recovery: 6.0,               // Good recovery
                    density: 5.3,
                    leafFineness: 4.9,
                    color: 5.8,
                    winterColor: 6.2,
                    winterHardiness: 4.7,
                    microdochiumResistance: 5.2,
                    redThreadResistance: 3.8,
                    relativeGrowthRate: 92.6
                },
                source: 'Scanturf April 2025',
                
                traits: {
                    recovery: {
                        multiplier: 0.85,
                        confidence: 'high'
                    }
                }
            }
        },

        // ═══════════════════════════════════════════════════════════════════════
        // CREEPING BENTGRASS (Agrostis stolonifera) - SCANGREEN Greens Trials
        // Southern Scandinavia putting green conditions, 3mm mowing height
        // ═══════════════════════════════════════════════════════════════════════
        
        creepingBentgrass: {
            
            'Match Play': {
                species: 'creepingBentgrass',
                displayName: 'Match Play',
                region: 'Scandinavia',
                
                scangreenRatings: {
                    generalImpression: 6.7,
                    density: 7.7,
                    leafFineness: 6.2,
                    color: 5.7,
                    winterColor: 5.1,
                    winterHardiness: 6.6,
                    pinkSnowMoldResistance: 5.9,
                    inSeasonDiseaseResistance: 6.5,
                    microdochiumResistance: 6.0,
                    redThreadResistance: 6.0,
                    takeAllPatchResistance: 6.0,
                    relativeGrowthRate: 93
                },
                source: 'Scangreen April 2025 - Southern Zone',
                
                traits: {
                    density: {
                        multiplier: 0.80,
                        confidence: 'high',
                        source: 'Density 7.7 - top rated'
                    },
                    cold: {
                        winterHardiness: 6.6,
                        confidence: 'high'
                    },
                    disease: {
                        fusarium: {
                            riskMultiplier: 0.90,
                            confidence: 'high',
                            source: 'Microdochium 6.0'
                        }
                    }
                }
            },
            
            'L-93 XD': {
                species: 'creepingBentgrass',
                displayName: 'L-93 XD',
                region: 'Scandinavia',
                
                scangreenRatings: {
                    generalImpression: 6.5,
                    density: 7.5,
                    leafFineness: 6.3,
                    color: 5.7,
                    winterColor: 5.3,
                    winterHardiness: 6.7,
                    pinkSnowMoldResistance: 6.1,
                    inSeasonDiseaseResistance: 6.5,
                    microdochiumResistance: 6.0,
                    redThreadResistance: 6.0,
                    takeAllPatchResistance: 6.0,
                    relativeGrowthRate: 90.4
                },
                source: 'Scangreen April 2025 - Best winter hardiness',
                
                traits: {
                    cold: {
                        winterHardiness: 6.7,
                        confidence: 'high',
                        source: 'Best winter hardiness of all bentgrasses'
                    }
                }
            },
            
            'Luminary': {
                species: 'creepingBentgrass',
                displayName: 'Luminary',
                region: 'Scandinavia',
                
                scangreenRatings: {
                    generalImpression: 6.5,
                    density: 7.4,
                    leafFineness: 5.9,
                    color: 5.8,
                    winterColor: 5.4,
                    winterHardiness: 6.6,
                    pinkSnowMoldResistance: 5.9,
                    graySnowMoldResistance: 6.0,
                    inSeasonDiseaseResistance: 6.5,
                    microdochiumResistance: 6.0,
                    relativeGrowthRate: 99
                },
                source: 'Scangreen April 2025',
                
                traits: {
                    cold: {
                        winterHardiness: 6.6,
                        confidence: 'high'
                    }
                }
            },
            
            'Piranha': {
                species: 'creepingBentgrass',
                displayName: 'Piranha',
                region: 'Scandinavia',
                
                scangreenRatings: {
                    generalImpression: 6.5,
                    density: 7.5,
                    leafFineness: 6.2,
                    color: 5.8,
                    winterColor: 5.3,
                    winterHardiness: 6.6,
                    pinkSnowMoldResistance: 6.0,
                    inSeasonDiseaseResistance: 6.4,
                    relativeGrowthRate: 94
                },
                source: 'Scangreen April 2025',
                
                traits: {
                    cold: {
                        winterHardiness: 6.6,
                        confidence: 'high'
                    }
                }
            },
            
            '777': {
                species: 'creepingBentgrass',
                displayName: '777 Triple Seven',
                region: 'Scandinavia',
                
                scangreenRatings: {
                    generalImpression: 6.3,
                    density: 7.4,
                    leafFineness: 6.3,
                    color: 5.8,
                    winterColor: 5.1,
                    winterHardiness: 6.6,
                    pinkSnowMoldResistance: 6.1,
                    inSeasonDiseaseResistance: 6.4,
                    relativeGrowthRate: 98
                },
                source: 'Scangreen April 2025',
                
                traits: {
                    cold: {
                        winterHardiness: 6.6,
                        confidence: 'high'
                    }
                }
            },
            
            '007': {
                species: 'creepingBentgrass',
                displayName: '007',
                region: 'Scandinavia',
                
                scangreenRatings: {
                    generalImpression: 6.2,
                    density: 7.4,
                    leafFineness: 6.0,
                    color: 6.0,
                    winterColor: 5.4,
                    winterHardiness: 6.6,
                    pinkSnowMoldResistance: 6.1,
                    graySnowMoldResistance: 5.6,
                    inSeasonDiseaseResistance: 6.6,
                    relativeGrowthRate: 104
                },
                source: 'Scangreen April 2025',
                
                traits: {
                    cold: {
                        winterHardiness: 6.6,
                        confidence: 'high'
                    },
                    disease: {
                        general: {
                            riskMultiplier: 0.88,
                            confidence: 'high',
                            source: 'Best in-season disease resistance 6.6'
                        }
                    }
                }
            },
            
            'Piper': {
                species: 'creepingBentgrass',
                displayName: 'Piper',
                region: 'Scandinavia',
                status: 'new',
                
                scangreenRatings: {
                    generalImpression: 6.4,
                    density: 7.6,
                    leafFineness: 6.3,
                    color: 5.7,
                    winterColor: 5.2,
                    winterHardiness: 6.8,
                    pinkSnowMoldResistance: 6.1
                },
                source: 'Scangreen April 2025 - New variety',
                
                traits: {
                    cold: {
                        winterHardiness: 6.8,
                        confidence: 'medium',
                        source: 'New variety - promising winter hardiness'
                    }
                }
            },
            
            '007XL': {
                species: 'creepingBentgrass',
                displayName: '007XL',
                region: 'Scandinavia',
                status: 'new',
                
                scangreenRatings: {
                    generalImpression: 6.2,
                    density: 7.4,
                    leafFineness: 6.3,
                    color: 5.7,
                    winterColor: 5.2,
                    winterHardiness: 6.6
                },
                source: 'Scangreen April 2025 - New variety',
                
                traits: {
                    cold: {
                        winterHardiness: 6.6,
                        confidence: 'medium'
                    }
                }
            },
            
            'Declaration': {
                species: 'creepingBentgrass',
                displayName: 'Declaration',
                region: 'Scandinavia',
                
                scangreenRatings: {
                    generalImpression: 6.0,
                    density: 6.9,
                    leafFineness: 6.4,
                    color: 5.4,
                    winterColor: 5.7,
                    winterHardiness: 7.2,
                    inSeasonDiseaseResistance: 6.5,
                    relativeGrowthRate: 100
                },
                source: 'Scangreen April 2025 - Best winter hardiness',
                
                traits: {
                    cold: {
                        winterHardiness: 7.2,
                        confidence: 'high',
                        source: 'Best winter hardiness 7.2'
                    }
                }
            },
            
            'Pure Distinction': {
                species: 'creepingBentgrass',
                displayName: 'Pure Distinction',
                region: 'Scandinavia',
                
                scangreenRatings: {
                    generalImpression: 5.9,
                    density: 7.3,
                    leafFineness: 6.3,
                    color: 5.2,
                    winterColor: 4.7,
                    winterHardiness: 6.3,
                    pinkSnowMoldResistance: 5.6,
                    graySnowMoldResistance: 6.0,
                    inSeasonDiseaseResistance: 6.4,
                    relativeGrowthRate: 93
                },
                source: 'Scangreen April 2025',
                
                traits: {
                    cold: {
                        winterHardiness: 6.3,
                        confidence: 'high',
                        source: 'Below average winter hardiness'
                    },
                    disease: {
                        dollarSpot: {
                            riskMultiplier: 1.80,
                            confidence: 'high',
                            source: 'NTEP - highly susceptible'
                        }
                    }
                }
            },
            
            'Pure Select': {
                species: 'creepingBentgrass',
                displayName: 'Pure Select',
                region: 'Scandinavia',
                
                scangreenRatings: {
                    generalImpression: 5.4,
                    density: 6.7,
                    leafFineness: 6.3,
                    color: 5.7,
                    winterColor: 4.5,
                    winterHardiness: 6.0,
                    pinkSnowMoldResistance: 5.3,
                    inSeasonDiseaseResistance: 6.3,
                    relativeGrowthRate: 98
                },
                source: 'Scangreen April 2025',
                
                traits: {
                    cold: {
                        winterHardiness: 6.0,
                        confidence: 'high',
                        source: 'Poor winter hardiness - not recommended for Nordic'
                    },
                    disease: {
                        snowMould: {
                            riskMultiplier: 1.35,
                            confidence: 'high',
                            source: 'Pink snow mold 5.3 - susceptible'
                        }
                    }
                }
            },
            
            'Focus': {
                species: 'creepingBentgrass',
                displayName: 'Focus',
                region: 'Scandinavia',
                
                scangreenRatings: {
                    generalImpression: 5.7,
                    density: 6.8,
                    leafFineness: 5.8,
                    color: 6.0,
                    winterColor: 4.5,
                    winterHardiness: 6.7,
                    pinkSnowMoldResistance: 6.0,
                    graySnowMoldResistance: 5.8,
                    inSeasonDiseaseResistance: 6.3,
                    redThreadResistance: 5.6,
                    relativeGrowthRate: 98
                },
                source: 'Scangreen April 2025',
                
                traits: {
                    cold: {
                        winterHardiness: 6.7,
                        confidence: 'high'
                    }
                }
            }
        },
        
        // ═══════════════════════════════════════════════════════════════════════
        // KENTUCKY BLUEGRASS / SMOOTH MEADOWGRASS (Poa pratensis)
        // SCANTURF lawn/sports trials, 10-40mm mowing height
        // ═══════════════════════════════════════════════════════════════════════
        
        kentuckyBluegrass: {
            
            'Arya': {
                species: 'kentuckyBluegrass',
                displayName: 'Arya',
                region: 'Scandinavia',
                status: 'new',
                
                scanturfRatings: {
                    generalImpression: 6.2,
                    wearTolerance: 4.3,
                    recovery: 4.8,
                    density: 6.7,
                    leafFineness: 6.2,
                    color: 6.0,
                    winterColor: 4.8,
                    winterHardiness: 8.0,
                    microdochiumResistance: 6.1,
                    redThreadResistance: 5.0,
                    relativeGrowthRate: 96
                },
                source: 'Scanturf April 2025',
                
                traits: {
                    wear: {
                        multiplier: 1.15,
                        confidence: 'high',
                        source: 'Wear 4.3 - KBG has lower wear than PRG'
                    },
                    cold: {
                        winterHardiness: 8.0,
                        confidence: 'high',
                        source: 'Excellent winter hardiness'
                    }
                }
            },
            
            'Julius': {
                species: 'kentuckyBluegrass',
                displayName: 'Julius',
                region: 'Scandinavia',
                
                scanturfRatings: {
                    generalImpression: 6.1,
                    density: 6.0,
                    leafFineness: 5.3,
                    color: 5.4,
                    winterColor: 4.8,
                    winterHardiness: 7.8,
                    microdochiumResistance: 5.8,
                    redThreadResistance: 4.8,
                    relativeGrowthRate: 94
                },
                source: 'Scanturf April 2025',
                
                traits: {
                    cold: {
                        winterHardiness: 7.8,
                        confidence: 'high'
                    }
                }
            },
            
            'Becca': {
                species: 'kentuckyBluegrass',
                displayName: 'Becca',
                region: 'Scandinavia',
                
                scanturfRatings: {
                    generalImpression: 6.1,
                    wearTolerance: 5.2,
                    recovery: 2.8,
                    density: 6.2,
                    leafFineness: 5.6,
                    color: 6.0,
                    winterColor: 5.0,
                    winterHardiness: 8.0,
                    microdochiumResistance: 6.0,
                    rustResistance: 4.6,
                    redThreadResistance: 5.0,
                    relativeGrowthRate: 95
                },
                source: 'Scanturf April 2025',
                
                traits: {
                    wear: {
                        multiplier: 1.08,
                        confidence: 'high',
                        source: 'Wear 5.2'
                    },
                    recovery: {
                        multiplier: 1.35,
                        confidence: 'high',
                        source: 'Recovery 2.8 - poor'
                    },
                    cold: {
                        winterHardiness: 8.0,
                        confidence: 'high'
                    }
                }
            },
            
            'Traction': {
                species: 'kentuckyBluegrass',
                displayName: 'Traction',
                region: 'Scandinavia',
                
                scanturfRatings: {
                    generalImpression: 6.0,
                    wearTolerance: 5.4,
                    recovery: 7.2,
                    density: 6.1,
                    leafFineness: 5.7,
                    color: 6.0,
                    winterColor: 4.9,
                    winterHardiness: 8.0,
                    microdochiumResistance: 6.0,
                    rustResistance: 4.4,
                    redThreadResistance: 5.0,
                    relativeGrowthRate: 96
                },
                source: 'Scanturf April 2025',
                
                traits: {
                    wear: {
                        multiplier: 1.05,
                        confidence: 'high',
                        source: 'Wear 5.4'
                    },
                    recovery: {
                        multiplier: 0.75,
                        confidence: 'high',
                        source: 'Recovery 7.2 - excellent for KBG'
                    },
                    cold: {
                        winterHardiness: 8.0,
                        confidence: 'high'
                    }
                }
            },
            
            'Limousine': {
                species: 'kentuckyBluegrass',
                displayName: 'Limousine',
                region: 'Scandinavia',
                
                scanturfRatings: {
                    generalImpression: 6.0,
                    wearTolerance: 5.6,
                    recovery: 4.0,
                    density: 6.1,
                    leafFineness: 5.4,
                    color: 6.0,
                    winterColor: 4.9,
                    winterHardiness: 8.0,
                    graySnowMoldResistance: 7.0,
                    microdochiumResistance: 6.0,
                    rustResistance: 4.0,
                    drechsleraResistance: 5.5,
                    redThreadResistance: 5.0,
                    dollarSpotResistance: 5.0,
                    relativeGrowthRate: 96
                },
                source: 'Scanturf April 2025',
                
                traits: {
                    wear: {
                        multiplier: 1.03,
                        confidence: 'high',
                        source: 'Wear 5.6 - good for KBG'
                    },
                    cold: {
                        winterHardiness: 8.0,
                        confidence: 'high'
                    },
                    disease: {
                        snowMould: {
                            riskMultiplier: 0.80,
                            confidence: 'high',
                            source: 'Gray snow mold 7.0 - excellent'
                        }
                    }
                }
            },
            
            'Dakisha': {
                species: 'kentuckyBluegrass',
                displayName: 'Dakisha',
                region: 'Scandinavia',
                
                scanturfRatings: {
                    generalImpression: 5.9,
                    wearTolerance: 5.5,
                    recovery: 4.4,
                    density: 4.9,
                    leafFineness: 4.5,
                    color: 6.0,
                    winterColor: 4.8,
                    winterHardiness: 7.6,
                    microdochiumResistance: 6.0,
                    rustResistance: 4.5,
                    redThreadResistance: 4.7,
                    relativeGrowthRate: 97
                },
                source: 'Scanturf April 2025',
                
                traits: {
                    wear: {
                        multiplier: 1.04,
                        confidence: 'high'
                    }
                }
            },
            
            'Markus': {
                species: 'kentuckyBluegrass',
                displayName: 'Markus',
                region: 'Scandinavia',
                
                scanturfRatings: {
                    generalImpression: 5.8,
                    wearTolerance: 5.5,
                    density: 5.6,
                    leafFineness: 4.5,
                    color: 6.0,
                    winterColor: 5.4,
                    winterHardiness: 8.0,
                    microdochiumResistance: 5.7,
                    rustResistance: 7.9,
                    relativeGrowthRate: 101
                },
                source: 'Scanturf April 2025',
                
                traits: {
                    disease: {
                        rust: {
                            riskMultiplier: 0.75,
                            confidence: 'high',
                            source: 'Rust 7.9 - excellent resistance'
                        }
                    }
                }
            },
            
            'Yvette': {
                species: 'kentuckyBluegrass',
                displayName: 'Yvette',
                region: 'Scandinavia',
                
                scanturfRatings: {
                    generalImpression: 5.7,
                    wearTolerance: 5.7,
                    density: 5.7,
                    leafFineness: 5.2,
                    color: 6.1,
                    winterColor: 5.2,
                    winterHardiness: 7.8,
                    graySnowMoldResistance: 6.3,
                    microdochiumResistance: 5.6,
                    rustResistance: 4.0,
                    drechsleraResistance: 5.4,
                    redThreadResistance: 5.2,
                    relativeGrowthRate: 95
                },
                source: 'Scanturf April 2025',
                
                traits: {
                    wear: {
                        multiplier: 1.02,
                        confidence: 'high',
                        source: 'Wear 5.7 - good for KBG'
                    }
                }
            },
            
            'Baranello': {
                species: 'kentuckyBluegrass',
                displayName: 'Baranello',
                region: 'Scandinavia',
                breeder: 'Barenbrug',
                
                scanturfRatings: {
                    generalImpression: 5.4,
                    wearTolerance: 5.1,
                    density: 5.1,
                    leafFineness: 4.3,
                    color: 6.7,
                    winterColor: 5.8,
                    winterHardiness: 7.9,
                    microdochiumResistance: 5.9,
                    rustResistance: 8.0,
                    relativeGrowthRate: 105
                },
                source: 'Scanturf April 2025',
                
                traits: {
                    disease: {
                        rust: {
                            riskMultiplier: 0.72,
                            confidence: 'high',
                            source: 'Rust 8.0 - best resistance'
                        }
                    }
                }
            },
            
            'Bluechip': {
                species: 'kentuckyBluegrass',
                displayName: 'Bluechip',
                region: 'Scandinavia',
                
                scanturfRatings: {
                    generalImpression: 4.9,
                    wearTolerance: 4.9,
                    recovery: 4.0,
                    density: 5.3,
                    leafFineness: 3.9,
                    color: 6.1,
                    winterColor: 4.9,
                    winterHardiness: 8.0,
                    microdochiumResistance: 6.2,
                    rustResistance: 4.2,
                    redThreadResistance: 5.0,
                    dollarSpotResistance: 5.5,
                    relativeGrowthRate: 94
                },
                source: 'Scanturf April 2025',
                
                traits: {
                    cold: {
                        winterHardiness: 8.0,
                        confidence: 'high'
                    }
                }
            }
        }
    };

    // ═══════════════════════════════════════════════════════════════════════════
    // HELPER FUNCTIONS
    // ═══════════════════════════════════════════════════════════════════════════

    /**
     * Get Scanturf variety data
     */
    function getScanturfVarietyData(species, variety) {
        // Normalize species key - remove spaces and convert to camelCase
        const speciesKey = species.replace(/\s+/g, '');
        const normalizedKey = speciesKey.charAt(0).toLowerCase() + speciesKey.slice(1);
        
        const speciesData = SCANTURF_VARIETIES[normalizedKey] || SCANTURF_VARIETIES.perennialRyegrass;
        if (!speciesData) return null;
        return speciesData[variety] || null;
    }

    /**
     * Get all Scanturf varieties for dropdown
     */
    function getScanturfRyegrassVarieties() {
        const varieties = [
            { value: 'generic', label: 'Generic / Unknown' }
        ];
        
        // Sort by general impression rating
        const sorted = Object.entries(SCANTURF_VARIETIES.perennialRyegrass)
            .sort((a, b) => (b[1].scanturfRatings?.generalImpression || 0) - (a[1].scanturfRatings?.generalImpression || 0));
        
        sorted.forEach(([name, data]) => {
            const rating = data.scanturfRatings?.generalImpression || '?';
            const type = data.type === 'tetraploid' ? ' (4x)' : '';
            const status = data.status === 'new' ? ' ★' : '';
            
            varieties.push({
                value: name,
                label: `${data.displayName}${status} (${rating})`,
                scanturfRating: rating,
                type: data.type || 'diploid',
                winterHardiness: data.scanturfRatings?.winterHardiness
            });
        });
        
        return varieties;
    }

    /**
     * Get Scanturf creeping bentgrass varieties for dropdown
     */
    function getScanturfBentgrassVarieties() {
        const varieties = [
            { value: 'generic', label: 'Generic / Unknown' }
        ];
        
        if (!SCANTURF_VARIETIES.creepingBentgrass) return varieties;
        
        const sorted = Object.entries(SCANTURF_VARIETIES.creepingBentgrass)
            .sort((a, b) => (b[1].scangreenRatings?.generalImpression || 0) - (a[1].scangreenRatings?.generalImpression || 0));
        
        sorted.forEach(([name, data]) => {
            const rating = data.scangreenRatings?.generalImpression || '?';
            const status = data.status === 'new' ? ' ★' : '';
            const winterHard = data.scangreenRatings?.winterHardiness || 0;
            
            varieties.push({
                value: name,
                label: `${data.displayName}${status} (${rating}) WH:${winterHard}`,
                scangreenRating: rating,
                winterHardiness: winterHard
            });
        });
        
        return varieties;
    }

    /**
     * Get Scanturf Kentucky bluegrass varieties for dropdown
     */
    function getScanturfBluegrassVarieties() {
        const varieties = [
            { value: 'generic', label: 'Generic / Unknown' }
        ];
        
        if (!SCANTURF_VARIETIES.kentuckyBluegrass) return varieties;
        
        const sorted = Object.entries(SCANTURF_VARIETIES.kentuckyBluegrass)
            .sort((a, b) => (b[1].scanturfRatings?.generalImpression || 0) - (a[1].scanturfRatings?.generalImpression || 0));
        
        sorted.forEach(([name, data]) => {
            const rating = data.scanturfRatings?.generalImpression || '?';
            const status = data.status === 'new' ? ' ★' : '';
            const winterHard = data.scanturfRatings?.winterHardiness || 0;
            
            varieties.push({
                value: name,
                label: `${data.displayName}${status} (${rating}) WH:${winterHard}`,
                scanturfRating: rating,
                winterHardiness: winterHard
            });
        });
        
        return varieties;
    }

    /**
     * Get wear multiplier for Scanturf variety
     */
    function getScanturfWearMultiplier(species, variety) {
        const data = getScanturfVarietyData(species, variety);
        if (data?.traits?.wear) {
            return data.traits.wear;
        }
        return { multiplier: 1.0, confidence: 'none', source: 'No Scanturf data' };
    }

    /**
     * Get varieties sorted by winter hardiness
     */
    function getVarietiesByWinterHardiness() {
        return Object.entries(SCANTURF_VARIETIES.perennialRyegrass)
            .filter(([_, d]) => d.scanturfRatings?.winterHardiness)
            .sort((a, b) => b[1].scanturfRatings.winterHardiness - a[1].scanturfRatings.winterHardiness)
            .map(([name, data]) => ({
                name,
                winterHardiness: data.scanturfRatings.winterHardiness,
                type: data.type
            }));
    }

    /**
     * Get varieties with best snow mould resistance
     */
    function getSnowMouldResistantVarieties() {
        return Object.entries(SCANTURF_VARIETIES.perennialRyegrass)
            .filter(([_, d]) => d.scanturfRatings?.graySnowMoldResistance)
            .sort((a, b) => b[1].scanturfRatings.graySnowMoldResistance - a[1].scanturfRatings.graySnowMoldResistance)
            .slice(0, 5)
            .map(([name, data]) => ({
                name,
                rating: data.scanturfRatings.graySnowMoldResistance
            }));
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // EXPORTS
    // ═══════════════════════════════════════════════════════════════════════════

    /**
     * Convert a Scanturf resistance rating (1-9, higher = better) to a
     * disease engine riskMultiplier (1.0 = species average).
     * Rating 9 (best) → 0.70x risk; rating 5 (average) → 1.00x; rating 1 (worst) → 1.50x.
     */
    function scanturfRatingToMultiplier(rating) {
        if (rating == null || isNaN(rating)) return 1.0;
        const multiplier = 1.50 - (rating - 1) * (0.80 / 8);
        return Math.round(multiplier * 100) / 100;
    }

    /**
     * Get disease risk modifier for a Scanturf variety.
     *
     * Priority:
     *   1. Pre-built traits.disease block (structured riskMultiplier)
     *   2. Derived from scanturfRatings resistance scores
     *
     * Supported disease → rating key mappings:
     *   snowMould / fusariumPatch / microdochiumPatch → graySnowMoldResistance
     *   redThread                                    → redThreadResistance
     *   dollarSpot                                   → dollarSpotResistance
     *   rust / crownRust                             → rustResistance
     *
     * @param {string} species
     * @param {string} variety
     * @param {string} disease  - engine disease key
     * @returns {{ riskMultiplier: number, confidence: string, source: string }}
     */
    function getScanturfDiseaseModifier(species, variety, disease) {
        const data = getScanturfVarietyData(species, variety);
        if (!data) {
            return { riskMultiplier: 1.0, confidence: 'none', source: 'Variety not found in Scanturf data' };
        }

        // Pre-built structured disease block takes priority
        if (data.traits && data.traits.disease) {
            const d = data.traits.disease;
            const keyMap = {
                snowMould: 'snowMould', fusariumPatch: 'snowMould',
                microdochiumPatch: 'snowMould', fusarium: 'snowMould',
                redThread: 'redThread',
                dollarSpot: 'dollarSpot',
                rust: 'rust', crownRust: 'rust',
            };
            const mapped = keyMap[disease] || disease;
            if (d[mapped]) {
                return d[mapped];
            }
        }

        // Derive from scanturfRatings
        const ratings = data.scanturfRatings;
        if (!ratings) {
            return { riskMultiplier: 1.0, confidence: 'none', source: 'No Scanturf ratings available' };
        }

        const SCALE = 'Scanturf 1-9 scale (higher = better resistance); converted to riskMultiplier';

        if (disease === 'snowMould' || disease === 'fusariumPatch' ||
            disease === 'microdochiumPatch' || disease === 'fusarium') {
            if (ratings.graySnowMoldResistance != null) {
                return {
                    riskMultiplier: scanturfRatingToMultiplier(ratings.graySnowMoldResistance),
                    confidence: 'medium',
                    source: 'Scanturf gray snow mold resistance ' + ratings.graySnowMoldResistance + '/9. ' + SCALE,
                };
            }
        }

        if (disease === 'redThread') {
            if (ratings.redThreadResistance != null) {
                return {
                    riskMultiplier: scanturfRatingToMultiplier(ratings.redThreadResistance),
                    confidence: 'medium',
                    source: 'Scanturf red thread resistance ' + ratings.redThreadResistance + '/9. ' + SCALE,
                };
            }
        }

        if (disease === 'dollarSpot') {
            if (ratings.dollarSpotResistance != null) {
                return {
                    riskMultiplier: scanturfRatingToMultiplier(ratings.dollarSpotResistance),
                    confidence: 'medium',
                    source: 'Scanturf dollar spot resistance ' + ratings.dollarSpotResistance + '/9. ' + SCALE,
                };
            }
        }

        if (disease === 'rust' || disease === 'crownRust') {
            if (ratings.rustResistance != null) {
                return {
                    riskMultiplier: scanturfRatingToMultiplier(ratings.rustResistance),
                    confidence: 'medium',
                    source: 'Scanturf rust resistance ' + ratings.rustResistance + '/9. ' + SCALE,
                };
            }
        }

        return { riskMultiplier: 1.0, confidence: 'none', source: 'No Scanturf disease data for this disease/variety combination' };
    }

    const ScanturfVarieties = {
        version: '1.0.0',
        SCANTURF_VARIETIES,
        getScanturfVarietyData,
        getScanturfRyegrassVarieties,
        getScanturfWearMultiplier,
        getVarietiesByWinterHardiness,
        getSnowMouldResistantVarieties
    };

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = ScanturfVarieties;
    }

    global.GAIP_SCANTURF_VARIETIES = SCANTURF_VARIETIES;
    global.gaip_getScanturfVarietyData = getScanturfVarietyData;
    global.gaip_getScanturfRyegrassVarieties = getScanturfRyegrassVarieties;
    global.gaip_getScanturfBentgrassVarieties = getScanturfBentgrassVarieties;
    global.gaip_getScanturfBluegrassVarieties = getScanturfBluegrassVarieties;
    global.gaip_getScanturfWearMultiplier = getScanturfWearMultiplier;
    global.gaip_getScanturfDiseaseModifier = getScanturfDiseaseModifier;

})(typeof window !== 'undefined' ? window : this);
