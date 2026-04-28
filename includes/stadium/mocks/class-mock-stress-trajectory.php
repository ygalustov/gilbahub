<?php
/**
 * Mock Stress Trajectory
 * Provides basic stress trajectory calculations for standalone operation
 */

if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

class Gssh_Mock_Stress_Trajectory {
    
    public function calculate_trajectory( $params ) {
        $days = $params['days'] ?? 14;
        $start_health = $params['start_health'] ?? 85;
        $dli_deficit = $params['dli_deficit'] ?? 5;
        
        $trajectory = [];
        $health = $start_health;
        
        for ( $d = 0; $d < $days; $d++ ) {
            // Simple linear decline based on DLI deficit
            $daily_decline = $dli_deficit * 0.5;
            $health = max( 0, $health - $daily_decline );
            
            $trajectory[] = [
                'day'    => $d + 1,
                'health' => round( $health, 1 ),
                'status' => $health > 70 ? 'good' : ( $health > 40 ? 'stressed' : 'critical' ),
            ];
        }
        
        return [
            'trajectory' => $trajectory,
            'final_health' => $health,
            'days_to_critical' => $this->days_to_critical( $trajectory ),
        ];
    }
    
    private function days_to_critical( $trajectory ) {
        foreach ( $trajectory as $point ) {
            if ( $point['health'] <= 40 ) {
                return $point['day'];
            }
        }
        return null;
    }
    
    public function get_stress_factors( $params ) {
        return [
            'shade_stress'    => $params['shade_factor'] ?? 0.3,
            'heat_stress'     => $params['heat_factor'] ?? 0.1,
            'moisture_stress' => $params['moisture_factor'] ?? 0.1,
            'combined'        => 0.5,
        ];
    }
}
