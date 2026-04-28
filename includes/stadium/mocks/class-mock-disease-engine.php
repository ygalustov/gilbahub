<?php
/**
 * Mock Disease Engine
 * Provides basic disease risk calculations for standalone operation
 */

if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

class Gssh_Mock_Disease_Engine {
    
    public function calculate_risk( $params ) {
        $temp = $params['temperature'] ?? 20;
        $humidity = $params['humidity'] ?? 70;
        $shade_hours = $params['shade_hours'] ?? 8;
        
        // Base risk increases with shade
        $shade_risk = min( 1, $shade_hours / 12 ) * 0.4;
        
        // Temperature risk (peak around 25-30C)
        $temp_risk = 0;
        if ( $temp >= 20 && $temp <= 35 ) {
            $temp_risk = 0.3 * ( 1 - abs( $temp - 27.5 ) / 12.5 );
        }
        
        // Humidity risk
        $humidity_risk = max( 0, ( $humidity - 60 ) / 40 ) * 0.3;
        
        $total_risk = min( 1, $shade_risk + $temp_risk + $humidity_risk );
        
        return [
            'total_risk'    => round( $total_risk, 2 ),
            'risk_level'    => $this->get_risk_level( $total_risk ),
            'shade_risk'    => round( $shade_risk, 2 ),
            'temp_risk'     => round( $temp_risk, 2 ),
            'humidity_risk' => round( $humidity_risk, 2 ),
            'diseases'      => $this->get_likely_diseases( $total_risk, $temp ),
        ];
    }
    
    private function get_risk_level( $risk ) {
        if ( $risk < 0.25 ) return 'low';
        if ( $risk < 0.5 ) return 'moderate';
        if ( $risk < 0.75 ) return 'high';
        return 'severe';
    }
    
    private function get_likely_diseases( $risk, $temp ) {
        $diseases = [];
        
        if ( $risk > 0.3 ) {
            if ( $temp > 25 ) {
                $diseases[] = [ 'name' => 'Pythium', 'risk' => 'moderate' ];
            }
            if ( $temp < 20 ) {
                $diseases[] = [ 'name' => 'Fusarium', 'risk' => 'moderate' ];
            }
            $diseases[] = [ 'name' => 'Dollar Spot', 'risk' => $risk > 0.5 ? 'high' : 'low' ];
        }
        
        return $diseases;
    }
}
