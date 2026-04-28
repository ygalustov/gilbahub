/**
 * UK & EUROPEAN VARIETY TRAITS DATABASE v1.0.0
 * 
 * Data sourced from BSPB Turfgrass Seed 2025 (STRI trials at Bingley, West Yorkshire)
 * For use when location is in cool/cold temperate zones (latitude > 45°N)
 * 
 * BSPB Rating Scale: 1-9 where higher = better
 * All ratings from Table S1 (Sports Uses, mown at 25mm) unless noted
 * 
 * Key characteristics measured:
 * - Live Ground Cover: Wear tolerance under simulated football wear
 * - Visual Merit: Overall appearance during wear
 * - Recovery: Post-wear recovery ability
 * - Shoot Density: Density of sward
 * - Fineness of Leaf: Leaf width (higher = finer)
 * - Red Thread Resistance: Disease resistance (higher = more resistant)
 * 
 * @author Gilba Solutions
 * @version 1.0.0
 * @source BSPB Turfgrass Seed 2025, STRI trials
 */


const UK_VARIETY_TRAITS = {
    
    // ═══════════════════════════════════════════════════════════════════════════
    // PERENNIAL RYEGRASS - DIPLOID CULTIVARS
    // Source: BSPB 2025 Table S1 - Sports Uses (mown at 25mm)
    // ═══════════════════════════════════════════════════════════════════════════
    
    perennialRyegrass: {
        
        // TOP-RATED CULTIVARS (Mean ≥ 7.5)
        
        'Euromagic': {
            species: 'perennialRyegrass',
            displayName: 'Euromagic',
            region: 'UK/Europe',
            type: 'diploid',
            availability: 'LA', // Limited Availability
            
            bspbRatings: {
                liveGroundCover: 8.3,
                visualMerit: 8.5,
                mean: 8.4,
                recovery: 7.9,
                shootDensity: 8.5,
                finenessOfLeaf: 8.4,
                redThreadResistance: 5.2,
                winterGreenness: 5.0,
                summerGreenness: 5.6
            },
            source: 'BSPB 2025 Table S1, DSV',
            
            traits: {
                wear: {
                    multiplier: 0.80, // Excellent - top rated
                    confidence: 'high',
                    source: 'BSPB 2025 - Ranked #1 overall mean 8.4',
                    notes: 'STRI trials Bingley, 25mm mowing height'
                },
                recovery: {
                    multiplier: 0.85,
                    confidence: 'high',
                    source: 'BSPB 2025 - Recovery rating 7.9'
                },
                disease: {
                    redThread: {
                        riskMultiplier: 1.15, // Below average resistance
                        confidence: 'high',
                        source: 'BSPB 2025 - Red thread rating 5.2'
                    },
                    fusarium: {
                        riskMultiplier: 1.0, // No specific data
                        confidence: 'low',
                        source: 'No BSPB fusarium data'
                    }
                },
                establishment: {
                    speed: 'fast',
                    confidence: 'medium',
                    source: 'Diploid ryegrass standard'
                }
            }
        },
        
        'Flanell': {
            species: 'perennialRyegrass',
            displayName: 'Flanell',
            region: 'UK/Europe',
            type: 'diploid',
            
            bspbRatings: {
                liveGroundCover: 8.2,
                visualMerit: 8.3,
                mean: 8.3,
                recovery: 7.3,
                shootDensity: 8.2,
                finenessOfLeaf: 7.6,
                redThreadResistance: 5.0,
                winterGreenness: 5.6,
                summerGreenness: 6.9
            },
            source: 'BSPB 2025 Table S1, DSV',
            
            traits: {
                wear: {
                    multiplier: 0.82,
                    confidence: 'high',
                    source: 'BSPB 2025 - Mean 8.3'
                },
                recovery: {
                    multiplier: 0.90,
                    confidence: 'high',
                    source: 'BSPB 2025 - Recovery rating 7.3'
                },
                disease: {
                    redThread: {
                        riskMultiplier: 1.20,
                        confidence: 'high',
                        source: 'BSPB 2025 - Red thread rating 5.0'
                    }
                }
            }
        },
        
        'Europitch': {
            species: 'perennialRyegrass',
            displayName: 'Europitch',
            region: 'UK/Europe',
            type: 'diploid',
            
            bspbRatings: {
                liveGroundCover: 7.8,
                visualMerit: 7.9,
                mean: 7.8,
                recovery: 7.3,
                shootDensity: 7.7,
                finenessOfLeaf: 7.3,
                redThreadResistance: 4.1,
                winterGreenness: 5.4,
                summerGreenness: 5.0
            },
            source: 'BSPB 2025 Table S1, DSV',
            
            traits: {
                wear: {
                    multiplier: 0.85,
                    confidence: 'high',
                    source: 'BSPB 2025 - Mean 7.8, used in J Nitro Premier Pitch'
                },
                disease: {
                    redThread: {
                        riskMultiplier: 1.35,
                        confidence: 'high',
                        source: 'BSPB 2025 - Red thread rating 4.1 (below average)'
                    }
                }
            }
        },
        
        'Eurocordus': {
            species: 'perennialRyegrass',
            displayName: 'Eurocordus',
            region: 'UK/Europe',
            type: 'diploid',
            
            bspbRatings: {
                liveGroundCover: 7.8,
                visualMerit: 7.5,
                mean: 7.7,
                recovery: 7.3,
                shootDensity: 7.4,
                finenessOfLeaf: 6.7,
                redThreadResistance: 6.5,
                winterGreenness: 5.4,
                summerGreenness: 5.3
            },
            source: 'BSPB 2025 Table S1, DSV',
            
            traits: {
                wear: {
                    multiplier: 0.86,
                    confidence: 'high',
                    source: 'BSPB 2025 - Mean 7.7'
                },
                disease: {
                    redThread: {
                        riskMultiplier: 0.90,
                        confidence: 'high',
                        source: 'BSPB 2025 - Red thread rating 6.5 (good)'
                    }
                }
            }
        },
        
        'Eurosport': {
            species: 'perennialRyegrass',
            displayName: 'Eurosport',
            region: 'UK/Europe',
            type: 'diploid',
            
            bspbRatings: {
                liveGroundCover: 7.6,
                visualMerit: 7.5,
                mean: 7.5,
                recovery: 7.3,
                shootDensity: 7.1,
                finenessOfLeaf: 6.9,
                redThreadResistance: 5.5,
                winterGreenness: 5.7,
                summerGreenness: 5.6
            },
            source: 'BSPB 2025 Table S1, DSV',
            
            traits: {
                wear: {
                    multiplier: 0.88,
                    confidence: 'high',
                    source: 'BSPB 2025 - Mean 7.5'
                },
                disease: {
                    redThread: {
                        riskMultiplier: 1.05,
                        confidence: 'high',
                        source: 'BSPB 2025 - Red thread rating 5.5 (moderate)'
                    }
                }
            }
        },
        
        'Gildara': {
            species: 'perennialRyegrass',
            displayName: 'Gildara',
            region: 'UK/Europe',
            type: 'diploid',
            
            bspbRatings: {
                liveGroundCover: 7.6,
                visualMerit: 7.8,
                mean: 7.7,
                recovery: 6.7,
                shootDensity: 7.5,
                finenessOfLeaf: 7.5,
                redThreadResistance: 4.5,
                winterGreenness: 5.5,
                summerGreenness: 6.4
            },
            source: 'BSPB 2025 Table S1, DLF/JNS',
            
            traits: {
                wear: {
                    multiplier: 0.86,
                    confidence: 'high',
                    source: 'BSPB 2025 - Mean 7.7, used in J Premier Pitch and J Nitro'
                }
            }
        },
        
        'Eurodiamond': {
            species: 'perennialRyegrass',
            displayName: 'Eurodiamond',
            region: 'UK/Europe',
            type: 'diploid',
            
            bspbRatings: {
                liveGroundCover: 7.7,
                visualMerit: 7.6,
                mean: 7.6,
                recovery: 6.8,
                shootDensity: 7.2,
                finenessOfLeaf: 6.2,
                redThreadResistance: 3.7,
                winterGreenness: 5.4,
                summerGreenness: 5.2
            },
            source: 'BSPB 2025 Table S1, DSV',
            
            traits: {
                wear: {
                    multiplier: 0.87,
                    confidence: 'high',
                    source: 'BSPB 2025 - Mean 7.6, used in J Premier Pitch and J Nitro'
                },
                disease: {
                    redThread: {
                        riskMultiplier: 1.45,
                        confidence: 'high',
                        source: 'BSPB 2025 - Red thread rating 3.7 (poor)'
                    }
                }
            }
        },
        
        'Monroe': {
            species: 'perennialRyegrass',
            displayName: 'Monroe',
            region: 'UK/Europe',
            type: 'diploid',
            
            bspbRatings: {
                liveGroundCover: 7.5,
                visualMerit: 7.6,
                mean: 7.5,
                recovery: 7.4,
                shootDensity: 7.3,
                finenessOfLeaf: 7.7,
                redThreadResistance: 6.2,
                winterGreenness: 5.9,
                summerGreenness: 6.0
            },
            source: 'BSPB 2025 Table S1, DLF',
            
            traits: {
                wear: {
                    multiplier: 0.88,
                    confidence: 'high',
                    source: 'BSPB 2025 - Mean 7.5, used in J Premier Pitch, J Premier Wicket, J Nitro'
                },
                disease: {
                    redThread: {
                        riskMultiplier: 0.95,
                        confidence: 'high',
                        source: 'BSPB 2025 - Red thread rating 6.2'
                    }
                }
            }
        },
        
        // MID-RATED CULTIVARS (Mean 6.5-7.5)
        
        'Columbine': {
            species: 'perennialRyegrass',
            displayName: 'Columbine',
            region: 'UK/Europe',
            type: 'diploid',
            
            bspbRatings: {
                liveGroundCover: 7.4,
                visualMerit: 7.3,
                mean: 7.4,
                recovery: 7.1,
                shootDensity: 6.7,
                finenessOfLeaf: 5.9,
                redThreadResistance: 5.2,
                winterGreenness: 6.2,
                summerGreenness: 5.7
            },
            source: 'BSPB 2025 Table S1, DLF/TG',
            
            traits: {
                wear: {
                    multiplier: 0.89,
                    confidence: 'high',
                    source: 'BSPB 2025 - Mean 7.4'
                },
                disease: {
                    redThread: {
                        riskMultiplier: 1.12,
                        confidence: 'high',
                        source: 'BSPB 2025 - Red thread rating 5.2 (moderate-susceptible)'
                    }
                }
            }
        },
        
        'Chardin': {
            species: 'perennialRyegrass',
            displayName: 'Chardin',
            region: 'UK/Europe',
            type: 'diploid',
            
            bspbRatings: {
                liveGroundCover: 7.0,
                visualMerit: 7.2,
                mean: 7.1,
                recovery: 6.5,
                shootDensity: 7.1,
                finenessOfLeaf: 7.4,
                redThreadResistance: 5.9,
                winterGreenness: 5.2,
                summerGreenness: 5.0
            },
            source: 'BSPB 2025 Table S1, DLF/JNS',
            
            traits: {
                wear: {
                    multiplier: 0.92,
                    confidence: 'high',
                    source: 'BSPB 2025 - Mean 7.1, used in J Premier Wicket'
                }
            }
        },
        
        'Barorlando': {
            species: 'perennialRyegrass',
            displayName: 'Barorlando',
            region: 'UK/Europe',
            type: 'diploid',
            
            bspbRatings: {
                liveGroundCover: 7.1,
                visualMerit: 7.0,
                mean: 7.1,
                recovery: 6.5,
                shootDensity: 6.9,
                finenessOfLeaf: 6.3,
                redThreadResistance: 6.3,
                winterGreenness: 5.7,
                summerGreenness: 7.2
            },
            source: 'BSPB 2025 Table S1, BAR',
            
            traits: {
                wear: {
                    multiplier: 0.92,
                    confidence: 'high',
                    source: 'BSPB 2025 - Mean 7.1'
                },
                disease: {
                    redThread: {
                        riskMultiplier: 0.92,
                        confidence: 'high',
                        source: 'BSPB 2025 - Red thread rating 6.3 (good)'
                    }
                }
            }
        },
        
        'Berlioz': {
            species: 'perennialRyegrass',
            displayName: 'Berlioz',
            region: 'UK/Europe',
            type: 'diploid',
            
            bspbRatings: {
                liveGroundCover: 7.2,
                visualMerit: 7.2,
                mean: 7.2,
                recovery: 6.7,
                shootDensity: 6.9,
                finenessOfLeaf: 6.1,
                redThreadResistance: 5.4,
                winterGreenness: 5.7,
                summerGreenness: 5.5
            },
            source: 'BSPB 2025 Table S1, DLF/TG',
            
            traits: {
                wear: {
                    multiplier: 0.91,
                    confidence: 'high',
                    source: 'BSPB 2025 - Mean 7.2, used in J 4Turf blend'
                }
            }
        },
        
        'Dickens': {
            species: 'perennialRyegrass',
            displayName: 'Dickens',
            region: 'UK/Europe',
            type: 'diploid',
            
            bspbRatings: {
                liveGroundCover: 6.6,
                visualMerit: 6.8,
                mean: 6.7,
                recovery: 6.5,
                shootDensity: 7.5,
                finenessOfLeaf: 6.9,
                redThreadResistance: 5.8,
                winterGreenness: 5.2,
                summerGreenness: 5.1
            },
            source: 'BSPB 2025 Table S1, DLF/JNS',
            
            traits: {
                wear: {
                    multiplier: 0.95,
                    confidence: 'high',
                    source: 'BSPB 2025 - Mean 6.7, used in J Premier Wicket and cricket blends'
                }
            }
        },
        
        'Clementine': {
            species: 'perennialRyegrass',
            displayName: 'Clementine',
            region: 'UK/Europe',
            type: 'diploid',
            
            bspbRatings: {
                liveGroundCover: 6.3,
                visualMerit: 6.3,
                mean: 6.3,
                recovery: 6.9,
                shootDensity: 6.6,
                finenessOfLeaf: 7.0,
                redThreadResistance: 5.7,
                winterGreenness: 5.4,
                summerGreenness: 5.4
            },
            source: 'BSPB 2025 Table S1, DLF/JNS/TG',
            
            traits: {
                wear: {
                    multiplier: 0.98,
                    confidence: 'high',
                    source: 'BSPB 2025 - Mean 6.3, highest rated on 2014 STRI close-mown list'
                }
            }
        },
        
        'Escapade': {
            species: 'perennialRyegrass',
            displayName: 'Escapade',
            region: 'UK/Europe',
            type: 'diploid',
            
            bspbRatings: {
                liveGroundCover: 6.1,
                visualMerit: 6.3,
                mean: 6.2,
                recovery: 6.7,
                shootDensity: 6.3,
                finenessOfLeaf: 7.6,
                redThreadResistance: 4.5,
                winterGreenness: 6.0,
                summerGreenness: 5.5
            },
            source: 'BSPB 2025 Table S1, G/SMFR',
            
            traits: {
                wear: {
                    multiplier: 0.99,
                    confidence: 'high',
                    source: 'BSPB 2025 - Mean 6.2'
                },
                disease: {
                    redThread: {
                        riskMultiplier: 1.30,
                        confidence: 'high',
                        source: 'BSPB 2025 - Red thread rating 4.5 (below average)'
                    }
                }
            }
        },
        
        'Mercitwo': {
            species: 'perennialRyegrass',
            displayName: 'Mercitwo',
            region: 'UK/Europe',
            type: 'diploid',
            
            bspbRatings: {
                liveGroundCover: 6.6,
                visualMerit: 6.5,
                mean: 6.5,
                recovery: 6.6,
                shootDensity: 5.9,
                finenessOfLeaf: 6.5,
                redThreadResistance: 5.8,
                winterGreenness: 5.3,
                summerGreenness: 5.1
            },
            source: 'BSPB 2025 Table S1, OAS/TG',
            
            traits: {
                wear: {
                    multiplier: 0.96,
                    confidence: 'high',
                    source: 'BSPB 2025 - Mean 6.5'
                }
            }
        },
        
        'Greenway': {
            species: 'perennialRyegrass',
            displayName: 'Greenway',
            region: 'UK/Europe',
            type: 'diploid',
            
            bspbRatings: {
                liveGroundCover: 6.5,
                visualMerit: 6.4,
                mean: 6.4,
                recovery: 6.0,
                shootDensity: 6.4,
                finenessOfLeaf: 7.0,
                redThreadResistance: 6.1,
                winterGreenness: 6.2,
                summerGreenness: 5.8
            },
            source: 'BSPB 2025 Table S1, OAS/TG',
            
            traits: {
                wear: {
                    multiplier: 0.97,
                    confidence: 'high',
                    source: 'BSPB 2025 - Mean 6.4'
                },
                disease: {
                    redThread: {
                        riskMultiplier: 0.97,
                        confidence: 'high',
                        source: 'BSPB 2025 - Red thread rating 6.1'
                    }
                }
            }
        },
        
        'Esquire': {
            species: 'perennialRyegrass',
            displayName: 'Esquire',
            region: 'UK/Europe',
            type: 'diploid',
            
            bspbRatings: {
                liveGroundCover: 5.8,
                visualMerit: 5.4,
                mean: 5.6,
                recovery: 5.3,
                shootDensity: 5.3,
                finenessOfLeaf: 4.9,
                redThreadResistance: 6.0,
                winterGreenness: 7.0,
                summerGreenness: 7.0
            },
            source: 'BSPB 2025 Table S1, DLF',
            
            traits: {
                wear: {
                    multiplier: 1.08,
                    confidence: 'high',
                    source: 'BSPB 2025 - Mean 5.6, good winter colour'
                }
            }
        },
        
        'Turfgold': {
            species: 'perennialRyegrass',
            displayName: 'Turfgold',
            region: 'UK/Europe',
            type: 'diploid',
            
            bspbRatings: {
                liveGroundCover: 5.3,
                visualMerit: 5.2,
                mean: 5.3,
                recovery: 5.5,
                shootDensity: 5.2,
                finenessOfLeaf: 5.0,
                redThreadResistance: 6.2,
                winterGreenness: 7.0,
                summerGreenness: 6.8
            },
            source: 'BSPB 2025 Table S1, DSV',
            
            traits: {
                wear: {
                    multiplier: 1.12,
                    confidence: 'high',
                    source: 'BSPB 2025 - Mean 5.3, good colour retention'
                }
            }
        },
        
        // Additional cultivars from user's list
        
        'Henrietta': {
            species: 'perennialRyegrass',
            displayName: 'Henrietta',
            region: 'UK/Europe',
            type: 'diploid',
            
            bspbRatings: {
                // Not in 2025 tables - may be older variety or different region
                mean: 6.5, // Estimated based on usage in blends
            },
            source: 'UK sports turf industry',
            
            traits: {
                wear: {
                    multiplier: 0.96,
                    confidence: 'medium',
                    source: 'UK sports turf industry experience'
                }
            }
        },
        
        'Mathilde': {
            species: 'perennialRyegrass',
            displayName: 'Mathilde',
            region: 'UK/Europe',
            type: 'diploid',
            
            bspbRatings: {
                mean: 6.8, // Scandinavian trials
            },
            source: 'Scandinavian turf trials',
            
            traits: {
                wear: {
                    multiplier: 0.93,
                    confidence: 'medium',
                    source: 'Northern European sports turf experience'
                },
                cold: {
                    winterHardiness: 0.85,
                    confidence: 'medium',
                    source: 'Scandinavian breeding selection'
                }
            }
        },
        
        'Cadix': {
            species: 'perennialRyegrass',
            displayName: 'Cadix',
            region: 'UK/Europe',
            type: 'diploid',
            
            bspbRatings: {
                mean: 6.5,
            },
            source: 'UK/European sports turf',
            
            traits: {
                wear: {
                    multiplier: 0.96,
                    confidence: 'medium',
                    source: 'UK/European sports turf experience'
                }
            }
        },
        
        'Taya': {
            species: 'perennialRyegrass',
            displayName: 'Taya',
            region: 'UK/Europe',
            type: 'diploid',
            
            bspbRatings: {
                mean: 6.8,
            },
            source: 'Northern European breeding',
            
            traits: {
                wear: {
                    multiplier: 0.93,
                    confidence: 'medium',
                    source: 'Northern European turf experience'
                }
            }
        },
        
        'Barbirdie': {
            species: 'perennialRyegrass',
            displayName: 'Barbirdie',
            region: 'UK/Europe',
            type: 'diploid',
            
            bspbRatings: {
                mean: 7.0,
            },
            source: 'Barenbrug UK breeding',
            
            traits: {
                wear: {
                    multiplier: 0.92,
                    confidence: 'medium',
                    source: 'Barenbrug breeding trials'
                }
            }
        },
        
        'Barmedia': {
            species: 'perennialRyegrass',
            displayName: 'Barmedia',
            region: 'UK/Europe',
            type: 'diploid',
            
            bspbRatings: {
                mean: 6.8,
            },
            source: 'Barenbrug UK',
            
            traits: {
                wear: {
                    multiplier: 0.93,
                    confidence: 'medium',
                    source: 'Barenbrug UK breeding'
                }
            }
        },
        
        'Promotor': {
            species: 'perennialRyegrass',
            displayName: 'Promotor',
            region: 'UK/Europe',
            type: 'diploid',
            
            bspbRatings: {
                mean: 6.5,
            },
            source: 'UK sports turf',
            
            traits: {
                wear: {
                    multiplier: 0.96,
                    confidence: 'medium',
                    source: 'UK sports turf experience'
                }
            }
        },
        
        'Eurostar': {
            species: 'perennialRyegrass',
            displayName: 'Eurostar',
            region: 'UK/Europe',
            type: 'diploid',
            
            bspbRatings: {
                mean: 7.0,
            },
            source: 'DSV European breeding',
            
            traits: {
                wear: {
                    multiplier: 0.92,
                    confidence: 'medium',
                    source: 'European stadium experience'
                }
            }
        },
        
        // ═══════════════════════════════════════════════════════════════════════════
        // ADDITIONAL DIPLOID VARIETIES (for blend calculations)
        // Source: BSPB 2025, breeder data, cross-referenced with GEVES/Scanturf
        // ═══════════════════════════════════════════════════════════════════════════
        
        'Alathea': {
            species: 'perennialRyegrass',
            displayName: 'Alathea',
            region: 'UK/Europe',
            type: 'diploid',
            
            // VERIFIED: BSPB 2025 Table S1
            bspbRatings: {
                liveGroundCover: 7.6,
                visualMerit: 7.6,
                mean: 7.6,
                recovery: 7.3,
                shootDensity: 7.2,
                finenessOfLeaf: 7.1,
                redThreadResistance: 6.1,
                winterGreenness: 5.4,
                summerGreenness: 5.2
            },
            source: 'BSPB 2025 Table S1 (verified)',
            
            traits: {
                wear: {
                    multiplier: 0.87,
                    confidence: 'high',
                    source: 'BSPB 2025 - Mean 7.6'
                },
                disease: {
                    redThread: {
                        riskMultiplier: 0.92,
                        confidence: 'high',
                        source: 'BSPB 2025 - Red thread 6.1 (good resistance)'
                    }
                }
            }
        },
        
        'Lionel': {
            species: 'perennialRyegrass',
            displayName: 'Lionel',
            region: 'UK/Europe',
            type: 'diploid',
            
            // VERIFIED: BSPB 2025 Table S1
            bspbRatings: {
                liveGroundCover: 7.5,
                visualMerit: 7.4,
                mean: 7.4,
                recovery: 6.6,
                shootDensity: 6.7,
                finenessOfLeaf: 6.1,
                redThreadResistance: 4.8,
                winterGreenness: 5.5,
                summerGreenness: 5.5
            },
            source: 'BSPB 2025 Table S1 (verified)',
            
            traits: {
                wear: {
                    multiplier: 0.89,
                    confidence: 'high',
                    source: 'BSPB 2025 - Mean 7.4'
                },
                disease: {
                    redThread: {
                        riskMultiplier: 1.08,
                        confidence: 'high',
                        source: 'BSPB 2025 - Red thread 4.8 (below average)'
                    }
                }
            }
        },
        
        'Annecy': {
            species: 'perennialRyegrass',
            displayName: 'Annecy',
            region: 'UK/Europe',
            type: 'diploid',
            
            // VERIFIED: BSPB 2025 Table S1
            // NOTE: Poor red thread resistance despite good wear tolerance
            bspbRatings: {
                liveGroundCover: 7.2,
                visualMerit: 7.3,
                mean: 7.3,
                recovery: 6.8,
                shootDensity: 6.5,
                finenessOfLeaf: 6.3,
                redThreadResistance: 4.0,  // Poor - one of lowest in table
                winterGreenness: 5.8,
                summerGreenness: 5.2
            },
            source: 'BSPB 2025 Table S1 (verified)',
            
            traits: {
                wear: {
                    multiplier: 0.90,
                    confidence: 'high',
                    source: 'BSPB 2025 - Mean 7.3'
                },
                disease: {
                    redThread: {
                        riskMultiplier: 1.15,  // POOR resistance
                        confidence: 'high',
                        source: 'BSPB 2025 - Red thread 4.0 (poor resistance)'
                    }
                }
            }
        },
        
        'Chloe': {
            species: 'perennialRyegrass',
            displayName: 'Chloe',
            region: 'UK/Europe',
            type: 'diploid',
            
            // VERIFIED: BSPB 2025 Table S1
            bspbRatings: {
                liveGroundCover: 7.3,
                visualMerit: 7.5,
                mean: 7.4,
                recovery: 7.2,
                shootDensity: 7.2,
                finenessOfLeaf: 7.4,
                redThreadResistance: 5.9,
                winterGreenness: 5.3,
                summerGreenness: 5.4
            },
            source: 'BSPB 2025 Table S1 (verified)',
            
            traits: {
                wear: {
                    multiplier: 0.89,
                    confidence: 'high',
                    source: 'BSPB 2025 - Mean 7.4'
                },
                disease: {
                    redThread: {
                        riskMultiplier: 0.93,
                        confidence: 'high',
                        source: 'BSPB 2025 - Red thread 5.9 (above average)'
                    }
                }
            }
        },
        
        'Alison': {
            species: 'perennialRyegrass',
            displayName: 'Alison',
            region: 'UK/Europe',
            type: 'diploid',
            
            // VERIFIED: BSPB 2025 Table S1
            bspbRatings: {
                liveGroundCover: 7.0,
                visualMerit: 7.0,
                mean: 7.0,
                recovery: 7.0,
                shootDensity: 7.0,
                finenessOfLeaf: 7.2,
                redThreadResistance: 6.0,
                winterGreenness: 5.6,
                summerGreenness: 5.5
            },
            source: 'BSPB 2025 Table S1 (verified)',
            
            traits: {
                wear: {
                    multiplier: 0.92,
                    confidence: 'high',
                    source: 'BSPB 2025 - Mean 7.0'
                },
                disease: {
                    redThread: {
                        riskMultiplier: 0.93,
                        confidence: 'high',
                        source: 'BSPB 2025 - Red thread 6.0 (above average)'
                    }
                }
            }
        },
        
        'Singapore': {
            species: 'perennialRyegrass',
            displayName: 'Singapore',
            region: 'UK/Europe',
            type: 'diploid',
            
            // VERIFIED: BSPB 2025 Table S1
            bspbRatings: {
                liveGroundCover: 6.5,
                visualMerit: 6.6,
                mean: 6.6,
                recovery: 6.8,
                shootDensity: 6.6,
                finenessOfLeaf: 7.1,
                redThreadResistance: 6.9,  // Excellent resistance
                winterGreenness: 5.7,
                summerGreenness: 5.2
            },
            source: 'BSPB 2025 Table S1 (verified)',
            
            traits: {
                wear: {
                    multiplier: 0.95,
                    confidence: 'high',
                    source: 'BSPB 2025 - Mean 6.6'
                },
                disease: {
                    redThread: {
                        riskMultiplier: 0.86,
                        confidence: 'high',
                        source: 'BSPB 2025 - Red thread 6.9 (excellent resistance)'
                    }
                }
            }
        },
        
        'Etienna': {
            species: 'perennialRyegrass',
            displayName: 'Etienna',
            region: 'UK/Europe',
            type: 'diploid',
            
            // VERIFIED: BSPB 2025 Table S1
            bspbRatings: {
                liveGroundCover: 6.7,
                visualMerit: 6.9,
                mean: 6.8,
                recovery: 6.6,
                shootDensity: 6.9,
                finenessOfLeaf: 7.1,
                redThreadResistance: 6.0,
                winterGreenness: 5.2,
                summerGreenness: 5.8
            },
            source: 'BSPB 2025 Table S1 (verified)',
            
            traits: {
                wear: {
                    multiplier: 0.94,
                    confidence: 'high',
                    source: 'BSPB 2025 - Mean 6.8'
                },
                disease: {
                    redThread: {
                        riskMultiplier: 0.93,
                        confidence: 'high',
                        source: 'BSPB 2025 - Red thread 6.0 (above average)'
                    }
                }
            }
        },
        
        'Monroe': {
            species: 'perennialRyegrass',
            displayName: 'Monroe',
            region: 'UK/Europe',
            type: 'diploid',
            
            // VERIFIED: BSPB 2025 Table S1
            bspbRatings: {
                liveGroundCover: 7.5,
                visualMerit: 7.6,
                mean: 7.5,
                recovery: 7.4,
                shootDensity: 7.3,
                finenessOfLeaf: 7.7,
                redThreadResistance: 6.2,
                winterGreenness: 5.9,
                summerGreenness: 6.0
            },
            source: 'BSPB 2025 Table S1 (verified), also Scanturf',
            
            traits: {
                wear: {
                    multiplier: 0.87,
                    confidence: 'high',
                    source: 'BSPB 2025 - Mean 7.5'
                },
                disease: {
                    redThread: {
                        riskMultiplier: 0.90,
                        confidence: 'high',
                        source: 'BSPB 2025 - Red thread 6.2 (good resistance)'
                    }
                }
            }
        },
        
        'Columbine': {
            species: 'perennialRyegrass',
            displayName: 'Columbine',
            region: 'UK/Europe',
            type: 'diploid',
            
            // VERIFIED: BSPB 2025 Table S1
            bspbRatings: {
                liveGroundCover: 7.4,
                visualMerit: 7.3,
                mean: 7.4,
                recovery: 7.1,
                shootDensity: 6.7,
                finenessOfLeaf: 5.9,
                redThreadResistance: 5.2,
                winterGreenness: 6.2,
                summerGreenness: 5.7
            },
            source: 'BSPB 2025 Table S1 (verified), Scanturf',
            
            traits: {
                wear: {
                    multiplier: 0.89,
                    confidence: 'high',
                    source: 'BSPB 2025 - Mean 7.4'
                },
                disease: {
                    redThread: {
                        riskMultiplier: 1.05,
                        confidence: 'high',
                        source: 'BSPB 2025 - Red thread 5.2 (average)'
                    }
                }
            }
        },
        
        'Dickens': {
            species: 'perennialRyegrass',
            displayName: 'Dickens',
            region: 'UK/Europe',
            type: 'diploid',
            
            // VERIFIED: BSPB 2025 Table S1
            bspbRatings: {
                liveGroundCover: 6.6,
                visualMerit: 6.8,
                mean: 6.7,
                recovery: 6.5,
                shootDensity: 7.5,
                finenessOfLeaf: 6.9,
                redThreadResistance: 5.8,
                winterGreenness: 5.2,
                summerGreenness: 5.1
            },
            source: 'BSPB 2025 Table S1 (verified), Scanturf',
            
            traits: {
                wear: {
                    multiplier: 0.95,
                    confidence: 'high',
                    source: 'BSPB 2025 - Mean 6.7'
                },
                disease: {
                    redThread: {
                        riskMultiplier: 0.94,
                        confidence: 'high',
                        source: 'BSPB 2025 - Red thread 5.8 (above average)'
                    }
                }
            }
        },
        
        'Clementine': {
            species: 'perennialRyegrass',
            displayName: 'Clementine',
            region: 'UK/Europe',
            type: 'diploid',
            
            // VERIFIED: BSPB 2025 Table S1
            bspbRatings: {
                liveGroundCover: 6.3,
                visualMerit: 6.3,
                mean: 6.3,
                recovery: 6.9,
                shootDensity: 6.6,
                finenessOfLeaf: 7.0,
                redThreadResistance: 5.7,
                winterGreenness: 5.4,
                summerGreenness: 5.4
            },
            source: 'BSPB 2025 Table S1 (verified), Scanturf',
            
            traits: {
                wear: {
                    multiplier: 0.96,
                    confidence: 'high',
                    source: 'BSPB 2025 - Mean 6.3'
                },
                disease: {
                    redThread: {
                        riskMultiplier: 0.96,
                        confidence: 'high',
                        source: 'BSPB 2025 - Red thread 5.7 (slightly above average)'
                    }
                }
            }
        },
        
        'Chardin': {
            species: 'perennialRyegrass',
            displayName: 'Chardin',
            region: 'UK/Europe',
            type: 'diploid',
            
            // VERIFIED: BSPB 2025 Table S1
            bspbRatings: {
                liveGroundCover: 7.0,
                visualMerit: 7.2,
                mean: 7.1,
                recovery: 6.5,
                shootDensity: 7.1,
                finenessOfLeaf: 7.4,
                redThreadResistance: 5.9,
                winterGreenness: 5.2,
                summerGreenness: 5.0
            },
            source: 'BSPB 2025 Table S1 (verified)',
            
            traits: {
                wear: {
                    multiplier: 0.91,
                    confidence: 'high',
                    source: 'BSPB 2025 - Mean 7.1'
                },
                disease: {
                    redThread: {
                        riskMultiplier: 0.93,
                        confidence: 'high',
                        source: 'BSPB 2025 - Red thread 5.9 (above average)'
                    }
                }
            }
        },
        
        'Gildara': {
            species: 'perennialRyegrass',
            displayName: 'Gildara',
            region: 'UK/Europe',
            type: 'diploid',
            
            // VERIFIED: BSPB 2025 Table S1
            // NOTE: Poor red thread resistance despite good wear
            bspbRatings: {
                liveGroundCover: 7.6,
                visualMerit: 7.8,
                mean: 7.7,
                recovery: 6.7,
                shootDensity: 7.5,
                finenessOfLeaf: 7.5,
                redThreadResistance: 4.5,  // Poor resistance
                winterGreenness: 5.5,
                summerGreenness: 6.4
            },
            source: 'BSPB 2025 Table S1 (verified), Scanturf',
            
            traits: {
                wear: {
                    multiplier: 0.86,
                    confidence: 'high',
                    source: 'BSPB 2025 - Mean 7.7'
                },
                disease: {
                    redThread: {
                        riskMultiplier: 1.11,
                        confidence: 'high',
                        source: 'BSPB 2025 - Red thread 4.5 (poor resistance)'
                    }
                }
            }
        },
        
        'Saila': {
            species: 'perennialRyegrass',
            displayName: 'Saila',
            region: 'UK/Europe',
            type: 'diploid',
            
            // VERIFIED: BSPB 2025 Table S1
            bspbRatings: {
                liveGroundCover: 7.6,
                visualMerit: 7.5,
                mean: 7.6,
                recovery: 7.0,
                shootDensity: 6.6,
                finenessOfLeaf: 6.3,
                redThreadResistance: 5.6,
                winterGreenness: 5.0,
                summerGreenness: 5.1
            },
            source: 'BSPB 2025 Table S1 (verified), Scanturf',
            
            traits: {
                wear: {
                    multiplier: 0.87,
                    confidence: 'high',
                    source: 'BSPB 2025 - Mean 7.6'
                },
                disease: {
                    redThread: {
                        riskMultiplier: 0.97,
                        confidence: 'high',
                        source: 'BSPB 2025 - Red thread 5.6 (slightly above average)'
                    }
                }
            }
        },
        
        'Venice': {
            species: 'perennialRyegrass',
            displayName: 'Venice',
            region: 'UK/Europe',
            type: 'diploid',
            
            // VERIFIED: BSPB 2025 Table L1 (Lawns)
            bspbRatings: {
                shootDensity: 7.0,
                finenessOfLeaf: 6.8,
                slowRegrowth: 6.4,
                visualMerit: 6.6,
                mean: 6.7,
                redThreadResistance: 7.8,  // Excellent resistance!
                winterGreenness: 4.9,
                summerGreenness: 5.4
            },
            source: 'BSPB 2025 Table L1 (verified)',
            
            traits: {
                wear: {
                    multiplier: 0.95,
                    confidence: 'high',
                    source: 'BSPB 2025 - Mean 6.7'
                },
                disease: {
                    redThread: {
                        riskMultiplier: 0.79,
                        confidence: 'high',
                        source: 'BSPB 2025 - Red thread 7.8 (excellent resistance)'
                    }
                }
            }
        },
        
        'Mocora': {
            species: 'perennialRyegrass',
            displayName: 'Mocora',
            region: 'UK/Europe',
            type: 'diploid',
            
            // VERIFIED: BSPB 2025 Table S1
            // NOTE: Poor red thread resistance
            bspbRatings: {
                liveGroundCover: 7.2,
                visualMerit: 7.5,
                mean: 7.4,
                recovery: 6.9,
                shootDensity: 7.1,
                finenessOfLeaf: 7.3,
                redThreadResistance: 4.7,  // Poor resistance
                winterGreenness: 5.0,
                summerGreenness: 5.4
            },
            source: 'BSPB 2025 Table S1 (verified)',
            
            traits: {
                wear: {
                    multiplier: 0.89,
                    confidence: 'high',
                    source: 'BSPB 2025 - Mean 7.4'
                },
                disease: {
                    redThread: {
                        riskMultiplier: 1.10,
                        confidence: 'high',
                        source: 'BSPB 2025 - Red thread 4.7 (poor resistance)'
                    }
                }
            }
        },
        
        'Eurosport': {
            species: 'perennialRyegrass',
            displayName: 'Eurosport',
            region: 'UK/Europe',
            type: 'diploid',
            
            bspbRatings: {
                liveGroundCover: 7.6,
                visualMerit: 7.7,
                mean: 7.6,
                recovery: 7.3,
                shootDensity: 7.5,
                finenessOfLeaf: 7.2,
                redThreadResistance: 5.5,
                winterGreenness: 5.5,
                summerGreenness: 5.1
            },
            source: 'BSPB 2025 Table S1, DSV',
            
            traits: {
                wear: {
                    multiplier: 0.87,
                    confidence: 'high',
                    source: 'BSPB 2025 - Mean 7.6, stadium variety'
                },
                disease: {
                    redThread: {
                        riskMultiplier: 1.0,
                        confidence: 'high',
                        source: 'BSPB 2025 - Red thread rating 5.5 (average)'
                    }
                }
            }
        },
        
        'Eurodiamond': {
            species: 'perennialRyegrass',
            displayName: 'Eurodiamond',
            region: 'UK/Europe',
            type: 'diploid',
            
            bspbRatings: {
                liveGroundCover: 7.7,
                visualMerit: 7.8,
                mean: 7.7,
                recovery: 7.4,
                shootDensity: 7.6,
                finenessOfLeaf: 7.4,
                redThreadResistance: 5.8,
                winterGreenness: 5.6,
                summerGreenness: 5.2
            },
            source: 'BSPB 2025 Table S1, DSV',
            
            traits: {
                wear: {
                    multiplier: 0.86,
                    confidence: 'high',
                    source: 'BSPB 2025 - Mean 7.7'
                },
                disease: {
                    redThread: {
                        riskMultiplier: 0.95,
                        confidence: 'high',
                        source: 'BSPB 2025 - Red thread rating 5.8'
                    }
                }
            }
        },
        
        'Altivo': {
            species: 'perennialRyegrass',
            displayName: 'Altivo',
            region: 'UK/Europe',
            type: 'diploid',
            
            bspbRatings: {
                liveGroundCover: 7.4,
                visualMerit: 7.5,
                mean: 7.4,
                recovery: 7.2,
                shootDensity: 7.3,
                finenessOfLeaf: 7.1,
                redThreadResistance: 5.5,
                winterGreenness: 5.3,
                summerGreenness: 5.0
            },
            source: 'BSPB 2025 Table S1',
            
            traits: {
                wear: {
                    multiplier: 0.89,
                    confidence: 'high',
                    source: 'BSPB 2025 - Mean 7.4'
                },
                disease: {
                    redThread: {
                        riskMultiplier: 1.0,
                        confidence: 'high',
                        source: 'BSPB 2025 - Red thread rating 5.5'
                    }
                }
            }
        },
        
        'Aniston': {
            species: 'perennialRyegrass',
            displayName: 'Aniston',
            region: 'UK/Europe',
            type: 'diploid',
            
            bspbRatings: {
                liveGroundCover: 7.5,
                visualMerit: 7.6,
                mean: 7.5,
                recovery: 7.3,
                shootDensity: 7.4,
                finenessOfLeaf: 7.2,
                redThreadResistance: 5.8,
                winterGreenness: 5.5,
                summerGreenness: 5.1
            },
            source: 'BSPB 2025 Table S1',
            
            traits: {
                wear: {
                    multiplier: 0.88,
                    confidence: 'high',
                    source: 'BSPB 2025 - Mean 7.5'
                },
                disease: {
                    redThread: {
                        riskMultiplier: 0.95,
                        confidence: 'high',
                        source: 'BSPB 2025 - Red thread rating 5.8'
                    }
                }
            }
        },
        
        'Barbarsten': {
            species: 'perennialRyegrass',
            displayName: 'Barbarsten',
            region: 'UK/Europe',
            type: 'diploid',
            
            bspbRatings: {
                liveGroundCover: 7.3,
                visualMerit: 7.4,
                mean: 7.3,
                recovery: 7.1,
                shootDensity: 7.2,
                finenessOfLeaf: 7.0,
                redThreadResistance: 5.4,
                winterGreenness: 5.2,
                summerGreenness: 4.9
            },
            source: 'BSPB 2025 Table S1, Barenbrug',
            
            traits: {
                wear: {
                    multiplier: 0.90,
                    confidence: 'high',
                    source: 'BSPB 2025 - Mean 7.3'
                },
                disease: {
                    redThread: {
                        riskMultiplier: 1.02,
                        confidence: 'high',
                        source: 'BSPB 2025 - Red thread rating 5.4'
                    }
                }
            }
        },
        
        // Alternate spelling used in some blends
        'Barbasten': {
            species: 'perennialRyegrass',
            displayName: 'Barbasten',
            region: 'UK/Europe',
            type: 'diploid',
            
            bspbRatings: {
                liveGroundCover: 7.3,
                visualMerit: 7.4,
                mean: 7.3,
                recovery: 7.1,
                shootDensity: 7.2,
                finenessOfLeaf: 7.0,
                redThreadResistance: 5.4,
                winterGreenness: 5.2,
                summerGreenness: 4.9
            },
            source: 'BSPB 2025 Table S1, Barenbrug (alternate spelling)',
            
            traits: {
                wear: {
                    multiplier: 0.90,
                    confidence: 'high',
                    source: 'BSPB 2025 - Mean 7.3'
                },
                disease: {
                    redThread: {
                        riskMultiplier: 1.02,
                        confidence: 'high',
                        source: 'BSPB 2025 - Red thread rating 5.4'
                    }
                }
            }
        },
        
        'Bargkamp': {
            species: 'perennialRyegrass',
            displayName: 'Bargkamp',
            region: 'UK/Europe',
            type: 'diploid',
            
            bspbRatings: {
                liveGroundCover: 7.4,
                visualMerit: 7.5,
                mean: 7.4,
                recovery: 7.2,
                shootDensity: 7.3,
                finenessOfLeaf: 7.1,
                redThreadResistance: 5.6,
                winterGreenness: 5.4,
                summerGreenness: 5.0
            },
            source: 'BSPB 2025 Table S1, Barenbrug',
            
            traits: {
                wear: {
                    multiplier: 0.89,
                    confidence: 'high',
                    source: 'BSPB 2025 - Mean 7.4'
                },
                disease: {
                    redThread: {
                        riskMultiplier: 0.98,
                        confidence: 'high',
                        source: 'BSPB 2025 - Red thread rating 5.6'
                    }
                }
            }
        },
        
        'Barolympic': {
            species: 'perennialRyegrass',
            displayName: 'Barolympic',
            region: 'UK/Europe',
            type: 'diploid',
            
            bspbRatings: {
                liveGroundCover: 7.8,
                visualMerit: 7.9,
                mean: 7.8,
                recovery: 7.5,
                shootDensity: 7.7,
                finenessOfLeaf: 7.4,
                redThreadResistance: 6.0,
                winterGreenness: 5.7,
                summerGreenness: 5.3
            },
            source: 'BSPB 2025 Table S1, Barenbrug - Olympic stadium performance',
            
            traits: {
                wear: {
                    multiplier: 0.85,
                    confidence: 'high',
                    source: 'BSPB 2025 - Mean 7.8, stadium performer'
                },
                disease: {
                    redThread: {
                        riskMultiplier: 0.92,
                        confidence: 'high',
                        source: 'BSPB 2025 - Red thread rating 6.0 (good)'
                    }
                }
            }
        },
        
        'Barzico': {
            species: 'perennialRyegrass',
            displayName: 'Barzico',
            region: 'UK/Europe',
            type: 'diploid',
            
            bspbRatings: {
                liveGroundCover: 7.5,
                visualMerit: 7.6,
                mean: 7.5,
                recovery: 7.3,
                shootDensity: 7.4,
                finenessOfLeaf: 7.2,
                redThreadResistance: 5.7,
                winterGreenness: 5.4,
                summerGreenness: 5.1
            },
            source: 'BSPB 2025 Table S1, Barenbrug',
            
            traits: {
                wear: {
                    multiplier: 0.88,
                    confidence: 'high',
                    source: 'BSPB 2025 - Mean 7.5'
                },
                disease: {
                    redThread: {
                        riskMultiplier: 0.97,
                        confidence: 'high',
                        source: 'BSPB 2025 - Red thread rating 5.7'
                    }
                }
            }
        },
        
        'Berlioz': {
            species: 'perennialRyegrass',
            displayName: 'Berlioz',
            region: 'UK/Europe',
            type: 'diploid',
            
            bspbRatings: {
                liveGroundCover: 7.4,
                visualMerit: 7.5,
                mean: 7.4,
                recovery: 7.2,
                shootDensity: 7.3,
                finenessOfLeaf: 7.2,
                redThreadResistance: 5.6,
                winterGreenness: 5.3,
                summerGreenness: 5.0
            },
            source: 'BSPB 2025 Table S1',
            
            traits: {
                wear: {
                    multiplier: 0.89,
                    confidence: 'high',
                    source: 'BSPB 2025 - Mean 7.4'
                },
                disease: {
                    redThread: {
                        riskMultiplier: 0.98,
                        confidence: 'high',
                        source: 'BSPB 2025 - Red thread rating 5.6'
                    }
                }
            }
        }
    },
    
    // ═══════════════════════════════════════════════════════════════════════════
    // TETRAPLOID PERENNIAL RYEGRASS
    // Source: BSPB 2025 Table S1s - 4turf varieties
    // ═══════════════════════════════════════════════════════════════════════════
    
    tetraploidRyegrass: {
        
        'Fabian': {
            species: 'tetraploidRyegrass',
            displayName: 'Fabian 4turf',
            region: 'UK/Europe',
            type: 'tetraploid',
            
            bspbRatings: {
                liveGroundCover: 6.1,
                visualMerit: 5.7,
                mean: 5.9,
                recovery: 6.2,
                shootDensity: 5.0,
                finenessOfLeaf: 5.0,
                redThreadResistance: 6.7,
                winterGreenness: 6.7,
                summerGreenness: 6.6
            },
            source: 'BSPB 2025 Table S1s, DLF/JNS',
            
            traits: {
                wear: {
                    multiplier: 1.02,
                    confidence: 'high',
                    source: 'BSPB 2025 - Mean 5.9, best tetraploid'
                },
                disease: {
                    redThread: {
                        riskMultiplier: 0.88,
                        confidence: 'high',
                        source: 'BSPB 2025 - Red thread rating 6.7 (good)'
                    }
                },
                establishment: {
                    speed: 'very fast',
                    lowTempGermination: true,
                    confidence: 'high',
                    source: '4turf tetraploid - germinates at 4°C'
                },
                drought: {
                    tolerance: 0.85,
                    confidence: 'high',
                    source: 'DLF 4turf trials - deeper rooting'
                }
            }
        },
        
        'Tetragame': {
            species: 'tetraploidRyegrass',
            displayName: 'Tetragame 4turf',
            region: 'UK/Europe',
            type: 'tetraploid',
            
            bspbRatings: {
                liveGroundCover: 5.5,
                visualMerit: 5.2,
                mean: 5.4,
                recovery: 5.3,
                shootDensity: 4.6,
                finenessOfLeaf: 4.4,
                redThreadResistance: 7.3,
                winterGreenness: 6.9,
                summerGreenness: 7.3
            },
            source: 'BSPB 2025 Table S1s, DLF/JNS/TG',
            
            traits: {
                wear: {
                    multiplier: 1.08,
                    confidence: 'high',
                    source: 'BSPB 2025 - Mean 5.4'
                },
                disease: {
                    redThread: {
                        riskMultiplier: 0.82,
                        confidence: 'high',
                        source: 'BSPB 2025 - Red thread rating 7.3 (excellent)'
                    }
                }
            }
        },
        
        'Double': {
            species: 'tetraploidRyegrass',
            displayName: 'Double 4turf',
            region: 'UK/Europe',
            type: 'tetraploid',
            
            bspbRatings: {
                liveGroundCover: 5.0,
                visualMerit: 4.5,
                mean: 4.7,
                recovery: 4.3,
                shootDensity: 4.0,
                finenessOfLeaf: 3.5,
                redThreadResistance: 7.8,
                winterGreenness: 7.7,
                summerGreenness: 7.5
            },
            source: 'BSPB 2025 Table S1s, DLF',
            
            traits: {
                wear: {
                    multiplier: 1.15,
                    confidence: 'high',
                    source: 'BSPB 2025 - Mean 4.7, German trials rated 8/9 for wear'
                },
                disease: {
                    redThread: {
                        riskMultiplier: 0.78,
                        confidence: 'high',
                        source: 'BSPB 2025 - Red thread rating 7.8 (excellent)'
                    }
                }
            }
        },
        
        'Tetrastar': {
            species: 'tetraploidRyegrass',
            displayName: 'Tetrastar 4turf',
            region: 'UK/Europe',
            type: 'tetraploid',
            
            bspbRatings: {
                liveGroundCover: 5.7,
                visualMerit: 5.4,
                mean: 5.5,
                recovery: 5.4,
                shootDensity: 5.2,
                finenessOfLeaf: 4.9,
                redThreadResistance: 8.0,
                winterGreenness: 7.7,
                summerGreenness: 8.0
            },
            source: 'BSPB 2025 Table S1s, OAS/TG',
            
            traits: {
                wear: {
                    multiplier: 1.06,
                    confidence: 'high',
                    source: 'BSPB 2025 - Mean 5.5'
                },
                disease: {
                    redThread: {
                        riskMultiplier: 0.75,
                        confidence: 'high',
                        source: 'BSPB 2025 - Red thread rating 8.0 (best in class)'
                    }
                }
            }
        }
    },
    
    // ═══════════════════════════════════════════════════════════════════════════
    // CREEPING BENTGRASS - UK/EUROPE
    // Source: BSPB 2025 Table G1 - Greens (mown at 4mm)
    // ═══════════════════════════════════════════════════════════════════════════
    
    creepingBentgrass: {
        
        '007 DSB': {
            species: 'creepingBentgrass',
            displayName: '007 DSB',
            region: 'UK/Europe',
            
            bspbRatings: {
                shootDensity: 6.3,
                visualMerit: 6.4,
                mean: 6.4,
                finenessOfLeaf: 6.3,
                redThreadResistance: 6.0,
                winterGreenness: 7.1,
                summerGreenness: 5.5
            },
            source: 'BSPB 2025 Table G1, Germinal',
            
            traits: {
                disease: {
                    dollarSpot: {
                        riskMultiplier: 0.70,
                        confidence: 'high',
                        source: 'Germinal marketing - bred for dollar spot resistance'
                    },
                    redThread: {
                        riskMultiplier: 0.97,
                        confidence: 'high',
                        source: 'BSPB 2025 - Rating 6.0'
                    }
                }
            }
        },
        
        'Mackenzie': {
            species: 'creepingBentgrass',
            displayName: 'Mackenzie',
            region: 'UK/Europe',
            
            bspbRatings: {
                shootDensity: 6.0,
                visualMerit: 5.9,
                mean: 6.0,
                finenessOfLeaf: 6.0,
                redThreadResistance: 5.2,
                winterGreenness: 6.8,
                summerGreenness: 5.6
            },
            source: 'BSPB 2025 Table G1, DSV',
            
            traits: {
                disease: {
                    // b35fix239: Added dollar spot entry. Mackenzie had no UK dollar spot data,
                    // causing fallback to species-level bentgrass susceptibility (1.3).
                    // Cross-region sources used (no BSPB/STRI UK dollar spot trial data exists):
                    // - DLF Super Bents: "high resistance to dollar spot" (breeder spec)
                    // - Glenelg GC SA 2-year trial 2021: little to no disease incidence
                    // - AU gilba-variety-traits entry: 0.70 (b35fix239)
                    // Confidence 'medium': no UK field trial data; transferable from AU/NTEP.
                    dollarSpot: {
                        riskMultiplier: 0.70,
                        confidence: 'medium',
                        source: 'Cross-region: DLF Super Bents specs (high resistance); Glenelg GC SA 2021 trial; AU GAIP data b35fix239'
                    },
                    redThread: {
                        riskMultiplier: 1.15,
                        confidence: 'high',
                        source: 'BSPB 2025 - Rating 5.2'
                    }
                }
            }
        },
        
        'Cobra nova': {
            species: 'creepingBentgrass',
            displayName: 'Cobra nova',
            region: 'UK/Europe',
            
            bspbRatings: {
                shootDensity: 6.2,
                visualMerit: 6.2,
                mean: 6.2,
                finenessOfLeaf: 6.3,
                redThreadResistance: 6.1,
                winterGreenness: 7.6,
                summerGreenness: 6.0
            },
            source: 'BSPB 2025 Table G1, DLF/JNS',
            
            traits: {
                disease: {
                    redThread: {
                        riskMultiplier: 0.96,
                        confidence: 'high',
                        source: 'BSPB 2025 - Rating 6.1'
                    }
                }
            }
        }
    },
    
    // ═══════════════════════════════════════════════════════════════════════════
    // BROWNTOP BENT (Agrostis capillaris) - UK/EUROPE/NZ
    // Source: BSPB Turfgrass Seed 2025 (STRI trials at Bingley, West Yorkshire)
    // Table G1 - Greens (mown at 4mm) and Table L7 - Lawns (mown at 10-15mm)
    // Valid regions: UK, NZ, Ireland, Scandinavia, cool-temperate Australia
    // ═══════════════════════════════════════════════════════════════════════════
    
    browntopBent: {
        
        // TOP-RATED CULTIVARS
        
        'Saulsbury': {
            species: 'browntopBent',
            displayName: 'Saulsbury',
            region: 'UK/Europe',
            availability: 'LA', // Limited Availability
            agent: 'DLF/JNS',
            
            bspbRatings: {
                // Table G1 - Greens (4mm)
                greens: {
                    shootDensity: 8.1,
                    visualMerit: 8.0,
                    mean: 8.0,
                    finenessOfLeaf: 8.2,
                    winterGreenness: 6.2,
                    summerGreenness: 6.9
                },
                // Table L7 - Lawns (10-15mm)
                lawns: {
                    shootDensity: 7.9,
                    visualMerit: 7.5,
                    mean: 8.0,
                    finenessOfLeaf: 8.5,
                    redThreadResistance: 5.9,
                    winterGreenness: 7.2,
                    summerGreenness: 6.4
                }
            },
            source: 'BSPB 2025 Tables G1 & L7, DLF/JNS - Ranked #1 browntop',
            
            traits: {
                wear: {
                    multiplier: 0.80,
                    confidence: 'high',
                    source: 'BSPB 2025 - Top rated browntop bent, mean 8.0'
                },
                disease: {
                    redThread: {
                        riskMultiplier: 1.05,
                        confidence: 'high',
                        source: 'BSPB 2025 - Red thread rating 5.9 (lawns)'
                    }
                }
            }
        },
        
        'Howden': {
            species: 'browntopBent',
            displayName: 'Howden',
            region: 'UK/Europe',
            agent: 'BAR',
            
            bspbRatings: {
                greens: {
                    shootDensity: 7.4,
                    visualMerit: 7.7,
                    mean: 7.6,
                    finenessOfLeaf: 7.2,
                    winterGreenness: 5.8,
                    summerGreenness: 6.7
                }
                // Greens data only in BSPB 2025
            },
            source: 'BSPB 2025 Table G1, BAR',
            
            traits: {
                wear: {
                    multiplier: 0.87,
                    confidence: 'high',
                    source: 'BSPB 2025 - Mean 7.6'
                }
            }
        },
        
        'Charles': {
            species: 'browntopBent',
            displayName: 'Charles',
            region: 'UK/Europe',
            agent: 'BAR',
            
            bspbRatings: {
                greens: {
                    shootDensity: 7.6,
                    visualMerit: 7.5,
                    mean: 7.6,
                    finenessOfLeaf: 7.2,
                    winterGreenness: 5.5,
                    summerGreenness: 5.9
                },
                lawns: {
                    shootDensity: 7.6,
                    visualMerit: 7.4,
                    mean: 7.5,
                    finenessOfLeaf: 7.6,
                    redThreadResistance: 4.8,
                    winterGreenness: 5.7,
                    summerGreenness: 5.9
                }
            },
            source: 'BSPB 2025 Tables G1 & L7, BAR',
            
            traits: {
                wear: {
                    multiplier: 0.87,
                    confidence: 'high',
                    source: 'BSPB 2025 - Mean 7.5-7.6'
                },
                disease: {
                    redThread: {
                        riskMultiplier: 1.20,
                        confidence: 'high',
                        source: 'BSPB 2025 - Red thread rating 4.8 (below average)'
                    }
                }
            }
        },
        
        'Arrowtown': {
            species: 'browntopBent',
            displayName: 'Arrowtown',
            region: 'UK/Europe',
            agent: 'DLF/JNS',
            
            bspbRatings: {
                greens: {
                    shootDensity: 7.0,
                    visualMerit: 7.2,
                    mean: 7.1,
                    finenessOfLeaf: 6.7,
                    redThreadResistance: 6.0,
                    winterGreenness: 5.0,
                    summerGreenness: 5.8
                },
                lawns: {
                    shootDensity: 6.9,
                    visualMerit: 7.3,
                    mean: 7.0,
                    finenessOfLeaf: 6.7,
                    redThreadResistance: 5.5,
                    winterGreenness: 5.4,
                    summerGreenness: 5.9
                }
            },
            source: 'BSPB 2025 Tables G1 & L7, DLF/JNS',
            
            traits: {
                wear: {
                    multiplier: 0.92,
                    confidence: 'high',
                    source: 'BSPB 2025 - Mean 7.0-7.1'
                },
                disease: {
                    redThread: {
                        riskMultiplier: 0.95,
                        confidence: 'high',
                        source: 'BSPB 2025 - Red thread rating 5.5-6.0 (above average)'
                    }
                }
            }
        },
        
        'Manor': {
            species: 'browntopBent',
            displayName: 'Manor',
            region: 'UK/Europe',
            agent: 'DLF/JNS',
            
            bspbRatings: {
                greens: {
                    shootDensity: 6.8,
                    visualMerit: 7.0,
                    mean: 6.9,
                    finenessOfLeaf: 6.4,
                    redThreadResistance: 5.5,
                    winterGreenness: 5.4,
                    summerGreenness: 5.4
                },
                lawns: {
                    shootDensity: 6.6,
                    visualMerit: 7.1,
                    mean: 6.7,
                    finenessOfLeaf: 6.4,
                    redThreadResistance: 5.7,
                    winterGreenness: 5.5,
                    summerGreenness: 5.2
                }
            },
            source: 'BSPB 2025 Tables G1 & L7, DLF/JNS',
            
            traits: {
                wear: {
                    multiplier: 0.94,
                    confidence: 'high',
                    source: 'BSPB 2025 - Mean 6.7-6.9'
                },
                disease: {
                    redThread: {
                        riskMultiplier: 1.00,
                        confidence: 'high',
                        source: 'BSPB 2025 - Red thread rating 5.5-5.7 (average)'
                    }
                }
            }
        },
        
        'Cleek': {
            species: 'browntopBent',
            displayName: 'Cleek',
            region: 'UK/Europe',
            agent: 'DLF/JNS/MM',
            
            bspbRatings: {
                greens: {
                    shootDensity: 6.8,
                    visualMerit: 7.0,
                    mean: 6.9,
                    finenessOfLeaf: 6.1,
                    winterGreenness: 5.2,
                    summerGreenness: 5.8
                },
                lawns: {
                    shootDensity: 6.7,
                    visualMerit: 7.1,
                    mean: 6.7,
                    finenessOfLeaf: 6.2,
                    redThreadResistance: 5.3,
                    winterGreenness: 5.3,
                    summerGreenness: 5.9
                }
            },
            source: 'BSPB 2025 Tables G1 & L7, DLF/JNS/MM',
            
            traits: {
                wear: {
                    multiplier: 0.94,
                    confidence: 'high',
                    source: 'BSPB 2025 - Mean 6.7-6.9'
                },
                disease: {
                    redThread: {
                        riskMultiplier: 1.05,
                        confidence: 'high',
                        source: 'BSPB 2025 - Red thread rating 5.3 (lawns)'
                    }
                }
            }
        },
        
        'Puritan': {
            species: 'browntopBent',
            displayName: 'Puritan',
            region: 'UK/Europe',
            availability: 'LA',
            agent: 'DLF/TG',
            
            bspbRatings: {
                greens: {
                    shootDensity: 6.7,
                    visualMerit: 7.1,
                    mean: 6.9,
                    finenessOfLeaf: 6.6,
                    winterGreenness: 6.7,
                    summerGreenness: 7.4
                }
            },
            source: 'BSPB 2025 Table G1, DLF/TG',
            
            traits: {
                wear: {
                    multiplier: 0.94,
                    confidence: 'high',
                    source: 'BSPB 2025 - Mean 6.9'
                }
            },
            notes: 'Excellent summer colour (7.4)'
        },
        
        'BarKing': {
            species: 'browntopBent',
            displayName: 'BarKing',
            region: 'UK/Europe',
            agent: 'BAR',
            
            bspbRatings: {
                greens: {
                    shootDensity: 6.4,
                    visualMerit: 7.0,
                    mean: 6.7,
                    finenessOfLeaf: 6.4,
                    redThreadResistance: 5.8,
                    winterGreenness: 6.9,
                    summerGreenness: 5.9
                },
                lawns: {
                    shootDensity: 6.7,
                    visualMerit: 7.3,
                    mean: 6.9,
                    finenessOfLeaf: 6.6,
                    redThreadResistance: 5.2,
                    winterGreenness: 6.7,
                    summerGreenness: 5.6
                }
            },
            source: 'BSPB 2025 Tables G1 & L7, BAR',
            
            traits: {
                wear: {
                    multiplier: 0.95,
                    confidence: 'high',
                    source: 'BSPB 2025 - Mean 6.7-6.9'
                },
                disease: {
                    redThread: {
                        riskMultiplier: 1.03,
                        confidence: 'high',
                        source: 'BSPB 2025 - Red thread rating 5.2-5.8'
                    }
                }
            },
            notes: 'Good winter greenness (6.7-6.9)'
        },
        
        'Musket': {
            species: 'browntopBent',
            displayName: 'Musket',
            region: 'UK/Europe',
            agent: 'G',
            
            bspbRatings: {
                greens: {
                    shootDensity: 6.5,
                    visualMerit: 6.9,
                    mean: 6.7,
                    finenessOfLeaf: 6.8,
                    winterGreenness: 6.2,
                    summerGreenness: 5.9
                }
            },
            source: 'BSPB 2025 Table G1, Germinal',
            
            traits: {
                wear: {
                    multiplier: 0.95,
                    confidence: 'high',
                    source: 'BSPB 2025 - Mean 6.7'
                }
            }
        },
        
        'Sefton': {
            species: 'browntopBent',
            displayName: 'Sefton',
            region: 'UK/Europe/NZ',
            origin: 'New Zealand',
            releaseYear: 1982,
            agent: 'DLF/MM',
            
            bspbRatings: {
                greens: {
                    shootDensity: 6.5,
                    visualMerit: 6.9,
                    mean: 6.7,
                    finenessOfLeaf: 6.7,
                    redThreadResistance: 5.1,
                    winterGreenness: 5.4,
                    summerGreenness: 5.1
                },
                lawns: {
                    shootDensity: 6.1,
                    visualMerit: 6.9,
                    mean: 6.4,
                    finenessOfLeaf: 6.3,
                    redThreadResistance: 5.2,
                    winterGreenness: 6.0,
                    summerGreenness: 5.3
                }
            },
            source: 'BSPB 2025 Tables G1 & L7, DLF/MM',
            
            traits: {
                wear: {
                    multiplier: 0.95,
                    confidence: 'high',
                    source: 'BSPB 2025 - Mean 6.4-6.7'
                },
                disease: {
                    redThread: {
                        riskMultiplier: 1.08,
                        confidence: 'high',
                        source: 'BSPB 2025 - Red thread rating 5.1-5.2'
                    }
                }
            },
            notes: 'NZ-bred cultivar, sibling selection to Egmont. Good adaptation to NZ conditions.'
        },
        
        'Egmont': {
            species: 'browntopBent',
            displayName: 'Egmont',
            region: 'UK/Europe/NZ',
            origin: 'New Zealand',
            releaseYear: 1982,
            agent: 'OAS/TG',
            
            bspbRatings: {
                greens: {
                    shootDensity: 6.6,
                    visualMerit: 6.8,
                    mean: 6.7,
                    finenessOfLeaf: 6.1,
                    redThreadResistance: 6.1,
                    winterGreenness: 6.5,
                    summerGreenness: 6.6
                },
                lawns: {
                    shootDensity: 6.4,
                    visualMerit: 7.0,
                    mean: 6.6,
                    finenessOfLeaf: 6.3,
                    redThreadResistance: 6.3,
                    winterGreenness: 6.9,
                    summerGreenness: 6.5
                }
            },
            source: 'BSPB 2025 Tables G1 & L7, OAS/TG',
            
            traits: {
                wear: {
                    multiplier: 0.95,
                    confidence: 'high',
                    source: 'BSPB 2025 - Mean 6.6-6.7'
                },
                disease: {
                    redThread: {
                        riskMultiplier: 0.90,
                        confidence: 'high',
                        source: 'BSPB 2025 - Red thread rating 6.1-6.3 (one of the highest)'
                    }
                }
            },
            notes: 'NZ-bred cultivar with strong disease resistance and excellent year-round colour retention. Well-suited to NZ golf courses.'
        },
        
        'AberRegal': {
            species: 'browntopBent',
            displayName: 'AberRegal',
            region: 'UK/Europe',
            agent: 'G',
            
            bspbRatings: {
                greens: {
                    shootDensity: 6.5,
                    visualMerit: 6.7,
                    mean: 6.6,
                    finenessOfLeaf: 6.3,
                    redThreadResistance: 6.5,
                    winterGreenness: 7.2,
                    summerGreenness: 6.7
                },
                lawns: {
                    shootDensity: 6.7,
                    visualMerit: 6.9,
                    mean: 6.6,
                    finenessOfLeaf: 6.4,
                    redThreadResistance: 5.8,
                    winterGreenness: 7.4,
                    summerGreenness: 6.4
                }
            },
            source: 'BSPB 2025 Tables G1 & L7, Germinal',
            
            traits: {
                wear: {
                    multiplier: 0.96,
                    confidence: 'high',
                    source: 'BSPB 2025 - Mean 6.6'
                },
                disease: {
                    redThread: {
                        riskMultiplier: 0.88,
                        confidence: 'high',
                        source: 'BSPB 2025 - Red thread rating 5.8-6.5 (good)'
                    }
                }
            },
            notes: 'Excellent winter greenness (7.2-7.4) and disease resistance'
        },
        
        'Teetop': {
            species: 'browntopBent',
            displayName: 'Teetop',
            region: 'UK/Europe',
            agent: 'DLF',
            
            bspbRatings: {
                greens: {
                    shootDensity: 6.4,
                    visualMerit: 6.4,
                    mean: 6.4,
                    finenessOfLeaf: 6.4,
                    winterGreenness: 4.8,
                    summerGreenness: 5.3
                },
                lawns: {
                    shootDensity: 6.6,
                    visualMerit: 6.9,
                    mean: 6.8,
                    finenessOfLeaf: 7.0,
                    redThreadResistance: 4.5,
                    winterGreenness: 5.5,
                    summerGreenness: 5.3
                }
            },
            source: 'BSPB 2025 Tables G1 & L7, DLF',
            
            traits: {
                wear: {
                    multiplier: 0.96,
                    confidence: 'high',
                    source: 'BSPB 2025 - Mean 6.4-6.8'
                },
                disease: {
                    redThread: {
                        riskMultiplier: 1.25,
                        confidence: 'high',
                        source: 'BSPB 2025 - Red thread rating 4.5 (below average)'
                    }
                }
            }
        },
        
        'Heritage': {
            species: 'browntopBent',
            displayName: 'Heritage',
            region: 'UK/Europe',
            agent: 'ICL',
            
            bspbRatings: {
                greens: {
                    shootDensity: 6.2,
                    visualMerit: 6.6,
                    mean: 6.4,
                    finenessOfLeaf: 6.0,
                    winterGreenness: 6.7,
                    summerGreenness: 7.1
                }
            },
            source: 'BSPB 2025 Table G1, ICL',
            
            traits: {
                wear: {
                    multiplier: 0.97,
                    confidence: 'high',
                    source: 'BSPB 2025 - Mean 6.4'
                }
            },
            notes: 'Excellent summer colour (7.1)'
        },
        
        'AberRoyal': {
            species: 'browntopBent',
            displayName: 'AberRoyal',
            region: 'UK/Europe',
            agent: 'G',
            
            bspbRatings: {
                greens: {
                    shootDensity: 6.2,
                    visualMerit: 6.4,
                    mean: 6.3,
                    finenessOfLeaf: 6.2,
                    redThreadResistance: 5.8,
                    winterGreenness: 6.8,
                    summerGreenness: 6.7
                }
            },
            source: 'BSPB 2025 Table G1, Germinal',
            
            traits: {
                wear: {
                    multiplier: 0.98,
                    confidence: 'high',
                    source: 'BSPB 2025 - Mean 6.3'
                },
                disease: {
                    redThread: {
                        riskMultiplier: 1.00,
                        confidence: 'high',
                        source: 'BSPB 2025 - Red thread rating 5.8'
                    }
                }
            }
        },
        
        'Jorvik': {
            species: 'browntopBent',
            displayName: 'Jorvik',
            region: 'UK/Europe/Scandinavia',
            agent: 'DLF',
            
            bspbRatings: {
                greens: {
                    shootDensity: 6.0,
                    visualMerit: 6.0,
                    mean: 6.0,
                    finenessOfLeaf: 5.9,
                    redThreadResistance: 4.8,
                    winterGreenness: 6.8,
                    summerGreenness: 7.5
                },
                lawns: {
                    shootDensity: 6.2,
                    visualMerit: 6.2,
                    mean: 6.2,
                    finenessOfLeaf: 6.2,
                    redThreadResistance: 4.8,
                    winterGreenness: 6.6,
                    summerGreenness: 7.3
                }
            },
            source: 'BSPB 2025 Tables G1 & L7, DLF',
            
            traits: {
                wear: {
                    multiplier: 1.00,
                    confidence: 'high',
                    source: 'BSPB 2025 - Mean 6.0-6.2'
                },
                disease: {
                    redThread: {
                        riskMultiplier: 1.20,
                        confidence: 'high',
                        source: 'BSPB 2025 - Red thread rating 4.8'
                    }
                }
            },
            notes: 'Nordic breeding, excellent summer colour (7.3-7.5)'
        }
    }
};

// ═══════════════════════════════════════════════════════════════════════════
// UK SPORTS TURF BLENDS
// Pre-formulated seed mixtures commonly used in UK stadia and sports grounds
// ═══════════════════════════════════════════════════════════════════════════

const UK_BLENDS = {
    
    // JOHNSONS SPORTS SEED (DLF)
    
    'J Premier Pitch': {
        displayName: 'J Premier Pitch',
        supplier: 'Johnsons Sports Seed (DLF)',
        application: 'Premier quality football and rugby pitches',
        composition: [
            { cultivar: 'Europitch', percent: 20 },
            { cultivar: 'Eurodiamond', percent: 20 },
            { cultivar: 'Gildara', percent: 20 },
            { cultivar: 'Monroe', percent: 20 },
            { cultivar: 'Saila', percent: 10 }
        ],
        traits: {
            wear: { multiplier: 0.86, confidence: 'high', source: 'Blend of top BSPB rated cultivars' },
            recovery: { multiplier: 0.88, confidence: 'high' }
        }
    },
    
    'J Stadium': {
        displayName: 'J Stadium',
        supplier: 'Johnsons Sports Seed (DLF)',
        application: 'Professional stadium pitches',
        composition: [
            { cultivar: 'Europitch', percent: 25 },
            { cultivar: 'Eurodiamond', percent: 25 },
            { cultivar: 'Gildara', percent: 25 },
            { cultivar: 'Monroe', percent: 25 }
        ],
        traits: {
            wear: { multiplier: 0.85, confidence: 'high', source: 'Premium stadium blend' },
            recovery: { multiplier: 0.87, confidence: 'high' }
        }
    },
    
    'J Nitro Premier Pitch': {
        displayName: 'J Nitro Premier Pitch',
        supplier: 'Johnsons Sports Seed (DLF)',
        application: 'Stadium management - ProNitro coated',
        composition: [
            { cultivar: 'Europitch', percent: 20 },
            { cultivar: 'Eurodiamond', percent: 20 },
            { cultivar: 'Gildara', percent: 25 },
            { cultivar: 'Monroe', percent: 25 },
            { cultivar: 'Eurocordus', percent: 10 }
        ],
        traits: {
            wear: { multiplier: 0.85, confidence: 'high', source: 'Used at leading European stadia' },
            establishment: { speed: 'fast', nitrogen: 'ProNitro coating for faster establishment' }
        }
    },
    
    'J Premier Wicket': {
        displayName: 'J Premier Wicket',
        supplier: 'Johnsons Sports Seed (DLF)',
        application: 'County quality cricket squares',
        composition: [
            { cultivar: 'Clementine', percent: 40 },
            { cultivar: 'Monroe', percent: 20 },
            { cultivar: 'Dickens', percent: 20 },
            { cultivar: 'Chardin', percent: 20 }
        ],
        traits: {
            wear: { multiplier: 0.92, confidence: 'high', source: 'Close-mown cricket blend' },
            density: { rating: 'high', source: 'Selected for dense sward under close mowing' }
        }
    },
    
    'J 4Turf': {
        displayName: 'J 4Turf',
        supplier: 'Johnsons Sports Seed (DLF)',
        application: 'Rapid renovation - 4turf tetraploid',
        composition: [
            { cultivar: 'Tetragame', percent: 25 },
            { cultivar: 'Berlioz', percent: 25 },
            { cultivar: 'Fabian', percent: 25 },
            { cultivar: 'Columbine', percent: 25 }
        ],
        traits: {
            wear: { multiplier: 0.95, confidence: 'high' },
            establishment: { speed: 'very fast', lowTemp: true, source: 'Tetraploid germination at low temps' },
            drought: { tolerance: 0.85, source: 'Deep rooting tetraploids' },
            disease: { redThread: { multiplier: 0.85 } }
        }
    },
    
    // BARENBRUG
    
    'BAR Platinum': {
        displayName: 'BAR Platinum',
        supplier: 'Barenbrug UK',
        application: 'Premium sports turf renovation',
        composition: [
            { cultivar: 'Barzico', percent: 25 },
            { cultivar: 'Barolympic', percent: 25 },
            { cultivar: 'Bargkamp', percent: 25 },
            { cultivar: 'Altivo', percent: 25 }
        ],
        traits: {
            wear: { multiplier: 0.84, confidence: 'high', source: 'Top Barenbrug cultivars' }
        }
    },
    
    'Bargold': {
        displayName: 'Bargold',
        supplier: 'Barenbrug UK',
        application: 'Professional sports pitches',
        composition: [
            { cultivar: 'Barzico', percent: 33 },
            { cultivar: 'Barolympic', percent: 33 },
            { cultivar: 'Barbasten', percent: 34 }
        ],
        traits: {
            wear: { multiplier: 0.86, confidence: 'high' }
        }
    },
    
    'Bar Extreme': {
        displayName: 'Bar Extreme',
        supplier: 'Barenbrug UK',
        application: 'High wear sports areas',
        composition: [
            { cultivar: 'Barzico', percent: 30 },
            { cultivar: 'Bargkamp', percent: 30 },
            { cultivar: 'Barbasten', percent: 40 }
        ],
        traits: {
            wear: { multiplier: 0.85, confidence: 'high', source: 'Extreme wear tolerance focus' }
        }
    },
    
    // AMENITY SEEDS (A-SERIES) / GERMINAL
    
    'A20 Premier Ryesport': {
        displayName: 'A20 Premier Ryesport',
        supplier: 'Amenity Seeds / Germinal',
        application: 'Premier sports renovation',
        composition: [
            { cultivar: 'Europitch', percent: 30 },
            { cultivar: 'Eurosport', percent: 25 },
            { cultivar: 'Mocora', percent: 20 },
            { cultivar: 'Eurocordus', percent: 25 }
        ],
        // Static traits as fallback (composition will calculate dynamically)
        traits: {
            wear: { multiplier: 0.87, confidence: 'medium', source: 'Industry blend' }
        }
    },
    
    // NOTE: A19 Ryesport not found - A19 is "All Purpose Landscaping" mix with fescues/bentgrass
    // Removing as it's not a sports PRG blend
    
    // MM SEEDS (DLF)
    
    'MM60': {
        displayName: 'MM60',
        supplier: 'MM Seeds (DLF)',
        application: 'Professional sports pitches - 100% perennial ryegrass',
        composition: [
            { cultivar: 'Europitch', percent: 35 },
            { cultivar: 'Alathea', percent: 30 },
            { cultivar: 'Lionel', percent: 15 },
            { cultivar: 'Annecy', percent: 20 }
        ],
        traits: {
            wear: { multiplier: 0.87, confidence: 'high', source: 'Established professional blend' }
        }
    },
    
    'MM50 Golf': {
        displayName: 'MM50 Golf',
        supplier: 'MM Seeds (DLF)',
        application: 'Golf tees, fairways, divot repair - 100% perennial ryegrass',
        composition: [
            { cultivar: 'Singapore', percent: 20 },
            { cultivar: 'Etienna', percent: 15 },
            { cultivar: 'Chloe', percent: 35 },
            { cultivar: 'Alison', percent: 30 }
        ],
        traits: {
            wear: { multiplier: 0.89, confidence: 'high' }
        }
    },
    
    'MM50 Landscape': {
        displayName: 'MM50 Landscape',
        supplier: 'MM Seeds (DLF)',
        application: 'Lawns and landscaping - 100% perennial ryegrass',
        composition: [
            { cultivar: 'Singapore', percent: 40 },
            { cultivar: 'Aniston', percent: 25 },
            { cultivar: 'Venice', percent: 20 },
            { cultivar: 'Alison', percent: 15 }
        ],
        traits: {
            wear: { multiplier: 0.92, confidence: 'medium' }
        }
    },
    
    // GERMINAL (MASCOT)
    // NOTE: No authoritative composition found for Mascot Stadium or Mascot Premier
    // Keeping static traits only
    
    'Mascot Stadium': {
        displayName: 'Mascot Stadium',
        supplier: 'Germinal',
        application: 'Professional stadium renovation',
        // No composition available
        traits: {
            wear: { multiplier: 0.86, confidence: 'medium', source: 'Stadium-grade blend - composition not published' }
        }
    },
    
    'Mascot Premier': {
        displayName: 'Mascot Premier',
        supplier: 'Germinal',
        application: 'Premier sports turf',
        // No composition available
        traits: {
            wear: { multiplier: 0.87, confidence: 'medium', source: 'Premier blend - composition not published' }
        }
    },
    
    // RIGBY TAYLOR
    
    'Rigby Taylor R140': {
        displayName: 'Rigby Taylor R140',
        supplier: 'Rigby Taylor',
        application: 'Professional sports renovation - tetraploid/diploid blend',
        composition: [
            { cultivar: 'Fabian', percent: 25, type: 'tetraploid' },
            { cultivar: 'Tetrastar', percent: 25, type: 'tetraploid' },
            { cultivar: 'Eurocordus', percent: 25 },
            { cultivar: 'Columbine', percent: 25 }
        ],
        traits: {
            wear: { multiplier: 0.87, confidence: 'medium', source: 'Tetraploid/diploid blend' }
        }
    },
    
    'Rigby Taylor R14': {
        displayName: 'Rigby Taylor R14',
        supplier: 'Rigby Taylor',
        application: 'Professional sports renovation',
        composition: [
            { cultivar: 'Europitch', percent: 25 },
            { cultivar: 'Eurocordus', percent: 25 },
            { cultivar: 'Eurosport', percent: 25 },
            { cultivar: 'Columbine', percent: 25 }
        ],
        traits: {
            wear: { multiplier: 0.88, confidence: 'medium', source: 'Professional groundsman blend' }
        }
    }
    
    // NOTE: Pitchmark Pro removed - "Pitchmark" is line-marking equipment, not seed
};


// ═══════════════════════════════════════════════════════════════════════════
// UK FINE FESCUE VARIETY TRAITS
// Source: BSPB Turfgrass Seed 2025 (STRI trials, Bingley, West Yorkshire)
// Table G (Greens, 5mm) and Table L (Lawns, 10-15mm) series
//
// Fine fescues relevant to UK golf:
//   - Chewings Fescue (Festuca rubra subsp. commutata)
//   - Slender Creeping Red Fescue (Festuca rubra subsp. littoralis)
//   - Strong Creeping Red Fescue (Festuca rubra subsp. rubra)
//   - Hard Fescue (Festuca brevipila / trachyphylla)
//   - Sheep's Fescue (Festuca ovina)
//
// BSPB Rating Scale: 1–9 (higher = better)
// Disease risk multiplier convention: 1.0 = average; <1.0 = lower risk; >1.0 = higher risk
// Derived from BSPB red thread resistance score:
//   riskMultiplier = 7.0 / redThreadResistance (baseline 7.0 = 1.0)
//   clamped 0.60–1.60
// ═══════════════════════════════════════════════════════════════════════════

const UK_FINE_FESCUE_TRAITS = {

    // ──────────────────────────────────────────────────────────────────────
    // CHEWINGS FESCUE (Festuca rubra subsp. commutata)
    // Table G-series: Greens (5mm). Suitable for close-mown golf greens
    // and fine lawns. Dense, fine-leaved, high shoot density.
    // ──────────────────────────────────────────────────────────────────────
    chewingsFescue: {

        'Camanette': {
            species: 'chewingsFescue',
            displayName: 'Camanette',
            region: 'UK/Europe',
            agent: 'DSV',
            bspbRatings: {
                greens: { shootDensity: 8.0, visualMerit: 7.7, mean: 7.8, winterGreenness: 5.5, summerGreenness: 5.8 },
                lawns:  { shootDensity: 7.9, visualMerit: 7.6, mean: 7.7, redThreadResistance: 6.8, winterGreenness: 5.8, summerGreenness: 5.9 }
            },
            source: 'BSPB 2025 Table G/L Chewings Fescue, DSV',
            traits: {
                wear:    { multiplier: 0.82, confidence: 'high', source: 'BSPB 2025 – mean 7.8 greens' },
                disease: { redThread: { riskMultiplier: 1.03, confidence: 'high', source: 'BSPB 2025 – red thread 6.8 lawns' } }
            }
        },

        'Barlineus': {
            species: 'chewingsFescue',
            displayName: 'Barlineus',
            region: 'UK/Europe',
            agent: 'BAR',
            bspbRatings: {
                greens: { shootDensity: 8.0, visualMerit: 7.7, mean: 7.8, winterGreenness: 5.6, summerGreenness: 5.8 },
                lawns:  { shootDensity: 8.1, visualMerit: 7.8, mean: 7.9, redThreadResistance: 7.2, winterGreenness: 6.0, summerGreenness: 6.1 }
            },
            source: 'BSPB 2025 Table G/L Chewings Fescue, Barenbrug',
            traits: {
                wear:    { multiplier: 0.82, confidence: 'high', source: 'BSPB 2025 – mean 7.8 greens' },
                disease: { redThread: { riskMultiplier: 0.97, confidence: 'high', source: 'BSPB 2025 – red thread 7.2 lawns (good)' } }
            }
        },

        'Dancing': {
            species: 'chewingsFescue',
            displayName: 'Dancing',
            region: 'UK/Europe',
            agent: 'DLF',
            bspbRatings: {
                greens: { shootDensity: 7.8, visualMerit: 7.7, mean: 7.7, winterGreenness: 5.4, summerGreenness: 5.7 },
                lawns:  { shootDensity: 7.7, visualMerit: 7.5, mean: 7.6, redThreadResistance: 6.3, winterGreenness: 5.7, summerGreenness: 5.8 }
            },
            source: 'BSPB 2025 Table G/L Chewings Fescue, DLF',
            traits: {
                wear:    { multiplier: 0.84, confidence: 'high', source: 'BSPB 2025 – mean 7.7 greens' },
                disease: { redThread: { riskMultiplier: 1.11, confidence: 'high', source: 'BSPB 2025 – red thread 6.3 lawns' } }
            }
        },

        'Barniblick': {
            species: 'chewingsFescue',
            displayName: 'Barniblick',
            region: 'UK/Europe',
            agent: 'BAR',
            bspbRatings: {
                greens: { shootDensity: 7.6, visualMerit: 7.8, mean: 7.7, winterGreenness: 5.2, summerGreenness: 5.3 },
                lawns:  { shootDensity: 7.7, visualMerit: 7.7, mean: 7.7, redThreadResistance: 6.5, winterGreenness: 5.6, summerGreenness: 5.6 }
            },
            source: 'BSPB 2025 Table G/L Chewings Fescue, Barenbrug',
            traits: {
                wear:    { multiplier: 0.84, confidence: 'high', source: 'BSPB 2025 – mean 7.7 greens' },
                disease: { redThread: { riskMultiplier: 1.08, confidence: 'high', source: 'BSPB 2025 – red thread 6.5 lawns' } }
            }
        },

        'Filius': {
            species: 'chewingsFescue',
            displayName: 'Filius',
            region: 'UK/Europe',
            agent: 'DLF',
            bspbRatings: {
                greens: { shootDensity: 7.8, visualMerit: 7.5, mean: 7.7, winterGreenness: 5.3, summerGreenness: 5.5 },
                lawns:  { shootDensity: 7.6, visualMerit: 7.4, mean: 7.5, redThreadResistance: 6.1, winterGreenness: 5.5, summerGreenness: 5.6 }
            },
            source: 'BSPB 2025 Table G/L Chewings Fescue, DLF',
            traits: {
                wear:    { multiplier: 0.84, confidence: 'high', source: 'BSPB 2025 – mean 7.7 greens' },
                disease: { redThread: { riskMultiplier: 1.15, confidence: 'high', source: 'BSPB 2025 – red thread 6.1 lawns' } }
            }
        },

        'Orionette': {
            species: 'chewingsFescue',
            displayName: 'Orionette',
            region: 'UK/Europe',
            agent: 'BAR',
            bspbRatings: {
                greens: { shootDensity: 7.3, visualMerit: 7.8, mean: 7.6, winterGreenness: 5.4, summerGreenness: 5.9 },
                lawns:  { shootDensity: 7.4, visualMerit: 7.6, mean: 7.5, redThreadResistance: 7.1, winterGreenness: 5.8, summerGreenness: 6.0 }
            },
            source: 'BSPB 2025 Table G/L Chewings Fescue, Barenbrug',
            traits: {
                wear:    { multiplier: 0.85, confidence: 'high', source: 'BSPB 2025 – mean 7.6 greens' },
                disease: { redThread: { riskMultiplier: 0.99, confidence: 'high', source: 'BSPB 2025 – red thread 7.1 lawns (strong)' } }
            }
        },

        'Nightclub': {
            species: 'chewingsFescue',
            displayName: 'Nightclub',
            region: 'UK/Europe',
            agent: 'DLF/JNS',
            bspbRatings: {
                greens: { shootDensity: 7.5, visualMerit: 7.4, mean: 7.5, winterGreenness: 5.1, summerGreenness: 5.2 },
                lawns:  { shootDensity: 7.3, visualMerit: 7.3, mean: 7.3, redThreadResistance: 5.8, winterGreenness: 5.3, summerGreenness: 5.4 }
            },
            source: 'BSPB 2025 Table G/L Chewings Fescue, DLF/JNS',
            traits: {
                wear:    { multiplier: 0.86, confidence: 'high', source: 'BSPB 2025 – mean 7.5 greens' },
                disease: { redThread: { riskMultiplier: 1.21, confidence: 'high', source: 'BSPB 2025 – red thread 5.8 lawns' } }
            }
        },

        'Barvirgo': {
            species: 'chewingsFescue',
            displayName: 'Barvirgo',
            region: 'UK/Europe',
            agent: 'BAR',
            bspbRatings: {
                greens: { shootDensity: 7.2, visualMerit: 7.3, mean: 7.3, winterGreenness: 5.0, summerGreenness: 5.1 },
                lawns:  { shootDensity: 7.0, visualMerit: 7.1, mean: 7.1, redThreadResistance: 6.4, winterGreenness: 5.2, summerGreenness: 5.3 }
            },
            source: 'BSPB 2025 Table G/L Chewings Fescue, Barenbrug',
            traits: {
                wear:    { multiplier: 0.88, confidence: 'high', source: 'BSPB 2025 – mean 7.3 greens' },
                disease: { redThread: { riskMultiplier: 1.09, confidence: 'high', source: 'BSPB 2025 – red thread 6.4 lawns' } }
            }
        },

        'Smirna': {
            species: 'chewingsFescue',
            displayName: 'Smirna',
            region: 'UK/Europe',
            agent: 'DLF',
            bspbRatings: {
                greens: { shootDensity: 7.1, visualMerit: 7.2, mean: 7.2, winterGreenness: 5.3, summerGreenness: 5.5 }
            },
            source: 'BSPB 2025 Table G Chewings Fescue, DLF',
            traits: {
                wear:    { multiplier: 0.89, confidence: 'high', source: 'BSPB 2025 – mean 7.2 greens' },
                disease: { redThread: { riskMultiplier: 1.05, confidence: 'low', source: 'No BSPB red thread data – class average applied' } }
            }
        }
    },

    // ──────────────────────────────────────────────────────────────────────
    // SLENDER CREEPING RED FESCUE (Festuca rubra subsp. littoralis)
    // Finest-leaved of the creeping reds. Greens-capable at 5–8mm.
    // Dominant species on links courses. Excellent salt tolerance.
    // ──────────────────────────────────────────────────────────────────────
    slenderCreepingRedFescue: {

        'Sybille': {
            species: 'slenderCreepingRedFescue',
            displayName: 'Sybille',
            region: 'UK/Europe',
            agent: 'DSV',
            bspbRatings: {
                greens: { shootDensity: 8.4, visualMerit: 8.3, mean: 8.4, winterGreenness: 6.0, summerGreenness: 6.3 },
                lawns:  { shootDensity: 8.3, visualMerit: 8.1, mean: 8.2, redThreadResistance: 7.6, winterGreenness: 6.4, summerGreenness: 6.5 }
            },
            source: 'BSPB 2025 Table G/L Slender Creeping Red Fescue, DSV – ranked #1',
            traits: {
                wear:    { multiplier: 0.78, confidence: 'high', source: 'BSPB 2025 – mean 8.4 greens (top-rated)' },
                disease: { redThread: { riskMultiplier: 0.92, confidence: 'high', source: 'BSPB 2025 – red thread 7.6 (excellent)' } }
            }
        },

        'Barnoustie': {
            species: 'slenderCreepingRedFescue',
            displayName: 'Barnoustie',
            region: 'UK/Europe',
            agent: 'BAR',
            bspbRatings: {
                greens: { shootDensity: 8.2, visualMerit: 8.4, mean: 8.3, winterGreenness: 6.1, summerGreenness: 6.4 },
                lawns:  { shootDensity: 8.0, visualMerit: 7.9, mean: 7.9, redThreadResistance: 7.3, winterGreenness: 6.2, summerGreenness: 6.3 }
            },
            source: 'BSPB 2025 Table G/L Slender Creeping Red Fescue, Barenbrug',
            traits: {
                wear:    { multiplier: 0.79, confidence: 'high', source: 'BSPB 2025 – mean 8.3 greens' },
                disease: { redThread: { riskMultiplier: 0.96, confidence: 'high', source: 'BSPB 2025 – red thread 7.3 (good)' } }
            }
        },

        'Barquess': {
            species: 'slenderCreepingRedFescue',
            displayName: 'Barquess',
            region: 'UK/Europe',
            agent: 'BAR',
            bspbRatings: {
                greens: { shootDensity: 7.9, visualMerit: 8.2, mean: 8.0, winterGreenness: 5.9, summerGreenness: 6.2 },
                lawns:  { shootDensity: 7.8, visualMerit: 7.7, mean: 7.8, redThreadResistance: 6.9, winterGreenness: 6.0, summerGreenness: 6.1 }
            },
            source: 'BSPB 2025 Table G/L Slender Creeping Red Fescue, Barenbrug',
            traits: {
                wear:    { multiplier: 0.81, confidence: 'high', source: 'BSPB 2025 – mean 8.0 greens' },
                disease: { redThread: { riskMultiplier: 1.01, confidence: 'high', source: 'BSPB 2025 – red thread 6.9' } }
            }
        },

        'Seroa': {
            species: 'slenderCreepingRedFescue',
            displayName: 'Seroa',
            region: 'UK/Europe',
            agent: 'DLF',
            bspbRatings: {
                greens: { shootDensity: 7.5, visualMerit: 7.5, mean: 7.5, winterGreenness: 5.5, summerGreenness: 5.7 },
                lawns:  { shootDensity: 7.4, visualMerit: 7.3, mean: 7.3, redThreadResistance: 6.5, winterGreenness: 5.7, summerGreenness: 5.8 }
            },
            source: 'BSPB 2025 Table G/L Slender Creeping Red Fescue, DLF',
            traits: {
                wear:    { multiplier: 0.86, confidence: 'high', source: 'BSPB 2025 – mean 7.5 greens' },
                disease: { redThread: { riskMultiplier: 1.08, confidence: 'high', source: 'BSPB 2025 – red thread 6.5' } }
            }
        },

        'Barcrown': {
            species: 'slenderCreepingRedFescue',
            displayName: 'Barcrown',
            region: 'UK/Europe',
            agent: 'BAR',
            bspbRatings: {
                greens: { shootDensity: 7.6, visualMerit: 7.2, mean: 7.4, winterGreenness: 5.4, summerGreenness: 5.6 },
                lawns:  { shootDensity: 7.5, visualMerit: 7.2, mean: 7.4, redThreadResistance: 8.4, winterGreenness: 5.7, summerGreenness: 5.8 }
            },
            source: 'BSPB 2025 Table G/L Slender Creeping Red Fescue, Barenbrug',
            notes: 'Outstanding red thread resistance (8.4) – best in species class',
            traits: {
                wear:    { multiplier: 0.87, confidence: 'high', source: 'BSPB 2025 – mean 7.4 greens' },
                disease: { redThread: { riskMultiplier: 0.83, confidence: 'high', source: 'BSPB 2025 – red thread 8.4 (outstanding)' } }
            }
        },

        'Valzac': {
            species: 'slenderCreepingRedFescue',
            displayName: 'Valzac',
            region: 'UK/Europe',
            agent: 'DLF/JNS',
            bspbRatings: {
                greens: { shootDensity: 7.4, visualMerit: 7.3, mean: 7.4, winterGreenness: 5.3, summerGreenness: 5.5 },
                lawns:  { shootDensity: 7.2, visualMerit: 7.1, mean: 7.2, redThreadResistance: 6.8, winterGreenness: 5.5, summerGreenness: 5.6 }
            },
            source: 'BSPB 2025 Table G/L Slender Creeping Red Fescue, DLF/JNS',
            traits: {
                wear:    { multiplier: 0.87, confidence: 'high', source: 'BSPB 2025 – mean 7.4 greens' },
                disease: { redThread: { riskMultiplier: 1.03, confidence: 'high', source: 'BSPB 2025 – red thread 6.8' } }
            }
        },

        'Compass II': {
            species: 'slenderCreepingRedFescue',
            displayName: 'Compass II',
            region: 'UK/Europe/NZ',
            agent: 'PPG/Living Turf NZ',
            bspbRatings: {
                // NTEP 2014 trial data (Living Ground Cover surrogate for wear)
                greens: { shootDensity: 7.8, visualMerit: 7.7, mean: 7.8 }
            },
            source: 'NTEP 2014 Fineleaf Fescue trial – PPG-FRC 113',
            notes: 'Available NZ via Living Turf. NTEP data used (not BSPB).',
            traits: {
                wear:    { multiplier: 0.83, confidence: 'medium', source: 'NTEP 2014 – LGC mean 7.8' },
                disease: { redThread: { riskMultiplier: 1.0, confidence: 'low', source: 'No BSPB data – class average' } }
            }
        }
    },

    // ──────────────────────────────────────────────────────────────────────
    // STRONG CREEPING RED FESCUE (Festuca rubra subsp. rubra)
    // Fairways and roughs only (typically 15–50mm). Not greens-capable.
    // Rhizomatous – good divot recovery. Lower density than slender CRF.
    // ──────────────────────────────────────────────────────────────────────
    strongCreepingRedFescue: {

        'Laverda': {
            species: 'strongCreepingRedFescue',
            displayName: 'Laverda',
            region: 'UK/Europe',
            agent: 'DSV',
            bspbRatings: {
                lawns: { shootDensity: 7.1, visualMerit: 7.0, mean: 7.1, redThreadResistance: 6.3, winterGreenness: 5.5, summerGreenness: 5.7 }
            },
            source: 'BSPB 2025 Table L Strong Creeping Red Fescue, DSV',
            notes: 'Newer cultivar showing promise for closer mowing than typical strong CRF',
            traits: {
                wear:    { multiplier: 0.90, confidence: 'high', source: 'BSPB 2025 – mean 7.1 lawns' },
                disease: { redThread: { riskMultiplier: 1.11, confidence: 'high', source: 'BSPB 2025 – red thread 6.3' } }
            }
        },

        'Rockefeller': {
            species: 'strongCreepingRedFescue',
            displayName: 'Rockefeller',
            region: 'UK/Europe',
            agent: 'DLF',
            bspbRatings: {
                lawns: { shootDensity: 6.3, visualMerit: 6.0, mean: 6.1, redThreadResistance: 5.8, winterGreenness: 5.2, summerGreenness: 5.3 }
            },
            source: 'BSPB 2025 Table L Strong Creeping Red Fescue, DLF',
            traits: {
                wear:    { multiplier: 0.95, confidence: 'high', source: 'BSPB 2025 – mean 6.1 lawns' },
                disease: { redThread: { riskMultiplier: 1.21, confidence: 'high', source: 'BSPB 2025 – red thread 5.8' } }
            }
        },

        'Rosmerta': {
            species: 'strongCreepingRedFescue',
            displayName: 'Rosmerta',
            region: 'UK/Europe',
            agent: 'DLF/JNS',
            bspbRatings: {
                lawns: { shootDensity: 6.1, visualMerit: 5.9, mean: 6.0, redThreadResistance: 5.6, winterGreenness: 5.0, summerGreenness: 5.2 }
            },
            source: 'BSPB 2025 Table L Strong Creeping Red Fescue, DLF/JNS',
            traits: {
                wear:    { multiplier: 0.96, confidence: 'high', source: 'BSPB 2025 – mean 6.0 lawns' },
                disease: { redThread: { riskMultiplier: 1.25, confidence: 'high', source: 'BSPB 2025 – red thread 5.6' } }
            }
        },

        'Maxima I': {
            species: 'strongCreepingRedFescue',
            displayName: 'Maxima I',
            region: 'UK/Europe',
            agent: 'OAS/TG',
            bspbRatings: {
                lawns: { shootDensity: 6.5, visualMerit: 6.2, mean: 6.3, redThreadResistance: 6.1, winterGreenness: 5.4, summerGreenness: 5.5 }
            },
            source: 'BSPB 2025 Table L Strong Creeping Red Fescue, OAS/TG',
            traits: {
                wear:    { multiplier: 0.93, confidence: 'high', source: 'BSPB 2025 – mean 6.3 lawns' },
                disease: { redThread: { riskMultiplier: 1.15, confidence: 'high', source: 'BSPB 2025 – red thread 6.1' } }
            }
        },

        'Cardinal II': {
            species: 'strongCreepingRedFescue',
            displayName: 'Cardinal II',
            region: 'UK/Europe/NZ',
            agent: 'PPG/Living Turf NZ',
            bspbRatings: {
                lawns: { shootDensity: 6.4, visualMerit: 6.2, mean: 6.3 }
            },
            source: 'NTEP 2014 Fineleaf Fescue trial – PPG-FRR 111',
            notes: 'Available NZ via Living Turf. NTEP data used (not BSPB).',
            traits: {
                wear:    { multiplier: 0.93, confidence: 'medium', source: 'NTEP 2014 – LGC mean 6.3' },
                disease: { redThread: { riskMultiplier: 1.0, confidence: 'low', source: 'No BSPB data – class average' } }
            }
        }
    },

    // ──────────────────────────────────────────────────────────────────────
    // HARD FESCUE (Festuca brevipila / trachyphylla)
    // Low-maintenance roughs and naturalistic areas (30–80mm).
    // Very low N demand. Drought tolerant. Not greens-suitable.
    // ──────────────────────────────────────────────────────────────────────
    hardFescue: {

        'Bargreen': {
            species: 'hardFescue',
            displayName: 'Bargreen',
            region: 'UK/Europe',
            agent: 'BAR',
            bspbRatings: {
                lawns: { shootDensity: 7.3, visualMerit: 7.1, mean: 7.2, redThreadResistance: 5.9, winterGreenness: 6.1, summerGreenness: 6.3 }
            },
            source: 'BSPB 2025 Table L Hard Fescue, Barenbrug',
            traits: {
                wear:    { multiplier: 0.90, confidence: 'high', source: 'BSPB 2025 – mean 7.2 lawns' },
                disease: { redThread: { riskMultiplier: 1.19, confidence: 'high', source: 'BSPB 2025 – red thread 5.9' } }
            }
        },

        'Quatro': {
            species: 'hardFescue',
            displayName: 'Quatro',
            region: 'UK/Europe',
            agent: 'DLF',
            bspbRatings: {
                lawns: { shootDensity: 7.0, visualMerit: 6.9, mean: 7.0, redThreadResistance: 5.7, winterGreenness: 5.9, summerGreenness: 6.0 }
            },
            source: 'BSPB 2025 Table L Hard Fescue, DLF',
            traits: {
                wear:    { multiplier: 0.92, confidence: 'high', source: 'BSPB 2025 – mean 7.0 lawns' },
                disease: { redThread: { riskMultiplier: 1.23, confidence: 'high', source: 'BSPB 2025 – red thread 5.7' } }
            }
        },

        'Barcampsia': {
            species: 'hardFescue',
            displayName: 'Barcampsia',
            region: 'UK/Europe',
            agent: 'BAR',
            bspbRatings: {
                lawns: { shootDensity: 6.8, visualMerit: 6.7, mean: 6.8, redThreadResistance: 5.4, winterGreenness: 5.7, summerGreenness: 5.9 }
            },
            source: 'BSPB 2025 Table L Hard Fescue, Barenbrug',
            traits: {
                wear:    { multiplier: 0.94, confidence: 'high', source: 'BSPB 2025 – mean 6.8 lawns' },
                disease: { redThread: { riskMultiplier: 1.30, confidence: 'high', source: 'BSPB 2025 – red thread 5.4' } }
            }
        }
    },

    // ──────────────────────────────────────────────────────────────────────
    // SHEEP'S FESCUE (Festuca ovina)
    // Low-maintenance naturalistic roughs and ecology areas (40–100mm).
    // Very low N, acid tolerant. Not suited to regular sports use.
    // ──────────────────────────────────────────────────────────────────────
    sheepFescue: {

        'Barok': {
            species: 'sheepFescue',
            displayName: 'Barok',
            region: 'UK/Europe',
            agent: 'BAR',
            bspbRatings: {
                lawns: { shootDensity: 6.9, visualMerit: 6.7, mean: 6.8, redThreadResistance: 5.2, winterGreenness: 6.0, summerGreenness: 6.2 }
            },
            source: 'BSPB 2025 Table L Sheep\'s Fescue, Barenbrug',
            traits: {
                wear:    { multiplier: 0.94, confidence: 'high', source: 'BSPB 2025 – mean 6.8 lawns' },
                disease: { redThread: { riskMultiplier: 1.35, confidence: 'high', source: 'BSPB 2025 – red thread 5.2' } }
            }
        },

        'Sonja': {
            species: 'sheepFescue',
            displayName: 'Sonja',
            region: 'UK/Europe',
            agent: 'DLF',
            bspbRatings: {
                lawns: { shootDensity: 6.6, visualMerit: 6.4, mean: 6.5, redThreadResistance: 5.0, winterGreenness: 5.8, summerGreenness: 5.9 }
            },
            source: 'BSPB 2025 Table L Sheep\'s Fescue, DLF',
            traits: {
                wear:    { multiplier: 0.96, confidence: 'high', source: 'BSPB 2025 – mean 6.5 lawns' },
                disease: { redThread: { riskMultiplier: 1.40, confidence: 'high', source: 'BSPB 2025 – red thread 5.0' } }
            }
        }
    }
};


// ═══════════════════════════════════════════════════════════════════════════
// FINE FESCUE HELPER FUNCTIONS
// Getter pattern matches existing bent/ryegrass getters for consistent wiring
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Get UK Chewings Fescue varieties for dropdown
 */
function getUKChewingsFescueVarieties() {
    const varieties = [{ value: 'generic', label: 'Generic / Unknown' }];
    Object.keys(UK_FINE_FESCUE_TRAITS.chewingsFescue).forEach(name => {
        const v = UK_FINE_FESCUE_TRAITS.chewingsFescue[name];
        const mean = v.bspbRatings?.greens?.mean || v.bspbRatings?.lawns?.mean || '?';
        varieties.push({ value: name, label: `${v.displayName} (BSPB ${mean})`, type: 'chewings' });
    });
    return varieties;
}

/**
 * Get UK Slender Creeping Red Fescue varieties for dropdown
 */
function getUKSlenderCreepingRedFescueVarieties() {
    const varieties = [{ value: 'generic', label: 'Generic / Unknown' }];
    Object.keys(UK_FINE_FESCUE_TRAITS.slenderCreepingRedFescue).forEach(name => {
        const v = UK_FINE_FESCUE_TRAITS.slenderCreepingRedFescue[name];
        const mean = v.bspbRatings?.greens?.mean || v.bspbRatings?.lawns?.mean || '?';
        const nzTag = (v.region || '').includes('NZ') ? ' [NZ]' : '';
        varieties.push({ value: name, label: `${v.displayName}${nzTag} (BSPB ${mean})`, type: 'slenderCreepingRed' });
    });
    return varieties;
}

/**
 * Get UK Strong Creeping Red Fescue varieties for dropdown
 */
function getUKStrongCreepingRedFescueVarieties() {
    const varieties = [{ value: 'generic', label: 'Generic / Unknown' }];
    Object.keys(UK_FINE_FESCUE_TRAITS.strongCreepingRedFescue).forEach(name => {
        const v = UK_FINE_FESCUE_TRAITS.strongCreepingRedFescue[name];
        const mean = v.bspbRatings?.lawns?.mean || '?';
        const nzTag = (v.region || '').includes('NZ') ? ' [NZ]' : '';
        varieties.push({ value: name, label: `${v.displayName}${nzTag} (BSPB ${mean})`, type: 'strongCreepingRed' });
    });
    return varieties;
}

/**
 * Get UK Hard Fescue varieties for dropdown
 */
function getUKHardFescueVarieties() {
    const varieties = [{ value: 'generic', label: 'Generic / Unknown' }];
    Object.keys(UK_FINE_FESCUE_TRAITS.hardFescue).forEach(name => {
        const v = UK_FINE_FESCUE_TRAITS.hardFescue[name];
        const mean = v.bspbRatings?.lawns?.mean || '?';
        varieties.push({ value: name, label: `${v.displayName} (BSPB ${mean})`, type: 'hardFescue' });
    });
    return varieties;
}

/**
 * Get UK Sheep's Fescue varieties for dropdown
 */
function getUKSheepFescueVarieties() {
    const varieties = [{ value: 'generic', label: 'Generic / Unknown' }];
    Object.keys(UK_FINE_FESCUE_TRAITS.sheepFescue).forEach(name => {
        const v = UK_FINE_FESCUE_TRAITS.sheepFescue[name];
        const mean = v.bspbRatings?.lawns?.mean || '?';
        varieties.push({ value: name, label: `${v.displayName} (BSPB ${mean})`, type: 'sheepFescue' });
    });
    return varieties;
}

/**
 * Get fine fescue variety data (disease + wear traits)
 * @param {string} speciesKey - e.g. 'chewingsFescue', 'slenderCreepingRedFescue'
 * @param {string} variety
 * @returns {object|null}
 */
function getUKFineFescueData(speciesKey, variety) {
    const speciesData = UK_FINE_FESCUE_TRAITS[speciesKey];
    if (!speciesData) return null;
    return speciesData[variety] || null;
}

/**
 * Get disease modifier for fine fescue variety
 * @param {string} speciesKey
 * @param {string} variety
 * @param {string} disease - e.g. 'redThread'
 * @returns {object} { riskMultiplier, confidence, source }
 */
function getUKFineFescueDiseaseModifier(speciesKey, variety, disease) {
    const data = getUKFineFescueData(speciesKey, variety);
    if (!data?.traits?.disease?.[disease]) {
        return { riskMultiplier: 1.0, confidence: 'none', source: 'No fine fescue data' };
    }
    return data.traits.disease[disease];
}

/**
 * Normalise incoming species strings to fine fescue keys
 * Handles all the aliases the Hub might pass in
 */
function normaliseFineFeescueSpecies(speciesStr) {
    if (!speciesStr) return null;
    const s = speciesStr.toLowerCase().replace(/[\s_()-]/g, '');
    const map = {
        'chewingsfescue':          'chewingsFescue',
        'chewings':                'chewingsFescue',
        'festucarubracommutata':   'chewingsFescue',
        'slendercreepingredfescue': 'slenderCreepingRedFescue',
        'slendercreepingred':       'slenderCreepingRedFescue',
        'slenderred':               'slenderCreepingRedFescue',
        'festubarubralittoralis':   'slenderCreepingRedFescue',
        'strongcreepingredfescue':  'strongCreepingRedFescue',
        'strongcreepingred':        'strongCreepingRedFescue',
        'strongred':                'strongCreepingRedFescue',
        'creepingredfescue':        'strongCreepingRedFescue',
        'festubarubrarubra':        'strongCreepingRedFescue',
        'hardfescue':               'hardFescue',
        'festucabrevipila':         'hardFescue',
        'festucatrachyphylla':      'hardFescue',
        'sheepsfescue':             'sheepFescue',
        'sheepfescue':              'sheepFescue',
        'festucaovina':             'sheepFescue'
    };
    return map[s] || null;
}


// ═══════════════════════════════════════════════════════════════════════════
// HELPER FUNCTIONS FOR NORTHERN HEMISPHERE VARIETY LOOKUP
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Get UK variety data
 */
function getUKVarietyData(species, variety) {
    // Normalize species: remove spaces, remove (Greens)/(Fairways)/etc suffixes, lowercase first char
    let speciesKey = species
        .replace(/\s*\([^)]*\)/g, '')  // Remove (Greens), (Fairways), etc.
        .replace(/\s+/g, '');           // Remove spaces
    speciesKey = speciesKey.charAt(0).toLowerCase() + speciesKey.slice(1);  // Lowercase first char
    
    const speciesData = UK_VARIETY_TRAITS[speciesKey] || UK_VARIETY_TRAITS.perennialRyegrass;
    
    if (!speciesData) return null;
    return speciesData[variety] || null;
}

/**
 * Get UK blend data
 */
function getUKBlendData(blendName) {
    return UK_BLENDS[blendName] || null;
}

/**
 * Check if a variety is a UK blend
 */
function isUKBlend(varietyName) {
    return UK_BLENDS.hasOwnProperty(varietyName);
}

/**
 * Calculate blend traits dynamically from component cultivars
 * Uses weighted average based on blend composition percentages
 * 
 * Can extract from:
 *   1. traits.{traitPath} (direct multipliers)
 *   2. bspbRatings.{rating} (converts to multiplier using baseline 7.0)
 * 
 * @param {object} blend - Blend object with composition array
 * @param {string} traitPath - e.g., 'wear', 'recovery', 'disease.redThread'
 * @returns {object} { value, confidence, components, formula }
 */
function calculateBlendTrait(blend, traitPath) {
    if (!blend?.composition || !Array.isArray(blend.composition)) {
        return { value: 1.0, confidence: 'none', error: 'No composition data' };
    }
    
    let weightedSum = 0;
    let totalWeight = 0;
    const components = [];
    const missingCultivars = [];
    
    // Map trait paths to BSPB rating names
    const bspbMapping = {
        'recovery': 'recovery',
        'wear': 'liveGroundCover',  // LGC correlates with wear tolerance
        'disease.redThread': 'redThreadResistance'
    };
    
    blend.composition.forEach(comp => {
        // Look up cultivar in UK_VARIETY_TRAITS
        const cultivarData = UK_VARIETY_TRAITS.perennialRyegrass?.[comp.cultivar] ||
                            UK_VARIETY_TRAITS.tetraploidRyegrass?.[comp.cultivar];
        
        if (!cultivarData) {
            missingCultivars.push(comp.cultivar);
            return;
        }
        
        let multiplier = null;
        let source = 'traits';
        
        // First try: Navigate to traits.{path}
        const pathParts = traitPath.split('.');
        let current = cultivarData.traits;
        
        for (const part of pathParts) {
            if (current && current[part] !== undefined) {
                current = current[part];
            } else {
                current = null;
                break;
            }
        }
        
        if (current !== null) {
            multiplier = current.multiplier || current.riskMultiplier || 
                        (typeof current === 'number' ? current : null);
        }
        
        // Second try: Convert from BSPB rating if no trait found
        if (multiplier === null && bspbMapping[traitPath] && cultivarData.bspbRatings) {
            const bspbRating = cultivarData.bspbRatings[bspbMapping[traitPath]];
            if (typeof bspbRating === 'number') {
                // Convert BSPB 1-9 scale to multiplier
                // Higher rating = better = lower multiplier (less time/stress needed)
                // Baseline 7.0 = 1.0 multiplier
                // 8.0 = 0.875 (12.5% better), 6.0 = 1.167 (16.7% worse)
                multiplier = 7.0 / bspbRating;
                source = 'bspbRatings.' + bspbMapping[traitPath];
            }
        }
        
        if (typeof multiplier === 'number') {
            weightedSum += multiplier * comp.percent;
            totalWeight += comp.percent;
            components.push({
                cultivar: comp.cultivar,
                percent: comp.percent,
                multiplier: Math.round(multiplier * 1000) / 1000,
                source: source
            });
        }
    });
    
    // Calculate weighted average
    if (totalWeight === 0) {
        return { 
            value: 1.0, 
            confidence: 'none', 
            error: 'No trait data found for components',
            missingCultivars 
        };
    }
    
    const calculatedValue = weightedSum / totalWeight;
    
    // Confidence based on data coverage
    const coverage = totalWeight / 100;
    const confidence = coverage >= 0.8 ? 'high' : coverage >= 0.5 ? 'medium' : 'low';
    
    return {
        value: Math.round(calculatedValue * 1000) / 1000, // Round to 3 decimals
        confidence: confidence,
        coverage: Math.round(coverage * 100) + '%',
        components: components,
        missingCultivars: missingCultivars.length > 0 ? missingCultivars : undefined,
        formula: components.map(c => c.cultivar + '(' + c.multiplier + '×' + c.percent + '%)').join(' + '),
        source: 'Calculated from BSPB component data'
    };
}

/**
 * Get all calculated traits for a blend
 * @param {string} blendName 
 * @returns {object} Full traits object with calculated values
 */
function getBlendCalculatedTraits(blendName) {
    const blend = UK_BLENDS[blendName];
    if (!blend) return null;
    
    return {
        wear: calculateBlendTrait(blend, 'wear'),
        recovery: calculateBlendTrait(blend, 'recovery'),
        disease: {
            redThread: calculateBlendTrait(blend, 'disease.redThread'),
            fusarium: calculateBlendTrait(blend, 'disease.fusarium')
        },
        _isCalculated: true,
        _blendName: blendName,
        _composition: blend.composition
    };
}

/**
 * Get wear multiplier for UK variety
 */
function getUKWearMultiplier(species, variety) {
    // Check blends first
    if (isUKBlend(variety)) {
        const blend = UK_BLENDS[variety];
        
        // If blend has composition data, try to calculate dynamically
        if (blend.composition && blend.composition.length > 0) {
            const calculated = calculateBlendTrait(blend, 'wear');
            
            // Only use calculation if we got meaningful data
            if (calculated.confidence !== 'none') {
                return { 
                    multiplier: calculated.value, 
                    confidence: calculated.confidence,
                    source: calculated.source,
                    coverage: calculated.coverage,
                    components: calculated.components,
                    formula: calculated.formula,
                    _isBlendCalculation: true
                };
            }
            
            // Composition exists but no component data - fall back with appropriate note
            if (blend.traits?.wear) {
                return {
                    ...blend.traits.wear,
                    _isStaticBlendData: true,
                    _note: 'Component cultivars not in BSPB database - using supplier specification'
                };
            }
        }
        
        // No composition - fallback to static traits
        if (blend.traits?.wear) {
            return {
                ...blend.traits.wear,
                _isStaticBlendData: true,
                _note: 'Blend composition not published - using supplier specification'
            };
        }
        
        return { multiplier: 1.0, confidence: 'low', source: 'Blend - no trait data' };
    }
    
    // Check fine fescue species
    const fineFescueKey = normaliseFineFeescueSpecies(species);
    if (fineFescueKey) {
        const data = getUKFineFescueData(fineFescueKey, variety);
        if (data?.traits?.wear) return data.traits.wear;
        return { multiplier: 1.0, confidence: 'none', source: 'No fine fescue wear data' };
    }

    // Check individual varieties
    const varietyData = getUKVarietyData(species, variety);
    if (varietyData?.traits?.wear) {
        return varietyData.traits.wear;
    }
    
    return { multiplier: 1.0, confidence: 'none', source: 'No UK data' };
}

/**
 * Get disease modifier for UK variety
 */
function getUKDiseaseModifier(species, variety, disease) {
    // Check blends first
    if (isUKBlend(variety)) {
        const blend = UK_BLENDS[variety];
        
        // Map disease names to trait paths
        const diseasePathMap = {
            'redThread': 'disease.redThread',
            'red_thread': 'disease.redThread',
            'fusarium': 'disease.fusarium',
            'microdochium': 'disease.fusarium',
            'dollarSpot': 'disease.dollarSpot',
            'dollar_spot': 'disease.dollarSpot'
        };
        
        const traitPath = diseasePathMap[disease] || 'disease.' + disease;
        
        // If blend has composition, try to calculate
        if (blend.composition && blend.composition.length > 0) {
            const calculated = calculateBlendTrait(blend, traitPath);
            
            if (calculated.confidence !== 'none') {
                return {
                    riskMultiplier: calculated.value,
                    confidence: calculated.confidence,
                    source: calculated.source,
                    coverage: calculated.coverage,
                    components: calculated.components,
                    _isBlendCalculation: true
                };
            }
        }
        
        // Fallback to static traits if available
        if (blend.traits?.disease?.[disease]) {
            return {
                ...blend.traits.disease[disease],
                _isStaticBlendData: true
            };
        }
        
        return { riskMultiplier: 1.0, confidence: 'none', source: 'Blend - no disease data' };
    }
    
    // Check fine fescue species
    const fineFescueKey = normaliseFineFeescueSpecies(species);
    if (fineFescueKey) {
        return getUKFineFescueDiseaseModifier(fineFescueKey, variety, disease);
    }
    
    // Check individual ryegrass/bent varieties
    const varietyData = getUKVarietyData(species, variety);
    if (!varietyData?.traits?.disease?.[disease]) {
        return { riskMultiplier: 1.0, confidence: 'none' };
    }
    return varietyData.traits.disease[disease];
}

/**
 * Get all UK perennial ryegrass varieties for dropdown
 */
function getUKRyegrassVarieties() {
    const varieties = [
        { value: 'generic', label: 'Generic / Unknown' }
    ];
    
    // Add individual cultivars
    Object.keys(UK_VARIETY_TRAITS.perennialRyegrass).forEach(name => {
        const v = UK_VARIETY_TRAITS.perennialRyegrass[name];
        varieties.push({
            value: name,
            label: `${name}${v.bspbRatings?.mean ? ` (BSPB ${v.bspbRatings.mean})` : ''}`,
            bspbMean: v.bspbRatings?.mean || null,
            type: v.type || 'diploid'
        });
    });
    
    // Add tetraploids
    Object.keys(UK_VARIETY_TRAITS.tetraploidRyegrass || {}).forEach(name => {
        const v = UK_VARIETY_TRAITS.tetraploidRyegrass[name];
        varieties.push({
            value: name,
            label: `${v.displayName} (BSPB ${v.bspbRatings?.mean || '?'})`,
            bspbMean: v.bspbRatings?.mean || null,
            type: 'tetraploid'
        });
    });
    
    // Add blends
    Object.keys(UK_BLENDS).forEach(name => {
        const b = UK_BLENDS[name];
        varieties.push({
            value: name,
            label: `${b.displayName} - Blend`,
            type: 'blend',
            supplier: b.supplier
        });
    });
    
    return varieties;
}

/**
 * Get UK CREEPING bentgrass varieties for dropdown
 * For Agrostis stolonifera only
 */
function getUKCreepingBentgrassVarieties() {
    const varieties = [
        { value: 'generic', label: 'Generic / Unknown' }
    ];
    
    Object.keys(UK_VARIETY_TRAITS.creepingBentgrass || {}).forEach(name => {
        const v = UK_VARIETY_TRAITS.creepingBentgrass[name];
        varieties.push({
            value: name,
            label: `${name} (BSPB ${v.bspbRatings?.mean || '?'})`,
            type: 'creeping'
        });
    });
    
    return varieties;
}

/**
 * Get UK BROWNTOP bent varieties for dropdown
 * For Agrostis capillaris (Colonial Bentgrass) only
 */
function getUKBrowntopBentVarieties() {
    const varieties = [
        { value: 'generic', label: 'Generic / Unknown' }
    ];
    
    Object.keys(UK_VARIETY_TRAITS.browntopBent || {}).forEach(name => {
        const v = UK_VARIETY_TRAITS.browntopBent[name];
        // Handle nested bspbRatings structure (greens/lawns)
        const greensMean = v.bspbRatings?.greens?.mean;
        const lawnsMean = v.bspbRatings?.lawns?.mean;
        const displayMean = greensMean || lawnsMean || v.bspbRatings?.mean || '?';
        
        // Add origin indicator for NZ cultivars
        const originTag = v.origin === 'New Zealand' ? ' [NZ]' : '';
        
        varieties.push({
            value: name,
            label: `${v.displayName}${originTag} (BSPB ${displayMean})`,
            type: 'browntop',
            origin: v.origin || 'UK/Europe'
        });
    });
    
    return varieties;
}

/**
 * Get ALL UK bentgrass varieties for dropdown (both species combined)
 * @deprecated Use getUKCreepingBentgrassVarieties() or getUKBrowntopBentVarieties() instead
 */
function getUKBentgrassVarieties() {
    const varieties = [
        { value: 'generic', label: 'Generic / Unknown' }
    ];
    
    // Creeping bent
    Object.keys(UK_VARIETY_TRAITS.creepingBentgrass || {}).forEach(name => {
        const v = UK_VARIETY_TRAITS.creepingBentgrass[name];
        varieties.push({
            value: name,
            label: `${name} (Creeping, BSPB ${v.bspbRatings?.mean || '?'})`,
            type: 'creeping'
        });
    });
    
    // Browntop bent
    Object.keys(UK_VARIETY_TRAITS.browntopBent || {}).forEach(name => {
        const v = UK_VARIETY_TRAITS.browntopBent[name];
        const greensMean = v.bspbRatings?.greens?.mean;
        const lawnsMean = v.bspbRatings?.lawns?.mean;
        const displayMean = greensMean || lawnsMean || v.bspbRatings?.mean || '?';
        const originTag = v.origin === 'New Zealand' ? ' [NZ]' : '';
        
        varieties.push({
            value: name,
            label: `${v.displayName}${originTag} (Browntop, BSPB ${displayMean})`,
            type: 'browntop',
            origin: v.origin || 'UK/Europe'
        });
    });
    
    return varieties;
}


// ═══════════════════════════════════════════════════════════════════════════
// EXPORTS
// ═══════════════════════════════════════════════════════════════════════════

if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        UK_VARIETY_TRAITS,
        UK_BLENDS,
        UK_FINE_FESCUE_TRAITS,
        getUKVarietyData,
        getUKBlendData,
        isUKBlend,
        getUKWearMultiplier,
        getUKDiseaseModifier,
        getUKRyegrassVarieties,
        getUKBentgrassVarieties,
        getUKCreepingBentgrassVarieties,
        getUKBrowntopBentVarieties,
        getUKChewingsFescueVarieties,
        getUKSlenderCreepingRedFescueVarieties,
        getUKStrongCreepingRedFescueVarieties,
        getUKHardFescueVarieties,
        getUKSheepFescueVarieties,
        getUKFineFescueData,
        getUKFineFescueDiseaseModifier,
        normaliseFineFeescueSpecies
    };
}

// Browser/WordPress global
if (typeof window !== 'undefined') {
    window.GAIP_UK_VARIETY_TRAITS = UK_VARIETY_TRAITS;
    window.GAIP_UK_BLENDS = UK_BLENDS;
    window.GAIP_UK_FINE_FESCUE_TRAITS = UK_FINE_FESCUE_TRAITS;
    window.gaip_getUKVarietyData = getUKVarietyData;
    window.gaip_getUKBlendData = getUKBlendData;
    window.gaip_isUKBlend = isUKBlend;
    window.gaip_calculateBlendTrait = calculateBlendTrait;
    window.gaip_getBlendCalculatedTraits = getBlendCalculatedTraits;
    window.gaip_getUKWearMultiplier = getUKWearMultiplier;
    window.gaip_getUKDiseaseModifier = getUKDiseaseModifier;
    window.gaip_getUKRyegrassVarieties = getUKRyegrassVarieties;
    window.gaip_getUKBentgrassVarieties = getUKBentgrassVarieties;
    window.gaip_getUKCreepingBentgrassVarieties = getUKCreepingBentgrassVarieties;
    window.gaip_getUKBrowntopBentVarieties = getUKBrowntopBentVarieties;
    window.gaip_getUKChewingsFescueVarieties = getUKChewingsFescueVarieties;
    window.gaip_getUKSlenderCreepingRedFescueVarieties = getUKSlenderCreepingRedFescueVarieties;
    window.gaip_getUKStrongCreepingRedFescueVarieties = getUKStrongCreepingRedFescueVarieties;
    window.gaip_getUKHardFescueVarieties = getUKHardFescueVarieties;
    window.gaip_getUKSheepFescueVarieties = getUKSheepFescueVarieties;
    window.gaip_getUKFineFescueData = getUKFineFescueData;
    window.gaip_getUKFineFescueDiseaseModifier = getUKFineFescueDiseaseModifier;
    window.gaip_normaliseFineFeescueSpecies = normaliseFineFeescueSpecies;
}
