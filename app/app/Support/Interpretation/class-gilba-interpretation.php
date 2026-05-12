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

use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;

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
        $this->api_key = (string) config( 'services.gilba.claude_api_key', '' );

        if ( $this->api_key === '' && defined( 'GILBA_CLAUDE_API_KEY' ) ) {
            $this->api_key = (string) GILBA_CLAUDE_API_KEY;
        }
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
                'error'   => 'Claude API key not configured. Set GILBA_CLAUDE_API_KEY in the application environment.',
            ];
        }

        $cache_key = 'gilba_interp_' . md5( $prompt . $depth );
        $cached = Cache::get( $cache_key );
        
        if ( is_array( $cached ) ) {
            return array_merge( $cached, [ 'cached' => true ] );
        }

        try {
            $response = $this->call_claude( $prompt, $depth );
        } catch ( RuntimeException $e ) {
            return [
                'success' => false,
                'error'   => $e->getMessage(),
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

        Cache::put( $cache_key, $result, now()->addSeconds( $this->cache_ttl ) );
        
        return $result;
    }
    
    /**
     * Call Claude API
     * 
     * @param string $prompt The prompt to send
     * @param string $depth  'summary' or 'detailed'
     * @return array API response
     */
    private function call_claude( $prompt, $depth ) {

        $model = $depth === 'summary' 
            ? 'claude-haiku-4-5-20251001' 
            : 'claude-sonnet-4-5-20250929';

        $max_tokens = $depth === 'summary' ? 1000 : 1500;

        try {
            $response = Http::timeout( 30 )
                ->withHeaders( [
                    'anthropic-version' => '2023-06-01',
                    'x-api-key'         => $this->api_key,
                ] )
                ->asJson()
                ->post( $this->api_url, [
                    'model'      => $model,
                    'max_tokens' => $max_tokens,
                    'messages'   => [
                        [ 'role' => 'user', 'content' => $prompt ],
                    ],
                ] );
        } catch ( Throwable $e ) {
            error_log( '[Gilba Interpretation] API error: ' . $e->getMessage() );
            throw new RuntimeException( $e->getMessage(), 0, $e );
        }

        $body = $response->json();

        if ( ! $response->successful() ) {
            $error_msg = $body['error']['message'] ?? "API returned status {$response->status()}";
            error_log( '[Gilba Interpretation] API error: ' . $error_msg );
            throw new RuntimeException( $error_msg );
        }

        if ( isset( $body['error'] ) ) {
            throw new RuntimeException( (string) $body['error']['message'] );
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
        return Cache::forget( $cache_key );
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
