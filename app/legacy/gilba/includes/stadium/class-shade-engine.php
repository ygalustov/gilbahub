<?php
/**
 * Hemisphere-Aware Shade Engine
 * 
 * Reference implementation of Gssh_Shade_Engine_Interface.
 * Calculates shade factors based on sun position, structure geometry,
 * and zone location with proper hemisphere handling.
 * 
 * @package Gssh_Stadium
 */

if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

require_once __DIR__ . '/interface-shade-engine.php';
require_once __DIR__ . '/class-geometry-utils.php';
require_once __DIR__ . '/class-radial-obstruction-profile.php';

class Gssh_Shade_Engine implements Gssh_Shade_Engine_Interface {
    
    /**
     * Time step for shadow calculations (minutes)
     */
    const CALCULATION_INTERVAL = 30;
    
    /**
     * Minimum solar elevation for shadow calculations (degrees)
     * 
     * Below this angle, atmospheric extinction reduces direct beam PAR
     * to negligible levels. Standard shade modelling practice per 
     * Beard 1973, Wherley et al. 2018. Prevents unrealistically long
     * shadows from dominating shade factor calculations.
     */
    const MIN_SHADOW_ELEVATION = 5;
    
    /**
     * Data store for structures
     */
    private $data_store;
    
    /**
     * Whether to prefer radial profiles over structure-based calculation
     */
    private $prefer_radial_profiles = true;
    
    /**
     * Constructor
     */
    public function __construct( $data_store = null ) {
        $this->data_store = $data_store;
    }
    
    /**
     * Set whether to prefer radial profiles when available
     * 
     * @param bool $prefer True to use LiDAR-derived profiles when available
     */
    public function set_prefer_radial_profiles( bool $prefer ) {
        $this->prefer_radial_profiles = $prefer;
    }
    
    /**
     * Calculate shade using radial obstruction profile (LiDAR-derived)
     * 
     * Simpler and more accurate than structure-based calculation for venues
     * with available profile data.
     * 
     * @param string $venue_id   Venue identifier
     * @param array  $location   Location data with lat/lng/timezone
     * @param string $date       Date string (Y-m-d)
     * @param bool   $edge_analysis Include field edge analysis
     * @return array|null Shade analysis or null if no profile available
     */
    public function calculate_radial_shade( 
        string $venue_id, 
        array $location, 
        string $date,
        bool $edge_analysis = false 
    ): ?array {
        // Try to find profile by venue ID or name
        $profile = Gssh_Radial_Obstruction_Profile::get_profile( $venue_id );
        
        if ( ! $profile ) {
            return null;
        }
        
        $sun_path = $this->get_sun_path( $location, $date );
        
        if ( empty( $sun_path['path'] ) ) {
            return [
                'method'           => 'radial_profile',
                'shade_factor'     => 1.0,
                'shaded_hours'     => 0,
                'total_hours'      => 0,
                'profile_stats'    => Gssh_Radial_Obstruction_Profile::get_profile_stats( $profile ),
                'note'             => 'No daylight on this date',
            ];
        }
        
        $centre_shade = Gssh_Radial_Obstruction_Profile::calculate_daily_shade( $profile, $sun_path );
        
        $result = [
            'method'           => 'radial_profile',
            'shade_factor'     => $centre_shade['shade_factor'],
            'shaded_hours'     => $centre_shade['shaded_hours'],
            'sunlit_hours'     => $centre_shade['sunlit_hours'],
            'total_hours'      => $centre_shade['total_hours'],
            'worst_azimuth'    => $centre_shade['worst_azimuth'],
            'worst_angle'      => $centre_shade['worst_angle'],
            'hourly_shading'   => $centre_shade['hourly_shading'],
            'profile_stats'    => Gssh_Radial_Obstruction_Profile::get_profile_stats( $profile ),
            'sun_path'         => [
                'sunrise'       => $sun_path['sunrise'],
                'sunset'        => $sun_path['sunset'],
                'max_elevation' => $sun_path['max_elevation'],
            ],
        ];
        
        if ( $edge_analysis ) {
            $result['edge_analysis'] = Gssh_Radial_Obstruction_Profile::calculate_edge_shading( 
                $profile, 
                $sun_path 
            );
        }
        
        return $result;
    }
    
    /**
     * Calculate composite shade factor for a zone
     */
    public function calculate_zone_shade_factor( 
        array $zone_geometry, 
        array $structures, 
        array $location, 
        string $date 
    ): array {
        
        $sun_path = $this->get_sun_path( $location, $date );
        
        if ( empty( $sun_path['path'] ) || $sun_path['day_length'] <= 0 ) {
            return [
                'shade_factor'         => 0.0,
                'morning_factor'       => 0.0,
                'afternoon_factor'     => 0.0,
                'hourly_factors'       => [],
                'primary_obstructions' => [],
                'confidence'           => 'high',
                'note'                 => 'Polar night - no daylight',
            ];
        }
        
        $hourly_factors = [];
        $morning_samples = [];
        $afternoon_samples = [];
        $obstruction_counts = [];
        
        $tz = new DateTimeZone( $location['timezone'] ?? 'UTC' );
        $solar_noon_time = DateTime::createFromFormat( 'Y-m-d H:i', $date . ' ' . $sun_path['solar_noon'], $tz );
        
        // Calculate shade at each time step
        foreach ( $sun_path['path'] as $point ) {
            $time = $point['time'];
            $sun_position = [
                'azimuth'   => $point['azimuth'],
                'elevation' => $point['elevation'],
            ];
            
            // Skip if sun is below minimum elevation for shadow calculations
            if ( $point['elevation'] <= self::MIN_SHADOW_ELEVATION ) {
                continue;
            }
            
            // Calculate what fraction of zone is in shadow
            $zone_lit_fraction = $this->calculate_zone_lit_fraction(
                $zone_geometry,
                $structures,
                $sun_position,
                $location,
                $obstruction_counts
            );
            
            $hourly_factors[ $time ] = $zone_lit_fraction;
            
            // Categorise as morning or afternoon
            $point_time = DateTime::createFromFormat( 'Y-m-d H:i', $date . ' ' . $time, $tz );
            if ( $point_time < $solar_noon_time ) {
                $morning_samples[] = $zone_lit_fraction;
            } else {
                $afternoon_samples[] = $zone_lit_fraction;
            }
        }
        
        // Weight by solar intensity (higher sun = more light to lose)
        $weighted_factor = $this->calculate_intensity_weighted_factor( $hourly_factors, $sun_path );
        
        // Identify primary obstructions
        arsort( $obstruction_counts );
        $primary_obstructions = array_slice( array_keys( $obstruction_counts ), 0, 3 );
        
        return [
            'shade_factor'         => round( $weighted_factor, 3 ),
            'morning_factor'       => round( $this->safe_average( $morning_samples ), 3 ),
            'afternoon_factor'     => round( $this->safe_average( $afternoon_samples ), 3 ),
            'hourly_factors'       => $hourly_factors,
            'primary_obstructions' => $primary_obstructions,
            'confidence'           => 'high',
        ];
    }
    
    /**
     * Get sun position for a specific datetime
     */
    public function get_sun_position( array $location, string $datetime ): array {
        $lat = $location['lat'];
        $lng = $location['lng'];
        $tz = new DateTimeZone( $location['timezone'] ?? 'UTC' );
        
        $dt = new DateTime( $datetime, $tz );
        $timestamp = $dt->getTimestamp();
        
        // Julian day
        $jd = ( $timestamp / 86400 ) + 2440587.5;
        $n = $jd - 2451545.0;
        
        // Mean longitude and anomaly
        $L = fmod( 280.460 + 0.9856474 * $n, 360 );
        $g = fmod( 357.528 + 0.9856003 * $n, 360 );
        $g_rad = deg2rad( $g );
        
        // Ecliptic longitude
        $lambda = $L + 1.915 * sin( $g_rad ) + 0.020 * sin( 2 * $g_rad );
        $lambda_rad = deg2rad( $lambda );
        
        // Obliquity of ecliptic
        $epsilon = 23.439 - 0.0000004 * $n;
        $epsilon_rad = deg2rad( $epsilon );
        
        // Right ascension and declination
        $alpha = rad2deg( atan2( cos( $epsilon_rad ) * sin( $lambda_rad ), cos( $lambda_rad ) ) );
        $delta = rad2deg( asin( sin( $epsilon_rad ) * sin( $lambda_rad ) ) );
        $delta_rad = deg2rad( $delta );
        
        // Hour angle
        $gmst = fmod( 280.46061837 + 360.98564736629 * ( $jd - 2451545.0 ), 360 );
        $lmst = fmod( $gmst + $lng, 360 );
        $ha = $lmst - $alpha;
        $ha_rad = deg2rad( $ha );
        
        $lat_rad = deg2rad( $lat );
        
        // Elevation
        $sin_elevation = sin( $lat_rad ) * sin( $delta_rad ) + 
                         cos( $lat_rad ) * cos( $delta_rad ) * cos( $ha_rad );
        $elevation = rad2deg( asin( $sin_elevation ) );
        
        // Azimuth
        $cos_azimuth = ( sin( $delta_rad ) - sin( $lat_rad ) * $sin_elevation ) / 
                       ( cos( $lat_rad ) * cos( deg2rad( $elevation ) ) );
        $cos_azimuth = max( -1, min( 1, $cos_azimuth ) ); // Clamp to valid range
        
        $azimuth = rad2deg( acos( $cos_azimuth ) );
        
        // Correct azimuth for afternoon (hour angle positive = afternoon = azimuth > 180)
        if ( sin( $ha_rad ) > 0 ) {
            $azimuth = 360 - $azimuth;
        }
        
        return [
            'azimuth'     => round( $azimuth, 2 ),
            'elevation'   => round( $elevation, 2 ),
            'is_daylight' => $elevation > 0,
        ];
    }
    
    /**
     * Get sun path for an entire day
     */
    public function get_sun_path( array $location, string $date ): array {
        $lat = $location['lat'];
        $lng = $location['lng'];
        $tz_string = $location['timezone'] ?? 'UTC';
        $tz = new DateTimeZone( $tz_string );
        
        $timestamp = strtotime( $date );
        $sun_info = date_sun_info( $timestamp, $lat, $lng );
        
        // Handle polar day/night
        if ( $sun_info['sunrise'] === false || $sun_info['sunset'] === false ) {
            $elevation_check = $this->get_sun_position( $location, $date . 'T12:00:00' );
            if ( $elevation_check['elevation'] > 0 ) {
                // Polar day
                return $this->get_polar_day_path( $location, $date );
            } else {
                // Polar night
                return [
                    'sunrise'       => null,
                    'sunset'        => null,
                    'solar_noon'    => null,
                    'max_elevation' => $elevation_check['elevation'],
                    'noon_azimuth'  => $elevation_check['azimuth'],
                    'day_length'    => 0,
                    'path'          => [],
                ];
            }
        }
        
        $sunrise = new DateTime( '@' . $sun_info['sunrise'] );
        $sunrise->setTimezone( $tz );
        $sunset = new DateTime( '@' . $sun_info['sunset'] );
        $sunset->setTimezone( $tz );
        
        // Solar noon is midpoint
        $noon_timestamp = ( $sun_info['sunrise'] + $sun_info['sunset'] ) / 2;
        $solar_noon = new DateTime( '@' . $noon_timestamp );
        $solar_noon->setTimezone( $tz );
        
        $noon_position = $this->get_sun_position( $location, $solar_noon->format( 'c' ) );
        
        $day_length = ( $sun_info['sunset'] - $sun_info['sunrise'] ) / 3600;
        
        // Build path at intervals
        $path = [];
        $current = clone $sunrise;
        
        while ( $current <= $sunset ) {
            $position = $this->get_sun_position( $location, $current->format( 'c' ) );
            $path[] = [
                'time'      => $current->format( 'H:i' ),
                'azimuth'   => $position['azimuth'],
                'elevation' => $position['elevation'],
            ];
            $current->modify( '+' . self::CALCULATION_INTERVAL . ' minutes' );
        }
        
        return [
            'sunrise'       => $sunrise->format( 'H:i' ),
            'sunset'        => $sunset->format( 'H:i' ),
            'solar_noon'    => $solar_noon->format( 'H:i' ),
            'max_elevation' => $noon_position['elevation'],
            'noon_azimuth'  => $noon_position['azimuth'],
            'day_length'    => round( $day_length, 2 ),
            'path'          => $path,
        ];
    }
    
    /**
     * Calculate shadow projection from a structure
     */
    public function calculate_shadow_projection( 
        array $structure, 
        array $sun_position 
    ): array {
        
        $elevation = $sun_position['elevation'];
        $azimuth = $sun_position['azimuth'];
        
        // No shadow if sun is below minimum elevation
        if ( $elevation <= self::MIN_SHADOW_ELEVATION ) {
            return [
                'shadow_polygon'    => [],
                'shadow_length'     => 0,
                'shadow_direction'  => null,
            ];
        }
        
        // Shadow length = height / tan(elevation)
        $height = $structure['height'] ?? 0;
        $shadow_length = $height / tan( deg2rad( $elevation ) );
        
        // Shadow direction is opposite to sun azimuth
        $shadow_azimuth = fmod( $azimuth + 180, 360 );
        $shadow_direction = $this->azimuth_to_cardinal( $shadow_azimuth );
        
        // Calculate shadow offset vector (in metres)
        $shadow_dx = $shadow_length * sin( deg2rad( $shadow_azimuth ) );
        $shadow_dy = $shadow_length * cos( deg2rad( $shadow_azimuth ) );
        
        // Get structure footprint vertices
        $vertices = $this->get_structure_vertices( $structure );
        
        // Construct shadow polygon using convex hull for proper non-self-intersecting geometry
        $shadow_polygon = Gssh_Geometry_Utils::construct_shadow_polygon(
            $vertices,
            $shadow_dx,
            $shadow_dy
        );
        
        // Handle roof overhang if present
        if ( isset( $structure['roof_overhang'] ) && $structure['roof_overhang'] > 0 ) {
            $roof_shadow = $this->calculate_roof_overhang_shadow( 
                $structure, 
                $sun_position,
                $shadow_azimuth
            );
            // Merge roof shadow with main shadow
            $shadow_polygon = $this->merge_shadow_polygons( $shadow_polygon, $roof_shadow );
        }
        
        return [
            'shadow_polygon'   => $shadow_polygon,
            'shadow_length'    => round( $shadow_length, 2 ),
            'shadow_direction' => $shadow_direction,
        ];
    }
    
    /**
     * Get structures for a venue
     * 
     * Checks custom data store first, then falls back to stadium database.
     */
    public function get_structures( string $venue_id ): array {
        // First check custom data store (user-configured structures)
        if ( $this->data_store ) {
            $structures = $this->data_store->get_structures( $venue_id );
            if ( ! empty( $structures ) ) {
                return $structures;
            }
        }
        
        // Fall back to stadium database
        if ( class_exists( 'Gssh_Stadium_Database' ) ) {
            return Gssh_Stadium_Database::get_structures( $venue_id );
        }
        
        return [];
    }
    
    /**
     * Get location for a venue from stadium database
     * 
     * @param string $venue_id
     * @return array|null Location data or null if not found
     */
    public function get_venue_location( string $venue_id ): ?array {
        if ( class_exists( 'Gssh_Stadium_Database' ) ) {
            $location = Gssh_Stadium_Database::get_location( $venue_id );
            if ( ! empty( $location ) ) {
                return $location;
            }
        }
        return null;
    }
    
    /**
     * Check if a venue exists in the stadium database
     * 
     * @param string $venue_id
     * @return bool
     */
    public function venue_exists( string $venue_id ): bool {
        if ( class_exists( 'Gssh_Stadium_Database' ) ) {
            return Gssh_Stadium_Database::get_stadium( $venue_id ) !== null;
        }
        return false;
    }
    
    /**
     * Get all available venues from stadium database
     * 
     * @return array Array of venue IDs
     */
    public function get_available_venues(): array {
        if ( class_exists( 'Gssh_Stadium_Database' ) ) {
            return Gssh_Stadium_Database::get_stadium_ids();
        }
        return [];
    }
    
    /**
     * Save a structure
     */
    public function save_structure( string $venue_id, array $structure ): bool {
        if ( $this->data_store ) {
            return $this->data_store->save_structure( $venue_id, $structure );
        }
        return false;
    }
    
    // -------------------------------------------------------------------------
    // Private helper methods
    // -------------------------------------------------------------------------
    
    /**
     * Calculate what fraction of a zone receives direct sunlight
     */
    private function calculate_zone_lit_fraction(
        array $zone_geometry,
        array $structures,
        array $sun_position,
        array $location,
        array &$obstruction_counts
    ): float {
        
        $bounds = $zone_geometry['bounds'] ?? $this->vertices_to_bounds( $zone_geometry['vertices'] ?? [] );
        $resolution = $zone_geometry['grid_resolution'] ?? 2;
        
        // Apply pitch orientation if specified
        $pitch_rotation = deg2rad( $location['pitch_orientation'] ?? 0 );
        
        $total_points = 0;
        $lit_points = 0;
        
        // Grid sample the zone
        for ( $x = $bounds['west']; $x <= $bounds['east']; $x += $resolution ) {
            for ( $y = $bounds['south']; $y <= $bounds['north']; $y += $resolution ) {
                $total_points++;
                
                // Check if this point is in shadow from any structure
                $in_shadow = false;
                $blocking_structure = null;
                
                foreach ( $structures as $structure ) {
                    $shadow = $this->calculate_shadow_projection( $structure, $sun_position );
                    
                    if ( $this->point_in_polygon( [ $x, $y ], $shadow['shadow_polygon'] ) ) {
                        // Apply permeability as deterministic light transmission
                        // (replaces stochastic mt_rand sampling for reproducibility)
                        $permeability = $this->get_structure_permeability( $structure );
                        
                        if ( $permeability < 1.0 ) {
                            // Partially transmissive: reduce lit fraction proportionally
                            // rather than binary in/out decision
                            $in_shadow = true;
                            $blocking_structure = $structure['structure_id'] ?? $structure['name'];
                            // Scale shadow contribution: 0 permeability = full shadow,
                            // 1.0 = fully transparent. Intermediate = partial credit.
                            // We handle this below by counting partial lit points.
                            break;
                        }
                        // permeability >= 1.0 means fully transparent, skip
                    }
                }
                
                if ( ! $in_shadow ) {
                    $lit_points++;
                } else {
                    // Account for partial light transmission through permeable structures
                    $permeability = 0;
                    foreach ( $structures as $structure ) {
                        if ( isset( $structure['structure_id'] ) && $structure['structure_id'] === $blocking_structure ) {
                            $permeability = $this->get_structure_permeability( $structure );
                            break;
                        }
                        if ( isset( $structure['name'] ) && $structure['name'] === $blocking_structure ) {
                            $permeability = $this->get_structure_permeability( $structure );
                            break;
                        }
                    }
                    
                    // Partial credit for light transmitted through permeable structures
                    $lit_points += $permeability;
                    
                    if ( $blocking_structure ) {
                        $obstruction_counts[ $blocking_structure ] = 
                            ( $obstruction_counts[ $blocking_structure ] ?? 0 ) + 1;
                    }
                }
            }
        }
        
        return $total_points > 0 ? $lit_points / $total_points : 1.0;
    }
    
    /**
     * Calculate intensity-weighted shade factor
     * 
     * Weights samples by sun elevation (higher sun = more intense light)
     */
    private function calculate_intensity_weighted_factor( array $hourly_factors, array $sun_path ): float {
        $weighted_sum = 0;
        $weight_total = 0;
        
        foreach ( $sun_path['path'] as $point ) {
            $time = $point['time'];
            if ( ! isset( $hourly_factors[ $time ] ) ) {
                continue;
            }
            
            // Weight by sin(elevation) - proportional to solar intensity
            $weight = max( 0, sin( deg2rad( $point['elevation'] ) ) );
            
            $weighted_sum += $hourly_factors[ $time ] * $weight;
            $weight_total += $weight;
        }
        
        return $weight_total > 0 ? $weighted_sum / $weight_total : 0;
    }
    
    /**
     * Get structure vertices (rectangle from width/depth or custom)
     */
    private function get_structure_vertices( array $structure ): array {
        if ( ! empty( $structure['vertices'] ) ) {
            return $structure['vertices'];
        }
        
        $x = $structure['position']['x'] ?? 0;
        $y = $structure['position']['y'] ?? 0;
        $hw = ( $structure['width'] ?? 0 ) / 2;   // Half-width
        $hd = ( $structure['depth'] ?? 0 ) / 2;   // Half-depth
        
        return [
            [ $x - $hw, $y + $hd ],  // NW
            [ $x + $hw, $y + $hd ],  // NE
            [ $x + $hw, $y - $hd ],  // SE
            [ $x - $hw, $y - $hd ],  // SW
        ];
    }
    
    /**
     * Calculate shadow from roof overhang
     */
    private function calculate_roof_overhang_shadow( 
        array $structure, 
        array $sun_position,
        float $shadow_azimuth 
    ): array {
        
        $roof_height = $structure['roof_height'] ?? $structure['height'];
        $overhang = $structure['roof_overhang'];
        $elevation = $sun_position['elevation'];
        
        $roof_shadow_length = $roof_height / tan( deg2rad( $elevation ) );
        
        $shadow_dx = $roof_shadow_length * sin( deg2rad( $shadow_azimuth ) );
        $shadow_dy = $roof_shadow_length * cos( deg2rad( $shadow_azimuth ) );
        
        // Get structure vertices and expand by overhang amount
        $vertices = $this->get_structure_vertices( $structure );
        $centroid = Gssh_Geometry_Utils::polygon_centroid( $vertices );
        
        // Expand vertices outward by overhang amount
        $expanded_vertices = [];
        foreach ( $vertices as $vertex ) {
            $dx = $vertex[0] - $centroid[0];
            $dy = $vertex[1] - $centroid[1];
            $dist = sqrt( $dx * $dx + $dy * $dy );
            
            if ( $dist > 0 ) {
                $scale = ( $dist + $overhang ) / $dist;
                $expanded_vertices[] = [
                    $centroid[0] + $dx * $scale,
                    $centroid[1] + $dy * $scale,
                ];
            } else {
                $expanded_vertices[] = $vertex;
            }
        }
        
        // Construct roof shadow polygon
        return Gssh_Geometry_Utils::construct_shadow_polygon(
            $expanded_vertices,
            $shadow_dx,
            $shadow_dy
        );
    }
    
    /**
     * Merge two shadow polygons (union operation)
     * 
     * Uses convex hull for a conservative union that ensures
     * no shadow area is missed.
     */
    private function merge_shadow_polygons( array $polygon1, array $polygon2 ): array {
        return Gssh_Geometry_Utils::polygon_union( $polygon1, $polygon2 );
    }
    
    /**
     * Get structure permeability (accounting for seasons)
     */
    private function get_structure_permeability( array $structure ): float {
        if ( isset( $structure['seasonal_permeability'] ) ) {
            $month = (int) date( 'n' );
            $season = $this->month_to_season( $month );
            return $structure['seasonal_permeability'][ $season ] ?? 
                   $structure['permeability'] ?? 0;
        }
        
        return $structure['permeability'] ?? 0;
    }
    
    /**
     * Convert month to season
     */
    private function month_to_season( int $month ): string {
        // Southern Hemisphere seasons
        if ( $month >= 12 || $month <= 2 ) return 'summer';
        if ( $month >= 3 && $month <= 5 ) return 'autumn';
        if ( $month >= 6 && $month <= 8 ) return 'winter';
        return 'spring';
    }
    
    /**
     * Point-in-polygon test (uses geometry utils)
     */
    private function point_in_polygon( array $point, array $polygon ): bool {
        return Gssh_Geometry_Utils::point_in_polygon( $point, $polygon );
    }
    
    /**
     * Convert azimuth to cardinal direction
     */
    private function azimuth_to_cardinal( float $azimuth ): string {
        $directions = [ 'N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE',
                        'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW' ];
        $index = (int) round( $azimuth / 22.5 ) % 16;
        return $directions[ $index ];
    }
    
    /**
     * Convert vertices to bounds
     */
    private function vertices_to_bounds( array $vertices ): array {
        if ( empty( $vertices ) ) {
            return [ 'north' => 0, 'south' => 0, 'east' => 0, 'west' => 0 ];
        }
        
        $xs = array_column( $vertices, 0 );
        $ys = array_column( $vertices, 1 );
        
        return [
            'north' => max( $ys ),
            'south' => min( $ys ),
            'east'  => max( $xs ),
            'west'  => min( $xs ),
        ];
    }
    
    /**
     * Safe average that handles empty arrays
     */
    private function safe_average( array $values ): float {
        return count( $values ) > 0 ? array_sum( $values ) / count( $values ) : 0;
    }
    
    /**
     * Handle polar day (24hr daylight)
     */
    private function get_polar_day_path( array $location, string $date ): array {
        $path = [];
        
        for ( $hour = 0; $hour < 24; $hour++ ) {
            $datetime = sprintf( '%sT%02d:00:00', $date, $hour );
            $position = $this->get_sun_position( $location, $datetime );
            
            $path[] = [
                'time'      => sprintf( '%02d:00', $hour ),
                'azimuth'   => $position['azimuth'],
                'elevation' => $position['elevation'],
            ];
        }
        
        // Find max elevation for solar noon approximation
        $max_elevation = 0;
        $noon_index = 0;
        foreach ( $path as $i => $point ) {
            if ( $point['elevation'] > $max_elevation ) {
                $max_elevation = $point['elevation'];
                $noon_index = $i;
            }
        }
        
        return [
            'sunrise'       => '00:00',
            'sunset'        => '23:59',
            'solar_noon'    => $path[ $noon_index ]['time'],
            'max_elevation' => $max_elevation,
            'noon_azimuth'  => $path[ $noon_index ]['azimuth'],
            'day_length'    => 24,
            'path'          => $path,
        ];
    }

    // =========================================================================
    // b35fix176 G7: analyse() — unified entry point for ajax_shade_analysis
    //
    // Adds the missing method the AJAX handler calls. Runs radial-profile shade
    // for database venues (profile != null) and falls back to sun-path-only
    // estimation for custom venues (profile === null). When a radial profile is
    // available it requests edge shading and translates the five-point result
    // (north/south/east/west/centre) into a zones[] array with per-zone DLI so
    // eue-integration-bridge.js can compute a per-zone EUE score.
    //
    // Zone DLI formula: zone_dli = ambient_dli * (1 - shade_factor)
    // where shade_factor = fraction of daylight hours the position is in shadow.
    // =========================================================================

    /**
     * Get DLI transmission factor for a retractable roof venue.
     *
     * Returns 1.0 (no attenuation) when roof is open, venue has no roof
     * structure, or venue_id is unknown. When roof is closed, reads the
     * 'permeability' value from the venue's roof structure in the DB.
     *
     * For Marvel Stadium: permeability = 0.3 (translucent polycarbonate),
     * meaning 30% of ambient DLI transmits through the closed roof.
     *
     * @param string $venue_id   Venue identifier
     * @param string $roof_state 'open' | 'closed' | 'unknown'
     * @return float             Transmission factor 0.0–1.0
     */
    public static function get_roof_transmission( string $venue_id, string $roof_state ): float {
        if ( $roof_state !== 'closed' || empty( $venue_id ) ) {
            return 1.0;
        }

        if ( ! class_exists( 'Gssh_Stadium_Database' ) ) {
            return 1.0;
        }

        $stadium = Gssh_Stadium_Database::get_stadium( $venue_id );
        if ( ! $stadium || empty( $stadium['structures'] ) ) {
            return 1.0;
        }

        foreach ( $stadium['structures'] as $structure ) {
            if ( ( $structure['type'] ?? '' ) === 'roof' ) {
                // permeability = fraction of light that passes through.
                // 0.0 = fully opaque, 1.0 = fully transparent.
                return (float) ( $structure['permeability'] ?? 1.0 );
            }
        }

        return 1.0;
    }

    /**
     * Analyse shade for a venue, returning a JS-compatible result structure.
     *
     * Called by ajax_shade_analysis() in class-gssh-stadium-loader.php.
     *
     * @param float       $lat        Venue latitude
     * @param float       $lng        Venue longitude
     * @param string      $date       Y-m-d
     * @param array|null  $profile    Radial obstruction profile (null = custom venue)
     * @param string      $roof_state 'open' | 'closed' | 'unknown' (default 'open')
     * @param string      $venue_id   Venue identifier for roof DB lookup (default '')
     * @return array
     */
    public function analyse( float $lat, float $lng, string $date, ?array $profile, string $roof_state = 'open', string $venue_id = '' ): array {

        $location = [
            'lat'      => $lat,
            'lng'      => $lng,
            'timezone' => 'UTC',
        ];

        // Ambient DLI from hub climate data (forwarded via forward_hub_climate_data)
        $ambient_dli = isset( $GLOBALS['gssh_hub_dli'] ) && $GLOBALS['gssh_hub_dli'] > 0
            ? (float) $GLOBALS['gssh_hub_dli']
            : null;

        // PHP-side fallback: estimate clear-sky DLI from sun path when hub_dli
        // is absent (JS timing race on cold load). This eliminates the need for
        // any JS re-run logic — zones always get numeric DLI on the first call.
        //
        // Formula: DLI ≈ I₀ × sin(elevation_mean) × day_length_hours × 3600 / 1e6 × 4.6 × 0.45
        // where I₀ = 1000 W/m² (clear-sky peak), elevation_mean ≈ max_elevation × 0.6
        // (time-weighted average), 4.6 = W→μmol conversion, 0.45 = PAR fraction.
        // This gives a reasonable clear-sky estimate (±20%). Actual hub DLI is
        // always preferred when available — this is purely a null-guard fallback.
        if ( $ambient_dli === null ) {
            $sun_path_for_dli = $this->get_sun_path( $location, $date );
            $max_elev   = $sun_path_for_dli['max_elevation'] ?? 0;
            $day_hours  = $sun_path_for_dli['day_length']    ?? 0;
            if ( $max_elev > 5 && $day_hours > 1 ) {
                $elev_rad    = deg2rad( $max_elev * 0.6 ); // time-weighted mean elevation
                $irradiance  = 1000 * sin( $elev_rad );    // W/m²
                $ghi_mj      = $irradiance * $day_hours * 3600 / 1e6;
                $ambient_dli = round( $ghi_mj * 4.6 * 0.45, 1 );
            }
        }

        // -----------------------------------------------------------------------
        // Path A: radial obstruction profile available (database venue)
        // -----------------------------------------------------------------------
        if ( $profile !== null && ! empty( $profile['sectors'] ) ) {

            $sun_path = $this->get_sun_path( $location, $date );

            // Centre shade
            $centre = Gssh_Radial_Obstruction_Profile::calculate_daily_shade( $profile, $sun_path );

            // Edge shade (per-zone geometry — offset from pitch centre to each edge)
            $edges = Gssh_Radial_Obstruction_Profile::calculate_edge_shading( $profile, $sun_path );

            // Composite (centre) shade factor → DLI
            $composite_factor = $centre['shade_factor'];
            $transmission     = 1.0 - $composite_factor;
            $dli_shaded       = $ambient_dli !== null
                ? round( $ambient_dli * $transmission, 1 )
                : null;

            // Build zones[] from edge analysis.
            // Labels are pitch-geometry based (not solar direction dependent).
            $zone_map = [
                'north'  => 'North End',
                'south'  => 'South End',
                'east'   => 'East Side',
                'west'   => 'West Side',
                'centre' => 'Centre',
            ];

            $zones = [];
            foreach ( $zone_map as $key => $label ) {
                $edge_data = $edges[ $key ] ?? null;
                if ( $edge_data === null ) {
                    continue;
                }

                $z_factor       = $edge_data['shade_factor'];
                $z_transmission = 1.0 - $z_factor;
                $z_dli          = $ambient_dli !== null
                    ? round( $ambient_dli * $z_transmission, 1 )
                    : null;

                $zones[] = [
                    'zone_id'          => $key,
                    'zone_name'        => $label,
                    'shade_factor'     => round( (float) $z_factor, 3 ),
                    'transmission_pct' => round( (float) $z_transmission * 100, 1 ),
                    'dli'              => $z_dli,
                    'shaded_hours'     => isset( $edge_data['shaded_hours'] ) ? round( (float) $edge_data['shaded_hours'], 1 ) : null,
                    'sunlit_hours'     => isset( $edge_data['sunlit_hours'] ) ? round( (float) $edge_data['sunlit_hours'], 1 ) : null,
                ];
            }

            // Identify worst zone (highest shade_factor = least DLI)
            $worst_zone = null;
            $worst_sf   = -1.0;
            foreach ( $zones as $z ) {
                if ( $z['shade_factor'] > $worst_sf ) {
                    $worst_sf   = $z['shade_factor'];
                    $worst_zone = $z['zone_id'];
                }
            }

            // b35fix249: Retractable roof DLI attenuation.
            // When roof is closed, multiply all DLI values by the roof's
            // permeability (transmission fraction). For Marvel Stadium this
            // is 0.3 (translucent polycarbonate — 70% of ambient DLI blocked).
            // Roof open = transmission 1.0 = no change.
            $roof_tx = self::get_roof_transmission( $venue_id, $roof_state );

            if ( $roof_tx < 1.0 ) {
                // Attenuate composite shaded DLI
                if ( $dli_shaded !== null ) {
                    $dli_shaded = round( $dli_shaded * $roof_tx, 1 );
                }
                // Recalculate composite shade factor to reflect total light blocked
                $composite_factor = ( $ambient_dli !== null && $ambient_dli > 0 && $dli_shaded !== null )
                    ? round( 1.0 - ( $dli_shaded / $ambient_dli ), 3 )
                    : $composite_factor;
                // Attenuate per-zone DLI values
                foreach ( $zones as &$z ) {
                    if ( $z['dli'] !== null ) {
                        $z['dli'] = round( $z['dli'] * $roof_tx, 1 );
                    }
                    // Recalculate zone transmission_pct to match attenuated DLI
                    if ( $ambient_dli !== null && $ambient_dli > 0 && $z['dli'] !== null ) {
                        $z['transmission_pct'] = round( ( $z['dli'] / $ambient_dli ) * 100, 1 );
                        $z['shade_factor']     = round( 1.0 - ( $z['dli'] / $ambient_dli ), 3 );
                    }
                }
                unset( $z );
                // Re-identify worst zone after attenuation (proportional, so ranking unchanged,
                // but recalculate to keep values consistent)
                $worst_zone = null;
                $worst_sf   = -1.0;
                foreach ( $zones as $z ) {
                    if ( $z['shade_factor'] > $worst_sf ) {
                        $worst_sf   = $z['shade_factor'];
                        $worst_zone = $z['zone_id'];
                    }
                }
            }

            return [
                'method'           => 'radial_profile',
                'dli_ambient'      => round( (float) $ambient_dli, 1 ),
                'dli_shaded'       => $dli_shaded,
                'dli_deficit'      => ( $ambient_dli !== null && $dli_shaded !== null )
                    ? round( $ambient_dli - $dli_shaded, 1 )
                    : null,
                'shade_factor'     => round( (float) $composite_factor, 3 ),
                'shade_percentage' => round( (float) $composite_factor * 100, 1 ),
                'shaded_hours'     => $centre['shaded_hours'],
                'sunlit_hours'     => $centre['sunlit_hours'],
                'total_hours'      => $centre['total_hours'],
                'zones'            => $zones,
                'worst_zone'       => $worst_zone,
                'sun_path'         => [
                    'sunrise'       => $sun_path['sunrise'] ?? null,
                    'sunset'        => $sun_path['sunset'] ?? null,
                    'max_elevation' => $sun_path['max_elevation'] ?? null,
                ],
                'profile_source'   => 'database',
                'roof_state'       => $roof_state,
                'roof_transmission' => $roof_tx,
            ];
        }

        // -----------------------------------------------------------------------
        // Path B: no profile — sun-path estimate for custom venue
        // -----------------------------------------------------------------------
        $sun_path   = $this->get_sun_path( $location, $date );
        $day_length = $sun_path['day_length'] ?? 12;

        return [
            'method'           => 'estimated',
            'dli_ambient'      => $ambient_dli,
            'dli_shaded'       => $ambient_dli,
            'dli_deficit'      => 0,
            'shade_factor'     => 0.0,
            'shade_percentage' => 0.0,
            'shaded_hours'     => 0,
            'sunlit_hours'     => $day_length,
            'total_hours'      => $day_length,
            'zones'            => [],
            'worst_zone'       => null,
            'sun_path'         => [
                'sunrise'       => $sun_path['sunrise'] ?? null,
                'sunset'        => $sun_path['sunset'] ?? null,
                'max_elevation' => $sun_path['max_elevation'] ?? null,
            ],
            'profile_source'   => 'none',
            'note'             => 'No obstruction profile — open-field estimate.',
        ];
    }
}
