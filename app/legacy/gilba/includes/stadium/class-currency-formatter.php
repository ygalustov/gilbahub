<?php
/**
 * Currency Formatter
 * 
 * Handles currency display formatting across different locales
 */

class Gssh_Currency_Formatter {
    
    private static $currencies;
    private $venue_currency;
    
    /**
     * Constructor
     * 
     * @param string $currency_code ISO 4217 currency code
     */
    public function __construct( $currency_code = 'AUD' ) {
        self::init_currencies();
        $this->venue_currency = self::$currencies[ $currency_code ] ?? self::$currencies['AUD'];
    }
    
    /**
     * Initialise currency definitions
     */
    private static function init_currencies() {
        if ( self::$currencies !== null ) {
            return;
        }
        
        self::$currencies = [
            'AUD' => [ 'code' => 'AUD', 'symbol' => '$',   'position' => 'before', 'decimals' => 2, 'name' => 'Australian Dollar' ],
            'NZD' => [ 'code' => 'NZD', 'symbol' => '$',   'position' => 'before', 'decimals' => 2, 'name' => 'New Zealand Dollar' ],
            'USD' => [ 'code' => 'USD', 'symbol' => '$',   'position' => 'before', 'decimals' => 2, 'name' => 'US Dollar' ],
            'GBP' => [ 'code' => 'GBP', 'symbol' => '£',   'position' => 'before', 'decimals' => 2, 'name' => 'British Pound' ],
            'EUR' => [ 'code' => 'EUR', 'symbol' => '€',   'position' => 'before', 'decimals' => 2, 'name' => 'Euro' ],
            'SGD' => [ 'code' => 'SGD', 'symbol' => '$',   'position' => 'before', 'decimals' => 2, 'name' => 'Singapore Dollar' ],
            'MYR' => [ 'code' => 'MYR', 'symbol' => 'RM',  'position' => 'before', 'decimals' => 2, 'name' => 'Malaysian Ringgit' ],
            'THB' => [ 'code' => 'THB', 'symbol' => '฿',   'position' => 'before', 'decimals' => 2, 'name' => 'Thai Baht' ],
            'IDR' => [ 'code' => 'IDR', 'symbol' => 'Rp',  'position' => 'before', 'decimals' => 0, 'name' => 'Indonesian Rupiah' ],
            'PHP' => [ 'code' => 'PHP', 'symbol' => '₱',   'position' => 'before', 'decimals' => 2, 'name' => 'Philippine Peso' ],
            'JPY' => [ 'code' => 'JPY', 'symbol' => '¥',   'position' => 'before', 'decimals' => 0, 'name' => 'Japanese Yen' ],
            'KRW' => [ 'code' => 'KRW', 'symbol' => '₩',   'position' => 'before', 'decimals' => 0, 'name' => 'South Korean Won' ],
            'HKD' => [ 'code' => 'HKD', 'symbol' => 'HK$', 'position' => 'before', 'decimals' => 2, 'name' => 'Hong Kong Dollar' ],
            'CNY' => [ 'code' => 'CNY', 'symbol' => '¥',   'position' => 'before', 'decimals' => 2, 'name' => 'Chinese Yuan' ],
            'INR' => [ 'code' => 'INR', 'symbol' => '₹',   'position' => 'before', 'decimals' => 2, 'name' => 'Indian Rupee' ],
            'AED' => [ 'code' => 'AED', 'symbol' => 'AED', 'position' => 'before', 'decimals' => 2, 'name' => 'UAE Dirham' ],
            'SAR' => [ 'code' => 'SAR', 'symbol' => 'SAR', 'position' => 'before', 'decimals' => 2, 'name' => 'Saudi Riyal' ],
            'QAR' => [ 'code' => 'QAR', 'symbol' => 'QAR', 'position' => 'before', 'decimals' => 2, 'name' => 'Qatari Riyal' ],
            'ZAR' => [ 'code' => 'ZAR', 'symbol' => 'R',   'position' => 'before', 'decimals' => 2, 'name' => 'South African Rand' ],
        ];
    }
    
    /**
     * Format a monetary value
     * 
     * @param float $amount The amount to format
     * @param bool  $include_code Whether to append currency code
     * @return string Formatted currency string
     */
    public function format( $amount, $include_code = false ) {
        $decimals = $this->venue_currency['decimals'];
        $symbol = $this->venue_currency['symbol'];
        $position = $this->venue_currency['position'];
        
        $formatted_number = number_format( $amount, $decimals, '.', ',' );
        
        if ( $position === 'before' ) {
            $result = $symbol . $formatted_number;
        } else {
            $result = $formatted_number . ' ' . $symbol;
        }
        
        if ( $include_code ) {
            $result .= ' ' . $this->venue_currency['code'];
        }
        
        return $result;
    }
    
    /**
     * Format a rate (per unit)
     * 
     * @param float  $rate The rate to format
     * @param string $unit The unit (e.g., 'kWh', 'hour')
     * @return string Formatted rate string
     */
    public function format_rate( $rate, $unit ) {
        return $this->format( $rate ) . '/' . $unit;
    }
    
    /**
     * Get currency symbol only
     * 
     * @return string
     */
    public function get_symbol() {
        return $this->venue_currency['symbol'];
    }
    
    /**
     * Get currency code
     * 
     * @return string
     */
    public function get_code() {
        return $this->venue_currency['code'];
    }
    
    /**
     * Get decimal places for this currency
     * 
     * @return int
     */
    public function get_decimals() {
        return $this->venue_currency['decimals'];
    }
    
    /**
     * Get all supported currencies for dropdown
     * 
     * @return array
     */
    public static function get_currency_options() {
        self::init_currencies();
        
        $options = [];
        foreach ( self::$currencies as $code => $currency ) {
            $options[ $code ] = $currency['name'] . ' (' . $currency['symbol'] . ')';
        }
        
        return $options;
    }
    
    /**
     * Get currency data by code
     * 
     * @param string $code
     * @return array|null
     */
    public static function get_currency( $code ) {
        self::init_currencies();
        return self::$currencies[ $code ] ?? null;
    }
    
    /**
     * Get currencies grouped by region
     * 
     * @return array
     */
    public static function get_currencies_by_region() {
        self::init_currencies();
        
        $regions = [
            'Oceania'     => [ 'AUD', 'NZD' ],
            'Asia'        => [ 'SGD', 'MYR', 'THB', 'IDR', 'PHP', 'JPY', 'KRW', 'HKD', 'CNY', 'INR' ],
            'Middle East' => [ 'AED', 'SAR', 'QAR' ],
            'Europe'      => [ 'GBP', 'EUR' ],
            'Americas'    => [ 'USD' ],
            'Africa'      => [ 'ZAR' ],
        ];
        
        $grouped = [];
        foreach ( $regions as $region => $codes ) {
            $grouped[ $region ] = [];
            foreach ( $codes as $code ) {
                if ( isset( self::$currencies[ $code ] ) ) {
                    $grouped[ $region ][ $code ] = self::$currencies[ $code ];
                }
            }
        }
        
        return $grouped;
    }
}
