/**
 * =============================================================================
 * GILBA HUB ORCHESTRATOR v1.10.0
 * =============================================================================
 *
 * Central orchestration layer for deterministic module execution.
 * Resolves the "wiring gap" by establishing explicit dependency chains
 * and ensuring causality between engine outputs and inputs.
 *
 * v1.10.0: DMI growth suppression wiring — GAIP_DMI.track() + assessCombinedRisk()
 *          injected into both pure-function and legacy PGR paths. Sets
 *          window.GAIP_DMI_RESULT and window.GAIP_COMBINED_SUPPRESSION so
 *          word-export.js picks up combined risk regardless of execution path.
 *          Attaches .dmi to _hubState.computed.pgr / GAIP_PGR_RESULT for
 *          direct consumption by daily-dashboard.js (v1.5.9).
 * v1.2.0: GAIP_CANONICAL_STATE - Single Source of Truth
 * ─────────────────────────────────────────────────────────────────────────────
 * All engines now consume from GAIP_CANONICAL_STATE, populated once at the
 * start of orchestration. This ensures consistent data across all modules.
 *
 * Data Priority:
 *   Climate:   Climate Engine (API) → Manual → Defaults
 *   Soil Temp: Sensor (TDR/Pogo) → API → Manual → Physics model
 *
 * DEPENDENCY GRAPH:
 * ─────────────────────────────────────────────────────────────────────────────
 *
 *   [Climate API / Manual / Sensor]
 *           │
 *           ▼
 *   ┌───────────────────────────────────────────────────────────────────────┐
 *   │                   GAIP_CANONICAL_STATE (populated once)               │
 *   │  - Climate data (from Climate Engine)                                │
 *   │  - Soil temperature (sensor > API > manual > physics)                │
 *   │  - Turf context, quality metadata                                    │
 *   └───────────────────────────────────────────────────────────────────────┘
 *           │
 *           ▼
 *   ┌───────────────────────────────────────────────────────────────────────┐
 *   │                     CLIMATE ENGINE (authoritative)                    │
 *   │  - Temperature, humidity, dewpoint, ET₀, solar radiation             │
 *   │  - Growth potential (C3/C4)                                          │
 *   │  - GDD accumulation                                                  │
 *   └───────────────────────────────────────────────────────────────────────┘
 *           │
 *           ├──────────────────────┬──────────────────────┬─────────────────┐
 *           ▼                      ▼                      ▼                 │
 *   ┌───────────────┐      ┌───────────────┐      ┌───────────────┐        │
 *   │  DEW ENGINE   │      │ SHADE ENGINE  │      │SALINITY ENGINE│        │
 *   │ Leaf wetness  │      │ DLI, stress   │      │ Growth penalty│        │
 *   └───────────────┘      └───────────────┘      └───────────────┘        │
 *           │                      │                      │                 │
 *           └──────────────────────┼──────────────────────┘                 │
 *                                  ▼                                        │
 *   ┌───────────────────────────────────────────────────────────────────────┐
 *   │                        STRESS AGGREGATOR                              │
 *   │  - Combined growth modifier                                          │
 *   │  - Environmental stress index                                        │
 *   └───────────────────────────────────────────────────────────────────────┘
 *           │
 *           ├──────────────────────┬──────────────────────┐
 *           ▼                      ▼                      ▼
 *   ┌───────────────┐      ┌───────────────┐      ┌───────────────┐
 *   │DISEASE ENGINE │      │ WEAR/RECOVERY │      │  IRRIGATION   │
 *   │ + shade stress│      │ + salinity    │      │  SCHEDULER    │
 *   │ + dew duration│      │ + shade       │      │               │
 *   │ + N status    │      │ + temperature │      │               │
 *   └───────────────┘      └───────────────┘      └───────────────┘
 *           │                      │                      │
 *           └──────────────────────┼──────────────────────┘
 *                                  ▼
 *   ┌───────────────────────────────────────────────────────────────────────┐
 *   │                      HUB SUMMARY / EXPORT                             │
 *   └───────────────────────────────────────────────────────────────────────┘
 *
 * RELATIONSHIP WITH CASCADE ORCHESTRATOR:
 * ─────────────────────────────────────────────────────────────────────────────
 * hub-orchestrator.js  = PRIMARY orchestrator. Owns _hubState, runs computeAll(),
 *                        resolves data sources, fires gaip:orchestrator-complete.
 * cascade-orchestrator.js = ADAPTER. Provides GilbaCascadeOrchestrator.runCascade()
 *                           interface expected by hub-tissue-v3.js. Routes all
 *                           engine calls through this orchestrator. Fires
 *                           gaip:cascade-complete after downstream engines finish.
 * Load order: gaip-utils.js → species-controller.js → hub-orchestrator.js
 *             → cascade-orchestrator.js → hub-tissue-v3.js
 *
 * @author Gilba Solutions
 * @version 1.13.0
 * =============================================================================
 */

(function (global) {
  "use strict";

  // =========================================================================
  // CONFIGURATION
  // =========================================================================

  const ORCHESTRATOR_CONFIG = {
    version: "1.13.0",
    debug: false,

    // Execution order - modules are run in this sequence
    // NOTE: This is now secondary to GilbaDependencyGraph.getFullExecutionOrder()
    executionOrder: [
      "climate", // 1. Climate data (source of truth for weather)
      "dew", // 2. Dew/leaf wetness (depends on climate)
      "shade", // 3. Shade analysis (depends on climate)
      "salinity", // 4. Salinity penalty (depends on turf profile)
      "stress", // 5. Aggregate stress factors
      "tissue", // 6. Tissue analysis
      "tissue-corrective", // 7. Tissue corrective actions (depends on 6 + nutrition calendar)
      "disease", // 8. Disease risk (depends on 1,2,3,6)
      "wear", // 9. Wear/recovery (depends on 3,4,5)
      "irrigation", // 10. Irrigation scheduling (depends on 1,4)
      "pgr", // 11. PGR management (depends on 1,5)
      "summary", // 12. Final summary
    ],

    // Map short names to full engine IDs for dependency graph integration
    engineIdMap: {
      climate: "climate-engine",
      dew: "dew-prediction-engine",
      shade: "shade-engine",
      salinity: "salinity-penalty-engine",
      stress: "stress-aggregator",
      tissue: "tissue-engine",
      "tissue-corrective": "tissue-corrective-engine",
      disease: "disease-engine",
      wear: "wear-recovery-engine",
      irrigation: "irrigation-scheduler",
      pgr: "pgr-module",
      summary: "hub-summary", // PATCH v1.6.1: was 'stress-trajectory-engine' (incorrect, trajectory runs via integration path)
    },
  };

  // =========================================================================
  // ORCHESTRATOR STATE
  // =========================================================================

  /**
   * Central state object - single source of truth
   * All modules read from and write to this object
   */
  let _hubState = {
    // Timestamps
    lastComputed: null,
    computeSequence: 0,

    // Source data (inputs)
    inputs: {
      climate: null, // Raw climate API data or manual inputs
      turf: null, // Turf profile (species, variety, etc.)
      soil: null, // MLSN soil data
      water: null, // Water quality data
      tissue: null, // Tissue test data
      schedule: null, // Event/usage schedule
      site: null, // Site characteristics
      pgr: null, // PGR application data (v1.7.0)
    },

    // Computed results (outputs from each engine)
    computed: {
      climate: null, // Climate metrics
      dew: null, // Dew/leaf wetness analysis
      shade: null, // Shade metrics
      salinity: null, // Salinity growth penalty
      stress: null, // Aggregated stress factors
      tissue: null, // Tissue interpretation
      disease: null, // Disease risk analysis
      wear: null, // Wear/recovery analysis
      irrigation: null, // Irrigation schedule
      pgr: null, // PGR status
    },

    // Derived values (cross-module calculations)
    derived: {
      combinedGrowthModifier: 1.0,
      environmentalStressIndex: 0,
      recoveryProbability: null,
      adjustedRecoveryDays: null,
    },
  };

  // =========================================================================
  // GLOBAL STATE ALIASES — single source of truth
  // =========================================================================
  // All modules that read/write GAIP_STATE or __GAIP_STATE__ now share
  // the same object as _hubState. hub-tissue-v3.js may overwrite
  // window.GAIP_STATE; computeAll() syncs any changes back before computing
  // and re-establishes the reference afterwards.
  global.GAIP_STATE = _hubState;
  global.__GAIP_STATE__ = _hubState;

  // =========================================================================
  // GAIP_CANONICAL_STATE - Global Single Source of Truth
  // =========================================================================
  //
  // This is the authoritative state object that ALL engines should read from.
  // Populated once at the start of orchestration, then consumed by all modules.
  //
  // Data Sources (priority order):
  //   Climate:   Climate Engine (Open-Meteo API) → Manual inputs → Defaults
  //   Soil Temp: Sensor (TDR/Pogo) → API → Manual → Physics model (estimated)
  //
  // =========================================================================

  const GAIP_CANONICAL_STATE = {
    version: "1.0.0",
    populatedAt: null,

    // Climate data (from Climate Engine)
    climate: {
      source: null, // 'api', 'manual', 'default'
      temperature: {
        current: null,
        min: null,
        max: null,
        mean: null,
      },
      humidity: {
        current: null,
        mean: null,
      },
      dewpoint: {
        current: null,
        mean: null,
      },
      precipitation: {
        total: null,
        forecast: [],
      },
      et: {
        total: null,
        daily: null,
      },
      wind: {
        mean: null,
        max: null,
      },
      solar: {
        dli: null,
        avgMJ: null,
      },
      growthPotential: {
        weighted: null,
        c3: null,
        c4: null,
      },
    },

    // Soil temperature (priority: sensor > API > manual > physics model)
    soilTemp: {
      source: null, // 'sensor', 'api', 'manual', 'estimated'
      reliability: 0, // 0-100 confidence score
      depths: {
        d20mm: null, // Germination zone
        d40mm: null, // SDS infection trigger zone (CABI Ch.6 p.114-121, b35fix458 / C63)
        d50mm: null, // Seed zone / overseed timing
        d100mm: null, // Primary root zone / disease
        d200mm: null, // Deep pathogens
      },
      mean: null, // Simple mean for backwards compat
      current: null,
      warning: null, // Any data quality warnings
    },

    // Sensor data (if available from TDR/Pogo import)
    sensor: {
      available: false,
      source: null, // 'TDR350', 'POGO', etc.
      importDate: null,
      vwc: null,
      ec: null,
      soilTemp: null,
      zoneCount: 0,
    },

    // Turf context (copied from inputs for convenience)
    turf: {
      species: null,
      variety: null,
      c3Fraction: 0,
      c4Fraction: 0,
      turfType: null,
      profileType: null,
    },

    // Quality metadata
    quality: {
      overall: "unknown", // 'good', 'warning', 'error', 'unknown'
      issues: [],
      dataAge: null, // Hours since last fetch
    },
  };

  // =========================================================================
  // CONFIDENCE WRAPPING HELPER (v1.3.0)
  // =========================================================================

  /**
   * Wrap an engine result with confidence metadata
   * Uses GilbaEngineConfidence.wrapEngineOutput if available
   * @param {string} shortName - Short engine name (e.g., 'shade', 'disease')
   * @param {object} result - Raw engine output
   * @returns {object} Result with _meta.confidence attached (or original if wrapping unavailable)
   */
  function wrapWithConfidence(shortName, result) {
    if (!result) return result;

    // Map short names to full engine IDs
    const engineId = ORCHESTRATOR_CONFIG.engineIdMap[shortName] || shortName + "-engine";

    // Use GilbaEngineConfidence if available
    if (global.GilbaEngineConfidence && typeof global.GilbaEngineConfidence.wrapEngineOutput === "function") {
      try {
        return global.GilbaEngineConfidence.wrapEngineOutput(engineId, result, _hubState);
      } catch (e) {
        warn("confidence", `Failed to wrap ${shortName} with confidence`, e);
        return result;
      }
    }

    // Fallback: attach basic _meta without confidence
    return result;
  }

  /**
   * Populate GAIP_CANONICAL_STATE from all available sources
   * Called once at the start of orchestration
   * v1.5.0: Integrated with GilbaIdentityEnforcement for tiered validation
   */
  function populateCanonicalState(inputs) {
    const startTime = Date.now();
    log("canonical", "Populating GAIP_CANONICAL_STATE...");

    GAIP_CANONICAL_STATE.populatedAt = new Date().toISOString();
    const issues = [];

    // ─────────────────────────────────────────────────────────────────────
    // 0. IDENTITY ENFORCEMENT (v1.5.0)
    // Validate primary identity keys BEFORE any calculations
    // ─────────────────────────────────────────────────────────────────────
    let identityResult = null;
    if (global.GilbaIdentityEnforcement) {
      const allInputs = {
        turf: inputs?.turf || _hubState.inputs.turf || global.GAIP_STATE?.turf,
        site: inputs?.site || _hubState.inputs.site || {},
        location:
          inputs?.location ||
          _hubState.inputs.location ||
          global.GAIP_STATE?.location ||
          (() => {
            // Derive location from climate state (Hub stores coords in climate)
            const climate = inputs?.climate || _hubState.inputs.climate || global.GAIP_STATE?.climate || {};
            // Also check GAIP_CANONICAL_STATE which persists coords between runs
            const canon = global.GAIP_CANONICAL_STATE || {};
            return {
              latitude: climate.lat || climate.latitude || canon.lat || canon.latitude || null,
              longitude: climate.lon || climate.longitude || canon.lon || canon.longitude || null,
            };
          })(),
      };

      // ── Identity enrichment ──────────────────────────────────────────────
      // GSSH pages: GSSH_CONTEXT (written by selectVenue at ~500ms) is the
      // authority for species, coordinates, and construction. Falls back to
      // GilbaStadiumData if GSSH_CONTEXT not yet populated (early computeAll).
      // GAIP pages: TurfProfile + DOM is the authority.

      var _gsshCtx = global.GSSH_CONTEXT;
      // GSSH_CONTEXT.venue_id is written by selectVenue at ~500ms.
      // If not yet populated but URL has gssh_venue param, read stadium data directly.
      var _onGSSHVenuePage = !!(_gsshCtx && _gsshCtx.venue_id);
      if (!_onGSSHVenuePage) {
        try {
          var _urlVenueId = ((global.location && global.location.search.match(/gssh_venue=([^&]+)/)) || [])[1] || null;
          if (
            _urlVenueId &&
            global.GilbaStadiumData &&
            global.GilbaStadiumData.stadiums &&
            global.GilbaStadiumData.stadiums[_urlVenueId]
          ) {
            var _urlVenue = global.GilbaStadiumData.stadiums[_urlVenueId];
            // Build a minimal GSSH_CONTEXT-like object from stadium data
            _gsshCtx = {
              venue_id: _urlVenueId,
              lat: (_urlVenue.location && _urlVenue.location.lat) || _urlVenue.lat,
              lng: (_urlVenue.location && _urlVenue.location.lng) || _urlVenue.lng,
              turf: _urlVenue.turf || {},
            };
            _onGSSHVenuePage = true;
          }
        } catch (e) {}
      }

      if (_onGSSHVenuePage) {
        // ── GSSH path: venue database is the authority ──────────────
        var _venueTurf = _gsshCtx.turf || {};

        // 1. grassSpecies from venue turf base variety — always override on GSSH pages.
        // Do NOT skip if grassSpecies already set: saved state may carry a stale overseed
        // species (e.g. perennialRyegrass from a previous overseed-dominant run) which
        // would bypass enrichment and cause the wrong disease species throughout.
        var _baseVariety = (_venueTurf.variety || "").toLowerCase();
        var _baseSpecies = (_venueTurf.species || "").toLowerCase();
        var _gsshSpecies = null;
        if (
          _baseVariety.indexOf("couch") !== -1 ||
          _baseVariety.indexOf("bermuda") !== -1 ||
          _baseSpecies.indexOf("cynodon") !== -1
        )
          _gsshSpecies = "Couch";
        else if (_baseVariety.indexOf("kikuyu") !== -1 || _baseSpecies.indexOf("pennisetum") !== -1)
          _gsshSpecies = "Kikuyu";
        else if (_baseVariety.indexOf("buffalo") !== -1 || _baseSpecies.indexOf("stenotaphrum") !== -1)
          _gsshSpecies = "Buffalograss";
        else if (_baseVariety.indexOf("zoysia") !== -1 || _baseSpecies.indexOf("zoysia") !== -1)
          _gsshSpecies = "Zoysia";
        else if (_baseVariety.indexOf("bent") !== -1 || _baseSpecies.indexOf("agrostis") !== -1)
          _gsshSpecies = "Creeping Bentgrass";
        else if (_baseVariety.indexOf("rye") !== -1 || _baseSpecies.indexOf("lolium") !== -1)
          _gsshSpecies = "Perennial Ryegrass";

        if (!_gsshSpecies && global.SpeciesController) {
          // Stadium has no turf.species data — read from SpeciesController which
          // VenueProfile restore has already set via tp.selectSpecies() (150ms timeout).
          // getEffectiveSpecies() reads inputs.turf.grassSpecies — the path selectSpecies()
          // writes to. getBaseSpecies() reads inputs.turf.species which selectSpecies()
          // does NOT write, so getEffectiveSpecies is the correct call here.
          try {
            var _scFallback = global.SpeciesController.getEffectiveSpecies
              ? global.SpeciesController.getEffectiveSpecies()
              : (global.SpeciesController.getBaseSpecies ? global.SpeciesController.getBaseSpecies() : null);
            if (_scFallback && _scFallback !== 'unknown') {
              _gsshSpecies = _scFallback;
              log('canonical', '[b35fix263] GSSH species from SpeciesController fallback:', _gsshSpecies);
            }
          } catch(e) {}
        }

        if (_gsshSpecies) {
          allInputs.turf = Object.assign({}, allInputs.turf || {}, { grassSpecies: _gsshSpecies });
        }

        // Always inject turfType for GSSH pages — stadiums are sports surfaces.
        // Required for identity enforcement turfIntentKey and surfaceKey resolution.
        allInputs.turf = Object.assign({}, allInputs.turf || {}, {
          turfType: allInputs.turf && allInputs.turf.turfType ? allInputs.turf.turfType : "sports",
          subCategory: allInputs.turf && allInputs.turf.subCategory ? allInputs.turf.subCategory : null,
        });

        // Also write grassSpecies into _hubState.inputs.turf so buildDiseaseInputs
        // and cascade state snapshot read the correct species. Object.assign used
        // because _hubState.inputs.turf may be null on first computeAll.
        if (_gsshSpecies) {
          _hubState.inputs = _hubState.inputs || {};
          _hubState.inputs.turf = Object.assign({}, _hubState.inputs.turf || {}, { grassSpecies: _gsshSpecies });
        }

        // 2. coordinates from venue location
        if (!allInputs.location || !allInputs.location.latitude) {
          allInputs.location = {
            latitude: _gsshCtx.lat,
            longitude: _gsshCtx.lng,
          };
        }

        // 3. construction from venue config or TurfProfile
        // Venue DB construction takes priority; TurfProfile is fallback only.
        var _venueConstruction = _venueTurf.construction || null;
        if (_venueConstruction) {
          allInputs.turf = Object.assign({}, allInputs.turf, { construction: _venueConstruction });
        } else if (allInputs.turf && !allInputs.turf.construction) {
          var _tpcG = global.GaipTurfProfile;
          if (_tpcG && typeof _tpcG.getState === "function") {
            var _tpcGS = _tpcG.getState();
            if (_tpcGS.construction) {
              allInputs.turf = Object.assign({}, allInputs.turf, { construction: _tpcGS.construction });
            } else {
              // Stadium default — sand carpet if no other source
              allInputs.turf = Object.assign({}, allInputs.turf, { construction: "sand_carpet" });
            }
          } else {
            allInputs.turf = Object.assign({}, allInputs.turf, { construction: "sand_carpet" });
          }
        }
      } else {
        // ── GAIP path: TurfProfile + DOM ──

        // 1. construction
        if (allInputs.turf && !allInputs.turf.construction) {
          var _tpc = global.GaipTurfProfile;
          if (_tpc && typeof _tpc.getState === "function") {
            var _tpcState = _tpc.getState();
            if (_tpcState.construction) {
              allInputs.turf = Object.assign({}, allInputs.turf, {
                construction: _tpcState.construction,
              });
            }
          }
        }
        // TurfProfile.state.construction can be wiped during a subCategory reset.
        // Fallback chain: (a) raw DOM .gaip-construction, (b) SiteConfigPersistence.
        if (allInputs.turf && !allInputs.turf.construction) {
          var _constrEl = document.querySelector(".gaip-construction");
          var _domConstr = _constrEl ? _constrEl.value || "" : "";
          if (_domConstr) {
            allInputs.turf = Object.assign({}, allInputs.turf, { construction: _domConstr });
          } else if (global.GAIP_SiteConfig && typeof global.GAIP_SiteConfig.getConfig === "function") {
            var _SM = global.GAIP_SampleManager;
            var _activeSite = global.GAIP_SiteContext ? global.GAIP_SiteContext.getSiteId() : (_SM && typeof _SM.getActiveSiteId === "function" ? _SM.getActiveSiteId() : null);
            if (_activeSite) {
              var _persConf = global.GAIP_SiteConfig.getConfig(_activeSite);
              var _persConstr = _persConf && _persConf.turf && _persConf.turf.construction;
              if (_persConstr) {
                allInputs.turf = Object.assign({}, allInputs.turf, { construction: _persConstr });
              }
            }
          }
        }

        // 2. coordinates
        if (!allInputs.location.latitude) {
          var _canon = global.GAIP_CANONICAL_STATE || {};
          var _lat = _canon.lat || _canon.latitude;
          var _lon = _canon.lon || _canon.longitude;
          if (!_lat) {
            var _latEl = document.querySelector(".gaip-lat");
            var _lonEl = document.querySelector(".gaip-lon");
            _lat = _latEl ? parseFloat(_latEl.value) || null : null;
            _lon = _lonEl ? parseFloat(_lonEl.value) || null : null;
          }
          if (_lat) {
            allInputs.location = Object.assign({}, allInputs.location, {
              latitude: _lat,
              longitude: _lon,
            });
          }
        }
      }
      // ── end enrichment ─────────────────────────────────────────────

      // DB species fallback: inject species into allInputs.turf BEFORE validateIdentity
      // so TIER 0 can pass even when TurfProfile restore cascade hasn't finished yet.
      // DB (gaipConfig) is the authoritative source → fallback GAIP_STATE.
      if (!_onGSSHVenuePage && allInputs.turf && !allInputs.turf.grassSpecies) {
        var _preCfg = global.GAIP_HUB_CONFIG && (global.GAIP_HUB_CONFIG.gaipConfig || global.GAIP_HUB_CONFIG.siteConfig);
        var _preSpecies = (_preCfg && _preCfg.turf && (_preCfg.turf.species || _preCfg.turf.grassSpecies)) || null;
        if (!_preSpecies && global.GAIP_STATE && global.GAIP_STATE.turf) {
          _preSpecies = global.GAIP_STATE.turf.effectiveSpecies || global.GAIP_STATE.turf.grassSpecies || null;
        }
        if (_preSpecies) {
          allInputs.turf = Object.assign({}, allInputs.turf, { grassSpecies: _preSpecies });
          log('canonical', '[db-pre-identity] Injected species from DB before validateIdentity:', _preSpecies);
        }
      }

      identityResult = global.GilbaIdentityEnforcement.validateIdentity(allInputs);

      if (!identityResult.valid) {
        // TIER 0 failure - hard stop
        GAIP_CANONICAL_STATE.identity = identityResult.identityState;
        GAIP_CANONICAL_STATE.issues = [
          {
            severity: "critical",
            field: "identity",
            message: identityResult.error,
            tier: 0,
          },
        ];

        warn("canonical", "TIER 0 identity failure:", identityResult.error);

        // Return early - cannot proceed without species
        return {
          valid: false,
          error: identityResult.error,
          identityState: identityResult.identityState,
        };
      }

      // Store identity state in canonical state
      GAIP_CANONICAL_STATE.identity = identityResult.identityState;

      // Log assumptions if any
      if (identityResult.identityState.assumptions.length > 0) {
        log(
          "canonical",
          "Identity assumptions:",
          identityResult.identityState.assumptions.map((a) => `${a.displayName}: "${a.assumedValue}" (${a.impact})`),
        );
      }
    }

    // ─────────────────────────────────────────────────────────────────────
    // 1. TURF CONTEXT (with enforced speciesKey - v1.4.0)
    // ─────────────────────────────────────────────────────────────────────
    const turf = inputs?.turf || _hubState.inputs.turf || global.GAIP_STATE?.turf;

    // Extract raw species from various possible locations
    let rawSpecies = null;
    let rawEffectiveSpecies = null;

    if (turf) {
      // Priority order for base species
      rawSpecies =
        turf.grassSpecies || // Hub standard
        (typeof turf.species === "string" ? turf.species : null) ||
        turf.species?.grassSpecies ||
        turf.species?.name ||
        turf.species?.value;

      // Effective species (for overseed scenarios)
      rawEffectiveSpecies = turf.effectiveSpecies || turf.species?.effectiveSpecies;
    }

    // DB config is the authoritative user-configured species — check it BEFORE
    // SpeciesController which returns 'perennialRyegrass' as a default when nothing
    // is set in the UI. Checking DB first means a stale SpeciesController default
    // cannot shadow the correct DB species.
    if (!rawSpecies) {
      var _dbCfg = global.GAIP_HUB_CONFIG && (global.GAIP_HUB_CONFIG.gaipConfig || global.GAIP_HUB_CONFIG.siteConfig);
      if (_dbCfg && _dbCfg.turf) {
        rawSpecies = _dbCfg.turf.species || _dbCfg.turf.grassSpecies || null;
        if (!rawEffectiveSpecies) rawEffectiveSpecies = rawSpecies;
      }
    }

    // SpeciesController fallback (may have been set by UI interactions)
    if (!rawSpecies && global.SpeciesController) {
      rawSpecies = global.SpeciesController.getBaseSpecies();
      rawEffectiveSpecies = global.SpeciesController.getEffectiveSpecies();
    }

    // Canonicalise using SpeciesController (single normalisation point)
    let speciesKey = null;
    let effectiveSpeciesKey = null;

    if (global.SpeciesController && typeof global.SpeciesController.normalize === "function") {
      speciesKey = rawSpecies ? global.SpeciesController.normalize(rawSpecies) : null;
      effectiveSpeciesKey = rawEffectiveSpecies ? global.SpeciesController.normalize(rawEffectiveSpecies) : speciesKey;
    } else {
      // Fallback normalisation if SpeciesController not loaded
      speciesKey = rawSpecies ? normalizeSpeciesKey(rawSpecies) : null;
      effectiveSpeciesKey = rawEffectiveSpecies ? normalizeSpeciesKey(rawEffectiveSpecies) : speciesKey;
    }

    // If speciesKey defaulted to perennialRyegrass before TurfProfile populated,
    // cross-check GAIP_STATE.turf (written synchronously by hub-tissue before
    // gaip:analysis-complete) to prevent disease results carrying a stale default species.
    const _DEFAULT_SPECIES_KEY = "perennialRyegrass";
    if (speciesKey === _DEFAULT_SPECIES_KEY && global.GAIP_STATE && global.GAIP_STATE.turf) {
      const _stateSpecies =
        global.GAIP_STATE.turf.effectiveSpecies ||
        global.GAIP_STATE.turf.grassSpecies ||
        global.GAIP_STATE.turf.warmBase;
      if (_stateSpecies) {
        const _stateKey = global.SpeciesController
          ? global.SpeciesController.normalize(_stateSpecies)
          : normalizeSpeciesKey(_stateSpecies);
        if (_stateKey && _stateKey !== _DEFAULT_SPECIES_KEY) {
          log(
            "disease",
            `speciesKey overridden from default perennialRyegrass to GAIP_STATE species: "${_stateKey}"`,
          );
          speciesKey = _stateKey;
          effectiveSpeciesKey = _stateKey;
        }
      }
    }
    // Last resort: if still on the default, use the server-injected DB config.
    // SpeciesController.getBaseSpecies() returns 'perennialRyegrass' when nothing
    // is set, so this catches fresh-import page loads where GAIP_STATE is empty
    // and TurfProfile has not yet cascaded species into the DOM.
    if ((speciesKey === _DEFAULT_SPECIES_KEY || !speciesKey) && global.GAIP_HUB_CONFIG && global.GAIP_HUB_CONFIG.siteConfig) {
      const _injCfg = global.GAIP_HUB_CONFIG.siteConfig;
      const _injSpecies = (_injCfg.turf && (_injCfg.turf.species || _injCfg.turf.grassSpecies)) || null;
      if (_injSpecies) {
        const _injKey = global.SpeciesController
          ? global.SpeciesController.normalize(_injSpecies)
          : normalizeSpeciesKey(_injSpecies);
        if (_injKey && _injKey !== _DEFAULT_SPECIES_KEY) {
          log("canonical", `speciesKey resolved from GAIP_HUB_CONFIG.siteConfig: "${_injKey}"`);
          speciesKey = _injKey;
          effectiveSpeciesKey = _injKey;
          rawSpecies = _injSpecies;
        }
      }
    }

    // ─────────────────────────────────────────────────────────────────────
    // b35fix501 — site-switch race guard
    //
    // When the user switches sites, hub-tissue auto-runs and passes a
    // snapshot of inputs.turf that was captured BEFORE GAIP_STATE is
    // updated with the new site's turf data.  That snapshot carries the
    // previous site's grassSpecies / effectiveSpecies, making speciesKey
    // stale (e.g. "bentgrass" for Russley which is browntopBent).
    //
    // SpeciesController.getBaseSpecies() is synchronously updated by
    // TurfProfileController when it processes the new site's config —
    // always before hub-tissue triggers the auto-run.  If SC reports a
    // confident, non-default base species that disagrees with speciesKey,
    // SC wins: it holds the current-site truth that inputs.turf lacks.
    //
    // Guard conditions (all must hold):
    //   1. SC is available and returns a non-null value
    //   2. SC base ≠ _DEFAULT_SPECIES_KEY (prevents SC placeholder from
    //      shadowing a correctly-resolved species when no site is loaded)
    //   3. SC base ≠ speciesKey (only fires on actual disagreement)
    // ─────────────────────────────────────────────────────────────────────
    if (global.SpeciesController && typeof global.SpeciesController.getBaseSpecies === "function") {
      try {
        var _scBase501 = global.SpeciesController.getBaseSpecies();
        var _scBaseKey501 = _scBase501
          ? (typeof global.SpeciesController.normalize === "function"
              ? global.SpeciesController.normalize(_scBase501)
              : normalizeSpeciesKey(_scBase501))
          : null;
        if (
          _scBaseKey501 &&
          _scBaseKey501 !== _DEFAULT_SPECIES_KEY &&
          _scBaseKey501 !== speciesKey
        ) {
          log(
            "canonical",
            "b35fix501 site-switch race guard: speciesKey corrected from stale \"" +
              speciesKey + "\" to SC.getBaseSpecies() \"" + _scBaseKey501 + "\"",
          );
          speciesKey = _scBaseKey501;
          effectiveSpeciesKey = _scBaseKey501;
          // Also write the corrected species back to GAIP_STATE so downstream
          // modules that read it directly (DiseaseForecast, hub-persistence)
          // see the correct value. Without this, the stale grassSpecies is
          // saved to the analysis cache and the /analysis page loads with the
          // wrong species for disease forecast calculations.
          try {
            if (global.GAIP_STATE) {
              if (global.GAIP_STATE.turf) {
                global.GAIP_STATE.turf.grassSpecies = _scBaseKey501;
                global.GAIP_STATE.turf.effectiveSpecies = _scBaseKey501;
              }
              if (global.GAIP_STATE.inputs && global.GAIP_STATE.inputs.turf) {
                global.GAIP_STATE.inputs.turf.grassSpecies = _scBaseKey501;
                global.GAIP_STATE.inputs.turf.effectiveSpecies = _scBaseKey501;
              }
            }
          } catch (_gsErr501) { /* GAIP_STATE write failed — non-fatal */ }
        }
      } catch (_scErr501) {
        // SC not ready or threw — leave speciesKey as already resolved
      }
    }

    // ─────────────────────────────────────────────────────────────────────
    // b35fix365 — DIAGNOSTIC ONLY (no behaviour change)
    //
    // Surfaces every species source consulted by populateCanonicalState at
    // the moment of resolution. Production logs from b35fix363 and b35fix364
    // (gilbasolutions_com-1777266418415, -1777267335690) showed:
    //   1. TurfProfileController dispatched species: 'Seashore Paspalum'
    //      correctly (state-dispatched line in log)
    //   2. populateCanonicalState fired TIER 0 species-required failure
    //      shortly after
    //   3. Disease engine ran anyway with stale species (couch from prev
    //      Rockingham save; bentgrass earlier) and wrote that to GAIP_DISEASE_RESULT
    //
    // Three competing source paths feed speciesKey:
    //   (a) inputs?.turf passed to populateCanonicalState
    //   (b) _hubState.inputs.turf (the orchestrator's mirror)
    //   (c) global.GAIP_STATE?.turf (hub-tissue's synchronous write)
    //   (d) global.SpeciesController.getBaseSpecies/getEffectiveSpecies
    //   (e) global.GAIP_STATE.turf.warmBase / effectiveSpecies / grassSpecies
    //       (the cross-check at line 625 above)
    //
    // The diagnostic dumps all five so a single production log localises
    // which source the function read, which one was stale, and which one
    // had the user's actual selection. If (a-d) all agree → the bug is
    // downstream of canonical state. If they disagree → write race within
    // the orchestrator's own state mirror.
    //
    // Tag chosen to be greppable: "[b35fix365 species-resolution]".
    // Removed in b35fix366 once the writer race is localised and closed.
    // ─────────────────────────────────────────────────────────────────────
    try {
      const _diag = {
        // Source path inputs
        rawSpecies: rawSpecies || null,
        rawEffectiveSpecies: rawEffectiveSpecies || null,
        // Resolved keys (the values that will populate canonical state)
        speciesKey: speciesKey || null,
        effectiveSpeciesKey: effectiveSpeciesKey || null,
        // Each source state object — keep to top-level species fields only
        sources: {
          inputsArg_turf_species: (inputs?.turf?.species != null)
            ? (typeof inputs.turf.species === "string" ? inputs.turf.species : "<object>")
            : null,
          inputsArg_turf_grassSpecies: inputs?.turf?.grassSpecies || null,
          hubStateInputs_turf_species: (_hubState.inputs.turf?.species != null)
            ? (typeof _hubState.inputs.turf.species === "string" ? _hubState.inputs.turf.species : "<object>")
            : null,
          hubStateInputs_turf_grassSpecies: _hubState.inputs.turf?.grassSpecies || null,
          GAIP_STATE_turf_species: (global.GAIP_STATE?.turf?.species != null)
            ? (typeof global.GAIP_STATE.turf.species === "string" ? global.GAIP_STATE.turf.species : "<object>")
            : null,
          GAIP_STATE_turf_grassSpecies: global.GAIP_STATE?.turf?.grassSpecies || null,
          GAIP_STATE_turf_effectiveSpecies: global.GAIP_STATE?.turf?.effectiveSpecies || null,
          GAIP_STATE_turf_warmBase: global.GAIP_STATE?.turf?.warmBase || null,
          SC_getBaseSpecies: (global.SpeciesController && typeof global.SpeciesController.getBaseSpecies === "function")
            ? (function() { try { return global.SpeciesController.getBaseSpecies(); } catch(e) { return "<error:" + e.message + ">"; } })()
            : null,
          SC_getEffectiveSpecies: (global.SpeciesController && typeof global.SpeciesController.getEffectiveSpecies === "function")
            ? (function() { try { return global.SpeciesController.getEffectiveSpecies(); } catch(e) { return "<error:" + e.message + ">"; } })()
            : null,
        },
        // Build context so we can correlate against the dispatch sequence
        timestamp: Date.now(),
      };
      // Single-line console dump — tagged for grep
      try {
        console.log("[b35fix365 species-resolution]", JSON.stringify(_diag));
      } catch(e) { /* swallow stringify errors for cyclic objects */ }
    } catch(e) {
      // Diagnostic must never block the canonical state path
      try { console.warn("[b35fix365 species-resolution] diagnostic error:", e); } catch(_) {}
    }

    // Validate species - HARD STOP if missing (v1.4.0)
    if (!speciesKey) {
      const error = new Error(
        "[Orchestrator] Species is required but could not be determined. Please select a grass species.",
      );
      error.code = "SPECIES_REQUIRED";
      error.details = { rawSpecies, turf: turf ? Object.keys(turf) : null };
      warn("canonical", "Species validation failed:", error.details);
      issues.push({
        severity: "critical",
        field: "species",
        message: "Species is required for analysis",
      });
      // Store the issue but don't throw - let caller decide
      GAIP_CANONICAL_STATE.issues = issues;
    }

    // Determine C3/C4 fractions
    let c3Fraction = 0;
    let c4Fraction = 0;

    if (turf?.c3Fraction !== undefined) {
      c3Fraction = parseFloat(turf.c3Fraction) || 0;
      c4Fraction = 1 - c3Fraction;
    } else if (turf?.species?.c3Fraction !== undefined) {
      c3Fraction = parseFloat(turf.species.c3Fraction) || 0;
      c4Fraction = 1 - c3Fraction;
    } else if (speciesKey && global.SpeciesController) {
      // Derive from species type
      const isC4 = global.SpeciesController.isC4Species(speciesKey);
      c3Fraction = isC4 ? 0 : 1;
      c4Fraction = isC4 ? 1 : 0;
    }

    // Populate canonical turf state
    GAIP_CANONICAL_STATE.turf = {
      // PRIMARY: Normalised keys for engine consumption (v1.4.0)
      speciesKey: speciesKey, // Base species (normalised)
      effectiveSpeciesKey: effectiveSpeciesKey, // Effective species for calculations

      // SECONDARY: Raw values for display/debugging only
      speciesRaw: rawSpecies,
      effectiveSpeciesRaw: rawEffectiveSpecies,

      // Species classification
      c3Fraction: c3Fraction,
      c4Fraction: c4Fraction,
      isC4: c4Fraction > 0.5,
      isOverseed: effectiveSpeciesKey !== speciesKey && effectiveSpeciesKey !== null,

      // Other turf context
      variety: turf?.variety || null,
      turfType: turf?.turfType || "sports",
      construction: turf?.construction || null,
      profileType: turf?.profileType || turf?.profile?.type || turf?.construction || "usga",
    };

    log("canonical", "Species canonicalised:", {
      speciesKey: GAIP_CANONICAL_STATE.turf.speciesKey,
      effectiveSpeciesKey: GAIP_CANONICAL_STATE.turf.effectiveSpeciesKey,
      isC4: GAIP_CANONICAL_STATE.turf.isC4,
      isOverseed: GAIP_CANONICAL_STATE.turf.isOverseed,
    });

    // ─────────────────────────────────────────────────────────────────────
    // 2. CLIMATE DATA (from Climate Engine)
    // ─────────────────────────────────────────────────────────────────────
    let climateSource = "default";
    let climateMetrics = null;

    // Priority 1: window.climateMetrics (populated by Climate Engine)
    if (global.climateMetrics && global.climateMetrics.temperature) {
      climateMetrics = global.climateMetrics;
      climateSource = climateMetrics.quality?.source || "api";
      log("canonical", "Using climateMetrics from Climate Engine");
    }
    // Priority 2: Manual inputs
    else if (inputs?.climate?.manual || _hubState.inputs.climate?.manual) {
      const manual = inputs?.climate?.manual || _hubState.inputs.climate.manual;
      climateMetrics = buildClimateFromManual(manual);
      climateSource = "manual";
      log("canonical", "Using manual climate inputs");
    }
    // Priority 3: Defaults
    else {
      climateSource = "default";
      issues.push({ type: "climate", severity: "warning", message: "No climate data - using defaults" });
      log("canonical", "No climate data available, using defaults");
    }

    // Always recompute temperature from rawWeatherData for non-manual modes.
    // hub-tissue-v3 and climate-engine-v2 both write to global.climateMetrics but
    // use different windows and field sets: hub-tissue writes mean-of-daily-means
    // without `current`; climate-engine-v2 writes mean of all hourly + currentHour
    // for `current`. Whichever writer runs last determines the canonical temperature,
    // causing non-deterministic Fusarium risk (86% vs 100%) on consecutive runs of
    // the same site with identical rawWeatherData. Reading rawWeatherData directly
    // here bypasses the race — same data always produces same output.
    if (climateSource !== "manual") {
      var _rawHourly = (global.rawWeatherData && global.rawWeatherData.forecast && global.rawWeatherData.forecast.hourly)
        || (global.rawWeatherData && global.rawWeatherData.hourly)
        || null;
      if (_rawHourly && _rawHourly.temperature_2m && _rawHourly.temperature_2m.length >= 24) {
        var _allTemps = _rawHourly.temperature_2m.filter(function(v) { return v != null; });
        if (_allTemps.length >= 24) {
          var _sum = 0;
          for (var _i = 0; _i < _allTemps.length; _i++) _sum += _allTemps[_i];
          var _recoveredMean = parseFloat((_sum / _allTemps.length).toFixed(1));
          var _recoveredMax = parseFloat(Math.max.apply(null, _allTemps).toFixed(1));
          var _recoveredMin = parseFloat(Math.min.apply(null, _allTemps).toFixed(1));
          var _currentHour = Math.min(new Date().getHours(), _rawHourly.temperature_2m.length - 1);
          var _currentTemp = _rawHourly.temperature_2m[_currentHour];
          climateMetrics = climateMetrics ? Object.assign({}, climateMetrics) : {};
          climateMetrics.temperature = {
            mean: _recoveredMean,
            max: _recoveredMax,
            min: _recoveredMin,
            current: (_currentTemp != null ? _currentTemp : _recoveredMean),
          };
          climateSource = "api";
          log("canonical", "Temperature pinned to rawWeatherData (full forecast window): mean=" + _recoveredMean + ", min=" + _recoveredMin + ", max=" + _recoveredMax);

          // Same writer race as temperature above, same fix: humidity written
          // to global.climateMetrics.moisture.humidity by hub-tissue-v3.js /
          // climate-engine-v2.js is subject to the identical "whichever
          // writer ran last" non-determinism. This was the actual cause of
          // Red Thread's "keeping previous reading" fallback (and Drechslera/
          // Fusarium's smaller score swings) firing intermittently between
          // otherwise-identical reruns — not humidity genuinely not having
          // arrived yet. Recompute directly from the same immutable
          // rawWeatherData hourly array used for temperature above.
          var _rawHumidity = _rawHourly.relative_humidity_2m;
          if (Array.isArray(_rawHumidity) && _rawHumidity.length >= 24) {
            var _allHumidity = _rawHumidity.filter(function(v) { return v != null; });
            if (_allHumidity.length >= 24) {
              var _hSum = 0;
              for (var _hi = 0; _hi < _allHumidity.length; _hi++) _hSum += _allHumidity[_hi];
              var _recoveredHumidityMean = parseFloat((_hSum / _allHumidity.length).toFixed(1));
              var _currentHumidity = _rawHumidity[_currentHour];
              climateMetrics.moisture = Object.assign({}, climateMetrics.moisture || {}, {
                humidity: {
                  mean: _recoveredHumidityMean,
                  current: (_currentHumidity != null ? _currentHumidity : _recoveredHumidityMean),
                },
              });
              log("canonical", "Humidity pinned to rawWeatherData (full forecast window): mean=" + _recoveredHumidityMean);
            }
          }

          // hub-persistence.js reads global.climateMetrics.temperature when building
          // cache.computed.climate — write back so it sees the canonical value.
          global.climateMetrics = climateMetrics;
        }
      }
    }

    // Populate climate state
    if (climateMetrics) {
      GAIP_CANONICAL_STATE.climate = {
        source: climateSource,
        temperature: {
          current: climateMetrics.temperature?.current ?? null,
          min: climateMetrics.temperature?.min ?? null,
          max: climateMetrics.temperature?.max ?? null,
          mean: climateMetrics.temperature?.mean ?? null,
        },
        humidity: {
          current: climateMetrics.moisture?.humidity?.current ?? climateMetrics.humidity?.current ?? null,
          mean: climateMetrics.moisture?.humidity?.mean ?? climateMetrics.humidity?.mean ?? null,
        },
        dewpoint: {
          current: climateMetrics.moisture?.dewpoint?.current ?? climateMetrics.dewpoint?.current ?? null,
          mean: climateMetrics.moisture?.dewpoint?.mean ?? climateMetrics.dewpoint?.mean ?? null,
        },
        precipitation: {
          // Manual mode stores rainfall at moisture.rainfall (hub-tissue shape).
          // API/live mode stores it at precipitation.total. Check both.
          total: climateMetrics.precipitation?.total ?? climateMetrics.moisture?.rainfall ?? null,
          forecast: climateMetrics.forecast?.precip?.days ?? [],
        },
        et: {
          total: climateMetrics.et?.total ?? null,
          daily: climateMetrics.et?.daily ?? null,
        },
        wind: {
          mean: climateMetrics.wind?.mean ?? null,
          max: climateMetrics.wind?.max ?? null,
        },
        solar: {
          dli: climateMetrics.solar?.dli ?? null,
          avgMJ: climateMetrics.solar?.avgMJ ?? null,
        },
        growthPotential: {
          weighted: climateMetrics.growth?.weighted ?? null,
          c3: climateMetrics.growth?.c3 ?? null,
          c4: climateMetrics.growth?.c4 ?? null,
          // b35fix: c3Fraction/c4Fraction were dropped here, so any consumer
          // reading the cached/canonical growthPotential (e.g. dashboard-init.js
          // buildGrowthPanel) had no species-type signal and defaulted every
          // site to C3/cool-season - showing pure-C4 species (Buffalograss,
          // Couch, Kikuyu...) with the wrong label and the wrong (c3) value.
          c3Fraction: climateMetrics.growth?.c3Fraction ?? null,
          c4Fraction: climateMetrics.growth?.c4Fraction ?? null,
        },
      };
    } else {
      // Apply defaults
      const defaultTemp = 20;
      GAIP_CANONICAL_STATE.climate.source = "default";
      GAIP_CANONICAL_STATE.climate.temperature = { current: defaultTemp, min: 15, max: 25, mean: defaultTemp };
      // b35fix345: humidity null on the no-climate-data path, not literal 60.
      // Pre-fix `humidity = { current: 60, mean: 60 }` planted 60 into canonical
      // state; getAuthoritativeClimate's moisture wrapper picked it up and
      // dispatched it to disease engines as if real data. Disease engines
      // already have degraded paths for null humidity (b35fix344) — give them
      // null so they exercise those paths instead of computing on fabrication.
      GAIP_CANONICAL_STATE.climate.humidity = { current: null, mean: null, dataSource: 'no-data' };
      GAIP_CANONICAL_STATE.climate.growthPotential = { weighted: 70, c3: 80, c4: 60 };
    }

    // ─────────────────────────────────────────────────────────────────────
    // 3. SOIL TEMPERATURE (priority: sensor > API > manual > physics)
    // ─────────────────────────────────────────────────────────────────────
    let soilTempSource = "estimated";
    let soilTempValue = null;
    let soilTempReliability = 60;
    let soilTempDepths = null;
    let soilTempWarning = null;

    // Priority 1: Sensor data (TDR/Pogo via GAIP_Sensor bridge)
    if (global.GAIP_Sensor && global.GAIP_Sensor.hasData()) {
      const sensorData = global.GAIP_Sensor.getIrrigationData();
      if (sensorData && sensorData.soilTemp !== null) {
        soilTempValue = sensorData.soilTemp;
        soilTempSource = "sensor";
        soilTempReliability = 95;
        log("canonical", `Soil temp from sensor (${sensorData.source}): ${soilTempValue}°C`);

        // Populate sensor state
        GAIP_CANONICAL_STATE.sensor = {
          available: true,
          source: sensorData.source || sensorData.deviceName,
          importDate: sensorData.importDate,
          vwc: sensorData.vwc,
          ec: sensorData.ec,
          soilTemp: sensorData.soilTemp,
          zoneCount: sensorData.zoneCount || 0,
        };
      }
    }

    // Priority 1b: Hydrosight direct (bridge site-mapping check may block even when data exists)
    if (soilTempSource !== "sensor" && global.GAIP_Hydrosight
        && typeof global.GAIP_Hydrosight.hasData === "function" && global.GAIP_Hydrosight.hasData()) {
      try {
        const hsData = global.GAIP_Hydrosight.getIrrigationData();
        if (hsData && hsData.soilTemp != null) {
          soilTempValue = hsData.soilTemp;
          soilTempSource = "sensor";
          soilTempReliability = 95;
          log("canonical", `Soil temp from Hydrosight direct: ${soilTempValue}°C`);
          GAIP_CANONICAL_STATE.sensor = {
            available: true, source: "Hydrosight",
            vwc: hsData.vwc, ec: hsData.ec, soilTemp: hsData.soilTemp,
            zoneCount: hsData.zoneCount || 0,
          };
        }
      } catch (e) { /* ignore */ }
    }

    // Priority 2: API soil temp (from climateMetrics)
    if (soilTempSource !== "sensor" && climateMetrics?.temperature?.soil?.source === "api") {
      soilTempValue = climateMetrics.temperature.soil.mean;
      soilTempSource = "api";
      soilTempReliability = 85;
      log("canonical", `Soil temp from API: ${soilTempValue}°C`);
    }

    // Priority 3: Manual soil temp
    if (soilTempSource !== "sensor" && soilTempSource !== "api") {
      const manualSoilTemp =
        inputs?.climate?.manual?.temperature?.soil || _hubState.inputs.climate?.manual?.temperature?.soil;
      if (manualSoilTemp !== null && manualSoilTemp !== undefined) {
        soilTempValue = manualSoilTemp;
        soilTempSource = "manual";
        soilTempReliability = 80;
        log("canonical", `Soil temp from manual input: ${soilTempValue}°C`);
      }
    }

    // Priority 4: Physics model (estimated)
    if (soilTempSource === "estimated" || soilTempValue === null) {
      // Try enhanced physics model if available
      // Hourly data may be at climateMetrics.hourlyData, climateMetrics.hourly, or rawWeatherData.hourly
      const hourlyForPhysics = climateMetrics?.hourlyData?.temperature_2m
        ? climateMetrics.hourlyData
        : climateMetrics?.hourly?.temperature_2m
          ? climateMetrics.hourly
          : global.rawWeatherData?.hourly?.temperature_2m
            ? global.rawWeatherData.hourly
            : null;
      if (global.gaip_enhanced_soil_temp && hourlyForPhysics) {
        try {
          const profileType = GAIP_CANONICAL_STATE.turf.construction || GAIP_CANONICAL_STATE.turf.profileType || "usga";
          const soilMoisture = climateMetrics?.moisture?.soilMoisture?.mean || 0.25;

          const rawPhysics = global.gaip_enhanced_soil_temp(
            hourlyForPhysics.temperature_2m,
            hourlyForPhysics.shortwave_radiation || null,
            soilMoisture,
            { profileType: profileType },
          );
          // gaip_enhanced_soil_temp returns raw T_NNmm series; convert to
          // depth-summary shape via gaip_soil_temp_summary so the .depths
          // check below resolves correctly.
          const physicsResult = (global.gaip_soil_temp_summary && rawPhysics)
            ? global.gaip_soil_temp_summary(rawPhysics)
            : rawPhysics;

          if (physicsResult && physicsResult.depths) {
            soilTempDepths = {
              d20mm: physicsResult.depths["20mm"]?.mean ?? null,
              // b35fix458 (C63): d40mm canonical depth for SDS infection trigger
              //   per CABI 2024 audit recommendation #2. Physics model evaluates
              //   the analytical heat-equation solution at the 40mm depth band.
              d40mm: physicsResult.depths["40mm"]?.mean ?? null,
              d50mm: physicsResult.depths["50mm"]?.mean ?? null,
              d100mm: physicsResult.depths["100mm"]?.mean ?? null,
              d200mm: physicsResult.depths["200mm"]?.mean ?? null,
            };
            // Use 50mm as the default "mean" (seed zone)
            soilTempValue = soilTempDepths.d50mm || soilTempDepths.d100mm;
            soilTempSource = "physics_model";
            soilTempReliability = 75;
            log("canonical", "Soil temp from physics model", soilTempDepths);
          }
        } catch (e) {
          warn("canonical", "Physics soil temp calculation failed", e);
        }
      }

      // Fallback: Simple estimate from air temp
      if (soilTempValue === null) {
        const airTemp = GAIP_CANONICAL_STATE.climate.temperature.mean || 20;
        soilTempValue = airTemp - 1; // Simple lag approximation
        soilTempSource = "estimated";
        soilTempReliability = 50;
        soilTempWarning =
          "Soil temperature estimated from air temperature. Consider using TDR/sensor data for critical decisions.";
        log("canonical", `Soil temp estimated from air temp: ${soilTempValue}°C`);
      }
    }

    // Populate soil temp state.
    //
    // b35fix458b (C63b): fallback-default depths shape must include d40mm
    //   alongside the existing d20mm / d50mm / d100mm / d200mm keys. Closes
    //   the C63 producer-side gap surfaced during b35fix458 live verification
    //   on 2026-05-11: physics-model branch at line 940-951 was edited
    //   correctly but the fallback default below was missed. Since the
    //   physics branch is dead in current production (gaip_enhanced_soil_temp
    //   returns raw T_NNmm series rather than the .depths wrapped shape),
    //   the fallback is the live writer and must carry d40mm for SDS
    //   Priority 2 cascade to resolve. Per banked lesson #52 (canonical-state
    //   writers may emit shape literals at multiple sites within one file;
    //   schema extensions must be lockstep across all writers).
    GAIP_CANONICAL_STATE.soilTemp = {
      source: soilTempSource,
      reliability: soilTempReliability,
      depths: soilTempDepths || {
        d20mm: soilTempValue,
        d40mm: soilTempValue,
        d50mm: soilTempValue,
        d100mm: soilTempValue,
        d200mm: soilTempValue,
      },
      mean: soilTempValue,
      current: soilTempValue,
      warning: soilTempWarning,
    };

    // Add soil temp quality issue if not from sensor
    if (soilTempSource === "estimated") {
      issues.push({
        type: "soil_temp",
        severity: "info",
        message: "Soil temperature estimated - sensor data recommended for pest timing",
      });
    }

    // ─────────────────────────────────────────────────────────────────────
    // 4. QUALITY ASSESSMENT
    // ─────────────────────────────────────────────────────────────────────
    let overallQuality = "good";
    if (issues.some((i) => i.severity === "error")) {
      overallQuality = "error";
    } else if (issues.some((i) => i.severity === "warning")) {
      overallQuality = "warning";
    }

    // Check data age
    let dataAge = null;
    if (climateMetrics?.fetchedAt) {
      dataAge = (Date.now() - new Date(climateMetrics.fetchedAt).getTime()) / (1000 * 60 * 60);
      if (dataAge > 24) {
        issues.push({
          type: "stale",
          severity: "warning",
          message: `Climate data is ${Math.round(dataAge)} hours old`,
        });
        overallQuality = "warning";
      }
    }

    GAIP_CANONICAL_STATE.quality = {
      overall: overallQuality,
      issues: issues,
      dataAge: dataAge ? Math.round(dataAge * 10) / 10 : null,
    };

    // ─────────────────────────────────────────────────────────────────────
    // 5. EXPORT GLOBALLY
    // ─────────────────────────────────────────────────────────────────────
    // Preserve tissue data from hub-tissue-v3 GAIP_STATE before orchestrator overwrites it
    // synthesis-interpretation.js reads canonicalState.tissue for cross-module analysis
    const _hubTissueState = global.GAIP_STATE?.tissue || null;
    if (_hubTissueState) {
      GAIP_CANONICAL_STATE.tissue = _hubTissueState;
    }

    global.GAIP_CANONICAL_STATE = GAIP_CANONICAL_STATE;

    const elapsed = Date.now() - startTime;
    log("canonical", `GAIP_CANONICAL_STATE populated in ${elapsed}ms`, {
      climateSource: GAIP_CANONICAL_STATE.climate.source,
      soilTempSource: GAIP_CANONICAL_STATE.soilTemp.source,
      soilTempReliability: GAIP_CANONICAL_STATE.soilTemp.reliability,
      quality: GAIP_CANONICAL_STATE.quality.overall,
    });

    return GAIP_CANONICAL_STATE;
  }

  // =========================================================================
  // LOGGING
  // =========================================================================

  function log(module, message, data) {
    if (!ORCHESTRATOR_CONFIG.debug) return;
    const prefix = `[Orchestrator:${module}]`;
    if (data !== undefined) {
      console.log(prefix, message, data);
    } else {
      console.log(prefix, message);
    }
  }

  function warn(module, message, data) {
    const prefix = `[Orchestrator:${module}]`;
    if (data !== undefined) {
      console.warn(prefix, message, data);
    } else {
      console.warn(prefix, message);
    }
  }

  // =========================================================================
  // UTILITY FUNCTIONS
  // =========================================================================

  var clamp = GAIP_Utils.clamp;

  function safeNum(val, fallback) {
    const n = parseFloat(val);
    return isNaN(n) ? fallback : n;
  }

  /**
   * Safely extract species as a string from various input formats
   * Handles: string, {grassSpecies: string}, {species: string}, {value: string}, null, undefined
   * Also handles nested: {species: {grassSpecies: string}} from GAIP_CANONICAL_STATE
   * Hub stores species in turf.grassSpecies, not turf.species
   *
   * @deprecated v1.4.0 - Use getCanonicalSpecies() instead for engine consumption
   */
  function safeSpecies(input, fallback = "perennialRyegrass") {
    if (!input) return fallback;
    if (typeof input === "string") return input;
    if (typeof input === "object") {
      // Try direct property names - grassSpecies first (hub format)
      if (typeof input.grassSpecies === "string") return input.grassSpecies;
      if (typeof input.value === "string") return input.value;
      if (typeof input.name === "string") return input.name;
      if (typeof input.id === "string") return input.id;

      // Handle species as direct string
      if (typeof input.species === "string") return input.species;

      // Handle nested species object: turf.species.grassSpecies (GAIP_CANONICAL_STATE format)
      if (input.species && typeof input.species === "object") {
        const nested = input.species.grassSpecies || input.species.value || input.species.name || input.species.id;
        if (typeof nested === "string") return nested;
      }
    }
    return fallback;
  }

  /**
   * Get species from canonical state (v1.4.0)
   * This is the ONLY way engines should get species - ensures SSOT compliance
   *
   * @param {string} type - 'base' for base species, 'effective' for overseed-aware (default)
   * @returns {string|null} Normalised species key or null if not available
   */
  function getCanonicalSpecies(type = "effective") {
    const turf = GAIP_CANONICAL_STATE.turf;
    if (!turf) {
      warn("canonical", "getCanonicalSpecies called before canonical state populated");
      return null;
    }

    if (type === "base") {
      return turf.speciesKey || null;
    }

    // Default: effective species (accounts for overseed)
    return turf.effectiveSpeciesKey || turf.speciesKey || null;
  }

  /**
   * Check if canonical state has a valid species
   * Use this to gate operations that require species
   *
   * @returns {boolean}
   */
  function hasValidSpecies() {
    return !!GAIP_CANONICAL_STATE.turf?.speciesKey;
  }

  /**
   * Resolve effective species for disease analysis
   * Handles overseed scenarios: uses base species when transitioning out,
   * overseed species when dominant or retained
   *
   * @deprecated v1.4.0 - Disease inputs now use canonical state directly
   */
  function resolveSpeciesForDisease(turf) {
    // Use DiseaseIntegration if available (has full overseed logic)
    if (
      global.GAIP_DiseaseIntegration &&
      typeof global.GAIP_DiseaseIntegration.resolveEffectiveSpecies === "function"
    ) {
      const state = {
        turf: turf,
        climate: _hubState.inputs.climate || {},
        location: _hubState.inputs.location || {},
      };
      const resolved = global.GAIP_DiseaseIntegration.resolveEffectiveSpecies(state);
      log("disease", `Species resolved via DiseaseIntegration: "${resolved}"`);
      return resolved;
    }

    // Fallback: inline simplified resolution
    const grassSpecies = safeSpecies(turf, null);
    const coolOverseed = turf?.coolOverseed;
    const summerIntent = turf?.overseedSummerIntent || "transition";
    const c3Cover = turf?.percentC3Cover || 0;

    // Normalize species
    const normalizeSpecies = (sp) => {
      if (!sp || typeof sp !== "string") return null;
      const s = sp.toLowerCase().replace(/[^a-z0-9]/g, "");
      if (s.includes("couch") || s.includes("bermuda")) return "couch";
      if (s.includes("kikuyu")) return "kikuyu";
      if (s.includes("zoysia")) return "zoysia";
      if (s.includes("buffalo")) return "buffalo";
      if (s.includes("paspalum")) return "seashore_paspalum";
      if (s.includes("rye")) return "perennialRyegrass";
      if (s.includes("bent")) return "bentgrass";
      if (s.includes("tall") && s.includes("fescue")) return "tallFescue";
      if (s.includes("fescue") || s.includes("chewing")) return "fineFescue";
      if (s.includes("blue")) return "kentuckyBluegrass";
      if (s.includes("poa")) return "poaAnnua";
      return sp;
    };

    const baseSpecies = normalizeSpecies(grassSpecies);
    const overseedSpecies = normalizeSpecies(coolOverseed);

    // Check if base is C4
    const isC4Base = ["couch", "bermuda", "kikuyu", "zoysia", "buffalo", "seashore_paspalum"].includes(baseSpecies);

    // No overseed or not C4 base - use base species
    if (!overseedSpecies || !isC4Base || overseedSpecies === baseSpecies) {
      return baseSpecies || "perennialRyegrass";
    }

    // Check if overseed is C3
    const isC3Overseed = ["perennialRyegrass", "bentgrass", "kentuckyBluegrass", "tallFescue", "poaAnnua"].includes(
      overseedSpecies,
    );

    if (!isC3Overseed) {
      return baseSpecies || "perennialRyegrass";
    }

    // Check retention intent
    if (["retain", "perennial", "maintain", "keep"].includes(summerIntent)) {
      log("disease", `Overseed retained (intent: ${summerIntent}) - using overseed: ${overseedSpecies}`);
      return overseedSpecies;
    }

    // Check explicit overseed status
    const overseedStatus = turf?.overseedStatus || "";
    if (["transitioning", "fading", "dead"].includes(overseedStatus)) {
      log("disease", `Overseed ${overseedStatus} - using base: ${baseSpecies}`);
      return baseSpecies;
    }

    // High C3 cover
    if (c3Cover > 50) {
      log("disease", `High C3 cover (${c3Cover}%) - using overseed: ${overseedSpecies}`);
      return overseedSpecies;
    }

    // Seasonal logic
    const lat = _hubState.inputs.climate?.lat || _hubState.inputs.location?.lat || -33.87;
    const isSouthern = lat < 0;
    const month = new Date().getMonth() + 1;

    // Summer months - overseed typically gone
    const isSummer = isSouthern ? [12, 1, 2].includes(month) : [6, 7, 8].includes(month);
    if (isSummer) {
      // But check if they're retaining with significant cover
      if (c3Cover >= 30) {
        log("disease", `Summer with ${c3Cover}% C3 - overseed being retained, using: ${overseedSpecies}`);
        return overseedSpecies;
      }
      log("disease", `Summer, low C3 cover - using base: ${baseSpecies}`);
      return baseSpecies;
    }

    // Winter months - overseed dominant
    const isWinter = isSouthern ? [6, 7, 8].includes(month) : [12, 1, 2].includes(month);
    if (isWinter) {
      log("disease", `Winter, overseed dominant - using: ${overseedSpecies}`);
      return overseedSpecies;
    }

    // Transition months (spring/autumn) - use base (transitioning to/from)
    log("disease", `Transition season - using base: ${baseSpecies}`);
    return baseSpecies;
  }

  // =========================================================================
  // CLIMATE PIPELINE (Priority #3 - Unify climate/moisture)
  // =========================================================================

  /**
   * Get authoritative climate data
   * This is the SINGLE SOURCE OF TRUTH for all weather-related calculations
   *
   * Priority order:
   *   1. GAIP_CANONICAL_STATE (if populated)
   *   2. Live API data in _hubState
   *   3. Cached window.climateMetrics
   *   4. Manual inputs
   */
  function getAuthoritativeClimate() {
    const state = _hubState;

    // 1. Prefer GAIP_CANONICAL_STATE if populated with valid climate data
    if (
      global.GAIP_CANONICAL_STATE &&
      global.GAIP_CANONICAL_STATE.populatedAt &&
      global.GAIP_CANONICAL_STATE.climate &&
      global.GAIP_CANONICAL_STATE.climate.temperature
    ) {
      const canonical = global.GAIP_CANONICAL_STATE;
      // Build climate object from canonical state for backwards compatibility
      // v1.5.1: Include .moisture wrapper for disease engine compatibility
      // Disease engine reads climate.moisture.humidity.mean (v1 shape)
      // Also pass through hourlyData when available for getNightHumidity()
      const climateOut = {
        source: canonical.climate.source,
        temperature: canonical.climate.temperature,
        humidity: canonical.climate.humidity,
        dewpoint: canonical.climate.dewpoint,
        precipitation: canonical.climate.precipitation,
        et: canonical.climate.et,
        wind: canonical.climate.wind,
        solar: canonical.climate.solar,
        growth: canonical.climate.growthPotential,
        growthPotential: canonical.climate.growthPotential?.weighted,
        // Include soil temp from canonical
        soilTemp: canonical.soilTemp,
        // Quality metadata
        quality: canonical.quality,
        // v1.5.1: Moisture wrapper for disease engine compatibility
        // Disease engine reads climate.moisture.humidity.mean
        moisture: {
          humidity: canonical.climate.humidity,
          dewpoint: canonical.climate.dewpoint,
          precipitation: canonical.climate.precipitation,
        },
      };
      // v1.5.1: Pass through hourly data if available
      // Legacy disease engine uses hourlyData for getNightHumidity/getHighHumidityHours
      // v2 climate engine stores it in .hourly, v1 in .hourlyData
      // rawWeatherData is the authoritative source — structured as
      // { forecast: { hourly: { relative_humidity_2m, temperature_2m, ... } } }
      if (global.climateMetrics) {
        if (global.climateMetrics.hourlyData) {
          climateOut.hourlyData = global.climateMetrics.hourlyData;
        } else if (global.climateMetrics.hourly) {
          climateOut.hourlyData = global.climateMetrics.hourly;
        }
      }
      if (!climateOut.hourlyData) {
        climateOut.hourlyData = global.rawWeatherData?.forecast?.hourly || global.rawWeatherData?.hourly || null;
      }
      console.log("[Orchestrator] getAuthoritativeClimate hourlyData:", {
        hasHourlyData: !!climateOut.hourlyData,
        rhLen: climateOut.hourlyData?.relative_humidity_2m?.length || 0,
        rawWeatherDataKeys: global.rawWeatherData ? Object.keys(global.rawWeatherData) : "undefined",
        forecastKeys: global.rawWeatherData?.forecast ? Object.keys(global.rawWeatherData.forecast) : "none",
      });
      return climateOut;
    }

    // 2. Check for live API data
    if (state.computed.climate && state.computed.climate.source === "api") {
      const c = state.computed.climate;
      // Inject hourlyData if missing
      if (!c.hourlyData) {
        c.hourlyData = global.rawWeatherData?.forecast?.hourly || global.rawWeatherData?.hourly || null;
      }
      return c;
    }

    // 3. Check for cached API data (fetchedAt optional — climateMetrics may not set it)
    if (global.climateMetrics) {
      const c = global.climateMetrics;
      // Inject hourlyData if missing
      if (!c.hourlyData) {
        c.hourlyData = global.rawWeatherData?.forecast?.hourly || global.rawWeatherData?.hourly || null;
      }
      return c;
    }

    // 4. Fall back to manual inputs
    if (state.inputs.climate && state.inputs.climate.manual) {
      return buildClimateFromManual(state.inputs.climate.manual);
    }

    // 5. Return null if no climate data
    return null;
  }

  /**
   * Build standardized climate object from manual inputs
   */
  function buildClimateFromManual(manual) {
    // manual object shape varies by caller:
    //   hub-tissue path:     manual.temperature.min/max, manual.moisture.rainfall, manual.moisture.humidity
    //   legacy/direct path:  manual.tempMin/tempMax, manual.rainfall, manual.humidity
    // Read both, prefer the nested shape (hub-tissue) when present.
    const tempMin = safeNum(manual.temperature?.min ?? manual.tempMin ?? manual.tmin, 10);
    const tempMax = safeNum(manual.temperature?.max ?? manual.tempMax ?? manual.tmax, 25);
    const tempMean = (tempMin + tempMax) / 2;
    // b35fix345: humidity null-passthrough. b35fix336 changelog claimed this
    // was fixed; production verification 2026-04-26 (gilbasolutions_com-1777182748764.log)
    // showed `safeNum(humidity, 60)` still planting literal 60 when manual
    // humidity wasn't provided. Pull the humidity out of the nested shapes
    // honestly: if explicitly entered, use it; if absent, null. Disease engines
    // (b35fix344) handle null correctly; the literal 60 was pure fabrication.
    const _humidityRaw = manual.moisture?.humidity?.mean
                      ?? manual.moisture?.humidity
                      ?? manual.humidity;
    const humidity = (typeof _humidityRaw === 'number' && !isNaN(_humidityRaw))
        ? _humidityRaw
        : (typeof _humidityRaw === 'string' && _humidityRaw !== '' && !isNaN(parseFloat(_humidityRaw)))
            ? parseFloat(_humidityRaw)
            : null;
    const humiditySource = humidity != null ? 'manual' : 'no-data';
    const rainfall = safeNum(manual.moisture?.rainfall ?? manual.rainfall, 0);

    // Estimate dewpoint from temp and humidity (Magnus formula approximation).
    // b35fix345: dewpoint can only be estimated when humidity is real. When
    // humidity is null, dewpoint is null too (no fabrication).
    let dewpoint = null;
    if (humidity != null) {
      const a = 17.27;
      const b = 237.7;
      const gamma = (a * tempMean) / (b + tempMean) + Math.log(humidity / 100);
      dewpoint = (b * gamma) / (a - gamma);
    }

    return {
      source: "manual",
      temperature: {
        min: tempMin,
        max: tempMax,
        mean: tempMean,
      },
      humidity: {
        mean: humidity,
        dataSource: humiditySource,
      },
      dewpoint: {
        mean: dewpoint,
      },
      precipitation: {
        total: rainfall,
      },
      // v1.5.1: Moisture wrapper for disease engine compatibility
      moisture: {
        humidity: { mean: humidity, dataSource: humiditySource },
        dewpoint: { mean: dewpoint },
        precipitation: { total: rainfall },
      },
      et: {
        total: safeNum(manual.et0, tempMean * 0.2), // Rough estimate if not provided
      },
      soilMoisture: {
        mean: safeNum(manual.soilMoisture, 40),
      },
      growthPotential: calculateGrowthPotential(tempMean, _hubState.inputs.turf),
    };
  }

  /**
   * Calculate growth potential from temperature and species.
   * Delegates to GilbaGrowthPotentialEngine (PACE model, b35fix473).
   */
  function calculateGrowthPotential(tempC, species) {
    const isC4 = isC4Species(species);
    const GPE = global.GilbaGrowthPotentialEngine;
    if (isC4) {
      if (tempC <= 0 || tempC >= 45) return 0;
      const gp = GPE ? GPE.compute(tempC, { model: 'pace', species: 'c4' }) : null;
      return gp != null ? gp * 100 : 0;
    } else {
      if (tempC <= -5 || tempC >= 40) return 0;
      const gp = GPE ? GPE.compute(tempC, { model: 'pace', species: 'c3' }) : null;
      return gp != null ? gp * 100 : 0;
    }
  }

  function isC4Species(species) {
    const s = safeSpecies(species, "").toLowerCase();
    if (!s) return false;
    return (
      s.includes("couch") ||
      s.includes("bermuda") ||
      s.includes("kikuyu") ||
      s.includes("buffalo") ||
      s.includes("zoysia") ||
      s.includes("paspalum")
    );
  }

  // =========================================================================
  // STRESS AGGREGATOR (Combines shade, salinity, temperature stress)
  // =========================================================================

  /**
   * Calculate combined stress factors
   * These feed into disease and recovery calculations
   */
  function calculateStressAggregates() {
    const climate = _hubState.computed.climate;
    const shade = _hubState.computed.shade;
    const salinity = _hubState.computed.salinity;
    const turf = _hubState.inputs.turf;

    // Start with baseline (no stress)
    let combinedGrowthModifier = 1.0;
    let environmentalStressIndex = 0;
    const stressFactors = [];

    // ─────────────────────────────────────────────────────────────────────
    // 1. TEMPERATURE STRESS
    // ─────────────────────────────────────────────────────────────────────
    if (climate && climate.temperature) {
      // Prefer window.climateMetrics.growth.weighted (populated by Climate Engine)
      // This is the species-appropriate GP that matches the Climate Analysis card
      const gp =
        (window.climateMetrics && window.climateMetrics.growth && window.climateMetrics.growth.weighted) ||
        climate.growthPotential ||
        calculateGrowthPotential(climate.temperature.mean, turf);

      // Growth potential below 50% indicates temperature stress
      if (gp < 50) {
        const tempStress = (50 - gp) / 50; // 0-1 scale
        combinedGrowthModifier *= 1 - tempStress * 0.4; // Up to 40% reduction
        environmentalStressIndex += tempStress * 30;
        stressFactors.push({
          type: "temperature",
          severity: tempStress,
          impact: "growth",
          note: `Growth potential ${gp.toFixed(0)}%`,
        });
      }
    }

    // ─────────────────────────────────────────────────────────────────────
    // 2. SHADE STRESS
    // ─────────────────────────────────────────────────────────────────────
    if (shade) {
      // Gate shade stress factor on structural shade presence only —
      // open-sky DLI variation does not constitute agronomic shade stress.
      // shade.stressIndex is a composite score (light deficit + ET + traffic + fungal).
      // Without this gate, traffic (default: moderate = +12) and high fungal pressure
      // (>50 = +15) alone produce stressIndex ~27, which entered stressFactors as type
      // 'shade' with severity 0.27 and triggered DiseaseStressCoupling shade_stress
      // amplification (+4pp on Dollar Spot) even on completely unshaded greens.
      // Only use stressIndex as shade severity when physical obstruction is present.
      // On unshaded sites, use deficitPct only (pure DLI shortfall vs species target).
      const svf = shade.svf ?? shade.modular?.svf ?? 1;
      const facade = shade.facade ?? shade.modular?.facade ?? 0;
      const treeBlock = shade.treeBlock ?? shade.modular?.treeBlock ?? 0;
      const hasStructuralShade = svf < 0.99 || facade > 0 || treeBlock > 0;

      const deficitPct = shade.modular?.deficitPct || 0;

      // Structural shade: use composite stressIndex (legitimate).
      // No structural shade: use deficitPct only (species DLI shortfall vs target,
      // not contaminated by traffic/fungal terms unrelated to physical shading).
      const stressIndex = shade.stressIndex || 0;
      const shadeStress = hasStructuralShade ? Math.max(stressIndex / 100, deficitPct / 100) : deficitPct / 100;

      if (shadeStress > 0.1) {
        // Only count if >10% stress
        // Shade directly reduces growth capacity
        combinedGrowthModifier *= 1 - shadeStress * 0.35; // Up to 35% reduction
        environmentalStressIndex += shadeStress * 25;
        stressFactors.push({
          type: "shade",
          severity: shadeStress,
          impact: "growth,recovery,disease",
          dli: shade.DLI_total || shade.dli,
          deficitPct: deficitPct,
          status: shade.modular?.status || shade.c4Status,
          hasStructuralShade,
          note: `DLI ${(shade.DLI_total || shade.dli)?.toFixed(1) || "?"} mol/m²/d (${shade.modular?.status || "unknown"})`,
        });
      }
    }

    // ─────────────────────────────────────────────────────────────────────
    // 3. SALINITY STRESS
    // ─────────────────────────────────────────────────────────────────────
    if (salinity && salinity.growthPenaltyPct > 0) {
      const salinityFactor = salinity.growthPenaltyPct / 100;
      combinedGrowthModifier *= salinity.relativeYieldPct / 100;
      environmentalStressIndex += salinityFactor * 20;
      stressFactors.push({
        type: "salinity",
        severity: salinityFactor,
        impact: "growth,recovery",
        ecw: salinity.ecwInput,
        yieldReduction: salinity.growthPenaltyPct,
        note: `ECw ${salinity.ecwInput?.toFixed(1) || "?"} dS/m → ${salinity.growthPenaltyPct}% yield loss`,
      });
    }

    // ─────────────────────────────────────────────────────────────────────
    // 4. MOISTURE STRESS
    // ─────────────────────────────────────────────────────────────────────
    if (climate && climate.soilMoisture) {
      const sm = climate.soilMoisture.mean;
      if (sm < 25) {
        // Drought stress
        const droughtFactor = (25 - sm) / 25;
        combinedGrowthModifier *= 1 - droughtFactor * 0.3;
        environmentalStressIndex += droughtFactor * 20;
        stressFactors.push({
          type: "drought",
          severity: droughtFactor,
          impact: "growth,recovery",
          note: `Soil moisture ${sm.toFixed(0)}%`,
        });
      } else if (sm > 80) {
        // Waterlogging stress
        const waterlogFactor = (sm - 80) / 20;
        combinedGrowthModifier *= 1 - waterlogFactor * 0.25;
        environmentalStressIndex += waterlogFactor * 15;
        stressFactors.push({
          type: "waterlogging",
          severity: waterlogFactor,
          impact: "growth,disease",
          note: `Soil moisture ${sm.toFixed(0)}%`,
        });
      }
    }

    // ─────────────────────────────────────────────────────────────────────
    // 5. STORE RESULTS
    // ─────────────────────────────────────────────────────────────────────
    _hubState.computed.stress = wrapWithConfidence("stress", {
      combinedGrowthModifier: clamp(combinedGrowthModifier, 0.1, 1.0),
      environmentalStressIndex: clamp(environmentalStressIndex, 0, 100),
      factors: stressFactors,
      factorCount: stressFactors.length,
      severity:
        environmentalStressIndex > 60
          ? "critical"
          : environmentalStressIndex > 40
            ? "high"
            : environmentalStressIndex > 20
              ? "moderate"
              : "low",
    });

    // Also update derived values
    _hubState.derived.combinedGrowthModifier = _hubState.computed.stress.combinedGrowthModifier;
    _hubState.derived.environmentalStressIndex = _hubState.computed.stress.environmentalStressIndex;

    log("stress", "Stress aggregates calculated", _hubState.computed.stress);

    return _hubState.computed.stress;
  }

  // =========================================================================
  // DISEASE ENGINE WIRING (Priority #4)
  // =========================================================================

  /**
   * Build disease engine inputs with proper wiring
   * Ensures shade stress, dew duration, and N status are properly fed in
   */
  // =========================================================================
  // DISEASE ENGINE PURE — FEATURE FLAG + INJECTABLE DEPENDENCY BUILDER
  // When GILBA_USE_PURE_DISEASE is true, routes through DiseaseEnginePure.
  // All previously-global reads are injected as input properties.
  // Toggle via: window.GILBA_USE_PURE_DISEASE = true/false
  // =========================================================================

  /**
   * Build the injectable dependencies that the pure engine requires.
   * These replace the global/DOM reads that the legacy engine does internally.
   * Only called when GILBA_USE_PURE_DISEASE is true.
   */
  function buildPureDiseaseInjectables(baseInputs) {
    // 1. Regional multipliers — replaces window.gaip_getDiseaseMultiplier()
    const regionalMultipliers = {};
    const getMultiplier =
      global.gaip_getDiseaseMultiplier || (global.GAIP_VarietyTraits && global.GAIP_VarietyTraits.getDiseaseMultiplier);
    if (typeof getMultiplier === "function") {
      const diseaseKeys = [
        "dollarSpot",
        "brownPatch",
        "pythium",
        "anthracnose",
        "fusarium",
        "springDeadSpot",
        "helminthosporium",
        "grayLeafSpot",
        "takeAll",
        "redThread",
        "snowMould",
        "pinkSnowMould",
        "waiteaPatch",
        "largePatch",
      ];
      diseaseKeys.forEach((key) => {
        try {
          const val = getMultiplier(key);
          if (typeof val === "number" && val !== 1) {
            regionalMultipliers[key] = val;
          }
        } catch (e) {
          /* ignore individual lookup failures */
        }
      });
    }

    // 2. Region display info — replaces window.gaip_getRegionDisplayInfo()
    let regionDisplayInfo = { name: baseInputs.region || "Unknown" };
    if (typeof global.gaip_getRegionDisplayInfo === "function") {
      try {
        const info = global.gaip_getRegionDisplayInfo();
        if (info) regionDisplayInfo = info;
      } catch (e) {
        /* fallback to default */
      }
    }

    // 3. Large Patch model — replaces window.LargePatchModel
    const largePatchModel = global.LargePatchModel || null;

    // 4. Dormancy data — replaces window.GAIP_CLIMATE_V2.dormancy
    const dormancyData =
      global.GAIP_CLIMATE_V2 && global.GAIP_CLIMATE_V2.dormancy ? global.GAIP_CLIMATE_V2.dormancy : null;

    return Object.assign({}, baseInputs, {
      regionalMultipliers: regionalMultipliers,
      regionDisplayInfo: regionDisplayInfo,
      largePatchModel: largePatchModel,
      dormancyData: dormancyData,
    });
  }

  /**
   * Run disease analysis through either pure or legacy engine.
   * Centralises the flag check so both call sites use the same path.
   * @param {Object} diseaseInputs - Output of buildDiseaseInputs()
   * @returns {Object} Raw disease result (before stress coupling)
   */
  function runDiseaseAnalysis(diseaseInputs) {
    // v1.5.1: Pure engine is now the default path.
    // Set window.GILBA_USE_PURE_DISEASE = false to revert to legacy.
    const usePure = global.GILBA_USE_PURE_DISEASE !== false && global.DiseaseEnginePure;
    if (usePure) {
      const pureInputs = buildPureDiseaseInjectables(diseaseInputs);
      log("disease", "Using DiseaseEnginePure");
      return global.DiseaseEnginePure.analyse(pureInputs);
    }
    // Legacy path
    if (global.DiseaseEngine) {
      return global.DiseaseEngine.analyse(diseaseInputs);
    }
    warn("disease", "No disease engine available");
    return null;
  }

  function buildDiseaseInputs() {
    const climate = getAuthoritativeClimate();
    const shade = _hubState.computed.shade;
    const dew = _hubState.computed.dew;
    const tissue = _hubState.computed.tissue || _hubState.inputs.tissue;
    const turf = _hubState.inputs.turf;
    const stress = _hubState.computed.stress;

    // ─────────────────────────────────────────────────────────────────────
    // Extract dew/leaf wetness data
    // ─────────────────────────────────────────────────────────────────────
    let dewData = null;
    if (dew && dew.leafWetness) {
      // Use aggregated dew data from dew prediction engine
      dewData = {
        leafWetness: {
          totalWetHours: dew.leafWetness.totalWetHours || 0,
          averageWetHours: dew.leafWetness.averageWetHours || dew.leafWetness.totalWetHours / 7 || 0,
          consecutiveHours: dew.leafWetness.consecutiveHours || dew.leafWetness.maxConsecutiveWetHours || 0,
          nightWetHours: dew.leafWetness.nightWetHours || 0,
          extendedWetnessRisk: dew.leafWetness.extendedWetnessRisk || false,
          diseaseConditions: dew.leafWetness.diseaseConditions || [],
        },
        dewDuration: dew.leafWetness.averageWetHours || dew.leafWetness.totalWetHours / 7 || 0,
        dewRisk:
          dew.summary?.diseaseRisk?.conditionsMet?.length > 0
            ? "high"
            : dew.leafWetness.averageWetHours > 8
              ? "moderate"
              : "low",
        forecast: dew.forecast,
        summary: dew.summary,
        source: "dew-prediction-engine",
      };

      log("disease", "Dew data assembled from prediction engine", {
        totalWetHours: dewData.leafWetness.totalWetHours,
        averageWetHours: dewData.leafWetness.averageWetHours,
        dewRisk: dewData.dewRisk,
      });
    } else if (climate && climate.dewpoint && climate.temperature) {
      // Estimate leaf wetness from climate data (fallback)
      // Dew forms when air temp approaches dewpoint
      const tempRange = climate.temperature.max - climate.temperature.min;
      const dewpointProximity = climate.temperature.min - climate.dewpoint.mean;

      // Estimate hours where temp < dewpoint (dew formation)
      let estimatedWetHours = 0;
      if (dewpointProximity < 2) {
        estimatedWetHours = 6 + (2 - dewpointProximity) * 2; // 6-10 hours
      } else if (dewpointProximity < 5) {
        estimatedWetHours = 3; // Light dew
      }

      if (climate.humidity?.mean > 85) {
        estimatedWetHours += 2; // High humidity extends wetness
      }

      dewData = {
        leafWetness: {
          totalWetHours: estimatedWetHours * 7,
          averageWetHours: estimatedWetHours,
          consecutiveHours: estimatedWetHours,
          nightWetHours: estimatedWetHours,
        },
        dewDuration: estimatedWetHours,
        dewRisk: estimatedWetHours > 8 ? "high" : estimatedWetHours > 4 ? "moderate" : "low",
        source: "estimated-from-climate",
      };

      log("disease", "Dew data estimated from climate", {
        estimatedWetHours,
        dewRisk: dewData.dewRisk,
      });
    }

    // ─────────────────────────────────────────────────────────────────────
    // Extract nitrogen status from tissue analysis
    // v1.4.0: Use canonical state for C3/C4 determination
    // ─────────────────────────────────────────────────────────────────────
    let nitrogenStatus = { status: "adequate" };
    if (tissue && tissue.N) {
      const tissueN = parseFloat(tissue.N);
      // Use canonical state for C4 determination
      const isC4 = GAIP_CANONICAL_STATE.turf?.isC4 || false;

      // Species-specific N thresholds
      const ranges = isC4
        ? { deficient: 2.5, low: 3.0, optimal: 3.65, high: 4.3, excessive: 5.0 }
        : { deficient: 3.0, low: 3.5, optimal: 4.25, high: 5.0, excessive: 5.5 };

      let status;
      if (tissueN < ranges.deficient) status = "deficient";
      else if (tissueN < ranges.low) status = "low";
      else if (tissueN < ranges.optimal) status = "adequate";
      else if (tissueN <= ranges.high) status = "optimal";
      else if (tissueN <= ranges.excessive) status = "high";
      else status = "excessive";

      nitrogenStatus = {
        status: status,
        value: tissueN,
        thresholds: ranges,
      };
    }

    // ─────────────────────────────────────────────────────────────────────
    // Extract tissue nutrient factors for disease modification
    // v1.4.0: Use canonical state for C4 determination
    // ─────────────────────────────────────────────────────────────────────
    let tissueNutrients = null;
    if (tissue) {
      tissueNutrients = {
        hasData: true,
        modifiers: {},
      };

      // Potassium affects cell wall strength
      // v1.4.0: Use canonical state for C4 determination
      if (tissue.K) {
        const K = parseFloat(tissue.K);
        const isC4 = GAIP_CANONICAL_STATE.turf?.isC4 || false;
        const kThreshold = isC4 ? 1.6 : 2.0;
        if (K < kThreshold) {
          tissueNutrients.modifiers.K = {
            status: "deficient",
            factor: 1.2,
            value: K,
          };
        }
      }

      // Calcium affects disease resistance
      if (tissue.Ca) {
        const Ca = parseFloat(tissue.Ca);
        if (Ca < 0.3) {
          tissueNutrients.modifiers.Ca = {
            status: "deficient",
            factor: 1.15,
            value: Ca,
          };
        }
      }

      // K:N ratio
      if (tissue.K && tissue.N) {
        const KN = parseFloat(tissue.K) / parseFloat(tissue.N);
        if (KN < 0.6) {
          tissueNutrients.modifiers.KN_ratio = {
            status: "poor",
            factor: 1.15,
            value: KN,
          };
        }
      }
    }

    // ─────────────────────────────────────────────────────────────────────
    // Build final inputs object
    // v1.4.0: Use canonical speciesKey from GAIP_CANONICAL_STATE
    // ─────────────────────────────────────────────────────────────────────

    // Get species from canonical state (enforced SSOT)
    const canonicalTurf = GAIP_CANONICAL_STATE.turf || {};
    let speciesForDisease = canonicalTurf.effectiveSpeciesKey || canonicalTurf.speciesKey;

    if (!speciesForDisease) {
      warn("disease", "No species available from canonical state - disease analysis may be unreliable");
    }

    // ─────────────────────────────────────────────────────────────────────
    // b35fix365 — DIAGNOSTIC ONLY (no behaviour change)
    // Snapshots what the disease engine is about to receive at the exact
    // moment buildDiseaseInputs assembles its species. Runs alongside the
    // populateCanonicalState diagnostic — the timestamps allow correlating
    // the two events. If buildDiseaseInputs's speciesForDisease disagrees
    // with what populateCanonicalState resolved, GAIP_CANONICAL_STATE has
    // been overwritten between the two calls (writer race). If they agree
    // and the engine still produces wrong-species output, the bug is in
    // the engine's own species handling, not the input pipeline.
    // ─────────────────────────────────────────────────────────────────────
    try {
      const _diag = {
        speciesForDisease: speciesForDisease || null,
        // What the canonical state currently holds
        canonical_speciesKey: canonicalTurf.speciesKey || null,
        canonical_effectiveSpeciesKey: canonicalTurf.effectiveSpeciesKey || null,
        canonical_speciesRaw: canonicalTurf.speciesRaw || null,
        // Compare against the upstream sources at this moment
        hubStateInputs_turf_grassSpecies: _hubState.inputs.turf?.grassSpecies || null,
        hubStateInputs_turf_species: (_hubState.inputs.turf?.species != null)
          ? (typeof _hubState.inputs.turf.species === "string" ? _hubState.inputs.turf.species : "<object>")
          : null,
        GAIP_STATE_turf_grassSpecies: global.GAIP_STATE?.turf?.grassSpecies || null,
        GAIP_STATE_turf_effectiveSpecies: global.GAIP_STATE?.turf?.effectiveSpecies || null,
        SC_getBaseSpecies: (global.SpeciesController && typeof global.SpeciesController.getBaseSpecies === "function")
          ? (function() { try { return global.SpeciesController.getBaseSpecies(); } catch(e) { return "<error>"; } })()
          : null,
        timestamp: Date.now(),
      };
      try {
        console.log("[b35fix365 disease-inputs-species]", JSON.stringify(_diag));
      } catch(e) {}
    } catch(e) {
      try { console.warn("[b35fix365 disease-inputs-species] diagnostic error:", e); } catch(_) {}
    }

    // Inject sensor VWC into climate.moisture.soilMoisture so the
    // take-all soil pathway modifier (disease-engine-pure.js line 1357) uses
    // measured soil moisture rather than the default 0.3 fallback.
    // Priority: sensor VWC > existing climate value > default (handled by engine).
    // climate is a reference to the authoritative climate object — clone the
    // relevant sub-path to avoid mutating the shared canonical state.
    let climateForDisease = climate;
    if (global.GAIP_Sensor && typeof global.GAIP_Sensor.hasData === "function" && global.GAIP_Sensor.hasData()) {
      try {
        const sd = global.GAIP_Sensor.getIrrigationData();
        if (sd && sd.vwc != null) {
          climateForDisease = Object.assign({}, climate, {
            moisture: Object.assign({}, climate && climate.moisture, {
              soilMoisture: { mean: sd.vwc }, // engine normalises >1 values ÷100
            }),
          });
          log("disease", "Sensor VWC injected into disease inputs", { vwc: sd.vwc });
        }
      } catch (err) {
        warn("disease", "Error injecting sensor VWC into disease inputs:", err);
      }
    }

    // ─────────────────────────────────────────────────────────────────────
    // Roof microclimate modifier (b35fix250)
    // When a retractable roof is closed, the enclosed canopy traps moisture,
    // reduces airflow, and extends leaf wetness duration — all of which
    // increase fungal disease pressure independent of ambient weather.
    //
    // Mechanism (first principles + operational evidence):
    //   Transpiration from pitch surface cannot exchange with outside air
    //   when roof is closed. Vapour accumulates, raising in-canopy RH.
    //   Reduced exchange velocity extends LWD — dew dry-off is wind-driven.
    //   Source: Magarey et al. — Estimating Surface Wetness on Plants
    //     (DigitalCommons@UNL); Sentelhas et al. (2006) Agric. For.
    //     Meteorol. 141:105-117 — aerodynamic resistance and LWD.
    //
    //   Kingdom Arena (fully enclosed indoor stadium): requires 6 TC50
    //     turf coolers specifically to prevent disease from humidity build-up.
    //     Source: SGL System case study, 2025.
    //   Rogers Centre study: humidity at turf level (not seating level)
    //     identified as primary driver of enclosed-stadium turf failures.
    //     Source: Lyons, E. — Univ. of Guelph (Turf & Rec, 2019).
    //
    // Modifier values (quality: LOW — update when measured data available):
    //   RH +10%: Conservative vapour trapping estimate; capped at 98%.
    //   LWD x1.5: Near-zero airflow vs ambient. Greenhouse CFD data
    //     (Zito et al. 2020, ScienceDirect) shows ~8h enclosed LWD
    //     vs ~4-6h outdoors in temperate climates.
    // ─────────────────────────────────────────────────────────────────────
    const _roofState = shade && shade.roof_state ? shade.roof_state : 'open';
    if (_roofState === 'closed') {
      try {
        // b35fix345: GSSH closed-roof microclimate modifier degrades when no
        // base humidity is available. Pre-fix `|| 70` planted a fabricated
        // 70% baseline and then bumped it to 77% (×1.10). Result was an
        // enclosed-stadium "humidity adjustment" computed against fabricated
        // ambient — defensible only when ambient humidity is real. When the
        // base is null, skip the +10% RH modifier (LWD ×1.5 still applies as
        // it doesn't depend on RH magnitude). Provenance recorded so reports
        // can flag the partial application.
        const _baseHumidity = climateForDisease && climateForDisease.humidity
          ? (climateForDisease.humidity.mean ?? climateForDisease.humidity.current ?? null)
          : null;
        const _enclosedHumidity = _baseHumidity != null
          ? Math.min(98, Math.round(_baseHumidity * 1.10))
          : null;

        climateForDisease = Object.assign({}, climateForDisease, {
          humidity: Object.assign({}, climateForDisease && climateForDisease.humidity, {
            mean:    _enclosedHumidity,
            current: _enclosedHumidity,
          }),
          moisture: Object.assign({}, climateForDisease && climateForDisease.moisture, {
            humidity: Object.assign(
              {},
              climateForDisease && climateForDisease.moisture && climateForDisease.moisture.humidity,
              { mean: _enclosedHumidity, current: _enclosedHumidity }
            ),
          }),
          _roofMicroclimateMod: {
            applied:        true,
            roof_state:     'closed',
            humidity_base:  _baseHumidity,
            humidity_adj:   _enclosedHumidity,
            // b35fix345: humidity_adj_applied flag tells reports whether the
            // +10% RH modifier was actually applied (real base humidity) or
            // skipped because base humidity was null (no-data). LWD ×1.5
            // applies in both cases as it doesn't depend on RH magnitude.
            humidity_adj_applied: _baseHumidity != null,
            lwd_multiplier: 1.5,
            quality:        'low',
            source:         'operational_evidence',
            citations: [
              'Kingdom Arena turf microclimate (SGL System, 2025)',
              'Lyons E., Rogers Centre retractable roof humidity study (Turf & Rec, 2019)',
              'Magarey et al., Estimating Surface Wetness on Plants (DigitalCommons@UNL)',
              'Sentelhas et al. (2006) Agric. For. Meteorol. 141:105-117',
            ],
            note: 'Update when measured Marvel Stadium canopy microclimate data available.',
          },
        });

        if (dewData && dewData.leafWetness) {
          const _baseLWD = dewData.leafWetness.averageWetHours || 0;
          const _adjLWD  = Math.round(_baseLWD * 1.5 * 10) / 10;
          dewData = Object.assign({}, dewData, {
            leafWetness: Object.assign({}, dewData.leafWetness, {
              averageWetHours:    _adjLWD,
              totalWetHours:      Math.round(_adjLWD * 7 * 10) / 10,
              consecutiveHours:   Math.round((dewData.leafWetness.consecutiveHours || 0) * 1.5 * 10) / 10,
              _roofAdjusted:      true,
              _roofLWDMultiplier: 1.5,
            }),
            dewDuration: _adjLWD,
            dewRisk: _adjLWD > 8 ? 'high' : _adjLWD > 4 ? 'moderate' : 'low',
          });
        }

        log('disease', 'Roof microclimate modifier applied, humidity:',
          _baseHumidity + '%', '->', _enclosedHumidity + '%', '| LWD x1.5');

      } catch (err) {
        warn('disease', 'Roof microclimate modifier error, using unmodified inputs:', err);
      }
    }

    return {
      climate: climateForDisease,
      dewData: dewData,
      nitrogen: nitrogenStatus,
      tissueNutrients: tissueNutrients,
      shade: shade
        ? (function () {
            // Only pass DLI deficit to disease engine when structural
            // shade is configured. Without physical obstruction the deficit
            // reflects species-requirement shortfall or time-of-day DLI
            // accumulation — not a shade-driven disease risk. This prevents
            // spurious shadeMod amplification on unshaded greens at 7am.
            //
            // Structural obstruction is present when ANY of:
            //   shade.svf < 0.99    (sky view fraction reduced by trees/buildings)
            //   shade.facade > 0    (facade/obstruction angle configured)
            //   shade.treeBlock > 0 (tree occlusion percentage configured)
            //
            // fungalRisk still passes through regardless — poor air movement
            // is a valid disease risk factor independent of structural shade.
            const _svf = shade.svf ?? shade.modular?.svf ?? 1;
            const _facade = shade.facade ?? shade.modular?.facade ?? 0;
            const _treeBlock = shade.treeBlock ?? shade.modular?.treeBlock ?? 0;
            const hasStructuralShade = _svf < 0.99 || _facade > 0 || _treeBlock > 0;

            const _deficitPct = hasStructuralShade ? shade.deficitPct || shade.modular?.deficitPct || 0 : 0;

            return {
              stressFactor: hasStructuralShade ? shade.stressFactor || shade.stressIndex / 100 || 0 : 0,
              dli: shade.dliShaded || shade.dli || null,
              deficitPct: _deficitPct,
              fungalRisk: shade.fungalRisk || shade.fungal || null,
              // Format expected by disease engine (DollarSpotModel reads shade.dliDeficit.percentage)
              dliDeficit: {
                percentage: _deficitPct,
                mol: hasStructuralShade ? shade.dliDeficit || 0 : 0,
              },
              // Pass obstruction flags through for downstream consumers
              hasStructuralShade: hasStructuralShade,
              svf: _svf,
              facade: _facade,
              treeBlock: _treeBlock,
            };
          })()
        : null,
      // v1.4.0: Use canonical speciesKey instead of re-resolving
      species: speciesForDisease,
      speciesKey: canonicalTurf.speciesKey, // Base species
      effectiveSpeciesKey: canonicalTurf.effectiveSpeciesKey, // For overseed
      isOverseed: canonicalTurf.isOverseed || false,
      isC4: canonicalTurf.isC4 || false,
      variety: extractVarietyTraits(turf),
      traffic: _hubState.computed.wear || null,
      mowing: {
        height: turf?.heightOfCut || 25,
        frequency: turf?.mowingFrequency || "regular",
      },
      soil: (() => {
        const raw = _hubState.inputs.soil || null;
        if (!raw) return null;
        // Normalize soil keys for pure engine: GAIP_STATE.soil uses soil_ph/pH_Water/Mn
        // but disease-engine-pure.js TakeAllModel reads soil.pH and soil.Mn_ppm.
        const pH = raw.pH ?? raw.soil_ph ?? raw.pH_Water ?? raw.pH_water ?? null;
        const Mn_ppm = raw.Mn_ppm ?? raw.Mn ?? null;
        return Object.assign({}, raw, { pH, Mn_ppm });
      })(),
      region: detectRegion(),
      // Pass stress aggregates for compound effects
      stressAggregates: stress,
    };
  }

  // =========================================================================
  // BUILD STRESS TRAJECTORY INPUTS
  // v1.0.0: Assembles state/weather from computed results so
  // GAIP_StressTrajectory.project() gets injected inputs rather than
  // reading globals. Mirrors the pattern used by buildWearRecoveryInputs().
  // =========================================================================
  function buildStressTrajectoryInputs() {
    const climate = getAuthoritativeClimate();
    const turf = _hubState.inputs.turf;
    const site = _hubState.inputs.site;
    const soil = _hubState.inputs.soil;
    const schedule = _hubState.inputs.schedule;
    const tissue = _hubState.inputs.tissue;
    const shade = _hubState.computed.shade;
    const wear = _hubState.computed.wear;
    const disease = _hubState.computed.disease;
    const stress = _hubState.computed.stress;

    // ── Species string for grass type detection ────────────────────────────
    // The engine's getGrassType() reads state.turf.grassSpecies or .species
    const canonicalTurf = GAIP_CANONICAL_STATE.turf || {};
    const speciesForTrajectory =
      canonicalTurf.species || canonicalTurf.effectiveSpeciesKey || turf?.grassSpecies || turf?.species || "";

    // ── ET balance from irrigation engine or climate ────────────────────────
    // Positive = deficit (drought), negative = surplus (waterlogging)
    const etBalance =
      climate?.et?.daily != null
        ? (climate.precipitation?.total || 0) / 7 - climate.et.daily // daily rain - ET0
        : null;

    // ── Weather object for the trajectory engine ───────────────────────────
    // Builds forecast.daily.temperature_2m_max[] from canonical climate
    // forecast array or daily pattern so the engine can project forward.
    let weather = null;
    if (global.rawWeatherData?.hourly) {
      // Best source: full hourly data from Open-Meteo
      const hourly = global.rawWeatherData.hourly;
      const dayTemps = {};
      for (let i = 0; i < hourly.time.length; i++) {
        const day = hourly.time[i].split("T")[0];
        if (!dayTemps[day]) dayTemps[day] = { temps: [], precip: 0 };
        dayTemps[day].temps.push(hourly.temperature_2m[i]);
        if (hourly.precipitation?.[i]) dayTemps[day].precip += hourly.precipitation[i];
      }
      const days = Object.keys(dayTemps).sort();
      weather = {
        forecast: {
          daily: {
            time: days,
            temperature_2m_max: days.map((d) => Math.max(...dayTemps[d].temps)),
            temperature_2m_min: days.map((d) => Math.min(...dayTemps[d].temps)),
            precipitation_sum: days.map((d) => dayTemps[d].precip),
          },
        },
      };
    } else if (climate?.temperature) {
      // Fallback: build a flat 14-day forecast from current temps
      // (engine will use current temp for all days it lacks forecast data)
      weather = { temperature: climate.temperature, forecast: null };
    }

    // ── State object for the trajectory engine ─────────────────────────────
    // Mirrors the shape the engine's calculateCurrentComponents() expects.
    const state = {
      turf: {
        grassSpecies: speciesForTrajectory,
        species: speciesForTrajectory,
        turfType: turf?.turfType || null,
      },
      site: { soilMoisture: site?.soilMoisture || null },
      etBalance,
      climateMetrics: climate,
      shadeResult: shade || null,
      wearResult: wear || null,
      diseaseResult: disease || null,
      mlsnResult: _hubState.computed.mlsn || null,
      tissueResult: _hubState.computed.tissue || null,
      fertility: tissue || null,
    };

    return { state, weather };
  }

  function extractVarietyTraits(turf) {
    // Species normalisation — guard against TurfProfileController dispatch
    // firing before the spray log cascade completes.
    // after hub-tissue has already triggered the first analysis. At that point
    // turf.variety is still 'generic'. Fall back to GAIP_CANONICAL_STATE which
    // TurfProfileController updates synchronously, so the correct variety is
    // available even on the first orchestrator computeAll call.
    const resolvedVariety =
      turf?.variety && turf.variety !== "generic"
        ? turf.variety
        : GAIP_CANONICAL_STATE?.turf?.variety && GAIP_CANONICAL_STATE.turf.variety !== "generic"
          ? GAIP_CANONICAL_STATE.turf.variety
          : null;
    if (!resolvedVariety) return null;

    const varietyName = resolvedVariety;
    const species =
      turf?.grassSpecies ||
      turf?.species ||
      turf?.effectiveSpecies ||
      GAIP_CANONICAL_STATE?.turf?.grassSpecies ||
      GAIP_CANONICAL_STATE?.turf?.species;

    // Try to get cached traits first
    if (global.selectedVarietyTraits && global.selectedVarietyTraits.disease) {
      log("disease", `Using cached variety traits for "${varietyName}"`);
      return global.selectedVarietyTraits;
    }

    // Build variety traits by calling the variety traits integration
    const getDiseaseModifier =
      global.GAIP_VarietyTraits?.getDiseaseModifier ||
      global.gaip_getRegionalDiseaseModifier ||
      global.gaip_getDiseaseModifier;

    if (typeof getDiseaseModifier === "function") {
      // Normalize species for lookup
      const speciesKey = normalizeSpeciesKey(species);

      const traits = {
        name: varietyName,
        species: speciesKey,
        disease: {},
        source: "variety-traits-integration",
      };

      // Fetch disease modifiers for all relevant diseases
      const diseases = [
        "dollarSpot",
        "brownPatch",
        "pythium",
        "anthracnose",
        "grayLeafSpot",
        "springDeadSpot",
        "redThread",
        "fusarium",
        "takeAll",
        "helminthosporium",
      ];

      let hasAnyData = false;
      diseases.forEach((disease) => {
        try {
          const result = getDiseaseModifier(speciesKey, varietyName, disease);
          if (result && result.confidence !== "none") {
            traits.disease[disease] = {
              riskMultiplier: result.riskMultiplier || 1,
              confidence: result.confidence,
              source: result.source,
            };
            hasAnyData = true;
            if (!traits.region && result.region) {
              traits.region = result.region;
            }
          }
        } catch (e) {
          // Ignore individual disease lookup failures
        }
      });

      if (hasAnyData) {
        log("disease", `Variety traits loaded for "${varietyName}" (${speciesKey}):`, {
          region: traits.region,
          diseases: Object.keys(traits.disease).length,
        });
        return traits;
      }

      // Fallback directly to gaip_getDiseaseModifier when the primary
      // getDiseaseModifier path (which routes through gaip_getAUDiseaseModifier on
      // AU pages) returns no data. au-variety-traits.js only covers warm-season AU
      // species (couch, kikuyu) and has no bentgrass data — so NTEP varieties like
      // L-93 get confidence:'none' from the AU wrapper, hasAnyData stays false, and
      // extractVarietyTraits returns null even though gssh/gilba-variety-traits.js
      // has the correct L-93 riskMultiplier data. This fallback directly calls the
      // base variety traits function, bypassing the AU routing layer.
      if (
        getDiseaseModifier !== global.gaip_getDiseaseModifier &&
        typeof global.gaip_getDiseaseModifier === "function"
      ) {
        const fallbackTraits = {
          name: varietyName,
          species: speciesKey,
          disease: {},
          source: "variety-traits-fallback",
        };
        let fallbackHasData = false;
        diseases.forEach((disease) => {
          try {
            const result = global.gaip_getDiseaseModifier(speciesKey, varietyName, disease);
            if (result && result.confidence !== "none") {
              fallbackTraits.disease[disease] = {
                riskMultiplier: result.riskMultiplier || 1,
                confidence: result.confidence,
                source: result.source,
              };
              fallbackHasData = true;
            }
          } catch (e) {
            /* ignore */
          }
        });
        if (fallbackHasData) {
          log("disease", `Variety traits loaded via fallback for "${varietyName}" (${speciesKey})`);
          return fallbackTraits;
        }
      }
    }

    // Also try getWearModifier for completeness (wear traits)
    const getWearModifier = global.GAIP_VarietyTraits?.getWearModifier;
    if (typeof getWearModifier === "function") {
      const speciesKey = normalizeSpeciesKey(species);
      try {
        const wearResult = getWearModifier(speciesKey, varietyName);
        if (wearResult && wearResult.confidence !== "none") {
          return {
            name: varietyName,
            species: speciesKey,
            disease: {}, // No disease data but wear data exists
            wear: wearResult,
            source: wearResult.source || "variety-traits-integration",
          };
        }
      } catch (e) {
        // Ignore
      }
    }

    log("disease", `No variety traits found for "${varietyName}" - using species defaults`);
    return {
      name: varietyName,
      source: "no-variety-data",
    };
  }

  /**
   * Normalize species key for variety trait lookups
   * v1.3.3: Integrates with SpeciesController for consistent species identity
   */
  function normalizeSpeciesKey(species) {
    if (!species) return "perennialRyegrass";

    // BEST: Use SpeciesController when available
    if (global.SpeciesController && typeof global.SpeciesController.normalize === "function") {
      const canonical = global.SpeciesController.normalize(species);
      return canonical;
    }

    // FALLBACK: Original logic
    const s = species.toLowerCase().replace(/[\s\-_()]+/g, "");

    // Map common names to trait database keys
    const aliases = {
      perennialryegrass: "perennialRyegrass",
      prg: "perennialRyegrass",
      ryegrass: "perennialRyegrass",
      creepingbentgrass: "bentgrass",
      creepingbentgrassgreens: "bentgrass",
      browntopbent: "bentgrass",
      browntopbentgreens: "bentgrass",
      colonialbent: "bentgrass",
      bentgrass: "bentgrass",
      bent: "bentgrass",
      agrostis: "bentgrass",
      kentuckybluegrass: "kentuckyBluegrass",
      kbg: "kentuckyBluegrass",
      bluegrass: "kentuckyBluegrass",
      tallfescue: "tallFescue",
      fescue: "fineFescue",
      finefescue: "fineFescue",
      chewingsfescue: "fineFescue",
      chewings: "fineFescue",
      slendercreepingredfescue: "fineFescue",
      strongcreepingredfescue: "fineFescue",
      bermuda: "couch",
      bermudagrass: "couch",
      couch: "couch",
      cynodon: "couch",
      kikuyu: "kikuyu",
      zoysia: "zoysia",
      zoysiagrass: "zoysia",
      buffalo: "buffalo",
      poaannua: "poaAnnua",
      poa: "poaAnnua",
      annualbluegrass: "poaAnnua",
      seashorepaspalum: "seashorePaspalum",
      paspalum: "seashorePaspalum",
    };

    return aliases[s] || species;
  }

  function detectRegion() {
    // Try regional profiles
    if (typeof global.gaip_getCurrentRegion === "function") {
      const region = global.gaip_getCurrentRegion();
      if (region && region.id) return region.id;
    }

    // Try coordinates
    const latInput = document.querySelector(".gaip-lat");
    const lonInput = document.querySelector(".gaip-lon");
    if (latInput && lonInput) {
      const lat = parseFloat(latInput.value);
      const lon = parseFloat(lonInput.value);
      if (!isNaN(lat) && !isNaN(lon)) {
        // Simple region detection
        // NZ must be checked BEFORE AU (NZ lon 166-179 is subset of AU lon > 110)
        if (lat < 0 && lon > 165 && lon < 180) return "NZ";
        if (lat < 0 && lon >= 113 && lon <= 165) return "AU";
        if (lat > 50 && lon < 2) return "GB";
        if (lat > 55 && lon > 5 && lon < 25) return "SCAND";
        if (lat > 30 && lat < 46 && lon > 129 && lon < 146) return "JP";
      }
    }

    return "AU"; // Default
  }

  // =========================================================================
  // v2.0.0: BUILD DEW INPUTS — assembles state for dew engine v2.0.1
  // =========================================================================

  /**
   * Build the state + climate objects for the dew prediction engine.
   * Prefers rawWeatherData (has hourly cloud_cover, precipitation).
   */
  function buildDewInputs() {
    const climate = getAuthoritativeClimate();
    const turf = _hubState.inputs.turf || {};
    const schedule = _hubState.inputs.schedule || {};

    const dewState = {
      turfType: turf.turfType || "sports",
      turf: turf,
      climate: climate,
      match: schedule.nextMatch || null,
      subCategory: turf.subCategory || null,
    };

    // rawWeatherData has hourly cloud_cover + precipitation; climate doesn't
    const weatherForDew = global.rawWeatherData || climate;

    return { state: dewState, weather: weatherForDew };
  }

  // =========================================================================
  // v1.9.0: BUILD SHADE INPUTS — assembles state for shade engine v2.2.0
  // =========================================================================

  /**
   * Build the state object for the shade engine.
   * Injects ambient DLI, overseed state, turf context, variety modifier,
   * and month index so the engine doesn't need to read globals.
   */
  function buildShadeInputs() {
    const climate = getAuthoritativeClimate();
    const canonicalClimate = GAIP_CANONICAL_STATE?.climate;
    const turf = _hubState.inputs.turf || {};
    const site = _hubState.inputs.site || {};

    // --- Build shade state ---
    const shadeState = {
      turf: { ...turf },
      site: site,
      climate: {
        ...climate,
        manual: _hubState.inputs.climate?.manual ||
          global.GAIP_STATE?.climate?.manual || {
            tmin: canonicalClimate?.temperature?.min,
            tmax: canonicalClimate?.temperature?.max,
            temperature: canonicalClimate?.temperature,
          },
      },
      monthIndex: new Date().getMonth(),
    };

    // --- Ambient DLI (prefer captured snapshot, then cached global, then recalculate) ---
    // Priority 1: _lastAnalysisAmbientDLI — captured synchronously at gaip:analysis-complete
    // before any site-switch can overwrite global.GAIP_STATE.turf or gaip_currentAmbientDLI.
    // Priority 2: gaip_currentAmbientDLI — may be cleared by site-switch-cleanup in the race window.
    // Priority 3: full recalculation from rawWeatherData as last resort.
    if (global.AmbientDLIEngine && global.rawWeatherData) {
      try {
        const snappedDLI = _lastAnalysisAmbientDLI;
        const cachedDLI = global.gaip_currentAmbientDLI;
        if (snappedDLI && snappedDLI > 0) {
          shadeState.turf.ambientDLI = snappedDLI;
          shadeState.ambientDLI = { current: snappedDLI, source: 'state' };
        } else if (cachedDLI && cachedDLI.current > 0) {
          shadeState.turf.ambientDLI = cachedDLI.current;
          shadeState.ambientDLI = cachedDLI;
        } else {
          // Final fallback: full recalculate from rawWeatherData.
          const rwd = global.rawWeatherData;
          const dliClimate = {};
          if (rwd.forecast && rwd.forecast.hourly) dliClimate.hourly = rwd.forecast.hourly;
          if (rwd.forecast && rwd.forecast.daily) dliClimate.daily = rwd.forecast.daily;
          if (!dliClimate.daily && rwd.historical && rwd.historical.daily) dliClimate.daily = rwd.historical.daily;
          const freshDLI = global.AmbientDLIEngine.calculate(dliClimate, shadeState);
          if (freshDLI && freshDLI.current > 0) {
            shadeState.turf.ambientDLI = freshDLI.current;
            shadeState.ambientDLI = freshDLI;
            global.gaip_currentAmbientDLI = freshDLI;
          }
        }
      } catch (dliErr) {
        warn("shade", "Ambient DLI calculation failed, using cached value", dliErr);
      }
    }

    // --- Overseed state ---
    if (global.GAIP_OVERSEED_STATE) {
      shadeState.overseedState = global.GAIP_OVERSEED_STATE;
    }

    // --- Turf context (DLI thresholds from turf profile) ---
    if (typeof global.gaip_shade_getTurfContext === "function") {
      try {
        const tc = global.gaip_shade_getTurfContext();
        if (tc && tc.dliMinimum && tc.dliOptimal) {
          shadeState.turfContext = tc;
        }
      } catch (e) {
        /* fall through */
      }
    }

    // --- Variety shade modifier ---
    if (global.GAIP_VarietyTraits) {
      const variety = turf.variety || turf.cultivar || null;
      if (variety) {
        try {
          const shadeMod = global.GAIP_VarietyTraits.getShadeModifier(turf.grassSpecies || turf.species || "", variety);
          if (shadeMod && shadeMod.confidence !== "none") {
            shadeState.varietyShadeModifier = shadeMod;
          }
        } catch (e) {
          /* fall through */
        }
      }
    }

    // --- Weather object (canonical temps for getAverageTemperature) ---
    let weatherForShade = global.rawWeatherData;
    if (!weatherForShade && canonicalClimate && canonicalClimate.temperature && canonicalClimate.temperature.mean) {
      weatherForShade = {
        forecast: {
          daily: {
            temperature_2m_min: [canonicalClimate.temperature.min],
            temperature_2m_max: [canonicalClimate.temperature.max],
            temperature_2m_mean: [canonicalClimate.temperature.mean],
          },
        },
        temperature: canonicalClimate.temperature,
        _source: "canonical_state",
      };
      log(
        "shade",
        `Using canonical temps for shade: ${canonicalClimate.temperature.min}-${canonicalClimate.temperature.max}°C`,
      );
    }

    log("shade", "buildShadeInputs assembled", {
      hasAmbientDLI: !!(shadeState.ambientDLI || shadeState.turf.ambientDLI),
      hasOverseed: !!shadeState.overseedState,
      hasTurfContext: !!shadeState.turfContext,
      hasVarietyMod: !!shadeState.varietyShadeModifier,
      month: shadeState.monthIndex,
    });

    return { state: shadeState, weather: weatherForShade || climate };
  }

  // =========================================================================
  // WEAR/RECOVERY WIRING (Priority #1)
  // =========================================================================

  /**
   * Build pre-emergent timing engine inputs from climate, sensor, and schedule state.
   * Called from computeAll() step 8b.
   */
  function buildPreEmergentInputs() {
    const climate = _hubState.computed.climate || global.climateMetrics || {};
    const schedule = _hubState.inputs.schedule || {};
    const site = _hubState.inputs.site || {};

    // ── Soil temperature (5cm) ────────────────────────────────────────────
    // Priority: sensor → computed climate soilTemp → climate temperature.soil
    let soilTemp5cm = null;
    let soilTempSource = "unknown";

    // Priority 1: sensor bridge (TDR/Pogo/Hydrosight via GAIP_Sensor).
    // hasData() gate blocks Hydrosight when mapping not configured; bypass hasData() here.
    try {
      const sd =
        global.GAIP_Sensor && typeof global.GAIP_Sensor.getIrrigationData === "function"
          ? global.GAIP_Sensor.getIrrigationData()
          : null;
      if (sd && sd.soilTemp != null) {
        soilTemp5cm = sd.soilTemp;
        soilTempSource = "sensor";
      }
    } catch (e) {
      /* ignore */
    }
    // Priority 1b: Hydrosight direct — bridge mapping check can block even when data exists
    // (site not yet mapped in gilba_sensor_mappings). Read GAIP_Hydrosight directly instead.
    if (soilTemp5cm == null) {
      try {
        if (global.GAIP_Hydrosight && typeof global.GAIP_Hydrosight.hasData === "function"
            && global.GAIP_Hydrosight.hasData()) {
          const hsData = global.GAIP_Hydrosight.getIrrigationData();
          if (hsData && hsData.soilTemp != null) {
            soilTemp5cm = hsData.soilTemp;
            soilTempSource = "sensor";
          }
        }
      } catch (e) { /* ignore */ }
    }
    // Priority 2: GAIP_CANONICAL_STATE.soilTemp — sensor/api/physics/estimated
    // Propagate the actual source recorded by the canonical state builder instead of
    // hardcoding "physics_model"; canonical state itself uses the full sensor→api→physics
    // cascade, so the source label here must reflect what canonical state resolved.
    if (soilTemp5cm == null) {
      const canonSoilTemp = global.GAIP_CANONICAL_STATE?.soilTemp;
      const canonDepths = canonSoilTemp?.depths;
      if (canonDepths?.d50mm != null) {
        soilTemp5cm = canonDepths.d50mm;
        soilTempSource = canonSoilTemp.source || "physics_model";
      }
    }
    // Priority 3: computed climate soilTemp
    if (soilTemp5cm == null && climate?.soilTemp?.estimated != null) {
      soilTemp5cm = climate.soilTemp.estimated;
      soilTempSource = climate.soilTemp.source || "climate_engine";
    }
    if (soilTemp5cm == null && climate?.temperature?.soil?.mean != null) {
      soilTemp5cm = climate.temperature.soil.mean;
      soilTempSource = "climate_temperature_soil";
    }
    if (soilTemp5cm == null && global.climateMetrics?.soilTemp?.estimated != null) {
      soilTemp5cm = global.climateMetrics.soilTemp.estimated;
      soilTempSource = "climateMetrics_global";
    }

    // Priority 4: Campbell & Norman (1998) soil heat damping — same model as climate-engine-v2.js
    // T_soil(z) = T_mean + A_surface * exp(-z / D) * 0.5  (phase-averaged)
    // where D = sqrt(2α/ω), α = thermal diffusivity (m²/s), ω = 2π/86400 (daily freq)
    // Texture-specific diffusivity values match SOIL_DIFFUSIVITY in climate-engine-v2.js.
    // Flagged 'derived_from_air_temp' — UI and Word export already caveat this source.
    if (soilTemp5cm == null) {
      const tempCurrent =
        climate?.temperature?.current ??
        climate?.temperature?.mean ??
        _hubState.computed.climate?.temperature?.current ??
        global.climateMetrics?.temperature?.current ??
        null;
      const tempMin = climate?.temperature?.min ?? global.climateMetrics?.temperature?.min ?? null;
      const tempMax = climate?.temperature?.max ?? global.climateMetrics?.temperature?.max ?? null;

      if (tempCurrent != null) {
        // Thermal diffusivity map (×10⁻⁷ m²/s) — matches climate-engine-v2.js SOIL_DIFFUSIVITY
        const DIFFUSIVITY = {
          sand: 8.0,
          loamy_sand: 7.0,
          sandy_loam: 6.5,
          loam: 5.5,
          silt_loam: 5.0,
          clay_loam: 4.5,
          clay: 4.0,
          peat: 2.5,
        };
        // Derive texture from soil inputs or construction type
        const soil = _hubState.inputs.soil || {};
        const turf = _hubState.inputs.turf || {};
        const rawTex = soil.soilTexture || soil.type || null;
        const constr = turf.construction || site.construction || "";
        const texKey = rawTex || (constr === "sand_carpet" || constr === "usga" ? "sand" : "loam");
        const alpha = (DIFFUSIVITY[texKey] || 5.5) * 1e-7; // m²/s
        const omega = (2 * Math.PI) / 86400; // rad/s — daily cycle
        const D = Math.sqrt((2 * alpha) / omega); // damping depth (m)
        const depth = 0.05; // 5 cm

        // Diurnal amplitude: use max-min if available, else assume ±4°C
        const airTempAmp = tempMax != null && tempMin != null ? (tempMax - tempMin) / 2 : 4.0;

        // Mean air temp: use current as proxy if mean not stored separately
        const airTempMean = tempCurrent;

        // Phase-averaged soil temp at target depth
        const dampedAmp = airTempAmp * Math.exp(-depth / D);
        soilTemp5cm = Math.round((airTempMean + dampedAmp * 0.5) * 10) / 10;
        soilTempSource = "derived_from_air_temp";
        log(
          "pre-emergent",
          "soilTemp5cm derived (Campbell & Norman): airMean=" +
            airTempMean +
            " amp=" +
            airTempAmp.toFixed(1) +
            " D=" +
            D.toFixed(4) +
            "m tex=" +
            texKey +
            " → soilTemp5cm=" +
            soilTemp5cm,
        );
      }
    }

    // ── Soil temperature history (daily series for trend + rolling avg) ──
    // Priority 1: hourly soil_temperature_0_to_7cm from rawWeatherData.
    //   Note: Open-Meteo free tier provides this as forecast only (no back-history),
    //   so this path typically yields an empty array.
    // Priority 2: Synthesise from daily forecast air temps via FAO-56 soil damping.
    //   soil_temp ≈ air_mean + amp * exp(-depth/D) * 0.5 (phase-averaged)
    //   Using depth=0.05m, damping ~0.08m (sandy loam), amp ≈ (max-min)/2.
    //   This gives a 7–14 day forward series the trend engine can work with.
    // Priority 3: Single-point fallback (trend = 0, all GREEN — not useful).
    let soilTempHistory = [];

    // Priority 1: hourly API soil temp (usually empty on free tier)
    if (global.rawWeatherData?.hourly?.soil_temperature_0_to_7cm?.length > 0) {
      const hourly = global.rawWeatherData.hourly;
      const dailyTemps = {};
      for (let i = 0; i < hourly.time.length; i++) {
        const day = hourly.time[i].split("T")[0];
        if (!dailyTemps[day]) dailyTemps[day] = [];
        if (hourly.soil_temperature_0_to_7cm[i] != null) {
          dailyTemps[day].push(hourly.soil_temperature_0_to_7cm[i]);
        }
      }
      soilTempHistory = Object.keys(dailyTemps)
        .sort()
        .map((day) => {
          const vals = dailyTemps[day];
          return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
        })
        .filter((v) => v != null);
    }

    // Priority 2: stored sensor history from GAIP_SoilTempLogger
    // Only use logger history when the current source IS a sensor — physics model sites
    // must not use logger history because past sessions may have written bleed data from
    // other sites' sensors into this site's log (race condition pre-fix).
    if (soilTempHistory.length < 3 && soilTempSource === "sensor" && global.GAIP_SoilTempLogger) {
      try {
        const siteId =
          (global.GAIP_SiteContext ? global.GAIP_SiteContext.getSiteId() : (global.GAIP_SampleManager && global.GAIP_SampleManager.getActiveSiteId ? global.GAIP_SampleManager.getActiveSiteId() : null)) || "default";
        const logged = global.GAIP_SoilTempLogger.getHistory(siteId, 14);
        if (logged.length >= 3) {
          soilTempHistory = logged;
          log(
            "pre-emergent",
            "soilTempHistory from logger, len=" +
              logged.length +
              ", days stored=" +
              global.GAIP_SoilTempLogger.daysStored(siteId),
          );
        }
      } catch (e) {
        /* ignore */
      }
    }

    // Priority 3: synthesise from daily forecast air temps
    if (soilTempHistory.length < 3) {
      const forecastDays = climate?.forecast || _hubState.computed.climate?.forecast || [];
      if (forecastDays.length >= 3) {
        const dampingDepth = 0.08; // metres — sandy loam
        const depth = 0.05; // 5 cm measurement depth
        const dampFactor = Math.exp(-depth / dampingDepth); // ≈ 0.535
        soilTempHistory = forecastDays
          .filter((d) => d.temp_mean != null)
          .map((d) => {
            const amp = d.temp_max != null && d.temp_min != null ? (d.temp_max - d.temp_min) / 2 : 4; // default diurnal amplitude if not available
            return Math.round((d.temp_mean + amp * dampFactor * 0.5) * 10) / 10;
          });
        log("pre-emergent", "soilTempHistory synthesised from forecast air temps, len=" + soilTempHistory.length);
      }
    }

    // Priority 3: single-point fallback
    if (soilTempHistory.length === 0 && soilTemp5cm != null) {
      soilTempHistory = [soilTemp5cm];
      log("pre-emergent", "soilTempHistory: single-point fallback, trend will be zero");
    }

    // ── Moisture flag (recent rainfall/irrigation mm) ─────────────────────
    let moistureFlag = null;
    if (climate?.precipitation?.last24h != null) {
      moistureFlag = climate.precipitation.last24h;
    } else if (climate?.precipitation?.total != null) {
      const days = climate.precipitation.period ? climate.precipitation.period / 24 : 7;
      moistureFlag = climate.precipitation.total / days;
    }
    // Call getIrrigationData() directly — sensor-api-bridge prioritises
    // Hydrosight over CSV. Sensor VWC overrides precipitation as it is a direct
    // soil reading. Precedence: sensor VWC > irrigationApplied > climate precip.
    // sensor-api-bridge patch (which prioritises Hydrosight over CSV) is always used.
    // Previously: hasData() returned false when no CSV was loaded even though
    // Hydrosight live data was available, leaving moistureFlag at 0 (last24h precip).
    // Sensor VWC must override precipitation — it is a direct soil reading, not an
    // atmospheric proxy. Precedence: sensor VWC > irrigationApplied > climate precip.
    try {
      const sd =
        global.GAIP_Sensor && typeof global.GAIP_Sensor.getIrrigationData === "function"
          ? global.GAIP_Sensor.getIrrigationData()
          : null;
      // Hydrosight/CSV shape returns vwc not irrigationApplied;
      // irrigationApplied is retained as fallback for future irrigation-logger sources.
      if (sd && sd.vwc != null) {
        moistureFlag = sd.vwc;
        log("pre-emergent", "moistureFlag from sensor VWC: " + sd.vwc);
      } else if (sd && sd.irrigationApplied != null) {
        moistureFlag = sd.irrigationApplied;
        log("pre-emergent", "moistureFlag from irrigationApplied: " + sd.irrigationApplied);
      }
    } catch (e) {
      /* ignore */
    }

    // ── Selected species (from schedule or site, else engine defaults) ─────
    const selectedSpecies = schedule.preEmergentSpecies || site.preEmergentSpecies || null;

    // ── Region ────────────────────────────────────────────────────────────
    // Region: use gaip_detectRegion (same fn used by TurfProfile) for proper SE Asia / tropical support
    let region = "au";
    try {
      const lat = parseFloat(document.querySelector(".gaip-lat")?.value);
      const lon = parseFloat(document.querySelector(".gaip-lon")?.value);
      if (!isNaN(lat) && !isNaN(lon) && typeof global.gaip_detectRegion === "function") {
        region = global.gaip_detectRegion(lat, lon);
      } else if (site.country === "NZ" || site.region === "nz") {
        region = "nz";
      }
    } catch (e) {
      if (site.country === "NZ" || site.region === "nz") region = "nz";
    }

    // Null guard: on site-switch the sensor bridge clears before Hydrosight re-fetches
    // and climate precip may also be null. Default to 0 (dry, conservative).
    if (moistureFlag == null) {
      moistureFlag = 0;
      log("pre-emergent", "moistureFlag null, defaulting to 0 (site-switch race or no precip data)");
    }

    return { soilTemp5cm, soilTempHistory, moistureFlag, selectedSpecies, region, soilTempSource };
  }

  /**
   * Build wear/recovery inputs with salinity and shade properly wired
   */
  function buildWearRecoveryInputs() {
    const climate = getAuthoritativeClimate();
    const shade = _hubState.computed.shade;
    const salinity = _hubState.computed.salinity;
    const stress = _hubState.computed.stress;
    const turf = _hubState.inputs.turf;
    const soil = _hubState.inputs.soil;
    const site = _hubState.inputs.site;
    // b35fix296: Fall back to DOM-read traffic if schedule is null.
    // gaip_read_wear_state (from wear-recovery-integration.js) reads
    // .gaip-matches-week, .gaip-sessions-week etc. directly from the form.
    let schedule = _hubState.inputs.schedule;
    let trafficData = schedule?.traffic || schedule;
    if (!trafficData && typeof global.gaip_read_wear_state === "function") {
      const domState = global.gaip_read_wear_state(document.getElementById("gaip-hub"));
      trafficData = domState?.traffic || null;
    }

    // Get construction - turf.construction is the primary source from the form
    const construction = turf?.construction || site?.construction || "native";

    // Get OM% - soil.LOI and soil.OM_pct are the same field
    const omPct = soil?.LOI || soil?.OM_pct || 0;

    // ─────────────────────────────────────────────────────────────────────
    // Build weather object for wear engine
    // ─────────────────────────────────────────────────────────────────────
    let weather = null;
    if (climate) {
      weather = {
        growthPotential: climate.growthPotential || calculateGrowthPotential(climate.temperature?.mean || 20, turf),
        soilMoisture: climate.soilMoisture?.mean || 40,
        temperature: climate.temperature?.mean || 20,
      };
    }

    // ─────────────────────────────────────────────────────────────────────
    // Build shade data for wear engine
    // ─────────────────────────────────────────────────────────────────────
    let shadeData = null;
    if (shade) {
      shadeData = {
        stressFactor: shade.stressFactor || 0,
        dli: shade.dli || null,
        deficitPct: shade.deficitPct || 0,
      };
    }

    // ─────────────────────────────────────────────────────────────────────
    // Build state object for wear engine
    // v1.5.0: Use identity enforcement - no fallbacks
    // ─────────────────────────────────────────────────────────────────────
    const canonicalTurf = GAIP_CANONICAL_STATE.turf || {};

    // Check if wear engine can run with current identity
    let wearCanRun = true;
    let wearRestrictions = [];
    if (global.GilbaIdentityEnforcement) {
      const wearCheck = global.GilbaIdentityEnforcement.canEngineRun("wear-recovery");
      wearCanRun = wearCheck.canRun;
      wearRestrictions = wearCheck.restrictions;
      if (!wearCanRun) {
        const isGolf = (turf?.turfType || "").toLowerCase() === "golf";
        if (isGolf) {
          log("wear", "Wear/traffic engine not applicable for golf profiles");
        } else {
          warn("wear", "Wear engine blocked by identity enforcement:", wearCheck.reason);
        }
      }
    }

    const wearState = {
      turf: {
        grassSpecies: canonicalTurf.effectiveSpeciesKey || canonicalTurf.speciesKey, // No fallback
        speciesKey: canonicalTurf.speciesKey,
        variety: turf?.variety || "generic",
        heightOfCut: turf?.heightOfCut || 25,
        rootDepth: turf?.rootDepth || 100,
        growthMultiplier: stress?.combinedGrowthModifier || 1.0,
        overseedStatus: turf?.overseedStatus || "none",
        construction: construction,
      },
      soil: {
        LOI: omPct,
        OM_pct: omPct,
      },
      site: {
        construction: construction,
        season: getCurrentSeason(),
        soilMoisture:
          climate?.soilMoisture?.mean > 80
            ? "wet"
            : climate?.soilMoisture?.mean > 60
              ? "moist"
              : climate?.soilMoisture?.mean < 25
                ? "dry"
                : "optimal",
      },
      shade: shadeData,
      // b35fix296: Engine reads state.traffic, not state.schedule
      traffic: trafficData,

      // ─────────────────────────────────────────────────────────────────
      // CRITICAL: Inject salinity penalty into recovery calculation
      // ─────────────────────────────────────────────────────────────────
      salinityPenalty: salinity
        ? {
            active: salinity.growthPenaltyPct > 0,
            growthModifier: salinity.relativeYieldPct / 100,
            penaltyPct: salinity.growthPenaltyPct,
            ecw: salinity.ecwInput,
          }
        : null,

      // ─────────────────────────────────────────────────────────────────
      // CRITICAL: Inject stress aggregates for compound effects
      // ─────────────────────────────────────────────────────────────────
      stressAggregates: stress,

      // v2.0.0: Pure function injection — month + variety traits
      monthIndex: new Date().getMonth(),
      _varietyTraits: global.GAIP_VarietyTraits || null,
    };

    return { state: wearState, weather: weather, shadeData: shadeData };
  }

  function getCurrentSeason() {
    const month = new Date().getMonth();
    const latInput = document.querySelector(".gaip-lat");
    const isSouthern = latInput && parseFloat(latInput.value) < 0;

    // Adjust for hemisphere
    const adjustedMonth = isSouthern ? (month + 6) % 12 : month;

    if (adjustedMonth >= 2 && adjustedMonth <= 4) return "spring";
    if (adjustedMonth >= 5 && adjustedMonth <= 7) return "summer";
    if (adjustedMonth >= 8 && adjustedMonth <= 10) return "autumn";
    return "winter";
  }

  // =========================================================================
  // ADJUSTED RECOVERY CALCULATION
  // =========================================================================

  /**
   * Calculate realistic recovery probability considering all stress factors
   * This replaces the "optimistic" calculation that ignores compound stress
   */
  function calculateAdjustedRecovery(baseRecovery) {
    const stress = _hubState.computed.stress;
    const salinity = _hubState.computed.salinity;
    const shade = _hubState.computed.shade;

    if (!baseRecovery) return null;

    let adjustedProbability = baseRecovery.probability || 80;
    let adjustedDays = baseRecovery.days || 14;
    const adjustments = [];

    // ─────────────────────────────────────────────────────────────────────
    // Apply salinity penalty to recovery
    // ─────────────────────────────────────────────────────────────────────
    if (salinity && salinity.growthPenaltyPct > 0) {
      const salinityMod = salinity.relativeYieldPct / 100;
      adjustedProbability *= salinityMod;
      adjustedDays /= salinityMod; // Takes longer to recover
      adjustments.push({
        factor: "salinity",
        modification: `${salinity.growthPenaltyPct}% yield reduction`,
        effect: `Recovery extended by ${((1 / salinityMod - 1) * 100).toFixed(0)}%`,
      });
    }

    // ─────────────────────────────────────────────────────────────────────
    // Apply shade penalty to recovery
    // ─────────────────────────────────────────────────────────────────────
    if (shade && shade.stressFactor > 0.1) {
      const shadeMod = 1 - shade.stressFactor * 0.4; // Up to 40% slower recovery
      adjustedProbability *= shadeMod;
      adjustedDays /= shadeMod;
      adjustments.push({
        factor: "shade",
        modification: `DLI deficit ${shade.deficitPct?.toFixed(0) || "?"}%`,
        effect: `Recovery extended by ${((1 / shadeMod - 1) * 100).toFixed(0)}%`,
      });
    }

    // ─────────────────────────────────────────────────────────────────────
    // Apply temperature stress to recovery
    // ─────────────────────────────────────────────────────────────────────
    if (stress && stress.combinedGrowthModifier < 0.8) {
      const tempMod = stress.combinedGrowthModifier;
      adjustedProbability *= tempMod;
      adjustedDays /= tempMod;
      adjustments.push({
        factor: "environmental_stress",
        modification: `ESI ${stress.environmentalStressIndex.toFixed(0)}/100`,
        effect: `Recovery extended by ${((1 / tempMod - 1) * 100).toFixed(0)}%`,
      });
    }

    // ─────────────────────────────────────────────────────────────────────
    // Store results
    // ─────────────────────────────────────────────────────────────────────
    const result = {
      baseProbability: baseRecovery.probability || 80,
      adjustedProbability: Math.max(10, Math.round(adjustedProbability)),
      baseDays: baseRecovery.days || 14,
      adjustedDays: Math.min(60, Math.round(adjustedDays)),
      adjustments: adjustments,
      isRealistic: adjustments.length > 0,
      warning: adjustedProbability < 50 ? "Recovery significantly compromised by compound stress factors" : null,
    };

    _hubState.derived.recoveryProbability = result.adjustedProbability;
    _hubState.derived.adjustedRecoveryDays = result.adjustedDays;

    log("recovery", "Adjusted recovery calculated", result);

    return result;
  }

  // =========================================================================
  // v1.7.0: BUILD PGR INPUTS — assembles pure state for gaip_pgr_calculate_pure
  // =========================================================================

  // =========================================================================
  // v1.11.0: SYNC PGR FORM ENTRY → SPRAY LOG
  //
  // When the PGR engine runs successfully with a valid applicationDate,
  // write that application to the spray log so it becomes the canonical
  // record. The spray log is then the single source of truth for PGR
  // history across sessions.
  //
  // Deduplication: skip if a PGR entry for the same site + date + product
  // already exists (prevents multiple "Run" clicks creating duplicate entries).
  //
  // This is fire-and-forget (async, no await at call site) so it never
  // blocks the PGR render or UI update.
  // =========================================================================

  async function syncPGRToSprayLog(pgrInput, pgrResult) {
    try {
      if (!global.GAIP_SprayLog) return;
      if (!pgrInput?.applicationDate || !pgrInput?.productType) return;

      const siteId =
        (global.GAIP_SiteContext ? global.GAIP_SiteContext.getSiteId() : (global.GAIP_SampleManager && global.GAIP_SampleManager.getActiveSiteId ? global.GAIP_SampleManager.getActiveSiteId() : null));
      if (!siteId) return;

      const zone = _hubState.inputs.turf?.zone || _hubState.inputs.turf?.turfType || "greens";

      // ── Deduplication check ──────────────────────────────────────────
      // Query last 7 days of PGR entries for this site.
      // If one already exists for the same date + product, skip.
      const existing = await GAIP_SprayLog.list({
        site_id: siteId,
        category: "pgr",
        date_from: pgrInput.applicationDate,
        date_to: pgrInput.applicationDate,
        limit: 10,
      });

      if (existing.success && existing.entries && existing.entries.length > 0) {
        const duplicate = existing.entries.find(
          (e) =>
            e.application_date === pgrInput.applicationDate &&
            (e.product_key === pgrInput.productType || e.active_ingredient === pgrResult?.product?.activeIngredient),
        );
        if (duplicate) {
          log("pgr", "Spray log sync: duplicate found, skipping", {
            date: pgrInput.applicationDate,
            product: pgrInput.productType,
          });
          return;
        }
      }

      // ── Build entry ──────────────────────────────────────────────────
      // Map product code to display name and active ingredient
      const PRODUCT_MAP = {
        TE250: { name: "Primo 250EC (Trinexapac-ethyl)", ai: "trinexapac-ethyl", defaultUnit: "L/ha" },
        TE175: { name: "Primo Maxx 1EC (Trinexapac-ethyl)", ai: "trinexapac-ethyl", defaultUnit: "L/ha" },
        TE120: { name: "Primo Maxx (Trinexapac-ethyl)", ai: "trinexapac-ethyl", defaultUnit: "L/ha" },
        PBZ200: { name: "Paclobutrazol 200SC", ai: "paclobutrazol", defaultUnit: "L/ha" },
        PB: { name: "Paclobutrazol", ai: "paclobutrazol", defaultUnit: "L/ha" },
        FP: { name: "Flurprimidol", ai: "flurprimidol", defaultUnit: "L/ha" },
        ANUEW: { name: "Anuew (Prohexadione-calcium)", ai: "prohexadione-calcium", defaultUnit: "g/ha" },
        ETH: { name: "Ethephon", ai: "ethephon", defaultUnit: "L/ha" },
      };

      const product = PRODUCT_MAP[pgrInput.productType] || {
        name: pgrResult?.product?.name || pgrInput.productType,
        ai: pgrResult?.product?.activeIngredient || "unknown",
        defaultUnit: "L/ha",
      };

      const entry = {
        site_id: siteId,
        application_date: pgrInput.applicationDate,
        product_name: product.name,
        product_key: pgrInput.productType,
        product_category: "pgr",
        active_ingredient: product.ai,
        rate: pgrInput.rateLPerHa || pgrInput.rate || null,
        rate_unit: pgrInput.rateUnit || product.defaultUnit,
        zone: zone,
        source: "hub_pgr_form",
        notes: pgrResult?.product?.name
          ? `Auto-logged from PGR form. GDD at run: ${pgrResult.gdd?.accumulated?.toFixed(0) || "n/a"}.`
          : "Auto-logged from PGR form.",
      };

      const result = await GAIP_SprayLog.create(entry);
      if (result.success || result.count > 0) {
        log("pgr", "Spray log sync: PGR application recorded", {
          date: entry.application_date,
          product: entry.product_name,
          site: siteId,
        });
        // v1.11.1: Notify spray log UI to reload — was missing, causing
        // the PGR entry to write to DB but never appear in the log table.
        document.dispatchEvent(
          new CustomEvent("gaip:spray-log-updated", {
            detail: { source: "pgr_sync", product: entry.product_key, date: entry.application_date },
          }),
        );
      } else {
        warn("pgr", "Spray log sync: write failed", result.error || result);
      }
    } catch (err) {
      // Never let spray log sync break the PGR render
      warn("pgr", "Spray log sync: exception (non-fatal)", err.message || err);
    }
  }

  // =========================================================================
  // syncDMIToSprayLog
  // v1.11.1: New function — writes a confirmed DMI application to the spray
  // log as category 'fungicide' so:
  //   1. The entry persists across page reloads (was previously in-memory only).
  //   2. The UV photolysis engine picks it up via lastFungicide on next cascade,
  //      enabling residual decay calculations for DMI fungicides.
  // Fire-and-forget — never blocks PGR/DMI render.
  // =========================================================================
  async function syncDMIToSprayLog(dmiInput, dmiStatus) {
    try {
      if (!global.GAIP_SprayLog) return;
      if (!dmiInput?.applicationDate || !dmiInput?.product) return;

      const siteId =
        (global.GAIP_SiteContext ? global.GAIP_SiteContext.getSiteId() : (global.GAIP_SampleManager && global.GAIP_SampleManager.getActiveSiteId ? global.GAIP_SampleManager.getActiveSiteId() : null));
      if (!siteId) return;

      const zone = _hubState.inputs.turf?.zone || _hubState.inputs.turf?.turfType || "greens";

      // ── Deduplication check ──────────────────────────────────────────
      const existing = await GAIP_SprayLog.list({
        site_id: siteId,
        category: "fungicide",
        date_from: dmiInput.applicationDate,
        date_to: dmiInput.applicationDate,
        limit: 10,
      });

      if (existing.success && existing.entries?.length > 0) {
        const duplicate = existing.entries.find(
          (e) =>
            e.application_date === dmiInput.applicationDate &&
            (e.product_key === dmiInput.product || e.active_ingredient === dmiStatus?.product?.activeIngredient),
        );
        if (duplicate) {
          log("dmi", "Spray log sync: DMI duplicate found, skipping", {
            date: dmiInput.applicationDate,
            product: dmiInput.product,
          });
          return;
        }
      }

      // ── Build entry ──────────────────────────────────────────────────
      // category MUST be 'fungicide' (not 'dmi') so spray-log-cascade.js
      // finds it as lastFungicide and passes it to the UV residual engine.
      const entry = {
        site_id: siteId,
        application_date: dmiInput.applicationDate,
        product_name: dmiStatus?.product?.name || dmiInput.product,
        product_key: dmiInput.product,
        product_category: "fungicide",
        active_ingredient: dmiStatus?.product?.activeIngredient || "unknown",
        rate: dmiInput.rateLperHa || null,
        rate_unit: "L/ha",
        zone: zone,
        source: "hub_dmi_form",
        notes: `Auto-logged from DMI form. Risk category: ${dmiStatus?.risk?.category || "n/a"}. Combined suppression warning: ${dmiStatus?.combinedRisk?.warningLevel || "none"}.`,
      };

      const result = await GAIP_SprayLog.create(entry);
      if (result.success || result.count > 0) {
        log("dmi", "Spray log sync: DMI application recorded", {
          date: entry.application_date,
          product: entry.product_name,
          site: siteId,
        });
        document.dispatchEvent(
          new CustomEvent("gaip:spray-log-updated", {
            detail: { source: "dmi_sync", product: entry.product_key, date: entry.application_date },
          }),
        );
      } else {
        warn("dmi", "Spray log sync: DMI write failed", result.error || result);
      }
    } catch (err) {
      // Never let DMI sync break the PGR/DMI render
      warn("dmi", "Spray log sync: DMI exception (non-fatal)", err.message || err);
    }
  }

  /**
   * Build the complete state object for the PGR pure function.
   * Assembles weatherData (merged historical+forecast), soilTempData,
   * and all context from _hubState so the PGR engine has zero global reads.
   */
  function buildPGRInputs() {
    const climate = getAuthoritativeClimate();
    const turf = _hubState.inputs.turf;
    const pgr = _hubState.inputs.pgr;
    const shade = _hubState.computed.shade;

    // ─────────────────────────────────────────────────────────────────────
    // 1. Assemble weatherData — merge historical + forecast into dailyData
    // ─────────────────────────────────────────────────────────────────────
    let weatherData = null;

    // Priority 1: GAIP_PGR_WEATHER_CACHE (pre-fetched historical merge)
    if (global.GAIP_PGR_WEATHER_CACHE && global.GAIP_PGR_WEATHER_CACHE.dailyData) {
      weatherData = {
        dailyData: global.GAIP_PGR_WEATHER_CACHE.dailyData,
        source: "cached_historical",
      };
      log("pgr", "Using GAIP_PGR_WEATHER_CACHE:", global.GAIP_PGR_WEATHER_CACHE.dailyData.length, "days");
    }
    // Priority 2: rawWeatherData with historical daily (from climate engine)
    else if (global.rawWeatherData && global.rawWeatherData.historical && global.rawWeatherData.historical.daily) {
      weatherData = {
        historical: global.rawWeatherData.historical,
        forecast: global.rawWeatherData.forecast || null,
        source: "raw_weather_historical",
      };
      log("pgr", "Using rawWeatherData.historical");
    }
    // Priority 3: rawWeatherData with forecast hourly
    else if (
      global.rawWeatherData &&
      (global.rawWeatherData.hourly || (global.rawWeatherData.forecast && global.rawWeatherData.forecast.hourly))
    ) {
      weatherData = {
        hourly: global.rawWeatherData.hourly || null,
        forecast: global.rawWeatherData.forecast || null,
        source: "raw_weather_forecast",
      };
      log("pgr", "Using rawWeatherData.hourly/forecast");
    }
    // Priority 4: rawWeatherData with daily
    else if (global.rawWeatherData && global.rawWeatherData.daily) {
      weatherData = {
        daily: global.rawWeatherData.daily,
        source: "raw_weather_daily",
      };
      log("pgr", "Using rawWeatherData.daily");
    }
    // Priority 5: Fallback to climate metrics average temp
    else if (climate && climate.temperature) {
      weatherData = {
        avgTemp: climate.temperature.mean || 20,
        source: "climate_mean_estimate",
      };
      log("pgr", "Fallback: using climate mean temp for GDD estimation");
    } else {
      warn("pgr", "No weather data available for PGR calculation");
    }

    // ─────────────────────────────────────────────────────────────────────
    // 2. Assemble soilTempData from sensor or climate
    // ─────────────────────────────────────────────────────────────────────
    let soilTempData = { soilTemp: null, source: null, depth: null };

    // Priority 1: Sensor data
    if (global.GAIP_Sensor && typeof global.GAIP_Sensor.hasData === "function" && global.GAIP_Sensor.hasData()) {
      try {
        const sensorData = global.GAIP_Sensor.getIrrigationData();
        if (sensorData && sensorData.soilTemp != null) {
          soilTempData = {
            soilTemp: sensorData.soilTemp,
            source: "sensor:" + (sensorData.source || "TDR"),
            depth: sensorData.measurementDepth || null,
          };
        }
      } catch (err) {
        warn("pgr", "Error reading sensor soil temp:", err);
      }
    }
    // Priority 2: Climate metrics soil temp
    if (soilTempData.soilTemp == null && global.climateMetrics?.temperature?.soil?.mean != null) {
      soilTempData = {
        soilTemp: global.climateMetrics.temperature.soil.mean,
        source: "climate:" + (global.climateMetrics.temperature.soil.source || "api"),
        depth: null,
      };
    }
    // Priority 3: Computed climate soil temp
    if (soilTempData.soilTemp == null && climate?.temperature?.soil?.mean != null) {
      soilTempData = {
        soilTemp: climate.temperature.soil.mean,
        source: "canonical_climate",
        depth: null,
      };
    }

    // ─────────────────────────────────────────────────────────────────────
    // 3. Assemble the complete state object for w_pure()
    // ─────────────────────────────────────────────────────────────────────
    const pgrState = {
      turf: turf || {},
      pgr: pgr || {},
      shade: shade
        ? {
            ambientDLI: shade.dli || shade.ambientDLI || null,
            dli: shade.dli || null,
            stressFactor: shade.stressFactor || 0,
          }
        : {},
      weatherData: weatherData,
      soilTempData: soilTempData,
    };

    // ─────────────────────────────────────────────────────────────────────
    // 4. Extract options (applicationDate, productType, etc.)
    // ─────────────────────────────────────────────────────────────────────
    const pgrOptions = {
      applicationDate: pgr?.applicationDate || null,
      productType: pgr?.productType || null,
      gddThreshold: pgr?.gddThreshold || null,
      mowingHeightMM: pgr?.mowingHeightMM || turf?.hoc || null,
    };

    log("pgr", "buildPGRInputs assembled", {
      hasWeatherData: !!weatherData,
      weatherSource: weatherData?.source || "none",
      hasSoilTemp: soilTempData.soilTemp != null,
      species: turf?.grassSpecies || "default",
      product: pgrOptions.productType || "TE250",
      appDate: pgrOptions.applicationDate || "today",
    });

    return { state: pgrState, options: pgrOptions };
  }

  // =========================================================================
  // v1.9.0: BUILD SALINITY INPUTS — assembles state for SalinityEnginePure
  // =========================================================================

  /**
   * Build the input object for the pure salinity engine.
   * Pulls ECw from water inputs, soilECe from soil, species from canonical
   * state, and temperature from the authoritative climate source.
   */
  function buildSalinityInputs() {
    const climate = getAuthoritativeClimate();
    const water = _hubState.inputs.water || {};
    const soil = _hubState.inputs.soil || {};
    const turf = _hubState.inputs.turf || {};
    const schedule = _hubState.inputs.schedule || {};

    // --- ECw: the required input ---
    const ecw = water.ecw || water.ec || 0;

    // --- Soil ECe ---
    // Prefer direct ECe if available, otherwise use soil state
    const soilECe = soil.ECe || soil.ece || null;
    const soilEC1_5 = soil.EC1_5 || soil.ec1_5 || null;
    const soilTexture = soil.soilTexture || soil.type || null;

    // --- Species resolution ---
    // Priority: canonical state > turf profile > fallback
    const speciesKey =
      GAIP_CANONICAL_STATE?.turf?.effectiveSpeciesKey || GAIP_CANONICAL_STATE?.turf?.speciesKey || null;
    const species = turf.grassSpecies || turf.species || null;

    // --- Grass type ---
    const grassType = turf.grassType || null;
    const c3Fraction = turf.c3Fraction || null;
    const c4Fraction = turf.c4Fraction || null;

    // --- Temperature from authoritative climate ---
    let temperature = null;
    if (climate) {
      if (climate.temperature && typeof climate.temperature.mean === "number") {
        temperature = climate.temperature.mean;
      } else if (typeof climate.airTemp === "number") {
        temperature = climate.airTemp;
      }
    }

    // --- ET0 from climate (optional, improves accumulation calc) ---
    let et0 = null;
    if (climate && climate.et0 && typeof climate.et0.daily === "number") {
      et0 = climate.et0.daily;
    } else if (climate && typeof climate.et0 === "number") {
      et0 = climate.et0;
    }

    // --- Irrigation depth (optional, for accumulation calc) ---
    const irrigationMM = schedule.dailyIrrigationMM || schedule.irrigationDepth || null;

    const inputs = {
      ecw,
      soilECe,
      soilEC1_5,
      soilTexture,
      speciesKey,
      species,
      grassType,
      c3Fraction,
      c4Fraction,
      temperature,
      et0,
      irrigationMM,
    };

    log("salinity", "buildSalinityInputs assembled", {
      ecw,
      soilECe,
      speciesKey: speciesKey || species || "generic",
      temperature,
      hasClimate: !!climate,
    });

    return inputs;
  }

  // =========================================================================
  // v1.8.0: BUILD IRRIGATION INPUTS — assembles state for schedule_pure
  // =========================================================================

  /**
   * Build the complete state + weatherData for the irrigation scheduler pure function.
   * Assembles turf, soil, water, irrigation config, sensor VWC, location,
   * and weather forecast into the shape schedule_pure() expects.
   */
  function buildIrrigationInputs() {
    const climate = getAuthoritativeClimate();
    const turf = _hubState.inputs.turf || {};
    const soil = _hubState.inputs.soil || {};
    const water = _hubState.inputs.water || {};
    const schedule = _hubState.inputs.schedule || {};
    const site = _hubState.inputs.site || {};
    const salinity = _hubState.computed.salinity;

    // ─────────────────────────────────────────────────────────────────────
    // 1. Build irrigation config from schedule/turf/site inputs
    // ─────────────────────────────────────────────────────────────────────

    // v1.8.1: Derive soil type from construction when soil data is null/empty
    let soilType = soil.soilTexture || soil.type || site.soilType || null;
    if (!soilType) {
      const constructionMap = {
        sand_profile: "sandProfile",
        sandProfile: "sandProfile",
        usga: "usga",
        sand_carpet: "sand",
        sandCarpet: "sand",
        push_up: "loam",
        pushUp: "loam",
        native: "sandyLoam",
        california: "sandProfile",
      };
      const construction = turf.construction || site.construction || "";
      soilType = constructionMap[construction] || "sandyLoam";
      log("irrigation", "Derived soilType from construction:", construction, "->", soilType);
    }

    const irrigationConfig = {
      strategy: schedule.irrigationStrategy || schedule.strategy || "moderate",
      precipRate: schedule.precipRate || schedule.sprinklerPrecipRate || null,
      uniformity: schedule.uniformity || null,
      efficiency: schedule.efficiency || null,
      rootDepth: turf.rootDepth || schedule.rootDepth || null,
      daysSinceIrrigation: schedule.daysSinceIrrigation || null,
      soilVWC: null, // populated below from sensor
      soil: {
        type: soilType,
        LOI: soil.LOI || soil.OM_pct || 0,
        OM_pct: soil.OM_pct || soil.LOI || 0,
        moisture: null, // populated below from sensor
      },
    };

    // ─────────────────────────────────────────────────────────────────────
    // 2. Sensor VWC if available
    // ─────────────────────────────────────────────────────────────────────
    if (global.GAIP_Sensor && typeof global.GAIP_Sensor.hasData === "function" && global.GAIP_Sensor.hasData()) {
      try {
        const sensorData = global.GAIP_Sensor.getIrrigationData();
        if (sensorData) {
          // getIrrigationData() returns .vwc, not .soilMoisture
          const sensorVWC = sensorData.vwc;
          if (sensorVWC != null) {
            irrigationConfig.soilVWC = sensorVWC;
            irrigationConfig.soil.moisture = sensorVWC;
          }
        }
      } catch (err) {
        warn("irrigation", "Error reading sensor VWC:", err);
      }
    }

    // ─────────────────────────────────────────────────────────────────────
    // 3. Build the state object for schedule_pure()
    // ─────────────────────────────────────────────────────────────────────

    // v1.8.1: Determine real overseed species.
    // TurfProfile sets coolOverseed = base species for pure C3 stands.
    // Only treat coolOverseed as overseed if warmBase exists (true overseed scenario).
    const baseSpecies = turf.grassSpecies || turf.species || "generic";
    let overseedSpecies = turf.overseedSpecies || null;
    if (!overseedSpecies && turf.warmBase && turf.coolOverseed) {
      // Real overseed: C4 warm base with C3 cool-season overseed
      overseedSpecies = turf.coolOverseed;
    }
    // If coolOverseed equals the base species, it's not a real overseed
    if (overseedSpecies && overseedSpecies === baseSpecies) {
      overseedSpecies = null;
    }

    const state = {
      turf: {
        grassSpecies: baseSpecies,
        variety: turf.variety || turf.cultivar || null,
        overseedSpecies: overseedSpecies,
        overseedVariety: overseedSpecies ? turf.overseedVariety || null : null,
        summerIntent: turf.overseedSummerIntent || turf.summerIntent || "transition",
        c3Fraction: turf.speciesFractions?.c3Fraction ?? turf.c3Fraction,
        percentC3Cover: turf.percentC3Cover,
        poaPercent: turf.poaPercent || 0,
        rootDepth: turf.rootDepth || null,
        turfType: turf.turfType || null,
        subCategory: turf.subCategory || null,
      },
      soil: {
        type: irrigationConfig.soil.type,
        LOI: irrigationConfig.soil.LOI,
        OM_pct: irrigationConfig.soil.OM_pct,
        ECe: soil.ECe || soil.ece || 0,
        moisture: irrigationConfig.soil.moisture,
      },
      water: {
        ecw: water.ecw || water.ECw || 0,
        ions: water.ions || {},
        recycledWater: !!(water.recycledWater),
      },
      irrigation: irrigationConfig,
      location: {
        lat:
          GAIP_CANONICAL_STATE?.climate?.lat || global.GAIP_STATE?.climate?.lat || global.GAIP_STATE?.turf?.lat || -33,
      },
    };

    // ─────────────────────────────────────────────────────────────────────
    // 4. Build weatherData for the forecast
    // ─────────────────────────────────────────────────────────────────────
    let weatherData = null;

    // Priority 1: rawWeatherData with forecast daily (Open-Meteo shape)
    if (global.rawWeatherData?.forecast?.daily) {
      weatherData = {
        forecast: { daily: global.rawWeatherData.forecast.daily },
        source: "raw_weather_forecast",
      };
      log("irrigation", "Using rawWeatherData.forecast.daily");
    }
    // Priority 2: rawWeatherData.daily (flat shape)
    else if (global.rawWeatherData?.daily) {
      weatherData = {
        daily: global.rawWeatherData.daily,
        source: "raw_weather_daily",
      };
      log("irrigation", "Using rawWeatherData.daily");
    }
    // Priority 3: Transform from climate engine hourly data
    else if (global.rawWeatherData?.forecast?.hourly || global.rawWeatherData?.hourly) {
      const hourly = global.rawWeatherData?.forecast?.hourly || global.rawWeatherData?.hourly;
      if (hourly && hourly.time && hourly.time.length > 0) {
        try {
          const hrsPerDay = 24;
          const numDays = Math.ceil(hourly.time.length / hrsPerDay);
          const dailyForecast = [];
          for (let j = 0; j < numDays; j++) {
            const start = j * hrsPerDay;
            const end = Math.min(start + hrsPerDay, hourly.time.length);
            const dateStr = hourly.time[start].split("T")[0];
            const temps = hourly.temperature_2m ? hourly.temperature_2m.slice(start, end) : [];
            const precipSlice = hourly.precipitation ? hourly.precipitation.slice(start, end) : [];
            const etSlice = hourly.et0_fao_evapotranspiration
              ? hourly.et0_fao_evapotranspiration.slice(start, end)
              : [];

            dailyForecast.push({
              date: dateStr,
              time: dateStr,
              tempMax: temps.length > 0 ? Math.max(...temps) : null,
              tempMin: temps.length > 0 ? Math.min(...temps) : null,
              precipitation: precipSlice.reduce((a, b) => a + (b || 0), 0),
              et0_fao_evapotranspiration: etSlice.reduce((a, b) => a + (b || 0), 0) || null,
              et0: etSlice.reduce((a, b) => a + (b || 0), 0) || null,
            });
          }
          weatherData = {
            forecast: { daily: dailyForecast },
            daily: dailyForecast,
            source: "hourly_aggregated",
          };
          log("irrigation", "Aggregated hourly to daily:", dailyForecast.length, "days");
        } catch (err) {
          warn("irrigation", "Error aggregating hourly data:", err);
        }
      }
    }
    // Priority 4: Climate engine computed metrics (fallback ET0 only)
    else if (climate && climate.temperature) {
      log("irrigation", "No forecast data available for irrigation schedule");
    }

    if (!weatherData) {
      warn("irrigation", "No weather data available for irrigation scheduling");
    }

    log("irrigation", "buildIrrigationInputs assembled", {
      species: state.turf.grassSpecies,
      soilType: state.soil.type,
      strategy: state.irrigation.strategy,
      hasWeather: !!weatherData,
      weatherSource: weatherData?.source || "none",
      hasSensorVWC: state.irrigation.soilVWC != null,
      ecw: state.water.ecw,
    });

    return { state, weatherData };
  }

  // =========================================================================
  // MAIN ORCHESTRATION FUNCTION
  // =========================================================================

  /**
   * Run full hub computation with proper sequencing
   * This is the main entry point for orchestrated execution
   */
  async function computeAll(inputs) {
    // Guard against re-entry (prevents infinite loop)
    if (_isComputingAll) {
      log("main", "computeAll already running, skipping");
      return _hubState.computed;
    }
    _isComputingAll = true;

    const startTime = Date.now();
    _hubState.computeSequence++;

    log("main", `Starting computation sequence #${_hubState.computeSequence}`);

    // ─────────────────────────────────────────────────────────────────────
    // 1. Refresh inputs from GAIP_STATE (always get latest values)
    // ─────────────────────────────────────────────────────────────────────
    if (global.GAIP_STATE) {
      _hubState.inputs = {
        climate: global.GAIP_STATE.climate || _hubState.inputs.climate,
        turf: global.GAIP_STATE.turf || _hubState.inputs.turf,
        soil: global.GAIP_STATE.soil || _hubState.inputs.soil,
        water: global.GAIP_STATE.water || _hubState.inputs.water,
        tissue: global.GAIP_STATE.tissue || _hubState.inputs.tissue,
        schedule: global.GAIP_STATE.schedule || _hubState.inputs.schedule,
        site: global.GAIP_STATE.site || _hubState.inputs.site,
        pgr: global.GAIP_STATE.pgr || _hubState.inputs.pgr, // v1.7.0: PGR inputs
      };
    }

    // Also merge any explicitly passed inputs
    if (inputs) {
      Object.assign(_hubState.inputs, inputs);
    }

    // ─────────────────────────────────────────────────────────────────────
    // 2. POPULATE CANONICAL STATE (single source of truth)
    // ─────────────────────────────────────────────────────────────────────
    log("main", "Step 1: Populating GAIP_CANONICAL_STATE");
    const canonicalState = populateCanonicalState(_hubState.inputs);

    // ─────────────────────────────────────────────────────────────────────
    // 3. CLIMATE (from canonical state)
    // ─────────────────────────────────────────────────────────────────────
    log("main", "Step 2: Climate");
    let climate = {};
    try {
      climate = getAuthoritativeClimate();
      _hubState.computed.climate = wrapWithConfidence("climate", climate);

      // Persist coordinates to GAIP_CANONICAL_STATE.
      // Ensures identity enrichment in populateCanonicalState finds coords
      // on orchestrator-only calls (daily dashboard, contradiction detector).
      if (climate && (climate.lat || climate.latitude)) {
        GAIP_CANONICAL_STATE.lat = climate.lat || climate.latitude;
        GAIP_CANONICAL_STATE.lon = climate.lon || climate.longitude;
      }
    } catch (e) {
      warn("climate", "Climate engine error, using empty fallback", e);
      _hubState.computed.climate = {};
    }

    // ─────────────────────────────────────────────────────────────────────
    // 3. DEW PREDICTION (depends on climate)
    // v2.0.0: Uses buildDewInputs() — no inline assembly
    // ─────────────────────────────────────────────────────────────────────
    log("main", "Step 2: Dew prediction");
    if (global.gaip_dew_prediction) {
      try {
        const { state: dewState, weather: weatherForDew } = buildDewInputs();
        const hasCloudData = !!weatherForDew?.forecast?.hourly?.cloud_cover;
        log(
          "dew",
          `Weather source: ${global.rawWeatherData ? "rawWeatherData" : "climate"}, hasCloudData: ${hasCloudData}`,
        );

        const dewResult = global.gaip_dew_prediction(dewState, weatherForDew);

        if (dewResult && dewResult.applicable) {
          _hubState.computed.dew = wrapWithConfidence("dew", {
            leafWetness: dewResult.leafWetness,
            forecast: dewResult.forecast,
            summary: dewResult.summary,
            matchForecast: dewResult.matchForecast,
            timestamp: dewResult.timestamp,
          });

          // Also publish to global for disease-integration.js consumption
          global.GAIP_DEW_RESULT = dewResult;

          log("dew", "Dew prediction computed", {
            totalWetHours: dewResult.leafWetness?.totalWetHours,
            averageWetHours: dewResult.leafWetness?.averageWetHours,
          });
        }
      } catch (e) {
        warn("dew", "Dew engine error", e);
      }
    }

    // ─────────────────────────────────────────────────────────────────────
    // 4. SHADE ANALYSIS (depends on climate, location)
    // v1.9.0: Uses buildShadeInputs() to inject all state, no globals needed
    // ─────────────────────────────────────────────────────────────────────
    log("main", "Step 3: Shade analysis");
    if (global.gaip_shade_engine && _hubState.inputs.turf) {
      try {
        const { state: shadeState, weather: weatherForShade } = buildShadeInputs();
        _hubState.computed.shade = wrapWithConfidence("shade", global.gaip_shade_engine(shadeState, weatherForShade));
      } catch (e) {
        warn("shade", "Shade engine error", e);
      }
    }

    // ─────────────────────────────────────────────────────────────────────
    // 5. SALINITY PENALTY (depends on water quality, turf profile, climate)
    // v1.9.0: Pure function path with climate integration
    // ─────────────────────────────────────────────────────────────────────
    log("main", "Step 4: Salinity penalty");
    console.log("[b35debug-diseaseRace] salinity gate check", {
      ecw: _hubState.inputs.water?.ecw,
      waterKeys: _hubState.inputs.water ? Object.keys(_hubState.inputs.water) : null,
      t: Date.now(),
    });
    if (_hubState.inputs.water?.ecw) {
      try {
        if (global.SalinityEnginePure) {
          const salInputs = buildSalinityInputs();
          if (salInputs.ecw > 0) {
            const salResult = global.SalinityEnginePure.analyse(salInputs);
            if (salResult && !salResult.error) {
              _hubState.computed.salinity = wrapWithConfidence("salinity", salResult);
              global.GAIP_SALINITY_RESULT = salResult;
              log("salinity", "SalinityEnginePure complete", {
                ecw: salResult.ecwInput,
                penalty: salResult.growthPenaltyPct + "%",
                yield: salResult.relativeYieldPct + "%",
                status: salResult.status,
                climateEnhanced: salResult.climateEnhanced,
              });
            }
          }
        }
        // Fallback to legacy
        else if (global.gaip_salinity_penalty) {
          log("salinity", "Falling back to legacy gaip_salinity_penalty");
          const salinitySpecies =
            GAIP_CANONICAL_STATE.turf?.effectiveSpeciesKey ||
            GAIP_CANONICAL_STATE.turf?.speciesKey ||
            "perennialRyegrass";
          _hubState.computed.salinity = wrapWithConfidence(
            "salinity",
            global.gaip_salinity_penalty(_hubState.inputs.water.ecw, salinitySpecies),
          );
          if (_hubState.computed.salinity) {
            global.GAIP_SALINITY_RESULT = _hubState.computed.salinity;
          }
        }
      } catch (e) {
        warn("salinity", "Salinity engine error", e);
      }
    }

    // ─────────────────────────────────────────────────────────────────────
    // 6. STRESS AGGREGATION (depends on 2,3,4)
    // ─────────────────────────────────────────────────────────────────────
    log("main", "Step 5: Stress aggregation");
    try {
      calculateStressAggregates();
    } catch (e) {
      warn("stress", "Stress aggregation error, downstream engines will use defaults", e);
    }

    // ─────────────────────────────────────────────────────────────────────
    // 7. DISEASE ANALYSIS (depends on climate, dew, shade, tissue)
    //    v1.1.0: Now applies stress/climate coupling to reduce false positives
    // ─────────────────────────────────────────────────────────────────────
    log("main", "Step 6: Disease analysis");
    let _diseaseFreshThisPass = false;
    if (global.DiseaseEngine || (global.GILBA_USE_PURE_DISEASE && global.DiseaseEnginePure)) {
      try {
        const diseaseInputs = buildDiseaseInputs();

        // Bail if climate temperature isn't available yet — weather fetch
        // still in flight. Running with null/default temps produces false
        // positives (e.g. Fusarium at 49%). NOTE: this checks temperature
        // only, not humidity — most models (Fusarium, BrownPatch,
        // Anthracnose, DrechsleraPoae) get their real moisture signal from
        // dewData.leafWetness (dew-prediction-engine), completely
        // independent of climate.moisture.humidity.mean, and compute
        // legitimate results even when that scalar is temporarily null. An
        // earlier version of this guard also gated on humidity and skipped
        // the entire block whenever it was missing — too broad: it would
        // have discarded valid Fusarium/BrownPatch/etc. results just
        // because one field only Red Thread actually needs was absent. See
        // the Red Thread-specific handling below instead.
        const _dxClimate = diseaseInputs.climate;
        const _dxHasTemp = !!(
          _dxClimate &&
          _dxClimate.temperature &&
          (_dxClimate.temperature.mean != null || _dxClimate.temperature.current != null)
        );

        if (!_dxHasTemp) {
          warn(
            "disease",
            "Skipping disease computeAll pass — climate temperature not yet available, keeping previous disease result rather than persisting a degraded read",
          );
        } else {
          const rawDiseaseResult = runDiseaseAnalysis(diseaseInputs);

          // v1.1.0: Apply stress/climate coupling to reduce false positives
          // Adjusts disease risk scores based on environmental stress state
          // (e.g., drought suppresses moisture-dependent pathogens)
          let coupledResult = rawDiseaseResult;
          if (global.GAIP_DiseaseStressCoupling) {
            const stressData = _hubState.computed.stress;
            const climateData = getAuthoritativeClimate();

            console.log("[b35debug-diseaseRace] pre-coupling state", {
              stressData: stressData ? {
                factorCount: stressData.factorCount,
                factors: (stressData.factors || []).map((f) => f.type),
                environmentalStressIndex: stressData.environmentalStressIndex,
                combinedGrowthModifier: stressData.combinedGrowthModifier,
              } : null,
              windowClimateMetricsExists: typeof global.climateMetrics !== "undefined" && !!global.climateMetrics,
              windowClimateMetricsGrowth: global.climateMetrics && global.climateMetrics.growth,
              t: Date.now(),
            });

            coupledResult = global.GAIP_DiseaseStressCoupling.apply(rawDiseaseResult, stressData, climateData, {
              species: diseaseInputs.species,
            });

            if (coupledResult.coupling && coupledResult.coupling.applied) {
              log("disease", "Stress/climate coupling applied:", {
                modified: coupledResult.coupling.modifications.length,
                suppressed: coupledResult.coupling.totalSuppression + "pp",
                amplified: coupledResult.coupling.totalAmplification + "pp",
              });
            }
          }

          // Red Thread has no leaf-wetness-hours fallback (unlike Fusarium/
          // BrownPatch/Anthracnose/DrechsleraPoae, which read dewData first —
          // see getLeafWetnessHours()) — its humidityFactor is computed
          // directly from climate.moisture.humidity.mean, with dewData only
          // multiplying that base factor, never replacing it. When humidity
          // is temporarily null this pass, Red Thread legitimately computes a
          // data-starved near-zero score. Rather than let that overwrite a
          // complete Red Thread reading from earlier this session, keep the
          // previous reading for just this one disease — every other disease
          // in this pass (which has a working fallback) still updates
          // normally.
          try {
            const _newRT = (coupledResult?.diseases || []).find((d) => d.disease === "redThread");
            const _rtHumidityMissing = _newRT && _newRT.drivers?.humidity?.value == null;
            if (_rtHumidityMissing) {
              const _prevRT = (_hubState.computed.disease?.diseases || []).find(
                (d) => d.disease === "redThread" && d.drivers?.humidity?.value != null,
              );
              if (_prevRT) {
                const _rtIdx = coupledResult.diseases.indexOf(_newRT);
                coupledResult.diseases[_rtIdx] = _prevRT;
                warn(
                  "disease",
                  `Red Thread: humidity unavailable this pass, keeping previous reading (${_prevRT.adjustedRisk}%) instead of a data-starved recompute (${_newRT.adjustedRisk}%)`,
                );

                // apply() already computed overallScore/topThreats (b35fix353b's
                // MAX-of-validated formula) using Red Thread's fresh, data-starved
                // value, BEFORE the swap above restored the previous reading — so
                // if Red Thread was the actual top disease, overallScore/topThreats
                // would silently still reflect the second-highest disease instead.
                // Recompute both here with the exact same formula
                // (disease-stress-climate-coupling.js's own post-coupling recompute
                // step), now that the array reflects the restored value.
                coupledResult.diseases.sort((a, b) => (b.adjustedRisk || 0) - (a.adjustedRisk || 0));
                const _validated = coupledResult.diseases.filter(
                  (d) =>
                    d.validationStatus !== "beta" &&
                    !(d.validationBadge && d.validationBadge.includes("BETA")) &&
                    d.disease !== "fusarium",
                );
                const _safeRisk = (d) => (typeof d.adjustedRisk === "number" && isFinite(d.adjustedRisk) ? d.adjustedRisk : 0);
                const _pool = _validated.length > 0 ? _validated : coupledResult.diseases;
                const _newOverall = _pool.length > 0 ? Math.max(..._pool.map(_safeRisk)) : 0;
                coupledResult.overallScore = _newOverall;
                if (global.DiseaseEnginePure?.utils?.classifyRisk) {
                  coupledResult.overallRisk = global.DiseaseEnginePure.utils.classifyRisk(_newOverall);
                }
                coupledResult.topThreats = _pool.slice(0, 3).map((d) => ({
                  disease: d.displayName,
                  risk: d.adjustedRisk,
                  level: d.riskLevel,
                  primaryDriver: d.primaryDriver || Object.keys(d.drivers || {})[0],
                  regionalMultiplier: d.regionalMultiplier,
                  nutrientNote: d.nutrientNote || null,
                  couplingNote: d.couplingNote || null,
                }));
              }
            }
          } catch (rtErr) {
            warn("disease", "Red Thread fallback-merge error (non-fatal)", rtErr);
          }

          _hubState.computed.disease = wrapWithConfidence("disease", coupledResult);
          _diseaseFreshThisPass = true;

          // Update global GAIP_DISEASE_RESULT so UI renders correct species
          if (_hubState.computed.disease) {
            _hubState.computed.disease._writtenAt = Date.now(); // recency stamp for dashboard freshness check
            // b35fix365 — writer-source tag. Two paths write GAIP_DISEASE_RESULT
            // (this one at line ~3822 = main disease block; another at ~4530 in
            // the cascade disease-engine case). When both fire on the same
            // computeAll, the second silently overwrites the first. Tag lets
            // a single production log distinguish which writer produced the
            // result the dashboard ultimately rendered.
            _hubState.computed.disease._writerTag = "b35fix365:writer1-mainBlock";
            global.GAIP_DISEASE_RESULT = _hubState.computed.disease;
            // Confirm disease result write for dashboard debugging
            warn(
              "disease",
              `[b35fix365 writer1-mainBlock] GAIP_DISEASE_RESULT written, species: "${_hubState.computed.disease.species || "none"}" diseases: ${(_hubState.computed.disease.diseases || []).length} topRisk: ${(_hubState.computed.disease.diseases || []).reduce((m, d) => Math.max(m, d.riskScore || d.adjustedRisk || 0), 0)}`,
            );
            document.dispatchEvent(
              new CustomEvent("gaip:disease-updated", { detail: { result: _hubState.computed.disease } }),
            );
          }
        }
      } catch (e) {
        warn("disease", "Disease engine error", e);
      }
    }

    // ─────────────────────────────────────────────────────────────────────
    // 7b. COMPANION SURFACE DISEASE (golf greens only)
    //     When a fairway/tee companion species is selected, run a parallel
    //     disease pass substituting that species. Same climate/dew/shade.
    //     Result in GAIP_COMPANION_DISEASE_RESULT — never touches
    //     GAIP_DISEASE_RESULT or the main greens cascade.
    // ─────────────────────────────────────────────────────────────────────
    try {
      const companionEl = document.getElementById("gaip-companion-species");
      let companionSpecies = companionEl ? companionEl.value : "";
      // Fallback: read from localStorage when DOM element not yet injected (e.g. iframe first run).
      // The selector is injected by daily-dashboard.js after orchestrator completes, so on the
      // first/only run in an iframe context the element doesn't exist yet.
      if (!companionSpecies) {
        try {
          const _cSiteId = global.GAIP_SiteContext ? global.GAIP_SiteContext.getSiteId() : null;
          if (_cSiteId) {
            const _cConfigs = JSON.parse(localStorage.getItem('gilba_hub_site_configs') || '{}');
            companionSpecies = (_cConfigs[_cSiteId] && _cConfigs[_cSiteId].turf && _cConfigs[_cSiteId].turf.companionSpecies) || '';
          }
        } catch (_) {}
      }
      if (companionSpecies) {
        const baseInputs = buildDiseaseInputs();
        const C4_SPECIES_MAP = {
          couch: { key: "couch", isC4: true, displayName: "Couch" },
          bermuda: { key: "bermuda", isC4: true, displayName: "Bermudagrass" },
          kikuyu: { key: "kikuyu", isC4: true, displayName: "Kikuyu" },
          zoysia: { key: "zoysia", isC4: true, displayName: "Zoysia" },
          buffalo: { key: "buffalo", isC4: true, displayName: "Buffalo" },
        };
        const companion = C4_SPECIES_MAP[companionSpecies];
        if (companion) {
          const companionInputs = Object.assign({}, baseInputs, {
            species: companion.key,
            speciesKey: companion.key,
            effectiveSpeciesKey: companion.key,
            isC4: companion.isC4,
            isOverseed: false,
            variety: null,
            tissueNutrients: null, // greens tissue doesn't apply to fairways
          });
          const companionResult = runDiseaseAnalysis(companionInputs);
          if (companionResult) {
            companionResult._companionSurface = true;
            companionResult._companionSpecies = companion.key;
            companionResult._companionDisplayName = companion.displayName;
          }
          global.GAIP_COMPANION_DISEASE_RESULT = companionResult;
          log("disease", "Companion surface disease computed: " + companion.displayName);
        }
      } else {
        global.GAIP_COMPANION_DISEASE_RESULT = null;
      }
    } catch (e) {
      warn("disease", "Companion surface disease error", e);
      global.GAIP_COMPANION_DISEASE_RESULT = null;
    }

    // ─────────────────────────────────────────────────────────────────────
    // 8. WEAR/RECOVERY (depends on shade, salinity, stress)
    // ─────────────────────────────────────────────────────────────────────
    log("main", "Step 7: Wear/recovery analysis");
    if (global.gaip_wear_recovery_engine) {
      try {
        const { state, weather, shadeData } = buildWearRecoveryInputs();
        const baseWearResult = global.gaip_wear_recovery_engine(
          state, // pure engine: first arg is full state (reads state.monthIndex directly)
          weather,
          shadeData,
        );

        // Apply adjusted recovery calculation
        if (baseWearResult && baseWearResult.recoveryCapacity) {
          baseWearResult.adjustedRecovery = calculateAdjustedRecovery(baseWearResult.recoveryCapacity);
        }

        // b35fix296: Only write if we have real traffic data, or no prior result exists.
        // Prevents overwriting a valid cascade/integration result with empty-schedule output.
        const priorWear = _hubState.computed.wear;
        const priorHasLoad = priorWear?.effectiveLoad?.totalEffectiveHours > 0;
        const newHasLoad = baseWearResult?.effectiveLoad?.totalEffectiveHours > 0;
        if (newHasLoad || !priorHasLoad) {
          _hubState.computed.wear = wrapWithConfidence("wear", baseWearResult);
        }

        // b35fix296: Render wear UI if the render function and container exist
        if (typeof global.gaip_render_wear_results === "function") {
          const wearContainer = document.querySelector(".gaip-wear-recovery-results");
          if (wearContainer && _hubState.computed.wear) {
            global.gaip_render_wear_results(_hubState.computed.wear, wearContainer);
          }
        }
      } catch (e) {
        warn("wear", "Wear/recovery engine error", e);
      }
    }

    // ─────────────────────────────────────────────────────────────────────
    // 9. STRESS TRAJECTORY (depends on climate, shade, wear, disease)
    // v1.0.0: Moved from legacy MutationObserver path onto orchestrator.
    //         buildStressTrajectoryInputs() assembles injected state; no
    //         globals read inside the engine during projection.
    // ─────────────────────────────────────────────────────────────────────
    log("main", "Step 8a: Stress trajectory");
    if (global.GAIP_StressTrajectory) {
      try {
        const { state: trajState, weather: trajWeather } = buildStressTrajectoryInputs();
        const trajResult = global.GAIP_StressTrajectory.project(
          trajState,
          trajWeather,
          { days: 14, startDate: new Date() }, // pure engine requires explicit startDate
        );
        if (trajResult) {
          // Inject metadata.species so the UI subtitle shows the actual species name
          if (!trajResult.metadata) trajResult.metadata = {};
          if (!trajResult.metadata.species) {
            const _canon = GAIP_CANONICAL_STATE.turf || {};
            trajResult.metadata.species = _canon.species || _canon.effectiveSpeciesKey || _canon.grassSpecies || "turf";
          }
          _hubState.computed.stressTrajectory = wrapWithConfidence("stressTrajectory", trajResult);
          // Publish to both legacy globals (integration.js reads GAIP_TRAJECTORY_RESULT)
          global.GAIP_TRAJECTORY_RESULT = trajResult;
          global.GAIP_STRESS_TRAJECTORY_RESULT = trajResult;
          log("stress-trajectory", "Stress trajectory computed", {
            currentScore: trajResult.summary?.currentScore,
            peakScore: trajResult.summary?.peakScore,
            trend: trajResult.summary?.trend,
            days: trajResult.trajectory?.length,
          });
        }
      } catch (e) {
        warn("stress-trajectory", "Stress trajectory engine error", e);
      }
    }

    // ─────────────────────────────────────────────────────────────────────
    // 8b. PRE-EMERGENT TIMING
    //     Uses soil temperature from climate engine (measured or modelled).
    //     Runs after stress trajectory so climate is guaranteed computed.
    //     GAIP_PreEmergent engine is a pure function — no globals consumed.
    // ─────────────────────────────────────────────────────────────────────
    log("main", "Step 8b: Pre-emergent timing");
    if (global.GAIP_PreEmergent) {
      try {
        const preEmInputs = buildPreEmergentInputs();
        if (preEmInputs.soilTemp5cm != null) {
          const _h = preEmInputs.soilTempHistory;
          console.log(
            "[PreEmergent] inputs, soilTemp5cm:",
            preEmInputs.soilTemp5cm,
            "historyLen:",
            _h.length,
            "historyRange:",
            _h.length > 1 ? _h[0].toFixed(1) + "→" + _h[_h.length - 1].toFixed(1) : "single point",
            "source:",
            preEmInputs.soilTempSource,
            "moisture:",
            preEmInputs.moistureFlag,
          );

          // b35fix225: Pre-emergent site-switch race guard.
          // On a site-switch, the orchestrator runs before Hydrosight has fetched
          // sensor data for the new site. buildPreEmergentInputs() falls through
          // to physics_model with a single-point history, producing a stale/wrong
          // result (e.g. 12°C physics vs 25°C sensor). If a prior result exists
          // from a sensor source and the current inputs are physics_model with
          // only 1 history point, hold the prior result and skip this run.
          // Hydrosight polling (30s) will trigger the next orchestrator run with
          // real sensor data, which will overwrite correctly.
          const _priorResult = global.GAIP_PRE_EMERGENT_RESULT;
          const _priorWasSensor = _priorResult && _priorResult.summary &&
            (_priorResult.summary.soilTempSource === 'sensor' ||
             _priorResult._soilTempSource === 'sensor');
          const _currentIsPhysicsSinglePoint =
            (preEmInputs.soilTempSource === 'physics_model' ||
             preEmInputs.soilTempSource === 'derived_from_air_temp' ||
             preEmInputs.soilTempSource === 'estimated' ||
             preEmInputs.soilTempSource === 'model' ||          // b35fix228: climate-engine-v2 stamps 'model'
             preEmInputs.soilTempSource === 'climate_engine' ||
             preEmInputs.soilTempSource === 'climate_temperature_soil' ||
             preEmInputs.soilTempSource === 'climateMetrics_global') &&
            _h.length <= 1;

          if (_priorWasSensor && _currentIsPhysicsSinglePoint) {
            log('pre-emergent',
              'Site-switch race guard: holding prior sensor result (source=' +
              _priorResult.summary.soilTempSource + '), current input is ' +
              preEmInputs.soilTempSource + ' single-point, awaiting sensor fetch');
            console.log('[PreEmergent] race guard, holding prior sensor result, skipping physics single-point');
          } else {
          const preEmResult = global.GAIP_PreEmergent.analyse(preEmInputs);
          // Stamp source so race guard can check it on next run
          preEmResult._soilTempSource = preEmInputs.soilTempSource;
          if (preEmResult.summary) preEmResult.summary.soilTempSource = preEmInputs.soilTempSource;
          _hubState.computed.preEmergent = wrapWithConfidence("preEmergent", preEmResult);
          global.GAIP_PRE_EMERGENT_RESULT = preEmResult;
          log("pre-emergent", "Pre-emergent timing computed", {
            aggregateStatus: preEmResult.aggregateStatus,
            soilTemp: preEmInputs.soilTemp5cm,
            soilTempSource: preEmInputs.soilTempSource,
            activeAlerts: preEmResult.summary?.activeAlerts,
            totalSpecies: preEmResult.summary?.totalSpecies,
          });
          } // end race guard else
        } else {
          log("pre-emergent", "Skipped, soilTemp5cm not available");
        }
      } catch (e) {
        warn("pre-emergent", "Pre-emergent engine error", e);
      }
    }

    // ─────────────────────────────────────────────────────────────────────
    // 9. DISEASE FORECAST (7-DAY)
    //    Single canonical forecast computation — mirrors "diseases today"
    //    (Step 6/buildDiseaseInputs): compute once here, persist via the
    //    existing analysis_cache flow, both /dashboard and /analysis read
    //    the same persisted value. Replaces the two previously-independent
    //    forecast implementations (legacy /hub path with synthetic weather,
    //    and disease-analysis.js's own live-fetch recompute).
    //    Only runs when Step 6 actually produced a fresh disease result
    //    this pass — if the temperature guard skipped Step 6, skip this
    //    too and keep the previous computed.forecast rather than deriving
    //    day0ActiveThreats from a stale/absent disease result.
    // ─────────────────────────────────────────────────────────────────────
    log("main", "Step 9: Disease forecast (7-day)");
    if (_diseaseFreshThisPass && global.DiseaseForecast && typeof global.DiseaseForecast.generateForecast === "function") {
      try {
        const fcInputs = buildDiseaseInputs(); // cheap, pure — re-derive rather than
                                                // reach into Step 6's block-scoped const

        // Real hourly forecast temps, already fetched this run (hub-tissue-v3.js's
        // gaip_fetch_weather -> climate-engine.js fetchForecastData, forecastDays
        // defaults to 16). No new fetch needed here.
        const _rawHourly = (global.rawWeatherData && global.rawWeatherData.forecast &&
          global.rawWeatherData.forecast.hourly) || (global.rawWeatherData && global.rawWeatherData.hourly) || null;
        const forecastHourly = _rawHourly ? { temperature_2m: _rawHourly.temperature_2m || [] } : null;

        // Copy (never mutate — getAuthoritativeClimate() can return a shared
        // reference) and strip the daily-pattern fields so generateForecast()'s
        // per-day fallback always derives real per-day min/max from
        // forecastHourly instead of a synthetic pattern.
        const climateForForecast = Object.assign({}, fcInputs.climate);
        if (climateForForecast.temperature) {
          climateForForecast.temperature = Object.assign({}, climateForForecast.temperature);
          delete climateForForecast.temperature.dailyPattern;
        }

        // Humidity fallback: this pass's climate.moisture.humidity can be
        // transiently null (the same race Step 6 protects Red Thread's "today"
        // reading against — see the merge-fallback above). Red Thread has no
        // leaf-wetness fallback, so a missing humidity.mean here doesn't just
        // degrade one day, it crashes every forecast day (period-mean humidity
        // is reused for all days below) to a data-starved near-zero. Fall back
        // to the mean of the real hourly RH array getAuthoritativeClimate()
        // already attaches (climateOut.hourlyData), mirroring what the old
        // analysis-page implementation did with its own Open-Meteo fetch.
        const _existingHumidity = climateForForecast.moisture && climateForForecast.moisture.humidity;
        let _fallbackHumidity = null;
        if (!_existingHumidity || _existingHumidity.mean == null) {
          const _rh = climateForForecast.hourlyData && climateForForecast.hourlyData.relative_humidity_2m;
          if (Array.isArray(_rh) && _rh.length > 0) {
            let _rhSum = 0, _rhCount = 0;
            for (const v of _rh) {
              if (v != null) { _rhSum += v; _rhCount++; }
            }
            if (_rhCount > 0) _fallbackHumidity = { mean: _rhSum / _rhCount };
          }
        }
        climateForForecast.moisture = Object.assign({}, climateForForecast.moisture || {}, {
          humidity: _existingHumidity && _existingHumidity.mean != null ? _existingHumidity : (_fallbackHumidity || _existingHumidity),
          dailyPattern: null,
        });

        const _diseaseDiseases = (_hubState.computed.disease && _hubState.computed.disease.diseases) || [];
        const day0ActiveThreats = {};
        for (const d of _diseaseDiseases) {
          if (d && d.disease) {
            const s = d.adjustedRisk != null ? Math.round(d.adjustedRisk)
                    : d.riskScore != null ? Math.round(d.riskScore) : 0;
            day0ActiveThreats[d.disease] = { score: s, displayName: d.displayName || d.name || d.disease };
          }
        }

        const forecastState = {
          climateMetrics: climateForForecast,
          turf: _hubState.inputs.turf || {},
          tissue: _hubState.computed.tissue || _hubState.inputs.tissue || null,
          nitrogenStatus: fcInputs.nitrogen,
          tissueNutrients: fcInputs.tissueNutrients,
          soilMetrics: fcInputs.soil,
          shadeMetrics: _hubState.computed.shade || null, // raw shape — generateForecast
                                                            // normalizes it internally
          wearMetrics: _hubState.computed.wear || null,
          varietyTraits: fcInputs.variety,
          mowingData: fcInputs.mowing,
          siteHistory: null, // no orchestrator-side equivalent yet; also always
                              // null in the prior analysis-page implementation
          stressAggregates: fcInputs.stressAggregates,
          cachedDiseaseSpecies: (_hubState.computed.disease && _hubState.computed.disease.species) || null,
          region: fcInputs.region,
          forecastHourly: forecastHourly,
          day0ActiveThreats: day0ActiveThreats,
        };

        const forecastResult = global.DiseaseForecast.generateForecast(forecastState);
        if (forecastResult && !forecastResult.error) {
          _hubState.computed.forecast = wrapWithConfidence("forecast", forecastResult);
          log("forecast", "7-day disease forecast computed", {
            topThreat: forecastResult.summary && forecastResult.summary.topThreat,
            peakRisk: forecastResult.summary && forecastResult.summary.peakRisk,
            peakDay: forecastResult.summary && forecastResult.summary.peakDay,
            diseases: (forecastResult.diseases || []).length,
          });
        } else {
          warn("forecast", "Disease forecast returned an error, keeping previous computed.forecast", forecastResult && forecastResult.error);
        }
      } catch (e) {
        warn("forecast", "Disease forecast engine error, keeping previous computed.forecast", e);
      }
    } else if (!_diseaseFreshThisPass) {
      log("forecast", "Skipped — disease result not refreshed this pass (temperature guard or engine unavailable), keeping previous computed.forecast");
    }

    // ─────────────────────────────────────────────────────────────────────
    // 10. IRRIGATION SCHEDULING (depends on climate, ET, salinity)
    // ─────────────────────────────────────────────────────────────────────
    log("main", "Step 8: Irrigation scheduling");
    // Irrigation scheduler would be called here with authoritative climate

    // ─────────────────────────────────────────────────────────────────────
    // 10. FINALIZE
    // ─────────────────────────────────────────────────────────────────────
    _hubState.lastComputed = new Date().toISOString();

    const duration = Date.now() - startTime;
    log("main", `Computation complete in ${duration}ms`);

    // v1.3.0: Calculate and attach confidence summary
    let confidenceSummary = null;
    if (global.GilbaEngineConfidence) {
      confidenceSummary = global.GilbaEngineConfidence.getConfidenceSummary(_hubState);
      _hubState.computed.confidence = confidenceSummary;

      // Log low confidence warnings
      if (confidenceSummary.hasLowConfidence) {
        warn(
          "confidence",
          `Analysis confidence is LOW (${confidenceSummary.score}%)`,
          confidenceSummary.warnings.filter((w) => w.level !== "info"),
        );
      }
      if (confidenceSummary.hasCriticalMissing) {
        warn(
          "confidence",
          "Critical inputs missing:",
          confidenceSummary.inputCompleteness.missing.filter((m) => m.importance === "critical"),
        );
      }
    }

    // Dispatch event for UI updates
    document.dispatchEvent(
      new CustomEvent("gaip:orchestrator-complete", {
        detail: { state: _hubState, duration: duration, confidence: confidenceSummary },
      }),
    );

    // Re-establish global aliases (hub-tissue-v3.js may have overwritten GAIP_STATE)
    global.GAIP_STATE = _hubState;
    global.__GAIP_STATE__ = _hubState;

    // b35fix237c: re-inject cached spray context after GAIP_STATE re-establishment.
    // hub-tissue's synchronous inject is wiped here, so we must repeat it.
    (function() {
      var _sc = global.GAIP_SprayCascade && typeof global.GAIP_SprayCascade.getCachedContext === 'function'
        ? global.GAIP_SprayCascade.getCachedContext() : null;
      if (_sc) _hubState.sprayContext = _sc;
    })();

    // Sync canonical species back to GAIP_STATE.turf for downstream consumers
    // (nutrition-calendar.js reads GAIP_STATE.turf.effectiveSpecies / grassSpecies)
    if (GAIP_CANONICAL_STATE.turf && _hubState.inputs?.turf) {
      const ct = GAIP_CANONICAL_STATE.turf;
      if (ct.effectiveSpeciesKey) {
        _hubState.inputs.turf.effectiveSpecies = ct.effectiveSpeciesKey;
      }
      if (ct.speciesKey) {
        _hubState.inputs.turf.grassSpecies = ct.speciesKey;
      }
      // Sync construction so soil temp widget (reads GAIP_STATE first) gets correct profile
      if (ct.construction) {
        _hubState.inputs.turf.construction = ct.construction;
      }
    }

    // Clear re-entry guard
    _isComputingAll = false;

    return _hubState;
  }

  // =========================================================================
  // INTEGRATION WITH EXISTING HUB
  // =========================================================================

  /**
   * Debounce timer for auto-compute
   */
  let _autoComputeTimer = null;
  const AUTO_COMPUTE_DELAY = 300; // ms
  let _isComputingAll = false; // Guard against re-entry
  let _orchestratorDeferredPending = false; // true when site-changed defers because site-config restore is still in flight
  // Ambient DLI captured synchronously at gaip:analysis-complete time — before any
  // subsequent site switch can overwrite global.GAIP_STATE.turf or gaip_currentAmbientDLI.
  let _lastAnalysisAmbientDLI = null;

  /**
   * Hook into existing hub state updates
   * This allows the orchestrator to work alongside the existing system
   */
  function initializeIntegration() {
    // ── State sync listener (gaip:hub-state-update) ───────────────────────
    // This fires multiple times per run (cascade + shade re-run + coupling),
    // so we ONLY use it to sync state into _hubState.inputs — NOT to trigger
    // computeAll. Triggering here causes the debounce to reset on every event
    // and computeAll never runs.
    document.addEventListener("gaip:hub-state-update", function (e) {
      if (_isComputingAll) return;
      const state = e.detail?.state || global.GAIP_STATE;
      if (state) {
        _hubState.inputs = {
          climate: state.climate || null,
          turf: state.turf || null,
          soil: state.soil || null,
          water: state.water || null,
          tissue: state.tissue || null,
          schedule: state.schedule || null,
          site: state.site || null,
          pgr: state.pgr || null, // v1.7.0
          // Include location so getAuthoritativeClimate() can
          // read lat/lon on GSSH pages where no saved site config exists
          location: state.location || state.site?.location || null,
        };
        if (state.climateMetrics) _hubState.computed.climate = state.climateMetrics;
        if (state.shadeMetrics) _hubState.computed.shade = state.shadeMetrics;
        if (state.wearMetrics) _hubState.computed.wear = state.wearMetrics;
        log("integration", "State synchronized from hub");
      }
    });

    // ── Compute trigger (gaip:analysis-complete) ──────────────────────────
    // Fires exactly ONCE per run, after the full cascade and all secondary
    // events (shade re-run, DiseaseStressCoupling) have settled.
    // This is the correct trigger point for computeAll.
    document.addEventListener("gaip:analysis-complete", function (e) {
      if (_isComputingAll) {
        log("integration", "computeAll already running, skipping trigger");
        return;
      }
      // Sync latest state in case hub-state-update hasn't fired yet
      const state = e.detail?.state || global.GAIP_STATE;
      if (state) {
        _hubState.inputs = {
          climate: state.climate || null,
          turf: state.turf || null,
          soil: state.soil || null,
          water: state.water || null,
          tissue: state.tissue || null,
          schedule: state.schedule || null,
          site: state.site || null,
          pgr: state.pgr || null, // v1.7.0
        };
        if (state.climateMetrics) _hubState.computed.climate = state.climateMetrics;
        if (state.shadeMetrics) _hubState.computed.shade = state.shadeMetrics;
        if (state.wearMetrics) _hubState.computed.wear = state.wearMetrics;
      }
      // b35fix240: Do NOT pre-set _weatherReadyFired here.
      // analysis-complete always arrives before gaip:weather-ready (hub-tissue
      // dispatches analysis-complete synchronously; weather fetch is async).
      // Pre-setting the flag caused the weather-ready handler to bail before
      // computeAll could run with live rawWeatherData, leaving _hubState.computed.dew
      // null every run and forcing the disease engine into the climate-fallback path
      // (fixed estimatedWetHours, leafWetHrs stuck at 6).
      // The weather-ready handler's own one-shot guard (_weatherReadyFired set inside
      // that handler) is sufficient to prevent double-runs.
      // Clear deferred-pending flag so a second gaip:site-config-applied
      // dispatch (e.g. from site-config-persistence init re-running on the shade hub)
      // doesn't trigger the safety-net computeAll after a clean analysis has completed.
      _orchestratorDeferredPending = false;
      // Capture ambientDLI synchronously now — before the setTimeout delay during which
      // site-switch-cleanup may clear gaip_currentAmbientDLI and a subsequent
      // gaip:hub-state-update can overwrite global.GAIP_STATE.turf.ambientDLI with a
      // different site's value. buildShadeInputs() reads _lastAnalysisAmbientDLI as its
      // first-priority source so the orchestrator shade engine sees the correct 19.4
      // rather than the stale 5.8 from a race-y site switch.
      {
        const _snap = e.detail?.state || global.GAIP_STATE;
        const _turfDLI = (_snap?.turf?.ambientDLI > 0) ? _snap.turf.ambientDLI : null;
        const _globalDLI = (global.gaip_currentAmbientDLI?.current > 0) ? global.gaip_currentAmbientDLI.current : null;
        _lastAnalysisAmbientDLI = _turfDLI || _globalDLI || null;
      }
      clearTimeout(_autoComputeTimer);
      _autoComputeTimer = setTimeout(() => {
        console.log("[Orchestrator] computeAll triggered");
        computeAll()
          .then((result) => {
            var traj = result && result.computed && result.computed.stressTrajectory;
            var preEm = result && result.computed && result.computed.preEmergent;
            console.log(
              "[Orchestrator] computeAll complete, trajectory:",
              traj ? "score=" + (traj.summary && traj.summary.currentScore) : "NOT COMPUTED",
            );
            console.log(
              "[Orchestrator] pre-emergent:",
              preEm
                ? "status=" + (preEm.aggregateStatus || (preEm.result && preEm.result.aggregateStatus))
                : "NOT COMPUTED",
            );
          })
          .catch((err) => {
            console.error("[Orchestrator] computeAll FAILED:", err);
          });
      }, AUTO_COMPUTE_DELAY);
    });

    // Re-run computeAll when user switches sites.
    // gaip:site-changed fires from sample-manager.js after the new site's
    // config has been applied. Without this listener all engine outputs
    // (disease, PGR, irrigation, stress trajectory) remained stale from
    // the previous site until a manual analysis re-run.
    document.addEventListener("gaip:site-changed", function () {
      log("integration", "gaip:site-changed, re-triggering computeAll for new site");

      // b35fix434 / C43: water-state clearance on site-switch.
      // Mirrors b35fix401 / C16 turf-identity clearance pattern. Three slots
      // bleed across site-switch because the hub-store inputs.water slot is
      // not site-scoped at the storage layer (C44, SaaS-port-target):
      //   1. window.GilbaHub.get('inputs.water') retains prior-site water
      //      with ions + pH + testDate even when ecw zeroed by some upstream.
      //   2. window.GAIP_PHYTOTOXICITY_RESULT and window.GAIP_SALINITY_RESULT
      //      are populated by ANY site's water engine run; no clear hook.
      //   3. DOM water metadata fields (.gaip-water-source-label / -lab-ref /
      //      -date) also bleed but are cleared by site-selector-ui.js
      //      clearWaterForm() which b35fix434 extends in parallel.
      // C43 closes the water symptom; C44 covers the structural defect.
      try {
        if (window.GilbaHub && typeof window.GilbaHub.set === 'function') {
          window.GilbaHub.set('inputs.water', null);
        }
      } catch (_e) {}
      try { window.GAIP_PHYTOTOXICITY_RESULT = null; } catch (_e) {}
      try { window.GAIP_SALINITY_RESULT = null; } catch (_e) {}

      clearTimeout(_autoComputeTimer);
      _autoComputeTimer = setTimeout(() => {
        // Guard against page-load config restore still in flight.
        // gaip:site-changed fires from hub-persistence restore at ~200ms.
        // site-config-applied doesn't dispatch until ~2400ms. Running computeAll
        // here hits a TIER 0 identity failure (speciesKey missing). Defer to
        // the site-config-applied listener below.
        if (window.GAIP_SITE_CONFIG_PENDING) {
          log("integration", "gaip:site-changed, config restore pending, deferring to site-config-applied");
          _orchestratorDeferredPending = true;
          return;
        }
        computeAll().catch((err) => {
          console.error("[Orchestrator] computeAll (site-changed) FAILED:", err);
        });
      }, 800); // longer delay than analysis-complete — site config restore may still be in flight
    });

    // Catch the orchestrator deferred run when page-load config restore completes.
    // When GAIP_SITE_CONFIG_PENDING caused the site-changed timer to bail, this fires
    // once site-config-applied dispatches and species/construction are restored.
    //
    // Timing: hub-tissue's site-config-applied listener fires btn.click() immediately,
    // analysis runs, and gaip:analysis-complete arrives ~300-500ms later — which already
    // triggers orchestrator computeAll via the analysis-complete handler above (setting
    // _weatherReadyFired and clearing _autoComputeTimer). So this listener's 800ms delay
    // means gaip:analysis-complete will almost always have fired first and set
    // _orchestratorDeferredPending = false before this setTimeout callback runs.
    // The flag ensures we don't double-fire if the page is slow and analysis-complete
    // arrives after 800ms.
    document.addEventListener("gaip:site-config-applied", function () {
      if (!_orchestratorDeferredPending) return;
      _orchestratorDeferredPending = false;
      if (_isComputingAll) {
        log("integration", "gaip:site-config-applied, computeAll already running, skipping deferred run");
        return;
      }
      clearTimeout(_autoComputeTimer);
      // 800ms: hub-tissue btn.click fires at ~0ms post-event, analysis runs ~300ms,
      // analysis-complete triggers our handler above. By 800ms that's done and
      // _weatherReadyFired is true, so this is a pure safety net for slow pages.
      _autoComputeTimer = setTimeout(() => {
        log(
          "integration",
          "gaip:site-config-applied, safety-net deferred computeAll (analysis-complete should have handled this)",
        );
        computeAll().catch((err) => {
          console.error("[Orchestrator] computeAll (site-config-applied safety) FAILED:", err);
        });
      }, 800);
    });

    // Re-trigger computeAll when real weather data arrives.
    // Handles cold-start race where the first computeAll fired before
    // weather fetch completed — disease engine skipped with guard, this
    // ensures it runs once real climate data is available.
    var _weatherReadyFired = false;
    document.addEventListener("gaip:weather-ready", function () {
      if (_weatherReadyFired) return; // only retry once per page load
      _weatherReadyFired = true;
      log("integration", "gaip:weather-ready, re-triggering computeAll for disease");
      clearTimeout(_autoComputeTimer);
      _autoComputeTimer = setTimeout(function _runWeatherReadyRetry(attemptsLeft) {
        // b35fix: computeAll() has its own _isComputingAll re-entrancy guard
        // that silently no-ops (log() is behind ORCHESTRATOR_CONFIG.debug) if
        // another computeAll is still mid-flight when this fires. Since
        // _weatherReadyFired is a one-shot latch, that silent no-op used to
        // permanently strand the disease/GP result on the pre-weather (or, on
        // a concurrent site-switch, stale-species) pass with no retry —
        // observed as disease risk numbers differing between reruns of the
        // same site/inputs depending on timing. Poll until computeAll is free
        // instead of firing once and giving up.
        if (_isComputingAll) {
          if (attemptsLeft > 0) {
            _autoComputeTimer = setTimeout(_runWeatherReadyRetry, 200, attemptsLeft - 1);
          } else {
            console.warn("[Orchestrator] weather-ready retry gave up waiting for computeAll to free up");
          }
          return;
        }
        computeAll().catch((err) => {
          console.error("[Orchestrator] computeAll (weather-ready retry) FAILED:", err);
        });
      }, 500, 25); // up to 500ms + 25*200ms = ~5.5s total wait
    });

    // Re-trigger computeAll when Hydrosight sensor data arrives after initial analysis.
    // Race: hub loads → analysis fires (gaip:analysis-complete) → Hydrosight fetch completes
    // 2-5 s later → soilTemp now available. Without this listener, pre-emergent stays on
    // physics_model despite a connected sensor.
    var _sensorSoilTempFired = false;
    document.addEventListener("gaip:sensor:updated", function () {
      if (_sensorSoilTempFired || _isComputingAll) return;
      try {
        // Resolve soil temp: try bridge first, then Hydrosight direct (bypasses mapping check)
        var _soilTemp = null;
        try {
          var _sd = global.GAIP_Sensor && typeof global.GAIP_Sensor.getIrrigationData === "function"
            ? global.GAIP_Sensor.getIrrigationData() : null;
          if (_sd && _sd.soilTemp != null) _soilTemp = _sd.soilTemp;
        } catch (e) { /* ignore */ }
        if (_soilTemp == null && global.GAIP_Hydrosight
            && typeof global.GAIP_Hydrosight.hasData === "function"
            && global.GAIP_Hydrosight.hasData()) {
          var _hsData = global.GAIP_Hydrosight.getIrrigationData();
          if (_hsData && _hsData.soilTemp != null) _soilTemp = _hsData.soilTemp;
        }
        if (_soilTemp == null) return;
        // Skip only if already using Hydrosight specifically.
        // If current source is "sensor" from TDR/CSV and Hydrosight just became ready,
        // we still want to re-run so the bridge can upgrade to the live reading.
        var _currentSrc = _hubState.computed.preEmergent &&
                          _hubState.computed.preEmergent.summary &&
                          _hubState.computed.preEmergent.summary.soilTempSource;
        var _hsNowReady = global.GAIP_Hydrosight
            && typeof global.GAIP_Hydrosight.hasData === "function"
            && global.GAIP_Hydrosight.hasData();
        if (_currentSrc === "sensor" && !_hsNowReady) return;
        _sensorSoilTempFired = true;
        log("pre-emergent", "Sensor soilTemp arrived (" + _soilTemp + "°C), re-running computeAll");
        clearTimeout(_autoComputeTimer);
        _autoComputeTimer = setTimeout(function () {
          computeAll().then(function () {
            document.dispatchEvent(new CustomEvent("gaip:sensor-upgrade-complete"));
          }).catch(function (err) {
            console.error("[Orchestrator] computeAll (sensor-updated) FAILED:", err);
          });
        }, 600);
      } catch (e) { /* ignore */ }
    });

    log("integration", "Integration hooks initialized");

    // ── GP dashboard loading state ────────────────────────────────────
    // The GP widget renders a placeholder ("Run analysis to see growth
    // data") before climate data arrives. Replace with a spinner.
    // Uses retry since the widget may not be in DOM when orchestrator inits.
    (function patchGPPlaceholder(retries) {
      const gpWidget = document.querySelector(".gaip-widget-growth .gaip-widget-content");
      if (!gpWidget) {
        if (retries > 0)
          setTimeout(function () {
            patchGPPlaceholder(retries - 1);
          }, 500);
        return;
      }
      const text = gpWidget.textContent || "";
      // Only patch if showing placeholder, not if already has a numeric value
      if (text.includes("Run analysis") || (text.trim().length > 0 && !/\d/.test(text.trim()))) {
        gpWidget.innerHTML =
          '<div style="text-align:center;padding:12px 0;color:var(--gaip-text-muted)">' +
          '<div style="display:inline-block;width:24px;height:24px;border:3px solid var(--gaip-border);' +
          'border-top-color:#22c55e;border-radius:50%;animation:gaip-spin 0.8s linear infinite"></div>' +
          '<div style="margin-top:6px;font-size:0.8em">Loading climate data...</div>' +
          "</div>";
        if (!document.getElementById("gaip-spin-style")) {
          var style = document.createElement("style");
          style.id = "gaip-spin-style";
          style.textContent = "@keyframes gaip-spin { to { transform: rotate(360deg) } }";
          document.head.appendChild(style);
        }
      }
    })(20);
  }

  // =========================================================================
  // SELECTIVE RECOMPUTATION (Dependency Graph Integration)
  // =========================================================================

  /**
   * Compute only the engines affected by specific input changes
   * Uses the dependency graph to determine what needs recomputation
   * @param {string[]} changedInputPaths - Array of input paths that changed (e.g., ['water.ecw', 'turf.species'])
   * @param {object} newInputValues - Optional new values to apply before recomputation
   * @returns {object} Updated hub state
   */
  async function computeSelective(changedInputPaths, newInputValues = null) {
    if (!global.GilbaDependencyGraph) {
      warn("selective", "Dependency graph not loaded, falling back to computeAll");
      return computeAll(newInputValues);
    }

    const startTime = Date.now();
    log("selective", "Starting selective recomputation", { changedInputPaths });

    // Apply new input values if provided
    if (newInputValues) {
      for (const [path, value] of Object.entries(newInputValues)) {
        applyInputChange(path, value);
      }
    }

    // Get affected engines in execution order
    const allAffected = new Set();
    for (const inputPath of changedInputPaths) {
      const affected = global.GilbaDependencyGraph.getAffectedEngines(inputPath);
      affected.forEach((e) => allAffected.add(e));
    }

    const executionOrder = global.GilbaDependencyGraph.topologicalSort(Array.from(allAffected));
    log("selective", "Engines to recompute", { count: executionOrder.length, engines: executionOrder });

    // Execute each affected engine
    for (const engineId of executionOrder) {
      await executeEngine(engineId);
    }

    // Update timestamps
    _hubState.lastComputed = new Date().toISOString();
    _hubState.computeSequence++;

    const duration = Date.now() - startTime;
    log("selective", `Selective recomputation complete in ${duration}ms`, {
      enginesRecomputed: executionOrder.length,
      totalEngines: Object.keys(ORCHESTRATOR_CONFIG.engineIdMap).length,
    });

    // Dispatch event
    document.dispatchEvent(
      new CustomEvent("gaip:selective-compute-complete", {
        detail: {
          state: _hubState,
          changedInputs: changedInputPaths,
          recomputedEngines: executionOrder,
          duration,
        },
      }),
    );

    return _hubState;
  }

  /**
   * Apply an input change to the hub state
   * @param {string} path - Dot notation path (e.g., 'water.ecw')
   * @param {*} value - New value
   */
  function applyInputChange(path, value) {
    const parts = path.split(".");
    let target = _hubState.inputs;

    for (let i = 0; i < parts.length - 1; i++) {
      const part = parts[i];
      if (!(part in target)) {
        target[part] = {};
      }
      target = target[part];
    }

    target[parts[parts.length - 1]] = value;
    log("selective", `Applied input change: ${path}`, { value });
  }

  /**
   * Execute a single engine by its full ID
   * @param {string} engineId - Full engine ID (e.g., 'disease-engine')
   */
  async function executeEngine(engineId) {
    log("engine", `Executing: ${engineId}`);

    try {
      switch (engineId) {
        case "climate-engine":
          _hubState.computed.climate = getAuthoritativeClimate();
          break;

        case "dew-prediction-engine":
          // v2.0.0: Uses buildDewInputs() — no inline assembly
          if (global.gaip_dew_prediction) {
            const { state: dwState, weather: dwWeather } = buildDewInputs();
            const dewResult = global.gaip_dew_prediction(dwState, dwWeather);
            if (dewResult && dewResult.applicable) {
              _hubState.computed.dew = {
                leafWetness: dewResult.leafWetness,
                forecast: dewResult.forecast,
                summary: dewResult.summary,
                matchForecast: dewResult.matchForecast,
                timestamp: dewResult.timestamp,
              };
              global.GAIP_DEW_RESULT = dewResult;
            }
          }
          break;

        case "shade-engine":
          // v1.9.0: Uses buildShadeInputs() to inject all state
          if (global.gaip_shade_engine && _hubState.inputs.turf) {
            const { state: shState, weather: shWeather } = buildShadeInputs();
            _hubState.computed.shade = global.gaip_shade_engine(shState, shWeather);
          }
          break;

        case "salinity-penalty-engine":
          // v1.9.0: Use pure function path with assembled state
          if (global.SalinityEnginePure && _hubState.inputs.water?.ecw) {
            const salInputs = buildSalinityInputs();
            if (salInputs.ecw > 0) {
              const salResult = global.SalinityEnginePure.analyse(salInputs);
              if (salResult && !salResult.error) {
                _hubState.computed.salinity = salResult;
                global.GAIP_SALINITY_RESULT = salResult;
                log("salinity", "SalinityEnginePure complete", {
                  ecw: salResult.ecwInput,
                  penalty: salResult.growthPenaltyPct + "%",
                  yield: salResult.relativeYieldPct + "%",
                  status: salResult.status,
                  climateEnhanced: salResult.climateEnhanced,
                  compoundSeverity: salResult.compoundStress?.severity || "n/a",
                });
              } else {
                warn("salinity", "SalinityEnginePure returned error:", salResult?.message);
              }
            }
          }
          // Fallback to legacy
          else if (global.gaip_salinity_penalty && _hubState.inputs.water?.ecw) {
            log("salinity", "Falling back to legacy gaip_salinity_penalty");
            const salinitySpecies =
              GAIP_CANONICAL_STATE.turf?.effectiveSpeciesKey ||
              GAIP_CANONICAL_STATE.turf?.speciesKey ||
              "perennialRyegrass";
            _hubState.computed.salinity = global.gaip_salinity_penalty(_hubState.inputs.water.ecw, salinitySpecies);
            if (_hubState.computed.salinity) {
              global.GAIP_SALINITY_RESULT = _hubState.computed.salinity;
            }
          }
          break;

        case "stress-aggregator":
          calculateStressAggregates();
          break;

        case "tissue-engine":
          // Tissue engine typically runs as part of MLSN flow
          if (global.gaip_tissue_engine && _hubState.inputs.tissue) {
            _hubState.computed.tissue = global.gaip_tissue_engine(_hubState.inputs.tissue, _hubState.inputs.turf);
          }
          break;

        case "disease-engine":
          if (global.DiseaseEngine || (global.GILBA_USE_PURE_DISEASE && global.DiseaseEnginePure)) {
            const diseaseInputs = buildDiseaseInputs();
            let recomputedDisease = runDiseaseAnalysis(diseaseInputs);
            // v1.1.0: Apply stress/climate coupling
            if (global.GAIP_DiseaseStressCoupling && _hubState.computed.stress) {
              recomputedDisease = global.GAIP_DiseaseStressCoupling.apply(
                recomputedDisease,
                _hubState.computed.stress,
                getAuthoritativeClimate(),
                { species: diseaseInputs.species },
              );
            }
            _hubState.computed.disease = recomputedDisease;
            // Update global for UI
            if (_hubState.computed.disease) {
              _hubState.computed.disease._writtenAt = Date.now(); // recency stamp
              // b35fix365 — writer-source tag. This is the SECOND writer
              // (cascade case). Previously silent — no log emission.
              // When the cascade fires this case AND the main disease block
              // (line ~3822) ran earlier in the same computeAll, the result
              // here overwrites that one. Whichever writer fires LAST
              // determines what the dashboard renders. Tagging both writers
              // and emitting a log line on each lets a single production log
              // localise the overwrite.
              _hubState.computed.disease._writerTag = "b35fix365:writer2-cascadeCase";
              global.GAIP_DISEASE_RESULT = _hubState.computed.disease;
              warn(
                "disease",
                `[b35fix365 writer2-cascadeCase] GAIP_DISEASE_RESULT written, species: "${_hubState.computed.disease.species || "none"}" diseases: ${(_hubState.computed.disease.diseases || []).length} topRisk: ${(_hubState.computed.disease.diseases || []).reduce((m, d) => Math.max(m, d.riskScore || d.adjustedRisk || 0), 0)} diseaseInputs.species: "${diseaseInputs.species || "none"}"`,
              );
            }
          }
          break;

        case "wear-recovery-engine":
          if (global.gaip_wear_recovery_engine) {
            const { state, weather, shadeData } = buildWearRecoveryInputs();
            const baseWearResult = global.gaip_wear_recovery_engine(
              state, // pure engine: first arg is full state
              weather,
              shadeData,
            );
            if (baseWearResult && baseWearResult.recoveryCapacity) {
              baseWearResult.adjustedRecovery = calculateAdjustedRecovery(baseWearResult.recoveryCapacity);
            }
            _hubState.computed.wear = baseWearResult;
          }
          break;

        case "irrigation-scheduler":
          // v1.8.0: Use pure function path with assembled state + weather
          if (global.gaip_irrigation_schedule_pure) {
            const irrInputs = buildIrrigationInputs();
            _hubState.computed.irrigation = global.gaip_irrigation_schedule_pure(
              irrInputs.state,
              irrInputs.weatherData,
              { currentDate: new Date() },
            );
            if (_hubState.computed.irrigation) {
              global.GAIP_IRRIGATION_RESULT = _hubState.computed.irrigation;
              if (_hubState.computed.irrigation.error) {
                warn("irrigation", "Irrigation schedule partial:", _hubState.computed.irrigation.error);
              } else {
                log("irrigation", "Irrigation schedule complete", {
                  events: _hubState.computed.irrigation.summary?.irrigationEvents,
                  totalET: _hubState.computed.irrigation.summary?.totalET,
                  status: _hubState.computed.irrigation.waterBalance?.status,
                  species: _hubState.computed.irrigation.species?.effective,
                });
              }
            }
          }
          // Fallback to legacy if pure not available
          else if (global.gaip_irrigation_scheduler) {
            log("irrigation", "Falling back to legacy gaip_irrigation_scheduler");
            _hubState.computed.irrigation = global.gaip_irrigation_scheduler(_hubState.inputs.turf);
            if (_hubState.computed.irrigation) {
              global.GAIP_IRRIGATION_RESULT = _hubState.computed.irrigation;
            }
          }
          break;

        case "pgr-module":
          // v1.7.1: Skip if no PGR product or application date configured
          const pgrInput = _hubState.inputs.pgr;
          if (!pgrInput || !pgrInput.productType || !pgrInput.applicationDate) {
            log("pgr", "No PGR configured, skipping");
            break;
          }
          // v1.7.0: Use pure function path with assembled state
          // b35fix218d: GSSH pages export gssh_pgr_calculate_pure; resolve whichever is present.
          var _pgr_pure_fn = global.gaip_pgr_calculate_pure || global.gssh_pgr_calculate_pure || null;
          if (_pgr_pure_fn) {
            const pgrInputs = buildPGRInputs();
            _hubState.computed.pgr = _pgr_pure_fn(pgrInputs.state, pgrInputs.options);
            if (_hubState.computed.pgr && _hubState.computed.pgr.success) {
              global.GAIP_PGR_RESULT = _hubState.computed.pgr;
              log("pgr", "PGR pure calculation complete", {
                gdd: _hubState.computed.pgr.gdd?.accumulated,
                threshold: _hubState.computed.pgr.gdd?.threshold,
                phase: _hubState.computed.pgr.effect?.phase,
                product: _hubState.computed.pgr.product?.name,
              });

              // v1.11.0: Sync PGR form entry to spray log (fire-and-forget)
              syncPGRToSprayLog(pgrInput, _hubState.computed.pgr);
              // Mirrors the hub-tissue-v3.js legacy path but for the pure-function
              // orchestrator route. Sets window.GAIP_DMI_RESULT and
              // window.GAIP_COMBINED_SUPPRESSION so word-export.js picks them up
              // regardless of which execution path ran PGR.
              // Research basis: Kahiu et al. 2025 (species-conditional phytotoxicity);
              // Mitkowski & Chaves 2013 (minimal DMI-alone clipping effect);
              // Kreuser/GreenKeeper (70%+ combined suppression risk).
              const dmiInput = _hubState.inputs.dmi;
              if (global.GAIP_DMI && dmiInput?.product && dmiInput?.applicationDate) {
                try {
                  const dmiStatus = global.GAIP_DMI.track(
                    {
                      product: dmiInput.product,
                      applicationDate: dmiInput.applicationDate,
                      rateLperHa: dmiInput.rateLperHa || 0,
                      species:
                        _hubState.inputs.turf?.grassSpecies || _hubState.inputs.turf?.species || "Perennial Ryegrass",
                    },
                    _hubState,
                  );

                  global.GAIP_DMI_RESULT = dmiStatus;

                  if (!dmiStatus.error) {
                    const pgrSuppression = _hubState.computed.pgr.effect?.suppression || 0;
                    const combinedRisk = global.GAIP_DMI.assessCombinedRisk(pgrSuppression, dmiStatus);
                    global.GAIP_COMBINED_SUPPRESSION = combinedRisk;

                    // Compute adjusted suppression incorporating DMI interaction.
                    // Adds adjustedSuppression to effect so pgr-ui.js can display
                    // the combined value alongside the PGR-only baseline.
                    // Source: Kreuser/GreenKeeper (70%+ danger), Kahiu 2025, Mitkowski 2013.
                    const adjSupp = global.GAIP_DMI.calcAdjustedSuppression
                      ? global.GAIP_DMI.calcAdjustedSuppression(pgrSuppression, combinedRisk)
                      : null;
                    if (adjSupp && adjSupp.addedPct > 0 && _hubState.computed.pgr.effect) {
                      _hubState.computed.pgr.effect.adjustedSuppression = adjSupp;
                      global.GAIP_PGR_RESULT.effect.adjustedSuppression = adjSupp;
                    }

                    // Attach to pgr result so daily-dashboard and any other
                    // consumer can read without touching globals
                    _hubState.computed.pgr.dmi = {
                      status: dmiStatus,
                      combinedRisk: combinedRisk,
                    };
                    global.GAIP_PGR_RESULT.dmi = _hubState.computed.pgr.dmi;

                    log("dmi", "DMI risk assessed", {
                      product: dmiStatus.product?.name,
                      warningLevel: combinedRisk.warningLevel,
                      pgrSuppression: Math.round(pgrSuppression * 100) + "%",
                      adjustedSuppressionPct: adjSupp?.adjustedPct,
                      isActive: dmiStatus.hasActiveApplication,
                    });
                    // v1.11.1: Persist DMI to spray log so it survives page reload
                    // and is visible to UV photolysis engine as lastFungicide.
                    syncDMIToSprayLog(dmiInput, dmiStatus);
                  }
                } catch (dmiErr) {
                  warn("dmi", "DMI risk assessment failed", dmiErr.message);
                }
              }
            } else {
              warn("pgr", "PGR calculation returned failure", _hubState.computed.pgr?.error);
            }
          }
          // Fallback to legacy if pure not available
          else if (global.gaip_pgr_module) {
            log("pgr", "Falling back to legacy gaip_pgr_module");
            const legacyState = {
              turf: _hubState.inputs.turf,
              pgr: _hubState.inputs.pgr,
              shade: _hubState.computed.shade,
            };
            _hubState.computed.pgr = global.gaip_pgr_module(legacyState, {});
            if (_hubState.computed.pgr) {
              global.GAIP_PGR_RESULT = _hubState.computed.pgr;

              // v1.11.0: Sync PGR form entry to spray log (fire-and-forget)
              syncPGRToSprayLog(pgrInput, _hubState.computed.pgr);

              // v1.10.0: DMI wiring — legacy PGR path
              const dmiInput = _hubState.inputs.dmi;
              if (global.GAIP_DMI && dmiInput?.product && dmiInput?.applicationDate) {
                try {
                  const dmiStatus = global.GAIP_DMI.track(
                    {
                      product: dmiInput.product,
                      applicationDate: dmiInput.applicationDate,
                      rateLperHa: dmiInput.rateLperHa || 0,
                      species:
                        _hubState.inputs.turf?.grassSpecies || _hubState.inputs.turf?.species || "Perennial Ryegrass",
                    },
                    _hubState,
                  );

                  global.GAIP_DMI_RESULT = dmiStatus;

                  if (!dmiStatus.error) {
                    const pgrSuppression = _hubState.computed.pgr?.effect?.suppression || 0;
                    const combinedRisk = global.GAIP_DMI.assessCombinedRisk(pgrSuppression, dmiStatus);
                    global.GAIP_COMBINED_SUPPRESSION = combinedRisk;

                    // Adjusted suppression (legacy path)
                    const adjSuppLegacy = global.GAIP_DMI.calcAdjustedSuppression
                      ? global.GAIP_DMI.calcAdjustedSuppression(pgrSuppression, combinedRisk)
                      : null;
                    if (adjSuppLegacy && adjSuppLegacy.addedPct > 0 && _hubState.computed.pgr.effect) {
                      _hubState.computed.pgr.effect.adjustedSuppression = adjSuppLegacy;
                      global.GAIP_PGR_RESULT.effect.adjustedSuppression = adjSuppLegacy;
                    }

                    _hubState.computed.pgr.dmi = {
                      status: dmiStatus,
                      combinedRisk: combinedRisk,
                    };
                    global.GAIP_PGR_RESULT.dmi = _hubState.computed.pgr.dmi;

                    log("dmi", "DMI risk assessed (legacy path)", {
                      product: dmiStatus.product?.name,
                      warningLevel: combinedRisk.warningLevel,
                      adjustedSuppressionPct: adjSuppLegacy?.adjustedPct,
                    });
                    // v1.11.1: Persist DMI to spray log (legacy path)
                    syncDMIToSprayLog(dmiInput, dmiStatus);
                  }
                } catch (dmiErr) {
                  warn("dmi", "DMI risk assessment failed (legacy path)", dmiErr.message);
                }
              }
            }
          }
          break;

        case "tissue-corrective-engine":
          // v1.9.0: Wire TissueCorrective into orchestrator.
          //
          // Context: TissueCorrectiveEngine_Pure has 207 passing tests and a clean
          // pure function interface, but until now ran only via a legacy document event
          // path (gaip:nutrition-calendar-generated -> setTimeout -> run()).
          //
          // The orchestrator call here covers the case where tissue data is present
          // but no calendar generation event has fired (e.g. direct API calls,
          // automated runs, future server-side rendering).
          //
          // The legacy event path in tissue-corrective-engine.js is NOT removed —
          // it handles the user-facing UI flow where the calendar DOM must be
          // rendered before corrections are overlaid. The two paths are complementary:
          //   - Orchestrator: populates computed.tissueCorrections for downstream engines
          //   - Legacy event: updates the UI overlay after calendar DOM renders
          if (global.TissueCorrectiveEngine_Pure && typeof global.TissueCorrectiveEngine_Pure.diagnose === "function") {
            const tissueData = _hubState.inputs.tissue;
            const calendarProgram =
              _hubState.computed.nutritionCalendar || global.GilbaNutritionCalendar?.program || null;

            if (tissueData && Object.keys(tissueData).length > 0 && calendarProgram) {
              try {
                const tcResult = global.TissueCorrectiveEngine_Pure.diagnose(
                  tissueData,
                  _hubState.inputs.soil,
                  _hubState.inputs.water,
                  calendarProgram,
                  { sampleDate: tissueData.sampleDate || new Date().toISOString() },
                );
                _hubState.computed.tissueCorrections = tcResult;
                global.GAIP_TISSUE_CORRECTIVE_RESULT = tcResult;
                log("tissue-corrective", "Pure engine complete", {
                  corrections: tcResult.corrections?.length ?? 0,
                  confidence: tcResult._meta?.confidence,
                });
                // Emit so UI can react without waiting for calendar event
                if (typeof document !== "undefined") {
                  document.dispatchEvent(
                    new CustomEvent("gaip:tissue-corrective-complete", {
                      detail: tcResult,
                    }),
                  );
                }
              } catch (tcErr) {
                warn("tissue-corrective", "Pure engine threw", tcErr);
              }
            } else {
              log("tissue-corrective", "Skipping, no tissue data or no calendar program");
            }
          } else {
            log("tissue-corrective", "TissueCorrectiveEngine_Pure not loaded, relying on legacy event path");
          }
          break;

        // PATCH v1.6.1: Removed dead 'stress-trajectory-engine' case.
        // Stress trajectory runs via integration path (MutationObserver),
        // not through computeAll(). The alias gaip_stress_trajectory pointed
        // to a non-existent .calculate method and never executed.

        default:
          log("engine", `No handler for engine: ${engineId}`);
      }
    } catch (e) {
      warn("engine", `Error executing ${engineId}`, e);
    }
  }

  /**
   * Compute a scenario in isolation without affecting global state
   * Returns a complete state snapshot for the modified inputs
   * @param {object} inputOverrides - Input values to override
   * @returns {object} Complete state snapshot with computed values
   */
  async function computeIsolated(inputOverrides) {
    if (!global.GilbaDependencyGraph) {
      warn("isolated", "Dependency graph not loaded");
      return null;
    }

    log("isolated", "Starting isolated computation", { overrides: Object.keys(inputOverrides) });

    // Deep clone current state
    const isolatedState = JSON.parse(JSON.stringify(_hubState));

    // Apply overrides
    for (const [path, value] of Object.entries(inputOverrides)) {
      const parts = path.split(".");
      let target = isolatedState.inputs;
      for (let i = 0; i < parts.length - 1; i++) {
        if (!(parts[i] in target)) target[parts[i]] = {};
        target = target[parts[i]];
      }
      target[parts[parts.length - 1]] = value;
    }

    // Determine which engines need recomputation
    const changedPaths = Object.keys(inputOverrides);
    const allAffected = new Set();
    for (const path of changedPaths) {
      const affected = global.GilbaDependencyGraph.getAffectedEngines(path);
      affected.forEach((e) => allAffected.add(e));
    }
    const executionOrder = global.GilbaDependencyGraph.topologicalSort(Array.from(allAffected));

    // Store original state reference
    const originalState = _hubState;

    // Temporarily swap to isolated state for engine execution
    _hubState = isolatedState;

    try {
      // Execute affected engines
      for (const engineId of executionOrder) {
        await executeEngine(engineId);
      }
    } finally {
      // Restore original state
      const result = JSON.parse(JSON.stringify(_hubState));
      _hubState = originalState;
      return result;
    }
  }

  /**
   * Get the dependency graph information for debugging/visualization
   * @returns {object} Dependency graph info
   */
  function getDependencyInfo() {
    if (!global.GilbaDependencyGraph) {
      return { available: false, reason: "Dependency graph not loaded" };
    }

    return {
      available: true,
      version: global.GilbaDependencyGraph.version,
      engineCount: global.GilbaDependencyGraph.getAllEngines().length,
      executionOrder: global.GilbaDependencyGraph.getFullExecutionOrder(),
      validation: global.GilbaDependencyGraph.validateGraph(),
      visualization: global.GilbaDependencyGraph.visualizeGraph(),
    };
  }

  // =========================================================================
  // EXPORTS
  // =========================================================================

  // Main orchestrator
  global.GaipOrchestrator = {
    version: ORCHESTRATOR_CONFIG.version,

    // Main computation
    computeAll: computeAll,

    // Selective/isolated computation (dependency graph integration)
    computeSelective: computeSelective,
    computeIsolated: computeIsolated,
    executeEngine: executeEngine,

    // State access
    getState: function () {
      return _hubState;
    },
    getComputed: function (key) {
      return key ? _hubState.computed[key] : _hubState.computed;
    },
    getDerived: function (key) {
      return key ? _hubState.derived[key] : _hubState.derived;
    },
    getInputs: function (key) {
      return key ? _hubState.inputs[key] : _hubState.inputs;
    },

    // Canonical state (single source of truth)
    getCanonicalState: function () {
      return GAIP_CANONICAL_STATE;
    },
    populateCanonicalState: populateCanonicalState,

    // Species helpers (v1.4.0) - use these instead of safeSpecies()
    getCanonicalSpecies: getCanonicalSpecies,
    hasValidSpecies: hasValidSpecies,

    // Individual computations
    getAuthoritativeClimate: getAuthoritativeClimate,
    calculateStressAggregates: calculateStressAggregates,
    buildDiseaseInputs: buildDiseaseInputs,
    buildDewInputs: buildDewInputs,
    runDiseaseAnalysis: runDiseaseAnalysis,
    buildWearRecoveryInputs: buildWearRecoveryInputs,
    buildPreEmergentInputs: buildPreEmergentInputs,
    calculateAdjustedRecovery: calculateAdjustedRecovery,

    // Dependency graph integration
    getDependencyInfo: getDependencyInfo,
    applyInputChange: applyInputChange,

    // Utilities
    isC4Species: isC4Species,
    calculateGrowthPotential: calculateGrowthPotential,
    getCurrentSeason: getCurrentSeason,
    detectRegion: detectRegion,

    // Deprecated - use getCanonicalSpecies() instead
    safeSpecies: safeSpecies,

    // Configuration
    getConfig: function () {
      return ORCHESTRATOR_CONFIG;
    },
  };

  // Initialize integration on load
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initializeIntegration);
  } else {
    initializeIntegration();
  }
})(typeof window !== "undefined" ? window : this);
