!(function () {
  "use strict";
  const e = new Set([
      "analysis:started",
      "analysis:complete",
      "cascade:complete",
      "orchestrator:complete",
      "selective-compute:complete",
      "climate:fetched",
      "climate:metrics-ready",
      "climate:stress-complete",
      "weather:ready",
      "weather:updated",
      "turf-profile:changed",
      "turf-profile:updated",
      "species:changed",
      "species:options-updated",
      "soil:calculated",
      "soil:data-update",
      "soil:data-cleared",
      "soil:texture-changed",
      "soil:structure-updated",
      "water:analysis-complete",
      "water:updated",
      "water:data-cleared",
      "tissue:updated",
      "tissue:data-update",
      "tissue:data-cleared",
      "tissue:corrective-complete",
      "disease:updated",
      "dew:analysis-complete",
      "ambient-dli:ready",
      "salinity:climate-update",
      "overseed:state-update",
      "overseed:fraction-update",
      "overseed:climate-update",
      "pgr:weather-updated",
      "spray-log:updated",
      "methodology:changed",
      "sample:added",
      "sample:loaded",
      "sample:updated",
      "sample:deleted",
      "sample:renamed",
      "samples:imported",
      "samples:cleared",
      "samples:restored",
      "site:added",
      "site:changed",
      "site:removed",
      "site:renamed",
      "site:config-applied",
      "site:data-invalidated",
      "site:save-requested",
      "location:changed",
      "location:restored",
      "sensor:data-imported",
      "sensor:data-cleared",
      "sensor:zone-labelled",
      "sensor:hydrosight-updated",
      "sensor:manager-ready",
      "state:saved",
      "state:restored",
      "state:cleared",
      "state:update",
      "data:imported",
      "contradictions:detected",
      "nutrition:calendar-generated",
      "nutrition:au-fertiliser-generated",
      "nutrition:prebble-generated",
      "trend:data-ready",
      "scenario:applied",
      "tab:changed",
      "wizard:complete",
      "variety:selected",
    ]),
    t = {
      "gaip:sampleAdded": "sample:added",
      "gaip:sampleDeleted": "sample:deleted",
      "gaip:sampleLoaded": "sample:loaded",
      "gaip:sampleRenamed": "sample:renamed",
      "gaip:sampleUpdated": "sample:updated",
      "gaip:samplesCleared": "samples:cleared",
      "gaip:stateRestored": "state:restored",
      "gaip:weatherUpdated": "weather:updated",
      "gaip:locationChange": "location:changed",
      "gaip:locationChanged": "location:changed",
      "gaip:siteChanged": "site:changed",
      "gaip:sensorDataImported": "sensor:data-imported",
      "gaip:dataImported": "data:imported",
      "gaip:trendDataReady": "trend:data-ready",
      "gaip:varietySelected": "variety:selected",
      "gaip:scenarioApplied": "scenario:applied",
      "gaip:sample-added": "sample:added",
      "gaip:sample-deleted": "sample:deleted",
      "gaip:sample-loaded": "sample:loaded",
      "gaip:sample-renamed": "sample:renamed",
      "gaip:sample-updated": "sample:updated",
      "gaip:samples-cleared": "samples:cleared",
      "gaip:samples-imported": "samples:imported",
      "gaip:samples-restored": "samples:restored",
      "gaip:state-restored": "state:restored",
      "gaip:state-saved": "state:saved",
      "gaip:state-cleared": "state:cleared",
      "gaip:state-update": "state:update",
      "gaip:weather-ready": "weather:ready",
      "gaip:weather-updated": "weather:updated",
      "gaip:weather-data-ready": "weather:ready",
      "gaip:site-changed": "site:changed",
      "gaip:site-added": "site:added",
      "gaip:site-removed": "site:removed",
      "gaip:site-renamed": "site:renamed",
      "gaip:site-config-applied": "site:config-applied",
      "gaip:site-data-invalidated": "site:data-invalidated",
      "gaip:site-save-requested": "site:save-requested",
      "gaip:sensor-data-imported": "sensor:data-imported",
      "gaip:sensor-data-cleared": "sensor:data-cleared",
      "gaip:location-restored": "location:restored",
      "gaip:analysis-complete": "analysis:complete",
      "gaip:cascade-complete": "cascade:complete",
      "gaip:orchestrator-complete": "orchestrator:complete",
      "gaip:selective-compute-complete": "selective-compute:complete",
      "gaip:climate-fetch-complete": "climate:fetched",
      "gaip:climate-metrics-ready": "climate:metrics-ready",
      "gaip:climate-stress-complete": "climate:stress-complete",
      "gaip:turf-profile-change": "turf-profile:changed",
      "gaip:turf-profile-update": "turf-profile:updated",
      "gaip:species-changed": "species:changed",
      "gaip:species-options-updated": "species:options-updated",
      "gaip:soil-calculated": "soil:calculated",
      "gaip:soil-data-update": "soil:data-update",
      "gaip:soil-data-cleared": "soil:data-cleared",
      "gaip:soil-texture-change": "soil:texture-changed",
      "gaip:soil-structure-updated": "soil:structure-updated",
      "gaip:structure-analysis-complete": "soil:structure-updated",
      "gaip:water-analysis-complete": "water:analysis-complete",
      "gaip:water-updated": "water:updated",
      "gaip:waterDataCleared": "water:data-cleared",
      "gaip:tissue-updated": "tissue:updated",
      "gaip:tissue-data-update": "tissue:data-update",
      "gaip:tissueDataCleared": "tissue:data-cleared",
      "gaip:tissue-corrective-complete": "tissue:corrective-complete",
      "gaip:run-tissue-corrective-engine": "tissue:corrective-complete",
      "gaip:disease-updated": "disease:updated",
      "gaip:dew-analysis-complete": "dew:analysis-complete",
      "gaip:ambient-dli-ready": "ambient-dli:ready",
      "gaip:salinity-climate-update": "salinity:climate-update",
      "gaip:overseed-state-update": "overseed:state-update",
      "gaip:overseed-fraction-update": "overseed:fraction-update",
      "gaip:overseed-climate-update": "overseed:climate-update",
      "gaip:overseed-update": "overseed:state-update",
      "gaip:pgr-weather-updated": "pgr:weather-updated",
      "gaip:spray-log-updated": "spray-log:updated",
      "gaip:methodology-change": "methodology:changed",
      "gaip:mlsn-calculated": "soil:calculated",
      "gaip:data-imported": "data:imported",
      "gaip:contradictions-detected": "contradictions:detected",
      "gaip:nutrition-calendar-generated": "nutrition:calendar-generated",
      "gaip:au-fertiliser-program-generated": "nutrition:au-fertiliser-generated",
      "gaip:prebble-program-generated": "nutrition:prebble-generated",
      "gaip:trend-data-ready": "trend:data-ready",
      "gaip:tab-change": "tab:changed",
      "gaip:wizard-complete": "wizard:complete",
      "gaip:hub-state-update": "state:update",
      "gaip:all-samples-cleared": "samples:cleared",
    };
  let s = null;
  function a(e, t) {
    const s = e.length,
      a = t.length,
      n = Array.from({ length: s + 1 }, () => Array(a + 1).fill(0));
    for (let i = 0; i <= s; i++) n[i][0] = i;
    for (let i = 0; i <= a; i++) n[0][i] = i;
    for (let i = 1; i <= s; i++)
      for (let s = 1; s <= a; s++)
        n[i][s] = e[i - 1] === t[s - 1] ? n[i - 1][s - 1] : 1 + Math.min(n[i - 1][s], n[i][s - 1], n[i - 1][s - 1]);
    return n[s][a];
  }
  const n = new (class {
    constructor() {
      ((this._listeners = new Map()),
        (this._wildcardListeners = new Set()),
        (this._debug = !1),
        (this._legacyBridge = !1),
        (this._history = []),
        (this._historyLimit = 200));
    }
    enableDebug() {
      return ((this._debug = !0), this);
    }
    enableLegacyBridge() {
      if (this._legacyBridge) return this;
      this._legacyBridge = !0;
      const e = Object.keys(t);
      for (const s of e)
        document.addEventListener(s, (e) => {
          const a = t[s];
          if (!a) return;
          const n = (e instanceof CustomEvent && e.detail) || {};
          n.__bridged || this.emit(a, { ...n, __bridged: !0 });
        });
      return this;
    }
    on(t, s) {
      return "*" === t
        ? (this._wildcardListeners.add(s), () => this._wildcardListeners.delete(s))
        : (e.has(t) || console.warn(`[HubEventBus] Unknown event "${t}". Valid events:`, [...e].sort()),
          this._listeners.has(t) || this._listeners.set(t, new Set()),
          this._listeners.get(t).add(s),
          () => {
            const e = this._listeners.get(t);
            e && (e.delete(s), 0 === e.size && this._listeners.delete(t));
          });
    }
    once(e, t) {
      const s = this.on(e, (e) => {
        (s(), t(e));
      });
      return s;
    }
    emit(a, n = {}) {
      if (!e.has(a))
        return void console.error(
          `[HubEventBus] Rejected unknown event "${a}".`,
          "Register it in VALID_EVENTS or check for typos.",
          `\nDid you mean: ${this._fuzzyMatch(a)}`,
        );
      const i = Date.now();
      (this._debug && console.log(`%c[Event] ${a}`, "color: #4CAF50; font-weight: bold", n),
        this._history.push({ event: a, payload: n, timestamp: i }),
        this._history.length > this._historyLimit && this._history.shift());
      const l = this._listeners.get(a);
      if (l)
        for (const e of l)
          try {
            e(n);
          } catch (r) {
            console.error(`[HubEventBus] Error in listener for "${a}":`, r);
          }
      for (const e of this._wildcardListeners)
        try {
          e(a, n);
        } catch (r) {
          console.error(`[HubEventBus] Error in wildcard listener for "${a}":`, r);
        }
      if (this._legacyBridge && !n.__bridged) {
        const e =
            (function () {
              if (s) return s;
              s = {};
              for (const [e, a] of Object.entries(t)) (s[a] || (s[a] = []), s[a].push(e));
              return s;
            })()[a] || [],
          i = { ...n };
        delete i.__bridged;
        for (const t of e) document.dispatchEvent(new CustomEvent(t, { detail: { ...i, __bridged: !0 } }));
      }
    }
    history(e) {
      return e ? this._history.filter((t) => t.event === e) : [...this._history];
    }
    clear() {
      (this._listeners.clear(), this._wildcardListeners.clear(), (this._history = []));
    }
    getValidEvents() {
      return [...e].sort();
    }
    registerEvent(t) {
      e.add(t);
    }
    _fuzzyMatch(t) {
      const s = [...e],
        n = t.toLowerCase().replace(/^gaip:/, ""),
        i = s.filter((e) => e.startsWith(n.split(":")[0] + ":"));
      return i.length > 0
        ? i.slice(0, 3).join(", ")
        : s
            .map((e) => ({ name: e, dist: a(n, e) }))
            .sort((e, t) => e.dist - t.dist)
            .slice(0, 3)
            .map((e) => e.name)
            .join(", ");
    }
  })();
  function i(e, t) {
    const s = t.split(".");
    let a = e;
    for (const n of s) {
      if (null == a || "object" != typeof a) return;
      a = a[n];
    }
    return a;
  }
  function l(e, t, s) {
    const a = t.split(".");
    let n = e;
    for (let i = 0; i < a.length - 1; i++) {
      const e = a[i];
      ((null != n[e] && "object" == typeof n[e]) || (n[e] = {}), (n = n[e]));
    }
    n[a[a.length - 1]] = s;
  }
  function r(e) {
    if (null === e || "object" != typeof e) return e;
    try {
      return structuredClone(e);
    } catch {
      return JSON.parse(JSON.stringify(e));
    }
  }
  function o(e, t) {
    if (e === t) return !0;
    if (null == e || null == t) return e === t;
    if (typeof e != typeof t) return !1;
    if ("object" != typeof e) return !1;
    const s = Object.keys(e),
      a = Object.keys(t);
    if (s.length !== a.length) return !1;
    for (const n of s) if (!o(e[n], t[n])) return !1;
    return !0;
  }
  function u(e, t, s) {
    const a = [],
      n = new Set([...Object.keys(e || {}), ...Object.keys(t || {})]);
    for (const i of n) {
      const n = s ? `${s}.${i}` : i,
        l = e?.[i],
        r = t?.[i];
      "object" != typeof l || null === l || "object" != typeof r || null === r || Array.isArray(l) || Array.isArray(r)
        ? o(l, r) || a.push({ path: n, baseline: l, current: r })
        : a.push(...u(l, r, n));
    }
    return a;
  }
  const c = new (class {
    constructor() {
      ((this._state = {
        version: "2.0.0",
        lastComputed: null,
        computeSequence: 0,
        inputs: {
          climate: {
            source: null,
            temperature: { current: null, min: null, max: null, mean: null },
            humidity: { current: null, mean: null },
            dewpoint: { current: null, mean: null },
            precipitation: { total: null, forecast: [] },
            et: { total: null, daily: null },
            wind: { mean: null, max: null },
            solar: { dli: null, avgMJ: null },
            growthPotential: { weighted: null, c3: null, c4: null },
            forecast: [],
            historical: [],
          },
          soilTemp: {
            source: null,
            reliability: 0,
            depths: { d20mm: null, d50mm: null, d100mm: null, d200mm: null },
            mean: null,
            current: null,
            warning: null,
          },
          sensor: { available: !1, source: null, importDate: null, vwc: null, ec: null, soilTemp: null, zoneCount: 0 },
          turf: {
            speciesKey: "",
            species: "",
            variety: null,
            isC4: !1,
            isOverseed: !1,
            overseedSpecies: null,
            overseedFraction: 0,
            c3Fraction: 1,
            c4Fraction: 0,
            turfType: null,
            profileType: null,
            construction: null,
            heightOfCut: null,
            grassSpecies: null,
            warmBase: null,
            coolOverseed: null,
            nProgramKgHaYr: null,
            ledPPFD: null,
            ledHours: null,
            dli: null,
          },
          soil: {
            methodology: "mlsn",
            pH: null,
            ec: null,
            cec: null,
            organicMatter: null,
            texture: null,
            bulkDensity: null,
            nutrients: {},
            loiDepths: null,
            gypsum: null,
            surfaceType: null,
          },
          water: {
            pH: null,
            EC: null,
            Na: null,
            Ca: null,
            Mg: null,
            Cl: null,
            HCO3: null,
            B: null,
            SO4: null,
            K: null,
            sources: [],
            recycledWater: false,
            blendRatios: [],
          },
          tissue: { sampleDate: null, nutrients: {} },
          schedule: {
            matchesPerWeek: null,
            sessionsPerWeek: null,
            restDays: null,
            matchCode: null,
            trainingCode: null,

            nextMatch: null,
          },
          site: {
            latitude: null,
            longitude: null,
            region: null,
            country: null,
            timezone: null,
            shadePercent: null,
            shade: null,
          },
          pgr: { product: null, activeIngredient: null, lastApplication: null, rate: null, rateLPerHa: null },
          sprayLog: [],
        },
        computed: {
          climate: null,
          ambientDLI: null,
          dew: null,
          shade: null,
          salinity: null,
          phytotoxicity: null,
          soilStructure: null,
          stress: null,
          tissue: null,
          mlsn: null,
          nutrientDemand: null,
          soilTissueIntegration: null,
          disease: null,
          leafSpot: null,
          wear: null,
          firmness: null,
          nitrogen: null,
          traffic: null,
          turfManager: null,
          irrigation: null,
          pgr: null,
          waterBlend: null,
          stressTrajectory: null,
          diseaseForecast: null,
          irrigationForecast: null,
          pgrForecast: null,
        },
        derived: {
          combinedGrowthModifier: 1,
          environmentalStressIndex: 0,
          recoveryProbability: null,
          adjustedRecoveryDays: null,
        },
        quality: { overall: "unknown", issues: [], dataAge: null },
      }),
        (this._mutations = []),
        (this._mutationLimit = 500),
        (this._snapshots = new Map()),
        (this._transaction = null),
        (this._debug = !1),
        (this._legacyBridge = !1),
        (this._syncing = !1),
        (this._pathListeners = new Map()));
    }
    get(e) {
      return r(i(this._state, e));
    }
    peek(e) {
      return i(this._state, e);
    }
    getState() {
      return r(this._state);
    }
    has(e) {
      const t = i(this._state, e);
      return null != t;
    }
    set(e, t, s = "unknown") {
      const a = i(this._state, e),
        n = r(t);
      l(this._state, e, n);
      const o = { path: e, oldValue: r(a), newValue: n, source: s, timestamp: Date.now() };
      if (
        (this._mutations.push(o),
        this._mutations.length > this._mutationLimit && this._mutations.shift(),
        this._debug &&
          console.log(`%c[Store] SET ${e}`, "color: #2196F3; font-weight: bold", { from: a, to: t, source: s }),
        this._transaction)
      )
        return (this._transaction.paths.add(e), void this._transaction.mutations.push(o));
      this._emitChanges([e]);
    }
    merge(e, t, s = "unknown") {
      const a = i(this._state, e);
      if (null == a || "object" != typeof a) return void this.set(e, t, s);
      const n = [];
      for (const [i, u] of Object.entries(t)) {
        const t = `${e}.${i}`,
          c = a[i];
        o(c, u) ||
          (l(this._state, t, r(u)),
          n.push(t),
          this._mutations.push({ path: t, oldValue: r(c), newValue: r(u), source: s, timestamp: Date.now() }));
      }
      n.length > 0 && !this._transaction
        ? this._emitChanges(n)
        : this._transaction && n.forEach((e) => this._transaction.paths.add(e));
    }
    transaction(e, t = "transaction") {
      if (this._transaction) e(this);
      else {
        this._transaction = { paths: new Set(), mutations: [], source: t };
        try {
          e(this);
        } finally {
          const e = [...this._transaction.paths];
          ((this._transaction = null), e.length > 0 && this._emitChanges(e));
        }
      }
    }
    onChange(e, t) {
      return (
        this._pathListeners.has(e) || this._pathListeners.set(e, new Set()),
        this._pathListeners.get(e).add(t),
        () => {
          const s = this._pathListeners.get(e);
          s && (s.delete(t), 0 === s.size && this._pathListeners.delete(e));
        }
      );
    }
    _emitChanges(e) {
      for (const [s, a] of this._pathListeners) {
        if (e.some((e) => e === s || e.startsWith(s + ".")))
          for (const n of a)
            try {
              n({ paths: e });
            } catch (t) {
              console.error(`[HubStore] Error in onChange listener for "${s}":`, t);
            }
      }
      (n.emit("state:update", { path: e[0] }), this._legacyBridge && this._syncLegacyGlobals(e));
    }
    snapshot(e) {
      this._snapshots.set(e, r(this._state));
    }
    restoreSnapshot(e) {
      const t = this._snapshots.get(e);
      return !!t && ((this._state = r(t)), n.emit("state:restored", {}), !0);
    }
    getSnapshot(e) {
      const t = this._snapshots.get(e);
      return t ? r(t) : null;
    }
    deleteSnapshot(e) {
      this._snapshots.delete(e);
    }
    listSnapshots() {
      return [...this._snapshots.keys()];
    }
    diff(e) {
      const t = this._snapshots.get(e);
      return t ? u(t, this._state, "") : [];
    }
    setComputed(e, t, s = "orchestrator") {
      this.set(`computed.${e}`, t, s);
    }
    clearComputed() {
      this.set(
        "computed",
        {
          climate: null,
          ambientDLI: null,
          dew: null,
          shade: null,
          salinity: null,
          phytotoxicity: null,
          soilStructure: null,
          stress: null,
          tissue: null,
          mlsn: null,
          nutrientDemand: null,
          soilTissueIntegration: null,
          disease: null,
          leafSpot: null,
          wear: null,
          firmness: null,
          nitrogen: null,
          traffic: null,
          turfManager: null,
          irrigation: null,
          pgr: null,
          waterBlend: null,
          stressTrajectory: null,
          diseaseForecast: null,
          irrigationForecast: null,
          pgrForecast: null,
        },
        "orchestrator",
      );
    }
    reset() {
      ((this._state = {
        version: "2.0.0",
        lastComputed: null,
        computeSequence: 0,
        inputs: {
          climate: {
            source: null,
            temperature: { current: null, min: null, max: null, mean: null },
            humidity: { current: null, mean: null },
            dewpoint: { current: null, mean: null },
            precipitation: { total: null, forecast: [] },
            et: { total: null, daily: null },
            wind: { mean: null, max: null },
            solar: { dli: null, avgMJ: null },
            growthPotential: { weighted: null, c3: null, c4: null },
            forecast: [],
            historical: [],
          },
          soilTemp: {
            source: null,
            reliability: 0,
            depths: { d20mm: null, d50mm: null, d100mm: null, d200mm: null },
            mean: null,
            current: null,
            warning: null,
          },
          sensor: { available: !1, source: null, importDate: null, vwc: null, ec: null, soilTemp: null, zoneCount: 0 },
          turf: {
            speciesKey: "",
            species: "",
            variety: null,
            isC4: !1,
            isOverseed: !1,
            overseedSpecies: null,
            overseedFraction: 0,
            c3Fraction: 1,
            c4Fraction: 0,
            turfType: null,
            profileType: null,
            construction: null,
            heightOfCut: null,
            grassSpecies: null,
            warmBase: null,
            coolOverseed: null,
            nProgramKgHaYr: null,
            ledPPFD: null,
            ledHours: null,
            dli: null,
          },
          soil: {
            methodology: "mlsn",
            pH: null,
            ec: null,
            cec: null,
            organicMatter: null,
            texture: null,
            bulkDensity: null,
            nutrients: {},
            loiDepths: null,
            gypsum: null,
            surfaceType: null,
          },
          water: {
            pH: null,
            EC: null,
            Na: null,
            Ca: null,
            Mg: null,
            Cl: null,
            HCO3: null,
            B: null,
            SO4: null,
            K: null,
            sources: [],
            recycledWater: false,
            blendRatios: [],
          },
          tissue: { sampleDate: null, nutrients: {} },
          schedule: {
            matchesPerWeek: null,
            sessionsPerWeek: null,
            restDays: null,
            matchCode: null,
            trainingCode: null,
            nextMatch: null,
          },
          site: {
            latitude: null,
            longitude: null,
            region: null,
            country: null,
            timezone: null,
            shadePercent: null,
            shade: null,
          },
          pgr: { product: null, activeIngredient: null, lastApplication: null, rate: null, rateLPerHa: null },
          sprayLog: [],
        },
        computed: {
          climate: null,
          ambientDLI: null,
          dew: null,
          shade: null,
          salinity: null,
          phytotoxicity: null,
          soilStructure: null,
          stress: null,
          tissue: null,
          mlsn: null,
          nutrientDemand: null,
          soilTissueIntegration: null,
          disease: null,
          leafSpot: null,
          wear: null,
          firmness: null,
          nitrogen: null,
          traffic: null,
          turfManager: null,
          irrigation: null,
          pgr: null,
          waterBlend: null,
          stressTrajectory: null,
          diseaseForecast: null,
          irrigationForecast: null,
          pgrForecast: null,
        },
        derived: {
          combinedGrowthModifier: 1,
          environmentalStressIndex: 0,
          recoveryProbability: null,
          adjustedRecoveryDays: null,
        },
        quality: { overall: "unknown", issues: [], dataAge: null },
      }),
        (this._mutations = []),
        n.emit("state:cleared", {}));
    }
    enableDebug() {
      return ((this._debug = !0), this);
    }
    enableLegacyBridge() {
      return ((this._legacyBridge = !0), this);
    }
    getMutations(e = 50) {
      return this._mutations.slice(-e);
    }
    nextSequence() {
      return (
        this._state.computeSequence++,
        (this._state.lastComputed = new Date().toISOString()),
        this._state.computeSequence
      );
    }
    _syncLegacyGlobals(e) {
      if (this._syncing) return;
      this._syncing = !0;
      const t = "undefined" != typeof window ? window : globalThis;
      (t.GAIP_STATE || (t.GAIP_STATE = {}),
        Object.assign(t.GAIP_STATE, {
          inputs: this._state.inputs,
          computed: this._state.computed,
          derived: this._state.derived,
          turf: this._state.inputs.turf,
          lastComputed: this._state.lastComputed,
          computeSequence: this._state.computeSequence,
        }),
        (t.__GAIP_STATE__ = t.GAIP_STATE),
        (t.GAIP_CANONICAL_STATE = {
          version: "2.0.0",
          populatedAt: this._state.lastComputed,
          climate: this._state.inputs.climate,
          soilTemp: this._state.inputs.soilTemp,
          sensor: this._state.inputs.sensor,
          turf: this._state.inputs.turf,
          quality: this._state.quality,
        }));
      const s = {
        "computed.disease": "GAIP_DISEASE_RESULT",
        "computed.dew": "GAIP_DEW_RESULT",
        "computed.salinity": "GAIP_SALINITY_RESULT",
        "computed.phytotoxicity": "GAIP_PHYTOTOXICITY_RESULT",
        "computed.shade": "GAIP_SHADE_RESULT",
        "computed.tissue": "GAIP_TISSUE_RESULT",
        "computed.wear": "GAIP_TRAFFIC_RESULT",
        "computed.pgr": "GAIP_PGR_RESULT",
        "computed.irrigation": "GAIP_IRRIGATION_RESULT",
        "computed.stress": "GAIP_CLIMATE_STRESS_RESULT",
        "computed.stressTrajectory": "GAIP_STRESS_TRAJECTORY_RESULT",
        "computed.soilStructure": "GAIP_STRUCTURE_RESULT",
        "computed.climate": "GAIP_CLIMATE_DUAL_RESULT",
      };
      for (const [a, n] of Object.entries(s)) {
        e.some((e) => e === a || e.startsWith(a + ".")) && (t[n] = i(this._state, a));
      }
      this._syncing = !1;
    }
  })();
  const d = new (class {
      constructor() {
        ((this._engines = new Map()),
          (this._inputIndex = new Map()),
          (this._executionOrder = null),
          (this._debug = !1));
      }
      register(e) {
        const { id: t, compute: s } = e;
        if (!t) throw new Error("[EngineRegistry] Engine must have an id");
        if ("function" != typeof s) throw new Error(`[EngineRegistry] Engine "${t}" must have a compute function`);
        (this._engines.has(t) && console.warn(`[EngineRegistry] Overwriting engine "${t}"`),
          this._engines.set(t, {
            id: t,
            label: e.label || t,
            category: e.category || "unknown",
            tier: e.tier || 4,
            inputs: e.inputs || [],
            engines: e.engines || [],
            outputs: e.outputs || [],
            description: e.description || "",
            compute: s,
          }),
          (this._executionOrder = null),
          this._rebuildInputIndex(),
          this._debug &&
            console.log(
              `[EngineRegistry] Registered "${t}" (tier ${e.tier || "?"}, deps: [${(e.engines || []).join(", ")}])`,
            ));
      }
      unregister(e) {
        (this._engines.delete(e), (this._executionOrder = null), this._rebuildInputIndex());
      }
      get(e) {
        return this._engines.get(e);
      }
      has(e) {
        return this._engines.has(e);
      }
      list() {
        return [...this._engines.keys()];
      }
      getAffectedEngines(e) {
        const t = e.split(".")[0],
          s = new Set(),
          a = this._inputIndex.get(e);
        a && a.forEach((e) => s.add(e));
        const n = this._inputIndex.get(t);
        n && n.forEach((e) => s.add(e));
        const i = new Set(s),
          l = [...s];
        for (; l.length > 0; ) {
          const e = l.shift();
          for (const [t, s] of this._engines) !i.has(t) && s.engines.includes(e) && (i.add(t), l.push(t));
        }
        return this.getExecutionOrder().filter((e) => i.has(e));
      }
      getExecutionOrder() {
        if (this._executionOrder) return this._executionOrder;
        const e = [],
          t = new Set(),
          s = new Set(),
          a = (n) => {
            if (t.has(n)) return;
            if (s.has(n)) return void console.error(`[EngineRegistry] Circular dependency detected involving "${n}"`);
            s.add(n);
            const i = this._engines.get(n);
            if (i) for (const e of i.engines) this._engines.has(e) && a(e);
            (s.delete(n), t.add(n), e.push(n));
          };
        for (const n of this._engines.keys()) a(n);
        return ((this._executionOrder = e), e);
      }
      _rebuildInputIndex() {
        this._inputIndex.clear();
        for (const [e, t] of this._engines)
          for (const s of t.inputs) {
            const t = s.split(".")[0];
            (this._inputIndex.has(s) || this._inputIndex.set(s, new Set()),
              this._inputIndex.get(s).add(e),
              s !== t &&
                (this._inputIndex.has(t) || this._inputIndex.set(t, new Set()), this._inputIndex.get(t).add(e)));
          }
      }
      enableDebug() {
        return ((this._debug = !0), this);
      }
    })(),
    p = new (class {
      constructor(e) {
        ((this._registry = e), (this._debug = !1), (this._running = !1));
      }
      async computeAll() {
        if (this._running) return (console.warn("[Orchestrator] Already running, ignoring duplicate call"), null);
        this._running = !0;
        const e = c.nextSequence(),
          t = performance.now();
        (n.emit("analysis:started", { sequence: e }),
          this._debug && console.group(`[Orchestrator] computeAll() - sequence #${e}`));
        const s = this._registry.getExecutionOrder(),
          a = {},
          i = {},
          l = c.peek("inputs"),
          r = c.peek("derived");
        for (const n of s) {
          const e = this._registry.get(n);
          if (e)
            try {
              const t = performance.now(),
                s = {};
              for (const [e, n] of Object.entries(a)) s[e] = n;
              const i = e.compute(l, s, r);
              if (null != i) {
                a[n] = i;
                const e = this._engineIdToOutputKey(n);
                c.setComputed(e, i, n);
              }
              if (this._debug) {
                const s = (performance.now() - t).toFixed(1);
                console.log(
                  `  ✓ ${e.label} (${s}ms)`,
                  i?._meta?.confidence ? `confidence: ${i._meta.confidence}%` : "",
                );
              }
            } catch (u) {
              ((i[n] = u),
                console.error(`[Orchestrator] Engine "${n}" threw:`, u),
                this._debug && console.log(`  ✗ ${e.label} - ERROR:`, u.message));
            }
        }
        const o = performance.now() - t;
        return (
          this._debug &&
            (console.log(`\nCompleted ${Object.keys(a).length}/${s.length} engines in ${o.toFixed(0)}ms`),
            Object.keys(i).length > 0 && console.warn("Errors:", Object.keys(i)),
            console.groupEnd()),
          (this._running = !1),
          n.emit("analysis:complete", { sequence: e, durationMs: o }),
          n.emit("cascade:complete", { sequence: e }),
          n.emit("orchestrator:complete", { sequence: e }),
          { results: a, errors: i, durationMs: o, sequence: e }
        );
      }
      async computeSelective(e) {
        const t = this._registry.getAffectedEngines(e);
        if ((this._debug && console.log(`[Orchestrator] Selective compute for "${e}":`, t), 0 === t.length))
          return { results: {}, errors: {}, affected: [] };
        const s = c.peek("inputs"),
          a = c.peek("computed") || {},
          i = c.peek("derived"),
          l = {},
          r = {};
        for (const n of t) {
          const e = this._registry.get(n);
          if (e)
            try {
              const t = { ...a, ...l },
                r = e.compute(s, t, i);
              if (null != r) {
                l[n] = r;
                const e = this._engineIdToOutputKey(n);
                c.setComputed(e, r, n);
              }
            } catch (o) {
              ((r[n] = o), console.error(`[Orchestrator] Selective compute - engine "${n}" threw:`, o));
            }
        }
        return (n.emit("selective-compute:complete", { engineIds: t }), { results: l, errors: r, affected: t });
      }
      async runScenario(e, t, s = !0) {
        (c.snapshot("__scenario_baseline"),
          c.transaction((s) => {
            for (const [a, n] of Object.entries(t)) s.set(a, n, `scenario:${e}`);
          }));
        const a = await this.computeAll();
        c.snapshot(e);
        const n = c.diff("__scenario_baseline");
        return (
          s && c.restoreSnapshot("__scenario_baseline"),
          c.deleteSnapshot("__scenario_baseline"),
          { baseline: c.getSnapshot("__scenario_baseline"), scenario: c.getSnapshot(e), diffs: n, results: a }
        );
      }
      _engineIdToOutputKey(e) {
        const t = this._registry.get(e);
        if (t?.outputs?.length > 0) {
          const e = t.outputs[0].match(/^computed\.(.+?)(\.|$)/);
          if (e) return e[1];
        }
        return e
          .replace(/-engine$/, "")
          .replace(/-calculator$/, "")
          .replace(/-module$/, "")
          .replace(/-/g, " ")
          .replace(/ ([a-z])/g, (e, t) => t.toUpperCase())
          .trim();
      }
      enableDebug() {
        return ((this._debug = !0), this);
      }
    })(d),
    g = [
      {
        key: "creeping-bentgrass",
        display: "Creeping Bentgrass",
        isC4: !1,
        gddBase: 0,
        gddSource: "Kreuser & Soldat 2011",
        pHOptimal: [5.5, 6.5],
        pHTolerance: [5, 7],
        aliases: [
          "creeping bentgrass",
          "bentgrass",
          "bent",
          "agrostis stolonifera",
          "creeping bentgrass (greens)",
          "creeping bentgrass (fairway)",
          "browntop bent",
          "colonial bentgrass",
          "agrostis capillaris",
          "agrostis",
          "a1",
          "a4",
          "penncross",
          "penn a4",
          "penn g2",
          "crystal bluelinks",
          "tyee",
          "pure distinction",
          "creepingBentgrass",
          "Creeping Bentgrass",
        ],
        surfaces: ["greens", "fairways", "tees"],
      },
      {
        key: "perennial-ryegrass",
        display: "Perennial Ryegrass",
        isC4: !1,
        gddBase: 0,
        gddSource: "Kreuser & Soldat 2011",
        pHOptimal: [6, 7],
        pHTolerance: [5.5, 7.5],
        aliases: [
          "perennial ryegrass",
          "ryegrass",
          "rye",
          "lolium perenne",
          "prg",
          "lolium",
          "perennialRyegrass",
          "Perennial Ryegrass",
        ],
        surfaces: ["fairways", "sports", "tees"],
      },
      {
        key: "kentucky-bluegrass",
        display: "Kentucky Bluegrass",
        isC4: !1,
        gddBase: 0,
        gddThreshold: 250,
        gddSource: "Kreuser & Soldat 2011",
        pHOptimal: [6, 7],
        pHTolerance: [5.5, 8],
        aliases: ["kentucky bluegrass", "kbg", "bluegrass", "poa pratensis", "kentuckyBluegrass", "Kentucky Bluegrass"],
        surfaces: ["sports", "fairways", "lawns"],
      },
      {
        key: "tall-fescue",
        display: "Tall Fescue",
        isC4: !1,
        gddBase: 0,
        pHOptimal: [5.5, 6.5],
        pHTolerance: [4.5, 8],
        aliases: [
          "tall fescue",
          "festuca arundinacea",
          "schedonorus arundinaceus",
          "tttf",
          "turf type tall fescue",
          "tallFescue",
          "Tall Fescue",
        ],
        surfaces: ["sports", "fairways", "lawns"],
      },
      {
        key: "fine-fescue",
        display: "Fine Fescue",
        isC4: !1,
        gddBase: 0,
        pHOptimal: [5.5, 6.5],
        pHTolerance: [5, 7.5],
        aliases: ["fine fescue", "fescue", "festuca rubra", "fineFescue", "Fine Fescue"],
        surfaces: ["greens", "fairways", "roughs"],
      },
      {
        key: "chewings-fescue",
        display: "Chewings Fescue",
        isC4: !1,
        gddBase: 0,
        pHOptimal: [5.5, 6.5],
        pHTolerance: [5, 7],
        aliases: [
          "chewings fescue",
          "chewings",
          "festuca rubra commutata",
          "chewings fescue (greens)",
          "chewingsFescue",
          "Chewings Fescue",
        ],
        surfaces: ["greens", "fairways"],
      },
      {
        key: "slender-creeping-red-fescue",
        display: "Slender Creeping Red Fescue",
        isC4: !1,
        gddBase: 0,
        pHOptimal: [5.5, 6.5],
        pHTolerance: [5, 7.5],
        aliases: [
          "slender creeping red fescue",
          "slender creeping red",
          "festuca rubra litoralis",
          "slenderCreepingRedFescue",
        ],
        surfaces: ["greens", "fairways"],
      },
      {
        key: "strong-creeping-red-fescue",
        display: "Strong Creeping Red Fescue",
        isC4: !1,
        gddBase: 0,
        pHOptimal: [5.5, 6.5],
        pHTolerance: [5, 7.5],
        aliases: [
          "strong creeping red fescue",
          "strong creeping red",
          "creeping red fescue",
          "festuca rubra rubra",
          "strongCreepingRedFescue",
        ],
        surfaces: ["fairways", "roughs"],
      },
      {
        key: "poa-annua",
        display: "Poa annua",
        isC4: !1,
        gddBase: 0,
        gddThreshold: 200,
        gddSource: "Kreuser & Soldat 2011",
        pHOptimal: [5.5, 6.5],
        pHTolerance: [5, 7.5],
        aliases: ["poa annua", "poa", "annual bluegrass", "annual meadowgrass", "poaAnnua", "Poa annua"],
        surfaces: ["greens", "fairways"],
      },
      {
        key: "bermuda",
        display: "Bermuda/Couch",
        isC4: !0,
        gddBase: 10,
        gddThreshold: 350,
        gddSource: "Reasor et al. 2018",
        pHOptimal: [6, 7],
        pHTolerance: [5.5, 8.5],
        aliases: [
          "bermuda",
          "bermudagrass",
          "couch",
          "couch grass",
          "cynodon dactylon",
          "cynodon",
          "common bermuda",
          "Bermuda",
          "Couch",
          "Bermudagrass",
        ],
        surfaces: ["greens", "fairways", "sports"],
      },
      {
        key: "ultradwarf-bermuda",
        display: "Ultradwarf Bermuda",
        isC4: !0,
        gddBase: 10,
        gddThreshold: 220,
        gddSource: "Reasor et al. 2018",
        pHOptimal: [6, 7],
        pHTolerance: [5.5, 8.5],
        aliases: [
          "ultradwarf bermuda",
          "ultradwarf",
          "mini verde",
          "champion",
          "tifeagle",
          "tifgreen",
          "ultradwarf bermudagrass",
          "ultradwarfBermuda",
        ],
        surfaces: ["greens"],
      },
      {
        key: "kikuyu",
        display: "Kikuyu",
        isC4: !0,
        gddBase: 10,
        gddThreshold: 300,
        gddSource: "Extrapolated from C4 data",
        pHOptimal: [5.5, 7],
        pHTolerance: [5, 8],
        aliases: ["kikuyu", "kikuyu grass", "pennisetum clandestinum", "cenchrus clandestinus", "Kikuyu"],
        surfaces: ["sports", "fairways"],
      },
      {
        key: "zoysia",
        display: "Zoysia",
        isC4: !0,
        gddBase: 10,
        gddThreshold: 300,
        gddSource: "Estimated from C4 data",
        pHOptimal: [6, 6.5],
        pHTolerance: [5.5, 7.5],
        aliases: ["zoysia", "zoysia grass", "zoysiagrass", "zoysia japonica", "zoysia matrella", "Zoysia"],
        surfaces: ["greens", "fairways", "sports"],
      },
      {
        key: "seashore-paspalum",
        display: "Seashore Paspalum",
        isC4: !0,
        gddBase: 10,
        pHOptimal: [6, 7],
        pHTolerance: [4, 9.5],
        aliases: [
          "seashore paspalum",
          "paspalum",
          "paspalum vaginatum",
          "seashorePaspalum",
          "Seashore Paspalum",
          "Paspalum",
        ],
        surfaces: ["greens", "fairways", "sports"],
      },
      {
        key: "buffalograss",
        display: "Buffalograss",
        isC4: !0,
        gddBase: 10,
        pHOptimal: [6, 7.5],
        pHTolerance: [5, 8.5],
        aliases: [
          "buffalo",
          "buffalograss",
          "buffalo grass",
          "stenotaphrum secundatum",
          "st augustine",
          "st. augustine",
          "Buffalo",
          "Buffalograss",
          "St. Augustine",
        ],
        surfaces: ["sports", "lawns"],
      },
    ],
    h = new Map();
  for (const f of g) {
    (h.set(f.key, f), h.set(f.display.toLowerCase(), f));
    for (const e of f.aliases) h.set(e.toLowerCase(), f);
  }
  const m = new (class {
    resolve(e) {
      if (!e) return null;
      const t = String(e).toLowerCase().trim(),
        s = h.get(t);
      return s ? { ...s } : this._fuzzyResolve(t);
    }
    getKey(e) {
      const t = this.resolve(e);
      return t ? t.key : null;
    }
    isC4(e) {
      const t = this.resolve(e);
      return !!t && t.isC4;
    }
    isC3(e) {
      return !this.isC4(e);
    }
    getGddBase(e) {
      const t = this.resolve(e);
      return t ? t.gddBase : 0;
    }
    getGddThreshold(e) {
      const t = this.resolve(e);
      return t?.gddThreshold || null;
    }
    getPhTolerance(e) {
      const t = this.resolve(e);
      return t ? { optimal: t.pHOptimal, tolerance: t.pHTolerance } : null;
    }
    getAll() {
      return g.map((e) => ({ ...e }));
    }
    getByType(e) {
      return g.filter((t) => t.isC4 === e).map((e) => ({ ...e }));
    }
    getBySurface(e) {
      return g.filter((t) => t.surfaces.includes(e)).map((e) => ({ ...e }));
    }
    register(e) {
      if (!e.key) throw new Error("Species must have a key");
      (g.push(e), h.set(e.key, e), h.set(e.display.toLowerCase(), e));
      for (const t of e.aliases || []) h.set(t.toLowerCase(), e);
    }
    _fuzzyResolve(e) {
      return e.includes("ultradwarf")
        ? this.resolve("ultradwarf-bermuda")
        : e.includes("bent")
          ? (e.includes("colonial") || e.includes("browntop"), this.resolve("creeping-bentgrass"))
          : e.includes("poa")
            ? this.resolve("poa-annua")
            : e.includes("rye")
              ? this.resolve("perennial-ryegrass")
              : e.includes("kentucky") || e.includes("kbg") || e.includes("bluegrass")
                ? this.resolve("kentucky-bluegrass")
                : e.includes("chewing")
                  ? this.resolve("chewings-fescue")
                  : e.includes("slender") && e.includes("fescue")
                    ? this.resolve("slender-creeping-red-fescue")
                    : (e.includes("strong") || e.includes("creeping red")) && e.includes("fescue")
                      ? this.resolve("strong-creeping-red-fescue")
                      : e.includes("tall") && e.includes("fescue")
                        ? this.resolve("tall-fescue")
                        : (e.includes("fine") && e.includes("fescue")) || e.includes("fescue")
                          ? this.resolve("fine-fescue")
                          : e.includes("bermuda") || e.includes("couch") || e.includes("cynodon")
                            ? this.resolve("bermuda")
                            : e.includes("zoysia")
                              ? this.resolve("zoysia")
                              : e.includes("kikuyu")
                                ? this.resolve("kikuyu")
                                : e.includes("paspalum") || e.includes("seashore")
                                  ? this.resolve("seashore-paspalum")
                                  : e.includes("buffalo") || e.includes("st.") || e.includes("stenotaphrum")
                                    ? this.resolve("buffalograss")
                                    : e.includes("c4") || e.includes("warm")
                                      ? {
                                          key: "c4-generic",
                                          display: "Warm-season (C4)",
                                          isC4: !0,
                                          gddBase: 10,
                                          pHOptimal: [6, 7],
                                          pHTolerance: [5.5, 8],
                                          aliases: [],
                                          surfaces: [],
                                        }
                                      : e.includes("c3") || e.includes("cool")
                                        ? {
                                            key: "c3-generic",
                                            display: "Cool-season (C3)",
                                            isC4: !1,
                                            gddBase: 0,
                                            pHOptimal: [6, 7],
                                            pHTolerance: [5.5, 7.5],
                                            aliases: [],
                                            surfaces: [],
                                          }
                                        : null;
    }
  })();
  !(function (e = {}) {
    const { debug: t = !1, legacyCompat: s = !0 } = e;
    (t &&
      (c.enableDebug(),
      n.enableDebug(),
      d.enableDebug(),
      p.enableDebug(),
      console.log("[Gilba v2] Debug mode enabled")),
      s &&
        (function () {
          const e = "undefined" != typeof window ? window : globalThis;
          (c.enableLegacyBridge(), n.enableLegacyBridge());
          let t = {};
          (Object.defineProperty(e, "GAIP_STATE", {
            get() {
              const e = {
                inputs: c.peek("inputs"),
                computed: c.peek("computed"),
                derived: c.peek("derived"),
                turf: c.peek("inputs.turf"),
                lastComputed: c.peek("lastComputed"),
                computeSequence: c.peek("computeSequence"),
              };
              return Object.assign(e, t);
            },
            set(e) {
              e &&
                "object" == typeof e &&
                !c._syncing &&
                ((t = e),
                e.inputs &&
                  c.transaction((t) => {
                    for (const [s, a] of Object.entries(e.inputs))
                      null != a && t.set(`inputs.${s}`, a, "legacy-state-write");
                  }),
                e.turf && c.set("inputs.turf", e.turf, "legacy-state-write"),
                e.soil && c.set("inputs.soil", e.soil, "legacy-state-write"),
                e.water && c.set("inputs.water", e.water, "legacy-state-write"),
                e.tissue && c.set("inputs.tissue", e.tissue, "legacy-state-write"),
                e.climate && c.set("inputs.climate", e.climate, "legacy-state-write"));
            },
            configurable: !0,
          }),
            Object.defineProperty(e, "__GAIP_STATE__", {
              get: () => e.GAIP_STATE,
              set(t) {
                e.GAIP_STATE = t;
              },
              configurable: !0,
            }));
          let s = {};
          Object.defineProperty(e, "GAIP_CANONICAL_STATE", {
            get: () =>
              Object.assign(
                {
                  version: "2.0.0-compat",
                  populatedAt: c.peek("lastComputed"),
                  climate: c.peek("inputs.climate"),
                  soilTemp: c.peek("inputs.soilTemp"),
                  sensor: c.peek("inputs.sensor"),
                  turf: c.peek("inputs.turf"),
                  quality: c.peek("quality"),
                  identity: c.peek("inputs.turf"),
                  issues: [],
                },
                s,
              ),
            set(e) {
              e &&
                "object" == typeof e &&
                ((s = e),
                e.climate && c.set("inputs.climate", e.climate, "canonical-write"),
                e.soilTemp && c.set("inputs.soilTemp", e.soilTemp, "canonical-write"),
                e.sensor && c.set("inputs.sensor", e.sensor, "canonical-write"),
                e.turf && c.set("inputs.turf", e.turf, "canonical-write"),
                e.quality && c.set("quality", e.quality, "canonical-write"));
            },
            configurable: !0,
          });
          const a = {
            GAIP_DISEASE_RESULT: "computed.disease",
            GAIP_DEW_RESULT: "computed.dew",
            GAIP_SALINITY_RESULT: "computed.salinity",
            GAIP_PHYTOTOXICITY_RESULT: "computed.phytotoxicity",
            GAIP_SHADE_RESULT: "computed.shade",
            GAIP_TISSUE_RESULT: "computed.tissue",
            GAIP_TISSUE_RESULTS: "computed.tissue",
            GAIP_TRAFFIC_RESULT: "computed.wear",
            GAIP_PGR_RESULT: "computed.pgr",
            GAIP_IRRIGATION_RESULT: "computed.irrigation",
            GAIP_CLIMATE_STRESS_RESULT: "computed.stress",
            GAIP_CLIMATE_DUAL_RESULT: "computed.climate",
            GAIP_STRESS_TRAJECTORY_RESULT: "computed.stressTrajectory",
            GAIP_TRAJECTORY_RESULT: "computed.stressTrajectory",
            GAIP_STRUCTURE_RESULT: "computed.soilStructure",
            GAIP_DISEASE_FORECAST: "computed.diseaseForecast",
            GAIP_OVERSEED_STATE: "computed.overseed",
          };
          for (const [n, i] of Object.entries(a))
            Object.defineProperty(e, n, {
              get: () => c.peek(i),
              set(e) {
                c.set(i, e, "legacy-global");
              },
              configurable: !0,
            });
          ((e.GaipOrchestrator = {
            computeAll: () => p.computeAll(),
            getState: () => c.getState(),
            isRunning: () => p._running,
          }),
            (e.GilbaHubOrchestrator = e.GaipOrchestrator),
            (e.GilbaCascadeOrchestrator = {
              runCascade: async (e = {}) => {
                const t = await p.computeAll();
                return (n.emit("cascade:complete", { sequence: c.peek("computeSequence") }), t);
              },
            }),
            (e.GilbaDependencyGraph = {
              getFullExecutionOrder: () => d.getExecutionOrder(),
              getDownstream: (e) => d.getAffectedEngines(e),
              getAffectedByInput: (e) => d.getAffectedEngines(e),
              getEngine: (e) => d.get(e),
              getAllEngines: () => {
                const e = {};
                for (const t of d.list()) e[t] = d.get(t);
                return e;
              },
            }),
            (e.SpeciesController = {
              getSpecies: () => c.peek("inputs.turf.speciesKey"),
              getSpeciesDisplay: () => c.peek("inputs.turf.species"),
              getEffectiveSpecies: () =>
                c.peek("inputs.turf.overseedFraction") > 0.5
                  ? c.peek("inputs.turf.overseedSpecies") ||
                    c.peek("inputs.turf.species") ||
                    c.peek("inputs.turf.speciesKey")
                  : c.peek("inputs.turf.species") || c.peek("inputs.turf.speciesKey"),
              getBaseSpecies: () =>
                c.peek("inputs.turf.warmBase") || c.peek("inputs.turf.species") || c.peek("inputs.turf.speciesKey"),
              normalize: (e) => m.getKey(e),
              isC4: (e) => m.isC4(e || c.peek("inputs.turf.speciesKey")),
              isC3: (e) => m.isC3(e || c.peek("inputs.turf.speciesKey")),
              getGddBase: (e) => m.getGddBase(e || c.peek("inputs.turf.speciesKey")),
              resolve: (e) => m.resolve(e),
              getAll: () => m.getAll(),
            }),
            e.GAIP_Utils ||
              (e.GAIP_Utils = {
                clamp: (e, t, s) => Math.max(t, Math.min(s, e)),
                formatDate: (e) => (e ? new Date(e).toLocaleDateString() : ""),
                monthNames: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
                isC4Species: (e) => m.isC4(e),
              }),
            (e.GilbaEngineConfidence = e.GilbaEngineConfidence || {
              wrapEngineOutput: (e, t, s) =>
                t
                  ? t._meta
                    ? t
                    : {
                        ...t,
                        _meta: {
                          engineId: e,
                          computedAt: new Date().toISOString(),
                          confidence: 70,
                          confidenceLevel: "medium",
                          dataQuality: {
                            source: "unknown",
                            reliability: 70,
                            fetchedAt: null,
                            staleAfterMs: 36e5,
                            warning: null,
                          },
                          citations: [],
                          warnings: [],
                        },
                      }
                  : t,
            }),
            (e.GilbaStateDispatch = {
              dispatch: (e, t) => {
                "SET_INPUT" === e
                  ? c.set(`inputs.${t.key}`, t.value, "state-dispatch")
                  : "SET_COMPUTED" === e && c.setComputed(t.key, t.value, "state-dispatch");
              },
              subscribe: (e, t) => {
                const s = e.replace(/-/g, ":");
                return n.on(s, t);
              },
            }),
            (e.GAIP_HUB_VERSION = "10.9.9"),
            (e.GAIP_HUB_CONFIG = e.GAIP_HUB_CONFIG || {}),
            (e.GilbaPersistence = e.GilbaPersistence || {
              save: () => {},
              restore: () => {},
              clear: () => c.reset(),
              export: () => JSON.stringify(c.getState()),
              import: (e) => {
                try {
                  const t = JSON.parse(e);
                  t.inputs &&
                    c.transaction((e) => {
                      for (const [s, a] of Object.entries(t.inputs)) e.set(`inputs.${s}`, a, "persistence-import");
                    });
                } catch (t) {
                  console.error("[LegacyShim] Failed to import state:", t);
                }
              },
            }),
            console.log("[Gilba v2] Legacy shim initialised - v1 modules can load now"));
        })(),
      "undefined" != typeof window &&
        (window.GilbaHub = {
          store: c,
          events: n,
          engines: d,
          orchestrator: p,
          species: m,
          version: "2.0.0",
          get: (e) => c.get(e),
          set: (e, t) => c.set(e, t, "api"),
          on: (e, t) => n.on(e, t),
          emit: (e, t) => n.emit(e, t),
          compute: () => p.computeAll(),
          debug: {
            state: () => c.getState(),
            mutations: (e) => c.getMutations(e),
            events: (e) => n.history(e),
            engines: () => d.list(),
            order: () => d.getExecutionOrder(),
            affected: (e) => d.getAffectedEngines(e),
          },
        }),
      console.log("[Gilba v2] Core initialised"));
  })({
    debug: Boolean("undefined" != typeof window && window.location && window.location.search.includes("gilba_debug=1")),
    legacyCompat: !0,
  });
})();
//# sourceMappingURL=gilba-hub-v2.js.map
