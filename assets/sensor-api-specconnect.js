/**
 * sensor-api-specconnect.js — v1.0.0
 *
 * SpecConnect API adapter for GAIP Hub.
 * Primary: TDR 350/300 FieldScout spatial readings via GetFSDataInDateRange.
 * Stubbed:  WatchDog weather stations via GetCurrentConditionsForEquipment
 *           (activate in v1.1.0 when WatchDog instruments are added).
 *
 * API base: https://api.specconnect.net:6703
 * Auth:     customerApiKey query parameter (kept server-side via WP-Ajax proxy)
 * Format:   JSON
 *
 * Integration points (mirrors sensor-api-hydrosight.js):
 *   - Registers with GAIP_SensorBridge as 'specconnect' source
 *   - hasData() / getIrrigationData() / getZoneSummaries() match bridge interface
 *   - VWC, EC, soilTemp flow into irrigation scheduling + pre-emergent engine
 *   - Site-scoped: each GAIP site maps to a SpecConnect collection + surface
 *
 * @author Gilba Solutions
 * @version 1.0.0
 */

(function (global) {
  "use strict";

  // =========================================================================
  // CONFIGURATION
  // =========================================================================

  var CONFIG = {
    version: "1.0.0",
    proxyUrl: typeof ajaxurl !== "undefined" ? ajaxurl : "/wp-admin/admin-ajax.php",
    proxyAction: "gilba_specconnect_proxy",
    apiBase: "https://api.specconnect.net:6703",
    // TDR device type string used in GetFSDataInDateRange
    tdrDeviceType: "TDR350",
    // How many days back to fetch on initial load
    defaultDaysBack: 7,
    // Poll interval (ms) — SpecConnect is not a streaming API;
    // TDR readings are session-based (manual walks), so we poll infrequently.
    pollIntervalMs: 30 * 60 * 1000, // 30 minutes
    storagePrefix: "gilba_specconnect_",
  };

  // =========================================================================
  // STATE
  // =========================================================================

  var _state = {
    enabled: false,
    apiKey: null,
    // Per-site mapping: siteId → { collectionName, surfaceName }
    // collectionName = SpecConnect course/field collection (e.g. "Elanora CC")
    // surfaceName    = SpecConnect surface (e.g. "Greens") — optional filter
    siteMappings: {},
    // Cached readings keyed by siteId
    cache: {},
    // Equipment list (serial numbers + names)
    equipment: [],
    // FieldScout collections (courses)
    collections: [],
    // Poll timer
    _pollTimer: null,
    _polling: false,
    _lastFetch: null,
  };

  // =========================================================================
  // STORAGE
  // =========================================================================

  function _save() {
    try {
      localStorage.setItem(
        CONFIG.storagePrefix + "config",
        JSON.stringify({
          enabled: _state.enabled,
          apiKey: _state.apiKey,
          siteMappings: _state.siteMappings,
        }),
      );
    } catch (e) {}
  }

  function _load() {
    try {
      var raw = localStorage.getItem(CONFIG.storagePrefix + "config");
      if (!raw) return;
      var cfg = JSON.parse(raw);
      _state.enabled = !!cfg.enabled;
      _state.apiKey = cfg.apiKey || null;
      _state.siteMappings = cfg.siteMappings || {};
    } catch (e) {}
  }

  function _saveCache(siteId, data) {
    try {
      localStorage.setItem(CONFIG.storagePrefix + "cache_" + siteId, JSON.stringify({ ts: Date.now(), data: data }));
    } catch (e) {}
  }

  function _loadCache(siteId) {
    try {
      var raw = localStorage.getItem(CONFIG.storagePrefix + "cache_" + siteId);
      if (!raw) return null;
      var obj = JSON.parse(raw);
      // Cache valid for 35 minutes (slightly longer than poll interval)
      if (Date.now() - obj.ts > 35 * 60 * 1000) return null;
      return obj.data;
    } catch (e) {
      return null;
    }
  }

  // =========================================================================
  // HELPERS
  // =========================================================================

  function _getNonce() {
    if (typeof GAIP_HUB_CONFIG !== "undefined" && GAIP_HUB_CONFIG.nonce) return GAIP_HUB_CONFIG.nonce;
    if (typeof GAIP_WIZARD_CONFIG !== "undefined" && GAIP_WIZARD_CONFIG.nonce) return GAIP_WIZARD_CONFIG.nonce;
    var el = document.querySelector('input[name="gilba_hub_nonce"]');
    return el ? el.value : null;
  }

  function _getActiveSiteId() {
    var SM = global.GAIP_SampleManager;
    if (SM && typeof SM.getActiveSiteId === "function") return SM.getActiveSiteId();
    return "default";
  }

  function _dateStr(d) {
    // SpecConnect expects MM/DD/YYYY HH:MM:SS format
    var pad = function (n) {
      return n < 10 ? "0" + n : "" + n;
    };
    return (
      pad(d.getMonth() + 1) +
      "/" +
      pad(d.getDate()) +
      "/" +
      d.getFullYear() +
      " " +
      pad(d.getHours()) +
      ":" +
      pad(d.getMinutes()) +
      ":" +
      pad(d.getSeconds())
    );
  }

  // =========================================================================
  // WP-AJAX PROXY CALLS
  // =========================================================================

  async function _proxyGet(endpoint) {
    var nonce = _getNonce();
    if (!nonce) throw new Error("Security nonce not found — please refresh the page");

    var formData = new FormData();
    formData.append("action", CONFIG.proxyAction);
    formData.append("nonce", nonce);
    formData.append("endpoint", endpoint);
    // Send key in body so test-before-save works; PHP falls back to WP options if empty
    if (_state.apiKey) formData.append("api_key", _state.apiKey);

    var response = await fetch(CONFIG.proxyUrl, {
      method: "POST",
      credentials: "same-origin",
      body: formData,
    });

    if (!response.ok) {
      // Try to extract the server's error message for better diagnostics
      try {
        var errJson = await response.json();
        var errMsg = errJson.data && errJson.data.message ? errJson.data.message : "Proxy request failed: " + response.status;
        throw new Error(errMsg);
      } catch (parseErr) {
        if (parseErr.message && parseErr.message !== "Unexpected end of JSON input") throw parseErr;
        throw new Error("Proxy request failed: " + response.status);
      }
    }

    var json = await response.json();
    if (!json.success) throw new Error(json.data && json.data.message ? json.data.message : "API error");
    return json.data;
  }

  // =========================================================================
  // API CALLS
  // =========================================================================

  /**
   * Get list of customer equipment (WatchDog stations, TDR readers).
   * Used during setup to let user pick devices.
   */
  async function fetchEquipment() {
    var ep = "/api/Customer/GetCustomerEquipment?customerApiKey={key}&optUnits=1";
    var data = await _proxyGet(ep);
    _state.equipment = Array.isArray(data) ? data : [];
    return _state.equipment;
  }

  /**
   * Get FieldScout collections (courses/fields).
   * Used during setup to map GAIP sites to SpecConnect collections.
   */
  async function fetchCollections() {
    var ep = "/api/Customer/GetFSCollections?customerApiKey={key}";
    var data = await _proxyGet(ep);
    _state.collections = Array.isArray(data) ? data : [];
    return _state.collections;
  }

  /**
   * Get TDR readings for the active site's mapped collection.
   * Uses GetFSDataInDateRange — returns spatial readings with GPS + VWC/EC/temp.
   * @param {string} siteId
   * @param {number} daysBack
   */
  async function fetchTDRReadings(siteId, daysBack) {
    daysBack = daysBack || CONFIG.defaultDaysBack;
    var mapping = _state.siteMappings[siteId];
    if (!mapping || !mapping.collectionName) {
      console.log("[SpecConnect] No collection mapped for site:", siteId);
      return null;
    }

    var now = new Date();
    var start = new Date(now.getTime() - daysBack * 24 * 60 * 60 * 1000);

    var ep =
      "/api/Customer/GetFSDataInDateRange" +
      "?customerApiKey={key}" +
      "&deviceType=" +
      encodeURIComponent(CONFIG.tdrDeviceType) +
      "&startDate=" +
      encodeURIComponent(_dateStr(start)) +
      "&endDate=" +
      encodeURIComponent(_dateStr(now)) +
      "&collectionName=" +
      encodeURIComponent(mapping.collectionName) +
      "&optUnits=1"; // metric

    var data = await _proxyGet(ep);
    return data;
  }

  /**
   * Get current conditions for a specific device (WatchDog weather station).
   * STUBBED — activate in v1.1.0 when WatchDog instruments are connected.
   * @param {string} serialNumber
   */
  async function fetchCurrentConditions(serialNumber) {
    // WatchDog stub — not called in v1.0.0
    console.log("[SpecConnect] WatchDog fetchCurrentConditions stubbed for v1.1.0 — serial:", serialNumber);
    return null;
  }

  // =========================================================================
  // DATA PROCESSING
  // =========================================================================

  /**
   * Parse FieldScout TDR response into GAIP sensor data shape.
   * SpecConnect returns an array of reading objects with fields that vary
   * by device config. Common fields: VWC, EC, Temperature, Latitude, Longitude.
   *
   * Returns the same shape as GAIP_Hydrosight.getIrrigationData():
   *   { vwc, ec, soilTemp, zones[], source, fetchedAt }
   */
  function _parseTDRResponse(raw, mapping) {
    if (!raw || !Array.isArray(raw) || raw.length === 0) return null;

    // Filter to the mapped surface if specified
    var readings = raw;
    if (mapping && mapping.surfaceName) {
      var sn = mapping.surfaceName.toLowerCase();
      readings = raw.filter(function (r) {
        var area = (r.AreaName || r.areaName || r.SurfaceName || "").toLowerCase();
        return area.indexOf(sn) !== -1;
      });
      if (readings.length === 0) readings = raw; // fallback to all if filter too aggressive
    }

    // Extract VWC values — field names vary by firmware version
    var vwcValues = [];
    var ecValues = [];
    var tempValues = [];
    var zoneMap = {};

    readings.forEach(function (r) {
      var vwc = _extractField(r, ["VWC", "vwc", "WaterContent", "waterContent", "Vwc"]);
      var ec = _extractField(r, ["EC", "ec", "ElecConductivity", "BulkEC", "bulkEC"]);
      var temp = _extractField(r, ["Temperature", "temperature", "Temp", "temp", "SoilTemp"]);
      var zone = r.AreaName || r.areaName || r.SurfaceName || r.surfaceName || "Unlabelled";

      if (vwc != null && vwc >= 0 && vwc <= 100) {
        vwcValues.push(vwc);
        if (!zoneMap[zone]) zoneMap[zone] = { vwcValues: [], ecValues: [], tempValues: [], name: zone };
        zoneMap[zone].vwcValues.push(vwc);
        if (ec != null) {
          ecValues.push(ec);
          zoneMap[zone].ecValues.push(ec);
        }
        if (temp != null) {
          tempValues.push(temp);
          zoneMap[zone].tempValues.push(temp);
        }
      }
    });

    if (vwcValues.length === 0) return null;

    var avg = function (arr) {
      return arr.length
        ? arr.reduce(function (a, b) {
            return a + b;
          }, 0) / arr.length
        : null;
    };
    var round1 = function (v) {
      return v != null ? Math.round(v * 10) / 10 : null;
    };

    // Build zone summaries
    var zones = Object.keys(zoneMap).map(function (name) {
      var z = zoneMap[name];
      return {
        name: name,
        avg: round1(avg(z.vwcValues)),
        min: round1(Math.min.apply(null, z.vwcValues)),
        max: round1(Math.max.apply(null, z.vwcValues)),
        count: z.vwcValues.length,
        ec: round1(avg(z.ecValues)),
        soilTemp: round1(avg(z.tempValues)),
      };
    });

    return {
      vwc: round1(avg(vwcValues)),
      ec: round1(avg(ecValues)),
      soilTemp: round1(avg(tempValues)),
      readingCount: vwcValues.length,
      zones: zones,
      source: "specconnect_tdr",
      fetchedAt: new Date().toISOString(),
    };
  }

  function _extractField(obj, candidates) {
    for (var i = 0; i < candidates.length; i++) {
      var v = obj[candidates[i]];
      if (v != null && v !== "" && !isNaN(parseFloat(v))) return parseFloat(v);
    }
    return null;
  }

  // =========================================================================
  // CORE FETCH + CACHE
  // =========================================================================

  async function _fetchAndCache(siteId) {
    try {
      var raw = await fetchTDRReadings(siteId, CONFIG.defaultDaysBack);
      var mapping = _state.siteMappings[siteId] || {};
      var parsed = _parseTDRResponse(raw, mapping);
      if (parsed) {
        _state.cache[siteId] = parsed;
        _state._lastFetch = new Date();
        _saveCache(siteId, parsed);
        console.log(
          "[SpecConnect] Fetched TDR data for site:",
          siteId,
          "— VWC:",
          parsed.vwc + "%",
          "readings:",
          parsed.readingCount,
          "zones:",
          parsed.zones.length,
        );
        document.dispatchEvent(new CustomEvent("gaip:specconnect:updated", { detail: parsed }));
      }
      return parsed;
    } catch (e) {
      console.warn("[SpecConnect] Fetch failed:", e.message);
      return null;
    }
  }

  // =========================================================================
  // SENSOR BRIDGE INTERFACE
  // (matches the interface expected by sensor-api-bridge.js)
  // =========================================================================

  function isEnabled() {
    return _state.enabled && !!_state.apiKey;
  }

  function hasData() {
    if (!isEnabled()) return false;
    var siteId = _getActiveSiteId();
    return !!(_state.cache[siteId] || _loadCache(siteId));
  }

  function getData() {
    if (!isEnabled()) return null;
    var siteId = _getActiveSiteId();
    return _state.cache[siteId] || _loadCache(siteId) || null;
  }

  function getIrrigationData() {
    var d = getData();
    if (!d) return null;
    return {
      vwc: d.vwc,
      ec: d.ec,
      soilTemp: d.soilTemp,
      source: d.source,
      fetchedAt: d.fetchedAt,
    };
  }

  function getZoneSummaries() {
    var d = getData();
    return d ? d.zones : [];
  }

  function getSiteId() {
    return _getActiveSiteId();
  }

  function getLastFetch() {
    return _state._lastFetch;
  }

  function isPolling() {
    return _state._polling;
  }

  function getSourceInfo() {
    return {
      name: "SpecConnect",
      type: "specconnect_tdr",
      version: CONFIG.version,
      enabled: isEnabled(),
      hasData: hasData(),
      lastFetch: _state._lastFetch ? _state._lastFetch.toISOString() : null,
      isPolling: _state._polling,
      equipment: _state.equipment.length,
      collections: _state.collections.length,
    };
  }

  // =========================================================================
  // POLLING
  // =========================================================================

  function startPolling(siteId) {
    if (_state._pollTimer) clearInterval(_state._pollTimer);
    _state._polling = true;

    // Initial fetch
    _fetchAndCache(siteId || _getActiveSiteId());

    _state._pollTimer = setInterval(function () {
      if (!isEnabled()) {
        stopPolling();
        return;
      }
      _fetchAndCache(_getActiveSiteId());
    }, CONFIG.pollIntervalMs);

    console.log("[SpecConnect] Started polling every", CONFIG.pollIntervalMs / 60000, "minutes");
  }

  function stopPolling() {
    if (_state._pollTimer) clearInterval(_state._pollTimer);
    _state._pollTimer = null;
    _state._polling = false;
  }

  // =========================================================================
  // RELOAD (called by SensorBridge on site-switch)
  // =========================================================================

  function reload(siteId) {
    siteId = siteId || _getActiveSiteId();
    if (!isEnabled()) return;

    // Try cache first for instant UI update
    var cached = _loadCache(siteId);
    if (cached) {
      _state.cache[siteId] = cached;
      document.dispatchEvent(new CustomEvent("gaip:specconnect:updated", { detail: cached }));
    }

    // Then fetch fresh in background
    // b35fix218e: _fetchAndCache rejects when SpecConnect server is unreachable.
    // Without .catch() every failed connect attempt (cURL error 7) fires an
    // Uncaught (in promise) in the console. Swallow silently — the error is
    // already logged inside _fetchAndCache via console.warn.
    _fetchAndCache(siteId).then(function () {
      if (!_state._polling) startPolling(siteId);
    }).catch(function () { /* network unreachable — logged inside _fetchAndCache */ });
  }

  // =========================================================================
  // SETUP UI
  // =========================================================================

  /**
   * Render the SpecConnect settings panel — injected into the sensor settings area.
   * Mirrors the Hydrosight settings panel structure.
   */
  function renderSettingsPanel(container) {
    if (!container) return;

    var siteId = _getActiveSiteId();
    var mapping = _state.siteMappings[siteId] || {};

    container.innerHTML =
      '<div class="gaip-specconnect-settings" style="padding:12px;background:var(--gaip-info-bg);border-radius:8px;border:1px solid #bae6fd;">' +
      '<div style="font-weight:600;color:#0369a1;margin-bottom:10px;">📡 SpecConnect (TDR 350/300)</div>' +
      // Enable toggle
      '<label style="display:flex;align-items:center;gap:8px;margin-bottom:10px;">' +
      '<input type="checkbox" id="gaip-sc-enabled"' +
      (_state.enabled ? " checked" : "") +
      ">" +
      "<span>Enable live SpecConnect data</span></label>" +
      // API key
      '<div style="margin-bottom:8px;">' +
      '<label style="font-size:11px;color:var(--gaip-text-secondary);display:block;margin-bottom:3px;">API Key</label>' +
      '<input type="password" id="gaip-sc-apikey" value="' +
      (_state.apiKey || "") +
      '" ' +
      'placeholder="Your SpecConnect customer API key" ' +
      'style="width:100%;padding:6px 8px;border:1px solid var(--gaip-border);border-radius:4px;font-size:13px;box-sizing:border-box;">' +
      "</div>" +
      // Collection name for this site
      '<div style="margin-bottom:8px;">' +
      '<label style="font-size:11px;color:var(--gaip-text-secondary);display:block;margin-bottom:3px;">Collection Name (this site)</label>' +
      '<input type="text" id="gaip-sc-collection" value="' +
      (mapping.collectionName || "") +
      '" ' +
      'placeholder="e.g. Elanora Country Club" ' +
      'style="width:100%;padding:6px 8px;border:1px solid var(--gaip-border);border-radius:4px;font-size:13px;box-sizing:border-box;">' +
      '<div style="font-size:10px;color:var(--gaip-text-muted);margin-top:2px;">Matches the collection name in your SpecConnect account</div>' +
      "</div>" +
      // Surface filter (optional)
      '<div style="margin-bottom:12px;">' +
      '<label style="font-size:11px;color:var(--gaip-text-secondary);display:block;margin-bottom:3px;">Surface Filter <span style="font-weight:normal;">(optional)</span></label>' +
      '<input type="text" id="gaip-sc-surface" value="' +
      (mapping.surfaceName || "") +
      '" ' +
      'placeholder="e.g. Greens (leave blank for all surfaces)" ' +
      'style="width:100%;padding:6px 8px;border:1px solid var(--gaip-border);border-radius:4px;font-size:13px;box-sizing:border-box;">' +
      "</div>" +
      // Save + Test buttons
      '<div style="display:flex;gap:8px;">' +
      '<button id="gaip-sc-save" style="flex:1;padding:7px;background:#0369a1;color:var(--gaip-surface);border:none;border-radius:4px;font-size:13px;cursor:pointer;">Save</button>' +
      '<button id="gaip-sc-test" style="padding:7px 12px;background:var(--gaip-info-bg);color:#0369a1;border:1px solid #bae6fd;border-radius:4px;font-size:13px;cursor:pointer;">Test</button>' +
      "</div>" +
      // Status area
      '<div id="gaip-sc-status" style="margin-top:8px;font-size:11px;"></div>' +
      "</div>";

    // Wire save
    container.querySelector("#gaip-sc-save").addEventListener("click", function () {
      _state.apiKey = container.querySelector("#gaip-sc-apikey").value.trim();
      _state.enabled = container.querySelector("#gaip-sc-enabled").checked;
      var col = container.querySelector("#gaip-sc-collection").value.trim();
      var surf = container.querySelector("#gaip-sc-surface").value.trim();
      if (col) {
        _state.siteMappings[siteId] = { collectionName: col, surfaceName: surf };
      }
      _save();
      var status = container.querySelector("#gaip-sc-status");
      status.style.color = "#059669";
      status.textContent = "✓ Saved";
      if (isEnabled()) reload(siteId);
    });

    // Wire test
    container.querySelector("#gaip-sc-test").addEventListener("click", async function () {
      var status = container.querySelector("#gaip-sc-status");
      status.style.color = "var(--gaip-text-secondary)";
      status.textContent = "Testing connection...";
      var testKey = container.querySelector("#gaip-sc-apikey").value.trim();
      if (!testKey) {
        status.style.color = "#dc2626";
        status.textContent = "Enter an API key first.";
        return;
      }
      try {
        // Test with GetCustomerEquipment — lightweight call
        var tempKey = _state.apiKey;
        _state.apiKey = testKey;
        var equipment = await fetchEquipment();
        _state.apiKey = tempKey;
        status.style.color = "#059669";
        status.textContent = "✓ Connected — " + equipment.length + " device(s) found";
      } catch (e) {
        status.style.color = "#dc2626";
        status.textContent = "✗ " + e.message;
      }
    });
  }

  // =========================================================================
  // INIT
  // =========================================================================

  function init() {
    _load();

    // Listen for site changes
    document.addEventListener("gaip:site-changed", function (e) {
      var newSiteId = (e.detail && e.detail.siteId) || _getActiveSiteId();
      console.log("[SpecConnect] Site changed —", isEnabled() ? "reloading" : "disabled");
      if (isEnabled()) reload(newSiteId);
    });

    // Listen for site-config-applied to start initial load
    document.addEventListener("gaip:site-config-applied", function () {
      if (isEnabled() && !_state._polling) {
        reload(_getActiveSiteId());
      }
    });

    // Inject settings UI when sensor settings panel opens
    document.addEventListener("gaip:sensor-settings-open", function (e) {
      var container = e.detail && e.detail.container;
      if (container) renderSettingsPanel(container);
    });

    if (isEnabled()) {
      console.log("[SpecConnect] v" + CONFIG.version + " loaded — enabled, awaiting site-config-applied");
    } else {
      console.log("[SpecConnect] v" + CONFIG.version + " loaded — disabled (configure API key in sensor settings)");
    }
  }

  // =========================================================================
  // EXPORT
  // =========================================================================

  global.GAIP_SpecConnect = {
    version: CONFIG.version,
    // SensorBridge interface
    isEnabled: isEnabled,
    hasData: hasData,
    getData: getData,
    getIrrigationData: getIrrigationData,
    getZoneSummaries: getZoneSummaries,
    getSiteId: getSiteId,
    getLastFetch: getLastFetch,
    isPolling: isPolling,
    getSourceInfo: getSourceInfo,
    reload: reload,
    // Setup
    renderSettingsPanel: renderSettingsPanel,
    fetchEquipment: fetchEquipment,
    fetchCollections: fetchCollections,
    // Config access
    getConfig: function () {
      return { enabled: _state.enabled, apiKey: _state.apiKey, siteMappings: _state.siteMappings };
    },
    setSiteMapping: function (siteId, col, surf) {
      _state.siteMappings[siteId] = { collectionName: col, surfaceName: surf || "" };
      _save();
    },
    // Key setter — called from Hydrosight settings panel save handler
    setCredentials: function (apiKey) {
      _state.apiKey = apiKey;
      _state.enabled = !!apiKey;
      _save();
    },
    // Test entry point for settings panel test button
    _vendorTest: async function (testKey) {
      var saved = _state.apiKey;
      _state.apiKey = testKey;
      try {
        var eq = await fetchEquipment();
        _state.apiKey = saved;
        return { success: true, deviceCount: eq.length };
      } catch (e) {
        _state.apiKey = saved;
        return { success: false, error: e.message };
      }
    },
    // WatchDog stub (v1.1.0)
    _watchdogStub: fetchCurrentConditions,
  };

  init();

  // =========================================================================
  // SENSOR MANAGER REGISTRATION
  // Plugs into the same vendor contract as Hydrosight so SensorBridge
  // can route SpecConnect data into irrigation + pre-emergent automatically.
  // =========================================================================

  var _vendorInterface = {
    id: "specconnect",
    name: "SpecConnect (TDR)",

    hasCredentials: function () { return !!_state.apiKey; },
    setCredentials: function (apiKey) { _state.apiKey = apiKey; _state.enabled = !!apiKey; _save(); },
    getCredentials: function () { return _state.apiKey; },

    isEnabled: isEnabled,
    hasData: hasData,
    getData: getIrrigationData,
    getZoneSummaries: getZoneSummaries,
    reload: reload,

    // testConnection: must return { success, sensors[], error? } for SensorManager contract
    testConnection: async function () {
      if (!_state.apiKey) return { success: false, error: "No API key configured", sensors: [] };
      try {
        var collections = await fetchCollections();
        var sensors = collections.map(function (c) {
          return { sensorId: c.CollectionId || c.collectionId || c.Name || c.name, name: c.Name || c.name || "Collection" };
        });
        return { success: true, sensors: sensors };
      } catch (e) {
        return { success: false, error: e.message, sensors: [] };
      }
    },

    // fetchAllSensors: returns collections as pseudo-sensors (TDR 350 is handheld)
    fetchAllSensors: async function () {
      try {
        var collections = await fetchCollections();
        return collections.map(function (c) {
          return { sensorId: c.CollectionId || c.collectionId || c.Name || c.name, name: c.Name || c.name || "Collection", locationId: null, coordinates: null, lastReadings: null };
        });
      } catch (e) {
        console.warn("[SpecConnect] fetchAllSensors failed:", e.message);
        return [];
      }
    },

    // fetchSensorData: fetches TDR readings for each mapped collection
    fetchSensorData: async function (sensorIds) {
      var readings = [];
      var activeSiteId = _getActiveSiteId();
      var mapping = _state.siteMappings[activeSiteId] || {};
      for (var i = 0; i < sensorIds.length; i++) {
        var colName = sensorIds[i];
        try {
          var now = new Date();
          var start = new Date(now.getTime() - CONFIG.defaultDaysBack * 24 * 60 * 60 * 1000);
          var ep = "/api/Customer/GetFSDataInDateRange?customerApiKey={key}&deviceType=" + encodeURIComponent(CONFIG.tdrDeviceType) +
            "&startDate=" + encodeURIComponent(_dateStr(start)) + "&endDate=" + encodeURIComponent(_dateStr(now)) +
            "&collectionName=" + encodeURIComponent(colName) + "&optUnits=1";
          var raw = await _proxyGet(ep);
          if (raw && raw.length > 0) {
            var parsed = _parseTDRResponse(raw, mapping);
            if (parsed) readings.push({ sensorId: colName, vwc: parsed.vwc, ec: parsed.ec, soilTemp: parsed.soilTemp, timestamp: parsed.fetchedAt, zones: parsed.zones });
          }
        } catch (e) {
          console.warn("[SpecConnect] fetchSensorData failed for", colName, ":", e.message);
        }
      }
      return readings;
    },

    // transformReading: normalise to SensorManager standard shape
    transformReading: function (raw) {
      return { vwc: raw.vwc != null ? raw.vwc : null, ec: raw.ec != null ? raw.ec : null, soilTemp: raw.soilTemp != null ? raw.soilTemp : null, timestamp: raw.timestamp || new Date().toISOString(), sensorId: raw.sensorId || null };
    },

    renderSettingsPanel: renderSettingsPanel,

    // Extra fields rendered inside the vendor section of sensor-integration-ui.js
    renderExtraFields: function () {
      var siteId = _getActiveSiteId();
      var mapping = _state.siteMappings[siteId] || {};
      return (
        '<div style="margin-bottom:8px;">' +
        '<label style="display:block;font-size:0.85em;margin-bottom:4px;">Collection Name <span style="font-weight:normal;color:var(--gaip-text-muted);">(this site)</span></label>' +
        '<input type="text" class="gaip-sc-collection" data-vendor="specconnect" ' +
        'placeholder="e.g. Elanora Country Club" value="' + (mapping.collectionName || '') + '" ' +
        'style="width:100%;padding:8px;border:1px solid var(--gaip-border);border-radius:4px;font-size:0.9em;margin-bottom:6px;"/>' +
        '<div style="font-size:10px;color:var(--gaip-text-muted);">Exact collection name from your SpecConnect account</div>' +
        '</div>' +
        '<div style="margin-bottom:10px;">' +
        '<label style="display:block;font-size:0.85em;margin-bottom:4px;">Surface Filter <span style="font-weight:normal;color:var(--gaip-text-muted);">(optional)</span></label>' +
        '<input type="text" class="gaip-sc-surface" data-vendor="specconnect" ' +
        'placeholder="e.g. Greens (blank = all surfaces)" value="' + (mapping.surfaceName || '') + '" ' +
        'style="width:100%;padding:8px;border:1px solid var(--gaip-border);border-radius:4px;font-size:0.9em;"/>' +
        '</div>'
      );
    },

    // Called by handleSaveCredentials in sensor-integration-ui after setCredentials
    saveExtraFields: function () {
      var siteId = _getActiveSiteId();
      var colEl = document.querySelector('.gaip-sc-collection[data-vendor="specconnect"]');
      var surfEl = document.querySelector('.gaip-sc-surface[data-vendor="specconnect"]');
      var col = colEl ? colEl.value.trim() : '';
      var surf = surfEl ? surfEl.value.trim() : '';
      if (col) {
        _state.siteMappings[siteId] = { collectionName: col, surfaceName: surf };
        _save();
      }
    },
  };

  // Register when SensorManager is available
  function _registerWithSensorManager() {
    if (global.GAIP_SensorManager && typeof global.GAIP_SensorManager.registerVendor === "function") {
      global.GAIP_SensorManager.registerVendor(_vendorInterface);
      console.log("[SpecConnect] Registered with SensorManager");
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("gaip:sensorManager:ready", _registerWithSensorManager);
    document.addEventListener("DOMContentLoaded", function () {
      setTimeout(_registerWithSensorManager, 200);
    });
  } else {
    setTimeout(_registerWithSensorManager, 200);
  }
})(window);
