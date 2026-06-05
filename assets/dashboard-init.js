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
            body:  'Estimated dew onset time and surface wetness duration for the next 7 days. Dew periods create ideal conditions for fungal infection spread — particularly dollar spot and Pythium. High-risk match windows are highlighted in red.'
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

        // Try exact key first, then any weather cache key
        var raw = localStorage.getItem('gaip_weather_cache_' + locKey);
        if (!raw) {
            for (var i = 0; i < localStorage.length; i++) {
                var k = localStorage.key(i);
                if (k && k.startsWith('gaip_weather_cache_')) {
                    raw = localStorage.getItem(k);
                    break;
                }
            }
        }

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
        if (!m) {
            setText('db-gp-value',     '—');
            setText('db-disease-value','—');
            setText('db-stress-value', '—');
            setText('db-irr-value',    '—');
            return;
        }

        // Growth Potential
        // GP — computed.climate.growth.weighted is the actual key (not growthPotential)
        var _climateGrowth = computed && computed.climate && computed.climate.growth;
        var gpRaw = m.growthPotential != null ? m.growthPotential
                  : (_climateGrowth && _climateGrowth.weighted != null ? _climateGrowth.weighted : null);

        if (gpRaw != null) {
            var gp = gpRaw > 1 ? Math.round(gpRaw) : Math.round(gpRaw * 100);
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

            // GP footer: season type + thermal from computed.climate.growth
            var gpObj = _climateGrowth;
            if (gpObj) {
                var c3 = gpObj.c3 != null ? Math.round(gpObj.c3 > 1 ? gpObj.c3 : gpObj.c3 * 100) : null;
                var c4 = gpObj.c4 != null ? Math.round(gpObj.c4 > 1 ? gpObj.c4 : gpObj.c4 * 100) : null;
                var c3f = gpObj.c3Fraction != null ? gpObj.c3Fraction : (gpObj.c3Frac != null ? gpObj.c3Frac : 1);
                var c4f = gpObj.c4Fraction != null ? gpObj.c4Fraction : (gpObj.c4Frac != null ? gpObj.c4Frac : 0);
                var isWarm = c4f > c3f;
                var thermalVal = isWarm ? c4 : c3;
                var seasonLabel = isWarm ? 'Warm-Season' : 'Cool-Season';
                var gpFooterStr = thermalVal != null
                    ? seasonLabel + ' · Current GP ' + thermalVal + '%'
                    : seasonLabel;
                setText('db-gp-footer', gpFooterStr);
            } else if (m.soilTemp != null) {
                setText('db-gp-footer', 'Soil ' + Math.round(m.soilTemp) + '°C');
            }
        }

        // Disease Risk
        // Use max(current, forecast) for severity — same logic as Hub daily-dashboard.js v1.8.0
        // Thresholds match disease-engine-pure.js: <50=Low, 50-70=Moderate, 70-85=High, >=85=Severe
        if (m.diseaseRisk != null) {
            var risk    = m.diseaseRisk > 1 ? Math.round(m.diseaseRisk) : Math.round(m.diseaseRisk * 100);
            var peak    = m.forecastPeak != null ? (m.forecastPeak > 1 ? Math.round(m.forecastPeak) : Math.round(m.forecastPeak * 100)) : null;
            var peakDay = m.peakDay;

            // Worst-case display risk (forecast may be worse than today)
            var displayRisk = (peak != null && peak > risk + 5) ? peak : risk;

            var level, cls;
            if (displayRisk >= 85)      { level = 'SEVERE';   cls = 'critical'; }
            else if (displayRisk >= 70) { level = 'HIGH';     cls = 'critical'; }
            else if (displayRisk >= 50) { level = 'MEDIUM';   cls = 'warning';  }
            else                        { level = 'LOW';      cls = '';         }

            var dEl = el('db-disease-value');
            if (dEl) { dEl.textContent = level; dEl.className = 'db-vital-main' + (cls ? ' ' + cls : ''); }
            setText('db-disease-today', risk + '% today');

            // Show "Forecast Peak" label when forecast is driving the severity
            var fcLabelEl = el('db-disease-fc-label');
            if (fcLabelEl) {
                fcLabelEl.style.display = (peak != null && peak > risk + 5) ? '' : 'none';
            }

            // Disease progress bar — shows current risk (not displayRisk)
            var dBar = el('db-disease-bar');
            if (dBar) {
                dBar.style.width = Math.min(risk, 100) + '%';
                dBar.style.background = risk >= 70 ? '#dc2626' : (risk >= 50 ? '#d97706' : '#16a34a');
            }

            // Forecast alert: "△ 69% in 1 day" format
            var alertEl = el('db-disease-alert');
            if (alertEl) {
                if (peak != null && peakDay != null && peakDay > 0) {
                    var dayLabel = peakDay === 1 ? 'in 1 day' : 'in ' + peakDay + ' days';
                    alertEl.textContent = '△ ' + peak + '% ' + dayLabel;
                    alertEl.style.display = '';
                } else if (peak != null && peakDay === 0 && peak > risk + 5) {
                    alertEl.textContent = '△ ' + peak + '% today';
                    alertEl.style.display = '';
                } else {
                    alertEl.style.display = 'none';
                }
            }

            // Disease name with colored dot
            var nameRowEl = el('db-disease-name-row');
            var nameDotEl = el('db-disease-name-dot');
            if (m.topDisease && nameRowEl) {
                setText('db-disease-name', m.topDisease);
                if (nameDotEl) nameDotEl.style.color = cls === 'critical' ? '#dc2626' : (cls === 'warning' ? '#d97706' : '#16a34a');
                nameRowEl.style.display = '';
            } else if (nameRowEl) {
                nameRowEl.style.display = 'none';
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
                var factorLabels = { thermal:'Heat', moisture:'Moisture', light:'Light', traffic:'Traffic', nutrition:'Nutrition', biotic:'Disease' };
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
        var level   = risk >= 50 ? 'HIGH' : (risk >= 25 ? 'MEDIUM' : 'LOW');
        var cls     = risk >= 50 ? 'critical' : (risk >= 25 ? 'warning' : 'ok');

        var txt = disease + ' risk ' + level;
        if (peak != null && m.peakDay != null) {
            txt += ' — forecast ' + peak + '% in ' + m.peakDay + ' day' + (m.peakDay !== 1 ? 's' : '');
        }
        setText('db-verdict-text', txt);
        if (bar) { bar.className = 'db-verdict ' + cls; bar.style.display = ''; }
    }

    // =========================================================================
    // CONTEXT PILLS — species / region from site config
    // =========================================================================

    function populatePills(siteId) {
        var configs = safeJson(_ls.getItem('gilba_hub_site_configs'));
        if (!configs || !siteId) return;
        var cfg = configs[siteId];
        if (!cfg) return;
        var species = (cfg.turf && cfg.turf.species) ? cfg.turf.species : null;
        var region  = (cfg.location && (cfg.location.region || cfg.location.name)) ? (cfg.location.region || cfg.location.name) : null;
        if (species) setText('db-pill-species', species);
        if (region)  setText('db-pill-region',  region);
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
        // Try richer data from computed.disease
        if (dr && dr.diseases && dr.diseases.length) {
            var top = dr.diseases[0];
            topName = topName || top.displayName || top.name || top.disease;
            if (!risk && (top.adjustedRisk || top.riskScore)) {
                risk = Math.round(top.adjustedRisk || top.riskScore);
            }
        }
        if (topName && risk > 0) {
            var peakStr = '';
            if (m && m.forecastPeak != null && m.peakDay != null) {
                var peak = m.forecastPeak > 1 ? Math.round(m.forecastPeak) : Math.round(m.forecastPeak * 100);
                peakStr = ' · forecast ' + peak + '% in ' + m.peakDay + 'd';
            }
            if (risk >= 50) {
                today.push(aqCard({
                    chips: [{ type: 'disease', label: 'Disease › ' + topName }],
                    title: 'Apply fungicide today',
                    reason: 'Risk ' + risk + '% (threshold 20%)' + peakStr,
                    commitLabel: 'Commit — spray today',
                    consequence: peakStr ? 'Risk rising — act before window closes' : null
                }));
            } else if (risk >= 25) {
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
        var pgr = computed && computed.pgr;
        if (pgr && pgr.status && pgr.status !== 'No application') {
            var gdd = pgr.gdd || {};
            var pct = gdd.accumulated && gdd.threshold
                ? Math.round((gdd.accumulated / gdd.threshold) * 100) : null;
            var product = (pgr.product && typeof pgr.product === 'object'
                ? pgr.product.name : pgr.product) || 'PGR';
            var reapp = (pgr.effect && pgr.effect.reapplicationStatus) || '';
            if (reapp === 'expired' || pct >= 100) {
                today.push(aqCard({
                    chips: [{ type: 'pgr', label: 'PGR' }],
                    title: product + ' has expired — reapply',
                    reason: pct ? gdd.accumulated + ' / ' + gdd.threshold + ' GDD (' + pct + '%)' : '',
                    commitLabel: 'Commit — apply today'
                }));
            } else if (pct != null && pct >= 80) {
                week.push(aqCard({
                    chips: [{ type: 'pgr', label: 'PGR' }],
                    title: product + ' reapplication due (' + pct + '% of interval)',
                    reason: gdd.accumulated + ' / ' + gdd.threshold + ' GDD',
                    commitLabel: 'Commit — schedule reapplication',
                    btnCls: 'amber'
                }));
            } else if (pct != null) {
                watching.push(aqCard({
                    title: product + ' · ' + pct + '% of interval',
                    reason: gdd.accumulated + ' / ' + gdd.threshold + ' GDD',
                    commitLabel: 'Commit to watching',
                    btnCls: 'grey'
                }));
            }
        }

        // ── Irrigation ───────────────────────────────────────────
        var irr = (computed && computed.irrigation) || null;
        var irrNeed = (m && m.irrigationNeed != null) ? Math.round(m.irrigationNeed) : null;
        if (irr && irr.weeklyNeed != null) irrNeed = Math.round(irr.weeklyNeed);
        if (irrNeed != null) {
            if (irrNeed > 15) {
                week.push(aqCard({
                    chips: [{ type: 'estimate', label: 'Irrigation' }],
                    title: 'Schedule irrigation — ' + irrNeed + 'mm this week',
                    reason: 'Weekly requirement',
                    commitLabel: 'Commit — schedule',
                    btnCls: 'amber'
                }));
            } else {
                watching.push(aqCard({
                    title: 'Irrigation — ' + irrNeed + 'mm weekly requirement',
                    reason: 'On track',
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
        var warnings = grid.querySelectorAll('.db-source-dot.warning').length;
        var ok = 6 - warnings;

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
        if (scoreEl)    scoreEl.textContent    = ok + '/6 sources';
        if (fillEl)     fillEl.style.width     = Math.round(ok / 6 * 100) + '%';
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

        // Thresholds (defaults; ideally pulled from site config)
        var wp     = 10;   // wilting point
        var trig   = 12;   // irrigation trigger
        var optHi  = 15;
        var maxVal = 40;   // bar scale

        // Update VWC card value
        var valEl = document.getElementById('db-vwc-value');
        if (valEl) {
            valEl.textContent = vwc + '%';
            var cls = vwc < wp ? 'critical' : (vwc <= optHi ? 'ok' : 'warning');
            valEl.className = 'db-vital-main ' + cls;
        }

        // Position needle on zone bar
        var needleEl = document.getElementById('db-vwc-fill');
        if (needleEl) {
            var pct = Math.min(vwc / maxVal * 100, 100);
            needleEl.style.left = pct.toFixed(1) + '%';
            needleEl.style.display = '';
        }

        // Update footer message
        var msgEl = document.getElementById('db-vwc-msg');
        if (msgEl) {
            var nSensors = readings.length;
            var badge = ' <span style="font-size:10px;color:var(--gaip-text-muted)">· ' + nSensors + ' sensor' + (nSensors !== 1 ? 's' : '') + ' live</span>';
            if (vwc < wp) {
                msgEl.innerHTML = '<span style="color:#dc2626">Below wilting point — irrigate now</span>' + badge;
            } else if (vwc < trig) {
                var buf = (vwc - wp).toFixed(1);
                msgEl.innerHTML = buf + '% buffer before trigger' + badge;
            } else if (vwc <= optHi) {
                msgEl.innerHTML = 'Within target zone' + badge;
            } else {
                msgEl.innerHTML = 'Above target — monitor drainage' + badge;
            }
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

    function populateSensorSource() {
        var sensorData = safeJson(_ls.getItem('gilba_sensor_last_fetch'));
        var dotEl  = document.querySelector('[data-source="sensors"] .db-source-dot');
        var textEl = document.getElementById('db-sensor-status');

        if (sensorData && sensorData.fetchedAt) {
            var mins  = Math.round((Date.now() - new Date(sensorData.fetchedAt).getTime()) / 60000);
            var label = mins < 60 ? mins + 'm ago' : Math.round(mins / 60) + 'h ago';
            if (dotEl)  dotEl.className  = 'db-source-dot ok';
            if (textEl) { textEl.className = 'db-source-status-text ok'; textEl.textContent = label; }
            // Update provider name if available
            var provEl = document.getElementById('db-sensor-provider');
            if (provEl && sensorData.provider) provEl.textContent = sensorData.provider;
        } else {
            // No sensor data in localStorage — mark as not connected
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

        body.innerHTML = html ||
            '<p style="color:var(--gaip-text-muted,#6b8878);font-size:13px;padding:8px 0">No data available — run analysis in Hub first.</p>';
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

        // 8-day average (matches old hub: days 0–7 of forecast)
        var avgGP = null;
        var dailyArr = gpObj && Array.isArray(gpObj.dailyGrowthPotential) ? gpObj.dailyGrowthPotential : null;
        if (dailyArr && dailyArr.length > 0) {
            var eightDay = dailyArr.slice(0, 8);
            avgGP = Math.round(eightDay.reduce(function (a, b) { return a + b; }, 0) / eightDay.length);
        } else {
            var avgRaw = m && m.growthPotential != null ? m.growthPotential
                       : (gpObj && gpObj.weighted != null ? gpObj.weighted : null);
            if (avgRaw != null) avgGP = avgRaw > 1 ? Math.round(avgRaw) : Math.round(avgRaw * 100);
        }

        // Today's GP
        var c3f     = gpObj ? (gpObj.c3Fraction != null ? gpObj.c3Fraction : (gpObj.c3Frac || 1)) : 1;
        var c4f     = gpObj ? (gpObj.c4Fraction != null ? gpObj.c4Fraction : (gpObj.c4Frac || 0)) : 0;
        var isWarm  = c4f > c3f;
        var todayRaw = gpObj ? (isWarm ? gpObj.c4 : gpObj.c3) : null;
        if (todayRaw == null && gpObj) todayRaw = gpObj.weighted;
        var todayGP  = todayRaw != null ? (todayRaw > 1 ? Math.round(todayRaw) : Math.round(todayRaw * 100)) : null;
        var todayCls = todayGP != null ? (todayGP >= 70 ? 'ok' : (todayGP >= 40 ? 'warning' : 'critical')) : '';

        // Species info
        var cfg         = global.GAIP_HUB_CONFIG || {};
        var speciesName = cfg.turfSpecies ? cfg.turfSpecies : null;
        var seasonTag   = isWarm ? 'C4 warm-season grass' : 'C3 cool-season grass';

        // Temperature — prefer weather widget cache (current.temperature_2m)
        var todayTemp = (function() {
            try {
                for (var i = 0; i < localStorage.length; i++) {
                    var k = localStorage.key(i);
                    if (k && k.startsWith('gaip_weather_cache_')) {
                        var entry = safeJson(localStorage.getItem(k));
                        var cur = entry && entry.data && (entry.data.current || entry.data.current_weather);
                        if (cur) return cur.temperature_2m !== undefined ? cur.temperature_2m : cur.temperature;
                    }
                }
            } catch (e) {}
            return climate && climate.temperature ? climate.temperature.todayMean : null;
        })();
        var tempStr = todayTemp != null ? todayTemp.toFixed(1) + '°C' : null;
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
        var etVal  = m && m.et       != null ? m.et       : (climate && climate.et       != null ? climate.et       : null);
        var stVal  = m && m.soilTemp != null ? m.soilTemp : (climate && climate.soilTemp != null ? climate.soilTemp : null);

        var avgCls = avgGP != null ? (avgGP >= 70 ? 'ok' : (avgGP >= 40 ? 'warning' : 'critical')) : '';
        var html = '';

        // Species badge
        if (speciesName) {
            html += '<div style="font-size:12px;color:var(--gaip-text-muted,#6b8878);margin-bottom:14px;padding:8px 12px;background:var(--gaip-surface-muted,#f5f7f6);border-radius:6px;border:1px solid var(--gaip-border,#d8e0dc)">' +
                '<strong style="color:var(--gaip-text,#1a2b23)">' + speciesName + '</strong>' +
                ' &middot; ' + seasonTag +
                '</div>';
        }

        // Hero: 16-day average (matches dashboard card)
        html += panelHero(avgGP != null ? avgGP + '%' : '—', avgCls, '8-Day Average Growth Potential');

        // Current GP + insight
        if (todayGP != null || insightText) {
            var insightColor = todayCls === 'ok' ? '#14532d' : (todayCls === 'warning' ? '#78350f' : '#7f1d1d');
            var insightBg    = todayCls === 'ok' ? '#f0fdf4' : (todayCls === 'warning' ? '#fffbeb' : '#fef2f2');
            var currentRow = todayGP != null
                ? '<div style="display:flex;align-items:baseline;gap:8px;margin-bottom:6px"><span style="font-size:22px;font-weight:700;color:var(--gaip-text,#1a2b23)">' + todayGP + '%</span><span style="font-size:12px;color:var(--gaip-text-muted,#6b8878)">today</span></div>'
                : '';
            var tempPrefix = tempStr ? '<strong>' + tempStr + ' air</strong>' : '';
            var soilPrefix = stVal != null ? '<strong>' + Math.round(stVal) + '°C soil</strong>' : '';
            var prefixStr  = [tempPrefix, soilPrefix].filter(Boolean).join(' &middot; ');
            var insightRow = insightText
                ? '<div style="padding:8px 10px;border-radius:6px;background:' + insightBg + ';font-size:12px;color:' + insightColor + ';line-height:1.5">' +
                  (prefixStr ? prefixStr + ' &mdash; ' : '') + insightText + '</div>'
                : '';
            html += panelSection('Current Conditions', currentRow + insightRow);
        }

        // ET₀, Soil Temp
        if (avgGP != null) {
            html += panelSection('Climate', statGrid([
                { value: etVal  != null ? etVal.toFixed(1) + ' mm'  : '—', label: 'ET₀ daily' },
                { value: stVal  != null ? Math.round(stVal) + '°C'  : '—', label: 'Soil Temp' }
            ]));
        }

        // Link to full analysis
        html += '<div style="margin-top:16px;padding-top:14px;border-top:1px solid var(--gaip-border,#d8e0dc)">' +
            '<a href="/analysis/growth-light" style="display:inline-flex;align-items:center;gap:6px;font-size:13px;font-weight:600;color:var(--gaip-brand,#236b4a);text-decoration:none">' +
            'View full Growth &amp; Light analysis' +
            '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>' +
            '</a></div>';

        return html;
    }

    /* ── Disease Risk ── */
    function buildDiseasePanel(m, c) {
        var diseases    = c && c.disease && c.disease.diseases ? c.disease.diseases : null;
        var risk        = m && m.diseaseRisk  != null ? (m.diseaseRisk  > 1 ? Math.round(m.diseaseRisk)  : Math.round(m.diseaseRisk  * 100)) : 0;
        var peak        = m && m.forecastPeak != null ? (m.forecastPeak > 1 ? Math.round(m.forecastPeak) : Math.round(m.forecastPeak * 100)) : null;
        var displayRisk = (peak != null && peak > risk + 5) ? peak : risk;
        var level, cls;
        if      (displayRisk >= 85) { level = 'SEVERE'; cls = 'critical'; }
        else if (displayRisk >= 70) { level = 'HIGH';   cls = 'critical'; }
        else if (displayRisk >= 50) { level = 'MEDIUM'; cls = 'warning';  }
        else                        { level = 'LOW';    cls = 'ok';       }

        var html = panelHero(level, cls, displayRisk + '% overall risk');

        var makeRow = function (name, cur, pk, pd) {
            var pct  = cur || 0;
            var col  = pct >= 70 ? '#dc2626' : (pct >= 50 ? '#d97706' : '#16a34a');
            var sub  = pk != null && pd != null && pd > 0
                ? 'Peak ' + pk + '% in ' + pd + ' day' + (pd !== 1 ? 's' : '')
                : (pk != null ? 'Peak ' + pk + '%' : '');
            return '<div class="db-disease-row">' +
                '<div class="db-disease-row-head">' +
                '<span class="db-disease-row-name">' + name + '</span>' +
                (cur != null ? '<span class="db-disease-row-pct" style="color:' + col + '">' + cur + '%</span>' : '') +
                '</div>' +
                '<div class="db-progress-bar" style="margin:0 0 4px"><div class="db-progress-fill" style="width:' + Math.min(pct,100) + '%;background:' + col + '"></div></div>' +
                (sub ? '<div class="db-disease-row-sub">' + sub + '</div>' : '') +
                '</div>';
        };

        if (diseases && diseases.length) {
            var rows = diseases.slice(0, 5).map(function (d) {
                var name = d.displayName || d.name || d.disease || 'Unknown';
                // adjustedRisk = species-susceptibility-adjusted score (same basis as overallScore)
                // riskScore    = pre-adjustment base; use only as fallback
                var cur  = d.adjustedRisk != null ? Math.round(d.adjustedRisk) : (d.riskScore != null ? Math.round(d.riskScore) : (d.current != null ? Math.round(d.current) : null));
                var pk   = d.peakRisk     != null ? Math.round(d.peakRisk)     : null;
                return makeRow(name, cur, pk, d.peakDay != null ? d.peakDay : null);
            }).join('');
            html += panelSection('Disease Breakdown', rows);
        } else if (m && m.topDisease) {
            html += panelSection('Disease Breakdown', makeRow(m.topDisease, risk, peak, m.peakDay || null));
        }

        if (peak != null && m && m.peakDay != null) {
            html += panelSection('Forecast', '<p style="font-size:13px;margin:0;color:var(--gaip-text,#1a2b23)">Peak: <strong>' + peak + '%</strong> in ' + m.peakDay + ' day' + (m.peakDay !== 1 ? 's' : '') + '</p>');
        }
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
            var rows = [
                { key: 'thermal',   label: 'Heat' },
                { key: 'moisture',  label: 'Moisture' },
                { key: 'light',     label: 'Light' },
                { key: 'traffic',   label: 'Traffic' },
                { key: 'nutrition', label: 'Nutrition' },
                { key: 'biotic',    label: 'Disease' }
            ].map(function (f) {
                var val = Math.abs(comps[f.key] || 0);
                return factorRow(f.label, val, barColor(val));
            }).join('');
            html += panelSection('Stress Components', rows);
        }

        var summary = traj && traj.summary;
        if (summary) {
            html += panelSection('Summary', '<p style="font-size:13px;margin:0;line-height:1.5;color:var(--gaip-text,#1a2b23)">' + summary + '</p>');
        }
        return html;
    }

    /* ── VWC ── */
    function buildVWCPanel(m) {
        var vwcRaw = m && m.vwc != null ? m.vwc : null;
        var vwc    = vwcRaw != null ? Math.round(vwcRaw) : 13;
        var wp = 8, trig = 12, optLow = 12, optHigh = 15, fc = 35, maxVal = 40;
        var fillPct = Math.min(vwc / maxVal * 100, 100);
        var zoneLo  = optLow  / maxVal * 100;
        var zoneWid = (optHigh - optLow) / maxVal * 100;
        var vcCls   = vwc < trig ? 'critical' : (vwc <= optHigh ? 'ok' : 'warning');

        var html = panelHero(vwc + '%', vcCls, 'Volumetric Water Content');

        var barFillColor = vcCls === 'critical' ? '#dc2626' : (vcCls === 'warning' ? '#d97706' : '#2da85e');
        var bar = '<div style="position:relative;height:16px;background:var(--gaip-surface-muted,#eef2f0);border-radius:8px;overflow:hidden;margin:8px 0 4px">' +
            '<div style="position:absolute;left:' + zoneLo + '%;width:' + zoneWid + '%;top:0;height:100%;background:rgba(45,168,94,0.2);border-left:2px solid rgba(45,168,94,0.6);border-right:2px solid rgba(45,168,94,0.6)"></div>' +
            '<div style="position:absolute;left:0;top:0;height:100%;width:' + fillPct + '%;background:' + barFillColor + ';border-radius:8px"></div>' +
            '</div>' +
            '<div style="display:flex;justify-content:space-between;font-size:10px;color:var(--gaip-text-muted,#6b8878)">' +
            '<span>WP ' + wp + '%</span><span>Trigger ' + trig + '%</span><span>Target ' + optLow + '–' + optHigh + '%</span><span>FC ' + fc + '%</span>' +
            '</div>';
        html += panelSection('Soil Water Level', bar);

        var statusMsg = vwc < wp      ? 'Critical: below wilting point — irrigate immediately'
                      : vwc < trig    ? 'Low: approaching irrigation trigger'
                      : vwc <= optHigh ? 'Optimal: within target zone'
                      :                  'Saturated: above field capacity';
        var statusCol = vwc < wp ? '#dc2626' : (vwc < trig ? '#d97706' : (vwc <= optHigh ? '#16a34a' : '#d97706'));
        html += panelSection('Status', '<p style="font-size:13px;margin:0;color:' + statusCol + ';font-weight:600">' + statusMsg + '</p>');

        html += panelSection('How to read', '<p style="font-size:12px;margin:0;line-height:1.55;color:var(--gaip-text,#1a2b23)">Green zone (12–15%) is the optimal range. Below trigger (12%) activates irrigation schedule. Above field capacity (35%) risks compaction and anaerobic conditions.</p>');
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
        populateSensorSource();
        initInfoPopovers();
        initCardPanels(metrics, computed);

        // Weather
        var loc = config.savedLocation;
        if (loc && loc.lat && loc.lon) {
            populateWeather(loc.lat, loc.lon);
        }
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
