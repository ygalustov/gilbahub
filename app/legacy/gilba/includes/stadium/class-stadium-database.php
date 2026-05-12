<?php
/**
 * Australian Stadium Geometry Database
 * 
 * Pre-configured stadium geometry data for major Australian venues.
 * Provides structure definitions (stands, roofs) for shade calculations.
 * 
 * Data sources:
 * - Official stadium specifications and fact sheets
 * - Construction and engineering documentation
 * - Architectural drawings and planning documents
 * - Satellite imagery analysis for orientation
 * 
 * Accuracy notes:
 * - Heights marked with (*) are derived from roof climb heights, 
 *   planning documents, or engineering specifications
 * - Heights marked with (~) are estimated from stadium tier counts,
 *   photos with known reference points, or similar venue comparisons
 * - All dimensions in metres
 * - Positions relative to pitch/field centre (0,0)
 * - Coordinate system: +X = East, +Y = North
 * 
 * @package Gssh_Stadium
 * @version 1.0.0
 */

if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

class Gssh_Stadium_Database {
    
    /**
     * Stadium registry (built-in venues)
     * 
     * @var array
     */
    private static $stadiums = [];
    
    /**
     * Custom stadium registry (user-added venues)
     * 
     * @var array
     */
    private static $custom_stadiums = [];
    
    /**
     * WordPress option name for custom stadiums
     */
    const CUSTOM_STADIUMS_OPTION = 'gssh_custom_stadiums';
    
    /**
     * Data quality flags
     */
    const QUALITY_VERIFIED   = 'verified';   // From official specs
    const QUALITY_DERIVED    = 'derived';    // Calculated from related data
    const QUALITY_ESTIMATED  = 'estimated';  // Best estimate from photos/comparisons
    const QUALITY_USER       = 'user';       // Manually entered by user
    
    /**
     * Get stadium configuration
     * 
     * Checks custom (user-added) stadiums first, then built-in database.
     * 
     * @param string $venue_id Stadium identifier
     * @return array|null Stadium configuration or null if not found
     */
    public static function get_stadium( string $venue_id ): ?array {
        self::init_stadiums();
        self::load_custom_stadiums();
        
        // Check custom stadiums first (allows overriding built-in data)
        if ( isset( self::$custom_stadiums[ $venue_id ] ) ) {
            return self::$custom_stadiums[ $venue_id ];
        }
        
        return self::$stadiums[ $venue_id ] ?? null;
    }
    
    /**
     * Get all stadium IDs
     * 
     * @param bool $include_custom Include user-added stadiums (default true)
     * @return array
     */
    public static function get_stadium_ids( bool $include_custom = true ): array {
        self::init_stadiums();
        
        $ids = array_keys( self::$stadiums );
        
        if ( $include_custom ) {
            self::load_custom_stadiums();
            $ids = array_merge( $ids, array_keys( self::$custom_stadiums ) );
        }
        
        return array_unique( $ids );
    }
    
    /**
     * Get all stadiums
     * 
     * @param bool $include_custom Include custom user-defined stadiums
     * @return array All stadium data keyed by venue_id
     */
    public static function get_all_stadiums( bool $include_custom = true ): array {
        self::init_stadiums();
        
        $all = self::$stadiums;
        
        if ( $include_custom ) {
            self::load_custom_stadiums();
            $all = array_merge( $all, self::$custom_stadiums );
        }
        
        return $all;
    }
    
    /**
     * Get stadiums by state
     * 
     * @param string $state State code (VIC, NSW, QLD, SA, WA, TAS, ACT, NT)
     * @return array
     */
    public static function get_stadiums_by_state( string $state ): array {
        self::init_stadiums();
        return array_filter( self::$stadiums, function( $stadium ) use ( $state ) {
            return ( $stadium['location']['state'] ?? '' ) === $state;
        });
    }
    
    /**
     * Get stadiums by type
     * 
     * @param string $type 'oval' or 'rectangular'
     * @return array
     */
    public static function get_stadiums_by_type( string $type ): array {
        self::init_stadiums();
        return array_filter( self::$stadiums, function( $stadium ) use ( $type ) {
            return ( $stadium['field']['type'] ?? '' ) === $type;
        });
    }
    
    /**
     * Search stadiums by name
     * 
     * @param string $query Search query
     * @return array Matching stadiums
     */
    public static function search( string $query ): array {
        self::init_stadiums();
        $query = strtolower( $query );
        
        return array_filter( self::$stadiums, function( $stadium ) use ( $query ) {
            $searchable = strtolower( 
                $stadium['name'] . ' ' . 
                ( $stadium['common_names'] ?? '' ) . ' ' .
                ( $stadium['location']['city'] ?? '' )
            );
            return strpos( $searchable, $query ) !== false;
        });
    }
    
    /**
     * Get structures for shade calculations
     * 
     * @param string $venue_id
     * @return array Structures in shade engine format
     */
    public static function get_structures( string $venue_id ): array {
        $stadium = self::get_stadium( $venue_id );
        if ( ! $stadium ) {
            return [];
        }
        return $stadium['structures'] ?? [];
    }
    
    /**
     * Get location for a stadium
     * 
     * @param string $venue_id
     * @return array Location in shade engine format
     */
    public static function get_location( string $venue_id ): array {
        $stadium = self::get_stadium( $venue_id );
        if ( ! $stadium ) {
            return [];
        }
        
        $loc = $stadium['location'];
        return [
            'lat'               => $loc['lat'],
            'lng'               => $loc['lng'],
            'timezone'          => $loc['timezone'],
            'pitch_orientation' => $stadium['field']['orientation'] ?? 0,
        ];
    }
    
    /**
     * Get field/pitch dimensions
     * 
     * @param string $venue_id
     * @return array Field dimensions
     */
    public static function get_field_dimensions( string $venue_id ): array {
        $stadium = self::get_stadium( $venue_id );
        if ( ! $stadium ) {
            return [];
        }
        return $stadium['field'] ?? [];
    }
    
    /**
     * Get turf/grass information for a venue
     * 
     * @param string $venue_id
     * @return array|null Turf info or null if not specified
     */
    public static function get_turf_info( string $venue_id ): ?array {
        $stadium = self::get_stadium( $venue_id );
        if ( ! $stadium || ! isset( $stadium['turf'] ) ) {
            return null;
        }
        return $stadium['turf'];
    }
    
    /**
     * Get active turf variety for a venue
     * 
     * Considers oversowing based on current month.
     * 
     * @param string $venue_id
     * @param int|null $month Month to check (default: current month)
     * @return array [ 'variety' => string, 'variety_name' => string, 'is_oversown' => bool ]
     */
    public static function get_active_variety( string $venue_id, ?int $month = null ): array {
        $default = [
            'variety'      => 'unknown',
            'variety_name' => 'Unknown',
            'is_oversown'  => false,
        ];
        
        try {
            $turf = self::get_turf_info( $venue_id );
            $month = $month ?? (int) date( 'n' );
            
            if ( ! $turf ) {
                return $default;
            }
            
            // Normalise legacy 'oversow_*' typo keys → 'overseed_*' for backward compat
            if ( empty( $turf['overseed_variety'] ) && ! empty( $turf['oversow_variety'] ) ) {
                $turf['overseed_variety'] = $turf['oversow_variety'];
            }
            if ( empty( $turf['overseed_months'] ) && ! empty( $turf['oversow_months'] ) ) {
                $turf['overseed_months'] = $turf['oversow_months'];
            }

            // Check if currently oversown — supports three formats:
            //   1. permanent_overseed: true  — overseed active year-round
            //   2. overseed_months: [3,4,5,6,7,8,9]  — explicit month array
            //   3. overseed_period: { start_month, end_month }  — inclusive range
            $is_oversown = false;
            if ( ! empty( $turf['oversown'] ) ) {
                if ( ! empty( $turf['permanent_overseed'] ) ) {
                    $is_oversown = true;
                } elseif ( ! empty( $turf['overseed_months'] ) && is_array( $turf['overseed_months'] ) ) {
                    $is_oversown = in_array( $month, $turf['overseed_months'], true );
                } elseif ( ! empty( $turf['overseed_period'] ) && is_array( $turf['overseed_period'] ) ) {
                    $start = (int) ( $turf['overseed_period']['start_month'] ?? 1 );
                    $end   = (int) ( $turf['overseed_period']['end_month']   ?? 12 );
                    $is_oversown = ( $month >= $start && $month <= $end );
                }
            }

            if ( $is_oversown && ! empty( $turf['overseed_variety'] ) ) {
                // Return overseed variety as the active one
                return [
                    'variety'        => $turf['overseed_variety'],
                    'variety_name'   => ucwords( str_replace( '_', ' ', $turf['overseed_variety'] ) ),
                    'is_oversown'    => true,
                    'permanent'      => ! empty( $turf['permanent_overseed'] ),
                    'base_variety'   => $turf['variety'] ?? 'unknown',
                ];
            }
            
            return [
                'variety'      => $turf['variety'] ?? 'unknown',
                'variety_name' => $turf['variety_name'] ?? 'Unknown',
                'is_oversown'  => false,
            ];
        } catch ( Exception $e ) {
            return $default;
        }
    }
    
    // =========================================================================
    // MANUAL STADIUM ENTRY METHODS
    // =========================================================================
    
    /**
     * Add or update a custom stadium
     * 
     * Allows users to manually enter stadium geometry when not available
     * in the built-in database.
     * 
     * @param string $venue_id Unique identifier (lowercase, underscores)
     * @param array  $config   Stadium configuration
     * @return bool Success
     */
    public static function save_custom_stadium( string $venue_id, array $config ): bool {
        self::load_custom_stadiums();
        
        // Validate required fields
        if ( empty( $config['name'] ) || 
             empty( $config['location']['lat'] ) || 
             empty( $config['location']['lng'] ) ) {
            return false;
        }
        
        // Sanitise venue_id
        $venue_id = sanitize_key( $venue_id );
        
        // Mark all structures as user-entered quality
        if ( ! empty( $config['structures'] ) ) {
            foreach ( $config['structures'] as &$structure ) {
                if ( ! isset( $structure['height_quality'] ) ) {
                    $structure['height_quality'] = self::QUALITY_USER;
                }
            }
        }
        
        // Store with metadata
        $config['_custom']     = true;
        $config['_created']    = self::$custom_stadiums[ $venue_id ]['_created'] ?? current_time( 'mysql' );
        $config['_modified']   = current_time( 'mysql' );
        
        self::$custom_stadiums[ $venue_id ] = $config;
        
        return update_option( self::CUSTOM_STADIUMS_OPTION, self::$custom_stadiums );
    }
    
    /**
     * Delete a custom stadium
     * 
     * @param string $venue_id
     * @return bool Success
     */
    public static function delete_custom_stadium( string $venue_id ): bool {
        self::load_custom_stadiums();
        
        if ( ! isset( self::$custom_stadiums[ $venue_id ] ) ) {
            return false;
        }
        
        unset( self::$custom_stadiums[ $venue_id ] );
        
        return update_option( self::CUSTOM_STADIUMS_OPTION, self::$custom_stadiums );
    }
    
    /**
     * Get all custom stadiums
     * 
     * @return array
     */
    public static function get_custom_stadiums(): array {
        self::load_custom_stadiums();
        return self::$custom_stadiums;
    }
    
    /**
     * Check if a stadium is custom (user-added)
     * 
     * @param string $venue_id
     * @return bool
     */
    public static function is_custom_stadium( string $venue_id ): bool {
        self::load_custom_stadiums();
        return isset( self::$custom_stadiums[ $venue_id ] );
    }
    
    /**
     * Load custom stadiums from WordPress options
     */
    private static function load_custom_stadiums(): void {
        if ( ! empty( self::$custom_stadiums ) ) {
            return;
        }
        
        self::$custom_stadiums = get_option( self::CUSTOM_STADIUMS_OPTION, [] );
    }
    
    /**
     * Estimate stand height from tier count
     * 
     * Useful for manual entry when exact heights are unknown.
     * 
     * Assumptions:
     * - Each seating tier is approximately 8-10m high
     * - Concourse levels add 3-4m each
     * - Roof adds 3-5m above top seating tier
     * 
     * @param int  $tiers           Number of seating tiers (1-4)
     * @param bool $has_concourse   Has internal concourse levels
     * @param bool $has_roof        Has roof structure
     * @return float Estimated height in metres
     */
    public static function estimate_height_from_tiers( 
        int $tiers, 
        bool $has_concourse = true, 
        bool $has_roof = true 
    ): float {
        
        // Base tier heights (vary by tier - lower tiers often shorter)
        $tier_heights = [
            1 => 8,    // Single tier - typically 8m
            2 => 18,   // Two tier - typically 10m + 8m
            3 => 30,   // Three tier - typically 12m + 10m + 8m  
            4 => 42,   // Four tier - rare, typically 12m + 12m + 10m + 8m
        ];
        
        $height = $tier_heights[ min( $tiers, 4 ) ] ?? 8;
        
        // Add concourse height if applicable
        if ( $has_concourse && $tiers > 1 ) {
            $height += ( $tiers - 1 ) * 3.5;  // 3.5m per concourse level
        }
        
        // Add roof height
        if ( $has_roof ) {
            $height += 4;
        }
        
        return $height;
    }
    
    /**
     * Estimate roof overhang from stand depth
     * 
     * Modern stadiums typically have cantilevered roofs extending
     * 30-60% of the stand depth toward the pitch.
     * 
     * @param float  $stand_depth   Stand depth in metres
     * @param string $era           'heritage', 'modern', or 'contemporary'
     * @return float Estimated overhang in metres
     */
    public static function estimate_roof_overhang( float $stand_depth, string $era = 'modern' ): float {
        $ratios = [
            'heritage'     => 0.15,  // Old stands - minimal overhang
            'modern'       => 0.40,  // 1990s-2000s builds
            'contemporary' => 0.55,  // 2010s+ builds - aggressive cantilevers
        ];
        
        $ratio = $ratios[ $era ] ?? 0.40;
        
        return round( $stand_depth * $ratio, 1 );
    }
    
    /**
     * Create a quick stadium definition from minimal inputs
     * 
     * For venues where only basic info is known - generates reasonable
     * geometry estimates for shade calculations.
     * 
     * @param array $input {
     *     @type string $name         Stadium name (required)
     *     @type float  $lat          Latitude (required)
     *     @type float  $lng          Longitude (required)
     *     @type string $timezone     Timezone (required)
     *     @type string $type         'oval' or 'rectangular' (default 'oval')
     *     @type float  $capacity     Seating capacity (helps estimate heights)
     *     @type float  $field_length Field length in metres
     *     @type float  $field_width  Field width in metres
     *     @type int    $tiers        Number of seating tiers (1-4)
     *     @type bool   $enclosed     Full bowl or open ends
     *     @type float  $orientation  Degrees from north (default 0)
     * }
     * @return array Stadium configuration
     */
    public static function create_from_minimal_input( array $input ): array {
        
        // Defaults based on type
        $type = $input['type'] ?? 'oval';
        
        if ( $type === 'oval' ) {
            $field_length = $input['field_length'] ?? 165;
            $field_width  = $input['field_width'] ?? 135;
        } else {
            $field_length = $input['field_length'] ?? 120;
            $field_width  = $input['field_width'] ?? 80;
        }
        
        // Estimate tiers from capacity if not provided
        $capacity = $input['capacity'] ?? 30000;
        if ( ! isset( $input['tiers'] ) ) {
            if ( $capacity < 15000 ) {
                $tiers = 1;
            } elseif ( $capacity < 35000 ) {
                $tiers = 2;
            } elseif ( $capacity < 60000 ) {
                $tiers = 3;
            } else {
                $tiers = 4;
            }
        } else {
            $tiers = $input['tiers'];
        }
        
        // Estimate stand height
        $stand_height = self::estimate_height_from_tiers( $tiers );
        
        // Calculate stand positions
        $enclosed = $input['enclosed'] ?? true;
        
        return self::generate_approximate_stadium([
            'name'         => $input['name'],
            'lat'          => $input['lat'],
            'lng'          => $input['lng'],
            'timezone'     => $input['timezone'],
            'city'         => $input['city'] ?? '',
            'state'        => $input['state'] ?? '',
            'type'         => $type,
            'length'       => $field_length,
            'width'        => $field_width,
            'stand_height' => $stand_height,
            'orientation'  => $input['orientation'] ?? 0,
            'capacity'     => $capacity,
            'tiers'        => $tiers,
            'enclosed'     => $enclosed,
        ]);
    }
    
    /**
     * Generate standard rectangular stadium stands
     * 
     * @param int $main_height   Height of main (side) stands
     * @param int $end_height    Height of end stands
     * @return array Stand structures
     */
    private static function generate_rectangular_stands( int $main_height, int $end_height ): array {
        return [
            [
                'structure_id'  => 'west_stand',
                'name'          => 'West Stand',
                'type'          => 'stand',
                'height'        => $main_height,
                'height_quality'=> self::QUALITY_ESTIMATED,
                'position'      => [ 'x' => -52, 'y' => 0 ],
                'width'         => 35,
                'depth'         => 95,
                'roof_overhang' => intval( $main_height * 0.5 ),
                'roof_height'   => $main_height + 6,
                'permeability'  => 0,
            ],
            [
                'structure_id'  => 'east_stand',
                'name'          => 'East Stand',
                'type'          => 'stand',
                'height'        => $main_height,
                'height_quality'=> self::QUALITY_ESTIMATED,
                'position'      => [ 'x' => 52, 'y' => 0 ],
                'width'         => 35,
                'depth'         => 95,
                'roof_overhang' => intval( $main_height * 0.5 ),
                'roof_height'   => $main_height + 6,
                'permeability'  => 0,
            ],
            [
                'structure_id'  => 'north_stand',
                'name'          => 'North Stand',
                'type'          => 'stand',
                'height'        => $end_height,
                'height_quality'=> self::QUALITY_ESTIMATED,
                'position'      => [ 'x' => 0, 'y' => 52 ],
                'width'         => 95,
                'depth'         => 30,
                'roof_overhang' => intval( $end_height * 0.45 ),
                'roof_height'   => $end_height + 5,
                'permeability'  => 0,
            ],
            [
                'structure_id'  => 'south_stand',
                'name'          => 'South Stand',
                'type'          => 'stand',
                'height'        => $end_height,
                'height_quality'=> self::QUALITY_ESTIMATED,
                'position'      => [ 'x' => 0, 'y' => -52 ],
                'width'         => 95,
                'depth'         => 30,
                'roof_overhang' => intval( $end_height * 0.45 ),
                'roof_height'   => $end_height + 5,
                'permeability'  => 0,
            ],
        ];
    }
    
    /**
     * Initialise stadium database
     */
    private static function init_stadiums(): void {
        if ( ! empty( self::$stadiums ) ) {
            return;
        }
        
        self::$stadiums = [
            
            // =====================================================
            // VICTORIA
            // =====================================================
            
            'mcg' => [
                'name'         => 'Melbourne Cricket Ground',
                'common_names' => 'MCG The G',
                'capacity'     => 100024,
                'location'     => [
                    'lat'      => -37.8200,
                    'lng'      => 144.9834,
                    'city'     => 'Melbourne',
                    'state'    => 'VIC',
                    'timezone' => 'Australia/Melbourne',
                ],
                'field'        => [
                    'type'        => 'oval',
                    'length'      => 171,      // Fence to fence
                    'width'       => 146,
                    'orientation' => 0,        // Aligned N-S
                ],
                'turf'         => [
                    'variety'     => 'legend',
                    'variety_name'=> 'Legend Couch',
                    'species'     => 'Cynodon dactylon × C. transvaalensis',
                    'oversown'    => true,
                    'overseed_variety' => 'perennial_rye',
                    'overseed_months'  => [ 3, 4, 5, 6, 7, 8, 9 ],  // Mar-Sep
                    'notes'       => 'Legend couch base, overseeded with perennial ryegrass for winter colour and wear tolerance.',
                ],
                'structures'   => [
                    [
                        'structure_id'  => 'great_southern_stand',
                        'name'          => 'Great Southern Stand (Shane Warne Stand)',
                        'type'          => 'stand',
                        'height'        => 45,    // * Verified from construction docs
                        'height_quality'=> self::QUALITY_VERIFIED,
                        'position'      => [ 'x' => 0, 'y' => -85 ],
                        'width'         => 324,   // 324m long
                        'depth'         => 50,
                        'roof_overhang' => 20,
                        'roof_height'   => 50,
                        'permeability'  => 0,
                    ],
                    [
                        'structure_id'  => 'northern_stand',
                        'name'          => 'Northern Stand',
                        'type'          => 'stand',
                        'height'        => 42,    // ~ Estimated similar to GSS
                        'height_quality'=> self::QUALITY_DERIVED,
                        'position'      => [ 'x' => 0, 'y' => 85 ],
                        'width'         => 300,
                        'depth'         => 55,
                        'roof_overhang' => 25,
                        'roof_height'   => 48,
                        'permeability'  => 0,
                    ],
                    [
                        'structure_id'  => 'members_pavilion',
                        'name'          => 'Members Pavilion',
                        'type'          => 'stand',
                        'height'        => 38,    // ~ Heritage structure
                        'height_quality'=> self::QUALITY_ESTIMATED,
                        'position'      => [ 'x' => -80, 'y' => 40 ],
                        'width'         => 120,
                        'depth'         => 30,
                        'roof_overhang' => 10,
                        'roof_height'   => 42,
                        'permeability'  => 0,
                    ],
                    [
                        'structure_id'  => 'ponsford_stand',
                        'name'          => 'Ponsford Stand',
                        'type'          => 'stand',
                        'height'        => 42,    // ~ Part of northern redevelopment
                        'height_quality'=> self::QUALITY_ESTIMATED,
                        'position'      => [ 'x' => 80, 'y' => 40 ],
                        'width'         => 120,
                        'depth'         => 45,
                        'roof_overhang' => 22,
                        'roof_height'   => 47,
                        'permeability'  => 0,
                    ],
                    // Light towers - these cast shadows too
                    [
                        'structure_id'  => 'light_tower_1',
                        'name'          => 'Light Tower 1',
                        'type'          => 'tower',
                        'height'        => 75,    // * 75m towers, 85m with head frame
                        'height_quality'=> self::QUALITY_VERIFIED,
                        'position'      => [ 'x' => -90, 'y' => 60 ],
                        'width'         => 4.2,   // 4.2m diameter at base
                        'depth'         => 4.2,
                        'permeability'  => 0.95,  // Open lattice
                    ],
                    [
                        'structure_id'  => 'light_tower_2',
                        'name'          => 'Light Tower 2',
                        'type'          => 'tower',
                        'height'        => 75,
                        'height_quality'=> self::QUALITY_VERIFIED,
                        'position'      => [ 'x' => 90, 'y' => 60 ],
                        'width'         => 4.2,
                        'depth'         => 4.2,
                        'permeability'  => 0.95,
                    ],
                    [
                        'structure_id'  => 'light_tower_3',
                        'name'          => 'Light Tower 3',
                        'type'          => 'tower',
                        'height'        => 75,
                        'height_quality'=> self::QUALITY_VERIFIED,
                        'position'      => [ 'x' => -90, 'y' => -60 ],
                        'width'         => 4.2,
                        'depth'         => 4.2,
                        'permeability'  => 0.95,
                    ],
                    [
                        'structure_id'  => 'light_tower_4',
                        'name'          => 'Light Tower 4',
                        'type'          => 'tower',
                        'height'        => 75,
                        'height_quality'=> self::QUALITY_VERIFIED,
                        'position'      => [ 'x' => 90, 'y' => -60 ],
                        'width'         => 4.2,
                        'depth'         => 4.2,
                        'permeability'  => 0.95,
                    ],
                    [
                        'structure_id'  => 'light_tower_5',
                        'name'          => 'Light Tower 5',
                        'type'          => 'tower',
                        'height'        => 75,
                        'height_quality'=> self::QUALITY_VERIFIED,
                        'position'      => [ 'x' => 0, 'y' => 95 ],
                        'width'         => 4.2,
                        'depth'         => 4.2,
                        'permeability'  => 0.95,
                    ],
                    [
                        'structure_id'  => 'light_tower_6',
                        'name'          => 'Light Tower 6',
                        'type'          => 'tower',
                        'height'        => 75,
                        'height_quality'=> self::QUALITY_VERIFIED,
                        'position'      => [ 'x' => 0, 'y' => -95 ],
                        'width'         => 4.2,
                        'depth'         => 4.2,
                        'permeability'  => 0.95,
                    ],
                ],
                'notes' => 'GSS: 45m height, 324m length verified from John Holland construction docs. Light towers 75m to mast, 85m including head frame (verified - tallest stadium lights worldwide). Six towers installed 1984, LED upgrade 2019.',
            ],
            
            'marvel_stadium' => [
                'name'         => 'Marvel Stadium',
                'common_names' => 'Docklands Stadium Etihad Stadium',
                'capacity'     => 53359,
                'location'     => [
                    'lat'      => -37.8165,
                    'lng'      => 144.9475,
                    'city'     => 'Melbourne',
                    'state'    => 'VIC',
                    'timezone' => 'Australia/Melbourne',
                ],
                'field'        => [
                    'type'        => 'oval',
                    'length'      => 159.5,
                    'width'       => 128.8,
                    'orientation' => 0,
                ],
                'turf'         => [
                    'variety'     => 'couch',
                    'variety_name'=> 'Couch Grass',
                    'species'     => 'Cynodon dactylon',
                    'oversown'    => true,
                    'overseed_variety' => 'perennial_rye',
                    'overseed_species' => 'Lolium perenne',
                    'overseed_months'  => [ 3, 4, 5, 6, 7, 8, 9 ],
                    'notes'       => 'Couch base oversown with perennial ryegrass Apr-Sep. Retractable roof venue.',
                ],
                'structures'   => [
                    [
                        'structure_id'  => 'retractable_roof',
                        'name'          => 'Retractable Roof',
                        'type'          => 'roof',
                        'height'        => 38,    // * Verified - 38m above playing surface
                        'height_quality'=> self::QUALITY_VERIFIED,
                        'position'      => [ 'x' => 0, 'y' => 0 ],
                        'width'         => 180,
                        'depth'         => 150,
                        'permeability'  => 0.3,   // Translucent when closed
                        'notes'         => 'Roof can be open or closed. When open, minimal shade.',
                    ],
                    [
                        'structure_id'  => 'north_stand',
                        'name'          => 'North Stand',
                        'type'          => 'stand',
                        'height'        => 35,
                        'height_quality'=> self::QUALITY_ESTIMATED,
                        'position'      => [ 'x' => 0, 'y' => 75 ],
                        'width'         => 140,
                        'depth'         => 40,
                        'roof_overhang' => 15,
                        'roof_height'   => 38,
                        'permeability'  => 0,
                    ],
                    [
                        'structure_id'  => 'south_stand',
                        'name'          => 'South Stand',
                        'type'          => 'stand',
                        'height'        => 35,
                        'height_quality'=> self::QUALITY_ESTIMATED,
                        'position'      => [ 'x' => 0, 'y' => -75 ],
                        'width'         => 140,
                        'depth'         => 40,
                        'roof_overhang' => 15,
                        'roof_height'   => 38,
                        'permeability'  => 0,
                    ],
                ],
                'notes'    => 'Retractable roof means shade calculations vary by configuration.',
                'defaults' => [
                    'construction'   => 'sand_carpet',
                    'drainageRating' => 0.95,
                    'hocMM'          => 25,
                    'venueEnv'       => [
                        'enclosureType'  => 'retractable_open',
                        'managementGoal' => 'maintenance',
                        'drainageRating' => 0.95,
                        'hocMM'          => 25,
                    ],
                ],
            ],
            
            // =====================================================
            // NEW SOUTH WALES
            // =====================================================
            
            'scg' => [
                'name'         => 'Sydney Cricket Ground',
                'common_names' => 'SCG',
                'capacity'     => 48000,
                'location'     => [
                    'lat'      => -33.8915,
                    'lng'      => 151.2247,
                    'city'     => 'Sydney',
                    'state'    => 'NSW',
                    'timezone' => 'Australia/Sydney',
                ],
                'field'        => [
                    'type'        => 'oval',
                    'length'      => 156,      // * Verified: shortest AFL ground (Wikipedia)
                    'width'       => 154,      // * Verified (The Cricketer)
                    'orientation' => 5,        // Slight rotation from N-S
                    'straight_boundary' => 80, // * Verified (ZAP Cricket)
                    'midwicket_boundary'=> 74, // * Verified (ZAP Cricket)
                    'square_boundary'   => 68, // * Verified (ZAP Cricket)
                ],
                'turf'         => [
                    'variety'     => 'wintergreen',
                    'variety_name'=> 'Wintergreen Couch',
                    'species'     => 'Cynodon dactylon',
                    'oversown'    => true,
                    'overseed_variety' => 'perennial_rye',
                    'overseed_months'  => [ 3, 4, 5, 6, 7, 8, 9 ],
                    'notes'       => 'Wintergreen couch with winter ryegrass overseed for cricket and AFL seasons.',
                ],
                'structures'   => [
                    [
                        'structure_id'  => 'noble_bradman_stand',
                        'name'          => 'MA Noble & Don Bradman Stand',
                        'type'          => 'stand',
                        'height'        => 38,    // Modern redevelopment 2013, includes large video screen
                        'height_quality'=> self::QUALITY_DERIVED,
                        'position'      => [ 'x' => 0, 'y' => 85 ],
                        'width'         => 180,
                        'depth'         => 45,
                        'roof_overhang' => 20,
                        'roof_height'   => 42,
                        'permeability'  => 0,
                        'notes'         => 'Opened 2013, includes one of largest video screens in Australia',
                    ],
                    [
                        'structure_id'  => 'messenger_stand',
                        'name'          => 'Dally Messenger Stand',
                        'type'          => 'stand',
                        'height'        => 32,
                        'height_quality'=> self::QUALITY_ESTIMATED,
                        'position'      => [ 'x' => 80, 'y' => 0 ],
                        'width'         => 45,
                        'depth'         => 120,
                        'roof_overhang' => 15,
                        'roof_height'   => 36,
                        'permeability'  => 0,
                    ],
                    [
                        'structure_id'  => 'victor_trumper_stand',
                        'name'          => 'Victor Trumper Stand',
                        'type'          => 'stand',
                        'height'        => 30,
                        'height_quality'=> self::QUALITY_ESTIMATED,
                        'position'      => [ 'x' => 0, 'y' => -85 ],
                        'width'         => 160,
                        'depth'         => 40,
                        'roof_overhang' => 15,
                        'roof_height'   => 34,
                        'permeability'  => 0,
                    ],
                    [
                        'structure_id'  => 'members_pavilion',
                        'name'          => 'Members Pavilion',
                        'type'          => 'stand',
                        'height'        => 25,    // * Heritage: 2-level grandstand + 3-storey club room (Heritage Register)
                        'height_quality'=> self::QUALITY_DERIVED,
                        'position'      => [ 'x' => -75, 'y' => 30 ],
                        'width'         => 30,
                        'depth'         => 80,
                        'roof_overhang' => 5,
                        'roof_height'   => 27,
                        'permeability'  => 0,
                        'heritage_listed' => true,
                        'architect'     => 'John Kirkpatrick',
                        'built'         => 'c.1886/1900',
                        'notes'         => 'NSW Heritage listed. 2-level grandstand + 3-storey stuccoed brick club room.',
                    ],
                    [
                        'structure_id'  => 'ladies_pavilion',
                        'name'          => 'Ladies Pavilion',
                        'type'          => 'stand',
                        'height'        => 22,    // * Heritage: 2-level grandstand + 3-storey members room (Heritage Register)
                        'height_quality'=> self::QUALITY_DERIVED,
                        'position'      => [ 'x' => -75, 'y' => -20 ],
                        'width'         => 25,
                        'depth'         => 50,
                        'roof_overhang' => 4,
                        'roof_height'   => 24,
                        'permeability'  => 0,
                        'heritage_listed' => true,
                        'built'         => 1896,
                        'notes'         => 'NSW Heritage listed (1999). Cast iron construction, 2-level + 3-storey room.',
                    ],
                ],
                'notes' => 'Historic venue est. 1848. Heritage listed Members Stand (c.1886, Kirkpatrick) and Ladies Stand (1896). Noble/Bradman Stand 2013. Field 156x154m verified - shortest AFL ground. Hosted first Test 1882.',
            ],
            
            'allianz_stadium_sydney' => [
                'name'         => 'Allianz Stadium',
                'common_names' => 'Sydney Football Stadium SFS Moore Park',
                'capacity'     => 45000,
                'location'     => [
                    'lat'      => -33.8883,
                    'lng'      => 151.2228,
                    'city'     => 'Sydney',
                    'state'    => 'NSW',
                    'timezone' => 'Australia/Sydney',
                ],
                'field'        => [
                    'type'        => 'rectangular',
                    'length'      => 120,
                    'width'       => 80,
                    'playing_length' => 100,
                    'playing_width'  => 68,
                    'turf_length' => 120,      // Full NRL: 100m playing + 2×10m in-goal
                    'turf_width'  => 68,       // Touchline to touchline (run-off is synthetic)
                    'orientation' => 8,        // Slight NNE-SSW alignment
                ],
                'turf'         => [
                    'variety'     => 'tiftuf',
                    'variety_name'=> 'TifTuf Bermuda',
                    'species'     => 'Cynodon dactylon',
                    'oversown'    => true,
                    'overseed_variety' => 'perennial_rye',
                    'overseed_species' => 'Lolium perenne',
                    'overseed_months'  => [ 3, 4, 5, 6, 7, 8, 9 ],
                    'notes'       => 'New pitch installed 2022 rebuild. TifTuf base oversown with perennial ryegrass Apr-Sep.',
                ],
                'structures'   => [
                    // Rebuilt 2019-2022, opened August 2022
                    // Single-tier horseshoe design with open corners
                    // 36-degree rake for steep sightlines
                    [
                        'structure_id'  => 'west_stand',
                        'name'          => 'Western Stand (Members)',
                        'type'          => 'stand',
                        'height'        => 38,    // * Main stand with premium levels
                        'height_quality'=> self::QUALITY_DERIVED,
                        'position'      => [ 'x' => -52, 'y' => 0 ],
                        'width'         => 28,
                        'depth'         => 150,
                        'roof_overhang' => 35,    // Full roof coverage
                        'roof_height'   => 42,
                        'permeability'  => 0,
                        'notes'         => 'Main western stand with corporate facilities',
                    ],
                    [
                        'structure_id'  => 'east_stand',
                        'name'          => 'Eastern Stand',
                        'type'          => 'stand',
                        'height'        => 34,    // Slightly lower than west
                        'height_quality'=> self::QUALITY_DERIVED,
                        'position'      => [ 'x' => 52, 'y' => 0 ],
                        'width'         => 24,
                        'depth'         => 150,
                        'roof_overhang' => 32,
                        'roof_height'   => 38,
                        'permeability'  => 0,
                    ],
                    [
                        'structure_id'  => 'north_stand',
                        'name'          => 'Northern Stand',
                        'type'          => 'stand',
                        'height'        => 32,
                        'height_quality'=> self::QUALITY_ESTIMATED,
                        'position'      => [ 'x' => 0, 'y' => 68 ],
                        'width'         => 110,
                        'depth'         => 22,
                        'roof_overhang' => 28,
                        'roof_height'   => 36,
                        'permeability'  => 0,
                        'notes'         => 'Active supporter end',
                    ],
                    [
                        'structure_id'  => 'south_stand',
                        'name'          => 'Southern Stand',
                        'type'          => 'stand',
                        'height'        => 32,
                        'height_quality'=> self::QUALITY_ESTIMATED,
                        'position'      => [ 'x' => 0, 'y' => -68 ],
                        'width'         => 110,
                        'depth'         => 22,
                        'roof_overhang' => 28,
                        'roof_height'   => 36,
                        'permeability'  => 0,
                    ],
                ],
                'notes' => 'Rebuilt 2019-2022. Rectangular purpose-built football stadium. Steep 36° rake. LED grow lights used during construction.',
            ],
            
            'accor_stadium' => [
                'name'         => 'Accor Stadium',
                'common_names' => 'Stadium Australia ANZ Stadium Olympic Stadium Homebush',
                'capacity'     => 83500,
                'location'     => [
                    'lat'      => -33.8472,
                    'lng'      => 151.0635,
                    'city'     => 'Sydney',
                    'state'    => 'NSW',
                    'timezone' => 'Australia/Sydney',
                ],
                'field'        => [
                    'type'        => 'oval',      // Configurable oval/rectangular
                    'length'      => 180,
                    'width'       => 135,
                    'orientation' => 0,
                ],
                'turf'         => [
                    'variety'     => 'tahoma31',
                    'variety_name'=> 'Tahoma 31 Bermuda',
                    'species'     => 'Cynodon dactylon',
                    'oversown'    => true,
                    'overseed_variety' => 'perennial_rye',
                    'overseed_species' => 'Lolium perenne',
                    'overseed_months'  => [ 3, 4, 5, 6, 7, 8, 9 ],
                    'notes'       => 'Tahoma 31 base oversown with perennial ryegrass Apr-Sep.',
                ],
                'structures'   => [
                    [
                        'structure_id'  => 'east_stand',
                        'name'          => 'East Stand',
                        'type'          => 'stand',
                        'height'        => 42,
                        'height_quality'=> self::QUALITY_ESTIMATED,
                        'position'      => [ 'x' => 100, 'y' => 0 ],
                        'width'         => 50,
                        'depth'         => 250,
                        'roof_overhang' => 40,    // Large roof arch
                        'roof_height'   => 55,
                        'permeability'  => 0,
                    ],
                    [
                        'structure_id'  => 'west_stand',
                        'name'          => 'West Stand',
                        'type'          => 'stand',
                        'height'        => 42,
                        'height_quality'=> self::QUALITY_ESTIMATED,
                        'position'      => [ 'x' => -100, 'y' => 0 ],
                        'width'         => 50,
                        'depth'         => 250,
                        'roof_overhang' => 40,
                        'roof_height'   => 55,
                        'permeability'  => 0,
                    ],
                    [
                        'structure_id'  => 'roof_arch_east',
                        'name'          => 'Roof Arch East',
                        'type'          => 'roof',
                        'height'        => 58,    // Arch peak
                        'height_quality'=> self::QUALITY_DERIVED,
                        'position'      => [ 'x' => 0, 'y' => 0 ],
                        'width'         => 200,
                        'depth'         => 10,
                        'permeability'  => 0.4,   // Translucent polycarbonate
                        'notes'         => '295m long curved trusses',
                    ],
                ],
                'notes' => 'Roof provides 75% spectator coverage. Translucent material.',
            ],
            
            'commbank_stadium' => [
                'name'         => 'CommBank Stadium',
                'common_names' => 'Western Sydney Stadium Bankwest Stadium Parramatta Stadium',
                'capacity'     => 30000,
                'location'     => [
                    'lat'      => -33.8075,
                    'lng'      => 151.0082,
                    'city'     => 'Parramatta',
                    'state'    => 'NSW',
                    'timezone' => 'Australia/Sydney',
                ],
                'field'        => [
                    'type'            => 'rectangular',
                    'length'          => 120,      // Rugby/football configuration (outer boundary)
                    'width'           => 80,
                    'playing_length'  => 100,       // Actual playing rectangle
                    'playing_width'   => 68,
                    'turf_length'     => 120,       // Full NRL: 100m + 2×10m in-goal
                    'turf_width'      => 68,        // Touchline to touchline
                    'orientation'     => 0,         // N-S aligned
                ],
                'turf'         => [
                    'variety'     => 'tahoma31',
                    'variety_name'=> 'Tahoma 31 Bermuda',
                    'species'     => 'Cynodon dactylon',
                    'oversown'    => true,
                    'overseed_variety' => 'perennial_rye',
                    'overseed_species' => 'Lolium perenne',
                    'overseed_period'  => [
                        'start_month' => 2,   // Late February
                        'end_month'   => 10,  // Early October
                        'notes'       => 'Winter overseed not chemically removed - transitions naturally',
                    ],
                    'management'  => 'c4_summer',
                    'notes'       => 'Tahoma 31 couch oversown with perennial ryegrass late Feb-early Oct. Managed as C4 stadium over summer months. Ryegrass transitions out naturally, not chemically removed.',
                ],
                'structures'   => [
                    // Continuous bowl - steepest in Australia at 34 degrees
                    // Lower tier: 15 rows (sunken below street level)
                    // Upper tier: 26 rows
                    // Stands positioned from inner seating edge: 5.5m field-to-front-row + stand depth
                    [
                        'structure_id'  => 'west_stand',
                        'name'          => 'Western Stand',
                        'type'          => 'stand',
                        'height'        => 32,    // 5 levels, wood-clad facade
                        'height_quality'=> self::QUALITY_DERIVED,
                        'position'      => [ 'x' => -57, 'y' => 0 ],
                        'width'         => 30,
                        'depth'         => 130,
                        'roof_overhang' => 25,    // Full roof coverage
                        'roof_height'   => 36,
                        'permeability'  => 0,
                        'notes'         => '54 corporate suites, 5 levels. Inner edge at x=-42 (5.5m from x=-34 touchline).',
                    ],
                    [
                        'structure_id'  => 'east_stand',
                        'name'          => 'Eastern Stand',
                        'type'          => 'stand',
                        'height'        => 28,    // * 26 rows upper + 15 rows lower
                        'height_quality'=> self::QUALITY_DERIVED,
                        'position'      => [ 'x' => 55, 'y' => 0 ],
                        'width'         => 25,
                        'depth'         => 130,
                        'roof_overhang' => 22,
                        'roof_height'   => 32,
                        'permeability'  => 0,
                    ],
                    [
                        'structure_id'  => 'north_stand',
                        'name'          => 'Northern Stand',
                        'type'          => 'stand',
                        'height'        => 28,
                        'height_quality'=> self::QUALITY_DERIVED,
                        'position'      => [ 'x' => 0, 'y' => 76 ],
                        'width'         => 90,
                        'depth'         => 22,
                        'roof_overhang' => 20,
                        'roof_height'   => 32,
                        'permeability'  => 0,
                        'notes'         => 'Includes safe standing area',
                    ],
                    [
                        'structure_id'  => 'south_stand',
                        'name'          => 'Southern Stand',
                        'type'          => 'stand',
                        'height'        => 28,
                        'height_quality'=> self::QUALITY_DERIVED,
                        'position'      => [ 'x' => 0, 'y' => -76 ],
                        'width'         => 90,
                        'depth'         => 22,
                        'roof_overhang' => 20,
                        'roof_height'   => 32,
                        'permeability'  => 0,
                    ],
                    [
                        'structure_id'  => 'roof_membrane',
                        'name'          => 'PTFE/ETFE Roof Membrane',
                        'type'          => 'roof',
                        'height'        => 36,    // Roof structure height
                        'height_quality'=> self::QUALITY_ESTIMATED,
                        'position'      => [ 'x' => 0, 'y' => 0 ],
                        'width'         => 160,
                        'depth'         => 180,
                        'permeability'  => 0.35,  // PTFE translucent + ETFE near-transparent halo
                        'notes'         => '23,400m² PTFE + 4,600m² ETFE. Allows UV for turf growth.',
                    ],
                ],
                'notes' => 'Opened 2019. Steepest grandstands in Australia (34°). Full roof coverage. Seats 5.5m from field. Innovative sub-surface drainage.',
            ],
            
            'campbelltown_stadium' => [
                'name'         => 'Campbelltown Sports Stadium',
                'common_names' => 'Orana Park Campbelltown Sports Ground Macarthur Stadium',
                'capacity'     => 17500,
                'location'     => [
                    'lat'      => -34.0504,
                    'lng'      => 150.8337,
                    'city'     => 'Leumeah',
                    'state'    => 'NSW',
                    'timezone' => 'Australia/Sydney',
                ],
                'field'        => [
                    'type'        => 'rectangular',
                    'length'      => 120,
                    'width'       => 80,
                    'playing_length' => 100,
                    'playing_width'  => 68,
                    'turf_length' => 120,      // Full NRL: 100m + 2×10m in-goal
                    'turf_width'  => 68,
                    'orientation' => 0,        // N-S aligned
                ],
                'turf'         => [
                    'variety'          => 'tiftuf',
                    'variety_name'     => 'TifTuf Bermuda',
                    'species'          => 'Cynodon dactylon',
                    // Management model: couch is the base and the recovery target, but ryegrass
                    // from the autumn overseed is never chemically removed. Over summer the HOC is
                    // dropped to encourage couch; by late summer ryegrass has thinned but persists.
                    // Early autumn overseed reinstates a full ryegrass sward for winter.
                    // Net result: ryegrass cover year-round at varying seasonal density.
                    'oversown'                => true,
                    'permanent_overseed'      => true,   // Ryegrass present year-round -- never chemically removed
                    'overseed_variety'        => 'perennial_ryegrass',
                    'overseed_species'        => 'Lolium perenne',
                    'overseed_months'         => [ 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12 ],
                    // Seasonal c3 fractions reflect actual cover, not management intent:
                    //   Summer (Dec-Feb): HOC dropped to stress ryegrass, encourage couch recovery.
                    //                    Ryegrass thin but present. Managed as C4-recovery surface.
                    //   Autumn (Mar-May): Re-overseed in early autumn. Ryegrass rapidly re-establishes.
                    //   Winter (Jun-Aug): Maintained as ryegrass surface.
                    //   Spring (Sep-Nov): Couch breaking dormancy, ryegrass fading.
                    'seasonal_c3_fraction'    => [
                        'summer' => 0.3,   // Thin ryegrass -- couch recovery attempted
                        'autumn' => 0.7,   // Re-overseed complete, ryegrass dominant
                        'winter' => 0.85,  // Full ryegrass cover
                        'spring' => 0.5,   // Transition -- couch recovering, ryegrass fading
                    ],
                    'management'  => 'c4_recovery_with_permanent_overseed',
                    'contamination' => [
                        'poa_annua'   => 95,
                        'notes'       => 'Poa annua dominant year-round regardless of season.',
                    ],
                    'notes'       => 'TifTuf couch base -- target species is couch but poor establishment means ryegrass overseed is never chemically removed. Summer HOC reduction attempts to encourage couch at the expense of ryegrass. Early autumn re-overseed reinstates full ryegrass cover for winter.',
                ],
                'structures'   => [
                    // Redeveloped 2000 - traditional four-sided rectangular stadium
                    // Western Grandstand refurbished, new Eastern Grandstand with corporate boxes
                    // Hill areas on north and south ends
                    [
                        'structure_id'  => 'west_stand',
                        'name'          => 'Western Grandstand',
                        'type'          => 'stand',
                        'height'        => 16,    // Older style, modest height
                        'height_quality'=> self::QUALITY_ESTIMATED,
                        'position'      => [ 'x' => -48, 'y' => 0 ],
                        'width'         => 18,
                        'depth'         => 100,
                        'roof_overhang' => 12,    // Partial roof coverage
                        'roof_height'   => 18,
                        'permeability'  => 0,
                        'notes'         => 'Refurbished 2000. Main grandstand.',
                    ],
                    [
                        'structure_id'  => 'east_stand',
                        'name'          => 'Eastern Grandstand',
                        'type'          => 'stand',
                        'height'        => 18,    // Newer stand with 20 corporate boxes
                        'height_quality'=> self::QUALITY_ESTIMATED,
                        'position'      => [ 'x' => 48, 'y' => 0 ],
                        'width'         => 18,
                        'depth'         => 100,
                        'roof_overhang' => 14,
                        'roof_height'   => 20,
                        'permeability'  => 0,
                        'notes'         => 'Built 2000. 20 corporate boxes.',
                    ],
                    [
                        'structure_id'  => 'north_hill',
                        'name'          => 'Northern Hill',
                        'type'          => 'stand',
                        'height'        => 6,     // Grass hill/terrace
                        'height_quality'=> self::QUALITY_ESTIMATED,
                        'position'      => [ 'x' => 0, 'y' => 55 ],
                        'width'         => 80,
                        'depth'         => 15,
                        'permeability'  => 1.0,   // Open hill, no shade structure
                        'notes'         => 'Family hill area, no weather protection',
                    ],
                    [
                        'structure_id'  => 'south_hill',
                        'name'          => 'Southern Hill',
                        'type'          => 'stand',
                        'height'        => 6,     // Grass hill/terrace
                        'height_quality'=> self::QUALITY_ESTIMATED,
                        'position'      => [ 'x' => 0, 'y' => -55 ],
                        'width'         => 80,
                        'depth'         => 15,
                        'permeability'  => 1.0,   // Open hill, no shade structure
                        'notes'         => 'Hill area, no weather protection',
                    ],
                ],
                'notes' => 'Redeveloped 2000 for Sydney Olympics. Traditional rectangular stadium. Home of Wests Tigers (NRL) and Macarthur FC (A-League). Limited weather protection except grandstands.',
            ],
            
            // =====================================================
            // SOUTH AUSTRALIA
            // =====================================================
            
            'adelaide_oval' => [
                'name'         => 'Adelaide Oval',
                'common_names' => '',
                'capacity'     => 53583,
                'location'     => [
                    'lat'      => -34.9156,
                    'lng'      => 138.5961,
                    'city'     => 'Adelaide',
                    'state'    => 'SA',
                    'timezone' => 'Australia/Adelaide',
                ],
                'field'        => [
                    'type'        => 'oval',
                    'length'      => 167,      // Playing field for AFL
                    'width'       => 124,      // One of narrower AFL grounds
                    'orientation' => -10,      // Slight SW-NE alignment
                ],
                'turf'         => [
                    'variety'     => 'legend',
                    'variety_name'=> 'Legend Couch',
                    'species'     => 'Cynodon dactylon × C. transvaalensis',
                    'oversown'    => true,
                    'overseed_variety' => 'perennial_rye',
                    'overseed_months'  => [ 3, 4, 5, 6, 7, 8, 9 ],
                    'notes'       => 'Legend couch with ryegrass overseed. Uses SGL LED rigs for shade-affected areas.',
                ],
                'structures'   => [
                    [
                        'structure_id'  => 'western_stand',
                        'name'          => 'Western Stand (Riverbank Stand)',
                        'type'          => 'stand',
                        'height'        => 50,    // * Verified: RoofClimb platform 50m above turf
                        'height_quality'=> self::QUALITY_VERIFIED,
                        'position'      => [ 'x' => -75, 'y' => 0 ],
                        'width'         => 45,
                        'depth'         => 180,
                        'roof_overhang' => 30,    // * Verified: Diagrid shells 30m x 30m (Hassell)
                        'roof_height'   => 50,
                        'permeability'  => 0,
                        'diagrid_shells'=> 5,     // 5 diagrid roof shells
                        'shell_span'    => 30,    // Each shell 30m x 30m
                        'shell_supports'=> 6,     // Supported at 6 points each
                        'notes'         => 'Verified: 50m height (RoofClimb), 5 diagrid shells 30x30m each (Hassell/Aurecon)',
                    ],
                    [
                        'structure_id'  => 'eastern_stand',
                        'name'          => 'Eastern Stand',
                        'type'          => 'stand',
                        'height'        => 40,
                        'height_quality'=> self::QUALITY_ESTIMATED,
                        'position'      => [ 'x' => 75, 'y' => 0 ],
                        'width'         => 40,
                        'depth'         => 160,
                        'roof_overhang' => 20,
                        'roof_height'   => 45,
                        'permeability'  => 0,
                    ],
                    [
                        'structure_id'  => 'southern_stand',
                        'name'          => 'Southern Stand',
                        'type'          => 'stand',
                        'height'        => 35,
                        'height_quality'=> self::QUALITY_ESTIMATED,
                        'position'      => [ 'x' => 0, 'y' => -70 ],
                        'width'         => 160,
                        'depth'         => 35,
                        'roof_overhang' => 18,
                        'roof_height'   => 40,
                        'permeability'  => 0,
                    ],
                    [
                        'structure_id'  => 'the_hill',
                        'name'          => 'The Hill / Northern Mound',
                        'type'          => 'stand',
                        'height'        => 12,    // Low grass embankment with seating
                        'height_quality'=> self::QUALITY_ESTIMATED,
                        'position'      => [ 'x' => 0, 'y' => 70 ],
                        'width'         => 120,
                        'depth'         => 25,
                        'permeability'  => 0.8,   // Mostly open
                    ],
                    [
                        'structure_id'  => 'scoreboard',
                        'name'          => 'Historic Scoreboard',
                        'type'          => 'building',
                        'height'        => 15,    // Heritage listed
                        'height_quality'=> self::QUALITY_ESTIMATED,
                        'position'      => [ 'x' => 30, 'y' => 75 ],
                        'width'         => 20,
                        'depth'         => 8,
                        'permeability'  => 0,
                    ],
                ],
                'notes' => 'Redeveloped 2011-2014. Western Stand: 50m verified (RoofClimb), 5 diagrid shells 30x30m each (Hassell). Historic scoreboard and Moreton Bay figs retained. 14,000 seats over 4 levels in Western Stand.',
            ],
            
            // =====================================================
            // WESTERN AUSTRALIA
            // =====================================================
            
            'optus_stadium' => [
                'name'         => 'Optus Stadium',
                'common_names' => 'Perth Stadium Burswood Stadium',
                'capacity'     => 61266,
                'location'     => [
                    'lat'      => -31.9512,
                    'lng'      => 115.8892,
                    'city'     => 'Perth',
                    'state'    => 'WA',
                    'timezone' => 'Australia/Perth',
                ],
                'field'        => [
                    'type'        => 'oval',
                    'length'      => 165,         // Boundary to boundary (AFL)
                    'width'       => 130,         // Boundary to boundary (AFL)
                    'fence_length'=> 177,         // Fence to fence (cricket)
                    'fence_width' => 141,         // Fence to fence (cricket)
                    'orientation' => 90,          // E-W aligned (replicates MCG/Subiaco)
                ],
                'turf'         => [
                    'variety'     => 'couch',
                    'variety_name'=> 'Couch Grass',
                    'species'     => 'Cynodon dactylon',
                    'oversown'    => true,
                    'overseed_variety' => 'perennial_rye',
                    'overseed_species' => 'Lolium perenne',
                    'overseed_months'  => [ 3, 4, 5, 6, 7, 8, 9 ],
                    'notes'       => 'Couch base oversown with perennial ryegrass Apr-Sep.',
                ],
                'structures'   => [
                    [
                        'structure_id'  => 'main_bowl',
                        'name'          => 'Main Stadium Bowl',
                        'type'          => 'stand',
                        'height'        => 42,    // * Verified: Vertigo platform 42m above turf (Hassell architects)
                        'height_quality'=> self::QUALITY_VERIFIED,
                        'position'      => [ 'x' => 0, 'y' => 0 ],
                        'width'         => 240,   // Approximate outer dimensions
                        'depth'         => 200,
                        'roof_overhang' => 35,    // * Verified: ~35m cantilever (44m total truss length, LSAA)
                        'roof_height'   => 42,    // Roof at viewing platform level
                        'permeability'  => 0,
                        'notes'         => 'Continuous three-tiered bowl. 50 triangular cantilever trusses, 44m total length.',
                    ],
                ],
                'notes' => 'Opened 2018. Verified dimensions: 42m to roof/Vertigo platform (Hassell), 44m truss length (LSAA). 85% roof coverage. PTFE/ePTFE fabric membrane. Seats 6m from field.',
            ],
            
            // =====================================================
            // QUEENSLAND
            // =====================================================
            
            'gabba' => [
                'name'         => 'The Gabba',
                'common_names' => 'Brisbane Cricket Ground Woolloongabba',
                'capacity'     => 42000,
                'location'     => [
                    'lat'      => -27.4858,
                    'lng'      => 153.0381,
                    'city'     => 'Brisbane',
                    'state'    => 'QLD',
                    'timezone' => 'Australia/Brisbane',
                ],
                'field'        => [
                    'type'        => 'oval',
                    'length'      => 170.6,    // East-west
                    'width'       => 149.9,    // North-south
                    'orientation' => 0,
                ],
                'turf'         => [
                    'variety'     => 'tiftuf',
                    'variety_name'=> 'TifTuf Bermuda',
                    'species'     => 'Cynodon dactylon × C. transvaalensis',
                    'oversown'    => false,
                    'notes'       => 'TifTuf hybrid bermuda. Subtropical climate allows year-round warm-season growth.',
                ],
                'structures'   => [
                    [
                        'structure_id'  => 'western_stand',
                        'name'          => 'Western Stand',
                        'type'          => 'stand',
                        'height'        => 35,    // Updated: uniform height bowl, 2-3 tiers internally
                        'height_quality'=> self::QUALITY_DERIVED,
                        'position'      => [ 'x' => -90, 'y' => 0 ],
                        'width'         => 35,
                        'depth'         => 160,
                        'roof_overhang' => 15,
                        'roof_height'   => 38,
                        'permeability'  => 0,
                    ],
                    [
                        'structure_id'  => 'eastern_stand',
                        'name'          => 'Eastern Stand',
                        'type'          => 'stand',
                        'height'        => 35,    // Updated: uniform height bowl
                        'height_quality'=> self::QUALITY_DERIVED,
                        'position'      => [ 'x' => 90, 'y' => 0 ],
                        'width'         => 35,
                        'depth'         => 160,
                        'roof_overhang' => 15,
                        'roof_height'   => 38,
                        'permeability'  => 0,
                    ],
                    [
                        'structure_id'  => 'northern_stand',
                        'name'          => 'Northern Stand',
                        'type'          => 'stand',
                        'height'        => 35,    // Updated: uniform height described in sources
                        'height_quality'=> self::QUALITY_DERIVED,
                        'position'      => [ 'x' => 0, 'y' => 82 ],
                        'width'         => 140,
                        'depth'         => 30,
                        'roof_overhang' => 12,
                        'roof_height'   => 38,
                        'permeability'  => 0,
                    ],
                    [
                        'structure_id'  => 'southern_stand',
                        'name'          => 'Southern Stand',
                        'type'          => 'stand',
                        'height'        => 35,    // Updated: uniform height
                        'height_quality'=> self::QUALITY_DERIVED,
                        'position'      => [ 'x' => 0, 'y' => -82 ],
                        'width'         => 140,
                        'depth'         => 30,
                        'roof_overhang' => 12,
                        'roof_height'   => 38,
                        'permeability'  => 0,
                    ],
                    [
                        'structure_id'  => 'light_tower_1',
                        'name'          => 'Light Tower NW',
                        'type'          => 'tower',
                        'height'        => 55,
                        'height_quality'=> self::QUALITY_ESTIMATED,
                        'position'      => [ 'x' => -95, 'y' => 80 ],
                        'width'         => 4,
                        'depth'         => 4,
                        'permeability'  => 0.95,
                    ],
                    [
                        'structure_id'  => 'light_tower_2',
                        'name'          => 'Light Tower NE',
                        'type'          => 'tower',
                        'height'        => 55,
                        'height_quality'=> self::QUALITY_ESTIMATED,
                        'position'      => [ 'x' => 95, 'y' => 80 ],
                        'width'         => 4,
                        'depth'         => 4,
                        'permeability'  => 0.95,
                    ],
                    [
                        'structure_id'  => 'light_tower_3',
                        'name'          => 'Light Tower SW',
                        'type'          => 'tower',
                        'height'        => 55,
                        'height_quality'=> self::QUALITY_ESTIMATED,
                        'position'      => [ 'x' => -95, 'y' => -80 ],
                        'width'         => 4,
                        'depth'         => 4,
                        'permeability'  => 0.95,
                    ],
                    [
                        'structure_id'  => 'light_tower_4',
                        'name'          => 'Light Tower SE',
                        'type'          => 'tower',
                        'height'        => 55,
                        'height_quality'=> self::QUALITY_ESTIMATED,
                        'position'      => [ 'x' => 95, 'y' => -80 ],
                        'width'         => 4,
                        'depth'         => 4,
                        'permeability'  => 0.95,
                    ],
                ],
                'notes' => 'Redeveloped 1993-2005 ($128M). Uniform height bowl (35m) with 2-3 internal tiers. White membrane roof. Constrained by Vulture St and Stanley St. 4 external light towers. May be demolished/redeveloped before 2032 Olympics.',
            ],
            
            'suncorp_stadium' => [
                'name'         => 'Suncorp Stadium',
                'common_names' => 'Lang Park The Cauldron Brisbane Stadium',
                'capacity'     => 52500,
                'location'     => [
                    'lat'      => -27.4648,
                    'lng'      => 153.0095,
                    'city'     => 'Brisbane',
                    'state'    => 'QLD',
                    'timezone' => 'Australia/Brisbane',
                ],
                'field'        => [
                    'type'        => 'rectangular',
                    'length'      => 136,         // Full field area (inc. run-off behind dead ball)
                    'width'       => 82,          // Full field area (inc. sideline run-off)
                    'playing_length' => 129,      // * Verified: playing surface (official)
                    'playing_width'  => 75,       // * Verified: playing surface (official)
                    'turf_length' => 129,         // Natural turf = playing_length (already inc. in-goals)
                    'turf_width'  => 75,          // Natural turf = playing_width
                    'orientation' => 0,           // N-S aligned
                ],
                'turf'         => [
                    'variety'     => 'couch',
                    'variety_name'=> 'Couch Grass',
                    'species'     => 'Cynodon dactylon',
                    'oversown'    => true,
                    'overseed_variety' => 'soprano',
                    'overseed_variety_name' => 'Soprano Perennial Ryegrass',
                    'overseed_species' => 'Lolium perenne',
                    'overseed_months'  => [ 3, 4, 5, 6, 7, 8, 9 ],
                    'notes'       => 'Couch base oversown with Soprano perennial ryegrass Apr-Sep.',
                ],
                'structures'   => [
                    [
                        'structure_id'  => 'western_stand',
                        'name'          => 'Western Grandstand',
                        'type'          => 'stand',
                        'height'        => 35,    // 1994 stand, retained in 2003 rebuild, lower than opposite
                        'height_quality'=> self::QUALITY_DERIVED,
                        'position'      => [ 'x' => -55, 'y' => 0 ],
                        'width'         => 30,
                        'depth'         => 140,
                        'roof_overhang' => 30,    // * Verified: 30m cantilever (BESIX Watpac)
                        'roof_height'   => 40,    // * Verified: 40m+ fascia height (QClad)
                        'permeability'  => 0,
                        'notes'         => 'Built 1994, retained in 2003 rebuild. 30m roof cantilever with mast/stay support at 15m.',
                    ],
                    [
                        'structure_id'  => 'eastern_stand',
                        'name'          => 'Eastern Stand',
                        'type'          => 'stand',
                        'height'        => 40,    // * Verified: 40m+ (QClad fascia reference)
                        'height_quality'=> self::QUALITY_VERIFIED,
                        'position'      => [ 'x' => 55, 'y' => 0 ],
                        'width'         => 35,
                        'depth'         => 140,
                        'roof_overhang' => 30,    // * Verified: 30m cantilever (BESIX Watpac)
                        'roof_height'   => 40,
                        'permeability'  => 0,
                    ],
                    [
                        'structure_id'  => 'northern_stand',
                        'name'          => 'Northern Stand',
                        'type'          => 'stand',
                        'height'        => 40,    // 2003 redevelopment - three tiers
                        'height_quality'=> self::QUALITY_DERIVED,
                        'position'      => [ 'x' => 0, 'y' => 78 ],
                        'width'         => 100,
                        'depth'         => 30,
                        'roof_overhang' => 25,
                        'roof_height'   => 40,
                        'permeability'  => 0,
                    ],
                    [
                        'structure_id'  => 'southern_stand',
                        'name'          => 'Southern Stand',
                        'type'          => 'stand',
                        'height'        => 40,
                        'height_quality'=> self::QUALITY_DERIVED,
                        'position'      => [ 'x' => 0, 'y' => -78 ],
                        'width'         => 100,
                        'depth'         => 30,
                        'roof_overhang' => 25,
                        'roof_height'   => 40,
                        'permeability'  => 0,
                    ],
                ],
                'notes' => 'Rebuilt 2001-2003 ($280M). Verified: 30m roof cantilever (BESIX Watpac), 40m+ fascia (QClad). 75% roof coverage. 3 tiers, 6m from sideline. Playing surface 129x75m (Wintergreen Bermuda/Perennial Rye). Possibly 2032 Olympics opening/closing ceremonies venue.',
            ],
            
            // =====================================================
            // TASMANIA
            // =====================================================
            
            'blundstone_arena' => [
                'name'         => 'Blundstone Arena',
                'common_names' => 'Bellerive Oval',
                'capacity'     => 20000,
                'location'     => [
                    'lat'      => -42.8769,
                    'lng'      => 147.3731,
                    'city'     => 'Hobart',
                    'state'    => 'TAS',
                    'timezone' => 'Australia/Hobart',
                ],
                'field'        => [
                    'type'        => 'oval',
                    'length'      => 165,
                    'width'       => 138,
                    'orientation' => 15,
                ],
                'structures'   => [
                    [
                        'structure_id'  => 'southern_stand',
                        'name'          => 'Southern Stand',
                        'type'          => 'stand',
                        'height'        => 20,
                        'height_quality'=> self::QUALITY_ESTIMATED,
                        'position'      => [ 'x' => 0, 'y' => -75 ],
                        'width'         => 120,
                        'depth'         => 25,
                        'roof_overhang' => 12,
                        'roof_height'   => 24,
                        'permeability'  => 0,
                    ],
                    [
                        'structure_id'  => 'northern_stands',
                        'name'          => 'Northern Grass Banks',
                        'type'          => 'stand',
                        'height'        => 8,     // Low grass embankment
                        'height_quality'=> self::QUALITY_ESTIMATED,
                        'position'      => [ 'x' => 0, 'y' => 75 ],
                        'width'         => 100,
                        'depth'         => 20,
                        'permeability'  => 0.9,
                    ],
                ],
                'notes' => 'Smaller venue. Mix of stands and grass embankments.',
            ],
            
            // =====================================================
            // VICTORIA - Additional
            // =====================================================
            
            'gmhba_stadium' => [
                'name'         => 'GMHBA Stadium',
                'common_names' => 'Kardinia Park Simonds Stadium Skilled Stadium',
                'capacity'     => 40000,
                'location'     => [
                    'lat'      => -38.1579,
                    'lng'      => 144.3545,
                    'city'     => 'Geelong',
                    'state'    => 'VIC',
                    'timezone' => 'Australia/Melbourne',
                ],
                'field'        => [
                    'type'        => 'oval',
                    'length'      => 170,
                    'width'       => 115,      // Narrowest AFL ground
                    'orientation' => 0,
                ],
                'turf'         => [
                    'variety'     => 'couch',
                    'variety_name'=> 'Couch Grass',
                    'species'     => 'Cynodon dactylon',
                    'oversown'    => true,
                    'overseed_variety' => 'perennial_rye',
                    'overseed_species' => 'Lolium perenne',
                    'overseed_months'  => [ 3, 4, 5, 6, 7, 8, 9 ],
                    'notes'       => 'Couch base oversown with perennial ryegrass Apr-Sep. Kardinia Park, Geelong.',
                ],
                'structures'   => [
                    [
                        'structure_id'  => 'brownlow_stand',
                        'name'          => 'Brownlow Stand',
                        'type'          => 'stand',
                        'height'        => 32,
                        'height_quality'=> self::QUALITY_ESTIMATED,
                        'position'      => [ 'x' => -65, 'y' => 0 ],
                        'width'         => 35,
                        'depth'         => 160,
                        'roof_overhang' => 18,
                        'roof_height'   => 36,
                        'permeability'  => 0,
                    ],
                    [
                        'structure_id'  => 'ford_stand',
                        'name'          => 'Ford Stand',
                        'type'          => 'stand',
                        'height'        => 28,
                        'height_quality'=> self::QUALITY_ESTIMATED,
                        'position'      => [ 'x' => 65, 'y' => 0 ],
                        'width'         => 30,
                        'depth'         => 140,
                        'roof_overhang' => 15,
                        'roof_height'   => 32,
                        'permeability'  => 0,
                    ],
                    [
                        'structure_id'  => 'hickey_stand',
                        'name'          => 'Hickey Stand',
                        'type'          => 'stand',
                        'height'        => 30,
                        'height_quality'=> self::QUALITY_ESTIMATED,
                        'position'      => [ 'x' => 0, 'y' => 90 ],
                        'width'         => 100,
                        'depth'         => 30,
                        'roof_overhang' => 16,
                        'roof_height'   => 34,
                        'permeability'  => 0,
                    ],
                ],
                'notes' => 'Narrowest AFL ground at 115m wide.',
            ],
            
            // =====================================================
            // AUSTRALIAN CAPITAL TERRITORY
            // =====================================================
            
            'gio_stadium' => [
                'name'         => 'GIO Stadium',
                'common_names' => 'Canberra Stadium Bruce Stadium',
                'capacity'     => 25011,
                'location'     => [
                    'lat'      => -35.2505,
                    'lng'      => 149.1019,
                    'city'     => 'Canberra',
                    'state'    => 'ACT',
                    'timezone' => 'Australia/Sydney',
                ],
                'field'        => [
                    'type'        => 'rectangular',
                    'length'      => 120,
                    'width'       => 80,
                    'playing_length' => 100,
                    'playing_width'  => 68,
                    'turf_length' => 120,      // Full NRL: 100m + 2×10m in-goal
                    'turf_width'  => 68,
                    'orientation' => -8,    // Slight NNW-SSE alignment
                ],
                'turf'         => [
                    'variety'     => 'couch',
                    'variety_name'=> 'Couch Grass',
                    'species'     => 'Cynodon dactylon',
                    'construction'=> 'sand_carpet',   // b35fix166: NRL stadium standard
                    'oversown'    => true,
                    'overseed_variety' => 'perennial_rye',
                    'overseed_species' => 'Lolium perenne',
                    'overseed_months'  => [ 3, 4, 5, 6, 7, 8, 9 ],
                    'notes'       => 'Couch base oversown with perennial ryegrass Apr-Sep. Canberra.',
                ],
                'structures'   => [
                    [
                        'structure_id'  => 'western_stand',
                        'name'          => 'Western Stand (Members)',
                        'type'          => 'stand',
                        'height'        => 22,     // ~ Two tier
                        'height_quality'=> self::QUALITY_ESTIMATED,
                        'position'      => [ 'x' => -55, 'y' => 0 ],
                        'width'         => 30,
                        'depth'         => 100,
                        'roof_overhang' => 12,
                        'roof_height'   => 26,
                        'permeability'  => 0,
                    ],
                    [
                        'structure_id'  => 'eastern_stand',
                        'name'          => 'Eastern Stand',
                        'type'          => 'stand',
                        'height'        => 20,
                        'height_quality'=> self::QUALITY_ESTIMATED,
                        'position'      => [ 'x' => 55, 'y' => 0 ],
                        'width'         => 28,
                        'depth'         => 95,
                        'roof_overhang' => 10,
                        'roof_height'   => 24,
                        'permeability'  => 0,
                    ],
                    [
                        'structure_id'  => 'northern_stand',
                        'name'          => 'Northern Stand',
                        'type'          => 'stand',
                        'height'        => 16,     // ~ Smaller end stand
                        'height_quality'=> self::QUALITY_ESTIMATED,
                        'position'      => [ 'x' => 0, 'y' => 70 ],
                        'width'         => 65,
                        'depth'         => 20,
                        'roof_overhang' => 8,
                        'roof_height'   => 20,
                        'permeability'  => 0,
                    ],
                    [
                        'structure_id'  => 'southern_stand',
                        'name'          => 'Southern Stand',
                        'type'          => 'stand',
                        'height'        => 16,
                        'height_quality'=> self::QUALITY_ESTIMATED,
                        'position'      => [ 'x' => 0, 'y' => -70 ],
                        'width'         => 65,
                        'depth'         => 20,
                        'roof_overhang' => 8,
                        'roof_height'   => 20,
                        'permeability'  => 0,
                    ],
                ],
                'notes' => 'Home of ACT Brumbies and Canberra Raiders. Rectangular layout.',
            ],
            
            // =====================================================
            // QUEENSLAND - Additional
            // =====================================================
            
            'qcb_stadium' => [
                'name'         => 'Queensland Country Bank Stadium',
                'common_names' => 'Townsville Stadium North Queensland Stadium',
                'capacity'     => 25000,
                'location'     => [
                    'lat'      => -19.2586,
                    'lng'      => 146.8055,
                    'city'     => 'Townsville',
                    'state'    => 'QLD',
                    'timezone' => 'Australia/Brisbane',
                ],
                'field'        => [
                    'type'        => 'rectangular',
                    'length'      => 122,
                    'width'       => 78,
                    'playing_length' => 100,
                    'playing_width'  => 68,
                    'turf_length' => 120,      // Full NRL: 100m + 2×10m in-goal
                    'turf_width'  => 68,       // 122m outer includes 2m run-off each end
                    'orientation' => 15,    // NNE-SSW alignment
                ],
                'structures'   => [
                    [
                        'structure_id'  => 'western_stand',
                        'name'          => 'Western Stand',
                        'type'          => 'stand',
                        'height'        => 28,     // * Contemporary build 2020
                        'height_quality'=> self::QUALITY_DERIVED,
                        'position'      => [ 'x' => -55, 'y' => 0 ],
                        'width'         => 32,
                        'depth'         => 110,
                        'roof_overhang' => 20,     // Contemporary cantilever
                        'roof_height'   => 35,
                        'permeability'  => 0.1,    // ETFE panels
                    ],
                    [
                        'structure_id'  => 'eastern_stand',
                        'name'          => 'Eastern Stand',
                        'type'          => 'stand',
                        'height'        => 28,
                        'height_quality'=> self::QUALITY_DERIVED,
                        'position'      => [ 'x' => 55, 'y' => 0 ],
                        'width'         => 32,
                        'depth'         => 110,
                        'roof_overhang' => 20,
                        'roof_height'   => 35,
                        'permeability'  => 0.1,
                    ],
                    [
                        'structure_id'  => 'northern_stand',
                        'name'          => 'Northern Stand',
                        'type'          => 'stand',
                        'height'        => 26,
                        'height_quality'=> self::QUALITY_DERIVED,
                        'position'      => [ 'x' => 0, 'y' => 72 ],
                        'width'         => 70,
                        'depth'         => 28,
                        'roof_overhang' => 18,
                        'roof_height'   => 32,
                        'permeability'  => 0.1,
                    ],
                    [
                        'structure_id'  => 'southern_stand',
                        'name'          => 'Southern Stand',
                        'type'          => 'stand',
                        'height'        => 26,
                        'height_quality'=> self::QUALITY_DERIVED,
                        'position'      => [ 'x' => 0, 'y' => -72 ],
                        'width'         => 70,
                        'depth'         => 28,
                        'roof_overhang' => 18,
                        'roof_height'   => 32,
                        'permeability'  => 0.1,
                    ],
                ],
                'notes' => 'Opened 2020. Home of North Queensland Cowboys. Full bowl design with ETFE roof panels. Tropical climate venue.',
            ],
            
            // =====================================================
            // WESTERN AUSTRALIA - Additional
            // =====================================================
            
            'waca' => [
                'name'         => 'WACA Ground',
                'common_names' => 'WACA Perth Cricket Ground Western Australian Cricket Association Ground',
                'capacity'     => 24500,
                'location'     => [
                    'lat'      => -31.9605,
                    'lng'      => 115.8792,
                    'city'     => 'Perth',
                    'state'    => 'WA',
                    'timezone' => 'Australia/Perth',
                ],
                'field'        => [
                    'type'        => 'oval',
                    'length'      => 160,
                    'width'       => 140,
                    'orientation' => 5,
                ],
                'turf'         => [
                    'variety'     => 'couch',
                    'variety_name'=> 'Couch Grass',
                    'species'     => 'Cynodon dactylon',
                    'oversown'    => true,
                    'overseed_variety' => 'perennial_rye',
                    'overseed_species' => 'Lolium perenne',
                    'overseed_months'  => [ 3, 4, 5, 6, 7, 8, 9 ],
                    'notes'       => 'Couch base oversown with perennial ryegrass Apr-Sep. Perth.',
                ],
                'structures'   => [
                    [
                        'structure_id'  => 'lillee_marsh_stand',
                        'name'          => 'Lillee-Marsh Stand',
                        'type'          => 'stand',
                        'height'        => 24,     // * Two tier from redevelopment
                        'height_quality'=> self::QUALITY_DERIVED,
                        'position'      => [ 'x' => -80, 'y' => 0 ],
                        'width'         => 30,
                        'depth'         => 120,
                        'roof_overhang' => 12,
                        'roof_height'   => 28,
                        'permeability'  => 0,
                    ],
                    [
                        'structure_id'  => 'inverarity_stand',
                        'name'          => 'Inverarity Stand',
                        'type'          => 'stand',
                        'height'        => 18,     // ~ Heritage single tier
                        'height_quality'=> self::QUALITY_ESTIMATED,
                        'position'      => [ 'x' => 75, 'y' => 20 ],
                        'width'         => 22,
                        'depth'         => 80,
                        'roof_overhang' => 6,
                        'roof_height'   => 22,
                        'permeability'  => 0,
                    ],
                    [
                        'structure_id'  => 'prindiville_stand',
                        'name'          => 'Prindiville Stand',
                        'type'          => 'stand',
                        'height'        => 22,
                        'height_quality'=> self::QUALITY_ESTIMATED,
                        'position'      => [ 'x' => 0, 'y' => -85 ],
                        'width'         => 100,
                        'depth'         => 25,
                        'roof_overhang' => 10,
                        'roof_height'   => 26,
                        'permeability'  => 0,
                    ],
                    [
                        'structure_id'  => 'players_pavilion',
                        'name'          => 'Players Pavilion',
                        'type'          => 'stand',
                        'height'        => 12,     // ~ Heritage building
                        'height_quality'=> self::QUALITY_ESTIMATED,
                        'position'      => [ 'x' => -30, 'y' => 85 ],
                        'width'         => 50,
                        'depth'         => 18,
                        'roof_overhang' => 4,
                        'roof_height'   => 14,
                        'permeability'  => 0,
                    ],
                ],
                'notes' => 'Historic Test cricket venue. Mix of heritage and modern stands. Known for pace and bounce.',
            ],
            
            // =====================================================
            // UNITED KINGDOM - PREMIER LEAGUE
            // =====================================================
            
            'old_trafford' => [
                'name'         => 'Old Trafford',
                'common_names' => 'Theatre of Dreams',
                'capacity'     => 74310,
                'location'     => [
                    'lat'      => 53.4631,
                    'lng'      => -2.2913,
                    'city'     => 'Manchester',
                    'state'    => 'England',
                    'timezone' => 'Europe/London',
                ],
                'field'        => [
                    'type'        => 'rectangular',
                    'length'      => 105,
                    'width'       => 68,
                    'orientation' => 12,    // Slight NNE-SSW
                ],
                'turf'         => [
                    'variety'     => 'perennial_rye',
                    'variety_name'=> 'Perennial Ryegrass',
                    'species'     => 'Lolium perenne',
                    'cultivar'    => 'Desso GrassMaster hybrid',
                    'hybrid_system'=> true,
                    'notes'       => 'Desso GrassMaster reinforced natural turf (95% natural, 5% synthetic fibres). Uses mobile SGL rigs for shade management.',
                ],
                'structures'   => [
                    [
                        'structure_id'  => 'sir_alex_ferguson_stand',
                        'name'          => 'Sir Alex Ferguson Stand (North)',
                        'type'          => 'stand',
                        'height'        => 42,     // * Three tier, largest in UK
                        'height_quality'=> self::QUALITY_DERIVED,
                        'position'      => [ 'x' => 0, 'y' => 55 ],
                        'width'         => 120,
                        'depth'         => 45,
                        'roof_overhang' => 22,
                        'roof_height'   => 48,
                        'permeability'  => 0,
                    ],
                    [
                        'structure_id'  => 'south_stand',
                        'name'          => 'South Stand',
                        'type'          => 'stand',
                        'height'        => 38,
                        'height_quality'=> self::QUALITY_DERIVED,
                        'position'      => [ 'x' => 0, 'y' => -52 ],
                        'width'         => 115,
                        'depth'         => 40,
                        'roof_overhang' => 18,
                        'roof_height'   => 44,
                        'permeability'  => 0,
                    ],
                    [
                        'structure_id'  => 'stretford_end',
                        'name'          => 'Stretford End (West)',
                        'type'          => 'stand',
                        'height'        => 36,
                        'height_quality'=> self::QUALITY_DERIVED,
                        'position'      => [ 'x' => -55, 'y' => 0 ],
                        'width'         => 38,
                        'depth'         => 75,
                        'roof_overhang' => 16,
                        'roof_height'   => 42,
                        'permeability'  => 0,
                    ],
                    [
                        'structure_id'  => 'east_stand',
                        'name'          => 'East Stand',
                        'type'          => 'stand',
                        'height'        => 35,
                        'height_quality'=> self::QUALITY_DERIVED,
                        'position'      => [ 'x' => 52, 'y' => 0 ],
                        'width'         => 35,
                        'depth'         => 70,
                        'roof_overhang' => 15,
                        'roof_height'   => 40,
                        'permeability'  => 0,
                    ],
                ],
                'notes' => 'Manchester United. One of the largest club stadiums in Europe.',
            ],
            
            'anfield' => [
                'name'         => 'Anfield',
                'common_names' => 'Anfield Road',
                'capacity'     => 61276,
                'location'     => [
                    'lat'      => 53.4308,
                    'lng'      => -2.9608,
                    'city'     => 'Liverpool',
                    'state'    => 'England',
                    'timezone' => 'Europe/London',
                ],
                'field'        => [
                    'type'        => 'rectangular',
                    'length'      => 101,
                    'width'       => 68,
                    'orientation' => -5,
                ],
                'turf'         => [
                    'variety'     => 'perennial_rye',
                    'variety_name'=> 'Perennial Ryegrass',
                    'species'     => 'Lolium perenne',
                    'cultivar'    => 'GrassMaster hybrid',
                    'hybrid_system'=> true,
                    'notes'       => 'Fibresand reinforced pitch. Uses extensive SGL rig deployment, especially under Main Stand shadow.',
                ],
                'structures'   => [
                    [
                        'structure_id'  => 'main_stand',
                        'name'          => 'Main Stand (West)',
                        'type'          => 'stand',
                        'height'        => 45,     // * 2016 expansion, tallest in UK
                        'height_quality'=> self::QUALITY_VERIFIED,
                        'position'      => [ 'x' => -52, 'y' => 0 ],
                        'width'         => 40,
                        'depth'         => 95,
                        'roof_overhang' => 25,
                        'roof_height'   => 52,
                        'permeability'  => 0,
                    ],
                    [
                        'structure_id'  => 'anfield_road_end',
                        'name'          => 'Anfield Road End',
                        'type'          => 'stand',
                        'height'        => 40,     // * 2023 expansion
                        'height_quality'=> self::QUALITY_DERIVED,
                        'position'      => [ 'x' => 0, 'y' => -58 ],
                        'width'         => 85,
                        'depth'         => 35,
                        'roof_overhang' => 20,
                        'roof_height'   => 46,
                        'permeability'  => 0,
                    ],
                    [
                        'structure_id'  => 'the_kop',
                        'name'          => 'The Kop (North)',
                        'type'          => 'stand',
                        'height'        => 30,     // Single tier steep
                        'height_quality'=> self::QUALITY_ESTIMATED,
                        'position'      => [ 'x' => 0, 'y' => 52 ],
                        'width'         => 80,
                        'depth'         => 30,
                        'roof_overhang' => 12,
                        'roof_height'   => 35,
                        'permeability'  => 0,
                    ],
                    [
                        'structure_id'  => 'kenny_dalglish_stand',
                        'name'          => 'Sir Kenny Dalglish Stand (East)',
                        'type'          => 'stand',
                        'height'        => 28,
                        'height_quality'=> self::QUALITY_ESTIMATED,
                        'position'      => [ 'x' => 48, 'y' => 0 ],
                        'width'         => 30,
                        'depth'         => 85,
                        'roof_overhang' => 10,
                        'roof_height'   => 32,
                        'permeability'  => 0,
                    ],
                ],
                'notes' => 'Liverpool FC. Main Stand at 45m is one of the tallest single structures in English football.',
            ],
            
            'tottenham_hotspur_stadium' => [
                'name'         => 'Tottenham Hotspur Stadium',
                'common_names' => 'Spurs Stadium New White Hart Lane',
                'capacity'     => 62850,
                'location'     => [
                    'lat'      => 51.6043,
                    'lng'      => -0.0665,
                    'city'     => 'London',
                    'state'    => 'England',
                    'timezone' => 'Europe/London',
                ],
                'field'        => [
                    'type'        => 'rectangular',
                    'length'      => 105,
                    'width'       => 68,
                    'orientation' => 0,
                ],
                'structures'   => [
                    [
                        'structure_id'  => 'south_stand',
                        'name'          => 'South Stand',
                        'type'          => 'stand',
                        'height'        => 42,     // * Single tier 17,500 capacity
                        'height_quality'=> self::QUALITY_VERIFIED,
                        'position'      => [ 'x' => 0, 'y' => -55 ],
                        'width'         => 110,
                        'depth'         => 40,
                        'roof_overhang' => 22,
                        'roof_height'   => 48,
                        'permeability'  => 0,
                    ],
                    [
                        'structure_id'  => 'north_stand',
                        'name'          => 'North Stand',
                        'type'          => 'stand',
                        'height'        => 38,
                        'height_quality'=> self::QUALITY_DERIVED,
                        'position'      => [ 'x' => 0, 'y' => 52 ],
                        'width'         => 105,
                        'depth'         => 38,
                        'roof_overhang' => 20,
                        'roof_height'   => 44,
                        'permeability'  => 0,
                    ],
                    [
                        'structure_id'  => 'east_stand',
                        'name'          => 'East Stand',
                        'type'          => 'stand',
                        'height'        => 36,
                        'height_quality'=> self::QUALITY_DERIVED,
                        'position'      => [ 'x' => 52, 'y' => 0 ],
                        'width'         => 35,
                        'depth'         => 90,
                        'roof_overhang' => 18,
                        'roof_height'   => 42,
                        'permeability'  => 0,
                    ],
                    [
                        'structure_id'  => 'west_stand',
                        'name'          => 'West Stand',
                        'type'          => 'stand',
                        'height'        => 36,
                        'height_quality'=> self::QUALITY_DERIVED,
                        'position'      => [ 'x' => -52, 'y' => 0 ],
                        'width'         => 35,
                        'depth'         => 90,
                        'roof_overhang' => 18,
                        'roof_height'   => 42,
                        'permeability'  => 0,
                    ],
                ],
                'notes' => 'Opened 2019. Features retractable pitch for NFL games. Enclosed bowl with substantial roof coverage.',
            ],
            
            'etihad_stadium' => [
                'name'         => 'Etihad Stadium',
                'common_names' => 'City of Manchester Stadium Eastlands',
                'capacity'     => 53400,
                'location'     => [
                    'lat'      => 53.4831,
                    'lng'      => -2.2003,
                    'city'     => 'Manchester',
                    'state'    => 'England',
                    'timezone' => 'Europe/London',
                ],
                'field'        => [
                    'type'        => 'rectangular',
                    'length'      => 105,
                    'width'       => 68,
                    'orientation' => -5,
                ],
                'structures'   => [
                    [
                        'structure_id'  => 'colin_bell_stand',
                        'name'          => 'Colin Bell Stand (West)',
                        'type'          => 'stand',
                        'height'        => 35,     // * Three tier
                        'height_quality'=> self::QUALITY_DERIVED,
                        'position'      => [ 'x' => -52, 'y' => 0 ],
                        'width'         => 35,
                        'depth'         => 95,
                        'roof_overhang' => 18,
                        'roof_height'   => 42,
                        'permeability'  => 0,
                    ],
                    [
                        'structure_id'  => 'east_stand',
                        'name'          => 'East Stand',
                        'type'          => 'stand',
                        'height'        => 35,
                        'height_quality'=> self::QUALITY_DERIVED,
                        'position'      => [ 'x' => 52, 'y' => 0 ],
                        'width'         => 35,
                        'depth'         => 95,
                        'roof_overhang' => 18,
                        'roof_height'   => 42,
                        'permeability'  => 0,
                    ],
                    [
                        'structure_id'  => 'north_stand',
                        'name'          => 'North Stand',
                        'type'          => 'stand',
                        'height'        => 32,     // * 2015 expansion third tier
                        'height_quality'=> self::QUALITY_DERIVED,
                        'position'      => [ 'x' => 0, 'y' => 52 ],
                        'width'         => 85,
                        'depth'         => 32,
                        'roof_overhang' => 16,
                        'roof_height'   => 38,
                        'permeability'  => 0,
                    ],
                    [
                        'structure_id'  => 'south_stand',
                        'name'          => 'South Stand',
                        'type'          => 'stand',
                        'height'        => 32,
                        'height_quality'=> self::QUALITY_DERIVED,
                        'position'      => [ 'x' => 0, 'y' => -52 ],
                        'width'         => 85,
                        'depth'         => 32,
                        'roof_overhang' => 16,
                        'roof_height'   => 38,
                        'permeability'  => 0,
                    ],
                ],
                'notes' => 'Manchester City. Originally built for 2002 Commonwealth Games. Cable-stayed roof design.',
            ],
            
            'emirates_stadium' => [
                'name'         => 'Emirates Stadium',
                'common_names' => 'Ashburton Grove The Emirates',
                'capacity'     => 60704,
                'location'     => [
                    'lat'      => 51.5549,
                    'lng'      => -0.1084,
                    'city'     => 'London',
                    'state'    => 'England',
                    'timezone' => 'Europe/London',
                ],
                'field'        => [
                    'type'        => 'rectangular',
                    'length'      => 105,
                    'width'       => 68,
                    'orientation' => -15,
                ],
                'structures'   => [
                    [
                        'structure_id'  => 'north_bank',
                        'name'          => 'North Bank',
                        'type'          => 'stand',
                        'height'        => 40,
                        'height_quality'=> self::QUALITY_DERIVED,
                        'position'      => [ 'x' => 0, 'y' => 55 ],
                        'width'         => 100,
                        'depth'         => 38,
                        'roof_overhang' => 20,
                        'roof_height'   => 46,
                        'permeability'  => 0.15,   // Translucent panels
                    ],
                    [
                        'structure_id'  => 'clock_end',
                        'name'          => 'Clock End (South)',
                        'type'          => 'stand',
                        'height'        => 40,
                        'height_quality'=> self::QUALITY_DERIVED,
                        'position'      => [ 'x' => 0, 'y' => -55 ],
                        'width'         => 100,
                        'depth'         => 38,
                        'roof_overhang' => 20,
                        'roof_height'   => 46,
                        'permeability'  => 0.15,
                    ],
                    [
                        'structure_id'  => 'west_stand',
                        'name'          => 'West Stand',
                        'type'          => 'stand',
                        'height'        => 38,
                        'height_quality'=> self::QUALITY_DERIVED,
                        'position'      => [ 'x' => -53, 'y' => 0 ],
                        'width'         => 36,
                        'depth'         => 95,
                        'roof_overhang' => 18,
                        'roof_height'   => 44,
                        'permeability'  => 0.15,
                    ],
                    [
                        'structure_id'  => 'east_stand',
                        'name'          => 'East Stand',
                        'type'          => 'stand',
                        'height'        => 38,
                        'height_quality'=> self::QUALITY_DERIVED,
                        'position'      => [ 'x' => 53, 'y' => 0 ],
                        'width'         => 36,
                        'depth'         => 95,
                        'roof_overhang' => 18,
                        'roof_height'   => 44,
                        'permeability'  => 0.15,
                    ],
                ],
                'notes' => 'Arsenal FC. Opened 2006. Enclosed bowl with distinctive triangular roof panels.',
            ],
            
            'stamford_bridge' => [
                'name'         => 'Stamford Bridge',
                'common_names' => 'The Bridge',
                'capacity'     => 40343,
                'location'     => [
                    'lat'      => 51.4817,
                    'lng'      => -0.1910,
                    'city'     => 'London',
                    'state'    => 'England',
                    'timezone' => 'Europe/London',
                ],
                'field'        => [
                    'type'        => 'rectangular',
                    'length'      => 103,
                    'width'       => 67,
                    'orientation' => -25,
                ],
                'structures'   => [
                    [
                        'structure_id'  => 'west_stand',
                        'name'          => 'West Stand',
                        'type'          => 'stand',
                        'height'        => 32,
                        'height_quality'=> self::QUALITY_ESTIMATED,
                        'position'      => [ 'x' => -50, 'y' => 0 ],
                        'width'         => 32,
                        'depth'         => 85,
                        'roof_overhang' => 14,
                        'roof_height'   => 36,
                        'permeability'  => 0,
                    ],
                    [
                        'structure_id'  => 'east_stand',
                        'name'          => 'East Stand',
                        'type'          => 'stand',
                        'height'        => 30,
                        'height_quality'=> self::QUALITY_ESTIMATED,
                        'position'      => [ 'x' => 48, 'y' => 0 ],
                        'width'         => 30,
                        'depth'         => 82,
                        'roof_overhang' => 12,
                        'roof_height'   => 34,
                        'permeability'  => 0,
                    ],
                    [
                        'structure_id'  => 'matthew_harding_stand',
                        'name'          => 'Matthew Harding Stand (North)',
                        'type'          => 'stand',
                        'height'        => 28,
                        'height_quality'=> self::QUALITY_ESTIMATED,
                        'position'      => [ 'x' => 0, 'y' => 48 ],
                        'width'         => 75,
                        'depth'         => 28,
                        'roof_overhang' => 10,
                        'roof_height'   => 32,
                        'permeability'  => 0,
                    ],
                    [
                        'structure_id'  => 'shed_end',
                        'name'          => 'Shed End (South)',
                        'type'          => 'stand',
                        'height'        => 28,
                        'height_quality'=> self::QUALITY_ESTIMATED,
                        'position'      => [ 'x' => 0, 'y' => -48 ],
                        'width'         => 75,
                        'depth'         => 28,
                        'roof_overhang' => 10,
                        'roof_height'   => 32,
                        'permeability'  => 0,
                    ],
                ],
                'notes' => 'Chelsea FC. Constrained site with mix of stand ages. Redevelopment planned.',
            ],
            
            // =====================================================
            // ENGLAND - PREMIER LEAGUE (remaining)
            // =====================================================
            
            'villa_park' => [
                'name'         => 'Villa Park',
                'common_names' => 'Aston Villa',
                'capacity'     => 42682,
                'location'     => [
                    'lat'      => 52.5092,
                    'lng'      => -1.8847,
                    'city'     => 'Birmingham',
                    'state'    => 'England',
                    'timezone' => 'Europe/London',
                ],
                'field'        => [
                    'type'        => 'rectangular',
                    'length'      => 105,
                    'width'       => 68,
                    'orientation' => 0,
                ],
                'structures'   => self::generate_rectangular_stands( 42, 38 ),
                'notes' => 'Historic ground, mix of modern and traditional stands.',
            ],
            
            'st_james_park' => [
                'name'         => 'St James\' Park',
                'common_names' => 'Newcastle United',
                'capacity'     => 52305,
                'location'     => [
                    'lat'      => 54.9756,
                    'lng'      => -1.6217,
                    'city'     => 'Newcastle',
                    'state'    => 'England',
                    'timezone' => 'Europe/London',
                ],
                'field'        => [
                    'type'        => 'rectangular',
                    'length'      => 105,
                    'width'       => 68,
                    'orientation' => -10,
                ],
                'structures'   => self::generate_rectangular_stands( 48, 42 ),
                'notes' => 'City centre location. Asymmetric - Milburn/Leazes much taller than Gallowgate.',
            ],
            
            'bramley_moore_dock' => [
                'name'         => 'Bramley-Moore Dock Stadium',
                'common_names' => 'Everton Stadium',
                'capacity'     => 52888,
                'location'     => [
                    'lat'      => 53.4347,
                    'lng'      => -2.9972,
                    'city'     => 'Liverpool',
                    'state'    => 'England',
                    'timezone' => 'Europe/London',
                ],
                'field'        => [
                    'type'        => 'rectangular',
                    'length'      => 105,
                    'width'       => 68,
                    'orientation' => 0,
                ],
                'structures'   => self::generate_rectangular_stands( 34, 34 ),
                'notes' => 'New Everton stadium opening 2025. Waterfront location.',
            ],
            
            'molineux' => [
                'name'         => 'Molineux Stadium',
                'common_names' => 'Wolves Wolverhampton',
                'capacity'     => 32050,
                'location'     => [
                    'lat'      => 52.5902,
                    'lng'      => -2.1305,
                    'city'     => 'Wolverhampton',
                    'state'    => 'England',
                    'timezone' => 'Europe/London',
                ],
                'field'        => [
                    'type'        => 'rectangular',
                    'length'      => 105,
                    'width'       => 68,
                    'orientation' => 0,
                ],
                'structures'   => self::generate_rectangular_stands( 30, 26 ),
                'notes' => 'Compact ground with Steve Bull Stand dominating south side.',
            ],
            
            'london_stadium' => [
                'name'         => 'London Stadium',
                'common_names' => 'West Ham Olympic Stadium',
                'capacity'     => 62500,
                'location'     => [
                    'lat'      => 51.5387,
                    'lng'      => -0.0166,
                    'city'     => 'London',
                    'state'    => 'England',
                    'timezone' => 'Europe/London',
                ],
                'field'        => [
                    'type'        => 'rectangular',
                    'length'      => 105,
                    'width'       => 68,
                    'orientation' => 0,
                ],
                'structures'   => self::generate_rectangular_stands( 42, 38 ),
                'notes' => '2012 Olympics venue. Running track creates distance from pitch.',
            ],
            
            'the_amex' => [
                'name'         => 'Amex Stadium',
                'common_names' => 'Brighton Falmer Stadium',
                'capacity'     => 31800,
                'location'     => [
                    'lat'      => 50.8617,
                    'lng'      => -0.0833,
                    'city'     => 'Brighton',
                    'state'    => 'England',
                    'timezone' => 'Europe/London',
                ],
                'field'        => [
                    'type'        => 'rectangular',
                    'length'      => 105,
                    'width'       => 68,
                    'orientation' => 15,
                ],
                'structures'   => self::generate_rectangular_stands( 28, 24 ),
                'notes' => 'Modern stadium opened 2011. South Downs location.',
            ],
            
            'selhurst_park' => [
                'name'         => 'Selhurst Park',
                'common_names' => 'Crystal Palace',
                'capacity'     => 25486,
                'location'     => [
                    'lat'      => 51.3983,
                    'lng'      => -0.0856,
                    'city'     => 'London',
                    'state'    => 'England',
                    'timezone' => 'Europe/London',
                ],
                'field'        => [
                    'type'        => 'rectangular',
                    'length'      => 101,
                    'width'       => 68,
                    'orientation' => 0,
                ],
                'structures'   => self::generate_rectangular_stands( 26, 22 ),
                'notes' => 'Compact traditional ground. Main Stand redevelopment planned.',
            ],
            
            'st_marys_stadium' => [
                'name'         => 'St Mary\'s Stadium',
                'common_names' => 'Southampton',
                'capacity'     => 32384,
                'location'     => [
                    'lat'      => 50.9058,
                    'lng'      => -1.3910,
                    'city'     => 'Southampton',
                    'state'    => 'England',
                    'timezone' => 'Europe/London',
                ],
                'field'        => [
                    'type'        => 'rectangular',
                    'length'      => 105,
                    'width'       => 68,
                    'orientation' => 0,
                ],
                'structures'   => self::generate_rectangular_stands( 32, 28 ),
                'notes' => 'Opened 2001. Modern bowl design, consistent stand heights.',
            ],
            
            'brentford_community' => [
                'name'         => 'Gtech Community Stadium',
                'common_names' => 'Brentford',
                'capacity'     => 17250,
                'location'     => [
                    'lat'      => 51.4907,
                    'lng'      => -0.2887,
                    'city'     => 'London',
                    'state'    => 'England',
                    'timezone' => 'Europe/London',
                ],
                'field'        => [
                    'type'        => 'rectangular',
                    'length'      => 105,
                    'width'       => 68,
                    'orientation' => 0,
                ],
                'structures'   => self::generate_rectangular_stands( 22, 20 ),
                'notes' => 'Opened 2020. Compact modern design, close to pitch.',
            ],
            
            'vitality_stadium' => [
                'name'         => 'Vitality Stadium',
                'common_names' => 'Bournemouth Dean Court',
                'capacity'     => 11307,
                'location'     => [
                    'lat'      => 50.7352,
                    'lng'      => -1.8384,
                    'city'     => 'Bournemouth',
                    'state'    => 'England',
                    'timezone' => 'Europe/London',
                ],
                'field'        => [
                    'type'        => 'rectangular',
                    'length'      => 105,
                    'width'       => 68,
                    'orientation' => 0,
                ],
                'structures'   => self::generate_rectangular_stands( 18, 16 ),
                'notes' => 'Smallest PL ground. South stand temporary structure.',
            ],
            
            'portman_road' => [
                'name'         => 'Portman Road',
                'common_names' => 'Ipswich Town',
                'capacity'     => 30311,
                'location'     => [
                    'lat'      => 52.0545,
                    'lng'      => 1.1447,
                    'city'     => 'Ipswich',
                    'state'    => 'England',
                    'timezone' => 'Europe/London',
                ],
                'field'        => [
                    'type'        => 'rectangular',
                    'length'      => 102,
                    'width'       => 66,
                    'orientation' => 0,
                ],
                'structures'   => self::generate_rectangular_stands( 28, 24 ),
                'notes' => 'Traditional English ground. Promoted to PL 2024.',
            ],
            
            'city_ground' => [
                'name'         => 'City Ground',
                'common_names' => 'Nottingham Forest',
                'capacity'     => 30602,
                'location'     => [
                    'lat'      => 52.9400,
                    'lng'      => -1.1328,
                    'city'     => 'Nottingham',
                    'state'    => 'England',
                    'timezone' => 'Europe/London',
                ],
                'field'        => [
                    'type'        => 'rectangular',
                    'length'      => 105,
                    'width'       => 68,
                    'orientation' => 5,
                ],
                'structures'   => self::generate_rectangular_stands( 32, 28 ),
                'notes' => 'Riverside location on River Trent. Peter Taylor Stand newest.',
            ],
            
            'carrow_road' => [
                'name'         => 'Carrow Road',
                'common_names' => 'Norwich City',
                'capacity'     => 27359,
                'location'     => [
                    'lat'      => 52.6221,
                    'lng'      => 1.3094,
                    'city'     => 'Norwich',
                    'state'    => 'England',
                    'timezone' => 'Europe/London',
                ],
                'field'        => [
                    'type'        => 'rectangular',
                    'length'      => 105,
                    'width'       => 68,
                    'orientation' => 0,
                ],
                'structures'   => self::generate_rectangular_stands( 26, 22 ),
                'notes' => 'Compact ground with Barclay End behind goal.',
            ],
            
            'king_power' => [
                'name'         => 'King Power Stadium',
                'common_names' => 'Leicester City',
                'capacity'     => 32261,
                'location'     => [
                    'lat'      => 52.6203,
                    'lng'      => -1.1422,
                    'city'     => 'Leicester',
                    'state'    => 'England',
                    'timezone' => 'Europe/London',
                ],
                'field'        => [
                    'type'        => 'rectangular',
                    'length'      => 105,
                    'width'       => 68,
                    'orientation' => 0,
                ],
                'structures'   => self::generate_rectangular_stands( 30, 26 ),
                'notes' => 'Opened 2002. Uniform bowl design.',
            ],
            
            'elland_road' => [
                'name'         => 'Elland Road',
                'common_names' => 'Leeds United',
                'capacity'     => 37890,
                'location'     => [
                    'lat'      => 53.7778,
                    'lng'      => -1.5722,
                    'city'     => 'Leeds',
                    'state'    => 'England',
                    'timezone' => 'Europe/London',
                ],
                'field'        => [
                    'type'        => 'rectangular',
                    'length'      => 105,
                    'width'       => 68,
                    'orientation' => 0,
                ],
                'structures'   => self::generate_rectangular_stands( 34, 30 ),
                'notes' => 'Historic ground. East Stand cantilever roof dominant feature.',
            ],
            
            // =====================================================
            // ENGLAND - CHAMPIONSHIP (24 teams)
            // =====================================================
            
            'ashton_gate' => [
                'name'         => 'Ashton Gate',
                'common_names' => 'Bristol City',
                'capacity'     => 27000,
                'location'     => [
                    'lat'      => 51.4400,
                    'lng'      => -2.6203,
                    'city'     => 'Bristol',
                    'state'    => 'England',
                    'timezone' => 'Europe/London',
                ],
                'field'        => [
                    'type'        => 'rectangular',
                    'length'      => 105,
                    'width'       => 68,
                    'orientation' => 0,
                ],
                'structures'   => self::generate_rectangular_stands( 26, 22 ),
                'notes' => 'Redeveloped 2016. Also hosts Bristol Bears rugby.',
            ],
            
            'ewood_park' => [
                'name'         => 'Ewood Park',
                'common_names' => 'Blackburn Rovers',
                'capacity'     => 31367,
                'location'     => [
                    'lat'      => 53.7286,
                    'lng'      => -2.4894,
                    'city'     => 'Blackburn',
                    'state'    => 'England',
                    'timezone' => 'Europe/London',
                ],
                'field'        => [
                    'type'        => 'rectangular',
                    'length'      => 105,
                    'width'       => 68,
                    'orientation' => 0,
                ],
                'structures'   => self::generate_rectangular_stands( 30, 26 ),
                'notes' => 'Jack Walker Stand tallest. Traditional ground.',
            ],
            
            'turf_moor' => [
                'name'         => 'Turf Moor',
                'common_names' => 'Burnley',
                'capacity'     => 21944,
                'location'     => [
                    'lat'      => 53.7889,
                    'lng'      => -2.2303,
                    'city'     => 'Burnley',
                    'state'    => 'England',
                    'timezone' => 'Europe/London',
                ],
                'field'        => [
                    'type'        => 'rectangular',
                    'length'      => 105,
                    'width'       => 68,
                    'orientation' => 0,
                ],
                'structures'   => self::generate_rectangular_stands( 24, 20 ),
                'notes' => 'One of oldest grounds in football. Jimmy McIlroy Stand.',
            ],
            
            'cardiff_city' => [
                'name'         => 'Cardiff City Stadium',
                'common_names' => 'Cardiff City',
                'capacity'     => 33280,
                'location'     => [
                    'lat'      => 51.4728,
                    'lng'      => -3.2031,
                    'city'     => 'Cardiff',
                    'state'    => 'Wales',
                    'timezone' => 'Europe/London',
                ],
                'field'        => [
                    'type'        => 'rectangular',
                    'length'      => 105,
                    'width'       => 68,
                    'orientation' => 0,
                ],
                'structures'   => self::generate_rectangular_stands( 28, 24 ),
                'notes' => 'Opened 2009, replaced Ninian Park.',
            ],
            
            'coventry_building' => [
                'name'         => 'Coventry Building Society Arena',
                'common_names' => 'Coventry City Ricoh Arena',
                'capacity'     => 32609,
                'location'     => [
                    'lat'      => 52.4481,
                    'lng'      => -1.4956,
                    'city'     => 'Coventry',
                    'state'    => 'England',
                    'timezone' => 'Europe/London',
                ],
                'field'        => [
                    'type'        => 'rectangular',
                    'length'      => 105,
                    'width'       => 68,
                    'orientation' => 0,
                ],
                'structures'   => self::generate_rectangular_stands( 28, 24 ),
                'notes' => 'Multi-use venue. Opened 2005.',
            ],
            
            'pride_park' => [
                'name'         => 'Pride Park Stadium',
                'common_names' => 'Derby County',
                'capacity'     => 33597,
                'location'     => [
                    'lat'      => 52.9147,
                    'lng'      => -1.4472,
                    'city'     => 'Derby',
                    'state'    => 'England',
                    'timezone' => 'Europe/London',
                ],
                'field'        => [
                    'type'        => 'rectangular',
                    'length'      => 105,
                    'width'       => 68,
                    'orientation' => 0,
                ],
                'structures'   => self::generate_rectangular_stands( 30, 26 ),
                'notes' => 'Opened 1997. Uniform bowl design.',
            ],
            
            'loftus_road' => [
                'name'         => 'Loftus Road',
                'common_names' => 'QPR Queens Park Rangers',
                'capacity'     => 18439,
                'location'     => [
                    'lat'      => 51.5093,
                    'lng'      => -0.2322,
                    'city'     => 'London',
                    'state'    => 'England',
                    'timezone' => 'Europe/London',
                ],
                'field'        => [
                    'type'        => 'rectangular',
                    'length'      => 102,
                    'width'       => 66,
                    'orientation' => 0,
                ],
                'structures'   => self::generate_rectangular_stands( 22, 18 ),
                'notes' => 'Compact West London ground. Close to pitch.',
            ],
            
            'craven_cottage' => [
                'name'         => 'Craven Cottage',
                'common_names' => 'Fulham',
                'capacity'     => 29600,
                'location'     => [
                    'lat'      => 51.4750,
                    'lng'      => -0.2217,
                    'city'     => 'London',
                    'state'    => 'England',
                    'timezone' => 'Europe/London',
                ],
                'field'        => [
                    'type'        => 'rectangular',
                    'length'      => 100,
                    'width'       => 65,
                    'orientation' => 0,
                ],
                'structures'   => self::generate_rectangular_stands( 24, 20 ),
                'notes' => 'Riverside location on Thames. Historic Cottage in corner.',
            ],
            
            'the_den' => [
                'name'         => 'The Den',
                'common_names' => 'Millwall',
                'capacity'     => 20146,
                'location'     => [
                    'lat'      => 51.4860,
                    'lng'      => -0.0509,
                    'city'     => 'London',
                    'state'    => 'England',
                    'timezone' => 'Europe/London',
                ],
                'field'        => [
                    'type'        => 'rectangular',
                    'length'      => 105,
                    'width'       => 68,
                    'orientation' => 0,
                ],
                'structures'   => self::generate_rectangular_stands( 22, 18 ),
                'notes' => 'South London. Dockers Stand behind goal.',
            ],
            
            'riverside' => [
                'name'         => 'Riverside Stadium',
                'common_names' => 'Middlesbrough',
                'capacity'     => 34742,
                'location'     => [
                    'lat'      => 54.5783,
                    'lng'      => -1.2169,
                    'city'     => 'Middlesbrough',
                    'state'    => 'England',
                    'timezone' => 'Europe/London',
                ],
                'field'        => [
                    'type'        => 'rectangular',
                    'length'      => 105,
                    'width'       => 68,
                    'orientation' => 0,
                ],
                'structures'   => self::generate_rectangular_stands( 30, 26 ),
                'notes' => 'Opened 1995. Replaced Ayresome Park.',
            ],
            
            'bramall_lane' => [
                'name'         => 'Bramall Lane',
                'common_names' => 'Sheffield United',
                'capacity'     => 32050,
                'location'     => [
                    'lat'      => 53.3703,
                    'lng'      => -1.4709,
                    'city'     => 'Sheffield',
                    'state'    => 'England',
                    'timezone' => 'Europe/London',
                ],
                'field'        => [
                    'type'        => 'rectangular',
                    'length'      => 105,
                    'width'       => 68,
                    'orientation' => 0,
                ],
                'structures'   => self::generate_rectangular_stands( 30, 26 ),
                'notes' => 'Oldest major stadium still hosting professional football.',
            ],
            
            'hillsborough' => [
                'name'         => 'Hillsborough Stadium',
                'common_names' => 'Sheffield Wednesday',
                'capacity'     => 34854,
                'location'     => [
                    'lat'      => 53.4114,
                    'lng'      => -1.5006,
                    'city'     => 'Sheffield',
                    'state'    => 'England',
                    'timezone' => 'Europe/London',
                ],
                'field'        => [
                    'type'        => 'rectangular',
                    'length'      => 105,
                    'width'       => 68,
                    'orientation' => 5,
                ],
                'structures'   => self::generate_rectangular_stands( 32, 28 ),
                'notes' => 'Historic ground. Hosted 1966 World Cup matches.',
            ],
            
            'bet365_stadium' => [
                'name'         => 'bet365 Stadium',
                'common_names' => 'Stoke City Britannia',
                'capacity'     => 30089,
                'location'     => [
                    'lat'      => 52.9883,
                    'lng'      => -2.1756,
                    'city'     => 'Stoke-on-Trent',
                    'state'    => 'England',
                    'timezone' => 'Europe/London',
                ],
                'field'        => [
                    'type'        => 'rectangular',
                    'length'      => 105,
                    'width'       => 68,
                    'orientation' => 0,
                ],
                'structures'   => self::generate_rectangular_stands( 28, 24 ),
                'notes' => 'Opened 1997. Known for cold, windy conditions.',
            ],
            
            'stadium_of_light' => [
                'name'         => 'Stadium of Light',
                'common_names' => 'Sunderland',
                'capacity'     => 49000,
                'location'     => [
                    'lat'      => 54.9144,
                    'lng'      => -1.3881,
                    'city'     => 'Sunderland',
                    'state'    => 'England',
                    'timezone' => 'Europe/London',
                ],
                'field'        => [
                    'type'        => 'rectangular',
                    'length'      => 105,
                    'width'       => 68,
                    'orientation' => 0,
                ],
                'structures'   => self::generate_rectangular_stands( 38, 34 ),
                'notes' => 'Large capacity. Opened 1997.',
            ],
            
            'swansea_stadium' => [
                'name'         => 'Swansea.com Stadium',
                'common_names' => 'Swansea City Liberty Stadium',
                'capacity'     => 21088,
                'location'     => [
                    'lat'      => 51.6428,
                    'lng'      => -3.9347,
                    'city'     => 'Swansea',
                    'state'    => 'Wales',
                    'timezone' => 'Europe/London',
                ],
                'field'        => [
                    'type'        => 'rectangular',
                    'length'      => 105,
                    'width'       => 68,
                    'orientation' => 0,
                ],
                'structures'   => self::generate_rectangular_stands( 24, 20 ),
                'notes' => 'Shared with Ospreys rugby. Opened 2005.',
            ],
            
            'vicarage_road' => [
                'name'         => 'Vicarage Road',
                'common_names' => 'Watford',
                'capacity'     => 23700,
                'location'     => [
                    'lat'      => 51.6497,
                    'lng'      => -0.4014,
                    'city'     => 'Watford',
                    'state'    => 'England',
                    'timezone' => 'Europe/London',
                ],
                'field'        => [
                    'type'        => 'rectangular',
                    'length'      => 105,
                    'width'       => 68,
                    'orientation' => 0,
                ],
                'structures'   => self::generate_rectangular_stands( 24, 20 ),
                'notes' => 'Shared with Saracens rugby until 2013.',
            ],
            
            'hawthorns' => [
                'name'         => 'The Hawthorns',
                'common_names' => 'West Brom West Bromwich Albion',
                'capacity'     => 26688,
                'location'     => [
                    'lat'      => 52.5090,
                    'lng'      => -1.9636,
                    'city'     => 'West Bromwich',
                    'state'    => 'England',
                    'timezone' => 'Europe/London',
                ],
                'field'        => [
                    'type'        => 'rectangular',
                    'length'      => 105,
                    'width'       => 68,
                    'orientation' => 0,
                ],
                'structures'   => self::generate_rectangular_stands( 26, 22 ),
                'notes' => 'Highest ground above sea level in England.',
            ],
            
            'mkm_stadium' => [
                'name'         => 'MKM Stadium',
                'common_names' => 'Hull City KCOM',
                'capacity'     => 25586,
                'location'     => [
                    'lat'      => 53.7463,
                    'lng'      => -0.3679,
                    'city'     => 'Hull',
                    'state'    => 'England',
                    'timezone' => 'Europe/London',
                ],
                'field'        => [
                    'type'        => 'rectangular',
                    'length'      => 105,
                    'width'       => 68,
                    'orientation' => 0,
                ],
                'structures'   => self::generate_rectangular_stands( 26, 22 ),
                'notes' => 'Opened 2002. Shared with Hull FC rugby league.',
            ],
            
            'kassam_stadium' => [
                'name'         => 'Kassam Stadium',
                'common_names' => 'Oxford United',
                'capacity'     => 12500,
                'location'     => [
                    'lat'      => 51.7164,
                    'lng'      => -1.2081,
                    'city'     => 'Oxford',
                    'state'    => 'England',
                    'timezone' => 'Europe/London',
                ],
                'field'        => [
                    'type'        => 'rectangular',
                    'length'      => 105,
                    'width'       => 68,
                    'orientation' => 0,
                ],
                'structures'   => self::generate_rectangular_stands( 18, 16 ),
                'notes' => 'Three-sided stadium. North end open.',
            ],
            
            'deepdale' => [
                'name'         => 'Deepdale',
                'common_names' => 'Preston North End',
                'capacity'     => 23404,
                'location'     => [
                    'lat'      => 53.7722,
                    'lng'      => -2.6883,
                    'city'     => 'Preston',
                    'state'    => 'England',
                    'timezone' => 'Europe/London',
                ],
                'field'        => [
                    'type'        => 'rectangular',
                    'length'      => 105,
                    'width'       => 68,
                    'orientation' => 0,
                ],
                'structures'   => self::generate_rectangular_stands( 24, 20 ),
                'notes' => 'Oldest Football League ground still in use at top level.',
            ],
            
            'home_park' => [
                'name'         => 'Home Park',
                'common_names' => 'Plymouth Argyle',
                'capacity'     => 18600,
                'location'     => [
                    'lat'      => 50.3881,
                    'lng'      => -4.1508,
                    'city'     => 'Plymouth',
                    'state'    => 'England',
                    'timezone' => 'Europe/London',
                ],
                'field'        => [
                    'type'        => 'rectangular',
                    'length'      => 105,
                    'width'       => 68,
                    'orientation' => 0,
                ],
                'structures'   => self::generate_rectangular_stands( 22, 18 ),
                'notes' => 'Mayflower Grandstand opened 2022. Devon location.',
            ],
            
            'kenilworth_road' => [
                'name'         => 'Kenilworth Road',
                'common_names' => 'Luton Town',
                'capacity'     => 11500,
                'location'     => [
                    'lat'      => 51.8842,
                    'lng'      => -0.4317,
                    'city'     => 'Luton',
                    'state'    => 'England',
                    'timezone' => 'Europe/London',
                ],
                'field'        => [
                    'type'        => 'rectangular',
                    'length'      => 101,
                    'width'       => 66,
                    'orientation' => 0,
                ],
                'structures'   => self::generate_rectangular_stands( 18, 14 ),
                'notes' => 'Compact traditional ground. Away fans enter through houses.',
            ],
            
            'portsmouth_fratton' => [
                'name'         => 'Fratton Park',
                'common_names' => 'Portsmouth Pompey',
                'capacity'     => 20688,
                'location'     => [
                    'lat'      => 50.7964,
                    'lng'      => -1.0639,
                    'city'     => 'Portsmouth',
                    'state'    => 'England',
                    'timezone' => 'Europe/London',
                ],
                'field'        => [
                    'type'        => 'rectangular',
                    'length'      => 105,
                    'width'       => 68,
                    'orientation' => 0,
                ],
                'structures'   => self::generate_rectangular_stands( 22, 18 ),
                'notes' => 'Historic ground opened 1898.',
            ],
            
            // =====================================================
            // JAPAN - J1 LEAGUE (20 teams)
            // =====================================================
            
            'sapporo_dome' => [
                'name'         => 'Sapporo Dome',
                'common_names' => 'Consadole Sapporo',
                'capacity'     => 41580,
                'location'     => [
                    'lat'      => 43.0150,
                    'lng'      => 141.4097,
                    'city'     => 'Sapporo',
                    'state'    => 'Hokkaido',
                    'timezone' => 'Asia/Tokyo',
                ],
                'field'        => [
                    'type'        => 'rectangular',
                    'length'      => 105,
                    'width'       => 68,
                    'orientation' => 0,
                ],
                'structures'   => [
                    [
                        'structure_id'  => 'dome_roof',
                        'name'          => 'Dome Roof',
                        'type'          => 'roof',
                        'height'        => 53,
                        'height_quality'=> self::QUALITY_VERIFIED,
                        'position'      => [ 'x' => 0, 'y' => 0 ],
                        'width'         => 245,
                        'depth'         => 185,
                        'permeability'  => 0.1,
                    ],
                ],
                'notes' => 'Hovering soccer stage - pitch moves outside stadium for sunlight via air flotation.',
            ],
            
            'kashima_stadium' => [
                'name'         => 'Kashima Soccer Stadium',
                'common_names' => 'Kashima Antlers',
                'capacity'     => 40728,
                'location'     => [
                    'lat'      => 35.8997,
                    'lng'      => 140.5839,
                    'city'     => 'Kashima',
                    'state'    => 'Ibaraki',
                    'timezone' => 'Asia/Tokyo',
                ],
                'field'        => [
                    'type'        => 'rectangular',
                    'length'      => 105,
                    'width'       => 68,
                    'orientation' => 0,
                ],
                'structures'   => self::generate_rectangular_stands( 35, 30 ),
                'notes' => '2002 World Cup venue. Coastal location.',
            ],
            
            'saitama_stadium' => [
                'name'         => 'Saitama Stadium 2002',
                'common_names' => 'Urawa Red Diamonds Urawa Reds',
                'capacity'     => 63700,
                'location'     => [
                    'lat'      => 35.8628,
                    'lng'      => 139.7156,
                    'city'     => 'Saitama',
                    'state'    => 'Saitama',
                    'timezone' => 'Asia/Tokyo',
                ],
                'field'        => [
                    'type'        => 'rectangular',
                    'length'      => 105,
                    'width'       => 68,
                    'orientation' => 0,
                ],
                'structures'   => self::generate_rectangular_stands( 45, 40 ),
                'notes' => 'Largest football-specific stadium in Japan. 2002 World Cup semi-final venue.',
            ],
            
            'kashiwa_stadium' => [
                'name'         => 'Sankyo Frontier Kashiwa Stadium',
                'common_names' => 'Kashiwa Reysol Hitachi',
                'capacity'     => 15109,
                'location'     => [
                    'lat'      => 35.8664,
                    'lng'      => 139.9669,
                    'city'     => 'Kashiwa',
                    'state'    => 'Chiba',
                    'timezone' => 'Asia/Tokyo',
                ],
                'field'        => [
                    'type'        => 'rectangular',
                    'length'      => 105,
                    'width'       => 68,
                    'orientation' => 0,
                ],
                'structures'   => self::generate_rectangular_stands( 22, 18 ),
                'notes' => 'Compact J1 venue. Good atmosphere.',
            ],
            
            'ajinomoto_stadium' => [
                'name'         => 'Ajinomoto Stadium',
                'common_names' => 'FC Tokyo Tokyo Verdy Chofu',
                'capacity'     => 49970,
                'location'     => [
                    'lat'      => 35.6647,
                    'lng'      => 139.5272,
                    'city'     => 'Chofu',
                    'state'    => 'Tokyo',
                    'timezone' => 'Asia/Tokyo',
                ],
                'field'        => [
                    'type'        => 'rectangular',
                    'length'      => 105,
                    'width'       => 68,
                    'orientation' => 0,
                ],
                'structures'   => self::generate_rectangular_stands( 38, 34 ),
                'notes' => 'Shared by FC Tokyo and Tokyo Verdy. Athletics track.',
            ],
            
            'nissan_stadium' => [
                'name'         => 'Nissan Stadium',
                'common_names' => 'Yokohama F. Marinos International Stadium',
                'capacity'     => 72327,
                'location'     => [
                    'lat'      => 35.5103,
                    'lng'      => 139.6064,
                    'city'     => 'Yokohama',
                    'state'    => 'Kanagawa',
                    'timezone' => 'Asia/Tokyo',
                ],
                'field'        => [
                    'type'        => 'rectangular',
                    'length'      => 105,
                    'width'       => 68,
                    'orientation' => 0,
                ],
                'structures'   => self::generate_rectangular_stands( 45, 40 ),
                'notes' => '2002 World Cup Final venue. Largest stadium in Japan.',
            ],
            
            'mitsuzawa_stadium' => [
                'name'         => 'NHK Spring Mitsuzawa Stadium',
                'common_names' => 'Yokohama FC',
                'capacity'     => 15454,
                'location'     => [
                    'lat'      => 35.4878,
                    'lng'      => 139.6119,
                    'city'     => 'Yokohama',
                    'state'    => 'Kanagawa',
                    'timezone' => 'Asia/Tokyo',
                ],
                'field'        => [
                    'type'        => 'rectangular',
                    'length'      => 105,
                    'width'       => 68,
                    'orientation' => 0,
                ],
                'structures'   => self::generate_rectangular_stands( 20, 16 ),
                'notes' => 'Compact venue in Yokohama.',
            ],
            
            'shonan_bmw' => [
                'name'         => 'Shonan BMW Stadium Hiratsuka',
                'common_names' => 'Shonan Bellmare Hiratsuka',
                'capacity'     => 15380,
                'location'     => [
                    'lat'      => 35.3319,
                    'lng'      => 139.3500,
                    'city'     => 'Hiratsuka',
                    'state'    => 'Kanagawa',
                    'timezone' => 'Asia/Tokyo',
                ],
                'field'        => [
                    'type'        => 'rectangular',
                    'length'      => 105,
                    'width'       => 68,
                    'orientation' => 0,
                ],
                'structures'   => self::generate_rectangular_stands( 20, 16 ),
                'notes' => 'Coastal location near Sagami Bay.',
            ],
            
            'yamaha_stadium' => [
                'name'         => 'Yamaha Stadium',
                'common_names' => 'Jubilo Iwata',
                'capacity'     => 15165,
                'location'     => [
                    'lat'      => 34.7700,
                    'lng'      => 137.8619,
                    'city'     => 'Iwata',
                    'state'    => 'Shizuoka',
                    'timezone' => 'Asia/Tokyo',
                ],
                'field'        => [
                    'type'        => 'rectangular',
                    'length'      => 105,
                    'width'       => 68,
                    'orientation' => 0,
                ],
                'structures'   => self::generate_rectangular_stands( 22, 18 ),
                'notes' => 'Football-specific stadium. Corporate ownership.',
            ],
            
            'toyota_stadium' => [
                'name'         => 'Toyota Stadium',
                'common_names' => 'Nagoya Grampus',
                'capacity'     => 45000,
                'location'     => [
                    'lat'      => 35.0847,
                    'lng'      => 137.1722,
                    'city'     => 'Toyota',
                    'state'    => 'Aichi',
                    'timezone' => 'Asia/Tokyo',
                ],
                'field'        => [
                    'type'        => 'rectangular',
                    'length'      => 105,
                    'width'       => 68,
                    'orientation' => 0,
                ],
                'structures'   => self::generate_rectangular_stands( 38, 34 ),
                'notes' => 'Opened 2001. Hosts Club World Cup matches.',
            ],
            
            'panasonic_stadium' => [
                'name'         => 'Panasonic Stadium Suita',
                'common_names' => 'Gamba Osaka',
                'capacity'     => 39694,
                'location'     => [
                    'lat'      => 34.8053,
                    'lng'      => 135.5381,
                    'city'     => 'Suita',
                    'state'    => 'Osaka',
                    'timezone' => 'Asia/Tokyo',
                ],
                'field'        => [
                    'type'        => 'rectangular',
                    'length'      => 105,
                    'width'       => 68,
                    'orientation' => 0,
                ],
                'structures'   => self::generate_rectangular_stands( 34, 30 ),
                'notes' => 'Opened 2015. Modern football-specific design.',
            ],
            
            'yanmar_stadium' => [
                'name'         => 'Yanmar Stadium Nagai',
                'common_names' => 'Cerezo Osaka Nagai',
                'capacity'     => 47816,
                'location'     => [
                    'lat'      => 34.6147,
                    'lng'      => 135.5181,
                    'city'     => 'Osaka',
                    'state'    => 'Osaka',
                    'timezone' => 'Asia/Tokyo',
                ],
                'field'        => [
                    'type'        => 'rectangular',
                    'length'      => 105,
                    'width'       => 68,
                    'orientation' => 0,
                ],
                'structures'   => self::generate_rectangular_stands( 36, 32 ),
                'notes' => '2002 World Cup venue. Athletics track present.',
            ],
            
            'noevir_stadium' => [
                'name'         => 'Noevir Stadium Kobe',
                'common_names' => 'Vissel Kobe Misaki Park',
                'capacity'     => 30132,
                'location'     => [
                    'lat'      => 34.6542,
                    'lng'      => 135.1728,
                    'city'     => 'Kobe',
                    'state'    => 'Hyogo',
                    'timezone' => 'Asia/Tokyo',
                ],
                'field'        => [
                    'type'        => 'rectangular',
                    'length'      => 105,
                    'width'       => 68,
                    'orientation' => 0,
                ],
                'structures'   => self::generate_rectangular_stands( 30, 26 ),
                'notes' => 'Retractable roof. 2002 World Cup venue.',
            ],
            
            'edion_stadium' => [
                'name'         => 'EDION Peace Wing Stadium',
                'common_names' => 'Sanfrecce Hiroshima',
                'capacity'     => 28520,
                'location'     => [
                    'lat'      => 34.4272,
                    'lng'      => 132.4411,
                    'city'     => 'Hiroshima',
                    'state'    => 'Hiroshima',
                    'timezone' => 'Asia/Tokyo',
                ],
                'field'        => [
                    'type'        => 'rectangular',
                    'length'      => 105,
                    'width'       => 68,
                    'orientation' => 0,
                ],
                'structures'   => self::generate_rectangular_stands( 28, 24 ),
                'notes' => 'Opened February 2024. Modern football-specific stadium.',
            ],
            
            'best_denki_stadium' => [
                'name'         => 'Best Denki Stadium',
                'common_names' => 'Avispa Fukuoka Level-5',
                'capacity'     => 21562,
                'location'     => [
                    'lat'      => 33.5853,
                    'lng'      => 130.4622,
                    'city'     => 'Fukuoka',
                    'state'    => 'Fukuoka',
                    'timezone' => 'Asia/Tokyo',
                ],
                'field'        => [
                    'type'        => 'rectangular',
                    'length'      => 105,
                    'width'       => 68,
                    'orientation' => 0,
                ],
                'structures'   => self::generate_rectangular_stands( 24, 20 ),
                'notes' => 'Subtropical climate location.',
            ],
            
            'ekimae_stadium' => [
                'name'         => 'Ekimae Real Estate Stadium',
                'common_names' => 'Sagan Tosu',
                'capacity'     => 24130,
                'location'     => [
                    'lat'      => 33.2672,
                    'lng'      => 130.2561,
                    'city'     => 'Tosu',
                    'state'    => 'Saga',
                    'timezone' => 'Asia/Tokyo',
                ],
                'field'        => [
                    'type'        => 'rectangular',
                    'length'      => 105,
                    'width'       => 68,
                    'orientation' => 0,
                ],
                'structures'   => self::generate_rectangular_stands( 22, 18 ),
                'notes' => 'Small city club. Fernando Torres played here.',
            ],
            
            'transcosmos_stadium' => [
                'name'         => 'Peace Stadium Nagasaki',
                'common_names' => 'V-Varen Nagasaki',
                'capacity'     => 20058,
                'location'     => [
                    'lat'      => 32.7889,
                    'lng'      => 129.9239,
                    'city'     => 'Isahaya',
                    'state'    => 'Nagasaki',
                    'timezone' => 'Asia/Tokyo',
                ],
                'field'        => [
                    'type'        => 'rectangular',
                    'length'      => 105,
                    'width'       => 68,
                    'orientation' => 0,
                ],
                'structures'   => self::generate_rectangular_stands( 22, 18 ),
                'notes' => 'Southern Japan location. Mild winters.',
            ],
            
            'machida_gion' => [
                'name'         => 'Machida GION Stadium',
                'common_names' => 'FC Machida Zelvia',
                'capacity'     => 15328,
                'location'     => [
                    'lat'      => 35.5522,
                    'lng'      => 139.4400,
                    'city'     => 'Machida',
                    'state'    => 'Tokyo',
                    'timezone' => 'Asia/Tokyo',
                ],
                'field'        => [
                    'type'        => 'rectangular',
                    'length'      => 105,
                    'width'       => 68,
                    'orientation' => 0,
                ],
                'structures'   => self::generate_rectangular_stands( 18, 16 ),
                'notes' => 'Promoted to J1 in 2024. Compact venue.',
            ],
            
            'denka_stadium' => [
                'name'         => 'Denka Big Swan Stadium',
                'common_names' => 'Albirex Niigata',
                'capacity'     => 42300,
                'location'     => [
                    'lat'      => 37.8764,
                    'lng'      => 139.0497,
                    'city'     => 'Niigata',
                    'state'    => 'Niigata',
                    'timezone' => 'Asia/Tokyo',
                ],
                'field'        => [
                    'type'        => 'rectangular',
                    'length'      => 105,
                    'width'       => 68,
                    'orientation' => 0,
                ],
                'structures'   => self::generate_rectangular_stands( 38, 34 ),
                'notes' => '2002 World Cup venue. Heavy snow region.',
            ],
            
            'sanga_stadium' => [
                'name'         => 'Sanga Stadium by Kyocera',
                'common_names' => 'Kyoto Sanga FC Kameoka',
                'capacity'     => 21600,
                'location'     => [
                    'lat'      => 35.0186,
                    'lng'      => 135.5692,
                    'city'     => 'Kameoka',
                    'state'    => 'Kyoto',
                    'timezone' => 'Asia/Tokyo',
                ],
                'field'        => [
                    'type'        => 'rectangular',
                    'length'      => 105,
                    'width'       => 68,
                    'orientation' => 0,
                ],
                'structures'   => self::generate_rectangular_stands( 24, 20 ),
                'notes' => 'Opened 2020. Modern football-specific design.',
            ],
            
            // =====================================================
            // SPECIAL VENUES
            // =====================================================
            
            'wembley' => [
                'name'         => 'Wembley Stadium',
                'common_names' => 'England National',
                'capacity'     => 90000,
                'location'     => [
                    'lat'      => 51.5560,
                    'lng'      => -0.2795,
                    'city'     => 'London',
                    'state'    => 'England',
                    'timezone' => 'Europe/London',
                ],
                'field'        => [
                    'type'        => 'rectangular',
                    'length'      => 105,
                    'width'       => 68,
                    'orientation' => 0,
                ],
                'structures'   => self::generate_rectangular_stands( 52, 48 ),
                'notes' => 'National stadium. Partial retractable roof. FA Cup, internationals.',
            ],
            
        ];
        
        // Add hemisphere and country metadata for filtering
        self::add_venue_metadata();
    }
    
    /**
     * Add hemisphere and country metadata to all venues
     */
    private static function add_venue_metadata(): void {
        foreach ( self::$stadiums as $venue_id => &$stadium ) {
            $lat = $stadium['location']['lat'] ?? 0;
            
            // Determine hemisphere
            $stadium['hemisphere'] = $lat >= 0 ? 'northern' : 'southern';
            
            // Determine country from timezone/state
            $tz = $stadium['location']['timezone'] ?? '';
            if ( strpos( $tz, 'Australia/' ) === 0 ) {
                $stadium['country'] = 'Australia';
                $stadium['region'] = 'Oceania';
            } elseif ( strpos( $tz, 'Pacific/Auckland' ) === 0 ) {
                $stadium['country'] = 'New Zealand';
                $stadium['region'] = 'Oceania';
            } elseif ( strpos( $tz, 'Europe/London' ) === 0 ) {
                $stadium['country'] = 'United Kingdom';
                $stadium['region'] = 'Europe';
            } elseif ( strpos( $tz, 'Asia/Tokyo' ) === 0 ) {
                $stadium['country'] = 'Japan';
                $stadium['region'] = 'Asia';
            } else {
                $stadium['country'] = 'Unknown';
                $stadium['region'] = 'Unknown';
            }
        }
    }
    
    /**
     * Get stadiums filtered by hemisphere
     * 
     * @param string $hemisphere 'northern' or 'southern'
     * @return array
     */
    public static function get_stadiums_by_hemisphere( string $hemisphere ): array {
        self::init_stadiums();
        self::load_custom_stadiums();
        
        $all = array_merge( self::$stadiums, self::$custom_stadiums );
        
        return array_filter( $all, function( $stadium ) use ( $hemisphere ) {
            $lat = $stadium['location']['lat'] ?? 0;
            $is_southern = $lat < 0;
            return ( $hemisphere === 'southern' ) === $is_southern;
        });
    }
    
    /**
     * Get stadiums filtered by country
     * 
     * @param string $country Country name
     * @return array
     */
    public static function get_stadiums_by_country( string $country ): array {
        self::init_stadiums();
        self::load_custom_stadiums();
        
        $all = array_merge( self::$stadiums, self::$custom_stadiums );
        
        return array_filter( $all, function( $stadium ) use ( $country ) {
            return ( $stadium['country'] ?? '' ) === $country;
        });
    }
    
    /**
     * Get grouped stadium list for dropdown
     * 
     * Returns stadiums grouped by hemisphere > country > state/region
     * 
     * @return array
     */
    public static function get_grouped_stadium_list(): array {
        self::init_stadiums();
        self::load_custom_stadiums();
        
        $all = array_merge( self::$stadiums, self::$custom_stadiums );
        $grouped = [];
        
        foreach ( $all as $venue_id => $stadium ) {
            $hemisphere = $stadium['hemisphere'] ?? 'southern';
            $country = $stadium['country'] ?? 'Unknown';
            $state = $stadium['location']['state'] ?? 'Other';
            
            if ( ! isset( $grouped[ $hemisphere ] ) ) {
                $grouped[ $hemisphere ] = [];
            }
            if ( ! isset( $grouped[ $hemisphere ][ $country ] ) ) {
                $grouped[ $hemisphere ][ $country ] = [];
            }
            if ( ! isset( $grouped[ $hemisphere ][ $country ][ $state ] ) ) {
                $grouped[ $hemisphere ][ $country ][ $state ] = [];
            }
            
            $grouped[ $hemisphere ][ $country ][ $state ][ $venue_id ] = $stadium['name'];
        }
        
        // Sort each level
        foreach ( $grouped as $hemisphere => &$countries ) {
            ksort( $countries );
            foreach ( $countries as $country => &$states ) {
                ksort( $states );
                foreach ( $states as $state => &$venues ) {
                    asort( $venues );
                }
            }
        }
        
        return $grouped;
    }
    
    /**
     * Calculate a simple stadium from just field dimensions
     * 
     * Useful for venues not in the database - generates approximate
     * stand positions based on typical layouts.
     * 
     * @param array $config {
     *     @type string $name       Stadium name
     *     @type float  $lat        Latitude
     *     @type float  $lng        Longitude
     *     @type string $timezone   Timezone
     *     @type string $type       'oval' or 'rectangular'
     *     @type float  $length     Field length (m)
     *     @type float  $width      Field width (m)
     *     @type float  $stand_height Average stand height (m), default 30
     *     @type float  $orientation Degrees from north, default 0
     * }
     * @return array Stadium configuration
     */
    public static function generate_approximate_stadium( array $config ): array {
        $type = $config['type'] ?? 'oval';
        $length = $config['length'] ?? 160;
        $width = $config['width'] ?? 130;
        $height = $config['stand_height'] ?? 30;
        $orientation = $config['orientation'] ?? 0;
        
        // Calculate stand positions based on field shape
        if ( $type === 'oval' ) {
            // Oval grounds - stands around perimeter
            $half_length = $length / 2 + 10;  // 10m setback
            $half_width = $width / 2 + 10;
            
            $structures = [
                [
                    'structure_id'  => 'north_stand',
                    'name'          => 'North Stand',
                    'type'          => 'stand',
                    'height'        => $height,
                    'height_quality'=> self::QUALITY_ESTIMATED,
                    'position'      => [ 'x' => 0, 'y' => $half_length ],
                    'width'         => $width * 0.8,
                    'depth'         => 25,
                    'roof_overhang' => $height * 0.4,
                    'roof_height'   => $height + 4,
                    'permeability'  => 0,
                ],
                [
                    'structure_id'  => 'south_stand',
                    'name'          => 'South Stand',
                    'type'          => 'stand',
                    'height'        => $height,
                    'height_quality'=> self::QUALITY_ESTIMATED,
                    'position'      => [ 'x' => 0, 'y' => -$half_length ],
                    'width'         => $width * 0.8,
                    'depth'         => 25,
                    'roof_overhang' => $height * 0.4,
                    'roof_height'   => $height + 4,
                    'permeability'  => 0,
                ],
                [
                    'structure_id'  => 'east_stand',
                    'name'          => 'East Stand',
                    'type'          => 'stand',
                    'height'        => $height,
                    'height_quality'=> self::QUALITY_ESTIMATED,
                    'position'      => [ 'x' => $half_width, 'y' => 0 ],
                    'width'         => 30,
                    'depth'         => $length * 0.7,
                    'roof_overhang' => $height * 0.4,
                    'roof_height'   => $height + 4,
                    'permeability'  => 0,
                ],
                [
                    'structure_id'  => 'west_stand',
                    'name'          => 'West Stand',
                    'type'          => 'stand',
                    'height'        => $height,
                    'height_quality'=> self::QUALITY_ESTIMATED,
                    'position'      => [ 'x' => -$half_width, 'y' => 0 ],
                    'width'         => 30,
                    'depth'         => $length * 0.7,
                    'roof_overhang' => $height * 0.4,
                    'roof_height'   => $height + 4,
                    'permeability'  => 0,
                ],
            ];
        } else {
            // Rectangular - stands on long sides only typically
            $half_width = $width / 2 + 8;
            
            $structures = [
                [
                    'structure_id'  => 'east_stand',
                    'name'          => 'East Stand',
                    'type'          => 'stand',
                    'height'        => $height,
                    'height_quality'=> self::QUALITY_ESTIMATED,
                    'position'      => [ 'x' => $half_width, 'y' => 0 ],
                    'width'         => 30,
                    'depth'         => $length * 0.9,
                    'roof_overhang' => $height * 0.5,
                    'roof_height'   => $height + 5,
                    'permeability'  => 0,
                ],
                [
                    'structure_id'  => 'west_stand',
                    'name'          => 'West Stand',
                    'type'          => 'stand',
                    'height'        => $height,
                    'height_quality'=> self::QUALITY_ESTIMATED,
                    'position'      => [ 'x' => -$half_width, 'y' => 0 ],
                    'width'         => 30,
                    'depth'         => $length * 0.9,
                    'roof_overhang' => $height * 0.5,
                    'roof_height'   => $height + 5,
                    'permeability'  => 0,
                ],
                [
                    'structure_id'  => 'north_end',
                    'name'          => 'North End',
                    'type'          => 'stand',
                    'height'        => $height * 0.8,
                    'height_quality'=> self::QUALITY_ESTIMATED,
                    'position'      => [ 'x' => 0, 'y' => $length / 2 + 10 ],
                    'width'         => $width,
                    'depth'         => 20,
                    'roof_overhang' => $height * 0.3,
                    'roof_height'   => $height * 0.8 + 4,
                    'permeability'  => 0,
                ],
                [
                    'structure_id'  => 'south_end',
                    'name'          => 'South End',
                    'type'          => 'stand',
                    'height'        => $height * 0.8,
                    'height_quality'=> self::QUALITY_ESTIMATED,
                    'position'      => [ 'x' => 0, 'y' => -$length / 2 - 10 ],
                    'width'         => $width,
                    'depth'         => 20,
                    'roof_overhang' => $height * 0.3,
                    'roof_height'   => $height * 0.8 + 4,
                    'permeability'  => 0,
                ],
            ];
        }
        
        return [
            'name'         => $config['name'] ?? 'Custom Stadium',
            'common_names' => '',
            'capacity'     => null,
            'location'     => [
                'lat'      => $config['lat'],
                'lng'      => $config['lng'],
                'city'     => $config['city'] ?? '',
                'state'    => $config['state'] ?? '',
                'timezone' => $config['timezone'],
            ],
            'field'        => [
                'type'        => $type,
                'length'      => $length,
                'width'       => $width,
                'orientation' => $orientation,
            ],
            'structures'   => $structures,
            'notes'        => 'Auto-generated approximate geometry',
        ];
    }
}
