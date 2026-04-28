/**
 * ============================================================================
 * GERMAN BSA VARIETY TRAITS DATABASE v1.1.0
 * ============================================================================
 * 
 * Source: Bundessortenamt (BSA) - German Federal Plant Variety Office
 * Data: RSM (Rasen) approved varieties - Sports turf rankings 2025
 * 
 * BSA SCORING SYSTEM:
 * - Scores are 1-9 scale (9 = best)
 * - Overseed score: suitability for overseeding/renovation
 * - Permanent score: suitability for permanent turf establishment
 * - Wear tolerance: traffic/play tolerance
 * - Close mown: suitability for greens/fine turf (bentgrass)
 * - Density: turf density rating
 * - Disease scores: resistance ratings (higher = more resistant)
 * 
 * CONVERSION TO MULTIPLIERS:
 * - Wear/Close mown: multiplier = 1.25 - (score × 0.055)
 *   Score 9 → 0.76, Score 7 → 0.87, Score 5 → 0.98
 * - Disease: multiplier = 1.35 - (score × 0.07)
 *   Score 9 → 0.72, Score 7 → 0.86, Score 5 → 1.00
 * 
 * COVERAGE:
 * - 22 Perennial Ryegrass (Lolium perenne) varieties
 *   Disease data: Red Thread, Pythium (partial: Leaf Spot, Rust)
 * - 4 Creeping Bentgrass (Agrostis stolonifera) varieties
 *   Independence I (#1), PC2 (#2), Jorvik (#3), Highland (#4)
 * - 3 Colonial Bentgrass (Agrostis capillaris) varieties
 *   Highland, Jorvik, Independence I
 * 
 * @author Gilba Solutions
 * @version 1.1.0
 * @source Bundessortenamt Beschreibende Sortenliste Rasengräser 2025
 * ============================================================================
 */

(function(global) {
    'use strict';
    
    
    // ========================================================================
    // HELPER FUNCTIONS
    // ========================================================================
    
    /**
     * Convert BSA 1-9 score to wear multiplier
     * Higher score = better wear tolerance = lower multiplier
     */
    function wearScoreToMultiplier(score) {
        if (!score || score === '') return 1.0;
        return Math.round((1.25 - (parseFloat(score) * 0.055)) * 100) / 100;
    }
    
    /**
     * Convert BSA 1-9 score to disease risk multiplier
     * Higher score = more resistant = lower multiplier
     */
    function diseaseScoreToMultiplier(score) {
        if (!score || score === '') return null;
        return Math.round((1.35 - (parseFloat(score) * 0.07)) * 100) / 100;
    }
    
    /**
     * Convert BSA 1-9 score to quality rating (1-9 scale preserved)
     */
    function scoreToQuality(score) {
        return parseFloat(score) || 5.0;
    }
    
    // ========================================================================
    // VARIETY DATABASE
    // ========================================================================
    
    const BSA_VARIETY_TRAITS = {
        
        // ====================================================================
        // PERENNIAL RYEGRASS (Lolium perenne)
        // Source: BSA Rasengräser 2025 - RSM approved varieties
        // ====================================================================
        
        perennialRyegrass: {
            
            'Eurogala': {
                species: 'perennialRyegrass',
                displayName: 'Eurogala',
                bsaId: 2294,
                approvalYear: 2023,
                
                qualityRating: 8.65,  // Average of overseed (8.7) and permanent (8.6)
                qualitySource: 'BSA 2025 - Rank #1 overseed, #1 permanent',
                
                traits: {
                    wear: {
                        multiplier: 0.76,  // Score 9
                        confidence: 'high',
                        source: 'BSA Rasengräser 2025 - Wear tolerance: 9/9',
                        notes: 'Top-rated wear tolerance'
                    },
                    
                    density: {
                        score: 9,
                        confidence: 'high',
                        source: 'BSA Rasengräser 2025'
                    },
                    
                    disease: {
                        redThread: {
                            riskMultiplier: 0.86,  // Score 7
                            confidence: 'high',
                            source: 'BSA Rasengräser 2025'
                        },
                        pythium: {
                            riskMultiplier: 0.86,  // Score 7
                            confidence: 'high',
                            source: 'BSA Rasengräser 2025'
                        }
                    }
                }
            },
            
            'Quill': {
                species: 'perennialRyegrass',
                displayName: 'Quill',
                bsaId: 2252,
                approvalYear: 2022,
                
                qualityRating: 8.48,
                qualitySource: 'BSA 2025 - Rank #2 overseed, #2 permanent',
                
                traits: {
                    wear: {
                        multiplier: 0.81,  // Score 8
                        confidence: 'high',
                        source: 'BSA Rasengräser 2025 - Wear tolerance: 8/9'
                    },
                    
                    density: {
                        score: 9,
                        confidence: 'high',
                        source: 'BSA Rasengräser 2025'
                    },
                    
                    disease: {
                        redThread: {
                            riskMultiplier: 0.86,  // Score 7
                            confidence: 'high',
                            source: 'BSA Rasengräser 2025'
                        },
                        pythium: {
                            riskMultiplier: 0.86,  // Score 7
                            confidence: 'high',
                            source: 'BSA Rasengräser 2025'
                        }
                    }
                }
            },
            
            'Eurobeat': {
                species: 'perennialRyegrass',
                displayName: 'Eurobeat',
                bsaId: 2148,
                approvalYear: 2020,
                
                qualityRating: 8.05,
                qualitySource: 'BSA 2025 - Rank #3 overseed',
                
                traits: {
                    wear: {
                        multiplier: 0.81,  // Score 8
                        confidence: 'high',
                        source: 'BSA Rasengräser 2025 - Wear tolerance: 8/9'
                    },
                    
                    density: {
                        score: 8,
                        confidence: 'high',
                        source: 'BSA Rasengräser 2025'
                    },
                    
                    disease: {
                        redThread: {
                            riskMultiplier: 0.93,  // Score 6
                            confidence: 'high',
                            source: 'BSA Rasengräser 2025'
                        },
                        pythium: {
                            riskMultiplier: 0.79,  // Score 8
                            confidence: 'high',
                            source: 'BSA Rasengräser 2025'
                        }
                    }
                }
            },
            
            'Gladys': {
                species: 'perennialRyegrass',
                displayName: 'Gladys',
                bsaId: 2033,
                approvalYear: 2016,
                
                qualityRating: 8.11,
                qualitySource: 'BSA 2025 - Rank #4 overseed, #4 permanent',
                
                traits: {
                    wear: {
                        multiplier: 0.81,  // Score 8
                        confidence: 'high',
                        source: 'BSA Rasengräser 2025 - Wear tolerance: 8/9'
                    },
                    
                    density: {
                        score: 8,
                        confidence: 'high',
                        source: 'BSA Rasengräser 2025'
                    },
                    
                    disease: {
                        rust: {
                            riskMultiplier: 0.79,  // Score 8
                            confidence: 'high',
                            source: 'BSA Rasengräser 2025'
                        },
                        redThread: {
                            riskMultiplier: 0.86,  // Score 7
                            confidence: 'high',
                            source: 'BSA Rasengräser 2025'
                        },
                        pythium: {
                            riskMultiplier: 0.79,  // Score 8
                            confidence: 'high',
                            source: 'BSA Rasengräser 2025'
                        }
                    }
                }
            },
            
            'Eurostyle': {
                species: 'perennialRyegrass',
                displayName: 'Eurostyle',
                bsaId: 2193,
                approvalYear: 2021,
                
                qualityRating: 7.96,
                qualitySource: 'BSA 2025 - Rank #5 overseed',
                
                traits: {
                    wear: {
                        multiplier: 0.81,  // Score 8
                        confidence: 'high',
                        source: 'BSA Rasengräser 2025 - Wear tolerance: 8/9'
                    },
                    
                    density: {
                        score: 8,
                        confidence: 'high',
                        source: 'BSA Rasengräser 2025'
                    },
                    
                    disease: {
                        redThread: {
                            riskMultiplier: 0.86,  // Score 7
                            confidence: 'high',
                            source: 'BSA Rasengräser 2025'
                        },
                        pythium: {
                            riskMultiplier: 0.79,  // Score 8
                            confidence: 'high',
                            source: 'BSA Rasengräser 2025'
                        }
                    }
                }
            },
            
            'Europitch': {
                species: 'perennialRyegrass',
                displayName: 'Europitch',
                bsaId: 2010,
                approvalYear: 2016,
                
                qualityRating: 8.03,
                qualitySource: 'BSA 2025 - Rank #6 overseed, #7 permanent',
                
                traits: {
                    wear: {
                        multiplier: 0.81,  // Score 8
                        confidence: 'high',
                        source: 'BSA Rasengräser 2025 - Wear tolerance: 8/9'
                    },
                    
                    density: {
                        score: 8,
                        confidence: 'high',
                        source: 'BSA Rasengräser 2025'
                    },
                    
                    disease: {
                        rust: {
                            riskMultiplier: 0.79,  // Score 8
                            confidence: 'high',
                            source: 'BSA Rasengräser 2025'
                        },
                        redThread: {
                            riskMultiplier: 0.93,  // Score 6
                            confidence: 'high',
                            source: 'BSA Rasengräser 2025'
                        },
                        pythium: {
                            riskMultiplier: 0.86,  // Score 7
                            confidence: 'high',
                            source: 'BSA Rasengräser 2025'
                        }
                    }
                }
            },
            
            'Barpractice': {
                species: 'perennialRyegrass',
                displayName: 'Barpractice',
                bsaId: 2202,
                approvalYear: 2021,
                
                qualityRating: 7.84,
                qualitySource: 'BSA 2025 - Rank #7 overseed',
                
                traits: {
                    wear: {
                        multiplier: 0.81,  // Score 8
                        confidence: 'high',
                        source: 'BSA Rasengräser 2025 - Wear tolerance: 8/9'
                    },
                    
                    density: {
                        score: 9,
                        confidence: 'high',
                        source: 'BSA Rasengräser 2025'
                    },
                    
                    disease: {
                        redThread: {
                            riskMultiplier: 0.93,  // Score 6
                            confidence: 'high',
                            source: 'BSA Rasengräser 2025'
                        },
                        pythium: {
                            riskMultiplier: 1.00,  // Score 5
                            confidence: 'high',
                            source: 'BSA Rasengräser 2025'
                        }
                    }
                }
            },
            
            'Sansa': {
                species: 'perennialRyegrass',
                displayName: 'Sansa',
                bsaId: 2437,
                approvalYear: 2024,
                
                qualityRating: 7.98,
                qualitySource: 'BSA 2025 - Rank #8 overseed, #9 permanent (newest approval)',
                
                traits: {
                    wear: {
                        multiplier: 0.81,  // Score 8
                        confidence: 'high',
                        source: 'BSA Rasengräser 2025 - Wear tolerance: 8/9'
                    },
                    
                    density: {
                        score: 8,
                        confidence: 'high',
                        source: 'BSA Rasengräser 2025'
                    },
                    
                    disease: {
                        redThread: {
                            riskMultiplier: 0.86,  // Score 7
                            confidence: 'high',
                            source: 'BSA Rasengräser 2025'
                        },
                        pythium: {
                            riskMultiplier: 1.00,  // Score 5
                            confidence: 'high',
                            source: 'BSA Rasengräser 2025'
                        }
                    }
                }
            },
            
            'Beckham': {
                species: 'perennialRyegrass',
                displayName: 'Beckham',
                bsaId: 1773,
                approvalYear: 2012,
                
                qualityRating: 7.88,
                qualitySource: 'BSA 2025 - Rank #9 overseed',
                
                traits: {
                    wear: {
                        multiplier: 0.81,  // Score 8
                        confidence: 'high',
                        source: 'BSA Rasengräser 2025 - Wear tolerance: 8/9'
                    },
                    
                    density: {
                        score: 8,
                        confidence: 'high',
                        source: 'BSA Rasengräser 2025'
                    },
                    
                    disease: {
                        redThread: {
                            riskMultiplier: 0.86,  // Score 7
                            confidence: 'high',
                            source: 'BSA Rasengräser 2025'
                        }
                    }
                }
            },
            
            'Christelle': {
                species: 'perennialRyegrass',
                displayName: 'Christelle',
                bsaId: 2216,
                approvalYear: 2021,
                
                qualityRating: 8.00,
                qualitySource: 'BSA 2025 - Rank #9 overseed, #7 permanent',
                
                traits: {
                    wear: {
                        multiplier: 0.81,  // Score 8
                        confidence: 'high',
                        source: 'BSA Rasengräser 2025 - Wear tolerance: 8/9'
                    },
                    
                    density: {
                        score: 8,
                        confidence: 'high',
                        source: 'BSA Rasengräser 2025'
                    },
                    
                    disease: {
                        redThread: {
                            riskMultiplier: 0.93,  // Score 6
                            confidence: 'high',
                            source: 'BSA Rasengräser 2025'
                        },
                        pythium: {
                            riskMultiplier: 0.79,  // Score 8
                            confidence: 'high',
                            source: 'BSA Rasengräser 2025'
                        }
                    }
                }
            },
            
            'Brentano': {
                species: 'perennialRyegrass',
                displayName: 'Brentano',
                bsaId: 2034,
                approvalYear: 2017,
                
                qualityRating: 8.05,
                qualitySource: 'BSA 2025 - Rank #3 permanent',
                
                traits: {
                    wear: {
                        multiplier: 0.87,  // Score 7
                        confidence: 'high',
                        source: 'BSA Rasengräser 2025 - Wear tolerance: 7/9'
                    },
                    
                    density: {
                        score: 8,
                        confidence: 'high',
                        source: 'BSA Rasengräser 2025'
                    },
                    
                    disease: {
                        redThread: {
                            riskMultiplier: 0.86,  // Score 7
                            confidence: 'high',
                            source: 'BSA Rasengräser 2025'
                        }
                    }
                }
            },
            
            'Promotor': {
                species: 'perennialRyegrass',
                displayName: 'Promotor',
                bsaId: 1599,
                approvalYear: 2010,
                
                qualityRating: 7.88,
                qualitySource: 'BSA 2025 - Established variety',
                
                traits: {
                    wear: {
                        multiplier: 0.87,  // Score 7
                        confidence: 'high',
                        source: 'BSA Rasengräser 2025 - Wear tolerance: 7/9'
                    },
                    
                    density: {
                        score: 8,
                        confidence: 'high',
                        source: 'BSA Rasengräser 2025'
                    },
                    
                    disease: {
                        leafSpot: {
                            riskMultiplier: 0.93,  // Score 6
                            confidence: 'high',
                            source: 'BSA Rasengräser 2025'
                        },
                        redThread: {
                            riskMultiplier: 0.86,  // Score 7
                            confidence: 'high',
                            source: 'BSA Rasengräser 2025'
                        },
                        pythium: {
                            riskMultiplier: 0.79,  // Score 8
                            confidence: 'high',
                            source: 'BSA Rasengräser 2025'
                        }
                    }
                }
            },
            
            'Barsignum': {
                species: 'perennialRyegrass',
                displayName: 'Barsignum',
                bsaId: 1451,
                approvalYear: 2008,
                
                qualityRating: 7.96,
                qualitySource: 'BSA 2025 - Rank #6 permanent',
                
                traits: {
                    wear: {
                        multiplier: 0.87,  // Score 7
                        confidence: 'high',
                        source: 'BSA Rasengräser 2025 - Wear tolerance: 7/9'
                    },
                    
                    density: {
                        score: 8,
                        confidence: 'high',
                        source: 'BSA Rasengräser 2025'
                    },
                    
                    disease: {
                        leafSpot: {
                            riskMultiplier: 0.93,  // Score 6
                            confidence: 'high',
                            source: 'BSA Rasengräser 2025'
                        },
                        redThread: {
                            riskMultiplier: 0.86,  // Score 7
                            confidence: 'high',
                            source: 'BSA Rasengräser 2025'
                        },
                        pythium: {
                            riskMultiplier: 0.86,  // Score 7
                            confidence: 'high',
                            source: 'BSA Rasengräser 2025'
                        }
                    }
                }
            },
            
            'Corsica': {
                species: 'perennialRyegrass',
                displayName: 'Corsica',
                bsaId: 1838,
                approvalYear: 2013,
                
                qualityRating: 7.98,
                qualitySource: 'BSA 2025 - Rank #5 permanent',
                
                traits: {
                    wear: {
                        multiplier: 0.87,  // Score 7
                        confidence: 'high',
                        source: 'BSA Rasengräser 2025 - Wear tolerance: 7/9'
                    },
                    
                    density: {
                        score: 8,
                        confidence: 'high',
                        source: 'BSA Rasengräser 2025'
                    },
                    
                    disease: {
                        leafSpot: {
                            riskMultiplier: 0.93,  // Score 6
                            confidence: 'high',
                            source: 'BSA Rasengräser 2025'
                        },
                        redThread: {
                            riskMultiplier: 0.93,  // Score 6
                            confidence: 'high',
                            source: 'BSA Rasengräser 2025'
                        },
                        pythium: {
                            riskMultiplier: 0.93,  // Score 6
                            confidence: 'high',
                            source: 'BSA Rasengräser 2025'
                        }
                    }
                }
            },
            
            'Coletta': {
                species: 'perennialRyegrass',
                displayName: 'Coletta',
                bsaId: 1721,
                approvalYear: 2011,
                
                qualityRating: 7.74,
                qualitySource: 'BSA 2025',
                
                traits: {
                    wear: {
                        multiplier: 0.87,  // Score 7
                        confidence: 'high',
                        source: 'BSA Rasengräser 2025 - Wear tolerance: 7/9'
                    },
                    
                    density: {
                        score: 8,
                        confidence: 'high',
                        source: 'BSA Rasengräser 2025'
                    },
                    
                    disease: {
                        leafSpot: {
                            riskMultiplier: 0.86,  // Score 7
                            confidence: 'high',
                            source: 'BSA Rasengräser 2025'
                        },
                        redThread: {
                            riskMultiplier: 0.93,  // Score 6
                            confidence: 'high',
                            source: 'BSA Rasengräser 2025'
                        },
                        pythium: {
                            riskMultiplier: 0.93,  // Score 6
                            confidence: 'high',
                            source: 'BSA Rasengräser 2025'
                        }
                    }
                }
            },
            
            'Columbine': {
                species: 'perennialRyegrass',
                displayName: 'Columbine',
                bsaId: 1490,
                approvalYear: 2009,
                
                qualityRating: 7.65,
                qualitySource: 'BSA 2025',
                
                traits: {
                    wear: {
                        multiplier: 0.87,  // Score 7
                        confidence: 'high',
                        source: 'BSA Rasengräser 2025 - Wear tolerance: 7/9'
                    },
                    
                    density: {
                        score: 8,
                        confidence: 'high',
                        source: 'BSA Rasengräser 2025'
                    },
                    
                    disease: {
                        leafSpot: {
                            riskMultiplier: 0.86,  // Score 7
                            confidence: 'high',
                            source: 'BSA Rasengräser 2025'
                        },
                        redThread: {
                            riskMultiplier: 0.86,  // Score 7
                            confidence: 'high',
                            source: 'BSA Rasengräser 2025'
                        },
                        pythium: {
                            riskMultiplier: 0.86,  // Score 7
                            confidence: 'high',
                            source: 'BSA Rasengräser 2025'
                        }
                    }
                }
            },
            
            'Dickens 1': {
                species: 'perennialRyegrass',
                displayName: 'Dickens 1',
                bsaId: 1294,
                approvalYear: 2007,
                
                qualityRating: 7.85,
                qualitySource: 'BSA 2025 - Rank #11 permanent',
                
                traits: {
                    wear: {
                        multiplier: 0.87,  // Score 7
                        confidence: 'high',
                        source: 'BSA Rasengräser 2025 - Wear tolerance: 7/9'
                    },
                    
                    density: {
                        score: 8,
                        confidence: 'high',
                        source: 'BSA Rasengräser 2025'
                    },
                    
                    disease: {
                        leafSpot: {
                            riskMultiplier: 0.86,  // Score 7
                            confidence: 'high',
                            source: 'BSA Rasengräser 2025'
                        },
                        redThread: {
                            riskMultiplier: 0.86,  // Score 7
                            confidence: 'high',
                            source: 'BSA Rasengräser 2025'
                        },
                        pythium: {
                            riskMultiplier: 0.86,  // Score 7
                            confidence: 'high',
                            source: 'BSA Rasengräser 2025'
                        }
                    }
                }
            },
            
            'Gildara': {
                species: 'perennialRyegrass',
                displayName: 'Gildara',
                bsaId: 2136,
                approvalYear: 2019,
                
                qualityRating: 7.88,
                qualitySource: 'BSA 2025 - Rank #10 permanent',
                
                traits: {
                    wear: {
                        multiplier: 0.81,  // Score 8
                        confidence: 'high',
                        source: 'BSA Rasengräser 2025 - Wear tolerance: 8/9'
                    },
                    
                    density: {
                        score: 8,
                        confidence: 'high',
                        source: 'BSA Rasengräser 2025'
                    },
                    
                    disease: {
                        redThread: {
                            riskMultiplier: 0.93,  // Score 6
                            confidence: 'high',
                            source: 'BSA Rasengräser 2025'
                        }
                    }
                }
            },
            
            'Greensky': {
                species: 'perennialRyegrass',
                displayName: 'Greensky',
                bsaId: 1495,
                approvalYear: 2008,
                
                qualityRating: 7.56,
                qualitySource: 'BSA 2025',
                
                traits: {
                    wear: {
                        multiplier: 0.87,  // Score 7
                        confidence: 'high',
                        source: 'BSA Rasengräser 2025 - Wear tolerance: 7/9'
                    },
                    
                    density: {
                        score: 8,
                        confidence: 'high',
                        source: 'BSA Rasengräser 2025'
                    },
                    
                    disease: {
                        leafSpot: {
                            riskMultiplier: 0.93,  // Score 6
                            confidence: 'high',
                            source: 'BSA Rasengräser 2025'
                        },
                        redThread: {
                            riskMultiplier: 0.86,  // Score 7
                            confidence: 'high',
                            source: 'BSA Rasengräser 2025'
                        },
                        pythium: {
                            riskMultiplier: 0.86,  // Score 7
                            confidence: 'high',
                            source: 'BSA Rasengräser 2025'
                        }
                    }
                }
            },
            
            'Mount Everest': {
                species: 'perennialRyegrass',
                displayName: 'Mount Everest',
                bsaId: 2353,
                approvalYear: 2024,
                
                qualityRating: 7.80,
                qualitySource: 'BSA 2025 - Newest approval (2024)',
                
                traits: {
                    wear: {
                        multiplier: 0.81,  // Score 8
                        confidence: 'high',
                        source: 'BSA Rasengräser 2025 - Wear tolerance: 8/9'
                    },
                    
                    density: {
                        score: 8,
                        confidence: 'high',
                        source: 'BSA Rasengräser 2025'
                    },
                    
                    disease: {
                        redThread: {
                            riskMultiplier: 0.86,  // Score 7
                            confidence: 'high',
                            source: 'BSA Rasengräser 2025'
                        },
                        pythium: {
                            riskMultiplier: 1.00,  // Score 5
                            confidence: 'high',
                            source: 'BSA Rasengräser 2025'
                        }
                    }
                }
            },
            
            'Cleopatra': {
                species: 'perennialRyegrass',
                displayName: 'Cleopatra',
                bsaId: 1081,
                approvalYear: 2003,
                
                qualityRating: 7.69,
                qualitySource: 'BSA 2025 - Long-established variety',
                
                traits: {
                    wear: {
                        multiplier: 0.87,  // Score 7
                        confidence: 'high',
                        source: 'BSA Rasengräser 2025 - Wear tolerance: 7/9'
                    },
                    
                    density: {
                        score: 8,
                        confidence: 'high',
                        source: 'BSA Rasengräser 2025'
                    },
                    
                    disease: {
                        redThread: {
                            riskMultiplier: 0.93,  // Score 6
                            confidence: 'high',
                            source: 'BSA Rasengräser 2025'
                        },
                        pythium: {
                            riskMultiplier: 0.86,  // Score 7
                            confidence: 'high',
                            source: 'BSA Rasengräser 2025'
                        }
                    }
                }
            },
            
            'Eurodiamond': {
                species: 'perennialRyegrass',
                displayName: 'Eurodiamond',
                bsaId: 1292,
                approvalYear: 2006,
                
                qualityRating: 7.58,
                qualitySource: 'BSA 2025',
                
                traits: {
                    wear: {
                        multiplier: 0.87,  // Score 7
                        confidence: 'high',
                        source: 'BSA Rasengräser 2025 - Wear tolerance: 7/9'
                    },
                    
                    density: {
                        score: 8,
                        confidence: 'high',
                        source: 'BSA Rasengräser 2025'
                    },
                    
                    disease: {
                        leafSpot: {
                            riskMultiplier: 0.86,  // Score 7
                            confidence: 'high',
                            source: 'BSA Rasengräser 2025'
                        },
                        redThread: {
                            riskMultiplier: 0.86,  // Score 7
                            confidence: 'high',
                            source: 'BSA Rasengräser 2025'
                        },
                        pythium: {
                            riskMultiplier: 0.86,  // Score 7
                            confidence: 'high',
                            source: 'BSA Rasengräser 2025'
                        }
                    }
                }
            }
        },
        
        // ====================================================================
        // CREEPING BENTGRASS (Agrostis stolonifera)
        // Source: BSA Rasengräser 2025 - Greens/close mowing ratings
        // ====================================================================
        
        creepingBentgrass: {
            
            'Independence I': {
                species: 'creepingBentgrass',
                displayName: 'Independence I',
                scientificName: 'Agrostis stolonifera',
                
                qualityRating: 8.33,  // Average of close mown (9) + density (8) + disease (8)
                qualitySource: 'BSA 2025 - Greens Rank #1',
                
                traits: {
                    closeMowing: {
                        score: 9,
                        multiplier: 0.76,  // Excellent close mowing tolerance
                        confidence: 'high',
                        source: 'BSA Rasengräser 2025 - Close mown: 9/9'
                    },
                    
                    density: {
                        score: 8,
                        confidence: 'high',
                        source: 'BSA Rasengräser 2025'
                    },
                    
                    disease: {
                        general: {
                            riskMultiplier: 0.79,  // Score 8
                            confidence: 'high',
                            source: 'BSA Rasengräser 2025 - Disease: 8/9'
                        }
                    }
                }
            },
            
            'PC2': {
                species: 'creepingBentgrass',
                displayName: 'PC2',
                scientificName: 'Agrostis stolonifera',
                
                qualityRating: 8.0,
                qualitySource: 'BSA 2025 - Greens Rank #2',
                
                traits: {
                    closeMowing: {
                        score: 9,
                        multiplier: 0.76,  // Excellent close mowing tolerance
                        confidence: 'high',
                        source: 'BSA Rasengräser 2025 - Close mown: 9/9'
                    },
                    
                    density: {
                        score: 8,
                        confidence: 'high',
                        source: 'BSA Rasengräser 2025'
                    },
                    
                    disease: {
                        general: {
                            riskMultiplier: 0.86,  // Score 7
                            confidence: 'high',
                            source: 'BSA Rasengräser 2025 - Disease: 7/9'
                        }
                    }
                }
            },
            
            'Jorvik': {
                species: 'creepingBentgrass',
                displayName: 'Jorvik',
                scientificName: 'Agrostis stolonifera',
                
                qualityRating: 7.33,
                qualitySource: 'BSA 2025 - Greens Rank #3',
                
                traits: {
                    closeMowing: {
                        score: 8,
                        multiplier: 0.81,  // Good close mowing tolerance
                        confidence: 'high',
                        source: 'BSA Rasengräser 2025 - Close mown: 8/9'
                    },
                    
                    density: {
                        score: 7,
                        confidence: 'high',
                        source: 'BSA Rasengräser 2025'
                    },
                    
                    disease: {
                        general: {
                            riskMultiplier: 0.86,  // Score 7
                            confidence: 'high',
                            source: 'BSA Rasengräser 2025 - Disease: 7/9'
                        }
                    }
                }
            },
            
            'Highland': {
                species: 'creepingBentgrass',
                displayName: 'Highland',
                scientificName: 'Agrostis stolonifera',
                
                qualityRating: 7.0,
                qualitySource: 'BSA 2025 - Greens Rank #4',
                
                traits: {
                    closeMowing: {
                        score: 8,
                        multiplier: 0.81,  // Good close mowing tolerance
                        confidence: 'high',
                        source: 'BSA Rasengräser 2025 - Close mown: 8/9'
                    },
                    
                    density: {
                        score: 7,
                        confidence: 'high',
                        source: 'BSA Rasengräser 2025'
                    },
                    
                    disease: {
                        general: {
                            riskMultiplier: 0.93,  // Score 6
                            confidence: 'high',
                            source: 'BSA Rasengräser 2025 - Disease: 6/9'
                        }
                    }
                }
            }
        },
        
        // ====================================================================
        // COLONIAL BENTGRASS (Agrostis capillaris)
        // Source: BSA Rasengräser 2025 - Also known as browntop/common bent
        // ====================================================================
        
        colonialBentgrass: {
            
            'Highland': {
                species: 'colonialBentgrass',
                displayName: 'Highland',
                scientificName: 'Agrostis capillaris',
                
                qualityRating: 6.33,
                qualitySource: 'BSA 2025 - Common bentgrass trials',
                
                traits: {
                    closeMowing: {
                        score: 7,
                        multiplier: 0.87,
                        confidence: 'high',
                        source: 'BSA Rasengräser 2025 - Close mown: 7/9'
                    },
                    
                    density: {
                        score: 6,
                        confidence: 'high',
                        source: 'BSA Rasengräser 2025'
                    },
                    
                    disease: {
                        general: {
                            riskMultiplier: 0.93,  // Score 6
                            confidence: 'high',
                            source: 'BSA Rasengräser 2025 - Disease: 6/9'
                        }
                    }
                }
            },
            
            'Jorvik': {
                species: 'colonialBentgrass',
                displayName: 'Jorvik',
                scientificName: 'Agrostis capillaris',
                
                qualityRating: 6.33,
                qualitySource: 'BSA 2025 - Common bentgrass trials',
                
                traits: {
                    closeMowing: {
                        score: 7,
                        multiplier: 0.87,
                        confidence: 'high',
                        source: 'BSA Rasengräser 2025 - Close mown: 7/9'
                    },
                    
                    density: {
                        score: 6,
                        confidence: 'high',
                        source: 'BSA Rasengräser 2025'
                    },
                    
                    disease: {
                        general: {
                            riskMultiplier: 0.93,  // Score 6
                            confidence: 'high',
                            source: 'BSA Rasengräser 2025 - Disease: 6/9'
                        }
                    }
                }
            },
            
            'Independence I': {
                species: 'colonialBentgrass',
                displayName: 'Independence I',
                scientificName: 'Agrostis capillaris',
                
                qualityRating: 5.67,
                qualitySource: 'BSA 2025 - Common bentgrass trials',
                
                traits: {
                    closeMowing: {
                        score: 6,
                        multiplier: 0.92,
                        confidence: 'high',
                        source: 'BSA Rasengräser 2025 - Close mown: 6/9'
                    },
                    
                    density: {
                        score: 6,
                        confidence: 'high',
                        source: 'BSA Rasengräser 2025'
                    },
                    
                    disease: {
                        general: {
                            riskMultiplier: 1.00,  // Score 5
                            confidence: 'high',
                            source: 'BSA Rasengräser 2025 - Disease: 5/9'
                        }
                    }
                }
            }
        }
    };
    
    // ========================================================================
    // ACCESSOR FUNCTIONS
    // ========================================================================
    
    /**
     * Get all BSA ryegrass varieties
     */
    function getBSARyegrassVarieties() {
        return Object.keys(BSA_VARIETY_TRAITS.perennialRyegrass).map(name => ({
            value: name,
            label: BSA_VARIETY_TRAITS.perennialRyegrass[name].displayName || name,
            region: 'bsa'
        }));
    }
    
    /**
     * Get all BSA bentgrass varieties (creeping + colonial)
     */
    function getBSABentgrassVarieties() {
        const varieties = [];
        
        // Creeping bentgrass
        if (BSA_VARIETY_TRAITS.creepingBentgrass) {
            Object.keys(BSA_VARIETY_TRAITS.creepingBentgrass).forEach(name => {
                varieties.push({
                    value: name,
                    label: BSA_VARIETY_TRAITS.creepingBentgrass[name].displayName + ' (Creeping)',
                    region: 'bsa',
                    subSpecies: 'creeping'
                });
            });
        }
        
        // Colonial bentgrass
        if (BSA_VARIETY_TRAITS.colonialBentgrass) {
            Object.keys(BSA_VARIETY_TRAITS.colonialBentgrass).forEach(name => {
                varieties.push({
                    value: name + '_colonial',  // Differentiate from creeping
                    label: BSA_VARIETY_TRAITS.colonialBentgrass[name].displayName + ' (Colonial)',
                    region: 'bsa',
                    subSpecies: 'colonial'
                });
            });
        }
        
        return varieties;
    }
    
    /**
     * Get wear modifier for a variety
     */
    function getBSAWearModifier(species, variety) {
        // Normalize species key
        let speciesKey = species
            .replace(/\s*\([^)]*\)/g, '')
            .replace(/\s+/g, '');
        speciesKey = speciesKey.charAt(0).toLowerCase() + speciesKey.slice(1);
        
        const speciesData = BSA_VARIETY_TRAITS[speciesKey] || BSA_VARIETY_TRAITS[species];
        if (!speciesData || !speciesData[variety]) {
            return { multiplier: 1.0, confidence: 'none', source: 'No BSA data' };
        }
        
        const varietyData = speciesData[variety];
        if (varietyData.traits?.wear) {
            return {
                multiplier: varietyData.traits.wear.multiplier,
                confidence: varietyData.traits.wear.confidence,
                source: varietyData.traits.wear.source
            };
        }
        
        // For bentgrass, use closeMowing as proxy for wear/quality
        if (varietyData.traits?.closeMowing) {
            return {
                multiplier: varietyData.traits.closeMowing.multiplier,
                confidence: varietyData.traits.closeMowing.confidence,
                source: varietyData.traits.closeMowing.source
            };
        }
        
        return { multiplier: 1.0, confidence: 'none', source: 'No wear data in BSA database' };
    }
    
    /**
     * Get disease modifier for a variety
     */
    function getBSADiseaseModifier(species, variety, disease) {
        // Normalize species key
        let speciesKey = species
            .replace(/\s*\([^)]*\)/g, '')
            .replace(/\s+/g, '');
        speciesKey = speciesKey.charAt(0).toLowerCase() + speciesKey.slice(1);
        
        const speciesData = BSA_VARIETY_TRAITS[speciesKey] || BSA_VARIETY_TRAITS[species];
        if (!speciesData || !speciesData[variety]) {
            return { riskMultiplier: 1.0, confidence: 'none', source: 'No BSA data' };
        }
        
        const varietyData = speciesData[variety];
        
        // Map disease names
        const diseaseMapping = {
            'redThread': 'redThread',
            'red_thread': 'redThread',
            'pythium': 'pythium',
            'pythiumBlight': 'pythium',
            'leafSpot': 'leafSpot',
            'leaf_spot': 'leafSpot',
            'rust': 'rust',
            'crownRust': 'rust'
        };
        
        const mappedDisease = diseaseMapping[disease] || disease;
        
        if (varietyData.traits?.disease?.[mappedDisease]) {
            return {
                riskMultiplier: varietyData.traits.disease[mappedDisease].riskMultiplier,
                confidence: varietyData.traits.disease[mappedDisease].confidence,
                source: varietyData.traits.disease[mappedDisease].source
            };
        }
        
        return { riskMultiplier: 1.0, confidence: 'none', source: `No ${disease} data in BSA database` };
    }
    
    /**
     * Get all variety traits
     */
    function getBSAVarietyTraits(species, variety) {
        // Normalize species: remove (Greens)/(Fairways) suffix, remove spaces, lowercase first char
        let speciesKey = species
            .replace(/\s*\([^)]*\)/g, '')  // Remove (Greens), (Fairways), etc.
            .replace(/\s+/g, '');           // Remove spaces
        speciesKey = speciesKey.charAt(0).toLowerCase() + speciesKey.slice(1);
        
        const speciesData = BSA_VARIETY_TRAITS[speciesKey] || BSA_VARIETY_TRAITS[species];
        if (!speciesData || !speciesData[variety]) {
            return null;
        }
        return speciesData[variety];
    }
    
    // ========================================================================
    // EXPORTS
    // ========================================================================
    
    // Export database
    global.GAIP_BSA_VARIETIES = BSA_VARIETY_TRAITS;
    
    // Export accessor functions
    global.gaip_getBSARyegrassVarieties = getBSARyegrassVarieties;
    global.gaip_getBSABentgrassVarieties = getBSABentgrassVarieties;
    global.gaip_getBSAWearModifier = getBSAWearModifier;
    global.gaip_getBSADiseaseModifier = getBSADiseaseModifier;
    global.gaip_getBSAVarietyTraits = getBSAVarietyTraits;
    
    
})(typeof window !== 'undefined' ? window : this);
