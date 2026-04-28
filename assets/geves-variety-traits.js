/**
 * GEVES Continental Europe Variety Traits Database
 * =================================================
 * 
 * Source: GEVES French Catalogue / turfgrass-list.org
 * URL: https://www.turfgrass-list.org/
 * 
 * Geographic Scope:
 * - France: Primary jurisdiction (official VCU/DUS trials)
 * - European Union: Data feeds into EU Common Catalogue decisions
 * - Western Europe: Reference benchmark for Belgium, Netherlands, Germany,
 *   Switzerland, northern Spain
 * 
 * Trial Sites: French climatic zones (Continental, Oceanic, Mediterranean)
 * Scale: 1-9 (higher = better) for all traits
 * 
 * GEVES Disease Traits:
 * - redThread: Red thread tolerance (Fil rouge)
 * - winterFusarium: Hivernale fusarium patch tolerance (Microdochium nivale)
 * - summerFusarium: Estivale fusarium blight tolerance
 * - drechslera: Drechslera leaf spot tolerance (Helminthosporiose)
 * - rust: Rusts tolerance (Rouilles)
 * 
 * Version: 1.0.0
 * Last Updated: 2026-01-04
 * Data Verified: Direct extraction from turfgrass-list.org variety pages
 */

const GEVESVarietyTraits = {
    
    version: '1.0.0',
    source: 'GEVES French Catalogue / turfgrass-list.org',
    dataVerified: true,
    
    // ═══════════════════════════════════════════════════════════════════════════
    // PERENNIAL RYEGRASS (Lolium perenne) - Ray-grass anglais
    // Source: https://www.turfgrass-list.org/varieties/perennial-ryegrass
    // ═══════════════════════════════════════════════════════════════════════════
    
    perennialRyegrass: {
        
        // ─────────────────────────────────────────────────────────────────────────
        // VERIFIED FROM TURFGRASS-LIST.ORG (2026-01-04)
        // ─────────────────────────────────────────────────────────────────────────
        
        'Singapore': {
            species: 'perennialRyegrass',
            displayName: 'Singapore',
            region: 'GEVES',
            owner: 'DLF Trifolium A/S',
            registrationYear: 2018,
            catalogueCode: '4056367',
            marketAvailable: true,
            
            gevesRatings: {
                wearTolerance: 6.76,
                sportIndex: 7.15,
                lawnsIndex: 7.2,
                shootDensity: 7.65,
                establishment: 8.2,
                persistency: 7.54,
                globalAesthetic: 6.67,
                colorOfLeaves: 5.13,
                finenessOfLeaves: 7.41
            },
            
            diseaseResistance: {
                redThread: { rating: 7.59, confidence: 'high', source: 'GEVES turfgrass-list.org' },
                winterFusarium: { rating: 7.55, confidence: 'high', source: 'GEVES turfgrass-list.org' },
                summerFusarium: { rating: null, confidence: 'none', source: 'Not tested' },
                drechslera: { rating: 6.8, confidence: 'high', source: 'GEVES turfgrass-list.org' },
                rust: { rating: 7.52, confidence: 'high', source: 'GEVES turfgrass-list.org' }
            },
            
            traits: {
                wear: {
                    multiplier: 0.90,
                    confidence: 'high',
                    source: 'GEVES - Wear tolerance 6.76'
                },
                disease: {
                    redThread: {
                        riskMultiplier: 0.85,
                        confidence: 'high',
                        source: 'GEVES - Red thread 7.59 (good)'
                    },
                    winterFusarium: {
                        riskMultiplier: 0.85,
                        confidence: 'high',
                        source: 'GEVES - Winter fusarium 7.55 (good)'
                    }
                }
            }
        },
        
        'Eventus': {
            species: 'perennialRyegrass',
            displayName: 'Eventus',
            region: 'GEVES',
            owner: 'Deutsche Saatveredelung AG (DSV)',
            registrationYear: 2017,
            catalogueCode: '4054001',
            marketAvailable: true,
            
            gevesRatings: {
                wearTolerance: 6.86,
                sportIndex: 7.24,
                lawnsIndex: 7.26,
                shootDensity: 7.77,
                establishment: 8.15,
                persistency: 7.52,
                globalAesthetic: 6.76,
                colorOfLeaves: 5.46,
                finenessOfLeaves: 7.39
            },
            
            diseaseResistance: {
                redThread: { rating: 7.21, confidence: 'high', source: 'GEVES turfgrass-list.org' },
                winterFusarium: { rating: 7.37, confidence: 'high', source: 'GEVES turfgrass-list.org' },
                summerFusarium: { rating: null, confidence: 'none', source: 'Not tested' },
                drechslera: { rating: 6.67, confidence: 'high', source: 'GEVES turfgrass-list.org' },
                rust: { rating: 7.2, confidence: 'high', source: 'GEVES turfgrass-list.org' }
            },
            
            traits: {
                wear: {
                    multiplier: 0.89,
                    confidence: 'high',
                    source: 'GEVES - Wear tolerance 6.86'
                },
                disease: {
                    redThread: {
                        riskMultiplier: 0.88,
                        confidence: 'high',
                        source: 'GEVES - Red thread 7.21 (good)'
                    },
                    winterFusarium: {
                        riskMultiplier: 0.86,
                        confidence: 'high',
                        source: 'GEVES - Winter fusarium 7.37 (good)'
                    }
                }
            }
        },
        
        'Barcristalla': {
            species: 'perennialRyegrass',
            displayName: 'Barcristalla',
            region: 'GEVES',
            owner: 'Barenbrug Holland BV',
            registrationYear: 2017,
            catalogueCode: '4051645',
            marketAvailable: true,
            
            gevesRatings: {
                wearTolerance: 7.0,
                sportIndex: 7.08,
                lawnsIndex: 7.0,
                shootDensity: 7.09,
                establishment: 8.3,
                persistency: 7.16,
                globalAesthetic: 6.44,
                colorOfLeaves: 6.45,
                finenessOfLeaves: 6.62
            },
            
            diseaseResistance: {
                redThread: { rating: 7.34, confidence: 'high', source: 'GEVES turfgrass-list.org' },
                winterFusarium: { rating: 7.7, confidence: 'high', source: 'GEVES turfgrass-list.org' },
                summerFusarium: { rating: 6.32, confidence: 'high', source: 'GEVES turfgrass-list.org' },
                drechslera: { rating: 6.48, confidence: 'high', source: 'GEVES turfgrass-list.org' },
                rust: { rating: 7.78, confidence: 'high', source: 'GEVES turfgrass-list.org' }
            },
            
            traits: {
                wear: {
                    multiplier: 0.87,
                    confidence: 'high',
                    source: 'GEVES - Wear tolerance 7.0'
                },
                disease: {
                    redThread: {
                        riskMultiplier: 0.86,
                        confidence: 'high',
                        source: 'GEVES - Red thread 7.34 (good)'
                    },
                    winterFusarium: {
                        riskMultiplier: 0.82,
                        confidence: 'high',
                        source: 'GEVES - Winter fusarium 7.7 (very good)'
                    },
                    rust: {
                        riskMultiplier: 0.81,
                        confidence: 'high',
                        source: 'GEVES - Rust 7.78 (very good)'
                    }
                }
            }
        },
        
        'Barpersie': {
            species: 'perennialRyegrass',
            displayName: 'Barpersie',
            region: 'GEVES',
            owner: 'Barenbrug Holland BV',
            registrationYear: 2021,
            catalogueCode: '4061068',
            marketAvailable: true,
            
            gevesRatings: {
                wearTolerance: 7.15,
                sportIndex: 7.43,
                lawnsIndex: 7.39,
                shootDensity: 7.91,
                establishment: null,
                persistency: 7.33,
                globalAesthetic: 6.89,
                colorOfLeaves: 4.89,
                finenessOfLeaves: 7.66
            },
            
            diseaseResistance: {
                redThread: { rating: 7.57, confidence: 'high', source: 'GEVES turfgrass-list.org' },
                winterFusarium: { rating: 6.25, confidence: 'high', source: 'GEVES turfgrass-list.org' },
                summerFusarium: { rating: null, confidence: 'none', source: 'Not tested' },
                drechslera: { rating: 7.03, confidence: 'high', source: 'GEVES turfgrass-list.org' },
                rust: { rating: 7.1, confidence: 'high', source: 'GEVES turfgrass-list.org' }
            },
            
            traits: {
                wear: {
                    multiplier: 0.85,
                    confidence: 'high',
                    source: 'GEVES - Wear tolerance 7.15 (good)'
                },
                disease: {
                    redThread: {
                        riskMultiplier: 0.84,
                        confidence: 'high',
                        source: 'GEVES - Red thread 7.57 (good)'
                    },
                    winterFusarium: {
                        riskMultiplier: 0.95,
                        confidence: 'high',
                        source: 'GEVES - Winter fusarium 6.25 (moderate)'
                    }
                }
            }
        },
        
        // ─────────────────────────────────────────────────────────────────────────
        // VERIFIED ENTRIES - Data from turfgrass-list.org GEVES export (updated 10/6/25)
        // Source: Official French catalogue GEVES trial data
        // ─────────────────────────────────────────────────────────────────────────

        'Monroe': {
            species: 'perennialRyegrass',
            displayName: 'Monroe',
            region: 'GEVES',
            owner: 'DLF Trifolium A/S',
            registrationYear: 2017,
            catalogueCode: '4054017',
            marketAvailable: true,

            gevesRatings: {
                wearTolerance: 6.75,
                sportIndex: 7.0,
                lawnsIndex: 7.0,
                shootDensity: 7.35,
                establishment: 7.93,
                persistency: 7.48,
                globalAesthetic: 6.42,
                colorOfLeaves: 5.92,
                finenessOfLeaves: 6.96
            },

            diseaseResistance: {
                redThread: { rating: 7.13, confidence: 'high', source: 'GEVES turfgrass-list.org' },
                winterFusarium: { rating: 6.95, confidence: 'high', source: 'GEVES turfgrass-list.org' },
                summerFusarium: { rating: null, confidence: 'none', source: 'Not tested' },
                drechslera: { rating: 6.46, confidence: 'high', source: 'GEVES turfgrass-list.org' },
                rust: { rating: 7.04, confidence: 'high', source: 'GEVES turfgrass-list.org' }
            },

            traits: {
                wear: {
                    multiplier: 0.90,
                    confidence: 'high',
                    source: 'GEVES - Wear tolerance 6.75'
                },
                disease: {
                    redThread: {
                        riskMultiplier: 0.99,
                        confidence: 'high',
                        source: 'GEVES - Red thread 7.13 (moderate-good)'
                    },
                    winterFusarium: {
                        riskMultiplier: 1.00,
                        confidence: 'high',
                        source: 'GEVES - Winter fusarium 6.95 (moderate)'
                    }
                }
            }
        },

        'Annecy': {
            species: 'perennialRyegrass',
            displayName: 'Annecy',
            region: 'GEVES',
            owner: 'Innoseeds B.V.',
            registrationYear: 2016,
            catalogueCode: '4051690',
            marketAvailable: true,

            gevesRatings: {
                wearTolerance: 6.96,
                sportIndex: 7.15,
                lawnsIndex: 7.09,
                shootDensity: 7.39,
                establishment: 8.16,
                persistency: 7.21,
                globalAesthetic: 6.55,
                colorOfLeaves: 5.59,
                finenessOfLeaves: 6.9
            },

            diseaseResistance: {
                redThread: { rating: 7.02, confidence: 'high', source: 'GEVES turfgrass-list.org' },
                winterFusarium: { rating: 6.84, confidence: 'high', source: 'GEVES turfgrass-list.org' },
                summerFusarium: { rating: 6.77, confidence: 'high', source: 'GEVES turfgrass-list.org' },
                drechslera: { rating: 7.25, confidence: 'high', source: 'GEVES turfgrass-list.org' },
                rust: { rating: 8.23, confidence: 'high', source: 'GEVES turfgrass-list.org' }
            },

            traits: {
                wear: {
                    multiplier: 0.88,
                    confidence: 'high',
                    source: 'GEVES - Wear tolerance 6.96'
                },
                disease: {
                    redThread: {
                        riskMultiplier: 1.00,
                        confidence: 'high',
                        source: 'GEVES - Red thread 7.02 (moderate)'
                    },
                    winterFusarium: {
                        riskMultiplier: 1.01,
                        confidence: 'high',
                        source: 'GEVES - Winter fusarium 6.84 (moderate)'
                    },
                    rust: {
                        riskMultiplier: 0.94,
                        confidence: 'high',
                        source: 'GEVES - Rust 8.23 (very good)'
                    }
                }
            }
        },

        'Etienna': {
            species: 'perennialRyegrass',
            displayName: 'Etienna',
            region: 'GEVES',
            owner: 'DLF Seeds A/S',
            registrationYear: 2019,
            catalogueCode: '4058798',
            marketAvailable: true,

            gevesRatings: {
                wearTolerance: 6.98,
                sportIndex: 7.24,
                lawnsIndex: 7.24,
                shootDensity: 7.62,
                establishment: 8.24,
                persistency: 7.44,
                globalAesthetic: 6.65,
                colorOfLeaves: 5.89,
                finenessOfLeaves: 7.49
            },

            diseaseResistance: {
                redThread: { rating: 7.14, confidence: 'high', source: 'GEVES turfgrass-list.org' },
                winterFusarium: { rating: 7.57, confidence: 'high', source: 'GEVES turfgrass-list.org' },
                summerFusarium: { rating: 6.64, confidence: 'high', source: 'GEVES turfgrass-list.org' },
                drechslera: { rating: 6.53, confidence: 'high', source: 'GEVES turfgrass-list.org' },
                rust: { rating: 8.38, confidence: 'high', source: 'GEVES turfgrass-list.org' }
            },

            traits: {
                wear: {
                    multiplier: 0.87,
                    confidence: 'high',
                    source: 'GEVES - Wear tolerance 6.98'
                },
                disease: {
                    redThread: {
                        riskMultiplier: 0.99,
                        confidence: 'high',
                        source: 'GEVES - Red thread 7.14 (moderate-good)'
                    },
                    winterFusarium: {
                        riskMultiplier: 0.97,
                        confidence: 'high',
                        source: 'GEVES - Winter fusarium 7.57 (good)'
                    },
                    rust: {
                        riskMultiplier: 0.93,
                        confidence: 'high',
                        source: 'GEVES - Rust 8.38 (very good)'
                    }
                }
            }
        },

        'Eurocordus': {
            species: 'perennialRyegrass',
            displayName: 'Eurocordus',
            region: 'GEVES',
            owner: 'Deutsche Saatveredelung AG (DSV)',
            registrationYear: 2017,
            catalogueCode: '4054002',
            marketAvailable: true,

            gevesRatings: {
                wearTolerance: 6.86,
                sportIndex: 7.03,
                lawnsIndex: 6.96,
                shootDensity: 7.3,
                establishment: 7.98,
                persistency: 7.3,
                globalAesthetic: 6.36,
                colorOfLeaves: 5.54,
                finenessOfLeaves: 6.66
            },

            diseaseResistance: {
                redThread: { rating: 7.45, confidence: 'high', source: 'GEVES turfgrass-list.org' },
                winterFusarium: { rating: 7.16, confidence: 'high', source: 'GEVES turfgrass-list.org' },
                summerFusarium: { rating: null, confidence: 'none', source: 'Not tested' },
                drechslera: { rating: 6.26, confidence: 'high', source: 'GEVES turfgrass-list.org' },
                rust: { rating: 6.2, confidence: 'high', source: 'GEVES turfgrass-list.org' }
            },

            traits: {
                wear: {
                    multiplier: 0.89,
                    confidence: 'high',
                    source: 'GEVES - Wear tolerance 6.86'
                },
                disease: {
                    redThread: {
                        riskMultiplier: 0.98,
                        confidence: 'high',
                        source: 'GEVES - Red thread 7.45 (good)'
                    },
                    winterFusarium: {
                        riskMultiplier: 0.99,
                        confidence: 'high',
                        source: 'GEVES - Winter fusarium 7.16 (moderate-good)'
                    },
                    rust: {
                        riskMultiplier: 1.04,
                        confidence: 'high',
                        source: 'GEVES - Rust 6.2 (below average)'
                    }
                }
            }
        },

        'Clementine': {
            species: 'perennialRyegrass',
            displayName: 'Clementine',
            region: 'GEVES',
            owner: 'DLF Trifolium A/S',
            registrationYear: 2011,
            retest: 2021,
            catalogueCode: '1024686',
            marketAvailable: true,

            gevesRatings: {
                wearTolerance: 6.9,
                sportIndex: 7.16,
                lawnsIndex: 7.1,
                shootDensity: 7.63,
                establishment: 7.92,
                persistency: 7.09,
                globalAesthetic: 6.57,
                colorOfLeaves: 5.19,
                finenessOfLeaves: 7.12
            },

            diseaseResistance: {
                redThread: { rating: 7.21, confidence: 'high', source: 'GEVES turfgrass-list.org' },
                winterFusarium: { rating: 6.97, confidence: 'high', source: 'GEVES turfgrass-list.org' },
                summerFusarium: { rating: 7.15, confidence: 'high', source: 'GEVES turfgrass-list.org' },
                drechslera: { rating: 6.02, confidence: 'high', source: 'GEVES turfgrass-list.org' },
                rust: { rating: 7.24, confidence: 'high', source: 'GEVES turfgrass-list.org' }
            },

            traits: {
                wear: {
                    multiplier: 0.88,
                    confidence: 'high',
                    source: 'GEVES - Wear tolerance 6.9'
                },
                disease: {
                    redThread: {
                        riskMultiplier: 0.99,
                        confidence: 'high',
                        source: 'GEVES - Red thread 7.21 (moderate-good)'
                    },
                    winterFusarium: {
                        riskMultiplier: 1.00,
                        confidence: 'high',
                        source: 'GEVES - Winter fusarium 6.97 (moderate)'
                    }
                }
            }
        },

        'Chardin': {
            species: 'perennialRyegrass',
            displayName: 'Chardin',
            region: 'GEVES',
            owner: 'DLF Trifolium A/S',
            registrationYear: 2010,
            retest: 2020,
            catalogueCode: '1018601',
            marketAvailable: true,

            gevesRatings: {
                wearTolerance: 6.88,
                sportIndex: 7.16,
                lawnsIndex: 7.13,
                shootDensity: 7.55,
                establishment: 8.14,
                persistency: 7.22,
                globalAesthetic: 6.6,
                colorOfLeaves: 4.66,
                finenessOfLeaves: 7.16
            },

            diseaseResistance: {
                redThread: { rating: 6.95, confidence: 'high', source: 'GEVES turfgrass-list.org' },
                winterFusarium: { rating: 7.79, confidence: 'high', source: 'GEVES turfgrass-list.org' },
                summerFusarium: { rating: 6.26, confidence: 'high', source: 'GEVES turfgrass-list.org' },
                drechslera: { rating: 6.47, confidence: 'high', source: 'GEVES turfgrass-list.org' },
                rust: { rating: 7.47, confidence: 'high', source: 'GEVES turfgrass-list.org' }
            },

            traits: {
                wear: {
                    multiplier: 0.89,
                    confidence: 'high',
                    source: 'GEVES - Wear tolerance 6.88'
                },
                disease: {
                    redThread: {
                        riskMultiplier: 1.00,
                        confidence: 'high',
                        source: 'GEVES - Red thread 6.95 (moderate)'
                    },
                    winterFusarium: {
                        riskMultiplier: 0.96,
                        confidence: 'high',
                        source: 'GEVES - Winter fusarium 7.79 (good)'
                    },
                    rust: {
                        riskMultiplier: 0.98,
                        confidence: 'high',
                        source: 'GEVES - Rust 7.47 (good)'
                    }
                }
            }
        },

        'Tetrastar': {
            species: 'perennialRyegrass',
            displayName: 'Tetrastar 4turf',
            region: 'GEVES',
            type: 'tetraploid',
            owner: 'DLF Trifolium A/S',
            registrationYear: 2014,
            catalogueCode: '4047205',
            marketAvailable: true,

            gevesRatings: {
                wearTolerance: 6.59,
                sportIndex: 6.75,
                lawnsIndex: 6.75,
                shootDensity: 6.71,
                establishment: 7.73,
                persistency: 7.43,
                globalAesthetic: 6.21,
                colorOfLeaves: 7.03,
                finenessOfLeaves: 6.27
            },

            diseaseResistance: {
                redThread: { rating: 7.49, confidence: 'high', source: 'GEVES turfgrass-list.org' },
                winterFusarium: { rating: 8.16, confidence: 'high', source: 'GEVES turfgrass-list.org' },
                summerFusarium: { rating: 7.12, confidence: 'high', source: 'GEVES turfgrass-list.org' },
                drechslera: { rating: 6.69, confidence: 'high', source: 'GEVES turfgrass-list.org' },
                rust: { rating: 7.89, confidence: 'high', source: 'GEVES turfgrass-list.org' }
            },

            traits: {
                wear: {
                    multiplier: 0.92,
                    confidence: 'high',
                    source: 'GEVES - Wear tolerance 6.59 (tetraploid)'
                },
                disease: {
                    redThread: {
                        riskMultiplier: 0.98,
                        confidence: 'high',
                        source: 'GEVES - Red thread 7.49 (good)'
                    },
                    winterFusarium: {
                        riskMultiplier: 0.94,
                        confidence: 'high',
                        source: 'GEVES - Winter fusarium 8.16 (very good)'
                    },
                    rust: {
                        riskMultiplier: 0.96,
                        confidence: 'high',
                        source: 'GEVES - Rust 7.89 (good)'
                    }
                }
            }
        },

        'Fabian': {
            species: 'perennialRyegrass',
            displayName: 'Fabian 4turf',
            region: 'GEVES',
            type: 'tetraploid',
            owner: 'DLF Trifolium A/S',
            registrationYear: 2012,
            retest: 2022,
            catalogueCode: '1029024',
            marketAvailable: true,

            gevesRatings: {
                wearTolerance: 6.75,
                sportIndex: 6.83,
                lawnsIndex: 6.8,
                shootDensity: 6.77,
                establishment: 7.47,
                persistency: 7.58,
                globalAesthetic: 6.19,
                colorOfLeaves: 6.46,
                finenessOfLeaves: 6.14
            },

            diseaseResistance: {
                redThread: { rating: 7.9, confidence: 'high', source: 'GEVES turfgrass-list.org' },
                winterFusarium: { rating: 7.74, confidence: 'high', source: 'GEVES turfgrass-list.org' },
                summerFusarium: { rating: 6.91, confidence: 'high', source: 'GEVES turfgrass-list.org' },
                drechslera: { rating: 6.79, confidence: 'high', source: 'GEVES turfgrass-list.org' },
                rust: { rating: 7.51, confidence: 'high', source: 'GEVES turfgrass-list.org' }
            },

            traits: {
                wear: {
                    multiplier: 0.90,
                    confidence: 'high',
                    source: 'GEVES - Wear tolerance 6.75 (tetraploid)'
                },
                disease: {
                    redThread: {
                        riskMultiplier: 0.96,
                        confidence: 'high',
                        source: 'GEVES - Red thread 7.9 (good)'
                    },
                    winterFusarium: {
                        riskMultiplier: 0.96,
                        confidence: 'high',
                        source: 'GEVES - Winter fusarium 7.74 (good)'
                    },
                    rust: {
                        riskMultiplier: 0.97,
                        confidence: 'high',
                        source: 'GEVES - Rust 7.51 (good)'
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
 * Convert GEVES 1-9 rating to risk multiplier
 * Baseline: 7.0 = 1.0 multiplier (average in French trials is ~7.0-7.3)
 * Each point above/below shifts multiplier by ~0.05
 */
function gevesRatingToMultiplier(rating, baseline = 7.0) {
    if (!rating || rating === null) return 1.0;
    const multiplier = 1.0 + ((baseline - rating) * 0.05);
    return Math.round(multiplier * 100) / 100;
}

/**
 * Get variety data from GEVES database
 */
function getGEVESVarietyData(varietyName) {
    const normalizedName = varietyName.trim();
    
    // Search all species categories
    for (const speciesKey of Object.keys(GEVESVarietyTraits)) {
        if (speciesKey === 'version' || speciesKey === 'source' || speciesKey === 'dataVerified') continue;
        
        const speciesData = GEVESVarietyTraits[speciesKey];
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
 * Get GEVES disease modifier for a variety
 * @param {string} varietyName - Variety name
 * @param {string} diseaseName - Disease type (redThread, winterFusarium, summerFusarium, drechslera, rust)
 * @returns {object} - { multiplier, confidence, source }
 */
function getGEVESDiseaseModifier(varietyName, diseaseName) {
    const variety = getGEVESVarietyData(varietyName);
    
    if (!variety) {
        return { multiplier: 1.0, confidence: 'none', source: 'Variety not in GEVES database' };
    }
    
    // Check if placeholder
    if (variety.traits?._placeholder) {
        return { multiplier: 1.0, confidence: 'none', source: 'GEVES data pending verification' };
    }
    
    // Map disease names to GEVES equivalents
    const diseaseMapping = {
        'redThread': 'redThread',
        'fusarium': 'winterFusarium',
        'microdochium': 'winterFusarium',
        'microdochiumPatch': 'winterFusarium',
        'winterFusarium': 'winterFusarium',
        'summerFusarium': 'summerFusarium',
        'drechslera': 'drechslera',
        'leafSpot': 'drechslera',
        'rust': 'rust',
        'crownRust': 'rust'
    };
    
    const diseaseKey = diseaseMapping[diseaseName] || diseaseName;
    
    // Check disease resistance ratings
    if (variety.diseaseResistance && variety.diseaseResistance[diseaseKey]) {
        const rating = variety.diseaseResistance[diseaseKey].rating;
        if (rating === null) {
            return { multiplier: 1.0, confidence: 'none', source: 'Not tested in GEVES trials' };
        }
        
        return {
            multiplier: gevesRatingToMultiplier(rating),
            confidence: variety.diseaseResistance[diseaseKey].confidence,
            source: variety.diseaseResistance[diseaseKey].source
        };
    }
    
    // Check traits.disease
    if (variety.traits?.disease?.[diseaseKey]) {
        return {
            multiplier: variety.traits.disease[diseaseKey].riskMultiplier,
            confidence: variety.traits.disease[diseaseKey].confidence,
            source: variety.traits.disease[diseaseKey].source
        };
    }
    
    return { multiplier: 1.0, confidence: 'none', source: 'No GEVES disease data for this variety' };
}

/**
 * Get GEVES wear modifier
 */
function getGEVESWearModifier(varietyName) {
    const variety = getGEVESVarietyData(varietyName);
    
    if (!variety) {
        return { multiplier: 1.0, confidence: 'none', source: 'Variety not in GEVES database' };
    }
    
    if (variety.traits?._placeholder) {
        return { multiplier: 1.0, confidence: 'none', source: 'GEVES data pending verification' };
    }
    
    if (variety.gevesRatings?.wearTolerance) {
        // Convert to multiplier (7.0 = 1.0 baseline, lower = better wear)
        const multiplier = gevesRatingToMultiplier(variety.gevesRatings.wearTolerance, 6.8);
        return {
            multiplier: multiplier,
            confidence: 'high',
            source: `GEVES - Wear tolerance ${variety.gevesRatings.wearTolerance}`
        };
    }
    
    if (variety.traits?.wear) {
        return variety.traits.wear;
    }
    
    return { multiplier: 1.0, confidence: 'none', source: 'No GEVES wear data' };
}

/**
 * List all varieties in GEVES database
 */
function listGEVESVarieties(speciesFilter = null, includePlaceholders = false) {
    const results = [];
    
    for (const speciesKey of Object.keys(GEVESVarietyTraits)) {
        if (speciesKey === 'version' || speciesKey === 'source' || speciesKey === 'dataVerified') continue;
        
        if (speciesFilter && speciesKey !== speciesFilter) continue;
        
        const speciesData = GEVESVarietyTraits[speciesKey];
        for (const varietyName of Object.keys(speciesData)) {
            const variety = speciesData[varietyName];
            
            // Skip placeholders unless requested
            if (!includePlaceholders && variety.traits?._placeholder) continue;
            
            results.push({
                name: varietyName,
                species: speciesKey,
                displayName: variety.displayName || varietyName,
                verified: !variety.traits?._placeholder
            });
        }
    }
    
    return results;
}

/**
 * Check if variety exists in GEVES database (with verified data)
 */
function isGEVESVariety(varietyName, requireVerified = true) {
    const variety = getGEVESVarietyData(varietyName);
    if (!variety) return false;
    if (requireVerified && variety.traits?._placeholder) return false;
    return true;
}

// Export for Node.js / WordPress
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        GEVESVarietyTraits,
        getGEVESVarietyData,
        getGEVESDiseaseModifier,
        getGEVESWearModifier,
        listGEVESVarieties,
        isGEVESVariety,
        gevesRatingToMultiplier
    };
}

// Export to window for browser
if (typeof window !== 'undefined') {
    window.GEVESVarietyTraits = GEVESVarietyTraits;
    window.GAIP_GEVES_VARIETIES = GEVESVarietyTraits;  // Alias for variety-traits-integration.js
    window.getGEVESVarietyData = getGEVESVarietyData;
    window.getGEVESDiseaseModifier = getGEVESDiseaseModifier;
    window.getGEVESWearModifier = getGEVESWearModifier;
    window.listGEVESVarieties = listGEVESVarieties;
    window.isGEVESVariety = isGEVESVariety;
}

// Log on load
if (typeof console !== 'undefined') {
}
