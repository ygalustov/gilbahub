<?php
/**
 * Hub Climate Adapter
 * 
 * Bridges the Supplemental Light module to the Hub's Climate Engine.
 * Falls back to estimated data if Hub is not available.
 */

if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

class Gssh_Hub_Climate_Adapter {
    
    /**
     * Check if Hub climate is available
     */
    private function is_hub_available() {
        return function_exists( 'gssh_climate_fetch' ) || 
               ( isset( $GLOBALS['gssh_climate_engine'] ) && is_object( $GLOBALS['gssh_climate_engine'] ) );
    }
    
    /**
     * Get solar radiation for a date.
     *
     * When the Hub AJAX handler forwards real Open-Meteo data via POST
     * (hub_dli, hub_ghi), use it directly. Fall back to the astronomical
     * estimator only when no real data is available.
     *
     * @param string $date     Date in Y-m-d format
     * @param array  $location Location with lat/lng
     * @return array Solar radiation data
     */
    public function get_solar_radiation( $date, $location ) {

        // --- Real data forwarded from the Hub's Open-Meteo fetch ---
        $hub_dli = isset( $GLOBALS['gssh_hub_dli'] ) ? floatval( $GLOBALS['gssh_hub_dli'] ) : null;
        $hub_ghi = isset( $GLOBALS['gssh_hub_ghi'] ) ? floatval( $GLOBALS['gssh_hub_ghi'] ) : null;

        if ( $hub_dli !== null && $hub_dli > 0 ) {
            // Derive GHI from DLI if not separately forwarded
            // DLI (mol/m²/day) = GHI (MJ/m²/day) × 4.6 × 0.45  →  GHI = DLI / (4.6 × 0.45)
            $ghi = ( $hub_ghi !== null && $hub_ghi > 0 )
                ? $hub_ghi
                : round( $hub_dli / ( 4.6 * 0.45 ), 1 );

            return [
                'date'        => $date,
                'ghi_daily'   => $ghi,
                'ghi_unit'    => 'mj',
                'cloud_cover' => null,
                'is_forecast' => false,
                'days_ahead'  => 0,
                'source'      => 'hub_live',   // Open-Meteo via JS bridge
                'hub_dli'     => $hub_dli,
            ];
        }

        // --- Fallback: astronomical estimator ---
        $day_of_year = intval( date( 'z', strtotime( $date ) ) ) + 1;
        $lat = isset( $location['lat'] ) ? floatval( $location['lat'] ) : 0;
        $lng = isset( $location['lng'] ) ? floatval( $location['lng'] ) : 0;
        
        // Southern hemisphere: peak around day 355 (late Dec)
        // Northern hemisphere: peak around day 172 (late June)
        $is_southern = $lat < 0;
        $peak_day = $is_southern ? 355 : 172;
        
        $phase = ( $day_of_year - $peak_day ) * ( 2 * M_PI / 365 );
        $seasonal_factor = 0.5 + 0.5 * cos( $phase );
        
        // Base GHI at peak summer (MJ/m²/day)
        // Tropical (0°): ~22 MJ, Temperate (35°): ~26 MJ, High lat (55°): ~20 MJ
        // Peak is actually around 30-35° latitude due to clear skies
        $abs_lat = abs( $lat );
        if ( $abs_lat < 25 ) {
            // Tropical - high but more clouds
            $base_ghi = 24;
        } elseif ( $abs_lat < 40 ) {
            // Subtropical/warm temperate - peak solar
            $base_ghi = 28;
        } elseif ( $abs_lat < 50 ) {
            // Cool temperate
            $base_ghi = 24;
        } else {
            // High latitude
            $base_ghi = 18;
        }
        
        // Seasonal variation: summer = base, winter = 35-50% of base depending on latitude
        $winter_fraction = max( 0.25, 0.6 - ( $abs_lat * 0.007 ) );
        $ghi_range = $base_ghi * ( 1 - $winter_fraction );
        $ghi = ( $base_ghi * $winter_fraction ) + ( $ghi_range * $seasonal_factor );
        
        // Regional cloud adjustment
        $region = $this->detect_climate_region( $lat, $lng );
        $cloud_cover = $this->estimate_cloud_cover( $region, $day_of_year );
        $ghi = $ghi * ( 1 - ( $cloud_cover * 0.005 ) ); // Reduced cloud impact
        
        return [
            'date'        => $date,
            'ghi_daily'   => round( max( 2, $ghi ), 1 ),
            'ghi_unit'    => 'mj',
            'cloud_cover' => $cloud_cover,
            'is_forecast' => strtotime( $date ) > time(),
            'days_ahead'  => max( 0, ( strtotime( $date ) - time() ) / 86400 ),
            'source'      => 'estimated',
            'region'      => $region,
        ];
    }
    
    /**
     * Get forecast for multiple days
     */
    public function get_forecast( $location, $days ) {
        $forecast = [];
        for ( $d = 0; $d < $days; $d++ ) {
            $date = date( 'Y-m-d', strtotime( '+' . $d . ' days' ) );
            $forecast[] = $this->get_solar_radiation( $date, $location );
        }
        return $forecast;
    }
    
    /**
     * Detect climate region from coordinates
     */
    private function detect_climate_region( $lat, $lng ) {
        $abs_lat = abs( $lat );
        
        // Tropical
        if ( $abs_lat < 23.5 ) {
            return 'tropical';
        }
        
        // Subtropical
        if ( $abs_lat < 35 ) {
            return 'subtropical';
        }
        
        // Warm temperate
        if ( $abs_lat < 45 ) {
            return 'warm-temperate';
        }
        
        // Cool temperate
        if ( $abs_lat < 55 ) {
            return 'cool-temperate';
        }
        
        return 'cold';
    }
    
    /**
     * Get regional solar modifier
     */
    private function get_regional_modifier( $region ) {
        $modifiers = [
            'tropical'       => 1.1,
            'subtropical'    => 1.0,
            'warm-temperate' => 0.95,
            'cool-temperate' => 0.85,
            'cold'           => 0.75,
        ];
        
        return $modifiers[ $region ] ?? 1.0;
    }
    
    /**
     * Estimate cloud cover by region and season
     */
    private function estimate_cloud_cover( $region, $day_of_year ) {
        // Base cloud cover by region
        $base_cover = [
            'tropical'       => 45,
            'subtropical'    => 35,
            'warm-temperate' => 40,
            'cool-temperate' => 55,
            'cold'           => 60,
        ];
        
        $base = $base_cover[ $region ] ?? 40;
        
        // Seasonal variation (more clouds in winter for most regions)
        $seasonal_offset = 10 * cos( ( $day_of_year - 172 ) * 2 * M_PI / 365 );
        
        return max( 10, min( 90, $base + $seasonal_offset ) );
    }
    
    /**
     * Get average temperature for a location/date
     */
    public function get_temperature( $date, $location ) {
        $day_of_year = intval( date( 'z', strtotime( $date ) ) ) + 1;
        $lat = isset( $location['lat'] ) ? floatval( $location['lat'] ) : 0;
        
        $is_southern = $lat < 0;
        $peak_day = $is_southern ? 355 : 172;
        
        $phase = ( $day_of_year - $peak_day ) * ( 2 * M_PI / 365 );
        $seasonal_factor = 0.5 + 0.5 * cos( $phase );
        
        // Base temperature varies with latitude
        $abs_lat = abs( $lat );
        $base_temp = 30 - ( $abs_lat * 0.5 );
        $amplitude = 15 - ( $abs_lat * 0.1 );
        
        $temp = $base_temp - $amplitude + ( 2 * $amplitude * $seasonal_factor );
        
        return [
            'date'     => $date,
            'temp_avg' => round( $temp, 1 ),
            'temp_max' => round( $temp + 6, 1 ),
            'temp_min' => round( $temp - 6, 1 ),
            'unit'     => 'celsius',
        ];
    }
}
