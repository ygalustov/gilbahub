<?php
/**
 * Effectiveness Tracker
 * 
 * Logs delivery and quality data for calibration.
 */

if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

class Gssh_Effectiveness_Tracker {
    
    private $venue_id;
    
    public function __construct( $venue_id ) {
        $this->venue_id = $venue_id;
    }
    
    /**
     * Log delivery session
     */
    public function log_delivery( $session, $actual = [] ) {
        global $wpdb;
        
        $data = [
            'venue_id'           => $this->venue_id,
            'zone_id'            => $session['zone_id'],
            'date'               => date( 'Y-m-d', $session['start_timestamp'] ?? time() ),
            'rig_id'             => $session['rig_id'] ?? null,
            'scheduled_start'    => $session['start_time'] ?? null,
            'scheduled_end'      => $session['end_time'] ?? null,
            'scheduled_hours'    => $session['duration_hours'] ?? 0,
            'scheduled_mol'      => $session['mol_delivered'] ?? 0,
            'actual_start'       => $actual['start_time'] ?? $session['start_time'] ?? null,
            'actual_end'         => $actual['end_time'] ?? $session['end_time'] ?? null,
            'actual_hours'       => $actual['duration_hours'] ?? $session['duration_hours'] ?? 0,
            'actual_mol'         => $actual['mol_delivered'] ?? $session['mol_delivered'] ?? 0,
            'ambient_dli'        => $session['ambient_dli'] ?? null,
            'target_dli'         => $session['target_dli'] ?? null,
            'deficit_before'     => $session['deficit'] ?? null,
            'window_type'        => $session['window_type'] ?? null,
            'effectiveness_rating' => $session['effectiveness'] ?? null,
            'kwh_consumed'       => $actual['kwh'] ?? $session['kwh'] ?? 0,
            'energy_cost'        => $actual['cost'] ?? $session['cost'] ?? 0,
            'status'             => $actual['status'] ?? 'completed',
            'notes'              => $actual['notes'] ?? '',
            'logged_at'          => current_time( 'mysql' ),
        ];
        
        $wpdb->insert( $wpdb->prefix . 'gssh_light_delivery_log', $data );
        
        return $wpdb->insert_id;
    }
    
    /**
     * Log quality observation
     */
    public function log_quality_observation( $observation ) {
        global $wpdb;
        
        $data = [
            'venue_id'           => $this->venue_id,
            'zone_id'            => sanitize_text_field( $observation['zone_id'] ),
            'date'               => sanitize_text_field( $observation['date'] ),
            'time'               => $observation['time'] ?? null,
            'visual_rating'      => intval( $observation['visual_rating'] ),
            'density_rating'     => isset( $observation['density_rating'] ) ? intval( $observation['density_rating'] ) : null,
            'colour_rating'      => isset( $observation['colour_rating'] ) ? intval( $observation['colour_rating'] ) : null,
            'uniformity_rating'  => isset( $observation['uniformity_rating'] ) ? intval( $observation['uniformity_rating'] ) : null,
            'ndvi_value'         => isset( $observation['ndvi_value'] ) ? floatval( $observation['ndvi_value'] ) : null,
            'chlorophyll_index'  => isset( $observation['chlorophyll_index'] ) ? floatval( $observation['chlorophyll_index'] ) : null,
            'canopy_temperature' => isset( $observation['canopy_temperature'] ) ? floatval( $observation['canopy_temperature'] ) : null,
            'clipping_yield'     => isset( $observation['clipping_yield'] ) ? floatval( $observation['clipping_yield'] ) : null,
            'growth_rate'        => isset( $observation['growth_rate'] ) ? floatval( $observation['growth_rate'] ) : null,
            'disease_presence'   => ! empty( $observation['disease_presence'] ) ? 1 : 0,
            'disease_type'       => $observation['disease_type'] ?? null,
            'disease_severity'   => $observation['disease_severity'] ?? null,
            'stress_symptoms'    => isset( $observation['stress_symptoms'] ) ? maybe_serialize( $observation['stress_symptoms'] ) : null,
            'observer'           => $observation['observer'] ?? null,
            'method'             => $observation['method'] ?? 'visual',
            'weather_conditions' => $observation['weather_conditions'] ?? null,
            'notes'              => sanitize_textarea_field( $observation['notes'] ?? '' ),
            'logged_at'          => current_time( 'mysql' ),
        ];
        
        $wpdb->insert( $wpdb->prefix . 'gssh_light_quality_log', $data );
        
        return $wpdb->insert_id;
    }
    
    /**
     * Get delivery history
     */
    public function get_delivery_history( $zone_id = null, $start_date = null, $end_date = null, $limit = 100 ) {
        global $wpdb;
        
        $sql = "SELECT * FROM {$wpdb->prefix}gssh_light_delivery_log WHERE venue_id = %s";
        $params = [ $this->venue_id ];
        
        if ( $zone_id ) {
            $sql .= " AND zone_id = %s";
            $params[] = $zone_id;
        }
        
        if ( $start_date ) {
            $sql .= " AND date >= %s";
            $params[] = $start_date;
        }
        
        if ( $end_date ) {
            $sql .= " AND date <= %s";
            $params[] = $end_date;
        }
        
        $sql .= " ORDER BY date DESC, logged_at DESC LIMIT %d";
        $params[] = $limit;
        
        return $wpdb->get_results( $wpdb->prepare( $sql, $params ), ARRAY_A );
    }
    
    /**
     * Get quality observations
     */
    public function get_quality_observations( $zone_id = null, $start_date = null, $end_date = null, $limit = 100 ) {
        global $wpdb;
        
        $sql = "SELECT * FROM {$wpdb->prefix}gssh_light_quality_log WHERE venue_id = %s";
        $params = [ $this->venue_id ];
        
        if ( $zone_id ) {
            $sql .= " AND zone_id = %s";
            $params[] = $zone_id;
        }
        
        if ( $start_date ) {
            $sql .= " AND date >= %s";
            $params[] = $start_date;
        }
        
        if ( $end_date ) {
            $sql .= " AND date <= %s";
            $params[] = $end_date;
        }
        
        $sql .= " ORDER BY date DESC, logged_at DESC LIMIT %d";
        $params[] = $limit;
        
        return $wpdb->get_results( $wpdb->prepare( $sql, $params ), ARRAY_A );
    }
    
    /**
     * Get summary statistics
     */
    public function get_summary_stats( $start_date = null, $end_date = null ) {
        global $wpdb;
        
        $start_date = $start_date ?? date( 'Y-m-d', strtotime( '-90 days' ) );
        $end_date = $end_date ?? date( 'Y-m-d' );
        
        // Delivery stats
        $delivery_sql = "SELECT 
            COUNT(*) as session_count,
            SUM(actual_hours) as total_hours,
            SUM(actual_mol) as total_mol,
            SUM(kwh_consumed) as total_kwh,
            SUM(energy_cost) as total_cost
            FROM {$wpdb->prefix}gssh_light_delivery_log 
            WHERE venue_id = %s AND date BETWEEN %s AND %s";
        
        $delivery_stats = $wpdb->get_row( 
            $wpdb->prepare( $delivery_sql, $this->venue_id, $start_date, $end_date ), 
            ARRAY_A 
        );
        
        // Quality stats
        $quality_sql = "SELECT 
            COUNT(*) as observation_count,
            AVG(visual_rating) as avg_quality,
            MIN(visual_rating) as min_quality,
            MAX(visual_rating) as max_quality
            FROM {$wpdb->prefix}gssh_light_quality_log 
            WHERE venue_id = %s AND date BETWEEN %s AND %s";
        
        $quality_stats = $wpdb->get_row( 
            $wpdb->prepare( $quality_sql, $this->venue_id, $start_date, $end_date ), 
            ARRAY_A 
        );
        
        return [
            'period' => [
                'start' => $start_date,
                'end'   => $end_date,
            ],
            'delivery' => [
                'session_count' => (int) ( $delivery_stats['session_count'] ?? 0 ),
                'total_hours'   => round( (float) ( $delivery_stats['total_hours'] ?? 0 ), 1 ),
                'total_mol'     => round( (float) ( $delivery_stats['total_mol'] ?? 0 ), 1 ),
                'total_kwh'     => round( (float) ( $delivery_stats['total_kwh'] ?? 0 ), 1 ),
                'total_cost'    => round( (float) ( $delivery_stats['total_cost'] ?? 0 ), 2 ),
            ],
            'quality' => [
                'observation_count' => (int) ( $quality_stats['observation_count'] ?? 0 ),
                'avg_quality'       => $quality_stats['avg_quality'] ? round( (float) $quality_stats['avg_quality'], 1 ) : null,
                'min_quality'       => (int) ( $quality_stats['min_quality'] ?? 0 ),
                'max_quality'       => (int) ( $quality_stats['max_quality'] ?? 0 ),
            ],
        ];
    }
    
    /**
     * Get zone calibration
     */
    public function get_zone_calibration( $zone_id ) {
        global $wpdb;
        
        return $wpdb->get_row( $wpdb->prepare(
            "SELECT * FROM {$wpdb->prefix}gssh_light_calibration 
             WHERE venue_id = %s AND zone_id = %s AND status = 'active' 
             ORDER BY created_at DESC LIMIT 1",
            $this->venue_id,
            $zone_id
        ), ARRAY_A );
    }
}
