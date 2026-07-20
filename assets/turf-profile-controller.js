!(function () {
  "use strict";
  ((window.GaipTurfProfile = {
    version: "2.9.0",
    state: {
      turfType: null,
      subCategory: null,
      species: null,
      variety: null,
      construction: null,
      drainage: null,
      hoc: null,
      nProgram: null,
      overseedSpecies: null,
      overseedVariety: null,
    },
    getClimateZone: function () {
      const e = document.querySelector(".gaip-lat");
      if (!e) return "unknown";
      const t = parseFloat(e.value);
      if (isNaN(t)) return "unknown";
      const i = Math.abs(t);
      return i < 23.5
        ? "tropical"
        : i < 35
          ? "subtropical"
          : i < 45
            ? "warm_temperate"
            : i < 60
              ? "cool_temperate"
              : "cold";
    },
    isC4Viable: function () {
      const e = this.getClimateZone();
      return ["tropical", "subtropical", "warm_temperate"].includes(e);
    },
    isNorthernHemisphereCool: function () {
      const e = document.querySelector(".gaip-lat");
      if (!e) return !1;
      const t = parseFloat(e.value);
      return !isNaN(t) && t > 45;
    },
    getVarietyRegion: function () {
      const e = document.querySelector(".gaip-lat"),
        t = document.querySelector(".gaip-lon");
      if (e && t) {
        const i = parseFloat(e.value),
          a = parseFloat(t.value);
        if (
          !(isNaN(i) || isNaN(a) || (0 === i && 0 === a)) &&
          "function" == typeof window.gaip_detectRegion
        ) {
          const e = window.gaip_detectRegion(i, a);
          return (
            console.log(
              `[TurfProfile] Direct region detection: ${i}, ${a} -> ${e}`,
            ),
            this.mapRegionToVarietyDb(e)
          );
        }
      }
      if ("function" == typeof window.gaip_getCurrentRegion) {
        const e = window.gaip_getCurrentRegion();
        if (e && e.id) return this.mapRegionToVarietyDb(e.id);
      }
      return this.isNorthernHemisphereCool() ? "uk" : "ntep";
    },
    mapRegionToVarietyDb: function (e) {
      switch (e) {
        case "uk_ireland":
          return "uk";
        case "scandinavia":
          return "scandinavia";
        case "continental_europe":
        case "mediterranean":
          return "continental";
        case "germany":
          return "bsa";
        case "japan":
          return "japan";
        case "australia":
        case "australia_temperate":
        case "australia_subtropical":
        case "australia_tropical":
        case "australia_mediterranean":
          return "australia";
        case "new_zealand":
          return "new_zealand";
        default:
          return "ntep";
      }
    },
    getCurrentRegionInfo: function () {
      return "function" == typeof window.gaip_getRegionDisplayInfo
        ? window.gaip_getRegionDisplayInfo()
        : { name: "Unknown", dataSource: "Default" };
    },
    // Species data sourced from DB via window.GAIP_SpeciesData (output in db-shell layout before
    // all page scripts). Initialised at parse time so site-setup-wizard.js can read it immediately
    // without waiting for init(). init() re-assigns in case GAIP_SpeciesData loads late.
    speciesByType: (window.GAIP_SpeciesData && window.GAIP_SpeciesData.speciesByType) || {},
    getSpeciesOptions: function () {
      const e = this.state.turfType,
        t = this.state.subCategory,
        i = this.isC4Viable();
      let a;
      if ("golf" === e && t) a = this.speciesByType.golf && this.speciesByType.golf[t];
      else if ("sports" === e) a = this.speciesByType.sports;
      else {
        if ("lawns" !== e) return [];
        a = this.speciesByType.lawns;
      }
      if (!a) return [];
      // Get current region for filtering
      const r = this.getDetectedRegionId();
      // Filter function: include species if no regions specified OR if current region matches
      const filterByRegion = (species) => {
        if (!species.regions) return true;
        if (!r) return true; // If no region detected, show all
        return species.regions.includes(r);
      };
      const nzFairways = r === 'new_zealand' && e === 'golf' && t === 'fairways';
      let n = [];
      return (
        a.c3 && (n = n.concat(a.c3.filter(filterByRegion))),
        i && !nzFairways && a.c4 && (n = n.concat(a.c4.filter(filterByRegion))),
        n
      );
    },
    getDetectedRegionId: function () {
      const e = document.querySelector(".gaip-lat"),
        t = document.querySelector(".gaip-lon");
      if (e && t) {
        const i = parseFloat(e.value),
          a = parseFloat(t.value);
        if (!isNaN(i) && !isNaN(a) && !(0 === i && 0 === a) &&
            "function" == typeof window.gaip_detectRegion) {
          return window.gaip_detectRegion(i, a);
        }
      }
      return null;
    },
    // ─────────────────────────────────────────────────────────────────────────
    // VARIETY ROUTING
    //
    // Single source of truth for variety lookups.
    // Called by updateVarietyOptions with (species, region).
    //
    // Priority for each region:
    //   1. Dedicated regional getter function (gaip_getXxxVarieties)
    //   2. GAIP_VarietyTraits.buildVarietyOptions integration layer
    //   3. fallbackVarieties static list
    //   4. Generic-only fallback
    //
    // AU uses dedicated getter functions from gilba-variety-traits.js which
    // include climate suitability ratings. NZ and non-AU/NZ regions use
    // GAIP_VarietyTraits.buildVarietyOptions from variety-traits-integration.js.
    // ─────────────────────────────────────────────────────────────────────────

    // Resolve the correct getter function prefix at runtime.
    // turf-profile-controller.js is shared between GAIP and GSSH.
    // GAIP exposes gaip_getAustralianXxx; GSSH exposes gssh_getAustralianXxx.
    _getterPrefix: function() {
      if (typeof window.gaip_getAustralianCouchVarieties === 'function') return 'gaip_';
      if (typeof window.gssh_getAustralianCouchVarieties === 'function') return 'gssh_';
      return 'gaip_'; // fallback
    },

    // AU species → {getter function suffix, VARIETY_TRAITS key for ratings}
    _AU_SPECIES_MAP: {
      "Perennial Ryegrass":        { func: "getAustralianRyegrassVarieties",  traitsKey: "perennialRyegrass" },
      "Tall Fescue":               { func: "getAustralianTallFescueVarieties", traitsKey: "tallFescue" },
      "Creeping Bentgrass (Greens)":{ func: "getAustralianBentgrassVarieties", traitsKey: "bentgrass" },
      "Creeping Bentgrass":        { func: "getAustralianBentgrassVarieties", traitsKey: "bentgrass" },
      "Browntop Bent (Greens)":    { func: "getBrowntopBentVarieties",         traitsKey: "browntopBent" },
      "Couch":                     { func: "getAustralianCouchVarieties",      traitsKey: "couch" },    // b35fix152: was "bermuda" — VARIETY_TRAITS canonical key migrated to "couch"
      "Bermudagrass":              { func: "getAustralianCouchVarieties",      traitsKey: "couch" },
      "Kikuyu":                    { func: "getAustralianKikuyuVarieties",     traitsKey: "kikuyu" },
      "Buffalograss":              { func: "getAustralianBuffaloVarieties",    traitsKey: "buffalo" },
      "St. Augustine":             { func: "getAustralianBuffaloVarieties",    traitsKey: "buffalo" },
      "Seashore Paspalum":         { func: "getAustralianPaspalumVarieties",   traitsKey: "seashore_paspalum" },  // b35fix362
    },

    // Normalise species label to VARIETY_TRAITS camelCase key
    _speciesTraitsKey: function(species) {
      return species
        .replace(/\s*\(.*\)/, '')   // strip parenthetical e.g. "(Greens)"
        .replace(/\s+/g, '')        // remove spaces
        .replace(/^[A-Z]/, function(c) { return c.toLowerCase(); }); // lowerCamelCase
    },

    // Apply climate suitability ratings to a variety list
    _withRatings: function(list, traitsKey) {
      const vt = window.GAIP_VARIETY_TRAITS || window.GSSH_VARIETY_TRAITS;
      if (
        typeof window.gaip_getVarietyClimateSuitability !== "function" ||
        typeof vt !== "object"
      ) return list;
      return list.map(function(item) {
        if (item.value === "generic") return Object.assign({}, item, { rating: 0, ratingDesc: "" });
        const traits = vt[traitsKey]?.[item.value];
        if (traits) {
          const s = window.gaip_getVarietyClimateSuitability(traits);
          return Object.assign({}, item, { rating: s.rating, ratingDesc: s.description });
        }
        return Object.assign({}, item, { rating: 0, ratingDesc: "" });
      });
    },

    // Main variety getter — replaces getVarietiesForSpecies + getUKVarietiesForSpecies
    getVarietiesForRegion: function(species, region) {
      const self = this;

      // ── AU ──────────────────────────────────────────────────────────────────
      // Match on exact species name or partial (Couch/Bermuda/Buffalo/etc.)
      if (region === "australia") {
        // Try exact match first
        let entry = self._AU_SPECIES_MAP[species];
        // Partial match for species with variant labels
        if (!entry) {
          const keys = Object.keys(self._AU_SPECIES_MAP);
          for (let i = 0; i < keys.length; i++) {
            if (species.includes(keys[i]) || keys[i].includes(species)) {
              entry = self._AU_SPECIES_MAP[keys[i]];
              break;
            }
          }
        }
        if (entry && typeof window[self._getterPrefix() + entry.func] === "function") {
          return self._withRatings(window[self._getterPrefix() + entry.func](), entry.traitsKey);
        }
        // AU fallback: integration layer (handles Zoysia, Kentucky Bluegrass, etc.)
        if (window.GAIP_VarietyTraits && typeof window.GAIP_VarietyTraits.buildVarietyOptions === "function") {
          const opts = window.GAIP_VarietyTraits.buildVarietyOptions(self._speciesTraitsKey(species), region);
          if (opts && opts.length > 0) return opts;
        }
        return self.fallbackVarieties[species] || [{ value: "generic", label: "Generic / Unknown" }];
      }

      // ── NZ ──────────────────────────────────────────────────────────────────
      // NZ browntop uses BSPB data (NZ-bred cultivars trialled at STRI)
      if (region === "new_zealand") {
        if (
          (species === "Browntop Bent (Greens)" || species.includes("Browntop") || species.includes("Colonial")) &&
          typeof window.gaip_getUKBrowntopBentVarieties === "function"
        ) return window.gaip_getUKBrowntopBentVarieties();
        if (window.GAIP_VarietyTraits && typeof window.GAIP_VarietyTraits.buildVarietyOptions === "function") {
          const opts = window.GAIP_VarietyTraits.buildVarietyOptions(self._speciesTraitsKey(species), region);
          if (opts && opts.length > 0) return opts;
        }
        return self.fallbackVarieties[species] || [{ value: "generic", label: "Generic / Unknown" }];
      }

      // ── UK / BSPB ───────────────────────────────────────────────────────────
      if (region === "uk") {
        if (species === "Perennial Ryegrass" && typeof window.gaip_getUKRyegrassVarieties === "function")
          return window.gaip_getUKRyegrassVarieties();
        if ((species === "Creeping Bentgrass (Greens)" || species === "Creeping Bentgrass") && typeof window.gaip_getUKCreepingBentgrassVarieties === "function")
          return window.gaip_getUKCreepingBentgrassVarieties();
        if ((species === "Browntop Bent (Greens)" || species.includes("Browntop") || species.includes("Colonial")) && typeof window.gaip_getUKBrowntopBentVarieties === "function")
          return window.gaip_getUKBrowntopBentVarieties();
        if (["Couch", "Kikuyu", "Zoysia", "Buffalograss", "Bermuda"].some(function(w) { return species.includes(w); }))
          return [{ value: "generic", label: "Generic / Unknown (warm-season not typical for UK)", type: "generic" }];
        if (window.GAIP_VarietyTraits && typeof window.GAIP_VarietyTraits.buildVarietyOptions === "function") {
          const opts = window.GAIP_VarietyTraits.buildVarietyOptions(self._speciesTraitsKey(species), "bspb");
          if (opts && opts.length > 0) return opts;
        }
        return self.fallbackVarieties[species] || [{ value: "generic", label: "Generic / Unknown" }];
      }

      // ── SCANDINAVIA ─────────────────────────────────────────────────────────
      if (region === "scandinavia") {
        if (species === "Perennial Ryegrass" && typeof window.gaip_getScanturfRyegrassVarieties === "function")
          return window.gaip_getScanturfRyegrassVarieties();
        if ((species === "Creeping Bentgrass (Greens)" || species === "Creeping Bentgrass") && typeof window.gaip_getScanturfBentgrassVarieties === "function")
          return window.gaip_getScanturfBentgrassVarieties();
        if ((species === "Browntop Bent (Greens)" || species.includes("Browntop") || species.includes("Colonial")) && typeof window.gaip_getUKBrowntopBentVarieties === "function")
          return window.gaip_getUKBrowntopBentVarieties();
        if (species === "Kentucky Bluegrass" && typeof window.gaip_getScanturfBluegrassVarieties === "function")
          return window.gaip_getScanturfBluegrassVarieties();
        if (window.GAIP_VarietyTraits && typeof window.GAIP_VarietyTraits.buildVarietyOptions === "function") {
          const opts = window.GAIP_VarietyTraits.buildVarietyOptions(self._speciesTraitsKey(species), "scanturf");
          if (opts && opts.length > 0) return opts;
        }
        return self.fallbackVarieties[species] || [{ value: "generic", label: "Generic / Unknown" }];
      }

      // ── CONTINENTAL EUROPE (GEVES) ───────────────────────────────────────────
      if (region === "continental") {
        if (species === "Perennial Ryegrass" && typeof window.listGEVESVarieties === "function") {
          const vars = window.listGEVESVarieties("perennialRyegrass", true);
          if (vars && vars.length > 0) return vars.map(function(v) { return { value: v.name, label: v.displayName || v.name }; });
        }
        if (species === "Tall Fescue" && typeof window.listGEVESVarieties === "function") {
          const vars = window.listGEVESVarieties("tallFescue");
          if (vars && vars.length > 0) return vars.map(function(v) { return { value: v.name, label: v.displayName || v.name }; });
        }
        if ((species === "Creeping Bentgrass (Greens)" || species === "Creeping Bentgrass") && typeof window.gaip_getScanturfBentgrassVarieties === "function")
          return window.gaip_getScanturfBentgrassVarieties();
        if ((species === "Browntop Bent (Greens)" || species.includes("Browntop") || species.includes("Colonial")) && typeof window.gaip_getUKBrowntopBentVarieties === "function")
          return window.gaip_getUKBrowntopBentVarieties();
        if (species === "Kentucky Bluegrass")
          return self.fallbackVarieties[species] || [{ value: "generic", label: "Generic / Unknown" }];
        if (window.GAIP_VarietyTraits && typeof window.GAIP_VarietyTraits.buildVarietyOptions === "function") {
          const opts = window.GAIP_VarietyTraits.buildVarietyOptions(self._speciesTraitsKey(species), "geves");
          if (opts && opts.length > 0) return opts;
        }
        return self.fallbackVarieties[species] || [{ value: "generic", label: "Generic / Unknown" }];
      }

      // ── BSA (Germany) ────────────────────────────────────────────────────────
      if (region === "bsa") {
        if (species === "Perennial Ryegrass" && typeof window.gaip_getBSARyegrassVarieties === "function")
          return window.gaip_getBSARyegrassVarieties();
        if (
          (species === "Creeping Bentgrass (Greens)" || species === "Creeping Bentgrass" ||
           species === "Browntop Bent (Greens)" || species.includes("Browntop") || species.includes("Colonial")) &&
          typeof window.gaip_getBSABentgrassVarieties === "function"
        ) return window.gaip_getBSABentgrassVarieties();
        if (window.GAIP_VarietyTraits && typeof window.GAIP_VarietyTraits.buildVarietyOptions === "function") {
          const opts = window.GAIP_VarietyTraits.buildVarietyOptions(self._speciesTraitsKey(species), region);
          if (opts && opts.length > 0) return opts;
        }
        return self.fallbackVarieties[species] || [{ value: "generic", label: "Generic / Unknown" }];
      }

      // ── JAPAN ────────────────────────────────────────────────────────────────
      if (region === "japan") {
        if (typeof window.listJapanVarieties === "function") {
          const key = self._speciesTraitsKey(species);
          const vars = window.listJapanVarieties(key);
          if (vars && vars.length > 0) return vars.map(function(v) { return { value: v.name, label: v.displayName || v.name }; });
        }
        return self.fallbackVarieties[species] || [{ value: "generic", label: "Generic / Unknown" }];
      }

      // ── NTEP / DEFAULT ───────────────────────────────────────────────────────
      return self.fallbackVarieties[species] || [{ value: "generic", label: "Generic / Unknown" }];
    },

    // Legacy shim — kept for any external callers
    getVarietiesForSpecies: function(species) {
      return this.getVarietiesForRegion(species, "australia");
    },
    fallbackVarieties: {
      "Kentucky Bluegrass": [
        { value: "generic", label: "Generic / Unknown" },
        { value: "Midnight", label: "Midnight" },
        { value: "Baron", label: "Baron" },
        { value: "Bluechip Plus", label: "Bluechip Plus" },
      ],
      "Annual Bluegrass (Greens)": [
        { value: "generic", label: "Generic Poa annua" },
      ],
      "Annual Bluegrass (Fairway)": [
        { value: "generic", label: "Generic Poa annua" },
      ],
      Buffalograss: [
        { value: "generic", label: "Generic / Unknown" },
        { value: "Sir Walter", label: "Sir Walter DNA Certified" },
        { value: "Palmetto", label: "Palmetto" },
        { value: "Sapphire", label: "Sapphire" },
      ],
      Zoysia: [
        { value: "generic", label: "Generic / Unknown" },
        { value: "Empire", label: "Empire" },
        { value: "Nara", label: "Nara" },
        { value: "Leisureturf", label: "Leisureturf" },
      ],
    },
    thresholds: {
      sports: {
        dliMinimum: 18,
        dliOptimal: 28,
        mlsnContext: "sports",
        tissueContext: "sports",
        wearRecoveryActive: !0,
        hocDefault: 25,
        nProgramDefault: 250,
        description: "Sports Field",
      },
      golf: {
        greens: {
          dliMinimum: 10,
          dliOptimal: 20,
          mlsnContext: "greens",
          tissueContext: "greens_c3",
          wearRecoveryActive: !1,
          hocDefault: 3,
          nProgramDefault: 150,
          description: "Golf Greens",
        },
        fairways: {
          dliMinimum: 12,
          dliOptimal: 22,
          mlsnContext: "fairway",
          tissueContext: "fairway",
          wearRecoveryActive: !1,
          hocDefault: 15,
          nProgramDefault: 180,
          description: "Golf Fairways",
        },
        tees: {
          dliMinimum: 12,
          dliOptimal: 22,
          mlsnContext: "tees",
          tissueContext: "sports",
          wearRecoveryActive: !1,
          hocDefault: 12,
          nProgramDefault: 200,
          description: "Golf Tees",
        },
        surrounds: {
          dliMinimum: 12,
          dliOptimal: 20,
          mlsnContext: "landscape",
          tissueContext: "landscape",
          wearRecoveryActive: !1,
          hocDefault: 20,
          nProgramDefault: 120,
          description: "Golf Surrounds",
        },
      },
      lawns: {
        dliMinimum: 12,
        dliOptimal: 20,
        mlsnContext: "landscape",
        tissueContext: "landscape",
        wearRecoveryActive: !1,
        hocDefault: 35,
        nProgramDefault: 150,
        description: "Residential Lawn",
      },
    },
    speciesDLI: {
      bentgrass: { min: 10, target: 15, optimal: 20 },
      "Creeping Bentgrass": { min: 10, target: 15, optimal: 20 },
      "Creeping Bentgrass (Greens)": { min: 10, target: 15, optimal: 20 },
      browntopBent: { min: 8, target: 12, optimal: 18 },
      "Browntop Bent": { min: 8, target: 12, optimal: 18 },
      "Browntop Bent (Greens)": { min: 8, target: 12, optimal: 18 },
      "Colonial Bentgrass": { min: 8, target: 12, optimal: 18 },
      poa: { min: 8, target: 12, optimal: 16 },
      "Poa annua": { min: 8, target: 12, optimal: 16 },
      ryegrass: { min: 12, target: 18, optimal: 22 },
      "Perennial Ryegrass": { min: 12, target: 18, optimal: 22 },
      fescue: { min: 10, target: 14, optimal: 18 },
      "Tall Fescue": { min: 10, target: 14, optimal: 18 },
      "Fine Fescue": { min: 10, target: 14, optimal: 18 },
      "Kentucky Bluegrass": { min: 12, target: 17, optimal: 22 },
      couch: { min: 18, target: 24, optimal: 32 },
      Couch: { min: 18, target: 24, optimal: 32 },
      bermuda: { min: 18, target: 24, optimal: 32 },
      Bermudagrass: { min: 18, target: 24, optimal: 32 },
      kikuyu: { min: 16, target: 22, optimal: 28 },
      Kikuyu: { min: 16, target: 22, optimal: 28 },
      zoysia: { min: 12, target: 18, optimal: 24 },
      Zoysia: { min: 12, target: 18, optimal: 24 },
      "Zoysia (Greens)": { min: 12, target: 18, optimal: 24 },
      buffalo: { min: 10, target: 16, optimal: 22 },
      Buffalo: { min: 10, target: 16, optimal: 22 },
      Buffalograss: { min: 10, target: 16, optimal: 22 },
      paspalum: { min: 14, target: 20, optimal: 26 },
      "Seashore Paspalum": { min: 14, target: 20, optimal: 26 },
      default: { min: 14, target: 20, optimal: 26 },
    },
    bermudaGreensDLI: { min: 25, target: 30, optimal: 35 },
    bermudaGreensDLI_withPGR: { min: 20, target: 25, optimal: 30 },
    constructionByType: {
      sports: [
        { value: "sand_carpet", label: "Sand carpet" },
        { value: "sand_profile", label: "Sand profile (USGA-style)" },
        { value: "pipe_drained", label: "Pipe drained + slit drained" },
        { value: "soil", label: "Soil field" },
        { value: "hybrid", label: "Hybrid reinforced" },
      ],
      golf: {
        greens: [
          { value: "sand_profile", label: "USGA sand profile" },
          { value: "california", label: "California profile" },
          { value: "push_up", label: "Push-up native" },
        ],
        fairways: [
          { value: "native", label: "Native soil" },
          { value: "sand_capped", label: "Sand capped" },
          { value: "pipe_drained", label: "Pipe drained" },
        ],
        tees: [
          { value: "sand_profile", label: "Sand profile" },
          { value: "native", label: "Native soil" },
          { value: "sand_capped", label: "Sand capped" },
        ],
        surrounds: [
          { value: "native", label: "Native soil" },
          { value: "sand_capped", label: "Sand capped" },
        ],
      },
      lawns: [
        { value: "native", label: "Native soil" },
        { value: "imported", label: "Imported topsoil" },
        { value: "sandy_loam", label: "Sandy loam blend" },
      ],
    },
    STORAGE_KEY: "gilba_turf_profiles",
    profileLoadedFromSaved: false,
    _isLoadingProfile: false,
    init: function () {
      this.speciesByType = (window.GAIP_SpeciesData && window.GAIP_SpeciesData.speciesByType) || {};
      (console.log("[TurfProfile] Initializing v" + this.version),
        this.cacheElements(),
        this.bindEvents(),
        this.loadLastProfile(),
        console.log("[TurfProfile] Ready"));
    },
    cacheElements: function () {
      this.elements = {
        turfTypeOptions: document.querySelectorAll(".gaip-turf-type-option"),
        golfSubcategory: document.getElementById("gaip-golf-subcategory"),
        sportsSubcategory: document.getElementById("gaip-sports-subcategory"),
        subcategoryOptions: document.querySelectorAll(
          ".gaip-subcategory-option",
        ),
        speciesSelect:
          document.getElementById("gaip-species-select") ||
          document.querySelector(".gaip-species"),
        varietySelect:
          document.getElementById("gaip-variety-select") ||
          document.querySelector(".gaip-variety"),
        constructionSelect: document.querySelector(".gaip-construction"),
        drainageSelect: document.querySelector(".gaip-drainage"),
        hocInput: document.querySelector(".gaip-hoc"),
        nProgramInput: document.querySelector(".gaip-n-program"),
        overseedSection: document.querySelector(".gaip-overseed-section"),
        overseedSpecies: document.querySelector(".gaip-cool-overseed"),
        overseedVariety: document.querySelector(".gaip-overseed-variety"),
        poaSection: document.querySelector(".gaip-poa-section"),
        stratifiedOM: document.querySelector(".gaip-stratified-om-section"),
        trafficCard:
          document.querySelector('[data-card="traffic"]') ||
          document.querySelector(".gaip-card:has(.gaip-enable-turf-traffic)"),
        profileSelect: document.getElementById("gaip-profile-select"),
        saveProfileBtn: document.getElementById("gaip-save-profile"),
        deleteProfileBtn: document.getElementById("gaip-delete-profile"),
      };
    },
    bindEvents: function () {
      const e = this;
      (this.elements.turfTypeOptions.forEach((t) => {
        t.addEventListener("click", function () {
          e.selectTurfType(this.dataset.type);
        });
      }),
        this.elements.subcategoryOptions.forEach((t) => {
          t.addEventListener("click", function () {
            const t = this.dataset.surface || this.dataset.sport;
            e.selectSubCategory(t);
          });
        }),
        this.elements.speciesSelect &&
          this.elements.speciesSelect.addEventListener("change", function () {
            e.selectSpecies(this.value);
          }),
        this.elements.varietySelect &&
          this.elements.varietySelect.addEventListener("change", function () {
            e.selectVariety(this.value);
          }),
        this.elements.constructionSelect &&
          this.elements.constructionSelect.addEventListener(
            "change",
            function () {
              ((e.state.construction = this.value), e.dispatchStateChange());
            },
          ),
        this.elements.drainageSelect &&
          this.elements.drainageSelect.addEventListener("change", function () {
            ((e.state.drainage = this.value), e.dispatchStateChange());
          }),
        this.elements.hocInput &&
          this.elements.hocInput.addEventListener("input", function () {
            // b35fix312_1: mark as user-set so applyDefaults stops overwriting.
            // Using "input" not "change" so it fires on every keystroke — the
            // user might type a value and immediately click a species option,
            // and "change" doesn't fire until blur which would be too late.
            this.dataset.userSet = "true";
            ((e.state.hoc = parseFloat(this.value)), e.dispatchStateChange());
          }),
        this.elements.nProgramInput &&
          this.elements.nProgramInput.addEventListener("input", function () {
            // b35fix312_1: see HoC note above.
            this.dataset.userSet = "true";
            ((e.state.nProgram = parseFloat(this.value)),
              e.dispatchStateChange());
          }),
        this.elements.profileSelect &&
          this.elements.profileSelect.addEventListener("change", function () {
            this.value && e.loadProfile(this.value);
          }),
        this.elements.saveProfileBtn &&
          this.elements.saveProfileBtn.addEventListener("click", function () {
            e.saveCurrentProfile();
          }),
        this.elements.deleteProfileBtn &&
          this.elements.deleteProfileBtn.addEventListener("click", function () {
            e.deleteCurrentProfile();
          }));
      const t = document.querySelector(".gaip-pgr-product");
      t &&
        t.addEventListener("change", function () {
          const t = e.state.species || "",
            i =
              t.toLowerCase().includes("couch") ||
              t.toLowerCase().includes("bermuda"),
            a = "golf" === e.state.turfType && "greens" === e.state.subCategory;
          i &&
            a &&
            (console.log(
              "[TurfProfile] PGR changed for bermuda greens, updating DLI thresholds",
            ),
            e.dispatchStateChange(),
            e.updateContextIndicators());
        });
      const i = document.querySelector(".gaip-lat");
      (i &&
        i.addEventListener("change", function () {
          if (e._isLoadingProfile) {
            console.log("[TurfProfile] Location changed during profile load, skipping species rebuild");
            return;
          }
          (console.log(
            "[TurfProfile] Location changed, updating species options",
          ),
            e.updateSpeciesOptions());
        }),
        "undefined" != typeof jQuery &&
          jQuery(document).on("click", ".gaip-location-result", function () {
            setTimeout(function () {
              (console.log(
                "[TurfProfile] Location selected, updating species options",
              ),
                e.updateSpeciesOptions());
            }, 100);
          }));
    },
    selectTurfType: function (e) {
      (console.log("[TurfProfile] Selecting turf type:", e),
        (this.state.turfType = e),
        (this.state.subCategory = null),
        this.elements.turfTypeOptions.forEach((t) => {
          t.classList.toggle("selected", t.dataset.type === e);
        }),
        this.elements.golfSubcategory &&
          (this.elements.golfSubcategory.style.display =
            "golf" === e ? "block" : "none"),
        this.elements.sportsSubcategory &&
          (this.elements.sportsSubcategory.style.display =
            "sports" === e ? "block" : "none"),
        this.elements.subcategoryOptions.forEach((e) => {
          e.classList.remove("selected");
        }),
        this.updateTrafficCardVisibility(),
        this.updateConstructionOptions(),
        // Skip species rebuild during profile load — profile applies species explicitly
        // after cascade settles. Rebuilding here wipes the pre-seeded value.
        this._isLoadingProfile || this.updateSpeciesOptions(),
        this.applyDefaults(),
        "golf" === e
          ? this.selectSubCategory("greens")
          : (this.updateContextIndicators(), this.dispatchStateChange()));
    },
    selectSubCategory: function (e) {
      if (
        (console.log("[TurfProfile] Selecting sub-category:", e),
        (this.state.subCategory = e),
        this.elements.subcategoryOptions.forEach((t) => {
          const i = t.dataset.surface || t.dataset.sport;
          t.classList.toggle("selected", i === e);
        }),
        // Skip species rebuild during profile load — avoids Bent default override
        "golf" === this.state.turfType &&
          (this._isLoadingProfile || this.updateSpeciesOptions(), this.updateConstructionOptions()),
        this.elements.stratifiedOM &&
          (this.elements.stratifiedOM.style.display =
            "greens" === e ? "block" : "none"),
        this.elements.poaSection &&
          (this.elements.poaSection.style.display =
            "greens" === e ? "block" : "none"),
        "sports" === this.state.turfType && e)
      ) {
        const t = document.querySelector(".gaip-match-sport");
        t && (t.value = e);
      }
      (this.applyDefaults(),
        this.updateContextIndicators(),
        this.dispatchStateChange());
    },
    updateSpeciesOptions: function () {
      const e = this.elements.speciesSelect;
      if (!e) return;

      // Bowls/cotula: species is managed entirely by GAIP_CotulaBowling.
      // Do not repopulate from the grass species list — that would wipe cotula.
      if (this.state.turfType === 'bowls' ||
          this.state.species === 'cotula' ||
          (window.GAIP_STATE && window.GAIP_STATE.turf && window.GAIP_STATE.turf.cotula)) {
        // Ensure cotula option exists and is selected
        if (!e.querySelector('option[value="cotula"]')) {
          const opt = document.createElement('option');
          opt.value = 'cotula'; opt.textContent = 'Cotula (Leptinella)';
          e.appendChild(opt);
        }
        e.value = 'cotula';
        this.state.species = 'cotula';
        return;
      }

      const t = this.getSpeciesOptions(),
        i = this.getClimateZone();
      // Capture current selection BEFORE rebuilding innerHTML
      const previousValue = e.value || this.state.species;
      (console.log(
        "[TurfProfile] Climate zone:",
        i,
        "- C4 viable:",
        this.isC4Viable(),
      ),
        (e.innerHTML = t
          .map(
            (e) =>
              `<option value="${e.value}" data-type="${e.type}">${e.label}</option>`,
          )
          .join("")));
      // Prefer restoring the previous selection; only fall back to t[0] if
      // the previous value is no longer in the rebuilt list (e.g. switching
      // turf type/region genuinely removes that species).
      if (t.length > 0) {
        const stillAvailable = previousValue && t.some(function(s) { return s.value === previousValue; });
        if (stillAvailable) {
          e.value = previousValue;
          // Update internal state without re-triggering a full selectSpecies cascade
          this.state.species = previousValue;
        } else {
          this.selectSpecies(t[0].value);
        }
      }
      // Notify any late-loading modules (e.g. nz-fine-fescue-integration)
      // so they can inject extra options and re-apply the saved species if needed.
      document.dispatchEvent(new CustomEvent('gaip:species-options-updated', {
        detail: { species: this.state.species, availableSpecies: t }
      }));
    },
    selectSpecies: function (e) {
      (console.log("[TurfProfile] Selecting species:", e),
        (this.state.species = e),
        // Write to the DOM select so gaip_build_state() reads the correct species.
        // Without this, hub-tissue reads the old value from .gaip-species on re-run.
        this.elements.speciesSelect && (this.elements.speciesSelect.value = e),
        this.updateVarietyOptions(e),
        this.updateOverseedVisibility(),
        this.updateContextIndicators(),
        this.dispatchStateChange());
    },
    updateVarietyOptions: function (e) {
      const t = this.elements.varietySelect;
      if (!t) return;
      const i = this.getVarietyRegion();
      console.log(`[TurfProfile] Getting varieties for region: ${i}, species: ${e}`);
      let a = this.getVarietiesForRegion(e, i);
      let n = "",
        s = !1,
        r = !1;
      a.forEach((e) => {
        "blend" === e.type ? (s = !0) : (r = !0);
      });
      const o = (e) => {
        let t = e.label;
        if (e.rating && e.rating > 0) {
          const i = "★".repeat(e.rating) + "☆".repeat(3 - e.rating);
          t = `${e.label} ${i}`;
        }
        return `<option value="${e.value}" title="${e.ratingDesc || ""}">${t}</option>`;
      };
      if (s && r)
        ((n += '<optgroup label="Individual Cultivars">'),
          a
            .filter((e) => "blend" !== e.type)
            .forEach((e) => {
              n += o(e);
            }),
          (n += "</optgroup>"),
          (n += '<optgroup label="Professional Blends">'),
          a
            .filter((e) => "blend" === e.type)
            .forEach((e) => {
              n += o(e);
            }),
          (n += "</optgroup>"));
      else {
        [...a]
          .sort((e, t) =>
            "generic" === e.value
              ? -1
              : "generic" === t.value
                ? 1
                : (t.rating || 0) - (e.rating || 0),
          )
          .forEach((e) => {
            n += o(e);
          });
      }
      ((t.innerHTML = n),
        a.length > 0 && (this.state.variety = a[0].value),
        console.log(
          `[TurfProfile] Variety region: ${i}, species: ${e}, varieties: ${a.length}`,
        ));
    },
    selectVariety: function (e) {
      ((this.state.variety = e), this.dispatchStateChange());
    },
    updateConstructionOptions: function () {
      const e = this.elements.constructionSelect;
      if (!e) return;
      let t = [];
      ("golf" === this.state.turfType && this.state.subCategory
        ? (t = this.constructionByType.golf[this.state.subCategory] || [])
        : "sports" === this.state.turfType
          ? (t = this.constructionByType.sports)
          : "lawns" === this.state.turfType &&
            (t = this.constructionByType.lawns),
        t.length > 0 &&
          ((e.innerHTML = t
            .map((e) => `<option value="${e.value}">${e.label}</option>`)
            .join("")),
          (this.state.construction = t[0].value)));
    },
    updateTrafficCardVisibility: function () {
      const e =
        this.elements.trafficCard ||
        document.querySelector(".gaip-card:has(.gaip-enable-turf-traffic)") ||
        this.findTrafficCard();
      if (e) {
        const t = "sports" === this.state.turfType;
        e.style.display = t ? "block" : "none";
        const i = e.querySelector(".gaip-enable-turf-traffic");
        i && (i.checked = t);
      }
    },
    findTrafficCard: function () {
      const e = document.querySelectorAll(".gaip-card");
      for (const t of e) {
        const e = t.querySelector(".gaip-card-header h3");
        if (e && e.textContent.includes("Traffic")) return t;
      }
      return null;
    },
    updateOverseedVisibility: function () {
      if (!this.elements.overseedSection) return;
      const e = ["Couch", "Kikuyu", "Zoysia", "Buffalograss"].some(
        (e) => this.state.species && this.state.species.includes(e),
      );
      this.elements.overseedSection.style.display = e ? "block" : "none";
    },
    applyDefaults: function () {
      const e = this.getThresholdContext();
      e &&
        (this.elements.hocInput &&
          !this.elements.hocInput.dataset.userSet &&
          ((this.elements.hocInput.value = e.hocDefault),
          (this.state.hoc = e.hocDefault)),
        this.elements.nProgramInput &&
          !this.elements.nProgramInput.dataset.userSet &&
          ((this.elements.nProgramInput.value = e.nProgramDefault),
          (this.state.nProgram = e.nProgramDefault)));
    },
    updateContextIndicators: function () {
      const e = this.getThresholdContext();
      if (!e) return;
      document.querySelectorAll(".gaip-context-indicator").forEach((t) => {
        const i = t.dataset.section,
          a = this.getContextText(i, e);
        a
          ? ((t.innerHTML = a), (t.style.display = "block"))
          : (t.style.display = "none");
      });
      const t = document.getElementById("gaip-profile-summary");
      t && (t.innerHTML = this.getProfileSummaryHTML(e));
    },
    getThresholdContext: function () {
      let e = null;
      if (
        ("golf" === this.state.turfType && this.state.subCategory
          ? (e = { ...this.thresholds.golf[this.state.subCategory] })
          : "sports" === this.state.turfType
            ? (e = { ...this.thresholds.sports })
            : "lawns" === this.state.turfType &&
              (e = { ...this.thresholds.lawns }),
        !e)
      )
        return null;
      const t = this.getSpeciesDLI();
      return (
        t &&
          ((e.dliMinimum = t.min),
          (e.dliOptimal = t.optimal),
          (e.dliTarget = t.target)),
        e
      );
    },
    isPGRActive: function () {
      const e = document.querySelector(".gaip-pgr-product");
      return e && e.value && "" !== e.value;
    },
    getSpeciesDLI: function () {
      const e = this.state.species;
      if (!e) return this.speciesDLI.default;
      const t =
          e.toLowerCase().includes("couch") ||
          e.toLowerCase().includes("bermuda"),
        i =
          "golf" === this.state.turfType && "greens" === this.state.subCategory;
      if (t && i)
        return this.isPGRActive()
          ? this.bermudaGreensDLI_withPGR
          : this.bermudaGreensDLI;
      if (this.speciesDLI[e]) return this.speciesDLI[e];
      const a = e.toLowerCase();
      for (const e in this.speciesDLI)
        if (e.toLowerCase() === a) return this.speciesDLI[e];
      for (const e in this.speciesDLI)
        if (a.includes(e.toLowerCase()) || e.toLowerCase().includes(a))
          return this.speciesDLI[e];
      return this.speciesDLI.default;
    },
    getContextText: function (e, t) {
      if (!t) return "";
      const i = this.state.species || "Not selected",
        a = `DLI: ${t.dliMinimum}–${t.dliOptimal} mol/m²/d`;
      return (
        {
          climate: `${t.description} • ${i} • ${a}`,
          mlsn: `${t.mlsnContext} thresholds • ${i}`,
          tissue: `${"greens_c3" === t.tissueContext ? "Jerry Spencer greens" : t.tissueContext} ranges • ${i}`,
          shade: `${i} • ${a}`,
          wear: t.wearRecoveryActive
            ? `${i} • Wear analysis active`
            : "Wear analysis not applicable",
          disease: `${t.description} • ${i}`,
        }[e] || ""
      );
    },
    getProfileSummaryHTML: function (e) {
      if (!e) return "";
      const t = this.state.species || "No species";
      return `\n                <span class="gaip-profile-tag">${e.description}</span>\n                <span class="gaip-profile-tag">${t}</span>\n                <span class="gaip-profile-tag">DLI: ${e.dliMinimum}–${e.dliOptimal}</span>\n            `;
    },
    lastAnalysisTimestamp: null,
    markAnalysisRun: function () {
      ((this.lastAnalysisTimestamp = Date.now()), this.hideStaleWarning());
    },
    checkStaleResults: function () {
      if (!this.lastAnalysisTimestamp) return !1;
      const e = document.querySelector(".gaip-results");
      return e && "none" !== e.style.display && "" !== e.innerHTML.trim();
    },
    showStaleWarning: function () {
      if (!this.checkStaleResults()) return;
      let e = document.getElementById("gaip-stale-results-warning");
      if (!e) {
        ((e = document.createElement("div")),
          (e.id = "gaip-stale-results-warning"),
          (e.className = "gaip-stale-warning"),
          (e.innerHTML =
            '\n                    <span class="gaip-stale-icon">⚠️</span>\n                    <span class="gaip-stale-text">Turf profile changed. Results may be stale, re-run analysis to update.</span>\n                    <button class="gaip-stale-dismiss" onclick="GaipTurfProfile.hideStaleWarning()">✕</button>\n                '));
        const t = document.querySelector(".gaip-results");
        t && t.insertBefore(e, t.firstChild);
      }
      e.style.display = "flex";
    },
    hideStaleWarning: function () {
      const e = document.getElementById("gaip-stale-results-warning");
      e && (e.style.display = "none");
    },
    dispatchStateChange: function () {
      const e = this.getThresholdContext();
      let t = null;
      if ("function" == typeof window.gaip_detectRegion) {
        const e = document.querySelector(".gaip-lat"),
          i = document.querySelector(".gaip-lon");
        if (e && i) {
          const a = parseFloat(e.value),
            n = parseFloat(i.value);
          if (!isNaN(a) && !isNaN(n)) {
            const e = window.gaip_detectRegion(a, n);
            t = {
              regionId: e,
              region: window.GAIP_RegionalProfiles?.getRegion(e),
              traitPriorities:
                "function" == typeof window.gaip_getTraitPriorities
                  ? window.gaip_getTraitPriorities(e)
                  : null,
              ntepMatch:
                "function" == typeof window.gaip_getNTEPMatch
                  ? window.gaip_getNTEPMatch(e)
                  : null,
            };
          }
        }
      }
      const i = {
          ...this.state,
          thresholds: e,
          climateInfo: t,
          isC4: this.isCurrentSpeciesC4(),
          isPGRActive: this.isPGRActive(),
          timestamp: Date.now(),
        },
        a = new CustomEvent("gaip:turf-profile-change", {
          detail: i,
          bubbles: !0,
        });
      (document.dispatchEvent(a),
        window.gaipDispatch &&
          window.gaipDispatch({ type: "TURF_PROFILE_UPDATE", payload: i }),
        this.showStaleWarning(),
        this.updateClimateInfoDisplay(t),
        console.log("[TurfProfile] State dispatched:", i));
    },
    updateClimateInfoDisplay: function (e) {
      let t = document.getElementById("gaip-climate-info-display");
      if (!t && e && e.region) {
        const e = this.elements.varietySelect;
        e &&
          e.parentElement &&
          ((t = document.createElement("div")),
          (t.id = "gaip-climate-info-display"),
          (t.className = "gaip-climate-info"),
          (t.style.cssText =
            "margin-top: 8px; padding: 8px 12px; background: var(--gaip-info-bg); border-radius: 6px; font-size: 12px; color: #0369a1; border: 1px solid #bae6fd;"),
          e.parentElement.appendChild(t));
      }
      if (!t) return;
      if (!e || !e.region) return void (t.style.display = "none");
      t.style.display = "block";
      let i = "";
      if (e.traitPriorities && e.traitPriorities.critical) {
        const t = e.traitPriorities.critical.slice(0, 3),
          a = {
            cold: "Cold tolerance",
            heat: "Heat tolerance",
            drought: "Drought tolerance",
            wear: "Wear tolerance",
            disease_general: "Disease resistance",
            pythium: "Pythium resistance",
            humidity_stress: "Humidity tolerance",
            winterColor: "Winter colour",
            springGreenup: "Spring greenup",
            salinity: "Salt tolerance",
            recovery: "Recovery rate",
            redThread: "Red thread resistance",
            fusarium: "Fusarium resistance",
            snowMould: "Snow mould resistance",
          };
        i = `<div style="margin-top: 4px;"><strong>Priority traits:</strong> ${t.map((e) => a[e] || e).join(", ")}</div>`;
      }
      let a = "";
      const n = e.regionId,
        s = {
          uk_ireland: "BSPB/STRI trials",
          scandinavia: "Scanturf trials",
          france: "GEVES trials",
          germany: "BSA/BSPB trials",
        };
      if (s[n])
        a = `<span style="color: var(--gaip-text); font-size: 11px;">(${s[n]})</span>`;
      else if (e.ntepMatch) {
        a = `<span style="color: var(--gaip-text); font-size: 11px;">(≈ ${(e.ntepMatch.ntepRegion || "").replace("us_", "US ").replace("_", " ").replace("california", "California")} trials)</span>`;
      }
      t.innerHTML = `\n                <div style="display: flex; align-items: center; gap: 6px;">\n                    <span style="font-size: 14px;">📍</span>\n                    <strong>${e.region.name}</strong>\n                    ${a}\n                </div>\n                ${i}\n            `;
    },
    isCurrentSpeciesC4: function () {
      return ["Couch", "Kikuyu", "Zoysia", "Buffalograss"].some(
        (e) => this.state.species && this.state.species.includes(e),
      );
    },
    getSavedProfiles: function () {
      try {
        const e = localStorage.getItem(this.STORAGE_KEY);
        return e ? JSON.parse(e) : {};
      } catch (e) {
        return (console.error("[TurfProfile] Error loading profiles:", e), {});
      }
    },
    /**
     * Snapshot location from DOM so profiles carry their coordinates.
     */
    snapshotLocation: function () {
      var latEl = document.querySelector('.gaip-lat');
      var lonEl = document.querySelector('.gaip-lon');
      var nameEl = document.getElementById('gaip-location-search');
      return {
        lat: latEl ? parseFloat(latEl.value) || null : null,
        lon: lonEl ? parseFloat(lonEl.value) || null : null,
        name: nameEl ? nameEl.value || '' : ''
      };
    },
    /**
     * Restore location to DOM from a saved profile's location object.
     */
    restoreLocation: function (loc) {
      if (!loc) return;
      var latEl = document.querySelector('.gaip-lat');
      var lonEl = document.querySelector('.gaip-lon');
      var nameEl = document.getElementById('gaip-location-search');
      if (loc.lat && latEl) {
        latEl.value = loc.lat;
        latEl.dispatchEvent(new Event('change', { bubbles: true }));
      }
      if (loc.lon && lonEl) {
        lonEl.value = loc.lon;
        lonEl.dispatchEvent(new Event('change', { bubbles: true }));
      }
      if (loc.name && nameEl) {
        nameEl.value = loc.name;
      }
      // Notify location-aware modules (ammonium acetate, regional profiles, etc.)
      if (loc.lat && loc.lon) {
        document.dispatchEvent(new CustomEvent('gaip:locationChange', {
          detail: { lat: loc.lat, lon: loc.lon, name: loc.name || '' }
        }));
        document.dispatchEvent(new CustomEvent('gaip:location-restored', {
          detail: { lat: loc.lat, lon: loc.lon, name: loc.name || '' }
        }));
      }
    },
    saveCurrentProfile: function () {
      const e = prompt(
        "Enter a name for this profile:",
        this.getDefaultProfileName(),
      );
      if (!e || !e.trim()) return;
      const t = this.getSavedProfiles();
      t[e.trim()] = {
        ...this.state,
        location: this.snapshotLocation(),
        savedAt: new Date().toISOString()
      };
      try {
        (localStorage.setItem(this.STORAGE_KEY, JSON.stringify(t)),
          this.updateProfileSelect(),
          this.showNotification("Profile saved: " + e.trim()));
      } catch (e) {
        (console.error("[TurfProfile] Error saving profile:", e),
          alert("Error saving profile. Local storage may be full."));
      }
    },
    loadProfile: function (e) {
      const t = this.getSavedProfiles()[e];
      t
        ? (this.profileLoadedFromSaved = true,
          this._isLoadingProfile = true,
          console.log("[TurfProfile] Loading profile:", e, t),
          // Switch SampleManager site so spray log, samples etc. are site-scoped
          this._switchToProfileSite(e, t),
          // Restore location FIRST so region detection is correct during species selection
          t.location && this.restoreLocation(t.location),
          // Small delay to let location DOM update settle before turf cascade
          setTimeout(function() {
            var self = window.GaipTurfProfile;
            // If site-config-persistence is about to restore the correct per-site
            // species, skip applying this profile's identity fields — they belong
            // to a different site (e.g. Federal GC loading on init while Silk Path
            // is the active site). site-config-persistence will set the right species.
            var siteConfigPending = window.GAIP_SITE_CONFIG_PENDING === true;
            if (siteConfigPending) {
              console.log('[TurfProfile] Skipping profile identity cascade, site-config restore pending');
              self._isLoadingProfile = false;
              return;
            }
            // Pre-seed state.species and DOM value BEFORE the turfType/subCategory
            // cascade fires so updateSpeciesOptions() sees the correct previousValue
            // and doesn't fall back to the greens default (Creeping Bentgrass).
            if (t.species) {
              self.state.species = t.species;
              if (self.elements.speciesSelect) self.elements.speciesSelect.value = t.species;
            }
            t.turfType && self.selectTurfType(t.turfType);
            t.subCategory && self.selectSubCategory(t.subCategory);
            if (self.elements.speciesSelect && t.species) {
              self.elements.speciesSelect.value = t.species;
              self.selectSpecies(t.species);
            }
            if (self.elements.varietySelect && t.variety) {
              self.elements.varietySelect.value = t.variety;
              self.state.variety = t.variety;
            }
            if (self.elements.constructionSelect && t.construction) {
              self.elements.constructionSelect.value = t.construction;
              self.state.construction = t.construction;
            }
            if (self.elements.drainageSelect && t.drainage) {
              self.elements.drainageSelect.value = t.drainage;
              self.state.drainage = t.drainage;
            }
            if (self.elements.hocInput && t.hoc) {
              self.elements.hocInput.value = t.hoc;
              // b35fix312_1: do NOT set dataset.userSet here. Profile-loaded
              // values should update when species/surface changes;
              // userSet is reserved for genuine user-typed input.
              self.state.hoc = t.hoc;
            }
            if (self.elements.nProgramInput && t.nProgram) {
              self.elements.nProgramInput.value = t.nProgram;
              // b35fix312_1: see HoC note above — same fix. Previous behaviour
              // locked a profile-loaded N value (e.g. 250 from ryegrass/sport)
              // so it stuck when switching to golf/greens, where the correct
              // default is 150. applyDefaults now updates both fields freely
              // whenever the user changes species/surface.
              self.state.nProgram = t.nProgram;
            }
            localStorage.setItem(self.STORAGE_KEY + "_last", e);
            // Clear loading flag after cascade settles, then dispatch once
            setTimeout(function() {
              self._isLoadingProfile = false;
              self.dispatchStateChange();
              console.log("[TurfProfile] Profile load complete:", e);
            }, 400);
          }, 50),
          this.showNotification("Profile loaded: " + e))
        : console.warn("[TurfProfile] Profile not found:", e);
    },
    _switchToProfileSite: function (profileName, profile) {
      var sm = window.GAIP_SampleManager;
      if (!sm) return;

      // Derive siteId: use stored _siteId, or extract UUID from __site__<UUID> profile key,
      // or fall back to slugifying the profile name.
      var siteId = profile._siteId;
      if (!siteId) {
        // Auto-profiles are keyed as '__site__<UUID>' — extract the UUID directly
        // instead of slugifying (which produces 41-char IDs that overflow CHAR(36)).
        var _autoMatch = /^__site__(.+)$/.exec(profileName);
        siteId = _autoMatch ? _autoMatch[1] :
            profileName.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
      }
      if (!siteId) return;

      // If site doesn't exist yet, create it
      var sites = sm.listSites ? sm.listSites() : [];
      var exists = sites.some(function(s) { return s.id === siteId; });
      if (!exists) {
        console.log("[TurfProfile] Creating site for profile:", profileName, "->", siteId);
        if (typeof sm.addSiteWithId === 'function') {
          sm.addSiteWithId(siteId, profileName);
        } else {
          sm.addSite(profileName);
          sites = sm.listSites ? sm.listSites() : [];
          var match = sites.find(function(s) { return s.id === siteId || s.label === profileName; });
          if (match) siteId = match.id;
        }
      }

      // Switch to the site ONLY if persistence has already restored the correct active site.
      // During init, loadLastProfile() fires before sample-persistence completes — switching
      // sites here would clobber the persisted active site for the whole session.
      // We gate on window._gaipSamplePersistenceReady which is set by sample-persistence.js
      // after gaip:samples-persistence-ready fires.
      if (sm.getActiveSiteId() !== siteId) {
        if (window._gaipSamplePersistenceReady) {
          console.log("[TurfProfile] Switching to site:", siteId, "for profile:", profileName);
          sm.setActiveSite(siteId);
        } else {
          console.log("[TurfProfile] Skipping site switch to", siteId, ", persistence not ready (init auto-load)");
        }
      }

      // Store the siteId back into the profile for future loads
      if (!profile._siteId) {
        profile._siteId = siteId;
        var profiles = this.getSavedProfiles();
        profiles[profileName] = profile;
        try {
          localStorage.setItem(this.STORAGE_KEY, JSON.stringify(profiles));
        } catch (e) { /* ignore */ }
      }
    },
    deleteCurrentProfile: function () {
      const e = this.elements.profileSelect;
      if (!e || !e.value) return;
      const t = e.value;
      if (!confirm('Delete profile "' + t + '"?')) return;
      const i = this.getSavedProfiles();
      delete i[t];
      try {
        (localStorage.setItem(this.STORAGE_KEY, JSON.stringify(i)),
          this.updateProfileSelect(),
          this.showNotification("Profile deleted: " + t),
          document.dispatchEvent(new CustomEvent('gaip:profile-deleted', {
            detail: { profileName: t }
          })));
      } catch (e) {
        console.error("[TurfProfile] Error deleting profile:", e);
      }
    },
    loadLastProfile: function () {
      // b35fix154: Skip last-profile restore on GSSH venue pages.
      // The venue selector is the species authority on GSSH pages — loading the
      // last GAIP profile (e.g. Silk Path GC / Kikuyu) overwrites the venue species,
      // causes turfType:null timing issues, and triggers spurious TIER 0 identity
      // failures that block the disease dashboard on every page load.
      // Detection: GSSH pages always have #gssh-venue-readiness in the DOM or
      // window.GSSH_EUE loaded. Check DOM first (available at DOMContentLoaded),
      // then fall back to checking the URL for known GSSH patterns.
      var _isGSSHPage = !!(
        document.getElementById('gssh-venue-readiness') ||
        (window.location && window.location.search.indexOf('gssh_venue') !== -1)
      );
      if (_isGSSHPage) {
        console.log('[TurfProfile] GSSH page detected, skipping last-profile restore (venue selector is species authority)');
        return;
      }
      const e = localStorage.getItem(this.STORAGE_KEY + "_last");
      if (e) {
        if (this.getSavedProfiles()[e]) return void this.loadProfile(e);
      }
      this.selectTurfType("sports");
    },
    updateProfileSelect: function () {
      const e = this.elements.profileSelect;
      if (!e) return;
      const t = this.getSavedProfiles(),
        i = Object.keys(t).sort();
      e.innerHTML =
        '<option value="">-- Select Profile --</option>' +
        i.map((e) => `<option value="${e}">${e}</option>`).join("");
    },
    getDefaultProfileName: function () {
      const e = this.getThresholdContext(),
        t = this.state.species ? this.state.species.split(" ")[0] : "";
      return e ? `${e.description} - ${t}` : "My Profile";
    },
    showNotification: function (e) {
      const t = document.createElement("div");
      ((t.className = "gaip-notification"),
        (t.textContent = e),
        (t.style.cssText =
          "\n                position: fixed;\n                bottom: 20px;\n                right: 20px;\n                background: #2c5f2d;\n                color: var(--gaip-surface);\n                padding: 12px 20px;\n                border-radius: 6px;\n                font-size: 14px;\n                z-index: 10000;\n                animation: fadeInOut 3s ease;\n            "),
        document.body.appendChild(t),
        setTimeout(() => {
          t.remove();
        }, 3e3));
    },
    getState: function () {
      return {
        ...this.state,
        thresholds: this.getThresholdContext(),
        isC4: this.isCurrentSpeciesC4(),
      };
    },
    setTurfType: function (e, t) {
      (this.selectTurfType(e), t && this.selectSubCategory(t));
    },
  }),
    "loading" === document.readyState
      ? document.addEventListener("DOMContentLoaded", function () {
          GaipTurfProfile.init();
        })
        // If DOM is already ready (footer scripts), defer one tick so all
        // sibling footer scripts (gssh/gaip-variety-traits etc.) have executed
        // before init() calls getAustralianRyegrassVarieties().
      : setTimeout(function () { GaipTurfProfile.init(); }, 0));
})();
