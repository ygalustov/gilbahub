/**
 * Dashboard Init v1.0.0
 * Populates the new dashboard page from localStorage analysis cache.
 *
 * Reads:
 *   gilba_hub_cache         — last hub analysis results (written by hub-persistence.js)
 *   gilba_hub_site_configs  — site turf species / region
 *   gaip_weather_cache_*    — Open-Meteo weather data (written by weather-resilience.js)
 */
(function (global) {
    'use strict';

    var _ls = (global.GilbaStorageNS && global.GilbaStorageNS.get)
        ? global.GilbaStorageNS.get()
        : localStorage;

    // =========================================================================
    // HELPERS
    // =========================================================================

    function el(id) { return document.getElementById(id); }
    function setText(id, val) { var e = el(id); if (e) e.textContent = val; }
    function setHTML(id, val) { var e = el(id); if (e) e.innerHTML = val; }
    function escHtml(s) { return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

    function safeJson(str) {
        try { return JSON.parse(str); } catch (e) { return null; }
    }

    // =========================================================================
    // INFO POPOVERS — glossary for db-info-icon click behaviour
    // =========================================================================

    var INFO_GLOSSARY = {
        'growth-potential': {
            title: '8-Day Average Growth Potential',
            body:  'Growth Potential (GP) is a 0–100% index of how favourable current temperature and moisture conditions are for your grass to grow. A high GP means the turf is in its ideal growth window; a low GP means growth has slowed or stalled.\n\nThis figure is the average GP across the next 8 days of forecast — smoothing out single-day spikes to reveal the underlying trend: whether growth is building or easing over the coming week. Use it to plan fertiliser applications, overseeding, and recovery work.'
        },
        'disease-risk': {
            title: 'Disease Risk',
            body:  'Disease pressure level — Low (under 50%), Moderate (50–70%), High (70–85%), Severe (85%+). Calculated on the higher of current risk and 14-day forecast peak, so a rising trend is reflected in the colour.'
        },
        'stress-index': {
            title: 'Stress Index',
            body:  'Combined stress score (0 = no stress, 100 = critical). Weighted average of heat, light, moisture, traffic, nutrition, and disease pressure across the next 14 days. Shown as X /100.'
        },
        'vwc': {
            title: 'Soil Moisture (VWC)',
            body:  'Volumetric Water Content — percentage of water by volume in the soil. Directly measured by Hydrosight TDR sensors.'
        },
        'irrigation-plan': {
            title: 'Irrigation Plan',
            body:  'Calculated weekly irrigation requirement based on Penman-Monteith reference ET₀ and crop coefficient (Kc). Cool-season Kc = 0.85, warm-season = 0.75.'
        },
        'monthly-n-rate': {
            title: 'Current Monthly N Rate',
            body:  'Optional. Enter the kg N/ha you applied last month. After generating the nutrition program, this is compared against the growth-limited N uptake capacity — if your rate exceeds the capacity, the excess cannot be utilised and increases leaching risk.'
        },
        'pgr-last-date': {
            title: 'Last application date',
            body:  'GDD accumulation is counted from this date to estimate remaining suppression activity and suggest the next application window.'
        },
        'pgr-rate': {
            title: 'Application rate (L/ha)',
            body:  'Used to calibrate expected growth suppression duration. Higher rates extend residual activity. Check label rates for your product.'
        },
        'pest-timing': {
            title: 'GDD Pest Timing',
            body:  'Growing Degree Days (GDD) accumulated from a biofix date predict when pest life stages occur. Armyworm and ground pearl are the primary targets. Integrated tracking is coming — links to external GDD calculators are shown in the meantime.'
        },
        'traffic-wear': {
            title: 'Traffic & Wear',
            body:  'Enter your match and training schedule to drive the wear recovery model. Recovery probability is calculated from cumulative wear load, current soil conditions, and species-specific recovery rate. Available for sports fields only.'
        },
        'player-age-group': {
            title: 'Player age group',
            body:  'Heavier players and higher training intensity cause greater surface stress per hour. Age group is used to weight the wear load calculation. Adult = base load; Masters and youth are adjusted accordingly.'
        },
        'training-area': {
            title: 'Training area used (%)',
            body:  'If you rotate training to different areas of the field, enter the average percentage of the total surface used per session. 100% = whole field every session, 50% = half-field rotation.'
        },
        'prior-usage': {
            title: 'Prior usage history',
            body:  'Recent wear history shapes the recovery curve. High load over the past 4 weeks reduces the predicted recovery window. Leave blank if not recorded — the model uses schedule data only.'
        },
        'clegg-mean': {
            title: 'Mean Gmax (Clegg hammer)',
            body:  'Standard 2.25 kg hammer dropped from 450 mm. Typical range: 60–90 Gmax. Below 60 = too soft, above 100 = too hard for safe play. Measured at the surface after mowing.'
        },
        'clegg-zones': {
            title: 'Zone readings',
            body:  'Record the highest reading (e.g. goalmouth or centre circle) and the lowest (e.g. wing area) to assess surface uniformity. A large spread between zones indicates inconsistent moisture or compaction.'
        },
        'cultivar-performance': {
            title: 'Cultivar performance profile',
            body:  'Disease resistance ratings for your selected species and variety across key pathogens. Ratings are sourced from published cultivar trial data and adjusted for your climate. A low resistance rating means your turf is genetically susceptible — this raises the disease risk threshold used in the model.'
        },
        'dew-forecast': {
            title: 'Dew forecast',
            body:  'Surface wetness duration for the next 7 days, based on hourly relative humidity and precipitation. Dew periods create ideal conditions for fungal infection spread — particularly dollar spot and Pythium. High-risk match windows are highlighted in red.'
        }
    };

    function initInfoPopovers() {
        var popover  = document.getElementById('db-info-popover');
        var popTitle = document.getElementById('db-info-popover-title');
        var popBody  = document.getElementById('db-info-popover-body');
        var popClose = document.getElementById('db-info-popover-close');
        var popArrow = document.getElementById('db-info-popover-arrow');
        if (!popover) return;
        popover.dataset.initialized = '1';

        var currentAnchor = null;

        function showPopover(anchor) {
            var key = anchor.dataset.info;
            var entry = INFO_GLOSSARY[key] || (global.GAIP_GLOSSARY && global.GAIP_GLOSSARY[key]);
            if (!entry) return;
            popTitle.textContent = entry.title;
            popBody.textContent  = entry.body;
            popover.style.visibility = 'hidden';
            popover.style.display    = 'block';

            var rect  = anchor.getBoundingClientRect();
            var pw    = popover.offsetWidth;
            var ph    = popover.offsetHeight;
            var viewW = window.innerWidth;
            var viewH = window.innerHeight;

            var left = Math.round(rect.left + rect.width / 2 - pw / 2);
            left = Math.max(8, Math.min(left, viewW - pw - 8));

            var top, flipped = false;
            if (rect.bottom + 10 + ph > viewH - 8) {
                top = Math.round(rect.top - 10 - ph);
                flipped = true;
            } else {
                top = Math.round(rect.bottom + 10);
            }

            popover.style.left       = left + 'px';
            popover.style.top        = top  + 'px';
            popover.style.visibility = '';

            if (popArrow) {
                var arrowLeft = Math.round(rect.left + rect.width / 2 - left - 5);
                arrowLeft = Math.max(12, Math.min(arrowLeft, pw - 22));
                popArrow.style.left      = arrowLeft + 'px';
                popArrow.style.top       = flipped ? ''    : '-6px';
                popArrow.style.bottom    = flipped ? '-6px': '';
                popArrow.style.transform = flipped ? 'rotate(225deg)' : 'rotate(45deg)';
            }
            currentAnchor = anchor;
        }

        function hidePopover() {
            popover.style.display = 'none';
            currentAnchor = null;
        }

        document.addEventListener('click', function (e) {
            var icon = e.target.closest('.db-info-icon');
            if (icon) {
                e.stopPropagation();
                if (currentAnchor === icon) { hidePopover(); } else { showPopover(icon); }
                return;
            }
            if (!popover.contains(e.target)) hidePopover();
        });

        document.addEventListener('keydown', function (e) {
            if (e.key === 'Escape') hidePopover();
        });

        if (popClose) popClose.addEventListener('click', function (e) {
            e.stopPropagation();
            hidePopover();
        });

        document.querySelectorAll('.db-info-icon[data-info]').forEach(function (icon) {
            icon.addEventListener('keydown', function (e) {
                if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); showPopover(icon); }
            });
        });
    }

    // =========================================================================
    // WEATHER — keyed by lat_lon in localStorage
    // =========================================================================

    var WMO_DESC = {
        0:'Clear sky',1:'Mainly clear',2:'Partly cloudy',3:'Overcast',
        45:'Foggy',48:'Icy fog',
        51:'Light drizzle',53:'Drizzle',55:'Heavy drizzle',
        61:'Light rain',63:'Rain',65:'Heavy rain',
        71:'Light snow',73:'Snow',75:'Heavy snow',
        80:'Showers',81:'Rain showers',82:'Violent showers',
        95:'Thunderstorm',96:'Thunderstorm',99:'Severe storm'
    };

    function wmoDesc(c) { return WMO_DESC[c] || 'Weather'; }

    function wmoSvg(code, size) {
        size = size || 36;
        var w = size + 'px';
        function wrap(inner) {
            return '<svg width="' + w + '" height="' + w + '" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">' + inner + '</svg>';
        }
        /* Sun: filled circle + 8 stroke rays */
        var SUN = '<circle cx="24" cy="24" r="8" fill="#fbbf24"/><g stroke="#f59e0b" stroke-width="2.5" stroke-linecap="round"><line x1="24" y1="4" x2="24" y2="9"/><line x1="24" y1="39" x2="24" y2="44"/><line x1="4" y1="24" x2="9" y2="24"/><line x1="39" y1="24" x2="44" y2="24"/><line x1="9.7" y1="9.7" x2="13.3" y2="13.3"/><line x1="34.7" y1="34.7" x2="38.3" y2="38.3"/><line x1="38.3" y1="9.7" x2="34.7" y2="13.3"/><line x1="13.3" y1="34.7" x2="9.7" y2="38.3"/></g>';
        /* Clouds: dark (CL), light (CLT), centered standalone (CLC) */
        var CL  = '<circle cx="18" cy="19" r="9" fill="#94a3b8"/><circle cx="30" cy="16" r="11" fill="#94a3b8"/><rect x="9" y="19" width="30" height="10" fill="#94a3b8" rx="1"/>';
        var CLT = '<circle cx="18" cy="19" r="9" fill="#cbd5e1"/><circle cx="30" cy="16" r="11" fill="#cbd5e1"/><rect x="9" y="19" width="30" height="10" fill="#cbd5e1" rx="1"/>';
        var CLC = '<circle cx="18" cy="25" r="9" fill="#94a3b8"/><circle cx="30" cy="22" r="11" fill="#94a3b8"/><rect x="9" y="25" width="30" height="12" fill="#94a3b8" rx="1"/>';
        /* Partly cloudy: small sun top-right, small cloud bottom-left */
        var SUN2 = '<circle cx="32" cy="16" r="7" fill="#fbbf24"/><g stroke="#f59e0b" stroke-width="2" stroke-linecap="round"><line x1="32" y1="5" x2="32" y2="8"/><line x1="40" y1="16" x2="43" y2="16"/><line x1="37" y1="9" x2="38.5" y2="7.5"/><line x1="37" y1="23" x2="38.5" y2="24.5"/></g>';
        var CLS = '<circle cx="15" cy="34" r="6" fill="#cbd5e1"/><circle cx="24" cy="31" r="8" fill="#cbd5e1"/><rect x="9" y="31" width="22" height="10" fill="#cbd5e1" rx="1"/>';
        /* Precipitation: rain lines, drizzle, snow dots, lightning bolt */
        var RAIN = '<g stroke="#3b82f6" stroke-width="2.5" stroke-linecap="round"><line x1="16" y1="33" x2="13" y2="43"/><line x1="24" y1="33" x2="21" y2="43"/><line x1="32" y1="33" x2="29" y2="43"/></g>';
        var DRZL = '<g stroke="#93c5fd" stroke-width="2" stroke-linecap="round"><line x1="17" y1="33" x2="16" y2="40"/><line x1="24" y1="33" x2="23" y2="40"/><line x1="31" y1="33" x2="30" y2="40"/></g>';
        var SNOW = '<g fill="#93c5fd"><circle cx="16" cy="37" r="2.5"/><circle cx="24" cy="42" r="2.5"/><circle cx="32" cy="37" r="2.5"/></g>';
        var BOLT = '<path d="M22,32 L17,40 L22,40 L16,47 L31,35 L25,35 L28,32 Z" fill="#fbbf24"/>';
        /* Fog: small cloud top + tapering horizontal lines */
        var FOGC = '<circle cx="18" cy="14" r="7" fill="#cbd5e1"/><circle cx="30" cy="11" r="9" fill="#cbd5e1"/><rect x="11" y="14" width="26" height="8" fill="#cbd5e1" rx="1"/>';
        var FOGL = '<g stroke="#94a3b8" stroke-width="2.5" stroke-linecap="round"><line x1="8" y1="28" x2="40" y2="28"/><line x1="12" y1="35" x2="36" y2="35"/><line x1="16" y1="42" x2="32" y2="42"/></g>';
        if (code === 0)                 return wrap(SUN);
        if (code === 1 || code === 2)   return wrap(SUN2 + CLS);
        if (code === 3)                 return wrap(CLC);
        if (code === 45 || code === 48) return wrap(FOGC + FOGL);
        if (code >= 51 && code <= 55)   return wrap(CLT + DRZL);
        if (code >= 61 && code <= 67)   return wrap(CL  + RAIN);
        if (code >= 71 && code <= 77)   return wrap(CL  + SNOW);
        if (code >= 80 && code <= 82)   return wrap(CLT + RAIN);
        if (code >= 95)                 return wrap(CL  + BOLT);
        return wrap('<circle cx="24" cy="24" r="10" fill="#94a3b8" opacity="0.5"/>');
    }

    function renderWeatherData(data) {
        // Current conditions — support both old current_weather and new current formats
        var cur = data.current || data.current_weather;
        if (cur) {
            var temp = cur.temperature_2m !== undefined ? cur.temperature_2m : cur.temperature;
            var code = cur.weather_code  !== undefined ? cur.weather_code  : cur.weathercode;
            var rh   = cur.relative_humidity_2m !== undefined ? Math.round(cur.relative_humidity_2m) : null;

            setText('db-temp', Math.round(temp) + '°C');
            var desc = wmoDesc(code);
            setText('db-weather-desc', rh !== null ? desc + ' · RH ' + rh + '%' : desc);
            setHTML('db-weather-icon', wmoSvg(code, 36));
        }

        // 3-day forecast — start from index 1 (tomorrow, not today)
        var daily = data.daily;
        if (!daily || !daily.time) return;
        var forecastEl = el('db-forecast');
        if (!forecastEl) return;
        var html = '';
        for (var i = 1; i <= Math.min(3, daily.time.length - 1); i++) {
            var date = new Date(daily.time[i] + 'T12:00:00');
            var day  = date.toLocaleDateString('en', { weekday: 'short' });
            var maxT = daily.temperature_2m_max ? Math.round(daily.temperature_2m_max[i]) : '—';
            var rain = daily.precipitation_sum  ? Math.round(daily.precipitation_sum[i])  : 0;
            var dc   = daily.weather_code ? daily.weather_code[i]
                     : (daily.weathercode  ? daily.weathercode[i]  : 0);
            html += '<div class="db-forecast-day">' +
                '<div class="db-forecast-label">'  + day  + '</div>' +
                '<div class="db-forecast-icon">'   + wmoSvg(dc, 22) + '</div>' +
                '<div class="db-forecast-temp">'   + maxT + '°</div>' +
                '<div class="db-forecast-rain">'   + rain + 'mm</div>' +
                '</div>';
        }
        forecastEl.innerHTML = html;
        setClimateMetrics(data);
    }

    function setClimateMetrics(data) {
        var daily = data && data.daily;
        if (!daily || !daily.time || !daily.time.length) return;
        var temps = [], totalPrecip = 0;
        for (var i = 0; i < daily.time.length; i++) {
            var tMax = daily.temperature_2m_max ? daily.temperature_2m_max[i] : null;
            var tMin = daily.temperature_2m_min ? daily.temperature_2m_min[i] : null;
            if (tMax != null && tMin != null) temps.push((tMax + tMin) / 2);
            totalPrecip += daily.precipitation_sum ? (daily.precipitation_sum[i] || 0) : 0;
        }
        if (!temps.length) return;
        var tempMean = temps.reduce(function(a, b) { return a + b; }, 0) / temps.length;
        global.climateMetrics = {
            temperature: { mean: Math.round(tempMean * 10) / 10 },
            precipitation: { total: Math.round(totalPrecip) }
        };
        global.rawWeatherData = data;
    }

    function fetchWeatherFromAPI(lat, lon, locKey) {
        var url = 'https://api.open-meteo.com/v1/forecast' +
            '?latitude=' + lat +
            '&longitude=' + lon +
            '&current=temperature_2m,relative_humidity_2m,weather_code' +
            '&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum' +
            '&timezone=auto' +
            '&forecast_days=4';

        setText('db-weather-desc', 'Loading…');

        fetch(url)
            .then(function (r) { return r.ok ? r.json() : Promise.reject(r.status); })
            .then(function (data) {
                renderWeatherData(data);
                // Cache so subsequent dashboard loads are instant
                try {
                    localStorage.setItem('gaip_weather_cache_' + locKey,
                        JSON.stringify({ data: data, cachedAt: new Date().toISOString() }));
                } catch (e) {}
            })
            .catch(function () {
                setText('db-weather-desc', 'Unavailable');
            });
    }

    function populateWeather(lat, lon) {
        var locKey = parseFloat(lat).toFixed(4) + '_' + parseFloat(lon).toFixed(4);

        var raw = localStorage.getItem('gaip_weather_cache_' + locKey);

        var entry = safeJson(raw);
        var data  = entry && entry.data ? entry.data : null;

        if (data) {
            // Check cache age — refresh if older than 1 hour
            var ageHours = entry.cachedAt
                ? (Date.now() - new Date(entry.cachedAt).getTime()) / 3600000
                : 999;
            renderWeatherData(data);
            if (ageHours > 1) fetchWeatherFromAPI(lat, lon, locKey);
        } else {
            // No cache — fetch live
            fetchWeatherFromAPI(lat, lon, locKey);
        }
    }

    // =========================================================================
    // VITALS — from gilba_hub_cache.dashboard
    // =========================================================================

    function populateVitals(m, computed) {
        var errEl = el('db-analysis-error');
        if (!m) {
            setText('db-gp-value',     '—');
            setText('db-disease-value','—');
            setText('db-stress-value', '—');
            setText('db-irr-value',    '—');
            if (errEl) errEl.style.display = 'none';
            return;
        }

        // Growth Potential — from dailyPattern[0] (daily mean per PACE contract)
        var _climateGrowth = computed && computed.climate && computed.climate.growth;
        var _vitDp = _climateGrowth && Array.isArray(_climateGrowth.dailyPattern) ? _climateGrowth.dailyPattern : null;
        var _vitDp0 = _vitDp && _vitDp.length > 0 ? _vitDp[0] : null;
        var gpRaw = _vitDp0 ? _vitDp0.weighted
                  : (m.growthPotential != null ? m.growthPotential
                  : (_climateGrowth && _climateGrowth.weighted != null ? _climateGrowth.weighted : null));

        // Determine banner state based on last analysis result
        var _wxSrc = m.weatherSource; // 'live', 'cache', 'manual_override', undefined
        var weatherFailed = (gpRaw == null);
        var weatherManual = (_wxSrc === 'manual_override' || _wxSrc === 'cache');

        // Banners: red = no GP at all; amber = GP calculated from manual override
        var manualEl = el('db-analysis-manual');
        if (errEl)    errEl.style.display    = weatherFailed ? 'flex' : 'none';
        if (manualEl) manualEl.style.display = (!weatherFailed && weatherManual) ? 'flex' : 'none';

        if (gpRaw != null) {
            var gp = gpRaw >= 1 ? Math.round(gpRaw) : Math.round(gpRaw * 100);
            setText('db-gp-value', gp + '%');
            // GP colour: >=70 green, 40-69 amber, <40 red (same as Hub daily-dashboard)
            var gpSev = gp >= 70 ? 'ok' : (gp >= 40 ? 'warning' : 'critical');
            var gpEl = el('db-gp-value');
            if (gpEl) gpEl.className = 'db-vital-main ' + gpSev;
            // GP progress bar
            var gpBar = el('db-gp-bar');
            if (gpBar) {
                gpBar.style.width = gp + '%';
                gpBar.style.background = gp >= 70 ? '#16a34a' : (gp >= 40 ? '#d97706' : '#dc2626');
            }

            // GP footer: season type + 8-day avg (main number is today's GP)
            var gpObj = _climateGrowth;
            if (gpObj) {
                var c3f = gpObj.c3Fraction != null ? gpObj.c3Fraction : (gpObj.c3Frac != null ? gpObj.c3Frac : 1);
                var c4f = gpObj.c4Fraction != null ? gpObj.c4Fraction : (gpObj.c4Frac != null ? gpObj.c4Frac : 0);
                var isWarm = c4f > c3f;
                var seasonLabel = isWarm ? 'Warm-Season' : 'Cool-Season';
                var _avgDp = Array.isArray(gpObj.dailyPattern) ? gpObj.dailyPattern : null;
                var _avgGP8 = null;
                if (_avgDp && _avgDp.length > 0) {
                    var _aSum = 0, _aN = Math.min(8, _avgDp.length);
                    for (var _ai = 0; _ai < _aN; _ai++) _aSum += (_avgDp[_ai].weighted || 0);
                    _avgGP8 = Math.round(_aSum / _aN);
                }
                var gpFooterStr = _avgGP8 != null
                    ? seasonLabel + ' · 8-Day Avg: ' + _avgGP8 + '%'
                    : seasonLabel;
                setText('db-gp-footer', gpFooterStr);
            } else if (m.soilTemp != null) {
                setText('db-gp-footer', 'Soil ' + Math.round(m.soilTemp) + '°C');
            }
        }

        // Disease Risk
        // Today only — mirrors the Growth Potential card's pattern (% headline,
        // "today" sub-label). Forecast peak is intentionally NOT blended into
        // this card's headline/colour anymore (previously showed the worst of
        // current vs. forecast, which read as one ambiguous number spanning two
        // different diseases). Forecast, when meaningfully higher than today,
        // is shown as its own explicitly-labeled line below — always named,
        // never implied by a "now → forecast" arrow. Full forecast detail still
        // lives in the side panel (buildDiseasePanel(), opened by clicking this card).
        // Thresholds match disease-engine-pure.js: <50=Low, 50-70=Moderate, 70-85=High, >=85=Severe
        if (m.diseaseRisk != null) {
            var risk = m.diseaseRisk > 1 ? Math.round(m.diseaseRisk) : Math.round(m.diseaseRisk * 100);

            var level, cls;
            if      (risk >= 85) { level = 'Severe';   cls = 'critical'; }
            else if (risk >= 70) { level = 'High';     cls = 'critical'; }
            else if (risk >= 50) { level = 'Moderate'; cls = 'warning';  }
            else                 { level = 'Low';      cls = 'ok';       }

            var severityColor = cls === 'critical' ? '#dc2626' : (cls === 'warning' ? '#d97706' : '#16a34a');

            // Main value: today's risk percentage, same style as Growth Potential's headline.
            var dEl = el('db-disease-value');
            if (dEl) {
                dEl.textContent = risk + '%';
                dEl.className = 'db-vital-main' + (cls ? ' ' + cls : '');
            }

            // Sub-label: "Today" + which disease is driving it, one line —
            // mirrors Stress Index's "Driven by: X" pattern instead of a
            // separate name-row below the bar.
            setText('db-disease-today', m.topDisease ? ('Today · ' + m.topDisease) : (level + ' · Today'));

            // Bar: current risk width, severity color
            var dBar = el('db-disease-bar');
            if (dBar) {
                dBar.style.width = Math.min(risk, 100) + '%';
                dBar.style.background = severityColor;
            }

            // Name row is no longer used — driver name now lives in the sub-label above.
            var nameRowEl = el('db-disease-name-row');
            if (nameRowEl) nameRowEl.style.display = 'none';

            // Forecast line — the only line below the bar, mirrors the footer
            // slot other vital cards use (Growth Potential's 8-day avg,
            // Stress Index's trend). Always names the disease driving it
            // (whether it's the same one as above or different).
            var alertEl = el('db-disease-alert');
            if (alertEl) {
                var peak    = m.forecastPeak != null ? (m.forecastPeak > 1 ? Math.round(m.forecastPeak) : Math.round(m.forecastPeak * 100)) : null;
                var peakDay = m.peakDay;
                if (peak != null && peak >= risk + 5 && peakDay != null) {
                    var fcName    = (m.forecastDisease || m.topDisease || 'Disease').replace(/\s*\([^)]*\)/g, '');
                    var dayLabel  = peakDay === 0 ? 'today' : peakDay === 1 ? 'tomorrow' : 'in ' + peakDay + ' days';
                    var peakColor = peak >= 70 ? '#dc2626' : (peak >= 50 ? '#d97706' : '#16a34a');
                    alertEl.textContent = 'Forecast: ' + fcName + ' ' + peak + '% ' + dayLabel;
                    alertEl.style.color = peakColor;
                    alertEl.style.display = '';
                } else {
                    alertEl.style.display = 'none';
                }
            }
        }

        // Stress Index
        if (m.stressIndex != null) {
            var stress = Math.round(m.stressIndex);
            var svEl = el('db-stress-value');
            if (svEl) {
                svEl.textContent = stress;
                var stressCls = stress >= 60 ? 'critical' : (stress >= 30 ? 'warning' : 'ok');
                svEl.className = 'db-vital-main ' + stressCls;
            }
            var sBar = el('db-stress-bar');
            if (sBar) {
                sBar.style.width = Math.min(100, stress) + '%';
                sBar.style.background = stress >= 60 ? '#dc2626' : (stress >= 30 ? '#d97706' : '#16a34a');
            }
            if (m.trendDirection) {
                var trendMap = {
                    rising:    { text: '↑ Rising',    color: '#dc2626' },
                    worsening: { text: '↑ Worsening', color: '#dc2626' },
                    falling:   { text: '↓ Falling',   color: '#16a34a' },
                    improving: { text: '↓ Falling',   color: '#16a34a' },
                    stable:    { text: '→ Stable',    color: '#6b8878' }
                };
                var td = trendMap[m.trendDirection.toLowerCase()] || { text: m.trendDirection, color: '#6b8878' };
                var trendEl = el('db-stress-trend');
                if (trendEl) { trendEl.textContent = td.text; trendEl.style.color = td.color; }
            }

            // Top stress driver from computed.stressTrajectory.currentComponents
            var traj  = computed && computed.stressTrajectory;
            var comps = traj && (traj.currentComponents || (traj.data && traj.data.currentComponents));
            if (comps) {
                var _isSports = (global.GAIP_HUB_CONFIG && global.GAIP_HUB_CONFIG.siteType) === 'sports';
                var factorLabels = { thermal:'Temp Stress', moisture:'Moisture', light:'Light', nutrition:'Nutrition', biotic:'Disease' };
                if (_isSports) factorLabels.traffic = 'Traffic';
                var topKey = null, topVal = 0;
                Object.keys(factorLabels).forEach(function (k) {
                    var v = Math.abs(comps[k] || 0);
                    if (v > topVal) { topVal = v; topKey = k; }
                });
                if (topKey && topVal > 0) {
                    setHTML('db-stress-driver', 'Driven by: <strong>' + factorLabels[topKey] + ' ' + Math.round(topVal) + '%</strong>');
                }
            }
        }

        // Irrigation — read from metrics first, fall back to computed.irrigation directly
        var irrResult  = computed && computed.irrigation;
        var irrSummary = irrResult && irrResult.summary;
        var irrMm = m.irrigationNeed != null
            ? Math.round(m.irrigationNeed)
            : (irrSummary && irrSummary.totalIrrigation != null
                ? Math.round(irrSummary.totalIrrigation)
                : null);

        if (irrMm != null) {
            var irrEl  = el('db-irr-value');
            if (irrEl) {
                irrEl.innerHTML = irrMm + '<span style="font-size:16px;font-weight:600"> mm</span>';
                var irrCls = irrMm > 15 ? 'critical' : (irrMm > 8 ? 'warning' : 'ok');
                irrEl.className = 'db-vital-main ' + irrCls;
            }

            // Deficit/surplus — try summary.netDeficit, then metrics.irrigationDeficit, then waterBalance.deficit
            var deficitRaw = irrSummary && irrSummary.netDeficit != null ? irrSummary.netDeficit
                           : m && m.irrigationDeficit != null ? m.irrigationDeficit
                           : irrResult && irrResult.waterBalance && irrResult.waterBalance.deficit != null
                             ? irrResult.waterBalance.deficit : null;

            var fEl = el('db-irr-forecast');
            if (fEl && deficitRaw != null) {
                var deficit = Math.round(deficitRaw);
                if (deficit < 0) {
                    fEl.textContent = '↑ Ahead by ' + Math.abs(deficit) + 'mm — skip cycle';
                    fEl.style.color = '#16a34a';
                } else if (deficit > 0) {
                    fEl.textContent = 'Deficit: ' + deficit + 'mm';
                    fEl.style.color = '#d97706';
                } else {
                    fEl.textContent = 'On track';
                    fEl.style.color = '#6b8878';
                }
            }
        }
    }

    // =========================================================================
    // VERDICT BAR
    // =========================================================================

    function populateVerdict(m) {
        var bar = el('db-verdict-bar');
        if (!m || m.diseaseRisk == null) {
            if (bar) bar.style.display = 'none';
            return;
        }
        var risk    = m.diseaseRisk > 1 ? Math.round(m.diseaseRisk) : Math.round(m.diseaseRisk * 100);
        var peak    = m.forecastPeak != null ? (m.forecastPeak > 1 ? Math.round(m.forecastPeak) : Math.round(m.forecastPeak * 100)) : null;
        var disease = m.topDisease || 'Disease';
        // Forecast counts as "meaningfully higher" at a >=5pp margin — same
        // threshold as the vital card's forecast line (db-disease-alert),
        // inclusive so a margin of exactly 5 doesn't fall through to a
        // different (ungated) code path than the card uses.
        var forecastDriving = peak != null && peak >= risk + 5;
        var displayRisk = forecastDriving ? peak : risk;
        // 4-tier thresholds (85/70/50) matching disease-engine-pure.js's
        // classifyRisk() and the vital-card/panel levels above — was
        // previously a coarser 3-tier scheme (50/25) with its own "MEDIUM"
        // wording, which mislabelled the 25-49% band as a mid-risk tier when
        // the engine (and the old hub) call that band "low".
        var level = displayRisk >= 85 ? 'SEVERE' : (displayRisk >= 70 ? 'HIGH' : (displayRisk >= 50 ? 'MODERATE' : 'LOW'));
        var cls   = displayRisk >= 70 ? 'critical' : (displayRisk >= 50 ? 'warning' : 'ok');

        var txt;
        if (forecastDriving && m.peakDay != null) {
            var dayLabel = m.peakDay === 1 ? '1 day' : m.peakDay + ' days';
            var fcDisease = m.forecastDisease && m.forecastDisease !== m.topDisease
                ? m.forecastDisease.replace(/\s*\([^)]*\)/g, '')
                : null;
            if (fcDisease) {
                // Different disease peaks in forecast — show both names clearly
                txt = disease + ' ' + risk + '% · ' + fcDisease + ' forecast ' + peak + '% in ' + dayLabel;
            } else {
                txt = disease + ' — ' + risk + '% now, forecast ' + peak + '% in ' + dayLabel;
            }
        } else {
            // Below the margin (or no forecast at all) — today only, same as
            // the vital card in this state. No ungated forecast append here
            // anymore: that used to show forecast text even when the >=5pp
            // margin wasn't met, disagreeing with the card right below it.
            txt = disease + ' risk ' + level + ' (' + risk + '%)';
        }
        setText('db-verdict-text', txt);
        if (bar) { bar.className = 'db-verdict ' + cls; bar.style.display = ''; }
    }

    // =========================================================================
    // CONTEXT PILLS — species / region from site config
    // =========================================================================

    function populatePills() {
        // Pills are rendered server-side from DB; do not overwrite with stale localStorage data.
    }

    // =========================================================================
    // ANALYSIS TIMESTAMP
    // =========================================================================

    function populateTimestamp(ts) {
        if (!ts) return;
        var d = new Date(ts);
        if (isNaN(d.getTime())) return;
        var label = d.toLocaleDateString('en', { month:'short', day:'numeric' }) + ' ' +
                    d.toLocaleTimeString('en', { hour:'2-digit', minute:'2-digit', hour12:false });
        setText('db-analysis-ts', 'Analysis: ' + label);
    }

    // =========================================================================
    // ACTION QUEUE — from cache.computed engine results
    // =========================================================================

    function aqCard(opts) {
        // Always lead with ESTIMATE chip, then category chip
        var chips = '<span class="db-chip db-chip-estimate">ESTIMATE</span>';
        (opts.chips || []).forEach(function (c) {
            chips += '<span class="db-chip db-chip-' + (c.type || 'estimate') + '">' + c.label + '</span>';
        });

        var content = '<div class="db-aq-card-chips">' + chips + '</div>' +
            '<div class="db-aq-card-title">' + opts.title + '</div>';
        if (opts.reason)      content += '<div class="db-aq-card-reason">' + opts.reason + '</div>';
        if (opts.window)      content += '<div class="db-aq-card-window">' + opts.window + '</div>';
        if (opts.consequence) content += '<div class="db-aq-card-consequence">If delayed: ' + opts.consequence + '</div>';

        var sidebar = '<button class="db-btn-commit' + (opts.btnCls ? ' ' + opts.btnCls : '') + '">' + (opts.commitLabel || 'Commit') + '</button>' +
            '<button class="db-btn-defer">Defer</button>' +
            '<a class="db-btn-details" href="#">View Details →</a>';

        return '<div class="db-aq-card">' +
            '<div class="db-aq-card-content">' + content + '</div>' +
            '<div class="db-aq-card-sidebar">' + sidebar + '</div>' +
            '</div>';
    }

    function aqSection(dotCls, label, items, sectionCls) {
        if (!items.length) return '';
        return '<div class="db-aq-section ' + (sectionCls || '') + '">' +
            '<div class="db-aq-section-head">' +
            '<span class="dot ' + dotCls + '"></span>' +
            label + '<span style="color:var(--gaip-text-muted);margin-left:2px">(' + items.length + ')</span>' +
            '</div>' +
            items.join('') +
            '</div>';
    }

    function populateActionQueue(m, computed) {
        var bodyEl = el('db-aq-body');
        if (!bodyEl) return;

        var today = [], week = [], watching = [];

        // ── Disease ──────────────────────────────────────────────
        var dr = computed && computed.disease;
        var risk = 0, topName = null;
        if (m && m.diseaseRisk != null) {
            risk = m.diseaseRisk > 1 ? Math.round(m.diseaseRisk) : Math.round(m.diseaseRisk * 100);
            topName = m.topDisease || null;
        }
        // Try richer data from computed.disease — computed.disease.diseases[] is
        // unfiltered (unlike topThreats[], which m.topDisease is sourced from), so a
        // hidden disease (Fusarium, or any validationStatus:'beta' one) must not be
        // read here without re-applying the same exclusion used everywhere else
        // (disease-analysis.js's filterDiseases / hub-orchestrator.js's topThreats
        // recompute).
        if (dr && dr.diseases && dr.diseases.length) {
            var validDiseases = dr.diseases.filter(function (d) {
                return d.validationStatus !== 'beta' && d.disease !== 'fusarium';
            });
            var top = validDiseases[0];
            if (top) {
                topName = topName || top.displayName || top.name || top.disease;
                if (!risk && (top.adjustedRisk || top.riskScore)) {
                    risk = Math.round(top.adjustedRisk || top.riskScore);
                }
            }
        }
        if (topName && risk > 0) {
            var peakStr = '';
            if (m && m.forecastPeak != null && m.peakDay != null) {
                var peak = m.forecastPeak > 1 ? Math.round(m.forecastPeak) : Math.round(m.forecastPeak * 100);
                peakStr = ' · forecast ' + peak + '% in ' + m.peakDay + 'd';
            }
            if (risk >= 70) {
                today.push(aqCard({
                    chips: [{ type: 'disease', label: 'Disease › ' + topName }],
                    title: 'Apply fungicide today',
                    reason: 'Risk ' + risk + '% (threshold 70%)' + peakStr,
                    commitLabel: 'Commit — spray today',
                    consequence: peakStr ? 'Risk rising — act before window closes' : null
                }));
            } else if (risk >= 50) {
                week.push(aqCard({
                    chips: [{ type: 'disease', label: 'Disease › ' + topName }],
                    title: 'Monitor — consider fungicide this week',
                    reason: 'Risk ' + risk + '%' + peakStr,
                    commitLabel: 'Commit — plan application',
                    btnCls: 'amber'
                }));
            } else {
                watching.push(aqCard({
                    title: topName + ' — low risk',
                    reason: 'Risk ' + risk + '% · below threshold',
                    commitLabel: 'Commit to watching',
                    btnCls: 'grey'
                }));
            }
        }

        // ── PGR ──────────────────────────────────────────────────
        // computed.pgr is the curated shape hub-persistence.js actually persists
        // (success/applicationDate/product/gdd/effect — see its "Saved pgr to cache"
        // block) — it has no top-level .status field, so gate on gdd.threshold
        // (present whenever a PGR application is tracked) instead.
        var pgr = computed && computed.pgr;
        if (pgr && pgr.gdd && pgr.gdd.threshold) {
            var gdd = pgr.gdd || {};
            var pct = gdd.accumulated != null && gdd.threshold
                ? Math.round((gdd.accumulated / gdd.threshold) * 100) : null;
            var product = (pgr.product && typeof pgr.product === 'object'
                ? pgr.product.name : pgr.product) || 'PGR';
            // reapplicationStatus ('due' at 75% GDD, 'approaching' at 60% — b35fix178c,
            // Kreuser & Soldat 2011) is the PGR engine's own canonical status, shared
            // byte-for-byte with the old hub's copy of this module. It's never
            // literally 'expired' — that's gdd.isOverdue (a separate boolean the
            // engine already computes).
            var reapp = (pgr.effect && pgr.effect.reapplicationStatus) || '';
            var gddDetail = (gdd.accumulated != null && gdd.threshold != null)
                ? gdd.accumulated + ' / ' + gdd.threshold + ' GDD' + (pct != null ? ' (' + pct + '%)' : '')
                : '';
            if (gdd.isOverdue || pct >= 100) {
                today.push(aqCard({
                    chips: [{ type: 'pgr', label: 'PGR' }],
                    title: product + ' has expired — reapply',
                    reason: gddDetail,
                    commitLabel: 'Commit — apply today'
                }));
            } else if (reapp === 'due') {
                week.push(aqCard({
                    chips: [{ type: 'pgr', label: 'PGR' }],
                    title: product + ' reapplication due' + (pct != null ? ' (' + pct + '% of interval)' : ''),
                    reason: gddDetail,
                    commitLabel: 'Commit — schedule reapplication',
                    btnCls: 'amber'
                }));
            } else if (pct != null) {
                watching.push(aqCard({
                    title: product + ' · ' + pct + '% of interval',
                    reason: gddDetail,
                    commitLabel: 'Commit to watching',
                    btnCls: 'grey'
                }));
            }
        }

        // ── Irrigation ───────────────────────────────────────────
        // Old hub triggers off the current water balance deficit, not the coming
        // week's forecast requirement — a different metric. computed.irrigation is
        // only ever populated by the selective-recompute path (executeEngine()),
        // not the main computeAll() pipeline, so it's not reliably present here.
        // metrics.irrigationDeficit already carries the real deficit (from
        // GAIP_IrrigationResults.summary.netDeficit, hub-persistence.js — the same
        // reliable legacy-global fallback chain metrics.irrigationNeed already uses).
        if (m && m.irrigationDeficit != null) {
            var depletion = Math.round(m.irrigationDeficit);
            if (depletion > 20) {
                today.push(aqCard({
                    chips: [{ type: 'estimate', label: 'Irrigation' }],
                    title: 'Irrigate — ' + depletion + 'mm deficit',
                    reason: 'Water balance deficit exceeds threshold',
                    commitLabel: 'Commit — irrigate today'
                }));
            } else if (depletion > 10) {
                week.push(aqCard({
                    chips: [{ type: 'estimate', label: 'Irrigation' }],
                    title: 'Schedule irrigation — ' + depletion + 'mm deficit',
                    reason: 'Water balance deficit building',
                    commitLabel: 'Commit — schedule',
                    btnCls: 'amber'
                }));
            } else {
                watching.push(aqCard({
                    title: depletion > 0 ? 'Irrigation — ' + depletion + 'mm deficit' : 'Irrigation — on track',
                    reason: depletion > 0 ? 'Below threshold' : 'Ahead by ' + Math.abs(depletion) + 'mm',
                    commitLabel: 'Commit to watching',
                    btnCls: 'grey'
                }));
            }
        }

        // ── Tissue nutrition ─────────────────────────────────────
        var tissue = computed && computed.tissue;
        if (tissue && tissue.deficiencies && tissue.deficiencies.length) {
            var def = tissue.deficiencies[0];
            var elem = def.element || def.nutrient || 'Nutrient';
            var val  = def.value != null ? def.value : null;
            var tgt  = def.target || def.minimum || null;
            var reason = val != null && tgt != null
                ? 'Tissue ' + elem + ' ' + val + ' (target ' + tgt + ')'
                : 'Deficiency detected';
            week.push(aqCard({
                chips: [{ type: 'estimate', label: 'Nutrition' }],
                title: 'Apply foliar ' + elem,
                reason: reason,
                commitLabel: 'Commit — plan application',
                btnCls: 'amber'
            }));
        } else if (tissue && tissue.status === 'ok') {
            watching.push(aqCard({
                title: 'Nutrition — tissue levels OK',
                reason: tissue.summary || 'All elements within target range',
                commitLabel: 'Commit to watching',
                btnCls: 'grey'
            }));
        }

        // ── Stress trajectory ────────────────────────────────────
        // Same score already shown on the Stress Index vital card
        // (hub-persistence.js's metrics.stressIndex reads this exact field) — surfacing
        // it here too, at the old hub's thresholds, is expected reinforcement, not a
        // second independent signal.
        var traj = computed && computed.stressTrajectory;
        var trajScore = (traj && traj.summary && traj.summary.currentScore != null)
            ? Math.round(traj.summary.currentScore) : null;
        if (trajScore != null) {
            if (trajScore > 70) {
                today.push(aqCard({
                    chips: [{ type: 'estimate', label: 'Stress' }],
                    title: 'Turf stress index is HIGH (' + trajScore + '%)',
                    reason: 'Multiple stress factors converging',
                    commitLabel: 'Commit — review mitigation'
                }));
            } else if (trajScore > 50) {
                week.push(aqCard({
                    chips: [{ type: 'estimate', label: 'Stress' }],
                    title: 'Turf stress index is ELEVATED (' + trajScore + '%)',
                    reason: 'Review stress trajectory and mitigation options',
                    commitLabel: 'Commit — review',
                    btnCls: 'amber'
                }));
            }
        }

        // ── Sensor staleness ─────────────────────────────────────
        var canonical = window.GAIP_CANONICAL_STATE;
        var sensorInfo = canonical && canonical.sensor;
        if (sensorInfo && sensorInfo.available && sensorInfo.importDate) {
            var daysSinceImport = Math.floor((Date.now() - new Date(sensorInfo.importDate).getTime()) / 86400000);
            if (daysSinceImport > 7) {
                watching.push(aqCard({
                    title: 'Sensor data is ' + daysSinceImport + ' days old, reimport recommended',
                    reason: 'Last import: ' + new Date(sensorInfo.importDate).toLocaleDateString() +
                            ' (' + (sensorInfo.source || 'sensor') + ')',
                    commitLabel: 'Commit to watching',
                    btnCls: 'grey'
                }));
            }
        }

        var total = today.length + week.length + watching.length;
        if (!total) return; // Leave "Run analysis" message

        var html = aqSection('dot-red', 'TODAY', today, 'today')
                 + aqSection('dot-amber', 'THIS WEEK', week, 'week')
                 + aqSection('dot-grey', 'WATCHING', watching, 'watching');

        bodyEl.innerHTML = html;
        setText('db-aq-resolved', '0/' + total + ' resolved');
    }

    // =========================================================================
    // DATA SOURCES — sensor freshness from localStorage
    // =========================================================================

    function updateSourcesBadge() {
        var grid = document.getElementById('db-sources-grid');
        if (!grid) return;
        // Dots with neither .ok nor .warning (class "none") mean "never tested" —
        // they must not be counted as current, unlike the old `6 - warnings` formula did.
        var total    = grid.querySelectorAll('.db-source-dot').length;
        var warnings = grid.querySelectorAll('.db-source-dot.warning').length;
        var ok       = grid.querySelectorAll('.db-source-dot.ok').length;

        var badge = document.getElementById('db-sources-badge');
        if (badge) {
            badge.textContent = warnings + (warnings === 1 ? ' issue' : ' issues');
            badge.style.display = warnings > 0 ? '' : 'none';
        }
        var okEl       = document.getElementById('db-sources-ok-count');
        var issuesPart = document.getElementById('db-sources-issues-part');
        var issueEl    = document.getElementById('db-sources-issue-count');
        var scoreEl    = document.getElementById('db-sources-score');
        var fillEl     = document.getElementById('db-sources-progress-fill');
        if (okEl)       okEl.textContent       = ok;
        if (issuesPart) issuesPart.style.display = warnings > 0 ? '' : 'none';
        if (issueEl)    issueEl.textContent    = warnings + ' needs update';
        if (scoreEl)    scoreEl.textContent    = ok + '/' + total + ' sources';
        if (fillEl)     fillEl.style.width     = (total ? Math.round(ok / total * 100) : 0) + '%';
    }

    // =========================================================================
    // SENSOR LIVE READINGS — populate VWC card + soilTemp from localStorage cache
    // =========================================================================

    function populateSensorReadings(siteId) {
        var cache = safeJson(_ls.getItem('gaip_hydrosight_readings_cache_' + (siteId || 'default')));
        if (!cache || !cache.data || !cache.data.length) return;

        var readings = cache.data;

        // Aggregate all readings with VWC values → site average
        var vwcVals  = readings.map(function (r) { return r.vwc; }).filter(function (v) { return v != null; });
        var tmpVals  = readings.map(function (r) { return r.soilTemp; }).filter(function (v) { return v != null; });

        if (!vwcVals.length) return;

        var avg = function (arr) { return arr.reduce(function (a, b) { return a + b; }, 0) / arr.length; };
        var vwc = Math.round(avg(vwcVals) * 10) / 10;
        var tmp = tmpVals.length ? Math.round(avg(tmpVals) * 10) / 10 : null;

        // Target zone matches old hub: 15–25% on a 0–40% (FC) scale
        var vwcMin = 15;
        var vwcMax = 25;
        var maxVal = 40;   // bar scale (field capacity)

        // Update VWC card value
        var valEl = document.getElementById('db-vwc-value');
        if (valEl) {
            valEl.textContent = vwc + '%';
            var cls = vwc < vwcMin ? 'critical' : (vwc <= vwcMax ? 'ok' : 'above');
            valEl.className = 'db-vital-main ' + cls;
        }

        // Position needle on zone bar
        var needleEl = document.getElementById('db-vwc-fill');
        if (needleEl) {
            var pct = Math.min(vwc / maxVal * 100, 100);
            needleEl.style.left = pct.toFixed(1) + '%';
            needleEl.style.display = '';
        }

        // Update footer message — hidden by default (blade) when there's no
        // sensor data; only shown once we actually have something to say.
        var msgEl = document.getElementById('db-vwc-msg');
        if (msgEl) {
            var nSensors = readings.length;
            var badge = ' <span style="font-size:10px;color:var(--gaip-text-muted)">· ' + nSensors + ' sensor' + (nSensors !== 1 ? 's' : '') + ' live</span>';
            if (vwc < vwcMin) {
                msgEl.innerHTML = '<span style="color:#dc2626">Below target — review irrigation schedule</span>' + badge;
            } else if (vwc <= vwcMax) {
                msgEl.innerHTML = 'Within target zone (' + vwcMin + '–' + vwcMax + '%)' + badge;
            } else {
                msgEl.innerHTML = 'Above target — monitor drainage' + badge;
            }
            msgEl.style.display = '';
        }

        // Override GP footer with live soil temp if available
        if (tmp != null) {
            var gpFooterEl = document.getElementById('db-gp-footer');
            if (gpFooterEl && gpFooterEl.textContent.indexOf('Soil') !== -1) {
                gpFooterEl.textContent = 'Soil ' + tmp + '°C (live)';
            } else if (gpFooterEl && gpFooterEl.textContent === '') {
                gpFooterEl.textContent = 'Soil ' + tmp + '°C (live)';
            }
        }
    }

    function populateSensorSource(siteId) {
        // gilba_sensor_last_fetch is written globally (not per-site) by the sensor
        // refresh flow, so it must not be trusted on its own — it can hold another
        // site's fetch timestamp. Cross-check against this site's own readings cache.
        var cache      = safeJson(_ls.getItem('gaip_hydrosight_readings_cache_' + (siteId || 'default')));
        var hasSiteData = !!(cache && cache.data && cache.data.length);
        var sensorData = hasSiteData ? safeJson(_ls.getItem('gilba_sensor_last_fetch')) : null;
        var dotEl  = document.querySelector('[data-source="sensors"] .db-source-dot');
        var textEl = document.getElementById('db-sensor-status');

        if (sensorData && sensorData.fetchedAt) {
            var ts    = cache.timestamp || new Date(sensorData.fetchedAt).getTime();
            var mins  = Math.round((Date.now() - ts) / 60000);
            var label = mins < 60 ? mins + 'm ago' : Math.round(mins / 60) + 'h ago';
            if (dotEl)  dotEl.className  = 'db-source-dot ok';
            if (textEl) { textEl.className = 'db-source-status-text ok'; textEl.textContent = label; }
            // Update provider name if available
            var provEl = document.getElementById('db-sensor-provider');
            if (provEl && sensorData.provider) provEl.textContent = sensorData.provider;
        } else {
            // No sensor data cached for this site — mark as not connected
            if (dotEl)  dotEl.className  = 'db-source-dot warning';
            if (textEl) { textEl.className = 'db-source-status-text warning'; textEl.textContent = 'Not connected'; }
        }
        updateSourcesBadge();
    }

    // =========================================================================
    // CARD SIDE PANELS
    // =========================================================================

    var _panelMetrics  = null;
    var _panelComputed = null;

    function initCardPanels(metrics, computed) {
        _panelMetrics  = metrics;
        _panelComputed = computed;

        var backdrop = document.getElementById('db-panel-backdrop');
        var panel    = document.getElementById('db-side-panel');
        var closeBtn = document.getElementById('db-panel-close');
        if (!panel) return;

        document.querySelectorAll('.db-vital-card[data-panel]').forEach(function (card) {
            card.addEventListener('click', function (e) {
                if (e.target.closest('.db-info-icon')) return;
                openPanel(card.dataset.panel);
            });
        });

        function closePanelFn() {
            panel.classList.remove('open');
            if (backdrop) backdrop.classList.remove('open');
        }

        if (closeBtn)  closeBtn.addEventListener('click', closePanelFn);
        if (backdrop)  backdrop.addEventListener('click', closePanelFn);
        document.addEventListener('keydown', function (e) {
            if (e.key === 'Escape' && panel.classList.contains('open')) closePanelFn();
        });
    }

    function openPanel(key) {
        var panel    = document.getElementById('db-side-panel');
        var body     = document.getElementById('db-panel-body');
        var titleEl  = document.getElementById('db-panel-title');
        var backdrop = document.getElementById('db-panel-backdrop');
        if (!panel || !body) return;

        var TITLES = {
            'growth-potential': 'Growth Potential',
            'disease-risk':     'Disease Risk',
            'stress-index':     'Stress Index',
            'vwc':              'Soil Moisture (VWC)',
            'irrigation-plan':  'Irrigation Plan'
        };
        if (titleEl) titleEl.textContent = TITLES[key] || key;

        var html = '';
        if      (key === 'growth-potential') html = buildGrowthPanel(_panelMetrics, _panelComputed);
        else if (key === 'disease-risk')     html = buildDiseasePanel(_panelMetrics, _panelComputed);
        else if (key === 'stress-index')     html = buildStressPanel(_panelMetrics, _panelComputed);
        else if (key === 'vwc')              html = buildVWCPanel(_panelMetrics, _panelComputed);
        else if (key === 'irrigation-plan')  html = buildIrrigationPanel(_panelMetrics, _panelComputed);

        var ANALYSIS_TABS = {
            'growth-potential': 'growth-light',
            'disease-risk':     'disease',
            'stress-index':     'stress',
            'vwc':              'water-balance',
            'irrigation-plan':  'water-balance'
        };
        if (html && ANALYSIS_TABS[key]) {
            html += '<a class="db-panel-analysis-link" href="/analysis#' + ANALYSIS_TABS[key] + '">' +
                'View full analysis' +
                '<svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7"/></svg>' +
                '</a>';
        }

        body.innerHTML = html ||
            '<p style="color:var(--gaip-text-muted,#6b8878);font-size:13px;padding:8px 0">No data available — run analysis in Hub first.</p>';
        if (key === 'disease-risk') enrichDashboardResidual();
        panel.classList.add('open');
        if (backdrop) backdrop.classList.add('open');
    }

    /* ── Panel helpers ── */
    function panelHero(value, cls, subtitle) {
        return '<div class="db-panel-hero">' +
            '<div class="db-panel-hero-value' + (cls ? ' ' + cls : '') + '">' + value + '</div>' +
            (subtitle ? '<div class="db-panel-hero-label">' + subtitle + '</div>' : '') +
            '</div>';
    }
    function panelSection(title, content) {
        return '<div class="db-panel-section"><div class="db-panel-section-title">' + title + '</div>' + content + '</div>';
    }
    function factorRow(label, val, color) {
        return '<div class="db-factor-row">' +
            '<div class="db-factor-label">' + label + '</div>' +
            '<div class="db-factor-bar-wrap"><div class="db-factor-bar-fill" style="width:' + Math.min(val, 100) + '%;background:' + color + '"></div></div>' +
            '<div class="db-factor-value">' + Math.round(val) + '</div>' +
            '</div>';
    }
    function statGrid(stats) {
        return '<div class="db-stat-grid">' +
            stats.map(function (s) {
                return '<div class="db-stat-cell">' +
                    '<div class="db-stat-value">' + s.value + '</div>' +
                    '<div class="db-stat-label">' + s.label + '</div>' +
                    '</div>';
            }).join('') +
            '</div>';
    }
    function barColor(v) { return v >= 60 ? '#dc2626' : (v >= 30 ? '#d97706' : '#16a34a'); }

    /* ── Growth Potential ── */
    function buildGrowthPanel(m, c) {
        var gpObj   = c && c.climate && c.climate.growth;
        var climate = c && c.climate;

        // Species info (needed before dailyPattern GP selection - species-name
        // C4 detection below depends on it)
        var cfg         = global.GAIP_HUB_CONFIG || {};
        var speciesName = cfg.turfSpecies ? cfg.turfSpecies : null;

        // Species type (needed before dailyPattern GP selection).
        // Prefer c3Fraction/c4Fraction when present (mixed/overseed stands need
        // the weighted blend), but climateMetrics.growth is rebuilt from scratch
        // in hub-tissue-v3.js's GP-override step without ever copying those
        // *Fraction fields onto it - so by the time this object is cached and
        // read here they're normally absent, and c3f/c4f used to silently
        // default to "pure C3" (c3f=1, c4f=0) regardless of actual species.
        // Fall back to detecting C4 species directly from the name instead -
        // same species list as hub-orchestrator.js's isC4Species(). Without
        // this, every pure-C4 site (Buffalograss, Couch, Kikuyu...) showed as
        // "C3 cool-season grass" and pulled the wrong (c3) daily-pattern field.
        var c3f, c4f, isWarm;
        if (gpObj && (gpObj.c3Fraction != null || gpObj.c4Fraction != null)) {
            c3f = gpObj.c3Fraction != null ? gpObj.c3Fraction : (gpObj.c3Frac || 1);
            c4f = gpObj.c4Fraction != null ? gpObj.c4Fraction : (gpObj.c4Frac || 0);
            isWarm = c4f > c3f;
        } else {
            isWarm = /couch|bermuda|kikuyu|buffalo|zoysia|paspalum/i.test(speciesName || '');
            c3f = isWarm ? 0 : 1;
            c4f = isWarm ? 1 : 0;
        }
        var isMixed = c3f > 0 && c4f > 0;
        var gpField = isMixed ? 'weighted' : (isWarm ? 'c4' : 'c3');

        // dailyPattern from climate.growth.dailyPattern (correct field name)
        var dailyArr = gpObj && Array.isArray(gpObj.dailyPattern) ? gpObj.dailyPattern : null;
        var todayEntry = dailyArr && dailyArr.length > 0 ? dailyArr[0] : null;

        // 8-day average from dailyPattern (PACE: daily mean per entry)
        var avgGP = null;
        if (dailyArr && dailyArr.length > 0) {
            var eightDay = dailyArr.slice(0, 8);
            var _avgSum = 0;
            eightDay.forEach(function(d) { _avgSum += (d[gpField] != null ? d[gpField] : (d.weighted || 0)); });
            avgGP = Math.round(_avgSum / eightDay.length);
        } else {
            var avgRaw = m && m.growthPotential != null ? m.growthPotential
                       : (gpObj && gpObj.weighted != null ? gpObj.weighted : null);
            if (avgRaw != null) avgGP = avgRaw >= 1 ? Math.round(avgRaw) : Math.round(avgRaw * 100);
        }

        // Today's GP — from dailyPattern[0] (daily mean per PACE contract, not current-hour override)
        var todayRaw = todayEntry ? (todayEntry[gpField] != null ? todayEntry[gpField] : todayEntry.weighted) : null;
        var todayGP  = todayRaw != null ? (todayRaw >= 1 ? Math.round(todayRaw) : Math.round(todayRaw * 100)) : null;
        var todayCls = todayGP != null ? (todayGP >= 70 ? 'ok' : (todayGP >= 40 ? 'warning' : 'critical')) : '';

        var seasonTag   = isWarm ? 'C4 warm-season grass' : 'C3 cool-season grass';

        // Temperature — daily mean from dailyPattern[0].temp (PACE: daily mean, not current-hour reading)
        var todayTemp = (todayEntry && todayEntry.temp != null) ? todayEntry.temp :
                        (climate && climate.temperature ? climate.temperature.todayMean : null);
        var insightText = (function() {
            if (todayTemp == null) return null;
            var t = todayTemp;
            var sp = speciesName || (isWarm ? 'warm-season grass' : 'cool-season grass');
            if (isWarm) {
                if (t > 38)   return 'Extreme heat — ' + sp + ' growth is starting to suffer.';
                if (t >= 28)  return 'Optimal conditions — expect strong ' + sp + ' growth.';
                if (t >= 20)  return 'Warm conditions — ' + sp + ' growth is picking up.';
                if (t >= 10)  return 'Cool conditions — ' + sp + ' growth is suppressed.';
                return sp + ' is dormant.';
            } else {
                if (t > 30)   return 'Heat stress — ' + sp + ' growth has nearly stopped.';
                if (t >= 25)  return 'Warm conditions — ' + sp + ' growth is slowing.';
                if (t >= 15)  return 'Optimal conditions — expect strong ' + sp + ' growth.';
                if (t >= 10)  return 'Cool conditions — ' + sp + ' growth is slower, improving as it warms.';
                if (t >= 5)   return 'Cold — ' + sp + ' growth is very slow.';
                return sp + ' growth has stopped.';
            }
        })();

        // ET₀, Soil Temp
        var _rawEt = (m && m.et != null) ? m.et : (climate && climate.et != null ? climate.et : null);
        var etVal  = _rawEt == null ? null
                   : (typeof _rawEt === 'number' ? _rawEt
                   : (typeof _rawEt.daily === 'number' ? _rawEt.daily
                   : (typeof _rawEt.total === 'number' ? _rawEt.total : null)));
        // also try irrigation water balance if still missing
        if (etVal == null && c && c.irrigation) {
            var _wb = c.irrigation.waterBalance || c.irrigation.summary;
            if (_wb && _wb.et0 != null) etVal = parseFloat(_wb.et0) || null;
            else if (_wb && _wb.totalET != null) etVal = parseFloat(_wb.totalET) / 7 || null;
        }

        var _rawSt = (m && m.soilTemp != null) ? m.soilTemp : (climate && climate.soilTemp != null ? climate.soilTemp : null);
        var stVal  = _rawSt == null ? null
                   : (typeof _rawSt === 'number' ? _rawSt
                   : (_rawSt.depths && typeof _rawSt.depths.d100mm === 'number' ? _rawSt.depths.d100mm
                   : (_rawSt.depths && typeof _rawSt.depths.d50mm  === 'number' ? _rawSt.depths.d50mm
                   : (typeof _rawSt.estimated === 'number' ? _rawSt.estimated
                   : (typeof _rawSt.mean === 'number' ? _rawSt.mean : null)))));
        // soilTempPhysics fallback: summary.depths uses string keys '100mm', each value = { mean, current }
        if (stVal == null && c && c.soilTempPhysics) {
            var _stp = c.soilTempPhysics.summary;
            if (_stp && _stp.depths) {
                var _d100 = _stp.depths['100mm'], _d50 = _stp.depths['50mm'];
                stVal = (_d100 && _d100.mean != null) ? _d100.mean
                      : (_d50  && _d50.mean  != null) ? _d50.mean : null;
            }
        }

        var avgCls = avgGP != null ? (avgGP >= 70 ? 'ok' : (avgGP >= 40 ? 'warning' : 'critical')) : '';
        var html = '';

        // Species badge
        if (speciesName) {
            html += '<div style="font-size:12px;color:var(--gaip-text-muted,#6b8878);margin-bottom:14px;padding:8px 12px;background:var(--gaip-surface-muted,#f5f7f6);border-radius:6px;border:1px solid var(--gaip-border,#d8e0dc)">' +
                '<strong style="color:var(--gaip-text,#1a2b23)">' + speciesName + '</strong>' +
                ' &middot; ' + seasonTag +
                '</div>';
        }

        // Hero: Today's GP (main number, daily mean per PACE contract)
        html += panelHero(todayGP != null ? todayGP + '%' : '—', todayCls, 'Today\'s Growth Potential');

        // Insight text under hero
        if (insightText) {
            var insightColor = todayCls === 'ok' ? '#14532d' : (todayCls === 'warning' ? '#78350f' : '#7f1d1d');
            var insightBg    = todayCls === 'ok' ? '#f0fdf4' : (todayCls === 'warning' ? '#fffbeb' : '#fef2f2');
            var soilPrefix = stVal != null ? '<strong>' + Math.round(stVal) + '°C soil</strong>' : '';
            var insightRow = '<div style="padding:8px 10px;border-radius:6px;background:' + insightBg + ';font-size:12px;color:' + insightColor + ';line-height:1.5">' +
                  (soilPrefix ? soilPrefix + ' &mdash; ' : '') + insightText + '</div>';
            html += panelSection('Today\'s Conditions', insightRow);
        }

        // 8-Day Average below
        if (avgGP != null) {
            var avgColor = avgCls === 'ok' ? '#16a34a' : (avgCls === 'warning' ? '#d97706' : '#dc2626');
            var avgContent = '<div style="display:flex;align-items:baseline;gap:8px"><span style="font-size:22px;font-weight:700;color:' + avgColor + '">' + avgGP + '%</span>' +
                '<span style="font-size:12px;color:var(--gaip-text-muted,#6b8878)">8-day forecast average</span></div>';
            html += panelSection('8-Day Average GP', avgContent);
        }


        // DLI
        var shade       = c && c.shade;
        var dli         = shade ? (shade.DLI_total || shade.dliShaded || null) : null;
        var dliAmbient  = shade ? (shade.dli_ambient || shade.ambientDLI || null) : null;
        var dliTarget   = shade ? (shade.blendedTargetDLI || shade.dliTarget || null) : null;
        var dliStatus   = shade ? (shade.effectiveStatus || null) : null;
        if (dli == null && c && c.climate) {
            var _raw = c.climate;
            dli = _raw.ambientDLI || (_raw.light && _raw.light.dli) || null;
        }
        if (dli != null) {
            var dliColor2 = dliStatus
                ? (dliStatus.toLowerCase().indexOf('optimal') !== -1 ? '#16a34a'
                  : dliStatus.toLowerCase().indexOf('adequate') !== -1 ? '#d97706' : '#dc2626')
                : (dliTarget && dli >= dliTarget ? '#16a34a' : (dliTarget && dli >= dliTarget * 0.75 ? '#d97706' : '#dc2626'));
            var dliLabel = dliStatus ? dliStatus.split('(')[0].trim() : null;
            var _u = '<span style="font-size:11px;font-weight:400;color:var(--gaip-text-muted,#6b8878)"> mol/m²/d</span>';
            var dliStats = [{ value: '<span style="color:' + dliColor2 + '">' + dli.toFixed(1) + '</span>' + _u, label: 'DLI today' }];
            if (dliTarget != null) dliStats.push({ value: dliTarget.toFixed(1) + _u, label: 'Target' });
            if (dliAmbient != null && Math.abs(dliAmbient - dli) > 0.5) dliStats.push({ value: dliAmbient.toFixed(1) + _u, label: 'Open sky' });
            var dliHtml = statGrid(dliStats);
            if (dliLabel) {
                dliHtml += '<div style="margin-top:8px;font-size:12px;padding:6px 10px;border-radius:5px;background:var(--gaip-surface-muted,#f5f7f6);color:' + dliColor2 + ';font-weight:600">' + dliLabel + '</div>';
            }
            html += panelSection('Light (DLI)', dliHtml);
        }

        return html;
    }

    /* ── Fungicide Residual & FRAC ── */
    function buildResidualHtml() {
        var protection  = global._sprayResidualProtection;
        var fracWarnings = global._sprayFRACWarnings;
        var html = '';

        if (fracWarnings && fracWarnings.length > 0) {
            html += '<div style="margin-bottom:8px;">';
            fracWarnings.forEach(function(w) {
                html += '<div style="padding:8px 10px;background:#fef3c7;border-left:3px solid #f59e0b;border-radius:4px;font-size:12px;color:#92400e;margin-bottom:4px;">' + escHtml(w.message || '') + '</div>';
            });
            html += '</div>';
        }

        if (!protection || !protection.productName) {
            if (!html) {
                html = '<p style="font-size:12px;color:var(--gaip-text-muted,#94a3b8);margin:0;">No fungicide on record. Log a spray in <a href="/data?section=spray-log" style="color:var(--gaip-brand,#236b4a);">Spray Log</a> to track residual protection.</p>';
            }
            return html;
        }

        var uvR = protection.uvResidual;
        var pct = uvR ? uvR.residualPct : protection.pctRemaining;
        var pctColor = pct >= 70 ? '#16a34a' : (pct >= 40 ? '#d97706' : '#dc2626');
        var reapply = uvR ? uvR.reapplyFlag : (pct < 30);

        html += '<div style="padding:10px 12px;background:var(--gaip-surface-2,#f0f4f2);border-radius:6px;">';
        html += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">';
        html += '<span style="font-size:13px;font-weight:600;color:var(--gaip-text,#1a2b23);">' + escHtml(protection.productName) + '</span>';
        html += '<span style="font-size:13px;font-weight:700;color:' + pctColor + ';">' + pct + '% active</span>';
        html += '</div>';

        var meta = [];
        if (protection.daysSince != null) meta.push('Applied ' + protection.daysSince + 'd ago');
        if (protection.fracGroup)          meta.push('FRAC ' + escHtml(String(protection.fracGroup)));
        if (meta.length) html += '<div style="font-size:11px;color:var(--gaip-text-secondary,#6b7280);margin-bottom:6px;">' + meta.join(' · ') + '</div>';

        html += '<div style="height:4px;background:#e5e7eb;border-radius:2px;margin-bottom:6px;">';
        html += '<div style="height:4px;background:' + pctColor + ';border-radius:2px;width:' + Math.min(pct, 100) + '%;"></div>';
        html += '</div>';

        if (reapply) {
            html += '<div style="font-size:11px;font-weight:600;color:#b45309;margin-bottom:4px;">Consider reapplication — residual below 70%</div>';
        }

        if (uvR && uvR.breakdown) {
            var bk = uvR.breakdown;
            html += '<div style="font-size:11px;color:var(--gaip-text-muted,#94a3b8);">Photolysis model: UV ' + bk.uvSurvival + '% · Rain ' + bk.rainSurvival + '% · Bio ' + bk.bioSurvival + '%</div>';
        }

        html += '</div>';
        return html;
    }

    function enrichDashboardResidual() {
        var container = document.getElementById('db-disease-residual');
        if (!container) return;
        container.innerHTML = buildResidualHtml();
    }

    /* ── Disease Risk ── */
    function buildDiseasePanel(m, c) {
        var diseases = c && c.disease && c.disease.diseases ? c.disease.diseases : null;
        var risk     = m && m.diseaseRisk  != null ? (m.diseaseRisk  > 1 ? Math.round(m.diseaseRisk)  : Math.round(m.diseaseRisk  * 100)) : 0;
        var peak     = m && m.forecastPeak != null ? (m.forecastPeak > 1 ? Math.round(m.forecastPeak) : Math.round(m.forecastPeak * 100)) : null;

        // Hero mirrors the vital-card: today's percentage (not a max(current,
        // forecast) word), sub-label names today's driving disease. Forecast
        // has its own clearly-labeled "Forecast" section below — no blended
        // "X% now → Y% forecast" arrow here either.
        var cls = risk >= 70 ? 'critical' : (risk >= 50 ? 'warning' : 'ok');
        var heroSub = m && m.topDisease ? ('Today · ' + m.topDisease) : 'Today';
        var html = panelHero(risk + '%', cls, heroSub);

        var makeRow = function (name, cur, pk, pd, tw) {
            var pct  = cur || 0;
            var col  = pct >= 70 ? '#dc2626' : (pct >= 50 ? '#d97706' : '#16a34a');
            var sub  = pk != null && pd != null && pd > 0
                ? 'Peak ' + pk + '% in ' + pd + ' day' + (pd !== 1 ? 's' : '')
                : (pk != null ? 'Peak ' + pk + '%' : '');
            var win  = '';
            if (tw && tw.inWindow) {
                win = '<span style="font-size:10px;color:#b45309;font-weight:600;margin-left:4px">Window open' + (tw.soilTemp != null ? ' · ' + tw.soilTemp + '°C' : '') + '</span>';
            } else if (tw && tw.timing) {
                win = '<span style="font-size:10px;color:var(--gaip-text-secondary);margin-left:4px">' + tw.timing + '</span>';
            }
            return '<div class="db-disease-row">' +
                '<div class="db-disease-row-head">' +
                '<span class="db-disease-row-name">' + name + '</span>' +
                (cur != null ? '<span class="db-disease-row-pct" style="color:' + col + '">' + cur + '%</span>' : '') +
                '</div>' +
                '<div class="db-progress-bar" style="margin:0 0 4px"><div class="db-progress-fill" style="width:' + Math.min(pct,100) + '%;background:' + col + '"></div></div>' +
                (sub ? '<div class="db-disease-row-sub">' + sub + '</div>' : '') +
                (win  ? '<div>' + win + '</div>' : '') +
                '</div>';
        };

        var cd = m && m.companionDisease;
        var hasCompanion = cd && cd.diseases && cd.diseases.length;

        // Section label "Greens" only when companion analysis is also present
        if (hasCompanion) {
            html += '<div style="font-size:10px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:var(--gaip-text-secondary,#6b7280);padding:10px 16px 4px;border-top:1px solid var(--gaip-border-light,#e8eeeb)">Greens</div>';
        }

        if (diseases && diseases.length) {
            var rows = diseases.filter(function (d) {
                var s = d.adjustedRisk != null ? d.adjustedRisk : (d.riskScore != null ? d.riskScore : 0);
                // #91: Fusarium off the front — this reads the raw, unfiltered
                // computed.disease.diseases array (unlike topDisease/diseaseRisk,
                // which already exclude it), so it needs its own check.
                return s > 0 && d.disease !== 'fusarium';
            }).slice(0, 5).map(function (d) {
                var name = d.displayName || d.name || d.disease || 'Unknown';
                var cur  = d.adjustedRisk != null ? Math.round(d.adjustedRisk) : (d.riskScore != null ? Math.round(d.riskScore) : (d.current != null ? Math.round(d.current) : null));
                var pk   = d.peakRisk     != null ? Math.round(d.peakRisk)     : null;
                return makeRow(name, cur, pk, d.peakDay != null ? d.peakDay : null, d.treatmentWindow || null);
            }).join('');
            html += panelSection('Disease Breakdown', rows);
        } else if (m && m.topDisease) {
            html += panelSection('Disease Breakdown', makeRow(m.topDisease, risk, peak, m.peakDay || null, null));
        }

        if (peak != null && m && m.peakDay != null) {
            var fcDisease = m.forecastDisease || m.topDisease || '';
            var fcDayLabel = m.peakDay === 1 ? '1 day' : m.peakDay + ' days';
            var fcContent = '<p style="font-size:13px;margin:0;color:var(--gaip-text,#1a2b23)">' +
                (fcDisease ? '<strong>' + fcDisease + '</strong><br>' : '') +
                'Peak: <strong>' + peak + '%</strong> in ' + fcDayLabel +
                '</p>';
            html += panelSection('Forecast', fcContent);
        }

        // Companion surface (fairway/tee) — separate section
        if (hasCompanion) {
            var cdLabel = cd.speciesLabel || cd.species || 'Fairway / Tee';
            html += '<div style="font-size:10px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:var(--gaip-text-secondary,#6b7280);padding:12px 16px 4px;border-top:1px solid var(--gaip-border,#d8e0dc);margin-top:6px">' +
                'Fairway / Tee — ' + cdLabel + '</div>';
            // #91: fusarium already excluded upstream in hub-persistence.js's
            // collectDashboardMetrics() (this shape has no .disease field to filter on here).
            var cdRows = cd.diseases.slice(0, 3).map(function(d) {
                var col = d.risk >= 70 ? '#dc2626' : (d.risk >= 40 ? '#d97706' : '#16a34a');
                var win = d.inWindow
                    ? '<span style="font-size:10px;color:#b45309;font-weight:600;margin-left:4px">Window open' + (d.soilTemp != null ? ' · ' + d.soilTemp + '°C' : '') + '</span>'
                    : (d.timing ? '<span style="font-size:10px;color:var(--gaip-text-secondary);margin-left:4px">' + d.timing + '</span>' : '');
                return '<div class="db-disease-row">' +
                    '<div class="db-disease-row-head">' +
                    '<span class="db-disease-row-name">' + (d.name || '') + '</span>' +
                    '<span class="db-disease-row-pct" style="color:' + col + '">' + d.risk + '%</span>' +
                    '</div>' +
                    '<div class="db-progress-bar" style="margin:0 0 2px"><div class="db-progress-fill" style="width:' + Math.min(d.risk, 100) + '%;background:' + col + '"></div></div>' +
                    win +
                    '</div>';
            }).join('');
            html += panelSection('Disease Breakdown', cdRows);
        }

        html += panelSection('Fungicide Residual', '<div id="db-disease-residual"></div>');

        return html;
    }

    /* ── Stress Index ── */
    function buildStressPanel(m, c) {
        var stress    = m && m.stressIndex != null ? Math.round(m.stressIndex) : null;
        var stressCls = stress != null ? (stress >= 60 ? 'critical' : (stress >= 30 ? 'warning' : 'ok')) : '';
        var html      = panelHero(stress != null ? stress + '/100' : '—', stressCls, 'Combined Stress Score');

        var traj  = c && c.stressTrajectory;
        var comps = traj && (traj.currentComponents || (traj.data && traj.data.currentComponents));
        if (comps) {
            var _isSportsPanel = (global.GAIP_HUB_CONFIG && global.GAIP_HUB_CONFIG.siteType) === 'sports';
            var rows = [
                { key: 'thermal',   label: 'Heat' },
                { key: 'moisture',  label: 'Moisture' },
                { key: 'light',     label: 'Light' },
                { key: 'traffic',   label: 'Traffic' },
                { key: 'nutrition', label: 'Nutrition' },
                { key: 'biotic',    label: 'Disease' }
            ].filter(function (f) { return f.key !== 'traffic' || _isSportsPanel; })
            .map(function (f) {
                var val = Math.abs(comps[f.key] || 0);
                return factorRow(f.label, val, barColor(val));
            }).join('');
            html += panelSection('Stress Components', rows);
        }

        var summary = traj && traj.summary;
        if (summary) {
            var rec = summary.recommendation;
            var recText = typeof rec === 'string' ? rec : (rec && rec.message ? rec.message : '');
            if (recText) {
                html += panelSection('Summary', '<p style="font-size:13px;margin:0;line-height:1.5;color:var(--gaip-text,#1a2b23)">' + recText + '</p>');
            }
        }
        return html;
    }

    /* ── VWC ── */
    function buildVWCPanel(m) {
        var vwcRaw = m && m.vwc != null ? m.vwc : null;

        // Fallback: read directly from Hydrosight sensor cache (same as card)
        if (vwcRaw == null) {
            var config  = (global.GAIP_HUB_CONFIG || {});
            var siteId  = config.activeSiteId || 'default';
            var cache   = safeJson(_ls.getItem('gaip_hydrosight_readings_cache_' + siteId));
            if (cache && cache.data && cache.data.length) {
                var vwcVals = cache.data.map(function(r) { return r.vwc; }).filter(function(v) { return v != null; });
                if (vwcVals.length) {
                    vwcRaw = vwcVals.reduce(function(a, b) { return a + b; }, 0) / vwcVals.length;
                }
            }
        }

        var vwcMin = 15, vwcMax = 25, fc = 40, maxVal = 40;

        if (vwcRaw == null) {
            return panelHero('—', '', 'Volumetric Water Content') +
                panelSection('Status', '<p style="font-size:13px;margin:0;color:var(--gaip-text-muted,#6b8878)">No sensor data available. Connect a soil moisture sensor to see live VWC readings.</p>') +
                panelSection('How to read', '<p style="font-size:12px;margin:0;line-height:1.55;color:var(--gaip-text,#1a2b23)">Target zone is ' + vwcMin + '–' + vwcMax + '% VWC for most sand-based rootzones. Field capacity (FC) ~' + fc + '%.</p>');
        }

        var vwc     = Math.round(vwcRaw * 10) / 10;
        var fillPct = Math.min(vwc / maxVal * 100, 100);
        var zoneLo  = vwcMin / maxVal * 100;
        var zoneWid = (vwcMax - vwcMin) / maxVal * 100;
        var onTrack = vwc >= vwcMin && vwc <= vwcMax;
        var vcCls   = vwc < vwcMin ? 'critical' : (onTrack ? 'ok' : 'above');

        var html = panelHero(vwc + '%', vcCls, 'Volumetric Water Content');

        var needlePct = fillPct.toFixed(1);
        var bar = '<div style="position:relative;margin:8px 0 4px">' +
            '<div style="display:flex;height:14px;border-radius:6px;overflow:hidden">' +
            '<div style="width:' + zoneLo + '%;background:#fca5a5;flex-shrink:0"></div>' +
            '<div style="width:' + zoneWid + '%;background:#86efac;flex-shrink:0"></div>' +
            '<div style="flex:1;background:#93c5fd"></div>' +
            '</div>' +
            '<div style="position:absolute;top:-4px;left:' + needlePct + '%;width:3px;height:22px;background:#17231f;border-radius:2px;transform:translateX(-50%);box-shadow:0 0 0 2px #fff;pointer-events:none"></div>' +
            '</div>' +
            '<div style="display:flex;justify-content:space-between;font-size:10px;color:var(--gaip-text-muted,#6b8878);margin-top:2px">' +
            '<span style="color:#ef4444">Below target</span><span style="color:#16a34a">Target ' + vwcMin + '–' + vwcMax + '%</span><span style="color:#3b82f6">Above target</span>' +
            '</div>';
        html += panelSection('Soil Water Level', bar);

        var statusMsg = onTrack ? 'Optimal: within target zone (' + vwcMin + '–' + vwcMax + '%)'
                      : vwc < vwcMin ? 'Below target — review irrigation schedule'
                      :                'Above target — monitor drainage';
        var statusCol = onTrack ? '#16a34a' : '#d97706';
        html += panelSection('Status', '<p style="font-size:13px;margin:0;color:' + statusCol + ';font-weight:600">' + statusMsg + '</p>');

        html += panelSection('How to read', '<p style="font-size:12px;margin:0;line-height:1.55;color:var(--gaip-text,#1a2b23)">Green zone (' + vwcMin + '–' + vwcMax + '%) is the optimal range for most sand-based rootzones. Below target activates irrigation review. Field capacity (FC) ~' + fc + '%.</p>');
        return html;
    }

    /* ── Irrigation Plan ── */
    function buildIrrigationPanel(m, c) {
        var irr     = c && c.irrigation;
        var summary = irr && irr.summary;
        var irrMm   = m && m.irrigationNeed != null ? Math.round(m.irrigationNeed)
                    : (summary && summary.totalIrrigation != null ? Math.round(summary.totalIrrigation) : null);
        var irrCls  = irrMm != null ? (irrMm > 15 ? 'critical' : (irrMm > 8 ? 'warning' : 'ok')) : '';
        var html    = panelHero(irrMm != null ? irrMm + ' mm' : '—', irrCls, 'Weekly Requirement');

        var wb = irr && irr.waterBalance;
        if (wb || summary) {
            // waterBalance has currentDepletion; ET and rainfall live in summary
            var deficit = wb && wb.deficit    != null ? Math.round(wb.deficit)
                        : summary && summary.netDeficit != null ? Math.round(summary.netDeficit) : null;
            var et0     = wb && wb.et0        != null ? wb.et0.toFixed(1)
                        : summary && summary.totalET   != null ? summary.totalET.toFixed(1) : null;
            var rain    = wb && wb.rainfall   != null ? Math.round(wb.rainfall)
                        : summary && summary.totalPrecipitation != null ? Math.round(summary.totalPrecipitation) : null;
            html += panelSection('Water Balance', statGrid([
                { value: deficit != null ? (deficit > 0 ? '+' : '') + deficit + ' mm' : '—', label: deficit != null && deficit > 0 ? 'Deficit' : 'Surplus' },
                { value: et0  ? et0 + ' mm' : '—',  label: 'ET₀ (7d)' },
                { value: rain != null ? rain + ' mm' : '—', label: 'Rainfall (7d)' }
            ]));
        }

        var schedule = irr && irr.schedule;
        if (schedule && schedule.length) {
            var schedRows = schedule.slice(0, 7).map(function (d) {
                var dayDate = new Date(d.date + 'T12:00:00');
                var dayName = isNaN(dayDate.getTime()) ? d.date
                    : dayDate.toLocaleDateString('en', { weekday: 'short', month: 'short', day: 'numeric' });
                var mm = d.irrigation != null ? Math.round(d.irrigation.totalDepth || d.irrigation.netDepth || d.irrigation) : 0;
                return '<div class="db-irr-schedule-row">' +
                    '<span class="db-irr-schedule-day">' + dayName + '</span>' +
                    '<span class="db-irr-schedule-mm">' + (mm > 0 ? mm + ' mm' : '—') + '</span>' +
                    '</div>';
            }).join('');
            html += panelSection('7-Day Schedule', '<div class="db-irr-schedule">' + schedRows + '</div>');
        }
        return html;
    }

    // =========================================================================
    // MAIN
    // =========================================================================

    function checkWeatherStatus() {
        var cfg = global.GAIP_HUB_CONFIG || {};
        var lat = cfg.savedLocation && cfg.savedLocation.lat;
        var lon = cfg.savedLocation && cfg.savedLocation.lon;
        var wDot    = el('db-src-weather-dot');
        var wStatus = el('db-src-weather-status');
        if (!lat || !lon || !wDot || !wStatus) return;

        var today = new Date().toISOString().split('T')[0];
        var url = 'https://api.open-meteo.com/v1/forecast'
                + '?latitude=' + encodeURIComponent(lat)
                + '&longitude=' + encodeURIComponent(lon)
                + '&hourly=temperature_2m&start_date=' + today + '&end_date=' + today + '&timezone=auto';

        var ctrl = new AbortController();
        var tid = setTimeout(function() { ctrl.abort(); }, 5000);

        fetch(url, { signal: ctrl.signal })
            .then(function(r) {
                clearTimeout(tid);
                if (r.ok) {
                    wDot.className    = 'db-source-dot ok';
                    wStatus.className = 'db-source-status-text ok';
                    wStatus.textContent = 'Live';
                } else {
                    wDot.className    = 'db-source-dot warning';
                    wStatus.className = 'db-source-status-text warning';
                    wStatus.textContent = 'Unavailable';
                }
            })
            .catch(function() {
                clearTimeout(tid);
                wDot.className    = 'db-source-dot warning';
                wStatus.className = 'db-source-status-text warning';
                wStatus.textContent = 'Unavailable';
            });
    }

    function init() {
        var config = global.GAIP_HUB_CONFIG || {};
        var siteId = config.activeSiteId || 'default';

        // Primary source: DB-backed data injected by DashboardController via window.GAIP_DASHBOARD_DATA
        // Fallback: localStorage cache written by hub-persistence.js (supports first load before any DB data)
        var dbData   = global.GAIP_DASHBOARD_DATA || null;
        var metrics  = null;
        var computed = null;
        var ts       = null;

        if (dbData) {
            metrics  = dbData.metrics    || null;
            computed = dbData.computed   || null;
            ts       = dbData.analyzedAt || null;
        } else {
            var uid      = config.userId || 0;
            var cacheKey = 'gilba_hub_cache' + (uid ? '_' + uid : '');
            var cacheRaw = _ls.getItem(cacheKey)
                        || localStorage.getItem(cacheKey)
                        || _ls.getItem('gilba_hub_cache')
                        || localStorage.getItem('gilba_hub_cache');
            var cache    = safeJson(cacheRaw);
            // Discard cache if it belongs to a different site
            if (cache && cache.siteId && cache.siteId !== (config.activeSiteId || 'default')) {
                cache = null;
            }
            metrics  = cache && cache.dashboard ? cache.dashboard : null;
            computed = cache && cache.computed  ? cache.computed  : null;
            ts       = metrics ? (metrics.timestamp || (cache && cache.cachedAt)) : null;
        }

        populateVitals(metrics, computed);
        populateSensorReadings(siteId);
        populateVerdict(metrics);
        populateActionQueue(metrics, computed);
        populateTimestamp(ts);
        populatePills(siteId);
        populateSensorSource(siteId);
        initInfoPopovers();
        initCardPanels(metrics, computed);

        // Weather
        var loc = config.savedLocation;
        if (loc && loc.lat && loc.lon) {
            populateWeather(loc.lat, loc.lon);
        }

        checkWeatherStatus();

        // Refresh residual section when spray context loads async
        document.addEventListener('gaip:spray-context-loaded', function() {
            enrichDashboardResidual();
        });
    }

    // ── Getting Started floating panel ───────────────────────────────────────
    var GS_STEPS = ['setup', 'soil', 'water', 'tissue', 'sensors', 'analysis'];
    var GS_TOTAL = GS_STEPS.length;
    var GS_CLOSED_KEY    = 'gilba_getting_started_closed';    // sessionStorage: closed this session

    function gsIsDone(key, serverSteps, siteId) {
        if (key === 'setup') {
            var cfg = global.GAIP_HUB_CONFIG || {};
            var loc = cfg.savedLocation || {};
            return !!(cfg.turfSpecies && cfg.turfMethodology && loc.lat && loc.lon);
        }
        if (key === 'sensors') {
            // Sensors configured client-side only — check API keys or manual TDR import
            var id = siteId || 'default';
            try {
                var hs  = JSON.parse(localStorage.getItem('gaip_hydrosight_config_' + id) || '{}');
                var sc  = JSON.parse(localStorage.getItem('gaip_specconnect_config_' + id) || '{}');
                var tdr = localStorage.getItem('gaip_tdr_session_' + id);
                return !!(hs.apiKey || sc.apiKey || tdr);
            } catch (e) { return false; }
        }
        return !!serverSteps[key];
    }

    function gsRenderUI(panel, serverSteps, siteId, dismissedKey) {
        var doneCount = 0;
        GS_STEPS.forEach(function (key) {
            var item = panel.querySelector('.db-gs-item[data-key="' + key + '"]');
            if (!item) return;
            var done = gsIsDone(key, serverSteps, siteId);
            if (done) { item.classList.add('done'); doneCount++; }
            else item.classList.remove('done');
        });
        var fill  = document.getElementById('db-gs-fill');
        var label = document.getElementById('db-gs-label');
        if (fill)  fill.style.width = (doneCount / GS_TOTAL * 100) + '%';
        if (label) label.textContent = doneCount + ' of ' + GS_TOTAL + ' done';
        // Auto-dismiss if everything done
        if (doneCount >= GS_TOTAL) {
            setTimeout(function () {
                localStorage.setItem(dismissedKey, '1');
                panel.style.display = 'none';
            }, 1200);
        }
    }

    function initGettingStarted() {
        var panel = document.getElementById('db-gs-panel');
        if (!panel) return;

        var cfg         = (global.GAIP_HUB_CONFIG || {});
        var serverSteps = cfg.gettingStartedSteps || {};
        var siteId      = cfg.activeSiteId || 'default';
        var GS_DISMISSED_KEY = 'gilba_gs_dismissed_' + siteId; // per-site

        // Viewer cannot complete any steps — hide panel entirely
        if (cfg.activeSiteRole === 'viewer') return;

        // Show if there is an active site and not yet permanently dismissed
        var shouldShow = !!cfg.activeSiteId &&
                         !localStorage.getItem(GS_DISMISSED_KEY) &&
                         !sessionStorage.getItem(GS_CLOSED_KEY);
        if (!shouldShow) return;

        panel.style.display = 'block';
        gsRenderUI(panel, serverSteps, siteId, GS_DISMISSED_KEY);

        // "Run first analysis" — trigger re-run; page reload will update server state
        var runBtn = document.getElementById('db-gs-run');
        if (runBtn) {
            runBtn.addEventListener('click', function () {
                var rerun = document.getElementById('db-rerun-btn');
                if (rerun) rerun.click();
            });
        }

        // Close — hides for this browser session only
        var closeBtn = document.getElementById('db-gs-close');
        if (closeBtn) {
            closeBtn.addEventListener('click', function () {
                sessionStorage.setItem(GS_CLOSED_KEY, '1');
                panel.style.display = 'none';
            });
        }

        // Skip All — permanently dismiss
        var skipBtn = document.getElementById('db-gs-skip-all');
        if (skipBtn) {
            skipBtn.addEventListener('click', function () {
                localStorage.setItem(GS_DISMISSED_KEY, '1');
                panel.style.display = 'none';
            });
        }
    }

    function initSetupBanner() {
        function openWizard() {
            if (!window.GilbaWizard) return;
            var c = global.GAIP_HUB_CONFIG || {};
            var loc = c.savedLocation || {};
            var isSetUp = !!(c.turfSpecies && c.turfMethodology && loc.lat && loc.lon);
            if (!isSetUp) window.GilbaWizard.show();
        }
        var btn = document.getElementById('db-setup-btn');
        if (btn) btn.addEventListener('click', openWizard);
        var gsSetup = document.getElementById('db-gs-setup');
        if (gsSetup) gsSetup.addEventListener('click', openWizard);
    }

    // =========================================================================
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function () { init(); initGettingStarted(); initSetupBanner(); });
    } else {
        init();
        initGettingStarted();
        initSetupBanner();
    }

})(typeof window !== 'undefined' ? window : this);
