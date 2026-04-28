<?php
/**
 * Supplemental Light Module
 * 
 * Main module that orchestrates all components.
 * 
 * v2.0 — EUE integration (Environmental Utilisation Efficiency).
 *   Prescriptions now account for environmental limiting factors
 *   via Gssh_EUE_Calculator. Output includes venue readiness,
 *   effective (EUE-adjusted) hours, and environmental advisory.
 */

if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

class Gssh_Supplemental_Light_Module {
    
    private $shade_engine;
    private $climate_module;
    private $stress_trajectory_engine;
    private $disease_engine;
    private $traffic_engine;
    private $variety_database;
    
    private $dli_estimator;
    private $gap_calculator;
    private $eue_calculator;
    
    /**
     * Constructor
     */
    public function __construct(
        $shade_engine,
        $climate_module,
        $stress_trajectory_engine,
        $disease_engine,
        $traffic_engine,
        $variety_database
    ) {
        $this->shade_engine = $shade_engine;
        $this->climate_module = $climate_module;
        $this->stress_trajectory_engine = $stress_trajectory_engine;
        $this->disease_engine = $disease_engine;
        $this->traffic_engine = $traffic_engine;
        $this->variety_database = $variety_database;
        
        $this->dli_estimator = new Gssh_Ambient_DLI_Estimator( $this->climate_module );
        $this->gap_calculator = new Gssh_DLI_Gap_Calculator(
            $this->variety_database,
            $this->shade_engine,
            $this->stress_trajectory_engine
        );
        $this->eue_calculator = new Gssh_EUE_Calculator();
    }
    
    /**
     * Analyse venue
     * 
     * @param string $venue_id
     * @param array  $venue_config
     * @param string $date
     * @param int    $stop_at Step to stop at (0 = run all)
     * @return array Complete analysis
     */
    public function analyse_venue( $venue_id, $venue_config, $date = null, $stop_at = 0 ) {
        $date = $date ? $date : date( 'Y-m-d' );
        
        // Step 1: Get ambient DLI
        $location = isset( $venue_config['location'] ) ? $venue_config['location'] : array();
        $ambient_dli_data = $this->dli_estimator->get_daily_dli( $date, $location );
        if ( $stop_at === 1 ) return array( 'step' => 1, 'ambient_dli' => $ambient_dli_data );
        
        // Step 2: Get stress forecasts
        $stress_forecast = $this->get_stress_forecast_for_zones( $venue_config );
        if ( $stop_at === 2 ) return array( 'step' => 2, 'stress_forecast' => $stress_forecast );
        
        // Step 3: Get disease risk
        $disease_risk = $this->get_disease_risk_for_zones( $venue_config, $date );
        if ( $stop_at === 3 ) return array( 'step' => 3, 'disease_risk' => $disease_risk );
        
        // Step 4: Get recovery status
        $recovery_status = $this->get_recovery_status_for_zones( $venue_config );
        if ( $stop_at === 4 ) return array( 'step' => 4, 'recovery_status' => $recovery_status );
        
        // Step 4b: Calculate EUE (Environmental Utilisation Efficiency)
        $venue_environment = $venue_config['venue_environment'] ?? array();
        $eue_result = $this->calculate_venue_eue( $venue_config, $location, $date );
        
        // Step 5: Enrich zone configurations
        $zones = isset( $venue_config['zones'] ) ? $venue_config['zones'] : array();
        $enriched_zones = $this->enrich_zone_configs(
            $zones,
            $stress_forecast,
            $disease_risk,
            $recovery_status,
            $location,
            $date
        );
        if ( $stop_at === 5 ) return array( 'step' => 5, 'enriched_zones' => $enriched_zones );
        
        // Step 6: Calculate deficits (HOC-aware if venue environment provides hoc_mm)
        $dli_value = isset( $ambient_dli_data['dli'] ) ? $ambient_dli_data['dli'] : 30;
        $venue_analysis = $this->gap_calculator->calculate_venue_deficit(
            $enriched_zones,
            $dli_value,
            $eue_result,
            $venue_environment
        );
        if ( $stop_at === 6 ) return array( 'step' => 6, 'venue_analysis' => $venue_analysis );
        
        // Step 7: Generate prescriptions (EUE-adjusted)
        $equipment = isset( $venue_config['equipment'] ) ? $venue_config['equipment'] : array();
        $prescriptions = $this->generate_prescriptions( $venue_analysis, $equipment, $eue_result );
        if ( $stop_at === 7 ) return array( 'step' => 7, 'prescriptions' => $prescriptions );
        
        // Step 8: Generate schedule
        $schedule_optimiser = new Gssh_Schedule_Optimiser( $venue_config, $this->gap_calculator );
        $schedule = $schedule_optimiser->generate_daily_schedule( $date, $prescriptions );
        if ( $stop_at === 8 ) return array( 'step' => 8, 'schedule' => $schedule );
        
        // Step 9: Generate 14-day forecast
        $dli_forecast = $this->dli_estimator->get_dli_forecast( $location );
        
        // Calculate total hours (both theoretical and effective)
        $total_hours = 0;
        $total_effective_hours = 0;
        if ( is_array( $prescriptions ) ) {
            foreach ( $prescriptions as $p ) {
                if ( isset( $p['hours_prescribed'] ) ) {
                    $total_hours += floatval( $p['hours_prescribed'] );
                }
                if ( isset( $p['effective_hours'] ) ) {
                    $total_effective_hours += floatval( $p['effective_hours'] );
                }
            }
        }
        
        return array(
            'venue_id'                => $venue_id,
            'date'                    => $date,
            'generated_at'            => current_time( 'c' ),
            'ambient_dli'             => $ambient_dli_data,
            'venue_analysis'          => $venue_analysis,
            'prescriptions'           => $prescriptions,
            'stress_forecast'         => $stress_forecast,
            'disease_risk'            => $disease_risk,
            'recovery_status'         => $recovery_status,
            'recommended_schedule'    => $schedule,
            'forecast'                => $dli_forecast,
            'total_prescribed_hours'  => $total_hours,
            'total_effective_hours'   => $total_effective_hours,
            'eue'                     => $eue_result,
            'venue_readiness'         => $eue_result['venue_readiness'] ?? null,
        );
    }
    
    /**
     * Calculate Environmental Utilisation Efficiency for the venue.
     * 
     * Builds EUE params from climate data + venue environment config,
     * then delegates to Gssh_EUE_Calculator.
     *
     * @param array  $venue_config Full venue configuration
     * @param array  $location     Location array with lat/lng
     * @param string $date         Analysis date
     * @return array EUE result from Gssh_EUE_Calculator::calculate()
     */
    private function calculate_venue_eue( $venue_config, $location, $date ) {
        $venue_env = $venue_config['venue_environment'] ?? array();
        
        // Get temperature from climate module
        $air_temp_c  = null;
        $soil_temp_c = null;
        if ( $this->climate_module && method_exists( $this->climate_module, 'get_temperature' ) ) {
            $temp_data = $this->climate_module->get_temperature( $date, $location );
            if ( $temp_data && isset( $temp_data['temp_avg'] ) ) {
                $air_temp_c = $temp_data['temp_avg'];
                // Soil temp typically lags air by ~2°C and less extreme
                // If climate module doesn't provide soil temp, estimate
                $soil_temp_c = $temp_data['soil_temp_avg'] ?? ( $air_temp_c * 0.85 + 3 );
            }
        }
        
        // Determine species from first zone or venue default
        $species = 'couch';
        $zones = $venue_config['zones'] ?? array();
        if ( ! empty( $zones ) ) {
            $species = $zones[0]['variety'] ?? 'couch';
        }
        
        // Resolve airflow: venue fans override, else estimate from wind data
        $wind_speed_ms = null;
        if ( isset( $venue_env['estimated_airflow_ms'] ) ) {
            $wind_speed_ms = floatval( $venue_env['estimated_airflow_ms'] );
        } elseif ( ! empty( $venue_env['has_fans'] ) ) {
            $wind_speed_ms = 0.5; // Minimum functional airflow with fans
        }
        
        // Build params
        $params = array(
            'species'          => $species,
            'soil_temp_c'      => $soil_temp_c,
            'air_temp_c'       => $air_temp_c,
            'humidity_pct'     => $venue_env['humidity_pct'] ?? null,
            'wind_speed_ms'    => $wind_speed_ms,
            'co2_ppm'          => $venue_env['co2_ppm'] ?? null,
            'venue_enclosure'  => $venue_env['enclosure_type'] ?? 'open',
            'drainage_rating'  => $venue_env['drainage_rating'] ?? null,
            'soil_moisture_pct' => $venue_env['soil_moisture_pct'] ?? null,
        );
        
        return $this->eue_calculator->calculate( $params );
    }
    
    /**
     * Get stress forecasts for zones
     */
    private function get_stress_forecast_for_zones( $venue_config ) {
        $forecasts = array();
        $location = isset( $venue_config['location'] ) ? $venue_config['location'] : null;
        $zones = isset( $venue_config['zones'] ) ? $venue_config['zones'] : array();
        
        foreach ( $zones as $zone ) {
            $zone_id = $zone['zone_id'];
            $shade_factor = $this->get_zone_shade_factor( $zone, $location );
            
            $trajectory_input = array(
                'variety'      => $zone['variety'],
                'shade_factor' => $shade_factor,
                'location'     => $location,
            );
            
            $forecasts[ $zone_id ] = $this->stress_trajectory_engine->calculate_trajectory(
                $trajectory_input,
                14
            );
        }
        
        return $forecasts;
    }
    
    /**
     * Get disease risk for zones
     */
    private function get_disease_risk_for_zones( $venue_config, $date ) {
        $risks = array();
        $location = isset( $venue_config['location'] ) ? $venue_config['location'] : null;
        $zones = isset( $venue_config['zones'] ) ? $venue_config['zones'] : array();
        
        foreach ( $zones as $zone ) {
            $zone_id = $zone['zone_id'];
            $shade_factor = $this->get_zone_shade_factor( $zone, $location, $date );
            
            $risks[ $zone_id ] = $this->disease_engine->assess_risk( array(
                'variety'      => $zone['variety'],
                'location'     => $location,
                'date'         => $date,
                'shade_stress' => $shade_factor < 0.7,
            ) );
        }
        
        return $risks;
    }
    
    /**
     * Get recovery status for zones
     */
    private function get_recovery_status_for_zones( $venue_config ) {
        $status = array();
        $zones = isset( $venue_config['zones'] ) ? $venue_config['zones'] : array();
        
        foreach ( $zones as $zone ) {
            $status[ $zone['zone_id'] ] = $this->traffic_engine->get_zone_recovery_status( $zone['zone_id'] );
        }
        
        return $status;
    }
    
    /**
     * Enrich zone configurations
     */
    private function enrich_zone_configs( $zones, $stress_forecast, $disease_risk, $recovery_status, $location = null, $date = null ) {
        $enriched = array();
        
        foreach ( $zones as $zone ) {
            $zone_id = $zone['zone_id'];
            
            $zone['shade_factor'] = $this->get_zone_shade_factor( $zone, $location, $date );
            
            if ( isset( $stress_forecast[ $zone_id ] ) ) {
                $trajectory = $stress_forecast[ $zone_id ];
                $csi = isset( $trajectory['days'][0]['compound_stress_index'] ) ? $trajectory['days'][0]['compound_stress_index'] : 0;
                $zone['compound_stress_forecast'] = $csi;
                $zone['stress_trajectory'] = $trajectory;
                $zone['stress_trending_up'] = $this->is_stress_trending_up( $trajectory );
            }
            
            if ( isset( $disease_risk[ $zone_id ] ) ) {
                $zone['disease_risk'] = $disease_risk[ $zone_id ];
                $overall_risk = isset( $disease_risk[ $zone_id ]['overall_risk'] ) ? $disease_risk[ $zone_id ]['overall_risk'] : 0;
                $zone['elevated_disease_risk'] = $overall_risk > 0.6;
            }
            
            if ( isset( $recovery_status[ $zone_id ] ) ) {
                $zone['recovery_mode'] = isset( $recovery_status[ $zone_id ]['in_recovery'] ) ? $recovery_status[ $zone_id ]['in_recovery'] : false;
                $zone['recovery_progress'] = isset( $recovery_status[ $zone_id ]['progress'] ) ? $recovery_status[ $zone_id ]['progress'] : null;
            }
            
            $enriched[] = $zone;
        }
        
        return $enriched;
    }
    
    /**
     * Get shade factor for zone
     */
    private function get_zone_shade_factor( $zone, $location = null, $date = null ) {
        $shade_source = isset( $zone['shade_source'] ) ? $zone['shade_source'] : '';
        if ( $shade_source === 'manual' && isset( $zone['manual_shade_factor'] ) ) {
            return $zone['manual_shade_factor'];
        }
        
        if ( ! empty( $zone['shade_structure_ids'] ) ) {
            $use_date = $date ? $date : date( 'Y-m-d' );
            return $this->shade_engine->get_composite_shade_factor(
                $zone['shade_structure_ids'],
                $use_date,
                $location
            );
        }
        
        return 1.0;
    }
    
    /**
     * Check if stress is trending up
     */
    private function is_stress_trending_up( $trajectory ) {
        if ( empty( $trajectory['days'] ) || count( $trajectory['days'] ) < 4 ) {
            return false;
        }
        
        $day_0 = isset( $trajectory['days'][0]['compound_stress_index'] ) ? $trajectory['days'][0]['compound_stress_index'] : 0;
        $day_3 = isset( $trajectory['days'][3]['compound_stress_index'] ) ? $trajectory['days'][3]['compound_stress_index'] : 0;
        
        return $day_3 > $day_0 * 1.15;
    }
    
    /**
     * Generate prescriptions (EUE-adjusted)
     * 
     * When EUE data is available, prescriptions include both theoretical
     * and effective (EUE-adjusted) supplemental hours.
     */
    private function generate_prescriptions( $venue_analysis, $equipment, $eue_result = null ) {
        $prescriptions = array();
        $default_equipment = ( is_array( $equipment ) && isset( $equipment[0] ) ) ? $equipment[0] : $this->get_default_equipment_specs();
        
        $zones = isset( $venue_analysis['zones'] ) ? $venue_analysis['zones'] : array();
        
        $eue_coefficient = ( $eue_result && isset( $eue_result['composite_eue'] ) )
            ? $eue_result['composite_eue']
            : 1.0;
        
        foreach ( $zones as $zone_id => $analysis ) {
            $deficit = isset( $analysis['deficit'] ) ? $analysis['deficit'] : 0;
            $prescription = $this->gap_calculator->calculate_supplemental_hours(
                $deficit,
                $default_equipment,
                $eue_coefficient
            );
            
            $prescriptions[ $zone_id ] = array_merge( $analysis, $prescription );
        }
        
        return $prescriptions;
    }
    
    /**
     * Default equipment specs
     */
    private function get_default_equipment_specs() {
        return [
            'ppfd_at_canopy'      => 400,
            'uniformity_factor'   => 0.85,
            'max_daily_operation' => 16,
            'power_draw_kw'       => 12,
        ];
    }
}
