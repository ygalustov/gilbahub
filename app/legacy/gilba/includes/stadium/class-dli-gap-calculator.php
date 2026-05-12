<?php
/**
 * DLI Gap Calculator
 * 
 * Calculates daily light integral deficits by zone and generates
 * supplemental light prescriptions based on variety requirements.
 * 
 * v2.0 — EUE integration:
 *   - HOC-aware DLI targeting via Gssh_EUE_Calculator::get_dli_for_hoc()
 *   - EUE-adjusted supplemental hours (effective vs theoretical)
 *   - Venue environment context in deficit calculation
 */

class Gssh_DLI_Gap_Calculator {
    
    private $variety_database;
    private $shade_engine;
    private $stress_trajectory_engine;
    private $eue_calculator;
    
    /**
     * Constructor
     */
    public function __construct( $variety_database, $shade_engine, $stress_trajectory_engine ) {
        $this->variety_database = $variety_database;
        $this->shade_engine = $shade_engine;
        $this->stress_trajectory_engine = $stress_trajectory_engine;
        $this->eue_calculator = new Gssh_EUE_Calculator();
    }
    
    /**
     * Get DLI requirements for a variety
     * 
     * @param string $variety
     * @return array
     */
    public function get_variety_dli_requirements( $variety ) {
        return $this->variety_database->get_variety( $variety );
    }
    
    /**
     * Calculate zone deficit
     * 
     * @param array      $zone_config  Enriched zone configuration
     * @param float      $ambient_dli
     * @param array|null $eue_result   EUE calculation result
     * @param array      $venue_env    Venue environment config
     * @return array
     */
    public function calculate_zone_deficit( $zone_config, $ambient_dli, $eue_result = null, $venue_env = array() ) {
        $variety_requirements = $this->get_variety_dli_requirements( $zone_config['variety'] );
        $shade_factor = $zone_config['shade_factor'] ?? 1.0;
        
        $actual_dli = $ambient_dli * $shade_factor;
        
        $target_data = $this->determine_target_dli( $variety_requirements, $zone_config, $eue_result, $venue_env );
        $target_dli = $target_data['target_dli'];
        
        $deficit = max( 0, $target_dli - $actual_dli );
        $severity = $this->classify_deficit_severity( $actual_dli, $variety_requirements );
        
        $result = [
            'zone_id'             => $zone_config['zone_id'],
            'zone_name'           => $zone_config['zone_name'] ?? $zone_config['zone_id'],
            'variety'             => $zone_config['variety'],
            'ambient_dli'         => round( $ambient_dli, 1 ),
            'shade_factor'        => round( $shade_factor, 2 ),
            'actual_dli'          => round( $actual_dli, 1 ),
            'target_dli'          => round( $target_dli, 1 ),
            'minimum_dli'         => $variety_requirements['minimum_dli'],
            'optimal_dli'         => $variety_requirements['optimal_dli'],
            'critical_dli'        => $variety_requirements['critical_dli'],
            'deficit'             => round( $deficit, 1 ),
            'severity'            => $severity,
            'shade_tolerance'     => $variety_requirements['shade_tolerance_rating'],
            'days_to_decline'     => $variety_requirements['shade_response']['days_to_visible_decline'],
            'target_elevated'     => $target_data['target_elevated'],
            'elevation_reasons'   => $target_data['elevation_reasons'],
            'target_source'       => $target_data['target_source'] ?? 'species_default',
            'compound_stress'     => $zone_config['compound_stress_forecast'] ?? null,
            'stress_trending_up'  => $zone_config['stress_trending_up'] ?? false,
            'disease_risk'        => $zone_config['disease_risk']['overall_risk'] ?? null,
            'recovery_mode'       => $zone_config['recovery_mode'] ?? false,
        ];
        
        // Include HOC target info if available
        if ( isset( $target_data['hoc_target'] ) ) {
            $result['hoc_target'] = $target_data['hoc_target'];
        }
        
        return $result;
    }
    
    /**
     * Determine target DLI based on context
     * 
     * v2.0: Now supports mowing-height-aware DLI targeting.
     * DLI requirements increase as HOC decreases — lower cut = less leaf area
     * = higher DLI needed to maintain photosynthetic capacity.
     * 
     * Source: "Lawn Growth Under Artificial Light" Section 14
     *         Bunnell et al. 2005, Wherley & Chen (USGA 2019)
     * 
     * @param array $variety_requirements
     * @param array $zone_config
     * @return array
     */
    private function determine_target_dli( $variety_requirements, $zone_config, $eue_result = null, $venue_env = array() ) {
        $base_target = $variety_requirements['minimum_dli'];
        $target_source = 'species_default';
        $reasons = [];
        $hoc_target_data = null;
        
        // HOC-aware DLI adjustment
        // Check venue env first (global HOC), then zone config
        $hoc_mm = $venue_env['hoc_mm'] ?? ( $zone_config['mowing_height_mm'] ?? ( $zone_config['hoc'] ?? null ) );
        $management_goal = $venue_env['management_goal'] ?? ( $zone_config['management_goal'] ?? 'maintenance' );
        
        // Upgrade to strengthening for recovery/heavy traffic
        if ( ! empty( $zone_config['recovery_mode'] ) || 
             ( isset( $zone_config['traffic'] ) && $zone_config['traffic'] === 'heavy' ) ) {
            $management_goal = 'strengthening';
        }
        
        if ( $hoc_mm && $hoc_mm > 0 ) {
            // Prefer EUE calculator (richer band metadata with source attribution)
            if ( $this->eue_calculator ) {
                $variety_key = $zone_config['variety'] ?? 'couch';
                $eue_hoc = $this->eue_calculator->get_dli_for_hoc( $variety_key, (int) $hoc_mm, $management_goal );
                
                if ( $eue_hoc && isset( $eue_hoc['midpoint'] ) ) {
                    $hoc_target_data = $eue_hoc;
                    $target_source = 'hoc_adjusted';
                    
                    if ( $eue_hoc['midpoint'] > $base_target ) {
                        $base_target = $eue_hoc['midpoint'];
                    }
                    
                    $reasons[] = sprintf(
                        'HOC-adjusted: %dmm %s → DLI %s–%s mol (%s)',
                        $hoc_mm, $management_goal,
                        $eue_hoc['min'], $eue_hoc['max'], $eue_hoc['band']
                    );
                }
            } else {
                // Fallback to internal HOC matrix
                $hoc_target = $this->get_dli_for_hoc( $variety_requirements, $hoc_mm, $zone_config );
                if ( $hoc_target && $hoc_target > $base_target ) {
                    $base_target = $hoc_target;
                    $target_source = 'hoc_adjusted';
                    $reasons[] = sprintf( 'HOC-adjusted: %dmm requires %.1f mol DLI', $hoc_mm, $hoc_target );
                }
            }
        }
        
        // Check for calibration override
        if ( isset( $zone_config['calibration']['adjusted_minimum_dli'] ) ) {
            $base_target = $zone_config['calibration']['adjusted_minimum_dli'];
            $target_source = 'local_calibration';
            $reasons[] = 'Local calibration applied';
        }
        
        // Recovery mode (only override if not already HOC-adjusted to strengthening)
        if ( ! empty( $zone_config['recovery_mode'] ) && $management_goal !== 'strengthening' ) {
            $base_target = $variety_requirements['optimal_dli'];
            $target_source = $target_source === 'hoc_adjusted' ? 'hoc_recovery' : 'recovery';
            $reasons[] = 'Recovery mode — targeting optimal DLI';
        }
        
        // High stress predicted
        if ( isset( $zone_config['compound_stress_forecast'] ) ) {
            $stress_level = $zone_config['compound_stress_forecast'];
            
            if ( $stress_level > 0.7 ) {
                $buffer = ( $variety_requirements['optimal_dli'] - $variety_requirements['minimum_dli'] ) * 0.7;
                $elevated = $variety_requirements['minimum_dli'] + $buffer;
                
                if ( $elevated > $base_target ) {
                    $base_target = $elevated;
                    $reasons[] = sprintf( 'Elevated for high stress (index: %.2f)', $stress_level );
                }
            } elseif ( $stress_level > 0.5 ) {
                $buffer = ( $variety_requirements['optimal_dli'] - $variety_requirements['minimum_dli'] ) * 0.4;
                $elevated = $variety_requirements['minimum_dli'] + $buffer;
                
                if ( $elevated > $base_target ) {
                    $base_target = $elevated;
                    $reasons[] = sprintf( 'Buffered for moderate stress (index: %.2f)', $stress_level );
                }
            }
        }
        
        // Stress trending up
        if ( ! empty( $zone_config['stress_trending_up'] ) && $base_target < $variety_requirements['optimal_dli'] ) {
            $base_target = min( $variety_requirements['optimal_dli'], $base_target * 1.1 );
            $reasons[] = 'Additional buffer for upward stress trend';
        }
        
        // Elevated disease risk
        if ( ! empty( $zone_config['elevated_disease_risk'] ) ) {
            $disease_buffer = ( $variety_requirements['optimal_dli'] - $base_target ) * 0.3;
            $base_target = $base_target + $disease_buffer;
            $reasons[] = 'Elevated for disease pressure';
        }
        
        $final_target = min( $base_target, $variety_requirements['optimal_dli'] );
        
        $result = [
            'target_dli'        => round( $final_target, 1 ),
            'target_elevated'   => count( $reasons ) > 0,
            'elevation_reasons' => $reasons,
            'target_source'     => $target_source,
        ];
        
        if ( $hoc_target_data ) {
            $result['hoc_target'] = $hoc_target_data;
        }
        
        return $result;
    }
    
    /**
     * Get DLI target adjusted for mowing height.
     * 
     * DLI-by-HOC Matrix (Source: "Lawn Growth Under Artificial Light" Section 14):
     * 
     * C4 (Tifton/bermuda/couch):
     *   10-12mm ultra-low:  maintenance 22-26, strengthening 28-32
     *   13-17mm match:      maintenance 18-22, strengthening 22-28
     *   18-20mm recovery:   maintenance 16-20, strengthening 20-25
     *   21-30mm standard:   maintenance 14-18, strengthening 18-22
     *   31-50mm high:       maintenance 12-16, strengthening 16-20
     * 
     * C3 (ryegrass/fescue/bent):
     *   15-19mm low:        maintenance 14-17, strengthening 20-24
     *   20-25mm match:      maintenance 12-13, strengthening 18-20
     *   26-30mm maintenance:maintenance 10-12, strengthening 14-16
     *   31-45mm high:       maintenance 8-10,  strengthening 12-14
     * 
     * @param array  $variety_requirements
     * @param float  $hoc_mm
     * @param array  $zone_config
     * @return float|null
     */
    private function get_dli_for_hoc( $variety_requirements, $hoc_mm, $zone_config ) {
        // Determine if C3 or C4
        $is_c4 = $this->is_c4_variety( $variety_requirements );
        $goal = ( $zone_config['management_goal'] ?? 'maintenance' ) === 'strengthening' 
                ? 'strengthening' : 'maintenance';
        
        // Also use strengthening if in recovery mode or heavy traffic
        if ( ! empty( $zone_config['recovery_mode'] ) || 
             ( isset( $zone_config['traffic'] ) && $zone_config['traffic'] === 'heavy' ) ) {
            $goal = 'strengthening';
        }
        
        $bands = $is_c4 ? [
            [ 'min' => 10, 'max' => 12, 'maintenance' => [22, 26], 'strengthening' => [28, 32] ],
            [ 'min' => 13, 'max' => 17, 'maintenance' => [18, 22], 'strengthening' => [22, 28] ],
            [ 'min' => 18, 'max' => 20, 'maintenance' => [16, 20], 'strengthening' => [20, 25] ],
            [ 'min' => 21, 'max' => 30, 'maintenance' => [14, 18], 'strengthening' => [18, 22] ],
            [ 'min' => 31, 'max' => 50, 'maintenance' => [12, 16], 'strengthening' => [16, 20] ],
        ] : [
            [ 'min' => 15, 'max' => 19, 'maintenance' => [14, 17], 'strengthening' => [20, 24] ],
            [ 'min' => 20, 'max' => 25, 'maintenance' => [12, 13], 'strengthening' => [18, 20] ],
            [ 'min' => 26, 'max' => 30, 'maintenance' => [10, 12], 'strengthening' => [14, 16] ],
            [ 'min' => 31, 'max' => 45, 'maintenance' => [ 8, 10], 'strengthening' => [12, 14] ],
        ];
        
        foreach ( $bands as $band ) {
            if ( $hoc_mm >= $band['min'] && $hoc_mm <= $band['max'] ) {
                $range = $band[ $goal ];
                return ( $range[0] + $range[1] ) / 2;
            }
        }
        
        // Below minimum band — extrapolate upward
        if ( $hoc_mm < $bands[0]['min'] ) {
            $range = $bands[0][ $goal ];
            return ( $range[0] + $range[1] ) / 2 + 2;
        }
        
        // Above maximum band
        $last = end( $bands );
        $range = $last[ $goal ];
        return max( 6, ( $range[0] + $range[1] ) / 2 - 2 );
    }
    
    /**
     * Check if variety is C4
     */
    private function is_c4_variety( $variety_requirements ) {
        $pathway = $variety_requirements['photosynthetic_pathway'] ?? '';
        if ( strtolower( $pathway ) === 'c4' ) return true;
        if ( strtolower( $pathway ) === 'c3' ) return false;
        
        // Infer from minimum DLI (C4 generally needs more light)
        $min_dli = $variety_requirements['minimum_dli'] ?? 12;
        return $min_dli >= 15;
    }
    
    /**
     * Classify deficit severity
     * 
     * @param float $actual_dli
     * @param array $requirements
     * @return string
     */
    private function classify_deficit_severity( $actual_dli, $requirements ) {
        if ( $actual_dli >= $requirements['minimum_dli'] ) {
            return 'adequate';
        }
        
        if ( $actual_dli >= $requirements['critical_dli'] ) {
            $range = $requirements['minimum_dli'] - $requirements['critical_dli'];
            $position = $actual_dli - $requirements['critical_dli'];
            $ratio = $range > 0 ? $position / $range : 0;
            
            if ( $ratio > 0.5 ) {
                return 'moderate';
            }
            return 'significant';
        }
        
        return 'critical';
    }
    
    /**
     * Calculate venue-wide deficit analysis
     * 
     * @param array      $zones
     * @param float      $ambient_dli
     * @param array|null $eue_result     EUE calculation result (from Gssh_EUE_Calculator)
     * @param array      $venue_env      Venue environment config (may contain hoc_mm, management_goal)
     * @return array
     */
    public function calculate_venue_deficit( $zones, $ambient_dli, $eue_result = null, $venue_env = array() ) {
        $zone_analyses = [];
        $priority_zones = [];
        $total_deficit = 0;
        
        foreach ( $zones as $zone ) {
            $analysis = $this->calculate_zone_deficit( $zone, $ambient_dli, $eue_result, $venue_env );
            $zone_analyses[ $zone['zone_id'] ] = $analysis;
            $total_deficit += $analysis['deficit'];
            
            if ( in_array( $analysis['severity'], [ 'significant', 'critical' ] ) ) {
                $priority_zones[] = [
                    'zone_id'  => $zone['zone_id'],
                    'severity' => $analysis['severity'],
                    'deficit'  => $analysis['deficit'],
                ];
            }
        }
        
        usort( $priority_zones, function( $a, $b ) {
            $severity_order = [ 'critical' => 0, 'significant' => 1 ];
            $a_order = $severity_order[ $a['severity'] ] ?? 99;
            $b_order = $severity_order[ $b['severity'] ] ?? 99;
            
            if ( $a_order !== $b_order ) {
                return $a_order - $b_order;
            }
            return $b['deficit'] <=> $a['deficit'];
        });
        
        return [
            'date'           => date( 'Y-m-d' ),
            'ambient_dli'    => $ambient_dli,
            'zones'          => $zone_analyses,
            'priority_zones' => $priority_zones,
            'total_deficit'  => round( $total_deficit, 1 ),
            'zones_adequate' => count( array_filter( $zone_analyses, fn( $z ) => $z['severity'] === 'adequate' ) ),
            'zones_at_risk'  => count( $priority_zones ),
            'eue_applied'    => $eue_result !== null,
        ];
    }
    
    /**
     * Calculate supplemental light hours required
     * 
     * v2.0: When eue_coefficient < 1.0, calculates both theoretical hours
     * (what the LED runs) and effective hours (what the plant can use).
     * The prescription reports both so the venue manager understands
     * the gap between energy spend and growth outcome.
     * 
     * @param float $deficit
     * @param array $equipment_specs
     * @param float $eue_coefficient  EUE composite (0.0–1.0), default 1.0
     * @return array
     */
    public function calculate_supplemental_hours( $deficit, $equipment_specs, $eue_coefficient = 1.0 ) {
        if ( $deficit <= 0 ) {
            return [
                'hours_required'          => 0,
                'hours_prescribed'        => 0,
                'effective_hours'         => 0,
                'mol_delivered'           => 0,
                'mol_effective'           => 0,
                'deficit_fully_addressed' => true,
                'eue_coefficient'         => $eue_coefficient,
                'wasted_pct'              => 0,
                'prescription'            => 'No supplemental light required',
            ];
        }
        
        $ppfd = $equipment_specs['ppfd_at_canopy'] ?? 400;
        $uniformity = $equipment_specs['uniformity_factor'] ?? 0.85;
        $max_hours = $equipment_specs['max_daily_operation'] ?? 16;
        
        // mol/m²/hour = PPFD × 3600 × 0.000001 × uniformity
        $mol_per_hour = $ppfd * 3600 * 0.000001 * $uniformity;
        
        // Theoretical hours (ignoring environmental limits)
        $hours_required = $deficit / $mol_per_hour;
        $hours_prescribed = min( $hours_required, $max_hours );
        $mol_delivered = $hours_prescribed * $mol_per_hour;
        
        // Effective hours: how much actually converts to growth
        $eue = max( 0.01, min( 1.0, $eue_coefficient ) );
        $mol_effective = $mol_delivered * $eue;
        $wasted_pct = round( ( 1 - $eue ) * 100 );
        
        // If EUE is low, calculate how many hours would be needed
        // to actually deliver the deficit (accounting for waste)
        $effective_hours_needed = $eue > 0.1 ? $deficit / ( $mol_per_hour * $eue ) : $max_hours;
        $effective_hours = min( $effective_hours_needed, $max_hours );
        
        // Can we actually close the deficit with EUE losses?
        $effective_mol_at_max = $max_hours * $mol_per_hour * $eue;
        $deficit_addressable = $effective_mol_at_max >= $deficit;
        
        return [
            'deficit'                 => round( $deficit, 1 ),
            'hours_required'          => round( $hours_required, 1 ),
            'hours_prescribed'        => round( $hours_prescribed, 1 ),
            'effective_hours'         => round( $effective_hours, 1 ),
            'mol_delivered'           => round( $mol_delivered, 1 ),
            'mol_effective'           => round( $mol_effective, 1 ),
            'deficit_fully_addressed' => $deficit_addressable,
            'equipment_ppfd'          => $ppfd,
            'mol_per_hour'            => round( $mol_per_hour, 3 ),
            'eue_coefficient'         => round( $eue, 3 ),
            'wasted_pct'              => $wasted_pct,
        ];
    }
}
