<?php
/**
 * Radial Obstruction Profile Handler
 * 
 * Processes LiDAR-derived 360° obstruction profiles for shade calculation.
 * Alternative to rectangular structure-based shadow casting - provides more
 * accurate results for complex stadium geometries.
 * 
 * Profile format (from ea_lidar_stadium_obstruction_dataset.py):
 * {
 *   "stadium": "Emirates Stadium",
 *   "club": "Arsenal",
 *   "league": "Premier League",
 *   "pitch_center": {"lat": 51.5549, "lon": -0.1084},
 *   "pitch_elevation_m": 45.2,
 *   "theta_step_deg": 5,
 *   "sectors": [
 *     {"theta_deg": 0, "distance_m": 52, "height_m": 34, "angle_deg": 33.2},
 *     {"theta_deg": 5, "distance_m": 51, "height_m": 34, "angle_deg": 33.7},
 *     ...
 *   ]
 * }
 * 
 * @package Gssh_Stadium
 * @since 1.2.14
 */

if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

class Gssh_Radial_Obstruction_Profile {

    /**
     * Loaded profiles indexed by stadium key
     * @var array
     */
    private static $profiles = [];

    /**
     * Profile file paths
     * @var array
     */
    private static $profile_paths = [];

    /**
     * Whether profiles have been loaded
     * @var bool
     */
    private static $loaded = false;

    /**
     * Initialise with profile data file(s)
     * 
     * @param string|array $json_paths Path(s) to stadium obstruction profile JSON files
     */
    public static function init( $json_paths ) {
        if ( is_string( $json_paths ) ) {
            self::$profile_paths = [ $json_paths ];
        } else {
            self::$profile_paths = $json_paths;
        }
        self::$profiles = [];
        self::$loaded = false;
    }

    /**
     * Add additional profile file
     * 
     * @param string $json_path Path to additional profile JSON
     */
    public static function add_profile_file( string $json_path ) {
        if ( ! in_array( $json_path, self::$profile_paths ) ) {
            self::$profile_paths[] = $json_path;
            self::$loaded = false; // Force reload
        }
    }

    /**
     * Load profiles from all JSON files
     * 
     * @return bool Success
     */
    public static function load_profiles(): bool {
        if ( self::$loaded && ! empty( self::$profiles ) ) {
            return true;
        }

        self::$profiles = [];

        foreach ( self::$profile_paths as $path ) {
            if ( ! file_exists( $path ) ) {
                continue;
            }

            $json = file_get_contents( $path );
            $data = json_decode( $json, true );

            if ( ! is_array( $data ) ) {
                continue;
            }

            // Index by normalised stadium key AND venue_id
            foreach ( $data as $profile ) {
                // Primary index: normalised stadium name
                $key = self::normalise_key( $profile['stadium'] ?? '' );
                if ( $key ) {
                    self::$profiles[ $key ] = $profile;
                }
                
                // Secondary index: venue_id (if present and different from normalised name)
                $venue_id = $profile['venue_id'] ?? '';
                if ( $venue_id && $venue_id !== $key ) {
                    self::$profiles[ $venue_id ] = $profile;
                }
            }
        }

        self::$loaded = true;
        return ! empty( self::$profiles );
    }

    /**
     * Check if a stadium has a radial profile available
     * 
     * @param string $stadium_name Stadium name or key
     * @return bool
     */
    public static function has_profile( string $stadium_name ): bool {
        if ( empty( self::$profiles ) ) {
            self::load_profiles();
        }

        $key = self::normalise_key( $stadium_name );
        return isset( self::$profiles[ $key ] );
    }

    /**
     * Get profile for a stadium
     * 
     * @param string $stadium_name Stadium name or key
     * @return array|null Profile data or null if not found
     */
    public static function get_profile( string $stadium_name ): ?array {
        if ( empty( self::$profiles ) ) {
            self::load_profiles();
        }

        $key = self::normalise_key( $stadium_name );
        return self::$profiles[ $key ] ?? null;
    }

    /**
     * Get obstruction angle at a given azimuth
     * 
     * Interpolates between sector boundaries for smooth results.
     * 
     * @param array  $profile      Profile data with 'sectors' array
     * @param float  $azimuth_deg  Solar azimuth (0=North, 90=East, 180=South, 270=West)
     * @return float Obstruction angle in degrees, or 0 if no obstruction
     */
    public static function get_obstruction_angle( array $profile, float $azimuth_deg ): float {
        $sectors = $profile['sectors'] ?? [];
        if ( empty( $sectors ) ) {
            return 0.0;
        }

        $theta_step = $profile['theta_step_deg'] ?? 5;
        $azimuth_deg = fmod( $azimuth_deg + 360, 360 ); // Normalise to 0-360

        // Find bounding sectors
        $idx_low = (int) floor( $azimuth_deg / $theta_step );
        $idx_high = ( $idx_low + 1 ) % ( 360 / $theta_step );

        // Get sector data (sectors are indexed by position, theta_deg is stored in each)
        $sector_low = $sectors[ $idx_low ] ?? null;
        $sector_high = $sectors[ $idx_high ] ?? null;

        if ( ! $sector_low ) {
            return 0.0;
        }

        $angle_low = $sector_low['angle_deg'] ?? 0;
        
        // If no high sector or NaN values, return low sector value
        if ( ! $sector_high || is_nan( $angle_low ) ) {
            return is_nan( $angle_low ) ? 0.0 : $angle_low;
        }

        $angle_high = $sector_high['angle_deg'] ?? 0;
        if ( is_nan( $angle_high ) ) {
            return is_nan( $angle_low ) ? 0.0 : $angle_low;
        }

        // Linear interpolation
        $theta_low = $sector_low['theta_deg'];
        $fraction = ( $azimuth_deg - $theta_low ) / $theta_step;

        // Handle wrap-around at 360°
        if ( $idx_high === 0 && $idx_low > 0 ) {
            $fraction = ( $azimuth_deg - $theta_low ) / $theta_step;
        }

        return $angle_low + $fraction * ( $angle_high - $angle_low );
    }

    /**
     * Check if a point is shaded given sun position
     * 
     * Simple comparison: if solar altitude < obstruction angle at that azimuth,
     * the sun is blocked by the stand structure.
     * 
     * @param array $profile       Profile data
     * @param float $solar_azimuth Solar azimuth in degrees
     * @param float $solar_altitude Solar altitude/elevation in degrees
     * @return bool True if shaded, false if in direct sunlight
     */
    public static function is_shaded( array $profile, float $solar_azimuth, float $solar_altitude ): bool {
        // Sun below horizon is always "shaded" (no direct light)
        if ( $solar_altitude <= 0 ) {
            return true;
        }

        $obstruction_angle = self::get_obstruction_angle( $profile, $solar_azimuth );
        
        return $solar_altitude < $obstruction_angle;
    }

    /**
     * Calculate shade factor for a full day using radial profile
     * 
     * Returns the fraction of daylight hours that the pitch centre is shaded.
     * 
     * @param array  $profile  Profile data
     * @param array  $sun_path Sun path data from shade engine (array of time/azimuth/elevation)
     * @return array Shade analysis results
     */
    public static function calculate_daily_shade( array $profile, array $sun_path ): array {
        $path = $sun_path['path'] ?? [];
        if ( empty( $path ) ) {
            return [
                'shade_factor'     => 1.0,
                'shaded_hours'     => 0,
                'total_hours'      => 0,
                'hourly_shading'   => [],
                'worst_azimuth'    => null,
                'worst_angle'      => null,
            ];
        }

        $shaded_count = 0;
        $total_count = 0;
        $hourly_shading = [];
        $worst_azimuth = null;
        $worst_deficit = 0;

        foreach ( $path as $point ) {
            $azimuth = $point['azimuth'];
            $elevation = $point['elevation'];

            if ( $elevation <= 0 ) {
                continue; // Skip below-horizon points
            }

            $total_count++;
            $obstruction_angle = self::get_obstruction_angle( $profile, $azimuth );
            $is_shaded = $elevation < $obstruction_angle;

            if ( $is_shaded ) {
                $shaded_count++;
                $deficit = $obstruction_angle - $elevation;
                if ( $deficit > $worst_deficit ) {
                    $worst_deficit = $deficit;
                    $worst_azimuth = $azimuth;
                }
            }

            $hourly_shading[] = [
                'time'              => $point['time'],
                'azimuth'           => $azimuth,
                'elevation'         => $elevation,
                'obstruction_angle' => round( $obstruction_angle, 1 ),
                'shaded'            => $is_shaded,
            ];
        }

        $shade_factor = $total_count > 0 ? $shaded_count / $total_count : 1.0;

        // Estimate hours (assuming 30-min intervals from shade engine)
        $interval_hours = 0.5;
        $shaded_hours = $shaded_count * $interval_hours;
        $total_hours = $total_count * $interval_hours;

        return [
            'shade_factor'     => round( $shade_factor, 3 ),
            'shaded_hours'     => round( $shaded_hours, 1 ),
            'total_hours'      => round( $total_hours, 1 ),
            'sunlit_hours'     => round( $total_hours - $shaded_hours, 1 ),
            'hourly_shading'   => $hourly_shading,
            'worst_azimuth'    => $worst_azimuth,
            'worst_angle'      => $worst_deficit > 0 ? round( self::get_obstruction_angle( $profile, $worst_azimuth ), 1 ) : null,
        ];
    }

    /**
     * Calculate shade at field edges (not just centre)
     * 
     * For more detailed analysis, considers that shadows creep across the field.
     * Uses profile with offset distances to approximate edge shading.
     * 
     * @param array  $profile     Profile data
     * @param array  $sun_path    Sun path data
     * @param float  $field_width Field width in metres (default 68m for football)
     * @param float  $field_length Field length in metres (default 105m for football)
     * @return array Edge shading analysis for N/S/E/W edges
     */
    public static function calculate_edge_shading( 
        array $profile, 
        array $sun_path,
        float $field_width = 68.0,
        float $field_length = 105.0
    ): array {
        $edges = [
            'north' => [ 'offset_x' => 0, 'offset_y' => $field_length / 2 ],
            'south' => [ 'offset_x' => 0, 'offset_y' => -$field_length / 2 ],
            'east'  => [ 'offset_x' => $field_width / 2, 'offset_y' => 0 ],
            'west'  => [ 'offset_x' => -$field_width / 2, 'offset_y' => 0 ],
        ];

        $results = [];

        foreach ( $edges as $edge_name => $offset ) {
            // Adjust obstruction angles based on position offset
            // Closer to a stand = higher effective obstruction angle
            $adjusted_profile = self::adjust_profile_for_offset( $profile, $offset['offset_x'], $offset['offset_y'] );
            $edge_shade = self::calculate_daily_shade( $adjusted_profile, $sun_path );
            $results[ $edge_name ] = $edge_shade;
        }

        // Also include centre for reference
        $results['centre'] = self::calculate_daily_shade( $profile, $sun_path );

        // Summary: worst-case edge
        $worst_edge = 'centre';
        $worst_factor = $results['centre']['shade_factor'];
        foreach ( [ 'north', 'south', 'east', 'west' ] as $edge ) {
            if ( $results[ $edge ]['shade_factor'] > $worst_factor ) {
                $worst_factor = $results[ $edge ]['shade_factor'];
                $worst_edge = $edge;
            }
        }

        $results['summary'] = [
            'worst_edge'        => $worst_edge,
            'worst_shade_factor'=> $worst_factor,
            'centre_shade_factor' => $results['centre']['shade_factor'],
        ];

        return $results;
    }

    /**
     * Adjust profile obstruction angles for an offset position
     * 
     * When calculating shade at field edges, the effective obstruction angle
     * changes based on proximity to stands.
     * 
     * @param array $profile  Original profile
     * @param float $offset_x X offset from centre (+ = East)
     * @param float $offset_y Y offset from centre (+ = North)
     * @return array Adjusted profile
     */
    private static function adjust_profile_for_offset( array $profile, float $offset_x, float $offset_y ): array {
        $adjusted = $profile;
        $adjusted['sectors'] = [];

        foreach ( $profile['sectors'] as $sector ) {
            $theta = $sector['theta_deg'];
            $orig_distance = $sector['distance_m'];
            $orig_height = $sector['height_m'];

            if ( is_nan( $orig_distance ) || is_nan( $orig_height ) ) {
                $adjusted['sectors'][] = $sector;
                continue;
            }

            // Calculate direction vector for this sector (theta=0 is North)
            $dir_x = sin( deg2rad( $theta ) );
            $dir_y = cos( deg2rad( $theta ) );

            // Adjusted distance = original distance minus the projection of offset onto this direction
            $projection = $offset_x * $dir_x + $offset_y * $dir_y;
            $new_distance = max( 1, $orig_distance - $projection );

            // Recalculate obstruction angle with new distance
            $new_angle = rad2deg( atan2( $orig_height, $new_distance ) );

            $adjusted['sectors'][] = [
                'theta_deg'   => $theta,
                'distance_m'  => $new_distance,
                'height_m'    => $orig_height,
                'angle_deg'   => $new_angle,
            ];
        }

        return $adjusted;
    }

    /**
     * Get profile statistics for display/debugging
     * 
     * @param array $profile Profile data
     * @return array Statistics
     */
    public static function get_profile_stats( array $profile ): array {
        $sectors = $profile['sectors'] ?? [];
        if ( empty( $sectors ) ) {
            return [];
        }

        $heights = [];
        $distances = [];
        $angles = [];

        foreach ( $sectors as $sector ) {
            if ( ! is_nan( $sector['height_m'] ?? NAN ) ) {
                $heights[] = $sector['height_m'];
            }
            if ( ! is_nan( $sector['distance_m'] ?? NAN ) ) {
                $distances[] = $sector['distance_m'];
            }
            if ( ! is_nan( $sector['angle_deg'] ?? NAN ) ) {
                $angles[] = $sector['angle_deg'];
            }
        }

        return [
            'stadium'          => $profile['stadium'] ?? 'Unknown',
            'club'             => $profile['club'] ?? '',
            'sector_count'     => count( $sectors ),
            'theta_step_deg'   => $profile['theta_step_deg'] ?? 5,
            'pitch_elevation'  => $profile['pitch_elevation_m'] ?? null,
            'height_min'       => ! empty( $heights ) ? round( min( $heights ), 1 ) : null,
            'height_max'       => ! empty( $heights ) ? round( max( $heights ), 1 ) : null,
            'height_mean'      => ! empty( $heights ) ? round( array_sum( $heights ) / count( $heights ), 1 ) : null,
            'distance_min'     => ! empty( $distances ) ? round( min( $distances ), 1 ) : null,
            'distance_max'     => ! empty( $distances ) ? round( max( $distances ), 1 ) : null,
            'angle_min'        => ! empty( $angles ) ? round( min( $angles ), 1 ) : null,
            'angle_max'        => ! empty( $angles ) ? round( max( $angles ), 1 ) : null,
            'angle_mean'       => ! empty( $angles ) ? round( array_sum( $angles ) / count( $angles ), 1 ) : null,
        ];
    }

    /**
     * Export profile in format suitable for visualisation
     * 
     * @param array $profile Profile data
     * @return array Data for polar chart display
     */
    public static function get_polar_chart_data( array $profile ): array {
        $sectors = $profile['sectors'] ?? [];
        $data = [];

        foreach ( $sectors as $sector ) {
            $data[] = [
                'theta'    => $sector['theta_deg'],
                'distance' => is_nan( $sector['distance_m'] ?? NAN ) ? null : $sector['distance_m'],
                'height'   => is_nan( $sector['height_m'] ?? NAN ) ? null : $sector['height_m'],
                'angle'    => is_nan( $sector['angle_deg'] ?? NAN ) ? null : $sector['angle_deg'],
            ];
        }

        return $data;
    }

    /**
     * Normalise stadium name to key format
     * 
     * @param string $name Stadium name
     * @return string Normalised key
     */
    private static function normalise_key( string $name ): string {
        $key = strtolower( trim( $name ) );
        $key = preg_replace( '/[^a-z0-9]+/', '_', $key );
        $key = trim( $key, '_' );
        return $key;
    }

    /**
     * Register a profile at runtime (e.g. from the profile generator)
     * 
     * Only registers if no profile already exists for this key,
     * so LiDAR-derived profiles always take precedence.
     * 
     * @param string $venue_id  Venue identifier
     * @param array  $profile   Profile data
     * @return bool  True if registered, false if existing profile took precedence
     */
    public static function register_runtime_profile( string $venue_id, array $profile ): bool {
        if ( empty( self::$profiles ) ) {
            self::load_profiles();
        }

        // Don't override existing (presumably higher-quality) profiles
        $key = self::normalise_key( $profile['stadium'] ?? $venue_id );
        if ( isset( self::$profiles[ $key ] ) || isset( self::$profiles[ $venue_id ] ) ) {
            return false;
        }

        if ( $key ) {
            self::$profiles[ $key ] = $profile;
        }
        if ( $venue_id && $venue_id !== $key ) {
            self::$profiles[ $venue_id ] = $profile;
        }

        return true;
    }

    /**
     * Get list of all loaded stadiums
     * 
     * @return array Stadium names
     */
    public static function get_available_stadiums(): array {
        if ( empty( self::$profiles ) ) {
            self::load_profiles();
        }

        $stadiums = [];
        foreach ( self::$profiles as $profile ) {
            $stadiums[] = [
                'key'     => self::normalise_key( $profile['stadium'] ),
                'name'    => $profile['stadium'],
                'club'    => $profile['club'] ?? '',
                'league'  => $profile['league'] ?? '',
            ];
        }

        return $stadiums;
    }
}
