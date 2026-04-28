<?php
/**
 * Mock Climate Module
 * Wrapper around Hub Climate Adapter for backward compatibility
 */

if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

class Gssh_Mock_Climate_Module {
    
    private $adapter;
    
    public function __construct() {
        $this->adapter = new Gssh_Hub_Climate_Adapter();
    }
    
    public function get_solar_radiation( $date, $location ) {
        return $this->adapter->get_solar_radiation( $date, $location );
    }
    
    public function get_forecast( $location, $days ) {
        return $this->adapter->get_forecast( $location, $days );
    }
    
    public function get_temperature( $date, $location ) {
        return $this->adapter->get_temperature( $date, $location );
    }
}
