<?php
/**
 * Ambient DLI Estimator
 * 
 * Converts solar radiation data to photosynthetically active radiation (PAR)
 * and calculates daily light integral (DLI) for turf management.
 */

class Gssh_Ambient_DLI_Estimator {
    
    const PAR_FRACTION_CLEAR = 0.45;
    const PAR_FRACTION_OVERCAST = 0.55;
    const PAR_FRACTION_DEFAULT = 0.48;
    const PPFD_CONVERSION_FACTOR = 4.57;
    const SECONDS_PER_HOUR = 3600;
    const MICROMOL_TO_MOL = 0.000001;
    
    private $climate_module;
    
    /**
     * Constructor
     * 
     * @param object $climate_module Climate module instance
     */
    public function __construct( $climate_module ) {
        $this->climate_module = $climate_module;
    }
    
    /**
     * Get DLI for a specific date
     * 
     * @param string $date Date in Y-m-d format
     * @param array  $location [lat, lng]
     * @return array DLI data with source attribution
     */
    public function get_daily_dli( $date, $location ) {
        $solar_data = $this->climate_module->get_solar_radiation( $date, $location );
        
        if ( ! $solar_data || ! isset( $solar_data['ghi_daily'] ) ) {
            return $this->estimate_dli_clear_sky_model( $date, $location );
        }
        
        return $this->estimate_dli_from_ghi( $date, $location, $solar_data );
    }
    
    /**
     * Estimate DLI from Global Horizontal Irradiance
     * 
     * @param string $date
     * @param array  $location
     * @param array  $solar_data
     * @return array
     */
    private function estimate_dli_from_ghi( $date, $location, $solar_data ) {
        $ghi_mj = $this->normalise_ghi_to_mj( $solar_data );
        $par_fraction = $this->determine_par_fraction( $solar_data );
        $par_mj = $ghi_mj * $par_fraction;
        $dli = $par_mj * self::PPFD_CONVERSION_FACTOR;
        $confidence = $this->assess_estimate_confidence( $solar_data );
        
        return [
            'date'         => $date,
            'dli'          => round( $dli, 1 ),
            'source'       => 'estimated',
            'confidence'   => $confidence,
            'method'       => 'GHI to PAR conversion',
            'ghi_mj'       => round( $ghi_mj, 2 ),
            'par_fraction' => $par_fraction,
            'cloud_cover'  => $solar_data['cloud_cover'] ?? null,
        ];
    }
    
    /**
     * Normalise GHI to MJ/m²/day
     * 
     * @param array $solar_data
     * @return float
     */
    private function normalise_ghi_to_mj( $solar_data ) {
        $value = $solar_data['ghi_daily'];
        $unit = $solar_data['ghi_unit'] ?? 'mj';
        
        switch ( strtolower( $unit ) ) {
            case 'kwh':
            case 'kwh/m2':
                return $value * 3.6;
            case 'wh':
            case 'wh/m2':
                return $value * 0.0036;
            case 'j':
            case 'j/m2':
                return $value / 1000000;
            case 'mj':
            case 'mj/m2':
            default:
                return $value;
        }
    }
    
    /**
     * Determine PAR fraction based on cloud cover
     * 
     * @param array $solar_data
     * @return float
     */
    private function determine_par_fraction( $solar_data ) {
        if ( ! isset( $solar_data['cloud_cover'] ) ) {
            return self::PAR_FRACTION_DEFAULT;
        }
        
        $cloud_cover = $solar_data['cloud_cover'];
        
        $fraction = self::PAR_FRACTION_CLEAR + 
            ( $cloud_cover / 100 ) * ( self::PAR_FRACTION_OVERCAST - self::PAR_FRACTION_CLEAR );
        
        return round( $fraction, 3 );
    }
    
    /**
     * Estimate DLI using clear-sky model
     * 
     * @param string $date
     * @param array  $location
     * @return array
     */
    public function estimate_dli_clear_sky_model( $date, $location ) {
        $lat = $location['lat'];
        $day_of_year = date( 'z', strtotime( $date ) ) + 1;
        
        // Solar declination
        $declination = 0.409 * sin( ( 2 * M_PI / 365 ) * $day_of_year - 1.39 );
        $lat_rad = deg2rad( $lat );
        
        // Sunset hour angle
        $tan_product = -tan( $lat_rad ) * tan( $declination );
        
        if ( $tan_product <= -1 ) {
            $hour_angle = M_PI; // Polar day
        } elseif ( $tan_product >= 1 ) {
            $hour_angle = 0; // Polar night
        } else {
            $hour_angle = acos( $tan_product );
        }
        
        // Day length
        $day_length = ( 24 / M_PI ) * $hour_angle;
        
        // Extraterrestrial radiation
        $solar_constant = 4.921;
        $dr = 1 + 0.033 * cos( ( 2 * M_PI / 365 ) * $day_of_year );
        
        $ra = ( 24 / M_PI ) * $solar_constant * $dr * (
            $hour_angle * sin( $lat_rad ) * sin( $declination ) +
            cos( $lat_rad ) * cos( $declination ) * sin( $hour_angle )
        );
        
        // Clear sky transmissivity
        $clear_sky_transmissivity = 0.75;
        $ghi_mj = $ra * $clear_sky_transmissivity;
        
        // Apply cloud reduction estimate
        $cloud_reduction = $this->get_typical_cloud_reduction( $lat, (int) date( 'n', strtotime( $date ) ) );
        $ghi_mj = $ghi_mj * ( 1 - $cloud_reduction );
        
        $dli = $ghi_mj * self::PAR_FRACTION_DEFAULT * self::PPFD_CONVERSION_FACTOR;
        
        return [
            'date'         => $date,
            'dli'          => round( max( 0, $dli ), 1 ),
            'source'       => 'modelled',
            'confidence'   => 'low',
            'method'       => 'Clear-sky astronomical model',
            'day_length'   => round( $day_length, 1 ),
            'note'         => 'Estimated from astronomical model with regional cloud adjustment',
        ];
    }
    
    /**
     * Get typical cloud reduction by latitude and month
     * 
     * @param float $lat
     * @param int   $month
     * @return float
     */
    private function get_typical_cloud_reduction( $lat, $month ) {
        $abs_lat = abs( $lat );
        
        if ( $abs_lat < 23.5 ) {
            // Tropical
            $summer_months = ( $lat >= 0 ) ? [ 6, 7, 8, 9 ] : [ 12, 1, 2, 3 ];
            return in_array( $month, $summer_months ) ? 0.35 : 0.25;
        }
        
        if ( $abs_lat < 35 ) {
            // Subtropical
            return 0.25;
        }
        
        if ( $abs_lat < 55 ) {
            // Temperate
            $winter_months = ( $lat >= 0 ) ? [ 11, 12, 1, 2 ] : [ 5, 6, 7, 8 ];
            return in_array( $month, $winter_months ) ? 0.45 : 0.30;
        }
        
        // High latitude
        return 0.50;
    }
    
    /**
     * Assess confidence of estimate
     * 
     * @param array $solar_data
     * @return string
     */
    private function assess_estimate_confidence( $solar_data ) {
        if ( isset( $solar_data['data_age_hours'] ) && $solar_data['data_age_hours'] > 6 ) {
            return 'low';
        }
        
        if ( isset( $solar_data['is_forecast'] ) && $solar_data['is_forecast'] ) {
            $days_ahead = $solar_data['days_ahead'] ?? 0;
            if ( $days_ahead <= 2 ) {
                return 'medium';
            }
            return 'low';
        }
        
        return 'medium';
    }
    
    /**
     * Get 14-day DLI forecast
     * 
     * @param array $location
     * @return array
     */
    public function get_dli_forecast( $location ) {
        $forecast = [];
        
        for ( $day = 0; $day < 14; $day++ ) {
            $date = date( 'Y-m-d', strtotime( "+{$day} days" ) );
            $dli_data = $this->get_daily_dli( $date, $location );
            
            $forecast[] = [
                'date'       => $date,
                'day_index'  => $day,
                'dli'        => $dli_data['dli'],
                'source'     => $dli_data['source'],
                'confidence' => $dli_data['confidence'],
            ];
        }
        
        $dli_values = array_column( $forecast, 'dli' );
        
        return [
            'location'        => $location,
            'generated_at'    => date( DATE_ATOM ),
            'forecast_days'   => 14,
            'daily_dli'       => $forecast,
            'period_average'  => round( array_sum( $dli_values ) / 14, 1 ),
            'period_minimum'  => min( $dli_values ),
            'period_maximum'  => max( $dli_values ),
        ];
    }
    
    /**
     * Get historical DLI statistics
     * 
     * @param array  $location
     * @param string $period
     * @return array
     */
    public function get_historical_dli_statistics( $location, $period = 'monthly' ) {
        $statistics = [];
        
        for ( $month = 1; $month <= 12; $month++ ) {
            $representative_date = date( 'Y' ) . '-' . str_pad( $month, 2, '0', STR_PAD_LEFT ) . '-15';
            $clear_sky = $this->estimate_dli_clear_sky_model( $representative_date, $location );
            
            $statistics[ $month ] = [
                'month'         => $month,
                'month_name'    => date( 'F', strtotime( $representative_date ) ),
                'typical_dli'   => $clear_sky['dli'],
                'day_length'    => $clear_sky['day_length'],
            ];
        }
        
        return [
            'location'   => $location,
            'period'     => $period,
            'statistics' => $statistics,
        ];
    }
}
