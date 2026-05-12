<?php
/**
 * Light Schedule Optimiser (PHP 5.6 Compatible)
 */

class Gssh_Schedule_Optimiser {
    
    const EFFECTIVENESS_DAWN_EXTENSION = 1.0;
    const EFFECTIVENESS_DUSK_EXTENSION = 0.95;
    const EFFECTIVENESS_DAY_SUPPLEMENT = 0.90;
    const EFFECTIVENESS_NIGHT_EARLY = 0.75;
    const EFFECTIVENESS_NIGHT_LATE = 0.70;
    
    private $venue_config;
    private $gap_calculator;
    
    public function __construct( $venue_config, $gap_calculator ) {
        $this->venue_config = $venue_config;
        $this->gap_calculator = $gap_calculator;
    }
    
    public function generate_daily_schedule( $date, $zone_prescriptions ) {
        $constraints = isset( $this->venue_config['operational_constraints'] ) ? $this->venue_config['operational_constraints'] : array();
        $equipment = isset( $this->venue_config['equipment'] ) ? $this->venue_config['equipment'] : array();
        
        $sun_data = $this->get_sun_data( $date );
        $sun_times = $sun_data['strings']; // String versions for output
        
        // Filter zones that need light
        $zones_needing_light = array();
        if ( is_array( $zone_prescriptions ) ) {
            foreach ( $zone_prescriptions as $zone_id => $z ) {
                $hours = isset( $z['hours_prescribed'] ) ? floatval( $z['hours_prescribed'] ) : 0;
                if ( $hours > 0 ) {
                    $zones_needing_light[ $zone_id ] = $z;
                }
            }
        }
        
        if ( empty( $zones_needing_light ) ) {
            return $this->empty_schedule( $date, $sun_times );
        }
        
        // Sort zones by priority
        uasort( $zones_needing_light, array( $this, 'compare_zone_priority' ) );
        
        // Build simple schedule
        $sessions = array();
        $total_hours = 0;
        $total_kwh = 0;
        $total_cost = 0;
        
        // Get default equipment
        $default_rig = ! empty( $equipment ) ? $equipment[0] : $this->get_default_rig();
        
        foreach ( $zones_needing_light as $zone_id => $prescription ) {
            $hours_needed = isset( $prescription['hours_prescribed'] ) ? floatval( $prescription['hours_prescribed'] ) : 0;
            
            if ( $hours_needed <= 0 ) continue;
            
            // Create a session starting at dawn extension (use DateTime objects)
            $session_start = clone $sun_data['objects']['dawn_extension_start'];
            $session_end = clone $session_start;
            $session_end->modify( '+' . intval( $hours_needed * 60 ) . ' minutes' );
            
            $power_draw = isset( $default_rig['power_draw_kw'] ) ? floatval( $default_rig['power_draw_kw'] ) : 12;
            $kwh = $hours_needed * $power_draw;
            $rate = 0.25; // Default rate
            
            $ppfd = isset( $default_rig['ppfd_at_canopy'] ) ? floatval( $default_rig['ppfd_at_canopy'] ) : 400;
            $uniformity = isset( $default_rig['uniformity_factor'] ) ? floatval( $default_rig['uniformity_factor'] ) : 0.85;
            $mol_per_hour = $ppfd * 0.0036 * $uniformity;
            
            $sessions[] = array(
                'zone_id'          => $zone_id,
                'rig_id'           => isset( $default_rig['rig_id'] ) ? $default_rig['rig_id'] : 'rig_1',
                'rig_name'         => isset( $default_rig['rig_name'] ) ? $default_rig['rig_name'] : 'Default Rig',
                'start_time'       => $session_start->format( 'H:i' ),
                'end_time'         => $session_end->format( 'H:i' ),
                'start_timestamp'  => $session_start->getTimestamp(),
                'end_timestamp'    => $session_end->getTimestamp(),
                'duration_hours'   => round( $hours_needed, 2 ),
                'window_type'      => 'dawn_extension',
                'effectiveness'    => self::EFFECTIVENESS_DAWN_EXTENSION,
                'tariff'           => 'off_peak',
                'energy_rate'      => $rate,
                'kwh'              => round( $kwh, 2 ),
                'cost'             => round( $kwh * $rate, 2 ),
                'mol_delivered'    => round( $hours_needed * $mol_per_hour, 2 ),
            );
            
            $total_hours += $hours_needed;
            $total_kwh += $kwh;
            $total_cost += $kwh * $rate;
        }
        
        return array(
            'date'              => $date,
            'generated_at'      => $this->current_time_iso8601(),
            'sun_times'         => $sun_times,
            'sessions'          => $sessions,
            'total_hours'       => round( $total_hours, 2 ),
            'estimated_kwh'     => round( $total_kwh, 2 ),
            'estimated_cost'    => round( $total_cost, 2 ),
            'peak_cost'         => 0,
            'off_peak_cost'     => round( $total_cost, 2 ),
            'zones_scheduled'   => count( $sessions ),
            'zones_unscheduled' => array(),
            'warnings'          => array(),
            'allocation_mode'   => 'simple',
        );
    }
    
    private function get_sun_data( $date ) {
        $location = isset( $this->venue_config['location'] ) ? $this->venue_config['location'] : array();
        $lat = isset( $location['lat'] ) ? floatval( $location['lat'] ) : -33.87;
        $lng = isset( $location['lng'] ) ? floatval( $location['lng'] ) : 151.21;
        $timezone_str = isset( $location['timezone'] ) ? $location['timezone'] : 'Australia/Sydney';
        
        try {
            $timezone = new DateTimeZone( $timezone_str );
        } catch ( Exception $e ) {
            $timezone = new DateTimeZone( 'UTC' );
        }
        
        $timestamp = strtotime( $date );
        $sun_info = date_sun_info( $timestamp, $lat, $lng );
        
        $sunrise = new DateTime( '@' . $sun_info['sunrise'] );
        $sunrise->setTimezone( $timezone );
        
        $sunset = new DateTime( '@' . $sun_info['sunset'] );
        $sunset->setTimezone( $timezone );
        
        // Dawn extension starts 2 hours before sunrise
        $dawn_start = clone $sunrise;
        $dawn_start->modify( '-2 hours' );
        
        // Dusk extension ends 2 hours after sunset
        $dusk_end = clone $sunset;
        $dusk_end->modify( '+2 hours' );
        
        $day_length = round( ( $sun_info['sunset'] - $sun_info['sunrise'] ) / 3600, 1 );
        
        return array(
            'objects' => array(
                'sunrise'               => $sunrise,
                'sunset'                => $sunset,
                'dawn_extension_start'  => $dawn_start,
                'dawn_extension_end'    => $sunrise,
                'dusk_extension_start'  => $sunset,
                'dusk_extension_end'    => $dusk_end,
            ),
            'strings' => array(
                'sunrise'               => $sunrise->format( 'H:i' ),
                'sunset'                => $sunset->format( 'H:i' ),
                'dawn_extension_start'  => $dawn_start->format( 'H:i' ),
                'dawn_extension_end'    => $sunrise->format( 'H:i' ),
                'dusk_extension_start'  => $sunset->format( 'H:i' ),
                'dusk_extension_end'    => $dusk_end->format( 'H:i' ),
                'day_length_hours'      => $day_length,
                'day_length'            => $day_length,
            ),
        );
    }
    
    private function compare_zone_priority( $a, $b ) {
        $severity_order = array( 'critical' => 0, 'significant' => 1, 'moderate' => 2, 'adequate' => 3 );
        
        $a_sev_name = isset( $a['severity'] ) ? $a['severity'] : 'adequate';
        $b_sev_name = isset( $b['severity'] ) ? $b['severity'] : 'adequate';
        
        $a_sev = isset( $severity_order[ $a_sev_name ] ) ? $severity_order[ $a_sev_name ] : 99;
        $b_sev = isset( $severity_order[ $b_sev_name ] ) ? $severity_order[ $b_sev_name ] : 99;
        
        if ( $a_sev !== $b_sev ) {
            return $a_sev - $b_sev;
        }
        
        $a_def = isset( $a['deficit'] ) ? floatval( $a['deficit'] ) : 0;
        $b_def = isset( $b['deficit'] ) ? floatval( $b['deficit'] ) : 0;
        
        if ( $b_def > $a_def ) return 1;
        if ( $b_def < $a_def ) return -1;
        return 0;
    }
    
    private function get_default_rig() {
        return array(
            'rig_id'            => 'rig_1',
            'rig_name'          => 'Default Rig',
            'ppfd_at_canopy'    => 400,
            'uniformity_factor' => 0.85,
            'power_draw_kw'     => 12,
            'min_session_hours' => 1,
        );
    }
    
    private function empty_schedule( $date, $sun_times ) {
        return array(
            'date'              => $date,
            'generated_at'      => $this->current_time_iso8601(),
            'sun_times'         => $sun_times,
            'sessions'          => array(),
            'total_hours'       => 0,
            'estimated_kwh'     => 0,
            'estimated_cost'    => 0,
            'peak_cost'         => 0,
            'off_peak_cost'     => 0,
            'zones_scheduled'   => 0,
            'zones_unscheduled' => array(),
            'warnings'          => array(),
            'message'           => 'No supplemental light required',
        );
    }

    private function current_time_iso8601() {
        return date( DATE_ATOM );
    }
}
