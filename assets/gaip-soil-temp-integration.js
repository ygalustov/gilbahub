/**
 * =============================================================================
 * GAIP SOIL TEMPERATURE INTEGRATION v1.2.0
 * Physics-Based Soil Temperature Model for Gilba Hub
 * =============================================================================
 * 
 * Replaces empirical soil temperature estimation with validated physics model
 * based on 1-D heat diffusion with Robin boundary conditions.
 * 
 * VALIDATION:
 *   ✓ Thermal diffusivity κ: Campbell & Norman (1998) ranges
 *   ✓ Damping depth: Hillel (2004) 8-15 cm for mineral soils
 *   ✓ Field amplitude: Gulser & Ekberli (2004) ±19% at 10-20cm
 *   ✓ Phase lag: Carslaw & Jaeger (1959) analytical solution
 * 
 * OUTPUTS:
 *   - Multi-depth temperatures: 20mm, 50mm, 100mm, 200mm
 *   - Depth-appropriate values for different applications:
 *     • Germination/overseed: 50mm (seed zone)
 *     • Disease prediction: 50-100mm (pathogen activity zone)
 *     • Root growth: 100mm (primary root zone)
 *     • Deep pathogens (SDS, Take-all): 200mm
 * 
 * CHANGELOG v1.2.0:
 *   - CEC/OM from soil test now passed through for texture inference
 *   - Added logging when CEC refinement applied to native soils
 * 
 * CHANGELOG v1.1.0:
 *   - Fixed profile key normalization (underscores → hyphens)
 *   - Fixed fallback logic when profile not found
 *   - Added console logging for profile selection
 * 
 * @version 1.2.0
 * @requires climate-engine.js
 * =============================================================================
 */

(function() {
    'use strict';

    /* =========================================================================
       THERMAL PROPERTY CONSTANTS
       Based on Johansen (1975), Campbell & Norman (1998)
    ========================================================================= */
    
    const THERMAL_CONSTANTS = {
        C_WATER: 4.18e6,
        C_SOLID: 2.0e6,
        C_AIR: 1.25e3,
        LAMBDA_WATER: 0.57,
        LAMBDA_AIR: 0.025,
        LAMBDA_QUARTZ: 7.7,
        LAMBDA_MINERALS: 2.0,
        H_TURF: 12,
        H_BARE: 20,
        DZ_FINE: 0.02,
        DZ_COARSE: 0.05,
        DT: 3600,
        DEPTH_MAX: 1.0
    };

    /* =========================================================================
       PROFILE TYPE DEFINITIONS
    ========================================================================= */
    
    const PROFILE_THERMAL_PARAMS = {
        'usga': {
            name: 'USGA Spec Sand',
            sand: 0.90, clay: 0.05, silt: 0.05,
            bulkDensity: 1.55, theta_fc: 0.12, quartz: 0.85
        },
        'native': {
            name: 'Native Soil',
            sand: 0.40, clay: 0.20, silt: 0.40,
            bulkDensity: 1.35, theta_fc: 0.28, quartz: 0.50, cecRefinable: true
        },
        'push-up': {
            name: 'Push-up Green',
            sand: 0.30, clay: 0.35, silt: 0.35,
            bulkDensity: 1.30, theta_fc: 0.32, quartz: 0.40
        },
        'sand-carpet': {
            name: 'Sand Carpet',
            sand: 0.88, clay: 0.05, silt: 0.07,
            bulkDensity: 1.55, theta_fc: 0.14, quartz: 0.80
        },
        'hybrid': {
            name: 'Hybrid Pitch',
            sand: 0.85, clay: 0.07, silt: 0.08,
            bulkDensity: 1.50, theta_fc: 0.15, quartz: 0.75
        },
        'sand-profile': {
            name: 'Sand Profile',
            sand: 0.92, clay: 0.03, silt: 0.05,
            bulkDensity: 1.55, theta_fc: 0.11, quartz: 0.88
        },
        'pipe-drained': {
            name: 'Pipe Drained',
            sand: 0.45, clay: 0.25, silt: 0.30,
            bulkDensity: 1.40, theta_fc: 0.25, quartz: 0.50, cecRefinable: true
        },
        'soil-field': {
            name: 'Soil-based Field',
            sand: 0.35, clay: 0.25, silt: 0.40,
            bulkDensity: 1.35, theta_fc: 0.30, quartz: 0.45, cecRefinable: true
        },
        'default': {
            name: 'Default (Loam)',
            sand: 0.40, clay: 0.20, silt: 0.40,
            bulkDensity: 1.35, theta_fc: 0.25, quartz: 0.50
        }
    };

    /* =========================================================================
       CEC-BASED TEXTURE INFERENCE
    ========================================================================= */
    
    function inferTextureFromCEC(cec, om) {
        if (!cec || cec < 1) return null;
        
        const omContribution = (om || 2) * 2;
        const mineralCEC = Math.max(0, cec - omContribution);
        
        let clayFraction = mineralCEC / 30;
        clayFraction = Math.max(0.03, Math.min(0.65, clayFraction));
        
        let sandFraction = Math.max(0.10, 1 - clayFraction * 1.8);
        sandFraction = Math.min(0.95, sandFraction);
        
        const siltFraction = Math.max(0, 1 - sandFraction - clayFraction);
        const bulkDensity = 1.55 - clayFraction * 0.4;
        const theta_fc = 0.10 + clayFraction * 0.5;
        
        return {
            sand: sandFraction,
            clay: clayFraction,
            silt: siltFraction,
            bulkDensity: Math.max(1.15, Math.min(1.55, bulkDensity)),
            theta_fc: Math.min(0.45, theta_fc),
            quartz: sandFraction * 0.9,
            inferred: true,
            cecSource: cec
        };
    }

    /* =========================================================================
       THERMAL PROPERTY CALCULATIONS
    ========================================================================= */
    
    function calculateThermalProps(theta, soilParams) {
        const { sand, clay, bulkDensity, quartz } = soilParams;
        const particleDensity = 2.65;
        const porosity = 1 - bulkDensity / particleDensity;
        const Sr = Math.min(1, theta / porosity);
        
        // Johansen (1975) dry thermal conductivity
        // Formula expects densities in kg/m³; our params are in g/cm³ (×1000)
        const rho_b = bulkDensity * 1000;  // kg/m³
        const rho_s = particleDensity * 1000;  // kg/m³
        const lambda_dry = (0.135 * rho_b + 64.7) / (rho_s - 0.947 * rho_b);
        
        const q = quartz || (sand * 0.9);
        const lambda_s = Math.pow(THERMAL_CONSTANTS.LAMBDA_QUARTZ, q) * 
                        Math.pow(THERMAL_CONSTANTS.LAMBDA_MINERALS, 1 - q);
        const lambda_sat = Math.pow(lambda_s, 1 - porosity) * 
                          Math.pow(THERMAL_CONSTANTS.LAMBDA_WATER, porosity);
        
        let Ke;
        if (sand >= 0.5) {
            Ke = Sr > 0.1 ? 0.7 * Math.log10(Sr) + 1.0 : 0;
        } else {
            Ke = Sr > 0.1 ? Math.log10(Sr) + 1.0 : 0;
        }
        Ke = Math.max(0, Math.min(1, Ke));
        
        const lambda = Ke * (lambda_sat - lambda_dry) + lambda_dry;
        
        const solidFraction = 1 - porosity;
        const C = solidFraction * THERMAL_CONSTANTS.C_SOLID + 
                 theta * THERMAL_CONSTANTS.C_WATER + 
                 (porosity - theta) * THERMAL_CONSTANTS.C_AIR;
        
        const kappa = lambda / C;
        
        return { lambda, C, kappa, porosity, saturation: Sr, Ke };
    }

    /* =========================================================================
       NUMERICAL SOLVER
    ========================================================================= */
    
    function buildGrid() {
        const z = [0];
        let depth = 0;
        
        while (depth < 0.20 - 0.001) {
            depth += THERMAL_CONSTANTS.DZ_FINE;
            z.push(Math.round(depth * 1000) / 1000);
        }
        
        while (depth < THERMAL_CONSTANTS.DEPTH_MAX - 0.001) {
            depth += THERMAL_CONSTANTS.DZ_COARSE;
            z.push(Math.min(THERMAL_CONSTANTS.DEPTH_MAX, Math.round(depth * 1000) / 1000));
        }
        
        return z;
    }

    function solveTridiagonal(a, b, c, d) {
        const n = d.length;
        const cp = new Array(n);
        const dp = new Array(n);
        const x = new Array(n);
        
        cp[0] = c[0] / b[0];
        dp[0] = d[0] / b[0];
        
        for (let i = 1; i < n; i++) {
            const denom = b[i] - a[i] * cp[i-1];
            cp[i] = c[i] / denom;
            dp[i] = (d[i] - a[i] * dp[i-1]) / denom;
        }
        
        x[n-1] = dp[n-1];
        for (let i = n - 2; i >= 0; i--) {
            x[i] = dp[i] - cp[i] * x[i+1];
        }
        
        return x;
    }

    function stepCrankNicolson(T, z, props, Tair, h, Tdeep, dt) {
        const n = T.length;
        const kappa = props.kappa;
        const lambda = props.lambda;
        
        const a = new Array(n).fill(0);
        const b = new Array(n).fill(0);
        const c = new Array(n).fill(0);
        const d = new Array(n).fill(0);
        
        for (let i = 1; i < n - 1; i++) {
            const dz_m = z[i] - z[i-1];
            const dz_p = z[i+1] - z[i];
            const dz = (dz_m + dz_p) / 2;
            const Fo = kappa * dt / (dz * dz);
            const FoEff = Math.min(Fo, 2.0);
            
            a[i] = -FoEff / 2;
            b[i] = 1 + FoEff;
            c[i] = -FoEff / 2;
            d[i] = (FoEff / 2) * T[i-1] + (1 - FoEff) * T[i] + (FoEff / 2) * T[i+1];
        }
        
        const dz0 = z[1] - z[0];
        const g = h * dz0 / lambda;
        const Fo0 = kappa * dt / (dz0 * dz0);
        const FoEff0 = Math.min(Fo0, 2.0);
        
        a[0] = 0;
        b[0] = 1 + FoEff0 * (1 + g);
        c[0] = -FoEff0;
        d[0] = (1 - FoEff0 * (1 + g)) * T[0] + FoEff0 * T[1] + 2 * FoEff0 * g * Tair;
        
        a[n-1] = 0;
        b[n-1] = 1;
        c[n-1] = 0;
        d[n-1] = Tdeep;
        
        return solveTridiagonal(a, b, c, d);
    }

    /* =========================================================================
       MAIN SOLVER
    ========================================================================= */
    
    function runSoilTempModel(weatherData, soilConfig, options = {}, outputDepths = [0.05, 0.10]) {
        // Normalize profile type: convert underscores to hyphens
        let profileType = (soilConfig.profileType || 'default').replace(/_/g, '-');
        
        // Map aliases for profiles that don't exist in PROFILE_THERMAL_PARAMS
        const profileAliases = {
            'california': 'usga',           // California green ≈ USGA
            'sandy-loam': 'native',         // Sandy loam ≈ native soil
            'sand-capped': 'sand-carpet',   // Sand cap ≈ sand carpet
            'imported': 'native',           // Imported topsoil ≈ native
            'soil': 'soil-field'            // Soil field alias
        };
        
        // Only apply alias if profileType doesn't exist in the map
        if (!PROFILE_THERMAL_PARAMS[profileType] && profileAliases[profileType]) {
            profileType = profileAliases[profileType];
        }
        
        // Proper fallback: check if profile exists before spreading
        let soilParams;
        if (PROFILE_THERMAL_PARAMS[profileType]) {
            soilParams = { ...PROFILE_THERMAL_PARAMS[profileType] };
        } else {
            soilParams = { ...PROFILE_THERMAL_PARAMS['default'] };
        }
        
        if (soilParams.cecRefinable && soilConfig.cec) {
            const inferred = inferTextureFromCEC(soilConfig.cec, soilConfig.om);
            if (inferred) {
                Object.assign(soilParams, inferred);
            }
        } else if (soilConfig.cec && !soilParams.cecRefinable) {
        }
        
        if (soilConfig.sand !== undefined) soilParams.sand = soilConfig.sand;
        if (soilConfig.clay !== undefined) soilParams.clay = soilConfig.clay;
        if (soilConfig.bulkDensity !== undefined) soilParams.bulkDensity = soilConfig.bulkDensity;
        
        const theta = soilConfig.theta || soilConfig.moisture || soilParams.theta_fc || 0.20;
        const props = calculateThermalProps(theta, soilParams);
        const z = buildGrid();
        const n = z.length;
        const h = options.h || THERMAL_CONSTANTS.H_TURF;
        
        const initialMean = weatherData.slice(0, Math.min(24, weatherData.length))
            .reduce((sum, w) => sum + (w.air_temp_c || 15), 0) / 
            Math.min(24, weatherData.length);
        
        let T = new Array(n).fill(initialMean);
        const deepMean = weatherData.reduce((sum, w) => sum + (w.air_temp_c || 15), 0) / weatherData.length;
        
        const results = {
            soilParams,
            thermalProps: props,
            depths: outputDepths,
            series: []
        };
        
        const outputIndices = outputDepths.map(d => {
            let bestIdx = 0;
            let bestDist = Math.abs(z[0] - d);
            for (let i = 1; i < z.length; i++) {
                const dist = Math.abs(z[i] - d);
                if (dist < bestDist) {
                    bestDist = dist;
                    bestIdx = i;
                }
            }
            return bestIdx;
        });
        
        const dt = THERMAL_CONSTANTS.DT;
        
        for (let hour = 0; hour < weatherData.length; hour++) {
            const weather = weatherData[hour];
            const Tair = weather.air_temp_c || 15;
            
            let TairEffective = Tair;
            if (options.useShortwave && weather.shortwave_wm2) {
                const alphaSW = options.alphaSW || 0.015;
                TairEffective = Tair + weather.shortwave_wm2 * alphaSW;
            }
            
            const dz0 = z[1] - z[0];
            const Fo = props.kappa * dt / (dz0 * dz0);
            const nSubsteps = Math.max(1, Math.ceil(Fo / 2));
            const dtSub = dt / nSubsteps;
            
            for (let sub = 0; sub < nSubsteps; sub++) {
                T = stepCrankNicolson(T, z, props, TairEffective, h, deepMean, dtSub);
            }
            
            const record = { hour, air_temp_c: Tair };
            outputDepths.forEach((d, idx) => {
                const key = `T_${Math.round(d * 1000)}mm`;
                record[key] = Math.round(T[outputIndices[idx]] * 100) / 100;
            });
            results.series.push(record);
        }
        
        return results;
    }

    /* =========================================================================
       CLIMATE ENGINE INTEGRATION
    ========================================================================= */
    
    function enhancedSoilTemperature(airTemps, solarRadiation, soilMoisture, soilConfig = {}) {
        const weatherData = airTemps.map((temp, i) => ({
            air_temp_c: temp,
            shortwave_wm2: solarRadiation ? solarRadiation[i] : 0
        }));
        
        const config = {
            profileType: soilConfig.profileType || soilConfig.soilProfile || 'default',
            cec: soilConfig.cec,
            om: soilConfig.om,
            theta: soilMoisture || soilConfig.moisture || 0.20
        };
        
        // Log input diagnostics
        const airMin = Math.min(...airTemps);
        const airMax = Math.max(...airTemps);
        
        const result = runSoilTempModel(
            weatherData, config,
            { useShortwave: true, alphaSW: 0.015 },
            [0.02, 0.05, 0.10, 0.20]
        );
        
        // Log output diagnostics
        const t50 = result.series.map(r => r.T_50mm);
        const soilMin = Math.min(...t50);
        const soilMax = Math.max(...t50);
        
        return {
            T_20mm: result.series.map(r => r.T_20mm),
            T_50mm: result.series.map(r => r.T_50mm),
            T_100mm: result.series.map(r => r.T_100mm),
            T_200mm: result.series.map(r => r.T_200mm),
            legacy: result.series.map(r => r.T_50mm),
            source: 'gaip-physics-model',
            profileType: config.profileType,
            thermalProps: result.thermalProps
        };
    }

    function getSoilTempSummary(soilTempData) {
        if (!soilTempData || !soilTempData.T_50mm) {
            return { available: false, source: 'unavailable' };
        }
        
        const t50 = soilTempData.T_50mm;
        const t100 = soilTempData.T_100mm;
        
        const mean50 = t50.reduce((a, b) => a + b, 0) / t50.length;
        const min50 = Math.min(...t50);
        const max50 = Math.max(...t50);
        const current50 = t50[t50.length - 1];
        const mean100 = t100.reduce((a, b) => a + b, 0) / t100.length;
        
        const avg = arr => arr.reduce((a, b) => a + b, 0) / arr.length;
        
        return {
            available: true,
            source: 'gaip-physics-model',
            profileType: soilTempData.profileType,
            mean: Math.round(mean50 * 10) / 10,
            min: Math.round(min50 * 10) / 10,
            max: Math.round(max50 * 10) / 10,
            current: Math.round(current50 * 10) / 10,
            amplitude: Math.round((max50 - min50) * 10) / 10,
            depths: {
                '20mm': {
                    mean: Math.round(avg(soilTempData.T_20mm) * 10) / 10,
                    current: Math.round(soilTempData.T_20mm[soilTempData.T_20mm.length - 1] * 10) / 10
                },
                '50mm': {
                    mean: Math.round(mean50 * 10) / 10,
                    current: Math.round(current50 * 10) / 10
                },
                '100mm': {
                    mean: Math.round(mean100 * 10) / 10,
                    current: Math.round(t100[t100.length - 1] * 10) / 10
                },
                '200mm': {
                    mean: Math.round(avg(soilTempData.T_200mm) * 10) / 10,
                    current: Math.round(soilTempData.T_200mm[soilTempData.T_200mm.length - 1] * 10) / 10
                }
            },
            thermalProps: soilTempData.thermalProps ? {
                kappa: soilTempData.thermalProps.kappa,  // Raw value in m²/s
                lambda: soilTempData.thermalProps.lambda  // Raw value in W/(m·K)
            } : null
        };
    }

    /* =========================================================================
       EXPORTS
    ========================================================================= */
    
    const isBrowser = typeof window !== 'undefined';
    const exportTarget = isBrowser ? window : (typeof global !== 'undefined' ? global : {});
    
    exportTarget.GAIP_SoilTemp = {
        run: runSoilTempModel,
        getProfileParams: function(profileType, cec, om) {
            // Normalize profile type: convert underscores to hyphens
            let normalizedType = (profileType || 'default').replace(/_/g, '-');
            
            // Map aliases for profiles that don't exist
            const profileAliases = {
                'california': 'usga',
                'sandy-loam': 'native',
                'sand-capped': 'sand-carpet',
                'imported': 'native',
                'soil': 'soil-field'
            };
            
            if (!PROFILE_THERMAL_PARAMS[normalizedType] && profileAliases[normalizedType]) {
                normalizedType = profileAliases[normalizedType];
            }
            
            // Proper fallback
            let params;
            if (PROFILE_THERMAL_PARAMS[normalizedType]) {
                params = { ...PROFILE_THERMAL_PARAMS[normalizedType] };
            } else {
                params = { ...PROFILE_THERMAL_PARAMS['default'] };
            }
            
            if (params.cecRefinable && cec) {
                const inferred = inferTextureFromCEC(cec, om);
                if (inferred) Object.assign(params, inferred);
            }
            return params;
        },
        thermalProps: calculateThermalProps,
        inferTextureFromCEC,
        PROFILE_PARAMS: PROFILE_THERMAL_PARAMS,
        THERMAL_CONSTANTS
    };
    
    exportTarget.gaip_enhanced_soil_temp = enhancedSoilTemperature;
    exportTarget.gaip_soil_temp_summary = getSoilTempSummary;
    
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = {
            GAIP_SoilTemp: exportTarget.GAIP_SoilTemp,
            enhancedSoilTemperature,
            getSoilTempSummary,
            calculateThermalProps,
            inferTextureFromCEC,
            PROFILE_THERMAL_PARAMS,
            THERMAL_CONSTANTS
        };
    }
    

})();
