<?php
/**
 * Gilba AI Interpretation Service
 * 
 * Base class for Claude API integration.
 * Handles API calls, caching, and citation linking.
 * 
 * @package Gilba_Hub
 * @version 1.0.0
 * @since 10.4.0
 */

if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

class Gilba_Interpretation {
    
    /** @var string Claude API key */
    private $api_key;
    
    /** @var int Cache TTL in seconds (1 hour) */
    private $cache_ttl = 3600;
    
    /** @var string API endpoint */
    private $api_url = 'https://api.anthropic.com/v1/messages';
    
    /**
     * Constructor
     */
    public function __construct() {
        // API key must be defined in wp-config.php: define('GILBA_CLAUDE_API_KEY', 'sk-ant-...');
        $this->api_key = defined( 'GILBA_CLAUDE_API_KEY' ) ? GILBA_CLAUDE_API_KEY : '';
    }
    
    /**
     * Check if API is configured
     * 
     * @return bool
     */
    public function is_configured() {
        return ! empty( $this->api_key );
    }
    
    /**
     * Interpret with pre-built prompt
     * 
     * @param string $prompt      The full prompt to send
     * @param array  $citations   Citation registry for linking
     * @param string $depth       'summary' or 'detailed'
     * @return array Result with narrative, citations, cached flag
     */
    public function interpret_with_prompt($prompt, $citations = [], $depth = 'summary' ) {
        
        if ( ! $this->is_configured() ) {
            return [
                'success' => false,
                'error'   => 'Claude API key not configured. Add GILBA_CLAUDE_API_KEY to wp-config.php',
            ];
        }
        
        // Check cache
        $cache_key = 'gilba_interp_' . md5( $prompt . $depth );
        $cached = get_transient( $cache_key );
        
        if ( $cached !== false ) {
            return array_merge( $cached, [ 'cached' => true ] );
        }
        
        // Call Claude API
        $response = $this->call_claude( $prompt, $depth );
        
        if ( is_wp_error( $response ) ) {
            return [
                'success' => false,
                'error'   => $response->get_error_message(),
            ];
        }
        
        $narrative = $response['content'][0]['text'] ?? '';
        
        $result = [
            'success'   => true,
            'narrative' => $narrative,
            'citations' => $this->extract_used_citations( $narrative, $citations ),
            'model'     => $response['model'] ?? 'unknown',
            'cached'    => false,
        ];
        
        // Cache successful results
        set_transient( $cache_key, $result, $this->cache_ttl );
        
        return $result;
    }
    
    /**
     * Call Claude API
     * 
     * @param string $prompt The prompt to send
     * @param string $depth  'summary' or 'detailed'
     * @return array|WP_Error API response or error
     */
    private function call_claude( $prompt, $depth ) {
        
        // Use Haiku for speed/cost, Sonnet for detailed
        $model = $depth === 'summary' 
            ? 'claude-haiku-4-5-20251001' 
            : 'claude-sonnet-4-5-20250929';
        
        // 1000 tokens for summary, 1500 for detailed (water interpretations need more space)
        $max_tokens = $depth === 'summary' ? 1000 : 1500;
        
        $response = wp_remote_post( $this->api_url, [
            'timeout' => 30,
            'headers' => [
                'Content-Type'      => 'application/json',
                'x-api-key'         => $this->api_key,
                'anthropic-version' => '2023-06-01',
            ],
            'body' => wp_json_encode( [
                'model'      => $model,
                'max_tokens' => $max_tokens,
                'messages'   => [
                    [ 'role' => 'user', 'content' => $prompt ]
                ],
            ] ),
        ] );
        
        if ( is_wp_error( $response ) ) {
            error_log( '[Gilba Interpretation] API error: ' . $response->get_error_message() );
            return $response;
        }
        
        $code = wp_remote_retrieve_response_code( $response );
        $body = json_decode( wp_remote_retrieve_body( $response ), true );
        
        if ( $code !== 200 ) {
            $error_msg = $body['error']['message'] ?? "API returned status {$code}";
            error_log( '[Gilba Interpretation] API error: ' . $error_msg );
            return new WP_Error( 'claude_api_error', $error_msg );
        }
        
        if ( isset( $body['error'] ) ) {
            return new WP_Error( 'claude_api_error', $body['error']['message'] );
        }
        
        return $body;
    }
    
    /**
     * Extract citations used in narrative
     * 
     * Matches [citation-id] patterns and links to citation registry
     * 
     * @param string $narrative The narrative text
     * @param array  $citations Citation registry
     * @return array Used citations with metadata
     */
    private function extract_used_citations($narrative, $citations ) {
        
        preg_match_all( '/\[([a-z0-9\-_]+)\]/i', $narrative, $matches );
        
        $used = [];
        foreach ( array_unique( $matches[1] ?? [] ) as $ref ) {
            $ref_lower = strtolower( $ref );
            
            // Check for exact match or case-insensitive match
            if ( isset( $citations[ $ref ] ) ) {
                $used[ $ref ] = $citations[ $ref ];
            } elseif ( isset( $citations[ $ref_lower ] ) ) {
                $used[ $ref ] = $citations[ $ref_lower ];
            }
        }
        
        return $used;
    }
    
    /**
     * Clear cached interpretation
     *
     * @param string $prompt The prompt that was cached
     * @param string $depth  The depth level
     * @return bool Whether cache was cleared
     */
    public function clear_cache($prompt, $depth = 'summary' ) {
        $cache_key = 'gilba_interp_' . md5( $prompt . $depth );
        return delete_transient( $cache_key );
    }

    // =========================================================================
    // SHARED UTILITY METHODS
    // Used by Soil, Water, and Synthesis interpretation subclasses
    // =========================================================================

    /**
     * Coerce a value to a scalar string.
     *
     * Handles identity objects / arrays that the JS front-end may send
     * (e.g. { value: 'bermudagrass' }) so that downstream look-ups
     * and strtolower() calls never receive a non-scalar.
     *
     * @param mixed $value Raw value from context.
     * @return string
     */
    public function to_scalar( $value ) {
        if ( is_null( $value ) ) {
            return '';
        }
        if ( is_scalar( $value ) ) {
            return (string) $value;
        }
        if ( is_array( $value ) ) {
            if ( isset( $value['value'] ) ) {
                return $this->to_scalar( $value['value'] );
            }
            if ( isset( $value['name'] ) ) {
                return $this->to_scalar( $value['name'] );
            }
            if ( isset( $value['key'] ) ) {
                return $this->to_scalar( $value['key'] );
            }
            foreach ( $value as $v ) {
                if ( is_scalar( $v ) ) {
                    return (string) $v;
                }
            }
            return '';
        }
        if ( is_object( $value ) ) {
            if ( isset( $value->value ) ) {
                return $this->to_scalar( $value->value );
            }
            if ( isset( $value->name ) ) {
                return $this->to_scalar( $value->name );
            }
            return '';
        }
        return '';
    }

    /**
     * Detect current season from context.
     *
     * Uses latitude or region string to determine hemisphere,
     * then maps current month to season.
     *
     * @param array $context Context data with optional season, lat, latitude, region keys.
     * @return string Season name (spring, summer, autumn, winter)
     */
    public function detect_season( $context ) {
        if ( ! empty( $context['season'] ) ) {
            return $context['season'];
        }

        $lat = $context['lat'] ?? $context['latitude'] ?? null;
        $region = strtolower( $this->to_scalar( $context['region'] ?? '' ) );

        $is_southern = false;
        if ( $lat !== null && $lat < 0 ) {
            $is_southern = true;
        } elseif ( preg_match( '/^au-|australia|nz|new zealand|south africa|argentina|chile/i', $region ) ) {
            $is_southern = true;
        }

        $month = (int) date( 'n' );

        if ( $is_southern ) {
            if ( $month >= 12 || $month <= 2 ) return 'summer';
            if ( $month >= 3 && $month <= 5 ) return 'autumn';
            if ( $month >= 6 && $month <= 8 ) return 'winter';
            return 'spring';
        } else {
            if ( $month >= 3 && $month <= 5 ) return 'spring';
            if ( $month >= 6 && $month <= 8 ) return 'summer';
            if ( $month >= 9 && $month <= 11 ) return 'autumn';
            return 'winter';
        }
    }

    /**
     * Format turf type for display.
     *
     * @param string $turf_type Raw turf type key.
     * @return string Human-readable name.
     */
    public function format_turf_type( $turf_type ) {
        $map = [
            'creeping_bentgrass' => 'creeping bentgrass',
            'creepingBentgrass'  => 'creeping bentgrass',
            'perennialRyegrass'  => 'perennial ryegrass',
            'perennial_ryegrass' => 'perennial ryegrass',
            'Perennial Ryegrass' => 'perennial ryegrass',
            'poa_annua'          => 'Poa annua',
            'poaAnnua'           => 'Poa annua',
            'bermudagrass'       => 'bermudagrass',
            'bermuda'            => 'bermudagrass',
            'couch'              => 'couch grass',
            'kikuyu'             => 'kikuyu',
            'kentucky_bluegrass' => 'Kentucky bluegrass',
            'kentuckyBluegrass'  => 'Kentucky bluegrass',
            'fine_fescue'        => 'fine fescue',
            'fineFescue'         => 'fine fescue',
            'sports'             => 'sports turf',
            'golf_green'         => 'putting green',
            'golf_fairway'       => 'fairway',
        ];

        return $map[ $turf_type ] ?? str_replace( [ '_', '-' ], ' ', $turf_type );
    }

    /**
     * Format region code for display.
     *
     * @param string $region Raw region code.
     * @return string Human-readable region name.
     */
    public function format_region( $region ) {
        $map = [
            'AU'                    => 'Australia',
            'AU-VIC'                => 'Victoria, Australia',
            'au-vic'                => 'Victoria, Australia',
            'AU-NSW'                => 'New South Wales, Australia',
            'au-nsw'                => 'New South Wales, Australia',
            'AU-QLD'                => 'Queensland, Australia',
            'au-qld'                => 'Queensland, Australia',
            'AU-SA'                 => 'South Australia',
            'au-sa'                 => 'South Australia',
            'AU-WA'                 => 'Western Australia',
            'au-wa'                 => 'Western Australia',
            'australia'             => 'Australia',
            'australia_temperate'   => 'Temperate Australia',
            'australia_subtropical' => 'Subtropical Australia',
            'NZ'                    => 'New Zealand',
            'nz'                    => 'New Zealand',
            'new_zealand'           => 'New Zealand',
            'UK'                    => 'United Kingdom',
            'uk'                    => 'United Kingdom',
            'GB'                    => 'United Kingdom',
            'uk_southern'           => 'Southern England',
            'uk_northern'           => 'Northern England/Scotland',
            'JP'                    => 'Japan',
            'jp'                    => 'Japan',
            'EU'                    => 'Europe',
            'US'                    => 'United States',
            'SCAND'                 => 'Scandinavia',
            'temperate'             => 'temperate climate',
        ];

        return $map[ $region ] ?? ucwords( str_replace( [ '_', '-' ], ' ', $region ) );
    }
}
