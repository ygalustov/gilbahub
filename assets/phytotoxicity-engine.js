/**
 * GILBA AGRONOMIC INTELLIGENCE HUB
 * Phytotoxicity Engine - Direct Plant Damage Assessment
 * Version: 1.1.0 - Species normalization fix
 * 
 * PURPOSE: Assess direct phytotoxicity to turfgrass from irrigation water
 * - FOLIAR damage (sprinkler/overhead irrigation)
 * - ROOT damage (any irrigation method)
 * 
 * This is SEPARATE from soil chemistry impacts (SAR, ESP, structure degradation)
 * which are handled by the water-soil interaction module.
 * 
 * SOURCES:
 * - Ayers & Westcot, 1985. Water Quality for Agriculture. FAO Irrigation & Drainage Paper 29 Rev.1
 * - Carrow & Duncan, 1998. Salt-Affected Turfgrass Sites. Ann Arbor Press.
 * - Harivandi, 1999. Interpreting Irrigation Water Quality Reports. UC ANR Publication 8009.
 * - Marcum, 2006. Use of saline and non-potable water in the turfgrass industry. Agric Water Manag.
 * 
 * METHODOLOGY NOTE (ATC - Micah Woods):
 * Foliar damage thresholds are most relevant when water remains on leaves during
 * evaporative conditions. Night irrigation and syringing mitigate foliar risks.
 */

// ═══════════════════════════════════════════════════════════════════════════
// SPECIES SENSITIVITY DATA
// Lower sensitivity modifier = more sensitive to toxicity
// Base thresholds scaled by this modifier
// ═══════════════════════════════════════════════════════════════════════════

const SPECIES_PHYTOTOXICITY = {
  
  // COOL-SEASON GRASSES
  bentgrass: {
    displayName: 'Creeping Bentgrass',
    sensitivityClass: 'high',
    
    // Thresholds in mg/L (lower = more sensitive)
    thresholds: {
      sodium: {
        foliar: 50,    // Very sensitive - marginal damage begins
        root: 70       // Root damage threshold
      },
      chloride: {
        foliar: 70,    // Sensitive to foliar burn
        root: 180      // Root zone accumulation damage
      },
      boron: {
        foliar: 0.3,   // Highly sensitive
        root: 0.5
      }
    },
    sources: {
      sodium: 'Harivandi 1999 - bentgrass among most sensitive turfgrasses',
      chloride: 'Carrow & Duncan 1998 - cool-season foliar sensitivity',
      boron: 'Ayers & Westcot 1985 - fine-textured cool-season grasses'
    }
  },
  
  poa_annua: {
    displayName: 'Annual Bluegrass',
    sensitivityClass: 'high',
    thresholds: {
      sodium: { foliar: 50, root: 70 },
      chloride: { foliar: 70, root: 180 },
      boron: { foliar: 0.3, root: 0.5 }
    },
    sources: {
      sodium: 'Similar sensitivity profile to bentgrass',
      chloride: 'Carrow & Duncan 1998',
      boron: 'Limited specific data, assume bentgrass-like'
    }
  },
  
  kentucky_bluegrass: {
    displayName: 'Kentucky Bluegrass',
    sensitivityClass: 'moderate-high',
    thresholds: {
      sodium: { foliar: 70, root: 100 },
      chloride: { foliar: 100, root: 250 },
      boron: { foliar: 0.5, root: 1.0 }
    },
    sources: {
      sodium: 'Marcum 2006 - moderate Na sensitivity',
      chloride: 'Harivandi 1999 - 100 mg/L foliar threshold',
      boron: 'Ayers & Westcot 1985 FAO 29'
    }
  },
  
  perennial_ryegrass: {
    displayName: 'Perennial Ryegrass',
    sensitivityClass: 'moderate',
    thresholds: {
      sodium: { foliar: 70, root: 115 },
      chloride: { foliar: 100, root: 280 },
      boron: { foliar: 0.7, root: 1.5 }
    },
    sources: {
      sodium: 'Carrow & Duncan 1998 - moderate tolerance',
      chloride: 'Harivandi 1999',
      boron: 'Ayers & Westcot 1985'
    }
  },
  
  tall_fescue: {
    displayName: 'Tall Fescue',
    sensitivityClass: 'moderate-tolerant',
    thresholds: {
      sodium: { foliar: 100, root: 150 },
      chloride: { foliar: 140, root: 355 },
      boron: { foliar: 1.0, root: 2.0 }
    },
    sources: {
      sodium: 'Marcum 2006 - moderate salt tolerance',
      chloride: 'Harivandi 1999 - 140 mg/L foliar threshold typical',
      boron: 'Ayers & Westcot 1985'
    }
  },
  
  fine_fescue: {
    displayName: 'Fine Fescue',
    sensitivityClass: 'moderate-high',
    thresholds: {
      sodium: { foliar: 70, root: 100 },
      chloride: { foliar: 100, root: 250 },
      boron: { foliar: 0.5, root: 1.0 }
    },
    sources: {
      sodium: 'Limited specific data - assume KBG-like',
      chloride: 'Conservative estimate',
      boron: 'Conservative estimate'
    }
  },
  
  // WARM-SEASON GRASSES
  bermuda: {
    displayName: 'Bermudagrass',
    sensitivityClass: 'tolerant',
    thresholds: {
      sodium: { foliar: 150, root: 230 },
      chloride: { foliar: 200, root: 450 },
      boron: { foliar: 1.5, root: 3.0 }
    },
    sources: {
      sodium: 'Marcum 2006 - highly salt tolerant C4',
      chloride: 'Carrow & Duncan 1998 - tolerant warm-season',
      boron: 'Ayers & Westcot 1985 - tolerant range'
    }
  },
  
  kikuyu: {
    displayName: 'Kikuyu',
    sensitivityClass: 'moderate-tolerant',
    thresholds: {
      sodium: { foliar: 100, root: 140 },
      chloride: { foliar: 140, root: 320 },
      boron: { foliar: 1.0, root: 2.0 }
    },
    sources: {
      sodium: 'Australian research - moderate tolerance',
      chloride: 'Field observations - similar to tall fescue',
      boron: 'Limited data - conservative estimate'
    }
  },
  
  couch: {
    displayName: 'Couch (Australian Bermuda)',
    sensitivityClass: 'tolerant',
    thresholds: {
      sodium: { foliar: 150, root: 230 },
      chloride: { foliar: 200, root: 450 },
      boron: { foliar: 1.5, root: 3.0 }
    },
    sources: {
      sodium: 'Same as bermudagrass',
      chloride: 'Same as bermudagrass',
      boron: 'Same as bermudagrass'
    }
  },
  
  buffalo: {
    displayName: 'Buffalo Grass',
    sensitivityClass: 'tolerant',
    thresholds: {
      sodium: { foliar: 140, root: 200 },
      chloride: { foliar: 180, root: 400 },
      boron: { foliar: 1.5, root: 3.0 }
    },
    sources: {
      sodium: 'Marcum 2006 - native prairie adaptation',
      chloride: 'Good chloride tolerance',
      boron: 'Tolerant range'
    }
  },
  
  seashore_paspalum: {
    displayName: 'Seashore Paspalum',
    sensitivityClass: 'highly-tolerant',
    thresholds: {
      sodium: { foliar: 250, root: 400 },
      chloride: { foliar: 350, root: 700 },
      boron: { foliar: 2.0, root: 4.0 }
    },
    sources: {
      sodium: 'Duncan & Carrow 2000 - bred for salinity',
      chloride: 'Specifically selected for coastal conditions',
      boron: 'High tolerance from halophyte characteristics'
    }
  },
  
  zoysia: {
    displayName: 'Zoysiagrass',
    sensitivityClass: 'moderate-tolerant',
    thresholds: {
      sodium: { foliar: 120, root: 180 },
      chloride: { foliar: 160, root: 380 },
      boron: { foliar: 1.2, root: 2.5 }
    },
    sources: {
      sodium: 'Marcum 2006 - moderate-good tolerance',
      chloride: 'Variable by cultivar',
      boron: 'Moderate tolerance'
    }
  },
  
  st_augustine: {
    displayName: 'St. Augustine',
    sensitivityClass: 'moderate',
    thresholds: {
      sodium: { foliar: 90, root: 130 },
      chloride: { foliar: 120, root: 300 },
      boron: { foliar: 0.8, root: 1.5 }
    },
    sources: {
      sodium: 'Marcum 2006 - less tolerant than bermuda',
      chloride: 'Moderate C4 tolerance',
      boron: 'Moderate tolerance'
    }
  },
  
  centipede: {
    displayName: 'Centipede Grass',
    sensitivityClass: 'sensitive',
    thresholds: {
      sodium: { foliar: 60, root: 90 },
      chloride: { foliar: 90, root: 220 },
      boron: { foliar: 0.5, root: 1.0 }
    },
    sources: {
      sodium: 'Known salt sensitivity - poor tolerance',
      chloride: 'Avoid saline irrigation',
      boron: 'Sensitive'
    }
  }
};

// ═══════════════════════════════════════════════════════════════════════════
// BICARBONATE FOLIAR RESIDUE
// (Separate from soil chemistry - aesthetic/functional issue)
// ═══════════════════════════════════════════════════════════════════════════

const HCO3_THRESHOLDS = {
  residue: {
    low: 150,      // Minor residue possible
    moderate: 300, // Noticeable white deposits
    high: 500      // Heavy residue, aesthetic concern
  },
  // Not species-specific - aesthetic issue on all turf
  source: 'Harivandi 1999 - foliar residue thresholds'
};

// ═══════════════════════════════════════════════════════════════════════════
// SPECIES NORMALIZATION
// Converts display names and variants to lookup keys
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Normalize species string to match SPECIES_PHYTOTOXICITY keys
 * @param {string} species - Species name in any format
 * @returns {string} Normalized key for lookup
 */
function normalizePhytotoxicitySpecies(species) {
  if (!species) return 'perennial_ryegrass';
  
  // Convert to lowercase and replace spaces with underscores
  let normalized = species.toLowerCase()
    .trim()
    .replace(/\s+/g, '_')
    .replace(/[()]/g, '')
    .replace(/-/g, '_');
  
  // Remove common suffixes (greens, fairways, tees, etc.)
  normalized = normalized
    .replace(/_greens$/, '')
    .replace(/_fairways$/, '')
    .replace(/_tees$/, '')
    .replace(/_roughs$/, '');
  
  // Direct key matches (already in correct format)
  if (SPECIES_PHYTOTOXICITY[normalized]) {
    return normalized;
  }
  
  // Alias mapping for common variations
  const aliases = {
    // Bentgrass variations
    'creeping_bentgrass': 'bentgrass',
    'bentgrass': 'bentgrass',
    'bent': 'bentgrass',
    'agrostis_stolonifera': 'bentgrass',
    'browntop_bentgrass': 'bentgrass',
    'browntop_bent': 'bentgrass',
    'colonial_bentgrass': 'bentgrass',
    
    // Ryegrass variations
    'perennial_ryegrass': 'perennial_ryegrass',
    'ryegrass': 'perennial_ryegrass',
    'prg': 'perennial_ryegrass',
    'lolium_perenne': 'perennial_ryegrass',
    
    // Bermuda/Couch variations
    'bermudagrass': 'bermuda',
    'bermuda': 'bermuda',
    'cynodon_dactylon': 'bermuda',
    'couch': 'couch',
    'couch_grass': 'couch',
    'green_couch': 'couch',
    
    // Kikuyu
    'kikuyu': 'kikuyu',
    'kikuyugrass': 'kikuyu',
    'pennisetum_clandestinum': 'kikuyu',
    
    // Bluegrass variations
    'kentucky_bluegrass': 'kentucky_bluegrass',
    'kbg': 'kentucky_bluegrass',
    'poa_pratensis': 'kentucky_bluegrass',
    'bluegrass': 'kentucky_bluegrass',
    
    // Poa annua
    'poa_annua': 'poa_annua',
    'poa': 'poa_annua',
    'annual_bluegrass': 'poa_annua',
    
    // Fescue variations
    'tall_fescue': 'tall_fescue',
    'festuca_arundinacea': 'tall_fescue',
    'fine_fescue': 'fine_fescue',
    'chewings_fescue': 'fine_fescue',
    'chewings': 'fine_fescue',
    'slender_creeping_red_fescue': 'fine_fescue',
    'strong_creeping_red_fescue': 'fine_fescue',
    'creeping_red_fescue': 'fine_fescue',
    'fescue': 'fine_fescue',
    
    // Paspalum
    'seashore_paspalum': 'seashore_paspalum',
    'paspalum': 'seashore_paspalum',
    'paspalum_vaginatum': 'seashore_paspalum',
    
    // Zoysia
    'zoysia': 'zoysia',
    'zoysiagrass': 'zoysia',
    'zoysia_japonica': 'zoysia',
    'zoysia_matrella': 'zoysia',
    
    // Buffalo
    'buffalo': 'buffalo',
    'buffalograss': 'buffalo',
    'buffalo_grass': 'buffalo',
    'buchloe_dactyloides': 'buffalo',
    'stenotaphrum': 'buffalo',
    
    // St Augustine
    'st_augustine': 'st_augustine',
    'st__augustine': 'st_augustine',
    'saint_augustine': 'st_augustine',
    'stenotaphrum_secundatum': 'st_augustine',
    
    // Centipede
    'centipede': 'centipede',
    'centipedegrass': 'centipede',
    'centipede_grass': 'centipede',
    'eremochloa_ophiuroides': 'centipede'
  };
  
  // Check aliases
  if (aliases[normalized]) {
    return aliases[normalized];
  }
  
  // Partial match fallbacks
  if (normalized.includes('bentgrass') || normalized.includes('bent')) {
    return 'bentgrass';
  }
  if (normalized.includes('ryegrass') || normalized.includes('rye')) {
    return 'perennial_ryegrass';
  }
  if (normalized.includes('bermuda')) {
    return 'bermuda';
  }
  if (normalized.includes('couch')) {
    return 'couch';
  }
  if (normalized.includes('kikuyu')) {
    return 'kikuyu';
  }
  if (normalized.includes('bluegrass') && !normalized.includes('annual')) {
    return 'kentucky_bluegrass';
  }
  if (normalized.includes('poa')) {
    return 'poa_annua';
  }
  if (normalized.includes('fescue')) {
    if (normalized.includes('tall')) return 'tall_fescue';
    return 'fine_fescue';
  }
  if (normalized.includes('chewing')) {
    return 'fine_fescue';
  }
  if (normalized.includes('paspalum')) {
    return 'seashore_paspalum';
  }
  if (normalized.includes('zoysia')) {
    return 'zoysia';
  }
  if (normalized.includes('buffalo')) {
    return 'buffalo';
  }
  if (normalized.includes('augustine')) {
    return 'st_augustine';
  }
  if (normalized.includes('centipede')) {
    return 'centipede';
  }
  
  // Default fallback
  console.warn(`[Phytotoxicity] Unknown species "${species}" - defaulting to perennial_ryegrass`);
  return 'perennial_ryegrass';
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN ANALYSIS FUNCTION
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Analyze phytotoxicity risk for irrigation water
 * @param {object} waterData - { Na, Cl, B, HCO3 } in mg/L
 * @param {string} species - Species key (e.g., 'bentgrass', 'bermuda')
 * @param {string} variety - Optional variety name for modifier lookup
 * @param {string} irrigationMethod - 'sprinkler', 'drip', or 'mixed'
 * @returns {object} Phytotoxicity analysis results
 */
function analyzePhytotoxicity(waterData, species, variety = null, irrigationMethod = 'sprinkler') {
  
  // Normalize species key for lookup
  const normalizedSpecies = normalizePhytotoxicitySpecies(species);
  
  // Get species data (should always succeed after normalization)
  const speciesData = SPECIES_PHYTOTOXICITY[normalizedSpecies] || SPECIES_PHYTOTOXICITY['perennial_ryegrass'];
  
  // Check for variety-level salinity modifier
  let varietyModifier = 1.0;
  if (variety && typeof window.gaip_getVarietyTraits === 'function') {
    const traits = window.gaip_getVarietyTraits(normalizedSpecies, variety);
    if (traits?.traits?.salinity?.multiplier) {
      varietyModifier = traits.traits.salinity.multiplier;
      // Lower multiplier = more tolerant, so inverse for threshold
      // e.g., 0.9 multiplier means 10% more tolerant, so thresholds increase by ~10%
    }
  }
  
  const results = {
    species: speciesData.displayName,
    speciesKey: normalizedSpecies,  // Include normalized key for debugging
    inputSpecies: species,          // Include original input for debugging
    sensitivityClass: speciesData.sensitivityClass,
    irrigationMethod: irrigationMethod,
    varietyModifier: varietyModifier,
    assessments: [],
    overallRisk: 'low',
    priorityActions: []
  };
  
  // Determine if foliar exposure relevant
  const hasFoliarExposure = irrigationMethod === 'sprinkler' || irrigationMethod === 'mixed';
  
  // ─────────────────────────────────────────────────────────────────────────
  // SODIUM ASSESSMENT
  // ─────────────────────────────────────────────────────────────────────────
  if (waterData.Na > 0) {
    const thresholds = speciesData.thresholds.sodium;
    const adjustedFoliar = thresholds.foliar / varietyModifier;
    const adjustedRoot = thresholds.root / varietyModifier;
    
    let naStatus = 'safe';
    let naRisk = [];
    let naDriver = '';
    let naRecommendation = '';
    
    // Check foliar risk (only if sprinkler)
    if (hasFoliarExposure && waterData.Na > adjustedFoliar) {
      if (waterData.Na > adjustedFoliar * 2) {
        naStatus = 'high';
        naRisk.push('severe foliar burn');
        naDriver = `Na ${waterData.Na.toFixed(0)} mg/L exceeds foliar damage threshold (${adjustedFoliar.toFixed(0)} mg/L) by ${((waterData.Na / adjustedFoliar - 1) * 100).toFixed(0)}%`;
      } else {
        naStatus = 'moderate';
        naRisk.push('foliar burn risk');
        naDriver = `Na ${waterData.Na.toFixed(0)} mg/L above foliar threshold (${adjustedFoliar.toFixed(0)} mg/L) for ${speciesData.displayName}`;
      }
      naRecommendation = 'Irrigate at night to minimise foliar residence time; syringe with clean water after irrigation if possible';
    }
    
    // Check root risk
    if (waterData.Na > adjustedRoot) {
      if (naStatus === 'safe') naStatus = 'moderate';
      if (waterData.Na > adjustedRoot * 1.5) naStatus = 'high';
      naRisk.push('root damage');
      naDriver = naDriver || `Na ${waterData.Na.toFixed(0)} mg/L exceeds root damage threshold (${adjustedRoot.toFixed(0)} mg/L)`;
      naRecommendation = naRecommendation || 'Increase leaching fraction; maintain adequate soil calcium';
    }
    
    if (naStatus !== 'safe') {
      results.assessments.push({
        parameter: 'Sodium (Na)',
        value: waterData.Na,
        unit: 'mg/L',
        status: naStatus,
        pathway: hasFoliarExposure ? 'Foliar + Root' : 'Root only',
        risks: naRisk,
        driver: naDriver,
        recommendation: naRecommendation,
        thresholds: {
          foliar: hasFoliarExposure ? adjustedFoliar : null,
          root: adjustedRoot
        },
        source: speciesData.sources.sodium
      });
    }
  }
  
  // ─────────────────────────────────────────────────────────────────────────
  // CHLORIDE ASSESSMENT
  // ─────────────────────────────────────────────────────────────────────────
  if (waterData.Cl > 0) {
    const thresholds = speciesData.thresholds.chloride;
    const adjustedFoliar = thresholds.foliar / varietyModifier;
    const adjustedRoot = thresholds.root / varietyModifier;
    
    let clStatus = 'safe';
    let clRisk = [];
    let clDriver = '';
    let clRecommendation = '';
    
    // Check foliar risk
    if (hasFoliarExposure && waterData.Cl > adjustedFoliar) {
      if (waterData.Cl > adjustedFoliar * 2) {
        clStatus = 'high';
        clRisk.push('severe leaf tip burn');
        clDriver = `Cl ${waterData.Cl.toFixed(0)} mg/L exceeds foliar damage threshold (${adjustedFoliar.toFixed(0)} mg/L) by ${((waterData.Cl / adjustedFoliar - 1) * 100).toFixed(0)}%`;
      } else {
        clStatus = 'moderate';
        clRisk.push('leaf tip necrosis');
        clDriver = `Cl ${waterData.Cl.toFixed(0)} mg/L above foliar threshold (${adjustedFoliar.toFixed(0)} mg/L) for ${speciesData.displayName}`;
      }
      clRecommendation = 'Irrigate at night; consider drip irrigation to bypass foliage';
    }
    
    // Check root risk
    if (waterData.Cl > adjustedRoot) {
      if (clStatus === 'safe') clStatus = 'moderate';
      if (waterData.Cl > adjustedRoot * 1.5) clStatus = 'high';
      clRisk.push('root zone toxicity');
      clDriver = clDriver || `Cl ${waterData.Cl.toFixed(0)} mg/L exceeds root damage threshold (${adjustedRoot.toFixed(0)} mg/L)`;
      clRecommendation = clRecommendation || 'Increase leaching; maintain good drainage';
    }
    
    if (clStatus !== 'safe') {
      results.assessments.push({
        parameter: 'Chloride (Cl)',
        value: waterData.Cl,
        unit: 'mg/L',
        status: clStatus,
        pathway: hasFoliarExposure ? 'Foliar + Root' : 'Root only',
        risks: clRisk,
        driver: clDriver,
        recommendation: clRecommendation,
        thresholds: {
          foliar: hasFoliarExposure ? adjustedFoliar : null,
          root: adjustedRoot
        },
        source: speciesData.sources.chloride
      });
    }
  }
  
  // ─────────────────────────────────────────────────────────────────────────
  // BORON ASSESSMENT
  // ─────────────────────────────────────────────────────────────────────────
  if (waterData.B > 0) {
    const thresholds = speciesData.thresholds.boron;
    const adjustedFoliar = thresholds.foliar / varietyModifier;
    const adjustedRoot = thresholds.root / varietyModifier;
    
    let bStatus = 'safe';
    let bRisk = [];
    let bDriver = '';
    let bRecommendation = '';
    
    // Check foliar risk (boron absorbed through leaves)
    if (hasFoliarExposure && waterData.B > adjustedFoliar) {
      if (waterData.B > adjustedFoliar * 2) {
        bStatus = 'high';
        bRisk.push('severe boron toxicity');
        bDriver = `B ${waterData.B.toFixed(2)} mg/L exceeds foliar damage threshold (${adjustedFoliar.toFixed(2)} mg/L) by ${((waterData.B / adjustedFoliar - 1) * 100).toFixed(0)}%`;
      } else {
        bStatus = 'moderate';
        bRisk.push('marginal leaf necrosis');
        bDriver = `B ${waterData.B.toFixed(2)} mg/L above foliar threshold (${adjustedFoliar.toFixed(2)} mg/L) for ${speciesData.displayName}`;
      }
      bRecommendation = 'Monitor leaf margins for necrosis; consider blending with lower-B source';
    }
    
    // Check root risk
    if (waterData.B > adjustedRoot) {
      if (bStatus === 'safe') bStatus = 'moderate';
      if (waterData.B > adjustedRoot * 1.5) bStatus = 'high';
      bRisk.push('root zone accumulation');
      bDriver = bDriver || `B ${waterData.B.toFixed(2)} mg/L exceeds root damage threshold (${adjustedRoot.toFixed(2)} mg/L)`;
      bRecommendation = bRecommendation || 'Increase leaching; boron accumulates in root zone';
    }
    
    if (bStatus !== 'safe') {
      results.assessments.push({
        parameter: 'Boron (B)',
        value: waterData.B,
        unit: 'mg/L',
        status: bStatus,
        pathway: hasFoliarExposure ? 'Foliar + Root' : 'Root only',
        risks: bRisk,
        driver: bDriver,
        recommendation: bRecommendation,
        thresholds: {
          foliar: hasFoliarExposure ? adjustedFoliar : null,
          root: adjustedRoot
        },
        source: speciesData.sources.boron
      });
    }
  }
  
  // ─────────────────────────────────────────────────────────────────────────
  // BICARBONATE RESIDUE (Aesthetic - sprinkler only)
  // ─────────────────────────────────────────────────────────────────────────
  if (hasFoliarExposure && waterData.HCO3 > HCO3_THRESHOLDS.residue.low) {
    let hco3Status = 'safe';
    let hco3Driver = '';
    let hco3Recommendation = '';
    
    if (waterData.HCO3 > HCO3_THRESHOLDS.residue.high) {
      hco3Status = 'moderate';
      hco3Driver = `HCO₃ ${waterData.HCO3.toFixed(0)} mg/L causes heavy white foliar deposits`;
      hco3Recommendation = 'Acidify irrigation water to pH 6.5-7.0; syringe after irrigation';
    } else if (waterData.HCO3 > HCO3_THRESHOLDS.residue.moderate) {
      hco3Status = 'low-moderate';
      hco3Driver = `HCO₃ ${waterData.HCO3.toFixed(0)} mg/L causes visible residue buildup`;
      hco3Recommendation = 'Consider acidification if aesthetics important (e.g., golf greens)';
    } else {
      hco3Status = 'low';
      hco3Driver = `HCO₃ ${waterData.HCO3.toFixed(0)} mg/L may cause minor residue`;
      hco3Recommendation = 'Monitor for buildup on fine turf';
    }
    
    results.assessments.push({
      parameter: 'Bicarbonate Residue (HCO₃)',
      value: waterData.HCO3,
      unit: 'mg/L',
      status: hco3Status,
      pathway: 'Foliar (aesthetic)',
      risks: ['white deposits', 'appearance degradation'],
      driver: hco3Driver,
      recommendation: hco3Recommendation,
      thresholds: HCO3_THRESHOLDS.residue,
      source: HCO3_THRESHOLDS.source
    });
  }
  
  // ─────────────────────────────────────────────────────────────────────────
  // OVERALL RISK DETERMINATION
  // ─────────────────────────────────────────────────────────────────────────
  const highCount = results.assessments.filter(a => a.status === 'high').length;
  const modCount = results.assessments.filter(a => a.status === 'moderate').length;
  
  if (highCount >= 1) {
    results.overallRisk = 'high';
  } else if (modCount >= 2) {
    results.overallRisk = 'moderate-high';
  } else if (modCount >= 1) {
    results.overallRisk = 'moderate';
  } else if (results.assessments.length > 0) {
    results.overallRisk = 'low-moderate';
  }
  
  // Generate priority actions
  results.assessments
    .filter(a => a.status === 'high' || a.status === 'moderate')
    .forEach(a => {
      results.priorityActions.push({
        parameter: a.parameter,
        action: a.recommendation,
        urgency: a.status === 'high' ? 'immediate' : 'monitor'
      });
    });
  
  return results;
}

// ═══════════════════════════════════════════════════════════════════════════
// RENDER FUNCTION FOR PROGRESSIVE DISCLOSURE
// ═══════════════════════════════════════════════════════════════════════════

function renderPhytotoxicityCard(analysis) {
  if (!analysis || analysis.assessments.length === 0) {
    return ''; // No issues to display
  }
  
  const cardId = `phytotox-${Date.now()}`;
  
  // Status class mapping
  const statusMap = {
    'high': 'status-deficient',
    'moderate-high': 'status-deficient',
    'moderate': 'status-borderline',
    'low-moderate': 'status-borderline',
    'low': 'status-adequate'
  };
  
  const statusLabel = {
    'high': 'High Risk',
    'moderate-high': 'Elevated',
    'moderate': 'Caution',
    'low-moderate': 'Monitor',
    'low': 'Acceptable'
  };
  
  const statusClass = statusMap[analysis.overallRisk] || 'status-adequate';
  const label = statusLabel[analysis.overallRisk] || 'OK';
  
  // Build assessment details
  let assessmentHtml = analysis.assessments.map(a => {
    const aStatusClass = statusMap[a.status] || 'status-adequate';
    return `
      <div style="margin: 8px 0; padding: 8px; background: var(--gaip-surface-muted); border-radius: 4px; border-left: 3px solid ${a.status === 'high' ? '#dc2626' : a.status === 'moderate' ? '#d97706' : 'var(--gaip-text-secondary)'};">
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <strong>${a.parameter}</strong>
          <span class="gaip-status-badge ${aStatusClass}" style="font-size: 10px; padding: 2px 6px;">
            ${a.value} ${a.unit}
          </span>
        </div>
        <div style="font-size: 11px; color: var(--gaip-text); margin-top: 4px;">
          <em>Pathway:</em> ${a.pathway}<br>
          <em>Risk:</em> ${a.risks.join(', ')}
        </div>
        <div style="font-size: 11px; margin-top: 6px; color: var(--gaip-text);">
          ${a.driver}
        </div>
        <div style="font-size: 11px; margin-top: 4px; color: #059669; font-style: italic;">
          → ${a.recommendation}
        </div>
      </div>
    `;
  }).join('');
  
  return `
    <div class="gaip-diagnostic-card water-card" style="border-left: 4px solid ${analysis.overallRisk === 'high' ? '#dc2626' : '#d97706'};">
      <div class="gaip-verdict">
        <div class="gaip-verdict-header">
          <h4 class="gaip-parameter">Direct Phytotoxicity</h4>
          <div class="gaip-status-badge ${statusClass}">
            <span class="gaip-status-icon">${statusClass === 'status-adequate' ? '✓' : '⚠'}</span>
            <span class="gaip-status-label">${label}</span>
          </div>
        </div>
        <div class="gaip-verdict-content">
          <div class="gaip-driver">
            <span class="gaip-label">Species:</span>
            <span class="gaip-value">${analysis.species}</span>
          </div>
          <div class="gaip-driver-text">
            ${analysis.assessments.length} parameter${analysis.assessments.length > 1 ? 's' : ''} affecting ${analysis.sensitivityClass}-sensitivity turf via ${analysis.irrigationMethod} irrigation
          </div>
        </div>
        <div class="gaip-verdict-actions">
          <button class="gaip-expand-btn" data-target="why-${cardId}">
            Details <span class="gaip-icon">▼</span>
          </button>
        </div>
      </div>
      <div class="gaip-why-section gaip-collapsed" id="why-${cardId}">
        <div class="gaip-why-content" style="padding: 12px;">
          <p style="font-size: 11px; color: var(--gaip-text); margin: 0 0 12px 0;">
            <strong>Note:</strong> These thresholds assess <em>direct plant damage</em> from water constituents, 
            separate from soil chemistry impacts (SAR, structure degradation).
          </p>
          ${assessmentHtml}
          ${analysis.priorityActions.length > 0 ? `
            <div style="margin-top: 16px; padding-top: 12px; border-top: 1px solid var(--gaip-border);">
              <strong style="color: #dc2626;">Priority Actions:</strong>
              <ol style="margin: 8px 0 0 0; padding-left: 20px; font-size: 12px;">
                ${analysis.priorityActions.map(pa => `
                  <li style="margin: 4px 0;">
                    <strong>${pa.parameter}:</strong> ${pa.action}
                    <span style="color: ${pa.urgency === 'immediate' ? '#dc2626' : '#d97706'}; font-size: 10px;">[${pa.urgency}]</span>
                  </li>
                `).join('')}
              </ol>
            </div>
          ` : ''}
        </div>
      </div>
    </div>
  `;
}

// ═══════════════════════════════════════════════════════════════════════════
// UTILITY FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Get list of supported species
 */
function getPhytotoxicitySpecies() {
  return Object.keys(SPECIES_PHYTOTOXICITY).map(key => ({
    key: key,
    name: SPECIES_PHYTOTOXICITY[key].displayName,
    sensitivity: SPECIES_PHYTOTOXICITY[key].sensitivityClass
  }));
}

/**
 * Get threshold data for a specific species
 */
function getSpeciesThresholds(species) {
  const normalized = normalizePhytotoxicitySpecies(species);
  return SPECIES_PHYTOTOXICITY[normalized] || null;
}

// ═══════════════════════════════════════════════════════════════════════════
// EXPORTS
// ═══════════════════════════════════════════════════════════════════════════

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    SPECIES_PHYTOTOXICITY,
    analyzePhytotoxicity,
    renderPhytotoxicityCard,
    getPhytotoxicitySpecies,
    getSpeciesThresholds,
    normalizePhytotoxicitySpecies
  };
}

if (typeof window !== 'undefined') {
  window.GAIP_SPECIES_PHYTOTOXICITY = SPECIES_PHYTOTOXICITY;
  window.gaip_analyzePhytotoxicity = analyzePhytotoxicity;
  window.gaip_renderPhytotoxicityCard = renderPhytotoxicityCard;
  window.gaip_getPhytotoxicitySpecies = getPhytotoxicitySpecies;
  window.gaip_getSpeciesThresholds = getSpeciesThresholds;
  window.gaip_normalizePhytotoxicitySpecies = normalizePhytotoxicitySpecies;
  
}
