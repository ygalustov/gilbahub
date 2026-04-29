/**
 * Gilba Hub v2 — Climate Engine
 * ============================================================================
 * Phase 2 extraction: Pure calculation engine + async data fetcher
 *
 * Architecture:
 *   ClimateDataService  — async side-effect: fetches Open-Meteo data
 *   ClimateEngine       — pure compute: processes raw data into metrics
 *
 * The engine registers with GilbaHub.engines and is called by the orchestrator.
 * The data service is called separately (before orchestration) because the
 * orchestrator's compute loop is synchronous by design.
 *
 * Data flow:
 *   1. ClimateDataService.fetch(lat, lon, opts) → raw API data
 *   2. Store raw data: GilbaHub.store.set('inputs.climate._raw', rawData)
 *   3. Orchestrator calls ClimateEngine.compute(inputs, computed, derived)
 *   4. Engine reads inputs.climate._raw, produces climateMetrics
 *   5. Output stored at computed.climate
 *
 * @version 2.0.0
 * @requires gilba-hub-v2.js (core infrastructure)
 */

(function () {
  'use strict';

  // ---------------------------------------------------------------------------
  // Constants
  // ---------------------------------------------------------------------------

  const OPEN_METEO_FORECAST = 'https://api.open-meteo.com/v1/forecast';
  const OPEN_METEO_HISTORICAL = 'https://archive-api.open-meteo.com/v1/archive';

  const FORECAST_HOURLY_VARS = [
    'temperature_2m',
    'relative_humidity_2m',
    'dew_point_2m',
    'precipitation',
    'rain',
    'cloud_cover',
    'wind_speed_10m',
    'wind_gusts_10m',
    'shortwave_radiation',
    'et0_fao_evapotranspiration',
    'soil_temperature_0_to_7cm',
    'soil_moisture_0_to_7cm'
  ];

  const FORECAST_DAILY_VARS = [
    'temperature_2m_max',
    'temperature_2m_min',
    'temperature_2m_mean',
    'precipitation_sum',
    'rain_sum',
    'et0_fao_evapotranspiration',
    'shortwave_radiation_sum',
    'wind_speed_10m_max',
    'wind_gusts_10m_max',
    'sunrise',
    'sunset'
  ];

  // Growth potential curve coefficients (Kreuser & Soldat 2011)
  const GPP_COEFFICIENTS = {
    c3: { optMin: 15.6, optMax: 23.9, varLow: 6.8, varHigh: 6.8 },
    c4: { optMin: 31.1, optMax: 35.0, varLow: 9.0, varHigh: 9.0 }
  };

  // Stress thresholds (°C unless noted)
  const STRESS_THRESHOLDS = {
    heat: {
      c3: { moderate: 28, high: 33, severe: 38 },
      c4: { moderate: 38, high: 42, severe: 45 }
    },
    cold: {
      c3: { moderate: 2, high: -2, severe: -8 },
      c4: { moderate: 10, high: 5, severe: 0 }
    },
    drought: {
      et_ratio_warn: 1.5,    // ET:precip ratio
      et_ratio_critical: 3.0
    },
    moisture: {
      consecutive_wet_days: 3,
      daily_precip_heavy: 25  // mm
    }
  };

  // Soil thermal diffusivity defaults (m²/s × 10⁻⁷)
  const SOIL_DIFFUSIVITY = {
    sand:       8.0,
    loamy_sand: 7.0,
    sandy_loam: 6.5,
    loam:       5.5,
    silt_loam:  5.0,
    clay_loam:  4.5,
    clay:       4.0,
    peat:       2.5,
    default:    5.5
  };

  // ---------------------------------------------------------------------------
  // Utility functions
  // ---------------------------------------------------------------------------

  function avg(arr) {
    if (!arr || arr.length === 0) return null;
    const valid = arr.filter(v => v != null && !isNaN(v));
    if (valid.length === 0) return null;
    return valid.reduce((a, b) => a + b, 0) / valid.length;
  }

  function clamp(v, lo, hi) {
    return Math.max(lo, Math.min(hi, v));
  }

  function round(v, dp = 1) {
    if (v == null) return null;
    const f = Math.pow(10, dp);
    return Math.round(v * f) / f;
  }

  /**
   * Format a Date to YYYY-MM-DD
   */
  function fmtDate(d) {
    return d.toISOString().slice(0, 10);
  }

  /**
   * Solar MJ/m² → mol/m²/d  (PAR approximation)
   * 1 MJ/m² ≈ 2.04 mol PAR (McCree 1972, Thimijan & Heins 1983)
   */
  function mjToDLI(mj) {
    return mj != null ? round(mj * 2.04, 1) : null;
  }

  // ---------------------------------------------------------------------------
  // ClimateDataService — async fetcher (side-effect boundary)
  // ---------------------------------------------------------------------------

  const ClimateDataService = {

    /**
     * Fetch climate data from Open-Meteo.
     * Returns raw API responses, not processed metrics.
     *
     * @param {number} lat   Latitude
     * @param {number} lon   Longitude
     * @param {object} opts  Options
     * @param {boolean}  opts.historical       Include 90-day lookback
     * @param {string}   opts.timezone         IANA timezone (auto-detected if null)
     * @param {number}   opts.forecastDays     Forecast horizon (default 16)
     * @param {number}   opts.historicalDays   Historical lookback (default 90)
     * @returns {Promise<object>} Raw climate data
     */
    async fetch(lat, lon, opts = {}) {
      const {
        historical = false,
        timezone = null,
        forecastDays = 16,
        historicalDays = 90
      } = opts;

      const result = {
        forecast: null,
        historical: null,
        fetchedAt: new Date().toISOString(),
        location: { latitude: lat, longitude: lon },
        errors: []
      };

      // --- Forecast ---
      try {
        result.forecast = await this._fetchForecast(lat, lon, timezone, forecastDays);
      } catch (err) {
        console.error('[ClimateDataService] Forecast fetch failed:', err);
        result.errors.push({ type: 'forecast', message: err.message });
      }

      // --- Historical (optional) ---
      if (historical) {
        try {
          result.historical = await this._fetchHistorical(lat, lon, timezone, historicalDays);
        } catch (err) {
          console.error('[ClimateDataService] Historical fetch failed:', err);
          result.errors.push({ type: 'historical', message: err.message });
        }
      }

      return result;
    },

    async _fetchForecast(lat, lon, tz, days) {
      const params = new URLSearchParams({
        latitude: lat,
        longitude: lon,
        hourly: FORECAST_HOURLY_VARS.join(','),
        daily: FORECAST_DAILY_VARS.join(','),
        forecast_days: days,
        timezone: tz || 'auto'
      });

      const resp = await fetch(`${OPEN_METEO_FORECAST}?${params}`);
      if (!resp.ok) throw new Error(`Open-Meteo forecast: ${resp.status}`);
      return resp.json();
    },

    async _fetchHistorical(lat, lon, tz, days) {
      const end = new Date();
      const start = new Date();
      start.setDate(start.getDate() - days);

      const params = new URLSearchParams({
        latitude: lat,
        longitude: lon,
        start_date: fmtDate(start),
        end_date: fmtDate(end),
        daily: [
          'temperature_2m_max',
          'temperature_2m_min',
          'temperature_2m_mean',
          'precipitation_sum',
          'et0_fao_evapotranspiration',
          'shortwave_radiation_sum'
        ].join(','),
        timezone: tz || 'auto'
      });

      const resp = await fetch(`${OPEN_METEO_HISTORICAL}?${params}`);
      if (!resp.ok) throw new Error(`Open-Meteo historical: ${resp.status}`);
      return resp.json();
    }
  };


  // ---------------------------------------------------------------------------
  // Pure calculation functions
  // ---------------------------------------------------------------------------

  /**
   * Growth Potential (GPP) — Kreuser & Soldat 2011
   * Uses the standard bell-curve model adopted by GCSAA.
   */
  function calcGPP(tempC, type = 'c3') {
    if (tempC == null) return null;
    const c = GPP_COEFFICIENTS[type];
    if (!c) return null;

    const optMid = (c.optMin + c.optMax) / 2;

    if (tempC < c.optMin) {
      // Below optimum — left side of curve
      const dist = c.optMin - tempC;
      return round(Math.exp(-0.5 * Math.pow(dist / c.varLow, 2)), 3);
    }
    if (tempC > c.optMax) {
      // Above optimum — right side of curve
      const dist = tempC - c.optMax;
      return round(Math.exp(-0.5 * Math.pow(dist / c.varHigh, 2)), 3);
    }
    // Within optimum range
    return 1.0;
  }

  /**
   * Weighted growth potential for a turf profile with mixed C3/C4.
   */
  function calcWeightedGPP(tempC, c3Fraction, c4Fraction) {
    const c3 = calcGPP(tempC, 'c3');
    const c4 = calcGPP(tempC, 'c4');

    if (c3 == null && c4 == null) return { weighted: null, c3: null, c4: null };

    const total = (c3Fraction || 0) + (c4Fraction || 0);
    if (total === 0) return { weighted: c3 || c4, c3, c4 };

    const w = ((c3 || 0) * (c3Fraction / total)) + ((c4 || 0) * (c4Fraction / total));
    return { weighted: round(w, 3), c3, c4 };
  }

  /**
   * Growing Degree Days (GDD) from hourly temperatures.
   * Uses the standard (Tavg - Tbase) / 24 hourly accumulation.
   */
  function calcGDD(hourlyTemps, baseTemp) {
    if (!hourlyTemps || hourlyTemps.length === 0 || baseTemp == null) return null;

    let gdd = 0;
    for (const t of hourlyTemps) {
      if (t != null && t > baseTemp) {
        gdd += (t - baseTemp) / 24;
      }
    }
    return round(gdd, 1);
  }

  /**
   * Estimate soil temperature at depth from air temperature.
   * Uses the analytical solution to the heat equation for a semi-infinite solid
   * with sinusoidal surface forcing (Hillel 1982).
   *
   * @param {number} airTempMean   Mean air temp (°C)
   * @param {number} airTempAmp    Daily amplitude (Tmax - Tmin) / 2 (°C)
   * @param {number} depth         Depth in metres
   * @param {string} texture       Soil texture class
   * @param {number} apiSoilTemp   Open-Meteo soil temp (if available)
   * @returns {object} Soil temp estimate with reliability
   */
  function estimateSoilTemp(airTempMean, airTempAmp, depth, texture, apiSoilTemp) {
    const result = {
      estimated: null,
      source: null,
      reliability: 0,
      depths: {}
    };

    // Priority 1: API soil temperature at shallow depth
    if (apiSoilTemp != null) {
      result.estimated = round(apiSoilTemp, 1);
      result.source = 'api';
      result.reliability = 85;
      result.depths.d50mm = round(apiSoilTemp, 1);

      // Extrapolate deeper using damping
      if (airTempMean != null && airTempAmp != null) {
        const alpha = (SOIL_DIFFUSIVITY[texture] || SOIL_DIFFUSIVITY.default) * 1e-7;
        const omega = (2 * Math.PI) / 86400; // daily frequency
        const dampingLength = Math.sqrt(2 * alpha / omega);

        result.depths.d100mm = round(
          airTempMean + airTempAmp * Math.exp(-0.1 / dampingLength), 1
        );
        result.depths.d200mm = round(
          airTempMean + airTempAmp * Math.exp(-0.2 / dampingLength), 1
        );
      }
      return result;
    }

    // Priority 2: Analytical model from air temperature
    if (airTempMean != null && airTempAmp != null) {
      const alpha = (SOIL_DIFFUSIVITY[texture] || SOIL_DIFFUSIVITY.default) * 1e-7;
      const omega = (2 * Math.PI) / 86400;
      const dampingLength = Math.sqrt(2 * alpha / omega);

      const targetDepth = depth || 0.05; // default 50mm
      const dampedAmp = airTempAmp * Math.exp(-targetDepth / dampingLength);

      result.estimated = round(airTempMean + dampedAmp * 0.5, 1); // phase-averaged
      result.source = 'model';
      result.reliability = 60;

      // Standard depths
      for (const [key, d] of Object.entries({ d20mm: 0.02, d50mm: 0.05, d100mm: 0.1, d200mm: 0.2 })) {
        const amp = airTempAmp * Math.exp(-d / dampingLength);
        result.depths[key] = round(airTempMean + amp * 0.5, 1);
      }
      return result;
    }

    // Priority 3: Crude approximation — soil lags air by ~2°C in mild conditions
    if (airTempMean != null) {
      result.estimated = round(airTempMean - 1.5, 1);
      result.source = 'crude';
      result.reliability = 30;
      return result;
    }

    return result;
  }

  /**
   * Classify stress from daily forecast data.
   */
  function classifyStress(dailyData, isC4) {
    if (!dailyData || !dailyData.temperature_2m_max) return null;

    const type = isC4 ? 'c4' : 'c3';
    const th = STRESS_THRESHOLDS;
    const maxTemps = dailyData.temperature_2m_max;
    const minTemps = dailyData.temperature_2m_min;
    const precip = dailyData.precipitation_sum || [];
    const et = dailyData.et0_fao_evapotranspiration || [];

    const stress = {
      heat: { days: 0, severity: 'none', peakTemp: null, peakDay: null },
      cold: { days: 0, severity: 'none', minTemp: null, minDay: null },
      drought: { severity: 'none', etPrecipRatio: null },
      moisture: { consecutiveWetDays: 0, severity: 'none' }
    };

    // -- Heat stress --
    let peakT = -Infinity;
    for (let i = 0; i < maxTemps.length; i++) {
      const t = maxTemps[i];
      if (t == null) continue;
      if (t > th.heat[type].moderate) stress.heat.days++;
      if (t > peakT) { peakT = t; stress.heat.peakTemp = t; stress.heat.peakDay = i; }
    }
    if (peakT >= th.heat[type].severe) stress.heat.severity = 'severe';
    else if (peakT >= th.heat[type].high) stress.heat.severity = 'high';
    else if (peakT >= th.heat[type].moderate) stress.heat.severity = 'moderate';

    // -- Cold stress --
    let minT = Infinity;
    for (let i = 0; i < (minTemps || []).length; i++) {
      const t = minTemps[i];
      if (t == null) continue;
      if (t < th.cold[type].moderate) stress.cold.days++;
      if (t < minT) { minT = t; stress.cold.minTemp = t; stress.cold.minDay = i; }
    }
    if (minT <= th.cold[type].severe) stress.cold.severity = 'severe';
    else if (minT <= th.cold[type].high) stress.cold.severity = 'high';
    else if (minT <= th.cold[type].moderate) stress.cold.severity = 'moderate';

    // -- Drought stress (ET:precip ratio over forecast window) --
    const totalET = et.reduce((a, b) => a + (b || 0), 0);
    const totalPrecip = precip.reduce((a, b) => a + (b || 0), 0);
    if (totalET > 0) {
      stress.drought.etPrecipRatio = round(totalPrecip > 0 ? totalET / totalPrecip : 999, 1);
      if (stress.drought.etPrecipRatio >= th.drought.et_ratio_critical) {
        stress.drought.severity = 'high';
      } else if (stress.drought.etPrecipRatio >= th.drought.et_ratio_warn) {
        stress.drought.severity = 'moderate';
      }
    }

    // -- Moisture stress (consecutive wet days) --
    let consecutive = 0;
    let maxConsecutive = 0;
    for (const p of precip) {
      if (p != null && p > 1) {
        consecutive++;
        maxConsecutive = Math.max(maxConsecutive, consecutive);
      } else {
        consecutive = 0;
      }
    }
    stress.moisture.consecutiveWetDays = maxConsecutive;
    if (maxConsecutive >= th.moisture.consecutive_wet_days) {
      stress.moisture.severity = 'moderate';
    }
    // Check for heavy single-day events
    if (precip.some(p => p != null && p >= th.moisture.daily_precip_heavy)) {
      stress.moisture.severity = 'high';
    }

    return stress;
  }

  /**
   * Build daily forecast array for downstream engines (irrigation, disease, etc.)
   */
  function buildDailyForecast(dailyData) {
    if (!dailyData || !dailyData.time) return [];

    return dailyData.time.map((date, i) => ({
      date,
      temp_max: dailyData.temperature_2m_max?.[i] ?? null,
      temp_min: dailyData.temperature_2m_min?.[i] ?? null,
      temp_mean: dailyData.temperature_2m_mean?.[i] ?? null,
      precipitation: dailyData.precipitation_sum?.[i] ?? null,
      et0: dailyData.et0_fao_evapotranspiration?.[i] ?? null,
      radiation_mj: dailyData.shortwave_radiation_sum?.[i] ?? null,
      wind_max: dailyData.wind_speed_10m_max?.[i] ?? null,
      wind_gust_max: dailyData.wind_gusts_10m_max?.[i] ?? null,
      sunrise: dailyData.sunrise?.[i] ?? null,
      sunset: dailyData.sunset?.[i] ?? null
    }));
  }


  // ---------------------------------------------------------------------------
  // ClimateEngine — the registered engine
  // ---------------------------------------------------------------------------

  const ClimateEngine = {
    id: 'climate-engine',
    label: 'Climate Analysis',
    category: 'environment',
    tier: 1,
    inputs: ['climate', 'turf', 'site', 'soilTemp', 'sensor'],
    engines: [],  // No engine dependencies — this is a tier 1 root engine
    outputs: ['computed.climate'],
    description: 'Processes raw weather data into growth potential, stress metrics, soil temperature, and forecast arrays consumed by all downstream engines.',

    /**
     * Pure compute function called by the orchestrator.
     *
     * Reads:
     *   inputs.climate._raw        — raw Open-Meteo response (set by ClimateDataService)
     *   inputs.climate.source      — 'api' | 'manual' | 'default'
     *   inputs.climate.manual      — manual overrides (if source === 'manual')
     *   inputs.turf                — species info for C3/C4 fractions
     *   inputs.site                — lat/lon for validation
     *   inputs.soilTemp            — sensor soil temps (if available)
     *   inputs.sensor              — sensor data (VWC, EC)
     *
     * Returns:
     *   The full climateMetrics object stored at computed.climate
     */
    compute(inputs, _computed, _derived) {
      const raw = inputs.climate?._raw;
      const manual = inputs.climate?.manual;
      const turf = inputs.turf || {};
      const sensor = inputs.sensor || {};
      const sensorSoilTemp = inputs.soilTemp?.current;

      // Determine data source
      const source = raw?.forecast ? 'api'
        : manual ? 'manual'
        : 'default';

      // Build from the appropriate source
      let metrics;
      if (source === 'api') {
        metrics = this._fromAPI(raw, turf, sensorSoilTemp);
      } else if (source === 'manual') {
        metrics = this._fromManual(manual, turf);
      } else {
        metrics = this._defaults(turf);
      }

      // Attach metadata
      metrics._meta = {
        engineId: 'climate-engine',
        computedAt: new Date().toISOString(),
        source,
        confidence: source === 'api' ? 90 : source === 'manual' ? 70 : 30,
        confidenceLevel: source === 'api' ? 'high' : source === 'manual' ? 'medium' : 'low',
        dataQuality: {
          source,
          reliability: source === 'api' ? 90 : source === 'manual' ? 70 : 30,
          fetchedAt: raw?.fetchedAt || null,
          staleAfterMs: 3600000, // 1 hour
          warning: source === 'default' ? 'No climate data available — using defaults' : null
        },
        citations: [
          { ref: 'Kreuser & Soldat 2011', context: 'C3/C4 growth potential model' },
          { ref: 'Hillel 1982', context: 'Soil temperature damping model' }
        ],
        warnings: []
      };

      // Check staleness
      if (raw?.fetchedAt) {
        const age = Date.now() - new Date(raw.fetchedAt).getTime();
        if (age > 7200000) { // 2 hours
          metrics._meta.warnings.push('Climate data is more than 2 hours old');
          metrics._meta.confidence = Math.max(metrics._meta.confidence - 10, 30);
        }
      }

      // Sensor override for soil temp
      if (sensor.available && sensor.soilTemp != null) {
        metrics.soilTemp.estimated = sensor.soilTemp;
        metrics.soilTemp.source = 'sensor';
        metrics.soilTemp.reliability = 95;
        metrics._meta.warnings = metrics._meta.warnings.filter(
          w => !w.includes('soil temp')
        );
      }

      return metrics;
    },

    // -------------------------------------------------------------------------
    // Private: build metrics from API response
    // -------------------------------------------------------------------------

    _fromAPI(raw, turf, sensorSoilTemp) {
      const hourly = raw.forecast?.hourly || {};
      const daily = raw.forecast?.daily || {};

      // --- Temperature ---
      const airTemps = hourly.temperature_2m || [];
      const tempMean = avg(airTemps);
      const tempMax = airTemps.length ? Math.max(...airTemps.filter(v => v != null)) : null;
      const tempMin = airTemps.length ? Math.min(...airTemps.filter(v => v != null)) : null;
      const tempCurrent = airTemps.length ? airTemps[airTemps.length > 0 ? Math.min(new Date().getHours(), airTemps.length - 1) : 0] : null;

      // --- Humidity / Dewpoint ---
      const rh = hourly.relative_humidity_2m || [];
      const dp = hourly.dew_point_2m || [];

      // --- Precipitation ---
      const precipDaily = daily.precipitation_sum || [];
      const precipTotal = precipDaily.reduce((a, b) => a + (b || 0), 0);

      // --- ET ---
      const etDaily = daily.et0_fao_evapotranspiration || [];
      const etTotal = etDaily.reduce((a, b) => a + (b || 0), 0);

      // --- Wind ---
      const windHourly = hourly.wind_speed_10m || [];
      const gustHourly = hourly.wind_gusts_10m || [];

      // --- Solar ---
      const radHourly = hourly.shortwave_radiation || [];
      const radDailySum = daily.shortwave_radiation_sum || [];
      const avgDailyMJ = avg(radDailySum);

      // --- Growth Potential ---
      // b35fix297: GP is a daily metric (Kreuser & Soldat 2011). Use today's
      // daily mean, not the multi-day hourly average which dampens shoulder-season
      // signals. Aligns hub GP with field log analysis calculation.
      const c3Frac = turf.c3Fraction ?? (turf.isC4 ? 0 : 1);
      const c4Frac = turf.c4Fraction ?? (turf.isC4 ? 1 : 0);
      const todayDailyMean = (daily.temperature_2m_mean || [])[0];
      const tempForGP = todayDailyMean != null ? todayDailyMean : tempMean;
      const gpp = calcWeightedGPP(tempForGP, c3Frac, c4Frac);

      // --- GDD ---
      const gddBase = turf.isC4 ? 10 : 0;
      const gddToday = calcGDD(airTemps.slice(0, 24), gddBase);

      // --- Soil Temperature ---
      const apiSoilTemp = avg(hourly.soil_temperature_0_to_7cm || []);
      const soilTexture = this._resolveSoilTexture(null); // Will be fed from inputs.soil in future
      const tempAmp = (tempMax != null && tempMin != null) ? (tempMax - tempMin) / 2 : null;
      const soilTemp = estimateSoilTemp(tempMean, tempAmp, 0.05, soilTexture, sensorSoilTemp || apiSoilTemp);

      // --- Stress classification ---
      const stress = classifyStress(daily, turf.isC4);

      // --- Daily forecast array for downstream engines ---
      const forecast = buildDailyForecast(daily);

      return {
        source: 'api',
        temperature: {
          current: round(tempCurrent),
          min: round(tempMin),
          max: round(tempMax),
          mean: round(tempMean)
        },
        humidity: {
          current: rh.length ? round(rh[Math.min(new Date().getHours(), rh.length - 1)]) : null,
          mean: round(avg(rh))
        },
        dewpoint: {
          current: dp.length ? round(dp[Math.min(new Date().getHours(), dp.length - 1)]) : null,
          mean: round(avg(dp))
        },
        precipitation: {
          total: round(precipTotal),
          daily: precipDaily.map(v => round(v)),
          forecast: forecast.map(d => ({
            date: d.date,
            amount: d.precipitation
          }))
        },
        et: {
          total: round(etTotal),
          daily: round(avg(etDaily)),
          values: etDaily.map(v => round(v))
        },
        wind: {
          mean: round(avg(windHourly)),
          max: gustHourly.length ? round(Math.max(...gustHourly.filter(v => v != null))) : null
        },
        solar: {
          dli: mjToDLI(avgDailyMJ),
          avgMJ: round(avgDailyMJ),
          dailyMJ: radDailySum.map(v => round(v))
        },
        growthPotential: {
          weighted: gpp.weighted,
          c3: gpp.c3,
          c4: gpp.c4,
          c3Fraction: c3Frac,
          c4Fraction: c4Frac
        },
        gdd: {
          today: gddToday,
          base: gddBase
        },
        soilTemp,
        stress,
        forecast,
        // Raw hourly arrays for engines that need them (dew, disease)
        hourly: {
          temperature: airTemps,
          humidity: rh,
          dewpoint: dp,
          cloudCover: hourly.cloud_cover || [],
          wind: windHourly,
          radiation: radHourly,
          soilTemp: hourly.soil_temperature_0_to_7cm || [],
          soilMoisture: hourly.soil_moisture_0_to_7cm || [],
          precipitation: hourly.precipitation || [],
          time: hourly.time || []
        },
        quality: {
          overall: 'good',
          source: 'api',
          issues: [],
          fetchedAt: null  // Will be set from _raw.fetchedAt
        }
      };
    },

    // -------------------------------------------------------------------------
    // Private: build metrics from manual inputs
    // -------------------------------------------------------------------------

    _fromManual(manual, turf) {
      const tempMean = manual.temperature ?? manual.temp ?? null;
      const tempMax = manual.temperatureMax ?? manual.tempMax ?? tempMean;
      const tempMin = manual.temperatureMin ?? manual.tempMin ?? tempMean;
      const humidity = manual.humidity ?? manual.rh ?? null;

      const c3Frac = turf.c3Fraction ?? (turf.isC4 ? 0 : 1);
      const c4Frac = turf.c4Fraction ?? (turf.isC4 ? 1 : 0);
      const gpp = calcWeightedGPP(tempMean, c3Frac, c4Frac);

      return {
        source: 'manual',
        temperature: {
          current: round(tempMean),
          min: round(tempMin),
          max: round(tempMax),
          mean: round(tempMean)
        },
        humidity: {
          current: humidity != null ? round(humidity) : null,
          mean: humidity != null ? round(humidity) : null
        },
        dewpoint: {
          current: null,
          mean: null
        },
        precipitation: {
          total: round(manual.precipitation ?? manual.rain ?? 0),
          daily: [],
          forecast: []
        },
        et: {
          total: round(manual.et ?? manual.et0 ?? null),
          daily: round(manual.et ?? manual.et0 ?? null),
          values: []
        },
        wind: {
          mean: round(manual.windSpeed ?? manual.wind ?? null),
          max: round(manual.windGust ?? null)
        },
        solar: {
          dli: manual.dli ?? null,
          avgMJ: manual.solarMJ ?? null,
          dailyMJ: []
        },
        growthPotential: {
          weighted: gpp.weighted,
          c3: gpp.c3,
          c4: gpp.c4,
          c3Fraction: c3Frac,
          c4Fraction: c4Frac
        },
        gdd: {
          today: null,
          base: turf.isC4 ? 10 : 0
        },
        soilTemp: estimateSoilTemp(
          tempMean,
          tempMax != null && tempMin != null ? (tempMax - tempMin) / 2 : null,
          0.05,
          'default',
          manual.soilTemp ?? null
        ),
        stress: null,
        forecast: [],
        hourly: null,
        quality: {
          overall: 'fair',
          source: 'manual',
          issues: ['Manual input — forecast-dependent features unavailable'],
          fetchedAt: null
        }
      };
    },

    // -------------------------------------------------------------------------
    // Private: safe defaults when no climate data is available
    // -------------------------------------------------------------------------

    _defaults(turf) {
      const c3Frac = turf.c3Fraction ?? (turf.isC4 ? 0 : 1);
      const c4Frac = turf.c4Fraction ?? (turf.isC4 ? 1 : 0);

      return {
        source: 'default',
        temperature: { current: null, min: null, max: null, mean: null },
        humidity: { current: null, mean: null },
        dewpoint: { current: null, mean: null },
        precipitation: { total: null, daily: [], forecast: [] },
        et: { total: null, daily: null, values: [] },
        wind: { mean: null, max: null },
        solar: { dli: null, avgMJ: null, dailyMJ: [] },
        growthPotential: {
          weighted: null,
          c3: null,
          c4: null,
          c3Fraction: c3Frac,
          c4Fraction: c4Frac
        },
        gdd: { today: null, base: turf.isC4 ? 10 : 0 },
        soilTemp: { estimated: null, source: null, reliability: 0, depths: {} },
        stress: null,
        forecast: [],
        hourly: null,
        quality: {
          overall: 'poor',
          source: 'default',
          issues: ['No climate data available'],
          fetchedAt: null
        }
      };
    },

    _resolveSoilTexture(soilInputs) {
      if (!soilInputs?.texture) return 'default';
      const t = String(soilInputs.texture).toLowerCase().replace(/\s+/g, '_');
      return SOIL_DIFFUSIVITY[t] ? t : 'default';
    }
  };


  // ---------------------------------------------------------------------------
  // Climate Fetch Coordinator
  // ---------------------------------------------------------------------------
  // Bridges the async fetch (side-effect) with the sync compute (pure).
  // Listens for location changes, triggers fetch, stores raw data,
  // then triggers recomputation.
  // ---------------------------------------------------------------------------

  const ClimateFetchCoordinator = {
    _fetchInProgress: false,
    _lastFetchKey: null,
    _refreshIntervalMs: 3600000, // 1 hour
    _refreshTimer: null,

    /**
     * Initialise the coordinator. Call after GilbaHub core is ready.
     */
    init() {
      const hub = this._getHub();
      if (!hub) {
        console.warn('[ClimateFetchCoordinator] GilbaHub not found, deferring init');
        return;
      }

      // Fetch after page-load config restore — this is the primary init path.
      // inputs.site is null at coordinator init; site-config-applied fires ~1600ms
      // later once persistence has restored the active site's location to DOM.
      hub.events.on('site:config-applied', () => {
        const latEl = document.querySelector('.gaip-lat');
        const lonEl = document.querySelector('.gaip-lon');
        if (latEl && lonEl) {
          const lat = parseFloat(latEl.value);
          const lon = parseFloat(lonEl.value);
          if (!isNaN(lat) && !isNaN(lon)) {
            hub.store.set('inputs.site', {
              ...(hub.store.peek('inputs.site') || {}),
              latitude: lat,
              longitude: lon,
            }, 'climate-config-applied');
            this.fetchAndStore(lat, lon);
          }
        }
      });

      // Refetch on site switch — site:changed fires with no coords in payload,
      // so read from the DOM inputs which site-config-persistence has already updated
      hub.events.on('site:changed', () => {
        const latEl = document.querySelector('.gaip-lat');
        const lonEl = document.querySelector('.gaip-lon');
        if (latEl && lonEl) {
          const lat = parseFloat(latEl.value);
          const lon = parseFloat(lonEl.value);
          if (!isNaN(lat) && !isNaN(lon)) {
            hub.store.set('inputs.site', {
              ...(hub.store.peek('inputs.site') || {}),
              latitude: lat,
              longitude: lon,
            }, 'climate-site-switch');
            this.fetchAndStore(lat, lon);
          }
        }
      });

      // Listen for location changes
      // Legacy events use lat/lon keys; v2 canonical uses latitude/longitude
      hub.events.on('location:changed', (payload) => {
        const lat = payload?.latitude ?? payload?.lat;
        const lon = payload?.longitude ?? payload?.lon;
        if (lat && lon) {
          // Write to inputs.site so restore paths and region detection work
          hub.store.set('inputs.site', {
            ...(hub.store.peek('inputs.site') || {}),
            latitude: lat,
            longitude: lon,
          }, 'climate-location-sync');
          this.fetchAndStore(lat, lon);
        }
      });

      hub.events.on('location:restored', (payload) => {
        const lat = payload?.latitude ?? payload?.lat;
        const lon = payload?.longitude ?? payload?.lon;
        if (lat && lon) {
          hub.store.set('inputs.site', {
            ...(hub.store.peek('inputs.site') || {}),
            latitude: lat,
            longitude: lon,
          }, 'climate-location-sync');
          this.fetchAndStore(lat, lon);
          return;
        }
        // Fallback: read from store if payload has no coords
        const site = hub.store.peek('inputs.site');
        if (site?.latitude && site?.longitude) {
          this.fetchAndStore(site.latitude, site.longitude);
        }
      });

      // Initial fetch if location already set
      const site = hub.store.peek('inputs.site');
      if (site?.latitude && site?.longitude) {
        this.fetchAndStore(site.latitude, site.longitude);
      }

      console.log('[ClimateFetchCoordinator] Initialised');
    },

    /**
     * Fetch weather data and write to store, triggering engine recomputation.
     */
    async fetchAndStore(lat, lon, opts = {}) {
      if (!lat || !lon) return;

      const fetchKey = `${lat.toFixed(4)},${lon.toFixed(4)}`;
      if (this._fetchInProgress && fetchKey === this._lastFetchKey) return;

      this._fetchInProgress = true;
      this._lastFetchKey = fetchKey;

      const hub = this._getHub();
      if (!hub) return;

      try {
        hub.events.emit('climate:fetched', { status: 'fetching', lat, lon });

        const raw = await ClimateDataService.fetch(lat, lon, {
          historical: opts.historical ?? false,
          timezone: hub.store.peek('inputs.site.timezone'),
          forecastDays: opts.forecastDays ?? 16
        });

        // Store raw data — this triggers the engine via selective compute
        hub.store.set('inputs.climate._raw', raw, 'climate-fetch');
        hub.store.set('inputs.climate.source', 'api', 'climate-fetch');

        hub.events.emit('climate:fetched', { status: 'complete', lat, lon });

        // Schedule refresh
        this._scheduleRefresh(lat, lon, opts);

        // Trigger selective recomputation
        await hub.orchestrator.computeSelective('climate');

        hub.events.emit('climate:metrics-ready', {});

      } catch (err) {
        console.error('[ClimateFetchCoordinator] Fetch failed:', err);
        hub.events.emit('climate:fetched', { status: 'error', error: err.message });
      } finally {
        this._fetchInProgress = false;
      }
    },

    /**
     * Force a refresh, bypassing the dedup check.
     */
    async refresh() {
      this._lastFetchKey = null;
      const site = this._getHub()?.store.peek('inputs.site');
      if (site?.latitude && site?.longitude) {
        await this.fetchAndStore(site.latitude, site.longitude);
      }
    },

    _scheduleRefresh(lat, lon, opts) {
      if (this._refreshTimer) clearInterval(this._refreshTimer);
      this._refreshTimer = setInterval(() => {
        this._lastFetchKey = null; // Allow re-fetch
        this.fetchAndStore(lat, lon, opts);
      }, this._refreshIntervalMs);
    },

    _getHub() {
      return typeof window !== 'undefined' ? window.GilbaHub : null;
    }
  };


  // ---------------------------------------------------------------------------
  // Legacy Compatibility Shim
  // ---------------------------------------------------------------------------
  // Bridges v2 climate output to the v1 global `window.climateMetrics` format
  // that existing (not yet migrated) engines expect.
  // ---------------------------------------------------------------------------

  function installLegacyShim() {
    if (typeof window === 'undefined') return;

    const hub = window.GilbaHub;
    if (!hub) return;

    // When climate engine produces output, mirror to window.climateMetrics
    hub.store.onChange('computed.climate', () => {
      const climate = hub.store.peek('computed.climate');
      if (!climate) return;

      // v1.8.2 FIX: Preserve any corrected GP values that hub-tissue has already
      // written to window.climateMetrics.growth. The shim previously replaced the
      // entire object, discarding the corrected weighted/c3/c4 values and resetting
      // them to the raw engine output (which can be 0% for pre-drought-adjusted GP).
      //
      // Strategy: if GAIP_CLIMATE_V2_RESULT is already set, hub-tissue has run and
      // corrected the GP — keep those values. Only use climate.growthPotential as
      // the initial value when there is no existing correction in place.
      const existingGrowth = window.climateMetrics && window.climateMetrics.growth;
      const gpAlreadyCorrected = window.GAIP_CLIMATE_V2_RESULT &&
        existingGrowth &&
        existingGrowth.weighted != null &&
        existingGrowth.weighted !== 0;

      const growthToWrite = gpAlreadyCorrected ? existingGrowth : climate.growthPotential;

      // Build the v1 format that existing modules expect
      window.climateMetrics = {
        // Direct mappings
        temperature: climate.temperature,
        moisture: {
          humidity: climate.humidity,
          dewpoint: climate.dewpoint
        },
        humidity: climate.humidity,
        dewpoint: climate.dewpoint,
        precipitation: climate.precipitation,
        et: climate.et,
        wind: climate.wind,
        solar: climate.solar,
        growth: growthToWrite,
        growthPotential: growthToWrite,
        gdd: climate.gdd,
        soilTemp: climate.soilTemp,
        stress: climate.stress,
        forecast: {
          daily: climate.forecast,
          precip: {
            days: climate.precipitation?.forecast || []
          }
        },
        // Flat aliases used by various v1 modules
        dailyData: climate.forecast,
        hourly: climate.hourly,
        quality: climate.quality,
        // v1 helpers
        _meta: climate._meta
      };

      if (gpAlreadyCorrected) {
        console.log('[ClimateEngine v2] Shim: preserved hub-tissue GP correction (' +
          growthToWrite.weighted + '%) — raw engine value not applied');
      }

      // Also fire the legacy event for v1 listeners
      document.dispatchEvent(new CustomEvent('gaip:climate-fetch-complete', {
        detail: window.climateMetrics
      }));
      document.dispatchEvent(new CustomEvent('gaip:climate-metrics-ready', {
        detail: window.climateMetrics
      }));
    });

    console.log('[ClimateEngine v2] Legacy shim installed — window.climateMetrics will mirror computed.climate');
  }


  // ---------------------------------------------------------------------------
  // Registration & Initialisation
  // ---------------------------------------------------------------------------

  function init() {
    const hub = typeof window !== 'undefined' ? window.GilbaHub : null;
    if (!hub) {
      console.error('[ClimateEngine v2] GilbaHub not found. Ensure gilba-hub-v2.js loads first.');
      return;
    }

    // Register with the v2 engine registry
    // Bind compute to ClimateEngine so this._fromAPI etc. resolve correctly.
    // The orchestrator registry destructures and re-stores the compute fn,
    // losing the original object as 'this' when called.
    hub.engines.register({
      ...ClimateEngine,
      compute: ClimateEngine.compute.bind(ClimateEngine),
    });

    // Install legacy compatibility
    installLegacyShim();

    // Start the fetch coordinator
    ClimateFetchCoordinator.init();

    // Expose for debugging
    hub.climate = {
      engine: ClimateEngine,
      dataService: ClimateDataService,
      coordinator: ClimateFetchCoordinator,
      // Expose pure functions for testing
      calcGPP,
      calcWeightedGPP,
      calcGDD,
      estimateSoilTemp,
      classifyStress,
      buildDailyForecast
    };

    console.log('[ClimateEngine v2] Registered and ready');
  }

  // Auto-init when DOM is ready
  if (typeof window !== 'undefined') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', init);
    } else {
      init();
    }
  }

  // Export for testing / ES module environments
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
      ClimateEngine,
      ClimateDataService,
      ClimateFetchCoordinator,
      calcGPP,
      calcWeightedGPP,
      calcGDD,
      estimateSoilTemp,
      classifyStress,
      buildDailyForecast,
      GPP_COEFFICIENTS,
      STRESS_THRESHOLDS,
      SOIL_DIFFUSIVITY
    };
  }

})();
